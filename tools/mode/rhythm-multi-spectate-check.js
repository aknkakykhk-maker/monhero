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


const PLAYERS = 2;
(async () => {
  const server = await serve();
  const PORT = server.address().port;
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: SHOT_DIR ? 2 : 1 });
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
    await page.mouse.click(422, 195);
    await page.waitForTimeout(3000);
    // お知らせ・ギフトなどの吹き出しは閉じ続ける
    await page.evaluate(() => { setInterval(() => { const d = document.querySelector('[role=dialog]'); if (!d) return; const b = d.querySelector('button[aria-label="次へ"],button[aria-label="閉じる"]') || [...d.querySelectorAll('button')].find((x) => /受け取|閉じる|とじる|OK|はじめる|わかった|^次へ|あとで|見た/.test(x.innerText)); if (b) b.click(); }, 250); });
    await page.waitForFunction(() => document.querySelector('button.mh-home-facility.rhythm') && !document.querySelector('[role=dialog]'), null, { timeout: 40000 });
    await page.locator('button.mh-home-facility.rhythm').click();
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
    const step = (t) => { gaps.push(t - last); last = t; if (t < end) requestAnimationFrame(step); else { gaps.sort((a, b) => a - b); const sum = gaps.reduce((x, y) => x + y, 0); resolve({ n: gaps.length, mean: sum / gaps.length, p95: gaps[Math.floor(gaps.length * 0.95)], max: gaps[gaps.length - 1] }); } };
    requestAnimationFrame(step);
  }), ms);
  try {
    const A = await open('あかね', 'Mocchi'); const B = await open('いぶき', 'Suezo');
    const W = await open('うみ', 'Pixie'); const L = await open('えま', 'Tiger');
    const pages = [A, B];
    // フリーマッチの部屋(演奏中の部屋が観戦の一覧に出るのは、フリーの部屋だけ)
    for (const p of pages) await p.locator('[data-rhythm-multi-free]').click();
    await A.locator('[data-rhythm-multi-free-create]').click();
    await A.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 15000 });
    const code = (await A.locator('[data-rhythm-multi-room-code]').innerText()).trim();
    await B.locator('[data-rhythm-multi-free-list-open]').click();
    await B.getByRole('button', { name: '入る', exact: true }).first().click({ timeout: 20000 });
    for (let i = 0; i < 40; i += 1) {
      if ((await A.locator('[data-rhythm-multi-ready]').count()) && (await B.locator('[data-rhythm-multi-ready]').count())) break;
      for (const p of pages) { if (await p.locator('[data-rhythm-multi-omakase]').count()) await p.locator('[data-rhythm-multi-omakase]').click().catch(() => {}); }
      if (await A.locator('[data-rhythm-demo-start]').count()) await A.locator('[data-rhythm-demo-start]').click().catch(() => {});
      await A.waitForTimeout(1500);
    }
    for (const p of pages) { await p.bringToFront(); await p.waitForTimeout(600); await p.locator('[data-rhythm-multi-ready]').click({ timeout: 60000 }); }
    for (const p of pages) await p.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    for (const p of pages) await p.waitForFunction(() => typeof RHYTHM_PLAY_WATCH !== 'undefined' && !!RHYTHM_PLAY_WATCH.hud, null, { timeout: 15000 });
    const idA = await A.evaluate(() => RHYTHM_MULTI.view().selfId); const idB = await B.evaluate(() => RHYTHM_MULTI.view().selfId);
    await setHud(A, 412880, 128, [90, 20, 8, 2, 0, 1], 880, 61000); await setHud(B, 371450, 96, [70, 22, 10, 3, 1, 2], 760, 60500);
    // ---- 観戦なしの間のフレームの間隔と送る量 ----
    const pgBefore = await sent(A, 'pg');
    await A.bringToFront();
    await A.waitForTimeout(800);
    const base = await frames(A, 8000);
    const pgNoWatch = (await sent(A, 'pg')) - pgBefore;
    check('観戦の人がいないあいだ、あかね は今までどおり(3秒ごと・値が変わらなければ送らない。6秒で3通以下)', pgNoWatch <= 3, `${pgNoWatch}通`);
    check('観戦の人がいないあいだ、見られる印は立たない', (await A.evaluate(() => RHYTHM_MULTI.watcherCount())) === 0);

    // ---- 外から見る(うみ。部屋のメンバーではない) ----
    // フリーマッチの窓を開くと、演奏中の部屋が「観戦」の一覧に出る(演奏の人が4秒後から10秒ごとに知らせる)
    await W.locator('[data-rhythm-multi-free]').click();
    await W.waitForSelector(`[data-rhythm-watch-room="${code}"]`, { timeout: 30000 });
    check('フリーの部屋は、演奏中になると観戦の一覧に出る', true);
    await W.locator(`[data-rhythm-watch-open="${code}"]`).click();
    await W.waitForSelector('[data-rhythm-watch][data-rhythm-watch-phase="playing"]', { timeout: 20000 });
    await W.waitForFunction(() => document.querySelectorAll('[data-rhythm-watch-row]').length === 2, null, { timeout: 10000 });
    check('外から見ると、観戦の画面に2人ぶんの行が出る', true);
    await W.evaluate((id) => RHYTHM_WATCH.focus(id), idA);
    await W.waitForTimeout(1500);
    // 見られている1人(最初は先頭)の判定の数・ライフ
    await W.waitForFunction(() => { const c = document.querySelector('[data-rhythm-watch-count="MARVELOUS"] b'); return c && c.textContent !== '-'; }, null, { timeout: 15000 });
    const detail = await W.evaluate(() => ({
      rows: [...document.querySelectorAll('[data-rhythm-watch-row]')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
      counts: [...document.querySelectorAll('[data-rhythm-watch-count]')].map((c) => c.querySelector('b').textContent),
      life: document.querySelector('[data-rhythm-watch-life]').style.width,
      progress: document.querySelector('[data-rhythm-watch-progress]').style.width,
      focus: RHYTHM_WATCH.view().focus,
    }));
    const wantFocus = detail.focus;
    const focusIsA = wantFocus === idA;
    const wantK = focusIsA ? [90, 20, 8, 2, 0, 1] : [70, 22, 10, 3, 1, 2];
    check('順位はスコアの高い順(あかね 412,880 が1位)', /1.*あかね.*412,880.*128/.test(detail.rows[0] || '') && /2.*いぶき.*371,450.*96/.test(detail.rows[1] || ''), JSON.stringify(detail.rows));
    check('選んだ人の判定の数が出る(MARVELOUS〜MISS)', JSON.stringify(detail.counts.map(Number)) === JSON.stringify(wantK), JSON.stringify(detail.counts));
    check('ライフのゲージが出る', /%/.test(detail.life) && parseFloat(detail.life) > 0, detail.life);
    // メンバーに数えない・hb を送らない
    check('観戦の人は部屋のメンバーに入らない(あかね の部屋は2人のまま)', (await A.evaluate(() => RHYTHM_MULTI.view().members.length)) === 2);
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
    // 判定が増えたら「+n」が流れる
    await setHud(focusPage, 420000, 130, wantK.map((n, i) => n + (i === 0 ? 4 : 0)), 900, 63000);
    await W.waitForFunction(() => /\+4 MARVELOUS/.test(document.querySelector('[data-rhythm-watch-detail]').innerText), null, { timeout: 5000 }).then(() => check('判定が増えると「+4 MARVELOUS」が流れる', true), () => check('判定が増えると「+4 MARVELOUS」が流れる', false));
    // 別の人を選ぶと、その人の判定に切り替わる
    const otherId = focusIsA ? idB : idA;
    await W.locator(`[data-rhythm-watch-row="${otherId}"]`).click();
    await W.waitForFunction((k) => { const c = [...document.querySelectorAll('[data-rhythm-watch-count] b')].map((x) => Number(x.textContent)); return JSON.stringify(c) === JSON.stringify(k); }, focusIsA ? [70, 22, 10, 3, 1, 2] : [90, 20, 8, 2, 0, 1], { timeout: 8000 })
      .then(() => check('別の人の名前を押すと、その人の判定に切り替わる', true), () => check('別の人の名前を押すと、その人の判定に切り替わる', false));
    check('切り替えたら、前の人は1秒ごとをやめる', await (async () => { await W.waitForTimeout(4500); const x0 = await sent(focusPage, 'pg'); await W.waitForTimeout(3500); return (await sent(focusPage, 'pg')) - x0 <= 2; })());
    if (SHOT_DIR) {
      await W.screenshot({ path: path.join(SHOT_DIR, 'watch-landscape.png') });
      await W.setViewportSize({ width: 390, height: 844 }); await W.waitForTimeout(700);
      await W.screenshot({ path: path.join(SHOT_DIR, 'watch-portrait.png') });
      await W.setViewportSize({ width: 844, height: 390 }); await W.waitForTimeout(500);
    }
    // 縦・横・小さい端末で、観戦の画面の中身が画面からはみ出さない
    for (const [w, h, label] of [[844, 390, '横'], [390, 844, '縦'], [375, 667, '小さい縦'], [667, 375, '小さい横']]) {
      await W.setViewportSize({ width: w, height: h }); await W.waitForTimeout(500);
      const fit = await W.evaluate(() => { const r = document.querySelector('[data-rhythm-watch]'); const q = r.getBoundingClientRect(); const bad = [...r.querySelectorAll('button')].filter((b) => { const e = b.getBoundingClientRect(); return e.right > innerWidth + 1 || e.left < -1 || e.bottom > innerHeight + 1; }).length; return { bad, sw: r.scrollWidth <= q.width + 1 }; });
      check(`${label}(${w}×${h}): ボタンが画面からはみ出さない・横に伸びない`, fit.bad === 0 && fit.sw, JSON.stringify(fit));
    }
    await W.setViewportSize({ width: 844, height: 390 });

    // ---- 後から入った待機中のメンバー(えま)にも見える ----
    await L.locator('[data-rhythm-mode-private-open]').click();
    await L.locator('[data-rhythm-multi-code-input]').fill(code);
    await L.locator('[data-rhythm-multi-join]').click();
    await L.waitForSelector('[data-rhythm-watch][data-rhythm-watch-phase="playing"]', { timeout: 25000 })
      .then(() => check('演奏中の部屋へ後から入ると、待機のあいだ、その演奏が見える', true), () => check('演奏中の部屋へ後から入ると、待機のあいだ、その演奏が見える', false));
    check('待機のメンバーが入っても、演奏中の部屋は2人のまま(待機の人は演奏の人数に入らない)', (await A.evaluate(() => RHYTHM_MULTI.view().room.participants.length)) === 2);
    const rows3 = await L.evaluate(() => document.querySelectorAll('[data-rhythm-watch-row]').length);
    check('待機のメンバーにも順位が出る', rows3 === 2, `${rows3}行`);
    // 見ている人が2人になっても、見られている人は1秒ごとのまま増えない(1人が1通で、みんなに届く)
    // ---- 観戦の人数は10人まで ----
    await B.evaluate(() => { const topic = window.__topic; const ch = new BroadcastChannel(`fake-ws:${topic}`); for (let i = 0; i < 14; i += 1) ch.postMessage({ t: 'wt', id: `wx${i}`, f: '' }); });
    await A.waitForTimeout(800);
    const count = await A.evaluate(() => RHYTHM_MULTI.watcherCount());
    check('観戦は10人まで(あふれた人は数えない)', count === 10, `${count}人`);
    // ---- 終わりの1通 → 観戦の画面が「終わりました」になる ----
    for (const p of pages) await p.evaluate((id) => RHYTHM_MULTI.reportResult(id, { score: 430000, cleared: true, maxCombo: 130, judgments: { MARVELOUS: 90, EXCELLENT: 20, GREAT: 8, GOOD: 2, BAD: 0, MISS: 1 }, fast: 1, slow: 1 }, false), await A.evaluate(() => RHYTHM_MULTI.view().room.round));
    await W.waitForFunction(() => /演奏が終わりました/.test(document.querySelector('[data-rhythm-watch]').innerText), null, { timeout: 8000 })
      .then(() => check('2人とも終わると、観戦の画面に「演奏が終わりました」が出る', true), () => check('2人とも終わると、観戦の画面に「演奏が終わりました」が出る', false));
    // ---- やめる ----
    await W.locator('[data-rhythm-watch-close]').click();
    await W.waitForTimeout(500);
    check('観戦をやめると画面が閉じる', !(await W.evaluate(() => !!document.querySelector('[data-rhythm-watch]'))));
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
