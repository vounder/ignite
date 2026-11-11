/* Zündung – Screens und Dialoge: Menü, Startschachtel, Tischwahl, Auszahlung, Belohnung, Laden, Ende. */
(function (ZU) {
  'use strict';
  var h = ZU.h, fx = ZU.fx, wait = ZU.wait;

  function btn(label, cls, onclick, tip) {
    var el = h('button', 'btn ' + (cls || ''), label);
    el.addEventListener('click', function (ev) {
      ZU.audio.unlock();
      if (el.disabled) return;
      ZU.audio.click();
      onclick(ev);
    });
    el.addEventListener('pointerenter', function () { if (!el.disabled) ZU.audio.hover(); });
    if (tip) ZU.tip.bind(el, tip);
    return el;
  }
  ZU.btn = btn;

  function mark(amount) { return ZU.fmt(amount) + ' M'; }

  /* ---------- Dialoge ---------- */
  var overlayEl, stack = [];
  ZU.modal = {
    open: function (content, opts) {
      opts = opts || {};
      overlayEl = overlayEl || document.getElementById('overlay');
      var box = h('div', 'modal ' + (opts.cls || ''), content);
      var wrap = h('div', 'modal-wrap', [box]);
      var entry = { wrap: wrap, onClose: opts.onClose, locked: !!opts.locked };
      wrap.addEventListener('pointerdown', function (ev) {
        if (ev.target === wrap && !entry.locked) ZU.modal.close(entry);
      });
      overlayEl.appendChild(wrap);
      stack.push(entry);
      ZU.tip.hide();
      return entry;
    },
    close: function (entry) {
      entry = entry || stack[stack.length - 1];
      if (!entry) return;
      var i = stack.indexOf(entry);
      if (i < 0) return;
      stack.splice(i, 1);
      entry.wrap.remove();
      ZU.tip.hide();
      if (entry.onClose) entry.onClose();
    },
    closeAll: function () { while (stack.length) ZU.modal.close(stack[stack.length - 1]); },
    isOpen: function () { return stack.length > 0; },
    top: function () { return stack[stack.length - 1]; }
  };

  function confirmBox(title, text, yes, no) {
    return new Promise(function (resolve) {
      var done = false, entry;
      function finish(value) { if (done) return; done = true; ZU.modal.close(entry); resolve(value); }
      entry = ZU.modal.open([
        h('h2', null, title),
        h('p', 'modal-text', text),
        h('div', 'btnrow', [btn(no || 'Abbrechen', 'felt', function () { finish(false); }), btn(yes || 'Ja', 'ember', function () { finish(true); })])
      ], { cls: 'small', onClose: function () { finish(false); } });
    });
  }

  /* Trinket zum Ersetzen wählen, wenn alle Plätze belegt sind. */
  function pickTrinket(game, text) {
    return new Promise(function (resolve) {
      var done = false, entry;
      function finish(value) { if (done) return; done = true; ZU.modal.close(entry); resolve(value); }
      var row = h('div', 'pickrow');
      game.run.s.trinkets.forEach(function (id) {
        var el = ZU.trinketEl(id);
        el.classList.add('big', 'clickable');
        el.addEventListener('click', function () { ZU.audio.click(); finish(id); });
        row.appendChild(h('div', 'pickitem', [el, h('span', null, ZU.TRINKETS[id].name)]));
      });
      entry = ZU.modal.open([
        h('h2', null, 'Alle Plätze belegt'),
        h('p', 'modal-text', text),
        row,
        h('div', 'btnrow', [btn('Abbrechen', 'felt', function () { finish(null); })])
      ], { onClose: function () { finish(null); } });
    });
  }

  function sortedCollection(run) {
    return run.s.collection.slice().sort(function (a, b) {
      var da = ZU.CARDS[a.def], db = ZU.CARDS[b.def];
      if (da.special !== db.special) return da.special ? 1 : -1;
      if (da.special) return da.rarity - db.rarity || da.name.localeCompare(db.name);
      return ZU.RANKS[da.rank].order - ZU.RANKS[db.rank].order || ZU.SUIT_ORDER.indexOf(da.suit) - ZU.SUIT_ORDER.indexOf(db.suit);
    });
  }

  /* Deck-Übersicht; im Verbrennen-Modus wählt ein Klick die Karte aus. */
  function deckModal(game, burn) {
    return new Promise(function (resolve) {
      var run = game.run, done = false, entry;
      function finish(value) { if (done) return; done = true; ZU.modal.close(entry); resolve(value); }
      var grid = h('div', 'deckgrid');
      sortedCollection(run).forEach(function (card) {
        var el = ZU.cardStatic(ZU.CARDS[card.def], { cls: burn ? 'clickable burnable' : '' });
        if (burn) el.addEventListener('click', function () {
          ZU.audio.burn();
          var p = ZU.stagePos(el);
          fx.burst(p.x, p.y, { n: 40, speed: 300, life: 1.3 });
          fx.smoke(p.x, p.y, 16);
          el.classList.add('burning');
          setTimeout(function () { finish(card.id); }, 420);
        });
        grid.appendChild(el);
      });
      entry = ZU.modal.open([
        h('h2', null, burn ? 'Welche Karte soll brennen?' : 'Dein Deck · ' + run.s.collection.length + ' Karten'),
        h('p', 'modal-text', burn
          ? 'Die Karte wird dauerhaft aus deinem Deck entfernt. Ein schlankes Deck bringt deine besten Karten sicher auf die Starthand.'
          : 'Zu Duellbeginn ziehst du ' + ZU.HAND_SIZE + ' Karten aus deinem Deck. Der Rest wird in den gemeinsamen Nachziehstapel gemischt.'),
        grid,
        h('div', 'btnrow', [btn(burn ? 'Doch nicht' : 'Schließen', 'felt', function () { finish(null); })])
      ], { cls: 'wide', onClose: function () { finish(null); } });
    });
  }
  ZU.deckModal = deckModal;

  function helpModal() {
    var entry = ZU.modal.open([
      h('h2', null, 'So wird gezündet'),
      h('div', 'help', null, {
        html:
          '<div><h3>Das Duell</h3>' +
          '<p>Mau-Mau gegen den Dealer: Lege eine Karte mit <b>gleicher Farbe</b> oder <b>gleichem Wert</b> auf den Stapel. Wer zuerst keine Karten mehr hat, gewinnt.</p>' +
          '<p>Ein <b>Klick</b> auf eine passende Handkarte spielt sie sofort.</p>' +
          '<p><b>Mehrfachwahl:</b> Mit dem Trinket „Flinke Finger“ legst du mehrere Karten mit gleichem Wert in einem Zug. Der Schalter dafür erscheint rechts am Tisch.</p>' +
          '<p><b>Die 7:</b> Der Gegner zieht 2 Karten und setzt aus.</p>' +
          '<p><b>Spezialkarten</b> sind Joker: Sie passen immer, und danach darf alles gelegt werden.</p>' +
          '<p>Kannst oder willst du nicht legen, <b>ziehst</b> du eine Karte. Das beendet den Zug.</p>' +
          '<p><b>Sperrstunde:</b> Nach ' + ZU.TURN_LIMIT + ' Zügen gewinnt, wer weniger Karten hält.</p></div>' +
          '<div><h3>Glut und Mark</h3>' +
          '<p>Jede gespielte Karte bringt <b>Glut</b>: Kartenwert × Kette. Die Kette wächst mit jeder Karte und fällt zurück, wenn du ziehst.</p>' +
          '<p>Siege zahlen <b>Mark</b>: Tischprämie, Restkarten des Gegners, Glut-Bonus, Bank und Zinsen (1 Mark je 5 gesparte Mark).</p>' +
          '<h3>Der Run</h3>' +
          '<p>Drei Akte mit je drei Tischen: Gegner, Elite, Boss. Dazwischen wartet <b>Manfreds Laden</b> mit Karten, Trinkets und Diensten.</p>' +
          '<p>Dein <b>Deck</b> bestimmt deine Starthand: Du ziehst zu Beginn 7 Karten daraus.</p>' +
          '<p>Eine Niederlage kostet ein <b>Streichholz</b>. Sind alle drei abgebrannt, endet der Run.</p>' +
          '<p class="dim">Tasten: 1–9 spielt Karten · Leertaste zieht · Enter legt die Auswahl · Esc Menü</p></div>'
      }),
      h('div', 'btnrow', [btn('Alles klar', 'ember', function () { ZU.modal.close(entry); })])
    ], { cls: 'wide' });
    return entry;
  }
  ZU.helpModal = helpModal;

  function settingsModal(game, inRun) {
    var settings = game.profile.settings, entry;
    function slider(label, key, apply) {
      var input = h('input', null, null, { type: 'range', min: '0', max: '100', value: String(Math.round(settings[key] * 100)) });
      input.addEventListener('input', function () {
        settings[key] = Number(input.value) / 100;
        apply(settings[key]);
        game.saveProfile();
      });
      input.addEventListener('change', function () { ZU.audio.chip(); });
      return h('label', 'setrow', [h('span', null, label), input]);
    }
    var speeds = h('div', 'segmented');
    [0.75, 1, 1.5, 2].forEach(function (value) {
      var b = btn('×' + String(value).replace('.', ','), 'small' + (settings.speed === value ? ' on' : ''), function () {
        settings.speed = value;
        game.applySettings();
        game.saveProfile();
        Array.prototype.forEach.call(speeds.children, function (c) { c.classList.remove('on'); });
        b.classList.add('on');
      });
      speeds.appendChild(b);
    });
    var crt = btn(settings.crt ? 'An' : 'Aus', 'small' + (settings.crt ? ' on' : ''), function () {
      settings.crt = !settings.crt;
      crt.textContent = settings.crt ? 'An' : 'Aus';
      crt.classList.toggle('on', settings.crt);
      game.applySettings();
      game.saveProfile();
    });
    var rows = [
      h('h2', null, inRun ? 'Pause' : 'Einstellungen'),
      slider('Musik', 'music', function (v) { ZU.audio.setMusic(v); }),
      slider('Effekte', 'sfx', function (v) { ZU.audio.setSfx(v); }),
      h('div', 'setrow', [h('span', null, 'Tempo'), speeds]),
      h('div', 'setrow', [h('span', null, 'Röhren-Filter'), crt]),
      h('div', 'setrow', [h('span', null, 'Vollbild'), btn('Umschalten', 'small', function () {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {});
      })])
    ];
    var buttons = [btn(inRun ? 'Weiterspielen' : 'Schließen', 'ember', function () { ZU.modal.close(entry); })];
    if (inRun) {
      buttons.unshift(btn('Anleitung', 'felt', function () { helpModal(); }));
      buttons.unshift(btn('Hauptmenü', 'felt', function () {
        confirmBox('Zum Hauptmenü?', 'Der Run bleibt gespeichert. Ein laufendes Duell beginnt beim Weiterspielen von vorn.', 'Zum Menü').then(function (yes) {
          if (yes) { ZU.modal.closeAll(); game.toMenu(); }
        });
      }));
      rows.push(h('div', 'setrow', [h('span', null, 'Run'), btn('Aufgeben', 'small danger', function () {
        confirmBox('Run aufgeben?', 'Der aktuelle Run wird beendet und gelöscht.', 'Aufgeben').then(function (yes) {
          if (yes) { ZU.modal.closeAll(); game.abandon(); }
        });
      })]));
    }
    rows.push(h('div', 'btnrow', buttons));
    rows.push(h('div', 'legalrow', [linkBtn('Rechtliches', legalMenu)]));
    entry = ZU.modal.open(rows, { cls: 'small settings' });
    return entry;
  }
  ZU.settingsModal = settingsModal;

  /* ---------- Rechtliches (Untermenü der Einstellungen) ---------- */
  function linkBtn(label, onclick) {
    var el = h('button', 'linkbtn', label, { type: 'button' });
    el.addEventListener('click', function () { ZU.audio.click(); onclick(); });
    return el;
  }

  function legalText(title, html) {
    var entry = ZU.modal.open([
      h('h2', null, title),
      h('div', 'legaltext', null, { html: html }),
      h('div', 'btnrow', [btn('Zurück', 'felt', function () { ZU.modal.close(entry); })])
    ], { cls: 'legal' });
  }

  function legalMenu() {
    var entry = ZU.modal.open([
      h('h2', null, 'Rechtliches'),
      h('div', 'legalmenu', [
        btn('Impressum', 'felt', function () { legalText('Impressum', ZU.LEGAL.imprint()); }),
        btn('Datenschutz', 'felt', function () { legalText('Datenschutz', ZU.LEGAL.privacy()); }),
        btn('Lizenzen', 'felt', function () { legalText('Lizenzen', ZU.LEGAL.licenses()); })
      ]),
      h('div', 'btnrow', [btn('Zurück', 'felt', function () { ZU.modal.close(entry); })])
    ], { cls: 'small' });
  }

  /* ---------- Konto ---------- */
  var ACCOUNT_ERRORS = {
    bad_name: 'Name: 3–20 Zeichen, nur Buchstaben, Ziffern, _ und -.',
    bad_password: 'Passwort: mindestens 8 Zeichen.',
    bad_email: 'E-Mail ungültig.',
    taken_name: 'Name vergeben.',
    taken_email: 'E-Mail vergeben.',
    bad_login: 'Name oder Passwort falsch.',
    bad_token: 'Link abgelaufen.',
    rate: 'Zu viele Versuche. Kurz warten.',
    offline: 'Keine Verbindung.',
    fallback: 'Das hat nicht geklappt.'
  };

  function field(type, placeholder, autocomplete, name) {
    return h('input', 'field', null, {
      type: type, placeholder: placeholder, autocomplete: autocomplete, name: name,
      spellcheck: 'false', autocapitalize: 'off', maxlength: '254'
    });
  }

  /* Formular mit Fehlerzeile; "send" liefert ein Promise mit { ok, error }. */
  function accountForm(fields, submitLabel, send, onOk) {
    var error = h('div', 'formerror', '');
    var submit = btn(submitLabel, 'ember', function () {});
    var form = h('form', 'form', fields.concat([error, h('div', 'btnrow', [submit])]), { novalidate: 'novalidate' });
    var busy = false;
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (busy) return;
      busy = true;
      submit.disabled = true;
      error.textContent = '';
      send().then(function (result) {
        busy = false;
        submit.disabled = false;
        if (result.ok) {
          ZU.audio.chip();
          onOk();
        } else {
          error.textContent = ACCOUNT_ERRORS[result.error] || ACCOUNT_ERRORS.fallback;
          fx.punch(form, 'shake');
          ZU.audio.error();
        }
      });
    });
    form._submit = submit;
    form._error = error;
    return form;
  }

  function authModal(mode) {
    var entry;
    var name = field('text', 'Name', 'username', 'username');
    var pass = field('password', 'Passwort', 'current-password', 'password');
    var email = field('email', 'E-Mail', 'email', 'email');
    var note = h('div', 'formnote', 'Nur zum Zurücksetzen des Passworts.');
    var forgot = linkBtn('Passwort vergessen?', function () {
      ZU.modal.close(entry);
      forgotModal();
    });
    var tabLogin = h('button', 'btn small', 'Anmelden', { type: 'button' });
    var tabNew = h('button', 'btn small', 'Neu', { type: 'button' });
    var form = accountForm([name, pass, email, note], 'Anmelden', function () {
      return mode === 'register'
        ? ZU.account.register(name.value.trim(), pass.value, email.value.trim())
        : ZU.account.login(name.value.trim(), pass.value);
    }, function () { ZU.modal.close(entry); });
    function setMode(next) {
      mode = next;
      var register = mode === 'register';
      email.style.display = note.style.display = register ? '' : 'none';
      forgot.style.display = register ? 'none' : '';
      pass.autocomplete = register ? 'new-password' : 'current-password';
      form._submit.textContent = register ? 'Registrieren' : 'Anmelden';
      form._error.textContent = '';
      tabLogin.classList.toggle('on', !register);
      tabNew.classList.toggle('on', register);
    }
    tabLogin.addEventListener('click', function () { ZU.audio.click(); setMode('login'); });
    tabNew.addEventListener('click', function () { ZU.audio.click(); setMode('register'); });
    entry = ZU.modal.open([
      h('h2', null, 'Konto'),
      h('div', 'segmented center', [tabLogin, tabNew]),
      form,
      h('div', 'legalrow', [forgot])
    ], { cls: 'small auth' });
    setMode(mode === 'register' ? 'register' : 'login');
    setTimeout(function () { name.focus(); }, 60);
  }
  ZU.authModal = authModal;

  function forgotModal() {
    var entry;
    var email = field('email', 'E-Mail', 'email', 'email');
    var form = accountForm([email], 'Link senden', function () {
      return ZU.account.requestReset(email.value.trim());
    }, function () {
      ZU.modal.close(entry);
      var done = ZU.modal.open([
        h('h2', null, 'Passwort zurücksetzen'),
        h('p', 'modal-text', 'Falls es ein Konto dazu gibt, ist die Mail unterwegs.'),
        h('div', 'btnrow', [btn('Okay', 'ember', function () { ZU.modal.close(done); })])
      ], { cls: 'small' });
    });
    entry = ZU.modal.open([h('h2', null, 'Passwort zurücksetzen'), form], { cls: 'small auth' });
    setTimeout(function () { email.focus(); }, 60);
  }

  /* Wird geöffnet, wenn die Seite über einen Reset-Link (?reset=…) aufgerufen wurde. */
  ZU.resetModal = function (token) {
    var entry;
    var pass = field('password', 'Neues Passwort', 'new-password', 'password');
    function clean() {
      if (window.history && history.replaceState) history.replaceState(null, '', location.pathname);
    }
    var form = accountForm([pass], 'Speichern', function () {
      return ZU.account.confirmReset(token, pass.value);
    }, function () {
      clean();
      ZU.modal.close(entry);
    });
    entry = ZU.modal.open([h('h2', null, 'Neues Passwort'), form], { cls: 'small auth', onClose: clean });
    setTimeout(function () { pass.focus(); }, 60);
  };

  function accountModal() {
    var entry, account = ZU.account, stats = account.stats || { runs: 0, wins: 0, best: 0 };
    var pass = field('password', 'Passwort', 'current-password', 'password');
    var removeForm = accountForm([pass], 'Endgültig löschen', function () {
      return account.remove(pass.value);
    }, function () { ZU.modal.close(entry); });
    removeForm.style.display = 'none';
    removeForm._submit.classList.remove('ember');
    removeForm._submit.classList.add('danger');
    entry = ZU.modal.open([
      h('h2', null, account.user.username),
      h('div', 'statsline', [
        h('span', null, ['Runs ', h('b', null, ZU.fmt(stats.runs))]),
        h('span', null, ['Siege ', h('b', null, ZU.fmt(stats.wins))]),
        h('span', null, ['Bestwert ', h('b', null, ZU.fmt(stats.best))])
      ]),
      h('div', 'btnrow', [
        btn('Abmelden', 'felt', function () { account.logout().then(function () { ZU.modal.close(entry); }); }),
        btn('Schließen', 'ember', function () { ZU.modal.close(entry); })
      ]),
      removeForm,
      h('div', 'legalrow', [linkBtn('Konto löschen', function () {
        removeForm.style.display = '';
        pass.focus();
      })])
    ], { cls: 'small auth' });
  }

  /* Kleiner Knopf oben rechts im Hauptmenü: "Anmelden" oder der eigene Name. */
  function accountSlot() {
    var slot = h('div', 'account-slot');
    function render() {
      slot.innerHTML = '';
      if (!ZU.account.available) return;
      if (ZU.account.user) slot.appendChild(btn(ZU.account.user.username, 'small on', accountModal));
      else slot.appendChild(btn('Anmelden', 'small felt', function () { authModal('login'); }));
    }
    slot._off = ZU.account.onChange(render);
    render();
    return slot;
  }

  /* Einziger Hinweis aufs Konto: am Ende eines Runs, solange man nicht angemeldet ist. */
  function accountCta() {
    if (!ZU.account.available || ZU.account.user) return null;
    var el = h('div', 'endcta', [
      h('span', null, 'Bestwert sichern?'),
      btn('Konto anlegen', 'small ember', function () { authModal('register'); })
    ]);
    var off = ZU.account.onChange(function () {
      if (ZU.account.user || !el.isConnected) { el.remove(); off(); }
    });
    return el;
  }

  /* ---------- Kopfzeile außerhalb des Duells ---------- */
  function hud(game, opts) {
    opts = opts || {};
    var run = game.run, s = run.s;
    var money = h('b', null, ZU.fmt(s.money));
    money._value = s.money;
    var lives = h('div', 'lives');
    var slots = h('div', 'trinkets');
    var deckCount = h('b', null, String(s.collection.length));
    var deckBtn = h('button', 'btn deckbtn', [ZU.iconEl('deck', 'deckico'), h('span', null, 'Deck'), deckCount]);
    deckBtn.addEventListener('click', function () { ZU.audio.click(); deckModal(game, false); });
    var scoreEl = h('b', null, ZU.fmt(s.score));
    var bar = h('div', 'hud', [
      h('div', 'hud-title', [h('b', null, 'Akt ' + ZU.roman(s.act)), h('span', null, run.actName() + ' · Tisch ' + (s.table + 1) + '/3')]),
      h('div', 'hud-score', [ZU.iconEl('flame', 'flame'), scoreEl, h('span', 'unit', 'Glut')]),
      slots,
      h('div', 'grow'),
      lives,
      h('div', 'hud-money', [ZU.iconEl('coin', 'coin'), money, h('span', 'unit', 'Mark')]),
      deckBtn,
      btn('≡', 'icon', function () { game.pause(); })
    ]);
    var api = {
      el: bar, money: money, deckBtn: deckBtn, slots: slots,
      update: function () {
        fx.count(money, s.money, 400);
        deckCount.textContent = String(s.collection.length);
        scoreEl.textContent = ZU.fmt(s.score);
        lives.innerHTML = '';
        for (var l = 0; l < ZU.MAX_LIVES; l++) lives.appendChild(ZU.iconEl(l < s.lives ? 'match' : 'matchOut', 'match'));
        slots.innerHTML = '';
        for (var i = 0; i < ZU.MAX_TRINKETS; i++) {
          var id = s.trinkets[i];
          if (!id) { slots.appendChild(h('div', 'trinket empty')); continue; }
          var el = ZU.trinketEl(id, opts.onTrinket ? function () { return 'Klicken: verkaufen'; } : null);
          if (opts.onTrinket) {
            el.classList.add('clickable');
            (function (tid) { el.addEventListener('click', function () { opts.onTrinket(tid); }); })(id);
          }
          slots.appendChild(el);
        }
      }
    };
    api.update();
    return api;
  }

  /* ---------- Hauptmenü ---------- */
  var screens = {};

  screens.menu = function (game, root) {
    ZU.bg.set('menu');
    ZU.audio.music('menu');
    var profile = game.profile, saved = ZU.Run.load();
    var deco = h('div', 'menu-deco');
    ['hearts-A', 'tausch', 'spades-7', 'zocken', 'diamonds-K', 'opfer'].forEach(function (id, i) {
      var c = h('div', 'deco-card d' + i, [ZU.cardFace(ZU.CARDS[id])]);
      c.style.animationDelay = (-i * 1.3) + 's';
      deco.appendChild(c);
    });
    var buttons = h('div', 'menu-buttons');
    if (saved) buttons.appendChild(btn('Weiterspielen', 'big ember', function () { game.continueRun(saved); }));
    buttons.appendChild(btn('Neuer Run', 'big ' + (saved ? 'felt' : 'ember'), function () {
      if (!saved) { game.go('starter'); return; }
      confirmBox('Neuen Run beginnen?', 'Der gespeicherte Run wird dabei überschrieben.', 'Neu beginnen').then(function (yes) {
        if (yes) game.go('starter');
      });
    }));
    buttons.appendChild(btn('So wird gezündet', 'felt', function () { helpModal(); }));
    buttons.appendChild(btn('Einstellungen', 'felt', function () { settingsModal(game, false); }));
    var slot = accountSlot();
    root.appendChild(h('div', 'screen menu', [
      deco,
      slot,
      h('img', 'logo', null, { src: 'assets/logo.png', alt: 'Zündung', draggable: 'false' }),
      buttons
    ]));
    if (!profile.seenHelp) {
      profile.seenHelp = true;
      game.saveProfile();
      setTimeout(function () { if (game.screen === 'menu' && !ZU.modal.isOpen()) helpModal(); }, 600);
    }
    return function () { slot._off(); };
  };

  /* ---------- Startschachtel ---------- */
  screens.starter = function (game, root) {
    ZU.bg.set('select');
    var row = h('div', 'boxes');
    ZU.STARTERS.forEach(function (starter, i) {
      var preview = h('div', 'box-preview');
      starter.cards.forEach(function (id) { preview.appendChild(ZU.cardStatic(ZU.CARDS[id], { cls: 'mini' })); });
      starter.trinkets.forEach(function (id) { preview.appendChild(ZU.trinketEl(id)); });
      if (!preview.firstChild) preview.appendChild(h('div', 'box-plain', '7 × ?'));
      var box = h('div', 'matchbox', [
        h('div', 'box-top', [h('div', 'box-name', starter.name), h('div', 'box-strip')]),
        preview,
        h('p', null, starter.text),
        h('div', 'box-money', [ZU.iconEl('coin', 'coin'), h('b', null, String(starter.money)), h('span', 'unit', 'Mark')]),
        btn('Anzünden', 'ember', function () {
          ZU.audio.match();
          var p = ZU.stagePos(box);
          fx.burst(p.x, p.y - 120, { n: 40, speed: 380, life: 1.2 });
          game.startRun(starter.id);
        })
      ]);
      box.style.setProperty('--box', starter.color);
      box.style.animationDelay = (i * 90) + 'ms';
      row.appendChild(box);
    });
    root.appendChild(h('div', 'screen starter', [
      h('h1', null, 'Wähle deine Schachtel'),
      h('p', 'sub', 'Jede Schachtel bestimmt dein Startdeck. Drei Streichhölzer hast du immer.'),
      row,
      btn('Zurück', 'felt back', function () { game.toMenu(); })
    ]));
  };

  /* ---------- Tischwahl ---------- */
  screens.select = function (game, root) {
    var run = game.run, s = run.s;
    ZU.bg.set('select');
    ZU.audio.music('game');
    var bar = hud(game);
    var row = h('div', 'invites');
    s.encounters.forEach(function (enc, i) {
      var enemy = ZU.ENEMIES[enc.enemy], state = i < s.table ? 'done' : i === s.table ? 'current' : 'locked';
      var rewards = [h('li', null, [ZU.iconEl('coin', 'coin'), 'Prämie ' + run.baseReward(enc.kind) + ' Mark'])];
      if (enc.kind === 'elite') rewards.push(h('li', null, 'Wahl aus 3 Trinkets'));
      if (enc.kind === 'boss') {
        rewards.push(h('li', null, 'Wahl aus 3 Spezialkarten'));
        rewards.push(h('li', null, [ZU.iconEl('match', 'match'), '+1 Streichholz']));
      }
      var foot;
      if (state === 'current') {
        foot = btn('Platz nehmen', 'big ember', function () { game.startDuel(); });
      } else if (state === 'done') {
        foot = h('div', 'stamp', 'Besiegt');
      } else {
        foot = h('div', 'locked-note', [ZU.iconEl('lock', 'lockico'), 'Noch verschlossen']);
      }
      var portrait = ZU.portraitEl(enc.enemy, 'big');
      if (state === 'done') portrait.setBase('defeated');
      var card = h('div', 'invite ' + state + ' k-' + enc.kind, [
        h('div', 'kindtag k-' + enc.kind, ZU.KIND_LABEL[enc.kind] + (enc.kind === 'boss' ? '' : ' ' + (i + 1))),
        portrait,
        h('div', 'ename', enemy.name),
        h('div', 'erole', enemy.role),
        h('p', 'epassive', enemy.passiveText),
        h('ul', 'rewards', rewards),
        foot
      ]);
      card.style.animationDelay = (i * 110) + 'ms';
      if (state === 'current') {
        ZU.tilt(card, card, 2.5, 1.012);
        card.addEventListener('pointerenter', function () { portrait.setMood('smug', 1400); });
      }
      row.appendChild(card);
    });
    root.appendChild(h('div', 'screen select', [
      bar.el,
      h('h1', null, 'Akt ' + ZU.roman(s.act) + ' · ' + run.actName()),
      h('p', 'sub', s.lives < ZU.MAX_LIVES
        ? 'Noch ' + s.lives + (s.lives === 1 ? ' Streichholz' : ' Streichhölzer') + '. Verlierst du das letzte, endet der Run.'
        : 'Drei Tische, ein Boss. Wer zuerst keine Karten mehr hat, gewinnt.'),
      row
    ]));
    ZU.audio.shuffle();
  };

  /* ---------- Auszahlung (Dialog über dem Tisch) ---------- */
  ZU.payout = function (game, result) {
    return new Promise(function (resolve) {
      var run = game.run, before = run.s.money - result.total;
      var list = h('div', 'paylines');
      var totalEl = h('b', null, '0');
      totalEl._value = 0;
      var walletEl = h('b', null, ZU.fmt(before));
      walletEl._value = before;
      var go = btn('Kassieren', 'big ember', function () {
        ZU.modal.close(entry);
        resolve();
      });
      go.disabled = true;
      var entry = ZU.modal.open([
        h('h2', null, 'Auszahlung'),
        h('div', 'paymeta', 'Glut ' + ZU.fmt(result.glut) + ' · längste Kette ×' + result.maxChain + (result.healed ? ' · +1 Streichholz' : '')),
        list,
        h('div', 'paytotal', [h('span', null, 'Summe'), ZU.iconEl('coin', 'coin'), totalEl, h('span', 'unit', 'Mark')]),
        h('div', 'paywallet', ['Kasse: ', walletEl, ' Mark']),
        h('div', 'btnrow', [go])
      ], { cls: 'small payout', locked: true });
      var sum = 0, chain = wait(350);
      result.lines.forEach(function (line, i) {
        chain = chain.then(function () {
          sum += line.amount;
          var row = h('div', 'payline', [h('span', null, line.label), h('b', null, '+' + line.amount)]);
          list.appendChild(row);
          ZU.audio.coin(i);
          fx.count(totalEl, sum, 220);
          fx.punch(totalEl);
          var p = ZU.stagePos(row);
          fx.coins(p.x + 130, p.y, 4 + Math.min(10, line.amount));
          return wait(330);
        });
      });
      chain.then(function () {
        fx.count(walletEl, run.s.money, 600);
        ZU.audio.chip();
        fx.shake(4);
        go.disabled = false;
      });
    });
  };

  /* ---------- Belohnung ---------- */
  screens.reward = function (game, root) {
    var run = game.run, reward = run.s.reward;
    ZU.bg.set('shop');
    var bar = hud(game);
    var row = h('div', 'reward-row');
    function leave() { game.go('shop'); }
    reward.options.forEach(function (id, index) {
      var item, name, text;
      if (reward.type === 'trinket') {
        var t = ZU.TRINKETS[id];
        item = ZU.trinketEl(id);
        item.classList.add('huge');
        name = t.name;
        text = t.text;
      } else {
        var def = ZU.CARDS[id];
        item = ZU.cardStatic(def, { cls: 'large' });
        name = def.name;
        text = def.text;
      }
      var take = btn('Nehmen', 'ember', function () {
        var done = function (replace) {
          run.chooseReward(index, replace);
          ZU.audio.win();
          var p = ZU.stagePos(item);
          fx.burst(p.x, p.y, { n: 36, speed: 360, life: 1.2 });
          fx.flyTo(item, reward.type === 'trinket' ? bar.slots : bar.deckBtn, 520).then(leave);
        };
        if (reward.type === 'trinket' && run.s.trinkets.length >= ZU.MAX_TRINKETS) {
          pickTrinket(game, 'Wähle ein Trinket, das für „' + name + '“ Platz macht.').then(function (replace) { if (replace) done(replace); });
        } else {
          done();
        }
      });
      var box = h('div', 'reward-item', [item, h('div', 'ename', name), h('p', null, text), take]);
      box.style.animationDelay = (index * 110) + 'ms';
      row.appendChild(box);
    });
    root.appendChild(h('div', 'screen reward', [
      bar.el,
      h('h1', null, reward.type === 'trinket' ? 'Elite besiegt · Wähle ein Trinket' : 'Boss besiegt · Wähle eine Spezialkarte'),
      h('p', 'sub', reward.type === 'trinket' ? 'Trinkets wirken dauerhaft. Du kannst bis zu ' + ZU.MAX_TRINKETS + ' tragen.' : 'Die Karte wandert dauerhaft in dein Deck.'),
      row,
      btn('Lieber ' + reward.skip + ' Mark nehmen', 'felt', function () {
        run.chooseReward(null);
        ZU.audio.coin(3);
        leave();
      })
    ]));
  };

  /* ---------- Manfreds Laden ---------- */
  var MANFRED = {
    greet: ['Frische Ware, heiße Ware.', 'Schau dich um. Anfassen kostet extra.', 'Na, noch alle Streichhölzer beisammen?', 'Für dich heute: derselbe Preis wie für alle.'],
    buy: ['Gute Wahl. Brennt gut.', 'Die hätte ich fast selbst behalten.', 'Verkauft!', 'Mark gegen Ware. So mag ich das.'],
    poor: ['Ohne Mark kein Markt.', 'Anschreiben? Bei mir nicht.', 'Komm wieder, wenn die Kasse klingelt.'],
    burn: ['Asche zu Asche.', 'Weg damit. Riecht gut, oder?', 'Weniger ist mehr. Sagt man.'],
    reroll: ['Neue Auslage, neues Glück.', 'Moment … so. Besser?'],
    heal: ['Ein frisches Hölzchen. Pass drauf auf.'],
    sell: ['Nehm ich. Zum halben Preis, versteht sich.'],
    bye: ['Mach sie fertig.', 'Bring mir was Schönes mit.']
  };

  /* Manfred: ein Sprite-Streifen mit zwölf Posen (assets/manfred/manfred.png) und kleine Abläufe daraus. */
  var MANFRED_FRAMES = ['idle', 'blink', 'talk', 'grin', 'annoyed', 'surprised', 'hat', 'coin', 'match', 'cards', 'side', 'wink'];
  var MANFRED_ACTS = {
    greet: [['hat', 1100]],
    buy: [['grin', 450], ['coin', 900], ['grin', 450]],
    bigbuy: [['surprised', 550], ['grin', 500], ['coin', 900]],
    poor: [['annoyed', 1600]],
    burn: [['match', 1800]],
    reroll: [['cards', 1400]],
    heal: [['wink', 1400]],
    sell: [['coin', 900], ['grin', 500]],
    bye: [['hat', 1200]],
    glance: [['side', 1100]],
    rub: [['grin', 800]]
  };

  function manfredActor() {
    var img = h('i', 'mf-img');
    var el = h('div', 'manfred', [h('div', 'mf-bob', [img])]);
    var shown = 'idle', queue = [], timer = null, idleTimer = null, talkTimer = null, talkUntil = 0, dead = false;

    function show(name) {
      shown = name;
      img.style.backgroundPosition = (MANFRED_FRAMES.indexOf(name) * 100 / (MANFRED_FRAMES.length - 1)) + '% 0';
    }
    function next() {
      timer = null;
      if (dead) return;
      var step = queue.shift();
      if (!step) { show('idle'); flap(); return; }
      show(step[0]);
      fx.punch(img, 'pose');
      timer = setTimeout(next, step[1] / ZU.speed);
    }
    // Mundbewegung, solange er spricht und gerade keine Pose läuft
    function flap() {
      clearTimeout(talkTimer);
      if (dead || timer) return;
      if (performance.now() < talkUntil) {
        show(shown === 'talk' ? 'idle' : 'talk');
        talkTimer = setTimeout(flap, 130);
      } else if (shown === 'talk') {
        show('idle');
      }
    }
    // Leerlauf: blinzeln, zur Seite schielen, Hände reiben
    function idle() {
      if (dead) return;
      if (!timer && shown === 'idle' && performance.now() >= talkUntil) {
        var roll = Math.random();
        if (roll < 0.6) {
          show('blink');
          setTimeout(function () { if (shown === 'blink') show('idle'); }, 140);
        } else {
          api.act(roll < 0.84 ? 'glance' : 'rub');
        }
      }
      idleTimer = setTimeout(idle, 1500 + Math.random() * 2600);
    }
    var api = {
      el: el,
      act: function (name, shake) {
        queue = MANFRED_ACTS[name].slice();
        clearTimeout(timer);
        clearTimeout(talkTimer);
        if (shake) fx.punch(el, 'shake');
        next();
      },
      talk: function (ms) {
        talkUntil = performance.now() + ms;
        flap();
      },
      stop: function () {
        dead = true;
        clearTimeout(timer);
        clearTimeout(idleTimer);
        clearTimeout(talkTimer);
      }
    };
    show('idle');
    idleTimer = setTimeout(idle, 1400);
    return api;
  }

  screens.shop = function (game, root) {
    var run = game.run, s = run.s;
    ZU.bg.set('shop');
    ZU.audio.music('shop');
    var bar = hud(game, { onTrinket: sell });
    var mf = manfredActor(), manfred = mf.el;
    var bubble = h('div', 'bubble shopbubble');
    function say(kind) {
      var lines = MANFRED[kind], text = lines[Math.floor(Math.random() * lines.length)];
      bubble.textContent = text;
      fx.punch(bubble, 'on');
      mf.talk(Math.min(2000, 500 + text.length * 35));
    }
    function poor(el) {
      ZU.audio.error();
      fx.punch(el, 'shake');
      mf.act('poor', true);
      say('poor');
    }

    var cardsRow = h('div', 'shelf-row'), trinketRow = h('div', 'shelf-row'), services = h('div', 'services');
    var rerollBox = h('div', 'rerollbox');

    /* Preisschild; "kind" färbt es je nach Art des Angebots. */
    function priceBtn(price, kind, onclick, disabled) {
      var b = btn([ZU.iconEl('coin', 'coin'), h('span', null, String(price))], 'price ' + kind + (s.money < price ? ' poor' : ''), function () {
        if (s.money < price) { poor(b); return; }
        onclick(b);
      });
      b.disabled = !!disabled;
      return b;
    }

    function render() {
      bar.update();
      cardsRow.innerHTML = '';
      trinketRow.innerHTML = '';
      services.innerHTML = '';
      rerollBox.innerHTML = '';

      s.shop.cards.forEach(function (offer, index) {
        var def = ZU.CARDS[offer.def], price = run.cardPrice(index);
        var slot = h('div', 'offer' + (offer.sold ? ' sold' : ''));
        if (offer.sold) {
          slot.appendChild(h('div', 'soldout', 'Verkauft'));
        } else {
          var card = ZU.cardStatic(def);
          slot.appendChild(card);
          if (price < offer.price) slot.appendChild(h('div', 'discount', '−' + (offer.price - price)));
          slot.appendChild(priceBtn(price, 'tag', function () {
            run.buyCard(index);
            ZU.audio.coin(2);
            mf.act('buy');
            say('buy');
            var p = ZU.stagePos(card);
            fx.coins(p.x, p.y, 12);
            fx.flyTo(card, bar.deckBtn, 480);
            render();
          }));
        }
        cardsRow.appendChild(slot);
      });

      // Neue Auslage: eigene runde Glocke am Kartenregal
      var rerollPrice = run.rerollPrice();
      var bell = h('button', 'reroll' + (s.money < rerollPrice ? ' poor' : ''), [ZU.iconEl('reroll', 'rerollico', '#3a2408')]);
      bell.addEventListener('pointerenter', function () { ZU.audio.hover(); });
      bell.addEventListener('click', function () {
        ZU.audio.unlock();
        if (s.money < rerollPrice) { poor(bell); return; }
        run.reroll();
        ZU.audio.chip();
        ZU.audio.shuffle();
        mf.act('reroll');
        say('reroll');
        render();
        fx.punch(rerollBox.querySelector('.reroll'), 'spin');
        Array.prototype.forEach.call(root.querySelectorAll('.offer'), function (el, i) {
          el.style.animationDelay = (i * 60) + 'ms';
          fx.punch(el, 'dropin');
        });
      });
      rerollBox.appendChild(bell);
      rerollBox.appendChild(h('div', 'reroll-name', 'Neue Auslage'));
      rerollBox.appendChild(h('div', 'reroll-price', [ZU.iconEl('coin', 'coin'), h('b', null, String(rerollPrice))]));
      ZU.tip.bind(rerollBox, '<b>Neue Auslage</b><p>Manfred tauscht alle Karten und Trinkets aus. Wird mit jedem Mal 1 Mark teurer.</p>');

      s.shop.trinkets.forEach(function (offer, index) {
        var t = ZU.TRINKETS[offer.id];
        var slot = h('div', 'offer tk' + (offer.sold ? ' sold' : ''));
        if (offer.sold) {
          slot.appendChild(h('div', 'soldout', 'Verkauft'));
        } else {
          var el = ZU.trinketEl(offer.id);
          el.classList.add('big');
          slot.appendChild(el);
          slot.appendChild(h('div', 'pedestal'));
          slot.appendChild(h('div', 'offer-name', t.name));
          slot.appendChild(priceBtn(offer.price, 'gold', function () {
            var finish = function (replace) {
              run.buyTrinket(index, replace);
              ZU.audio.coin(4);
              mf.act(offer.price >= 18 ? 'bigbuy' : 'buy');
              say('buy');
              var p = ZU.stagePos(el);
              fx.coins(p.x, p.y, 14);
              fx.flyTo(el, bar.slots, 480);
              render();
            };
            if (s.trinkets.length >= ZU.MAX_TRINKETS) {
              pickTrinket(game, 'Wähle ein Trinket, das für „' + t.name + '“ Platz macht. Es wird dabei nicht verkauft.').then(function (replace) { if (replace) finish(replace); });
            } else {
              finish();
            }
          }));
        }
        trinketRow.appendChild(slot);
      });
      if (!s.shop.trinkets.length) trinketRow.appendChild(h('div', 'offer sold', [h('div', 'soldout', 'Ausverkauft')]));

      // Dienste: jeder mit eigenem Gesicht
      var burnOff = s.collection.length <= 1;
      services.appendChild(h('div', 'service burn' + (burnOff ? ' off' : ''), [
        ZU.iconEl('flame', 'svc-ico'),
        h('div', 'svc-body', [h('div', 'svc-name', 'Verbrennen'), h('p', null, burnOff ? 'Deine letzte Karte bleibt.' : 'Entfernt eine Karte dauerhaft aus deinem Deck.')]),
        priceBtn(run.burnPrice(), 'red', function () {
          deckModal(game, true).then(function (cardId) {
            if (cardId == null) return;
            run.burn(cardId);
            mf.act('burn');
            say('burn');
            render();
          });
        }, burnOff)
      ]));
      var healOff = s.lives >= ZU.MAX_LIVES || s.shop.healed;
      services.appendChild(h('div', 'service heal' + (healOff ? ' off' : ''), [
        ZU.iconEl('match', 'svc-ico'),
        h('div', 'svc-body', [h('div', 'svc-name', 'Streichholz'), h('p', null, s.shop.healed ? 'Heute schon nachgekauft.' : s.lives >= ZU.MAX_LIVES ? 'Die Schachtel ist voll.' : 'Stellt ein abgebranntes Streichholz wieder her.')]),
        priceBtn(run.healPrice(), 'green', function () {
          run.heal();
          ZU.audio.match();
          mf.act('heal');
          say('heal');
          render();
          var p = ZU.stagePos(bar.el.querySelector('.lives'));
          fx.burst(p.x, p.y, { n: 24, speed: 240 });
        }, healOff)
      ]));
    }

    function sell(id) {
      var value = run.sellValue(id);
      confirmBox(ZU.TRINKETS[id].name + ' verkaufen?', 'Manfred zahlt ' + value + ' Mark dafür.', 'Verkaufen').then(function (yes) {
        if (!yes) return;
        run.sellTrinket(id);
        ZU.audio.coin(1);
        mf.act('sell');
        say('sell');
        render();
      });
    }

    root.appendChild(h('div', 'screen shop', [
      bar.el,
      h('div', 'shop-left', [bubble, manfred, h('div', 'shop-sign', 'Manfreds Laden')]),
      h('div', 'shop-main', [
        h('div', 'shelf cards-shelf', [h('div', 'shelf-label', 'Karten'), cardsRow, rerollBox]),
        h('div', 'shelf-pair', [
          h('div', 'shelf trinket-shelf', [h('div', 'shelf-label', 'Trinkets'), trinketRow]),
          h('div', 'shelf service-shelf', [h('div', 'shelf-label', 'Dienste'), services])
        ])
      ]),
      btn('Weiter zum nächsten Tisch', 'big ember shop-next', function () {
        mf.act('bye');
        say('bye');
        run.leaveShop();
        game.go('select');
      })
    ]));
    render();
    var greeting = setTimeout(function () { mf.act('greet'); say('greet'); }, 350);
    return function () { clearTimeout(greeting); mf.stop(); };
  };

  /* ---------- Ende ---------- */
  function statsBlock(run) {
    var st = run.s.stats;
    return h('div', 'endstats', [
      ['Glut gesamt', ZU.fmt(run.s.score)],
      ['Erreicht', 'Akt ' + ZU.roman(run.s.act) + ' · Tisch ' + (run.s.table + 1)],
      ['Duelle gewonnen', st.wins + ' von ' + st.duels],
      ['Längste Kette', '×' + st.bestChain],
      ['Bestes Duell', ZU.fmt(st.bestGlut) + ' Glut'],
      ['Mark verdient', ZU.fmt(st.earned)]
    ].map(function (pair) { return h('div', 'endstat', [h('span', null, pair[0]), h('b', null, pair[1])]); }));
  }

  screens.victory = function (game, root) {
    var run = game.run;
    ZU.bg.set('win');
    ZU.audio.music('menu');
    ZU.audio.win();
    root.appendChild(h('div', 'screen endscreen win', [
      h('h1', 'huge', 'Das Haus brennt!'),
      h('p', 'sub', 'Du hast den Hausherrn an seinem eigenen Tisch geschlagen.'),
      statsBlock(run),
      accountCta(),
      h('div', 'btnrow', [
        btn('Hauptmenü', 'felt', function () { game.toMenu(); }),
        btn('Nachglut · endlos weiterspielen', 'big ember', function () {
          var phase = run.continueEndless();
          game.go(phase);
        })
      ])
    ]));
    var bursts = setInterval(function () {
      fx.burst(ZU.rand(200, 1080), ZU.rand(120, 420), { n: 30, speed: 420, life: 1.5 });
    }, 500);
    return function () { clearInterval(bursts); };
  };

  screens.defeat = function (game, root) {
    var run = game.run;
    ZU.bg.set('lose');
    ZU.audio.music('menu');
    var matches = h('div', 'deadmatches', [ZU.iconEl('matchOut', 'match'), ZU.iconEl('matchOut', 'match'), ZU.iconEl('matchOut', 'match')]);
    root.appendChild(h('div', 'screen endscreen lose', [
      matches,
      h('h1', 'huge', 'Ausgebrannt'),
      h('p', 'sub', 'Das letzte Streichholz ist erloschen. ' + (run.s.score >= game.profile.best && run.s.score > 0 ? 'Aber: neuer Bestwert!' : 'Das Haus gewinnt – diesmal.')),
      statsBlock(run),
      accountCta(),
      h('div', 'btnrow', [
        btn('Hauptmenü', 'felt', function () { game.toMenu(); }),
        btn('Neuer Run', 'big ember', function () { game.go('starter'); })
      ])
    ]));
    setTimeout(function () {
      var p = ZU.stagePos(matches);
      fx.smoke(p.x, p.y - 20, 30);
    }, 300);
  };

  ZU.screens = screens;
})(window.ZU = window.ZU || {});
