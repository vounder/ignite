/* Zündung – Shopmusik. d-Moll, 104 BPM, 48 Takte (rund 1:51), nahtlose Schleife.
   Aus dem bisherigen Shopstück stammen die schleichende Akkordfolge (d – es – e – b – a) und die
   Melodielinien darüber samt Mittelteil. Neu sind Tempo, Klang und Begleitung: Bossa-Schlagwerk,
   laufender Bass, weicher Rechteck-Synth als Melodiestimme. */
(function (MU) {
  'use strict';
  MU.scores = MU.scores || {};

  var CH = {
    Dm9:    { bass: 'D2',  ep: 'F3 A3 C4 E4',  pad: 'D3 A3 C4 F4' },
    Eb69:   { bass: 'Eb2', ep: 'G3 Bb3 C4 F4', pad: 'Eb3 Bb3 F4 G4' },
    Em7b5:  { bass: 'E2',  ep: 'G3 Bb3 D4',    pad: 'E3 Bb3 D4 G4' },
    Bb13:   { bass: 'Bb2', ep: 'Ab3 D4 G4',    pad: 'Bb3 D4 Ab4' },
    A7alt:  { bass: 'A2',  ep: 'G3 C#4 F4',    pad: 'A3 C#4 G4' },
    A7sus:  { bass: 'A2',  ep: 'G3 B3 D4 E4',  pad: 'A3 D4 E4 G4' },
    Gm9:    { bass: 'G2',  ep: 'F3 A3 Bb3 D4', pad: 'G3 Bb3 D4 F4' },
    Bbmaj9: { bass: 'Bb2', ep: 'A3 C4 D4 F4',  pad: 'Bb3 D4 F4 A4' }
  };
  var VAMP = ['Dm9', 'Eb69', 'Em7b5:2 Bb13:1 A7alt:1', 'A7alt'];
  var BRIDGE = ['Gm9', 'A7alt', 'Dm9', 'Bbmaj9', 'Gm9', 'Bb13', 'A7sus', 'A7alt'];
  /* Ablauf in Viertaktern: v = nur Begleitung, 1/2/4 = Melodielinien, b = Mittelteil (acht Takte). */
  var ORDER = ['v', '1', '2', 'b', '1', '4', '2', 'b', '4', 'v'];
  var LINE = {
    '1': '_/1 Bb4/.5 A4/.5 G4/.5 A4/.5 F4/.75 E4/.25 | Eb4/3 _/.5 E4/.5 | _/.5 E4/.5 G4/.5 E4/.5 D4/.5 Bb3/.5 A3/1:2.4 | _/4',
    '2': '_/1 F4/.5 E4/.5 D4/2:1.8 | _/1.5 G4/1.5:1.4 _/.5 E4/.5 | _/1 Bb4/.5 G4/.5 E4/.5 D4/.5 C#4/1:2.6 | _/4',
    '4': '_/.5 D5/.5 C5/1.5:.5 C5/1 Bb4/.5 | _/.5 F4/1 G4/.5 G4/1.5:.6 G4/.5 | A4/.5 Bb4/.5 A4/1:.6 _/1 C4/.5 C#4/.5 | F4/1.5:1.3 _/.5 A3/.5 C4/.5 C#4/1:.9',
    'b': 'A4/1.5 Bb4/.5 A4/.5 C5/.5 Bb4/.5 A4/.5 | F4/.5 G4/.5 G4/2:1.8 _/.5 A4/.5 | D4/.5 E4/.5 F4/.5 A4/.5 _/1.25 F5/.75:2 | _/1.5 D5/.5 C5/.5 A4/.5 G4/1 | ' +
       'Bb4/1.5 A4/.5 G4/1 D4/1 | _/.5 F4/.5 Ab4/.5 G4/.5 F4/1 D4/1 | E4/2:1.9 D4/1 E4/1 | C#4/2:1.8 E4/.5 D4/.5 D4/.5 G4/.5'
  };

  MU.scores.shop = function () {
    var seq = MU.seq, pattern = MU.pattern;
    var lead = [], vibes = [], ep = [], pad = [], bass = [], pluck = [], drums = [];
    function add(list, notes) { notes.forEach(function (n) { list.push(n); }); }
    var bar = 0;

    ORDER.forEach(function (kind, s) {
      var form = kind === 'b' ? BRIDGE : VAMP, first = bar, at0 = first * 4;
      var second = s >= 4, intro = s === 0, outro = s === ORDER.length - 1;
      var cells = MU.cells(form, first);
      cells.forEach(function (cell, ci) {
        var c = CH[cell.name], at = cell.at, len = cell.len, nextCell = cells[ci + 1];
        add(pad, seq(at, '(' + c.pad + ')/' + len + ':' + (len + 0.2), { vel: 0.7 }));
        // E-Piano: kurze Einwürfe, synkopiert
        if (len === 4) add(ep, seq(at, '_/.5 (' + c.ep + ')/1:.35 (' + c.ep + ')*0.6/1.5:.8 (' + c.ep + ')*0.7/1:.3', { vel: 0.72 }));
        else if (len === 2) add(ep, seq(at, '_/.5 (' + c.ep + ')/1.5:.6', { vel: 0.7 }));
        else add(ep, seq(at, '(' + c.ep + ')/1:.5', { vel: 0.66 }));
        // Bass: im Mittelteil läuft er in Vierteln, sonst Grundton, Quinte und ein Schritt zum nächsten Akkord
        var r = MU.midi(c.bass), fifth = r + 7, third = r + (/m|sus/.test(cell.name) && !/maj/.test(cell.name) ? 3 : 4);
        var target = nextCell ? MU.midi(CH[nextCell.name].bass) : r, lean = target === r ? r + 12 : (target > r ? target - 1 : target + 1);
        if (len === 4 && kind === 'b') add(bass, [{ t: at, d: 0.8, n: r, v: 0.85 }, { t: at + 1, d: 0.8, n: third, v: 0.65 }, { t: at + 2, d: 0.8, n: fifth, v: 0.7 }, { t: at + 3, d: 0.8, n: lean, v: 0.65 }]);
        else if (len === 4) add(bass, [{ t: at, d: 1.3, n: r, v: 0.9 }, { t: at + 1.5, d: 0.4, n: fifth, v: 0.6 }, { t: at + 2, d: 0.8, n: r + 12, v: 0.65 }, { t: at + 3, d: 0.45, n: fifth, v: 0.55 }, { t: at + 3.5, d: 0.45, n: lean, v: 0.7 }]);
        else if (len === 2) add(bass, [{ t: at, d: 1.3, n: r, v: 0.85 }, { t: at + 1.5, d: 0.4, n: fifth, v: 0.55 }]);
        else add(bass, [{ t: at, d: 0.85, n: r, v: 0.8 }]);
        if (second && !outro && len >= 2) {
          var v = c.ep.split(' ').map(function (n) { return MU.midi(n) + 12; });
          for (var n = 0; n < len * 2; n++) if (n % 4 !== 3) pluck.push({ t: at + n * 0.5 + 0.25, d: 0.2, n: v[[1, 0, 2, 1][n % 4] % v.length], v: 0.55 });
        }
      });
      for (var i = 0; i < form.length; i++) {
        var at = at0 + i * 4, last = outro && i === 3, rows;
        if (intro) rows = { r: 'x..x..x...x..x..', sh: 'o.-.o.-.o.-.o.-.', k: i >= 2 ? 'x.....o.x.......' : '................' };
        else if (last) rows = { k: 'x.......x.......', r: 'x..x..x.........', ch: '..........o.o...', cl: '.............o.o' };
        else {
          rows = { k: 'x.....o.x.....o.', r: i % 2 ? '..x..x....x..x..' : 'x..x..x...x..x..', h: 'o.-.o.-.o.-.o.-.', sh: 'o.-oo.-oo.-oo.-o' };
          if (second) { rows.ch = i % 2 ? '......o.....o...' : '....o.....o.....'; rows.cl = i % 2 ? '..o......o......' : '.......o.....o.o'; }
          if (kind === 'b') rows.s = '....-.......o...';
        }
        add(drums, pattern(at, rows));
        if (i === form.length - 1 && !last) drums.push({ t: at + 2, d: 2, n: 'sw', v: 0.65 });
        if (i === 0 && s > 0 && (kind === 'b' || s === 4)) drums.push({ t: at, d: 1, n: 'rd', v: 0.6 });
      }
      if (LINE[kind]) add(lead, seq(at0, LINE[kind], { vel: 0.8 }));
      // Vibraphon: füllt die Pausen am Ende der Viertakter, im Mittelteil lange Töne
      if (kind === 'v') add(vibes, seq(at0, intro ? '_/4 | _/2 D5/.5 F5/.5 G5/1 | _/2.5 Bb5/.5 A5/1 | _/1 E5/.5 C#5/.5 A4/1 _/1'
        : '_/1 A5/.5 F5/.5 D5/1 _/1 | _/1.5 G5/.5 F5/.5 D5/.5 Bb4/1 | _/2.5 Ab5/.5 G5/1 | F5/.5 E5/.5 C#5/1 _/2', { vel: 0.62, gate: 1 }));
      else if (kind === 'b') add(vibes, seq(at0, 'D5/2 F5/2 | C#5/2 F5/2 | E5/2 C5/2 | D5/2 A4/2 | F5/2 D5/2 | D5/2 Ab4/2 | B4/2 D5/2 | C#5/2 _/2', { vel: 0.45, gate: 1 }));
      else add(vibes, seq(at0 + 12, kind === '1' ? '_/1.5 E5/.5 G5/.5 F5/.5 C#5/1' : kind === '2' ? '_/1 A5/.5 G5/.5 F5/.5 E5/.5 C#5/1' : '_/4', { vel: 0.6, gate: 1 }));
      if (second && kind === '1') add(vibes, seq(at0, LINE['1'].split(' | ')[0], { vel: 0.4, gate: 1, transpose: 12 }));
      bar += form.length;
    });

    return {
      name: 'shop', bpm: 104, bars: bar, swing: 0.55, seed: 37,
      fx: { reverbTime: 2.2, reverbSeconds: 2.8, delayBeats: 0.75, delayFeedback: 0.36, delayTone: 2600 },
      master: { wowCents: 4, flutterCents: 0.7, drive: 1.15, threshold: -17, ratio: 2.2, air: 2 },
      tracks: [
        { name: 'drums', inst: 'drums', notes: drums, gain: -1, reverb: -18, human: 0.003, velHuman: 0.15, opts: { levels: { h: 1.4, o: 1.4, sh: 1.7, s: 1.2, r: 1.25, rd: 1.5, sw: 1.5, ch: 1.2, cl: 1.2 } } },
        { name: 'bass', inst: 'bass', notes: bass, gain: -13.5, fx: { drive: 1.4 }, opts: { cutoff: 700, grit: 0.5 } },
        { name: 'pad', inst: 'pad', notes: pad, gain: -11, reverb: -9, duck: 0.2,
          fx: { hp: 180, phaser: { rate: 0.1, freq: 650, mix: 0.5 }, chorus: { rate: 0.45, depth: 0.003 } }, opts: { cutoff: 1400, attack: 0.4, release: 1.2 } },
        { name: 'ep', inst: 'ep', notes: ep, gain: -11, reverb: -12, delay: -18, duck: 0.1, human: 0.008, velHuman: 0.2,
          fx: { hp: 140, lp: 5600, autopan: { rate: 4.9, depth: 0.35 }, chorus: { rate: 0.7, depth: 0.0018, mix: 0.35 } }, opts: { decay: 1.4, bark: 1.4, tine: 0.9 } },
        { name: 'pluck', inst: 'pluck', notes: pluck, gain: -4, pan: 0.3, reverb: -12, delay: -9, human: 0.004, velHuman: 0.2, fx: { hp: 300 }, opts: { cutoff: 3400 } },
        { name: 'vibes', inst: 'vibes', notes: vibes, gain: -8, pan: -0.25, reverb: -8, delay: -14, human: 0.006, velHuman: 0.15,
          fx: { tremolo: { rate: 5.6, depth: 0.3 } }, opts: { decay: 1.1 } },
        { name: 'lead', inst: 'lead', notes: lead, gain: -6, reverb: -11, delay: -12,
          fx: { hp: 180, chorus: { rate: 0.5, depth: 0.0016, mix: 0.3 } },
          opts: { cutoff: 2300, glide: 0.04, vibCents: 14, q: 1.8, waves: [['square', -5, 0.42], ['sawtooth', 6, 0.3], ['triangle', 0, 0.45]] } }
      ]
    };
  };
})(window.MU = window.MU || {});
