/* Zündung – App und Vollbild: Installation als App (Startbildschirm), die Vollbild-Abfrage auf Touch-Geräten
   und das Angebot der Android-App (Download von der eigenen Seite, siehe android/README.md). */
(function (ZU) {
  'use strict';

  var ASKED = 'zuendung.fullscreen.asked'; // sessionStorage: je Besuch nur einmal fragen
  var installEvent = null, listeners = [];
  function changed() { listeners.slice().forEach(function (fn) { fn(); }); }
  function media(query) { return !!(window.matchMedia && window.matchMedia(query).matches); }

  /* Als App gestartet (ohne Browserleisten). Beim Laden bestimmt: Die Abfrage „display-mode: fullscreen"
     träfe später auch auf das Vollbild im Browser zu. */
  var installed = media('(display-mode: fullscreen)') || media('(display-mode: standalone)') || navigator.standalone === true;
  /* Die Android-App meldet sich über window.ZuendungApp; sie ist immer „installiert“ und im Vollbild. */
  var shell = window.ZuendungApp || null, shellInfo = null;
  if (shell) {
    installed = true;
    try { shellInfo = JSON.parse(shell.info()); } catch (e) { shellInfo = {}; }
  }
  var android = null; // Angebot des Servers: { name, url, size, update }

  // Chrome und verwandte Browser melden so, dass sich die Seite installieren lässt; der Dialog darf erst nach einem Tipp erscheinen.
  window.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); installEvent = ev; changed(); });
  window.addEventListener('appinstalled', function () { installEvent = null; changed(); });
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement) unlockOrientation();
    changed();
  });

  function unlockOrientation() {
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* nicht unterstützt */ }
  }

  var app = {
    isInstalled: function () { return installed; },
    /* Läuft in der Android-App (nicht im Browser). */
    isShell: function () { return !!shell; },
    isAndroid: function () { return /Android/i.test(navigator.userAgent); },
    /* Die Android-App zum Herunterladen: im Browser auf Android-Geräten das Angebot, in der App nur eine
       neuere Fassung der App selbst (update: true). null, solange der Server keine anbietet. */
    android: function () { return android; },
    /* Öffnet den Download; in der App über den Browser des Geräts. */
    androidSize: function () { return android && android.size ? Math.round(android.size / 1048576) + ' MB' : ''; },
    downloadAndroid: function () {
      if (!android) return;
      var url = new URL(android.url, location.href).href;
      if (shell) { try { shell.open(url); return; } catch (e) { /* dann wie im Browser */ } }
      location.href = url;
    },
    /* Geräte, die vor allem mit dem Finger bedient werden (Handy, Tablet). */
    isTouch: function () { return media('(pointer: coarse)'); },
    /* iPhone und iPad: keine Installation per Knopf, nur über „Teilen → Zum Home-Bildschirm". */
    isIOS: function () {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    },
    canInstall: function () { return !!installEvent && !installed; },
    /* Öffnet den Installationsdialog des Browsers; braucht einen Tipp oder Klick als Auslöser. */
    install: function () {
      var ev = installEvent;
      installEvent = null;
      changed();
      if (!ev) return Promise.resolve();
      return Promise.resolve(ev.prompt()).catch(function () {});
    },
    canFullscreen: function () { return !shell && !!document.fullscreenEnabled && !!document.documentElement.requestFullscreen; },
    isFullscreen: function () { return !!document.fullscreenElement; },
    enterFullscreen: function () {
      if (!app.canFullscreen()) return Promise.resolve();
      var entered = document.fullscreenElement ? Promise.resolve() : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      return Promise.resolve(entered).then(function () {
        // Der Tisch ist quer angelegt; Handys, die es erlauben, bleiben im Vollbild dabei.
        if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape');
      }).catch(function () { /* abgelehnt oder nicht unterstützt */ });
    },
    leaveFullscreen: function () {
      unlockOrientation();
      if (!document.fullscreenElement) return Promise.resolve();
      return Promise.resolve(document.exitFullscreen()).catch(function () {});
    },
    toggleFullscreen: function () { return app.isFullscreen() ? app.leaveFullscreen() : app.enterFullscreen(); },
    /* Zurück-Taste der Android-App: schließt den obersten Dialog, pausiert den Run oder geht ins Hauptmenü.
       false heißt: Hier gibt es nichts mehr zu schließen (die App legt sich dann in den Hintergrund). */
    back: function () {
      var game = ZU.game;
      if (!game || !game.screen) return false;
      if (ZU.modal.isOpen()) {
        var top = ZU.modal.top();
        if (top && !top.locked) ZU.modal.close(top);
        return true;
      }
      if (game.screen === 'menu') return false;
      if (game.run && game.screen !== 'starter') game.pause(); else game.toMenu();
      return true;
    },
    /* Meldet Änderungen (installierbar geworden, installiert, Vollbild an/aus); gibt die Abmeldung zurück. */
    onChange: function (fn) {
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },
    /* Vollbild beim Start: 'ask' fragt je Besuch einmal, 'always' wechselt beim ersten Tipp, 'never' lässt es. */
    startMode: function (game) {
      var mode = game.profile.settings.fullscreen;
      return mode === 'always' || mode === 'never' ? mode : 'ask';
    },
    iosHint: 'Teilen-Symbol antippen, dann „Zum Home-Bildschirm“.',

    init: function (game) {
      // Ohne Server (Datei per Doppelklick geöffnet) gibt es keine App-Hülle; die Android-App bringt ihre eigene mit.
      if (!shell && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      }
      loadAndroid();
      if (installed || !app.isTouch()) return;
      var mode = app.startMode(game);
      if (mode === 'always' && app.canFullscreen()) {
        // Browser erlauben das Vollbild nur als Antwort auf einen Tipp.
        window.addEventListener('pointerup', function () { app.enterFullscreen(); }, { once: true });
      } else if (mode === 'ask') {
        startPrompt(game);
      }
    }
  };

  /* Fragt den Server nach der Android-App (app/android.json). Fehlt sie, bleibt das Angebot aus. */
  function loadAndroid() {
    if (!window.fetch || !/^https?:$/.test(location.protocol) || !(shell || app.isAndroid())) return;
    fetch('app/android.json', { cache: 'no-store' }).then(function (res) { return res.ok ? res.json() : null; }).then(function (info) {
      if (!info || typeof info.file !== 'string' || !/^[\w.-]+\.apk$/.test(info.file)) return;
      var code = Math.floor(Number(info.versionCode)) || 0;
      if (shell && !(code > (Number(shellInfo.versionCode) || 0))) return;
      android = { name: String(info.versionName || ''), url: 'app/' + info.file, size: Number(info.size) || 0, update: !!shell };
      changed();
    }).catch(function () { /* kein Netz oder kein Angebot */ });
  }

  function wasAsked() {
    try { return sessionStorage.getItem(ASKED) === '1'; } catch (e) { return false; }
  }

  /* Die Abfrage liegt über dem ganzen Fenster und nicht auf der skalierten Bühne: Im Hochformat wäre sie dort winzig. */
  function startPrompt(game) {
    if (wasAsked() || app.isFullscreen()) return;
    // Auf dem iPhone gibt es kein Vollbild im Browser; dort bleibt nur der Hinweis auf die App.
    if (!app.canFullscreen() && !app.isIOS() && !app.canInstall()) {
      var off = app.onChange(function () { if (app.canInstall()) { off(); startPrompt(game); } });
      return;
    }
    var h = ZU.h, btn = ZU.btn;
    var wrap = h('div', 'appask', null, { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Vollbild und App' });
    var offChange, closed = false;

    function done(mode) {
      if (closed) return;
      closed = true;
      try { sessionStorage.setItem(ASKED, '1'); } catch (e) { /* dann eben beim nächsten Laden wieder */ }
      if (mode) { game.profile.settings.fullscreen = mode; game.saveProfile(); }
      offChange();
      window.removeEventListener('keydown', onKey, true);
      wrap.remove();
    }
    /* Solange die Abfrage offen ist, gehen Tasten nicht ans Spiel; Esc heißt „Nicht jetzt". */
    function onKey(ev) {
      ev.stopPropagation();
      if (ev.code === 'Escape') done();
    }
    function render() {
      var full = app.canFullscreen(), install = app.canInstall(), ios = !install && app.isIOS();
      var apk = app.android(), actions = [];
      if (apk) actions.push(btn('Android-App laden', 'ember', function () { done(); app.downloadAndroid(); }));
      if (install) actions.push(btn('Als App installieren', 'ember', function () { done(); app.install(); }));
      if (full) actions.push(btn('Vollbild', 'ember', function () { done(); app.enterFullscreen(); }));
      actions.push(btn(full || install ? 'Nicht jetzt' : 'Alles klar', full || install ? 'felt' : 'ember', function () { done(); }));
      actions.push(btn('Nie fragen', '', function () { done('never'); }));
      var hint = install ? 'als App auf dem Startbildschirm: startet immer im Vollbild und im Querformat.'
        : ios ? 'als App auf dem Home-Bildschirm, ohne Browserleisten: ' + app.iosHint : '';
      wrap.replaceChildren(h('div', 'appask-card', [
        h('h2', null, full ? 'Im Vollbild spielen?' : 'Als App spielen?'),
        full ? h('p', null, 'Mehr Platz für den Tisch, ohne Browserleisten. Das lässt sich jederzeit in den Einstellungen ändern.') : null,
        hint ? h('p', full ? 'appask-app' : null, (full ? 'Oder ' : 'Zündung läuft auch ') + hint) : null,
        apk ? h('p', 'appask-app', 'Die Android-App' + (app.androidSize() ? ' (' + app.androidSize() + ')' : '') + ' bringt das ganze Spiel mit und läuft auch ohne Internet.') : null,
        h('div', 'appask-actions', actions)
      ]));
    }

    render();
    // „Installierbar" meldet der Browser oft erst kurz nach dem Laden; dann kommt der Knopf nach.
    offChange = app.onChange(function () { if (app.isFullscreen() || installed) done(); else render(); });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(wrap);
  }

  ZU.app = app;
})(window.ZU = window.ZU || {});
