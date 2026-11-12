/* Simulationstest: spielt viele komplette Runs mit einem einfachen Autospieler durch und
   prüft dabei Invarianten (Kartenerhaltung, keine Endlosschleifen, gültige Zustände).
   Aufruf: node web/tests/sim.js [Anzahl Runs] */
require('../js/data.js');
require('../js/lore.js');
require('../js/engine.js');
require('../js/run.js');
require('../js/meta.js');
const ZU = globalThis.ZU;
const assert = require('assert');

const RUNS = Number(process.argv[2] || 400);
const tally = {};
const perks = {};
let duels = 0, victories = 0, maxTurns = 0, sumTurns = 0, drawFits = 0, decisions = {}, eventTypes = {};

function note(enemy, won) {
  const t = (tally[enemy] = tally[enemy] || { n: 0, w: 0 });
  t.n++; if (won) t.w++;
}

function check(duel) {
  const problems = duel.audit();
  assert.deepStrictEqual(problems, [], problems.join('\n'));
  assert.ok(duel.chain >= 1);
}

function record(events) {
  events.forEach(e => { eventTypes[e.t] = (eventTypes[e.t] || 0) + 1; assert.ok(e.t, 'Ereignis ohne Typ'); });
}

function playDuel(run, rnd) {
  const duel = run.newDuel();
  record(duel.start());
  check(duel);
  let steps = 0; const trace = [];
  while (duel.phase !== 'ended') {
    if (++steps >= 600) {
      console.log('P', duel.hand.player.map(i => duel.cards[i].def).join(' '));
      console.log('O', duel.hand.opp.map(i => duel.cards[i].def).join(' '));
      console.log('top', duel.cards[duel.top()].def, 'stock', duel.stocks.player.length + '/' + duel.stocks.opp.length, 'pile', duel.pile.length, 'status', JSON.stringify(duel.status), 'trinkets', duel.trinkets.join(','), 'noProgress', duel.noProgress, 'active', duel.active);
      console.log(trace.slice(-24).join(' | '));
      assert.fail('Duell endet nicht: ' + duel.enemy.id);
    }
    let ev;
    if (duel.pending) {
      const d = duel.pending;
      decisions[d.kind] = (decisions[d.kind] || 0) + 1;
      const pick = d.options.slice().sort(() => rnd.next() - 0.5).slice(0, d.kind === 'mulligan' ? rnd.int(2) : d.min);
      ev = duel.decide(pick);
    } else if (duel.active === 'player') {
      const plan = rnd.next() < 0.97 ? duel.suggest() : null;
      if (plan) {
        assert.ok(duel.canPlay('player', plan).ok);
        ev = duel.play('player', plan);
      } else if (duel.afterDraw) {
        assert.throws(() => duel.draw('player'), 'nach dem Ziehen kein zweites Ziehen');
        ev = duel.pass('player');
      } else {
        ev = duel.draw('player');
        if (duel.afterDraw) {
          drawFits++;
          assert.strictEqual(duel.active, 'player', 'nach passendem Ziehen bleibt man am Zug');
          const other = duel.hand.player.find(id => !duel.afterDraw.ids.includes(id));
          if (other !== undefined) assert.strictEqual(duel.canPlay('player', [other]).ok, false, 'nur die gezogene Karte darf gelegt werden');
        }
      }
    } else {
      ev = duel.aiMove();
    }
    trace.push(ev.filter(e => e.t === 'play' || (e.t === 'move' && e.cause === 'draw') || e.t === 'swap' || e.t === 'reshuffle').map(e => e.t === 'play' ? e.actor[0] + ':' + duel.cards[e.id].def : e.t === 'move' ? e.to[0] + ':zieht' : e.t).join(',') || '-');
    record(ev);
    check(duel);
  }
  maxTurns = Math.max(maxTurns, duel.turns); sumTurns += duel.turns;
  duels++;
  // ungültige Aktionen nach Duellende müssen abgewiesen werden
  assert.throws(() => duel.draw('player'));
  return duel;
}

function shop(run, rnd) {
  const s = run.s;
  // Privileg: ein Angebot je Akt, in Akt 1 immer die Mehrfachwahl, von der Neuen Auslage unberührt
  assert.strictEqual(s.perkOffer.act, s.act, 'Privileg-Angebot gehört zum laufenden Akt');
  if (s.act === 1 && !s.perkOffer.sold && !run.has('nimble-fingers')) assert.strictEqual(s.perkOffer.id, 'nimble-fingers');
  const perkBefore = JSON.stringify(s.perkOffer);
  if (!s.perkOffer.sold && s.money >= s.perkOffer.price && rnd.next() < 0.8) {
    const lives = s.lives, id = run.buyPerk();
    assert.ok(run.has(id) && s.perks.includes(id));
    if (id === 'matchbook') assert.strictEqual(s.lives, lives + 1);
    assert.throws(() => run.buyPerk(), 'ein Privileg je Akt');
    perks[id] = (perks[id] || 0) + 1;
  }
  for (let pass = 0; pass < 2; pass++) {
    s.shop.trinkets.forEach((offer, i) => {
      if (!offer.sold && s.money >= run.trinketPrice(i) && rnd.next() < 0.7) {
        const before = s.money, price = run.trinketPrice(i);
        run.buyTrinket(i);
        assert.strictEqual(s.money, before - price);
      }
    });
    s.shop.specials.forEach((offer, i) => {
      assert.ok(ZU.CARDS[offer.def].special && offer.bind, 'Spezialkarte ohne Bindung im Laden');
      if (!offer.sold && s.money >= run.offerPrice('specials', i) && rnd.next() < 0.7) {
        if (run.specialFree()) run.buySpecial(i);
        else assert.throws(() => run.buySpecial(i), 'volles Deck nimmt keine Spezialkarte mehr');
      }
    });
    s.shop.cards.forEach((offer, i) => {
      assert.ok(!ZU.CARDS[offer.def].special, 'Spezialkarte im Regal für normale Karten');
      if (!offer.sold && s.money >= run.cardPrice(i) && rnd.next() < 0.08) run.buyCard(i);
    });
    if (s.lives < ZU.MAX_LIVES && !s.shop.healed && s.money >= run.healPrice()) run.heal();
    // Esmes Nebenzimmer: Pakete prüfen und gelegentlich kaufen
    s.shop.esme.packs.forEach((pack, i) => {
      assert.ok(pack.price >= 2 && pack.items.length === { single: 1, double: 2, bag: 3 }[pack.kind]);
      pack.items.forEach(item => { assert.ok(ZU.SEALS[item.seal]); if (item.flaw) assert.ok(ZU.FLAWS[item.flaw] && !ZU.SEALS[item.seal].not.includes(item.flaw), 'Makel hebt das Siegel auf'); });
      if (pack.sold || s.money < pack.price || rnd.next() > 0.5) return;
      const pool = run.sealable();
      if (pool.length < pack.items.length) return;
      const result = run.buyPack(i, pack.kind === 'bag' ? null : pool.slice(0, pack.items.length).map(c => c.id));
      assert.strictEqual(result.length, pack.items.length);
      result.forEach(r => { const c = s.collection.find(x => x.id === r.id); assert.ok(!ZU.CARDS[c.def].special && c.seal === r.seal); });
      assert.throws(() => run.buyPack(i, pool.slice(0, pack.items.length).map(c => c.id)), 'verkauftes Paket');
    });
    if (s.shop.esme.packs.length) assert.ok(s.shop.esme.packs.some(p => p.kind !== 'bag' ? p.items.every(x => !x.flaw) || p.sold : false) || s.shop.esme.packs.every(p => p.kind === 'bag' || p.sold), 'ein makelloses Paket liegt aus');
    if (rnd.next() < 0.15 && s.money >= run.esmeRerollPrice()) run.esmeReroll();
    if (s.collection.length > 12 && s.money >= run.burnPrice() && rnd.next() < 0.5) {
      const plain = s.collection.filter(c => !ZU.CARDS[c.def].special);
      if (plain.length) run.burn(plain[0].id);
    }
    if (pass === 0 && s.money >= run.rerollPrice() + 8 && rnd.next() < 0.3) {
      const offer = JSON.stringify(s.perkOffer);
      run.reroll();
      assert.strictEqual(JSON.stringify(s.perkOffer), offer, 'Neue Auslage lässt das Privileg stehen');
    }
  }
  assert.throws(() => run.buyCard(99));
  assert.ok(s.money >= 0);
  assert.strictEqual(new Set(s.trinkets).size, s.trinkets.length);
  run.leaveShop();
}

for (let n = 0; n < RUNS; n++) {
  const starter = ZU.STARTERS[n % ZU.STARTERS.length];
  // Jeder dritte Run läuft mit Meta-Vorgaben: Grundausstattung, Upgrades und wechselndem Einsatz.
  const withMeta = n % 3 === 0;
  let options;
  if (withMeta) {
    const meta = ZU.Meta.defaults();
    meta.maxStake = meta.stake = n % ZU.Meta.STAKES.length;
    meta.upgrades = { startgeld: n % 4, stammkunde: n % 2, reserve: (n >> 1) % 2, etui: n % 3, sparbuch: n % 2, schaufenster: (n >> 2) % 2, trinkgeld: n % 3, zuendelei: n % 2, handschlag: (n >> 1) % 2 };
    options = ZU.Meta.runOptions(ZU.Meta.clean(meta));
    assert.deepStrictEqual(options.trinkets, ZU.Meta.BASE.trinket.filter(id => ZU.TRINKETS[id]).sort((a, b) => ZU.TRINKET_IDS.indexOf(a) - ZU.TRINKET_IDS.indexOf(b)));
  }
  // Jeder fünfte Run ohne Meta trägt eine wechselnde Auswahl der neuen Trinkets, damit alle Haken laufen.
  let run = ZU.Run.start(starter.id, 1000 + n * 7919, options);
  if (!withMeta && n % 5 === 1) {
    const extra = new ZU.Rng(n).shuffle(ZU.TRINKET_IDS.slice()).slice(0, 12);
    extra.forEach(id => { if (!run.s.trinkets.includes(id)) run.s.trinkets.push(id); });
  }
  if (!withMeta && n % 7 === 2) run.s.meta = Object.assign({}, run.meta(), { rules: ZU.CASINOS[5].rules.slice(), acts: 4, specialSlots: 4 });
  if (withMeta) {
    assert.strictEqual(run.s.lives, run.maxLives());
    assert.strictEqual(run.s.money, starter.money + options.startgeld);
  }
  const rnd = new ZU.Rng(42 + n);
  assert.ok(run.s.collection.length >= 7);
  let guard = 0;
  while (run.s.phase !== 'defeat' && run.s.act <= run.acts() + 2) {
    assert.ok(++guard < 200, 'Run endet nicht');
    assert.strictEqual(run.s.phase, 'select');
    const e = run.encounter();
    const duel = playDuel(run, rnd);
    const result = run.finishDuel(duel);
    note(e.enemy + ' (Akt ' + Math.min(run.s.act, 4) + ')', result.won);
    assert.ok(run.specialCount() <= Math.max(run.specialSlots(), 2), 'mehr Spezialkarten als Plätze');
    if (!result.won) continue;
    assert.ok(result.total > 0);
    let phase = run.afterPayout();
    if (phase === 'victory') { victories++; phase = run.continueEndless(); }
    if (phase === 'reward') {
      const r = run.s.reward;
      const pick = rnd.next() < 0.8 ? rnd.int(r.options.length) : null;
      if (pick != null && r.type === 'card' && !run.specialFree()) {
        assert.throws(() => run.chooseReward(pick), 'volles Deck: ohne Tausch keine neue Spezialkarte');
        const count = run.specialCount();
        run.chooseReward(pick, run.s.collection.find(c => ZU.CARDS[c.def].special).id);
        assert.strictEqual(run.specialCount(), count, 'Tausch hält die Zahl der Spezialkarten');
      } else {
        run.chooseReward(pick);
      }
    }
    assert.strictEqual(run.s.phase, 'shop');
    // Speichern/Laden muss den Zustand exakt erhalten
    const copy = new ZU.Run(JSON.parse(JSON.stringify(run.s)));
    assert.deepStrictEqual(copy.s, run.s);
    run = copy;
    shop(run, rnd);
    run.s.collection.forEach(c => assert.strictEqual(!!c.bind, ZU.CARDS[c.def].special, 'Bindung passt nicht zur Kartenart: ' + c.def));
    const ids = run.s.collection.map(c => c.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'doppelte Karten-ID im Deck');
    assert.ok(run.s.lives <= run.maxLives());
    assert.strictEqual(new Set(run.s.perks).size, run.s.perks.length, 'Privileg doppelt');
    if (withMeta) {
      run.s.trinkets.forEach(id => assert.ok(options.trinkets.includes(id) || starter.trinkets.includes(id), 'gesperrtes Trinket im Run: ' + id));
    }
  }
}

// Meta-Progression: Asche verdienen, freischalten, aufwerten
{
  ZU.Profile._memory = null;
  let meta = ZU.Meta.get();
  assert.deepStrictEqual(meta, ZU.Meta.defaults());
  assert.strictEqual(ZU.Meta.isUnlocked(meta, 'starter', 'classic'), true);
  assert.strictEqual(ZU.Meta.isUnlocked(meta, 'starter', 'igniter'), false);
  // Verborgenes lässt sich nicht kaufen; erst die Tat am Tisch bringt es ins Hinterzimmer.
  assert.strictEqual(ZU.Meta.isFound(meta, 'starter', 'igniter'), false);
  assert.strictEqual(ZU.Meta.unlock('starter', 'igniter').error, 'hidden');
  assert.strictEqual(ZU.Meta.hint(meta, 'starter', 'igniter'), 'Spiele 10 Siebenen.');
  assert.strictEqual(ZU.Meta.hint(meta, 'trinket', 'master-key'), null, 'manche Stücke haben keinen Hinweis');
  assert.strictEqual(ZU.Meta.hint(meta, 'trinket', 'furnace'), null, 'manche Hinweise kommen erst nach einem Casino');
  ZU.Meta.note({ sevens: 6, chain: 4 });
  ZU.Meta.note({ sevens: 4, chain: 3 });
  assert.strictEqual(ZU.Meta.feat(ZU.Meta.get(), 'sevens'), 10, 'Summen-Zählwerk addiert');
  assert.strictEqual(ZU.Meta.feat(ZU.Meta.get(), 'chain'), 4, 'Bestwert-Zählwerk hält das Maximum');
  assert.strictEqual(ZU.Meta.isFound(ZU.Meta.get(), 'starter', 'igniter'), true);
  assert.deepStrictEqual(ZU.Meta.openOffers(ZU.Meta.get()), ['starter:igniter']);
  assert.strictEqual(ZU.Meta.unlock('starter', 'igniter').error, 'poor');
  assert.strictEqual(ZU.Meta.upgrade('reserve').error, 'hidden');
  const run = ZU.Run.start('classic', 77, ZU.Meta.runOptions());
  assert.strictEqual(run.specialSlots(), ZU.SPECIAL_SLOTS);
  assert.strictEqual(run.acts(), 3);
  run.s.ash = 20;
  assert.strictEqual(ZU.Meta.award(run), 20);
  assert.strictEqual(ZU.Meta.award(run), 0, 'Asche wird nur einmal ausgezahlt');
  run.s.ash = 26;
  assert.strictEqual(ZU.Meta.award(run), 6, 'nur der Zuwachs wird nachgezahlt');
  assert.strictEqual(ZU.Meta.get().ash, 26);
  assert.strictEqual(ZU.Meta.unlock('starter', 'igniter').ok, true);
  assert.strictEqual(ZU.Meta.unlock('starter', 'igniter').error, 'known');
  assert.strictEqual(ZU.Meta.upgrade('startgeld').ok, true);
  assert.strictEqual(ZU.Meta.upgrade('startgeld').ok, true);
  meta = ZU.Meta.get();
  assert.strictEqual(meta.ash, 26 - 8 - 6 - 10);
  assert.strictEqual(ZU.Meta.runOptions().startgeld, 4);
  assert.strictEqual(ZU.Meta.setStake(3), 0, 'verschlossene Casinos lassen sich nicht wählen');
  assert.strictEqual(ZU.Meta.noteVictory(run), 1);
  assert.strictEqual(ZU.Meta.setStake(1), 1);
  const staked = ZU.Run.start('classic', 78, ZU.Meta.runOptions());
  staked.s.ash = 8;
  assert.strictEqual(ZU.Meta.ashFor(staked), 12, 'das zweite Casino bringt 50 % mehr Asche');
  assert.strictEqual(staked.acts(), 4);
  assert.deepStrictEqual(staked.houseRules(), ZU.CASINOS[1].rules);
  assert.strictEqual(ZU.Meta.hint(ZU.Meta.get(), 'trinket', 'furnace'), 'Sammle 1.500 Glut in einem Duell.', 'nach dem ersten Casino steht der Hinweis da');
  assert.deepStrictEqual(ZU.Meta.clean({ ash: -5, stake: 9, maxStake: 99, unlocked: { 'trinket:gibtsnicht': true, 'special:tausch': true }, upgrades: { startgeld: 99, quatsch: 3 }, feats: { chain: 7, quatsch: 2 } }),
    Object.assign(ZU.Meta.defaults(), { stake: 7, maxStake: 7, unlocked: { 'special:tausch': true }, upgrades: { startgeld: 3 }, feats: { chain: 7 } }));

  // Asche fließt sofort nach jedem Sieg; die Nachglut bringt keine mehr.
  ZU.Profile._memory = null;
  let live = ZU.Run.start('classic', 4242, ZU.Meta.runOptions()), paid = 0, safety = 0, burntAsh = 0;
  const rnd2 = new ZU.Rng(5);
  while (live.s.phase !== 'defeat' && !live.s.endless && ++safety < 80) {
    const before = ZU.Meta.get().ash, kind = live.encounter().kind, last = live.s.act === live.acts() && kind === 'boss';
    const result = live.finishDuel(Object.assign(playDuel(live, rnd2), { winner: 'player' }));
    const glutAsh = result.burnt ? 1 + result.doublings : 0;
    assert.strictEqual(result.ash, ZU.Meta.ASH[kind] + (last ? ZU.Meta.ASH.victory : 0) + glutAsh, 'Asche direkt nach dem Sieg');
    burntAsh += glutAsh;
    assert.strictEqual(ZU.Meta.get().ash, before + result.ash);
    paid += result.ash;
    let phase = live.afterPayout();
    if (phase === 'victory') { assert.strictEqual(ZU.Meta.get().maxStake, 1, 'das nächste Casino ist offen'); phase = live.continueEndless(); }
    if (phase === 'reward') live.chooseReward(null);
    live.leaveShop();
  }
  assert.strictEqual(live.s.endless, true);
  assert.strictEqual(paid, 3 * 8 + 8 + burntAsh);
  const after = ZU.Meta.get().ash;
  const extra = live.finishDuel(Object.assign(playDuel(live, rnd2), { winner: 'player' }));
  assert.strictEqual(extra.ash, 0, 'Nachglut: keine Asche mehr');
  assert.strictEqual(ZU.Meta.get().ash, after);
  assert.strictEqual(ZU.Meta.feat(ZU.Meta.get(), 'casino'), 1);
  ZU.Profile._memory = null;
}

// Startdeck: 16 normale Karten plus die Spezialkarten der Schachtel; jede Seite zieht vom eigenen Stapel.
ZU.STARTERS.forEach(starter => {
  const run = ZU.Run.start(starter.id, 900, ZU.Meta.runOptions(ZU.Meta.defaults()));
  const specials = run.s.collection.filter(c => ZU.CARDS[c.def].special);
  assert.strictEqual(run.s.collection.length - specials.length, ZU.DECK_SIZE, starter.id + ': 16 normale Karten');
  assert.strictEqual(specials.length, starter.special ? 1 : starter.cards.filter(d => ZU.CARDS[d].special).length, starter.id + ': Spezialkarten');
  const duel = run.newDuel();
  duel.start();
  const own = new Set(run.s.collection.map(c => c.id));
  assert.strictEqual(duel.hand.player.length + duel.stocks.player.length, run.s.collection.length, 'das ganze Deck liegt auf Hand und eigenem Stapel');
  assert.ok(duel.hand.player.concat(duel.stocks.player).every(id => own.has(id)), 'der Spieler hält nur eigene Karten');
  assert.ok(duel.hand.opp.concat(duel.stocks.opp).every(id => !own.has(id)), 'der Gegner hat sein eigenes Blatt');
});

// Der Laden übernimmt Erweiterungen und Rabatte sofort.
{
  const run = ZU.Run.start('classic', 4711);
  run._openShop();
  run.s.money = 500;
  const trinkets = run.s.shop.trinkets.length;
  run.s.perkOffer = { id: 'showcase', price: 1, sold: false, act: run.s.act };
  run.buyPerk();
  assert.strictEqual(run.s.shop.trinkets.length, trinkets + 1, 'Vitrine füllt den neuen Platz gleich');
  const specials = run.s.shop.specials.length;
  run.s.perkOffer = { id: 'shelf', price: 1, sold: false, act: run.s.act };
  run.buyPerk();
  assert.strictEqual(run.s.shop.specials.length, specials + 1, 'Großes Regal legt gleich eine Karte aus');
  const before = run.cardPrice(0);
  run._gainTrinket('false-bottom');
  assert.strictEqual(run.cardPrice(0), Math.max(1, Math.round(before / 2)), 'Doppelboden gilt schon in diesem Laden');
  const price = run.trinketPrice(0);
  run._gainTrinket('loyalty');
  assert.ok(run.trinketPrice(0) < price * (1 + ZU.TRINKET_SURCHARGE), 'Stempelkarte gilt sofort');
}

// Upgrade „Flinke Finger": für 20 Asche beginnt jeder Run mit dem Privileg.
{
  const meta = ZU.Meta.defaults();
  assert.deepStrictEqual(ZU.Meta.UPGRADES.flinkefinger.costs, [20]);
  assert.strictEqual(ZU.Meta.isFound(meta, 'upgrade', 'flinkefinger'), true, 'von Anfang an zu kaufen');
  meta.upgrades.flinkefinger = 1;
  const run = ZU.Run.start('classic', 12, ZU.Meta.runOptions(ZU.Meta.clean(meta)));
  assert.ok(run.has('nimble-fingers'));
  run._openShop();
  assert.notStrictEqual(run.s.perkOffer.id, 'nimble-fingers', 'das Privileg wird nicht noch einmal angeboten');
  assert.strictEqual(ZU.Run.start('igniter', 12, ZU.Meta.runOptions(ZU.Meta.clean(meta))).s.perks.filter(id => id === 'nimble-fingers').length, 1);
}

// Akten: jede Figur hat genau drei Einträge, und die Schwellen steigen.
Object.keys(ZU.ENEMIES).forEach(id => {
  assert.ok(Array.isArray(ZU.LORE[id]) && ZU.LORE[id].length === 3 && ZU.LORE[id].every(text => typeof text === 'string' && text.length > 60), 'Akte fehlt oder ist zu kurz: ' + id);
});
assert.deepStrictEqual(Object.keys(ZU.LORE).sort(), Object.keys(ZU.ENEMIES).sort(), 'Akte ohne Figur');
Object.values(ZU.LORE_STEPS).forEach(steps => assert.ok(steps.length === 3 && steps[0] === 1 && steps[0] < steps[1] && steps[1] < steps[2]));

// Veredelungen wirken im Duell: Glutsiegel verdoppelt, Makel „Matt" zieht 4 ab, Anker liegt auf der Starthand.
{
  const run = ZU.Run.start('classic', 2024);
  const plain = run.sealable();
  plain[0].seal = 'glut'; plain[1].seal = 'anker'; plain[2].seal = 'zuend'; plain[2].flaw = 'matt'; plain[3].flaw = 'spaet'; plain[3].seal = 'gold';
  for (let i = 0; i < 20; i++) {
    const duel = run.newDuel();
    duel.start();
    assert.ok(duel.hand.player.includes(plain[1].id), 'Anker auf der Starthand');
    assert.ok(!duel.hand.player.includes(plain[3].id), 'Nachzügler nicht auf der Starthand');
  }
  const duel = run.newDuel();
  duel.start();
  const before = duel.glut, chain = duel.chain, base = ZU.CARDS[plain[0].def].base;
  duel.pile.push(duel._register(plain[0].def, 'house', false)); // passender Stapel
  if (!duel.hand.player.includes(plain[0].id)) { duel.stocks.player.splice(duel.stocks.player.indexOf(plain[0].id), 1); duel.hand.player.push(plain[0].id); }
  duel.phase = 'action'; duel.active = 'player'; duel.pending = null;
  duel.play('player', [plain[0].id]);
  assert.strictEqual(duel.glut - before, base * chain * 2, 'Glutsiegel verdoppelt');
  // Esme: früh viele Makel, spät wenige
  const early = ZU.Run.start('classic', 1); const late = ZU.Run.start('classic', 1); late.s.act = late.acts();
  assert.ok(early.flawChance() > 0.6 && late.flawChance() < 0.3);
}

// Acht Casinos; alte Stände (sechs Häuser) wandern an den neuen Platz ihres Hauses.
assert.strictEqual(ZU.CASINOS.length, 8);
assert.deepStrictEqual(ZU.CASINOS.map(c => c.id), ['hahn', 'rialto', 'laterne', 'fortuna', 'block9', 'imperial', 'monopol', 'inferno']);
assert.strictEqual(ZU.Meta.clean({ stake: 2, maxStake: 3 }).stake, 3, 'Dampfer Fortuna bleibt gewählt');
assert.strictEqual(ZU.Meta.clean({ stake: 2, maxStake: 3 }).maxStake, 5, 'Grandhotel Imperial bleibt das höchste offene Haus');
assert.strictEqual(ZU.Meta.clean({ stake: 2, maxStake: 3, cv: ZU.CASINO_VERSION }).maxStake, 3, 'neue Stände bleiben unverändert');
for (let i = 1; i < ZU.CASINOS.length; i++) assert.ok(ZU.CASINOS[i].ash > ZU.CASINOS[i - 1].ash && ZU.CASINOS[i].acts >= ZU.CASINOS[i - 1].acts, 'Häuser werden härter und lohnender');

// Löschmittel: Akt 1 lässt Tische in Ruhe, Bosse haben die Löschdecke; die Mittel drücken Kette und Glut.
{
  const run = ZU.Run.start('classic', 4711);
  assert.deepStrictEqual(run.douse({ enemy: 'barkeeper', kind: 'battle' }), []);
  assert.ok(run.douse({ enemy: 'barkeeper', kind: 'boss' }).includes('blanket'));
  run.s.act = 2;
  assert.strictEqual(run.douse({ enemy: 'barkeeper', kind: 'battle' }).length, 1);
  const mk = (douse) => { const r = ZU.Run.start('classic', 9); const d = r.newDuel(); d.target = 1000; d.douse = douse; d.start(); return d; };
  for (const [kind, rank, expect] of [['sand', '8', 6], ['water', 'A', 4]]) {
    const d = mk([kind]);
    d.chain = 8;
    const def = Object.keys(ZU.CARDS).find(k => ZU.CARDS[k].rank === rank && !ZU.CARDS[k].special);
    const id = d._register(def, 'house', false);
    d.hand.opp.push(id);
    const ev = [];
    d._putOnTable('opp', id, 'hand', ev);
    assert.strictEqual(d.chain, expect, kind);
    assert.ok(ev.some(e => e.t === 'douse' && e.id === kind));
  }
  const b = mk(['blanket']);
  b.glut = 600; b.chain = 7; b.root = 'player';
  const ev = [];
  b._complete(ev);
  assert.strictEqual(b.glut, 450);
  assert.strictEqual(b.chain, b.chainFloor());
  b.glut = 900; b.root = b.active; b._complete([]);
  assert.strictEqual(b.glut, 900, 'Löschdecke nur einmal');
  // Ziehen: Passt die gezogene Karte, bleibt die halbe Kette stehen.
  const d = mk([]);
  d.phase = 'action'; d.active = 'player'; d.pending = null; d.afterDraw = null;
  d.chain = 9;
  const top = d.def(d.pile[d.pile.length - 1]);
  const fit = Object.keys(ZU.CARDS).find(k => !ZU.CARDS[k].special && ZU.CARDS[k].suit === (d.wish || top.suit) && !'78AJ'.includes(ZU.CARDS[k].rank));
  d.stocks.player.push(d._register(fit, 'player', false));
  const drawn = d.draw('player');
  if (drawn.some(e => e.t === 'drawfit')) assert.strictEqual(d.chain, 5);
  else assert.strictEqual(d.chain, d.chainFloor());
}

// Vorschläge im Hinterzimmer: nur Entdecktes, Bezahlbares zuerst (das Wertvollste vorn), sonst Sparziele.
{
  const meta = ZU.Meta.defaults();
  meta.feats = Object.assign({}, meta.feats, { duels: 30, chain: 12, played: 500, burnt: 9 });
  meta.ash = 7;
  const picks = ZU.Meta.suggest(meta, 'unlock');
  assert.strictEqual(picks.length, 3);
  picks.forEach(p => { assert.ok(ZU.Meta.isFound(meta, p.kind, p.id) && !ZU.Meta.isUnlocked(meta, p.kind, p.id)); if (p.afford) assert.ok(p.cost <= 7); else assert.strictEqual(p.missing, p.cost - 7); });
  assert.ok(picks[0].afford && picks[0].worth >= picks[1].worth);
  meta.ash = 0;
  assert.ok(ZU.Meta.suggest(meta, 'unlock').every(p => !p.afford));
  assert.ok(ZU.Meta.suggest(meta, 'upgrade').length > 0);
}

// Glutziel: Wer es erreicht, gewinnt sofort; die Ziele steigen steil, und der Überschuss zahlt ohne Deckel.
{
  const run = ZU.Run.start('classic', 31337);
  const t1 = run.glutTarget('battle'), tBoss = run.glutTarget('boss');
  run.s.act = 3;
  assert.ok(tBoss > t1 && run.glutTarget("battle") >= t1 * 4, 'Ziele wachsen mit Art und Akt');
  run.s.act = 1;
  const duel = run.newDuel();
  duel.start();
  assert.strictEqual(duel.target, t1);
  duel.glut = t1 * 4 - 1; // der nächste eigene Zug überschreitet das Vierfache
  duel.phase = 'action'; duel.active = 'player'; duel.pending = null;
  const card = duel.hand.player.find(id => !duel.def(id).special);
  duel.pile.push(duel._register(duel.cards[card].def, 'house', false));
  const events = duel.play('player', [card]);
  assert.ok(events.some(e => e.t === 'burnt'), 'der Tisch brennt');
  assert.strictEqual(duel.winner, 'player');
  assert.ok(duel.hand.player.length > 0, 'Sieg trotz voller Hand');
  const result = run.finishDuel(duel);
  assert.strictEqual(result.burnt, true);
  assert.strictEqual(result.doublings, 2);
  assert.ok(result.lines.some(l => /abgefackelt/.test(l.label)) && result.lines.some(l => /Überschuss/.test(l.label)));
  // Prozente wachsen mit: Der Glückschip ist in Akt 5 mehr wert als in Akt 1.
  const early = ZU.Run.start('classic', 5), late = ZU.Run.start('classic', 5);
  late.s.act = 5;
  assert.ok(late.baseReward('battle') > early.baseReward('battle') * 1.5 && late._price(20) > early._price(20));
}

// Die 7 lässt nur noch 1 Karte ziehen und niemanden aussetzen.
assert.deepStrictEqual(ZU.CARDS['hearts-7'].effects, [{ type: 'draw', amount: 1, reflectable: true }]);

// Jedes Casino nach dem ersten setzt seine eigenen Figuren: Tisch in Akt 1, Elite in Akt 2, Boss im letzten Akt.
ZU.CASINOS.forEach((casino, index) => {
  if (!index) { assert.strictEqual(casino.foes, undefined); return; }
  ['battle', 'elite', 'boss'].forEach(kind => assert.strictEqual(ZU.ENEMIES[casino.foes[kind]].kind, kind));
  const meta = ZU.Meta.defaults();
  meta.maxStake = meta.stake = index;
  const run = ZU.Run.start('classic', 31 + index, ZU.Meta.runOptions(ZU.Meta.clean(meta)));
  assert.strictEqual(run.s.encounters[0].enemy, casino.foes.battle);
  for (let act = 2; act <= casino.acts; act++) {
    run.s.act = act;
    run._encounters();
    if (act === 2) assert.strictEqual(run.s.encounters[1].enemy, casino.foes.elite);
    assert.strictEqual(run.s.encounters[2].enemy === casino.foes.boss, act === casino.acts, 'der Boss des Hauses wartet im letzten Akt');
    run.s.encounters.forEach(e => assert.ok(!ZU.ENEMIES[e.enemy].casino || ZU.ENEMIES[e.enemy].casino === casino.id, 'fremde Hausfigur: ' + e.enemy));
  }
});
assert.ok(ZU.BATTLE_POOL.concat(ZU.ELITE_POOL).every(id => !ZU.ENEMIES[id].casino));

// Determinismus: gleicher Seed, gleiche Entscheidungen => gleicher Verlauf
function fingerprint(seed) {
  const run = ZU.Run.start('classic', seed), rnd = new ZU.Rng(7);
  const duel = playDuel(run, rnd);
  return JSON.stringify([duel.winner, duel.glut, duel.turns, duel.hand, run.s.encounters]);
}
assert.strictEqual(fingerprint(123456), fingerprint(123456));

console.log('Runs: %d, Duelle: %d, Siege über Akt 3: %d (%s%%), längstes Duell: %d Züge',
  RUNS, duels, victories, (100 * victories / RUNS).toFixed(1), maxTurns);
console.log('Entscheidungen:', decisions, 'Züge/Duell:', (sumTurns / duels).toFixed(1), 'gezogen und passend:', drawFits);
console.log('Privilegien gekauft:', perks);
console.log('Ereignisse:', Object.keys(eventTypes).sort().map(k => k + '=' + eventTypes[k]).join(' '));
Object.keys(tally).sort().forEach(k => console.log('  %s  %d Duelle, Spieler gewinnt %s%%', k.padEnd(28), tally[k].n, (100 * tally[k].w / tally[k].n).toFixed(0)));
console.log('OK');
