// 案: 助手ライフの部屋から、設定で選んでいない助手ともおしゃべり(呼び方のカードもその場で出る)。本物の画面に案の部品を重ねて撮る
//   node docs/progress/assistant-peer/shots/callname-life-shots.js
const path = require('path'), fs = require('fs'), http = require('http');
const root = path.resolve(__dirname, '..', '..', '..', '..');
const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.join(root, 'tools/assistant/life-browser-shared'));
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.join(root, 'tools/boot/quiet-boot-seed'));
const DIGEST = JSON.parse(fs.readFileSync(path.join(root, 'monster-hero/data/assistant-chat-digest.json'), 'utf8'));
const OUT = __dirname;
const PORT = 8933;
const CSS = `.cn-mock{outline:2px dashed #fde047;outline-offset:2px}
.cn-follow{position:absolute;left:12px;right:12px;bottom:12px;z-index:40;border:2px solid #f9a8d4;border-radius:18px;background:rgba(2,6,23,.95);padding:10px 12px;color:#fce7f3;font-size:12px;font-weight:800;line-height:1.5;word-break:keep-all;overflow-wrap:anywhere}
.cn-follow .row{display:flex;gap:6px;margin-top:8px}.cn-follow button{flex:1;min-height:40px;border-radius:12px;font-size:12px;font-weight:900}
.cn-follow .ok{background:#f472b6;color:#fff}.cn-follow .no{background:#1e293b;color:#e2e8f0;border:1px solid #64748b}`;
(async () => {
  const core = await import(path.join(root, 'supabase/functions/assistant-chat/core.js'));
  const MEMO = { likes: '', goals: '', events: '', topics: '', summary: '', secret: '' };
  const client = { messages: { create: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ reply: 'おっ、来てくれたんだ笑', expression: 'happy', memo: MEMO, call: { action: 'none', value: '', from: 'player' }, nick: { action: 'none', value: '' }, taste: { monster: '', feeling: 'none' } }) }], usage: {} }) } };
  const server = http.createServer((req, res) => { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), f = path.join(root, rel); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
  await new Promise(r => server.listen(PORT, r));
  const { chromium } = require('playwright');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const shot = async ({ name, w, h, mode }) => {
    const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
    await page.addInitScript((mode) => {
      if (!localStorage.getItem('cn_life')) { localStorage.setItem('cn_life', '1'); localStorage.setItem('mh_story_assistant_chat_seen_v1', 'true');
        localStorage.setItem('mh_assistant_bond_atsu_v1', JSON.stringify({ points: 1300 }));
        // 3枚目(おしゃべり)は、あつとの会話の窓を見せるため、ページの中だけ あつ を選んだ状態で開く(案では選んでいる助手は変えない)
        if (mode === 'chat') localStorage.setItem('mh_assistant_selected_v1', JSON.stringify('atsu')); }
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantCallname = true; clearInterval(t); } } catch {} }, 2);
    }, mode);
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
    await page.addStyleTag({ content: CSS });
    if (mode === 'chat') {
      await page.locator('[data-home-assistant-chat]').dispatchEvent('click');
      await page.locator('[data-assistant-chat]').waitFor({ timeout: 10000 }); await page.waitForTimeout(700);
    } else {
      await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
      await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 8000 });
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
      await page.locator('[data-assistant-life-icon="house"]').click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(500);
      if (!(await page.locator('[data-assistant-life-room="atsu"]').count())) { await page.screenshot({ path: '/tmp/claude-0/-home-user-monhero/ff9066a4-e9f9-55af-afdd-e5f17c83099b/scratchpad/life-debug.png' }); console.log('rooms', await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-room]')].map(e => e.getAttribute('data-assistant-life-room')).join(','))); }
      await page.locator('[data-assistant-life-room="atsu"]').click({ timeout: 8000 }); await page.waitForTimeout(500);
      await page.evaluate((mode) => {
        const sheet = document.querySelector('[data-assistant-life-room-sheet="atsu"] .mhl-sheet');
        const acts = document.querySelector('[data-assistant-life-room-sheet="atsu"] [data-assistant-life-room-acts]');
        if (mode === 'room') {
          const btn = document.createElement('button');
          btn.className = 'mhl-btn mhl-call col-span-2 cn-mock'; btn.type = 'button';
          btn.textContent = '💬 おしゃべりする';
          acts.insertBefore(btn, acts.children[2] || null);
        } else {
          const d = document.createElement('div'); d.className = 'cn-follow cn-mock';
          d.innerHTML = 'あつ「てか、だいぶ仲いいよね笑 呼び方、そろそろ決めない？」<div class="row"><button class="ok">💬 おしゃべりする</button><button class="no">またね</button></div>';
          // ボタンの段の中のいちばん上の行に入れる(横はボタンの段が下に止まるので、段の外だと隠れる)
          d.style.position = 'static'; d.style.margin = '0'; d.style.gridColumn = '1 / -1';
          acts.insertBefore(d, acts.firstChild);
        }
      }, mode);
      await page.waitForTimeout(300);
    }
    const ng = await page.evaluate(() => [...document.querySelectorAll('.cn-mock, .cn-mock *')].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent.slice(0, 12)));
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), quality: 82 });
    console.log(name, ng.length ? 'NG ' + ng.join(' / ') : 'OK', errors.length ? 'エラー ' + errors[0] : '');
    await page.close();
  };
  try {
    if (process.env.ONLY) { for (const x of process.env.ONLY.split('|')) await shot(JSON.parse(x)); return; }
    await shot({ name: 'callname-life-1-room-portrait', w: 390, h: 844, mode: 'room' });
    await shot({ name: 'callname-life-2-room-landscape', w: 844, h: 390, mode: 'room' });
    await shot({ name: 'callname-life-3-follow-portrait', w: 390, h: 844, mode: 'follow' });
    await shot({ name: 'callname-life-4-follow-landscape', w: 844, h: 390, mode: 'follow' });
    await shot({ name: 'callname-life-5-chat-portrait', w: 390, h: 844, mode: 'chat' });
    await shot({ name: 'callname-life-6-chat-landscape', w: 844, h: 390, mode: 'chat' });
  } finally { await b.close(); server.close(); }
})();
