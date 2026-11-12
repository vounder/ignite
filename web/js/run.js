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
  var NO_META = {
    stake: 0, cv: ZU.CASINO_VERSION, acts: 3, rules: [], ashMult: 1, startgeld: 0, freeReroll: false, shopBonus: 0, maxLives: ZU.MAX_LIVES, trinkets: null, specials: null,
    seals: null, esmePacks: 3, specialSlots: 99, interest: 0, trinketOffers: 0, perkDiscount: 0, bossTip: 0, burnDiscount: 0, luckyTrinket: false, kniffTier: 9, kniffSlots: 2, startKniff: false
  };

  /* meta: Ergebnis von ZU.Meta.runOptions() – Einsatz, Upgrades und freigeschaltete Inhalte. */
  Run.start = function (starterId, seed, meta) {
    meta = meta || NO_META;
    var starter = ZU.STARTERS.filter(function (s) { return s.id === starterId; })[0] || ZU.STARTERS[0];
    var state = {
      v: 1, seed: seed >>> 0, rng: seed >>> 0, starter: starter.id,
      act: 1, table: 0, lives: meta.maxLives, money: starter.money + meta.startgeld, score: 0, nextId: 1,
      meta: meta, ash: 0, ashPaid: 0,
      collection: [], trinkets: starter.trinkets.slice(), perks: (starter.perks || []).slice(), perkOffer: null, kniffe: (starter.kniffe || []).map(function (k) { return { id: k.id, level: k.level }; }), bonusLives: 0, phase: 'select',
      encounters: [], seen: [], shop: null, reward: null, burnCount: 0, endless: false,
      stats: { duels: 0, wins: 0, losses: 0, bestChain: 1, bestGlut: 0, played: 0, earned: 0 }
    };
    var run = new Run(state);
    // Startdeck: 16 normale Karten (feste der Schachtel, der Rest zufällig) plus Spezialkarten.
    // Die sind an ein zufälliges Symbol gebunden; "special" heißt: eine zufällige gewöhnliche aus dem freien Bestand.
    var fixed = starter.cards.filter(function (def) { return !ZU.CARDS[def].special; });
    var pool = run.rng.shuffle(ZU.STANDARD_IDS.filter(function (id) { return fixed.indexOf(id) < 0; }));
    fixed.forEach(function (def) { run._add(def); });
    while (state.collection.length < ZU.DECK_SIZE) run._add(pool.pop());
    starter.cards.filter(function (def) { return ZU.CARDS[def].special; }).forEach(function (def) { run._add(def, run.rng.pick(ZU.SUIT_ORDER)); });
    if (starter.special) {
      var commons = run._specialPool().filter(function (id) { return ZU.CARDS[id].rarity === 0; });
      run._add(run.rng.pick(commons.length ? commons : ['stillstand']), run.rng.pick(ZU.SUIT_ORDER));
    }
    if (meta.startKniff && !state.kniffe.length) {
      // Upgrade „Kniff im Ärmel": ein zufälliger enger Kniff zum Start
      var narrow = run.kniffPool().filter(function (id) { return ZU.KNIFFE[id].tier === 0; });
      if (narrow.length) { var kid = run.rng.pick(narrow); state.kniffe.push({ id: kid, level: ZU.KNIFFE[kid].start }); }
    }
    if (meta.luckyTrinket) {
      // Upgrade „Glücksbringer": ein zufälliges gewöhnliches Trinket zum Start
      var commons = run._trinketPool().filter(function (id) { return ZU.TRINKETS[id].rarity === 0; });
      if (commons.length) state.trinkets.push(run.rng.pick(commons));
    }
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
  /* Casino dieses Runs: Zahl der Akte, Hausordnung (gilt an jedem Tisch) und Räume. */
  Run.prototype.casino = function () { return ZU.CASINOS[this.meta().stake || 0] || ZU.CASINOS[0]; };
  /* Musik des Hauses: jedes Casino hat sein Stück, gegen den Boss in der dichteren Stufe. */
  Run.prototype.music = function (boss) { return 'game-' + this.casino().id + (boss ? '-boss' : ''); };
  Run.prototype.acts = function () { return this.meta().acts || 3; };
  Run.prototype.houseRules = function () { return this.meta().rules || []; };
  Run.prototype.rule = function (id) { return this.houseRules().indexOf(id) >= 0; };
  /* Spezialkarten sind begrenzt: so viele fasst das Deck, so viele liegen drin. */
  Run.prototype.specialSlots = function () {
    return (this.meta().specialSlots || 99) + (this.has('kartenetui') ? 1 : 0);
  };
  Run.prototype.specialCount = function () {
    return this.s.collection.filter(function (c) { return ZU.CARDS[c.def].special; }).length;
  };
  Run.prototype.specialFree = function () { return this.specialCount() < this.specialSlots(); };
  /* Hausregel „Teures Pflaster": 20 % Aufschlag im Laden. */
  /* Mit jedem Akt wachsen Prämien und Preise – so behalten Prozent-Effekte über den ganzen Run ihren Wert. */
  Run.prototype.scale = function () { return 1 + ZU.ACT_GROWTH * (this.s.act - 1); };
  Run.prototype._price = function (price) { return Math.max(1, Math.round(price * this.scale() * (this.rule('markup') ? 1.2 : 1))); };
  /* Glutziel eines Tisches: wächst steil mit dem Akt und mit dem Casino. */
  Run.prototype.glutTarget = function (kind) {
    var g = ZU.GLUT_TARGET, raw = g[kind] * Math.pow(g.perAct, this.s.act - 1) * (1 + g.perCasino * (this.meta().legacy ? 0 : this.meta().stake || 0));
    if (this.has('zuenglein')) raw *= 0.9;
    var step = raw < 1000 ? 10 : raw < 10000 ? 50 : raw < 100000 ? 500 : 5000;
    return Math.round(raw / step) * step;
  };
  /* Löschmittel eines Tisches: Akt 1 bleibt für Tische frei, Bosse haben immer die Löschdecke. Fest je Gegner und Akt. */
  Run.prototype.douse = function (enc) {
    var act = this.s.act, n = act, id = enc.enemy;
    for (var i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) % 9973;
    if (enc.kind === 'boss') return act >= 3 ? ['blanket', n % 2 ? 'sand' : 'water'] : ['blanket'];
    if (enc.kind === 'elite') {
      if (act === 1) return ['sand'];
      var first = ['water', 'sprinkler', 'sand'][n % 3];
      return act >= 4 ? [first, first === 'sprinkler' ? 'water' : 'sprinkler'] : [first];
    }
    return act === 1 ? [] : [n % 2 ? 'sand' : 'water'];
  };
  /* ---------- Kniffe ---------- */
  Run.prototype.kniffSlots = function () { return this.meta().kniffSlots || 1; };
  Run.prototype.kniffe = function () { return this.s.kniffe || (this.s.kniffe = []); };
  /* Kniffe, die in diesem Run noch auftauchen können: nach ausgeräumten Casinos gestaffelt, ohne die eigenen. */
  Run.prototype.kniffPool = function () {
    var owned = this.kniffe().map(function (k) { return k.id; }), tier = this.meta().kniffTier == null ? 9 : this.meta().kniffTier;
    return ZU.KNIFF_IDS.filter(function (id) { return ZU.KNIFFE[id].tier <= tier && owned.indexOf(id) < 0; });
  };
  Run.prototype.kniffPrice = function (id, level) {
    var spec = ZU.KNIFFE[id];
    return this._price(level <= spec.start ? spec.price : Math.round(spec.price * [0, 0, 1.2, 2][level]));
  };
  /* Kniff des Akts: ein neuer Kniff, solange ein Platz frei ist, sonst (oder im Wechsel) die nächste Stufe eines eigenen.
     Wie das Privileg nur einmal je Akt zu kaufen; das Angebot bleibt in allen Läden des Akts stehen. */
  Run.prototype._rollKniff = function () {
    var s = this.s, own = this.kniffe(), pool = this.kniffPool();
    var up = own.filter(function (k) { return k.level < 3; }), free = own.length < this.kniffSlots() && pool.length > 0;
    var offer = null;
    if (free && (!own.length || !up.length || this.rng.next() < 0.45)) {
      var narrow = pool.filter(function (id) { return ZU.KNIFFE[id].tier === 0; });
      var id = this.rng.pick(!own.length && narrow.length ? narrow : pool);
      offer = { id: id, level: ZU.KNIFFE[id].start, fresh: true };
    } else if (up.length) {
      var k = this.rng.pick(up);
      offer = { id: k.id, level: k.level + 1, fresh: false };
    }
    if (offer) { offer.price = this.kniffPrice(offer.id, offer.level); offer.sold = false; }
    s.kniffOffer = offer || { id: null, sold: true };
    s.kniffOffer.act = s.act;
  };
  Run.prototype.buyKniff = function () {
    var offer = this.s.kniffOffer;
    if (!offer || offer.sold || !offer.id || this.s.phase !== 'shop') throw new Error('Nicht verfügbar.');
    this._pay(offer.price);
    offer.sold = true;
    this._gainKniff(offer.id, offer.level);
    this.save();
    return offer.id;
  };
  Run.prototype._gainKniff = function (id, level) {
    var own = this.kniffe(), have = own.filter(function (k) { return k.id === id; })[0];
    if (have) have.level = Math.min(3, Math.max(have.level, level));
    else own.push({ id: id, level: level });
    var offer = this.s.kniffOffer; // ein Stufen-Angebot, das die Boss-Beute schon eingelöst hat, ist erledigt
    if (offer && offer.id === id && !offer.fresh && own.filter(function (k) { return k.id === id; })[0].level >= offer.level) offer.sold = true;
    ZU.Meta.note({ kniffe: 1 });
  };
  /* Boss-Beute: statt der Spezialkarte eine Stufe auf einen eigenen Kniff. */
  Run.prototype.rewardKniff = function () {
    var s = this.s, r = s.reward;
    if (!r || !r.kniff) throw new Error('Keine Belohnung offen.');
    var have = this.kniffe().filter(function (k) { return k.id === r.kniff; })[0];
    if (have) this._gainKniff(have.id, have.level + 1);
    s.reward = null;
    this._openShop();
    this._sync();
    this.save();
  };

  Run.prototype.encounter = function () { return this.s.encounters[this.s.table]; };
  Run.prototype.actName = function () {
    var acts = this.acts();
    if (this.s.act > acts) return 'Nachglut ' + ZU.roman(this.s.act - acts);
    return (this.meta().legacy ? ZU.ACT_NAMES : this.casino().rooms)[this.s.act - 1] || 'Akt ' + ZU.roman(this.s.act);
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
    // Bosse: zum Einstieg die kleinen, im letzten Akt die Herren des Hauses, dazwischen alles darunter; in der Nachglut alle.
    var acts = this.acts(), bosses;
    if (s.act > acts) bosses = [].concat.apply([], ZU.BOSS_ACTS);
    else if (s.act === acts) bosses = ZU.BOSS_ACTS[2];
    else if (s.act === 1) bosses = ZU.BOSS_ACTS[0];
    else if (s.act === 2) bosses = ZU.BOSS_ACTS[1];
    else bosses = ZU.BOSS_ACTS[0].concat(ZU.BOSS_ACTS[1]);
    var lastCall = this.rule('last-call');
    // Eigene Figuren des Casinos: Ihr Tisch eröffnet das Haus, ihre Elite wartet im zweiten Akt, ihr Boss im letzten.
    var foes = (!this.meta().legacy && this.casino().foes) || null, inside = s.act <= acts;
    var battles = ZU.BATTLE_POOL.concat(foes ? [foes.battle] : []), elites = ZU.ELITE_POOL.concat(foes ? [foes.elite] : []);
    function own(id) { if (s.seen.indexOf(id) < 0) s.seen.push(id); return id; }
    s.encounters = [
      { enemy: foes && inside && s.act === 1 ? own(foes.battle) : fresh(battles), kind: 'battle' },
      { enemy: foes && inside && s.act === 2 ? own(foes.elite) : fresh(elites), kind: 'elite' },
      { enemy: foes && s.act === acts ? own(foes.boss) : fresh(bosses), kind: 'boss' }
    ];
    // Hausregeln: am allerersten Tisch nie, danach mit jedem Akt häufiger.
    s.encounters.forEach(function (encounter, index) {
      encounter.rules = [];
      if (s.act === 1 && index === 0) return;
      Object.keys(ZU.RULE_CHANCE).forEach(function (rule) {
        var chances = ZU.RULE_CHANCE[rule];
        var bonus = lastCall ? 0.2 : 0; // Hausregel „Knapper Stapel"
        if (rng.next() < chances[Math.min(chances.length, s.act) - 1] + bonus) encounter.rules.push(rule);
      });
    });
  };

  Run.prototype.baseReward = function (kind) {
    var act = this.s.act;
    var base = (kind === 'battle' ? 4 + act : kind === 'elite' ? 6 + act : 8 + 2 * act) * this.scale();
    if (this.has('regular')) base *= 1.25; // Privileg „Stammplatz"
    if (this.rule('cover')) base *= 0.75; // Hausregel „Gedeck"
    return Math.max(2, Math.round(base));
  };

  /* ---------- Duell ---------- */
  Run.prototype.newDuel = function () {
    var e = this.encounter();
    this.s.phase = 'duel';
    return new ZU.Duel({
      rng: this.rng, enemyId: e.enemy, kind: e.kind, act: this.s.act,
      rules: e.rules || [],
      house: this.houseRules(),
      target: this.glutTarget(e.kind),
      kniffe: this.kniffe().map(function (k) { return { id: k.id, level: k.level }; }),
      douse: this.douse(e),
      grow: { burned: this.s.burnCount || 0, bosses: this.s.bossesBeaten || 0, money: this.s.money, trinkets: this.s.trinkets.length, lastChain: this.s.lastChain || 0,
        deck: this.s.collection.length, sealed: this.s.collection.filter(function (c) { return c.seal; }).length, act: this.s.act,
        wins: this.s.stats.wins, streak: this.s.streak || 0, lastLost: !!this.s.lastLost },
      perks: this.s.perks || [],
      specialPool: this.meta().specials,
      trinkets: this.s.trinkets, collection: this.s.collection.map(function (c) { return { id: c.id, def: c.def, bind: c.bind, seal: c.seal, flaw: c.flaw }; }),
      nextId: this.s.nextId
    });
  };

  /* Wertet ein beendetes Duell aus. Liefert die Zeilen der Auszahlung bzw. die Folgen der Niederlage. */
  Run.prototype.finishDuel = function (duel) {
    var s = this.s, self = this, e = this.encounter();
    s.nextId = Math.max(s.nextId, duel.nextId);
    s.lastLost = duel.winner !== 'player';
    s.streak = s.lastLost ? 0 : (s.streak || 0) + 1;
    s.stats.duels++;
    s.stats.played += duel.stats.played;
    s.stats.bestChain = Math.max(s.stats.bestChain, duel.maxChain);
    s.stats.bestGlut = Math.max(s.stats.bestGlut, duel.glut);

    if (duel.winner !== 'player') {
      s.stats.losses++;
      var saved = false, spared = false, comfort = 0;
      if (this.has('phoenixfeder') && s.phoenix !== s.act) {
        s.phoenix = s.act; // Phönixfeder: die erste Niederlage je Akt kostet nichts
        spared = true;
      } else if (s.lives === 1 && this.has('golden-match')) {
        s.trinkets.splice(s.trinkets.indexOf('golden-match'), 1);
        saved = true;
      } else {
        s.lives--;
        s.hurt = true;
      }
      if (this.has('dicke-brieftasche')) comfort += Math.round(duel.bank * this.scale());
      if (this.has('police')) comfort += Math.round(this.baseReward(e.kind) * 0.6);
      s.lastChain = duel.maxChain;
      s.money += comfort;
      ZU.Meta.noteDuel(this, duel, false);
      s.phase = s.lives <= 0 ? 'defeat' : 'select';
      this._sync();
      if (s.phase === 'defeat') this._closeRun(false); else this.save();
      return { won: false, saved: saved, spared: spared, comfort: comfort, lives: s.lives };
    }

    s.stats.wins++;
    duel.retired.forEach(function (id) {
      for (var i = 0; i < s.collection.length; i++) {
        if (s.collection[i].id === id) { s.collection.splice(i, 1); break; }
      }
    });
    // Im Duell erzeugte Karten: Spezialkarten nur, solange das Deck noch Platz für sie hat.
    var lostCards = 0;
    duel.created.forEach(function (card) {
      if (ZU.CARDS[card.def].special && !self.specialFree()) lostCards++;
      else self._add(card.def, card.bind);
    });

    // Auszahlung. Fast alles rechnet in Prozent der Tischprämie, damit es mit den Akten mitwächst.
    var lines = [], base = this.baseReward(e.kind), scale = this.scale();
    function share(pct) { return Math.max(1, Math.round(base * pct)); }
    lines.push({ label: ZU.KIND_LABEL[e.kind] + 'prämie', amount: base });
    var held = duel.enemy.passive === 'purser' || duel.enemy.passive === 'house-cut' ? Math.floor(duel.bank / 2) : duel.bank; // Zahlmeister Pfennig behält die Hälfte ein
    var bank = Math.round(held * scale); // die Bank ist in späteren Akten mehr wert
    if (bank > 0) lines.push({ label: 'Bank' + (held < duel.bank ? ' (halbiert)' : '') + (scale > 1 ? ' ×' + String(Math.round(scale * 100) / 100).replace('.', ',') : ''), amount: bank });
    if (duel.bonusMult > 1) lines.push({ label: 'Bonusgeld ×' + duel.bonusMult, amount: (base + bank) * (duel.bonusMult - 1) });
    var counted = Math.min(this.has('gold-tooth') ? 10 : 5, duel.hand.opp.length), each = Math.max(1, Math.round(scale));
    if (counted > 0) lines.push({ label: 'Restkarten des Gegners (' + duel.hand.opp.length + ')', amount: counted * each });
    // Glut: bis zum Glutziel anteilig, darüber für jede Verdopplung noch einmal die halbe Prämie – ohne Deckel.
    var target = duel.target || 0, ratio = target ? duel.glut / target : 0, burnt = target > 0 && duel.glut >= target;
    var heat = Math.round(base * 0.5 * Math.min(1, ratio)) * (this.has('furnace') ? 2 : 1);
    if (heat > 0) lines.push({ label: 'Glut-Bonus (' + Math.min(100, Math.floor(ratio * 100)) + ' % des Ziels)', amount: heat });
    var doublings = burnt ? Math.floor(Math.log(ratio) / Math.LN2) : 0;
    if (burnt) lines.push({ label: 'Tisch abgefackelt', amount: share(0.5) });
    if (doublings > 0) lines.push({ label: 'Überschuss: Ziel ×' + Math.pow(2, doublings), amount: share(0.5) * doublings * (this.has('funkenregen') ? 2 : 1) });
    if (burnt && this.has('brandpraemie')) lines.push({ label: 'Brandprämie (+50 %)', amount: share(0.5), trinket: 'brandpraemie' });
    if (duel.wonBy === 'curfew' && this.has('nachtschicht')) lines.push({ label: 'Nachtschicht (+50 %)', amount: share(0.5), trinket: 'nachtschicht' });
    if (this.has('trinkgeld') && s.money >= 5) lines.push({ label: 'Spendierhosen (10 % der Kasse)', amount: Math.min(base, Math.max(1, Math.round(s.money * 0.1))), trinket: 'trinkgeld' });
    if (duel.enemy.passive === 'odds') lines.push({ label: 'Wettschein', amount: share(0.3) });
    if (this.has('lucky-chip')) lines.push({ label: 'Glückschip (+20 %)', amount: share(0.2), trinket: 'lucky-chip' });
    if (e.kind !== 'battle' && this.has('kopfgeld')) lines.push({ label: 'Kopfgeld (+40 %)', amount: share(0.4), trinket: 'kopfgeld' });
    if (duel.maxChain >= 8 && this.has('zylinder')) lines.push({ label: 'Zylinder (Kette ×' + duel.maxChain + ')', amount: share(0.4), trinket: 'zylinder' });
    if (duel.turns <= 16 && this.has('sturmfeuerzeug')) lines.push({ label: 'Sturmfeuerzeug (' + duel.turns + ' Züge)', amount: share(0.4), trinket: 'sturmfeuerzeug' });
    if (this.has('sammleralbum') && s.trinkets.length >= 3) lines.push({ label: 'Sammleralbum (+' + (Math.floor(s.trinkets.length / 3) * 10) + ' %)', amount: share(0.1 * Math.floor(s.trinkets.length / 3)), trinket: 'sammleralbum' });
    if (e.kind === 'boss' && this.meta().bossTip) lines.push({ label: 'Trinkgeld', amount: share(this.meta().bossTip) });
    // Zinsen: 1 Mark je 5 gesparte (mit Zinseszins je 4); die Obergrenze wächst mit dem Akt.
    var cap = Math.round(3 * scale * (this.has('ledger') ? 2 : 1) * (1 + 0.25 * (this.meta().interest || 0)));
    var step = this.has('compound') ? 4 : 5;
    var interest = this.rule('no-credit') ? 0 : Math.min(cap, Math.floor(s.money / step));
    if (interest > 0) lines.push({ label: 'Zinsen (1 je ' + step + ' Mark, max. ' + cap + ')', amount: interest });

    var total = 0;
    lines.forEach(function (line) { total += line.amount; });
    if (duel.toll > 0) {
      var toll = Math.min(duel.toll, Math.max(0, total - 1)); // Makel „Zoll": nie mehr, als die Auszahlung hergibt
      if (toll > 0) { lines.push({ label: 'Zoll (' + duel.toll + ' Karten)', amount: -toll }); total -= toll; }
    }
    s.money += total;
    s.stats.earned += total;
    s.score += duel.glut + 100 * s.act;
    s.lastChain = duel.maxChain;
    if (e.kind === 'boss') s.bossesBeaten = (s.bossesBeaten || 0) + 1;

    var healed = false;
    if (e.kind === 'boss' && s.lives < this.maxLives()) { s.lives++; healed = true; }
    if (duel.lifeGain && s.lives < this.maxLives()) { s.lives++; healed = true; } // Reservefunke
    // Asche gibt es sofort – aber nur bis das Casino ausgeräumt ist; die Nachglut bringt keine mehr.
    var ash = 0;
    if (!s.endless) {
      // Asche: Grundwert, dazu 1 für einen abgefackelten Tisch und 1 je Verdopplung über dem Glutziel
      s.ash = (s.ash || 0) + ZU.Meta.ASH[e.kind] + (e.kind === 'boss' && this.has('urne') ? 2 : 0) + (burnt ? 1 + doublings : 0);
      if (e.kind === 'boss' && s.act === this.acts()) {
        s.ash += ZU.Meta.ASH.victory;
        s.cleared = true;
      }
    }
    ZU.Meta.noteDefeat(e.enemy);
    ZU.Meta.noteDuel(this, duel, true);
    if (!s.endless) ash = ZU.Meta.award(this);
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
      var upgradable = this.kniffe().filter(function (k) { return k.level < 3; });
      if (s.reward && upgradable.length) s.reward.kniff = rng.pick(upgradable).id;
    }
    s.phase = 'payout';
    this._sync();
    return { won: true, lines: lines, total: total, healed: healed, glut: duel.glut, maxChain: duel.maxChain, ash: ash, lostCards: lostCards, target: target, burnt: burnt, doublings: doublings };
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
    if (e.kind === 'boss' && s.act === this.acts() && !s.endless) {
      s.phase = 'victory';
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

  /* replaceId: Ist das Deck voll, weicht diese Spezialkarte der neuen. */
  Run.prototype.chooseReward = function (index, replaceId) {
    var s = this.s, r = s.reward;
    if (!r) throw new Error('Keine Belohnung offen.');
    if (index == null) {
      s.money += r.skip;
    } else if (r.type === 'trinket') {
      this._gainTrinket(r.options[index]);
    } else {
      if (!this.specialFree()) {
        var at = -1;
        s.collection.forEach(function (c, i) { if (c.id === replaceId && ZU.CARDS[c.def].special) at = i; });
        if (at < 0) throw new Error('Kein Platz für eine weitere Spezialkarte.');
        s.collection.splice(at, 1);
      }
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
    this._shopGain(id);
  };

  /* Im Laden gekauft: Erweiterungen und Rabatte gelten sofort, nicht erst beim nächsten Besuch. */
  Run.prototype._shopGain = function (id) {
    var s = this.s, shop = s.shop, self = this;
    if (!shop || s.phase !== 'shop') return;
    if (id === 'false-bottom' && !shop.bought) shop.discount = true;
    if (id === 'showcase') {
      // Vitrine: Der dritte Platz füllt sich gleich.
      var shown = shop.trinkets.map(function (offer) { return offer.id; });
      var extra = this._weighted(this._trinketPool().filter(function (t) { return shown.indexOf(t) < 0; }),
        function (t) { return [50, 30, 15, 5][ZU.TRINKETS[t].rarity]; }, 1)[0];
      if (extra) shop.trinkets.push({ id: extra, price: this._price(ZU.TRINKETS[extra].price), sold: false });
    }
    if (id === 'shelf') {
      // Großes Regal: Auf dem dritten Platz liegt sofort eine Spezialkarte.
      var used = shop.specials.map(function (offer) { return offer.def; });
      var def = this._weighted(this._specialPool().filter(function (c) { return used.indexOf(c) < 0; }),
        function (c) { return [50, 30, 14 + 3 * Math.min(s.act, 4), 2 + Math.min(s.act, 4)][ZU.CARDS[c].rarity]; }, 1)[0];
      if (def) {
        var bind = ZU.rollBind(this.rng, s.act);
        if (ZU.SUITS[bind] && this.has('grinder')) bind = ZU.SUITS[bind].red ? 'red' : 'black';
        shop.specials.push({ def: def, bind: bind, price: this._price(ZU.cardPrice(def, bind)), sold: false });
      }
    }
    if (id === 'grinder') {
      // Schleifer: Was schon im Regal liegt, wird mindestens farbgebunden.
      shop.specials.forEach(function (offer) {
        if (offer.sold || !ZU.SUITS[offer.bind]) return;
        offer.bind = ZU.SUITS[offer.bind].red ? 'red' : 'black';
        offer.price = self._price(ZU.cardPrice(offer.def, offer.bind));
      });
    }
    this._sync();
  };

  /* ---------- Laden ---------- */
  Run.prototype._openShop = function () {
    // Nach dem Boss gehört der Laden schon zum nächsten Akt: neue Preise, neues Privileg, neuer Kniff.
    if (this.s.table >= 2) {
      this.s.table = -1;
      this.s.act++;
      this._encounters();
    }
    this.s.shop = { cards: [], specials: [], trinkets: [], rerolls: 0, discount: this.has('false-bottom'), healed: false, burned: false, esme: { packs: [], rerolls: 0, pity: false } };
    this._stockEsme();
    if (this.rule('cover-charge')) this.s.money = Math.max(0, this.s.money - Math.max(2, Math.round(this.s.money * 0.1))); // Hausregel „Eintritt"
    if (this.has('mitgift')) this.s.money += Math.max(3, Math.round(this.s.money * 0.15));
    if (!this.s.perkOffer || this.s.perkOffer.act !== this.s.act) this._rollPerk();
    if (!this.s.kniffOffer || this.s.kniffOffer.act !== this.s.act) this._rollKniff();
    this._stockShop();
    this.s.phase = 'shop';
  };

  /* Privileg des Akts: wird nur einmal je Akt gewürfelt und bleibt in allen Läden dieses Akts stehen. */
  Run.prototype._rollPerk = function () {
    var s = this.s;
    s.perks = s.perks || [];
    var open = ZU.PERK_IDS.filter(function (id) { return s.perks.indexOf(id) < 0; });
    if (!open.length) { s.perkOffer = { id: null, price: 0, sold: true, act: s.act }; return; }
    var id = this.rng.pick(open);
    s.perkOffer = { id: id, price: Math.max(1, Math.round(this._price(ZU.PERKS[id].price) * (1 - (this.meta().perkDiscount || 0)))), sold: false, act: s.act };
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
    this._shopGain(offer.id);
    ZU.Meta.note({ perks: s.perks.length });
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
      function (id) { return [50, 30, 15, 5][ZU.TRINKETS[id].rarity]; }, (this.has('showcase') ? 3 : 2) + (this.meta().trinketOffers || 0));
    shop.trinkets = picks.map(function (id) { return { id: id, price: self._price(ZU.TRINKETS[id].price), sold: false }; });
  };

  /* ---------- Esmes Nebenzimmer: Karten veredeln ---------- */
  Run.prototype._sealPool = function () {
    return (this.meta().seals || ZU.SEAL_IDS).filter(function (id) { return ZU.SEALS[id]; });
  };
  /* Wie oft ein Paket einen Makel trägt: früh im Casino oft (und billig), gegen Ende selten. */
  Run.prototype.flawChance = function () {
    var acts = this.acts(), t = acts > 1 ? Math.min(1, (this.s.act - 1) / (acts - 1)) : 1;
    return 0.67 - 0.42 * t;
  };
  Run.prototype._rollSeal = function (flawed) {
    var pool = this._sealPool(), rng = this.rng;
    var seal = this._weighted(pool, function (id) { return ZU.SEALS[id].weight; }, 1)[0] || 'glut';
    var item = { seal: seal };
    if (flawed) {
      var flaws = ZU.FLAW_IDS.filter(function (id) { return ZU.SEALS[seal].not.indexOf(id) < 0; });
      item.flaw = rng.pick(flaws);
    }
    return item;
  };
  Run.prototype._packPrice = function (kind, items) {
    var rule = ZU.SEAL_PRICE, sum = 0;
    items.forEach(function (item) { sum += ZU.SEALS[item.seal].value * rule.point * (item.flaw ? rule.flaw : 1); });
    if (kind === 'double') sum *= rule.double;
    if (kind === 'bag') sum *= rule.bag;
    return Math.max(2, this._price(Math.round(sum * (this.has('hausfreund') ? 0.75 : 1))));
  };
  /* Legt Esmes Pakete aus: Einzelsiegel, Doppelpack oder Wundertüte. Mindestens ein Paket ist makellos. */
  Run.prototype._stockEsme = function () {
    var esme = this.s.shop.esme, rng = this.rng, self = this, chance = this.flawChance(), bag = false;
    esme.packs = [];
    for (var i = 0; i < (this.meta().esmePacks || 3); i++) {
      var roll = rng.next(), kind = roll < 0.6 ? 'single' : roll < 0.85 || bag ? 'double' : 'bag';
      if (kind === 'bag') bag = true;
      var items = [];
      for (var n = 0; n < (kind === 'single' ? 1 : kind === 'double' ? 2 : 3); n++) items.push(this._rollSeal(rng.next() < chance));
      esme.packs.push({ kind: kind, items: items, price: 0, sold: false });
    }
    var clean = esme.packs.filter(function (pack) { return pack.kind !== 'bag' && pack.items.every(function (item) { return !item.flaw; }); });
    if (!clean.length) {
      var open = esme.packs.filter(function (pack) { return pack.kind !== 'bag'; });
      (open.length ? rng.pick(open) : esme.packs[0]).items.forEach(function (item) { delete item.flaw; });
    }
    esme.packs.forEach(function (pack) { pack.price = self._packPrice(pack.kind, pack.items); });
  };
  /* Normale Karten, die sich veredeln lassen. */
  Run.prototype.sealable = function () {
    return this.s.collection.filter(function (c) { return !ZU.CARDS[c.def].special; });
  };
  /* Neu auslegen kostet – außer du könntest dir sonst gar nichts leisten: Dann mischt Esme einmal gratis. */
  Run.prototype.esmeRerollPrice = function () {
    var esme = this.s.shop.esme, money = this.s.money;
    var affordable = esme.packs.some(function (pack) { return !pack.sold && pack.price <= money; });
    if (!affordable && !esme.pity && esme.packs.some(function (pack) { return !pack.sold; })) return 0;
    return 3 + 2 * esme.rerolls;
  };
  Run.prototype.esmeReroll = function () {
    var esme = this.s.shop.esme, price = this.esmeRerollPrice();
    this._pay(price);
    if (price === 0) esme.pity = true; else esme.rerolls++;
    this._stockEsme();
    this._sync();
    this.save();
  };
  /* Kauft ein Paket. cardIds: die gewählten Karten (Einzelsiegel 1, Doppelpack 2); die Wundertüte wählt selbst.
     Liefert, welche Karte welches Siegel bekommen hat. Ein neues Siegel ersetzt ein altes samt Makel. */
  Run.prototype.buyPack = function (index, cardIds) {
    var s = this.s, pack = s.shop.esme.packs[index], self = this;
    if (!pack || pack.sold) throw new Error('Nicht verfügbar.');
    var pool = this.sealable(), targets;
    if (pack.kind === 'bag') {
      targets = this.rng.shuffle(pool.slice()).slice(0, pack.items.length);
    } else {
      targets = (cardIds || []).map(function (id) { return pool.filter(function (c) { return c.id === id; })[0]; });
      if (targets.length !== pack.items.length || targets.some(function (c) { return !c; }) ||
        targets.some(function (c, i) { return targets.indexOf(c) !== i; })) throw new Error('Wähle ' + pack.items.length + ' verschiedene normale Karten.');
    }
    if (!targets.length) throw new Error('Keine Karte zum Veredeln.');
    this._pay(pack.price);
    pack.sold = true;
    var result = targets.map(function (card, i) {
      var item = pack.items[i];
      card.seal = item.seal;
      if (item.flaw) card.flaw = item.flaw; else delete card.flaw;
      return { id: card.id, def: card.def, seal: item.seal, flaw: item.flaw || null };
    });
    ZU.Meta.note({ sealed: result.length });
    this._sync();
    this.save();
    return result;
  };

  /* shelf: 'cards' oder 'specials'. Der Doppelboden-Rabatt gilt für den ersten Kartenkauf, egal aus welchem Regal. */
  Run.prototype.offerPrice = function (shelf, index) {
    var offer = this.s.shop[shelf][index];
    var price = offer.price;
    if (shelf === 'specials' && this.has('counterfeit')) price *= 0.75; // Falschgeld
    if (this.s.shop.discount) price *= 0.5; // Doppelboden: der erste Kartenkauf zum halben Preis
    return Math.max(1, Math.round(price));
  };
  Run.prototype.cardPrice = function (index) { return this.offerPrice('cards', index); };
  Run.prototype.rerollPrice = function () {
    if (this.meta().freeReroll && this.s.shop.rerolls === 0) return 0; // Upgrade „Stammkunde"
    var price = this.has('bell') ? 2 : 3 + this.s.shop.rerolls - (this.meta().freeReroll ? 1 : 0);
    return this.has('rabattmarke') ? Math.max(1, Math.ceil(price / 2)) : price;
  };
  Run.prototype.burnPrice = function () {
    if (this.has('gratisfeuer') && this.s.shop && !this.s.shop.burned) return 0;
    return Math.max(1, Math.round((this.has('ashbin') ? 2 : 3 + this.s.burnCount) * (1 - (this.meta().burnDiscount || 0))));
  };
  Run.prototype.healPrice = function () { return Math.max(1, Math.round(6 * this.scale() * (this.has('feuerversicherung') ? 0.6 : 1))); };
  Run.prototype.sellValue = function (id) { return this.has('pfandschein') ? ZU.TRINKETS[id].price : Math.floor(ZU.TRINKETS[id].price / 2); };

  Run.prototype._pay = function (amount) {
    if (this.s.money < amount) throw new Error('Nicht genug Mark.');
    this.s.money -= amount;
  };

  Run.prototype.buyOffer = function (shelf, index) {
    var offer = (this.s.shop[shelf] || [])[index];
    if (!offer || offer.sold) throw new Error('Nicht verfügbar.');
    if (shelf === 'specials' && !this.specialFree()) throw new Error('Kein Platz für eine weitere Spezialkarte.');
    this._pay(this.offerPrice(shelf, index));
    this.s.shop.discount = false;
    this.s.shop.bought = true;
    ZU.Meta.note({ bought: 1 });
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
    return Math.max(1, Math.round(offer.price * (1 + ZU.TRINKET_SURCHARGE * this.s.trinkets.length) * (this.has('loyalty') ? 0.8 : 1)));
  };

  Run.prototype.buyTrinket = function (index) {
    var offer = this.s.shop.trinkets[index];
    if (!offer || offer.sold) throw new Error('Nicht verfügbar.');
    var price = this.trinketPrice(index);
    if (this.s.money < price) throw new Error('Nicht genug Mark.');
    this._gainTrinket(offer.id);
    this._pay(price);
    offer.sold = true;
    ZU.Meta.note({ trinkets: this.s.trinkets.length, bought: 1 });
    this.save();
  };

  Run.prototype.sellTrinket = function (id) {
    var index = this.s.trinkets.indexOf(id);
    if (index < 0) throw new Error('Trinket nicht vorhanden.');
    var value = this.sellValue(id); // vor dem Entfernen: der Pfandschein zählt auch für sich selbst
    this.s.trinkets.splice(index, 1);
    this.s.money += value;
    ZU.Meta.note({ sold: 1 });
    this.save();
  };

  Run.prototype.reroll = function () {
    this._pay(this.rerollPrice());
    this.s.shop.rerolls++;
    ZU.Meta.note({ rerolls: 1 });
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
        s.shop.burned = true;
        ZU.Meta.note({ burned: 1 });
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
    ZU.Meta.note({ healed: 1 });
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
      // Runs aus der Zeit mit sechs Casinos: Der Index des Hauses wandert an seinen neuen Platz.
      if (state.meta && state.meta.cv !== ZU.CASINO_VERSION) {
        if (ZU.CASINO_REMAP[state.meta.stake] != null) state.meta.stake = ZU.CASINO_REMAP[state.meta.stake];
        state.meta.cv = ZU.CASINO_VERSION;
      }
      if (state.shop && !state.shop.specials) state.shop.specials = []; // Spielstände vor dem geteilten Laden
      // Spielstände vor den Casinos: Der Einsatz wird zur passenden Hausordnung, alles andere bleibt, wie der Run begonnen hat.
      if (state.meta && !state.meta.rules) {
        state.meta.rules = ['last-call', 'sober', 'markup', 'cover', 'house-edge'].slice(0, state.meta.stake || 0);
        state.meta.acts = 3;
        state.meta.ashMult = 1 + 0.25 * (state.meta.stake || 0);
        state.meta.specialSlots = 99;
        state.meta.legacy = true;
      }
      if (state.meta && state.meta.specials) state.meta.specials = state.meta.specials.filter(function (id) { return ZU.CARDS[id]; });
      if (state.shop && !state.shop.esme) state.shop.esme = { packs: [], rerolls: 0, pity: true }; // Spielstände vor Esme: ihr Zimmer bleibt in diesem Laden leer
      // Spielstände vor den Privilegien: „Flinke Finger" war ein Trinket.
      state.perks = state.perks || [];
      var legacy = state.trinkets.indexOf('nimble-fingers');
      if (legacy >= 0) {
        state.trinkets.splice(legacy, 1);
        if (state.perks.indexOf('nimble-fingers') < 0) state.perks.push('nimble-fingers');
      }
      // Spielstände vor den Kniffen: „Flinke Finger" wird zum Kniff Pasch auf höchster Stufe.
      state.kniffe = (state.kniffe || []).filter(function (k) { return k && ZU.KNIFFE[k.id]; });
      var nimble = state.perks.indexOf('nimble-fingers');
      if (nimble >= 0) {
        state.perks.splice(nimble, 1);
        if (!state.kniffe.some(function (k) { return k.id === 'pasch'; })) state.kniffe.push({ id: 'pasch', level: 3 });
      }
      state.perks = state.perks.filter(function (id) { return ZU.PERKS[id]; });
      if (state.perkOffer && state.perkOffer.id && !ZU.PERKS[state.perkOffer.id]) state.perkOffer = null;
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
      return { runs: 0, wins: 0, best: 0, bestAct: 0, seenHelp: false, meta: {}, brSeen: [], popSeen: [], popInit: false, avatar: {}, settings: { music: 0.5, sfx: 0.7, voice: 0.7, speed: 1, crt: true, bg: true, fullscreen: 'ask' } };
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
