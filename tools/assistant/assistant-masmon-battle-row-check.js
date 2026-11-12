// 助手ライフの部屋の「⚔ マスモンで対戦(β)」の行を、iPhone の縦(390×844)と横で実際に押して確かめる(2026-11-12 社長「押しても反応しない」)
//   ① 行が出ていて、行の右に意味の分からない数字(以前の「61」)が出ない ② 押せる状態なら、押すと対戦βの準備の画面が助手ライフの上に見える(最前面・見える・押せる)
//   ③ 押せない状態(マスモンが無い・ほかの助手がいない)なら、行は灰色で理由の字が出る ④ 「← もどる」で部屋に戻れる ⑤ ページのエラーが出ない
//   出かけている助手(散歩・町の場所)の部屋でも同じ。--shots [置き場]
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9281;
const argv = process.argv.slice(2), si = argv.indexOf('--shots');
const SHOTS = si >= 0, shotDir = path.resolve(root, si >= 0 && argv[si + 1] && !argv[si + 1].startsWith('--') ? argv[si + 1] : 'docs/progress/assistant-life/masmon-battle-row');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIX = { groups: [{ ids: ['mua', 'kyuko'], doing: 'walk', place: 'courtyard' }], solo: { kiki: { doing: 'snack', place: 'cafe' }, atsu: { doing: 'idle', place: 'home' }, dra: { doing: 'idle', place: 'home' } } };
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
    // 印を真にして(本番は公開済み)、ほかの助手にもマスモンがいる形にする(無ければ確かめ用の1体を持たせる)
    const prep = await page.evaluate((m) => {
      RELEASE_FLAGS.assistantMasmonBattleBeta = true; RELEASE_FLAGS.assistantMasmonGrow = true;
      const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } });
      return { mua: assistantMasmonBattleRowInfo('mua') };
    }, MIX);
    await page.waitForTimeout(800); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    await page.locator('[data-assistant-life-room="mua"]').first().click({ timeout: 5000 }); await page.waitForTimeout(900);
    const row = page.locator('[data-assistant-life-room-do="masmon-battle"]');
    const info = await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-room-do="masmon-battle"]'); return b ? { disabled: b.disabled, text: b.innerText.replace(/\s+/g, ' '), gain: (b.querySelector('[data-assistant-life-room-do-gain]') || {}).textContent || '', info: assistantMasmonBattleRowInfo('mua') } : null; });
    check(`${T}① 部屋に「マスモンで対戦(β)」の行が出る`, !!info, JSON.stringify(info));
    if (info) {
      check(`${T}① 行の右に意味の分からない数字(61 など)が出ない`, !/^\d+$/.test(String(info.gain).trim()), JSON.stringify(info.gain));
      if (SHOTS) { await row.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(shotDir, `1-row-${v.id}.png`) }); }
      if (info.disabled) {
        check(`${T}③ 押せない行は理由の字が出る(灰色)`, info.text.length > 12 && /迎え|対戦できます/.test(info.text), info.text);
      } else {
        await row.scrollIntoViewIfNeeded(); await row.click(); await page.waitForTimeout(1200);
        const o = await page.evaluate(() => {
          const el = document.querySelector('[data-ambb-root]'); if (!el) return { exists: false };
          const r = el.getBoundingClientRect(), cx = innerWidth / 2, cy = Math.min(innerHeight - 60, 120), top = document.elementFromPoint(cx, cy);
          return { exists: true, w: Math.round(r.width), h: Math.round(r.height), onTop: !!top && el.contains(top), prep: !!document.querySelector('[data-ambb-prep],[data-ambb-empty]') };
        });
        check(`${T}② 押すと対戦βの画面が助手ライフの上に出る(最前面)`, o.exists && o.onTop, JSON.stringify(o));
        if (SHOTS) await page.screenshot({ path: path.join(shotDir, `2-opened-${v.id}.png`) });
        if (o.exists) {
          await page.locator('[data-ambb-close]').first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500);
          check(`${T}④ 「← もどる」で対戦βの画面が閉じ、部屋に戻る`, (await page.locator('[data-ambb-root]').count()) === 0 && (await page.locator('[data-assistant-life-room-sheet]').count()) === 1);
        }
      }
    }
    await page.close();
  }
  check('⑤ ページのエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `${failed} 件 NG` : 'すべて OK'); process.exit(failed ? 1 : 0);
})();
