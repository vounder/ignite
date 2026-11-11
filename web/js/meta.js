/* Zündung – Meta-Progression: was über einzelne Runs hinaus bleibt. Ohne DOM.
   Asche ist die Währung; sie schaltet im Hinterzimmer Inhalte und kleine Upgrades frei.
   Einsätze sind Schwierigkeitsstufen, die nach Siegen freigeschaltet werden. */
(function (ZU) {
  'use strict';

  /* Was von Anfang an im Spiel ist. Alles andere muss im Hinterzimmer freigeschaltet werden. */
  var BASE = {
    starter: ['classic'],
    trinket: ['lucky-chip', 'ashtray', 'false-bottom', 'ledger', 'fuse', 'brass-knuckles', 'pocket-watch', 'gold-tooth', 'cellar-key', 'counterfeit', 'loyalty'],
    special: ['stillstand', 'addieren', 'spion', 'fluch', 'hodl', 'opfer']
  };
  var STARTER_COST = { igniter: 8, cheater: 10, alchemist: 10 };

  var M = {
    BASE: BASE,

    /* Dauerhafte Upgrades: bewusst klein gehalten, damit frühe Runs nicht trivial werden. */
    UPGRADES: {
      startgeld: { name: 'Startkapital', text: '+2 Mark Startgeld je Stufe.', costs: [6, 10, 15] },
      stammkunde: { name: 'Stammkunde', text: 'Die erste Neue Auslage in jedem Laden ist gratis.', costs: [10] },
      spuernase: { name: 'Spürnase', text: 'Im Spezialkarten-Regal liegt öfter etwas (+10 % je Stufe).', costs: [8, 14] },
      reserve: { name: 'Reserveholz', text: 'Du beginnst mit einem vierten Streichholz.', costs: [25] }
    },
    UPGRADE_IDS: ['startgeld', 'stammkunde', 'spuernase', 'reserve'],

    /* Einsätze: jede Stufe gilt zusätzlich zu allen darunter und bringt 25 % mehr Asche. */
    STAKES: [
      { name: 'Kleingeld', text: 'Die normalen Hausregeln.' },
      { name: 'Erhöhter Einsatz', text: '„Letzter Stapel“ gilt deutlich häufiger.' },
      { name: 'Heißes Pflaster', text: 'Gegner verschenken nur noch halb so oft einen Zug.' },
      { name: 'Teures Pflaster', text: 'Alles in Manfreds Laden kostet 20 % mehr.' },
      { name: 'Knappe Kasse', text: 'Jede Tischprämie fällt 2 Mark niedriger aus.' },
      { name: 'Alles oder nichts', text: 'Gegner beginnen mit einer Karte weniger.' }
    ],
    ASH: { battle: 1, elite: 2, boss: 5, victory: 8 },

    defaults: function () {
      return { ash: 0, earned: 0, unlocked: {}, upgrades: {}, stake: 0, maxStake: 0, defeated: {} };
    },

    /* Bringt gespeicherte oder vom Server gelieferte Daten in eine gültige Form. */
    clean: function (raw) {
      var meta = M.defaults();
      if (!raw || typeof raw !== 'object') return meta;
      function count(value, max) {
        var n = Math.floor(Number(value));
        return isFinite(n) && n > 0 ? Math.min(n, max) : 0;
      }
      meta.ash = count(raw.ash, 1000000);
      meta.earned = count(raw.earned, 10000000);
      meta.maxStake = count(raw.maxStake, M.STAKES.length - 1);
      meta.stake = Math.min(count(raw.stake, M.STAKES.length - 1), meta.maxStake);
      if (raw.unlocked && typeof raw.unlocked === 'object') {
        Object.keys(raw.unlocked).forEach(function (key) {
          var parts = key.split(':');
          if (raw.unlocked[key] && M.exists(parts[0], parts[1])) meta.unlocked[key] = true;
        });
      }
      if (raw.upgrades && typeof raw.upgrades === 'object') {
        M.UPGRADE_IDS.forEach(function (id) {
          var level = count(raw.upgrades[id], M.UPGRADES[id].costs.length);
          if (level) meta.upgrades[id] = level;
        });
      }
      if (raw.defeated && typeof raw.defeated === 'object') {
        Object.keys(raw.defeated).forEach(function (id) {
          if (ZU.ENEMIES[id] && count(raw.defeated[id], 100000)) meta.defeated[id] = count(raw.defeated[id], 100000);
        });
      }
      return meta;
    },

    exists: function (kind, id) {
      if (kind === 'starter') return ZU.STARTERS.some(function (s) { return s.id === id; });
      if (kind === 'trinket') return !!ZU.TRINKETS[id];
      if (kind === 'special') return !!(ZU.CARDS[id] && ZU.CARDS[id].special);
      return false;
    },

    /* Hat das Profil schon Fortschritt? Entscheidet beim Anmelden, welcher Stand gilt. */
    touched: function (meta) {
      return !!meta && (meta.earned > 0 || meta.maxStake > 0 || Object.keys(meta.unlocked || {}).length > 0 || Object.keys(meta.upgrades || {}).length > 0);
    },

    get: function () {
      return M.clean(ZU.Profile.load().meta);
    },

    /* Schreibt den Fortschritt ins Profil und meldet die Änderung (z. B. ans Konto). */
    put: function (meta, silent) {
      var profile = ZU.Profile.load();
      profile.meta = M.clean(meta);
      ZU.Profile.save(profile);
      if (ZU.game) ZU.game.profile = profile;
      if (!silent && M.onChange) M.onChange(profile.meta);
      return profile.meta;
    },
    onChange: null,

    isUnlocked: function (meta, kind, id) {
      return BASE[kind].indexOf(id) >= 0 || !!meta.unlocked[kind + ':' + id];
    },

    cost: function (kind, id) {
      if (kind === 'starter') return STARTER_COST[id] || 10;
      if (kind === 'trinket') return [4, 5, 8, 12][ZU.TRINKETS[id].rarity];
      return [4, 6, 8, 12][ZU.CARDS[id].rarity];
    },

    /* Alle noch gesperrten Inhalte einer Art, in Spielreihenfolge. */
    locked: function (meta, kind) {
      var all = kind === 'starter' ? ZU.STARTERS.map(function (s) { return s.id; }) : kind === 'trinket' ? ZU.TRINKET_IDS : ZU.SPECIAL_IDS;
      return all.filter(function (id) { return !M.isUnlocked(meta, kind, id); });
    },

    unlock: function (kind, id) {
      var meta = M.get();
      if (!M.exists(kind, id) || M.isUnlocked(meta, kind, id)) return { ok: false, error: 'known' };
      var price = M.cost(kind, id);
      if (meta.ash < price) return { ok: false, error: 'poor' };
      meta.ash -= price;
      meta.unlocked[kind + ':' + id] = true;
      M.put(meta);
      return { ok: true };
    },

    level: function (meta, id) { return meta.upgrades[id] || 0; },
    upgradeCost: function (meta, id) {
      var costs = M.UPGRADES[id].costs, level = M.level(meta, id);
      return level < costs.length ? costs[level] : null;
    },
    upgrade: function (id) {
      var meta = M.get(), price = M.UPGRADES[id] ? M.upgradeCost(meta, id) : null;
      if (price == null) return { ok: false, error: 'max' };
      if (meta.ash < price) return { ok: false, error: 'poor' };
      meta.ash -= price;
      meta.upgrades[id] = M.level(meta, id) + 1;
      M.put(meta);
      return { ok: true };
    },

    setStake: function (stake) {
      var meta = M.get();
      meta.stake = Math.max(0, Math.min(meta.maxStake, stake));
      M.put(meta);
      return meta.stake;
    },

    /* Was ein neuer Run aus dem Fortschritt mitnimmt. Wird im Run gespeichert, damit sich laufende Runs nicht ändern. */
    runOptions: function (meta) {
      meta = meta || M.get();
      function open(kind, all) { return all.filter(function (id) { return M.isUnlocked(meta, kind, id); }); }
      return {
        stake: meta.stake,
        startgeld: M.level(meta, 'startgeld') * 2,
        freeReroll: M.level(meta, 'stammkunde') > 0,
        shopBonus: M.level(meta, 'spuernase') * 0.1,
        maxLives: ZU.MAX_LIVES + (M.level(meta, 'reserve') > 0 ? 1 : 0),
        trinkets: open('trinket', ZU.TRINKET_IDS),
        specials: open('special', ZU.SPECIAL_IDS)
      };
    },

    /* Asche, die ein Run bisher wert ist (mit Einsatz-Bonus). */
    ashFor: function (run) {
      return Math.round((run.s.ash || 0) * (1 + 0.25 * (run.meta().stake || 0)));
    },

    /* Zahlt aus, was seit der letzten Auszahlung dazugekommen ist. Liefert den ausgezahlten Betrag. */
    award: function (run) {
      var due = M.ashFor(run) - (run.s.ashPaid || 0);
      if (due <= 0) return 0;
      run.s.ashPaid = (run.s.ashPaid || 0) + due;
      var meta = M.get();
      meta.ash += due;
      meta.earned += due;
      M.put(meta);
      return due;
    },

    noteDefeat: function (enemyId) {
      var meta = M.get();
      meta.defeated[enemyId] = (meta.defeated[enemyId] || 0) + 1;
      M.put(meta, true); // reine Kartei: wird mit der nächsten echten Änderung mitgeschickt
    },

    /* Ein Sieg auf dem höchsten freien Einsatz schaltet den nächsten frei. Liefert dessen Index oder null. */
    noteVictory: function (run) {
      var meta = M.get(), stake = run.meta().stake || 0;
      if (stake < meta.maxStake || meta.maxStake >= M.STAKES.length - 1) return null;
      meta.maxStake++;
      M.put(meta);
      return meta.maxStake;
    }
  };

  ZU.Meta = M;
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
