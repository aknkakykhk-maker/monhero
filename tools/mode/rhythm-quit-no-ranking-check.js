#!/usr/bin/env node
// 途中でやめた演奏は、ランキング(rankings)へ1件も送らないかを、本物のブラウザで確かめる(2026-11-23 r1119-152)。
//   社長「イベントランキングの曲ごとに回数表示あるけどそれが増えてる気がした(途中でやめても回数に加算されてない？)」
// 作りの上では、送るのは曲の最後まで流れた時(finish → onComplete。ライフ0の未クリアも含む)だけ。
// ここでは実際に次を動かし、偽の Supabase に届いた書き込みを数える。
//   ① 一時停止 → 曲選びへ戻る   ② 一時停止 → リスタート → 一時停止 → 曲選びへ戻る
//   ③ 画面を隠す(アプリを裏へ回した相当・visibilitychange) → 戻る → 一時停止 → 曲選びへ戻る
//   ④ 一時停止したまま画面ごと閉じる(ページを離れる相当)
//   ⑤ 見本(送る側): 曲の時計を速めて最後まで流す → rankings へ1件届く(この検査が送信を見られていることの確かめ)
// マルチライブ・レイドは同じ演奏画面を通るので、送る所が1か所(onComplete)だけなことを作りで確かめる(下の4つ)
//
//   node tools/mode/rhythm-quit-no-ranking-check.js
// 本物の Supabase へは1件も送らない(偽の Supabase)。既存のランキングには触れない。
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
const { chromium } = (() => { try { return require(path.join(ROOT, 'tools/node_modules/playwright')); } catch { return require('playwright'); } })();
const { createFakeSupabase } = require(path.join(ROOT, 'tools/playbot/lib/fake-supabase.js'));
const { eventStorySeed } = require(path.join(ROOT, 'tools/boot/quiet-boot-seed.js'));
const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream';
const SONG = 'mf_ichika_mix', DIFF = 'EASY';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail && !ok ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const seed = `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_rhythm_hell_story_seen_v1', true); put('mh_story_assistant_chat_seen_v1', true);
})()`;
// 曲の時計(AudioContext の currentTime)を速める仕掛け(⑤の見本だけ使う)。tools/browser/visual-compare-check.js の clockInit と同じ考え方
const clockInit = () => {
  const C = window.__qClock = { speed: 1 };
  const P = (window.BaseAudioContext || window.AudioContext).prototype, d = Object.getOwnPropertyDescriptor(P, 'currentTime');
  if (d && d.get) { let base = null, real0 = 0; Object.defineProperty(P, 'currentTime', { configurable: true, get() {
    const t = d.get.call(this); if (C.speed === 1) { base = null; return t; }
    if (base == null) { base = t; real0 = t; } return base + (t - real0) * C.speed; } }); }
};

// マルチライブ・レイドも同じ演奏画面(rhythmPlay の from:'multi' / 'raid')を通る。送る所が onComplete の1か所だけで、
// やめる側(onExit)に無いことを、作り(60-app.jsx)で確かめる。①〜⑤の実際の動きはこの同じ道を通る
{
  const app = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
  const calls = [...app.matchAll(/submitRhythmRankingScore\(rhythmPlay\./g)].map((m) => m.index);
  check('ランキングへ送る呼び出しは演奏画面の1か所だけ', calls.length === 1, `${calls.length}か所`);
  const at = calls[0] ?? -1, ex = app.indexOf('onExit={', at), oc = app.lastIndexOf('onComplete={', at);
  check('送るのは onComplete(曲の最後まで流れた時)の中で、onExit(やめた時)ではない', at > 0 && oc >= 0 && oc < at && ex > at && app.slice(oc, at).indexOf('onExit={') < 0);
  check('マルチライブ・レイドも同じ演奏画面を通る', /setRhythmPlay\(\{song,difficulty,from:'multi'/.test(app) && /setRhythmPlay\(\{ song, difficulty, from: 'raid' \}\)/.test(app));
  check('送るのはソロ・マルチ・レイドの3つ(from で絞る)', /if\(rhythmPlay\.from==='demo'\|\|rhythmPlay\.from==='multi'\|\|rhythmPlay\.from==='raid'\)submitRhythmRankingScore/.test(app));
}
(async () => {
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const sb = createFakeSupabase();
  const open = async () => {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
    await context.route('**/*', async (route) => {
      const u = route.request().url(), m = u.match(/^https:\/\/sky\.test\/(.*)$/);
      if (m) {
        const f = path.join(ROOT, decodeURIComponent(m[1].split('?')[0]));
        if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': mime(f), 'access-control-allow-origin': '*' } });
      }
      if (/supabase\.co/.test(u)) return sb.handle(route);
      return route.abort();
    });
    await context.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await context.addInitScript(seed); await context.addInitScript(eventStorySeed()); await context.addInitScript(clockInit);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
    await page.goto('https://sky.test/monster-hero/index.html', { waitUntil: 'load', timeout: 90000 });
    const clickText = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button,summary')].find(x => new RegExp(p).test(x.textContent)); if (b) b.click(); return !!b; }, re);
    const pointerDown = (sel) => page.evaluate((s) => { const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text)); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); if (b) b.click(); return !!b; }, sel);
    const closeDialogs = async (n) => { for (let i = 0; i < n; i++) { if (!(await clickText('^(確認|受け取る|受け取|閉じる|OK|スキップ|あとで読む|あとで|この案内を閉じる)$'))) break; await page.waitForTimeout(500); } };
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), null, { timeout: 90000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' }); await page.waitForTimeout(2500);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), null, { timeout: 40000 });
    await pointerDown({ aria: 'トップ画面へ進む' }); await page.waitForTimeout(2500);
    await closeDialogs(12);
    await page.evaluate(() => document.querySelector('[data-home-fac="rhythm"]')?.click()); await page.waitForTimeout(2500); await closeDialogs(6);
    await clickText('ソロライブ'); await page.waitForTimeout(2500); await closeDialogs(3);
    return { context, page, errors, closeDialogs };
  };
  // 曲選びから演奏を始め、曲が流れ始めるまで待つ
  const startPlay = async (page) => {
    await page.evaluate((id) => document.querySelector(`[data-rhythm-song-row="${id}"]`)?.click(), SONG); await page.waitForTimeout(800);
    await page.evaluate((d) => document.querySelector(`[data-rhythm-difficulty="${d}"]`)?.click(), DIFF); await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('[data-rhythm-demo-start]')?.click());
    await page.waitForFunction(() => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) > 1500, null, { timeout: 40000, polling: 100 });
  };
  const pause = async (page) => {
    await page.evaluate(() => document.querySelector('button[aria-label="ポーズ"]')?.click());
    await page.waitForSelector('[data-rhythm-pause-exit]', { timeout: 10000 });
  };
  const rankings = () => sb.writes.filter((w) => w.table === 'rankings').length;
  const backToSelect = async (page) => page.waitForSelector('[data-rhythm-song-row]', { timeout: 20000 }).then(() => true).catch(() => false);

  const { context, page, errors } = await open();
  // ①
  await startPlay(page); await page.waitForTimeout(1500);
  await pause(page); await page.evaluate(() => document.querySelector('[data-rhythm-pause-exit]')?.click());
  check('① 一時停止 → 曲選びへ戻る: 曲選びへ戻る', await backToSelect(page));
  await page.waitForTimeout(2500);
  check('① 一時停止 → 曲選びへ戻る: ランキングへ送らない', rankings() === 0, `rankings ${rankings()}件`);
  // ②
  await startPlay(page);
  await pause(page); await page.evaluate(() => document.querySelector('[data-rhythm-pause-restart]')?.click());
  await page.waitForFunction(() => (window.__mhTestHooks?.rhythmSongMs?.() ?? -1) > 1500, null, { timeout: 40000, polling: 100 });
  await pause(page); await page.evaluate(() => document.querySelector('[data-rhythm-pause-exit]')?.click());
  await backToSelect(page); await page.waitForTimeout(2500);
  check('② リスタート → 一時停止 → 曲選びへ戻る: ランキングへ送らない', rankings() === 0, `rankings ${rankings()}件`);
  // ③
  await startPlay(page);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(800);
  if (!(await page.$('[data-rhythm-pause-exit]'))) await pause(page);
  await page.evaluate(() => document.querySelector('[data-rhythm-pause-exit]')?.click());
  await backToSelect(page); await page.waitForTimeout(2500);
  check('③ 画面を隠す → 戻る → 一時停止 → 曲選びへ戻る: ランキングへ送らない', rankings() === 0, `rankings ${rankings()}件`);
  // ④
  await startPlay(page); await pause(page);
  await page.close(); await new Promise((r) => setTimeout(r, 2500));
  check('④ 一時停止したまま画面を閉じる: ランキングへ送らない', rankings() === 0, `rankings ${rankings()}件`);
  check('ページのエラーが出ない(①〜④)', errors.length === 0, errors.slice(0, 3).join(' / '));
  await context.close();

  // ⑤ 見本: 最後まで流すと1件送る
  const b = await open();
  await startPlay(b.page);
  await b.page.evaluate(() => { window.__qClock.speed = 40; });
  const done = await b.page.waitForFunction(() => !window.__mhTestHooks?.rhythmSongMs || document.querySelector('[data-rhythm-result]') || /SCORE|RESULT|リザルト/.test(document.body.innerText) && !document.querySelector('[data-rhythm-play-area]'), null, { timeout: 120000, polling: 500 }).then(() => true).catch(() => false);
  await b.page.waitForTimeout(4000);
  check('⑤ 見本: 最後まで流すと演奏が終わる', done);
  check('⑤ 見本: 最後まで流すとランキングへ1件送る(この検査が送信を見られている)', rankings() === 1, `rankings ${rankings()}件`);
  await b.context.close();
  await browser.close();
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK'); process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('NG: 検査が途中で止まった — ' + String(e && e.message || e).slice(0, 300)); process.exit(1); });
