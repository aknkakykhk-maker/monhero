// MFバトルカードの「技の動きの見本」(デバッグ設定 → MFバトルカード → 技の動きの見本を流す)を、実際のブラウザで動画に撮る(社長に見せる用)。
//   node tools/card/card-motion-video.js <出力.mp4>   iPhone 13(390×844)の大きさ。ffmpeg で mp4 にする
// 撮るもの: 同じ名前の技(スエゾーのかみつき)・名前から決めた技(ガリの雷)・全体攻撃(ゴーレムの竜巻アタック)・よける・防ぐ・KO
// ※起動の手順は card-motion-video.js と同じ(写して使う)
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8996;
const SHOT = process.env.CARD_SHOT_DIR || '';
// 画面の大きさ(既定は iPhone 13 の 390×844。SE は CARD_VIEWPORT=375x667)
const [VW, VH] = (process.env.CARD_VIEWPORT || '390x844').split('x').map(Number);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

(async () => {
  const outDir = path.resolve(process.argv[2] || '.');
  fs.mkdirSync(outDir, { recursive: true });
  const playwright = require('playwright');
  const server = await serve();
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'card-video-'));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: tmp, size: { width: 390, height: 844 } } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__cardSeeded')) return;
      sessionStorage.setItem('__cardSeeded', '1');
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    // ここまでの保存(既存のキー)を控える。カードバトルが書くのは mh_card_* だけのはず
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])));
    const openCard = async () => {
      await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
      await page.locator('footer button[aria-label=""]').dispatchEvent('click');
      await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
      await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
      await page.locator('[data-debug-card-battle]').dispatchEvent('click');
    };
    await openCard();
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    // スターターを選ぶと練習試合が始まるので、飛ばしてトップへ
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    // ① パックの絵の見本(5つ並べた写真)
    await page.locator('[data-card-pack-art-demo]').click();
    await page.locator('[data-card-pack-art="hybrid"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: 'div[style*="2147483647"] > span { display:none !important }' });
    await page.screenshot({ path: path.join(outDir, 'pack-art.jpg'), quality: 85, fullPage: false });
    await page.locator('[data-card-pack-art-list] header button, [data-card-pack-art-list] button').first().click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    // ② パックを開ける見本(動画)。ここからの時間を控えて、前の部分は切る
    const t0 = Date.now();
    await page.locator('[data-card-pack-open-demo]').click();
    await page.locator('[data-card-pack-tear]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.locator('[data-card-pack-tear]').dispatchEvent('click');
    await page.locator('[data-card-pack-card="0"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1600);
    for (let i = 0; i < 8; i++) {
      await page.locator(`[data-card-pack-card="${i}"]`).dispatchEvent('click');
      await page.waitForTimeout(i === 7 ? 2600 : 650);
    }
    await page.locator('[data-card-pack-next]').dispatchEvent('click');
    await page.waitForTimeout(1500);
    await page.locator('[data-card-pack-tear]').dispatchEvent('click');
    await page.waitForTimeout(2400);
    await page.locator('[data-card-pack-flip-all]').dispatchEvent('click');
    await page.waitForTimeout(3800);
    const len = (Date.now() - t0) / 1000;
    await context.close();
    const webm = fs.readdirSync(tmp).find((f) => f.endsWith('.webm'));
    const dur = Number(require('child_process').execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(tmp, webm)]).toString().trim()) || 0;
    const start = Math.max(0, dur - len - 0.3);
    const outFile = path.join(outDir, 'pack-open.mp4');
    require('child_process').execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start), '-i', path.join(tmp, webm), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '28', '-preset', 'veryfast', '-movflags', '+faststart', outFile]);
    console.log(`書き出し: ${outDir}/pack-art.jpg ・ ${outFile}(${(fs.statSync(outFile).size / 1024).toFixed(0)}KB)`);
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
