const http = require('http');
const path = require('path');
const fs = require('fs');

// イベントの「閉幕とお礼」は終了の時刻に自動で流れる。既読にしておかないと会話で止まる
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8997;
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

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };


// クリスマスのレイド(r1119-172・BUILD.md §4)の「モンヒロビートで挑む」を実際のブラウザで確かめる(デバッグの強制表示・送り先はデバッグ用の id)。
//   node tools/mode/raid-xmas-rhythm-browser-check.js
//   ① デバッグ画面の「クリスマスのレイド画面を開く」→ レイド画面に「モンヒロビート」の挑戦ボタンが出る(startRaidXmasRhythm を App に置いたので)
//   ② 押すと曲えらびが開き、帯は 🎄 とクリスマスの段階の名前(ジャックの名前は出ない)。戻るでレイド画面へ
//   ③ 曲を決めて演奏 → 途中でやめると、クリスマスのレイドの結果(途中でやめた・ダメージ0)
//   ④ ジャックの端末の記録(mh_raid_jack_v1)には書かない・実行時エラーが出ない
(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  const SHOT = process.env.RAID_SHOT_DIR || '';
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.clock.install({ time: new Date('2026-11-25T12:00:00+09:00') });
    await page.clock.resume();
    await page.addInitScript(() => {
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_rhythm_tutorial_seen_v1', true); s('mh_battle_tutorial_seen_v1', true); s('mh_rhythm_hell_story_seen_v1', true);
      s('mh_battle_tutorial_guide_shown_v1', true); s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
      s('mh_rhythm_event_points_v1', 250);
    });
    await page.addInitScript(eventStorySeed());
    const posts = [];
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.route('**/rest/v1/**', async (route) => {
      const req = route.request();
      if (/raid_jack_/.test(req.url()) && req.method() === 'POST') { posts.push(req.postData()); await route.fulfill({ status: 201, body: '' }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: '[]' });
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.locator('[data-mh-help]').waitFor({ timeout: 20000 });
    await page.locator('footer button[aria-label=""]').dispatchEvent('click');
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
    await page.locator('[data-debug-raid-jack]').dispatchEvent('click');
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });

    // ④ の基準: 起動のあと・挑戦の前のジャックの端末の記録
    const jackBefore = await page.evaluate(() => localStorage.getItem('mh_raid_jack_v1'));
    // ①
    await page.locator('[data-raid-xmas-open]').click();
    await page.locator('[data-raid-jack-screen]').waitFor({ timeout: 30000 });
    for (let i = 0; i < 20; i++) {
      const next = page.locator('[data-raid-jack-screen] button:has-text("分かった"), button:has-text("閉じる")').filter({ visible: true }).first();
      if (await next.count() === 0) break;
      await next.click({ timeout: 3000, force: true }).catch(() => {});
      await page.waitForTimeout(200);
    }
    if (SHOT) await page.screenshot({ path: `${SHOT}/xmas-raid.png` });
    check('① クリスマスのレイド画面に「モンヒロビート」の挑戦ボタンが出る', (await page.locator('[data-raid-jack-challenge-rhythm]').count()) >= 1);

    // ②
    await page.locator('[data-raid-jack-challenge-rhythm]').first().click();
    await page.locator('[data-raid-challenge-banner]').waitFor({ timeout: 30000 });
    const banner = await page.locator('[data-raid-challenge-banner]').innerText();
    if (SHOT) await page.screenshot({ path: `${SHOT}/xmas-rhythm-select.png` });
    check('② 曲えらびの帯は 🎄 とクリスマスの段階の名前(ジャックの名前・🎃 は出ない)', /🎄/.test(banner) && !/🎃|ジャック/.test(banner) && /挑戦回数を1回使います/.test(banner), banner.replace(/\s+/g, ' ').slice(0, 90));
    await page.locator('[data-rhythm-song-select-back]').click();
    await page.locator('[data-raid-jack-screen]').waitFor({ timeout: 30000 });
    check('② 曲えらびの戻るで、クリスマスのレイド画面へ戻る', (await page.locator('[data-raid-jack-challenge-rhythm]').count()) >= 1 && !/カボチャの大王ジャック/.test(await page.locator('[data-raid-jack-screen]').innerText()));

    // ③
    await page.locator('[data-raid-jack-challenge-rhythm]').first().click();
    await page.locator('[data-raid-challenge-banner]').waitFor({ timeout: 30000 });
    await page.locator('[data-rhythm-demo-start]').first().click();
    await page.locator('[data-rhythm-tap-test]').waitFor({ timeout: 30000 });
    check('③ 曲を決めると演奏が始まる(回数の口 raidXmasUseTry を通った)', true);
    await page.waitForTimeout(7000);
    if (SHOT) await page.screenshot({ path: `${SHOT}/xmas-rhythm-play.png` });
    await page.locator('[data-rhythm-pause]').first().dispatchEvent('click');
    await page.locator('[data-rhythm-pause-exit]').waitFor({ timeout: 30000 });
    await page.locator('[data-rhythm-pause-exit]').dispatchEvent('click');
    await page.locator('[data-raid-jack-result]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(3200);
    const resultText = await page.locator('[data-raid-jack-result]').innerText();
    if (SHOT) await page.screenshot({ path: `${SHOT}/xmas-rhythm-result.png` });
    check('③ 途中でやめると、レイドの結果に「途中でやめた」が出る(ジャックの名前は出ない)', /途中でやめた/.test(resultText) && !/ジャック/.test(resultText), resultText.replace(/\s+/g, ' ').slice(0, 90));
    check('③ 途中でやめたときのダメージは0・何も送らない', (await page.locator('[data-raid-jack-damage]').innerText()).trim() === '0' && posts.length === 0, String(posts.length));

    // ④
    check('④ ジャックの端末の記録(mh_raid_jack_v1)は触らない', (await page.evaluate(() => localStorage.getItem('mh_raid_jack_v1'))) === jackBefore);
    check('④ 画面が横にはみ出さない', await page.evaluate(() => document.documentElement.scrollWidth <= 391));
    check('④ 実行時エラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('通しで動く', false, String(e && e.message || e).slice(0, 200));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
