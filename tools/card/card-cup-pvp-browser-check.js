#!/usr/bin/env node
// MFバトルカード 個人杯のリアルタイム杯: 2台が杯の部屋(91 の CARD_PVP.cup・8文字の合言葉)で戦い、杯へ結果を送るまで(2026-10-31 ブレイブくん・④ 区切り3b)。
//   作りは card-pvp-browser-check.js と同じ(WebSocket を偽物にして2つのページのあいだを Node が中継・自分の番はコンピューターが打つ)。本物へは何も送らない
//
//   node tools/card/card-cup-pvp-browser-check.js
//
//   ① 2台が同じ8文字の合言葉の杯の部屋に入り(a 側・b 側)、マルチ対戦の画面で最後まで戦える
//   ② 終わると、2台とも杯へ結果を送る: how=pvp・確かめ済み(verified)・2台の勝ちの側が同じ・倒した数は a・b の順で同じ
//      手の並びは { kind: 'pvp', order: a 側は ab / b 側は ba, seeds: [自分, 相手], first, acts }
//   ③ 結果の画面に「結果を杯に送りました」が出て、「もう1戦」は出ない・ビートPは増えない・強さの点数へは送らない
//   ④ 「部屋を出る」で杯の画面へ戻る / ⑤ 実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8939;
const SHOT = process.env.SHOT_DIR || '';
const J = (v) => JSON.stringify(v);
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

// カードランクが上がったときの演出(43 の PlayerRankUpFx)は、押すまで画面を覆う。開いていたら2回押して閉じる(演出を飛ばす → 閉じる)
const closeRankFx = async (page) => { for (let i = 0; i < 3 && await page.locator('[data-player-rank-up-fx]').count(); i++) { await page.locator('[data-player-rank-up-fx]').click({ position: { x: 10, y: 10 } }).catch(() => {}); await page.waitForTimeout(400); } };
// マルチの入口で相手を決めるボタンを押し、続くデッキ選びで「対戦へ」を押す(2026-10-30 社長「相手を選んだあとにデッキ選択」。前に使ったデッキが選ばれている)
const pvpGo = async (page, sel) => { await page.locator(sel).first().click(); await page.locator('[data-card-deck-pick-go]').click({ timeout: 10000 }); };

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    // 2台は別々の保存先(context)。偽の Supabase・はじめの保存・偽の WebSocket は、どちらにも同じものを入れる
    const reports = [];
    const cupReports = [];
    const invites = [];
    const posts = [];
    const patches = [];
    const livePages = [];
    let relayQueue = Promise.resolve(); // 届いた順に配る(2台の手の順番を入れ替えない)
    // icon … その台のプロフィールのアイコン(A はアイコンの id・B は絵文字。相手の画面で絵に直って出るかを見る)
    const makeCtx = async (icon = '🐣') => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.exposeBinding('__fakeWsRelay', (_src, topic, payload, id, pid) => {
      relayQueue = relayQueue.then(() => Promise.all(livePages.filter((pg) => !pg.isClosed()).map((pg) => pg.evaluate(([t, pl, i, pi]) => { if (window.__fakeWsRecv) window.__fakeWsRecv(t, pl, i, pi); }, [topic, payload, id, pid]).catch(() => {}))));
      return relayQueue;
    });
    await ctx.route(/supabase\.co/, (route) => {
      const req = route.request();
      if (process.env.DEBUG_PVP && /invite/.test(req.url())) console.log('REQ', req.method(), req.url().slice(0, 140), (req.postData() || '').slice(0, 120));
      if (/\/card_battle_invites/.test(req.url())) {
        // 送る(同じ相手へは上書き。送った時刻があればそれを使う)
        if (req.method() === 'POST') { try { const row = JSON.parse(req.postData() || '[]')[0]; const i = invites.findIndex((x) => x.sender_id === row.sender_id && x.target_id === row.target_id); const next = { ...row, created_at: row.created_at || new Date().toISOString() }; if (i >= 0) invites[i] = next; else invites.push(next); posts.push(next); } catch (_) { /* 中身が読めない */ } return route.fulfill({ status: 201, body: '' }); }
        // 断る(受け手が時刻を古くする)。2台の id は別々でも、偽の表では1行だけなので全部に当てる
        if (req.method() === 'PATCH') { try { const body = JSON.parse(req.postData() || '{}'); invites.forEach((x) => { if (body.created_at) x.created_at = body.created_at; }); patches.push(body); } catch (_) { /* 中身が読めない */ } return route.fulfill({ status: 204, body: '' }); }
        // 送り手が「送った招待のようす」を読むとき(sender_id=eq.)は target_id 付きで返す
        if (/sender_id=eq\./.test(req.url())) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(invites.map((x) => ({ target_id: x.target_id, room_code: x.room_code, created_at: x.created_at }))) });
        // 届いた側からは「名簿のフレンド(friend-x)から」の招待に見せる(2台とも同じ偽の表を見る)
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(invites.map((x) => ({ sender_id: 'friend-x', room_code: x.room_code, created_at: x.created_at }))) });
      }
      if (/\/rpc\/card_cup_live_report/.test(req.url())) { try { cupReports.push(JSON.parse(req.postData() || '{}')); } catch (_) { /* 中身が読めない */ } return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify('ok') }); }
      if (/\/rpc\/card_battle_pvp_report/.test(req.url())) { try { reports.push(JSON.parse(req.postData() || '{}')); } catch (_) { /* 中身が読めない */ } return route.fulfill({ status: 200, contentType: 'application/json', body: '"wait"' }); }
      // 強さの点数の表の自分の行(マルチの履歴の増減・92)。2人が届けた試合だけを数えた偽の点数(勝ち +48・負け -48。同じくらいの相手のときの数・2026-10-28 社長 k=96・800)
      const ratingOf = /card_battle_pvp_ratings\?.*breeder_id=eq\.([^&]+)/.exec(req.url());
      if (ratingOf) {
        const bid = decodeURIComponent(ratingOf[1]);
        const done = [...new Set(reports.map((x) => x.p_match_id))].filter((m) => reports.filter((x) => x.p_match_id === m).length >= 2).map((m) => reports.find((x) => x.p_match_id === m));
        const mineDone = done.filter((x) => x.p_me === bid || x.p_foe === bid);
        const wins = mineDone.filter((x) => x.p_winner === bid).length, loses = mineDone.length - wins;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mineDone.length ? [{ rating: 1500 + 48 * (wins - loses), wins, loses }] : []) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await ctx.addInitScript((ic) => {
      if (localStorage.getItem('mh_onboarded')) return;
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', ic); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
    }, icon);
    await ctx.addInitScript(eventStorySeed());
    await ctx.addInitScript(FAKE_WS);
    await ctx.addInitScript(() => { if (!localStorage.getItem('mh_card_deck_owner_key_v1')) localStorage.setItem('mh_card_deck_owner_key_v1', JSON.stringify('b'.repeat(48))); });
    return ctx;
    };
    const ctxA = await makeCtx('snegurochka_icon'), ctxB = await makeCtx('🐣');
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
    // それぞれの台で: スターターを選び、練習試合は飛ばす(保存先が別なので、2台とも)
    const starter = async (page, kit) => {
      await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
      await page.locator(`[data-card-kit="${kit}"]`).click();
      await page.getByRole('button', { name: /にする$/ }).click();
      await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
      await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
      await page.locator('[data-card-quit]').click();
      await page.getByRole('button', { name: '飛ばす' }).last().click();
      await page.waitForTimeout(800);
    };
    const A = await ctxA.newPage();
    await boot(A);
    await openCard(A);
    await starter(A, 'speed');
    const B = await ctxB.newPage();
    await boot(B);
    await openCard(B);
    await starter(B, 'powerful');
    const pointOf = (page) => page.evaluate(() => Number(JSON.parse(localStorage.getItem('mh_rhythm_event_points_v1') || '0')) || 0);
    const p0 = [await pointOf(A), await pointOf(B)];
    // 杯の部屋へ入る(自分のデッキは杯の写し = ここではゲームの中で作ったデッキ)→ マルチの画面へ
    const enter = async (page, side) => {
      if (await page.locator('[data-card-top="result"]').count()) await page.getByRole('button').filter({ hasText: /トップ/ }).first().click().catch(() => {});
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
      const ok = await page.evaluate((sd) => {
        const deck = cardAiBuildDeck(CARD_BATTLE_DATA, sd ? 'kiki' : 'mua', 'normal', cardAiSeededRand(`cup-pvp-${sd}`));
        return CARD_PVP.cup('ABCDEFGH', { name: sd ? '杯B' : '杯A', icon: '🐣' }, deck, { matchId: 41, cupId: 'clive', side: sd, selfId: sd ? 'pB' : 'pA' });
      }, side);
      await page.locator('[data-card-cpu]').first().click({ timeout: 20000 });
      await page.locator('[data-card-mode-multi]').click();
      return ok;
    };
    const okA = await enter(A, 0), okB = await enter(B, 1);
    check('① 2台が同じ8文字の合言葉の杯の部屋に入れる(a 側・b 側)', okA && okB);
    // 最後まで戦う(自分の番はコンピューターが打つ)
    for (let i = 0; i < 400 && cupReports.length < 2; i++) await A.waitForTimeout(500);
    check('① 最後まで戦えて、2台とも杯へ結果を送る', cupReports.length === 2, String(cupReports.length));
    const [r0, r1] = [cupReports.find((r) => r.p_acts && r.p_acts.order === 'ab') || cupReports[0], cupReports.find((r) => r.p_acts && r.p_acts.order === 'ba') || cupReports[1]];
    check('② how=pvp・確かめ済み・2台の勝ちの側が同じ・倒した数も同じ(a・b の順)', !!r0 && !!r1 && r0.p_how === 'pvp' && r1.p_how === 'pvp' && r0.p_verified === true && r1.p_verified === true
      && r0.p_winner === r1.p_winner && J(r0.p_kos) === J(r1.p_kos) && r0.p_match === 41, J(cupReports.map((r) => ({ w: r.p_winner, v: r.p_verified, k: r.p_kos, o: r.p_acts && r.p_acts.order }))));
    const okActs = (r, order) => r && r.p_acts && r.p_acts.kind === 'pvp' && r.p_acts.order === order && Array.isArray(r.p_acts.seeds) && r.p_acts.seeds.length === 2 && Array.isArray(r.p_acts.acts) && r.p_acts.acts.length > 0;
    check('② 手の並びは a 側が ab・b 側が ba(種は2人分・手がある)', okActs(r0, 'ab') && okActs(r1, 'ba'));
    check('② 2台の種は入れちがい(自分・相手)', !!r0 && !!r1 && r0.p_acts.seeds[0] === r1.p_acts.seeds[1] && r0.p_acts.seeds[1] === r1.p_acts.seeds[0]);
    await A.locator('[data-card-pvp-cup-sent]').waitFor({ timeout: 20000 });
    const sent = await A.locator('[data-card-pvp-cup-sent]').innerText();
    check('③ 結果の画面に「結果を杯に送りました」・「もう1戦」は出ない', /結果を杯に送りました/.test(sent) && await A.locator('[data-card-pvp-again]').count() === 0 && await B.locator('[data-card-pvp-again]').count() === 0, sent);
    await A.waitForTimeout(1500);
    check('③ ビートPは増えない・強さの点数へは送らない', J([await pointOf(A), await pointOf(B)]) === J(p0) && reports.length === 0, `${J(p0)} → ${J([await pointOf(A), await pointOf(B)])}・${reports.length}`);
    await A.getByRole('button', { name: /部屋を出る/ }).first().click();
    await A.locator('[data-card-cup]').waitFor({ timeout: 15000 });
    check('④ 「部屋を出る」で杯の画面へ戻る', true);
    check('⑤ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで回る', false, String(e && e.message || e).slice(0, 300));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
