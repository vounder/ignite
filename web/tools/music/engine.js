/* Zündung – Musikwerkzeug: Synthesizer auf WebAudio. Rechnet eine Partitur offline zu einer nahtlosen Schleife.
   Läuft im Browser (OfflineAudioContext); render.mjs startet dafür ein Chromium ohne Fenster. */
(function (root) {
  'use strict';
  var MU = root.MU = root.MU || {};
  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  MU.midi = function (name) {
    if (typeof name === 'number') return name;
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) throw new Error('Unbekannte Note: ' + name);
    return 12 * (parseInt(m[3], 10) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  };
  MU.hz = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };
  MU.db = function (db) { return Math.pow(10, db / 20); };
  MU.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  /* Notenfolge ab Schlag `at`. Zeichen: Note/Schritt, also "F#4/1 E4/.5"; Pause "_/1"; Akkord "(A3 C#4 E4)/2";
     Lautstärke "D4*0.6/1"; klingende Länge abweichend vom Schritt "D4/1:3". "|" ist nur Lesehilfe. */
  MU.seq = function (at, text, o) {
    o = o || {};
    var out = [], t = at;
    var gate = o.gate == null ? 0.96 : o.gate, vel = o.vel == null ? 0.8 : o.vel, shift = o.transpose || 0;
    (text.match(/\([^)]*\)\S*|\S+/g) || []).forEach(function (tok) {
      if (tok === '|') return;
      var m = /^(\([^)]*\)|[^*\/:]+)(?:\*([\d.]+))?\/([\d.]+)(?::([\d.]+))?$/.exec(tok);
      if (!m) throw new Error('Unlesbares Zeichen: ' + tok);
      var step = parseFloat(m[3]), len = m[4] ? parseFloat(m[4]) : step * gate, v = m[2] ? parseFloat(m[2]) * vel / 0.8 : vel;
      if (m[1] !== '_') {
        var names = m[1].charAt(0) === '(' ? m[1].slice(1, -1).trim().split(/\s+/) : [m[1]];
        names.forEach(function (n) { out.push({ t: t, d: len, n: MU.midi(n) + shift, v: v }); });
      }
      t += step;
    });
    out.end = t;
    return out;
  };

  /* Schlagzeugraster: je Zeile ein Instrument, je Zeichen ein Schritt (Standard: Sechzehntel).
     X = betont, x = normal, o = leise, - = sehr leise, . = Pause. */
  MU.pattern = function (at, rows, o) {
    var step = (o && o.step) || 0.25, out = [];
    Object.keys(rows).forEach(function (name) {
      var row = rows[name].replace(/[\s|]/g, '');
      for (var i = 0; i < row.length; i++) {
        var c = row.charAt(i);
        if (c === '.') continue;
        out.push({ t: at + i * step, d: step, n: name, v: c === 'X' ? 1 : c === 'x' ? 0.78 : c === 'o' ? 0.5 : 0.3 });
      }
    });
    return out;
  };

  /* Akkordfolge → Abschnitte. Je Takt ein Text: "Em9", zwei Hälften "Bm9 A69" oder mit Längen "Em7b5:2 Bb13:1 A7:1". */
  MU.cells = function (form, firstBar, beatsPerBar) {
    var out = [], bpb = beatsPerBar || 4;
    form.forEach(function (text, i) {
      var parts = text.split(' '), at = (firstBar + i) * bpb;
      parts.forEach(function (part, p) {
        var bits = part.split(':'), len = bits[1] ? parseFloat(bits[1]) : bpb / parts.length;
        out.push({ bar: firstBar + i, index: i, part: p, parts: parts.length, at: at, len: len, name: bits[0] });
        at += len;
      });
    });
    return out;
  };

  MU.repeat = function (notes, times, every) {
    var out = [];
    for (var i = 0; i < times; i++) notes.forEach(function (n) { out.push({ t: n.t + i * every, d: n.d, n: n.n, v: n.v }); });
    return out;
  };

  /* ------------------------------------------------------------------ Bausteine */

  function sineWave(ctx, phase) {
    return ctx.createPeriodicWave(new Float32Array([0, Math.sin(phase)]), new Float32Array([0, Math.cos(phase)]), { disableNormalization: true });
  }

  function impulse(ctx, seconds, rand, o) {
    /* Hallfahne: Rauschen, das ausklingt und dabei dunkler wird; kurze Vorverzögerung. */
    var sr = ctx.sampleRate, n = Math.floor(seconds * sr), buf = ctx.createBuffer(2, n, sr);
    var pre = Math.floor((o.pre || 0.02) * sr), rt = o.rt || seconds * 0.8;
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), lp = 0, lp2 = 0, sum = 0;
      for (var i = pre; i < n; i++) {
        var t = (i - pre) / sr, x = rand() * 2 - 1;
        var k = 0.55 * Math.exp(-t / (rt * 0.35)) + 0.06;      // Filterkoeffizient sinkt: Höhen sterben zuerst
        lp += k * (x - lp);
        lp2 += k * (lp - lp2);
        var e = Math.exp(-6.91 * t / rt) * Math.min(1, t / 0.004);
        d[i] = lp2 * e;
        sum += d[i] * d[i];
      }
      var norm = 1 / Math.sqrt(sum);
      for (var j = 0; j < n; j++) d[j] *= norm;
    }
    return buf;
  }

  function shaperCurve(amount) {
    var n = 2048, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = i / (n - 1) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  /* ------------------------------------------------------------------ Instrumente
     Jedes Instrument bekommt (ctx, Optionen, Umgebung) und liefert play(events):
     events = [{t, d, m, v, n}] in Sekunden, über alle Durchläufe hinweg aufsteigend sortiert. */
  var INST = {};

  /* Fläche: verstimmte Sägezähne durch ein weiches Tiefpassfilter, langsam atmend. */
  INST.pad = function (ctx, o, env) {
    var lfo = env.lfo(o.lfoRate || 0.13, 0), lfoAmt = ctx.createGain();
    lfoAmt.gain.value = o.lfoCents == null ? 350 : o.lfoCents;
    lfo.connect(lfoAmt);
    return function (events) {
      events.forEach(function (e) {
        var f = MU.hz(e.m), A = Math.min(o.attack || 0.5, e.d * 0.8), R = o.release || 1.4, end = e.t + e.d;
        var cut = (o.cutoff || 1000) * Math.pow(2, (e.m - 60) / 12 * (o.track == null ? 0.4 : o.track));
        var filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.Q.value = o.q || 0.7;
        filt.frequency.setValueAtTime(cut * 0.55, e.t);
        filt.frequency.linearRampToValueAtTime(cut * (0.75 + 0.5 * e.v), e.t + A);
        filt.frequency.setTargetAtTime(cut * 0.6, end, R / 3);
        lfoAmt.connect(filt.detune);
        var vca = ctx.createGain();
        vca.gain.setValueAtTime(0, e.t);
        vca.gain.linearRampToValueAtTime(0.16 * e.v, e.t + A);
        vca.gain.setTargetAtTime(0, end, R / 5);
        var voices = o.voices || 3, spread = o.spread == null ? 9 : o.spread;
        for (var i = 0; i < voices; i++) {
          var osc = ctx.createOscillator(), pan = ctx.createStereoPanner();
          var pos = voices === 1 ? 0 : i / (voices - 1) * 2 - 1;
          osc.type = o.wave || 'sawtooth';
          osc.frequency.value = f;
          osc.detune.value = pos * spread + (env.rand() - 0.5) * 2;
          pan.pan.value = pos * (o.width == null ? 0.7 : o.width);
          osc.connect(pan);
          pan.connect(filt);
          osc.start(e.t);
          osc.stop(end + R * 1.6);
        }
        if (o.sub) {
          var sub = ctx.createOscillator(), sg = ctx.createGain();
          sub.type = 'triangle';
          sub.frequency.value = f / 2;
          sg.gain.value = o.sub;
          sub.connect(sg);
          sg.connect(filt);
          sub.start(e.t);
          sub.stop(end + R * 1.6);
        }
        filt.connect(vca);
        vca.connect(env.out);
      });
    };
  };

  /* E-Piano: Frequenzmodulation, weicher Körper und kurzer metallischer Anschlag (Zinke). */
  INST.ep = function (ctx, o, env) {
    return function (events) {
      events.forEach(function (e) {
        var f = MU.hz(e.m), end = e.t + e.d, v = e.v;
        var decay = (o.decay || 1.8) * Math.pow(2, (60 - e.m) / 24);
        var rel = o.release || 0.09;
        var vca = ctx.createGain();
        vca.gain.setValueAtTime(0, e.t);
        vca.gain.linearRampToValueAtTime(0.3 * (0.35 + 0.65 * v), e.t + 0.004);
        vca.gain.setTargetAtTime(0, e.t + 0.004, decay);
        vca.gain.setTargetAtTime(0, end, rel);
        var stop = end + rel * 8;
        // Körper
        var car = ctx.createOscillator(), mod = ctx.createOscillator(), idx = ctx.createGain();
        car.frequency.value = f;
        mod.frequency.value = f * (o.ratio || 1);
        var bark = (o.bark == null ? 1 : o.bark) * (0.35 + 1.5 * v * v) * Math.pow(2, (60 - e.m) / 30);
        idx.gain.setValueAtTime(bark * f, e.t);
        idx.gain.setTargetAtTime(bark * f * 0.22, e.t, 0.16);
        mod.connect(idx);
        idx.connect(car.frequency);
        car.connect(vca);
        // Zinke
        var tine = ctx.createOscillator(), tmod = ctx.createOscillator(), tidx = ctx.createGain(), tg = ctx.createGain();
        var tf = Math.min(f * 14, 9000);
        tine.frequency.value = f;
        tmod.frequency.value = tf;
        tidx.gain.setValueAtTime((o.tine == null ? 0.5 : o.tine) * v * f, e.t);
        tidx.gain.setTargetAtTime(0, e.t, 0.045);
        tg.gain.value = 0.35;
        tmod.connect(tidx);
        tidx.connect(tine.frequency);
        tine.connect(tg);
        tg.connect(vca);
        [car, mod, tine, tmod].forEach(function (osc) { osc.start(e.t); osc.stop(stop); });
        vca.connect(env.out);
      });
    };
  };

  /* Glocke / Vibraphon: wenige Teiltöne, die unterschiedlich schnell ausklingen. */
  INST.vibes = function (ctx, o, env) {
    var partials = o.partials || [[1, 1, 1], [4, 0.22, 0.35], [10, 0.07, 0.12]];
    return function (events) {
      events.forEach(function (e) {
        var f = MU.hz(e.m), decay = (o.decay || 1.3) * Math.pow(2, (66 - e.m) / 24), end = e.t + e.d;
        var hold = o.damp ? end : e.t + decay * 5;
        partials.forEach(function (p) {
          if (f * p[0] > 15000) return;
          var osc = ctx.createOscillator(), g = ctx.createGain();
          osc.frequency.value = f * p[0];
          g.gain.setValueAtTime(0, e.t);
          g.gain.linearRampToValueAtTime(0.28 * p[1] * (p[0] === 1 ? 0.5 + 0.5 * e.v : e.v * e.v), e.t + 0.003);
          g.gain.setTargetAtTime(0, e.t + 0.003, decay * p[2]);
          if (o.damp) g.gain.setTargetAtTime(0, hold, 0.08);
          osc.connect(g);
          g.connect(env.out);
          osc.start(e.t);
          osc.stop(hold + 0.7);
        });
      });
    };
  };

  /* Zupfer: Filter schnappt zu, kurzer Ton – für Arpeggien mit Echo. */
  INST.pluck = function (ctx, o, env) {
    return function (events) {
      events.forEach(function (e) {
        var f = MU.hz(e.m), decay = o.decay || 0.22, end = e.t + Math.max(e.d, 0.05);
        var filt = ctx.createBiquadFilter(), vca = ctx.createGain();
        var top = (o.cutoff || 2600) * (0.5 + 0.8 * e.v) * Math.pow(2, (e.m - 60) / 24);
        filt.type = 'lowpass';
        filt.Q.value = o.q || 2.2;
        filt.frequency.setValueAtTime(top, e.t);
        filt.frequency.setTargetAtTime(Math.max(180, f * 1.2), e.t, o.snap || 0.07);
        vca.gain.setValueAtTime(0, e.t);
        vca.gain.linearRampToValueAtTime(0.22 * e.v, e.t + 0.003);
        vca.gain.setTargetAtTime(0, e.t + 0.003, decay);
        vca.gain.setTargetAtTime(0, end, 0.04);
        var stop = Math.max(end + 0.4, e.t + 0.3);
        [[o.wave || 'sawtooth', -5, 0.6], ['square', 5, o.square == null ? 0.35 : o.square]].forEach(function (w) {
          var osc = ctx.createOscillator(), g = ctx.createGain();
          osc.type = w[0];
          osc.frequency.value = f;
          osc.detune.value = w[1];
          g.gain.value = w[2];
          osc.connect(g);
          g.connect(filt);
          osc.start(e.t);
          osc.stop(stop);
        });
        filt.connect(vca);
        vca.connect(env.out);
      });
    };
  };

  /* Bass: Sinus mit etwas Sägezahn, rund und kurz angezupft. */
  INST.bass = function (ctx, o, env) {
    return function (events) {
      events.forEach(function (e) {
        var f = MU.hz(e.m), end = e.t + e.d, rel = o.release || 0.07;
        var filt = ctx.createBiquadFilter(), vca = ctx.createGain();
        filt.type = 'lowpass';
        filt.Q.value = 1.1;
        filt.frequency.setValueAtTime((o.cutoff || 520) * (0.6 + 0.9 * e.v), e.t);
        filt.frequency.setTargetAtTime(o.floor || 190, e.t, o.snap || 0.16);
        vca.gain.setValueAtTime(0, e.t);
        vca.gain.linearRampToValueAtTime(0.5 * (0.5 + 0.5 * e.v), e.t + 0.006);
        vca.gain.setTargetAtTime(0.5 * (0.5 + 0.5 * e.v) * (o.sustain == null ? 0.7 : o.sustain), e.t + 0.006, 0.25);
        vca.gain.setTargetAtTime(0, end, rel);
        var sine = ctx.createOscillator(), saw = ctx.createOscillator(), sg = ctx.createGain(), wg = ctx.createGain();
        sine.frequency.value = f;
        saw.type = o.wave || 'sawtooth';
        saw.frequency.value = f;
        sg.gain.value = 1;
        wg.gain.value = o.grit == null ? 0.4 : o.grit;
        if (o.slide && e.slideFrom) {
          var from = MU.hz(e.slideFrom);
          sine.frequency.setValueAtTime(from, e.t);
          sine.frequency.exponentialRampToValueAtTime(f, e.t + o.slide);
          saw.frequency.setValueAtTime(from, e.t);
          saw.frequency.exponentialRampToValueAtTime(f, e.t + o.slide);
        }
        sine.connect(sg);
        saw.connect(wg);
        wg.connect(filt);
        filt.connect(vca);
        sg.connect(vca);
        vca.connect(env.out);
        [sine, saw].forEach(function (osc) { osc.start(e.t); osc.stop(end + rel * 8); });
      });
    };
  };

  /* Einstimmige Melodiestimme: gleitet zwischen gebundenen Tönen, Vibrato setzt verzögert ein. */
  INST.lead = function (ctx, o, env) {
    var waves = o.waves || [['triangle', 0, 0.8], ['sawtooth', 7, 0.3]];
    var oscs = waves.map(function (w) {
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = w[0];
      osc.detune.value = w[1];
      g.gain.value = w[2];
      osc.connect(g);
      return { osc: osc, gain: g, ratio: w[3] || 1 };
    });
    var filt = ctx.createBiquadFilter(), vca = ctx.createGain();
    filt.type = 'lowpass';
    filt.Q.value = o.q || 1.4;
    vca.gain.value = 0;
    var vib = env.lfo(o.vibRate || 5.3, 0), vibAmt = ctx.createGain();
    vibAmt.gain.value = 0;
    vib.connect(vibAmt);
    oscs.forEach(function (x) { x.gain.connect(filt); vibAmt.connect(x.osc.detune); x.osc.start(0); });
    filt.connect(vca);
    vca.connect(env.out);
    var glide = o.glide == null ? 0.035 : o.glide, depth = o.vibCents == null ? 14 : o.vibCents;
    var attack = o.attack || 0.014, release = o.release || 0.09, cutoff = o.cutoff || 1900;
    return function (events) {
      var prevEnd = -1;
      events.forEach(function (e, i) {
        var prev = events[i - 1], next = events[i + 1];
        // gleicher Ton noch einmal: neu anschlagen statt binden, sonst verschmelzen Tonwiederholungen
        var legato = e.t <= prevEnd + 0.03 && prev.m !== e.m;
        var again = next && next.m === e.m && next.t <= e.t + e.d + 0.03;
        var f = MU.hz(e.m), end = again ? Math.max(e.t + 0.05, next.t - 0.06) : e.t + e.d;
        var tied = next && !again && next.t <= end + 0.03;
        oscs.forEach(function (x) {
          if (legato && glide > 0) x.osc.frequency.setTargetAtTime(f * x.ratio, e.t, glide);
          else x.osc.frequency.setValueAtTime(f * x.ratio, e.t);
        });
        var cut = cutoff * Math.pow(2, (e.m - 67) / 12 * 0.5);
        var level = 0.3 * (0.45 + 0.55 * e.v);
        if (!legato) {
          filt.frequency.setValueAtTime(cut * (1.3 + 1.2 * e.v), e.t);
          filt.frequency.setTargetAtTime(cut, e.t, 0.18);
        } else {
          filt.frequency.setTargetAtTime(cut * (1 + 0.5 * e.v), e.t, 0.02);
          filt.frequency.setTargetAtTime(cut, e.t + 0.06, 0.15);
        }
        vca.gain.setTargetAtTime(level, e.t, legato ? 0.03 : attack);
        if (!tied) vca.gain.setTargetAtTime(0, end, again ? 0.018 : release);
        vibAmt.gain.setTargetAtTime(0, e.t, 0.02);
        if (e.d > 0.38) vibAmt.gain.setTargetAtTime(depth, e.t + (o.vibDelay || 0.24), 0.2);
        prevEnd = again ? -1 : end;
      });
    };
  };

  /* Schlagzeug: alles gerechnet, weich und trocken wie eine alte Rhythmusmaschine. */
  INST.drums = function (ctx, o, env) {
    function burst(t, dur, type, freq, q, vol, attack, slideTo) {
      var src = ctx.createBufferSource(), filt = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = env.noise;
      src.loop = true;
      filt.type = type;
      filt.frequency.setValueAtTime(freq, t);
      if (slideTo) filt.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      filt.Q.value = q;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + (attack || 0.001));
      g.gain.setTargetAtTime(0, t + (attack || 0.001), dur / 4);
      src.connect(filt);
      filt.connect(g);
      g.connect(env.out);
      src.start(t, env.rand() * 1.5);
      src.stop(t + dur * 2.2 + 0.05);
      return g;
    }
    function thump(t, from, to, sweep, dur, vol, type) {
      var osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + sweep);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.002);
      g.gain.setTargetAtTime(0, t + 0.002, dur / 4);
      osc.connect(g);
      g.connect(env.out);
      osc.start(t);
      osc.stop(t + dur * 2.2 + 0.05);
    }
    var kit = {
      k: function (t, v) { thump(t, 118, 46, 0.085, 0.42, 0.95 * v); burst(t, 0.012, 'lowpass', 1800, 0.5, 0.25 * v); },
      s: function (t, v) { burst(t, 0.2, 'bandpass', 1900, 0.7, 0.5 * v); burst(t, 0.12, 'highpass', 4500, 0.5, 0.16 * v); thump(t, 205, 165, 0.05, 0.13, 0.32 * v, 'triangle'); },
      r: function (t, v) { burst(t, 0.03, 'bandpass', 1750, 5, 0.9 * v); thump(t, 830, 800, 0.01, 0.035, 0.22 * v, 'triangle'); },
      h: function (t, v) { burst(t, 0.045, 'highpass', 7800, 0.8, 0.3 * v); },
      o: function (t, v) { burst(t, 0.3, 'highpass', 7200, 0.8, 0.26 * v); },
      sh: function (t, v) { burst(t, 0.07, 'bandpass', 6200, 1.3, 0.3 * v, 0.018); },
      c: function (t, v) { for (var i = 0; i < 3; i++) burst(t + i * 0.011, 0.02, 'bandpass', 1250, 1.6, 0.4 * v); burst(t + 0.03, 0.16, 'bandpass', 1250, 1.2, 0.42 * v); },
      ch: function (t, v) { thump(t, 345, 318, 0.03, 0.2, 0.5 * v); burst(t, 0.01, 'bandpass', 2600, 2, 0.14 * v); },
      cl: function (t, v) { thump(t, 228, 208, 0.03, 0.28, 0.55 * v); burst(t, 0.01, 'bandpass', 1900, 2, 0.12 * v); },
      rd: function (t, v) { burst(t, 0.9, 'bandpass', 5200, 0.9, 0.12 * v); burst(t, 0.03, 'highpass', 9000, 0.7, 0.14 * v); },
      sw: function (t, v, d) { // anschwellendes Becken, endet auf dem nächsten Schlag
        var src = ctx.createBufferSource(), filt = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = env.noise;
        src.loop = true;
        filt.type = 'highpass';
        filt.frequency.setValueAtTime(9000, t);
        filt.frequency.exponentialRampToValueAtTime(3800, t + d);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.2 * v, t + d);
        g.gain.setTargetAtTime(0, t + d, 0.05);
        src.connect(filt);
        filt.connect(g);
        g.connect(env.out);
        src.start(t);
        src.stop(t + d + 0.5);
      }
    };
    var levels = o.levels || {};
    return function (events) {
      events.forEach(function (e) { if (kit[e.n]) kit[e.n](e.t, e.v * (levels[e.n] == null ? 1 : levels[e.n]), e.d); });
    };
  };

  MU.instruments = INST;

  /* ------------------------------------------------------------------ Rechnen
     Ein Stück hat viele tausend Klangbausteine; alle auf einmal wären sehr langsam. Darum wird in Fenstern
     von wenigen Takten gerechnet (mit Ausklang) und die Ergebnisse werden übereinandergelegt. Was über das
     Schleifenende hinaus klingt, läuft in den Anfang hinein – so ist die Naht von selbst sauber.
     Einstimmige Stimmen (lead) laufen am Stück, weil sie zwischen den Tönen gleiten. Zum Schluss geht die
     Summe durch Bandleiern, Sättigung und Kompressor. */

  MU.render = function (score, opts) {
    opts = opts || {};
    var sr = opts.sampleRate || 44100, spb = 60 / score.bpm, bpb = score.beatsPerBar || 4;
    var beats = score.bars * bpb, loopSamples = Math.round(beats * spb * sr), L = loopSamples / sr;
    var swing = score.swing || 0.5, seed = score.seed || 7, fx = score.fx || {}, m = score.master || {};
    var windowBars = opts.windowBars || 2, TAIL = 9;

    function time(beat) { // Schläge → Sekunden; jedes zweite Sechzehntel kommt beim Swing etwas später
      var x = beat * 2, whole = Math.floor(x), frac = x - whole;
      var warped = frac < 0.5 ? frac * 2 * swing : swing + (frac - 0.5) * 2 * (1 - swing);
      return (whole + warped) / 2 * spb;
    }

    var tracks = score.tracks.filter(function (tr) {
      return !(opts.only && opts.only.indexOf(tr.name) < 0) && !(opts.mute && opts.mute.indexOf(tr.name) >= 0);
    });
    /* Noten einmal in Sekunden umrechnen, samt kleiner Ungenauigkeiten – in jedem Fenster dieselben. */
    var timed = {};
    score.tracks.forEach(function (tr, index) {
      var jitter = MU.rng(seed * 131 + index * 977 + 5), human = tr.human || 0;
      timed[tr.name] = tr.notes.slice().sort(function (a, b) { return a.t - b.t; }).map(function (n) {
        return {
          beat: n.t,
          t: time(n.t) + (human ? (jitter() - 0.5) * 2 * human : 0),
          d: Math.max(0.02, time(n.t + n.d) - time(n.t)),
          m: typeof n.n === 'number' ? n.n : 0, n: n.n,
          v: Math.max(0.05, Math.min(1, n.v * (1 + (jitter() - 0.5) * (tr.velHuman || 0))))
        };
      });
    });
    var kicks = [];
    score.tracks.forEach(function (tr) {
      if (tr.inst === 'drums') tr.notes.forEach(function (n) { if (n.n === 'k') kicks.push(time(n.t)); });
    });

    /* Rechnet einen Ausschnitt: die genannten Spuren, Noten mit Beginn in [fromBeat, toBeat). */
    function chunk(list, fromBeat, toBeat, passes) {
      var startSample = Math.round(time(fromBeat) * sr), origin = startSample / sr;
      var span = time(toBeat) - origin;
      var frames = passes > 1 ? loopSamples * passes : Math.ceil((span + TAIL) * sr);
      var ctx = new OfflineAudioContext(2, frames, sr), rand = MU.rng(seed);
      function lfo(rate, phase) { // Rate auf ganze Perioden je Schleife gerundet, damit die Naht stimmt
        var osc = ctx.createOscillator(), f = Math.max(1, Math.round(rate * L)) / L;
        osc.setPeriodicWave(sineWave(ctx, (phase || 0) + 2 * Math.PI * f * origin));
        osc.frequency.value = f;
        osc.start(0);
        return osc;
      }
      var noise = ctx.createBuffer(1, sr * 2, sr), nd = noise.getChannelData(0);
      for (var i = 0; i < nd.length; i++) nd[i] = rand() * 2 - 1;
      var mix = ctx.createGain();
      mix.connect(ctx.destination);

      /* Hall und Echo als gemeinsame Effektwege. */
      var revIn = ctx.createGain(), revHp = ctx.createBiquadFilter(), conv = ctx.createConvolver(), revOut = ctx.createGain();
      revHp.type = 'highpass';
      revHp.frequency.value = 260;
      conv.normalize = false;
      conv.buffer = impulse(ctx, fx.reverbSeconds || 3.2, MU.rng(seed + 99), { rt: fx.reverbTime || 2.6, pre: 0.022 });
      revOut.gain.value = MU.db(fx.reverbGain == null ? 0 : fx.reverbGain);
      revIn.connect(revHp); revHp.connect(conv); conv.connect(revOut); revOut.connect(mix);

      var delIn = ctx.createGain(), dl = ctx.createDelay(2), dr = ctx.createDelay(2), fb = ctx.createGain();
      var dlp = ctx.createBiquadFilter(), dhp = ctx.createBiquadFilter(), pl = ctx.createStereoPanner(), pr = ctx.createStereoPanner();
      var delayBeats = fx.delayBeats || 0.75;
      dl.delayTime.value = delayBeats * spb;
      dr.delayTime.value = delayBeats * spb;
      fb.gain.value = fx.delayFeedback == null ? 0.42 : fx.delayFeedback;
      dlp.type = 'lowpass'; dlp.frequency.value = fx.delayTone || 2600;
      dhp.type = 'highpass'; dhp.frequency.value = 320;
      pl.pan.value = -0.75; pr.pan.value = 0.75;
      delIn.connect(dhp); dhp.connect(dlp); dlp.connect(dl);
      dl.connect(pl); pl.connect(mix);
      dl.connect(dr); dr.connect(pr); pr.connect(mix);
      dr.connect(fb); fb.connect(dlp);
      var delRev = ctx.createGain();
      delRev.gain.value = 0.25;
      dl.connect(delRev); dr.connect(delRev); delRev.connect(revIn);

      list.forEach(function (tr) {
        var bus = ctx.createGain(), tail = bus, f = tr.fx || {};
        function chain(node) { tail.connect(node); tail = node; }
        if (f.hp) { var h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = f.hp; chain(h); }
        if (f.lp) { var l = ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = f.lp; l.Q.value = 0.5; chain(l); }
        if (f.drive) { var ws = ctx.createWaveShaper(); ws.curve = shaperCurve(f.drive); ws.oversample = '2x'; chain(ws); }
        if (f.phaser) {
          var phIn = tail, phOut = ctx.createGain(), wet = ctx.createGain(), stage = phIn;
          var pLfo = lfo(f.phaser.rate || 0.11, 1), pAmt = ctx.createGain();
          pAmt.gain.value = f.phaser.cents || 1400;
          pLfo.connect(pAmt);
          for (var s = 0; s < 4; s++) {
            var ap = ctx.createBiquadFilter();
            ap.type = 'allpass';
            ap.frequency.value = (f.phaser.freq || 700) * (1 + s * 0.55);
            ap.Q.value = 0.6;
            pAmt.connect(ap.detune);
            stage.connect(ap);
            stage = ap;
          }
          wet.gain.value = f.phaser.mix == null ? 0.6 : f.phaser.mix;
          stage.connect(wet); wet.connect(phOut); phIn.connect(phOut);
          phOut.gain.value = 0.75;
          tail = phOut;
        }
        if (f.chorus) {
          var cIn = tail, cOut = ctx.createGain();
          cIn.connect(cOut);
          [-1, 1].forEach(function (side, n) {
            var d = ctx.createDelay(0.1), p = ctx.createStereoPanner(), g = ctx.createGain();
            var cl = lfo((f.chorus.rate || 0.55) * (n ? 1.31 : 1), n * 2.1), ca = ctx.createGain();
            d.delayTime.value = (f.chorus.base || 0.014) + n * 0.004;
            ca.gain.value = f.chorus.depth || 0.0028;
            cl.connect(ca); ca.connect(d.delayTime);
            p.pan.value = side * 0.85;
            g.gain.value = f.chorus.mix == null ? 0.55 : f.chorus.mix;
            cIn.connect(d); d.connect(g); g.connect(p); p.connect(cOut);
          });
          cOut.gain.value = 0.8;
          tail = cOut;
        }
        if (f.autopan) {
          var ap2 = ctx.createStereoPanner(), al = lfo(f.autopan.rate || 4.6, 0.5), aa = ctx.createGain();
          aa.gain.value = f.autopan.depth == null ? 0.4 : f.autopan.depth;
          al.connect(aa); aa.connect(ap2.pan);
          chain(ap2);
        }
        if (f.tremolo) {
          var tg = ctx.createGain(), tl = lfo(f.tremolo.rate || 5.2, 0), ta = ctx.createGain();
          tg.gain.value = 1 - (f.tremolo.depth || 0.25) / 2;
          ta.gain.value = (f.tremolo.depth || 0.25) / 2;
          tl.connect(ta); ta.connect(tg.gain);
          chain(tg);
        }
        var duck = ctx.createGain(), level = ctx.createGain(), pan = ctx.createStereoPanner();
        level.gain.value = MU.db(tr.gain || 0);
        pan.pan.value = tr.pan || 0;
        chain(duck); chain(level); chain(pan);
        pan.connect(mix);
        if (tr.reverb != null) { var rs = ctx.createGain(); rs.gain.value = MU.db(tr.reverb); pan.connect(rs); rs.connect(revIn); }
        if (tr.delay != null) { var ds = ctx.createGain(); ds.gain.value = MU.db(tr.delay); pan.connect(ds); ds.connect(delIn); }

        var events = [];
        for (var p = 0; p < passes; p++) {
          timed[tr.name].forEach(function (n) {
            if (n.beat < fromBeat || n.beat >= toBeat) return;
            events.push({ t: Math.max(0, n.t - origin + p * L), d: n.d, m: n.m, n: n.n, v: n.v });
          });
        }
        events.sort(function (a, b) { return a.t - b.t; });
        if (tr.duck) {
          var end = frames / sr, hits = [];
          for (var q = -1; q <= passes; q++) kicks.forEach(function (k) {
            var kt = k - origin + q * L;
            if (kt > 0.01 && kt < end) hits.push(kt);
          });
          hits.sort(function (a, b) { return a - b; }).forEach(function (kt) {
            duck.gain.setTargetAtTime(1 - tr.duck, kt, 0.008);
            duck.gain.setTargetAtTime(1, kt + 0.06, 0.11);
          });
        }
        var make = INST[tr.inst];
        if (!make) throw new Error('Unbekanntes Instrument: ' + tr.inst);
        make(ctx, tr.opts || {}, { out: bus, noise: noise, rand: rand, lfo: lfo, L: L })(events);
      });

      return ctx.startRendering().then(function (buf) {
        return { buf: buf, startSample: passes > 1 ? 0 : startSample, skip: passes > 1 ? loopSamples * (passes - 1) : 0 };
      });
    }

    var sumL = new Float32Array(loopSamples), sumR = new Float32Array(loopSamples);
    function addIn(res) {
      var l = res.buf.getChannelData(0), r = res.buf.getChannelData(1);
      var count = res.skip ? loopSamples : l.length;
      for (var i = 0; i < count; i++) {
        var at = (res.startSample + i) % loopSamples;
        sumL[at] += l[res.skip + i];
        sumR[at] += r[res.skip + i];
      }
    }

    var jobs = [];
    var mono = tracks.filter(function (tr) { return tr.inst === 'lead'; });
    var poly = tracks.filter(function (tr) { return tr.inst !== 'lead'; });
    mono.forEach(function (tr) { jobs.push(function () { return chunk([tr], 0, beats, 2); }); });
    if (poly.length) {
      for (var w = 0; w < score.bars; w += windowBars) (function (w) {
        jobs.push(function () { return chunk(poly, w * bpb, Math.min(score.bars, w + windowBars) * bpb, 1); });
      })(w);
    }
    var next = 0, workers = [];
    function work() {
      if (next >= jobs.length) return Promise.resolve();
      return jobs[next++]().then(addIn).then(work);
    }
    for (var c = 0; c < (opts.parallel || 6); c++) workers.push(work());

    return Promise.all(workers).then(function () {
      if (opts.dry) return { sampleRate: sr, seconds: L, left: sumL, right: sumR };
      /* Summe: zweimal hintereinander durch die Kette, der zweite Durchlauf ist eingeschwungen. */
      var ctx = new OfflineAudioContext(2, loopSamples * 2, sr);
      var buf = ctx.createBuffer(2, loopSamples, sr);
      buf.copyToChannel(sumL, 0);
      buf.copyToChannel(sumR, 1);
      var src = ctx.createBufferSource(), wow = ctx.createDelay(0.05), hp = ctx.createBiquadFilter(), sat = ctx.createWaveShaper();
      var shelf = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor(), outGain = ctx.createGain();
      src.buffer = buf;
      src.loop = true;
      wow.delayTime.value = 0.008;
      [[m.wowRate || 0.37, m.wowCents == null ? 4 : m.wowCents, 0], [m.flutterRate || 6.1, m.flutterCents == null ? 0.8 : m.flutterCents, 1.3]].forEach(function (w) {
        var osc = ctx.createOscillator(), g = ctx.createGain(), f = Math.max(1, Math.round(w[0] * L)) / L;
        osc.setPeriodicWave(sineWave(ctx, w[2]));
        osc.frequency.value = f;
        // Verstimmung in Cent → Hub der Verzögerung: Δ = Cent·ln2/1200 / (2π·f)
        g.gain.value = w[1] * Math.LN2 / 1200 / (2 * Math.PI * f);
        osc.connect(g);
        g.connect(wow.delayTime);
        osc.start(0);
      });
      hp.type = 'highpass';
      hp.frequency.value = 30;
      sat.curve = shaperCurve(m.drive || 1.2);
      sat.oversample = '4x';
      shelf.type = 'highshelf';
      shelf.frequency.value = 8000;
      shelf.gain.value = m.air == null ? -1.5 : m.air;
      comp.threshold.value = m.threshold == null ? -18 : m.threshold;
      comp.ratio.value = m.ratio || 2.2;
      comp.knee.value = 14;
      comp.attack.value = 0.03;
      comp.release.value = 0.28;
      outGain.gain.value = MU.db(m.gain == null ? -6 : m.gain);
      src.connect(wow); wow.connect(hp); hp.connect(sat); sat.connect(shelf); shelf.connect(comp); comp.connect(outGain); outGain.connect(ctx.destination);
      src.start(0);
      return ctx.startRendering().then(function (out) {
        return {
          sampleRate: sr, seconds: L,
          left: out.getChannelData(0).slice(loopSamples),
          right: out.getChannelData(1).slice(loopSamples)
        };
      });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
