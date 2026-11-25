#!/usr/bin/env node
// MFバトルカード: クリスマスのレイドの「バトルカードで挑む」を、レイド画面から実際のブラウザで通す(r1119-172・BUILD.md §4)
//
//   node tools/card/card-raid-xmas-browser-check.js   (SHOT_DIR=<フォルダ> で止め絵も撮る)
//
// 見るもの
//   ① デバッグのジャック確認から、クリスマスのレイド画面を開くと「バトルカードで」の挑み方が出る
//   ② 押すと MFバトルカードのデッキえらび(レイドの説明)→ 対戦。相手の帯はボス(レイドバトル)
//   ③ 投了すると、カードの「レイドバトルの結果」(デバッグの試しではないので送る側の文)
//   ④ 「レイドへ戻る」で、レイドの結果画面(バトルカードの挑み方)が出る / ⑤ もう一度 MFバトルカードを開いても、ボス戦が勝手に始まらない / ⑥ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8994;
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
    await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().dispatchEvent('click');
    await page.locator('[data-debug-card-battle]').dispatchEvent('click');
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    // ① レイド画面へ(カードのトップの「戻る」→ デバッグ → ジャック確認 → クリスマス)
    await page.getByRole('button', { name: '戻る' }).first().click();
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    await page.locator('summary').filter({ hasText: 'チュートリアルと旧画面' }).first().dispatchEvent('click');
    await page.locator('[data-debug-raid-jack]').dispatchEvent('click');
    await page.locator('[data-raid-xmas-open]').click();
    await page.locator('[data-raid-challenge-card]').first().waitFor({ timeout: 20000 });
    check('① クリスマスのレイド画面に「バトルカードで」が出る', (await page.locator('[data-raid-challenge-card]').count()) >= 1);
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'xmas-raid-ways.png') }); }
    // ② デッキえらび → 対戦
    await page.locator('[data-raid-challenge-card]').first().click();
    await page.locator('[data-card-deck-pick-go]').waitFor({ timeout: 20000 });
    check('② デッキえらびにレイドの説明', /レイドのボス/.test(await page.locator('[data-mh-screen]').first().innerText()));
    await page.locator('[data-card-deck-pick-go]').click();
    await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(600);
    check('② 相手の帯はボス・レイドバトル', (await page.locator('[data-card-raid-foe]').count()) === 1 && /レイドバトル/.test(await page.locator('[data-card-battle]').innerText()));
    // ③ 投了 → カードの結果
    await page.waitForFunction(() => document.querySelector('[data-card-quit]'), null, { timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '投了する' }).click();
    await page.locator('[data-card-raid-result]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => !/送っています/.test((document.querySelector('[data-card-raid-sent]') || {}).innerText || ''), null, { timeout: 15000 });
    const sent = await page.locator('[data-card-raid-sent]').innerText();
    check('③ レイドから来た挑戦は送る側の文(デバッグの試しの文ではない)', !/送っていません/.test(sent), sent);
    if (SHOT) await page.screenshot({ path: path.join(SHOT, 'xmas-card-result.png') });
    // ④ 戻ると、レイドの結果画面
    await page.locator('[data-card-raid-close]').click();
    await page.locator('[data-raid-jack-result]').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    const txt = await page.locator('[data-raid-jack-result]').first().innerText();
    check('④ レイドの結果画面(バトルカードの挑み方)が出る', /バトルカード|途中でやめた/.test(txt) && !(await page.locator('[data-card-raid-result]').count()), txt.slice(0, 80).replace(/\s+/g, ' '));
    if (SHOT) await page.screenshot({ path: path.join(SHOT, 'xmas-raid-result.png') });
    // ⑤ レイドの結果を閉じて HOME → デバッグから MFバトルカードを開き直しても、ボス戦が勝手に始まらない
    await page.locator('[data-raid-jack-result]').first().getByRole('button', { name: '戻る' }).click();
    await page.waitForTimeout(800);
    await page.getByRole('button', { name: '戻る' }).first().click().catch(() => {});
    await page.waitForTimeout(800);
    const debugOpen = await page.getByText('DEBUG MENU').first().isVisible().catch(() => false);
    if (!debugOpen) {
      await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
      await page.locator('[data-mh-help]').waitFor({ timeout: 20000 });
      await page.locator('footer button[aria-label=""]').dispatchEvent('click');
      await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    }
    await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().dispatchEvent('click');
    await page.locator('[data-debug-card-battle]').dispatchEvent('click');
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    check('⑤ 開き直してもボス戦のデッキえらびにならない', (await page.locator('[data-card-deck-pick-go]').count()) === 0 && (await page.locator('[data-card-top="top"]').count()) === 1);
    check('⑥ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('途中で止まらない', false, String(e && e.message || e).slice(0, 300));
    console.log('  エラー:', errors.slice(0, 3).join(' / ').slice(0, 600));
    try { const pg = (await browser.contexts())[0].pages()[0]; console.log('  いまの画面:', await pg.evaluate(() => [...document.querySelectorAll('[data-card-top],[data-mh-screen]')].map((x) => x.getAttribute('data-card-top') || x.tagName).join(',') + ' / ' + document.body.innerText.slice(0, 200).replace(/\s+/g, ' '))); if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await pg.screenshot({ path: path.join(SHOT, 'raid-stuck.png') }); } } catch (_) { /* 撮れなくてもよい */ }
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
  console.log(failed ? `NG ${failed} 件` : 'OK: クリスマスのレイドからカードで挑む(ブラウザ)');
  process.exit(failed ? 1 : 0);
})();
