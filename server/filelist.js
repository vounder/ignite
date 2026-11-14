'use strict';
/* Zündung – Dateiliste der Browser-Version: jede ausgelieferte Datei mit SHA-256 und Größe, dazu eine
   Kennung über alles zusammen ("build"). Daran erkennen die Offline-Web-App und die Android-App, ob es
   eine neuere Fassung gibt und welche Dateien sich geändert haben.

   Der Server liefert die Liste unter /files.json; die Android-App bekommt sie beim Bauen mit:

       node server/filelist.js web > files.json */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/* Nicht Teil des Spiels: Werkzeuge, Tests, Dokumentation, die App-Hülle des Browsers und die Liste selbst. */
const SKIP_DIRS = new Set(['tools', 'tests']);
const SKIP_FILES = new Set(['sw.js', 'files.json']);

function walk(root, dir, out) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const rel = dir ? dir + '/' + entry.name : entry.name;
    if (entry.isDirectory()) {
      if (!dir && SKIP_DIRS.has(entry.name)) continue;
      walk(root, rel, out);
    } else if (entry.isFile() && !SKIP_FILES.has(rel) && !rel.endsWith('.md')) {
      out.push(rel);
    }
  }
}

/* Liefert eine Funktion, die die aktuelle Liste zurückgibt. Gemerkt wird je Datei Größe und Änderungszeit:
   Ein erneuter Aufruf liest nur, was sich seither geändert hat. */
function createFileList(webRoot) {
  const known = new Map(); // Pfad -> { size, mtime, hash }
  let last = null, lastKey = '';
  return function list() {
    const paths = [];
    walk(webRoot, '', paths);
    paths.sort();
    const files = {};
    let bytes = 0, key = '';
    for (const rel of paths) {
      const stat = fs.statSync(path.join(webRoot, rel));
      let entry = known.get(rel);
      if (!entry || entry.size !== stat.size || entry.mtime !== stat.mtimeMs) {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(webRoot, rel))).digest('hex');
        entry = { size: stat.size, mtime: stat.mtimeMs, hash };
        known.set(rel, entry);
      }
      files[rel] = [entry.hash, entry.size];
      bytes += entry.size;
      key += rel + '\0' + entry.hash + '\n';
    }
    if (key !== lastKey) {
      lastKey = key;
      for (const rel of known.keys()) if (!files[rel]) known.delete(rel);
      last = { build: crypto.createHash('sha256').update(key).digest('hex').slice(0, 12), bytes, files };
    }
    return last;
  };
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'web'));
  process.stdout.write(JSON.stringify(createFileList(root)()) + '\n');
}

module.exports = { createFileList };
