#!/usr/bin/env node
// プロフィールとフレンドのプロフィールに出す MFバトルカードの戦績を、実際の画面で確かめる
// (2026-10-26 社長「プロフィールやフレンドでバトルカードの戦績も追加」。部品は 90-card-rank.jsx の CardBattleStatsPanel)
//
//   node tools/card/card-profile-stats-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、写真(profile-stats-<幅>.png・friend-stats-<幅>.png)を残す
//
// 見ているもの(320×568・390×844)
//   ① 自分のプロフィールに、保存のとおりの戦績(強さごとの勝ち数・いちばん長い連勝・マルチの勝ち負けと強さの点数・カード図鑑)が出る
//   ② 戦績の欄の字が切れない・画面からはみ出さない
//   ③ 一度も遊んでいない人には、戦績の欄を出さない
//   ④ フレンドの戦績は、ランキングの表をその人のブリーダーの番号で読んで出す(表に無い人は出さない)
//   ⑤ 保存(mh_*)を書き換えない・実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const PORT = 8991;
const SHOT = process.env.SHOT_DIR || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 保存に入れる戦績(勝ち数・連勝・マルチ・図鑑)
const RECORD = { cpu: { win: 27, lose: 9, surrender: 1 }, pvp: { win: 3, lose: 2 }, beaten: {}, recent: [],
  rank: { total: { easy: 12, normal: 8, hard: 5, expert: 2, master: 0 }, week: { key: '', wins: {} }, streak: { now: 2, best: 7 } } };
const COLLECTION = { 100: 2, 101: 1, 102: 1, 113: 1 };
const FRIEND = { id: 'friend-x', rank: { user_name: 'フレンドX', breeder_id: 'friend-x', icon: null, profile_frame: null, week_key: '', wins_easy: 30, wins_normal: 21, wins_hard: 9, wins_expert: 4, wins_master: 1,
  week_wins_easy: 0, week_wins_normal: 0, week_wins_hard: 0, week_wins_expert: 0, week_wins_master: 0, best_streak: 11, current_streak: 0, dex_count: 140, dex_total: 400, updated_at: '2026-10-26T10:00:00Z' },
  pvp: { rating: 1532, wins: 6, loses: 4 } };

const boot = async (browser, w, h, fresh, errors) => {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errors.push(String(e && e.message ? e.message : e)));
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  // 表の偽物: 自分(self-user)の強さの点数・フレンドの行。ほかは空
  await page.route('https://zrzevudkbgtxlbvmuziy.supabase.co/**', (r) => {
    const u = r.request().url();
    let body = '[]';
    if (/card_battle_pvp_ratings.*breeder_id=eq\.self-user/.test(u)) body = JSON.stringify([{ rating: 1488, wins: 3, loses: 2 }]);
    else if (/card_battle_pvp_ratings.*breeder_id=eq\.friend-x/.test(u)) body = JSON.stringify([FRIEND.pvp]);
    else if (/card_battle_ranks.*breeder_id=eq\.friend-x/.test(u)) body = JSON.stringify([FRIEND.rank]);
    return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
  });
  await page.addInitScript(([rec, col, freshSave]) => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_intro_done', true); put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
    put('mh_rhythm_tutorial_seen_v1', true); put('mh_breeder_id_v1', 'self-user'); put('mh_masu_migrated', true);
    if (!freshSave) { put('mh_card_record_v1', rec); put('mh_card_collection_v1', col); }
  }, [RECORD, COLLECTION, fresh]);
  const clickText = async (pattern) => page.evaluate((source) => {
    const rx = new RegExp(source);
    const b = [...document.querySelectorAll('button')].filter((x) => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim()))[0];
    if (!b) return false; b.click(); return true;
  }, pattern);
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 40000 });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), { timeout: 40000 });
  for (let i = 0; i < 12; i++) { if (!(await clickText('^(受け取る|閉じる|OK|確認|あとで|次へ|はじめる|決定|スキップ)$'))) break; await page.waitForTimeout(250); }
  return page;
};
const openProfile = async (page) => {
  await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
  await page.waitForSelector('[data-profile-battle-records]', { timeout: 15000 });
  await page.waitForTimeout(1200);
};
// 欄の中の字が切れていないか・画面の中か
const statsLook = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cut = [...el.querySelectorAll('span, b')].filter((x) => x.getClientRects().length && x.scrollWidth > x.clientWidth + 1).map((x) => x.innerText.slice(0, 12));
  const t = (q) => (el.querySelector(q) || {}).innerText || '';
  return { inside: r.left >= 0 && r.right <= innerWidth + 0.5, cut, easy: t('[data-card-stats-level="easy"]'), master: t('[data-card-stats-level="master"]'), streak: t('[data-card-stats-streak]'), pvp: t('[data-card-stats-pvp]'), dex: t('[data-card-stats-dex]') };
}, sel);

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    for (const [w, h] of [[320, 568], [390, 844]]) {
      const page = await boot(browser, w, h, false, errors);
      const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_card_')).map((k) => [k, localStorage.getItem(k)])));
      await openProfile(page);
      await page.locator('[data-card-stats="self"]').scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(300);
      const r = await statsLook(page, '[data-card-stats="self"]');
      if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.locator('[data-card-stats="self"]').screenshot({ path: path.join(SHOT, `profile-stats-${w}.png`) }).catch(() => {}); }
      check(`① ${w}×${h}: 自分のプロフィールに、保存のとおりの戦績が出る`, r && /12/.test(r.easy) && /0/.test(r.master) && /7/.test(r.streak) && /3勝2敗/.test(r.pvp) && /強さ 1488/.test(r.pvp) && /^カード図鑑\s*4\s*\/\d+/.test(r.dex.replace(/\n/g, ' ')), JSON.stringify(r));
      check(`② ${w}×${h}: 戦績の欄の字が切れない・画面の中`, r && r.inside && r.cut.length === 0, JSON.stringify(r && r.cut));
      // ④ フレンドの戦績: フレンドのプロフィールの「バトル」に置く部品を、同じ幅で描く
      const f = await page.evaluate(async (w2) => {
        /* eslint-disable no-undef */
        const host = document.createElement('div');
        host.style.cssText = `position:fixed;left:0;top:0;width:${w2}px;z-index:99999;background:#0f172a;padding:12px`;
        document.body.appendChild(host);
        const root2 = ReactDOM.createRoot(host);
        root2.render(React.createElement('div', null, React.createElement(CardBattleStatsFriend, { breederId: 'friend-x' }), React.createElement(CardBattleStatsFriend, { breederId: 'nobody-y' })));
        for (let i = 0; i < 50 && !host.querySelector('[data-card-stats="friend"]'); i++) await new Promise((res) => setTimeout(res, 100));
        await new Promise((res) => setTimeout(res, 300));
        return { count: host.querySelectorAll('[data-card-stats="friend"]').length };
      }, w);
      const fr = await statsLook(page, '[data-card-stats="friend"]');
      if (SHOT) await page.locator('[data-card-stats="friend"]').screenshot({ path: path.join(SHOT, `friend-stats-${w}.png`) }).catch(() => {});
      check(`④ ${w}×${h}: フレンドの戦績は表から(表に無い人は出さない)`, f.count === 1 && fr && /30/.test(fr.easy) && /1/.test(fr.master) && /11/.test(fr.streak) && /6勝4敗/.test(fr.pvp) && /強さ 1532/.test(fr.pvp) && /140/.test(fr.dex) && fr.cut.length === 0, JSON.stringify({ f, fr }));
      const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_card_')).map((k) => [k, localStorage.getItem(k)])));
      check(`⑤ ${w}×${h}: カードの保存を書き換えない`, JSON.stringify(before) === JSON.stringify(after), Object.keys(after).join(','));
      await page.close();
    }
    // ③ 一度も遊んでいない人
    {
      const page = await boot(browser, 390, 844, true, errors);
      await openProfile(page);
      check('③ 一度も遊んでいない人には、戦績の欄を出さない', (await page.locator('[data-card-stats="self"]').count()) === 0);
      await page.close();
    }
    check('⑤ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
