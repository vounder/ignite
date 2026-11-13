/* Zündung – die eigene Figur: ein Brustbild aus übereinandergelegten Ebenen (assets/avatar/*.png, je 192×192).
   Reihenfolge: Körper (eingefärbt), Tattoos, Outfit, Gesicht (je Ausdruck), Haare (eingefärbt), Hut.
   Körper, Gesichtsschatten und Haare liegen in fünf Graustufen vor (16 Kontur, 96 tiefer Schatten, 152 Schatten,
   208 Grundton, 248 Glanzlicht); beim Zeichnen wird jede Stufe durch die Farbe einer Rampe ersetzt (ramp), damit
   Schatten wie bei den Gegnerporträts in den Farbton kippen statt nur dunkler zu werden.
   Teile werden nicht gekauft, sondern erspielt: req = [Zählwerk, Schwelle, Hinweis] wie im Hinterzimmer. */
(function (ZU) {
  'use strict';
  var h = ZU.h, SIZE = 192;

  var PARTS = {
    skin: [
      { id: 'porzellan', name: 'Porzellan', color: '#fcc8a4', ramp: ['#3a1410', '#d07a5a', '#eaa07c', '#fcc8a4', '#ffe8d0'] },
      { id: 'sand', name: 'Sand', color: '#fcb070', ramp: ['#38100c', '#d86a3c', '#ea8a50', '#fcb070', '#fdd8a4'] },
      { id: 'honig', name: 'Honig', color: '#fc9d52', ramp: ['#370c09', '#d75a2b', '#e47339', '#fc9d52', '#fdc88a'] },
      { id: 'bronze', name: 'Bronze', color: '#de7e3e', ramp: ['#300a08', '#a8401e', '#c45c2a', '#de7e3e', '#f4a868'] },
      { id: 'kastanie', name: 'Kastanie', color: '#b0562a', ramp: ['#260806', '#6e2814', '#8e3c1c', '#b0562a', '#d27e48'] },
      { id: 'ebenholz', name: 'Ebenholz', color: '#783620', ramp: ['#1a0606', '#3e160e', '#5a2414', '#783620', '#a05834'] }
    ],
    hair: [
      { id: 'none', name: 'Glatze' },
      { id: 'hair-1', name: 'Seitenscheitel' },
      { id: 'hair-2', name: 'Lockenkopf', req: ['duels', 5, 'Gewinne 5 Duelle.'] },
      { id: 'hair-3', name: 'Lange Mähne', req: ['chain', 8, 'Erreiche eine Kette von ×8.'] }
    ],
    hairColor: [
      { id: 'schwarz', name: 'Schwarz', color: '#40343a', ramp: ['#0c080c', '#181218', '#2a2028', '#40343a', '#74626a'] },
      { id: 'braun', name: 'Braun', color: '#a33d16', ramp: ['#2e080d', '#420c0e', '#741d11', '#a33d16', '#dc7021'] },
      { id: 'blond', name: 'Blond', color: '#f6b848', ramp: ['#3a1a08', '#a85a18', '#d88a28', '#f6b848', '#ffe08a'] },
      { id: 'rot', name: 'Rot', color: '#e44a22', ramp: ['#30060a', '#7a1010', '#b8241a', '#e44a22', '#ff8a40'], req: ['burnt', 3, 'Fackle 3 Tische ab.'] },
      { id: 'grau', name: 'Silbergrau', color: '#b8b6ba', ramp: ['#1c1a22', '#56545e', '#8a8892', '#b8b6ba', '#e8e6e4'], req: ['duels', 25, 'Gewinne 25 Duelle.'] },
      { id: 'weiss', name: 'Schlohweiß', color: '#f0ece8', ramp: ['#2a2630', '#9a94a2', '#cac6cc', '#f0ece8', '#ffffff'], req: ['casino', 2, 'Räume 2 Casinos aus.'] },
      { id: 'tuerkis', name: 'Türkis', color: '#3cc2a8', ramp: ['#081e1e', '#0e4a44', '#1a8274', '#3cc2a8', '#a0f4dc'], req: ['kniffe', 5, 'Lerne oder stufe 5 Kniffe.'] },
      { id: 'glut', name: 'Glutorange', color: '#ff8a1e', ramp: ['#300a04', '#a02808', '#e0500e', '#ff8a1e', '#ffd060'], req: ['overkill', 2, 'Übertriff ein Glutziel um das Doppelte.'] }
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
  /* Ebenen von unten nach oben: [Bild, Rampe oder null, Maske oder null]. */
  function layers(cfg, mood) {
    var skin = find('skin', cfg.skin).ramp, list = [['body-a', skin]];
    cfg.tattoo.forEach(function (id) { list.push([id]); });
    list.push([cfg.outfit]);
    list.push(['face-' + mood + '-skin', skin]);
    list.push(['face-' + mood]);
    // Unter einem Hut verschwindet das Haar dort, wo die Hutmaske deckt (assets/avatar/<hut>-hairmask.png).
    if (cfg.hair !== 'none') list.push([cfg.hair, find('hairColor', cfg.hairColor).ramp, cfg.hat !== 'none' ? cfg.hat + '-hairmask' : null]);
    if (cfg.hat !== 'none') list.push([cfg.hat]);
    return list;
  }
  /* Graustufen-Ebene in die Farben einer Rampe umsetzen; das Ergebnis wird je Bild und Rampe aufgehoben. */
  var tinted = {};
  function rgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
  function ramped(name, img, ramp) {
    var key = name + '|' + ramp.join(''), done = tinted[key];
    if (done) return done;
    var c = document.createElement('canvas');
    c.width = c.height = SIZE;
    var x = c.getContext('2d');
    x.drawImage(img, 0, 0, SIZE, SIZE);
    try {
      var data = x.getImageData(0, 0, SIZE, SIZE), px = data.data, cols = ramp.map(rgb);
      for (var i = 0; i < px.length; i += 4) {
        if (!px[i + 3]) continue;
        var l = px[i], col = cols[l < 56 ? 0 : l < 124 ? 1 : l < 180 ? 2 : l < 228 ? 3 : 4];
        px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2];
      }
      x.putImageData(data, 0, 0);
    } catch (e) { /* ohne Pixelzugriff bleibt die Ebene grau */ }
    tinted[key] = c;
    return c;
  }
  var scratch = null;
  function drawLayer(ctx, name, img, ramp, mask) {
    var src = ramp ? ramped(name, img, ramp) : img;
    if (!mask) { ctx.drawImage(src, 0, 0, SIZE, SIZE); return; }
    scratch = scratch || document.createElement('canvas');
    scratch.width = scratch.height = SIZE;
    var s = scratch.getContext('2d');
    s.globalCompositeOperation = 'source-over';
    s.clearRect(0, 0, SIZE, SIZE);
    s.drawImage(src, 0, 0, SIZE, SIZE);
    s.globalCompositeOperation = 'destination-out';
    s.drawImage(mask, 0, 0, SIZE, SIZE);
    ctx.drawImage(scratch, 0, 0);
  }
  function paint(canvas, cfg, mood) {
    var list = layers(cfg, mood), items = list.map(function (l) { return image(l[0]); });
    var masks = list.map(function (l) { return l[2] ? image(l[2]) : null; });
    var pending = items.concat(masks).some(function (it) { return it && !it.ok && !it.bad; });
    if (pending) { waiting.push(function () { if (canvas._want === mood + JSON.stringify(cfg)) paint(canvas, cfg, mood); }); return; }
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    list.forEach(function (l, i) { if (items[i].ok) drawLayer(ctx, l[0], items[i].img, l[1], masks[i] && masks[i].ok ? masks[i].img : null); });
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
