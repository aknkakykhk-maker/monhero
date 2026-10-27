#!/usr/bin/env node
// モンヒロビートのリザルト画面の文が、言葉の途中で折れていないか・字が切れていないかを数える(2026-10-27 ビート部・部長テンポくんの依頼)。
// 数え方は ja-wrap-beat-screen-check.js と同じ(SCAN・CLIP を借りる)。あちらは演奏の前の画面だけを巡るので、リザルトはここで見る。
//
//   node tools/boot/ja-wrap-beat-result-check.js          # いまの曲と曲名のいちばん長い曲を早送りで流し、リザルトを 320×568・375×667・390×844・844×390 で数える
//   node tools/boot/ja-wrap-beat-result-check.js --list   # 折れた所・切れた所を全部出す
//   SHOT=/tmp/r node tools/boot/ja-wrap-beat-result-check.js  # 大きさごと・送るごとの画面を撮る(/tmp/r-320x568-1.png など)
//
// 早送りのしかた(この検査の中だけ。ゲームのファイルは変えない):
//   ・曲の時計の元(AudioContext の currentTime)を SPEED 倍で進める。2分の曲が10秒ほどで終わる
//   ・叩かないので全部 MISS になる。ライフが0になると「失敗」のリザルトになり、ふだん見る形と違うので、
//     配る rhythm-mode.js のライフの減りだけを0にする(rhythm-record-fx-check.js と同じやり方)
// リザルトは中の箱(data-rhythm-result-scroll)が動くので、箱を少しずつ下へ送りながら、見えている所を数える。
// 上限は ja-wrap-beat-screen-check.js と同じ BEAT_SCREEN_WRAP_LIMIT・BEAT_SCREEN_CLIP_LIMIT、わざと切っている所も同じ CLIP_ALLOW
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const { SCAN, CLIP, CLIP_ALLOW } = require('./ja-wrap-beat-screen-check.js');
const ROOT = path.resolve(__dirname, '..', '..'), PORT = 8972;
const LIST = process.argv.includes('--list');
const RESULT_WRAP_LIMIT = 0;
const RESULT_CLIP_LIMIT = 0;
const SPEED = 12;
// いま選ばれている曲と、曲名のいちばん長い曲(2026-10-27 部長「横持ちで同じ長い曲名を見回って」)。ja-wrap-beat-play-check.js の LONG_TITLE_SONG と同じ曲
const RESULT_SONGS = [['', ''], ['toward_the_stars_short', '(長い曲名)']];
const LIFE_DELTA_FROM = 'BAD:-20, MISS:-50';
const SIZES = [[320, 568], [375, 667], [390, 844], [844, 390]];
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
      await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
      await page.waitForTimeout(1200); await closeAll();
      await clickText('モンヒロビート');
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
        // 祝いの演出・助手の吹き出しなどが落ち着くまで待つ
        await page.waitForTimeout(3500); await closeAll();
        for (const [W, H] of SIZES) {
          await page.setViewportSize({ width: W, height: H }); await page.waitForTimeout(900);
          if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}${tag}-${W}x${H}.png` });
          const allow = CLIP_ALLOW.map(([k, sel]) => [k, sel]);
          for (let step = 0; step < 30; step++) {
            if (process.env.SHOT && step) await page.screenshot({ path: `${process.env.SHOT}${tag}-${W}x${H}-${step}.png` });
            for (const x of await page.evaluate(SCAN)) found.push(`リザルト${tag} ${W}×${H}: ${x}`);
            for (const [kind, t] of await page.evaluate(CLIP, allow)) clipped.push(`リザルト${tag} ${W}×${H}: ${kind}「${t}」`);
            const more = await page.evaluate((s) => { const b = document.querySelector('[data-rhythm-result-scroll]'); if (!b) return false; if (s === 0) { b.scrollTop = 0; } const before = b.scrollTop; b.scrollTop += Math.max(60, b.clientHeight * .7); return b.scrollTop > before; }, step);
            if (!more) break; await page.waitForTimeout(250);
          }
        }
      }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  const uniq = [...new Set(found)], clipUniq = [...new Set(clipped)];
  if (LIST) for (const x of [...uniq, ...clipUniq]) console.log('  ', x);
  check('リザルトで、言葉の途中で折れた所が上限(RESULT_WRAP_LIMIT)以下', uniq.length <= RESULT_WRAP_LIMIT,
    `${uniq.length}件(上限 ${RESULT_WRAP_LIMIT})${uniq.length ? ' — ' + uniq.slice(0, 6).join(' / ') : ''}`);
  check('リザルトで、字が切れた・はみ出した所が上限(RESULT_CLIP_LIMIT)以下', clipUniq.length <= RESULT_CLIP_LIMIT,
    `${clipUniq.length}件(上限 ${RESULT_CLIP_LIMIT})${clipUniq.length ? ' — ' + clipUniq.slice(0, 6).join(' / ') : ''}`);
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
