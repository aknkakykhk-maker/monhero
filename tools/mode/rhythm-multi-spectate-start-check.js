// モンヒロビートのマルチの観戦で、ノーツが出ない・進みの棒が 0:00・判定の数が「-」・曲が待機のまま(2026-11-15 r1115-204 本番・iPhone 縦)を確かめる。
//
//   node tools/mode/rhythm-multi-spectate-start-check.js
//   MH_SHOT_DIR=<フォルダ> node tools/mode/rhythm-multi-spectate-start-check.js    # 390×844 の縦と横の止め絵も撮る
//
// 本番で起きていたこと: 観戦の画面は「見ている1人」から1秒ごとに届く細かい知らせ(曲の位置 p・判定の数 k・ライフ l)で譜面・進みの棒・判定の数を出し、
//   曲もその位置で鳴らす。その知らせは、観戦の人の「見ています」(wt)を聞いた演奏者だけが送る。ところが
//   ①曲が始まる前から観戦していると、始まりの合図で送る wt は、まだ演奏に入っていない端末で捨てられ、次に送るのは10秒後だった
//   ②見ている人が古い版のアプリ・観戦を許していない人だと、細かい知らせはずっと来ず、画面は止まったまま(点・順位だけ動く)だった
// 見張ること:
//   ・始まる前から観戦して(だれも選ばない)、始まってから5秒以内に曲の位置と判定の数が届き、観戦の曲が鳴る(助手を呼んだ部屋でも)
//   ・見ている人から届かないときは、ほかの人へ自分で切り替わって届く。だれからも届かなければ案内が出る
// ★外へはつながない(rhythm-multi-spectate-check.js と同じ偽の WebSocket + BroadcastChannel)。演奏する人の端末・通信は変えない(見る側だけ)
const http = require('http');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (_) {
  try { playwright = require('playwright'); } catch (e) { console.log('SKIP: playwright が無いので測れません'); process.exit(0); }
}
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
    deliver(obj) { const q = obj && obj.payload && obj.payload.payload; if (q && typeof window.__mute === 'function' && window.__mute(q)) return; const data = JSON.stringify(obj); setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0); }
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



const VIEW = { width: 390, height: 844 };
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
    await page.waitForFunction(() => document.querySelector('button.mh-home-facility.rhythm') && !document.querySelector('[role=dialog]'), null, { timeout: 40000 });
    await page.locator('button.mh-home-facility.rhythm').click();
    await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
    await page.waitForTimeout(800);
    return page;
  };
  // 演奏画面の読むだけの窓へ、時計どおりに進む曲の位置と、決まった点・判定の数を返す入れ物を差し込む(だれも押さないので)
  const runHud = (p, score, combo, k, life, fromMs) => p.evaluate(([sc, cb, kk, lf, t]) => {
    const counts = {}; ['MARVELOUS', 'EXCELLENT', 'GREAT', 'GOOD', 'BAD', 'MISS'].forEach((id, i) => { counts[id] = kk[i]; });
    const fixed = { score: sc, combo: cb, counts, life: lf }; RHYTHM_PLAY_WATCH.hud = { get: () => fixed };
    const t0 = Date.now(); Object.defineProperty(RHYTHM_PLAY_WATCH, 'timeMs', { get: () => t + (Date.now() - t0), set: () => {}, configurable: true });
  }, [score, combo, k, life, fromMs]);
  const state = () => W.evaluate(() => {
    const v = RHYTHM_WATCH.view(); if (!v) return null; const r = v.rows[v.focus] || {};
    const counts = [...document.querySelectorAll('[data-rhythm-watch-count] b')].map((x) => x.innerText.trim());
    const bar = document.querySelector('[data-rhythm-watch-progress]');
    return { phase: v.phase, focus: v.focus, people: v.people.map((x) => x.name), p: r.p || 0, pAt: r.pAt || 0, k: !!r.k, counts, bar: bar ? parseFloat(bar.style.width) || 0 : 0,
      noDetail: !!document.querySelector('[data-rhythm-watch-nodetail]'), audio: RHYTHM_WATCH_AUDIO.on() };
  });
  let W = null;
  try {
    const A = await open('あかね', 'Mocchi'); const B = await open('いぶき', 'Suezo');
    W = await open('うみ', 'Pixie');
    for (const p of [A, B]) await p.locator('[data-rhythm-multi-free]').click();
    await A.locator('[data-rhythm-multi-free-create]').click();
    await A.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 15000 });
    const code = (await A.locator('[data-rhythm-multi-room-code]').innerText()).trim();
    await B.locator('[data-rhythm-multi-free-list-open]').click();
    await B.getByRole('button', { name: '入る', exact: true }).first().click({ timeout: 20000 });
    // 助手を呼んだ部屋(本番はソラシド・きゅこの名前の部屋だった)。助手は観戦の行に入らない(演奏中の点を持たない)
    const summoned = await A.evaluate(() => RHYTHM_MULTI.summon({ masuId: 'as:sorashido', callId: 'chk204', name: 'ソラシド', level: 1, baseId: '', colors: [], assistantId: 'sorashido' }));
    check('助手(ソラシド)を部屋に呼べる(助手の部屋で確かめる)', summoned === true);
    // 曲えらび中から観戦する(本番の社長と同じ。部屋の一覧の「観戦」→ 観戦の画面に「この部屋に入る」)
    await W.locator('[data-rhythm-multi-free]').click();
    await W.locator('[data-rhythm-multi-free-list-open]').click();
    await W.waitForSelector(`[data-rhythm-multi-room-watch="${code}"]`, { timeout: 30000 });
    await W.evaluate(() => { const orig = Audio_.startRhythmTrack; window.__wa = []; Audio_.startRhythmTrack = async (k, v, o) => { const h = await orig(k, v, o); window.__wa.push({ k, h }); return h; }; });
    await W.locator(`[data-rhythm-multi-room-watch="${code}"]`).click();
    await W.waitForSelector('[data-rhythm-watch][data-rhythm-watch-phase="waiting"]', { timeout: 20000 });
    check('曲えらび中の部屋を観戦すると、始まるのを待つ画面になり、「この部屋に入る」がある', (await W.locator('[data-rhythm-watch-join]').count()) === 1);
    // 始める(人は2人とも準備。助手は呼んだ人の端末が代わりに動く)
    for (let i = 0; i < 40; i += 1) {
      if ((await A.locator('[data-rhythm-multi-ready]').count()) && (await B.locator('[data-rhythm-multi-ready]').count())) break;
      for (const p of [A, B]) { if (await p.locator('[data-rhythm-multi-omakase]').count()) await p.locator('[data-rhythm-multi-omakase]').click().catch(() => {}); }
      if (await A.locator('[data-rhythm-demo-start]').count()) await A.locator('[data-rhythm-demo-start]').click().catch(() => {});
      await A.waitForTimeout(1500);
    }
    for (const p of [A, B]) { await p.bringToFront(); await p.waitForTimeout(600); await p.locator('[data-rhythm-multi-ready]').click({ timeout: 4000 }).catch(() => {}); }
    await W.waitForSelector('[data-rhythm-watch][data-rhythm-watch-phase="playing"]', { timeout: 40000 });
    const startedAt = Date.now();
    // 演奏の位置は、演奏画面が開いたら時計どおりに進める(本物の演奏と同じく、届く知らせの p が1秒ごとに進む)
    for (const p of [A, B]) await p.waitForFunction(() => typeof RHYTHM_PLAY_WATCH !== 'undefined' && !!RHYTHM_PLAY_WATCH.hud, null, { timeout: 30000 });
    const idA = await A.evaluate(() => RHYTHM_MULTI.view().selfId); const idB = await B.evaluate(() => RHYTHM_MULTI.view().selfId);
    await runHud(A, 45389, 51, [40, 8, 3, 0, 0, 0], 1000, 20000); await runHud(B, 45801, 51, [42, 7, 2, 0, 0, 0], 1000, 20000);
    const hudAt = Date.now();   // ここから演奏する人は細かい知らせを送れる
    // ---- ① 始まる前から観戦・だれも選ばない: 始まってから5秒以内に、曲の位置と判定の数が届く ----
    let got = null;
    for (let i = 0; i < 24; i += 1) { const s = await state(); if (s && s.pAt > 0 && s.k) { got = { ...s, after: Date.now() - hudAt, sinceStart: Date.now() - startedAt }; break; } await W.waitForTimeout(500); }
    const s1 = got || await state();
    check('観戦の行は人の2人だけ(呼んだ助手は入らない)', s1 && s1.people.length === 2 && !s1.people.includes('ソラシド'), JSON.stringify(s1 && s1.people));
    check('始まる前から観戦していても、演奏が始まってから4秒以内に曲の位置と判定の数が届く(前は次の「見ています」まで最大10秒・本番は止まったまま)', !!got && got.after <= 4000, JSON.stringify(got ? { after: got.after, sinceStart: got.sinceStart, p: got.p } : s1));
    await W.waitForTimeout(2500);
    const s2 = await state();
    check('判定の数が「-」のままにならない', s2 && s2.counts.length === 6 && s2.counts.every((x) => x !== '-'), JSON.stringify(s2 && s2.counts));
    check('進みの棒が 0:00 のままにならない(曲の位置まで進む)', s2 && s2.bar > 0 && s2.p > 20000, JSON.stringify({ bar: s2 && s2.bar, p: s2 && s2.p }));
    const au = await W.evaluate(() => { const v = RHYTHM_WATCH.view(); const song = RHYTHM_SONGS.find((x) => x.songId === v.songId); const last = window.__wa[window.__wa.length - 1]; return { want: song && song.bgmTrackId, key: last && last.k, started: !!(last && last.h && last.h.started()), on: RHYTHM_WATCH_AUDIO.on() }; });
    check('観戦している曲が鳴る(待機の曲のままにならない)', au.on && au.started && au.key === au.want, JSON.stringify(au));
    const drawn = await W.evaluate(() => { const c = document.querySelector('[data-rhythm-watch-stage] canvas'); if (!c) return -1; try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n += 1; return n; } catch (_) { return -2; } });
    check('観戦の道に、ノーツが描かれている', drawn > 0 || drawn === -2, String(drawn));
    if (SHOT_DIR) {
      await W.bringToFront();
      await W.screenshot({ path: path.join(SHOT_DIR, 'watch-notes-tate.png') });
      await W.setViewportSize({ width: 844, height: 390 }); await W.waitForTimeout(1500);
      await W.screenshot({ path: path.join(SHOT_DIR, 'watch-notes-yoko.png') });
      await W.setViewportSize(VIEW); await W.waitForTimeout(800);
    }
    // ---- ② 見ている人が古い版(細かい知らせも返事も来ない): 自分で選んでいなければ、届く人へ切り替わる ----
    await W.evaluate((a) => { window.__mute = (q) => (q.t === 'pg' && q.id === a && q.p != null) || (q.t === 'wi' && q.id === a); const v = RHYTHM_WATCH.view(); v.focus = a; v.focusAt = Date.now(); v.focusManual = false; v.tried = []; v.noDetail = false; delete v.rows[a].pAt; v.rows[a].pAt = 0; }, idA);
    let sw = null;
    for (let i = 0; i < 30; i += 1) { await W.waitForTimeout(500); const s = await state(); if (s && s.focus === idB && s.pAt > 0 && Date.now() - s.pAt < 3000) { sw = s; break; } }
    check('見ている人(古い版)から届かないと、ほかの人へ切り替わって、譜面が流れ続ける', !!sw, JSON.stringify(sw || await state()));
    // ---- ③ だれからも届かない: 止まった画面のままにせず、案内を出す ----
    await W.evaluate(() => { window.__mute = (q) => (q.t === 'pg' && q.p != null) || q.t === 'wi'; });
    let nd = false;
    for (let i = 0; i < 50 && !nd; i += 1) { await W.waitForTimeout(500); const s = await state(); nd = !!(s && s.noDetail); }
    check('だれからも細かい知らせが届かないときは、「譜面は届いていません」の案内が出る', nd);
    if (SHOT_DIR && nd) await W.screenshot({ path: path.join(SHOT_DIR, 'watch-nodetail-tate.png') });
    await W.evaluate(() => { window.__mute = null; });
    let back = false;
    for (let i = 0; i < 20 && !back; i += 1) { await W.waitForTimeout(500); const s = await state(); back = !!(s && !s.noDetail && s.pAt > 0); }
    check('また届くようになると、案内は消えて流れ直す', back);
    await W.locator('[data-rhythm-watch-close]').click();
    await W.waitForTimeout(500);
    check('観戦をやめると、観戦の曲を止めて元の曲へ戻す側になる', await W.evaluate(() => !RHYTHM_WATCH_AUDIO.on()));
    check('画面のエラーが出ていない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    console.log('NG: 途中で止まった — ' + (e && e.message ? e.message.split('\n')[0] : e));
    failed++;
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
