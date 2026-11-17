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
    if (this.kind === 'boss' && this.has('narrenfreiheit') && (this.enemy.passive || this.enemy.traits)) {
      // Narrenfreiheit: Der Boss sitzt am Tisch, aber seine Eigenheit bleibt draußen.
      this.enemy = Object.create(this.enemy);
      this.enemy.passive = null;
      this.enemy.traits = {};
      this.enemy.muted = true;
    }
    this.tr = this.enemy.traits || {}; // Bausteine der Eigenheit (siehe js/cast2.js)
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
    this.douse = opts.douse || [];
    this.kniffe = opts.kniffe || []; // [{ id, level }]: was der Spieler in einem Zug zusammen legen darf // Stand des Runs für wachsende Trinkets: burned, bosses, money, trinkets, lastChain
    this.chain = this.chainFloor();
    if (this.has('wuerfelbecher')) this.chain = Math.max(this.chain, 1 + this.rng.int(6));
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
    var early = this.enemy.passive === 'last-round' ? 36 : this.tr.limit || 0; // Figuren mit eigener, früher Sperrstunde
    this.turnLimit = Math.max(22, (early || ZU.TURN_LIMIT) - (this.rule('short-night') ? (early ? 6 : 14) : 0)) + (this.has('nachtlaterne') ? 10 : 0);
    this.showdown = false;
    this.afterDraw = null; // nach dem Ziehen: { actor, ids } der Karten, die sofort gelegt werden dürfen
    this.suitRun = { suit: null, n: 0 }; // Farbenlehre: gleiche Symbole in Folge
    this.lifeGain = 0; // Reservefunke
    this.toll = 0; // Makel „Zoll": Mark, die bei der Auszahlung abgehen
    this.wonBy = null; // 'curfew', wenn Sperrstunde oder Kartenvergleich entschieden hat
    this.pTurns = 0; // Züge des Spielers
    this.oppPlays = 0; // gespielte Karten des Gegners
    this.oppRun = { suit: null, n: 0 }; // gleiche Symbole in Folge beim Gegner
    this.noFace = 0; // Schwarzfahrer: Karten in Folge ohne Bildkarte
    this.suitsPlayed = {}; // Blumentopf
    this.firstSuit = null; // Wetterhahn: Symbol der ersten Tischkarte
    this.volDraws = 0; // freiwillig gezogen
    this.chainGuard = 0; // Rauchbombe: so oft übersteht die Kette das Ziehen
    this.plus = {}; // Wandersmann: Karten-Id -> wie oft in diesem Duell gespielt
    this.spent = []; // Trinkets, die sich in diesem Duell verbraucht haben
    // Zählwerke für Auszahlung und Hinterzimmer (was der Spieler in diesem Duell geschafft hat)
    this.stats = { played: 0, drawn: 0, sevens: 0, eights: 0, aces: 0, specials: 0, pairs: 0, pushed: 0, skips: 0, curses: 0, reflects: 0, swaps: 0, sacrificed: 0 };
  }

  /* Meldet die Eigenheit des Gegners (für die Anzeige) – und füttert den Torero. */
  Duel.prototype._passive = function (ev, id) {
    ev.push({ t: 'passive', id: id });
    if (this.has('torero')) {
      this._setChain(this.chain + 2);
      ev.push({ t: 'trinket', id: 'torero' });
      ev.push({ t: 'chain', chain: this.chain });
    }
  };
  /* Chancen auf Trinkets; die Hasenpfote verdoppelt sie. */
  Duel.prototype._luck = function (chance) { return this.rng.next() < chance * (this.has('hasenpfote') ? 2 : 1); };
  /* Verflucht eine Seite. Der Schutzengel lenkt den ersten Fluch gegen den Spieler um; manche Gegner sind gefeit.
     Liefert, wen es getroffen hat (oder null, wenn der Fluch abgeprallt ist). */
  Duel.prototype._curse = function (tgt, amount, ev) {
    if (tgt === 'player' && this.has('schutzengel') && !this.used.schutzengel) {
      this.used.schutzengel = true;
      ev.push({ t: 'trinket', id: 'schutzengel' });
      tgt = 'opp';
    }
    if (tgt === 'opp' && this.tr.curseImmune) { this._passive(ev, this.enemy.passive); return null; }
    if (tgt === 'opp' && (this.used.ignCurse || 0) < (this.tr.ignoreCurses || 0)) {
      this.used.ignCurse = (this.used.ignCurse || 0) + 1;
      this._passive(ev, this.enemy.passive);
      return null;
    }
    this.status.curse[tgt] += amount;
    return tgt; // wen es getroffen hat
  };
  /* Der Gegner wirft seine schwächste Karte ab (nie die letzte). */
  Duel.prototype._oppDitch = function (ev) {
    if (this.hand.opp.length < 2) return false;
    var self = this, worst = this.hand.opp.slice().sort(function (a, b) { return self._aiValue(a) - self._aiValue(b); })[0];
    this._discardUnder('opp', worst, 'hand', 'sacrifice', ev);
    return true;
  };

  Duel.prototype.has = function (id) { return this.trinkets.indexOf(id) >= 0; };
  Duel.prototype.rule = function (id) { return this.rules.indexOf(id) >= 0; };
  Duel.prototype.chainFloor = function () { return this.has('fuse') ? 2 : 1; };
  Duel.prototype.def = function (id) { return ZU.CARDS[this.cards[id].def]; };
  /* Trägt die Karte dieses Siegel bzw. diesen Makel? */
  Duel.prototype.sealed = function (id, seal) { return (this.cards[id].seals || []).indexOf(seal) >= 0; };
  Duel.prototype.flawed = function (id, flaw) { return (this.cards[id].flaws || []).indexOf(flaw) >= 0; };
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
      self.cards[cid].seals = ZU.sealsOf(c);
      self.cards[cid].flaws = ZU.flawsOf(c);
      self.cards[cid].plus = c.plus || 0; // Wandersmann: wie oft die Karte in diesem Run schon gespielt wurde
      return cid;
    });
    rng.shuffle(owned);
    if (this.has('gezinktes-blatt')) {
      // Gezinktes Blatt: Spezialkarten wandern nach vorn und damit sicher auf die Starthand.
      owned = owned.filter(function (id) { return self.def(id).special; }).concat(owned.filter(function (id) { return !self.def(id).special; }));
    }
    // Anker-Karten wandern nach vorn (sichere Starthand), Nachzügler nach hinten.
    owned = owned.filter(function (id) { return self.sealed(id, 'anker'); })
      .concat(owned.filter(function (id) { return !self.sealed(id, 'anker') && !self.flawed(id, 'spaet'); }))
      .concat(owned.filter(function (id) { return !self.sealed(id, 'anker') && self.flawed(id, 'spaet'); }));
    var handSize = ZU.HAND_SIZE - (this.has('schmale-hand') ? 1 : 0) + (this.rule('handicap') ? 1 : 0) + (this.has('stuntman') ? 2 : 0);
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
    this.firstSuit = ZU.CARDS[tableDef].suit;
    this.pile.push(tableId);
    ev.push({ t: 'table', id: tableId });

    var oppSize = ZU.OPP_HAND + (this.kind === 'battle' ? 1 : 0) + (this.enemy.handBonus || 0) -
      (this.enemy.passive === 'head-start' || this.enemy.passive === 'baroness' || this.enemy.passive === 'house-cut' ? 2 : this.enemy.passive === 'house' ? 1 : 0);
    oppSize = Math.max(4, oppSize + (this.mods.oppHand || 0) - (this.rule('house-edge') ? 1 : 0) - (this.tr.fewer || 0) - (this.has('stein-der-weisen') ? 1 : 0)) +
      (this.has('klebefinger') ? 1 : 0) + (this.tr.more || 0);
    if (this.enemy.passive === 'jewels' || this.enemy.passive === 'director' || this.enemy.passive === 'entourage') counts.hand = 3;
    if (this.tr.handSpecials) counts.hand = Math.max(counts.hand, this.tr.handSpecials);
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
      this._passive(ev, this.enemy.passive);
      this._curse('player', opening, ev);
      ev.push(this._statusEvent());
    }
    // Eigenheiten aus Bausteinen (js/cast2.js): was schon vor dem ersten Zug wirkt
    var tr = this.tr;
    if (tr.startCurse || tr.startDraw || tr.startSkip || tr.seize) this._passive(ev, this.enemy.passive);
    if (tr.startCurse) { this._curse('player', tr.startCurse, ev); ev.push(this._statusEvent()); }
    if (tr.seize && mine.length && this.hand.player.length) {
      // Beschlagnahmt: die wertvollste Handkarte wandert unter den Stapel, eine neue kommt nach.
      var worth = function (cid) { var d = self.def(cid); return d.special ? 40 + d.price : d.base + (d.rank === '7' ? 20 : 0); };
      var best = this.hand.player.slice().sort(function (a, b) { return worth(b) - worth(a); })[0];
      this._discardUnder('player', best, 'hand', 'mulligan', ev);
      this._drawInto('player', 1, 'mulligan', ev, false);
    }
    if (tr.startDraw) this._drawInto('player', tr.startDraw, 'deal', ev, false);
    if (tr.startSkip) { this.status.skip.player = 1; ev.push(this._statusEvent()); }
    if (this.rule('tombola') && mine.length && this.hand.player.length) {
      // Tombola: Das Los tauscht eine Handkarte gegen eine vom Stapel.
      ev.push({ t: 'rule', id: 'tombola' });
      this._discardUnder('player', this.rng.pick(this.hand.player), 'hand', 'mulligan', ev);
      this._drawInto('player', 1, 'mulligan', ev, false);
    }
    if (this.enemy.passive === 'donna' || this.enemy.passive === 'list' || this.enemy.passive === 'entourage') {
      this._passive(ev, this.enemy.passive);
      this._drawInto('player', this.enemy.passive === 'donna' ? 2 : 1, 'deal', ev, false);
    }
    if (this.enemy.passive === 'upbeat') {
      this.status.skip.player = 1;
      this._passive(ev, 'upbeat');
      ev.push(this._statusEvent());
    }
    var anchored = this.hand.player.filter(function (cid) { return self.sealed(cid, 'anker'); });
    if (anchored.length) ev.push({ t: 'seal', seal: 'anker', cards: anchored });
    if (this.rule('marked')) {
      this._curse('player', 1, ev);
      ev.push({ t: 'rule', id: 'marked' });
      ev.push(this._statusEvent());
    }
    if (this.has('teufelspakt')) {
      this.status.curse.player += 2;
      ev.push({ t: 'trinket', id: 'teufelspakt' });
      ev.push(this._statusEvent());
    }
    if (this.has('klebefinger')) ev.push({ t: 'trinket', id: 'klebefinger' });
    if (this.has('stein-der-weisen')) ev.push({ t: 'trinket', id: 'stein-der-weisen' });
    if (this.has('wuerfelbecher')) { ev.push({ t: 'trinket', id: 'wuerfelbecher' }); ev.push({ t: 'chain', chain: this.chain }); }
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
      this._curse('opp', 2, ev);
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
        if (ZU.SUITS[card.bind] && (this.has('skeleton-key') || this.has('verschmiert'))) return ZU.bindSuits(ZU.SUITS[card.bind].red ? 'red' : 'black');
      }
      if (actor === 'opp' && this.enemy.passive === 'keys') return ZU.SUIT_ORDER;
      return ZU.bindSuits(card.bind);
    }
    if (def.rank === 'A' && ((actor === 'player' && this.has('ace-sleeve')) || (actor === 'opp' && this.enemy.passive === 'sleeve'))) {
      return ZU.SUIT_ORDER;
    }
    if (def.rank === 'J' && actor === 'player' && this.has('bubenstueck')) return ZU.SUIT_ORDER;
    if (actor === 'player' && (card.seals || []).indexOf('irrlicht') >= 0) return ZU.SUIT_ORDER;
    if (actor === 'opp' && this.tr.wild && this.tr.wild.indexOf(def.rank) >= 0) return ZU.SUIT_ORDER;
    // Verschmierte Karte: Herz und Karo sind eins, Pik und Kreuz ebenso.
    if (actor === 'player' && this.has('verschmiert')) return ZU.bindSuits(ZU.SUITS[def.suit].red ? 'red' : 'black');
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
    for (var k = 0; k < ids.length; k++) {
      if (this.def(ids[k]).special) return { ok: false, reason: 'Spezialkarten werden einzeln gespielt.' };
    }
    var used = null;
    if (actor === 'player') {
      var fit = this.groupOk(ids);
      if (!fit.ok) return { ok: false, reason: fit.reason };
      used = fit.kniff;
    } else {
      if (ids.length > this.enemy.chain) return { ok: false, reason: 'Zu viele Karten.' };
      var first = this.def(ids[0]);
      for (var q = 0; q < ids.length; q++) {
        if (this.def(ids[q]).rank !== first.rank) return { ok: false, reason: 'Eine Kette braucht Karten mit gleichem Wert.' };
      }
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
    return { ok: true, order: order, kniff: used };
  };

  /* Passen diese normalen Karten als Gruppe zu einem Kniff des Spielers? Prüft nur Muster und Obergrenze, nicht
     ob eine davon auf den Stapel passt. Liefert { ok, kniff } oder { ok: false, reason }. */
  Duel.prototype.groupOk = function (ids) {
    var self = this, defs = ids.map(function (id) { return self.def(id); }), tooMany = null;
    if (defs.some(function (d) { return d.special; })) return { ok: false, reason: 'Spezialkarten werden einzeln gespielt.' };
    if (!this.kniffe.length) return { ok: false, reason: 'Mehrere Karten auf einmal gehen nur mit einem Kniff.' };
    var sameRank = defs.every(function (d) { return d.rank === defs[0].rank; });
    var sameSuit = defs.every(function (d) { return d.suit === defs[0].suit; });
    var extra = this.has('vier-finger') ? 1 : 0; // Vier Finger: eine Karte mehr, als die Stufe erlaubt
    for (var i = 0; i < this.kniffe.length; i++) {
      var k = this.kniffe[i], spec = ZU.KNIFFE[k.id], fits = false;
      if (spec.kind === 'rank') fits = sameRank && (!spec.ranks || spec.ranks.indexOf(defs[0].rank) >= 0);
      else if (spec.kind === 'suit') fits = sameSuit && defs[0].suit === spec.suit;
      else if (spec.kind === 'color') fits = defs.every(function (d) { return ZU.SUITS[d.suit].red === spec.red; });
      else if ((spec.kind === 'run' && sameSuit) || spec.kind === 'stairs') {
        var orders = defs.map(function (d) { return ZU.RANKS[d.rank].order; }).sort(function (x, y) { return x - y; });
        fits = orders.every(function (o, n) { return n === 0 || o === orders[n - 1] + 1; });
      }
      if (!fits) continue;
      if (ids.length <= ZU.KNIFF_LIMIT[k.level] + extra) return { ok: true, kniff: k.id };
      tooMany = k;
    }
    if (tooMany) return { ok: false, reason: '„' + ZU.KNIFFE[tooMany.id].name + '“ erlaubt auf Stufe ' + tooMany.level + ' höchstens ' + (ZU.KNIFF_LIMIT[tooMany.level] + extra) + ' Karten.' };
    return { ok: false, reason: 'Dafür hast du keinen Kniff.' };
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
    this.salvo = actor === 'player' ? check.order.length : 0; // Breitseite: wie viele Karten dieser Zug zusammen legt
    check.order.forEach(function (id) { self._putOnTable(actor, id, 'hand', ev); });
    this.salvo = 0;
    var single = check.order.length === 1 && this.def(check.order[0]).special;
    var tr = this.tr;
    if (actor === 'player') {
      if (this.pTurns === 1 && this.has('oellampe') && !this.used.oellampe) {
        this.used.oellampe = true;
        this.retain = true;
        ev.push({ t: 'trinket', id: 'oellampe' });
      }
      if (this.kuckuck) { this.kuckuck = false; this.retain = true; ev.push({ t: 'trinket', id: 'kuckucksuhr' }); }
      if (this.has('stammbaum') && !this.used.stammbaum) {
        var firstPlain = check.order.filter(function (id) { return !self.def(id).special; })[0];
        if (firstPlain != null) {
          this.used.stammbaum = true;
          this.created.push({ def: this.cards[firstPlain].def, bind: null });
          ev.push({ t: 'trinket', id: 'stammbaum' });
          ev.push({ t: 'created', defs: [this.cards[firstPlain].def], binds: [null], via: 'stammbaum', source: firstPlain });
        }
      }
    }
    if (actor === 'player' && check.order.length >= 2) {
      this.stats.pairs++;
      ev.push({ t: 'kniff', id: check.kniff, count: check.order.length });
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
      this._passive(ev, 'encore');
    }
    if (single && actor === 'opp' && tr.firstSpecialFree && !this.used.encore) {
      this.used.encore = true;
      this.retain = true;
      this._passive(ev, this.enemy.passive);
    }
    if (actor === 'opp') {
      var ranks = check.order.map(function (id) { return self.def(id).rank; });
      if (tr.rankAgain && ranks.some(function (r) { return tr.rankAgain.indexOf(r) >= 0; })) {
        this.retain = true;
        this._passive(ev, this.enemy.passive);
      }
      if (tr.every && tr.every.do === 'again' && this.oppTurns % tr.every.n === 0 && this.againTurn !== this.oppTurns) {
        this.againTurn = this.oppTurns; // nur einmal je Zug, sonst hörte sie nie auf
        this.retain = true;
        this._passive(ev, this.enemy.passive);
      }
    }
    if (single && actor === 'player' && (this.enemy.passive === 'void-special' || tr.voidSpecial) && !this.used['void-special']) {
      this.used['void-special'] = true;
      this._passive(ev, this.enemy.passive);
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
    if (actor === 'opp') {
      var forced = 0;
      if (tr.lastCard && !this.used.lastCard && this.hand.opp.length === 1) { this.used.lastCard = true; forced += tr.lastCard; }
      if (tr.firstPlayDraw && !this.used.firstPlay) { this.used.firstPlay = true; forced += tr.firstPlayDraw; }
      if (tr.everyPlay) {
        for (var c = 0; c < check.order.length; c++) if (++this.oppPlays % tr.everyPlay.n === 0) forced += tr.everyPlay.draw;
      }
      if (tr.suitRun) {
        check.order.forEach(function (id) {
          var suit = self.def(id).suit;
          self.oppRun = suit && self.oppRun.suit === suit ? { suit: suit, n: self.oppRun.n + 1 } : { suit: suit, n: suit ? 1 : 0 };
          if (self.oppRun.n >= tr.suitRun.n) { self.oppRun.n = 0; forced += tr.suitRun.draw; }
        });
      }
      if (single && tr.onOppSpecial) forced += tr.onOppSpecial;
      if (forced && this.hand.opp.length) {
        this.queue.push({ type: 'passive', id: this.enemy.passive, src: actor });
        this.queue.push({ type: 'draw', amount: forced, reflectable: false, src: actor });
      }
    }
    if (single && actor === 'player' && tr.onPlayerSpecial) {
      this.queue.push({ type: 'passive', id: this.enemy.passive, src: actor });
      this.queue.push({ type: 'selfdraw', amount: tr.onPlayerSpecial, src: actor });
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
    var ev = [], self = this, before = this.hand[actor].length, take = 1;
    if (actor === 'player') {
      this.volDraws++;
      if (this.tr.firstDraw && !this.used.firstDraw) {
        // z. B. Nieten: Das erste freiwillige Ziehen bringt mehr Karten.
        this.used.firstDraw = true;
        take = this.tr.firstDraw;
        this._passive(ev, this.enemy.passive);
      }
    }
    var drawn = this._drawInto(actor, take, 'draw', ev, true);
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
        if (next < this.chain && this.chainGuard > 0) {
          this.chainGuard--; // Rauchbombe: Die Kette übersteht dieses Ziehen
          ev.push({ t: 'effect', type: 'guard-used', src: 'player', tgt: 'player' });
        } else if (next < this.chain && this.has('zweite-luft') && !this.used['zweite-luft']) {
          this.used['zweite-luft'] = true;
          ev.push({ t: 'trinket', id: 'zweite-luft' });
        } else if (next !== this.chain) {
          this.chain = next;
          ev.push({ t: 'chain', chain: this.chain, reset: true });
        }
      }
    }
    if (actor === 'player' && this.tr.onPlayerDraw === 'discard' && this.hand.opp.length > 1) {
      // Dauerrede: Wer zieht, schenkt dem Gegner eine Karte weniger.
      this._passive(ev, this.enemy.passive);
      this._oppDitch(ev);
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
      var low = def.rank === '7' || def.rank === '8' || def.rank === '9';
      var masked = low && this.has('maskenball'); // Maskenball: 7, 8 und 9 gelten als Bildkarten
      var face = def.rank === 'J' || def.rank === 'Q' || def.rank === 'K' || masked;
      var mark = this.cards[id], seals = mark.seals || [], flaws = mark.flaws || [], self2 = this;
      var sealed = function (s) { return seals.indexOf(s) >= 0; }, flawed = function (f) { return flaws.indexOf(f) >= 0; };
      // Ebenbild: Liegt genau dieselbe Karte schon oben (gleicher Wert, gleiches Symbol), wächst die Kette um die Hälfte –
      // noch bevor diese Karte zählt. Aus ×10 wird ×15.
      var twin = null;
      if (below && (below === def || (sealed('spiegel') && !below.special && below.rank === def.rank))) {
        var before = this.chain, lift = this.has('spiegelkabinett') ? 2 : ZU.TWIN_CHAIN; // Spiegelkabinett: Ebenbild verdoppelt
        this._setChain(Math.ceil(before * lift));
        if (this.chain > before) twin = { from: before, to: this.chain, f: lift };
      }
      var held = this.hand.player, lowest = 0;
      if (this.has('geballte-faust') && held.length) {
        lowest = Math.min.apply(null, held.map(function (cid) { return self2.def(cid).base; }));
      }
      var extra = { pfeilspitze: def.suit === 'spades' ? 10 : 0, 'schraeger-vogel': def.rank === '7' || def.rank === '9' || def.rank === 'A' ? 7 : 0,
        'geballte-faust': 2 * lowest, blaupause: 2 * this.stocks.player.length, handwaermer: 3 * held.length, stuntman: 20,
        daeumling: (this.grow.sevens || 0) + this.stats.sevens,
        wandersmann: mark.persistent ? 2 * ((mark.plus || 0) + (this.plus[id] || 0)) : 0 };
      var extraIds = Object.keys(extra).filter(function (tid) { return extra[tid] > 0 && self2.has(tid); }), extraSum = 0;
      extraIds.forEach(function (tid) { extraSum += extra[tid]; });
      var base = (masked ? 10 : def.base) + extraSum + (sealed('funke') ? 8 : 0) + (low && this.has('kleinvieh') ? 6 : 0) + (face && this.has('hofstaat') ? 5 : 0) +
        (this.has('zunder') ? 4 : 0) + (def.special && this.has('tintenfass') ? 15 : 0) +
        (def.suit === 'clubs' && this.has('kreuzfeuer') ? 8 : 0) + (def.rank === 'J' && this.has('bauernopfer') ? 10 : 0) +
        (def.suit && ZU.SUITS[def.suit].red && this.has('rotlicht') ? 3 : 0) + (this.chain >= 4 && this.has('feuerzeug') ? 6 : 0);
      if (flawed('matt')) base = Math.max(1, base - 4);
      // Kettenreaktion: Jenseits von ×10 zählt jede Stufe doppelt.
      var effChain = this.chain + (this.has('kettenreaktion') ? Math.max(0, this.chain - 10) : 0);
      var points = base * effChain, doubled = false, trig = [];
      // steps: jeder Faktor in der Reihenfolge, in der er wirkt, mit dem Zwischenstand (nur für die Anzeige der Rechnung)
      var steps = [], self = this, adds = ['kleinvieh', 'hofstaat', 'zunder', 'tintenfass', 'kreuzfeuer', 'bauernopfer', 'rotlicht', 'feuerzeug'].filter(function (tid) {
        return self.has(tid) && (tid === 'kleinvieh' ? low : tid === 'hofstaat' ? face : tid === 'tintenfass' ? def.special : tid === 'kreuzfeuer' ? def.suit === 'clubs' :
          tid === 'bauernopfer' ? def.rank === 'J' : tid === 'rotlicht' ? !!(def.suit && ZU.SUITS[def.suit].red) : tid === 'feuerzeug' ? self.chain >= 4 : true);
      }).concat(extraIds);
      extraIds.forEach(function (tid) { trig.push(tid); });
      if (masked) trig.push('maskenball');
      if (effChain > this.chain) trig.push('kettenreaktion'); // trig: Trinkets, die bei dieser Karte gezündet haben (für die Anzeige)
      if (def.suit === 'clubs' && this.has('kreuzfeuer')) trig.push('kreuzfeuer');
      if (def.rank === 'J' && this.has('bauernopfer')) trig.push('bauernopfer');
      if (this.chain >= 4 && this.has('feuerzeug')) trig.push('feuerzeug');
      if (def.rank === '10' && this.has('volle-zehn')) { points *= 2; doubled = true; trig.push('volle-zehn'); steps.push({ id: 'volle-zehn', f: 2, v: points }); }
      if (this.stats.played < 3 && this.has('erster-funke')) { points *= 2; doubled = true; trig.push('erster-funke'); steps.push({ id: 'erster-funke', f: 2, v: points }); }
      if (this.stats.played % 3 === 2 && this.has('vollmond')) { points *= 2; doubled = true; trig.push('vollmond'); steps.push({ id: 'vollmond', f: 2, v: points }); }
      if (this.hand.player.length >= 6 && this.has('volles-haus')) { points = Math.round(points * 1.5); trig.push('volles-haus'); steps.push({ id: 'volles-haus', f: 1.5, round: true, v: points }); }
      if ((this.grow.money || 0) <= 5 && this.has('leere-taschen')) { points = Math.round(points * 1.6); trig.push('leere-taschen'); steps.push({ id: 'leere-taschen', f: 1.6, round: true, v: points }); }
      if (below && below.suit && def.suit && below.suit !== def.suit && this.has('farbwechsel')) { points *= 2; doubled = true; trig.push('farbwechsel'); steps.push({ id: 'farbwechsel', f: 2, v: points }); }
      if (def.special && this.has('heisse-ware')) { points *= 2; doubled = true; trig.push('heisse-ware'); steps.push({ id: 'heisse-ware', f: 2, v: points }); }
      if (this.hand.player.length <= 1 && this.has('endspurt')) { points *= 3; doubled = true; trig.push('endspurt'); steps.push({ id: 'endspurt', f: 3, v: points }); }
      if (this.has('gluecksrad') && this._luck(0.15)) { points *= 3; doubled = true; trig.push('gluecksrad'); steps.push({ id: 'gluecksrad', f: 3, v: points }); }
      if (low && this.has('kleinvieh')) trig.push('kleinvieh');
      if (face && this.has('hofstaat')) trig.push('hofstaat');
      if (def.special && this.has('tintenfass')) trig.push('tintenfass');
      if (def.suit === 'hearts' && this.has('heartblood')) { points *= 2; doubled = true; trig.push('heartblood'); steps.push({ id: 'heartblood', f: 2, v: points }); }
      if (def.suit === 'diamonds' && this.has('karoglanz')) { points *= 2; doubled = true; trig.push('karoglanz'); steps.push({ id: 'karoglanz', f: 2, v: points }); }
      if ((def.suit === 'spades' || def.suit === 'clubs') && this.has('black-series')) { points = Math.round(points * 1.5); trig.push('black-series'); steps.push({ id: 'black-series', f: 1.5, round: true, v: points }); }
      if (def.rank === 'A' && this.has('trumpf-ass')) { points *= 3; doubled = true; trig.push('trumpf-ass'); steps.push({ id: 'trumpf-ass', f: 3, v: points }); }
      if (below && !def.special && !below.special && below.rank === def.rank && this.has('zwillinge')) { points *= 2; doubled = true; trig.push('zwillinge'); steps.push({ id: 'zwillinge', f: 2, v: points }); }
      if (this.chain >= 6 && this.has('dampfkessel')) { points *= 2; doubled = true; trig.push('dampfkessel'); steps.push({ id: 'dampfkessel', f: 2, v: points }); }
      if (!this.hand.player.length && this.has('letzte-glut')) { points *= 5; doubled = true; trig.push('letzte-glut'); steps.push({ id: 'letzte-glut', f: 5, v: points }); }
      if (this.status.blaze > 0) { this.status.blaze--; points *= 2; doubled = true; steps.push({ label: 'Stichflamme', f: 2, v: points }); }
      if (this.has('teufelspakt')) { points *= 2; doubled = true; steps.push({ id: 'teufelspakt', f: 2, v: points }); }
      if (sealed('glut')) { points *= 2; doubled = true; steps.push({ seal: 'glut', f: 2, v: points }); }
      // Wachsende Trinkets: Ihre Prozente addieren sich und wachsen mit dem Run bzw. dem Duell.
      var grow = this.grow, pct = 0, grown = trig.length;
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
      if (pct > 0) { points = Math.round(points * (1 + pct)); steps.push({ ids: trig.slice(grown), pct: pct, f: 1 + pct, round: true, v: points }); }
      // Glut-Mult: Jedes dieser Trinkets ist ein eigener Faktor – zusammen multiplizieren sie sich.
      var mult = function (tid, f) {
        f = Math.round(f * 100) / 100;
        if (f <= 1) return;
        points = Math.round(points * f);
        if (f >= 2) doubled = true;
        trig.push(tid);
        steps.push({ id: tid, f: f, round: true, v: points });
      };
      if (this.has('brandbeschleuniger')) mult('brandbeschleuniger', 1.5);
      if (this.has('chefsache') && this.kind === 'boss') mult('chefsache', 3);
      if (this.has('oel-ins-feuer')) mult('oel-ins-feuer', Math.pow(1.5, this.douse.length));
      if (this.has('schaulustige')) mult('schaulustige', 1 + 0.1 * this.hand.opp.length);
      if (this.has('hexenfeuer') && this.status.curse.opp > 0) mult('hexenfeuer', 2);
      if (this.has('breitseite') && this.salvo > 1) mult('breitseite', 2);
      if (this.has('weissglut')) mult('weissglut', 1 + 0.1 * this.chain);
      if (this.has('kerbholz') && grow.burnt) mult('kerbholz', 1 + 0.25 * grow.burnt);
      if (this.has('vabanque')) mult('vabanque', 3);
      // --- dritte Serie ---
      var grow3 = this.grow, hand3 = this.hand.player, count3 = function (rank) { return hand3.filter(function (cid) { return self2.def(cid).rank === rank; }).length; };
      if (face) this.noFace = 0; else this.noFace++;
      if (def.suit) this.suitsPlayed[def.suit] = true;
      if (this.has('halbe-portion') && hand3.length <= 3) mult('halbe-portion', 1.5);
      if (this.has('fehldruck')) mult('fehldruck', 1 + 0.25 * this.rng.int(7));
      if (this.has('gerade-linie') && (def.rank === '8' || def.rank === '10')) mult('gerade-linie', 1.5);
      if (this.has('schiefertafel') && !hand3.some(function (cid) { var d = self2.def(cid); return d.suit && ZU.SUITS[d.suit].red; })) mult('schiefertafel', 2);
      if (this.has('schwarzfahrer')) mult('schwarzfahrer', 1 + 0.1 * this.noFace);
      if (this.has('baron')) mult('baron', Math.pow(1.5, count3('K')));
      if (this.has('mondsuechtig')) mult('mondsuechtig', 1 + 0.3 * count3('Q'));
      if (this.has('blutstein') && def.suit === 'hearts' && this._luck(1 / 3)) mult('blutstein', 3);
      if (this.has('blumentopf') && Object.keys(this.suitsPlayed).length >= 4) mult('blumentopf', 2);
      if (this.has('hofnarr') && (def.rank === 'K' || def.rank === 'Q')) mult('hofnarr', 3);
      if (this.has('yorick')) mult('yorick', 1 + Math.floor(((grow3.played || 0) + this.stats.played) / 23));
      if (this.has('schablone')) mult('schablone', Math.max(1, 3 - 0.25 * Math.max(0, (grow3.trinkets || 1) - 1)));
      if (this.has('meisterbrief') && (grow3.sealed || 0) >= 6) mult('meisterbrief', 3);
      if (this.has('schwaenzer')) mult('schwaenzer', 1 + 0.5 * (grow3.skipped || 0));
      if (this.has('lagerfeuer')) mult('lagerfeuer', 1 + 0.25 * (grow3.burnAct || 0));
      if (this.has('drahtseilakt') && this.hand.opp.length <= 2) mult('drahtseilakt', 3);
      if (this.has('bonusheft') && this.stats.played % 6 === 5) mult('bonusheft', 4);
      if (this.has('das-trio') && this.salvo >= 3) mult('das-trio', 3);
      if (this.has('selters')) mult('selters', 2);
      if (this.has('popcorn')) mult('popcorn', grow3.popcorn || 3);
      if (this.has('banane')) mult('banane', 2);
      if (this.has('wetterhahn') && def.suit && def.suit === this.firstSuit) mult('wetterhahn', 2);
      if (this.has('hologramm')) mult('hologramm', 1 + 0.2 * (grow3.added || 0));
      if (this.has('ersatzhose')) mult('ersatzhose', 1 + 0.05 * ((grow3.multi || 0) + this.stats.pairs + (this.salvo > 1 ? 1 : 0)));
      if (this.has('glaskugel')) mult('glaskugel', 1 + 0.15 * (grow3.packs || 0));
      if (this.has('wahnsinn')) mult('wahnsinn', 1 + (grow3.wahnsinn || 0));
      if (this.has('armutsgeluebde')) mult('armutsgeluebde', 3);
      if (this.has('stein-der-weisen')) mult('stein-der-weisen', 2);
      if (this.has('totenkopfring') && grow3.lives === 1) mult('totenkopfring', 3);
      if (this.has('elitepartner') && this.kind === 'elite') mult('elitepartner', 2.5);
      if (this.has('nachteule') && this.pTurns >= 10) mult('nachteule', 2);
      this.glut += points;
      event.score = { base: base, chain: this.chain, eff: effChain, points: points, glut: this.glut, doubled: doubled, steps: steps, adds: adds };
      if (twin) event.score.twin = twin;
      var step = this.has('afterburner') ? 2 : 1;
      if (def.special && this.has('blasebalg')) { step += 2; trig.push('blasebalg'); }
      if (sealed('zuend')) step += 1;
      if (below && def.suit && below.suit && ZU.SUITS[def.suit].red && ZU.SUITS[below.suit].red && this.has('roter-teppich')) { step += 1; trig.push('roter-teppich'); }
      if (def.suit === 'spades' && this.has('schwarzer-peter')) { step += 1; trig.push('schwarzer-peter'); }
      if (def.rank === 'K' && this.has('koenigsmacher')) { step += 2; trig.push('koenigsmacher'); }
      if (def.rank === '7' && this.has('siebenmeilen')) { step += 3; trig.push('siebenmeilen'); }
      if (below && !def.special && !below.special && Math.abs(ZU.RANKS[def.rank].order - ZU.RANKS[below.rank].order) === 1 && this.has('strasse')) { step += 2; trig.push('strasse'); }
      if (flawed('stumpf')) step = 0;
      this._setChain(this.chain + step);
      event.score.next = this.chain;
      if (seals.length) event.seals = seals.slice();
      if (flaws.length) event.flaws = flaws.slice();
      if (trig.length) event.trig = trig;
      this.stats.played++;
      if (mark.persistent) this.plus[id] = (this.plus[id] || 0) + 1;
      if (this.has('kuckucksuhr') && this.stats.played % 5 === 0) this.kuckuck = true; // zündet am Ende dieses Zuges (play)
      if (def.special) this.stats.specials++;
      else if (def.rank === '7') this.stats.sevens++;
      else if (def.rank === '8') this.stats.eights++;
      else if (def.rank === 'A') this.stats.aces++;
    }
    ev.push(event);
    if (actor === 'opp' && def.rank === '7' && this.has('siebenerkrieg')) {
      this._setChain(this.chain + 2);
      ev.push({ t: 'trinket', id: 'siebenerkrieg' });
      ev.push({ t: 'chain', chain: this.chain });
    }
    if (actor === 'opp' && !def.special) {
      // Löschmittel: Die 8 und das Ass des Gegners drücken die Kette des Spielers.
      var low = this.chainFloor(), cooled = this.chain;
      if (def.rank === '8' && this.douses('sand')) cooled = Math.max(low, this.chain - ZU.DOUSE_POWER.sand);
      if (def.rank === 'A' && this.douses('water')) cooled = Math.max(low, Math.ceil(this.chain * (1 - ZU.DOUSE_POWER.water)));
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
      // Eine Karte kann mehrere tragen; jedes meldet sich für sich.
      var worn = this.cards[id], wears = function (s) { return (worn.seals || []).indexOf(s) >= 0; }, marred = function (f) { return (worn.flaws || []).indexOf(f) >= 0; };
      ['irrlicht', 'spiegel', 'funke', 'glut', 'zuend'].forEach(function (s) {
        if (wears(s) && (s !== 'spiegel' || (event.score && event.score.twin))) ev.push({ t: 'seal', seal: s, card: id });
      });
      ['matt', 'stumpf'].forEach(function (f) { if (marred(f)) ev.push({ t: 'flaw', flaw: f, card: id }); });
      if (wears('gold')) { this.bank += 1; ev.push({ t: 'seal', seal: 'gold', card: id }); ev.push(this._statusEvent()); }
      if (marred('zoll')) { this.toll++; ev.push({ t: 'flaw', flaw: 'zoll', card: id }); }
      if (wears('haken')) {
        this.queue.push({ type: 'sealnote', seal: 'haken', card: id, src: actor });
        this.queue.push({ type: 'draw', amount: 1, reflectable: true, src: actor });
      }
      if (wears('maulkorb') && !this.used.maulkorb) {
        this.used.maulkorb = true; // einmal je Duell
        this.queue.push({ type: 'sealnote', seal: 'maulkorb', card: id, src: actor });
        this.queue.push({ type: 'skip', reflectable: true, src: actor });
      }
      if (face && this.has('visitenkarte') && (this.used.visit || 0) < 6 && this._luck(0.5)) {
        this.used.visit = (this.used.visit || 0) + 1;
        this.bank += 1;
        ev.push({ t: 'trinket', id: 'visitenkarte' });
        ev.push(this._statusEvent());
      }
      if (marred('klette')) {
        this.queue.push({ type: 'flawnote', flaw: 'klette', card: id, src: actor });
        this.queue.push({ type: 'selfdraw', amount: 1, src: actor });
      }
      if (wears('bumerang') && !this.used['boom' + id] && from === 'hand' && this.hand.player.length > 0) {
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
    var self = this, draw = 0, skip = 0, rest = [], tr = this.tr;
    ids.forEach(function (id) {
      var def = self.def(id);
      if (actor === 'opp' && !def.special) {
        // Eigenheiten aus Bausteinen: Karten bestimmter Werte ziehen, bannen oder verfluchen.
        var hit = false;
        if (tr.rankDraw && tr.rankDraw[def.rank]) { draw += tr.rankDraw[def.rank]; hit = true; }
        if (tr.rankSkip && tr.rankSkip.indexOf(def.rank) >= 0) { skip = Math.max(skip, 1); hit = true; }
        if (tr.rankCurse && tr.rankCurse[def.rank]) { rest.push({ type: 'curse', amount: tr.rankCurse[def.rank], reflectable: true, src: actor, card: id }); hit = true; }
        if (hit) rest.unshift({ type: 'passive', id: self.enemy.passive, src: actor });
      }
      def.effects.forEach(function (effect) {
        if (effect.type === 'draw' && actor === 'opp' && def.rank === '7' && self.has('asbesthandschuh')) rest.push({ type: 'note', trinket: 'asbesthandschuh', src: actor });
        else if (effect.type === 'draw') draw += effect.amount + (actor === 'opp' && def.rank === '7' && self.enemy.passive === 'heavy-hand' ? 1 : 0) +
            (actor === 'player' && def.rank === '7' && self.has('seven-sleeper') ? 1 : 0) + (def.rank === '7' && self.rule('sharp-sevens') ? 1 : 0);
        else if (effect.type === 'skip') skip = Math.max(skip, effect.amount || 1);
        else if (effect.type === 'debt') draw += actor === 'player' ? effect.amount + (self.grow.missing || 0) : 2; // Schuldschein
        else rest.push({ type: effect.type, amount: effect.amount || 0, duration: effect.duration || 0, reflectable: !!effect.reflectable, src: actor, card: id });
      });
      if (actor === 'player' && def.rank === '9' && self.has('neunmalklug')) {
        if (!draw) rest.unshift({ type: 'note', trinket: 'neunmalklug', src: actor });
        draw += 1;
      }
      if (actor === 'player' && def.rank === '8' && self.has('rollercoaster')) {
        if (!skip) rest.unshift({ type: 'note', trinket: 'rollercoaster', src: actor });
        skip = Math.max(skip, 1);
      }
    });
    var items = [];
    if (draw) items.push({ type: 'draw', amount: draw, reflectable: true, src: actor });
    if (skip) items.push({ type: 'skip', amount: skip, reflectable: true, src: actor });
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
    if (item.type === 'passive') { this._passive(ev, item.id); return; }
    if (item.type === 'sealnote') { ev.push({ t: 'seal', seal: item.seal, card: item.card }); return; }
    if (item.type === 'flawnote') { ev.push({ t: 'flaw', flaw: item.flaw, card: item.card }); return; }
    if (item.reflectable) {
      if (src === 'player' && this.enemy.passive === 'smoke' && !this.used.smoke) {
        this.used.smoke = true;
        this._passive(ev, 'smoke');
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
          this._passive(ev, 'amplify');
        }
        if (src === 'player' && tgt === 'opp' && this.enemy.passive === 'armored' && (this.used.armored || 0) < 2) {
          this.used.armored = (this.used.armored || 0) + 1;
          this._passive(ev, 'armored');
          ev.push({ t: 'effect', type: 'skip-blocked', src: src, tgt: tgt });
          break;
        }
        if (src === 'player' && tgt === 'opp' && (this.used.ignDraw || 0) < (this.tr.ignoreDraws || 0)) {
          this.used.ignDraw = (this.used.ignDraw || 0) + 1;
          this._passive(ev, this.enemy.passive);
          ev.push({ t: 'effect', type: 'skip-blocked', src: src, tgt: tgt });
          break;
        }
        if (tgt === 'player' && this.has('weihrauch')) {
          this.used.weihrauch = (this.used.weihrauch || 0) + 1;
          if (this.used.weihrauch % 3 === 0) {
            ev.push({ t: 'trinket', id: 'weihrauch' });
            ev.push({ t: 'effect', type: 'skip-blocked', src: src, tgt: tgt });
            break;
          }
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
        if (tgt === 'opp' && amount > 1 && this.tr.umbrella) {
          amount -= 1;
          this._passive(ev, this.enemy.passive);
        }
        ev.push({ t: 'effect', type: 'draw', src: src, tgt: tgt, amount: amount });
        var got = this._drawInto(tgt, amount, 'effect', ev, true);
        if (tgt === 'opp') this.stats.pushed += got;
        if (tgt === 'player' && got > 0 && this.has('trotzkopf')) {
          this._setChain(this.chain + got);
          ev.push({ t: 'trinket', id: 'trotzkopf' });
          ev.push({ t: 'chain', chain: this.chain });
        }
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
      case 'spark':
        // Funkenflug: ein Anteil des Glutziels sofort als Glut
        if (src === 'player' && this.target) {
          this.glut += Math.round(this.target * item.amount / 100);
          ev.push({ t: 'effect', type: 'spark', src: src, tgt: src, amount: item.amount });
          ev.push({ t: 'glut', glut: this.glut });
        } else {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        }
        break;
      case 'roulette': {
        // Rot oder Schwarz: Der Gegner zieht viel – oder man selbst die Hälfte.
        var lucky = this.rng.next() < 0.5;
        ev.push({ t: 'effect', type: lucky ? 'roulette-win' : 'roulette-lose', src: src, tgt: lucky ? tgt : src });
        if (lucky) this.queue.unshift({ type: 'draw', amount: item.amount, reflectable: false, src: src });
        else this.queue.unshift({ type: 'selfdraw', amount: Math.ceil(item.amount / 2), src: src });
        break;
      }
      case 'temper':
        if (src === 'player') {
          this._setChain(Math.ceil(this.chain * 1.5));
          ev.push({ t: 'effect', type: 'stoke', src: src, tgt: src, amount: this.chain });
          ev.push({ t: 'chain', chain: this.chain });
        } else {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        }
        break;
      case 'bankdouble':
        if (src === 'player' && this.bank > 0) {
          var more = Math.min(item.amount, this.bank);
          this.bank += more;
          ev.push({ t: 'effect', type: 'bank', src: src, tgt: src, amount: more });
          ev.push(this._statusEvent());
        } else {
          ev.push({ t: 'effect', type: 'idle', src: src, tgt: src });
        }
        break;
      case 'guard':
        if (src === 'player') {
          this.chainGuard++;
          ev.push({ t: 'effect', type: 'guard', src: src, tgt: src });
        }
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
          this._passive(ev, 'thick-skin');
          ev.push({ t: 'effect', type: 'skip-blocked', src: src, tgt: tgt });
        } else if (tgt === 'opp' && (this.used.ignSkip || 0) < (this.tr.ignoreSkips || 0)) {
          this.used.ignSkip = (this.used.ignSkip || 0) + 1;
          this._passive(ev, this.enemy.passive);
          ev.push({ t: 'effect', type: 'skip-blocked', src: src, tgt: tgt });
        } else {
          var rounds = item.amount || 1;
          if (tgt === 'player' && src === 'opp' && this.tr.longSkip && !this.used.longSkip) {
            this.used.longSkip = true;
            rounds = Math.max(rounds, 2);
            this._passive(ev, this.enemy.passive);
          }
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
        var landed = this._curse(tgt, curseBy, ev);
        if (landed) ev.push({ t: 'effect', type: 'curse', src: src, tgt: landed, amount: curseBy });
        else ev.push({ t: 'effect', type: 'skip-blocked', src: src, tgt: tgt });
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
        this.glut -= Math.round(this.glut * ZU.DOUSE_POWER.blanketGlut);
        this.chain = Math.max(this.chainFloor(), Math.ceil(this.chain / 2));
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
    var need = (this.tr.tieWin || 1) - (this.has('cellar-key') ? 1 : 0); // so viele Karten weniger muss der Spieler halten
    return p <= o - need ? 'player' : 'opp';
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
      if (actor === 'player' && this.has('sitzfleisch')) {
        this._setChain(this.chain + 3);
        ev.push({ t: 'trinket', id: 'sitzfleisch' });
        ev.push({ t: 'chain', chain: this.chain });
      }
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
      if (this.douses('sprinkler') && this.oppTurns % ZU.DOUSE_POWER.sprinklerEvery === 0 && this.glut > 0) {
        if (this.has('feuerdecke')) ev.push({ t: 'trinket', id: 'feuerdecke' });
        else {
          this.glut = Math.max(0, this.glut - Math.round(this.target * ZU.DOUSE_POWER.sprinkler));
          ev.push({ t: 'douse', id: 'sprinkler', chain: this.chain, glut: this.glut });
          this._fettbrand(ev);
        }
      }
      if (this.enemy.passive === 'storm' && this.oppTurns % 5 === 0) {
        this._passive(ev, 'storm');
        this._drawInto('player', 1, 'effect', ev, true);
      }
      var every = this.tr.every;
      if (every && this.oppTurns > 1 && (this.oppTurns - 1) % every.n === 0) {
        // „nach jedem n-ten Zug": wirkt zu Beginn des folgenden Zuges
        if (every.do === 'draw') {
          this._passive(ev, this.enemy.passive);
          this._drawInto('player', 1, 'effect', ev, true);
        } else if (every.do === 'discard' && this.hand.opp.length > 1) {
          this._passive(ev, this.enemy.passive);
          this._oppDitch(ev);
        }
      }
    }
    if (actor === 'player') {
      var changed = false, self = this;
      this.pTurns++;
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
      case 'vollbremsung': value += 80 + (theirs <= 3 ? 60 : 0); break;
      case 'schuldschein': value += 60 + (theirs <= 3 ? 60 : 0) + (ai === 'pressure' ? 30 : 0); break;
      case 'rauchbombe': value += 55 + (theirs <= 2 ? 50 : 0); break;
      case 'roulette': value += ai === 'gamble' ? 70 : 20; break;
      case 'nachschub': value += -400; break; // zöge selbst Karten: lässt er liegen
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
    var sees = this.enemy.passive === 'sees-hand' || this.enemy.passive === 'director' || (this.enemy.passive === 'by-ear' && this.oppTurns <= 3) ||
      !!this.tr.sees || (!!this.tr.seesTurns && this.oppTurns <= this.tr.seesTurns);
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
      if (!def.special && self.kniffe.length) {
        // Gierig erweitern: jede weitere Handkarte dazunehmen, solange ein Kniff die Gruppe trägt.
        var grew = true;
        while (grew) {
          grew = false;
          hand.forEach(function (o) {
            if (group.indexOf(o) < 0 && !self.def(o).special && self.groupOk(group.concat([o])).ok) { group.push(o); grew = true; }
          });
        }
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
