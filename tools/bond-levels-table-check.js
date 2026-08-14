// 絆Lvの正本テーブル(bond_levels)まわりを、Supabaseをスタブした実ブラウザで確認する。
//
//   python3 -m http.server 8899 でリポジトリのルートを配信した状態で
//   node bond-levels-table-check.js
//
// 見たいのは次の2つ。
//   ① テーブルがある場合  … 正本の一覧が出て、記録が少ない人も消えない。
//                            正本にまだ載っていない人は rankings の集計で補われる
//   ② テーブルが無い場合  … 404(PGRST205)を返しても画面が壊れず、
//                            今までどおり rankings の集計だけで一覧が出る
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

// 正本テーブルにいる人(よく遊ぶ人も、記録が1件だけの人も1行ずつ)
const BOND_ROWS = [
  { user_name: 'ヘビー太郎', individual_id: 'm-1', monster_id: 'Mocchi', mon_name: 'モッチー', bond_level: 88, icon: null, detail: { v: 2 }, colors: [] },
  { user_name: 'ライト花子', individual_id: 'm-2', monster_id: 'Suezo', mon_name: 'スエゾー', bond_level: 12, icon: null, detail: null, colors: [] },
  { user_name: 'ライト三郎', individual_id: 'legacy:Golem', monster_id: 'Golem', mon_name: 'ゴーレム', bond_level: 3, icon: null, detail: null, colors: [] },
];
// rankings 側にしかいない人(正本へまだ書き込んでいない＝適用直後の状態)
const RANKING_ROWS = [
  { user_name: '記録だけ次郎', hero: 'モッチー', score: 100, level: 5, icon: null,
    party: [{ role: 'hero', baseId: 'Pixie', masuId: 'm-9', name: 'ピクシー', bondLevel: 21 }] },
];

const seed = () => {
  const put = (key, value) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); };
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_masu_migrated', true);
};

async function openBondRanking(page, { bondTableExists }) {
  const calls = [];
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    calls.push({ path: url.pathname, method: route.request().method() });
    if (url.pathname.endsWith('/bond_levels')) {
      if (!bondTableExists) {
        await route.fulfill({ status: 404, contentType: 'application/json',
          body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.bond_levels'" }) });
        return;
      }
      if (route.request().method() !== 'GET') { await route.fulfill({ status: 201, body: '' }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOND_ROWS) });
      return;
    }
    if (url.pathname.endsWith('/rankings')) {
      if (route.request().method() !== 'GET') { await route.fulfill({ status: 201, body: '' }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RANKING_ROWS) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  const down = (f) => page.evaluate((s) => {
    const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
      : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, f);
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await down({ text: 'TAP TO START' });
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
  await down({ aria: 'トップ画面へ進む' });
  await page.waitForTimeout(3000);
  for (let i = 0; i < 8; i++) {
    const closed = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /受け取|閉じる|あとで|スキップ/.test(x.textContent));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(600);
    if (!closed) break;
  }
  await page.evaluate(() => { const b = document.querySelector('button[aria-label="バトル"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '絆Lv'); if (b) b.click(); });
  await page.waitForTimeout(4000);
  const names = await page.evaluate(() => [...document.querySelectorAll('[data-ranking-kind="bond"]')].map(el => el.innerText.replace(/\s+/g, ' ')));
  return { names, calls };
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  await page_run(browser, true);
  await page_run(browser, false);
  const ng = results.filter(r => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目が成功`);
  await browser.close();
  process.exit(ng ? 1 : 0);

  async function page_run(browser, bondTableExists) {
    const label = bondTableExists ? 'テーブルあり' : 'テーブル無し(適用前)';
    console.log(`\n== ${label} ==`);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const fatal = [];
    page.on('pageerror', e => fatal.push(e.message));
    await page.route('**cdn.tailwindcss.com**', r => r.abort()).catch(() => {});
    await page.addInitScript(seed);
    const { names, calls } = await openBondRanking(page, { bondTableExists });
    const has = (n) => names.some(t => t.includes(n));
    const askedBond = calls.some(c => c.path.endsWith('/bond_levels') && c.method === 'GET');
    check(`${label}: bond_levels を読みにいく`, askedBond);
    if (bondTableExists) {
      check(`${label}: 正本にいる人が全員出る`, has('ヘビー太郎') && has('ライト花子') && has('ライト三郎'), names.join(' / '));
      check(`${label}: 正本にまだ無い人は記録から補う`, has('記録だけ次郎'), names.join(' / '));
      check(`${label}: 絆Lvの高い順に並ぶ`, /ヘビー太郎/.test(names[0] || ''), names[0] || '');
      check(`${label}: 同じ個体が重複しない`, names.filter(t => t.includes('ヘビー太郎')).length === 1);
    } else {
      check(`${label}: 記録からの集計だけで一覧が出る`, has('記録だけ次郎'), names.join(' / '));
      check(`${label}: 正本の人は出ない(まだ書かれていないため)`, !has('ヘビー太郎'));
    }
    check(`${label}: 致命的なJSエラーが出ない`, fatal.length === 0, fatal.slice(0, 2).join(' / '));
    await page.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
