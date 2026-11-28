#!/usr/bin/env node
// MFバトルカード: レイドのボスと戦う(クリスマスイベント 2026・台帳 r1119-172)を、実際のブラウザで通す
//
//   node tools/card/card-raid-browser-check.js   (SHOT_DIR=<フォルダ> で止め絵も撮る)
//
// 見るもの
//   ① デバッグから開いたトップに、ボスと戦う試し(段階1〜5)が出る
//   ② デッキ選び → 対戦。相手の帯がボス(🎅・レイドバトル)で、ボスのライフに倍率が入っている
//   ③ 投了すると、レイドバトルの結果(与ダメージ・レイドへのダメージ)が出る。デバッグの試しは送らない
//   ④ 「レイドへ戻る」で閉じる / ⑤ 助手と対戦の記録に数えない・mh_card_* 以外の保存を書き換えない / ⑥ 実行時エラーが無い
//   ⑦ 挑むたびにボスの3体が変わる(ハム種2体+ほか1体)。VS と対戦中の相手のアイコンがボスの絵(RAID_XMAS_BOSS_IMG)
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8993;
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
    const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_') && !k.startsWith('mh_card_')).map((k) => [k, localStorage.getItem(k)])));
    // ① デバッグの「ボス1〜5」が出る
    check('① デバッグにボスと戦う試しのボタンが5つ', (await page.locator('[data-card-raid-debug-tier]').count()) === 5);
    await page.locator('[data-card-raid-debug-tier="3"]').click();
    // ② デッキ選び → 対戦(VS を通す)
    await page.locator('[data-card-deck-pick-go]').waitFor({ timeout: 10000 });
    check('② デッキ選びにレイドの説明が出る', /レイドのボス/.test(await page.locator('[data-mh-screen]').first().innerText()));
    await page.locator('[data-card-deck-pick-go]').click();
    // VS の画面: 相手のアイコンがボスの絵(顔の所)。空の人の形(CardPvpAvatar)ではない(台帳 r1126-101)
    await page.locator('[data-card-vs-raid-boss]').waitFor({ timeout: 20000 }).catch(() => {});
    const vsFace = await page.locator('[data-card-vs-raid-boss] [data-card-raid-boss-face]').getAttribute('data-card-raid-boss-face').catch(() => '');
    check('② VS の画面の相手のアイコンがボスの絵', /santa-black/.test(vsFace || ''), vsFace || 'なし');
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.waitForTimeout(700); await page.screenshot({ path: path.join(SHOT, 'raid-vs.png') }); }
    await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(600);
    check('② 相手の帯にボスの印とレイドバトル', (await page.locator('[data-card-raid-foe]').count()) === 1 && /レイドバトル/.test(await page.locator('[data-card-battle]').innerText()));
    check('② 対戦中の左上のアイコンがボスの絵', /santa-black/.test((await page.locator('[data-card-raid-foe] [data-card-raid-boss-face]').getAttribute('data-card-raid-boss-face').catch(() => '')) || ''));
    const foeLife = await page.evaluate(() => [...document.querySelectorAll('[data-card-mon^="1-"]')].map((e) => { const m = e.innerText.match(/(\d+)\s*\/\s*(\d+)/); return m ? Number(m[2]) : null; }));
    check('② ボスのライフに倍率が入っている(段階4は3倍)', foeLife.length === 3 && foeLife.every((n) => n === null || n >= 12), JSON.stringify(foeLife));
    if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, 'raid-board.png') }); }
    // ③ 投了 → 結果の画面(与ダメージ 0 / ライフの合計・送っていない)
    await page.waitForFunction(() => document.querySelector('[data-card-quit]'), null, { timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    check('③ 投了の窓にレイドの説明', /レイドに入ります/.test(await page.locator('[data-confirm-sheet]').locator('xpath=..').innerText()));
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '投了する' }).click();
    await page.locator('[data-card-raid-result]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => !/送っています/.test((document.querySelector('[data-card-raid-sent]') || {}).innerText || ''), null, { timeout: 10000 });
    const dealt = await page.locator('[data-card-raid-dealt]').innerText();
    const dmg = await page.locator('[data-card-raid-damage]').innerText();
    check('③ 結果の画面に与ダメージとレイドへのダメージ', /^\d+ \/ \d+$/.test(dealt.trim()) && /^[\d,]+$/.test(dmg.trim()), `${dealt} / ${dmg}`);
    check('③ デバッグの試しはレイドへ送らない', /送っていません/.test(await page.locator('[data-card-raid-sent]').innerText()));
    if (SHOT) await page.screenshot({ path: path.join(SHOT, 'raid-result.png') });
    // ④ 戻るとトップ
    await page.locator('[data-card-raid-close]').click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 10000 });
    check('④ 「レイドへ戻る」で閉じる(デバッグはトップへ)', true);
    // ⑤ 助手の記録に数えない・mh_card_* 以外の保存を書き換えない
    const rec = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_card_record_v1')); } catch { return null; } });
    check('⑤ 助手と対戦の記録に投了を数えない', !rec || !rec.cpu || !(rec.cpu.surrender > 0), JSON.stringify(rec && rec.cpu));
    const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_') && !k.startsWith('mh_card_')).map((k) => [k, localStorage.getItem(k)])));
    const volatile = /^mh_(debug_|last_|play_|session|boot|reload|device|playtime|visit|bgm_|se_|audio|login|daily_|mission|update|seen_build|build|assistant_peer|screen_trail)/;
    const changed = Object.keys(before).filter((k) => !volatile.test(k) && before[k] !== after[k]);
    check('⑤ mh_card_* 以外の保存を書き換えない', changed.length === 0, changed.join(','));
    // ⑦ 挑むたびにボスの3体が変わる(ハム種2体+ほか1体・台帳 r1126-101 追記1)。SHOT_DIR のときは VS を撮る
    const combos = [];
    for (let k = 0; k < (SHOT ? 5 : 3); k++) {
      await page.locator('[data-card-raid-debug-tier="1"]').click();
      await page.locator('[data-card-deck-pick-go]').waitFor({ timeout: 10000 });
      await page.locator('[data-card-deck-pick-go]').click();
      await page.locator('[data-card-vs-raid-boss]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(500);
      if (SHOT) await page.screenshot({ path: path.join(SHOT, `raid-vs-${k + 1}.png`) });
      await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
      await page.waitForTimeout(400);
      combos.push((await page.evaluate(() => [...document.querySelectorAll('[data-card-mon^="1-"]')].map((e) => (e.innerText.split('\n')[0] || '').trim()).join('・'))));
      if (SHOT) await page.screenshot({ path: path.join(SHOT, `raid-board-${k + 1}.png`) });
      await page.locator('[data-card-quit]').click();
      await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '投了する' }).click();
      await page.locator('[data-card-raid-result]').waitFor({ timeout: 20000 });
      await page.locator('[data-card-raid-close]').click();
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 10000 });
    }
    console.log(`  ボスの3体: ${combos.join(' / ')}`);
    check('⑦ 挑むたびにボスの3体が変わることがある', new Set(combos).size >= 2 || combos.length < 3, combos.join(' / '));
    check('⑥ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('途中で止まらない', false, String(e && e.message || e).slice(0, 300));
    console.log('  エラー:', errors.slice(0, 3).join(' / ').slice(0, 600));
    try { const pg = (await browser.contexts())[0].pages()[0]; console.log('  いまの画面:', await pg.evaluate(() => [...document.querySelectorAll('[data-card-top],[data-mh-screen]')].map((x) => x.getAttribute('data-card-top') || x.tagName).join(',') + ' / ' + document.body.innerText.slice(0, 200).replace(/\s+/g, ' '))); if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await pg.screenshot({ path: path.join(SHOT, 'raid-stuck.png') }); } } catch (_) { /* 撮れなくてもよい */ }
  } finally {
    await browser.close().catch(() => {});
    server.close();
  }
  console.log(failed ? `NG ${failed} 件` : 'OK: レイドのボスとのカード対戦(ブラウザ)');
  process.exit(failed ? 1 : 0);
})();
