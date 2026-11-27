#!/usr/bin/env node
// クリスマスのイベント「聖夜の名探偵」の開幕を 11/28(土) 10:00 に早めた(台帳 r1126-063)のを、時計をずらした実際のブラウザで確かめる。
//
//   node tools/battle/xmas-open-1128-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、縦の止め絵(HOME・イベントページのボーナスのタブ)を残す
//
//   ① 11/28 9:55: まだ開かない(入口は「序章公開中・11/28 10:00 開幕」・ボス・きせかえ・1.5倍・事件簿の本編は無い)
//   ② 11/28 10:05: 開く(ボス・きせかえ・カードとバトルの1.5倍・事件簿の本編)。モンヒロビートの5倍(xmas_2026)はまだ
//   ③ 11/30 0:05: モンヒロビートの5倍(xmas_2026)が付く
//   ④ 12/31 4:05: 片づく(入口もボスも無い・どの印も偽)
//   どの時刻も実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8961;
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const shiftClock = (iso) => ({ content: `(() => { const off = Date.parse(${JSON.stringify(iso)}) - Date.now(); const RD = Date;
  class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
  D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
const VP = { viewport: { width: 390, height: 844 } };
const CASES = [
  { id: '1-1128-0955', label: '① 11/28 9:55', iso: '2026-11-28T09:55:00+09:00', open: false, beat: false, entry: true },
  { id: '2-1128-1005', label: '② 11/28 10:05', iso: '2026-11-28T10:05:00+09:00', open: true, beat: false, entry: true },
  { id: '3-1130-0005', label: '③ 11/30 0:05', iso: '2026-11-30T00:05:00+09:00', open: true, beat: true, entry: true },
  { id: '4-1231-0405', label: '④ 12/31 4:05', iso: '2026-12-31T04:05:00+09:00', open: false, beat: false, entry: false },
];
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const c of CASES) {
      const ctx = await browser.newContext({ ...VP, hasTouch: true, isMobile: true, deviceScaleFactor: SHOT_DIR ? 2 : 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(shiftClock(c.iso));
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
        put('mh_rhythm_tutorial_seen_v1', true);
      });
      await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
      for (let i = 0; i < 8; i++) {
        const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
        if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
        await btn.dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(800);
      const shot = async (name) => { if (!SHOT_DIR) return; fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOT_DIR, `${c.id}-${name}.jpg`), type: 'jpeg', quality: 80 }); };
      const st = await page.evaluate(() => {
        const n = Date.now(); const F = RELEASE_FLAGS;
        const camp = typeof rhythmEventPointCampaignAt === 'function' ? rhythmEventPointCampaignAt(n) : null;
        return { raid: F.raidXmas === true, costume: F.xmasCostume === true, card: F.cardXmasBonus === true, battle: F.xmasBattleBonus === true,
          beatFlag: F.rhythmXmasBoost === true, beat: camp ? camp.id : null, novel: xmasNovelPlayableAt(n) === true,
          entry: !!document.querySelector('[data-home-xmas-entry]'), boss: !!document.querySelector('[data-home-raid-jack]'),
          entryText: (document.querySelector('[data-home-xmas-entry]') || {}).innerText || '' };
      });
      await shot('home');
      // 開幕の印(raidXmas)ときせかえの売り出し(xmasCostume)は「その時刻から先ずっと」真(終わったあとは回想とダイヤショップのため)。期間だけの物は1.5倍と事件簿の本編
      const sinceStart = c.open || c.id.startsWith('4-');
      check(`${c.label}: 開幕の印・きせかえは${sinceStart ? '立つ' : 'まだ立たない'}`, st.raid === sinceStart && st.costume === sinceStart, JSON.stringify(st));
      check(`${c.label}: カード1.5倍・バトル1.5倍・事件簿の本編は${c.open ? '開いている' : '開いていない'}`, [st.card, st.battle, st.novel].every((x) => x === c.open));
      check(`${c.label}: モンヒロビートの5倍(xmas_2026)は${c.beat ? '付く' : '付かない'}`, (st.beat === 'xmas_2026') === c.beat && st.beatFlag === c.beat, String(st.beat));
      check(`${c.label}: HOME の入口は${c.entry ? 'ある' : '無い'}・ボスは${c.open ? 'いる' : 'いない'}`, st.entry === c.entry && st.boss === c.open, st.entryText.replace(/\s+/g, ' '));
      if (c.id.startsWith('1-')) check(`${c.label}: 入口の札は「11/28 10:00 開幕」`, /11\/28 10:00 開幕/.test(st.entryText), st.entryText.replace(/\s+/g, ' '));
      if (st.entry) {
        await page.locator('[data-home-xmas-entry]').first().click();
        await page.waitForTimeout(1300);
        await page.getByRole('tab', { name: 'ボーナス' }).first().click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(900);
        const txt = await page.evaluate(() => (document.querySelector('[data-xmas-event]') || {}).innerText || '');
        check(`${c.label}: ボーナスのタブに「モンヒロビートの5倍は 11/30(月) 0:00 から」と出る`, /11\/30\(月\) 0:00 から/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 120));
        if (!c.open) check(`${c.label}: ボーナスのタブは開幕前の案内(11/28(土) 10:00 から)`, /11\/28\(土\) 10:00 から/.test(txt));
        await shot('bonus');
      }
      check(`${c.label}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `NG ${failed} 件` : 'クリスマスの開幕の前倒しの検査はすべて通りました');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
