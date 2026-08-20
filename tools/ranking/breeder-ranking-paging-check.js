// ブリーダーLvランキングが「よく遊ぶ人の記録に枠を食われて下位の人が消える」状態に
// 戻っていないかを、Supabaseをスタブした実ブラウザで確かめる。
//
// rankings は 1プレイ=1行 で、各行にそのときのブリーダーLvが入っている。
// 「Lvの高い順に上位N行」だけを取る作りだと、記録の多い人が枠を埋め尽くし、
// Lvの低い人は1行も取れずに一覧から丸ごと消える(60行のときと400行のときの2度発生)。
// ここでは高Lvの人に大量の記録を持たせ、Lvの低い人が最後まで出ることを確認する。
//
//   python3 -m http.server 8899 でリポジトリのルートを配信した状態で
//   node ranking/breeder-ranking-paging-check.js
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

// 重い人(たくさん遊んでいる人)と、記録が1件しかない軽い人を混ぜる。
// 重い人の行数だけで、以前の取得枠(400行)をはっきり超えるようにする
const HEAVY = [['ヘビー太郎', 300, 1200], ['ヘビー次郎', 200, 900]];
const LIGHT = [['ライト花子', 30], ['ライト次郎', 12], ['ライト三郎', 3]];

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

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', e => fatal.push(e.message));
  await page.route('**cdn.tailwindcss.com**', r => r.abort()).catch(() => {});
  await page.addInitScript(seed);

  // 全行を作っておき、要求された order/limit/offset のとおりに切り出して返す
  const requests = [];
  await page.route('**/rest/v1/rankings**', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') { await route.fulfill({ status: 201, body: '' }); return; }
    const rows = [];
    for (const [name, count, top] of HEAVY) {
      for (let i = 0; i < count; i++) rows.push({ user_name: name, level: top - i, icon: null, hero: 'モッチー', score: 100, party: [] });
    }
    for (const [name, level] of LIGHT) rows.push({ user_name: name, level, icon: null, hero: 'モッチー', score: 50, party: [] });
    const order = url.searchParams.get('order') || '';
    if (order.startsWith('level.desc')) rows.sort((a, b) => b.level - a.level);
    const limit = Number(url.searchParams.get('limit')) || rows.length;
    const offset = Number(url.searchParams.get('offset')) || 0;
    // サーバー側の1ページ上限を模して、要求より少なく返す場面も作る
    const pageRows = rows.slice(offset, offset + Math.min(limit, 500));
    requests.push({ order, limit, offset, returned: pageRows.length });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pageRows) });
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
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'ブリーダーLv'); if (b) b.click(); });
  await page.waitForTimeout(4000);
  await page.waitForFunction(() => document.querySelectorAll('[data-ranking-kind="breeder"]').length > 0, { timeout: 30000 }).catch(() => {});

  const names = await page.evaluate(() => [...document.querySelectorAll('[data-ranking-kind="breeder"]')].map(el => el.innerText.replace(/\s+/g, ' ')));
  const has = (n) => names.some(t => t.includes(n));
  check('よく遊ぶ人が一覧に出る', has('ヘビー太郎') && has('ヘビー次郎'), names.length + '件');
  for (const [name, level] of LIGHT) check(`記録が少ない ${name}(Lv.${level}) も消えない`, has(name), names.join(' / '));
  check('同じ人が何行も持っていても一覧では1件にまとまる',
    names.filter(t => t.includes('ヘビー太郎')).length === 1);
  check('Lvの高い順に並ぶ', /ヘビー太郎/.test(names[0] || ''), names[0] || '');
  const paged = requests.filter(r => r.order.startsWith('level.desc'));
  check('1回の取得で打ち切らずページ送りしている', paged.length >= 2, paged.map(r => `${r.offset}+${r.returned}`).join(', '));
  check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  const ng = results.filter(r => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目が成功`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
