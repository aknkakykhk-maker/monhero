#!/usr/bin/env node
'use strict';
// 新モンスター確認(MONSTER_CHECK_DEBUG)を確かめる。
//
//   node tools/monster/monster-check-debug-check.js
//   (配信 serve.py はこの検査が自分で立てる)
//
// 【なぜ道具にするか】
// この画面の値打ちは「所持も解放も見ずに全種が必ず出る」ことにある。
// 絞り込みを1つ足すだけで静かに戻ってしまい、画面はふつうに開くので気づけない。
// 実際に MONSTER_IMAGE_DEBUG は「所持マスモンだけ」になっていて、正式実装した
// エイキ・剣士モッチーが一覧から消えていた(2026-09-17・ユーザー指摘
// 「今は見れないものが多い」「実装したら消えちゃうのも良くない」)。
// そこで ①ソースで絞り込みを入れていないこと ②実ブラウザで全種が並ぶこと の両方を見る。
//
// ついでに「実装チェック」の結果も見る。いまの全種が「足りない項目なし」であることを
// 約束にしておけば、モンスターを1体足して書き忘れたときにこの検査が落ちる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const TOOLS_DIR = path.join(__dirname, '..');
const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const part = fs.readFileSync(path.join(root, 'monster-hero/src/parts/74-screen-monster-check-debug.jsx'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'monster-hero/src/parts/parts.json'), 'utf8'));
const changelog = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');
const PORT = 8899;
const PAGE_URL = process.env.SMOKE_URL || `http://localhost:${PORT}/monster-hero/index.html`;

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 実データの全種数。検査側へ数を書き写すと、モンスターを足したときに検査だけが古くなる
const ctx = { console, Object, Array, Set, Map, String, Number };
vm.createContext(ctx);
for (const f of ['data/images/images-ally.js', 'data/ally-monsters.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'monster-hero', f), 'utf8'), ctx, { filename: f });
}
vm.runInContext('globalThis.api = { ALL_PLAYER_MONSTERS };', ctx);
const MONSTERS = Object.values(ctx.api.ALL_PLAYER_MONSTERS).filter(mon => mon && mon.id);

console.log('--- ① ソース ---');
const names = manifest.parts.map(p => p.file);
check('画面部品が parts.json に載っている', names.includes('74-screen-monster-check-debug.jsx'));
check('連結順が 60-app.jsx より前にある',
  names.indexOf('74-screen-monster-check-debug.jsx') < names.indexOf('60-app.jsx'));
check('画面部品 MonsterCheckDebugScreen を定義している', /^function MonsterCheckDebugScreen\(/m.test(part));
check('60-app.jsx から使われている', source.includes('<MonsterCheckDebugScreen'));

// ★この検査の芯。所持(masuMons)・解放(unlockedMonsterIds)・debugOnly のどれでも一覧を絞らないこと。
// 一覧を作っているのは monsterCheckAllMonsters() だけなので、その中身を切り出して見る
const listFn = part.slice(part.indexOf('const monsterCheckAllMonsters'), part.indexOf('const monsterCheckMarketItems'));
check('一覧は ALL_PLAYER_MONSTERS をそのまま使う', listFn.includes('Object.values(ALL_PLAYER_MONSTERS)'));
check('一覧を所持マスモンで絞っていない', !/masuMons/.test(listFn));
check('一覧を解放済みで絞っていない', !/unlockedMonsterIds/.test(listFn));
check('一覧を debugOnly で絞っていない(実装したら消える、を作らない)', !/debugOnly/.test(listFn));

// 既存の画像・染色確認も、正式実装したあと消えないこと(所持を問わず全種を足している)
check('モンスター画像・染色確認も所持を問わず全種を並べる',
  /Object\.values\(ALL_PLAYER_MONSTERS\)\.forEach\(mon=>\{if\(mon\?\.id&&!owned\.some\(m=>m\.baseId===mon\.id\)\)owned\.push\(/.test(source));
// 模様テストも同じ理由で全種を並べる
check('マスモン模様カスタムテストも所持を問わず全種を並べる',
  /Object\.values\(ALL_PLAYER_MONSTERS\)\.forEach\(mon=>\{if\(mon\?\.id&&!eligible\.some\(m=>m\.baseId===mon\.id\)\)eligible\.push\(/.test(source));

const debugStart = source.indexOf("gameState==='DEBUG_SETTINGS'&&(");
const debugEnd = source.indexOf("{gameState==='MONSTER_IMAGE_DEBUG'&&(", debugStart);
const debugBlock = (debugStart >= 0 && debugEnd > debugStart) ? source.slice(debugStart, debugEnd) : '';
check('デバッグ設定に入口がある', debugBlock.includes('data-debug-monster-check')
  && source.split('data-debug-monster-check').length === 2);

// デバッグ専用なので更新履歴には載せない(CLAUDE.md ⑤の但し書き)
check('更新履歴に載せていない(デバッグ専用のため)',
  !/新モンスター確認/.test(changelog) && !/MONSTER_CHECK_DEBUG/.test(changelog));

console.log('\n--- ② 実ブラウザ ---');
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
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので実ブラウザでは確認できません'); process.exit(failed ? 1 : 0); }

  const server = spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  let browser;
  const errors = [];
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(seed);
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
    // カテゴリは畳んであるので DOM の click() で押す(見えていなくても押せる)
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
    await page.evaluate(() => { const b = document.querySelector('button[aria-label="設定"]'); b && b.click(); });
    await page.waitForTimeout(900);
    await clickText('^ヘルプ$');
    await page.waitForTimeout(900);
    await clickText('💊');
    await page.waitForTimeout(1200);
    check('デバッグ設定へ入れる', await page.evaluate(() => document.body.innerText.includes('DEBUG MENU')));
    check('デバッグ設定に「新モンスター確認」の入口がある',
      await page.evaluate(() => !!document.querySelector('[data-debug-monster-check]')));
    await clickSel('[data-debug-monster-check]');
    await page.waitForTimeout(1500);

    // --- 一覧 ---
    const list = await page.evaluate(() => ({
      opened: !!document.querySelector('[data-monster-check-debug]'),
      options: document.querySelectorAll('[data-monster-check-option]').length,
      ids: [...document.querySelectorAll('[data-monster-check-option]')].map(b => b.getAttribute('data-monster-check-option')),
      needsFix: [...document.querySelectorAll('[data-monster-check-option]')].filter(b => /要確認/.test(b.textContent)).length,
      hasScroller: !!document.querySelector('.mh-scroll'),
    }));
    check('新モンスター確認の画面が開く', list.opened);
    check('全種が並ぶ(所持も解放も関係なく)', list.options === MONSTERS.length,
      `画面 ${list.options}種 / 実データ ${MONSTERS.length}種`);
    const missing = MONSTERS.map(m => m.id).filter(id => !list.ids.includes(id));
    check('欠けているモンスターがいない', missing.length === 0, missing.join(', '));
    check('いまの全種は「足りない項目」が無い', list.needsFix === 0, `${list.needsFix}種に要確認`);
    check('一覧が縦スクロールできる', list.hasScroller);

    // --- 詳細(タブ) ---
    await clickSel('[data-monster-check-option]');
    await page.waitForTimeout(1200);
    const detail = await page.evaluate(() => ({
      tabs: [...document.querySelectorAll('[data-monster-check-tab]')].map(b => b.getAttribute('data-monster-check-tab')),
      hero: !!document.querySelector('[data-monster-check-hero]'),
      check: !!document.querySelector('[data-monster-check-tab-check]'),
      toMotion: !!document.querySelector('[data-monster-check-open-motion]'),
      broken: (document.body.innerText.match(/読み込めません/g) || []).length,
    }));
    check('詳細に立ち絵がある', detail.hero);
    check('図鑑と同じタブで分かれている', detail.tabs.join(',') === 'check,art,stats,skills,data', detail.tabs.join(','));
    check('はじめに実装チェックが出ている', detail.check);
    check('攻撃アクションの入口がある', detail.toMotion);
    check('絵がすべて読み込める', detail.broken === 0, `${detail.broken}枚が読み込めない`);

    // --- 攻撃アクション(全画面) ---
    // ★枠の大きさを実測する。以前は112px四方しかなく、演出が枠の外へ出て見えなかった
    // (2026-09-17・ユーザー指摘「攻撃モーションの枠が小さすぎてわからない」)。
    // 図鑑の攻撃アクションと同じ「画面の残り全部」を使っていることを数字で確かめる
    await clickSel('[data-monster-check-open-motion]');
    await page.waitForTimeout(900);
    const motion = await page.evaluate(() => {
      const stage = document.querySelector('[data-monster-check-stage]');
      const art = document.querySelector('[data-monster-check-art]');
      const s = stage && stage.getBoundingClientRect();
      const a = art && art.getBoundingClientRect();
      return {
        stage: s ? { w: Math.round(s.width), h: Math.round(s.height) } : null,
        art: a ? { w: Math.round(a.width), h: Math.round(a.height) } : null,
        kinds: [...document.querySelectorAll('[data-monster-check-motion]')].map(b => b.getAttribute('data-monster-check-motion')),
        viewport: window.innerHeight,
      };
    });
    check('攻撃アクションの舞台がある', !!motion.stage);
    check('舞台が画面の半分以上を使っている（小さすぎない）',
      !!motion.stage && motion.stage.h >= motion.viewport * 0.5,
      motion.stage ? `${motion.stage.w}×${motion.stage.h} / 画面高 ${motion.viewport}` : '');
    check('立ち絵が図鑑の攻撃アクションと同じ大きさ（132px以上）',
      !!motion.art && motion.art.w >= 132, motion.art ? `${motion.art.w}px` : '');
    check('通常攻撃と固有技を選べる', motion.kinds.join(',') === 'normal,unique', motion.kinds.join(','));

    // 実際に再生してみる(本番と同じ attackMotionPreviewSequence を通る)
    await clickSel('[data-monster-check-motion="unique"]');
    await page.waitForTimeout(400);
    check('固有技の演出が再生される', await page.evaluate(() => /再生中/.test(document.body.innerText)));
    await page.waitForTimeout(2000);

    // --- 画像タブ → 染色をくわしく見る ---
    await clickSel('[aria-label="詳細へ戻る"]');
    await page.waitForTimeout(800);
    await clickSel('[data-monster-check-tab="art"]');
    await page.waitForTimeout(900);
    check('画像タブに本番の表示条件が並ぶ', await page.evaluate(() => !!document.querySelector('[data-monster-check-tab-art]')));
    await clickSel('[data-monster-check-open-image]');
    await page.waitForTimeout(1200);
    check('「染色をくわしく見る」で画像・染色確認へ移れる',
      await page.evaluate(() => document.body.innerText.includes('モンスター画像・染色確認')
        && !document.body.innerText.includes('確認できる所持モンスター個体がありません')));

    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('実ブラウザで確認できた', false, String(e && e.message || e));
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }
  console.log(failed ? `\nNG ${failed} 件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
