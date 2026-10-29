// MFバトルカード: 助手ごとの戦い方(2026-10-29 社長「AIの見直しと各助手の特徴をもっと出したい」)。ブラウザなしで 82 を動かす。
//
//   node tools/card/card-ai-style-check.js [--verbose]
//
// 見るもの
//   A. あつ(臨機応変): 場を見て型を選ぶ(とどめ → 全体 → 守り → ゴリ押し)。ほかの助手のくせの値は場で変わらない
//   B. きき(ガッツをためる): 倒れなくても、ライフの半分以上を減らす攻撃なら、払うガッツのある守りを出す(案B)
//   C. 助手どうしの対戦で、ききが「半分以上減る攻撃」を守れるのに見送らない
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_AI_HABITS, cardCreateGame, cardApplyAction, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardAiSeededRand, cardDecider, cardOther, cardRngNext, cardAiFlexMode, cardAiHabitNow, cardGuardOptions, cardAiIncomingDamage, cardAiGuardEstimate };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };

const MOCCHI = Object.values(db.monsters).filter((m) => m.species === 'mocchi' && !m.main && !m.variant).map((m) => m.no)[0];
const scene = () => {
  let st = E.cardCreateGame(db, { decks: [{ monsters: [MOCCHI, 'C-006', 'C-001'], cards: Array(50).fill('100') }, { monsters: ['C-003', 'C-006', 'C-001'], cards: Array(50).fill('100') }], seed: 7, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl) => { pl.guts = Array(10).fill('100'); });
  st.players[0].hand = ['105', '100']; // モッチー砲(6)・もちき(3)
  st.players[1].mons.forEach((m) => { m.max = 20; m.life = 20; }); // 倒せる相手がいない場から始める
  return st;
};

// ---- A ----
{
  let st = scene();
  st.players[1].mons[0].life = 5;
  check('A とどめ: モッチー砲で倒せる相手がいれば とどめ型', E.cardAiFlexMode(db, st, 0) === 'finish', E.cardAiFlexMode(db, st, 0));
  st = scene();
  st.players[0].hand = ['104', '100']; // さくら吹雪(全体)
  check('A 全体: 相手が2体以上で全体攻撃を出せれば 全体型', E.cardAiFlexMode(db, st, 0) === 'area', E.cardAiFlexMode(db, st, 0));
  st = scene();
  st.players[0].mons[1].ko = true; st.players[0].mons[1].life = 0;
  check('A 守り: 倒された数で負けていれば 守り型', E.cardAiFlexMode(db, st, 0) === 'guard', E.cardAiFlexMode(db, st, 0));
  st = scene();
  check('A ゴリ押し: どれにも当たらなければ ゴリ押し型', E.cardAiFlexMode(db, st, 0) === 'attack', E.cardAiFlexMode(db, st, 0));
  const pol = E.cardAiPolicy('atsu', 'master');
  const h = E.cardAiHabitNow(db, st, 0, pol);
  check('A あつは型の向きだけ 1.6 にする', h.attack === 1.6 && h.finish === 1 && h.keepGuard === 1);
  Object.keys(E.CARD_AI_HABITS).filter((w) => w !== 'atsu').forEach((w) => {
    const p = E.cardAiPolicy(w, 'master');
    check(`A ${w} のくせの値は場で変わらない`, E.cardAiHabitNow(db, st, 0, p) === p.habit);
  });
}
// ---- B・C ----
{
  const WHO = Object.keys(E.CARD_AI_HABITS);
  let seen = 0, skipped = 0;
  WHO.filter((w) => w !== 'kiki').forEach((b, i) => {
    for (let g = 0; g < 2; g++) {
      const decks = [E.cardAiBuildDeck(db, 'kiki', 'master', E.cardAiSeededRand(`style:kiki:${b}:${g}`)), E.cardAiBuildDeck(db, b, 'master', E.cardAiSeededRand(`style:${b}:${g}`))];
      const pol = [E.cardAiPolicy('kiki', 'master'), E.cardAiPolicy(b, 'master')];
      pol[0] = { ...pol[0], level: { ...pol[0].level, sloppy: 0 } }; // 強さのそろえの雑さ(守りの出し忘れ)は除いて、考え方だけを見る
      let s = E.cardCreateGame(db, { decks, seed: 700 + i * 5 + g, first: g });
      let r = 19 + i + g;
      const rand = () => { const n = E.cardRngNext(r); r = n.s; return n.v; };
      for (let step = 0; step < 3000 && s.winner === null; step++) {
        const who = s.pendingDiscard ? s.pendingDiscard.p : s.phase === 'setup' ? E.cardOther(s.first) : E.cardDecider(s);
        const act = E.cardAiChooseAction(db, s, pol[who], rand);
        if (who === 0 && s.pending && !s.pendingChoice && !s.pendingDiscard && !s.pendingPray && !s.pendingReveal) {
          const dmg = E.cardAiIncomingDamage(db, s);
          const pd = s.pending; const tg = pd.targets[pd.ti]; const tm = s.players[tg.p].mons[pd.cover != null ? pd.cover : tg.m];
          const half = dmg > 0 && tm.life > dmg && dmg * 2 >= tm.life;
          const good = half && E.cardGuardOptions(db, s).some((o) => { const e = E.cardAiGuardEstimate(db, s, o, dmg); return e.after < dmg; });
          if (good) { seen++; if (act.type === 'pass') skipped++; }
        }
        const n = E.cardApplyAction(db, s, act);
        if (!n) break;
        s = n;
      }
    }
  });
  check('B・C ききは、ライフの半分以上減る攻撃を守れるなら、ほとんど見送らない(1割まで)', seen >= 5 && skipped <= Math.floor(seen * 0.1), `守れる場面 ${seen}・見送り ${skipped}`);
  if (VERBOSE) console.log(`  ききの守れる場面 ${seen}・見送り ${skipped}`);
}

if (fails.length) {
  console.error(`助手の戦い方の検査: NG ${fails.length}件(OK ${passed}件)`);
  fails.forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`助手の戦い方の検査: OK ${passed}件`);
