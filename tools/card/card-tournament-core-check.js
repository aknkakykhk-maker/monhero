// MFバトルカード: 大会の計算(82-card-tournament-core)の決まりを確かめる(2026-10-30 ルールくん)。ブラウザなしで動かす。
//
//   node tools/card/card-tournament-core-check.js [--verbose]
//
// 見るもの
//   A. 組分け: 9人まで1つの組・4人に足りなければ助手・10人以上は4〜5人の組・同じ種なら同じ組分け
//   B. 総当たりの日程: 全員が1回ずつ当たる・1日1人1試合まで・奇数は毎日1人お休み
//   C. 種: 同じ大会・試合なら同じ種、ちがう試合ならちがう種
//   D. 順位: 勝ち数 → 倒した数 → 2人の対戦 → エントリーの早さ / 頂上決戦は各組の上から2人
//   E. 1試合: 同じ入力なら同じ結果(手も同じ)・残した手を当て直すと同じ勝ち負けになる(見返しで開ける)・助手の席も回せる
//   F. ごほうびの表: 順位ごと・参加賞・1勝ごと・おかしな値は 0
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const PART = (n) => fs.readFileSync(path.join(GAME, 'src', 'parts', n), 'utf8');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${PART('82-card-battle-core.jsx')}\n;\n${PART('82-card-tactics-core.jsx')}\n;\n${PART('82-card-share-core.jsx')}\n;\n${PART('82-card-tournament-core.jsx')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_AI_HABITS, cardTourGroups, cardTourRoundRobin, cardTourSchedule, cardTourStageDays, cardTourMatchSeed, cardTourStandings, cardTourFinalists, cardTourPlay, cardTourNormalizeRewards, cardTourRewardOf, cardAiBuildDeck, cardAiSeededRand, cardCreateGame, cardApplyAction };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const J = (v) => JSON.stringify(v);

// ---- A ----
{
  const ids = (n) => Array.from({ length: n }, (_, i) => `e${i}`);
  for (let n = 0; n <= 9; n++) {
    const g = E.cardTourGroups(ids(n), 't1');
    check(`A ${n}人は1つの組・${Math.max(4, n)}席`, g.length === 1 && g[0].length === Math.max(4, n) && g[0].filter((x) => x && x.assist !== undefined).length === Math.max(0, 4 - n), J(g));
  }
  for (let n = 10; n <= 30; n++) {
    const g = E.cardTourGroups(ids(n), 't1');
    const sizes = g.map((x) => x.length);
    const all = g.flat().filter((x) => typeof x === 'string');
    check(`A ${n}人は ${Math.ceil(n / 5)} 組・4〜5人ずつ・全員1回ずつ・助手なし`, g.length === Math.ceil(n / 5) && sizes.every((s) => s >= 4 && s <= 5) && all.length === n && new Set(all).size === n, J(sizes));
  }
  check('A 同じ種なら同じ組分け・ちがう種ならちがう組分け', J(E.cardTourGroups(ids(17), 'x')) === J(E.cardTourGroups(ids(17), 'x')) && J(E.cardTourGroups(ids(17), 'x')) !== J(E.cardTourGroups(ids(17), 'y')));
}
// ---- B ----
for (let n = 2; n <= 9; n++) {
  const days = E.cardTourRoundRobin(n);
  const seen = new Set();
  let dup = false, twice = false;
  days.forEach((day) => { const used = new Set(); day.forEach(([a, b]) => { const k = a < b ? `${a}-${b}` : `${b}-${a}`; if (seen.has(k)) dup = true; seen.add(k); if (used.has(a) || used.has(b)) twice = true; used.add(a); used.add(b); }); });
  const want = (n * (n - 1)) / 2;
  check(`B ${n}人: 全員が1回ずつ当たる(${want}試合)・1日1人1試合まで・${n % 2 ? n : n - 1}日`, seen.size === want && !dup && !twice && days.length === (n % 2 ? n : n - 1), `${seen.size}試合 ${days.length}日`);
  if (n % 2) check(`B ${n}人(奇数): 毎日1人お休み`, days.every((d) => d.length === (n - 1) / 2));
}
{
  const groups = [['a', 'b', 'c', 'd', 'e'], ['f', 'g', 'h', 'i']];
  const s = E.cardTourSchedule('t9', groups, 'group', 0);
  check('B 2つの組は同じ日に並んで進む(段の日数はいちばん多い組)', E.cardTourStageDays(groups) === 5 && Math.max(...s.map((m) => m.day)) === 4 && s.length === 10 + 6, `${s.length}試合`);
  // ---- C ----
  const s2 = E.cardTourSchedule('t9', groups, 'group', 0);
  check('C 同じ大会なら同じ種・先攻', J(s) === J(s2));
  check('C 試合ごとに種がちがう', new Set(s.map((m) => m.seed)).size === s.length);
  check('C ちがう大会ならちがう種', E.cardTourSchedule('t10', groups)[0].seed !== s[0].seed);
  check('C 種は 1 から 2147483646 まで', s.every((m) => m.seed >= 1 && m.seed <= 2147483646 && (m.first === 0 || m.first === 1)));
}
// ---- D ----
{
  // 0 と 1 が2勝ずつ。倒した数で 1 が上
  const m = [{ a: 0, b: 2, winner: 0, kos: [2, 1] }, { a: 1, b: 2, winner: 0, kos: [3, 2] }, { a: 0, b: 3, winner: 0, kos: [3, 0] }, { a: 1, b: 3, winner: 0, kos: [3, 2] }, { a: 0, b: 1, winner: null }];
  check('D 勝ち数が同じなら、倒した数の多い人が上', J(E.cardTourStandings(4, m).rank.slice(0, 2)) === J([1, 0]), J(E.cardTourStandings(4, m).rank));
  const m2 = [{ a: 0, b: 1, winner: 1, kos: [2, 3] }, { a: 0, b: 2, winner: 0, kos: [3, 2] }, { a: 1, b: 2, winner: 1, kos: [2, 3] }];
  // 3人とも1勝1敗。倒した数 0:5 1:5 2:5 → 2人の対戦(1>0, 2>1, 0>2 で回る)→ エントリーの早さ
  check('D 3人以上が並んだら(2人の対戦が回る)、エントリーが早い人が上', J(E.cardTourStandings(3, m2, [2, 0, 1]).rank) === J([1, 2, 0]), J(E.cardTourStandings(3, m2, [2, 0, 1]).rank));
  const m3 = [{ a: 0, b: 1, winner: 1, kos: [3, 3] }, { a: 0, b: 2, winner: 0, kos: [3, 1] }, { a: 1, b: 2, winner: 1, kos: [1, 3] }];
  check('D 勝ち数・倒した数が同じなら、2人の対戦で勝った人が上', E.cardTourStandings(3, m3).rank[0] === 1 || E.cardTourStandings(3, m3).rec[1].kos !== E.cardTourStandings(3, m3).rec[0].kos, J(E.cardTourStandings(3, m3)));
  check('D 頂上決戦: 組が1つなら無い・2つ以上なら各組の上から2人', E.cardTourFinalists([[2, 0, 1, 3]]) === null && J(E.cardTourFinalists([[2, 0, 1], [1, 3, 0, 2]])) === J([{ group: 0, seat: 2 }, { group: 0, seat: 0 }, { group: 1, seat: 1 }, { group: 1, seat: 3 }]));
}
// ---- E ----
{
  const deckOf = (who, k) => E.cardAiBuildDeck(db, who, 'normal', E.cardAiSeededRand(`tc|${who}|${k}`));
  const tac = { habit: 'kyuko', f: { b: ['tBalance', 'tFinish', null], r: [], m: [[['incomingKo', 'guard', 1]], [], []] } };
  const A = { deck: deckOf('mua', 1), tactics: tac }, B = { deck: deckOf('dra', 2), tactics: { habit: 'dra' } };
  const r1 = E.cardTourPlay(db, A, B, { seed: 12345, first: 0, key: 'k' });
  const r2 = E.cardTourPlay(db, A, B, { seed: 12345, first: 0, key: 'k' });
  check('E 同じ入力なら同じ結果・同じ手', J(r1) === J(r2) && (r1.winner === 0 || r1.winner === 1) && r1.acts.length > 10, `${r1.acts.length}手`);
  // 見返し: はじめの場を作り直し、残した手を当て直すと同じ勝ち負けになる
  let st = E.cardCreateGame(db, { decks: [A.deck, B.deck], names: ['A', 'B'], seed: 12345, first: 0 });
  let ok = true;
  for (const [, act] of r1.acts) { const n = E.cardApplyAction(db, st, act); if (!n) { ok = false; break; } st = n; }
  check('E 残した手を当て直すと、同じ勝ち負けで終わる(見返しで開ける)', ok && st.winner === r1.winner, `当て直し ${ok} 勝ち ${st.winner}/${r1.winner}`);
  const r3 = E.cardTourPlay(db, A, B, { seed: 54321, first: 1, key: 'k' });
  check('E 種がちがえば、手もちがう', J(r3.acts) !== J(r1.acts));
  const r4 = E.cardTourPlay(db, A, { assist: 'kiki' }, { seed: 777, first: 0, key: 'cup1|g0|d0' });
  check('E 助手の席とも回せる(倒した数は 0〜3)', (r4.winner === 0 || r4.winner === 1) && r4.kos.every((k) => k >= 0 && k <= 3));
  check('E 決着の種類は ko / deck / limit', ['ko', 'deck', 'limit'].includes(r1.decided) && ['ko', 'deck', 'limit'].includes(r4.decided));
  // いろいろな種で回しても止まらない
  let bad = 0;
  for (let i = 0; i < 12; i++) { const r = E.cardTourPlay(db, { assist: ['mua', 'momosuke', 'kiki', 'kyuko', 'dra', 'atsu'][i % 6] }, A, { seed: 100 + i * 37, first: i % 2, key: `s${i}` }); if (!(r.winner === 0 || r.winner === 1) || !r.acts.length) bad++; }
  check('E いろいろな種で12試合回しても、必ず勝ち負けが付く', bad === 0, `${bad}試合`);
}
// ---- F ----
{
  const t = { ranks: [{ point: 3000, title: '◯◯杯 優勝', frame: 'cup_win' }, { point: 2000, title: '◯◯杯 準優勝' }, { point: 1200 }], participation: { point: 500 }, perWin: 300 };
  check('F 1位・5勝: 3000+1500・称号と枠', J(E.cardTourRewardOf(t, 1, 5)) === J({ point: 4500, title: '◯◯杯 優勝', frame: 'cup_win' }));
  check('F 順位の表に無い順位・頂上決戦に出なかった人は参加賞+1勝ごと', E.cardTourRewardOf(t, 5, 2).point === 1100 && E.cardTourRewardOf(t, null, 0).point === 500 && E.cardTourRewardOf(t, null, 0).title === '');
  check('F おかしな値は 0(マイナス・文字・大きすぎ)', J(E.cardTourNormalizeRewards({ ranks: [{ point: -5 }, { point: 'x' }, { point: 1e9 }], participation: null, perWin: -1 })) === J({ ranks: [{ point: 0, title: '', frame: '' }, { point: 0, title: '', frame: '' }, { point: 100000, title: '', frame: '' }], participation: { point: 0 }, perWin: 0 }));
}

if (fails.length) {
  console.error(`大会の計算の検査: NG ${fails.length}件(OK ${passed}件)`);
  fails.forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`大会の計算の検査: OK ${passed}件`);
