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
    Object.assign(ZU.Meta.defaults(), { stake: 5, maxStake: 5, unlocked: { 'special:tausch': true }, upgrades: { startgeld: 3 }, feats: { chain: 7 } }));

  // Asche fließt sofort nach jedem Sieg; die Nachglut bringt keine mehr.
  ZU.Profile._memory = null;
  let live = ZU.Run.start('classic', 4242, ZU.Meta.runOptions()), paid = 0, safety = 0;
  const rnd2 = new ZU.Rng(5);
  while (live.s.phase !== 'defeat' && !live.s.endless && ++safety < 80) {
    const before = ZU.Meta.get().ash, kind = live.encounter().kind, last = live.s.act === live.acts() && kind === 'boss';
    const result = live.finishDuel(Object.assign(playDuel(live, rnd2), { winner: 'player' }));
    assert.strictEqual(result.ash, ZU.Meta.ASH[kind] + (last ? ZU.Meta.ASH.victory : 0), 'Asche direkt nach dem Sieg');
    assert.strictEqual(ZU.Meta.get().ash, before + result.ash);
    paid += result.ash;
    let phase = live.afterPayout();
    if (phase === 'victory') { assert.strictEqual(ZU.Meta.get().maxStake, 1, 'das nächste Casino ist offen'); phase = live.continueEndless(); }
    if (phase === 'reward') live.chooseReward(null);
    live.leaveShop();
  }
  assert.strictEqual(live.s.endless, true);
  assert.strictEqual(paid, 3 * 8 + 8);
  const after = ZU.Meta.get().ash;
  const extra = live.finishDuel(Object.assign(playDuel(live, rnd2), { winner: 'player' }));
  assert.strictEqual(extra.ash, 0, 'Nachglut: keine Asche mehr');
  assert.strictEqual(ZU.Meta.get().ash, after);
  assert.strictEqual(ZU.Meta.feat(ZU.Meta.get(), 'casino'), 1);
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
