// MFバトルカード: 場の立ち絵の待機の動き(2026-10-31 社長「バトルカードも待機モーションほしい」・案A 種族ごとの動き)を、実際のブラウザで確かめる。
//   node tools/card/card-idle-motion-browser-check.js
// 見るもの(技の動きの見本を流し終えて、止まっている場面で)
//   ① 倒れていない子の立ち絵に待機の動き(data-card-idle・.mon-idle--<動き>)が付き、CSS の動きが流れている
//   ② 種族ごとに動きが分かれる(スエゾーは hop・ゴーレムは heavy など、味方の待機アニメと同じ)
//   ③ 子ごとに速さと始まりがずれている(3体がそろって動かない)
//   ④ 倒れた子には付かない
//   ⑤ 端末の「動きを減らす」では動きが止まる(絵はそのまま見える)
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8997;
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
  const playwright = require('playwright');
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, });
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
    await page.waitForTimeout(1500);
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
    await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
    // スターターを選ぶと練習試合が始まるので、飛ばしてトップへ
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    const fails = [];
    const ok = (cond, msg) => { if (!cond) fails.push(msg); };
    await page.locator('[data-card-motion-demo]').click();
    await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => /1枚引いた/.test(document.querySelector('[data-card-log]')?.textContent || ''), null, { timeout: 45000 }).catch(() => {});
    await page.waitForTimeout(2200);
    const read = () => page.evaluate(() => [...document.querySelectorAll('[data-card-mon]')].map((el) => {
      const idle = el.querySelector('[data-card-idle]');
      const cs = idle ? getComputedStyle(idle) : null;
      return { slot: el.getAttribute('data-card-mon'), name: el.querySelector('.mh-card-flip-face')?.getAttribute('alt') || '', ko: !!el.querySelector('[data-card-pose="ko"]'),
        idle: idle ? idle.getAttribute('data-card-idle') : null, anim: cs ? cs.animationName : null, dur: cs ? cs.animationDuration : null, delay: cs ? cs.animationDelay : null };
    }));
    const rows = await read();
    const live = rows.filter((r) => !r.ko);
    ok(live.length >= 3, `倒れていない子が少ない(${live.length})`);
    live.forEach((r) => ok(r.idle && r.anim && r.anim !== 'none', `① ${r.slot} ${r.name} に待機の動きが無い(${r.idle} / ${r.anim})`));
    const by = Object.fromEntries(live.map((r) => [r.name, r.idle]));
    if (by['スエゾー']) ok(by['スエゾー'] === 'hop', `② スエゾーが hop でない(${by['スエゾー']})`);
    if (by['ゴーレム']) ok(by['ゴーレム'] === 'heavy', `② ゴーレムが heavy でない(${by['ゴーレム']})`);
    ok(new Set(live.map((r) => r.idle)).size >= 2, `② 動きが種族で分かれていない(${live.map((r) => r.idle).join(',')})`);
    const mine = live.filter((r) => r.slot.startsWith('0-'));
    ok(new Set(mine.map((r) => `${r.dur}|${r.delay}`)).size === mine.length, `③ 自分の場の子の速さ・始まりがそろっている(${mine.map((r) => `${r.dur}/${r.delay}`).join(' ')})`);
    rows.filter((r) => r.ko).forEach((r) => ok(!r.idle, `④ 倒れた ${r.slot} に待機の動きが付いている`));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForTimeout(300);
    const calm = await read();
    calm.filter((r) => r.idle).forEach((r) => ok(r.anim === 'none', `⑤ 動きを減らす設定で ${r.slot} が止まらない(${r.anim})`));
    console.log(`待機の動き: ${live.map((r) => `${r.name}=${r.idle}`).join(' / ')}`);
    if (fails.length) { console.error(`NG ${fails.length}件\n` + fails.map((f) => `  ✗ ${f}`).join('\n')); process.exitCode = 1; }
    else console.log('すべてOK');
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
