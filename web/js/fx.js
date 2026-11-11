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
    stage.style.transform = 'translate(-50%, -50%) scale(' + scale + ') translate(' + shakeX.toFixed(2) + 'px,' + shakeY.toFixed(2) + 'px) rotate(' + shakeR.toFixed(3) + 'deg)';
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
  var updaters = [], last = 0;
  ZU.time = 0;
  ZU.onFrame = function (fn) { updaters.push(fn); return fn; };
  ZU.offFrame = function (fn) { var i = updaters.indexOf(fn); if (i >= 0) updaters.splice(i, 1); };
  function frame(now) {
    var dt = Math.min(0.5, (now - last) / 1000 || 0.016);
    last = now;
    ZU.time += dt;
    for (var i = updaters.length - 1; i >= 0; i--) updaters[i](dt, ZU.time);
    if (shake > 0.05) {
      shake *= Math.pow(0.0015, dt);
      shakeX = (Math.random() - 0.5) * shake * 2;
      shakeY = (Math.random() - 0.5) * shake * 2;
      shakeR = (Math.random() - 0.5) * shake * 0.08;
      applyStage();
    } else if (shake !== 0) {
      shake = 0; shakeX = shakeY = shakeR = 0;
      applyStage();
    }
    drawParticles(dt);
    requestAnimationFrame(frame);
  }

  /* ---------- Partikel (Glutfunken als harte Pixel) ---------- */
  var particles = [], ctx;
  var EMBER = ['#fff3c4', '#ffd75e', '#f9a03f', '#f08a24', '#c8402f'];
  function drawParticles(dt) {
    if (!ctx) return;
    ctx.clearRect(0, 0, ZU.W, ZU.H);
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      if (dt > 0.1) continue; // nach einem Hänger nicht quer über den Bildschirm springen
      p.vy += p.grav * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      var k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 2.2);
      ctx.fillStyle = p.colors[Math.min(p.colors.length - 1, Math.floor((1 - k) * p.colors.length))];
      var s = Math.max(2, Math.round(p.size * (0.4 + k * 0.6)));
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
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
          size: opts.size || ZU.rand(3, 7), colors: colors
        });
      }
    },
    coins: function (x, y, n) {
      ZU.fx.burst(x, y, { n: n || 10, speed: 320, grav: 900, colors: ['#fff3c4', '#ffd75e', '#e2b23c', '#a8782a'], size: 6, life: 1.1 });
    },
    smoke: function (x, y, n) {
      ZU.fx.burst(x, y, { n: n || 12, speed: 90, grav: -90, colors: ['#cfc8bd', '#9b958c', '#6b665f', '#3d3a36'], size: 8, life: 1.5 });
    },
    shake: function (amount) { shake = Math.max(shake, amount); },

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

    /* Großes Banner quer über den Tisch. */
    banner: function (text, cls, ms) {
      var el = ZU.h('div', 'banner ' + (cls || ''), ZU.h('span', null, text));
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
    }
  };

  /* ---------- Tooltip ---------- */
  var tipEl, tipOwner = null;
  ZU.tip = {
    bind: function (el, content) {
      el._tip = content;
      el.addEventListener('pointerenter', function () { ZU.tip.show(el); });
      el.addEventListener('pointerleave', function () { ZU.tip.hide(el); });
      el.addEventListener('pointerdown', function () { ZU.tip.hide(el); });
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
      if (el && tipOwner !== el) return;
      tipOwner = null;
      tipEl.classList.remove('on');
    },
    card: function (def) {
      var rarity = ZU.RARITY[def.rarity];
      return '<b>' + def.name + '</b>' +
        (def.special ? '<i class="rar ' + rarity.cls + '">' + rarity.name + ' · Spezialkarte · Joker</i>' : '<i class="rar common">Glut ' + def.base + '</i>') +
        (def.text ? '<p>' + def.text + '</p>' : '') +
        (def.special ? '<p class="dim">Passt auf jede Karte. Danach darf alles gelegt werden.</p>' : '');
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
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var nx = ((e.clientX - r.left) / r.width - 0.5) * 2, ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
      inner.style.transform = 'rotateY(' + (nx * deg).toFixed(1) + 'deg) rotateX(' + (-ny * deg).toFixed(1) + 'deg) scale(' + grow + ')';
    });
    el.addEventListener('pointerleave', function () { inner.style.transform = ''; });
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
