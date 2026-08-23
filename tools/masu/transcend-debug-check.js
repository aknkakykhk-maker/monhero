// 超越デバッグ画面(DEBUG_SETTINGS →「超越確認」)を実ブラウザで開いて確かめる。
//
//   python3 tools/serve.py でリポジトリのルートを配信した状態で
//   node tools/masu/transcend-debug-check.js
//
// 【なぜ道具にするか】
// デバッグ画面は「開いた人しか気づけない」画面なので、真っ白になっても誰も報告してくれない。
// 実際に「関数の中で定義した定数を別の画面から参照していて、その画面に入ると進行不能になる」
// 不具合を出したことがあり、check-syntax.js でも undefined-reference-check.js でも拾えない。
// ここでは本番と同じ導線(タイトル → 設定 → ヘルプ → 💊 → デバッグ設定 → 超越確認)をたどり、
// 画面が出ること・部品がそろっていること・演出が再生されることを実際に確かめる。
//
// あわせて「デバッグ専用なので更新履歴とヘルプには載せない」という運用ルール
// (CLAUDE.md)も、ここで機械的に見張る。
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- ① まず静的に。デバッグ専用のものを、プレイヤー向けの案内へ書いていないか ---
const source = read('monster-hero/src/game-system.jsx');
const compiled = read('monster-hero/game-system.compiled.js');
const changelog = read('monster-hero/data/changelog.js');
const help = read('monster-hero/data/help.js');

check('超越デバッグ画面がソースにある', source.includes("gameState==='TRANSCEND_DEBUG'"));
check('配信用JSにも入っている', compiled.includes("gameState === 'TRANSCEND_DEBUG'") || compiled.includes("gameState==='TRANSCEND_DEBUG'"));
check('入口はデバッグ設定の中だけ',
  source.indexOf('data-debug-transcend') > source.indexOf("gameState==='DEBUG_SETTINGS'")
  && (source.match(/data-debug-transcend/g) || []).length === 1);
check('通常プレイの画面からは開けない',
  !/setGameState\('TRANSCEND_DEBUG'\)/.test(source.replace(/data-debug-transcend[\s\S]{0,200}?TRANSCEND_DEBUG'\);/, '')));
// デバッグ専用の変更は更新履歴・ヘルプに載せない(CLAUDE.md)
check('更新履歴に載せていない', !changelog.includes('TRANSCEND_DEBUG') && !changelog.includes('超越確認'));
// ヘルプ本文には書かない。画面の対応表(HELP_SCREEN_COVERAGE)へ並べるのは
// 限界突破★テスト・転生表示確認と同じ扱いで、プレイヤー向けの案内が増えるわけではない
const helpCoverage = help.slice(help.indexOf('HELP_SCREEN_COVERAGE'));
check('ヘルプ本文には載せていない',
  !help.includes('超越確認')
  && (help.match(/TRANSCEND_DEBUG/g) || []).length === 1
  && helpCoverage.includes("TRANSCEND_DEBUG:'masu/transcendence'"));
// 新しい保存キーを増やしていない(既存の3キーだけを書き換える)
const debugBlock = source.slice(source.indexOf('// ===== 超越のデバッグ'), source.indexOf('  // 転生: レベルを99ぶん返して'));
const usedKeys = [...new Set((debugBlock.match(/storeSet\('([^']+)'/g) || []).map(s => s.slice(10, -1)))].sort();
check('書き換えるのは既存の保存キーだけ',
  usedKeys.every(key => ['mh_masu_mons', 'mh_gold', 'mh_owned_items'].includes(key)),
  usedKeys.join(' / ') || 'なし');
check('書き換える操作には必ず確認を出す',
  (debugBlock.match(/window\.confirm\(/g) || []).length >= 3);
check('演出の再生は保存へ触れない',
  !/storeSet/.test(debugBlock.slice(debugBlock.indexOf('const debugPlayTranscendAnimation'))));
// 横幅はTailwindが要るのでこのサンドボックスでは測れない。代わりに、他のデバッグ画面と
// 同じ入れ物(Safe Area込みの余白 + 縦スクロール)を使っているかをソースで見る
const screenBlock = source.slice(source.indexOf("gameState==='TRANSCEND_DEBUG'"), source.indexOf("gameState==='BREAKTHROUGH_STAR_DEBUG'"));
check('他のデバッグ画面と同じ入れ物を使っている',
  screenBlock.includes('env(safe-area-inset-top)') && screenBlock.includes('env(safe-area-inset-bottom)')
  && screenBlock.includes('overflow-y-auto mh-scroll'));
check('画面からはみ出す固定幅を書いていない', !/w-\[\d{3,}px\]|min-w-\[\d{3,}px\]/.test(screenBlock));

// --- ② 実際に開く ---
const seed = () => {
  localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
  localStorage.setItem('mh_breeder_icon', JSON.stringify('Mocchi'));
  localStorage.setItem('mh_onboarded', JSON.stringify(true));
  localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
  localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
  localStorage.setItem('mh_gold', JSON.stringify(99999));
  // 未超越と超越済みを1体ずつ。どちらの表示分岐も通す
  localStorage.setItem('mh_masu_mons', JSON.stringify([
    { id: 'dbg1', baseId: 'Suezo', name: 'テストA', bondXp: 0, rebirthCount: 0, levelCap: 30 },
    { id: 'dbg2', baseId: 'Golem', name: 'テストB', bondXp: 0, rebirthCount: 35, levelCap: 400,
      transcended: true, transcendPoints: 5,
      transcendStatPoints: { hp: 10, atk: 0, def: 0, guts: 0 }, transcendAptBoosts: [1, 0, 0, 0] },
  ]));
};

(async () => {
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
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="設定"]'); b && b.click(); });
    await page.waitForTimeout(900);
    await clickText('^ヘルプ$');
    await page.waitForTimeout(900);
    await clickText('💊');
    await page.waitForTimeout(1200);
    check('デバッグ設定へ入れる', await page.evaluate(() => document.body.innerText.includes('BATTLE TEST')));
    check('デバッグ設定に超越確認の入口がある', await page.evaluate(() => !!document.querySelector('[data-debug-transcend]')));

    await page.evaluate(() => { const b = document.querySelector('[data-debug-transcend]'); b && b.click(); });
    await page.waitForTimeout(1200);

    const view = await page.evaluate(() => ({
      opened: document.body.innerText.includes('超越確認'),
      badges: document.querySelectorAll('.mh-transcend-badge').length,
      candidates: document.querySelectorAll('[data-transcend-debug-candidate]').length,
      prepare: !!document.querySelector('[data-transcend-debug-prepare]'),
      cost: !!document.querySelector('[data-transcend-debug-cost]'),
      points: !!document.querySelector('[data-transcend-debug-points]'),
      reset: !!document.querySelector('[data-transcend-debug-reset]'),
      hasCost: /5,000/.test(document.body.innerText) && /1,000,000/.test(document.body.innerText),
      hasCap: /400 → 500/.test(document.body.innerText),
      // 見た目の大きさ・位置はTailwindが要るのでこのサンドボックスでは測れない。
      // ここは「スクロールする入れ物が実際に描画されているか」だけを見る(寸法は上の静的検査で見る)
      hasScroller: !!document.querySelector('main .mh-scroll'),
    }));
    check('超越確認の画面が開く', view.opened);
    check('超越マークが本番の部品で出ている', view.badges >= 3, `${view.badges}個`);
    check('所持マスモンから対象を選べる', view.candidates === 2, `${view.candidates}体`);
    check('準備のボタンがそろっている', view.prepare && view.cost && view.points && view.reset);
    check('費用とLv上限を数値で出している', view.hasCost && view.hasCap);
    check('縦スクロールする入れ物が描画されている', view.hasScroller);

    // 選択 → 演出の再生(保存へは触れない操作)
    await page.evaluate(() => { const b = document.querySelector('[data-transcend-debug-candidate]'); b && b.click(); });
    await page.waitForTimeout(600);
    check('選ぶと対象の状態が出る', await page.evaluate(() => /限界突破|凸/.test(document.body.innerText)));
    const before = await page.evaluate(() => localStorage.getItem('mh_masu_mons'));
    await clickText('超越演出を再生');
    await page.waitForTimeout(1200);
    check('超越演出が再生される', await page.evaluate(() => !!document.querySelector('.mh-transcend-animation')));
    check('演出だけではセーブが変わらない',
      before === await page.evaluate(() => localStorage.getItem('mh_masu_mons')));

    check('実行時エラーが出ていない', errors.length === 0, errors[0] || '');
    await browser.close();
  } catch (e) {
    check('ブラウザで確認できた', false, e.message.split('\n')[0]);
    if (browser) await browser.close().catch(() => {});
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
