# Zündung – Browser-Version

Kompletter Neubau des Mau-Mau-Roguelites für den Browser: reines HTML, CSS und
JavaScript ohne Build-Schritt und ohne Abhängigkeiten.

## Starten

`web/index.html` per Doppelklick öffnen – fertig. Alternativ über einen
beliebigen statischen Server:

```bash
python -m http.server 8377 --directory web
```

Danach <http://localhost:8377> aufrufen.

## Spielprinzip

- **Duell:** Mau-Mau gegen den Dealer. Gelegt wird auf gleiche Farbe oder
  gleichen Wert; wer zuerst keine Karten mehr hat, gewinnt.
- **Kette:** Mehrere Karten mit gleichem Wert dürfen in einem Zug gelegt
  werden. Die 7 lässt den Gegner 2 Karten ziehen und aussetzen.
- **Spezialkarten** (elf Stück, von Stillstand bis Zytokinese II) sind Joker
  mit Effekt.
- **Glut:** Jede gespielte Karte bringt Kartenwert × Kette. Die Kette wächst
  mit jeder Karte und fällt beim Ziehen zurück. Glut zahlt beim Sieg Mark.
- **Run:** Drei Akte mit je drei Tischen (Gegner, Elite, Boss), dazwischen
  Manfreds Laden mit Karten, 17 Trinkets, Verbrennen, Streichholz und neuer
  Auslage. Drei Streichhölzer sind die Leben. Nach dem dritten Boss geht es
  optional endlos in der Nachglut weiter.
- **Deck:** Zu Duellbeginn zieht man 7 Karten aus dem eigenen Deck; der Rest
  wandert in den gemeinsamen Nachziehstapel.
- **Sperrstunde:** Nach 50 Zügen gewinnt, wer weniger Karten hält.

Tasten: `Enter` legt, `Leertaste` zieht, `1`–`9` wählt Handkarten, `Esc` öffnet
das Menü. Der Run wird zwischen den Tischen automatisch im Browser gespeichert.

## Aufbau

| Datei | Inhalt |
|---|---|
| `js/data.js` | Karten, Trinkets, Gegner, Startschachteln (reine Daten) |
| `js/engine.js` | Duell-Regeln und Gegner-KI; jede Aktion liefert eine Ereignisliste |
| `js/run.js` | Akte, Auszahlung, Belohnungen, Laden, Speichern |
| `js/duelview.js` | spielt die Ereignisse als Animationen ab, nimmt Eingaben an |
| `js/cards.js` | Kartenflächen und gefederte Karten-Sprites |
| `js/fx.js` | Bühne, Partikel, Popups, Bildschirmwackeln, Tooltips |
| `js/bg.js` | WebGL-Hintergrund (verpixelter Rauch mit Glutfunken) |
| `js/audio.js` | synthetische Effekte (WebAudio) und Musik |
| `js/screens.js`, `js/main.js` | Menü, Tischwahl, Laden, Dialoge, Ablaufsteuerung |

Regeln und Darstellung sind getrennt: `engine.js` und `run.js` laufen ohne DOM
und werden per Simulation getestet.

## Tests

```bash
node web/tests/sim.js 800
```

Spielt die angegebene Zahl kompletter Runs mit einem Autospieler durch und
prüft Kartenerhaltung, Terminierung, Speichern/Laden und Determinismus. Die
Ausgabe zeigt außerdem die Siegquoten je Gegner als grobe Balance-Übersicht.

## Assets

Herkunft und Aufbereitung stehen in [`assets/ASSETS.md`](assets/ASSETS.md).
Die Werkzeuge liegen unter `tools/`:

- `prepare_assets.py` – verkleinert Projektgrafiken aus `godot/`, stellt
  generierte Greenscreen-Bilder frei und rechnet die Musik herunter.
- `make_font.py` – erzeugt den Pixel-Font aus Bitmap-Definitionen (braucht
  `fontTools`).

Die Musik liegt als 24-kHz-Mono-WAV vor (zusammen rund 26 MB). Für eine
Veröffentlichung im Netz lohnt sich die Umwandlung nach OGG oder MP3; in
`js/audio.js` muss dann nur die Dateiendung angepasst werden.
