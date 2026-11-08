// 助手ライフ: フレンドの家との行き来の画面を、本物のゲームを開いて縦・横・🔄横で触って確かめる(56-assistant-life-friend.jsx)。
//   node tools/assistant/assistant-life-friend-browser-check.js [--shots <出力先>]
// Supabase は偽物(表3つ・フレンドの一覧・assistant-chat)。公開の印 assistantLifeFriend はページの中だけで真にする。
//   ① HOME: 施設「🏡 助手ライフ」の札の右上に「🏘 n」。札の字・顔の列・ほかの札に重ならない・画面の外に出ない
//   ② 家: アイコンの列に5つ目「🏘 フレンド」。5つとも字が切れない
//   ③ 「🏘 フレンド」のページ: いまの行き来・置き手紙・フレンドの家・設定。はみ出さない・字が切れない・言葉の途中で折れない
//   ④ 部屋の札「🏘 あおいさんの家へ」が出る・札の字が切れない
//   ⑤ 場面(行った・来た): 名前と台詞が出る・窓が画面に収まる
//   ⑥ 訪ねる(P1〜P3): 部屋4つの並びが切れない・声をかける→返事3択→一言を選んで置き手紙(表に player の行)
//   ⑦ 🔄横(モンヒロビートの中で回す): 行き来の印・帯はモンヒロビートの中に出ない/戻ると HOME の印は器の外に正しく出る
//   ⑧ 公開の印が偽なら、アイコン・印・通信が無い
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9241;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, finishTalk, waitFaces, homeFacesProblems } = require(path.resolve(__dirname, 'life-browser-shared'));
const shotArg = process.argv.indexOf('--shots');
const shotDir = shotArg > 0 ? path.resolve(process.argv[shotArg + 1] || 'friend-shots') : null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
let presenceLife = false; // ⑰ のあいだ、偽サーバーが助手ライフの中の場所を返す
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 偽の Supabase(承認済みのフレンド2人・控え2軒・自分あての置き手紙2通)
const fresh = new Date(Date.now() - 3 * 3600000).toISOString();
const dayKey = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
const HOUSES = [
  { breeder_id: 'aoi-0001', open: true, updated_at: fresh, house: { v: 1, ids: ['mua', 'kiki', 'dra', 'momosuke', 'atsu', 'kyuko', 'sorashido', 'erubin'], r: { mua: { at: 'home', d: 'snack', m: 'happy', fu: { c: 'lantern', w: 'starpic', f: 'sofa' } }, kiki: { p: 'cardroom', at: 'out', d: 'walk', m: 'happy' }, dra: { fu: { f: 'bear', w: 'trophy' }, at: 'home', d: 'idle', m: 'happy' }, momosuke: { at: 'home', d: 'practice', m: 'eager' }, atsu: { at: 'home', d: 'cards', m: 'happy' }, kyuko: { at: 'out', d: 'read', m: 'happy' }, sorashido: { at: 'home', d: 'training', m: 'happy' }, erubin: { at: 'home', d: 'sleep', m: 'sleepy' } }, ac1: { k: 'beat', x: '「風がそよぐ」を遊んだ', at: Date.now() - 3600000 }, dy: [{ t: '10:10', x: '朝: みゅあ・ききが居間でおやつ' }, { t: '09:00', x: 'ドラ セッション → 🎵Lv2' }] } },
  { breeder_id: 'yuto-0001', open: true, updated_at: fresh, house: { v: 1, ids: ['momosuke', 'kyuko'], r: { momosuke: { at: 'home', d: 'snack', m: 'happy' }, kyuko: { at: 'home', d: 'idle', m: 'happy' } } } },
];
const route = (posted) => async (r) => {
  const url = r.request().url(); const method = r.request().method();
  const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: typeof body === 'string' ? body : JSON.stringify(body) });
  if (/assistant_life_friend_switch/.test(url)) return json([{ mode: 'on' }]);
  if (/assistant_life_friend_house_more/.test(url)) {
    if (method !== 'GET') { try { posted.push({ more: JSON.parse(r.request().postData()) }); } catch {} return json('', 201); }
    return json(/aoi-0001/.test(url) ? [{ more: { v: 1, fu: { mua: { p: { c: 'lantern', w: 'starpic', f: 'sofa' }, k: ['bear', 'plant'] }, dra: { p: { w: 'trophy', f: 'bear' }, k: [] } }, ms: { kiki: [{ mo: 'Mocchi', n: 'ごろちゃん', c: ['custom:120:40:85@70', null], l: 1 }, { mo: 'Pandora', n: 'のあ', c: [] }] }, mn: { kiki: 5 }, ac: [{ k: 'masmon', x: '新しいマスモン「ゴーレム」を迎えた', at: Date.now() - 1800000 }, { k: 'beat', x: '「風がそよぐ」を遊んだ', at: Date.now() - 3600000 }], dy: [{ t: '11:00', x: '昼: ももすけ・あつが練習スタジオで練習' }, { t: '10:10', x: '朝: みゅあ・ききが居間でおやつ' }, { t: '09:00', x: 'ドラ セッション → 🎵Lv2' }] }, updated_at: fresh }] : []);
  }
  if (/assistant_life_friend_houses/.test(url)) return method === 'GET' ? json(HOUSES) : json('', 201);
  if (/assistant_life_friend_visits/.test(url)) {
    if (method === 'POST') { try { posted.push(JSON.parse(r.request().postData())); } catch {} return json('', 201); }
    if (method === 'PATCH') return json('', 204);
    const self = (url.match(/host_id\.eq\.([^,)]+)/) || [])[1] || 'x';
    return json([
      { id: 11, kind: 'player', visitor_id: 'aoi-0001', host_id: self, day: dayKey, assistants: ['dra'], word: 1, thanks: null, note: 'ソファふかふかでよかった！', note_to: null, created_at: new Date(Date.now() - 40 * 60000).toISOString() },
      { id: 12, kind: 'go', visitor_id: 'yuto-0001', host_id: self, day: dayKey, assistants: ['momosuke'], word: 4, thanks: 0, created_at: new Date(Date.now() - 90 * 60000).toISOString() },
    ]);
  }
  if (/friend_links/.test(url)) {
    const self = (url.match(/requester_id\.eq\.([^,)&]+)/) || url.match(/eq\.([0-9a-f-]{20,})/) || [])[1] || 'x';
    return json([{ requester_id: self, target_id: 'aoi-0001', status: 'accepted', blocked_by: null, created_at: fresh, updated_at: fresh }, { requester_id: 'yuto-0001', target_id: self, status: 'accepted', blocked_by: null, created_at: fresh, updated_at: fresh }, { requester_id: self, target_id: 'mio-0001', status: 'accepted', blocked_by: null, created_at: fresh, updated_at: fresh }]);
  }
  // いまの状態(friend_profiles の place・records)。あおい=オート周回中(モンヒロビート)/ゆうと=演奏中/みお=ホームを開いたまま25分
  if (/friend_profiles/.test(url) && /select=breeder_id,place/.test(url)) {
    const at = new Date(Date.now() - 60000).toISOString();
    // ⑰ 助手ライフの中の場所(あおい=みゅあの部屋/ゆうと=フレンドの家/みお=みんなの居場所)
    if (presenceLife) return json([{ breeder_id: 'aoi-0001', place: 'other', updated_at: at, records: { pl: 'life', lv: 'h', la: 'mua' } }, { breeder_id: 'yuto-0001', place: 'other', updated_at: at, records: { pl: 'life', lv: 'v' } }, { breeder_id: 'mio-0001', place: 'other', updated_at: at, records: { pl: 'life', lv: 'w' } }]);
    return json([{ breeder_id: 'aoi-0001', place: 'rhythm', updated_at: at, records: { au: 1 } }, { breeder_id: 'yuto-0001', place: 'other', updated_at: at, records: { pl: 'rhythmPlay' } }, { breeder_id: 'mio-0001', place: 'home', updated_at: at, records: { im: 25 } }]);
  }
  if (/friend_profiles|breeder_profiles/.test(url)) return json([{ breeder_id: 'aoi-0001', user_name: 'あおい', last_seen_at: fresh }, { breeder_id: 'yuto-0001', user_name: 'ゆうと', last_seen_at: fresh }, { breeder_id: 'mio-0001', user_name: 'みお', last_seen_at: fresh }]);
  if (/functions\/v1\/assistant-chat/.test(url)) return json({ ok: false, kind: 'tired' });
  return json([]);
};

// 見張り: 範囲の中の nowrap の字が折れていない・切れていない/範囲が画面からはみ出さない
const textProblems = (page, sel) => page.evaluate((s) => {
  const ng = []; const W = window.innerWidth, H = window.innerHeight;
  for (const box of document.querySelectorAll(s)) {
    const b = box.getBoundingClientRect();
    if (b.left < -1 || b.right > W + 1) ng.push(`${s} が横にはみ出す(${Math.round(b.left)}〜${Math.round(b.right)})`);
    for (const el of box.querySelectorAll('.whitespace-nowrap,[data-alf-visit-room] span,.mhl-icons button')) {
      if (!el.offsetParent) continue;
      // 居間の掲示板に入りきらない件は、わざと見えない右の列へ回す作り(見出しに「ほか◯件」)。そこは見ない
      { const bp = el.closest('[data-assistant-life-board-item]'); const bd = el.closest('[data-assistant-life-board]'); if (bp && bd && bp.offsetLeft + 1 >= bd.clientWidth) continue; }
      const rects = [...el.getClientRects()];
      const txt = (el.textContent || '').trim().slice(0, 18);
      if (el.classList.contains('whitespace-nowrap') && new Set(rects.filter(q => q.width > 0).map(q => Math.round(q.top / 4))).size > 1) ng.push(`折れる: ${txt}`);
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') ng.push(`切れる: ${txt}`);
      const r = el.getBoundingClientRect();
      if (r.right > W + 1 || r.left < -1) ng.push(`画面の外: ${txt}`);
      const p = el.parentElement && el.parentElement.closest('button,[data-alf-house],[data-alf-now],[data-alf-note],[data-alf-visit-room],.mhl-icons button');
      if (p && p !== el) { const q = p.getBoundingClientRect(); if (r.right > q.right + 1 || r.left < q.left - 1) ng.push(`枠からはみ出す: ${txt}`); }
    }
    for (const el of box.querySelectorAll('.truncate')) if (el.scrollWidth > el.clientWidth + 1 && !/さんの家/.test(el.textContent || '')) ng.push(`省略された: ${(el.textContent || '').slice(0, 18)}`);
  }
  return ng;
}, sel);
const badgeProblems = (page) => page.evaluate(() => {
  const ng = []; const b = document.querySelector('[data-alf-badge]');
  if (!b) return ['印が無い'];
  const r = b.getBoundingClientRect(); const W = window.innerWidth, H = window.innerHeight;
  if (r.left < 0 || r.right > W || r.top < 0 || r.bottom > H) ng.push('印が画面の外');
  const hit = (a, c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 1;
  const life = document.querySelector('.mh-home-facility.life');
  const label = life && [...life.querySelectorAll('span,p,b')].find(e => /助手ライフ/.test(e.textContent || '') && e.children.length === 0);
  if (label) { const rg = document.createRange(); rg.selectNodeContents(label); for (const t of rg.getClientRects()) if (hit(r, t)) ng.push('印が「助手ライフ」の字にかかる'); }
  for (const f of document.querySelectorAll('[data-assistant-life-home-faces] > div')) if (hit(r, f.getBoundingClientRect())) ng.push('印が顔の列に重なる');
  for (const o of document.querySelectorAll('.mh-home-facility:not(.life)>span,.mh-home-card-battle,.mh-home-assistant,.mh-home-mission,.mh-home-gift,.mh-home-event-badge,.mh-home-event-banner')) if (o.offsetParent && hit(r, o.getBoundingClientRect())) ng.push(`印がほかの札に重なる(${o.className.split(' ')[0]})`);
  return ng;
});

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const shot = async (page, name) => { if (shotDir) await page.screenshot({ path: path.join(shotDir, `${name}.png`) }); };
  const open = async ({ w, h, on = true, stub = [] }) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: shotDir ? 2 : 1 });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    const posted = []; const calls = [];
    page.on('request', q => { if (/assistant_life_friend|assistant-chat/.test(q.url())) calls.push(`${q.method()} ${q.url()}`); });
    // 自動操作の見張り(本物へ書かない)は、行き来の表だけ偽サーバーへ通す
    await page.addInitScript((extra) => { window.__mhSupabaseStubbed = ['assistant_life_friend', ...extra]; }, stub);
    await page.addInitScript(quietBootSeed());
    await page.addInitScript(updateNoticeSeed());
    await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false });
    await page.addInitScript((flag) => { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeFriend = flag; RELEASE_FLAGS.assistantLifeFriendApi = flag; clearInterval(t); } } catch {} }, 2); }, on);
    await page.route(/supabase|functions\/v1/, route(posted));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page);
    return { page, errors, posted, calls };
  };
  const openHouse = async (page) => { await page.locator('[data-home-assistant-life]').click({ timeout: 20000 }).catch(() => {}); await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 8000 }); await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {}); };
  try {
    for (const v of [{ id: 'tate', w: 390, h: 844 }, { id: 'yoko', w: 844, h: 390 }, { id: 'small', w: 375, h: 667 }]) {
      const { page, errors, posted, calls } = await open(v);
      await waitFaces(page);
      await page.locator('[data-alf-badge]').waitFor({ timeout: 8000 }).catch(() => {});
      { const ng = await badgeProblems(page); check(`① HOME の「🏘 n」が札の右上にあり、字・顔・ほかの札に重ならない(${v.w}×${v.h})`, ng.length === 0, ng.join(' / ')); }
      { await page.evaluate(() => { const s = ALF_STORE.state; ALF_STORE.set({ st: { ...s.st, seen: [] }, visits: s.visits.map(x => x) }); });
        const ng = await page.evaluate(async () => { for (let i = 0; i < 30 && !document.querySelector('[data-alf-toast]'); i++) await new Promise(r => setTimeout(r, 100)); const t = document.querySelector('[data-alf-toast]'); if (!t) return ['帯が出ない(この場では出なくてもよい)']; const r = t.getBoundingClientRect(); const hit = (a, c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 1; const out = []; if (r.left < 0 || r.right > window.innerWidth || r.top < 0) out.push('帯が画面の外'); for (const o of document.querySelectorAll('.mh-home-facility>span,.mh-home-card-battle,.mh-home-assistant,.mh-home-mission,.mh-home-gift,.mh-home-event-badge,.mh-home-event-banner,.mh-home-player,[data-assistant-life-home-faces] > div')) if (o.offsetParent && hit(r, o.getBoundingClientRect())) out.push(`帯が重なる(${(o.className || '').toString().split(' ')[0] || 'faces'})`); return out; });
        check(`① HOME の帯は札のすぐ上に出て、吹き出し・札・顔に重ならない(${v.w}×${v.h})`, ng.length === 0 || /出ない/.test(ng[0]), ng.join(' / ')); }
      { const ng = await homeFacesProblems(page); check(`① 顔の列も今のまま崩れない(${v.w}×${v.h})`, ng.length === 0, ng.join(' / ')); }
      check(`① 印は見ていない置き手紙の数(2)`, /🏘 2/.test(await page.locator('[data-alf-badge]').innerText().catch(() => '')));
      await shot(page, `${v.id}-1-home`);
      await openHouse(page);
      check(`② アイコンの列に5つ目「🏘 フレンド」(${v.id})`, (await page.locator('[data-assistant-life-icon]').count()) === 5 && (await page.locator('[data-assistant-life-icon="visit"]').count()) === 1);
      { const ng = await textProblems(page, '[data-assistant-life-icons]'); check(`② アイコン5つの字が切れない(${v.id})`, ng.length === 0, ng.join(' / ')); }
      // 助手がフレンドの家へ行っている状態にして部屋の札を見る
      await page.evaluate(() => { const l = ASSISTANT_LIFE_STORE.state.life; const st = ALF_STORE.state.st; ALF_STORE.set({ st: { ...st, day: assistantLifeDayKey(), go: 1, went: { 'aoi-0001': 1 }, out: { abs: l.abs, day: assistantLifeDayKey(), ids: ['atsu'], host: 'aoi-0001', name: 'あおい', theirs: ['dra', 'atsu'], word: 0, seen: false, rewarded: false } } }); ASSISTANT_LIFE_STORE.emit(); });
      await page.waitForTimeout(300);
      const tag = await page.locator('[data-assistant-life-room-away="atsu"]').innerText().catch(() => '');
      check(`④ 部屋の札「🏘 あおいさんの家へ」(${v.id})`, /🏘 あおいさんの家へ/.test(tag), tag.replace(/\n/g, ' '));
      { const sub = await page.locator('[data-assistant-life-today-sub]').innerText().catch(() => ''); check(`④ 出かけている助手を「声をかける」の相手にしない(${v.id})`, !/あつ/.test(sub), sub); }
      { const ng = await page.evaluate(() => { const el = document.querySelector('[data-assistant-life-room-away="atsu"] b'); if (!el) return ['札が無い']; const r = el.getBoundingClientRect(); const room = el.closest('[data-assistant-life-room]').getBoundingClientRect(); return [...(el.getClientRects().length > 1 ? ['札の字が折れる'] : []), ...(r.right > room.right + 1 || r.left < room.left - 1 ? ['札の字が部屋からはみ出す'] : []), ...(el.scrollWidth > el.clientWidth + 1 ? ['札の字が切れる'] : [])]; }); check(`④ 札の字が折れない・切れない(${v.id})`, ng.length === 0, ng.join(' / ')); }
      await shot(page, `${v.id}-2-room-tag`);
      await page.locator('[data-assistant-life-icon="visit"]').click();
      await page.locator('[data-alf-page="on"]').waitFor({ timeout: 8000 });
      await page.locator('[data-alf-house]').first().waitFor({ timeout: 8000 }).catch(() => {});
      await page.locator('[data-alf-note]').first().waitFor({ timeout: 8000 }).catch(() => {});
      check(`③ ページにいまの行き来・置き手紙2通・フレンドの家2軒・設定5つ(${v.id})`, (await page.locator('[data-alf-now-out]').count()) === 1 && (await page.locator('[data-alf-note]').count()) === 2 && (await page.locator('[data-alf-house]').count()) === 2 && (await page.locator('[data-alf-setting]').count()) === 5);
      { const ng = await textProblems(page, '[data-alf-page]'); check(`③ ページがはみ出さない・字が切れない・言葉の途中で折れない(${v.id})`, ng.length === 0, [...new Set(ng)].join(' / ')); }
      check(`③ 置き手紙に「訪ねてくれた」「ドラと話した」とお礼の3択(${v.id})`, /訪ねてくれた/.test(await page.locator('[data-alf-notes]').innerText()) && /ドラと話した/.test(await page.locator('[data-alf-notes]').innerText()) && (await page.locator('[data-alf-thanks]').count()) === 3);
      check(`③ 家が届いていないフレンド(みお)は薄く並び「みおさんが助手ライフを開くと遊びに行けます」(${v.id})`, (await page.locator('[data-alf-house-waiting="mio-0001"]').count()) === 1 && /みおさんが助手ライフを開くと遊びに行けます/.test(await page.locator('[data-alf-house-waiting="mio-0001"]').innerText().catch(() => '')));
      check(`⑫ 届いた置き手紙に自由文が出て、「この人の自由文を見ない」がある(${v.id})`, /ソファふかふかでよかった/.test(await page.locator('[data-alf-notes]').innerText()) && (await page.locator('[data-alf-note-off="aoi-0001"]').count()) === 1);
      check(`⑭ 一覧の札に、その人の最近の1行が出る(${v.id})`, /風がそよぐ/.test(await page.locator('[data-alf-house="aoi-0001"] [data-alf-house-act]').innerText().catch(() => '')));
      await shot(page, `${v.id}-3-page`);
      await page.evaluate(() => { const el = document.querySelector('[data-alf-houses]'); if (el) el.scrollIntoView({ block: 'start' }); });
      await shot(page, `${v.id}-3b-page-houses`);
      // 場面
      await page.locator('[data-alf-act="out"]').click();
      await page.locator('[data-alf-scene="go"]').waitFor({ timeout: 5000 });
      { const ng = await page.evaluate(() => { const el = document.querySelector('[data-alf-scene] > div'); const r = el.getBoundingClientRect(); const out = []; if (r.top < 0 || r.bottom > window.innerHeight + 1 || r.left < 0 || r.right > window.innerWidth + 1) out.push('窓が画面の外'); if (document.querySelectorAll('[data-alf-scene-line]').length < 2) out.push('台詞が2行より少ない'); if (/[{}]/.test(el.textContent)) out.push('穴が残る'); return out; }); check(`⑤ 場面の窓が収まり、台詞2行以上・穴が残らない(${v.id})`, ng.length === 0, ng.join(' / ')); }
      await page.waitForTimeout(400);
      await shot(page, `${v.id}-4-scene`);
      await page.locator('[data-alf-scene-close]').click();
      // 訪ねる
      await page.locator('[data-alf-house="aoi-0001"] [data-alf-act="look"]').click();
      await page.locator('[data-alf-visit]').waitFor({ timeout: 5000 });
      { const ng = await textProblems(page, '[data-alf-visit]'); check(`⑥ 訪ねた家の部屋の並びがはみ出さない・字が切れない(${v.id})`, ng.length === 0, [...new Set(ng)].join(' / ')); }
      // 「仲良し度 +10」などの知らせ(右上の .mh-gfx-chips)が、部屋の名前・顔・吹き出しを隠さない
      // 知らせは画面が組み替わると置き直す(44-growth-fx の MutationObserver)。置き直すまで少し待ってから測る
      const chipNg = async () => { await page.waitForTimeout(400); return chipNgNow(); };
      const chipNgNow = async () => page.evaluate(() => { const hit = (a, c) => Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 1; const out = []; for (const ch of document.querySelectorAll('.mh-gfx-chip')) { const r = ch.getBoundingClientRect(); if (!r.width) continue; for (const el of document.querySelectorAll('[data-alf-visit] .mhl-room .pl,[data-alf-visit] .mhl-room [data-assistant-life-room-face],[data-alf-visit-talk] p,[data-alf-visit-replies] button,[data-alf-visit-title],[data-alf-visit-words] .mhl-sheet button,[data-alf-visit-sheet] .mhl-sheet button')) if (hit(r, el.getBoundingClientRect())) out.push((el.textContent || el.getAttribute('data-alf-face') || '').trim().slice(0, 10)); } return out; });
      { const ng = await chipNg(); check(`⑥ 仲良し度の知らせが、訪ねた家の部屋の名前・顔を隠さない(${v.id})`, ng.length === 0, ng.join(' / ')); }
      await shot(page, `${v.id}-5-visit`);
      check(`⑥ 訪ねた家は自分の家と同じ家の絵(部屋8つ・名札「あおいさんの家」)・できることの札・置き手紙で何が届くかの1行(${v.id})`, (await page.locator('[data-alf-visit] [data-assistant-life-house] .mhl-room').count()) === 8 && /あおいさんの家/.test(await page.locator('[data-alf-visit] [data-assistant-life-hname]').innerText()) && (await page.locator('[data-alf-visit-acts]').count()) === 1 && /届きます/.test(await page.locator('[data-alf-visit-note]').innerText()));
      await page.locator('[data-alf-visit] [data-assistant-life-room="kiki"]').click();
      await page.locator('[data-alf-visit-sheet="kiki"]').waitFor({ timeout: 3000 });
      check(`⑥ おでかけ中の部屋も押せて、「おでかけ中」と分かる(${v.id})`, (await page.locator('[data-alf-visit-room-state="out"]').count()) === 1);
      check(`⑯ 出かけている助手は行き先が分かる(部屋の札「🃏 カード部屋へ」・シート)(${v.id})`, /(カード部屋|MFバトルカード)へ/.test(await page.locator('[data-alf-visit] [data-assistant-life-room="kiki"]').innerText()) && /(カード部屋|MFバトルカード)へおでかけ中/.test(await page.locator('[data-alf-visit-room-state]').innerText()));
      check(`⑱ 部屋のシートに、その人の助手のマスモン(写し)が絵つきで出る・勇者モンに⭐・「ほか3体」と列の最後に「+3」(${v.id})`, (await page.locator('[data-alf-visit-masmon-one]').count()) === 2 && /⭐ごろちゃん/.test(await page.locator('[data-alf-visit-masmon]').innerText()) && (await page.locator('[data-alf-visit-masmon-one] img').count()) >= 2 && /ほか3体/.test(await page.locator('[data-alf-visit-masmon-more]').innerText().catch(() => '')) && /\+3/.test(await page.locator('[data-alf-visit-masmon-plus]').innerText().catch(() => '')));
      { const ng = await textProblems(page, '[data-alf-visit-masmon]'); check(`⑱ マスモンの名前がはみ出さない(${v.id})`, ng.length === 0, [...new Set(ng)].join(' / ')); }
      check(`⑯ 部屋のシートに「贈られた家具: まだありません」(${v.id})`,  /贈られた家具: まだありません/.test(await page.locator('[data-alf-visit-furn]').innerText()));
      check(`⑭ 訪ねた家の掲示板に、その人の最近(迎えたマスモン・遊んだ曲)が出る(${v.id})`, /ゴーレム/.test(await page.locator('[data-alf-visit]').innerText()));
      await shot(page, `${v.id}-5b-visit-out`);
      await page.locator('[data-alf-visit-sheet] .mhl-sheet button:has-text("とじる")').click();
      {
        await page.locator('[data-alf-visit] [data-assistant-life-board]').click();
        await page.locator('[data-alf-visit-diary-all]').waitFor({ timeout: 3000 });
        const all = await page.locator('[data-alf-visit-diary-all]').innerText();
        check(`⑫ 掲示板を押すと、その家の最近と今日あったことが全部見られる(${v.id})`, /練習スタジオ/.test(all) && /ゴーレム/.test(all) && /風がそよぐ/.test(all), all.slice(0, 120));
        await shot(page, `${v.id}-5d-visit-diary`);
        await page.locator('[data-alf-visit-diary-all] [data-mhl-sheet-close]').click(); }
      await page.locator('[data-alf-visit] [data-assistant-life-room="mua"]').click();
      await page.locator('[data-alf-visit-sheet="mua"]').waitFor({ timeout: 3000 });
      check(`⑱ 写しの無い助手の部屋には、マスモンの段を出さない(見ている人のマスモンを出さない)(${v.id})`, (await page.locator('[data-alf-visit-masmon]').count()) === 0);
      check(`⑫ くわしい控えの押し入れが部屋のシートに出る(${v.id})`, /押し入れ/.test(await page.locator('[data-alf-visit-kept]').innerText().catch(() => '')));
      await shot(page, `${v.id}-5c-visit-kept`);
      await page.locator('[data-alf-visit-sheet] .mhl-sheet button:has-text("とじる")').click();
      await page.locator('[data-alf-visit] [data-assistant-life-room="dra"]').click();
      await page.locator('[data-alf-visit-room="dra"]').click();
      await page.locator('[data-alf-visit-replies]').waitFor({ timeout: 3000 });
      { const ng = await chipNg(); check(`⑥ 仲良し度の知らせが、声をかけた吹き出し・返事を隠さない(${v.id})`, ng.length === 0, ng.join(' / ')); }
      await shot(page, `${v.id}-6-visit-talk`);
      await page.locator('[data-alf-reply="0"]').click();
      await page.locator('[data-alf-visit-room-note="dra"]').click();
      await page.locator('[data-alf-visit-words]').waitFor({ timeout: 3000 });
      await shot(page, `${v.id}-6b-visit-words`);
      await page.locator('[data-alf-note-free]').fill('ID: aoi_1234567 で');
      check(`⑫ 自由文に連絡先を書くと理由が出て、一言を押せない(${v.id})`, (await page.locator('[data-alf-note-warn]').count()) === 1 && await page.locator('[data-alf-word="1"]').isDisabled());
      { const ng = await chipNg(); check(`⑫ 仲良し度の知らせが、置き手紙のシートのボタンを隠さない(${v.id})`, ng.length === 0, ng.join(' / ')); }
      await shot(page, `${v.id}-6d-visit-warn`);
      await page.locator('[data-alf-note-free]').fill('ソファふかふかでよかった！');
      await shot(page, `${v.id}-6c-visit-free`);
      await page.locator('[data-alf-word="1"]').click();
      await page.locator('[data-alf-visit-note="done"]').waitFor({ timeout: 5000 });
      { const pl2 = posted.filter(p => p.kind === 'player'); check(`⑫ 置き手紙に自由文が乗る(あて先はドラ・家にいるのであて先つき)(${v.id})`, pl2.length === 1 && pl2[0].note === 'ソファふかふかでよかった！' && pl2[0].note_to === 'dra', JSON.stringify(pl2)); }
      const pl = posted.filter(p => p.kind === 'player');
      check(`⑥ 声をかける→返事→一言を選んで置き手紙(player・ドラ・一言1)(${v.id})`, pl.length === 1 && JSON.stringify(pl[0].assistants) === '["dra"]' && pl[0].word === 1, JSON.stringify(pl) + ' ' + calls.filter(c => /visits/.test(c)).map(c => c.slice(0, 60)).join(' | '));
      { const ng = await textProblems(page, '[data-alf-visit]'); check(`⑥ 置き手紙のあとも字が切れない(${v.id})`, ng.length === 0, [...new Set(ng)].join(' / ')); }
      await shot(page, `${v.id}-7-visit-left`);
      check(`ページの中でエラーが出ない(${v.id})`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
    // ⑩ フレンドのプロフィールの「🏘 家へ遊びに行く」(2026-11-08 社長)
    for (const v of [{ id: 'tate', w: 390, h: 844 }, { id: 'yoko', w: 844, h: 390 }]) {
      const { page, errors } = await open(v);
      await waitFaces(page);
      await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
      await page.waitForSelector('[data-profile-friends]', { timeout: 15000 });
      await page.evaluate(() => document.querySelector('[data-profile-friends]').click());
      await page.locator('[data-friend-row="mio-0001"]').waitFor({ timeout: 15000 });
      await page.waitForFunction(() => document.querySelectorAll('[data-friend-presence-auto]').length >= 2, null, { timeout: 8000 }).catch(() => {});
      { const t = await page.locator('[data-friend-row]').allInnerTexts();
        check(`⑮ フレンドの一覧に「⚡ オート周回中」+下の行(周回中・開いたまま25分)と「🎵 演奏中」(${v.id})`, t.some(x => /あおい/.test(x) && /オート周回中/.test(x)) && t.some(x => /みお/.test(x) && /ホームを開いたまま 25分 操作なし/.test(x)) && t.some(x => /ゆうと/.test(x) && /演奏中/.test(x)), t.join(' | ').slice(0, 200)); }
      await shot(page, `${v.id}-11-presence-list`);
      await page.locator('[data-friend-row="mio-0001"]').click();
      await page.waitForFunction(() => document.querySelector('[data-friend-presence-sub]'), null, { timeout: 8000 }).catch(() => {});
      check(`⑮ プロフィールの名前の下にも「⚡ オート周回中」+「ホームを開いたまま 25分 操作なし」(${v.id})`, /オート周回中/.test(await page.locator('[data-friend-presence]').first().innerText().catch(() => '')) && /ホームを開いたまま 25分 操作なし/.test(await page.locator('[data-friend-presence-sub]').first().innerText().catch(() => '')));
      await shot(page, `${v.id}-11b-presence-profile`);
      await page.locator('[data-alf-profile-visit]').waitFor({ timeout: 10000 });
      await page.waitForFunction(() => document.querySelector('[data-alf-profile-visit-why]') && !/読み込んで/.test(document.querySelector('[data-alf-profile-visit-why]').innerText), null, { timeout: 8000 }).catch(() => {});
      check(`⑩ 家が届いていないフレンドのプロフィールは、押せない入口と「みおさんが助手ライフを開くと遊びに行けます」(${v.id})`, await page.locator('[data-alf-profile-visit-go]').isDisabled() && /みおさんが助手ライフを開くと遊びに行けます/.test(await page.locator('[data-alf-profile-visit]').innerText()));
      await page.locator('[data-alf-profile-visit]').scrollIntoViewIfNeeded();
      await shot(page, `${v.id}-10-profile-blocked`);
      await page.getByRole('button', { name: 'フレンド一覧へ戻る' }).first().click();
      await page.locator('[data-friend-row="yuto-0001"]').click();
      await page.locator('[data-alf-profile-visit="ok"]').waitFor({ timeout: 10000 });
      { const ng = await textProblems(page, '[data-alf-profile-visit]'); check(`⑩ 入口がはみ出さない(${v.id})`, ng.length === 0, [...new Set(ng)].join(' / ')); }
      await page.locator('[data-alf-profile-visit]').scrollIntoViewIfNeeded();
      await shot(page, `${v.id}-10b-profile-ok`);
      await page.locator('[data-alf-profile-visit-go]').click();
      await page.locator('[data-alf-visit]').waitFor({ timeout: 5000 });
      { const ng = await page.evaluate(() => { const r = document.querySelector('[data-alf-visit]').getBoundingClientRect(); return r.top < -1 || r.left < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.width < innerWidth - 2 ? [`${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`] : []; });
        check(`⑩ プロフィールから開いた家は画面いっぱいに出る(${v.id})`, ng.length === 0, ng.join(' / ')); }
      check(`⑩ プロフィールから開いたのはゆうとさんの家(${v.id})`, /ゆうとさんの家/.test(await page.locator('[data-alf-visit-title]').innerText()));
      await shot(page, `${v.id}-10c-profile-house`);
      await page.locator('[data-alf-visit-close]').click();
      check(`⑩ もどると同じプロフィールに戻る(${v.id})`, (await page.locator('[data-alf-visit]').count()) === 0 && (await page.locator('[data-alf-profile-visit="ok"]').count()) === 1);
      check(`ページの中でエラーが出ない(${v.id})`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
    // ⑮ 「フレンド」→「追加」の「いまの状態をフレンドに見せる」(縦・横・小さい画面)
    for (const v of [{ id: 'tate', w: 390, h: 844 }, { id: 'yoko', w: 844, h: 390 }, { id: 'small', w: 375, h: 667 }]) {
      const { page, errors } = await open(v);
      await waitFaces(page);
      await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
      await page.waitForSelector('[data-profile-friends]', { timeout: 15000 });
      await page.evaluate(() => document.querySelector('[data-profile-friends]').click());
      if (v.id === 'small') {
        await page.locator('[data-friend-row="aoi-0001"]').waitFor({ timeout: 15000 });
        await page.waitForFunction(() => document.querySelectorAll('[data-friend-presence-auto]').length >= 2, null, { timeout: 8000 }).catch(() => {});
        { const ng = await page.evaluate(() => { const out = []; for (const el of document.querySelectorAll('[data-friend-row] [data-friend-presence], [data-friend-row] [data-friend-presence-sub]')) { const r = el.getBoundingClientRect(); if (r.right > innerWidth + 1 || r.left < -1) out.push(el.textContent); } return out; });
          check(`⑮ 小さい画面の一覧で、いまの状態の字がはみ出さない(${v.id})`, ng.length === 0, ng.join(' / ')); }
        await shot(page, `${v.id}-11-presence-list`);
      }
      await page.locator('button, [role="tab"]').filter({ hasText: /^追加$/ }).first().click();
      await page.locator('[data-friend-presence-setting]').waitFor({ timeout: 8000 });
      check(`⑮ 「追加」に「いまの状態をフレンドに見せる」のチェック(${v.id})`, /いまの状態をフレンドに見せる/.test(await page.locator('[data-friend-presence-setting]').innerText()) && await page.locator('[data-friend-presence-setting] input[type="checkbox"]').isChecked());
      await page.locator('[data-friend-presence-setting]').scrollIntoViewIfNeeded();
      await shot(page, `${v.id}-11c-presence-setting`);
      check(`ページの中でエラーが出ない(${v.id})`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
    // ⑦ 🔄横: モンヒロビートの中で回す
    for (const v of [{ id: 'rot390', w: 390, h: 844 }, { id: 'rot375', w: 375, h: 667 }]) {
      const { page, errors } = await open(v);
      await waitFaces(page);
      await page.locator('[data-alf-badge]').waitFor({ timeout: 8000 }).catch(() => {});
      await page.locator('.mh-home-facility.rhythm').click({ timeout: 10000 });
      await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 });
      await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(1200);
      check(`⑦ 🔄横のモンヒロビートの中に、行き来の印・帯が出ない(${v.id})`, (await page.locator('[data-alf-badge],[data-alf-toast]').count()) === 0);
      await shot(page, `${v.id}-8-beat`);
      await page.getByRole('button', { name: '戻る' }).first().click({ timeout: 5000 });
      await page.locator('.mh-home-player').waitFor({ timeout: 15000 }); await page.waitForTimeout(1200);
      const rotNow = await page.evaluate(() => RHYTHM_VIEW_ROTATION.active());
      { const ng = rotNow ? [] : await badgeProblems(page); check(`⑦ 戻った HOME で印が正しい所に出る(${v.id})`, ng.length === 0, ng.join(' / ')); }
      await shot(page, `${v.id}-9-home-back`);
      check(`ページの中でエラーが出ない(${v.id})`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
    // ⑰ 助手ライフにいるフレンドは、そこで何をしているかが分かる(2026-11-08 社長・案A)
    for (const v of [{ id: 'tate', w: 390, h: 844 }, { id: 'yoko', w: 844, h: 390 }, { id: 'small', w: 360, h: 640 }]) {
      presenceLife = true;
      const { page, errors } = await open({ ...v, stub: ['friend_profiles'] });
      const sent = []; page.on('request', q => { if (q.method() === 'POST' && /friend_profiles\?on_conflict/.test(q.url())) { try { sent.push(JSON.parse(q.postData())[0]); } catch {} } });
      await waitFaces(page);
      await page.evaluate(() => document.querySelector('.mh-home-player')?.click());
      await page.waitForSelector('[data-profile-friends]', { timeout: 15000 });
      await page.evaluate(() => document.querySelector('[data-profile-friends]').click());
      await page.locator('[data-friend-row="mio-0001"]').waitFor({ timeout: 15000 });
      await page.waitForFunction(() => /みゅあの部屋/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
      { const t = await page.locator('[data-friend-row]').allInnerTexts();
        check(`⑰ フレンドの一覧に短い形「🏡 みゅあの部屋」「🏘 フレンドの家へ」「📋 みんなの居場所」(${v.id})`, t.some(x => /あおい/.test(x) && /🏡 みゅあの部屋/.test(x)) && t.some(x => /ゆうと/.test(x) && /🏘 フレンドの家へ/.test(x)) && t.some(x => /みお/.test(x) && /📋 みんなの居場所/.test(x)), t.join(' | ').slice(0, 200));
        const ng = await textProblems(page, '[data-friend-row]'); check(`⑰ 一覧の字がはみ出さない(${v.id})`, ng.length === 0, [...new Set(ng)].join(' / ')); }
      await shot(page, `${v.id}-17-life-list`);
      await page.locator('[data-friend-row="aoi-0001"]').click();
      await page.waitForFunction(() => /のぞいている/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
      check(`⑰ プロフィールは文の形「🏡 みゅあの部屋をのぞいている」(${v.id})`, /🏡 みゅあの部屋をのぞいている/.test(await page.locator('[data-friend-presence]').first().innerText().catch(() => '')));
      await shot(page, `${v.id}-17b-life-profile`);
      if (await page.locator('[data-alf-profile-visit="ok"]').count()) {
        await page.locator('[data-alf-profile-visit-go]').click();
        await page.locator('[data-alf-visit]').waitFor({ timeout: 5000 });
        await page.waitForFunction(() => document.querySelector('[data-alf-visit-now]'), null, { timeout: 8000 }).catch(() => {});
        check(`⑰ 訪ねた家の見出しは、横は文の形「いま 🏡 みゅあの部屋をのぞいている」・縦は札に収まる短い形「いま 🏡 みゅあの部屋」(${v.id})`, (v.w > v.h ? /いま 🏡 みゅあの部屋をのぞいている/ : /^いま 🏡 みゅあの部屋$/).test(await page.locator('[data-alf-visit-now]').innerText().catch(() => '')));
        await shot(page, `${v.id}-17c-life-visit`);
        // 自分が訪ねているあいだは lv=v を送る(持ち主の名前は送らない)
        await page.waitForFunction(() => true); for (let i = 0; i < 40 && !sent.some(b => b && b.records && b.records.lv === 'v'); i++) await page.waitForTimeout(500);
        const bv = sent.filter(b => b && b.records && b.records.lv === 'v').pop();
        check(`⑰ 訪ねているあいだ、自分の状態は lv=v で送る・持ち主の名前やidは載せない(${v.id})`, !!bv && bv.place === 'other' && bv.records.pl === 'life' && !/aoi|あおい/.test(JSON.stringify(bv.records)), String(JSON.stringify(sent.map(b => b && b.records && [b.place, b.records.pl, b.records.lv]))).slice(0, 200));
        await page.locator('[data-alf-visit-close]').click();
      } else check(`⑰ あおいさんの家へ行ける(${v.id})`, false, 'data-alf-profile-visit="ok" が無い');
      check(`ページの中でエラーが出ない(${v.id})`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
      presenceLife = false;
    }
    // ⑰ 自分の家で部屋を開くと lv=h・la=その助手 を送る
    {
      const { page, errors } = await open({ w: 390, h: 844, stub: ['friend_profiles'] });
      const sent = []; page.on('request', q => { if (q.method() === 'POST' && /friend_profiles\?on_conflict/.test(q.url())) { try { sent.push(JSON.parse(q.postData())[0]); } catch {} } });
      await waitFaces(page);
      await openHouse(page);
      await page.locator('[data-assistant-life-room="mua"]').first().click().catch(() => {});
      for (let i = 0; i < 40 && !sent.some(b => b && b.records && b.records.la === 'mua'); i++) await page.waitForTimeout(500);
      const bh = sent.filter(b => b && b.records && b.records.lv === 'h').pop();
      check('⑰ 自分の家でみゅあの部屋を開くと lv=h・la=mua を送る', !!bh && bh.records.la === 'mua' && bh.records.pl === 'life', JSON.stringify(sent.map(b => b && b.records && [b.records.pl, b.records.lv, b.records.la])).slice(0, 200));
      await page.evaluate(() => storeSet(FRIEND_PRESENCE_SHOW_KEY, false)).catch(() => {});
      await page.locator('[data-mhl-sheet-close]').first().click({ timeout: 3000 }).catch(() => {});
      await page.locator('[data-assistant-life-icon="where"]').click({ timeout: 8000 });
      const n0 = sent.length; for (let i = 0; i < 40 && sent.length === n0; i++) await page.waitForTimeout(500);
      const off = sent.slice(n0).pop();
      check('⑰ 「いまの状態をフレンドに見せる」が切なら、場所の印(lv・la)を送らない', !!off && !(off.records && (off.records.lv || off.records.la)) && off.place === 'other', String(JSON.stringify(off && [off.place, off.records && off.records.lv])).slice(0, 120));
      check('ページの中でエラーが出ない(⑰ 自分の家)', errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
    // ⑧ 印が偽
    {
      const { page, calls } = await open({ w: 390, h: 844, on: false });
      await waitFaces(page); await page.waitForTimeout(1500);
      const badge = await page.locator('[data-alf-badge]').count();
      await openHouse(page);
      check('⑧ 印が偽なら、HOME の印・5つ目のアイコンが無く、行き来の通信もしない', badge === 0 && (await page.locator('[data-assistant-life-icon="visit"]').count()) === 0 && calls.length === 0, `印${badge} 通信${calls.length}`);
      await page.close();
    }
  } catch (e) { check('最後まで動く', false, String(e && e.message || e).slice(0, 300)); }
  await browser.close(); server.close();
  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
