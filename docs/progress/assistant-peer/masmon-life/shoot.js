// 案の止め絵: 助手のマスモンが助手ライフに登場する(社長「助手のマスモンも部屋にいたりどこかにいたり色々絡んできたら面白いな」)。
// 本物の助手ライフの画面を開き、案の部品(染めた全身絵・顔アイコン・ひとこと)を上に重ねて撮る。まだゲームには入っていない。
//   node docs/progress/assistant-peer/masmon-life/shoot.js   → masmon-life/<場面>-<向き>.jpg
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..', '..', '..'), PORT = 9281;
const tools = path.join(root, 'tools');
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.join(tools, 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.join(tools, 'assistant/life-browser-shared'));
const out = __dirname;
const VIEWS = [{ id: 'tate', w: 390, h: 844 }, { id: 'yoko', w: 844, h: 390 }];

// 案の部品を重ねる(ページの中で動く)
const overlayHouse = () => {
  const plan = ASSISTANT_MASMON_PLAN, lead = (id) => { const p = plan.find(a => a.id === id); return p && (p.team.find(t => t.lead) || p.team[0]); };
  const moods = ['💤', '♪', '🍡', '✨'];
  let i = 0;
  for (const room of document.querySelectorAll('[data-assistant-life-room]')) {
    const id = room.getAttribute('data-assistant-life-room'), t = lead(id); if (!t) continue;
    const inRoom = (room.getAttribute('data-assistant-life-room-in') || '').split(',').includes(id);
    const away = !inRoom;
    // 案: 助手がいるときはそばに、出かけているときは半分くらい留守番(残りは一緒に出かける=地図に出る)
    if (away && i % 2 === 1) { i++; continue; }
    const h = room.getBoundingClientRect().height, size = Math.round(Math.min(52, h * .5));
    const host = document.createElement('div');
    host.setAttribute('data-plan-masmon', id);
    host.style.cssText = `position:absolute;right:3px;bottom:3px;width:${size}px;height:${size}px;z-index:7;border-radius:12px;background:radial-gradient(circle,rgba(255,255,255,.75),rgba(255,255,255,0) 70%);pointer-events:none;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))`;
    room.appendChild(host);
    const mon = ALL_PLAYER_MONSTERS[t.monster];
    ReactDOM.createRoot(host).render(React.createElement(DyedMonsterImage, { baseId: t.monster, src: mon.imgUrl, masuColors: t.dye.colors, alt: '', style: { width: '100%', height: '100%', objectFit: 'contain' } }));
    const b = document.createElement('span');
    b.textContent = away ? '🏠 るすばん' : moods[i % moods.length];
    b.style.cssText = `position:absolute;right:2px;bottom:${size - 2}px;z-index:8;font-size:${away ? 8.5 : 11}px;font-weight:900;background:rgba(255,255,255,.92);color:#7c2d12;border-radius:999px;padding:0 4px;pointer-events:none`;
    room.appendChild(b);
    i++;
  }
};
const overlayMap = () => {
  const plan = ASSISTANT_MASMON_PLAN, lead = (id) => { const p = plan.find(a => a.id === id); return p && (p.team.find(t => t.lead) || p.team[0]); };
  const life = assistantLifeCurrent(), at = {};
  for (const a of plan) { const w = assistantLifeWhereOf(life, a.id); const pl = w ? w.place : 'home'; (at[pl] = at[pl] || []).push(a.id); }
  let n = 0;
  for (const place of document.querySelectorAll('[data-assistant-life-map-place]')) {
    const who = at[place.getAttribute('data-assistant-life-map-place')] || [];
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:1px;justify-content:center;margin-top:1px;border-radius:999px;background:rgba(2,6,23,.7);padding:1px 3px';
    for (const id of who) {
      if ((n++) % 2 === 1) continue; // 半分は一緒に出かけている
      const t = lead(id); if (!t) continue;
      const m = ALL_PLAYER_MONSTERS[t.monster];
      const im = document.createElement('img'); im.src = m.faceIconUrl || m.iconUrl;
      im.style.cssText = 'width:17px;height:17px;border-radius:999px;background:#fde68a;border:1.5px solid #fff;object-fit:cover';
      row.appendChild(im);
    }
    if (row.childNodes.length) place.insertBefore(row, place.lastChild);
  }
};
const overlaySheet = () => {
  const row = document.querySelector('[data-assistant-life-room-masmon]'); if (!row) return;
  const p = document.createElement('div'); p.className = 'mhl-row';
  p.innerHTML = '<span class="k">🐾 いま</span><span class="text-[11px] font-bold">ごろべえは、ききと一緒におやつ屋さん。ほいっぷちゃん(みゅあ)と遊んでいる</span>';
  row.after(p);
  const q = document.createElement('div'); q.className = 'mhl-row';
  q.innerHTML = '<span class="k">💬</span><span class="text-[11px] font-bold">きき「みゅあのほいっぷちゃん、ごろべえと仲いいんだよね」</span>';
  p.after(q);
};

(async () => {
  const { chromium } = require('playwright');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const v of VIEWS) {
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2 });
      await page.clock.setFixedTime(new Date('2026-11-08T03:40:00Z'));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
      await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await finishTalk(page);
      await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
      await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 8000 });
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      await page.evaluate(overlayHouse); await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(out, `1-house-${v.id}.jpg`), type: 'jpeg', quality: 82 });
      await page.locator('[data-assistant-life-room="kiki"]').first().click();
      await page.locator('[data-assistant-life-room-sheet]').waitFor({ timeout: 5000 });
      await page.evaluate(overlaySheet); await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(out, `3-sheet-${v.id}.jpg`), type: 'jpeg', quality: 82 });
      await page.mouse.click(8, 8); await page.waitForTimeout(400);
      await page.locator('[data-assistant-life-find]').click({ timeout: 5000 }).catch(() => {});
      await page.locator('[data-assistant-life-map-place]').first().waitFor({ timeout: 5000 }).catch(() => {});
      await page.evaluate(overlayMap); await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(out, `2-map-${v.id}.jpg`), type: 'jpeg', quality: 82 });
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log('撮りました');
})().catch(e => { console.error(e); process.exit(1); });
