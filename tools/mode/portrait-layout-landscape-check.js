// 横画面のまま縦向き専用の画面(バトル・HOME)へ来たときに、
// 中身が横へ間延びせず、縦向きの幅のまま真ん中に置かれるかを実ブラウザで確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/portrait-layout-landscape-check.js
//
// 2026-09-07・ユーザー報告
//   「バトルは横画面に対応してないから横画面のままバトルに戻ると表示がやばいね」
//
// 一覧を持つ画面(data-mh-screen > .mh-scroll)は、横画面では
// 「左＝見出し・右＝一覧」の2列へ組み替わる作りが既にある(index.html)。
// バトルとHOMEはその骨組みの外で、縦向きの高さ配分で組んであるため、
// 幅だけ1024pxへ広がって間延びしていた。
//
// ★Tailwind の CDN はこのサンドボックスへ届かないが、ここで見たいのは
//   index.html の素のCSSなので、実際の見え方をそのまま測れる。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

const seed = () => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3);
  put('mh_quick_clears_Beginner', 3);
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // 横持ちのiPhone相当。高さ600px以下なので「横画面の共通レイアウト」が効く条件
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.route('**cdn.tailwindcss.com**', (r) => r.abort()).catch(() => {});
  await page.addInitScript(seed);

  const pointerDown = (find) => page.evaluate((f) => {
    const b = f.aria ? document.querySelector(`button[aria-label="${f.aria}"]`)
      : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(f.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, find);
  const clickMatching = (pattern) => page.evaluate((p) => {
    const b = [...document.querySelectorAll('button')].find((x) => new RegExp(p).test((x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (b) b.click();
    return !!b;
  }, pattern);
  const clickExact = (label) => page.evaluate((wanted) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === wanted);
    if (b) b.click();
    return !!b;
  }, label);
  const dismissOverlays = async () => {
    for (let i = 0; i < 12; i++) {
      const closed = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|とじる|OK)$/.test((x.innerText || '').trim()));
        if (b) { b.click(); return true; }
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) { (dialog.querySelector('button') || dialog).click(); return true; }
        return false;
      });
      if (!closed) break;
      await page.waitForTimeout(400);
    }
  };
  // ルートの器を測る。中身が画面いっぱいへ広がっていないかを見る
  const shell = () => page.evaluate(() => {
    const el = document.querySelector('#root > div');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      width: Math.round(r.width),
      left: Math.round(r.left),
      viewport: window.innerWidth,
      portraitLayout: el.getAttribute('data-mh-portrait-layout'),
      maxWidth: getComputedStyle(el).maxWidth,
    };
  });

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2200);
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2200);
    await dismissOverlays();

    // ---- HOME ----
    // ★HOMEは横向き用のCSS(施設を左右へ置き直す)を自前で持っているので、
    //   縦の枠へ押し込んではいけない。今までどおり横を広く使うのが正しい
    const home = await shell();
    check('HOMEには縦向きの目印を付けない', !!home && home.portraitLayout === 'false', home ? `目印=${home.portraitLayout}` : 'なし');
    check('HOMEは今までどおり横を広く使う',
      !!home && home.width > home.viewport * 0.7,
      home ? `器 ${home.width}px / 画面 ${home.viewport}px（max-width:${home.maxWidth}）` : 'なし');
    // 横向き用のCSSが生きていること(施設が左右へ散っている)
    const facilities = await page.evaluate(() => {
      const list = [...document.querySelectorAll('.mh-home-facility')];
      if (!list.length) return null;
      const xs = list.map((el) => el.getBoundingClientRect().left);
      return { count: list.length, spread: Math.round(Math.max(...xs) - Math.min(...xs)) };
    });
    check('HOMEの施設が左右へ散っている（横向きの並びが生きている）',
      !!facilities && facilities.spread > 200,
      facilities ? `${facilities.count}件・左右の開き ${facilities.spread}px` : '施設が見つからない');

    // 一覧を持つ画面(2列へ組み替える作り)を壊していないことは、
    // 共通の指定(max-width:1024px)が生きていることで見る。
    // ★マーケットなどへ寄り道してから戻る手順は、戻るボタンの名前が画面ごとに違って
    //   途中で止まりやすい。ここではHOMEのまま確かめてバトルへ直行する
    check('横画面の共通レイアウトが生きている（一覧の画面を壊していない）',
      !!home && home.maxWidth === '1024px', home ? `max-width:${home.maxWidth}` : 'なし');

    // ---- バトルまで行く ----
    await page.evaluate(() => document.querySelector('button[aria-label="バトル"]')?.click());
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const card = [...document.querySelectorAll('article')].find((a) => a.textContent.includes('クイックモード'));
      const b = card && [...card.querySelectorAll('button')].find((x) => /難易度を選ぶ/.test(x.textContent));
      b?.click();
    });
    await page.waitForTimeout(1500);
    await clickMatching('この難易度で挑戦');
    await page.waitForTimeout(1800);
    await page.evaluate(() => { [...document.querySelectorAll('article,button')].find((x) => /スエゾー/.test(x.textContent))?.click(); });
    await page.waitForTimeout(1000);
    await clickMatching('勇者モンに選ぶ');
    await page.waitForTimeout(1000);
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /近距離|中距離|零距離|遠距離/.test(x.textContent))?.click(); });
    await page.waitForTimeout(1500);
    await dismissOverlays();
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /新規習得/.test(x.textContent))?.click(); });
    await page.waitForTimeout(1000);
    await clickExact('習得する');
    await page.waitForTimeout(2000);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label^="AUTO"]'), { timeout: 30000 }).catch(() => {});

    const reached = await page.evaluate(() => !!document.querySelector('button[aria-label^="AUTO"]'));
    check('バトル画面まで来られた', reached,
      reached ? '' : (await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 100))));
    if (reached) {
      const battle = await shell();
      check('バトルに縦向きの目印が付く', !!battle && battle.portraitLayout === 'true', battle ? `目印=${battle.portraitLayout}` : 'なし');
      check('バトルが横いっぱいに広がらない',
        !!battle && battle.width <= battle.viewport * 0.7,
        battle ? `器 ${battle.width}px / 画面 ${battle.viewport}px（max-width:${battle.maxWidth}）` : 'なし');
      check('バトルが真ん中に置かれる',
        !!battle && Math.abs(battle.left - (battle.viewport - battle.width) / 2) <= 2,
        battle ? `左端 ${battle.left}px` : 'なし');
      // 中身が器からはみ出していないこと(横スクロールが出ていない)
      const overflow = await page.evaluate(() => {
        const el = document.querySelector('#root > div');
        return el ? Math.round(el.scrollWidth - el.clientWidth) : null;
      });
      check('中身が器からはみ出さない', overflow !== null && overflow <= 1, `はみ出し ${overflow}px`);
    }

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
