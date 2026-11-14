// モンヒロビートのマルチで、演奏中に出る「ほかの人の順位・スコア・コンボの札」を、実際に部屋を作って確かめる(2026-11-11)。
//
//   node tools/mode/rhythm-multi-live-board-check.js
//   MH_LIVE_PLAYERS=5 MH_SHOT_DIR=<フォルダ> node tools/mode/rhythm-multi-live-board-check.js   # 5人で止め絵も撮る
//
// 社長「モンビーマルチで演奏中もほかプレイヤーのスコア等みたい。ただし重くなるようならかんがえもの」。見張ること:
//   ・人が2人以上のライブで札が出て、3秒ごとの知らせ(pg)でスコア・コンボ・順位が入れ替わる
//   ・届くたびに行を作り直さない(同じ要素のまま、文字と transform だけが変わる)。部屋の画面の更新(emit)も起こさない
//   ・札が道(台形)にかからない(縦・横・小さい端末。入り切らないときは行を減らす)
//   ・設定で消せる(消しても自分のスコアは送る)。演奏が終わったら札は消える
//
// ★外へはつながない。WebSocket を偽物に差し替え、同じブラウザのページのあいだを BroadcastChannel で中継する
//   (tools/mode/rhythm-multi-layout-check.js と同じ考え方)。
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

const PLAYERS = Math.max(2, Math.min(5, Number(process.env.MH_LIVE_PLAYERS) || 3));
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

const NAMES = ['あかね', 'いぶき', 'うみのブリーダー', 'えま', 'おと'];
const ICONS = ['Mocchi', 'Suezo', 'Pixie', 'Tiger', 'Hare'];

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
    await page.evaluate(() => { setInterval(() => { const d = document.querySelector('[role=dialog]'); if (!d) return; const b = d.querySelector('button[aria-label="次へ"],button[aria-label="閉じる"]') || [...d.querySelectorAll('button')].find((x) => /受け取|閉じる|とじる|OK|(?:始|はじ)める|(?:分|わ)かった|^次へ|あとで|見た/.test(x.innerText)); if (b) b.click(); }, 250); });
    await page.waitForFunction(() => document.querySelector('button.mh-home-facility.rhythm') && !document.querySelector('[role=dialog]'), null, { timeout: 40000 });
    await page.locator('button.mh-home-facility.rhythm').click();
    await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
    await page.waitForTimeout(800);
    return page;
  };
  // 札の様子を読む(見えている行を上から)
  const board = (p) => p.evaluate(() => {
    const box = document.querySelector('[data-rhythm-multi-live]');
    if (!box) return null;
    const b = box.getBoundingClientRect();
    const rows = [...box.querySelectorAll('[data-rhythm-multi-live-row]')].filter((r) => getComputedStyle(r).visibility === 'visible' && getComputedStyle(box).visibility !== 'hidden')
      .map((r) => { const q = r.getBoundingClientRect(); return { id: r.getAttribute('data-rhythm-multi-live-row'), self: r.getAttribute('data-self') === '1', top: Math.round(q.top), left: Math.round(q.left), right: Math.round(q.right), bottom: Math.round(q.bottom),
        rank: r.querySelector('[data-rhythm-multi-live-rank]').textContent, score: r.querySelector('[data-rhythm-multi-live-score]').textContent, combo: r.querySelector('[data-rhythm-multi-live-combo]').textContent,
        cut: [...r.querySelectorAll('b,span')].some((el) => { const e = el.getBoundingClientRect(); return e.width > 0 && (e.right > q.right - 1 || e.left < q.left); }) }; })
      .sort((x, y) => x.top - y.top || x.left - y.left);
    return { total: box.querySelectorAll('[data-rhythm-multi-live-row]').length, rows, box: { left: b.left, top: b.top, right: b.right, bottom: b.bottom } };
  });
  // 自分のスコアとコンボを、演奏画面の「読むだけの窓」の元(hud)へ入れる(検査のためだけ。3秒ごとの送信がこれを読む)
  //   本物の hud は演奏が進むと書き換わる(だれも押さないので0へ戻る)ので、窓の先を決まった値を返す入れ物に差し替える
  const setScore = (p, score, combo) => p.evaluate(([s, c]) => { const fixed = { score: s, combo: c }; RHYTHM_PLAY_WATCH.hud = { get: () => fixed }; }, [score, combo]);
  // 札の四角の中(札は隠して撮る)に、道の白いふちが入っていないか。明るい点の数を返す
  const laneOverlap = async (p, label) => {
    if (!sharp) return null;
    const b = await board(p);
    if (!b || !b.rows.length) return null;
    const scale = SHOT_DIR ? 2 : 1;
    const right = Math.max(...b.rows.map((r) => r.right)); const bottom = Math.max(...b.rows.map((r) => r.bottom));
    const left = Math.min(...b.rows.map((r) => r.left)); const top = Math.min(...b.rows.map((r) => r.top));
    await p.evaluate(() => { document.querySelector('[data-rhythm-multi-live]').style.opacity = '0'; });
    const shot = await p.screenshot();
    await p.evaluate(() => { document.querySelector('[data-rhythm-multi-live]').style.opacity = ''; });
    const region = { left: Math.max(0, Math.round(left * scale)), top: Math.max(0, Math.round(top * scale)), width: Math.round((right - left + 2) * scale), height: Math.round((bottom - top) * scale) };
    const { data, info } = await sharp(shot).extract(region).raw().toBuffer({ resolveWithObject: true });
    let bright = 0;
    for (let i = 0; i < data.length; i += info.channels) if (data[i] > 215 && data[i + 1] > 215 && data[i + 2] > 215) bright += 1;
    if (SHOT_DIR) await p.screenshot({ path: path.join(SHOT_DIR, `live-${label}.png`) });
    return bright;
  };
  try {
    const pages = [];
    for (let i = 0; i < PLAYERS; i += 1) pages.push(await open(NAMES[i], ICONS[i]));
    const [A, B] = pages;
    await A.locator('[data-rhythm-mode-private-open]').click();
    await A.locator('[data-rhythm-multi-create]').click();
    await A.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 15000 });
    const code = (await A.locator('[data-rhythm-multi-room-code]').innerText()).trim();
    for (const p of pages.slice(1)) {
      await p.locator('[data-rhythm-mode-private-open]').click();
      await p.locator('[data-rhythm-multi-code-input]').fill(code);
      await p.locator('[data-rhythm-multi-join]').click();
    }
    await A.waitForFunction((n) => typeof RHYTHM_MULTI !== 'undefined' && RHYTHM_MULTI.view() && RHYTHM_MULTI.view().members.length === n, PLAYERS, { timeout: 30000 });
    await A.locator('[data-rhythm-multi-confirm]').click();
    await A.waitForFunction(() => document.querySelector('[data-rhythm-multi]')?.getAttribute('data-rhythm-multi-step') === 'select', null, { timeout: 15000 });
    await A.locator('[data-rhythm-demo-start]').click();
    for (const p of pages.slice(1)) { await p.waitForSelector('[data-rhythm-multi-omakase]', { timeout: 15000 }); await p.locator('[data-rhythm-multi-omakase]').click(); }
    for (const p of pages) await p.waitForSelector('[data-rhythm-multi-ready]', { timeout: 30000 });
    // 難易度えらびに、札の出し入れのボタンがある(はじめは ON)。B は消しておく
    const toggle = await A.evaluate(() => { const b = document.querySelector('[data-rhythm-multi-live-toggle]'); return b ? { pressed: b.getAttribute('aria-pressed'), text: b.innerText.replace(/\s+/g, ' ').trim(), h: b.getBoundingClientRect().height } : null; });
    check('難易度えらびに「演奏中のみんなのスコア」の切り替えがあり、はじめは ON', !!toggle && toggle.pressed === 'true' && /ON/.test(toggle.text), JSON.stringify(toggle));
    // 部屋の上の帯の 📊 でも同じ値を切り替えられる(2026-11-11 社長「マルチ画面でもオンオフできるようにしたい」)。い は帯のボタンで消す
    const head = await B.evaluate(() => { const b = document.querySelector('[data-rhythm-multi-live-header]'); const r = b && b.getBoundingClientRect(); return b ? { pressed: b.getAttribute('aria-pressed'), text: b.innerText.replace(/\s+/g, ' ').trim(), in: r.width >= 38 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 } : null; });
    check('部屋の上の帯に 📊 の切り替えがあり、はじめは ON・画面に収まる', !!head && head.pressed === 'true' && /ON/.test(head.text) && head.in, JSON.stringify(head));
    if (SHOT_DIR) await A.screenshot({ path: path.join(SHOT_DIR, 'ready-toggle.png') });
    await B.locator('[data-rhythm-multi-live-header]').click();
    await B.waitForFunction(() => document.querySelector('[data-rhythm-multi-live-toggle]')?.getAttribute('aria-pressed') === 'false', null, { timeout: 5000 });
    for (const p of pages) await p.locator('[data-rhythm-multi-ready]').click();
    for (const p of pages) await p.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    await A.waitForSelector('[data-rhythm-multi-live]', { state: 'attached', timeout: 10000 });
    // 演奏画面が出そろって、札の置き場所が決まるまで待つ
    await A.waitForFunction(() => { const b = document.querySelector('[data-rhythm-multi-live]'); return b && getComputedStyle(b).visibility !== 'hidden' && typeof RHYTHM_PLAY_WATCH !== 'undefined' && !!RHYTHM_PLAY_WATCH.hud; }, null, { timeout: 15000 });
    for (const p of pages) await p.waitForFunction(() => typeof RHYTHM_PLAY_WATCH !== 'undefined' && !!RHYTHM_PLAY_WATCH.hud, null, { timeout: 15000 });
    for (const p of pages) await setScore(p, 0, 0);
    const selfId = await A.evaluate(() => RHYTHM_MULTI.view().selfId);
    const first = await board(A);
    check(`${PLAYERS}人のライブで、演奏中の札に全員ぶんの行がある`, !!first && first.total === PLAYERS, first ? `${first.total}行` : '札が無い');
    check('設定で消した人(い)には札が出ない', !(await B.evaluate(() => !!document.querySelector('[data-rhythm-multi-live]'))));
    // 行の要素に印を付けておく(あとで「作り直されていない」ことを確かめる)。部屋の画面の更新の回数も数える
    await A.evaluate(() => { document.querySelectorAll('[data-rhythm-multi-live-row]').forEach((r) => { r.__keep = true; }); window.__emit = 0; RHYTHM_MULTI.subscribe(() => { window.__emit += 1; }); });

    // スコアを入れる: い が1位、あ(自分)が2位、あとは下
    const scores = [398120, 412880, 371450, 256900, 198300].slice(0, PLAYERS);
    const combos = [203, 128, 96, 0, 41].slice(0, PLAYERS);
    for (let i = 0; i < PLAYERS; i += 1) await setScore(pages[i], scores[i], combos[i]);
    await A.waitForFunction(() => { const r = document.querySelector('[data-rhythm-multi-live-row][data-self="1"] [data-rhythm-multi-live-rank]'); return r && r.textContent === '2'; }, null, { timeout: 9000 }).catch(() => {});
    await A.waitForTimeout(3400);
    const b1 = await board(A);
    const want = scores.map((s, i) => ({ s, c: combos[i] })).sort((x, y) => y.s - x.s);
    const wide = b1 && b1.rows.length === PLAYERS;
    check('3秒ごとの知らせで、スコアの高い順に並ぶ(順位・スコア・コンボが合う)', !!b1 && b1.rows.length > 0 && b1.rows.every((r, i) => { const k = Number(r.rank) - 1; return want[k] && r.score === want[k].s.toLocaleString() && r.combo === String(want[k].c) && (i === 0 || Number(b1.rows[i - 1].rank) < Number(r.rank)); }),
      b1 ? b1.rows.map((r) => `${r.rank}位 ${r.score} ${r.combo}`).join(' / ') : '札が無い');
    check('自分の行(あ)に色が付き、2位に出る', !!b1 && b1.rows.some((r) => r.self && r.id === selfId && r.rank === '2'));
    check('札の文字が行からはみ出していない', !!b1 && b1.rows.every((r) => !r.cut));
    check('消した人(い)も自分のスコアは送っている(ほかの人の札に出る)', (await B.evaluate(() => window.__sent.pg || 0)) >= 1 && !!b1 && b1.rows.some((r) => r.score === (412880).toLocaleString()));

    // 逆転: あ が1位になる。行は作り直さず、場所だけ入れ替わる
    await setScore(A, 455000, 260);
    await A.waitForFunction(() => { const r = document.querySelector('[data-rhythm-multi-live-row][data-self="1"] [data-rhythm-multi-live-rank]'); return r && r.textContent === '1'; }, null, { timeout: 9000 }).catch(() => {});
    const b2 = await board(A);
    check('逆転すると、自分の行が1位・いちばん上へ動く', !!b2 && b2.rows[0] && b2.rows[0].self && b2.rows[0].rank === '1' && b2.rows[0].score === (455000).toLocaleString() && b2.rows[0].combo === '260', b2 ? b2.rows.map((r) => `${r.rank}位 ${r.score}`).join(' / ') : '');
    const kept = await A.evaluate(() => ({ rows: [...document.querySelectorAll('[data-rhythm-multi-live-row]')].every((r) => r.__keep === true), emit: window.__emit }));
    check('届くたびに行を作り直していない(同じ要素のまま)', kept.rows);
    check('スコアの知らせでは、部屋の画面の更新(emit)が起きない', kept.emit === 0, `${kept.emit}回`);
    // 送る量: 値が変わらなければ送らない(ここまでで、あ は2回だけ)
    await A.waitForTimeout(3400);
    const sentA = await A.evaluate(() => window.__sent.pg || 0);
    check('値が変わらないあいだは送らない(あ が送ったのは2回)', sentA === 2, `${sentA}回`);
    // 知らない回・参加していない人・とても大きい数は受けない/切る
    // 知らない回の知らせ・部屋にいない人の知らせは受けない(い のページから、同じ通信路へじかに流す)
    await B.evaluate(([rd, bid]) => { const ch = new BroadcastChannel(`fake-ws:${window.__topic}`); ch.postMessage({ t: 'pg', id: bid, r: 'ちがう回', s: 999999999, c: 9 }); ch.postMessage({ t: 'pg', id: 'だれか', r: rd, s: 888888888, c: 9 }); setTimeout(() => ch.close(), 200); },
      [await A.evaluate(() => RHYTHM_MULTI.liveView().round), await B.evaluate(() => RHYTHM_MULTI.view().selfId)]);
    await A.waitForTimeout(500);
    const b3 = await board(A);
    check('知らない回・部屋にいない人のスコアは札に入らない', !!b3 && JSON.stringify(b3.rows.map((r) => r.score)) === JSON.stringify(b2.rows.map((r) => r.score)) && b3.total === PLAYERS);

    // 道にかからないこと(縦・横・小さい端末)。入り切らないときは行が減る
    if (wide !== null) {
      for (const [w, h, label] of [[844, 390, '横'], [390, 844, '縦'], [375, 667, '小さい縦'], [667, 375, '小さい横']]) {
        await A.setViewportSize({ width: w, height: h });
        await A.waitForTimeout(1600);
        const b = await board(A);
        const shown = b ? b.rows.length : 0;
        const bright = await laneOverlap(A, `${PLAYERS}p-${label}`);
        check(`${label}(${w}×${h}): 札が道の白いふちにかからない(${shown}行)`, bright === null || bright <= 2, bright === null ? '測れない(行なし)' : `明るい点 ${bright}`);
        check(`${label}(${w}×${h}): 自分の行は必ず出る・文字がはみ出さない`, shown === 0 || (b.rows.some((r) => r.self) && b.rows.every((r) => !r.cut)), `${shown}行`);
        const need = label === '横' || label === '縦' ? Math.min(PLAYERS, 3) : 2;
        check(`${label}(${w}×${h}): ${need}行以上は出る`, shown >= need, `${shown}行`);
      }
      await A.setViewportSize({ width: 844, height: 390 });
      await A.waitForTimeout(600);
    }

    // 演奏が終わったら札は消え、最後のスコアが1回送られる
    const round = await A.evaluate(() => RHYTHM_MULTI.view().room.round);
    await setScore(A, 470000, 12);
    await A.evaluate((id) => RHYTHM_MULTI.reportResult(id, { score: 470000, cleared: true, maxCombo: 260, judgments: { MARVELOUS: 180, EXCELLENT: 40, GREAT: 11, GOOD: 0, BAD: 0, MISS: 0 }, fast: 1, slow: 1 }, false, { diffId: 'EASY' }), round);
    await A.waitForTimeout(400);
    check('自分の演奏が終わると札は消える', !(await A.evaluate(() => !!document.querySelector('[data-rhythm-multi-live]'))));
    const sentEnd = await A.evaluate(() => ({ pg: window.__sent.pg || 0, res: window.__sent.res || 0 }));
    check('終わりに最後のスコアを1回送り、結果(res)も今までどおり送る', sentEnd.pg === 3 && sentEnd.res === 1, JSON.stringify(sentEnd));
    await A.waitForTimeout(3400);
    check('終わったあとは送らない', (await A.evaluate(() => window.__sent.pg || 0)) === 3);
    check('画面のエラーが出ていない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで進む', false, String(e && e.message ? e.message : e).split('\n')[0]);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
