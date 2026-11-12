/* Zündung – Inhalte: Karten, Trinkets, Gegner, Startschachteln. Reine Daten, keine Logik. */
(function (ZU) {
  'use strict';

  ZU.VERSION = '1.5.0'; // im Hauptmenü unten rechts angezeigt
  /* Build-Kennung: wird an alle Asset-Adressen gehängt, damit Browser und CDN nach einem Update frische
     Dateien holen. Nicht von Hand ändern: web/tools/stamp_version.py setzt den Wert. */
  ZU.BUILD = 'f49ac99b95';
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
    cover: { name: 'Gedeck', text: 'Jede Tischprämie fällt 2 Mark niedriger aus.' },
    'sharp-sevens': { name: 'Scharfe Siebenen', text: 'Jede 7 lässt 2 Karten ziehen statt 1 – auf beiden Seiten.' },
    'house-edge': { name: 'Hausvorteil', text: 'Gegner beginnen mit einer Karte weniger.' },
    'no-credit': { name: 'Kein Kredit', text: 'Es gibt keine Zinsen.' },
    marked: { name: 'Böses Omen', text: 'Du beginnst jedes Duell verflucht (×1).' },
    'wide-awake': { name: 'Hellwach', text: 'Gegner verschenken keinen Zug mehr.' },
    damp: { name: 'Feuchte Luft', text: 'Deine Kette steigt nie über ×8.' }
  };
  ZU.RULE_CHANCE = { 'one-pass': [0.1, 0.3, 0.5, 0.7] };

  /* ---------- Casinos ----------
     Sechs Häuser, die der Reihe nach freigeschaltet werden: Ein Sieg im bisher schwersten öffnet das nächste.
     Jedes hat seine Zahl an Akten, eigene Räume, feste Hausregeln für alle Tische, einen Asche-Faktor
     und eine eigene Farbwelt für den Rauch im Hintergrund (tint: dunkel, mittel, Glanzlicht). */
  ZU.CASINOS = [
    { id: 'hahn', tint: { a: [0.09, 0.06, 0.03], b: [0.31, 0.18, 0.07], c: [0.94, 0.68, 0.24] }, name: 'Zum Goldenen Hahn', sub: 'Eckkneipe mit Hinterzimmer', acts: 3, ash: 1,
      rooms: ['Hinterzimmer', 'Rauchsalon', 'Das Haus'], rules: [] },
    { id: 'rialto', tint: { a: [0.13, 0.03, 0.06], b: [0.46, 0.09, 0.15], c: [1.0, 0.66, 0.34] }, name: 'Tanzpalast Rialto', sub: 'Wo die halbe Stadt ihr Geld vertanzt', acts: 4, ash: 1.5,
      rooms: ['Garderobe', 'Parkett', 'Separee', 'Direktion'], rules: ['last-call', 'sober'] },
    { id: 'fortuna', tint: { a: [0.02, 0.09, 0.11], b: [0.05, 0.28, 0.31], c: [0.62, 0.88, 0.78] }, name: 'Dampfer Fortuna', sub: 'Schwimmt außerhalb jeder Zuständigkeit', acts: 4, ash: 2,
      rooms: ['Unterdeck', 'Salon', 'Kapitänstisch', 'Brücke'], rules: ['last-call', 'sober', 'markup', 'short-night'] },
    { id: 'imperial', tint: { a: [0.07, 0.04, 0.12], b: [0.25, 0.14, 0.36], c: [0.94, 0.84, 0.58] }, name: 'Grandhotel Imperial', sub: 'Gespielt wird nur mit Krawatte', acts: 5, ash: 2.75,
      rooms: ['Foyer', 'Hotelbar', 'Bel Etage', 'Fürstensuite', 'Penthouse'], rules: ['last-call', 'sober', 'markup', 'short-night', 'cover', 'sharp-sevens'] },
    { id: 'monopol', tint: { a: [0.04, 0.06, 0.10], b: [0.14, 0.21, 0.30], c: [0.72, 0.80, 0.90] }, name: 'Spielbank Monopol', sub: 'Die Bank gewinnt. Steht so im Namen', acts: 5, ash: 3.5,
      rooms: ['Automatensaal', 'Roulettesaal', 'Baccara-Zimmer', 'Tresorraum', 'Direktorium'], rules: ['last-call', 'sober', 'markup', 'short-night', 'cover', 'sharp-sevens', 'house-edge', 'no-credit'] },
    { id: 'inferno', tint: { a: [0.06, 0.01, 0.01], b: [0.27, 0.03, 0.02], c: [1.0, 0.34, 0.07] }, name: 'Das Inferno', sub: 'Hier hat noch keiner das Licht ausgemacht', acts: 6, ash: 5,
      rooms: ['Vorhof', 'Glutkammer', 'Aschegrube', 'Schwefelsaal', 'Thronsaal', 'Der Abgrund'], rules: ['last-call', 'wide-awake', 'markup', 'short-night', 'cover', 'sharp-sevens', 'house-edge', 'no-credit', 'marked', 'damp'] }
  ];

  ZU.CARDS = cards;
  ZU.STANDARD_IDS = Object.keys(cards).filter(function (id) { return !cards[id].special; });
  ZU.SPECIAL_IDS = Object.keys(cards).filter(function (id) { return cards[id].special; });

  /* ---------- Trinkets ---------- */
  /* Grundpreis je Seltenheit. Dazu kommt im Laden ein Aufschlag je bereits getragenem Trinket –
     das ersetzt die frühere feste Obergrenze. */
  ZU.TRINKET_PRICES = [15, 22, 32, 46];
  ZU.TRINKET_SURCHARGE = 3;
  var trinkets = {};
  function trinket(id, name, rarity, text) {
    trinkets[id] = { id: id, name: name, rarity: rarity, price: ZU.TRINKET_PRICES[rarity], text: text };
  }
  trinket('lucky-chip', 'Glückschip', 0, '+2 Mark nach jedem Sieg.');
  trinket('ashtray', 'Aschenbecher', 0, 'Zu Duellbeginn darfst du eine Handkarte gegen eine neue tauschen.');
  trinket('false-bottom', 'Doppelboden', 0, 'Der erste Kartenkauf in jedem Laden kostet 2 Mark weniger.');
  trinket('fuse', 'Zündschnur', 0, 'Deine Kette startet bei ×2 statt ×1.');
  trinket('ledger', 'Kassenbuch', 0, 'Zinsen bringen bis zu 6 statt 3 Mark.');
  trinket('brass-knuckles', 'Messingknöchel', 0, 'Dein erster Zieheffekt je Duell lässt den Gegner 1 Karte mehr ziehen.');
  trinket('pocket-watch', 'Taschenuhr', 1, 'Das erste Aussetzen gegen dich je Duell wird ignoriert.');
  trinket('loaded-die', 'Gezinkter Würfel', 1, 'Zocken deckt 5 statt 3 Karten auf.');
  trinket('velvet-glove', 'Samthandschuh', 1, 'Opfer bringt 3 Mark zusätzlich in die Bank.');
  trinket('heartblood', 'Herzblut', 0, 'Herz-Karten bringen doppelte Glut.');
  trinket('rollercoaster', 'Achterbahn', 1, 'Deine 8en lassen den Gegner aussetzen.');
  trinket('slow-burner', 'Dauerbrenner', 0, 'Beim Ziehen wird deine Kette halbiert statt zurückgesetzt.');
  trinket('black-book', 'Schwarzes Notizbuch', 2, 'Zu Duellbeginn siehst du die Gegnerhand für 3 Züge.');
  trinket('smoke-mirror', 'Rauchspiegel', 2, 'Der erste Zieh-, Aussetz- oder Fluch-Effekt gegen dich je Duell prallt zurück.');
  trinket('hot-wire', 'Heißer Draht', 1, 'Deine erste Spezialkarte je Duell beendet deinen Zug nicht.');
  trinket('ace-sleeve', 'Ass im Ärmel', 1, 'Deine Asse passen auf jede Karte.');
  trinket('golden-match', 'Goldenes Streichholz', 3, 'Verhindert einmal den Verlust deines letzten Streichholzes. Wird dabei verbraucht.');
  // --- Zieh-Druck: mehr Karten für den Gegner ---
  trinket('seven-sleeper', 'Siebenschläfer', 1, 'Deine 7en lassen den Gegner 2 Karten ziehen statt 1.');
  trinket('hex-board', 'Hexenbrett', 1, 'Der Gegner beginnt jedes Duell verflucht (×2).');
  trinket('voodoo', 'Voodoopuppe', 1, 'Flüche auf dem Gegner wirken doppelt: 2 Karten mehr statt 1.');
  trinket('gold-tooth', 'Goldzahn', 0, 'Restkarten des Gegners zahlen bis zu 10 statt 5 Mark.');
  // --- Aussetzen ---
  trinket('stopwatch', 'Stoppuhr', 1, 'Jedes Mal, wenn der Gegner aussetzt, wandert 1 Mark in die Bank.');
  // --- Kette und Glut ---
  trinket('card-shark', 'Kartenhai', 0, 'Passt die gezogene Karte, bleibt deine Kette erhalten.');
  trinket('afterburner', 'Nachbrenner', 2, 'Deine Kette steigt je Karte um 2 statt 1.');
  trinket('black-series', 'Schwarze Serie', 0, 'Pik- und Kreuz-Karten bringen 50 % mehr Glut.');
  trinket('furnace', 'Glutofen', 2, 'Der Glut-Bonus zahlt schon je 150 statt je 250 Glut – und bis zu 20 statt 8 Mark.');
  // --- Mehrfachwahl ---
  trinket('pair-king', 'Paschkönig', 2, 'Legst du 2 oder mehr Karten auf einmal, zieht der Gegner 1 Karte.');
  // --- Spezialkarten ---
  trinket('skeleton-key', 'Dietrich', 1, 'Deine symbolgebundenen Spezialkarten passen auf die ganze Farbe (Rot oder Schwarz).');
  trinket('master-key', 'Generalschlüssel', 3, 'Alle deine Spezialkarten passen auf jede Karte.');
  trinket('counterfeit', 'Falschgeld', 0, 'Spezialkarten kosten im Laden 3 Mark weniger.');
  // --- Kasse ---
  trinket('diamond-cut', 'Karoschliff', 1, 'Jede gespielte Karo-Karte bringt 1 Mark in die Bank (höchstens 5 je Duell).');
  trinket('compound', 'Zinseszins', 1, 'Zinsen gibt es schon je 4 statt je 5 Mark.');
  trinket('loyalty', 'Stempelkarte', 0, 'Trinkets kosten im Laden 4 Mark weniger.');
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
  trinket('police', 'Police', 1, 'Verlierst du ein Duell, zahlt die Versicherung 6 Mark.');
  trinket('phoenixfeder', 'Phönixfeder', 3, 'Die erste Niederlage in jedem Akt kostet kein Streichholz.');
  // --- Kasse ---
  trinket('sparschwein', 'Sparschwein', 0, 'Die Bank beginnt jedes Duell mit 2 Mark.');
  trinket('zylinder', 'Zylinder', 1, 'Erreichst du im Duell Kette ×8, gibt es beim Sieg 4 Mark extra.');
  trinket('sturmfeuerzeug', 'Sturmfeuerzeug', 1, 'Gewinnst du in höchstens 16 Zügen, gibt es 4 Mark extra.');
  trinket('kopfgeld', 'Kopfgeld', 1, 'Elite und Bosse zahlen 4 Mark mehr.');
  trinket('sammleralbum', 'Sammleralbum', 2, 'Nach jedem Sieg 1 Mark je 3 Trinkets, die du trägst.');
  trinket('mitgift', 'Mitgift', 2, 'Jeder Laden schenkt dir beim Betreten 3 Mark.');
  trinket('midas-hand', 'Midas-Hand', 3, 'Jede gespielte Karte bringt 1 Mark in die Bank (höchstens 10 je Duell).');
  trinket('urne', 'Urne', 1, 'Jeder besiegte Boss bringt 2 Asche zusätzlich.');
  // --- Laden ---
  trinket('pfandschein', 'Pfandschein', 0, 'Manfred kauft Trinkets zum vollen Preis zurück.');
  trinket('gratisfeuer', 'Gratisfeuer', 0, 'Das erste Verbrennen in jedem Laden ist gratis.');
  trinket('feuerversicherung', 'Feuerversicherung', 0, 'Streichhölzer kosten im Laden 3 Mark weniger.');
  trinket('kartenetui', 'Kartenetui', 1, 'Dein Deck fasst eine Spezialkarte mehr.');
  // --- Spezialkarten ---
  trinket('echo', 'Echo', 2, 'Deine erste Spezialkarte je Duell wirkt zweimal (außer Zytokinese und Reservefunke).');
  trinket('opernglas', 'Opernglas', 0, 'Spion wirkt 6 statt 3 Züge.');
  trinket('gezinktes-blatt', 'Gezinktes Blatt', 2, 'Deine Spezialkarten sind immer auf der Starthand.');
  // --- Tischlage ---
  trinket('schmale-hand', 'Schmale Hand', 2, 'Du beginnst jedes Duell mit 6 statt 7 Karten.');
  trinket('freibier', 'Freibier', 1, 'Gegner verschenken öfter einen Zug.');
  trinket('nachtlaterne', 'Nachtlaterne', 0, 'Die Sperrstunde kommt 10 Züge später.');
  trinket('teufelspakt', 'Teufelspakt', 3, 'Alle deine Karten bringen doppelte Glut. Du beginnst jedes Duell verflucht (×2).');
  ZU.TRINKETS = trinkets;
  ZU.TRINKET_IDS = Object.keys(trinkets);

  /* ---------- Privilegien ----------
     Gelten für den ganzen Run und belegen keinen Trinket-Platz. Manfred bietet je Akt genau eines an;
     die Neue Auslage ändert daran nichts. In Akt 1 ist es immer „Flinke Finger". */
  var perks = {};
  function perk(id, name, price, text) { perks[id] = { id: id, name: name, price: price, text: text }; }
  perk('nimble-fingers', 'Flinke Finger', 12, 'Mehrfachwahl: Lege mehrere Karten mit gleichem Wert in einem Zug.');
  perk('shelf', 'Großes Regal', 14, 'Das Spezialkarten-Regal hat 3 statt 2 Plätze.');
  perk('showcase', 'Vitrine', 14, 'Manfred zeigt 3 statt 2 Trinkets.');
  perk('regular', 'Stammplatz', 16, 'Jede Tischprämie fällt 2 Mark höher aus.');
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
    passive: 'odds', passiveText: 'Wettschein: Schlägst du ihn, zahlt er 3 Mark extra.',
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
    name: 'Mimi', role: 'Eintänzerin', kind: 'battle', casino: 1, ai: 'greedy', pool: ['stillstand', 'addieren', 'nachschlag'], bg: '#1f4a4a', chain: 2,
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
    name: 'Kapellmeister Bela', role: 'Kapellmeister', kind: 'elite', casino: 1, ai: 'counter', handBonus: 1, pool: COMMON.concat(['nebelkerze', 'zocken']), bg: '#3a2a44',
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
    name: 'Der Impresario', role: 'Boss im Rialto', kind: 'boss', casino: 1, ai: 'house', pool: COMMON.concat(['nebelkerze', 'tausch', 'zocken']), bg: '#4a1a26',
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
    name: 'Matrose Hein', role: 'Decksmann', kind: 'battle', casino: 2, ai: 'pressure', pool: ['addieren', 'fluch', 'stillstand'], bg: '#1c3246',
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
    name: 'Zahlmeister Pfennig', role: 'Zahlmeister', kind: 'elite', casino: 2, ai: 'counter', pool: COMMON.concat(['hodl', 'opfer', 'zocken']), bg: '#3a3a2a',
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
    name: 'Kapitänin Fortuna', role: 'Boss der Fortuna', kind: 'boss', casino: 2, ai: 'pressure', pool: CURSE.concat(['nebelkerze', 'brandsatz', 'zocken']), bg: '#16324a',
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
    name: 'Page Anton', role: 'Hotelpage', kind: 'battle', casino: 3, ai: 'gamble', pool: ['nachschlag', 'zocken', 'addieren'], bg: '#5a1c1c',
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
    name: 'Concierge Laurent', role: 'Concierge', kind: 'elite', casino: 3, ai: 'house', pool: COMMON.concat(['spion', 'tausch', 'nebelkerze']), bg: '#2a2a30',
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
    name: 'Baronin von Hohenstein', role: 'Boss im Imperial', kind: 'boss', casino: 3, ai: 'house', pool: CURSE.concat(['tausch', 'brandsatz', 'ausgleich']), bg: '#2a2430',
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
    name: 'Croupier Klara', role: 'Croupier', kind: 'battle', casino: 4, ai: 'counter', pool: ['stillstand', 'nebelkerze', 'spion'], bg: '#143a30',
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
    name: 'Tresorwächter Brock', role: 'Tresorwächter', kind: 'elite', casino: 4, ai: 'greedy', pool: COMMON.concat(['fluch', 'brandsatz']), bg: '#2c3038',
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
    name: 'Direktor Monopol', role: 'Boss der Spielbank', kind: 'boss', casino: 4, ai: 'counter', pool: COMMON.concat(['ausgleich', 'tausch', 'brandsatz', 'nebelkerze']), bg: '#1e1e24',
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
    name: 'Heizer Ruß', role: 'Heizer', kind: 'battle', casino: 5, ai: 'pressure', pool: ['addieren', 'brandsatz', 'fluch'], bg: '#3a1c10',
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
    name: 'Die Sirene', role: 'Sängerin', kind: 'elite', casino: 5, ai: 'gamble', handBonus: 1, pool: CURSE.concat(['tausch', 'nebelkerze', 'mischmasch']), bg: '#3d1420',
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
    name: 'Der Fürst', role: 'Boss im Inferno', kind: 'boss', casino: 5, ai: 'house', pool: CURSE.concat(['inferno', 'brandsatz', 'tausch', 'ausgleich', 'mischmasch']), bg: '#4a0e0e', chain: 2,
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

  ZU.ENEMIES = enemies;
  // Die allgemeinen Töpfe enthalten nur Figuren, die in jedem Haus sitzen können.
  ZU.BATTLE_POOL = Object.keys(enemies).filter(function (id) { return enemies[id].kind === 'battle' && !enemies[id].casino; });
  ZU.ELITE_POOL = Object.keys(enemies).filter(function (id) { return enemies[id].kind === 'elite' && !enemies[id].casino; });
  /* Eigene Figuren je Casino: { battle, elite, boss } – oder nichts im ersten Haus. */
  ZU.CASINOS.forEach(function (casino, index) {
    var own = Object.keys(enemies).filter(function (id) { return enemies[id].casino === index; });
    if (!own.length) return;
    casino.foes = {};
    own.forEach(function (id) { casino.foes[enemies[id].kind] = id; });
  });
  ZU.BOSS_ACTS = [['boss-shark', 'boss-dolores'], ['boss-smoke', 'boss-consigliere'], ['boss-house', 'boss-donna']];
  ZU.KIND_LABEL = { battle: 'Tisch', elite: 'Elite', boss: 'Boss' };
  ZU.ACT_NAMES = ['Hinterzimmer', 'Rauchsalon', 'Das Haus'];
  ZU.SPECIAL_SLOTS = 3; // so viele Spezialkarten fasst ein Deck; Upgrades und Trinkets erweitern das

  /* ---------- Startschachteln ---------- */
  ZU.STARTERS = [
    { id: 'classic', name: 'Klassisch', money: 10, text: '16 zufällige Karten, eine zufällige Spezialkarte und das meiste Startgeld. Solide.', cards: [], special: true, trinkets: [], color: '#2f7d5b' },
    { id: 'igniter', name: 'Zündler', money: 5, text: '16 Karten, darunter vier 7en, und eine zufällige Spezialkarte. Dazu das Privileg Flinke Finger: Gleiche Werte gehen zusammen raus.', cards: ['hearts-7', 'spades-7', 'diamonds-7', 'clubs-7'], special: true, trinkets: [], perks: ['nimble-fingers'], color: '#f08a24' },
    { id: 'cheater', name: 'Falschspieler', money: 5, text: '16 Karten plus Tausch und Zocken, beide an ein Symbol gebunden.', cards: ['tausch', 'zocken'], trinkets: [], color: '#a3271f' },
    { id: 'alchemist', name: 'Alchemist', money: 4, text: '16 Karten plus Zytokinese und HODL, beide an ein Symbol gebunden.', cards: ['zytokinese', 'hodl'], trinkets: [], color: '#2a8c8c' }
  ];

  ZU.roman = function (n) {
    var out = '', map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    map.forEach(function (m) { while (n >= m[0]) { out += m[1]; n -= m[0]; } });
    return out;
  };
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
