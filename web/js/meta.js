/* Zündung – Meta-Progression: was über einzelne Runs hinaus bleibt. Ohne DOM.
   Asche ist die Währung; sie kauft im Hinterzimmer Inhalte und Upgrades.
   Casinos sind die Schwierigkeitsstufen: Ein Sieg im bisher schwersten öffnet das nächste.
   Was es im Hinterzimmer zu kaufen gibt, muss erst entdeckt werden – durch Taten am Tisch (REQ). */
(function (ZU) {
  'use strict';

  /* Was von Anfang an im Spiel ist. Alles andere muss im Hinterzimmer entdeckt und gekauft werden. */
  var BASE = {
    starter: ['classic'],
    trinket: ['lucky-chip', 'ashtray', 'false-bottom', 'ledger', 'fuse', 'brass-knuckles', 'pocket-watch', 'gold-tooth', 'cellar-key', 'counterfeit', 'loyalty',
      'kreuzfeuer', 'bauernopfer', 'rotlicht', 'volle-zehn', 'erster-funke', 'volles-haus', 'heisse-ware', 'endspurt',
      'schwarzer-peter', 'schadenfreude', 'bierdeckel', 'trinkgeld', 'rabattmarke', 'nachtschicht'],
    special: ['stillstand', 'addieren', 'spion', 'fluch', 'hodl', 'opfer'],
    seal: ['glut', 'gold', 'anker']
  };
  var STARTER_COST = { igniter: 8, cheater: 10, alchemist: 10, hearts: 10, carny: 10, picked: 10, hoarder: 10, straw: 12, cat: 12, conman: 12, snoop: 10, noble: 12, jeweler: 12, banker: 12, devil: 16 };

  /* Zählwerke: 'sum' wird aufaddiert, 'max' merkt sich den besten Wert. Nur diese Schlüssel werden gespeichert. */
  var FEATS = {
    chain: 'max', glut: 'max', score: 'max', pushed: 'max', left: 'max', bank: 'max', money: 'max', deck: 'max', held: 'max',
    trinkets: 'max', perks: 'max', casino: 'max', flawless: 'max', endless: 'max',
    played: 'sum', sevens: 'sum', eights: 'sum', aces: 'sum', specials: 'sum', pairs: 'sum', skips: 'sum', curses: 'sum', reflects: 'sum',
    swaps: 'sum', sacrificed: 'sum', nodraw: 'sum', fast: 'sum', curfew: 'sum', last: 'sum', slim: 'sum', losses: 'sum',
    burned: 'sum', sold: 'sum', rerolls: 'sum', healed: 'sum', sealed: 'sum', bought: 'sum', burnt: 'sum', overkill: 'max', kniffe: 'sum'
  };

  /* Bedingungen, unter denen etwas im Hinterzimmer auftaucht: [Zählwerk, Schwelle, Hinweis, ab wann der Hinweis zu lesen ist].
     Letzteres: fehlt = von Anfang an; Zahl = erst nach so vielen ausgeräumten Casinos; NIE = nie (es bleibt bei „?????").
     Je besser das Stück, desto härter die Bedingung. Der Spieler erfährt nicht, dass manche Hinweise später kommen. */
  var NIE = -1;
  var REQ = {
    // --- Schachteln ---
    'starter:igniter': ['sevens', 10, 'Spiele 10 Siebenen.'],
    'starter:cheater': ['foe:cheater', 2, 'Schlage Rico, den Falschspieler, zweimal.'],
    'starter:alchemist': ['bank', 10, 'Kassiere in einem Duell eine Bank von 10 Mark.'],
    'starter:hearts': ['played', 150, 'Spiele 150 Karten.'],
    'starter:carny': ['eights', 15, 'Spiele 15 Achten.'],
    'starter:picked': ['burned', 5, 'Verbrenne 5 Karten.'],
    'starter:hoarder': ['deck', 20, 'Trage ein Deck mit 20 Karten.'],
    'starter:straw': ['burnt', 3, 'Fackle 3 Tische ab.'],
    'starter:cat': ['curses', 8, 'Lass Gegner 8-mal unter einem Fluch ziehen.'],
    'starter:conman': ['aces', 15, 'Spiele 15 Asse.'],
    'starter:snoop': ['foe:card-counter', 2, 'Schlage Dr. Zahl zweimal.'],
    'starter:noble': ['elites', 4, 'Schlage 4 Elite-Gegner.'],
    'starter:jeweler': ['sealed', 3, 'Lass bei Esme 3 Karten veredeln.'],
    'starter:banker': ['money', 40, 'Halte 40 Mark auf einmal.'],
    'starter:devil': ['casino', 3, 'Räume drei Casinos aus.'],
    // --- Trinkets der ersten Serie ---
    'trinket:heartblood': ['duels', 3, 'Gewinne 3 Duelle.'],
    'trinket:black-series': ['duels', 6, 'Gewinne 6 Duelle.'],
    'trinket:slow-burner': ['chain', 6, 'Erreiche eine Kette von ×6.'],
    'trinket:card-shark': ['left', 4, 'Gewinne, während der Gegner noch 4 Karten hält.'],
    'trinket:short-fuse': ['fast', 1, 'Gewinne ein Duell in höchstens 16 Zügen.'],
    'trinket:loaded-die': ['specials', 15, 'Spiele 15 Spezialkarten.'],
    'trinket:velvet-glove': ['sacrificed', 6, 'Wirf mit Opfer 6 Karten ab.'],
    'trinket:rollercoaster': ['eights', 12, 'Spiele 12 Achten.'],
    'trinket:hot-wire': ['specials', 8, 'Spiele 8 Spezialkarten.'],
    'trinket:ace-sleeve': ['aces', 12, 'Spiele 12 Asse.'],
    'trinket:seven-sleeper': ['sevens', 25, 'Spiele 25 Siebenen.'],
    'trinket:hex-board': ['foe:curse-dealer', 2, 'Schlage Mortimer zweimal.'],
    'trinket:voodoo': ['curses', 10, 'Lass Gegner 10-mal unter einem Fluch ziehen.'],
    'trinket:stopwatch': ['skips', 15, 'Lass Gegner 15-mal aussetzen.'],
    'trinket:skeleton-key': ['specials', 40, 'Spiele 40 Spezialkarten.'],
    'trinket:diamond-cut': ['money', 30, 'Halte 30 Mark auf einmal.'],
    'trinket:compound': ['money', 45, 'Halte 45 Mark auf einmal.'],
    'trinket:black-book': ['foe:card-counter', 1, 'Schlage Dr. Zahl.'],
    'trinket:smoke-mirror': ['foe:boss-smoke', 1, 'Schlage Madame Rauch.'],
    'trinket:afterburner': ['chain', 10, 'Erreiche eine Kette von ×10.'],
    'trinket:furnace': ['glut', 1500, 'Sammle 1.500 Glut in einem Duell.', 1],
    'trinket:pair-king': ['pairs', 10, 'Lege 10-mal mehrere Karten auf einmal.'],
    'trinket:golden-match': ['last', 3, 'Gewinne 3 Duelle mit dem letzten Streichholz.', 1],
    'trinket:master-key': ['casino', 2, '', NIE],
    // --- Trinkets der zweiten Serie: gewöhnlich ---
    'trinket:karoglanz': ['duels', 10, 'Gewinne 10 Duelle.'],
    'trinket:kleinvieh': ['played', 100, 'Spiele 100 Karten.'],
    'trinket:zunder': ['chain', 5, 'Erreiche eine Kette von ×5.'],
    'trinket:sparschwein': ['bank', 6, 'Kassiere in einem Duell eine Bank von 6 Mark.'],
    'trinket:dicke-brieftasche': ['losses', 3, 'Verliere 3 Duelle.'],
    'trinket:pfandschein': ['sold', 2, 'Verkaufe 2 Trinkets an Manfred.'],
    'trinket:gratisfeuer': ['burned', 3, 'Verbrenne 3 Karten.'],
    'trinket:feuerversicherung': ['healed', 2, 'Kaufe 2 Streichhölzer nach.'],
    'trinket:opernglas': ['foe:pianist', 1, 'Schlage Fingers, den Pianisten.'],
    'trinket:nachtlaterne': ['curfew', 1, 'Gewinne ein Duell durch die Sperrstunde.'],
    // --- ungewöhnlich ---
    'trinket:hofstaat': ['elites', 3, 'Schlage 3 Elite-Gegner.'],
    'trinket:trumpf-ass': ['aces', 30, 'Spiele 30 Asse.'],
    'trinket:tintenfass': ['specials', 60, 'Spiele 60 Spezialkarten.'],
    'trinket:zwillinge': ['pairs', 4, 'Lege 4-mal mehrere Karten auf einmal.'],
    'trinket:letzte-glut': ['chain', 8, 'Erreiche eine Kette von ×8.'],
    'trinket:blasebalg': ['specials', 25, 'Spiele 25 Spezialkarten.'],
    'trinket:roter-teppich': ['foe:showgirl', 2, 'Schlage Roxy zweimal.'],
    'trinket:kettenbrief': ['pairs', 20, 'Lege 20-mal mehrere Karten auf einmal.'],
    'trinket:neunmalklug': ['pushed', 6, 'Zwinge einen Gegner in einem Duell, 6 Karten zu ziehen.'],
    'trinket:farbenlehre': ['rerolls', 10, 'Lass Manfred 10-mal neu auslegen.'],
    'trinket:klebefinger': ['pushed', 10, 'Zwinge einen Gegner in einem Duell, 10 Karten zu ziehen.'],
    'trinket:fluchmuenze': ['curses', 25, 'Lass Gegner 25-mal unter einem Fluch ziehen.'],
    'trinket:bubenstueck': ['foe:pickpocket', 1, 'Schlage Sally.'],
    'trinket:loesegeld': ['bosses', 3, 'Schlage 3 Bosse.'],
    'trinket:regenschirm': ['foe:double-igniter', 1, 'Schlage Funke.'],
    'trinket:pestmaske': ['foe:black-widow', 1, 'Schlage Vera, die Schwarze Witwe.'],
    'trinket:police': ['losses', 8, 'Verliere 8 Duelle.'],
    'trinket:zylinder': ['casino', 1, 'Räume ein Casino aus.'],
    'trinket:sturmfeuerzeug': ['fast', 5, 'Gewinne 5 Duelle in höchstens 16 Zügen.'],
    'trinket:kopfgeld': ['elites', 8, 'Schlage 8 Elite-Gegner.'],
    'trinket:urne': ['burned', 10, 'Verbrenne 10 Karten.'],
    'trinket:kartenetui': ['held', 3, 'Trage 3 Spezialkarten zugleich im Deck.'],
    'trinket:freibier': ['foe:barkeeper', 3, 'Schlage Bruno dreimal.'],
    // --- selten ---
    'trinket:dampfkessel': ['chain', 12, 'Erreiche eine Kette von ×12.', 1],
    'trinket:daumenschraube': ['pushed', 14, 'Zwinge einen Gegner in einem Duell, 14 Karten zu ziehen.', 2],
    'trinket:sandmann': ['skips', 40, 'Lass Gegner 40-mal aussetzen.', 1],
    'trinket:doppelschloss': ['foe:bouncer', 3, 'Schlage Schrank dreimal.'],
    'trinket:damenwahl': ['foe:boss-dolores', 2, 'Schlage Diamanten-Dolores zweimal.', 1],
    'trinket:asbesthandschuh': ['foe:bruiser', 4, 'Schlage Knochen-Kalle viermal.'],
    'trinket:sammleralbum': ['trinkets', 8, 'Trage 8 Trinkets in einem Run.', 1],
    'trinket:mitgift': ['money', 70, 'Halte 70 Mark auf einmal.', 2],
    'trinket:echo': ['casino', 2, '', NIE],
    'trinket:gezinktes-blatt': ['nodraw', 1, 'Gewinne ein Duell, ohne eine einzige Karte zu ziehen.', 2],
    'trinket:schmale-hand': ['slim', 1, 'Gewinne ein Duell mit einem Deck aus höchstens 10 Karten.', 1],
    // --- wachsende Trinkets ---
    'trinket:schneeball': ['burnt', 1, 'Fackle einen Tisch ab: Erreiche sein Glutziel.'],
    'trinket:brandstifter': ['burned', 8, 'Verbrenne 8 Karten.'],
    'trinket:sippschaft': ['trinkets', 6, 'Trage 6 Trinkets in einem Run.'],
    'trinket:funkenregen': ['burnt', 5, 'Fackle 5 Tische ab.'],
    'trinket:wucherer': ['money', 60, 'Halte 60 Mark auf einmal.', 1],
    'trinket:glutspeicher': ['burnt', 12, 'Fackle 12 Tische ab.', 1],
    'trinket:trophaeenschrank': ['bosses', 10, 'Schlage 10 Bosse.', 1],
    'trinket:perpetuum': ['overkill', 4, 'Übertriff ein Glutziel um das Vierfache.', 2],
    'trinket:kettenreaktion': ['chain', 14, 'Erreiche eine Kette von ×14.', 3],
    // --- legendär ---
    'trinket:lauffeuer': ['chain', 16, 'Erreiche eine Kette von ×16.', 3],
    'trinket:phoenixfeder': ['last', 8, 'Gewinne 8 Duelle mit dem letzten Streichholz.', 3],
    'trinket:midas-hand': ['bank', 30, 'Kassiere in einem Duell eine Bank von 30 Mark.', 4],
    // --- Glut-Serie ---
    'trinket:feuerzeug': ['chain', 7, 'Erreiche eine Kette von ×7.'],
    'trinket:vollmond': ['played', 60, 'Spiele 60 Karten.'],
    'trinket:leere-taschen': ['losses', 2, 'Verliere 2 Duelle.'],
    'trinket:farbwechsel': ['pairs', 8, 'Lege 8-mal mehrere Karten auf einmal.'],
    'trinket:gluecksrad': ['specials', 10, 'Spiele 10 Spezialkarten.'],
    'trinket:koenigsmacher': ['duels', 10, 'Gewinne 10 Duelle.'],
    'trinket:siebenmeilen': ['sevens', 20, 'Spiele 20 Siebenen.'],
    'trinket:strasse': ['chain', 10, 'Erreiche eine Kette von ×10.', 1],
    'trinket:zweite-luft': ['nodraw', 2, 'Gewinne 2 Duelle, ohne freiwillig zu ziehen.'],
    'trinket:glutnest': ['deck', 22, 'Trage ein Deck mit 22 Karten.'],
    'trinket:minimalist': ['burned', 12, 'Verbrenne 12 Karten.'],
    'trinket:siegelring': ['sealed', 6, 'Lass bei Esme 6 Karten veredeln.'],
    'trinket:aktienpaket': ['casino', 2, '', NIE],
    'trinket:serientaeter': ['duels', 20, 'Gewinne 20 Duelle.'],
    'trinket:gluecksstraehne': ['duels', 15, 'Gewinne 15 Duelle.'],
    'trinket:vorglut': ['burnt', 1, 'Fackle einen Tisch ab.'],
    'trinket:zuenglein': ['burnt', 3, 'Fackle 3 Tische ab.'],
    'trinket:feuerdecke': ['burnt', 8, 'Fackle 8 Tische ab.'],
    'trinket:oelfass': ['chain', 8, 'Erreiche eine Kette von ×8.'],
    'trinket:fettbrand': ['overkill', 2, 'Übertriff ein Glutziel um das Doppelte.', 1],
    'trinket:brandpraemie': ['burnt', 2, 'Fackle 2 Tische ab.'],
    'trinket:hausfreund': ['sealed', 3, 'Lass bei Esme 3 Karten veredeln.'],
    'trinket:teufelspakt': ['casino', 4, '', NIE],
    // --- Spezialkarten ---
    'special:zytokinese': ['deck', 22, 'Baue ein Deck aus 22 Karten.'],
    'special:zocken': ['foe:bookie', 1, 'Schlage Quoten-Otto.'],
    'special:tausch': ['left', 6, 'Gewinne, während der Gegner noch 6 Karten hält.'],
    'special:bonusgeld': ['bosses', 5, 'Schlage 5 Bosse.'],
    'special:zytokinese_2': ['casino', 3, '', NIE],
    'special:nachschlag': ['duels', 5, 'Gewinne 5 Duelle.'],
    'special:glutnest': ['chain', 7, 'Erreiche eine Kette von ×7.'],
    'special:bannbrecher': ['foe:curse-dealer', 1, 'Schlage Mortimer.'],
    'special:nebelkerze': ['skips', 8, 'Lass Gegner 8-mal aussetzen.'],
    'special:schutzgeld': ['elites', 5, 'Schlage 5 Elite-Gegner.'],
    'special:stichflamme': ['glut', 800, 'Sammle 800 Glut in einem Duell.'],
    'special:brandsatz': ['pushed', 8, 'Zwinge einen Gegner in einem Duell, 8 Karten zu ziehen.', 1],
    'special:ausgleich': ['casino', 2, 'Räume zwei Casinos aus.', 1],
    'special:mischmasch': ['swaps', 5, 'Spiele 5-mal Tausch.', 2],
    'special:reservefunke': ['flawless', 1, 'Räume ein Casino aus, ohne ein Streichholz zu verlieren.', 2],
    'special:inferno': ['casino', 5, '', NIE],
    // --- Veredelungen (Esme) ---
    'seal:zuend': ['sealed', 2, 'Lass bei Esme 2 Karten veredeln.'],
    'seal:haken': ['sealed', 6, 'Lass bei Esme 6 Karten veredeln.'],
    'seal:bumerang': ['pairs', 15, 'Lege 15-mal mehrere Karten auf einmal.'],
    'seal:irrlicht': ['sealed', 20, 'Lass bei Esme 20 Karten veredeln.', 1],
    // --- Upgrades ---
    'upgrade:tarot': ['sealed', 4, 'Lass bei Esme 4 Karten veredeln.'],
    'upgrade:stammkunde': ['rerolls', 5, 'Lass Manfred 5-mal neu auslegen.'],
    'upgrade:spuernase': ['specials', 10, 'Spiele 10 Spezialkarten.'],
    'upgrade:sparbuch': ['money', 25, 'Halte 25 Mark auf einmal.'],
    'upgrade:zuendelei': ['burned', 6, 'Verbrenne 6 Karten.'],
    'upgrade:schaufenster': ['trinkets', 5, 'Trage 5 Trinkets in einem Run.'],
    'upgrade:handschlag': ['perks', 3, 'Besitze 3 Privilegien in einem Run.'],
    'upgrade:trinkgeld': ['bosses', 6, 'Schlage 6 Bosse.'],
    'upgrade:aschesieb': ['ash', 100, 'Verdiene insgesamt 100 Asche.'],
    'upgrade:reserve': ['casino', 1, 'Räume ein Casino aus.'],
    'upgrade:gluecksbringer': ['casino', 2, 'Räume zwei Casinos aus.', 1]
  };

  var M = {
    BASE: BASE,
    FEATS: FEATS,
    REQ: REQ,

    /* Dauerhafte Upgrades: bewusst klein gehalten, damit frühe Runs nicht trivial werden. */
    UPGRADES: {
      startgeld: { name: 'Startkapital', text: '+2 Mark Startgeld je Stufe.', costs: [6, 10, 15] },
      etui: { name: 'Kartenetui', text: 'Dein Deck fasst eine Spezialkarte mehr je Stufe (ohne Ausbau: ' + ZU.SPECIAL_SLOTS + ').', costs: [10, 18, 30] },
      stammkunde: { name: 'Stammkunde', text: 'Die erste Neue Auslage in jedem Laden ist gratis.', costs: [10] },
      spuernase: { name: 'Spürnase', text: 'Im Spezialkarten-Regal liegt öfter etwas (+10 % je Stufe).', costs: [8, 14] },
      sparbuch: { name: 'Sparbuch', text: 'Die Obergrenze der Zinsen steigt um 25 % je Stufe.', costs: [8, 14] },
      zuendelei: { name: 'Zündelei', text: 'Verbrennen kostet 25 % weniger.', costs: [7] },
      schaufenster: { name: 'Schaufenster', text: 'Manfred zeigt ein Trinket mehr.', costs: [20] },
      handschlag: { name: 'Handschlag', text: 'Privilegien kosten 20 % weniger.', costs: [9] },
      trinkgeld: { name: 'Trinkgeld', text: 'Jeder besiegte Boss zahlt 20 % mehr Prämie je Stufe.', costs: [8, 12] },
      aschesieb: { name: 'Aschesieb', text: '+10 % Asche je Stufe.', costs: [12, 20, 30] },
      reserve: { name: 'Reserveholz', text: 'Du beginnst mit einem vierten Streichholz.', costs: [25] },
      tarot: { name: 'Viertes Blatt', text: 'Esme legt ein Paket mehr aus.', costs: [16] },
      kniffplatz: { name: 'Zweite Hand', text: 'Du kannst einen Kniff mehr je Stufe tragen (ohne Ausbau: 1).', costs: [15, 30] },
      startkniff: { name: 'Kniff im Ärmel', text: 'Du beginnst jeden Run mit einem zufälligen einfachen Kniff.', costs: [18] },
      gluecksbringer: { name: 'Glücksbringer', text: 'Du beginnst jeden Run mit einem zufälligen gewöhnlichen Trinket.', costs: [22] }
    },
    UPGRADE_IDS: ['startgeld', 'etui', 'stammkunde', 'spuernase', 'sparbuch', 'zuendelei', 'schaufenster', 'handschlag', 'trinkgeld', 'aschesieb', 'reserve', 'tarot', 'kniffplatz', 'startkniff', 'gluecksbringer'],

    /* Casinos als Stufen. Der Name STAKES und die Felder stake/maxStake stammen von den früheren „Einsätzen"
       und bleiben, damit gespeicherte Profile und Konten weiter passen. */
    STAKES: ZU.CASINOS,
    ASH: { battle: 1, elite: 2, boss: 5, victory: 8 },

    defaults: function () {
      return { ash: 0, earned: 0, unlocked: {}, upgrades: {}, stake: 0, maxStake: 0, cv: ZU.CASINO_VERSION, defeated: {}, feats: {} };
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
      // Stände aus der Zeit mit sechs Casinos: Die Häuser sind umsortiert, der Index wandert mit.
      function house(value) {
        var n = count(value, 1000);
        if (raw.cv !== ZU.CASINO_VERSION && ZU.CASINO_REMAP[n] != null) n = ZU.CASINO_REMAP[n];
        return Math.min(n, M.STAKES.length - 1);
      }
      meta.maxStake = house(raw.maxStake);
      meta.stake = Math.min(house(raw.stake), meta.maxStake);
      if (raw.unlocked && typeof raw.unlocked === 'object') {
        Object.keys(raw.unlocked).forEach(function (key) {
          var parts = key.split(':');
          if (raw.unlocked[key] && M.exists(parts[0], parts[1])) meta.unlocked[key] = true;
        });
      }
      if (raw.upgrades && typeof raw.upgrades === 'object') {
        // „Flinke Finger“ als Upgrade wurde gestrichen: Wer es gekauft hatte, bekommt die 20 Asche zurück.
        if (raw.upgrades.flinkefinger) meta.ash = Math.min(meta.ash + 20, 100000000);
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
      if (raw.feats && typeof raw.feats === 'object') {
        Object.keys(FEATS).forEach(function (key) {
          var value = count(raw.feats[key], 100000000);
          if (value) meta.feats[key] = value;
        });
      }
      return meta;
    },

    exists: function (kind, id) {
      if (kind === 'starter') return ZU.STARTERS.some(function (s) { return s.id === id; });
      if (kind === 'trinket') return !!ZU.TRINKETS[id];
      if (kind === 'special') return !!(ZU.CARDS[id] && ZU.CARDS[id].special);
      if (kind === 'seal') return !!ZU.SEALS[id];
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

    /* Gekauft bzw. von Anfang an dabei: Das Stück ist im Spiel. */
    isUnlocked: function (meta, kind, id) {
      return BASE[kind].indexOf(id) >= 0 || !!meta.unlocked[kind + ':' + id];
    },

    /* ---------- Zählwerke und Entdecken ---------- */
    /* Stand eines Zählwerks. Manche ergeben sich aus dem, was das Profil ohnehin weiß (Kartei, Casinos, Asche). */
    feat: function (meta, key) {
      var defeated = meta.defeated || {};
      function byKind(kind) {
        return Object.keys(defeated).reduce(function (sum, id) {
          return sum + (ZU.ENEMIES[id] && (!kind || ZU.ENEMIES[id].kind === kind) ? defeated[id] : 0);
        }, 0);
      }
      if (key.indexOf('foe:') === 0) return defeated[key.slice(4)] || 0;
      if (key === 'duels') return byKind(null);
      if (key === 'tables') return byKind('battle');
      if (key === 'elites') return byKind('elite');
      if (key === 'bosses') return byKind('boss');
      if (key === 'ash') return meta.earned || 0;
      if (key === 'casino') return Math.max(meta.feats.casino || 0, meta.maxStake || 0);
      return meta.feats[key] || 0;
    },

    /* Trägt Taten ein: { chain: 7, sevens: 2 }. Je nach Zählwerk wird addiert oder der Bestwert gehalten. */
    note: function (changes) {
      var meta = M.get(), dirty = false;
      Object.keys(changes).forEach(function (key) {
        var value = Math.floor(changes[key]) || 0, old = meta.feats[key] || 0;
        if (!FEATS[key] || value <= 0) return;
        var next = FEATS[key] === 'sum' ? old + value : Math.max(old, value);
        if (next !== old) { meta.feats[key] = next; dirty = true; }
      });
      if (dirty) M.put(meta, true); // wandert mit der nächsten echten Änderung (Asche) ans Konto
    },

    /* Nach jedem Duell: hält fest, was der Spieler geschafft hat. */
    noteDuel: function (run, duel, won) {
      var s = run.s, st = duel.stats;
      var changes = {
        chain: duel.maxChain, glut: duel.glut, pushed: st.pushed, played: st.played, sevens: st.sevens, eights: st.eights, aces: st.aces,
        specials: st.specials, pairs: st.pairs, skips: st.skips, curses: st.curses, reflects: st.reflects, swaps: st.swaps, sacrificed: st.sacrificed,
        deck: s.collection.length, held: run.specialCount(), trinkets: s.trinkets.length, perks: (s.perks || []).length, money: s.money, score: s.score
      };
      if (won) {
        changes.left = duel.hand.opp.length;
        changes.bank = duel.bank * duel.bonusMult;
        if (!st.drawn) changes.nodraw = 1;
        if (duel.turns <= 16) changes.fast = 1;
        if (duel.wonBy === 'curfew') changes.curfew = 1;
        if (duel.target && duel.glut >= duel.target) { changes.burnt = 1; changes.overkill = Math.floor(duel.glut / duel.target); }
        if (s.lives === 1) changes.last = 1;
        if (s.collection.length <= 10) changes.slim = 1;
        if (s.endless) changes.endless = s.act - run.acts();
        if (s.cleared && !s.endless) {
          changes.casino = (run.meta().stake || 0) + 1;
          if (!s.hurt) changes.flawless = 1;
        }
      } else {
        changes.losses = 1;
      }
      M.note(changes);
    },

    req: function (kind, id) { return REQ[kind + ':' + id] || null; },

    /* Entdeckt: Das Stück steht im Hinterzimmer zum Kauf (oder ist schon im Spiel). */
    isFound: function (meta, kind, id) {
      if (kind !== 'upgrade' && M.isUnlocked(meta, kind, id)) return true;
      if (kind === 'upgrade' && M.level(meta, id) > 0) return true;
      var req = M.req(kind, id);
      return !req || M.feat(meta, req[0]) >= req[1];
    },

    /* Hinweis, wie sich ein verborgenes Stück zeigt – oder null, wenn (noch) keiner zu lesen ist. */
    hint: function (meta, kind, id) {
      var req = M.req(kind, id);
      if (!req || !req[2] || req[3] === NIE) return null;
      return req[3] == null || M.feat(meta, 'casino') >= req[3] ? req[2] : null;
    },

    /* Alles Entdeckte, das noch nicht gekauft ist (für das „Neu"-Zeichen im Menü). */
    openOffers: function (meta) {
      var list = [];
      [['starter', ZU.STARTERS.map(function (s) { return s.id; })], ['trinket', ZU.TRINKET_IDS], ['special', ZU.SPECIAL_IDS], ['seal', ZU.SEAL_IDS]].forEach(function (group) {
        group[1].forEach(function (id) {
          if (!M.isUnlocked(meta, group[0], id) && M.isFound(meta, group[0], id)) list.push(group[0] + ':' + id);
        });
      });
      M.UPGRADE_IDS.forEach(function (id) {
        if (!M.level(meta, id) && M.req('upgrade', id) && M.isFound(meta, 'upgrade', id)) list.push('upgrade:' + id);
      });
      return list;
    },

    cost: function (kind, id) {
      if (kind === 'starter') return STARTER_COST[id] || 10;
      if (kind === 'trinket') return [4, 6, 9, 14][ZU.TRINKETS[id].rarity];
      if (kind === 'seal') return 4 + ZU.SEALS[id].value * 2;
      return [4, 6, 9, 14][ZU.CARDS[id].rarity];
    },

    /* Alle noch gesperrten Inhalte einer Art, in Spielreihenfolge. */
    locked: function (meta, kind) {
      var all = kind === 'starter' ? ZU.STARTERS.map(function (s) { return s.id; }) : kind === 'trinket' ? ZU.TRINKET_IDS : ZU.SPECIAL_IDS;
      return all.filter(function (id) { return !M.isUnlocked(meta, kind, id); });
    },

    unlock: function (kind, id) {
      var meta = M.get();
      if (!M.exists(kind, id) || M.isUnlocked(meta, kind, id)) return { ok: false, error: 'known' };
      if (!M.isFound(meta, kind, id)) return { ok: false, error: 'hidden' };
      var price = M.cost(kind, id);
      if (meta.ash < price) return { ok: false, error: 'poor' };
      meta.ash -= price;
      meta.unlocked[kind + ':' + id] = true;
      M.put(meta);
      return { ok: true };
    },

    level: function (meta, id) { return meta.upgrades[id] || 0; },
    /* Vorschläge fürs Hinterzimmer, je Reiter ('unlock' oder 'upgrade'): die besten Stücke, die entdeckt, noch nicht
       gekauft und bezahlbar sind – das wertvollste zuerst. Reicht die Asche für weniger als drei, folgen die
       nächstgünstigen als Sparziel (afford: false, missing: fehlende Asche). */
    UPGRADE_WORTH: { startkniff: 9, kniffplatz: 8, gluecksbringer: 9, reserve: 9, aschesieb: 8, etui: 7, startgeld: 6, schaufenster: 6, tarot: 5, stammkunde: 5 },
    suggest: function (meta, tab, count) {
      var list = [];
      if (tab === 'upgrade') {
        M.UPGRADE_IDS.forEach(function (id) {
          var cost = M.upgradeCost(meta, id);
          if (cost != null && M.isFound(meta, 'upgrade', id)) list.push({ kind: 'upgrade', id: id, cost: cost, worth: M.UPGRADE_WORTH[id] || 4 });
        });
      } else {
        [['starter', ZU.STARTERS.map(function (s) { return s.id; })], ['trinket', ZU.TRINKET_IDS], ['special', ZU.SPECIAL_IDS], ['seal', ZU.SEAL_IDS]].forEach(function (pair) {
          pair[1].forEach(function (id) {
            if (M.isUnlocked(meta, pair[0], id) || !M.isFound(meta, pair[0], id)) return;
            var worth = pair[0] === 'starter' ? 7 : pair[0] === 'seal' ? ZU.SEALS[id].value + 2
              : pair[0] === 'trinket' ? [4, 6, 8, 10][ZU.TRINKETS[id].rarity] + (/Glut|Kette/.test(ZU.TRINKETS[id].text) ? 3 : 0)
                : [4, 6, 8, 10][ZU.CARDS[id].rarity];
            list.push({ kind: pair[0], id: id, cost: M.cost(pair[0], id), worth: worth });
          });
        });
      }
      var can = list.filter(function (x) { return x.cost <= meta.ash; }).sort(function (a, b) { return b.worth - a.worth || a.cost - b.cost; });
      var save = list.filter(function (x) { return x.cost > meta.ash; }).sort(function (a, b) { return a.cost - b.cost || b.worth - a.worth; });
      count = count || 3;
      return can.slice(0, count).map(function (x) { x.afford = true; return x; })
        .concat(save.slice(0, Math.max(0, count - can.length)).map(function (x) { x.afford = false; x.missing = x.cost - meta.ash; return x; }));
    },

    upgradeCost: function (meta, id) {
      var costs = M.UPGRADES[id].costs, level = M.level(meta, id);
      return level < costs.length ? costs[level] : null;
    },
    upgrade: function (id) {
      var meta = M.get(), price = M.UPGRADES[id] ? M.upgradeCost(meta, id) : null;
      if (price == null) return { ok: false, error: 'max' };
      if (!M.isFound(meta, 'upgrade', id)) return { ok: false, error: 'hidden' };
      if (meta.ash < price) return { ok: false, error: 'poor' };
      meta.ash -= price;
      meta.upgrades[id] = M.level(meta, id) + 1;
      M.put(meta);
      return { ok: true };
    },

    /* Wählt das Casino für den nächsten Run (nur schon geöffnete). */
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
      var casino = ZU.CASINOS[meta.stake] || ZU.CASINOS[0];
      return {
        stake: meta.stake,
        cv: ZU.CASINO_VERSION,
        acts: casino.acts,
        rules: casino.rules.slice(),
        ashMult: casino.ash * (1 + 0.1 * M.level(meta, 'aschesieb')),
        startgeld: M.level(meta, 'startgeld') * 2,
        freeReroll: M.level(meta, 'stammkunde') > 0,
        shopBonus: M.level(meta, 'spuernase') * 0.1,
        maxLives: ZU.MAX_LIVES + (M.level(meta, 'reserve') > 0 ? 1 : 0),
        specialSlots: ZU.SPECIAL_SLOTS + M.level(meta, 'etui'),
        interest: M.level(meta, 'sparbuch'),
        trinketOffers: M.level(meta, 'schaufenster'),
        perkDiscount: M.level(meta, 'handschlag') * 0.2,
        bossTip: M.level(meta, 'trinkgeld') * 0.2,
        burnDiscount: M.level(meta, 'zuendelei') * 0.25,
        luckyTrinket: M.level(meta, 'gluecksbringer') > 0,
        kniffTier: meta.maxStake || 0,
        kniffSlots: 1 + M.level(meta, 'kniffplatz'),
        startKniff: M.level(meta, 'startkniff') > 0,
        trinkets: open('trinket', ZU.TRINKET_IDS),
        specials: open('special', ZU.SPECIAL_IDS),
        seals: open('seal', ZU.SEAL_IDS),
        esmePacks: 3 + M.level(meta, 'tarot')
      };
    },

    /* Asche, die ein Run bisher wert ist (mit dem Faktor des Casinos). */
    ashFor: function (run) {
      var mult = run.meta().ashMult || 1;
      return Math.round((run.s.ash || 0) * mult);
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

    /* Ein Sieg im bisher schwersten Casino öffnet das nächste. Liefert dessen Index oder null. */
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
