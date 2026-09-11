const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
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
// 見にいく場所(2026-09に変わった):
//   起動 → タイトル画面 → トップ画面 → 「バトル」→ バトルモード選択
//   ・スコア        … モードのカードの「🏆 ◯◯のランキング」から別画面へ
//   ・ブリーダーLv / 絆Lv … バトルモード選択の上のタブ(難易度では分かれない)
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node ranking/ranking-check.js
const path = require('path');
const { chromium } = require('playwright');
const { REPO_ROOT } = require(path.join(TOOLS_DIR, 'harness.js'));

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));

  await page.addInitScript(() => {
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'テストブリーダー');
    put('mh_intro_done', true);
    // ★トップ画面まで進んだときに「はじめての設定」や助手えらびへ落ちないよう、済みの印もそろえる
    put('mh_breeder_icon', 'Mocchi');
    put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true);
    put('mh_battle_tutorial_seen_v1', true);
    put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_masu_migrated', true);
    put('mh_kiki_intro_seen_v1', true);
    put('mh_momosuke_intro_seen_v1', true);
    put('mh_assistant_selected_v1', 'mua');
    put('mh_assistant_unlock_seen_v1', true);
    put('mh_update_notice_seen_v1', true);
    put('mh_rhythm_event_story_v1', ['monbeat_cup_2026_09']);
    put('mh_inherited_unique_level_compensation_v1', true);
    put('mh_inherited_unique_level_compensation_pending_v1', false);
    put('mh_masu_level_cap_compensation_notice_seen_v1', true);
  });
  // Supabaseへのfetchを差し替える。orderパラメータに応じて並べ替えて返すので、
  // 「スコア順の取得」と「レベル順の取得」を分けている実装かどうかまで確認できる
  await page.addInitScript(() => {
    const orig = window.fetch.bind(window);
    window.__rankOrders = [];
    window.__rankRequests = [];
    const party = (bond, explicit = true) => ([{ role:'hero', name: 'モッチー', emoji: '🍡', imgUrl: null, bondLevel: bond, bondRankingTarget:explicit }, null, null]);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!url.includes('/rest/v1/rankings')) return orig(input, init);
      if (init && init.method && init.method !== 'GET') return new Response('', { status: 201 });
      const u = new URL(url);
      const order = u.searchParams.get('order') || '';
      const difficultyFilter = u.searchParams.get('difficulty') || '';
      const difficulty = difficultyFilter.replace(/^(?:eq|ilike)\./, '');
      window.__rankOrders.push(order);
      const headers = new Headers((init && init.headers) || {});
      window.__rankRequests.push({ difficulty, difficultyFilter, order, limit: Number(u.searchParams.get('limit')), offset: Number(u.searchParams.get('offset')), apikey: headers.get('apikey'), authorization: headers.get('authorization') });
      if (['Master', 'master', 'MASTER'].includes(difficulty) && order.startsWith('score.desc')) return new Response(JSON.stringify({ message: 'diagnostic failure' }), { status: 500 });
      if (difficulty === 'Master' && order.startsWith('id.desc')) return new Response(JSON.stringify([
        { id: 999, user_name: 'マスター復旧', hero: 'モッチー', party: party(5), score: 543210, level: 24, icon: null },
        { id: 998, user_name: '旧形式不正行', hero: 'モッチー', party: '{broken}', score: 'not-a-number', level: 1, icon: null },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (['master', 'MASTER'].includes(difficulty) && order.startsWith('id.desc')) return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      const rows = [
        { id: 1, user_name: 'アルファ', hero: 'モッチー', party: party(5), score: 9000, level: 10, icon: null },
        { id: 2, user_name: 'アルファ', hero: 'モッチー', party: party(12), score: 100, level: 30, icon: null },
      ];
      for (let i = 0; i < 60; i++) rows.push({ id: 100 + i, user_name: '埋め' + i, hero: 'モッチー', party: party(1), score: 8000 - i * 10, level: 1, icon: null });
      const sorted = order.startsWith('level.desc')
        ? rows.slice().sort((a, b) => b.level - a.level)
        : rows.slice().sort((a, b) => b.score - a.score);
      const limit = parseInt(u.searchParams.get('limit') || '50', 10);
      const offset = parseInt(u.searchParams.get('offset') || '0', 10);
      return new Response(JSON.stringify(sorted.slice(offset, offset + limit)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  });

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, { timeout: 60000 });
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 30000 }).catch(() => {});
  const startBtn = page.getByRole('button', { name: 'TAP TO START' });
  if (await startBtn.count()) { await startBtn.click(); await page.waitForTimeout(1200); }
  // ★起動の流れが変わった。「TAP TO START」の先はトップ画面ではなくタイトル画面で、
  //   そこから button[aria-label="トップ画面へ進む"] を押してトップ画面へ入る。
  //   このボタンは onClick ではなく onPointerDown で動くので click() では反応しない
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="トップ画面へ進む"]');
    if (b && !b.disabled) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  await page.waitForTimeout(2500);
  // ログインボーナス・ギフトなど、トップ画面に重なるものを閉じる。
  // 押すのは「重なりの中のボタン」だけ(本文で探すとHOMEのギフトを押して別の画面へ迷い込む)
  for (let i = 0; i < 8; i++) {
    const closed = await page.evaluate(() => {
      const inOverlay = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) {
        const st = getComputedStyle(e); if (st.position === 'fixed' || Number(st.zIndex) > 1000) return true; } return false; };
      const b = [...document.querySelectorAll('button')]
        .find((x) => inOverlay(x) && /^(確認|閉じる|とじる|OK|受け取る|つぎへ|次へ|わかった|はい|スキップ|あとで)$/.test((x.innerText || '').trim()));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(600);
    if (!closed) break;
  }

  const bodyText = () => page.evaluate(() => (document.body ? document.body.innerText : ''));

  // ★ランキングの入口が変わった。トップ画面の「バトル」からバトルモード選択へ入り、
  //   スコアはモードのカードの「🏆 ◯◯のランキング」から別画面(BATTLE_SCORE_RANKING)、
  //   ブリーダーLv・絆Lvはモード選択画面のタブで見る。
  //   以前は英字の「Ranking」ボタンを探していたが、そのボタンはもう無い
  const openedBattle = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="バトル"]');
    if (b) b.click();
    return !!b;
  });
  if (!openedBattle) { check('バトルモード選択を開ける', false, 'トップ画面の「バトル」が見つからない'); await browser.close(); process.exit(1); }
  await page.waitForTimeout(1500);
  const openedScore = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /のランキング/.test(x.innerText || '') && !x.disabled);
    if (b) b.click();
    return b ? (b.innerText || '').replace(/\s+/g, ' ').trim() : null;
  });
  check('モードのカードからスコアランキングを開ける', !!openedScore, openedScore || '「◯◯のランキング」が見つからない');
  if (!openedScore) { await browser.close(); process.exit(1); }
  await page.waitForTimeout(1800);

  const orders = await page.evaluate(() => window.__rankOrders || []);
  const scoreRequests = await page.evaluate(() => window.__rankRequests || []);
  check('publishable keyをapikeyとして送信する', scoreRequests.length > 0 && scoreRequests.every(r => r.apikey && r.apikey.startsWith('sb_publishable_')));
  check('publishable keyをBearer JWTとして誤送信しない', scoreRequests.length > 0 && scoreRequests.every(r => !r.authorization));
  // ★ブリーダーLv・絆Lvは「全難易度をまとめて1回」で取る形になったので、
  //   難易度の絞り込みを送らない取得が混ざる。見たいのは「送るなら部分一致(ilike.)ではなく
  //   eq. 完全一致であること」なので、そこだけを見る
  check('難易度SELECTは、送るときは正規keyのeq完全一致',
    scoreRequests.length > 0 && scoreRequests.every(r => r.difficultyFilter === '' || r.difficultyFilter.startsWith('eq.')),
    [...new Set(scoreRequests.map(r => r.difficultyFilter || '(絞り込みなし)'))].join(', '));
  // ★起動時にスコア→ブリーダーLv→絆Lvを順に先読みするようになったため、
  //   「レベル順をまだ取っていない」では見られなくなった。
  //   もともと見たかったのは「スコアの一覧をレベル順の結果で作っていないか」なので、
  //   ・スコアは難易度つきの score.desc で取る
  //   ・レベル順の取得は難易度で絞らない(=ブリーダーLv専用で、スコアとは別物)
  //   の2つで見る
  check('スコアの一覧は難易度つきのscore.descで取る(レベル順の結果を使い回さない)',
    scoreRequests.some(r => r.order.startsWith('score.desc') && r.difficultyFilter.startsWith('eq.'))
      && scoreRequests.filter(r => r.order.startsWith('level.desc')).every(r => r.difficultyFilter === ''),
    [...new Set(orders)].join(', '));

  // --- スコアランキング ---
  const scoreTxt = await bodyText();
  check('スコアランキングに9,000ptの記録が出る', scoreTxt.includes('9,000'));
  check('スコア1位のレベルは当時のLv.10のまま', scoreTxt.includes('Lv.10'));
  check('スコアランキングに直近の低スコア(100pt)が混ざらない', !/(^|\D)100 pt/.test(scoreTxt));
  check('スコアランキングに最新のLv.30が出ない(当時の値で固定)', !scoreTxt.includes('Lv.30'));

  // --- Master score.desc障害からid.descで復旧 ---
  // ★難易度のタブに出る字は DIFFICULTY_SETTINGS の label そのままなので「Master」。
  //   以前の「MASTER」では見つからず、この確認が丸ごと素通りしていた
  const masterTab = page.getByRole('button', { name: 'Master', exact: true }).last();
  check('Masterの難易度タブがある', await masterTab.count() > 0);
  if (await masterTab.count()) { await masterTab.click({ force: true }); await page.waitForTimeout(1500); }
  const masterTxt = await bodyText();
  check('Masterの復旧スコア543,210が表示される', masterTxt.includes('543,210'));
  check('Masterの復旧ユーザー名が表示される', masterTxt.includes('マスター復旧'));
  check('Masterの不正レコードだけが除外される', !masterTxt.includes('旧形式不正行'));
  check('Masterが端末内復旧表示へ切り替わらない', !masterTxt.includes('サーバーに接続できず'));
  const masterRequests = await page.evaluate(() => window.__rankRequests.filter(r => r.difficulty === 'Master'));
  // ★取りにいく件数は実装側の定数(RANKING_SCORE_LIMIT)で決まる。20→50へ意図して
  //   増やしたとき、検査だけが20のまま置き去りになって落ちていた。
  //   数字を書き写さず実装から読むことで、次に変えたときも自動で追いつく
  const scoreLimit = Number((require('fs')
    .readFileSync(require('path').join(REPO_ROOT, 'monster-hero', 'src', 'parts', '26-supabase.jsx'), 'utf8')
    .match(/const RANKING_SCORE_LIMIT\s*=\s*(\d+)/) || [])[1]);
  check('診断中のランキングGETは1難易度ぶん(RANKING_SCORE_LIMIT件)までで、ページ送りもしない',
    Number.isFinite(scoreLimit) && masterRequests.length > 0 && masterRequests.every(r => r.limit <= scoreLimit && r.offset === 0),
    `上限 ${scoreLimit} / 実際 ${masterRequests.map(r => r.limit).join(',')}`);

  // --- ブリーダーLvランキング ---
  // スコアは別画面になったので、いったんモード選択画面へ戻ってからタブを押す。
  // タブの aria-label は「◯◯ランキング」(本文は「ブリーダーLv」)
  await page.evaluate(() => { const b = document.querySelector('button[aria-label="戻る"]'); if (b) b.click(); });
  await page.waitForTimeout(1200);
  const breederTab = page.getByRole('button', { name: 'ブリーダーLvランキング' }).last();
  check('ブリーダーLvのタブがある', await breederTab.count() > 0);
  if (await breederTab.count()) { await breederTab.click({ force: true }); await page.waitForTimeout(1500); }
  const levelOrders = await page.evaluate(() => window.__rankOrders || []);
  check('ブリーダーLvを開いた後にレベル順を取得する', levelOrders.some(o => o.startsWith('level.desc')));
  const breederTxt = await bodyText();
  check('ブリーダーLvランキングに最新のLv.30が出る', breederTxt.includes('Lv.30'));
  check('ブリーダーLvランキングにアルファが出る', breederTxt.includes('アルファ'));
  check('ブリーダーLvカードにpt・編成・絆Lvが出ない', !breederTxt.includes(' pt') && !breederTxt.includes('勇者モン:') && !breederTxt.includes('供モン:') && !breederTxt.includes('絆Lv.'));

  // --- 絆Lvランキング ---
  const bondTab = page.getByRole('button', { name: '絆Lvランキング' }).last();
  check('絆Lvのタブがある', await bondTab.count() > 0);
  if (await bondTab.count()) { await bondTab.click({ force: true }); await page.waitForTimeout(1500); }
  const bondTxt = await bodyText();
  check('絆Lvランキングに最新の絆Lv.12が出る', bondTxt.includes('絆Lv.12'));
  check('絆Lvランキングが古い絆Lv.5で止まっていない', !/絆Lv\.5(\D|$)/.test(bondTxt) || bondTxt.includes('絆Lv.12'));
  check('絆Lvカードにpt・パーティ・ブリーダーLvが出ない', !bondTxt.includes(' pt') && !bondTxt.includes('勇者モン:') && !bondTxt.includes('供モン:') && !bondTxt.includes('ブリーダーLv.'));
  check('タブ切替後は現在種別のカードだけが残る', await page.locator('[data-ranking-kind="bond"]').count() > 0 && await page.locator('[data-ranking-kind="score"], [data-ranking-kind="breeder"]').count() === 0);

  check('致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  await page.screenshot({ path: path.join(TOOLS_DIR, 'out', 'ranking-check.png') }).catch(() => {});
  const ng = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
