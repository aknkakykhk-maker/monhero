// MFバトルカードで、手札を指で運ぶところ(技を相手まで・ガッツの置き場へ)を、実際のブラウザで動画に撮る(社長に見せる用)。
//   node tools/card/card-drag-video.js <出力.mp4>   iPhone 13(390×844)の大きさ。ffmpeg で mp4 にする
// 撮るもの: ゆっくり運ぶ(置けない所では光らない・置ける所で光る)→ 離すと技が出る / ガッツの置き場へ運ぶ
// ※ここから下の起動の手順は card-battle-browser-check.js と同じ(写して使う)。
//
//   node tools/card/card-battle-browser-check.js            確かめる
//   CARD_SHOT_DIR=<フォルダ> node tools/card/card-battle-browser-check.js   画面の写真も撮る(社長に見せる用)
//
// 見るもの
//   ① デバッグ設定の入口(data-debug-card-battle)から開ける。はじめてはスターター選びが出る
//   ② スターターを選ぶと、カード53枚・デッキ1つ・カードポイント300が保存される(mh_card_* の新しいキーだけ)
//   ③ もう一度開いても、スターター選びは出ない(二度と配らない)
//   ④ 相手えらび → 対戦が始まり、手札5枚・場の6体・相手の帯が出る。カードの絵が読める
//   ⑤ 自分の番を何ターンか進められる(技を出す・守る/守らない・ガッツにする)。どこでも実行時エラーが出ない
//   ⑥ 長押しで詳しい画面・捨て札の一覧が開いて閉じる
//   ⑦ 投了すると結果が出て、カードポイントは増えない・戦績に投了が1つ付く
//   ⑧ 既存の保存キー(mh_card_ 以外)を1つも書き換えていない
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
  const outFile = path.resolve(process.argv[2] || 'card-motion.mp4');
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
    await page.addInitScript(eventStorySeed());
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
    // 練習試合は飛ばして、コンピューター戦へ
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-cpu]').click();
    await page.locator('[data-card-mode-assistant]').click();
    await page.locator('[data-card-foe="momosuke"]').click();
    await page.locator('[data-card-start]').click();
    await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
    const t0 = Date.now();
    const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
    const slowCarry = async (from, via, to) => {
      await page.mouse.move(from.x, from.y); await page.mouse.down();
      await page.mouse.move(from.x, from.y - 30, { steps: 10 });
      if (via) { await page.mouse.move(via.x, via.y, { steps: 25 }); await page.waitForTimeout(500); }
      await page.mouse.move(to.x, to.y, { steps: 30 }); await page.waitForTimeout(700);
      await page.mouse.up(); await page.waitForTimeout(1400);
    };
    let attacked = false, gutsDone = false;
    while (Date.now() - t0 < 60000 && !(attacked && gutsDone)) {
      const mode = await page.locator('[data-card-battle]').getAttribute('data-card-mode');
      if (mode === 'setup') { await page.getByRole('button', { name: /始める$/ }).click(); continue; }
      if (mode === 'guard') { await page.getByRole('button', { name: '守らない' }).click(); continue; }
      if (mode === 'attack') {
        const usable = await page.locator('[data-card-hand-card]').evaluateAll((els) => els.map((e, i) => (e.className.includes('opacity-45') ? -1 : i)).filter((i) => i >= 0));
        if (!attacked && usable.length) {
          const before = await page.locator('[data-card-log]').innerText();
          await slowCarry(await center(page.locator(`[data-card-hand-card="${usable[0]}"]`)), await center(page.locator('[data-card-mon="0-1"]')), await center(page.locator('[data-card-mon="1-1"]')));
          if ((await page.locator('[data-card-log]').innerText()) !== before) { attacked = true; await page.waitForTimeout(1500); continue; }
        }
        await page.getByRole('button', { name: '攻撃おわり → ガッツへ' }).click(); continue;
      }
      if (mode === 'guts') {
        if (!gutsDone && attacked) { await slowCarry(await center(page.locator('[data-card-hand-card="0"]')), null, await center(page.locator('[data-card-guts-drop]'))); gutsDone = true; await page.waitForTimeout(600); }
        await page.getByRole('button', { name: /ターン終了$/ }).click(); continue;
      }
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(800);
    const cutFrom = (Date.now() - t0) / 1000;
    await context.close();
    const webm = fs.readdirSync(tmp).find((f) => f.endsWith('.webm'));
    // 起動から対戦の始まりまでは切って、対戦の所だけにする
    const dur = Number(require('child_process').execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(tmp, webm)]).toString().trim()) || 0;
    const start = Math.max(0, dur - cutFrom - 0.5);
    require('child_process').execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start), '-i', path.join(tmp, webm), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '28', '-preset', 'veryfast', '-an', outFile]);
    console.log(`書き出し: ${outFile}(${(fs.statSync(outFile).size / 1024).toFixed(0)}KB)`);
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
