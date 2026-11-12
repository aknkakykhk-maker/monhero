#!/usr/bin/env node
// モンヒロサクセスの育てる子の演出(56-monhero-success-fx.jsx)を本物のブラウザで開き、止め絵を撮る。
// あわせて「ページのエラーが出ない・字(ふきだし・節目の札)が枠からはみ出さない・動きを減らす設定で止まる」を見る。
//
//   node tools/success/success-fx-shoot.js                 … 縦390×844 で見本を開いて確かめる(撮らない)
//   SHOT_DIR=<フォルダ> node tools/success/success-fx-shoot.js … 縦390×844・横844×390・幅320×568 で撮る
//
// 撮るもの(1つの大きさにつき3枚): 気分8つ(しぐさを出したまま・季節と時間の光をそれぞれ替える)/
// 訓練の結果・叱る・褒めるの反応7つ(動きの途中で止める)/ 節目の短い演出6つ
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const PORT = 8973;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };

// ページの中で見本を並べる(sheet: moods / react / moment)
const mount = (sheet) => {
  /* global MsxLiveMon, MsxFxMoment, MsxSceneLight */
  const h = React.createElement;
  if (window.__fxRoot) { window.__fxRoot.unmount(); window.__fxRoot = null; }
  const el = document.getElementById('fx-shot') || Object.assign(document.createElement('div'), { id: 'fx-shot' });
  el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0f0d24;overflow:hidden;font-family:sans-serif';
  document.body.appendChild(el);
  const land = innerWidth > innerHeight;
  const cols = land ? 4 : 2;
  const grid = (cells) => h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 6, padding: 6, height: '100%', boxSizing: 'border-box', gridAutoRows: '1fr' } }, cells);
  const label = (t) => h('div', { className: 'fx-label', style: { position: 'absolute', left: 6, top: 4, zIndex: 5, color: '#fde047', fontWeight: 900, fontSize: 12, textShadow: '0 1px 2px #000' } }, t);
  const cell = (key, bg, kids) => h('div', { key, className: 'fx-cell', style: { position: 'relative', overflow: 'hidden', borderRadius: 10, border: '1px solid #3b3566', minHeight: 0 } },
    h('img', { src: bg, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } }), ...kids);
  const monBox = (props) => h('div', { style: { position: 'absolute', left: 0, right: 0, bottom: '4%', height: '62%', zIndex: 2 } }, h(MsxLiveMon, props));
  const SP = ['Mocchi', 'Tiger', 'Pixie', 'Mia', 'Golem', 'Ham', 'Suezo', 'Undine'];
  let cells;
  if (sheet === 'moods') {
    const moods = [['joy', 'ごきげん', 'spring', '朝'], ['hype', '大はしゃぎ', 'summer', '昼'], ['calm', 'ふつう', 'autumn', '昼'], ['tired', '疲れ', 'autumn', '夕方'],
      ['sulky', 'ふてくされ', 'winter', '夕方'], ['sad', 'うつ(しょんぼり)', 'winter', '夜'], ['surprise', 'びっくり', 'spring', '昼'], ['clingy', '甘える', 'summer', '夜']];
    const bgOf = (t) => (t === '夕方' ? 'images/story-bg/monhero_plaza_evening.jpg' : t === '夜' ? 'images/story-bg/monhero_night.jpg' : 'images/story-bg/monhero_plaza.jpg');
    cells = moods.map(([m, name, season, time], i) => cell(m, bgOf(time), [h(MsxSceneLight, { key: 'l', season, time }), label(`${name}・${season}/${time}`),
      monBox({ key: 'm', species: SP[i], mood: m, season, time, pose: true, seed: 'shot' })]));
  } else if (sheet === 'react') {
    const rs = [['great', '🌟大成功'], ['ok', '⭕成功'], ['fail', '❌失敗'], ['sab', '💤サボり'], ['scold', '叱る(合っていた)'], ['scoldBad', '叱る(合っていない)'], ['praise', '褒める'], ['peak', 'ピークに入った']];
    cells = rs.map(([k, name], i) => cell(k, 'images/story-bg/forest_morning.jpg', [label(name),
      monBox({ key: 'm', species: SP[i], mood: 'calm', react: { kind: k, id: 1 }, seed: 'shot' })]));
  } else {
    const ms = [['lvup', 'ちから Lv3', '訓練の効果が上がった'], ['tech', 'ローリングアタック', '修行で覚えた'], ['win', 'ルーキーカップ', ''], ['lose', 'ルーキーカップ', 'また挑戦しよう'], ['over', '', 'ここで育成はおわり'], ['retire', 'もちまる', 'おつかれさま']];
    cells = ms.map(([k, title, sub]) => cell(k, 'images/story-bg/monhero_plaza.jpg', [h(MsxFxMoment, { key: 'x', kind: k, title, sub, species: 'Mocchi', onDone() {} })]));
  }
  window.__fxRoot = ReactDOM.createRoot(el);
  window.__fxRoot.render(grid(cells));
};

(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const sizes = SHOT_DIR ? [[390, 844, ''], [844, 390, 'land'], [320, 568, 's320']] : [[390, 844, '']];
  try {
    for (const [w, hgt, tag] of sizes) {
      const page = await browser.newPage({ viewport: { width: w, height: hgt } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => typeof MsxLiveMon === 'function' && typeof ALL_PLAYER_MONSTERS === 'object', undefined, { timeout: 90000 });
      // ふきだしの声は台本 mon.js から(回2の台本の束がまだ無い版でも、正本を読んで本物の鳴き声で撮る)
      await page.addScriptTag({ url: `http://localhost:${PORT}/docs/progress/player-raise/script/mon.js` });
      for (const sheet of ['moods', 'react', 'moment']) {
        const nm = `${sheet}${tag ? `(${tag})` : ''}`;
        await page.evaluate(() => { const s = document.getElementById('fx-pause'); if (s) s.remove(); });
        await page.evaluate(`(${mount.toString()})(${JSON.stringify(sheet)})`);
        // 絵が読めるまで待ち、動きの途中(約0.45秒目)で止めて撮る
        await page.waitForTimeout(sheet === 'moods' ? 900 : 120);
        await page.evaluate((late) => { const st = document.createElement('style'); st.id = 'fx-pause';
          st.textContent = `.msxfx-live *,.msxfx-moment *{animation-play-state:paused!important;animation-delay:-${late}s!important}`; document.head.appendChild(st); }, sheet === 'moods' ? 0.5 : 0.45);
        await page.evaluate(() => Promise.all([...document.querySelectorAll('#fx-shot img')].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; })))));
        const m = await page.evaluate(() => {
          const cells = [...document.querySelectorAll('#fx-shot .fx-cell')];
          const over = [];
          for (const c of cells) {
            const R = c.getBoundingClientRect();
            for (const e of c.querySelectorAll('.msxfx-bub, .msxfx-title, .msxfx-head')) { const r = e.getBoundingClientRect(); if (r.width && (r.right > R.right + 2 || r.left < R.left - 2)) over.push((e.innerText || '').slice(0, 16)); }
          }
          const mons = document.querySelectorAll('#fx-shot .msxfx-live').length;
          const idle = document.querySelectorAll('#fx-shot [data-monster-idle]').length;
          return { cells: cells.length, over, mons, idle };
        });
        check(`${nm}: 見本が全部出る`, m.cells >= 6 && m.mons >= 6, `枠${m.cells}・子${m.mons}`);
        check(`${nm}: 待機アニメのリグが付く`, m.idle >= 4, `${m.idle}体`);
        check(`${nm}: 字が枠からはみ出さない`, m.over.length === 0, m.over.slice(0, 3).join(' / '));
        if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `msxfx-${sheet}${tag ? `-${tag}` : ''}.png`) }); }
      }
      await page.close();
    }
    // 動きを減らす設定: リグを使わず、アニメが止まる
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => typeof MsxLiveMon === 'function', undefined, { timeout: 90000 });
    await page.evaluate(`(${mount.toString()})("react")`);
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => ({ calm: document.querySelectorAll('#fx-shot .msxfx-calm').length, idle: document.querySelectorAll('#fx-shot [data-monster-idle]').length,
      moving: [...document.querySelectorAll('#fx-shot .msxfx-act')].filter((e) => getComputedStyle(e).animationName !== 'none').length }));
    check('動きを減らす: 止まった姿で出る', r.calm >= 6 && r.idle === 0 && r.moving === 0, JSON.stringify(r));
    // 反応は1.2秒で終わる・押せばとばせる
    await page.close();
    const p2 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    p2.on('pageerror', (e) => errors.push(String(e && e.message || e)));
    await p2.addInitScript(quietBootSeed()); await p2.addInitScript(updateNoticeSeed());
    await p2.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    await p2.waitForFunction(() => typeof MsxLiveMon === 'function', undefined, { timeout: 90000 });
    const t = await p2.evaluate(async () => {
      const h = React.createElement; const el = document.createElement('div'); el.style.cssText = 'position:fixed;inset:0;z-index:99999'; document.body.appendChild(el);
      const root = ReactDOM.createRoot(el); let ended = 0; let done = 0;
      root.render(h('div', { style: { position: 'relative', height: 300 } }, h(MsxLiveMon, { species: 'Mocchi', react: { kind: 'great', id: 1 }, onReactEnd() { ended = performance.now(); } }),
        h(MsxFxMoment, { kind: 'win', title: 'x', onDone() { done = performance.now(); } })));
      const t0 = performance.now();
      await new Promise((r) => setTimeout(r, 1500));
      const autoReact = ended ? ended - t0 : -1; const autoMoment = done ? done - t0 : -1;
      done = 0; root.render(h('div', { style: { position: 'relative', height: 300 } }, h(MsxFxMoment, { key: 2, kind: 'lose', title: 'y', onDone() { done = performance.now(); } })));
      await new Promise((r) => setTimeout(r, 100));
      const t1 = performance.now(); document.querySelector('.msxfx-moment').click();
      await new Promise((r) => setTimeout(r, 50));
      const skip = done ? done - t1 : -1;
      root.unmount(); el.remove();
      return { autoReact, autoMoment, skip };
    });
    check('反応は1.2秒ほどで終わる', t.autoReact > 1000 && t.autoReact < 1400, `${Math.round(t.autoReact)}ms`);
    check('節目の演出は1.2秒ほどで終わる', t.autoMoment > 1000 && t.autoMoment < 1400, `${Math.round(t.autoMoment)}ms`);
    check('節目の演出は押せばすぐとばせる', t.skip >= 0 && t.skip < 60, `${Math.round(t.skip)}ms`);
    await p2.close();
  } finally { await browser.close(); server.close(); }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  console.log(failed ? `NG ${failed}件` : 'OK: すべて');
  process.exit(failed ? 1 : 0);
})();
