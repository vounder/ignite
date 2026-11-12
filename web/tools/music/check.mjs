#!/usr/bin/env node
/* Zündung – prüft die Partituren ohne zu rechnen: Länge, Notenzahl je Spur, Tonumfang und
   Reibungen (Melodie eine kleine Sekunde oder None über einem Begleitton). Nicht jede ist ein Fehler –
   Vorhalte und die b9 über Dominanten sind gewollt –, aber jede sollte man kennen.

   node web/tools/music/check.mjs [Stück ...] */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const name = (m) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const box = { window: {} };
box.globalThis = box.window;
vm.createContext(box);
vm.runInContext(readFileSync(join(here, 'engine.js'), 'utf8'), box);
for (const f of readdirSync(join(here, 'scores')).filter((f) => f.endsWith('.js'))) vm.runInContext(readFileSync(join(here, 'scores', f), 'utf8'), box);
const all = Object.keys(box.window.MU.scores), asked = process.argv.slice(2);
const wanted = asked.length ? all.filter((n) => asked.some((a) => n === a || n.startsWith(a + '-'))) : all;
let problems = 0;
for (const piece of wanted) {
  const score = box.window.MU.scores[piece]();
  const beats = score.bars * (score.beatsPerBar || 4);
  console.log(`${piece}: ${score.bars} Takte, ${score.bpm} BPM, ${(beats * 60 / score.bpm).toFixed(1)} s`);
  const tonal = score.tracks.filter((t) => t.inst !== 'drums');
  for (const t of score.tracks) {
    const ns = t.notes;
    const out = ns.filter((n) => n.t < 0 || n.t >= beats);
    const pitched = ns.filter((n) => typeof n.n === 'number').map((n) => n.n);
    const range = pitched.length ? `${name(Math.min(...pitched))}–${name(Math.max(...pitched))}` : '';
    console.log(`  ${t.name.padEnd(6)} ${String(ns.length).padStart(5)} Noten ${range}${out.length ? `  !! ${out.length} außerhalb der Schleife` : ''}`);
    problems += out.length;
  }
  /* Reibungen: Melodieton klingt mindestens eine halbe Zählzeit gegen einen Begleitton im Halbtonabstand. */
  const melody = tonal.filter((t) => ['lead', 'vibes'].includes(t.name)).flatMap((t) => t.notes.map((n) => ({ ...n, track: t.name })));
  const backing = tonal.filter((t) => ['ep', 'pad', 'bass'].includes(t.name)).flatMap((t) => t.notes.map((n) => ({ ...n, track: t.name })));
  const seen = new Map();
  for (const a of melody) {
    if (a.d < 0.45) continue;
    for (const b of backing) {
      const overlap = Math.min(a.t + a.d, b.t + b.d) - Math.max(a.t, b.t);
      if (overlap < 0.5) continue;
      // nur die scharfe Lage: Melodie liegt eine kleine Sekunde oder None ÜBER dem Begleitton
      if (a.n <= b.n || (a.n - b.n) % 12 !== 1) continue;
      const key = `Takt ${Math.floor(a.t / 4) + 1}: ${a.track} ${name(a.n)} über ${name(b.n)} (${b.track})`;
      seen.set(key, Math.max(seen.get(key) || 0, overlap));
    }
  }
  [...seen.entries()].forEach(([k, v]) => console.log(`  Reibung ${v.toFixed(2)} Schläge – ${k}`));
}
process.exit(problems ? 1 : 0);
