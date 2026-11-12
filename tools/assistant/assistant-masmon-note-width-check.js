#!/usr/bin/env node
// 育成ノートの一覧(56-assistant-life-masmon-plan.jsx の AmgpMine)を、本物のゲームを開いて幅 375・360・320 で確かめる。2026-11-12 キズナ
//   node tools/assistant/assistant-masmon-note-width-check.js [--shots]
//   ① 印 assistantMasmonBond が真のとき、どの子の札にも「ランク + 総合力」が出て、「…」で切れず札の中に収まる
//      (fable のミハリの指摘: 名前と同じ truncate の行に入っていて、幅375以下でランクと総合力が切れていた)
//   ② 名前の行(名前と「◯◯のマスモン・育成Lv」)だけが「…」で切れてよい。札は横にはみ出さない
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9263;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/shots');
const WIDTHS = [375, 360, 320];
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
  try {
    for (const w of WIDTHS) {
      const page = await browser.newPage({ viewport: { width: w, height: 760 }, deviceScaleFactor: SHOTS ? 2 : 1 });
      page.on('pageerror', e => console.log(`  (ページのエラー ${w}) ${String(e.message).slice(0, 120)}`));
      await page.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page);
      const n = await page.evaluate(async () => {
        Object.assign(RELEASE_FLAGS, { assistantMasmonGrow: true, assistantMasmonPlan: true, assistantMasmonBond: true });
        await ASSISTANT_MASMON_STORE.load(); await assistantMasmonEnsureMade();
        // 長い名前でも札が切れないかを見るため、1体目の名前を長くする(保存はページの中だけ)
        const st = ASSISTANT_MASMON_STORE.state; const made = st.draw.made.kiki;
        if (made && made[0]) ASSISTANT_MASMON_STORE.set({ ...st, draw: { ...st.draw, made: { ...st.draw.made, kiki: made.map((t, i) => (i === 0 ? { ...t, nick: 'ながいながいなまえのマスモン' } : t)) } } });
        if (typeof AMGB_STORE !== 'undefined') await AMGB_STORE.load();
        const el = document.createElement('div'); el.id = 'note-width-check'; document.body.appendChild(el);
        ReactDOM.createRoot(el).render(React.createElement(AssistantMasmonNote, { onClose: () => {} }));
        return 1;
      });
      await page.locator('[data-amgp-mon]').first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(800);
      const r = await page.evaluate(() => {
        const out = { cards: 0, tags: 0, ng: [] };
        for (const c of document.querySelectorAll('[data-amgp-mon]')) {
          out.cards++;
          const cr = c.getBoundingClientRect();
          if (cr.right > window.innerWidth + 1 || cr.left < -1) out.ng.push(`札がはみ出す ${c.getAttribute('data-amgp-mon')}`);
          const tag = c.querySelector('[data-amgp-power-tag]');
          if (!tag) { out.ng.push(`札が無い ${c.getAttribute('data-amgp-mon')}`); continue; }
          out.tags++;
          const tr = tag.getBoundingClientRect();
          if (tr.width < 8 || tr.right > cr.right + 1) out.ng.push(`札が切れる(${Math.round(tr.width)}px)`);
          for (const t of tag.querySelectorAll('*')) if (t.scrollWidth > t.clientWidth + 1 && getComputedStyle(t).overflow === 'hidden') out.ng.push('札の中が切れる');
          let p = tag.parentElement; while (p && p !== c) { if (p.classList.contains('truncate')) out.ng.push('札が truncate の中にある'); p = p.parentElement; }
          if (!/\d/.test(tag.textContent) && !/—/.test(tag.textContent)) out.ng.push(`総合力の字が無い: ${tag.textContent}`);
        }
        return out;
      });
      check(`幅${w}: どの子の札にもランクと総合力が出て、切れない`, r.cards > 0 && r.tags === r.cards && !r.ng.length, `${r.tags}/${r.cards} ${[...new Set(r.ng)].join(' / ')}`);
      if (SHOTS) await page.locator('[data-amgp-mon]').first().screenshot({ path: path.join(shotDir, `masmon-note-card-${w}.png`) }).catch(() => {});
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `NG ${failed} 件` : 'OK: 育成ノートの一覧(幅 375・360・320)');
  process.exit(failed ? 1 : 0);
})();
