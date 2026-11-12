/* Zündung – Klang: synthetische Effekte per WebAudio, Musik als Schleife mit Überblendung. */
(function (ZU) {
  'use strict';

  var ctx = null, master = null, noiseBuf = null;
  var sfxVolume = 0.7, musicVolume = 0.5;
  var tracks = {}, current = null, wanted = null, unlocked = false, hidden = false;
  var SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28]; // Pentatonik: jede Kettenstufe klingt höher

  function ensure() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = sfxVolume;
      master.connect(ctx.destination);
      var len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
    return !!ctx;
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (hidden || !ensure()) return; // im Hintergrund nichts ansammeln, das beim Zurückkommen auf einmal losginge
    var t = ctx.currentTime + (when || 0);
    var osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, freq, q, vol, when, slideTo, type) {
    if (hidden || !ensure()) return;
    var t = ctx.currentTime + (when || 0);
    var src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    src.buffer = noiseBuf;
    src.loop = true;
    filter.type = type || 'bandpass';
    filter.frequency.setValueAtTime(freq, t);
    if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    filter.Q.value = q || 1;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  function semis(n) { return Math.pow(2, n / 12); }

  var A = {
    unlock: function () {
      if (unlocked) return;
      unlocked = true;
      ensure();
      if (ctx && ctx.state === 'suspended' && !hidden) ctx.resume();
      if (wanted) A.music(wanted);
    },
    setSfx: function (v) { sfxVolume = v; if (master) master.gain.value = v; },
    setMusic: function (v) { musicVolume = v; if (current && tracks[current]) tracks[current].el.volume = v * tracks[current].fade; },

    card: function () { noise(0.07, ZU.rand(2200, 3200), 1.2, 0.22); },
    deal: function () { noise(0.05, ZU.rand(2600, 3600), 1.5, 0.14); },
    place: function () {
      tone(150, 0.09, 'sine', 0.3, 0, 70);
      noise(0.04, 900, 0.8, 0.18);
    },
    flip: function () { noise(0.09, 1400, 0.9, 0.14, 0, 3200); },
    select: function (up) { tone(up ? 620 : 470, 0.06, 'triangle', 0.14, 0, up ? 820 : 380); },
    hover: function () { tone(1900, 0.02, 'sine', 0.035); },
    click: function () { tone(520, 0.05, 'square', 0.09, 0, 380); noise(0.03, 2400, 1, 0.08); },
    error: function () { tone(150, 0.1, 'square', 0.12); tone(120, 0.14, 'square', 0.12, 0.11); },
    /* Punkteklang: wird mit jeder Kettenstufe höher. */
    score: function (step) {
      var s = SCALE[Math.min(SCALE.length - 1, Math.max(0, step - 1))];
      var f = 392 * semis(s);
      tone(f, 0.16, 'triangle', 0.22);
      tone(f * 2, 0.12, 'sine', 0.1, 0.01);
      noise(0.05, 5200, 2, 0.07);
    },
    chip: function () { tone(2700, 0.05, 'sine', 0.12); tone(3500, 0.07, 'sine', 0.1, 0.035); },
    coin: function (step) {
      var f = 1150 * semis(Math.min(12, step || 0));
      tone(f, 0.06, 'square', 0.07);
      tone(f * 1.5, 0.14, 'square', 0.07, 0.055);
    },
    tick: function () { tone(1300, 0.025, 'square', 0.05); },
    ignite: function () {
      noise(0.5, 500, 0.7, 0.3, 0, 5200);
      tone(90, 0.4, 'sine', 0.35, 0, 45);
      noise(0.7, 3200, 0.5, 0.1, 0.12, 900, 'highpass');
    },
    whoosh: function () { noise(0.38, 300, 0.8, 0.26, 0, 2600); },
    skip: function () { tone(660, 0.09, 'square', 0.1); tone(440, 0.16, 'square', 0.1, 0.09); },
    curse: function () { tone(110, 0.5, 'sawtooth', 0.12, 0, 70); tone(116, 0.5, 'sawtooth', 0.1, 0, 74); },
    spy: function () { tone(880, 0.08, 'sine', 0.12); tone(1320, 0.18, 'sine', 0.1, 0.07); },
    reflect: function () { tone(1400, 0.2, 'triangle', 0.14, 0, 500); noise(0.2, 2600, 3, 0.1); },
    shuffle: function () { for (var i = 0; i < 7; i++) noise(0.045, ZU.rand(2000, 3400), 1.3, 0.13, i * 0.05); },
    burn: function () { noise(0.6, 900, 0.6, 0.22, 0, 3600); tone(180, 0.35, 'sawtooth', 0.06, 0, 60); },
    match: function () { noise(0.16, 2600, 0.9, 0.2, 0, 5200); noise(0.5, 1200, 0.5, 0.12, 0.12, 2400); },
    win: function () {
      [0, 4, 7, 12, 16].forEach(function (s, i) { tone(523 * semis(s), 0.28, 'triangle', 0.2, i * 0.09); });
      tone(1046, 0.6, 'sine', 0.12, 0.45);
    },
    lose: function () {
      [0, -3, -7, -12].forEach(function (s, i) { tone(330 * semis(s), 0.34, 'sawtooth', 0.1, i * 0.16); });
    },
    boss: function () { tone(73, 0.9, 'sawtooth', 0.16, 0, 55); tone(110, 0.9, 'square', 0.07, 0.05, 82); },

    /* Musik: eine Schleife je Szene, weich überblendet. Jedes Casino hat sein Stück in zwei Stufen
       ("game-<casino>" und "game-<casino>-boss"), der Laden eine Fassung für Esmes Nebenzimmer ("shop-esme");
       innerhalb eines solchen Paars wird an Ort und Stelle gewechselt. */
    music: function (name) {
      wanted = name;
      if (!unlocked) return;
      if (current === name) return;
      var previous = current;
      current = name;
      if (handover) { // ein Wechsel lief noch: abbrechen, beide Spuren werden unten neu einsortiert
        var open = handover;
        stopHandover();
        [open.track, open.from].forEach(function (t) { if (t !== tracks[name]) fade(t, 0); });
      }
      var old = previous && tracks[previous];
      var stay = old && name && family(previous) === family(name) && !hidden && !old.el.paused && old.fade > 0.5;
      if (old && !stay) fade(old, 0);
      if (!name) return;
      var track = load(name);
      if (hidden) return; // spielt los, sobald die Seite wieder zu sehen ist
      if (stay) handOver(name, previous); else start(track);
    },
    /* Lädt ein Stück schon einmal, damit der Wechsel dorthin nicht warten muss. */
    prepare: function (name) { if (unlocked && name) load(name); }
  };

  function load(name) {
    var track = tracks[name];
    if (!track) {
      var el = new Audio(ZU.asset('audio/' + name + '.mp3'));
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0;
      track = tracks[name] = { el: el, fade: 0, timer: null };
    }
    return track;
  }

  function family(name) { return name.replace(/-(boss|esme)$/, ''); }

  /* Wechsel zwischen den Stufen eines Stücks (beide sind gleich lang und laufen im selben Tempo): Die neue
     Spur steigt stumm an der Stelle ein, an der die alte gerade spielt, und wird nachgeführt, bis beide
     gleichauf sind. Erst dann blenden sie kurz über – die Musik läuft dabei einfach weiter. */
  var handover = null;
  function stopHandover() {
    if (!handover) return;
    clearInterval(handover.timer);
    handover = null;
  }
  function handOver(name, fromName) {
    var track = tracks[name], from = tracks[fromName], el = track.el, src = from.el, lead = 0.08, tries = 0;
    function length() { return isFinite(src.duration) && src.duration > 0 ? src.duration : 0; }
    function place() {
      var at = src.currentTime + lead, len = length();
      try { el.currentTime = len ? ((at % len) + len) % len : Math.max(0, at); } catch (e) { /* noch nicht bereit */ }
    }
    clearInterval(track.timer);
    track.fade = 0;
    el.volume = 0;
    place();
    var started = el.play();
    if (started && started.catch) started.catch(function () { /* Datei fehlt oder gesperrt: stumm weiter */ });
    handover = { track: track, from: from, timer: setInterval(function () {
      tries++;
      var ready = !el.paused && !el.seeking && el.readyState >= 3;
      var len = length(), off = el.currentTime - src.currentTime;
      if (len) off = ((off + len / 2) % len + len) % len - len / 2; // auch über das Schleifenende hinweg
      var close = ready && Math.abs(off) < 0.03;
      if (!close && tries < 14 && !src.paused) {
        if (ready) { lead -= off; place(); } // Vorhalt nachstellen und noch einmal ansetzen
        return;
      }
      stopHandover();
      if (ready) { fade(track, 1, 0.2); fade(from, 0, 0.2); }
      else { fade(from, 0); start(track); } // noch nicht geladen: gewöhnlich überblenden, die neue beginnt vorn
    }, 240) };
  }

  function start(track) {
    var started = track.el.play();
    if (started && started.catch) started.catch(function () { /* Datei fehlt oder Autoplay gesperrt: stumm weiter */ });
    fade(track, 1);
  }

  /* Seite im Hintergrund (anderer Tab, App gewechselt, Bildschirm aus): Musik und Effekte halten an und
     setzen beim Zurückkommen dort wieder ein. */
  function setHidden(now) {
    if (hidden === now) return;
    hidden = now;
    if (hidden) {
      stopHandover();
      Object.keys(tracks).forEach(function (name) {
        var track = tracks[name];
        clearInterval(track.timer);
        track.el.pause();
        if (name !== current) { track.fade = 0; track.el.volume = 0; }
      });
      if (ctx && ctx.state === 'running') ctx.suspend();
    } else {
      if (ctx && unlocked && ctx.state === 'suspended') ctx.resume();
      if (unlocked && current && tracks[current]) start(tracks[current]);
    }
  }
  if (typeof document !== 'undefined') {
    hidden = !!document.hidden;
    document.addEventListener('visibilitychange', function () { setHidden(!!document.hidden); });
    window.addEventListener('pagehide', function () { setHidden(true); });
    window.addEventListener('pageshow', function () { setHidden(!!document.hidden); });
  }

  function fade(track, to, speed) {
    clearInterval(track.timer);
    track.timer = setInterval(function () {
      var step = speed || 0.06;
      track.fade = to > track.fade ? Math.min(to, track.fade + step) : Math.max(to, track.fade - step);
      track.el.volume = ZU.clamp(musicVolume * track.fade, 0, 1);
      if (track.fade === to) {
        clearInterval(track.timer);
        if (to === 0) track.el.pause();
      }
    }, 60);
  }

  ZU.audio = A;
})(window.ZU = window.ZU || {});
