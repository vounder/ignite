/* Zündung – Szenen der Geschichte abspielen (Daten: js/story.js).
   Eine Szene liegt als eigene Ebene über dem Bildschirm: Kulisse, bis zu zwei Figuren, Textfeld. Ein Tipp (oder
   Leertaste/Enter) zeigt erst die ganze Zeile, dann die nächste; „Überspringen" (Esc) beendet die Szene.
   Jede Szene läuft von selbst nur einmal; in der Chronik (Hauptmenü) lässt sich Gesehenes wieder ansehen.

   Vertonung: Liegt für eine Zeile eine Aufnahme vor (ZU.VOICE_FILES, siehe js/voice-manifest.js), wird sie abgespielt;
   sonst ruft die Figur wie am Kartentisch nur ihren Laut. */
(function (ZU) {
  'use strict';

  var h = ZU.h;
  var MANFRED = ['idle', 'blink', 'talk', 'grin', 'annoyed', 'surprised', 'hat', 'coin', 'match', 'cards', 'side', 'wink'];
  var ESME = ['idle', 'blink', 'greedy', 'annoyed', 'surprised', 'dreamy'];
  var BARK = { idle: 'greet', smug: 'smug', angry: 'angry', shocked: 'shocked', defeated: 'lose' };
  var active = null;

  function art(path) { return ZU.asset(path + '.png'); }
  function sheet(who) {
    if (who === 'manfred') return { url: ZU.asset('manfred/manfred.png'), frames: MANFRED, cls: 'tall' };
    if (who === 'esme') return { url: ZU.asset('esme/esme.png'), frames: ESME, cls: 'tall' };
    return { url: ZU.asset('enemies/' + who + '.png'), frames: ZU.MOODS, cls: '' };
  }

  /* Eine Figur auf der Bühne: Bildstreifen mit Stimmungen, blinzelt, bewegt beim Sprechen den Mund bzw. wippt. */
  function actor(who, shade) {
    var spec = sheet(who), img = h('i', 'cs-img');
    var el = h('div', 'cs-actor ' + spec.cls + (shade ? ' shade' : ''), [img]);
    img.style.backgroundImage = 'url(' + spec.url + ')';
    img.style.backgroundSize = (spec.frames.length * 100) + '% 100%';
    var base = 'idle', shown = '', talking = false, timer = null, dead = false;
    function show(name) {
      var at = spec.frames.indexOf(name);
      if (at < 0) at = 0;
      shown = spec.frames[at];
      img.style.backgroundPosition = (at * 100 / (spec.frames.length - 1)) + '% 0';
    }
    function tick() {
      if (dead) return;
      var next = 1600 + Math.random() * 2600;
      if (talking && who === 'manfred') {
        // Manfred hat ein eigenes Bild mit offenem Mund
        show(shown === 'talk' ? base : 'talk');
        next = 140;
      } else if (shown === 'blink') {
        show(base);
        next = 1800 + Math.random() * 3000;
      } else if (!talking && shown === base && spec.frames.indexOf('blink') >= 0 && Math.random() < 0.7) {
        show('blink');
        next = 130;
      } else if (shown !== base) {
        show(base);
      }
      timer = setTimeout(tick, next);
    }
    show(base);
    timer = setTimeout(tick, 900 + Math.random() * 1500);
    return {
      who: who, el: el,
      mood: function (name) { base = spec.frames.indexOf(name) >= 0 ? name : 'idle'; show(base); },
      talk: function (on) {
        talking = !!on;
        el.classList.toggle('talk', talking);
        clearTimeout(timer);
        if (!talking) show(base);
        timer = setTimeout(tick, talking ? 120 : 1200);
      },
      stop: function () { dead = true; clearTimeout(timer); }
    };
  }

  function profile() { return ZU.Profile.load(); }

  var story = {
    /* Sind die Szenen eingeschaltet? (Einstellung „Geschichte") */
    enabled: function () { var s = profile().settings; return s.story !== false; },
    seen: function (id) { var p = profile(); return !!(p.story && p.story[id]); },
    mark: function (id) {
      var p = profile();
      if (p.story && p.story[id]) return;
      p.story = p.story || {};
      p.story[id] = 1;
      ZU.Profile.save(p);
      if (ZU.game) ZU.game.profile = p;
    },
    isActive: function () { return !!active; },

    /* Bilder, die eine Szene braucht. */
    urls: function (id) {
      var def = ZU.STORY[id], urls = [], seen = {};
      if (!def) return urls;
      function add(url) { if (!seen[url]) { seen[url] = true; urls.push(url); } }
      if (def.bg) add(art(def.bg));
      def.steps.forEach(function (step) {
        if (step[0] === 'bg') add(art(step[1]));
        if (step[0] === 'in') add(sheet(step[1]).url);
      });
      return urls;
    },

    /* Spielt die Szene, wenn sie noch nicht gelaufen ist. Liefert ein Versprechen, das sich danach (oder sofort) einlöst.
       Ist die Geschichte ausgeschaltet, gilt die Szene trotzdem als gesehen – sie steht dann in der Chronik bereit. */
    maybe: function (id) {
      if (!ZU.STORY[id] || story.seen(id)) return Promise.resolve(false);
      story.mark(id);
      if (!story.enabled()) return Promise.resolve(false);
      return story.play(id);
    },

    /* Spielt eine Szene ab (auch erneut, aus der Chronik). */
    play: function (id) {
      var def = ZU.STORY[id];
      if (!def || active) return Promise.resolve(false);
      active = { id: id }; // sofort belegen: Während geladen wird, startet keine zweite
      var urls = story.urls(id);
      return ZU.boot.wait(urls, { cover: true, hold: 260 }).then(function () { return run(def); }).then(function () { return true; });
    }
  };

  function run(def) {
    return new Promise(function (resolve) {
      var stage = document.getElementById('stage'), lines = {}, fxEls = [];
      ZU.storyLines(def.id).forEach(function (line) { lines[line.step] = line; });
      var bgA = h('div', 'cs-bg'), bgB = h('div', 'cs-bg'), front = bgA;
      var slots = { l: h('div', 'cs-slot l'), r: h('div', 'cs-slot r') }, cast = { l: null, r: null };
      var nameEl = h('div', 'cs-name'), textEl = h('div', 'cs-text'), nextEl = h('i', 'cs-next');
      var box = h('div', 'cs-box hidden', [nameEl, textEl, nextEl]);
      var cardEl = h('div', 'cs-card hidden'), newsEl = h('div', 'cs-news hidden');
      var skip = h('button', 'cs-skip', 'Überspringen ▸▸');
      var root = h('div', 'cutscene', [h('div', 'cs-bgs', [bgA, bgB]), h('div', 'cs-shade'), slots.l, slots.r, cardEl, newsEl, box, skip, h('i', 'cs-bar top'), h('i', 'cs-bar bottom')]);
      var index = -1, typing = null, full = '', waiting = false, done = false, autoTimer = null;
      var before = ZU.audio.playing ? ZU.audio.playing() : null;

      function setBg(path, instant) {
        var back = front === bgA ? bgB : bgA;
        back.style.backgroundImage = 'url(' + art(path) + ')';
        back.classList.add('on');
        front.classList.remove('on');
        front = back;
        if (instant) { bgA.style.transition = bgB.style.transition = 'none'; void root.offsetWidth; bgA.style.transition = bgB.style.transition = ''; }
      }
      function leave(side) {
        var a = cast[side];
        if (!a) return;
        cast[side] = null;
        a.stop();
        a.el.classList.add('out');
        setTimeout(function () { a.el.remove(); }, 320);
      }
      function enter(who, side, shade) {
        ['l', 'r'].forEach(function (s) { if (cast[s] && cast[s].who === who) leave(s); });
        leave(side);
        var a = actor(who, shade === 'shade');
        cast[side] = a;
        slots[side].appendChild(a.el);
        void a.el.offsetWidth;
        a.el.classList.add('on');
      }
      function find(who) { return cast.l && cast.l.who === who ? cast.l : cast.r && cast.r.who === who ? cast.r : null; }
      function spotlight(who) {
        ['l', 'r'].forEach(function (s) {
          var a = cast[s];
          if (!a) return;
          a.el.classList.toggle('dim', who !== a.who);
          a.talk(who === a.who);
        });
      }
      function stopTyping() {
        if (typing) { clearInterval(typing); typing = null; }
        textEl.textContent = full;
        nextEl.classList.add('on');
        ['l', 'r'].forEach(function (s) { if (cast[s]) cast[s].talk(false); });
      }
      function type(text) {
        full = text;
        var shown = 0, cps = 46 * (ZU.speed || 1);
        textEl.textContent = '';
        nextEl.classList.remove('on');
        clearInterval(typing);
        typing = setInterval(function () {
          shown = Math.min(full.length, shown + Math.max(1, Math.round(cps / 30)));
          textEl.textContent = full.slice(0, shown);
          if (shown >= full.length) stopTyping();
        }, 33);
      }
      /* Aufnahme der Zeile, falls vorhanden – sonst der Laut der Figur. */
      function voice(line, who, mood) {
        var key = 'story/' + line.id, files = ZU.VOICE_FILES || {};
        if (files[key] && files[key] === ZU.textHash(line.text)) { ZU.audio.line(ZU.asset('voice/' + key + '.mp3')); return; }
        ZU.audio.line(null);
        if (ZU.VOICES[who]) ZU.audio.voice(who, BARK[mood] || 'greet');
      }
      function say(step, line) {
        var who = step[0], narr = who === 'n';
        cardEl.classList.add('hidden');
        newsEl.classList.add('hidden');
        box.classList.remove('hidden');
        box.classList.toggle('narr', narr);
        nameEl.textContent = narr ? '' : ZU.storyName(who, def);
        nameEl.style.setProperty('--tag', !narr && ZU.ENEMIES[who] ? ZU.ENEMIES[who].bg : who === 'esme' ? '#4a2a66' : '#7c1f1c');
        var a = narr ? null : find(who);
        if (a) a.mood(step[2] || 'idle');
        spotlight(narr ? null : who);
        type(step[1]);
        voice(line, who, step[2] || 'idle');
        waiting = true;
      }
      function news(step, line) {
        box.classList.add('hidden');
        spotlight(null);
        newsEl.innerHTML = '';
        newsEl.appendChild(h('div', 'cs-paper', [
          h('div', 'cs-mast', [h('span', null, 'Extrablatt'), h('b', null, 'Stadt-Anzeiger'), h('span', null, '10 Pfennig')]),
          h('h3', null, step[1]),
          h('p', null, step[2] || ''),
          h('div', 'cs-cols', [h('i'), h('i'), h('i')])
        ]));
        newsEl.classList.remove('hidden');
        void newsEl.offsetWidth;
        newsEl.classList.add('on');
        ZU.audio.whoosh();
        var key = 'story/' + line.id, files = ZU.VOICE_FILES || {};
        if (files[key] && files[key] === ZU.textHash(line.text)) ZU.audio.line(ZU.asset('voice/' + key + '.mp3'));
        else ZU.audio.voice('newsboy', 'greet');
        full = '';
        waiting = true;
      }
      function card(step) {
        box.classList.add('hidden');
        cardEl.innerHTML = '';
        cardEl.appendChild(h('small', null, step[1]));
        cardEl.appendChild(h('b', null, step[2]));
        cardEl.classList.remove('hidden', 'on');
        void cardEl.offsetWidth;
        cardEl.classList.add('on');
        waiting = true;
        autoTimer = setTimeout(function () { if (waiting) advance(); }, 2600);
      }
      function effect(kind) {
        if (kind === 'flash') {
          var f = h('i', 'cs-flash');
          root.appendChild(f);
          fxEls.push(f);
          setTimeout(function () { f.remove(); }, 900);
          ZU.audio.ignite();
          ZU.fx.shake(10);
        } else if (kind === 'shake') {
          ZU.fx.shake(8);
        } else if (kind === 'embers') {
          ZU.fx.burst(640, 520, { n: 50, speed: 380, grav: -300, life: 1.6, colors: ['#fff3c4', '#ffd75e', '#f08a24', '#d2452f'] });
        }
      }
      function advance() {
        if (done) return;
        clearTimeout(autoTimer);
        if (typing) { stopTyping(); return; }
        waiting = false;
        cardEl.classList.remove('on');
        newsEl.classList.remove('on');
        while (!waiting && !done) {
          index++;
          var step = def.steps[index];
          if (!step) { finish(); return; }
          var kind = step[0];
          if (kind === 'bg') setBg(step[1]);
          else if (kind === 'in') enter(step[1], step[2] || 'r', step[3]);
          else if (kind === 'out') { ['l', 'r'].forEach(function (s) { if (cast[s] && cast[s].who === step[1]) leave(s); }); }
          else if (kind === 'fx') effect(step[1]);
          else if (kind === 'card') card(step);
          else if (kind === 'news') news(step, lines[index]);
          else say(step, lines[index]);
        }
      }
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(autoTimer);
        clearInterval(typing);
        ZU.audio.line(null);
        window.removeEventListener('keydown', onKey, true);
        root.classList.add('leave');
        if (before !== undefined) ZU.audio.music(before);
        setTimeout(function () {
          ['l', 'r'].forEach(function (s) { if (cast[s]) cast[s].stop(); });
          root.remove();
          active = null;
          resolve();
        }, 420);
      }
      function onKey(ev) {
        if (ZU.modal.isOpen()) return;
        ev.stopPropagation();
        if (ev.code === 'Escape') { finish(); return; }
        if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'ArrowRight') { ev.preventDefault(); if (!ev.repeat) advance(); }
      }
      root.addEventListener('click', function () { ZU.audio.unlock(); advance(); });
      skip.addEventListener('click', function (ev) { ev.stopPropagation(); ZU.audio.click(); finish(); });
      window.addEventListener('keydown', onKey, true);

      ZU.tip.hide();
      stage.insertBefore(root, document.getElementById('fxcanvas'));
      if (def.bg) setBg(def.bg, true);
      ZU.audio.music('story');
      void root.offsetWidth;
      root.classList.add('on');
      setTimeout(advance, 450);
    });
  }

  /* ---------- Chronik: gesehene Szenen noch einmal ansehen ---------- */
  story.archive = function () {
    var list = h('div', 'chronik'), total = 0, got = 0;
    ZU.STORY_CHAPTERS.forEach(function (chapter, n) {
      var rows = chapter.scenes.filter(function (id) { return ZU.STORY[id]; }).map(function (id) {
        var seen = story.seen(id);
        total++;
        if (seen) got++;
        var row = h('button', 'chr-row' + (seen ? '' : ' locked'), [h('i', null, seen ? '▸' : '·'), h('span', null, seen ? ZU.STORY[id].title : '?????')]);
        if (seen) row.addEventListener('click', function () { ZU.audio.click(); ZU.modal.closeAll(); story.play(id).then(function () { story.archive(); }); });
        else row.disabled = true;
        return row;
      });
      list.appendChild(h('div', 'chr-chapter', [h('h3', null, (chapter.casino ? ZU.roman(n) + ' · ' : '') + chapter.title), h('div', 'chr-rows', rows)]));
    });
    ZU.modal.open([
      h('h2', null, 'Chronik'),
      h('div', 'chr-sub', 'Hundert Jahre Glück · ' + got + ' von ' + total + ' Szenen gesehen'),
      list,
      h('div', 'btnrow', [ZU.btn('Schließen', 'felt', function () { ZU.modal.closeAll(); })])
    ], { cls: 'chronik-modal' });
  };

  ZU.story = story;
})(window.ZU = window.ZU || {});
