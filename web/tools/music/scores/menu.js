/* Zündung – Menümusik. b-Moll, 84 BPM, 48 Takte (rund 2:17), nahtlose Schleife.
   Aus dem bisherigen Menüstück stammen das perlende Thema (b f b es f – c – b …) und die aufsteigende
   Gegenmelodie des Mittelteils. Neu sind Harmonien, Tempo und Klang: ruhiger, verträumter als im Spiel. */
(function (MU) {
  'use strict';
  MU.scores = MU.scores || {};

  var CH = {
    Ebm9:    { bass: 'Eb2', ep: 'Gb3 Bb3 Db4 F4', pad: 'Eb3 Bb3 Db4 Gb4' },
    F7sus:   { bass: 'F2',  ep: 'Eb3 Bb3 C4 G4',  pad: 'F3 Bb3 C4 Eb4' },
    Bbm9:    { bass: 'Bb2', ep: 'Ab3 C4 Db4 F4',  pad: 'Bb3 Db4 F4 Ab4' },
    Bb7alt:  { bass: 'Bb2', ep: 'Ab3 D4 Gb4',     pad: 'Bb3 D4 Ab4' },
    Dbmaj9:  { bass: 'Db2', ep: 'F3 Ab3 C4 Eb4',  pad: 'Db3 Ab3 C4 F4' },
    Gbmaj9:  { bass: 'Gb2', ep: 'Bb3 Db4 F4 Ab4', pad: 'Gb3 Db4 F4 Bb4' },
    Ab13:    { bass: 'Ab2', ep: 'Gb3 Bb3 C4 F4',  pad: 'Ab3 C4 Gb4' },
    Ab13sus: { bass: 'Ab2', ep: 'Gb3 Bb3 Db4 F4', pad: 'Ab3 Db4 Gb4' },
    Gm7b5:   { bass: 'G2',  ep: 'F3 Bb3 Db4',     pad: 'G3 Bb3 Db4 F4' },
    F7alt:   { bass: 'F2',  ep: 'Eb3 A3 Db4 Ab4', pad: 'F3 A3 Eb4' },
    Cm7b5:   { bass: 'C3',  ep: 'Bb3 Eb4 Gb4',    pad: 'C3 Gb3 Bb3 Eb4' }
  };
  var FORM = {
    A: ['Ebm9 F7sus', 'Bbm9 Bb7alt', 'Ebm9 F7sus', 'Dbmaj9 Gbmaj9', 'Ebm9 Ab13', 'Bbm9', 'Gm7b5:2 F7alt:1 F7sus:1', 'Bbm9'],
    B: ['Bbm9', 'Gbmaj9', 'F7alt Bbm9', 'Ebm9 Ab13sus', 'Dbmaj9 Ebm9', 'Cm7b5 F7alt', 'Bbm9 Ab13sus', 'Gm7b5 F7alt']
  };
  var ORDER = ['A', 'A', 'B', 'A', 'B', 'A'];
  /* Das Thema: je Takt eine Phrase in Sechzehnteln. */
  var THEME = '_/.25 Bb5/.25 F5/.25 Bb4/.25 Eb5/.25 F5/.5 C5/1 Bb4/1.25 | ' +
    '_/.25 Eb5/.25 C5/.25 Ab4/.25 F4/.25 C5/.25 Ab4/.25 Bb4/2.25:2 | ' +
    '_/.25 Bb5/.25 F5/.25 Bb4/.25 Eb5/.25 F5/.5 C5/1 Bb4/1:.9 C5/.25 | ' +
    '_/.25 C5/1 Bb4/.25 Ab4/.25 Bb4/2.25:2 | ' +
    '_/.25 Bb5/.25 F5/.25 Db5/.25 Eb5/.25 F5/.5 C5/1 Bb4/1.25 | ' +
    '_/.25 Eb5/.25 C5/.25 Ab4/.25 F4/.25 C5/.25 Ab4/.25 Bb4/2.25:2 | ' +
    '_/.5 C5/.25 Db5/.25 C5/.25 Bb4/.5 Db5/.75 C5/.5 Bb4/.5 C5/.25 Bb4/.25:2.2 | _/4';
  var MIDDLE = '_/2.5 Bb4/.25 Db5/.25 F5/1 | _/.75 Ab4/.25 Bb4/.5 Db5/.25 F5/1 Gb5/.5 F5/.5 Eb5/.25:1.2 | ' +
    '_/1.25 Ab4/.5 C5/.75:.6 Ab4/.25 G4/.25 F4/1:.9 | _/.75 F4/.25 Gb4/.5 Bb4/.25 Db5/1 Eb5/.5 Db5/.5 Eb5/.25:.22 | ' +
    '_/1 Ab4/1.5 Eb4/.5 Gb4/.5 F4/.5 | _/1 Eb4/.5 Bb4/.25 C5/1 C5/.75 Gb5/.5:.45 | ' +
    'F5/2:1.9 Bb4/2:1.9 | _/.75 Bb4/.75 F4/.5 Db5/.5 C5/.5 Eb5/.5 Db5/.5:.45';

  MU.scores.menu = function () {
    var seq = MU.seq, pattern = MU.pattern;
    var lead = [], vibes = [], ep = [], pad = [], bass = [], pluck = [], drums = [];
    function add(list, notes) { notes.forEach(function (n) { list.push(n); }); }

    ORDER.forEach(function (sec, s) {
      var first = s * 8, at0 = first * 4;
      var quiet = s === 0, full = s >= 3 && s < 5, ending = s === 5;
      MU.cells(FORM[sec], first).forEach(function (cell) {
        var c = CH[cell.name], at = cell.at, len = cell.len;
        add(pad, seq(at, '(' + c.pad + ')/' + len + ':' + (len + 0.25), { vel: 0.7 }));
        // E-Piano: liegender Akkord, im Mittelteil leicht nachgeschlagen
        if (sec === 'B' && len === 4) add(ep, seq(at, '(' + c.ep + ')/1.75:1.5 (' + c.ep + ')*0.55/2.25:1.9', { vel: 0.68 }));
        else add(ep, seq(at, '(' + c.ep + ')/' + len + ':' + (len * 0.9), { vel: cell.part ? 0.6 : 0.7 }));
        var r = MU.midi(c.bass), fifth = r + 7 > 50 ? r - 5 : r + 7;
        if (quiet) add(bass, [{ t: at, d: len * 0.9, n: r, v: 0.7 }]);
        else if (len === 4) add(bass, [{ t: at, d: 1.6, n: r, v: 0.85 }, { t: at + 1.75, d: 0.2, n: r, v: 0.5 }, { t: at + 2.5, d: 0.7, n: fifth, v: 0.65 }, { t: at + 3.5, d: 0.45, n: r, v: 0.6 }]);
        else add(bass, [{ t: at, d: len * 0.7, n: r, v: 0.85 }, { t: at + len - 0.5, d: 0.4, n: cell.part ? fifth : r, v: 0.55 }]);
        // Zupfer: Akkordtöne in Achteln, nur in den volleren Teilen
        if (full || (sec === 'B' && s === 2)) {
          var v = c.ep.split(' ').map(function (n) { return MU.midi(n) + 12; });
          for (var n = 0; n < len * 2; n++) pluck.push({ t: at + n * 0.5, d: 0.3, n: v[[0, 2, 1, v.length - 1][n % 4] % v.length], v: n % 2 ? 0.5 : 0.68 });
        }
      });
      for (var i = 0; i < 8; i++) {
        var at = at0 + i * 4, last = ending && i === 7, rows;
        if (quiet) rows = { sh: '..-...o...-...o.', r: i >= 4 ? '............o...' : '................' };
        else if (last) rows = { k: 'x...............', h: 'o.-.o.-.........', ch: '..........o..o..' };
        else if (full) rows = { k: i % 2 ? 'x.....o...x.....' : 'x.........x..o..', r: '....x.......x...', s: '............o...', h: 'x.-ox.-.x.-ox.-.', sh: '..o...o...o...o.' };
        else rows = { k: 'x.........x.....', r: '....x.......x...', h: 'o.-.o.-.o.-.o.-.', sh: '..-...o...-...o.' };
        if (!quiet && !last && i % 4 === 3) { rows.ch = '.........o..o...'; rows.cl = '..............o.'; }
        add(drums, pattern(at, rows));
        if (i === 7 && !last) drums.push({ t: at + 2, d: 2, n: 'sw', v: quiet ? 0.5 : 0.75 });
        if (i === 0 && s > 0) drums.push({ t: at, d: 1, n: 'rd', v: 0.6 });
      }
      /* Melodie */
      if (sec === 'A') {
        add(vibes, seq(at0, THEME, { vel: quiet ? 0.7 : 0.78, gate: 1 }));
        if (s === 1 || full) add(pluck, seq(at0, THEME, { vel: 0.5, transpose: -12 }));
        if (s === 3) add(lead, seq(at0, 'F5/4:3.8 | _/2 Db5/2:1.9 | Eb5/3 F5/1:.9 | Ab5/2 F5/2:1.8 | Db5/2 C5/1 Eb5/1:.9 | F5/4:3.6 | _/2 Db5/1 Eb5/1:.9 | F5/3:2.8 _/1', { vel: 0.6 }));
        if (ending) add(lead, seq(at0 + 16, 'Db5/2 C5/1 Eb5/1:.9 | F5/4:3.6 | _/2 Db5/1 Eb5/1:.9 | F5/3:2.6 _/1', { vel: 0.55 }));
      } else {
        add(lead, seq(at0, MIDDLE, { vel: 0.8 }));
        add(lead, seq(at0 + 32, 'C5/1:.9', { vel: 0.7 })); // löst sich in den ersten Takt des Themas auf
        if (s === 4) add(vibes, seq(at0, '_/1 F5/.5 Db5/.5 Bb4/2 | Bb5/2 Ab5/2 | _/2 F5/1 Db5/1 | Bb5/2 Ab5/2 | Ab5/2 Bb5/2 | Gb5/2 Eb5/2 | Ab5/2 F5/2 | Db5/2 C5/2', { vel: 0.45, gate: 1 }));
      }
    });

    return {
      name: 'menu', bpm: 84, bars: 48, swing: 0.56, seed: 23,
      fx: { reverbTime: 3, reverbSeconds: 3.6, delayBeats: 0.75, delayFeedback: 0.42, delayTone: 2300 },
      master: { wowCents: 5, flutterCents: 0.8, drive: 1.15, threshold: -17, ratio: 2.2, air: 2.5 },
      tracks: [
        { name: 'drums', inst: 'drums', notes: drums, gain: -1.5, reverb: -16, human: 0.003, velHuman: 0.15, opts: { levels: { h: 1.5, o: 1.4, sh: 2.0, s: 1.2, r: 1.1, rd: 1.5, sw: 1.5 } } },
        { name: 'bass', inst: 'bass', notes: bass, gain: -12, fx: { drive: 1.4 }, opts: { cutoff: 620, grit: 0.45 } },
        { name: 'pad', inst: 'pad', notes: pad, gain: -10.5, reverb: -8, duck: 0.18,
          fx: { hp: 180, phaser: { rate: 0.07, freq: 600, mix: 0.55 }, chorus: { rate: 0.4, depth: 0.0032 } }, opts: { cutoff: 1500, attack: 0.7, release: 1.8 } },
        { name: 'ep', inst: 'ep', notes: ep, gain: -18, reverb: -10, delay: -20, duck: 0.1, human: 0.01, velHuman: 0.2,
          fx: { hp: 140, lp: 5200, autopan: { rate: 3.6, depth: 0.4 }, chorus: { rate: 0.6, depth: 0.002, mix: 0.4 } }, opts: { decay: 2.2, bark: 1.1, tine: 0.7 } },
        { name: 'pluck', inst: 'pluck', notes: pluck, gain: -7, pan: 0.25, reverb: -11, delay: -8, human: 0.004, velHuman: 0.2, fx: { hp: 300 }, opts: { cutoff: 3200 } },
        { name: 'vibes', inst: 'vibes', notes: vibes, gain: -6, pan: -0.15, reverb: -8, delay: -13, human: 0.005, velHuman: 0.18,
          fx: { tremolo: { rate: 4.8, depth: 0.28 } }, opts: { decay: 1.3 } },
        { name: 'lead', inst: 'lead', notes: lead, gain: -6.5, reverb: -9, delay: -11,
          fx: { hp: 200, chorus: { rate: 0.5, depth: 0.0015, mix: 0.3 } }, opts: { cutoff: 2400, glide: 0.05, vibCents: 18, waves: [['sawtooth', -7, 0.45], ['sawtooth', 7, 0.45], ['triangle', 0, 0.5]] } }
      ]
    };
  };
})(window.MU = window.MU || {});
