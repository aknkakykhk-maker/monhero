#!/usr/bin/env node
// クリスマスのミステリーノベルの見張り(台帳 r1126-022)。
//   1. 生成物(79-xmas-novel-script.jsx)が台本と同じか(xmas-novel-build.js --check と同じ)
//   2. 分かれ道を全部たどる: 行動の選択は全部の選択肢、推理の問いは「一発目で正解」と「まちがえてから正解」の両方、
//      人を選ぶ問いは返しの決まっている人も選ぶ。どの道も止まらずにエンディングへ着くか・どのエンディングにも着けるか
//   3. 保存の正規化: 壊れた値・古い場面IDを入れても落ちず、既定へ戻るか
//   4. 画面の部品に、決まった入口(openXmasNovel・XmasNovelScreen)があるか
// 使い方: node tools/novel/xmas-novel-check.js   (結果は最後の数行だけ見ればよい)
//         node tools/novel/xmas-novel-check.js --sample   仮の台本(SAMPLE.md)の分かれ道をたどる(生成物は見ない)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const P = (f) => path.join(ROOT, 'monster-hero/src/parts', f);
const fails = [];
const fail = (m) => fails.push(m);

const SAMPLE_MODE = process.argv.includes('--sample');
// 1. 生成物
if (!SAMPLE_MODE) try { execFileSync(process.execPath, [path.join(__dirname, 'xmas-novel-build.js'), '--check'], { stdio: 'pipe' }); }
catch (e) { fail(`生成物が台本と違う(node tools/novel/xmas-novel-build.js で作り直す)\n${String(e.stdout || '').split('\n').slice(-4).join('\n')}`); }

// 2. 読み込み(純粋な部品なので、そのまま vm で動かせる)
const ctx = vm.createContext({});
vm.runInContext(`${fs.readFileSync(P('79-xmas-novel-engine.jsx'), 'utf8')}\n${fs.readFileSync(P('79-xmas-novel-script.jsx'), 'utf8')}
this.E = { XMAS_NOVEL_SCRIPT, xmasNovelFreshCur, xmasNovelSettle, xmasNovelStep, xmasNovelAnswer, xmasNovelApplyRow, xmasNovelJump, xmasNovelOptionsOf,
  xmasNovelCtx, xmasNovelPersonChoices, xmasNovelNormalize, xmasNovelScoreGroups, xmasNovelRecordFirst, xmasNovelRecordEnding, xmasNovelPlayableAt, XMAS_NOVEL_GAME };`, ctx);
const E = ctx.E;
const S = SAMPLE_MODE ? require('./xmas-novel-build.js').parseScript(fs.readFileSync(path.join(ROOT, 'docs/progress/xmas-novel/SAMPLE.md'), 'utf8'), 'docs/progress/xmas-novel/SAMPLE.md') : E.XMAS_NOVEL_SCRIPT;
const endingsAll = S.scenes.filter((s) => s.ending).map((s) => s.ending.id);
const reached = new Map();
let paths = 0; let stuck = 0;
const visited = new Set();
const MAX_PATHS = 4000;

// 返しを読んだあと then のとおりに進める(画面の XmasNovelScreen と同じ手順)
const afterAnswer = (res, q) => {
  let cur = res.cur;
  (res.replies || []).forEach((r) => { cur = E.xmasNovelApplyRow(cur, r); });
  if (res.then === 'retry') return { cur, again: true };
  if (res.then && res.then.to) return { cur: E.xmasNovelJump(S, cur, res.then.to), jumped: true };
  return { cur: { ...cur }, next: true, q };
};
const clueNames = (cur) => (cur.clues || []).map((c) => c.n);

const walk = (cur0, depth, log) => {
  if (paths >= MAX_PATHS) return;
  let st = E.xmasNovelSettle(S, cur0);
  for (let steps = 0; steps < 5000; steps += 1) {
    if (!st.row) {
      paths += 1;
      if (st.ending) {
        const e = st.ending.id; reached.set(e, (reached.get(e) || 0) + 1);
        // パネル: バッドエンドの終わりは12人みんな暗い / 真グッド・ノーマルグッドは、きゅうこの「死んだと見せかけ」が外れている
        const pn = st.cur.panel || {};
        if (st.ending.kind === 'bad' && S.src.includes('SCRIPT') && Object.keys(pn).filter((k) => pn[k] === 'dead' || pn[k] === 'santa').length !== 12) fail(`${e}: 終わりのパネルが12人みんな暗くなっていない ${JSON.stringify(pn)}`);
        if ((e === 'END-G' || e === 'END-N') && pn.kyuko) fail(`${e}: きゅうこのパネルが戻っていない(${pn.kyuko})`);
        // あつルートなどの「選び直す」(次: 問いの行)は、選び直したあとも先へ進めるか、1回だけ見る
        if (st.scene.next && !S.scenes.some((x) => x.id === st.scene.next) && depth < 3) walk(E.xmasNovelJump(S, st.cur, st.scene.next), depth + 1, [...log, `${e}→${st.scene.next}`]);
      } else { stuck += 1; if (stuck <= 5) fail(`エンディングに着かずに止まった: ${st.cur.scene} ${log.slice(-6).join(' > ')}`); }
      return;
    }
    const row = st.row;
    visited.add(st.cur.scene);
    if (row.t !== 'q') { st = E.xmasNovelStep(S, E.xmasNovelApplyRow(st.cur, row)); continue; }
    // 問い: 分かれる
    const tries = [];
    if (row.kind === 'action') {
      const opts = E.xmasNovelOptionsOf(row, E.xmasNovelCtx(S, st.cur));
      if (!opts.length) { fail(`${row.id}: 出せる選択肢が1つも無い`); return; }
      opts.forEach((o) => tries.push([o.i]));
    } else {
      const ans = row.answer || [];
      if (row.kind === 'present') {
        const have = clueNames(st.cur);
        if (!ans.some((a) => have.includes(a))) { fail(`${row.id}: 正解の手がかり(${ans.join(' / ')})が、この問いまでに手がかり帳にたまっていない(道: ${log.slice(-4).join(' > ')})`); return; }
        const wrong = have.find((n) => !ans.includes(n));
        // 一発目でフラグが決まる問いだけ分ける(ほかは、まちがえてから正解の1本道。行き先は変わらないので道の数を増やさない)
        if (row.first || !wrong) tries.push([ans.find((a) => have.includes(a))]);
        if (wrong) tries.push([wrong, ans.find((a) => have.includes(a))]);
      } else if (row.once) {
        // やり直しのない推理: 正解・行き先の決まった人・ほかの人・「まだ決めない」を1回ずつ
        const people = E.xmasNovelPersonChoices().map((p) => p.id);
        const keys = new Set([ans[0], ...Object.keys(row.route || {}).filter((k) => k !== '*' && !/^o\d/.test(k)), people.find((p) => !ans.includes(p) && !(row.route || {})[p]), ...(row.extra || []).map((x) => x.key)]);
        keys.forEach((k) => { if (k) tries.push([k]); });
      } else {
        const people = E.xmasNovelPersonChoices().map((p) => p.id);
        tries.push([ans[0]]);
        const special = Object.keys(row.replies || {}).filter((k) => people.includes(k) && !ans.includes(k));
        special.forEach((p) => tries.push([p, ans[0]]));
        const plain = people.find((p) => !ans.includes(p) && !special.includes(p));
        if (plain) tries.push([plain, ans[0]]);
      }
    }
    tries.forEach((seq) => {
      let cur = st.cur;
      for (const pick of seq) {
        const res = E.xmasNovelAnswer(S, cur, row, pick);
        const a = afterAnswer(res, row);
        if (a.again) { cur = a.cur; continue; }
        if (a.jumped) { walk(a.cur, depth, [...log, `${row.id}=${pick}`]); return; }
        walk({ ...a.cur, idx: a.cur.idx + 1 }, depth, [...log, `${row.id}=${pick}`]);
        return;
      }
      fail(`${row.id}: 正解を選んでも先へ進まない`);
    });
    return;
  }
  fail(`行が多すぎて止まらない: ${st.cur.scene}`);
};
walk(E.xmasNovelFreshCur(S), 0, []);
// 着けないエンディングは、台本の「次」の書き損じのことが多いので注意に出す(1つも着けなければ止める)
const unreached = endingsAll.filter((e) => !reached.has(e));
if (!reached.size) fail('どのエンディングにも着かない');
unreached.forEach((e) => fail(`エンディング ${e} に着く道が無い(台本の「次」を確かめる)`));
// 過去編(真グッドのあとに「章から」で読む章・r1126-046): はじめの場面から読むと、章の場面を全部通り、エンディングに着かずに終わるか
S.chapters.filter((c) => c.past).forEach((c) => {
  const first = S.scenes.find((x) => x.chapter === c.id);
  if (!first) { fail(`${c.id}: 過去編の場面が無い`); return; }
  let st = E.xmasNovelSettle(S, { ...E.xmasNovelFreshCur(S), scene: first.id, idx: 0 });
  const seen = new Set();
  for (let n = 0; n < 2000 && st.row; n += 1) {
    seen.add(st.cur.scene); visited.add(st.cur.scene);
    if (st.scene && st.scene.chapter !== c.id) { fail(`${c.id}: 過去編から別の章(${st.scene.id})へ出てしまう`); break; }
    if (st.row.t === 'q') { fail(`${c.id}: 過去編に選択がある(${st.row.id})`); break; }
    st = E.xmasNovelStep(S, st.cur);
  }
  if (st.ending) fail(`${c.id}: 過去編のあとにエンディング(${st.ending.id})へ進んでしまう`);
  const miss = S.scenes.filter((x) => x.chapter === c.id && !seen.has(x.id)).map((x) => x.id);
  if (miss.length) fail(`${c.id}: 過去編で通らない場面 ${miss.join(' ')}`);
  if (S.scenes.some((x) => x.chapter === c.id && !x.jumpOnly)) fail(`${c.id}: 過去編の場面が並びで入れる形になっている(本編から迷いこむ)`);
});
// どの道でも通らない場面(台本の「次」の書き損じのことが多い)。台本係へ知らせる注意で、止めない
const unvisited = S.scenes.filter((s) => !visited.has(s.id) && !(s.rows || []).every((r) => r.t === 'flag')).map((s) => s.id);

// 3. 保存の正規化
const bad = [null, 1, 'x', [], { v: 9, cur: { scene: 'C99-9', idx: -3 }, read: 'no', endings: [1, 'END-G', 'END-G'], first: { Q: { f: 'yes' } }, snaps: { C1: 3, zz: {} }, auto: 7 },
  { cur: { scene: S.scenes[0].id, idx: 2, flags: { f_a: 1, f_b: 'x', bad: 2 }, clues: [{ n: 'a' }, 3], ans: { Q: { t: 'x' } }, panel: { kyuko: 'dead', nobody: 'dead', dra: 'zzz' } } }];
bad.forEach((b, i) => {
  try {
    const n = E.xmasNovelNormalize(b, S);
    if (n.v !== 1 || !Array.isArray(n.read) || !Array.isArray(n.endings) || typeof n.first !== 'object') fail(`正規化 ${i}: 形が崩れた`);
    if (i === 4 && n.cur && n.cur.scene !== 'C99-9') { /* 無い場面IDは null */ }
    if (i === 4 && n.cur) fail('正規化: 台本に無い場面IDの進み具合が残った');
    if (i === 4 && (n.endings.length !== 1 || n.auto !== 0)) fail('正規化: 見たエンディングの重なり・オートの値が直らない');
    if (i === 5 && n.cur && (n.cur.panel.kyuko !== 'dead' || n.cur.panel.nobody || n.cur.panel.dra)) fail('正規化: 壊れたパネルの状態が残った');
    if (i === 5 && (!n.cur || n.cur.flags.f_b !== undefined || n.cur.flags.bad !== undefined || n.cur.clues.length !== 1)) fail('正規化: 壊れたフラグ・手がかりが残った');
  } catch (e) { fail(`正規化 ${i}: 落ちた ${e.message}`); }
});
// エンドヒストリー: はじめて見た日時だけ残る・壊れた日時は捨てる
let eh = E.xmasNovelNormalize({ endAt: { 'END-G': 'x', 'END-B': '2026-12-01T00:00:00Z', bad: '2026-12-01T00:00:00Z' } }, S);
if (eh.endAt['END-G'] || !eh.endAt['END-B'] || eh.endAt.bad) fail('正規化: エンドヒストリーの日時が直らない');
eh = E.xmasNovelRecordEnding(eh, 'END-B', '2026-12-09T00:00:00Z');
if (eh.endAt['END-B'] !== '2026-12-01T00:00:00Z' || eh.endings.length !== 1) fail('エンドヒストリー: 2回目に見た日時で上書きした');
// 遊べる期間(11/30 10:00〜12/31 3:59)
const at = (iso) => E.xmasNovelPlayableAt(Date.parse(iso));
if (at('2026-11-30T09:59:00+09:00') || !at('2026-11-30T10:00:00+09:00') || !at('2026-12-31T03:59:00+09:00') || at('2026-12-31T04:00:00+09:00')) fail('遊べる期間の境目がちがう');
if (!E.XMAS_NOVEL_GAME || !E.XMAS_NOVEL_GAME.series || !E.XMAS_NOVEL_GAME.sub) fail('ゲームの名前(XMAS_NOVEL_GAME)が無い');
// 一発目の記録は、2回目から書き変えない
let sv = E.xmasNovelNormalize(null, S);
sv = E.xmasNovelRecordFirst(sv, 'Qx', false); sv = E.xmasNovelRecordFirst(sv, 'Qx', true);
if (sv.first.Qx.f !== false) fail('一発目の記録が、読み直しで書き変わる');

// 4. 画面の入口
const screen = fs.readFileSync(P('79-screen-xmas-novel.jsx'), 'utf8');
['const openXmasNovel', 'const XmasNovelScreen', 'XMAS_NOVEL_STORAGE_KEY', 'xmasNovelPlayableAt(Date.now())'].forEach((w) => { if (!screen.includes(w)) fail(`画面の部品に ${w} が無い`); });
const parts = JSON.parse(fs.readFileSync(P('parts.json'), 'utf8')).parts.map((p) => p.file);
['79-xmas-novel-engine.jsx', '79-xmas-novel-script.jsx', '79-screen-xmas-novel.jsx'].forEach((f) => { if (!parts.includes(f)) fail(`parts.json に ${f} が無い`); });
if (parts.indexOf('79-screen-xmas-novel.jsx') < parts.indexOf('79-xmas-novel-script.jsx')) fail('parts.json: 画面が台本データより前にある');

const groups = E.xmasNovelScoreGroups(S).length;
console.log(`台本 ${S.src}: 場面 ${S.scenes.length} / 推理の問い(成績のまとまり) ${groups} / たどった道 ${paths}${paths >= MAX_PATHS ? '(上限で打ち切り)' : ''}`);
console.log(`着いたエンディング: ${endingsAll.map((e) => `${e}×${reached.get(e) || 0}`).join(' ')}`);
if (unreached.length) console.log(`注意: 着く道の無いエンディング ${unreached.join(' ')}(台本の「次」を確かめる)`);
if (unvisited.length) console.log(`注意: どの道でも通らない場面 ${unvisited.length} 個(台本の「次」を確かめる): ${unvisited.join(' ')}`);
if (fails.length) { console.log(`NG ${fails.length} 件`); fails.slice(0, 20).forEach((f) => console.log(`  - ${f}`)); process.exit(1); }
console.log('OK: ノベルの台本・分かれ道・保存の正規化');
