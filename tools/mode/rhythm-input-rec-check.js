#!/usr/bin/env node
// 入力の記録(デバッグ設定・2026-10-15・RHYTHM_INPUT_REC)を見張る。
//   ① 部品: 切のときは記録しない・入のときは指と判定の出来事を残す・途中でやめた演奏も閉じて残す・名前を入れない
//   ② 演奏画面: 入にして実際に叩くと、曲・難易度・指の動きが記録に入る(ランキング・保存キーには何も足さない)
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9203;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// ---- ① 部品 ----
{
  const src = read('monster-hero/data/rhythm-mode.js');
  const a = src.indexOf("const RHYTHM_INPUT_REC_KEY="), b = src.indexOf('const RHYTHM_TOUCH_BRIDGE_WAIT_MS=');
  check('部品を取り出せる', a >= 0 && b > a);
  const store = new Map();
  const listeners = new Map();
  const el = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 400 }),
    addEventListener: (t, f) => listeners.set(t, f), removeEventListener: (t) => listeners.delete(t) };
  const ctx = { localStorage: { getItem: (k) => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    performance: { now: () => 1000 }, window: { innerWidth: 844, innerHeight: 390, devicePixelRatio: 3 }, navigator: { userAgent: 'test' } };
  vm.runInNewContext(`${src.slice(a, b)}\nthis.R=RHYTHM_INPUT_REC;this.KEY=RHYTHM_INPUT_REC_KEY;`, ctx);
  const R = ctx.R;
  check('保存キーは新しい mh_rhythm_input_rec_v1(入/切だけ)', ctx.KEY === 'mh_rhythm_input_rec_v1');
  check('切のときは記録を始めない', R.begin(el, () => 0, { songId: 's' }) === false && listeners.size === 0);
  R.setEnabled(true);
  let t = 500;
  check('入にすると、指(touch)とポインタの見張りを付ける', R.begin(el, () => t, { songId: 'song', difficultyId: 'HELL' }) === true && listeners.size === 8);
  listeners.get('touchstart')({ type: 'touchstart', touches: [1], changedTouches: [{ identifier: 3, clientX: 110, clientY: 220, radiusX: 12, radiusY: 10, force: 0.5 }] });
  t = 620; R.event('miss', { reason: 'no-input', lane: 2 });
  listeners.get('touchend')({ type: 'touchend', touches: [], changedTouches: [{ identifier: 3, clientX: 112, clientY: 221 }] });
  const last = R.finish({ cleared: true, score: 1 });
  check('指の位置は演奏面からの位置・接触の幅も残る', last && last.events[0].c[0].x === 100 && last.events[0].c[0].y === 200 && last.events[0].c[0].rx === 12 && last.events[0].ms === 500);
  check('判定の出来事は曲の時刻つきで残る', last.events[1].k === 'judge' && last.events[1].type === 'miss' && last.events[1].ms === 620 && last.events[1].d.reason === 'no-input');
  check('終わると見張りを外す', listeners.size === 0 && R.isRecording() === false);
  check('曲・難易度・画面の大きさが付く(名前は入れない)', last.songId === 'song' && last.difficultyId === 'HELL' && last.area.w === 800 && !/breeder|user_?name/i.test(JSON.stringify(last)));
  const s = R.summary();
  check('まとめの数', s.touches === 2 && s.judges === 1 && s.events === 3, JSON.stringify(s));
  R.begin(el, () => 0, { songId: 'quit' });
  check('途中でやめた演奏も、コピーの前に閉じて残す', R.close().songId === 'quit' && R.close().extra.interrupted === true);
  R.setEnabled(false);
  check('切に戻すとキーを消す', !store.has('mh_rhythm_input_rec_v1'));
}

// ---- 再生の道具(rhythm-input-replay.js)の部品 ----
{
  const R = require('./rhythm-input-replay.js');
  const ev = [
    { k: 'touchstart', ms: 900, at: 1950, ts: 1940, c: [{ id: 123456, x: 10, y: 20, rx: 9, ry: 9, f: 0 }] },
    { k: 'touchstart', ms: 1000, at: 2050, ts: 2045, c: [{ id: 999, x: 30, y: 40, rx: 9, ry: 9, f: 0 }] },
    { k: 'touchend', ms: 1100, at: 2150, ts: 2148, c: [{ id: 123456, x: 10, y: 20 }] },
    { k: 'pointerdown', ms: 900, at: 1951, id: 3, pt: 'touch', x: 10, y: 20 },
  ];
  check('再生: 曲の頭の時刻を記録から出す', R.songStartAt(ev) === 1050);
  check('再生: 起きた時刻は e.timeStamp を使い、基準が違うものは受け取った時刻', R.occurAt(ev[0]) === 1940 && R.occurAt({ at: 100000, ts: 3 }) === 100000);
  const plan = R.touchPlan(ev, 1050);
  check('再生: 指は小さな番号に直し、そのとき触れている指を全部渡す(pointer は流さない)',
    plan.length === 3 && plan[0].points[0].id === 1 && plan[1].points.length === 2 && plan[2].type === 'touchEnd' && plan[2].points.length === 1 && plan[2].points[0].id === 2 && plan[0].rel === 890);
  const o = [{ type: 'hit', ms: 1000, d: { note: 5 } }, { type: 'miss', ms: 2000, d: { note: 6, reason: 'no-input' } }, { type: 'standby', ms: 2500, d: {} }];
  const r = [{ type: 'hit', ms: 1010, d: { note: 5 } }, { type: 'hit', ms: 2003, d: { note: 6 } }, { type: 'standby', ms: 2600, d: {} }];
  const c = R.compareJudges(o, r, 40);
  check('再生: 判定の出来事を、種類・ノーツ・時刻の差で1対1に結ぶ', c.matched === 1 && c.missingInReplay.length === 2 && c.extraInReplay.length === 2 && c.byType.hit.orig === 1 && c.byType.hit.replay === 2);
}

// ---- 静的: 演奏とデバッグ設定のつなぎ ----
{
  const play = read('monster-hero/src/parts/30-rhythm-play.jsx'), app = read('monster-hero/src/parts/60-app.jsx');
  check('演奏の始まりで記録を始め、終わりで閉じる', /RHYTHM_INPUT_REC\.begin\(playAreaRef\.current,/.test(play) && /RHYTHM_INPUT_REC\.finish\(\{cleared:!failed/.test(play));
  check('デバッグ設定に入/切と「最後の演奏の記録をコピー」がある', app.includes('data-rhythm-input-rec-panel') && app.includes('data-rhythm-input-rec-copy') && app.includes('最後の演奏の記録をコピー'));
  check('保存データの一覧に載っている', read('docs/spec/SAVE_DATA.md').includes('`mh_rhythm_input_rec_v1`'));
}

const seed = () => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_play_defaults_restored_v1', true); put('mh_rhythm_six_lane_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_rhythm_look_intro_seen_v1', true);
  localStorage.setItem('mh_rhythm_input_rec_v1', 'on');
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(failed ? 1 : 0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }));
    // 助手のおしゃべりの中継(Edge Function)も本物へ届けない。差し替えが無いと本物の中継が AI を呼ぶ(2026-10-27)
    await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.addInitScript(seed);
    const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((b) => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, p);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
    for (let i = 0; i < 6; i++) { if (!(await clickText('受け取る|閉じる|OK|あとで読む'))) break; await page.waitForTimeout(250); }
    await clickText('モンヒロビート');
    await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-start]', { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.querySelector('[data-rhythm-mode-solo]')?.click());
    await page.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 });
    for (let i = 0; i < 5; i++) { if (!(await clickText('^確認$|受け取る|閉じる|OK|あとで読む'))) break; await page.waitForTimeout(300); }
    const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());
    await page.evaluate(() => document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    await page.waitForFunction(() => RHYTHM_INPUT_REC.songMs() > 500, null, { timeout: 30000 }).catch(() => {});
    check('演奏が始まると記録している', await page.evaluate(() => RHYTHM_INPUT_REC.isRecording()));
    const geo = await page.evaluate(() => { const a = document.querySelector('[data-rhythm-play-area]').getBoundingClientRect(); const l = document.querySelector('[data-rhythm-judgment-line]'); const r = l ? l.getBoundingClientRect() : null; return { l: a.left, w: a.width, y: r ? r.top + r.height / 2 : a.top + a.height * .8 }; });
    const cdp = await page.context().newCDPSession(page);
    for (let i = 0; i < 4; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: geo.l + geo.w * (.3 + i * .1), y: geo.y, id: i + 1, radiusX: 8, radiusY: 8 }] });
      await page.waitForTimeout(60);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(120);
    }
    const rec = await page.evaluate(() => { RHYTHM_INPUT_REC.close(); return { s: RHYTHM_INPUT_REC.summary(), last: RHYTHM_INPUT_REC.last() }; });
    const starts = rec.last ? rec.last.events.filter((e) => e.k === 'touchstart') : [];
    check('叩いた4回が touchstart として残る', starts.length === 4, JSON.stringify(rec.s));
    check('曲の時刻が進んでいる', starts.length === 4 && starts.every((e) => Number.isFinite(e.ms)) && starts[3].ms > starts[0].ms);
    check('曲・難易度が入っている', !!(rec.last && rec.last.songId && rec.last.difficultyId));
    const keysAfter = await page.evaluate(() => Object.keys(localStorage).sort());
    check('記録そのものを端末に保存しない(mh_rhythm_input_rec 系のキーは入/切だけ)', keysAfter.filter((k) => /input_rec/.test(k)).join() === 'mh_rhythm_input_rec_v1' && keysBefore.filter((k) => /input_rec/.test(k)).join() === 'mh_rhythm_input_rec_v1');
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('演奏画面での確認', false, String(e).slice(0, 200));
  } finally {
    await browser.close(); server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
