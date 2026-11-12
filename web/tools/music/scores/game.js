/* Zündung – Spielmusik. h-Moll, 100 BPM, 64 Takte (rund 2:34), nahtlose Schleife.
   Die Melodien stammen aus dem bisherigen Spielstück: das Auftakt-Thema (h d e g a → fis) und
   der Refrain (fis fis fis e d e …, hier auf seine Haupttöne ausgedünnt), dazu die Brücke mit den langen
   Tönen. Neu sind Tempo, Harmonien und Klang. */
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

  MU.scores.game = function () {
    var seq = MU.seq, pattern = MU.pattern;
    var lead = [], vibes = [], ep = [], pad = [], bass = [], pluck = [], drums = [];
    function add(list, notes) { notes.forEach(function (n) { list.push(n); }); }
    function names(text) { return text.split(' '); }

    /* ---- Begleitung aus der Akkordfolge */
    ORDER.forEach(function (sec, s) {
      FORM[sec].forEach(function (cell, i) {
        var bar = s * 8 + i, at = bar * 4, parts = cell.split(' ');
        var calm = sec === 'A' && s === 0, bridge = sec === 'C', chorus = sec.charAt(0) === 'B';
        parts.forEach(function (name, p) {
          var c = CH[name], start = at + p * 2, len = 4 / parts.length;
          add(pad, seq(start, '(' + c.pad + ')/' + len + ':' + (len + 0.3), { vel: 0.7 }));
          // E-Piano: Akkord auf der Eins und vorgezogen vor der Drei
          if (parts.length === 1) {
            if (bridge && s === 4) add(ep, seq(start, '(' + c.ep + ')/4:3.6', { vel: 0.62 }));
            else if (i % 2 === 0) add(ep, seq(start, '(' + c.ep + ')/1.5:1.2 (' + c.ep + ')*0.6/2.5:2.1', { vel: 0.72 }));
            else add(ep, seq(start, '(' + c.ep + ')/2.5:2 (' + c.ep + ')*0.55/1.5:1.2', { vel: 0.68 }));
          } else {
            add(ep, seq(start, '(' + c.ep + ')/2:1.6', { vel: 0.7 }));
          }
          // Bass
          var r = MU.midi(c.bass), fifth = r + 7, oct = r + 12, sev = r + 10;
          if (parts.length === 2) {
            add(bass, [{ t: start, d: 1.3, n: r, v: 0.85 }, { t: start + 1.5, d: 0.4, n: p ? fifth : oct, v: 0.6 }]);
          } else if (bridge && s === 4) {
            add(bass, [{ t: start, d: 3.4, n: r, v: 0.75 }, { t: start + 3.5, d: 0.4, n: fifth, v: 0.5 }]);
          } else if (calm) {
            add(bass, [{ t: start, d: 1.4, n: r, v: 0.85 }, { t: start + 2.5, d: 0.45, n: fifth, v: 0.6 }, { t: start + 3, d: 0.9, n: i % 2 ? sev : oct, v: 0.65 }]);
          } else {
            add(bass, [{ t: start, d: 1.3, n: r, v: 0.9 }, { t: start + 1.5, d: 0.4, n: r, v: 0.55 }, { t: start + 2.5, d: 0.45, n: fifth, v: 0.65 },
              { t: start + 3, d: 0.45, n: i % 2 ? sev : oct, v: 0.7 }, { t: start + 3.5, d: 0.4, n: fifth, v: 0.55 }]);
          }
          // Zupfer: gebrochener Akkord in Achteln, eine Oktave höher
          if (chorus || (bridge && s === 5) || (sec === 'A' && s === 1)) {
            var v = names(c.ep).map(function (n) { return MU.midi(n) + 12; });
            var order = parts.length === 2 ? [0, 2, 1, 3] : (i % 2 ? [3, 1, 2, 0, 1, 3, 2, 1] : [0, 2, 1, 3, 2, 1, 3, 2]);
            order.forEach(function (k, n) {
              if (sec === 'A' && n % 2) return; // im ruhigen Teil nur Viertel
              pluck.push({ t: start + n * 0.5, d: 0.3, n: v[k], v: n % 2 ? 0.5 : 0.7 });
            });
          }
        });

        /* ---- Schlagzeug */
        var last = bar === 63, rows;
        if (calm) rows = { k: 'x.........x.....', sn: '....o.......o...', h: 'o.-.o.-.o.-.o.-.' };
        else if (bridge && s === 4 && i < 4) rows = { sn: '............o...', h: 'o...o...o...o.-.', sh: '..-...-...-...-.' };
        else if (bridge && s === 4) rows = { k: 'x...............', sn: '....o.......o...', h: 'o.-.o.-.o.-.o.-.', sh: '..-...-...-...-.' };
        else if (chorus) {
          rows = { k: i % 2 ? 'x......x..x..o..' : 'x......x..x.....', sn: '....x.......x...',
            h: 'x.o-x.o.x.o-x.o.', sh: '-.o.-.o.-.o.-.o.', o: i % 4 === 3 ? '..............x.' : '................' };
          if (i % 4 === 1) { rows.ch = '.......o........'; rows.cl = '..........o..o..'; }
        } else {
          rows = { k: 'x......o..x.....', sn: '....x.......x...', h: 'x.o.x.o.x.o.x.o-', sh: '..-...o...-...o.' };
          if (i % 2) { rows.ch = '......o.........'; rows.cl = '.............o.o'; }
        }
        if (last) rows = { k: 'x...............', sn: '....o...........', h: 'x.o.x.o.........', ch: '........o..o....', cl: '..........o...oo' };
        add(drums, pattern(at, rows));
        if (i === 7 && !last) drums.push({ t: at + 2, d: 2, n: 'sw', v: sec === 'A' && s === 0 ? 0.5 : 0.8 });
        if (i === 0 && s > 0) drums.push({ t: at, d: 1, n: 'rd', v: 0.7 });
      });
    });

    /* ---- Melodie (notiert in der Lage des alten Stücks, klingt eine Oktave höher).
       Bewusst zurückhaltend, damit sie beim Spielen nicht drängt: wenige, lange Töne, Pausen zwischen den
       Phrasen. Meist singt sie die Melodiestimme mit deutlichem Vibrato auf den langen Tönen, im ersten
       Refrain und in der ersten Brücke übernimmt das Vibraphon. Der erste Achttakter bleibt ohne Thema. */
    var UP = { transpose: 12, vel: 0.7 };
    var BELL = { transpose: 12, vel: 0.66, gate: 1 };
    var PICKUP = 'B3/.25 D4/.25 E4/.25 G4/.5 A4/.5';
    var THEME = 'F#4/4:3.9 | _/2 D4/1.5 F#4/.5:3.2 | _/4 | _/2.25 ' + PICKUP + ' | F#4/4:3.9 | _/2 D4/1.5 B3/.5:2.6 | _/4 | _/4';
    var CHORUS = 'F#4/2:1.9 F#4/1 E4/.5 D4/.5 | _/.5 D4/3.5:3 | _/1 E4/1 F#4/1 E4/1 | D4/2:1.8 _/2 | ';
    var CHORUS_1 = CHORUS + 'F#4/2:1.9 F#4/1 E4/.5 D4/.5 | _/.5 F#4/2.5:2.3 D4/1 | C#4/2:1.9 _/.5 B3/.5 C#4/.5 D#4/.5:3 | _/4';
    var CHORUS_2 = CHORUS + 'F#4/2:1.9 A4/1 F#4/.5 E4/.5 | _/.5 F#4/1 D4/1 C#4/1 B3/.5:4.2 | _/4 | _/4';
    var BRIDGE = '_/1 D4/1.5 B3/.5 D4/.5 F#4/.5:1.4 | _/1 F#4/.5 D4/2.5:2.3 | _/1 C#4/3:4.3 | _/1.5 D4/.5 C#4/2:1.8 | ' +
      '_/1 F4/1.5 D4/.5 F4/1 | _/.5 G4/.5 A4/.5 F4/.5 D4/1 F4/1 | _/.5 E4/2 F#4/.5 E4/.5 C#4/.5:3.5 | _/4';
    add(lead, seq(30.25, PICKUP, UP));    // Auftakt in den zweiten Achttakter
    add(lead, seq(32, THEME, UP));
    add(vibes, seq(64, CHORUS_1, BELL));
    add(lead, seq(96, CHORUS_2, UP));
    add(vibes, seq(128, BRIDGE, BELL));
    add(lead, seq(160, BRIDGE, UP));
    add(lead, seq(192, CHORUS_1, UP));
    add(lead, seq(224, CHORUS_2, UP));

    /* ---- Vibraphon: kurze Antworten in den Lücken, wenn es nicht selbst die Melodie hat */
    var V = { vel: 0.6, gate: 1 };
    add(vibes, seq(8, '_/1 D5/.5 C#5/.5 A4/1 F#4/1', V));
    add(vibes, seq(24, '_/1.5 F#5/.5 D5/.5 B4/.5 A4/1', V));
    add(vibes, seq(40, '_/1 F#5/.5 E5/.5 C#5/.5 A4/.5 B4/1', V));
    add(vibes, seq(56, '_/.5 B5/.5 A5/.5 F#5/.5', V));
    add(vibes, seq(100, '_/2 B4/.5 D5/.5 F#5/1', V));
    add(vibes, seq(120, '_/1 F#5/.5 D5/.5 C#5/.5 A4/.5 B4/1 | _/1 D5/.5 F#5/.5 A5/1 F#5/1', V));
    add(vibes, seq(196, '_/2 B4/.5 D5/.5 F#5/1', V));
    add(vibes, seq(220, '_/.5 C5/.5 D#5/.5 F#5/.5 A5/1', V));
    add(vibes, seq(248, '_/1 F#5/.5 D5/.5 C#5/.5 A4/.5 B4/1 | _/1 D5/.5 F#5/.5', V));

    return {
      name: 'game', bpm: 100, bars: 64, swing: 0.54, seed: 11,
      fx: { reverbTime: 2.5, reverbSeconds: 3, delayBeats: 0.75, delayFeedback: 0.4, delayTone: 2400 },
      master: { wowCents: 5, flutterCents: 0.7, drive: 1.15, threshold: -17, ratio: 2.2, air: 1.5 },
      tracks: [
        { name: 'drums', inst: 'drums', notes: drums, gain: -1, reverb: -19, human: 0.003, velHuman: 0.15, opts: { levels: { h: 1.5, o: 1.4, sh: 1.9, sn: 1, rd: 1.6, sw: 1.5 } } },
        { name: 'bass', inst: 'bass', notes: bass, gain: -12, fx: { drive: 1.4 }, opts: { cutoff: 620, grit: 0.45 } },
        { name: 'pad', inst: 'pad', notes: pad, gain: -11, reverb: -9, duck: 0.22,
          fx: { hp: 180, phaser: { rate: 0.09, freq: 600, mix: 0.5 }, chorus: { rate: 0.45, depth: 0.003 } }, opts: { cutoff: 1500, attack: 0.55, release: 1.5 } },
        { name: 'ep', inst: 'ep', notes: ep, gain: -14, reverb: -12, delay: -22, duck: 0.12, human: 0.008, velHuman: 0.2,
          fx: { hp: 140, lp: 5200, autopan: { rate: 4.4, depth: 0.35 }, chorus: { rate: 0.7, depth: 0.0018, mix: 0.35 } }, opts: { decay: 1.7, bark: 1.25, tine: 0.8 } },
        { name: 'pluck', inst: 'pluck', notes: pluck, gain: -5.5, pan: 0.25, reverb: -12, delay: -8, human: 0.004, velHuman: 0.2, fx: { hp: 300 }, opts: { cutoff: 3600 } },
        { name: 'vibes', inst: 'vibes', notes: vibes, gain: -9, pan: -0.25, reverb: -7, delay: -14, human: 0.006, velHuman: 0.15,
          fx: { tremolo: { rate: 5.4, depth: 0.3 } }, opts: { decay: 1.2 } },
        { name: 'lead', inst: 'lead', notes: lead, gain: -9, reverb: -9, delay: -14,
          fx: { hp: 200, chorus: { rate: 0.5, depth: 0.0015, mix: 0.3 } }, opts: { cutoff: 2000, glide: 0.05, attack: 0.02, vibCents: 24, vibRate: 5.2, vibDelay: 0.15, vibRise: 0.09, vibFrom: 0.3,
            waves: [['sawtooth', -7, 0.4], ['sawtooth', 7, 0.4], ['triangle', 0, 0.55]] } }
      ]
    };
  };
})(window.MU = window.MU || {});
