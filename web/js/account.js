/* Zündung – Konto: Anbindung an die Server-API unter /api und Abgleich des Spielstands über Geräte hinweg.
   Läuft das Spiel ohne Server (Doppelklick auf index.html oder rein statisches Hosting),
   bleibt "available" false und alle Konto-Elemente werden ausgeblendet.

   Was zum Konto gehört: Fortschritt (Asche, Freischaltungen, Zählwerke), der laufende Run, die eigene Figur,
   die zuletzt gespielte Schachtel und die Merkzettel (Regeln gesehen, Neuigkeiten gesehen). Nur die Einstellungen
   bleiben auf dem Gerät. Das Gerät hält von allem eine Kopie – so startet das Spiel sofort und läuft ohne Netz.

   Abgleich: Das Konto zählt seine Speicherungen (rev). Das Gerät merkt sich, auf welchem Stand es zuletzt mit dem
   Konto einig war (base). Jede Änderung geht gleich hinauf; ohne Netz bleibt sie liegen und folgt bei der nächsten
   Gelegenheit (wieder online, App wieder im Vordergrund, nächster Start). Hat inzwischen ein anderes Gerät
   gespeichert, lehnt der Server ab und schickt seinen Stand: Dann wird zusammengeführt, nicht überschrieben –
   Fortschritt nach festen Regeln (ZU.Meta.merge), der Run nach ZU.Run.pick; liegen zwei verschiedene Runs vor,
   die beide weitergespielt wurden, entscheidet der Spieler. */
(function (ZU) {
  'use strict';

  var listeners = [];

  function call(method, url, body, keepalive) {
    if (typeof fetch !== 'function') return Promise.resolve({ status: 0, data: null });
    var opts = {
      method: method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    };
    if (keepalive && opts.body && opts.body.length < 60000) opts.keepalive = true; // darf die Seite überleben (App geht in den Hintergrund)
    return fetch(url, opts).then(function (response) {
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

  /* ---------- Merkzettel des Abgleichs ---------- */
  var SYNC_KEY = 'zuendung.web.sync.v2', OLD_KEY = 'zuendung.web.sync.v1', MAX_QUEUE = 200;
  function storage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }
  /* { user: zuletzt hier angemeldetes Konto,
       rev, base: Zählerstand und Stand ({ meta, prefs, run: Kurzform }), auf dem Gerät und Konto zuletzt einig waren,
       runs: beendete Runs, die der Statistik des Kontos noch gemeldet werden müssen,
       fresh: gerade erst angemeldet (noch nie abgeglichen),
       dirty: Fortschritt aus einer Fassung vor dem Abgleich, der noch nicht hochgeladen war } */
  function readSync() {
    var sync = { user: '', rev: null, base: null, runs: [], fresh: false, dirty: false }, store = storage();
    try {
      var data = store ? JSON.parse(store.getItem(SYNC_KEY) || 'null') : null;
      if (!data && store) {
        var old = JSON.parse(store.getItem(OLD_KEY) || 'null'); // Merkzettel aus der Zeit vor dem Abgleich
        if (old && typeof old.user === 'string') data = { user: old.user, runs: old.runs, dirty: old.meta === true };
      }
      if (data && typeof data.user === 'string') {
        sync.user = data.user;
        if (Array.isArray(data.runs)) sync.runs = data.runs.filter(function (r) { return r && typeof r === 'object'; }).slice(0, MAX_QUEUE);
        sync.fresh = data.fresh === true;
        sync.dirty = data.dirty === true;
        if (typeof data.rev === 'number' && data.base && typeof data.base === 'object') {
          sync.rev = data.rev;
          sync.base = { meta: data.base.meta || {}, prefs: data.base.prefs || {}, run: typeof data.base.run === 'string' ? data.base.run : '' };
        }
      }
    } catch (e) { /* leer */ }
    return sync;
  }
  function writeSync(sync) {
    var store = storage();
    if (!store) return;
    try {
      if (sync.user) store.setItem(SYNC_KEY, JSON.stringify(sync)); else store.removeItem(SYNC_KEY);
      store.removeItem(OLD_KEY);
    } catch (e) { /* egal */ }
  }
  function queueRun(info) {
    var sync = readSync();
    if (!sync.user || sync.runs.length >= MAX_QUEUE) return;
    sync.runs.push(info);
    writeSync(sync);
  }
  /* Kein Konto am Server erreichbar, aber hier war eines angemeldet: Dann wird gemerkt statt gemeldet. */
  function away() { return !A.user && !!readSync().user; }

  /* ---------- Der Stand auf dem Gerät ---------- */
  var PREFS = ['avatar', 'deck', 'seenHelp', 'brSeen', 'popSeen', 'popInit', 'story'];
  function cleanPrefs(raw) {
    var base = ZU.Profile.defaults(), out = {};
    raw = raw && typeof raw === 'object' ? raw : {};
    PREFS.forEach(function (key) {
      var value = raw[key], ok = typeof value === typeof base[key] && Array.isArray(value) === Array.isArray(base[key]) && value !== null;
      if (ok && Array.isArray(value)) value = value.filter(function (x) { return typeof x === 'string'; }).slice(0, 400);
      if (ok) out[key] = value;
    });
    return out;
  }
  function collect() {
    var profile = ZU.Profile.load();
    return { meta: ZU.Meta.clean(profile.meta), prefs: cleanPrefs(profile), run: ZU.Run.raw() };
  }
  /* Vergleichbare Form: gleiche Inhalte ergeben denselben Text, egal in welcher Reihenfolge die Schlüssel stehen. */
  function canon(value) {
    if (Array.isArray(value)) return '[' + value.map(canon).join(',') + ']';
    if (value && typeof value === 'object') {
      return '{' + Object.keys(value).sort().map(function (key) { return JSON.stringify(key) + ':' + canon(value[key]); }).join(',') + '}';
    }
    return JSON.stringify(value === undefined ? null : value);
  }
  /* Was sich auf dem Gerät gegenüber dem letzten gemeinsamen Stand geändert hat. */
  function changes(sync, local) {
    var parts = {}, sent = {}, any = false;
    if (canon(local.meta) !== canon(ZU.Meta.clean(sync.base.meta))) { parts.meta = sent.meta = local.meta; any = true; }
    if (canon(local.prefs) !== canon(cleanPrefs(sync.base.prefs))) { parts.prefs = sent.prefs = local.prefs; any = true; }
    if (ZU.Run.sig(local.run) !== sync.base.run) { parts.run = local.run; sent.run = ZU.Run.sig(local.run); any = true; }
    return any ? { parts: parts, sent: sent } : null;
  }
  /* Läuft gerade ein Run auf dem Bildschirm? Dann wird er dem Spieler nicht unter den Händen ausgetauscht. */
  var IDLE = ['menu', 'casino', 'starter', 'backroom', 'avatar'];
  function inPlay() {
    var game = ZU.game;
    return !!(game && game.run && game.screen && IDLE.indexOf(game.screen) < 0);
  }

  /* ---------- Abgleich ---------- */
  var applying = false; // der Abgleich schreibt gerade selbst aufs Gerät: Das ist keine Änderung des Spielers
  var chain = Promise.resolve(), queued = false, timer = null, retryTimer = null, retryStep = 0, lastContact = 0;
  /* Alles, was mit dem Server spricht, läuft nacheinander. */
  function enqueue(fn) {
    chain = chain.then(fn, fn).catch(function () { return false; });
    return chain;
  }
  function later() {
    // kein Netz, Server beschäftigt oder zu viele Anfragen: mit wachsendem Abstand noch einmal
    clearTimeout(retryTimer);
    var wait = [5, 15, 30, 60][Math.min(retryStep++, 3)] * 1000;
    retryTimer = setTimeout(function () { A.check(true); }, wait);
    setState('offline');
    return false;
  }
  function contact() {
    lastContact = Date.now();
    retryStep = 0;
    clearTimeout(retryTimer);
  }
  function setState(state) {
    if (A.syncState === state) return;
    A.syncState = state;
    emit();
  }
  /* Eine Änderung auf dem Gerät: gleich hinauf damit (kurz gesammelt, damit nicht jeder Handgriff einzeln geht). */
  function schedule() {
    if (applying || !readSync().user) return;
    if (A.user && A.syncState === 'saved') setState('pending');
    clearTimeout(timer);
    timer = setTimeout(function () { push(); }, 900);
  }
  function push(opts) {
    clearTimeout(timer);
    timer = null;
    if (queued && !opts) return chain;
    if (!opts) queued = true;
    return enqueue(function () {
      if (!opts) queued = false;
      return pushOnce(opts || {}, 0);
    });
  }

  /* Schickt, was sich geändert hat. check: auch ohne Änderung beim Server nachsehen, ob er Neueres hat. */
  function pushOnce(opts, tries) {
    if (!A.user) return false;
    var sync = readSync();
    if (sync.user !== A.user.username) return false;
    if (sync.rev == null || !sync.base) {
      // noch nie abgeglichen: erst den Stand des Kontos holen
      return call('GET', 'api/me').then(function (response) {
        if (response.status === 200 && response.data && response.data.user) { contact(); return reconcile(response.data, tries); }
        if (response.status === 401) { expired(); return false; }
        return later();
      });
    }
    var local = collect(), diff = changes(sync, local);
    if (!diff && !opts.check) { setState('saved'); return true; }
    var body = { rev: sync.rev };
    if (diff) Object.keys(diff.parts).forEach(function (key) { body[key] = diff.parts[key]; });
    return call('POST', 'api/sync', body, opts.keepalive).then(function (response) {
      if (response.status === 200 && response.data && typeof response.data.rev === 'number') {
        contact();
        var now = readSync();
        if (now.user === sync.user && now.base) {
          now.rev = response.data.rev;
          if (diff) Object.keys(diff.sent).forEach(function (key) { now.base[key] = diff.sent[key]; });
          writeSync(now);
          // Hat sich währenddessen noch etwas getan, geht es gleich hinterher.
          if (changes(now, collect()) && tries < 6) return pushOnce({}, tries + 1);
        }
        setState('saved');
        return true;
      }
      if (response.status === 409 && response.data && typeof response.data.rev === 'number') {
        contact();
        return tries < 6 ? reconcile(response.data, tries + 1) : later();
      }
      if (response.status === 401) { expired(); return false; }
      return later();
    });
  }

  /* Das Konto hat einen anderen Stand als den, auf dem das Gerät aufbaut: zusammenführen, auf dem Gerät ablegen,
     und was das Gerät darüber hinaus hat, wieder hinaufschicken. */
  function reconcile(remote, tries) {
    if (typeof remote.rev !== 'number') return false; // Server aus der Zeit vor dem Abgleich
    var sync = readSync(), local = collect(), base = sync.base;
    var rMeta = ZU.Meta.clean(remote.meta), rPrefs = cleanPrefs(remote.prefs);
    var rRun = remote.run && typeof remote.run === 'object' && remote.run.v === 1 && Array.isArray(remote.run.collection) ? remote.run : null;

    var meta, prefs = {};
    if (base) meta = ZU.Meta.merge(base.meta, local.meta, rMeta);
    else if (sync.fresh) meta = ZU.Meta.touched(rMeta) ? rMeta : local.meta; // frisch angemeldet: Hat das Konto schon Fortschritt, gilt er
    else meta = sync.dirty ? ZU.Meta.join(local.meta, rMeta) : ZU.Meta.join(rMeta, local.meta); // erstes Mal mit Abgleich: nichts verlieren

    var bPrefs = base ? cleanPrefs(base.prefs) : null, remoteHas = Object.keys(rPrefs).length > 0;
    PREFS.forEach(function (key) {
      var l = local.prefs[key], r = rPrefs[key];
      if (r === undefined) { prefs[key] = l; return; }
      if (!bPrefs) { prefs[key] = remoteHas ? r : l; return; }
      prefs[key] = canon(l) !== canon(bPrefs[key]) ? l : r;
    });
    // Was einmal gesehen wurde, bleibt gesehen – egal auf welchem Gerät.
    if (rPrefs.seenHelp || local.prefs.seenHelp) prefs.seenHelp = true;
    // Gesehene Szenen der Geschichte: Was auf einem Gerät gesehen wurde, gilt überall.
    if (rPrefs.story || local.prefs.story) prefs.story = Object.assign({}, rPrefs.story || {}, local.prefs.story || {});
    if (rPrefs.popInit || local.prefs.popInit) prefs.popInit = true;
    if (Array.isArray(rPrefs.popSeen) && Array.isArray(local.prefs.popSeen)) {
      prefs.popSeen = local.prefs.popSeen.concat(rPrefs.popSeen.filter(function (key) { return local.prefs.popSeen.indexOf(key) < 0; }));
    }

    var choice = ZU.Run.pick(base ? base.run : null, local.run, rRun);
    if (choice !== 'same' && inPlay()) choice = 'local'; // mitten im Run gilt der, der gerade gespielt wird
    var decided = choice !== 'ask' ? Promise.resolve(choice)
      : A.askRun ? Promise.resolve(A.askRun(local.run, rRun)).then(function (answer) { return answer === 'remote' ? 'remote' : 'local'; })
        : Promise.resolve('local');

    return decided.then(function (choice) {
      if (choice === 'remote' && inPlay()) choice = 'local';
      applying = true;
      try {
        var profile = ZU.Profile.load();
        profile.meta = meta;
        PREFS.forEach(function (key) { if (prefs[key] !== undefined) profile[key] = prefs[key]; });
        ZU.Profile.save(profile);
        if (ZU.game) {
          ZU.game.profile = profile;
          if (choice === 'remote') ZU.game.run = null;
        }
        if (choice === 'remote') ZU.Run.store(rRun);
      } finally {
        applying = false;
      }
      var now = readSync();
      if (now.user !== sync.user) return false;
      now.rev = remote.rev;
      now.base = { meta: rMeta, prefs: rPrefs, run: ZU.Run.sig(rRun) };
      now.fresh = false;
      now.dirty = false;
      writeSync(now);
      emit();
      return pushOnce({}, tries || 0);
    });
  }

  /* ---------- Statistik des Kontos (Runs, Siege, Bestwert) ---------- */
  /* Der Server zählt; seine Zahlen ersetzen die lokalen. Der Fortschritt läuft über den Abgleich, nicht hierüber. */
  function adoptStats(data) {
    if (!data || !data.stats) return;
    A.stats = data.stats;
    var profile = ZU.Profile.load();
    profile.runs = data.stats.runs;
    profile.wins = data.stats.wins;
    profile.best = data.stats.best;
    profile.bestAct = data.stats.bestAct;
    applying = true;
    try { ZU.Profile.save(profile); } finally { applying = false; }
    if (ZU.game && ZU.game.profile) {
      ['runs', 'wins', 'best', 'bestAct'].forEach(function (key) { ZU.game.profile[key] = profile[key]; });
    }
  }
  /* Reicht Runs nach, die ohne Netz zu Ende gingen. */
  function flushRuns() {
    var sync = readSync();
    if (!sync.runs.length) return Promise.resolve(true);
    return call('POST', 'api/run', sync.runs[0]).then(function (response) {
      if (response.status === 0 || response.status === 429 || response.status >= 500) return false; // später noch einmal
      if (response.status === 401) return false;
      var now = readSync();
      now.runs.shift(); // angenommen – oder vom Server abgelehnt, dann nicht ewig wiederholen
      writeSync(now);
      if (response.status === 200) adoptStats(response.data);
      return flushRuns();
    });
  }

  /* Antwort des Servers auf Anmeldung oder Wiedersehen: Konto übernehmen, Liegengebliebenes nachreichen, abgleichen. */
  function settle(data) {
    var sync = readSync();
    if (sync.user !== data.user.username) writeSync({ user: data.user.username, rev: null, base: null, runs: [], fresh: true });
    A.user = data.user;
    adoptStats(data);
    A.syncState = 'pending';
    emit();
    contact();
    return flushRuns().then(function () { return reconcile(data, 0); });
  }

  /* Die Sitzung ist abgelaufen. Wartet noch etwas auf dem Gerät, bleibt der Merkzettel liegen, bis sich dasselbe
     Konto wieder anmeldet; sonst wird er geleert. */
  function expired() {
    var sync = readSync(), waiting = sync.runs.length > 0 || sync.dirty;
    if (sync.user && sync.base && !waiting) waiting = !!changes(sync, collect());
    if (sync.user && !waiting) writeSync({ user: '' });
    A.user = null;
    A.stats = null;
    A.syncState = 'none';
    emit();
  }

  function signedOut() {
    A.user = null;
    A.stats = null;
    A.syncState = 'none';
    clearTimeout(timer);
    clearTimeout(retryTimer);
    writeSync({ user: '' });
    emit();
  }

  function emit() {
    listeners.slice().forEach(function (fn) { fn(); });
  }

  function result(response) {
    if (response.status >= 200 && response.status < 300 && response.data) return { ok: true };
    return { ok: false, error: response.data && response.data.error ? response.data.error : response.status ? 'server' : 'offline' };
  }
  /* Anmeldung geglückt: Der Abgleich läuft an; die Antwort an die Oberfläche wartet nicht auf ihn. */
  function entered(response) {
    var out = result(response);
    if (out.ok && response.data.user) enqueue(function () { A.available = true; return settle(response.data); });
    return out;
  }

  var A = {
    available: false,
    user: null,
    stats: null,
    /* Stand des Abgleichs: 'none' (nicht angemeldet), 'saved' (alles im Konto), 'pending' (wird gerade gesichert),
       'offline' (wartet auf Netz). */
    syncState: 'none',
    /* Fragt den Spieler, welcher von zwei verschiedenen Runs bleiben soll: (hier, imKonto) → Versprechen auf
       'local' oder 'remote'. Setzt die Oberfläche (screens.js). */
    askRun: null,

    onChange: function (fn) {
      listeners.push(fn);
      return function () {
        var index = listeners.indexOf(fn);
        if (index >= 0) listeners.splice(index, 1);
      };
    },

    /* Läuft gerade ein Run auf dem Bildschirm? */
    inPlay: inPlay,
    /* Name des Kontos, das auf diesem Gerät angemeldet war und dessen Stand ohne Netz weitergeführt wird. */
    remembered: function () { return A.user ? A.user.username : readSync().user; },
    /* Wartet auf dem Gerät noch etwas darauf, ins Konto zu gehen? */
    waiting: function () {
      var sync = readSync();
      if (!sync.user) return false;
      return sync.runs.length > 0 || sync.dirty || !sync.base || !!changes(sync, collect());
    },
    /* Wann zuletzt mit dem Server gesprochen wurde (Zeitstempel) oder 0. */
    lastSync: function () { return lastContact; },

    init: function () {
      if (location.protocol === 'file:') return Promise.resolve();
      if (!A._hooked && typeof window !== 'undefined') {
        A._hooked = true;
        // Jede Gelegenheit nutzen: wieder Netz, wieder im Vordergrund, und zwischendurch in ruhigem Takt.
        window.addEventListener('online', function () { A.check(true); });
        window.addEventListener('focus', function () { A.check(); });
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'hidden') A.flush(); else A.check();
        });
        window.addEventListener('pagehide', function () { A.flush(); });
        setInterval(function () { if (document.visibilityState !== 'hidden') A.check(); }, 60000);
      }
      return enqueue(function () {
        return call('GET', 'api/me').then(function (response) {
          if (response.status === 200 && response.data && response.data.user) {
            A.available = true;
            return settle(response.data);
          }
          if (response.status === 401 && response.data && response.data.error === 'auth') {
            A.available = true;
            expired();
          }
          // Sonst antwortet kein Server (kein Netz): Ein hier angemeldetes Konto bleibt gemerkt.
          return false;
        });
      });
    },

    /* Beim Server nachsehen, ob ein anderes Gerät Neueres gespeichert hat, und Liegengebliebenes nachreichen.
       Höchstens alle paar Sekunden, außer mit now. */
    check: function (now) {
      if (!A._hooked) return Promise.resolve(false);
      if (!now && Date.now() - lastContact < 8000 && A.syncState !== 'offline') return Promise.resolve(false);
      if (!A.user) {
        // Noch kein Konto erreicht (ohne Netz gestartet) oder Sitzung fort: erneut vorstellen, wenn hier eines angemeldet war.
        return readSync().user && !A.available ? A.init() : Promise.resolve(false);
      }
      lastContact = Date.now();
      return enqueue(function () {
        return flushRuns().then(function () { return pushOnce({ check: true }, 0); });
      });
    },

    /* Sofort sichern, was noch aussteht (die Seite verschwindet gleich: App im Hintergrund, Tab geschlossen). */
    flush: function () {
      if (!A.user || !timer) return Promise.resolve(false);
      return push({ keepalive: true });
    },

    register: function (username, password, email) {
      return call('POST', 'api/register', { username: username, password: password, email: email, local: localStats() }).then(entered);
    },

    login: function (username, password) {
      return call('POST', 'api/login', { username: username, password: password, local: localStats() }).then(entered);
    },

    logout: function () {
      // Vorher geht noch hinauf, was ansteht – danach gehört der Stand auf dem Gerät keinem Konto mehr.
      return push({}).then(function () { return call('POST', 'api/logout', {}); }).then(function (response) {
        signedOut();
        return result(response);
      });
    },

    remove: function (password) {
      return call('POST', 'api/account/delete', { password: password }).then(function (response) {
        var out = result(response);
        if (out.ok) signedOut();
        return out;
      });
    },

    requestReset: function (email) {
      return call('POST', 'api/reset/request', { email: email }).then(function (response) { return result(response); });
    },

    confirmReset: function (token, password) {
      return call('POST', 'api/reset/confirm', { token: token, password: password }).then(entered);
    },

    /* Meldet einen beendeten Run an die Statistik des Kontos; ohne Anmeldung passiert nichts. Ohne Netz wird er
       gemerkt und nachgereicht. Der Fortschritt selbst (Asche, geöffnetes Casino) geht über den Abgleich. */
    reportRun: function (info) {
      // Kennung, an der der Server eine wiederholte Meldung erkennt
      info.id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
      if (!A.user) {
        if (away()) queueRun(info);
        return Promise.resolve();
      }
      return call('POST', 'api/run', info).then(function (response) {
        if (response.status === 200 && response.data) { adoptStats(response.data); emit(); }
        else if (response.status === 401) { queueRun(info); expired(); }
        else if (response.status === 0 || response.status === 429 || response.status >= 500) queueRun(info);
      });
    }
  };

  ZU.Profile.onSave = schedule;
  ZU.Run.onSave = schedule;

  ZU.account = A;
})(window.ZU = window.ZU || {});
