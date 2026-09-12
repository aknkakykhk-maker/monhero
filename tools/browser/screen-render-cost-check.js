const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 画面を開いたときの描画にどれだけかかるかを実ブラウザで測る。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node browser/screen-render-cost-check.js
//
// 【なぜ要るか】
// browser/perf-check.js は「起動して本体が使えるようになるまで」しか測らない。
// 一覧を開いたときの重さ(ランキング50件・マスモン一覧)を測る道具が無かったので、
// 「React.memo を入れるべきか」を数字で判断できなかった
// (docs/refactor/REFACTOR_MASTER_PLAN.md STEP 7・TECH_DEBT_AUDIT.md TD-22)。
//
// 【測るもの】
// ・画面の目印が出るまでの時間(遷移を始めてから)
// ・その間に出た「長いタスク」(50ms以上、画面が固まる原因)の数と合計
//
// 【この環境の限界】
// Tailwind の CDN へ出られないので、実機より軽く出る(レイアウト計算が減るため)。
// 絶対値を実機の目安にはできない。**改修の前後で比べる**ために使う。
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
// 1画面あたりの上限(ms)。2026-09-12 の実測は 21〜62ms だったので、
// 混んだマシンでの揺れを見込んで8倍ほどの幅を置く。
// 「明らかに遅くなったら気づく」ためのもので、細かい増減を追う道具ではない
const LIMIT_MS = Number(process.env.RENDER_LIMIT_MS || 500);
// 1画面あたりの「長いタスク」(50ms以上・画面が固まる原因)の合計の上限。
// 実測は全画面 0ms。1つでも出たら、その画面で何かをまとめてやりすぎている
const LONG_TASK_LIMIT_MS = Number(process.env.LONG_TASK_LIMIT_MS || 200);

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**cdn.tailwindcss.com**', (r) => r.abort()).catch(() => {});

  await page.addInitScript(() => {
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'テストブリーダー');
    put('mh_breeder_icon', 'Mocchi');
    put('mh_intro_done', true);
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
  // ランキングは50件返す。一覧の重さを測るのが目的なので、中身より件数をそろえる
  await page.addInitScript(() => {
    const orig = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      if (!url.includes('/rest/v1/rankings')) return orig(input, init);
      if (init && init.method && init.method !== 'GET') return new Response('', { status: 201 });
      const rows = [];
      for (let i = 0; i < 50; i++) rows.push({
        id: i + 1, user_name: `ブリーダー${i}`, hero: 'モッチー', score: 90000 - i * 100, level: 60 - i, icon: null,
        party: [{ role: 'hero', name: 'モッチー', emoji: '🍡', imgUrl: null, bondLevel: 20 - (i % 20), bondRankingTarget: true }, null, null],
      });
      return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  });
  // 長いタスク(画面が固まる原因)を拾う
  await page.addInitScript(() => {
    window.__longTasks = [];
    try {
      new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__longTasks.push(Math.round(e.duration)); })
        .observe({ entryTypes: ['longtask'] });
    } catch (e) {}
  });

  const down = (aria) => page.evaluate((a) => {
    const b = document.querySelector(`button[aria-label="${a}"]`);
    if (!b || b.disabled) return false;
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return true;
  }, aria);
  // aria-label のボタンを click で押す。pointerdown が要るのはタイトルの開始ボタンだけ
  const clickAria = (aria) => page.evaluate((a) => {
    const b = document.querySelector(`button[aria-label="${a}"]`);
    if (!b || b.disabled) return false;
    b.click();
    return true;
  }, aria);
  const clickText = (text) => page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === t);
    if (b) b.click();
    return !!b;
  }, text);
  const longTaskTotal = () => page.evaluate(() => (window.__longTasks || []).reduce((a, b) => a + b, 0));

  // 起動 → タイトル → トップ画面
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 40000 });
  await page.getByRole('button', { name: 'TAP TO START' }).click();
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
  await down('トップ画面へ進む');
  await page.waitForTimeout(2500);
  for (let i = 0; i < 8; i++) {
    const closed = await page.evaluate(() => {
      const inOverlay = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) {
        const st = getComputedStyle(e); if (st.position === 'fixed' || Number(st.zIndex) > 1000) return true; } return false; };
      const b = [...document.querySelectorAll('button')]
        .find((x) => inOverlay(x) && /^(確認|閉じる|とじる|OK|受け取る|つぎへ|次へ|わかった|はい|スキップ|あとで)$/.test((x.innerText || '').trim()));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(500);
    if (!closed) break;
  }

  // 1画面ぶんの計測。open() を呼んでから、目印が出るまでを測る
  const measure = async (label, open, marker) => {
    const before = await longTaskTotal();
    const t0 = Date.now();
    const moved = await open();
    if (!moved) { check(`${label}を開ける`, false, '導線が見つからない'); return null; }
    try {
      await page.waitForFunction(marker, { timeout: 20000 });
    } catch (e) {
      check(`${label}が出る`, false, '目印が出ませんでした');
      return null;
    }
    const ms = Date.now() - t0;
    const long = (await longTaskTotal()) - before;
    check(`${label}: ${ms} ms`, ms <= LIMIT_MS, ms > LIMIT_MS ? `上限 ${LIMIT_MS} ms` : '');
    check(`${label}: 画面が固まる長いタスクが出ない`, long <= LONG_TASK_LIMIT_MS, `${long} ms(上限 ${LONG_TASK_LIMIT_MS} ms)`);
    return { label, ms, long };
  };

  const rows = [];
  const m1 = await measure('バトルモード選択', () => clickAria('バトル'),
    () => !!document.querySelector('button[aria-label="ブリーダーLvランキング"]'));
  if (m1) rows.push(m1);
  const m2 = await measure('ランキング50件(ブリーダーLv)', () => page.evaluate(() => {
    const b = document.querySelector('button[aria-label="ブリーダーLvランキング"]');
    if (b) b.click();
    return !!b;
  }), () => document.querySelectorAll('[data-ranking-kind="breeder"]').length >= 10);
  if (m2) rows.push(m2);
  const m3 = await measure('絆Lvランキング50件', () => page.evaluate(() => {
    const b = document.querySelector('button[aria-label="絆Lvランキング"]');
    if (b) b.click();
    return !!b;
  }), () => document.querySelectorAll('[data-ranking-kind="bond"]').length >= 10);
  if (m3) rows.push(m3);
  // トップ画面へ戻ってからマスモン一覧
  await page.evaluate(() => { const b = document.querySelector('button[aria-label="戻る"]'); if (b) b.click(); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const b = document.querySelector('button[aria-label="戻る"]'); if (b) b.click(); });
  await page.waitForTimeout(900);
  const m4 = await measure('M/B管理', () => clickText('M/B管理'),
    () => (document.body.innerText || '').includes('マスモン') || (document.body.innerText || '').includes('ベースモン'));
  if (m4) rows.push(m4);

  console.log('\n  画面ごとの描画時間(この環境の実測。Tailwind が無いぶん実機より軽い)');
  rows.forEach((r) => console.log(`    ${String(r.ms).padStart(5)} ms  長いタスク ${String(r.long).padStart(4)} ms  ${r.label}`));
  const worst = rows.reduce((a, b) => (b.ms > (a ? a.ms : -1) ? b : a), null);
  if (worst) console.log(`  いちばん重い画面: ${worst.label}(${worst.ms} ms)`);

  const ng = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
