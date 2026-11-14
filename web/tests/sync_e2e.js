'use strict';
/* Prüft im echten Browser den Abgleich des Spielstands über zwei Geräte hinweg: Fortschritt, laufender Run und Figur
   wandern mit dem Konto; ein ausgeräumtes Casino öffnet das nächste und bleibt offen; was ein Gerät ohne Netz
   erspielt, wird beim Wiedersehen zusammengeführt statt überschrieben; bei zwei verschiedenen Runs fragt das Spiel.

   Braucht Node >= 22.13 (wie der Server) und Playwright:

       node web/tests/sync_e2e.js */
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');
const { createApp } = require('../../server/server');

const WEB = path.resolve(__dirname, '..');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zuendung-sync-'));
  const app = createApp({ port: 0, host: '127.0.0.1', dataDir: path.join(tmp, 'data'), webRoot: WEB, quiet: true });
  const base = 'http://127.0.0.1:' + (await app.listen()).port + '/';
  const browser = await chromium.launch();

  async function device() {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem('zuendung.splash', '1');
        if (!localStorage.getItem('zuendung.web.profile.v1')) localStorage.setItem('zuendung.web.profile.v1', JSON.stringify({ seenHelp: true, popInit: true }));
      } catch (e) { /* egal */ }
    });
    const page = await context.newPage();
    page.on('pageerror', error => { throw error; });
    await page.goto(base);
    await menu(page);
    return { context, page };
  }
  const menu = page => page.waitForFunction(() => window.ZU && ZU.game && ZU.game.screen === 'menu' && !ZU.game._leaving, null, { timeout: 30000 });
  const saved = page => page.waitForFunction(() => ZU.account.user && ZU.account.syncState === 'saved' && !ZU.account.waiting(), null, { timeout: 15000 });
  /* Beim Server nachsehen und warten, bis alles abgeglichen ist. */
  const sync = async page => { await page.evaluate(() => ZU.account.check(true)); await saved(page); };
  const meta = page => page.evaluate(() => ZU.Meta.get());
  const runSig = page => page.evaluate(() => ZU.Run.sig(ZU.Run.raw()));

  // ---------- Gerät A: spielt als Gast, legt dann ein Konto an – der Stand des Geräts wandert hinauf ----------
  const a = await device();
  await a.page.evaluate(() => {
    const m = ZU.Meta.get();
    m.ash = 40; m.earned = 40; m.feats.played = 100;
    ZU.Meta.put(m);
    ZU.game.profile.avatar = { skin: 2 };
    ZU.game.saveProfile();
  });
  assert.deepStrictEqual(await a.page.evaluate(() => ZU.account.register('Zuendler', 'streichholz1', 'z@example.org')), { ok: true });
  await saved(a.page);
  let me = await a.page.evaluate(() => fetch('api/me').then(r => r.json()));
  assert.strictEqual(me.meta.ash, 40, 'der Fortschritt des Gasts gehört jetzt dem Konto');
  assert.deepStrictEqual(me.prefs.avatar, { skin: 2 }, 'die Figur liegt im Konto');
  assert.strictEqual(me.run, null);

  // ---------- Das erste Casino ausräumen: Das zweite ist offen und bleibt es ----------
  // (Vor 2.12.0 überschrieb die Antwort auf die Run-Meldung den frischen Fortschritt mit dem älteren Stand des Kontos.)
  const opened = await a.page.evaluate(() => {
    const run = ZU.Run.start('classic', 4711, ZU.Meta.runOptions());
    run.s.act = run.acts(); run.s.table = 2; run.s.ash = 30; run.s.cleared = true;
    ZU.game.run = run;
    const phase = run.afterPayout();
    ZU.account.reportRun({ won: true, score: run.s.score, act: run.s.act });
    ZU.Run.clearSave();
    ZU.game.run = null;
    return [phase, run.s.newStake];
  });
  assert.deepStrictEqual(opened, ['victory', 1]);
  await a.page.waitForTimeout(2500);
  await saved(a.page);
  assert.strictEqual((await meta(a.page)).maxStake, 1, 'das zweite Casino ist auf dem Gerät offen');
  await a.page.evaluate(() => { ZU.Meta.setStake(1); });
  await a.page.waitForTimeout(1500);
  await saved(a.page);
  me = await a.page.evaluate(() => fetch('api/me').then(r => r.json()));
  assert.deepStrictEqual([me.meta.maxStake, me.meta.stake, me.stats.wins], [1, 1, 1], 'und im Konto – auch nach der nächsten Änderung');
  assert.strictEqual(me.meta.ash, 70, 'die Asche des Siegs ist dabei');

  // ---------- Gerät A beginnt einen Run; Gerät B meldet sich an und hat alles: Fortschritt, Figur, Run ----------
  await a.page.evaluate(() => { ZU.game.startRun('classic'); });
  await a.page.waitForFunction(() => ZU.game.screen === 'select');
  await saved(a.page);
  const runA = await runSig(a.page);
  assert.ok(/:1$/.test(runA));

  const b = await device();
  assert.deepStrictEqual(await b.page.evaluate(() => ZU.account.login('Zuendler', 'streichholz1')), { ok: true });
  await saved(b.page);
  await menu(b.page);
  assert.strictEqual((await meta(b.page)).maxStake, 1);
  assert.strictEqual((await meta(b.page)).ash, 70);
  assert.deepStrictEqual(await b.page.evaluate(() => ZU.Profile.load().avatar), { skin: 2 });
  assert.strictEqual(await runSig(b.page), runA, 'der laufende Run ist auf dem zweiten Gerät angekommen');
  await b.page.waitForFunction(() => Array.from(document.querySelectorAll('.menu-buttons .btn')).some(el => el.textContent === 'Weiterspielen'), null, { timeout: 5000 });

  // ---------- B spielt den Run weiter; A (zurück im Menü) bekommt den neueren Stand ----------
  await a.page.evaluate(() => { ZU.game.toMenu(); });
  await menu(a.page);
  await b.page.evaluate(() => { const run = ZU.Run.load(); run.s.money += 7; run.save(); });
  await saved(b.page);
  await sync(a.page);
  assert.strictEqual(await runSig(a.page), await runSig(b.page));
  assert.strictEqual(await a.page.evaluate(() => ZU.Run.load().s.money), await b.page.evaluate(() => ZU.Run.load().s.money));

  // ---------- B ohne Netz erspielt Asche; A kauft derweil ein: Beim Wiedersehen wird zusammengeführt ----------
  await b.context.setOffline(true);
  await b.page.evaluate(() => {
    const m = ZU.Meta.get();
    m.ash += 5; m.earned += 5; m.feats.played = (m.feats.played || 0) + 10;
    ZU.Meta.put(m);
  });
  await b.page.waitForTimeout(1500);
  assert.strictEqual(await b.page.evaluate(() => ZU.account.syncState), 'offline', 'ohne Netz wartet die Änderung auf dem Gerät');
  await a.page.evaluate(() => {
    const m = ZU.Meta.get();
    m.ash -= 4; m.unlocked['trinket:heartblood'] = true; m.feats.played = (m.feats.played || 0) + 3;
    ZU.Meta.put(m);
  });
  await saved(a.page);
  await b.context.setOffline(false);
  await sync(b.page);
  let mb = await meta(b.page);
  assert.strictEqual(mb.ash, 71, '70 − 4 (A kauft) + 5 (B verdient)');
  assert.strictEqual(mb.feats.played, 113);
  assert.ok(mb.unlocked['trinket:heartblood']);
  await sync(a.page);
  assert.deepStrictEqual(await meta(a.page), mb, 'beide Geräte haben denselben Stand');

  // ---------- Die Figur ändert sich auf A; B übernimmt sie, ohne die eigene Einstellung zu verlieren ----------
  await b.page.evaluate(() => { ZU.game.profile.settings.music = 0.1; ZU.game.saveProfile(); });
  await a.page.evaluate(() => { ZU.game.profile.avatar = { skin: 3, hair: 4 }; ZU.game.saveProfile(); });
  await saved(a.page);
  await sync(b.page);
  assert.deepStrictEqual(await b.page.evaluate(() => ZU.Profile.load().avatar), { skin: 3, hair: 4 });
  assert.strictEqual(await b.page.evaluate(() => ZU.Profile.load().settings.music), 0.1, 'Einstellungen bleiben auf dem Gerät');
  assert.notStrictEqual(await a.page.evaluate(() => ZU.Profile.load().settings.music), 0.1);

  // ---------- Zwei verschiedene Runs: B beginnt ohne Netz einen neuen, A ebenfalls – B wird gefragt ----------
  await b.context.setOffline(true);
  await b.page.evaluate(() => { ZU.game.startRun('classic'); });
  await b.page.waitForFunction(() => ZU.game.screen === 'select');
  await b.page.evaluate(() => { ZU.game.toMenu(); });
  await menu(b.page);
  const runB = await runSig(b.page);
  await a.page.evaluate(() => { ZU.game.startRun('classic'); });
  await a.page.waitForFunction(() => ZU.game.screen === 'select');
  await saved(a.page);
  const runA2 = await runSig(a.page);
  assert.notStrictEqual(runB, runA2);
  await b.context.setOffline(false);
  await b.page.evaluate(() => { ZU.modal.closeAll(); ZU.account.check(true); }); // die Frage wartet, bis kein anderes Fenster offen ist
  await b.page.waitForSelector('.modal.runpick', { timeout: 10000 });
  assert.strictEqual(await b.page.locator('.runcard').count(), 2);
  await b.page.screenshot({ path: path.join(tmp, 'runpick.png') });
  await b.page.locator('.runcard').nth(1).locator('.btn').click(); // „Im Konto“
  await saved(b.page);
  assert.strictEqual(await runSig(b.page), runA2, 'gewählt: der Run aus dem Konto');
  me = await b.page.evaluate(() => fetch('api/me').then(r => r.json()));
  assert.strictEqual(me.run.rid + ':' + me.run.step, runA2);

  // ---------- Mitten im Run wird nichts ausgetauscht: A spielt, B beendet den Run – A behält seinen ----------
  await b.page.evaluate(() => { ZU.Run.clearSave(); });
  await saved(b.page);
  await sync(a.page); // A steht in der Tischwahl seines Runs
  assert.strictEqual(await runSig(a.page), runA2, 'der Run, der gerade gespielt wird, bleibt');
  me = await a.page.evaluate(() => fetch('api/me').then(r => r.json()));
  assert.strictEqual(me.run.rid + ':' + me.run.step, runA2, 'und liegt wieder im Konto');

  // ---------- Neu laden: Der Stand bleibt, nichts wird doppelt gezählt ----------
  await b.page.reload();
  await menu(b.page);
  await saved(b.page);
  assert.deepStrictEqual(await meta(b.page), mb);
  assert.strictEqual(await runSig(b.page), runA2);

  // ---------- Abmelden und wieder anmelden: kein Doppeln, der Stand des Kontos gilt ----------
  await b.page.evaluate(() => ZU.account.logout());
  assert.deepStrictEqual(await b.page.evaluate(() => ZU.account.login('Zuendler', 'streichholz1')), { ok: true });
  await saved(b.page);
  assert.deepStrictEqual(await meta(b.page), mb);

  console.log('Bild der Run-Wahl: ' + path.join(tmp, 'runpick.png'));
  await browser.close();
  await app.close();
  fs.rmSync(path.join(tmp, 'data'), { recursive: true, force: true });
  console.log('OK – Abgleich über zwei Geräte bestanden');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
