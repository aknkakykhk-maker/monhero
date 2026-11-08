// 案の止め絵: 部屋のマスモンの大きさと置き場所(社長「マスモンのサイズ感ちがくない？」2026-11-08)。
// 本物の助手ライフ(枝の部屋のマスモン入り)を開き、案ごとに見た目だけ上書きして撮る。ゲームには入れていない。
//   node docs/progress/assistant-peer/masmon-life/size-shoot.js → masmon-life/size-<案>-<向き>.jpg と size-all.jpg
//   A: どの部屋も助手の顔と同じ大きさで床に立つ。札を左上へ寄せ(横は少し小さく)、床の右を空ける
//   B: 大きさをそろえ、置き場所は決まった1か所(床の左、家具の前)。札は右へ寄せる(横は少し小さく)
//   C: 部屋には全身を出さず、名札の横に顔アイコン(どの部屋も同じ大きさ・同じ場所)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..', '..', '..'), PORT = 9283;
const tools = path.join(root, 'tools');
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.join(tools, 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.join(tools, 'assistant/life-browser-shared'));
const out = __dirname;
const VIEWS = [{ id: 'p', w: 390, h: 844 }, { id: 'l', w: 844, h: 390 }, { id: 'r', w: 390, h: 844, rot: true }];
const PLANS = ['A', 'B', 'C', 'W0', 'W1', 'W2'];
//   W: A と同じ大きさで、床の空いている所(札・顔・吹き出し・名札に重ならない区間)だけを歩く。W0〜W2 は歩いている途中の3コマ

const apply = (plan) => {
  const walk = plan[0] === 'W', frame = walk ? Number(plan[1]) : 0;
  if (walk) plan = 'A';
  const css = document.createElement('style');
  css.id = '__plan';
  if (plan === 'A') css.textContent = '.mhl-room .tag{top:42%!important;left:41%!important}[data-assistant-life-land="1"] .mhl-room .tag{left:40%!important;transform:translate(-50%,-38%) rotate(-3deg) scale(.86)!important}';
  if (plan === 'B') css.textContent = '.mhl-room .tag{top:42%!important;left:62%!important}[data-assistant-life-land="1"] .mhl-room .tag{left:60%!important;transform:translate(-50%,-38%) rotate(-3deg) scale(.86)!important}';
  document.head.appendChild(css);
  for (const room of document.querySelectorAll('[data-assistant-life-room]')) {
    const id = room.getAttribute('data-assistant-life-room');
    const pet = room.querySelector('[data-assistant-life-room-masmon-pet]');
    const rr = room.getBoundingClientRect();
    const face = Math.round(Math.min(40, rr.height * .44)) + 6; // 顔の丸と見合う大きさ(全身なので少し大きめ)
    if (plan === 'C') {
      if (pet) pet.style.display = 'none';
      const pl = room.querySelector('.pl'); const t = assistantMasmonDuty(id);
      if (!pl || !t || assistantMasmonWhere(id, assistantLifeCurrent()).kind === 'out') continue;
      const m = ALL_PLAYER_MONSTERS[t.monster];
      const im = document.createElement('img'); im.src = m.faceIconUrl || m.iconUrl;
      im.style.cssText = 'width:15px;height:15px;border-radius:999px;margin-left:4px;vertical-align:-3px;background:#fde68a;border:1px solid #d6b37a;object-fit:cover';
      pl.appendChild(im);
      continue;
    }
    if (!pet) continue;
    pet.style.width = pet.style.height = `${face}px`;
    pet.style.top = 'auto'; pet.style.bottom = '9px';
    if (walk) {
      // 床の帯で、札・顔・吹き出し・名札に重ならない x の区間を集め、いちばん長い区間を歩く(3コマ: はし・まんなか・もう一方のはし)
      const obs = [...room.querySelectorAll('.tag,.pp,.bb,.pl,.lv')].map(o => o.getBoundingClientRect());
      const top = rr.bottom - 9 - face - 4, bot = rr.bottom - 9;
      const free = []; let st = null;
      for (let x = 3; x <= rr.width - face - 3; x += 2) {
        const l = rr.left + x, r = l + face;
        const ok = !obs.some(q => Math.min(r, q.right) - Math.max(l, q.left) > 0 && Math.min(bot, q.bottom) - Math.max(top, q.top) > 0);
        if (ok && st == null) st = x; if (!ok && st != null) { free.push([st, x - 2]); st = null; }
      }
      if (st != null) free.push([st, rr.width - face - 3]);
      free.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
      const [a, b] = free[0] || [rr.width - face - 3, rr.width - face - 3];
      const x = [a, Math.round((a + b) / 2), b][(frame + id.length) % 3];
      pet.style.left = `${x}px`;
      pet.style.transform = (frame + id.length) % 2 ? 'scaleX(-1)' : 'none';
      const mk = pet.querySelector('b'); if (mk) mk.style.display = frame === 1 ? '' : 'none'; // 止まったときだけ印
      continue;
    }
    if (plan === 'A') {
      // 床の右。顔の丸がいれば、その左
      const pp = room.querySelector('.pp');
      const right = pp ? (rr.right - pp.getBoundingClientRect().left) + 4 : 8;
      pet.style.left = `${rr.width - right - face}px`;
    } else {
      pet.style.left = '8px';
    }
  }
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
    for (const v of VIEWS) for (const plan of PLANS) {
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2 });
      await page.clock.setFixedTime(new Date('2026-11-08T03:40:00Z'));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
      await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page);
      if (v.rot) {
        await page.locator('.mh-home-facility.rhythm').click({ timeout: 15000 }).catch(() => {});
        await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 }).catch(() => {});
        await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(800);
        await page.getByRole('button', { name: '戻る' }).first().click({ timeout: 5000 }).catch(() => {});
        await page.locator('.mh-home-player').waitFor({ timeout: 15000 }).catch(() => {});
      }
      await finishTalk(page);
      await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
      await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 8000 });
      await page.waitForTimeout(2500);
      await page.evaluate(apply, plan); await page.waitForTimeout(2500);
      const house = page.locator('.mhl-body').first();
      await house.screenshot({ path: path.join(out, `size-${plan}-${v.id}.jpg`), type: 'jpeg', quality: 82 });
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log('撮りました');
})().catch(e => { console.error(e); process.exit(1); });
