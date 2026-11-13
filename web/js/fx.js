/* Zündung – Darstellungs-Grundlagen: DOM-Helfer, Spielschleife, Partikel, Popups, Bildschirmwackeln, Tooltips. */
(function (ZU) {
  'use strict';

  ZU.W = 1280;
  ZU.H = 720;
  ZU.speed = 1;

  /* Kleiner DOM-Baukasten: h('div', 'klasse', kinder | text, {attribute}) */
  ZU.h = function (tag, cls, content, attrs) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (content != null) {
      if (Array.isArray(content)) content.forEach(function (c) { if (c) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
      else if (typeof content === 'string' || typeof content === 'number') el.textContent = content;
      else el.appendChild(content);
    }
    if (attrs) Object.keys(attrs).forEach(function (key) {
      if (key === 'html') el.innerHTML = attrs[key];
      else if (key === 'style') el.style.cssText = attrs[key];
      else if (key.indexOf('on') === 0) el.addEventListener(key.slice(2), attrs[key]);
      else el.setAttribute(key, attrs[key]);
    });
    return el;
  };

  ZU.wait = function (ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms / ZU.speed); });
  };
  ZU.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  ZU.rand = function (lo, hi) { return lo + Math.random() * (hi - lo); };
  ZU.fmt = function (n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };

  /* ---------- Bühne: feste 1280×720, in das Fenster skaliert ---------- */
  var stage, scale = 1, shake = 0, shakeX = 0, shakeY = 0, shakeR = 0;
  ZU.stageScale = function () { return scale; };
  function fit() {
    scale = Math.min(window.innerWidth / ZU.W, window.innerHeight / ZU.H);
    applyStage();
  }
  function applyStage() {
    if (!stage) return;
    stage.style.transform = 'translate(-50%, -50%) scale(' + (scale * (1 + zoom)).toFixed(5) + ') translate(' + shakeX.toFixed(2) + 'px,' + shakeY.toFixed(2) + 'px) rotate(' + shakeR.toFixed(3) + 'deg)';
  }
  /* Rechnet Fensterkoordinaten in Bühnenkoordinaten um. */
  ZU.toStage = function (clientX, clientY) {
    var r = stage.getBoundingClientRect();
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  };
  ZU.stagePos = function (el) {
    var r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - s.left) / scale, y: (r.top + r.height / 2 - s.top) / scale, w: r.width / scale, h: r.height / scale };
  };

  /* ---------- Schleife ---------- */
  var updaters = [], last = 0, freeze = 0, zoom = 0;
  ZU.time = 0;
  ZU.onFrame = function (fn) { updaters.push(fn); return fn; };
  ZU.offFrame = function (fn) { var i = updaters.indexOf(fn); if (i >= 0) updaters.splice(i, 1); };
  function frame(now) {
    var dt = Math.min(0.5, (now - last) / 1000 || 0.016);
    last = now;
    // Hit-Stop: Für einen Wimpernschlag steht alles Bewegte still; das gibt großen Treffern Gewicht.
    if (freeze > 0) { freeze -= dt; dt = 0; }
    ZU.time += dt;
    for (var i = updaters.length - 1; i >= 0; i--) updaters[i](dt, ZU.time);
    var moved = false;
    if (shake > 0.05) {
      shake *= Math.pow(0.0015, dt);
      shakeX = (Math.random() - 0.5) * shake * 2;
      shakeY = (Math.random() - 0.5) * shake * 2;
      shakeR = (Math.random() - 0.5) * shake * 0.08;
      moved = true;
    } else if (shake !== 0) {
      shake = 0; shakeX = shakeY = shakeR = 0;
      moved = true;
    }
    if (zoom > 0.0005) { zoom *= Math.pow(0.0004, dt); moved = true; }
    else if (zoom !== 0) { zoom = 0; moved = true; }
    if (moved) applyStage();
    drawParticles(dt);
    requestAnimationFrame(frame);
  }

  /* ---------- Partikel ----------
     Glutfunken sind harte Pixel mit einem weichen Lichthof. Innerhalb der Zeichenfläche addieren sie sich
     ("lighter"): Wo viele Funken zusammenkommen, wird es weißglühend. Rauch bleibt deckend. */
  var particles = [], comets = [], flashes = [], ctx;
  var EMBER = ['#fff3c4', '#ffd75e', '#f9a03f', '#f08a24', '#c8402f'];
  var halos = {};
  function halo(color) {
    if (halos[color]) return halos[color];
    var c = document.createElement('canvas');
    c.width = c.height = 32;
    var g = c.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    var hex = /^#[0-9a-f]{6}$/i.test(color);
    grad.addColorStop(0, hex ? color + 'cc' : color);
    grad.addColorStop(0.3, hex ? color + '55' : color);
    grad.addColorStop(1, hex ? color + '00' : 'transparent');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return (halos[color] = c);
  }
  function drawParticles(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, ZU.W, ZU.H);
    var i, p, k, s, color, lit = [];
    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (dt > 0.1) continue; // nach einem Hänger nicht quer über den Bildschirm springen
      p.vy += p.grav * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.glow) { lit.push(p); continue; }
      k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 2.2) * 0.85;
      ctx.fillStyle = p.colors[Math.min(p.colors.length - 1, Math.floor((1 - k) * p.colors.length))];
      s = Math.max(2, Math.round(p.size * (0.4 + k * 0.6)));
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < lit.length; i++) {
      p = lit[i];
      k = p.life / p.max;
      color = p.colors[Math.min(p.colors.length - 1, Math.floor((1 - k) * p.colors.length))];
      s = Math.max(2, Math.round(p.size * (0.4 + k * 0.6)));
      var r = s * 2.2 + 3;
      ctx.globalAlpha = Math.min(1, k * 2.2) * 0.3; // dezent: Viele Funken auf einem Fleck sollen glühen, nicht zu einer weißen Wolke verlaufen
      ctx.drawImage(halo(color), p.x - r, p.y - r, r * 2, r * 2);
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    // Lichtblitze: ein Hof, der aufgeht und verlischt
    for (i = flashes.length - 1; i >= 0; i--) {
      var f = flashes[i];
      f.life -= dt;
      if (f.life <= 0) { flashes.splice(i, 1); continue; }
      k = f.life / f.max;
      var fr = f.r0 + (f.r1 - f.r0) * (1 - k * k);
      ctx.globalAlpha = k * f.alpha;
      ctx.drawImage(halo(f.color), f.x - fr, f.y - fr, fr * 2, fr * 2);
    }
    // Kometen: ein heller Kopf fliegt im Bogen von A nach B und zieht Funken hinter sich her
    for (i = comets.length - 1; i >= 0; i--) {
      var c = comets[i];
      c.t += dt / c.dur;
      var done = c.t >= 1, t = done ? 1 : c.t, e = t * t * (3 - 2 * t), u = 1 - e;
      var x = u * u * c.ax + 2 * u * e * c.cx + e * e * c.bx, y = u * u * c.ay + 2 * u * e * c.cy + e * e * c.by;
      if (dt > 0 && particles.length < 500) {
        for (var n = 0; n < c.trail; n++) {
          var life = ZU.rand(0.16, 0.34);
          particles.push({ x: x + ZU.rand(-3, 3), y: y + ZU.rand(-3, 3), vx: ZU.rand(-26, 26), vy: ZU.rand(-26, 26), grav: -40, drag: 0.9,
            life: life, max: life, size: c.size * ZU.rand(0.5, 0.9), colors: c.colors, glow: true });
        }
      }
      var hr = c.size * 4.5;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(halo(c.colors[Math.min(1, c.colors.length - 1)]), x - hr, y - hr, hr * 2, hr * 2);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      s = Math.round(c.size);
      ctx.fillRect(Math.round(x - s / 2), Math.round(y - s / 2), s, s);
      if (done) { comets.splice(i, 1); c.resolve(); }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  ZU.fx = {
    burst: function (x, y, opts) {
      opts = opts || {};
      var n = opts.n || 14, speed = opts.speed || 260, colors = opts.colors || EMBER;
      if (particles.length > 500) return;
      for (var i = 0; i < n; i++) {
        var a = opts.cone != null ? -Math.PI / 2 + ZU.rand(-opts.cone, opts.cone) : Math.random() * Math.PI * 2;
        var v = speed * ZU.rand(0.3, 1);
        var life = ZU.rand(0.35, 0.9) * (opts.life || 1);
        particles.push({
          x: x + ZU.rand(-6, 6), y: y + ZU.rand(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          grav: opts.grav != null ? opts.grav : -160, drag: 0.94, life: life, max: life,
          size: opts.size || ZU.rand(3, 7), colors: colors, glow: opts.glow !== false
        });
      }
    },
    coins: function (x, y, n) {
      ZU.fx.burst(x, y, { n: n || 10, speed: 320, grav: 900, colors: ['#fff3c4', '#ffd75e', '#e2b23c', '#a8782a'], size: 6, life: 1.1 });
    },
    smoke: function (x, y, n) {
      ZU.fx.burst(x, y, { n: n || 12, speed: 90, grav: -90, colors: ['#cfc8bd', '#9b958c', '#6b665f', '#3d3a36'], size: 8, life: 1.5, glow: false });
    },
    shake: function (amount) { shake = Math.max(shake, amount); },
    /* Hit-Stop: hält Karten, Funken und Hintergrund für "ms" an. */
    hitstop: function (ms) { freeze = Math.max(freeze, ms / 1000); },
    /* Zoom-Stoß: Die Bühne springt kurz auf den Betrachter zu und federt zurück. */
    zoom: function (amount) { zoom = Math.max(zoom, amount); },
    /* Lichtblitz an einer Stelle (Einschlag, Zündung). */
    flash: function (x, y, opts) {
      opts = opts || {};
      var life = opts.life || 0.32;
      flashes.push({ x: x, y: y, r0: opts.from || 12, r1: opts.r || 90, life: life, max: life, color: opts.color || '#ffd75e', alpha: opts.alpha == null ? 0.9 : opts.alpha });
    },
    /* Komet von A nach B (Bühnenkoordinaten); das Versprechen löst sich beim Einschlag ein.
       opts: ms, colors, size, arc (Höhe des Bogens, negativ = nach unten), trail (Funken je Bild). */
    comet: function (ax, ay, bx, by, opts) {
      opts = opts || {};
      var dist = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
      var arc = opts.arc != null ? opts.arc : Math.min(90, dist * 0.22);
      return new Promise(function (resolve) {
        comets.push({ ax: ax, ay: ay, bx: bx, by: by, cx: (ax + bx) / 2, cy: (ay + by) / 2 - arc, t: 0,
          dur: Math.max(0.03, (opts.ms || 180) / 1000 / ZU.speed), colors: opts.colors || EMBER, size: opts.size || 7, trail: opts.trail || 2, resolve: resolve });
      });
    },

    /* Text-Popup, das aufspringt und nach oben wegschwebt. */
    pop: function (x, y, text, cls, ms) {
      var el = ZU.h('div', 'pop ' + (cls || ''), text);
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.setProperty('--tilt', ZU.rand(-7, 7).toFixed(1) + 'deg');
      el.style.animationDuration = ((ms || 1100) / ZU.speed) + 'ms';
      document.getElementById('pops').appendChild(el);
      setTimeout(function () { el.remove(); }, (ms || 1100) / ZU.speed + 50);
      return el;
    },

    /* Großes Banner quer über den Tisch: Die Buchstaben springen einzeln herein und wippen nach. */
    banner: function (text, cls, ms) {
      var line = ZU.h('span', null), index = 0;
      String(text).split(' ').forEach(function (word, w) {
        if (w) line.appendChild(document.createTextNode(' '));
        var box = ZU.h('em', null);
        Array.prototype.forEach.call(word, function (ch) {
          var letter = ZU.h('b', null, ch);
          letter.style.setProperty('--i', index++);
          box.appendChild(letter);
        });
        line.appendChild(box);
      });
      var el = ZU.h('div', 'banner ' + (cls || ''), line);
      el.style.setProperty('--sp', (1 / ZU.speed).toFixed(3));
      el.style.setProperty('--fit', Math.min(1, 16 / String(text).length).toFixed(3)); // lange Zeilen kleiner setzen, damit sie auf die Bühne passen
      el.style.animationDuration = ((ms || 1300) / ZU.speed) + 'ms';
      document.getElementById('pops').appendChild(el);
      return ZU.wait(ms || 1300).then(function () { el.remove(); });
    },

    /* Zählt eine Zahl in einem Element hoch bzw. herunter. */
    count: function (el, to, ms, suffix) {
      var from = el._value != null ? el._value : to, start = performance.now();
      ms = (ms == null ? 450 : ms) / ZU.speed;
      el._value = to;
      el._token = (el._token || 0) + 1;
      var token = el._token;
      if (from === to || ms <= 0) { el.textContent = ZU.fmt(to) + (suffix || ''); return; }
      (function step(now) {
        if (el._token !== token) return;
        var k = Math.min(1, (now - start) / ms);
        el.textContent = ZU.fmt(from + (to - from) * (1 - Math.pow(1 - k, 3))) + (suffix || '');
        if (k < 1) requestAnimationFrame(step);
      })(start);
    },

    /* Kurzer "Punch": Element springt auf und federt zurück (CSS-Animation neu starten). */
    punch: function (el, cls) {
      cls = cls || 'punch';
      el.classList.remove(cls);
      void el.offsetWidth;
      el.classList.add(cls);
    },

    /* Lässt ein Element von seiner Position zu einem Ziel fliegen und dort verschwinden. */
    flyTo: function (el, target, ms) {
      var from = ZU.stagePos(el), to = ZU.stagePos(target);
      var ghost = el.cloneNode(true);
      ghost.classList.add('ghost');
      ghost.style.left = (from.x - from.w / 2) + 'px';
      ghost.style.top = (from.y - from.h / 2) + 'px';
      ghost.style.width = from.w + 'px';
      ghost.style.height = from.h + 'px';
      document.getElementById('pops').appendChild(ghost);
      ms = (ms || 520) / ZU.speed;
      ghost.style.transition = 'transform ' + ms + 'ms cubic-bezier(.5,-0.3,.7,1), opacity ' + ms + 'ms ease-in';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          ghost.style.transform = 'translate(' + (to.x - from.x) + 'px,' + (to.y - from.y) + 'px) scale(.15) rotate(' + ZU.rand(-40, 40) + 'deg)';
          ghost.style.opacity = '0.2';
        });
      });
      return new Promise(function (resolve) {
        setTimeout(function () { ghost.remove(); resolve(); }, ms + 30);
      });
    },

    /* Verbrennt ein Element: Ein gezackter Brandrand frisst sich hindurch, Funken steigen auf.
       Am Ende ist das Element unsichtbar; das Versprechen löst sich dann ein. */
    burn: function (el, opts) {
      opts = opts || {};
      var ms = (opts.ms || 640) / ZU.speed;
      if (!maskOK) {
        el.classList.add('burning');
        return new Promise(function (resolve) { setTimeout(resolve, 420); });
      }
      return buildBurn().then(function () {
        if (!el.isConnected) return null;
        var sheet = burnSheets[Math.floor(Math.random() * burnSheets.length)];
        var edge = ZU.h('i', 'burn-edge');
        edge.style.backgroundImage = 'url(' + sheet.edge + ')';
        edge.style.animationDuration = ms + 'ms';
        el.appendChild(edge);
        el.style.webkitMaskImage = el.style.maskImage = 'url(' + sheet.mask + ')';
        el.style.animationDuration = ms + 'ms';
        el.classList.add('burn-away');
        if (!opts.quiet) {
          // Funken folgen dem Brandrand von unten nach oben
          for (var i = 0; i < 5; i++) {
            (function (k) {
              setTimeout(function () {
                if (!el.isConnected) return;
                var p = ZU.stagePos(el);
                ZU.fx.burst(p.x + ZU.rand(-p.w, p.w) * 0.35, p.y + p.h * (0.4 - k * 0.2), { n: 7, speed: 150, cone: 0.9, grav: -260, life: 0.9, size: 5 });
                if (k === 3) ZU.fx.smoke(p.x, p.y - p.h * 0.2, 6);
              }, ms * (0.08 + k * 0.17));
            })(i);
          }
        }
        return new Promise(function (resolve) {
          setTimeout(function () { el.style.visibility = 'hidden'; resolve(); }, ms);
        });
      });
    }
  };

  /* Brandmasken: je Variante ein Streifen aus BURN_N Bildern, erzeugt aus Rauschen plus Verlauf von unten.
     Bild 0 zeigt alles, das letzte nichts mehr; dazwischen wandert die Schwelle. Der Streifen dient als CSS-Maske,
     ein zweiter malt den glühenden Rand und die verkohlte Zone davor. */
  var BURN_N = 14, BW = 26, BH = 37, BC = 4, burnSheets = null, burnReady = null;
  var maskOK = typeof CSS !== 'undefined' && CSS.supports && (CSS.supports('mask-image', 'none') || CSS.supports('-webkit-mask-image', 'none'));
  function burnField(variant) {
    var gw = 6, gh = 8, grid = [], x, y, field = new Float32Array(BW * BH), lo = 9, hi = -9;
    for (y = 0; y <= gh; y++) for (x = 0; x <= gw; x++) grid.push(Math.random());
    function coarse(u, v) {
      var gx = u * (gw - 1), gy = v * (gh - 1), ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
      fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
      var a = grid[iy * (gw + 1) + ix], b = grid[iy * (gw + 1) + ix + 1], c = grid[(iy + 1) * (gw + 1) + ix], d = grid[(iy + 1) * (gw + 1) + ix + 1];
      return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
    }
    // Wo es anfängt: unten, unten links oder unten rechts
    var ox = variant === 1 ? 0.1 : variant === 2 ? 0.9 : 0.5;
    for (y = 0; y < BH; y++) for (x = 0; x < BW; x++) {
      var u = x / (BW - 1), v = y / (BH - 1);
      var dist = Math.sqrt((u - ox) * (u - ox) * 0.5 + (1 - v) * (1 - v));
      var value = dist * 0.62 + coarse(u, v) * 0.3 + Math.random() * 0.08;
      field[y * BW + x] = value;
      if (value < lo) lo = value;
      if (value > hi) hi = value;
    }
    for (var i = 0; i < field.length; i++) field[i] = (field[i] - lo) / (hi - lo);
    return field;
  }
  function buildBurn() {
    if (burnReady) return burnReady;
    burnSheets = [];
    var waits = [];
    for (var variant = 0; variant < 3; variant++) {
      var field = burnField(variant);
      var mask = document.createElement('canvas'), edge = document.createElement('canvas');
      mask.width = edge.width = BURN_N * BW * BC;
      mask.height = edge.height = BH * BC;
      var mg = mask.getContext('2d'), eg = edge.getContext('2d');
      mg.fillStyle = '#fff';
      for (var f = 0; f < BURN_N; f++) {
        var T = -0.1 + f / (BURN_N - 1) * 1.22;
        for (var y = 0; y < BH; y++) for (var x = 0; x < BW; x++) {
          var d = field[y * BW + x] - T;
          if (d < 0) continue;
          var px = (f * BW + x) * BC, py = y * BC;
          mg.fillRect(px, py, BC, BC);
          if (f === 0) continue;
          if (d < 0.2) {
            eg.fillStyle = d < 0.022 ? '#fff3c4' : d < 0.045 ? '#ffd75e' : d < 0.07 ? '#f08a24' : d < 0.095 ? '#c8402f' : d < 0.14 ? 'rgba(42,14,6,.82)' : 'rgba(30,12,6,.45)';
            eg.fillRect(px, py, BC, BC);
          }
        }
      }
      var sheet = { mask: mask.toDataURL(), edge: edge.toDataURL() };
      burnSheets.push(sheet);
      [sheet.mask, sheet.edge].forEach(function (url) {
        var image = new Image();
        image.src = url;
        sheet.keep = (sheet.keep || []).concat([image]); // dekodiert im Speicher halten
        waits.push(image.decode ? image.decode().catch(function () {}) : Promise.resolve());
      });
    }
    burnReady = Promise.all(waits);
    return burnReady;
  }
  /* Vorab erzeugen, damit die erste brennende Karte nicht stockt. */
  ZU.fx.prepare = function () { if (maskOK) buildBurn(); };

  /* ---------- Pixel-Feuer ----------
     Kleines Flammenfeld (cols × rows Zellen), das grob gepixelt hochskaliert wird. set(level) stellt die
     Stärke ein (0 = aus, 1 = volle Höhe, darüber lodernd), kick(amount) lässt es kurz auflodern. */
  var FIRE_MAX = 36, firePalette = null;
  function buildFirePalette() {
    var stops = [[0, 0, 0, 0, 0], [3, 70, 14, 6, 120], [8, 150, 34, 18, 215], [14, 210, 69, 47, 245], [20, 240, 138, 36, 255], [27, 255, 215, 94, 255], [36, 255, 243, 196, 255]];
    firePalette = new Uint8Array((FIRE_MAX + 1) * 4);
    for (var i = 0; i <= FIRE_MAX; i++) {
      var q = Math.round(i / 3) * 3, a = stops[0], b = stops[stops.length - 1]; // in Stufen: Pixel-Look statt Verlauf
      for (var k = 0; k < stops.length - 1; k++) if (q >= stops[k][0] && q <= stops[k + 1][0]) { a = stops[k]; b = stops[k + 1]; break; }
      var t = b[0] === a[0] ? 0 : (q - a[0]) / (b[0] - a[0]);
      for (var c = 0; c < 4; c++) firePalette[i * 4 + c] = Math.round(a[c + 1] + (b[c + 1] - a[c + 1]) * t);
    }
  }
  ZU.fire = function (cols, rows, cell, cls) {
    if (!firePalette) buildFirePalette();
    var canvas = ZU.h('canvas', 'firecv ' + (cls || ''));
    canvas.width = cols;
    canvas.height = rows;
    canvas.style.width = (cols * cell) + 'px';
    canvas.style.height = (rows * cell) + 'px';
    var g = canvas.getContext('2d'), image = g.createImageData(cols, rows), heat = new Uint8Array(cols * rows);
    var level = 0, shown = 0, boost = 0, acc = 0, alive = false, seen = false;
    function step(strength) {
      var x, y, bottom = (rows - 1) * cols, reach = Math.max(0.12, Math.min(1.25, strength));
      var avg = FIRE_MAX / (rows * reach), source = Math.min(1, 0.5 + strength * 0.55);
      for (x = 0; x < cols; x++) {
        var u = x / (cols - 1), taper = Math.pow(Math.sin(Math.PI * u), 0.55); // zu den Rändern hin niedriger
        // Bei wenig Glut brennen nur einzelne Nester, mit mehr schließt sich die Front.
        var lit = strength > 0.01 && Math.random() < 0.35 + strength * 0.9;
        heat[bottom + x] = lit ? Math.round(FIRE_MAX * source * taper * (0.72 + Math.random() * 0.28)) : Math.max(0, heat[bottom + x] - 6);
      }
      for (y = 0; y < rows - 1; y++) {
        for (x = 0; x < cols; x++) {
          var below = heat[(y + 1) * cols + x];
          var tx = x + ((Math.random() * 3) | 0) - 1;
          if (tx < 0) tx = 0; else if (tx >= cols) tx = cols - 1;
          var decay = Math.floor(avg * (0.25 + Math.random() * 1.5) + Math.random());
          heat[y * cols + tx] = below > decay ? below - decay : 0;
        }
      }
    }
    function draw() {
      var data = image.data, any = false;
      for (var i = 0; i < heat.length; i++) {
        var v = heat[i], o = i * 4, p = v * 4;
        if (v) any = true;
        data[o] = firePalette[p]; data[o + 1] = firePalette[p + 1]; data[o + 2] = firePalette[p + 2]; data[o + 3] = firePalette[p + 3];
      }
      g.putImageData(image, 0, 0);
      alive = any;
    }
    var update = ZU.onFrame(function (dt) {
      if (canvas.isConnected) seen = true;
      else if (seen) { ZU.offFrame(update); return; } // Tisch abgebaut: Schleife beenden
      shown += (level - shown) * (1 - Math.pow(0.02, dt));
      boost *= Math.pow(0.08, dt);
      var strength = shown + boost;
      if (strength < 0.012 && !alive) return;
      acc += dt;
      if (acc < 1 / 30) return;
      acc = 0;
      step(strength < 0.012 ? 0 : strength);
      draw();
    });
    return {
      el: canvas,
      set: function (value) { level = Math.max(0, value); },
      kick: function (amount) { boost = Math.min(1.2, boost + amount); },
      destroy: function () { ZU.offFrame(update); }
    };
  };

  /* ---------- Tooltip ---------- */
  var tipEl, tipOwner = null, lastOwner = null;
  /* Mit der Maus erscheint der Tooltip beim Überfahren. Mit dem Finger gibt es kein Überfahren:
     - Antippen zeigt ihn bei allem, was selbst nichts auslöst (Trinkets, Anzeigen, nicht spielbare Karten).
     - Gedrückt halten zeigt ihn bei allem anderen (Handkarten, Knöpfe, Angebote), ohne es auszulösen.
     Er bleibt stehen, bis irgendwo wieder getippt wird. */
  var HOLD_MS = 380, MOVE_PX = 12;
  var touch = null, swallowClick = false, ready = false;
  function touchEnd(show) {
    if (!touch) return;
    clearTimeout(touch.timer);
    var t = touch;
    touch = null;
    // Ein zweiter Tipp auf dasselbe Element schließt den Tooltip nur.
    if (show && !t.held && !t.moved && !t.action && !t.wasOpen && document.contains(t.el)) ZU.tip.show(t.el);
  }
  function initTouchTips() {
    if (ready) return;
    ready = true;
    // Läuft vor dem Element selbst: Jeder neue Tipp räumt den stehenden Tooltip ab.
    window.addEventListener('pointerdown', function (ev) {
      swallowClick = false;
      if (ev.pointerType !== 'mouse') { touchEnd(false); ZU.tip.hide(); }
    }, true);
    window.addEventListener('pointermove', function (ev) {
      if (!touch || ev.pointerId !== touch.id) return;
      if (Math.abs(ev.clientX - touch.x) > MOVE_PX || Math.abs(ev.clientY - touch.y) > MOVE_PX) { touch.moved = true; clearTimeout(touch.timer); }
    }, true);
    window.addEventListener('pointerup', function (ev) { if (touch && ev.pointerId === touch.id) touchEnd(true); }, true);
    window.addEventListener('pointercancel', function (ev) { if (touch && ev.pointerId === touch.id) touchEnd(false); }, true);
    // Nach dem Gedrückthalten folgt beim Loslassen noch ein Klick; der soll nichts mehr auslösen.
    window.addEventListener('click', function (ev) {
      if (!swallowClick) return;
      swallowClick = false;
      ev.stopPropagation();
      ev.preventDefault();
    }, true);
    // Langes Drücken öffnet auf dem Handy sonst das Kontextmenü (Bild speichern, Text markieren).
    window.addEventListener('contextmenu', function (ev) {
      if (ev.pointerType && ev.pointerType !== 'mouse' && !(ev.target.closest && ev.target.closest('input, textarea, a'))) ev.preventDefault();
    });
  }
  ZU.tip = {
    bind: function (el, content) {
      el._tip = content;
      initTouchTips();
      el.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') ZU.tip.show(el); });
      el.addEventListener('pointerleave', function (ev) { if (ev.pointerType === 'mouse') ZU.tip.hide(el); });
      el.addEventListener('pointerdown', function (ev) {
        if (ev.pointerType === 'mouse') { ZU.tip.hide(el); return; }
        if (touch) return; // das innerste Element mit Tooltip gewinnt
        var wasOpen = lastOwner === el;
        lastOwner = null;
        touch = {
          el: el, id: ev.pointerId, x: ev.clientX, y: ev.clientY, held: false, moved: false, wasOpen: wasOpen,
          // Löst der Tipp hier etwas aus? Alles Anklickbare trägt den Zeiger-Cursor (auch geerbt, etwa im Knopf).
          action: getComputedStyle(ev.target).cursor === 'pointer',
          timer: setTimeout(function () {
            if (!touch || touch.el !== el || !document.contains(el)) return;
            touch.held = true;
            swallowClick = true;
            ZU.tip.show(el);
          }, HOLD_MS)
        };
      });
    },
    show: function (el) {
      var content = typeof el._tip === 'function' ? el._tip() : el._tip;
      if (!content) return;
      tipOwner = el;
      tipEl.innerHTML = '';
      if (typeof content === 'string') tipEl.innerHTML = content; else tipEl.appendChild(content);
      tipEl.classList.add('on');
      var p = ZU.stagePos(el), w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
      var x = ZU.clamp(p.x - w / 2, 8, ZU.W - w - 8);
      var y = p.y - p.h / 2 - hgt - 12;
      if (y < 8) y = Math.min(ZU.H - hgt - 8, p.y + p.h / 2 + 12);
      tipEl.style.left = x + 'px';
      tipEl.style.top = y + 'px';
    },
    hide: function (el) {
      if (!tipEl || (el && tipOwner !== el)) return;
      lastOwner = tipOwner;
      tipOwner = null;
      tipEl.classList.remove('on');
    },
    card: function (def, bind, mark) {
      var rarity = ZU.RARITY[def.rarity];
      if (!def.special) {
        var extra = '';
        if (mark && mark.seal && ZU.SEALS[mark.seal]) extra += '<p><b>' + ZU.SEALS[mark.seal].name + ':</b> ' + ZU.SEALS[mark.seal].text + '</p>';
        if (mark && mark.flaw && ZU.FLAWS[mark.flaw]) extra += '<p class="dim"><b>Makel ' + ZU.FLAWS[mark.flaw].name + ':</b> ' + ZU.FLAWS[mark.flaw].text + '</p>';
        return '<b>' + def.name + '</b><i class="rar common">Glut ' + def.base + '</i>' + (def.text ? '<p>' + def.text + '</p>' : '') + extra;
      }
      var bound = bind && bind !== 'none';
      return '<b>' + def.name + '</b>' +
        '<i class="rar ' + rarity.cls + '">' + rarity.name + ' · Spezialkarte' + (bound ? ' · ' + ZU.bindLabel(bind) : '') + '</i>' +
        '<p>' + def.text + '</p>' +
        '<p class="dim">' + (bound ? ZU.bindText(bind) : 'Spezialkarten sind an ein Symbol, an eine Farbe oder gar nicht gebunden.') + '</p>';
    },
    trinket: function (id, extra) {
      var t = ZU.TRINKETS[id], rarity = ZU.RARITY[t.rarity];
      return '<b>' + t.name + '</b><i class="rar ' + rarity.cls + '">' + rarity.name + ' · Trinket</i><p>' + t.text + '</p>' + (extra ? '<p class="dim">' + extra + '</p>' : '');
    }
  };

  /* Neigt ein Element in 3D zur Maus (für Karten in Laden, Deck und Belohnung). */
  ZU.tilt = function (el, inner, deg, grow) {
    inner = inner || el;
    deg = deg == null ? 14 : deg;
    grow = grow == null ? 1.08 : grow;
    var foil; // Folie einer Karte (falls vorhanden): wandert mit der Neigung
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var nx = ((e.clientX - r.left) / r.width - 0.5) * 2, ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
      inner.style.transform = 'rotateY(' + (nx * deg).toFixed(1) + 'deg) rotateX(' + (-ny * deg).toFixed(1) + 'deg) scale(' + grow + ')';
      if (foil === undefined) foil = el.querySelector('.foil i');
      if (foil) foil.style.transform = 'translate(' + (nx * 46).toFixed(0) + 'px,' + (ny * 46).toFixed(0) + 'px)';
    });
    el.addEventListener('pointerleave', function () {
      inner.style.transform = '';
      if (foil) foil.style.transform = '';
    });
  };

  ZU.initStage = function () {
    stage = document.getElementById('stage');
    tipEl = document.getElementById('tooltip');
    ctx = document.getElementById('fxcanvas').getContext('2d');
    window.addEventListener('resize', fit);
    fit();
    requestAnimationFrame(frame);
  };
})(window.ZU = window.ZU || {});
