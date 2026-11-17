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
    await page.waitForFunction(() => document.querySelector('button[data-home-fac="rhythm"]') && !document.querySelector('[role=dialog]'), null, { timeout: 40000 });
    await page.locator('button[data-home-fac="rhythm"]').click();
    await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
    await page.waitForTimeout(800);
    return page;
  };
  // 演奏画面の読むだけの窓へ、時計どおりに進む曲の位置と、決まった点・判定の数を返す入れ物を差し込む(だれも押さないので)
  const runHud = (p, score, combo, k, life, fromMs) => p.evaluate(([sc, cb, kk, lf, t]) => {
    const counts = {}; ['MARVELOUS', 'EXCELLENT', 'GREAT', 'GOOD', 'BAD', 'MISS'].forEach((id, i) => { counts[id] = kk[i]; });
    const t0 = Date.now();
    // 点は時計どおりに少しずつ増やす(本物の演奏と同じく、点の知らせが3秒ごとに出る。止めると観戦は20秒で「終わった」扱いになる)
    RHYTHM_PLAY_WATCH.hud = { get: () => ({ score: sc + Math.floor((Date.now() - t0) / 1000) * 100, combo: cb, counts, life: lf }) };
    Object.defineProperty(RHYTHM_PLAY_WATCH, 'timeMs', { get: () => t + (Date.now() - t0), set: () => {}, configurable: true });
    // 描いたコマの数も60枚/秒で進める。この検査では演奏する人の画面が裏のタブになり描画が間引かれるので、
    // 本物のままだと「端末が重い」(40枚/秒を切る)と判断されて、判定を送らない形へ切り替わってしまう(本物の演奏者の画面は表に出ている)
    const f0 = RHYTHM_PLAY_WATCH.frames || 0;
    Object.defineProperty(RHYTHM_PLAY_WATCH, 'frames', { get: () => f0 + Math.floor((Date.now() - t0) * 0.06), set: () => {}, configurable: true });
  }, [score, combo, k, life, fromMs]);
  // 落ちたときに、観戦の画面の様子(見えているか・時計・判定の表)を書き出す
  const why = () => W.evaluate(() => { const v = RHYTHM_WATCH.view() || {}; const r = (v.rows || {})[v.focus] || {}; const jm = (v.judged || {})[v.focus];
    return { vis: document.visibilityState, focus: document.hasFocus(), phase: v.phase, focusId: v.focus, manual: v.focusManual, tried: v.tried, wiFrom: v.wiFrom, noDetail: v.noDetail, pAge: r.pAt ? Date.now() - r.pAt : null, lite: r.lt === true, p: r.p, judged: jm ? jm.size : 0, lastPing: Date.now() - (v.lastPing || 0), focusAge: Date.now() - (v.focusAt || 0) }; }).catch((e) => String(e));
  let PL = [];   // いまの組み合わせの演奏する人のページ(落ちたときの様子を書き出す)
  const whyPlayers = () => Promise.all(PL.map((p) => p.evaluate(() => { const v = RHYTHM_MULTI.view(); const me = v && v.members.find((m) => m.id === v.selfId);
    return { vis: document.visibilityState, playing: !!(me && me.playing), phase: v && v.room && v.room.phase, watchers: RHYTHM_MULTI.watcherCount(), hud: !!RHYTHM_PLAY_WATCH.hud, area: !!document.querySelector('[data-rhythm-play-area]'), jd: Array.isArray(RHYTHM_PLAY_WATCH.jd), text: (document.body.innerText || '').slice(0, 80).replace(/\s+/g, ' ') }; }).catch((e) => String(e))));
  const state = () => W.evaluate(() => {
    const v = RHYTHM_WATCH.view(); if (!v) return null; const r = v.rows[v.focus] || {};
    const counts = [...document.querySelectorAll('[data-rhythm-watch-count] b')].map((x) => x.innerText.trim());
    const bar = document.querySelector('[data-rhythm-watch-progress]');
    return { phase: v.phase, focus: v.focus, people: v.people.map((x) => x.name), p: r.p || 0, pAt: r.pAt || 0, k: !!r.k, counts, bar: bar ? parseFloat(bar.style.width) || 0 : 0,
      noDetail: !!document.querySelector('[data-rhythm-watch-nodetail]'), audio: RHYTHM_WATCH_AUDIO.on() };
  });
  let W = null;
  // 組み合わせ(社長「できるときとできないときがある」): pre2=曲えらび中から2人の部屋を観戦(本番のできなかったとき) / mid2=演奏の途中から2人の部屋 / mid1=演奏の途中から1人の部屋(本番のできたとき)
  const CASES = (process.env.MH_CASES || 'pre2,mid2,mid1').split(',').filter(Boolean);
  const runCase = async (cs) => {
    console.log(`---- ${cs} ----`);
    const two = cs.endsWith('2'); const pre = cs.startsWith('pre');
    const A = await open('きゅこ', 'Mocchi'); const B = two ? await open('ソラシド', 'Suezo') : null;
    W = await open('うみ', 'Pixie');
    const players = [A, B].filter(Boolean);
    PL = players;
    for (const p of players) await p.locator('[data-rhythm-multi-free]').click();
    await A.locator('[data-rhythm-multi-free-create]').click();
    await A.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 15000 });
    const code = (await A.locator('[data-rhythm-multi-room-code]').innerText()).trim();
    if (B) { await B.locator('[data-rhythm-multi-free-list-open]').click(); await B.getByRole('button', { name: '入る', exact: true }).first().click({ timeout: 20000 }); }
    // 人が1人の部屋は、助手を呼んで始める(演奏中の点を持たない助手は、観戦の行に入らない)
    if (!B) check(`${cs}: 助手(ソラシド)を呼べる`, await A.evaluate(() => RHYTHM_MULTI.summon({ masuId: 'as:sorashido', callId: 'chk204', name: 'ソラシド', level: 1, baseId: '', colors: [], assistantId: 'sorashido' })) === true);
    await W.locator('[data-rhythm-multi-free]').click();
    await W.evaluate(() => { const orig = Audio_.startRhythmTrack; window.__wa = []; Audio_.startRhythmTrack = async (k, v, o) => { const h = await orig(k, v, o); window.__wa.push({ k, h }); return h; }; });
    if (pre) {
      // 曲えらび中から観戦する(本番の社長と同じ。部屋の一覧の「観戦」→ 観戦の画面に「この部屋に入る」)
      await W.locator('[data-rhythm-multi-free-list-open]').click();
      await W.waitForSelector(`[data-rhythm-multi-room-watch="${code}"]`, { timeout: 30000 });
      await W.locator(`[data-rhythm-multi-room-watch="${code}"]`).click();
      await W.waitForSelector('[data-rhythm-watch][data-rhythm-watch-phase="waiting"]', { timeout: 20000 });
      check(`${cs}: 曲えらび中の部屋を観戦すると、始まるのを待つ画面になり、「この部屋に入る」がある`, (await W.locator('[data-rhythm-watch-join]').count()) === 1);
    }
    for (let i = 0; i < 40; i += 1) {
      if ((await A.locator('[data-rhythm-multi-ready]').count()) && (!B || (await B.locator('[data-rhythm-multi-ready]').count()))) break;
      for (const p of players) { if (await p.locator('[data-rhythm-multi-omakase]').count()) await p.locator('[data-rhythm-multi-omakase]').click().catch(() => {}); }
      if (await A.locator('[data-rhythm-demo-start]').count()) await A.locator('[data-rhythm-demo-start]').click().catch(() => {});
      await A.waitForTimeout(1500);
    }
    for (const p of players) { await p.bringToFront(); await p.waitForTimeout(600); await p.locator('[data-rhythm-multi-ready]').click({ timeout: 4000 }).catch(() => {}); }
    for (const p of players) await p.waitForFunction(() => typeof RHYTHM_PLAY_WATCH !== 'undefined' && !!RHYTHM_PLAY_WATCH.hud, null, { timeout: 40000 });
    const idA = await A.evaluate(() => RHYTHM_MULTI.view().selfId);
    const idB = B ? await B.evaluate(() => RHYTHM_MULTI.view().selfId) : '';
    // 演奏の位置は時計どおりに進める(本物の演奏と同じく、届く知らせの p が1秒ごとに進む)
    await runHud(A, 26884, 11, [8, 1, 0, 0, 0, 0], 1000, 20000);
    if (B) await runHud(B, 45389, 51, [40, 8, 3, 0, 0, 0], 1000, 20000);
    const hudAt = Date.now();
    const songInfo = await A.evaluate(() => { const v = RHYTHM_MULTI.view(); const song = RHYTHM_SONGS.find((x) => x.songId === v.room.songId); const me = v.members.find((m) => m.id === v.selfId) || {}; const ch = song && song.difficulties[me.diff]; return { id: v.room.songId, diff: me.diff, ms: ch ? Math.round(ch.durationMs) : (song ? song.playDurationMs : 0), now: window.__mhTestHooks && window.__mhTestHooks.rhythmSongMs ? Math.round(window.__mhTestHooks.rhythmSongMs() || 0) : null }; });
    console.log(`  (${cs} の曲: ${JSON.stringify(songInfo)})`);
    if (!pre) {
      // 演奏の途中から観戦する(観戦の一覧に出るのを待って入る)
      await W.waitForSelector(`[data-rhythm-watch-room="${code}"]`, { timeout: 40000 });
      await W.locator(`[data-rhythm-watch-open="${code}"]`).click();
    }
    await W.waitForSelector('[data-rhythm-watch][data-rhythm-watch-phase="playing"]', { timeout: 40000 });
    await W.bringToFront();   // 裏のタブはタイマー・描画が間引かれる(社長は観戦の画面を見ている)
    const openedAt = Date.now();
    let got = null;
    for (let i = 0; i < 24; i += 1) { const s = await state(); if (s && s.pAt > 0 && s.k) { got = { ...s, after: Date.now() - Math.max(hudAt, openedAt) }; break; } await W.waitForTimeout(500); }
    const s1 = got || await state();
    check(`${cs}: 観戦の行は部屋の人の数だけ`, s1 && s1.people.length === players.length, JSON.stringify(s1 && s1.people));
    check(`${cs}: だれも選ばないままでも、4秒以内に曲の位置と判定の数が届く`, !!got && got.after <= 4000, JSON.stringify(got ? { after: got.after, p: got.p } : s1));
    await W.waitForTimeout(2500);
    const s2 = await state();
    check(`${cs}: 判定の数が「-」のままにならない`, s2 && s2.counts.length === 6 && s2.counts.every((x) => x !== '-'), JSON.stringify(s2 && s2.counts));
    check(`${cs}: 進みの棒が 0:00 のままにならない`, s2 && s2.bar > 0 && s2.p > 20000, JSON.stringify({ bar: s2 && s2.bar, p: s2 && s2.p }));
    const au = await W.evaluate(() => { const v = RHYTHM_WATCH.view(); const song = RHYTHM_SONGS.find((x) => x.songId === v.songId); const last = window.__wa[window.__wa.length - 1]; return { want: song && song.bgmTrackId, key: last && last.k, started: !!(last && last.h && last.h.started()), on: RHYTHM_WATCH_AUDIO.on() }; });
    check(`${cs}: 観戦している曲が鳴る(待機の曲のままにならない)`, au.on && au.started && au.key === au.want, JSON.stringify(au));
    const drawn = await W.evaluate(() => { const c = document.querySelector('[data-rhythm-watch-stage] canvas'); if (!c) return -1; try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) n += 1; return n; } catch (_) { return -2; } });
    check(`${cs}: 観戦の道に、ノーツが描かれている`, drawn > 0 || drawn === -2, String(drawn));
    // ---- たたいた判定(どのノーツをどう叩いたか)が届いて、判定の文字が出る。2曲目からは、前の曲の演奏画面が閉じるときに判定をためる箱を消していた ----
    {
      const focusId = (await state()).focus;
      const P = focusId === idB ? B : A;
      await P.evaluate(() => { RHYTHM_PLAY_WATCH.jd = null; RHYTHM_PLAY_WATCH.jx = null; });   // 前の曲の演奏画面が閉じたときと同じ
      await W.waitForTimeout(2200);
      const boxBack = await P.evaluate(() => Array.isArray(RHYTHM_PLAY_WATCH.jd));
      check(`${cs}: 判定をためる箱が消えても、見られているあいだは用意し直す(2曲目でも判定が届く)`, boxBack);
      // 演奏のループと同じく、これから来るノーツを叩いたことにして箱へ入れる(MARVELOUS)
      const hits = await W.evaluate(() => { const v = RHYTHM_WATCH.view(); const who = v.people.find((x) => x.id === v.focus); const song = RHYTHM_SONGS.find((x) => x.songId === v.songId); const ch = song && song.difficulties[who.diff]; const r = v.rows[v.focus]; const now = r.p + (Date.now() - r.pAt);
        return ch ? ch.notes.map((n, i) => [i, n.timeMs]).filter(([, t]) => t > now + 300 && t < now + 4000).map(([i]) => i) : []; });
      await P.evaluate((ids) => { const jd = RHYTHM_PLAY_WATCH.jd; if (jd !== null) ids.forEach((i) => jd.push(i, 0)); }, hits);
      let text = '';
      await W.bringToFront();
      for (let i = 0; i < 30 && !text; i += 1) { await W.waitForTimeout(300); text = await W.evaluate(() => { const b = document.querySelector('[data-rhythm-watch-stage] [data-rhythm-judgment-text]'); return b ? (b.getAttribute('data-judgment') || '') : ''; }); }
      check(`${cs}: 見ている人がたたいた判定が、1.5秒おくれで観戦の画面に文字で出る`, hits.length > 0 && text === 'MARVELOUS', JSON.stringify({ hits: hits.length, text, ...(text ? {} : { why: await why(), players: await whyPlayers() }) }));
      if (SHOT_DIR && cs === 'pre2' && text) await W.screenshot({ path: path.join(SHOT_DIR, 'watch-judge-tate.png') });
    }
    if (SHOT_DIR && cs === 'pre2') {
      await W.bringToFront();
      await W.screenshot({ path: path.join(SHOT_DIR, 'watch-notes-tate.png') });
      await W.setViewportSize({ width: 844, height: 390 }); await W.waitForTimeout(1500);
      await W.screenshot({ path: path.join(SHOT_DIR, 'watch-notes-yoko.png') });
      await W.setViewportSize(VIEW); await W.waitForTimeout(800);
    }
    if (two) {
      // ---- 見ている人が古い版(細かい知らせも返事も来ない): 自分で選んでいなければ、届く人へ切り替わる ----
      const cur = (await state()).focus; const other = cur === idA ? idB : idA;
      await W.evaluate((a) => { window.__mute = (q) => (q.t === 'pg' && q.id === a && q.p != null) || (q.t === 'wi' && q.id === a); const v = RHYTHM_WATCH.view(); v.focus = a; v.focusAt = Date.now(); v.focusManual = false; v.tried = []; v.wiFrom = []; v.noDetail = false; if (v.rows[a]) v.rows[a].pAt = 0; }, cur);
      let sw = null;
      for (let i = 0; i < 30; i += 1) { await W.waitForTimeout(500); const s = await state(); if (s && s.focus === other && s.pAt > 0 && Date.now() - s.pAt < 3000) { sw = s; break; } }
      check(`${cs}: 見ている人(古い版・観戦を許していない)から届かないと、届く人へ切り替わって譜面が流れ続ける`, !!sw, JSON.stringify(sw || await state()));
    }
    // ---- だれからも届かない: 止まった画面のままにせず、案内を出す ----
    await W.bringToFront();
    await W.evaluate(() => { window.__mute = (q) => (q.t === 'pg' && q.p != null) || q.t === 'wi'; });
    let nd = false;
    for (let i = 0; i < 50 && !nd; i += 1) { await W.waitForTimeout(500); const s = await state(); nd = !!(s && s.noDetail); }
    check(`${cs}: だれからも細かい知らせが届かないときは、「譜面は届いていません」の案内が出る`, nd, nd ? '' : JSON.stringify({ w: await why(), players: await whyPlayers() }));
    if (SHOT_DIR && nd && cs === 'pre2') await W.screenshot({ path: path.join(SHOT_DIR, 'watch-nodetail-tate.png') });
    await W.evaluate(() => { window.__mute = null; });
    let back = false;
    for (let i = 0; i < 20 && !back; i += 1) { await W.waitForTimeout(500); const s = await state(); back = !!(s && !s.noDetail && s.pAt > 0); }
    check(`${cs}: また届くようになると、案内は消えて流れ直す`, back);
    await W.locator('[data-rhythm-watch-close]').click();
    await W.waitForTimeout(500);
    check(`${cs}: 観戦をやめると、観戦の曲を止めて元の曲へ戻す側になる`, await W.evaluate(() => !RHYTHM_WATCH_AUDIO.on()));
    for (const p of [...players, W]) await p.close();
  };
  try {
    for (const cs of CASES) await runCase(cs);
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
