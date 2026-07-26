// ランキングの集計仕様を実ブラウザで確認する。
// Supabaseへの通信は差し替え(スタブ)で、次のような記録が既にある状態を作る。
//
//   アルファ  スコア9000 / ブリーダーLv10 / 絆Lv5   … 昔のハイスコア
//   アルファ  スコア 100 / ブリーダーLv30 / 絆Lv12  … 直近のプレイ(スコアは低い)
//   埋めNN    スコア8000〜 / ブリーダーLv1 / 絆Lv1  … スコア上位を埋める60件
//
// 期待する挙動:
//   ・スコアランキング … 1位はスコア9000で、レベル表示は当時のLv.10のまま(Lv.30にならない)
//   ・ブリーダーLvランキング … 直近のLv.30が出る(スコア上位50件に入っていなくても拾う)
//   ・絆Lvランキング … 直近の絆Lv.12が出る
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node ranking-check.js
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));

  await page.addInitScript(() => {
    localStorage.setItem('mh_breeder_name', JSON.stringify('テストブリーダー'));
    localStorage.setItem('mh_intro_done', JSON.stringify(true));
  });
  // Supabaseへのfetchを差し替える。orderパラメータに応じて並べ替えて返すので、
  // 「スコア順の取得」と「レベル順の取得」を分けている実装かどうかまで確認できる
  await page.addInitScript(() => {
    const orig = window.fetch.bind(window);
    window.__rankOrders = [];
    const party = (bond) => ([{ name: 'モッチー', emoji: '🍡', imgUrl: null, bondLevel: bond }, null, null]);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!url.includes('/rest/v1/rankings')) return orig(input, init);
      if (init && init.method && init.method !== 'GET') return new Response('', { status: 201 });
      const u = new URL(url);
      const order = u.searchParams.get('order') || '';
      window.__rankOrders.push(order);
      const rows = [
        { id: 1, user_name: 'アルファ', hero: 'モッチー', party: party(5), score: 9000, level: 10, icon: null },
        { id: 2, user_name: 'アルファ', hero: 'モッチー', party: party(12), score: 100, level: 30, icon: null },
      ];
      for (let i = 0; i < 60; i++) rows.push({ id: 100 + i, user_name: '埋め' + i, hero: 'モッチー', party: party(1), score: 8000 - i * 10, level: 1, icon: null });
      const sorted = order.startsWith('level.desc')
        ? rows.slice().sort((a, b) => b.level - a.level)
        : rows.slice().sort((a, b) => b.score - a.score);
      const limit = parseInt(u.searchParams.get('limit') || '50', 10);
      return new Response(JSON.stringify(sorted.slice(0, limit)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  });

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, { timeout: 60000 });
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 30000 }).catch(() => {});
  const startBtn = page.getByRole('button', { name: 'TAP TO START' });
  if (await startBtn.count()) { await startBtn.click(); await page.waitForTimeout(1500); }

  const bodyText = () => page.evaluate(() => (document.body ? document.body.innerText : ''));

  const rankBtn = page.getByRole('button', { name: /Ranking/i }).first();
  if (!(await rankBtn.count())) { check('ランキングを開ける', false, 'ボタンが見つからない'); await browser.close(); process.exit(1); }
  await rankBtn.click({ force: true });
  await page.waitForTimeout(1800);

  const orders = await page.evaluate(() => window.__rankOrders || []);
  check('スコア順とレベル順の2通りで取得している',
    orders.some(o => o.startsWith('score.desc')) && orders.some(o => o.startsWith('level.desc')),
    [...new Set(orders)].join(', '));

  // --- スコアランキング ---
  const scoreTxt = await bodyText();
  check('スコアランキングに9,000ptの記録が出る', scoreTxt.includes('9,000'));
  check('スコア1位のレベルは当時のLv.10のまま', scoreTxt.includes('Lv.10'));
  check('スコアランキングに直近の低スコア(100pt)が混ざらない', !/(^|\D)100 pt/.test(scoreTxt));
  check('スコアランキングに最新のLv.30が出ない(当時の値で固定)', !scoreTxt.includes('Lv.30'));

  // --- ブリーダーLvランキング ---
  const breederTab = page.getByRole('button', { name: 'ブリーダーLv', exact: true }).last();
  if (await breederTab.count()) { await breederTab.click({ force: true }); await page.waitForTimeout(700); }
  const breederTxt = await bodyText();
  check('ブリーダーLvランキングに最新のLv.30が出る', breederTxt.includes('Lv.30'));
  check('ブリーダーLvランキングにアルファが出る', breederTxt.includes('アルファ'));

  // --- 絆Lvランキング ---
  const bondTab = page.getByRole('button', { name: '絆Lv', exact: true }).last();
  if (await bondTab.count()) { await bondTab.click({ force: true }); await page.waitForTimeout(700); }
  const bondTxt = await bodyText();
  check('絆Lvランキングに最新の絆Lv.12が出る', bondTxt.includes('絆Lv.12'));
  check('絆Lvランキングが古い絆Lv.5で止まっていない', !/絆Lv\.5(\D|$)/.test(bondTxt) || bondTxt.includes('絆Lv.12'));

  check('致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  await page.screenshot({ path: path.join(__dirname, 'out', 'ranking-check.png') }).catch(() => {});
  const ng = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
