'use strict';
/* Prüft im echten Browser: Offline-Ablage, Start ohne Netz, Updates (beim Start, im Hintergrund, „Später“),
   Nachreichen von Runs und Fortschritt ans Konto, Angebot der Android-App.

   Braucht Node >= 22.13 (wie der Server) und Playwright:

       node web/tests/offline_e2e.js

   Der Test arbeitet auf einer Kopie von web/ in einem temporären Ordner und startet dafür einen eigenen Server. */
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { createApp } = require('../../server/server');

const WEB = path.resolve(__dirname, '..');

function copyWeb(target) {
  fs.cpSync(WEB, target, {
    recursive: true,
    filter: source => !['tools', 'tests'].includes(path.relative(WEB, source).split(path.sep)[0])
  });
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zuendung-offline-'));
  const webRoot = path.join(tmp, 'web'), appDir = path.join(tmp, 'app');
  copyWeb(webRoot);
  fs.mkdirSync(appDir);
  const app = createApp({ port: 0, host: '127.0.0.1', dataDir: path.join(tmp, 'data'), webRoot, appDir, quiet: true });
  const base = 'http://127.0.0.1:' + (await app.listen()).port + '/';
  const browser = await chromium.launch();
  const lore = path.join(webRoot, 'js', 'lore.js'), loreSource = fs.readFileSync(lore, 'utf8');
  const mark = n => fs.writeFileSync(lore, loreSource + '\nwindow.ZU_TEST_MARK = ' + n + ';\n');

  async function open(options) {
    const context = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 720 } }, options || {}));
    // Vorspann und Anleitung überspringen
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem('zuendung.splash', '1');
        if (!localStorage.getItem('zuendung.web.profile.v1')) localStorage.setItem('zuendung.web.profile.v1', JSON.stringify({ seenHelp: true }));
      } catch (e) { /* egal */ }
    });
    const page = await context.newPage();
    page.on('pageerror', error => { throw error; });
    return { context, page };
  }
  const menu = page => page.waitForFunction(() => window.ZU && ZU.game && ZU.game.screen === 'menu', null, { timeout: 30000 });
  const state = (page, want) => page.waitForFunction(s => ZU.offline.status.state === s, want, { timeout: 60000 });
  const stored = page => page.evaluate(async () => {
    const hit = await caches.match(new URL('__offline/state', location.href).href, { cacheName: 'zu-state' });
    return { state: hit ? await hit.json() : {}, caches: (await caches.keys()).sort() };
  });

  const { context, page } = await open();
  const direct = [];
  page.on('request', request => { if (request.headers()['x-zu-direct']) direct.push(new URL(request.url()).pathname); });

  // --- erste Ablage: auf Wunsch, vollständig, geprüft ---
  await page.goto(base);
  await menu(page);
  assert.strictEqual(await page.evaluate(() => ZU.offline.status.state), 'off', 'im Browser ist die Ablage zunächst aus');
  assert.deepStrictEqual((await stored(page)).caches, [], 'ohne Wunsch wird nichts abgelegt');
  const list = await (await fetch(base + 'files.json')).json();
  await page.evaluate(() => ZU.offline.enable(true));
  await state(page, 'ready');
  let now = await stored(page);
  assert.strictEqual(now.state.current, list.build);
  assert.deepStrictEqual(now.caches, ['zu-build-' + list.build, 'zu-state']);
  const count = await page.evaluate(async build => (await (await caches.open('zu-build-' + build)).keys()).length, list.build);
  assert.strictEqual(count, Object.keys(list.files).length + 1, 'jede Datei der Liste liegt im Speicher');
  assert.strictEqual(direct.length, Object.keys(list.files).length);

  // --- Start ohne Netz ---
  await context.setOffline(true);
  await page.reload();
  await menu(page);
  assert.strictEqual(await page.evaluate(() => ZU.offline.status.state), 'ready');
  const offline = await page.evaluate(async () => {
    const part = await fetch(ZU.asset('audio/menu.mp3'), { headers: { Range: 'bytes=100-199' } });
    const image = await fetch(ZU.asset('backroom/room.png'));
    const csp = (await fetch('./')).headers.get('Content-Security-Policy');
    return { status: part.status, range: part.headers.get('Content-Range'), bytes: (await part.arrayBuffer()).byteLength, image: image.ok, csp };
  });
  assert.strictEqual(offline.status, 206, 'Musik wird in Stücken geliefert');
  assert.match(offline.range, /^bytes 100-199\/\d+$/);
  assert.strictEqual(offline.bytes, 100);
  assert.ok(offline.image);
  assert.match(offline.csp || '', /default-src 'self'/, 'die Seite aus dem Speicher trägt dieselbe Inhaltsrichtlinie');
  // ein Run lässt sich ohne Netz beginnen
  await page.evaluate(() => ZU.game.startRun(ZU.STARTERS[0].id));
  await page.waitForFunction(() => ZU.game.screen === 'select', null, { timeout: 30000 });
  await page.evaluate(() => { ZU.Run.clearSave(); ZU.game.run = null; });

  // --- Update beim Start: nur die geänderte Datei, dann Neustart in die neue Fassung ---
  await context.setOffline(false);
  direct.length = 0;
  mark(2);
  await page.reload();
  await page.waitForFunction(() => window.ZU_TEST_MARK === 2, null, { timeout: 30000 });
  await menu(page);
  assert.deepStrictEqual(direct, ['/js/lore.js'], 'geladen wird nur, was sich geändert hat');
  now = await stored(page);
  assert.ok(now.state.current !== list.build && !now.state.staged, 'die neue Fassung läuft');
  assert.deepStrictEqual(now.caches, ['zu-build-' + now.state.current, 'zu-state'], 'die alte ist weggeräumt');
  await state(page, 'ready');

  // --- Update im Hintergrund: Hinweis im Hauptmenü, Neustart übernimmt ---
  mark(3);
  await page.evaluate(() => { ZU.offline.check(); });
  await state(page, 'update');
  assert.strictEqual(await page.evaluate(() => window.ZU_TEST_MARK), 2, 'mitten im Spiel wechselt nichts');
  await page.click('.update-note .btn');
  await page.waitForFunction(() => window.ZU_TEST_MARK === 3, null, { timeout: 30000 });
  await menu(page);

  // --- „Später“: weiterspielen, das Update lädt zu Ende und wartet ---
  mark(4);
  await page.route('**/js/lore.js?v=*', async route => {
    if (!route.request().headers()['x-zu-direct']) return route.continue();
    await new Promise(resolve => setTimeout(resolve, 2500));
    route.continue();
  });
  await page.reload();
  await page.click('.load-later', { timeout: 15000 });
  await menu(page);
  assert.strictEqual(await page.evaluate(() => window.ZU_TEST_MARK), 3);
  await state(page, 'update');
  await page.unroute('**/js/lore.js?v=*');
  await page.reload();
  await page.waitForFunction(() => window.ZU_TEST_MARK === 4, null, { timeout: 30000 });
  await menu(page);

  // --- Konto: ohne Netz Gespieltes wird nachgereicht und nicht überschrieben ---
  await page.waitForFunction(() => ZU.account.available);
  assert.ok((await page.evaluate(() => ZU.account.register('Offliner', 'streichholz1', 'offliner@example.org'))).ok);
  await context.setOffline(true);
  await page.reload();
  await menu(page);
  await page.waitForTimeout(300);
  assert.strictEqual(await page.evaluate(() => ZU.account.user), null);
  await page.evaluate(() => {
    const profile = ZU.Profile.load();
    profile.runs += 2; profile.wins += 1; profile.best = 900; profile.bestAct = 3;
    ZU.Profile.save(profile);
    ZU.account.reportRun({ won: true, score: 900, act: 3 });
    ZU.account.reportRun({ won: false, score: 100, act: 1 });
    const meta = ZU.Meta.get();
    meta.ash += 7; meta.earned += 7;
    ZU.Meta.put(meta);
  });
  await context.setOffline(false);
  await page.reload();
  await menu(page);
  await page.waitForFunction(() => ZU.account.user && ZU.account.stats.runs === 2, null, { timeout: 15000 });
  const synced = await page.evaluate(async () => ({
    stats: ZU.account.stats, local: ZU.Meta.get().ash, remote: (await (await fetch('api/me')).json()).meta.ash,
    left: localStorage.getItem('zuendung.web.sync.v1')
  }));
  assert.deepStrictEqual(synced.stats, { runs: 2, wins: 1, best: 900, bestAct: 3 });
  assert.strictEqual(synced.local, 7, 'der Fortschritt vom Gerät bleibt');
  assert.strictEqual(synced.remote, 7, 'und liegt jetzt am Konto');
  assert.deepStrictEqual(JSON.parse(synced.left), { user: 'Offliner', runs: [], meta: false });

  // --- Ablage wieder ausschalten ---
  await page.evaluate(() => ZU.offline.enable(false));
  await page.waitForFunction(async () => (await caches.keys()).length === 0, null, { timeout: 10000 });
  await context.close();

  // --- Android-App: Angebot nur, wenn der Server eine bereithält, und nur auf Android ---
  const phone = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' };
  let mobile = await open(phone);
  await mobile.page.goto(base);
  await menu(mobile.page);
  await mobile.page.waitForTimeout(300);
  assert.strictEqual(await mobile.page.evaluate(() => ZU.app.android()), null);
  await mobile.context.close();
  fs.writeFileSync(path.join(appDir, 'zuendung-1.0.0.apk'), 'PK-test');
  fs.writeFileSync(path.join(appDir, 'android.json'), JSON.stringify({ versionCode: 1, versionName: '1.0.0', file: 'zuendung-1.0.0.apk', size: 58 * 1048576 }));
  mobile = await open(phone);
  await mobile.page.goto(base);
  await menu(mobile.page);
  await mobile.page.waitForFunction(() => ZU.app.android(), null, { timeout: 10000 });
  assert.deepStrictEqual(await mobile.page.evaluate(() => ZU.app.android()), { name: '1.0.0', url: 'app/zuendung-1.0.0.apk', size: 58 * 1048576, update: false });
  const apk = await fetch(base + 'app/zuendung-1.0.0.apk');
  assert.strictEqual(apk.headers.get('content-type'), 'application/vnd.android.package-archive');
  assert.match(apk.headers.get('content-disposition'), /attachment/);
  await mobile.context.close();
  const desktop = await open();
  await desktop.page.goto(base);
  await menu(desktop.page);
  await desktop.page.waitForTimeout(300);
  assert.strictEqual(await desktop.page.evaluate(() => ZU.app.android()), null, 'am Rechner kein Angebot');
  await desktop.context.close();

  await browser.close();
  await app.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('OK – Offline-Ablage, Updates, Nachreichen und App-Angebot geprüft');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
