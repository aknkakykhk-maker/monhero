// 案の止め絵: マスモンのタブの空いた所(社長「ここ空いてる枠が気になるから情報量増やすか、モンスター増やすかしたいね」)。
// 本物の「えるびんのマスモン」を開き、案ごとに札の中身・数を上から書き足して撮る。ゲームには入れていない。
//   node docs/progress/assistant-peer/masmon-life/tab-shoot.js → masmon-life/tab-<案>-<向き>.jpg と tab-all.jpg
//   now: 今 / A: 札に情報を足す(技・わけ・育てた日数・思い出・押すと詳しく)/ B: 5体に増やす(2体を新しく迎えた)/ C: 4体+札も少し詳しく
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..', '..', '..'), PORT = 9287;
const tools = path.join(root, 'tools');
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.join(tools, 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.join(tools, 'assistant/life-browser-shared'));
const out = __dirname;
const VIEWS = [{ id: 'p', w: 390, h: 844 }, { id: 'l', w: 844, h: 390 }, { id: 'r', w: 390, h: 844, rot: true }];
const PLANS = ['now', 'A', 'B', 'C'];
const WHO = 'erubin';

const apply = (plan) => {
  if (plan === 'now') return;
  const body = document.querySelector('.mhm-body');
  const list = body.firstElementChild;
  const rows = [...list.querySelectorAll('[data-assistant-masmon-row]')];
  const detail = {
    Ark: { days: 46, memo: 'このあいだ、えるびんと一緒に神殿の前まで散歩した', atk: 3 },
    Kuromy: { days: 31, memo: 'ドラのメダマ焼きと、ひなたの丘でひなたぼっこ', atk: 3 },
    Mia: { days: 22, memo: 'みゅあのイブちゃんに、歌を教えてもらった', atk: 3 },
    Pixie: { days: 5, memo: '迎えたばかり。つばさ(ミーア)のあとをついて回る', atk: 2 },
    Yggdrasil: { days: 2, memo: '迎えたばかり。よぞら(クロミー)と同じ木の仲間', atk: 2 },
  };
  const addInfo = (row, mid, full) => {
    const d = detail[mid]; const names = (HERO_ATK_NAMES[mid] || []).slice(0, d.atk);
    const why = (row.__why || '');
    const box = document.createElement('div');
    box.style.cssText = 'margin-top:4px;padding-top:4px;border-top:1px dashed rgba(148,163,184,.35);font-size:10px;font-weight:700;color:#cbd5e1;line-height:1.45';
    box.innerHTML = `<div>⚔ 技: <b style="color:#fff">${names.join('・')}</b></div>`
      + (full ? `<div>💬 えるびん「${why}」</div>` : '')
      + `<div>📅 育てて ${d.days}日</div>`
      + (full ? `<div>📝 ${d.memo}</div>` : '')
      + `<div style="margin-top:2px;color:#f9a8d4">押すと大きな全身絵と詳しい能力 ›</div>`;
    row.querySelector('.min-w-0.flex-1').appendChild(box);
  };
  const whys = { Ark: '好きなモンスター', Kuromy: '強いのについ目がいく', Mia: '強いのについ目がいく', Pixie: 'ミーアの仲間だから', Yggdrasil: 'よぞらと同じ木の仲間' };
  rows.forEach(r => { r.__why = whys[r.getAttribute('data-assistant-masmon-row')]; });
  const addMon = (mid, nick, lv, colors) => {
    const src = rows[rows.length - 1];
    const row = src.cloneNode(true);
    row.setAttribute('data-assistant-masmon-row', mid);
    const m = ALL_PLAYER_MONSTERS[mid];
    const pic = row.querySelector('.mhm-pic'); pic.innerHTML = '';
    ReactDOM.createRoot(pic).render(React.createElement(DyedMonsterImage, { baseId: mid, src: m.imgUrl, masuColors: colors, alt: '', style: { width: '100%', height: '100%', objectFit: 'contain' } }));
    const ps = row.querySelectorAll('p');
    ps[0].innerHTML = `${nick}<em class="mhm-lead ml-1.5" style="background:#38bdf8">新しく迎えた</em>`;
    ps[1].innerHTML = `${m.name} ・ Lv.${lv}`;
    ps[2].textContent = '📈 防御型';
    row.__why = whys[mid];
    list.appendChild(row);
    return row;
  };
  if (plan === 'A') rows.forEach(r => addInfo(r, r.getAttribute('data-assistant-masmon-row'), true));
  if (plan === 'B') { addMon('Pixie', 'こつばさ', 6, ['black@70', 'orange@40', null]); addMon('Yggdrasil', 'こかげ', 3, ['black@60', null, 'gray@60']); }
  if (plan === 'C') { const r = addMon('Pixie', 'こつばさ', 6, ['black@70', 'orange@40', null]); [...rows, r].forEach(x => addInfo(x, x.getAttribute('data-assistant-masmon-row'), false)); }
  const note = body.querySelector('p.mt-2');
  if (note && plan !== 'A') note.textContent = plan === 'B' ? '🐾 えるびんのマスモンは5体まで。仲良し度が上がると、新しいマスモンを迎えることがあります' : '🐾 えるびんのマスモンは4体まで。仲良し度が上がると、新しいマスモンを迎えることがあります';
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
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
      await page.locator(`[data-assistant-life-room="${WHO}"]`).first().click({ timeout: 8000 });
      await page.locator('[data-assistant-life-room-masmon]').click({ timeout: 5000 });
      await page.locator('[data-assistant-masmon-sheet]').waitFor({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await page.evaluate(apply, plan); await page.waitForTimeout(4500);
      await page.screenshot({ path: path.join(out, `tab-${plan}-${v.id}.jpg`), type: 'jpeg', quality: 82 });
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log('撮りました');
})().catch(e => { console.error(e); process.exit(1); });
