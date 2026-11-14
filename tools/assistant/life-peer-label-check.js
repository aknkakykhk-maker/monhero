// 助手ライフ「きずな」の関係図で、線の上の Lv の札が、名前・顔・ほかの札に重ならないことを見る(2026-11-14 社長・窓口 r1114-091)
//   node tools/assistant/life-friendship-shots.js <出力フォルダ>   → <出力>/<390|320>-<名前>.jpg
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..'), PORT = 9283;
const SHOTS = true;
const OUTDIR = process.argv[2] || '/tmp/fb-shots';
const shotDir = OUTDIR;


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
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  const storyIds = STORY_IDS;
  const open = async (v, flag) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript(() => {
      window.__mhSupabaseStubbed = true;
      localStorage.setItem('mh_assistant_life_ui_v2', 'true');
      if (localStorage.getItem('mh_breeder_name') === null) {
        // きき: 仲良し度 Lv8 ぐらい・好み(お茶=好き・おにぎり=苦手・観葉植物=好き)が分かっている。NEW を見るため、控えは 0
        localStorage.setItem('mh_assistant_bond_kiki_v1', JSON.stringify({ points: 2400 }));
        localStorage.setItem('mh_assistant_bond_rewards_v2', JSON.stringify({ kiki: [2, 3, 4, 5, 6, 7, 8] }));
        localStorage.setItem('mh_assistant_life_likes_v1', JSON.stringify({ known: { kiki: { tea: 'gift', flower: 'gift', onigiri: 'gift', plant: 'gift' } }, told: [] }));
        localStorage.setItem('mh_assistant_life_profile_seen_v1', JSON.stringify({ kiki: { n: 0 } }));
      }
    });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.addInitScript(() => { localStorage.setItem('mh_assistant_peer_bond_v1', JSON.stringify({ 'kiki-mua': 900, 'dra-mua': 800, 'atsu-kiki': 450, 'momosuke-mua': 2000, 'dra-kiki': 700, 'dra-momosuke': 300, 'atsu-sorashido': 300, 'erubin-kyuko': 130, 'kiki-kyuko': 200, 'kyuko-sorashido': 260, 'erubin-sorashido': 1000, 'atsu-kyuko': 130, 'kyuko-momosuke': 460, 'atsu-erubin': 1500, 'dra-sorashido': 300 })); });
    await page.addInitScript((f) => { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeProfile = f; clearInterval(t); } } catch {} }, 2); }, flag);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.waitForTimeout(500); await finishTalk(page);
    // 会っていない助手(えるびん)の加入のお話が流れたら飛ばす(このあとも会っていない扱いのまま見るため、見たことにはしない)
    for (let i = 0; i < 6; i++) { const sk = page.getByRole('button', { name: /^スキップ$/ }); if (!(await sk.count())) break; await sk.first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(600); await page.getByRole('button', { name: /^(はい|スキップする|OK)$/ }).first().click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(400); }
    await toHome(page); await finishTalk(page);
    if (process.env.DBG) await page.screenshot({ path: process.env.DBG });
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    return page;
  };
  let bad = 0;
  const check = (name, ok, info) => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${info ? ' — ' + info : ''}`); if (!ok) bad++; };
  try {
    for (const v of [{ w: 390, h: 844 }, { w: 320, h: 640 }, { w: 844, h: 390 }]) {
      const page = await open(v, true);
      await page.locator('[data-assistant-life-icon="friends"]').click({ timeout: 8000 });
      await page.waitForTimeout(900);
      const r = await page.evaluate(() => {
        const box = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
        const hit = (a, b) => a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
        const nodes = [...document.querySelectorAll('[data-assistant-peer-node]')].map(e => ({ id: e.getAttribute('data-assistant-peer-node'), b: box(e) }));
        const tags = [...document.querySelectorAll('[data-assistant-peer-link-lv]')].map(e => ({ id: e.getAttribute('data-assistant-peer-link-lv'), b: box(e.querySelector('rect')) }));
        const bad = [];
        for (const t of tags) { for (const n of nodes) if (hit(t.b, n.b)) bad.push(`${t.id} の札が ${n.id} に重なる`); }
        for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) if (hit(tags[i].b, tags[j].b)) bad.push(`${tags[i].id} と ${tags[j].id} の札が重なる`);
        return { nodes: nodes.length, tags: tags.length, bad };
      });
      check(`${v.w}×${v.h}: 線の上の札(${r.tags})が、顔と名前(${r.nodes}人)・ほかの札に重ならない`, r.nodes >= 6 && r.tags >= 8 && r.bad.length === 0, r.bad.slice(0, 4).join(' / ') || `札${r.tags}`);
      if (process.env.SHOTS) await page.locator('[data-assistant-peer-map]').screenshot({ path: path.join(shotDir, `peer-label-${v.w}.jpg`), type: 'jpeg', quality: 85 });
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
  console.log(bad ? `${bad} 件 NG` : 'すべて OK'); process.exit(bad ? 1 : 0);
})();
