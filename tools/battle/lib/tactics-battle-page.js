// タクティクスバトル(プロ・新画面)を実際のブラウザで開くところまでを1つにまとめたもの。
// battle-perf-budget-check.js と battle-live-frame-report.js が使う(同じ道筋で開けば、数字を比べられる)。
// 道筋は card-drag-perf.js と同じ(ふだんの入口 → タクティクス → プロ → 難易度 → 編成 → WAVE 1/10)。
const http = require('http');
const path = require('path');
const fs = require('fs');

const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon', '.mp4':'video/mp4' };

const serve = (root, port) => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(port, () => resolve(server));
});

const loadPlaywright = () => {
  for (const name of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(name); } catch { /* 次を試す */ }
  }
  return null;
};

// storage … 最初から入れておく保存値({ キー: 値 })。値は文字列ならそのまま、それ以外は JSON にする
async function openTacticsBattle({ root, port, storage = {}, mobile = true } = {}) {
  const playwright = loadPlaywright();
  if (!playwright) return { skip: 'playwright が入っていないので確かめられません' };
  const server = await serve(root, port);
  const errors = [];
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }
    : { viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const base = {
    mh_breeder_name: JSON.stringify('検査ブリーダー'), mh_breeder_icon: JSON.stringify('🐣'),
    mh_onboarded: 'true', mh_tutorial_seen_v1: 'true', mh_battle_tutorial_seen_v1: 'true',
    mh_battle_tutorial_guide_shown_v1: 'true', mh_masu_migrated: 'true',
    mh_inherited_unique_level_compensation_v1: 'true', mh_inherited_unique_level_compensation_pending_v1: 'false',
  };
  const all = { ...base };
  for (const [k, v] of Object.entries(storage)) all[k] = typeof v === 'string' ? v : JSON.stringify(v);
  await page.addInitScript((pairs) => { for (const [k, v] of Object.entries(pairs)) localStorage.setItem(k, v); }, all);
  const close = async () => { try { await browser.close(); } catch {} server.close(); };
  try {
    await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i += 1) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[data-battle-mode="tacticsPro"]')];
      const card = cards[Math.floor(cards.length / 2)] || cards[0];
      const b = card && [...card.querySelectorAll('button')].find((x) => x.textContent.includes('難易度を選ぶ'));
      if (b && !b.disabled) b.click();
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('この難易度で挑戦') && !x.disabled);
      if (b) b.click();
    });
    await page.waitForTimeout(1500);
    // ★押すものは「その画面にしか無いもの」で選ぶ(とりあえず押せるものを押すと、戻るを踏む)
    await page.evaluate(() => { window.__pick = 0; window.__change = 1; });
    for (let i = 0; i < 40; i += 1) {
      if (await page.evaluate(() => /WAVE 1\/10/.test(document.body.innerText))) break;
      const step = await page.evaluate(() => {
        const live = [...document.querySelectorAll('button')].filter((x) => x.offsetParent && !x.disabled);
        const pick = (re) => live.find((x) => re.test(x.textContent.trim()));
        const go = pick(/出撃|バトル開始|この編成で|はじめる|^決定$|^確定$/); if (go) { go.click(); return 'go'; }
        const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
        const teaching = pick(/新規習得|強化後/); if (teaching) { teaching.click(); return 'teach'; }
        const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
        const mons = live.filter((x) => /ライフ\s*\d+ちから|総合力/.test(x.textContent) && x.textContent.trim() !== '詳細を見る');
        if (mons.length) { const m = mons[Math.min(window.__pick, mons.length - 1)]; window.__pick += 1; m.click(); return 'mon'; }
        const changes = live.filter((x) => x.textContent.trim() === '変更');
        if (changes.length) { const c = changes[Math.min(window.__change, changes.length - 1)]; window.__change += 1; c.click(); return 'change'; }
        return null;
      });
      if (!step) break;
      await page.waitForTimeout(1000);
    }
    const inBattle = await page.evaluate(() => /WAVE 1\/10/.test(document.body.innerText) && !!document.querySelector('[data-tactics-look]'));
    return { browser, ctx, page, errors, inBattle, close };
  } catch (e) {
    await close();
    throw e;
  }
}

module.exports = { openTacticsBattle };
