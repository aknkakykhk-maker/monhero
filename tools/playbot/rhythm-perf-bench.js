#!/usr/bin/env node
// モンヒロビートの「本当の重さ」を、社長の端末に頼らず機械で測る(2026-10-11・社長「botで本当の重さ、軽さを測れる仕組みを作って」)。
// ボットに曲を最後まで演奏させ、曲 × CPU の絞り × 描き方(× 版)の表を出す。何度回しても同じ条件で測る(毎回ブラウザを新しく開く)。
//
// 使い方(先に node tools/build.js を通しておく):
//   node tools/playbot/rhythm-perf-bench.js                                   既定の4曲 × CPU 1/4/6倍 × 描き方 2通り(今の 2D / GPU)
//   node tools/playbot/rhythm-perf-bench.js --songs sheriruth:MASTER --cpu 1,4 --draw canvas,gpu
//   node tools/playbot/rhythm-perf-bench.js --roots main=../main,new=.        版どうしを比べる(前の版を git worktree に置く)
//   node tools/playbot/rhythm-perf-bench.js --songs sheriruth_hell_debug:HELL:proto --roots hell=<HELL のブランチの worktree>
//   --from 104000 --to 112000   曲の一部だけ(既定は最初のノーツの1.5秒前から最後のノーツまで)
//   --repeat 2                  同じ条件を何回測るか(表は中央の値。揺れの幅も出す)
//   --out <ファイル.md>          表を書き出す(同じ名前の .json に生の数字)
//   --landscape 0               縦画面(390x844)。既定は横(844x390)
//
// 曲の書き方: <songId>:<難易度>[:<入り口>]。入り口は select(曲えらび。公開中の曲)・debug(音ゲーデバッグの曲の一覧)・proto(試作の枠)。
// 描き方: canvas(今の 2D)・webgl(WebGL の描き込み先。帯は CPU で刻む)・gpu(WebGL+帯と区切りの線を GPU に置く)・auto(ゲームの自動)。
//
// 見かた(docs/perf/RHYTHM_PERF_BENCH.md):
//   ・この入れ物の Chromium には本物の GPU が無く、GPU の仕事は SwiftShader(CPU で GPU を真似る)がする。表の「GPU」の列にどちらだったかを出す。
//     SwiftShader では GPU の仕事も CPU の時間になるので、1コマの時間は「GPU の描き方」に不利に出る。メインスレッドの時間(1コマあたり)は
//     本物の GPU でもほぼ同じなので、端末の重さの比べはこちらを主に見る
//   ・CPU の絞り(4倍・6倍)はメインスレッドだけに効く(GPU の仕事は絞られない)。何倍が社長の iPhone 相当かは、
//     演奏画面が送るタッチの診断に足すフレームの統計と、同じ曲の数字を突き合わせて決める(案は docs/perf/RHYTHM_PERF_BENCH.md)
//   ・本物の Supabase へは1件も送らない(偽の Supabase)
const path = require('path'), fs = require('fs');
const { runOnce } = require('./lib/rhythm-perf-run.js');
const ROOT_DEFAULT = path.resolve(__dirname, '../..');
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback; };
const SONGS = String(arg('songs', 'sheriruth:MASTER:debug,freedom_dive:MASTER:debug,journey:MASTER:debug,anima:MASTER:debug')).split(',').filter(Boolean).map(x => { const [song, diff = 'MASTER', entry = 'debug'] = x.split(':'); return { song, diff, entry }; });
const CPUS = String(arg('cpu', '1,4,6')).split(',').map(Number).filter(x => x >= 1);
const DRAWS = String(arg('draw', 'canvas,gpu')).split(',').filter(Boolean);
const ROOTS = String(arg('roots', `この版=${ROOT_DEFAULT}`)).split(',').map(x => { const i = x.indexOf('='); return i > 0 ? { label: x.slice(0, i), root: path.resolve(x.slice(i + 1)) } : { label: path.basename(path.resolve(x)), root: path.resolve(x) }; });
const REPEAT = Math.max(1, Number(arg('repeat', 1)) || 1);
const FROM = arg('from') != null ? Number(arg('from')) : undefined, TO = arg('to') != null ? Number(arg('to')) : undefined;
const LAND = arg('landscape', '1') !== '0';
const OUT = arg('out');
const DRAW_NAME = { canvas: '今の2D', webgl: 'WebGL(帯はCPU)', gpu: 'GPUの帯', auto: '自動' };
const f1 = (x) => Number.isFinite(x) ? x.toFixed(1) : '-';
const median = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN; };
const spread = (a) => { const s = a.filter(Number.isFinite); return s.length > 1 ? Math.max(...s) - Math.min(...s) : 0; };

(async () => {
  const all = [];
  const total = SONGS.length * ROOTS.length * DRAWS.length * CPUS.length * REPEAT;
  let n = 0;
  const startedAt = Date.now();
  for (const s of SONGS) for (const r of ROOTS) for (const draw of DRAWS) for (const cpu of CPUS) {
    const runs = [];
    for (let k = 0; k < REPEAT; k++) {
      n++;
      process.stdout.write(`  [${n}/${total}] ${r.label} ${s.song} ${s.diff} ${DRAW_NAME[draw] || draw} CPU${cpu}倍 … `);
      try {
        const x = await runOnce({ root: r.root, song: s.song, diff: s.diff, entry: s.entry, draw, cpu, landscape: LAND, from: FROM, to: TO });
        runs.push(x);
        console.log(`1コマ 平均${f1(x.frames.avg)}ms・メインのCPU ${f1(x.main.cpu)}ms/コマ(待ちを含む ${f1(x.main.wall)})(${Math.round(x.wallSec)}秒)`);
      } catch (e) { console.log(`失敗: ${String(e && e.message || e).slice(0, 160)}`); }
    }
    if (runs.length) all.push({ label: r.label, ...s, draw, cpu, runs });
  }
  // 表(曲ごと)
  const lines = [];
  lines.push(`# モンヒロビートの重さ(ボットが演奏・${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC)`, '');
  const first = all[0]?.runs[0];
  if (first) lines.push(`画面 ${first.size}・GPU: ${first.renderer}・各条件 ${REPEAT}回(表は中央の値、± は回ごとの揺れの幅)`, '');
  lines.push('列: 1コマの時間(平均/95%/99%/最長 ms)・16.7ms超と33.3ms超のコマの割合・メインスレッドの仕事(1コマあたり ms。CPU を使った時間/GPU などの待ちを含む時間/うちJS。ボットの分を含む)・' +
    '押してから判定の処理が終わるまで(平均/95%)・次のコマまで(95%)・最初のタップ(処理/次のコマまで)・MISS', '');
  for (const s of SONGS) {
    const rows = all.filter(x => x.song === s.song && x.diff === s.diff);
    if (!rows.length) continue;
    const first5Lines = [];
    lines.push(`## ${s.song} ${s.diff}`, '');
    lines.push('| 版 | 描き方 | CPU | 1コマ 平均 | 95% | 99% | 最長 | 16.7超 | 33.3超 | メインのCPU | 待ちを含む | うちJS | 押して処理 平均/95% | 次のコマまで 95% | 最初のタップ | MISS |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const x of rows) {
      const R = x.runs, g = (fn) => median(R.map(fn)), w = (fn) => REPEAT > 1 ? `±${f1(spread(R.map(fn)))}` : '';
      const pctOf = (fn) => `${f1(g(r => fn(r) / Math.max(1, r.frames.n) * 100))}%`;
      const ft = R[0].taps.first;
      lines.push(`| ${x.label} | ${DRAW_NAME[x.draw] || x.draw}${R[0].band ? '' : (x.draw === 'gpu' ? '(帯がGPUにならなかった)' : '')} | ${x.cpu}倍 | ${f1(g(r => r.frames.avg))}${w(r => r.frames.avg)} | ${f1(g(r => r.frames.p95))} | ${f1(g(r => r.frames.p99))} | ${f1(g(r => r.frames.max))} | ` +
        `${pctOf(r => r.frames.over16)} | ${pctOf(r => r.frames.over33)} | ${f1(g(r => r.main.cpu))}${w(r => r.main.cpu)} | ${f1(g(r => r.main.wall))} | ${f1(g(r => r.main.script))} | ` +
        `${f1(g(r => r.taps.handleAvg))}/${f1(g(r => r.taps.handleP95))} | ${f1(g(r => r.taps.frameP95))} | ${ft ? `${f1(ft.handle)}/${f1(ft.toFrame)}` : '-'} | ${g(r => r.miss)}/${R[0].notes} |`);
      const f5 = R[0].taps.first5;
      if (f5 && f5.length) first5Lines.push(`| ${x.label} | ${DRAW_NAME[x.draw] || x.draw} | ${x.cpu}倍 | ${f5.map(t => `${f1(t.handle)}/${t.toFrame == null ? '-' : f1(t.toFrame)}`).join(' ・ ')} | ${f1(R[0].taps.restHandleMed)}/${f1(R[0].taps.restFrameMed)} |`);
    }
    if (first5Lines.length) lines.push('', '最初の5打(処理/画面に出るまで ms)と、6打目からの中央の値:', '', '| 版 | 描き方 | CPU | 1〜5打目 | 6打目から(中央) |', '| --- | --- | --- | --- | --- |', ...first5Lines);
    lines.push('');
  }
  const errs = all.flatMap(x => x.runs.flatMap(r => r.errors));
  if (errs.length) lines.push(`ページのエラー: ${[...new Set(errs)].slice(0, 5).join(' | ')}`, '');
  lines.push(`かかった時間: ${Math.round((Date.now() - startedAt) / 60000)}分`);
  const md = lines.join('\n');
  console.log('\n' + md);
  if (OUT) { fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true }); fs.writeFileSync(OUT, md + '\n'); fs.writeFileSync(OUT.replace(/\.md$/, '') + '.json', JSON.stringify(all, null, 1)); console.log(`\n書き出しました: ${OUT}`); }
})().catch((e) => { console.error(e); process.exit(1); });
