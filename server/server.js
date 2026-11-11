'use strict';
/* Zündung – Server: liefert das Spiel aus web/ aus und stellt die Konto-API unter /api bereit.
   Ohne Abhängigkeiten; braucht Node >= 22.13 (eingebautes SQLite).

   Start:  node --env-file-if-exists=server/.env server/server.js
   Konfiguration über Umgebungsvariablen, siehe server/.env.example. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { sendMail } = require('./mail');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (error) {
  console.error('Dieser Server braucht Node 22.13 oder neuer (eingebautes SQLite fehlt).');
  process.exit(1);
}

const scrypt = promisify(crypto.scrypt);
const DAY = 24 * 60 * 60 * 1000;
const SESSION_DAYS = 30;
const RESET_MINUTES = 60;
const COOKIE = 'zs';
const MAX_BODY = 8 * 1024;
const MAX_SCORE = 100000000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8'
};

function readConfig(env, overrides) {
  const config = {
    port: Number(env.PORT || 8377),
    host: env.HOST || '127.0.0.1',
    webRoot: path.resolve(env.WEB_ROOT || path.join(__dirname, '..', 'web')),
    dataDir: path.resolve(env.DATA_DIR || path.join(__dirname, 'data')),
    publicUrl: (env.PUBLIC_URL || '').replace(/\/+$/, ''),
    trustProxy: env.TRUST_PROXY === '1',
    smtp: env.SMTP_HOST ? {
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT || 465),
      secure: env.SMTP_SECURE || (Number(env.SMTP_PORT || 465) === 465 ? 'tls' : 'starttls'),
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      from: env.MAIL_FROM || env.SMTP_USER || ''
    } : null,
    quiet: false
  };
  return Object.assign(config, overrides || {});
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 32);
  return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
}

async function checkPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const key = await scrypt(password, Buffer.from(parts[1], 'hex'), 32);
  const expected = Buffer.from(parts[2], 'hex');
  return expected.length === key.length && crypto.timingSafeEqual(key, expected);
}

/* Damit die Antwortzeit nicht verrät, ob es einen Namen gibt, wird auch dann gerechnet. */
const DUMMY_HASH = 'scrypt$' + '00'.repeat(16) + '$' + '00'.repeat(32);

function createApp(overrides) {
  const config = readConfig(process.env, overrides);
  fs.mkdirSync(config.dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(config.dataDir, 'zuendung.sqlite'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      username_key TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      email_key TEXT NOT NULL UNIQUE,
      pass TEXT NOT NULL,
      created INTEGER NOT NULL,
      runs INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      best INTEGER NOT NULL DEFAULT 0,
      best_act INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS resets (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires INTEGER NOT NULL
    );
  `);

  const q = {
    userByName: db.prepare('SELECT * FROM users WHERE username_key = ?'),
    userByEmail: db.prepare('SELECT * FROM users WHERE email_key = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare('INSERT INTO users (username, username_key, email, email_key, pass, created, runs, wins, best, best_act) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    setStats: db.prepare('UPDATE users SET runs = ?, wins = ?, best = ?, best_act = ? WHERE id = ?'),
    setPass: db.prepare('UPDATE users SET pass = ? WHERE id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    insertSession: db.prepare('INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)'),
    session: db.prepare('SELECT * FROM sessions WHERE token_hash = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteSessionsOf: db.prepare('DELETE FROM sessions WHERE user_id = ?'),
    insertReset: db.prepare('INSERT INTO resets (token_hash, user_id, expires) VALUES (?, ?, ?)'),
    reset: db.prepare('SELECT * FROM resets WHERE token_hash = ?'),
    deleteResetsOf: db.prepare('DELETE FROM resets WHERE user_id = ?'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires < ?'),
    purgeResets: db.prepare('DELETE FROM resets WHERE expires < ?')
  };

  function log() {
    if (!config.quiet) console.log.apply(console, arguments);
  }

  /* ---------- Begrenzung von Versuchen (im Speicher, je Schlüssel) ---------- */
  const attempts = new Map();
  function limited(key, max, windowMs) {
    const now = Date.now();
    let entry = attempts.get(key);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      attempts.set(key, entry);
    }
    entry.count++;
    return entry.count > max;
  }
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.reset < now) attempts.delete(key);
    q.purgeSessions.run(now);
    q.purgeResets.run(now);
  }, 10 * 60 * 1000);
  sweep.unref();

  /* ---------- Hilfen ---------- */
  function clientIp(req) {
    if (config.trustProxy) {
      const forwarded = req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      if (forwarded) return forwarded;
    }
    return req.socket.remoteAddress || 'unknown';
  }

  function isSecure(req) {
    if (req.socket.encrypted) return true;
    return config.trustProxy && req.headers['x-forwarded-proto'] === 'https';
  }

  function send(res, status, body, headers) {
    const payload = Buffer.from(JSON.stringify(body));
    res.writeHead(status, Object.assign({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': payload.length,
      'Cache-Control': 'no-store'
    }, headers || {}));
    res.end(payload);
  }

  function fail(res, status, code) {
    send(res, status, { error: code });
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      let size = 0;
      req.on('data', chunk => {
        size += chunk.length;
        // Zu große Anfragen werden verworfen, aber zu Ende gelesen, damit der Client die 413 noch erhält.
        if (size > 1024 * 1024) return req.destroy();
        if (size <= MAX_BODY) chunks.push(chunk);
      });
      req.on('end', () => {
        if (size > MAX_BODY) return reject(Object.assign(new Error('zu groß'), { status: 413 }));
        try {
          const data = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('kein Objekt');
          resolve(data);
        } catch (error) {
          reject(Object.assign(new Error('kein JSON'), { status: 400 }));
        }
      });
      req.on('error', reject);
    });
  }

  function cookieOf(req) {
    const match = new RegExp('(?:^|;\\s*)' + COOKIE + '=([A-Za-z0-9_-]+)').exec(req.headers.cookie || '');
    return match ? match[1] : null;
  }

  function sessionCookie(req, token, maxAgeSeconds) {
    return COOKIE + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + maxAgeSeconds + (isSecure(req) ? '; Secure' : '');
  }

  function startSession(req, userId) {
    const token = crypto.randomBytes(32).toString('base64url');
    q.insertSession.run(hashToken(token), userId, Date.now() + SESSION_DAYS * DAY);
    return sessionCookie(req, token, SESSION_DAYS * 24 * 60 * 60);
  }

  function currentUser(req) {
    const token = cookieOf(req);
    if (!token) return null;
    const session = q.session.get(hashToken(token));
    if (!session || session.expires < Date.now()) return null;
    return q.userById.get(session.user_id) || null;
  }

  function publicUser(user) {
    return {
      user: { username: user.username },
      stats: { runs: user.runs, wins: user.wins, best: user.best, bestAct: user.best_act }
    };
  }

  function count(value, max) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
  }

  const NAME = /^[A-Za-z0-9_-]{3,20}$/;
  const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
  function validPassword(password) {
    return typeof password === 'string' && password.length >= 8 && password.length <= 200;
  }

  /* ---------- API ---------- */
  const routes = {
    'GET /api/me': async (req, res) => {
      const user = currentUser(req);
      if (!user) return fail(res, 401, 'auth');
      send(res, 200, publicUser(user));
    },

    'POST /api/register': async (req, res, body) => {
      if (limited('register:' + clientIp(req), 8, 60 * 60 * 1000)) return fail(res, 429, 'rate');
      const username = String(body.username || '').trim();
      const email = String(body.email || '').trim();
      if (!NAME.test(username)) return fail(res, 400, 'bad_name');
      if (!validPassword(body.password)) return fail(res, 400, 'bad_password');
      if (email.length > 254 || !EMAIL.test(email)) return fail(res, 400, 'bad_email');
      if (q.userByName.get(username.toLowerCase())) return fail(res, 409, 'taken_name');
      if (q.userByEmail.get(email.toLowerCase())) return fail(res, 409, 'taken_email');
      const local = body.local || {};
      const pass = await hashPassword(body.password);
      let info;
      try {
        info = q.insertUser.run(username, username.toLowerCase(), email, email.toLowerCase(), pass, Date.now(),
          count(local.runs, 100000), Math.min(count(local.wins, 100000), count(local.runs, 100000)), count(local.best, MAX_SCORE), count(local.bestAct, 9999));
      } catch (error) {
        return fail(res, 409, 'taken_name'); // gleichzeitige Registrierung mit demselben Namen
      }
      const user = q.userById.get(Number(info.lastInsertRowid));
      send(res, 201, publicUser(user), { 'Set-Cookie': startSession(req, user.id) });
    },

    'POST /api/login': async (req, res, body) => {
      const username = String(body.username || '').trim().toLowerCase();
      if (limited('login:' + clientIp(req), 20, 10 * 60 * 1000) || limited('login-name:' + username, 10, 10 * 60 * 1000)) return fail(res, 429, 'rate');
      const user = NAME.test(username) ? q.userByName.get(username) : null;
      const ok = await checkPassword(String(body.password || ''), user ? user.pass : DUMMY_HASH);
      if (!user || !ok) return fail(res, 401, 'bad_login');
      // Bestwerte von diesem Gerät übernehmen; Zählerstände nur, wenn das Konto noch leer ist.
      const local = body.local || {};
      const empty = user.runs === 0;
      q.setStats.run(
        empty ? count(local.runs, 100000) : user.runs,
        empty ? Math.min(count(local.wins, 100000), count(local.runs, 100000)) : user.wins,
        Math.max(user.best, count(local.best, MAX_SCORE)),
        Math.max(user.best_act, count(local.bestAct, 9999)),
        user.id);
      send(res, 200, publicUser(q.userById.get(user.id)), { 'Set-Cookie': startSession(req, user.id) });
    },

    'POST /api/logout': async (req, res) => {
      const token = cookieOf(req);
      if (token) q.deleteSession.run(hashToken(token));
      send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, 'x', 0) });
    },

    /* Meldet einen beendeten Run. countRun=false aktualisiert nur den Bestwert (Nachglut nach dem Sieg). */
    'POST /api/run': async (req, res, body) => {
      const user = currentUser(req);
      if (!user) return fail(res, 401, 'auth');
      if (limited('run:' + user.id, 120, 60 * 60 * 1000)) return fail(res, 429, 'rate');
      const counts = body.countRun !== false;
      q.setStats.run(
        user.runs + (counts ? 1 : 0),
        user.wins + (counts && body.won === true ? 1 : 0),
        Math.max(user.best, count(body.score, MAX_SCORE)),
        Math.max(user.best_act, count(body.act, 9999)),
        user.id);
      send(res, 200, publicUser(q.userById.get(user.id)));
    },

    'POST /api/account/delete': async (req, res, body) => {
      const user = currentUser(req);
      if (!user) return fail(res, 401, 'auth');
      if (limited('delete:' + user.id, 10, 10 * 60 * 1000)) return fail(res, 429, 'rate');
      if (!(await checkPassword(String(body.password || ''), user.pass))) return fail(res, 401, 'bad_login');
      q.deleteUser.run(user.id);
      send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, 'x', 0) });
    },

    /* Antwortet immer gleich, damit sich nicht herausfinden lässt, welche Adressen registriert sind. */
    'POST /api/reset/request': async (req, res, body) => {
      if (limited('reset:' + clientIp(req), 5, 60 * 60 * 1000)) return fail(res, 429, 'rate');
      const email = String(body.email || '').trim().toLowerCase();
      const user = EMAIL.test(email) ? q.userByEmail.get(email) : null;
      if (user && !limited('reset-user:' + user.id, 3, 60 * 60 * 1000)) {
        const token = crypto.randomBytes(32).toString('base64url');
        q.deleteResetsOf.run(user.id);
        q.insertReset.run(hashToken(token), user.id, Date.now() + RESET_MINUTES * 60 * 1000);
        const link = (config.publicUrl || 'http://' + config.host + ':' + config.port) + '/?reset=' + token;
        if (config.smtp && config.publicUrl) {
          sendMail(config.smtp, {
            to: user.email,
            subject: 'Zündung: Passwort zurücksetzen',
            text: 'Hallo ' + user.username + ',\n\nüber diesen Link setzt du dein Passwort neu (gültig für ' + RESET_MINUTES + ' Minuten):\n\n' + link +
              '\n\nWenn du das nicht angefordert hast, kannst du diese Mail ignorieren.\n'
          }).catch(error => console.error('Reset-Mail fehlgeschlagen:', error.message));
        } else {
          log('[Kein Mailversand eingerichtet] Reset-Link für ' + user.username + ': ' + link);
        }
      }
      send(res, 200, { ok: true });
    },

    'POST /api/reset/confirm': async (req, res, body) => {
      if (limited('reset-confirm:' + clientIp(req), 20, 60 * 60 * 1000)) return fail(res, 429, 'rate');
      if (!validPassword(body.password)) return fail(res, 400, 'bad_password');
      const entry = q.reset.get(hashToken(String(body.token || '')));
      if (!entry || entry.expires < Date.now()) return fail(res, 400, 'bad_token');
      q.setPass.run(await hashPassword(body.password), entry.user_id);
      q.deleteResetsOf.run(entry.user_id);
      q.deleteSessionsOf.run(entry.user_id);
      const user = q.userById.get(entry.user_id);
      send(res, 200, publicUser(user), { 'Set-Cookie': startSession(req, user.id) });
    }
  };

  /* ---------- Statische Dateien ---------- */
  const HIDDEN = /^\/(tools|tests)(\/|$)/;
  function serveStatic(req, res, pathname) {
    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch (error) {
      return notFound(res);
    }
    if (rel.includes('\0') || HIDDEN.test(rel) || /(^|\/)\./.test(rel)) return notFound(res);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.normalize(path.join(config.webRoot, rel));
    if (file !== config.webRoot && !file.startsWith(config.webRoot + path.sep)) return notFound(res);
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return notFound(res);
      const etag = 'W/"' + stat.size.toString(16) + '-' + Math.floor(stat.mtimeMs).toString(16) + '"';
      const headers = {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'ETag': etag,
        'Last-Modified': stat.mtime.toUTCString(),
        'Accept-Ranges': 'bytes'
      };
      if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, headers);
        return res.end();
      }
      let start = 0, end = stat.size - 1, status = 200;
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (range && (range[1] || range[2]) && stat.size > 0) {
        if (range[1]) {
          start = Number(range[1]);
          if (range[2]) end = Math.min(end, Number(range[2]));
        } else {
          start = Math.max(0, stat.size - Number(range[2]));
        }
        if (start > end || start >= stat.size) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + stat.size });
          return res.end();
        }
        status = 206;
        headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + stat.size;
      }
      headers['Content-Length'] = end - start + 1;
      res.writeHead(status, headers);
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file, { start, end }).on('error', () => res.destroy()).pipe(res);
    });
  }

  function notFound(res) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Nicht gefunden');
  }

  /* ---------- Anfragen ---------- */
  const SECURITY = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  };

  const server = http.createServer(async (req, res) => {
    for (const name in SECURITY) res.setHeader(name, SECURITY[name]);
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch (error) {
      return notFound(res);
    }
    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        return res.end();
      }
      return serveStatic(req, res, url.pathname);
    }
    const handler = routes[req.method + ' ' + url.pathname];
    if (!handler) return fail(res, 404, 'not_found');
    try {
      let body = {};
      if (req.method === 'POST') {
        // Schutz gegen fremde Seiten: nur JSON vom eigenen Ursprung
        if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return fail(res, 415, 'json_only');
        const origin = req.headers.origin;
        if (origin) {
          let originHost = '';
          try { originHost = new URL(origin).host; } catch (error) { /* ungültig */ }
          if (originHost !== req.headers.host) return fail(res, 403, 'origin');
        }
        body = await readBody(req);
      }
      await handler(req, res, body);
    } catch (error) {
      if (error && error.status) return fail(res, error.status, 'bad_request');
      console.error('API-Fehler', req.method, url.pathname, error);
      if (!res.headersSent) fail(res, 500, 'server');
    }
  });

  return {
    server,
    config,
    listen() {
      return new Promise(resolve => server.listen(config.port, config.host, () => resolve(server.address())));
    },
    close() {
      clearInterval(sweep);
      return new Promise(resolve => server.close(() => { db.close(); resolve(); }));
    }
  };
}

if (require.main === module) {
  const app = createApp();
  app.listen().then(address => {
    console.log('Zündung läuft auf http://' + address.address + ':' + address.port);
    if (!app.config.smtp || !app.config.publicUrl) {
      console.log('Hinweis: Kein Mailversand eingerichtet (SMTP_HOST und PUBLIC_URL). Reset-Links erscheinen nur hier im Protokoll.');
    }
  });
  const stop = () => app.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

module.exports = { createApp };
