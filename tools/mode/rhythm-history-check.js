#!/usr/bin/env node
// モンヒロビートの履歴(プロフィール →「これまでの記録」)を確かめる。
//
//   node tools/mode/rhythm-history-check.js
//
// 2026-09-13・ユーザー依頼「モンビーのイベントや週間ランキングの終わったものを
// ヒストリー的に見れる機能」。置き場所はユーザーが決めた(プロフィール)。
//
// 【この検査が見張ること】
// ① 一覧は**計算だけで作る**。件数が増えても通信が増えない
//    (週は年52件ずつ増える。行ごとに順位を出す作りにすると、そこで破綻する)
// ② さかのぼれるのは 2026-09-14 の週から。それより前は週間の数え方そのものが違うので出さない
//    (2026-09-13に「曲ごとのベストを合算」→「その週に出した記録をぜんぶ足す累計」へ変えた)
// ③ **表示専用**。報酬の受け取り・受取フラグ(mh_rhythm_event_reward_v1)・保存に触らない
// ④ 実際のブラウザで、プロフィールから開いて一覧と中身が出る
const fs = require('fs'), path = require('path'), vm = require('vm'), http = require('http');
const ROOT = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

const event = read('monster-hero/data/rhythm-event.js');
const game = read('monster-hero/src/game-system.jsx');

// ── ① 一覧を実際に動かす ──────────────────────────────────────────────
const ctx = { out: null };
vm.createContext(ctx);
// 公開曲の一覧は data/rhythm-mode.js が持つ。ここでは形だけあれば足りる
vm.runInContext(`const RHYTHM_DEMO_SONG_IDS=['a','b'];\n${event}\nout={
  rhythmHistoryEntries, rhythmHistoryWeeks, rhythmHistoryEvents, rhythmHistoryName,
  rhythmHistoryPeriodText, rhythmHistoryBoardEvent, rhythmHistoryRange,
  RHYTHM_WEEKLY_REWARD_FROM_MS, RHYTHM_WEEK_MS, RHYTHM_EVENTS, rhythmWeekId,
};`, ctx);
const h = ctx.out;
const FROM = h.RHYTHM_WEEKLY_REWARD_FROM_MS;                 // 2026-09-14 05:00 JST
const WEEK = h.RHYTHM_WEEK_MS;

ok('履歴の関数がそろっている',
  typeof h.rhythmHistoryEntries === 'function' && typeof h.rhythmHistoryWeeks === 'function'
  && typeof h.rhythmHistoryEvents === 'function' && typeof h.rhythmHistoryBoardEvent === 'function');

// 始まる前は1件も出ない(公開した瞬間に過去がずらりと並ばない)
ok('始まりの週より前では、終わった週が1件も出ない', h.rhythmHistoryWeeks(FROM - 1).length === 0);
// 1週ぶん経ったら1件
ok('1週たつと、終わった週が1件出る', h.rhythmHistoryWeeks(FROM + WEEK).length === 1,
  `${h.rhythmHistoryWeeks(FROM + WEEK).length}件`);
// 10週ぶん経ったら10件。件数が増えても数え終わる(無限に数え続けない)
const ten = h.rhythmHistoryWeeks(FROM + WEEK * 10);
ok('10週たつと10件(数え終わる)', ten.length === 10, `${ten.length}件`);
// ★2年ぶん(104週)でも計算だけで終わる。ここが重くなると「件数が増えるとまずい」になる
const t0 = Date.now();
const many = h.rhythmHistoryWeeks(FROM + WEEK * 104);
const elapsed = Date.now() - t0;
ok('2年ぶん(104件)でも一覧は一瞬で作れる', many.length === 104 && elapsed < 50, `${many.length}件 / ${elapsed}ms`);
// 上限を渡せば、そこで止まる
ok('件数の上限を渡せる', h.rhythmHistoryWeeks(FROM + WEEK * 104, 8).length === 8);
// 新しい順
ok('新しい順に並ぶ', many.every((entry, i) => i === 0 || entry.endMs <= many[i - 1].endMs));
// まだ終わっていない週は出さない
ok('まだ終わっていない週は出さない', h.rhythmHistoryWeeks(FROM + WEEK * 3 - 1000).every(entry => entry.endMs <= FROM + WEEK * 3 - 1000));
// 週のIDは受け取りと同じ形(weekly_YYYY_MM_DD)。あとから形を変えない決まり(§7)
ok('週のIDは受け取りと同じ形', /^weekly_\d{4}_\d{2}_\d{2}$/.test(h.rhythmHistoryWeeks(FROM + WEEK)[0].id));

// 終わったイベント
const limited = (Array.isArray(h.RHYTHM_EVENTS) ? h.RHYTHM_EVENTS : []).filter(e => e && e.kind === 'limited');
const lastEnd = Math.max(...limited.map(e => Date.parse(e.endAt)));
ok('開催中のイベントは履歴に出ない', h.rhythmHistoryEvents(lastEnd - 1).length < limited.length);
ok('終わったイベントは履歴に出る', h.rhythmHistoryEvents(lastEnd).length === limited.length,
  `${h.rhythmHistoryEvents(lastEnd).length} / ${limited.length}件`);

// まぜた一覧
const mixed = h.rhythmHistoryEntries(FROM + WEEK * 3);
ok('週とイベントがまざって新しい順に並ぶ',
  mixed.length > 0 && mixed.every((entry, i) => i === 0 || entry.endMs <= mixed[i - 1].endMs));
ok('週とイベントの両方が入る',
  mixed.some(entry => entry.kind === 'weekly') && mixed.some(entry => entry.kind === 'limited'));

// 集計へ渡すもの
const week = h.rhythmHistoryWeeks(FROM + WEEK)[0];
const boardEvent = h.rhythmHistoryBoardEvent(week);
ok('週は、その週ぶんのイベントとして組み立てられる',
  !!boardEvent && boardEvent.kind === 'weekly' && boardEvent.id === week.id);
const limitedEntry = h.rhythmHistoryEvents(lastEnd)[0];
ok('イベントは定義そのものを渡す', h.rhythmHistoryBoardEvent(limitedEntry) === limitedEntry.event);
const range = h.rhythmHistoryRange(week);
ok('期間はそのまま渡る(サーバーへ週の窓を聞きに行かない)',
  !!range && range.startMs === week.startMs && range.endMs === week.endMs);
ok('壊れた値では期間を作らない', h.rhythmHistoryRange(null) === null && h.rhythmHistoryRange({ startMs: 'x', endMs: 1 }) === null);

// 名前と期間の文
ok('週の見出しに年が入る(年をまたいでも分かる)', /^\d{4}\/\d{1,2}\/\d{1,2}\(.\) の週$/.test(h.rhythmHistoryName(week)),
  h.rhythmHistoryName(week));
ok('イベントの見出しは付けた名前そのまま', h.rhythmHistoryName(limitedEntry) === limitedEntry.event.name);
ok('期間は始まりと終わりの両方を出す', h.rhythmHistoryPeriodText(week).includes('〜'));

// ── ② 境界の値を2か所に持たない ────────────────────────────────────────
ok('さかのぼる境界は、受け取りの開始時刻をそのまま使う(値を2か所に持たない)',
  event.includes('const rhythmHistoryWeekFromMs = () => RHYTHM_WEEKLY_REWARD_FROM_MS;'));

// ── ③ 表示専用であること ──────────────────────────────────────────────
const screen = read('monster-hero/src/parts/73-screen-rhythm-history.jsx');
ok('履歴の画面は保存へ書き込まない',
  !/storeSet|localStorage|markRhythmEventRewardClaimed/.test(screen));
ok('履歴の画面は報酬の受け取りに触らない',
  !/RewardClaim|claimRhythm|markRhythmEventReward|onClaim/.test(screen));
ok('履歴だと分かる説明が画面に出ている', screen.includes('報酬を受け取ることはできません'));
// 集計は今週・開催中と同じ関数を通す(集計の仕方を履歴側に持たない)
ok('集計は既存の読み込みをそのまま使う(kind に history を足しただけ)',
  game.includes("if (kind !== 'weekly' && kind !== 'limited' && kind !== 'history') return;")
  && game.includes("const loadRhythmEventRanking = useCallback(async (kind, divisionId, historyEntry = null) => {"));
ok('履歴の週も累計スコア方式で数える',
  game.includes("const weeklyTotals = (kind === 'weekly' || (kind === 'history' && historyEntry.kind === 'weekly')) && !targetSongId;"));
ok('履歴では週の窓をサーバーへ聞きに行かない',
  game.includes("const range = kind === 'history' ? rhythmHistoryRange(historyEntry) : rhythmEventWindow(event, weekWindow);"));
// 入口は公開フラグで出し入れする(週間ランキングと同じフラグ)
ok('公開前は入口ごと出さない',
  game.includes("const rhythmHistoryReleased = RELEASE_FLAGS.rhythmWeeklyRanking === true;"));
ok('終わった回が1件も無いあいだは入口を出さない',
  read('monster-hero/src/parts/56-screen-profile.jsx').includes('Number(rhythmHistoryCount)>0'));
// ヘルプと助手
ok('ヘルプに項目がある', read('monster-hero/data/help.js').includes("id:'rhythm-history'"));
ok('画面とヘルプが結び付いている', read('monster-hero/data/help.js').includes("RHYTHM_HISTORY:   'rhythm/rhythm-history'"));
ok('助手のひとことがある', read('monster-hero/data/assistants.js').includes("id: 'rhythmHistory',"));

// ── ④ 実際のブラウザで開く ────────────────────────────────────────────
const PORT = 9184;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };
const serve = () => new Promise(resolve => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないのでブラウザでの確認はできません'); process.exit(failed ? 1 : 0); }
  const server = await serve();
  let browser;
  let result = null;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e && e.message ? e.message : e)));
    // ★端末の時計を進めて「終わった回がある状態」を作る。
    //   いま(2026-09-13)はまだ1件も終わっていないので、進めないと一覧が空になる
    const AHEAD_MS = Date.UTC(2026, 9, 5, 0, 0, 0);   // 2026-10-05 09:00 JST
    await page.addInitScript(([aheadMs]) => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true);
      // 報酬の受け取り画面が割り込まないよう、終わった回は受け取り済みにしておく
      put('mh_rhythm_event_reward_v1', ['weekend_2026_09_11',
        'weekly_2026_09_14', 'weekly_2026_09_21', 'weekly_2026_09_28']);
      const offset = aheadMs - Date.now();
      const RealDate = Date;
      const shifted = function (...args) {
        if (args.length === 0) return new RealDate(RealDate.now() + offset);
        return new RealDate(...args);
      };
      shifted.prototype = RealDate.prototype;
      shifted.now = () => RealDate.now() + offset;
      shifted.parse = RealDate.parse; shifted.UTC = RealDate.UTC;
      window.Date = shifted;
    }, [AHEAD_MS]);
    const clickText = async (pattern, nth = 0) => page.evaluate(([source, index]) => {
      const rx = new RegExp(source);
      const list = [...document.querySelectorAll('button')].filter(b => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
      if (!list[index]) return false;
      list[index].click();
      return true;
    }, [pattern, nth]);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), { timeout: 40000 });
    // 割り込む案内(助手の紹介など)を閉じてから進む
    for (let i = 0; i < 14; i++) {
      if (!(await clickText('^(受け取る|閉じる|OK|とじる|確認|あとで|つぎへ|はじめる|決定)$'))) break;
      await page.waitForTimeout(250);
    }
    // プロフィールへ(HOMEの左上のブリーダー表示から入る)
    await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
    await page.waitForSelector('[data-profile-battle-records]', { timeout: 15000 });
    await page.waitForTimeout(400);
    const hasEntry = await page.evaluate(() => !!document.querySelector('[data-profile-rhythm-history]'));
    let listCount = 0, opened = false, crashedAfterOpen = false;
    if (hasEntry) {
      await page.evaluate(() => document.querySelector('[data-profile-rhythm-history]').click());
      await page.waitForSelector('[data-rhythm-history]', { timeout: 15000 });
      listCount = await page.evaluate(() => document.querySelectorAll('[data-rhythm-history-entry]').length);
      if (listCount > 0) {
        await page.evaluate(() => document.querySelector('[data-rhythm-history-entry]').click());
        await page.waitForTimeout(1500);
        // 通信できない環境でも画面が残っていること(順位は出せなくてよい)
        opened = await page.evaluate(() => !!document.querySelector('[data-rhythm-history]')
          && document.body.innerText.includes('終了'));
        crashedAfterOpen = await page.evaluate(() => document.body.innerText.includes('問題が発生しました'));
      }
    }
    result = { hasEntry, listCount, opened, crashedAfterOpen, errors };
    await page.close();
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  ok('プロフィールに入口が出る', !!result.hasEntry);
  console.log(`      一覧に並んだ回: ${result.listCount}件`);
  ok('一覧に終わった回が並ぶ(週とイベント)', result.listCount >= 2, `${result.listCount}件`);
  ok('1件開いても画面が落ちない', result.opened && !result.crashedAfterOpen);
  ok('実行時エラーが出ていない', result.errors.length === 0, result.errors.slice(0, 2).join(' / ') || 'なし');
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
