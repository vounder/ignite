/* Zündung – Karten: Pixel-Symbole, Kartenflächen und die gefederten Karten-Sprites des Tisches. */
(function (ZU) {
  'use strict';
  var h = ZU.h;

  /* ---------- Pixel-Symbole aus Bitmaps ---------- */
  var BITMAPS = {
    /* Symbole mit Glanzlicht (h) und Schatten (s); dieselben Bitmaps zeichnet web/tools/make_cards.py auf die Karten. */
    hearts: ['.xxx...xxx.', 'xhhxx.xxxxx', 'xhxxxxxxxxx', 'xxxxxxxxxxs', 'xxxxxxxxxxs', 'xxxxxxxxxss', '.xxxxxxxss.', '..xxxxxss..', '...xxxss...', '....xss....', '.....s.....'],
    diamonds: ['.....x.....', '....hxx....', '...hhxxx...', '..hhhxxxx..', '.hhhhxxxxx.', 'hhhhhxxxxxx', '.xxxxxssss.', '..xxxxsss..', '...xxxss...', '....xxs....', '.....s.....'],
    spades: ['.....x.....', '....xhx....', '...xxhxx...', '..xxxhxxx..', '.xxxxhxxxx.', 'xxxxxhxxxxx', 'xxxxxhxxxxs', 'xxxx.x.xxss', '.xx..x..ss.', '....xxx....', '...hhhhh...'],
    clubs: ['.....x.....', '....xxx....', '...xhxxx...', '...xxxxx...', '.xx.xxx.xx.', 'xxxxxxxxxxx', 'xhxxxxxxhxx', 'xxxx.x.xxxx', '.xx..x..xx.', '....xxx....', '...hhhhh...'],
    match: ['.rr.', 'rRRr', 'rRRr', '.rr.', '.ww.', '.ww.', '.ww.', '.ww.', '.ww.', '.ww.', '.ww.', '.ww.'],
    matchOut: ['....', '.kk.', '.kk.', '.kk.', '.dd.', '.dd.', '.dd.', '.dd.', '.dd.', '.dd.', '.dd.', '.dd.'],
    matchGold: ['.yy.', 'yggy', 'yggy', '.yy.', '.gg.', '.gg.', '.gg.', '.gg.', '.gg.', '.gg.', '.gg.', '.gg.'],
    coin: ['..gggg..', '.gyyyyG.', 'gyygGyyG', 'gyggGyyG', 'gyygGyyG', 'gyygGyyG', '.gyyyyG.', '..GGGG..'],
    flame: ['....o...', '...oo...', '..ooo.o.', '..oyoooo', '.ooyyoo.', '.oyyyyo.', 'ooywwyoo', 'ooywwyoo', '.ooyyoo.', '..oooo..'],
    lock: ['..kkkk..', '.kk..kk.', '.kk..kk.', 'gggggggg', 'gyyGGyyg', 'gyyGGyyg', 'gyyyyyyg', 'gggggggg'],
    reroll: ['...xxxxx...', '..x.....x.x', '.x.......xx', '.x......xxx', 'x..........', 'x.........x', '..........x', 'xxx......x.', 'xx.......x.', 'x.x.....x..', '...xxxxx...'],
    ash: ['....o...', '...oyo..', '...oo...', '..aAa...', '.aAaaAa.', 'aAaAaaAa', 'AaAAaAAA', 'AAAAAAAA'],
    deck: ['..wwwwww', '.wwwwwww', 'wwwwwwkw', 'wrwwwwkw', 'wwwwwwkw', 'wwwrwwkw', 'wwwwwwkw', 'wwwwwwk.', 'kkkkkkk.']
  };
  var COLORS = {
    x: '#000', r: '#e4572e', R: '#ff9f43', w: '#e9d8b0', k: '#2a2320', d: '#5a4a3c', g: '#e2b23c', G: '#9a6f24',
    y: '#ffd75e', o: '#f08a24', a: '#b9b2a8', A: '#6b665f'
  };
  var cache = {};

  /* Liefert eine data:-URL für ein Symbol. "tint" färbt einfarbige Bitmaps (x) um;
     ein Objekt ({ x, h, s }) ersetzt einzelne Farben. */
  ZU.icon = function (name, tint) {
    var map = tint && typeof tint === 'object' ? tint : tint ? { x: tint } : {};
    var key = name + '|' + (typeof tint === 'object' ? JSON.stringify(tint) : tint || '');
    if (cache[key]) return cache[key];
    var rows = BITMAPS[name], canvas = document.createElement('canvas');
    canvas.width = rows[0].length;
    canvas.height = rows.length;
    var ctx = canvas.getContext('2d');
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x++) {
        var ch = row[x];
        if (ch === '.') continue;
        ctx.fillStyle = map[ch] || COLORS[ch] || '#f0f';
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

  /* Jedes Symbol hat seine eigenen Farben: Herz karmin, Karo zinnober, Pik nachtblau, Kreuz schwarz mit Moos. */
  var SUIT_INK = {
    hearts: { x: '#c8273a', h: '#ff9fb0', s: '#7d1027' },
    diamonds: { x: '#dc4a1c', h: '#ffae42', s: '#96280f' },
    spades: { x: '#1f2f57', h: '#8fb0de', s: '#0e1730' },
    clubs: { x: '#1c1f18', h: '#6f8748', s: '#0a0b08' }
  };
  ZU.suitIcon = function (suit) { return ZU.icon(suit, SUIT_INK[suit]); };

  /* Alle Kartenflächen liegen in einem Atlas (web/tools/make_cards.py): 8 Spalten, 5 Zeilen.
     Zeilen 0–3: die vier Symbole mit 7 bis Ass; Zeile 4: Rahmen der Spezialkarten je Bindung. */
  var FACE_SUITS = ['hearts', 'diamonds', 'spades', 'clubs'];
  var FACE_RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var FRAMES = ['hearts', 'diamonds', 'spades', 'clubs', 'red', 'black', 'wild', 'none'];
  ZU.cardAtlas = function () { return ZU.asset('cards/faces.png'); };
  function atlasCell(el, column, row) {
    el.style.backgroundImage = 'url(' + ZU.cardAtlas() + ')';
    el.style.backgroundPosition = (column * 100 / 7) + '% ' + (row * 100 / 4) + '%';
  }

  /* ---------- Kartenflächen ---------- */
  /* Wimpel auf Spezialkarten: an welches Symbol bzw. welche Farbe die Karte gebunden ist. */
  function bindBadge(bind) {
    var badge = h('div', 'sp-bind t' + ZU.bindTier(bind));
    ZU.bindSuits(bind).forEach(function (suit) {
      var pip = h('i', 'bpip');
      pip.style.backgroundImage = 'url(' + ZU.suitIcon(suit) + ')';
      badge.appendChild(pip);
    });
    return badge;
  }

  /* bind: Bindung einer Spezialkarte ('hearts', 'red', 'wild' …). Der Rahmen zeigt sie:
     ein Symbol = dessen Stilwelt, eine Farbe = zwei Welten schräg geteilt, frei = schwarzer Lack mit Gold.
     'none' zeigt den neutralen Hausrahmen ohne Wimpel. */
  /* mark: { seal, flaw } einer veredelten normalen Karte – erscheint als Siegel unten links, der Makel daneben. */
  ZU.cardFace = function (def, bind, mark) {
    var el;
    if (def.special) {
      bind = bind || 'wild';
      var frame = FRAMES.indexOf(bind) >= 0 ? bind : 'wild';
      el = h('div', 'card front special r' + def.rarity + ' b-' + frame);
      atlasCell(el, FRAMES.indexOf(frame), 4);
      var title = h('div', 'sp-title', def.name);
      if (def.name.length > 9) title.style.fontSize = def.name.length > 11 ? '10px' : '12px';
      var art = h('div', 'sp-art');
      art.style.backgroundImage = 'url(' + ZU.asset('special/' + def.id + '.png') + ')';
      el.appendChild(title);
      el.appendChild(art);
      if (bind !== 'none') el.appendChild(bindBadge(bind));
      el.appendChild(h('div', 'sp-tag', def.tag));
      el.appendChild(h('div', 'shine'));
      return el;
    }
    el = h('div', 'card front std s-' + def.suit + ' rank-' + def.rank);
    atlasCell(el, FACE_RANKS.indexOf(def.rank), FACE_SUITS.indexOf(def.suit));
    if (def.rank === '7') el.appendChild(h('div', 'fxmark', '+1'));
    if (mark && mark.seal && ZU.SEALS[mark.seal]) {
      var seal = h('i', 'card-seal');
      seal.style.backgroundImage = 'url(' + ZU.asset('seals/' + mark.seal + '.png') + ')';
      el.appendChild(seal);
      el.classList.add('sealed');
    }
    if (mark && mark.flaw && ZU.FLAWS[mark.flaw]) {
      var flaw = h('i', 'card-flaw');
      flaw.style.backgroundImage = 'url(' + ZU.asset('seals/flaw.png') + ')';
      el.appendChild(flaw);
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
    var inner = h('div', 'cs-inner', [ZU.cardFace(def, opts.bind, opts)]);
    var box = h('div', 'cardstatic' + (opts.cls ? ' ' + opts.cls : ''), [h('div', 'cs-shadow'), inner]);
    ZU.tilt(box, inner);
    if (!opts.noTip) ZU.tip.bind(box, function () { return ZU.tip.card(def, opts.bind, opts); });
    return box;
  };

  ZU.trinketEl = function (id, extraTip) {
    var t = ZU.TRINKETS[id];
    var img = h('i', 'tk-img');
    img.style.backgroundImage = 'url(' + ZU.asset('trinkets/' + id + '.png') + ')';
    var el = h('div', 'trinket r' + t.rarity, [img]);
    el.dataset.id = id;
    ZU.tip.bind(el, function () { return ZU.tip.trinket(id, typeof extraTip === 'function' ? extraTip() : extraTip); });
    return el;
  };

  /* Animiertes Gegnerporträt: ein Sprite-Streifen mit sechs Ausdrücken (ZU.MOODS).
     setBase() legt die Grundstimmung fest, setMood() zeigt kurz eine Reaktion. */
  /* Privileg: wie ein Trinket, aber als rundes Siegel dargestellt. */
  ZU.perkEl = function (id) {
    var perk = ZU.PERKS[id];
    var img = h('i', 'tk-img');
    img.style.backgroundImage = 'url(' + ZU.asset('perks/' + id + '.png') + ')';
    var el = h('div', 'trinket perk', [img]);
    el.dataset.id = id;
    ZU.tip.bind(el, '<b>' + perk.name + '</b><i class="rar legendary">Privileg · gilt den ganzen Run</i><p>' + perk.text + '</p>');
    return el;
  };

  /* Füllt eine Leiste mit allem, was der Spieler trägt: erst Privilegien, dann Trinkets.
     Je mehr es sind, desto kleiner werden die Symbole. Liefert die Elemente nach Kennung. */
  /* Siegel als Symbol (Hinterzimmer, Esmes Pakete). */
  ZU.sealEl = function (id) {
    var img = h('i', 'tk-img');
    img.style.backgroundImage = 'url(' + ZU.asset('seals/' + id + '.png') + ')';
    var el = h('div', 'trinket seal', [img]);
    ZU.tip.bind(el, '<b>' + ZU.SEALS[id].name + '</b><i class="rar uncommon">Veredelung für normale Karten</i><p>' + ZU.SEALS[id].text + '</p>');
    return el;
  };

  /* Symbol eines dauerhaften Upgrades (assets/upgrades/<id>.png), im Rahmen der Privilegien. */
  ZU.upgradeEl = function (id) {
    var img = h('i', 'tk-img');
    img.style.backgroundImage = 'url(' + ZU.asset('upgrades/' + id + '.png') + ')';
    return h('div', 'trinket upgrade', [img]);
  };

  /* Schild „Hausordnung": fasst die festen Regeln eines Casinos zusammen; Antippen oder Überfahren zeigt sie alle. */
  ZU.houseChip = function (rules) {
    var chip = h('div', 'rulechip house', 'Hausordnung · ' + rules.length);
    ZU.tip.bind(chip, '<b>Hausordnung</b>' + rules.map(function (id) {
      return '<p><b>' + ZU.RULES[id].name + ':</b> ' + ZU.RULES[id].text + '</p>';
    }).join(''));
    return chip;
  };

  ZU.fillOwned = function (container, run, onTrinket) {
    var map = {}, perks = run.s.perks || [], trinkets = run.s.trinkets, total = perks.length + trinkets.length;
    container.innerHTML = '';
    container.classList.toggle('many', total > 6 && total <= 12);
    container.classList.toggle('lots', total > 12);
    perks.forEach(function (id) {
      map[id] = ZU.perkEl(id);
      container.appendChild(map[id]);
    });
    trinkets.forEach(function (id) {
      var el = ZU.trinketEl(id, onTrinket ? function () { return (ZU.app && ZU.app.isTouch() ? 'Antippen' : 'Klicken') + ': verkaufen'; } : null);
      if (onTrinket) {
        el.classList.add('clickable');
        el.addEventListener('click', function () { onTrinket(id); });
      }
      map[id] = el;
      container.appendChild(el);
    });
    if (!total) container.appendChild(h('div', 'trinket empty'));
    return map;
  };

  ZU.portraitEl = function (enemyId, cls) {
    var enemy = ZU.ENEMIES[enemyId];
    var img = h('i', 'pt-img');
    img.style.backgroundImage = 'url(' + ZU.asset('enemies/' + enemyId + '.png') + ')';
    var el = h('div', 'portrait ' + (cls || '') + ' k-' + enemy.kind, [h('div', 'pt-react', [h('div', 'pt-bob', [img])])]);
    el.style.setProperty('--pbg', enemy.bg);
    var base = 'idle', shown = 'idle', timer = null, blinkTimer = null, wasConnected = false;

    function show(mood) {
      shown = mood;
      var index = Math.max(0, ZU.MOODS.indexOf(mood));
      img.style.backgroundPosition = (index * 100 / (ZU.MOODS.length - 1)) + '% 100%';
      el.dataset.mood = mood;
    }
    function blink() {
      if (el.isConnected) wasConnected = true;
      else if (wasConnected) return; // Porträt wurde entfernt: Schleife beenden
      if (shown === 'idle' && el.isConnected) {
        show('blink');
        setTimeout(function () { if (shown === 'blink') show('idle'); }, 130);
      }
      blinkTimer = setTimeout(blink, 1800 + Math.random() * 3600);
    }
    el.setBase = function (mood) {
      base = mood;
      if (!timer) show(base);
    };
    el.setMood = function (mood, ms) {
      clearTimeout(timer);
      show(mood);
      ['idle', 'smug', 'angry', 'shocked', 'defeated'].forEach(function (m) { el.classList.remove('react-' + m); });
      void el.offsetWidth;
      el.classList.add('react-' + mood);
      timer = setTimeout(function () { timer = null; show(base); }, (ms || 1700) / ZU.speed);
    };
    show('idle');
    blinkTimer = setTimeout(blink, 900 + Math.random() * 2500);
    return el;
  };

  /* ---------- Vorladen: Bilder im Hintergrund holen, damit sie beim Erscheinen sofort da sind ---------- */
  var queue = [], loading = 0, done = {}, keep = [];
  var ready = {}, waiters = []; // ready: fertig geladen (oder endgültig fehlgeschlagen); waiters: wer darauf wartet
  function pump() {
    while (loading < 4 && queue.length) {
      var url = queue.shift();
      if (done[url]) continue;
      done[url] = true;
      keepSrc[url] = true;
      loading++;
      var image = new Image();
      image.onload = image.onerror = (function (url) {
        return function () {
          loading--;
          ready[url] = true;
          waiters.slice().forEach(function (check) { check(); });
          pump();
        };
      })(url);
      image.src = url;
      keep.push(image);
    }
  }
  /* Ist ein Bild schon da? */
  ZU.isLoaded = function (url) { return !!ready[url]; };
  /* Wartet, bis alle Bilder da sind (zieht sie in der Warteschlange nach vorn). onProgress(fertig, gesamt).
     Nach "timeout" Millisekunden geht es auch ohne den Rest weiter: Ein fehlendes Bild soll das Spiel nie aufhalten. */
  ZU.whenLoaded = function (urls, onProgress, timeout) {
    urls = urls.filter(function (url, i) { return urls.indexOf(url) === i; });
    return new Promise(function (resolve) {
      var finished = false, timer = null;
      function check() {
        var have = urls.filter(function (url) { return ready[url]; }).length;
        if (onProgress) onProgress(have, urls.length);
        if (have >= urls.length) end();
      }
      function end() {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        var at = waiters.indexOf(check);
        if (at >= 0) waiters.splice(at, 1);
        resolve();
      }
      waiters.push(check);
      // noch nicht angefragte Bilder nach vorn; bereits wartende ebenfalls vorziehen
      var missing = urls.filter(function (url) { return !ready[url]; });
      queue = queue.filter(function (url) { return missing.indexOf(url) < 0; });
      missing.forEach(function (url) { if (!keepSrc[url]) delete done[url]; });
      ZU.preload(missing, true);
      timer = setTimeout(end, timeout || 12000);
      check();
    });
  };
  var keepSrc = {};
  /* urgent = true stellt die Bilder an den Anfang der Warteschlange (z. B. die nächsten Gegner). */
  ZU.preload = function (urls, urgent) {
    urls = urls.filter(function (url) { return !done[url]; });
    queue = urgent ? urls.concat(queue) : queue.concat(urls);
    pump();
  };
  ZU.preloadEnemies = function (ids, urgent) {
    ZU.preload(ids.map(function (id) { return ZU.asset('enemies/' + id + '.png'); }), urgent);
  };
  /* Alles, was im Lauf eines Runs gebraucht wird – in der Reihenfolge, in der es voraussichtlich erscheint. */
  ZU.preloadAll = function () {
    var urls = [ZU.cardAtlas(), ZU.asset('manfred/manfred.png')];
    ZU.TRINKET_IDS.forEach(function (id) { urls.push(ZU.asset('trinkets/' + id + '.png')); });
    ZU.PERK_IDS.forEach(function (id) { urls.push(ZU.asset('perks/' + id + '.png')); });
    ZU.SPECIAL_IDS.forEach(function (id) { urls.push(ZU.asset('special/' + id + '.png')); });
    (ZU.CASINO_ART || []).forEach(function (path) { urls.push(ZU.asset(path)); });
    ZU.SEAL_IDS.concat(['flaw']).forEach(function (id) { urls.push(ZU.asset('seals/' + id + '.png')); });
    urls.push(ZU.asset('manfred/shop.png'));
    ['esme', 'room', 'pack-single', 'pack-double', 'pack-bag', 'tarot-back'].forEach(function (name) { urls.push(ZU.asset('esme/' + name + '.png')); });
    ZU.Meta.UPGRADE_IDS.forEach(function (id) { urls.push(ZU.asset('upgrades/' + id + '.png')); });
    ZU.BOSS_ACTS.forEach(function (act, index) {
      if (index === 0) ZU.BATTLE_POOL.concat(ZU.ELITE_POOL).forEach(function (id) { urls.push(ZU.asset('enemies/' + id + '.png')); });
      act.forEach(function (id) { urls.push(ZU.asset('enemies/' + id + '.png')); });
    });
    ZU.preload(urls, false);
  };

  /* ---------- Sprite: eine Karte auf dem Tisch, bewegt über gedämpfte Federn ---------- */
  var CW = 104, CH = 146;
  ZU.CARD_W = CW;
  ZU.CARD_H = CH;

  function Sprite(card, layer, x, y) {
    this.id = card.id;
    this.def = ZU.CARDS[card.def];
    this.bind = card.bind;
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

    this.seal = card.seal || null;
    this.flaw = card.flaw || null;
    this.flipEl = h('div', 'spr-flip', [ZU.cardFace(this.def, card.bind, card), ZU.cardBack()]);
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
