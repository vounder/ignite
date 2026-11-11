'use strict';
/* Tests für den Server: Konten, Sitzungen, Statistik, Zurücksetzen, statische Dateien.
   Aufruf: node server/test.js */
const assert = require('node:assert');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('./server');

/* Kleiner SMTP-Empfänger, der die zugestellten Mails sammelt (ohne TLS, nur für den Test). */
function fakeSmtp() {
  const mails = [];
  const server = net.createServer(socket => {
    let buffer = '', inData = false, mail = { to: '', data: '' };
    socket.write('220 test ESMTP\r\n');
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8');
      let index;
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === '.') { inData = false; mails.push(mail); mail = { to: '', data: '' }; socket.write('250 ok\r\n'); }
          else mail.data += line.replace(/^\.\./, '.') + '\n';
        } else if (/^EHLO/i.test(line)) socket.write('250-test\r\n250 AUTH PLAIN\r\n');
        else if (/^AUTH PLAIN/i.test(line)) { mail.auth = Buffer.from(line.slice(11), 'base64').toString('utf8'); socket.write('235 ok\r\n'); }
        else if (/^MAIL FROM/i.test(line)) socket.write('250 ok\r\n');
        else if (/^RCPT TO/i.test(line)) { mail.to = line.slice(9, -1); socket.write('250 ok\r\n'); }
        else if (/^DATA/i.test(line)) { inData = true; socket.write('354 go\r\n'); }
        else if (/^QUIT/i.test(line)) { socket.write('221 bye\r\n'); socket.end(); }
        else socket.write('500 unknown\r\n');
      }
    });
    socket.on('error', () => {});
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, mails, port: server.address().port })));
}

function client(base) {
  let cookie = '';
  return async function call(method, url, body, headers) {
    const response = await fetch(base + url, {
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { Cookie: cookie } : {}, headers || {}),
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
      redirect: 'manual'
    });
    const set = response.headers.get('set-cookie');
    if (set) cookie = /Max-Age=0/.test(set) ? '' : set.split(';')[0];
    let data = null;
    const text = await response.text();
    try { data = JSON.parse(text); } catch (error) { data = text; }
    return { status: response.status, data, headers: response.headers, setCookie: set };
  };
}

async function waitFor(check, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (check()) return true;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return false;
}

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zuendung-test-'));
  const smtp = await fakeSmtp();
  const app = createApp({
    port: 0, host: '127.0.0.1', dataDir, quiet: true, publicUrl: 'https://spiel.example',
    smtp: { host: '127.0.0.1', port: smtp.port, secure: 'none', user: 'mailer', pass: 'geheim', from: 'noreply@spiel.example' }
  });
  const address = await app.listen();
  const base = 'http://127.0.0.1:' + address.port;
  const a = client(base), b = client(base), anon = client(base);
  let r;

  // --- statische Dateien ---
  r = await anon('GET', '/');
  assert.strictEqual(r.status, 200);
  assert.match(r.data, /<title>Zündung<\/title>/);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.strictEqual((await anon('GET', '/js/engine.js')).status, 200);
  assert.strictEqual((await anon('GET', '/tools/prepare_assets.py')).status, 404, 'Werkzeuge sind nicht öffentlich');
  assert.strictEqual((await anon('GET', '/tests/sim.js')).status, 404);
  assert.strictEqual((await anon('GET', '/..%2fserver%2fserver.js')).status, 404, 'kein Ausbruch aus web/');
  assert.strictEqual((await anon('GET', '/%2e%2e/server/server.js')).status, 404);
  assert.strictEqual((await anon('GET', '/gibt-es-nicht.png')).status, 404);
  const etag = (await anon('GET', '/css/style.css')).headers.get('etag');
  assert.strictEqual((await anon('GET', '/css/style.css', undefined, { 'If-None-Match': etag })).status, 304);
  const ranged = await fetch(base + '/assets/audio/shop.mp3', { headers: { Range: 'bytes=0-99' } });
  assert.strictEqual(ranged.status, 206);
  assert.strictEqual((await ranged.arrayBuffer()).byteLength, 100);
  assert.strictEqual((await anon('POST', '/index.html', {})).status, 405);
  assert.strictEqual((await anon('GET', '/css/style.css')).headers.get('cache-control'), 'no-cache');
  assert.match((await anon('GET', '/assets/logo.png?v=abc123')).headers.get('cache-control'), /max-age=31536000, immutable/, 'versionierte Adressen werden dauerhaft gecacht');

  // --- ohne Anmeldung ---
  assert.strictEqual((await anon('GET', '/api/me')).status, 401);
  assert.strictEqual((await anon('POST', '/api/run', { won: true, score: 5 })).status, 401);
  assert.strictEqual((await anon('GET', '/api/gibt-es-nicht')).status, 404);

  // --- Registrierung: Eingaben prüfen ---
  assert.strictEqual((await a('POST', '/api/register', { username: 'ab', password: 'langgenug1', email: 'a@b.de' })).data.error, 'bad_name');
  assert.strictEqual((await a('POST', '/api/register', { username: 'mit leer', password: 'langgenug1', email: 'a@b.de' })).data.error, 'bad_name');
  assert.strictEqual((await a('POST', '/api/register', { username: 'Zuendler', password: 'kurz', email: 'a@b.de' })).data.error, 'bad_password');
  assert.strictEqual((await a('POST', '/api/register', { username: 'Zuendler', password: 'langgenug1', email: 'keine-mail' })).data.error, 'bad_email');
  assert.strictEqual((await a('POST', '/api/register', 'kein json')).status, 400);
  assert.strictEqual((await a('POST', '/api/register', '[1,2]')).status, 400);
  assert.strictEqual((await a('POST', '/api/register', { username: 'x'.repeat(20000) })).status, 413);
  r = await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.strictEqual(r.status, 415, 'nur JSON');
  r = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://boese.example' }, body: '{}' });
  assert.strictEqual(r.status, 403, 'fremder Ursprung wird abgewiesen');

  // --- Registrierung mit Übernahme lokaler Statistik ---
  r = await a('POST', '/api/register', { username: 'Zuendler', password: 'streichholz1', email: 'Zuendler@Example.org', local: { runs: 4, wins: 9, best: 1234, bestAct: 2 } });
  assert.strictEqual(r.status, 201);
  assert.deepStrictEqual(r.data, { user: { username: 'Zuendler' }, stats: { runs: 4, wins: 4, best: 1234, bestAct: 2 }, meta: {} });
  assert.match(r.setCookie, /HttpOnly/);
  assert.match(r.setCookie, /SameSite=Lax/);
  assert.doesNotMatch(r.setCookie, /Secure/, 'ohne HTTPS kein Secure-Flag');
  assert.strictEqual((await a('GET', '/api/me')).data.user.username, 'Zuendler');
  assert.strictEqual((await b('POST', '/api/register', { username: 'zuendler', password: 'langgenug1', email: 'x@y.de' })).data.error, 'taken_name');
  assert.strictEqual((await b('POST', '/api/register', { username: 'Anderer', password: 'langgenug1', email: 'ZUENDLER@example.org' })).data.error, 'taken_email');

  // --- Passwort liegt nicht im Klartext in der Datenbank ---
  const raw = fs.readFileSync(path.join(dataDir, 'zuendung.sqlite')).toString('latin1') +
    (fs.existsSync(path.join(dataDir, 'zuendung.sqlite-wal')) ? fs.readFileSync(path.join(dataDir, 'zuendung.sqlite-wal')).toString('latin1') : '');
  assert.ok(!raw.includes('streichholz1'), 'Passwort im Klartext gespeichert');
  assert.ok(raw.includes('scrypt$'));

  // --- Runs melden ---
  r = await a('POST', '/api/run', { won: false, score: 900, act: 1 });
  assert.deepStrictEqual(r.data.stats, { runs: 5, wins: 4, best: 1234, bestAct: 2 });
  r = await a('POST', '/api/run', { won: true, score: 5000, act: 3 });
  assert.deepStrictEqual(r.data.stats, { runs: 6, wins: 5, best: 5000, bestAct: 3 });
  r = await a('POST', '/api/run', { countRun: false, score: 7000, act: 5 });
  assert.deepStrictEqual(r.data.stats, { runs: 6, wins: 5, best: 7000, bestAct: 5 });
  r = await a('POST', '/api/run', { won: 'ja', score: -5, act: 'x' });
  assert.deepStrictEqual(r.data.stats, { runs: 7, wins: 5, best: 7000, bestAct: 5 }, 'Unsinn wird nicht gezählt');
  r = await a('POST', '/api/run', { won: true, score: 1e300, act: 1e300 });
  assert.strictEqual(r.data.stats.best, 100000000);

  // --- Meta-Fortschritt ---
  assert.strictEqual((await anon('POST', '/api/meta', { meta: { ash: 5 } })).status, 401);
  assert.strictEqual((await a('POST', '/api/meta', { meta: 'nein' })).status, 400);
  assert.strictEqual((await a('POST', '/api/meta', { meta: { blob: 'x'.repeat(7000) } })).status, 413);
  assert.strictEqual((await a('POST', '/api/meta', { meta: { ash: 12, earned: 30, unlocked: { 'trinket:heartblood': true }, upgrades: { startgeld: 2 }, maxStake: 1 } })).status, 200);
  assert.deepStrictEqual((await a('GET', '/api/me')).data.meta, { ash: 12, earned: 30, unlocked: { 'trinket:heartblood': true }, upgrades: { startgeld: 2 }, maxStake: 1 });

  // --- Abmelden und Anmelden ---
  assert.strictEqual((await a('POST', '/api/logout', {})).status, 200);
  assert.strictEqual((await a('GET', '/api/me')).status, 401);
  assert.strictEqual((await a('POST', '/api/login', { username: 'Zuendler', password: 'falsch-falsch' })).data.error, 'bad_login');
  assert.strictEqual((await a('POST', '/api/login', { username: 'GibtEsNicht', password: 'falsch-falsch' })).data.error, 'bad_login');
  r = await a('POST', '/api/login', { username: 'ZUENDLER', password: 'streichholz1', local: { runs: 50, wins: 50, best: 10, bestAct: 1 } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.stats.runs, 8, 'Zähler eines gefüllten Kontos werden nicht überschrieben');

  // --- Zurücksetzen ---
  assert.strictEqual((await anon('POST', '/api/reset/request', { email: 'unbekannt@example.org' })).status, 200);
  assert.strictEqual(smtp.mails.length, 0, 'keine Mail an unbekannte Adressen');
  assert.strictEqual((await anon('POST', '/api/reset/request', { email: 'zuendler@example.org' })).status, 200);
  assert.ok(await waitFor(() => smtp.mails.length === 1, 3000), 'Reset-Mail kommt an');
  const mail = smtp.mails[0];
  assert.strictEqual(mail.to, 'Zuendler@Example.org');
  assert.strictEqual(mail.auth, '\u0000mailer\u0000geheim');
  assert.match(mail.data, /Subject: =\?UTF-8\?B\?/);
  const text = Buffer.from(mail.data.split('\n\n')[1].replace(/\s/g, ''), 'base64').toString('utf8');
  const token = /https:\/\/spiel\.example\/\?reset=([A-Za-z0-9_-]+)/.exec(text)[1];
  assert.match(text, /Hallo Zuendler/);
  assert.strictEqual((await anon('POST', '/api/reset/confirm', { token: 'falsch', password: 'neuespasswort' })).data.error, 'bad_token');
  assert.strictEqual((await anon('POST', '/api/reset/confirm', { token, password: 'kurz' })).data.error, 'bad_password');
  r = await b('POST', '/api/reset/confirm', { token, password: 'neuespasswort' });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.user.username, 'Zuendler');
  assert.strictEqual((await anon('POST', '/api/reset/confirm', { token, password: 'nochmalneu1' })).data.error, 'bad_token', 'Link gilt nur einmal');
  assert.strictEqual((await a('GET', '/api/me')).status, 401, 'alte Sitzungen sind danach ungültig');
  assert.strictEqual((await a('POST', '/api/login', { username: 'Zuendler', password: 'streichholz1' })).data.error, 'bad_login');
  assert.strictEqual((await a('POST', '/api/login', { username: 'Zuendler', password: 'neuespasswort' })).status, 200);

  // --- Konto löschen ---
  assert.strictEqual((await a('POST', '/api/account/delete', { password: 'falsch-falsch' })).data.error, 'bad_login');
  assert.strictEqual((await a('POST', '/api/account/delete', { password: 'neuespasswort' })).status, 200);
  assert.strictEqual((await b('GET', '/api/me')).status, 401, 'auch andere Sitzungen des Kontos enden');
  assert.strictEqual((await a('POST', '/api/login', { username: 'Zuendler', password: 'neuespasswort' })).data.error, 'bad_login');
  r = await a('POST', '/api/register', { username: 'Zuendler', password: 'streichholz1', email: 'zuendler@example.org' });
  assert.strictEqual(r.status, 201, 'Name und Adresse sind nach dem Löschen wieder frei');
  assert.deepStrictEqual(r.data.stats, { runs: 0, wins: 0, best: 0, bestAct: 0 });

  // --- Begrenzung der Anmeldeversuche ---
  let limited = false;
  for (let i = 0; i < 12; i++) {
    r = await anon('POST', '/api/login', { username: 'Zuendler', password: 'rate-versuch' });
    if (r.status === 429) { limited = true; break; }
  }
  assert.ok(limited, 'zu viele Fehlversuche werden gebremst');

  await app.close();
  smtp.server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('OK – alle Servertests bestanden');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
