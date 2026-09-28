#!/usr/bin/env node
const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクス新画面でオートバトルを流し、そのあいだのコマの詰まり・重さを報告する(判定はしない。数字を出すだけ)。
// モンヒロビートの tools/mode/rhythm-live-frame-report.js のバトル版。
//
//   node tools/battle/battle-live-frame-report.js
//   SECONDS=60   … 何秒流すか
//   THROTTLE=4   … CPU を何分の1にするか(スマホ相当にする)
//   LOAD=RICH    … 画面の軽さ(RICH / STANDARD / LIGHT / MINIMAL)
//   AUTO_LOAD=OFF … 「重いときは自動で軽く」を切って測る(軽さを固定して比べるとき)
//   ROOT_DIR=<別のツリー> … 変更前のツリーを同じ条件で測って比べるとき
//
// 出すもの:
//   ・コマの間隔(中央値・95%・最大)と、50ms / 100ms を超えたコマの数
//   ・長い処理(50ms以上)の回数と合計
//   ・ブラウザ本体が計算に使った時間の割合(発熱の目安)
//   ・動き続けているアニメーションの数(はじめ・終わり)
//   ・画面の軽さの移り変わり(自動で下がったか)
// ⚠️ Chromium(GPU なし)の数字なので、実機の iPhone と同じにはならない。変更の前後を同じ条件で比べるために使う。
const path = require('path');
const { openTacticsBattle } = require('./lib/tactics-battle-page');

const ROOT = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : path.resolve(TOOLS_DIR, '..');
const PORT = Number(process.env.PORT_NO || 8985);
const SECONDS = Number(process.env.SECONDS || 60);
const THROTTLE = Number(process.env.THROTTLE || 4);
const LOAD = process.env.LOAD || 'RICH';

(async () => {
  const fx = { load: LOAD, autoLoad: process.env.AUTO_LOAD === 'OFF' ? 'OFF' : 'ON' };
  const run = await openTacticsBattle({ root: ROOT, port: PORT, storage: { mh_battle_fx_v1: fx } });
  if (run.skip) { console.log(`SKIP: ${run.skip}`); process.exit(0); }
  const { page, ctx, errors } = run;
  try {
    if (!run.inBattle) { console.log('NG: バトルまで進めなかった'); process.exitCode = 1; return; }
    await page.waitForTimeout(2000);
    const infinite = () => page.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).length);
    const inf0 = await infinite();
    const bcdp = await ctx.browser().newBrowserCDPSession();
    const cpu = async () => { const r = await bcdp.send('SystemInfo.getProcessInfo'); return r.processInfo.filter((p) => p.type === 'renderer').reduce((a, p) => a + p.cpuTime, 0); };
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    await page.evaluate(() => {
      window.__gaps = []; window.__lt = []; window.__levels = [];
      const root = () => document.querySelector('[data-tactics-look]');
      let last = performance.now(), lastLevel = null;
      const tick = (t) => {
        window.__gaps.push(t - last); last = t;
        const lv = root()?.getAttribute('data-fx-level') || null;
        if (lv !== lastLevel) { window.__levels.push(`${(t / 1000).toFixed(1)}s:${lv}`); lastLevel = lv; }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: 'longtask' });
      // オートバトルを入れる(ボタンの字面は「AUTO OFF」)
      const b = [...document.querySelectorAll('button')].find((x) => /AUTO/.test(x.textContent) && /OFF/.test(x.textContent));
      if (b) b.click();
    });
    const c0 = await cpu();
    const t0 = Date.now();
    await page.waitForTimeout(SECONDS * 1000);
    const cpuPct = (await cpu() - c0) / ((Date.now() - t0) / 1000) * 100;
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const res = await page.evaluate(() => {
      const g = window.__gaps.slice(2).filter((x) => x < 1000).sort((a, b) => a - b);
      const q = (p) => Math.round(g[Math.min(g.length - 1, Math.floor(g.length * p))] || 0);
      return { frames: g.length, p50: q(0.5), p95: q(0.95), max: Math.round(g[g.length - 1] || 0),
        over50: g.filter((x) => x >= 50).length, over100: g.filter((x) => x >= 100).length,
        lt: window.__lt.length, ltMs: Math.round(window.__lt.reduce((a, b) => a + b, 0)), levels: window.__levels,
        wave: (document.body.innerText.match(/WAVE\s*(\d+)\/10/) || [])[1] || '?' };
    });
    const inf1 = await infinite();
    console.log(`条件: ${SECONDS}秒 / CPU 1/${THROTTLE} / 画面の軽さ ${LOAD} / 自動 ${fx.autoLoad}${process.env.ROOT_DIR ? ` / ${ROOT}` : ''}`);
    console.log(`  コマ          ${res.frames}コマ(平均 ${(res.frames / SECONDS).toFixed(1)}fps)`);
    console.log(`  コマの間隔    中央値 ${res.p50}ms / 95% ${res.p95}ms / 最大 ${res.max}ms`);
    console.log(`  詰まり        50ms超 ${res.over50}コマ / 100ms超 ${res.over100}コマ`);
    console.log(`  長い処理      ${res.lt}回 / 合計 ${res.ltMs}ms`);
    console.log(`  計算の割合    ${cpuPct.toFixed(0)}%(ブラウザ本体)`);
    console.log(`  動き続け      はじめ ${inf0}個 → 終わり ${inf1}個`);
    console.log(`  画面の軽さ    ${res.levels.join(' → ')}`);
    console.log(`  進んだWAVE    ${res.wave}`);
    console.log('RESULT ' + JSON.stringify({ ...res, cpuPct: Math.round(cpuPct), inf0, inf1 }));
    if (errors.length) { console.log(`NG: 実行時エラー ${errors.slice(0, 2).join(' / ')}`); process.exitCode = 1; }
  } finally {
    await run.close();
  }
})();
