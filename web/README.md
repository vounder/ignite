# Zündung – Browser-Version

Kompletter Neubau des Mau-Mau-Roguelites für den Browser: reines HTML, CSS und
JavaScript ohne Build-Schritt und ohne Abhängigkeiten.

## Starten

Mit Konten (empfohlen, so läuft es auch online):

```bash
node server/server.js
```

Danach <http://localhost:8377> aufrufen. Der Server liefert das Spiel aus und
stellt die Konto-API bereit; Einrichtung und Betrieb stehen in
[`../server/README.md`](../server/README.md).

Ohne Server geht es weiterhin: `web/index.html` per Doppelklick öffnen oder den
Ordner statisch ausliefern. Dann fehlen nur die Konto-Funktionen; alle
zugehörigen Elemente blenden sich selbst aus.

## Spielprinzip

- **Duell:** Mau-Mau gegen den Dealer. Gelegt wird auf gleiche Farbe oder
  gleichen Wert; wer zuerst keine Karten mehr hat, gewinnt. Ein Klick auf eine
  passende Handkarte spielt sie sofort. Die 7 lässt den Gegner 1 Karte ziehen.
- **Ziehen:** Wer nicht legen kann oder will, zieht eine Karte. Passt sie, darf
  sie sofort gelegt werden; sonst endet der Zug.
- **Glutziel:** Jeder Tisch hat ein Glutziel (Tisch 600, Elite 800, Boss 1.100;
  verdoppelt sich je Akt, +50 % je Casino-Stufe). Wer es erreicht, hat den Tisch
  „abgefackelt“ und gewinnt sofort; die Auszahlung zahlt dafür +50 % der Prämie
  und weitere +50 % je Verdopplung über dem Ziel (ohne Deckel), dazu Asche.
  Werte in `ZU.GLUT_TARGET` (`js/data.js`).
- **Hinterzimmer:** gemalter Raum (`assets/backroom/room.png`). „Freischalten“
  und „Upgrades“ zeigen links das Regal mit großen Kacheln (Unterreiter je Art,
  Filter „Nur Kaufbares“, Verborgenes unter einem Tuch) und rechts den
  Schaukasten: Antippen legt ein Stück hinein, dort stehen Wirkung, Preis und
  der Kaufknopf. Der Unterreiter „Empfohlen“ nennt Platz 1–3 (`Meta.suggest`):
  das Wertvollste, das entdeckt und bezahlbar ist, sonst Sparziele.
- **Stimmen:** Figuren rufen kurze Worte, wenn ihre Sprechblase erscheint (Begrüßung,
  Häme, Ärger, Schreck, Sieg, Niederlage) – verzerrt wie aus einem Funkgerät. Eigener
  Regler „Stimmen“ in den Einstellungen (0 = aus).
- **Eigene Figur:** Im Hauptmenü unter „Deine Figur“ stellt man ein Brustbild aus Ebenen zusammen
  (`js/avatar.js`, `assets/avatar/`): 6 Hauttöne, 27 Frisuren, 14 Haarfarben, 11 Bärte, 30 Outfits, 23 Hüte, 22 Extras,
  19 Tattoos, gezeichnet im Stil der Gegnerporträts. Extras am selben Platz (Brille, Mund, Hals) schließen einander aus. Am Anfang sind nur eine Frisur, die drei Standard-Haarfarben
  und das Unterhemd frei; alles Weitere wird erspielt (`req` wie im Hinterzimmer, ohne Asche). Die Figur sitzt im
  Duell links unten und reagiert mit sechs Gesichtsausdrücken. Gespeichert wird sie im Browser-Profil.
- **Löschmittel:** Die Antwort der Gegner auf Glut (`ZU.DOUSE`, vergeben in
  `run.douse`): Löschsand (8 des Gegners: Kette −2), Löschwasser (Ass: Kette
  halbiert), Sprinkler (jeder 4. Gegnerzug: −5 % des Ziels an Glut), Löschdecke
  (Bosse, einmal: beim halben Ziel −25 % Glut, Kette zurück). Tische in Akt 1
  haben keines.
- **Ziehen:** setzt die Kette zurück; passt die gezogene Karte sofort, bleibt
  die halbe Kette stehen.
- **Wirtschaft in Prozent:** Prämien, Preise, Bank und Zinsdeckel wachsen je Akt
  um 15 % (`ZU.ACT_GROWTH`); Rabatte, Aufschläge und Geld-Trinkets rechnen in
  Prozent, damit sie in späten Akten noch zählen.
- **Trinkets:** 128 Stück, die meisten greifen in die Glut ein (Kartenwerte,
  Vervielfacher, Kette, Wachstum über den Run, Glutziel und Löschmittel) mit Synergie-Familien (Zieh-Druck und Flüche,
  Aussetzen, Kette und Glut, Mehrfachwahl, Spezialkarten, Kasse, Schutz). Es
  gibt keine Obergrenze; dafür kostet jedes weitere Trinket im Laden 12 %
  mehr. 25 Trinkets sind von Anfang an im Spiel, der Rest wird im Hinterzimmer
  entdeckt und gekauft.
- **Kniffe:** Regeln, welche normalen Karten in einem Zug zusammen gelegt werden
  dürfen (`ZU.KNIFFE`): Pasch für einzelne Werte (7er, 8er, 9/10, Bildkarten,
  Asse), Läufe je Symbol, Kleine Straße und der freie Pasch. Ein Zug folgt genau
  einem Kniff; die Stufe begrenzt die Kartenzahl (2, 3, beliebig). Man trägt
  einen Kniff (Upgrade „Zweite Hand“: bis zu drei). Manfred bietet in jedem
  Laden einen neuen Kniff oder die nächste Stufe an; Bosse geben wahlweise eine
  Stufe statt der Spezialkarte. Ausgeräumte Casinos bringen weitere Kniffe in
  die Runs (`tier`). Das frühere Privileg „Flinke Finger“ gibt es nicht mehr;
  alte Spielstände erhalten dafür den Pasch auf Stufe 3.
- **Privilegien:** Upgrades, die den ganzen Run gelten und keinen Trinket-Platz
  belegen. Manfred bietet je Akt genau eines an; die Neue Auslage ändert daran
  nichts.
- **Spezialkarten** (22 Stück, von Stillstand bis Inferno) sind begrenzt: Ein
  Deck fasst drei, das Upgrade „Kartenetui“ und das gleichnamige Trinket
  erweitern das. Ist das Deck voll, ersetzt eine Boss-Karte eine alte, und der
  Laden verkauft keine weitere. Sie haben einen
  Effekt und eine Bindung: an ein Symbol, an Rot oder Schwarz – oder gar nicht
  (Joker). Sie passen nur auf ihre Symbole und geben sie danach vor. Früh im
  Run tauchen fast nur symbolgebundene Karten auf, später farbgebundene, am
  Ende Joker. Der Rahmen zeigt die Bindung: ein Symbol = dessen Stilwelt und
  Farbe, Rot/Schwarz = zwei Welten schräg geteilt, Joker = schwarzer Lack mit
  Gold; ein Wimpel oben links trägt die passenden Symbole.
- **Hausregeln:** Einzelne Tische haben eine Zusatzregel, mit jedem Akt
  häufiger. Bisher gibt es „Letzter Stapel": Es wird nicht neu gemischt; ist
  der Stapel leer und muss jemand ziehen, gewinnt, wer weniger Karten hält.
- **Glut:** Jede gespielte Karte bringt Kartenwert × Kette. Die Kette wächst
  mit jeder Karte und fällt beim Ziehen zurück. Glut zahlt beim Sieg Mark.
- **Gegner:** 46 Charaktere. 25 sitzen in jedem Haus – zwölf Tische, sieben
  Eliten und sechs Bosse, vom Croupier bis zum Stadtrat und zum Pokerprofi.
  Dazu bringt jedes Casino nach dem ersten drei eigene mit: einen Tisch
  (eröffnet das Haus), eine Elite (zweiter Akt) und seinen Boss (letzter Akt).
  Fast alle haben eine Eigenheit, dazu eigene Dialoge, eine Akte und animierte
  Porträts, die auf den Spielverlauf reagieren.
- **Casinos:** Acht Häuser, der Reihe nach zu öffnen (ein Sieg im bisher
  schwersten öffnet das nächste): Zum Goldenen Hahn (3 Akte), Tanzpalast Rialto
  (4), Rote Laterne (4), Dampfer Fortuna (4), Block 9 (5), Grandhotel Imperial
  (5), Spielbank Monopol (5), Das Inferno (6). Das Milieu ist bewusst zeitlos:
  Gangster der Dreißiger sitzen neben Rap-Crew und Streamer. Jedes Haus hat
  eine feste Hausordnung, eine eigene Farbwelt, ein Bild und einen Asche-Faktor
  von ×1 bis ×5 (`ZU.CASINOS` und `ZU.RULES` in `js/data.js`). Wird die Liste
  umsortiert, rechnen `ZU.CASINO_VERSION` und `ZU.CASINO_REMAP` gespeicherte
  Stände um.
- **Run:** Je Akt drei Tische (Gegner, Elite, Boss), dazwischen
  Manfreds Laden mit einem Regal für normale Karten, einem für (seltene,
  teure) Spezialkarten, Trinkets, dem Privileg des Akts, Verbrennen,
  Streichholz und neuer Auslage. Drei Streichhölzer sind die Leben. Nach dem
  letzten Boss des Casinos geht es optional endlos in der Nachglut weiter –
  dort gibt es keine Asche mehr.
- **Deck:** Ein Run beginnt mit 16 zufälligen normalen Karten und den
  Spezialkarten der Schachtel (bei „Klassisch“ und „Zündler“ eine zufällige
  gewöhnliche). Zu Duellbeginn wird das Deck gemischt: 7 Karten kommen auf die
  Hand, der Rest ist der eigene Nachziehstapel. Der Gegner spielt mit einem
  eigenen Blatt (24 Karten des Hauses plus seine Spezialkarten) und zieht nur
  von seinem Stapel. Ist ein Stapel leer, werden nur die eigenen abgelegten
  Karten neu gemischt.
- **Casino-Wahl:** Vor jedem Run wählt man das Haus. Alle sechs sind von Anfang
  an zu sehen, betreten lässt sich nur, was der Reihe nach geöffnet wurde.
- **Freigeschaltet:** Das Hauptmenü zeigt in einem Fenster, was seit dem
  letzten Mal im Hinterzimmer aufgetaucht ist oder sich geöffnet hat; Einträge
  lassen sich einzeln („Gesehen“) oder zusammen („Alle gesehen“) abhaken.
- **Veredeln:** Im Nebenzimmer von Manfreds Laden sitzt die Wahrsagerin Esme.
  Sie verkauft Pakete mit **Siegeln** für normale Karten (Glutsiegel, Zündkopf,
  Goldrand, Widerhaken, Anker, Bumerang, Irrlicht): Einzelsiegel und Doppelpack
  für Karten deiner Wahl, die Wundertüte für drei zufällige. Eine Karte trägt
  höchstens ein Siegel; ein neues ersetzt das alte. Günstige Pakete tragen oft
  einen kleinen **Makel** – früh im Casino häufig, gegen Ende selten. Der Preis
  folgt dem Wert der Siegel (`ZU.SEALS`, `ZU.FLAWS`, `ZU.SEAL_PRICE` in
  `js/data.js`); mindestens ein Paket ist makellos, und wer sich nichts leisten
  kann, bekommt einmal gratis neu ausgelegt. Siegel werden wie alles andere im
  Hinterzimmer entdeckt und gekauft; drei sind von Anfang an dabei.
- **Effekte im Duell:** Jedes Siegel hat einen eigenen Auftritt, wenn die Karte
  gelegt wird (Glutsiegel: Stichflamme, Goldrand: Münzen zur Bank, Widerhaken:
  Spur zum Gegner …), der Reihe nach in der Reihenfolge der Wirkung; Makel
  melden sich kurz in Rot. Auch jedes Trinket hat beim Auslösen eine eigene
  Funkenspur mit eigenen Farben, eigenem Ziel und Klang (`TRINKET_FX` in
  `js/duelview.js`). Die Engine meldet dafür `seal`-, `flaw`- und
  `trinket`-Ereignisse sowie `trig` am Spielereignis.
- **Laden:** Gekaufte Erweiterungen und Rabatte gelten sofort – die Vitrine
  füllt ihren dritten Platz, das Große Regal legt eine Karte aus, der
  Doppelboden zieht schon beim nächsten Kauf.
- **Sperrstunde:** Nach 50 Zügen gewinnt, wer weniger Karten hält.
- **Meta-Progression:** Asche gibt es sofort nach jedem Sieg (1 je Tisch, 2 je
  Elite, 5 je Boss, 8 für das ausgeräumte Casino, mal Asche-Faktor). Im
  Hinterzimmer (Hauptmenü) kauft man damit Schachteln, Trinkets, Spezialkarten
  und fünfzehn Upgrades. Anfangs gibt es eine Schachtel, 25 Trinkets und 6
  Spezialkarten. Alles Weitere ist zunächst **verborgen** („?????“) und taucht
  erst auf, wenn eine Bedingung am Tisch erfüllt ist – etwa „Spiele 10
  Siebenen“ oder „Schlage Madame Rauch“. Manche Stücke zeigen diesen Hinweis
  sofort, manche erst nach einer bestimmten Zahl ausgeräumter Casinos, manche
  nie; dem Spieler wird das nicht verraten. Bedingungen, Hinweise und Zählwerke
  stehen in `js/meta.js` (`REQ`, `FEATS`). Die Kartei zeigt alle besiegten
  Gegner. Ein Klick öffnet ihre **Akte**: drei Einträge je Figur, die sich mit
  der Zahl der Siege über sie öffnen (Tische 1/3/6, Elite 1/3/5, Bosse 1/2/4).
  Die Geschichten greifen ineinander.
- **Konto (freiwillig):** Anmeldung oben rechts im Hauptmenü. Ein Konto sichert
  Runs, Siege, Bestwert und den Meta-Fortschritt auf dem Server. Geworben wird dafür nur am Ende
  eines Runs.

Tasten: `1`–`9` spielt Handkarten, `Leertaste` zieht, `Enter` legt die Auswahl
(bei Mehrfachwahl), `Esc` öffnet das Menü. Der Run wird zwischen den Tischen automatisch im Browser gespeichert.

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/data.js` | Karten, Trinkets, Gegner, Startschachteln (reine Daten) |
| `js/lore.js` | Akten: drei Texte je Figur, in der Kartei nach Zahl der Siege zu lesen |
| `js/engine.js` | Duell-Regeln und Gegner-KI; jede Aktion liefert eine Ereignisliste |
| `js/run.js` | Akte, Auszahlung, Belohnungen, Laden, Speichern |
| `js/meta.js` | Meta-Progression: Asche, Freischaltungen, Upgrades, Einsätze |
| `js/duelview.js` | spielt die Ereignisse als Animationen ab, nimmt Eingaben an |
| `js/cards.js` | Kartenflächen (aus dem Atlas) und gefederte Karten-Sprites |
| `js/title.js` | Titelschriftzug: Pixel-Buchstaben, die ein Streichholz entzündet, mit Pixel-Feuer |
| `js/fx.js` | Bühne, Partikel, Popups, Bildschirmwackeln, Tooltips |
| `js/bg.js` | WebGL-Hintergrund (verpixelter Rauch mit Glutfunken) |
| `js/audio.js` | synthetische Effekte (WebAudio) und Musik |
| `js/screens.js`, `js/main.js` | Menü, Tischwahl, Laden, Dialoge, Ablaufsteuerung |
| `js/account.js` | Anbindung an die Konto-API des Servers |
| `js/legal.js` | Impressum, Datenschutz, Lizenzen samt Betreiberangaben |
| `js/boot.js` | Studio-Vorspann, Ladebildschirm und Übergangsschleier |
| `js/app.js` | Installation als App und Vollbild-Abfrage auf Touch-Geräten |
| `manifest.webmanifest`, `sw.js` | App-Manifest und App-Hülle (Service Worker, speichert nichts zwischen) |

Regeln und Darstellung sind getrennt: `engine.js` und `run.js` laufen ohne DOM
und werden per Simulation getestet.

## Als App und im Vollbild

Zündung lässt sich als App installieren (`manifest.webmanifest`): Sie startet
dann ohne Browserleisten im Vollbild und im Querformat.

- **Handy und Tablet:** Beim Start fragt das Spiel einmal je Besuch, ob es im
  Vollbild laufen soll, und bietet dabei die Installation als App an („Als App
  installieren", „Vollbild", „Nicht jetzt", „Nie fragen"). Auf dem iPhone gibt
  es kein Vollbild im Browser und keine Installation per Knopf; dort erklärt
  der Hinweis den Weg über „Teilen → Zum Home-Bildschirm".
- **Einstellungen:** „Vollbild" schaltet um, „Beim Start" legt auf Touch-Geräten
  fest, ob gefragt wird (Fragen, Immer, Nie), und „Als App" installiert das
  Spiel, sobald der Browser das anbietet – auch am Rechner.
- Die App-Hülle `sw.js` speichert nichts zwischen: Jeder Start lädt den
  aktuellen Stand, ohne Netz erscheint nur ein kurzer Hinweis. Ohne Server
  (Datei per Doppelklick) gibt es keine Installation.

Die App-Symbole erzeugt `python web/tools/make_icons.py` aus `assets/logo.png`.

## Bedienung mit dem Finger

- **Beschreibungen:** Mit der Maus erscheinen sie beim Überfahren. Auf Handy und
  Tablet zeigt **Antippen** sie bei allem, was selbst nichts auslöst (Trinkets,
  Anzeigen, nicht spielbare Karten); bei Handkarten, Knöpfen und Angeboten zeigt
  **Gedrückthalten** sie, ohne etwas auszulösen. Der nächste Tipp schließt sie.
  Was „etwas auslöst", erkennt `js/fx.js` am Zeiger-Cursor (`cursor: pointer`) –
  neue anklickbare Elemente brauchen ihn also.
- **Trinket-Leiste:** Passen die Trinkets nicht mehr in die Kopfleiste, lässt
  sie sich seitlich schieben (Finger oder Mausrad).
- **Hochformat:** Der Tisch ist quer angelegt; im Hochformat erscheint darunter
  der Hinweis, das Handy zu drehen.
- **Hintergrund:** Der bewegte Rauch (`js/bg.js`) lässt sich in den
  Einstellungen ausschalten; dann steht ein ruhiger Verlauf.
- **Musik:** Ist die Seite nicht zu sehen (anderer Tab, App gewechselt,
  Bildschirm aus), halten Musik und Effekte an und setzen danach wieder ein.

## Rechtliches

Impressum, Datenschutz und Lizenzen sind im Spiel unter *Einstellungen →
Rechtliches* erreichbar. Die Betreiberangaben stehen in `js/legal.js`. Die
Datenschutzerklärung beschreibt, was die Software technisch tut, und ist ein
Entwurf – bitte rechtlich prüfen lassen.

## Tests

```bash
node web/tests/sim.js 800
```

Spielt die angegebene Zahl kompletter Runs mit einem Autospieler durch und
prüft Kartenerhaltung, Terminierung, Speichern/Laden und Determinismus. Die
Ausgabe zeigt außerdem die Siegquoten je Gegner als grobe Balance-Übersicht.

Die Tests des Servers laufen mit `node server/test.js`.

```bash
node web/tests/balance.js 1500
```

Misst jedes Trinket und Privileg einzeln (Siegquote und Auszahlung mit und ohne)
sowie einige Synergie-Sets. Danach sind Seltenheit und Preise eingestellt.

## Assets

Herkunft und Aufbereitung stehen in [`assets/ASSETS.md`](assets/ASSETS.md).
Die Werkzeuge liegen unter `tools/`:

- `prepare_assets.py` – verkleinert Projektgrafiken aus `godot/`, stellt
  generierte Greenscreen-Bilder frei und zerlegt die Ausdrucks-Sheets der Gegner
  in Sprite-Streifen.
- `make_font.py` – erzeugt den Pixel-Font aus Bitmap-Definitionen (braucht
  `fontTools`).
- `make_cards.py` – zeichnet den Karten-Atlas `assets/cards/faces.png`: die
  vier Symbolwelten (Herz romantisch, Karo prunkvoll, Pik soldatisch, Kreuz
  gotisch), die Hoffiguren aus `tools/cardart/` und die Rahmen der
  Spezialkarten je Bindung.

- `make_icons.py` – erzeugt die App-Symbole `assets/icons/` aus dem Logo
  (braucht Pillow).
- `stamp_version.py` – setzt die Build-Kennung (siehe unten).

- `music/` – die Musik: Partituren und der Synthesizer, der sie zu MP3 rechnet
  (siehe unten).

### Musik

Menü und Shop haben je ein eigenes Stück, das Spiel eines je Casino – unter
`assets/audio/` (MP3, 128 kbit/s; geladen wird nur, was gerade spielt). Alle
sind nahtlose Schleifen und entstehen vollständig aus dem Repo.

Die Spielmusik ist ein einziges Stück in acht Gewändern (`game-<casino>.mp3`):
gleiche Melodien und Harmonien, aber je Haus eigene Tonart, eigenes Tempo,
Schlagwerk und Klangfarben – Tanzkapelle im Rialto, Boom-Bap in Block 9,
Uhrwerk in der Spielbank und so weiter (siehe `CASINOS` in
`tools/music/scores/game.js`). Zu jedem Haus gibt es die Boss-Stufe
(`game-<casino>-boss.mp3`): gleich lang, gleiches Tempo, aber dichter und
etwas lauter. Beim Boss wechselt `js/audio.js` an Ort und Stelle dorthin: Die
neue Spur steigt stumm an der Stelle ein, an der die alte gerade spielt, und
beide blenden kurz über.

Genauso gehören `shop.mp3` und `shop-esme.mp3` zusammen: In Esmes Nebenzimmer
läuft das Ladenstück weiter, nur entrückt – Harfe, gläserne Glocken, eine
Melodiestimme wie ein Theremin, kaum Schlagwerk.

- `tools/music/scores/*.js` – die Partituren: Akkordfolge, Melodie, Begleitung
  und Mischung je Stück. Die Melodien stammen aus den ursprünglichen Stücken
  (`godot/game/Assets/Audio/`), Tempo, Harmonien und Klang sind neu: weiche
  Synthesizer, E-Piano, Vibraphon, ruhiges Schlagwerk.
- `tools/music/engine.js` – der Synthesizer auf WebAudio (Flächen, E-Piano,
  Melodiestimme, Bass, Zupfer, Vibraphon, Schlagzeug, Hall, Echo, Bandleiern).
- `tools/music/render.mjs` – rechnet die Partituren in einem Chromium ohne
  Fenster und kodiert sie mit ffmpeg auf −16 LUFS (Boss-Stufen −15).
- `tools/music/check.mjs` – prüft die Partituren ohne zu rechnen (Länge,
  Tonumfang, Reibungen zwischen Melodie und Begleitung).

```bash
node web/tools/music/check.mjs
node web/tools/music/render.mjs            # alle Stücke → assets/audio/*.mp3
node web/tools/music/render.mjs game-rialto  # ein Haus samt Boss-Stufe
node web/tools/music/render.mjs --stems --exact game-hahn   # dazu Einzelspuren als WAV nach tools/music/out/
```

Braucht Node, Playwright (mit Chromium) und ffmpeg. Danach
`stamp_version.py` ausführen.

## Ladezeiten und Deployment

- **Vorspann:** Beim ersten Aufruf je Besuch läuft „Vounder Studios“ (`js/boot.js`,
  rund drei Sekunden, per Tipp überspringbar). In dieser Zeit lädt alles, was
  der Titel zeigt. Reicht das nicht, folgt ein Ladebalken.
- **Gestaffeltes Laden:** Danach holt das Spiel im Hintergrund alle übrigen
  Bilder, vier zugleich. Jeder Bildschirm nennt in `game.needs()` die Bilder,
  ohne die er halb leer wäre (Gegner des Akts, eigene Trinkets und
  Spezialkarten, Laden, Esme). Fehlt beim Wechsel noch etwas, legt sich ein
  Schleier darüber; nach 0,45 Sekunden wird daraus der Ladebildschirm mit
  Balken. Nach 12 Sekunden geht es in jedem Fall weiter.
- **Übergang:** Der Start eines Runs zeigt den Schleier immer kurz – das wirkt
  als Übergang und verschafft langsamen Geräten Zeit.

- Alle Bilder werden nach dem Start im Hintergrund vorgeladen, die Gegner des
  laufenden Runs zuerst. Zusammen sind das rund 1,2 MB.
- Jede Adresse von Skripten, Stylesheet, Bildern und Musik trägt eine
  Build-Kennung (`?v=…`). Dadurch dürfen Browser und CDN die Dateien lange
  zwischenspeichern und holen nach einem Update trotzdem sofort die neuen.
- **Vor jedem Deployment** die Kennung neu setzen:

  ```bash
  python web/tools/stamp_version.py
  ```

  Sie ist ein Hash über alle ausgelieferten Dateien und ändert sich nur, wenn
  sich etwas geändert hat. Die sichtbare Versionsnummer (`ZU.VERSION`) bleibt
  davon unberührt.
