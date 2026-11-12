// 助手の疲れ・ストレス・🏥病院・特別な治療の止め絵を、本物の画面で撮る(印 assistantLifeBody をページの中だけ真にする。ゲームは変えない)
//   node tools/assistant/life-body-shots.js [出力フォルダ]   → 既定 docs/progress/assistant-peer/life-places/release/
//   縦(390×844)・横(844×390)・小(320×568)ごとに:
//     1-cure   … 病院にいる回の助手(重い病気)の予定表。特別な治療のボタン
//     2-cured  … 使ったあと(すっかり治りました)
//     3-tired  … 疲れ・ストレスがたまった助手の予定表(棒・注意の文)
//     4-picker … 行き先えらび(得の1行・疲れ・ストレスの動き・🏥病院)
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..'), PORT = 9286;
const OUTDIR = path.resolve(process.argv[2] || path.join(root, 'docs/progress/assistant-peer/life-places/release'));

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので撮れません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  fs.mkdirSync(OUTDIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  const open = async (v) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2 });
    page.on('pageerror', e => errors.push(`${v.tag}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.addInitScript(() => {
      let owned = {}; try { owned = JSON.parse(localStorage.getItem('mh_owned_items')) || {}; } catch {}
      localStorage.setItem('mh_owned_items', JSON.stringify({ ...owned, life_cure: 2 }));
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeBody = true; clearInterval(t); } } catch {} }, 2);
    });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.waitForTimeout(500); await finishTalk(page);
    for (let i = 0; i < 6; i++) { const sk = page.getByRole('button', { name: /^スキップ$/ }); if (!(await sk.count())) break; await sk.first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(600); await page.getByRole('button', { name: /^(はい|スキップする|OK)$/ }).first().click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(400); }
    await toHome(page); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
    // 体の状態を入れる: きき=いま病院にいる回・重い病気/むあ=疲れ・ストレスがたまっている
    await page.evaluate(async () => {
      await ASSISTANT_LIFE_BODY_STORE.load();
      const cur = assistantLifeSlotAt().abs;
      const D = ASSISTANT_LIFE_BODY_STORE.state.data;
      const s = { ...D.s, kiki: { fat: 35, st: 40, cond: { k: 'sick', sev: 'heavy', left: 50, visits: 2 } }, mua: { fat: 66, st: 56, cond: null } };
      const log = { ...D.log, kiki: [...(D.log.kiki || []).filter(r => r.abs !== cur), { abs: cur, place: 'clinic', ev: 'clinic' }] };
      ASSISTANT_LIFE_BODY_STORE.set({ data: { ...D, at: cur, s, log } });
    });
    return page;
  };
  const shot = async (page, v, name) => { await page.waitForTimeout(500); await page.screenshot({ path: path.join(OUTDIR, `${name}-${v.tag}.png`) }); };
  const openPlan = async (page, who) => { await page.evaluate((w) => assistantLifePlanOpen({ who: w }), who); await page.locator('[data-assistant-life-plan]').waitFor({ timeout: 5000 }); };
  const scrollTo = async (page, sel) => { await page.evaluate((s) => { const el = document.querySelector(s); if (el) el.scrollIntoView({ block: 'start' }); }, sel); };
  const report = [];
  try {
    for (const v of [{ tag: 'tate', w: 390, h: 844 }, { tag: 'yoko', w: 844, h: 390 }, { tag: 'small', w: 320, h: 568 }]) {
      const page = await open(v);
      await openPlan(page, 'kiki');
      await scrollTo(page, '[data-assistant-life-body-panel]');
      const btn = page.locator('[data-assistant-life-body-cure-use]');
      const hasBtn = await btn.count();
      report.push(`${v.tag}: 治療のボタン ${hasBtn ? 'あり' : 'なし'} 「${hasBtn ? (await btn.innerText()).replace(/\s+/g, ' ') : ''}」`);
      await shot(page, v, '1-cure');
      if (hasBtn) {
        await btn.click();
        await page.locator('[data-assistant-life-body-cured]').waitFor({ timeout: 5000 }).catch(() => {});
        const ok = await page.evaluate(() => ({ cond: ASSISTANT_LIFE_BODY_STORE.state.data.s.kiki.cond, ev: ASSISTANT_LIFE_BODY_STORE.state.data.log.kiki.slice(-1)[0].ev, items: JSON.parse(localStorage.getItem('mh_owned_items') || '{}').life_cure }));
        report.push(`${v.tag}: 使ったあと けが・病気=${JSON.stringify(ok.cond)} 記録=${ok.ev} 残り=${ok.items}枚`);
        await shot(page, v, '2-cured');
      }
      await page.evaluate(() => assistantLifePlanClose());
      await openPlan(page, 'mua');
      await scrollTo(page, '[data-assistant-life-body-panel]');
      await shot(page, v, '3-tired');
      const edit = page.locator('[data-assistant-life-plan-edit]').first();
      if (await edit.count()) { await edit.click(); await scrollTo(page, '[data-assistant-life-plan-picker]'); await shot(page, v, '4-picker'); }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  for (const r of report) console.log(r);
  console.log('書き出しました:', path.relative(root, OUTDIR), errors.length ? 'エラー: ' + errors.slice(0, 3).join(' / ') : 'エラーなし');
})();
