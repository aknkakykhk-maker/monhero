const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 読み込み直しの記録(2026-10-10・iPhone の Safari で「やっている最中に最初の画面へ戻る」問い合わせの調査用)を確かめる。
//
//   node tools/boot/reload-log-check.js   (別の窓で tools/serve.py 8899 を起動しておく)
//
// 前半は、記録を作る関数を本番のソースのまま動かす。後半は実ブラウザで、
//   ・遊んでいる最中に止まった前回の印(running)があれば、次の起動で記録が1件足される
//   ・裏に回ったあとの印(hidden)は、別の種類(background)で記録される
//   ・正常に終わった印(closed)・印が無い・壊れている、では記録しない(落ちない)
//   ・15秒ごとに印が書き直される。記録は12件までで、新しいものが先頭
//   ・新しい保存キーだけを使い、既存の mh_* は触らない
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ---- 前半: 純粋な関数(本番の定義をそのまま) ----
const source = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'src', 'parts', '50-error-boundary.jsx'), 'utf8');
const from = source.indexOf('const RELOAD_MARKER_KEY');
const to = source.indexOf('// 音の設定の「音が出ないとき」の下に出す');
const context = {};
vm.createContext(context);
vm.runInContext(`${source.slice(from, to)}\nglobalThis.__r={RELOAD_MARKER_KEY,RELOAD_LOG_KEY,RELOAD_LOG_LIMIT,RELOAD_BEAT_MS,normalizeSessionMarker,normalizeReloadLog,buildReloadLogEntry,pushReloadLog,describeReloadLogEntry};`, context);
const r = context.__r;
const MIN = 60000;
const t0 = Date.parse('2026-10-10T10:00:00+09:00');
check('保存キーは新しい名前', r.RELOAD_MARKER_KEY === 'mhdev_session_marker_v1' && r.RELOAD_LOG_KEY === 'mhdev_reload_log_v1');
// バックアップは mh_ で始まるキーだけを書き出す(data/mhsave-backup.js)。この記録は端末ごとなので、引き継ぎへ入れない
const backupSrc = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'data', 'mhsave-backup.js'), 'utf8');
check('バックアップは mh_ で始まるキーだけ。端末ごとの記録(mhdev_)は入らない', backupSrc.includes("key.startsWith('mh_')") && !r.RELOAD_MARKER_KEY.startsWith('mh_') && !r.RELOAD_LOG_KEY.startsWith('mh_'));
const marker = (extra) => ({ id: 'a', startedAt: t0, lastBeat: t0 + 63 * MIN, state: 'running', screen: 'BATTLE', audioBuffers: 5, heapMB: 120, nav: 'navigate', ...extra });
const fg = r.buildReloadLogEntry(marker(), t0 + 65 * MIN, 'reload');
check('遊んでいる最中の印は foreground で記録する', fg && fg.kind === 'foreground' && fg.minutes === 63 && fg.gapMinutes === 2 && fg.screen === 'BATTLE' && fg.audioBuffers === 5 && fg.heapMB === 120 && fg.nav === 'reload', JSON.stringify(fg));
const bg = r.buildReloadLogEntry(marker({ state: 'hidden' }), t0 + 90 * MIN);
check('裏に回ったあとの印は background で記録する', bg && bg.kind === 'background');
check('正常に終わった印(closed)は記録しない', r.buildReloadLogEntry(marker({ state: 'closed' }), t0 + 65 * MIN) === null);
check('印が無い・壊れているときは記録しない', r.buildReloadLogEntry(null, t0) === null && r.buildReloadLogEntry('こわれた', t0) === null && r.buildReloadLogEntry({ startedAt: 'x' }, t0) === null && r.buildReloadLogEntry([], t0) === null);
check('時刻が逆の印は読まない', r.normalizeSessionMarker({ startedAt: t0, lastBeat: t0 - 1, state: 'running' }) === null);
check('知らない state は running として読む', r.normalizeSessionMarker({ startedAt: t0, lastBeat: t0, state: 'ふしぎ' }).state === 'running');
check('画面名と数値は上限・型をそろえる', (() => { const m = r.normalizeSessionMarker({ startedAt: t0, lastBeat: t0, screen: 'x'.repeat(200), audioBuffers: 'あ', heapMB: null }); return m.screen.length === 40 && m.audioBuffers === null && m.heapMB === null; })());
let log = [];
for (let i = 0; i < 20; i++) log = r.pushReloadLog(log, { ...fg, at: t0 + i * MIN });
check('記録は12件まで', log.length === r.RELOAD_LOG_LIMIT && r.RELOAD_LOG_LIMIT === 12);
check('新しい記録が先頭に来る', log[0].at === t0 + 19 * MIN && log[11].at === t0 + 8 * MIN);
check('壊れた記録は落ちずに捨てる', r.normalizeReloadLog('x').length === 0 && r.normalizeReloadLog([null, 1, 'a', { at: 'x' }, { at: t0 }]).length === 1);
check('記録を足さない呼び出しでも壊れない', r.pushReloadLog(log, null).length === 12);
check('画面に出す1行に、分・画面・音の本数・メモリが入る', (() => { const t = r.describeReloadLogEntry(fg); return /63分遊んだあと/.test(t) && /画面 BATTLE/.test(t) && /音のデータ 5本/.test(t) && /メモリ 120MB/.test(t) && /遊んでいる最中に読み込み直された/.test(t); })());
check('メモリが取れない端末(iPhone)でも1行にできる', (() => { const t = r.describeReloadLogEntry({ ...fg, heapMB: null }); return !/メモリ/.test(t) && /63分遊んだあと/.test(t); })());

// ---- 後半: 実ブラウザ ----
(async () => {
  let browser;
  const errors = [];
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      if (localStorage.getItem('mh_check_seeded')) return;
      localStorage.setItem('mh_check_seeded', '1');
      const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      set('mh_breeder_name', 'テスト'); set('mh_breeder_icon', 'Mocchi'); set('mh_onboarded', true);
      set('mh_tutorial_seen_v1', true); set('mh_battle_tutorial_seen_v1', true); set('mh_battle_tutorial_guide_shown_v1', true);
      set('mh_masu_migrated', true); set('mh_gold', 4321);
    });
    const open = async () => {
      await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
      await page.waitForTimeout(3000);
    };
    const read = (key) => page.evaluate((k) => { const raw = localStorage.getItem(k); try { return raw ? JSON.parse(raw) : null; } catch (e) { return '壊れている'; } }, key);
    // 保存を書き込むときは、ゲームを動かさない同じ場所のページ(version.json)へいったん移ってから書く。
    // ゲームを開いたまま書くと、そのページが離れるときに自分の印を書き直して、書いた印を上書きしてしまうため
    const put = async (key, value) => {
      if (page.url() === 'about:blank' || /index\.html/.test(page.url())) await page.goto(new URL('version.json', PAGE_URL).href, { waitUntil: 'load' });
      await page.evaluate(([k, v]) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)), [key, value]);
    };

    await open();
    check('はじめての起動では記録を作らない', (await read('mhdev_reload_log_v1')) === null);
    const first = await read('mhdev_session_marker_v1');
    check('起動すると「いま遊んでいる」印が書かれる', first && first.state === 'running' && first.startedAt > 0, JSON.stringify(first));
    const goldBefore = await read('mh_gold');

    // 15秒ごとに印が書き直される
    await page.waitForTimeout(16500);
    const beat = await read('mhdev_session_marker_v1');
    check('15秒ほどで印が書き直される', beat.lastBeat > first.lastBeat, `${first.lastBeat} → ${beat.lastBeat}`);
    check('印に画面と音のデータの本数が入る', typeof beat.screen === 'string' && Number.isFinite(beat.audioBuffers), JSON.stringify(beat));

    // 裏に回る → state が hidden、戻る → running、pagehide → closed
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    check('裏に回ると hidden になる', (await read('mhdev_session_marker_v1')).state === 'hidden');
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    check('戻ると running へ戻る', (await read('mhdev_session_marker_v1')).state === 'running');
    // 検査用に上書きした visibilityState を元に戻す(本物の離れるときのイベントを、見えている扱いにしないため)
    await page.evaluate(() => { delete document.visibilityState; });
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    check('閉じると closed になる', (await read('mhdev_session_marker_v1')).state === 'closed');

    // 正常に終わった(closed)あとの起動では、記録を足さない
    await open();
    check('正常に終わったあとの起動では、記録を足さない', (await read('mhdev_reload_log_v1')) === null);

    // 遊んでいる最中に止まった印(running)が残っている → foreground
    const now = Date.now();
    await put('mhdev_session_marker_v1', { id: 'x', startedAt: now - 70 * MIN, lastBeat: now - 2 * MIN, state: 'running', screen: 'BATTLE', audioBuffers: 6, heapMB: null, nav: 'navigate' });
    await open();
    const log1 = await read('mhdev_reload_log_v1');
    check('止まった前回の印があると、記録が1件足される(foreground)', Array.isArray(log1) && log1.length === 1 && log1[0].kind === 'foreground' && log1[0].minutes === 68 && log1[0].screen === 'BATTLE' && log1[0].audioBuffers === 6, JSON.stringify(log1));
    const markerAfter = await read('mhdev_session_marker_v1');
    check('そのあとの印は新しいものに置き換わる', markerAfter.state === 'running' && markerAfter.startedAt > now - 60000);

    // 裏に回った印(hidden) → background
    await put('mhdev_session_marker_v1', { id: 'y', startedAt: now - 30 * MIN, lastBeat: now - 10 * MIN, state: 'hidden', screen: 'HOME', audioBuffers: 3, heapMB: null, nav: '' });
    await open();
    const log2 = await read('mhdev_reload_log_v1');
    check('裏に回ったあとの印は background で足される・新しいものが先頭', log2.length === 2 && log2[0].kind === 'background' && log2[1].kind === 'foreground', JSON.stringify(log2.map((x) => x.kind)));

    // 壊れた印・壊れた記録でも落ちない
    await put('mhdev_session_marker_v1', '{こわれた');
    await put('mhdev_reload_log_v1', 'こわれた');
    await open();
    check('壊れた印でも起動できる', (await read('mhdev_session_marker_v1')).state === 'running');
    check('壊れた印では記録を足さない(壊れた記録は触らない)', (await page.evaluate(() => localStorage.getItem('mhdev_reload_log_v1'))) === 'こわれた');
    await put('mhdev_reload_log_v1', 'null');

    // 上限(12件)
    for (let i = 0; i < 14; i++) {
      await put('mhdev_session_marker_v1', { id: `z${i}`, startedAt: now - 5 * MIN, lastBeat: now - 4 * MIN, state: 'running', screen: `S${i}`, audioBuffers: i, heapMB: null, nav: '' });
      await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
      await page.waitForTimeout(700);
    }
    const log3 = await read('mhdev_reload_log_v1');
    check('記録は12件までで、新しいものが先頭', Array.isArray(log3) && log3.length === 12 && log3[0].screen === 'S13', `${log3 && log3.length}件 先頭 ${log3 && log3[0] && log3[0].screen}`);

    // ---- 診断欄(タイトルの 設定 → 音量設定 → 🔧 音が出ないとき)に、記録が出る ----
    await put('mhdev_reload_log_v1', [{ at: now, kind: 'foreground', minutes: 61, gapMinutes: 1, screen: 'BATTLE', audioBuffers: 7, heapMB: null, nav: 'reload' }, { at: now - 1000, kind: 'background', minutes: 5, gapMinutes: 30, screen: 'HOME', audioBuffers: 3, heapMB: null, nav: '' }]);
    await put('mhdev_session_marker_v1', { id: 'k', startedAt: now, lastBeat: now, state: 'closed', screen: '', audioBuffers: null, heapMB: null, nav: '' });
    await open();
    const clickBtn = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button')].find(x => new RegExp(p).test((x.getAttribute('aria-label') || '') + ' ' + x.textContent)); if (b) b.click(); return !!b; }, re);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('TAP TO START')); b && b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
    await page.waitForTimeout(3000);
    check('タイトルの設定を開ける', await clickBtn('設定'));
    await page.waitForTimeout(700);
    check('音量設定を開ける', await clickBtn('音量設定'));
    await page.waitForTimeout(900);
    check('「音が出ないとき」を開ける', await clickBtn('音が出ないとき'));
    await page.waitForTimeout(900);
    const rows = await page.locator('[data-reload-log-row]').allInnerTexts();
    check('診断欄に、前回までの読み込み直しが新しい順に並ぶ', rows.length === 2 && /遊んでいる最中に読み込み直された/.test(rows[0]) && /61分遊んだあと/.test(rows[0]) && /裏に回ったあと/.test(rows[1]), rows.join(' / '));
    check('「記録をコピー」のボタンがある', await page.locator('[data-reload-log-copy]').count() === 1);
    await page.evaluate(() => { const b = document.querySelector('[data-reload-log-copy]'); b && b.click(); });
    await page.waitForTimeout(500);

    // 既存の保存は触らない
    check('既存の保存(mh_gold)は変わらない', (await read('mh_gold')) === goldBefore);
    check('画面でエラーが出ていない', errors.length === 0, errors.join(' / ').slice(0, 200));
  } catch (e) {
    check('ブラウザで確認できた', false, String(e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
  }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
