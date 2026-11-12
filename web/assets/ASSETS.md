# Assets der Browser-Version

Stand: 11.11.2026

## Aus dem Projekt übernommen

Quelle ist jeweils `godot/game/Assets/`; aufbereitet mit
`web/tools/prepare_assets.py`.

| Ziel | Quelle | Aufbereitung |
|---|---|---|
| `special/*.png` | `Cards/Special/*_v2.png` | auf 128×128 verkleinert |
| `logo.png` | `UI/logo.png` | zugeschnitten, 640 px breit |
| `audio/*.mp3` | `Audio/*.wav` | als MP3 kodiert (112 kbit/s, Stereo) |

Die App-Symbole unter `icons/` (192 und 512 Pixel, je normal und „maskable“,
dazu `apple-touch-icon.png`) setzt `web/tools/make_icons.py` aus `logo.png`
auf einen Nussbaum-Hintergrund.

Alle übrigen PNGs sind auf eine Farbpalette umgerechnet (`prepare_assets.py --optimize`);
bei der Pixel-Art ist das ohne sichtbaren Verlust rund fünfmal kleiner.

## Neu generiert

Alle Bilder wurden am 11.11.2026 mit der Bildgenerierung von OpenAI über die
Codex-CLI speziell für Zündung erzeugt, jeweils auf Chroma-Grün, und mit
`web/tools/prepare_assets.py` freigestellt und verkleinert.

### Gegner (`enemies/`, 35 Sprite-Streifen)

Jeder Gegner entstand als Ausdrucks-Sheet mit 3×2 Feldern (neutral, Blinzeln,
hämisch, wütend, geschockt, geschlagen). `prepare_assets.py --sheets` erkennt
das Raster, legt die sechs Bilder deckungsgleich übereinander und speichert sie
als Streifen von 6 × 192 Pixeln. Für die acht Figuren der ersten Fassung diente
deren bisheriges Einzelporträt als Vorlage.

Die 15 Hausfiguren der Casinos (12.11.2026: Mimi, Kapellmeister Bela, Der Impresario, Matrose Hein, Zahlmeister
Pfennig, Kapitänin Fortuna, Page Anton, Concierge Laurent, Baronin von Hohenstein, Croupier Klara, Tresorwächter
Brock, Direktor Monopol, Heizer Ruß, Die Sirene, Der Fürst) entstanden einzeln mit demselben Prompt; als Stilvorlage
diente ein fertiger Streifen (`boss-consigliere.png` bzw. `boss-dolores.png`).

Gemeinsamer Prompt:

```text
You are producing game art. Use your built-in image generation tool (do NOT draw with code or scripts). If the image generation tool is not available, write FAILED.txt explaining why and stop.

For EACH character listed below, generate ONE separate landscape image (about 3:2) and save it as a PNG with exactly the given filename in the current working directory. Generate them one at a time. When done, list the files you created.

Every image is a CHARACTER EXPRESSION SHEET: a strict grid of 3 columns x 2 rows = 6 equal cells on one flat pure chroma-key green (#00FF00) background, with a clear empty green gap between neighbouring cells and around the border. No grid lines, no frames, no labels, no numbers, no text.
Every cell shows the SAME character as a head-and-shoulders bust, facing the viewer, with identical size, identical position inside the cell, identical outfit, hair and accessories. ONLY the facial expression changes (eyes, eyebrows, mouth, at most a slight head tilt):
- row 1, cell 1: neutral, calm, confident idle look
- row 1, cell 2: exactly like cell 1 but with the eyes closed (a blink)
- row 1, cell 3: smug, pleased, gloating grin
- row 2, cell 1: angry, annoyed scowl
- row 2, cell 2: shocked and nervous, wide eyes, one sweat drop
- row 2, cell 3: defeated, deflated, eyes lowered, sad

STYLE: chunky 16-bit pixel art with large clearly visible square pixels, thick dark outlines, limited palette of dark walnut brown, aged ivory, burgundy red, brass gold, ember orange and muted teal, moody 1930s backroom casino and mafia feeling. The attached reference images show the exact art style, framing and level of detail to match. Do not use bright green anywhere on the character.
```

Figuren:

- curse-dealer.png - exactly the character shown in the SECOND attached image: a sinister card dealer in a dark purple hooded cloak, pale skin, glowing yellow eyes under the hood, thin goatee, holding a fan of cards.
- cheater.png - exactly the character shown in the THIRD attached image: a sly card cheat with a red fedora with black band, thin pencil mustache, burgundy vest over an ivory shirt, an ace card in his raised hand.
- card-counter.png - exactly the character shown in the FOURTH attached image: a thin nervous accountant-like card counter with round gold glasses, slicked-back brown hair, grey-blue suit, gold tie, a pencil behind the ear.
- double-igniter.png - exactly the character shown in the FIFTH attached image: a wild-eyed pyromaniac gambler with brass goggles pushed up on the forehead, soot-smudged face, singed spiky hair, orange shirt, holding two lit matches.
- boss-shark.png - exactly the character shown in the SECOND attached image: a heavy-set smug card shark boss with a black bowler hat, cigar in the mouth, dark navy pinstripe suit, blue tie, one gold tooth.
- boss-smoke.png - exactly the character shown in the THIRD attached image: an elegant older femme fatale with silver-white 1930s wavy hair, long cigarette holder with curling grey smoke, burgundy dress, pearl necklace, gold earrings.
- boss-house.png - exactly the character shown in the FOURTH attached image: an imposing old casino owner with a black top hat with red band, gold monocle, big white mustache, black tailcoat, red bow tie, gold watch chain.
- cigarette-girl.png - a pretty young 1930s cigarette girl: small burgundy pillbox hat with a brass badge, bobbed auburn hair with a curl on the cheek, red lipstick, long lashes, burgundy uniform jacket with brass buttons and an ivory collar, a leather tray strap over the shoulders.
- barkeeper.png - a broad-shouldered bald barkeeper with a big dark handlebar mustache, thick eyebrows, rolled-up ivory shirt sleeves, black vest, burgundy sleeve garters, a white towel over one shoulder.
- showgirl.png - a glamorous beautiful 1930s revue showgirl: tall feather headdress in ember orange and gold, platinum blonde finger-wave hair, red lipstick, beauty mark, sparkling burgundy sequin costume with bare shoulders, long ivory opera gloves, gold earrings.
- bruiser.png - a huge dim-witted mafia enforcer: thick neck, broken crooked nose, a scar across one eyebrow, grey flat cap, stubble, too-tight dark pinstripe suit, loosened burgundy tie, one raised fist wearing brass knuckles.
- pianist.png - a slim melancholic lounge pianist with dark brown skin, short slicked hair, a thin mustache, a cigarette hanging from his lips with a wisp of smoke, loose black bow tie, ivory dinner jacket with a burgundy pocket square.
- bookie.png - a small jittery bookmaker: straw boater hat with a burgundy band, round face, thin mustache, pencil behind the ear, brown checkered suit, orange bow tie, a fan of betting slips in one hand.
- black-widow.png - a strikingly beautiful cold femme fatale widow: small black hat with a black lace veil over the eyes, glossy black hair in a low bun, very pale skin, dark red lips, black high-collar dress with a brass spider brooch, pearl earrings.
- pickpocket.png - a pretty cheeky young woman pickpocket: brown newsboy cap over curly copper-red hair, freckles, bright mischievous eyes, an oversized brown men's jacket over an ivory shirt, burgundy scarf, fingerless gloves, dangling a brass pocket watch on its chain from one hand.
- bouncer.png - an enormous casino doorman: shaved head, cauliflower ears, heavy brow, square jaw, tiny black bow tie on a thick neck, black tuxedo straining over huge shoulders, arms crossed.
- boss-dolores.png - a glamorous beautiful jewel fence in her thirties: platinum blonde Hollywood waves, red lipstick, haughty half-closed eyes, white fur stole, a huge sparkling diamond necklace and drop earrings, holding a champagne coupe.
- boss-consigliere.png - a cold elegant mafia consigliere in his fifties: slicked dark hair with silver temples, thin round glasses, sharp cheekbones, charcoal three-piece suit, burgundy tie with a gold pin, a closed leather ledger held to his chest.
- boss-donna.png - a stunningly beautiful ice-cold mafia donna: long dark wavy hair over one shoulder, deep red lips, sharp confident eyes, red evening dress, ruby necklace, black opera gloves, a single red rose held near her shoulder.
- ember-croupier.png - a calm professional casino croupier with a dark teal dealer eyeshade visor, black waistcoat, ivory shirt, red bow tie, thin mustache, brown wavy hair.

### Manfred (`manfred/manfred.png`, 12 Posen)

Der Ladenbesitzer wurde am 11.11.2026 nach dem Vorbild der bisherigen
Projektgrafik (`godot/game/Assets/Characters/Manfred/manfred_0.png`) im Stil der
Gegner neu erzeugt: zwei Posen-Sheets mit je 3×2 Feldern, die
`prepare_assets.py --manfred` an der Rumpfmitte ausrichtet und zu einem Streifen
von 12 × 256 Pixeln zusammensetzt. Die alten vier Einzelposen entfallen; ihr
halbtransparentes Hemd ließ sich nicht sauber freistellen.

Posen in Reihenfolge: Ruhe, Blinzeln, Sprechen, Händereiben, verärgert mit
verschränkten Armen, überrascht, Hut ziehen, Münze zeigen, brennendes
Streichholz, Karten auffächern, Seitenblick, Zwinkern mit Daumen hoch.

### Trinket-Icons (`trinkets/`, 83 Stück) und Privilegien (`perks/`, 8 Stück)

Einzelne Objekt-Icons im selben Stil, mit `prepare_assets.py --icons` auf 96×96
freigestellt. Die erste Serie: Glückschip, Aschenbecher, Doppelboden,
Zündschnur, Kassenbuch, Messingknöchel, Taschenuhr, Gezinkter Würfel,
Samthandschuh, Herzblut, Achterbahn, Dauerbrenner, Schwarzes Notizbuch,
Rauchspiegel, Heißer Draht, Ass im Ärmel, Goldenes Streichholz.

Die zweite Serie (ebenfalls 11.11.2026): Siebenschläfer, Stoppuhr, Voodoopuppe,
Hexenbrett, Kartenhai, Paschkönig, Dietrich, Generalschlüssel, Schwarze Serie,
Karoschliff, Nachbrenner, Glutofen, Goldzahn, Zinseszins, Kellerschlüssel,
Kurze Lunte, Falschgeld, Stempelkarte.

Upgrades (`upgrades/`, 13 Stück, 12.11.2026): je ein Symbol für die dauerhaften Upgrades im Hinterzimmer,
erzeugt wie die Trinkets (Bögen auf Chroma-Grün, Skripte unter `/data/ignite/art/upgrades/`).

Privilegien: Flinke Finger (behandschuhte Hand mit Kartenfächer), Großes Regal,
Vitrine, Stammplatz, Schleifer, Glockenrecht, Aschekasten, Zündholzbrief.

Die zweite große Serie (12.11.2026): 48 weitere Trinket-Icons und 11 Bilder für
neue Spezialkarten (`special/`, 128×128). Erzeugt als Bögen auf Chroma-Grün
(3×3 Objekte je Bogen für Trinkets, 2×2 für Spezialkarten; Referenz
`trinkets/pocket-watch.png` bzw. `special/fluch.png`), in einzelne Objekte
zerlegt und mit `cutout()` aus `prepare_assets.py` freigestellt. Prompt eines
Bogens: „A square sprite sheet of game item icons: a strict grid of 3 columns x
3 rows = 9 equal cells on one flat pure chroma-key green (#00FF00) background.
Each cell holds ONE separate chunky object, centred in its cell, all at the
same scale, with a wide empty green gap between neighbours …“, gefolgt von den
neun Motiven und derselben Stilzeile wie oben.

### Kulisse des Titelbildschirms (`title/`, seit 12.11.2026 in Ebenen)

Die Kulisse besteht aus `room.png` (Raum ohne Menschen, 1280×720), `table.png`
(nur der Tisch im Vordergrund, darüber durchsichtig) und sechs Figuren
`cast-<id>.png` – den Herren und Damen der sechs Casinos (Hausherr, Impresario,
Kapitänin Fortuna, Baronin von Hohenstein, Direktor Monopol, Der Fürst). Jede
Figur ist ein Streifen aus drei Bildern zu 440×480 (ruhig, Blinzeln, Grinsen);
Bild 2 und 3 sind Bild 1 mit ausgetauschtem Gesicht, damit nichts springt.
Erzeugt mit der Codex CLI auf Chroma-Grün (Vorlage: das jeweilige Porträt aus
`enemies/`), freigestellt und zusammengesetzt mit den Skripten unter
`/data/ignite/art/title/work/`. `js/screens.js` (`titleScene`) legt die Ebenen
übereinander und lässt die Figuren atmen, blinzeln und grinsen.

Die Bilder der Häuser für die Casino-Wahl liegen unter `casinos/<id>.png`
(480×270, ebenfalls 12.11.2026, Vorlage war die alte Titelkulisse).

### Frühere Kulisse des Titelbildschirms (`title/backroom.png`, entfernt)

Ein Bild im Format 16:9, mit der Codex CLI am 11.11.2026 generiert (Referenz:
vier vorhandene Gegnerporträts): das verrauchte Hinterzimmer vom eigenen Platz
aus gesehen – runder Tisch mit grünem Filz, Hängelampe, links Dolores und
Fingers, rechts der Consigliere und Donna, dazu Jetons, Aschenbecher und
Vorhänge. Die Bildmitte ist bewusst leer, dort stehen Schriftzug und Knöpfe.
`prepare_assets.py --title <Bild>` verkleinert es auf 640×360 und 192 Farben;
im Spiel wird es doppelt so groß mit harten Pixeln gezeigt.

Der brennende Schriftzug selbst ist kein Bild: `js/title.js` zeichnet ihn aus
den Glyphen des Pixel-Fonts und simuliert das Feuer zur Laufzeit. `logo.png`
wird im Menü nicht mehr gezeigt.

### Hoffiguren und Asse (`cards/faces.png`)

Zwölf Hoffiguren (Bube, Dame, König je Symbol) und vier Ass-Embleme, ebenfalls
mit der Codex CLI am 11.11.2026 auf Chroma-Grün generiert: je Symbol ein Bogen
mit drei Büsten, dazu ein 2×2-Bogen mit den Emblemen. Jedes Symbol ist ein
eigenes Haus mit eigener Stilwelt:

- **Herz – romantisch:** Karmin, Rosé, Elfenbein, etwas Gold. Troubadour mit
  Rose, Königin mit Rosen im Haar und Herzmedaillon, gütiger König im Hermelin.
  Ass: Herz mit Schleife und Rosen.
- **Karo – prunkvoll:** Zinnober, Bernstein, Gold. Page mit Juwelenturban,
  Königin voller Diamanten, Kaufmannskönig mit Goldketten. Ass: gefasster
  Edelstein im Art-déco-Rahmen.
- **Pik – kühl und soldatisch:** Nachtblau, Stahl, Silber. Knappe mit
  Hellebarde, Kriegerkönigin mit Dolch, König in Plattenrüstung. Ass: Klinge
  vor gekreuzten Schwertern.
- **Kreuz – gotisch:** Schwarz, Moosgrün, Knochenweiß, Grauviolett. Page mit
  Laterne, Königin mit Dornenkrone, Schleier und Rabe, hagerer König mit
  Streitkolben. Ass: Kreuz in Dornenranken mit Rabe.

`web/tools/make_cards.py --import <Ordner>` stellt die Bögen frei und legt die
Figuren verkleinert unter `web/tools/cardart/` ab; daraus und aus den selbst
gezeichneten Rahmen entsteht der Atlas (siehe unten).

## Im Projekt erzeugt

- `fonts/zuendung_pixel.ttf` – eigener Pixel-Font, aus den Bitmap-Definitionen
  in `web/tools/make_font.py` gebaut.
- `cards/faces.png` – Atlas aller Kartenflächen (8 × 5 Felder), gebaut von
  `web/tools/make_cards.py`: Papier, Rahmen, Zierrat, Symbole und Eckindizes
  sind dort Pixel für Pixel gezeichnet (52 × 73 Kartenpixel je Karte), die
  generierten Hoffiguren und Ass-Embleme werden eingesetzt. Die fünfte Zeile
  enthält die Rahmen der Spezialkarten: je Symbol einer, je Farbe ein schräg
  geteilter, dazu „frei“ (schwarzer Lack mit Gold) und ein neutraler Hausrahmen.
- Kartenrücken, kleine Farbsymbole, Streichholz-, Münz- und Flammen-Symbole
  sowie der Hintergrund entstehen zur Laufzeit aus CSS, kleinen Bitmaps
  (`js/cards.js`) und einem WebGL-Shader (`js/bg.js`).
- Alle Soundeffekte werden zur Laufzeit synthetisiert (`js/audio.js`).
