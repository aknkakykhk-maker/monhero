// モンヒロビートのマルチの「観戦」を、実際に部屋を作って確かめる(2026-11-11)。
//
//   node tools/mode/rhythm-multi-spectate-check.js
//   MH_SHOT_DIR=<フォルダ> node tools/mode/rhythm-multi-spectate-check.js    # 止め絵も撮る(縦・横)
//
// 社長「モンビーマルチも観戦できるように」「誘われて演奏中のときは待機になるけどその間見れたり」「ステータスの変化も見えるように」。見張ること:
//   ・外から見る人(部屋のメンバーではない)に、曲・全員の順位とスコアとコンボ・選んだ人の判定の数とライフが出る
//   ・観戦の人は部屋のメンバーに数えない(hb を送らない・5人の枠に入らない)
//   ・後から入った待機中のメンバーにも、演奏が見える
//   ・見られているのは1人だけ。その人だけが1秒ごとに送り、ほかの人は今までの3秒ごとのまま。見ている人がいなければ今までと同じ
//   ・1部屋10人まで。観戦を許さない設定にすると、外の人には見せない
//   ・演奏している端末の、観戦あり/なしのフレームの間隔(重くなっていないかの目安)
//   MH_MEASURE=1 は札の測定と同じ測り方(CPU 1/4・9秒×観戦なし/あり3回ずつ(曲の長さに収まる回数))の表を出す。2分かかって曲が終わるので、そのあとの確認(待機のメンバー・10人・終わり)は出ない。測定のときだけ使う
// ★外へはつながない(rhythm-multi-live-board-check.js と同じ偽の WebSocket + BroadcastChannel)。
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (_) {
  try { playwright = require('playwright'); } catch (e) { console.log('SKIP: playwright が無いので測れません'); process.exit(0); }
}
let sharp = null;
try { sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp')); } catch (_) { /* 無ければ道との重なりは測らない */ }

const SHOT_DIR = process.env.MH_SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, () => resolve(server));
});

// ページの中の偽の WebSocket。送った知らせの種類ごとの数も数える(window.__sent)
const FAKE_WS = () => {
  window.__sent = {};
  class FakeWS {
    constructor() { this.readyState = 0; this.topic = null; this.ch = null; setTimeout(() => { this.readyState = 1; if (this.onopen) this.onopen({}); }, 0); }
    deliver(obj) { const data = JSON.stringify(obj); setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0); }
    send(data) {
      const m = JSON.parse(data);
      if (m.event === 'phx_join') {
        this.topic = m.topic; if (/room/.test(m.topic)) window.__topic = m.topic;
        this.ch = new BroadcastChannel(`fake-ws:${m.topic}`);
        this.ch.onmessage = (e) => this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload: e.data } });
        this.deliver({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok', response: {} } });
        return;
      }
      if (m.event !== 'broadcast') return;
      const payload = m.payload && m.payload.payload;
      if (payload && payload.t) window.__sent[payload.t] = (window.__sent[payload.t] || 0) + 1;
      if (this.ch) this.ch.postMessage(payload);
      this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload } });
    }
    close() { this.readyState = 3; if (this.ch) this.ch.close(); if (this.onclose) this.onclose({}); }
  }
  window.WebSocket = FakeWS;
};


const PLAYERS = Math.max(2, Math.min(5, Number(process.env.MH_PLAYERS) || 2));   // 演奏する人の数(重さの測定は5人で)
const PORTRAIT = process.env.MH_PORTRAIT === '1';        // 縦画面で測る
const VIEW = PORTRAIT ? { width: 390, height: 844 } : { width: 844, height: 390 };
(async () => {
  const server = await serve();
  const PORT = server.address().port;
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: VIEW, isMobile: true, hasTouch: true, deviceScaleFactor: SHOT_DIR ? 2 : 1 });
  await context.addInitScript(FAKE_WS);
  const errors = [];
  const open = async (name, icon) => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await page.addInitScript(([nm, ic, ws]) => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', nm); put('mh_breeder_icon', ic); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'momosuke'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      // MH_WATCH_SETTINGS … 撮るときだけ音ゲー設定に重ねる JSON(例 '{"lightweightMode":true}'。r1115-161 の確かめ)
      if (ws) localStorage.setItem('mh_rhythm_settings_v1', ws);
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_hell_story_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
    }, [name, icon, process.env.MH_WATCH_SETTINGS || '']);
    await page.addInitScript(require('../boot/quiet-boot-seed').eventStorySeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body && document.body.innerText.includes('TAP TO START'), null, { timeout: 60000 });
    await page.getByText('TAP TO START').click();
    await page.waitForTimeout(2500);
    await page.mouse.click(VIEW.width / 2, VIEW.height / 2);
    await page.waitForTimeout(3000);
    // お知らせ・ギフトなどの吹き出しは閉じ続ける
    await page.evaluate(() => { setInterval(() => { const d = document.querySelector('[role=dialog]'); if (!d) return; const b = d.querySelector('button[aria-label="次へ"],button[aria-label="閉じる"]') || [...d.querySelectorAll('button')].find((x) => /受け取|閉じる|とじる|OK|(?:始|はじ)める|(?:分|わ)かった|^次へ|あとで|見た/.test(x.innerText)); if (b) b.click(); }, 250); });
    await page.waitForFunction(() => document.querySelector('button[data-home-fac="rhythm"]') && !document.querySelector('[role=dialog]'), null, { timeout: 40000 });
    await page.locator('button[data-home-fac="rhythm"]').click();
    await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
    await page.waitForTimeout(800);
    return page;
  };
  // 演奏画面の「読むだけの窓」へ、決まった値を返す入れ物を差し込む(だれも押さないので、本物は0へ戻るため)
  const setHud = (p, score, combo, k, life, timeMs) => p.evaluate(([sc, cb, kk, lf, t]) => {
    const counts = {}; ['MARVELOUS', 'EXCELLENT', 'GREAT', 'GOOD', 'BAD', 'MISS'].forEach((id, i) => { counts[id] = kk[i]; });
    const fixed = { score: sc, combo: cb, counts, life: lf }; RHYTHM_PLAY_WATCH.hud = { get: () => fixed }; RHYTHM_PLAY_WATCH.timeMs = t;
  }, [score, combo, k, life, timeMs]);
  const sent = (p, t) => p.evaluate((type) => window.__sent[type] || 0, t);
  // フレームの間隔(演奏している端末の重さの目安)。ms 間 requestAnimationFrame の間隔を集める
  const frames = (p, ms) => p.evaluate((dur) => new Promise((resolve) => {
    const gaps = []; let last = performance.now(); const end = last + dur;
    const step = (t) => { gaps.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else { gaps.sort((a, b) => a - b); const sum = gaps.reduce((x, y) => x + y, 0); resolve({ n: gaps.length, mean: sum / gaps.length, p95: gaps[Math.floor(gaps.length * 0.95)], max: gaps[gaps.length - 1], over: gaps.filter((g) => g > 33.3).length }); } };
    requestAnimationFrame(step);
  }), ms);
  try {
    const A = await open('あかね', 'Mocchi'); const B = await open('いぶき', 'Suezo');
    const extra = [];
    for (let i = 2; i < PLAYERS; i += 1) extra.push(await open(['おと', 'かな', 'きら'][i - 2], ['Hare', 'Tiger', 'Pixie'][i - 2]));
    const W = await open('うみ', 'Pixie'); const L = await open('えま', 'Tiger');
    const pages = [A, B, ...extra];
    // フリーマッチの部屋(演奏中の部屋が観戦の一覧に出るのは、フリーの部屋だけ)
    for (const p of pages) await p.locator('[data-rhythm-multi-free]').click();
    await A.locator('[data-rhythm-multi-free-create]').click();
    await A.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 15000 });
    const code = (await A.locator('[data-rhythm-multi-room-code]').innerText()).trim();
    await B.locator('[data-rhythm-multi-free-list-open]').click();
    await B.getByRole('button', { name: '入る', exact: true }).first().click({ timeout: 20000 });
    for (const p of extra) { await p.locator('[data-rhythm-multi-free-list-open]').click(); await p.getByRole('button', { name: '入る', exact: true }).first().click({ timeout: 20000 }); }
    // ---- 2026-11-15 r1115-161①: 曲えらび中の部屋も、入らずに観戦だけできる(観戦は見るだけ。遊ぶときは別に「この部屋に入る」) ----
    {
      const X = await open('くう', 'Hare');
      await X.locator('[data-rhythm-multi-free]').click();
      await X.locator('[data-rhythm-multi-free-list-open]').click();
      const listed = await X.waitForSelector(`[data-rhythm-multi-room-watch="${code}"]`, { timeout: 30000 }).then(() => true, () => false);
      check('「部屋に入る」の一覧(曲えらび中・待っている部屋)に、「入る」と別に「観戦」がある', listed);
      if (listed) {
        await X.locator(`[data-rhythm-multi-room-watch="${code}"]`).click();
        const waitingShown = await X.waitForSelector('[data-rhythm-watch][data-rhythm-watch-phase="waiting"]', { timeout: 20000 }).then(() => true, () => false);
        check('演奏していない部屋を観戦すると、「次の曲が始まるのを待っています」の画面になる', waitingShown, await X.evaluate(() => (RHYTHM_WATCH.view() || {}).phase));
        check('観戦の画面に、別に「この部屋に入る」がある', (await X.locator('[data-rhythm-watch-join]').count()) === 1);
        check('観戦の人は部屋のメンバーに入らない(hb を送らない・次の曲にも入らない)', (await sent(X, 'hb')) === 0 && (await A.evaluate(() => RHYTHM_MULTI.view().members.length)) === PLAYERS && (await X.evaluate(() => !RHYTHM_MULTI.view())));
        if (SHOT_DIR) await X.screenshot({ path: path.join(SHOT_DIR, 'watch-select-waiting.png') });
        await X.locator('[data-rhythm-watch-close]').click();
      }
      await X.close();
    }
    for (let i = 0; i < 40; i += 1) {
      if ((await A.locator('[data-rhythm-multi-ready]').count()) && (await B.locator('[data-rhythm-multi-ready]').count())) break;
      for (const p of pages) { if (await p.locator('[data-rhythm-multi-omakase]').count()) await p.locator('[data-rhythm-multi-omakase]').click().catch(() => {}); }
      if (await A.locator('[data-rhythm-demo-start]').count()) await A.locator('[data-rhythm-demo-start]').click().catch(() => {});
      await A.waitForTimeout(1500);
    }
    if (process.env.MH_DEBUG) { for (const p of pages) { const st = await p.evaluate(() => { const v = RHYTHM_MULTI.view(); const b = document.querySelector('[data-rhythm-multi-ready]'); return { n: v && v.members.length, ph: v && v.room.phase, dis: b && b.disabled, txt: b && b.innerText }; }); console.log('  (準備前)', JSON.stringify(st)); } }
    for (const p of pages) { await p.bringToFront(); await p.waitForTimeout(600); await p.locator('[data-rhythm-multi-ready]').click({ timeout: 4000 }).catch(() => {}); }   // 全員の準備が早く済むと自動で始まるので、押せなくなった人は押さない
    for (const p of pages) await p.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    for (const p of pages) await p.waitForFunction(() => typeof RHYTHM_PLAY_WATCH !== 'undefined' && !!RHYTHM_PLAY_WATCH.hud, null, { timeout: 15000 });
    const idA = await A.evaluate(() => RHYTHM_MULTI.view().selfId); const idB = await B.evaluate(() => RHYTHM_MULTI.view().selfId);
    await setHud(A, 412880, 128, [90, 20, 8, 2, 0, 1], 880, 61000); await setHud(B, 371450, 96, [70, 22, 10, 3, 1, 2], 760, 60500);
    for (let i = 0; i < extra.length; i += 1) await setHud(extra[i], 300000 - i * 40000, 60 - i * 10, [50, 20, 12, 4, 2, 3], 700, 60000);
    // ---- 観戦なしの間のフレームの間隔と送る量 ----
    const pgBefore = await sent(A, 'pg');
    await A.bringToFront();
    await A.waitForTimeout(800);
    const base = await frames(A, 8000);
    const pgNoWatch = (await sent(A, 'pg')) - pgBefore;
    check('観戦の人がいないあいだ、あかね は今までどおり(3秒ごと・値が変わらなければ送らない。6秒で3通以下)', pgNoWatch <= 3, `${pgNoWatch}通`);
    check('観戦の人がいないあいだ、見られる印は立たない', (await A.evaluate(() => RHYTHM_MULTI.watcherCount())) === 0);
    check('観戦の人がいないあいだ、判定をためない(演奏のループは何もしない)', (await A.evaluate(() => RHYTHM_PLAY_WATCH.jd)) === null);

    // ---- 外から見る(うみ。部屋のメンバーではない) ----
    // フリーマッチの窓を開くと、演奏中の部屋が「観戦」の一覧に出る(演奏の人が4秒後から10秒ごとに知らせる)
    await W.locator('[data-rhythm-multi-free]').click();
    await W.waitForSelector(`[data-rhythm-watch-room="${code}"]`, { timeout: 30000 });
    check('フリーの部屋は、演奏中になると観戦の一覧に出る', true);
    // r1115-190③: 観戦の画面が鳴らす曲を見張るため、曲を鳴らす入口に控えを差し込む(本物はそのまま呼ぶ)
    await W.evaluate(() => { const orig = Audio_.startRhythmTrack; window.__wa = []; Audio_.startRhythmTrack = async (k, v, o) => { const h = await orig(k, v, o); window.__wa.push({ k, at: o && o.atMs, h }); return h; }; });
    await W.locator(`[data-rhythm-watch-open="${code}"]`).click();
    await W.waitForSelector('[data-rhythm-watch][data-rhythm-watch-phase="playing"]', { timeout: 20000 });
    await W.waitForFunction((n) => document.querySelectorAll('[data-rhythm-watch-row]').length === n, PLAYERS, { timeout: 10000 });
    check('外から見ると、観戦の画面に2人ぶんの行が出る', true);
    await W.evaluate((id) => RHYTHM_WATCH.focus(id), idA);
    await W.waitForTimeout(1500);
    // ---- r1115-190③: 観戦している曲を、画面と同じ位置(見ている人の位置 − 1.5秒)で流す。待機の曲は止め、やめたら戻す ----
    {
      // 演奏の位置を時計どおりに進める(本物の演奏と同じく1秒ごとに進む)
      await A.evaluate(() => { const t0 = Date.now(); Object.defineProperty(RHYTHM_PLAY_WATCH, 'timeMs', { get: () => 61000 + (Date.now() - t0), configurable: true }); });
      const audioOk = await W.waitForFunction(() => RHYTHM_WATCH_AUDIO.on() && window.__wa.some((x) => x.h && x.h.started()), null, { timeout: 20000 }).then(() => true, () => false);
      // 読み込みにかかった分のずれは、次の確かめ(0.25秒ごと)で合わせ直す。合うまで少し待つ
      await W.waitForFunction(() => { const last = window.__wa[window.__wa.length - 1]; const t = rhythmWatchAudioTarget(); return last && last.h && t && Math.abs(last.h.songTimeMs() - t.ms) <= 600; }, null, { timeout: 4000 }).catch(() => {});
      const au = await W.evaluate(() => {
        const v = RHYTHM_WATCH.view(); const song = RHYTHM_SONGS.find((x) => x.songId === v.songId); const last = window.__wa[window.__wa.length - 1];
        const t = rhythmWatchAudioTarget();
        return { on: RHYTHM_WATCH_AUDIO.on(), key: last && last.k, want: song && song.bgmTrackId, at: last && last.at, t: t && Math.round(t.ms), now: last && last.h ? Math.round(last.h.songTimeMs()) : null };
      });
      check('観戦をモードえらびの画面から開いても、観戦している曲が鳴る(待機の画面の曲のままにならない)', audioOk && au.key === au.want, JSON.stringify(au));
      check('観戦の曲は、曲の頭ではなく画面と同じ位置(見ている人の位置 − 1.5秒)から鳴る', au.at > 1000 && au.now != null && Math.abs(au.now - au.t) <= 600, JSON.stringify(au));
      await W.waitForTimeout(2500);
      const drift = await W.evaluate(() => { const last = window.__wa[window.__wa.length - 1]; const t = rhythmWatchAudioTarget(); return Math.round(last.h.songTimeMs() - t.ms); });
      check('鳴らしているあいだも、画面の位置とのずれは0.6秒以内に保つ', Math.abs(drift) <= 600, `${drift}ms`);
      check('観戦の曲が鳴っているあいだ、本体は試聴・待機の曲を止める', await W.evaluate(() => window.__wa.filter((x) => x.h && x.h.started()).length === 1));
      check('演奏している人の端末は、曲を鳴らす仕組みを使わない(観戦の曲は観戦の人の端末だけ)', await A.evaluate(() => typeof RHYTHM_WATCH_AUDIO !== 'undefined' && !RHYTHM_WATCH_AUDIO.on()));
      await A.evaluate(() => { const t = RHYTHM_PLAY_WATCH.timeMs; Object.defineProperty(RHYTHM_PLAY_WATCH, 'timeMs', { value: t, writable: true, configurable: true }); });
    }
    // ---- r1115-189: 観戦の人もチャットに参加できる(新しい種類 wc。部屋の人の数・結果には入らない) ----
    {
      const r1 = await W.evaluate(() => RHYTHM_WATCH.say('がんばれ!'));
      const r2 = await W.evaluate(() => RHYTHM_WATCH.say('ナイス!'));
      check('観戦の人がひとことを送れる・続けて送ると「少し待って」(3秒に1回)', r1 === 'ok' && r2 === 'wait', `${r1}/${r2}`);
      check('観戦の人のひとことは新しい種類(wc)で送る(部屋のチャット chat・hb は送らない)', (await sent(W, 'wc')) >= 1 && (await sent(W, 'chat')) === 0 && (await sent(W, 'hb')) === 0);
      check('古い版の読み方(知らない種類は捨てる)では、wc は何も起こさない', await A.evaluate(() => rhythmMultiCleanMessage({ t: 'wc', id: 'w1', name: 'x', text: 'y', cid: 'c1' }) === null));
      await W.waitForSelector('[data-rhythm-watch-chat-line="watch"]', { timeout: 3000 })
        .then(() => check('観戦の画面のチャットの欄に、自分のひとことが 👁 つき・琥珀色で出る', true), () => check('観戦の画面のチャットの欄に、自分のひとことが 👁 つき・琥珀色で出る', false));
      await A.waitForTimeout(600);
      check('演奏中の人のチャットへは、演奏のあいだ足さない(控えに入れるだけ・画面を更新しない)', await A.evaluate(() => !RHYTHM_MULTI.view().chat.some((c) => c.w)));
      const capped = await W.evaluate(() => { const st = RHYTHM_WATCH.view(); st.lastSayAt = 0; st.sayRound = st.round || ''; st.sayCount = RHYTHM_WATCH_CHAT_ROUND_MAX; return RHYTHM_WATCH.say('すごい!'); });
      check('観戦の人が送れるのは1曲に20回まで', capped === 'max', capped);
      await W.evaluate(() => { const st = RHYTHM_WATCH.view(); st.sayCount = 1; });
      await B.evaluate(() => RHYTHM_MULTI.sendChat('ありがとう!'));
      await W.waitForFunction(() => [...document.querySelectorAll('[data-rhythm-watch-chat-line="room"]')].some((x) => /ありがとう/.test(x.innerText)), null, { timeout: 4000 })
        .then(() => check('部屋の人のチャットも、観戦の画面の欄に出る(色は部屋の人の色)', true), () => check('部屋の人のチャットも、観戦の画面の欄に出る', false));
      const stamped = await W.evaluate(() => { const st = RHYTHM_WATCH.view(); st.lastSayAt = 0; const slot = MULTI_STAMP.get().slots.find(Boolean); return slot ? RHYTHM_WATCH.say(multiStampSlotLabel(slot), { f: slot.f, w: slot.w }) : 'none'; });
      check('観戦の人もスタンプを送れる', stamped === 'ok', stamped);
      // 部屋の人の id を名乗った観戦のひとことは出さない
      await W.evaluate((id) => { const ch = new BroadcastChannel(`fake-ws:${window.__topic}`); ch.postMessage({ t: 'wc', id, name: 'にせもの', text: 'なりすまし', cid: 'wfake1' }); setTimeout(() => ch.close(), 500); }, idA);
      check('観戦の人は部屋のメンバーに入らない(ひとことを送っても)', (await A.evaluate(() => RHYTHM_MULTI.view().members.length)) === PLAYERS);
      await W.waitForTimeout(800);
      check('観戦の人の欄にも、部屋の人を名乗ったひとことは出さない', await W.evaluate(() => !/なりすまし/.test((document.querySelector('[data-rhythm-watch-chat-list]') || {}).innerText || '')));
      if (SHOT_DIR) {
      for (const [nm, w, h] of [['yoko', 844, 390], ['tate', 390, 844], ['tate320', 320, 568]]) {
        await W.setViewportSize({ width: w, height: h }); await W.waitForTimeout(700);
        await W.screenshot({ path: path.join(SHOT_DIR, `chat-watcher-${nm}.png`) });
      }
      await W.setViewportSize({ width: 390, height: 844 }); await W.waitForTimeout(300);
      await W.locator('[data-rhythm-watch-orientation] button').first().click().catch(() => {});
      await W.waitForTimeout(1200);
      await W.screenshot({ path: path.join(SHOT_DIR, 'chat-watcher-rotated.png') });
      // もう一度押して縦へ戻す(遊ぶ人と同じ操作)
      await W.locator('[data-rhythm-watch-orientation] button').first().click().catch(() => {});
      await W.waitForTimeout(800);
      check('観戦の画面の縦横ボタンで横にでき、もう一度押すと縦へ戻る(r1115-190②)', await W.evaluate(() => !RHYTHM_VIEW_ROTATION.active()));
      await W.locator('[data-rhythm-watch-chat-stamp-toggle]').click(); await W.waitForTimeout(500);
      await W.screenshot({ path: path.join(SHOT_DIR, 'chat-watcher-stamps-tate.png') });
      await W.locator('[data-rhythm-watch-chat-stamp-toggle]').click();
      await W.setViewportSize({ width: 844, height: 390 }); await W.waitForTimeout(300);
      }
    }
    // 見られている1人(最初は先頭)の判定の数・ライフ
    await W.waitForFunction(() => { const c = document.querySelector('[data-rhythm-watch-count="MARVELOUS"] b'); return c && c.textContent !== '-'; }, null, { timeout: 15000 });
    const detail = await W.evaluate(() => ({
      rows: [...document.querySelectorAll('[data-rhythm-watch-row]')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
      counts: [...document.querySelectorAll('[data-rhythm-watch-count]')].map((c) => c.querySelector('b').textContent),
      life: (document.querySelector('[data-rhythm-watch-life]') || document.querySelector('[data-rhythm-life-bar]')).style.width,
      progress: document.querySelector('[data-rhythm-watch-progress]').style.width,
      focus: RHYTHM_WATCH.view().focus,
    }));
    const wantFocus = detail.focus;
    const focusIsA = wantFocus === idA;
    const wantK = focusIsA ? [90, 20, 8, 2, 0, 1] : [70, 22, 10, 3, 1, 2];
    if (PLAYERS === 2) check('順位はスコアの高い順(あかね 412,880 が1位)', /1.*あかね.*412,880.*128/.test(detail.rows[0] || '') && /2.*いぶき.*371,450.*96/.test(detail.rows[1] || ''), JSON.stringify(detail.rows));
    check('選んだ人の判定の数が出る(MARVELOUS〜MISS)', JSON.stringify(detail.counts.map(Number)) === JSON.stringify(wantK), JSON.stringify(detail.counts));
    check('ライフのゲージが出る', /%/.test(detail.life) && parseFloat(detail.life) > 0, detail.life);
    // メンバーに数えない・hb を送らない
    check('観戦の人は部屋のメンバーに入らない(あかね の部屋は演奏の人数のまま)', (await A.evaluate(() => RHYTHM_MULTI.view().members.length)) === PLAYERS);
    check('観戦の人は hb を送らない', (await sent(W, 'hb')) === 0 && (await sent(W, 'wt')) >= 1);
    // 見られている人だけが1秒ごとに送る
    const focusPage = focusIsA ? A : B; const otherPage = focusIsA ? B : A;
    const f0 = await sent(focusPage, 'pg'); const o0 = await sent(otherPage, 'pg');
    await focusPage.bringToFront();
    await focusPage.waitForTimeout(800);
    const withWatch = await frames(focusPage, 8000);
    const df = (await sent(focusPage, 'pg')) - f0; const dd = (await sent(otherPage, 'pg')) - o0;
    check('見られている人は1秒ごとに送る(6秒で5通以上)', df >= 5, `${df}通`);
    check('ほかの人は今までの3秒ごとのまま(6秒で3通以下)', dd <= 3, `${dd}通`);
    // 判定が増えたら、下の判定の数が増える(プレイ画面に無い「+n」の流れる文字は出さない)
    await setHud(focusPage, 420000, 130, wantK.map((n, i) => n + (i === 0 ? 4 : 0)), 900, 63000);
    await W.waitForFunction((n) => Number(document.querySelector('[data-rhythm-watch-count="MARVELOUS"] b').textContent) === n, wantK[0] + 4, { timeout: 5000 })
      .then(() => check('判定が増えると、判定の数が増える', true), () => check('判定が増えると、判定の数が増える', false));
    check('プレイ画面に無い「+n 判定」の流れる文字は出さない', !(await W.evaluate(() => /\+\d+\s*(MARVELOUS|EXCELLENT|GREAT|GOOD|BAD|MISS)/.test(document.querySelector('[data-rhythm-watch-detail]').innerText))));
    // 別の人を選ぶと、その人の判定に切り替わる
    const otherId = focusIsA ? idB : idA;
    await W.locator(`[data-rhythm-watch-row="${otherId}"]`).click();
    await W.waitForFunction((k) => { const c = [...document.querySelectorAll('[data-rhythm-watch-count] b')].map((x) => Number(x.textContent)); return JSON.stringify(c) === JSON.stringify(k); }, focusIsA ? [70, 22, 10, 3, 1, 2] : [90, 20, 8, 2, 0, 1], { timeout: 8000 })
      .then(() => check('別の人の名前を押すと、その人の判定に切り替わる', true), () => check('別の人の名前を押すと、その人の判定に切り替わる', false));
    check('切り替えたら、前の人は1秒ごとをやめる', await (async () => { await W.waitForTimeout(4500); const x0 = await sent(focusPage, 'pg'); await W.waitForTimeout(3500); return (await sent(focusPage, 'pg')) - x0 <= 2; })());
    // ---- 譜面(判定の束 j): 見られている人だけ、判定をためて、1秒ごとにまとめて送る ----
    await W.evaluate((id) => RHYTHM_WATCH.focus(id), idA);
    await W.waitForTimeout(2500);
    check('見られている人(あかね)だけ判定をためる(いぶき は何もしない)', (await A.evaluate(() => Array.isArray(RHYTHM_PLAY_WATCH.jd))) && (await B.evaluate(() => RHYTHM_PLAY_WATCH.jd)) === null);
    const playPos = await A.evaluate(() => RHYTHM_PLAY_WATCH.timeMs);
    console.log(`  (演奏の位置 ${playPos}ms)`);
    const chartInfo = await W.evaluate((pos) => { const v = RHYTHM_WATCH.view(); const song = RHYTHM_SONGS.find((x) => x.songId === v.songId); const who = v.people.find((x) => x.id === v.focus); const ch = song && song.difficulties[who.diff]; if (!ch) return null; const idx = []; ch.notes.forEach((n, i) => { if (n.timeMs > pos + 3000 && n.timeMs < pos + 6500) idx.push(i); }); return { n: ch.notes.length, idx, dur: ch.durationMs }; }, playPos);
    console.log(`  (譜面 ${chartInfo && chartInfo.n}音・${chartInfo && chartInfo.dur}ms)`);
    check('観戦の画面が、その曲・その難易度の譜面を持っている', !!chartInfo && chartInfo.n > 0 && chartInfo.idx.length >= 2, JSON.stringify(chartInfo && { n: chartInfo.n, near: chartInfo.idx.length }));
    check('譜面の絵(canvas)が出る', (await W.locator('[data-rhythm-watch-lane]').count()) === 1);
    // ---- 観戦の道を、プレイ画面と同じ部品で描く(2026-11-15 r1115-021) ----
    check('観戦の道は、プレイ画面と同じ枠(data-rhythm-play-area)・同じ判定ライン・同じノーツの canvas で描く', (await W.locator('[data-rhythm-watch-lane-road][data-rhythm-play-area] [data-rhythm-judgment-line]').count()) === 1 && (await W.locator('[data-rhythm-watch-lane-road] [data-rhythm-note-canvas]').count()) === 1);
    check('ノーツの色の組・形は、プレイ画面を開くときと同じく、設定どおりに当てている', await W.evaluate(() => { const st = rhythmWatchSettings(); return RHYTHM_NOTE_PALETTE_ID === (RHYTHM_NOTE_PALETTES[st.notePalette] ? st.notePalette : 'STANDARD') && RHYTHM_NOTE_SHAPE_ID === (RHYTHM_NOTE_SHAPE_IDS.includes(st.noteShape) ? st.noteShape : 'STANDARD'); }));
    check('道・判定の帯・コンボ・判定の文字・ライフは、プレイ画面と同じ部品(同じ CSS の属性)で出る', await W.evaluate(() => { const h = document.querySelector('[data-rhythm-watch-lane-road]'); return !!h && !!h.querySelector('[data-rhythm-lane]') && !!h.querySelector('[data-rhythm-judgment-band]') && !!h.querySelector('[data-rhythm-judgment-text]') && !!h.querySelector('[data-rhythm-life]') && !!h.querySelector('[data-rhythm-combo-box]'); }));
    await W.waitForTimeout(600);
    const roadPix = await W.evaluate(() => {
      const host = document.querySelector('[data-rhythm-watch-lane-road]'); if (!host) return null;
      const cv = host.querySelector('[data-rhythm-note-canvas]'); const c2 = cv.getContext('2d'); if (!c2) return { webgl: true };
      const d = c2.getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n++;
      return { n, w: cv.width, h: cv.height };
    });
    check('ノーツの canvas に、ノーツが描かれている', !!roadPix && (roadPix.webgl || roadPix.n > 20), JSON.stringify(roadPix));
    // 同じ時刻・同じ譜面で、プレイ画面と同じ式で出したノーツの位置に、観戦の画面もノーツを描いている
    const sameAtOnce = () => W.evaluate(() => {
      const v = RHYTHM_WATCH.view(); const row = v.rows[v.focus]; const song = RHYTHM_SONGS.find((x) => x.songId === v.songId);
      const who = v.people.find((x) => x.id === v.focus); const chart = song.difficulties[who.diff];
      const host = document.querySelector('[data-rhythm-watch-lane-road]'); const cv = host.querySelector('[data-rhythm-note-canvas]'); const c2 = cv.getContext('2d'); if (!c2) return { skip: 'webgl' };
      const st = rhythmWatchSettings(); const travelMs = rhythmTravelMsForSpeed(st.noteSpeed); const w = host.clientWidth; const h = host.clientHeight;
      const vis = row.p + Math.min(Date.now() - row.pAt, 3000) - RHYTHM_WATCH_LANE_DELAY_MS;
      const keep = { points: RHYTHM_SCROLL.points, back: RHYTHM_SCROLL.back, sufMin: RHYTHM_SCROLL.sufMin, groups: RHYTHM_SCROLL.groups, lerp: RHYTHM_SCROLL.lerp };
      const hits = []; let tried = 0;
      for (const n of chart.notes) {
        if (n.type !== 'TAP' || n.timeMs < vis + travelMs * 0.25 || n.timeMs > vis + travelMs * 0.7) continue;
        const judged = v.judged[v.focus]; if (judged && judged.has(chart.notes.indexOf(n)) && judged.get(chart.notes.indexOf(n)) < 5 && n.timeMs <= vis) continue;
        const progress = 1 - (rhythmScrollPos(n.timeMs, n.scrollGroup) - rhythmScrollPos(vis, n.scrollGroup)) / travelMs;
        const jy = RHYTHM_JUDGMENT_LINE_Y.ratio * h - 10; const sy = -20 + ((Number(st.noteStartPosition) || 0) / 100) * h * 0.2;
        const y = Math.round(sy + rhythmProjectTravelProgress(progress) * (jy - sy));
        const g = rhythmNoteCanvasGeometry(n, y, n.lane, { left: 0, top: 0, width: w, height: h }, 20, null, null, 0);
        const dpr = cv.width / w; const px = c2.getImageData(Math.round(g.head.cx * dpr), Math.round(g.head.cy * dpr), 1, 1).data[3];
        tried++; hits.push(px > 0); if (tried >= 4) break;
      }
      return { tried, hits };
    });
    let sameAt = null;
    for (let k = 0; k < 10; k++) { sameAt = await sameAtOnce(); if (sameAt && (sameAt.skip || sameAt.tried >= 1)) break; await W.waitForTimeout(400); }
    check('同じ時刻・同じ譜面で、プレイ画面と同じ式のノーツの位置に、観戦もノーツを描いている', !!sameAt && (sameAt.skip || (sameAt.tried >= 1 && sameAt.hits.filter(Boolean).length >= Math.ceil(sameAt.tried / 2))), JSON.stringify(sameAt));
    // 位置の知らせ(pg)が途切れたとき: 3秒までは時計で進み、そのあとは止めて「通信を待っています」を出す
    const holdA = await W.evaluate(() => { const v = RHYTHM_WATCH.view(); const r = v.rows[v.focus]; const base = { p: r.p, pAt: r.pAt }; return { a: rhythmWatchPosition({ p: 1000, pAt: Date.now() - 2000 }), b: rhythmWatchPosition({ p: 1000, pAt: Date.now() - 5000 }), base }; });
    check('pg が2秒途切れても時計で進む(待ちの表示は出ない)', holdA.a.waiting === false && holdA.a.p >= 2900 && holdA.a.p <= 3300, JSON.stringify(holdA.a));
    check('pg が3秒を過ぎたら止めて、「通信を待っています」を出す側になる', holdA.b.waiting === true && holdA.b.p <= 4100, JSON.stringify(holdA.b));
    await W.evaluate(() => { const v = RHYTHM_WATCH.view(); v.rows[v.focus].pAt -= 4000; });
    await W.waitForSelector('[data-rhythm-watch-waiting]', { timeout: 3000 })
      .then(() => check('途切れたままだと「通信を待っています」が出る', true), () => check('途切れたままだと「通信を待っています」が出る', false));
    await W.waitForFunction(() => !document.querySelector('[data-rhythm-watch-waiting]'), null, { timeout: 4000 })
      .then(() => check('次の知らせが届くと、「通信を待っています」が消える', true), () => check('次の知らせが届くと、「通信を待っています」が消える', false));
    // 2026-11-15 r1115-161: 軽くする・演出量「最小」・省電力でも、プレイ画面と同じく奥行きの道で描く(本番の iPhone で観戦だけ2Dになった)。2Dへ戻るのは描き手が作れないときだけ
    const flatPick = await W.evaluate(() => ({ off: rhythmWatchUseFlat(), src: String(rhythmWatchUseFlat) }));
    check('観戦の道は、設定(軽くする・最小・省電力)で2Dへ落ちない(描き手が作れないときだけ2D)', flatPick.off === false && !/lightweightMode|MINIMAL|frameRateMode/.test(flatPick.src), JSON.stringify(flatPick));
    if (chartInfo && chartInfo.idx.length) {
      // 演奏のループが判定のたびにやること(配列へ2つ push)を、ここで同じようにやる
      await A.evaluate((idx) => { idx.forEach((i, k) => { if (RHYTHM_PLAY_WATCH.jd !== null) RHYTHM_PLAY_WATCH.jd.push(i, k % 3); }); }, chartInfo.idx);
      await W.waitForFunction((idx) => { const m = RHYTHM_WATCH.view().judged[RHYTHM_WATCH.view().focus]; return m && idx.every((i) => m.has(i)); }, chartInfo.idx, { timeout: 6000 })
        .then(() => check('ためた判定が、1秒以内の束で観戦の人に届く(ノーツ番号と判定が合う)', true), () => check('ためた判定が、1秒以内の束で観戦の人に届く', false));
      const got = await W.evaluate(() => { const m = RHYTHM_WATCH.view().judged[RHYTHM_WATCH.view().focus]; return [...m.entries()].slice(0, 3); });
      const mine = await W.evaluate((idx) => { const m = RHYTHM_WATCH.view().judged[RHYTHM_WATCH.view().focus]; return idx.map((i) => m.get(i)); }, chartInfo.idx);
      check('届いた判定の中身が合う(ノーツ番号ごとの判定)', mine.every((c, k) => c === k % 3), JSON.stringify(mine));
      check('判定を送ったあと、たまりは小さいまま(1秒ごとに空になる)', (await A.evaluate(() => RHYTHM_PLAY_WATCH.jd.length)) < 40);
      // 判定の文字(ぴったりの虹色・FAST/SLOW)の印は、別の配列 jx で送る(判定の番号 j の並びは変えない。古い版は jx を読み飛ばすだけ)
      await A.evaluate((idx) => { if (RHYTHM_PLAY_WATCH.jx) RHYTHM_PLAY_WATCH.jx.push(idx[0], 3, idx[1], 4); }, chartInfo.idx);
      await W.waitForFunction((idx) => { const m = RHYTHM_WATCH.view().marks[RHYTHM_WATCH.view().focus]; return m && m.get(idx[0]) === 3 && m.get(idx[1]) === 4; }, chartInfo.idx, { timeout: 6000 })
        .then(() => check('判定の文字の印(ぴったり・SLOW・FAST)が、観戦の人に届く', true), () => check('判定の文字の印(ぴったり・SLOW・FAST)が、観戦の人に届く', false));
      check('印を送っても、判定の番号の並び(j)は今までどおり(印は別の配列)', await A.evaluate(() => Array.isArray(RHYTHM_PLAY_WATCH.jd) && Array.isArray(RHYTHM_PLAY_WATCH.jx)));
      check('印が来ない人(古い版)は、ふつうの金色のまま(落ちない)', await W.evaluate(() => { const m = RHYTHM_WATCH.view().marks['no-such-id']; return m === undefined; }));
    }
    if (SHOT_DIR) { await W.waitForTimeout(700); await W.screenshot({ path: path.join(SHOT_DIR, 'watch-lane-landscape.png') }); }
    // 並べる止め絵: 演奏している人の画面(プレイ画面)と観戦の画面を、同じ曲・同じ時刻に撮る(縦・横)
    if (SHOT_DIR) {
      for (const [nm, w, h] of [['yoko', 844, 390], ['tate', 390, 844], ['tate320', 320, 568]]) {
        await A.setViewportSize({ width: w, height: h }); await W.setViewportSize({ width: w, height: h }); await W.waitForTimeout(1200);
        await Promise.all([A.screenshot({ path: path.join(SHOT_DIR, `side-play-${nm}.png`) }), W.screenshot({ path: path.join(SHOT_DIR, `side-watch-${nm}.png`) })]);
      }
      await A.setViewportSize({ width: 844, height: 390 }); await W.setViewportSize({ width: 844, height: 390 });
    }
    // ---- 重い端末: フレームが40枚/秒を切る状態が2秒続くと、譜面は送らず数字だけにする ----
    await B.evaluate(() => { Object.defineProperty(RHYTHM_PLAY_WATCH, 'frames', { get: () => Math.floor(Date.now() / 100), set: () => {}, configurable: true }); /* 10枚/秒で進む(重い端末) */ });
    await W.evaluate((id) => RHYTHM_WATCH.focus(id), idB);
    await W.waitForSelector('[data-rhythm-watch-lite]', { timeout: 9000 })
      .then(() => check('重い端末の人を見ているときは「数字だけ」の案内が出て、譜面は出ない', true), () => check('重い端末の人を見ているときは「数字だけ」の案内が出る', false));
    await B.waitForFunction(() => RHYTHM_PLAY_WATCH.jd === null, null, { timeout: 4000 }).catch(() => {});
    check('重い端末は、判定をためるのをやめる', (await B.evaluate(() => RHYTHM_PLAY_WATCH.jd)) === null, String(await B.evaluate(() => JSON.stringify(RHYTHM_PLAY_WATCH.jd))));
    check('重くても、数字(順位・判定の数・ライフ)は届き続ける', (await W.evaluate(() => document.querySelector('[data-rhythm-watch-count="MARVELOUS"] b').textContent)) !== '-');
    await W.evaluate((id) => RHYTHM_WATCH.focus(id), idA);
    await W.waitForTimeout(1500);
    if (SHOT_DIR) {
      await W.screenshot({ path: path.join(SHOT_DIR, 'watch-landscape.png') });
      await W.setViewportSize({ width: 390, height: 844 }); await W.waitForTimeout(700);
      await W.screenshot({ path: path.join(SHOT_DIR, 'watch-portrait.png') });
      await W.setViewportSize({ width: 320, height: 568 }); await W.waitForTimeout(700);
      await W.screenshot({ path: path.join(SHOT_DIR, 'watch-portrait-320.png') });
      // 🔄 横(端末は縦のまま、絵を90度回して横に見せる)
      await W.setViewportSize({ width: 390, height: 844 }); await W.waitForTimeout(300);
      const rot = await W.evaluate(() => { try { return RHYTHM_VIEW_ROTATION.set(RHYTHM_VIEW_ROTATION.preferredAngle()); } catch (e) { return String(e); } });
      await W.waitForTimeout(900);
      await W.screenshot({ path: path.join(SHOT_DIR, 'watch-rotated.png') });
      await W.evaluate(() => RHYTHM_VIEW_ROTATION.set(0)); await W.waitForTimeout(400);
      await W.setViewportSize({ width: 844, height: 390 }); await W.waitForTimeout(500);
    }
    // 縦・横・小さい端末で、観戦の画面の中身が画面からはみ出さない
    for (const [w, h, label] of [[844, 390, '横'], [390, 844, '縦'], [375, 667, '小さい縦'], [667, 375, '小さい横'], [320, 568, 'いちばん小さい縦']]) {
      await W.setViewportSize({ width: w, height: h }); await W.waitForTimeout(500);
      // r1115-189 ミハリ: チャットの欄で場が低くなっても、ライフとコンボが重ならない
      const hudHit = await W.evaluate(() => { const a = document.querySelector('[data-rhythm-watch] [data-rhythm-hud]'); const b = document.querySelector('[data-rhythm-watch] [data-rhythm-combo]'); if (!a || !b) return null; const p = a.getBoundingClientRect(); const q = b.getBoundingClientRect(); if (!q.height) return null; return { hit: !(p.bottom <= q.top || q.bottom <= p.top || p.right <= q.left || q.right <= p.left), life: [Math.round(p.top), Math.round(p.bottom)], combo: [Math.round(q.top), Math.round(q.bottom)] }; });
      if (hudHit) check(`${label}(${w}×${h}): ライフとコンボが重ならない`, !hudHit.hit, JSON.stringify(hudHit));
      const fit = await W.evaluate(() => { const r = document.querySelector('[data-rhythm-watch]'); const q = r.getBoundingClientRect(); const badList = [...r.querySelectorAll('button')].filter((b) => { const e = b.getBoundingClientRect(); return e.right > innerWidth + 1 || e.left < -1 || e.bottom > innerHeight + 1; }); const bad = badList.length; const wideOnes = [...r.querySelectorAll('*')].filter((x) => x.getBoundingClientRect().right > q.right + 1).slice(0, 3).map((x) => `${x.tagName}.${String(x.className).slice(0, 40)}`); return { bad, sw: r.scrollWidth <= q.width + 1, ...(bad || wideOnes.length ? { who: badList.slice(0, 3).map((x) => x.innerText.slice(0, 12)), wide: wideOnes } : {}) }; });
      check(`${label}(${w}×${h}): ボタンが画面からはみ出さない・横に伸びない`, fit.bad === 0 && fit.sw, JSON.stringify(fit));
    }
    await W.setViewportSize({ width: 844, height: 390 });

    // ---- 札の測定(docs/progress/beat-multi-live-score/PLAN.md「本物で測った重さ」)と同じ測り方: 自分のページだけ CPU 1/4・15秒。
    //      観戦なし/ありを交互に4回ずつ。MH_MEASURE=1 のときだけ(2分かかる) ----
    if (process.env.MH_MEASURE) {
      const cdp = await context.newCDPSession(A);
      await cdp.send('Performance.enable');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const metric = async () => { const { metrics } = await cdp.send('Performance.getMetrics'); const o = {}; metrics.forEach((x) => { o[x.name] = x.value; }); return o; };
      const rows = { off: [], on: [] };
      await A.bringToFront();
      for (let round = 0; round < 3; round += 1) {
        for (const mode of ['off', 'on']) {
          await W.evaluate(([id]) => RHYTHM_WATCH.focus(id), [mode === 'on' ? idA : idB]);
          await A.waitForTimeout(2500);
          const m0 = await metric();
          const f = await frames(A, 9000);
          const m1 = await metric();
          rows[mode].push({ over: f.over, js: (m1.ScriptDuration - m0.ScriptDuration) / f.n * 1000, style: (m1.RecalcStyleDuration - m0.RecalcStyleDuration) / f.n * 1000, layout: (m1.LayoutDuration - m0.LayoutDuration) / f.n * 1000 });
        }
      }
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      for (const key of ['off', 'on']) console.log(`  ${key}: ${rows[key].map((x) => `[超${x.over} JS${x.js.toFixed(2)} 式${x.style.toFixed(2)} 配${x.layout.toFixed(2)}]`).join(' ')}`);
      const range = (list, key, d) => `${Math.min(...list.map((x) => x[key])).toFixed(d)}〜${Math.max(...list.map((x) => x[key])).toFixed(d)}`;
      console.log('  | | 33.3ms を超えたフレーム | 1フレームの JS | スタイル再計算 | レイアウト |');
      for (const [label, key] of [['観戦なし(3回)', 'off'], ['観戦あり(3回・1秒ごと)', 'on']]) console.log(`  | ${label} | ${range(rows[key], 'over', 0)} | ${range(rows[key], 'js', 2)}ms | ${range(rows[key], 'style', 2)}ms | ${range(rows[key], 'layout', 2)}ms |`);
      await W.evaluate(([id]) => RHYTHM_WATCH.focus(id), [idA]);
    }
    console.log(`  (ここまでの演奏の位置 ${await A.evaluate(() => RHYTHM_PLAY_WATCH.timeMs)}ms)`);
    // ---- 後から入った待機中のメンバー(えま)にも見える ----
    await L.locator('[data-rhythm-mode-private-open]').click();
    await L.locator('[data-rhythm-multi-code-input]').fill(code);
    await L.locator('[data-rhythm-multi-join]').click();
    await L.waitForSelector('[data-rhythm-watch][data-rhythm-watch-phase="playing"]', { timeout: 25000 })
      .then(() => check('演奏中の部屋へ後から入ると、待機のあいだ、その演奏が見える', true), () => check('演奏中の部屋へ後から入ると、待機のあいだ、その演奏が見える', false));
    check('待機のメンバーが入っても、演奏中の部屋は演奏の人数のまま(待機の人は演奏の人数に入らない)', (await A.evaluate(() => RHYTHM_MULTI.view().room.participants.length)) === PLAYERS);
    const rows3 = await L.evaluate(() => document.querySelectorAll('[data-rhythm-watch-row]').length);
    // r1115-189: 待機中の部屋の人には、観戦の人のひとことがすぐ届く(👁観戦・琥珀色)。待機の人が見ている観戦の画面の欄にも出る
    await W.evaluate(() => { const st = RHYTHM_WATCH.view(); st.lastSayAt = 0; return RHYTHM_WATCH.say('おしい!'); });
    await L.waitForFunction(() => RHYTHM_MULTI.view().chat.some((c) => c.w === 1 && c.text === 'おしい!'), null, { timeout: 5000 })
      .then(() => check('待機中の部屋の人には、観戦の人のひとことがすぐ届く', true), () => check('待機中の部屋の人には、観戦の人のひとことがすぐ届く', false));
    await L.waitForSelector('[data-rhythm-watch-chat-line="watch"]', { timeout: 3000 })
      .then(() => check('待機の人が見ている観戦の画面の欄にも、観戦の人のひとことが出る', true), () => check('待機の人が見ている観戦の画面の欄にも出る', false));
    if (SHOT_DIR) {
      // 部屋の人(待機中)の部屋のチャット: 観戦の画面を閉じて、チャットを開く
      for (const [nm, w, h] of [['tate', 390, 844], ['tate320', 320, 568], ['yoko', 844, 390]]) {
        await L.setViewportSize({ width: w, height: h }); await L.waitForTimeout(500);
        await L.evaluate(() => RHYTHM_WATCH.stop()); await L.waitForTimeout(300);
        const btn = L.locator('[data-rhythm-multi-chat-open]:visible').first();
        if (!(await L.locator('[data-rhythm-multi-chat]').count())) await btn.click({ timeout: 3000 }).catch(() => {});
        await L.waitForTimeout(600);
        await L.screenshot({ path: path.join(SHOT_DIR, `chat-room-${nm}.png`) });
      }
      await L.setViewportSize({ width: 844, height: 390 });
    }
    check('待機のメンバーにも順位が出る', rows3 === PLAYERS, `${rows3}行`);
    // 見ている人が2人になっても、見られている人は1秒ごとのまま増えない(1人が1通で、みんなに届く)
    // ---- 観戦の人数は10人まで ----
    await B.evaluate(() => { const topic = window.__topic; const ch = new BroadcastChannel(`fake-ws:${topic}`); for (let i = 0; i < 14; i += 1) ch.postMessage({ t: 'wt', id: `wx${i}`, f: '' }); });
    await A.waitForTimeout(800);
    const count = await A.evaluate(() => RHYTHM_MULTI.watcherCount());
    check('観戦は10人まで(あふれた人は数えない)', count === 10, `${count}人`);
    // ---- 終わりの1通 → 観戦の画面が「終わりました」になる ----
    for (const p of pages) await p.evaluate((id) => RHYTHM_MULTI.reportResult(id, { score: 430000, cleared: true, maxCombo: 130, judgments: { MARVELOUS: 90, EXCELLENT: 20, GREAT: 8, GOOD: 2, BAD: 0, MISS: 1 }, fast: 1, slow: 1 }, false), await A.evaluate(() => RHYTHM_MULTI.view().room.round));
    // r1115-189: 演奏中に届いた観戦の人のひとことは、演奏が終わってからチャットへ足す。部屋の人を名乗ったものは出さない
    check('演奏が終わると、演奏中に届いた観戦の人のひとことがチャットに出る(👁観戦の印つき)', await A.evaluate(() => RHYTHM_MULTI.view().chat.some((c) => c.w === 1 && c.text === 'がんばれ!')), JSON.stringify(await A.evaluate(() => RHYTHM_MULTI.view().chat.map((c) => [c.text, c.w || 0]))));
    check('部屋の人の id を名乗った観戦のひとことは出さない', await A.evaluate(() => !RHYTHM_MULTI.view().chat.some((c) => c.text === 'なりすまし')));
    await W.waitForFunction(() => /演奏が終わりました/.test(document.querySelector('[data-rhythm-watch]').innerText), null, { timeout: 8000 })
      .then(() => check('2人とも終わると、観戦の画面に「演奏が終わりました」が出る', true), () => check('2人とも終わると、観戦の画面に「演奏が終わりました」が出る', false));
    // ---- やめる ----
    await W.locator('[data-rhythm-watch-close]').click();
    await W.waitForTimeout(500);
    check('観戦をやめると画面が閉じる', !(await W.evaluate(() => !!document.querySelector('[data-rhythm-watch]'))));
    check('観戦をやめると、観戦の曲は止まり、元の曲へ戻す側になる(r1115-190③)', await W.evaluate(() => !RHYTHM_WATCH_AUDIO.on() && window.__wa.length > 0 && window.__wa.every((x) => !x.h || !x.h.started())));
    // ---- 観戦を許さない設定: 保存は新しいキーだけ ----
    const stored = await A.evaluate(async () => { RHYTHM_MULTI.setWatchAllow(false); await new Promise((r) => setTimeout(r, 300)); return { allowed: RHYTHM_MULTI.watcherCount(), keys: Object.keys(localStorage).filter((k) => /spectate/.test(k)), val: localStorage.getItem('mh_rhythm_multi_spectate_v1') }; });
    check('観戦を許さない設定にすると、外の人は外れ(部屋のメンバーの待機の人だけ残る)、新しいキー(mh_rhythm_multi_spectate_v1)だけに保存する', stored.allowed <= 1 && stored.keys.length === 1 && /false/.test(stored.val || ''), JSON.stringify(stored));
    // ---- 重さの目安 ----
    console.log(`  フレーム間隔(ms) 観戦なし: 平均 ${base.mean.toFixed(2)} / 95% ${base.p95.toFixed(1)} / 最大 ${base.max.toFixed(1)}(${base.n}枚)`);
    console.log(`  フレーム間隔(ms) 観戦あり: 平均 ${withWatch.mean.toFixed(2)} / 95% ${withWatch.p95.toFixed(1)} / 最大 ${withWatch.max.toFixed(1)}(${withWatch.n}枚)`);
    check('観戦ありでも、フレーム間隔の平均がほぼ変わらない(+1.5ms 以内・同じ端末で)', withWatch.mean - base.mean <= 1.5, `${(withWatch.mean - base.mean).toFixed(2)}ms`);
    check('画面のエラーが出ていない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで進む', false, String(e && e.message ? e.message : e).split('\n').slice(0, process.env.MH_DEBUG ? 6 : 1).join(' | '));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
