// MFバトルカード: 助手どうしの強さを測る(同じ難易度で総当たり。それぞれの助手の勝率を出す)
// 公開の条件「EXPERT・MASTER で、どの助手もほかの助手と同じくらいの強さにする」(進捗メモ)を確かめるための道具。
// 使い方: node tools/card/card-ai-balance.js [--levels expert,master] [--games 40] [--vs starter|each] [--json <出力>]
//   --vs starter(既定)… プレイヤー役(スターター3つを順に・くせの無い考え方 kyuko・同じ難易度)と戦う。カードポイントの稼ぎやすさはこちらで見る
//   --vs each … 助手どうしの総当たり
//   --games … 1組あたりの試合数(先攻・後攻を半分ずつ入れかえる)。組は 6人 × 5人 / 2 = 15組
// 読み方: 「勝率」は、その助手がほかの5人と戦ったときの勝ちの割合(50% がちょうど真ん中)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const load = () => {
  const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
  const src = `${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
    + 'this.E = { CARD_BATTLE_DATA, cardSimulate, cardAiBuildDeck, cardAiPolicy, CARD_AI_HABITS, cardAiSeededRand };';
  vm.runInContext(src, ctx, { filename: '82-card-battle-core.jsx' });
  return ctx.E;
};

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const levels = opt('--levels', 'expert,master').split(',');
const games = Math.max(2, Number(opt('--games', 40)) || 40);
const jsonOut = opt('--json', null);
const vs = opt('--vs', 'starter');

const E = load();
const db = E.CARD_BATTLE_DATA;
const who = Object.keys(E.CARD_AI_HABITS);
const NAME = { mua: 'みゅあ', momosuke: 'ももすけ', kiki: 'きき', kyuko: 'きゅうこ', dra: 'ドラ', atsu: 'あつ' };
const out = {};
levels.forEach((lv) => {
  const decks = Object.fromEntries(who.map((w) => [w, E.cardAiBuildDeck(db, w, lv)]));
  const win = Object.fromEntries(who.map((w) => [w, 0]));
  const play = Object.fromEntries(who.map((w) => [w, 0]));
  const pair = {};
  let seed = 1;
  if (vs === 'starter') {
    const kits = Object.keys(db.starters);
    who.forEach((w) => {
      kits.forEach((k) => {
        for (let g = 0; g < games; g++) {
          // 助手のデッキは毎試合組み直す(好きなモンスター ベスト4から3体・カードも少しずつ変わる。2026-10-25)。MASTER はプレイヤー役のデッキを見る
          const mine = E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(`${w}:${lv}:${k}:${g}`), { playerDeck: E.cardAiBuildDeck(db, k) });
          // プレイヤー役は山札の上限を見ない(playerRole。2026-10-27 ソランド判断・ドラ EXPERT の測り方をそろえるため。人が相手のときと同じ測り方)
          const st = E.cardSimulate(db, { decks: [mine, E.cardAiBuildDeck(db, k)], policies: [E.cardAiPolicy(w, lv, { sameBlood: !!mine.sameBlood }), E.cardAiPolicy('kyuko', lv, { playerRole: true })], seed: 7000 + seed++, first: g % 2 });
          if (st.winner === 0) win[w] += 1;
          play[w] += 1;
        }
      });
    });
    out[lv] = { rate: Object.fromEntries(who.map((w) => [w, win[w] / play[w]])) };
    const rates = who.map((w) => win[w] / play[w]);
    console.log(`\n${lv.toUpperCase()}(プレイヤー役=スターター3つ×${games}戦)  最も強い〜弱い の差 ${Math.round((Math.max(...rates) - Math.min(...rates)) * 100)} 点`);
    who.forEach((w) => console.log(`  ${NAME[w].padEnd(5, '　')} ${(win[w] / play[w] * 100).toFixed(0).padStart(3)}%`));
    return;
  }
  for (let i = 0; i < who.length; i++) for (let j = i + 1; j < who.length; j++) {
    const a = who[i], b = who[j];
    let aw = 0;
    for (let g = 0; g < games; g++) {
      const st = E.cardSimulate(db, { decks: [decks[a], decks[b]], policies: [E.cardAiPolicy(a, lv, { sameBlood: !!decks[a].sameBlood }), E.cardAiPolicy(b, lv, { sameBlood: !!decks[b].sameBlood })], seed: 9000 + seed++, first: g % 2 });
      if (st.winner === 0) aw += 1;
      play[a] += 1; play[b] += 1;
    }
    win[a] += aw; win[b] += games - aw;
    pair[`${a}-${b}`] = aw / games;
  }
  out[lv] = { rate: Object.fromEntries(who.map((w) => [w, win[w] / play[w]])), pair };
  const rates = who.map((w) => win[w] / play[w]);
  console.log(`\n${lv.toUpperCase()}(1組 ${games} 戦・総当たり)  最も強い〜弱い の差 ${Math.round((Math.max(...rates) - Math.min(...rates)) * 100)} 点`);
  who.forEach((w) => console.log(`  ${NAME[w].padEnd(5, '　')} ${(win[w] / play[w] * 100).toFixed(0).padStart(3)}%`));
});
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ games, levels, result: out }, null, 2));
