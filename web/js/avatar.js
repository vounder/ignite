/* Zündung – die eigene Figur: ein Brustbild aus übereinandergelegten Ebenen (assets/avatar/*.png, je 192×192).
   Reihenfolge: Körper (eingefärbt), Tattoos, Outfit, Gesicht (je Ausdruck), Haare (eingefärbt), Hut.
   Körper und Haare liegen in Graustufen vor und werden beim Zeichnen mit der gewählten Farbe multipliziert.
   Teile werden nicht gekauft, sondern erspielt: req = [Zählwerk, Schwelle, Hinweis] wie im Hinterzimmer. */
(function (ZU) {
  'use strict';
  var h = ZU.h, SIZE = 192;

  var PARTS = {
    skin: [
      { id: 'porzellan', name: 'Porzellan', color: '#f6dcc6' }, { id: 'sand', name: 'Sand', color: '#eec39a' },
      { id: 'honig', name: 'Honig', color: '#d9a066' }, { id: 'bronze', name: 'Bronze', color: '#b97a4a' },
      { id: 'kastanie', name: 'Kastanie', color: '#8a5632' }, { id: 'ebenholz', name: 'Ebenholz', color: '#5e3a22' }
    ],
    hair: [
      { id: 'none', name: 'Glatze' },
      { id: 'hair-1', name: 'Seitenscheitel' },
      { id: 'hair-2', name: 'Lockenkopf', req: ['duels', 5, 'Gewinne 5 Duelle.'] },
      { id: 'hair-3', name: 'Lange Mähne', req: ['chain', 8, 'Erreiche eine Kette von ×8.'] }
    ],
    hairColor: [
      { id: 'schwarz', name: 'Schwarz', color: '#3a2c26' }, { id: 'braun', name: 'Braun', color: '#8a5a34' }, { id: 'blond', name: 'Blond', color: '#e2b65a' },
      { id: 'rot', name: 'Rot', color: '#c2472a', req: ['burnt', 3, 'Fackle 3 Tische ab.'] },
      { id: 'grau', name: 'Silbergrau', color: '#b9b4ac', req: ['duels', 25, 'Gewinne 25 Duelle.'] },
      { id: 'weiss', name: 'Schlohweiß', color: '#f1ece2', req: ['casino', 2, 'Räume 2 Casinos aus.'] },
      { id: 'tuerkis', name: 'Türkis', color: '#4fc2ae', req: ['kniffe', 5, 'Lerne oder stufe 5 Kniffe.'] },
      { id: 'glut', name: 'Glutorange', color: '#ff8a2a', req: ['overkill', 2, 'Übertriff ein Glutziel um das Doppelte.'] }
    ],
    outfit: [
      { id: 'outfit-2', name: 'Unterhemd' },
      { id: 'outfit-1', name: 'Hemd und Weste', req: ['duels', 3, 'Gewinne 3 Duelle.'] },
      { id: 'outfit-3', name: 'Burgunder Anzug', req: ['casino', 1, 'Räume das erste Casino aus.'] }
    ],
    hat: [
      { id: 'none', name: 'Ohne Hut' },
      { id: 'hat-2', name: 'Schiebermütze', req: ['duels', 10, 'Gewinne 10 Duelle.'] },
      { id: 'hat-1', name: 'Fedora', req: ['foe:boss', 3, 'Schlage 3 Bosse.'] }
    ],
    tattoo: [
      { id: 'tattoo-1', name: 'Flamme am Hals', req: ['burnt', 5, 'Fackle 5 Tische ab.'] },
      { id: 'tattoo-2', name: 'Pik-Ass auf der Brust', req: ['aces', 25, 'Spiele 25 Asse.'] },
      { id: 'tattoo-3', name: 'Farbenband an der Schulter', req: ['chain', 10, 'Erreiche eine Kette von ×10.'] }
    ]
  };
  var TABS = [['skin', 'Haut'], ['hair', 'Frisur'], ['hairColor', 'Haarfarbe'], ['outfit', 'Outfit'], ['hat', 'Hut'], ['tattoo', 'Tattoos']];
  var DEFAULT = { skin: 'sand', hair: 'hair-1', hairColor: 'braun', outfit: 'outfit-2', hat: 'none', tattoo: [] };

  function find(kind, id) { return PARTS[kind].filter(function (p) { return p.id === id; })[0]; }
  function feat(meta, key) {
    if (key === 'foe:boss') return Object.keys(meta.defeated || {}).reduce(function (n, id) { return n + (ZU.ENEMIES[id] && ZU.ENEMIES[id].kind === 'boss' ? meta.defeated[id] : 0); }, 0);
    return ZU.Meta.feat(meta, key);
  }
  function unlocked(meta, part) { return !part.req || feat(meta, part.req[0]) >= part.req[1]; }

  /* Bringt eine gespeicherte Figur in Form: Unbekanntes und noch nicht Erspieltes fällt auf den Standard zurück. */
  function clean(raw, meta) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var out = {};
    ['skin', 'hair', 'hairColor', 'outfit', 'hat'].forEach(function (kind) {
      var part = find(kind, raw[kind]);
      out[kind] = part && (!meta || unlocked(meta, part)) ? part.id : DEFAULT[kind];
    });
    out.tattoo = (Array.isArray(raw.tattoo) ? raw.tattoo : []).filter(function (id, i, all) {
      var part = find('tattoo', id);
      return part && all.indexOf(id) === i && (!meta || unlocked(meta, part));
    });
    return out;
  }

  /* ---------- Bilder ---------- */
  var cache = {}, waiting = [];
  function image(name) {
    var item = cache[name];
    if (item) return item;
    item = cache[name] = { img: new Image(), ok: false, bad: false };
    item.img.onload = function () { item.ok = true; flush(); };
    item.img.onerror = function () { item.bad = true; flush(); };
    item.img.src = ZU.asset('avatar/' + name + '.png');
    return item;
  }
  function flush() { var list = waiting; waiting = []; list.forEach(function (fn) { fn(); }); }
  function layers(cfg, mood) {
    var list = [['body-a', find('skin', cfg.skin).color]];
    cfg.tattoo.forEach(function (id) { list.push([id]); });
    list.push([cfg.outfit]);
    list.push(['face-' + mood]);
    // Unter einem Hut verschwindet das Haar dort, wo die Hutmaske deckt (assets/avatar/<hut>-hairmask.png).
    if (cfg.hair !== 'none') list.push([cfg.hair, find('hairColor', cfg.hairColor).color, cfg.hat !== 'none' ? cfg.hat + '-hairmask' : null]);
    if (cfg.hat !== 'none') list.push([cfg.hat]);
    return list;
  }
  var scratch = null;
  /* Zeichnet eine Ebene; mit Farbe wird das Graustufenbild multipliziert und auf seine eigene Form beschnitten. */
  function drawLayer(ctx, img, color, mask) {
    if (!color) { ctx.drawImage(img, 0, 0, SIZE, SIZE); return; }
    scratch = scratch || document.createElement('canvas');
    scratch.width = scratch.height = SIZE;
    var s = scratch.getContext('2d');
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, SIZE, SIZE);
    s.drawImage(img, 0, 0, SIZE, SIZE);
    s.globalCompositeOperation = 'multiply';
    s.fillStyle = color;
    s.fillRect(0, 0, SIZE, SIZE);
    s.globalCompositeOperation = 'destination-in';
    s.drawImage(img, 0, 0, SIZE, SIZE);
    if (mask) { s.globalCompositeOperation = 'destination-out'; s.drawImage(mask, 0, 0, SIZE, SIZE); }
    ctx.drawImage(scratch, 0, 0);
  }
  function paint(canvas, cfg, mood) {
    var list = layers(cfg, mood), items = list.map(function (l) { return image(l[0]); });
    var masks = list.map(function (l) { return l[2] ? image(l[2]) : null; });
    if (masks.some(function (it) { return it && !it.ok && !it.bad; })) items.push({ ok: false, bad: false });
    if (items.some(function (it) { return !it.ok && !it.bad; })) { waiting.push(function () { if (canvas._want === mood + JSON.stringify(cfg)) paint(canvas, cfg, mood); }); return; }
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    list.forEach(function (l, i) { if (items[i].ok) drawLayer(ctx, items[i].img, l[1], masks[i] && masks[i].ok ? masks[i].img : null); });
  }

  /* Porträt der eigenen Figur mit denselben Griffen wie ZU.portraitEl: setMood(mood, ms), setBase(mood), setConfig(cfg). */
  function el(cfg, cls) {
    var canvas = h('canvas', 'pt-img av-canvas', null, { width: String(SIZE), height: String(SIZE) });
    var box = h('div', 'portrait avatar ' + (cls || ''), [h('div', 'pt-react', [h('div', 'pt-bob', [canvas])])]);
    var base = 'idle', shown = '', timer = null, blinkTimer = null, seen = false;
    function show(mood) {
      shown = mood;
      canvas._want = mood + JSON.stringify(cfg);
      box.dataset.mood = mood;
      paint(canvas, cfg, mood);
    }
    function blink() {
      if (box.isConnected) seen = true; else if (seen) return;
      if (shown === 'idle' && box.isConnected) { show('blink'); setTimeout(function () { if (shown === 'blink') show('idle'); }, 130); }
      blinkTimer = setTimeout(blink, 2000 + Math.random() * 3800);
    }
    box.setMood = function (mood, ms) {
      clearTimeout(timer);
      show(mood);
      if (ms) timer = setTimeout(function () { show(base); }, ms);
    };
    box.setBase = function (mood) { base = mood; if (!timer || shown === 'blink' || shown === 'idle') show(mood); };
    box.setConfig = function (next) { cfg = next; show(shown === 'blink' ? 'idle' : shown || base); };
    show('idle');
    blinkTimer = setTimeout(blink, 1500 + Math.random() * 2500);
    return box;
  }

  /* ---------- Editor ---------- */
  function screen(game, root) {
    ZU.bg.set('shop');
    ZU.audio.music('menu');
    var meta = ZU.Meta.get(), cfg = clean(game.profile.avatar, meta), tab = game.avatarTab || 'hair';
    var preview = el(cfg, 'huge'), grid = h('div', 'av-grid'), tabsEl = h('div', 'br-subtabs'), info = h('div', 'av-info');
    var moods = ['idle', 'smug', 'angry', 'shocked', 'defeated'], moodNames = { idle: 'Ruhig', smug: 'Hämisch', angry: 'Verärgert', shocked: 'Erschrocken', defeated: 'Geschlagen' };
    var moodRow = h('div', 'av-moods', moods.map(function (m) {
      return ZU.btn(moodNames[m], 'small', function () { preview.setBase(m); preview.setMood(m); });
    }));
    function save() {
      game.profile.avatar = cfg;
      game.saveProfile();
      preview.setConfig(cfg);
    }
    function chosen(kind, id) { return kind === 'tattoo' ? cfg.tattoo.indexOf(id) >= 0 : cfg[kind] === id; }
    function choose(kind, id) {
      if (kind === 'tattoo') {
        var at = cfg.tattoo.indexOf(id);
        if (at >= 0) cfg.tattoo.splice(at, 1); else cfg.tattoo.push(id);
      } else cfg[kind] = id;
      ZU.audio.select(true);
      save();
      render();
    }
    function sample(kind, part) {
      if (kind === 'skin' || kind === 'hairColor') { var sw = h('i', 'av-swatch'); sw.style.background = part.color; return sw; }
      var copy = JSON.parse(JSON.stringify(cfg));
      if (kind === 'tattoo') { copy.tattoo = [part.id]; copy.outfit = 'outfit-2'; copy.hat = 'none'; } else copy[kind] = part.id;
      return el(copy, 'av-mini');
    }
    function render() {
      tabsEl.innerHTML = '';
      TABS.forEach(function (pair) {
        var open = PARTS[pair[0]].filter(function (p) { return unlocked(meta, p); }).length;
        tabsEl.appendChild(ZU.btn(pair[1] + ' ' + open + '/' + PARTS[pair[0]].length, 'small' + (pair[0] === tab ? ' on' : ''), function () { tab = game.avatarTab = pair[0]; render(); }));
      });
      grid.innerHTML = '';
      PARTS[tab].forEach(function (part) {
        var open = unlocked(meta, part);
        var tile = h('div', 'br-tile av-tile ' + (open ? 'open' : 'hidden') + (open && chosen(tab, part.id) ? ' sel' : ''), [
          open ? sample(tab, part) : h('i', 'av-lock', '?'),
          h('div', 'br-name', open ? part.name : '?????'),
          h('div', 'br-open' + (open ? '' : ' dim'), open ? (chosen(tab, part.id) ? 'Gewählt' : '') : part.req[2])
        ]);
        if (open) tile.addEventListener('click', function () { choose(tab, part.id); });
        grid.appendChild(tile);
      });
      info.textContent = tab === 'tattoo' ? 'Tattoos lassen sich kombinieren. Unter manchem Outfit sind sie nicht zu sehen.'
        : 'Neue Teile erspielst du dir – sie kosten keine Asche. Unter ????? steht, was dafür zu tun ist.';
    }
    render();
    root.appendChild(h('div', 'screen backroom avatar-screen', [
      h('div', 'br-head', [ZU.btn('Zurück', 'felt', function () { game.toMenu(); }), h('h1', null, 'Deine Figur')]),
      h('div', 'av-body', [
        h('div', 'av-left', [preview, moodRow]),
        h('div', 'av-right', [tabsEl, grid, info])
      ])
    ]));
  }

  ZU.avatar = { PARTS: PARTS, DEFAULT: DEFAULT, clean: clean, el: el, unlocked: unlocked, screen: screen,
    /* Alle Bilder, die diese Figur braucht (zum Vorladen). */
    urls: function (cfg) {
      var names = {};
      ZU.MOODS.forEach(function (mood) { layers(cfg, mood).forEach(function (l) { names[l[0]] = true; if (l[2]) names[l[2]] = true; }); });
      return Object.keys(names).map(function (n) { return ZU.asset('avatar/' + n + '.png'); });
    } };
  if (ZU.screens) ZU.screens.avatar = screen;
})(window.ZU);
