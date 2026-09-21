const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクスバトルの「全WAVE詳細」を実ブラウザで開き、敵10体が並んだところを1枚に撮る。
//
//   node tools/mode/tactics-enemy-art-shot.js            … tools/out/tactics-enemy-art.png へ
//   node tools/mode/tactics-enemy-art-shot.js <出力先>    … 置き場所を変える
//
// 【なぜ道具にするか】
// 敵の絵を差し替えたとき、大きさが他とそろっているかは**数字だけでは決められない**。
// 56pxの枠に色が乗る面積(tools/image/enemy-art-size-report.js)は目安にしかならず、
// 細長いもの・余白の取り方・向きで見え方が変わる。実際に10体を並べて見るのがいちばん早い。
//
// 撮るだけで、合否は出さない(良し悪しは人が見て決める)。検査ではないので run-checks には入れない。
//
// 【出てきた絵の見かた】
//   ・1体だけ極端に小さい／大きい → ENEMY_ART_LAYOUT(22-enemy-and-bond-entries.jsx)の
//     scanScale / waveDetailScale で持ち上げる・下げる
//   ・輪郭が白く光っている → 背景の消し残り(ハロー)。絵を出し直してもらう
//   ・体の一部が欠けている → 透過のやり直し。こちらで抜き直さない(docs/rules/ASSETS.md)
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8986; // tactics-browser-check.js(8987)と別にして、同時に動かせるようにする
const OUT = process.argv[2] || path.join(root, 'tools/out/tactics-enemy-art.png');

const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が無いので撮れません（cd tools && npm install）'); process.exit(0); }

  const server = await serve();
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await page.addInitScript(() => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣');
      put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_masu_migrated', true);
      put('mh_inherited_unique_level_compensation_v1', true);
      put('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    // 配布物やお知らせが重なっていると先へ進めないので、出ているぶんだけ閉じる
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    // タクティクスは未公開なので、ふだんの入口ではなくデバッグのバトルモード入口から入る
    await page.getByRole('button', { name: '設定' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByRole('button', { name: 'ヘルプ' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('button', { hasText: /^💊$/ }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-debug-battle-mode]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.locator('[data-battle-systems]').first().waitFor({ timeout: 15000 });
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    // モードのカードの中の「難易度を選ぶ」から難易度選択へ。カードそのものを押しても進まない
    await page.evaluate(() => {
      const card = document.querySelector('[data-battle-mode="tactics"]');
      const b = card && [...card.querySelectorAll('button')].find(x => /難易度を選ぶ/.test(x.textContent || ''));
      if (b) b.click();
    });
    await page.waitForTimeout(1500);
    const opened = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /全WAVE/.test(x.textContent || ''));
      if (b) { b.click(); return true; }
      return false;
    });
    if (!opened) { console.log('NG: 全WAVE詳細のボタンが見つかりませんでした'); process.exit(1); }
    await page.waitForTimeout(1500);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    await page.screenshot({ path: OUT, fullPage: true });
    const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
    console.log(`OK: 撮りました — ${path.relative(root, OUT)}（${kb}KB）`);
    console.log('   10体の大きさがそろって見えるか、輪郭が白く光っていないかを目で確かめる');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})();
