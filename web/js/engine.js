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

  function Duel(opts) {
    this.rng = opts.rng;
    this.enemy = ZU.ENEMIES[opts.enemyId];
    this.kind = opts.kind;
    this.act = opts.act;
    this.trinkets = opts.trinkets.slice();
    this.collection = opts.collection;
    this.nextId = opts.nextId;
    this.cards = {};
    this.hand = { player: [], opp: [] };
    this.stock = [];
    this.pile = [];
    this.staging = [];
    this.status = { skip: { player: 0, opp: 0 }, curse: { player: 0, opp: 0 }, spy: 0, hodl: [] };
    this.used = {};
    this.bank = 0;
    this.bonusMult = 1;
    this.chain = this.chainFloor();
    this.maxChain = this.chain;
    this.glut = 0;
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
    this.stats = { played: 0, drawn: 0 };
  }

  Duel.prototype.has = function (id) { return this.trinkets.indexOf(id) >= 0; };
  Duel.prototype.chainFloor = function () { return this.has('fuse') ? 2 : 1; };
  Duel.prototype.def = function (id) { return ZU.CARDS[this.cards[id].def]; };
  Duel.prototype.top = function () { return this.pile[this.pile.length - 1]; };

  Duel.prototype._register = function (defId, owner, persistent, id) {
    var cid = id != null ? id : this.nextId++;
    this.cards[cid] = { id: cid, def: defId, owner: owner, persistent: !!persistent, retired: false };
    return cid;
  };

  /* ---------- Aufbau ---------- */
  Duel.prototype.start = function () {
    var self = this, ev = [], rng = this.rng;
    var owned = this.collection.map(function (c) { return self._register(c.def, 'player', true, c.id); });
    rng.shuffle(owned);
    var opening = owned.slice(0, ZU.HAND_SIZE);
    var rest = owned.slice(ZU.HAND_SIZE);

    // Ein gemeinsames 32er-Blatt: eigene Standardkarten belegen ihre Plätze.
    var house = ZU.STANDARD_IDS.slice();
    this.collection.forEach(function (c) {
      var index = house.indexOf(c.def);
      if (index >= 0) house.splice(index, 1);
    });
    rng.shuffle(house);

    var counts = ZU.enemySpecials(this.kind, this.act);
    var stockSpecials = Math.min(counts.stock, Math.max(0, house.length - 14));
    house.length -= stockSpecials;

    var tableIndex = -1;
    for (var i = 0; i < house.length; i++) {
      if (ZU.CARDS[house[i]].effects.length === 0) { tableIndex = i; break; }
    }
    if (tableIndex < 0) tableIndex = 0;
    var tableDef = house.splice(tableIndex, 1)[0];

    house.forEach(function (defId) { self.stock.push(self._register(defId, 'house', false)); });
    for (var s = 0; s < stockSpecials; s++) this.stock.push(this._register(rng.pick(this.enemy.pool), 'enemy', false));
    rest.forEach(function (id) { self.stock.push(id); });
    rng.shuffle(this.stock);

    var tableId = this._register(tableDef, 'house', false);
    this.pile.push(tableId);
    ev.push({ t: 'table', id: tableId });

    var oppSize = this.enemy.passive === 'head-start' ? 6 : this.enemy.passive === 'house' ? 7 : ZU.HAND_SIZE + 1;
    var oppOpening = [];
    for (var h = 0; h < counts.hand && oppOpening.length < oppSize; h++) {
      oppOpening.push(this._register(rng.pick(this.enemy.pool), 'enemy', false));
    }
    while (oppOpening.length < oppSize && this.stock.length) oppOpening.push(this.stock.pop());
    while (opening.length < ZU.HAND_SIZE && this.stock.length) opening.push(this.stock.pop());

    var rounds = Math.max(opening.length, oppOpening.length);
    for (var r = 0; r < rounds; r++) {
      if (r < opening.length) {
        this.hand.player.push(opening[r]);
        ev.push({ t: 'move', id: opening[r], from: 'stock', to: 'player', cause: 'deal' });
      }
      if (r < oppOpening.length) {
        this.hand.opp.push(oppOpening[r]);
        ev.push({ t: 'move', id: oppOpening[r], from: 'stock', to: 'opp', cause: 'deal' });
      }
    }

    if (this.enemy.passive === 'house') {
      this.status.curse.player += 3;
      ev.push({ t: 'passive', id: 'house' });
      ev.push(this._statusEvent());
    }
    if (this.has('black-book')) {
      this.status.spy = 3;
      ev.push({ t: 'trinket', id: 'black-book' });
      ev.push(this._statusEvent());
    }
    if (this.has('ashtray') && this.stock.length) {
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
        hodl: this.status.hodl.map(function (h) { return { turns: h.turns, amount: h.amount }; }),
        bank: this.bank,
        bonusMult: this.bonusMult
      }
    };
  };

  /* ---------- Spielbarkeit ---------- */
  Duel.prototype._wildFor = function (def, actor) {
    return def.special || (actor === 'player' && def.rank === 'A' && this.has('ace-sleeve'));
  };

  Duel.prototype._matches = function (id, actor) {
    var def = this.def(id);
    if (this._wildFor(def, actor)) return true;
    var top = this.def(this.top());
    if (top.special) return true;
    return def.suit === top.suit || def.rank === top.rank;
  };

  Duel.prototype.playable = function (actor, id) {
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
    if (ids.length === 1) {
      var single = this.def(ids[0]);
      if (single.id === 'opfer' && hand.length < 3) return { ok: false, reason: 'Opfer braucht 2 weitere Handkarten.' };
      if (!this._matches(ids[0], actor)) return { ok: false, reason: 'Passt nicht: gleiche Farbe oder gleicher Wert.' };
      return { ok: true, order: ids.slice() };
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
    this.root = actor;
    this.noProgress = 0;
    this.triggered = 0;
    this.phase = 'resolving';
    check.order.forEach(function (id) { self._putOnTable(actor, id, 'hand', ev); });
    var single = check.order.length === 1 && this.def(check.order[0]).special;
    if (single && actor === 'player' && this.has('hot-wire') && !this.used['hot-wire']) {
      this.used['hot-wire'] = true;
      this.retain = true;
      ev.push({ t: 'trinket', id: 'hot-wire' });
    }
    this._queueEffects(actor, check.order, false);
    this._resolve(ev);
    return ev;
  };

  Duel.prototype.draw = function (actor) {
    this._requireAction(actor);
    var ev = [];
    var drawn = this._drawInto(actor, 1, 'draw', ev, true);
    this.noProgress = drawn === 0 ? this.noProgress + 1 : 0;
    if (actor === 'player') {
      var floor = this.chainFloor();
      var next = this.has('slow-burner') ? Math.max(floor, Math.ceil(this.chain / 2)) : floor;
      if (next !== this.chain) {
        this.chain = next;
        ev.push({ t: 'chain', chain: this.chain, reset: true });
      }
    }
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
  Duel.prototype._take = function (ev) {
    if (!this.stock.length) {
      if (this.pile.length <= 1) return null;
      var top = this.pile.pop(), self = this;
      this.stock = this.pile.filter(function (id) {
        if (self.cards[id].retired) { self.cards[id].gone = true; return false; }
        return true;
      });
      this.pile = [top];
      this.rng.shuffle(this.stock);
      ev.push({ t: 'reshuffle', count: this.stock.length });
      if (!this.stock.length) return null;
    }
    return this.stock.pop();
  };

  Duel.prototype._drawInto = function (actor, amount, cause, ev, applyCurse) {
    if (applyCurse && this.status.curse[actor] > 0) {
      this.status.curse[actor]--;
      amount += 1;
      ev.push({ t: 'curse', target: actor, left: this.status.curse[actor] });
      ev.push(this._statusEvent());
    }
    var drawn = 0;
    for (var i = 0; i < amount; i++) {
      var id = this._take(ev);
      if (id == null) break;
      this.hand[actor].push(id);
      ev.push({ t: 'move', id: id, from: 'stock', to: actor, cause: cause });
      drawn++;
    }
    if (actor === 'player') this.stats.drawn += drawn;
    return drawn;
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
    var def = this.def(id), event = { t: 'play', id: id, actor: actor, from: from === 'hand' ? actor : 'staging' };
    if (actor === 'player') {
      var points = def.base * this.chain, doubled = false;
      if (def.suit === 'hearts' && this.has('heartblood')) { points *= 2; doubled = true; }
      this.glut += points;
      event.score = { base: def.base, chain: this.chain, points: points, glut: this.glut, doubled: doubled };
      this.chain++;
      if (this.chain > this.maxChain) this.maxChain = this.chain;
      event.score.next = this.chain;
      this.stats.played++;
    }
    ev.push(event);
  };

  /* ---------- Effekte ---------- */
  Duel.prototype._queueEffects = function (actor, ids, front) {
    var self = this, draw = 0, skip = false, rest = [];
    ids.forEach(function (id) {
      var def = self.def(id);
      def.effects.forEach(function (effect) {
        if (effect.type === 'draw') draw += effect.amount;
        else if (effect.type === 'skip') skip = true;
        else rest.push({ type: effect.type, amount: effect.amount || 0, duration: effect.duration || 0, reflectable: !!effect.reflectable, src: actor, card: id });
      });
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
    if (item.reflectable) {
      if (src === 'player' && this.enemy.passive === 'smoke' && !this.used.smoke) {
        this.used.smoke = true;
        ev.push({ t: 'passive', id: 'smoke' });
        ev.push({ t: 'reflect', onto: 'player', effect: item.type });
        src = 'opp'; tgt = 'player';
      } else if (tgt === 'player' && this.has('smoke-mirror') && !this.used['smoke-mirror']) {
        this.used['smoke-mirror'] = true;
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
        if (src === 'player' && this.has('brass-knuckles') && !this.used['brass-knuckles']) {
          this.used['brass-knuckles'] = true;
          amount += 1;
          ev.push({ t: 'trinket', id: 'brass-knuckles' });
        }
        ev.push({ t: 'effect', type: 'draw', src: src, tgt: tgt, amount: amount });
        this._drawInto(tgt, amount, 'effect', ev, true);
        break;
      }
      case 'skip':
        if (tgt === 'player' && this.has('pocket-watch') && !this.used['pocket-watch']) {
          this.used['pocket-watch'] = true;
          ev.push({ t: 'trinket', id: 'pocket-watch' });
          ev.push({ t: 'effect', type: 'skip-blocked', src: src, tgt: tgt });
        } else {
          this.status.skip[tgt] = 1;
          ev.push({ t: 'effect', type: 'skip', src: src, tgt: tgt });
          ev.push(this._statusEvent());
        }
        break;
      case 'spy':
        if (src === 'player') {
          this.status.spy = Math.max(this.status.spy, item.duration);
          ev.push({ t: 'effect', type: 'spy', src: src, tgt: tgt, amount: item.duration });
          ev.push(this._statusEvent());
        } else {
          ev.push({ t: 'effect', type: 'spy-idle', src: src, tgt: tgt });
        }
        break;
      case 'curse':
        this.status.curse[tgt] += item.amount;
        ev.push({ t: 'effect', type: 'curse', src: src, tgt: tgt, amount: item.amount });
        ev.push(this._statusEvent());
        break;
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
          var pool = ZU.SPECIAL_IDS.filter(function (id) { return id !== 'zytokinese_2'; });
          var defs = [];
          for (var i = 0; i < item.amount; i++) defs.push(this.rng.pick(pool));
          defs.forEach(function (d) { self.created.push(d); });
          ev.push({ t: 'created', defs: defs, via: 'zytokinese_2' });
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
          var id = this._take(ev);
          if (id == null) break;
          this.staging.push(id);
          ev.push({ t: 'move', id: id, from: 'stock', to: 'staging', cause: 'gamble', actor: src });
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
    var defId = this.cards[id].def;
    this.created.push(defId);
    ev.push({ t: 'created', defs: [defId], via: 'zytokinese', source: id });
  };

  /* ---------- Zugfolge ---------- */
  Duel.prototype._complete = function (ev) {
    var root = this.root;
    if (!this.hand[root].length) return this._end(root, ev);
    if (!this.hand[other(root)].length) return this._end(other(root), ev);
    this.root = null;
    if (this.retain) {
      this.retain = false;
      this.active = root;
      this.phase = 'action';
      ev.push({ t: 'turn', actor: root, extra: true, left: ZU.TURN_LIMIT - this.turns + 1 });
    } else {
      this._finishTurn(root, ev);
    }
  };

  Duel.prototype._finishTurn = function (actor, ev) {
    if (this.noProgress >= 2) {
      var p = this.hand.player.length, o = this.hand.opp.length;
      ev.push({ t: 'stalemate' });
      return this._end(p < o ? 'player' : 'opp', ev);
    }
    this._beginTurn(other(actor), ev, 0);
  };

  Duel.prototype._beginTurn = function (actor, ev, guard) {
    if (this.status.skip[actor] > 0 && guard < 3) {
      this.status.skip[actor] = 0;
      ev.push({ t: 'skipped', actor: actor });
      ev.push(this._statusEvent());
      return this._beginTurn(other(actor), ev, guard + 1);
    }
    if (this.turns >= ZU.TURN_LIMIT) {
      // Sperrstunde: Wer weniger Karten hält, gewinnt. Gleichstand geht ans Haus.
      ev.push({ t: 'curfew' });
      return this._end(this.hand.player.length < this.hand.opp.length ? 'player' : 'opp', ev);
    }
    this.active = actor;
    this.phase = 'action';
    this.turns++;
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
    ev.push({ t: 'turn', actor: actor, left: ZU.TURN_LIMIT - this.turns + 1 });
  };

  Duel.prototype._end = function (winner, ev) {
    this.winner = winner;
    this.phase = 'ended';
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
      if (def.rank === '7') value += 60 + (theirs <= 3 ? 60 : 0) + (ai === 'pressure' ? 30 : 0);
      return value;
    }
    switch (def.id) {
      case 'stillstand': value += 55 + (theirs <= 2 ? 50 : 0); break;
      case 'addieren': value += 60 + (theirs <= 3 ? 60 : 0) + (ai === 'pressure' ? 30 : 0); break;
      case 'fluch': value += 50 + (ai === 'pressure' ? 40 : 0); break;
      case 'opfer': value += 110; break;
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
    var sees = this.enemy.passive === 'sees-hand' || this.enemy.passive === 'smoke';
    // Kettenlänge der KI: einfache Gegner legen einzeln, Elite Paare, Bosse wachsen mit dem Akt.
    var chainCap = this.kind === 'battle' ? 1 : this.kind === 'elite' ? (this.act >= 2 ? 2 : 1) : Math.min(4, 1 + this.act);
    var chains = chainCap > 1;
    var playerDefs = this.hand.player.map(function (id) { return self.def(id); });

    function follow(def) { // wie viele Spielerkarten könnten direkt anlegen?
      if (def.special) return playerDefs.length;
      var n = 0;
      playerDefs.forEach(function (p) { if (p.special || p.suit === def.suit || p.rank === def.rank) n++; });
      return n;
    }
    function suitCount(suit, exclude) {
      var n = 0;
      hand.forEach(function (id) {
        if (exclude.indexOf(id) < 0 && self.def(id).suit === suit) n++;
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
          var sa = suitCount(self.def(a).suit, group) - (sees ? follow(self.def(a)) : 0);
          var sb = suitCount(self.def(b).suit, group) - (sees ? follow(self.def(b)) : 0);
          return sa - sb;
        });
        order = [id].concat(tail);
      }
      var topDef = self.def(order[order.length - 1]);
      var value = 0;
      order.forEach(function (cid) { value += self._aiValue(cid); });
      value += (order.length - 1) * 35;
      value += suitCount(topDef.suit, group) * 6;
      if (sees) value -= follow(topDef) * 14;
      if (order.length === hand.length) value += 1000; // Sieg
      if (!best || value > best.value) best = { value: value, order: order };
    });
    return best && best.value > -200 ? best.order : null;
  };

  Duel.prototype.aiMove = function () {
    this._requireAction('opp');
    var order = this._aiPlan();
    return order ? this.play('opp', order) : this.draw('opp');
  };

  /* Vorschlag für den Spieler (Tipp-Funktion und Simulationstests). */
  Duel.prototype.suggest = function () {
    var self = this, hand = this.hand.player, best = null;
    hand.forEach(function (id) {
      if (!self.playable('player', id)) return;
      var def = self.def(id), group = [id];
      if (!def.special) {
        hand.forEach(function (o) {
          if (o !== id && !self.def(o).special && self.def(o).rank === def.rank) group.push(o);
        });
      }
      var check = self.canPlay('player', group);
      if (!check.ok) return;
      var value = group.length * 40 + (def.special ? 30 : 0) + (def.rank === '7' ? 50 : 0);
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
    this.stock.forEach(mark('stock'));
    this.pile.forEach(mark('pile'));
    this.staging.forEach(mark('staging'));
    Object.keys(this.cards).forEach(function (id) {
      if (!seen[id] && !self.cards[id].gone) problems.push('Karte ' + id + ' ist verschwunden');
    });
    return problems;
  };

  ZU.Duel = Duel;
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
