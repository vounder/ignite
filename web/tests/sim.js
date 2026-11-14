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

/* Die angezeigte Rechnung muss aufgehen: Grundwert × Kette, dann jeder Schritt, ergibt genau die gutgeschriebene Glut. */
function checkScore(e) {
  if (e.t !== 'play' || !e.score) return;
  let v = e.score.base * e.score.eff;
  (e.score.steps || []).forEach(st => {
    v = st.round ? Math.round(v * st.f) : v * st.f;
    assert.strictEqual(st.v, v, 'Rechenschritt stimmt nicht: ' + JSON.stringify(st));
  });
  assert.strictEqual(v, e.score.points, 'Rechnung ergibt nicht die Glut der Karte');
}

function record(events) {
  events.forEach(e => { eventTypes[e.t] = (eventTypes[e.t] || 0) + 1; assert.ok(e.t, 'Ereignis ohne Typ'); checkScore(e); });
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
  // Kniff: neuer Kniff oder nächste Stufe; nie über die Plätze oder Stufe 3 hinaus
  const kn = s.kniffOffer;
  assert.strictEqual(kn.act, s.act, 'Kniff-Angebot gehört zum laufenden Akt');
  if (kn.id && !kn.sold) {
    assert.ok(ZU.KNIFFE[kn.id] && kn.level >= 1 && kn.level <= 3 && kn.price >= 1);
    if (kn.fresh) assert.ok(run.kniffe().length < run.kniffSlots() && !run.kniffe().some(k => k.id === kn.id));
    else assert.strictEqual(run.kniffe().find(k => k.id === kn.id).level, kn.level - 1);
    if (s.money >= kn.price && rnd.next() < 0.7) {
      run.buyKniff();
      assert.strictEqual(run.kniffe().find(k => k.id === kn.id).level, kn.level);
      assert.throws(() => run.buyKniff());
    }
  }
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
    if (s.lives < run.maxLives() && !s.shop.healed && s.money >= run.healPrice()) run.heal();
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

// Startdeck: die normalen Karten der Schachtel (meist 16) plus ihre Spezialkarten; jede Seite zieht vom eigenen Stapel.
ZU.STARTERS.forEach(starter => {
  const run = ZU.Run.start(starter.id, 900, ZU.Meta.runOptions(ZU.Meta.defaults()));
  const specials = run.s.collection.filter(c => ZU.CARDS[c.def].special);
  const normal = run.s.collection.filter(c => !ZU.CARDS[c.def].special);
  assert.strictEqual(normal.length, starter.size || ZU.DECK_SIZE, starter.id + ': Zahl der normalen Karten');
  assert.strictEqual(new Set(normal.map(c => c.def)).size, normal.length, starter.id + ': keine Karte doppelt');
  assert.strictEqual(specials.length, (starter.special ? 1 : 0) + starter.cards.filter(d => ZU.CARDS[d].special).length, starter.id + ': Spezialkarten');
  assert.ok(specials.length <= ZU.SPECIAL_SLOTS, starter.id + ': Spezialkarten passen ins Deck');
  starter.cards.forEach(def => assert.ok(run.s.collection.some(c => c.def === def), starter.id + ': feste Karte ' + def));
  if (starter.suits) assert.ok(normal.every(c => starter.suits.includes(ZU.CARDS[c.def].suit)), starter.id + ': nur die Symbole der Schachtel');
  assert.deepStrictEqual(run.s.collection.filter(c => c.seal).map(c => c.seal).sort(), (starter.seals || []).slice().sort(), starter.id + ': Siegel');
  assert.ok(run.s.collection.every(c => !c.seal || !ZU.CARDS[c.def].special), starter.id + ': Siegel nur auf normalen Karten');
  assert.strictEqual(run.s.lives, ZU.MAX_LIVES + (starter.lives || 0), starter.id + ': Streichhölzer');
  assert.strictEqual(run.maxLives(), run.s.lives, starter.id + ': die Schachtel ist voll');
  starter.trinkets.forEach(id => assert.ok(ZU.TRINKETS[id], starter.id + ': Trinket ' + id));
  (starter.kniffe || []).forEach(k => assert.ok(ZU.KNIFFE[k.id], starter.id + ': Kniff ' + k.id));
  assert.ok(ZU.Meta.REQ['starter:' + starter.id] || starter.id === 'classic', starter.id + ': Bedingung fürs Hinterzimmer');
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

// Das Upgrade „Flinke Finger" wurde gestrichen: Wer es hatte, bekommt 20 Asche zurück und startet ohne das Privileg.
{
  const meta = ZU.Meta.defaults();
  assert.strictEqual(ZU.Meta.UPGRADES.flinkefinger, undefined);
  meta.ash = 3; meta.upgrades.flinkefinger = 1;
  const cleaned = ZU.Meta.clean(meta);
  assert.strictEqual(cleaned.ash, 23);
  assert.strictEqual(cleaned.upgrades.flinkefinger, undefined);
  assert.strictEqual(ZU.Meta.clean(cleaned).ash, 23, 'nur einmal erstattet');
  assert.strictEqual(ZU.Run.start('classic', 12, ZU.Meta.runOptions(cleaned)).kniffe().length, 0);
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

// Kniffe: Ein Zug folgt genau einem Kniff, die Stufe begrenzt die Kartenzahl.
{
  const mk = (kniffe) => { const r = ZU.Run.start('classic', 77); r.s.kniffe = kniffe; const d = r.newDuel(); d.start(); return d; };
  const card = (d, def) => d._register(def, 'player', false);
  let d = mk([]);
  assert.strictEqual(d.groupOk([card(d, 'hearts-8'), card(d, 'spades-8')]).ok, false, 'ohne Kniff kein Mehrfachlegen');
  d = mk([{ id: 'pasch-8', level: 1 }]);
  const e = [card(d, 'hearts-8'), card(d, 'spades-8'), card(d, 'clubs-8')];
  assert.strictEqual(d.groupOk(e.slice(0, 2)).kniff, 'pasch-8');
  assert.strictEqual(d.groupOk(e).ok, false, 'Stufe 1 erlaubt nur 2 Karten');
  assert.strictEqual(d.groupOk([card(d, 'hearts-9'), card(d, 'spades-9')]).ok, false, 'Achterpasch gilt nur für 8en');
  d = mk([{ id: 'lauf-spades', level: 2 }, { id: 'folge', level: 3 }]);
  assert.strictEqual(d.groupOk([card(d, 'spades-7'), card(d, 'spades-K'), card(d, 'spades-9')]).kniff, 'lauf-spades');
  assert.strictEqual(d.groupOk([card(d, 'hearts-10'), card(d, 'hearts-8'), card(d, 'hearts-9'), card(d, 'hearts-J')]).kniff, 'folge');
  assert.strictEqual(d.groupOk([card(d, 'hearts-8'), card(d, 'hearts-10')]).ok, false, 'Lücke ist keine Straße');
  assert.strictEqual(d.groupOk([card(d, 'hearts-8'), card(d, 'diamonds-8')]).ok, false, 'kein Pasch ohne Pasch-Kniff');
  // Ein echter Zug: zwei 8en mit Achterpasch.
  d = mk([{ id: 'pasch-8', level: 2 }]);
  d.phase = 'action'; d.active = 'player'; d.pending = null; d.afterDraw = null;
  const a = card(d, 'hearts-8'), b = card(d, 'spades-8');
  d.hand.player.push(a, b);
  d.pile.push(d._register('hearts-9', 'house', false));
  const ev = d.play('player', [b, a]);
  assert.ok(ev.some(x => x.t === 'kniff' && x.id === 'pasch-8' && x.count === 2));
  // Zündler startet mit Siebenerpasch; alte Spielstände mit „Flinke Finger" bekommen Pasch Stufe 3.
  assert.deepStrictEqual(ZU.Run.start('igniter', 5).kniffe(), [{ id: 'pasch-7', level: 2 }]);
  // Staffelung: ohne ausgeräumtes Casino nur die einfachen Kniffe.
  const fresh = ZU.Run.start('classic', 5, ZU.Meta.runOptions(ZU.Meta.defaults()));
  assert.ok(fresh.kniffPool().length > 0 && fresh.kniffPool().every(id => ZU.KNIFFE[id].tier === 0));
  assert.strictEqual(fresh.kniffSlots(), 1);
}

// Nach dem Boss gehört der Laden schon zum nächsten Akt; der Kniff ist wie das Privileg nur einmal je Akt zu haben.
{
  const run = ZU.Run.start('classic', 909);
  run.s.table = 2; run.s.money = 500;
  run._openShop();
  assert.strictEqual(run.s.act, 2);
  assert.strictEqual(run.s.table, -1);
  assert.strictEqual(run.s.perkOffer.act, 2);
  assert.strictEqual(run.s.kniffOffer.act, 2);
  const offer = JSON.stringify(run.s.kniffOffer);
  run.buyKniff();
  assert.throws(() => run.buyKniff());
  run.leaveShop();
  assert.strictEqual(run.s.act, 2); assert.strictEqual(run.s.table, 0);
  run._openShop();
  assert.strictEqual(run.s.kniffOffer.sold, true, 'im selben Akt kein zweiter Kniff');
  assert.strictEqual(run.s.table, 0);
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

// Glut-Mult: Jedes Stück ist ein eigener Faktor; zusammen multiplizieren sie sich. Vabanque geht bei einer Niederlage verloren.
{
  const plainDef = id => { const c = ZU.CARDS[id]; return !c.special && !'78AJ'.includes(c.rank); };
  /* Legt eine einzelne normale Karte (oder zwei gleiche Werte als Zug) mit den gegebenen Trinkets und liefert die Wertung. */
  const score = (trinkets, setup, salvo) => {
    const run = ZU.Run.start('classic', 606);
    run.s.trinkets = trinkets.slice();
    if (setup && setup.run) setup.run(run);
    const d = run.newDuel();
    d.start();
    d.phase = 'action'; d.active = 'player'; d.pending = null; d.afterDraw = null;
    d.status.curse.player = 0; d.status.curse.opp = 0;
    if (setup && setup.duel) setup.duel(d);
    const card = d.hand.player.concat(d.stocks.player).find(id => plainDef(d.cards[id].def));
    if (!d.hand.player.includes(card)) { d.stocks.player.splice(d.stocks.player.indexOf(card), 1); d.hand.player.push(card); }
    d.pile.push(d._register(d.cards[card].def, 'house', false));
    const ev = [];
    d.salvo = salvo || 0;
    d._putOnTable('player', card, 'hand', ev);
    const sc = ev.find(e => e.t === 'play').score;
    checkScore(ev.find(e => e.t === 'play'));
    return { points: sc.points, plain: sc.base * sc.eff, steps: sc.steps, d: d };
  };
  const f = r => r.points / r.plain;
  assert.strictEqual(f(score([])), 1);
  assert.strictEqual(f(score(['brandbeschleuniger'])), 1.5);
  assert.strictEqual(f(score(['chefsache'])), 1, 'Chefsache ruht am gewöhnlichen Tisch');
  assert.strictEqual(f(score(['chefsache'], { duel: d => { d.kind = 'elite'; } })), 1);
  assert.strictEqual(f(score(['chefsache'], { duel: d => { d.kind = 'boss'; } })), 3);
  assert.strictEqual(f(score(['oel-ins-feuer'], { duel: d => { d.douse = []; } })), 1);
  assert.strictEqual(f(score(['oel-ins-feuer'], { duel: d => { d.douse = ['sand']; } })), 1.5);
  assert.strictEqual(f(score(['oel-ins-feuer'], { duel: d => { d.douse = ['blanket', 'water']; d.chain = 4; } })), 2.25);
  const crowd = score(['schaulustige'], { duel: d => { d.hand.opp.length = 5; } });
  assert.strictEqual(f(crowd), 1.5, '+×0,1 je Handkarte des Gegners');
  assert.strictEqual(f(score(['hexenfeuer'])), 1);
  assert.strictEqual(f(score(['hexenfeuer'], { duel: d => { d.status.curse.opp = 1; } })), 2);
  assert.strictEqual(f(score(['breitseite'])), 1, 'einzelne Karte: keine Breitseite');
  assert.strictEqual(f(score(['breitseite'], null, 2)), 2);
  assert.strictEqual(f(score(['weissglut'], { duel: d => { d.chain = 10; } })), 2);
  assert.strictEqual(f(score(['weissglut'], { duel: d => { d.chain = 5; } })), 1.5);
  assert.strictEqual(f(score(['kerbholz'])), 1);
  assert.strictEqual(f(score(['kerbholz'], { run: r => { r.s.burntCount = 4; } })), 2);
  assert.strictEqual(f(score(['vabanque'])), 3);
  // zusammen: ×1,5 · ×2 · ×3 = ×9 – nicht +350 %
  const all = score(['brandbeschleuniger', 'hexenfeuer', 'vabanque'], { duel: d => { d.chain = 4; d.status.curse.opp = 2; } });
  assert.strictEqual(f(all), 9);
  assert.deepStrictEqual(all.steps.map(st => st.id), ['brandbeschleuniger', 'hexenfeuer', 'vabanque']);
  // Breitseite im echten Zug: Zwei Könige mit dem Pasch – beide Karten zählen doppelt, eine einzelne danach nicht.
  {
    const run = ZU.Run.start('classic', 607);
    run.s.trinkets = ['breitseite'];
    run.s.kniffe = [{ id: 'pasch', level: 3 }];
    const d = run.newDuel(); d.start();
    d.phase = 'action'; d.active = 'player'; d.pending = null; d.afterDraw = null; d.target = 1e9;
    const kings = ['hearts-K', 'spades-K'].map(def => { const id = d._register(def, 'player', false); d.hand.player.push(id); return id; });
    d.pile.push(d._register('hearts-9', 'house', false));
    const plays = d.play('player', kings).filter(e => e.t === 'play' && e.score);
    assert.strictEqual(plays.length, 2);
    plays.forEach(e => { checkScore(e); assert.deepStrictEqual(e.score.steps.map(st => st.id), ['breitseite']); });
    assert.strictEqual(d.salvo, 0);
  }
  // Kerbholz zählt abgefackelte Tische des Runs; Vabanque ist nach einer Niederlage fort.
  {
    const run = ZU.Run.start('classic', 608);
    run.s.trinkets = ['vabanque', 'kerbholz'];
    let d = run.newDuel(); d.start();
    d.glut = d.target; d.phase = 'action'; d.active = 'player'; d.pending = null;
    const card = d.hand.player.find(id => !d.def(id).special);
    d.pile.push(d._register(d.cards[card].def, 'house', false));
    d.play('player', [card]);
    assert.strictEqual(run.finishDuel(d).burnt, true);
    assert.strictEqual(run.s.burntCount, 1);
    run.afterPayout();
    if (run.s.phase === 'reward') run.chooseReward(null);
    run.leaveShop();
    d = run.newDuel(); d.start();
    assert.strictEqual(d.grow.burnt, 1);
    d.winner = 'opp'; d.phase = 'ended';
    const lost = run.finishDuel(d);
    assert.strictEqual(lost.won, false);
    assert.strictEqual(lost.gone, 'vabanque');
    assert.deepStrictEqual(run.s.trinkets, ['kerbholz']);
  }
  // Jedes Trinket hat ein Bild, und alles außerhalb der Grundausstattung hat eine Bedingung.
  const fs = require('fs'), path = require('path');
  ZU.TRINKET_IDS.forEach(id => {
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'trinkets', id + '.png')), 'Bild fehlt: ' + id);
    assert.ok(ZU.Meta.BASE.trinket.includes(id) || ZU.Meta.REQ['trinket:' + id], 'weder Grundausstattung noch Bedingung: ' + id);
  });
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
