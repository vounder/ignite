/* Zündung – Duell-Ansicht: spielt die Ereignisse der Engine als Animationen ab und nimmt Eingaben entgegen. */
(function (ZU) {
  'use strict';
  var h = ZU.h, wait = ZU.wait, fx = ZU.fx;

  var STOCK = { x: 468, y: 322 }, PILE = { x: 648, y: 322 };
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
    this.status = { skip: { player: 0, opp: 0 }, curse: { player: 0, opp: 0 }, spy: 0, hodl: [], bank: 0, bonusMult: 1 };
    this.stockCount = 0;
    this.pileZ = 300;
    this.chain = duel.chain;
    this.destroyed = false;
    this.baseMood = 'idle';
    this.multiOwned = run.has('nimble-fingers');
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
    var left = h('div', 'panel p-left', [
      h('div', 'kindtag k-' + e.kind, ZU.KIND_LABEL[e.kind]),
      this.portrait,
      h('div', 'ename', enemy.name),
      h('div', 'erole', enemy.role),
      h('div', 'epassive', enemy.passiveText),
      h('div', 'ecount', ['Handkarten: ', this.oppCount]),
      this.oppStatus,
      h('div', 'grow'),
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
    this.trinketEls = {};
    var slots = h('div', 'trinkets');
    for (var i = 0; i < ZU.MAX_TRINKETS; i++) {
      var id = run.s.trinkets[i];
      if (id) {
        var t = ZU.trinketEl(id);
        this.trinketEls[id] = t;
        slots.appendChild(t);
      } else {
        slots.appendChild(h('div', 'trinket empty'));
      }
    }
    this.playBtn = h('button', 'btn big ember', 'Ausspielen', { onclick: function () { self.onPlayButton(); } });
    this.multiBtn = h('button', 'btn small switch', 'An', { onclick: function () { self.setMulti(!self.multi); } });
    this.multiRow = h('div', 'multirow', [h('span', 'label', 'Mehrfachwahl'), this.multiBtn]);
    ZU.tip.bind(this.multiRow, '<b>Flinke Finger</b><p>Bei <b>An</b> wählst du Karten mit gleichem Wert aus und legst sie zusammen; Karten ohne passenden Partner werden weiter sofort gespielt. Bei <b>Aus</b> wird jede angeklickte Karte sofort gespielt.</p>');
    this.drawBtn = h('button', 'btn big felt', 'Ziehen', { onclick: function () { self.onDrawButton(); } });
    var lives = h('div', 'lives');
    for (var l = 0; l < ZU.MAX_LIVES; l++) lives.appendChild(ZU.iconEl(l < run.s.lives ? 'match' : 'matchOut', 'match'));
    var right = h('div', 'panel p-right', [
      h('div', 'runline', [
        h('span', null, 'Akt ' + ZU.roman(run.s.act) + ' · Tisch ' + (run.s.table + 1) + '/3'),
        h('button', 'btn icon', '≡', { onclick: function () { self.game.pause(); }, title: 'Menü (Esc)' })
      ]),
      h('div', 'statline', [ZU.iconEl('coin', 'coin'), this.moneyEl, h('span', 'unit', 'Mark'), h('div', 'grow'), lives]),
      h('div', 'statline bank', [h('span', 'label', 'Bank'), this.bankEl, h('span', 'unit', 'Mark'), this.bankMult]),
      h('div', 'label', 'Trinkets'),
      slots,
      h('div', 'grow'),
      this.multiOwned ? this.multiRow : null,
      this.playBtn,
      this.drawBtn
    ]);
    ZU.tip.bind(right.querySelector('.bank'), 'Die <b>Bank</b> füllt sich durch HODL und Opfer und wird nur bei einem Sieg ausgezahlt.');

    // Tischmitte
    this.layer = h('div', 'cards-layer');
    this.stockEl = h('div', 'stockpile', [ZU.cardBack(), ZU.cardBack(), ZU.cardBack()]);
    this.stockNum = h('div', 'stocknum', '0');
    this.stockEl.appendChild(this.stockNum);
    this.stockEl.style.left = (STOCK.x - ZU.CARD_W / 2) + 'px';
    this.stockEl.style.top = (STOCK.y - ZU.CARD_H / 2) + 'px';
    this.stockEl.addEventListener('click', function () { if (self.mode === 'play') self.onDrawButton(); });
    ZU.tip.bind(this.stockEl, 'Nachziehstapel. Klicken oder Leertaste: eine Karte ziehen (beendet den Zug).');
    this.layer.appendChild(this.stockEl);

    this.chainEl = h('div', 'chain', [ZU.iconEl('flame', 'flame'), h('b', null, '×' + this.chain)]);
    this.glutEl = h('b', 'glutnum', '0');
    this.board = h('div', 'scoreboard', [
      h('div', 'label', 'Kette'), this.chainEl,
      h('div', 'label', 'Glut'), this.glutEl
    ]);
    ZU.tip.bind(this.board, '<b>Glut</b> = Kartenwert × Kette. Jede gespielte Karte erhöht die Kette um 1, Ziehen setzt sie zurück. Je 150 Glut gibt es beim Sieg 1 Mark extra (max. 6).');

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
    var sp = new ZU.Sprite(card, this.layer, x, y);
    this.sprites[id] = sp;
    sp.el.addEventListener('pointerenter', function () { self.onHover(sp, true); });
    sp.el.addEventListener('pointerleave', function () { self.onHover(sp, false); });
    sp.el.addEventListener('pointermove', function (ev) { if (sp.hover) sp.pointer(ev); });
    sp.el.addEventListener('click', function () { self.onCardClick(sp); });
    ZU.tip.bind(sp.el, function () { return sp.tflip === 0 ? ZU.tip.card(sp.def) : null; });
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

  DuelView.prototype.setStock = function (n) {
    this.stockCount = Math.max(0, n);
    this.stockNum.textContent = this.stockCount;
    this.stockEl.classList.toggle('empty', this.stockCount === 0);
    this.stockEl.classList.toggle('low', this.stockCount > 0 && this.stockCount <= 3);
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
    sync(this.oHand, d.hand.opp, STOCK.x, STOCK.y);
    this.sortHand();
    this.layoutHand();
    this.layoutOpp();
    this.setStock(d.stock.length);
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
    var count = this.duel.stock.length;
    for (var i = events.length - 1; i >= 0; i--) {
      var e = events[i];
      if (e.t === 'reshuffle') count = 0;
      else if (e.t === 'table' || (e.t === 'move' && e.from === 'stock')) count++;
    }
    this.setStock(count);
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
    var sp = this.spawn(ev.id, STOCK.x, STOCK.y);
    this.setStock(this.stockCount - 1);
    this.toPile(sp);
    ZU.audio.flip();
    return wait(260);
  };

  DuelView.prototype.on_move = function (ev) {
    var sp = this.sprites[ev.id], deal = ev.cause === 'deal';
    if (ev.from === 'stock') {
      if (!sp) sp = this.spawn(ev.id, STOCK.x, STOCK.y);
      this.setStock(this.stockCount - 1);
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
        if (sc.doubled) fx.pop(PILE.x + 70, PILE.y - 60, '×2 Herz', 'small heart');
        fx.burst(PILE.x, PILE.y, { n: 6 + sc.chain * 3, speed: 200 + sc.chain * 30 });
        fx.count(self.glutEl, sc.glut, 380);
        fx.punch(self.glutEl);
        self.setChain(sc.next, true);
        if (sc.chain >= 4) { fx.shake(2 + sc.chain * 0.9); ZU.bg.flash(0.08 + hot * 0.3); }
        if (sc.chain >= 5) self.react('shocked', 900);
      } else {
        fx.burst(PILE.x, PILE.y, { n: 5, speed: 140, colors: ['#e9d8b0', '#b9aa86', '#7d7360'] });
      }
      return wait(ev.score ? Math.max(170, 300 - ev.score.chain * 14) : 330);
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

  DuelView.prototype.on_trinket = function (ev) {
    var el = this.trinketEls[ev.id];
    if (el) {
      fx.punch(el, 'trigger');
      var p = ZU.stagePos(el);
      fx.pop(p.x - 70, p.y, ZU.TRINKETS[ev.id].name + '!', 'gold small');
      fx.burst(p.x, p.y, { n: 8, speed: 150, colors: ['#fff3c4', '#ffd75e', '#e2b23c'] });
    }
    ZU.audio.chip();
    return wait(330);
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
      fx.pop(ANCHOR.player.x, ANCHOR.player.y, 'Noch ein Zug!', 'good');
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
    var top = this.pile[this.pile.length - 1];
    this.pile.slice(0, -1).forEach(function (sp) {
      sp.face(false);
      sp.moveTo(STOCK.x, STOCK.y, 0, 1);
      sp.setZ(250);
      setTimeout(function () { if (self.sprites[sp.id] === sp) self.kill(sp); }, 380 / ZU.speed);
    });
    this.pile = top ? [top] : [];
    ZU.audio.shuffle();
    fx.pop(STOCK.x, STOCK.y - 100, 'Neu gemischt', 'small');
    return wait(430).then(function () { self.setStock(ev.count); });
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

  DuelView.prototype.on_curfew = function () {
    ZU.audio.boss();
    return fx.banner('Sperrstunde!', 'swap', 1200);
  };
  DuelView.prototype.on_stalemate = DuelView.prototype.on_curfew;

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
    if (!this.multi || (!this.selected.length && !this.hasPartner(sp))) { this.playNow(sp); return; }
    this.toggle(sp, 99);
    this.refresh();
  };

  /* Gibt es eine zweite Handkarte mit gleichem Wert, die sich mit dieser zusammen legen ließe? */
  DuelView.prototype.hasPartner = function (sp) {
    if (sp.def.special) return false;
    return this.pHand.some(function (other) {
      return other !== sp && !other.def.special && other.def.rank === sp.def.rank;
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
    this.runEvents(this.duel.draw('player'));
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
      draw.textContent = 'Ziehen';
      var ok = mode === 'play' && !busy && ids.length > 0 && d.canPlay('player', ids).ok;
      play.disabled = !ok;
      play.classList.toggle('ready', ok);
      draw.disabled = busy || mode !== 'play';
    }

    // Markierungen der Handkarten
    var firstRank = this.selected.length && !this.selected[0].def.special ? this.selected[0].def.rank : null;
    this.pHand.forEach(function (sp) {
      var cl = sp.el.classList;
      var active = mode === 'play' && !busy;
      var playable = active && d.playable('player', sp.id);
      cl.toggle('playable', playable && !sp.selected);
      cl.toggle('unplayable', active && !playable && !sp.selected && !firstRank);
      cl.toggle('chainable', active && !!firstRank && !sp.selected && !sp.def.special && sp.def.rank === firstRank);
      cl.toggle('selected', sp.selected);
      cl.toggle('option', !!pending && pending.pool === 'hand' && !sp.selected);
      var order = self.selected.indexOf(sp);
      sp.badge(self.selected.length > 1 && order >= 0 ? String(order + 1) : '');
    });
    this.stockEl.classList.toggle('active', mode === 'play' && !busy);
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
