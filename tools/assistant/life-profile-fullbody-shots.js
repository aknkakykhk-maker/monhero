// 助手紹介の1人ずつの画面の止め絵を、縦・横で撮る(全身画の差し替えの前後を社長へ見せる用。ゲームは変えない)
//   node tools/assistant/life-profile-fullbody-shots.js <出力フォルダ>   → <出力>/<tate|yoko>-<助手>[-<服>].jpg
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
  const CASES = [['atsu'], ['kiki'], ['kiki', 'kiki_halloween_2026', 'halloween'], ['kyuko'], ['momosuke'], ['momosuke', 'momosuke_halloween_2026', 'halloween'],
    ['mua'], ['mua', 'mua_halloween_2026', 'halloween'], ['mua', 'mua_card_master_v1', 'card-master'], ['sorashido'], ['dra'], ['erubin']];
  fs.mkdirSync(shotDir, { recursive: true });
  try {
    for (const v of [{ name: '縦', w: 390, h: 844, tag: 'tate' }, { name: '横', w: 844, h: 390, tag: 'yoko' }]) {
      const page = await open(v, true);
      for (const [id, costume, tag] of CASES) {
        await page.evaluate(async ({ id, costume, land }) => {
          const old = document.getElementById('__mh_one'); if (old) old.remove();
          if (typeof setAssistantCostumeWornNow === 'function') setAssistantCostumeWornNow(costume ? { [id]: costume } : {});
          const d = document.createElement('div'); d.id = '__mh_one'; d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0f172a;overflow:hidden';
          document.body.appendChild(d);
          const W = () => { const g = typeof useAssistantLifeGiftState === 'function' ? useAssistantLifeGiftState() : null; return React.createElement(AssistantLifeProfileSheet, { id, land, giftSt: g, onClose: () => {} }); };
          ReactDOM.createRoot(d).render(React.createElement(W));
          await new Promise(r => setTimeout(r, 900));
        }, { id, costume, land: v.w > v.h });
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(shotDir, `${v.tag}-${id}${tag ? '-' + tag : ''}.jpg`), type: 'jpeg', quality: 85 });
      }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log('書き出しました:', shotDir, errors.length ? 'エラー: ' + errors.slice(0, 3).join(' / ') : 'エラーなし');
})();
