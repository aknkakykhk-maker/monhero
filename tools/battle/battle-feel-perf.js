#!/usr/bin/env node
// バトル画面の「重さ」を、カードバトル・タクティクス × 縦持ち・横持ちで、同じ条件(CPU を絞る・オートで流す)で測る。
// 手ごたえの演出(当たりの間・揺れ・数字)を足したり軽くしたりするとき、前後を数字で比べるための道具。
//
//   node tools/battle/battle-feel-perf.js                  … 4場面(card-portrait,card-landscape,tactics-portrait,tactics-landscape)
//   SCENES=card-portrait,tactics-portrait  … 場面を絞る
//   SECONDS=25    … 1場面を何秒流すか
//   THROTTLE=4    … CPU を何分の1にするか(スマホ相当)
//   PROFILE=1     … 計算に時間を使った関数の上位も出す(原因を探すとき)
//   ROOT_DIR=<別のツリー> … 変更前のツリーを同じ条件で測って比べるとき
//   BUDGET_P95=<ms> … 95%点がこれを超えた場面があれば NG にする(既定は判定しない = エラーと「バトルに入れない」だけ NG)
//
// 出すもの(1場面1行):
//   ・コマの間隔の中央値 / 95%点 / 最大、落ちたコマ(50ms超・100ms超)
//   ・同時に出る演出の数(終わりのあるアニメーション)のいちばん多い時と、その中身
//   ・動き続けているアニメーションの数、画面の部品(DOM)の数
//   ・1秒あたりの計算時間の内訳(スクリプト / スタイル計算 / レイアウト)
//   ・落ちたコマのときに動いていた演出の上位(重さの原因の当たりをつける)
// ⚠️ Chromium(GPU なし)の数字。実機の iPhone と同じにはならない。変更の前後を同じ条件で比べるために使う。
// ⚠️ バトルの中身は乱数で変わるので、数コマの差は誤差。95%点と落ちたコマの数を見る。
const path = require('path');
const { openTacticsBattle } = require('./lib/tactics-battle-page');
const { openCardBattle } = require('./lib/card-battle-page');

const ROOT = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.PORT_NO || 8971);
const SECONDS = Number(process.env.SECONDS || 25);
const THROTTLE = Number(process.env.THROTTLE || 4);
const PROFILE = process.env.PROFILE === '1';
const BUDGET_P95 = Number(process.env.BUDGET_P95 || 0);
const ALL = ['card-portrait', 'card-landscape', 'tactics-portrait', 'tactics-landscape'];
const SCENES = (process.env.SCENES || ALL.join(',')).split(',').map((x) => x.trim()).filter((x) => ALL.includes(x));

// ページの中に入れる計測。コマの間隔は毎コマ、演出の数は約200msごとに数える(数える処理そのものを重くしないため)
const installProbe = () => {
  const P = window.__feelPerf = { gaps: [], lt: [], peak: 0, peakNames: {}, infinite: 0, dom: 0, slowNames: {}, samples: 0, finiteSum: 0 };
  let last = performance.now(), lastSample = 0, current = {};
  const nameOf = (a) => a.animationName || (a.transitionProperty ? `transition:${a.transitionProperty}` : 'script');
  const tick = (t) => {
    const gap = t - last; last = t;
    P.gaps.push(gap);
    if (gap >= 50) for (const [n, c] of Object.entries(current)) P.slowNames[n] = (P.slowNames[n] || 0) + c;
    if (t - lastSample >= 200) {
      lastSample = t;
      const names = {}; let finite = 0, infinite = 0;
      for (const a of document.getAnimations()) {
        if (a.playState !== 'running' || !a.effect) continue;
        if (a.effect.getComputedTiming().iterations === Infinity) { infinite += 1; continue; }
        finite += 1; const n = nameOf(a); names[n] = (names[n] || 0) + 1;
      }
      current = names; P.samples += 1; P.finiteSum += finite; P.infinite = Math.max(P.infinite, infinite);
      if (finite > P.peak) { P.peak = finite; P.peakNames = names; }
      P.dom = Math.max(P.dom, document.getElementsByTagName('*').length);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try { new PerformanceObserver((l) => l.getEntries().forEach((e) => P.lt.push(e.duration))).observe({ type: 'longtask' }); } catch { /* 無くても測れる */ }
  // オートで流す(カードバトルは aria-label が AUTO で始まるボタン、タクティクスは字面が「AUTO OFF」)
  const auto = document.querySelector('button[aria-label^="AUTO"]')
    || [...document.querySelectorAll('button')].find((x) => /AUTO/.test(x.textContent) && /OFF/.test(x.textContent));
  if (auto) auto.click();
  return !!auto;
};

const collect = () => {
  const P = window.__feelPerf;
  const g = P.gaps.slice(2).filter((x) => x < 2000).sort((a, b) => a - b);
  const q = (p) => Math.round(g[Math.min(g.length - 1, Math.floor(g.length * p))] || 0);
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k}×${v}`);
  const text = (document.body.innerText || '').replace(/\s+/g, ' ');
  return {
    frames: g.length, p50: q(0.5), p95: q(0.95), max: Math.round(g[g.length - 1] || 0),
    over50: g.filter((x) => x >= 50).length, over100: g.filter((x) => x >= 100).length,
    lt: P.lt.length, ltMs: Math.round(P.lt.reduce((a, b) => a + b, 0)),
    peak: P.peak, peakNames: top(P.peakNames, 5), avgFinite: P.samples ? +(P.finiteSum / P.samples).toFixed(1) : 0,
    infinite: P.infinite, dom: P.dom, slow: top(P.slowNames, 5),
    wave: (text.match(/WAVE\s*(\d+)/) || [])[1] || '?', turn: (text.match(/TURN\s*(\d+)/) || [])[1] || '?',
  };
};

// 計算に時間を使った関数の上位(自分の中で使った時間)。PROFILE=1 のときだけ
const topFunctions = (profile, n) => {
  const dt = profile.timeDeltas || [], self = new Map(), byId = new Map(profile.nodes.map((x) => [x.id, x]));
  profile.samples.forEach((id, i) => {
    const node = byId.get(id); if (!node) return;
    const f = node.callFrame, file = (f.url || '').split('/').pop();
    const key = `${f.functionName || '(名前なし)'} ${file}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) || 0) + (dt[i] || 0));
  });
  // 割合は「スクリプトが動いていた時間」の中での割合(何もしていない時間・ブラウザ内部の時間は分母に入れない)
  const rows = [...self.entries()].filter(([k]) => !/^\((idle|program)\)/.test(k));
  const total = rows.reduce((a, r) => a + r[1], 0) || 1;
  return rows.sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(v / total * 100).toFixed(1)}% ${k}`);
};

// 長い処理(途切れずに50ms以上動いたかたまり)の中だけで、時間を使った関数の上位。コマ落ちの原因はここに出る
const topInLongRuns = (profile, n) => {
  const dt = profile.timeDeltas || [], byId = new Map(profile.nodes.map((x) => [x.id, x])), self = new Map();
  let run = [], runMs = 0, runs = 0, total = 0;
  const flush = () => {
    if (runMs >= 50000) { runs += 1; total += runMs; for (const [k, v] of run) self.set(k, (self.get(k) || 0) + v); }
    run = []; runMs = 0;
  };
  profile.samples.forEach((id, i) => {
    const f = (byId.get(id) || {}).callFrame; if (!f) return;
    if (f.functionName === '(idle)') { flush(); return; }
    const name = f.functionName === '(program)' ? '(ブラウザ内部: スタイル・レイアウト・描画)' : `${f.functionName || '(名前なし)'} ${(f.url || '').split('/').pop().split('?')[0]}:${f.lineNumber + 1}`;
    run.push([name, dt[i] || 0]); runMs += dt[i] || 0;
  });
  flush();
  const rows = [...self.entries()].sort((x, y) => y[1] - x[1]).slice(0, n).map(([k, v]) => `${(v / (total || 1) * 100).toFixed(1)}% ${k}`);
  return { runs, ms: Math.round(total / 1000), rows };
};

const measure = async (scene, index) => {
  const [kind, dir] = scene.split('-');
  const viewport = dir === 'landscape' ? { width: 844, height: 390 } : { width: 390, height: 844 };
  const open = kind === 'card' ? openCardBattle : openTacticsBattle;
  const run = await open({ root: ROOT, port: PORT + index, viewport, storage: kind === 'card' ? {} : { mh_battle_fx_v1: { load: 'RICH', autoLoad: 'OFF' } } });
  if (run.skip) return { scene, skip: run.skip };
  const { page, ctx, errors } = run;
  try {
    if (!run.inBattle) return { scene, fail: 'バトルまで進めなかった' };
    await page.waitForTimeout(1500);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    if (PROFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    const autoOn = await page.evaluate(installProbe);
    const m0 = await metrics(), t0 = Date.now();
    await page.waitForTimeout(SECONDS * 1000);
    const m1 = await metrics(), sec = (Date.now() - t0) / 1000;
    const profile = PROFILE ? (await cdp.send('Profiler.stop')).profile : null;
    const funcs = profile ? topFunctions(profile, 8) : null, longRuns = profile ? topInLongRuns(profile, 10) : null;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const res = await page.evaluate(collect);
    // 絞った CPU での1秒あたりの時間(ms)。getMetrics は絞る前の実時間なので、そのまま足し引きする
    const per = (k) => Math.round((m1[k] - m0[k]) * 1000 / sec);
    return { scene, autoOn, ...res, fps: +(res.frames / sec).toFixed(1), script: per('ScriptDuration'), style: per('RecalcStyleDuration'), layout: per('LayoutDuration'), task: per('TaskDuration'), funcs, longRuns, errors: errors.slice(0, 2) };
  } finally {
    await run.close();
  }
};

(async () => {
  const out = [];
  for (let i = 0; i < SCENES.length; i += 1) {
    try { out.push(await measure(SCENES[i], i)); } catch (e) { out.push({ scene: SCENES[i], fail: String(e.message || e).split('\n')[0].slice(0, 160) }); }
  }
  console.log(`条件: ${SECONDS}秒 / CPU 1/${THROTTLE} / オート${process.env.ROOT_DIR ? ` / ${ROOT}` : ''}`);
  let ng = 0;
  for (const r of out) {
    if (r.skip) { console.log(`SKIP ${r.scene}: ${r.skip}`); continue; }
    if (r.fail) { ng += 1; console.log(`NG ${r.scene}: ${r.fail}`); continue; }
    const over = BUDGET_P95 > 0 && r.p95 > BUDGET_P95;
    if (over || r.errors.length || !r.autoOn) ng += 1;
    console.log(`${r.scene}: 中央値 ${r.p50}ms / 95% ${r.p95}ms / 最大 ${r.max}ms / ${r.fps}fps / 落ち 50ms超 ${r.over50}・100ms超 ${r.over100}(${r.frames}コマ中)${over ? ` ← 予算 ${BUDGET_P95}ms 超え` : ''}`);
    console.log(`  演出: 同時 最大${r.peak}(平均${r.avgFinite}) [${r.peakNames.join(', ')}] / 動き続け ${r.infinite} / 部品 ${r.dom} / 進み W${r.wave} T${r.turn}`);
    console.log(`  計算(1秒あたり): 全体 ${r.task}ms = スクリプト ${r.script} + スタイル ${r.style} + レイアウト ${r.layout} + ほか(描画など) ${Math.max(0, r.task - r.script - r.style - r.layout)} / 長い処理 ${r.lt}回 ${r.ltMs}ms`);
    if (r.slow.length) console.log(`  落ちたコマのとき動いていた演出: ${r.slow.join(', ')}`);
    if (r.funcs) console.log(`  時間を使った関数: ${r.funcs.join(' | ')}`);
    if (r.longRuns) console.log(`  長い処理の中身(${r.longRuns.runs}回 ${r.longRuns.ms}ms): ${r.longRuns.rows.join(' | ')}`);
    if (!r.autoOn) console.log('  NG: オートのボタンが見つからない');
    if (r.errors.length) console.log(`  NG: 実行時エラー ${r.errors.join(' / ')}`);
  }
  console.log('RESULT ' + JSON.stringify(out.map((r) => ({ scene: r.scene, p50: r.p50, p95: r.p95, over50: r.over50, over100: r.over100, peak: r.peak, infinite: r.infinite, task: r.task }))));
  console.log(ng ? `NG: ${ng}場面で問題` : `OK: ${out.filter((r) => !r.skip).length}場面を測った`);
  process.exit(ng ? 1 : 0);
})();
