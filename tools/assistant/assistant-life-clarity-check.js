// 助手ライフ(新UI)の「わかりやすさ」の小さな直し(2026-11-11 社長「わかりづらさをどんどん改善して」・ナカヨシ12)を、実際に開いて確かめる
//   ① 今日やれることの札: 見守る・贈るに上がるもの(🤝💗)が出る。見守り終えたら「✓ 済み」
//   ② にぎわいの札を押すと、何の倍か(友情Lv の上がり方 ×◯)の説明が帯に出る
//   ③ 今日あったことが空のとき: 次にすることの文と「見守る」へ進むボタン
//   ④ 声をかける窓: 声をかけるとどうなるかの1行
//   ⑤ フレンド: 何も無いときは案内1つ(空の箱を並べない)。設定の行は高さ44px以上
//   ⑥ 旧UIは今までどおり(札の字・にぎわいは押せない) ⑦ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9273;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
// 顔ぶれは8人とも決めておく(決まっていない助手がいると、開いたときに組み直されて「今日あったこと」に1件入る)
const MIX = { groups: [{ ids: ['mua', 'kiki'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'sorashido', 'erubin'], doing: 'cards', place: 'cardroom' }],
  solo: { momosuke: { doing: 'practice', place: 'studio' }, atsu: { doing: 'idle', place: 'home', reason: 'lonely' }, kyuko: { doing: 'read', place: 'library' } } };
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  const open = async (v, v2) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h } });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript((on) => { window.__mhSupabaseStubbed = true; if (on) localStorage.setItem('mh_assistant_life_ui_v2', 'true'); }, v2);
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
    return page;
  };
  const text = (page, s) => page.locator(s).first().innerText({ timeout: 3000 }).catch(() => null);
  for (const v of [{ id: 'tate', name: '縦 390×844', w: 390, h: 844 }, { id: 'yoko', name: '横 844×390', w: 844, h: 390 }]) {
    const T = `[${v.name}] `;
    const page = await open(v, true);
    const w = await text(page, '[data-assistant-life-today-gain="watch"]'), g = await text(page, '[data-assistant-life-today-gain="give"]');
    check(`${T}① 見守る・贈るの札に上がるもの`, /🤝💗/.test(w || '') && /🤝💗|買える|✓/.test(g || ''), JSON.stringify({ w, g }));
    await page.locator('[data-assistant-life-tier-help]').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    const note = await text(page, '[data-assistant-life-note]');
    check(`${T}② にぎわいを押すと何の倍かが出る`, /友情Lv の上がり方が ×/.test(note || ''), (note || '').slice(0, 50));
    const hb = await page.locator('[data-assistant-life-tier-help]').boundingBox();
    check(`${T}② にぎわいの札は高さ32px以上`, !!hb && hb.height >= 32, hb ? `${Math.round(hb.height)}px` : 'なし');
    await page.locator('[data-assistant-life-board]').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(400);
    { const d = { open: await page.locator("[data-assistant-life-diary]").count(), empty: await page.locator("[data-assistant-life-diary-empty]").count(), btn: await page.locator("[data-assistant-life-diary-watch]").count(), n: await text(page, "[data-assistant-life-diary-count]") };
      check(`${T}③ 今日あったことが空のとき、次にすることと見守るへのボタン`, d.empty === 1 && d.btn === 1, JSON.stringify(d)); }
    await page.locator('[data-assistant-life-diary-close]').click().catch(() => {}); await page.waitForTimeout(300);
    await page.locator('[data-assistant-life-today-act="call"]').click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    const pick = await text(page, '[data-assistant-life-call-picker]');
    check(`${T}④ 声をかける窓: どうなるかの1行・さみしそうな助手の印`, await page.locator('[data-assistant-life-call-hint]').count() === 1 && /さみしそう・声をかけよう/.test(pick || ""), (pick || "なし").replace(/\s+/g, " ").slice(0, 120));
    await page.locator('[data-assistant-life-call-picker] button:has-text("閉じる")').click().catch(() => {}); await page.waitForTimeout(300);
    if (await page.locator('[data-assistant-life-icon="visit"]').count()) {
      await page.locator('[data-assistant-life-icon="visit"]').click(); await page.waitForTimeout(600);
      const f = await page.evaluate(() => ({ guide: !!document.querySelector('[data-alf-empty-guide]'), boxes: ['[data-alf-now]', '[data-alf-notes]', '[data-alf-houses]'].filter(s => { const e = document.querySelector(s); return e && e.offsetParent; }).length,
        low: [...document.querySelectorAll('[data-alf-setting]')].filter(e => e.getBoundingClientRect().height < 44).length, n: document.querySelectorAll('[data-alf-setting]').length }));
      check(`${T}⑤ フレンド: 何も無いときは案内1つ・空の箱は出さない・設定の行は44px以上`, f.guide && f.boxes === 0 && f.n > 0 && f.low === 0, JSON.stringify(f));
    }
    await page.close();
    const old = await open(v, false);
    const ow = await text(old, '[data-assistant-life-today-gain="watch"]');
    check(`${T}⑥ 旧UIは今までどおり`, ow === '時間帯ごとに1回' && await old.locator('[data-assistant-life-tier-help]').count() === 0, String(ow));
    await old.close();
  }
  check('⑦ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
