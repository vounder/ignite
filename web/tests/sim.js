/* Simulationstest: spielt viele komplette Runs mit einem einfachen Autospieler durch und
   prüft dabei Invarianten (Kartenerhaltung, keine Endlosschleifen, gültige Zustände).
   Aufruf: node web/tests/sim.js [Anzahl Runs] */
require('../js/data.js');
require('../js/engine.js');
require('../js/run.js');
const ZU = globalThis.ZU;
const assert = require('assert');

const RUNS = Number(process.argv[2] || 400);
const tally = {};
let duels = 0, victories = 0, maxTurns = 0, sumTurns = 0, decisions = {}, eventTypes = {};

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
      } else {
        ev = duel.draw('player');
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
  for (let pass = 0; pass < 2; pass++) {
    s.shop.trinkets.forEach((offer, i) => {
      if (!offer.sold && s.money >= offer.price && rnd.next() < 0.7) {
        const replace = s.trinkets.length >= ZU.MAX_TRINKETS ? s.trinkets[rnd.int(s.trinkets.length)] : undefined;
        run.buyTrinket(i, replace);
      }
    });
    s.shop.cards.forEach((offer, i) => {
      if (!offer.sold && ZU.CARDS[offer.def].special && s.money >= run.cardPrice(i) && rnd.next() < 0.6) run.buyCard(i);
    });
    if (s.lives < ZU.MAX_LIVES && !s.shop.healed && s.money >= run.healPrice()) run.heal();
    if (s.collection.length > 7 && s.money >= run.burnPrice() && rnd.next() < 0.5) {
      const plain = s.collection.filter(c => !ZU.CARDS[c.def].special);
      if (plain.length) run.burn(plain[0].id);
    }
    if (pass === 0 && s.money >= run.rerollPrice() + 8 && rnd.next() < 0.3) run.reroll();
  }
  assert.throws(() => run.buyCard(99));
  assert.ok(s.money >= 0);
  assert.ok(s.trinkets.length <= ZU.MAX_TRINKETS);
  assert.strictEqual(new Set(s.trinkets).size, s.trinkets.length);
  run.leaveShop();
}

for (let n = 0; n < RUNS; n++) {
  const starter = ZU.STARTERS[n % ZU.STARTERS.length];
  let run = ZU.Run.start(starter.id, 1000 + n * 7919);
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
      const replace = r.type === 'trinket' && run.s.trinkets.length >= ZU.MAX_TRINKETS ? run.s.trinkets[0] : undefined;
      run.chooseReward(rnd.next() < 0.8 ? rnd.int(r.options.length) : null, replace);
    }
    assert.strictEqual(run.s.phase, 'shop');
    // Speichern/Laden muss den Zustand exakt erhalten
    const copy = new ZU.Run(JSON.parse(JSON.stringify(run.s)));
    assert.deepStrictEqual(copy.s, run.s);
    run = copy;
    shop(run, rnd);
    const ids = run.s.collection.map(c => c.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'doppelte Karten-ID im Deck');
  }
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
console.log('Entscheidungen:', decisions, 'Züge/Duell:', (sumTurns / duels).toFixed(1));
console.log('Ereignisse:', Object.keys(eventTypes).sort().map(k => k + '=' + eventTypes[k]).join(' '));
Object.keys(tally).sort().forEach(k => console.log('  %s  %d Duelle, Spieler gewinnt %s%%', k.padEnd(28), tally[k].n, (100 * tally[k].w / tally[k].n).toFixed(0)));
console.log('OK');
