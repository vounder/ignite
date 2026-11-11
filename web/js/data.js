/* Zündung – Inhalte: Karten, Trinkets, Gegner, Startschachteln. Reine Daten, keine Logik. */
(function (ZU) {
  'use strict';

  ZU.HAND_SIZE = 7;
  ZU.MAX_TRINKETS = 5;
  ZU.MAX_LIVES = 3;
  ZU.TURN_LIMIT = 50; // Sperrstunde: danach gewinnt, wer weniger Karten hält

  ZU.SUITS = {
    hearts: { name: 'Herz', red: true },
    diamonds: { name: 'Karo', red: true },
    spades: { name: 'Pik', red: false },
    clubs: { name: 'Kreuz', red: false }
  };
  ZU.SUIT_ORDER = ['hearts', 'diamonds', 'spades', 'clubs'];

  ZU.RANKS = {
    '7': { label: '7', name: '7', value: 7, order: 0 },
    '8': { label: '8', name: '8', value: 8, order: 1 },
    '9': { label: '9', name: '9', value: 9, order: 2 },
    '10': { label: '10', name: '10', value: 10, order: 3 },
    J: { label: 'B', name: 'Bube', value: 10, order: 4 },
    Q: { label: 'D', name: 'Dame', value: 10, order: 5 },
    K: { label: 'K', name: 'König', value: 10, order: 6 },
    A: { label: 'A', name: 'Ass', value: 11, order: 7 }
  };
  ZU.RANK_ORDER = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  ZU.RARITY = [
    { name: 'Gewöhnlich', cls: 'common' },
    { name: 'Ungewöhnlich', cls: 'uncommon' },
    { name: 'Selten', cls: 'rare' },
    { name: 'Legendär', cls: 'legendary' }
  ];

  /* ---------- Karten ---------- */
  var cards = {};
  ZU.SUIT_ORDER.forEach(function (suit) {
    ZU.RANK_ORDER.forEach(function (rank) {
      var seven = rank === '7';
      cards[suit + '-' + rank] = {
        id: suit + '-' + rank,
        name: ZU.SUITS[suit].name + ' ' + ZU.RANKS[rank].name,
        suit: suit,
        rank: rank,
        special: false,
        rarity: 0,
        price: seven ? 5 : rank === 'A' || rank === 'K' ? 4 : rank === '9' || rank === '10' ? 2 : 3,
        base: ZU.RANKS[rank].value,
        text: seven ? 'Gegner zieht 2 Karten und setzt aus.' : '',
        effects: seven
          ? [{ type: 'draw', amount: 2, reflectable: true }, { type: 'skip', reflectable: true }]
          : []
      };
    });
  });

  function special(id, name, price, rarity, tag, text, effects) {
    cards[id] = {
      id: id, name: name, suit: null, rank: null, special: true, rarity: rarity,
      price: price, base: 15, tag: tag, text: text, effects: effects
    };
  }
  special('stillstand', 'Stillstand', 5, 0, 'Aussetzen', 'Der Gegner setzt eine Runde aus.',
    [{ type: 'skip', reflectable: true }]);
  special('addieren', 'Addieren', 6, 0, '+2 Karten', 'Der Gegner zieht 2 Karten.',
    [{ type: 'draw', amount: 2, reflectable: true }]);
  special('spion', 'Spion', 6, 0, 'Einblick', 'Du siehst die Hand des Gegners für 3 Züge.',
    [{ type: 'spy', duration: 3 }]);
  special('fluch', 'Fluch', 8, 1, 'Fluch ×3', 'Die nächsten 3 Male, die der Gegner zieht, zieht er 1 Karte mehr.',
    [{ type: 'curse', amount: 3, reflectable: true }]);
  special('hodl', 'HODL', 7, 1, '+6 Mark', 'Nach 2 deiner Züge wandern 6 Mark in die Bank. Die Bank wird beim Sieg ausgezahlt.',
    [{ type: 'hodl', amount: 6, duration: 2 }]);
  special('zytokinese', 'Zytokinese', 8, 1, 'Kopie', 'Wähle eine Handkarte: Eine dauerhafte Kopie wandert in dein Deck. Zytokinese wird dabei verbraucht.',
    [{ type: 'clone' }]);
  special('tausch', 'Tausch', 10, 2, 'Handtausch', 'Du tauschst deine Hand mit der des Gegners.',
    [{ type: 'swap' }]);
  special('bonusgeld', 'Bonusgeld', 12, 2, 'Prämie ×2', 'Verdoppelt Tischprämie und Bank dieses Duells.',
    [{ type: 'bonus' }]);
  special('opfer', 'Opfer', 10, 2, '−2 Karten', 'Wirf 2 weitere Handkarten ab. +5 Mark in die Bank.',
    [{ type: 'sacrifice', amount: 2 }]);
  special('zocken', 'Zocken', 11, 2, 'Aufdecken', 'Decke 3 Karten vom Stapel auf und spiele eine davon sofort – egal ob sie passt.',
    [{ type: 'gamble', amount: 3 }]);
  special('zytokinese_2', 'Zytokinese II', 18, 3, '2 Specials', 'Erzeugt 2 zufällige Spezialkarten dauerhaft in deinem Deck. Wird dabei verbraucht.',
    [{ type: 'createSpecial', amount: 2 }]);

  ZU.CARDS = cards;
  ZU.STANDARD_IDS = Object.keys(cards).filter(function (id) { return !cards[id].special; });
  ZU.SPECIAL_IDS = Object.keys(cards).filter(function (id) { return cards[id].special; });

  /* ---------- Trinkets ---------- */
  var trinkets = {};
  function trinket(id, name, rarity, text) {
    trinkets[id] = { id: id, name: name, rarity: rarity, price: [8, 12, 18, 26][rarity], text: text };
  }
  trinket('lucky-chip', 'Glückschip', 0, '+2 Mark nach jedem Sieg.');
  trinket('ashtray', 'Aschenbecher', 0, 'Zu Duellbeginn darfst du eine Handkarte gegen eine neue tauschen.');
  trinket('false-bottom', 'Doppelboden', 0, 'Der erste Kartenkauf in jedem Laden kostet 2 Mark weniger.');
  trinket('fuse', 'Zündschnur', 0, 'Deine Kette startet bei ×2 statt ×1.');
  trinket('ledger', 'Kassenbuch', 0, 'Zinsen bringen bis zu 6 statt 3 Mark.');
  trinket('brass-knuckles', 'Messingknöchel', 1, 'Dein erster Zieheffekt je Duell lässt den Gegner 1 Karte mehr ziehen.');
  trinket('pocket-watch', 'Taschenuhr', 1, 'Das erste Aussetzen gegen dich je Duell wird ignoriert.');
  trinket('loaded-die', 'Gezinkter Würfel', 1, 'Zocken deckt 5 statt 3 Karten auf.');
  trinket('velvet-glove', 'Samthandschuh', 1, 'Opfer bringt 3 Mark zusätzlich in die Bank.');
  trinket('heartblood', 'Herzblut', 1, 'Herz-Karten bringen doppelte Glut.');
  trinket('rollercoaster', 'Achterbahn', 1, 'Deine 8en lassen den Gegner aussetzen.');
  trinket('slow-burner', 'Dauerbrenner', 1, 'Beim Ziehen wird deine Kette halbiert statt zurückgesetzt.');
  trinket('black-book', 'Schwarzes Notizbuch', 2, 'Zu Duellbeginn siehst du die Gegnerhand für 3 Züge.');
  trinket('smoke-mirror', 'Rauchspiegel', 2, 'Der erste Zieh-, Aussetz- oder Fluch-Effekt gegen dich je Duell prallt zurück.');
  trinket('hot-wire', 'Heißer Draht', 2, 'Deine erste Spezialkarte je Duell beendet deinen Zug nicht.');
  trinket('ace-sleeve', 'Ass im Ärmel', 2, 'Deine Asse passen auf jede Karte.');
  trinket('golden-match', 'Goldenes Streichholz', 3, 'Verhindert einmal den Verlust deines letzten Streichholzes. Wird dabei verbraucht.');
  ZU.TRINKETS = trinkets;
  ZU.TRINKET_IDS = Object.keys(trinkets);

  /* ---------- Gegner ---------- */
  var COMMON = ['stillstand', 'addieren'];
  var CURSE = ['fluch', 'addieren', 'stillstand'];
  var GAMBLE = ['tausch', 'opfer', 'zocken'];

  ZU.ENEMIES = {
    'ember-croupier': {
      id: 'ember-croupier', name: 'Glut-Croupier', kind: 'battle', ai: 'greedy', pool: COMMON,
      passive: null, passiveText: 'Spielt sauber nach Hausregeln.',
      look: { bg: '#1f4a3a' },
      say: {
        start: ['Die Einsätze, bitte.', 'Sieben Karten. Viel Glück.'],
        attack: ['Zwei für Sie.', 'Hausregel.'],
        hurt: ['Hm.', 'Notiert.'],
        win: ['Das Haus dankt.'],
        lose: ['Gut gespielt.']
      }
    },
    'curse-dealer': {
      id: 'curse-dealer', name: 'Fluchdealer', kind: 'battle', ai: 'pressure', pool: CURSE,
      passive: null, passiveText: 'Mischt Flüche in den Stapel.',
      look: { bg: '#3a2140' },
      say: {
        start: ['Die Karten flüstern schon.', 'Zieh … wenn du dich traust.'],
        attack: ['Nimm. Nimm mehr.', 'Der Stapel mag dich.'],
        hurt: ['Das merke ich mir.', 'Tss.'],
        win: ['Verflucht gelaufen.'],
        lose: ['Der Bann … bricht.']
      }
    },
    'cheater': {
      id: 'cheater', name: 'Falschspieler', kind: 'battle', ai: 'gamble', pool: GAMBLE,
      passive: null, passiveText: 'Tauscht, zockt und opfert.',
      look: { bg: '#4a2a1a' },
      say: {
        start: ['Fair? Nie gehört.', 'Schau mir ruhig auf die Finger.'],
        attack: ['Ups.', 'War das meine?'],
        hurt: ['He! Das ist mein Trick.', 'Frechheit.'],
        win: ['Wer zuletzt mischt …'],
        lose: ['Du hast doch gezinkt!']
      }
    },
    'card-counter': {
      id: 'card-counter', name: 'Kartenzähler', kind: 'elite', ai: 'counter', pool: COMMON.concat(['zocken', 'opfer']),
      passive: 'sees-hand', passiveText: 'Kennt deine Hand und spielt gezielt dagegen.',
      look: { bg: '#243746' },
      say: {
        start: ['Ich kenne dein Blatt. Alle sieben.', 'Wahrscheinlichkeit deines Sieges: gering.'],
        attack: ['Berechnet.', 'Wie erwartet.'],
        hurt: ['Abweichung … interessant.', 'Das war nicht im Modell.'],
        win: ['Quod erat demonstrandum.'],
        lose: ['Varianz. Pure Varianz.']
      }
    },
    'double-igniter': {
      id: 'double-igniter', name: 'Doppelzünder', kind: 'elite', ai: 'pressure', pool: CURSE,
      passive: 'amplify', passiveText: 'Sein erster Zieheffekt zwingt dich zu 2 Karten extra.',
      look: { bg: '#5a2a12' },
      say: {
        start: ['Zweimal zünden hält besser!', 'Riechst du das? Schwefel.'],
        attack: ['BUMM!', 'Und gleich nochmal!'],
        hurt: ['Autsch! Heiß!', 'Nicht pusten!'],
        win: ['Ausgebrannt, was?'],
        lose: ['Fehlzündung …']
      }
    },
    'boss-shark': {
      id: 'boss-shark', name: 'Der Schieber', kind: 'boss', ai: 'gamble', pool: COMMON.concat(GAMBLE),
      passive: 'head-start', passiveText: 'Beginnt mit 6 statt 8 Karten.',
      look: { bg: '#16324a' },
      say: {
        start: ['Ich fange schon mal an. Zwei Karten Vorsprung.', 'Hier schiebt nur einer.'],
        attack: ['Rüber damit.', 'Geschoben.'],
        hurt: ['Nicht schlecht, Kleiner.', 'Das zahlst du zurück.'],
        win: ['Abgezogen.'],
        lose: ['Akt eins gehört dir. Mehr nicht.']
      }
    },
    'boss-smoke': {
      id: 'boss-smoke', name: 'Madame Rauch', kind: 'boss', ai: 'counter', pool: CURSE.concat(['zocken', 'opfer']),
      passive: 'smoke', passiveText: 'Kennt deine Hand. Dein erster Zieh-, Aussetz- oder Fluch-Effekt prallt auf dich zurück.',
      look: { bg: '#3d1f33' },
      say: {
        start: ['Schätzchen, ich sehe alles. Auch durch Rauch.', 'Puste ruhig. Es kommt zurück.'],
        attack: ['Mit Kuss zurück.', 'Wie reizend.'],
        hurt: ['Oh. Du beißt.', 'Unverschämt charmant.'],
        win: ['Verpufft, mein Lieber.'],
        lose: ['Der Rauch … lichtet sich.']
      }
    },
    'boss-house': {
      id: 'boss-house', name: 'Der Hausherr', kind: 'boss', ai: 'house', pool: COMMON.concat(CURSE.slice(0, 1)).concat(GAMBLE),
      passive: 'house', passiveText: 'Du beginnst verflucht (×3). Er beginnt mit 7 statt 8 Karten.',
      look: { bg: '#4a1512' },
      say: {
        start: ['Mein Haus. Meine Regeln. Dein Pech.', 'Am Ende gewinnt immer das Haus.'],
        attack: ['Hausrecht.', 'Zahlen, bitte.'],
        hurt: ['Wer hat dich hereingelassen?', 'Das wird teuer.'],
        win: ['Das Haus gewinnt. Immer.'],
        lose: ['Unmöglich … das Haus … brennt.']
      }
    }
  };
  ZU.BATTLE_POOL = ['ember-croupier', 'curse-dealer', 'cheater'];
  ZU.ELITE_POOL = ['card-counter', 'double-igniter'];
  ZU.BOSS_ORDER = ['boss-shark', 'boss-smoke', 'boss-house'];
  ZU.KIND_LABEL = { battle: 'Tisch', elite: 'Elite', boss: 'Boss' };
  ZU.ACT_NAMES = ['Hinterzimmer', 'Rauchsalon', 'Das Haus'];

  /* ---------- Startschachteln ---------- */
  ZU.STARTERS = [
    { id: 'classic', name: 'Klassisch', money: 10, text: '7 zufällige Karten und 10 Mark. Solide.', cards: [], trinkets: [], color: '#2f7d5b' },
    { id: 'igniter', name: 'Zündler', money: 5, text: '7 Karten, darunter zwei 7en. Dazu die Zündschnur.', cards: ['hearts-7', 'spades-7'], trinkets: ['fuse'], color: '#f08a24' },
    { id: 'cheater', name: 'Falschspieler', money: 5, text: '6 Karten plus Tausch und Zocken.', cards: ['tausch', 'zocken'], trinkets: [], size: 8, color: '#a3271f' },
    { id: 'alchemist', name: 'Alchemist', money: 4, text: '6 Karten plus Zytokinese und HODL. Wächst langsam, zahlt sich aus.', cards: ['zytokinese', 'hodl'], trinkets: [], size: 8, color: '#2a8c8c' }
  ];

  ZU.roman = function (n) {
    var out = '', map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    map.forEach(function (m) { while (n >= m[0]) { out += m[1]; n -= m[0]; } });
    return out;
  };
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
