/* Zündung – Titelschriftzug: Buchstaben aus groben Pixeln, die ein Streichholz entzündet
   und aus denen danach Pixel-Feuer schlägt. Alles auf einem Canvas mit Zellen von 5 CSS-Pixeln. */
(function (ZU) {
  'use strict';
  var h = ZU.h;

  var CELL = 5;                 // CSS-Pixel je Zelle
  var BLOCK = 3;                // Zellen je Buchstabenpixel
  var PAD_X = 14, PAD_TOP = 42, PAD_BOTTOM = 8;
  var LEVELS = 36;

  /* Dieselben Glyphen wie im Pixel-Font (web/tools/make_font.py), 6 breit; das Ü hat zwei Zeilen Punkte darüber. */
  var GLYPHS = {
    Z: ['......', '......', '######', '....##', '...##.', '..##..', '.##...', '##....', '######'],
    'Ü': ['##..##', '......', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
    N: ['......', '......', '##..##', '###.##', '###.##', '######', '##.###', '##.###', '##..##'],
    D: ['......', '......', '####..', '##.##.', '##..##', '##..##', '##..##', '##.##.', '####..'],
    U: ['......', '......', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
    G: ['......', '......', '.####.', '##..##', '##....', '##.###', '##..##', '##..##', '.####.']
  };
  var ROWS = 9;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function ramp(stops, t) {
    for (var i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        var a = stops[i - 1], b = stops[i], k = (t - a[0]) / (b[0] - a[0] || 1);
        return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k), lerp(a[4] == null ? 255 : a[4], b[4] == null ? 255 : b[4], k)];
      }
    }
    var last = stops[stops.length - 1];
    return [last[1], last[2], last[3], last[4] == null ? 255 : last[4]];
  }

  /* Farben des Feuers je Hitzestufe: durchsichtig → dunkelrot → orange → gelb → fast weiß. */
  var FIRE = [];
  (function () {
    var stops = [[0, 0, 0, 0, 0], [3, 70, 8, 4, 110], [9, 170, 28, 8, 225], [17, 236, 88, 16, 255], [25, 255, 160, 40, 255], [31, 255, 222, 112, 255], [36, 255, 250, 222, 255]];
    for (var i = 0; i <= LEVELS; i++) FIRE.push(ramp(stops, i));
  })();
  /* Buchstaben: kalt wie Holzkohle, heiß mit Verlauf von Hellgelb (oben) nach Glutrot (unten). */
  var HOT = [[0, 255, 246, 190], [0.3, 255, 214, 84], [0.6, 255, 150, 38], [0.85, 236, 92, 24], [1, 196, 48, 24]];
  var COLD = [[0, 86, 74, 66], [1, 44, 36, 32]];

  /* Baut das Logo. ignite(instant) entzündet es; destroy() räumt auf. */
  ZU.titleLogo = function (word) {
    var letters = word.split('');
    var cols = letters.length * 7 - 1;
    var W = cols * BLOCK + PAD_X * 2, H = PAD_TOP + ROWS * BLOCK + PAD_BOTTOM;
    var canvas = h('canvas', 'tl-canvas', null, { width: W, height: H });
    canvas.style.width = (W * CELL) + 'px';
    canvas.style.height = (H * CELL) + 'px';
    var match = h('div', 'tl-match', [ZU.iconEl('match', 'tl-stick'), ZU.iconEl('flame', 'tl-flame')]);
    var el = h('div', 'tlogo', [h('div', 'tl-glow'), canvas, match]);
    el.style.width = (W * CELL) + 'px';
    el.style.height = (H * CELL) + 'px';
    var ctx = canvas.getContext('2d');
    var image = ctx.createImageData(W, H), data = image.data;

    /* Masken: welche Zelle gehört zu welchem Buchstaben, wo liegen Kontur und Schatten. */
    var face = new Int8Array(W * H).fill(-1);   // Buchstabenindex oder -1
    var rowOf = new Uint8Array(W * H);           // Glyphenzeile (für den Verlauf)
    var bevel = new Int8Array(W * H);            // +1 Lichtkante, -1 Schattenkante
    var shadow = new Int8Array(W * H).fill(-1);
    var outline = new Int8Array(W * H).fill(-1);
    function solid(letter, gx, gy) {
      var glyph = GLYPHS[letters[letter]];
      return gy >= 0 && gy < ROWS && gx >= 0 && gx < 6 && glyph[gy][gx] === '#';
    }
    letters.forEach(function (ch, letter) {
      for (var gy = 0; gy < ROWS; gy++) {
        for (var gx = 0; gx < 6; gx++) {
          if (!solid(letter, gx, gy)) continue;
          for (var by = 0; by < BLOCK; by++) {
            for (var bx = 0; bx < BLOCK; bx++) {
              var x = PAD_X + (letter * 7 + gx) * BLOCK + bx, y = PAD_TOP + gy * BLOCK + by, i = y * W + x;
              face[i] = letter;
              rowOf[i] = gy;
              if ((by === 0 && !solid(letter, gx, gy - 1)) || (bx === 0 && !solid(letter, gx - 1, gy))) bevel[i] = 1;
              else if ((by === BLOCK - 1 && !solid(letter, gx, gy + 1)) || (bx === BLOCK - 1 && !solid(letter, gx + 1, gy))) bevel[i] = -1;
            }
          }
        }
      }
    });
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = y * W + x;
        if (face[i] >= 0) continue;
        // Schatten: die Buchstaben, drei Zellen nach unten und eine nach rechts versetzt
        for (var d = 1; d <= 3 && shadow[i] < 0; d++) {
          var sx = x - (d > 1 ? 1 : 0), sy = y - d;
          if (sx >= 0 && sy >= 0 && face[sy * W + sx] >= 0) shadow[i] = face[sy * W + sx];
        }
        // Kontur: eine Zelle rund um jeden Buchstaben
        for (var oy = -1; oy <= 1 && outline[i] < 0; oy++) {
          for (var ox = -1; ox <= 1; ox++) {
            var nx = x + ox, ny = y + oy;
            if (nx >= 0 && nx < W && ny >= 0 && ny < H && face[ny * W + nx] >= 0) { outline[i] = face[ny * W + nx]; break; }
          }
        }
      }
    }

    /* Feuerquellen: nur die Oberkante jedes Buchstabens (die oberste Zelle je Spalte). */
    var sources = [];
    for (var sx0 = 0; sx0 < W; sx0++) {
      for (var sy0 = 0; sy0 < H; sy0++) {
        if (face[sy0 * W + sx0] >= 0) { sources.push(sy0 * W + sx0); break; }
      }
    }

    var heat = new Uint8Array(W * H);
    var lit = letters.map(function () { return 0; });       // 0 kalt … 1 brennt
    var target = letters.map(function () { return 0; });
    var flare = 0, wind = 0, acc = 0, timers = [], alive = true;

    function step() {
      var cool = Math.max(4.4, 6.6 - flare * 1.8);   // je kleiner, desto höher die Flammen
      wind = Math.sin(ZU.time * 0.7) * 0.6 + Math.sin(ZU.time * 2.3) * 0.3;
      for (var y = 1; y < H; y++) {
        for (var x = 0; x < W; x++) {
          var v = heat[y * W + x];
          var dx = x + ((Math.random() * 3) | 0) - 1 + (Math.random() < Math.abs(wind) * 0.25 ? (wind > 0 ? 1 : -1) : 0);
          if (dx < 0 || dx >= W) continue;
          var nv = v - ((Math.random() * cool) | 0);
          heat[(y - 1) * W + dx] = nv > 0 ? nv : 0;
        }
      }
      for (var i = 0; i < W * H; i++) if (face[i] >= 0) heat[i] = 0;
      for (var s = 0; s < sources.length; s++) {
        var cell = sources[s], level = lit[face[cell]];
        if (level <= 0.05) continue;
        // Zungen statt Wand: die Stärke wandert langsam über die Breite
        var tongue = 0.55 + 0.45 * Math.sin((cell % W) * 0.42 + ZU.time * 2.4) * Math.sin((cell % W) * 0.13 - ZU.time * 1.1);
        heat[cell] = Math.round((13 + Math.random() * 15 + flare * 6) * tongue * level);
      }
    }

    function draw() {
      for (var i = 0; i < W * H; i++) {
        var o = i * 4, letter = face[i], c;
        if (letter >= 0) {
          var t = lit[letter], gy = rowOf[i] / (ROWS - 1);
          var hot = ramp(HOT, gy), cold = ramp(COLD, gy);
          var glow = 1 + (Math.random() < 0.025 ? 0.12 : 0);
          var edge = bevel[i] > 0 ? 1.22 : bevel[i] < 0 ? 0.72 : 1;
          data[o] = Math.min(255, lerp(cold[0], hot[0] * glow, t) * edge);
          data[o + 1] = Math.min(255, lerp(cold[1], hot[1] * glow, t) * edge);
          data[o + 2] = Math.min(255, lerp(cold[2], hot[2] * glow, t) * edge);
          data[o + 3] = 255;
          continue;
        }
        c = FIRE[heat[i]];
        var r = c[0], g = c[1], b = c[2], a = c[3];
        var under = outline[i] >= 0 ? outline[i] : shadow[i];
        if (under >= 0 && a < 200) {     // Kontur und Schatten, wo gerade keine Flamme davor ist
          var warm = lit[under];
          if (outline[i] >= 0) { r = lerp(14, 60, warm); g = lerp(10, 12, warm); b = lerp(8, 4, warm); }
          else { r = lerp(10, 110, warm); g = lerp(7, 24, warm); b = lerp(6, 8, warm); }
          a = 255;
        }
        data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = a;
      }
      ctx.putImageData(image, 0, 0);
    }

    var tick = ZU.onFrame(function (dt) {
      if (!alive) return;
      for (var i = 0; i < lit.length; i++) lit[i] += (target[i] - lit[i]) * Math.min(1, dt * 7);
      flare = Math.max(0, flare - dt * 0.9);
      acc = Math.min(acc + dt, 0.2);
      var steps = 0;
      while (acc >= 1 / 30 && steps++ < 4) { step(); acc -= 1 / 30; }
      draw();
      el.style.setProperty('--heat', (lit.reduce(function (a, b) { return a + b; }, 0) / lit.length).toFixed(2));
    });

    function later(ms, fn) { timers.push(setTimeout(function () { if (alive) fn(); }, ms)); }

    /* Mittelpunkt eines Buchstabens in Bühnenkoordinaten (für Funken). */
    function letterPos(letter) {
      return { x: el.offsetLeft + (PAD_X + (letter * 7 + 3) * BLOCK) * CELL, y: el.offsetTop + (PAD_TOP + 5 * BLOCK) * CELL };
    }

    el.ignite = function (instant) {
      timers.forEach(clearTimeout);
      timers = [];
      if (instant) {
        for (var i = 0; i < target.length; i++) target[i] = 1;
        flare = Math.max(flare, 0.3);
        match.className = 'tl-match';
        return;
      }
      var sweep = 900, start = 380;
      later(start - 60, function () { ZU.audio.match(); });
      later(start, function () { match.className = 'tl-match strike'; });
      letters.forEach(function (ch, letter) {
        later(start + (letter + 0.5) / letters.length * sweep, function () {
          target[letter] = 1;
          flare = 1;
          var p = letterPos(letter);
          ZU.fx.burst(p.x, p.y, { n: 12, speed: 320, cone: 1.1, grav: -220, life: 1.1 });
          if (letter === 0) ZU.audio.ignite();
        });
      });
      later(start + sweep + 80, function () {
        flare = 1;
        ZU.fx.shake(5);
        ZU.audio.whoosh();
        el.classList.add('ablaze');
        if (el.onAblaze) el.onAblaze();
      });
      later(start + sweep + 900, function () { match.className = 'tl-match'; });
    };
    /* Anfachen, z. B. wenn die Maus über das Logo fährt. */
    el.fan = function (amount) { flare = Math.max(flare, amount); };
    el.isAblaze = function () { return target[target.length - 1] === 1; };
    el.destroy = function () {
      alive = false;
      timers.forEach(clearTimeout);
      ZU.offFrame(tick);
    };
    el.addEventListener('pointermove', function () { if (el.isAblaze()) el.fan(0.35); });
    return el;
  };
})(window.ZU = window.ZU || {});
