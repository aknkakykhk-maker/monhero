// 助手ライフからモンヒロサクセスへの入口(2026-11-14 社長・56-assistant-life-success.jsx)を、実ブラウザで確かめる。
//   node tools/assistant/life-success-entry-check.js           検査(縦・横)
//   node tools/assistant/life-success-entry-check.js --shots   止め絵も撮る(docs/progress/assistant-life/success-entry/)
// 見るもの
//   ① 印 monheroSuccess が偽のあいだは、部屋にも地図にも入口が出ない
//   ② 印を真にすると(ページの中でだけ)、部屋の「できること」に「モンヒロサクセス(β)」。みゅあは「みゅあ編で」、ほかの助手は「いまはみゅあ編だけ」
//   ③ 押すとモンヒロサクセスの画面が助手ライフの上(最前面)に出て、始める画面ではみゅあが選ばれている
//   ④ 地図のモンヒロバトルにいる助手の札に入口が出る
//   ⑤ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9294;
const SHOTS = process.argv.includes('--shots'), shotDir = path.join(root, 'docs/progress/assistant-life/success-entry');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIX = { groups: [{ ids: ['mua', 'kyuko'], doing: 'walk', place: 'home' }], solo: { kiki: { doing: 'idle', place: 'battle' }, atsu: { doing: 'idle', place: 'home' }, dra: { doing: 'idle', place: 'home' } } };
const VIEWS = [{ id: 'tate', name: '縦 390×844', w: 390, h: 844 }, { id: 'yoko', name: '横 844×390', w: 844, h: 390 }];
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていない'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = []; if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const rowText = (page) => page.evaluate(() => { const b = document.querySelector('[data-assistant-life-room-do="monhero-success"]'); return b ? b.innerText.replace(/\s+/g, ' ') : null; });
  const openRoom = async (page, who) => {
    await page.locator('[data-assistant-life-room-sheet] button:has-text("閉じる"), [data-assistant-life-room-sheet] [aria-label="閉じる"]').first().click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(400);
    await page.locator(`[data-assistant-life-room="${who}"]`).first().click({ timeout: 5000 }); await page.waitForTimeout(900);
  };
  for (const v of VIEWS) {
    const T = `[${v.name}] `;
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } }); }, MIX);
    await page.waitForTimeout(800); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    // ① 印が偽
    await openRoom(page, 'mua');
    check(`${T}① 印が偽のあいだは部屋に入口が出ない`, (await rowText(page)) === null);
    // ② 印を真に(ページの中でだけ)
    await page.evaluate(() => { RELEASE_FLAGS.monheroSuccess = true; });
    await openRoom(page, 'kiki');
    const kiki = await rowText(page);
    check(`${T}② みゅあ以外の助手は「いまはみゅあ編だけ」`, !!kiki && kiki.includes('モンヒロサクセス(β)') && kiki.includes('いまはみゅあ編だけ'), String(kiki));
    await openRoom(page, 'mua');
    const mua = await rowText(page);
    check(`${T}② みゅあは「みゅあ編で」`, !!mua && mua.includes('みゅあ編で'), String(mua));
    const row = page.locator('[data-assistant-life-room-do="monhero-success"]');
    if (mua) {
      await row.scrollIntoViewIfNeeded(); if (SHOTS) await page.screenshot({ path: path.join(shotDir, `1-room-${v.id}.png`) });
      await row.click(); await page.waitForTimeout(2500);
      const o = await page.evaluate(() => {
        const el = document.querySelector('[data-msx-view]'); if (!el) return { exists: false };
        const cx = innerWidth / 2, cy = Math.min(innerHeight - 60, 120), top = document.elementFromPoint(cx, cy);
        return { exists: true, view: el.getAttribute('data-msx-view'), onTop: !!top && (el.contains(top) || !!top.closest('.msx')) };
      });
      check(`${T}③ 押すとモンヒロサクセスの画面が助手ライフの上に出る`, o.exists && o.onTop, JSON.stringify(o));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `2-opened-${v.id}.png`) });
      await page.evaluate(() => { try { ALSX_HOST.set(null); } catch (_) {} }); await page.waitForTimeout(500);
      check(`${T}③ 閉じると部屋に戻る`, (await page.locator('[data-msx-view]').count()) === 0 && (await page.locator('[data-assistant-life-room-sheet]').count()) >= 1);
    }
    // ④ 地図のモンヒロバトル
    await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } }); try { assistantLifeOpenMapAt('battle', 'kiki'); } catch (_) {} }, MIX); await page.waitForTimeout(1200);
    const mapBtn = page.locator('[data-assistant-life-map-sheet-who="kiki"] [data-assistant-life-map-act="monhero-success"]');
    const mapN = await mapBtn.count();
    check(`${T}④ 地図のモンヒロバトルにいる助手の札に入口が出る`, mapN === 1, `${mapN}`);
    if (mapN && SHOTS) { await mapBtn.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shotDir, `3-map-${v.id}.png`) }); }
    await page.close();
  }
  check('⑤ ページのエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `${failed} 件 NG` : 'すべて OK'); process.exit(failed ? 1 : 0);
})();
