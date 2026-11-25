// MFバトルカード: レイドのボスと戦う(クリスマスイベント 2026・台帳 r1119-172)の検査と、数字の表を出す道具
//
//   node tools/card/card-raid-check.js            … 検査だけ(速い)
//   node tools/card/card-raid-check.js --table    … 段階ごとに試しの対戦を回して、与ダメージ・換算の分布を出す(数字の案を作るとき)
//     --games 60 … 1つの組あたりの試合数
//
// 見るもの(検査)
//   ① ボスのデッキが5段階とも決まりどおり(3体・50枚・同じ札3枚まで)で、仮の3体で組めている(代わりのきゅうこの組み方になっていない)
//   ② ライフの倍率が始まりの場に入る(max と life が倍率どおり・こちらの側は変わらない)
//   ③ 与ダメージは「減ったライフの合計」で、削りすぎを数えない・回復で減る
//   ④ 換算の式(1点・倒した数・勝ちの上乗せ・段階の補正)と、投了・負けで勝ちの上乗せが付かないこと
//   ⑤ 試しの対戦が最後まで終わる(止まらない)・換算が 0 以上の整数
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PART = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero', 'src', 'parts', f), 'utf8');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, Date });
vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero', 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${PART('82-card-battle-core.jsx')}\n;\n${PART('82-card-tactics-core.jsx')}\n;\n${PART('82-card-raid-core.jsx')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardDeckProblems, cardDecider, cardOther, cardRngNext, cardOwnTurns,'
  + ' CARD_RAID_BOSS, CARD_RAID_TIERS, CARD_RAID_DAMAGE, cardRaidBossDeck, cardRaidBossPolicy, cardRaidPrepareGame, cardRaidDealt, cardRaidDamage, cardRaidResultOf };', ctx, { filename: '82-card-raid-core.jsx' });
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
let failed = 0, passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) passed++; else { failed++; fails.push(`${name}${detail ? ` — ${detail}` : ''}`); } };

// ① デッキ
E.CARD_RAID_TIERS.forEach((t, i) => {
  const d = E.cardRaidBossDeck(db, i);
  check(`① 段階${i + 1}のデッキが決まりどおり`, E.cardDeckProblems(db, d).length === 0, E.cardDeckProblems(db, d).join('・'));
  check(`① 段階${i + 1}のデッキが仮の3体`, JSON.stringify(d.monsters) === JSON.stringify(E.CARD_RAID_BOSS.monsters), d.monsters.join(','));
  check(`① 段階${i + 1}のデッキは毎回同じ`, JSON.stringify(E.cardRaidBossDeck(db, i)) === JSON.stringify(d));
});

// ②③ 始まりの場とライフ
{
  const me = E.cardAiBuildDeck(db, 'speed');
  const st = E.cardCreateGame(db, { decks: [me, E.cardRaidBossDeck(db, 3)], seed: 3, first: 0 });
  const base = st.players[1].mons.map((m) => m.max);
  const mine = st.players[0].mons.map((m) => m.max);
  E.cardRaidPrepareGame(st, 3, 1);
  const mul = E.CARD_RAID_TIERS[3].life;
  check('② ボスのライフに倍率が入る', st.players[1].mons.every((m, k) => m.max === Math.round(base[k] * mul) && m.life === m.max), st.players[1].mons.map((m) => m.max).join(','));
  check('② こちらのライフは変わらない', st.players[0].mons.every((m, k) => m.max === mine[k]));
  check('② 場にレイドの印', st.raid && st.raid.tier === 3 && st.raid.side === 1);
  check('③ はじめは与ダメージ 0', E.cardRaidDealt(st, 1).dealt === 0);
  st.players[1].mons[0].life = -4; st.players[1].mons[0].ko = true;     // 削りすぎ
  st.players[1].mons[1].life = st.players[1].mons[1].max - 3;
  const r = E.cardRaidDealt(st, 1);
  check('③ 削りすぎを数えない', r.dealt === st.players[1].mons[0].max + 3 && r.kos === 1, JSON.stringify(r));
  st.players[1].mons[1].life += 2;   // 回復
  check('③ 回復されたぶんは引かれる', E.cardRaidDealt(st, 1).dealt === st.players[1].mons[0].max + 1);
}

// ④ 換算の式
{
  const D = E.CARD_RAID_DAMAGE;
  const T = E.CARD_RAID_TIERS;
  check('④ 1点', E.cardRaidDamage({ dealt: 1, kos: 0, outcome: 'lose', tierIndex: 0 }) === Math.floor(D.perPoint * T[0].rate));
  check('④ 倒した数', E.cardRaidDamage({ dealt: 0, kos: 2, outcome: 'lose', tierIndex: 0 }) === Math.floor(2 * D.perKo * T[0].rate));
  check('④ 勝ちの上乗せ', E.cardRaidDamage({ dealt: 10, kos: 3, outcome: 'win', tierIndex: 4 }) === Math.floor((10 * D.perPoint + 3 * D.perKo + D.win) * T[4].rate));
  check('④ 投了は勝ちの上乗せなし', E.cardRaidDamage({ dealt: 10, kos: 1, outcome: 'resign', tierIndex: 2 }) === Math.floor((10 * D.perPoint + D.perKo) * T[2].rate));
  check('④ おかしな値は 0', E.cardRaidDamage({ dealt: -5, kos: -1, outcome: 'win', tierIndex: 0 }) === Math.floor(D.win * T[0].rate) && E.cardRaidDamage({ dealt: NaN }) === 0);
  check('④ 倒した数は3まで', E.cardRaidDamage({ dealt: 0, kos: 9, tierIndex: 0 }) === Math.floor(3 * D.perKo * T[0].rate));
}

// ⑤ 試しの対戦(プレイヤー役: スターター3つと、きゅうこの組み方の強いデッキ。考え方はくせの無い kyuko)
const PLAYERS = [
  { id: 'speed', name: 'スターター(スピード)', deck: () => E.cardAiBuildDeck(db, 'speed'), level: 'normal' },
  { id: 'powerful', name: 'スターター(パワフル)', deck: () => E.cardAiBuildDeck(db, 'powerful'), level: 'normal' },
  { id: 'miracle', name: 'スターター(ミラクル)', deck: () => E.cardAiBuildDeck(db, 'miracle'), level: 'normal' },
  { id: 'strong', name: '組んだデッキ(上手)', deck: () => E.cardAiBuildDeck(db, 'kyuko', 'master'), level: 'master' },
];
const play = (mine, myLevel, tierIndex, seed, first) => {
  let st = E.cardCreateGame(db, { decks: [mine, E.cardRaidBossDeck(db, tierIndex)], seed, first });
  E.cardRaidPrepareGame(st, tierIndex, 1);
  const pol = [E.cardAiPolicy('kyuko', myLevel, { playerRole: true }), E.cardRaidBossPolicy(tierIndex)];
  let s = (seed * 7919) >>> 0;
  const rand = () => { const n = E.cardRngNext(s); s = n.s; return n.v; };
  let steps = 0;
  for (; steps < 4000 && st.winner === null; steps++) {
    const who = st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? E.cardOther(st.first) : E.cardDecider(st);
    const act = E.cardAiChooseAction(db, st, pol[who], rand);
    const next = E.cardApplyAction(db, st, act);
    if (!next) { const fb = st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : st.phase === 'guts' ? { type: 'guts', hand: [] } : null; st = E.cardApplyAction(db, st, fb) || st; if (!fb) break; }
    else st = next;
  }
  const outcome = st.winner === 0 ? 'win' : 'lose';
  return { st, outcome, done: st.winner !== null, turns: E.cardOwnTurns(st, 0), res: E.cardRaidResultOf(st, tierIndex, outcome, 1) };
};
const table = process.argv.includes('--table');
const games = table ? Math.max(4, Number((process.argv[process.argv.indexOf('--games') + 1]) || 60) || 60) : 4;
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const rows = [];
let seed = 9100;
E.CARD_RAID_TIERS.forEach((t, ti) => {
  (table ? PLAYERS : PLAYERS.slice(0, 1)).forEach((pl) => {
    const deck = pl.deck();
    const rs = [];
    for (let g = 0; g < games; g++) {
      const r = play(deck, pl.level, ti, seed++, g % 2);
      check(`⑤ 段階${ti + 1}・${pl.name}の試合が終わる`, r.done);
      check(`⑤ 段階${ti + 1}・換算が 0 以上の整数`, Number.isInteger(r.res.damage) && r.res.damage >= 0, String(r.res.damage));
      rs.push(r);
    }
    if (table) {
      const dmg = rs.map((r) => r.res.damage);
      rows.push({ tier: ti + 1, who: pl.name, win: rs.filter((r) => r.outcome === 'win').length / rs.length, dealt: rs.reduce((a, r) => a + r.res.dealt, 0) / rs.length,
        lifeMax: rs[0].res.lifeMax, kos: rs.reduce((a, r) => a + r.res.kos, 0) / rs.length, turns: rs.reduce((a, r) => a + r.turns, 0) / rs.length,
        mean: dmg.reduce((a, b) => a + b, 0) / dmg.length, p10: pct(dmg, 0.1), p50: pct(dmg, 0.5), p90: pct(dmg, 0.9), max: Math.max(...dmg) });
    }
  });
});
if (table) {
  console.log(`ボス: ${E.CARD_RAID_BOSS.name}(仮)/ 換算: 1点 ${fmt(E.CARD_RAID_DAMAGE.perPoint)}・倒した1体 ${fmt(E.CARD_RAID_DAMAGE.perKo)}・勝ち ${fmt(E.CARD_RAID_DAMAGE.win)} / 1組 ${games} 試合`);
  console.log('| 段階 | 強さ・ライフ倍率・補正 | プレイヤー役 | 勝率 | 与ダメージ(ボスのライフ) | 倒した数 | 自分の番 | 換算の平均 | 下1割 | 中央 | 上1割 | 最大 |');
  console.log('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  rows.forEach((r) => { const t = E.CARD_RAID_TIERS[r.tier - 1];
    console.log(`| ${r.tier} | ${t.level.toUpperCase()}・×${t.life}・×${t.rate} | ${r.who} | ${Math.round(r.win * 100)}% | ${r.dealt.toFixed(1)}(${r.lifeMax}) | ${r.kos.toFixed(1)} | ${r.turns.toFixed(1)} | ${fmt(r.mean)} | ${fmt(r.p10)} | ${fmt(r.p50)} | ${fmt(r.p90)} | ${fmt(r.max)} |`); });
}
if (failed) { console.log(`NG ${failed} 件 / OK ${passed} 件`); fails.slice(0, 15).forEach((f) => console.log(`  ✗ ${f}`)); process.exit(1); }
console.log(`OK: レイドのボスとのカード対戦の検査 ${passed} 件`);
