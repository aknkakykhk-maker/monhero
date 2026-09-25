const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// デバッグ戦で、各モード・各難易度・どの敵とでも戦えることを確かめる。
// (2026-09-25 ユーザー指示「デバッグで各モード難易度でどの敵からも戦えるやつ作って」)
//
//   node tools/battle/debug-battle-modes-check.js
//   (配信 serve.py はこの検査が自分で立てる)
//
// ① ソース: モードの一覧・難易度の一覧・敵の一覧がモードで切り替わる。開始ボタンが押したときの
//    イベントを「極限か」の引数へ渡していない(onClick={startDebugBattle} と書くと入ってしまう)
// ② 実ブラウザ: デバッグ設定 → デバッグ戦で、モードを変えると難易度と敵の並びが変わる。
//    タクティクスの極限(INFINITY)で覚醒ムー、極限チャレンジでムー、クイックでディノと実際に戦い始められる
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
const has = (text) => source.includes(text);
check('デバッグ戦のモードにクラシックとタクティクスの両方がある',
  has("{ id:'challenge', label:'チャレンジ', runMode:BATTLE_MODE_CHALLENGE }")
  && has("{ id:'extreme', label:'極限チャレンジ', runMode:BATTLE_MODE_CHALLENGE, extreme:true }")
  && has("{ id:'tactics', label:'タクティクス', runMode:BATTLE_MODE_TACTICS }"));
check('タクティクスではタクティクス専用の敵を並べる', has('const sequence = tactics ? TACTICS_ENEMY_SEQUENCE : ENEMY_SEQUENCE;'));
check('極限はタクティクスの極限5段階も含めて extremeDifficulty に入れる',
  has('return !!mode.extreme || (isTacticsMode(mode.runMode) && isExtremeDifficultyId(difficultyId));')
  && has("setDifficulty(extreme ? 'Normal' : diffId);"));
check('開始ボタンが押したときのイベントを引数へ渡していない', !has('onClick={startDebugBattle}'));

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

// [モード, 難易度, 敵, 画面に出るはずの敵の名前]
const SCENARIOS = [
  ['tactics', 'INFINITY', 'AwakenedMoo', '覚醒ムー'],
  ['extreme', 'NIGHTMARE', 'Moo', 'ムー'],
  ['quick', 'Hard', 'Dino', 'ディノ'],
];

(async () => {
  const server = spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const openDebugBattle = async (page) => {
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
      await page.addInitScript(seed);
      await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
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
      // HOME → 設定 → ヘルプ → 💊 → デバッグ設定 → デバッグ戦
      await page.evaluate(() => document.querySelector('button[aria-label="設定"]')?.click());
      await page.waitForTimeout(900);
      await clickText('^ヘルプ$');
      await page.waitForTimeout(900);
      await clickText('💊');
      await page.waitForTimeout(1200);
      await page.evaluate(() => document.querySelector('[data-debug-battle-setup]')?.click());
      await page.waitForTimeout(900);
      return page.evaluate(() => !!document.querySelector('[data-debug-battle-setup-screen]'));
    };
    const click = (page, sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
    const listOf = (page, attr) => page.evaluate((a) => [...document.querySelectorAll(`[${a}]`)].map(b => b.getAttribute(a)), attr);

    // ── 一覧の切り替わり ──
    {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      check('デバッグ戦の画面を開ける', await openDebugBattle(page));
      check('モードが6つ並ぶ', (await listOf(page, 'data-debug-battle-mode-option')).length === 6);
      const counts = {};
      const enemies = {};
      for (const mode of ['challenge', 'quick', 'pro', 'extreme', 'tactics', 'tacticsPro']) {
        await click(page, `[data-debug-battle-mode-option="${mode}"]`);
        await page.waitForTimeout(300);
        counts[mode] = (await listOf(page, 'data-debug-battle-difficulty')).length;
        enemies[mode] = await listOf(page, 'data-debug-battle-enemy');
      }
      check('チャレンジとプロは通常の9段階', counts.challenge === 9 && counts.pro === 9, JSON.stringify(counts));
      check('クイック・極限チャレンジ・タクティクスは極限の難易度も並ぶ',
        counts.quick > 9 && counts.extreme >= 5 && counts.tactics === 14 && counts.tacticsPro === 14, JSON.stringify(counts));
      check('クラシックの敵はムーまでの10体', enemies.challenge.length === 10 && enemies.challenge.includes('Moo'), enemies.challenge.join(','));
      check('タクティクスの敵は覚醒ムーまでの10体', enemies.tactics.length === 10 && enemies.tactics.includes('AwakenedMoo') && enemies.tactics.includes('Kawazumo'), enemies.tactics.join(','));
      await page.close();
    }

    // ── 実際に戦い始める ──
    for (const [mode, diff, enemyKey, enemyName] of SCENARIOS) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await openDebugBattle(page);
      await click(page, `[data-debug-battle-mode-option="${mode}"]`);
      await page.waitForTimeout(300);
      await click(page, `[data-debug-battle-difficulty="${diff}"]`);
      await page.waitForTimeout(300);
      await click(page, `[data-debug-battle-enemy="${enemyKey}"]`);
      await page.waitForTimeout(200);
      const strongest = await page.evaluate(() => document.querySelector('[data-debug-strongest-monster]')?.getAttribute('aria-pressed'));
      if (strongest !== 'true') await click(page, '[data-debug-strongest-monster]');
      await page.waitForTimeout(200);
      await click(page, '[data-debug-battle-start]');
      await page.waitForTimeout(3500);
      const state = await page.evaluate(() => ({
        setupGone: !document.querySelector('[data-debug-battle-setup-screen]'),
        text: document.body.innerText,
        tacticsBoard: !!document.querySelector('[data-tactics-look]'),
      }));
      check(`${mode} / ${diff} / ${enemyKey} で戦い始められる`, state.setupGone && state.text.includes(enemyName) && errors.length === 0,
        errors.length ? errors[0].slice(0, 160) : (state.setupGone ? '' : '画面が変わらない'));
      if (mode === 'tactics') check('タクティクスはタクティクスの盤面で戦う', state.tacticsBoard);
      if (mode === 'extreme' || diff === 'INFINITY') check(`${mode} / ${diff} は極限として始まる`, /INFINITY|NIGHTMARE|極限/.test(state.text), '');
      await page.close();
    }
  } catch (e) {
    check('実ブラウザで最後まで確かめられた', false, String(e).slice(0, 200));
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exitCode = failed ? 1 : 0;
})();
