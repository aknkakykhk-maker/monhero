#!/usr/bin/env node
// MFバトルカードのマルチ対戦の観戦(92-card-pvp-watch.jsx)を、実際のブラウザの3つのページで確かめる(2026-10-27・カード部ナガメくん)。
// 案: docs/progress/card-multi-plus/README.md の「3. 観戦」
//
//   node tools/card/card-pvp-watch-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、観戦の画面と、見られている2人の画面の写真を残す
//
// ★外へはつながない。足場(偽の WebSocket と Node の中継・偽の Supabase)は card-pvp-browser-check.js と同じ。3つのページは別々の保存先
//   A(ホスト)と B が合言葉の部屋で戦い、C(A のフレンド)がマルチ対戦の入口の「フレンドの対戦を観戦する」から途中で見始める
//   ① C の一覧に、対戦中のフレンド(A)の試合が出る(realtime:mhc-live)
//   ② 「見る」で観戦の画面になり、途中からでも、はじめからの手をもらって、いまの場面まで追いつく
//   ③ 見ている人の数が、A と B の対戦の画面に「👀 1」と出る
//   ④ 観戦の画面に、両方の手札は裏の札(枚数だけ)で出る。C の場の山札は全部仮の札
//   ⑤ 観戦の通り道に流れた知らせに、山札・封・デッキの中身の項目が無い。B(ホストでない人)は観戦の通り道へ何も送らない
//   ⑥ 決着すると、観戦の画面に勝った人が出る。A・B の結果も今までどおり(片方が勝ち・片方が負け)
//   ⑦ 観戦をやめると、マルチ対戦の入口へ戻る
//   ⑧ 実行時エラーが無い・C は保存を書き換えない
const http = require('http'), path = require('path'), fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8939;
const SHOT = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
// ページの中の偽の WebSocket(topic ごとに、Node の中継で全部のページへ配る。Realtime と同じく自分にも返す)
const FAKE_WS = () => {
  // __fakeWsDrop(ms) … いまのつながりを切り、ms のあいだは新しくつながらない(電波が切れたふり)
  const all = new Set();
  const subs = {}; // topic → その topic につないでいる偽の WebSocket
  const pageId = `${Date.now()}-${Math.random()}`;
  let nextId = 1;
  // 中継から届いた知らせ。送った本人(同じページの同じつながり)には返さない(自分への返しは send の中で別に出す)
  window.__fakeWsRecv = (topic, payload, fromId, fromPage) => {
    (subs[topic] || []).forEach((w) => { if (!(fromPage === pageId && w.id === fromId)) w.deliver({ topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload } }); });
  };
  window.__fakeWsBlockUntil = 0;
  window.__fakeWsDrop = (ms) => { window.__fakeWsBlockUntil = Date.now() + ms; [...all].forEach((w) => w.close()); };
  class FakeWS {
    constructor() {
      this.readyState = 0; this.topic = null; this.id = nextId++; all.add(this);
      if (Date.now() < window.__fakeWsBlockUntil) { setTimeout(() => { this.readyState = 3; all.delete(this); if (this.onclose) this.onclose({}); }, 50); return; }
      setTimeout(() => { this.readyState = 1; if (this.onopen) this.onopen({}); }, 0);
    }
    deliver(obj) { const data = JSON.stringify(obj); setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0); }
    send(data) {
      const m = JSON.parse(data);
      if (m.event === 'phx_join') {
        this.topic = m.topic;
        (subs[m.topic] = subs[m.topic] || []).push(this);
        this.deliver({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok', response: {} } });
        return;
      }
      if (m.event !== 'broadcast') return;
      const payload = m.payload && m.payload.payload;
      if (this.topic && window.__fakeWsRelay) window.__fakeWsRelay(this.topic, payload, this.id, pageId);
      this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload } });
    }
    close() { if (this.readyState === 3) return; this.readyState = 3; all.delete(this); if (this.topic && subs[this.topic]) subs[this.topic] = subs[this.topic].filter((w) => w !== this); if (this.onclose) this.onclose({}); }
  }
  window.WebSocket = FakeWS;
  window.__mhCardPvpAuto = true;
  window.__mhCardPvpAutoMs = 700;
  window.__mhCardPvpRankTest = true;
  window.__mhCardPvpLineSeed = 1; // 写真に、顔文字の入った負けの台詞(みゅあ)が出るように
  // ★自動操作のブラウザでは、本物の Supabase へ書き込まない仕組みがある(26-supabase.jsx)。この検査は Supabase を偽物に差し替えているので、書き込みも通す
  window.__mhSupabaseStubbed = true;
  window.__mhCardPvpRosterTest = [{ otherId: 'friend-x', userName: 'フレンドX' }];
};
const shot = async (page, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`), style: 'div[style*="2147483647"] > span { display: none !important; }' }).catch(() => {}); } };

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const watchMsgs = []; // 観戦の通り道に流れた知らせ(topic と中身)
  try {
    const livePages = [];
    let relayQueue = Promise.resolve();
    const makeCtx = async (icon) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      await ctx.exposeBinding('__fakeWsRelay', (_src, topic, payload, id, pid) => {
        if (/mhc-watch-|mhc-live/.test(topic)) watchMsgs.push({ topic, payload });
        relayQueue = relayQueue.then(() => Promise.all(livePages.filter((pg) => !pg.isClosed()).map((pg) => pg.evaluate(([t, pl, i, pi]) => { if (window.__fakeWsRecv) window.__fakeWsRecv(t, pl, i, pi); }, [topic, payload, id, pid]).catch(() => {}))));
        return relayQueue;
      });
      await ctx.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: route.request().method() === 'POST' && /rpc/.test(route.request().url()) ? '"wait"' : '[]' }));
      await ctx.addInitScript((ic) => {
        if (localStorage.getItem('mh_onboarded')) return;
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', ic === '🐣' ? 'ビー' : ic === '🦊' ? 'シー' : 'エー'); put('mh_breeder_icon', ic); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
      }, icon);
      await ctx.addInitScript(eventStorySeed());
      await ctx.addInitScript(FAKE_WS);
      return ctx;
    };
    const boot = async (page) => {
      livePages.push(page);
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
      for (let i = 0; i < 6; i++) {
        const b = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK|スキップ/ }).first();
        if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
        await b.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250);
      }
    };
    const openCard = async (page) => {
      await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
      await page.locator('footer button[aria-label=""]').dispatchEvent('click');
      await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
      await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
      await page.locator('[data-debug-card-battle]').dispatchEvent('click');
    };
    const starter = async (page, kit) => {
      await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
      await page.locator(`[data-card-kit="${kit}"]`).click();
      await page.getByRole('button', { name: /にする$/ }).click();
      await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
      await page.locator('[data-card-quit]').click();
      await page.getByRole('button', { name: '飛ばす' }).last().click();
      await page.waitForTimeout(800);
      if (await page.locator('[data-card-top="result"]').count()) await page.getByRole('button').filter({ hasText: /トップ/ }).first().click().catch(() => {});
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    };
    const toLobby = async (page) => {
      await page.locator('[data-card-cpu]').first().click({ timeout: 20000 });
      await page.locator('[data-card-mode-multi]').click();
      await page.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 });
    };
    const [ctxA, ctxB, ctxC] = [await makeCtx('snegurochka_icon'), await makeCtx('🐣'), await makeCtx('🦊')];
    const A = await ctxA.newPage(), B = await ctxB.newPage(), C = await ctxC.newPage();
    await boot(A); await openCard(A); await starter(A, 'speed'); await toLobby(A);
    await A.locator('[data-card-pvp-create]').click();
    await A.locator('[data-card-pvp="waiting"]').waitFor({ timeout: 10000 });
    const code = (await A.locator('[data-card-pvp-room]').innerText()).trim();
    await boot(B); await openCard(B); await starter(B, 'powerful'); await toLobby(B);
    await B.locator('[data-card-pvp-code]').fill(code);
    await B.locator('[data-card-pvp-join]').click();
    await Promise.all([A.locator('[data-card-battle]').waitFor({ timeout: 20000 }), B.locator('[data-card-battle]').waitFor({ timeout: 20000 })]);
    // どちらがホストか(先に部屋を作った A のはず)。C のフレンドは、ホストでない B にする(フレンドが相手側でも見られるか)
    const hostIsA = await A.evaluate(() => { const r = CARD_PVP.get(); return r.me.at < r.foe.at || (r.me.at === r.foe.at && r.me.id < r.foe.id); });
    const bidB = await B.evaluate(() => ensureBreederId());
    // C: 名簿に B だけを入れて(承認済みのフレンドのふり)、マルチ対戦の入口へ。試合が少し進んでから見始める(途中から)
    await C.addInitScript((id) => { window.__mhCardPvpRosterTest = [{ otherId: id, userName: 'ビー' }]; }, bidB);
    await boot(C);
    const beforeC = await C.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])));
    await openCard(C); await starter(C, 'speed'); await toLobby(C);
    const beforeC2 = await C.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])));
    await A.waitForTimeout(6000);
    await C.locator('[data-card-watch-open]').click();
    const row = await C.locator('[data-card-watch-go]').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check('① C の一覧に、対戦中のフレンドの試合が出る', hostIsA && row, `ホストはA: ${hostIsA}`);
    await shot(C, 'watch-01-list');
    await C.locator('[data-card-watch-go]').first().click();
    const caught = await C.waitForFunction(() => { const w = CARD_WATCH.get(); return w.phase === 'watching' && w.n > 0 && w.n >= w.hostN - 1; }, null, { timeout: 15000 }).then(() => true).catch(() => false);
    const w0 = await C.evaluate(() => { const w = CARD_WATCH.get(); return { n: w.n, hostN: w.hostN, side: w.side, phase: w.phase }; });
    check('② 途中から見始めても、はじめからの手をもらって、いまの場面まで追いつく', caught && w0.n >= 3, JSON.stringify(w0));
    check('② フレンド(ホストでない B)が下に出る', w0.side === 1);
    const eyesA = await A.locator('[data-card-pvp-eyes]').waitFor({ timeout: 8000 }).then(() => A.locator('[data-card-pvp-eyes]').getAttribute('data-card-pvp-eyes')).catch(() => null);
    const eyesB = await B.locator('[data-card-pvp-eyes]').waitFor({ timeout: 8000 }).then(() => B.locator('[data-card-pvp-eyes]').getAttribute('data-card-pvp-eyes')).catch(() => null);
    check('③ 見ている人の数が、2人の対戦の画面に「👀 1」と出る', eyesA === '1' && eyesB === '1', `${eyesA} / ${eyesB}`);
    await shot(C, 'watch-02-screen'); await shot(A, 'watch-03-host'); await shot(B, 'watch-04-guest');
    const hid = await C.evaluate(() => { const st = CARD_WATCH.get().st; return { deck: st.players.every((p) => p.deck.every((no) => no === CARD_PVP_HIDDEN)), backs: [0, 1].map((p) => document.querySelectorAll(`[data-card-watch-hand="${p}"] img`).length), hands: st.players.map((p) => p.hand.length) }; });
    check('④ 観戦の画面に、両方の手札が裏の札で出る・山札は全部仮の札', hid.deck && hid.backs.every((n, i) => n === Math.min(7, hid.hands[i])), JSON.stringify(hid));
    // 終わるまで追う(途中で、観戦の場が当てられなくなっていないか)
    const deadline = Date.now() + 300000;
    let broke = '';
    while (Date.now() < deadline) {
      if ((await A.locator('[data-card-pvp-result]').count()) && (await B.locator('[data-card-pvp-result]').count())) break;
      const ph = await C.evaluate(() => CARD_WATCH.get().phase);
      if (ph === 'broken') { broke = await C.evaluate(() => CARD_WATCH.get().error); break; }
      await A.waitForTimeout(500);
    }
    const rA = await A.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null);
    const rB = await B.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null);
    check('⑥ 2人の対戦は今までどおり最後まで戦えて、片方が勝ち・片方が負け', !!rA && !!rB && rA !== rB && !broke, `${rA} / ${rB} ${broke}`);
    const over = await C.locator('[data-card-watch-over]').waitFor({ timeout: 10000 }).then(() => C.locator('[data-card-watch-over]').getAttribute('data-card-watch-over')).catch(() => null);
    // 観戦の見え方は B が下(0)。B が勝ったなら 0、A が勝ったなら 1
    const want = rB === 'win' ? '0' : '1';
    check('⑥ 決着すると、観戦の画面に勝った人が出る', over === want, `${over}(B は ${rB})`);
    await shot(C, 'watch-05-over');
    // ⑤ 流れた知らせ
    const keys = new Set();
    const walk = (v) => { if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => { keys.add(k); walk(x); }); };
    watchMsgs.forEach((m) => walk(m.payload));
    const bad = ['seed', 'salt', 'cards', 'deck', 'st', 'seal', 'guts'].filter((k) => keys.has(k));
    const idB = await B.evaluate(() => CARD_PVP.get().me.id);
    const fromB = watchMsgs.filter((m) => m.payload && m.payload.from === idB).length;
    check('⑤ 観戦の通り道に、山札・封・デッキの中身・場そのものの項目が無い', bad.length === 0 && watchMsgs.length > 0, `${bad.join(',')} / ${watchMsgs.length}通`);
    check('⑤ ホストでない B は、観戦の通り道へ何も送らない', fromB === 0, `${fromB}通`);
    await C.locator('[data-card-watch-leave]').click();
    await C.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 });
    const afterC = await C.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])));
    const changed = Object.keys({ ...beforeC2, ...afterC }).filter((k) => beforeC2[k] !== afterC[k] && !/^mh_(last_|session|boot|app_open|bgm|se_|ui_|debug|visit)/.test(k));
    check('⑦ 観戦をやめると、マルチ対戦の入口へ戻る', true);
    check('⑧ 観戦では保存を書き換えない', changed.length === 0 && !!beforeC, changed.join(', '));
    check('⑧ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
    await ctxA.close(); await ctxB.close(); await ctxC.close();
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
