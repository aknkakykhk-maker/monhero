#!/usr/bin/env node
// クリスマスのミステリーノベル: 決めた行から事件簿を開いて止め絵を撮る(r1126-043 主役の書き分けの見せ用)。
//   保存(mh_xmas_novel_v1)の「続き」を、撮りたい場面・行・派(f_A1)にして開き、「続きから」を押して撮る。
//   撮る物は下の SHOTS。行は台本の番号(7-1-3a など)で書く
// 使い方: node tools/novel/xmas-novel-shots.js <出力ディレクトリ>   (縦 390×844・2倍)
//         node tools/novel/xmas-novel-shots.js <出力ディレクトリ> --r1126-046   幕間と過去編(r1126-046)の組を撮る
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || 'shots');
const PORT = 8000 + Math.floor(Math.random() * 900);
const SHOTS = [
  { name: '01-a1', row: 'A1', side: 0, label: '第1章 A1(どっちを手伝う？)' },
  { name: '02-a2-atsu', row: 'A2', side: 1, label: 'あつ派 A2 の選択肢' },
  { name: '03-a2-sora', row: 'A2', side: 2, label: 'ソラシド派 A2 の選択肢' },
  { name: '04-x1-sora', row: '2-X-6s', side: 2, label: 'ソラシド派 END-X1 の場面' },
  { name: '05-x2-atsu', row: '5-X-4a', side: 1, label: 'あつ派 END-X2 の場面' },
  { name: '06-x3-sora', row: '6-X-10s', side: 2, label: 'ソラシド派 END-X3 の場面' },
  { name: '07-c7-atsu', row: '7-1-13a', side: 1, label: 'あつ派 第7章 ソラシドがドラを名指し' },
  { name: '08-c8-atsu', row: '8-1-14a', side: 1, label: 'あつ派 第8章「謎はすべて解けた!」' },
  { name: '09-c8-sora', row: '8-1-15s', side: 2, label: 'ソラシド派 第8章「真実はいつもひとつ!」' },
  { name: '10-c8-past', row: '8-3-12', side: 1, label: '第8章 12年前(ももすけ)' },
];
// 幕間と過去編(r1126-046)。list: 起動画面の「章から」の一覧(真グッドを見たあと)を撮る
const SHOTS_046 = [
  { name: '01-m1-secret', row: '1-M-8', side: 1, label: '幕間 眠る客(？？？)' },
  { name: '02-m2-kuroba', row: '2-M-16', side: 1, label: '幕間 鍵をかけた部屋(黒羽「あいつ」)' },
  { name: '03-m3-ichika', row: '3-M-7', side: 2, label: '幕間 古い鍵(イチーカ)' },
  { name: '04-m4-shirase', row: '4-M-12', side: 2, label: '幕間 書きかけの手紙(白瀬)' },
  { name: '05-m5-dra', row: '5-M-12', side: 1, label: '幕間 手をつけないクッキー(ドラ)' },
  { name: '06-m6-mochi', row: '6-M-9', side: 2, label: '幕間 帳面の名前(もちまる)' },
  { name: '07-past-list', list: true, label: '「章から」の一覧(過去編が開いた)' },
  { name: '08-past-kuroba', row: '12-1-9', side: 0, label: '過去編 ホールの子守歌(黒羽)' },
  { name: '09-past-lie', row: '12-4-7', side: 0, label: '過去編 早すぎた鐘(黒羽のうそ)' },
  { name: '10-past-shirase', row: '12-6-3', side: 0, label: '過去編 雪原の朝(白瀬)' },
  { name: '11-past-mochi', row: '12-7-4', side: 0, label: '過去編 開けておく扉(もちまる)' },
];
const LIST = process.argv.includes('--r1126-046') ? SHOTS_046 : SHOTS;

const ctx = vm.createContext({});
vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/79-xmas-novel-script.jsx'), 'utf8')}\nthis.S = XMAS_NOVEL_SCRIPT;`, ctx);
const where = (rowId) => {
  for (const sc of ctx.S.scenes) { const i = (sc.rows || []).findIndex((r) => r.id === rowId); if (i >= 0) return { scene: sc.id, idx: i }; }
  return null;
};
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
    for (const sh of LIST) {
      const at = sh.list ? { scene: 'C1-1', idx: 0 } : where(sh.row);
      if (!at) { console.log(`NG: ${sh.row} が台本に無い`); bad += 1; continue; }
      const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })).newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript((seed) => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
        put('mh_xmas_novel_v1', seed);
      }, { cur: sh.list ? null : { scene: at.scene, idx: at.idx, flags: sh.side ? { f_A1: sh.side } : {}, clues: [], ans: {}, panel: {} },
        ...(sh.list || LIST === SHOTS_046 ? { endings: ['END-G'], snaps: { C1: { scene: 'C1-1', idx: 0, flags: {}, clues: [], ans: {}, panel: {} } } } : {}) });
      await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
      await page.evaluate(() => openXmasNovel({ force: true, playerName: 'テスト' }));
      await page.locator(sh.list ? '[data-xmas-novel-chapters]' : '[data-xmas-novel-continue]').click({ timeout: 8000 });
      await page.waitForTimeout(2600);
      // 文字送りを最後まで(1回だけ叩く。問いの行はそのまま)
      const row = await page.evaluate(() => { const r = document.querySelector('[data-xmas-novel]'); return r ? r.getAttribute('data-row') : null; });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, `${sh.name}.jpg`), type: 'jpeg', quality: 82 });
      console.log(`${errors.length ? 'NG' : 'OK'}: ${sh.name} ${sh.label} — 画面の行 ${row}${errors.length ? ` エラー ${errors[0]}` : ''}`);
      if (errors.length) bad += 1;
      await page.context().close();
    }
  } finally { await browser.close(); server.close(); }
  process.exit(bad ? 1 : 0);
})();
