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

  /* Ohne Meta-Angaben (Tests, alte Spielstände) ist alles frei und nichts erschwert. */
  var NO_META = { stake: 0, startgeld: 0, freeReroll: false, shopBonus: 0, maxLives: ZU.MAX_LIVES, trinkets: null, specials: null };

  /* meta: Ergebnis von ZU.Meta.runOptions() – Einsatz, Upgrades und freigeschaltete Inhalte. */
  Run.start = function (starterId, seed, meta) {
    meta = meta || NO_META;
    var starter = ZU.STARTERS.filter(function (s) { return s.id === starterId; })[0] || ZU.STARTERS[0];
    var state = {
      v: 1, seed: seed >>> 0, rng: seed >>> 0, starter: starter.id,
      act: 1, table: 0, lives: meta.maxLives, money: starter.money + meta.startgeld, score: 0, nextId: 1,
      meta: meta, ash: 0, ashPaid: 0,
      collection: [], trinkets: starter.trinkets.slice(), perks: (starter.perks || []).slice(), perkOffer: null, bonusLives: 0, phase: 'select',
      encounters: [], seen: [], shop: null, reward: null, burnCount: 0, endless: false,
      stats: { duels: 0, wins: 0, losses: 0, bestChain: 1, bestGlut: 0, played: 0, earned: 0 }
    };
    var run = new Run(state);
    var size = starter.size || ZU.HAND_SIZE;
    // Start-Spezialkarten sind an ein zufälliges Symbol gebunden.
    starter.cards.forEach(function (def) { run._add(def, run.rng.pick(ZU.SUIT_ORDER)); });
    var pool = run.rng.shuffle(ZU.STANDARD_IDS.filter(function (id) { return starter.cards.indexOf(id) < 0; }));
    while (state.collection.length < size) run._add(pool.pop());
    run._encounters();
    run._sync();
    return run;
  };

  Run.prototype._sync = function () { this.s.rng = this.rng.state; };
  Run.prototype._add = function (def, bind) {
    var card = { id: this.s.nextId++, def: def };
    if (ZU.CARDS[def].special) card.bind = bind || 'wild';
    this.s.collection.push(card);
    return card;
  };
  Run.prototype.has = function (id) { return this.s.trinkets.indexOf(id) >= 0 || (this.s.perks || []).indexOf(id) >= 0; };
  Run.prototype.meta = function () { return this.s.meta || NO_META; };
  Run.prototype.maxLives = function () { return (this.meta().maxLives || ZU.MAX_LIVES) + (this.s.bonusLives || 0); };
  /* Trinkets und Spezialkarten, die in diesem Run auftauchen können. */
  Run.prototype._trinketPool = function () {
    var owned = this.s.trinkets;
    return (this.meta().trinkets || ZU.TRINKET_IDS).filter(function (id) { return ZU.TRINKETS[id] && owned.indexOf(id) < 0; });
  };
  Run.prototype._specialPool = function () {
    return (this.meta().specials || ZU.SPECIAL_IDS).filter(function (id) { return ZU.CARDS[id] && ZU.CARDS[id].special; });
  };
  /* Einsatz „Teures Pflaster": 20 % Aufschlag im Laden. */
  Run.prototype._price = function (price) { return this.meta().stake >= 3 ? Math.ceil(price * 1.2) : price; };
  Run.prototype.encounter = function () { return this.s.encounters[this.s.table]; };
  Run.prototype.actName = function () {
    return this.s.act <= 3 ? ZU.ACT_NAMES[this.s.act - 1] : 'Nachglut ' + ZU.roman(this.s.act - 3);
  };

  /* Zieht je Akt einen Tisch, eine Elite und einen Boss – möglichst ohne Wiederholungen im Run. */
  Run.prototype._encounters = function () {
    var s = this.s, rng = this.rng;
    s.seen = s.seen || [];
    function fresh(pool) {
      var open = pool.filter(function (id) { return s.seen.indexOf(id) < 0; });
      if (!open.length) {
        s.seen = s.seen.filter(function (id) { return pool.indexOf(id) < 0; });
        open = pool.slice();
      }
      var pick = rng.pick(open);
      s.seen.push(pick);
      return pick;
    }
    var bosses = s.act <= ZU.BOSS_ACTS.length ? ZU.BOSS_ACTS[s.act - 1] : [].concat.apply([], ZU.BOSS_ACTS);
    s.encounters = [
      { enemy: fresh(ZU.BATTLE_POOL), kind: 'battle' },
      { enemy: fresh(ZU.ELITE_POOL), kind: 'elite' },
      { enemy: fresh(bosses), kind: 'boss' }
    ];
    // Hausregeln: am allerersten Tisch nie, danach mit jedem Akt häufiger.
    s.encounters.forEach(function (encounter, index) {
      encounter.rules = [];
      if (s.act === 1 && index === 0) return;
      Object.keys(ZU.RULE_CHANCE).forEach(function (rule) {
        var chances = ZU.RULE_CHANCE[rule];
        var bonus = (s.meta && s.meta.stake >= 1) ? 0.2 : 0; // Einsatz „Erhöhter Einsatz"
        if (rng.next() < chances[Math.min(chances.length, s.act) - 1] + bonus) encounter.rules.push(rule);
      });
    });
  };

  Run.prototype.baseReward = function (kind) {
    var act = this.s.act;
    var base = (kind === 'battle' ? 4 + act : kind === 'elite' ? 6 + act : 8 + 2 * act) + (this.has('regular') ? 2 : 0);
    return this.meta().stake >= 4 ? Math.max(2, base - 2) : base; // Einsatz „Knappe Kasse"
  };

  /* ---------- Duell ---------- */
  Run.prototype.newDuel = function () {
    var e = this.encounter();
    this.s.phase = 'duel';
    return new ZU.Duel({
      rng: this.rng, enemyId: e.enemy, kind: e.kind, act: this.s.act,
      rules: e.rules || [],
      perks: this.s.perks || [],
      mods: { hesitation: this.meta().stake >= 2 ? 0.5 : 1, oppHand: this.meta().stake >= 5 ? -1 : 0 },
      specialPool: this.meta().specials,
      trinkets: this.s.trinkets, collection: this.s.collection.map(function (c) { return { id: c.id, def: c.def, bind: c.bind }; }),
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
    duel.created.forEach(function (card) { self._add(card.def, card.bind); });

    var lines = [], base = this.baseReward(e.kind);
    lines.push({ label: ZU.KIND_LABEL[e.kind] + 'prämie', amount: base });
    if (duel.bank > 0) lines.push({ label: 'Bank', amount: duel.bank });
    if (duel.bonusMult > 1) lines.push({ label: 'Bonusgeld ×' + duel.bonusMult, amount: (base + duel.bank) * (duel.bonusMult - 1) });
    var left = Math.min(this.has('gold-tooth') ? 10 : 5, duel.hand.opp.length);
    if (left > 0) lines.push({ label: 'Restkarten des Gegners (' + duel.hand.opp.length + ')', amount: left });
    var heat = this.has('furnace') ? Math.min(20, Math.floor(duel.glut / 150)) : Math.min(8, Math.floor(duel.glut / 250));
    if (heat > 0) lines.push({ label: 'Glut-Bonus (' + duel.glut + ')', amount: heat });
    if (duel.enemy.passive === 'odds') lines.push({ label: 'Wettschein', amount: 3 });
    if (this.has('lucky-chip')) lines.push({ label: 'Glückschip', amount: 2, trinket: 'lucky-chip' });
    var cap = this.has('ledger') ? 6 : 3;
    var step = this.has('compound') ? 4 : 5;
    var interest = Math.min(cap, Math.floor(s.money / step));
    if (interest > 0) lines.push({ label: 'Zinsen (1 je ' + step + ' Mark, max. ' + cap + ')', amount: interest });

    var total = 0;
    lines.forEach(function (line) { total += line.amount; });
    s.money += total;
    s.stats.earned += total;
    s.score += duel.glut + 100 * s.act;

    var healed = false;
    if (e.kind === 'boss' && s.lives < this.maxLives()) { s.lives++; healed = true; }
    s.ash = (s.ash || 0) + ZU.Meta.ASH[e.kind];
    ZU.Meta.noteDefeat(e.enemy);
    s.reward = null;
    if (e.kind === 'elite') {
      var owned = s.trinkets;
      var options = this._weighted(this._trinketPool(),
        function (id) { return [50, 32, 16, 4][ZU.TRINKETS[id].rarity]; }, 3);
      if (options.length) s.reward = { type: 'trinket', options: options, skip: 4 };
    } else if (e.kind === 'boss') {
      var specials = this._weighted(this._specialPool().filter(function (id) { return ZU.CARDS[id].rarity >= 1; }),
        function (id) { return [0, 40, 40, 14][ZU.CARDS[id].rarity]; }, 3);
      // Boss-Beute ist freier gebunden als das, was der Akt sonst hergibt.
      var rng = this.rng, ahead = s.act + 1;
      if (specials.length) s.reward = { type: 'card', options: specials, binds: specials.map(function () { return ZU.rollBind(rng, ahead); }), skip: 5 };
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
      s.ash = (s.ash || 0) + ZU.Meta.ASH.victory;
      s.newStake = ZU.Meta.noteVictory(this);
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
      this._add(r.options[index], r.binds ? r.binds[index] : 'wild');
    }
    s.reward = null;
    this._openShop();
    this._sync();
    this.save();
  };

  /* Trinkets sind nicht mehr begrenzt; im Laden wird dafür jedes weitere teurer. */
  Run.prototype._gainTrinket = function (id) {
    var s = this.s;
    if (!ZU.TRINKETS[id]) throw new Error('Unbekanntes Trinket.');
    if (s.trinkets.indexOf(id) >= 0) throw new Error('Trinket bereits vorhanden.');
    s.trinkets.push(id);
  };

  /* ---------- Laden ---------- */
  Run.prototype._openShop = function () {
    this.s.shop = { cards: [], specials: [], trinkets: [], rerolls: 0, discount: this.has('false-bottom'), healed: false };
    if (!this.s.perkOffer || this.s.perkOffer.act !== this.s.act) this._rollPerk();
    this._stockShop();
    this.s.phase = 'shop';
  };

  /* Privileg des Akts: wird nur einmal je Akt gewürfelt und bleibt in allen Läden dieses Akts stehen. */
  Run.prototype._rollPerk = function () {
    var s = this.s;
    s.perks = s.perks || [];
    var open = ZU.PERK_IDS.filter(function (id) { return s.perks.indexOf(id) < 0; });
    if (!open.length) { s.perkOffer = { id: null, price: 0, sold: true, act: s.act }; return; }
    var id = s.act === 1 && open.indexOf('nimble-fingers') >= 0 ? 'nimble-fingers' : this.rng.pick(open);
    s.perkOffer = { id: id, price: this._price(ZU.PERKS[id].price), sold: false, act: s.act };
  };

  Run.prototype.buyPerk = function () {
    var s = this.s, offer = s.perkOffer;
    if (!offer || offer.sold || !offer.id) throw new Error('Nicht verfügbar.');
    this._pay(offer.price);
    offer.sold = true;
    s.perks.push(offer.id);
    if (offer.id === 'matchbook') {
      s.bonusLives = (s.bonusLives || 0) + 1;
      s.lives++;
    }
    this.save();
    return offer.id;
  };

  /* Wahrscheinlichkeit je Platz, dass im Spezialkarten-Regal etwas liegt. Im ersten Laden fast nie. */
  Run.prototype.specialChance = function () {
    var s = this.s;
    if (s.stats.wins <= 1) return 0.15 + this.meta().shopBonus;
    return [0.35, 0.6, 0.8, 0.9][Math.min(4, s.act) - 1] + this.meta().shopBonus;
  };

  Run.prototype._stockShop = function () {
    var s = this.s, shop = s.shop, rng = this.rng, act = Math.min(s.act, 4), self = this;
    // Regal 1: drei normale Karten
    var pool = rng.shuffle(ZU.STANDARD_IDS.slice());
    shop.cards = pool.slice(0, 3).map(function (def) { return { def: def, price: self._price(ZU.cardPrice(def)), sold: false }; });
    // Regal 2: bis zu zwei Spezialkarten – selten, teuer, mit der Zeit freier gebunden
    shop.specials = [];
    var chance = this.specialChance(), used = [];
    for (var i = 0; i < (this.has('shelf') ? 3 : 2); i++) {
      if (rng.next() >= chance) continue;
      var def = this._weighted(this._specialPool().filter(function (id) { return used.indexOf(id) < 0; }),
        function (id) { return [50, 30, 14 + 3 * act, 2 + act][ZU.CARDS[id].rarity]; }, 1)[0];
      if (!def) continue;
      var bind = ZU.rollBind(rng, s.act);
      if (ZU.SUITS[bind] && this.has('grinder')) bind = ZU.SUITS[bind].red ? 'red' : 'black';
      used.push(def);
      shop.specials.push({ def: def, bind: bind, price: this._price(ZU.cardPrice(def, bind)), sold: false });
    }
    var picks = this._weighted(this._trinketPool(),
      function (id) { return [50, 30, 15, 5][ZU.TRINKETS[id].rarity]; }, this.has('showcase') ? 3 : 2);
    shop.trinkets = picks.map(function (id) { return { id: id, price: self._price(ZU.TRINKETS[id].price), sold: false }; });
  };

  /* shelf: 'cards' oder 'specials'. Der Doppelboden-Rabatt gilt für den ersten Kartenkauf, egal aus welchem Regal. */
  Run.prototype.offerPrice = function (shelf, index) {
    var offer = this.s.shop[shelf][index];
    var off = (this.s.shop.discount ? 2 : 0) + (shelf === 'specials' && this.has('counterfeit') ? 3 : 0);
    return Math.max(1, offer.price - off);
  };
  Run.prototype.cardPrice = function (index) { return this.offerPrice('cards', index); };
  Run.prototype.rerollPrice = function () {
    if (this.meta().freeReroll && this.s.shop.rerolls === 0) return 0; // Upgrade „Stammkunde"
    if (this.has('bell')) return 2;
    return 3 + this.s.shop.rerolls - (this.meta().freeReroll ? 1 : 0);
  };
  Run.prototype.burnPrice = function () { return this.has('ashbin') ? 2 : 3 + this.s.burnCount; };
  Run.prototype.healPrice = function () { return 6 + 2 * Math.min(this.s.act - 1, 3); };
  Run.prototype.sellValue = function (id) { return Math.floor(ZU.TRINKETS[id].price / 2); };

  Run.prototype._pay = function (amount) {
    if (this.s.money < amount) throw new Error('Nicht genug Mark.');
    this.s.money -= amount;
  };

  Run.prototype.buyOffer = function (shelf, index) {
    var offer = (this.s.shop[shelf] || [])[index];
    if (!offer || offer.sold) throw new Error('Nicht verfügbar.');
    this._pay(this.offerPrice(shelf, index));
    this.s.shop.discount = false;
    offer.sold = true;
    var card = this._add(offer.def, offer.bind);
    this.save();
    return card;
  };
  Run.prototype.buyCard = function (index) { return this.buyOffer('cards', index); };
  Run.prototype.buySpecial = function (index) { return this.buyOffer('specials', index); };

  /* Preis eines Trinket-Angebots: Grundpreis plus Aufschlag je getragenem Trinket, abzüglich Stempelkarte. */
  Run.prototype.trinketPrice = function (index) {
    var offer = this.s.shop.trinkets[index];
    return Math.max(1, offer.price + ZU.TRINKET_SURCHARGE * this.s.trinkets.length - (this.has('loyalty') ? 4 : 0));
  };

  Run.prototype.buyTrinket = function (index) {
    var offer = this.s.shop.trinkets[index];
    if (!offer || offer.sold) throw new Error('Nicht verfügbar.');
    var price = this.trinketPrice(index);
    if (this.s.money < price) throw new Error('Nicht genug Mark.');
    this._gainTrinket(offer.id);
    this._pay(price);
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
    if (s.lives >= this.maxLives()) throw new Error('Die Schachtel ist voll.');
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
      if (state.shop && !state.shop.specials) state.shop.specials = []; // Spielstände vor dem geteilten Laden
      // Spielstände vor den Privilegien: „Flinke Finger" war ein Trinket.
      state.perks = state.perks || [];
      var legacy = state.trinkets.indexOf('nimble-fingers');
      if (legacy >= 0) {
        state.trinkets.splice(legacy, 1);
        if (state.perks.indexOf('nimble-fingers') < 0) state.perks.push('nimble-fingers');
      }
      if (state.shop) state.shop.trinkets = state.shop.trinkets.filter(function (offer) { return ZU.TRINKETS[offer.id]; });
      if (state.reward && state.reward.type === 'trinket') {
        state.reward.options = state.reward.options.filter(function (id) { return ZU.TRINKETS[id]; });
        if (!state.reward.options.length) state.reward = null;
      }
      if (state.meta && state.meta.trinkets) state.meta.trinkets = state.meta.trinkets.filter(function (id) { return ZU.TRINKETS[id]; });
      var bad = state.collection.some(function (c) { return !ZU.CARDS[c.def]; }) ||
        state.trinkets.some(function (id) { return !ZU.TRINKETS[id]; }) ||
        state.perks.some(function (id) { return !ZU.PERKS[id]; }) ||
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
    ZU.Meta.award(this);
    if (!keepSave) Run.clearSave();
  };

  /* Wird beim Ende eines Nachglut-Laufs aufgerufen, damit der Rekord zählt. */
  Run.prototype.recordScore = function () {
    var profile = ZU.Profile.load();
    profile.best = Math.max(profile.best, this.s.score);
    profile.bestAct = Math.max(profile.bestAct, this.s.act);
    ZU.Profile.save(profile);
    ZU.Meta.award(this);
  };

  ZU.Profile = {
    defaults: function () {
      return { runs: 0, wins: 0, best: 0, bestAct: 0, seenHelp: false, meta: {}, settings: { music: 0.5, sfx: 0.7, speed: 1, crt: true, fullscreen: 'ask' } };
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
