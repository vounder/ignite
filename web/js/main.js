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
      ZU.preload(ZU.TITLE_ART.map(function (path) { return ZU.asset(path); }), true);
      this.go('menu');
      ZU.app.init(this);
      // Erst die Gegner eines gespeicherten Runs, dann nach und nach alles Übrige.
      var saved = ZU.Run.load();
      if (saved) ZU.preloadEnemies(saved.s.encounters.map(function (e) { return e.enemy; }), true);
      ZU.preload([ZU.cardAtlas()], true); // die Karten zuerst: sie sind schon im Menü zu sehen
      setTimeout(function () { ZU.preloadAll(); }, 1200);
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

    /* Wechselt den Screen mit kurzer Überblendung. */
    go: function (name) {
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
        ZU.audio.music('game');
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
      setTimeout(function () { self.go('select'); }, 380);
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
