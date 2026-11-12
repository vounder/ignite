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

  function sortedCollection(run) {
    return run.s.collection.slice().sort(function (a, b) {
      var da = ZU.CARDS[a.def], db = ZU.CARDS[b.def];
      if (da.special !== db.special) return da.special ? 1 : -1;
      if (da.special) return da.rarity - db.rarity || da.name.localeCompare(db.name);
      return ZU.RANKS[da.rank].order - ZU.RANKS[db.rank].order || ZU.SUIT_ORDER.indexOf(da.suit) - ZU.SUIT_ORDER.indexOf(db.suit);
    });
  }

  /* Deck-Übersicht; im Verbrennen-Modus wählt ein Klick die Karte aus. */
  /* Deck-Übersicht. burn = true: ein Klick verbrennt die Karte; burn = 'swap': nur Spezialkarten, eine weicht einer neuen.
     Alle Karten sind ohne Rollen zu sehen: Je mehr es sind, desto kleiner werden sie gezeichnet. */
  function deckModal(game, burn) {
    return new Promise(function (resolve) {
      var run = game.run, done = false, entry, swap = burn === 'swap';
      function finish(value) { if (done) return; done = true; ZU.modal.close(entry); resolve(value); }
      var grid = h('div', 'deckgrid');
      var cards = sortedCollection(run).filter(function (card) { return !swap || ZU.CARDS[card.def].special; });
      // Größte Kartengröße, bei der alle Reihen in den Dialog passen (Fläche 920 × 350, Karte 104 × 146).
      var zoom = 1;
      for (; zoom > 0.42; zoom -= 0.04) {
        var perRow = Math.max(1, Math.floor((920 + 12 * zoom) / ((104 + 12) * zoom)));
        if (Math.ceil(cards.length / perRow) * (146 + 14) * zoom <= 350) break;
      }
      grid.style.zoom = zoom.toFixed(2);
      cards.forEach(function (card) {
        var el = ZU.cardStatic(ZU.CARDS[card.def], { cls: burn ? 'clickable burnable' : '', bind: card.bind });
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
        h('h2', null, swap ? 'Welche Spezialkarte soll weichen?' : burn ? 'Welche Karte soll brennen?' : 'Dein Deck · ' + run.s.collection.length + ' Karten'),
        h('p', 'modal-text', swap
          ? 'Dein Deck fasst ' + run.specialSlots() + ' Spezialkarten. Die gewählte Karte verschwindet, die neue nimmt ihren Platz ein.'
          : burn
            ? 'Die Karte wird dauerhaft aus deinem Deck entfernt. Ein schlankes Deck bringt deine besten Karten sicher auf die Starthand.'
            : 'Zu Duellbeginn wird dein Deck gemischt: ' + ZU.HAND_SIZE + ' Karten kommen auf die Hand, der Rest ist dein Nachziehstapel. Der Gegner zieht von seinem eigenen. Spezialkarten: ' +
              run.specialCount() + (run.specialSlots() < 90 ? ' von ' + run.specialSlots() : '') + '.'),
        grid,
        h('div', 'btnrow', [btn(burn ? 'Doch nicht' : 'Schließen', 'felt', function () { finish(null); })])
      ], { cls: 'wide', onClose: function () { finish(null); } });
    });
  }
  ZU.deckModal = deckModal;

  function helpModal() {
    var touch = ZU.app.isTouch();
    var entry = ZU.modal.open([
      h('h2', null, 'So wird gezündet'),
      h('div', 'help', null, {
        html:
          '<div><h3>Das Duell</h3>' +
          '<p>Mau-Mau gegen den Dealer: Lege eine Karte mit <b>gleicher Farbe</b> oder <b>gleichem Wert</b> auf den Stapel. Wer zuerst keine Karten mehr hat, gewinnt.</p>' +
          '<p>Ein <b>' + (touch ? 'Tipp' : 'Klick') + '</b> auf eine passende Handkarte spielt sie sofort.</p>' +
          '<p><b>Mehrfachwahl:</b> Mit dem Privileg „Flinke Finger“ legst du mehrere Karten mit gleichem Wert in einem Zug. Der Schalter dafür erscheint rechts am Tisch.</p>' +
          '<p><b>Die 7:</b> Der Gegner zieht 1 Karte.</p>' +
          '<p><b>Spezialkarten</b> sind gebunden: an ein Symbol, an Rot oder Schwarz – oder gar nicht (Joker). Sie passen nur auf ihre Symbole und geben sie danach vor. Je weiter der Run, desto freier die Karten.</p>' +
          '<p><b>Hausregeln</b> gelten für einzelne Tische, etwa „Letzter Stapel“: Dann wird nicht neu gemischt.</p>' +
          '<p>Kannst oder willst du nicht legen, <b>ziehst</b> du eine Karte. Passt sie, darfst du sie sofort legen – sonst endet der Zug.</p>' +
          '<p><b>Sperrstunde:</b> Nach ' + ZU.TURN_LIMIT + ' Zügen gewinnt, wer weniger Karten hält.</p></div>' +
          '<div><h3>Glut und Mark</h3>' +
          '<p>Jede gespielte Karte bringt <b>Glut</b>: Kartenwert × Kette. Die Kette wächst mit jeder Karte und fällt zurück, wenn du ziehst.</p>' +
          '<p>Siege zahlen <b>Mark</b>: Tischprämie, Restkarten des Gegners, Glut-Bonus, Bank und Zinsen (1 Mark je 5 gesparte Mark).</p>' +
          '<h3>Der Run</h3>' +
          '<p>Jeder Akt hat drei Tische: Gegner, Elite, Boss. Dazwischen wartet <b>Manfreds Laden</b> mit Karten, Trinkets und Diensten. Das erste <b>Casino</b> hat drei Akte; wer es ausräumt, öffnet das nächste – größer, härter, mit eigener Hausordnung und mehr Asche.</p>' +
          '<p><b>Trinkets</b> sind unbegrenzt, werden aber mit jedem weiteren teurer. <b>Privilegien</b> gelten den ganzen Run; Manfred bietet je Akt genau eines an.</p>' +
          '<p>Du spielst mit deinem eigenen <b>Deck</b>: Zu Beginn jedes Duells wird es gemischt, 7 Karten kommen auf die Hand, der Rest ist dein Nachziehstapel. Der Gegner zieht von seinem eigenen Stapel.</p>' +
          '<p>Eine Niederlage kostet ein <b>Streichholz</b>. Sind alle abgebrannt, endet der Run.</p>' +
          '<p>Jeder Sieg bringt sofort <b>Asche</b>. Im <b>Hinterzimmer</b> kaufst du damit Schachteln, Trinkets, Spezialkarten und Upgrades – aber erst, wenn du sie durch Taten am Tisch entdeckt hast. Dein Deck fasst nur wenige <b>Spezialkarten</b>.</p>' +
          (touch ? '<p class="dim">Was tut das? Trinkets und Anzeigen antippen. Karten, Knöpfe und Angebote dafür gedrückt halten.</p></div>'
            : '<p class="dim">Tasten: 1–9 spielt Karten · Leertaste zieht · Enter legt die Auswahl · Esc Menü</p></div>')
      }),
      h('div', 'btnrow', [btn('Alles klar', 'ember', function () { ZU.modal.close(entry); })])
    ], { cls: 'wide' });
    return entry;
  }
  ZU.helpModal = helpModal;

  function settingsModal(game, inRun) {
    var settings = game.profile.settings, app = ZU.app, entry;
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
    /* Schalter An/Aus für eine Einstellung mit Wahrheitswert. */
    function onOff(key) {
      var b = btn(settings[key] ? 'An' : 'Aus', 'small' + (settings[key] ? ' on' : ''), function () {
        settings[key] = !settings[key];
        b.textContent = settings[key] ? 'An' : 'Aus';
        b.classList.toggle('on', settings[key]);
        game.applySettings();
        game.saveProfile();
      });
      return b;
    }
    var rows = [
      h('h2', null, inRun ? 'Pause' : 'Einstellungen'),
      slider('Musik', 'music', function (v) { ZU.audio.setMusic(v); }),
      slider('Effekte', 'sfx', function (v) { ZU.audio.setSfx(v); }),
      h('div', 'setrow', [h('span', null, 'Tempo'), speeds]),
      h('div', 'setrow', [h('span', null, 'Röhren-Filter'), onOff('crt')]),
      h('div', 'setrow', [h('span', null, 'Hintergrund'), onOff('bg')]),
      app.canFullscreen() ? h('div', 'setrow', [h('span', null, 'Vollbild'), btn('Umschalten', 'small', function () { app.toggleFullscreen(); })]) : null
    ];
    // Auf Handy und Tablet: ob beim Start nach dem Vollbild gefragt wird (im Browser, nicht in der installierten App).
    if (app.isTouch() && !app.isInstalled() && (app.canFullscreen() || app.isIOS())) {
      var modes = app.canFullscreen() ? [['ask', 'Fragen'], ['always', 'Immer'], ['never', 'Nie']] : [['ask', 'An'], ['never', 'Aus']];
      var starts = h('div', 'segmented');
      modes.forEach(function (mode) {
        var b = btn(mode[1], 'small' + (app.startMode(game) === mode[0] ? ' on' : ''), function () {
          settings.fullscreen = mode[0];
          game.saveProfile();
          Array.prototype.forEach.call(starts.children, function (c) { c.classList.remove('on'); });
          b.classList.add('on');
        });
        starts.appendChild(b);
      });
      rows.push(h('div', 'setrow', [h('span', null, app.canFullscreen() ? 'Beim Start' : 'App-Hinweis'), starts]));
    }
    if (app.canInstall()) {
      var installRow = h('div', 'setrow', [h('span', null, 'Als App'), btn('Installieren', 'small', function () {
        app.install().then(function () { installRow.remove(); });
      })]);
      rows.push(installRow);
    } else if (app.isIOS() && !app.isInstalled()) {
      rows.push(h('div', 'setrow', [h('span', null, 'Als App'), btn('So geht’s', 'small', function () {
        var hint = ZU.modal.open([
          h('h2', null, 'Als App spielen'),
          h('p', 'modal-text', 'Zündung läuft auch als App auf dem Home-Bildschirm, ohne Browserleisten: ' + app.iosHint),
          h('div', 'btnrow', [btn('Alles klar', 'ember', function () { ZU.modal.close(hint); })])
        ], { cls: 'small' });
      })]));
    }
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
    entry = ZU.modal.open(rows, { cls: 'small settings' + (inRun ? ' pause' : '') });
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
      h('span', null, 'Fortschritt sichern?'),
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
        for (var l = 0; l < run.maxLives(); l++) lives.appendChild(ZU.iconEl(l < s.lives ? 'match' : 'matchOut', 'match'));
        ZU.fillOwned(slots, run, opts.onTrinket || null);
        requestAnimationFrame(edges);
      }
    };
    /* Blendet die Ränder der Trinket-Leiste aus, solange dort noch etwas verborgen ist. */
    function edges() {
      slots.classList.toggle('more-l', slots.scrollLeft > 2);
      slots.classList.toggle('more-r', slots.scrollLeft + slots.clientWidth < slots.scrollWidth - 2);
    }
    slots.addEventListener('scroll', edges);
    slots.addEventListener('wheel', function (ev) {
      if (slots.scrollWidth <= slots.clientWidth) return;
      slots.scrollLeft += ev.deltaY || ev.deltaX;
      ev.preventDefault();
    }, { passive: false });
    api.update();
    return api;
  }

  /* ---------- Hauptmenü ---------- */
  var screens = {};

  /* Titelbildschirm: das Hinterzimmer als Kulisse, der Schriftzug wird von einem Streichholz entzündet
     und brennt danach; unten liegt die eigene Hand auf dem Filz. Nur beim ersten Mal läuft das Anzünden
     in voller Länge – ein Klick überspringt es. */
  var TITLE_HAND = [['hearts-Q'], ['fluch', 'clubs'], ['spades-K'], ['diamonds-A'], ['hodl', 'red'], ['clubs-J'], ['tausch', 'wild']];

  screens.menu = function (game, root) {
    ZU.bg.set('menu');
    ZU.audio.music('menu');
    var profile = game.profile, saved = ZU.Run.load();
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var intro = !game.titleSeen && !calm;
    game.titleSeen = true;

    var scene = titleScene(calm), art = scene.el;
    var logo = ZU.titleLogo('ZÜNDUNG');

    var hand = h('div', 'title-hand');
    TITLE_HAND.forEach(function (entry, i) {
      var slot = h('div', 'hand-slot', [ZU.cardStatic(ZU.CARDS[entry[0]], { bind: entry[1] })]);
      slot.style.setProperty('--a', ((i - (TITLE_HAND.length - 1) / 2) * 4.5) + 'deg');
      slot.style.setProperty('--i', i);
      slot.addEventListener('pointerenter', function () { ZU.audio.hover(); });
      hand.appendChild(slot);
    });

    var buttons = h('div', 'menu-buttons');
    if (saved) buttons.appendChild(btn('Weiterspielen', 'big ember', function () { game.continueRun(saved); }));
    buttons.appendChild(btn('Neuer Run', 'big ' + (saved ? 'felt' : 'ember'), function () {
      if (!saved) { game.go('casino'); return; }
      confirmBox('Neuen Run beginnen?', 'Der gespeicherte Run wird dabei überschrieben.', 'Neu beginnen').then(function (yes) {
        if (yes) game.go('casino');
      });
    }));
    buttons.appendChild(h('div', 'menu-row', [
      backroomBtn(game),
      btn('Einstellungen', 'felt', function () { settingsModal(game, false); })
    ]));
    buttons.appendChild(btn('So wird gezündet', 'felt', function () { helpModal(); }));
    Array.prototype.forEach.call(buttons.children, function (child, i) { child.style.setProperty('--i', i); });

    var slot = accountSlot();
    var screen = h('div', 'screen menu title ' + (intro ? 'intro' : 'ready quick'), [
      art,
      h('div', 'title-shade'),
      logo,
      hand,
      buttons,
      slot,
      h('div', 'menu-version', 'v' + ZU.VERSION)
    ]);
    root.appendChild(screen);

    function ready() {
      if (!screen.classList.contains('intro')) return;
      screen.classList.remove('intro');
      screen.classList.add('ready');
      for (var i = 0; i < TITLE_HAND.length; i++) setTimeout(ZU.audio.deal, 140 + i * 70);
    }
    logo.onAblaze = ready;
    logo.ignite(!intro);
    function skip() {
      if (!screen.classList.contains('intro')) return;
      logo.ignite(true);
      ready();
    }
    screen.addEventListener('pointerdown', skip);
    /* Parallaxe: Kulisse, Schriftzug und Hand verschieben sich leicht gegen die Maus. */
    screen.addEventListener('pointermove', function (e) {
      var r = screen.getBoundingClientRect();
      screen.style.setProperty('--mx', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
      screen.style.setProperty('--my', (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
    });
    if (!profile.seenHelp) {
      profile.seenHelp = true;
      game.saveProfile();
      setTimeout(function () { if (game.screen === 'menu' && !ZU.modal.isOpen()) helpModal(); }, 600);
    }
    setTimeout(function () { if (game.screen === 'menu') unlockedPopup(game); }, intro ? 1400 : 450);
    return function () { slot._off(); logo.destroy(); scene.stop(); };
  };

  /* Titelkulisse aus Ebenen: Raum, die Herren und Damen der sechs Casinos, davor der Tisch.
     Jede Figur ist ein Streifen aus drei Bildern (ruhig, Blinzeln, Grinsen) und lebt für sich:
     Sie atmet (CSS), blinzelt in unregelmäßigen Abständen und grinst gelegentlich. */
  var TITLE_CAST = [
    // id, Mitte x, Unterkante y, Höhe, gespiegelt, Ebene – von außen nach innen, die mittlere sitzt jeweils weiter hinten
    ['impresario', 108, 548, 372, false, 2],
    ['house', 262, 520, 348, false, 1],
    ['captain', 384, 552, 348, false, 3],
    ['baroness', 896, 552, 348, true, 3],
    ['prince', 1018, 520, 348, true, 1],
    ['director', 1172, 548, 372, true, 2]
  ];
  ZU.TITLE_ART = ['title/room.png', 'title/table.png'].concat(TITLE_CAST.map(function (c) { return 'title/cast-' + c[0] + '.png'; }));
  function titleScene(calm) {
    var room = h('div', 'ts-layer ts-room'), cast = h('div', 'ts-layer ts-cast'), table = h('div', 'ts-layer ts-table');
    room.style.backgroundImage = 'url(' + ZU.asset('title/room.png') + ')';
    table.style.backgroundImage = 'url(' + ZU.asset('title/table.png') + ')';
    var timers = [], dead = false;
    TITLE_CAST.forEach(function (c, index) {
      var height = c[3], width = Math.round(height * 440 / 480);
      var img = h('i', 'ts-img');
      img.style.backgroundImage = 'url(' + ZU.asset('title/cast-' + c[0] + '.png') + ')';
      var fig = h('div', 'ts-fig' + (c[4] ? ' flip' : ''), [h('div', 'ts-breath', [img])]);
      fig.style.cssText = 'left:' + (c[1] - width / 2) + 'px;top:' + (c[2] - height) + 'px;width:' + width + 'px;height:' + height + 'px;z-index:' + c[5] + ';';
      fig.style.setProperty('--d', (-index * 0.9) + 's');
      cast.appendChild(fig);
      if (calm) return;
      function frame(n) { img.style.backgroundPosition = (n * 50) + '% 0'; }
      // Blinzeln: kurz, alle paar Sekunden, manchmal doppelt
      (function blink() {
        timers[index * 2] = setTimeout(function () {
          if (dead) return;
          frame(1);
          setTimeout(function () { if (!dead && !fig._smug) frame(0); }, 130);
          if (Math.random() < 0.2) setTimeout(function () { if (dead || fig._smug) return; frame(1); setTimeout(function () { if (!dead && !fig._smug) frame(0); }, 110); }, 300);
          blink();
        }, 1800 + Math.random() * 4200);
      })();
      // Grinsen: selten und für einen Moment, nie alle zugleich
      (function smirk() {
        timers[index * 2 + 1] = setTimeout(function () {
          if (dead) return;
          fig._smug = true;
          frame(2);
          setTimeout(function () { fig._smug = false; if (!dead) frame(0); }, 1400 + Math.random() * 1600);
          smirk();
        }, 5000 + index * 1300 + Math.random() * 12000);
      })();
    });
    return {
      el: h('div', 'title-art', [room, cast, table]),
      stop: function () { dead = true; timers.forEach(clearTimeout); }
    };
  }

  /* Knopf ins Hinterzimmer; ein Punkt zeigt an, dass dort etwas Neues zu kaufen steht. */
  function backroomBtn(game) {
    var b = btn('Hinterzimmer', 'felt', function () { game.go('backroom'); });
    var seen = game.profile.brSeen || [];
    var fresh = ZU.Meta.openOffers(ZU.Meta.get()).filter(function (key) { return seen.indexOf(key) < 0; });
    if (fresh.length) b.appendChild(h('i', 'newdot', String(fresh.length)));
    return b;
  }

  /* ---------- Startschachtel ---------- */
  /* Wie viel Asche ein Casino gegenüber dem ersten bringt, als Text. */
  function ashFactor(casino) { return '×' + String(casino.ash).replace('.', ','); }
  function casinoFacts(casino) {
    return casino.acts + ' Akte · Asche ' + ashFactor(casino) + (casino.rules.length ? ' · ' + casino.rules.length + ' Hausregeln' : ' · keine Hausregeln');
  }

  /* Schilder für das Casino des Runs: Name und – wenn es welche gibt – die Hausordnung. */
  function casinoChips(run) {
    if (run.meta().legacy) return null;
    var casino = run.casino(), rules = run.houseRules();
    var name = h('div', 'stakechip', casino.name);
    ZU.tip.bind(name, '<b>' + casino.name + '</b><p>' + casino.sub + '.</p><p class="dim">' + casinoFacts(casino) + '</p>');
    return h('div', 'casinochips', [name, rules.length ? ZU.houseChip(rules) : null]);
  }

  /* Asche gibt es sofort nach jedem Sieg; hier steht, was der Run insgesamt eingebracht hat. */
  function ashLine(run) {
    var el = h('div', 'ashline', [ZU.iconEl('ash', 'ashico'), h('b', null, ZU.fmt(run.s.ashPaid || 0)), h('span', null, 'Asche in diesem Run')]);
    if (run.s.newStake) el.appendChild(h('span', 'newstake', 'Neues Casino: ' + ZU.CASINOS[run.s.newStake].name));
    return el;
  }

  screens.starter = function (game, root) {
    ZU.bg.set('select');
    var meta = ZU.Meta.get();
    var row = h('div', 'boxes');
    ZU.STARTERS.forEach(function (starter, i) {
      var open = ZU.Meta.isUnlocked(meta, 'starter', starter.id);
      var preview = h('div', 'box-preview');
      // Höchstens zwei Karten als Kostprobe; der Text darunter nennt den Rest.
      starter.cards.slice(0, 2).forEach(function (id) { preview.appendChild(ZU.cardStatic(ZU.CARDS[id], { cls: 'mini', bind: 'none' })); });
      starter.trinkets.forEach(function (id) { preview.appendChild(ZU.trinketEl(id)); });
      (starter.perks || []).forEach(function (id) { preview.appendChild(ZU.perkEl(id)); });
      if (!starter.cards.length) preview.insertBefore(h('div', 'box-plain', ZU.DECK_SIZE + ' × ?'), preview.firstChild);
      var box = h('div', 'matchbox' + (open ? '' : ' locked'), [
        h('div', 'box-top', [h('div', 'box-name', starter.name), h('div', 'box-strip')]),
        preview,
        h('p', null, starter.text),
        h('div', 'box-money', [ZU.iconEl('coin', 'coin'), h('b', null, String(starter.money + ZU.Meta.runOptions(meta).startgeld)), h('span', 'unit', 'Mark')]),
        open ? btn('Anzünden', 'ember', function () {
          ZU.audio.match();
          var p = ZU.stagePos(box);
          fx.burst(p.x, p.y - 120, { n: 40, speed: 380, life: 1.2 });
          game.startRun(starter.id);
        }) : h('div', 'box-locked', [ZU.iconEl('lock', 'lockico'), 'Im Hinterzimmer'])
      ]);
      box.style.setProperty('--box', starter.color);
      box.style.animationDelay = (i * 90) + 'ms';
      row.appendChild(box);
    });

    // Das Casino ist schon gewählt; hier steht nur noch, wohin es geht.
    var casino = ZU.CASINOS[meta.stake];
    var stakeRow = h('div', 'stakerow', [
      h('div', 'stake-mid', [
        h('div', 'stake-name', 'Casino ' + ZU.roman(meta.stake + 1) + ' · ' + casino.name),
        h('div', 'stake-text', casino.sub + ' · ' + casinoFacts(casino))
      ]),
      casino.rules.length ? ZU.houseChip(casino.rules) : null,
      btn('Anderes Casino', 'small', function () { game.go('casino'); })
    ]);

    root.appendChild(h('div', 'screen starter', [
      h('h1', null, 'Wähle deine Schachtel'),
      stakeRow,
      row,
      btn('Zurück', 'felt back', function () { game.go('casino'); })
    ]));
  };

  /* ---------- Casino-Wahl: vor jedem Run ----------
     Alle sechs Häuser sind von Anfang an zu sehen; betreten lässt sich nur, was der Reihe nach geöffnet wurde. */
  var CASINOS_PER_PAGE = 3;
  ZU.CASINO_ART = ZU.CASINOS.map(function (casino) { return 'casinos/' + casino.id + '.png'; });
  screens.casino = function (game, root) {
    ZU.bg.set('select');
    var meta = ZU.Meta.get();
    var track = h('div', 'casino-track'), pages = [];
    ZU.CASINOS.forEach(function (casino, index) {
      var open = index <= meta.maxStake, last = index === meta.stake;
      var boss = casino.foes ? ZU.ENEMIES[casino.foes.boss] : null;
      var picture = h('div', 'casino-pic', [h('div', 'casino-no', ZU.roman(index + 1)), open ? null : h('div', 'casino-lock', [ZU.iconEl('lock', 'lockico')])]);
      picture.style.backgroundImage = 'url(' + ZU.asset('casinos/' + casino.id + '.png') + ')';
      var card = h('div', 'casino-card' + (open ? ' open' : ' locked') + (last && open ? ' last' : ''), [
        picture,
        h('div', 'casino-name', casino.name),
        h('p', 'casino-sub', casino.sub + '.'),
        h('div', 'casino-facts', [
          h('span', null, casino.acts + ' Akte'),
          h('span', null, 'Asche ' + ashFactor(casino)),
          casino.rules.length ? ZU.houseChip(casino.rules) : h('span', null, 'keine Hausregeln')
        ]),
        h('p', 'casino-boss', boss ? 'Es gehört: ' + boss.name : 'Es gehört: dem Hausherrn oder Donna Scarlatta'),
        open
          ? btn('Eintreten', last ? 'ember' : 'felt', function () {
            ZU.Meta.setStake(index);
            game.go('starter');
          })
          : h('div', 'locked-note', [ZU.iconEl('lock', 'lockico'), 'Erst „' + ZU.CASINOS[index - 1].name + '“ ausräumen'])
      ]);
      card.style.setProperty('--tint', 'rgb(' + casino.tint.b.map(function (v) { return Math.round(v * 255 * 1.6); }).join(',') + ')');
      if (index % CASINOS_PER_PAGE === 0) { pages.push(h('div', 'casino-page')); track.appendChild(pages[pages.length - 1]); }
      pages[pages.length - 1].appendChild(card);
    });

    // Blättern: Knöpfe links und rechts, Wischen oder Mausrad; die Punkte zeigen die Seite.
    var page = Math.floor(meta.stake / CASINOS_PER_PAGE);
    var dots = h('div', 'casino-dots');
    var prev = btn('◄', 'icon casino-prev', function () { show(page - 1, true); });
    var next = btn('►', 'icon casino-next', function () { show(page + 1, true); });
    prev.setAttribute('aria-label', 'Vorherige Seite');
    next.setAttribute('aria-label', 'Nächste Seite');
    pages.forEach(function (el, index) {
      var dot = h('button', 'casino-dot', null, { type: 'button', 'aria-label': 'Seite ' + (index + 1) });
      dot.addEventListener('click', function () { ZU.audio.click(); show(index, true); });
      dots.appendChild(dot);
    });
    function mark() {
      prev.disabled = page <= 0;
      next.disabled = page >= pages.length - 1;
      Array.prototype.forEach.call(dots.children, function (dot, index) { dot.classList.toggle('on', index === page); });
    }
    function show(index, smooth) {
      page = Math.max(0, Math.min(pages.length - 1, index));
      track.scrollTo({ left: pages[page].offsetLeft, behavior: smooth ? 'smooth' : 'auto' });
      mark();
    }
    track.addEventListener('scroll', function () {
      var width = track.clientWidth || 1, at = Math.round(track.scrollLeft / width);
      if (at !== page) { page = Math.max(0, Math.min(pages.length - 1, at)); mark(); }
    });
    track.addEventListener('wheel', function (ev) {
      if (Math.abs(ev.deltaY) < Math.abs(ev.deltaX)) return;
      ev.preventDefault();
      if (track._wheel) return; // ein Dreh am Rad blättert genau eine Seite
      track._wheel = setTimeout(function () { track._wheel = null; }, 420);
      show(page + (ev.deltaY > 0 ? 1 : -1), true);
    }, { passive: false });
    function keys(ev) {
      if (ZU.modal.isOpen()) return;
      if (ev.code === 'ArrowLeft') show(page - 1, true);
      if (ev.code === 'ArrowRight') show(page + 1, true);
    }
    window.addEventListener('keydown', keys);

    root.appendChild(h('div', 'screen casinos', [
      h('h1', null, 'Wähle dein Casino'),
      h('p', 'sub', 'Wer ein Haus ausräumt, öffnet die Tür zum nächsten. Härtere Häuser zahlen mehr Asche.'),
      h('div', 'casino-stage', [prev, track, next]),
      dots,
      btn('Zurück', 'felt back', function () { game.toMenu(); })
    ]));
    requestAnimationFrame(function () { show(page, false); });
    return function () { window.removeEventListener('keydown', keys); };
  };

  /* ---------- Hauptmenü: „Freigeschaltet" ----------
     Zeigt, was seit dem letzten Mal im Hinterzimmer aufgetaucht ist oder sich geöffnet hat.
     Jeder Eintrag lässt sich einzeln abhaken oder alle auf einmal. */
  function unlockedKeys(meta) {
    var keys = ZU.Meta.openOffers(meta);
    for (var i = 1; i <= meta.maxStake; i++) keys.push('casino:' + i);
    return keys;
  }
  function unlockedEntry(key) {
    var parts = key.split(':'), kind = parts[0], id = parts[1];
    if (kind === 'trinket') return { visual: ZU.trinketEl(id), name: ZU.TRINKETS[id].name, kind: 'Trinket', text: ZU.TRINKETS[id].text };
    if (kind === 'special') return { visual: ZU.cardStatic(ZU.CARDS[id], { cls: 'mini', bind: 'none', noTip: true }), name: ZU.CARDS[id].name, kind: 'Spezialkarte', text: ZU.CARDS[id].text };
    if (kind === 'upgrade') return { visual: h('div', 'un-badge', '▲'), name: ZU.Meta.UPGRADES[id].name, kind: 'Upgrade', text: ZU.Meta.UPGRADES[id].text };
    if (kind === 'casino') return { visual: h('div', 'un-badge', ZU.roman(Number(id) + 1)), name: ZU.CASINOS[id].name, kind: 'Casino', text: ZU.CASINOS[id].sub + '. ' + casinoFacts(ZU.CASINOS[id]) + '.', open: true };
    var starter = ZU.STARTERS.filter(function (s) { return s.id === id; })[0];
    var box = h('div', 'br-box');
    box.style.background = starter.color;
    return { visual: box, name: starter.name, kind: 'Schachtel', text: starter.text };
  }
  function unlockedPopup(game) {
    var profile = ZU.Profile.load(), keys = unlockedKeys(ZU.Meta.get());
    if (!profile.popInit) {
      // Erster Start mit diesem Fenster: Was schon da war, gilt als bekannt.
      profile.popInit = true;
      profile.popSeen = keys;
      ZU.Profile.save(profile);
      return;
    }
    var seen = profile.popSeen || [], pending = keys.filter(function (key) { return seen.indexOf(key) < 0; });
    if (!pending.length || ZU.modal.isOpen()) return;
    var entry, list = h('div', 'un-list');
    function mark(done) {
      var fresh = ZU.Profile.load();
      fresh.popSeen = (fresh.popSeen || []).concat(done.filter(function (key) { return (fresh.popSeen || []).indexOf(key) < 0; }));
      ZU.Profile.save(fresh);
      pending = pending.filter(function (key) { return done.indexOf(key) < 0; });
      if (!pending.length) ZU.modal.close(entry);
    }
    pending.forEach(function (key) {
      var item = unlockedEntry(key);
      var row = h('div', 'un-row', [
        h('div', 'un-visual', [item.visual]),
        h('div', 'un-main', [
          h('div', 'un-name', [item.name, h('span', 'un-kind', item.kind)]),
          h('p', null, item.text),
          h('p', 'un-where', item.open ? 'Die Tür steht offen.' : 'Steht im Hinterzimmer zum Kauf.')
        ]),
        btn('Gesehen', 'small felt', function () { row.remove(); mark([key]); })
      ]);
      list.appendChild(row);
    });
    entry = ZU.modal.open([
      h('h2', null, 'Freigeschaltet'),
      list,
      h('div', 'btnrow', [
        btn('Zum Hinterzimmer', 'felt', function () { mark(pending.slice()); game.go('backroom'); }),
        btn(pending.length > 1 ? 'Alle gesehen' : 'Gesehen', 'ember', function () { mark(pending.slice()); })
      ])
    ], { cls: 'unlocked', locked: true });
  }

  /* ---------- Hinterzimmer: Asche ausgeben ---------- */
  screens.backroom = function (game, root) {
    ZU.bg.set('shop');
    ZU.audio.music('shop');
    var tab = game.backroomTab || 'unlock';
    // Was beim letzten Besuch schon zum Kauf stand; alles Weitere trägt heute ein „Neu".
    var seenBefore = (game.profile.brSeen || []).slice();
    game.profile.brSeen = ZU.Meta.openOffers(ZU.Meta.get());
    var fresh = ZU.Profile.load();
    fresh.brSeen = game.profile.brSeen;
    ZU.Profile.save(fresh);
    var ashEl = h('b', null, '0');
    var content = h('div', 'br-content');
    var tabs = {};

    function ashBtn(price, meta, onclick) {
      var b = btn([ZU.iconEl('ash', 'ashico'), h('span', null, String(price))], 'price ash' + (meta.ash < price ? ' poor' : ''), function () {
        var result = onclick();
        if (result.ok) {
          ZU.audio.win();
          var p = ZU.stagePos(b);
          fx.burst(p.x, p.y, { n: 30, speed: 320, life: 1.1 });
          render();
        } else {
          ZU.audio.error();
          fx.punch(b, 'shake');
        }
      });
      return b;
    }

    function section(title, tiles) {
      content.appendChild(h('div', 'br-section', [h('div', 'br-title', title), h('div', 'br-grid', tiles)]));
    }

    /* Eine Kachel im Hinterzimmer hat drei Zustände: im Spiel, entdeckt (kaufbar) oder verborgen.
       Verborgenes zeigt nur einen Schatten und „?????"; steht ein Hinweis da, verrät er die Bedingung. */
    function tile(meta, kind, id, visual, name) {
      var open = ZU.Meta.isUnlocked(meta, kind, id), found = open || ZU.Meta.isFound(meta, kind, id);
      if (!found) {
        var hint = ZU.Meta.hint(meta, kind, id);
        visual._tip = null;
        return h('div', 'br-tile hidden', [visual, h('div', 'br-name', '?????'), h('div', 'br-hint', hint || '?????')]);
      }
      var isNew = !open && seenBefore.indexOf(kind + ':' + id) < 0;
      return h('div', 'br-tile' + (open ? ' open' : ' closed') + (isNew ? ' fresh' : ''), [
        isNew ? h('i', 'newtag', 'Neu') : null,
        visual,
        h('div', 'br-name', name),
        open ? h('div', 'br-open', 'Im Spiel') : ashBtn(ZU.Meta.cost(kind, id), meta, function () { return ZU.Meta.unlock(kind, id); })
      ]);
    }

    function counter(meta, kind, ids) {
      var have = ids.filter(function (id) { return ZU.Meta.isUnlocked(meta, kind, id); }).length;
      return ' · ' + have + ' von ' + ids.length;
    }

    function renderUnlock(meta) {
      var starters = ZU.STARTERS.map(function (s) { return s.id; });
      section('Schachteln' + counter(meta, 'starter', starters), ZU.STARTERS.map(function (starter) {
        var box = h('div', 'br-box');
        box.style.background = starter.color;
        ZU.tip.bind(box, '<b>' + starter.name + '</b><p>' + starter.text + '</p>');
        return tile(meta, 'starter', starter.id, box, starter.name);
      }));
      section('Trinkets' + counter(meta, 'trinket', ZU.TRINKET_IDS), ZU.TRINKET_IDS.map(function (id) {
        return tile(meta, 'trinket', id, ZU.trinketEl(id), ZU.TRINKETS[id].name);
      }));
      section('Spezialkarten' + counter(meta, 'special', ZU.SPECIAL_IDS), ZU.SPECIAL_IDS.map(function (id) {
        var found = ZU.Meta.isUnlocked(meta, 'special', id) || ZU.Meta.isFound(meta, 'special', id);
        // Verborgene Karten zeigen ihre Rückseite, damit weder Bild noch Name etwas verraten.
        var visual = found ? ZU.cardStatic(ZU.CARDS[id], { cls: 'mini', bind: 'none' }) : h('div', 'cardstatic mini', [ZU.cardBack()]);
        return tile(meta, 'special', id, visual, ZU.CARDS[id].name);
      }));
    }

    function renderUpgrade(meta) {
      var rows = ZU.Meta.UPGRADE_IDS.map(function (id) {
        var up = ZU.Meta.UPGRADES[id], level = ZU.Meta.level(meta, id), price = ZU.Meta.upgradeCost(meta, id);
        if (!ZU.Meta.isFound(meta, 'upgrade', id)) {
          return h('div', 'br-row hidden', [
            h('div', 'br-rowmain', [h('div', 'br-rowname', '?????'), h('p', null, ZU.Meta.hint(meta, 'upgrade', id) || '?????')])
          ]);
        }
        var isNew = !level && ZU.Meta.req('upgrade', id) && seenBefore.indexOf('upgrade:' + id) < 0;
        var pips = h('div', 'br-pips');
        up.costs.forEach(function (cost, index) { pips.appendChild(h('i', index < level ? 'on' : '')); });
        return h('div', 'br-row' + (price == null ? ' done' : '') + (isNew ? ' fresh' : ''), [
          h('div', 'br-rowmain', [h('div', 'br-rowname', [up.name, isNew ? h('i', 'newtag inline', 'Neu') : null]), h('p', null, up.text)]),
          pips,
          price == null ? h('div', 'br-open', 'Ausgebaut') : ashBtn(price, meta, function () { return ZU.Meta.upgrade(id); })
        ]);
      });
      content.appendChild(h('div', 'br-section', [h('div', 'br-title', 'Upgrades'), h('div', 'br-list', rows)]));
    }

    /* Casinos: der Reihe nach zu öffnen. Von verschlossenen Häusern ist nur bekannt, dass es sie gibt. */
    function renderStake(meta) {
      var rows = ZU.CASINOS.map(function (casino, index) {
        var open = index <= meta.maxStake, active = index === meta.stake;
        return h('div', 'br-row stake' + (open ? '' : ' closed') + (active ? ' active' : ''), [
          h('div', 'br-stakeno', ZU.roman(index + 1)),
          h('div', 'br-rowmain', [
            h('div', 'br-rowname', casino.name),
            h('p', null, open ? casino.sub + '. ' + casinoFacts(casino) + '.' : 'Verschlossen: Räume erst „' + ZU.CASINOS[index - 1].name + '“ aus.'),
            open && casino.rules.length ? h('div', 'br-rules', casino.rules.map(function (id) {
              var chip = h('span', 'rulechip', ZU.RULES[id].name);
              ZU.tip.bind(chip, '<b>' + ZU.RULES[id].name + '</b><p>' + ZU.RULES[id].text + '</p>');
              return chip;
            })) : null
          ]),
          h('div', 'br-open', active ? 'Gewählt' : open ? 'Asche ' + ashFactor(casino) : ''),
          open && !active ? btn('Wählen', 'small felt', function () { ZU.Meta.setStake(index); render(); }) : null
        ]);
      });
      content.appendChild(h('div', 'br-section', [h('div', 'br-title', 'Casinos'), h('div', 'br-list', rows)]));
    }

    /* Wie viele der drei Akteneinträge einer Figur bei so vielen Siegen zu lesen sind. */
    function loreOpen(id, count) {
      return ZU.LORE_STEPS[ZU.ENEMIES[id].kind].filter(function (need) { return count >= need; }).length;
    }
    /* Akte einer Figur: Porträt, Eigenheit und ihre Geschichte – so weit, wie man sie schon geschlagen hat. */
    function dossier(id, count) {
      var enemy = ZU.ENEMIES[id], steps = ZU.LORE_STEPS[enemy.kind], entry;
      var home = enemy.casino ? ZU.CASINOS[enemy.casino].name : 'in jedem Haus';
      var pages = ZU.LORE[id].map(function (text, index) {
        var open = count >= steps[index], missing = steps[index] - count;
        return h('div', 'lore-page' + (open ? '' : ' locked'), [
          h('div', 'lore-no', ZU.roman(index + 1)),
          h('p', null, open ? text : '?????'),
          open ? null : h('div', 'lore-need', 'Noch ' + missing + (missing === 1 ? ' Sieg' : ' Siege') + ' über ' + enemy.name)
        ]);
      });
      entry = ZU.modal.open([
        h('div', 'lore-head', [
          ZU.portraitEl(id, 'big'),
          h('div', 'lore-who', [
            h('h2', null, enemy.name),
            h('div', 'lore-role', enemy.role + ' · ' + ZU.KIND_LABEL[enemy.kind] + ' · ' + home),
            h('p', 'lore-passive', enemy.passiveText),
            h('div', 'lore-count', count + '× besiegt')
          ])
        ]),
        h('div', 'lore-pages', pages),
        h('div', 'btnrow', [btn('Akte schließen', 'felt', function () { ZU.modal.close(entry); })])
      ], { cls: 'wide dossier' });
    }

    function renderFile(meta) {
      var kinds = [['battle', 'Tische'], ['elite', 'Elite'], ['boss', 'Bosse']];
      kinds.forEach(function (kind) {
        var tiles = Object.keys(ZU.ENEMIES).filter(function (id) { return ZU.ENEMIES[id].kind === kind[0]; }).map(function (id) {
          var enemy = ZU.ENEMIES[id], count = meta.defeated[id] || 0;
          var portrait = ZU.portraitEl(id, 'small');
          if (!count) portrait.classList.add('unknown');
          var pages = loreOpen(id, count);
          var el = h('div', 'br-tile file' + (count ? ' open known' : ' closed'), [
            portrait,
            h('div', 'br-name', count ? enemy.name : '???'),
            h('div', 'br-open', count ? count + '× besiegt' : enemy.role),
            count ? h('div', 'br-lore', 'Akte ' + pages + '/3') : null
          ]);
          if (count) el.addEventListener('click', function () { ZU.audio.click(); dossier(id, count); });
          return el;
        });
        section(kind[1], tiles);
      });
    }

    function render() {
      var meta = ZU.Meta.get();
      fx.count(ashEl, meta.ash, 300);
      content.innerHTML = '';
      Object.keys(tabs).forEach(function (key) { tabs[key].classList.toggle('on', key === tab); });
      if (tab === 'unlock') renderUnlock(meta);
      else if (tab === 'upgrade') renderUpgrade(meta);
      else if (tab === 'stake') renderStake(meta);
      else renderFile(meta);
      content.scrollTop = 0;
    }

    var tabRow = h('div', 'br-tabs');
    [['unlock', 'Freischalten'], ['upgrade', 'Upgrades'], ['stake', 'Casinos'], ['file', 'Kartei']].forEach(function (pair) {
      tabs[pair[0]] = btn(pair[1], 'small', function () { tab = game.backroomTab = pair[0]; render(); });
      tabRow.appendChild(tabs[pair[0]]);
    });

    root.appendChild(h('div', 'screen backroom', [
      h('div', 'br-head', [
        btn('Zurück', 'felt', function () { game.toMenu(); }),
        h('h1', null, 'Hinterzimmer'),
        h('div', 'br-ash', [ZU.iconEl('ash', 'ashico'), ashEl, h('span', 'unit', 'Asche')])
      ]),
      tabRow,
      content
    ]));
    ashEl._value = ZU.Meta.get().ash;
    render();
  };

  /* ---------- Tischwahl ---------- */
  /* Hausregeln eines Tisches als kleine Schilder (leer, wenn keine gilt). */
  function ruleRow(enc) {
    var row = h('div', 'rulerow');
    (enc.rules || []).forEach(function (rule) {
      var chip = h('div', 'rulechip', 'Hausregel: ' + ZU.RULES[rule].name);
      ZU.tip.bind(chip, '<b>' + ZU.RULES[rule].name + '</b><p>' + ZU.RULES[rule].text + '</p>');
      row.appendChild(chip);
    });
    return row;
  }

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
        ruleRow(enc),
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
      casinoChips(run),
      h('p', 'sub', s.lives < run.maxLives()
        ? 'Noch ' + s.lives + (s.lives === 1 ? ' Streichholz' : ' Streichhölzer') + '. Verlierst du das letzte, endet der Run.'
        : s.endless ? 'Nachglut: Es geht endlos weiter. Asche gibt es hier keine mehr.'
          : 'Akt ' + s.act + ' von ' + run.acts() + '. Drei Tische, ein Boss.'),
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
        result.ash ? h('div', 'payash', [ZU.iconEl('ash', 'ashico'), h('b', null, '+' + result.ash), h('span', null, 'Asche fürs Hinterzimmer')]) : null,
        result.lostCards ? h('div', 'paynote', result.lostCards + (result.lostCards === 1 ? ' erzeugte Spezialkarte fand' : ' erzeugte Spezialkarten fanden') + ' keinen Platz mehr im Deck.') : null,
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
        var def = ZU.CARDS[id], bind = reward.binds ? reward.binds[index] : 'wild';
        item = ZU.cardStatic(def, { cls: 'large', bind: bind });
        name = def.name + ' · ' + ZU.bindLabel(bind);
        text = def.text;
      }
      var take = btn('Nehmen', 'ember', function () {
        var done = function (replaceId) {
          run.chooseReward(index, replaceId);
          ZU.audio.win();
          var p = ZU.stagePos(item);
          fx.burst(p.x, p.y, { n: 36, speed: 360, life: 1.2 });
          fx.flyTo(item, reward.type === 'trinket' ? bar.slots : bar.deckBtn, 520).then(leave);
        };
        // Volles Deck: Eine vorhandene Spezialkarte muss weichen.
        if (reward.type !== 'trinket' && !run.specialFree()) deckModal(game, 'swap').then(function (cardId) { if (cardId != null) done(cardId); });
        else done();
      });
      var box = h('div', 'reward-item', [item, h('div', 'ename', name), h('p', null, text), take]);
      box.style.animationDelay = (index * 110) + 'ms';
      row.appendChild(box);
    });
    root.appendChild(h('div', 'screen reward', [
      bar.el,
      h('h1', null, reward.type === 'trinket' ? 'Elite besiegt · Wähle ein Trinket' : 'Boss besiegt · Wähle eine Spezialkarte'),
      h('p', 'sub', reward.type === 'trinket' ? 'Trinkets wirken für den Rest des Runs.'
        : run.specialFree() ? 'Die Karte wandert dauerhaft in dein Deck.' : 'Dein Deck ist voll (' + run.specialSlots() + ' Spezialkarten): Die neue Karte ersetzt eine alte.'),
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
    img.style.backgroundImage = 'url(' + ZU.asset('manfred/manfred.png') + ')';
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

    var cardsRow = h('div', 'shelf-row'), specialsRow = h('div', 'shelf-row'), trinketRow = h('div', 'shelf-row'), services = h('div', 'services');
    var rerollBox = h('div', 'rerollbox'), perkBox = h('div', 'perkbox'), trinketNote = h('div', 'shelf-note', '');
    var specialLabel = h('div', 'shelf-label', 'Spezialkarten');
    ZU.tip.bind(specialLabel, '<b>Spezialkarten sind begrenzt</b><p>Dein Deck fasst nur eine feste Zahl davon. Verbrennen schafft Platz; das Upgrade „Kartenetui“ im Hinterzimmer erweitert ihn dauerhaft.</p>');

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

      specialsRow.innerHTML = '';
      function fillShelf(row, shelf) {
        s.shop[shelf].forEach(function (offer, index) {
          var def = ZU.CARDS[offer.def], price = run.offerPrice(shelf, index);
          var slot = h('div', 'offer' + (offer.sold ? ' sold' : ''));
          if (offer.sold) {
            slot.appendChild(h('div', 'soldout', 'Verkauft'));
          } else {
            var card = ZU.cardStatic(def, { bind: offer.bind });
            var full = shelf === 'specials' && !run.specialFree();
            slot.appendChild(card);
            if (price < offer.price) slot.appendChild(h('div', 'discount', '−' + (offer.price - price)));
            if (full) slot.appendChild(h('div', 'offer-full', 'Deck voll'));
            slot.appendChild(priceBtn(price, shelf === 'specials' ? 'gold' : 'tag', function () {
              run.buyOffer(shelf, index);
              ZU.audio.coin(shelf === 'specials' ? 4 : 2);
              mf.act(shelf === 'specials' && offer.price >= 18 ? 'bigbuy' : 'buy');
              say('buy');
              var p = ZU.stagePos(card);
              fx.coins(p.x, p.y, 12);
              fx.flyTo(card, bar.deckBtn, 480);
              render();
            }, full));
          }
          row.appendChild(slot);
        });
      }
      fillShelf(cardsRow, 'cards');
      fillShelf(specialsRow, 'specials');
      if (!s.shop.specials.length) specialsRow.appendChild(h('div', 'shelf-empty', 'Heute nichts Besonderes.'));
      specialLabel.textContent = 'Spezialkarten' + (run.specialSlots() < 90 ? ' · ' + run.specialCount() + '/' + run.specialSlots() : '');

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
      ZU.tip.bind(rerollBox, '<b>Neue Auslage</b><p>Manfred tauscht Karten, Spezialkarten und Trinkets aus. Wird mit jedem Mal 1 Mark teurer.</p>');

      s.shop.trinkets.forEach(function (offer, index) {
        var t = ZU.TRINKETS[offer.id];
        var slot = h('div', 'offer tk' + (offer.sold ? ' sold' : ''));
        if (offer.sold) {
          slot.appendChild(h('div', 'soldout', 'Verkauft'));
        } else {
          var el = ZU.trinketEl(offer.id);
          var price = run.trinketPrice(index);
          el.classList.add('big');
          slot.appendChild(el);
          slot.appendChild(h('div', 'pedestal'));
          slot.appendChild(h('div', 'offer-name', t.name));
          slot.appendChild(priceBtn(price, 'gold', function () {
            run.buyTrinket(index);
            ZU.audio.coin(4);
            mf.act(price >= 30 ? 'bigbuy' : 'buy');
            say('buy');
            var p = ZU.stagePos(el);
            fx.coins(p.x, p.y, 14);
            fx.flyTo(el, bar.slots, 480);
            render();
          }));
        }
        trinketRow.appendChild(slot);
      });
      if (!s.shop.trinkets.length) trinketRow.appendChild(h('div', 'offer sold', [h('div', 'soldout', 'Ausverkauft')]));
      trinketNote.textContent = s.trinkets.length ? '+' + (ZU.TRINKET_SURCHARGE * s.trinkets.length) + ' Mark Aufschlag' : '';

      // Privileg des Akts: bleibt in allen Läden dieses Akts stehen, die Neue Auslage ändert es nicht
      perkBox.innerHTML = '';
      var perkOffer = s.perkOffer;
      if (perkOffer && perkOffer.id && !perkOffer.sold) {
        var perkIcon = ZU.perkEl(perkOffer.id);
        perkIcon.classList.add('big');
        perkBox.appendChild(perkIcon);
        perkBox.appendChild(h('div', 'offer-name', ZU.PERKS[perkOffer.id].name));
        perkBox.appendChild(priceBtn(perkOffer.price, 'seal', function () {
          run.buyPerk();
          ZU.audio.win();
          mf.act('bigbuy');
          say('buy');
          var p = ZU.stagePos(perkIcon);
          fx.burst(p.x, p.y, { n: 36, speed: 340, life: 1.2, colors: ['#fff3c4', '#ffd75e', '#e2b23c', '#a8782a'] });
          fx.flyTo(perkIcon, bar.slots, 520);
          render();
        }));
      } else {
        perkBox.appendChild(h('div', 'shelf-empty', perkOffer && perkOffer.id ? 'Gekauft. Das nächste Privileg gibt es im nächsten Akt.' : 'Alle Privilegien vergeben.'));
      }

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
      var healOff = s.lives >= run.maxLives() || s.shop.healed;
      services.appendChild(h('div', 'service heal' + (healOff ? ' off' : ''), [
        ZU.iconEl('match', 'svc-ico'),
        h('div', 'svc-body', [h('div', 'svc-name', 'Streichholz'), h('p', null, s.shop.healed ? 'Heute schon nachgekauft.' : s.lives >= run.maxLives() ? 'Die Schachtel ist voll.' : 'Stellt ein abgebranntes Streichholz wieder her.')]),
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
        h('div', 'shelf-top', [
          h('div', 'shelf cards-shelf', [h('div', 'shelf-label', 'Karten'), cardsRow]),
          h('div', 'shelf special-shelf', [specialLabel, specialsRow]),
          rerollBox
        ]),
        h('div', 'shelf-pair', [
          h('div', 'shelf trinket-shelf', [h('div', 'shelf-label', 'Trinkets'), trinketRow, trinketNote]),
          h('div', 'shelf perk-shelf', [h('div', 'shelf-label', 'Privileg'), perkBox]),
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
      h('p', 'sub', run.casino().name + ' ist ausgeräumt.' + (run.s.newStake ? ' Die Tür zum nächsten Casino steht offen.' : '')),
      statsBlock(run),
      ashLine(run),
      h('p', 'endnote', 'In der Nachglut gibt es keine Asche mehr – nur noch Ruhm und Bestwert.'),
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
      ashLine(run),
      accountCta(),
      h('div', 'btnrow', [
        btn('Hauptmenü', 'felt', function () { game.toMenu(); }),
        btn('Neuer Run', 'big ember', function () { game.go('casino'); })
      ])
    ]));
    setTimeout(function () {
      var p = ZU.stagePos(matches);
      fx.smoke(p.x, p.y - 20, 30);
    }, 300);
  };

  ZU.screens = screens;
})(window.ZU = window.ZU || {});
