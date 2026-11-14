# Zündung – Android-App

Die Browser-Version aus [`../web`](../web) als App: Das ganze Spiel steckt in
der APK und startet ohne Internet. Neue Fassungen des Spiels holt die App vom
Server, ohne dass eine neue APK nötig wäre. Verteilt wird sie über die eigene
Seite (kein Play Store).

## Wie es funktioniert

- Eine WebView im Vollbild zeigt das Spiel unter seiner echten Adresse
  (`https://ignite.vounder.net/`). Die Dateien dazu kommen aber aus der App,
  nicht aus dem Netz (`MainActivity`, `shouldInterceptRequest`). Spielstand
  und Anmeldung hängen dadurch an derselben Adresse wie im Browser; nur die
  Konto-API (`/api/`) und der App-Download (`/app/`) gehen ans Netz.
- **Mitgebracht:** Beim Bauen wandert `web/` (ohne `tools/`, `tests/`, `sw.js`)
  nach `assets/web`, dazu die Dateiliste `assets/files.json`
  (`server/filelist.js`: SHA-256 je Datei und eine Kennung der Fassung).
- **Updates des Spiels** (`Updater`, `WebStore`): Die App fragt
  `/files.json` ab. Nennt der Server eine andere Fassung, lädt sie nur die
  Dateien, die sich von den mitgebrachten und den schon geladenen
  unterscheiden, prüft jede gegen ihre SHA-256 und legt sie im App-Speicher ab
  (`files/web/b-<Kennung>/`). Vollständig geladen, wartet die Fassung auf den
  nächsten Start der Seite; mittendrin wechselt nichts. Anzeige und Auslöser
  sitzen im Spiel (`web/js/offline.js`): beim Start der Ladebildschirm „Neue
  Fassung wird geladen …“, sonst der Hinweis im Hauptmenü.
- **Ohne Netz** läuft die zuletzt geladene Fassung. Was das fürs Konto heißt,
  steht in [`../web/README.md`](../web/README.md) („Offline spielen und
  Updates“).
- **Updates der App selbst** sind nur nötig, wenn sich dieser Ordner ändert.
  Die App vergleicht ihre `versionCode` mit `/app/android.json`; ist dort eine
  höhere, erscheinen im Hauptmenü und in den Einstellungen „Neue App-Version“
  mit dem Download. Eine neu installierte APK bringt das dann aktuelle Spiel
  mit und verwirft, was die alte nachgeladen hatte.
- Die Brücke zur Seite heißt `window.ZuendungApp` (`info`, `check`, `apply`,
  `open`). „Zurück“ schließt Dialoge, pausiert den Run oder führt ins
  Hauptmenü; dort legt sich die App in den Hintergrund.

## Bauen

Voraussetzungen: JDK 17 oder neuer, Android SDK (Plattform 36), Node (für die
Dateiliste). `local.properties` mit `sdk.dir=…` anlegen oder `ANDROID_HOME`
setzen.

```bash
cd android
./gradlew assembleDebug                                  # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleDebug -PgameUrl=http://10.0.2.2:8377   # gegen einen lokalen Server (Emulator)
```

`-PgameUrl` richtet die App auf einen anderen Server; ohne https geht das nur
im Debug-Build. Debug-Builds lassen sich über `chrome://inspect` untersuchen.

## Release

Die App wird mit einem eigenen Schlüssel signiert. **Er darf nie verloren
gehen:** Android installiert ein Update nur über eine App mit derselben
Signatur; mit einem neuen Schlüssel müssten alle die App löschen und neu
laden. Der Schlüssel liegt nie im Repository, sondern kommt über die Umgebung:
`ZUENDUNG_KEYSTORE`, `ZUENDUNG_KEYSTORE_PASSWORD`, optional `ZUENDUNG_KEY_ALIAS`
(Standard `zuendung`) und `ZUENDUNG_KEY_PASSWORD`.

1. Bei Änderungen an der App `versionCode` (immer +1) und `versionName` in
   `app/build.gradle.kts` erhöhen. Für ein reines Spiel-Update ist kein neues
   App-Release nötig.
2. Vom Stand bauen, der live ist oder gleich live geht – die APK bringt genau
   dieses Spiel mit:

   ```bash
   . /pfad/zu/keystore.env
   android/release.sh            # → android/build/release/zuendung-<Version>.apk und android.json
   ```

3. Beide Dateien in den `APP_DIR` des Servers legen (siehe
   [`../server/README.md`](../server/README.md)), die APK zuerst, `android.json`
   zuletzt: Sie schaltet den Download im Spiel frei und meldet installierten
   Apps die neue Version. Alte APKs dürfen liegen bleiben. Eine veröffentlichte
   APK nie unter demselben Namen ersetzen: Cloudflare hält sie stundenlang vor.
   Jede neue APK bekommt eine neue Version und damit einen neuen Dateinamen.

Wer die App zum ersten Mal lädt, muss dem Browser einmal erlauben, Apps zu
installieren („unbekannte Quellen“); Android fragt von selbst danach.

## Prüfen

Im Emulator mit einem Debug-Build gegen einen lokalen Server
(`node server/server.js`, erreichbar als `10.0.2.2`):

- Start mit laufendem Server, dann Server beenden und die App neu starten: Das
  Spiel muss vollständig erscheinen (`ZU.offline.label()` → „Bereit“).
- Eine Datei unter `WEB_ROOT` ändern und die App neu starten: Der
  Ladebildschirm erscheint, danach läuft die neue Fassung;
  `adb shell run-as net.vounder.zuendung find files/web` zeigt nur die
  geänderten Dateien.
- Musik: `fetch(…mp3, { headers: { Range: 'bytes=100-199' } })` muss genau
  diese 100 Bytes liefern. Die WebView überspringt den Anfang eines Stücks
  selbst, begrenzt aber das Ende nicht – deshalb kappt `MainActivity.Head` den
  Strom.
