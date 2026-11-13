/* Zündung – Duell-Ansicht: spielt die Ereignisse der Engine als Animationen ab und nimmt Eingaben entgegen. */
(function (ZU) {
  'use strict';
  var h = ZU.h, wait = ZU.wait, fx = ZU.fx;

  // Jede Seite hat ihren Nachziehstapel: der eigene groß neben dem Ablagestapel, der des Gegners kleiner darüber.
  var STOCK = { x: 468, y: 338 }, OSTOCK = { x: 372, y: 236 }, PILE = { x: 648, y: 322 };
  var STOCKS = { player: STOCK, opp: OSTOCK };
  var HAND_Y = 600, OPP_Y = 74, CENTER = 640;
  var ANCHOR = { player: { x: CENTER, y: 492 }, opp: { x: CENTER, y: 168 } };

  var PROMPTS = {
    mulligan: 'Aschenbecher: Klicke eine Karte, um sie zu tauschen – oder behalte dein Blatt.',
    sacrifice: 'Opfer: Klicke die Karten an, die du abwirfst.',
    gamble: 'Zocken: Klicke eine der aufgedeckten Karten. Sie wird sofort gespielt.',
    clone: 'Zytokinese: Klicke eine Handkarte. Eine Kopie wandert dauerhaft in dein Deck.'
  };

  function DuelView(game, run, duel) {
    this.game = game;
    this.run = run;
    this.duel = duel;
    this.sprites = {};
    this.pHand = [];
    this.oHand = [];
    this.pile = [];
    this.staging = [];
    this.selected = [];
    this.busy = true;
    this.mode = 'wait';
    this.sortMode = game.sortMode || 'rank';
    this.status = { skip: { player: 0, opp: 0 }, curse: { player: 0, opp: 0 }, spy: 0, blaze: 0, hodl: [], bank: 0, bonusMult: 1 };
    this.stockCount = { player: 0, opp: 0 };
    this.pileZ = 300;
    this.chain = duel.chain;
    this.destroyed = false;
    this.baseMood = 'idle';
    this.multiOwned = (run.s.kniffe || []).length > 0;
    this.multi = this.multiOwned && game.multiSelect !== false;
  }

  /* ---------- Aufbau ---------- */
  DuelView.prototype.mount = function (root) {
    var self = this, run = this.run, enemy = this.duel.enemy, e = run.encounter();
    this.root = h('div', 'duel kind-' + e.kind);

    // linke Tafel: Gegner
    this.portrait = ZU.portraitEl(enemy.id, 'big');
    this.oppStatus = h('div', 'statusrow');
    this.meStatus = h('div', 'statusrow');
    this.turnFlag = h('div', 'turnflag', 'Karten werden gegeben');
    this.turnCount = h('div', 'turncount', '');
    this.oppCount = h('b', null, '0');
    var sortRank = h('button', 'btn small', 'Wert', { onclick: function () { self.setSort('rank'); } });
    var sortSuit = h('button', 'btn small', 'Farbe', { onclick: function () { self.setSort('suit'); } });
    this.sortButtons = { rank: sortRank, suit: sortSuit };
    this.me = ZU.avatar.el(ZU.avatar.clean(this.game.profile.avatar, ZU.Meta.get()), 'me');
    var rulesEl = h('div', 'rulerow');
    this.duel.tableRules.forEach(function (rule) {
      var chip = h('div', 'rulechip', ZU.RULES[rule].name);
      ZU.tip.bind(chip, '<b>Hausregel: ' + ZU.RULES[rule].name + '</b><p>' + ZU.RULES[rule].text + '</p>');
      rulesEl.appendChild(chip);
    });
    this.duel.douse.forEach(function (id) {
      var chip = h('div', 'rulechip douse', ZU.DOUSE[id].name);
      ZU.tip.bind(chip, '<b>Löschmittel: ' + ZU.DOUSE[id].name + '</b><p>' + ZU.DOUSE[id].text + '</p>');
      rulesEl.appendChild(chip);
    });
    if (this.duel.houseRules.length) rulesEl.appendChild(ZU.houseChip(this.duel.houseRules));
    var left = h('div', 'panel p-left', [
      h('div', 'kindtag k-' + e.kind, ZU.KIND_LABEL[e.kind]),
      this.portrait,
      h('div', 'ename', enemy.name),
      h('div', 'erole', enemy.role),
      h('div', 'epassive', enemy.passiveText),
      rulesEl,
      h('div', 'ecount', ['Handkarten: ', this.oppCount]),
      this.oppStatus,
      h('div', 'grow'),
      h('div', 'me-row', [this.me, h('div', 'me-name', 'Du')]),
      this.turnFlag,
      this.turnCount,
      h('div', 'label', 'Deine Effekte'),
      this.meStatus,
      h('div', 'label', 'Hand sortieren'),
      h('div', 'sortrow', [sortRank, sortSuit])
    ]);

    // rechte Tafel: Run-Werte, Trinkets, Aktionen
    this.bankEl = h('b', null, '0');
    this.bankMult = h('span', 'mult', '');
    this.moneyEl = h('b', null, ZU.fmt(run.s.money));
    var slots = h('div', 'trinkets');
    this.trinketEls = ZU.fillOwned(slots, run);
    this.playBtn = h('button', 'btn big ember', 'Ausspielen', { onclick: function () { self.onPlayButton(); } });
    this.multiBtn = h('button', 'btn small switch', 'An', { onclick: function () { self.setMulti(!self.multi); } });
    this.multiRow = h('div', 'multirow', [h('span', 'label', 'Mehrfachwahl'), this.multiBtn]);
    ZU.tip.bind(this.multiRow, '<b>Mehrfachwahl</b><p>Bei <b>An</b> wählst du Karten aus, die dein Kniff zusammen erlaubt (sie leuchten auf), und legst sie in einem Zug; Karten ohne passenden Partner werden weiter sofort gespielt. Bei <b>Aus</b> wird jede angeklickte Karte sofort gespielt.</p>');
    this.drawBtn = h('button', 'btn big felt', 'Ziehen', { onclick: function () { self.onDrawButton(); } });
    var lives = h('div', 'lives');
    for (var l = 0; l < run.maxLives(); l++) lives.appendChild(ZU.iconEl(l < run.s.lives ? 'match' : 'matchOut', 'match'));
    var right = h('div', 'panel p-right', [
      h('div', 'runline', [
        h('span', null, 'Akt ' + ZU.roman(run.s.act) + ' · Tisch ' + (run.s.table + 1) + '/3'),
        h('button', 'btn icon', '≡', { onclick: function () { self.game.pause(); }, title: 'Menü (Esc)' })
      ]),
      h('div', 'statline', [ZU.iconEl('coin', 'coin'), this.moneyEl, h('span', 'unit', 'Mark'), h('div', 'grow'), lives]),
      h('div', 'statline bank', [h('span', 'label', 'Bank'), this.bankEl, h('span', 'unit', 'Mark'), this.bankMult]),
      h('div', 'label', 'Kniffe, Privilegien und Trinkets'),
      slots,
      h('div', 'grow'),
      this.multiOwned ? this.multiRow : null,
      this.playBtn,
      this.drawBtn
    ]);
    ZU.tip.bind(right.querySelector('.bank'), 'Die <b>Bank</b> füllt sich durch HODL und Opfer und wird nur bei einem Sieg ausgezahlt.');

    // Tischmitte
    this.layer = h('div', 'cards-layer');
    var deck = run.s.starter;
    this.stockEl = h('div', 'stockpile', [ZU.cardBack(deck), ZU.cardBack(deck), ZU.cardBack(deck)]);
    this.stockNum = h('div', 'stocknum', '0');
    this.stockEl.appendChild(this.stockNum);
    this.stockEl.style.left = (STOCK.x - ZU.CARD_W / 2) + 'px';
    this.stockEl.style.top = (STOCK.y - ZU.CARD_H / 2) + 'px';
    this.stockEl.addEventListener('click', function () { if (self.mode === 'play' && !self.duel.afterDraw) self.onDrawButton(); });
    var onePass = this.duel.rules.indexOf('one-pass') >= 0;
    this.stockEl.classList.toggle('onepass', onePass);
    ZU.tip.bind(this.stockEl, 'Dein Nachziehstapel: der Rest deines Decks. Klicken oder Leertaste: eine Karte ziehen. Passt sie, darfst du sie sofort legen – sonst endet der Zug.' +
      (onePass ? '<p><b>Letzter Stapel:</b> Es wird nicht neu gemischt. Ist er leer und muss jemand ziehen, gewinnt, wer weniger Karten hält.</p>' : ''));
    this.layer.appendChild(this.stockEl);
    this.ostockEl = h('div', 'stockpile opp', [ZU.cardBack(), ZU.cardBack(), ZU.cardBack()]);
    this.ostockNum = h('div', 'stocknum', '0');
    this.ostockEl.appendChild(this.ostockNum);
    this.ostockEl.style.left = (OSTOCK.x - ZU.CARD_W / 2) + 'px';
    this.ostockEl.style.top = (OSTOCK.y - ZU.CARD_H / 2) + 'px';
    ZU.tip.bind(this.ostockEl, 'Nachziehstapel des Gegners. Er zieht nur von hier, du nur von deinem eigenen Deck.');
    this.layer.appendChild(this.ostockEl);

    this.chainEl = h('div', 'chain', [ZU.iconEl('flame', 'flame'), h('b', null, '×' + this.chain)]);
    this.glutEl = h('b', 'glutnum', '0');
    // Glutziel: Balken und Zahl; wer es erreicht, fackelt den Tisch ab.
    this.targetFill = h('i', 'target-fill');
    this.targetEl = h('div', 'target', [h('div', 'target-bar', [this.targetFill]), h('span', 'target-num', 'Ziel ' + ZU.fmt(this.duel.target))]);
    this.board = h('div', 'scoreboard', [
      h('div', 'label', 'Kette'), this.chainEl,
      h('div', 'label', 'Glut'), this.glutEl,
      this.duel.target ? this.targetEl : null
    ]);
    ZU.tip.bind(this.board, '<b>Glut</b> = Kartenwert × Kette. Jede gespielte Karte erhöht die Kette um 1, Ziehen setzt sie zurück (passt die gezogene Karte, bleibt die Hälfte).' +
      (this.duel.target ? '<p><b>Glutziel ' + ZU.fmt(this.duel.target) + ':</b> Erreichst du es, brennt der Tisch und du gewinnst sofort – egal, wie viele Karten du noch hältst. Jede Verdopplung darüber zahlt extra Mark und Asche.</p>' : ''));

    this.promptEl = h('div', 'prompt');
    this.bubble = h('div', 'bubble');
    this.stageDim = h('div', 'stagedim');

    this.root.appendChild(h('div', 'tablefelt'));
    this.root.appendChild(left);
    this.root.appendChild(right);
    this.root.appendChild(this.board);
    this.root.appendChild(this.stageDim);
    this.root.appendChild(this.layer);
    this.root.appendChild(this.promptEl);
    this.root.appendChild(this.bubble);
    root.appendChild(this.root);

    this._update = ZU.onFrame(function (dt, time) {
      for (var key in self.sprites) self.sprites[key].update(dt, time);
    });
    this._keys = function (ev) { self.onKey(ev); };
    window.addEventListener('keydown', this._keys);
    this.sortButtons[this.sortMode].classList.add('on');
    this.refresh();
  };

  DuelView.prototype.destroy = function () {
    this.destroyed = true;
    ZU.offFrame(this._update);
    window.removeEventListener('keydown', this._keys);
    ZU.tip.hide();
  };

  DuelView.prototype.begin = function () {
    var self = this;
    ZU.audio.shuffle();
    this.say('start');
    return wait(350).then(function () { return self.runEvents(self.duel.start()); });
  };

  /* ---------- Sprites und Layout ---------- */
  DuelView.prototype.spawn = function (id, x, y) {
    var self = this, card = this.duel.cards[id];
    // Eigene Karten zeigen die Rückseite der Schachtel, die des Gegners die des Hauses.
    var sp = new ZU.Sprite(card, this.layer, x, y, card.owner === 'player' ? this.run.s.starter : null);
    this.sprites[id] = sp;
    sp.el.addEventListener('pointerenter', function () { self.onHover(sp, true); });
    sp.el.addEventListener('pointerleave', function () { self.onHover(sp, false); });
    sp.el.addEventListener('pointermove', function (ev) { if (sp.hover) sp.pointer(ev); });
    sp.el.addEventListener('click', function () { self.onCardClick(sp); });
    ZU.tip.bind(sp.el, function () { return sp.tflip === 0 ? ZU.tip.card(sp.def, sp.bind, sp) : null; });
    return sp;
  };

  DuelView.prototype.kill = function (sp) {
    delete this.sprites[sp.id];
    sp.remove();
  };

  function sortKey(mode) {
    return function (sp) {
      var d = sp.def;
      if (d.special) return 1000 + d.rarity * 20 + ZU.SPECIAL_IDS.indexOf(d.id);
      var r = ZU.RANKS[d.rank].order, s = ZU.SUIT_ORDER.indexOf(d.suit);
      return mode === 'suit' ? s * 10 + r : r * 10 + s;
    };
  }

  DuelView.prototype.sortHand = function () {
    var key = sortKey(this.sortMode);
    this.pHand.sort(function (a, b) { return key(a) - key(b) || a.id - b.id; });
  };

  DuelView.prototype.setSort = function (mode) {
    this.sortMode = this.game.sortMode = mode;
    this.sortButtons.rank.classList.toggle('on', mode === 'rank');
    this.sortButtons.suit.classList.toggle('on', mode === 'suit');
    ZU.audio.click();
    this.sortHand();
    this.layoutHand();
  };

  DuelView.prototype.layoutHand = function () {
    var n = this.pHand.length, half = (n - 1) / 2;
    var spacing = Math.min(94, 700 / Math.max(1, n - 1));
    var curve = Math.min(1.8, 42 / (half * half + 1));
    var fan = n > 1 ? Math.min(3.4, 22 / n) : 0;
    for (var i = 0; i < n; i++) {
      var sp = this.pHand[i], off = i - half;
      var y = HAND_Y + off * off * curve;
      sp.tlift = sp.selected ? 34 : sp.hover ? 12 : 0;
      sp.moveTo(CENTER + off * spacing, y, off * fan, sp.hover ? 1.1 : 1);
      sp.setZ(500 + i);
      sp.sway = 1;
      sp.face(true);
    }
  };

  DuelView.prototype.oppVisible = function () { return this.status.spy > 0; };

  DuelView.prototype.layoutOpp = function () {
    var n = this.oHand.length, half = (n - 1) / 2;
    var spacing = Math.min(48, 400 / Math.max(1, n - 1));
    var visible = this.oppVisible();
    for (var i = 0; i < n; i++) {
      var sp = this.oHand[i], off = i - half;
      sp.tlift = 0;
      sp.moveTo(CENTER + off * spacing, OPP_Y - off * off * 0.9, -off * 2.4, sp.hover && visible ? 0.8 : 0.6);
      sp.setZ(100 + i);
      sp.sway = 0.6;
      sp.face(visible);
      sp.selected = false;
    }
    this.oppCount.textContent = n;
  };

  DuelView.prototype.layoutStaging = function () {
    var n = this.staging.length;
    for (var i = 0; i < n; i++) {
      var sp = this.staging[i];
      sp.moveTo(CENTER + (i - (n - 1) / 2) * 124, 318, 0, sp.hover ? 1.22 : 1.12);
      sp.setZ(800 + i);
      sp.face(true);
      sp.sway = 0.5;
    }
    this.stageDim.classList.toggle('on', n > 0);
  };

  /* who: 'player' (eigener Stapel) oder 'opp'. */
  DuelView.prototype.setStock = function (n, who) {
    who = who || 'player';
    var el = who === 'opp' ? this.ostockEl : this.stockEl, num = who === 'opp' ? this.ostockNum : this.stockNum;
    this.stockCount[who] = Math.max(0, n);
    num.textContent = this.stockCount[who];
    el.classList.toggle('empty', this.stockCount[who] === 0);
    el.classList.toggle('low', this.stockCount[who] > 0 && this.stockCount[who] <= 3);
  };

  DuelView.prototype.removeFromLists = function (sp) {
    [this.pHand, this.oHand, this.staging, this.selected].forEach(function (list) {
      var i = list.indexOf(sp);
      if (i >= 0) list.splice(i, 1);
    });
    sp.selected = false;
    sp.hover = false;
    sp.badge('');
    sp.el.classList.remove('playable', 'unplayable', 'chainable', 'option', 'dimmed');
  };

  DuelView.prototype.toPile = function (sp, under) {
    sp.sway = 0;
    sp.tlift = 0;
    sp.face(true);
    sp.unpointer();
    if (under) {
      sp.setZ(290);
      sp.moveTo(PILE.x + ZU.rand(-6, 6), PILE.y + ZU.rand(-4, 4), ZU.rand(-25, 25), 0.9);
    } else {
      sp.setZ(++this.pileZ);
      sp.moveTo(PILE.x + ZU.rand(-9, 9), PILE.y + ZU.rand(-6, 6), ZU.rand(-13, 13), 1);
      this.pile.push(sp);
      while (this.pile.length > 6) this.kill(this.pile.shift());
    }
  };

  /* Gleicht die Ansicht mit dem Engine-Zustand ab (Sicherheitsnetz nach jeder Ereignisfolge). */
  DuelView.prototype.reconcile = function () {
    var self = this, d = this.duel;
    function sync(list, ids, x, y) {
      var want = {};
      ids.forEach(function (id) { want[id] = true; });
      for (var i = list.length - 1; i >= 0; i--) if (!want[list[i].id]) list.splice(i, 1);
      ids.forEach(function (id) {
        var sp = self.sprites[id] || self.spawn(id, x, y);
        if (list.indexOf(sp) < 0) {
          self.removeFromLists(sp);
          var p = self.pile.indexOf(sp);
          if (p >= 0) self.pile.splice(p, 1);
          list.push(sp);
        }
      });
    }
    sync(this.pHand, d.hand.player, STOCK.x, STOCK.y);
    sync(this.oHand, d.hand.opp, OSTOCK.x, OSTOCK.y);
    this.sortHand();
    this.layoutHand();
    this.layoutOpp();
    this.setStock(d.stocks.player.length, 'player');
    this.setStock(d.stocks.opp.length, 'opp');
    this.status = d._statusEvent().status;
    this.renderStatus();
    this.updateBaseMood();
  };

  /* ---------- Ereignisse abspielen ---------- */
  DuelView.prototype.runEvents = function (events) {
    var self = this;
    this.busy = true;
    this.mode = 'wait';
    this.portrait.classList.remove('thinking');
    this.refresh();
    // Stapelgröße vor dieser Ereignisfolge zurückrechnen
    var count = { player: this.duel.stocks.player.length, opp: this.duel.stocks.opp.length };
    for (var i = events.length - 1; i >= 0; i--) {
      var e = events[i];
      if (e.t === 'reshuffle') count[e.actor] = 0;
      else if (e.t === 'table') count.opp++;
      else if (e.t === 'move' && e.from === 'stock') count[e.pile]++;
    }
    this.setStock(count.player, 'player');
    this.setStock(count.opp, 'opp');
    var chainPromise = Promise.resolve();
    events.forEach(function (ev) {
      chainPromise = chainPromise.then(function () {
        if (self.destroyed) return null;
        var handler = self['on_' + ev.t];
        return handler ? handler.call(self, ev) : null;
      });
    });
    return chainPromise.then(function () { return self.destroyed ? null : self.next(); })
      .catch(function (err) {
        console.error(err);
        if (!self.destroyed) return self.next();
      });
  };

  DuelView.prototype.next = function () {
    var self = this, d = this.duel;
    this.reconcile();
    if (d.phase === 'ended') return this.finish();
    if (d.pending) { this.enterDecision(); return null; }
    if (d.active === 'opp') {
      this.setTurn('opp');
      this.portrait.classList.add('thinking');
      return wait(620).then(function () {
        if (self.destroyed) return null;
        return self.runEvents(d.aiMove());
      });
    }
    this.busy = false;
    this.mode = 'play';
    this.refresh();
    return null;
  };

  DuelView.prototype.on_table = function (ev) {
    var sp = this.spawn(ev.id, OSTOCK.x, OSTOCK.y);
    this.setStock(this.stockCount.opp - 1, 'opp');
    this.toPile(sp);
    ZU.audio.flip();
    return wait(260);
  };

  DuelView.prototype.on_move = function (ev) {
    var sp = this.sprites[ev.id], deal = ev.cause === 'deal';
    if (ev.from === 'stock') {
      var from = STOCKS[ev.pile] || STOCK;
      if (!sp) sp = this.spawn(ev.id, from.x, from.y);
      this.setStock(this.stockCount[ev.pile] - 1, ev.pile);
      sp.kick(0, -260, ZU.rand(-200, 200));
      if (ev.to === 'player') {
        this.pHand.push(sp);
        this.sortHand();
        this.layoutHand();
      } else if (ev.to === 'opp') {
        this.oHand.push(sp);
        this.layoutOpp();
      } else {
        this.staging.push(sp);
        this.layoutStaging();
        ZU.audio.flip();
        return wait(260);
      }
      if (deal) ZU.audio.deal(); else ZU.audio.card();
      return wait(deal ? 75 : 150);
    }
    // Abwurf unter den Stapel (Opfer, Zocken-Reste, Aschenbecher)
    if (!sp) return null;
    var self = this;
    this.removeFromLists(sp);
    this.toPile(sp, true);
    this.layoutHand();
    this.layoutOpp();
    this.layoutStaging();
    ZU.audio.card();
    if (ev.cause === 'sacrifice') fx.burst(sp.x, sp.y, { n: 10, speed: 180 });
    setTimeout(function () { if (self.sprites[sp.id] === sp && self.pile.indexOf(sp) < 0) self.kill(sp); }, 420 / ZU.speed);
    return wait(150);
  };

  DuelView.prototype.on_play = function (ev) {
    var self = this, sp = this.sprites[ev.id];
    if (!sp) sp = this.spawn(ev.id, ANCHOR[ev.actor].x, ANCHOR[ev.actor].y);
    this.removeFromLists(sp);
    this.toPile(sp);
    sp.setZ(700);
    this.layoutHand();
    this.layoutOpp();
    this.layoutStaging();
    ZU.audio.card();
    return wait(230).then(function () {
      sp.setZ(self.pileZ);
      sp.punch(ev.score ? 2.6 + Math.min(4, ev.score.chain * 0.35) : 2.4);
      ZU.audio.place();
      if (ev.score) {
        var sc = ev.score, hot = Math.min(1, sc.chain / 8);
        ZU.audio.score(sc.chain);
        fx.pop(PILE.x + ZU.rand(-20, 20), PILE.y - 96, '+' + ZU.fmt(sc.points), 'score' + (sc.chain >= 5 ? ' hot' : ''));
        fx.burst(PILE.x, PILE.y, { n: 6 + sc.chain * 3, speed: 200 + sc.chain * 30 });
        fx.count(self.glutEl, sc.glut, 380);
        self.setTarget(sc.glut);
        fx.punch(self.glutEl);
        self.setChain(sc.next, true);
        if (sc.chain >= 4) { fx.shake(2 + sc.chain * 0.9); ZU.bg.flash(0.08 + hot * 0.3); }
        if (sc.chain >= 5) self.react('shocked', 900);
      } else {
        fx.burst(PILE.x, PILE.y, { n: 5, speed: 140, colors: ['#e9d8b0', '#b9aa86', '#7d7360'] });
      }
      return wait(ev.score ? Math.max(170, 300 - ev.score.chain * 14) : 330);
    }).then(function () {
      // Trinkets, die bei dieser Karte gezündet haben, melden sich nacheinander.
      var chain = Promise.resolve();
      (ev.trig || []).forEach(function (id) { chain = chain.then(function () { return self.destroyed ? null : self.trinketFx(id, true); }); });
      return chain;
    });
  };

  /* Füllstand des Glutziels; kurz vor dem Ziel glüht der Balken. */
  DuelView.prototype.setTarget = function (glut) {
    var target = this.duel.target;
    if (!target) return;
    var part = Math.min(1, glut / target);
    this.targetFill.style.width = (part * 100).toFixed(1) + '%';
    this.targetEl.classList.toggle('near', part >= 0.75 && part < 1);
    this.targetEl.classList.toggle('done', part >= 1);
  };
  /* Löschmittel des Gegners: Kette und Glut sinken sichtbar, Dampf steigt auf. */
  DuelView.prototype.on_douse = function (ev) {
    var p = ZU.stagePos(this.chainEl), g = ZU.stagePos(this.glutEl), deep = ev.id === 'blanket';
    this.react('smug', 1200);
    ZU.audio.curse();
    fx.pop(p.x, p.y - 46, ZU.DOUSE[ev.id].name + '!', 'bad small');
    fx.smoke(p.x, p.y, deep ? 18 : 10);
    fx.burst(g.x, g.y, { n: deep ? 26 : 12, speed: 220, grav: -260, life: .9, size: 6, colors: ['#e8f4ff', '#9fd0f0', '#5aa0d0'] });
    if (deep) fx.shake(8);
    this.setChain(ev.chain, false);
    fx.punch(this.chainEl, 'fizzle');
    fx.count(this.glutEl, ev.glut, 320);
    this.setTarget(ev.glut);
    return wait(deep ? 620 : 380);
  };
  DuelView.prototype.on_glut = function (ev) {
    fx.count(this.glutEl, ev.glut, 320);
    this.setTarget(ev.glut);
    fx.punch(this.glutEl);
    return wait(260);
  };
  /* Glutziel erreicht: Der Tisch geht in Flammen auf. */
  DuelView.prototype.on_burnt = function (ev) {
    var self = this, times = Math.floor(ev.glut / ev.target);
    ZU.audio.ignite();
    ZU.audio.win();
    ZU.bg.flash(1);
    fx.shake(14);
    this.react('shocked', 2400);
    ZU.audio.voice(this.duel.enemy.id, 'shocked');
    for (var i = 0; i < 7; i++) {
      (function (k) {
        setTimeout(function () {
          if (self.destroyed) return;
          fx.burst(300 + k * 110, 620 - Math.abs(3 - k) * 30, { n: 34, speed: 520, grav: -520, life: 1.4, size: 8, colors: ['#fff3c4', '#ffd75e', '#ff9f3a', '#d2452f'] });
        }, k * 70 / ZU.speed);
      })(i);
    }
    return fx.banner(times >= 2 ? 'Der Tisch brennt! Ziel ×' + times : 'Der Tisch brennt!', 'win', 1500);
  };

  /* ---------- Effekte: Siegel, Makel und Trinkets ---------- */
  /* Funkenspur von A nach B: kleine Stöße entlang der Strecke, zeitlich versetzt. */
  DuelView.prototype.trail = function (ax, ay, bx, by, colors, ms, opts) {
    var self = this, steps = 7;
    opts = opts || {};
    for (var i = 0; i <= steps; i++) {
      (function (k) {
        setTimeout(function () {
          if (self.destroyed) return;
          var arc = opts.arc ? Math.sin(k * Math.PI) * opts.arc : 0;
          fx.burst(ax + (bx - ax) * k, ay + (by - ay) * k - arc, { n: opts.n || 3, speed: opts.speed || 70, life: 0.5, size: opts.size || 5, colors: colors });
        }, (ms || 220) * k / ZU.speed);
      })(i / steps);
    }
    return wait(ms || 220);
  };
  DuelView.prototype.ring = function (x, y, colors, n) {
    for (var i = 0; i < (n || 14); i++) {
      var a = i / (n || 14) * Math.PI * 2;
      fx.burst(x + Math.cos(a) * 46, y + Math.sin(a) * 30, { n: 2, speed: 60, life: 0.55, size: 5, colors: colors });
    }
  };
  DuelView.prototype.spot = function (name) {
    if (name === 'opp') return ANCHOR.opp;
    if (name === 'me') return ANCHOR.player;
    if (name === 'stock') return STOCK;
    if (name === 'bank') return ZU.stagePos(this.bankEl);
    if (name === 'chain') return ZU.stagePos(this.chainEl);
    return PILE;
  };

  /* Jedes Siegel hat seinen eigenen Auftritt, wenn die Karte gelegt wird. */
  DuelView.prototype.on_seal = function (ev) {
    var self = this, sp = ev.card != null ? this.sprites[ev.card] : null;
    var x = sp ? sp.x : PILE.x, y = sp ? sp.y : PILE.y, to;
    switch (ev.seal) {
      case 'glut':
        fx.burst(x, y, { n: 46, speed: 420, life: 1.1, colors: ['#fff3c4', '#ffd75e', '#f08a24', '#d2452f'] });
        fx.burst(x, y + 30, { n: 16, speed: 160, grav: -420, life: 0.9, colors: ['#ffd75e', '#f08a24'] });
        fx.pop(x, y - 120, 'Glutsiegel ×2', 'score hot');
        ZU.audio.ignite();
        ZU.bg.flash(0.35);
        fx.shake(4);
        return wait(360);
      case 'zuend':
        to = this.spot('chain');
        ZU.audio.match();
        fx.pop(x + 60, y - 70, 'Zündkopf: Kette +1', 'gold small');
        return this.trail(x, y - 40, to.x, to.y, ['#fff3c4', '#ff9f3a', '#d2452f'], 240, { arc: 40 }).then(function () {
          fx.burst(to.x, to.y, { n: 14, speed: 200, colors: ['#fff3c4', '#ff9f3a'] });
          fx.punch(self.chainEl);
        });
      case 'gold':
        to = this.spot('bank');
        ZU.audio.coin(4);
        fx.coins(x, y, 6);
        return this.trail(x, y, to.x, to.y, ['#fff1b8', '#ffd75e', '#d79a1e'], 260, { arc: 60, n: 2, size: 6 }).then(function () { self.popBank('+1 Goldrand'); });
      case 'haken':
        to = this.spot('opp');
        ZU.audio.whoosh();
        fx.pop(x - 70, y - 80, 'Widerhaken!', 'good small');
        return this.trail(x, y, to.x, to.y + 30, ['#8fe0d0', '#3aa58f', '#17493a'], 200, { n: 4, speed: 40 }).then(function () {
          fx.burst(to.x, to.y + 30, { n: 18, speed: 260, colors: ['#8fe0d0', '#3aa58f'] });
          fx.shake(3);
        });
      case 'bumerang':
        ZU.audio.whoosh();
        this.ring(x, y, ['#e9d8b0', '#b98a4a', '#6b4a12'], 16);
        fx.pop(x, y - 110, 'Bumerang', 'gold small');
        return wait(200);
      case 'irrlicht':
        ZU.audio.spy();
        fx.burst(x, y, { n: 26, speed: 120, grav: -160, life: 1.3, colors: ['#f3e9ff', '#c9a8ff', '#8a5fd0'] });
        this.ring(x, y, ['#c9a8ff', '#8a5fd0'], 12);
        fx.pop(x + 70, y - 90, 'Irrlicht', 'small');
        return wait(260);
      case 'anker':
        (ev.cards || []).forEach(function (id, i) {
          var card = self.sprites[id];
          if (!card) return;
          setTimeout(function () {
            if (self.destroyed) return;
            fx.burst(card.x, card.y, { n: 12, speed: 150, colors: ['#dfeaff', '#7fa6e8', '#1f2f57'] });
            card.punch(2.2);
          }, i * 110 / ZU.speed);
        });
        fx.pop(ANCHOR.player.x, ANCHOR.player.y - 20, 'Anker hält', 'small');
        ZU.audio.place();
        return wait(260 + (ev.cards || []).length * 60);
      default:
        return null;
    }
  };
  /* Makel: kurz, matt und in Rot – man soll ihn bemerken, aber er soll nicht aufhalten. */
  DuelView.prototype.on_flaw = function (ev) {
    var sp = this.sprites[ev.card], x = sp ? sp.x : PILE.x, y = sp ? sp.y : PILE.y;
    var text = { matt: 'Matt: −4 Glut', stumpf: 'Stumpf: Kette bleibt', zoll: 'Zoll: −1 Mark', klette: 'Klette: du ziehst' }[ev.flaw];
    fx.pop(x - 80, y + 70, text, 'bad small');
    fx.burst(x, y, { n: 8, speed: 110, colors: ['#8f2419', '#4f120c', '#2a1a0a'] });
    if (ev.flaw === 'zoll') { var bank = this.spot('bank'); this.trail(bank.x, bank.y, x, y, ['#d79a1e', '#8f2419'], 180, { n: 2 }); }
    ZU.audio.error();
    return wait(220);
  };

  /* Auftritt je Trinket: [Ziel der Funkenspur, Farben, Klang, Besonderheit]. Ziel: opp, me, bank, chain, stock, pile.
     Trinkets mit sehr ähnlicher Wirkung teilen die Form, unterscheiden sich aber in Farbe und Klang. */
  var TRINKET_FX = {
    'short-fuse': ['opp', ['#fff3c4', '#ff9f3a', '#d2452f'], 'match'],
    'hex-board': ['opp', ['#d9b8ff', '#7a3fb0', '#2a1140'], 'curse', 'smoke'],
    'black-book': ['opp', ['#e6f0ff', '#8fb0e0', '#33466b'], 'spy'],
    ashtray: ['stock', ['#cfc8bd', '#9b958c', '#6b665f'], 'burn', 'smoke'],
    'hot-wire': ['pile', ['#ffffff', '#fff27a', '#ffb000'], 'ignite'],
    'pair-king': ['opp', ['#ffd75e', '#d2452f', '#7c1f1c'], 'whoosh'],
    'card-shark': ['chain', ['#bff3ea', '#3aa58f', '#17493a'], 'flip'],
    lauffeuer: ['chain', ['#ffd75e', '#ff7b3a', '#a82a16'], 'ignite'],
    'diamond-cut': ['bank', ['#fff2cf', '#ff9f3a', '#dc4a1c'], 'coin'],
    'midas-hand': ['bank', ['#ffffff', '#ffe98a', '#ffc21e'], 'coin', 'ring'],
    loesegeld: ['bank', ['#ffd75e', '#a82a16', '#5a1208'], 'coin'],
    farbenlehre: ['opp', ['#c8273a', '#dc4a1c', '#1f2f57', '#1c1f18'], 'select'],
    kettenbrief: ['chain', ['#e6e6e6', '#9aa0a8', '#e2b23c'], 'chip'],
    damenwahl: ['me', ['#ffd9e6', '#e06a8c', '#7c1f3a'], 'select', 'ring'],
    echo: ['pile', ['#f3e9ff', '#b78cff', '#5a3a9a'], 'reflect', 'ring'],
    neunmalklug: ['opp', ['#f3e9d2', '#b98a4a', '#5a4634'], 'tick'],
    rollercoaster: ['opp', ['#8fe0d0', '#d2452f', '#f3e9d2'], 'skip'],
    asbesthandschuh: ['me', ['#d8d2c8', '#9b958c', '#f08a24'], 'reflect', 'ring'],
    'smoke-mirror': ['opp', ['#ffffff', '#cfd6e0', '#8a93a3'], 'reflect', 'from-me'],
    'brass-knuckles': ['opp', ['#fff1b8', '#c79a3f', '#8a6524'], 'place', 'shake'],
    daumenschraube: ['opp', ['#b0b6be', '#6b7078', '#8f2419'], 'error', 'shake'],
    regenschirm: ['me', ['#dfeaff', '#3d5a9a', '#16110f'], 'flip', 'ring'],
    'pocket-watch': ['me', ['#fff3c4', '#e2b23c', '#f3e9d2'], 'tick', 'ring'],
    doppelschloss: ['opp', ['#e2b23c', '#6b4a12', '#16110f'], 'skip'],
    pestmaske: ['me', ['#d9f2e0', '#6fa88a', '#2a3a30'], 'curse', 'ring'],
    'loaded-die': ['stock', ['#ffffff', '#f3e9d2', '#d2452f'], 'shuffle'],
    'velvet-glove': ['bank', ['#e9c8ff', '#8a4fb5', '#3a1a55'], 'coin'],
    stopwatch: ['bank', ['#ffffff', '#c8ced6', '#7d8590'], 'tick'],
    sandmann: ['opp', ['#fff1b8', '#e8c96a', '#b08a2e'], 'whoosh', 'smoke'],
    fluchmuenze: ['bank', ['#d9b8ff', '#7a3fb0', '#ffd75e'], 'curse'],
    teufelspakt: ['me', ['#ff6a4a', '#b3120c', '#3a0606'], 'boss', 'ring'],
    klebefinger: ['opp', ['#ffe0a0', '#e0a030', '#8a5a10'], 'card'],
    sparschwein: ['bank', ['#ffd0dc', '#f08aa8', '#b04a6a'], 'coin'],
    // Glut-Trinkets: kurzer Stoß vom Symbol zum Ablagestapel
    heartblood: ['pile', ['#ffd0d6', '#e4572e', '#c8273a'], 'score'],
    karoglanz: ['pile', ['#fff2cf', '#ffb060', '#dc4a1c'], 'score'],
    'black-series': ['pile', ['#cfd8ef', '#4a5f9a', '#1f2f57'], 'score'],
    'trumpf-ass': ['pile', ['#ffffff', '#ffe98a', '#e2b23c'], 'score', 'ring'],
    zwillinge: ['pile', ['#ffb0b8', '#d2452f', '#7c1f1c'], 'score'],
    dampfkessel: ['pile', ['#ffffff', '#d8d8d8', '#a0a0a0'], 'whoosh', 'smoke'],
    'letzte-glut': ['pile', ['#ffd75e', '#ff5a1e', '#5a1208'], 'ignite', 'ring'],
    kleinvieh: ['pile', ['#ffffff', '#f3e9d2', '#c79a3f'], 'tick'],
    hofstaat: ['pile', ['#ffe98a', '#a878e0', '#5a2a8a'], 'chip'],
    tintenfass: ['pile', ['#b8c8ff', '#3a4aa0', '#10142a'], 'flip'],
    blasebalg: ['chain', ['#f3e9d2', '#b98a4a', '#f08a24'], 'whoosh'],
    'roter-teppich': ['chain', ['#ffb0a0', '#c8273a', '#e2b23c'], 'select'],
    // wachsende Trinkets
    brandstifter: ['pile', ['#ffe08a', '#ff7a1e', '#7a1c08'], 'burn'],
    trophaeenschrank: ['pile', ['#fff6c8', '#e2b23c', '#7a5210'], 'chip', 'ring'],
    schneeball: ['pile', ['#ffffff', '#cfe8ff', '#ff9f3a'], 'tick'],
    wucherer: ['pile', ['#fff1b8', '#d79a1e', '#3a2408'], 'coin'],
    sippschaft: ['pile', ['#f3e9d2', '#b98a4a', '#7c1f1c'], 'select'],
    kettenreaktion: ['chain', ['#ffffff', '#ffe98a', '#ff5a1e'], 'ignite', 'ring'],
    kreuzfeuer: ['pile', ['#ffd75e', '#ff7b3a', '#1c1f18'], 'match'],
    bauernopfer: ['pile', ['#e9d7a8', '#b9853f', '#5a3a1a'], 'place'],
    rotlicht: ['pile', ['#ffb3b3', '#e0303a', '#7c1016'], 'chip'],
    feuerzeug: ['chain', ['#fff3c4', '#e2b23c', '#ff7b3a'], 'match'],
    'volle-zehn': ['pile', ['#ffffff', '#ffe98a', '#c79a3f'], 'coin', 'ring'],
    'erster-funke': ['pile', ['#ffffff', '#fff27a', '#ff9f3a'], 'ignite'],
    'volles-haus': ['me', ['#e6dabd', '#b9853f', '#17493a'], 'shuffle'],
    'heisse-ware': ['pile', ['#ffd0a0', '#ff5a1e', '#7c1f1c'], 'burn', 'smoke'],
    endspurt: ['me', ['#ffffff', '#ffd75e', '#ff5a1e'], 'whoosh', 'shake'],
    vollmond: ['pile', ['#f4f7ff', '#b9c6e6', '#55608a'], 'spy', 'ring'],
    'leere-taschen': ['bank', ['#cfc8bd', '#8a7f6c', '#4a4032'], 'flip', 'smoke'],
    farbwechsel: ['pile', ['#c8273a', '#1c1f18', '#f1e2c0'], 'select'],
    gluecksrad: ['pile', ['#e0303a', '#ffd75e', '#f4f0e2'], 'chip', 'ring'],
    'schwarzer-peter': ['chain', ['#d8d8e6', '#4a4a66', '#101018'], 'flip'],
    schadenfreude: ['chain', ['#ffe98a', '#c79a3f', '#7a3fb0'], 'skip'],
    koenigsmacher: ['chain', ['#fff3c4', '#ffc21e', '#a82a16'], 'chip', 'ring'],
    siebenmeilen: ['chain', ['#ffd75e', '#b9853f', '#5a3a1a'], 'whoosh'],
    strasse: ['chain', ['#f1e2c0', '#d2452f', '#c79a3f'], 'tick'],
    'zweite-luft': ['chain', ['#e8f4ff', '#9fd0f0', '#c79a3f'], 'whoosh', 'ring'],
    glutnest: ['stock', ['#ffd75e', '#ff7b3a', '#6b4a2a'], 'ignite'],
    minimalist: ['stock', ['#ffffff', '#d8d8d8', '#8a8a8a'], 'select'],
    siegelring: ['pile', ['#ffe98a', '#d2452f', '#7c1f1c'], 'chip', 'ring'],
    aktienpaket: ['bank', ['#f1e2c0', '#ffc21e', '#d2452f'], 'coin'],
    serientaeter: ['opp', ['#f4f0e2', '#9aa0a8', '#33363c'], 'tick'],
    gluecksstraehne: ['me', ['#fff3c4', '#ffc21e', '#c79a3f'], 'chip', 'ring'],
    feuerdecke: ['chain', ['#d8c8c0', '#a8483a', '#e2b23c'], 'reflect', 'ring'],
    oelfass: ['chain', ['#3a3a3a', '#ff7b3a', '#ffd75e'], 'reflect'],
    fettbrand: ['chain', ['#ffffff', '#ffd75e', '#ff3a1e'], 'burn', 'shake'],
    perpetuum: ['stock', ['#fff1b8', '#c79a3f', '#3aa58f'], 'flip', 'ring']
  };
  DuelView.prototype.trinketFx = function (id, quick) {
    var el = this.trinketEls[id], spec = TRINKET_FX[id] || ['pile', ['#fff3c4', '#ffd75e', '#e2b23c'], 'chip'], self = this;
    if (!el) return null;
    var p = ZU.stagePos(el), to = this.spot(spec[0]), colors = spec[1], extra = spec[3];
    fx.punch(el, 'trigger');
    if (!quick) fx.pop(p.x - 70, p.y, ZU.TRINKETS[id] ? ZU.TRINKETS[id].name + '!' : '', 'gold small');
    fx.burst(p.x, p.y, { n: 10, speed: 170, colors: colors });
    if (spec[2] === 'coin') ZU.audio.coin(3); else if (spec[2] === 'score') ZU.audio.tick(); else if (ZU.audio[spec[2]]) ZU.audio[spec[2]]();
    var from = extra === 'from-me' ? this.spot('me') : p;
    return this.trail(from.x, from.y, to.x, to.y, colors, quick ? 150 : 230, { arc: spec[0] === 'bank' || spec[0] === 'chain' ? 30 : 0 }).then(function () {
      if (self.destroyed) return;
      if (extra === 'smoke') fx.smoke(to.x, to.y, 12);
      else if (extra === 'ring') self.ring(to.x, to.y, colors, 12);
      else fx.burst(to.x, to.y, { n: quick ? 10 : 16, speed: 220, colors: colors });
      if (extra === 'shake') fx.shake(5);
      if (spec[0] === 'chain') fx.punch(self.chainEl);
      if (spec[0] === 'bank') fx.punch(self.bankEl);
    });
  };

  DuelView.prototype.setChain = function (value, bump) {
    this.chain = value;
    this.chainEl.querySelector('b').textContent = '×' + value;
    this.chainEl.className = 'chain' + (value >= 8 ? ' c3' : value >= 5 ? ' c2' : value >= 3 ? ' c1' : '');
    if (bump) fx.punch(this.chainEl);
  };

  DuelView.prototype.on_chain = function (ev) {
    this.setChain(ev.chain, false);
    if (ev.reset) {
      fx.punch(this.chainEl, 'fizzle');
      var p = ZU.stagePos(this.chainEl);
      fx.smoke(p.x, p.y, 8);
    }
    return null;
  };

  DuelView.prototype.on_effect = function (ev) {
    var a = ANCHOR[ev.tgt], bad = ev.tgt === 'player';
    switch (ev.type) {
      case 'draw':
        fx.pop(a.x, a.y, '+' + ev.amount + ' Karten', bad ? 'bad' : 'good');
        ZU.audio.whoosh();
        if (bad) { fx.shake(5); this.react('smug'); this.maybeSay('attack'); } else { this.react('angry'); this.maybeSay('hurt'); }
        return wait(380);
      case 'skip':
        fx.pop(a.x, a.y, 'Aussetzen!', bad ? 'bad' : 'good');
        ZU.audio.skip();
        if (bad) { this.react('smug'); this.maybeSay('attack'); } else { this.react('angry'); this.maybeSay('hurt'); }
        return wait(420);
      case 'skip-blocked':
        fx.pop(a.x, a.y, 'Abgewehrt!', bad ? 'good' : 'bad');
        ZU.audio.reflect();
        this.react(bad ? 'angry' : 'smug');
        return wait(420);
      case 'fizzle':
        fx.pop(PILE.x, PILE.y - 100, 'Verpufft!', 'bad');
        fx.smoke(PILE.x, PILE.y, 16);
        ZU.audio.reflect();
        return wait(450);
      case 'curse':
        fx.pop(a.x, a.y, 'Verflucht ×' + ev.amount, bad ? 'bad' : 'good');
        ZU.audio.curse();
        fx.smoke(a.x, a.y, 14);
        this.react(bad ? 'smug' : 'angry');
        return wait(450);
      case 'spy':
        fx.pop(ANCHOR.opp.x, ANCHOR.opp.y, 'Durchschaut!', 'good');
        ZU.audio.spy();
        this.react('shocked', 1100);
        return wait(420);
      case 'hodl':
        fx.pop(ANCHOR.player.x, ANCHOR.player.y, 'HODL: +' + ev.amount + ' Mark in 2 Zügen', 'gold');
        ZU.audio.chip();
        return wait(450);
      case 'hodl-pay':
        this.popBank('+' + ev.amount + ' Bank');
        return wait(420);
      case 'bonus':
        fx.pop(PILE.x, PILE.y - 100, 'Prämie ×' + ev.amount, 'gold');
        ZU.audio.coin(4);
        fx.coins(PILE.x, PILE.y, 14);
        return wait(480);
      case 'sacrifice':
        if (ev.amount) this.popBank('+' + ev.amount + ' Bank');
        ZU.audio.burn();
        return wait(420);
      case 'redeal':
        fx.pop(a.x, a.y, 'Neu geben: ' + ev.amount + ' Karten', bad ? 'bad' : 'good');
        ZU.audio.shuffle();
        this.react(bad ? 'smug' : 'shocked');
        return wait(450);
      case 'again':
        fx.pop(PILE.x, PILE.y - 100, ev.src === 'player' ? 'Noch einmal!' : 'Er ist noch einmal dran!', ev.src === 'player' ? 'good' : 'bad');
        ZU.audio.chip();
        return wait(380);
      case 'stoke':
        fx.pop(PILE.x, PILE.y - 100, 'Kette ×' + ev.amount, 'gold');
        ZU.audio.ignite();
        ZU.bg.flash(0.4);
        return wait(420);
      case 'blaze':
        fx.pop(ANCHOR.player.x, ANCHOR.player.y, 'Stichflamme: ' + ev.amount + ' Karten doppelt', 'gold');
        ZU.audio.ignite();
        return wait(420);
      case 'bank':
        this.popBank('+' + ev.amount + ' Bank');
        ZU.audio.coin(3);
        return wait(400);
      case 'cleanse':
        fx.pop(a.x, a.y, 'Bann gebrochen!', ev.src === 'player' ? 'good' : 'bad');
        ZU.audio.reflect();
        return wait(420);
      case 'life':
        fx.pop(ANCHOR.player.x, ANCHOR.player.y, '+1 Streichholz beim Sieg', 'gold');
        ZU.audio.match();
        return wait(450);
      case 'swap-fizzle':
        fx.pop(PILE.x, PILE.y - 100, 'Tausch verpufft', 'small');
        return wait(350);
      case 'gamble-empty':
        fx.pop(PILE.x, PILE.y - 100, 'Nichts Spielbares', 'small');
        return wait(380);
      default:
        return wait(120);
    }
  };

  DuelView.prototype.popBank = function (text) {
    var p = ZU.stagePos(this.bankEl);
    fx.pop(p.x - 20, p.y - 10, text, 'gold small');
    fx.coins(p.x, p.y, 8);
    ZU.audio.coin(2);
  };

  DuelView.prototype.on_swap = function (ev) {
    var tmp = this.pHand;
    this.pHand = this.oHand;
    this.oHand = tmp;
    this.selected = [];
    this.pHand.forEach(function (sp) { sp.selected = false; sp.badge(''); });
    this.sortHand();
    this.layoutHand();
    this.layoutOpp();
    ZU.audio.whoosh();
    fx.shake(9);
    if (ev.src === 'opp') { this.react('smug', 2200); this.maybeSay('attack', 1); }
    else { this.react('shocked', 2200); this.maybeSay('hurt', 1); }
    return fx.banner('Tausch!', 'swap', 900);
  };

  DuelView.prototype.on_status = function (ev) {
    this.status = ev.status;
    this.renderStatus();
    this.layoutOpp();
    return null;
  };

  DuelView.prototype.on_curse = function (ev) {
    var a = ANCHOR[ev.target];
    fx.pop(a.x + 90, a.y - 20, 'Fluch: +1', ev.target === 'player' ? 'bad small' : 'good small');
    ZU.audio.curse();
    return wait(260);
  };

  DuelView.prototype.on_reflect = function (ev) {
    fx.pop(PILE.x, PILE.y - 110, 'Zurückgeworfen!', ev.onto === 'player' ? 'bad' : 'good');
    ZU.audio.reflect();
    fx.shake(6);
    this.react(ev.onto === 'player' ? 'smug' : 'shocked');
    return wait(520);
  };

  /* Ein Kniff trägt den Zug: Name und Kartenzahl blitzen über dem Stapel auf, das Abzeichen zuckt. */
  DuelView.prototype.on_kniff = function (ev) {
    var el = this.trinketEls['kniff:' + ev.id];
    fx.pop(PILE.x, PILE.y - 130, ZU.KNIFFE[ev.id].name + ' ×' + ev.count, 'gold small');
    ZU.audio.chip();
    if (el) { fx.punch(el); var p = ZU.stagePos(el); this.trail(p.x, p.y, PILE.x, PILE.y, ['#fff3c4', '#ffd75e', '#3aa58f'], 240); }
    return wait(160);
  };
  DuelView.prototype.on_trinket = function (ev) {
    var done = this.trinketFx(ev.id, false);
    if (!done) { ZU.audio.chip(); return wait(200); }
    return done.then(function () { return wait(90); });
  };
  /* Siegel „Bumerang": Eine Zwillingskarte kehrt vom Ablagestapel auf die Hand zurück. */
  DuelView.prototype.on_boomerang = function (ev) {
    var sp = this.spawn(ev.id, PILE.x, PILE.y);
    sp.face(true);
    this.pHand.push(sp);
    this.sortHand();
    this.layoutHand();
    fx.pop(PILE.x, PILE.y - 100, 'Bumerang!', 'gold small');
    ZU.audio.whoosh();
    return wait(320);
  };
  /* Eine Hausregel greift sichtbar ein (etwa „Böses Omen" zu Beginn). */
  DuelView.prototype.on_rule = function (ev) {
    fx.pop(PILE.x, PILE.y - 110, ZU.RULES[ev.id].name + '!', 'bad small');
    ZU.audio.curse();
    return wait(380);
  };
  DuelView.prototype.on_passive = function () {
    var text = this.duel.enemy.passiveText, colon = text.indexOf(':');
    this.react('smug');
    var p = ZU.stagePos(this.portrait);
    fx.pop(p.x + 130, p.y, colon > 0 ? text.slice(0, colon) + '!' : 'Passiv!', 'bad small');
    ZU.audio.boss();
    return wait(420);
  };

  DuelView.prototype.on_skipped = function (ev) {
    var a = ANCHOR[ev.actor];
    fx.pop(a.x, a.y, ev.actor === 'player' ? 'Du setzt aus' : 'Gegner setzt aus', ev.actor === 'player' ? 'bad small' : 'good small');
    return wait(380);
  };

  DuelView.prototype.on_turn = function (ev) {
    this.setTurn(ev.actor, ev.extra);
    if (ev.left != null) {
      this.turnCount.textContent = ev.left <= 12 ? 'Sperrstunde in ' + ev.left + (ev.left === 1 ? ' Zug' : ' Zügen') : '';
      this.turnCount.classList.toggle('warn', ev.left <= 5);
    }
    if (ev.extra) {
      fx.pop(ANCHOR[ev.actor].x, ANCHOR[ev.actor].y, 'Noch ein Zug!', ev.actor === 'player' ? 'good' : 'bad');
      return wait(300);
    }
    return null;
  };

  DuelView.prototype.setTurn = function (actor, extra) {
    this.turnFlag.textContent = actor === 'player' ? (extra ? 'Noch ein Zug' : 'Dein Zug') : 'Gegner am Zug';
    this.turnFlag.className = 'turnflag ' + (actor === 'player' ? 'me' : 'opp');
    this.root.classList.toggle('myturn', actor === 'player');
  };

  DuelView.prototype.on_reshuffle = function (ev) {
    var self = this;
    // Nur die abgelegten Karten dieser Seite wandern zurück auf ihren Stapel.
    var to = STOCKS[ev.actor] || STOCK;
    this.pile = this.pile.filter(function (sp) {
      if (ev.ids.indexOf(sp.id) < 0) return true;
      sp.face(false);
      sp.moveTo(to.x, to.y, 0, 1);
      sp.setZ(250);
      setTimeout(function () { if (self.sprites[sp.id] === sp) self.kill(sp); }, 380 / ZU.speed);
      return false;
    });
    ZU.audio.shuffle();
    fx.pop(to.x, to.y - 100, 'Neu gemischt', 'small');
    return wait(430).then(function () { self.setStock(ev.count, ev.actor); });
  };

  DuelView.prototype.on_created = function (ev) {
    var self = this, src = ev.source != null ? this.sprites[ev.source] : null;
    var x = src ? src.x : PILE.x, y = src ? src.y - 40 : PILE.y - 60;
    ev.defs.forEach(function (defId, i) {
      setTimeout(function () {
        if (self.destroyed) return;
        fx.pop(x + i * 40, y - i * 26, '+ ' + ZU.CARDS[defId].name + ' ins Deck', 'gold small', 1500);
        fx.burst(x, y, { n: 12, speed: 220, colors: ['#eafff2', '#9be7b4', '#4fb07a', '#1f6f4a'] });
        ZU.audio.spy();
      }, i * 260 / ZU.speed);
    });
    return wait(500 + ev.defs.length * 240);
  };

  /* Die gerade gezogene Karte passt: Sie darf sofort gelegt werden. */
  DuelView.prototype.on_drawfit = function (ev) {
    var self = this;
    ev.ids.forEach(function (id) { if (self.sprites[id]) self.sprites[id].punch(2.4); });
    if (ev.actor === 'player') {
      fx.pop(ANCHOR.player.x, ANCHOR.player.y, 'Passt! Legen oder passen', 'good small', 1600);
      ZU.audio.select(true);
      return wait(150);
    }
    return wait(380);
  };

  DuelView.prototype.on_curfew = function () {
    var self = this;
    ZU.audio.boss();
    return fx.banner('Sperrstunde!', 'swap', 1200).then(function () { return self.countHands(); });
  };

  /* Kartenvergleich am Ende (Sperrstunde, leerer Stapel, Patt): Beide Hände werden gleichzeitig durchgezählt.
     Erst zügig, die letzte gemeinsame Karte langsamer, dann eine kurze Pause – und danach nur noch die
     überzähligen Karten dessen, der mehr hält. Wer weniger hat, gewinnt. */
  DuelView.prototype.countHands = function () {
    var self = this, mine = this.pHand.slice(), theirs = this.oHand.slice();
    var common = Math.min(mine.length, theirs.length), most = Math.max(mine.length, theirs.length);
    var me = h('div', 'handcount me', '0'), opp = h('div', 'handcount opp', '0');
    // rechts neben den Händen, damit weder Ablagestapel noch Karten verdeckt werden
    me.style.left = opp.style.left = (CENTER + 330) + 'px';
    me.style.top = (HAND_Y - 40) + 'px';
    opp.style.top = (OPP_Y - 22) + 'px';
    this.layer.appendChild(me);
    this.layer.appendChild(opp);
    function tick(list, el, n) {
      if (n > list.length) return;
      list[n - 1].el.classList.add('counted');
      el.textContent = n;
      fx.punch(el);
    }
    var chain = wait(250);
    for (var n = 1; n <= most; n++) {
      (function (n) {
        chain = chain.then(function () {
          if (self.destroyed) return null;
          tick(mine, me, n);
          tick(theirs, opp, n);
          if (n < common) { ZU.audio.tick(); return wait(120); }
          if (n === common) { ZU.audio.select(true); return wait(420).then(function () { return wait(300); }); } // die knappe Stelle, dann Luft holen
          ZU.audio.select(false);
          return wait(300);
        });
      })(n);
    }
    return chain.then(function () {
      if (self.destroyed) return null;
      var winner = self.duel.winner;
      me.classList.add(winner === 'player' ? 'win' : 'lose');
      opp.classList.add(winner === 'player' ? 'lose' : 'win');
      if (mine.length === theirs.length) fx.pop(PILE.x, PILE.y - 110, winner === 'player' ? 'Gleichstand – Kellerschlüssel!' : 'Gleichstand: Das Haus gewinnt', winner === 'player' ? 'good' : 'bad');
      if (winner === 'player') ZU.audio.chip(); else ZU.audio.error();
      return wait(900);
    }).then(function () {
      me.remove();
      opp.remove();
      mine.concat(theirs).forEach(function (sp) { sp.el.classList.remove('counted'); });
    });
  };
  DuelView.prototype.on_stalemate = DuelView.prototype.on_curfew;

  DuelView.prototype.on_showdown = function () {
    ZU.audio.boss();
    fx.shake(8);
    fx.smoke(STOCK.x, STOCK.y, 22);
    var self = this;
    return fx.banner('Stapel leer!', 'swap', 1300).then(function () { return self.countHands(); });
  };

  /* ---------- Status-Anzeige ---------- */
  DuelView.prototype.renderStatus = function () {
    var st = this.status;
    function chip(text, cls, tip) {
      var el = h('div', 'chip ' + cls, text);
      ZU.tip.bind(el, tip);
      return el;
    }
    this.oppStatus.innerHTML = '';
    this.meStatus.innerHTML = '';
    if (st.skip.opp) this.oppStatus.appendChild(chip('Setzt aus', 'good', 'Der Gegner überspringt seinen nächsten Zug.'));
    if (st.curse.opp) this.oppStatus.appendChild(chip('Fluch ×' + st.curse.opp, 'good', 'Die nächsten ' + st.curse.opp + ' Male, die der Gegner zieht, zieht er 1 Karte mehr.'));
    if (st.spy) this.oppStatus.appendChild(chip('Durchschaut ' + st.spy, 'good', 'Du siehst die Gegnerhand noch ' + st.spy + ' Züge.'));
    if (st.skip.player) this.meStatus.appendChild(chip('Aussetzen', 'bad', 'Du überspringst deinen nächsten Zug.'));
    if (st.curse.player) this.meStatus.appendChild(chip('Fluch ×' + st.curse.player, 'bad', 'Die nächsten ' + st.curse.player + ' Male, die du ziehst, ziehst du 1 Karte mehr.'));
    if (st.blaze) this.meStatus.appendChild(chip('Stichflamme ' + st.blaze, 'gold', 'Deine nächsten ' + st.blaze + ' Karten bringen doppelte Glut.'));
    st.hodl.forEach(function (hodl) {
      this.meStatus.appendChild(chip('HODL ' + hodl.turns, 'gold', '+' + hodl.amount + ' Mark in die Bank in ' + hodl.turns + ' Zügen.'));
    }, this);
    if (!this.meStatus.firstChild) this.meStatus.appendChild(h('div', 'chip none', 'keine'));
    fx.count(this.bankEl, st.bank, 300);
    this.bankMult.textContent = st.bonusMult > 1 ? 'Prämie ×' + st.bonusMult : '';
  };

  /* ---------- Gegner spricht ---------- */
  DuelView.prototype.say = function (kind) {
    var lines = this.duel.enemy.say[kind], self = this;
    if (!lines || !lines.length) return;
    ZU.audio.voice(this.duel.enemy.id, { start: 'greet', attack: 'smug', gloat: 'gloat', hurt: 'angry', nervous: 'nervous', win: 'win', lose: 'lose' }[kind] || 'smug');
    this.bubble.textContent = lines[Math.floor(Math.random() * lines.length)];
    fx.punch(this.bubble, 'on');
    this.portrait.classList.add('talk');
    clearTimeout(this._sayTimer);
    this._sayTimer = setTimeout(function () {
      self.bubble.classList.remove('on');
      self.portrait.classList.remove('talk');
    }, 2900);
    this._said = ZU.time;
  };

  DuelView.prototype.maybeSay = function (kind, chance) {
    if (ZU.time - (this._said || -99) < 4) return;
    if (Math.random() < (chance == null ? 0.5 : chance)) this.say(kind);
  };

  /* Kurze Reaktion des Gegners (Gesichtsausdruck wechselt und springt zurück). */
  DuelView.prototype.react = function (mood, ms) {
    if (this.mode === 'ended') return;
    this.portrait.setMood(mood, ms || 1700);
    // Die eigene Figur reagiert gegenläufig: Freut sich der Gegner, ärgert sie sich – und umgekehrt.
    var mine = { smug: 'angry', angry: 'smug', shocked: 'smug' }[mood];
    if (mine && this.me) this.me.setMood(mine, ms || 1700);
  };

  /* Grundstimmung je nach Spielstand: nervös, wenn du kurz vor dem Sieg stehst, hämisch im umgekehrten Fall. */
  DuelView.prototype.updateBaseMood = function () {
    if (this.duel.phase === 'ended') return;
    var p = this.duel.hand.player.length, o = this.duel.hand.opp.length, base = 'idle';
    if (p <= 2 && o > p) base = 'shocked';
    else if (o <= 2 && p > o) base = 'smug';
    if (base === this.baseMood) return;
    this.baseMood = base;
    this.portrait.setBase(base);
    if (base === 'shocked') this.maybeSay('nervous', 0.9);
    else if (base === 'smug') this.maybeSay('gloat', 0.9);
  };

  /* ---------- Eingaben ---------- */
  DuelView.prototype.onHover = function (sp, on) {
    var inHand = this.pHand.indexOf(sp) >= 0, staged = this.staging.indexOf(sp) >= 0;
    var opp = this.oHand.indexOf(sp) >= 0 && this.oppVisible();
    if (!inHand && !staged && !opp) { sp.hover = false; sp.unpointer(); return; }
    sp.hover = on;
    if (!on) sp.unpointer();
    else if (inHand && !this.busy) ZU.audio.hover();
    if (inHand) this.layoutHand(); else if (staged) this.layoutStaging(); else this.layoutOpp();
  };

  DuelView.prototype.onCardClick = function (sp) {
    if (this.busy) return;
    ZU.audio.unlock();
    if (this.mode === 'decision') {
      var p = this.duel.pending;
      if (!p || p.options.indexOf(sp.id) < 0) { ZU.audio.error(); return; }
      if (p.pool === 'staging' || p.max === 1) { this.submitDecision([sp.id]); return; }
      this.toggle(sp, p.max);
      if (this.selected.length === p.max) {
        this.submitDecision(this.selected.map(function (item) { return item.id; }));
      } else {
        this.refresh();
      }
      return;
    }
    if (this.mode !== 'play' || this.pHand.indexOf(sp) < 0) return;
    // Auch bei eingeschalteter Mehrfachwahl: Karten ohne Partner gleichen Werts gehen sofort raus.
    if (this.duel.afterDraw || !this.multi || (!this.selected.length && !this.hasPartner(sp))) { this.playNow(sp); return; }
    this.toggle(sp, 99);
    this.refresh();
  };

  /* Gibt es eine zweite Handkarte mit gleichem Wert, die sich mit dieser zusammen legen ließe? */
  DuelView.prototype.hasPartner = function (sp) {
    if (sp.def.special) return false;
    var duel = this.duel;
    return this.pHand.some(function (other) {
      return other !== sp && !other.def.special && duel.groupOk([sp.id, other.id]).ok;
    });
  };

  /* Ohne Mehrfachwahl: Ein Klick spielt die Karte sofort. */
  DuelView.prototype.playNow = function (sp) {
    var check = this.duel.canPlay('player', [sp.id]);
    if (!check.ok) {
      ZU.audio.error();
      sp.kick(ZU.rand(-420, 420), 0, ZU.rand(-260, 260));
      fx.pop(CENTER, 470, check.reason, 'small bad', 1400);
      return;
    }
    ZU.audio.click();
    this.clearSelection();
    this.runEvents(this.duel.play('player', [sp.id]));
  };

  DuelView.prototype.setMulti = function (on) {
    this.multi = this.game.multiSelect = !!on;
    ZU.audio.click();
    this.clearSelection();
    this.refresh();
  };

  DuelView.prototype.toggle = function (sp, max) {
    var i = this.selected.indexOf(sp);
    if (i >= 0) {
      this.selected.splice(i, 1);
      sp.selected = false;
      ZU.audio.select(false);
    } else {
      if (max === 1 && this.selected.length) {
        this.selected[0].selected = false;
        this.selected = [];
      }
      if (this.selected.length >= max) { ZU.audio.error(); return; }
      this.selected.push(sp);
      sp.selected = true;
      sp.punch(1.6);
      ZU.audio.select(true);
    }
    this.layoutHand();
  };

  DuelView.prototype.clearSelection = function () {
    this.selected.forEach(function (sp) { sp.selected = false; sp.badge(''); });
    this.selected = [];
    this.layoutHand();
  };

  DuelView.prototype.onPlayButton = function () {
    if (this.busy || this.mode !== 'play' || !this.multi) return;
    ZU.audio.unlock();
    var ids = this.selected.map(function (sp) { return sp.id; });
    var check = this.duel.canPlay('player', ids);
    if (!check.ok) { this.deny(check.reason); return; }
    ZU.audio.click();
    this.clearSelection();
    this.runEvents(this.duel.play('player', ids));
  };

  DuelView.prototype.onDrawButton = function () {
    if (this.busy) return;
    ZU.audio.unlock();
    if (this.mode === 'decision') {
      if (this.duel.pending && this.duel.pending.kind === 'mulligan') this.submitDecision([]);
      return;
    }
    if (this.mode !== 'play') return;
    ZU.audio.click();
    this.clearSelection();
    // Nach dem Ziehen einer passenden Karte heißt der Knopf „Passen" und beendet den Zug.
    this.runEvents(this.duel.afterDraw ? this.duel.pass('player') : this.duel.draw('player'));
  };

  DuelView.prototype.deny = function (reason) {
    ZU.audio.error();
    fx.punch(this.playBtn, 'shake');
    if (reason) fx.pop(CENTER, 470, reason, 'small bad', 1400);
    this.selected.forEach(function (sp) { sp.kick(ZU.rand(-300, 300), 0, ZU.rand(-200, 200)); });
  };

  DuelView.prototype.enterDecision = function () {
    var p = this.duel.pending;
    this.mode = 'decision';
    this.busy = false;
    this.clearSelection();
    this.promptEl.textContent = PROMPTS[p.kind] + (p.kind === 'sacrifice' ? ' (' + p.min + ')' : '');
    this.promptEl.classList.add('on');
    if (p.pool === 'staging') {
      this.staging.forEach(function (sp) {
        var ok = p.options.indexOf(sp.id) >= 0;
        sp.el.classList.toggle('option', ok);
        sp.el.classList.toggle('dimmed', !ok);
      });
    }
    this.setTurn('player');
    this.refresh();
    ZU.audio.spy();
  };

  DuelView.prototype.submitDecision = function (ids) {
    ZU.audio.click();
    this.promptEl.classList.remove('on');
    this.clearSelection();
    this.runEvents(this.duel.decide(ids));
  };

  DuelView.prototype.onKey = function (ev) {
    if (this.game.modalOpen()) return;
    if (ev.code === 'Space') { ev.preventDefault(); this.onDrawButton(); }
    else if (ev.code === 'Enter' || ev.code === 'NumpadEnter') { ev.preventDefault(); this.onPlayButton(); }
    else if (/^Digit[0-9]$/.test(ev.code) && !this.busy) {
      var index = (Number(ev.code.slice(5)) + 9) % 10;
      if (this.pHand[index]) this.onCardClick(this.pHand[index]);
    }
  };

  DuelView.prototype.refresh = function () {
    var self = this, d = this.duel, mode = this.mode, busy = this.busy;
    var play = this.playBtn, draw = this.drawBtn;
    var pending = mode === 'decision' ? d.pending : null;
    var ids = this.selected.map(function (sp) { return sp.id; });
    draw.style.visibility = 'visible';
    // Der Ausspielen-Knopf wird nur bei eingeschalteter Mehrfachwahl gebraucht.
    play.style.display = this.multi && !pending ? '' : 'none';
    this.multiBtn.textContent = this.multi ? 'An' : 'Aus';
    this.multiBtn.classList.toggle('on', this.multi);

    if (pending) {
      if (pending.kind === 'mulligan') { draw.textContent = 'Behalten'; draw.disabled = false; }
      else { draw.style.visibility = 'hidden'; }
    } else {
      play.textContent = ids.length > 1 ? 'Legen (' + ids.length + ')' : 'Ausspielen';
      draw.textContent = d.afterDraw && d.afterDraw.actor === 'player' ? 'Passen' : 'Ziehen';
      var ok = mode === 'play' && !busy && ids.length > 0 && d.canPlay('player', ids).ok;
      play.disabled = !ok;
      play.classList.toggle('ready', ok);
      draw.disabled = busy || mode !== 'play';
    }

    // Markierungen der Handkarten
    var firstRank = this.selected.length && !this.selected[0].def.special ? this.selected[0].def.rank : null;
    var chosen = this.selected.map(function (item) { return item.id; });
    this.pHand.forEach(function (sp) {
      var cl = sp.el.classList;
      var active = mode === 'play' && !busy;
      var playable = active && d.playable('player', sp.id);
      cl.toggle('playable', playable && !sp.selected);
      cl.toggle('unplayable', active && !playable && !sp.selected && !firstRank);
      cl.toggle('chainable', active && !!firstRank && !sp.selected && !sp.def.special && d.groupOk(chosen.concat([sp.id])).ok);
      cl.toggle('selected', sp.selected);
      cl.toggle('option', !!pending && pending.pool === 'hand' && !sp.selected);
      var order = self.selected.indexOf(sp);
      sp.badge(self.selected.length > 1 && order >= 0 ? String(order + 1) : '');
    });
    this.stockEl.classList.toggle('active', mode === 'play' && !busy && !d.afterDraw);
    this.root.classList.toggle('busy', busy);
  };

  /* ---------- Ende ---------- */
  DuelView.prototype.finish = function () {
    var self = this, won = this.duel.winner === 'player';
    this.busy = true;
    this.refresh();
    this.promptEl.classList.remove('on');
    this.portrait.classList.remove('thinking');
    this.portrait.setMood(won ? 'defeated' : 'smug', 60000);
    this.me.setMood(won ? 'smug' : 'defeated', 60000);
    this.portrait.classList.add(won ? 'ko' : 'gloating');
    this.mode = 'ended';
    this.say(won ? 'lose' : 'win');
    var done;
    if (won) {
      ZU.audio.ignite();
      ZU.audio.win();
      ZU.bg.set('win');
      ZU.bg.flash(1);
      fx.shake(16);
      for (var i = 0; i < 6; i++) fx.burst(ZU.rand(300, 980), ZU.rand(200, 520), { n: 26, speed: 420, life: 1.4 });
      this.oHand.forEach(function (sp) { sp.face(true); sp.kick(ZU.rand(-500, 500), ZU.rand(-200, 300), ZU.rand(-600, 600)); });
      done = fx.banner('Zündung!', 'win', 1500);
    } else {
      ZU.audio.lose();
      ZU.bg.set('lose');
      fx.shake(8);
      this.pHand.forEach(function (sp) { sp.kick(ZU.rand(-300, 300), ZU.rand(100, 400), ZU.rand(-400, 400)); });
      fx.smoke(CENTER, HAND_Y - 40, 30);
      done = fx.banner('Ausgebrannt', 'lose', 1500);
    }
    return done.then(function () { if (!self.destroyed) self.game.duelFinished(self); });
  };

  ZU.DuelView = DuelView;
})(window.ZU = window.ZU || {});
