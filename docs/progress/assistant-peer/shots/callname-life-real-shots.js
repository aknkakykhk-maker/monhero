// 作った「助手ライフの部屋からのおしゃべり」と呼び方の小窓を、本物の画面で撮る(公開の印はページの中だけ真・中継役は偽物の Claude)
//   node docs/progress/assistant-peer/shots/callname-life-real-shots.js
const path = require('path'), fs = require('fs'), http = require('http');
const root = path.resolve(__dirname, '..', '..', '..', '..');
const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.join(root, 'tools/assistant/life-browser-shared'));
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.join(root, 'tools/boot/quiet-boot-seed'));
const DIGEST = JSON.parse(fs.readFileSync(path.join(root, 'monster-hero/data/assistant-chat-digest.json'), 'utf8'));
const OUT = __dirname, PORT = 8934;
const MEMO = { likes: '', goals: '', events: '', topics: '', summary: '', secret: '' };
(async () => {
  const core = await import(path.join(root, 'supabase/functions/assistant-chat/core.js'));
  const client = { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ reply: 'おっ、来てくれたんだ笑', expression: 'happy', memo: MEMO, call: { action: 'none', value: '', from: 'player' }, nick: { action: 'none', value: '' }, taste: { monster: '', feeling: 'none' } }) }], usage: {} }) } };
  const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), f = path.join(root, rel); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
  await new Promise(r => server.listen(PORT, r));
  const { chromium } = require('playwright');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const shot = async ({ name, w, h, mode, bond = 420 }) => {
    const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
    await page.addInitScript(({ mode, bond }) => {
      if (!localStorage.getItem('cn_lr')) { localStorage.setItem('cn_lr', '1'); localStorage.setItem('mh_story_assistant_chat_seen_v1', 'true');
        localStorage.setItem('mh_assistant_bond_atsu_v1', JSON.stringify({ points: bond })); localStorage.setItem('mh_assistant_bond_v1', JSON.stringify({ points: 1300 }));
        localStorage.setItem('mh_assistant_callname_v1', JSON.stringify(mode === 'picker' ? { mua: { call: 'あっちゃん', by: 'chat', at: 1, prev: null } } : {}));
        localStorage.setItem('mh_assistant_nickname_v1', JSON.stringify(mode === 'picker' ? { mua: { nick: 'みゅあたん', at: 1 } } : {}));
        if (mode === 'wake') { const life = JSON.parse(localStorage.getItem('mh_assistant_life_v1') || '{}'); life.solo = { ...(life.solo || {}), atsu: { doing: 'sleep', place: 'home', reason: 'sleepy' } }; localStorage.setItem('mh_assistant_life_v1', JSON.stringify(life)); } }
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantCallname = true; clearInterval(t); } } catch {} }, 2);
    }, { mode, bond });
    await page.route(/rest\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/functions/v1/assistant-chat', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.kind) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, kind: 'tired' }) }); return; }
      const r = await core.handleRequest({ body, digest: DIGEST, client, take: async () => ({ ok: true, remaining: 42 }), refund: async () => {} });
      await route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.json) });
    });
    await page.route(/functions\/v1\/(?!assistant-chat)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await page.waitForTimeout(1500); await finishTalk(page);
    if (mode === 'picker') {
      await page.locator('.mh-home-player').click({ timeout: 5000 }).catch(() => {});
      await page.locator('[data-profile-call-style]').first().waitFor({ timeout: 8000 });
      for (let i = 0; i < 12; i++) { const n = page.getByRole('button', { name: /^(次へ|閉じる|OK|わかった！?)$/ }).first(); if (!(await n.count()) || !(await n.isVisible().catch(() => false))) break; await n.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(250); }
      await page.locator('[data-profile-call-style]').first().click(); await page.waitForTimeout(500);
    } else {
      await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
      await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 8000 });
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
      await page.locator('[data-assistant-life-icon="house"]').click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(500);
      await page.locator('[data-assistant-life-room="atsu"]').click({ timeout: 8000 }); await page.waitForTimeout(500);
      if (mode === 'follow' || mode === 'offer') {
        await page.locator('[data-assistant-life-room-sheet="atsu"] [data-assistant-life-room-act="invite"]').click(); await page.waitForTimeout(500);
        for (let i = 0; i < 30 && await page.locator('[data-assistant-life-scene]').count(); i++) { await finishTalk(page); await page.locator('[data-assistant-life-scene-back]').click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(300); }
        await page.waitForTimeout(400);
        if (mode === 'offer') { await page.locator('[data-assistant-life-room-follow-chat]').click(); await page.locator('[data-assistant-chat]').waitFor({ timeout: 8000 }); await page.waitForTimeout(600); }
      }
      if (mode === 'chat' || mode === 'wake') { await page.locator('[data-assistant-life-room-sheet="atsu"] [data-assistant-life-room-act="chat"]').click(); await page.locator('[data-assistant-chat]').waitFor({ timeout: 8000 }); await page.waitForTimeout(600); }
    }
    const ng = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('[data-assistant-life-room-acts] button, [data-assistant-life-room-follow] *, [data-assistant-callname-card] button, [data-call-style-picker] button').forEach(el => { if (el.scrollWidth > el.clientWidth + 1) out.push('はみ出し:' + el.textContent.slice(0, 12)); });
      const pk = document.querySelector('[data-call-style-picker] > div'); if (pk) { const r = pk.getBoundingClientRect(); if (r.top < 0) out.push('小窓の上が画面の外 ' + Math.round(r.top)); }
      return out;
    });
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), quality: 82 });
    console.log(name, ng.length ? 'NG ' + ng.join(' / ') : 'OK', errors.length ? 'エラー ' + errors[0] : '');
    await page.close();
  };
  const list = [
    { name: 'callname-life-real-1-room-portrait', w: 390, h: 844, mode: 'room' },
    { name: 'callname-life-real-2-room-landscape', w: 844, h: 390, mode: 'room' },
    { name: 'callname-life-real-3-follow-portrait', w: 390, h: 844, mode: 'follow' },
    { name: 'callname-life-real-4-follow-landscape', w: 844, h: 390, mode: 'follow' },
    { name: 'callname-life-real-4b-follow-667', w: 667, h: 375, mode: 'follow' },
    { name: 'callname-life-real-4c-follow-320', w: 320, h: 568, mode: 'follow' },
    { name: 'callname-life-real-5-offer-portrait', w: 390, h: 844, mode: 'offer' },
    { name: 'callname-life-real-6-chat-landscape', w: 844, h: 390, mode: 'chat' },
    { name: 'callname-life-real-7-wake-portrait', w: 390, h: 844, mode: 'wake' },
    { name: 'callname-life-real-8-wake-landscape', w: 667, h: 375, mode: 'wake' },
    { name: 'callname-real-7-picker-320', w: 320, h: 568, mode: 'picker', bond: 1300 },
    { name: 'callname-real-8-picker-667', w: 667, h: 375, mode: 'picker', bond: 1300 },
  ];
  try { for (const x of list) if (!process.env.ONLY || process.env.ONLY.split(',').includes(x.name)) await shot(x); } finally { await b.close(); server.close(); }
})();
