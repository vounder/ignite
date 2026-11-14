/* Zündung – App-Hülle. Macht das Spiel als App installierbar und liefert es ohne Netz aus dem Gerätespeicher,
   sobald dort eine vollständige Fassung liegt (die legt js/offline.js an, siehe dort). Ohne gespeicherte
   Fassung geht alles wie bisher direkt ans Netz.

   Ablage (Cache Storage):
     zu-state                  Zeiger { current, staged }: die Fassung, die läuft, und eine fertig geladene neuere
     zu-build-<Kennung>        alle Dateien einer Fassung, Schlüssel = Adresse ohne ?v=…
   Eine neuere Fassung wird erst beim nächsten Seitenaufruf übernommen, nie mitten im Spiel: Sonst träfen
   Skripte der alten auf Bilder und Daten der neuen. Konto-API, Dateiliste und App-Download gehen immer ans Netz. */
var SCOPE = self.registration.scope;
var ROOT = new URL(SCOPE).pathname;
var STATE = 'zu-state', PREFIX = 'zu-build-', STATE_URL = SCOPE + '__offline/state';
var memo = null; // zuletzt gelesener Zeiger; die Seite meldet Änderungen

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'zu-state') memo = null;
});

function readState() {
  if (memo) return Promise.resolve(memo);
  return caches.match(STATE_URL, { cacheName: STATE })
    .then(function (hit) { return hit ? hit.json() : {}; })
    .catch(function () { return {}; })
    .then(function (state) { memo = state || {}; return memo; });
}

function writeState(state) {
  memo = state;
  return caches.open(STATE).then(function (cache) {
    return cache.put(STATE_URL, new Response(JSON.stringify(state), { headers: { 'Content-Type': 'application/json' } }));
  });
}

/* Räumt Fassungen weg, auf die kein Zeiger mehr zeigt. */
function sweep(state) {
  return caches.keys().then(function (names) {
    return Promise.all(names.map(function (name) {
      if (name.indexOf(PREFIX) !== 0) return null;
      var build = name.slice(PREFIX.length);
      return build === state.current || build === state.staged ? null : caches.delete(name);
    }));
  }).catch(function () {});
}

/* Die Fassung, aus der geantwortet wird. Bei einem Seitenaufruf rückt eine fertig geladene neuere nach. */
function currentBuild(event, start) {
  if (start) memo = null; // beim Start immer frisch lesen
  return readState().then(function (state) {
    if (!start || !state.staged) return state.current || null;
    var next = { current: state.staged };
    return writeState(next).then(function () {
      event.waitUntil(sweep(next));
      return next.current;
    });
  });
}

/* Musik wird in Stücken angefragt (Range); Safari spielt sie nur, wenn auch in Stücken geantwortet wird. */
function ranged(request, response) {
  var match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
  if (!match || (match[1] === '' && match[2] === '')) return response;
  return response.blob().then(function (blob) {
    var size = blob.size, start, end;
    if (match[1] === '') {
      start = Math.max(0, size - Number(match[2]));
      end = size - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === '' ? size - 1 : Math.min(size - 1, Number(match[2]));
    }
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
    }
    return new Response(blob.slice(start, end + 1), {
      status: 206,
      statusText: 'Partial Content',
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes'
      }
    });
  });
}

function noNetwork() {
  return new Response(
    '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Zündung</title>'
    + '<body style="background:#0b0706;color:#f3e9d2;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0;text-align:center">'
    + '<p>Zündung braucht für den ersten Start eine Internetverbindung.<br>Als App installiert läuft es danach auch ohne.'
    + '<br><br><a href="" style="color:#ffd75e">Erneut versuchen</a></p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET' || request.url.indexOf(SCOPE) !== 0) return;
  if (request.headers.get('x-zu-direct')) return; // js/offline.js lädt eine neue Fassung: immer vom Netz
  var rel = new URL(request.url).pathname.slice(ROOT.length);
  if (/^(api|app|__offline)\//.test(rel) || rel === 'files.json' || rel === 'sw.js') return;
  if (rel === '' || rel.charAt(rel.length - 1) === '/') rel += 'index.html';
  var start = request.mode === 'navigate' && rel === 'index.html';
  // Liegt nichts auf dem Gerät (der Normalfall im Browser), bleibt die Anfrage ganz beim Browser.
  if (!start && memo && !memo.current && !memo.staged) return;
  event.respondWith(currentBuild(event, start).then(function (build) {
    if (!build) return null;
    return caches.open(PREFIX + build).then(function (cache) { return cache.match(SCOPE + rel); });
  }).catch(function () { return null; }).then(function (hit) {
    if (hit) return ranged(request, hit);
    return fetch(request).catch(function (error) {
      if (request.mode === 'navigate') return noNetwork();
      throw error;
    });
  }));
});
