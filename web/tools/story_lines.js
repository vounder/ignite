#!/usr/bin/env node
/* Zündung – Werkzeug für die Vertonung.

   Alle Texte, die gesprochen werden können, haben eine feste Kennung:
     story/<szene>-<nr>            Zeilen der Geschichte (js/story.js), auch Erzähler und Schlagzeilen
     say/<figur>/<anlass>-<nr>     Sprüche am Kartentisch (start, attack, hurt, nervous, gloat, win, lose)
   Die Aufnahme zu einer Kennung liegt unter web/assets/voice/<kennung>.mp3.

   Aufrufe (aus dem Wurzelverzeichnis des Repos):
     node web/tools/story_lines.js export [datei.json]   Liste aller Zeilen: Kennung, Datei, Sprecher, Rolle, Stimmung, Text
     node web/tools/story_lines.js export --csv [datei]  dasselbe als CSV (Semikolon, UTF-8)
     node web/tools/story_lines.js manifest              schreibt web/js/voice-manifest.js aus den vorhandenen Aufnahmen
     node web/tools/story_lines.js manifest --refresh    übernimmt auch für schon eingetragene Aufnahmen den heutigen Text

   Das Verzeichnis merkt sich zu jeder Aufnahme den Fingerabdruck des Textes, für den sie gesprochen wurde. Ändert sich
   der Text später, passt der Fingerabdruck nicht mehr: Das Spiel lässt die Aufnahme dann weg (und zeigt nur den Text),
   und "manifest" meldet die Zeile als veraltet, bis sie neu aufgenommen und mit --refresh bestätigt ist. */
'use strict';
const fs = require('fs');
const path = require('path');
const WEB = path.resolve(__dirname, '..');
['data', 'lore', 'cast2-text', 'cast2', 'story', 'voice-manifest'].forEach(f => require(path.join(WEB, 'js', f + '.js')));
const ZU = globalThis.ZU;

const SAY_KINDS = ['start', 'attack', 'hurt', 'nervous', 'gloat', 'win', 'lose'];
const SAY_MOOD = { start: 'Begrüßung', attack: 'hämisch, im Angriff', hurt: 'getroffen, verärgert', nervous: 'nervös, kurz vor der Niederlage', gloat: 'siegessicher', win: 'hat gewonnen', lose: 'hat verloren' };
function speaker(who) {
  if (who === 'erzaehler') return { name: 'Erzähler', gender: 'neutral', role: 'Erzählstimme: ruhig, trocken, Film noir; spricht den Spieler mit „du“ an' };
  if (who === 'zeitung') return { name: 'Piet', gender: 'm', role: 'Zeitungsjunge, ruft Schlagzeilen aus' };
  if (who === 'manfred') return { name: 'Manfred', gender: 'm', role: 'Händler, Mentor: geschäftstüchtig, verschmitzt, warm' };
  if (who === 'esme') return { name: 'Esme', gender: 'w', role: 'Wahrsagerin: spöttisch, tief, wissend' };
  const e = ZU.ENEMIES[who], v = ZU.VOICES[who] || ['a', 1];
  return { name: e ? e.name : who, gender: 'fg'.indexOf(v[0]) >= 0 ? 'w' : 'm', role: e ? e.role : '' };
}
function allLines() {
  const out = [];
  Object.keys(ZU.STORY).forEach(scene => {
    ZU.storyLines(scene).forEach(line => {
      const sp = speaker(line.who);
      out.push({ key: 'story/' + line.id, scene: ZU.STORY[scene].title, who: line.who, name: line.name, gender: sp.gender, role: sp.role, mood: line.mood, text: line.text });
    });
  });
  Object.keys(ZU.ENEMIES).forEach(id => {
    const sp = speaker(id);
    SAY_KINDS.forEach(kind => (ZU.ENEMIES[id].say[kind] || []).forEach((text, i) => {
      out.push({ key: 'say/' + id + '/' + kind + '-' + (i + 1), scene: 'Kartentisch', who: id, name: sp.name, gender: sp.gender, role: sp.role, mood: SAY_MOOD[kind], text: text });
    }));
  });
  out.forEach(line => { line.file = 'web/assets/voice/' + line.key + '.mp3'; line.hash = ZU.textHash(line.text); });
  return out;
}

const [cmd, ...args] = process.argv.slice(2);
if (cmd === 'export') {
  const csv = args.includes('--csv'), target = args.filter(a => !a.startsWith('--'))[0];
  const lines = allLines();
  const text = csv
    ? ['Kennung;Datei;Sprecher;Geschlecht;Rolle;Szene;Stimmung;Text'].concat(lines.map(l => [l.key, l.file, l.name, l.gender, l.role, l.scene, l.mood, l.text].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(';'))).join('\n') + '\n'
    : JSON.stringify(lines, null, 1) + '\n';
  if (target) fs.writeFileSync(target, text); else process.stdout.write(text);
  const speakers = new Set(lines.map(l => l.who));
  console.error(lines.length + ' Zeilen (' + lines.filter(l => l.key.startsWith('story/')).length + ' Geschichte, ' + lines.filter(l => l.key.startsWith('say/')).length + ' Kartentisch), ' +
    speakers.size + ' Sprecher, ' + lines.reduce((n, l) => n + l.text.length, 0) + ' Zeichen');
} else if (cmd === 'manifest') {
  const refresh = args.includes('--refresh'), dir = path.join(WEB, 'assets', 'voice');
  const have = [];
  (function walk(d, rel) {
    if (!fs.existsSync(d)) return;
    fs.readdirSync(d).forEach(name => {
      const full = path.join(d, name);
      if (fs.statSync(full).isDirectory()) walk(full, rel + name + '/');
      else if (name.endsWith('.mp3')) have.push(rel + name.slice(0, -4));
    });
  })(dir, '');
  const known = ZU.VOICE_FILES || {}, byKey = {}, out = {}, stale = [], unknown = [];
  allLines().forEach(l => { byKey[l.key] = l; });
  have.sort().forEach(key => {
    if (!byKey[key]) { unknown.push(key); return; }
    out[key] = known[key] && !refresh ? known[key] : byKey[key].hash;
    if (out[key] !== byKey[key].hash) stale.push(key);
  });
  const body = Object.keys(out).map(k => "    '" + k + "': '" + out[k] + "'").join(',\n');
  fs.writeFileSync(path.join(WEB, 'js', 'voice-manifest.js'), `/* Zündung – Verzeichnis der Sprachaufnahmen. Erzeugt von web/tools/story_lines.js (Aufruf: manifest); nicht von Hand ändern.
   Kennung der Zeile -> Fingerabdruck des Textes, zu dem die Aufnahme gehört (assets/voice/<kennung>.mp3). */
(function (ZU) {
  'use strict';
  ZU.VOICE_FILES = {${body ? '\n' + body + '\n  ' : ''}};
})(typeof window !== 'undefined' ? (window.ZU = window.ZU || {}) : (globalThis.ZU = globalThis.ZU || {}));
`);
  console.log(Object.keys(out).length + ' Aufnahmen eingetragen, ' + (Object.keys(byKey).length - Object.keys(out).length) + ' Zeilen noch ohne Aufnahme.');
  if (stale.length) console.log('Veraltet (Text seit der Aufnahme geändert, wird nicht abgespielt):\n  ' + stale.join('\n  '));
  if (unknown.length) console.log('Ohne passende Zeile (Datei ist überzählig):\n  ' + unknown.join('\n  '));
} else {
  console.log('Aufruf: node web/tools/story_lines.js export [--csv] [datei] | manifest [--refresh]');
  process.exit(1);
}
