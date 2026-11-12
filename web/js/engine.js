/* Zündung – Duell-Regeln. Reine Logik ohne DOM: jede Aktion liefert eine geordnete Ereignisliste,
   die von der Oberfläche nur noch abgespielt wird. */
(function (ZU) {
  'use strict';

  /* Seedbarer Zufall (mulberry32). Der Zustand ist eine einzelne Zahl und damit speicherbar. */
  ZU.Rng = function (seed) { this.state = seed >>> 0; };
  ZU.Rng.prototype.next = function () {
    var t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ZU.Rng.prototype.int = function (n) { return Math.floor(this.next() * n); };
  ZU.Rng.prototype.pick = function (list) { return list[this.int(list.length)]; };
  ZU.Rng.prototype.shuffle = function (list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = this.int(i + 1), tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  };

  function other(actor) { return actor === 'player' ? 'opp' : 'player'; }

  /* Wie viele Spezialkarten der Gegner in den Stapel mischt bzw. auf der Hand hält. */
  ZU.enemySpecials = function (kind, act) {
    var a = Math.min(act, 3), extra = Math.max(0, act - 3);
    var stock = (kind === 'battle' ? 2 : kind === 'elite' ? 4 : 6) + (a - 1) * 2 + extra * 2;
    var hand = kind === 'battle' ? (a >= 2 ? 1 : 0) : kind === 'elite' ? (a >= 3 ? 2 : 1) : (a >= 2 ? 2 : 1);
    return { stock: Math.min(14, stock), hand: Math.min(4, hand + extra) };
  };

  /* Wie oft ein Gegner einen Zug verschenkt – der wichtigste Schwierigkeitsregler. */
  ZU.aiHesitation = function (kind, act) {
    var a = Math.min(act, 3) - 1;
    return kind === 'battle' ? [0.24, 0.16, 0.08][a] : kind === 'elite' ? [0.12, 0.06, 0][a] : [0.05, 0, 0][a];
  };

  function Duel(opts) {
    this.rng = opts.rng;
    this.enemy = ZU.ENEMIES[opts.enemyId];
    this.kind = opts.kind;
    this.act = opts.act;
    this.trinkets = opts.trinkets.concat(opts.perks || []); // Privilegien wirken wie Trinkets
    this.collection = opts.collection;
    this.nextId = opts.nextId;
    this.cards = {};
    this.hand = { player: [], opp: [] };
    this.stocks = { player: [], opp: [] }; // jede Seite zieht von ihrem eigenen Stapel
    this.pile = [];
    this.staging = [];
    this.status = { skip: { player: 0, opp: 0 }, curse: { player: 0, opp: 0 }, spy: 0, blaze: 0, hodl: [] };
    this.used = {};
    this.tableRules = opts.rules || []; // Regeln nur dieses Tisches
    this.houseRules = opts.house || []; // Hausordnung des Casinos
    this.rules = this.tableRules.concat(this.houseRules);
    this.bank = this.has('sparschwein') ? 2 : 0;
    this.bonusMult = 1;
    this.target = opts.target || 0; // Glutziel: Wer es erreicht, fackelt den Tisch ab und gewinnt sofort
    this.grow = opts.grow || {};
    this.douse = opts.douse || []; // Stand des Runs für wachsende Trinkets: burned, bosses, money, trinkets, lastChain
    this.chain = this.chainFloor();
    if (this.has('glutspeicher')) this.chain = Math.max(this.chain, Math.ceil((this.grow.lastChain || 0) / 2));
    if (this.has('bierdeckel') && this.grow.lastLost) this.chain = Math.max(this.chain, 4);
    this.maxChain = this.chain;
    this.glut = this.has('vorglut') ? Math.round(this.target * 0.1) : 0;
    this.active = 'player';
    this.phase = 'setup';
    this.pending = null;
    this.queue = [];
    this.root = null;
    this.retain = false;
    this.noProgress = 0;
    this.triggered = 0;
    this.winner = null;
    this.created = [];
    this.retired = [];
    this.turns = 0;
    this.oppTurns = 0;
    this.mods = opts.mods || {}; // weitere Stellschrauben (Tests)
    this.specialPool = opts.specialPool || null;
    this.turnLimit = (this.enemy.passive === 'last-round' ? 36 : ZU.TURN_LIMIT) - (this.rule('short-night') ? (this.enemy.passive === 'last-round' ? 6 : 14) : 0) +
      (this.has('nachtlaterne') ? 10 : 0);
    this.showdown = false;
    this.afterDraw = null; // nach dem Ziehen: { actor, ids } der Karten, die sofort gelegt werden dürfen
    this.suitRun = { suit: null, n: 0 }; // Farbenlehre: gleiche Symbole in Folge
    this.lifeGain = 0; // Reservefunke
    this.toll = 0; // Makel „Zoll": Mark, die bei der Auszahlung abgehen
    this.wonBy = null; // 'curfew', wenn Sperrstunde oder Kartenvergleich entschieden hat
    // Zählwerke für Auszahlung und Hinterzimmer (was der Spieler in diesem Duell geschafft hat)
    this.stats = { played: 0, drawn: 0, sevens: 0, eights: 0, aces: 0, specials: 0, pairs: 0, pushed: 0, skips: 0, curses: 0, reflects: 0, swaps: 0, sacrificed: 0 };
  }

  Duel.prototype.has = function (id) { return this.trinkets.indexOf(id) >= 0; };
  Duel.prototype.rule = function (id) { return this.rules.indexOf(id) >= 0; };
  Duel.prototype.chainFloor = function () { return this.has('fuse') ? 2 : 1; };
  Duel.prototype.def = function (id) { return ZU.CARDS[this.cards[id].def]; };
  Duel.prototype.top = function () { return this.pile[this.pile.length - 1]; };

  Duel.prototype._register = function (defId, owner, persistent, id, bind) {
    var cid = id != null ? id : this.nextId++;
    this.cards[cid] = {
      id: cid, def: defId, owner: owner, persistent: !!persistent, retired: false,
      bind: ZU.CARDS[defId].special ? (bind || 'wild') : null
    };
    return cid;
  };

  /* ---------- Aufbau ---------- */
  Duel.prototype.start = function () {
    var self = this, ev = [], rng = this.rng;
    var owned = this.collection.map(function (c) {
      var cid = self._register(c.def, 'player', true, c.id, c.bind);
      // Veredelung der Karte: Siegel und Makel wirken nur, wenn der Spieler sie selbst ausspielt.
      if (c.seal) self.cards[cid].seal = c.seal;
      if (c.flaw) self.cards[cid].flaw = c.flaw;
      return cid;
    });
    rng.shuffle(owned);
    if (this.has('gezinktes-blatt')) {
      // Gezinktes Blatt: Spezialkarten wandern nach vorn und damit sicher auf die Starthand.
      owned = owned.filter(function (id) { return self.def(id).special; }).concat(owned.filter(function (id) { return !self.def(id).special; }));
    }
    // Anker-Karten wandern nach vorn (sichere Starthand), Nachzügler nach hinten.
    owned = owned.filter(function (id) { return self.cards[id].seal === 'anker'; })
      .concat(owned.filter(function (id) { return self.cards[id].seal !== 'anker' && self.cards[id].flaw !== 'spaet'; }))
      .concat(owned.filter(function (id) { return self.cards[id].seal !== 'anker' && self.cards[id].flaw === 'spaet'; }));
    var handSize = ZU.HAND_SIZE - (this.has('schmale-hand') ? 1 : 0);
    var opening = owned.slice(0, handSize);
    var rest = owned.slice(handSize);

    // Der Gegner spielt mit einem eigenen Blatt des Hauses: 24 zufällige Karten aus dem 32er-Blatt plus seine Spezialkarten.
    // Das Deck des Spielers bleibt für sich; dieselbe Karte kann also auf beiden Seiten vorkommen.
    var house = rng.shuffle(ZU.STANDARD_IDS.slice());
    house.length = ZU.OPP_DECK;

    var counts = ZU.enemySpecials(this.kind, this.act);
    var stockSpecials = counts.stock + (this.rule('hype') ? 2 : 0);

    var tableIndex = -1;
    for (var i = 0; i < house.length; i++) {
      if (ZU.CARDS[house[i]].effects.length === 0) { tableIndex = i; break; }
    }
    if (tableIndex < 0) tableIndex = 0;
    var tableDef = house.splice(tableIndex, 1)[0];

    var mine = this.stocks.player, theirs = this.stocks.opp;
    house.forEach(function (defId) { theirs.push(self._register(defId, 'house', false)); });
    for (var s = 0; s < stockSpecials; s++) theirs.push(this._register(rng.pick(this.enemy.pool), 'enemy', false, null, ZU.rollBind(rng, this.act)));
    rng.shuffle(theirs);
    rest.forEach(function (id) { mine.push(id); }); // schon gemischt

    var tableId = this._register(tableDef, 'house', false);
    this.pile.push(tableId);
    ev.push({ t: 'table', id: tableId });

    var oppSize = ZU.OPP_HAND + (this.kind === 'battle' ? 1 : 0) + (this.enemy.handBonus || 0) -
      (this.enemy.passive === 'head-start' || this.enemy.passive === 'baroness' || this.enemy.passive === 'house-cut' ? 2 : this.enemy.passive === 'house' ? 1 : 0);
    oppSize = Math.max(4, oppSize + (this.mods.oppHand || 0) - (this.rule('house-edge') ? 1 : 0)) + (this.has('klebefinger') ? 1 : 0);
    if (this.enemy.passive === 'jewels' || this.enemy.passive === 'director' || this.enemy.passive === 'entourage') counts.hand = 3;
    var oppOpening = [];
    for (var h = 0; h < counts.hand && oppOpening.length < oppSize; h++) {
      oppOpening.push(this._register(rng.pick(this.enemy.pool), 'enemy', false, null, ZU.rollBind(rng, this.act)));
    }
    while (oppOpening.length < oppSize && theirs.length) oppOpening.push(theirs.pop());
    if (this.enemy.passive === 'light' && !oppOpening.some(function (id) { return self.def(id).rank === '7'; })) {
      // Feuer gefällig: eine 7 aus dem Stapel gegen eine normale Handkarte tauschen
      var seven = -1, plain = -1;
      theirs.forEach(function (id, index) { if (seven < 0 && self.def(id).rank === '7') seven = index; });
      oppOpening.forEach(function (id, index) { if (plain < 0 && !self.def(id).special) plain = index; });
      if (seven >= 0 && plain >= 0) {
        var swapped = oppOpening[plain];
        oppOpening[plain] = theirs[seven];
        theirs[seven] = swapped;
      }
    }

    var rounds = Math.max(opening.length, oppOpening.length);
    for (var r = 0; r < rounds; r++) {
      if (r < opening.length) {
        this.hand.player.push(opening[r]);
        ev.push({ t: 'move', id: opening[r], from: 'stock', pile: 'player', to: 'player', cause: 'deal' });
      }
      if (r < oppOpening.length) {
        this.hand.opp.push(oppOpening[r]);
        ev.push({ t: 'move', id: oppOpening[r], from: 'stock', pile: 'opp', to: 'opp', cause: 'deal' });
      }
    }

    var opening = { house: 3, prince: 3, venom: 2, baroness: 2, 'evil-eye': 1 }[this.enemy.passive];
    if (opening) {
      this.status.curse.player += opening;
      ev.push({ t: 'passive', id: this.enemy.passive });
      ev.push(this._statusEvent());
    }
    if (this.enemy.passive === 'donna' || this.enemy.passive === 'list' || this.enemy.passive === 'entourage') {
      ev.push({ t: 'passive', id: this.enemy.passive });
      this._drawInto('player', this.enemy.passive === 'donna' ? 2 : 1, 'deal', ev, false);
    }
    if (this.enemy.passive === 'upbeat') {
      this.status.skip.player = 1;
      ev.push({ t: 'passive', id: 'upbeat' });
      ev.push(this._statusEvent());
    }
    var anchored = this.hand.player.filter(function (cid) { return self.cards[cid].seal === 'anker'; });
    if (anchored.length) ev.push({ t: 'seal', seal: 'anker', cards: anchored });
    if (this.rule('marked')) {
      this.status.curse.player += 1;
      ev.push({ t: 'rule', id: 'marked' });
      ev.push(this._statusEvent());
    }
    if (this.has('teufelspakt')) {
      this.status.curse.player += 2;
      ev.push({ t: 'trinket', id: 'teufelspakt' });
      ev.push(this._statusEvent());
    }
    if (this.has('klebefinger')) ev.push({ t: 'trinket', id: 'klebefinger' });
    if (this.has('sparschwein')) {
      ev.push({ t: 'trinket', id: 'sparschwein' });
      ev.push(this._statusEvent());
    }
    if (this.has('short-fuse')) {
      this.status.skip.opp = 1;
      ev.push({ t: 'trinket', id: 'short-fuse' });
      ev.push(this._statusEvent());
    }
    if (this.has('hex-board')) {
      this.status.curse.opp += 2;
      ev.push({ t: 'trinket', id: 'hex-board' });
      ev.push(this._statusEvent());
    }
    if (this.has('black-book')) {
      this.status.spy = 3;
      ev.push({ t: 'trinket', id: 'black-book' });
      ev.push(this._statusEvent());
    }
    if (this.has('ashtray') && mine.length) {
      this.phase = 'decision';
      this.pending = { kind: 'mulligan', actor: 'player', pool: 'hand', options: this.hand.player.slice(), min: 0, max: 1 };
      ev.push({ t: 'trinket', id: 'ashtray' });
      ev.push({ t: 'decision', kind: 'mulligan' });
    } else {
      this._beginTurn('player', ev, 0);
    }
    return ev;
  };

  Duel.prototype._statusEvent = function () {
    return {
      t: 'status',
      status: {
        skip: { player: this.status.skip.player, opp: this.status.skip.opp },
        curse: { player: this.status.curse.player, opp: this.status.curse.opp },
        spy: this.status.spy,
        blaze: this.status.blaze,
        hodl: this.status.hodl.map(function (h) { return { turns: h.turns, amount: h.amount }; }),
        bank: this.bank,
        bonusMult: this.bonusMult
      }
    };
  };

  /* ---------- Spielbarkeit ---------- */
  /* Symbole, auf die eine Karte passt – und die sie vorgibt, wenn sie oben liegt (actor = null). */
  Duel.prototype._suits = function (id, actor) {
    var card = this.cards[id], def = ZU.CARDS[card.def];
    if (def.special) {
      if (actor === 'player') {
        if (this.has('master-key')) return ZU.SUIT_ORDER;
        if (ZU.SUITS[card.bind] && this.has('skeleton-key')) return ZU.bindSuits(ZU.SUITS[card.bind].red ? 'red' : 'black');
      }
      if (actor === 'opp' && this.enemy.passive === 'keys') return ZU.SUIT_ORDER;
      return ZU.bindSuits(card.bind);
    }
    if (def.rank === 'A' && ((actor === 'player' && this.has('ace-sleeve')) || (actor === 'opp' && this.enemy.passive === 'sleeve'))) {
      return ZU.SUIT_ORDER;
    }
    if (def.rank === 'J' && actor === 'player' && this.has('bubenstueck')) return ZU.SUIT_ORDER;
    if (actor === 'player' && card.seal === 'irrlicht') return ZU.SUIT_ORDER;
    return [def.suit];
  };

  /* Darf "id" auf "topId" gelegt werden? Gleicher Wert passt immer, sonst muss ein Symbol übereinstimmen. */
  Duel.prototype._fits = function (id, actor, topId) {
    var def = this.def(id), top = this.def(topId);
    if (!def.special && !top.special && def.rank === top.rank) return true;
    var mine = this._suits(id, actor), theirs = this._suits(topId, null);
    for (var i = 0; i < mine.length; i++) if (theirs.indexOf(mine[i]) >= 0) return true;
    return false;
  };

  Duel.prototype._matches = function (id, actor) {
    return this._fits(id, actor, this.top());
  };

  Duel.prototype.playable = function (actor, id) {
    if (this.afterDraw && (this.afterDraw.actor !== actor || this.afterDraw.ids.indexOf(id) < 0)) return false;
    var def = this.def(id);
    if (def.id === 'opfer' && this.hand[actor].length < 3) return false;
    return this._matches(id, actor);
  };

  /* Prüft eine Auswahl und liefert die Reihenfolge, in der gelegt wird (letzte Karte liegt oben). */
  Duel.prototype.canPlay = function (actor, ids) {
    var self = this;
    if (!ids || !ids.length) return { ok: false, reason: 'Wähle mindestens eine Karte.' };
    var hand = this.hand[actor];
    for (var i = 0; i < ids.length; i++) {
      if (hand.indexOf(ids[i]) < 0 || ids.indexOf(ids[i]) !== i) return { ok: false, reason: 'Ungültige Auswahl.' };
    }
    if (this.afterDraw && (ids.length !== 1 || this.afterDraw.ids.indexOf(ids[0]) < 0)) {
      return { ok: false, reason: 'Jetzt darf nur die gezogene Karte gelegt werden.' };
    }
    if (ids.length === 1) {
      var single = this.def(ids[0]);
      if (single.id === 'opfer' && hand.length < 3) return { ok: false, reason: 'Opfer braucht 2 weitere Handkarten.' };
      if (!this._matches(ids[0], actor)) {
        return { ok: false, reason: single.special ? 'Passt nicht: ' + ZU.bindLabel(this.cards[ids[0]].bind) + '-Karte braucht ihr Symbol.' : 'Passt nicht: gleiches Symbol oder gleicher Wert.' };
      }
      return { ok: true, order: ids.slice() };
    }
    var limit = actor === 'player' ? (this.has('nimble-fingers') ? 99 : 1) : this.enemy.chain;
    if (ids.length > limit) {
      return { ok: false, reason: actor === 'player' ? 'Mehrere Karten auf einmal gehen nur mit „Flinke Finger“.' : 'Zu viele Karten.' };
    }
    var first = this.def(ids[0]);
    for (var k = 0; k < ids.length; k++) {
      var def = this.def(ids[k]);
      if (def.special) return { ok: false, reason: 'Spezialkarten werden einzeln gespielt.' };
      if (def.rank !== first.rank) return { ok: false, reason: 'Eine Kette braucht Karten mit gleichem Wert.' };
    }
    var opener = -1;
    for (var m = 0; m < ids.length; m++) {
      if (self._matches(ids[m], actor)) { opener = m; break; }
    }
    if (opener < 0) return { ok: false, reason: 'Keine der Karten passt auf den Stapel.' };
    var order = ids.slice();
    // Nur umsortieren, wenn die zuerst gewählte Karte nicht anlegen darf.
    if (!self._matches(order[0], actor)) {
      var moved = order.splice(opener, 1)[0];
      order.unshift(moved);
    }
    return { ok: true, order: order };
  };

  Duel.prototype._requireAction = function (actor) {
    if (this.phase !== 'action' || this.pending) throw new Error('Das Duell wartet gerade nicht auf eine Aktion.');
    if (this.active !== actor) throw new Error('Nicht am Zug: ' + actor);
  };

  /* ---------- Aktionen ---------- */
  Duel.prototype.play = function (actor, ids) {
    this._requireAction(actor);
    var check = this.canPlay(actor, ids);
    if (!check.ok) throw new Error(check.reason);
    var ev = [], self = this;
    this.afterDraw = null;
    this.root = actor;
    this.noProgress = 0;
    this.triggered = 0;
    this.phase = 'resolving';
    check.order.forEach(function (id) { self._putOnTable(actor, id, 'hand', ev); });
    var single = check.order.length === 1 && this.def(check.order[0]).special;
    if (actor === 'player' && check.order.length >= 2) {
      this.stats.pairs++;
      if (this.has('kettenbrief')) {
        this._setChain(this.chain + check.order.length - 1);
        ev.push({ t: 'trinket', id: 'kettenbrief' });
        ev.push({ t: 'chain', chain: this.chain });
      }
    }
    if (actor === 'player' && this.has('damenwahl') && check.order.some(function (id) { return self.def(id).rank === 'Q'; })) {
      this.retain = true;
      ev.push({ t: 'trinket', id: 'damenwahl' });
    }
    if (single && actor === 'player' && this.has('hot-wire') && !this.used['hot-wire']) {
      this.used['hot-wire'] = true;
      this.retain = true;
      ev.push({ t: 'trinket', id: 'hot-wire' });
    }
    if (single && actor === 'opp' && this.enemy.passive === 'encore' && !this.used.encore) {
      this.used.encore = true;
      this.retain = true;
      ev.push({ t: 'passive', id: 'encore' });
    }
    if (single && actor === 'player' && this.enemy.passive === 'void-special' && !this.used['void-special']) {
      this.used['void-special'] = true;
      ev.push({ t: 'passive', id: 'void-special' });
      ev.push({ t: 'effect', type: 'fizzle', src: actor, tgt: actor });
    } else {
      this._queueEffects(actor, check.order, false);
      var first = single ? this.def(check.order[0]).effects[0] : null;
      if (single && actor === 'player' && this.has('echo') && !this.used.echo && first && ['clone', 'createSpecial', 'life'].indexOf(first.type) < 0) {
        this.used.echo = true;
        this.queue.push({ type: 'note', trinket: 'echo', src: actor });
        this._queueEffects(actor, check.order, false);
      }
    }
    if (actor === 'opp' && this.enemy.passive === 'finale' && !this.used.finale && this.hand.opp.length > 0 && this.hand.opp.length <= 2) {
      this.used.finale = true;
      this.queue.push({ type: 'passive', id: 'finale', src: actor });
      this.queue.push({ type: 'draw', amount: 2, reflectable: true, src: actor });
    }
    if (actor === 'player' && check.order.length >= 2 && this.has('pair-king')) {
      this.queue.push({ type: 'note', trinket: 'pair-king', src: actor });
      this.queue.push({ type: 'draw', amount: 1, reflectable: true, src: actor });
    }
    this._resolve(ev);
    return ev;
  };

  /* Zieht eine Karte. Passt sie, darf sie sofort gelegt werden (oder man passt); sonst endet der Zug. */
  Duel.prototype.draw = function (actor) {
    this._requireAction(actor);
    if (this.afterDraw) throw new Error('Erst die gezogene Karte legen oder passen.');
    var ev = [], self = this, before = this.hand[actor].length;
    var drawn = this._drawInto(actor, 1, 'draw', ev, true);
    this.noProgress = drawn === 0 ? this.noProgress + 1 : 0;
    var fresh = drawn > 0 && !this.showdown
      ? this.hand[actor].slice(before).filter(function (id) { return self.playable(actor, id); })
      : [];
    if (actor === 'player') {
      if (this.has('lauffeuer')) {
        if (this.chain > this.chainFloor()) ev.push({ t: 'trinket', id: 'lauffeuer' });
      } else if (fresh.length && this.has('card-shark')) {
        ev.push({ t: 'trinket', id: 'card-shark' });
      } else {
        // Ziehen löscht die Kette; passt die gezogene Karte sofort, bleibt die Hälfte stehen.
        var floor = this.chainFloor(), half = Math.max(floor, Math.ceil(this.chain / 2));
        var next = this.has('slow-burner') ? (fresh.length ? this.chain : half) : fresh.length ? half : floor;
        if (next < this.chain && this.has('zweite-luft') && !this.used['zweite-luft']) {
          this.used['zweite-luft'] = true;
          ev.push({ t: 'trinket', id: 'zweite-luft' });
        } else if (next !== this.chain) {
          this.chain = next;
          ev.push({ t: 'chain', chain: this.chain, reset: true });
        }
      }
    }
    if (fresh.length) {
      {
        this.afterDraw = { actor: actor, ids: fresh };
        ev.push({ t: 'drawfit', actor: actor, ids: fresh });
        return ev;
      }
    }
    this._finishTurn(actor, ev);
    return ev;
  };

  /* Nach dem Ziehen: die passende Karte nicht legen, Zug beenden. */
  Duel.prototype.pass = function (actor) {
    this._requireAction(actor);
    if (!this.afterDraw) throw new Error('Passen geht nur nach dem Ziehen.');
    var ev = [];
    this.afterDraw = null;
    this._finishTurn(actor, ev);
    return ev;
  };

  Duel.prototype.decide = function (ids) {
    var d = this.pending, ev = [], self = this;
    if (!d) throw new Error('Keine Entscheidung offen.');
    ids = ids || [];
    if (ids.length < d.min || ids.length > d.max) throw new Error('Falsche Anzahl gewählt.');
    ids.forEach(function (id, index) {
      if (d.options.indexOf(id) < 0 || ids.indexOf(id) !== index) throw new Error('Ungültige Wahl.');
    });
    this.pending = null;
    this.phase = 'resolving';
    if (d.kind === 'mulligan') {
      if (ids.length) {
        this._discardUnder('player', ids[0], 'hand', 'mulligan', ev);
        this._drawInto('player', 1, 'mulligan', ev, false);
      }
      this._beginTurn('player', ev, 0);
    } else if (d.kind === 'sacrifice') {
      this._sacrifice(d.actor, ids, ev);
      this._resolve(ev);
    } else if (d.kind === 'gamble') {
      this._gambleChoose(d.actor, ids[0], ev);
      this._resolve(ev);
    } else if (d.kind === 'clone') {
      this._clone(ids[0], ev);
      this._resolve(ev);
    }
    return ev;
  };

  /* ---------- Kartenbewegung ---------- */
  /* Wem eine Karte gehört: Karten aus dem Deck des Spielers ihm, alle anderen dem Gegner. */
  Duel.prototype._side = function (id) { return this.cards[id].owner === 'player' ? 'player' : 'opp'; };

  /* Nimmt die oberste Karte vom Stapel von "actor". Ist er leer, werden dessen eigene abgelegte Karten neu gemischt. */
  Duel.prototype._take = function (ev, actor) {
    var stock = this.stocks[actor];
    if (!stock.length) {
      if (this.rules.indexOf('one-pass') >= 0) {
        // Letzter Stapel: nichts wird neu gemischt, das Duell endet mit dem Kartenvergleich.
        this.showdown = true;
        return null;
      }
      var top = this.pile[this.pile.length - 1], self = this, back = [];
      this.pile = this.pile.filter(function (id) {
        if (id === top || self._side(id) !== actor) return true;
        if (self.cards[id].retired) self.cards[id].gone = true; else back.push(id);
        return false;
      });
      if (!back.length) return null;
      this.rng.shuffle(back);
      this.stocks[actor] = stock = back;
      ev.push({ t: 'reshuffle', actor: actor, ids: back.slice(), count: back.length });
    }
    return stock.pop();
  };

  Duel.prototype._drawInto = function (actor, amount, cause, ev, applyCurse) {
    if (applyCurse && this.status.curse[actor] > 0) {
      this.status.curse[actor]--;
      amount += actor === 'opp' && this.has('voodoo') ? 2 : 1;
      ev.push({ t: 'curse', target: actor, left: this.status.curse[actor] });
      if (actor === 'opp') {
        this.stats.curses++;
        if (this.has('fluchmuenze')) { this.bank += 1; ev.push({ t: 'trinket', id: 'fluchmuenze' }); }
      }
      ev.push(this._statusEvent());
    }
    var drawn = 0;
    for (var i = 0; i < amount; i++) {
      var id = this._take(ev, actor);
      if (id == null) break;
      this.hand[actor].push(id);
      ev.push({ t: 'move', id: id, from: 'stock', pile: actor, to: actor, cause: cause });
      drawn++;
    }
    if (actor === 'player') this.stats.drawn += drawn;
    return drawn;
  };

  /* Setzt die Kette; „Feuchte Luft" deckelt sie bei ×8. */
  Duel.prototype._setChain = function (value) {
    this.chain = this.rule('damp') ? Math.min(8, value) : value;
    if (this.chain > this.maxChain) this.maxChain = this.chain;
  };

  Duel.prototype._discardUnder = function (actor, id, from, cause, ev) {
    var list = from === 'hand' ? this.hand[actor] : this.staging;
    var index = list.indexOf(id);
    if (index < 0) throw new Error('Karte nicht in ' + from);
    list.splice(index, 1);
    this.pile.unshift(id);
    ev.push({ t: 'move', id: id, from: from === 'hand' ? actor : 'staging', to: 'discard', cause: cause });
  };

  Duel.prototype._putOnTable = function (actor, id, from, ev) {
    var list = from === 'hand' ? this.hand[actor] : this.staging;
    list.splice(list.indexOf(id), 1);
    this.pile.push(id);
    var below = this.pile.length > 1 ? this.def(this.pile[this.pile.length - 2]) : null; // was vorher oben lag
    var def = this.def(id), event = { t: 'play', id: id, actor: actor, from: from === 'hand' ? actor : 'staging' };
    if (actor === 'player') {
      var face = def.rank === 'J' || def.rank === 'Q' || def.rank === 'K', low = def.rank === '7' || def.rank === '8' || def.rank === '9';
      var mark = this.cards[id], seal = mark.seal, flaw = mark.flaw;
      var base = def.base + (low && this.has('kleinvieh') ? 6 : 0) + (face && this.has('hofstaat') ? 5 : 0) +
        (this.has('zunder') ? 4 : 0) + (def.special && this.has('tintenfass') ? 15 : 0) +
        (def.suit === 'clubs' && this.has('kreuzfeuer') ? 8 : 0) + (def.rank === 'J' && this.has('bauernopfer') ? 10 : 0) +
        (def.suit && ZU.SUITS[def.suit].red && this.has('rotlicht') ? 3 : 0) + (this.chain >= 4 && this.has('feuerzeug') ? 6 : 0);
      if (flaw === 'matt') base = Math.max(1, base - 4);
      // Kettenreaktion: Jenseits von ×10 zählt jede Stufe doppelt.
      var effChain = this.chain + (this.has('kettenreaktion') ? Math.max(0, this.chain - 10) : 0);
      var points = base * effChain, doubled = false, trig = [];
      if (effChain > this.chain) trig.push('kettenreaktion'); // trig: Trinkets, die bei dieser Karte gezündet haben (für die Anzeige)
      if (def.suit === 'clubs' && this.has('kreuzfeuer')) trig.push('kreuzfeuer');
      if (def.rank === 'J' && this.has('bauernopfer')) trig.push('bauernopfer');
      if (this.chain >= 4 && this.has('feuerzeug')) trig.push('feuerzeug');
      if (def.rank === '10' && this.has('volle-zehn')) { points *= 2; doubled = true; trig.push('volle-zehn'); }
      if (this.stats.played < 3 && this.has('erster-funke')) { points *= 2; doubled = true; trig.push('erster-funke'); }
      if (this.stats.played % 3 === 2 && this.has('vollmond')) { points *= 2; doubled = true; trig.push('vollmond'); }
      if (this.hand.player.length >= 6 && this.has('volles-haus')) { points = Math.round(points * 1.5); trig.push('volles-haus'); }
      if ((this.grow.money || 0) <= 5 && this.has('leere-taschen')) { points = Math.round(points * 1.6); trig.push('leere-taschen'); }
      if (below && below.suit && def.suit && below.suit !== def.suit && this.has('farbwechsel')) { points *= 2; doubled = true; trig.push('farbwechsel'); }
      if (def.special && this.has('heisse-ware')) { points *= 2; doubled = true; trig.push('heisse-ware'); }
      if (this.hand.player.length <= 1 && this.has('endspurt')) { points *= 3; doubled = true; trig.push('endspurt'); }
      if (this.has('gluecksrad') && this.rng.next() < 0.15) { points *= 3; doubled = true; trig.push('gluecksrad'); }
      if (low && this.has('kleinvieh')) trig.push('kleinvieh');
      if (face && this.has('hofstaat')) trig.push('hofstaat');
      if (def.special && this.has('tintenfass')) trig.push('tintenfass');
      if (def.suit === 'hearts' && this.has('heartblood')) { points *= 2; doubled = true; trig.push('heartblood'); }
      if (def.suit === 'diamonds' && this.has('karoglanz')) { points *= 2; doubled = true; trig.push('karoglanz'); }
      if ((def.suit === 'spades' || def.suit === 'clubs') && this.has('black-series')) { points = Math.round(points * 1.5); trig.push('black-series'); }
      if (def.rank === 'A' && this.has('trumpf-ass')) { points *= 3; doubled = true; trig.push('trumpf-ass'); }
      if (below && !def.special && !below.special && below.rank === def.rank && this.has('zwillinge')) { points *= 2; doubled = true; trig.push('zwillinge'); }
      if (this.chain >= 6 && this.has('dampfkessel')) { points *= 2; doubled = true; trig.push('dampfkessel'); }
      if (!this.hand.player.length && this.has('letzte-glut')) { points *= 5; doubled = true; trig.push('letzte-glut'); }
      if (this.status.blaze > 0) { this.status.blaze--; points *= 2; doubled = true; }
      if (this.has('teufelspakt')) { points *= 2; doubled = true; }
      if (seal === 'glut') { points *= 2; doubled = true; }
      // Wachsende Trinkets: Ihre Prozente addieren sich und wachsen mit dem Run bzw. dem Duell.
      var grow = this.grow, pct = 0;
      if (this.has('brandstifter') && grow.burned) { pct += 0.10 * grow.burned; trig.push('brandstifter'); }
      if (this.has('trophaeenschrank') && grow.bosses) { pct += 0.25 * grow.bosses; trig.push('trophaeenschrank'); }
      if (this.has('schneeball') && this.stats.played) { pct += 0.02 * this.stats.played; trig.push('schneeball'); }
      if (this.has('wucherer') && grow.money) { pct += Math.min(3, 0.01 * grow.money); trig.push('wucherer'); }
      if (this.has('sippschaft') && grow.trinkets) { pct += 0.08 * grow.trinkets; trig.push('sippschaft'); }
      if (this.has('glutnest') && grow.deck > 16) { pct += 0.05 * (grow.deck - 16); trig.push('glutnest'); }
      if (this.has('minimalist') && grow.deck < 16) { pct += 0.12 * (16 - grow.deck); trig.push('minimalist'); }
      if (this.has('siegelring') && grow.sealed) { pct += 0.15 * grow.sealed; trig.push('siegelring'); }
      if (this.has('aktienpaket') && grow.act > 1) { pct += 0.20 * (grow.act - 1); trig.push('aktienpaket'); }
      if (this.has('serientaeter') && grow.wins) { pct += 0.06 * grow.wins; trig.push('serientaeter'); }
      if (this.has('gluecksstraehne') && grow.streak) { pct += 0.10 * grow.streak; trig.push('gluecksstraehne'); }
      if (pct > 0) points = Math.round(points * (1 + pct));
      this.glut += points;
      event.score = { base: base, chain: this.chain, points: points, glut: this.glut, doubled: doubled };
      var step = this.has('afterburner') ? 2 : 1;
      if (def.special && this.has('blasebalg')) { step += 2; trig.push('blasebalg'); }
      if (seal === 'zuend') step += 1;
      if (below && def.suit && below.suit && ZU.SUITS[def.suit].red && ZU.SUITS[below.suit].red && this.has('roter-teppich')) { step += 1; trig.push('roter-teppich'); }
      if (def.suit === 'spades' && this.has('schwarzer-peter')) { step += 1; trig.push('schwarzer-peter'); }
      if (def.rank === 'K' && this.has('koenigsmacher')) { step += 2; trig.push('koenigsmacher'); }
      if (def.rank === '7' && this.has('siebenmeilen')) { step += 3; trig.push('siebenmeilen'); }
      if (below && !def.special && !below.special && Math.abs(ZU.RANKS[def.rank].order - ZU.RANKS[below.rank].order) === 1 && this.has('strasse')) { step += 2; trig.push('strasse'); }
      if (flaw === 'stumpf') step = 0;
      this._setChain(this.chain + step);
      event.score.next = this.chain;
      if (seal) event.seal = seal;
      if (flaw) event.flaw = flaw;
      if (trig.length) event.trig = trig;
      this.stats.played++;
      if (def.special) this.stats.specials++;
      else if (def.rank === '7') this.stats.sevens++;
      else if (def.rank === '8') this.stats.eights++;
      else if (def.rank === 'A') this.stats.aces++;
    }
    ev.push(event);
    if (actor === 'opp' && !def.special) {
      // Löschmittel: Die 8 und das Ass des Gegners drücken die Kette des Spielers.
      var low = this.chainFloor(), cooled = this.chain;
      if (def.rank === '8' && this.douses('sand')) cooled = Math.max(low, this.chain - 2);
      if (def.rank === 'A' && this.douses('water')) cooled = Math.max(low, Math.ceil(this.chain / 2));
      if (cooled < this.chain) {
        if (this.has('oelfass')) ev.push({ t: 'trinket', id: 'oelfass' });
        else {
          this.chain = cooled;
          ev.push({ t: 'douse', id: def.rank === '8' ? 'sand' : 'water', chain: this.chain, glut: this.glut });
          this._fettbrand(ev);
        }
      }
    }
    if (actor === 'player') {
      // Siegel und Makel melden sich in der Reihenfolge, in der sie wirken: erst die Glut, dann Kasse, dann Folgen.
      var worn = this.cards[id];
      if (worn.seal === 'irrlicht' || worn.seal === 'glut' || worn.seal === 'zuend') ev.push({ t: 'seal', seal: worn.seal, card: id });
      if (worn.flaw === 'matt' || worn.flaw === 'stumpf') ev.push({ t: 'flaw', flaw: worn.flaw, card: id });
      if (worn.seal === 'gold') { this.bank += 1; ev.push({ t: 'seal', seal: 'gold', card: id }); ev.push(this._statusEvent()); }
      if (worn.flaw === 'zoll') { this.toll++; ev.push({ t: 'flaw', flaw: 'zoll', card: id }); }
      if (worn.seal === 'haken') {
        this.queue.push({ type: 'sealnote', seal: 'haken', card: id, src: actor });
        this.queue.push({ type: 'draw', amount: 1, reflectable: true, src: actor });
      }
      if (worn.flaw === 'klette') {
        this.queue.push({ type: 'flawnote', flaw: 'klette', card: id, src: actor });
        this.queue.push({ type: 'selfdraw', amount: 1, src: actor });
      }
      if (worn.seal === 'bumerang' && !this.used['boom' + id] && from === 'hand' && this.hand.player.length > 0) {
        // Bumerang: Die Karte bleibt liegen, eine Zwillingskarte für dieses Duell kehrt auf die Hand zurück.
        this.used['boom' + id] = true;
        var twin = this._register(def.id, 'player', false);
        this.hand.player.push(twin);
        ev.push({ t: 'seal', seal: 'bumerang', card: id });
        ev.push({ t: 'boomerang', id: twin, from: id });
      }
      if (this.has('perpetuum') && this.stats.played % 5 === 0) this.queue.push({ type: 'bonusdraw', src: actor });
      if (this.has('midas-hand') && (this.used.midas || 0) < 10) {
        this.used.midas = (this.used.midas || 0) + 1;
        this.bank += 1;
        ev.push({ t: 'trinket', id: 'midas-hand' });
        ev.push(this._statusEvent());
      }
      if (def.rank === 'K' && this.has('loesegeld') && (this.used.ransom || 0) < 6) {
        this.used.ransom = (this.used.ransom || 0) + 2;
        this.bank += 2;
        ev.push({ t: 'trinket', id: 'loesegeld' });
        ev.push(this._statusEvent());
      }
      if (this.has('farbenlehre') && def.suit) {
        this.suitRun = this.suitRun.suit === def.suit ? { suit: def.suit, n: this.suitRun.n + 1 } : { suit: def.suit, n: 1 };
        if (this.suitRun.n >= 3) {
          this.suitRun.n = 0;
          this.queue.push({ type: 'note', trinket: 'farbenlehre', src: actor });
          this.queue.push({ type: 'draw', amount: 1, reflectable: true, src: actor });
        }
      } else if (def.special) {
        this.suitRun = { suit: null, n: 0 };
      }
    }
    if (actor === 'player' && def.suit === 'diamonds' && this.has('diamond-cut') && (this.used.diamonds || 0) < 5) {
      this.used.diamonds = (this.used.diamonds || 0) + 1;
      this.bank += 1;
      ev.push({ t: 'trinket', id: 'diamond-cut' });
      ev.push(this._statusEvent());
    }
  };

  /* ---------- Effekte ---------- */
  Duel.prototype._queueEffects = function (actor, ids, front) {
    var self = this, draw = 0, skip = false, rest = [];
    ids.forEach(function (id) {
      var def = self.def(id);
      def.effects.forEach(function (effect) {
        if (effect.type === 'draw' && actor === 'opp' && def.rank === '7' && self.has('asbesthandschuh')) rest.push({ type: 'note', trinket: 'asbesthandschuh', src: actor });
        else if (effect.type === 'draw') draw += effect.amount + (actor === 'opp' && def.rank === '7' && self.enemy.passive === 'heavy-hand' ? 1 : 0) +
            (actor === 'player' && def.rank === '7' && self.has('seven-sleeper') ? 1 : 0) + (def.rank === '7' && self.rule('sharp-sevens') ? 1 : 0);
        else if (effect.type === 'skip') skip = true;
        else rest.push({ type: effect.type, amount: effect.amount || 0, duration: effect.duration || 0, reflectable: !!effect.reflectable, src: actor, card: id });
      });
      if (actor === 'player' && def.rank === '9' && self.has('neunmalklug')) {
        if (!draw) rest.unshift({ type: 'note', trinket: 'neunmalklug', src: actor });
        draw += 1;
      }
      if (actor === 'player' && def.rank === '8' && self.has('rollercoaster')) {
        if (!skip) rest.unshift({ type: 'note', trinket: 'rollercoaster', src: actor });
        skip = true;
      }
    });
    var items = [];
    if (draw) items.push({ type: 'draw', amount: draw, reflectable: true, src: actor });
    if (skip) items.push({ type: 'skip', reflectable: true, src: actor });
    items = items.concat(rest);
    this.queue = front ? items.concat(this.queue) : this.queue.concat(items);
  };

  Duel.prototype._resolve = function (ev) {
    var guard = 0;
    while (!this.pending && this.queue.length) {
      if (++guard > 64) throw new Error('Effektschleife.');
      this._effect(this.queue.shift(), ev);
    }
    if (this.pending) {
      this.phase = 'decision';
      ev.push({ t: 'decision', kind: this.pending.kind });
      return;
    }
    this._complete(ev);
  };

  Duel.prototype._effect = function (item, ev) {
    var src = item.src, tgt = other(src), self = this;
    if (item.type === 'note') { ev.push({ t: 'trinket', id: item.trinket }); return; }
    if (item.type === 'passive') { ev.push({ t: 'passive', id: item.id }); return; }
    if (item.type === 'sealnote') { ev.push({ t: 'seal', seal: item.seal, card: item.card }); return; }
    if (item.type === 'flawnote') { ev.push({ t: 'flaw', flaw: item.flaw, card: item.card }); return; }
    if (item.reflectable) {
      if (src === 'player' && this.enemy.passive === 'smoke' && !this.used.smoke) {
        this.used.smoke = true;
        ev.push({ t: 'passive', id: 'smoke' });
        ev.push({ t: 'reflect', onto: 'player', effect: item.type });
        src = 'opp'; tgt = 'player';
      } else if (tgt === 'player' && this.has('smoke-mirror') && !this.used['smoke-mirror']) {
        this.used['smoke-mirror'] = true;
        this.stats.reflects++;
        ev.push({ t: 'trinket', id: 'smoke-mirror' });
        ev.push({ t: 'reflect', onto: 'opp', effect: item.type });
        src = 'player'; tgt = 'opp';
      }
    }
    switch (item.type) {
      case 'draw': {
        var amount = item.amount;
        if (src === 'opp' && this.enemy.passive === 'amplify' && !this.used.amplify) {
          this.used.amplify = true;
          amount += 2;
          ev.push({ t: 'passive', id: 'amplify' });
        }
        if (src === 'player' && tgt === 'opp' && this.enemy.passive === 'armored' && (this.used.armored || 0) < 2) {
          this.used.armored = (this.used.armored || 0) + 1;
          ev.push({ t: 'passive', id: 'armored' });
          ev.push({ t: 'effect', type: 'skip-blocked', src: src, tgt: tgt });
          break;
        }
        if (src === 'player' && this.has('brass-knuckles') && !this.used['brass-knuckles']) {
          this.used['brass-knuckles'] = true;
          amount += 1;
          ev.push({ t: 'trinket', id: 'brass-knuckles' });
        }
        if (src === 'player' && this.has('daumenschraube')) {
          amount += 1;
          ev.push({ t: 'trinket', id: 'daumenschraube' });
        }
        if (tgt === 'player' && amount > 1 && this.has('regenschirm')) {
          amount -= 1;
          ev.push({ t: 'trinket', id: 'regenschirm' });
        }
        ev.push({ t: 'effect', type: 'draw', src: src, tgt: tgt, amount: amount });
        var got = this._drawInto(tgt, amount, 'effect', ev, true);
        if (tgt === 'opp') this.stats.pushed += got;
        break;
      }
      case 'equalize': {
        // Ausgleich: wird zu einem gewöhnlichen Zieheffekt in passender Höhe
        var gap = Math.min(item.amount, this.hand[src].length - this.hand[tgt].length);
        if (gap > 0) this.queue.unshift({ type: 'draw', amount: gap, reflectable: false, src: src });
        else ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        break;
      }
      case 'redeal': {
        var held = this.hand[tgt].slice();
        if (!held.length) { ev.push({ t: 'effect', type: 'idle', src: src, tgt: src }); break; }
        ev.push({ t: 'effect', type: 'redeal', src: src, tgt: tgt, amount: held.length + 1 });
        held.forEach(function (cid) { self._discardUnder(tgt, cid, 'hand', 'redeal', ev); });
        var dealt = this._drawInto(tgt, held.length + 1, 'effect', ev, false);
        if (tgt === 'opp') this.stats.pushed += Math.max(0, dealt - held.length);
        break;
      }
      case 'selfdraw':
        ev.push({ t: 'effect', type: 'draw', src: other(item.src), tgt: item.src, amount: item.amount });
        this._drawInto(item.src, item.amount, 'effect', ev, false);
        break;
      case 'bonusdraw':
        // Perpetuum: eine Karte nachziehen, ohne dass die Kette abreißt
        ev.push({ t: 'trinket', id: 'perpetuum' });
        this._drawInto(item.src, 1, 'effect', ev, false);
        break;
      case 'again':
        this.retain = true;
        ev.push({ t: 'effect', type: 'again', src: src, tgt: src });
        break;
      case 'stoke':
      case 'double':
        if (src === 'player') {
          this._setChain(item.type === 'double' ? this.chain * 2 : this.chain + item.amount);
          ev.push({ t: 'effect', type: 'stoke', src: src, tgt: src, amount: this.chain });
          ev.push({ t: 'chain', chain: this.chain });
        } else {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        }
        break;
      case 'blaze':
        if (src === 'player') {
          this.status.blaze += item.amount;
          ev.push({ t: 'effect', type: 'blaze', src: src, tgt: src, amount: item.amount });
          ev.push(this._statusEvent());
        } else {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        }
        break;
      case 'bank':
        if (src === 'player') {
          this.bank += item.amount;
          ev.push({ t: 'effect', type: 'bank', src: src, tgt: src, amount: item.amount });
          ev.push(this._statusEvent());
        } else {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        }
        break;
      case 'cleanse':
        this.status.curse[src] = 0;
        this.status.skip[src] = 0;
        ev.push({ t: 'effect', type: 'cleanse', src: src, tgt: src });
        ev.push(this._statusEvent());
        break;
      case 'life':
        if (src === 'player' && !this.lifeGain) {
          this._retire(item.card);
          this.lifeGain = 1;
          ev.push({ t: 'effect', type: 'life', src: src, tgt: src });
        } else {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        }
        break;
      case 'skip':
        if (tgt === 'player' && this.has('pocket-watch') && !this.used['pocket-watch']) {
          this.used['pocket-watch'] = true;
          ev.push({ t: 'trinket', id: 'pocket-watch' });
          ev.push({ t: 'effect', type: 'skip-blocked', src: src, tgt: tgt });
        } else if (tgt === 'opp' && (this.enemy.passive === 'thick-skin' || this.enemy.passive === 'prince') && !this.used['thick-skin']) {
          this.used['thick-skin'] = true;
          ev.push({ t: 'passive', id: 'thick-skin' });
          ev.push({ t: 'effect', type: 'skip-blocked', src: src, tgt: tgt });
        } else {
          var rounds = 1;
          if (tgt === 'opp' && this.has('doppelschloss') && !this.used.doppelschloss) {
            this.used.doppelschloss = true;
            rounds = 2;
            ev.push({ t: 'trinket', id: 'doppelschloss' });
          }
          this.status.skip[tgt] = Math.max(this.status.skip[tgt], rounds);
          ev.push({ t: 'effect', type: 'skip', src: src, tgt: tgt });
          ev.push(this._statusEvent());
        }
        break;
      case 'spy':
        if (src === 'player') {
          var spyFor = item.duration + (this.has('opernglas') ? 3 : 0);
          this.status.spy = Math.max(this.status.spy, spyFor);
          ev.push({ t: 'effect', type: 'spy', src: src, tgt: tgt, amount: spyFor });
          ev.push(this._statusEvent());
        } else {
          ev.push({ t: 'effect', type: 'spy-idle', src: src, tgt: tgt });
        }
        break;
      case 'curse': {
        var curseBy = item.amount;
        if (tgt === 'player' && this.has('pestmaske')) {
          curseBy = Math.ceil(curseBy / 2);
          ev.push({ t: 'trinket', id: 'pestmaske' });
        }
        this.status.curse[tgt] += curseBy;
        ev.push({ t: 'effect', type: 'curse', src: src, tgt: tgt, amount: curseBy });
        ev.push(this._statusEvent());
        break;
      }
      case 'hodl':
        if (src === 'player') {
          this.status.hodl.push({ turns: item.duration, amount: item.amount });
          ev.push({ t: 'effect', type: 'hodl', src: src, tgt: src, amount: item.amount });
          ev.push(this._statusEvent());
        } else {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        }
        break;
      case 'bonus':
        if (src === 'player') {
          this.bonusMult *= 2;
          ev.push({ t: 'effect', type: 'bonus', src: src, tgt: src, amount: this.bonusMult });
          ev.push(this._statusEvent());
        } else {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        }
        break;
      case 'swap':
        if (!this.hand[src].length) {
          ev.push({ t: 'effect', type: 'swap-fizzle', src: src, tgt: tgt });
        } else {
          var tmp = this.hand.player;
          this.hand.player = this.hand.opp;
          this.hand.opp = tmp;
          if (src === 'player') this.stats.swaps++;
          ev.push({ t: 'swap', src: src });
        }
        break;
      case 'clone':
        if (src === 'player' && this.hand.player.length) {
          this._retire(item.card);
          this.pending = { kind: 'clone', actor: 'player', pool: 'hand', options: this.hand.player.slice(), min: 1, max: 1, card: item.card };
        } else {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        }
        break;
      case 'createSpecial':
        if (src === 'player') {
          this._retire(item.card);
          var pool = (this.specialPool || ZU.SPECIAL_IDS).filter(function (id) { return id !== 'zytokinese_2'; });
          if (!pool.length) pool = ['stillstand'];
          var defs = [], binds = [];
          for (var i = 0; i < item.amount; i++) {
            defs.push(this.rng.pick(pool));
            binds.push(ZU.rollBind(this.rng, this.act));
          }
          defs.forEach(function (d, index) { self.created.push({ def: d, bind: binds[index] }); });
          ev.push({ t: 'created', defs: defs, binds: binds, via: 'zytokinese_2' });
        } else {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        }
        break;
      case 'sacrifice': {
        var need = Math.min(item.amount, this.hand[src].length);
        if (need === 0) {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        } else if (src === 'opp') {
          var sorted = this.hand.opp.slice().sort(function (a, b) { return self._aiValue(a) - self._aiValue(b); });
          this._sacrifice('opp', sorted.slice(0, need), ev);
        } else {
          this.pending = { kind: 'sacrifice', actor: 'player', pool: 'hand', options: this.hand.player.slice(), min: need, max: need };
        }
        break;
      }
      case 'gamble': {
        var reveal = item.amount + (src === 'player' && this.has('loaded-die') ? 2 : 0);
        if (src === 'player' && this.has('loaded-die')) ev.push({ t: 'trinket', id: 'loaded-die' });
        for (var g = 0; g < reveal; g++) {
          var id = this._take(ev, src);
          if (id == null) break;
          this.staging.push(id);
          ev.push({ t: 'move', id: id, from: 'stock', pile: src, to: 'staging', cause: 'gamble', actor: src });
        }
        var options = this.staging.filter(function (cid) {
          var def = self.def(cid);
          if (def.id === 'zocken') return false;
          if (def.id === 'opfer' && self.hand[src].length < 2) return false;
          return true;
        });
        if (!options.length || this.triggered >= 6) {
          this.staging.slice().forEach(function (cid) { self._discardUnder(src, cid, 'staging', 'gamble', ev); });
          ev.push({ t: 'effect', type: 'gamble-empty', src: src, tgt: src });
        } else if (src === 'opp') {
          options.sort(function (a, b) { return self._aiValue(b) - self._aiValue(a); });
          this._gambleChoose('opp', options[0], ev);
        } else {
          this.pending = { kind: 'gamble', actor: 'player', pool: 'staging', options: options, min: 1, max: 1 };
        }
        break;
      }
      default:
        throw new Error('Unbekannter Effekt: ' + item.type);
    }
  };

  Duel.prototype._retire = function (id) {
    var card = this.cards[id];
    if (card && !card.retired) { card.retired = true; this.retired.push(id); }
  };

  Duel.prototype._sacrifice = function (actor, ids, ev) {
    var self = this;
    ids.forEach(function (id) { self._discardUnder(actor, id, 'hand', 'sacrifice', ev); });
    if (actor === 'player') {
      this.stats.sacrificed += ids.length;
      var gain = 5;
      if (this.has('velvet-glove')) { gain += 3; ev.push({ t: 'trinket', id: 'velvet-glove' }); }
      this.bank += gain;
      ev.push({ t: 'effect', type: 'sacrifice', src: actor, tgt: actor, amount: gain });
      ev.push(this._statusEvent());
    } else {
      ev.push({ t: 'effect', type: 'sacrifice', src: actor, tgt: actor, amount: 0 });
    }
  };

  Duel.prototype._gambleChoose = function (actor, id, ev) {
    var self = this;
    this.staging.slice().forEach(function (cid) {
      if (cid !== id) self._discardUnder(actor, cid, 'staging', 'gamble', ev);
    });
    this.triggered++;
    this._putOnTable(actor, id, 'staging', ev);
    this._queueEffects(actor, [id], true);
  };

  Duel.prototype._clone = function (id, ev) {
    var defId = this.cards[id].def, bind = this.cards[id].bind;
    this.created.push({ def: defId, bind: bind });
    ev.push({ t: 'created', defs: [defId], binds: [bind], via: 'zytokinese', source: id });
  };

  /* Fettbrand: Was löschen soll, facht nach. Kann das Glutziel nicht selbst erreichen – das prüft der nächste Zug. */
  Duel.prototype._fettbrand = function (ev) {
    if (!this.has('fettbrand')) return;
    this.glut += Math.round(this.target * 0.08);
    ev.push({ t: 'trinket', id: 'fettbrand' });
    ev.push({ t: 'glut', glut: this.glut });
  };
  Duel.prototype.douses = function (id) { return this.target > 0 && this.douse.indexOf(id) >= 0; };

  /* ---------- Zugfolge ---------- */
  Duel.prototype._complete = function (ev) {
    var root = this.root;
    if (this.target && this.glut >= this.target) {
      // Glutziel erreicht: Der Tisch brennt, egal wie viele Karten noch auf der Hand sind.
      ev.push({ t: 'burnt', glut: this.glut, target: this.target });
      this.wonBy = 'glut';
      return this._end('player', ev);
    }
    if (this.douses('blanket') && !this.used.blanket && this.glut * 2 >= this.target) {
      this.used.blanket = true;
      if (this.has('feuerdecke')) ev.push({ t: 'trinket', id: 'feuerdecke' });
      else {
        this.glut -= Math.round(this.glut / 4);
        this.chain = this.chainFloor();
        ev.push({ t: 'douse', id: 'blanket', chain: this.chain, glut: this.glut });
        this._fettbrand(ev);
      }
    }
    if (!this.hand[root].length) return this._end(root, ev);
    if (!this.hand[other(root)].length) return this._end(other(root), ev);
    if (this.showdown) return this._showdown(ev);
    this.root = null;
    if (this.retain) {
      this.retain = false;
      this.active = root;
      this.phase = 'action';
      ev.push({ t: 'turn', actor: root, extra: true, left: this.turnLimit - this.turns + 1 });
    } else {
      this._finishTurn(root, ev);
    }
  };

  /* Wer hält weniger Karten? Gleichstand geht ans Haus – außer mit Kellerschlüssel. */
  Duel.prototype._fewer = function () {
    var p = this.hand.player.length, o = this.hand.opp.length;
    return p < o || (p === o && this.has('cellar-key')) ? 'player' : 'opp';
  };

  /* Letzter Stapel aufgebraucht: Wer weniger Karten hält, gewinnt. Gleichstand geht ans Haus. */
  Duel.prototype._showdown = function (ev) {
    ev.push({ t: 'showdown' });
    this.wonBy = 'curfew';
    return this._end(this._fewer(), ev);
  };

  Duel.prototype._finishTurn = function (actor, ev) {
    if (this.showdown) return this._showdown(ev);
    if (this.noProgress >= 2) {
      ev.push({ t: 'stalemate' });
      return this._end(this._fewer(), ev);
    }
    this._beginTurn(other(actor), ev, 0);
  };

  Duel.prototype._beginTurn = function (actor, ev, guard) {
    if (this.status.skip[actor] > 0 && guard < 3) {
      this.status.skip[actor]--;
      ev.push({ t: 'skipped', actor: actor });
      if (actor === 'opp') {
        this.stats.skips++;
        if (this.has('schadenfreude')) {
          this._setChain(this.chain + 1);
          ev.push({ t: 'trinket', id: 'schadenfreude' });
          ev.push({ t: 'chain', chain: this.chain });
        }
        if (this.has('stopwatch')) {
          this.bank += 1;
          ev.push({ t: 'trinket', id: 'stopwatch' });
        }
        if (this.has('sandmann')) {
          ev.push({ t: 'trinket', id: 'sandmann' });
          this.stats.pushed += this._drawInto('opp', 1, 'effect', ev, true);
        }
      }
      ev.push(this._statusEvent());
      return this._beginTurn(other(actor), ev, guard + 1);
    }
    if (this.turns >= this.turnLimit) {
      // Sperrstunde: Wer weniger Karten hält, gewinnt. Gleichstand geht ans Haus.
      ev.push({ t: 'curfew' });
      this.wonBy = 'curfew';
      return this._end(this._fewer(), ev);
    }
    this.active = actor;
    this.phase = 'action';
    this.turns++;
    if (actor === 'opp') {
      this.oppTurns++;
      if (this.douses('sprinkler') && this.oppTurns % 4 === 0 && this.glut > 0) {
        if (this.has('feuerdecke')) ev.push({ t: 'trinket', id: 'feuerdecke' });
        else {
          this.glut = Math.max(0, this.glut - Math.round(this.target * 0.05));
          ev.push({ t: 'douse', id: 'sprinkler', chain: this.chain, glut: this.glut });
          this._fettbrand(ev);
        }
      }
      if (this.enemy.passive === 'storm' && this.oppTurns % 5 === 0) {
        ev.push({ t: 'passive', id: 'storm' });
        this._drawInto('player', 1, 'effect', ev, true);
      }
    }
    if (actor === 'player') {
      var changed = false, self = this;
      if (this.status.spy > 0) { this.status.spy--; changed = true; }
      this.status.hodl = this.status.hodl.filter(function (h) {
        h.turns--;
        changed = true;
        if (h.turns > 0) return true;
        self.bank += h.amount;
        ev.push({ t: 'effect', type: 'hodl-pay', src: 'player', tgt: 'player', amount: h.amount });
        return false;
      });
      if (changed) ev.push(this._statusEvent());
    }
    ev.push({ t: 'turn', actor: actor, left: this.turnLimit - this.turns + 1 });
  };

  Duel.prototype._end = function (winner, ev) {
    this.winner = winner;
    this.phase = 'ended';
    this.afterDraw = null;
    this.pending = null;
    this.queue = [];
    ev.push({ t: 'end', winner: winner });
  };

  /* ---------- Gegner-KI ---------- */
  Duel.prototype._aiValue = function (id) {
    var def = this.def(id), ai = this.enemy.ai;
    var mine = this.hand.opp.length, theirs = this.hand.player.length;
    var value = def.base;
    if (!def.special) {
      if (def.rank === '7') value += 30 + (theirs <= 3 ? 40 : 0) + (ai === 'pressure' ? 20 : 0);
      return value;
    }
    switch (def.id) {
      case 'stillstand': value += 55 + (theirs <= 2 ? 50 : 0); break;
      case 'addieren': value += 60 + (theirs <= 3 ? 60 : 0) + (ai === 'pressure' ? 30 : 0); break;
      case 'fluch': value += 50 + (ai === 'pressure' ? 40 : 0); break;
      case 'opfer': value += 110; break;
      case 'nachschlag': value += 70; break;
      case 'nebelkerze': value += 75 + (theirs <= 3 ? 60 : 0); break;
      case 'brandsatz': value += 90 + (theirs <= 3 ? 70 : 0) + (ai === 'pressure' ? 30 : 0); break;
      case 'inferno': value += 110 + (theirs <= 3 ? 70 : 0); break;
      case 'ausgleich': value += mine - 1 > theirs ? 60 + (mine - 1 - theirs) * 25 : 5; break;
      case 'mischmasch': value += theirs <= 3 ? 100 + (4 - theirs) * 30 : 5; break;
      case 'bannbrecher': value += this.status.curse.opp || this.status.skip.opp ? 60 : 8; break;
      case 'zocken': value += 45 + (ai === 'gamble' ? 40 : 0); break;
      case 'tausch': {
        var diff = (mine - 1) - theirs;
        var need = ai === 'gamble' ? 1 : 2;
        value += diff >= need ? 120 + diff * 30 : -400;
        break;
      }
      default: value += 12; // Spion, HODL, Bonusgeld, Zytokinese: für den Gegner nur ein Joker
    }
    if (ai === 'house') value += 25 + def.rarity * 15;
    if (ai === 'counter') value -= 10; // hebt Joker eher auf
    return value;
  };

  Duel.prototype._aiPlan = function () {
    var self = this, hand = this.hand.opp, best = null;
    var sees = this.enemy.passive === 'sees-hand' || this.enemy.passive === 'director' || (this.enemy.passive === 'by-ear' && this.oppTurns <= 3);
    var chainCap = this.enemy.chain, chains = chainCap > 1; // nur wenige Gegner legen mehrere Karten

    function follow(cardId) { // wie viele Spielerkarten könnten direkt anlegen?
      var n = 0;
      self.hand.player.forEach(function (pid) { if (self._fits(pid, 'player', cardId)) n++; });
      return n;
    }
    function own(cardId, exclude) { // wie viele eigene Karten könnten danach anlegen?
      var n = 0;
      hand.forEach(function (id) {
        if (exclude.indexOf(id) < 0 && self._fits(id, 'opp', cardId)) n++;
      });
      return n;
    }

    hand.forEach(function (id) {
      if (!self.playable('opp', id)) return;
      var def = self.def(id), group = [id];
      if (!def.special && chains) {
        hand.forEach(function (o) {
          if (o !== id && group.length < chainCap && !self.def(o).special && self.def(o).rank === def.rank) group.push(o);
        });
      }
      // Reihenfolge: "id" eröffnet, oben landet die Farbe mit dem besten Anschluss.
      var order = group.slice();
      if (order.length > 1) {
        var tail = order.slice(1).sort(function (a, b) {
          var sa = own(a, group) - (sees ? follow(a) : 0);
          var sb = own(b, group) - (sees ? follow(b) : 0);
          return sa - sb;
        });
        order = [id].concat(tail);
      }
      var topId = order[order.length - 1];
      var value = 0;
      order.forEach(function (cid) { value += self._aiValue(cid); });
      value += (order.length - 1) * 35;
      value += own(topId, group) * 6;
      if (sees) value -= follow(topId) * 14;
      if (order.length === hand.length) value += 1000; // Sieg
      if (!best || value > best.value) best = { value: value, order: order };
    });
    return best && best.value > -200 ? best.order : null;
  };

  /* Wie wahrscheinlich der Gegner einen Zug verschenkt: Hausregeln drücken das, Freibier hebt es. */
  Duel.prototype._hesitation = function () {
    var chance = ZU.aiHesitation(this.kind, this.act) * (this.mods.hesitation == null ? 1 : this.mods.hesitation);
    if (this.rule('wide-awake')) chance = 0;
    else if (this.rule('sober')) chance *= 0.5;
    return this.has('freibier') ? chance * 1.25 + 0.04 : chance;
  };

  Duel.prototype.aiMove = function () {
    this._requireAction('opp');
    var order = this._aiPlan();
    // Schwächere Gegner zögern gelegentlich und ziehen, obwohl sie legen könnten.
    if (order && order.length < this.hand.opp.length && this.rng.next() < this._hesitation()) order = null;
    var ev = order ? this.play('opp', order) : this.draw('opp');
    // Hat er gezogen und die Karte passt, legt er sie – außer sie würde ihm schaden (etwa ein schlechter Tausch).
    if (this.afterDraw && this.afterDraw.actor === 'opp' && this.phase === 'action') {
      var self = this, pick = this.afterDraw.ids.slice().sort(function (a, b) { return self._aiValue(b) - self._aiValue(a); })[0];
      ev = ev.concat(this._aiValue(pick) > -200 ? this.play('opp', [pick]) : this.pass('opp'));
    }
    return ev;
  };

  /* Vorschlag für den Spieler (Tipp-Funktion und Simulationstests). */
  Duel.prototype.suggest = function () {
    var self = this, hand = this.hand.player, best = null;
    hand.forEach(function (id) {
      if (!self.playable('player', id)) return;
      var def = self.def(id), group = [id];
      if (!def.special && self.has('nimble-fingers')) {
        hand.forEach(function (o) {
          if (o !== id && !self.def(o).special && self.def(o).rank === def.rank) group.push(o);
        });
      }
      var check = self.canPlay('player', group);
      if (!check.ok) return;
      var value = group.length * 40 + (def.special ? 30 : 0) + (def.rank === '7' ? 25 : 0);
      if (def.id === 'tausch') value = hand.length - 1 > self.hand.opp.length ? 200 : -100;
      if (def.id === 'opfer') value += 80;
      if (!best || value > best.value) best = { value: value, order: check.order };
    });
    return best && best.value > 0 ? best.order : null;
  };

  /* Prüft die Kartenerhaltung – genutzt von den Tests. */
  Duel.prototype.audit = function () {
    var seen = {}, self = this, problems = [];
    function mark(zone) {
      return function (id) {
        if (seen[id]) problems.push('Karte ' + id + ' doppelt: ' + seen[id] + ' und ' + zone);
        seen[id] = zone;
        if (!self.cards[id]) problems.push('Unbekannte Karte ' + id + ' in ' + zone);
      };
    }
    this.hand.player.forEach(mark('player'));
    this.hand.opp.forEach(mark('opp'));
    this.stocks.player.forEach(mark('stock'));
    this.stocks.opp.forEach(mark('oppstock'));
    this.pile.forEach(mark('pile'));
    this.staging.forEach(mark('staging'));
    Object.keys(this.cards).forEach(function (id) {
      if (!seen[id] && !self.cards[id].gone) problems.push('Karte ' + id + ' ist verschwunden');
    });
    return problems;
  };

  ZU.Duel = Duel;
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
