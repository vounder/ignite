/* Zündung – Hintergrund: verpixelter Rauch mit aufsteigenden Glutfunken als WebGL-Shader.
   Die Farbwelt wechselt weich je Szene (Tisch, Elite, Boss, Laden …). */
(function (ZU) {
  'use strict';

  var PALETTES = {
    menu: { a: [0.10, 0.05, 0.04], b: [0.33, 0.11, 0.08], c: [0.95, 0.52, 0.14], heat: 0.55 },
    select: { a: [0.07, 0.07, 0.06], b: [0.22, 0.14, 0.08], c: [0.80, 0.56, 0.22], heat: 0.3 },
    battle: { a: [0.03, 0.12, 0.10], b: [0.08, 0.30, 0.23], c: [0.42, 0.62, 0.36], heat: 0.2 },
    elite: { a: [0.05, 0.08, 0.14], b: [0.12, 0.24, 0.36], c: [0.86, 0.62, 0.26], heat: 0.35 },
    boss: { a: [0.13, 0.03, 0.03], b: [0.42, 0.08, 0.07], c: [1.0, 0.50, 0.12], heat: 0.8 },
    shop: { a: [0.11, 0.06, 0.03], b: [0.34, 0.19, 0.08], c: [0.93, 0.72, 0.30], heat: 0.3 },
    win: { a: [0.14, 0.08, 0.02], b: [0.55, 0.30, 0.06], c: [1.0, 0.86, 0.40], heat: 1.0 },
    lose: { a: [0.04, 0.04, 0.05], b: [0.13, 0.13, 0.15], c: [0.38, 0.36, 0.36], heat: 0.05 }
  };

  var VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
  var FRAG = [
    // Handy-Grafikchips rechnen "mediump" nur mit 16 Bit: Das Rauschen (hash) fiele dort auf 0 und der Rauch bliebe schwarz.
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes; uniform float uTime; uniform float uPix; uniform float uHeat; uniform float uEmber;',
    'uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), f.x), f.y); }',
    'float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i=0;i<4;i++){ v += a*noise(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }',
    'void main(){',
    '  vec2 px = floor(gl_FragCoord.xy / uPix) * uPix;',
    '  vec2 uv = (px - 0.5*uRes) / uRes.y;',
    '  float t = uTime * 0.045;',
    '  vec2 q = vec2(fbm(uv*1.5 + vec2(0.0, -t*2.2)), fbm(uv*1.5 + vec2(5.2, 1.3 - t*1.6)));',
    '  vec2 r = vec2(fbm(uv*2.1 + 2.6*q + vec2(1.7, 9.2) + t), fbm(uv*2.1 + 2.6*q + vec2(8.3, 2.8) - t*0.7));',
    '  float f = fbm(uv*1.7 + 2.4*r + vec2(0.0, -t));',
    '  f = f + 0.22*(r.x - 0.5) - 0.20*uv.y;',
    '  float band = floor(f*9.0)/9.0;',
    '  vec3 col = mix(uA, uB, smoothstep(0.22, 0.66, band));',
    '  col = mix(col, uC, smoothstep(0.60, 0.92, band) * (0.25 + 0.6*uHeat));',
    '  float glow = smoothstep(0.75, -0.55, uv.y);',
    '  col += uC * glow * glow * 0.10 * uHeat;',
    '  vec2 cell = vec2(uPix*2.0);',
    '  vec2 ep = vec2(px.x + sin(px.y*0.04 + uTime*0.4)*4.0, px.y - uTime*(9.0 + 7.0*uHeat));',
    '  vec2 id = floor(ep / cell);',
    '  float h = hash(id);',
    '  float tw = 0.5 + 0.5*sin(uTime*(1.5 + h*5.0) + h*40.0);',
    // Glutfunken: Zahl und Helligkeit hängen an uEmber (früh im Casino wenige und matte, im letzten Akt volle Glut)
    '  float ember = step(1.0 - 0.006*(0.4 + uHeat)*uEmber, h) * tw;',
    '  col += mix(uC, vec3(1.0, 0.92, 0.6), 0.5) * ember * (0.4 + 0.45*uEmber);',
    '  float vig = smoothstep(1.25, 0.35, length(uv*vec2(0.82, 1.0)));',
    '  col *= 0.42 + 0.58*vig;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var gl, canvas, uniforms = {}, cur = clone(PALETTES.menu), target = PALETTES.menu, flash = 0, enabled = true, lost = false;
  var ember = 0.4, emberTo = 0.4; // Stärke der Glutfunken, 0 bis 1
  var scene = 'menu', theme = null; // theme: Farbwelt des Casinos, in dem gerade gespielt wird
  var THEME_WEIGHT = 0.68;

  /* Farben einer Szene, eingefärbt in die Farbwelt des Casinos. Die Szene bestimmt weiter Helligkeit und Hitze
     (ein Boss glüht stärker als der Laden), das Casino den Farbton. */
  function tinted(name) {
    var base = PALETTES[name] || PALETTES.menu;
    if (!theme || name === 'menu' || name === 'lose') return base;
    function mix(key) {
      var lift = (base[key][0] + base[key][1] + base[key][2]) / Math.max(0.001, theme[key][0] + theme[key][1] + theme[key][2]);
      lift = Math.max(0.6, Math.min(1.5, lift)); // Helligkeit der Szene halten
      return [0, 1, 2].map(function (i) { return Math.min(1, base[key][i] * (1 - THEME_WEIGHT) + theme[key][i] * lift * THEME_WEIGHT); });
    }
    return { a: mix('a'), b: mix('b'), c: mix('c'), heat: base.heat };
  }
  function css(color) { return 'rgb(' + color.map(function (v) { return Math.round(v * 255); }).join(',') + ')'; }

  function clone(p) { return { a: p.a.slice(), b: p.b.slice(), c: p.c.slice(), heat: p.heat }; }

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function resize() {
    // Ein Fragment je sichtbarem "Pixel": das Bild wird klein gerechnet und per CSS hart hochskaliert.
    var rows = 170;
    canvas.height = rows;
    canvas.width = Math.max(64, Math.round(rows * window.innerWidth / Math.max(1, window.innerHeight)));
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function draw(dt, time) {
    if (!gl || !enabled || lost) return;
    var k = 1 - Math.pow(0.02, dt);
    ['a', 'b', 'c'].forEach(function (key) {
      for (var i = 0; i < 3; i++) cur[key][i] += (target[key][i] - cur[key][i]) * k;
    });
    cur.heat += (target.heat - cur.heat) * k;
    ember += (emberTo - ember) * k;
    flash *= Math.pow(0.02, dt);
    gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
    gl.uniform1f(uniforms.uTime, time);
    gl.uniform1f(uniforms.uPix, 1.0);
    gl.uniform1f(uniforms.uHeat, cur.heat + flash);
    gl.uniform1f(uniforms.uEmber, Math.min(1, ember + flash * 0.5));
    gl.uniform3fv(uniforms.uA, cur.a);
    gl.uniform3fv(uniforms.uB, cur.b);
    gl.uniform3fv(uniforms.uC, cur.c);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* Baut Shader und Geometrie auf; läuft beim Start und erneut, wenn der Browser den Grafik-Kontext zurückgibt. */
  function setup() {
    var program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uTime', 'uPix', 'uHeat', 'uEmber', 'uA', 'uB', 'uC'].forEach(function (name) {
      uniforms[name] = gl.getUniformLocation(program, name);
    });
    resize();
  }

  function fallback() {
    gl = null;
    canvas.classList.add('fallback'); // CSS-Verlauf statt Shader
  }

  ZU.bg = {
    init: function () {
      canvas = document.getElementById('bg');
      try {
        gl = canvas.getContext('webgl', { antialias: false, alpha: false }) || canvas.getContext('experimental-webgl');
        if (!gl) throw new Error('kein WebGL');
        setup();
        window.addEventListener('resize', resize);
        // Handys nehmen einer Seite im Hintergrund gern den Grafik-Kontext weg; ohne Neuaufbau bliebe das Bild danach schwarz.
        canvas.addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); lost = true; });
        canvas.addEventListener('webglcontextrestored', function () {
          try { setup(); lost = false; } catch (e) { fallback(); }
        });
        ZU.onFrame(draw);
      } catch (e) {
        fallback();
      }
    },
    /* Einstellung „Hintergrund": aus = ruhiger Verlauf ohne Shader (schont auch den Akku). */
    setEnabled: function (on) {
      enabled = !!on;
      document.body.classList.toggle('nobg', !enabled);
      if (enabled) cur = clone(target);
    },
    set: function (name) {
      scene = name;
      target = tinted(name);
      if (!gl && canvas) canvas.setAttribute('data-scene', name);
      // Auch der ruhige Verlauf (Hintergrund aus oder kein WebGL) trägt die Farbe des Hauses.
      document.body.style.setProperty('--bg-mid', css(target.b));
      document.body.style.setProperty('--bg-dark', css(target.a));
    },
    /* Wie viele Glutfunken aufsteigen: 0 = kaum welche, 1 = volle Glut. */
    setEmber: function (level) { emberTo = Math.max(0, Math.min(1, level)); },
    /* Farbwelt eines Casinos (ZU.CASINOS[i].tint) oder null für die neutrale. */
    setTheme: function (tint) {
      theme = tint || null;
      target = tinted(scene);
    },
    /* Kurzes Aufglühen, z. B. bei hohen Ketten. */
    flash: function (amount) { flash = Math.min(1.2, flash + amount); }
  };
})(window.ZU = window.ZU || {});
