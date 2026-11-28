#!/usr/bin/env node
// 事件簿の人物調書(r1126-117)を、進み具合ごとに撮る。保存(mh_xmas_novel_v1)の snaps・endings を変えて起動画面から開く
// 使い方: node tools/novel/xmas-novel-profile-shots.js <出力ディレクトリ>        縦 390×844・横 844×390・横小 667×375
//         node tools/novel/xmas-novel-profile-shots.js <出力ディレクトリ> --tate  縦だけ
//  撮る物: 進み具合(未読 / 第一章 / 第七章+結末 / 真エンド)ごとに一覧と、黒羽・きゅうこの調書。
//  あわせて、開いた項目の数が進み具合どおりか(未読 0 / 第一章 0 / 第七章+結末 3 / 真エンド 4)を確かめる
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || 'shots');
const PORT = 8000 + Math.floor(Math.random() * 900);
const snap = (id) => ({ scene: `${id}-1`, idx: 0, flags: {}, clues: [], ans: {}, panel: {} });
const STAGES = [
  { name: '0-none', save: {}, items: 0 },
  { name: '1-ch1', save: { snaps: { C1: snap('C1') }, read: ['C1-1:1-1-1'] }, items: 0 },
  { name: '2-ch7', save: { snaps: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [`C${n}`, snap(`C${n}`)])), endings: ['END-X1'] }, items: 3 },
  { name: '3-true', save: { snaps: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`C${n}`, snap(`C${n}`)])), endings: ['END-G'] }, items: 4 },
];
const VIEWS = process.argv.includes('--tate') ? [['tate', { width: 390, height: 844 }]]
  : [['tate', { width: 390, height: 844 }], ['yoko', { width: 844, height: 390 }], ['yokosmall', { width: 667, height: 375 }]];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

(async () => {
  const { chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'));
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let bad = 0;
  try {
    for (const st of STAGES) for (const [vn, vp] of VIEWS) {
      const page = await (await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript((seed) => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
        put('mh_xmas_novel_v1', seed);
      }, { cur: null, ...st.save });
      await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
      await page.evaluate(() => openXmasNovel({ force: true, playerName: 'テスト' }));
      await page.locator('[data-xmas-novel-profile-open]').click({ timeout: 8000 });
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(OUT, `${st.name}-list-${vn}.jpg`), type: 'jpeg', quality: 80 });
      if (st.name !== '0-none') {
        for (const who of ['kuroba', 'kyuko']) {
          await page.locator(`[data-xmas-novel-profile-pick="${who}"]`).click();
          await page.waitForTimeout(300);
          const n = await page.locator('[data-xmas-novel-profile-item][data-open]').count();
          if (n !== st.items) { console.log(`NG: ${st.name} ${who} 開いた項目 ${n}(見込み ${st.items})`); bad += 1; }
          await page.screenshot({ path: path.join(OUT, `${st.name}-${who}-${vn}.jpg`), type: 'jpeg', quality: 80, fullPage: false });
          await page.locator('[data-xmas-novel-profile-back]').click();
          await page.waitForTimeout(200);
        }
      }
      console.log(`${errors.length ? 'NG' : 'OK'}: ${st.name} ${vn}${errors.length ? ` エラー ${errors[0]}` : ''}`);
      if (errors.length) bad += 1;
      await page.context().close();
    }
  } finally { await browser.close(); server.close(); }
  process.exit(bad ? 1 : 0);
})();
