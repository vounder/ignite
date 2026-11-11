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
      this.go('menu');
    },

    applySettings: function () {
      var s = this.profile.settings;
      ZU.speed = s.speed;
      ZU.audio.setSfx(s.sfx);
      ZU.audio.setMusic(s.music);
      document.getElementById('crt').classList.toggle('off', !s.crt);
    },
    saveProfile: function () { ZU.Profile.save(this.profile); },
    modalOpen: function () { return ZU.modal.isOpen(); },

    /* Wechselt den Screen mit kurzer Überblendung. */
    go: function (name) {
      var root = this.root;
      if (this.view) { this.view.destroy(); this.view = null; }
      if (this.cleanup) { this.cleanup(); this.cleanup = null; }
      ZU.tip.hide();
      ZU.modal.closeAll();
      this.screen = name;
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
      this.run = ZU.Run.start(starterId, seed);
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
      if (this.run) this.run.recordScore();
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
          self.go(run.afterPayout());
        });
        return;
      }
      if (result.saved) {
        ZU.fx.banner('Goldenes Streichholz!', 'win', 1500).then(function () { self.go('select'); });
        ZU.audio.match();
        return;
      }
      ZU.audio.match();
      if (run.s.phase === 'defeat') this.go('defeat'); else this.go('select');
    }
  };

  ZU.game = game;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { game.init(); });
  else game.init();
})(window.ZU = window.ZU || {});
