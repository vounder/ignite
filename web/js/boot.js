/* Zündung – Vorspann und Laden: das Studio-Logo vor dem Titel und der Ladebildschirm für langsame
   Geräte und Verbindungen. Geladen wird gestaffelt: erst, was der Titel braucht (während des Vorspanns),
   dann im Hintergrund alles Übrige. Wechselt das Spiel auf einen Bildschirm, dessen Bilder noch fehlen,
   legt sich ein kurzer Schleier darüber; reicht der nicht, erscheint der Ladebalken. */
(function (ZU) {
  'use strict';
  var h = ZU.h;

  /* ---------- Ladebildschirm ---------- */
  var LINES = ['Karten werden gemischt …', 'Streichhölzer werden gezählt …', 'Manfred staubt die Regale ab …', 'Der Croupier poliert die Jetons …', 'Esme legt sich die Karten …', 'Die Gegner nehmen Platz …'];
  var veil = null, token = 0;

  /* Wartet auf Bilder. Dauert es länger als "grace" Millisekunden, erscheint der Ladebildschirm mit Balken.
     opts.cover: Schleier sofort zeigen (als Übergang) und mindestens opts.hold Millisekunden stehen lassen. */
  function wait(urls, opts) {
    opts = opts || {};
    var missing = urls.filter(function (url) { return !ZU.isLoaded(url); });
    if (!missing.length && !opts.cover) return Promise.resolve(false);
    var mine = ++token, started = performance.now(), shown = false;
    var bar = h('i', 'load-fill'), pct = h('span', 'load-pct', '0 %');
    var box = h('div', 'load-box', [
      h('div', 'load-match', [h('i', 'load-flame')]),
      h('div', 'load-line', LINES[Math.floor(Math.random() * LINES.length)]),
      h('div', 'load-bar', [bar]),
      pct
    ]);
    if (veil) veil.remove();
    veil = h('div', 'loadveil' + (opts.cover ? ' on' : ''), [box]);
    document.getElementById('stage').appendChild(veil);
    var el = veil;
    var grace = setTimeout(function () { el.classList.add('on', 'slow'); shown = true; }, opts.grace == null ? 450 : opts.grace);
    return ZU.whenLoaded(urls, function (have, total) {
      var part = total ? have / total : 1;
      bar.style.width = (part * 100).toFixed(0) + '%';
      pct.textContent = Math.round(part * 100) + ' %';
    }, opts.timeout).then(function () {
      var rest = Math.max(0, (opts.hold || 0) - (performance.now() - started));
      return new Promise(function (resolve) { setTimeout(resolve, rest); });
    }).then(function () {
      clearTimeout(grace);
      if (mine === token) veil = null;
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 260);
      return shown;
    });
  }

  /* ---------- Vorspann: Vounder Studios ---------- */
  /* Das „V" der Marke (wie auf vounder.net), als Pixelbild gerastert: Die Pixel fallen ein, das Zeichen
     blitzt einmal auf, dann tippt sich der Schriftzug. Ein Tipp oder Tastendruck überspringt. */
  var V_SHAPE = [[11, 14], [21, 14], [32, 42], [43, 14], [53, 14], [35, 53], [29, 53]];
  var V_NOTCH = [[28, 14], [32, 26], [36, 14]];
  function inside(poly, x, y) {
    var hit = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
    }
    return hit;
  }
  function splash() {
    return new Promise(function (resolve) {
      var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      var GRID = 26, CELL = 9, size = GRID * CELL;
      var canvas = h('canvas', 'vs-logo', null, { width: String(size), height: String(size) });
      var word = h('div', 'vs-word'), sub = h('div', 'vs-sub', 'präsentiert');
      var el = h('div', 'vsplash', [h('div', 'vs-box', [canvas, word, sub]), h('div', 'vs-skip', 'Tippen zum Überspringen')]);
      document.getElementById('stage').appendChild(el);
      var ctx = canvas.getContext('2d'), pixels = [], start = performance.now(), done = false, raf = 0;
      for (var gy = 0; gy < GRID; gy++) {
        for (var gx = 0; gx < GRID; gx++) {
          var x = 6 + (gx + 0.5) * 52 / GRID, y = 9 + (gy + 0.5) * 52 / GRID;
          if (!inside(V_SHAPE, x, y) && !inside(V_NOTCH, x, y)) continue;
          pixels.push({ gx: gx, gy: gy, delay: 80 + gx * 14 + Math.random() * 420, from: -(60 + Math.random() * 180), tone: Math.random() });
        }
      }
      var TEXT = 'VOUNDER STUDIOS', typed = 0;
      function frame(now) {
        var t = now - start;
        ctx.clearRect(0, 0, size, size);
        pixels.forEach(function (p) {
          var k = calm ? 1 : Math.max(0, Math.min(1, (t - p.delay) / 420));
          if (k <= 0) return;
          var ease = 1 - Math.pow(1 - k, 3), bounce = k >= 1 ? 0 : Math.sin(k * Math.PI) * 6;
          var py = Math.round((p.gy * CELL + p.from * (1 - ease) - bounce) / CELL) * CELL; // fällt im Raster, nicht stufenlos
          var flash = Math.max(0, 1 - Math.abs(t - 1150 - p.gx * 9) / 130); // Lichtkante läuft von links nach rechts
          var base = p.tone < 0.18 ? [255, 168, 232] : p.tone > 0.86 ? [226, 96, 190] : [255, 128, 220];
          ctx.fillStyle = 'rgb(' + base.map(function (c) { return Math.round(c + (255 - c) * flash); }).join(',') + ')';
          ctx.fillRect(p.gx * CELL, py, CELL, CELL);
          ctx.fillStyle = 'rgba(16,11,27,.28)';
          ctx.fillRect(p.gx * CELL, py + CELL - 2, CELL, 2);
        });
        var want = calm ? TEXT.length : Math.max(0, Math.min(TEXT.length, Math.floor((t - 1250) / 55)));
        if (want !== typed) {
          typed = want;
          word.textContent = TEXT.slice(0, typed);
          if (typed && !calm && ZU.audio && ZU.audio.tick) ZU.audio.tick();
        }
        el.classList.toggle('named', t > 2150 || calm);
        if (t > (calm ? 1400 : 3100)) return end();
        raf = requestAnimationFrame(frame);
      }
      function end() {
        if (done) return;
        done = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('pointerdown', skip, true);
        window.removeEventListener('keydown', skip, true);
        el.classList.add('out');
        setTimeout(function () { el.remove(); resolve(); }, 380);
      }
      function skip(ev) { if (performance.now() - start > 350) { ev.stopPropagation(); end(); } }
      window.addEventListener('pointerdown', skip, true);
      window.addEventListener('keydown', skip, true);
      raf = requestAnimationFrame(frame);
    });
  }

  ZU.boot = {
    wait: wait,
    splash: splash,
    /* Start des Spiels: Vorspann (einmal je Besuch) und währenddessen alles laden, was der Titel zeigt. */
    start: function (coreUrls) {
      var seen = false;
      try { seen = sessionStorage.getItem('zuendung.splash') === '1'; sessionStorage.setItem('zuendung.splash', '1'); } catch (e) { /* dann eben jedes Mal */ }
      ZU.preload(coreUrls, true);
      var intro = seen ? Promise.resolve() : splash();
      return intro.then(function () { return wait(coreUrls, { grace: 150, timeout: 15000 }); });
    }
  };
})(window.ZU = window.ZU || {});
