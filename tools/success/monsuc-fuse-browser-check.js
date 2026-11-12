#!/usr/bin/env node
// モンヒロサクセスの合体の画面(56-monsuc-fuse.jsx の MonsucFuseSheet)を、本物のゲームを開いて確かめる。2026-11-12 開発部
//   node tools/success/monsuc-fuse-browser-check.js [--shots]   縦 390×844・横 844×390・幅 320×640
//   ・芯 data/monhero-success.js はまだ index.html から読まれないので、ページの中だけで読み込む。箱はページの中の仮の箱(保存しない)
//   ① 主の親 → もう一方の親 → 見通し(生まれる子の種類・代・型・6能力の上乗せ・受け継ぐ技・いなくなる2体)
//   ② 1回目の押しでは合体しない・すばやい2度押しでも合体しない(0.8秒待ってから押せる)・待ってから押すと合体する
//   ③ 記録 mh_monsuc_fuse_v1 に親2体が残る(書く順番は monsuc-fuse-check.js)・箱では親2体が外れて子が1体入る・思い出に2件
//   ④ 未育成の子・編成中の子は選べない / どの画面も横にはみ出さない・ページのエラーが無い
//   --shots で docs/progress/player-raise/shots/fuse-*.png
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9273;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome } = require(path.resolve(__dirname, '..', 'assistant', 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/player-raise/shots');
const VIEWS = [{ id: 'p', name: '縦 390×844', w: 390, h: 844 }, { id: 'l', name: '横 844×390', w: 844, h: 390 }, { id: 'n', name: '幅 320×640', w: 320, h: 640 }];
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const layoutNg = (page, sel) => page.evaluate((sel) => {
  const ng = []; const box = document.querySelector(sel); if (!box) return [`${sel} が無い`];
  const W = window.innerWidth;
  for (const el of box.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (!r.width) continue; if (r.right > W + 1 || r.left < -1) ng.push(`画面の外へ: ${el.tagName} ${Math.round(r.left)}〜${Math.round(r.right)}`); }
  for (const el of box.querySelectorAll('div,p')) if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') ng.push(`横にはみ出す: ${el.textContent.slice(0, 16)}`);
  return [...new Set(ng)].slice(0, 5);
}, sel);

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const v of VIEWS) {
      const T = `[${v.name}] `;
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
      const errors = []; page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 160)));
      await page.route(/supabase\.co|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page);
      await page.addScriptTag({ url: `http://localhost:${PORT}/monster-hero/data/monhero-success.js` });
      const prep = await page.evaluate(() => {
        if (typeof MonsucFuseSheet !== 'function' || typeof monsucFuseCore !== 'function') return { err: '部品が無い' };
        const SUC = monsucFuseCore(); if (!SUC) return { err: '芯を作れない' };
        const tq = (sp) => SUC.techsOf(sp).filter(t => !(t.learn || {}).start).map(t => t.id);
        const st = (a) => Object.fromEntries(SUC.KEYS.map((k, i) => [k, a[i]]));
        window.__box = { v: 1, cap: 30, mons: [
          { id: 'm1', species: 'Undine', nick: 'しずく', raised: true, gen: 2, rank: 'A', st: st([720, 380, 810, 640, 590, 470]), techs: tq('Undine').slice(0, 2), gt: 1 },
          { id: 'm2', species: 'Mocchi', nick: 'もちお', raised: true, gen: 1, rank: 'B', st: st([680, 610, 420, 560, 500, 640]), techs: tq('Mocchi').slice(0, 2), gt: 3 },
          { id: 'm3', species: 'Golem', nick: 'ごつごつ', raised: true, gen: 1, rank: 'B', st: st([800, 700, 200, 400, 150, 820]), techs: [], gt: 2 },
          { id: 'm4', species: 'Pixie', nick: 'ひよっこ', raised: false, gen: 2, rank: null, st: st([300, 200, 400, 300, 300, 200]), techs: [], gt: 0 },
        ], memory: [] };
        window.__saveBox = async (next) => { window.__box = next; return true; };
        const el = document.createElement('div'); el.id = 'monsuc-fuse-check'; document.body.appendChild(el);
        const Host = () => { const [, tick] = React.useState(0); return React.createElement(MonsucFuseSheet, { box: window.__box, saveBox: async (n) => { const r = await window.__saveBox(n); tick(x => x + 1); return r; }, locked: ['m3'], onClose: () => {} }); };
        ReactDOM.createRoot(el).render(React.createElement(Host));
        return {};
      });
      if (prep.err) { check(`${T}仕込み`, false, prep.err); await page.close(); continue; }
      await page.locator('[data-monsuc-fuse]').waitFor({ timeout: 15000 }).catch(() => {});
      const picks = await page.$$eval('[data-monsuc-fuse-pick]', els => els.map(e => e.getAttribute('data-monsuc-fuse-pick')));
      check(`${T}未育成の子・編成中の子は選べない`, picks.join(',') === 'm1,m2', picks.join(','));
      check(`${T}① 主の親の一覧がはみ出さない`, (await layoutNg(page, '[data-monsuc-fuse] > div')).length === 0, (await layoutNg(page, '[data-monsuc-fuse] > div')).join(' / '));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `fuse-1-main-${v.id}.png`) });
      await page.click('[data-monsuc-fuse-pick="m1"]');
      await page.click('[data-monsuc-fuse-pick="m2"]');
      await page.locator('[data-monsuc-fuse-plan]').waitFor({ timeout: 5000 }).catch(() => {});
      const child = await page.getAttribute('[data-monsuc-fuse-child]', 'data-monsuc-fuse-child').catch(() => null);
      check(`${T}見通し: ウンディーネ + モッチー → ヤオビクニ`, child === 'Yaobikuni', String(child));
      const techs = await page.textContent('[data-monsuc-fuse-techs]').catch(() => '');
      check(`${T}見通しに受け継ぐ技・いなくなる2体が出る`, /受け継ぐ技/.test(techs) && await page.locator('[data-monsuc-fuse-lose]').count() === 1, techs);
      const ng = await layoutNg(page, '[data-monsuc-fuse] > div'); check(`${T}③ 見通しがはみ出さない`, ng.length === 0, ng.join(' / '));
      const goBox = await page.locator('[data-monsuc-fuse-go]').boundingBox();
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `fuse-2-plan-${v.id}.png`), fullPage: false });
      // すばやい2度押しでは合体しない
      await page.evaluate(() => { const b = document.querySelector('[data-monsuc-fuse-go]'); b.click(); b.click(); });
      await page.waitForTimeout(200);
      check(`${T}すばやい2度押しでは合体しない`, await page.locator('[data-monsuc-fuse-done]').count() === 0 && (await page.evaluate(() => window.__box.mons.length)) === 4);
      if (SHOTS) { await page.locator('[data-monsuc-fuse-go]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shotDir, `fuse-3-sure-${v.id}.png`) }); }
      await page.waitForTimeout(900);
      await page.click('[data-monsuc-fuse-go]');
      await page.locator('[data-monsuc-fuse-done]').waitFor({ timeout: 5000 }).catch(() => {});
      const after = await page.evaluate(async () => ({ ids: window.__box.mons.map(m => m.id + ':' + m.species + ':' + m.raised), mem: window.__box.memory.length, log: await storeGet('mh_monsuc_fuse_v1', null, false) }));
      check(`${T}合体すると親2体が外れて子が1体入る・思い出に2件`, after.ids.length === 3 && !after.ids.some(x => /^m[12]:/.test(x)) && after.ids.some(x => /:Yaobikuni:false$/.test(x)) && after.mem === 2, after.ids.join(','));
      check(`${T}記録に親2体が残る`, !!(after.log && after.log.log && after.log.log.length === 1 && after.log.log[0].parents.length === 2));
      check(`${T}生まれた画面が出る`, await page.locator('[data-monsuc-fuse-done]').count() === 1);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `fuse-4-done-${v.id}.png`) });
      check(`${T}ボタンが画面の中`, !!goBox && goBox.x >= 0 && goBox.x + goBox.width <= v.w + 1);
      check(`${T}ページのエラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
      // 片付け(ページの中だけ)
      await page.evaluate(() => storeSet('mh_monsuc_fuse_v1', null, false)).catch(() => {});
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  if (failed) { console.log(`NG monsuc-fuse-browser-check: ${failed}件`); process.exit(1); }
  console.log('OK monsuc-fuse-browser-check');
})();
