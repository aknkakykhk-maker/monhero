// 助手のマスモンの対戦の観戦(試作・56-assistant-masmon-battle-view.jsx)を、本物の画面で開いて確かめる。
//   node tools/assistant/assistant-masmon-battle-view-check.js          検査(縦 390×844)
//   node tools/assistant/assistant-masmon-battle-view-check.js --shots  止め絵も撮る(docs/progress/assistant-peer/masmon-battle/view/proto-*.png)
//   SMOKE_URL=https://aknkakykhk-maker.github.io/monhero/monster-hero/index.html で本番の版を見る(公開後の確かめ)
// 見るもの:
//   ① 入口はデバッグ設定の中に1つだけ・更新履歴とヘルプに載せていない・保存の読み書きをしていない
//   ② デバッグ設定から開ける/設定(形・助手・種族・能力の差・効き方・速さ)が出る
//   ③ 対戦が始まり、進み、結果まで行く/最後のライフが計算の結果と合う/効き方 A・B・C の見比べが出る
//   ④ 横にはみ出さない・絵が出ている・画面のエラーが無い・試作を開く前と後で保存(localStorage)が変わらない
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const TOOLS_DIR = path.join(__dirname, '..');
const root = path.resolve(TOOLS_DIR, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const part = read('monster-hero/src/parts/56-assistant-masmon-battle-view.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const PORT = 8897;
const PAGE_URL = process.env.SMOKE_URL || `http://localhost:${PORT}/monster-hero/index.html`;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/masmon-battle/view');

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

console.log('--- ① 作り ---');
const debugStart = app.indexOf("{gameState==='DEBUG_SETTINGS'&&(");
check('入口はデバッグ設定の中に1つだけ', app.split('data-debug-masmon-battle-watch').length === 2 && app.indexOf('data-debug-masmon-battle-watch') > debugStart);
check('開く所は setMasmonBattleWatchOpen(true) の1か所だけ', app.split('setMasmonBattleWatchOpen(true)').length === 2);
const code = part.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n'); // 説明の行は見ない
check('保存の読み書きをしていない', !/localStorage|storeSet|storeGet|sessionStorage|supabase|fetch\(/.test(code));
check('計算に手を入れていない(記録を読むだけ)', !/_internal/.test(part));
check('更新履歴・ヘルプに載せていない(デバッグ専用のため)',
  !/観戦の試作|助手マスモンの対戦を見る/.test(read('monster-hero/data/changelog.js')) && !/観戦の試作|助手マスモンの対戦を見る/.test(read('monster-hero/data/help.js')));

console.log('\n--- ② 実ブラウザ ---');
const seed = () => {
  if (localStorage.getItem('mh_breeder_name') !== null) return;
  for (const [k, v] of [['mh_breeder_name', 'テスト'], ['mh_breeder_icon', 'Mocchi'], ['mh_onboarded', true], ['mh_tutorial_seen_v1', true],
    ['mh_battle_tutorial_seen_v1', true], ['mh_battle_tutorial_guide_shown_v1', true], ['mh_masu_migrated', true]]) localStorage.setItem(k, JSON.stringify(v));
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので実ブラウザでは確認できません'); process.exit(failed ? 1 : 0); }
  const server = process.env.SMOKE_URL ? null : spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  let browser;
  const errors = [];
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(seed);
    // お話・お知らせは既読にして開く(まっさらなデータだと、お話が試作の上に重なる)
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    const pointerDown = (sel) => page.evaluate((s) => {
      const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
      if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return !!b;
    }, sel);
    const clickText = (re) => page.evaluate((pattern) => { const b = [...document.querySelectorAll('button')].find(x => new RegExp(pattern).test(x.textContent)); if (b) b.click(); return !!b; }, re);
    const clickSel = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
    const shot = async (name) => { if (SHOTS) await page.screenshot({ path: path.join(shotDir, `proto-${name}.png`), fullPage: false }); };

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
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="設定"]'); b && b.click(); });
    await page.waitForTimeout(900);
    await clickText('^ヘルプ');
    await page.waitForTimeout(900);
    await clickText('💊');
    await page.waitForTimeout(1200);
    check('デバッグ設定へ入れる', await page.evaluate(() => document.body.innerText.includes('DEBUG MENU')));
    // 本体がどの画面でも書く足あと(画面の履歴・起動の印)は見比べない
    const snap = () => page.evaluate(() => Object.keys(localStorage).filter(k => k !== 'mh_screen_trail_v1' && k !== 'mhdev_session_marker_v1').sort().map(k => [k, localStorage.getItem(k)]));
    const before = await snap();
    check('入口のボタンがある', await clickSel('[data-debug-masmon-battle-watch]'));
    await page.waitForFunction(() => !!document.querySelector('[data-ambw-setup]'), { timeout: 20000 }).catch(() => {});
    check('設定の画面が出る(計算を読み込めた)', await page.evaluate(() => !!document.querySelector('[data-ambw-setup]')));
    const setup = await page.evaluate(() => ({
      sizes: document.querySelectorAll('[data-ambw-size]').length, diffs: document.querySelectorAll('[data-ambw-diff]').length,
      balances: document.querySelectorAll('[data-ambw-balance]').length, assistants: document.querySelectorAll('[data-ambw-assistant] option').length / 2,
      species: document.querySelectorAll('[data-ambw-species="A0"] option').length, slots: document.querySelectorAll('[data-ambw-species]').length,
    }));
    check('形3つ・能力の差7つ・効き方3つ・助手8人・種族30', setup.sizes === 3 && setup.diffs === 7 && setup.balances === 3 && setup.assistants === 8 && setup.species >= 30 && setup.slots === 6, JSON.stringify(setup));
    await shot('1-setup');
    await clickSel('[data-ambw-size="1"]');
    await page.waitForTimeout(200);
    check('1 VS 1 にすると枠が1つずつになる', await page.evaluate(() => document.querySelectorAll('[data-ambw-species]').length === 2));
    await clickSel('[data-ambw-size="3"]');
    await clickSel('[data-ambw-diff="10"]');
    await page.waitForTimeout(200);

    await clickSel('[data-ambw-start]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambw-watch]'), { timeout: 10000 }).catch(() => {});
    check('観戦が始まる', await page.evaluate(() => !!document.querySelector('[data-ambw-watch]')));
    const pos0 = await page.evaluate(() => +document.querySelector('[data-ambw-watch]').dataset.ambwPos);
    await page.waitForFunction(() => !!document.querySelector('.ambw-dmg'), { timeout: 30000 }).catch(() => {});
    await clickSel('[data-ambw-pause]');
    await page.waitForTimeout(500);
    const pos1 = await page.evaluate(() => +document.querySelector('[data-ambw-watch]').dataset.ambwPos);
    check('1手ずつ進む・技の帯とダメージが出る', pos1 > pos0 && await page.evaluate(() => !!document.querySelector('.ambw-cut') && !!document.querySelector('.ambw-dmg')), `${pos0} → ${pos1}`);
    check('技の札が出ている(両方)', await page.evaluate(() => document.querySelectorAll('[data-ambw-panel="A"] .ambw-chip').length >= 2 && document.querySelectorAll('[data-ambw-panel="B"] .ambw-chip').length >= 2));
    await shot('2-watch');
    await page.waitForTimeout(600);
    check('試作の上に、ほかの画面が重なっていない', await page.evaluate(() => { const r = document.querySelector('[data-ambw-root]'); const t = document.elementFromPoint(195, 300); return !!(r && t && r.contains(t)); }));
    check('止めているあいだは進まない', (await page.evaluate(() => +document.querySelector('[data-ambw-watch]').dataset.ambwPos)) === pos1);
    await clickSel('[data-ambw-speed="hl"]');
    await page.waitForTimeout(3000);
    check('「見せ場だけ」でとばして進む', (await page.evaluate(() => { const w = document.querySelector('[data-ambw-watch]'); return w ? +w.dataset.ambwPos : 9999; })) > pos1 + 1);
    await clickSel('[data-ambw-skip]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambw-result]'), { timeout: 10000 }).catch(() => {});
    check('「結果へ」で結果が出る', await page.evaluate(() => !!document.querySelector('[data-ambw-result]')));
    await page.waitForFunction(() => document.querySelectorAll('[data-ambw-compare] .ambw-k').length === 3, { timeout: 30000 }).catch(() => {});
    const result = await page.evaluate(() => ({
      rows: document.querySelectorAll('[data-ambw-compare] .ambw-k').length,
      hpA: +document.querySelector('[data-ambw-hp="A"]').textContent, hpB: +document.querySelector('[data-ambw-hp="B"]').textContent,
      title: document.querySelector('.ambw-res b').textContent,
      wide: document.documentElement.scrollWidth > window.innerWidth + 1 || [...document.querySelectorAll('.ambw-in *')].some(x => x.getBoundingClientRect().right > window.innerWidth + 1),
      noImg: [...document.querySelectorAll('.ambw img')].filter(i => i.complete && i.naturalWidth === 0).length,
    }));
    check('効き方 A・B・C の見比べが3行出る', result.rows === 3);
    check('決着のとき、負けた側の場の1体のライフが 0', (result.hpA === 0) !== (result.hpB === 0) || /引き分け/.test(result.title), `A ${result.hpA}・B ${result.hpB}・${result.title}`);
    check('横にはみ出さない・絵が出ている', !result.wide && result.noImg === 0, JSON.stringify(result));
    await shot('3-result');
    await clickSel('[data-ambw-back]');
    await page.waitForTimeout(300);
    await clickSel('[data-ambw-close]');
    await page.waitForTimeout(500);
    check('「もどる」でデバッグ設定へ戻る', await page.evaluate(() => !document.querySelector('[data-ambw-root]') && document.body.innerText.includes('DEBUG MENU')));
    const after = await snap(), bm = new Map(before);
    const changed = after.filter(([k, v]) => bm.get(k) !== v).map(([k]) => k).concat(before.filter(([k]) => !after.some(a => a[0] === k)).map(([k]) => k));
    check('試作を開く前と後で保存(localStorage)が変わらない', changed.length === 0, changed.join(', '));
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('検査が最後まで進む', false, String(e && e.message || e).slice(0, 200));
  } finally {
    if (browser) await browser.close();
    if (server) server.kill();
  }
  console.log(failed ? `\nNG: ${failed} 件` : '\nOK: 助手マスモンの対戦の観戦(試作)');
  process.exit(failed ? 1 : 0);
})();
