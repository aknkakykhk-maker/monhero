#!/usr/bin/env node
// MFバトルカードのマルチ対戦(91-card-battle-multi.jsx)を、実際のブラウザの2つのページで最後まで戦わせる(2026-10-24・バトル部・区切り1)。
// 案: docs/spec/card-battle/MULTI_PLAN.md
//
//   node tools/card/card-pvp-browser-check.js
//   run-checks-timeout: 1200(⑰⑮⑭ で、端末が止まる・相手が抜けるのを本当の時間で待つ。合わせて10分を超える)
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
//   ⑧ 入口の「フレンドを招待」でフレンドを選ぶと、部屋を作って招待を送る(表 card_battle_invites へ書く。名簿は window.__mhCardPvpRosterTest・表は偽物)
//   ⑨ 招待された側は、マルチの入口の外でも画面の上に知らせが出る。「断る」で消え、送った側に「断られました」が出る
//   ⑩ もう一度送ると知らせがまた出て、「参加する」でマルチの入口へ移って同じ部屋に入り、対戦が始まる
//   ⑪ 招待のようすの見分け(届いている・時間切れ・断られた)
//   ⑫ 過去の対戦を見る: 確かめが通った試合が2台とも残る・結果の画面の「この対戦を見る」から、はじめ・1手・番ごと・最後まで見られる・相手の手札が表・「とじる」で戻る
//   ⑭ 相手が試合の途中で画面を閉じたら「相手が抜けた」・「もう1戦」は出ない
//   ⑯ 入口の「いま相手を待っている人」: 合言葉の部屋は出ない・だれとでもで待っている人が名前つきで出る・[対戦する]で始まる
//   ⑰ 片方の端末が100秒止まって戻ったら、続きから遊べる(相手は120秒まで待つ・相手の持ち時間の時計は止まる)。最後まで戦える
//   ⑮ 片方の端末が130秒止まったら、相手は120秒で「相手が抜けた」の勝ち・止まっていた側は「通信が切れた」の負け(2台とも勝ちにならない)
//   ⑬ マルチの履歴(92): 2台とも試合が残る・相手のデッキが全部・強さの点数の増減(偽の表)・入口から一覧と相手のデッキが開ける
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
      if (/\/rpc\/card_battle_pvp_report/.test(req.url())) { try { reports.push(JSON.parse(req.postData() || '{}')); } catch (_) { /* 中身が読めない */ } return route.fulfill({ status: 200, contentType: 'application/json', body: '"wait"' }); }
      // 強さの点数の表の自分の行(マルチの履歴の増減・92)。2人が届けた試合だけを数えた偽の点数(勝ち +16・負け -16)
      const ratingOf = /card_battle_pvp_ratings\?.*breeder_id=eq\.([^&]+)/.exec(req.url());
      if (ratingOf) {
        const bid = decodeURIComponent(ratingOf[1]);
        const done = [...new Set(reports.map((x) => x.p_match_id))].filter((m) => reports.filter((x) => x.p_match_id === m).length >= 2).map((m) => reports.find((x) => x.p_match_id === m));
        const mineDone = done.filter((x) => x.p_me === bid || x.p_foe === bid);
        const wins = mineDone.filter((x) => x.p_winner === bid).length, loses = mineDone.length - wins;
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mineDone.length ? [{ rating: 1500 + 16 * (wins - loses), wins, loses }] : []) });
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
    // 吹き出しの文と、顔(相手 A のアイコン。助手の顔の絵を引いて、空の白い枠が出ていた)が、同じときに出ているか。A のアイコンは id なので絵になる
    // ★吹き出しは、だれかがカードを使うと消える(84)。この検査は自動で打つのですぐ消えるので、出ている瞬間をページの中で見張る(2026-10-27 あとから数えて 0 になっていた)
    const chatState = await B.waitForFunction(() => {
      const b = [...document.querySelectorAll('[data-card-bubble]')].find((el) => el.textContent.includes('よろしく！'));
      if (b) window.__chatBubbleSeen = true;
      const icon = b ? b.querySelectorAll('[data-card-bubble-pvp-icon] img').length : 0;
      return icon > 0 ? { seen: true, icon } : false;
    }, null, { timeout: 5000, polling: 'raf' }).then((h) => h.jsonValue()).catch(async () => ({ seen: await B.evaluate(() => window.__chatBubbleSeen === true).catch(() => false), icon: 0 }));
    const chatSeen = chatState.seen, chatIcon = chatState.icon;
    check('⑥ 定型のチャットが、相手の画面の吹き出しに出る・顔は相手のアイコン', chatSeen && chatIcon >= 1, `アイコンの絵 ${chatIcon}`);
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
    // 2台は保存先が別なので、それぞれに入る(2026-10-26 社長: 勝ち +400 は MASTER の2倍・負け +150 は MASTER と同じで勝ちの 3/4)。
    // 勝ちは、その日はじめての勝ちなら +50(助手と対戦と合わせて1日1回)。この検査の端末はその日まだ勝っていないので +450
    const gain = pointAfter.map((v, i) => v - pointBefore[i]);
    // 負けは自分の番の数で減る(3回で45・10回で満額150)。その試合の番の数で決まるので、幅で見る
    const okGain = (r, g) => (r === 'win' ? g === 450 : r === 'lose' ? g >= 45 && g <= 150 : false);
    check('⑥ ビートPが、2台それぞれに増えている(勝ち+400とその日はじめての+50・負けは自分の番の数で45〜150)', okGain(rA, gain[0]) && okGain(rB, gain[1]), `A ${pointBefore[0]} → ${pointAfter[0]}(${rA})・B ${pointBefore[1]} → ${pointAfter[1]}(${rB})`);
    // 結果の画面の「もらったビートP」も、+50 を足した合計
    const shown = [rewardA, rewardB].map((t) => Number(((t || '').match(/もらったビートP:\s*(\d+)/) || [])[1]));
    check('⑥ 結果の画面の「もらったビートP」が、増えた数と同じ', shown[0] === gain[0] && shown[1] === gain[1], `${rewardA} / ${rewardB}`);
    // ⑫ 過去の対戦を見る(93-card-replay.jsx・2026-10-27): 確かめが通った試合は2台とも端末に残り、結果の画面の「この対戦を見る」から、はじめから見られる
    {
      const saved = await Promise.all([A, B].map((page) => page.evaluate(() => { try { const v = JSON.parse(localStorage.getItem('mh_card_replays_v1') || 'null'); return v && Array.isArray(v.list) ? v.list.length : 0; } catch (_) { return -1; } })));
      check('⑫ 確かめが通った試合は、2台とも端末に記録が残る', saved[0] === 1 && saved[1] === 1, saved.join(' / '));
      const btn = A.locator('[data-card-pvp-replay]');
      const hasBtn = await btn.waitFor({ timeout: 5000 }).then(() => true).catch(() => false);
      check('⑫ 結果の画面に「この対戦を見る」が出る', hasBtn);
      if (hasBtn) {
        await btn.click();
        const bar = await A.locator('[data-card-replay-bar]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
        check('⑫ 押すと、対戦の画面で再生の帯が出る', bar);
        const stepText = async () => A.locator('[data-card-replay-step]').innerText().catch(() => '');
        const first = await stepText();
        const foeFaces = await A.locator('[data-card-replay-foe-card] img').count();
        const foeBacks = await A.locator('[data-card-hand-of="1"] img').count();
        check('⑫ はじめから始まり、相手の手札が表で並ぶ(裏の札は出さない)', /^0\//.test(first) && foeFaces >= 5 && foeBacks === 0, `${first} 表${foeFaces} 裏${foeBacks}`);
        await shot(A, 'pvp-12-replay-start');
        await A.locator('[data-card-replay-next]').click();
        await A.locator('[data-card-replay-next]').click();
        const two = await stepText();
        await A.locator('[data-card-replay-prev]').click();
        const one = await stepText();
        check('⑫ 1手すすむ・もどるができる', /^2\//.test(two) && /^1\//.test(one), `${two} → ${one}`);
        for (let i = 0; i < 400; i++) { if (await A.locator('[data-card-replay-next-turn]').isDisabled()) break; await A.locator('[data-card-replay-next-turn]').click(); }
        const last = await stepText();
        const [at, total] = last.replace('手', '').split('/').map(Number);
        check('⑫ 番ごとに進めて、最後の手まで見られる(ルールが同じなので止まらない)', at === total && total > 10 && !(await A.locator('[data-card-replay-stop]').count()), last);
        await shot(A, 'pvp-12-replay-end');
        const noResult = await A.locator('[data-card-top="result"]').count();
        await A.locator('[data-card-replay-first]').click();
        check('⑫ 最後まで見ても、結果の画面へは行かない・⏮ ではじめに戻る', noResult === 0 && /^0\//.test(await stepText()));
        await A.locator('[data-card-replay-exit]').click();
        const back = await A.locator('[data-card-pvp="over"]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
        check('⑫ 「とじる」で、マルチの結果の画面へ戻る', back);
      }
    }
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
    // ⑫ もう1戦(2026-10-26 社長「全部入れる」): 片方が押すと待ちになり、相手には「相手が待っています」。2人とも押すと同じ部屋で次の試合。
    //    前の試合の封・手が混ざらず、最後まで戦えて、確かめも「正しく終わった」になる
    const matchOf = (page) => page.evaluate(() => CARD_PVP.get().match);
    const m1 = await matchOf(A);
    await A.locator('[data-card-pvp-again]').click();
    const waitMine = await A.locator('[data-card-pvp-again="waiting"]').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    const waitFoe = await B.locator('[data-card-pvp-again="foe"]').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    await shot(B, 'pvp-03c-again-foe');
    check('⑫ 「もう1戦」を押すと待ちになり、相手の画面に「相手が待っています」が出る', waitMine && waitFoe);
    await B.locator('[data-card-pvp-again]').click();
    const rematched = await Promise.all([A.locator('[data-card-battle]').waitFor({ timeout: 30000 }), B.locator('[data-card-battle]').waitFor({ timeout: 30000 })]).then(() => true).catch(() => false);
    const m2 = await matchOf(A);
    check('⑫ 2人とも押すと、同じ部屋で次の試合が始まる(試合の印が新しくなる・2台で同じ)', rematched && !!m2 && m2 !== m1 && (await matchOf(B)) === m2, `${m1} → ${m2}`);
    const end12 = Date.now() + 300000;
    while (Date.now() < end12 && !((await A.locator('[data-card-pvp-result]').count()) && (await B.locator('[data-card-pvp-result]').count()))) await A.waitForTimeout(500);
    const r12 = [await A.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null), await B.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null)];
    check('⑫ もう1戦も最後まで戦えて、片方が勝ち・片方が負け', !!r12[0] && !!r12[1] && r12[0] !== r12[1], r12.join(' / '));
    const v12 = [await waitVerify(A), await waitVerify(B)];
    check('⑫ もう1戦も、山札を見せ合って両方で「正しく終わった」(前の試合の封が混ざらない)', v12[0] === 'ok' && v12[1] === 'ok', v12.join(' / '));
    const reward12 = await A.locator('[data-card-pvp-reward]').waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    check('⑫ もう1戦の報酬も出る', reward12);
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
    // マルチの結果の画面にも、自分と相手のアイコンの1行(2026-10-26 社長: 結果の画面にも自分のアイコンを)
    const vsRow = await A.locator('[data-card-result-vs]').innerText().catch(() => '');
    await shot(A, 'pvp-06-result-vs');
    check('⑦ マルチの結果の画面に、自分と相手のアイコン・名前・勝ち負けの1行が出る', /検査ブリーダー/.test(vsRow) && /vs/.test(vsRow) && /勝ち|負け|投了/.test(vsRow), vsRow.replace(/\s+/g, ' '));
    // 相手のアイコン(2026-10-26 本番で「sneguroc」と字が出た): A の画面では B の絵文字、B の画面では A のアイコンの id が絵になって出る。字の id は出ない
    const foeIconA = await A.locator('[data-card-result-vs]').evaluate((el) => ({ fb: (el.querySelector('[data-card-pvp-avatar-fallback]') || {}).innerText || '', text: el.innerText })).catch(() => null);
    const foeIconB = await B.locator('[data-card-result-vs]').evaluate((el) => ({ img: el.querySelectorAll('img').length, fb: !!el.querySelector('[data-card-pvp-avatar-fallback]'), text: el.innerText })).catch(() => null);
    check('⑦ 相手のアイコン: id は絵になり(B の画面)、絵文字は絵文字で出る(A の画面)。id の字はどこにも出ない',
      foeIconA && /🐣/.test(foeIconA.fb) && foeIconB && foeIconB.img >= 1 && !foeIconB.fb && !/snegur/.test(foeIconA.text + foeIconB.text), JSON.stringify({ foeIconA, foeIconB }));
    const iconRule = await A.evaluate(() => [cardPvpIconId('sneguroc'), !!cardPvpIconSrc('sneguroc'), cardPvpIconSrc('zzzzzzzz'), cardPvpIconEmoji('zzzzzzzz'), cardPvpIconEmoji('🐣')].join(','));
    check('⑦ 古い版が8文字で切って送った値も絵に直す・分からない値は字を出さない', /^snegurochka[a-z_]*,true,,,🐣$/.test(iconRule), iconRule);
    check('⑦ だれとでもの対戦も最後まで戦えて、片方が勝ち・片方が負け', !!r2[0] && !!r2[1] && r2[0] !== r2[1], r2.join(' / '));
    for (let i = 0; i < 40 && reports.length - reportsBefore < 2; i++) await A.waitForTimeout(500);
    const mine = reports.slice(reportsBefore);
    check('⑦ 終わったら2台とも、同じ試合・同じ勝った人で強さの点数へ届ける', mine.length === 2 && mine[0].p_match_id && mine[0].p_match_id === mine[1].p_match_id && mine[0].p_winner === mine[1].p_winner,
      JSON.stringify(mine.map((x) => [x.p_match_id, x.p_winner])));
    // ⑬ マルチの履歴(92・2026-10-27 社長「過去のマルチの戦績とかで相手のデッキが見れるように」): 2試合とも端末に残り、相手のデッキが全部見える・点数の増減が書かれる
    const histOf = (page) => page.evaluate(async () => (typeof cardPvpHistoryLoad === 'function' ? cardPvpHistoryLoad() : null));
    let histA = null;
    for (let i = 0; i < 70; i++) { histA = await histOf(A); if (histA && histA.length >= 2 && histA[0].rating) break; await A.waitForTimeout(500); }
    // 試合の数は、ここまでに遊んだ数(合言葉・もう1戦・だれとでも)。前の区切りで試合が増えても落ちないよう、2台で同じ数か・2試合以上かで見る
    const histB = await histOf(B);
    check('⑬ マルチの履歴: 2台とも遊んだ試合が残り(同じ数)、新しい試合が先頭・相手のデッキ(3体と50枚)・自分のデッキ・相手の名前',
      !!histA && histA.length >= 2 && !!histB && histB.length === histA.length && histA[0].match === mine[0].p_match_id && histA.every((x) => x.foeDeck && x.foeDeck.monsters.length === 3 && x.foeDeck.cards.length === 50 && x.myDeck && x.myDeck.cards.length === 50 && x.foe.name === '検査ブリーダー'),
      JSON.stringify((histA || []).map((x) => [x.match, x.outcome, x.verify, x.foeDeck && x.foeDeck.cards.length, x.rating])));
    const deltaA = histA && histA[0].rating ? histA[0].rating.after - histA[0].rating.before : null;
    check('⑬ だれとでもの試合に、強さの点数の増減が書かれる(勝ち +16・負け -16。点数の表は偽物)', deltaA === (histA && histA[0].outcome === 'win' ? 16 : -16), JSON.stringify(histA && histA[0].rating));
    for (const page of [A, B]) { await page.locator('[data-card-pvp-leave]').click(); await page.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 }); }
    await A.locator('[data-card-pvp-history-open]').click();
    await A.locator('[data-card-pvp-history="list"]').waitFor({ timeout: 10000 });
    const rowsText = await A.locator('[data-card-pvp-history-row]').allInnerTexts();
    await shot(A, 'pvp-09-history');
    check('⑬ 入口の「マルチの履歴」で一覧が出る(相手・勝ち負け・日時・増減)', rowsText.length === histA.length && /検査ブリーダー/.test(rowsText[0]) && /(勝ち|負け)/.test(rowsText[0]) && /\d+\/\d+ \d\d:\d\d/.test(rowsText[0]) && /[+-]16/.test(rowsText[0]), JSON.stringify(rowsText));
    await A.locator('[data-card-pvp-history-row]').first().click();
    await A.locator('[data-card-pvp-history="detail"]').waitFor({ timeout: 10000 });
    const foeTiles = await A.evaluate(() => ({ mons: document.querySelectorAll('[data-card-pvp-history-mon]').length, total: [...document.querySelectorAll('[data-card-pvp-history-card]')].reduce((a, el) => a + (Number((el.innerText.match(/×(\d+)/) || [])[1]) || 1), 0) }));
    await shot(A, 'pvp-09-history-deck');
    check('⑬ 行を押すと、相手のデッキ(3体と、同じ札をまとめた50枚)', foeTiles.mons === 3 && foeTiles.total === 50, JSON.stringify(foeTiles));
    await A.locator('[data-card-pvp-history-tab="me"]').click();
    const myTiles = await A.evaluate(() => [...document.querySelectorAll('[data-card-pvp-history-card]')].reduce((a, el) => a + (Number((el.innerText.match(/×(\d+)/) || [])[1]) || 1), 0));
    check('⑬ 「自分のデッキ」で、その試合で使った自分のデッキ(50枚)', myTiles === 50, String(myTiles));
    await A.locator('[data-card-pvp-history="detail"] button').first().click();
    await A.locator('[data-card-pvp-history="list"]').waitFor({ timeout: 10000 });
    await A.locator('[data-card-pvp-history="list"] button').first().click();
    await A.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 });
    // ⑯ いま相手を待っている人の一覧(2026-10-27 社長「マルチで誰かが募集してたりしたらここで見れるようにして」案A):
    //   合言葉の部屋は出ない・だれとでもで待っている人は名前つきで出る・[対戦する]でその人の部屋に入って始まる
    await B.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 });
    await A.locator('[data-card-pvp-create]').click();
    await A.locator('[data-card-pvp="waiting"]').waitFor({ timeout: 10000 });
    await B.waitForTimeout(5000);
    const privCount = Number(await B.locator('[data-card-pvp-seekers]').getAttribute('data-card-pvp-seekers').catch(() => '-1'));
    check('⑯ 合言葉の部屋は、入口の「いま相手を待っている人」に出ない', privCount === 0, String(privCount));
    // 古い版の人の「待っています」(名前もアイコンも無い)は一覧に出さない。だれとでもの自動の組み合わせには使えるよう、受け取ってはおく(2026-10-27 社長 案ア)
    const oldSeen = await B.evaluate(async () => {
      window.__fakeWsRecv('realtime:mhc-lobby-free', { t: 'seek', from: 'cOLDVER1', code: 'QZ7K', at: Date.now() - 5000 }, -1, 'old-version');
      await new Promise((r) => setTimeout(r, 1200));
      return { kept: !!(CARD_PVP.get().seekers || {}).cOLDVER1, rows: document.querySelectorAll('[data-card-pvp-seeker]').length };
    });
    check('⑯ 古い版の人(名前もアイコンも無い)は一覧に出さない(だれとでもで組むために、受け取ってはおく)', oldSeen.kept && oldSeen.rows === 0, JSON.stringify(oldSeen));
    await B.waitForTimeout(6500); // 古い版の知らせが古くなってから(だれとでもで、そちらへ組みに行かないように)
    await A.locator('[data-card-pvp-leave]').click(); await A.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 });
    await A.locator('[data-card-pvp-free]').click();
    const seen16 = await B.locator('[data-card-pvp-seeker]').first().waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    const rowText = seen16 ? await B.locator('[data-card-pvp-seeker]').first().innerText() : '';
    await shot(B, 'pvp-16-seekers');
    check('⑯ だれとでもで待っている人が、入口の一覧に名前つきで出る(押す前に見える)', seen16 && /検査ブリーダー/.test(rowText) && /待って \d+秒/.test(rowText), rowText.replace(/\n/g, ' '));
    if (seen16) await B.locator('[data-card-pvp-seeker-pick]').first().click();
    const met16 = await Promise.all([A.locator('[data-card-battle]').waitFor({ timeout: 30000 }), B.locator('[data-card-battle]').waitFor({ timeout: 30000 })]).then(() => true).catch(() => false);
    check('⑯ 一覧の[対戦する]で、その人の部屋に入って対戦が始まる', met16);
    if (met16) {
      const end16 = Date.now() + 300000;
      while (Date.now() < end16 && !((await A.locator('[data-card-pvp-result]').count()) && (await B.locator('[data-card-pvp-result]').count()))) await A.waitForTimeout(500);
      const r16 = [await A.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null), await B.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null)];
      check('⑯ 一覧から始めた対戦も最後まで戦えて、片方が勝ち・片方が負け', !!r16[0] && !!r16[1] && r16[0] !== r16[1], r16.join(' / '));
      for (const page of [A, B]) { await page.locator('[data-card-pvp-leave]').click(); await page.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 }); }
    }
    // ⑧ フレンドを招待(2026-10-26 社長「マルチ対戦でフレンド招待もいれて」): 入口でフレンドを選ぶ → 部屋を作って招待を送る
    await A.locator('[data-card-pvp-invite-open]').click();
    await shot(A, 'pvp-07-invite-pick');
    await A.locator('[data-card-pvp-invite-pick] [data-card-pvp-invite-to="friend-x"]').click();
    await A.locator('[data-card-pvp="waiting"]').waitFor({ timeout: 10000 });
    const code3 = (await A.locator('[data-card-pvp-room]').innerText()).trim();
    const sentOk = await A.locator('[data-card-pvp-invite-state="live"]').waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    await shot(A, 'pvp-07-invite-send');
    check('⑧ 入口の「フレンドを招待」でフレンドを選ぶと、部屋を作って招待を送る(表へ合言葉と時刻を書く)・「招待しました(あと何秒)」が出る',
      sentOk && invites.length === 1 && invites[0].room_code === code3 && invites[0].target_id === 'friend-x' && !!posts[0].created_at, JSON.stringify(invites));
    // ⑨ 招待された側は、マルチの入口の外(カードのトップ)にいても、上に知らせが出る。「断る」で消え、送った側に「断られました」が出る
    await B.locator('[data-mh-screen] button').first().click().catch(() => {}); // 入口から戻る(マルチの入口を閉じる)
    await B.locator('[data-card-pvp="idle"]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
    const noticeSeen = await B.locator(`[data-card-pvp-notice="${code3}"]`).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    await shot(B, 'pvp-08-invite-notice');
    check('⑨ 招待された側は、マルチの入口の外でも画面の上に知らせが出る(参加する・断る・あと何秒)', noticeSeen && /あと\d+秒/.test(await B.locator('[data-card-pvp-notice]').innerText().catch(() => '')));
    if (noticeSeen) await B.locator('[data-card-pvp-notice-decline]').click();
    const goneAfterDecline = await B.locator('[data-card-pvp-notice]').waitFor({ state: 'detached', timeout: 5000 }).then(() => true).catch(() => false);
    const declinedSeen = await A.locator('[data-card-pvp-invite-state="declined"]').waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    await shot(A, 'pvp-08-invite-declined');
    check('⑨ 「断る」で知らせが消え、表の時刻を古くする・送った側に「断られました」が出る', goneAfterDecline && patches.length >= 1 && declinedSeen, JSON.stringify(patches));
    // ⑩ 送った側が「もう一度」→ 知らせの「参加する」で、カードのマルチの入口へ移って同じ部屋に入り、対戦が始まる
    await A.locator('[data-card-pvp-invite-to="friend-x"]').click();
    const again = await B.locator(`[data-card-pvp-notice="${code3}"]`).waitFor({ timeout: 20000 }).then(() => true).catch(() => false);
    if (again) await B.locator('[data-card-pvp-notice-accept]').click();
    const metInvite = await Promise.all([A.locator('[data-card-battle]').waitFor({ timeout: 30000 }), B.locator('[data-card-battle]').waitFor({ timeout: 30000 })]).then(() => true).catch(() => false);
    check('⑩ もう一度送ると知らせがまた出て、「参加する」で同じ部屋に入り、対戦が始まる', again && metInvite);
    // ⑪ 時間切れ: 送って3分たつと「時間切れ」(表の時刻はそのまま)・断られた形は「断られました」。古い版の相手(時刻を書かない招待)も、届く側は同じに読む
    const st = await A.evaluate(() => { /* eslint-disable no-undef */
      const sent = { code: 'ABCD', at: 1000000 };
      return [cardPvpInviteState(sent, { code: 'ABCD', at: 1000000 }, 1000000 + 60000), cardPvpInviteState(sent, { code: 'ABCD', at: 1000000 }, 1000000 + 3 * 60000 + 1000),
        cardPvpInviteState(sent, { code: 'ABCD', at: null }, 1000000 + 60000), cardPvpInviteState(sent, { code: 'ABCD', at: Date.parse(CARD_PVP_INVITE_DECLINED_AT) }, 1000000 + 60000), cardPvpInviteState(sent, null, 1000000 + 1000)].join(',');
    });
    check('⑪ 招待のようすの見分け(届いている・時間切れ・時刻が読めない行・断られた・表が読めない)', st === 'live,expired,live,declined,live', st);
    const after = await A.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])));
    // 起動のあとに本体が書き足すもの(お話の既読など)は数えない。マルチ対戦は何も保存しない
    const volatile = /^mh_(last_|session|boot|app_open|login|bgm|se_|ui_|debug|daily_login|visit|rhythm_event_story_v1)/;
    const changed = Object.keys(before).filter((k) => !k.startsWith('mh_card_') && !volatile.test(k) && before[k] !== after[k]);
    check('⑤ 実行時エラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
    check('⑤ mh_card_* 以外の保存を書き換えていない', changed.length === 0, changed.slice(0, 5).join(', '));
    // A の画面を ms のあいだまるごと忙しくする(重い・アプリを裏にした。時計も止まる)。止まっているあいだ、A へは何も届かない
    const freezeA = async (ms) => {
      const ix = livePages.indexOf(A); if (ix >= 0) livePages.splice(ix, 1);
      await A.evaluate((n) => { const e = Date.now() + n; while (Date.now() < e) { /* 止まっている */ } }, ms).catch(() => {});
      livePages.push(A);
    };
    const newPrivateMatch = async () => {
      for (const page of [A, B]) { await page.locator('[data-card-pvp-leave]').click(); await page.locator('[data-card-pvp="idle"]').waitFor({ timeout: 10000 }); }
      await A.locator('[data-card-pvp-create]').click();
      await A.locator('[data-card-pvp="waiting"]').waitFor({ timeout: 10000 });
      const code = (await A.locator('[data-card-pvp-room]').innerText()).trim();
      await B.locator('[data-card-pvp-code]').fill(code);
      await B.locator('[data-card-pvp-join]').click();
      await Promise.all([A.locator('[data-card-battle]').waitFor({ timeout: 30000 }), B.locator('[data-card-battle]').waitFor({ timeout: 30000 })]);
      await A.waitForTimeout(3000);
    };
    // ⑰ 片方の端末が100秒止まって戻る(2026-10-27 社長「120秒以内に戻れば続きから遊べる」): 相手は120秒まで待ち、相手の持ち時間の時計も止まるので、
    //   戻ったあと続きから遊べて、最後まで戦える。⑩ で始まった試合のまま
    {
      await freezeA(100000);
      await A.waitForTimeout(3000);
      const mid = [await A.locator('[data-card-pvp-result]').count(), await B.locator('[data-card-pvp-result]').count()];
      check('⑰ 100秒止まって戻っても、どちらも終わっていない(相手は120秒まで待つ)', mid[0] === 0 && mid[1] === 0, mid.join(' / '));
      const end17 = Date.now() + 300000;
      while (Date.now() < end17 && !((await A.locator('[data-card-pvp-result]').count()) && (await B.locator('[data-card-pvp-result]').count()))) await A.waitForTimeout(500);
      await A.waitForTimeout(1500);
      const r17 = [await A.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null), await B.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null)];
      const why17 = (await A.locator('[data-mh-screen]').first().innerText().catch(() => '')).slice(0, 300);
      check('⑰ 戻ったあと続きから遊べて、最後まで戦える(片方が勝ち・片方が負け。抜けた・通信が切れたで終わらない)',
        !!r17[0] && !!r17[1] && r17[0] !== r17[1] && !/相手が抜けた|通信が切れた|相手の時間切れ/.test(why17) && (await A.locator('[data-card-pvp-dropped]').count()) === 0, `${r17.join(' / ')} ${why17.replace(/\n/g, ' ').slice(0, 80)}`);
      await newPrivateMatch();
    }
    // ⑮ 片方の端末が止まった(重い・アプリを裏にした)まま130秒: 相手は120秒で「相手が抜けた」の勝ち。止まっていた側は戻っても相手を「抜けた」と見ず、
    //   「通信が切れた」の負け。2台とも勝ちにならない(2026-10-27 テンケンくんの通し遊び・部長。社長が60秒→120秒)
    {
      const t0 = Date.now();
      const frozen = freezeA(130000);
      let bEndSec = -1;
      for (let i = 0; i < 300 && !(await B.locator('[data-card-pvp-result]').count()); i++) await B.waitForTimeout(500);
      if (await B.locator('[data-card-pvp-result]').count()) bEndSec = Math.round((Date.now() - t0) / 1000);
      check('⑮ 相手は、止まってから120秒ごろに終わる(早く終わらない)', bEndSec >= 115 && bEndSec <= 132, `${bEndSec}秒`);
      await frozen;
      for (let i = 0; i < 60 && !(await A.locator('[data-card-pvp-result]').count()); i++) await A.waitForTimeout(500);
      await A.waitForTimeout(1500);
      const ra = await A.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null);
      const rb = await B.locator('[data-card-pvp-result]').getAttribute('data-card-pvp-result').catch(() => null);
      await shot(A, 'pvp-15-slept-A'); await shot(B, 'pvp-15-slept-B');
      check('⑮ 止まっていた側は戻ると「通信が切れた」の負け(説明の1行つき)・相手は勝ち。2台とも勝ちにならない', ra === 'lose' && rb === 'win' && (await A.locator('[data-card-pvp-dropped]').count()) === 1, `${ra} / ${rb}`);
      check('⑮ 止まっていた側にも「もう1戦」は出ない', (await A.locator('[data-card-pvp-again]').count()) === 0);
      // ⑭ のために、もう一度合言葉の部屋で試合を始める
      await newPrivateMatch();
    }
    // ⑭ 相手が試合の途中で画面を閉じた(「抜けます」が届かないことがある): 相手の時間切れや電波切れで終わっても「相手が抜けた」と出し、「もう1戦」は出さない(2026-10-27 部長)
    //   ⑩ で始まった試合のまま、A の画面を閉じる。閉じる前に、閉じたときの知らせ(bye)が出ないようにしておく
    await A.evaluate(() => { window.__mhCardPvpAuto = false; window.addEventListener('pagehide', (e) => e.stopImmediatePropagation(), true); window.addEventListener('beforeunload', (e) => e.stopImmediatePropagation(), true); }).catch(() => {});
    await A.close({ runBeforeUnload: false });
    // 相手から何も届かなくなってから120秒で決まる(2026-10-27 社長が60秒→120秒)ので、150秒まで待つ
    for (let i = 0; i < 300 && !(await B.locator('[data-card-pvp-result]').count()); i++) await B.waitForTimeout(500);
    await B.waitForTimeout(1500);
    const leftText = (await B.locator('[data-mh-screen]').first().innerText().catch(() => '')).slice(0, 300);
    await shot(B, 'pvp-14-foe-left');
    check('⑭ 相手が画面を閉じて抜けたら、「相手が抜けた」と出る(時間切れと出さない)', /相手が抜けた/.test(leftText) && !/相手の時間切れ/.test(leftText), leftText.replace(/\n/g, ' ').slice(0, 120));
    check('⑭ そのとき「もう1戦」は出ない(待ち続けない)・「部屋を出る」が押せる', (await B.locator('[data-card-pvp-again]').count()) === 0 && (await B.locator('[data-card-pvp-leave]').count()) === 1);
    await ctxA.close(); await ctxB.close();
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
