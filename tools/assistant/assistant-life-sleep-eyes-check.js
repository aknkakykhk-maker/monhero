// 寝ているときの目(2026-11-11 社長「助手ライフで寝ているときに、目を開けっぱなしの人がいる。えるびんだけそのままでいい」)
//   node tools/assistant/assistant-life-sleep-eyes-check.js
//   8人とも家で寝ている様子にして、寝姿が出る所に閉じた目(AssistantLifeSleepEyes)が重なっているかを見る
//   ① 家の部屋の顔・② 地図の全身・③ 大きな部屋のベッド: みゅあ・きき・ももすけ・あつ・きゅうこ には閉じた目が付く(社長の寝顔の絵 ◯◯_sleep.PNG に差し替えたものも数える)
//   ④ ドラ(眼鏡)・ソラシド(元から閉じた絵)・えるびん(そのまま)には付かない
//   ⑤ 顔の表と全身の表に、5人とも目の位置がある ⑥ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9267;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const CLOSE = ['mua', 'kiki', 'momosuke', 'atsu', 'kyuko'];
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const BASE = process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
  await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
  await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await toHome(page); await waitFaces(page); await finishTalk(page);
  const tables = await page.evaluate(() => ({ full: Object.keys(ASSISTANT_LIFE_SLEEP_EYES), face: Object.keys(ASSISTANT_LIFE_SLEEP_EYES_FACE) }));
  check('⑤ 全身と顔の表に、5人とも目の位置がある(ドラ・ソラシド・えるびんは無い)', CLOSE.every(id => tables.full.includes(id) && tables.face.includes(id)) && !['dra', 'sorashido', 'erubin'].some(id => tables.full.includes(id) || tables.face.includes(id)), JSON.stringify(tables));
  await page.evaluate((ids) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: [], solo: Object.fromEntries(ids.map(id => [id, { doing: 'sleep', place: 'home' }])), watched: [] } }); }, IDS);
  await page.waitForTimeout(800); await finishTalk(page);
  await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
  await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const got = (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map(e => e.getAttribute('data-assistant-life-roomview-sleep-eyes')).sort(), sel);
  // 2026-11-11 社長の寝顔の絵(◯◯_sleep.PNG)がある助手は、目を重ねるのではなく絵そのものを差し替える。その絵を出しているのも「閉じた目」に数える
  const PRE = { mua: 'myua', kiki: 'kiki', momosuke: 'momosuke', dra: 'dra', atsu: 'atsu', kyuko: 'kyuko', sorashido: 'sorashido', erubin: 'erubin' };
  const gotAll = (scope) => page.evaluate(({ scope, PRE }) => { const out = new Set(); for (const e of document.querySelectorAll(`${scope} [data-assistant-life-roomview-sleep-eyes]`)) out.add(e.getAttribute('data-assistant-life-roomview-sleep-eyes'));
    for (const img of document.querySelectorAll(`${scope} img`)) { const s = img.getAttribute('src') || ''; for (const [id, pre] of Object.entries(PRE)) if (new RegExp(`/${pre}_sleep\\.PNG`).test(s)) out.add(id); } return [...out].sort(); }, { scope, PRE });
  const want = [...CLOSE].sort().join(',');
  const house = await got('[data-assistant-life-room-face] [data-assistant-life-roomview-sleep-eyes]');
  check('① 家の部屋の顔: 5人に閉じた目', house.join(',') === want, house.join(','));
  await page.locator('[data-assistant-life-icon="where"]').click(); await page.waitForTimeout(1800);
  const map = await gotAll('[data-assistant-life-map-fig]');
  check('② 地図の全身: 5人に閉じた目', map.join(',') === want, map.join(','));
  await page.locator('[data-assistant-life-map-back]').click(); await page.waitForTimeout(600);
  const bed = [];
  for (const id of IDS) {
    await page.locator(`[data-assistant-life-room="${id}"]`).first().click({ timeout: 3000 }); await page.waitForTimeout(1200);
    const g = await gotAll('[data-assistant-life-room-sheet]');
    if (g.includes(id)) bed.push(id);
    await page.locator('[data-assistant-life-roomview-close]').click().catch(() => {}); await page.waitForTimeout(400);
  }
  check('③④ 大きな部屋のベッド: 5人に閉じた目・ドラ・ソラシド・えるびんには付かない', [...bed].sort().join(',') === want, bed.join(','));
  check('⑥ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
