#!/usr/bin/env node
// MFバトルカード: スターターをまだ受け取っていない人が、クリスマスのレイドから「バトルカードで」挑む(開幕前の点検 r1126-061・行き止まりを無くす)
//
//   node tools/card/card-raid-xmas-starter-browser-check.js
//
// 見るもの
//   ① スターターが無い人がレイドの「バトルカードで」を押すと、案内の窓に「MFバトルカードへ」(行き止まりにしない)。押すとスターター選び
//   ② スターター選びの「戻る」でレイド画面へ戻る
//   ③ もう一度押してスターターを受け取ると、練習試合ではなく「ボスに挑む」→ ボス戦のデッキえらびへ進む
//   ④ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8995;
const SHOT = process.env.SHOT_DIR || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 400)); });
    await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__cardSeeded')) return;
      sessionStorage.setItem('__cardSeeded', '1');
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await page.addInitScript(eventStorySeed()); await page.addInitScript(require('../boot/quiet-boot-seed').updateNoticeSeed()); await page.addInitScript(require('../boot/quiet-boot-seed').loginBonusDoneSeed()); await page.addInitScript(require('../boot/quiet-boot-seed').oneTimeNoticeSeed()); // みゅあの今日の助言などの一度きりの案内も済んだことにする // ログインボーナスの窓も同じく割りこむので受け取ったことにする // 更新履歴の告知の窓が後から割りこんで押せなくなるので、見たことにする(2026-11-11)
    // 決めた場面: 自分の番・攻撃の段。自分の先頭の子の、文の無いちから技と影縛り。相手は緊急回避だけ
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    // デバッグ設定から MFバトルカードへ。はじめてなのでスターターを選び、練習試合は飛ばす
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.locator('[data-mh-help]').waitFor({ timeout: 20000 });
    await page.locator('footer button[aria-label=""]').dispatchEvent('click');
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    const toRaid = async () => {
      await page.locator('summary').filter({ hasText: 'チュートリアルと旧画面' }).first().dispatchEvent('click');
      await page.locator('[data-debug-raid-jack]').dispatchEvent('click');
      await page.locator('[data-raid-xmas-open]').click();
      await page.locator('[data-raid-challenge-card]').first().waitFor({ timeout: 20000 });
    };
    await toRaid();
    // ① 案内の窓(行き止まりでない)→「MFバトルカードへ」でスターター選び
    const goStarter = async () => {
      await page.locator('[data-raid-challenge-card]').first().click();
      await page.locator('[data-xmas-event-notice]').waitFor({ timeout: 20000 });
      return page.locator('[data-xmas-event-notice]').innerText();
    };
    const note = await goStarter();
    check('① 案内の窓に「MFバトルカードへ」がある・「HOME」と書かない', (await page.locator('[data-xmas-event-notice-go]').count()) === 1 && !/HOME/.test(note), note.replace(/\s+/g, ' ').slice(0, 90));
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'xmas-starter-notice.png') }); }
    await page.locator('[data-xmas-event-notice-go]').click();
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    check('① 「MFバトルカードへ」でスターター選びが開く', true);
    // ② 戻るとレイド画面
    await page.getByRole('button', { name: '戻る' }).first().click();
    await page.locator('[data-raid-challenge-card]').first().waitFor({ timeout: 20000 });
    check('② スターター選びの「戻る」でレイド画面へ', (await page.locator('[data-card-top="starter"]').count()) === 0);
    // ③ 受け取ると、ボス戦のデッキえらび
    await goStarter();
    await page.locator('[data-xmas-event-notice-go]').click();
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await page.locator('[data-card-pack-open]').waitFor({ timeout: 10000 });
    const label = await page.evaluate(() => document.body.innerText);
    await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page);
    await page.locator('[data-card-deck-pick-go]').waitFor({ timeout: 20000 }).catch(() => {});
    check('③ 受け取ると、練習試合ではなくボス戦のデッキえらびへ', (await page.locator('[data-card-deck-pick-go]').count()) === 1 && (await page.locator('[data-card-tutor]').count()) === 0 && /レイドのボス/.test(await page.locator('[data-mh-screen]').first().innerText()));
    check('④ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('途中で止まらない', false, String(e && e.message || e).slice(0, 300));
    console.log('  エラー:', errors.slice(0, 3).join(' / ').slice(0, 600));
    try { const pg = (await browser.contexts())[0].pages()[0]; console.log('  いまの画面:', await pg.evaluate(() => [...document.querySelectorAll('[data-card-top],[data-mh-screen]')].map((x) => x.getAttribute('data-card-top') || x.tagName).join(',') + ' / ' + document.body.innerText.slice(0, 200).replace(/\s+/g, ' '))); if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await pg.screenshot({ path: path.join(SHOT, 'raid-stuck.png') }); } } catch (_) { /* 撮れなくてもよい */ }
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
  console.log(failed ? `NG ${failed} 件` : 'OK: スターターの無い人がレイドからカードで挑む(ブラウザ)');
  process.exit(failed ? 1 : 0);
})();
