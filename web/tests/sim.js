/* Simulationstest: spielt viele komplette Runs mit einem einfachen Autospieler durch und
   prüft dabei Invarianten (Kartenerhaltung, keine Endlosschleifen, gültige Zustände).
   Aufruf: node web/tests/sim.js [Anzahl Runs] */
require('../js/data.js');
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
      console.log('top', duel.cards[duel.top()].def, 'stock', duel.stock.length, 'pile', duel.pile.length, 'status', JSON.stringify(duel.status), 'trinkets', duel.trinkets.join(','), 'noProgress', duel.noProgress, 'active', duel.active);
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
      if (!offer.sold && s.money >= run.offerPrice('specials', i) && rnd.next() < 0.7) run.buySpecial(i);
    });
    s.shop.cards.forEach((offer, i) => {
      assert.ok(!ZU.CARDS[offer.def].special, 'Spezialkarte im Regal für normale Karten');
      if (!offer.sold && s.money >= run.cardPrice(i) && rnd.next() < 0.08) run.buyCard(i);
    });
    if (s.lives < ZU.MAX_LIVES && !s.shop.healed && s.money >= run.healPrice()) run.heal();
    if (s.collection.length > 7 && s.money >= run.burnPrice() && rnd.next() < 0.5) {
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
    meta.upgrades = { startgeld: n % 4, stammkunde: n % 2, reserve: (n >> 1) % 2 };
    options = ZU.Meta.runOptions(ZU.Meta.clean(meta));
    assert.deepStrictEqual(options.trinkets, ZU.Meta.BASE.trinket.filter(id => ZU.TRINKETS[id]).sort((a, b) => ZU.TRINKET_IDS.indexOf(a) - ZU.TRINKET_IDS.indexOf(b)));
  }
  let run = ZU.Run.start(starter.id, 1000 + n * 7919, options);
  if (withMeta) {
    assert.strictEqual(run.s.lives, run.maxLives());
    assert.strictEqual(run.s.money, starter.money + options.startgeld);
  }
  const rnd = new ZU.Rng(42 + n);
  assert.ok(run.s.collection.length >= 7);
  let guard = 0;
  while (run.s.phase !== 'defeat' && run.s.act <= 5) {
    assert.ok(++guard < 200, 'Run endet nicht');
    assert.strictEqual(run.s.phase, 'select');
    const e = run.encounter();
    const duel = playDuel(run, rnd);
    const result = run.finishDuel(duel);
    note(e.enemy + ' (Akt ' + Math.min(run.s.act, 4) + ')', result.won);
    if (!result.won) continue;
    assert.ok(result.total > 0);
    let phase = run.afterPayout();
    if (phase === 'victory') { victories++; phase = run.continueEndless(); }
    if (phase === 'reward') {
      const r = run.s.reward;
      run.chooseReward(rnd.next() < 0.8 ? rnd.int(r.options.length) : null);
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
  assert.strictEqual(ZU.Meta.unlock('starter', 'igniter').error, 'poor');
  const run = ZU.Run.start('classic', 77, ZU.Meta.runOptions());
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
  assert.strictEqual(ZU.Meta.setStake(3), 0, 'gesperrte Einsätze lassen sich nicht wählen');
  assert.strictEqual(ZU.Meta.noteVictory(run), 1);
  assert.strictEqual(ZU.Meta.setStake(1), 1);
  const staked = ZU.Run.start('classic', 78, ZU.Meta.runOptions());
  staked.s.ash = 8;
  assert.strictEqual(ZU.Meta.ashFor(staked), 10, 'Einsatz 1 bringt 25 % mehr Asche');
  assert.deepStrictEqual(ZU.Meta.clean({ ash: -5, stake: 9, maxStake: 99, unlocked: { 'trinket:gibtsnicht': true, 'special:tausch': true }, upgrades: { startgeld: 99, quatsch: 3 } }),
    Object.assign(ZU.Meta.defaults(), { stake: 5, maxStake: 5, unlocked: { 'special:tausch': true }, upgrades: { startgeld: 3 } }));
  ZU.Profile._memory = null;
}

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
