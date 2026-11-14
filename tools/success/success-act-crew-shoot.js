#!/usr/bin/env node
// モンヒロサクセスのトレーニングの演出(MsxTrainAct)に、いっしょにいた編成の子と助手が出る(MsxActCrew)ことを本物のブラウザで確かめる。
//   node tools/success/success-act-crew-shoot.js                 … 縦390×844 で4つの場面を開いて確かめる(撮らない)
//   SHOT_DIR=<フォルダ> node tools/success/success-act-crew-shoot.js … 止め絵を撮る(動きの途中 0.9 秒で止める)
//   VIDEO=<フォルダ> を付けると、many-tag の場面を動画(webm)でも撮る
//   あわせて、トレーニングの結果の右下の親密度の札(MsxBondChips)に顔が付き、幅320・名前が長くても場面からはみ出さないこと
// 場面: many-tag(5体・タッグ2体+助手タッグ)/ many(5体・タッグなし+助手)/ few-tag(1体タッグ)/ few(1体・助手なし)/ none(だれも来ない)
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
const PORT = 8977;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const CASES = [
  ['many-tag', 'pow', { members: [0, 1, 2, 3, 4], tags: [1, 3, 'aid'], aid: true }, { crew: 5, tag: 2, aid: 1 }],
  ['many', 'life', { members: [0, 1, 2, 3, 4], tags: [], aid: true }, { crew: 5, tag: 0, aid: 1 }],
  ['few-tag', 'hit', { members: [2], tags: [2], aid: false }, { crew: 1, tag: 1, aid: 0 }],
  ['two-tag-aid', 'tough', { members: [0, 4], tags: [0, 4, 'aid'], aid: true }, { crew: 2, tag: 2, aid: 1 }],
  ['few', 'wise', { members: [5], tags: [], aid: false }, { crew: 1, tag: 0, aid: 0 }],
  ['none', 'eva', { members: [], tags: [], aid: false }, null],
];

(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => typeof MsxTrainAct === 'function' && typeof msxLoad === 'function' && typeof MSX_CSS === 'string', undefined, { timeout: 90000 });
    for (const [name, stat, card, want] of CASES) {
      await page.evaluate(async ({ stat, card }) => {
        /* global msxLoad, msxSuc, MSX_CSS, MsxTrainAct */
        await msxLoad();
        const SUC = msxSuc.SUC;
        const team = ['Tiger', 'Undine', 'Golem', 'Pixie', 'Suezo', 'Kyubi'].filter((x) => SUC.speciesList.includes(x)).map((species) => ({ kind: 'base', species }));
        const s = SUC.newRun({ id: 'act-crew', species: 'Mocchi', aid: 'mua', team, aidBondLv: 4 });
        const run = { v: 1, id: s.id, s, nick: 'もちまる', colors: [], from: { base: 'Mocchi' }, items: [], used: 0, phase: 'main', out: null, log: [], startAt: 1 };
        const o = { kind: 'train', result: 'ok', trainLv: 3, card: { kind: 'train', stat, ...card } };
        if (window.__crewRoot) { window.__crewRoot.unmount(); window.__crewRoot = null; }
        const el = document.getElementById('crew-shot') || Object.assign(document.createElement('div'), { id: 'crew-shot' });
        el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0b0920';
        document.body.appendChild(el);
        window.__crewRoot = ReactDOM.createRoot(el);
        window.__crewRoot.render(React.createElement('div', { className: 'msx', style: { height: '100%' } },
          React.createElement('style', null, MSX_CSS),
          React.createElement('div', { className: 'v-scene', style: { height: '62%', flex: 'none' } },
            React.createElement('img', { className: 'bg', src: 'images/story-bg/forest_evening.jpg', alt: '' }),
            React.createElement(MsxTrainAct, { key: Math.random(), run, o, onDone() {} }))));
      }, { stat, card });
      await page.waitForTimeout(450);
      const cut = await page.evaluate(() => { const c = document.querySelector('.msx-act .tagcut'); if (!c) return null; const r = c.getBoundingClientRect(); return { n: Number(c.dataset.msxTagCutin), w: r.width }; });
      if (want && want.tag) {
        check(`${name}: 友情タッグのカットインが出る`, !!cut && cut.n === want.tag + (card.tags.includes('aid') ? 1 : 0), JSON.stringify(cut));
        if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `act-crew-${name}-cutin.png`) });
      } else check(`${name}: タッグが無ければカットインは出ない`, cut === null);
      await page.waitForTimeout(450);
      const m = await page.evaluate(() => { const c = document.querySelector('.msx-act .crew'); return c ? { crew: Number(c.dataset.msxCrew), tag: Number(c.dataset.msxCrewTag), aid: Number(c.dataset.msxCrewAid), imgs: [...c.querySelectorAll('.cm img, .aid img')].filter((i) => i.complete && i.naturalWidth > 0).length } : null; });
      if (!want) check(`${name}: だれも来ないときは出さない`, m === null);
      else {
        check(`${name}: 編成の子 ${want.crew} 体・タッグ ${want.tag} 体・助手 ${want.aid}`, m && m.crew === want.crew && m.tag === want.tag && m.aid === want.aid, JSON.stringify(m));
        check(`${name}: 絵が読めている`, m && m.imgs === want.crew + want.aid, JSON.stringify(m));
      }
      if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `act-crew-${name}.png`) }); }
    }
    // 親密度の札(幅320・名前が長い子・札が6つ)
    await page.setViewportSize({ width: 320, height: 568 });
    const fit = await page.evaluate(async () => {
      const SUC = msxSuc.SUC;
      const team = ['Tiger', 'Undine', 'Golem', 'Pixie', 'Suezo', 'Kyubi'].filter((x) => SUC.speciesList.includes(x)).map((species, i) => ({ kind: i === 1 ? 'fuse' : 'base', species, name: i === 1 ? 'ながいながいなまえのモンスターさん' : undefined, rank: 'A' }));
      const s = SUC.newRun({ id: 'chip', species: 'Mocchi', aid: 'mua', team, aidBondLv: 4 });
      if (window.__crewRoot) { window.__crewRoot.unmount(); window.__crewRoot = null; }
      const el = document.getElementById('crew-shot'); window.__crewRoot = ReactDOM.createRoot(el);
      window.__crewRoot.render(React.createElement('div', { className: 'msx', style: { height: '100%' } }, React.createElement('style', null, MSX_CSS),
        React.createElement('div', { className: 'v-scene', style: { height: '62%', flex: 'none' } }, React.createElement('img', { className: 'bg', src: 'images/story-bg/forest_evening.jpg', alt: '' }),
          React.createElement(MsxBondChips, { s, card: { members: [0, 1, 2, 3, 4], tags: [1, 'aid'], aid: true }, add: 8 }))));
      await new Promise((r) => setTimeout(r, 500));
      const sc = document.querySelector('.v-scene').getBoundingClientRect();
      const chips = [...document.querySelectorAll('.v-bchip')];
      return { n: chips.length, tag: document.querySelectorAll('.v-bchip.tag').length, faces: [...document.querySelectorAll('.v-bchip img')].filter((i) => i.complete && i.naturalWidth > 0).length,
        out: chips.filter((c) => { const r = c.getBoundingClientRect(); return r.left < sc.left - 0.5 || r.right > sc.right + 0.5 || r.top < sc.top - 0.5 || r.bottom > sc.bottom + 0.5; }).length };
    });
    check('親密度の札: 6つ・タッグ2つ・顔が全部読める', fit.n === 6 && fit.tag === 2 && fit.faces === 6, JSON.stringify(fit));
    check('親密度の札: 幅320・長い名前でも場面からはみ出さない', fit.out === 0, JSON.stringify(fit));
    if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, 'bond-chips-s320.png') });
    if (process.env.VIDEO) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: process.env.VIDEO, size: { width: 390, height: 844 } } });
      const vp = await ctx.newPage(); await vp.addInitScript(quietBootSeed()); await vp.addInitScript(updateNoticeSeed());
      await vp.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await vp.waitForFunction(() => typeof MsxTrainAct === 'function' && typeof msxLoad === 'function', undefined, { timeout: 90000 });
      for (const [stat, card] of [['pow', { members: [0, 1, 2, 3, 4], tags: [1, 3, 'aid'], aid: true }], ['hit', { members: [2], tags: [2], aid: false }]]) {
        await vp.evaluate(async ({ stat, card }) => {
          await msxLoad(); const SUC = msxSuc.SUC;
          const team = ['Tiger', 'Undine', 'Golem', 'Pixie', 'Suezo', 'Kyubi'].filter((x) => SUC.speciesList.includes(x)).map((species) => ({ kind: 'base', species }));
          const s = SUC.newRun({ id: 'act-crew', species: 'Mocchi', aid: 'mua', team, aidBondLv: 4 });
          const run = { v: 1, id: s.id, s, nick: 'もちまる', colors: [], from: { base: 'Mocchi' }, items: [], used: 0, phase: 'main', out: null, log: [], startAt: 1 };
          const el = document.getElementById('crew-shot') || Object.assign(document.createElement('div'), { id: 'crew-shot' });
          el.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0b0920'; document.body.appendChild(el);
          if (window.__v) window.__v.unmount(); window.__v = ReactDOM.createRoot(el);
          window.__v.render(React.createElement('div', { className: 'msx', style: { height: '100%' } }, React.createElement('style', null, MSX_CSS),
            React.createElement('div', { className: 'v-scene', style: { height: '62%', flex: 'none' } }, React.createElement('img', { className: 'bg', src: 'images/story-bg/forest_evening.jpg', alt: '' }),
              React.createElement(MsxTrainAct, { key: Math.random(), run, o: { kind: 'train', result: 'ok', trainLv: 3, card: { kind: 'train', stat, ...card } }, onDone() {} }))));
        }, { stat, card });
        await vp.waitForTimeout(2300);
      }
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  console.log(failed ? `NG: ${failed} 件` : 'OK: すべて');
  process.exit(failed ? 1 : 0);
})();
