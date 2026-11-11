/* Zündung – App und Vollbild: Installation als App (Startbildschirm) und die Vollbild-Abfrage auf Touch-Geräten. */
(function (ZU) {
  'use strict';

  var ASKED = 'zuendung.fullscreen.asked'; // sessionStorage: je Besuch nur einmal fragen
  var installEvent = null, listeners = [];
  function changed() { listeners.slice().forEach(function (fn) { fn(); }); }
  function media(query) { return !!(window.matchMedia && window.matchMedia(query).matches); }

  /* Als App gestartet (ohne Browserleisten). Beim Laden bestimmt: Die Abfrage „display-mode: fullscreen"
     träfe später auch auf das Vollbild im Browser zu. */
  var installed = media('(display-mode: fullscreen)') || media('(display-mode: standalone)') || navigator.standalone === true;

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
    canFullscreen: function () { return !!document.fullscreenEnabled && !!document.documentElement.requestFullscreen; },
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
      // Ohne Server (Datei per Doppelklick geöffnet) gibt es keine App-Hülle.
      if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      }
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
      var actions = [];
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
