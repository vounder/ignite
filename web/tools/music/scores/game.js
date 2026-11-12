/* Zündung – Spielmusik: ein Stück, acht Häuser, je eine ruhige Fassung und eine Boss-Stufe.

   Grundlage ist das Stück für den Goldenen Hahn (h-Moll, 100 BPM, 64 Takte). Die Melodien stammen aus dem
   bisherigen Spielstück: das Auftakt-Thema (h d e g a → fis), der Refrain (fis fis fis e d e …, in der
   ruhigen Fassung auf seine Haupttöne ausgedünnt) und die Brücke mit den langen Tönen.

   Jedes Casino spielt dieselbe Musik in eigenem Gewand (Tonart, Tempo, Schlagwerk, Klangfarben), siehe
   CASINOS unten. Die Boss-Stufe hat dieselbe Länge, dasselbe Tempo und dieselbe Form wie die ruhige
   Fassung ihres Hauses – darum kann das Spiel mitten im Takt von der einen in die andere blenden.
   Sie ist dichter: Melodie in allen Teilen und mit allen Tönen, volleres Schlagwerk, hellere Klänge.

   Partituren heißen game-<casino> und game-<casino>-boss. */
(function (MU) {
  'use strict';
  MU.scores = MU.scores || {};

  var CH = {
    Em9:   { bass: 'E2',  ep: 'G3 B3 D4 F#4',  pad: 'E3 B3 D4 G4' },
    Bm9:   { bass: 'B2',  ep: 'A3 B3 D4 F#4',  pad: 'B3 D4 F#4 A4' },
    Gmaj9: { bass: 'G2',  ep: 'B3 D4 F#4 A4',  pad: 'G3 D4 F#4 B4' },
    Fsm11: { bass: 'F#2', ep: 'A3 B3 C#4 E4',  pad: 'F#3 C#4 E4 A4' },
    A69:   { bass: 'A2',  ep: 'G3 B3 C#4 F#4', pad: 'A3 C#4 E4 B4' },
    B9:    { bass: 'B2',  ep: 'A3 C#4 D#4 F#4', pad: 'B3 D#4 F#4 A4' },
    B7b9:  { bass: 'B2',  ep: 'A3 C4 D#4 F#4', pad: 'A3 C4 D#4 F#4' },
    Fs7:   { bass: 'F#2', ep: 'E3 A#3 C#4 A4', pad: 'F#3 A#3 C#4 E4' },
    Bbmaj9: { bass: 'Bb2', ep: 'A3 C4 D4 F4',  pad: 'Bb3 D4 F4 A4' },
    A7sus: { bass: 'A2',  ep: 'G3 B3 D4 E4',   pad: 'A3 D4 E4 G4' }
  };
  /* Je Takt ein Akkord oder zwei halbe ("Bm9 A69"). */
  var FORM = {
    A:  ['Em9', 'Em9', 'Bm9', 'Bm9', 'Em9', 'Em9', 'Gmaj9', 'Fs7'],
    B1: ['Gmaj9', 'Em9', 'Fsm11', 'Bm9 A69', 'Gmaj9', 'Em9', 'B9', 'B7b9'],
    B2: ['Gmaj9', 'Em9', 'Fsm11', 'Bm9 A69', 'Gmaj9', 'Em9 Fs7', 'Bm9', 'Bm9'],
    C:  ['Bm9', 'Gmaj9', 'A69', 'A69', 'Bbmaj9', 'Bbmaj9', 'A7sus', 'Fs7']
  };
  var ORDER = ['A', 'A', 'B1', 'B2', 'C', 'C', 'B1', 'B2'];

  /* ---- Melodien (notiert in der Lage des alten Stücks, klingen eine Oktave höher) */
  var PICKUP = 'B3/.25 D4/.25 E4/.25 G4/.5 A4/.5';
  var THEME = 'F#4/4:3.9 | _/2 D4/1.5 F#4/.5:3.2 | _/4 | _/2.25 ' + PICKUP + ' | F#4/4:3.9 | _/2 D4/1.5 B3/.5:2.6 | _/4 | ';
  var CALM = 'F#4/2:1.9 F#4/1 E4/.5 D4/.5 | _/.5 D4/3.5:3 | _/1 E4/1 F#4/1 E4/1 | D4/2:1.8 _/2 | ';
  var FULL = 'F#4/1 F#4/1 F#4/.5 E4/.5 D4/.5 E4/.5 | _/.5 D4/1 D4/2.5:2.2 | _/1 E4/.5 C#4/.5 E4/.5 F#4/.5 E4/.5 D4/.5 | _/.5 D4/1 D4/.5 B3/.5 C#4/.5 D4/.5 E4/.5 | ';
  var LINES = {
    theme:   THEME + '_/4',
    themeUp: THEME + '_/2 F#4/1:.9 E4/.5 E4/.5',                      // führt in den Refrain
    calm1: CALM + 'F#4/2:1.9 F#4/1 E4/.5 D4/.5 | _/.5 F#4/2.5:2.3 D4/1 | C#4/2:1.9 _/.5 B3/.5 C#4/.5 D#4/.5:3 | _/4',
    calm2: CALM + 'F#4/2:1.9 A4/1 F#4/.5 E4/.5 | _/.5 F#4/1 D4/1 C#4/1 B3/.5:4.2 | _/4 | _/4',
    full1: FULL + 'F#4/1 F#4/1 F#4/.5 E4/.5 D4/.5 E4/.5 | _/.5 F#4/2.5:2.3 D4/1 | _/.25 C#4/1.75 C#4/.5 B3/.5 C#4/.5 D#4/.5:3 | _/3 E4/.5 E4/.5',
    full2: FULL + 'F#4/1 F#4/1 F#4/.5 A4/.5 F#4/.5 E4/.5 | _/.5 F#4/1 D4/1 C#4/1 B3/.5:4.2 | _/4 | _/2.25 ' + PICKUP,
    bridge: '_/1 D4/1.5 B3/.5 D4/.5 F#4/.5:1.4 | _/1 F#4/.5 D4/2.5:2.3 | _/1 C#4/3:4.3 | _/1.5 D4/.5 C#4/2:1.8 | ' +
      '_/1 F4/1.5 D4/.5 F4/1 | _/.5 G4/.5 A4/.5 F4/.5 D4/1 F4/1 | _/.5 E4/2 F#4/.5 E4/.5 C#4/.5:3.5 | _/4',
    bridgeUp: '_/1 D4/1.5 B3/.5 D4/.5 F#4/.5:1.4 | _/1 F#4/.5 G4/.5 A4/1 F#4/1 | C#4/1 A3/1.5 F#3/.5 A3/.5 C#4/.5 | _/.5 B3/.5 C#4/.5 D4/.5 C#4/2:1.8 | ' +
      '_/1 F4/1.5 D4/.25 Eb4/.25 F4/1 | _/.5 G4/.5 A4/.5 F4/.5 D4/1 F4/1 | _/.5 E4/2 C#4/.5 E4/.5 F#4/.5:2.4 | _/3 E4/.5 E4/.5'
  };
  /* Wer in welchem Achttakter welche Linie spielt: [Stimme, Linie] – "L" Melodiestimme, "V" Vibraphon. */
  var PLAN = [null, ['L', 'theme'], ['V', 'calm1'], ['L', 'calm2'], ['V', 'bridge'], ['L', 'bridge'], ['L', 'calm1'], ['L', 'calm2']];
  var BOSS_PLAN = [['L', 'theme'], ['L', 'themeUp'], ['L', 'full1'], ['L', 'full2'], ['V', 'bridge'], ['L', 'bridgeUp'], ['L', 'full1'], ['L', 'full2']];

  /* ---- Schlagwerk je Stil: liefert die Zeilen für einen Takt.
     state: "calm" (ruhiger Anfang), "thin" (halbe Brücke fast ohne Schlagzeug), "verse", "chorus", "last" (Schlusstakt). */
  var KITS = {
    lounge: function (state, i) {
      if (state === 'last') return { k: 'x...............', sn: '....o...........', h: 'x.o.x.o.........', ch: '........o..o....', cl: '..........o...oo' };
      if (state === 'calm') return { k: 'x.........x.....', sn: '....o.......o...', h: 'o.-.o.-.o.-.o.-.' };
      if (state === 'thin') return i < 4 ? { sn: '............o...', h: 'o...o...o...o.-.', sh: '..-...-...-...-.' }
        : { k: 'x...............', sn: '....o.......o...', h: 'o.-.o.-.o.-.o.-.', sh: '..-...-...-...-.' };
      if (state === 'chorus') {
        var rows = { k: i % 2 ? 'x......x..x..o..' : 'x......x..x.....', sn: '....x.......x...',
          h: 'x.o-x.o.x.o-x.o.', sh: '-.o.-.o.-.o.-.o.', o: i % 4 === 3 ? '..............x.' : '................' };
        if (i % 4 === 1) { rows.ch = '.......o........'; rows.cl = '..........o..o..'; }
        return rows;
      }
      var verse = { k: 'x......o..x.....', sn: '....x.......x...', h: 'x.o.x.o.x.o.x.o-', sh: '..-...o...-...o.' };
      if (i % 2) { verse.ch = '......o.........'; verse.cl = '.............o.o'; }
      return verse;
    },
    /* Tanzkapelle: Becken im Swing-Muster, gefederte Bassdrum, Besen auf zwei und vier. */
    shuffle: function (state, i) {
      if (state === 'calm') return { h: 'o...o.-.o...o.-.', sn: '....-.......-...', k: 'o.......-.......' };
      if (state === 'thin') return { h: 'o...o.-.o...o.-.', sn: i < 4 ? '............-...' : '....-.......o...' };
      var rows = { h: 'x...x.o.x...x.o.', sn: '....o.......o...', k: 'x.......o.......', sh: '....-.......-...' };
      if (state === 'chorus') { rows.k = i % 2 ? 'x.....o.o.......' : 'x.......o.....o.'; rows.sn = '....x.......x...'; rows.sh = '..-.o.-...-.o.-.'; }
      if (i % 4 === 3) rows.sn = state === 'chorus' ? '....x.....o.x.oo' : '....o.......o.-o';
      return rows;
    },
    /* Nachtclub: halbes Tempo im Gefühl, schwere Eins, Snare mit viel Raum. */
    slow: function (state, i) {
      if (state === 'calm') return { k: 'x...............', sn: '........o.......', h: 'o...-...o...-...' };
      if (state === 'thin') return { h: 'o...-...o...-...', sh: '..-...-...-...-.', sn: i < 4 ? '................' : '........o.......' };
      var rows = { k: i % 2 ? 'x.....o...o.....' : 'x.........o.....', sn: '........x.......', h: 'o.-.o.-.o.-.o.-.', sh: '..-...o...-...o.' };
      if (state === 'chorus') { rows.h = 'x.o.x.o-x.o.x.o.'; rows.sn = i % 2 ? '........x.....-.' : '........x.......'; rows.cl = i % 4 === 3 ? '.............o.o' : '................'; }
      return rows;
    },
    /* Dampfer: wiegend, Shaker wie Wellen, Snare nur auf der Vier, Congas. */
    ship: function (state, i) {
      if (state === 'calm') return { k: 'x.........o.....', sh: 'o.-.-.o.-.-.o.-.', sn: '............o...' };
      if (state === 'thin') return { sh: 'o.-.-.o.-.-.o.-.', ch: i % 2 ? '......o.........' : '................', sn: i < 4 ? '................' : '............o...' };
      var rows = { k: 'x.....o...x.....', sn: '............x...', sh: 'x.-.o.x.-.o.x.-.', h: '..o...o...o...o.', ch: i % 2 ? '....o.....o.....' : '....o...........', cl: i % 2 ? '.......o.....o..' : '..........o..o..' };
      if (state === 'chorus') { rows.sn = '....o.......x...'; rows.k = i % 2 ? 'x.....o...x..o..' : 'x.....o...x.....'; }
      return rows;
    },
    /* Hinterhof-Studio: Boom-Bap, Snare mit Klatscher, Hi-Hat in Achteln mit Vorschlägen. */
    boombap: function (state, i) {
      if (state === 'calm') return { k: 'x.........x.....', sn: '....o.......o...', h: 'o.o.o.o.o.o.o.o.' };
      if (state === 'thin') return { h: 'o.o.o.o.o.o.o.o.', sn: i < 4 ? '............o...' : '....o.......o...', k: i < 4 ? '................' : 'x.......-.x.....' };
      var rows = { k: i % 2 ? 'x..o......x..o..' : 'x......o..x.....', sn: '....x.......x...', c: '....o.......o...', h: 'x.o.x.o.x.o.x.o-' };
      if (state === 'chorus') { rows.h = i % 2 ? 'x.o.x.o-x.o.x-o-' : 'x.o.x.o.x.o-x.o.'; rows.o = i % 4 === 3 ? '......x.......x.' : '................'; }
      return rows;
    },
    /* Grandhotel: kaum Schlagzeug – Besen, leise Snare, die Bassdrum nur angedeutet. */
    salon: function (state, i) {
      if (state === 'calm') return { sh: '-...-.-.-...-.-.' };
      if (state === 'thin') return { sh: '-...-.-.-...-.-.', sn: i < 4 ? '................' : '............-...' };
      var rows = { sh: 'o...o.-.o...o.-.', sn: '....o.......o...', k: 'o.........-.....' };
      if (state === 'chorus') { rows.k = 'x.........o.....'; rows.h = '..-...-...-...-.'; rows.sn = i % 4 === 3 ? '....o.......o.-.' : '....o.......o...'; }
      return rows;
    },
    /* Spielbank: wie ein Uhrwerk, gerade Sechzehntel, keine Verzierungen. */
    machine: function (state, i) {
      if (state === 'calm') return { h: 'o-o-o-o-o-o-o-o-', k: 'x.......o.......' };
      if (state === 'thin') return { h: 'o-o-o-o-o-o-o-o-', sn: i < 4 ? '................' : '....o.......o...' };
      var rows = { k: 'x.......x.......', sn: '....x.......x...', h: 'x-o-x-o-x-o-x-o-' };
      if (state === 'chorus') { rows.k = i % 2 ? 'x.......x.x.....' : 'x.......x.......'; rows.o = '..x...x...x...x.'; rows.h = 'x-.-x-.-x-.-x-.-'; }
      return rows;
    },
    /* Inferno: schwerer Dreierpuls in der Bassdrum, tiefe Trommeln, Zischen. */
    ember: function (state, i) {
      if (state === 'calm') return { k: 'x.....o.....o...', sh: '-.-.-.-.-.-.-.-.', cl: i % 2 ? '..........o..o..' : '................' };
      if (state === 'thin') return { sh: '-.-.-.-.-.-.-.-.', cl: '......o.....o...', k: i < 4 ? '................' : 'x...............', sn: i < 4 ? '................' : '............o...' };
      var rows = { k: 'x.....x.....x...', sn: '....o.......x...', sh: 'o.-.o.-.o.-.o.-.', h: '..o...o...o...o.', cl: i % 2 ? '...o.....o....o.' : '.........o......' };
      if (state === 'chorus') { rows.sn = '....x.......x...'; rows.k = i % 2 ? 'x.....x.....x.o.' : 'x.....x.....x...'; rows.sh = 'o.-oo.-oo.-oo.-o'; rows.o = i % 4 === 3 ? '..............x.' : '................'; }
      return rows;
    }
  };
  function overlay(row, extra) { // setzt Schläge aus "extra" in die Lücken von "row"
    var out = '';
    for (var n = 0; n < 16; n++) out += (row || '................').charAt(n) === '.' ? extra.charAt(n) : row.charAt(n);
    return out;
  }

  /* ---- Die Häuser. Alles, was nicht genannt ist, bleibt wie im Goldenen Hahn (BASE). */
  var BASE = {
    bpm: 100, swing: 0.54, key: 0, seed: 11,
    kit: 'lounge', bass: 'lounge', ep: 'comp', arp: 'some', arpStep: 0.5, plan: PLAN,
    fx: { reverbTime: 2.5, reverbSeconds: 3, delayBeats: 0.75, delayFeedback: 0.4, delayTone: 2400 },
    master: { wowCents: 5, flutterCents: 0.7, drive: 1.15, threshold: -17, ratio: 2.2, air: 1.5 },
    tracks: {
      drums: { gain: -1, reverb: -19, human: 0.003, velHuman: 0.15, opts: { levels: { h: 1.5, o: 1.4, sh: 1.9, sn: 1, rd: 1.6, sw: 1.5 } } },
      bass: { gain: -12, fx: { drive: 1.4 }, opts: { cutoff: 620, grit: 0.45 } },
      pad: { gain: -11, reverb: -9, duck: 0.22, fx: { hp: 180, phaser: { rate: 0.09, freq: 600, mix: 0.5 }, chorus: { rate: 0.45, depth: 0.003 } }, opts: { cutoff: 1500, attack: 0.55, release: 1.5 } },
      ep: { gain: -14, reverb: -12, delay: -22, duck: 0.12, human: 0.008, velHuman: 0.2,
        fx: { hp: 140, lp: 5200, autopan: { rate: 4.4, depth: 0.35 }, chorus: { rate: 0.7, depth: 0.0018, mix: 0.35 } }, opts: { decay: 1.7, bark: 1.25, tine: 0.8 } },
      pluck: { gain: -5.5, pan: 0.25, reverb: -12, delay: -8, human: 0.004, velHuman: 0.2, fx: { hp: 300 }, opts: { cutoff: 3600 } },
      vibes: { gain: -9, pan: -0.25, reverb: -7, delay: -14, human: 0.006, velHuman: 0.15, fx: { tremolo: { rate: 5.4, depth: 0.3 } }, opts: { decay: 1.2 } },
      lead: { gain: -9, reverb: -9, delay: -14, fx: { hp: 200, chorus: { rate: 0.5, depth: 0.0015, mix: 0.3 } },
        opts: { cutoff: 2000, glide: 0.05, attack: 0.02, vibCents: 24, vibRate: 5.2, vibDelay: 0.15, vibRise: 0.09, vibFrom: 0.3,
          waves: [['sawtooth', -7, 0.4], ['sawtooth', 7, 0.4], ['triangle', 0, 0.55]] } }
    }
  };
  var CASINOS = {
    /* Zum Goldenen Hahn – Eckkneipe mit Hinterzimmer: das Grundstück, unverändert. */
    hahn: {},
    /* Tanzpalast Rialto – Tanzkapelle: mehr Swing, laufender Bass, Vibraphon vorn, die Melodiestimme näselt wie eine gestopfte Trompete. */
    rialto: {
      bpm: 108, swing: 0.62, key: 1, seed: 12, kit: 'shuffle', bass: 'walk', arp: 'none',
      plan: [null, ['V', 'theme'], ['L', 'calm1'], ['V', 'calm2'], ['V', 'bridge'], ['L', 'bridge'], ['L', 'calm1'], ['V', 'calm2']],
      tracks: {
        drums: { gain: 0.5 },
        bass: { gain: -11.5, opts: { cutoff: 700, grit: 0.35, snap: 0.2 } },
        pad: { gain: -13 },
        ep: { gain: -13, opts: { decay: 1.3, bark: 1.5, tine: 1 }, fx: { autopan: { rate: 5.2, depth: 0.2 } } },
        vibes: { gain: -7.5, fx: { tremolo: { rate: 6.2, depth: 0.4 } }, opts: { decay: 1.5 } },
        lead: { gain: -9, opts: { cutoff: 1600, q: 2.2, vibRate: 6, vibCents: 22, glide: 0.03, waves: [['square', 0, 0.45], ['sawtooth', 5, 0.3]] } }
      }
    },
    /* Rote Laterne – Nachtclub: langsam und schwül, tiefer Bass mit langen Tönen, E-Piano mit starkem Tremolo, die Melodie gleitet. */
    laterne: {
      bpm: 88, swing: 0.57, key: -2, seed: 13, kit: 'slow', bass: 'long', ep: 'held', arp: 'none',
      fx: { reverbTime: 3.1, reverbSeconds: 3.6, delayFeedback: 0.46 },
      master: { wowCents: 6 },
      tracks: {
        drums: { gain: 0.5, reverb: -14, opts: { snareReverb: 0.6 } },
        bass: { gain: -12.5, opts: { cutoff: 430, grit: 0.25, sustain: 0.92, release: 0.12 } },
        pad: { gain: -11, fx: { phaser: { rate: 0.06, freq: 520, mix: 0.7 } }, opts: { cutoff: 1250, attack: 0.8, release: 2 } },
        ep: { gain: -16, fx: { autopan: { rate: 3.1, depth: 0.7 }, lp: 4200 }, opts: { decay: 2.4, bark: 1 } },
        vibes: { gain: -8 },
        lead: { delay: -11, opts: { glide: 0.1, vibCents: 28, vibRate: 4.8, cutoff: 1800 } }
      }
    },
    /* Dampfer Fortuna – auf dem Wasser: wiegendes Schlagwerk, perlende Zupfer mit langem Echo, die Melodie klingt nach Schifferklavier. */
    fortuna: {
      bpm: 96, swing: 0.58, key: 2, seed: 14, kit: 'ship', arp: 'all',
      plan: [null, ['L', 'theme'], ['V', 'calm1'], ['L', 'calm2'], ['V', 'bridge'], ['L', 'bridge'], ['V', 'calm1'], ['L', 'calm2']],
      fx: { reverbTime: 2.9, reverbSeconds: 3.4, delayFeedback: 0.5, delayTone: 2100 },
      tracks: {
        pad: { fx: { phaser: { rate: 0.14, freq: 700, mix: 0.7 }, chorus: { rate: 0.6, depth: 0.004 } } },
        ep: { gain: -16 },
        pluck: { gain: -5, delay: -5, opts: { cutoff: 2600, square: 0, decay: 0.3 } },
        vibes: { gain: -8 },
        lead: { gain: -9, opts: { cutoff: 2300, q: 1, vibRate: 4.6, vibCents: 16, glide: 0.02, attack: 0.05, waves: [['square', -11, 0.34], ['square', 11, 0.34], ['sawtooth', 0, 0.2]] } }
      }
    },
    /* Block 9 – Hinterhof-Studio: Boom-Bap, satter Subbass, starkes Bandleiern, die Melodie pfeift wie ein alter Westküsten-Synth. */
    block9: {
      bpm: 90, swing: 0.57, key: -3, seed: 15, kit: 'boombap', bass: 'sub', ep: 'held', arp: 'none',
      plan: [null, ['L', 'theme'], ['L', 'calm1'], ['L', 'calm2'], ['V', 'bridge'], ['L', 'bridge'], ['L', 'calm1'], ['L', 'calm2']],
      master: { wowCents: 9, flutterCents: 1.6, drive: 1.5, air: 0 },
      tracks: {
        drums: { gain: 0, opts: { levels: { h: 1.2, o: 1.2, sh: 1.5, sn: 1.15, c: 0.4, rd: 1.4, sw: 1.3 } } },
        bass: { gain: -13.5, fx: { drive: 1.8 }, opts: { cutoff: 330, grit: 0.18, sustain: 0.95, release: 0.14, snap: 0.3 } },
        pad: { gain: -13, opts: { cutoff: 1100 } },
        ep: { gain: -15, fx: { lp: 3000, autopan: { rate: 3.4, depth: 0.25 } }, opts: { decay: 2, bark: 0.9, tine: 0.4 } },
        vibes: { gain: -10 },
        lead: { gain: -15, delay: -12, opts: { cutoff: 3400, q: 0.8, glide: 0.09, vibCents: 26, vibRate: 5.6, attack: 0.03, waves: [['triangle', 0, 0.9], ['sine', 0, 0.35]] } }
      }
    },
    /* Grandhotel Imperial – vornehm: Streicherfläche, Celesta, Harfenzupfer, kaum Schlagzeug, die Melodie singt wie eine Geige. */
    imperial: {
      bpm: 96, swing: 0.52, key: 3, seed: 16, kit: 'salon', ep: 'held', arp: 'all',
      plan: [null, ['L', 'theme'], ['V', 'calm1'], ['L', 'calm2'], ['V', 'bridge'], ['L', 'bridge'], ['V', 'calm1'], ['L', 'calm2']],
      fx: { reverbTime: 3.2, reverbSeconds: 3.8 },
      master: { wowCents: 3, air: 2 },
      tracks: {
        drums: { gain: -3 },
        bass: { gain: -13, opts: { cutoff: 520, grit: 0.3, sustain: 0.85 } },
        pad: { gain: -13, reverb: -6, fx: { phaser: null, chorus: { rate: 0.5, depth: 0.0035 } }, opts: { cutoff: 2300, attack: 0.9, release: 1.8, voices: 3, spread: 13 } },
        ep: { gain: -17, opts: { decay: 2.2, bark: 0.8, tine: 0.5 } },
        pluck: { gain: -3.5, delay: -14, reverb: -8, opts: { cutoff: 2200, square: 0, decay: 0.55, q: 1 } },
        vibes: { gain: -8, fx: { tremolo: { rate: 5.4, depth: 0.1 } }, opts: { decay: 0.9, partials: [[1, 1, 1], [2, 0.28, 0.5], [4, 0.22, 0.3], [8, 0.07, 0.15]] } },
        lead: { gain: -10, reverb: -7, opts: { cutoff: 2500, q: 1, attack: 0.06, glide: 0.06, vibRate: 5.8, vibCents: 22, vibDelay: 0.2, waves: [['sawtooth', 0, 0.6], ['triangle', 0, 0.4]] } }
      }
    },
    /* Spielbank Monopol – kalt und genau: kein Swing, Uhrwerk-Schlagzeug, Sechzehntel-Folgen vom Rechteck-Synth, hohle Melodiestimme. */
    monopol: {
      bpm: 104, swing: 0.5, key: 1, seed: 17, kit: 'machine', bass: 'eighths', ep: 'stab', arp: 'all', arpStep: 0.25,
      fx: { reverbTime: 2, reverbSeconds: 2.6, delayBeats: 0.75, delayFeedback: 0.45, delayTone: 3200 },
      master: { wowCents: 2, flutterCents: 0.3, air: 2 },
      tracks: {
        drums: { human: 0, velHuman: 0.05, opts: { levels: { h: 1.3, o: 1, sh: 1.5, sn: 1, rd: 1.4, sw: 1.3 } } },
        bass: { gain: -12, human: 0, opts: { cutoff: 800, grit: 0.55, snap: 0.09, sustain: 0.5 } },
        pad: { fx: { phaser: null }, opts: { cutoff: 1250, lfoCents: 120, attack: 0.3, voices: 2, spread: 6 } },
        ep: { gain: -13, human: 0.002, opts: { decay: 0.9, bark: 1.6, tine: 1 } },
        pluck: { gain: -9, human: 0, velHuman: 0.1, delay: -10, opts: { wave: 'square', square: 0.5, cutoff: 2400, q: 3, snap: 0.05, decay: 0.14 } },
        vibes: { gain: -7.5, opts: { decay: 1, partials: [[1, 1, 1], [2.76, 0.3, 0.4], [5.4, 0.14, 0.2]] }, fx: { tremolo: { rate: 5.4, depth: 0.05 } } },
        lead: { gain: -10.5, opts: { cutoff: 2300, q: 1.2, glide: 0.02, vibCents: 16, vibRate: 5.4, waves: [['square', 0, 0.5], ['square', 6, 0.28]] } }
      }
    },
    /* Das Inferno – tief und glühend: schwerer Dreierpuls, angezerrter Bass, dunkle atmende Fläche, tiefe Glocke, Zischen. */
    inferno: {
      bpm: 108, swing: 0.54, key: -4, seed: 18, kit: 'ember', bass: 'pulse', arp: 'some',
      fx: { reverbTime: 3.2, reverbSeconds: 3.8, delayFeedback: 0.48, delayTone: 1900 },
      master: { wowCents: 6, drive: 1.6, air: 0.5 },
      tracks: {
        drums: { gain: -2.5, reverb: -15, opts: { levels: { h: 1.2, o: 1.3, sh: 2.2, sn: 1.05, cl: 1.5, ch: 1.2, rd: 1.6, sw: 2.2 }, snareReverb: 0.5 } },
        bass: { gain: -16, fx: { drive: 2.4 }, opts: { cutoff: 820, grit: 0.7 } },
        pad: { gain: -12.5, opts: { cutoff: 900, q: 2.4, lfoCents: 750, lfoRate: 0.21, sub: 0.3, attack: 0.7, release: 2 } },
        ep: { gain: -15.5, fx: { lp: 2600 }, opts: { bark: 1.6 } },
        pluck: { gain: -8, opts: { cutoff: 2400 } },
        vibes: { gain: -11, opts: { decay: 1.8, partials: [[1, 1, 1], [2.4, 0.34, 0.5], [4.1, 0.18, 0.3]] }, fx: { tremolo: { rate: 3.2, depth: 0.2 } } },
        lead: { gain: -16.5, fx: { drive: 2.2 }, opts: { cutoff: 2300, vibCents: 28, glide: 0.06 } }
      }
    }
  };
  /* Was die Boss-Stufe an den Spuren ändert (auf das Gewand des Hauses obendrauf). */
  var BOSS = {
    drums: { gainBy: 0.5 }, bass: { gainBy: 0.5, cutoffBy: 1.2 }, pad: { cutoffBy: 1.25 }, pluck: { gainBy: 1.5 },
    lead: { gainBy: 1.5, cutoffBy: 1.25 }, ep: { gainBy: 0.5 }
  };

  function merge(base, over) { // tief zusammenführen; null löscht einen Eintrag, Listen werden ersetzt
    var out = {}, k;
    for (k in base) out[k] = base[k];
    for (k in over || {}) {
      if (over[k] === null) delete out[k];
      else if (typeof over[k] === 'object' && !Array.isArray(over[k]) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = merge(out[k], over[k]);
      else out[k] = over[k];
    }
    return out;
  }

  function build(id, boss) {
    var st = merge(BASE, CASINOS[id]), seq = MU.seq, pattern = MU.pattern, kit = KITS[st.kit];
    var lead = [], vibes = [], ep = [], pad = [], bass = [], pluck = [], drums = [];
    function add(list, notes) { notes.forEach(function (n) { list.push(n); }); }
    var cells = [];
    ORDER.forEach(function (sec, s) { MU.cells(FORM[sec], s * 8).forEach(function (c) { c.sec = sec; c.s = s; cells.push(c); }); });

    cells.forEach(function (cell, ci) {
      var sec = cell.sec, s = cell.s, i = cell.index, c = CH[cell.name], start = cell.at, len = cell.len, half = len < 4;
      var calm = !boss && sec === 'A' && s === 0, thin = !boss && s === 4, bridge = sec === 'C', chorus = sec.charAt(0) === 'B';
      var next = cells[(ci + 1) % cells.length];
      add(pad, seq(start, '(' + c.pad + ')/' + len + ':' + (len + 0.3), { vel: 0.7 }));

      /* E-Piano */
      if (st.ep === 'held') {
        add(ep, seq(start, half ? '(' + c.ep + ')/2:1.8' : '(' + c.ep + ')/2.5:2.4 (' + c.ep + ')*0.5/1.5:1.4', { vel: 0.66 }));
      } else if (st.ep === 'stab') {
        add(ep, seq(start, half ? '_/1.5 (' + c.ep + ')/.5:.2' : '_/1.5 (' + c.ep + ')/2:.2 (' + c.ep + ')*0.7/.5:.2', { vel: 0.7 }));
      } else if (half) {
        add(ep, seq(start, '(' + c.ep + ')/2:1.6', { vel: 0.7 }));
      } else if (thin) {
        add(ep, seq(start, '(' + c.ep + ')/4:3.6', { vel: 0.62 }));
      } else if (i % 2 === 0) {
        add(ep, seq(start, '(' + c.ep + ')/1.5:1.2 (' + c.ep + ')*0.6/2.5:2.1', { vel: 0.72 })); // auf der Eins und vorgezogen vor der Drei
      } else {
        add(ep, seq(start, '(' + c.ep + ')/2.5:2 (' + c.ep + ')*0.55/1.5:1.2', { vel: 0.68 }));
      }

      /* Bass */
      var r = MU.midi(c.bass), fifth = r + 7, oct = r + 12, sev = r + 10;
      var third = r + (/sus/.test(cell.name) ? 5 : /^(Em|Bm|Fsm)/.test(cell.name) ? 3 : 4);
      var target = MU.midi(CH[next.name].bass), lean = target === r ? fifth : (target > r ? target - 1 : target + 1);
      if (half) {
        if (st.bass === 'walk') add(bass, [{ t: start, d: 0.85, n: r, v: 0.85 }, { t: start + 1, d: 0.85, n: lean, v: 0.65 }]);
        else if (st.bass === 'eighths') [0, 0.5, 1, 1.5].forEach(function (o, n) { bass.push({ t: start + o, d: 0.3, n: r, v: n % 2 ? 0.55 : 0.8 }); });
        else add(bass, [{ t: start, d: 1.3, n: r, v: 0.85 }, { t: start + 1.5, d: 0.4, n: cell.part ? fifth : oct, v: 0.6 }]);
      } else if (thin) {
        add(bass, [{ t: start, d: 3.4, n: r, v: 0.75 }, { t: start + 3.5, d: 0.4, n: fifth, v: 0.5 }]);
      } else if (st.bass === 'walk') {
        if (calm) add(bass, [{ t: start, d: 1.8, n: r, v: 0.8 }, { t: start + 2, d: 1.7, n: fifth, v: 0.65 }]);
        else add(bass, [{ t: start, d: 0.85, n: r, v: 0.85 }, { t: start + 1, d: 0.85, n: third, v: 0.65 }, { t: start + 2, d: 0.85, n: fifth, v: 0.7 }, { t: start + 3, d: 0.85, n: lean, v: 0.65 }]);
      } else if (st.bass === 'long') {
        add(bass, [{ t: start, d: 2.6, n: r, v: 0.85 }, { t: start + 3, d: 0.9, n: i % 2 ? fifth : oct, v: 0.6 }]);
        if (!calm && i % 2) bass.push({ t: start + 2.75, d: 0.2, n: r, v: 0.45 });
      } else if (st.bass === 'sub') {
        add(bass, [{ t: start, d: 1.6, n: r, v: 0.9 }, { t: start + 2.5, d: 0.9, n: r, v: 0.7 }]);
        if (!calm) bass.push({ t: start + 3.5, d: 0.45, n: i % 2 ? sev : fifth, v: 0.6 });
        if (chorus && i % 2) bass.push({ t: start + 1.75, d: 0.2, n: oct, v: 0.5 });
      } else if (st.bass === 'eighths') {
        for (var e = 0; e < 8; e++) bass.push({ t: start + e * 0.5, d: 0.3, n: e === 7 && !calm ? oct : (e === 5 && chorus ? fifth : r), v: e % 2 ? 0.55 : 0.82 });
      } else if (st.bass === 'pulse') {
        add(bass, [{ t: start, d: 1.3, n: r, v: 0.9 }, { t: start + 1.5, d: 1.3, n: r, v: 0.75 }, { t: start + 3, d: 0.45, n: r, v: 0.8 }]);
        if (!calm) bass.push({ t: start + 3.5, d: 0.4, n: i % 2 ? sev : fifth, v: 0.6 });
      } else if (calm) {
        add(bass, [{ t: start, d: 1.4, n: r, v: 0.85 }, { t: start + 2.5, d: 0.45, n: fifth, v: 0.6 }, { t: start + 3, d: 0.9, n: i % 2 ? sev : oct, v: 0.65 }]);
      } else {
        add(bass, [{ t: start, d: 1.3, n: r, v: 0.9 }, { t: start + 1.5, d: 0.4, n: r, v: 0.55 }, { t: start + 2.5, d: 0.45, n: fifth, v: 0.65 },
          { t: start + 3, d: 0.45, n: i % 2 ? sev : oct, v: 0.7 }, { t: start + 3.5, d: 0.4, n: fifth, v: 0.55 }]);
      }

      /* Zupfer: gebrochener Akkord, eine Oktave höher */
      var plays = st.arp === 'all' || (st.arp === 'some' && (boss || chorus || (bridge && s === 5) || (sec === 'A' && s === 1)));
      if (plays) {
        var v = c.ep.split(' ').map(function (n) { return MU.midi(n) + 12; });
        var shape = half ? [0, 2, 1, 3] : (i % 2 ? [3, 1, 2, 0, 1, 3, 2, 1] : [0, 2, 1, 3, 2, 1, 3, 2]);
        var quiet = !boss && (sec === 'A' || thin), count = len / st.arpStep;
        for (var n = 0; n < count; n++) {
          if (st.arpStep === 0.5 && quiet && n % 2) continue;      // im ruhigen Teil nur Viertel
          if (st.arpStep === 0.25 && quiet && n % 4 > 1) continue;
          var slot = st.arpStep === 0.25 ? Math.floor(n / 2) : n;
          var note = v[shape[slot % shape.length] % v.length] + (st.arpStep === 0.25 && n % 2 ? 12 : 0);
          pluck.push({ t: start + n * st.arpStep, d: st.arpStep * 0.6, n: note, v: n % 2 ? 0.5 : 0.7 });
        }
      }
    });

    /* Schlagzeug */
    for (var bar = 0; bar < 64; bar++) {
      var s = Math.floor(bar / 8), i = bar % 8, sec = ORDER[s], at = bar * 4, last = bar === 63;
      var state = sec === 'A' && s === 0 ? 'calm' : s === 4 ? 'thin' : sec.charAt(0) === 'B' ? 'chorus' : 'verse';
      if (boss) state = state === 'calm' || state === 'thin' ? 'verse' : 'chorus';
      var quietStart = state === 'calm';
      var rows = kit(state, i);
      if (boss && sec.charAt(0) === 'B') { // im Boss-Refrain legt jedes Haus noch etwas drauf
        rows.sh = overlay(rows.sh, 'o-o-o-o-o-o-o-o-');
        rows.o = overlay(rows.o, i % 2 ? '......o.......o.' : '..............o.');
        rows.k = overlay(rows.k, i % 2 ? '..............o.' : '................');
      }
      if (last && st.kit === 'lounge' && !boss) rows = kit('last', i);
      else if (last) { // Schlusstakt: nach der Zwei wird es dünn, zwei Congas führen zurück
        var keep = {};
        Object.keys(rows).forEach(function (name) { keep[name] = rows[name].slice(0, 8) + '........'; });
        keep.ch = '........o..o....'; keep.cl = '..........o...oo';
        rows = keep;
      }
      add(drums, pattern(at, rows));
      if (i === 7 && !last) drums.push({ t: at + 2, d: 2, n: 'sw', v: quietStart ? 0.5 : 0.8 });
      if (i === 0 && (s > 0 || boss)) drums.push({ t: at, d: 1, n: 'rd', v: 0.7 });
    }

    /* Melodie nach Plan */
    var plan = boss ? BOSS_PLAN : st.plan;
    plan.forEach(function (entry, s) {
      if (!entry) return;
      var bell = entry[0] === 'V';
      add(bell ? vibes : lead, seq(s * 32, LINES[entry[1]], bell ? { transpose: 12, vel: 0.66, gate: 1 } : { transpose: 12, vel: boss ? 0.78 : 0.7 }));
    });
    // Auftakt in den zweiten Achttakter, wenn davor noch kein Thema lief
    if (!plan[0] && plan[1]) {
      if (plan[1][0] === 'L') add(lead, seq(30.25, PICKUP, { transpose: 12, vel: 0.7 }));
      else add(vibes, seq(30.25, PICKUP, { transpose: 12, vel: 0.6, gate: 1 }));
    }

    /* Vibraphon: kurze Antworten in den Lücken, wenn es nicht selbst die Melodie hat */
    var V = { vel: 0.6, gate: 1 };
    [[0, 8, '_/1 D5/.5 C#5/.5 A4/1 F#4/1'], [0, 24, '_/1.5 F#5/.5 D5/.5 B4/.5 A4/1'], [1, 40, '_/1 F#5/.5 E5/.5 C#5/.5 A4/.5 B4/1'], [1, 56, '_/.5 B5/.5 A5/.5 F#5/.5'],
      [2, 68, '_/2 B4/.5 D5/.5 F#5/1'], [2, 92, '_/.5 C5/.5 D#5/.5 F#5/.5 A5/1'], [3, 100, '_/2 B4/.5 D5/.5 F#5/1'], [3, 120, '_/1 F#5/.5 D5/.5 C#5/.5 A4/.5 B4/1 | _/1 D5/.5 F#5/.5 A5/1 F#5/1'],
      [6, 196, '_/2 B4/.5 D5/.5 F#5/1'], [6, 220, '_/.5 C5/.5 D#5/.5 F#5/.5 A5/1'], [7, 248, '_/1 F#5/.5 D5/.5 C#5/.5 A4/.5 B4/1 | _/1 D5/.5 F#5/.5']
    ].forEach(function (f) {
      var p = plan[f[0]];
      if (p && p[0] === 'V') return;            // das Vibraphon singt dort selbst
      if (boss && (f[1] === 248 || f[1] === 56)) return; // dort stehen Auftakte der Melodiestimme
      add(vibes, seq(f[1], f[2], V));
    });
    if (boss) [192, 208, 224].forEach(function (at) { add(vibes, seq(at, 'F#5/1 F#5/1 F#5/.5 E5/.5 D5/.5 E5/.5', { vel: 0.45, gate: 1 })); });

    /* Spuren im Gewand des Hauses, alles in dessen Tonart */
    var notes = { drums: drums, bass: bass, pad: pad, ep: ep, pluck: pluck, vibes: vibes, lead: lead };
    var tracks = ['drums', 'bass', 'pad', 'ep', 'pluck', 'vibes', 'lead'].map(function (name) {
      var tr = merge(st.tracks[name], {}), b = boss && BOSS[name];
      if (b) {
        tr.gain += b.gainBy || 0;
        if (b.cutoffBy) tr.opts = merge(tr.opts, { cutoff: (tr.opts.cutoff || 1000) * b.cutoffBy });
      }
      tr.name = name;
      tr.inst = name;
      tr.notes = name === 'drums' || !st.key ? notes[name] : notes[name].map(function (n) { return { t: n.t, d: n.d, n: n.n + st.key, v: n.v }; });
      return tr;
    });
    return { name: 'game-' + id + (boss ? '-boss' : ''), bpm: st.bpm, bars: 64, swing: st.swing, seed: st.seed, fx: st.fx, master: st.master,
      lufs: boss ? -15 : -16, tracks: tracks };
  }

  Object.keys(CASINOS).forEach(function (id) {
    MU.scores['game-' + id] = function () { return build(id, false); };
    MU.scores['game-' + id + '-boss'] = function () { return build(id, true); };
  });
})(window.MU = window.MU || {});
