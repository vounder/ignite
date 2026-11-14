/* Messung: Wie oft fällt das Glutziel? Spielt komplette Runs mit einem Autospieler und zeigt je Akt,
   wie viele Siege den Tisch abfackeln und wie weit die Glut ans Ziel kommt.
   Aufruf: node web/tests/glutziel.js [Runs] [Casino 0–7] [base|all] [focus]
     base  = nur die Grundausstattung liegt im Laden (Standard), all = jedes Trinket
     focus = Glut-Spieler: kauft zuerst Glut-Mult, sonst nur Trinkets mit Glut/Kette, und lässt neu auslegen
   Zum Probieren anderer Kurven: PER_ACT=1.7 PER_CASINO=0.25 node web/tests/glutziel.js … */
['data', 'lore', 'engine', 'run', 'meta'].forEach(f => require('../js/' + f + '.js'));
const ZU = globalThis.ZU;
const RUNS = Number(process.argv[2] || 300), STAKE = Number(process.argv[3] || 0);
const ALL = process.argv[4] === 'all', FOCUS = process.argv[5] === 'focus';
if (process.env.PER_ACT) ZU.GLUT_TARGET.perAct = Number(process.env.PER_ACT);
if (process.env.PER_CASINO) ZU.GLUT_TARGET.perCasino = Number(process.env.PER_CASINO);
const MULT = ['brandbeschleuniger', 'chefsache', 'oel-ins-feuer', 'schaulustige', 'hexenfeuer', 'breitseite', 'weissglut', 'kerbholz', 'vabanque'];
const glutish = id => MULT.includes(id) || /Glut|Kette/.test(ZU.TRINKETS[id].text);

function playDuel(run) {
  const duel = run.newDuel();
  duel.start();
  let guard = 0;
  while (duel.phase !== 'ended' && guard++ < 900) {
    if (duel.pending) { const d = duel.pending; duel.decide(d.options.slice(0, d.kind === 'mulligan' ? 0 : d.min)); }
    else if (duel.active === 'player') {
      const plan = duel.suggest();
      if (plan) duel.play('player', plan); else if (duel.afterDraw) duel.pass('player'); else duel.draw('player');
    } else duel.aiMove();
  }
  return duel;
}

function shop(run) {
  const s = run.s;
  const buy = want => s.shop.trinkets.forEach((o, i) => { if (!o.sold && want(o.id) && s.money >= run.trinketPrice(i)) run.buyTrinket(i); });
  if (s.kniffOffer && s.kniffOffer.id && !s.kniffOffer.sold && s.money >= s.kniffOffer.price) run.buyKniff();
  if (FOCUS) {
    for (let round = 0; round < 3; round++) {
      buy(id => MULT.includes(id));
      buy(glutish);
      if (round < 2 && s.money >= run.rerollPrice() + 15) run.reroll(); else break;
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    buy(id => !FOCUS || glutish(id));
    s.shop.specials.forEach((o, i) => { if (!o.sold && s.money >= run.offerPrice('specials', i) && run.specialFree()) run.buySpecial(i); });
    if (s.lives < run.maxLives() && !s.shop.healed && s.money >= run.healPrice()) run.heal();
    if (pass === 0 && !FOCUS && s.money >= run.rerollPrice() + 20) run.reroll();
  }
  run.leaveShop();
}

const acts = {};
let victories = 0;
for (let n = 0; n < RUNS; n++) {
  ZU.Profile._memory = null;
  const meta = ZU.Meta.defaults();
  meta.maxStake = meta.stake = STAKE;
  const options = ZU.Meta.runOptions(ZU.Meta.clean(meta));
  if (ALL) options.trinkets = ZU.TRINKET_IDS.slice();
  const run = ZU.Run.start('classic', 5000 + n * 7919, options), rnd = new ZU.Rng(42 + n);
  let guard = 0;
  while (run.s.phase !== 'defeat' && guard++ < 200) {
    const act = run.s.act, duel = playDuel(run), result = run.finishDuel(duel);
    const a = (acts[act] = acts[act] || { n: 0, won: 0, burnt: 0, ratios: [], trinkets: 0 });
    a.n++; a.trinkets += run.s.trinkets.length;
    if (!result.won) continue;
    a.won++; a.ratios.push(duel.glut / duel.target);
    if (result.burnt) a.burnt++;
    const phase = run.afterPayout();
    if (phase === 'victory') { victories++; break; }
    if (phase === 'reward') {
      const r = run.s.reward;
      run.chooseReward(r.type === 'card' && !run.specialFree() ? null : rnd.int(r.options.length));
    }
    shop(run);
  }
}

console.log('%d Runs in %s, Laden: %s, Spieler: %s – %d Runs gewonnen', RUNS, ZU.CASINOS[STAKE].name, ALL ? 'alle Trinkets' : 'Grundausstattung', FOCUS ? 'baut auf Glut' : 'kauft alles', victories);
Object.keys(acts).forEach(k => {
  const a = acts[k];
  a.ratios.sort((x, y) => x - y);
  const q = p => a.ratios.length ? Math.round(100 * a.ratios[Math.floor(p * (a.ratios.length - 1))]) + ' %' : '–';
  console.log('  Akt %s: %d Duelle, %d %% gewonnen, davon abgefackelt %s %% | Glut/Ziel bei Siegen: Median %s, oberes Viertel %s, bestes Zehntel %s | Trinkets ø %s',
    k, a.n, Math.round(100 * a.won / a.n), (100 * a.burnt / Math.max(1, a.won)).toFixed(1), q(0.5), q(0.75), q(0.9), (a.trinkets / a.n).toFixed(1));
});
