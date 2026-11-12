/* Zündung – Spielsteuerung: verbindet Run-Logik, Screens und Duell-Ansicht. */
(function (ZU) {
  'use strict';

  var game = {
    run: null,
    profile: null,
    screen: null,
    view: null,
    cleanup: null,
    sortMode: 'rank',

    init: function () {
      this.profile = ZU.Profile.load();
      this.root = document.getElementById('screen');
      ZU.initStage();
      ZU.bg.init();
      this.applySettings();
      var self = this;
      window.addEventListener('pointerdown', function () { ZU.audio.unlock(); }, { once: false, passive: true });
      window.addEventListener('keydown', function (ev) {
        ZU.audio.unlock();
        if (ev.code !== 'Escape') return;
        if (ZU.modal.isOpen()) {
          var top = ZU.modal.top();
          if (top && !top.locked) ZU.modal.close(top);
        } else if (self.run && self.screen !== 'menu' && self.screen !== 'starter') {
          self.pause();
        }
      });
      // Erst der Vorspann, dabei lädt alles, was der Titel zeigt; reicht die Zeit nicht, folgt der Ladebalken.
      var core = ZU.TITLE_ART.map(function (path) { return ZU.asset(path); }).concat([ZU.cardAtlas()]);
      ZU.boot.start(core).then(function () { self.start(); });
    },

    /* Nach Vorspann und Laden: Titel zeigen, den Rest im Hintergrund holen. */
    start: function () {
      var self = this;
      this.go('menu');
      ZU.app.init(this);
      // Erst die Gegner eines gespeicherten Runs, dann nach und nach alles Übrige.
      var saved = ZU.Run.load();
      if (saved) ZU.preloadEnemies(saved.s.encounters.map(function (e) { return e.enemy; }), true);
      ZU.preload([ZU.cardAtlas()], true); // die Karten zuerst: sie sind schon im Menü zu sehen
      setTimeout(function () { ZU.preloadAll(); }, 300);
      ZU.account.init().then(function () {
        var token = new URLSearchParams(location.search).get('reset');
        if (token && ZU.account.available) ZU.resetModal(token);
      });
    },

    applySettings: function () {
      var s = this.profile.settings;
      ZU.speed = s.speed;
      ZU.audio.setSfx(s.sfx);
      ZU.audio.setMusic(s.music);
      document.getElementById('crt').classList.toggle('off', !s.crt);
      ZU.bg.setEnabled(s.bg);
    },
    /* Speichert Einstellungen, ohne zwischenzeitlich geänderte Statistik oder Meta-Fortschritt zu überschreiben. */
    saveProfile: function () {
      var fresh = ZU.Profile.load();
      fresh.settings = this.profile.settings;
      fresh.seenHelp = this.profile.seenHelp;
      ZU.Profile.save(fresh);
      this.profile = fresh;
    },
    modalOpen: function () { return ZU.modal.isOpen(); },

    /* Bilder, ohne die ein Bildschirm halb leer erschiene. Alles Weitere lädt im Hintergrund nach. */
    needs: function (name) {
      var run = this.run, urls = [], self = this;
      function add(path) { urls.push(ZU.asset(path)); }
      if (name === 'casino') ZU.CASINO_ART.forEach(add);
      if (name === 'backroom') { add('backroom/room.png'); add('backroom/veil.png'); }
      if (!run || ['select', 'duel', 'shop', 'esme', 'reward'].indexOf(name) < 0) return urls;
      urls.push(ZU.cardAtlas());
      run.s.trinkets.forEach(function (id) { add('trinkets/' + id + '.png'); });
      (run.s.kniffe || []).forEach(function (k) { add('kniffe/' + k.id + '.png'); });
      if (run.s.shop && run.s.shop.kniff) add('kniffe/' + run.s.shop.kniff.id + '.png');
      (run.s.perks || []).forEach(function (id) { add('perks/' + id + '.png'); });
      run.s.collection.forEach(function (card) {
        if (ZU.CARDS[card.def].special) add('special/' + card.def + '.png');
        if (card.seal) add('seals/' + card.seal + '.png');
        if (card.flaw) add('seals/flaw.png');
      });
      if (name === 'select') run.s.encounters.forEach(function (enc) { add('enemies/' + enc.enemy + '.png'); });
      if (name === 'duel') {
        var enemy = run.encounter().enemy;
        add('enemies/' + enemy + '.png');
        ZU.ENEMIES[enemy].pool.forEach(function (id) { add('special/' + id + '.png'); });
      }
      if (name === 'shop' && run.s.shop) {
        add('manfred/manfred.png');
        add('manfred/shop.png');
        run.s.shop.trinkets.forEach(function (offer) { add('trinkets/' + offer.id + '.png'); });
        run.s.shop.specials.forEach(function (offer) { add('special/' + offer.def + '.png'); });
        if (run.s.perkOffer && run.s.perkOffer.id) add('perks/' + run.s.perkOffer.id + '.png');
      }
      if (name === 'esme') ['esme', 'room', 'pack-single', 'pack-double', 'pack-bag'].forEach(function (file) { add('esme/' + file + '.png'); });
      if (name === 'reward' && run.s.reward) run.s.reward.options.forEach(function (id) { add((run.s.reward.type === 'trinket' ? 'trinkets/' : 'special/') + id + '.png'); });
      return urls;
    },

    /* Wechselt den Bildschirm. Fehlen dafür noch Bilder, wartet ein Schleier bzw. der Ladebildschirm darauf.
       cover: Schleier in jedem Fall kurz zeigen (Übergang, der langsamen Geräten Zeit verschafft). */
    go: function (name, cover) {
      var self = this, need = this.needs(name);
      var missing = need.some(function (url) { return !ZU.isLoaded(url); });
      if (!missing && !cover) { this.show(name); return; }
      this.pendingGo = name;
      ZU.boot.wait(need, { cover: !!cover, hold: cover ? 420 : 0 }).then(function () {
        if (self.pendingGo !== name) return; // inzwischen wurde anderswohin gewechselt
        self.pendingGo = null;
        self.show(name);
      });
    },

    /* Baut den Bildschirm auf, mit kurzer Überblendung. */
    show: function (name) {
      this.pendingGo = null;
      var root = this.root;
      if (this.view) { this.view.destroy(); this.view = null; }
      if (this.cleanup) { this.cleanup(); this.cleanup = null; }
      ZU.tip.hide();
      ZU.modal.closeAll();
      this.screen = name;
      if (this.run && this.run.s.encounters) ZU.preloadEnemies(this.run.s.encounters.map(function (e) { return e.enemy; }), true);
      // Farbwelt: im Run die des Casinos, bei der Schachtelwahl die des gewählten Hauses, sonst neutral.
      var inRun = this.run && ['select', 'duel', 'shop', 'esme', 'reward', 'victory', 'defeat'].indexOf(name) >= 0 && !this.run.meta().legacy;
      ZU.bg.setTheme(inRun ? this.run.casino().tint : name === 'starter' ? ZU.CASINOS[ZU.Meta.get().stake].tint : null);
      // Glutfunken: im Menü dezent, im Run von wenigen im ersten Akt bis zur vollen Glut im letzten.
      var acts = inRun ? this.run.acts() : 1, progress = inRun ? (acts > 1 ? Math.min(1, (this.run.s.act - 1) / (acts - 1)) : 1) : 0;
      ZU.bg.setEmber(inRun ? 0.3 + 0.7 * progress : 0.35);
      root.classList.remove('enter');
      root.innerHTML = '';
      this.profile = ZU.Profile.load();
      if (name === 'duel') {
        var enc = this.run.encounter();
        ZU.bg.set(enc.kind);
        ZU.audio.music(this.run.music(enc.kind === 'boss'));
        if (enc.kind === 'boss') ZU.audio.boss();
        var duel = this.run.newDuel();
        this.view = new ZU.DuelView(this, this.run, duel);
        this.view.mount(root);
        this.view.begin();
      } else {
        this.cleanup = ZU.screens[name](this, root) || null;
      }
      void root.offsetWidth;
      root.classList.add('enter');
    },

    toMenu: function () { this.go('menu'); },

    startRun: function (starterId) {
      var seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
      this.run = ZU.Run.start(starterId, seed, ZU.Meta.runOptions());
      this.run.save();
      var self = this;
      // Der Schleier ist zugleich Übergang: Dahinter laden die Gegner des ersten Akts.
      self.go('select', true);
    },

    continueRun: function (run) {
      this.run = run;
      this.go(run.s.phase === 'duel' ? 'select' : run.s.phase);
    },

    startDuel: function () { this.go('duel'); },

    pause: function () {
      if (!ZU.modal.isOpen()) ZU.settingsModal(this, true);
    },

    abandon: function () {
      if (this.run) {
        this.run.recordScore();
        ZU.account.reportRun({ countRun: false, score: this.run.s.score, act: this.run.s.act });
      }
      ZU.Run.clearSave();
      this.run = null;
      this.go('menu');
    },

    /* Wird von der Duell-Ansicht gerufen, sobald die Schlussanimation durch ist. */
    duelFinished: function (view) {
      var self = this, run = this.run;
      var result = run.finishDuel(view.duel);
      if (result.won) {
        ZU.payout(this, result).then(function () {
          var phase = run.afterPayout();
          if (phase === 'victory') ZU.account.reportRun({ won: true, score: run.s.score, act: run.s.act });
          self.go(phase);
        });
        return;
      }
      if (result.spared) {
        ZU.fx.banner('Phönixfeder!', 'win', 1500).then(function () { self.go('select'); });
        ZU.audio.match();
        return;
      }
      if (result.saved) {
        ZU.fx.banner('Goldenes Streichholz!', 'win', 1500).then(function () { self.go('select'); });
        ZU.audio.match();
        return;
      }
      ZU.audio.match();
      if (run.s.phase === 'defeat') {
        // In der Nachglut zählt der Run schon als Sieg; dann wird nur noch der Bestwert gemeldet.
        ZU.account.reportRun({ won: false, score: run.s.score, act: run.s.act, countRun: !run.s.endless });
        this.go('defeat');
      } else {
        this.go('select');
      }
    }
  };

  ZU.game = game;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { game.init(); });
  else game.init();
})(window.ZU = window.ZU || {});
