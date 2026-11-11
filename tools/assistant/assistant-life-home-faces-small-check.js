// HOME の顔の列(助手ライフの顔・AssistantLifeHomeFaces)が、小さい横画面でも画面の外へ出ない(2026-11-08 カード部ルール: 本番の 568×320 で
// MFバトルカードの札の下の顔の列が画面の下で切れた。札が押し下げられすぎていた → 押し下げを画面の下に収まる所までにした 69-screen-home.jsx)
//   node tools/assistant/assistant-life-home-faces-small-check.js
//   ① 568×320・667×375・844×390・390×844・375×667: どの顔の列も、札そのものも画面の中(上下左右)
//   ② 顔の列が札や顔どうしに重ならない(life-browser-shared の homeFacesProblems の「顔」の項目)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9245;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, waitFaces, finishTalk, homeFacesProblems } = require(path.resolve(__dirname, 'life-browser-shared'));
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    for (const [w, h] of [[568, 320], [667, 375], [844, 390], [390, 844], [375, 667]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', e => errors.push(`${w}x${h}: ${e}`));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: null });
      await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`${process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, "/") : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await waitFaces(page); await finishTalk(page); await page.waitForTimeout(1500);
      const out = await page.evaluate(() => { const ng = [];
        for (const f of document.querySelectorAll('[data-assistant-life-home-faces]')) { const r = f.getBoundingClientRect(); if (!r.width) continue; if (r.top < -1 || r.left < -1 || r.bottom > innerHeight + 1 || r.right > innerWidth + 1) ng.push(`顔の列が画面の外 ${f.getAttribute('data-assistant-life-home-faces')} 下端${Math.round(r.bottom)}/${innerHeight}`); }
        for (const s of ['.mh-home-card-battle', '.mh-home-facility.rhythm', '.mh-home-facility.life', '.mh-home-facility.management', '.mh-home-facility.temple', '.mh-home-facility.market', '.mh-home-facility.battle', '.mh-home-mission', '.mh-home-gift', '.mh-home-update', '.mh-home-event-banner', '.mh-home-tour-banner', '.mh-home-settings']) { const e = document.querySelector(s); if (!e || !e.offsetParent) continue; const r = e.getBoundingClientRect(); if (r.bottom > innerHeight + 1 || r.top < -1 || r.right > innerWidth + 1 || r.left < -1) ng.push(`札が画面の外 ${s}`); }
        return { ng, n: document.querySelectorAll('[data-assistant-life-home-faces]').length }; });
      check(`① ${w}×${h}: 顔の列(${out.n}列)と札が画面の中`, out.n > 0 && out.ng.length === 0, out.ng.join(' / '));
      const faceNg = (await homeFacesProblems(page)).filter(x => /^(life|rhythm|card|management|market)/.test(x) || /顔/.test(x));
      check(`② ${w}×${h}: 顔の列が札・顔どうしに重ならない`, faceNg.length === 0, faceNg.join(' / '));
      await page.close();
    }
    check('③ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
