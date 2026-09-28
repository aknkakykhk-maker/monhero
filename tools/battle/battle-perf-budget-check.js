#!/usr/bin/env node
const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクス新画面を実際に開いて、「重さの予算」を守っているかと、「重いときは自動で軽く」が効くかを確かめる。
//
//   node tools/battle/battle-perf-budget-check.js
//   REPORT=1 … 予算の判定に使った数字をすべて出す(予算を見直すとき)
//
// 【なぜ要るか】(2026-09-28 ユーザー指示「モンビーみたいに重さチェックやその他点検ツールを取り入れて
// 軽くて見た目が良く出来る仕組みを作って」)
// battle-fx-lint-check.js は「書き方」を見る。こちらは「実際に画面に出ているもの」を数える。
// 書き方の検査をすり抜けたもの(JSX の style に直に書いた・ほかの画面の CSS が当たった・部品が増えた)も、
// ここで数が増えれば分かる。iPhone の発熱は「動き続けているもの」「合成する層の広さ」にほぼ比例していた。
//
// 【何を見るか】
//   ① 予算: 動き続けているアニメーションの数・合成する層の数と広さ・背景ぼかしの数
//   ② 描き直しになるアニメーション(filter・影・マスク・背景の位置などを動かすもの)が動いていない
//   ③ マスク・合成モードを使っている要素が無い(メモリが足りないと外れて、枠が塗りつぶされ固まる)
//   ④ 重いとき(コマが50ms以上かかり続ける)は、画面の軽さが自動で一段ずつ下がる。「軽め」で止まる
//      ・保存した設定は書き換えない(アプリを開き直すと元に戻る)
//      ・性能計測(デバッグ)を ON にしていれば、下げた記録がパネルに出る
//   ⑤ 設定「重いときは自動で軽く：下げない」なら、重くても下げない
// ⚠️ 数字は Chromium(GPU なし)のもの。実機の iPhone と同じにはならない。「増えたら気づく」ために使う。
const path = require('path');
const { openTacticsBattle } = require('./lib/tactics-battle-page');

const ROOT = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : path.resolve(TOOLS_DIR, '..');
const PORT = Number(process.env.PORT_NO || 8987);
const REPORT = process.env.REPORT === '1';

// 予算(2026-09-28 に測った値に少し余裕を足したもの)。増やすときは、なぜ増えても重くならないかを書く
const BUDGET = {
  infinite: 40,        // 動き続けているアニメーション(測った値 28。光の筋9・宝石5・またたき4 など)
  layers: 85,          // 合成する層の数(測った値 69〜71。光の筋の疑似要素と、それに重なる手札が層になる)
  screens: 5.5,        // 合成する層の広さ(画面何枚ぶんか。測った値 4.5)
  backdrop: 4,         // 背景ぼかし(backdrop-filter)の数(測った値 1)
};

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// 1コマごとに 70ms 使う処理を差し込んで、「重い端末」をつくる(見張りのほうは何も変えない)
const makeHeavy = (page) => page.evaluate(() => {
  window.__heavy = true;
  const burn = () => { if (!window.__heavy) return; const t = performance.now(); while (performance.now() - t < 70) { /* 重さの再現 */ } requestAnimationFrame(burn); };
  requestAnimationFrame(burn);
});
const stopHeavy = (page) => page.evaluate(() => { window.__heavy = false; });
const level = (page) => page.evaluate(() => (document.querySelector('[data-tactics-look]') || {}).getAttribute?.('data-fx-level') || null);
const waitLevel = async (page, want, ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await level(page) === want) return true; await page.waitForTimeout(250); }
  return false;
};

(async () => {
  // ---------- 1回目: ふだんの設定(自動で下げる)・性能計測ON ----------
  let run;
  try {
    run = await openTacticsBattle({ root: ROOT, port: PORT, storage: { mh_battle_perf_v1: '1' } });
  } catch (e) {
    check('タクティクスのバトルを開けた', false, String(e).slice(0, 160));
    console.log(`\n${failed}件のNGがあります`); process.exit(1);
  }
  if (run.skip) { console.log(`SKIP: ${run.skip}`); process.exit(0); }
  const { page, ctx, errors } = run;
  try {
    check('タクティクス新画面のバトルが立ち上がる', run.inBattle);
    if (!run.inBattle) throw new Error('バトルまで進めなかった');
    await page.waitForTimeout(2500);
    check('はじめは保存した軽さ(豪華)で表示する', await level(page) === 'RICH', String(await level(page)));
    check('重さの見張りが動いている', await page.evaluate(() => document.querySelector('[data-tactics-look]')?.getAttribute('data-fx-auto') === 'watch'));

    // ① 予算・② 描き直しになるアニメーション・③ マスク
    const scan = await page.evaluate(() => {
      const REPAINT = /^(filter|backdropFilter|boxShadow|textShadow|mask|maskImage|webkitMask|webkitMaskImage|clipPath|background|backgroundPosition|backgroundSize|backgroundImage|width|height|top|left|right|bottom)$/;
      const anims = document.getAnimations().filter((a) => a.playState === 'running');
      const infinite = anims.filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity);
      const repaint = [];
      for (const a of anims) {
        let props = [];
        try { props = [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)))].filter((p) => REPAINT.test(p) || p.startsWith('--')); } catch {}
        if (props.length) repaint.push(`${a.animationName || '?'}${a.effect.pseudoElement || ''}(${props.join('・')})`);
      }
      const root = document.querySelector('[data-tactics-look]');
      const masked = []; let backdrop = 0;
      const look = (el, pseudo) => {
        const cs = getComputedStyle(el, pseudo);
        const mask = cs.maskImage || cs.webkitMaskImage || 'none';
        if ((mask && mask !== 'none') || (cs.mixBlendMode && cs.mixBlendMode !== 'normal')) {
          const tag = (el.getAttributeNames().find((n) => n.startsWith('data-')) || el.className || el.tagName);
          masked.push(`${String(tag).slice(0, 40)}${pseudo || ''}`);
        }
        const bd = cs.backdropFilter || cs.webkitBackdropFilter;
        if (!pseudo && bd && bd !== 'none') backdrop++;
      };
      // 敵の大きな演出は body 直下へ出す(portal)ので、画面全体を見る
      for (const el of document.body.querySelectorAll('*')) { look(el, null); look(el, '::before'); look(el, '::after'); }
      const names = {}; infinite.forEach((a) => { const n = (a.animationName || '?') + (a.effect.pseudoElement || ''); names[n] = (names[n] || 0) + 1; });
      return { infinite: infinite.length, names, repaint, masked: [...new Set(masked)], backdrop, rootOk: !!root };
    });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('LayerTree.enable');
    const layers = await new Promise((res) => { cdp.once('LayerTree.layerTreeDidChange', (e) => res(e.layers || [])); setTimeout(() => res(null), 4000); });
    const drawing = layers ? layers.filter((l) => l.drawsContent) : [];
    const screens = drawing.reduce((a, l) => a + l.width * l.height, 0) / (390 * 844);
    if (REPORT) {
      console.log('ANIMS', scan.infinite, JSON.stringify(scan.names));
      console.log('LAYERS', layers ? layers.length : '?', 'drawing', drawing.length, 'SCREENS', screens.toFixed(2), 'BACKDROP', scan.backdrop);
    }
    check(`① 動き続けているアニメーションは${BUDGET.infinite}個まで`, scan.infinite <= BUDGET.infinite, `${scan.infinite}個`);
    if (layers) {
      check(`① 合成する層は${BUDGET.layers}枚まで`, layers.length <= BUDGET.layers, `${layers.length}枚`);
      check(`① 合成する層の広さは画面${BUDGET.screens}枚ぶんまで`, screens <= BUDGET.screens, `${screens.toFixed(2)}枚ぶん`);
    } else {
      console.log('(参考) 層の一覧を取れなかったので、層の予算は見ていません');
    }
    check(`① 背景ぼかしは${BUDGET.backdrop}個まで`, scan.backdrop <= BUDGET.backdrop, `${scan.backdrop}個`);
    check('② 描き直しになるアニメーションが動いていない', scan.repaint.length === 0, scan.repaint.slice(0, 8).join(' / '));
    check('③ マスク・合成モードを使っている要素が無い', scan.masked.length === 0, scan.masked.slice(0, 8).join(' / '));

    // ④ 重いときは自動で一段ずつ下がり、軽めで止まる
    const saved0 = await page.evaluate(() => localStorage.getItem('mh_battle_fx_v1'));
    await makeHeavy(page);
    check('④ 重いと「標準」へ自動で下がる', await waitLevel(page, 'STANDARD', 15000), String(await level(page)));
    check('④ 重いままなら「軽め」まで下がる', await waitLevel(page, 'LIGHT', 15000), String(await level(page)));
    await page.waitForTimeout(8000);
    check('④ 「最軽量」までは自動で下げない', await level(page) === 'LIGHT', String(await level(page)));
    check('④ 「軽め」まで下げたら見張りをやめる', await page.evaluate(() => !document.querySelector('[data-tactics-look]')?.hasAttribute('data-fx-auto')));
    await stopHeavy(page);
    const saved1 = await page.evaluate(() => localStorage.getItem('mh_battle_fx_v1'));
    check('④ 自動で下げても、保存した設定は書き換えない', saved0 === saved1, `${saved0} → ${saved1}`);
    await page.waitForTimeout(1200);
    const panel = await page.evaluate(() => (document.querySelector('[data-battle-perf-panel]') || {}).innerText || '');
    check('④ 性能計測のパネルに、自動で下げた記録が出る', /自動 RICH→STANDARD/.test(panel) && /自動 STANDARD→LIGHT/.test(panel), panel.replace(/\s+/g, ' ').slice(0, 160));
    check('実行時エラーが出ていない(1回目)', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('1回目を最後まで確かめられた', false, String(e).slice(0, 160));
  } finally {
    await run.close();
  }

  // ---------- 2回目: 設定「下げない」・性能計測OFF ----------
  try {
    const off = await openTacticsBattle({ root: ROOT, port: PORT + 1, storage: { mh_battle_fx_v1: { autoLoad: 'OFF' } } });
    try {
      check('「下げない」でもバトルが立ち上がる', off.inBattle);
      await off.page.waitForTimeout(2500);
      check('⑤ 「下げない」のときは見張らない', await off.page.evaluate(() => !document.querySelector('[data-tactics-look]')?.hasAttribute('data-fx-auto')));
      await makeHeavy(off.page);
      await off.page.waitForTimeout(12000);
      check('⑤ 「下げない」なら重くても豪華のまま', await level(off.page) === 'RICH', String(await level(off.page)));
      await stopHeavy(off.page);
      check('⑤ 性能計測OFFのあいだはパネルを出さない', await off.page.evaluate(() => !document.querySelector('[data-battle-perf-panel]')));
      check('実行時エラーが出ていない(2回目)', off.errors.length === 0, off.errors.slice(0, 2).join(' / '));
    } finally {
      await off.close();
    }
  } catch (e) {
    check('2回目を最後まで確かめられた', false, String(e).slice(0, 160));
  }

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
