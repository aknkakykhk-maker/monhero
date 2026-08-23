// マスモンの詳細・強化・超越強化を実ブラウザで開き、全画面のレイヤーが重なっていないか確かめる。
//
//   python3 tools/serve.py でリポジトリのルートを配信した状態で
//   node tools/masu/masu-enhance-layer-check.js
//
// 【なぜ道具にするか】
// 詳細モーダルは `masuMonDetail && gameState !== 'MASU_ENHANCE'` で出していたため、
// 強化の画面を1つ増やしたときに除外し忘れ、詳細(z=31000)が超越強化(z=30000)を
// まるごと覆ってしまった。画面は真っ黒にならず、詳細モーダルがふつうに出るので
// 「超越強化を開いたのに詳細が出る」「閉じると暗い画面が残る」という形で現れ、
// JSの実行時エラーも出ないため render-error-check.js では拾えない。
// ここでは実際に開いて「画面いっぱいの不透明なレイヤーが同時に2枚無いか」を測る。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const seed = () => {
  localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
  localStorage.setItem('mh_breeder_icon', JSON.stringify('Mocchi'));
  localStorage.setItem('mh_onboarded', JSON.stringify(true));
  localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
  localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
  localStorage.setItem('mh_gold', JSON.stringify(99999));
  localStorage.setItem('mh_owned_items', JSON.stringify({ rainbow_psyche: 3500 }));
  // 超越強化はどのマスモンでも使える。ここでは「まだ超越していない・低Lv・0凸」で確かめる
  localStorage.setItem('mh_masu_mons', JSON.stringify([
    { id: 't1', baseId: 'Golem', name: 'レイヤーテスト', bondXp: 0, rebirthCount: 0, levelCap: 30,
      distAptPoints: 3, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 } },
  ]));
};

// 画面をほぼ覆う「不透明な」レイヤーを数える。すりガラス状の薄い膜は数えない
const fullScreenLayers = () => [...document.querySelectorAll('body *')].filter((el) => {
  const cs = getComputedStyle(el);
  if (cs.position !== 'fixed' && cs.position !== 'absolute') return false;
  if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.5) return false;
  const alpha = (cs.backgroundColor.match(/rgba?\([^)]*?,\s*([\d.]+)\)$/) || [, '1'])[1];
  if (Number(alpha) < 0.5) return false;
  const r = el.getBoundingClientRect();
  return r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9;
}).map((el) => `${el.getAttribute('data-transcend-enhance') ? '超越強化' : (el.className || '').toString().slice(0, 24)}@z${getComputedStyle(el).zIndex}`);

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
    const clickText = (re) => page.evaluate((p) => {
      const b = [...document.querySelectorAll('button')].find(x => new RegExp(p).test(x.textContent));
      if (b) b.click();
      return !!b;
    }, re);
    const clickAria = (a) => page.evaluate((x) => {
      const b = document.querySelector(`button[aria-label="${x}"]`);
      if (b) b.click();
      return !!b;
    }, a);
    const clickAny = (t) => page.evaluate((x) => {
      const e = [...document.querySelectorAll('button,article,[role=button]')].find(y => y.textContent.includes(x));
      if (e) e.click();
      return !!e;
    }, t);
    const layers = () => page.evaluate(fullScreenLayers);

    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2500);
    // ログインボーナス・助手の案内・お詫びなど、重なっているものを順に閉じる。
    // 「すべて受け取る」のような画面を移動するボタンを踏まないよう、閉じる系だけを押す
    for (let i = 0; i < 30; i++) {
      const closed = await page.evaluate(() => {
        const overlay = [...document.querySelectorAll('body *')].filter((el) => {
          const cs = getComputedStyle(el);
          return cs.position === 'fixed' && Number(cs.zIndex || 0) >= 30000 && el.getBoundingClientRect().height > innerHeight * 0.3;
        }).pop();
        if (!overlay) return false;
        const buttons = [...overlay.querySelectorAll('button')];
        const b = buttons.find(x => /閉じる|とじる|つぎへ|次へ|確認|わかった|OK|はい|あとで|スキップ/.test(x.textContent))
          || buttons.find(x => x.querySelector('svg')) || buttons[buttons.length - 1];
        if (b) b.click();
        return !!b;
      });
      await page.waitForTimeout(450);
      if (!closed) break;
    }
    // HOMEに戻れているか(戻れていなければ戻るボタンを押す)
    for (let i = 0; i < 5; i++) {
      if (await page.evaluate(() => !!document.querySelector('button[aria-label="M/B管理"]'))) break;
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.querySelector('svg') && /p-3/.test(x.className)); b && b.click(); });
      await page.waitForTimeout(800);
    }

    check('HOMEまで進める', await clickAria('M/B管理')); await page.waitForTimeout(1200);
    await clickText('^マスモン一覧'); await page.waitForTimeout(1500);
    await clickText('^確認$'); await page.waitForTimeout(700);
    check('マスモンの詳細を開ける', await clickAny('レイヤーテスト'));
    await page.waitForTimeout(1500);
    const atDetail = await layers();
    check('詳細だけが出ている', atDetail.length === 1, atDetail.join(' + ') || 'なし');

    check('強化を開ける', await clickAria('レイヤーテストを強化'));
    await page.waitForTimeout(1500);
    const atEnhance = await layers();
    check('通常強化で詳細が重なっていない', atEnhance.length === 1, atEnhance.join(' + ') || 'なし');

    check('未超越・低Lvでも超越強化を開ける', await clickText('^超越強化$'));
    await page.waitForTimeout(1500);
    const atTranscend = await layers();
    check('超越強化で詳細が重なっていない', atTranscend.length === 1 && atTranscend[0].startsWith('超越強化'),
      atTranscend.join(' + ') || 'なし');
    // 覆われていると操作まで届かない。実際に押せるところまで確かめる
    const reachable = (selector) => page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { found: false };
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return { found: true, reachable: false, why: 'サイズが0' };
      const x = Math.min(innerWidth - 2, Math.max(2, r.left + r.width / 2));
      const y = Math.min(innerHeight - 2, Math.max(2, r.top + r.height / 2));
      const top = document.elementFromPoint(x, y);
      const ok = !!top && (el.contains(top) || top.contains(el));
      return { found: true, reachable: ok, why: ok ? '' : `${top ? top.tagName + '.' + (top.className || '').toString().slice(0, 30) : 'なし'} が手前` };
    }, selector);
    const openEntry = await reachable('[data-transcend-exchange-open]');
    check('プシュケー変換の入口が実際に押せる', openEntry.found && openEntry.reachable, JSON.stringify(openEntry));
    // 変換は専用のシートへ分けてある。開いて中身が押せるところまで見る
    await page.evaluate(() => { const b = document.querySelector('[data-transcend-exchange-open]'); b && b.click(); });
    await page.waitForTimeout(900);
    check('変換シートが開く', await page.evaluate(() => !!document.querySelector('[data-transcend-exchange-sheet]')));
    const commit = await reachable('[data-transcend-exchange-commit]');
    check('変換の確定ボタンが実際に押せる', commit.found && commit.reachable, JSON.stringify(commit));
    check('交換レートを画面に出している',
      await page.evaluate(() => /🌈1,000 → 1P/.test(document.body.innerText)));
    // 実際に変換して、超越ポイントが増え、虹のプシュケーがレートぶんだけ減るか
    const beforeExchange = await page.evaluate(() => ({
      points: Number((document.querySelector('[data-transcend-points]') || {}).textContent.replace(/[^0-9].*$/, '')) || 0,
      psyche: JSON.parse(localStorage.getItem('mh_owned_items') || '{}').rainbow_psyche || 0,
    }));
    await page.evaluate(() => { const b = document.querySelector('[data-transcend-exchange-commit]'); b && b.click(); });
    await page.waitForTimeout(1500);
    const afterExchange = await page.evaluate(() => ({
      sheet: !!document.querySelector('[data-transcend-exchange-sheet]'),
      points: Number((document.querySelector('[data-transcend-points]') || {}).textContent.replace(/[^0-9].*$/, '')) || 0,
      psyche: JSON.parse(localStorage.getItem('mh_owned_items') || '{}').rainbow_psyche || 0,
    }));
    check('変換すると超越ポイントが1増える', afterExchange.points === beforeExchange.points + 1,
      `${beforeExchange.points} → ${afterExchange.points}`);
    check('虹のプシュケーがレートぶんだけ減る', beforeExchange.psyche - afterExchange.psyche === 1000,
      `${beforeExchange.psyche} → ${afterExchange.psyche}`);
    check('変換したらシートが閉じる', !afterExchange.sheet);
    await page.evaluate(() => { const b = document.querySelector('[data-transcend-exchange-open]'); b && b.click(); });
    await page.waitForTimeout(700);
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-transcend-exchange-sheet] button')].find(x => x.textContent.includes('閉じる')); b && b.click(); });
    await page.waitForTimeout(900);
    check('変換シートを閉じると振り分けへ戻る',
      await page.evaluate(() => !document.querySelector('[data-transcend-exchange-sheet]')));
    const afterSheet = await layers();
    check('変換シートを閉じたあとに暗いレイヤーが残らない', afterSheet.length === 1, afterSheet.join(' + ') || 'なし');

    // 実際に振って、基礎値と総合力へ反映されるか。超越済みでないことも確かめる
    const beforePlan = await page.evaluate(() => (document.body.innerText.match(/総合力[^0-9]*([\d,]+)/) || [])[1] || '');
    await page.evaluate(() => { const b = [...document.querySelectorAll('[data-transcend-enhance] button')].find(x => x.getAttribute('aria-label') === 'ライフの基礎値を上げる'); b && b.click(); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { const b = document.querySelector('[data-transcend-commit]'); b && b.click(); });
    await page.waitForTimeout(1500);
    const afterPlan = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('mh_masu_mons') || '[]')[0] || {};
      return {
        hp: (saved.transcendStatPoints || {}).hp || 0,
        transcended: saved.transcended === true,
        levelCap: saved.levelCap,
        badge: !!document.querySelector('[data-transcend-enhance] .mh-transcend-badge'),
        power: (document.body.innerText.match(/総合力[^0-9]*([\d,]+)/) || [])[1] || '',
      };
    });
    check('未超越でも超越Pを基礎ライフへ振れる', afterPlan.hp === 10, `基礎+${afterPlan.hp}`);
    check('総合力が上がる', afterPlan.power !== beforePlan, `${beforePlan} → ${afterPlan.power}`);
    check('超越強化しても transcended は false のまま', afterPlan.transcended === false);
    check('Lv上限が勝手に500にならない', afterPlan.levelCap === 30, `上限${afterPlan.levelCap}`);
    check('超越マークが付かない', afterPlan.badge === false);

    check('超越強化から戻れる', await page.evaluate(() => {
      const b = document.querySelector('[data-transcend-enhance] button');
      if (b) b.click();
      return !!b;
    }));
    await page.waitForTimeout(1500);
    const afterBack = await layers();
    check('戻ったあとに暗いレイヤーが残らない', afterBack.length === 1, afterBack.join(' + ') || 'なし');
    check('戻り先が通常強化になっている', await page.evaluate(() => document.body.innerText.includes('マスモン強化')));

    check('実行時エラーが出ていない', errors.length === 0, errors[0] || '');
    await browser.close();
  } catch (e) {
    check('ブラウザで確認できた', false, e.message.split('\n')[0]);
    if (browser) await browser.close().catch(() => {});
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
