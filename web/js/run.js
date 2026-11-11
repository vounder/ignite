/* Zündung – Run-Logik: Akte, Tische, Auszahlung, Belohnungen, Manfreds Laden, Speichern. Ohne DOM. */
(function (ZU) {
  'use strict';

  var SAVE_KEY = 'zuendung.web.run.v1';
  var PROFILE_KEY = 'zuendung.web.profile.v1';

  function storage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }

  function Run(state) {
    this.s = state;
    this.rng = new ZU.Rng(state.rng);
  }

  Run.start = function (starterId, seed) {
    var starter = ZU.STARTERS.filter(function (s) { return s.id === starterId; })[0] || ZU.STARTERS[0];
    var state = {
      v: 1, seed: seed >>> 0, rng: seed >>> 0, starter: starter.id,
      act: 1, table: 0, lives: ZU.MAX_LIVES, money: starter.money, score: 0, nextId: 1,
      collection: [], trinkets: starter.trinkets.slice(), phase: 'select',
      encounters: [], lastBattle: null, lastElite: null, shop: null, reward: null, burnCount: 0, endless: false,
      stats: { duels: 0, wins: 0, losses: 0, bestChain: 1, bestGlut: 0, played: 0, earned: 0 }
    };
    var run = new Run(state);
    var size = starter.size || ZU.HAND_SIZE;
    starter.cards.forEach(function (def) { run._add(def); });
    var pool = run.rng.shuffle(ZU.STANDARD_IDS.filter(function (id) { return starter.cards.indexOf(id) < 0; }));
    while (state.collection.length < size) run._add(pool.pop());
    run._encounters();
    run._sync();
    return run;
  };

  Run.prototype._sync = function () { this.s.rng = this.rng.state; };
  Run.prototype._add = function (def) {
    var card = { id: this.s.nextId++, def: def };
    this.s.collection.push(card);
    return card;
  };
  Run.prototype.has = function (id) { return this.s.trinkets.indexOf(id) >= 0; };
  Run.prototype.encounter = function () { return this.s.encounters[this.s.table]; };
  Run.prototype.actName = function () {
    return this.s.act <= 3 ? ZU.ACT_NAMES[this.s.act - 1] : 'Nachglut ' + ZU.roman(this.s.act - 3);
  };

  Run.prototype._encounters = function () {
    var s = this.s, rng = this.rng;
    var battles = ZU.BATTLE_POOL.filter(function (id) { return id !== s.lastBattle; });
    var elites = ZU.ELITE_POOL.filter(function (id) { return id !== s.lastElite; });
    var battle = rng.pick(battles), elite = rng.pick(elites);
    s.lastBattle = battle;
    s.lastElite = elite;
    s.encounters = [
      { enemy: battle, kind: 'battle' },
      { enemy: elite, kind: 'elite' },
      { enemy: ZU.BOSS_ORDER[(s.act - 1) % ZU.BOSS_ORDER.length], kind: 'boss' }
    ];
  };

  Run.prototype.baseReward = function (kind) {
    var act = this.s.act;
    return kind === 'battle' ? 4 + act : kind === 'elite' ? 6 + act : 8 + 2 * act;
  };

  /* ---------- Duell ---------- */
  Run.prototype.newDuel = function () {
    var e = this.encounter();
    this.s.phase = 'duel';
    return new ZU.Duel({
      rng: this.rng, enemyId: e.enemy, kind: e.kind, act: this.s.act,
      trinkets: this.s.trinkets, collection: this.s.collection.map(function (c) { return { id: c.id, def: c.def }; }),
      nextId: this.s.nextId
    });
  };

  /* Wertet ein beendetes Duell aus. Liefert die Zeilen der Auszahlung bzw. die Folgen der Niederlage. */
  Run.prototype.finishDuel = function (duel) {
    var s = this.s, self = this, e = this.encounter();
    s.nextId = Math.max(s.nextId, duel.nextId);
    s.stats.duels++;
    s.stats.played += duel.stats.played;
    s.stats.bestChain = Math.max(s.stats.bestChain, duel.maxChain);
    s.stats.bestGlut = Math.max(s.stats.bestGlut, duel.glut);

    if (duel.winner !== 'player') {
      s.stats.losses++;
      var saved = false;
      if (s.lives === 1 && this.has('golden-match')) {
        s.trinkets.splice(s.trinkets.indexOf('golden-match'), 1);
        saved = true;
      } else {
        s.lives--;
      }
      s.phase = s.lives <= 0 ? 'defeat' : 'select';
      this._sync();
      if (s.phase === 'defeat') this._closeRun(false); else this.save();
      return { won: false, saved: saved, lives: s.lives };
    }

    s.stats.wins++;
    duel.retired.forEach(function (id) {
      for (var i = 0; i < s.collection.length; i++) {
        if (s.collection[i].id === id) { s.collection.splice(i, 1); break; }
      }
    });
    duel.created.forEach(function (def) { self._add(def); });

    var lines = [], base = this.baseReward(e.kind);
    lines.push({ label: ZU.KIND_LABEL[e.kind] + 'prämie', amount: base });
    if (duel.bank > 0) lines.push({ label: 'Bank', amount: duel.bank });
    if (duel.bonusMult > 1) lines.push({ label: 'Bonusgeld ×' + duel.bonusMult, amount: (base + duel.bank) * (duel.bonusMult - 1) });
    var left = Math.min(5, duel.hand.opp.length);
    if (left > 0) lines.push({ label: 'Restkarten des Gegners (' + duel.hand.opp.length + ')', amount: left });
    var heat = Math.min(6, Math.floor(duel.glut / 150));
    if (heat > 0) lines.push({ label: 'Glut-Bonus (' + duel.glut + ')', amount: heat });
    if (this.has('lucky-chip')) lines.push({ label: 'Glückschip', amount: 2, trinket: 'lucky-chip' });
    var cap = this.has('ledger') ? 6 : 3;
    var interest = Math.min(cap, Math.floor(s.money / 5));
    if (interest > 0) lines.push({ label: 'Zinsen (1 je 5 Mark, max. ' + cap + ')', amount: interest });

    var total = 0;
    lines.forEach(function (line) { total += line.amount; });
    s.money += total;
    s.stats.earned += total;
    s.score += duel.glut + 100 * s.act;

    var healed = false;
    if (e.kind === 'boss' && s.lives < ZU.MAX_LIVES) { s.lives++; healed = true; }
    s.reward = null;
    if (e.kind === 'elite') {
      var owned = s.trinkets;
      var options = this._weighted(ZU.TRINKET_IDS.filter(function (id) { return owned.indexOf(id) < 0; }),
        function (id) { return [50, 32, 16, 4][ZU.TRINKETS[id].rarity]; }, 3);
      if (options.length) s.reward = { type: 'trinket', options: options, skip: 4 };
    } else if (e.kind === 'boss') {
      var specials = this._weighted(ZU.SPECIAL_IDS.filter(function (id) { return ZU.CARDS[id].rarity >= 1; }),
        function (id) { return [0, 40, 40, 14][ZU.CARDS[id].rarity]; }, 3);
      s.reward = { type: 'card', options: specials, skip: 5 };
    }
    s.phase = 'payout';
    this._sync();
    return { won: true, lines: lines, total: total, healed: healed, glut: duel.glut, maxChain: duel.maxChain };
  };

  Run.prototype._weighted = function (ids, weight, count) {
    var pool = ids.slice(), out = [];
    while (out.length < count && pool.length) {
      var total = 0, i;
      for (i = 0; i < pool.length; i++) total += weight(pool[i]);
      if (total <= 0) break;
      var roll = this.rng.next() * total;
      for (i = 0; i < pool.length; i++) {
        roll -= weight(pool[i]);
        if (roll < 0) break;
      }
      out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
    }
    return out;
  };

  /* Nach der Auszahlung: Sieg über den dritten Boss, Belohnung oder Laden. */
  Run.prototype.afterPayout = function () {
    var s = this.s, e = this.encounter();
    if (e.kind === 'boss' && s.act === 3 && !s.endless) {
      s.phase = 'victory';
      this._closeRun(true, true);
    } else if (s.reward) {
      s.phase = 'reward';
    } else {
      this._openShop();
    }
    this._sync();
    this.save();
    return s.phase;
  };

  Run.prototype.continueEndless = function () {
    var s = this.s;
    s.endless = true;
    if (s.reward) s.phase = 'reward'; else this._openShop();
    this._sync();
    this.save();
    return s.phase;
  };

  Run.prototype.chooseReward = function (index, replaceTrinket) {
    var s = this.s, r = s.reward;
    if (!r) throw new Error('Keine Belohnung offen.');
    if (index == null) {
      s.money += r.skip;
    } else if (r.type === 'trinket') {
      this._gainTrinket(r.options[index], replaceTrinket);
    } else {
      this._add(r.options[index]);
    }
    s.reward = null;
    this._openShop();
    this._sync();
    this.save();
  };

  Run.prototype._gainTrinket = function (id, replace) {
    var s = this.s;
    if (s.trinkets.indexOf(id) >= 0) throw new Error('Trinket bereits vorhanden.');
    if (s.trinkets.length >= ZU.MAX_TRINKETS) {
      var index = s.trinkets.indexOf(replace);
      if (index < 0) throw new Error('Wähle ein Trinket zum Ersetzen.');
      s.trinkets.splice(index, 1);
    }
    s.trinkets.push(id);
  };

  /* ---------- Laden ---------- */
  Run.prototype._openShop = function () {
    this.s.shop = { cards: [], trinkets: [], rerolls: 0, discount: this.has('false-bottom'), healed: false };
    this._stockShop();
    this.s.phase = 'shop';
  };

  Run.prototype._stockShop = function () {
    var s = this.s, shop = s.shop, rng = this.rng, act = Math.min(s.act, 4);
    shop.cards = [];
    var specialChance = Math.min(0.85, 0.5 + 0.1 * act);
    var used = [];
    for (var i = 0; i < 3; i++) {
      var def;
      if (rng.next() < specialChance) {
        def = this._weighted(ZU.SPECIAL_IDS.filter(function (id) { return used.indexOf(id) < 0; }),
          function (id) { return [50, 30, 14 + 3 * act, 2 + act][ZU.CARDS[id].rarity]; }, 1)[0];
      } else {
        def = rng.pick(ZU.STANDARD_IDS.filter(function (id) { return used.indexOf(id) < 0; }));
      }
      used.push(def);
      shop.cards.push({ def: def, price: ZU.CARDS[def].price, sold: false });
    }
    var owned = s.trinkets;
    shop.trinkets = this._weighted(ZU.TRINKET_IDS.filter(function (id) { return owned.indexOf(id) < 0; }),
      function (id) { return [50, 30, 15, 5][ZU.TRINKETS[id].rarity]; }, 2)
      .map(function (id) { return { id: id, price: ZU.TRINKETS[id].price, sold: false }; });
  };

  Run.prototype.cardPrice = function (index) {
    var offer = this.s.shop.cards[index];
    return Math.max(0, offer.price - (this.s.shop.discount ? 2 : 0));
  };
  Run.prototype.rerollPrice = function () { return 3 + this.s.shop.rerolls; };
  Run.prototype.burnPrice = function () { return 3 + this.s.burnCount; };
  Run.prototype.healPrice = function () { return 6 + 2 * Math.min(this.s.act - 1, 3); };
  Run.prototype.sellValue = function (id) { return Math.floor(ZU.TRINKETS[id].price / 2); };

  Run.prototype._pay = function (amount) {
    if (this.s.money < amount) throw new Error('Nicht genug Mark.');
    this.s.money -= amount;
  };

  Run.prototype.buyCard = function (index) {
    var offer = this.s.shop.cards[index];
    if (!offer || offer.sold) throw new Error('Nicht verfügbar.');
    this._pay(this.cardPrice(index));
    this.s.shop.discount = false;
    offer.sold = true;
    var card = this._add(offer.def);
    this.save();
    return card;
  };

  Run.prototype.buyTrinket = function (index, replace) {
    var offer = this.s.shop.trinkets[index];
    if (!offer || offer.sold) throw new Error('Nicht verfügbar.');
    if (this.s.money < offer.price) throw new Error('Nicht genug Mark.');
    this._gainTrinket(offer.id, replace);
    this._pay(offer.price);
    offer.sold = true;
    this.save();
  };

  Run.prototype.sellTrinket = function (id) {
    var index = this.s.trinkets.indexOf(id);
    if (index < 0) throw new Error('Trinket nicht vorhanden.');
    this.s.trinkets.splice(index, 1);
    this.s.money += this.sellValue(id);
    this.save();
  };

  Run.prototype.reroll = function () {
    this._pay(this.rerollPrice());
    this.s.shop.rerolls++;
    this._stockShop();
    this._sync();
    this.save();
  };

  Run.prototype.burn = function (cardId) {
    var s = this.s;
    if (s.collection.length <= 1) throw new Error('Deine letzte Karte bleibt.');
    for (var i = 0; i < s.collection.length; i++) {
      if (s.collection[i].id === cardId) {
        this._pay(this.burnPrice());
        s.burnCount++;
        var gone = s.collection.splice(i, 1)[0];
        this.save();
        return gone;
      }
    }
    throw new Error('Karte nicht im Deck.');
  };

  Run.prototype.heal = function () {
    var s = this.s;
    if (s.shop.healed) throw new Error('Heute schon nachgekauft.');
    if (s.lives >= ZU.MAX_LIVES) throw new Error('Die Schachtel ist voll.');
    this._pay(this.healPrice());
    s.lives++;
    s.shop.healed = true;
    this.save();
  };

  Run.prototype.leaveShop = function () {
    var s = this.s;
    s.shop = null;
    s.table++;
    if (s.table > 2) {
      s.table = 0;
      s.act++;
      this._encounters();
    }
    s.phase = 'select';
    this._sync();
    this.save();
  };

  /* ---------- Speichern ---------- */
  Run.prototype.save = function () {
    var store = storage();
    if (!store) return;
    this._sync();
    try { store.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) { /* voller Speicher: Spiel läuft weiter */ }
  };

  Run.load = function () {
    var store = storage();
    if (!store) return null;
    try {
      var raw = store.getItem(SAVE_KEY);
      if (!raw) return null;
      var state = JSON.parse(raw);
      if (!state || state.v !== 1 || !Array.isArray(state.collection) || !state.encounters) return null;
      if (state.phase === 'duel' || state.phase === 'payout') state.phase = 'select';
      if (state.phase === 'defeat') return null;
      var bad = state.collection.some(function (c) { return !ZU.CARDS[c.def]; }) ||
        state.trinkets.some(function (id) { return !ZU.TRINKETS[id]; }) ||
        state.encounters.some(function (e) { return !ZU.ENEMIES[e.enemy]; });
      return bad ? null : new Run(state);
    } catch (e) {
      return null;
    }
  };

  Run.clearSave = function () {
    var store = storage();
    if (store) { try { store.removeItem(SAVE_KEY); } catch (e) { /* egal */ } }
  };

  Run.prototype._closeRun = function (won, keepSave) {
    var profile = ZU.Profile.load();
    if (!this.s.endless) profile.runs++;
    if (won) profile.wins++;
    profile.best = Math.max(profile.best, this.s.score);
    profile.bestAct = Math.max(profile.bestAct, this.s.act);
    ZU.Profile.save(profile);
    if (!keepSave) Run.clearSave();
  };

  /* Wird beim Ende eines Nachglut-Laufs aufgerufen, damit der Rekord zählt. */
  Run.prototype.recordScore = function () {
    var profile = ZU.Profile.load();
    profile.best = Math.max(profile.best, this.s.score);
    profile.bestAct = Math.max(profile.bestAct, this.s.act);
    ZU.Profile.save(profile);
  };

  ZU.Profile = {
    defaults: function () {
      return { runs: 0, wins: 0, best: 0, bestAct: 0, seenHelp: false, settings: { music: 0.5, sfx: 0.7, speed: 1, crt: true } };
    },
    load: function () {
      var base = ZU.Profile.defaults(), store = storage();
      if (!store) return ZU.Profile._memory || (ZU.Profile._memory = base);
      try {
        var data = JSON.parse(store.getItem(PROFILE_KEY) || 'null');
        if (!data) return base;
        Object.keys(base).forEach(function (key) {
          if (key === 'settings') {
            Object.keys(base.settings).forEach(function (k) {
              if (data.settings && typeof data.settings[k] === typeof base.settings[k]) base.settings[k] = data.settings[k];
            });
          } else if (typeof data[key] === typeof base[key]) {
            base[key] = data[key];
          }
        });
      } catch (e) { /* Standardwerte */ }
      return base;
    },
    save: function (profile) {
      var store = storage();
      if (!store) { ZU.Profile._memory = profile; return; }
      try { store.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch (e) { /* egal */ }
    }
  };

  ZU.Run = Run;
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
