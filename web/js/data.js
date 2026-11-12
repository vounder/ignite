/* Zündung – Inhalte: Karten, Trinkets, Gegner, Startschachteln. Reine Daten, keine Logik. */
(function (ZU) {
  'use strict';

  ZU.VERSION = '1.0.0'; // im Hauptmenü unten rechts angezeigt
  /* Build-Kennung: wird an alle Asset-Adressen gehängt, damit Browser und CDN nach einem Update frische
     Dateien holen. Nicht von Hand ändern: web/tools/stamp_version.py setzt den Wert. */
  ZU.BUILD = '3e6179c227';
  ZU.asset = function (path) { return 'assets/' + path + '?v=' + ZU.BUILD; };

  ZU.HAND_SIZE = 7;
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
  special('zytokinese_2', 'Zytokinese II', 28, 3, '2 Specials', 'Erzeugt 2 zufällige Spezialkarten dauerhaft in deinem Deck. Wird dabei verbraucht.',
    [{ type: 'createSpecial', amount: 2 }]);

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
    }
  };
  ZU.RULE_CHANCE = { 'one-pass': [0.1, 0.3, 0.5, 0.7] };

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
  trinket('seven-sleeper', 'Siebenschläfer', 1, 'Deine 7en lassen den Gegner 3 statt 2 Karten ziehen.');
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
    passive: 'heavy-hand', passiveText: 'Schwere Hand: Seine 7en lassen dich 3 statt 2 Karten ziehen.',
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

  ZU.ENEMIES = enemies;
  ZU.BATTLE_POOL = Object.keys(enemies).filter(function (id) { return enemies[id].kind === 'battle'; });
  ZU.ELITE_POOL = Object.keys(enemies).filter(function (id) { return enemies[id].kind === 'elite'; });
  ZU.BOSS_ACTS = [['boss-shark', 'boss-dolores'], ['boss-smoke', 'boss-consigliere'], ['boss-house', 'boss-donna']];
  ZU.KIND_LABEL = { battle: 'Tisch', elite: 'Elite', boss: 'Boss' };
  ZU.ACT_NAMES = ['Hinterzimmer', 'Rauchsalon', 'Das Haus'];

  /* ---------- Startschachteln ---------- */
  ZU.STARTERS = [
    { id: 'classic', name: 'Klassisch', money: 10, text: '7 zufällige Karten und das meiste Startgeld. Solide.', cards: [], trinkets: [], color: '#2f7d5b' },
    { id: 'igniter', name: 'Zündler', money: 5, text: '7 Karten, darunter zwei 7en. Dazu das Privileg Flinke Finger: Gleiche Werte gehen zusammen raus.', cards: ['hearts-7', 'spades-7'], trinkets: [], perks: ['nimble-fingers'], color: '#f08a24' },
    { id: 'cheater', name: 'Falschspieler', money: 5, text: '6 Karten plus Tausch und Zocken, beide an ein Symbol gebunden.', cards: ['tausch', 'zocken'], trinkets: [], size: 8, color: '#a3271f' },
    { id: 'alchemist', name: 'Alchemist', money: 4, text: '6 Karten plus Zytokinese und HODL, beide an ein Symbol gebunden.', cards: ['zytokinese', 'hodl'], trinkets: [], size: 8, color: '#2a8c8c' }
  ];

  ZU.roman = function (n) {
    var out = '', map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    map.forEach(function (m) { while (n >= m[0]) { out += m[1]; n -= m[0]; } });
    return out;
  };
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
