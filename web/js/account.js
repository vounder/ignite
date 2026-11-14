/* Zündung – Konto: Anbindung an die Server-API unter /api.
   Läuft das Spiel ohne Server (Doppelklick auf index.html oder rein statisches Hosting),
   bleibt "available" false und alle Konto-Elemente werden ausgeblendet.

   Ohne Netz (Offline-App): Wer auf dem Gerät angemeldet war, spielt weiter; beendete Runs und geänderter
   Meta-Fortschritt werden gemerkt und nachgereicht, sobald der Server wieder antwortet. Bis dahin gilt der
   Stand auf dem Gerät – er wird beim Wiedersehen nicht vom älteren Stand des Kontos überschrieben. */
(function (ZU) {
  'use strict';

  var listeners = [];

  function call(method, url, body) {
    if (typeof fetch !== 'function') return Promise.resolve({ status: 0, data: null });
    return fetch(url, {
      method: method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    }).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (data) {
        return { status: response.status, data: data };
      });
    }).catch(function () {
      return { status: 0, data: null };
    });
  }

  function localStats() {
    var profile = ZU.Profile.load();
    return { runs: profile.runs, wins: profile.wins, best: profile.best, bestAct: profile.bestAct };
  }

  /* ---------- Nachreichen ---------- */
  var SYNC_KEY = 'zuendung.web.sync.v1', MAX_QUEUE = 200;
  function storage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }
  /* { user: zuletzt hier angemeldetes Konto, runs: noch nicht gemeldete Runs, meta: Fortschritt noch nicht hochgeladen } */
  function readSync() {
    var sync = { user: '', runs: [], meta: false }, store = storage();
    try {
      var data = store ? JSON.parse(store.getItem(SYNC_KEY) || 'null') : null;
      if (data && typeof data.user === 'string') {
        sync.user = data.user;
        if (Array.isArray(data.runs)) sync.runs = data.runs.filter(function (r) { return r && typeof r === 'object'; }).slice(0, MAX_QUEUE);
        sync.meta = data.meta === true;
      }
    } catch (e) { /* leer */ }
    return sync;
  }
  function writeSync(sync) {
    var store = storage();
    if (!store) return;
    try {
      if (sync.user) store.setItem(SYNC_KEY, JSON.stringify(sync)); else store.removeItem(SYNC_KEY);
    } catch (e) { /* egal */ }
  }
  function queueRun(info) {
    var sync = readSync();
    if (!sync.user || sync.runs.length >= MAX_QUEUE) return;
    sync.runs.push(info);
    writeSync(sync);
  }
  function markMeta(dirty) {
    var sync = readSync();
    if (!sync.user || sync.meta === dirty) return;
    sync.meta = dirty;
    writeSync(sync);
  }
  /* Das Gerät kennt (noch) kein Konto am Server, war aber angemeldet: dann wird gemerkt statt gemeldet. */
  function away() { return !A.user && !A.available && !!readSync().user; }

  /* Antwort des Servers auf Anmeldung oder Wiedersehen. Wartet für dieses Konto noch etwas vom Gerät,
     geht es zuerst hinauf; erst danach gilt wieder der Stand des Servers. */
  function settle(data) {
    var sync = readSync();
    if (sync.user !== data.user.username || (!sync.runs.length && !sync.meta)) { adopt(data); return Promise.resolve(); }
    A.user = data.user;
    A.stats = data.stats;
    emit();
    var latest = data;
    function nextRun() {
      var sync = readSync();
      if (!sync.runs.length) return Promise.resolve(true);
      return call('POST', 'api/run', sync.runs[0]).then(function (response) {
        if (response.status === 0 || response.status === 429 || response.status >= 500) return false; // später noch einmal
        if (response.status === 401) return false;
        var now = readSync();
        now.runs.shift(); // angenommen – oder vom Server abgelehnt, dann nicht ewig wiederholen
        writeSync(now);
        if (response.status === 200 && response.data) latest = response.data;
        return nextRun();
      });
    }
    return nextRun().then(function (sent) {
      if (!sent || !readSync().meta) return sent;
      var meta = ZU.Meta.get();
      return call('POST', 'api/meta', { meta: meta }).then(function (response) {
        if (response.status !== 200) return false;
        markMeta(false);
        latest.meta = meta;
        return true;
      });
    }).then(function () {
      adopt(latest, readSync().meta);
    });
  }

  /* Der Server ist nach der Anmeldung maßgeblich: seine Zahlen ersetzen die lokalen.
     keepMeta: Der Fortschritt auf dem Gerät ist neuer und konnte noch nicht hochgeladen werden – er bleibt. */
  function adopt(data, keepMeta) {
    A.user = data.user;
    A.stats = data.stats;
    var sync = readSync();
    if (sync.user !== data.user.username) writeSync({ user: data.user.username, runs: [], meta: false });
    var profile = ZU.Profile.load();
    profile.runs = data.stats.runs;
    profile.wins = data.stats.wins;
    profile.best = data.stats.best;
    profile.bestAct = data.stats.bestAct;
    ZU.Profile.save(profile);
    if (ZU.game) ZU.game.profile = profile;
    // Meta-Fortschritt: Hat das Konto schon welchen, gilt er; sonst wandert der lokale Stand hinauf.
    var remote = ZU.Meta.clean(data.meta);
    if (keepMeta) { /* bleibt, bis er hochgeladen ist */ }
    else if (ZU.Meta.touched(remote)) ZU.Meta.put(remote, true);
    else if (ZU.Meta.touched(ZU.Meta.get())) pushMeta(ZU.Meta.get());
    emit();
  }

  var metaTimer = null;
  function pushMeta(meta) {
    clearTimeout(metaTimer);
    metaTimer = setTimeout(function () {
      if (!A.user) return;
      call('POST', 'api/meta', { meta: meta }).then(function (response) {
        if (response.status === 200) markMeta(false);
        else if (response.status === 0) markMeta(true); // kein Netz: beim Wiedersehen nachreichen
      });
    }, 600);
  }

  function signedOut() {
    A.user = null;
    A.stats = null;
    writeSync({ user: '' });
    emit();
  }

  function emit() {
    listeners.slice().forEach(function (fn) { fn(); });
  }

  function result(response, onOk) {
    if (response.status >= 200 && response.status < 300 && response.data) {
      if (onOk) onOk(response.data);
      return { ok: true };
    }
    return { ok: false, error: response.data && response.data.error ? response.data.error : response.status ? 'server' : 'offline' };
  }

  var A = {
    available: false,
    user: null,
    stats: null,

    onChange: function (fn) {
      listeners.push(fn);
      return function () {
        var index = listeners.indexOf(fn);
        if (index >= 0) listeners.splice(index, 1);
      };
    },

    init: function () {
      if (location.protocol === 'file:') return Promise.resolve();
      if (!A._online && typeof window !== 'undefined') {
        // Wieder Netz: Konto erneut fragen und Gemerktes nachreichen.
        A._online = true;
        window.addEventListener('online', function () {
          var sync = readSync();
          if (!A.available || sync.runs.length || sync.meta) A.init();
        });
      }
      return call('GET', 'api/me').then(function (response) {
        if (response.status === 200 && response.data && response.data.user) {
          A.available = true;
          return settle(response.data);
        }
        if (response.status === 401 && response.data && response.data.error === 'auth') {
          A.available = true;
          // Sitzung abgelaufen: Gemerktes bleibt liegen, bis sich dasselbe Konto wieder anmeldet.
          var sync = readSync();
          if (sync.user && !sync.runs.length && !sync.meta) writeSync({ user: '' });
          A.user = null;
          A.stats = null;
          emit();
        }
        // Sonst antwortet kein Server (kein Netz): Ein hier angemeldetes Konto bleibt gemerkt.
      });
    },

    register: function (username, password, email) {
      return call('POST', 'api/register', { username: username, password: password, email: email, local: localStats() })
        .then(function (response) { return result(response, adopt); });
    },

    login: function (username, password) {
      return call('POST', 'api/login', { username: username, password: password, local: localStats() })
        .then(function (response) { return result(response, settle); });
    },

    logout: function () {
      return call('POST', 'api/logout', {}).then(function (response) {
        signedOut();
        return result(response);
      });
    },

    remove: function (password) {
      return call('POST', 'api/account/delete', { password: password }).then(function (response) {
        return result(response, signedOut);
      });
    },

    requestReset: function (email) {
      return call('POST', 'api/reset/request', { email: email }).then(function (response) { return result(response); });
    },

    confirmReset: function (token, password) {
      return call('POST', 'api/reset/confirm', { token: token, password: password })
        .then(function (response) { return result(response, adopt); });
    },

    /* Meldet einen beendeten Run; ohne Anmeldung passiert nichts. Ohne Netz wird er gemerkt und nachgereicht. */
    reportRun: function (info) {
      // Kennung, an der der Server eine wiederholte Meldung erkennt
      info.id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
      if (!A.user) {
        if (away()) queueRun(info);
        return Promise.resolve();
      }
      return call('POST', 'api/run', info).then(function (response) {
        if (response.status === 200 && response.data) adopt(response.data, readSync().meta);
        else if (response.status === 401) signedOut();
        else if (response.status === 0) queueRun(info);
      });
    }
  };

  ZU.Meta.onChange = function (meta) {
    if (A.user) pushMeta(meta);
    else if (away()) markMeta(true);
  };

  ZU.account = A;
})(window.ZU = window.ZU || {});
