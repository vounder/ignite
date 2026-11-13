/* Zündung – die eigene Figur: ein Brustbild aus übereinandergelegten Ebenen (assets/avatar/*.png, je 192×192).
   Reihenfolge: Körper (eingefärbt), Tattoos, Outfit, Gesicht (je Ausdruck), Bart und Haare (eingefärbt), Extras, Hut.
   Körper, Gesichtsschatten und Haare liegen in fünf Graustufen vor (16 Kontur, 96 tiefer Schatten, 152 Schatten,
   208 Grundton, 248 Glanzlicht); beim Zeichnen wird jede Stufe durch die Farbe einer Rampe ersetzt (ramp), damit
   Schatten wie bei den Gegnerporträts in den Farbton kippen statt nur dunkler zu werden.
   Teile werden nicht gekauft, sondern erspielt: req = [Zählwerk, Schwelle, Hinweis] wie im Hinterzimmer. */
(function (ZU) {
  'use strict';
  var h = ZU.h, SIZE = 192;

  var PARTS = {
    skin: [
      { id: 'porzellan', name: 'Porzellan', color: '#fcc8a4', ramp: ['#3a1410', '#d07a5a', '#eaa07c', '#fcc8a4', '#ffe8d0'] },
      { id: 'sand', name: 'Sand', color: '#fcb070', ramp: ['#38100c', '#d86a3c', '#ea8a50', '#fcb070', '#fdd8a4'] },
      { id: 'honig', name: 'Honig', color: '#fc9d52', ramp: ['#370c09', '#d75a2b', '#e47339', '#fc9d52', '#fdc88a'] },
      { id: 'bronze', name: 'Bronze', color: '#de7e3e', ramp: ['#300a08', '#a8401e', '#c45c2a', '#de7e3e', '#f4a868'] },
      { id: 'kastanie', name: 'Kastanie', color: '#b0562a', ramp: ['#260806', '#6e2814', '#8e3c1c', '#b0562a', '#d27e48'] },
      { id: 'ebenholz', name: 'Ebenholz', color: '#783620', ramp: ['#1a0606', '#3e160e', '#5a2414', '#783620', '#a05834'] }
    ],
    hair: [
      { id: 'hair-1', name: 'Seitenscheitel' },
      { id: 'hair-4', name: 'Stoppelschnitt', req: ['duels', 1, 'Gewinne ein Duell.'] },
      { id: 'hair-17', name: 'Wuschelkopf', req: ['played', 30, 'Spiele 30 Karten.'] },
      { id: 'hair-6', name: 'Bob mit Pony', req: ['duels', 2, 'Gewinne 2 Duelle.'] },
      { id: 'hair-26', name: 'Topfschnitt', req: ['losses', 2, 'Verliere 2 Duelle.'] },
      { id: 'none', name: 'Glatze', req: ['burned', 3, 'Verbrenne 3 Karten.'] },
      { id: 'hair-13', name: 'Gelfrisur', req: ['bought', 5, 'Kaufe 5-mal bei Manfred.'] },
      { id: 'hair-2', name: 'Lockenkopf', req: ['duels', 5, 'Gewinne 5 Duelle.'] },
      { id: 'hair-24', name: 'Pixie', req: ['duels', 7, 'Gewinne 7 Duelle.'] },
      { id: 'hair-20', name: 'Dutt', req: ['aces', 10, 'Spiele 10 Asse.'] },
      { id: 'hair-7', name: 'Pferdeschwanz', req: ['played', 150, 'Spiele 150 Karten.'] },
      { id: 'hair-22', name: 'Zwei Zöpfe', req: ['eights', 10, 'Spiele 10 Achten.'] },
      { id: 'hair-16', name: 'Zwei Dutts', req: ['pairs', 8, 'Lege 8-mal mehrere Karten auf einmal.'] },
      { id: 'hair-3', name: 'Lange Mähne', req: ['chain', 8, 'Erreiche eine Kette von ×8.'] },
      { id: 'hair-21', name: 'Vokuhila', req: ['foe:barkeeper', 2, 'Schlage Bruno zweimal.'] },
      { id: 'hair-5', name: 'Tolle', req: ['sevens', 25, 'Spiele 25 Siebenen.'] },
      { id: 'hair-19', name: 'Wasserwelle', req: ['foe:showgirl', 1, 'Schlage Roxy.'] },
      { id: 'hair-23', name: 'Flat Top', req: ['foe:bouncer', 1, 'Schlage Schrank.'] },
      { id: 'hair-8', name: 'Afro', req: ['duels', 15, 'Gewinne 15 Duelle.'] },
      { id: 'hair-14', name: 'Langer Mittelscheitel', req: ['played', 300, 'Spiele 300 Karten.'] },
      { id: 'hair-9', name: 'Flechtzöpfe mit Dutt', req: ['kniffe', 3, 'Lerne oder stufe 3 Kniffe.'] },
      { id: 'hair-10', name: 'Undercut mit Zopf', req: ['fast', 3, 'Gewinne 3 Duelle in höchstens 16 Zügen.'] },
      { id: 'hair-18', name: 'Sidecut', req: ['elites', 4, 'Schlage 4 Elite-Gegner.'] },
      { id: 'hair-11', name: 'Glamourwellen', req: ['casino', 1, 'Räume das erste Casino aus.'] },
      { id: 'hair-15', name: 'Dreadlocks', req: ['chain', 12, 'Erreiche eine Kette von ×12.'] },
      { id: 'hair-12', name: 'Irokese', req: ['burnt', 10, 'Fackle 10 Tische ab.'] },
      { id: 'hair-25', name: 'Haarkranz', req: ['duels', 50, 'Gewinne 50 Duelle.'] }
    ],
    hairColor: [
      { id: 'schwarz', name: 'Schwarz', color: '#40343a', ramp: ['#0c080c', '#181218', '#2a2028', '#40343a', '#74626a'] },
      { id: 'braun', name: 'Braun', color: '#8e5a28', ramp: ['#24100a', '#40200e', '#683a18', '#8e5a28', '#c08a48'] },
      { id: 'blond', name: 'Blond', color: '#f6b848', ramp: ['#3a1a08', '#a85a18', '#d88a28', '#f6b848', '#ffe08a'] },
      { id: 'rot', name: 'Rot', color: '#e44a22', ramp: ['#30060a', '#7a1010', '#b8241a', '#e44a22', '#ff8a40'], req: ['burnt', 3, 'Fackle 3 Tische ab.'] },
      { id: 'kupfer', name: 'Kupfer', color: '#c8662a', ramp: ['#2a0c06', '#5e2410', '#9a4218', '#c8662a', '#f0a05a'], req: ['eights', 8, 'Spiele 8 Achten.'] },
      { id: 'grau', name: 'Silbergrau', color: '#b8b6ba', ramp: ['#1c1a22', '#56545e', '#8a8892', '#b8b6ba', '#e8e6e4'], req: ['duels', 25, 'Gewinne 25 Duelle.'] },
      { id: 'weiss', name: 'Schlohweiß', color: '#f0ece8', ramp: ['#2a2630', '#9a94a2', '#cac6cc', '#f0ece8', '#ffffff'], req: ['casino', 2, 'Räume 2 Casinos aus.'] },
      { id: 'tuerkis', name: 'Türkis', color: '#3cc2a8', ramp: ['#081e1e', '#0e4a44', '#1a8274', '#3cc2a8', '#a0f4dc'], req: ['kniffe', 5, 'Lerne oder stufe 5 Kniffe.'] },
      { id: 'glut', name: 'Glutorange', color: '#ff8a1e', ramp: ['#300a04', '#a02808', '#e0500e', '#ff8a1e', '#ffd060'], req: ['overkill', 2, 'Übertriff ein Glutziel um das Doppelte.'] },
      { id: 'platin', name: 'Platinblond', color: '#f2dca0', ramp: ['#3a2c18', '#a88a50', '#d8ba78', '#f2dca0', '#fff6d8'], req: ['foe:boss-label', 1, 'Schlage Papa Platin.'] },
      { id: 'nachtblau', name: 'Nachtblau', color: '#34509a', ramp: ['#080a20', '#141e4a', '#223472', '#34509a', '#7a9ae0'], req: ['curfew', 5, 'Gewinne 5 Duelle zur Sperrstunde.'] },
      { id: 'rosa', name: 'Bonbonrosa', color: '#f07aa8', ramp: ['#3a0c22', '#98285a', '#d04e84', '#f07aa8', '#ffc4dc'], req: ['sealed', 4, 'Lass bei Esme 4 Karten veredeln.'] },
      { id: 'violett', name: 'Violett', color: '#8a52c2', ramp: ['#160a2a', '#3a1c66', '#5e3494', '#8a52c2', '#c8a0f0'], req: ['curses', 20, 'Lass Gegner 20-mal unter einem Fluch ziehen.'] },
      { id: 'gift', name: 'Giftgrün', color: '#7cc832', ramp: ['#0c1e08', '#225210', '#4a8c1c', '#7cc832', '#d0f47a'], req: ['foe:curse-dealer', 3, 'Schlage Mortimer dreimal.'] }
    ],
    beard: [
      { id: 'none', name: 'Glatt rasiert' },
      { id: 'beard-10', name: 'Menjou-Bärtchen', req: ['foe:cheater', 1, 'Schlage Rico, den Falschspieler.'] },
      { id: 'beard-4', name: 'Dreitagebart', req: ['duels', 4, 'Gewinne 4 Duelle.'] },
      { id: 'beard-6', name: 'Schnauzer', req: ['foe:barkeeper', 1, 'Schlage Bruno.'] },
      { id: 'beard-1', name: 'Zwirbelbart', req: ['duels', 8, 'Gewinne 8 Duelle.'] },
      { id: 'beard-11', name: 'Kinnstreifen', req: ['fast', 1, 'Gewinne ein Duell in höchstens 16 Zügen.'] },
      { id: 'beard-2', name: 'Kinnbart', req: ['specials', 20, 'Spiele 20 Spezialkarten.'] },
      { id: 'beard-7', name: 'Henriquatre', req: ['elites', 2, 'Schlage 2 Elite-Gegner.'] },
      { id: 'beard-5', name: 'Koteletten', req: ['eights', 25, 'Spiele 25 Achten.'] },
      { id: 'beard-8', name: 'Backenbart', req: ['foe:boss', 5, 'Schlage 5 Bosse.'] },
      { id: 'beard-3', name: 'Vollbart', req: ['duels', 30, 'Gewinne 30 Duelle.'] },
      { id: 'beard-9', name: 'Rauschebart', req: ['duels', 60, 'Gewinne 60 Duelle.'] }
    ],
    outfit: [
      { id: 'outfit-2', name: 'Unterhemd' },
      { id: 'outfit-5', name: 'Kapuzenpulli', req: ['played', 60, 'Spiele 60 Karten.'] },
      { id: 'outfit-30', name: 'Ringelshirt', req: ['played', 100, 'Spiele 100 Karten.'] },
      { id: 'outfit-1', name: 'Hemd und Weste', req: ['duels', 3, 'Gewinne 3 Duelle.'] },
      { id: 'outfit-16', name: 'Hemd mit Hosenträgern', req: ['duels', 7, 'Gewinne 7 Duelle.'] },
      { id: 'outfit-22', name: 'Jeansjacke', req: ['sold', 2, 'Verkaufe 2 Trinkets an Manfred.'] },
      { id: 'outfit-26', name: 'Strickjacke', req: ['healed', 2, 'Kaufe 2 Streichhölzer nach.'] },
      { id: 'outfit-4', name: 'Lederjacke', req: ['duels', 12, 'Gewinne 12 Duelle.'] },
      { id: 'outfit-14', name: 'Trenchcoat', req: ['curfew', 1, 'Gewinne ein Duell zur Sperrstunde.'] },
      { id: 'outfit-28', name: 'Lederkutte', req: ['foe:bruiser', 2, 'Schlage Knochen-Kalle zweimal.'] },
      { id: 'outfit-20', name: 'Bomberjacke', req: ['elites', 3, 'Schlage 3 Elite-Gegner.'] },
      { id: 'outfit-6', name: 'Hawaiihemd', req: ['bank', 10, 'Kassiere in einem Duell eine Bank von 10 Mark.'] },
      { id: 'outfit-10', name: 'Trainingsjacke', req: ['losses', 5, 'Verliere 5 Duelle.'] },
      { id: 'outfit-24', name: 'Sträflingshemd', req: ['losses', 8, 'Verliere 8 Duelle.'] },
      { id: 'outfit-23', name: 'Feuerwehrjacke', req: ['burnt', 8, 'Fackle 8 Tische ab.'] },
      { id: 'outfit-13', name: 'Croupier-Weste', req: ['bought', 25, 'Kaufe 25-mal bei Manfred.'] },
      { id: 'outfit-18', name: 'Zauberumhang', req: ['swaps', 5, 'Spiele 5-mal Tausch.'] },
      { id: 'outfit-9', name: 'Rollkragen mit Goldkette', req: ['money', 60, 'Halte 60 Mark in der Kasse.'] },
      { id: 'outfit-21', name: 'Hausmantel', req: ['money', 80, 'Halte 80 Mark in der Kasse.'] },
      { id: 'outfit-3', name: 'Burgunder Anzug', req: ['casino', 1, 'Räume das erste Casino aus.'] },
      { id: 'outfit-15', name: 'Weißes Dinnerjackett', req: ['last', 3, 'Gewinne 3 Duelle mit dem letzten Streichholz.'] },
      { id: 'outfit-8', name: 'Paillettenkleid', req: ['sealed', 6, 'Lass bei Esme 6 Karten veredeln.'] },
      { id: 'outfit-19', name: 'Charleston-Kleid', req: ['foe:taxi-dancer', 1, 'Schlage Mimi.'] },
      { id: 'outfit-27', name: 'Abendkleid', req: ['foe:boss-donna', 1, 'Schlage Donna Scarlatta.'] },
      { id: 'outfit-12', name: 'Nadelstreifen', req: ['casino', 2, 'Räume 2 Casinos aus.'] },
      { id: 'outfit-29', name: 'Zirkusdirektor', req: ['foe:boss-impresario', 1, 'Schlage den Impresario.'] },
      { id: 'outfit-17', name: 'Kapitänsuniform', req: ['foe:boss-captain', 1, 'Schlage Kapitänin Fortuna.'] },
      { id: 'outfit-11', name: 'Pelzkragenmantel', req: ['casino', 4, 'Räume 4 Casinos aus.'] },
      { id: 'outfit-25', name: 'Goldjackett', req: ['overkill', 4, 'Übertriff ein Glutziel um das Vierfache.'] },
      { id: 'outfit-7', name: 'Smoking', req: ['casino', 6, 'Räume 6 Casinos aus.'] }
    ],
    hat: [
      { id: 'none', name: 'Ohne Hut' },
      { id: 'hat-4', name: 'Baseballkappe', req: ['duels', 6, 'Gewinne 6 Duelle.'] },
      { id: 'hat-12', name: 'Baskenmütze', req: ['aces', 15, 'Spiele 15 Asse.'] },
      { id: 'hat-2', name: 'Schiebermütze', req: ['duels', 10, 'Gewinne 10 Duelle.'] },
      { id: 'hat-10', name: 'Melone', req: ['bought', 12, 'Kaufe 12-mal bei Manfred.'] },
      { id: 'hat-11', name: 'Kreissäge', req: ['rerolls', 5, 'Lass Manfred 5-mal neu auslegen.'] },
      { id: 'hat-7', name: 'Strickmütze', req: ['curfew', 3, 'Gewinne 3 Duelle zur Sperrstunde.'] },
      { id: 'hat-18', name: 'Pork Pie', req: ['foe:pianist', 1, 'Schlage Fingers, den Pianisten.'] },
      { id: 'hat-14', name: 'Fes', req: ['sacrificed', 6, 'Wirf mit Opfer 6 Karten ab.'] },
      { id: 'hat-5', name: 'Bandana', req: ['curses', 15, 'Lass Gegner 15-mal unter einem Fluch ziehen.'] },
      { id: 'hat-16', name: 'Federstirnband', req: ['sealed', 3, 'Lass bei Esme 3 Karten veredeln.'] },
      { id: 'hat-6', name: 'Croupier-Schirm', req: ['skips', 20, 'Lass Gegner 20-mal aussetzen.'] },
      { id: 'hat-20', name: 'Schlapphut', req: ['foe:black-widow', 1, 'Schlage Vera, die Schwarze Witwe.'] },
      { id: 'hat-21', name: 'Uschanka', req: ['curfew', 6, 'Gewinne 6 Duelle zur Sperrstunde.'] },
      { id: 'hat-1', name: 'Fedora', req: ['foe:boss', 3, 'Schlage 3 Bosse.'] },
      { id: 'hat-9', name: 'Cowboyhut', req: ['foe:bluffer', 2, 'Schlage Texas-Theo zweimal.'] },
      { id: 'hat-13', name: 'Kapitänsmütze', req: ['foe:sailor', 3, 'Schlage Matrose Hein dreimal.'] },
      { id: 'hat-15', name: 'Feuerwehrhelm', req: ['burnt', 25, 'Fackle 25 Tische ab.'] },
      { id: 'hat-22', name: 'Narrenkappe', req: ['losses', 20, 'Verliere 20 Duelle.'] },
      { id: 'hat-3', name: 'Zylinder', req: ['casino', 3, 'Räume 3 Casinos aus.'] },
      { id: 'hat-19', name: 'Heiligenschein', req: ['nodraw', 3, 'Gewinne 3 Duelle, ohne eine einzige Karte zu ziehen.'] },
      { id: 'hat-23', name: 'Diadem', req: ['foe:boss-baroness', 1, 'Schlage die Baronin von Hohenstein.'] },
      { id: 'hat-17', name: 'Teufelshörner', req: ['foe:boss-prince', 1, 'Schlage den Fürsten.'] },
      { id: 'hat-8', name: 'Krone', req: ['casino', 8, 'Räume alle 8 Casinos aus.'] }
    ],
    acc: [
      { id: 'acc-11', name: 'Streichholz im Mundwinkel', req: ['burned', 1, 'Verbrenne eine Karte.'] },
      { id: 'acc-20', name: 'Pflaster', req: ['losses', 1, 'Verliere ein Duell.'] },
      { id: 'acc-1', name: 'Nickelbrille', req: ['specials', 8, 'Spiele 8 Spezialkarten.'] },
      { id: 'acc-15', name: 'Nasenring', req: ['kniffe', 2, 'Lerne oder stufe 2 Kniffe.'] },
      { id: 'acc-18', name: 'Rose hinterm Ohr', req: ['sealed', 2, 'Lass bei Esme 2 Karten veredeln.'] },
      { id: 'acc-4', name: 'Goldkreolen', req: ['duels', 9, 'Gewinne 9 Duelle.'] },
      { id: 'acc-17', name: 'Karte hinterm Ohr', req: ['held', 3, 'Trage 3 Spezialkarten zugleich im Deck.'] },
      { id: 'acc-19', name: 'Lutscher', req: ['foe:cigarette-girl', 2, 'Schlage Lola zweimal.'] },
      { id: 'acc-12', name: 'Narbe', req: ['last', 1, 'Gewinne ein Duell mit dem letzten Streichholz.'] },
      { id: 'acc-3', name: 'Zigarre', req: ['burned', 10, 'Verbrenne 10 Karten.'] },
      { id: 'acc-8', name: 'Runde Sonnenbrille', req: ['played', 220, 'Spiele 220 Karten.'] },
      { id: 'acc-13', name: 'Roter Schal', req: ['trinkets', 6, 'Trage 6 Trinkets in einem Run.'] },
      { id: 'acc-10', name: 'Pfeife', req: ['burned', 25, 'Verbrenne 25 Karten.'] },
      { id: 'acc-2', name: 'Pilotenbrille', req: ['flawless', 1, 'Räume ein Casino aus, ohne ein Streichholz zu verlieren.'] },
      { id: 'acc-21', name: 'Katzenaugenbrille', req: ['foe:card-counter', 1, 'Schlage Dr. Zahl.'] },
      { id: 'acc-16', name: 'Augenmaske', req: ['foe:pickpocket', 1, 'Schlage Sally.'] },
      { id: 'acc-7', name: 'Perlenkette', req: ['money', 40, 'Halte 40 Mark in der Kasse.'] },
      { id: 'acc-9', name: 'Herzbrille', req: ['foe:influencer', 1, 'Schlage Lucky Luis.'] },
      { id: 'acc-14', name: 'Kopfhörer', req: ['foe:producer', 1, 'Schlage Milan.'] },
      { id: 'acc-22', name: 'Federboa', req: ['foe:boss-eddie', 1, 'Schlage Samt-Eddie.'] },
      { id: 'acc-6', name: 'Monokel', req: ['foe:boss', 8, 'Schlage 8 Bosse.'] },
      { id: 'acc-5', name: 'Augenklappe', req: ['losses', 10, 'Verliere 10 Duelle.'] }
    ],
    tattoo: [
      { id: 'tattoo-1', name: 'Flamme am Hals', req: ['burnt', 5, 'Fackle 5 Tische ab.'] },
      { id: 'tattoo-19', name: 'Streichholz am Schlüsselbein', req: ['healed', 4, 'Kaufe 4 Streichhölzer nach.'] },
      { id: 'tattoo-2', name: 'Pik-Ass auf der Brust', req: ['aces', 25, 'Spiele 25 Asse.'] },
      { id: 'tattoo-11', name: 'Anker an der Schulter', req: ['foe:sailor', 1, 'Schlage Matrose Hein.'] },
      { id: 'tattoo-3', name: 'Farbenband an der Schulter', req: ['chain', 10, 'Erreiche eine Kette von ×10.'] },
      { id: 'tattoo-12', name: 'Schwalbe auf der Brust', req: ['fast', 5, 'Gewinne 5 Duelle in höchstens 16 Zügen.'] },
      { id: 'tattoo-4', name: 'Würfel am Hals', req: ['specials', 40, 'Spiele 40 Spezialkarten.'] },
      { id: 'tattoo-14', name: 'Herz mit Dolch', req: ['pushed', 6, 'Zwinge einen Gegner in einem Duell, 6 Karten zu ziehen.'] },
      { id: 'tattoo-5', name: 'Flammen am Schlüsselbein', req: ['burnt', 15, 'Fackle 15 Tische ab.'] },
      { id: 'tattoo-6', name: 'Rose an der Schulter', req: ['sealed', 10, 'Lass bei Esme 10 Karten veredeln.'] },
      { id: 'tattoo-15', name: 'Stern unter dem Auge', req: ['glut', 800, 'Sammle 800 Glut in einem Duell.'] },
      { id: 'tattoo-7', name: 'Pik unter dem Auge', req: ['losses', 15, 'Verliere 15 Duelle.'] },
      { id: 'tattoo-8', name: 'Farbenkette um den Hals', req: ['pairs', 30, 'Lege 30-mal mehrere Karten auf einmal.'] },
      { id: 'tattoo-13', name: 'Spinnennetz an der Schulter', req: ['foe:black-widow', 2, 'Schlage Vera, die Schwarze Witwe, zweimal.'] },
      { id: 'tattoo-9', name: 'Schlange an der Schulter', req: ['curses', 30, 'Lass Gegner 30-mal unter einem Fluch ziehen.'] },
      { id: 'tattoo-18', name: 'Strichcode am Hals', req: ['bought', 50, 'Kaufe 50-mal bei Manfred.'] },
      { id: 'tattoo-10', name: 'Glückssieben', req: ['sevens', 77, 'Spiele 77 Siebenen.'] },
      { id: 'tattoo-16', name: 'Drache über der Schulter', req: ['chain', 15, 'Erreiche eine Kette von ×15.'] },
      { id: 'tattoo-17', name: 'Totenkopf in Flammen', req: ['burnt', 40, 'Fackle 40 Tische ab.'] }
    ]
  };
  var TABS = [['skin', 'Haut'], ['hair', 'Frisur'], ['hairColor', 'Haarfarbe'], ['beard', 'Bart'], ['outfit', 'Outfit'], ['hat', 'Hut'], ['acc', 'Extras'], ['tattoo', 'Tattoos']];
  var MULTI = { tattoo: true, acc: true }; // hiervon lassen sich mehrere zugleich tragen
  /* Extras, die denselben Platz brauchen, schließen einander aus: Wer eines wählt, legt das andere ab. */
  var SLOT = { 'acc-1': 'eyes', 'acc-2': 'eyes', 'acc-5': 'eyes', 'acc-6': 'eyes', 'acc-8': 'eyes', 'acc-9': 'eyes', 'acc-16': 'eyes', 'acc-21': 'eyes',
    'acc-3': 'mouth', 'acc-10': 'mouth', 'acc-11': 'mouth', 'acc-19': 'mouth',
    'acc-7': 'neck', 'acc-13': 'neck', 'acc-22': 'neck' };
  var DEFAULT = { skin: 'sand', hair: 'hair-1', hairColor: 'braun', beard: 'none', outfit: 'outfit-2', hat: 'none', acc: [], tattoo: [] };

  function find(kind, id) { return PARTS[kind].filter(function (p) { return p.id === id; })[0]; }
  function feat(meta, key) {
    if (key.indexOf('foe:') === 0 && key !== 'foe:boss') return (meta.defeated || {})[key.slice(4)] || 0;
    if (key === 'foe:boss') return Object.keys(meta.defeated || {}).reduce(function (n, id) { return n + (ZU.ENEMIES[id] && ZU.ENEMIES[id].kind === 'boss' ? meta.defeated[id] : 0); }, 0);
    return ZU.Meta.feat(meta, key);
  }
  function unlocked(meta, part) { return !part.req || feat(meta, part.req[0]) >= part.req[1]; }

  /* Bringt eine gespeicherte Figur in Form: Unbekanntes und noch nicht Erspieltes fällt auf den Standard zurück. */
  function clean(raw, meta) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var out = {};
    ['skin', 'hair', 'hairColor', 'beard', 'outfit', 'hat'].forEach(function (kind) {
      var part = find(kind, raw[kind]);
      out[kind] = part && (!meta || unlocked(meta, part)) ? part.id : DEFAULT[kind];
    });
    Object.keys(MULTI).forEach(function (kind) {
      out[kind] = (Array.isArray(raw[kind]) ? raw[kind] : []).filter(function (id, i, all) {
        var part = find(kind, id);
        return part && all.indexOf(id) === i && (!meta || unlocked(meta, part));
      });
    });
    return out;
  }

  /* ---------- Bilder ---------- */
  var cache = {}, waiting = [];
  function image(name) {
    var item = cache[name];
    if (item) return item;
    item = cache[name] = { img: new Image(), ok: false, bad: false };
    item.img.onload = function () { item.ok = true; flush(); };
    item.img.onerror = function () { item.bad = true; flush(); };
    item.img.src = ZU.asset('avatar/' + name + '.png');
    return item;
  }
  function flush() { var list = waiting; waiting = []; list.forEach(function (fn) { fn(); }); }
  /* Ebenen von unten nach oben: [Bild, Rampe oder null, Maske oder null]. */
  var FACE_INK = { 'tattoo-7': true, 'tattoo-15': true };          // sitzt im Gesicht: nach den Gesichtsschatten, vor den Zügen
  var UNDER_HAIR = { 'acc-7': true, 'acc-13': true, 'acc-22': true }; // Kette, Schal, Boa: unter Bart und langem Haar
  var HAIR_OFF = { 'hair-8': { 'hat-2': true, 'hat-3': true, 'hat-4': true, 'hat-7': true, 'hat-10': true, 'hat-11': true, 'hat-12': true,
    'hat-13': true, 'hat-14': true, 'hat-18': true } }; // Afro passt unter diese Hüte nicht
  function layers(cfg, mood) {
    var skin = find('skin', cfg.skin).ramp, hairRamp = find('hairColor', cfg.hairColor).ramp, list = [['body-a', skin]];
    cfg.tattoo.forEach(function (id) { if (!FACE_INK[id]) list.push([id]); });
    list.push([cfg.outfit]);
    list.push(['face-' + mood + '-skin', skin]);
    cfg.tattoo.forEach(function (id) { if (FACE_INK[id]) list.push([id]); });
    list.push(['face-' + mood]);
    cfg.acc.forEach(function (id) { if (UNDER_HAIR[id]) list.push([id]); });
    if (cfg.beard !== 'none') list.push([cfg.beard, hairRamp]);
    // Unter einem Hut verschwindet das Haar dort, wo die Hutmaske deckt (assets/avatar/<hut>-hairmask.png).
    var hidden = cfg.hat !== 'none' && HAIR_OFF[cfg.hair] && HAIR_OFF[cfg.hair][cfg.hat];
    if (cfg.hair !== 'none' && !hidden) list.push([cfg.hair, hairRamp, cfg.hat !== 'none' ? cfg.hat + '-hairmask' : null]);
    cfg.acc.forEach(function (id) { if (!UNDER_HAIR[id]) list.push([id]); });
    if (cfg.hat !== 'none') list.push([cfg.hat]);
    return list;
  }
  /* Graustufen-Ebene in die Farben einer Rampe umsetzen; das Ergebnis wird je Bild und Rampe aufgehoben. */
  var tinted = {};
  function rgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
  function ramped(name, img, ramp) {
    var key = name + '|' + ramp.join(''), done = tinted[key];
    if (done) return done;
    var c = document.createElement('canvas');
    c.width = c.height = SIZE;
    var x = c.getContext('2d');
    x.drawImage(img, 0, 0, SIZE, SIZE);
    try {
      var data = x.getImageData(0, 0, SIZE, SIZE), px = data.data, cols = ramp.map(rgb);
      for (var i = 0; i < px.length; i += 4) {
        if (!px[i + 3]) continue;
        var l = px[i], col = cols[l < 56 ? 0 : l < 124 ? 1 : l < 180 ? 2 : l < 228 ? 3 : 4];
        px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2];
      }
      x.putImageData(data, 0, 0);
    } catch (e) { /* ohne Pixelzugriff bleibt die Ebene grau */ }
    tinted[key] = c;
    return c;
  }
  var scratch = null;
  function drawLayer(ctx, name, img, ramp, mask) {
    var src = ramp ? ramped(name, img, ramp) : img;
    if (!mask) { ctx.drawImage(src, 0, 0, SIZE, SIZE); return; }
    scratch = scratch || document.createElement('canvas');
    scratch.width = scratch.height = SIZE;
    var s = scratch.getContext('2d');
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, SIZE, SIZE);
    s.drawImage(src, 0, 0, SIZE, SIZE);
    s.globalCompositeOperation = 'destination-out';
    s.drawImage(mask, 0, 0, SIZE, SIZE);
    ctx.drawImage(scratch, 0, 0);
  }
  function paint(canvas, cfg, mood) {
    var list = layers(cfg, mood), items = list.map(function (l) { return image(l[0]); });
    var masks = list.map(function (l) { return l[2] ? image(l[2]) : null; });
    var pending = items.concat(masks).some(function (it) { return it && !it.ok && !it.bad; });
    if (pending) { waiting.push(function () { if (canvas._want === mood + JSON.stringify(cfg)) paint(canvas, cfg, mood); }); return; }
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    list.forEach(function (l, i) { if (items[i].ok) drawLayer(ctx, l[0], items[i].img, l[1], masks[i] && masks[i].ok ? masks[i].img : null); });
  }

  /* Porträt der eigenen Figur mit denselben Griffen wie ZU.portraitEl: setMood(mood, ms), setBase(mood), setConfig(cfg). */
  function el(cfg, cls) {
    var canvas = h('canvas', 'pt-img av-canvas', null, { width: String(SIZE), height: String(SIZE) });
    var box = h('div', 'portrait avatar ' + (cls || ''), [h('div', 'pt-react', [h('div', 'pt-bob', [canvas])])]);
    var base = 'idle', shown = '', timer = null, blinkTimer = null, seen = false;
    function show(mood) {
      shown = mood;
      canvas._want = mood + JSON.stringify(cfg);
      box.dataset.mood = mood;
      paint(canvas, cfg, mood);
    }
    function blink() {
      if (box.isConnected) seen = true; else if (seen) return;
      if (shown === 'idle' && box.isConnected) { show('blink'); setTimeout(function () { if (shown === 'blink') show('idle'); }, 130); }
      blinkTimer = setTimeout(blink, 2000 + Math.random() * 3800);
    }
    box.setMood = function (mood, ms) {
      clearTimeout(timer);
      show(mood);
      if (ms) timer = setTimeout(function () { show(base); }, ms);
    };
    box.setBase = function (mood) { base = mood; if (!timer || shown === 'blink' || shown === 'idle') show(mood); };
    box.setConfig = function (next) { cfg = next; show(shown === 'blink' ? 'idle' : shown || base); };
    show('idle');
    blinkTimer = setTimeout(blink, 1500 + Math.random() * 2500);
    return box;
  }

  /* ---------- Editor ---------- */
  function screen(game, root) {
    ZU.bg.set('shop');
    ZU.audio.music('menu');
    var meta = ZU.Meta.get(), cfg = clean(game.profile.avatar, meta), tab = game.avatarTab || 'hair';
    var preview = el(cfg, 'huge'), grid = h('div', 'av-grid'), tabsEl = h('div', 'br-subtabs'), info = h('div', 'av-info');
    var moods = ['idle', 'smug', 'angry', 'shocked', 'defeated'], moodNames = { idle: 'Ruhig', smug: 'Hämisch', angry: 'Verärgert', shocked: 'Erschrocken', defeated: 'Geschlagen' };
    var moodRow = h('div', 'av-moods', moods.map(function (m) {
      return ZU.btn(moodNames[m], 'small', function () { preview.setBase(m); preview.setMood(m); });
    }));
    function save() {
      game.profile.avatar = cfg;
      game.saveProfile();
      preview.setConfig(cfg);
    }
    function chosen(kind, id) { return MULTI[kind] ? cfg[kind].indexOf(id) >= 0 : cfg[kind] === id; }
    function choose(kind, id) {
      if (MULTI[kind]) {
        var at = cfg[kind].indexOf(id);
        if (at >= 0) cfg[kind].splice(at, 1);
        else {
          if (SLOT[id]) cfg[kind] = cfg[kind].filter(function (other) { return SLOT[other] !== SLOT[id]; });
          cfg[kind].push(id);
        }
      } else cfg[kind] = id;
      ZU.audio.select(true);
      save();
      render();
    }
    function sample(kind, part) {
      if (kind === 'skin' || kind === 'hairColor') { var sw = h('i', 'av-swatch'); sw.style.background = part.color; return sw; }
      var copy = JSON.parse(JSON.stringify(cfg));
      if (kind === 'tattoo') { copy.tattoo = [part.id]; copy.outfit = 'outfit-2'; copy.hat = 'none'; }
      else if (MULTI[kind]) copy[kind] = [part.id];
      else copy[kind] = part.id;
      return el(copy, 'av-mini');
    }
    function render() {
      tabsEl.innerHTML = '';
      TABS.forEach(function (pair) {
        var open = PARTS[pair[0]].filter(function (p) { return unlocked(meta, p); }).length;
        tabsEl.appendChild(ZU.btn(pair[1] + ' ' + open + '/' + PARTS[pair[0]].length, 'small' + (pair[0] === tab ? ' on' : ''), function () { tab = game.avatarTab = pair[0]; render(); }));
      });
      grid.innerHTML = '';
      PARTS[tab].forEach(function (part) {
        var open = unlocked(meta, part);
        var tile = h('div', 'br-tile av-tile ' + (open ? 'open' : 'hidden') + (open && chosen(tab, part.id) ? ' sel' : ''), [
          open ? sample(tab, part) : h('i', 'av-lock', '?'),
          h('div', 'br-name', open ? part.name : '?????'),
          h('div', 'br-open' + (open ? '' : ' dim'), open ? (chosen(tab, part.id) ? 'Gewählt' : '') : part.req[2])
        ]);
        if (open) tile.addEventListener('click', function () { choose(tab, part.id); });
        grid.appendChild(tile);
      });
      info.textContent = tab === 'tattoo' ? 'Tattoos lassen sich kombinieren. Unter manchem Outfit sind sie nicht zu sehen.'
        : tab === 'acc' ? 'Extras lassen sich kombinieren – nur je eine Brille, ein Stück im Mund und eines um den Hals.'
        : 'Neue Teile erspielst du dir – sie kosten keine Asche. Unter ????? steht, was dafür zu tun ist.';
    }
    render();
    root.appendChild(h('div', 'screen backroom avatar-screen', [
      h('div', 'br-head', [ZU.btn('Zurück', 'felt', function () { game.toMenu(); }), h('h1', null, 'Deine Figur')]),
      h('div', 'av-body', [
        h('div', 'av-left', [preview, moodRow]),
        h('div', 'av-right', [tabsEl, grid, info])
      ])
    ]));
  }

  ZU.avatar = { PARTS: PARTS, DEFAULT: DEFAULT, clean: clean, el: el, unlocked: unlocked, screen: screen,
    /* Alle Bilder, die diese Figur braucht (zum Vorladen). */
    urls: function (cfg) {
      var names = {};
      ZU.MOODS.forEach(function (mood) { layers(cfg, mood).forEach(function (l) { names[l[0]] = true; if (l[2]) names[l[2]] = true; }); });
      return Object.keys(names).map(function (n) { return ZU.asset('avatar/' + n + '.png'); });
    } };
  if (ZU.screens) ZU.screens.avatar = screen;
})(window.ZU);
