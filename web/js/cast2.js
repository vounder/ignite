/* Zündung – die zweite Besetzung (3.0): 46 weitere Figuren. Reine Daten.
   Sprüche und Akten stehen in js/cast2-text.js (ZU.SAY2, ZU.LORE).

   Anders als die erste Besetzung beschreiben diese Figuren ihre Eigenheit nicht über einen festen Namen, den die
   Engine kennt, sondern über "traits" – Bausteine, die sich kombinieren lassen (js/engine.js liest sie):
     wild: ['Q']            Karten dieser Werte passen auf jede Karte
     rankDraw: { '9': 1 }   seine Karten dieses Werts lassen dich so viele Karten ziehen (7: zusätzlich)
     rankSkip: ['8']        seine Karten dieses Werts lassen dich aussetzen
     rankCurse: { '7': 1 }  seine Karten dieses Werts verfluchen dich
     rankAgain: ['Q']       nach einer Karte dieses Werts ist er noch einmal dran
     startCurse/startDraw/startSkip   du beginnst verflucht (×n) / ziehst n Karten extra / setzt einmal aus
     fewer / more           er beginnt mit so vielen Karten weniger / mehr
     handSpecials           so viele Spezialkarten hält er zu Beginn
     limit                  Sperrstunde nach so vielen Zügen
     every: { n, do }       nach jedem n-ten seiner Züge: 'draw' (du ziehst 1), 'discard' (er wirft 1 ab), 'again' (er ist noch einmal dran)
     everyPlay: { n, draw } jede n-te Karte, die er spielt, lässt dich ziehen
     suitRun: { n, draw }   n Karten desselben Symbols in Folge: du ziehst
     firstDraw              dein erstes freiwilliges Ziehen bringt so viele Karten
     firstPlayDraw          seine erste Karte lässt dich so viele Karten ziehen
     onPlayerDraw           'discard': Ziehst du freiwillig, wirft er eine Karte ab
     onPlayerSpecial        deine Spezialkarten lassen dich so viele Karten ziehen
     onOppSpecial           seine Spezialkarten lassen dich so viele Karten ziehen
     ignoreDraws/ignoreSkips/ignoreCurses   so viele deiner Effekte prallen ab
     curseImmune            Flüche wirken bei ihm nicht
     umbrella               zwingst du ihn zu ziehen, zieht er 1 Karte weniger (mindestens 1)
     longSkip               sein erstes Aussetzen gegen dich dauert zwei Runden
     lastCard               hält er nur noch eine Karte, ziehst du (einmal) so viele
     seize                  zu Beginn zieht er deine beste Handkarte ein, du ziehst eine neue
     sees / seesTurns       kennt deine Hand (immer / in seinen ersten n Zügen)
     voidSpecial            deine erste Spezialkarte verpufft
     firstSpecialFree       seine erste Spezialkarte beendet seinen Zug nicht
     tieWin                 bei Sperrstunde und Kartenvergleich musst du so viele Karten weniger halten
     bankCut                Anteil deiner Bank, den er einbehält · bonus: Aufschlag auf die Prämie, wenn du ihn schlägst */
(function (ZU) {
  'use strict';

  var SAY = ZU.SAY2 || {};
  var BLANK = { start: ['…'], attack: ['…'], hurt: ['…'], nervous: ['…'], gloat: ['…'], win: ['…'], lose: ['…'] };
  function enemy(id, def) {
    def.id = id;
    def.chain = def.chain || 1;
    def.passive = def.passive || id; // Kennung für die Anzeige; die Wirkung steckt in traits
    def.traits = def.traits || {};
    def.say = SAY[id] || BLANK;
    ZU.ENEMIES[id] = def;
  }
  var COMMON = ['stillstand', 'addieren'];

  /* ---------- Lunapark ---------- */
  enemy('lottery-girl', { name: 'Hanni', role: 'Losverkäuferin', kind: 'battle', casino: 'lunapark', ai: 'gamble', pool: ['zocken', 'addieren', 'roulette'], bg: '#4a2a5a',
    passiveText: 'Nieten: Dein erstes freiwilliges Ziehen je Duell bringt 2 Karten statt 1.', traits: { firstDraw: 2 } });
  enemy('knife-thrower', { name: 'Messer-Marek', role: 'Messerwerfer', kind: 'elite', casino: 'lunapark', ai: 'pressure', pool: COMMON.concat(['fluch', 'nachschlag']), bg: '#1f3a3a',
    passiveText: 'Messerwurf: Seine 9en und 10en lassen dich 1 Karte ziehen.', traits: { rankDraw: { '9': 1, '10': 1 } } });
  enemy('boss-zampano', { name: 'Direktor Zampano', role: 'Boss des Lunaparks', kind: 'boss', casino: 'lunapark', ai: 'gamble', pool: COMMON.concat(['zocken', 'tausch', 'roulette', 'mischmasch']), bg: '#5a1a2a',
    passiveText: 'Hereinspaziert: Du ziehst zu Beginn 2 Karten extra. Seine erste Spezialkarte beendet seinen Zug nicht.', traits: { startDraw: 2, firstSpecialFree: true } });

  /* ---------- Rennbahn Silberhuf ---------- */
  enemy('jockey', { name: 'Flo Fliegengewicht', role: 'Jockey', kind: 'battle', casino: 'rennbahn', ai: 'greedy', pool: ['nachschlag', 'stillstand', 'addieren'], bg: '#1f4a2a',
    passiveText: 'Startbox: Du setzt zu Beginn einmal aus.', traits: { startSkip: 1 } });
  enemy('vet', { name: 'Dr. Spritze', role: 'Rennbahn-Tierärztin', kind: 'elite', casino: 'rennbahn', ai: 'counter', pool: COMMON.concat(['fluch', 'nebelkerze', 'opfer']), bg: '#2c4046',
    passiveText: 'Aufputschmittel: Nach jedem vierten ihrer Züge wirft sie eine Karte ab.', traits: { every: { n: 4, do: 'discard' } } });
  enemy('boss-toto', { name: 'Graf Toto', role: 'Boss der Rennbahn', kind: 'boss', casino: 'rennbahn', ai: 'house', pool: COMMON.concat(['zocken', 'ausgleich', 'nachschlag', 'roulette']), bg: '#3a4438',
    passiveText: 'Fotofinish: Er beginnt mit 1 Karte weniger. Bei Sperrstunde und Kartenvergleich gewinnt er, solange du nicht mindestens 2 Karten weniger hältst.', traits: { fewer: 1, tieWin: 2 } });

  /* ---------- Nachtexpress ---------- */
  enemy('conductor', { name: 'Schaffner Knips', role: 'Schaffner', kind: 'battle', casino: 'express', ai: 'greedy', pool: ['stillstand', 'stillstand', 'addieren'], bg: '#1c2a4a',
    passiveText: 'Fahrkartenkontrolle: Seine 8en lassen dich aussetzen.', traits: { rankSkip: ['8'] } });
  enemy('countess', { name: 'Komtess Coupé', role: 'Hochstaplerin', kind: 'elite', casino: 'express', ai: 'gamble', handBonus: 1, chain: 2, pool: ['tausch', 'zocken', 'spion', 'nachschlag'], bg: '#4a1f33',
    passiveText: 'Falscher Name: Ihre Buben passen auf jede Karte. Sie legt Paare mit gleichem Wert.', traits: { wild: ['J'] } });
  enemy('boss-else', { name: 'Eiserne Else', role: 'Boss des Nachtexpress', kind: 'boss', casino: 'express', ai: 'pressure', pool: COMMON.concat(['brandsatz', 'vollbremsung', 'nebelkerze', 'fluch']), bg: '#16223a',
    passiveText: 'Volldampf: Sie beginnt mit 2 Karten weniger. Die Sperrstunde kommt schon nach 30 Zügen.', traits: { fewer: 2, limit: 30 } });

  /* ---------- Ratskeller ---------- */
  enemy('usher', { name: 'Ratsdiener Paul', role: 'Amtsbote', kind: 'battle', casino: 'ratskeller', ai: 'greedy', pool: ['stillstand', 'addieren', 'spion'], bg: '#2f3a22',
    passiveText: 'Formblatt A38: Du ziehst zu Beginn 2 Karten extra.', traits: { startDraw: 2 } });
  enemy('police-chief', { name: 'Polizeipräsident von Knüppel', role: 'Polizeipräsident', kind: 'elite', casino: 'ratskeller', ai: 'counter', pool: COMMON.concat(['fluch', 'brandsatz', 'nebelkerze']), bg: '#1f2a44',
    passiveText: 'Beschlagnahmt: Zu Duellbeginn zieht er deine beste Handkarte ein, du ziehst eine neue. Er ignoriert dein erstes Aussetzen.', traits: { seize: true, ignoreSkips: 1 } });
  enemy('boss-mayor', { name: 'Oberbürgermeister Biedermann', role: 'Boss des Ratskellers', kind: 'boss', casino: 'ratskeller', ai: 'house', pool: COMMON.concat(['fluch', 'ausgleich', 'mischmasch', 'opfer']), bg: '#33401f',
    passiveText: 'Dauerrede: Jedes Mal, wenn du freiwillig ziehst, wirft er eine Karte ab. Du beginnst verflucht (×2).', traits: { onPlayerDraw: 'discard', startCurse: 2 } });

  /* ---------- Zweite Belegschaft der alten Häuser ---------- */
  enemy('coat-check', { name: 'Trude', role: 'Garderobiere', kind: 'battle', casino: 'rialto', ai: 'greedy', pool: ['stillstand', 'spion', 'addieren'], bg: '#4a2330',
    passiveText: 'Dame im Ärmel: Ihre Damen passen auf jede Karte.', traits: { wild: ['Q'] } });
  enemy('gigolo', { name: 'Schöner Egon', role: 'Eintänzer', kind: 'elite', casino: 'rialto', ai: 'gamble', chain: 2, pool: COMMON.concat(['tausch', 'nachschlag', 'zocken']), bg: '#3a1f2a',
    passiveText: 'Damenwahl: Nach jeder Dame ist er noch einmal dran. Er legt Paare mit gleichem Wert.', traits: { rankAgain: ['Q'] } });
  enemy('dancer', { name: 'Kitty Kirsch', role: 'Tänzerin', kind: 'battle', casino: 'laterne', ai: 'pressure', pool: ['stillstand', 'nebelkerze', 'addieren'], bg: '#5a1f3a',
    passiveText: 'Kusshand: Ihr erstes Aussetzen gegen dich dauert zwei Runden.', traits: { longSkip: true } });
  enemy('photographer', { name: 'Blitzlicht-Benno', role: 'Fotograf', kind: 'elite', casino: 'laterne', ai: 'counter', pool: COMMON.concat(['spion', 'fluch', 'nebelkerze']), bg: '#3a2a22',
    passiveText: 'Blitzlicht: Kennt in seinen ersten 3 Zügen deine Hand. Hält zu Beginn 3 Spezialkarten.', traits: { seesTurns: 3, handSpecials: 3 } });
  enemy('cook', { name: 'Kombüsen-Kuddel', role: 'Schiffskoch', kind: 'battle', casino: 'fortuna', ai: 'greedy', pool: ['addieren', 'nachschlag', 'stillstand'], bg: '#1f3f44',
    passiveText: 'Nachschlag: Jede dritte Karte, die er spielt, lässt dich 1 Karte ziehen.', traits: { everyPlay: { n: 3, draw: 1 } } });
  enemy('first-mate', { name: 'Erste Offizierin Sturm', role: 'Erste Offizierin', kind: 'elite', casino: 'fortuna', ai: 'counter', pool: COMMON.concat(['nebelkerze', 'ausgleich', 'spion']), bg: '#16323a',
    passiveText: 'Wache: Deine ersten 2 Zieheffekte prallen an ihr ab.', traits: { ignoreDraws: 2 } });
  enemy('sprayer', { name: 'Dose', role: 'Sprayerin', kind: 'battle', casino: 'block9', ai: 'gamble', chain: 2, pool: ['zocken', 'addieren', 'nachschlag'], bg: '#22305a',
    passiveText: 'Frisch gesprüht: Ihre 10en lassen dich 1 Karte ziehen. Sie legt Paare mit gleichem Wert.', traits: { rankDraw: { '10': 1 } } });
  enemy('dj', { name: 'DJane Nova', role: 'DJane', kind: 'elite', casino: 'block9', ai: 'pressure', pool: COMMON.concat(['nachschlag', 'mischmasch', 'brandsatz']), bg: '#1c2450',
    passiveText: 'Drop: Nach jedem vierten ihrer Züge ist sie sofort noch einmal dran.', traits: { every: { n: 4, do: 'again' } } });
  enemy('maid', { name: 'Zimmermädchen Fanny', role: 'Zimmermädchen', kind: 'battle', casino: 'imperial', ai: 'greedy', pool: ['stillstand', 'bannbrecher', 'addieren'], bg: '#3a2f4a',
    passiveText: 'Blitzblank: Den ersten Fluch und das erste Aussetzen gegen sie wischt sie weg.', traits: { ignoreSkips: 1, ignoreCurses: 1 } });
  enemy('detective', { name: 'Hoteldetektiv Argus', role: 'Hoteldetektiv', kind: 'elite', casino: 'imperial', ai: 'counter', pool: COMMON.concat(['spion', 'ausgleich', 'nebelkerze']), bg: '#3a3630',
    passiveText: 'Beschattung: Kennt deine Hand. Jede Spezialkarte, die du spielst, lässt dich 1 Karte ziehen.', traits: { sees: true, onPlayerSpecial: 1 } });
  enemy('slot-tech', { name: 'Groschen-Gerd', role: 'Automatenwart', kind: 'battle', casino: 'monopol', ai: 'greedy', pool: ['zocken', 'hodl', 'addieren'], bg: '#2a3340',
    passiveText: 'Jackpot: Spielt er drei Karten desselben Symbols in Folge, ziehst du 2 Karten.', traits: { suitRun: { n: 3, draw: 2 } } });
  enemy('pit-boss', { name: 'Madame Zéro', role: 'Saalchefin', kind: 'elite', casino: 'monopol', ai: 'house', pool: COMMON.concat(['ausgleich', 'tausch', 'stillstand']), bg: '#1f2a33',
    passiveText: 'Zéro: Sie beginnt mit 2 Karten weniger. Von deiner Bank behält sie die Hälfte ein.', traits: { fewer: 2, bankCut: 0.5 } });
  enemy('imp', { name: 'Schwefel-Fritz', role: 'Laufbursche des Inferno', kind: 'battle', casino: 'inferno', ai: 'pressure', pool: ['fluch', 'addieren', 'brandsatz'], bg: '#4a1a12',
    passiveText: 'Botengang: Du beginnst verflucht (×2). Seine 7en lassen dich 2 Karten ziehen statt 1.', traits: { startCurse: 2, rankDraw: { '7': 1 } } });
  enemy('notary', { name: 'Notarin Tinte', role: 'Notarin des Fürsten', kind: 'elite', casino: 'inferno', ai: 'counter', pool: COMMON.concat(['fluch', 'ausgleich', 'mischmasch']), bg: '#2a1418',
    passiveText: 'Klausel: Deine erste Spezialkarte je Duell verpufft. Sie kennt deine Hand.', traits: { voidSpecial: true, sees: true } });

  /* ---------- Gäste, die in jedem Haus sitzen können: Tische ---------- */
  enemy('dice-girl', { name: 'Würfel-Wanda', role: 'Würfelspielerin', kind: 'battle', ai: 'gamble', pool: ['zocken', 'roulette', 'tausch'], bg: '#4a3020',
    passiveText: 'Würfelglück: Sie hält zu Beginn 3 Spezialkarten.', traits: { handSpecials: 3 } });
  enemy('granny', { name: 'Oma Hedwig', role: 'Bingo-Königin', kind: 'battle', ai: 'greedy', pool: ['stillstand', 'addieren', 'bannbrecher'], bg: '#4a2a3a',
    passiveText: 'Bingo!: Hält sie nur noch eine Karte, ziehst du 2 Karten.', traits: { lastCard: 2 } });
  enemy('scrap-dealer', { name: 'Eisen-Ede', role: 'Schrotthändler', kind: 'battle', ai: 'greedy', pool: ['opfer', 'addieren', 'hodl'], bg: '#3a3028',
    passiveText: 'Sammelwut: Er beginnt mit 2 Karten mehr und hält 2 Spezialkarten.', traits: { more: 2, handSpecials: 2 } });
  enemy('tourist', { name: 'Herr Schmidt', role: 'Tourist', kind: 'battle', ai: 'gamble', pool: ['zocken', 'spion', 'stillstand'], bg: '#2a4a4a',
    passiveText: 'Anfängerglück: Seine erste Karte je Duell lässt dich 2 Karten ziehen.', traits: { firstPlayDraw: 2 } });
  enemy('newsboy', { name: 'Piet', role: 'Zeitungsjunge', kind: 'battle', ai: 'pressure', pool: ['spion', 'addieren', 'nachschlag'], bg: '#3a3a40',
    passiveText: 'Extrablatt: Nach jeder seiner 7en ist er noch einmal dran.', traits: { rankAgain: ['7'] } });
  enemy('chimney-sweep', { name: 'Felix Glück', role: 'Schornsteinfeger', kind: 'battle', ai: 'greedy', pool: ['stillstand', 'bannbrecher', 'zocken'], bg: '#26262c',
    passiveText: 'Glückspfennig: Flüche wirken bei ihm nicht.', traits: { curseImmune: true } });
  enemy('magician', { name: 'Der Große Bellini', role: 'Zauberkünstler', kind: 'battle', ai: 'gamble', pool: ['tausch', 'mischmasch', 'zocken'], bg: '#33203f',
    passiveText: 'Verschwindetrick: Nach jedem fünften seiner Züge lässt er eine Karte verschwinden.', traits: { every: { n: 5, do: 'discard' } } });
  enemy('crypto-bro', { name: 'Kai Krypto', role: 'Krypto-Bro', kind: 'battle', ai: 'gamble', pool: ['hodl', 'zocken', 'addieren'], bg: '#1f4046',
    passiveText: 'To the Moon: Jede seiner Spezialkarten lässt dich 1 Karte ziehen.', traits: { onOppSpecial: 1 } });
  enemy('nurse', { name: 'Nachtschwester Agnes', role: 'Krankenschwester', kind: 'battle', ai: 'greedy', pool: ['bannbrecher', 'stillstand', 'addieren'], bg: '#2a4040',
    passiveText: 'Verbandskasten: Zwingst du sie zum Ziehen, zieht sie 1 Karte weniger (mindestens 1).', traits: { umbrella: true } });
  enemy('taxi', { name: 'Droschken-Paule', role: 'Taxifahrer', kind: 'battle', ai: 'greedy', pool: ['stillstand', 'nachschlag', 'addieren'], bg: '#3a3220',
    passiveText: 'Taxameter: Nach jedem sechsten seiner Züge ziehst du 1 Karte.', traits: { every: { n: 6, do: 'draw' } } });

  /* ---------- Gäste: Elite ---------- */
  enemy('commissar', { name: 'Kommissar Falk', role: 'Kommissar', kind: 'elite', ai: 'pressure', pool: COMMON.concat(['spion', 'brandsatz', 'fluch']), bg: '#2a2e36',
    passiveText: 'Razzia: Nach jedem vierten seiner Züge ziehst du 1 Karte. Er hält zu Beginn 2 Spezialkarten.', traits: { every: { n: 4, do: 'draw' }, handSpecials: 2 } });
  enemy('twins', { name: 'Hinz & Kunz', role: 'Die Zwillinge', kind: 'elite', ai: 'gamble', chain: 3, pool: COMMON.concat(['tausch', 'mischmasch', 'zocken']), bg: '#1f4a44',
    passiveText: 'Zu zweit: Sie legen bis zu drei Karten mit gleichem Wert und beginnen mit 2 Karten mehr.', traits: { more: 2 } });
  enemy('hypnotist', { name: 'Morpheo', role: 'Hypnotiseur', kind: 'elite', ai: 'pressure', pool: ['stillstand', 'nebelkerze', 'vollbremsung', 'fluch', 'addieren'], bg: '#1a2a40',
    passiveText: 'Trance: Du setzt zu Beginn einmal aus. Sein erstes Aussetzen gegen dich dauert zwei Runden.', traits: { startSkip: 1, longSkip: true } });
  enemy('heiress', { name: 'Fräulein von Zaster', role: 'Erbin', kind: 'elite', ai: 'gamble', pool: COMMON.concat(['zocken', 'tausch', 'brandsatz', 'roulette']), bg: '#4a4030',
    passiveText: 'Taschengeld: Sie hält zu Beginn 4 Spezialkarten. Schlägst du sie, zahlt sie 30 % mehr Prämie.', traits: { handSpecials: 4, bonus: 0.3 } });
  enemy('chess-master', { name: 'Großmeister Rochus', role: 'Schachmeister', kind: 'elite', ai: 'counter', pool: COMMON.concat(['opfer', 'ausgleich', 'tausch']), bg: '#2f2a22',
    passiveText: 'Gambit: Er kennt deine Hand und beginnt mit 1 Karte weniger.', traits: { sees: true, fewer: 1 } });
  enemy('auctioneer', { name: 'Auktionator Hammer', role: 'Auktionator', kind: 'elite', ai: 'greedy', pool: COMMON.concat(['nachschlag', 'opfer', 'brandsatz']), bg: '#4a2a1c',
    passiveText: 'Zum Dritten!: Die Sperrstunde kommt schon nach 28 Zügen. Du ziehst zu Beginn 1 Karte extra.', traits: { limit: 28, startDraw: 1 } });

  /* ---------- Gäste: Bosse ---------- */
  enemy('boss-baron', { name: 'Der Lügenbaron', role: 'Hochstapler von Rang', kind: 'boss', ai: 'gamble', pool: COMMON.concat(['tausch', 'zocken', 'mischmasch']), bg: '#4a2a20',
    passiveText: 'Lügengeschichte: Seine Asse und Buben passen auf jede Karte. Er beginnt mit 1 Karte weniger.', traits: { wild: ['A', 'J'], fewer: 1 } });
  enemy('boss-abbess', { name: 'Mutter Immaculata', role: 'Oberin', kind: 'boss', ai: 'pressure', pool: ['fluch', 'fluch', 'addieren', 'stillstand', 'bannbrecher', 'opfer'], bg: '#22222a',
    passiveText: 'Buße: Du beginnst verflucht (×2). Jede ihrer 7en verflucht dich zusätzlich (×1).', traits: { startCurse: 2, rankCurse: { '7': 1 } } });
  enemy('boss-judge', { name: 'Richter Gnadenlos', role: 'Richter', kind: 'boss', ai: 'counter', pool: COMMON.concat(['fluch', 'ausgleich', 'nebelkerze']), bg: '#2a2026',
    passiveText: 'Urteil: Nach jedem dritten seiner Züge ziehst du 1 Karte. Er ignoriert dein erstes Aussetzen.', traits: { every: { n: 3, do: 'draw' }, ignoreSkips: 1 } });
  enemy('boss-publisher', { name: 'Der Verleger', role: 'Zeitungszar', kind: 'boss', ai: 'counter', pool: COMMON.concat(['spion', 'brandsatz', 'mischmasch', 'fluch']), bg: '#2c2c30',
    passiveText: 'Schlagzeile: Er kennt deine Hand. Jede seiner Spezialkarten lässt dich zusätzlich 1 Karte ziehen.', traits: { sees: true, onOppSpecial: 1 } });

  ZU.BOSS_ACTS[0].push('boss-baron');
  ZU.BOSS_ACTS[1].push('boss-abbess', 'boss-judge');
  ZU.BOSS_ACTS[2].push('boss-publisher');
  ZU.buildCast();

  /* Stimmen der neuen Figuren (siehe ZU.VOICES in js/data.js): [Sprecher, Tempo/Tonhöhe]. */
  var VOICES = {
    'lottery-girl': ['g', 1.14], 'knife-thrower': ['c', 0.84], 'boss-zampano': ['a', 0.94], jockey: ['b', 1.24], vet: ['f', 0.96], 'boss-toto': ['b', 0.86],
    conductor: ['a', 1.08], countess: ['f', 1.02], 'boss-else': ['f', 0.82], usher: ['a', 0.9], 'police-chief': ['c', 0.9], 'boss-mayor': ['a', 0.84],
    'coat-check': ['f', 0.9], gigolo: ['b', 0.96], dancer: ['g', 1.1], photographer: ['b', 1.12], cook: ['c', 0.88], 'first-mate': ['f', 0.94],
    sprayer: ['g', 0.96], dj: ['f', 1.06], maid: ['g', 1.16], detective: ['c', 0.92], 'slot-tech': ['a', 1.02], 'pit-boss': ['f', 0.84],
    imp: ['b', 1.3], notary: ['f', 0.9], 'dice-girl': ['g', 1.02], granny: ['f', 0.8], 'scrap-dealer': ['c', 0.82], tourist: ['a', 1.12],
    newsboy: ['b', 1.28], 'chimney-sweep': ['a', 1.04], magician: ['b', 0.92], 'crypto-bro': ['b', 1.18], nurse: ['g', 0.92], taxi: ['a', 0.96],
    commissar: ['c', 0.94], twins: ['b', 1.06], hypnotist: ['c', 0.8], heiress: ['g', 0.98], 'chess-master': ['c', 0.86], auctioneer: ['b', 1.22],
    'boss-baron': ['a', 0.9], 'boss-abbess': ['f', 0.8], 'boss-judge': ['c', 0.78], 'boss-publisher': ['a', 0.8]
  };
  Object.keys(VOICES).forEach(function (id) { ZU.VOICES[id] = VOICES[id]; });
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
