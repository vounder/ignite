/* Zündung – Karten: Pixel-Symbole, Kartenflächen und die gefederten Karten-Sprites des Tisches. */
(function (ZU) {
  'use strict';
  var h = ZU.h;

  /* ---------- Pixel-Symbole aus Bitmaps ---------- */
  var BITMAPS = {
    hearts: ['.xx...xx.', 'xxxx.xxxx', 'xxxxxxxxx', 'xxxxxxxxx', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....'],
    diamonds: ['....x....', '...xxx...', '..xxxxx..', '.xxxxxxx.', 'xxxxxxxxx', '.xxxxxxx.', '..xxxxx..', '...xxx...', '....x....'],
    spades: ['....x....', '...xxx...', '..xxxxx..', '.xxxxxxx.', 'xxxxxxxxx', 'xxxxxxxxx', '.xx.x.xx.', '....x....', '...xxx...'],
    clubs: ['...xxx...', '..xxxxx..', '..xxxxx..', '.xx.x.xx.', 'xxxxxxxxx', 'xxxxxxxxx', '.xx.x.xx.', '....x....', '...xxx...'],
    match: ['.rr.', 'rRRr', 'rRRr', '.rr.', '.ww.', '.ww.', '.ww.', '.ww.', '.ww.', '.ww.', '.ww.', '.ww.'],
    matchOut: ['....', '.kk.', '.kk.', '.kk.', '.dd.', '.dd.', '.dd.', '.dd.', '.dd.', '.dd.', '.dd.', '.dd.'],
    matchGold: ['.yy.', 'yggy', 'yggy', '.yy.', '.gg.', '.gg.', '.gg.', '.gg.', '.gg.', '.gg.', '.gg.', '.gg.'],
    coin: ['..gggg..', '.gyyyyG.', 'gyygGyyG', 'gyggGyyG', 'gyygGyyG', 'gyygGyyG', '.gyyyyG.', '..GGGG..'],
    flame: ['....o...', '...oo...', '..ooo.o.', '..oyoooo', '.ooyyoo.', '.oyyyyo.', 'ooywwyoo', 'ooywwyoo', '.ooyyoo.', '..oooo..'],
    lock: ['..kkkk..', '.kk..kk.', '.kk..kk.', 'gggggggg', 'gyyGGyyg', 'gyyGGyyg', 'gyyyyyyg', 'gggggggg'],
    deck: ['..wwwwww', '.wwwwwww', 'wwwwwwkw', 'wrwwwwkw', 'wwwwwwkw', 'wwwrwwkw', 'wwwwwwkw', 'wwwwwwk.', 'kkkkkkk.']
  };
  var COLORS = {
    x: '#000', r: '#e4572e', R: '#ff9f43', w: '#e9d8b0', k: '#2a2320', d: '#5a4a3c', g: '#e2b23c', G: '#9a6f24',
    y: '#ffd75e', o: '#f08a24'
  };
  var cache = {};

  /* Liefert eine data:-URL für ein Symbol; "tint" färbt einfarbige Bitmaps (x) um. */
  ZU.icon = function (name, tint) {
    var key = name + '|' + (tint || '');
    if (cache[key]) return cache[key];
    var rows = BITMAPS[name], canvas = document.createElement('canvas');
    canvas.width = rows[0].length;
    canvas.height = rows.length;
    var ctx = canvas.getContext('2d');
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        var ch = row[x];
        if (ch === '.') continue;
        ctx.fillStyle = ch === 'x' && tint ? tint : COLORS[ch] || '#f0f';
        ctx.fillRect(x, y, 1, 1);
      }
    });
    return (cache[key] = canvas.toDataURL());
  };
  ZU.iconEl = function (name, cls, tint) {
    var el = h('i', 'ico ' + (cls || ''));
    el.style.backgroundImage = 'url(' + ZU.icon(name, tint) + ')';
    return el;
  };

  var RED = '#b3261e', BLACK = '#1f2a2c';
  ZU.suitIcon = function (suit) { return ZU.icon(suit, ZU.SUITS[suit].red ? RED : BLACK); };

  /* ---------- Kartenflächen ---------- */
  ZU.cardFace = function (def) {
    var el;
    if (def.special) {
      el = h('div', 'card front special r' + def.rarity);
      var title = h('div', 'sp-title', def.name);
      if (def.name.length > 9) title.style.fontSize = def.name.length > 11 ? '10px' : '12px';
      var art = h('div', 'sp-art');
      art.style.backgroundImage = 'url(assets/special/' + def.id + '.png)';
      el.appendChild(title);
      el.appendChild(art);
      el.appendChild(h('div', 'sp-tag', def.tag));
      el.appendChild(h('div', 'shine'));
      return el;
    }
    var suit = ZU.SUITS[def.suit], rank = ZU.RANKS[def.rank], url = 'url(' + ZU.suitIcon(def.suit) + ')';
    el = h('div', 'card front std ' + (suit.red ? 'red' : 'black') + ' rank-' + def.rank);
    function corner(cls) {
      var pip = h('i', 'pip');
      pip.style.backgroundImage = url;
      return h('div', 'corner ' + cls, [h('b', rank.label.length > 1 ? 'two' : null, rank.label), pip]);
    }
    el.appendChild(corner('tl'));
    el.appendChild(corner('br'));
    var center = h('div', 'center');
    if (def.rank === 'J' || def.rank === 'Q' || def.rank === 'K') {
      var frame = h('div', 'court', [h('b', null, rank.label)]);
      var mini = h('i', 'pip');
      mini.style.backgroundImage = url;
      frame.appendChild(mini);
      center.appendChild(frame);
    } else {
      var big = h('i', 'bigpip' + (def.rank === 'A' ? ' ace' : ''));
      big.style.backgroundImage = url;
      center.appendChild(big);
    }
    el.appendChild(center);
    if (def.rank === '7') {
      var mark = h('div', 'fxmark', '+2');
      el.appendChild(mark);
    }
    el.appendChild(h('div', 'shine'));
    return el;
  };

  ZU.cardBack = function () {
    return h('div', 'card back', [h('div', 'back-inner', [h('div', 'back-emblem')])]);
  };

  /* Statische Karte für Laden, Deck und Belohnungen (kippt zur Maus). */
  ZU.cardStatic = function (def, opts) {
    opts = opts || {};
    var inner = h('div', 'cs-inner', [ZU.cardFace(def)]);
    var box = h('div', 'cardstatic' + (opts.cls ? ' ' + opts.cls : ''), [h('div', 'cs-shadow'), inner]);
    ZU.tilt(box, inner);
    if (!opts.noTip) ZU.tip.bind(box, function () { return ZU.tip.card(def); });
    return box;
  };

  ZU.trinketEl = function (id, extraTip) {
    var t = ZU.TRINKETS[id];
    var img = h('i', 'tk-img');
    img.style.backgroundImage = 'url(assets/trinkets/' + id + '.png)';
    var el = h('div', 'trinket r' + t.rarity, [img]);
    el.dataset.id = id;
    ZU.tip.bind(el, function () { return ZU.tip.trinket(id, typeof extraTip === 'function' ? extraTip() : extraTip); });
    return el;
  };

  ZU.portraitEl = function (enemyId, cls) {
    var enemy = ZU.ENEMIES[enemyId];
    var img = h('i', 'pt-img');
    img.style.backgroundImage = 'url(assets/enemies/' + enemyId + '.png)';
    var el = h('div', 'portrait ' + (cls || '') + ' k-' + enemy.kind, [img]);
    el.style.setProperty('--pbg', enemy.look.bg);
    return el;
  };

  /* ---------- Sprite: eine Karte auf dem Tisch, bewegt über gedämpfte Federn ---------- */
  var CW = 104, CH = 146;
  ZU.CARD_W = CW;
  ZU.CARD_H = CH;

  function Sprite(card, layer, x, y) {
    this.id = card.id;
    this.def = ZU.CARDS[card.def];
    this.x = this.tx = x;
    this.y = this.ty = y;
    this.r = this.tr = 0;
    this.s = this.ts = 1;
    this.vx = this.vy = this.vr = this.vs = 0;
    this.flip = this.tflip = 1; // 1 = Rückseite oben
    this.vflip = 0;
    this.tiltX = this.tiltY = this.ttiltX = this.ttiltY = 0;
    this.lift = this.tlift = 0;
    this.z = 0;
    this.phase = Math.random() * 10;
    this.sway = 0; // Stärke des Atmens (Hand: 1, sonst 0)
    this.hover = false;
    this.selected = false;
    this.dead = false;
    this.stiff = 190;
    this.damp = 20;

    this.flipEl = h('div', 'spr-flip', [ZU.cardFace(this.def), ZU.cardBack()]);
    this.tiltEl = h('div', 'spr-tilt', [this.flipEl]);
    this.shadowEl = h('div', 'spr-shadow');
    this.badgeEl = h('div', 'spr-badge');
    this.el = h('div', 'spr', [this.shadowEl, this.tiltEl, this.badgeEl]);
    this.el._sprite = this;
    layer.appendChild(this.el);
    this._applied = {};
    this.render();
  }

  Sprite.prototype.moveTo = function (x, y, r, s) {
    this.tx = x;
    this.ty = y;
    if (r != null) this.tr = r;
    if (s != null) this.ts = s;
  };
  Sprite.prototype.snap = function () {
    this.x = this.tx; this.y = this.ty; this.r = this.tr; this.s = this.ts;
    this.vx = this.vy = this.vr = this.vs = 0;
  };
  Sprite.prototype.face = function (up) { this.tflip = up ? 0 : 1; };
  Sprite.prototype.setZ = function (z) {
    if (z !== this.z) { this.z = z; this.el.style.zIndex = z; }
  };
  /* Kurzer Stoß: Karte springt auf und federt zurück. */
  Sprite.prototype.punch = function (amount) { this.vs += amount == null ? 3.2 : amount; };
  Sprite.prototype.kick = function (vx, vy, vr) { this.vx += vx || 0; this.vy += vy || 0; this.vr += vr || 0; };
  Sprite.prototype.badge = function (text) {
    this.badgeEl.textContent = text || '';
    this.badgeEl.classList.toggle('on', !!text);
  };
  Sprite.prototype.remove = function () {
    this.dead = true;
    this.el.remove();
  };

  /* Unabhängig von der Bildrate: große Zeitschritte werden in kleine Teilschritte zerlegt. */
  Sprite.prototype.update = function (dt, time) {
    var left = Math.min(dt, 0.5);
    while (left > 0.0001) {
      var step = Math.min(left, 1 / 90);
      this.step(step);
      left -= step;
    }
    this.time = time;
    this.render();
  };

  Sprite.prototype.step = function (dt) {
    var k = this.stiff, d = this.damp;
    // halb-implizite Feder: stabil auch bei Bildrucklern
    this.vx += ((this.tx - this.x) * k - this.vx * d) * dt;
    this.vy += ((this.ty - this.y) * k - this.vy * d) * dt;
    this.vr += ((this.tr - this.r) * k - this.vr * d) * dt;
    this.vs += ((this.ts - this.s) * 260 - this.vs * 16) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.r += this.vr * dt;
    this.s += this.vs * dt;
    this.vflip += ((this.tflip - this.flip) * 240 - this.vflip * 26) * dt;
    this.flip += this.vflip * dt;
    var e = 1 - Math.pow(0.0005, dt);
    this.tiltX += (this.ttiltX - this.tiltX) * e;
    this.tiltY += (this.ttiltY - this.tiltY) * e;
    this.lift += (this.tlift - this.lift) * e;
  };

  Sprite.prototype.render = function () {
    var t = this.time || 0, a = this._applied;
    var swayR = this.sway ? Math.sin(t * 1.25 + this.phase) * 1.1 * this.sway : 0;
    var swayY = this.sway ? Math.sin(t * 1.6 + this.phase * 1.7) * 2.2 * this.sway : 0;
    // Karte lehnt sich in Bewegungsrichtung
    var lean = ZU.clamp(this.vx * 0.018, -16, 16);
    var transform = 'translate3d(' + (this.x - CW / 2).toFixed(1) + 'px,' + (this.y - CH / 2 + swayY - this.lift).toFixed(1) + 'px,0) rotate(' +
      (this.r + swayR + lean).toFixed(2) + 'deg) scale(' + Math.max(0.05, this.s).toFixed(3) + ')';
    if (transform !== a.transform) { this.el.style.transform = a.transform = transform; }

    var speedTilt = ZU.clamp(-this.vy * 0.012, -10, 10);
    var tilt = 'rotateX(' + (this.tiltX + speedTilt).toFixed(1) + 'deg) rotateY(' + this.tiltY.toFixed(1) + 'deg)';
    if (tilt !== a.tilt) { this.tiltEl.style.transform = a.tilt = tilt; }

    var flipDeg = (ZU.clamp(this.flip, -0.15, 1.15) * 180).toFixed(1);
    if (flipDeg !== a.flip) { this.flipEl.style.transform = 'rotateY(' + flipDeg + 'deg)'; a.flip = flipDeg; }

    var depth = 6 + this.lift * 0.9 + (this.s - 1) * 60;
    var shadow = 'translate(' + (depth * 0.55 - this.tiltY * 0.3).toFixed(1) + 'px,' + (depth + this.lift).toFixed(1) + 'px)';
    if (shadow !== a.shadow) { this.shadowEl.style.transform = a.shadow = shadow; }
  };

  /* Maus über der Karte: 3D-Neigung zur Zeigerposition. */
  Sprite.prototype.pointer = function (e) {
    var r = this.el.getBoundingClientRect();
    var nx = ((e.clientX - r.left) / r.width - 0.5) * 2, ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
    this.ttiltY = ZU.clamp(nx, -1, 1) * 15;
    this.ttiltX = -ZU.clamp(ny, -1, 1) * 15;
  };
  Sprite.prototype.unpointer = function () { this.ttiltX = this.ttiltY = 0; };

  ZU.Sprite = Sprite;
})(window.ZU = window.ZU || {});
