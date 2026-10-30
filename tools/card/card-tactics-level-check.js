// MFバトルカード: 戦術カードの持ち物・レベル・ガチャ(96-card-tactics.jsx)。ブラウザなしで動かす。
//
//   node tools/card/card-tactics-level-check.js [--verbose]
//
// 見るもの
//   A. カードランク: 次のランクまで 20+3×ランク(ビートランクと同じ式)・上限なし・壊れた経験値は0・
//      強さ別の経験値(ビートと同じ物差し: 勝ち 6/8/10/14/18・マルチ60、負けは3分の1切り上げ)・投了は0・その日はじめての勝ち +30(1日1回)
//   B. 枠: Lv1 基本1・ブリーダー1・各モンスター2 → Lv5・10・15・20・25・30 で開く
//   C. ごほうび: 1つ上がるたびビートP ランク×100、5ランクごとにさらにランク×200+カードパック券1枚。一度に何ランク上がっても全部。二度は配らない・さかのぼらない
//   D. 保存の形: 壊れた値・知らないカードid(残す)・はじめの10枚は持っている扱い・戦いに使う枠は持っていない/開いていない物を外す
//   E. ガチャ: 1回8枚・5回で1,350・はじめの10枚は出ない・だぶりはかけら・天井(SRなし7回→8回目の最後はSR)・カードパック券で引く・かけらで1枚
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
const src = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
vm.runInContext(`${src('src/parts/18-player-rank.jsx')}\n;\n${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n${src('src/parts/82-card-tactics-core.jsx')}\n;\n${src('src/parts/96-card-tactics.jsx')}\n;\n`
  + 'this.E = { CARD_TACTIC_CARDS, CARD_TACTIC_START, cardLevelInfo, cardLevelNeed, cardLevelFrames, cardLevelAfter, cardNormalizeLevel, cardNormalizeTactics, cardTacticsOwns, cardTacticsFramesForBattle, cardTacticsPull, cardTacticsPullOnce, cardTacticsExchange, cardTacticsPrice, cardRankRewardOf };', ctx);
const E = ctx.E;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const J = (x) => JSON.stringify(x);
const xpTo = (lv) => { let c = 0; for (let k = 1; k < lv; k++) c += E.cardLevelNeed(k); return c; };

// ---- A ----
check('A 次のレベルまで 20+3×Lv', E.cardLevelNeed(1) === 23 && E.cardLevelNeed(10) === 50);
check('A 経験値0は Lv1', E.cardLevelInfo(0).level === 1);
check('A ちょうど届けば上がる', E.cardLevelInfo(xpTo(5)).level === 5 && E.cardLevelInfo(xpTo(5) - 1).level === 4);
check('A 上限なし(Lv200 を超える)', E.cardLevelInfo(xpTo(250)).level === 250);
check('A 壊れた経験値は0', ['x', NaN, Infinity, -5, null].every((v) => E.cardLevelInfo(v).level === 1));
{
  const t = '2026-10-30';
  const w = E.cardLevelAfter(null, { kind: 'cpu', level: 'master', outcome: 'win', today: t });
  check('A MASTER の勝ち 18+その日はじめて30', w.add === 48, w.add);
  const w2 = E.cardLevelAfter(w.next, { kind: 'cpu', level: 'easy', outcome: 'win', today: t });
  check('A 同じ日の2勝目は +30 なし(EASY 6)', w2.add === 6, w2.add);
  const w3 = E.cardLevelAfter(w2.next, { kind: 'cpu', level: 'easy', outcome: 'win', today: '2026-10-31' });
  check('A 次の日はまた +30', w3.add === 36, w3.add);
  const lose = (level) => E.cardLevelAfter(null, { kind: 'cpu', level, outcome: 'lose', today: t }).add;
  check('A 負けは勝ちの3分の1(切り上げ)', J(['easy', 'normal', 'hard', 'expert', 'master'].map(lose)) === J([2, 3, 4, 5, 6]), J(['easy', 'normal', 'hard', 'expert', 'master'].map(lose)));
  check('A マルチ(勝ち60 負け20)', E.cardLevelAfter(null, { kind: 'pvp', outcome: 'lose', today: t }).add === 20 && E.cardLevelAfter(w.next, { kind: 'pvp', outcome: 'win', today: t }).add === 60);
  check('A 結果に出す内わけ', J(w.parts) === J([{ label: '勝ち', xp: 18 }, { label: 'その日はじめての勝ち', xp: 30 }]), J(w.parts));
  const s = E.cardLevelAfter(null, { kind: 'cpu', level: 'master', outcome: 'surrender', today: t });
  check('A 投了は0で書かない', s.add === 0 && s.next.xp === 0);
  check('A 負けではその日はじめての勝ちの印をつけない', E.cardLevelAfter(null, { kind: 'cpu', level: 'easy', outcome: 'lose', today: t }).next.dayWin === false);
}

// ---- B ----
{
  const f = (lv) => J(E.cardLevelFrames(lv));
  check('B Lv1 基本1・ブリーダー1・各モンスター2', f(1) === J({ base: 1, breeder: 1, mon: 2 }), f(1));
  check('B Lv5 各モンスター3', E.cardLevelFrames(5).mon === 3 && E.cardLevelFrames(4).mon === 2);
  check('B Lv10 サブ1', E.cardLevelFrames(10).base === 2 && E.cardLevelFrames(9).base === 1);
  check('B Lv15 ブリーダー2・各モンスター4', E.cardLevelFrames(15).breeder === 2 && E.cardLevelFrames(15).mon === 4);
  check('B Lv20 ブリーダー3', E.cardLevelFrames(20).breeder === 3);
  check('B Lv25 各モンスター5・Lv30 サブ2', E.cardLevelFrames(25).mon === 5 && E.cardLevelFrames(29).base === 2 && E.cardLevelFrames(30).base === 3);
}

// ---- C ----
{
  check('C ランク2で ビートP 200・券なし', J(E.cardRankRewardOf(2)) === J({ point: 200, tickets: 0 }), J(E.cardRankRewardOf(2)));
  check('C ランク5で ビートP 500+1,000・券1枚', J(E.cardRankRewardOf(5)) === J({ point: 1500, tickets: 1 }), J(E.cardRankRewardOf(5)));
  check('C ランク50で ビートP 5,000+10,000・券1枚', J(E.cardRankRewardOf(50)) === J({ point: 15000, tickets: 1 }), J(E.cardRankRewardOf(50)));
  const g = E.cardLevelAfter({ xp: E.cardLevelNeed(1) - 1 }, { kind: 'pvp', outcome: 'win', today: 'x' });
  // 22 + 90 = 112 → ランク5(23+26+29+32=110)
  check('C 一度に何ランク上がっても、届いた分を全部配る', g.from === 1 && g.to === 5 && g.points === 200 + 300 + 400 + 1500 && g.tickets === 1 && J(g.next.got) === J([2, 3, 4, 5]), `${g.to} ${g.points} ${g.tickets} ${J(g.next.got)}`);
  check('C もらった物の知らせ', g.gains.some((x) => x.text === 'ビートP 2,400') && g.gains.some((x) => x.text === 'カードパック券 ×1') && g.gains.some((x) => x.text === 'モンスターごとに戦術カードを3枚までセットできるようになった') && !g.gains.some((x) => /置ける所|枠|行/.test(x.text)), J(g.gains));
  const g2 = E.cardLevelAfter(g.next, { kind: 'pvp', outcome: 'lose', today: 'x' });
  check('C 二度は配らない', g2.points === 0 && g2.tickets === 0, `${g2.points} ${g2.tickets}`);
  const old = E.cardLevelAfter({ xp: xpTo(4) - 1, got: [3] }, { kind: 'cpu', level: 'easy', outcome: 'lose', today: 'x' });
  check('C 前に上がったランクはさかのぼらない(以前の引く券の印 3 はそのまま)', old.to === 4 && old.points === 400 && J(old.next.got) === J([3, 4]), `${old.points} ${J(old.next.got)}`);
}

// ---- D ----
{
  const t = E.cardNormalizeTactics({ own: { 'foeLife.20': 2, 'unknown.card': 1, bad: -1, z: 'x' }, frames: { base: ['tBig'] }, shards: -3, tickets: 2.7, pulls: 'x' });
  check('D 知らないカードidは残す・壊れた数は捨てる', t.own['unknown.card'] === 1 && t.own['foeLife.20'] === 2 && !('bad' in t.own) && !('z' in t.own), J(t.own));
  check('D 数は0以上の整数', t.shards === 0 && t.tickets === 2 && t.pulls === 0);
  check('D 壊れた値なら空', J(E.cardNormalizeTactics('x').own) === '{}' && E.cardNormalizeTactics(null).frames.base.length === 3);
  check('D はじめの10枚は持っている扱い', E.CARD_TACTIC_START.every((id) => E.cardTacticsOwns(E.cardNormalizeTactics(null), id)));
  const t2 = E.cardNormalizeTactics({ own: { tBig: 1, tArea: 1 }, frames: { base: ['tBig', 'tArea', 'tGuard'], breeder: [{ c: 'any', a: 'save' }, { c: 'any', a: 'stop' }],
    mons: [[{ c: 'any', a: 'atk' }, { c: 'ko', a: 'atk' }, { c: 'any', a: 'cost.大技(4以上)' }], [{ c: 'foeLife.20', a: 'atk' }], []] } });
  const b1 = E.cardTacticsFramesForBattle(t2, 1);
  check('D Lv1: 基本1・ブリーダー1・各モンスター2 まで', J(b1.base) === J(['tBig', null, null]) && b1.breeder.length === 1 && b1.mons[0].length === 2, J(b1));
  check('D 持っていないカードの行は外す(相手のライフ20%以下)', b1.mons[1].length === 0, J(b1.mons[1]));
  const b30 = E.cardTacticsFramesForBattle(t2, 30);
  check('D Lv30: 持っていない基本カード(守り型)は外す', J(b30.base) === J(['tBig', 'tArea', null]) && b30.mons[0].length === 3, J(b30.base));
}

// ---- E ----
{
  let seed = 7;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const t0 = E.cardNormalizeTactics(null);
  check('E 値段: 1回300・5回1,350', E.cardTacticsPrice(1) === 300 && E.cardTacticsPrice(5) === 1350 && E.cardTacticsPrice(2) === 600);
  check('E ビートPが足りなければ引けない', E.cardTacticsPull(t0, 1, { point: 299 }, rand) === null);
  const one = E.cardTacticsPull(t0, 1, { point: 300 }, rand);
  check('E 1回で8枚', one && one.packs.length === 1 && one.packs[0].length === 8 && one.cost === 300, one && J(one.packs));
  const many = E.cardTacticsPull(t0, 5, { point: 99999 }, rand);
  const all = many.packs.flat();
  check('E はじめの10枚は出ない', all.every((c) => !E.CARD_TACTIC_START.includes(c.id)));
  const dups = all.filter((c) => c.dup).length;
  check('E だぶりはかけら(ビートPに戻さない)', many.next.shards === dups && many.cost === 1350, `${many.next.shards} / ${dups}`);
  // 天井: SR が出ない乱数で7回 → 8回目の最後は SR
  const noSr = () => 0.1;
  let t = t0;
  for (let i = 0; i < 7; i++) t = E.cardTacticsPullOnce(t, noSr).next;
  check('E 7回 SR なし', t.dry === 7, t.dry);
  const p8 = E.cardTacticsPullOnce(t, noSr);
  check('E 8回目の最後の1枚は SR・数え直し', p8.cards[7].r === 'SR' && p8.cards.slice(0, 7).every((c) => c.r !== 'SR') && p8.next.dry === 0, J(p8.cards.map((c) => c.r)));
  const tk = E.cardTacticsPull({ ...t0, tickets: 2 }, 2, { payWith: 'ticket' }, rand);
  check('E カードパック券で引く(1枚=1回8枚・ビートPは使わない)', tk && tk.next.tickets === 0 && tk.cost === 0 && tk.packs.length === 2);
  check('E カードパック券が足りなければ引けない', E.cardTacticsPull({ ...t0, tickets: 1 }, 2, { payWith: 'ticket' }, rand) === null);
  const ex = E.cardTacticsExchange({ ...t0, shards: 10 }, 'tFlex');
  check('E かけら10個でまだ無いカードを1枚', ex && ex.own.tFlex === 1 && ex.shards === 0);
  check('E 持っているカード・かけら不足はえらべない', E.cardTacticsExchange({ ...t0, shards: 10 }, 'tBalance') === null && E.cardTacticsExchange({ ...t0, shards: 9 }, 'tFlex') === null);
}

console.log(`card-tactics-level-check: ${passed} OK / ${fails.length} NG`);
if (fails.length) { fails.forEach((f) => console.log(`NG: ${f}`)); process.exit(1); }
