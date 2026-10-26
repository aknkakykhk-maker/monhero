#!/usr/bin/env node
// MFバトルカードのマルチ対戦(91-card-battle-multi.jsx)を、実際のブラウザの2つのページで最後まで戦わせる(2026-10-24・バトル部・区切り1)。
// 案: docs/spec/card-battle/MULTI_PLAN.md
//
//   node tools/card/card-pvp-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、2つの画面の写真を残す(自分の番・あいての番・守りの番・結果)
//
// ★外へはつながない。WebSocket を偽物に差し替え、2台のページのあいだを Node が中継する(window.__fakeWsRelay → 全部のページの __fakeWsRecv)。
//   2台は別々の保存先(Playwright の別の browser context)で開く(2026-10-26。同じ保存先だと、ビートPを2台がほぼ同時に書いて片方が消えていた。実際の2台と同じ条件にする)
//   自分の番は、検査のときだけの口(window.__mhCardPvpAuto)で、コンピューターの考え方で自動で打つ
//   ① デバッグ設定 → MFバトルカード → 対戦 → マルチ対戦 が押せて、合言葉の部屋を作れる・もう1台が合言葉で入れる
//   ② 2台とも対戦の画面になり、相手の名前とアイコン(助手ではない)が出る・相手の手札は裏のまま
//   ③ 最後まで戦えて、片方が勝ち・片方が負け
//   ④ 終わってから山札を見せ合って、両方で「正しく終わった」になる
//   ⑤ 実行時エラーが無い・保存は mh_card_* 以外を書き換えない(マルチは何も保存しない)
//   ⑥ 区切り2: 持ち時間が出る・定型のチャットが相手の吹き出しに出る・電波が切れても戻って最後まで遊べる(相手には「相手の電波が途切れています」)・
//      終わったら報酬(カードポイント・クイック周回)が出て、カードポイントが増える
//   ⑦ 区切り3: 「だれとでも」で2台が受付から出会い、最後まで戦える(待っている人数が出る)・終わったら2台とも強さの点数へ、同じ試合の結果を届ける
//      (本物の表には送らない。検査は Supabase を偽物にして、届いた中身だけを見る。window.__mhCardPvpRankTest)
//   ⑧ 区切り4: 部屋を作った人が、名簿のフレンドへ招待を送れる(表 card_battle_invites へ書く)・届いた人の画面に「招待が届いています」が出て、
//      「参加する」で同じ部屋に入って対戦が始まる(名簿は window.__mhCardPvpRosterTest・表は偽物)
const http = require('http'), path = require('path'), fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8938;
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
  try {
    // 2台は別々の保存先(context)。偽の Supabase・はじめの保存・偽の WebSocket は、どちらにも同じものを入れる
    const reports = [];
    const invites = [];
    const livePages = [];
    let relayQueue = Promise.resolve(); // 届いた順に配る(2台の手の順番を入れ替えない)
    const makeCtx = async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.exposeBinding('__fakeWsRelay', (_src, topic, payload, id, pid) => {
      relayQueue = relayQueue.then(() => Promise.all(livePages.filter((pg) => !pg.isClosed()).map((pg) => pg.evaluate(([t, pl, i, pi]) => { if (window.__fakeWsRecv) window.__fakeWsRecv(t, pl, i, pi); }, [topic, payload, id, pid]).catch(() => {}))));
      return relayQueue;
    });
    await ctx.route(/supabase\.co/, (route) => {
      const req = route.request();
      if (process.env.DEBUG_PVP && /invite/.test(req.url())) console.log('REQ', req.method(), req.url().slice(0, 140), (req.postData() || '').slice(0, 120));
      if (/\/card_battle_invites/.test(req.url())) {
        if (req.method() === 'POST') { try { const row = JSON.parse(req.postData() || '[]')[0]; invites.push({ ...row, created_at: new Date().toISOString() }); } catch (_) { /* 中身が読めない */ } return route.fulfill({ status: 201, body: '' }); }
        // 届いた側からは「名簿のフレンド(friend-x)から」の招待に見せる(2台とも同じ偽の表を見る)
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(invites.map((x) => ({ sender_id: 'friend-x', room_code: x.room_code, created_at: x.created_at }))) });
      }
      if (/\/rpc\/card_battle_pvp_report/.test(req.url())) { try { reports.push(JSON.parse(req.postData() || '{}')); } catch (_) { /* 中身が読めない */ } return route.fulfill({ status: 200, contentType: 'application/json', body: '"wait"' }); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await ctx.addInitScript(() => {
      if (localStorage.getItem('mh_onboarded')) return;
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
      put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
    });
    await ctx.addInitScript(eventStorySeed());
    await ctx.addInitScript(FAKE_WS);
    return ctx;
    };
    const ctxA = await makeCtx(), ctxB = await makeCtx();
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
      await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
      await page.locator('[data-card-quit]').click();
      await page.getByRole('button', { name: '飛ばす' }).last().click();
      await page.waitForTimeout(800);
    };
    const A = await ctxA.newPage();
    await boot(A);
    const before = await A.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])));
    await openCard(A);
    await starter(A, 'speed');
    const toLobby = async (page) => {
      if (await page.locator('[data-card-top="result"]').count()) await page.getByRole('button', { name: /トップへ|戻る|閉じる/ }).first().click().catch(() => {});
      await page.locator('[data-card-cpu]').first().click({ timeout: 20000 });
      await page.locator('[data-card-mode-multi]').waitFor({ timeout: 10000 });
      const disabled = await page.locator('[data-card-mode-multi]').isDisabled();
      await page.locator('[data-card-mode-multi]').click();
      await page.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 });
      return !disabled;
    };
    let resultVisible = await A.locator('[data-card-top="result"]').count();
    if (resultVisible) await A.getByRole('button').filter({ hasText: /トップ/ }).first().click().catch(() => {});
    const enabled = await toLobby(A);
    await A.locator('[data-card-pvp-create]').click();
    await A.locator('[data-card-pvp="waiting"]').waitFor({ timeout: 10000 });
    const code = (await A.locator('[data-card-pvp-room]').innerText()).trim();
    check('① デバッグから「マルチ対戦」が押せて、合言葉の部屋を作れる', enabled && /^[A-Z2-9]{4}$/.test(code), code);
    await shot(A, 'pvp-01-room');
    const B = await ctxB.newPage();
    await boot(B);
    await openCard(B);
    await starter(B, 'powerful');
    if (await B.locator('[data-card-top="result"]').count()) await B.getByRole('button').filter({ hasText: /トップ/ }).first().click().catch(() => {});
    await B.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    await toLobby(B);
    await B.locator('[data-card-pvp-code]').fill(code);
    await B.locator('[data-card-pvp-join]').click();
    const dump = (page) => page.evaluate(() => { try { const r = CARD_PVP.get(); return JSON.stringify({ phase: r.phase, code: r.code, me: r.me, foe: r.foe, match: r.match, err: r.error }); } catch (e) { return String(e); } });
    try { await Promise.all([A.locator('[data-card-battle]').waitFor({ timeout: 20000 }), B.locator('[data-card-battle]').waitFor({ timeout: 20000 })]); }
    catch (e) { console.log('A:', await dump(A)); console.log('B:', await dump(B)); await shot(A, 'zz-A'); await shot(B, 'zz-B'); throw e; }
    check('① もう1台が合言葉で入れて、2台とも対戦の画面になる', true);
    await A.waitForTimeout(600);
    const foeA = await A.locator('[data-card-pvp-foe]').count();
    const handBacks = await A.evaluate(() => document.querySelectorAll('[data-card-hand-card]').length);
    check('② 相手は助手ではなく、ブリーダーのアイコンと名前で出る', foeA === 1 && (await A.getByText('マルチ対戦').count()) > 0);
    check('② 自分の手札が出る(後攻は始める前に2枚までガッツにするので3〜5枚)', handBacks >= 3 && handBacks <= 5, `${handBacks}枚`);
    // ⑥ 持ち時間・チャット・電波
    check('⑥ 上の帯に持ち時間が出る', (await A.locator('[data-card-pvp-clock]').count()) === 1 && /秒/.test(await A.locator('[data-card-pvp-clock]').innerText()));
    await A.locator('[data-card-pvp-chat]').click();
    await A.locator('[data-card-pvp-stamp="0"]').click();
    const chatSeen = await B.locator('[data-card-bubble]').filter({ hasText: 'よろしく！' }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
    check('⑥ 定型のチャットが、相手の画面の吹き出しに出る', chatSeen);
    await shot(B, 'pvp-04-chat');
    const beatP = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('mh_rhythm_event_points_v1') || '0'));
    const pointBefore = [await beatP(A), await beatP(B)];
    await B.evaluate(() => window.__fakeWsDrop(9000));
    const offSeen = await B.locator('[data-card-pvp-signal]').filter({ hasText: '電波が途切れています' }).waitFor({ timeout: 6000 }).then(() => true).catch(() => false);
    const foeQuietSeen = await A.locator('[data-card-pvp-signal]').filter({ hasText: '相手の電波が途切れています' }).waitFor({ timeout: 12000 }).then(() => true).catch(() => false);
    await shot(A, 'pvp-05-foe-signal');
    check('⑥ 電波が切れると「つなぎ直しています」、相手には「相手の電波が途切れています(あと◯秒)」が出る', offSeen && foeQuietSeen, `${offSeen} / ${foeQuietSeen}`);
    const backSeen = await B.locator('[data-card-pvp-signal]').waitFor({ state: 'detached', timeout: 20000 }).then(() => true).catch(() => false);
    check('⑥ 電波が戻ると、知らせが消えて続きから遊べる', backSeen);
    // 写真: 自分の番・あいての番・守りの番
    const shots = new Set();
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      const doneA = await A.locator('[data-card-pvp-result]').count(), doneB = await B.locator('[data-card-pvp-result]').count();
      if (doneA && doneB) break;
      for (const [page, name] of [[A, 'A'], [B, 'B']]) {
        const mode = await page.locator('[data-card-battle]').getAttribute('data-card-mode').catch(() => null);
        if (mode && ['attack', 'wait', 'guard'].includes(mode) && !shots.has(mode) && SHOT) {
          shots.add(mode);
          const other = page === A ? B : A;
          await Promise.all([shot(page, `pvp-02-${name}-${mode}`), shot(other, `pvp-02-${name === 'A' ? 'B' : 'A'}-with-${mode}`)]);
        }
      }
      await A.waitForTimeout(300);
    }
    const rA = await A.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null);
    const rB = await B.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null);
    check('③ 最後まで戦えて、片方が勝ち・片方が負け', !!rA && !!rB && rA !== rB, `${rA} / ${rB}`);
    const waitVerify = async (page) => { for (let i = 0; i < 40; i++) { const v = await page.locator('[data-card-pvp-verify]').getAttribute('data-card-pvp-verify').catch(() => null); if (v && v !== 'wait') return v; await page.waitForTimeout(250); } return 'wait'; };
    const vA = await waitVerify(A), vB = await waitVerify(B);
    check('④ 終わってから山札を見せ合って、両方で「正しく終わった」', vA === 'ok' && vB === 'ok', `${vA} / ${vB} ${vA !== 'ok' ? await A.locator('[data-card-pvp-verify]').innerText().catch(() => '') : ''}`);
    const rewardA = await A.locator('[data-card-pvp-reward]').waitFor({ timeout: 10000 }).then(() => A.locator('[data-card-pvp-reward]').innerText()).catch(() => '');
    const rewardB = await B.locator('[data-card-pvp-reward]').waitFor({ timeout: 10000 }).then(() => B.locator('[data-card-pvp-reward]').innerText()).catch(() => '');
    const pointAfter = [await beatP(A), await beatP(B)];
    check('⑥ 終わったら、2台とも報酬が出る', /ビートP|ごほうびはありません/.test(rewardA) && /ビートP|ごほうびはありません/.test(rewardB), `${rewardA} / ${rewardB}`);
    // 2台は保存先が別なので、それぞれに入る(勝った台 +200・負けた台 +50。台帳 #119 の対人戦)
    const gain = pointAfter.map((v, i) => v - pointBefore[i]);
    const want = [rA, rB].map((r) => (r === 'win' ? 200 : r === 'lose' ? 50 : null));
    check('⑥ ビートPが、2台それぞれに増えている(勝ち+200・負け+50)', gain[0] === want[0] && gain[1] === want[1], `A ${pointBefore[0]} → ${pointAfter[0]}(${rA})・B ${pointBefore[1]} → ${pointAfter[1]}(${rB})`);
    const lineA = await A.locator('[data-card-pvp-line]').innerText().catch(() => ''), lineB = await B.locator('[data-card-pvp-line]').innerText().catch(() => '');
    check('⑥ 結果の画面で、立ち絵の助手が勝ち・負けの台詞を言う', !!lineA && !!lineB && lineA !== lineB, `${lineA} / ${lineB}`);
    // ⑥ 54本の台詞を、いまの吹き出しと同じ幅・同じ文字に入れて、言葉の途中で折れていないか測る(かたまり1つが2行にまたがっていない)
    const broken = await A.evaluate(() => {
      const bubble = document.querySelector('[data-card-pvp-line]');
      if (!bubble || typeof cardPvpLinePieces !== 'function') return ['(吹き出しが見つからない)'];
      const cs = getComputedStyle(bubble);
      const bad = [];
      Object.entries(CARD_PVP_RESULT_LINES).forEach(([who, scenes]) => Object.values(scenes).forEach((list) => list.forEach(([text]) => {
        const box = document.createElement('div');
        box.className = bubble.className;
        box.style.cssText = `position:fixed;left:0;top:0;visibility:hidden;width:${bubble.getBoundingClientRect().width}px;font:${cs.font};letter-spacing:${cs.letterSpacing}`;
        cardPvpLinePieces(text).forEach((t) => { const sp = document.createElement('span'); sp.className = 'inline-block'; sp.textContent = t; box.appendChild(sp); });
        document.body.appendChild(box);
        // 吹き出しの幅に収まるかたまりは、1行のままのはず(長いかたまりは、言葉の区切りで折れてよい)
        [...box.children].forEach((sp) => {
          const probe = document.createElement('span'); probe.style.whiteSpace = 'nowrap'; probe.textContent = sp.textContent; box.appendChild(probe);
          const fits = probe.getBoundingClientRect().width <= box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          probe.remove();
          if (fits && sp.getBoundingClientRect().height > parseFloat(cs.lineHeight) * 1.5) bad.push(`${who}: ${sp.textContent}`);
        });
        box.remove();
      })));
      return bad;
    });
    check('⑥ 54本の台詞で、吹き出しの幅に収まる言葉のかたまりは、途中で折れない', broken.length === 0, broken.slice(0, 4).join(' / '));
    // 写真: 54本の吹き出しを、いまの幅で並べた1枚(長い台詞がどこで折れるかを目で確かめる)
    if (SHOT) {
      await A.evaluate(() => {
        const bubble = document.querySelector('[data-card-pvp-line]');
        const sheet = document.createElement('div');
        sheet.id = 'pvp-line-sheet';
        sheet.style.cssText = 'position:absolute;left:0;top:0;z-index:99999;background:#1b1438;padding:8px;display:grid;grid-template-columns:repeat(3,auto);gap:6px';
        document.body.appendChild(sheet);
        const names = { mua: 'みゅあ', kiki: 'きき', momosuke: 'もも', dra: 'ドラ', atsu: 'あつ', kyuko: 'きゅうこ' };
        const items = [];
        Object.entries(CARD_PVP_RESULT_LINES).forEach(([who, scenes]) => Object.entries(scenes).forEach(([k, list]) => list.forEach(([text]) => items.push({ who, k, text }))));
        ReactDOM.createRoot(sheet).render(React.createElement(React.Fragment, null, items.map((x, i) => React.createElement('div', { key: i, style: { width: `${bubble.getBoundingClientRect().width}px` } },
          React.createElement('div', { style: { color: '#cbd5e1', fontSize: '10px', fontWeight: 700 } }, `${names[x.who]}・${x.k === 'win' ? '勝ち' : x.k === 'lose' ? '負け' : '抜けた'}`),
          React.createElement('div', { className: bubble.className, style: { borderColor: '#f472b6', ...JA_WRAP_STYLE } }, cardPvpLineNode(x.text))))));
      });
      await A.waitForTimeout(500);
      await A.locator('#pvp-line-sheet').screenshot({ path: path.join(SHOT, 'pvp-08-lines.png') }).catch(() => {});
      await A.evaluate(() => document.getElementById('pvp-line-sheet')?.remove());
    }
    await shot(A, 'pvp-03-A-result'); await shot(B, 'pvp-03-B-result');
    // ⑦ だれとでも: 2台とも部屋を出て、受付から出会う
    const reportsBefore = reports.length;
    for (const page of [A, B]) { await page.locator('[data-card-pvp-leave]').click(); await page.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 }); }
    await A.locator('[data-card-pvp-free]').click();
    await A.locator('[data-card-pvp-seek]').waitFor({ timeout: 10000 });
    const waitingA = await A.locator('[data-card-pvp-waiting]').innerText();
    await shot(A, 'pvp-06-seek');
    await B.locator('[data-card-pvp-free]').click();
    const met = await Promise.all([A.locator('[data-card-battle]').waitFor({ timeout: 30000 }), B.locator('[data-card-battle]').waitFor({ timeout: 30000 })]).then(() => true).catch(() => false);
    check('⑦ 「だれとでも」で、受付から2台が出会って対戦が始まる・待っている人数が出る(自分は数えない)', met && /あなたのほかに \d+人が待っています|ほかに待っている人はいません/.test(waitingA), waitingA);
    const end2 = Date.now() + 300000;
    while (Date.now() < end2 && !((await A.locator('[data-card-pvp-result]').count()) && (await B.locator('[data-card-pvp-result]').count()))) await A.waitForTimeout(500);
    const r2 = [await A.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null), await B.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null)];
    check('⑦ だれとでもの対戦も最後まで戦えて、片方が勝ち・片方が負け', !!r2[0] && !!r2[1] && r2[0] !== r2[1], r2.join(' / '));
    for (let i = 0; i < 40 && reports.length - reportsBefore < 2; i++) await A.waitForTimeout(500);
    const mine = reports.slice(reportsBefore);
    check('⑦ 終わったら2台とも、同じ試合・同じ勝った人で強さの点数へ届ける', mine.length === 2 && mine[0].p_match_id && mine[0].p_match_id === mine[1].p_match_id && mine[0].p_winner === mine[1].p_winner,
      JSON.stringify(mine.map((x) => [x.p_match_id, x.p_winner])));
    // ⑧ フレンドから招待
    for (const page of [A, B]) { await page.locator('[data-card-pvp-leave]').click(); await page.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 }); }
    await A.locator('[data-card-pvp-create]').click();
    await A.locator('[data-card-pvp="waiting"]').waitFor({ timeout: 10000 });
    const code3 = (await A.locator('[data-card-pvp-room]').innerText()).trim();
    await A.locator('[data-card-pvp-invite]').click();
    await A.locator('[data-card-pvp-invite-to="friend-x"]').click();
    const sentOk = await A.locator('[data-card-pvp-invite-to="friend-x"]').filter({ hasText: '招待しました' }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
    await shot(A, 'pvp-07-invite-send');
    check('⑧ 部屋を作った人が、名簿のフレンドへ招待を送れる(表へ合言葉を書く)', sentOk && invites.length === 1 && invites[0].room_code === code3 && invites[0].target_id === 'friend-x', JSON.stringify(invites));
    const acceptSeen = await B.locator(`[data-card-pvp-accept="${code3}"]`).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    await shot(B, 'pvp-07-invite-got');
    check('⑧ 届いた人の画面に「招待が届いています」が出る', acceptSeen);
    if (acceptSeen) await B.locator(`[data-card-pvp-accept="${code3}"]`).click();
    const metInvite = await Promise.all([A.locator('[data-card-battle]').waitFor({ timeout: 30000 }), B.locator('[data-card-battle]').waitFor({ timeout: 30000 })]).then(() => true).catch(() => false);
    check('⑧ 「参加する」で同じ部屋に入って、対戦が始まる', metInvite);
    const after = await A.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])));
    // 起動のあとに本体が書き足すもの(お話の既読など)は数えない。マルチ対戦は何も保存しない
    const volatile = /^mh_(last_|session|boot|app_open|login|bgm|se_|ui_|debug|daily_login|visit|rhythm_event_story_v1)/;
    const changed = Object.keys(before).filter((k) => !k.startsWith('mh_card_') && !volatile.test(k) && before[k] !== after[k]);
    check('⑤ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
    check('⑤ mh_card_* 以外の保存を書き換えていない', changed.length === 0, changed.slice(0, 5).join(', '));
    await ctxA.close(); await ctxB.close();
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
