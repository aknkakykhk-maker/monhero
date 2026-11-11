#!/usr/bin/env node
// 助手ライフ: フレンドの家の「行く意味・来てもらう意味」を実際のブラウザで見る(56-assistant-life-friend-bond.jsx・2026-11-11)。
//   node tools/assistant/assistant-life-friend-bond-browser-check.js [--shots <出力先>]
// 公開の印 assistantLifeFriendBond を真にした画面(縦・横・小さい縦)と、偽にした画面を見る。通信は偽の Supabase(本物へ書かない)。
//   ① HOME に「🚪 ◯◯さんの△△が来ています」・迎えるまで出る
//   ② 「🏘 フレンド」に 📖 お客さん帳(だれが・何をしたか・届いたすてき・🤝 スタンプ +1・返しに行く)と 🏆 お気に入りの棚
//   ③ 訪ねた家に友情の帯。話す・部屋を見る・置き手紙の3つで今日のスタンプ1個(同じ日にもう1回やっても増えない)
//   ④ 友情のシート: 見どころ・「💗 すてき」(表へ場所の印だけ・1軒1日3つ)・相手のお気に入りの棚。字が切れない・はみ出さない
//   ⑤ 次に訪ねると、増えた家具に NEW
//   ⑥ 保存は新しいキーだけ(mh_assistant_life_friend_bond_v1・_fav_v1)。今の mh_assistant_life_friend_v1 の形は変えない
//   ⑧ 来てくれた日のスタンプは「公開の時」から数える(それより前に書かれた表の行は数えない)
//   ⑦ 印が偽なら、帯・帳・棚・印が無く、すてきの表へ通信しない
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9247;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces } = require(path.resolve(__dirname, 'life-browser-shared'));
const shotArg = process.argv.indexOf('--shots');
const shotDir = shotArg > 0 ? path.resolve(process.argv[shotArg + 1] || 'friend-bond-shots') : null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const fresh = new Date(Date.now() - 3 * 3600000).toISOString();
const dayKey = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
const acAt = Date.now() - 3600000;
const HOUSES = [
  { breeder_id: 'aoi-0001', open: true, updated_at: fresh, house: { v: 1, ids: ['mua', 'kiki', 'dra', 'momosuke'], r: { mua: { at: 'home', d: 'snack', m: 'happy', fu: { c: 'lantern', f: 'sofa' } }, kiki: { p: 'cardroom', at: 'out', d: 'walk', m: 'happy' }, dra: { at: 'home', d: 'idle', m: 'happy', fu: { f: 'bear' } }, momosuke: { at: 'home', d: 'practice', m: 'happy' } } } },
  { breeder_id: 'yuto-0001', open: true, updated_at: fresh, house: { v: 1, ids: ['momosuke', 'kyuko'], r: { momosuke: { at: 'home', d: 'snack', m: 'happy' }, kyuko: { at: 'home', d: 'idle', m: 'happy' } } } },
];
const route = (posted, env) => async (r) => {
  const url = r.request().url(); const method = r.request().method();
  const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: typeof body === 'string' ? body : JSON.stringify(body) });
  if (/assistant_life_friend_switch/.test(url)) return json([{ mode: 'on' }]);
  if (/assistant_life_friend_likes/.test(url)) {
    if (method === 'POST') { try { posted.push({ like: JSON.parse(r.request().postData()) }); } catch {} return json('', 201); }
    return json([{ id: 31, visitor_id: 'aoi-0001', host_id: 'x', day: dayKey, spot: 'f:mua:f', created_at: new Date(Date.now() - 30 * 60000).toISOString() }, { id: 32, visitor_id: 'aoi-0001', host_id: 'x', day: dayKey, spot: 'bad spot <b>', created_at: fresh }]);
  }
  if (/assistant_life_friend_house_more/.test(url)) {
    if (method !== 'GET') { try { posted.push({ more: JSON.parse(r.request().postData()) }); } catch {} return json('', 201); }
    return json(/aoi-0001/.test(url) ? [{ more: { v: 1, fu: { mua: { p: { c: 'lantern', f: 'sofa', ...(env.newFurn ? { w: 'starpic' } : {}) }, k: [] }, dra: { p: { f: 'bear' }, k: [] } }, ms: { dra: [{ mo: 'Mocchi', n: 'ごろちゃん', c: [], l: 1 }] }, dy: [], ac: [{ k: 'beat', x: '「風がそよぐ」を遊んだ', at: acAt }],
      fv: { a: 'dra', m: { aid: 'dra', mo: 'Mocchi', n: 'ごろちゃん', c: [] }, s: '風がそよぐ', fn: 12, x: '<script>' } } }] : []);
  }
  if (/assistant_life_friend_houses/.test(url)) return method === 'GET' ? json(HOUSES) : json('', 201);
  if (/assistant_life_friend_visits/.test(url)) {
    if (method === 'POST') { try { posted.push(JSON.parse(r.request().postData())); } catch {} return json('', 201); }
    if (method === 'PATCH') return json('', 204);
    const self = (url.match(/host_id\.eq\.([^,)]+)/) || [])[1] || 'x';
    return json([
      { id: 11, kind: 'player', visitor_id: 'aoi-0001', host_id: self, day: dayKey, assistants: ['dra'], word: 1, thanks: null, note: '', note_to: null, created_at: new Date(Date.now() - 40 * 60000).toISOString() },
      { id: 12, kind: 'go', visitor_id: 'yuto-0001', host_id: self, day: dayKey, assistants: ['momosuke'], word: 4, thanks: 0, created_at: new Date(Date.now() - 90 * 60000).toISOString() },
    ]);
  }
  if (/friend_links/.test(url)) {
    const self = (url.match(/requester_id\.eq\.([^,)&]+)/) || url.match(/eq\.([0-9a-f-]{20,})/) || [])[1] || 'x';
    return json([{ requester_id: self, target_id: 'aoi-0001', status: 'accepted', blocked_by: null, created_at: fresh, updated_at: fresh }, { requester_id: 'yuto-0001', target_id: self, status: 'accepted', blocked_by: null, created_at: fresh, updated_at: fresh }]);
  }
  if (/friend_profiles/.test(url) && /select=breeder_id,place/.test(url)) return json([]);
  if (/friend_profiles|breeder_profiles/.test(url)) return json([{ breeder_id: 'aoi-0001', user_name: 'あおい', last_seen_at: fresh }, { breeder_id: 'yuto-0001', user_name: 'ゆうと', last_seen_at: fresh }]);
  if (/functions\/v1\/assistant-chat/.test(url)) return json({ ok: false, kind: 'tired' });
  return json([]);
};
// 範囲の中の字が折れない・切れない・画面からはみ出さない
const textProblems = (page, sel) => page.evaluate((s) => {
  const ng = []; const W = window.innerWidth, H = window.innerHeight;
  for (const box of document.querySelectorAll(s)) {
    const b = box.getBoundingClientRect();
    if (b.left < -1 || b.right > W + 1) ng.push(`${s} が横にはみ出す`);
    if (b.top < -1 || b.bottom > H + 1) ng.push(`${s} が縦にはみ出す(${Math.round(b.top)}〜${Math.round(b.bottom)}/${H})`);
    for (const el of box.querySelectorAll('.whitespace-nowrap,button,b,small')) {
      if (!el.offsetParent) continue;
      const txt = (el.textContent || '').trim().slice(0, 18); const r = el.getBoundingClientRect();
      if (el.classList.contains('whitespace-nowrap') && new Set([...el.getClientRects()].filter(q => q.width > 0).map(q => Math.round(q.top / 4))).size > 1) ng.push(`折れる: ${txt}`);
      if (r.right > W + 1 || r.left < -1) ng.push(`画面の外: ${txt}`);
    }
  }
  return ng;
}, sel);

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
  const open = async ({ w, h, on = true }) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: shotDir ? 2 : 1 });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    const posted = []; const calls = []; const env = { newFurn: false };
    page.on('request', q => { if (/assistant_life_friend_likes/.test(q.url())) calls.push(`${q.method()} ${q.url()}`); });
    await page.addInitScript(() => { window.__mhSupabaseStubbed = ['assistant_life_friend']; });
    await page.addInitScript(quietBootSeed());
    await page.addInitScript(updateNoticeSeed());
    await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false });
    await page.addInitScript((flag) => { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeFriend = true; RELEASE_FLAGS.assistantLifeFriendApi = true; RELEASE_FLAGS.assistantLifeFriendBond = flag; clearInterval(t); } } catch {} }, 2); }, on);
    await page.route(/supabase|functions\/v1/, route(posted, env));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page);
    return { page, errors, posted, calls, env };
  };
  const openHouse = async (page) => { await page.locator('[data-home-assistant-life]').click({ timeout: 20000 }).catch(() => {}); await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 8000 }); await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {}); };
  const openPage = async (page) => { await openHouse(page); await page.locator('[data-assistant-life-icon="visit"]').click(); await page.locator('[data-alf-page="on"]').waitFor({ timeout: 8000 }); await page.locator('[data-alf-house]').first().waitFor({ timeout: 8000 }).catch(() => {}); };
  const visitAoi = async (page) => { await page.locator('[data-alf-house="aoi-0001"] [data-alf-act="look"]').click(); await page.locator('[data-alf-visit]').waitFor({ timeout: 5000 }); await page.locator('[data-alb-bar]').waitFor({ timeout: 5000 }); await page.waitForTimeout(400); };
  const closeRoom = async (page) => { const c = page.locator('[data-alf-visit-roomview-close]'); if (await c.count()) await c.first().click(); else await page.locator('[data-alf-visit-sheet] .mhl-sheet button:has-text("とじる")').first().click().catch(() => {}); await page.waitForTimeout(150); };
  try {
    for (const v of [{ id: 'tate', w: 390, h: 844 }, { id: 'yoko', w: 844, h: 390 }, { id: 'small', w: 375, h: 667 }, { id: 'yokoS', w: 667, h: 375, from: { w: 844, h: 390 } }]) {
      // 小さい横(667×375)は、HOME から家までを 844×390 で開いてから画面を縮める(見るのは訪ねた家とシート)
      const { page, errors, posted, calls, env } = await open(v.from ? { ...v, ...v.from } : v);
      await waitFaces(page);
      await page.locator('[data-alf-badge]').waitFor({ timeout: 8000 }).catch(() => {});
      // 検査の偽の行は「いま」より前の時刻なので、公開の時(ALB_START.at)を 0 にして数える(公開の時より前を数えないことは ⑧ で見る)
      await page.evaluate(() => { ALB_START.at = 0; });
      // ① 来ている最中の印(来客を1人入れる)
      await page.evaluate(() => { const st = alfToday(); alfSaveSt({ ...st, come: 1, came: [{ host: 'aoi-0001', name: 'あおい', aid: 'erubin', mine: 'atsu', seen: false }] }); });
      await page.locator('[data-alb-here]').waitFor({ timeout: 6000 }).catch(() => {});
      { const t = await page.locator('[data-alb-here]').innerText().catch(() => ''); check(`① HOME に「🚪 あおいさんのえるびんが来ています」(${v.id})`, /あおいさんのえるびんが来ています/.test(t), t);
        const ng = await page.evaluate(() => { const r = document.querySelector('[data-alb-here]').getBoundingClientRect(); return r.left < 0 || r.right > window.innerWidth || r.top < 0 || r.bottom > window.innerHeight ? ['画面の外'] : []; }).catch(() => ['無い']); check(`① 印が画面に収まる(${v.id})`, ng.length === 0, ng.join(' / ')); }
      await shot(page, `${v.id}-1-home-here`);
      // ② お客さん帳・お気に入りの棚
      await openPage(page);
      await page.locator('[data-alb-guests] [data-alb-guest]').first().waitFor({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);
      { const t = await page.locator('[data-alb-guests]').innerText().catch(() => '');
        check(`② お客さん帳に あおいさん(ドラと話した・置き手紙・届いたすてき)と ゆうとさん(ももすけが遊びに来た)(${v.id})`, /あおいさん/.test(t) && /ドラと話した/.test(t) && /置き手紙/.test(t) && /💗すてき/.test(t) && /ゆうとさん/.test(t) && /ももすけが遊びに来た/.test(t), t.replace(/\n/g, ' ').slice(0, 200));
        check(`② 来てくれた日に「🤝 スタンプ +1」と友情の札(${v.id})`, (t.match(/スタンプ \+1/g) || []).length === 2 && /Lv1 顔みしり/.test(t), t.replace(/\n/g, ' ').slice(0, 200));
        check(`② 形のちがう「すてき」は出さない(${v.id})`, !/bad spot|<b>/.test(t));
        check(`② 「🚶 返しに行く」が2人ぶん(${v.id})`, (await page.locator('[data-alb-return]').count()) === 2); }
      { const ng = await textProblems(page, '[data-alb-guests]'); check(`② お客さん帳の字が折れない・はみ出さない(${v.id})`, ng.filter(x => !/縦にはみ出す/.test(x)).length === 0, [...new Set(ng)].join(' / ')); }
      await page.locator('[data-alb-guests]').scrollIntoViewIfNeeded();
      await shot(page, `${v.id}-2-guests`);
      await page.locator('[data-alb-fav-editor]').scrollIntoViewIfNeeded();
      await page.locator('[data-alb-fav-row="a"] select').selectOption({ index: 1 });
      await page.waitForTimeout(200);
      { const fav = await page.evaluate(async () => await storeGet('mh_assistant_life_friend_fav_v1', null, false)); check(`② お気に入りの棚で選ぶと新しいキーに残る(${v.id})`, !!fav && fav.on === true && typeof fav.a === 'string' && fav.a.length > 0, JSON.stringify(fav)); }
      { const ng = await textProblems(page, '[data-alb-fav-editor]'); check(`② 棚の字が折れない・はみ出さない(${v.id})`, ng.filter(x => !/縦にはみ出す/.test(x)).length === 0, [...new Set(ng)].join(' / ')); }
      await shot(page, `${v.id}-2b-fav-editor`);
      // ③ 返しに行く → 訪ねた家の帯 → 3つで今日のスタンプ
      if (v.from) { await page.setViewportSize({ width: v.w, height: v.h }); await page.waitForTimeout(400); }
      await page.locator('[data-alb-return="aoi-0001"]').scrollIntoViewIfNeeded();
      await page.locator('[data-alb-return="aoi-0001"]').click();
      await page.locator('[data-alf-visit]').waitFor({ timeout: 5000 });
      await page.locator('[data-alb-bar]').waitFor({ timeout: 5000 });
      await page.waitForTimeout(500);
      { const t = await page.locator('[data-alb-bar]').innerText(); check(`③ 訪ねた家に友情の帯「友情Lv1」「あと3つで 今日のスタンプ」(${v.id})`, /Lv1/.test(t) && /顔みしり/.test(t) && /あと3つ/.test(t), t.replace(/\n/g, ' ')); }
      { const ng = await textProblems(page, '[data-alf-visit-acts]'); check(`③ 帯と札がはみ出さない・折れない(${v.id})`, ng.length === 0, [...new Set(ng)].join(' / ')); }
      await shot(page, `${v.id}-3-visit-bar`);
      await page.locator('[data-alf-visit-act="peek"]').click(); await page.waitForTimeout(300); await closeRoom(page);
      await page.locator('[data-alf-visit-act="talk"]').click(); await page.locator('[data-alf-reply="0"]').click(); await page.waitForTimeout(200); await closeRoom(page);
      { const d = await page.locator('[data-alb-task-done="1"]').count(); check(`③ 部屋を見る・話すで2つ ✔(${v.id})`, d === 2, String(d)); }
      await page.locator('[data-alf-visit-leave]').click(); await page.locator('[data-alf-word="1"]').click(); await page.waitForTimeout(500);
      { const t = await page.locator('[data-alb-bar]').innerText(); check(`③ 置き手紙で3つそろい「今日のスタンプ ✔」・友情Lv1 のまま(スタンプ2個)(${v.id})`, /今日(のスタンプ)? ✔/.test(t) && /Lv1/.test(t), t.replace(/\n/g, ' ')); }
      { const b = await page.evaluate(async () => await storeGet('mh_assistant_life_friend_bond_v1', null, false)); const x = b && b.f && b.f['aoi-0001'];
        check(`⑥ 新しいキーに スタンプ2個(来てくれた1+今日1)・今日1軒(${v.id})`, !!x && x.st === 2 && x.done === true && b.houses === 1, JSON.stringify(x && { st: x.st, done: x.done, houses: b.houses }));
        const again = await page.evaluate(async () => { await albMark('aoi-0001', 'talk'); await albMark('aoi-0001', 'note'); albIncoming([['aoi-0001', alfDay()]]); await albCountIncoming(); return ALF_STORE.state.bond.f['aoi-0001'].st; });
        check(`③ 同じ日にもう一度やっても増えない(${v.id})`, again === 2, String(again));
        // 来てくれた日は、表の行が新しい順で届いても「1人1日1個」(2026-11-11 最終確認: 足した順のまま12個で切ると、まだ読む7日の中の日が落ちて数え直しになった)
        const inc = await page.evaluate(() => { const fid = 'yuto-0001'; const win = (d) => [0, 1, 2, 3, 4, 5, 6, 7].map(i => [fid, alfDayShift(alfDay(), d - i)]); albIncoming(win(0)); for (let d = 1; d <= 5; d++) albIncoming(win(d)); const x = ALF_STORE.state.bond.f[fid]; return { st: x.st, sorted: JSON.stringify(x.in) === JSON.stringify([...x.in].sort()), n: x.in.length }; });
        check(`③ 8日ぶんを新しい順で入れ、さらに5日続けても スタンプ=来た日数(13)(${v.id})`, inc.st === 13 && inc.sorted && inc.n === 12, JSON.stringify(inc)); }
      { const r = await page.evaluate(async () => { const keep = ALB_START.at; const s0 = ALF_STORE.state; const fid = 'yuto-0001'; const before = ALF_STORE.state.bond.f[fid].st; ALB_START.at = Date.now(); const day = alfDayShift(alfDay(), 9); const got = await albCountIncoming({ ...s0, visits: [{ id: 901, kind: 'player', visitor: fid, host: s0.selfId, day, ids: [], word: 0, at: Date.now() - 60000 }] }); const mid = ALF_STORE.state.bond.f[fid].st; const got2 = await albCountIncoming({ ...s0, visits: [{ id: 902, kind: 'player', visitor: fid, host: s0.selfId, day, ids: [], word: 0, at: Date.now() + 60000 }] }); ALB_START.at = keep; return { a: got.length, b: got2.length, d1: mid - before, d2: ALF_STORE.state.bond.f[fid].st - mid }; });
        check(`⑧ 公開の時より前に書かれた行はスタンプにしない・後の行は数える(${v.id})`, r.a === 0 && r.d1 === 0 && r.b === 1 && r.d2 === 1, JSON.stringify(r)); }
      // ④ シート: 見どころ・すてき・棚
      await page.locator('[data-alb-bar]').click(); await page.locator('[data-alb-sheet]').waitFor({ timeout: 4000 });
      { const t = await page.locator('[data-alb-sheet]').innerText();
        check(`④ シートに友情・今日の3つ・見どころ・相手の棚(${v.id})`, /あおいさんとの友情 Lv1/.test(t) && /あと1個で「ごきんじょさん」/.test(t) && /ソファ|ランタン|ごろちゃん/.test(t) && /お気に入りの棚/.test(t) && /好きな曲/.test(t) && /風がそよぐ/.test(t) && /12種/.test(t), t.replace(/\n/g, ' ').slice(0, 260));
        check(`④ 棚に知らない項目・タグは出ない(${v.id})`, !/script/.test(t)); }
      { const ng = await textProblems(page, '[data-alb-sheet] .mhl-sheet'); check(`④ シートが画面に収まる・字が折れない(${v.id})`, ng.length === 0, [...new Set(ng)].join(' / ')); }
      await shot(page, `${v.id}-4-sheet`);
      { const likes = page.locator('[data-alb-like]'); const n = await likes.count();
        for (let i = 0; i < Math.min(n, 4); i++) { const b = likes.nth(i); if (await b.isEnabled()) { await b.click(); await page.waitForTimeout(250); } }
        const sent = posted.filter(p => p.like).map(p => p.like);
        check(`④ 「💗 すてき」は場所の印だけを送る・1軒1日3つまで(${v.id})`, sent.length === Math.min(n, 3) && sent.every(l => l.host_id === 'aoi-0001' && /^(h|m:[a-z]+|f:[a-z]+:[cwf])$/.test(l.spot) && Object.keys(l).sort().join() === 'day,host_id,spot,visitor_id'), JSON.stringify(sent).slice(0, 200));
        check(`④ 送ったあと「届きます」の一言(${v.id})`, /届きます/.test(await page.locator('[data-alb-msg]').innerText().catch(() => ''))); }
      await shot(page, `${v.id}-4b-liked`);
      await page.locator('[data-alb-sheet] [data-mhl-sheet-close]').click();
      // ⑤ 帰って、家具が増えてからもう一度 → NEW
      await page.locator('[data-alf-visit-close]').click(); await page.waitForTimeout(300);
      env.newFurn = true;
      await visitAoi(page);
      await page.waitForTimeout(600);
      { const t = await page.locator('[data-alb-bar]').innerText(); check(`⑤ 次に訪ねると帯に「✨ 見どころ 1」(${v.id})`, /見どころ 1|✨1/.test(t), t.replace(/\n/g, ' ')); }
      await page.locator('[data-alb-bar]').click(); await page.locator('[data-alb-sheet]').waitFor({ timeout: 4000 });
      { const t = await page.locator('[data-alb-spots]').innerText(); check(`⑤ 増えた家具に NEW(${v.id})`, /NEW/.test(t) && (await page.locator('[data-alb-spot="f:mua:w"]').count()) === 1, t.replace(/\n/g, ' ')); }
      await shot(page, `${v.id}-5-new`);
      await page.locator('[data-alb-sheet] [data-mhl-sheet-close]').click();
      // ⑥ 今の保存の形は変えない
      { const st = await page.evaluate(async () => await storeGet('mh_assistant_life_friend_v1', null, false)); check(`⑥ mh_assistant_life_friend_v1 に新しい項目を足していない(${v.id})`, !!st && !('bond' in st) && !('fav' in st) && !('likes' in st), Object.keys(st || {}).join()); }
      check(`ページの中でエラーが出ない(${v.id})`, errors.length === 0, errors.slice(0, 2).join(' / '));
      void calls;
      await page.close();
    }
    // ⑦ 印が偽
    { const { page, errors, calls } = await open({ w: 390, h: 844, on: false });
      await waitFaces(page);
      await page.evaluate(() => { const st = alfToday(); alfSaveSt({ ...st, come: 1, came: [{ host: 'aoi-0001', name: 'あおい', aid: 'erubin', mine: 'atsu', seen: false }] }); });
      await page.waitForTimeout(500);
      const here = await page.locator('[data-alb-here]').count();
      await openPage(page);
      await page.locator('[data-alf-house="aoi-0001"] [data-alf-act="look"]').click(); await page.locator('[data-alf-visit]').waitFor({ timeout: 5000 }); await page.waitForTimeout(600);
      const n = await page.locator('[data-alb-bar],[data-alb-guests],[data-alb-fav-editor],[data-alb-chip],[data-alb-sheet]').count();
      const saved = await page.evaluate(async () => await storeGet('mh_assistant_life_friend_bond_v1', null, false));
      check('⑦ 印が偽なら、印・帯・帳・棚が無く、すてきの表へ通信せず、保存もしない', here === 0 && n === 0 && calls.length === 0 && saved == null, `印${here} 部品${n} 通信${calls.length} 保存${JSON.stringify(saved)}`);
      check('ページの中でエラーが出ない(⑦)', errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close(); }
  } catch (e) { check('検査が最後まで走る', false, String(e && e.stack || e).slice(0, 400)); }
  await browser.close(); server.close();
  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
