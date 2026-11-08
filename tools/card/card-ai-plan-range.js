// MFバトルカード: 方針の上書き(AI が決める plan)の幅を測る道具(2026-11-08 カード部ルールくん)。検査ではなく測るだけ
//   くせ(big・saveGuts・keepGuard)を CARD_AI_PLAN_RANGE の両端に置いた8通りに、prefer(候補 cardAiPlanCandidates から種で選ぶ)と field(場のカードから種で選ぶ)を
//   混ぜて、強さの段ごとの勝率(プレイヤー役=スターター3つ)が、方針なしからどれだけ外れるかを出す
//
//   node tools/card/card-ai-plan-range.js [--corner 0..7] [--games 20] [--levels easy,normal,hard,expert,master] [--json <出力>]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const src = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n${src('src/parts/82-card-tactics-core.jsx')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_AI_HABITS, CARD_AI_PLAN_RANGE, cardAiBuildDeck, cardAiSeededRand, cardSimulate, cardAiPolicy, cardMonsterOf, cardUsableBy, cardAiPlanCandidates };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const games = Number(opt('--games', 20)) || 20;
const LV = opt('--levels', 'easy,normal,hard,expert,master').split(',');
const corners = opt('--corner', null) !== null ? [Number(opt('--corner'))] : [...Array(8).keys()];
const WHO = Object.keys(E.CARD_AI_HABITS);
const kits = Object.keys(db.starters);
const R = E.CARD_AI_PLAN_RANGE;
const keys = Object.keys(R.habit);
const fields = Object.values(db.cards).filter((c) => c.ready && c.kind === 'fld');

const planOf = (corner, w, lv, k, g, mine0) => {
  const rnd = E.cardAiSeededRand(`plan:${corner}:${w}:${lv}:${k}:${g}`);
  const habit = Object.fromEntries(keys.map((key, i) => [key, R.habit[key][(corner >> i) & 1]]));
  // AI へ送る候補(上位の札)から、種でえらぶ(AI がいちばん下手に選んだときに近い)
  const usable = E.cardAiPlanCandidates(db, w, lv, mine0.monsters);
  const n = R.prefer[0] + Math.floor(rnd() * (R.prefer[1] - R.prefer[0] + 1));
  const prefer = [];
  while (prefer.length < n && usable.length) { const c = usable[Math.floor(rnd() * usable.length)]; if (!prefer.includes(c.no)) prefer.push(c.no); }
  const fn = R.field[0] + Math.floor(rnd() * (R.field[1] - R.field[0] + 1));
  const field = [];
  while (field.length < fn) { const c = fields[Math.floor(rnd() * fields.length)]; if (!field.includes(c.name)) field.push(c.name); }
  return { prefer, field, habit };
};
const rate = (w, lv, corner) => {
  let win = 0, n = 0, seed = 1;
  for (const k of kits) for (let g = 0; g < games; g++) {
    const rs = `${w}:${lv}:${k}:${g}`;
    const base = E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(rs), { playerDeck: E.cardAiBuildDeck(db, k) });
    const mine = corner === null ? base : E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(rs), { playerDeck: E.cardAiBuildDeck(db, k), plan: planOf(corner, w, lv, k, g, base) });
    const s = E.cardSimulate(db, { decks: [mine, E.cardAiBuildDeck(db, k)], policies: [E.cardAiPolicy(w, lv, { sameBlood: !!mine.sameBlood }), E.cardAiPolicy('kyuko', lv, { playerRole: true })], seed: 7000 + seed++, first: g % 2 });
    if (s.winner === 0) win++;
    n++;
  }
  return win / n * 100;
};
const out = {};
for (const w of WHO) for (const lv of LV) {
  const base = rate(w, lv, null);
  out[`${w}:${lv}`] = { base, d: corners.map((c) => rate(w, lv, c) - base) };
}
const jsonOut = opt('--json', null);
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ games, corners, out }, null, 2));
for (const [k, v] of Object.entries(out)) console.log(`${k.padEnd(18)} ${v.base.toFixed(0).padStart(3)}  ${v.d.map((x) => (x >= 0 ? '+' : '') + x.toFixed(0)).join(' ')}`);
