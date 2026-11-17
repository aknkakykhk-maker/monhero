// モンヒロビートのマルチの曲選びで、前に選んだ曲が選ばれた状態・その位置で開くかを、本物の画面で確かめる(2026-11-15 r1115-165)。
// 社長「マルチの曲選びで、開くたびに一番上の曲に戻される」(止め絵 docs/progress/beat/report-1115/r1115-165/multi-song-select-president.png)。
//   ・前に選んだ曲(新しいキー mh_rhythm_multi_last_song_v1)が、次に曲選びを開いたときに選ばれていて、一覧のまん中あたりに見える
//   ・曲を選ぶとそのキーに覚える(既存のキーは触らない)。キーが壊れている・無い曲なら、いちばん上のまま(落ちない)
//   node tools/mode/rhythm-multi-select-keep-check.js        MH_SHOT_DIR=<フォルダ> で止め絵も撮る(横 844×390)
// ★外へはつながない(観戦の検査と同じ偽の WebSocket + BroadcastChannel)。部屋の作り方は rhythm-multi-spectate-check.js と同じ
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
    await page.addInitScript(([nm, ic]) => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', nm); put('mh_breeder_icon', ic); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'momosuke'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_hell_story_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
    }, [name, icon]);
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
    for (const p of [A, B]) await p.locator('[data-rhythm-multi-free]').click();
    await A.locator('[data-rhythm-multi-free-create]').click();
    await A.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 15000 });
    await B.locator('[data-rhythm-multi-free-list-open]').click();
    await B.getByRole('button', { name: '入る', exact: true }).first().click({ timeout: 20000 });
    // 曲選びの一覧から、まん中より下の曲を1つ選ぶ(一覧の先頭ではない曲)
    await A.waitForSelector('[data-rhythm-multi-step="select"] [data-rhythm-song-row]', { timeout: 40000 });
    const rows = await A.evaluate(() => [...document.querySelectorAll('[data-rhythm-song-row]')].map((b) => b.getAttribute('data-rhythm-song-row')));
    check('曲選びの一覧が出る(曲が5つ以上)', rows.length >= 5, String(rows.length));
    const target = rows[Math.floor(rows.length * 0.7)];
    await A.evaluate((id) => { const b = document.querySelector(`[data-rhythm-song-row="${id}"]`); b.scrollIntoView({ block: 'center' }); b.click(); }, target);
    await A.waitForTimeout(500);
    const saved = await A.evaluate(() => localStorage.getItem('mh_rhythm_multi_last_song_v1'));
    check('曲を選ぶと、新しいキー mh_rhythm_multi_last_song_v1 に覚える', !!saved && rows.includes(saved), String(saved));
    // 次の曲を選ぶとき(画面を開き直す)と同じく、いったん部屋を出て、新しい部屋で曲選びを開く
    const seen = async (label) => {
      await A.waitForSelector('[data-rhythm-multi-step="select"] [data-rhythm-song-row]', { timeout: 40000 });
      await A.waitForTimeout(900);
      return A.evaluate(() => {
        const list = document.querySelector('[data-rhythm-song-list]');
        const sel = document.querySelector('[data-rhythm-song-row][aria-pressed="true"]');
        if (!list || !sel) return { sel: sel ? sel.getAttribute('data-rhythm-song-row') : '', inView: false };
        // 一覧は同じ並びを3つ重ねた輪なので、本体の行か影の行(data-rhythm-song-row-loop)のどれかが見えていればよい(見た目は同じ)
        const lb = list.getBoundingClientRect();
        const copies = [...list.querySelectorAll('[aria-pressed="true"]')];
        const shown = copies.some((b) => { const r = b.getBoundingClientRect(); return r.top >= lb.top - 1 && r.bottom <= lb.bottom + 1; });
        const first = document.querySelector('[data-rhythm-song-row]');
        return { top: Math.round(list.scrollTop), copies: copies.length, sel: sel.getAttribute('data-rhythm-song-row'), inView: shown, first: first.getAttribute('data-rhythm-song-row') };
      });
    };
    await A.reload({ waitUntil: 'load' });
    const A2 = A;
    await A2.waitForFunction(() => document.body && document.body.innerText.includes('TAP TO START'), null, { timeout: 60000 });
    await A2.getByText('TAP TO START').click(); await A2.waitForTimeout(2500); await A2.mouse.click(VIEW.width / 2, VIEW.height / 2); await A2.waitForTimeout(3000);
    await A2.waitForFunction(() => document.querySelector('button[data-home-fac="rhythm"]') && !document.querySelector('[role=dialog]'), null, { timeout: 40000 });
    await A2.locator('button[data-home-fac="rhythm"]').click();
    await A2.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
    // 前の部屋へ戻る案内が出ることがあるので、新しく作る
    await A2.locator('[data-rhythm-multi-free]').click();
    await A2.locator('[data-rhythm-multi-free-create]').click();
    await A2.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 15000 });
    await B.reload({ waitUntil: 'load' }).catch(() => {});
    const C = await open('うみ', 'Pixie');
    await C.locator('[data-rhythm-multi-free]').click();
    await C.locator('[data-rhythm-multi-free-list-open]').click();
    await C.getByRole('button', { name: '入る', exact: true }).first().click({ timeout: 20000 });
    const again = await seen('again');
    check('次に曲選びを開くと、前に選んだ曲が選ばれている', again.sel === saved, JSON.stringify(again));
    check('一覧は、その曲の行が見える位置で開く(いちばん上へ戻らない)', again.inView === true, JSON.stringify(again));
    if (SHOT_DIR) await A2.screenshot({ path: path.join(SHOT_DIR, 'multi-select-keep.png') });
    // 壊れた値でも落ちない(いちばん上のまま)
    check('覚えた値が壊れているときは使わない(読めない形は空)', await A2.evaluate(() => { localStorage.setItem('mh_rhythm_multi_last_song_v1', '<bad>'); const v = rhythmMultiLastSongId(); localStorage.setItem('mh_rhythm_multi_last_song_v1', 'x'); return v === ''; }));
    check('おまかせ(*)は覚えない', await A2.evaluate(() => { localStorage.setItem('mh_rhythm_multi_last_song_v1', 'keep_me'); rhythmMultiRememberSong('*'); return localStorage.getItem('mh_rhythm_multi_last_song_v1') === 'keep_me'; }));
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
