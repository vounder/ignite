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
    seals: null, esmePacks: 3, specialSlots: 99, interest: 0, trinketOffers: 0, perkDiscount: 0, bossTip: 0, burnDiscount: 0, luckyTrinket: false, kniffSlots: 2, kniffe: []
  };

  /* meta: Ergebnis von ZU.Meta.runOptions() – Einsatz, Upgrades und freigeschaltete Inhalte. */
  Run.start = function (starterId, seed, meta) {
    meta = meta || NO_META;
    var starter = ZU.STARTERS.filter(function (s) { return s.id === starterId; })[0] || ZU.STARTERS[0];
    var state = {
      v: 1, seed: seed >>> 0, rng: seed >>> 0, starter: starter.id,
      // Kennung dieses Runs und Zähler seiner Speicherungen: daran erkennt der Abgleich, welches Gerät weiter ist.
      rid: (seed >>> 0).toString(36) + '-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), step: 0, at: 0,
      act: 1, table: 0, lives: Math.max(1, meta.maxLives + (starter.lives || 0)), money: starter.money + meta.startgeld, score: 0, nextId: 1,
      meta: meta, ash: 0, ashPaid: 0,
      collection: [], trinkets: starter.trinkets.slice(), perks: (starter.perks || []).slice(), perkOffer: null, kniffe: (starter.kniffe || []).map(function (k) { return { id: k.id, level: k.level }; }),
      bonusLives: Math.max(1, meta.maxLives + (starter.lives || 0)) - meta.maxLives, phase: 'select',
      encounters: [], seen: [], shop: null, reward: null, burnCount: 0, endless: false,
      stats: { duels: 0, wins: 0, losses: 0, bestChain: 1, bestGlut: 0, played: 0, earned: 0 }
    };
    var run = new Run(state);
    // Startdeck: normale Karten (feste der Schachtel, der Rest zufällig; manche Schachteln kennen nur zwei Symbole
    // oder sind kleiner bzw. größer als 16) plus Spezialkarten.
    // Die sind an ein zufälliges Symbol gebunden; "special" heißt: eine zufällige gewöhnliche aus dem freien Bestand.
    var size = starter.size || ZU.DECK_SIZE;
    var fixed = starter.cards.filter(function (def) { return !ZU.CARDS[def].special; });
    var pool = run.rng.shuffle(ZU.STANDARD_IDS.filter(function (id) {
      return fixed.indexOf(id) < 0 && (!starter.suits || starter.suits.indexOf(ZU.CARDS[id].suit) >= 0);
    }));
    fixed.forEach(function (def) { run._add(def); });
    if (starter.twins) {
      // Doppelkopf: halb so viele verschiedene Karten, jede zweimal
      while (state.collection.length < size && pool.length) { var twinDef = pool.pop(); run._add(twinDef); run._add(twinDef); }
    }
    while (state.collection.length < size && pool.length) run._add(pool.pop());
    if (starter.seals) {
      // Veredelte Karten der Schachtel: je Siegel eine andere zufällige Karte
      var plain = run.rng.shuffle(state.collection.slice());
      starter.seals.forEach(function (seal) { var card = plain.pop(); if (card && ZU.SEALS[seal]) card.seals = [seal]; });
    }
    starter.cards.filter(function (def) { return ZU.CARDS[def].special; }).forEach(function (def) { run._add(def, run.rng.pick(ZU.SUIT_ORDER)); });
    if (starter.special) {
      var commons = run._specialPool().filter(function (id) { return ZU.CARDS[id].rarity === 0; });
      run._add(run.rng.pick(commons.length ? commons : ['stillstand']), run.rng.pick(ZU.SUIT_ORDER));
    }
    // Ausgerüstete Kniffe aus dem Hinterzimmer; bringt die Schachtel denselben mit, gilt die höhere Stufe.
    (meta.kniffe || []).forEach(function (k) {
      if (!ZU.KNIFFE[k.id]) return;
      var have = state.kniffe.filter(function (x) { return x.id === k.id; })[0];
      if (have) have.level = Math.max(have.level, k.level);
      else state.kniffe.push({ id: k.id, level: k.level });
    });
    if (meta.luckyTrinket) {
      // Upgrade „Glücksbringer": ein zufälliges gewöhnliches Trinket zum Start
      var commons = run._trinketPool().filter(function (id) { return ZU.TRINKETS[id].rarity === 0; });
      if (commons.length) state.trinkets.push(run.rng.pick(commons));
    }
    state.added = 0; // Hologramm zählt erst, was nach dem Start dazukommt
    run._encounters();
    run._sync();
    return run;
  };

  Run.prototype._sync = function () { this.s.rng = this.rng.state; };
  Run.prototype._add = function (def, bind) {
    var card = { id: this.s.nextId++, def: def };
    if (ZU.CARDS[def].special) card.bind = bind || 'wild';
    this.s.collection.push(card);
    this.s.added = (this.s.added || 0) + 1;
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
  /* Glutziel eines Tisches: wächst mit dem Akt (×1,7) und mit dem Casino (+25 % je Haus). */
  Run.prototype.glutTarget = function (kind) {
    var g = ZU.GLUT_TARGET, raw = g[kind] * Math.pow(g.perAct, this.s.act - 1) * (1 + g.perCasino * (this.meta().legacy ? 0 : this.meta().stake || 0));
    if (this.has('zuenglein')) raw *= 0.9;
    var step = raw < 1000 ? 10 : raw < 10000 ? 50 : raw < 100000 ? 500 : 5000;
    return Math.round(raw / step) * step;
  };
  /* Löschmittel eines Tisches: fest je Gegner und Akt, höchstens eines – und nur dort, wo es um etwas geht. */
  Run.prototype.douse = function (enc) {
    var act = this.s.act, n = act, id = enc.enemy;
    for (var i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) % 9973;
    // Gewöhnliche Tische löschen nie, der erste Akt bleibt ganz frei. Ab Akt 2 hat die Elite ein Mittel gegen die Kette
    // (ab Akt 3 kann es der Sprinkler sein) und der Boss ebenfalls eines; die Löschdecke liegt nur beim letzten Boss
    // des Casinos und in der Nachglut bereit. Mehr als eines bietet kein Tisch auf.
    if (enc.kind === 'battle' || act === 1) return [];
    if (enc.kind === 'boss') return act >= this.acts() ? ['blanket'] : [n % 2 ? 'sand' : 'water'];
    return [act >= 3 ? ['water', 'sprinkler', 'sand'][n % 3] : n % 2 ? 'sand' : 'water'];
  };
  /* ---------- Kniffe ---------- */
  Run.prototype.kniffSlots = function () { return this.meta().kniffSlots || 1; };
  Run.prototype.kniffe = function () { return this.s.kniffe || (this.s.kniffe = []); };

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
    // Bosse, die überall sitzen können: zum Einstieg die kleinen, dann die mittleren, im vorletzten Akt großer Häuser die
    // ganz oben; dazwischen alles darunter. Der letzte Akt gehört dem Boss des Hauses, die Nachglut allen.
    var acts = this.acts(), tiers = ZU.BOSS_ACTS, bosses;
    var foes = (!this.meta().legacy && this.casino().foes) || null, inside = s.act <= acts;
    if (s.act > acts) bosses = [].concat.apply([], tiers).concat(foes && foes.boss ? [foes.boss] : []);
    else if (s.act === acts) bosses = tiers[2];
    else if (s.act === 1) bosses = tiers[0];
    else if (s.act === 2) bosses = tiers[1];
    else if (s.act === acts - 1) bosses = tiers[2];
    else bosses = tiers[0].concat(tiers[1]);
    var lastCall = this.rule('last-call');
    // Eigene Figuren des Casinos: Der erste Tisch eröffnet das Haus, die erste Elite wartet im zweiten Akt; die zweite
    // Belegschaft folgt im dritten (Tisch) und vierten Akt (Elite). Der Boss des Hauses sitzt im letzten.
    var ownBattles = (foes && foes.battle) || [], ownElites = (foes && foes.elite) || [];
    var battles = ZU.BATTLE_POOL.concat(ownBattles), elites = ZU.ELITE_POOL.concat(ownElites);
    function own(id) { if (s.seen.indexOf(id) < 0) s.seen.push(id); return id; }
    var setBattle = inside ? (s.act === 1 ? ownBattles[0] : s.act === 3 ? ownBattles[1] : null) : null;
    var setElite = inside ? (s.act === 2 ? ownElites[0] : s.act === 4 ? ownElites[1] : null) : null;
    s.encounters = [
      { enemy: setBattle ? own(setBattle) : fresh(battles), kind: 'battle' },
      { enemy: setElite ? own(setElite) : fresh(elites), kind: 'elite' },
      { enemy: foes && foes.boss && s.act === acts ? own(foes.boss) : fresh(bosses), kind: 'boss' }
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
    if (this.has('armutsgeluebde')) base *= 0.5;
    return Math.max(2, Math.round(base));
  };

  /* ---------- Duell ---------- */
  Run.prototype.newDuel = function () {
    var e = this.encounter(), s = this.s;
    s.phase = 'duel';
    s.tk = s.tk || {};
    this.madness = null;
    if (e.kind === 'boss' && this.has('wahnsinn') && s.madAt !== s.act + ':' + s.table) {
      // Wahnsinn: Vor dem Boss verbrennt ein anderes Trinket – einmal je Bosstisch, auch wenn er wiederholt wird.
      var others = s.trinkets.filter(function (id) { return id !== 'wahnsinn'; });
      s.madAt = s.act + ':' + s.table;
      if (others.length) {
        var victim = this.rng.pick(others);
        s.trinkets.splice(s.trinkets.indexOf(victim), 1);
        s.tk.wahnsinn = (s.tk.wahnsinn || 0) + 1;
        this.madness = victim;
      }
    }
    if (this.has('popcorn') && !s.tk.popcorn) s.tk.popcorn = 3;
    return new ZU.Duel({
      rng: this.rng, enemyId: e.enemy, kind: e.kind, act: this.s.act,
      rules: e.rules || [],
      house: this.houseRules(),
      target: this.glutTarget(e.kind),
      kniffe: this.kniffe().map(function (k) { return { id: k.id, level: k.level }; }),
      douse: this.douse(e),
      grow: { burned: this.s.burnCount || 0, bosses: this.s.bossesBeaten || 0, money: this.s.money, trinkets: this.s.trinkets.length, lastChain: this.s.lastChain || 0,
        deck: this.s.collection.length, sealed: this.s.collection.filter(function (c) { return ZU.sealsOf(c).length > 0; }).length, act: this.s.act,
        wins: this.s.stats.wins, streak: this.s.streak || 0, lastLost: !!this.s.lastLost, burnt: this.s.burntCount || 0,
        lives: s.lives, missing: Math.max(0, this.maxLives() - s.lives), skipped: s.stats.skipped || 0, burnAct: s.burnAct === s.act ? s.burnActN || 0 : 0,
        played: s.stats.played || 0, sevens: s.sevens || 0, multi: s.multi || 0, packs: s.packs || 0, added: s.added || 0,
        popcorn: s.tk.popcorn || 0, wahnsinn: s.tk.wahnsinn || 0 },
      perks: this.s.perks || [],
      specialPool: this.meta().specials,
      trinkets: this.s.trinkets, collection: this.s.collection.map(function (c) { return { id: c.id, def: c.def, bind: c.bind, seals: ZU.sealsOf(c), flaws: ZU.flawsOf(c), plus: c.plus || 0 }; }),
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
    s.sevens = (s.sevens || 0) + duel.stats.sevens; // Däumling
    s.multi = (s.multi || 0) + duel.stats.pairs; // Ersatzhose
    if (this.has('wandersmann')) {
      s.collection.forEach(function (c) { if (duel.plus[c.id]) c.plus = (c.plus || 0) + duel.plus[c.id]; });
    }
    // Trinkets, die sich verbrauchen: Selterswasser (5 Duelle), Popcorn (wird weniger), Banane (verfault vielleicht)
    var spoiled = [];
    s.tk = s.tk || {};
    function drop(id) { var at = s.trinkets.indexOf(id); if (at >= 0) { s.trinkets.splice(at, 1); spoiled.push(id); } }
    if (this.has('selters')) { s.tk.selters = (s.tk.selters || 0) + 1; if (s.tk.selters >= 5) drop('selters'); }
    if (this.has('popcorn')) { s.tk.popcorn = (s.tk.popcorn || 3) - 0.5; if (s.tk.popcorn <= 1) { drop('popcorn'); delete s.tk.popcorn; } }
    if (this.has('banane') && this.rng.next() < (this.has('hasenpfote') ? 2 : 1) / 6) drop('banane');

    if (duel.winner !== 'player') {
      s.stats.losses++;
      var saved = false, spared = false, comfort = 0, bones = false;
      if (this.has('herr-knochen') && duel.target > 0 && duel.glut * 2 >= duel.target) {
        // Herr Knochen: knapp verloren kostet kein Streichholz – einmal
        s.trinkets.splice(s.trinkets.indexOf('herr-knochen'), 1);
        spared = true; bones = true;
      } else if (this.has('phoenixfeder') && s.phoenix !== s.act) {
        s.phoenix = s.act; // Phönixfeder: die erste Niederlage je Akt kostet nichts
        spared = true;
      } else if (s.lives === 1 && this.has('golden-match')) {
        s.trinkets.splice(s.trinkets.indexOf('golden-match'), 1);
        saved = true;
      } else {
        s.lives--;
        s.hurt = true;
      }
      // Vabanque: alles auf eine Karte – die Niederlage kostet das Trinket.
      var gone = null;
      if (s.trinkets.indexOf('vabanque') >= 0) { s.trinkets.splice(s.trinkets.indexOf('vabanque'), 1); gone = 'vabanque'; }
      if (this.has('dicke-brieftasche')) comfort += Math.round(duel.bank * this.scale());
      if (this.has('police')) comfort += Math.round(this.baseReward(e.kind) * 0.6);
      s.lastChain = duel.maxChain;
      s.money += comfort;
      ZU.Meta.noteDuel(this, duel, false);
      s.phase = s.lives <= 0 ? 'defeat' : 'select';
      this._sync();
      if (s.phase === 'defeat') this._closeRun(false); else this.save();
      return { won: false, saved: saved, spared: spared, comfort: comfort, lives: s.lives, gone: gone, bones: bones, spoiled: spoiled };
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
    var traits = duel.enemy.traits || {};
    var held = duel.enemy.passive === 'purser' || duel.enemy.passive === 'house-cut' ? Math.floor(duel.bank / 2) :
      traits.bankCut ? Math.floor(duel.bank * (1 - traits.bankCut)) : duel.bank; // Zahlmeister Pfennig behält die Hälfte ein
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
    if (burnt) s.burntCount = (s.burntCount || 0) + 1; // Kerbholz zählt mit
    if (burnt) lines.push({ label: 'Tisch abgefackelt', amount: share(0.5) });
    if (doublings > 0) lines.push({ label: 'Überschuss: Ziel ×' + Math.pow(2, doublings), amount: share(0.5) * doublings * (this.has('funkenregen') ? 2 : 1) });
    if (burnt && this.has('brandpraemie')) lines.push({ label: 'Brandprämie (+50 %)', amount: share(0.5), trinket: 'brandpraemie' });
    if (duel.wonBy === 'curfew' && this.has('nachtschicht')) lines.push({ label: 'Nachtschicht (+50 %)', amount: share(0.5), trinket: 'nachtschicht' });
    if (this.has('trinkgeld') && s.money >= 5) lines.push({ label: 'Spendierhosen (10 % der Kasse)', amount: Math.min(base, Math.max(1, Math.round(s.money * 0.1))), trinket: 'trinkgeld' });
    if (duel.enemy.passive === 'odds') lines.push({ label: 'Wettschein', amount: share(0.3) });
    if (traits.bonus) lines.push({ label: duel.enemy.name + ' zahlt drauf (+' + Math.round(traits.bonus * 100) + ' %)', amount: share(traits.bonus) });
    var sevensInDeck = s.collection.filter(function (c) { return ZU.CARDS[c.def].rank === '7'; }).length;
    if (this.has('wolke-sieben') && sevensInDeck) lines.push({ label: 'Wolke Sieben (' + sevensInDeck + ' Siebenen)', amount: share(0.05 * sevensInDeck), trinket: 'wolke-sieben' });
    if (this.has('rakete') && s.bossesBeaten) lines.push({ label: 'Rakete (+' + (s.bossesBeaten * 10) + ' %)', amount: share(0.1 * s.bossesBeaten), trinket: 'rakete' });
    if (this.has('geduldsfaden') && duel.volDraws === 0) lines.push({ label: 'Geduldsfaden (+50 %)', amount: share(0.5), trinket: 'geduldsfaden' });
    if (this.has('notgroschen') && s.lives === 1) lines.push({ label: 'Notgroschen (+100 %)', amount: share(1), trinket: 'notgroschen' });
    if (this.has('lucky-chip')) lines.push({ label: 'Glückschip (+20 %)', amount: share(0.2), trinket: 'lucky-chip' });
    if (e.kind !== 'battle' && this.has('kopfgeld')) lines.push({ label: 'Kopfgeld (+40 %)', amount: share(0.4), trinket: 'kopfgeld' });
    if (duel.maxChain >= 8 && this.has('zylinder')) lines.push({ label: 'Zylinder (Kette ×' + duel.maxChain + ')', amount: share(0.4), trinket: 'zylinder' });
    if (duel.turns <= 16 && this.has('sturmfeuerzeug')) lines.push({ label: 'Sturmfeuerzeug (' + duel.turns + ' Züge)', amount: share(0.4), trinket: 'sturmfeuerzeug' });
    if (this.has('sammleralbum') && s.trinkets.length >= 3) lines.push({ label: 'Sammleralbum (+' + (Math.floor(s.trinkets.length / 3) * 10) + ' %)', amount: share(0.1 * Math.floor(s.trinkets.length / 3)), trinket: 'sammleralbum' });
    if (e.kind === 'boss' && this.meta().bossTip) lines.push({ label: 'Trinkgeld', amount: share(this.meta().bossTip) });
    // Zinsen: 1 Mark je 5 gesparte (mit Zinseszins je 4); die Obergrenze wächst mit dem Akt.
    var cap = Math.round(3 * scale * (this.has('ledger') ? 2 : 1) * (1 + 0.25 * (this.meta().interest || 0)) * (this.has('patron') ? 1.5 : 1));
    var step = this.has('compound') ? 4 : 5;
    var interest = this.rule('no-credit') && !this.has('patron') ? 0 : Math.min(cap, Math.floor(s.money / step));
    if (interest > 0) lines.push({ label: 'Zinsen (1 je ' + step + ' Mark, max. ' + cap + ')', amount: interest });

    var total = 0;
    lines.forEach(function (line) { total += line.amount; });
    if (duel.toll > 0) {
      var toll = Math.min(duel.toll, Math.max(0, total - 1)); // Makel „Zoll": nie mehr, als die Auszahlung hergibt
      if (toll > 0) { lines.push({ label: 'Zoll (' + duel.toll + ' Karten)', amount: -toll }); total -= toll; }
    }
    if (this.rule('tax') && total > 1) {
      var tax = Math.max(1, Math.round(total * 0.15)); // Hausregel „Vergnügungssteuer"
      lines.push({ label: 'Vergnügungssteuer (15 %)', amount: -tax });
      total -= tax;
    }
    s.money += total;
    s.stats.earned += total;
    s.score += duel.glut + 100 * s.act;
    s.lastChain = duel.maxChain;
    if (e.kind === 'boss') s.bossesBeaten = (s.bossesBeaten || 0) + 1;
    // Kuckucksei: nach drei Siegen schlüpft ein seltenes Trinket
    var hatched = null;
    if (this.has('kuckucksei')) {
      s.tk.egg = (s.tk.egg || 0) + 1;
      if (s.tk.egg >= 3) {
        var rares = this._trinketPool().filter(function (id) { return ZU.TRINKETS[id].rarity === 2; });
        s.trinkets.splice(s.trinkets.indexOf('kuckucksei'), 1);
        delete s.tk.egg;
        if (rares.length) { hatched = this.rng.pick(rares); s.trinkets.push(hatched); }
      }
    }

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
    // Ein Sieg zahlt Mark und Asche. Die Wahl aus drei Stücken gibt es nur noch für einen ausgelassenen Tisch (skipTable).
    s.reward = null;
    s.phase = 'payout';
    this._sync();
    return { won: true, lines: lines, total: total, healed: healed, glut: duel.glut, maxChain: duel.maxChain, ash: ash, lostCards: lostCards, target: target, burnt: burnt, doublings: doublings,
      spoiled: spoiled, hatched: hatched };
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

  /* ---------- Tisch auslassen ----------
     Den ersten Tisch und die Elite eines Akts kann man auslassen, den Boss nie. Wer auslässt, spielt nicht, bekommt
     weder Prämie noch Asche und kommt nicht in Manfreds Laden – dafür gibt es die Wahl aus drei Stücken: am ersten
     Tisch Spezialkarten, bei der Elite Trinkets. */
  Run.SKIP_REWARD = { battle: 'card', elite: 'trinket' };
  /* Art der Belohnung fürs Auslassen des Tisches (oder null: Dieser Tisch lässt sich nicht auslassen). */
  Run.prototype.skipReward = function (enc) {
    enc = enc || this.encounter();
    var type = enc ? Run.SKIP_REWARD[enc.kind] : null;
    if (!type) return null;
    var pool = type === 'trinket' ? this._trinketPool() : this._specialPool().filter(function (id) { return ZU.CARDS[id].rarity >= 1; });
    return pool.length ? type : null; // nichts mehr zu holen: dann bleibt nur das Spiel
  };
  Run.prototype.canSkip = function () { return this.s.phase === 'select' && !!this.skipReward(); };
  Run.prototype._rollReward = function (type) {
    if (type === 'trinket') {
      var options = this._weighted(this._trinketPool(), function (id) { return [50, 32, 16, 4][ZU.TRINKETS[id].rarity]; }, 3);
      return options.length ? { type: 'trinket', options: options, skip: 4 } : null;
    }
    var specials = this._weighted(this._specialPool().filter(function (id) { return ZU.CARDS[id].rarity >= 1; }),
      function (id) { return [0, 40, 40, 14][ZU.CARDS[id].rarity]; }, 3);
    // Die Beute ist freier gebunden als das, was der Akt sonst hergibt.
    var rng = this.rng, ahead = this.s.act + 1;
    return specials.length ? { type: 'card', options: specials, binds: specials.map(function () { return ZU.rollBind(rng, ahead); }), skip: 5 } : null;
  };
  /* Lässt den aktuellen Tisch aus: Die Wahl steht an; danach geht es ohne Laden zum nächsten Tisch. */
  Run.prototype.skipTable = function () {
    var s = this.s;
    if (!this.canSkip()) throw new Error('Dieser Tisch lässt sich nicht auslassen.');
    var reward = this._rollReward(this.skipReward());
    reward.via = 'skip';
    if (this.has('pass')) s.money += Math.max(1, Math.round(this.baseReward(this.encounter().kind) * 0.5)); // Privileg „Freikarte"
    s.reward = reward;
    this.encounter().skipped = true;
    s.stats.skipped = (s.stats.skipped || 0) + 1;
    ZU.Meta.note({ skipped: 1 });
    s.phase = 'reward';
    this._sync();
    this.save();
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
    if (r.via === 'skip') {
      // Ausgelassener Tisch: kein Laden, der nächste Gegner wartet schon. (Der Boss lässt sich nicht auslassen, es bleibt also im Akt.)
      s.table++;
      s.phase = 'select';
    } else {
      this._openShop(); // Spielstände von früher: Die Wahl nach einem Sieg führt wie damals in den Laden
    }
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
    // Nach dem Boss gehört der Laden schon zum nächsten Akt: neue Preise, neues Privileg.
    if (this.s.table >= 2) {
      this.s.table = -1;
      this.s.act++;
      this._encounters();
      this._newAct();
    }
    this.s.shop = { cards: [], specials: [], trinkets: [], rerolls: 0, discount: this.has('false-bottom'), healed: false, burned: false, esme: { packs: [], rerolls: 0, pity: false } };
    this._stockEsme();
    if (this.rule('cover-charge')) this.s.money = Math.max(0, this.s.money - Math.max(2, Math.round(this.s.money * 0.1))); // Hausregel „Eintritt"
    if (this.has('mitgift')) this.s.money += Math.max(3, Math.round(this.s.money * 0.15));
    if (!this.s.perkOffer || this.s.perkOffer.act !== this.s.act) this._rollPerk();
    this._stockShop();
    this.s.phase = 'shop';
  };

  /* Ein neuer Akt beginnt. Gesindel: Ein gewöhnliches Trinket läuft zu. */
  Run.prototype._newAct = function () {
    var s = this.s;
    s.gift = null;
    if (!this.has('gesindel')) return;
    var commons = this._trinketPool().filter(function (id) { return ZU.TRINKETS[id].rarity === 0; });
    if (!commons.length) return;
    s.gift = this.rng.pick(commons);
    s.trinkets.push(s.gift);
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
    shop.cards = pool.slice(0, this.has('annex') ? 5 : 3).map(function (def) { return { def: def, price: self._price(ZU.cardPrice(def)), sold: false }; });
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
    if (this.has('blackmarket') && picks.length && !picks.some(function (id) { return ZU.TRINKETS[id].rarity >= 2; })) {
      // Schwarzmarkt: Mindestens ein seltenes oder legendäres Stück liegt aus.
      var fine = this._weighted(this._trinketPool().filter(function (id) { return ZU.TRINKETS[id].rarity >= 2; }), function (id) { return ZU.TRINKETS[id].rarity === 2 ? 4 : 1; }, 1)[0];
      if (fine) picks[picks.length - 1] = fine;
    }
    shop.trinkets = picks.map(function (id) { return { id: id, price: self._price(ZU.TRINKETS[id].price), sold: false }; });
  };

  /* ---------- Esmes Nebenzimmer: Karten veredeln ---------- */
  Run.prototype._sealPool = function () {
    return (this.meta().seals || ZU.SEAL_IDS).filter(function (id) { return ZU.SEALS[id]; });
  };
  /* Wie oft ein Paket einen Makel trägt: früh im Casino oft (und billig), gegen Ende selten. */
  Run.prototype.flawChance = function () {
    var acts = this.acts(), t = acts > 1 ? Math.min(1, (this.s.act - 1) / (acts - 1)) : 1;
    return this.has('esme-favor') ? 0 : 0.67 - 0.42 * t; // Privileg „Esmes Gunst": makellos
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
  /* Normale Karten, die sich veredeln lassen. Eine Karte trägt bis zu ZU.SEAL_SLOTS Siegel, jedes nur einmal, und nie
     eines neben einem Makel, der es aufhöbe (ZU.sealFits). pack: nur Karten, auf die jedes Stück des Pakets passt. */
  Run.prototype.sealable = function (pack) {
    var items = pack ? pack.items : null;
    return this.s.collection.filter(function (c) {
      if (ZU.CARDS[c.def].special) return false;
      return items ? items.every(function (item) { return ZU.sealFits(c, item); }) : ZU.sealsOf(c).length < ZU.SEAL_SLOTS;
    });
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
     Liefert, welche Karte welches Siegel bekommen hat. Das neue Siegel kommt zu denen hinzu, die die Karte schon trägt. */
  Run.prototype.buyPack = function (index, cardIds) {
    var s = this.s, pack = s.shop.esme.packs[index], self = this;
    if (!pack || pack.sold) throw new Error('Nicht verfügbar.');
    var pool = this.sealable(), targets, items = pack.items;
    if (pack.kind === 'bag') {
      // Jedes Stück sucht sich eine eigene Karte, auf die es passt; findet eines keine, verfällt es.
      var free = this.rng.shuffle(pool.slice());
      targets = []; items = [];
      pack.items.forEach(function (item) {
        for (var i = 0; i < free.length; i++) {
          if (ZU.sealFits(free[i], item)) { targets.push(free.splice(i, 1)[0]); items.push(item); return; }
        }
      });
    } else {
      targets = (cardIds || []).map(function (id) { return pool.filter(function (c) { return c.id === id; })[0]; });
      if (targets.length !== pack.items.length || targets.some(function (c) { return !c; }) ||
        targets.some(function (c, i) { return targets.indexOf(c) !== i; })) throw new Error('Wähle ' + pack.items.length + ' verschiedene normale Karten.');
      if (targets.some(function (c, i) { return !ZU.sealFits(c, items[i]); })) throw new Error('Das Siegel passt nicht auf diese Karte.');
    }
    if (!targets.length) throw new Error('Keine Karte zum Veredeln.');
    this._pay(pack.price);
    pack.sold = true;
    var result = targets.map(function (card, i) {
      var item = items[i];
      card.seals = ZU.sealsOf(card).concat([item.seal]);
      card.flaws = ZU.flawsOf(card).concat(item.flaw && ZU.flawsOf(card).indexOf(item.flaw) < 0 ? [item.flaw] : []);
      delete card.seal;
      delete card.flaw;
      if (!card.flaws.length) delete card.flaws;
      return { id: card.id, def: card.def, seal: item.seal, flaw: item.flaw || null };
    });
    ZU.Meta.note({ sealed: result.length });
    s.packs = (s.packs || 0) + 1; // Glaskugel
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
  Run.prototype.healPrice = function () { return Math.max(1, Math.round(6 * this.scale() * (this.has('feuerversicherung') ? 0.6 : 1) * (this.rule('first-class') ? 2 : 1))); };
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
        if (s.burnAct !== s.act) { s.burnAct = s.act; s.burnActN = 0; } // Lagerfeuer zählt je Akt
        s.burnActN++;
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
      this._newAct();
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
    if (!this.s.rid) this.s.rid = Run.rid(this.s);
    this.s.step = (this.s.step || 0) + 1;
    this.s.at = Date.now();
    try { store.setItem(SAVE_KEY, JSON.stringify(this.s)); } catch (e) { /* voller Speicher: Spiel läuft weiter */ }
    if (Run.onSave) Run.onSave();
  };

  /* ---------- Abgleich über Geräte hinweg ---------- */
  /* Wird nach jedem Speichern und Löschen gerufen (das Konto reicht den Run dann weiter). */
  Run.onSave = null;
  /* Spielstände aus der Zeit vor der Kennung: Sie ergibt sich aus dem Seed, damit zwei Geräte denselben Run erkennen. */
  Run.rid = function (state) { return state ? state.rid || 's' + state.seed : ''; };
  /* Kurzform eines gespeicherten Runs: Kennung und Speicherzähler. '' = kein Run. */
  Run.sig = function (state) { return state ? Run.rid(state) + ':' + (state.step || 0) : ''; };
  /* Der gespeicherte Run, so wie er im Speicher liegt (ohne ihn zu prüfen oder umzubauen). */
  Run.raw = function () {
    var store = storage();
    if (!store) return null;
    try {
      var state = JSON.parse(store.getItem(SAVE_KEY) || 'null');
      return state && typeof state === 'object' && state.v === 1 && Array.isArray(state.collection) ? state : null;
    } catch (e) { return null; }
  };
  /* Legt einen Run vom Konto auf dem Gerät ab (null: es gibt keinen mehr). Meldet das nicht zurück ans Konto. */
  Run.store = function (state) {
    var store = storage();
    if (!store) return;
    try {
      if (state) store.setItem(SAVE_KEY, JSON.stringify(state)); else store.removeItem(SAVE_KEY);
    } catch (e) { /* egal */ }
  };
  /* Welcher Run gilt, wenn Gerät (local) und Konto (remote) auseinanderliegen? base ist die Kurzform des Runs beim
     letzten Abgleich (null: es gab noch keinen). Ergebnis: 'same', 'local', 'remote' oder 'ask' – zwei verschiedene
     Runs, auf beiden Seiten weitergespielt: Das kann nur der Spieler entscheiden. */
  Run.pick = function (base, local, remote) {
    var l = Run.sig(local), r = Run.sig(remote);
    if (l === r) return 'same';
    var same = !!local && !!remote && Run.rid(local) === Run.rid(remote);
    var further = (local && local.step || 0) >= (remote && remote.step || 0) ? 'local' : 'remote';
    if (base == null) return !local ? 'remote' : !remote ? 'local' : same ? further : 'ask';
    if (l === base) return 'remote';
    if (r === base) return 'local';
    var bid = base.slice(0, base.lastIndexOf(':'));
    // Hier beendet, dort denselben Run weitergespielt (oder umgekehrt): Beendet bleibt beendet. Ein neuer Run dagegen gilt.
    if (!local) return Run.rid(remote) === bid ? 'local' : 'remote';
    if (!remote) return Run.rid(local) === bid ? 'remote' : 'local';
    return same ? further : 'ask';
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
      // Runs aus der Zeit mit sechs oder acht Casinos: Der Index des Hauses wandert an seinen neuen Platz.
      if (state.meta && state.meta.cv !== ZU.CASINO_VERSION) {
        state.meta.stake = ZU.casinoIndex(state.meta.stake || 0, state.meta.cv);
        state.meta.cv = ZU.CASINO_VERSION;
      }
      if (state.shop && !state.shop.specials) state.shop.specials = []; // Spielstände vor dem geteilten Laden
      // Spielstände aus der Zeit mit einem Siegel und einem Makel je Karte: Beide werden zu Listen.
      state.collection.forEach(function (card) {
        if (card.seal || card.seals) card.seals = ZU.sealsOf(card);
        if (card.flaw || card.flaws) card.flaws = ZU.flawsOf(card);
        delete card.seal;
        delete card.flaw;
        if (card.seals && !card.seals.length) delete card.seals;
        if (card.flaws && !card.flaws.length) delete card.flaws;
      });
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
      // Kniffe gibt es nicht mehr im Run zu kaufen: offene Angebote aus alten Spielständen verfallen.
      delete state.kniffOffer;
      if (state.reward) delete state.reward.kniff;
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
    if (Run.onSave) Run.onSave();
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
      return { runs: 0, wins: 0, best: 0, bestAct: 0, seenHelp: false, meta: {}, brSeen: [], popSeen: [], popInit: false, avatar: {}, deck: 'classic', story: {},
        settings: { music: 0.5, sfx: 0.7, voice: 0.7, speed: 1, crt: true, bg: true, story: true, fullscreen: 'ask', offline: false } };
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
      if (ZU.Profile.onSave) ZU.Profile.onSave();
    },
    /* Wird nach jedem Speichern gerufen (das Konto gleicht Fortschritt, Figur und Merkzettel dann ab). */
    onSave: null
  };

  ZU.Run = Run;
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
