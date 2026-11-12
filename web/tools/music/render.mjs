#!/usr/bin/env node
/* Zündung – rechnet die Musik aus den Partituren unter scores/ und kodiert sie als MP3.

   node web/tools/music/render.mjs [--out <Ordner>] [--stems] [--no-mp3] [--exact] [Stück ...]

   Ohne Stücknamen werden alle Partituren gerechnet. Ein Name wählt auch alle Stücke, die so beginnen:
   "game-rialto" rechnet die ruhige Fassung und die Boss-Stufe, "game" alle Häuser (--exact schaltet das ab). Die WAV-Dateien (und mit --stems die Einzelspuren)
   landen im Ausgabeordner (Standard: web/tools/music/out, nicht eingecheckt), die fertigen MP3 unter
   web/assets/audio/. Braucht Playwright mit Chromium sowie ffmpeg. */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, '..', '..');
const LUFS = -16;          // Ziel-Lautheit, wenn die Partitur keine eigene nennt (lufs)
const PEAK = 0.84;         // Spitzenbegrenzung (rund −1,5 dB)
const MP3_KBPS = 128;

const args = process.argv.slice(2);
function flag(name) { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; }
function option(name, fallback) { const i = args.indexOf(name); if (i < 0) return fallback; return args.splice(i, 2)[1]; }
const outDir = resolve(option('--out', join(here, 'out')));
const stems = flag('--stems'), noMp3 = flag('--no-mp3'), exact = flag('--exact');
const files = readdirSync(join(here, 'scores')).filter((f) => f.endsWith('.js'));
mkdirSync(outDir, { recursive: true });

function wav(file, left, right, sampleRate) {
  const n = left.length, buf = Buffer.alloc(44 + n * 8);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 8, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sampleRate, 24); buf.writeUInt32LE(sampleRate * 8, 28); buf.writeUInt16LE(8, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 8, 40);
  for (let i = 0; i < n; i++) { buf.writeFloatLE(left[i], 44 + i * 8); buf.writeFloatLE(right[i], 48 + i * 8); }
  writeFileSync(file, buf);
}

function measure(file) {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' });
  const text = String(run.stderr || '');
  const m = /I:\s+(-?[\d.]+) LUFS/.exec(text.slice(text.lastIndexOf('Summary')));
  return m ? parseFloat(m[1]) : NaN;
}

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('Playwright fehlt (NODE_PATH auf die globale Installation setzen).');
  process.exit(1);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on('console', (msg) => console.log('  [seite]', msg.text()));
  page.on('pageerror', (err) => console.error('  [fehler]', err.message));
  await page.addScriptTag({ content: readFileSync(join(here, 'engine.js'), 'utf8') });
  for (const f of files) await page.addScriptTag({ content: readFileSync(join(here, 'scores', f), 'utf8') });
  const all = await page.evaluate(() => Object.keys(window.MU.scores));
  const names = args.length ? all.filter((n) => args.some((a) => n === a || (!exact && n.startsWith(a + '-')))) : all;
  if (!names.length) { console.error('Kein Stück gefunden. Es gibt: ' + all.join(', ')); process.exitCode = 1; }
  for (const name of names) {
    const info = await page.evaluate((n) => {
      const s = window.MU.scores[n]();
      return { bars: s.bars, bpm: s.bpm, lufs: s.lufs, tracks: s.tracks.map((t) => t.name) };
    }, name);
    const jobs = [{ label: name, only: null }];
    if (stems) info.tracks.forEach((t) => jobs.push({ label: name + '.' + t, only: [t] }));
    for (const job of jobs) {
      const started = Date.now();
      const meta = await page.evaluate(async ({ n, only }) => {
        const out = await window.MU.render(window.MU.scores[n](), { only });
        window.__pcm = out;
        return { sampleRate: out.sampleRate, seconds: out.seconds, samples: out.left.length };
      }, { n: name, only: job.only });
      const channels = [];
      for (const key of ['left', 'right']) {
        const parts = [];
        for (let at = 0; at < meta.samples; at += 500000) {
          const b64 = await page.evaluate(({ key, at }) => {
            const bytes = new Uint8Array(window.__pcm[key].buffer, at * 4, Math.min(500000, window.__pcm[key].length - at) * 4);
            let s = '';
            for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
            return btoa(s);
          }, { key, at });
          parts.push(Buffer.from(b64, 'base64'));
        }
        const raw = Buffer.concat(parts);
        channels.push(new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4));
      }
      const file = join(outDir, job.label + '.wav');
      wav(file, channels[0], channels[1], meta.sampleRate);
      const lufs = measure(file);
      console.log(`${job.label}: ${meta.seconds.toFixed(2)} s, ${info.bars} Takte bei ${info.bpm} BPM, ${lufs} LUFS (${((Date.now() - started) / 1000).toFixed(1)} s Rechenzeit)`);
      if (!job.only && !noMp3) {
        const gain = (info.lufs == null ? LUFS : info.lufs) - lufs;
        const target = join(web, 'assets', 'audio', name + '.mp3');
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', file,
          '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=${PEAK}:level=false:attack=3:release=60`,
          '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', MP3_KBPS + 'k', target]);
        console.log(`  → ${target} (${gain >= 0 ? '+' : ''}${gain.toFixed(1)} dB, ${measure(target)} LUFS)`);
      }
    }
  }
  await page.close();
} finally {
  await browser.close();
}
