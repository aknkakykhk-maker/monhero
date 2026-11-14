#!/usr/bin/env node
// お話(イベントの会話)を、縦・横・🔄横で開き、上の段(前の話し手の顔と吹き出し)と下の窓(題・顔の列・台詞)が重ならないかを数える。
//
//   node tools/ui/story-zone-rotation-check.js
//
// 【2026-11-08 ミハリ・レフェリーくん】モンヒロビートの「🔄 横」(端末は縦のまま絵を回す)でお話を開くと、端末が縦なので
//   縦の決まり(70-bootstrap.jsx の [data-story-zones]。窓の高さ 266〜300px・上の段は上から 130px ほど)が効き、
//   回した画面(高さ 390 など)に入りきらず、前の話し手の薄い吹き出しが窓の題に重なっていた。
//   直し: 回しているときは、横の低い画面と同じ決まりにする([data-mh-view-rotation="true"] の行)。
// 見ること(縦 390×844・横 844×390・🔄横 390×844 を回す):
//   ① 上の段(data-story-stage)と下の窓(data-story-sheet)が重ならない
//   ② 下の窓と台詞の欄(data-story-line-box)が画面の中に収まる
//   ③ 画面のエラーが無い
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed, quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const root = path.resolve(__dirname, '..', '..');
const PORT = 8975;
const STORY = 'pandora_wings_2026_ep8'; // 上の段にゲスト(パンドラ)が出たまま、助手が話す場面があるお話
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const css = fs.readFileSync(path.join(root, 'monster-hero/src/parts/70-bootstrap.jsx'), 'utf8');
  check('🔄横のときの決まりが、お話の窓の高さを回した画面の高さ(--mh-vh)で決めている',
    /\[data-mh-view-rotation="true"\] \[data-event-story\]\[data-story-zones\] \[data-story-sheet\]\[data-story-sheet\] \{ height: calc\(var\(--mh-vh\)/.test(css));
  const rhythm = fs.readFileSync(path.join(root, 'monster-hero/data/rhythm-mode.js'), 'utf8');
  check('回した器が --mh-vw(回した画面の幅 = 端末の高さ)を渡している', /'--mh-vw':`\$\{vh\(\)\}px`/.test(rhythm));
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    for (const vp of [{ n: '縦', w: 390, h: 844 }, { n: '横', w: 844, h: 390 }, { n: '🔄横', w: 390, h: 844, rot: true }]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript(() => { const put = (k, v) => localStorage.setItem(k, JSON.stringify(v)); put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); window.__mhSupabaseStubbed = true; });
      await page.addInitScript(eventStorySeed()); await page.addInitScript(quietBootSeed());
      await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 503, body: '{}' }));
      await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) {
        if (await top.isVisible().catch(() => false)) await top.click().catch(() => {});
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む)$/.test((x.innerText || '').trim())); if (b) b.click(); });
        await page.waitForTimeout(500);
      }
      await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: '分かった！冒険に戻る' }).waitFor({ timeout: 20000 });
      await page.locator('footer button[aria-label=""]').dispatchEvent('click');
      const list = page.locator('[data-debug-story-list]');
      await list.evaluate((el) => { let p = el.parentElement; while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; } });
      await list.dispatchEvent('click');
      await page.locator(`[data-debug-story-item="${STORY}"]`).dispatchEvent('click');
      const dlg = page.locator('[data-event-story]');
      await dlg.waitFor({ timeout: 15000 });
      // 上の段にゲストが出たまま、助手が話している場面まで送る(前の話し手の吹き出しが薄く残る場面)
      for (let i = 0; i < 60; i++) {
        const ok = await page.evaluate(() => { const d = document.querySelector('[data-event-story]'); return !!(d && d.getAttribute('data-story-has-stage') && d.getAttribute('data-story-zones') && Number(d.getAttribute('data-story-step')) >= 2 && d.querySelector('[data-story-guest-bubble]')); });
        if (ok) break;
        await page.locator('[data-event-story] button[aria-label="次へ"]').dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(200);
      }
      await page.locator('[data-event-story] button[aria-label="次へ"]').dispatchEvent('click').catch(() => {});
      if (vp.rot) { await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(RHYTHM_VIEW_ROTATION.preferredAngle())); await page.waitForTimeout(900); }
      await page.waitForTimeout(1500);
      const m = await page.evaluate(() => {
        const rot = typeof RHYTHM_VIEW_ROTATION === 'object' && RHYTHM_VIEW_ROTATION.active();
        const R = (el) => { if (!el) return null; const r = rot ? RHYTHM_VIEW_ROTATION.rectOf(el) : el.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; };
        const frame = rot ? document.querySelector('[data-mh-view-rotation="true"]') : null;
        const H = rot ? frame.clientHeight : innerHeight;
        const d = document.querySelector('[data-event-story]');
        return { rot, H, zones: d && d.getAttribute('data-story-zones'), stage: R(d && d.querySelector('[data-story-stage]')), bubble: R(d && d.querySelector('[data-story-guest-bubble]')), sheet: R(d && d.querySelector('[data-story-sheet]')), line: R(d && d.querySelector('[data-story-line-box]')) };
      });
      const T = `[${vp.n}] `;
      if (vp.rot) check(`${T}回した目印が付いている`, m.rot);
      check(`${T}お話を開き、上の段(ゲスト)と下の窓が出ている`, !!(m.zones && m.stage && m.sheet && m.line), JSON.stringify(m));
      if (m.stage && m.sheet) {
        const low = Math.max(m.stage.bottom, m.bubble ? m.bubble.bottom : 0);
        check(`${T}① 上の段(前の話し手の顔と吹き出し)と下の窓が重ならない`, low <= m.sheet.top + 1, `上の段の下 ${low} / 窓の上 ${m.sheet.top}`);
      }
      if (m.sheet && m.line) check(`${T}② 下の窓と台詞の欄が画面の中に収まる`, m.sheet.top >= -1 && m.sheet.bottom <= m.H + 1 && m.line.bottom <= m.H + 1, `窓 ${m.sheet.top}〜${m.sheet.bottom} / 台詞 〜${m.line.bottom} / 画面の高さ ${m.H}`);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  check('③ 画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
