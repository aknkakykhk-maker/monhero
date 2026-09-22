const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// バトル中に開くパネルが、画面の揺れで位置ずれしないことを確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/battle/battle-menu-shake-check.js
//
// 【なぜ要るか】
// 2026-09-22・ユーザー報告「オートでオプション開くと行動によって位置ずれが起きる」。
// 画面の揺れは transform で作ってある(70-bootstrap.jsx の @keyframes screenShake)。
// CSSでは **transform の掛かった要素が、中の position:fixed の containing block になる**ため、
// 揺れているあいだだけ、パネルの基準が viewport から「揺れる箱」へ変わる。
// 箱は body の内側にあるので、iPhoneのノッチ(safe-area)ぶん下へ落ちる。
// 実測(390x844・safe-area 47px相当)では、直す前は 52px → 95px と43pxずれていた。
//
// 揺れる箱の中に position:fixed のパネルを置くかぎり必ず再発するので、
//   ① パネルは body の直下へ出す(ReactDOM.createPortal)
//   ② 実際に揺らして位置が変わらないことを見る
// の2本立てで見張る。演出(ダメージ・技名)は揺れと一緒に動くほうが自然なので対象外。
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const { REPO_ROOT } = require(path.join(TOOLS_DIR, 'harness'));
const { eventStorySeed } = require(path.join(TOOLS_DIR, 'boot/quiet-boot-seed'));

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const part = (name) => fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts', name), 'utf8');

// ===== ① 置き場所(静的) =====
const battle = part('71-screen-battle.jsx');
const app = part('60-app.jsx');
check('①-1 設定パネルは body の直下へ出している',
  /\{showBattleMenu&&ReactDOM\.createPortal\(\(/.test(battle) && /\), document\.body\)\}/.test(battle));
check('①-2 「あきらめる」の確認も body の直下へ出している',
  /\{showQuitConfirm&&ReactDOM\.createPortal\(\(/.test(app));
// ★揺れは transform。ここが transform 以外(left/top など)へ変わったなら、
//   この検査の前提が変わるので気づけるようにしておく
check('①-3 画面の揺れは transform で作っている(前提)',
  /@keyframes screenShake \{[\s\S]{0,200}?transform: translate\(/.test(part('70-bootstrap.jsx')));

const seed = () => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3); put('mh_quick_clears_Beginner', 3);
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.addInitScript(seed);
  await page.addInitScript(eventStorySeed());

  const clickMatching = (p) => page.evaluate((s) => { const b = [...document.querySelectorAll('button')].find(x => new RegExp(s).test((x.innerText || '').replace(/\s+/g, ' ').trim())); if (b) b.click(); return !!b; }, p);
  const clickExact = (w) => page.evaluate((s) => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === s); if (b) b.click(); return !!b; }, w);
  const dismiss = async () => {
    for (let i = 0; i < 12; i++) {
      const closed = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => /^(確認|受け取る|閉じる|とじる|OK|スキップ)$/.test((x.innerText || '').trim()));
        if (b) { b.click(); return true; }
        const d = document.querySelector('[role="dialog"]');
        if (d) { (d.querySelector('button') || d).click(); return true; }
        return false;
      });
      if (!closed) break;
      await page.waitForTimeout(400);
    }
  };

  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('TAP TO START')); b?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    await dismiss();
    await page.evaluate(() => document.querySelector('button[aria-label="モンヒロバトル"]')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector('[data-battle-system="systemQuick"]')?.click());
    await page.waitForTimeout(1300);
    await clickMatching('この難易度で挑戦');
    await page.waitForTimeout(1500);
    await page.evaluate(() => { [...document.querySelectorAll('article,button')].find(x => /スエゾー/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await clickMatching('勇者モンに選ぶ');
    await page.waitForTimeout(900);
    await page.evaluate(() => { [...document.querySelectorAll('button')].find(x => /近距離|中距離|零距離|遠距離/.test(x.textContent))?.click(); });
    await page.waitForTimeout(1300);
    await dismiss();
    await page.evaluate(() => { [...document.querySelectorAll('button')].find(x => /新規習得/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await clickExact('習得する');
    await page.waitForTimeout(1800);
    await dismiss();
    check('②-1 バトル画面へ入れる', await page.evaluate(() => !!document.querySelector('button[aria-label^="設定"]')));

    // ★iPhoneのノッチ(safe-area)を模す。ここが0だと、ずれても差が出ずに見逃す
    await page.evaluate(() => { document.body.style.paddingTop = '47px'; });
    const openAndMeasure = async (shake) => {
      if (shake) {
        await page.evaluate(() => {
          const box = [...document.querySelectorAll('div')].find(d => d.className === 'relative z-10 h-full flex flex-col');
          if (box) box.style.animation = 'screenShake 4000ms ease-in-out';
        });
      }
      await page.evaluate(() => document.querySelector('button[aria-label^="設定"]')?.click());
      await page.waitForTimeout(400);
      const rect = await page.evaluate(() => {
        const m = document.querySelector('[data-battle-menu]');
        if (!m) return null;
        const b = m.getBoundingClientRect();
        return { top: Math.round(b.top), right: Math.round(b.right), inBody: m.closest('[data-mh-view-rotation]') === null };
      });
      await page.evaluate(() => { const o = document.querySelector('[data-battle-menu]')?.parentElement; if (o) o.click(); });
      await page.waitForTimeout(300);
      if (shake) await page.evaluate(() => { const box = [...document.querySelectorAll('div')].find(d => d.className === 'relative z-10 h-full flex flex-col'); if (box) box.style.animation = ''; });
      return rect;
    };
    const still = await openAndMeasure(false);
    check('②-2 設定パネルが開く', !!still, still ? `y=${still.top} x=${still.right}` : '');
    check('②-3 パネルは画面の箱の外(body直下)に出ている', !!still && still.inBody === true);
    const shaking = await openAndMeasure(true);
    check('②-4 揺れていても位置が変わらない',
      !!shaking && !!still && shaking.top === still.top && shaking.right === still.right,
      shaking && still ? `揺れなし y=${still.top} / 揺れあり y=${shaking.top}（差 ${shaking.top - still.top}px）` : '測れませんでした');
    check('②-5 操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } catch (e) {
    check('実ブラウザでの確認が最後まで進む', false, e.message.slice(0, 120));
  } finally {
    await browser.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
