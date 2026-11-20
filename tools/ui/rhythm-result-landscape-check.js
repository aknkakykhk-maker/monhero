#!/usr/bin/env node
// モンヒロビートのリザルトを、縦・横・PCで開いたときの「最初の画面」に、曲名・点数・判定の数が出ていることを確かめる(2026-11-20・r1119-031/033 点検 V3)。
//   node tools/ui/rhythm-result-landscape-check.js
//   SHOT=/tmp/x node tools/ui/rhythm-result-landscape-check.js   # 大きさごとの最初の画面を撮る
// ja-wrap-beat-result-check.js と同じ早送りで1曲を流してリザルトまで来る(叩かないので全部 MISS・ライフの減りだけ0にする)。
// 横(スマホ)は高さが400px足らずなので、ランクアップの窓が画面を埋めて、点数・評価・判定の数が下へ送らないと見えなくなっていた。
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8975;
const LIST = process.argv.includes('--list');
const RESULT_WRAP_LIMIT = 0;
const RESULT_CLIP_LIMIT = 0;
const SPEED = 12;
// いま選ばれている曲と、曲名のいちばん長い曲(2026-10-27 部長「横持ちで同じ長い曲名を見回って」)。ja-wrap-beat-play-check.js の LONG_TITLE_SONG と同じ曲
const RESULT_SONGS = [['', '']];
const LIFE_DELTA_FROM = 'BAD:-20, MISS:-50';
const SIZES = [[390, 844], [844, 390], [812, 375], [740, 360], [932, 430], [667, 375], [568, 320], [1280, 800]];
let failed = 0;
const check = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let patched = false;
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), f = path.join(ROOT, rel);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  if (rel === 'monster-hero/data/rhythm-mode.js') { const t = fs.readFileSync(f, 'utf8'); patched = t.includes(LIFE_DELTA_FROM); res.end(t.replace(LIFE_DELTA_FROM, 'BAD:0, MISS:0')); return; }
  fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const found = [], clipped = [];
  try {
    for (const [songId, tag] of RESULT_SONGS) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
      // ランキングの送信は本番へ行かせない(空の返事で受ける)。ゲーム側の「自動操作では書き込まない」止めも外す(26-supabase.jsx)
      await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 201, contentType: 'application/json', body: '[]' }));
      // 助手の中継(Edge Function)は本物の AI を呼ぶので止める(breeder-level-table-check が見張る・2026-10-27)
      await page.route('**/functions/v1/**', (r) => r.abort());
      await page.addInitScript((speed) => {
        window.__mhSupabaseStubbed = true;
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true); put('mh_rhythm_tutorial_seen_v1', true);
        const P = (window.BaseAudioContext || window.AudioContext).prototype, d = Object.getOwnPropertyDescriptor(P, 'currentTime');
        if (d && d.get) Object.defineProperty(P, 'currentTime', { configurable: true, get() { return d.get.call(this) * speed; } });
      }, SPEED);
      const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const b = [...document.querySelectorAll('button')].find((x) => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim())); if (!b) return false; b.click(); return true; }, p);
      const closeAll = async () => { for (let i = 0; i < 10; i++) { if (!(await clickText('^(受け取る|閉じる|OK|確認|スキップ|あとで読む|とじる)$'))) break; await page.waitForTimeout(300); } };
      const t0 = Date.now();
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), null, { timeout: 40000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForFunction(() => !!document.querySelector('main.mh-home-scene'), null, { timeout: 40000 });
      await page.waitForTimeout(1200); await closeAll();
      await page.evaluate(() => document.querySelector('[data-home-fac="rhythm"]')?.click());
      await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 20000 }); await page.waitForTimeout(800); await closeAll();
      await clickText('ソロライブ');
      await page.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 }); await page.waitForTimeout(600); await closeAll();
      if (songId) {
        // 版をまとめた行を押してから、版の切り替えで選ぶ(ja-wrap-beat-play-check.js と同じ)
        const row = page.locator(`[data-rhythm-song-row^="${songId.replace(/_(short|full)$/, '')}"]`).first();
        await row.scrollIntoViewIfNeeded(); await row.click(); await page.waitForTimeout(500);
        const ver = page.locator(`[data-rhythm-song-version="${songId}"]`).first();
        if (await ver.count()) { await ver.click(); await page.waitForTimeout(500); }
      }
      await page.evaluate(() => document.querySelector('[data-rhythm-demo-start]').click());
      await page.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
      const reached = await page.waitForSelector('[data-rhythm-result-scroll]', { timeout: 180000 }).then(() => true).catch(() => false);
      check('配る rhythm-mode.js のライフの減りを0にできた(早送りで全部 MISS でも、ふだんのリザルトになる)', patched, patched ? '' : `「${LIFE_DELTA_FROM}」が見つからない。書き方が変わったらここを直す`);
      check(`1曲を早送りで流してリザルトまで来た${tag}`, reached, `${Math.round((Date.now() - t0) / 1000)}秒${errors.length ? ' / ' + errors[0] : ''}`);
      if (reached) {
        await page.waitForTimeout(3500); await closeAll();
        for (const [W, H] of SIZES) {
          await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(900);
          // ランクアップの大きな演出(押すと閉じる)を閉じる
          for (let k = 0; k < 4; k++) { await page.mouse.click(Math.round(W / 2), Math.round(H / 3)); await page.waitForTimeout(500); }
          await page.evaluate(() => { const b = document.querySelector('[data-rhythm-result-scroll]'); if (b) b.scrollTop = 0; });
          await page.waitForTimeout(2500);
          if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}-${W}x${H}.png` });
          const m = await page.evaluate(() => {
            const box = document.querySelector('[data-rhythm-result-scroll]'); if (!box) return { none: true };
            const br = box.getBoundingClientRect(); const out = {};
            const vis = (q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); const top = Math.max(r.top, br.top); const bot = Math.min(r.bottom, br.bottom); return { h: Math.round(r.height), seen: r.height > 0 ? Math.max(0, bot - top) / r.height : 0 }; };
            out.song = vis('[data-rhythm-result-song-name]'); out.score = vis('[data-rhythm-result-score]'); out.judge = vis('[data-rhythm-result-judgment-table]'); out.rank = vis('[data-player-rank-gain="beat"]'); out.up = vis('[data-player-rank-up="beat"]');
            out.box = Math.round(br.height); out.footer = (() => { const f = [...document.querySelectorAll('button')].find((x) => /もう一度プレイ/.test(x.innerText || '')); if (!f) return null; const r = f.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; })();
            return out;
          });
          const land = W > H && W >= 740 && H < 520; // 横(スマホ・幅740以上): 曲名・点数・判定の数が全部。幅が740未満の横(古い小さな機種)と PC・縦は、曲名・点数まで
          const need = (k) => m[k] && m[k].seen >= 0.9;
          if (land) {
            check(`リザルト ${W}×${H}: 最初の画面に 曲名・点数・判定の数 が全部出る`, m.song && m.score && m.judge && need('song') && need('score') && need('judge'), JSON.stringify({ song: m.song, score: m.score, judge: m.judge, box: m.box }));
            check(`リザルト ${W}×${H}: ランクアップの窓が最初の画面に(経験値の棒と)見えていて、点数をふさがない`, !m.up || m.up.seen > 0, JSON.stringify({ up: m.up, rank: m.rank }));
          } else {
            check(`リザルト ${W}×${H}: 最初の画面に 曲名・点数 が出る`, m.song && m.score && need('song') && need('score'), JSON.stringify({ song: m.song, score: m.score, box: m.box }));
          }
          console.log(`INFO: ${W}x${H} ${JSON.stringify(m)}`);
        }
      }
      if (reached && process.env.SHOT) {
        // 🔄横(自前で回す)も見た目だけ撮る(縦390×844を回した形)
        await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => { try { RHYTHM_VIEW_ROTATION.set(90); } catch (e) {} }); await page.waitForTimeout(1200);
        for (let k = 0; k < 3; k++) { await page.mouse.click(200, 300); await page.waitForTimeout(400); }
        await page.evaluate(() => { const b = document.querySelector('[data-rhythm-result-scroll]'); if (b) b.scrollTop = 0; }); await page.waitForTimeout(400);
        await page.screenshot({ path: `${process.env.SHOT}-rot-390x844.png` });
      }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();
