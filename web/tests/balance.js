/* Balance-Messung: Wie viel bringt jedes Trinket bzw. Privileg für sich genommen?
   Spielt für jedes Stück viele Duelle mit einem Autospieler – einmal ohne, einmal mit –
   und zeigt die Veränderung von Siegquote und Auszahlung.
   Aufruf: node web/tests/balance.js [Duelle je Messung] */
require('../js/data.js');
require('../js/engine.js');
require('../js/run.js');
require('../js/meta.js');
const ZU = globalThis.ZU;

const N = Number(process.argv[2] || 1500);
const ENEMIES = [
  ['ember-croupier', 'battle'], ['curse-dealer', 'battle'], ['cheater', 'battle'], ['bruiser', 'battle'],
  ['card-counter', 'elite'], ['bouncer', 'elite'], ['boss-smoke', 'boss'], ['boss-consigliere', 'boss']
];
/* Ein typisches Deck aus der Mitte eines Runs: Standardkarten plus ein paar gebundene Spezialkarten. */
const DECK = [
  ['hearts-7'], ['spades-7'], ['diamonds-9'], ['clubs-10'], ['hearts-K'], ['spades-A'], ['diamonds-Q'], ['clubs-8'],
  ['addieren', 'hearts'], ['stillstand', 'black'], ['fluch', 'red'], ['opfer', 'spades']
];

function measure(trinkets, perks, seedBase) {
  let wins = 0, money = 0, glut = 0, turns = 0;
  for (let n = 0; n < N; n++) {
    const run = ZU.Run.start('classic', seedBase + n * 7919);
    const s = run.s;
    s.act = 2;
    s.money = 20;
    s.collection = [];
    s.nextId = 1;
    DECK.forEach(card => run._add(card[0], card[1]));
    s.trinkets = trinkets.slice();
    s.perks = perks.slice();
    const pick = ENEMIES[n % ENEMIES.length];
    s.encounters = [{ enemy: pick[0], kind: pick[1], rules: n % 4 === 0 ? ['one-pass'] : [] }];
    s.table = 0;
    const duel = run.newDuel();
    duel.start();
    let guard = 0;
    while (duel.phase !== 'ended' && guard++ < 800) {
      if (duel.pending) {
        const d = duel.pending;
        duel.decide(d.options.slice(0, d.kind === 'mulligan' ? 0 : d.min));
      } else if (duel.active === 'player') {
        const plan = duel.suggest();
        if (plan) duel.play('player', plan);
        else if (duel.afterDraw) duel.pass('player');
        else duel.draw('player');
      } else {
        duel.aiMove();
      }
    }
    turns += duel.turns;
    glut += duel.glut;
    const before = s.money;
    const result = run.finishDuel(duel);
    if (result.won) { wins++; money += s.money - before; }
  }
  return { win: 100 * wins / N, money: money / N, glut: glut / N, turns: turns / N };
}

ZU.Profile._memory = null;
const base = measure([], ['nimble-fingers'], 1);
const plain = measure([], [], 1);
console.log('Grundlinie (mit Flinke Finger): Sieg %s %%, %s Mark je Duell, %s Glut, %s Züge'
  , base.win.toFixed(1), base.money.toFixed(1), base.glut.toFixed(0), base.turns.toFixed(1));
console.log('Ohne alles:                     Sieg %s %%, %s Mark je Duell\n', plain.win.toFixed(1), plain.money.toFixed(1));

const rows = [];
ZU.TRINKET_IDS.forEach(id => {
  const r = measure([id], ['nimble-fingers'], 1);
  rows.push({ id, name: ZU.TRINKETS[id].name, rarity: ZU.TRINKETS[id].rarity, price: ZU.TRINKETS[id].price, win: r.win - base.win, money: r.money - base.money });
});
ZU.PERK_IDS.filter(id => id !== 'nimble-fingers').forEach(id => {
  const r = measure([], ['nimble-fingers', id], 1);
  rows.push({ id, name: ZU.PERKS[id].name + ' (P)', rarity: -1, price: ZU.PERKS[id].price, win: r.win - base.win, money: r.money - base.money });
});
rows.push({ id: 'nimble-fingers', name: 'Flinke Finger (P)', rarity: -1, price: ZU.PERKS['nimble-fingers'].price, win: base.win - plain.win, money: base.money - plain.money });

/* Synergien: ganze Sets gegen die Grundlinie */
const SETS = [
  ['afterburner', 'furnace'],
  ['afterburner', 'furnace', 'heartblood', 'black-series', 'fuse', 'card-shark'],
  ['hex-board', 'voodoo', 'seven-sleeper', 'gold-tooth'],
  ['pair-king', 'seven-sleeper', 'brass-knuckles'],
  ['stopwatch', 'rollercoaster', 'seven-sleeper'],
  ['master-key', 'hot-wire', 'velvet-glove'],
  ['short-fuse', 'cellar-key']
];
const sets = SETS.map(set => {
  const r = measure(set, ['nimble-fingers'], 1);
  return { names: set.map(id => ZU.TRINKETS[id].name).join(' + '), win: r.win - base.win, money: r.money - base.money, cost: set.reduce((sum, id, i) => sum + ZU.TRINKETS[id].price + ZU.TRINKET_SURCHARGE * i, 0) };
});

/* Wert in "Mark je Duell": Auszahlungsplus, dazu jeder Prozentpunkt Siegquote grob wie 0,15 Mark. */
rows.forEach(r => { r.value = r.money + r.win * 0.15; });
rows.sort((a, b) => b.value - a.value);
console.log('Stück                     Selt.  Preis   Sieg ±    Mark ±   Wert');
rows.forEach(r => {
  console.log('%s %s  %s  %s  %s  %s', r.name.padEnd(25), (r.rarity < 0 ? 'P' : String(r.rarity)).padStart(4), String(r.price).padStart(5),
    ((r.win >= 0 ? '+' : '') + r.win.toFixed(1)).padStart(7), ((r.money >= 0 ? '+' : '') + r.money.toFixed(2)).padStart(8), r.value.toFixed(2).padStart(6));
});

console.log('');
console.log('Sets (gegen die Grundlinie)                                                   Sieg ±   Mark ±  Kaufpreis');
sets.forEach(r => console.log('%s %s %s %s', r.names.padEnd(76), ((r.win >= 0 ? '+' : '') + r.win.toFixed(1)).padStart(6),
  ((r.money >= 0 ? '+' : '') + r.money.toFixed(2)).padStart(8), String(r.cost).padStart(8)));
