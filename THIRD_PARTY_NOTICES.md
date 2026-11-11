# Drittanbieter und Asset-Herkunft

## Godot-Neubau unter `godot/`

- Engine: Godot Engine 4.6.x, MIT-Lizenz. Der erforderliche Godot-Lizenztext
  wird bei einem Export durch die Engine mitgeführt.
- Die Standardkarten unter `godot/game/Assets/Cards/Kenney/` stammen aus dem
  Kenney Playing Cards Pack und stehen laut mitgelieferter `License.txt` unter
  CC0 1.0. Die Godot-Kopie enthält denselben Lizenztext.
- Die elf Spezialkarten-Illustrationen unter
  `godot/game/Assets/Cards/Special/` wurden mit OpenAI Image Generation speziell
  für dieses Projekt erzeugt. Prompts, Quellen und Nachbearbeitung sind im
  dortigen `ASSET_MANIFEST.md` dokumentiert.
- Die neuen Art-Direction-Bilder unter `godot/docs/art-direction/` wurden mit
  OpenAI Image Generation für dieses Projekt erzeugt. Sie dienen als Konzept
  und werden nicht als unzerlegter Spielbildschirm verwendet.
- Auf ausdrücklichen Wunsch und nach Herkunftsbestätigung des Projektinhabers
  wurden ausgewählte Legacy-Dateien aus `misc/` wieder in den Godot-Build
  aufgenommen: Casino-Raum, Zündung-Logo, Manfred-Posen, Pixel-Font sowie
  Menü-, Spiel- und Shop-Musik. Auch diese Dateien wurden für das Projekt mit
  generativen Werkzeugen erzeugt; sie sind keine übernommenen Fremdassets.
- Zusätzliche Tisch-, Wege-, Shop- und Effektgrafik entsteht zur Laufzeit aus
  eigenem C#-Zeichencode und den getrennten Bildebenen der genannten Assets.
- NuGet-Testwerkzeuge (`xunit`, `xunit.runner.visualstudio`,
  `Microsoft.NET.Test.Sdk`) werden nur für Entwicklung und Tests verwendet.

## Browser-Version unter `web/`

- Keine Laufzeit-Abhängigkeiten: reines HTML, CSS und JavaScript.
- Spezialkarten-Illustrationen, Manfred-Posen, Logo und Musik stammen aus den
  oben genannten Projekt-Assets und wurden nur verkleinert bzw. heruntergerechnet.
- Die Gegnerporträts unter `web/assets/enemies/` und die Trinket-Icons unter
  `web/assets/trinkets/` wurden mit OpenAI Image Generation (über die Codex-CLI)
  speziell für dieses Projekt erzeugt. Prompts und Nachbearbeitung sind in
  `web/assets/ASSETS.md` dokumentiert.
- Der Pixel-Font `web/assets/fonts/zuendung_pixel.ttf` ist eine Eigenentwicklung
  und wird von `web/tools/make_font.py` erzeugt; `fontTools` (MIT) wird nur als
  Entwicklungswerkzeug dafür benötigt.

## Bestehende Java-Assets

- `src/de/drvbund/jauns/assets/kenney_playing-cards-pack/` stammt von Kenney
  und ist laut der dort enthaltenen `License.txt` unter CC0 1.0 freigegeben.
- Die Dateien unter `src/de/drvbund/jauns/assets/misc/` (PNG, GIF, TTF und WAV)
  wurden laut Herkunftsbestätigung des Projektinhabers ebenfalls speziell für
  Zündung mit generativen Werkzeugen erzeugt. Ausgewählte Dateien werden im
  Godot-Build weiterverwendet.

Vor einer Veröffentlichung ist diese Datei für jedes neu aufgenommene Asset
zu aktualisieren.
