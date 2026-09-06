const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 画面の描画で例外が出ても真っ白にならず「ホームへ戻る」が出ること(MhErrorBoundary)を確かめる。
//
//   node tools/boot/screen-error-boundary-check.js
//   (配信 serve.py はこの検査が自分で立てる)
//
// ① ソース: エラー境界がルート直下と MonsterHeroGame の中の2段にあり、デバッグ設定に試す入口がある
// ② 実ブラウザ: デバッグ設定の「画面エラーの受け止めを試す」を押す → 真っ白ではなく受け止め画面が出る
//    → 「ホームへ戻る」で HOME に戻り、受け止め画面が消える。致命的な JS エラーとして外に漏れない
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const PORT = 8899;
const PAGE_URL = process.env.SMOKE_URL || `http://localhost:${PORT}/monster-hero/index.html`;

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// --- ① ソース ---
check('エラー境界のクラスがある', /class MhErrorBoundary extends React\.Component/.test(source));
check('getDerivedStateFromError と componentDidCatch を持つ', /static getDerivedStateFromError/.test(source) && /componentDidCatch\(/.test(source));
check('ルート直下をエラー境界で包んでいる', /_root\.render\(React\.createElement\(MhErrorBoundary,[^\n]*React\.createElement\(MonsterHeroGame\)\)\)/.test(source));
const providerOpen = source.indexOf('<AssistantBondContext.Provider value={assistantBondValue}>');
const providerClose = source.indexOf('</AssistantBondContext.Provider>');
const inner = source.slice(providerOpen, providerClose);
check('MonsterHeroGame の中身を gameState 付きのエラー境界で包んでいる', /<MhErrorBoundary screen=\{gameState\}/.test(inner) && inner.includes('</MhErrorBoundary>'));
check('画面が変わったらエラーを捨てる(getDerivedStateFromProps)', /static getDerivedStateFromProps\(props, state\)[\s\S]*props\.screen !== state\.screen/.test(source));
const debugBlock = source.slice(source.indexOf("gameState==='DEBUG_SETTINGS'&&("), source.indexOf("gameState==='DEBUG_SETTINGS'&&(") + 6000);
check('デバッグ設定に試す入口がある(通常画面には無い)', debugBlock.includes('data-debug-screen-error') && source.split('data-debug-screen-error').length === 2);

// --- ② 実ブラウザ ---
const seed = () => {
  localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
  localStorage.setItem('mh_breeder_icon', JSON.stringify('Mocchi'));
  localStorage.setItem('mh_onboarded', JSON.stringify(true));
  localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
  localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
};

(async () => {
  const server = spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(seed);
    await page.route('**cdn.tailwindcss.com**', r => r.abort()).catch(() => {});
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    const pointerDown = (sel) => page.evaluate((s) => {
      const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
        : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
      if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return !!b;
    }, sel);
    const clickText = (re) => page.evaluate((pattern) => {
      const b = [...document.querySelectorAll('button')].find(x => new RegExp(pattern).test(x.textContent));
      if (b) b.click();
      return !!b;
    }, re);
    const clickSel = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);

    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2500);
    for (let i = 0; i < 8; i++) {
      const closed = await clickText('受け取|閉じる|あとで|スキップ');
      await page.waitForTimeout(700);
      if (!closed && !(await page.evaluate(() => !!document.querySelector('[role="dialog"]')))) break;
    }
    // HOME → 設定 → ヘルプ → 💊 → デバッグ設定
    await clickSel('button[aria-label="設定"]');
    await page.waitForTimeout(900);
    await clickText('^ヘルプ$');
    await page.waitForTimeout(900);
    await clickText('💊');
    await page.waitForTimeout(1200);
    check('デバッグ設定へ入れる', await page.evaluate(() => document.body.innerText.includes('BATTLE TEST')));
    check('デバッグ設定に「画面エラーの受け止めを試す」がある', await page.evaluate(() => !!document.querySelector('[data-debug-screen-error]')));

    await clickSel('[data-debug-screen-error]');
    await page.waitForTimeout(1200);
    const caught = await page.evaluate(() => ({
      shown: !!document.querySelector('[data-screen-error]'),
      text: document.body.innerText,
      // 画面名は折りたたみ(details)の中なので innerText には出ない。textContent で読む
      detail: document.querySelector('[data-screen-error] pre')?.textContent || '',
      rootChildren: document.getElementById('root')?.children.length || 0,
    }));
    check('真っ白ではなく受け止め画面が出る', caught.shown && caught.rootChildren > 0, caught.shown ? '' : `root children=${caught.rootChildren}`);
    check('受け止め画面に「ホームへ戻る」と「ゲームを読み込み直す」がある', /ホームへ戻る/.test(caught.text) && /ゲームを読み込み直す/.test(caught.text));
    check('受け止め画面の「くわしい内容」に画面名(DEBUG_SETTINGS)が書いてある', /DEBUG_SETTINGS/.test(caught.detail));

    await clickText('^ホームへ戻る$');
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({
      shown: !!document.querySelector('[data-screen-error]'),
      home: !!document.querySelector('button[aria-label="設定"]'),
    }));
    check('「ホームへ戻る」で受け止め画面が消える', !after.shown);
    check('HOME に戻っている(設定ボタンが見える)', after.home);

    const fatal = errors.filter(e => !e.includes('画面エラーの受け止めを試すために、わざと投げた例外'));
    check('わざと投げた例外以外の致命的な JS エラーが出ていない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } catch (e) {
    check('実ブラウザで確認できた', false, String(e && e.message || e));
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
