'use strict';
/* Minimaler SMTP-Versand ohne Abhängigkeiten (für die Passwort-Zurücksetzen-Mail).
   Unterstützt Port 465 (TLS von Anfang an) und STARTTLS (z. B. Port 587) mit AUTH PLAIN. */
const net = require('node:net');
const tls = require('node:tls');
const os = require('node:os');
const crypto = require('node:crypto');

const TIMEOUT = 15000;

function encodeHeader(text) {
  return /^[\x20-\x7e]*$/.test(text) ? text : '=?UTF-8?B?' + Buffer.from(text, 'utf8').toString('base64') + '?=';
}

function buildMessage(from, to, subject, text) {
  const body = Buffer.from(text, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  const domain = (from.split('@')[1] || 'localhost').replace(/[^A-Za-z0-9.-]/g, '');
  return [
    'From: ' + from,
    'To: ' + to,
    'Subject: ' + encodeHeader(subject),
    'Date: ' + new Date().toUTCString().replace('GMT', '+0000'),
    'Message-ID: <' + crypto.randomBytes(12).toString('hex') + '@' + domain + '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    body
  ].join('\r\n');
}

/* Liest SMTP-Antworten zeilenweise; eine Antwort endet mit "NNN <Text>" (ohne Bindestrich). */
function reader(socket) {
  let buffer = '', waiting = null, lines = [];
  const queue = [];
  function feed() {
    let index;
    while ((index = buffer.indexOf('\r\n')) >= 0) {
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      lines.push(line);
      if (/^\d{3} /.test(line) || /^\d{3}$/.test(line)) {
        const reply = { code: Number(line.slice(0, 3)), text: lines.join('\n') };
        lines = [];
        if (waiting) { const w = waiting; waiting = null; w.resolve(reply); }
        else queue.push(reply);
      }
    }
  }
  const onData = chunk => { buffer += chunk.toString('utf8'); feed(); };
  const onError = error => { if (waiting) { const w = waiting; waiting = null; w.reject(error); } };
  const onClose = () => onError(new Error('SMTP-Verbindung geschlossen'));
  socket.on('data', onData);
  socket.on('error', onError);
  socket.on('close', onClose);
  return {
    next() {
      if (queue.length) return Promise.resolve(queue.shift());
      return new Promise((resolve, reject) => { waiting = { resolve, reject }; });
    },
    detach() {
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    }
  };
}

async function command(socket, rd, line, expect) {
  if (line != null) socket.write(line + '\r\n');
  const reply = await rd.next();
  if (Math.floor(reply.code / 100) !== expect) {
    throw new Error('SMTP ' + reply.code + ': ' + reply.text.split('\n').pop());
  }
  return reply;
}

function connect(cfg) {
  return new Promise((resolve, reject) => {
    const options = { host: cfg.host, port: cfg.port };
    const socket = cfg.secure === 'tls'
      ? tls.connect(Object.assign({ servername: cfg.host }, options))
      : net.connect(options);
    socket.setTimeout(TIMEOUT, () => socket.destroy(new Error('SMTP-Zeitüberschreitung')));
    socket.once('error', reject);
    socket.once(cfg.secure === 'tls' ? 'secureConnect' : 'connect', () => {
      socket.off('error', reject);
      resolve(socket);
    });
  });
}

/* cfg: { host, port, secure: 'tls' | 'starttls' | 'none', user, pass, from } */
async function sendMail(cfg, mail) {
  if (/[\r\n]/.test(mail.to) || /[\r\n]/.test(cfg.from) || /[\r\n]/.test(mail.subject)) throw new Error('Ungültige Mail-Kopfzeile');
  let socket = await connect(cfg);
  let rd = reader(socket);
  try {
    const hello = 'EHLO ' + ((os.hostname() || '').replace(/[^A-Za-z0-9.-]/g, '') || 'localhost');
    await command(socket, rd, null, 2);
    let features = (await command(socket, rd, hello, 2)).text;
    if (cfg.secure === 'starttls') {
      if (!/STARTTLS/i.test(features)) throw new Error('Server bietet kein STARTTLS');
      await command(socket, rd, 'STARTTLS', 2);
      rd.detach();
      socket = await new Promise((resolve, reject) => {
        const secure = tls.connect({ socket, servername: cfg.host }, () => resolve(secure));
        secure.once('error', reject);
        secure.setTimeout(TIMEOUT, () => secure.destroy(new Error('SMTP-Zeitüberschreitung')));
      });
      rd = reader(socket);
      features = (await command(socket, rd, hello, 2)).text;
    }
    if (cfg.user) {
      const token = Buffer.from('\u0000' + cfg.user + '\u0000' + cfg.pass, 'utf8').toString('base64');
      await command(socket, rd, 'AUTH PLAIN ' + token, 2);
    }
    await command(socket, rd, 'MAIL FROM:<' + cfg.from + '>', 2);
    await command(socket, rd, 'RCPT TO:<' + mail.to + '>', 2);
    await command(socket, rd, 'DATA', 3);
    const message = buildMessage(cfg.from, mail.to, mail.subject, mail.text).replace(/^\./gm, '..');
    await command(socket, rd, message + '\r\n.', 2);
    socket.write('QUIT\r\n');
  } finally {
    rd.detach();
    socket.on('error', () => {});
    socket.end();
  }
}

module.exports = { sendMail };
