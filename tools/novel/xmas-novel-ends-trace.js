#!/usr/bin/env node
// クリスマスのミステリーノベル: r1126-062 で足したエンド(名指し5つ・強制バッド X4/X5・おまけ)を、両方の派でたどる。
//   画面と同じ手順(xmasNovelSettle / Step / Answer)で、決めた選び方の道を1本ずつ進め、
//   分かれ目の選択からエンドまでに出る行を書き出す(行ID・話し手・台詞)。最後にパネルの状態も確かめる
//   ほかの問いは一発で正解。行動の選択は安全な方(道で決めた所だけ危ない方)
// 使い方: node tools/novel/xmas-novel-ends-trace.js [--out <ディレクトリ>]
//         → <out>/route-ends-atsu.md・route-ends-sorashido.md と、最後に OK / NG の要約だけを出す
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
const isDanger = (o) => !!(o.to && /-[XY]$/.test(o.to));

// 道: { name, want(着くはずのエンド), from(書き出しを始める問い), picks: {問いID: 選ぶ物}, seen(見たエンディング) , panel(終わりのパネルの確かめ) }
//   picks の値: 'danger' … 危ない方 / 'opt:2' … 選択肢の番号 / 'P' 'Q' … 主役・相手 / ほかは人のID
const ROUTES = [
  { name: '予告の手紙のあと、一人で部屋に残る', want: 'END-X4', from: 'A2b', picks: { A2b: 'danger' } },
  { name: '後半、一人で屋根裏の声を確かめる', want: 'END-X5', from: 'A10', picks: { Q7a: 'miyu', A10: 'danger' } },
  { name: 'ももすけを名指し', want: 'END-M1', from: 'Q7a', picks: { Q7a: 'momosuke' }, panel: { momosuke: 'missing' } },
  { name: 'もちまるを名指し', want: 'END-M2', from: 'Q7a', picks: { Q7a: 'mochimaru' }, panel: { mochimaru: 'dead' } },
  { name: '黒羽を名指し', want: 'END-M3', from: 'Q7a', picks: { Q7a: 'kuroba' }, panel: { erubin: 'missing' } },
  { name: '白瀬を名指し', want: 'END-M3', from: 'Q7a', picks: { Q7a: 'shirase' }, panel: { erubin: 'missing' }, short: true },
  { name: '主役を名指し', want: 'END-M4', from: 'Q7a', picks: { Q7a: 'P' }, panel: { erubin: 'dead', momosuke: 'dead', mochimaru: 'dead' } },
  { name: '相手(主役でない方)を名指し', want: 'END-M5', from: 'Q7a', picks: { Q7a: 'Q' }, panel: { Q: 'dead' } },
  { name: '真グッドのあと、A1 で「推理はお休み」', want: 'END-O', from: 'A1', picks: { A1: 'opt:2' }, seen: ['END-G'] },
  // r1126-077 眠りのドラ: ソラシド派の第7章 A7 で②(ワトソンくんの奥の手)。あつ派には A7 が出ない(noQ で確かめる)
  { name: '第7章 A7 で「ワトソンくんの奥の手」', want: 'END-O2', from: 'A7', picks: { A7: 'opt:1' }, only: 'sorashido' },
  { name: '第7章 A7 は出ない(あつ派)', want: 'END-M4', from: 'Q7a', picks: { Q7a: 'P' }, only: 'atsu', noQ: 'A7', short: true },
];

const run = (side, route) => {
  const P1 = side === 'atsu' ? 'atsu' : 'sorashido';
  const Q1 = side === 'atsu' ? 'sorashido' : 'atsu';
  const who = (v) => (v === 'P' ? P1 : v === 'Q' ? Q1 : v);
  const seen = route.seen || [];
  const lines = [];
  const asked = [];
  let rec = false;
  let st = E.xmasNovelSettle(S, E.xmasNovelFreshCur(S));
  const push = (r, scene) => { if (rec) lines.push({ id: r.id, scene, t: r.t, w: r.w || null, n: r.n || null, e: r.e || null, x: r.x || '' }); };
  for (let steps = 0; steps < 8000; steps += 1) {
    if (!st.row) {
      if (st.ending) lines.push({ t: 'ending', id: st.ending.id, x: st.ending.name || st.ending.id });
      return { lines, asked, end: st.ending ? st.ending.id : null, panel: (st.cur && st.cur.panel) || {} };
    }
    const row = st.row;
    if (row.t !== 'q') { push(row, st.cur.scene); st = E.xmasNovelStep(S, E.xmasNovelApplyRow(st.cur, row)); continue; }
    asked.push(row.id);
    if (row.id === route.from) rec = true;
    const want = route.picks[row.id];
    let pick;
    let label = '';
    if (row.kind === 'action') {
      const opts = E.xmasNovelOptionsOf(row, E.xmasNovelCtx(S, st.cur, seen));
      let o;
      if (want && /^opt:\d+$/.test(want)) o = opts.find((x) => x.i === Number(want.slice(4)));
      else if (row.id === 'A1') o = opts[side === 'atsu' ? 0 : 1];
      else if (Array.isArray(row.answer) && row.answer.length) o = opts.find((x) => x.i === row.answer[0]);
      else if (want === 'danger') o = opts.find(isDanger);
      else o = opts.find((x) => !isDanger(x));
      if (!o) return { lines, end: null, err: `${row.id}: 選ぶ選択肢が無い` };
      pick = o.i; label = o.x;
    } else if (row.kind === 'person' && want) { pick = who(want); label = pick; }
    else { pick = row.answer[0]; label = String(pick); }
    if (rec) lines.push({ t: 'choice', id: row.id, x: `${row.x} → 「${label}」` });
    const res = E.xmasNovelAnswer(S, st.cur, row, pick, seen);
    let c = res.cur; (res.replies || []).forEach((r) => { push(r, st.cur.scene); c = E.xmasNovelApplyRow(c, r); });
    if (res.then === 'retry') { st = E.xmasNovelSettle(S, c); continue; }
    if (res.then && res.then.to) st = E.xmasNovelSettle(S, E.xmasNovelJump(S, c, res.then.to));
    else st = E.xmasNovelStep(S, { ...c });
  }
  return { lines, end: null, err: '長すぎて止めた' };
};

const NAME = { atsu: 'あつ派', sorashido: 'ソラシド派' };
const FACE = { normal: 'ふつう', happy: '笑顔', wink: 'ウインク', surprise: '驚き', troubled: '困り顔', angry: 'むくれ顔', crying: '泣き顔', excited: 'わくわく', sleep: '寝顔' };
const ng = [];
const summary = [];
['atsu', 'sorashido'].forEach((side) => {
  const md = [`# 事件簿 足したエンドの通し読み(${NAME[side]}・r1126-062)`, '',
    '`node tools/novel/xmas-novel-ends-trace.js --out docs/progress/event-xmas-2026` で作った一覧(手で直さない)。画面と同じ手順で、生成物の台本をたどった順。分かれ目の選択からエンドまで。', ''];
  ROUTES.forEach((r) => {
    if (r.only && r.only !== side) return;
    const res = run(side, r);
    const pq = { P: side === 'atsu' ? 'atsu' : 'sorashido', Q: side === 'atsu' ? 'sorashido' : 'atsu' };
    const bad = [];
    if (res.err) bad.push(res.err);
    if (r.noQ && (res.asked || []).includes(r.noQ)) bad.push(`${r.noQ} が出た(出ないはず)`);
    if (res.end !== r.want) bad.push(`着いたのは ${res.end || '(なし)'}(${r.want} のはず)`);
    Object.entries(r.panel || {}).forEach(([k, v]) => { const id = pq[k] || k; if ((res.panel || {})[id] !== v) bad.push(`パネル ${id} が ${(res.panel || {})[id] || 'ふつう'}(${v} のはず)`); });
    // 派の行: 相手の派の行(末尾 a / s)が混ざっていないか
    const other = side === 'atsu' ? /\d s$/ : /\d a$/;
    res.lines.filter((l) => l.id && l.t !== 'choice' && l.t !== 'ending' && other.test(l.id.replace(/(\d)([as])$/, '$1 $2'))).forEach((l) => bad.push(`ほかの派の行 ${l.id} が出た`));
    bad.forEach((b) => ng.push(`${NAME[side]} ${r.name}: ${b}`));
    summary.push(`${NAME[side]} ${r.name} → ${res.end || '-'} ${bad.length ? 'NG' : 'OK'}`);
    if (r.short) return;
    md.push(`## ${r.name} → ${r.want}`, '', '| 番号 | 話し手 | 台詞・帯 |', '| --- | --- | --- |');
    res.lines.forEach((l) => {
      const w = l.t === 'band' ? '帯' : l.t === 'clue' ? '手がかり' : l.t === 'panel' ? '並び' : l.t === 'choice' ? '**選択**' : l.t === 'ending' ? '**エンド**' : `${l.n || ((E.xmasNovelCastOf(l.w) || {}).name) || l.w || ''}${l.e ? `(${FACE[l.e] || l.e})` : ''}`;
      const text = String(l.x || '').replace(/\|/g, '／').replace(/\{name\}/g, '(プレイヤー)');
      md.push(`| ${l.id || ''} | ${w} | ${l.t === 'ending' ? `**${text}**` : text} |`);
    });
    md.push('');
  });
  if (OUT) fs.writeFileSync(path.join(OUT, `route-ends-${side}.md`), `${md.join('\n')}\n`);
});
summary.forEach((s) => console.log(s));
if (ng.length) { console.log(`NG ${ng.length} 件`); ng.slice(0, 20).forEach((s) => console.log(`  - ${s}`)); process.exit(1); }
console.log('OK: 足したエンドは両方の派で全部通しで読める');
