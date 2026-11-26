#!/usr/bin/env node
// クリスマスのミステリーノベル: 決まった道を1本たどって、出る行を順に書き出す(r1126-043 の通し読み用)。
//   道: 第1章 A1 で派を選ぶ → A2・A5・A6 で危ない方(強制バッド3つ)を読んでから、選択の直前に戻って安全な方 →
//       推理の問いは一発で正解 → 1回目の推理できゅうこ+正しい動機 → 真グッド(END-G)
//   画面と同じ手順(xmasNovelSettle / Step / Answer)で進めるので、派の行(a / s)・選択肢の条件もそのまま効く
// 使い方: node tools/novel/xmas-novel-route-trace.js [--out <ディレクトリ>]
//         → <out>/route-atsu.md・route-sorashido.md(顔アイコン付きの一覧)と、最後に行数の要約だけを出す
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const P = (f) => path.join(ROOT, 'monster-hero/src/parts', f);
const outArg = process.argv.indexOf('--out');
const OUT = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : null;

const ctx = vm.createContext({});
vm.runInContext(`${fs.readFileSync(P('79-xmas-novel-engine.jsx'), 'utf8')}\n${fs.readFileSync(P('79-xmas-novel-script.jsx'), 'utf8')}
this.E = { XMAS_NOVEL_SCRIPT, xmasNovelFreshCur, xmasNovelSettle, xmasNovelStep, xmasNovelAnswer, xmasNovelApplyRow, xmasNovelJump, xmasNovelOptionsOf, xmasNovelCtx, xmasNovelCastOf };`, ctx);
const E = ctx.E;
const S = E.XMAS_NOVEL_SCRIPT;

// 顔アイコン(助手はサンタのきせかえの顔の絵・表情ごと。ほかは登場人物の表の顔)
const iconPath = (w, e) => {
  if (!w) return null;
  const c = E.xmasNovelCastOf(w);
  const cands = [`monster-hero/images/assistant/santa/face/${w}_${e || 'normal'}.PNG`, `monster-hero/images/assistant/santa/face/${w}_normal.PNG`];
  if (c && c.face) cands.push(`monster-hero/${c.face}`);
  if (c && c.art) cands.push(`monster-hero/${c.art}`);
  return cands.find((f) => fs.existsSync(path.join(ROOT, f))) || null;
};

const trace = (side) => {
  const lines = [];
  let cur = E.xmasNovelFreshCur(S);
  let st = E.xmasNovelSettle(S, cur);
  const seenBad = new Set();
  let pendingBack = null;
  const push = (r, scene, extra) => lines.push({ id: r.id, scene, t: r.t, w: r.w || null, n: r.n || null, e: r.e || null, x: r.x || '', ...extra });
  for (let steps = 0; steps < 6000; steps += 1) {
    if (!st.row) {
      if (st.ending) {
        lines.push({ t: 'ending', id: st.ending.id, x: st.ending.name || st.ending.id });
        if (/^END-X/.test(st.ending.id) && pendingBack) { st = pendingBack; pendingBack = null; continue; }
      }
      break;
    }
    const row = st.row;
    if (row.t !== 'q') { push(row, st.cur.scene); st = E.xmasNovelStep(S, E.xmasNovelApplyRow(st.cur, row)); continue; }
    let pick;
    if (row.kind === 'action') {
      const opts = E.xmasNovelOptionsOf(row, E.xmasNovelCtx(S, st.cur));
      if (row.id === 'A1') pick = opts[side === 'atsu' ? 0 : 1].i;
      else if (Array.isArray(row.answer) && row.answer.length) pick = row.answer[0];
      else {
        const danger = opts.find((o) => o.to && /-X$/.test(o.to));
        const safe = opts.find((o) => !(o.to && /-X$/.test(o.to)));
        if (danger && !seenBad.has(row.id)) {
          seenBad.add(row.id);
          lines.push({ t: 'choice', id: row.id, x: `${row.x} → 「${danger.x}」(危ない方)` });
          const back = { ...st };
          const res = E.xmasNovelAnswer(S, st.cur, row, danger.i);
          let c = res.cur; (res.replies || []).forEach((r) => { push(r, st.cur.scene); c = E.xmasNovelApplyRow(c, r); });
          st = E.xmasNovelSettle(S, E.xmasNovelJump(S, c, res.then.to));
          pendingBack = back; // 強制バッドのあと、選択の直前へ戻る
          continue;
        }
        pick = safe.i;
        lines.push({ t: 'choice', id: row.id, x: `${row.x} → 「${safe.x}」` });
      }
    } else if (row.kind === 'present') pick = row.answer[0];
    else pick = row.answer[0];
    if (row.kind !== 'action' || row.id === 'A1' || row.answer) lines.push({ t: 'choice', id: row.id, x: `${row.x} → ${String(pick)}` });
    const res = E.xmasNovelAnswer(S, st.cur, row, pick);
    let c = res.cur; (res.replies || []).forEach((r) => { push(r, st.cur.scene); c = E.xmasNovelApplyRow(c, r); });
    if (res.then === 'retry') { st = E.xmasNovelSettle(S, c); continue; }
    if (res.then && res.then.to) st = E.xmasNovelSettle(S, E.xmasNovelJump(S, c, res.then.to));
    else st = E.xmasNovelStep(S, { ...c });
  }
  // 真グッドのあとに開く過去編(r1126-046)も、続けてたどる
  S.chapters.filter((c) => c.past).forEach((c) => {
    const first = S.scenes.find((x) => x.chapter === c.id);
    if (!first) return;
    lines.push({ t: 'choice', id: '', x: `(真グッドのあと「章から」で開く)${c.disp} ${c.title}` });
    let ps = E.xmasNovelSettle(S, { ...E.xmasNovelFreshCur(S), scene: first.id, idx: 0 });
    for (let n = 0; n < 2000 && ps.row; n += 1) { push(ps.row, ps.cur.scene); ps = E.xmasNovelStep(S, ps.cur); }
  });
  return lines;
};

const NAME = { atsu: 'あつ派', sorashido: 'ソラシド派' };
const FACE = { normal: 'ふつう', happy: '笑顔', wink: 'ウインク', surprise: '驚き', troubled: '困り顔', angry: 'むくれ顔', crying: '泣き顔', excited: 'わくわく' };
const result = {};
['atsu', 'sorashido'].forEach((side) => {
  const L = trace(side);
  result[side] = L;
  if (!OUT) return;
  const rel = (f) => path.relative(OUT, path.join(ROOT, f)).split(path.sep).join('/');
  const md = [`# 事件簿 通し読み(${NAME[side]}・A1 → 強制バッド3つ → 真グッド)`, '',
    '`node tools/novel/xmas-novel-route-trace.js --out docs/progress/event-xmas-2026` で作った一覧(手で直さない)。画面と同じ手順で、生成物の台本をたどった順。', '',
    '| 番号 | 顔 | 話し手 | 台詞・帯 |', '| --- | --- | --- | --- |'];
  L.forEach((l) => {
    const ip = iconPath(l.w, l.e);
    const face = ip ? `<img src="${rel(ip)}" width="40">` : '';
    const who = l.t === 'band' ? '帯' : l.t === 'clue' ? '手がかり' : l.t === 'panel' ? '並び' : l.t === 'choice' ? '**選択**' : l.t === 'ending' ? '**エンド**' : `${l.n || ((E.xmasNovelCastOf(l.w) || {}).name) || l.w || ''}${l.e ? `(${FACE[l.e] || l.e})` : ''}`;
    const text = String(l.x || '').replace(/\|/g, '／').replace(/\{name\}/g, '(プレイヤー)');
    md.push(`| ${l.id || ''} | ${face} | ${who} | ${l.t === 'ending' ? `**${text}**` : text} |`);
  });
  fs.writeFileSync(path.join(OUT, `route-${side}.md`), `${md.join('\n')}\n`);
});
const ids = (L) => new Set(L.filter((l) => l.id && l.t !== 'choice' && l.t !== 'ending').map((l) => l.id));
const A = ids(result.atsu); const Sd = ids(result.sorashido);
const ends = (L) => L.filter((l) => l.t === 'ending').map((l) => l.id).join(' → ');
console.log(`あつ派: ${result.atsu.length}行 / エンド ${ends(result.atsu)}`);
console.log(`ソラシド派: ${result.sorashido.length}行 / エンド ${ends(result.sorashido)}`);
console.log(`あつ派だけの行 ${[...A].filter((x) => !Sd.has(x)).length} / ソラシド派だけの行 ${[...Sd].filter((x) => !A.has(x)).length}`);
const ok = ['atsu', 'sorashido'].every((k) => /END-X1.*END-X2.*END-X3.*END-G/.test(ends(result[k])));
if (!ok) { console.log('NG: 強制バッド3つ → 真グッドの順に着かない'); process.exit(1); }
console.log('OK: 両方の派で A1 → 強制バッド3つ → 真グッドが通しで読める');
