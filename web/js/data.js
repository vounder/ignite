/* Zündung – Inhalte: Karten, Trinkets, Gegner, Startschachteln. Reine Daten, keine Logik. */
(function (ZU) {
  'use strict';

  ZU.VERSION = '2.6.1';
  /* Stand der Casino-Liste. Ändert sich die Reihenfolge, rechnen js/meta.js und js/run.js gespeicherte Stände um. */
  ZU.CASINO_VERSION = 2;
  ZU.CASINO_REMAP = [0, 1, 3, 5, 6, 7]; // alter Index (sechs Häuser) → neuer Index (acht Häuser) // im Hauptmenü unten rechts angezeigt
  /* Build-Kennung: wird an alle Asset-Adressen gehängt, damit Browser und CDN nach einem Update frische
     Dateien holen. Nicht von Hand ändern: web/tools/stamp_version.py setzt den Wert. */
  ZU.BUILD = '39f90acb92';
  ZU.asset = function (path) { return 'assets/' + path + '?v=' + ZU.BUILD; };

  ZU.HAND_SIZE = 7;
  ZU.DECK_SIZE = 16; // normale Karten im Startdeck; dazu kommen die Spezialkarten der Schachtel
  ZU.OPP_DECK = 24; // normale Karten im Blatt des Gegners
  ZU.MAX_LIVES = 3;
  ZU.OPP_HAND = 8; // Starthand der Gegner
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
        price: seven ? 4 : rank === 'A' || rank === 'K' ? 4 : rank === '9' || rank === '10' ? 2 : 3,
        base: ZU.RANKS[rank].value,
        text: seven ? 'Gegner zieht 1 Karte.' : '',
        effects: seven ? [{ type: 'draw', amount: 1, reflectable: true }] : []
      };
    });
  });

  function special(id, name, price, rarity, tag, text, effects) {
    cards[id] = {
      id: id, name: name, suit: null, rank: null, special: true, rarity: rarity,
      price: price, base: 15, tag: tag, text: text, effects: effects
    };
  }
  special('stillstand', 'Stillstand', 9, 0, 'Aussetzen', 'Der Gegner setzt eine Runde aus.',
    [{ type: 'skip', reflectable: true }]);
  special('addieren', 'Addieren', 10, 0, '+2 Karten', 'Der Gegner zieht 2 Karten.',
    [{ type: 'draw', amount: 2, reflectable: true }]);
  special('spion', 'Spion', 9, 0, 'Einblick', 'Du siehst die Hand des Gegners für 3 Züge.',
    [{ type: 'spy', duration: 3 }]);
  special('fluch', 'Fluch', 13, 1, 'Fluch ×3', 'Die nächsten 3 Male, die der Gegner zieht, zieht er 1 Karte mehr.',
    [{ type: 'curse', amount: 3, reflectable: true }]);
  special('hodl', 'HODL', 12, 1, '+6 Mark', 'Nach 2 deiner Züge wandern 6 Mark in die Bank. Die Bank wird beim Sieg ausgezahlt.',
    [{ type: 'hodl', amount: 6, duration: 2 }]);
  special('zytokinese', 'Zytokinese', 13, 1, 'Kopie', 'Wähle eine Handkarte: Eine dauerhafte Kopie wandert in dein Deck. Zytokinese wird dabei verbraucht.',
    [{ type: 'clone' }]);
  special('tausch', 'Tausch', 17, 2, 'Handtausch', 'Du tauschst deine Hand mit der des Gegners.',
    [{ type: 'swap' }]);
  special('bonusgeld', 'Bonusgeld', 19, 2, 'Prämie ×2', 'Verdoppelt Tischprämie und Bank dieses Duells.',
    [{ type: 'bonus' }]);
  special('opfer', 'Opfer', 16, 2, '−2 Karten', 'Wirf 2 weitere Handkarten ab. +5 Mark in die Bank.',
    [{ type: 'sacrifice', amount: 2 }]);
  special('zocken', 'Zocken', 17, 2, 'Aufdecken', 'Decke 3 Karten vom Stapel auf und spiele eine davon sofort – egal ob sie passt.',
    [{ type: 'gamble', amount: 3 }]);
  special('zytokinese_2', 'Zytokinese II', 28, 3, '2 Specials', 'Erzeugt 2 zufällige Spezialkarten dauerhaft in deinem Deck, soweit Platz ist. Wird dabei verbraucht.',
    [{ type: 'createSpecial', amount: 2 }]);
  // --- zweite Serie ---
  special('nachschlag', 'Nachschlag', 10, 0, 'Noch mal', 'Der Gegner zieht 1 Karte. Du bist noch einmal dran.',
    [{ type: 'draw', amount: 1, reflectable: true }, { type: 'again' }]);
  special('glutnest', 'Glutnest', 9, 0, 'Kette +3', 'Deine Kette steigt sofort um 3.',
    [{ type: 'stoke', amount: 3 }]);
  special('bannbrecher', 'Bannbrecher', 8, 0, 'Reinigung', 'Hebt alle Flüche und Aussetzer gegen dich auf.',
    [{ type: 'cleanse' }]);
  special('nebelkerze', 'Nebelkerze', 14, 1, 'Aus +1', 'Der Gegner setzt aus und zieht 1 Karte.',
    [{ type: 'draw', amount: 1, reflectable: true }, { type: 'skip', reflectable: true }]);
  special('schutzgeld', 'Schutzgeld', 12, 1, '+4 Mark', '4 Mark wandern sofort in die Bank.',
    [{ type: 'bank', amount: 4 }]);
  special('stichflamme', 'Stichflamme', 13, 1, 'Glut ×2', 'Deine nächsten 3 Karten bringen doppelte Glut.',
    [{ type: 'blaze', amount: 3 }]);
  special('brandsatz', 'Brandsatz', 18, 2, '+4 Karten', 'Der Gegner zieht 4 Karten.',
    [{ type: 'draw', amount: 4, reflectable: true }]);
  special('ausgleich', 'Ausgleich', 17, 2, 'Gleichstand', 'Der Gegner zieht, bis er so viele Karten hält wie du (höchstens 4).',
    [{ type: 'equalize', amount: 4, reflectable: true }]);
  special('mischmasch', 'Mischmasch', 16, 2, 'Neu geben', 'Der Gegner wirft seine Hand ab und zieht eine Karte mehr, als er hatte.',
    [{ type: 'redeal', reflectable: true }]);
  special('inferno', 'Inferno', 30, 3, 'Feuersturm', 'Der Gegner zieht 3 Karten und setzt aus. Deine Kette verdoppelt sich.',
    [{ type: 'draw', amount: 3, reflectable: true }, { type: 'skip', reflectable: true }, { type: 'double' }]);
  special('reservefunke', 'Reservefunke', 26, 3, '+1 Holz', 'Gewinnst du das Duell, erhältst du ein Streichholz zurück. Wird dabei verbraucht.',
    [{ type: 'life' }]);

  /* ---------- Bindung von Spezialkarten ----------
     Eine Spezialkarte ist an ein Symbol, an eine Farbe (rot/schwarz) oder gar nicht gebunden (Joker).
     Sie passt nur auf Karten ihrer Symbole und gibt als oberste Karte genau diese Symbole vor.
     Je weiter der Run, desto freier die Karten, die auftauchen. */
  ZU.bindSuits = function (bind) {
    if (bind === 'red') return ['hearts', 'diamonds'];
    if (bind === 'black') return ['spades', 'clubs'];
    if (ZU.SUITS[bind]) return [bind];
    return ZU.SUIT_ORDER;
  };
  ZU.bindTier = function (bind) { return ZU.SUITS[bind] ? 0 : bind === 'red' || bind === 'black' ? 1 : 2; };
  ZU.bindLabel = function (bind) {
    return ZU.SUITS[bind] ? ZU.SUITS[bind].name : bind === 'red' ? 'Rot' : bind === 'black' ? 'Schwarz' : 'Joker';
  };
  ZU.bindText = function (bind) {
    if (ZU.SUITS[bind]) return 'An ' + ZU.SUITS[bind].name + ' gebunden: passt nur auf ' + ZU.SUITS[bind].name + ', danach muss ' + ZU.SUITS[bind].name + ' folgen.';
    if (bind === 'red') return 'An Rot gebunden: passt auf Herz und Karo, danach muss Rot folgen.';
    if (bind === 'black') return 'An Schwarz gebunden: passt auf Pik und Kreuz, danach muss Schwarz folgen.';
    return 'Joker: passt auf jede Karte, danach darf alles folgen.';
  };
  /* Würfelt die Bindung passend zum Akt: erst fast nur Symbole, dann Farben, am Ende Joker. */
  ZU.BIND_WEIGHTS = [[78, 20, 2], [30, 55, 15], [8, 44, 48], [0, 30, 70]];
  ZU.rollBind = function (rng, act) {
    var weights = ZU.BIND_WEIGHTS[Math.max(0, Math.min(ZU.BIND_WEIGHTS.length, act) - 1)];
    var roll = rng.next() * (weights[0] + weights[1] + weights[2]);
    if (roll < weights[0]) return rng.pick(ZU.SUIT_ORDER);
    if (roll < weights[0] + weights[1]) return rng.next() < 0.5 ? 'red' : 'black';
    return 'wild';
  };
  /* Preis einer Karte im Laden; gebundene Spezialkarten sind günstiger, Joker teurer. */
  ZU.cardPrice = function (defId, bind) {
    var def = cards[defId];
    if (!def.special) return def.price;
    return Math.max(2, Math.round(def.price * [0.8, 1, 1.3][ZU.bindTier(bind)]));
  };

  /* ---------- Hausregeln: gelten für einen einzelnen Tisch, tauchen mit dem Run häufiger auf ---------- */
  /* Löschmittel: womit ein Tisch gegen deine Glut arbeitet (vergibt run.js nach Art und Akt). */
  ZU.DOUSE = {
    sand: { name: 'Löschsand', text: 'Jede 8 des Gegners senkt deine Kette um 2.' },
    water: { name: 'Löschwasser', text: 'Jedes Ass des Gegners halbiert deine Kette.' },
    sprinkler: { name: 'Sprinkler', text: 'Nach jedem vierten Zug des Gegners verlierst du Glut in Höhe von 5 % des Glutziels.' },
    blanket: { name: 'Löschdecke', text: 'Einmal je Duell: Erreichst du das halbe Glutziel, erstickt ein Viertel deiner Glut und die Kette fällt zurück.' }
  };

  ZU.RULES = {
    'one-pass': {
      name: 'Letzter Stapel',
      text: 'Der Stapel wird nicht neu gemischt. Ist er leer und muss jemand ziehen, gewinnt, wer weniger Karten hält.'
    },
    // Regeln der Casinos: gelten dort an jedem Tisch (siehe ZU.CASINOS)
    'last-call': { name: 'Knapper Stapel', text: '„Letzter Stapel“ gilt deutlich häufiger.' },
    sober: { name: 'Nüchterne Runde', text: 'Gegner verschenken nur noch halb so oft einen Zug.' },
    markup: { name: 'Teures Pflaster', text: 'Alles in Manfreds Laden kostet 20 % mehr.' },
    'short-night': { name: 'Frühe Sperrstunde', text: 'Sperrstunde schon nach 36 Zügen.' },
    cover: { name: 'Gedeck', text: 'Jede Tischprämie fällt 25 % niedriger aus.' },
    'sharp-sevens': { name: 'Scharfe Siebenen', text: 'Jede 7 lässt 2 Karten ziehen statt 1 – auf beiden Seiten.' },
    'house-edge': { name: 'Hausvorteil', text: 'Gegner beginnen mit einer Karte weniger.' },
    'no-credit': { name: 'Kein Kredit', text: 'Es gibt keine Zinsen.' },
    marked: { name: 'Böses Omen', text: 'Du beginnst jedes Duell verflucht (×1).' },
    'wide-awake': { name: 'Hellwach', text: 'Gegner verschenken keinen Zug mehr.' },
    damp: { name: 'Feuchte Luft', text: 'Deine Kette steigt nie über ×8.' },
    'cover-charge': { name: 'Eintritt', text: 'Jeder Besuch in Manfreds Laden kostet 10 % deiner Mark (mindestens 2).' },
    hype: { name: 'Hype', text: 'Gegner mischen 2 Spezialkarten mehr in ihren Stapel.' }
  };
  ZU.RULE_CHANCE = { 'one-pass': [0.1, 0.3, 0.5, 0.7] };

  /* ---------- Casinos ----------
     Acht Häuser, die der Reihe nach freigeschaltet werden: Ein Sieg im bisher schwersten öffnet das nächste.
     Jedes hat seine Zahl an Akten, eigene Räume, feste Hausregeln für alle Tische, einen Asche-Faktor
     und eine eigene Farbwelt für den Rauch im Hintergrund (tint: dunkel, mittel, Glanzlicht). */
  ZU.CASINOS = [
    { id: 'hahn', tint: { a: [0.09, 0.06, 0.03], b: [0.31, 0.18, 0.07], c: [0.94, 0.68, 0.24] }, name: 'Zum Goldenen Hahn', sub: 'Eckkneipe mit Hinterzimmer', acts: 3, ash: 1,
      rooms: ['Hinterzimmer', 'Rauchsalon', 'Das Haus'], rules: [] },
    { id: 'rialto', tint: { a: [0.13, 0.03, 0.06], b: [0.46, 0.09, 0.15], c: [1.0, 0.66, 0.34] }, name: 'Tanzpalast Rialto', sub: 'Wo die halbe Stadt ihr Geld vertanzt', acts: 4, ash: 1.5,
      rooms: ['Garderobe', 'Parkett', 'Separee', 'Direktion'], rules: ['last-call', 'sober'] },
    { id: 'laterne', tint: { a: [0.13, 0.02, 0.09], b: [0.46, 0.06, 0.30], c: [1.0, 0.62, 0.78] }, name: 'Rote Laterne', sub: 'Ein Nachtclub, in dem keiner fragt', acts: 4, ash: 1.75,
      rooms: ['Foyer', 'Champagnerbar', 'Separee', 'Chefetage'], rules: ['last-call', 'sober', 'cover-charge'] },
    { id: 'fortuna', tint: { a: [0.02, 0.09, 0.11], b: [0.05, 0.28, 0.31], c: [0.62, 0.88, 0.78] }, name: 'Dampfer Fortuna', sub: 'Schwimmt außerhalb jeder Zuständigkeit', acts: 4, ash: 2,
      rooms: ['Unterdeck', 'Salon', 'Kapitänstisch', 'Brücke'], rules: ['last-call', 'sober', 'markup', 'short-night'] },
    { id: 'block9', tint: { a: [0.03, 0.04, 0.12], b: [0.11, 0.15, 0.46], c: [0.56, 0.76, 1.0] }, name: 'Block 9', sub: 'Hinterhof, Shisha-Lounge und das lauteste Studio der Stadt', acts: 5, ash: 2.4,
      rooms: ['Hinterhof', 'Shisha-Lounge', 'Studio', 'VIP-Raum', 'Chefbüro'], rules: ['last-call', 'sober', 'markup', 'short-night', 'hype'] },
    { id: 'imperial', tint: { a: [0.07, 0.04, 0.12], b: [0.25, 0.14, 0.36], c: [0.94, 0.84, 0.58] }, name: 'Grandhotel Imperial', sub: 'Gespielt wird nur mit Krawatte', acts: 5, ash: 2.75,
      rooms: ['Foyer', 'Hotelbar', 'Bel Etage', 'Fürstensuite', 'Penthouse'], rules: ['last-call', 'sober', 'markup', 'short-night', 'cover', 'sharp-sevens'] },
    { id: 'monopol', tint: { a: [0.04, 0.06, 0.10], b: [0.14, 0.21, 0.30], c: [0.72, 0.80, 0.90] }, name: 'Spielbank Monopol', sub: 'Die Bank gewinnt. Steht so im Namen', acts: 5, ash: 3.5,
      rooms: ['Automatensaal', 'Roulettesaal', 'Baccara-Zimmer', 'Tresorraum', 'Direktorium'], rules: ['last-call', 'sober', 'markup', 'short-night', 'cover', 'sharp-sevens', 'house-edge', 'no-credit'] },
    { id: 'inferno', tint: { a: [0.06, 0.01, 0.01], b: [0.27, 0.03, 0.02], c: [1.0, 0.34, 0.07] }, name: 'Das Inferno', sub: 'Hier hat noch keiner das Licht ausgemacht', acts: 6, ash: 5,
      rooms: ['Vorhof', 'Glutkammer', 'Aschegrube', 'Schwefelsaal', 'Thronsaal', 'Der Abgrund'], rules: ['last-call', 'wide-awake', 'markup', 'short-night', 'cover', 'sharp-sevens', 'house-edge', 'no-credit', 'marked', 'damp'] }
  ];

  /* ---------- Veredelungen (Esmes Nebenzimmer) ----------
     Ein Siegel wertet eine normale Karte für den ganzen Run auf; ein Makel ist der kleine Haken, mit dem
     Esme ein Paket billiger macht. "value" bestimmt den Preis, "not" nennt Makel, die das Siegel aufhöben. */
  ZU.SEALS = {
    glut: { name: 'Glutsiegel', value: 5, weight: 10, text: 'Bringt doppelte Glut.', not: ['matt'] },
    zuend: { name: 'Zündkopf', value: 4, weight: 10, text: 'Die Kette steigt um 1 zusätzlich.', not: ['stumpf'] },
    gold: { name: 'Goldrand', value: 3, weight: 10, text: '1 Mark in die Bank beim Ausspielen.', not: ['zoll'] },
    haken: { name: 'Widerhaken', value: 6, weight: 8, text: 'Der Gegner zieht 1 Karte.', not: ['klette'] },
    anker: { name: 'Anker', value: 3, weight: 10, text: 'Liegt immer auf der Starthand.', not: ['spaet'] },
    bumerang: { name: 'Bumerang', value: 5, weight: 8, text: 'Kehrt einmal je Duell auf die Hand zurück.', not: [] },
    irrlicht: { name: 'Irrlicht', value: 8, weight: 3, text: 'Passt auf jede Karte.', not: [] }
  };
  ZU.SEAL_IDS = Object.keys(ZU.SEALS);
  ZU.FLAWS = {
    zoll: { name: 'Zoll', text: 'Kostet 1 Mark der Auszahlung, wenn du sie spielst.' },
    matt: { name: 'Matt', text: 'Zählt 4 Glut weniger.' },
    spaet: { name: 'Nachzügler', text: 'Liegt nie auf der Starthand.' },
    stumpf: { name: 'Stumpf', text: 'Die Kette steigt bei dieser Karte nicht.' },
    klette: { name: 'Klette', text: 'Du ziehst 1 Karte, wenn du sie spielst.' }
  };
  ZU.FLAW_IDS = Object.keys(ZU.FLAWS);
  /* Preisregeln der Pakete: Mark je Wertpunkt, Nachlass für einen Makel, Mengenrabatt. */
  ZU.SEAL_PRICE = { point: 2, flaw: 0.6, double: 0.85, bag: 0.45 };

  ZU.CARDS = cards;
  ZU.STANDARD_IDS = Object.keys(cards).filter(function (id) { return !cards[id].special; });
  ZU.SPECIAL_IDS = Object.keys(cards).filter(function (id) { return cards[id].special; });

  /* ---------- Trinkets ---------- */
  /* Grundpreis je Seltenheit. Dazu kommt im Laden ein Aufschlag je bereits getragenem Trinket –
     das ersetzt die frühere feste Obergrenze. */
  ZU.TRINKET_PRICES = [15, 22, 32, 46];
  ZU.TRINKET_SURCHARGE = 0.12; // Aufschlag je getragenem Trinket, als Anteil des Preises
  /* Mit jedem Akt wachsen Prämien und Preise um diesen Anteil – damit Prozent-Effekte ihren Wert behalten. */
  ZU.ACT_GROWTH = 0.15;
  /* Glutziel je Tisch: Grundwert je Art, Faktor je Akt und Zuschlag je Casino. */
  ZU.GLUT_TARGET = { battle: 600, elite: 800, boss: 1100, perAct: 2, perCasino: 0.5 };
  var trinkets = {};
  function trinket(id, name, rarity, text) {
    trinkets[id] = { id: id, name: name, rarity: rarity, price: ZU.TRINKET_PRICES[rarity], text: text };
  }
  trinket('lucky-chip', 'Glückschip', 0, 'Jede Tischprämie fällt 20 % höher aus.');
  trinket('ashtray', 'Aschenbecher', 0, 'Zu Duellbeginn darfst du eine Handkarte gegen eine neue tauschen.');
  trinket('false-bottom', 'Doppelboden', 0, 'Der erste Kartenkauf in jedem Laden kostet die Hälfte.');
  trinket('fuse', 'Zündschnur', 0, 'Deine Kette startet bei ×2 statt ×1.');
  trinket('ledger', 'Kassenbuch', 0, 'Die Obergrenze der Zinsen verdoppelt sich.');
  trinket('brass-knuckles', 'Messingknöchel', 0, 'Dein erster Zieheffekt je Duell lässt den Gegner 1 Karte mehr ziehen.');
  trinket('pocket-watch', 'Taschenuhr', 1, 'Das erste Aussetzen gegen dich je Duell wird ignoriert.');
  trinket('loaded-die', 'Gezinkter Würfel', 1, 'Zocken deckt 5 statt 3 Karten auf.');
  trinket('velvet-glove', 'Samthandschuh', 1, 'Opfer bringt 3 Mark zusätzlich in die Bank.');
  trinket('heartblood', 'Herzblut', 0, 'Herz-Karten bringen doppelte Glut.');
  trinket('rollercoaster', 'Achterbahn', 1, 'Deine 8en lassen den Gegner aussetzen.');
  trinket('slow-burner', 'Dauerbrenner', 0, 'Beim Ziehen wird deine Kette halbiert statt zurückgesetzt. Passt die gezogene Karte, bleibt sie ganz.');
  trinket('black-book', 'Schwarzes Notizbuch', 2, 'Zu Duellbeginn siehst du die Gegnerhand für 3 Züge.');
  trinket('smoke-mirror', 'Rauchspiegel', 2, 'Der erste Zieh-, Aussetz- oder Fluch-Effekt gegen dich je Duell prallt zurück.');
  trinket('hot-wire', 'Heißer Draht', 1, 'Deine erste Spezialkarte je Duell beendet deinen Zug nicht.');
  trinket('ace-sleeve', 'Ass im Ärmel', 1, 'Deine Asse passen auf jede Karte.');
  trinket('golden-match', 'Goldenes Streichholz', 3, 'Verhindert einmal den Verlust deines letzten Streichholzes. Wird dabei verbraucht.');
  // --- Zieh-Druck: mehr Karten für den Gegner ---
  trinket('seven-sleeper', 'Siebenschläfer', 1, 'Deine 7en lassen den Gegner 2 Karten ziehen statt 1.');
  trinket('hex-board', 'Hexenbrett', 1, 'Der Gegner beginnt jedes Duell verflucht (×2).');
  trinket('voodoo', 'Voodoopuppe', 1, 'Flüche auf dem Gegner wirken doppelt: 2 Karten mehr statt 1.');
  trinket('gold-tooth', 'Goldzahn', 0, 'Bis zu 10 statt 5 Restkarten des Gegners werden bezahlt.');
  // --- Aussetzen ---
  trinket('stopwatch', 'Stoppuhr', 1, 'Jedes Mal, wenn der Gegner aussetzt, wandert 1 Mark in die Bank.');
  // --- Kette und Glut ---
  trinket('card-shark', 'Kartenhai', 0, 'Passt die gezogene Karte, bleibt deine Kette erhalten.');
  trinket('afterburner', 'Nachbrenner', 2, 'Deine Kette steigt je Karte um 2 statt 1.');
  trinket('black-series', 'Schwarze Serie', 0, 'Pik- und Kreuz-Karten bringen 50 % mehr Glut.');
  trinket('furnace', 'Glutofen', 2, 'Der Glut-Bonus der Auszahlung zählt doppelt.');
  // --- Mehrfachwahl ---
  trinket('pair-king', 'Paschkönig', 2, 'Legst du 2 oder mehr Karten auf einmal, zieht der Gegner 1 Karte.');
  // --- Spezialkarten ---
  trinket('skeleton-key', 'Dietrich', 1, 'Deine symbolgebundenen Spezialkarten passen auf die ganze Farbe (Rot oder Schwarz).');
  trinket('master-key', 'Generalschlüssel', 3, 'Alle deine Spezialkarten passen auf jede Karte.');
  trinket('counterfeit', 'Falschgeld', 0, 'Spezialkarten kosten im Laden 25 % weniger.');
  // --- Kasse ---
  trinket('diamond-cut', 'Karoschliff', 1, 'Jede gespielte Karo-Karte bringt 1 Mark in die Bank (höchstens 5 je Duell).');
  trinket('compound', 'Zinseszins', 1, 'Zinsen gibt es schon je 4 statt je 5 Mark.');
  trinket('loyalty', 'Stempelkarte', 0, 'Trinkets kosten im Laden 20 % weniger.');
  // --- Regeln ---
  trinket('cellar-key', 'Kellerschlüssel', 0, 'Bei Sperrstunde und „Letzter Stapel“ gewinnst du auch bei Gleichstand.');
  trinket('short-fuse', 'Kurze Lunte', 0, 'Der Gegner setzt zu Beginn jedes Duells einmal aus.');
  /* ----- zweite Serie ----- */
  // --- Glut ---
  trinket('karoglanz', 'Karoglanz', 0, 'Karo-Karten bringen doppelte Glut.');
  trinket('hofstaat', 'Hofstaat', 1, 'Bube, Dame und König zählen 15 statt 10 Glut.');
  trinket('trumpf-ass', 'Trumpf-Ass', 1, 'Asse bringen dreifache Glut.');
  trinket('kleinvieh', 'Kleinvieh', 0, '7, 8 und 9 zählen 6 Glut mehr.');
  trinket('zunder', 'Zunder', 0, 'Jede Karte zählt 4 Glut mehr.');
  trinket('tintenfass', 'Tintenfass', 1, 'Spezialkarten zählen 30 statt 15 Glut.');
  trinket('zwillinge', 'Zwillinge', 1, 'Legst du denselben Wert wie die oberste Karte, bringt die Karte doppelte Glut.');
  trinket('letzte-glut', 'Letzte Glut', 1, 'Deine letzte Handkarte bringt fünffache Glut.');
  trinket('dampfkessel', 'Dampfkessel', 2, 'Ab Kette ×6 bringen deine Karten doppelte Glut.');
  // --- Kette ---
  trinket('blasebalg', 'Blasebalg', 1, 'Jede gespielte Spezialkarte erhöht deine Kette um 2 zusätzlich.');
  trinket('roter-teppich', 'Roter Teppich', 1, 'Legst du Rot auf Rot, steigt deine Kette um 1 zusätzlich.');
  trinket('kettenbrief', 'Kettenbrief', 1, 'Legst du mehrere Karten auf einmal, steigt deine Kette je weiterer Karte um 1 zusätzlich.');
  trinket('lauffeuer', 'Lauffeuer', 3, 'Ziehen setzt deine Kette nicht mehr zurück.');
  // --- Zieh-Druck und Aussetzen ---
  trinket('neunmalklug', 'Neunmalklug', 1, 'Deine 9en lassen den Gegner 1 Karte ziehen.');
  trinket('daumenschraube', 'Daumenschraube', 2, 'Jeder deiner Zieheffekte lässt den Gegner 1 Karte mehr ziehen.');
  trinket('farbenlehre', 'Farbenlehre', 1, 'Spielst du 3 Karten desselben Symbols in Folge, zieht der Gegner 1 Karte.');
  trinket('klebefinger', 'Klebefinger', 1, 'Der Gegner beginnt jedes Duell mit einer Karte mehr.');
  trinket('sandmann', 'Sandmann', 2, 'Setzt der Gegner aus, zieht er dabei 1 Karte.');
  trinket('doppelschloss', 'Doppelschloss', 2, 'Dein erstes Aussetzen je Duell lässt den Gegner zwei Runden aussetzen.');
  trinket('fluchmuenze', 'Fluchmünze', 1, 'Jedes Mal, wenn ein Fluch den Gegner mehr ziehen lässt, wandert 1 Mark in die Bank.');
  // --- Besondere Karten ---
  trinket('bubenstueck', 'Bubenstück', 1, 'Deine Buben passen auf jede Karte.');
  trinket('damenwahl', 'Damenwahl', 2, 'Nach einer Dame bist du noch einmal dran.');
  trinket('loesegeld', 'Lösegeld', 1, 'Jeder gespielte König bringt 2 Mark in die Bank (höchstens 6 je Duell).');
  // --- Schutz ---
  trinket('regenschirm', 'Regenschirm', 1, 'Zwingt dich ein Effekt zum Ziehen, ziehst du 1 Karte weniger (mindestens 1).');
  trinket('asbesthandschuh', 'Asbesthandschuh', 2, 'Die 7en des Gegners lassen dich keine Karte mehr ziehen.');
  trinket('pestmaske', 'Pestmaske', 1, 'Flüche gegen dich halten nur halb so lange (aufgerundet).');
  trinket('dicke-brieftasche', 'Dicke Brieftasche', 0, 'Verlierst du ein Duell, behältst du trotzdem dessen Bank.');
  trinket('police', 'Police', 1, 'Verlierst du ein Duell, zahlt die Versicherung 60 % der Tischprämie.');
  trinket('phoenixfeder', 'Phönixfeder', 3, 'Die erste Niederlage in jedem Akt kostet kein Streichholz.');
  // --- Kasse ---
  trinket('sparschwein', 'Sparschwein', 0, 'Die Bank beginnt jedes Duell mit 2 Mark.');
  trinket('zylinder', 'Zylinder', 1, 'Erreichst du im Duell Kette ×8, fällt die Tischprämie 40 % höher aus.');
  trinket('sturmfeuerzeug', 'Sturmfeuerzeug', 1, 'Gewinnst du in höchstens 16 Zügen, fällt die Tischprämie 40 % höher aus.');
  trinket('kopfgeld', 'Kopfgeld', 1, 'Elite und Bosse zahlen 40 % mehr Prämie.');
  trinket('sammleralbum', 'Sammleralbum', 2, 'Je 3 Trinkets, die du trägst, fällt jede Tischprämie 10 % höher aus.');
  trinket('mitgift', 'Mitgift', 2, 'Jeder Laden schenkt dir beim Betreten 15 % deiner Mark (mindestens 3).');
  trinket('midas-hand', 'Midas-Hand', 3, 'Jede gespielte Karte bringt 1 Mark in die Bank (höchstens 10 je Duell).');
  trinket('urne', 'Urne', 1, 'Jeder besiegte Boss bringt 2 Asche zusätzlich.');
  // --- Laden ---
  trinket('pfandschein', 'Pfandschein', 0, 'Manfred kauft Trinkets zum vollen Preis zurück.');
  trinket('gratisfeuer', 'Gratisfeuer', 0, 'Das erste Verbrennen in jedem Laden ist gratis.');
  trinket('feuerversicherung', 'Feuerversicherung', 0, 'Streichhölzer kosten im Laden 40 % weniger.');
  trinket('kartenetui', 'Kartenetui', 1, 'Dein Deck fasst eine Spezialkarte mehr.');
  // --- Spezialkarten ---
  trinket('echo', 'Echo', 2, 'Deine erste Spezialkarte je Duell wirkt zweimal (außer Zytokinese und Reservefunke).');
  trinket('opernglas', 'Opernglas', 0, 'Spion wirkt 6 statt 3 Züge.');
  trinket('gezinktes-blatt', 'Gezinktes Blatt', 2, 'Deine Spezialkarten sind immer auf der Starthand.');
  // --- Tischlage ---
  trinket('schmale-hand', 'Schmale Hand', 2, 'Du beginnst jedes Duell mit 6 statt 7 Karten.');
  trinket('freibier', 'Freibier', 1, 'Gegner verschenken öfter einen Zug.');
  trinket('nachtlaterne', 'Nachtlaterne', 0, 'Die Sperrstunde kommt 10 Züge später.');
  // --- Wachsende Trinkets: werden mit dem Run stärker ---
  trinket('glutspeicher', 'Glutspeicher', 2, 'Deine Kette startet beim halben Höchststand deines letzten Duells.');
  trinket('brandstifter', 'Brandstifter', 1, '+10 % Glut je Karte, die du in diesem Run verbrannt hast.');
  trinket('trophaeenschrank', 'Trophäenschrank', 2, '+25 % Glut je Boss, den du in diesem Run besiegt hast.');
  trinket('schneeball', 'Schneeball', 1, '+2 % Glut je Karte, die du in diesem Duell schon gespielt hast.');
  trinket('wucherer', 'Wucherer', 2, '+1 % Glut je Mark in deiner Kasse (höchstens +300 %).');
  trinket('sippschaft', 'Sippschaft', 1, '+8 % Glut je Trinket, das du trägst.');
  trinket('kettenreaktion', 'Kettenreaktion', 3, 'Über Kette ×10 zählt jede weitere Stufe doppelt.');
  trinket('perpetuum', 'Perpetuum', 2, 'Nach jeder fünften Karte, die du im Duell spielst, ziehst du eine nach – die Kette bleibt.');
  trinket('funkenregen', 'Funkenregen', 1, 'Fackelst du einen Tisch ab, zählt der Überschuss doppelt.');
  // --- Glut: Kartenwerte ---
  trinket('kreuzfeuer', 'Kreuzfeuer', 0, 'Kreuz-Karten zählen 8 Glut mehr.');
  trinket('bauernopfer', 'Bauernopfer', 0, 'Buben zählen 10 Glut mehr.');
  trinket('rotlicht', 'Rotlicht', 0, 'Rote Karten zählen 3 Glut mehr.');
  trinket('feuerzeug', 'Benzinfeuerzeug', 1, 'Ab Kette ×4 zählt jede Karte 6 Glut mehr.');
  // --- Glut: Vervielfacher ---
  trinket('volle-zehn', 'Volle Zehn', 0, '10en bringen doppelte Glut.');
  trinket('erster-funke', 'Erster Funke', 0, 'Deine ersten 3 Karten je Duell bringen doppelte Glut.');
  trinket('volles-haus', 'Volles Haus', 0, 'Hältst du nach dem Legen noch 6 oder mehr Karten, bringt die Karte 50 % mehr Glut.');
  trinket('heisse-ware', 'Heiße Ware', 0, 'Spezialkarten bringen doppelte Glut.');
  trinket('endspurt', 'Endspurt', 0, 'Deine letzten beiden Handkarten bringen dreifache Glut.');
  trinket('vollmond', 'Vollmond', 1, 'Jede dritte Karte, die du im Duell spielst, bringt doppelte Glut.');
  trinket('leere-taschen', 'Leere Taschen', 1, 'Hast du höchstens 5 Mark in der Kasse, bringen deine Karten 60 % mehr Glut.');
  trinket('farbwechsel', 'Farbwechsel', 1, 'Wechselst du das Symbol, bringt die Karte doppelte Glut.');
  trinket('gluecksrad', 'Glücksrad', 1, 'Jede gespielte Karte bringt mit 15 % Chance dreifache Glut.');
  // --- Glut: Kette ---
  trinket('schwarzer-peter', 'Schwarzer Peter', 0, 'Pik-Karten erhöhen deine Kette um 1 zusätzlich.');
  trinket('schadenfreude', 'Schadenfreude', 0, 'Setzt der Gegner aus, steigt deine Kette um 1.');
  trinket('bierdeckel', 'Bierdeckel', 0, 'Nach einer Niederlage startet deine Kette im nächsten Duell bei ×4.');
  trinket('koenigsmacher', 'Königsmacher', 1, 'Könige erhöhen deine Kette um 2 zusätzlich.');
  trinket('siebenmeilen', 'Siebenmeilenstiefel', 1, 'Deine 7en erhöhen die Kette um 3 zusätzlich.');
  trinket('strasse', 'Straße', 2, 'Legst du den nächsthöheren oder -niedrigeren Wert auf die oberste Karte, steigt deine Kette um 2 zusätzlich.');
  trinket('zweite-luft', 'Zweite Luft', 1, 'Einmal je Duell: Würde Ziehen deine Kette senken, bleibt sie stehen.');
  // --- Glut: wächst mit dem Run ---
  trinket('glutnest', 'Glutnest', 1, '+5 % Glut je Karte, die dein Deck über 16 hinaus hat.');
  trinket('minimalist', 'Minimalist', 2, '+12 % Glut je Karte, die deinem Deck auf 16 fehlt.');
  trinket('siegelring', 'Siegelring', 2, '+15 % Glut je veredelter Karte in deinem Deck.');
  trinket('aktienpaket', 'Aktienpaket', 2, '+20 % Glut je abgeschlossenem Akt.');
  trinket('serientaeter', 'Serientäter', 1, '+6 % Glut je Duell, das du in diesem Run gewonnen hast.');
  trinket('gluecksstraehne', 'Glückssträhne', 1, '+10 % Glut je Sieg in Folge.');
  // --- Glutziel und Löschmittel ---
  trinket('vorglut', 'Vorglut', 1, 'Du beginnst jedes Duell mit 10 % des Glutziels als Glut.');
  trinket('zuenglein', 'Zünglein an der Waage', 1, 'Jedes Glutziel ist 10 % niedriger.');
  trinket('feuerdecke', 'Feuerfeste Decke', 1, 'Löschdecke und Sprinkler kosten dich keine Glut.');
  trinket('oelfass', 'Ölfass', 1, 'Löschsand und Löschwasser senken deine Kette nicht.');
  trinket('fettbrand', 'Fettbrand', 2, 'Jedes Löschmittel, das dich trifft, facht nach: +8 % des Glutziels als Glut.');
  // --- Kasse ---
  trinket('trinkgeld', 'Spendierhosen', 0, 'Nach jedem Sieg gibt es 10 % deiner Kasse obendrauf (höchstens eine Tischprämie).');
  trinket('rabattmarke', 'Rabattmarke', 0, 'Die Neue Auslage kostet die Hälfte.');
  trinket('nachtschicht', 'Nachtschicht', 0, 'Siege zur Sperrstunde zahlen 50 % mehr Prämie.');
  trinket('brandpraemie', 'Brandprämie', 1, 'Abgefackelte Tische zahlen noch einmal 50 % der Prämie.');
  trinket('hausfreund', 'Hausfreund', 1, 'Esmes Pakete kosten 25 % weniger.');
  trinket('teufelspakt', 'Teufelspakt', 3, 'Alle deine Karten bringen doppelte Glut. Du beginnst jedes Duell verflucht (×2).');
  ZU.TRINKETS = trinkets;
  ZU.TRINKET_IDS = Object.keys(trinkets);

  /* ---------- Kniffe ----------
     Ein Kniff ist eine Regel, welche normalen Karten in einem Zug zusammen gelegt werden dürfen. Ein Zug folgt genau
     einem Kniff. Die Stufe begrenzt die Zahl der Karten (ZU.KNIFF_LIMIT); Aufstufen macht die Züge länger.
     tier: ab wie vielen ausgeräumten Casinos der Kniff in Runs auftaucht. */
  ZU.KNIFF_LIMIT = [0, 2, 3, 99];
  ZU.KNIFFE = {
    'pasch-7': { name: 'Siebenerpasch', glyph: '7·7', kind: 'rank', ranks: ['7'], start: 2, price: 8, tier: 0, text: 'Mehrere 7en gehen in einem Zug raus.' },
    'pasch-8': { name: 'Achterpasch', glyph: '8·8', kind: 'rank', ranks: ['8'], start: 2, price: 8, tier: 0, text: 'Mehrere 8en gehen in einem Zug raus.' },
    'pasch-zahl': { name: 'Zahlenpasch', glyph: '9·9', kind: 'rank', ranks: ['9', '10'], start: 2, price: 9, tier: 0, text: 'Mehrere 9en oder mehrere 10en gehen in einem Zug raus.' },
    'pasch-bild': { name: 'Hofpasch', glyph: 'B·B', kind: 'rank', ranks: ['J', 'Q', 'K'], start: 1, price: 10, tier: 1, text: 'Mehrere Buben, mehrere Damen oder mehrere Könige gehen in einem Zug raus.' },
    'pasch-ass': { name: 'Ass-Parade', glyph: 'A·A', kind: 'rank', ranks: ['A'], start: 2, price: 9, tier: 1, text: 'Mehrere Asse gehen in einem Zug raus.' },
    'lauf-spades': { name: 'Pik-Lauf', glyph: '♠♠', kind: 'suit', suit: 'spades', start: 1, price: 12, tier: 2, text: 'Mehrere Pik-Karten gehen in einem Zug raus.' },
    'lauf-hearts': { name: 'Herz-Lauf', glyph: '♥♥', kind: 'suit', suit: 'hearts', start: 1, price: 12, tier: 2, text: 'Mehrere Herz-Karten gehen in einem Zug raus.' },
    'lauf-diamonds': { name: 'Karo-Lauf', glyph: '♦♦', kind: 'suit', suit: 'diamonds', start: 1, price: 12, tier: 2, text: 'Mehrere Karo-Karten gehen in einem Zug raus.' },
    'lauf-clubs': { name: 'Kreuz-Lauf', glyph: '♣♣', kind: 'suit', suit: 'clubs', start: 1, price: 12, tier: 2, text: 'Mehrere Kreuz-Karten gehen in einem Zug raus.' },
    folge: { name: 'Kleine Straße', glyph: '8›9', kind: 'run', start: 1, price: 12, tier: 3, text: 'Aufeinanderfolgende Werte desselben Symbols gehen in einem Zug raus, etwa Herz 8-9-10.' },
    pasch: { name: 'Pasch', glyph: '=·=', kind: 'rank', ranks: null, start: 1, price: 16, tier: 5, text: 'Karten mit gleichem Wert gehen in einem Zug raus – egal welcher Wert.' }
  };
  ZU.KNIFF_IDS = Object.keys(ZU.KNIFFE);
  ZU.kniffText = function (id, level) {
    var limit = ZU.KNIFF_LIMIT[level];
    return ZU.KNIFFE[id].text + ' Stufe ' + level + ': ' + (limit >= 99 ? 'beliebig viele Karten.' : 'höchstens ' + limit + ' Karten.');
  };

  /* ---------- Privilegien ----------
     Gelten für den ganzen Run und belegen keinen Trinket-Platz. Manfred bietet je Akt genau eines an;
     die Neue Auslage ändert daran nichts. */
  var perks = {};
  function perk(id, name, price, text) { perks[id] = { id: id, name: name, price: price, text: text }; }
  perk('shelf', 'Großes Regal', 14, 'Das Spezialkarten-Regal hat 3 statt 2 Plätze.');
  perk('showcase', 'Vitrine', 14, 'Manfred zeigt 3 statt 2 Trinkets.');
  perk('regular', 'Stammplatz', 16, 'Jede Tischprämie fällt 25 % höher aus.');
  perk('grinder', 'Schleifer', 16, 'Spezialkarten im Laden sind mindestens farbgebunden.');
  perk('bell', 'Glockenrecht', 12, 'Die Neue Auslage kostet immer nur 2 Mark.');
  perk('ashbin', 'Aschekasten', 10, 'Verbrennen kostet immer nur 2 Mark.');
  perk('matchbook', 'Zündholzbrief', 20, 'Du erhältst ein zusätzliches Streichholz, auch über das Maximum hinaus.');
  ZU.PERKS = perks;
  ZU.PERK_IDS = Object.keys(perks);

  /* ---------- Gegner ---------- */
  var COMMON = ['stillstand', 'addieren'];
  var CURSE = ['fluch', 'addieren', 'stillstand'];
  var GAMBLE = ['tausch', 'opfer', 'zocken'];

  /* Reihenfolge der Bilder im Sprite-Streifen (assets/enemies/<id>.png). */
  ZU.MOODS = ['idle', 'blink', 'smug', 'angry', 'shocked', 'defeated'];

  var enemies = {};
  function enemy(id, def) {
    def.id = id;
    def.chain = def.chain || 1;
    enemies[id] = def;
  }

  /* --- Tische: Belegschaft und Stammgäste --- */
  enemy('ember-croupier', {
    name: 'Emil', role: 'Glut-Croupier', kind: 'battle', ai: 'greedy', pool: COMMON, bg: '#1f4a3a',
    passive: null, passiveText: 'Spielt sauber nach Hausregeln. Noch.',
    say: {
      start: ['Die Einsätze, bitte.', 'Sieben Karten für Sie. Viel Glück … Sie werden es brauchen.'],
      attack: ['Zwei für Sie. Hausregel.', 'Bedaure. Nicht.'],
      hurt: ['Hm. Notiert.', 'Das … war regelkonform. Leider.'],
      nervous: ['Einen Moment, ich … muss nachzählen.', 'Das Haus sieht so etwas ungern!'],
      gloat: ['Die Bank gewinnt. Wie immer.', 'Noch eine Karte, dann schließe ich ab.'],
      win: ['Das Haus dankt für Ihren Einsatz.'],
      lose: ['Gut gespielt. Ich … melde das nach oben.']
    }
  });
  enemy('curse-dealer', {
    name: 'Mortimer', role: 'Fluchdealer', kind: 'battle', ai: 'pressure', pool: CURSE, bg: '#3a2140',
    passive: 'evil-eye', passiveText: 'Böser Blick: Du beginnst verflucht (×1).',
    say: {
      start: ['Die Karten … flüstern schon von dir …', 'Zieh … wenn du dich traust …'],
      attack: ['Nimm … nimm mehr …', 'Der Stapel mag dich … hihihi …'],
      hurt: ['Tsss … das merke ich mir …', 'Wie … unhöflich …'],
      nervous: ['Der Bann … er bröckelt?!', 'Nein … nein, nein, nein …'],
      gloat: ['Spürst du es? Das Ende … ganz nah …', 'Gleich … gehört deine Seele dem Stapel …'],
      win: ['Verflucht gelaufen … hihi …'],
      lose: ['Der Fluch … bricht … wie kann das …']
    }
  });
  enemy('cheater', {
    name: 'Rico', role: 'Falschspieler', kind: 'battle', ai: 'gamble', pool: GAMBLE, bg: '#4a2a1a',
    passive: 'sleeve', passiveText: 'Ass im Ärmel: Seine Asse passen auf jede Karte.',
    say: {
      start: ['Fair? Nie gehört, Amigo~', 'Schau mir ruhig auf die Finger. Bringt nix~'],
      attack: ['Uuups~ War das etwa meine?', 'Aus dem Ärmel geschüttelt!'],
      hurt: ['He! Das ist MEIN Trick!', 'Frechheit … wo hast du die her?!'],
      nervous: ['Moment, Moment … wir können doch reden, ja?', 'Das … das war so nicht abgesprochen!'],
      gloat: ['Tja~ Wer zuletzt mischt …', 'Riechst du das? So riecht Verlieren~'],
      win: ['… mischt am besten. Ciao~'],
      lose: ['Du hast doch gezinkt! … Respekt.']
    }
  });
  enemy('cigarette-girl', {
    name: 'Lola', role: 'Zigarettenmädchen', kind: 'battle', ai: 'greedy', pool: ['addieren', 'stillstand', 'spion'], bg: '#5a2230',
    passive: 'light', passiveText: 'Feuer gefällig: Sie beginnt mit einer 7 auf der Hand.',
    say: {
      start: ['Zigarren, Zigaretten … oder lieber eine Abreibung, Süßer~?', 'Na~? Feuer gefällig?'],
      attack: ['Ups~ Die gehen aufs Haus!', 'Zwei für dich, Hübscher~'],
      hurt: ['Hey! So behandelt man keine Dame!', 'Autsch … du bist ja gar nicht so nett!'],
      nervous: ['M-Moment! Ich muss gleich wieder an die Arbeit …', 'Jetzt mal langsam, Süßer!'],
      gloat: ['Och~ Wird dir etwa warm?', 'Gleich ist Feierabend für dich~'],
      win: ['War schön mit dir~ Trinkgeld nicht vergessen!'],
      lose: ['Na gut … DU darfst wiederkommen~']
    }
  });
  enemy('barkeeper', {
    name: 'Bruno', role: 'Barkeeper', kind: 'battle', ai: 'greedy', pool: ['stillstand', 'hodl', 'addieren'], bg: '#3b2a1c',
    passive: 'last-round', passiveText: 'Letzte Runde: Sperrstunde schon nach 36 Zügen.',
    say: {
      start: ['… Was darf es sein?', 'Setz dich. Trink. Verlier.'],
      attack: ['Geht aufs Haus.', 'Doppelter. Für dich.'],
      hurt: ['… Hm.', 'Das putz ich nicht weg.'],
      nervous: ['… Letzte Runde?!', 'Moment. So war das nicht bestellt.'],
      gloat: ['Sperrstunde. Gleich.', '… Zahlen.'],
      win: ['Der Nächste.'],
      lose: ['… Respekt. Der geht auf mich.']
    }
  });
  enemy('showgirl', {
    name: 'Roxy', role: 'Revuegirl', kind: 'battle', ai: 'gamble', pool: ['tausch', 'zocken', 'addieren'], bg: '#5a3312',
    passive: 'encore', passiveText: 'Zugabe: Ihre erste Spezialkarte beendet ihren Zug nicht.',
    say: {
      start: ['Vorhang auf, Darling! Heute Abend: DEIN Untergang!', 'Applaus bitte~ Ich bin da!'],
      attack: ['Und – TUSCH!', 'Na, Darling? War das nicht fabelhaft?!'],
      hurt: ['Meine Federn! Pass doch auf!', 'Buh! BUH! Wer hat dich gebucht?!'],
      nervous: ['D-das steht so nicht im Programm!', 'Licht aus! Sofort Licht aus!!'],
      gloat: ['Zugabe? Aber gern~', 'Das große Finale, Darling!'],
      win: ['Danke, danke~ Ihr wart ein wunderbares Publikum!'],
      lose: ['… Die Kritiken werden vernichtend. Für MICH. Hmpf!']
    }
  });
  enemy('bruiser', {
    name: 'Knochen-Kalle', role: 'Schläger', kind: 'battle', ai: 'pressure', pool: ['addieren', 'addieren', 'fluch'], bg: '#2c3038',
    passive: 'heavy-hand', passiveText: 'Schwere Hand: Seine 7en lassen dich 2 Karten ziehen statt 1.',
    say: {
      start: ['Der Boss sagt, ich soll dir wehtun. Mit KARTEN!', 'Kalle spielt. Du verlierst. Klar?!'],
      attack: ['ZACK!!', 'Da! Friss Karten!'],
      hurt: ['AUA! Das sag ich dem Boss!', 'Hä?! Darf der das?!'],
      nervous: ['Kalle … Kalle versteht das nicht …', 'Nich so schnell! Ich zähl noch!'],
      gloat: ['Höhö. Gleich knackt es.', 'Kalle gewinnt! KALLE GEWINNT!'],
      win: ['Höhöhö. Schönen Gruß vom Boss!'],
      lose: ['… Der Boss haut MICH jetzt.']
    }
  });
  enemy('pianist', {
    name: 'Fingers', role: 'Pianist', kind: 'battle', ai: 'greedy', pool: ['spion', 'stillstand', 'zocken'], bg: '#1f2f44',
    passive: 'by-ear', passiveText: 'Nach Gehör: Kennt in seinen ersten 3 Zügen deine Hand.',
    say: {
      start: ['Setz dich, Kleiner … ich spiel dir was Trauriges ♪', 'Jeder Abend endet in Moll …'],
      attack: ['Und jetzt … der Refrain ♪', 'Hörst du das? Dein Schlussakkord.'],
      hurt: ['Uff … falscher Ton.', 'Du spielst ja … Free Jazz?!'],
      nervous: ['Das Tempo … viel zu schnell …!', 'Wer hat DAS denn komponiert?!'],
      gloat: ['Letzte Strophe, Kleiner ♪', 'Gleich fällt der Deckel …'],
      win: ['Ein schöner, trauriger Abend ♪'],
      lose: ['… Spiel es noch einmal. Aber ohne mich.']
    }
  });
  enemy('bookie', {
    name: 'Quoten-Otto', role: 'Buchmacher', kind: 'battle', ai: 'gamble', pool: ['zocken', 'addieren', 'opfer'], bg: '#4a3a14',
    passive: 'odds', passiveText: 'Wettschein: Schlägst du ihn, zahlt er 30 % mehr Prämie.',
    say: {
      start: ['Drei zu eins gegen dich! Wer setzt?! Niemand?!', 'Schnell-schnell, die Quoten laufen!'],
      attack: ['Ha! Fünf zu eins!', 'Hab ich es gesagt?! Ich hab es gesagt!'],
      hurt: ['Oh nein-nein-nein, die Quote!', 'Das war NICHT eingepreist!!'],
      nervous: ['Ich … ich hab die Miete drauf gesetzt …!', 'Zwanzig zu eins?! Wer rechnet denn so?!'],
      gloat: ['Sichere Bank, sichere Bank!', 'Auszahlung in drei … zwei …'],
      win: ['Kasse! KASSE! Der Nächste bitte!'],
      lose: ['Ruiniert … ich bin ruiniert … schon wieder!']
    }
  });

  /* --- Elite: die Spezialisten des Hauses --- */
  enemy('card-counter', {
    name: 'Dr. Zahl', role: 'Kartenzähler', kind: 'elite', ai: 'counter', handBonus: 1, pool: COMMON.concat(['zocken', 'opfer']), bg: '#243746',
    passive: 'sees-hand', passiveText: 'Kennt deine Hand und spielt gezielt dagegen.',
    say: {
      start: ['Ich kenne dein Blatt. Alle Karten. Statistisch bist du erledigt.', 'Siegchance: 11,4 Prozent. Für dich.'],
      attack: ['Berechnet.', 'Wie erwartet. Exakt wie erwartet.'],
      hurt: ['Abweichung …? Interessant.', 'Das … war nicht im Modell!'],
      nervous: ['Unmöglich. Ich rechne nach. Ich rechne NACH!', 'Die Varianz … sie eskaliert …!'],
      gloat: ['Konvergenz gegen null. Deine.', 'Quod erat … gleich … demonstrandum.'],
      win: ['Quod erat demonstrandum.'],
      lose: ['Varianz. Pure … Varianz. Sag es niemandem.']
    }
  });
  enemy('double-igniter', {
    name: 'Funke', role: 'Doppelzünder', kind: 'elite', ai: 'pressure', pool: CURSE, bg: '#5a2a12',
    passive: 'amplify', passiveText: 'Sein erster Zieheffekt zwingt dich zu 2 Karten extra.',
    say: {
      start: ['Zweimal zünden hält besser! HAHA!', 'Riechst du das?! Schwefel! Herrlich!!'],
      attack: ['BUMM!!', 'Und gleich NOCHMAL! Hihihi!'],
      hurt: ['Autsch! Heiß, heiß, heiß!', 'Nicht pusten! NICHT PUSTEN!'],
      nervous: ['Oh-oh … Lunte zu kurz …', 'Das geht gleich hoch! Und zwar bei MIR?!'],
      gloat: ['Drei … zwei … hihihi …', 'Gleich knallt es! Ohren zu!'],
      win: ['KA-WUMM! Ausgebrannt, was?!'],
      lose: ['… Fehlzündung. Pfffff.']
    }
  });
  enemy('black-widow', {
    name: 'Vera', role: 'Schwarze Witwe', kind: 'elite', ai: 'pressure', pool: CURSE.concat(['opfer']), bg: '#2a1c2e',
    passive: 'venom', passiveText: 'Gift: Du beginnst verflucht (×2).',
    say: {
      start: ['Mein vierter Mann saß auch auf diesem Stuhl … Setz dich doch.', 'Du erinnerst mich an jemanden. Er ist tot~'],
      attack: ['Ein kleiner Stich … spürst du ihn schon?', 'Nimm ruhig. Es wirkt langsam~'],
      hurt: ['Oh … du wehrst dich. Wie rührend.', 'Vorsicht, Liebling. Ich erbe gern.'],
      nervous: ['Das … hat noch keiner überlebt …!', 'Bleib … bleib doch noch!'],
      gloat: ['Schwarz steht mir. Dir gleich auch~', 'Hast du ein Testament, Liebling?'],
      win: ['Ruhe sanft, Liebling~'],
      lose: ['… Der Erste, der wieder aufsteht. Faszinierend.']
    }
  });
  enemy('pickpocket', {
    name: 'Sally', role: 'Seidenfinger', kind: 'elite', ai: 'gamble', handBonus: 1, pool: ['zocken', 'stillstand', 'addieren'], bg: '#3a3220', chain: 2,
    passive: 'chains', passiveText: 'Flinke Finger: legt Paare mit gleichem Wert.',
    say: {
      start: ['Hübsche Uhr! … Also, GEHABT, hihi~', 'Zähl nach dem Spiel lieber deine Finger!'],
      attack: ['Schwupps~ Meins!', 'Zack, zack – zwei auf einmal!'],
      hurt: ['Ey! Finger weg, das ist MEIN Job!', 'Menno … du passt ja auf!'],
      nervous: ['Ähm … da hinten ist die Polizei! Guck mal!', 'Ich … ich muss dann mal weg!'],
      gloat: ['Gleich hab ich alles. Auch deine Schuhe~', 'Leere Taschen stehen dir!'],
      win: ['Danke fürs Mitspielen~ Und fürs Portemonnaie!'],
      lose: ['Na schön … hier, deine Uhr. Und die andere auch.']
    }
  });
  enemy('bouncer', {
    name: 'Schrank', role: 'Türsteher', kind: 'elite', ai: 'greedy', pool: COMMON.concat(['fluch', 'opfer']), bg: '#23262c',
    passive: 'thick-skin', passiveText: 'Dickes Fell: ignoriert dein erstes Aussetzen.',
    say: {
      start: ['Du kommst hier nicht rein. Du kommst hier nur RAUS.', 'Geschlossene Gesellschaft.'],
      attack: ['Draußen bleiben.', 'Heute nicht. Morgen auch nicht.'],
      hurt: ['… Kitzelt.', 'Das war dein Freischuss.'],
      nervous: ['Chef …? CHEF?!', 'Moment. So war das nicht vereinbart.'],
      gloat: ['Gleich fliegst du. Im hohen Bogen.', 'Ich zähl bis drei. Zwei hab ich schon.'],
      win: ['Und tschüss.'],
      lose: ['… Na gut. Du stehst auf der Liste.']
    }
  });

  /* --- Bosse: wem die Tische gehören --- */
  enemy('boss-shark', {
    name: 'Der Schieber', role: 'Boss im Hinterzimmer', kind: 'boss', ai: 'gamble', pool: COMMON.concat(GAMBLE), bg: '#16324a',
    passive: 'head-start', passiveText: 'Vorsprung: beginnt mit 2 Karten weniger.',
    say: {
      start: ['Ich fang schon mal an, Kleiner. Zwei Karten Vorsprung – Hausrabatt, höhö.', 'Hier schiebt nur einer. ICH.'],
      attack: ['Rüber damit!', 'Geschoben, Kleiner. Sauber geschoben.'],
      hurt: ['Nicht schlecht … für Laufkundschaft.', 'Das zahlst du zurück. Mit Zinsen!'],
      nervous: ['Jungs?! Jungs, kommt mal her!', 'Schweiß? Das ist … die Zigarre!'],
      gloat: ['Na? Wird eng im Kragen, was?', 'Gleich gehört mir auch dein Hut.'],
      win: ['Abgezogen. Der Nächste!'],
      lose: ['Akt eins gehört dir, Kleiner. Mehr nicht … mehr nicht!']
    }
  });
  enemy('boss-dolores', {
    name: 'Diamanten-Dolores', role: 'Boss im Hinterzimmer', kind: 'boss', ai: 'house', pool: COMMON.concat(GAMBLE), bg: '#2c3a4a',
    passive: 'jewels', passiveText: 'Schmuckkästchen: hält zu Beginn 3 Joker auf der Hand.',
    say: {
      start: ['Schätzchen, dieser Stein kostet mehr als dein ganzes Leben~', 'Champagner für mich. Für ihn … die Rechnung.'],
      attack: ['Funkelt hübsch, nicht wahr~?', 'Ein kleines Geschenk. Unverzollt!'],
      hurt: ['Mein Collier! Kratz das ja nicht an!', 'Wie … gewöhnlich von dir.'],
      nervous: ['Das sind echte! Fass sie NICHT an!', 'Hach … mir wird ganz blümerant …'],
      gloat: ['Alles meins, Schätzchen. Du gleich auch~', 'Soll ich dich einfassen lassen? In Blech?'],
      win: ['Wie schade. Du hättest so schön geglänzt~'],
      lose: ['Nimm einen Stein und … verschwinde. Den kleinen!']
    }
  });
  enemy('boss-smoke', {
    name: 'Madame Rauch', role: 'Boss im Rauchsalon', kind: 'boss', ai: 'pressure', pool: CURSE.concat(['zocken', 'opfer']), bg: '#3d1f33',
    passive: 'smoke', passiveText: 'Rauchschleier: Dein erster Zieh-, Aussetz- oder Fluch-Effekt prallt auf dich zurück.',
    say: {
      start: ['Schätzchen … puste ruhig. Es kommt alles zurück~', 'Setz dich in meinen Rauch. Er vergisst nichts.'],
      attack: ['Mit Kuss zurück~', 'Wie reizend von dir.'],
      hurt: ['Oh … du beißt ja.', 'Unverschämt. Und irgendwie charmant.'],
      nervous: ['Der Rauch … lichtet sich?!', 'Hust … das … ist mir neu.'],
      gloat: ['Gleich bist du nur noch Dunst, mein Lieber~', 'Ein letzter Zug …'],
      win: ['Verpufft, mein Lieber~'],
      lose: ['Hmm … Feuer hast du. Das muss man dir lassen.']
    }
  });
  enemy('boss-consigliere', {
    name: 'Der Consigliere', role: 'Boss im Rauchsalon', kind: 'boss', ai: 'counter', pool: CURSE.concat(['zocken', 'stillstand']), bg: '#262a30',
    passive: 'void-special', passiveText: 'Kleingedrucktes: Deine erste Spezialkarte je Duell verpufft wirkungslos.',
    say: {
      start: ['Die Familie macht dir ein Angebot. Du wirst verlieren.', 'Setz dich. Es ist nichts Persönliches … nur Geschäft.'],
      attack: ['Eine Gefälligkeit der Familie.', 'Paragraf sieben. Lies das Kleingedruckte.'],
      hurt: ['… Vermerkt.', 'Das wird die Familie nicht vergessen.'],
      nervous: ['Das … steht in keinem Vertrag!', 'Ich muss kurz telefonieren. Dringend.'],
      gloat: ['Unterschreib hier. Und hier. Und hier.', 'Die Familie bedankt sich im Voraus.'],
      win: ['Geschäft ist Geschäft.'],
      lose: ['… Die Familie wird davon erfahren. Leider von mir.']
    }
  });
  enemy('boss-house', {
    name: 'Der Hausherr', role: 'Boss des Hauses', kind: 'boss', ai: 'house', pool: COMMON.concat(['fluch']).concat(GAMBLE), bg: '#4a1512',
    passive: 'house', passiveText: 'Hausrecht: Du beginnst verflucht (×3). Er beginnt mit 1 Karte weniger.',
    say: {
      start: ['Mein Haus. Meine Regeln. DEIN Pech.', 'Am Ende gewinnt immer das Haus. Immer!'],
      attack: ['Hausrecht!', 'Zahlen, bitte.'],
      hurt: ['Wer hat DEN hereingelassen?!', 'Das wird teuer. Sehr teuer.'],
      nervous: ['Wachen!! … Wo sind meine Wachen?!', 'Das Haus … wackelt nicht. Es WACKELT NICHT!'],
      gloat: ['Siehst du die Tür? Du gehst ohne Schuhe.', 'Hundert Jahre. Ungeschlagen.'],
      win: ['Das Haus gewinnt. Immer.'],
      lose: ['Unmöglich … das Haus … BRENNT?!']
    }
  });
  enemy('boss-donna', {
    name: 'Donna Scarlatta', role: 'Boss des Hauses', kind: 'boss', ai: 'house', pool: COMMON.concat(['fluch']).concat(GAMBLE), bg: '#4a1220', chain: 2,
    passive: 'donna', passiveText: 'Die Patin: Du ziehst zu Beginn 2 Karten extra. Sie legt Paare mit gleichem Wert.',
    say: {
      start: ['Man sagt, du zündelst in MEINEM Haus … Küss den Ring. Oder spiel.', 'Schön, dich kennenzulernen. Schade um dich~'],
      attack: ['Ein Gruß der Familie~', 'Rosen für dich. Mit Dornen.'],
      hurt: ['… Mutig. Dumm, aber mutig.', 'Das hat zuletzt mein Bruder gewagt. Friede seiner Asche.'],
      nervous: ['Niemand … NIEMAND spielt so mit mir!', 'Luigi! Den Wagen. Sofort!'],
      gloat: ['Sag „bitte“. Vielleicht höre ich zu~', 'Die Stadt gehört mir. Du gleich auch.'],
      win: ['Addio, Zündler~ Blumen schicke ich.'],
      lose: ['… Die Stadt gehört dir. Für heute Nacht.']
    }
  });

  /* --- Casinos: Jedes Haus nach dem ersten bringt einen eigenen Tisch, eine eigene Elite und seinen Boss mit.
     "casino" ist der Index in ZU.CASINOS; diese Figuren tauchen nur dort auf. --- */
  enemy('taxi-dancer', {
    name: 'Mimi', role: 'Eintänzerin', kind: 'battle', casino: 'rialto', ai: 'greedy', pool: ['stillstand', 'addieren', 'nachschlag'], bg: '#1f4a4a', chain: 2,
    passive: 'chains', passiveText: 'Paartanz: legt Paare mit gleichem Wert.',
    say: {
      start: ['Ein Tanz kostet zehn Pfennig. Verlieren ist gratis~', 'Führen oder folgen, Süßer?'],
      attack: ['Und – Drehung!', 'Auf die Füße getreten? Ups~'],
      hurt: ['He! Nicht so stürmisch!', 'Du tanzt ja aus der Reihe!'],
      nervous: ['Die Musik … wird zu schnell!', 'Moment, mein Schuh!'],
      gloat: ['Letzter Tanz, Süßer~', 'Gleich ist die Platte zu Ende.'],
      win: ['Danke für den Tanz~ Der Nächste!'],
      lose: ['… Na schön. Du führst.']
    }
  });
  enemy('bandleader', {
    name: 'Kapellmeister Bela', role: 'Kapellmeister', kind: 'elite', casino: 'rialto', ai: 'counter', handBonus: 1, pool: COMMON.concat(['nebelkerze', 'zocken']), bg: '#3a2a44',
    passive: 'upbeat', passiveText: 'Auftakt: Du setzt zu Beginn einmal aus.',
    say: {
      start: ['Und eins, und zwei – ICH gebe den Takt an!', 'Ruhe im Saal! Der Maestro spielt.'],
      attack: ['Fortissimo!', 'Im Takt bleiben, Dilettant!'],
      hurt: ['Falsch! FALSCH! Wer hat das arrangiert?!', 'Ein Missklang … von MIR?'],
      nervous: ['Das Orchester … hört nicht mehr auf mich!', 'Taktstock! Wo ist mein Taktstock?!'],
      gloat: ['Schlussakkord in drei Takten.', 'Verbeugen Sie sich. Vor mir.'],
      win: ['Applaus! Für mich, versteht sich.'],
      lose: ['… Ich verlange eine Wiederholung. Da capo!']
    }
  });
  enemy('boss-impresario', {
    name: 'Der Impresario', role: 'Boss im Rialto', kind: 'boss', casino: 'rialto', ai: 'house', pool: COMMON.concat(['nebelkerze', 'tausch', 'zocken']), bg: '#4a1a26',
    passive: 'finale', passiveText: 'Großes Finale: Hält er nur noch 2 Karten, ziehst du einmal 2.',
    say: {
      start: ['Mein Palast, meine Bühne, mein Abend. Du bist die Vorgruppe.', 'Jeder Stern hier gehört mir. Du auch gleich.'],
      attack: ['Scheinwerfer auf den Verlierer!', 'Das Publikum liebt es!'],
      hurt: ['Wer hat DEN engagiert?!', 'Das steht nicht im Vertrag!'],
      nervous: ['Vorhang! VORHANG, sage ich!', 'Die Kasse … zählt da jemand nach?'],
      gloat: ['Und jetzt: das große Finale!', 'Verbeug dich, solange du noch stehst.'],
      win: ['Ausverkauft. Wie immer.'],
      lose: ['… Der Palast gehört heute dir. Die Rechnung auch.']
    }
  });
  enemy('sailor', {
    name: 'Matrose Hein', role: 'Decksmann', kind: 'battle', casino: 'fortuna', ai: 'pressure', pool: ['addieren', 'fluch', 'stillstand'], bg: '#1c3246',
    passive: 'list', passiveText: 'Schlagseite: Du beginnst mit einer Karte mehr.',
    say: {
      start: ['Landratte an Bord! Halt dich fest.', 'Hier draußen gilt nur ein Gesetz: meins.'],
      attack: ['Über Bord damit!', 'Das war die Welle. Die nächste ist größer.'],
      hurt: ['Verdammt … Seegang!', 'Du schwankst ja gar nicht!'],
      nervous: ['Käptn?! Der kann schwimmen!', 'Wasser im Rumpf … bei MIR?'],
      gloat: ['Gleich gehst du baden.', 'Kiel holen. Jetzt.'],
      win: ['Mann über Bord. Weiter im Text.'],
      lose: ['… Seefest bist du. Das geb ich zu.']
    }
  });
  enemy('purser', {
    name: 'Zahlmeister Pfennig', role: 'Zahlmeister', kind: 'elite', casino: 'fortuna', ai: 'counter', pool: COMMON.concat(['hodl', 'opfer', 'zocken']), bg: '#3a3a2a',
    passive: 'purser', passiveText: 'Bordkasse: Von deiner Bank behält er die Hälfte ein.',
    say: {
      start: ['Jede Mark an Bord geht durch MEINE Bücher.', 'Quittung? Wird nachgereicht. Nie.'],
      attack: ['Gebühr.', 'Bearbeitungszuschlag. Bedaure.'],
      hurt: ['Das … war nicht budgetiert!', 'Ein Fehlbetrag?! Unmöglich!'],
      nervous: ['Die Bücher stimmen nicht mehr …!', 'Nicht die Kasse. NICHT die Kasse!'],
      gloat: ['Saldo: zu meinen Gunsten.', 'Gleich wird abgerechnet.'],
      win: ['Verbucht.'],
      lose: ['… Das zieht man mir vom Lohn ab. Schon wieder.']
    }
  });
  enemy('boss-captain', {
    name: 'Kapitänin Fortuna', role: 'Boss der Fortuna', kind: 'boss', casino: 'fortuna', ai: 'pressure', pool: CURSE.concat(['nebelkerze', 'brandsatz', 'zocken']), bg: '#16324a',
    passive: 'storm', passiveText: 'Sturmwarnung: Jeden fünften ihrer Züge ziehst du 1 Karte.',
    say: {
      start: ['Mein Schiff, mein Glück. Dein Name steht nicht auf der Passagierliste.', 'Auf See gewinnt, wer den Sturm kennt.'],
      attack: ['Hart backbord!', 'Das war nur eine Bö.'],
      hurt: ['Ha! Endlich Wind von vorn.', 'Treffer. Das Schiff hält.'],
      nervous: ['Alle Mann … wo sind alle Mann?!', 'Das Ruder klemmt …!'],
      gloat: ['Der Sturm kommt. Ich rieche ihn.', 'Gleich läufst du auf Grund.'],
      win: ['Kurs halten. Der Nächste.'],
      lose: ['… Nimm das Steuer. Für heute Nacht.']
    }
  });
  enemy('bellboy', {
    name: 'Page Anton', role: 'Hotelpage', kind: 'battle', casino: 'imperial', ai: 'gamble', pool: ['nachschlag', 'zocken', 'addieren'], bg: '#5a1c1c',
    passive: 'encore', passiveText: 'Zimmerservice: Seine erste Spezialkarte beendet seinen Zug nicht.',
    say: {
      start: ['Gepäck? Trinkgeld? Niederlage? Wird alles aufs Zimmer gebracht!', 'Die Herrschaften wünschen zu verlieren?'],
      attack: ['Sehr wohl!', 'Mit Empfehlung des Hauses!'],
      hurt: ['Autsch! Das melde ich der Direktion!', 'So behandelt man kein Personal!'],
      nervous: ['Ich … ich hab gleich Feierabend!', 'Der Lift! Ich muss zum Lift!'],
      gloat: ['Darf es sonst noch etwas sein? Ein Taxi?', 'Ihr Zimmer wird gerade geräumt.'],
      win: ['Beehren Sie uns nie wieder!'],
      lose: ['… Trinkgeld gibt es jetzt wohl keins.']
    }
  });
  enemy('concierge', {
    name: 'Concierge Laurent', role: 'Concierge', kind: 'elite', casino: 'imperial', ai: 'house', pool: COMMON.concat(['spion', 'tausch', 'nebelkerze']), bg: '#2a2a30',
    passive: 'keys', passiveText: 'Generalschlüssel: Seine Spezialkarten passen auf jede Karte.',
    say: {
      start: ['Für unsere Gäste ist nichts unmöglich. Für Sie schon.', 'Ich habe zu jeder Tür einen Schlüssel. Auch zu Ihrer.'],
      attack: ['Wie Sie wünschen.', 'Diskret erledigt.'],
      hurt: ['Wie … unpassend.', 'Das Haus nimmt das zur Kenntnis.'],
      nervous: ['Ich muss Sie bitten, leiser zu gewinnen.', 'Das hat es hier noch nie gegeben!'],
      gloat: ['Ihr Wagen fährt gleich vor.', 'Darf ich Ihnen den Ausgang zeigen?'],
      win: ['Stets zu Diensten.'],
      lose: ['… Ich lasse Ihnen die Suite richten.']
    }
  });
  enemy('boss-baroness', {
    name: 'Baronin von Hohenstein', role: 'Boss im Imperial', kind: 'boss', casino: 'imperial', ai: 'house', pool: CURSE.concat(['tausch', 'brandsatz', 'ausgleich']), bg: '#2a2430',
    passive: 'baroness', passiveText: 'Alter Adel: Du beginnst verflucht (×2). Sie beginnt mit 2 Karten weniger.',
    say: {
      start: ['Man hat Sie hereingelassen? Das Personal wird nachlässig.', 'Mein Urgroßvater hat dieses Haus gewonnen. Am Kartentisch.'],
      attack: ['Contenance.', 'So macht man das in unseren Kreisen.'],
      hurt: ['Wie ordinär.', 'Das wird ein Nachspiel haben. Bei Hofe.'],
      nervous: ['Mein Riechsalz! Sofort!', 'Ein Emporkömmling … und er gewinnt?!'],
      gloat: ['Knicksen Sie. Es macht den Abschied leichter.', 'Sie waren ein amüsanter Zeitvertreib.'],
      win: ['Man lasse ihn hinausbegleiten.'],
      lose: ['… Behalten Sie das Haus. Der Stammbaum bleibt bei mir.']
    }
  });
  enemy('croupier', {
    name: 'Croupier Klara', role: 'Croupier', kind: 'battle', casino: 'monopol', ai: 'counter', pool: ['stillstand', 'nebelkerze', 'spion'], bg: '#143a30',
    passive: 'last-round', passiveText: 'Rien ne va plus: Sperrstunde deutlich früher.',
    say: {
      start: ['Faites vos jeux.', 'Die Bank dankt für Ihren Besuch. Im Voraus.'],
      attack: ['Rien ne va plus.', 'Die Null. Bedaure.'],
      hurt: ['… Auszahlung.', 'Das Glück ist eine Laune.'],
      nervous: ['Chef de table! Bitte an Tisch vier!', 'Die Kugel … rollt falsch.'],
      gloat: ['Letzte Einsätze.', 'Die Bank gewinnt.'],
      win: ['Merci. Der Nächste, bitte.'],
      lose: ['… Die Bank ist gesprengt. Pardon.']
    }
  });
  enemy('vault-guard', {
    name: 'Tresorwächter Brock', role: 'Tresorwächter', kind: 'elite', casino: 'monopol', ai: 'greedy', pool: COMMON.concat(['fluch', 'brandsatz']), bg: '#2c3038',
    passive: 'armored', passiveText: 'Panzertür: Deine ersten 2 Zieheffekte prallen an ihm ab.',
    say: {
      start: ['Hinter mir liegt das Geld. Vor mir liegst gleich du.', 'Kein Ausweis, kein Durchgang.'],
      attack: ['Zurück.', 'Sperrzone.'],
      hurt: ['… Kratzer.', 'Das war Sachbeschädigung.'],
      nervous: ['Alarm … wo ist der Alarmknopf?!', 'Die Tür gibt nach?!'],
      gloat: ['Ich schließ gleich ab. Mit dir drin.', 'Schichtende. Für dich.'],
      win: ['Gesichert.'],
      lose: ['… Die Kombination ist sieben, sieben, sieben. Sag es keinem.']
    }
  });
  enemy('boss-director', {
    name: 'Direktor Monopol', role: 'Boss der Spielbank', kind: 'boss', casino: 'monopol', ai: 'counter', pool: COMMON.concat(['ausgleich', 'tausch', 'brandsatz', 'nebelkerze']), bg: '#1e1e24',
    passive: 'director', passiveText: 'Hausbank: Er kennt deine Hand und hält zu Beginn 3 Joker.',
    say: {
      start: ['Ich habe Ihre Akte gelesen. Dünn. Wie Ihre Chancen.', 'In diesem Haus wird nicht gespielt. Hier wird abgerechnet.'],
      attack: ['Posten gebucht.', 'Das war absehbar.'],
      hurt: ['Eine Unregelmäßigkeit.', 'Das wird geprüft werden.'],
      nervous: ['Die Aufsicht … niemand ruft die Aufsicht!', 'Meine Bilanz …!'],
      gloat: ['Ihr Konto ist geschlossen.', 'Unterschreiben Sie den Offenbarungseid.'],
      win: ['Die Bank gewinnt. Es steht im Namen.'],
      lose: ['… Ich trete zurück. Aus gesundheitlichen Gründen.']
    }
  });
  enemy('stoker', {
    name: 'Heizer Ruß', role: 'Heizer', kind: 'battle', casino: 'inferno', ai: 'pressure', pool: ['addieren', 'brandsatz', 'fluch'], bg: '#3a1c10',
    passive: 'amplify', passiveText: 'Volle Schaufel: Sein erster Zieheffekt zwingt dich zu 2 Karten extra.',
    say: {
      start: ['Hier unten ist es immer warm. Du gewöhnst dich dran.', 'Noch eine Schaufel. Für dich.'],
      attack: ['Kohle nachlegen!', 'Heiß genug?'],
      hurt: ['Pfff … Funkenflug.', 'Das zischt ja!'],
      nervous: ['Der Kessel … der Kessel pfeift!', 'Zu viel Druck! ZU VIEL DRUCK!'],
      gloat: ['Gleich bist du Schlacke.', 'Die Glut frisst alles.'],
      win: ['Asche. Mehr bleibt nie.'],
      lose: ['… Ausgebrannt. Ich. Ausgerechnet.']
    }
  });
  enemy('siren', {
    name: 'Die Sirene', role: 'Sängerin', kind: 'elite', casino: 'inferno', ai: 'gamble', handBonus: 1, pool: CURSE.concat(['tausch', 'nebelkerze', 'mischmasch']), bg: '#3d1420',
    passive: 'smoke', passiveText: 'Sirenengesang: Dein erster Zieh-, Aussetz- oder Fluch-Effekt prallt auf dich zurück.',
    say: {
      start: ['Hör mir zu … nur ein Lied. Dein letztes~', 'Komm näher. Noch näher~'],
      attack: ['Sing mit, Liebling~', 'Diese Strophe kennst du nicht.'],
      hurt: ['Ein falscher Ton … von dir?', 'Du hörst ja gar nicht zu!'],
      nervous: ['Meine Stimme … sie bricht …', 'Nein! Sieh mich an! SIEH MICH AN!'],
      gloat: ['Schlaf ein, Liebling~', 'Der Refrain gehört mir.'],
      win: ['Zugabe gibt es keine~'],
      lose: ['… Du hast Wachs in den Ohren. Klug.']
    }
  });
  enemy('boss-prince', {
    name: 'Der Fürst', role: 'Boss im Inferno', kind: 'boss', casino: 'inferno', ai: 'house', pool: CURSE.concat(['inferno', 'brandsatz', 'tausch', 'ausgleich', 'mischmasch']), bg: '#4a0e0e', chain: 2,
    passive: 'prince', passiveText: 'Höllenfeuer: Du beginnst verflucht (×3). Er legt Paare und ignoriert dein erstes Aussetzen.',
    say: {
      start: ['Willkommen ganz unten. Den Vertrag hast du längst unterschrieben.', 'Alle spielen irgendwann gegen mich. Du bist nur früh dran.'],
      attack: ['Brenn ein wenig.', 'Das war noch höflich.'],
      hurt: ['Oh. Das hat seit Jahrhunderten keiner gewagt.', 'Köstlich. Mach das noch einmal.'],
      nervous: ['Das Feuer … gehorcht DIR?!', 'Unmöglich. Ich habe die Regeln geschrieben!'],
      gloat: ['Deine Seele, bitte. Ich gebe auch eine Quittung.', 'Hier unten gewinnt immer nur einer.'],
      win: ['Auf ewig mein Gast.'],
      lose: ['… Das Inferno gehört dir. Pass auf, dass es dich nicht behält.']
    }
  });

  /* --- Rote Laterne: ein Nachtclub, in dem jeder weiß, was gemeint ist, und keiner es ausspricht --- */
  enemy('hostess', {
    name: 'Gigi', role: 'Animierdame', kind: 'battle', casino: 'laterne', ai: 'greedy', pool: ['stillstand', 'addieren', 'schutzgeld'], bg: '#4a1430',
    passive: 'list', passiveText: 'Schampus aufs Haus: Du beginnst mit einer Karte mehr.',
    say: {
      start: ['Setz dich, Schatz. Die erste Flasche geht auf dich.', 'Du siehst aus, als hättest du Durst. Und Geld.'],
      attack: ['Noch ein Gläschen?', 'Das steht alles auf deinem Deckel~'],
      hurt: ['Na hör mal! So spricht man nicht mit einer Dame.', 'Uff. Der hat ja gar nichts getrunken.'],
      nervous: ['Eddie schaut schon her …', 'Bestell was, schnell, sonst krieg ich Ärger!'],
      gloat: ['Die Rechnung kommt gleich, Schatz.', 'Zahlen und lächeln. So läuft das hier.'],
      win: ['War nett mit dir. Teuer, aber nett.'],
      lose: ['… Du bist der Erste, der nüchtern hier rausgeht.']
    }
  });
  enemy('doorwoman', {
    name: 'Olga', role: 'Türsteherin', kind: 'elite', casino: 'laterne', ai: 'greedy', pool: COMMON.concat(['fluch', 'nebelkerze']), bg: '#2a2228',
    passive: 'thick-skin', passiveText: 'Eiserne Olga: ignoriert dein erstes Aussetzen.',
    say: {
      start: ['Hände auf den Tisch. Beide.', 'Hier fasst keiner was an, was er nicht bezahlt hat. Auch keine Karten.'],
      attack: ['Raus.', 'Benimm dich.'],
      hurt: ['Mutig.', 'Das merk ich mir. Mit Gesicht.'],
      nervous: ['Chef? Der hier macht Probleme.', '… Der ist ja wirklich gut.'],
      gloat: ['Ich bring dich gleich zur Tür. Durch die Tür.', 'Letzte Warnung war vorhin.'],
      win: ['Hausverbot.'],
      lose: ['… Du darfst bleiben. Sag es keinem.']
    }
  });
  enemy('boss-eddie', {
    name: 'Samt-Eddie', role: 'Boss der Roten Laterne', kind: 'boss', casino: 'laterne', ai: 'house', pool: COMMON.concat(['schutzgeld', 'tausch', 'nebelkerze', 'zocken']), bg: '#3a1040',
    passive: 'house-cut', passiveText: 'Hausanteil: Er behält die Hälfte deiner Bank und beginnt mit 2 Karten weniger.',
    say: {
      start: ['Alles, was in meinem Haus verdient wird, geht zur Hälfte an mich. Auch dein Glück, Freundchen.', 'Samt außen, Stahl innen. Merk dir das.'],
      attack: ['Mit schönen Grüßen vom Haus.', 'Das ist mein Anteil.'],
      hurt: ['Vorsicht mit dem Anzug!', 'Das wird teuer. Für dich.'],
      nervous: ['Olga! OLGA!', 'Wir können doch über Prozente reden …'],
      gloat: ['Du arbeitest gleich für mich. Als Garderobe.', 'Zahltag, Freundchen.'],
      win: ['Das Haus kassiert. Immer.'],
      lose: ['… Fünfzig Prozent vom Laden? Sechzig? Sag eine Zahl!']
    }
  });

  /* --- Block 9: Hinterhof, Shisha-Lounge und Studio einer Rap-Crew --- */
  enemy('rapper', {
    name: 'Lil Zünd', role: 'Battle-Rapper', kind: 'battle', casino: 'block9', ai: 'gamble', pool: ['nachschlag', 'addieren', 'zocken'], bg: '#1c1a3a',
    passive: 'encore', passiveText: 'Doubletime: Seine erste Spezialkarte beendet seinen Zug nicht.',
    say: {
      start: ['Yo, Mikrocheck. Du bist schon out, bevor der Beat droppt.', 'Block 9, Digga. Hier wird nicht gespielt, hier wird gebattlet.'],
      attack: ['Punchline!', 'Das war nur das Intro.'],
      hurt: ['Ey, das war ein Freestyle, das zählt nicht!', 'Okay, okay … der Part saß.'],
      nervous: ['Bro, mach mal den Beat aus …', 'Milan! Sag was!'],
      gloat: ['Gleich ist dein Feature vorbei.', 'Ich mach dich zur Hook.'],
      win: ['Mic drop.'],
      lose: ['… Respekt, Alter. Feature?']
    }
  });
  enemy('producer', {
    name: 'Milan', role: 'Produzent', kind: 'elite', casino: 'block9', ai: 'counter', handBonus: 1, pool: COMMON.concat(['mischmasch', 'zocken', 'spion']), bg: '#221c3c', chain: 2,
    passive: 'chains', passiveText: 'Sample-Schleife: legt Paare mit gleichem Wert.',
    say: {
      start: ['Ich hör schon, wie du verlierst. Vier Takte, dann ist Schluss.', 'Setz dich. Aber fass nichts an.'],
      attack: ['Loop.', 'Und nochmal von vorn.'],
      hurt: ['Der Übergang war unsauber.', 'Hm. Den Sound kenn ich nicht.'],
      nervous: ['Die Spur … die Spur ist weg!', 'Wer hat an meinem Regler gedreht?!'],
      gloat: ['Ich misch dich gerade leiser.', 'Fade-out in drei, zwei …'],
      win: ['Sauber gemastert.'],
      lose: ['… Schick mir die Spur. Die will ich samplen.']
    }
  });
  enemy('boss-label', {
    name: 'Papa Platin', role: 'Boss von Block 9', kind: 'boss', casino: 'block9', ai: 'house', pool: CURSE.concat(['brandsatz', 'tausch', 'ausgleich', 'zocken']), bg: '#14183c',
    passive: 'entourage', passiveText: 'Entourage: Er hält zu Beginn 3 Joker, du beginnst mit einer Karte mehr.',
    say: {
      start: ['Jeder hier im Block hat bei mir unterschrieben. Du kriegst auch einen Vertrag. Einen schlechten.', 'Platin hängt bei mir an der Wand und um den Hals. Was hast du?'],
      attack: ['Das ist Business.', 'Meine Jungs regeln das.'],
      hurt: ['Wer hat den reingelassen?!', 'Das zieh ich dir vom Vorschuss ab.'],
      nervous: ['Die Zahlen … die Streams brechen ein!', 'Ruft den Anwalt. Den guten!'],
      gloat: ['Du gehst gleich Platin. Im Verlieren.', 'Unterschreib hier. Mit deinem Blut oder so.'],
      win: ['Nächstes Signing.'],
      lose: ['… Der Block gehört dir. Die GEMA auch.']
    }
  });

  /* --- Gäste, die in jedem Haus sitzen können: Leute mit Geld, Amt oder Ruf --- */
  enemy('politician', {
    name: 'Stadtrat Kröger', role: 'Stadtrat', kind: 'battle', ai: 'greedy', pool: ['schutzgeld', 'stillstand', 'hodl'], bg: '#2c3440',
    passive: 'odds', passiveText: 'Spesenkonto: Schlägst du ihn, zahlt er 30 % mehr Prämie.',
    say: {
      start: ['Ich bin dienstlich hier. Rein dienstlich!', 'Das bleibt unter uns, ja? Wählerauftrag.'],
      attack: ['Im Namen der Bürger!', 'Das habe ich so nie gesagt.'],
      hurt: ['Das wird ein Nachspiel im Ausschuss haben!', 'Ich berufe mich auf meine Immunität!'],
      nervous: ['Ist das da hinten die Presse?!', 'Ich … ich war nie hier.'],
      gloat: ['Die Mehrheit steht. Gegen Sie.', 'Abstimmung! Wer ist für mich? Ich.'],
      win: ['Einstimmig angenommen.'],
      lose: ['… Ich trete nicht zurück. Ich trete nur kurz raus.']
    }
  });
  enemy('influencer', {
    name: 'Lucky Luis', role: 'Zocker-Streamer', kind: 'battle', ai: 'gamble', pool: ['zocken', 'addieren', 'nachschlag'], bg: '#3a1c4a',
    passive: 'light', passiveText: 'Clickbait: Er beginnt mit einer 7 auf der Hand.',
    say: {
      start: ['Was geht ab, Leute! Heute zerlegen wir live einen Random!', 'Daumen hoch, Glocke an, Gegner weg!'],
      attack: ['CLIP DAS!', 'Chat, habt ihr das gesehen?!'],
      hurt: ['Äh … das schneiden wir raus.', 'Lag! Das war Lag!'],
      nervous: ['Leute, kurz Werbung …', 'Chat, was mach ich jetzt?! CHAT?!'],
      gloat: ['Gleich gibt es den Siegestanz, bleibt dran!', 'Das wird das Thumbnail.'],
      win: ['GG EZ! Abo nicht vergessen!'],
      lose: ['… Stream offline. Technische Probleme.']
    }
  });
  enemy('undersecretary', {
    name: 'Dr. Amsel', role: 'Staatssekretärin', kind: 'elite', ai: 'counter', pool: COMMON.concat(['stillstand', 'nebelkerze', 'ausgleich']), bg: '#343840',
    passive: 'upbeat', passiveText: 'Dienstweg: Du setzt zu Beginn einmal aus.',
    say: {
      start: ['Ihr Antrag auf einen Sieg liegt vor. Er wird abgelehnt.', 'Bitte ziehen Sie eine Nummer.'],
      attack: ['Zuständigkeitshalber.', 'Dafür gibt es ein Formular.'],
      hurt: ['Das ist so nicht vorgesehen.', 'Ich vermerke das in Ihrer Akte.'],
      nervous: ['Wer hat das genehmigt?!', 'Das muss durch drei Referate!'],
      gloat: ['Ihr Vorgang wird gleich geschlossen.', 'Bearbeitungszeit: noch zwei Züge.'],
      win: ['Abgelehnt. Mit freundlichen Grüßen.'],
      lose: ['… Genehmigt. Aber ich habe es nicht unterschrieben.']
    }
  });
  enemy('poker-pro', {
    name: 'Kessler', role: 'Pokerprofi „Kalte Hand“', kind: 'elite', ai: 'counter', handBonus: 1, pool: COMMON.concat(['spion', 'tausch', 'zocken']), bg: '#1c2026',
    passive: 'sees-hand', passiveText: 'Liest dich: Kennt deine Hand und spielt gezielt dagegen.',
    say: {
      start: ['…', 'Deine linke Augenbraue. Zuckt.'],
      attack: ['Call.', 'Wusste ich.'],
      hurt: ['…', 'Interessant.'],
      nervous: ['… Du hast keinen Tell.', 'Brille ab. Ich muss dich sehen.'],
      gloat: ['All in.', 'Du bluffst. Schlecht.'],
      win: ['Gutes Spiel. Für mich.'],
      lose: ['… Zum ersten Mal seit Jahren. Danke.']
    }
  });
  enemy('bluffer', {
    name: 'Texas-Theo', role: 'Bluff-Legende', kind: 'battle', ai: 'gamble', pool: ['tausch', 'zocken', 'stillstand'], bg: '#4a3418',
    passive: 'sleeve', passiveText: 'Alter Trick: Seine Asse passen auf jede Karte.',
    say: {
      start: ['Junge, ich hab schon geblufft, da gab es dich noch gar nicht.', 'Setz dich. Ich erzähl dir, wie du verlierst.'],
      attack: ['Hast du nicht kommen sehen, was?', 'Achtundsechzig in Reno, genau so.'],
      hurt: ['Hoppla. Der Junge kann ja was.', 'Das war früher verboten!'],
      nervous: ['Moment, wo ist mein Zahnstocher?', 'Das … hab ich so noch nie erlebt.'],
      gloat: ['Jetzt kommt mein Lieblingsteil.', 'Ich hab nichts auf der Hand. Oder doch?'],
      win: ['Und so, Junge, macht man das.'],
      lose: ['… Den Hut hast du dir verdient. Den alten.']
    }
  });

  ZU.ENEMIES = enemies;
  // Die allgemeinen Töpfe enthalten nur Figuren, die in jedem Haus sitzen können.
  ZU.BATTLE_POOL = Object.keys(enemies).filter(function (id) { return enemies[id].kind === 'battle' && !enemies[id].casino; });
  ZU.ELITE_POOL = Object.keys(enemies).filter(function (id) { return enemies[id].kind === 'elite' && !enemies[id].casino; });
  /* Eigene Figuren je Casino: { battle, elite, boss } – oder nichts im ersten Haus. */
  ZU.CASINOS.forEach(function (casino) {
    var own = Object.keys(enemies).filter(function (id) { return enemies[id].casino === casino.id; });
    if (!own.length) return;
    casino.foes = {};
    own.forEach(function (id) { casino.foes[enemies[id].kind] = id; });
  });
  ZU.BOSS_ACTS = [['boss-shark', 'boss-dolores'], ['boss-smoke', 'boss-consigliere'], ['boss-house', 'boss-donna']];
  ZU.KIND_LABEL = { battle: 'Tisch', elite: 'Elite', boss: 'Boss' };
  ZU.ACT_NAMES = ['Hinterzimmer', 'Rauchsalon', 'Das Haus'];
  ZU.SPECIAL_SLOTS = 3; // so viele Spezialkarten fasst ein Deck; Upgrades und Trinkets erweitern das

  /* ---------- Stimmen ----------
     Kurze, gespielte Laute der Figuren (assets/voices/voices.mp3, ein Stück mit allen Aufnahmen): Lachen, Stöhnen,
     „Hey", „Hm?", Keuchen … aus dem „Super Dialogue Audio Pack v1" von Dillon Becker (CC BY 4.0), zugeschnitten und
     gepegelt von tools/make_voices.py. VOICE_CLIPS: Sprecher -> Stimmung -> [Beginn, Dauer] in Sekunden.
     Sprecher: a, b, c = Männer, f, g = Frauen. Stimmungen: greet, smug, gloat, angry, nervous, shocked, win, lose.
     VOICES: Figur -> [Sprecher, Tempo/Tonhöhe]; wer fehlt, spricht mit 'a' und 1. */
  ZU.VOICE_CREDIT = 'Stimmen: „Super Dialogue Audio Pack“ von Dillon Becker (dillonbecker.com), CC BY 4.0, zugeschnitten und verzerrt.';
  ZU.VOICE_CLIPS = {"a":{"greet":[[0.1,0.713],[0.963,0.316],[1.429,0.409],[1.988,0.357],[2.495,0.879]],"smug":[[3.524,1.7],[5.374,0.569],[6.093,0.625],[6.868,0.547],[7.565,0.418]],"gloat":[[8.133,1.7],[9.983,1.039],[11.172,0.552],[11.874,0.31]],"angry":[[12.334,0.33],[12.814,0.244],[13.208,0.664],[14.022,0.575],[14.747,0.37],[15.267,0.87],[16.287,0.423],[16.86,0.696],[17.706,1.056]],"nervous":[[18.912,0.373],[19.435,0.348],[19.933,0.609],[20.692,1.039],[21.881,0.738]],"shocked":[[22.769,0.348],[23.267,0.791],[24.208,1.48],[25.838,0.403],[26.391,0.252]],"win":[[26.793,1.7],[28.643,0.569],[29.362,0.625],[30.137,0.998]],"lose":[[31.285,1.7],[33.135,0.555],[33.84,0.741],[34.731,0.609],[35.49,1.7],[37.34,0.423]]},"b":{"greet":[[37.913,0.438],[38.501,0.289],[38.94,0.416],[39.506,0.385],[40.041,1.243]],"smug":[[41.434,1.667],[43.251,0.433],[43.834,0.425],[44.409,0.794],[45.353,1.021]],"gloat":[[46.524,1.667],[48.341,0.731],[49.222,0.621],[49.993,0.574]],"angry":[[50.717,0.516],[51.383,0.419],[51.952,0.528],[52.63,0.43],[53.21,0.623],[53.983,1.484],[55.617,0.354],[56.121,0.534],[56.805,1.28]],"nervous":[[58.235,0.448],[58.833,0.514],[59.497,1.275],[60.922,0.731],[61.803,0.308]],"shocked":[[62.261,0.514],[62.925,0.621],[63.696,0.942],[64.788,1.326],[66.264,0.809]],"win":[[67.223,1.667],[69.04,0.433],[69.623,0.425],[70.198,1.7]],"lose":[[72.048,1.7],[73.898,1.7],[75.748,1.7],[77.598,1.275],[79.023,1.7],[80.873,0.354]]},"c":{"greet":[[81.377,0.428],[81.955,0.2],[82.305,0.522],[82.977,0.336],[83.463,0.594]],"smug":[[84.207,1.7],[86.057,0.762],[86.969,0.389],[87.508,0.418],[88.076,0.332]],"gloat":[[88.558,1.7],[90.408,1.7],[92.258,0.696],[93.104,0.268]],"angry":[[93.522,0.418],[94.09,0.425],[94.665,0.458],[95.273,0.672],[96.095,0.917],[97.162,0.517],[97.829,0.401],[98.38,0.576],[99.106,0.815]],"nervous":[[100.071,0.239],[100.46,0.586],[101.196,1.657],[103.003,1.7],[104.853,0.943]],"shocked":[[105.946,0.586],[106.682,0.9],[107.732,0.564],[108.446,1.152],[109.748,0.378]],"win":[[110.276,1.7],[112.126,0.762],[113.038,0.389],[113.577,1.168]],"lose":[[114.895,1.601],[116.646,1.7],[118.496,1.7],[120.346,1.657],[122.153,1.7],[124.003,0.401]]},"f":{"greet":[[124.554,0.35],[125.054,0.552],[125.756,0.582],[126.488,0.35],[126.988,0.518]],"smug":[[127.656,1.7],[129.506,0.561],[130.217,0.422],[130.789,0.305],[131.244,1.029]],"gloat":[[132.423,1.7],[134.273,0.636],[135.059,0.486],[135.695,0.375]],"angry":[[136.22,0.254],[136.624,0.43],[137.204,0.229],[137.583,0.396],[138.129,0.41],[138.689,0.273],[139.112,0.456],[139.718,0.812],[140.68,1.087]],"nervous":[[141.917,0.38],[142.447,0.385],[142.982,0.774],[143.906,0.636],[144.692,0.521]],"shocked":[[145.363,0.385],[145.898,0.608],[146.656,1.144],[147.95,1.7],[149.8,0.258]],"win":[[150.208,1.7],[152.058,0.561],[152.769,0.422],[153.341,0.915]],"lose":[[154.406,1.7],[156.256,1.7],[158.106,1.7],[159.956,0.774],[160.88,1.597],[162.627,0.456]]},"g":{"greet":[[163.233,0.474],[163.857,0.238],[164.245,0.39],[164.785,0.551],[165.486,0.789]],"smug":[[166.425,0.848],[167.423,0.354],[167.927,0.584],[168.661,0.283],[169.094,0.533]],"gloat":[[169.777,0.848],[170.775,1.034],[171.959,0.669],[172.778,0.304]],"angry":[[173.232,0.416],[173.798,0.401],[174.349,0.608],[175.107,0.301],[175.558,0.665],[176.373,0.98],[177.503,0.488],[178.141,0.653],[178.944,0.603]],"nervous":[[179.697,0.224],[180.071,0.27],[180.491,0.684],[181.325,1.034],[182.509,0.404]],"shocked":[[183.063,0.27],[183.483,0.785],[184.418,0.898],[185.466,1.258],[186.874,0.438]],"win":[[187.462,0.848],[188.46,0.354],[188.964,0.584],[189.698,1.609]],"lose":[[191.457,0.927],[192.534,0.661],[193.345,0.791],[194.286,0.684],[195.12,1.7],[196.97,0.488]]}};
  ZU.VOICES = {
    'ember-croupier': ['a', 1.0], 'curse-dealer': ['c', 0.84], cheater: ['b', 1.1], 'cigarette-girl': ['g', 1.06], barkeeper: ['c', 0.9],
    showgirl: ['g', 0.98], bruiser: ['a', 0.8], pianist: ['b', 1.16], bookie: ['a', 0.92], 'card-counter': ['b', 1.04],
    'double-igniter': ['b', 1.22], 'black-widow': ['f', 0.92], pickpocket: ['g', 1.1], bouncer: ['c', 0.78], 'boss-shark': ['a', 0.86],
    'boss-dolores': ['f', 1.0], 'boss-smoke': ['f', 0.88], 'boss-consigliere': ['c', 0.82], 'boss-house': ['a', 0.78], 'boss-donna': ['f', 0.94],
    'taxi-dancer': ['g', 1.12], bandleader: ['b', 1.08], 'boss-impresario': ['b', 0.9], sailor: ['c', 0.96], purser: ['b', 1.14],
    'boss-captain': ['g', 0.9], bellboy: ['b', 1.26], concierge: ['a', 1.06], 'boss-baroness': ['f', 0.86], croupier: ['g', 1.0],
    'vault-guard': ['c', 0.76], 'boss-director': ['a', 0.82], stoker: ['c', 0.86], siren: ['g', 1.04], 'boss-prince': ['c', 0.74],
    hostess: ['g', 1.08], doorwoman: ['f', 0.9], 'boss-eddie': ['a', 0.9], rapper: ['b', 1.12], producer: ['a', 0.96],
    'boss-label': ['c', 0.88], politician: ['a', 0.94], influencer: ['b', 1.2], undersecretary: ['f', 1.04], 'poker-pro': ['a', 0.88], bluffer: ['c', 1.0]
  };

  /* ---------- Startschachteln ---------- */
  ZU.STARTERS = [
    { id: 'classic', name: 'Klassisch', money: 10, text: '16 zufällige Karten, eine zufällige Spezialkarte und das meiste Startgeld. Solide.', cards: [], special: true, trinkets: [], color: '#2f7d5b' },
    { id: 'igniter', name: 'Zündler', money: 5, text: '16 Karten, darunter vier 7en, und eine zufällige Spezialkarte. Dazu der Kniff Siebenerpasch: Mehrere 7en gehen zusammen raus.', cards: ['hearts-7', 'spades-7', 'diamonds-7', 'clubs-7'], kniffe: [{ id: 'pasch-7', level: 2 }], special: true, trinkets: [], color: '#f08a24' },
    { id: 'cheater', name: 'Falschspieler', money: 5, text: '16 Karten plus Tausch und Zocken, beide an ein Symbol gebunden.', cards: ['tausch', 'zocken'], trinkets: [], color: '#a3271f' },
    { id: 'alchemist', name: 'Alchemist', money: 4, text: '16 Karten plus Zytokinese und HODL, beide an ein Symbol gebunden.', cards: ['zytokinese', 'hodl'], trinkets: [], color: '#2a8c8c' }
  ];

  ZU.roman = function (n) {
    var out = '', map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    map.forEach(function (m) { while (n >= m[0]) { out += m[1]; n -= m[0]; } });
    return out;
  };
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
