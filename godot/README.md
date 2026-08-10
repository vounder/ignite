# Zündung – Godot-4.6-.NET-Neubau

## V2: vollständiger Casino-Roguelike-Run

Der aktive Einstiegspunkt ist V2. Er bietet drei Akte mit einer verzweigten
`4×3 + Boss`-Karte und anschließend optionaler **Nachglut** im Endlosmodus.
Jeder Run hat drei Streichhölzer, ein persönliches Deck, bis zu fünf Trinkets,
Kämpfe, Eliten, Shops, Lounges, vier Ereignisse und drei Bosse.

Zu Beginn besitzt der Run genau **sieben zufällige Karten** aus dem normalen
32er Blatt (7 bis Ass in vier Farben); diese sieben Karten bilden auch das
Eröffnungsblatt. Die übrigen Standardkarten stehen im Kampf als Dealer-Reserve
zum Ziehen bereit. Die normale Acht ist neutral. **Stillstand** ist eine
eigenständige wilde Aussetzen-Karte; damit
bleiben Regel, Name und Gestaltung klar eigenständig. Alle elf Spezialkarten
funktionieren: Stillstand, Addieren, Spion, Fluch, HODL, Zytokinese, Tausch,
Bonusgeld, Opfer, Zocken und Zytokinese II. Opfer und Zocken verlangen eine
explizite Kartenwahl.

Run-Saves liegen als strikt validiertes V2-Format unter `user://run-v2.json`;
Profile werden getrennt unter `user://profile-v1.json` gespeichert. Beide
nutzen atomisches Schreiben und `.bak`-Recovery. Ein vorhandener V1-Run kann
über das Hauptmenü als frischer, gültiger V2-Run importiert werden.

Die Präsentation rendert intern bei 640×360 und skaliert ganzzahlig auf
1280×720 bzw. 1920×1080. Standardkarten stammen aus dem Kenney-CC0-Pack;
Spezialmotive wurden eigens als transparente Pixelart erzeugt. Die Farbwelt
verwendet dunkles Walnussholz, Flaschengrün, Elfenbein, Burgunder, Messing und
Glutorange.

Der Neubau lebt parallel zur Java-Regelreferenz in `src/` und bildet den
vollständigen Run ab:

`Menü → sieben Karten → Raumwahl → Begegnung/Ereignis → Belohnung/Manfred/Lounge → Boss → nächster Akt → Nachglut`

## Architektur

- `src/Zuendung.Domain/V2`: Godot-unabhängige, deterministische Run-Regeln.
  `RunSessionV2.Handle(RunActionV2)` verändert den Zustand und liefert
  geordnete `RunEventV2`s. Benannte PCG32-Streams, Karten-IDs und die gesamte
  Run-Karte sind vollständig speicherbar.
- `src/Zuendung.Persistence`: strikt validierte V2-Runs, getrennte Profile,
  atomischer Austausch, Backup-Recovery und ein sicherer V1-Importer.
  Beschädigte Primär- und Backup-Dateien werden nie automatisch überschrieben.
- `game`: Godot-Kompositionswurzel, typisierte `.tres`-Inhalte und reine
  Präsentation. Animationen sperren Eingaben, führen aber keine Regeln aus.
- `tests`: xUnit-Abdeckung für Regeln, Determinismus und Persistenz.

Jede Seite besitzt ein persönliches Deck mit eigenem Zieh- und Ablagestapel.
Die Ablage wird ohne oberste Karte neu gemischt; eine leere Hand entscheidet
die Begegnung. Besitz, Statusreihenfolge und Spezialeffekte sind durch
deterministische Tests fixiert.

## Voraussetzungen

- .NET SDK 8
- Godot 4.6.3 .NET (neuere kompatible 4.6-Patchversionen sind zulässig)
- Für Windows-Exporte: passende Godot-4.6.3-.NET-Export-Templates

## Bauen und prüfen

```powershell
dotnet test .\tests\Zuendung.Domain.Tests\Zuendung.Domain.Tests.csproj -c Release
dotnet test .\tests\Zuendung.Persistence.Tests\Zuendung.Persistence.Tests.csproj -c Release
dotnet build .\game\Zuendung.Game.csproj -c Release

# Godot-Szenen- und kompletter V2-Run-Loop-Smoke-Test
godot --headless --path .\game -- --smoke-test

# Windows-x64-Release
godot --headless --path .\game --export-release "Windows Desktop" ..\builds\windows\Zuendung.exe
```

Ein erfolgreicher Smoke-Test schreibt `ZUENDUNG_V2_SMOKE_OK`. Der optionale
`--perf-test` misst nach 60 Warmup-Frames 600 Frames und gibt die p95-Framezeit
aus.

## Präsentation und Bedienung

Die Darstellung ist bewusst eigenständig: eine edle Pixel-Casino-Farbwelt,
ein zentrierter Tisch mit gefächertem Siebener-Blatt, eine reduzierte Auswahl
aus höchstens zwei physischen Raumeinladungen und Manfreds animierter Laden.
Raum, Tisch, Figuren, Requisiten, Karten und Vordergrund werden als getrennte
2.5D-Ebenen gerendert. Manfred atmet, blinzelt, reibt im Leerlauf die Hände und
wechselt bei Käufen, Rerolls, Verbrennen und Ablehnung seine Pose. Automat,
Aschenbecher, Streichholz und Ladenglocke besitzen eigene kurze Animationen.
Alle Spezialkarten haben eigene Effektsymbole und ein kurzes Erklärungs-Overlay
mit Wirkung und hervorgehobenem Zielbereich. Beim Überfahren einer sichtbaren
Karte erscheint ein fester, kontrastreicher Karten-Inspektor statt des kleinen
System-Tooltips. Normale Karten zeigen keinen großen Mittentext.

Die drei Legacy-Musikstücke für Menü, Spiel und Shop sind wieder eingebunden.
`Esc` öffnet das Pause-/Beenden-Menü. In den Einstellungen lassen sich Musik,
Effekte, Vollbild und Animationstempo (`×0,5`, `×0,75`, `×1`, `×1,5`, `×2`)
anpassen. Das Standardtempo ist `×1`; alte implizite `×2`-Einstellungen werden
einmalig auf das ruhigere Standardtempo migriert.
Leertaste zieht eine Karte, `Strg+S` speichert.

Das Layout basiert auf einem 640×360-Viewport und skaliert auf 16:9. Die
zentralen Spielobjekte nutzen bewusst feste Tischkoordinaten, damit Stapel,
Ablage, Handfächer und Shop-Requisiten wie eine zusammenhängende Szene wirken.

## Qualitätssicherung

Der automatisierte Headless-Test validiert Content, Szenenstart, einen kompletten
Drei-Akt-Lauf mit allen drei Bossen, Save/Load und den Eintritt in die Nachglut.
Domain- und Persistenztests decken unter anderem alle elf Spezialkarten,
Determinismus, Pfadregeln, Rundengrenzen, Backups und Migration ab.
`--perf-test` prüft zusätzlich die p95-Framezeit; vor einer Veröffentlichung
sollte diese Messung nochmals auf der vorgesehenen Mindesthardware erfolgen.
