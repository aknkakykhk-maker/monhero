#!/usr/bin/env node
// クリスマスのミステリーノベル: 分岐の地図「聖夜の見取り図」の読み直しの保存(mh_xmas_novel_route_v1・台帳 r1126-102)を確かめる。
//   ① 通しで遊んだ時に問いの行で残す状態と、地図より前の保存(章の頭 snaps・読んだ印 read)から機械で作る状態が、中身まで同じ
//   ② 機械で作るのは1回だけ(seeded の印があれば何もしない)
//   ③ 正規化: 壊れた値・台本に無い場面・問いの行でなくなった物・形の違うキーを捨てる。back も cur と同じ正規化
//   ④ 大きさ: 両方の派で全部通っても 9万字以下(r1126-108 で 6万字から上げた)
//   ⑤ mh_xmas_novel_v1 の正規化(xmasNovelNormalize)は route のキーを持たない(今の保存の形を変えていない)
// 使い方: node tools/novel/xmas-novel-route-check.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const P = (f) => path.join(ROOT, 'monster-hero/src/parts', f);
const ctx = vm.createContext({});
vm.runInContext(`${fs.readFileSync(P('79-xmas-novel-engine.jsx'), 'utf8')}\n${fs.readFileSync(P('79-xmas-novel-script.jsx'), 'utf8')}
this.E = { S: XMAS_NOVEL_SCRIPT, xmasNovelFreshCur, xmasNovelSettle, xmasNovelStep, xmasNovelAnswer, xmasNovelJump, xmasNovelOptionsOf, xmasNovelCtx, xmasNovelApplyRow,
  xmasNovelEndingAhead, xmasNovelNormalize, xmasNovelRouteSeed, xmasNovelRouteRecord, xmasNovelRouteNormalize, XMAS_NOVEL_ROUTE_KEY };`, ctx);
const E = ctx.E;
const S = E.S;
let bad = 0;
const check = (name, ok, detail = '') => { if (!ok) bad += 1; console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); };

// 通しで遊ぶ(安全な方・正解。late なら1回目の推理で「まだ決めない」)。問いの行で route に残し、保存の read・snaps も作る
const play = (side, late, stopAt) => {
  const read = new Set(); const snaps = {};
  let route = E.xmasNovelRouteNormalize(null, S);
  let st = E.xmasNovelSettle(S, E.xmasNovelFreshCur(S));
  let last = null;
  for (let g = 0; st && st.row && g < 8000; g += 1) {
    const r = st.row;
    if (st.scene.chapter !== last) { last = st.scene.chapter; if (/^C\d+$/.test(last) && !snaps[last]) snaps[last] = { ...st.cur, idx: 0, scene: st.scene.id }; }
    if (r.k) read.add(r.k);
    if (r.t !== 'q') { st = E.xmasNovelStep(S, E.xmasNovelApplyRow(st.cur, r)); continue; }
    route = E.xmasNovelRouteRecord(route, S, st.cur);
    if (r.id === stopAt) return { save: { read: [...read], snaps, cur: st.cur, endings: [] }, route };
    const c = E.xmasNovelCtx(S, st.cur, []);
    let pick;
    if (r.kind === 'present') pick = r.answer[0];
    else if (r.kind === 'person') pick = late && r.id === 'Q7a' ? '__undecided' : r.answer[0];
    else {
      const o = E.xmasNovelOptionsOf(r, c);
      pick = r.id === 'A1' ? side : r.once ? (r.answer ? r.answer[0] : o[0].i) : (o.find((x) => !(x.to && E.xmasNovelEndingAhead(S, x.to))) || o[0]).i;
    }
    const a = E.xmasNovelAnswer(S, st.cur, r, pick, []);
    let cc = a.cur; a.replies.forEach((x) => { cc = E.xmasNovelApplyRow(cc, x); });
    st = a.then === 'next' ? E.xmasNovelStep(S, cc) : a.then === 'retry' ? E.xmasNovelSettle(S, cc) : E.xmasNovelSettle(S, E.xmasNovelJump(S, cc, a.then.to));
  }
  return { save: { read: [...read], snaps, cur: null, endings: [] }, route };
};

let total = 0;
[[0, false, 'Q6b'], [0, false, null], [0, true, null], [1, false, null], [1, true, null]].forEach(([side, late, stop]) => {
  const label = `${side ? 'ソラシド派' : 'あつ派'}${late ? '・後半' : ''}${stop ? `・${stop}で止め` : ''}`;
  const { save, route } = play(side, late, stop);
  const seeded = E.xmasNovelRouteSeed(S, save, null);
  // 1回目の推理(やり直しなし)の先(2段目 Q7m)は機械では作らない(1回目の推理から読み直せば着く)
  const want = Object.keys(route.at).filter((k) => !/^Q7m\|/.test(k)).sort();
  const got = Object.keys(seeded.at).sort();
  const same = want.filter((k) => JSON.stringify(route.at[k]) === JSON.stringify(seeded.at[k]));
  check(`① ${label}: 機械で作った分かれ道が、通しの状態と中身まで同じ`, same.length === want.length && got.length === want.length, `通し${want.length} 機械${got.length} 同じ${same.length}`);
  check(`② ${label}: 2回目は何もしない`, E.xmasNovelRouteSeed(S, save, seeded) === seeded && seeded.seeded === 1);
  total = Math.max(total, JSON.stringify(E.xmasNovelRouteNormalize(JSON.parse(JSON.stringify(route)), S)).length);
});
// 両方の派で全部
{
  const a = play(0, true, null).route; const b = play(1, true, null).route; const c = play(0, false, null).route; const d = play(1, false, null).route;
  const all = { v: 1, at: { ...a.at, ...b.at, ...c.at, ...d.at }, back: null, seeded: 1 };
  const n = JSON.stringify(E.xmasNovelRouteNormalize(all, S)).length;
  // 上限は r1126-108(分かれ道を弾ごとに足す)で 6万字 → 9万字。端末の保存(数MB)に対して十分小さい
  check('④ 両方の派で全部通っても 9万字以下', n <= 90000, `${Object.keys(all.at).length}か所 ${n}字`);
}
// ③ 正規化
{
  const { route } = play(0, false, 'Q6b');
  const k = Object.keys(route.at).find((x) => x.startsWith('Q2a|'));
  const broken = { v: 9, seeded: 'x', back: { scene: 'NO-SUCH', idx: 0 }, at: {
    [k]: route.at[k],
    'Q2a|7': route.at[k], // 派の数が範囲外
    'zzz': route.at[k], // 形の違うキー
    'Q3a|1': route.at[k], // 中身が Q3a の行ではない(Q2a の状態)
    'A2|1': { scene: 'NO-SUCH', idx: 3 }, // 台本に無い場面
    'A5|1': 'こわれた',
  } };
  const n = E.xmasNovelRouteNormalize(broken, S);
  check('③ 正規化: 正しい1つだけ残し、壊れた物・別の行の物は捨てる', Object.keys(n.at).join(',') === k, Object.keys(n.at).join(','));
  check('③ 正規化: seeded は 1 以外なら 0、back が壊れていれば null', n.seeded === 0 && n.back === null && n.v === 1);
  const empty = E.xmasNovelRouteNormalize(null, S);
  check('③ 正規化: 保存が無いときは空', JSON.stringify(empty) === JSON.stringify({ v: 1, at: {}, back: null, seeded: 0 }));
}
check('⑤ mh_xmas_novel_v1 の正規化に route の項目は入らない', !('at' in E.xmasNovelNormalize(null, S)) && !('back' in E.xmasNovelNormalize(null, S)));
check('⑤ 新しいキーの名前', E.XMAS_NOVEL_ROUTE_KEY === 'mh_xmas_novel_route_v1');
console.log(bad ? `\n${bad}件のNGがあります` : '\nOK: 分岐の地図の読み直しの保存');
process.exit(bad ? 1 : 0);
