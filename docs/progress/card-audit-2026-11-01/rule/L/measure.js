// 点検 L(2026-11-01 ルールくん): きゅうこ MASTER の強さ(プレイヤー役のスターター3つへの勝率)と、出た3体の組みを数える。
// 測り方は tools/card/card-rules-check.js の「助手の強さ」と同じ(スターターごとに per 試合・種も同じ)。
//   node measure.js <リポジトリの道> [per=150]
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(process.argv[2] || '.');
const PER = Number(process.argv[3] || 150);
const GAME = path.join(ROOT, 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
const src = `${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardAiBuildDeck, cardAiSeededRand, cardSimulate, cardAiPolicy, cardMonsterOf };';
vm.runInContext(src, ctx);
const E = ctx.E, db = E.CARD_BATTLE_DATA;
const w = 'kyuko', lv = 'master';
let win = 0, n = 0, sd = 1;
const trios = {};
Object.keys(db.starters).forEach((k) => {
  for (let g = 0; g < PER; g++) {
    const d = E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(`${w}:${lv}:${k}:${g}`), { playerDeck: E.cardAiBuildDeck(db, k) });
    const name = d.monsters.map((no) => E.cardMonsterOf(db, no).name + (E.cardMonsterOf(db, no).variant || '')).join('・');
    trios[name] = (trios[name] || 0) + 1;
    const st = E.cardSimulate(db, { decks: [d, E.cardAiBuildDeck(db, k)], policies: [E.cardAiPolicy(w, lv, { sameBlood: !!d.sameBlood }), E.cardAiPolicy('kyuko', lv, { playerRole: true })], seed: 7000 + sd++, first: g % 2 });
    if (st.winner === 0) win += 1; n += 1;
  }
});
console.log(JSON.stringify({ games: n, rate: Math.round((win / n) * 1000) / 10, trios: Object.entries(trios).sort((a, b) => b[1] - a[1]) }));
