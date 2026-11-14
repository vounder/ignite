# Zündung – Server

Kleiner Node-Server ohne Abhängigkeiten. Er liefert das Spiel aus `web/` aus und
stellt unter `/api` die Konten bereit (Registrierung, Anmeldung, Statistik,
Passwort zurücksetzen, Konto löschen).

## Voraussetzungen

- Node.js 22.13 oder neuer (nutzt das eingebaute SQLite)

## Starten

```bash
node --env-file-if-exists=server/.env server/server.js
```

Ohne Konfiguration läuft der Server auf <http://127.0.0.1:8377>. Die Datenbank
liegt in `server/data/zuendung.sqlite` und wird beim ersten Start angelegt.

## Konfiguration

`server/.env.example` nach `server/.env` kopieren und anpassen:

| Variable | Bedeutung |
|---|---|
| `HOST`, `PORT` | Adresse und Port, auf denen der Server lauscht |
| `PUBLIC_URL` | öffentliche Adresse des Spiels, für die Links in der Reset-Mail |
| `TRUST_PROXY` | `1`, wenn Cloudflare oder ein Reverse Proxy davor sitzt |
| `DATA_DIR` | Ablageort der Datenbank |
| `APP_DIR` | Ordner mit der Android-App (`android.json` und die APK), ausgeliefert unter `/app/`; leer = kein Download |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Mailversand für „Passwort vergessen“ |

Ohne `SMTP_HOST` und `PUBLIC_URL` werden keine Mails verschickt; der Reset-Link
erscheint dann nur im Protokoll des Servers.

## Betrieb hinter Cloudflare

1. Den Server dauerhaft laufen lassen (systemd, pm2 oder Ähnliches).
2. Den bisherigen statischen Auslieferungsweg durch diesen Server ersetzen, etwa
   per Cloudflare Tunnel oder Reverse Proxy auf `127.0.0.1:8377`.
3. `TRUST_PROXY=1` setzen, damit Besucher-IP und HTTPS korrekt erkannt werden
   (Sitzungs-Cookie mit `Secure`, Versuchsbegrenzung je Besucher).
4. `server/data/` regelmäßig sichern – dort liegen alle Konten.

## Caching

Adressen mit Build-Kennung (`?v=…`) werden mit `Cache-Control: public,
max-age=31536000, immutable` ausgeliefert, alles andere mit `no-cache`. Die
Kennung setzt `python web/tools/stamp_version.py` vor dem Deployment.

## Offline-App und Android-App

- `/files.json` nennt jede Datei des Spiels mit SHA-256 und Größe sowie eine
  Kennung der ganzen Fassung (`filelist.js`). Der Server errechnet die Liste
  aus `web/`; die Offline-Web-App und die Android-App erkennen daran neue
  Fassungen und laden nur, was sich geändert hat.
- `/app/` liefert den Inhalt von `APP_DIR` aus: `android.json` (Version, Datei,
  Größe, SHA-256) und die APK. Beides erzeugt `android/release.sh`. Der Ordner
  liegt außerhalb von `web/`, damit die App nicht mit jedem Spiel-Release neu
  hochgeladen werden muss.
- `POST /api/run` nimmt eine Kennung `id` an; dieselbe Meldung zählt dann nur
  einmal (Nachreichen nach einer Zeit ohne Netz).

## Was gespeichert wird

Je Konto: Name, E-Mail-Adresse, Passwort als scrypt-Hash, Registrierungszeit und
die Statistik (Runs, Siege, Bestwert, höchster Akt) sowie der Meta-Fortschritt
(Asche, Freischaltungen, Upgrades, Einsätze, besiegte Gegner) als JSON. Sitzungen und Reset-Links
werden nur als Hash abgelegt. Zu gemeldeten Runs bleibt 90 Tage lang deren
zufällige Kennung liegen. Der Server schreibt keine Zugriffsprotokolle.

## Tests

```bash
node server/test.js
```

Startet den Server mit einer temporären Datenbank und einem Test-Mailempfänger
und prüft alle Abläufe sowie den Schutz der statischen Auslieferung.
