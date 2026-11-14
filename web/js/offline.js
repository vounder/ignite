/* Zündung – Offline spielen und Updates. Legt das ganze Spiel im Gerätespeicher ab, damit es ohne Netz
   startet, und holt neue Fassungen nach.

   Im Browser und als installierte Web-App: Die Dateien liegen im Cache Storage, ausgeliefert vom Service
   Worker (sw.js, dort steht auch die Ablage). In der Android-App liegen sie in der App selbst; Prüfen und
   Laden übernimmt dort die App (window.ZuendungApp), hier laufen nur Anzeige und Neustart.

   Ablauf: Der Server nennt unter files.json jede Datei mit SHA-256 und eine Kennung der ganzen Fassung.
   Weicht sie von der gespeicherten ab, werden nur die geänderten Dateien geladen, geprüft und als neue
   Fassung abgelegt. Übernommen wird sie mit dem nächsten Start der Seite – beim Spielstart sofort, sonst
   über den Hinweis im Hauptmenü. Ohne Netz läuft einfach die gespeicherte Fassung. */
(function (ZU) {
  'use strict';

  var STATE = 'zu-state', PREFIX = 'zu-build-';
  var SCOPE = new URL('./', location.href).href;
  var STATE_URL = SCOPE + '__offline/state', LIST_URL = SCOPE + '__offline/files.json';
  var KEEP = ['Content-Type', 'Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'X-Frame-Options'];
  var RECHECK = 30 * 60 * 1000;
  var bridge = window.ZuendungApp || null; // Android-App
  var listeners = [], game = null, runToken = 0, lastCheck = 0, appWait = null;

  /* state: off | check | load | ready | update | error.  have: Es liegt eine vollständige Fassung auf dem Gerät. */
  var status = { state: 'off', done: 0, total: 0, have: false };
  function set(state, extra) {
    status.state = state;
    if (state !== 'load') { status.done = 0; status.total = 0; }
    if (extra) Object.keys(extra).forEach(function (key) { status[key] = extra[key]; });
    listeners.slice().forEach(function (fn) { fn(status); });
  }

  function supported() {
    return !bridge && /^https?:$/.test(location.protocol) && 'serviceWorker' in navigator && !!window.caches
      && !!(window.crypto && crypto.subtle) && typeof AbortController === 'function';
  }
  /* Gewünscht ist die Ablage in der installierten Web-App immer, im Browser nur auf Wunsch (Einstellungen). */
  function wanted(settings) {
    return ZU.app.isInstalled() || settings.offline === true;
  }
  /* Bittet den Browser, den Speicher nicht von sich aus zu leeren. */
  function persist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) { /* nicht unterstützt */ }
  }

  /* ---------- Ablage ---------- */
  function readState() {
    return caches.match(STATE_URL, { cacheName: STATE })
      .then(function (hit) { return hit ? hit.json() : {}; })
      .catch(function () { return {}; })
      .then(function (state) { return state || {}; });
  }
  function tellWorker() {
    return navigator.serviceWorker.getRegistration().then(function (reg) {
      if (reg && reg.active) reg.active.postMessage({ type: 'zu-state' });
    }).catch(function () {});
  }
  function writeState(state) {
    return caches.open(STATE).then(function (cache) {
      return cache.put(STATE_URL, new Response(JSON.stringify(state), { headers: { 'Content-Type': 'application/json' } }));
    }).then(tellWorker);
  }
  function hasBuild(build) {
    if (!build) return Promise.resolve(false);
    return caches.has(PREFIX + build).then(function (there) {
      if (!there) return false;
      return caches.open(PREFIX + build).then(function (cache) { return cache.match(LIST_URL); }).then(function (hit) { return !!hit; });
    }).catch(function () { return false; });
  }
  function sweep(state) {
    return caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        if (name.indexOf(PREFIX) !== 0) return null;
        var build = name.slice(PREFIX.length);
        return build === state.current || build === state.staged ? null : caches.delete(name);
      }));
    }).catch(function () {});
  }
  function clear() {
    return caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) {
        return name === STATE || name.indexOf(PREFIX) === 0 ? caches.delete(name) : null;
      }));
    }).then(tellWorker).catch(function () {});
  }

  /* ---------- Laden ---------- */
  function remoteList(ms) {
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, ms);
    return fetch('files.json', { cache: 'no-store', signal: ctl.signal }).then(function (res) {
      if (!res.ok) throw new Error('files.json: ' + res.status);
      return res.json();
    }).then(function (list) {
      clearTimeout(timer);
      if (!list || typeof list.build !== 'string' || !list.files || !list.files['index.html']) throw new Error('files.json: Inhalt');
      return list;
    }, function (error) {
      clearTimeout(timer);
      throw error;
    });
  }

  function sha256(buffer) {
    return crypto.subtle.digest('SHA-256', buffer).then(function (digest) {
      return Array.prototype.map.call(new Uint8Array(digest), function (b) { return (b < 16 ? '0' : '') + b.toString(16); }).join('');
    });
  }

  /* Holt eine Datei am Service Worker vorbei und prüft sie gegen die Liste. shared: Die Seite läuft gerade
     selbst vom Netz – dann zuerst die Adresse, unter der das Spiel die Datei ohnehin lädt (liegt meist schon
     im Browser-Zwischenspeicher). Sonst und bei Abweichung: eine Adresse, die am Inhalt hängt. */
  function download(rel, hash, shared) {
    var exact = rel + '?v=' + hash.slice(0, 12), urls = shared ? [rel + '?v=' + ZU.BUILD, exact] : [exact];
    function attempt(i) {
      var retry = i + 1 < urls.length;
      return fetch(urls[i], { headers: { 'X-Zu-Direct': '1' }, cache: i > 0 ? 'reload' : 'default' }).then(function (res) {
        if (!res.ok) throw new Error(rel + ': ' + res.status);
        return res.arrayBuffer().then(function (buffer) {
          return sha256(buffer).then(function (got) {
            if (got !== hash) throw new Error(rel + ': Inhalt passt nicht zur Liste');
            var headers = { 'X-Zu-Hash': hash, 'Content-Length': String(buffer.byteLength) };
            KEEP.forEach(function (name) { var value = res.headers.get(name); if (value) headers[name] = value; });
            return new Response(buffer, { headers: headers });
          });
        });
      }).catch(function (error) {
        if (retry) return attempt(i + 1);
        throw error;
      });
    }
    return attempt(0);
  }

  /* Legt die Fassung "list" vollständig ab. Was die laufende Fassung unverändert enthält, wird von dort
     übernommen; was von einem abgebrochenen Versuch schon da ist, bleibt. */
  function fill(list, state, token, progress) {
    var rels = Object.keys(list.files), shared = !state.current, done = 0, next = 0;
    return Promise.all([
      caches.open(PREFIX + list.build),
      state.current ? caches.open(PREFIX + state.current) : null
    ]).then(function (opened) {
      var cache = opened[0], old = opened[1];
      var before = old ? old.match(LIST_URL).then(function (hit) { return hit ? hit.json() : null; }).catch(function () { return null; }) : Promise.resolve(null);
      return before.then(function (oldList) {
        function fresh(rel, want) {
          return download(rel, want[0], shared).then(function (res) { return cache.put(SCOPE + rel, res); });
        }
        function one(rel) {
          var want = list.files[rel], url = SCOPE + rel;
          return cache.match(url).then(function (hit) {
            if (hit && hit.headers.get('X-Zu-Hash') === want[0]) return null;
            if (oldList && oldList.files && oldList.files[rel] && oldList.files[rel][0] === want[0]) {
              return old.match(url).then(function (prev) { return prev ? cache.put(url, prev) : fresh(rel, want); });
            }
            return fresh(rel, want);
          }).then(function () {
            done += want[1];
            progress(done);
          });
        }
        function worker() {
          if (token !== runToken) return Promise.reject(new Error('abgebrochen'));
          if (next >= rels.length) return Promise.resolve();
          return one(rels[next++]).then(worker);
        }
        return Promise.all([worker(), worker(), worker(), worker()]);
      }).then(function () {
        return cache.put(LIST_URL, new Response(JSON.stringify(list), { headers: { 'Content-Type': 'application/json' } }));
      });
    });
  }

  /* Prüft gegen den Server und lädt bei Bedarf. wait: so lange (ms) darf die Antwort des Servers dauern.
     Ergebnis: null (nichts zu tun oder kein Netz) oder { update, done }. update: Es ersetzt eine laufende
     Fassung; done wird wahr, sobald die neue bereitliegt und ein Neustart sie übernimmt. */
  function run(wait) {
    var token = ++runToken;
    lastCheck = Date.now();
    return readState().then(function (state) {
      return hasBuild(state.current).then(function (have) {
        if (!have) state = {}; // der Browser hat den Speicher geleert
        set('check', { have: have });
        return remoteList(wait).then(function (list) {
          if (token !== runToken) return null;
          if (state.current === list.build) { set('ready'); return null; }
          set('load', { done: 0, total: list.bytes });
          var done = fill(list, state, token, function (bytes) {
            if (token === runToken) set('load', { done: bytes, total: list.bytes });
          }).then(function () {
            if (token !== runToken) return false;
            // Läuft die Seite aus dem Speicher, wartet die neue Fassung auf den Neustart; kam sie vom Netz, ist sie es schon.
            var later = have && !!navigator.serviceWorker.controller;
            var next = later ? { current: state.current, staged: list.build } : { current: list.build };
            return writeState(next).then(function () {
              if (!later) sweep(next);
              set(later ? 'update' : 'ready', { have: true });
              return later;
            });
          }).catch(function () {
            if (token === runToken) set('error');
            return false;
          });
          return { update: have, done: done };
        }, function () {
          if (token === runToken) set(have ? 'ready' : 'error');
          return null;
        });
      });
    }).catch(function () {
      if (token === runToken) set('error');
      return null;
    });
  }

  /* ---------- Android-App ---------- */
  function appCheck(wait) {
    lastCheck = Date.now();
    set('check', { have: true });
    return new Promise(function (resolve) {
      var job = null, finish = null;
      var timer = setTimeout(function () { if (!job) { appWait = null; resolve(null); } }, wait);
      appWait = function (message) {
        if (message.state === 'load') {
          if (job) return;
          clearTimeout(timer);
          job = { update: true, done: new Promise(function (ok) { finish = ok; }) };
          resolve(job);
          return;
        }
        clearTimeout(timer);
        appWait = null;
        if (job) finish(message.state === 'update'); else resolve(null);
      };
      try { bridge.check(); } catch (e) { clearTimeout(timer); appWait = null; set('ready'); resolve(null); }
    });
  }

  var O = {
    status: status,
    /* In der Android-App: Das Spiel liegt in der App, Updates lädt sie selbst. */
    inApp: function () { return !!bridge; },
    supported: supported,
    wanted: function () { return !!bridge || (!!game && supported() && wanted(game.profile.settings)); },
    onChange: function (fn) {
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },

    /* Beim Start des Spiels, noch während des Vorspanns. Liefert ein Versprechen: null, wenn es nichts
       abzuwarten gibt, sonst das laufende Update ({ done }), auf das der Ladebildschirm wartet. */
    begin: function (g) {
      game = g;
      document.addEventListener('visibilitychange', function () {
        if (document.hidden || !O.wanted() || Date.now() - lastCheck < RECHECK) return;
        if (status.state === 'ready' || status.state === 'error') O.check();
      });
      if (bridge) return appCheck(2500);
      if (!supported() || !wanted(g.profile.settings)) return Promise.resolve(null);
      persist();
      return readState().then(function (state) { return hasBuild(state.current); }).then(function (have) {
        if (have) return run(2500).then(function (job) { return job && job.update ? job : null; });
        // Erste Ablage: im Hintergrund, und erst, wenn der Titel steht.
        set('check');
        setTimeout(function () { if (O.wanted() && status.state === 'check') run(15000); }, 5000);
        return null;
      }).catch(function () { return null; });
    },

    /* Erneut prüfen (im Hintergrund). */
    check: function () {
      if (bridge) return appCheck(15000);
      if (!O.wanted()) return Promise.resolve(null);
      return run(15000);
    },

    /* Schaltet die Ablage im Browser an oder aus (Einstellungen). */
    enable: function (on) {
      if (!game || !supported()) return;
      game.profile.settings.offline = !!on;
      game.saveProfile();
      if (on) {
        persist();
        run(15000);
      } else if (!ZU.app.isInstalled()) {
        runToken++;
        clear();
        set('off', { have: false });
      }
    },

    /* Übernimmt eine fertig geladene neue Fassung: Die Seite startet neu. */
    restart: function () {
      if (bridge) { try { bridge.apply(); return; } catch (e) { /* dann eben neu laden */ } }
      location.reload();
    },

    /* Meldungen der Android-App: { state: 'load' | 'ready' | 'update' | 'error', done, total }. */
    fromApp: function (message) {
      if (!message || typeof message.state !== 'string') return;
      set(message.state, { done: Number(message.done) || 0, total: Number(message.total) || 0, have: true });
      if (appWait) appWait(message);
    },

    /* Kurzer Text für die Einstellungen. */
    label: function () {
      if (status.state === 'load') return 'Lädt ' + (status.total ? Math.floor(status.done / status.total * 100) : 0) + ' %';
      if (status.state === 'check') return 'Prüft …';
      if (status.state === 'update') return 'Update bereit';
      if (status.state === 'ready') return 'Bereit';
      if (status.state === 'error') return status.have ? 'Bereit' : 'Kein Netz';
      return 'Aus';
    }
  };

  ZU.offline = O;
})(window.ZU = window.ZU || {});
