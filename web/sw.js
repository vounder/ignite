/* Zündung – App-Hülle. Macht das Spiel als App installierbar und speichert bewusst nichts zwischen:
   Jeder Start lädt den aktuellen Stand. Behandelt werden nur Seitenaufrufe (kurzer Hinweis ohne Netz);
   Skripte, Bilder, Musik und die Konto-API gehen direkt ans Netz. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (event) {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(function () {
    return new Response(
      '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Zündung</title>'
      + '<body style="background:#0b0706;color:#f3e9d2;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0;text-align:center">'
      + '<p>Zündung braucht eine Internetverbindung.<br><br><a href="" style="color:#ffd75e">Erneut versuchen</a></p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});
