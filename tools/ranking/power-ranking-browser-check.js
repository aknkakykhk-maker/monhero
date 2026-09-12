// 総合力ランキングのタブを、Supabaseをスタブした実ブラウザで開いて確かめる。
//
//   python3 -m http.server 8899 でリポジトリのルートを配信した状態で
//   node ranking/power-ranking-browser-check.js
//
// 文字列の検査(power-ranking-check.js)では「タブを開いた瞬間だけ真っ白になる」類を拾えない。
// ここでは実際にバトル → 「総合力」タブまで進み、次の4つを見る。
//
//   ① タブが開いて一覧が出る(実行時エラーが出ない)
//   ② 絆Lvの順ではなく、総合力の高い順に並ぶ
//   ③ 総合力が残っていない古い記録は載らない(「情報なし」の行も作らない)
//   ④ 行の「詳細 ›」から1体ぶんの詳細が開く
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

// 絆Lvの並びと総合力の並びがわざと食い違うようにしてある。
//   絆Lv順   … 絆ノ介(99) → 力太郎(40) → 古兵衛(70・総合力なし)
//   総合力順 … 力太郎(52000) → 絆ノ介(9000)
const detailOf = (name, power) => ({ v: 6, name, bondXp: 9000, levelCap: 35,
  statPoints: { hp: 3, atk: 4, def: 1, guts: 2 }, ...(power == null ? {} : { power }) });
const BOND_ROWS = [
  { user_name: '絆ノ介', individual_id: 'm-1', monster_id: 'Mocchi', mon_name: 'モッチー', bond_level: 99, icon: null,
    detail: detailOf('きずなモッチ', 9000), colors: [] },
  { user_name: '力太郎', individual_id: 'm-2', monster_id: 'Suezo', mon_name: 'スエゾー', bond_level: 40, icon: null,
    detail: detailOf('ちからスエ', 52000), colors: [] },
  // 育て方が記録に残る前の古い記録。絆Lvランキングには出るが、総合力ランキングには出ない
  { user_name: '古兵衛', individual_id: 'legacy:Golem', monster_id: 'Golem', mon_name: 'ゴーレム', bond_level: 70, icon: null,
    detail: null, colors: [] },
];
const RANKING_ROWS = [
  { user_name: '記録だけ次郎', hero: 'ピクシー', score: 100, level: 5, icon: null,
    party: [{ role: 'hero', baseId: 'Pixie', masuId: 'm-9', name: 'ピクシー', bondLevel: 21,
      detail: detailOf('じろピク', 30000) }] },
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

const cardsOf = (page, kind) => page.evaluate((k) => [...document.querySelectorAll(`[data-ranking-kind="${k}"]`)]
  .map(el => el.innerText.replace(/\s+/g, ' ')), kind);

async function openTab(page, label) {
  await page.evaluate((text) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === text);
    if (b) b.click();
  }, label);
  await page.waitForTimeout(3500);
}

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', e => fatal.push(e.message));
  await page.addInitScript(seed);
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') { await route.fulfill({ status: 201, body: '' }); return; }
    if (url.pathname.endsWith('/bond_levels')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOND_ROWS) });
      return;
    }
    if (url.pathname.endsWith('/rankings')) {
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

  // 上のタブが4つ並んでいること(モード選択・ブリーダーLv・絆Lv・総合力)
  const tabs = await page.evaluate(() => [...document.querySelectorAll('button[aria-label$="ランキング"], button[aria-label="モード選択"]')]
    .map(b => b.textContent.trim()));
  check('上のタブが4つ並ぶ', ['モード選択', 'ブリーダーLv', '絆Lv', '総合力'].every(t => tabs.includes(t)), tabs.join(' / '));

  // まず絆Lvタブ。こちらは古い記録も含めて並ぶ(見え方が変わっていないことの確認)
  await openTab(page, '絆Lv');
  const bondCards = await cardsOf(page, 'bond');
  check('絆Lvタブはこれまでどおり絆Lvの高い順', /絆ノ介/.test(bondCards[0] || ''), bondCards.join(' / '));
  check('絆Lvタブには総合力の無い古い記録も出る', bondCards.some(t => t.includes('古兵衛')), bondCards.join(' / '));

  // 総合力タブ
  await openTab(page, '総合力');
  const powerCards = await cardsOf(page, 'power');
  check('総合力タブが開いて一覧が出る', powerCards.length > 0, `${powerCards.length}件`);
  check('総合力の高い順に並ぶ(絆Lvの順ではない)',
    /力太郎/.test(powerCards[0] || '') && /絆ノ介/.test(powerCards[powerCards.length - 1] || ''), powerCards.join(' / '));
  check('記録から補った人も載る', powerCards.some(t => t.includes('記録だけ次郎')), powerCards.join(' / '));
  check('総合力が残っていない古い記録は載らない', !powerCards.some(t => t.includes('古兵衛')), powerCards.join(' / '));
  check('「情報なし」の行を作らない', !powerCards.some(t => t.includes('情報なし')), powerCards.join(' / '));
  check('総合力の数字が桁区切りで出る', powerCards.some(t => t.includes('52,000')), powerCards[0] || '');
  check('絆Lvも小さく添える', powerCards.some(t => t.includes('絆Lv.40')), powerCards[0] || '');

  // 種族タブ。絆Lvと同じ「すべて＋種族別」
  const speciesTabs = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map(b => b.textContent.trim()).filter(t => t === 'すべて' || /種$/.test(t)));
  check('種族タブが「すべて」から並ぶ', speciesTabs[0] === 'すべて' && speciesTabs.length > 3, speciesTabs.slice(0, 6).join(' / '));

  // 行の「詳細 ›」から1体ぶんの詳細が開く
  const opened = await page.evaluate(async () => {
    const card = [...document.querySelectorAll('[data-ranking-kind="power"]')]
      .find(c => c.querySelector('button[data-power-detail="open"]'));
    if (!card) return false;
    card.querySelector('button[data-power-detail="open"]').click();
    return true;
  });
  await page.waitForTimeout(1500);
  const dialogText = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return dlg ? dlg.innerText.replace(/\s+/g, ' ') : '';
  });
  check('「詳細 ›」から1体ぶんの詳細が開く', opened && /ちからスエ/.test(dialogText), dialogText.slice(0, 80));

  check('実行時エラーが出ていない', fatal.length === 0, fatal.join(' / '));
  await browser.close();
}

run().then(() => {
  const ng = results.filter(r => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目が成功`);
  process.exit(ng ? 1 : 0);
}).catch(e => { console.error(e); process.exit(1); });
