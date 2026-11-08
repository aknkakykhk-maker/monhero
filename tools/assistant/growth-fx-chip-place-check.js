// 仲良し度の知らせ(44-growth-fx の小さな札 .mh-gfx-chip)が、どの画面でも押せるもの・字に重ならない(引き継ぎ③・2026-11-08 ナカヨシ8)。
//   node tools/assistant/growth-fx-chip-place-check.js
//   画面: HOME・助手ライフ(家・居場所・友情・道具・フレンド)・ビートP交換所 を 縦 390×844・横 844×390 で。助手ライフは🔄横(390×844 を回す)でも。
//   札が画面の中に収まっていることも見る(🔄横で回した画面の外に置いていた)
//   知らせは growthFxAssistantBond で3つ出し、置き直し(0.5秒・1.5秒)が済んでから、札の四角に重なる「押せるもの・字」を数える(絵はかかってよい)。
//   どこにも空きが無いときは、かかる物がいちばん軽い所(絵の上)へ逃げる作り(growthFxChipSpotScore)。フレンドの家は assistant-life-friend-browser-check ⑥ が見る
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9246;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const chipHits = (page) => page.evaluate(() => {
  const chips = [...document.querySelectorAll('.mh-gfx-chip')].filter(c => c.getClientRects().length);
  if (!chips.length) return { n: 0, hits: [] };
  const hits = [];
  for (const c of chips) {
    const r = c.getBoundingClientRect();
    for (const el of document.querySelectorAll('button,a,[role="tab"],[role="button"],[data-assistant-bubble],p,span,b,small,h1,h2,h3,div')) {
      if (c.contains(el) || el.closest('[data-growth-fx-chips]')) continue;
      const isAct = el.matches('button,a,[role="tab"],[role="button"],[data-assistant-bubble]');
      const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      if (!isAct && !hasText) continue;
      // 字は字そのものの範囲、押せるものは四角で見る(字の無い余白にかかるのは隠していない)
      let e = null;
      const texts = [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
      for (const t of texts) { const rg = document.createRange(); rg.selectNodeContents(t); for (const q of rg.getClientRects()) { if (Math.min(r.right, q.right) - Math.max(r.left, q.left) > 2 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 2) { e = q; break; } } if (e) break; }
      if (!e && isAct) { const q = el.getBoundingClientRect(); if (q.width < innerWidth * 0.9 && q.height < innerHeight * 0.5) e = q; }
      if (!e || !e.width || !e.height) continue;
      const ox = Math.min(r.right, e.right) - Math.max(r.left, e.left), oy = Math.min(r.bottom, e.bottom) - Math.max(r.top, e.top);
      if (ox <= 2 || oy <= 2) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      // 手前に別の物が重なって見えていない要素は数えない
      const cx = Math.max(r.left, e.left) + ox / 2, cy = Math.max(r.top, e.top) + oy / 2;
      const top = document.elementsFromPoint(cx, cy).find(x => !x.closest('[data-growth-fx-chips]'));
      if (top && !(top === el || el.contains(top) || top.contains(el))) continue;
      hits.push(`${(el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 12)}`);
    }
  }
  const box = document.querySelector('[data-growth-fx-chips]');
  const dbg = hits.length && box ? (() => { const r = box.getBoundingClientRect(); const els = [...document.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().startsWith(hits[0].slice(0, 4)))); return { chips: [...document.querySelectorAll('.mh-gfx-chip')].map(c => { const q = c.getBoundingClientRect(); return [q.left, q.top, q.right, q.bottom].map(Math.round).join(','); }), score: growthFxChipSpotScore(box), box: [r.left, r.top, r.right, r.bottom].map(Math.round), els: els.slice(0, 2).map(e => { const q = e.getBoundingClientRect(); const cs = getComputedStyle(e); return `${e.tagName} ${[q.left, q.top, q.right, q.bottom].map(Math.round)} vis=${cs.visibility} op=${cs.opacity} matches=${e.matches(GROWTH_FX_CHIP_BUSY_SEL)}`; }) }; })() : null;
  // 札が画面の中に収まっているか(🔄横で、回した画面の外に置いていた。2026-11-08 ナカヨシ8)
  const outside = chips.map(c => c.getBoundingClientRect()).filter(q => q.left < -1 || q.top < -1 || q.right > innerWidth + 1 || q.bottom > innerHeight + 1).map(q => `${Math.round(q.left)},${Math.round(q.top)} ${Math.round(q.width)}x${Math.round(q.height)}`);
  return { outside, dbg, n: chips.length, hits: [...new Set(hits)], top: document.querySelector('[data-growth-fx-chips]') && document.querySelector('[data-growth-fx-chips]').dataset.growthFxChipsTop };
});
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
  const fire = async (page) => { await page.evaluate(() => { growthFxAssistantBond('mua', 100, 160); growthFxAssistantBond('kiki', 40, 50); growthFxAssistantBond('dra', 20, 30); }); await page.waitForTimeout(2200); }; // 置き直し(0.5・1.5秒と中身が増えたとき)が済むまで(知らせは約3秒で消える)
  try {
    for (const [w, h, tag, rot] of [[390, 844, '縦', 0], [844, 390, '横', 0], [390, 844, '🔄横', 90]]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', e => errors.push(`${w}x${h}: ${e}`));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, life: true, intro: false, bondAll: null });
      await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`${process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await waitFaces(page); await finishTalk(page); await page.waitForTimeout(800);
      const look = async (name) => { await fire(page); const r = await chipHits(page); if (process.env.GFX_SHOTS) await page.screenshot({ path: `/tmp/claude-0/-home-user-monhero/2d6f1228-c857-5cd7-ba03-cd8c99e6fe60/scratchpad/gfx-${w}-${name.replace(/[^a-z]/gi, '') || 'x'}.png` }); check(`${tag} ${name}: 仲良し度の知らせが押せるもの・字に重ならない`, r.n > 0 && r.hits.length === 0, `${r.n}枚 ${r.top || ''} ${r.hits.join(' / ')} ${process.env.GFX_DEBUG ? JSON.stringify(r.dbg) : ''}`); check(`${tag} ${name}: 仲良し度の知らせが画面の中に出る`, r.n > 0 && r.outside.length === 0, r.outside.join(' / ')); };
      if (!rot) await look('HOME');
      await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
      await page.waitForTimeout(500);
      if (rot) { await page.evaluate((a) => RHYTHM_VIEW_ROTATION.set(a), rot); await page.waitForTimeout(1200); }
      for (const t of ['house', 'where', 'friends', 'items', 'visit']) {
        const icon = page.locator(`[data-assistant-life-icon="${t}"]`);
        if (!(await icon.count())) continue;
        await icon.click(); await page.waitForTimeout(500);
        await look(`助手ライフ(${t})`);
      }
      if (rot) { await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(0)); await page.close(); continue; }
      await page.evaluate(() => { try { assistantLifeCloseScreen(); } catch {} }); await page.waitForTimeout(500);
      await page.locator('.mh-home-facility.market').first().click({ timeout: 15000 }).catch(() => {}); await page.waitForTimeout(800);
      await page.getByRole('button', { name: /ビートP交換所/ }).first().click({ timeout: 8000 }).catch(() => {}); await page.waitForTimeout(600);
      await look('ビートP交換所');
      await page.close();
    }
    check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
