// 実ブラウザでゲームを起動し、主要な画面と今回追加した機能が動くかを確認する。
//
//   python3 -m http.server 8899   などでリポジトリのルートを配信した状態で
//   node feature-check.js
//
// React本体はリポジトリに同梱しているので実際に描画まで到達できる。
// Tailwind(見た目)と全国ランキング(Supabase)は外部通信のため、
// 通信が塞がれた環境では見た目が崩れる/ランキングが空になるが、動作確認には支障がない。
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));

  // 初回起動はプロフィール(名前設定)から始まるため、名前を設定済みにしてトップから始める。
  // データは JSON 文字列で localStorage に入る(storeSet と同じ形式)
  await page.addInitScript(() => {
    localStorage.setItem('mh_breeder_name', JSON.stringify('テストブリーダー'));
    localStorage.setItem('mh_intro_done', JSON.stringify(true));
  });
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, { timeout: 60000 });
  await page.waitForTimeout(1500);

  check('ゲームが描画される', true);
  check('起動時に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  // 初回はプロフィール(名前設定)から始まるので、名前を決めてトップへ進む
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.count()) {
    await nameInput.fill('テスト');
    const decide = page.getByRole('button', { name: /決定|はじめる|OK/ }).first();
    if (await decide.count()) await decide.click().catch(() => {});
    await page.waitForTimeout(800);
  }
  // トップへ戻るボタンがあれば押す
  for (const label of ['トップへ', 'もどる', '戻る']) {
    const b = page.getByRole('button', { name: label }).first();
    if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(600); break; }
  }

  const bodyText = () => page.evaluate(() => document.body.innerText);

  // --- バージョン表示 ---
  const txt = await bodyText();
  const build = await page.evaluate(() => (typeof BUILD_DATE !== 'undefined' ? BUILD_DATE : ''));
  check('トップにバージョンが表示される', txt.includes('ver ' + build), 'ver ' + build);

  // --- 更新履歴 ---
  const changelogBtn = page.getByRole('button', { name: /更新/ }).first();
  const hasBtn = await changelogBtn.count() > 0;
  check('更新履歴ボタンがある', hasBtn);
  if (hasBtn) {
    check('未読NEWマークが出ている', (await bodyText()).includes('NEW'));
    await changelogBtn.click();
    await page.waitForTimeout(700);
    const open = await bodyText();
    check('更新履歴が開く', open.includes('更新履歴'));
    check('更新情報タブの内容が出る', open.includes('大型アップデート'));
    const issueTab = page.getByRole('button', { name: '不具合情報' }).first();
    if (await issueTab.count()) {
      await issueTab.click();
      await page.waitForTimeout(500);
      const issue = await bodyText();
      check('不具合情報タブに切り替わる', issue.includes('修正済み'));
    } else check('不具合情報タブに切り替わる', false, 'タブが見つからない');
    // 閉じる
    const closeBtns = page.locator('button').filter({ hasText: '' });
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.closest('div') && x.querySelector('svg') && x.textContent.trim() === '');
      if (b) b.click();
    });
    await page.waitForTimeout(600);
    // 既読になったか(再度開かずstorageで確認)
    const seen = await page.evaluate(() => localStorage.getItem('mh_changelog_seen'));
    check('開いたら既読として保存される', !!seen && seen.replace(/"/g, '') !== '', String(seen));
  }

  // --- 音量: 初期状態がオン(SE/BGMとも1)で、オフ→オンでも1に戻る ---
  const audioBtn = page.locator('button').filter({ hasText: '音量設定' }).first();
  if (await audioBtn.count()) {
    const label = (await audioBtn.innerText()).trim();
    check('初期状態で音がオンになっている', !label.startsWith('🔇'), label);
    await audioBtn.click();
    await page.waitForTimeout(600);
    // 設定パネルのスライダー横に出ている数値を読む
    const vols = () => page.evaluate(() => {
      // VolumeSlider が値を出しているspan(右寄せ・等幅)だけを拾う
      return [...document.querySelectorAll('span.w-6.text-right.font-mono')]
        .map((e) => e.textContent.trim()).slice(0, 2);
    });
    check('初期音量がSE/BGMとも1', JSON.stringify(await vols()) === '["1","1"]', JSON.stringify(await vols()));
    // 一度オフにしてから、もう一度オンにすると1に戻る
    const toggle = page.locator('button').filter({ hasText: /音がオフです|音はオンです/ }).first();
    await toggle.click(); await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: '音がオフです' }).first().click();
    await page.waitForTimeout(700);
    const after = await page.evaluate(() => ({ se: localStorage.getItem('mh_se_volume'), bgm: localStorage.getItem('mh_bgm_volume') }));
    const norm = (v) => String(v).replace(/"/g, '');
    check('オフ→オンでSE/BGMが1になる', norm(after.se) === '1' && norm(after.bgm) === '1', `SE=${norm(after.se)} BGM=${norm(after.bgm)}`);
  } else check('音量設定を開ける', false, 'ボタンが見つからない');

  await page.screenshot({ path: path.join(__dirname, 'out', 'feature-check.png'), fullPage: false });

  const ng = results.filter((r) => !r.ok);
  console.log(`\n${results.length - ng.length}/${results.length} 項目が成功`);
  await browser.close();
  process.exit(ng.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
