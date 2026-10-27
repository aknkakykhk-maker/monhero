#!/usr/bin/env node
// モンヒロビートの演奏中の画面の文が、言葉の途中で折れていないか・字が切れていないかを数える(2026-10-27 ビート部・部長テンポくんの依頼)。
// 数え方は ja-wrap-beat-screen-check.js と同じ(SCAN・CLIP を借りる)。あちらは演奏の前の画面、ja-wrap-beat-result-check.js はリザルトを見る。
//
//   node tools/boot/ja-wrap-beat-play-check.js          # 320×568・375×667・390×844・844×390 で演奏中の画面を巡って数える
//   node tools/boot/ja-wrap-beat-play-check.js --list   # 折れた所・切れた所を全部出す
//   SHOT=/tmp/p node tools/boot/ja-wrap-beat-play-check.js  # 数えた画面を撮る(/tmp/p-曲名の帯-320x568.png など)
//
// 見る所(大きさごとに):
//   ・曲名の帯(演奏の始めに出る data-rhythm-song-intro)
//   ・演奏中の上の帯(data-rhythm-hud。横画面では上に1本で並ぶ)
//   ・一時停止の窓(data-rhythm-pause-menu)。見たら「やめる」で抜ける
//   ・練習の吹き出し(data-rhythm-tutorial-banner)。ノーツ図鑑の練習を TUTORIAL_IDS の分だけ流す。
//     空中のタップ・空中のスライドの説明(HELL の空中の案内)もここで出る(HELL を開けていなくても見られる)
// 演奏の道の中(data-rhythm-play-area の中の字)は CLIP が数えない。ノーツの絵が動くため
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const { SCAN, CLIP, CLIP_ALLOW } = require('./ja-wrap-beat-screen-check.js');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8973;
const LIST = process.argv.includes('--list');
const PLAY_WRAP_LIMIT = 0;
const PLAY_CLIP_LIMIT = 0;
const SIZES = [[320, 568], [375, 667], [390, 844], [844, 390]];
// ノーツ図鑑の練習のうち、吹き出しを見るもの(全部流すと長いので、文の長いもの・空中のもの)
const TUTORIAL_IDS = ['tap', 'hold', 'slide', 'sideFlick', 'monster', 'skyTap', 'skySlide'];
let failed = 0;
const check = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const found = [], clipped = [], seen = {};
  const allow = CLIP_ALLOW.map(([k, sel]) => [k, sel]);
  try {
    for (const [W, H] of SIZES) {
      const page = await browser.newPage({ viewport: { width: W, height: H } });
      await page.route(/supabase\.co/, (r) => r.abort());
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true); put('mh_rhythm_tutorial_seen_v1', true);
      });
      const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const b = [...document.querySelectorAll('button')].find((x) => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim())); if (!b) return false; b.click(); return true; }, p);
      const closeAll = async () => { for (let i = 0; i < 10; i++) { if (!(await clickText('^(受け取る|閉じる|OK|確認|スキップ|あとで読む|とじる)$'))) break; await page.waitForTimeout(300); } };
      const scan = async (name) => {
        seen[name] = (seen[name] || 0) + 1;
        if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${name}-${W}x${H}.png` });
        for (const x of await page.evaluate(SCAN)) found.push(`${name} ${W}×${H}: ${x}`);
        for (const [kind, t] of await page.evaluate(CLIP, allow)) clipped.push(`${name} ${W}×${H}: ${kind}「${t}」`);
      };
      // 曲の頭の 3・2・1 のあいだは止められないので、窓が出るまで押し直す
      const pauseNow = async () => {
        for (let i = 0; i < 40; i++) {
          await page.evaluate(() => document.querySelector('[data-rhythm-pause]')?.click());
          if (await page.waitForSelector('[data-rhythm-pause-menu]', { timeout: 500 }).then(() => true).catch(() => false)) { await page.waitForTimeout(400); return true; }
        }
        return false;
      };
      const toModeSelect = async () => {
        await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), null, { timeout: 40000 });
        await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
        await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
        await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
        await page.waitForTimeout(1200); await closeAll();
        await clickText('モンヒロビート');
        await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 20000 }); await page.waitForTimeout(800); await closeAll();
      };
      // 1) ソロライブ: 曲名の帯 → 演奏中の上の帯 → 一時停止の窓
      try {
        await toModeSelect();
        await clickText('ソロライブ');
        await page.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 }); await page.waitForTimeout(600); await closeAll();
        await page.evaluate(() => document.querySelector('[data-rhythm-demo-start]').click());
        await page.waitForSelector('[data-rhythm-song-intro]', { timeout: 30000 }); await page.waitForTimeout(700);
        await scan('曲名の帯');
        await page.waitForSelector('[data-rhythm-song-intro]', { state: 'detached', timeout: 30000 });
        if (!(await pauseNow())) throw new Error('一時停止の窓が出ない');
        await scan('一時停止の窓');
        // 上の帯は一時停止の窓に隠れるので、再開して 3・2・1 が終わってから数える
        await page.evaluate(() => document.querySelector('[data-rhythm-pause-resume]').click());
        await page.waitForTimeout(4500);
        await scan('演奏中の上の帯');
      } catch (e) { check(`ソロライブの演奏中 ${W}×${H} を開けた`, false, e.message.split('\n')[0].slice(0, 140)); }
      // 2) ノーツ図鑑の練習の吹き出し
      try {
        await toModeSelect();
        await page.waitForSelector('[data-rhythm-demo-help]', { timeout: 30000 });
        await page.evaluate(() => document.querySelector('[data-rhythm-demo-help]').click());
        await page.waitForSelector('[data-rhythm-demo-note-dex]', { timeout: 20000 });
        await page.evaluate(() => document.querySelector('[data-rhythm-demo-note-dex]').click());
        await page.waitForSelector('[data-rhythm-note-dex-list]', { timeout: 20000 });
        for (const id of TUTORIAL_IDS) {
          await page.evaluate((i) => document.querySelector(`[data-rhythm-note-dex-play="${i}"]`).click(), id);
          await page.waitForSelector('[data-rhythm-tutorial-banner]', { timeout: 20000 }); await page.waitForTimeout(900);
          await scan(`練習の吹き出し(${id})`);
          // 最後まで流すと長いので、一時停止から抜ける
          if (!(await pauseNow())) throw new Error(`練習(${id})で一時停止の窓が出ない`);
          await page.evaluate(() => document.querySelector('[data-rhythm-pause-exit]').click());
          await page.waitForSelector('[data-rhythm-note-dex-list]', { timeout: 20000 });
        }
      } catch (e) { check(`練習の吹き出し ${W}×${H} を開けた`, false, e.message.split('\n')[0].slice(0, 140)); }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  const want = ['曲名の帯', '演奏中の上の帯', '一時停止の窓', ...TUTORIAL_IDS.map((id) => `練習の吹き出し(${id})`)];
  const missing = want.filter((n) => seen[n] !== SIZES.length);
  check('演奏中の画面を、どの大きさでも全部数えた', !missing.length, missing.length ? `足りない: ${missing.join('・')}` : `${want.length}画面 × ${SIZES.length}大きさ`);
  const uniq = [...new Set(found)], clipUniq = [...new Set(clipped)];
  if (LIST) for (const x of [...uniq, ...clipUniq]) console.log('  ', x);
  check('演奏中の画面で、言葉の途中で折れた所が上限(PLAY_WRAP_LIMIT)以下', uniq.length <= PLAY_WRAP_LIMIT,
    `${uniq.length}件(上限 ${PLAY_WRAP_LIMIT})${uniq.length ? ' — ' + uniq.slice(0, 6).join(' / ') : ''}`);
  check('演奏中の画面で、字が切れた・はみ出した所が上限(PLAY_CLIP_LIMIT)以下', clipUniq.length <= PLAY_CLIP_LIMIT,
    `${clipUniq.length}件(上限 ${PLAY_CLIP_LIMIT})${clipUniq.length ? ' — ' + clipUniq.slice(0, 6).join(' / ') : ''}`);
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
