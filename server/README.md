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

## Was gespeichert wird

Je Konto: Name, E-Mail-Adresse, Passwort als scrypt-Hash, Registrierungszeit und
die Statistik (Runs, Siege, Bestwert, höchster Akt). Sitzungen und Reset-Links
werden nur als Hash abgelegt. Der Server schreibt keine Zugriffsprotokolle.

## Tests

```bash
node server/test.js
```

Startet den Server mit einer temporären Datenbank und einem Test-Mailempfänger
und prüft alle Abläufe sowie den Schutz der statischen Auslieferung.
