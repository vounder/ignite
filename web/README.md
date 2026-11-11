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
  passende Handkarte spielt sie sofort. Die 7 lässt den Gegner 2 Karten ziehen
  und aussetzen.
- **Mehrfachwahl:** Das Trinket „Flinke Finger“ schaltet das Legen mehrerer
  Karten mit gleichem Wert frei. Danach lässt sich die Mehrfachwahl rechts am
  Tisch an- und ausschalten. Der erste Laden eines Runs führt es immer.
- **Spezialkarten** (elf Stück, von Stillstand bis Zytokinese II) sind Joker
  mit Effekt.
- **Glut:** Jede gespielte Karte bringt Kartenwert × Kette. Die Kette wächst
  mit jeder Karte und fällt beim Ziehen zurück. Glut zahlt beim Sieg Mark.
- **Gegner:** 20 Charaktere – neun Tische, fünf Eliten und sechs Bosse (zwei je
  Akt) – mit eigenen Passiven, Dialogen und animierten Porträts, die auf den
  Spielverlauf reagieren.
- **Run:** Drei Akte mit je drei Tischen (Gegner, Elite, Boss), dazwischen
  Manfreds Laden mit Karten, 18 Trinkets, Verbrennen, Streichholz und neuer
  Auslage. Drei Streichhölzer sind die Leben. Nach dem dritten Boss geht es
  optional endlos in der Nachglut weiter.
- **Deck:** Zu Duellbeginn zieht man 7 Karten aus dem eigenen Deck; der Rest
  wandert in den gemeinsamen Nachziehstapel.
- **Sperrstunde:** Nach 50 Zügen gewinnt, wer weniger Karten hält.
- **Konto (freiwillig):** Anmeldung oben rechts im Hauptmenü. Ein Konto sichert
  Runs, Siege und Bestwert auf dem Server. Geworben wird dafür nur am Ende
  eines Runs.

Tasten: `1`–`9` spielt Handkarten, `Leertaste` zieht, `Enter` legt die Auswahl
(bei Mehrfachwahl), `Esc` öffnet das Menü. Der Run wird zwischen den Tischen automatisch im Browser gespeichert.

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
| `js/account.js` | Anbindung an die Konto-API des Servers |
| `js/legal.js` | Impressum, Datenschutz, Lizenzen (Betreiberangaben dort eintragen) |

Regeln und Darstellung sind getrennt: `engine.js` und `run.js` laufen ohne DOM
und werden per Simulation getestet.

## Rechtliches

Impressum, Datenschutz und Lizenzen sind im Spiel unter *Einstellungen →
Rechtliches* erreichbar. Die Betreiberangaben stehen als Platzhalter in
`js/legal.js` und müssen vor der Veröffentlichung ausgefüllt werden. Die
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

## Assets

Herkunft und Aufbereitung stehen in [`assets/ASSETS.md`](assets/ASSETS.md).
Die Werkzeuge liegen unter `tools/`:

- `prepare_assets.py` – verkleinert Projektgrafiken aus `godot/`, stellt
  generierte Greenscreen-Bilder frei, zerlegt die Ausdrucks-Sheets der Gegner
  in Sprite-Streifen und rechnet die Musik herunter.
- `make_font.py` – erzeugt den Pixel-Font aus Bitmap-Definitionen (braucht
  `fontTools`).

Die Musik liegt als 24-kHz-Mono-WAV vor (zusammen rund 26 MB). Für eine
Veröffentlichung im Netz lohnt sich die Umwandlung nach OGG oder MP3; in
`js/audio.js` muss dann nur die Dateiendung angepasst werden.
