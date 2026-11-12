// 助手ライフ: フレンドの家で、その人の助手のマスモン・デッキを見る画面を、本物のゲームを開いて縦・横・小で確かめる
//   node tools/friends/alf-masmon-view-browser-check.js [--shots <出力先>]
// Supabase は偽物。公開の印 alfMasmonShareSend・assistantLifeFriend はページの中だけで真にする。
//   ① 部屋のシートに「🐾 ききのマスモン ›」→ 押すと表 alf_masmon_share からその1行だけ読む
//   ② 見る専用の育成ノート: マスモンの一覧(Lv・型)・1体を選ぶと6能力の数字・計画やチケットのボタンは出ない
//   ③ デッキのタブ: 3つ(推し・好き・素顔)をカード部の部品で出す
//   ④ 見せない設定の人は「見せない設定になっています」/行が無い人は「まだ見られません」
//   ⑤ どれも画面からはみ出さない・字が切れない・「閉じる」で家に戻る
//   ⑥ 公開の印が偽なら入口が出ない
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9247;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome } = require(path.resolve(__dirname, '..', 'assistant/life-browser-shared'));
const shotArg = process.argv.indexOf('--shots');
const shotDir = shotArg > 0 ? path.resolve(process.argv[shotArg + 1] || 'masmon-view-shots') : null;
if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 見本の名前は実在の人に寄らない仮の名前
const fresh = new Date(Date.now() - 3 * 3600000).toISOString();
const HOUSES = [
  { breeder_id: 'aoi-0001', open: true, updated_at: fresh, house: { v: 1, ids: ['mua', 'kiki', 'dra'], r: { mua: { at: 'home', d: 'snack', m: 'happy' }, kiki: { at: 'home', d: 'idle', m: 'happy' }, dra: { at: 'home', d: 'idle', m: 'happy' } } } },
];
let shareBody = null; // ページの中で本物のデッキから作る
const route = (posted) => async (r) => {
  const url = r.request().url(); const method = r.request().method();
  const json = (body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: typeof body === 'string' ? body : JSON.stringify(body) });
  if (/alf_masmon_share/.test(url)) {
    if (method !== 'GET') { posted.push(url); return json('', 201); }
    if (/assistant_id=eq\.kiki/.test(url)) return json(shareBody ? [{ body: shareBody, updated_at: fresh }] : []);
    if (/assistant_id=eq\.mua/.test(url)) return json([{ body: { v: 1, off: 1 }, updated_at: fresh }]);
    return json([]);
  }
  if (/assistant_life_friend_switch/.test(url)) return json([{ mode: 'on' }]);
  if (/assistant_life_friend_house_more/.test(url)) return method === 'GET' ? json([]) : json('', 201);
  if (/assistant_life_friend_houses/.test(url)) return method === 'GET' ? json(HOUSES) : json('', 201);
  if (/assistant_life_friend_visits/.test(url)) return method === 'GET' ? json([]) : json('', 201);
  if (/friend_links/.test(url)) {
    const self = (url.match(/requester_id\.eq\.([^,)&]+)/) || url.match(/eq\.([0-9a-f-]{20,})/) || [])[1] || 'x';
    return json([{ requester_id: self, target_id: 'aoi-0001', status: 'accepted', blocked_by: null, created_at: fresh, updated_at: fresh }]);
  }
  if (/friend_profiles|breeder_profiles/.test(url)) return json([{ breeder_id: 'aoi-0001', user_name: 'あおい', last_seen_at: fresh, place: 'home', updated_at: fresh, records: {} }]);
  if (/functions\/v1\/assistant-chat/.test(url)) return json({ ok: false, kind: 'tired' });
  return json([]);
};

// 範囲が画面からはみ出さない・nowrap/truncate の字が切れない
const textProblems = (page, sel) => page.evaluate((s) => {
  const ng = []; const W = window.innerWidth, H = window.innerHeight;
  for (const box of document.querySelectorAll(s)) {
    const b = box.getBoundingClientRect();
    if (b.left < -1 || b.right > W + 1 || b.top < -1 || b.bottom > H + 1) ng.push(`画面からはみ出す(${Math.round(b.left)},${Math.round(b.top)}〜${Math.round(b.right)},${Math.round(b.bottom)})`);
    for (const el of box.querySelectorAll('.whitespace-nowrap,.truncate,button')) {
      if (!el.offsetParent) continue;
      const r = el.getBoundingClientRect(); const txt = (el.textContent || '').trim().slice(0, 16);
      if (r.right > W + 1 || r.left < -1) ng.push(`画面の外: ${txt}`);
      if (el.matches('.whitespace-nowrap,.truncate') && el.scrollWidth > el.clientWidth + 1) ng.push(`切れる: ${txt}`);
    }
    if (/[{}]/.test(box.textContent || '')) ng.push('「{」「}」が出る');
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
    const posted = []; const reads = [];
    page.on('request', q => { if (/alf_masmon_share/.test(q.url()) && q.method() === 'GET') reads.push(q.url()); });
    await page.addInitScript(() => { window.__mhSupabaseStubbed = ['assistant_life_friend', 'alf_masmon_share']; });
    await page.addInitScript(quietBootSeed());
    await page.addInitScript(updateNoticeSeed());
    await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false });
    await page.addInitScript((flag) => { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeFriend = flag; RELEASE_FLAGS.assistantLifeFriendApi = flag; RELEASE_FLAGS.alfMasmonShareSend = flag; clearInterval(t); } } catch {} }, 2); }, on);
    await page.route(/supabase|functions\/v1/, route(posted));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page);
    return { page, errors, posted, reads };
  };
  const toVisit = async (page) => {
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 }).catch(() => {});
    await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 8000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {});
    await page.locator('[data-assistant-life-icon="visit"]').click();
    await page.locator('[data-alf-page="on"]').waitFor({ timeout: 8000 });
    await page.locator('[data-alf-scene-close]').click({ timeout: 1500 }).catch(() => {});
    await page.locator('[data-alf-house="aoi-0001"] [data-alf-act="look"]').click({ timeout: 8000 });
    await page.locator('[data-alf-visit]').waitFor({ timeout: 5000 });
  };
  const openRoom = async (page, aid) => {
    await page.locator(`[data-alf-visit] [data-assistant-life-room="${aid}"]`).click();
    await page.locator(`[data-alf-visit-sheet="${aid}"]`).waitFor({ timeout: 3000 });
  };
  try {
    for (const v of [{ id: 'tate', w: 390, h: 844 }, { id: 'yoko', w: 844, h: 390 }, { id: 'small', w: 375, h: 667 }]) {
      const { page, errors, reads } = await open(v);
      // 見本: デッキは本物の口(このページの助手ききの3つ)、マスモンは本物の種類から3体
      shareBody = await page.evaluate(() => {
        const keys = Object.keys(ALL_PLAYER_MONSTERS).slice(0, 3);
        const ms = keys.map((mo, i) => ({ mo, n: ['ごろちゃん', 'のあ', 'ぴぴ'][i], c: [], ...(i === 0 ? { l: 1 } : {}), lv: [12, 8, 3][i], g: '', st: [[320, 210, 140, 180, 160, 230], [180, 120, 260, 170, 200, 140], [90, 70, 60, 80, 75, 65]][i] }));
        const dk = ['oshi', 'suki', 'sugao'].map(f => { const d = cardAssistantDeckShareOf('kiki', f); return d ? { f, nm: d.name, ...(d.line ? { ln: d.line } : {}), m: d.monsters, ...(d.ace ? { a: d.ace } : {}), cd: d.cards } : null; }).filter(Boolean);
        return { v: 1, ms, wt: 2, dk };
      });
      check(`見本のデッキが3つ作れた(${v.id})`, shareBody && shareBody.dk.length === 3, String(shareBody && shareBody.dk.length));
      await toVisit(page);
      await openRoom(page, 'kiki');
      check(`① 部屋のシートに「🐾 ききのマスモン ›」(${v.id})`, /🐾 ききのマスモン/.test(await page.locator('[data-alf-ms-open="kiki"]').innerText().catch(() => '')));
      check(`① 開く前は表を読まない(${v.id})`, reads.length === 0, String(reads.length));
      // 縦は大きな部屋の下にシートがある。「👀 くわしく」で送ると入口が画面に入る
      await page.locator('[data-alf-visit-roomview-act="sheet"]').click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(700);
      { const inView = await page.evaluate(() => { const el = document.querySelector('[data-alf-ms-open="kiki"]'); const r = el && el.getBoundingClientRect(); return !!r && r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; });
        check(`① 「👀 くわしく」で入口が画面に入る(${v.id})`, inView); }
      await shot(page, `${v.id}-1-sheet`);
      await page.locator('[data-alf-ms-open="kiki"]').click();
      await page.locator('[data-amgp-note="readonly"]').waitFor({ timeout: 5000 });
      check(`① 押すとその1行だけ読む(${v.id})`, reads.length === 1 && /breeder_id=eq\.aoi-0001/.test(reads[0]) && /assistant_id=eq\.kiki/.test(reads[0]));
      const note = '[data-amgp-note="readonly"]';
      const txt = await page.locator(note).innerText();
      check(`② 「あおいさんの育成ノート」・マスモン3体・まだの枠2(${v.id})`, /あおいさんの/.test(txt) && (await page.locator('[data-amgp-ro-mon]').count()) === 3 && /まだ迎えていない枠 2/.test(txt), txt.slice(0, 80).replace(/\n/g, ' '));
      check(`② 計画・チケット・修行のボタンは出ない(${v.id})`, (await page.locator(`${note} [data-amgp-gain]`).count()) === 0 && /見るだけです/.test(txt));
      { const ng = await textProblems(page, note); check(`⑤ 一覧がはみ出さない・切れない(${v.id})`, ng.length === 0, [...new Set(ng)].join(' / ')); }
      await shot(page, `${v.id}-2-list`);
      await page.locator('[data-amgp-ro-mon="1"]').click();
      await page.locator('[data-amgp-ro-detail]').scrollIntoViewIfNeeded().catch(() => {});
      const det = await page.locator('[data-amgp-ro-detail]').innerText().catch(() => '');
      check(`② 1体を選ぶと6能力の数字(のあ・かしこさ260)(${v.id})`, /のあ/.test(det) && /260/.test(det), det.replace(/\n/g, ' ').slice(0, 80));
      await shot(page, `${v.id}-3-stats`);
      await page.locator(`${note} [data-amgp-tab="deck"]`).click();
      await page.locator('[data-amgp-ro-deck]').first().waitFor({ timeout: 3000 });
      check(`③ デッキのタブに3つ(推し・好き・素顔)(${v.id})`, (await page.locator('[data-amgp-ro-deck]').count()) === 3);
      { const ng = await textProblems(page, note); check(`⑤ デッキのタブがはみ出さない・切れない(${v.id})`, ng.length === 0, [...new Set(ng)].join(' / ')); }
      await shot(page, `${v.id}-4-deck`);
      await page.locator(`${note} [data-mhl-sheet-close]`).first().click();
      check(`⑤ 閉じると家に戻る(${v.id})`, (await page.locator(note).count()) === 0 && (await page.locator('[data-alf-visit]').count()) === 1);
      // 見せない設定の人
      await page.keyboard.press('Escape').catch(() => {});
      await page.locator('[data-alf-visit-sheet] [data-mhl-sheet-close]').first().click({ timeout: 1500 }).catch(() => {});
      await openRoom(page, 'mua').catch(() => {});
      await page.locator('[data-alf-ms-open="mua"]').click({ timeout: 3000 }).catch(() => {});
      await page.locator('[data-amgp-ro-off]').waitFor({ timeout: 4000 }).catch(() => {});
      check(`④ 見せない設定の人は「見せない設定になっています」(${v.id})`, /見せない設定になっています/.test(await page.locator('[data-amgp-ro-off]').innerText().catch(() => '')));
      if (v.id === 'tate') await shot(page, `${v.id}-5-off`);
      check(`ページのエラーが無い(${v.id})`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
    // ⑥ 印が偽
    {
      const { page, reads } = await open({ w: 390, h: 844, on: false });
      await page.evaluate(() => { RELEASE_FLAGS.assistantLifeFriend = true; RELEASE_FLAGS.assistantLifeFriendApi = true; });
      await toVisit(page).catch(() => {});
      await openRoom(page, 'kiki').catch(() => {});
      check('⑥ 公開の印が偽なら入口が出ず、表を読まない', (await page.locator('[data-alf-ms-open]').count()) === 0 && reads.length === 0);
      await page.close();
    }
  } catch (e) { check('最後まで動く', false, String(e).slice(0, 300)); }
  await browser.close(); server.close();
  console.log(failed ? `\nNG ${failed} 件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
