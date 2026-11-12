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
- **Trinkets:** 83 Stück mit Synergie-Familien (Zieh-Druck und Flüche,
  Aussetzen, Kette und Glut, Mehrfachwahl, Spezialkarten, Kasse, Schutz). Es
  gibt keine Obergrenze; dafür kostet jedes weitere Trinket im Laden 3 Mark
  mehr. Elf Trinkets sind von Anfang an im Spiel, der Rest wird im Hinterzimmer
  entdeckt und gekauft.
- **Privilegien:** Upgrades, die den ganzen Run gelten und keinen Trinket-Platz
  belegen. Manfred bietet je Akt genau eines an; die Neue Auslage ändert daran
  nichts. In Akt 1 ist es immer „Flinke Finger" – die Mehrfachwahl, mit der man
  mehrere Karten gleichen Werts in einem Zug legt (Schalter rechts am Tisch).
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
- **Gegner:** 35 Charaktere. 20 sitzen in jedem Haus – neun Tische, fünf Eliten
  und sechs Bosse. Dazu bringt jedes Casino nach dem ersten drei eigene mit:
  einen Tisch (eröffnet das Haus), eine Elite (zweiter Akt) und seinen Boss
  (letzter Akt). Fast alle haben eine Eigenheit (z. B. „Ass im Ärmel" oder „Schwere
  Hand"), dazu eigene Dialoge und animierte Porträts, die auf den Spielverlauf
  reagieren.
- **Casinos:** Sechs Häuser, der Reihe nach zu öffnen (ein Sieg im bisher
  schwersten öffnet das nächste): Zum Goldenen Hahn (3 Akte), Tanzpalast Rialto
  (4), Dampfer Fortuna (4), Grandhotel Imperial (5), Spielbank Monopol (5), Das
  Inferno (6). Jedes hat eine feste Hausordnung, die an allen Tischen gilt und
  von Haus zu Haus wächst, und einen Asche-Faktor von ×1 bis ×5
  (`ZU.CASINOS` und `ZU.RULES` in `js/data.js`).
- **Run:** Je Akt drei Tische (Gegner, Elite, Boss), dazwischen
  Manfreds Laden mit einem Regal für normale Karten, einem für (seltene,
  teure) Spezialkarten, Trinkets, dem Privileg des Akts, Verbrennen,
  Streichholz und neuer Auslage. Drei Streichhölzer sind die Leben. Nach dem
  letzten Boss des Casinos geht es optional endlos in der Nachglut weiter –
  dort gibt es keine Asche mehr.
- **Deck:** Zu Duellbeginn zieht man 7 Karten aus dem eigenen Deck; der Rest
  wandert in den gemeinsamen Nachziehstapel.
- **Sperrstunde:** Nach 50 Zügen gewinnt, wer weniger Karten hält.
- **Meta-Progression:** Asche gibt es sofort nach jedem Sieg (1 je Tisch, 2 je
  Elite, 5 je Boss, 8 für das ausgeräumte Casino, mal Asche-Faktor). Im
  Hinterzimmer (Hauptmenü) kauft man damit Schachteln, Trinkets, Spezialkarten
  und zwölf Upgrades. Anfangs gibt es eine Schachtel, 11 Trinkets und 6
  Spezialkarten. Alles Weitere ist zunächst **verborgen** („?????“) und taucht
  erst auf, wenn eine Bedingung am Tisch erfüllt ist – etwa „Spiele 10
  Siebenen“ oder „Schlage Madame Rauch“. Manche Stücke zeigen diesen Hinweis
  sofort, manche erst nach einer bestimmten Zahl ausgeräumter Casinos, manche
  nie; dem Spieler wird das nicht verraten. Bedingungen, Hinweise und Zählwerke
  stehen in `js/meta.js` (`REQ`, `FEATS`). Die Kartei zeigt alle besiegten
  Gegner.
- **Konto (freiwillig):** Anmeldung oben rechts im Hauptmenü. Ein Konto sichert
  Runs, Siege, Bestwert und den Meta-Fortschritt auf dem Server. Geworben wird dafür nur am Ende
  eines Runs.

Tasten: `1`–`9` spielt Handkarten, `Leertaste` zieht, `Enter` legt die Auswahl
(bei Mehrfachwahl), `Esc` öffnet das Menü. Der Run wird zwischen den Tischen automatisch im Browser gespeichert.

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/data.js` | Karten, Trinkets, Gegner, Startschachteln (reine Daten) |
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
  generierte Greenscreen-Bilder frei, zerlegt die Ausdrucks-Sheets der Gegner
  in Sprite-Streifen und rechnet die Musik herunter.
- `make_font.py` – erzeugt den Pixel-Font aus Bitmap-Definitionen (braucht
  `fontTools`).
- `make_cards.py` – zeichnet den Karten-Atlas `assets/cards/faces.png`: die
  vier Symbolwelten (Herz romantisch, Karo prunkvoll, Pik soldatisch, Kreuz
  gotisch), die Hoffiguren aus `tools/cardart/` und die Rahmen der
  Spezialkarten je Bindung.

- `make_icons.py` – erzeugt die App-Symbole `assets/icons/` aus dem Logo
  (braucht Pillow).
- `stamp_version.py` – setzt die Build-Kennung (siehe unten).

Die Musik liegt als MP3 vor (zusammen rund 7,5 MB); zum Kodieren braucht
`prepare_assets.py --audio` das Python-Paket `lameenc`.

## Ladezeiten und Deployment

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
