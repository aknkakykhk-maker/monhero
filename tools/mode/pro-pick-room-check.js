// プロモードの編成(勇者モンを選択・ProPartyPicker)で、モンスターの一覧が何段見えるかを実ブラウザで測る
// (2026-10-22 社長「プロモードの初期選択でモンスター選びの枠が狭すぎる」)。
//
//   node tools/mode/pro-pick-room-check.js            幅390で、高さ 844・740・667 を測る(幅320×568 も)
//   SHOT_DIR=<フォルダ> を付けると、それぞれの写真を残す
//
//   ① 一覧(data-pro-pick-scroll)の見える高さが、モンスターの段の何段ぶんあるか
//      390×844 は 3段以上、390×740 は 2.5段以上、390×667・320×568 は 2段以上
//   ② 下の詳しいパネルで「枠に入れる」のボタンが押せる(画面に収まっている)
//   ③ ページが横にはみ出さない・実行時エラーが無い
//   ④ 詳しいパネルをたたむと一覧が広がり、「枠に入れる」は残る
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8931;
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const SIZES = [[390, 844, 3], [390, 740, 2.5], [390, 667, 2], [320, 568, 2]];
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const [W, H, need] of SIZES) {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
      });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
      for (let i = 0; i < 6; i += 1) {
        const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
        if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
        await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250);
      }
      await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click', {}, { timeout: 15000 });
      await page.waitForTimeout(600);
      await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
      await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
      await page.evaluate(() => { const cards = [...document.querySelectorAll('[data-battle-mode="tacticsPro"]')]; const card = cards[Math.floor(cards.length / 2)] || cards[0];
        const b = card && [...card.querySelectorAll('button')].find((x) => x.textContent.includes('難易度を選ぶ')); if (b && !b.disabled) b.click(); });
      await page.waitForTimeout(1200);
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('この難易度で挑戦') && !x.disabled); if (b) b.click(); });
      await page.locator('[data-pro-party]').waitFor({ timeout: 15000 });
      await page.waitForTimeout(2000); // 入場の「SELECT HERO」の演出が消えるのを待つ
      const m = await page.evaluate(() => {
        const sc = document.querySelector('[data-pro-pick-scroll]');
        const tile = sc && sc.querySelector('button[aria-label$="を見る"]');
        const tiles = sc ? [...sc.querySelectorAll('button[aria-label$="を見る"]')] : [];
        const tops = [...new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().top)))].sort((a, b) => a - b);
        const rowPitch = tops.length > 1 ? tops[1] - tops[0] : (tile ? tile.getBoundingClientRect().height : 0);
        const r = sc ? sc.getBoundingClientRect() : { height: 0 };
        const put = [...document.querySelectorAll('[data-pro-pick-detail] button')].find((b) => /枠に入れる|枠から外す|枠がいっぱい/.test(b.textContent));
        const pr = put ? put.getBoundingClientRect() : null;
        return { rows: rowPitch ? r.height / rowPitch : 0, scrollH: Math.round(r.height), rowPitch: Math.round(rowPitch), putOk: !!pr && pr.bottom <= innerHeight + 1 && pr.top >= 0, wide: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      check(`① ${W}×${H}: 一覧が ${need}段以上見える`, m.rows >= need, `${m.rows.toFixed(2)}段(見える高さ ${m.scrollH}px・1段 ${m.rowPitch}px)`);
      check(`② ${W}×${H}: 「枠に入れる」が画面に収まっている`, m.putOk);
      check(`③ ${W}×${H}: 横にはみ出さない・実行時エラーなし`, !m.wide && errors.length === 0, errors.slice(0, 2).join(' / '));
      if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `pro-pick-${W}x${H}.png`) }); }
      // ④ 下の詳しいパネルをたたむと、一覧がもっと広がる(ボタンは残る。高さ640以下は元から詳しい行を隠しているので、広がるのは絵のぶんだけ)
      await page.locator('[data-pro-pick-fold]').dispatchEvent('click');
      await page.waitForTimeout(300);
      const f = await page.evaluate(() => {
        const sc = document.querySelector('[data-pro-pick-scroll]');
        const put = [...document.querySelectorAll('[data-pro-pick-detail] button')].find((b) => /枠に入れる|枠から外す|枠がいっぱい/.test(b.textContent));
        return { scrollH: Math.round(sc.getBoundingClientRect().height), put: !!put, stats: !!document.querySelector('[data-pro-pick-stats]') };
      });
      check(`④ ${W}×${H}: たたむと一覧が広がり、「枠に入れる」は残る`, f.scrollH > m.scrollH + (H <= 640 ? 0 : 30) && f.put && !f.stats, `${m.scrollH}px → ${f.scrollH}px`);
      if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `pro-pick-${W}x${H}-folded.png`) });
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
