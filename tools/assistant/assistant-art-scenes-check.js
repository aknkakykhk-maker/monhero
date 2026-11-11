// 助手の絵(立ち絵・顔)が、使う場面の全部でうまく出ているかを数字で見る(2026-11-11 社長「助手の立ち絵も見直して、使う場面全部でうまく表示させるようにして」)
//   node tools/assistant/assistant-art-scenes-check.js                      検査(全場面 × 全員 × 縦・横・横小・🔄横)。最後の1行に OK / NG
//   node tools/assistant/assistant-art-scenes-check.js --shots <フォルダ>   止め絵も撮る(場面ごとの一覧の絵も作る)
//   --views tate,yoko,small,rot   大きさをしぼる / --only home,map,…   場面をしぼる / --who mua,kiki   助手をしぼる / --all   NG の行を全部出す
// 見るもの(画面に出ている「助手の絵」の img を全部拾って測る。場面の作りを知らなくても測れる)
//   ① 伸び: 縦横の比が元の絵とちがう(3% まで)
//   ② ぼやけ: 元の絵より大きく引き伸ばしている(CSS の 1px に元の絵 1px 未満。スマホは 2倍の細かさなので、1.0倍を超えたら NG)
//   ③ 切れ: 顔(頭のてっぺん〜顎。表 ASSISTANT_LIFE_STAND_FACE と着替えの表から)が枠・画面の外に出ている(5% まで)。描かれている所の上は 4% まで(顔の点が分かる絵は、耳・帽子・王冠の先が 10% まで)。
//      羽・肩が左右で枠の外へ出るのは切れに数えない(顔の点が分からない絵だけ、左右 6% まで)。下は胸から上の絵なので見ない。全身の絵=ドラは下も見る
//   ④ 小さすぎ: 立ち絵の顔(目から顎)が 5px 未満・顔の絵が 12px 未満
//   ⑤ ばらつき: 並んで立つ場面(地図・場面・アルバム)で、助手ごとの顔の大きさ(立ち絵)の最大÷最小が 1.25 を超える。1人ずつ出す場面(モードえらび・カード)は参考として出すだけ
//   run-checks-timeout: 1500(全部で10分あまり。実物を起動して、助手を1人ずつ替えながら場面を開く)
//   ⑥ 重ねた絵(寝顔)のずれ: 目を閉じた形が、下の立ち絵と同じ場所・同じ大きさ(1.5px まで)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = Number(process.env.ART_PORT) || 9263;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const starterOpenPass = require(path.resolve(__dirname, '..', 'card/lib/starter-open-pass.js'));
const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const SHOTS = arg('--shots') ? path.resolve(arg('--shots')) : null;
const list = (name) => (arg(name) ? arg(name).split(',') : null);
const ALL = process.argv.includes('--all');
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const WHO0 = list('--who') || IDS;
const VIEWS = [
  { id: 'tate', name: '縦 390×844', w: 390, h: 844 },
  { id: 'yoko', name: '横 844×390', w: 844, h: 390 },
  { id: 'small', name: '横小 568×320', w: 568, h: 320 },
  { id: 'rot', name: '🔄横 390×844', w: 390, h: 844, rot: true },
].filter(v => !list('--views') || list('--views').includes(v.id));
const ONLY = list('--only');
// 着替え: --outfit a(みゅあ・きき・ももすけ=ハロウィン、えるびん=石油王)/ --outfit b(みゅあ=カードマスター)。着ている助手だけ回す
const OUTFITS = { a: { mua: 'mua_halloween_2026', kiki: 'kiki_halloween_2026', momosuke: 'momosuke_halloween_2026', erubin: 'erubin_sekiyuou_v1' }, b: { mua: 'mua_card_master_v1' } };
const OUTFIT = arg('--outfit') ? OUTFITS[arg('--outfit')] : null;
const SFX = arg('--outfit') ? `-outfit${arg('--outfit')}` : '';
const WHO = OUTFIT ? WHO0.filter(id => OUTFIT[id]) : WHO0;
const want0 = (scene) => !ONLY || ONLY.includes(scene);
const LIMIT = { stretch: 0.03, blur: 1.0, cutTop: 0.04, cutTopDeco: 0.1, cutSide: 0.06, faceCut: 0.05, cutBottom: 0.04, faceMin: 5, iconMin: 12, spread: 1.25, overlay: 1.5 };

// 画面の中で、助手の絵を全部拾って測る
const probe = () => (async () => {
  const rot = typeof RHYTHM_VIEW_ROTATION !== 'undefined' && RHYTHM_VIEW_ROTATION.active();
  const R = (el) => { const r = rot ? RHYTHM_VIEW_ROTATION.rectOf(el) : el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
  const W = rot ? window.innerHeight : window.innerWidth, H = rot ? window.innerWidth : window.innerHeight;
  const cut = (a, b) => ({ l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) });
  const inset = (cs, r) => { // clip-path: inset(上 右 下 左) だけ読む
    const m = (cs.clipPath || '').match(/inset\(([^)]*)\)/); if (!m) return r;
    const v = m[1].split(/\s+round\s+/)[0].trim().split(/\s+/); const px = (s, len) => (/%$/.test(s) ? parseFloat(s) / 100 * len : parseFloat(s) || 0);
    const t = px(v[0], r.b - r.t), ri = px(v[1] != null ? v[1] : v[0], r.r - r.l), b = px(v[2] != null ? v[2] : v[0], r.b - r.t), l = px(v[3] != null ? v[3] : (v[1] != null ? v[1] : v[0]), r.r - r.l);
    return { l: r.l + l, t: r.t + t, r: r.r - ri, b: r.b - b };
  };
  window.__artBox = window.__artBox || new Map();
  const alphaBox = (src) => new Promise((res) => {
    if (window.__artBox.has(src)) { res(window.__artBox.get(src)); return; }
    const im = new Image();
    im.onload = () => {
      const Wc = 160, Hc = Math.max(1, Math.round(160 * im.naturalHeight / im.naturalWidth)); const c = document.createElement('canvas'); c.width = Wc; c.height = Hc;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0, Wc, Hc); const d = g.getImageData(0, 0, Wc, Hc).data; let t = Hc, b = -1, l = Wc, r = -1;
      for (let y = 0; y < Hc; y++) for (let x = 0; x < Wc; x++) if (d[(y * Wc + x) * 4 + 3] > 40) { if (y < t) t = y; if (y > b) b = y; if (x < l) l = x; if (x > r) r = x; }
      const box = b < 0 ? { t: 0, b: 1, l: 0, r: 1 } : { t: t / Hc, b: (b + 1) / Hc, l: l / Wc, r: (r + 1) / Wc };
      window.__artBox.set(src, box); res(box);
    };
    im.onerror = () => res({ t: 0, b: 1, l: 0, r: 1 }); im.src = src;
  });
  const out = [];
  for (const img of document.querySelectorAll('img')) {
    const raw = img.getAttribute('src') || ''; const m = raw.match(/images\/assistant\/(?:([a-z-]+)\/)?(?:(face)\/)?([a-z]+)_([a-z]+)\.(?:PNG|png)/);
    if (!m || !img.naturalWidth || !img.getClientRects().length) continue;
    if (img.hasAttribute('data-assistant-life-roomview-sleep-eyes')) continue; // 寝顔の重ね絵(sleep/)は立ち絵ではない。⑥で別に測る
    const costume = m[1] && m[1] !== 'face' ? m[1] : null, face = m[1] === 'face' || !!m[2];
    const who = (typeof ASSISTANTS !== 'undefined' ? ASSISTANTS : []).find(a => a.imagePrefix === m[3]);
    const cs = getComputedStyle(img); const box = R(img); const bw = box.r - box.l, bh = box.b - box.t;
    if (bw < 1 || bh < 1) continue;
    let hidden = false; for (let e = img; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.visibility === 'hidden' || parseFloat(s.opacity) < 0.05) { hidden = true; break; } }
    if (hidden) continue;
    // 傾けて置いた絵(寝姿など)は、枠で切る位置を測れないので切れは見ない。伸びは傾ける前の大きさで見る
    let tilt = false; for (let e = img; e && e.nodeType === 1 && e !== document.body; e = e.parentElement) { const t = getComputedStyle(e).transform; const mm = t && t !== 'none' ? t.match(/matrix\(([^)]*)\)/) : null; if (mm) { const q = mm[1].split(',').map(Number); const sn = Math.abs(q[1]) / (Math.hypot(q[0], q[1]) || 1); if (sn > 0.03 && sn < 0.997) { tilt = true; break; } } }
    const nw = img.naturalWidth, nh = img.naturalHeight, fit = cs.objectFit;
    let kx = bw / nw, ky = bh / nh;
    const lw = img.offsetWidth || bw, lh = img.offsetHeight || bh; let sx = lw / nw, sy = lh / nh; if (fit && fit !== 'fill') sx = sy = 1;
    if (fit === 'contain' || fit === 'scale-down') kx = ky = Math.min(kx, ky); else if (fit === 'cover') kx = ky = Math.max(kx, ky); else if (fit === 'none') kx = ky = 1;
    const pos = (cs.objectPosition || '50% 50%').split(/\s+/).map(v => (/%$/.test(v) ? parseFloat(v) / 100 : 0.5));
    const dw = nw * kx, dh = nh * ky; const drawn = { l: box.l + (bw - dw) * pos[0], t: box.t + (bh - dh) * (pos[1] != null ? pos[1] : 0.5) }; drawn.r = drawn.l + dw; drawn.b = drawn.t + dh;
    // 見えている範囲: 自分の箱・自分の clip-path・overflow で切る祖先・祖先の clip-path・画面
    let vis = inset(cs, box), scrolled = false;
    for (let e = img.parentElement; e && e.nodeType === 1 && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e); const r = R(e);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { // スクロールできる箱は「切れ」ではないので、その箱では切らない
        const scrolls = /(auto|scroll)/.test(s.overflowX + s.overflowY);
        if (!scrolls) vis = cut(vis, r);
        else if (box.t < r.t - 1 || box.b > r.b + 1 || box.l < r.l - 1 || box.r > r.r + 1) scrolled = true; // スクロールの先に掛かっている絵は、切れを見ない
      }
      if (s.clipPath && s.clipPath !== 'none') vis = cut(vis, inset(s, r));
    }
    vis = cut(vis, { l: 0, t: 0, r: W, b: H });
    const ab = await alphaBox(raw); const a = { l: drawn.l + ab.l * dw, r: drawn.l + ab.r * dw, t: drawn.t + ab.t * dh, b: drawn.t + ab.b * dh };
    const aw = Math.max(1, a.r - a.l), ah = Math.max(1, a.b - a.t);
    const seen = vis.r > vis.l && vis.b > vis.t ? Math.max(0, Math.min(a.r, vis.r) - Math.max(a.l, vis.l)) * Math.max(0, Math.min(a.b, vis.b) - Math.max(a.t, vis.t)) / (aw * ah) : 0;
    // 立ち絵の顔の大きさ(目から顎)。表(ASSISTANT_LIFE_STAND_FACE)にある、ふだんの服の絵だけ
    //   顔の四角(頭のてっぺん〜顎・体の真ん中から左右に頭の幅ぶん)が、どれだけ見えていないか(faceCut)。羽・耳・肩が枠の外へ出るのは切れに数えない
    let facePx = null, faceCut = null;
    const known = !face && who && typeof assistantLifeStandFace === 'function' && (costume ? (typeof ASSISTANT_LIFE_STAND_FACE_OUTFIT !== 'undefined' && ASSISTANT_LIFE_STAND_FACE_OUTFIT[costume] && ASSISTANT_LIFE_STAND_FACE_OUTFIT[costume][who.id]) : ASSISTANT_LIFE_STAND_FACE[who.id]);
    if (known) {
      const f = assistantLifeStandFace(who.id, raw); facePx = ah * ASSISTANT_LIFE_STAND_EC * (f.m || 1) / (f.fit || 1);
      const U = facePx * ASSISTANT_LIFE_STAND_FACE_LEN, cx = (a.l + a.r) / 2;
      const fr = { l: cx - U * 0.36, r: cx + U * 0.36, t: a.t + (f.top || 0) * ah, b: f.head ? a.b : a.t + (f.chin || 0.47) * ah };
      const fa = (fr.r - fr.l) * (fr.b - fr.t); const fv = Math.max(0, Math.min(fr.r, vis.r) - Math.max(fr.l, vis.l)) * Math.max(0, Math.min(fr.b, vis.b) - Math.max(fr.t, vis.t));
      faceCut = fa > 0 ? 1 - fv / fa : 0;
    }
    const mask = [img, img.parentElement, img.parentElement && img.parentElement.parentElement].some(e => { if (!e) return false; const s = getComputedStyle(e); return (s.maskImage && s.maskImage !== 'none') || (s.webkitMaskImage && s.webkitMaskImage !== 'none'); });
    const tag = (() => { for (let e = img; e && e.nodeType === 1; e = e.parentElement) { const d = [...e.attributes].find(x => /^data-(assistant|card|home|mh|rhythm)/.test(x.name)); if (d) return d.name.replace(/^data-/, ''); } return ''; })();
    out.push({ who: who ? who.id : m[3], expr: m[4], kind: face ? 'face' : 'full', costume, tag, w: Math.round(bw * 10) / 10, h: Math.round(bh * 10) / 10,
      stretch: Math.max(sx / sy, sy / sx) - 1, scale: tilt ? Math.max(lw / nw, lh / nh) : Math.max(kx, ky), seen, tilt: tilt || scrolled,
      cutTop: Math.max(0, vis.t - a.t) / ah, cutBottom: Math.max(0, a.b - vis.b) / ah, cutLeft: Math.max(0, vis.l - a.l) / aw, cutRight: Math.max(0, a.r - vis.r) / aw,
      bottomEdge: ab.b > 0.985, mask, facePx, faceCut, x: Math.round((a.l + a.r) / 2), y: Math.round(a.t), box: [Math.round(drawn.l * 10) / 10, Math.round(drawn.t * 10) / 10, Math.round(dw * 10) / 10, Math.round(dh * 10) / 10] });
  }
  // 重ねた寝顔: すぐ前の立ち絵と同じ場所・同じ大きさか(AssistantLifeSleepEyes は立ち絵と同じ w・h・left・top をもらう作り)
  const overlays = [];
  for (const el of document.querySelectorAll('[data-assistant-life-roomview-sleep-eyes]')) {
    const base = el.parentElement && [...el.parentElement.querySelectorAll('img')].find(i => i !== el && !i.hasAttribute('data-assistant-life-roomview-sleep-eyes') && /images\/assistant\//.test(i.getAttribute('src') || ''));
    if (!base || !el.getClientRects().length) continue; const a = R(el), b = R(base);
    overlays.push({ who: el.getAttribute('data-assistant-life-roomview-sleep-eyes'), d: Math.max(Math.abs(a.l - b.l), Math.abs(a.t - b.t), Math.abs(a.r - b.r), Math.abs(a.b - b.b)) });
  }
  return { imgs: out, overlays, rot };
})();

const rows = []; // { scene, view, ...img }
const overlayRows = [];
const shots = []; // { scene, view, label, file }
const notes = [];

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const errors = [];
  const BASE = `http://localhost:${PORT}/`;

  // 4つの画面の大きさは同時に回す(1つずつだと20分かかる)
  await Promise.all(VIEWS.map(async (v) => {
    const want = (scene) => want0(scene) && (!v.rot || scene === 'rhythm');
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${String(e.message).slice(0, 160)}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: 130 });
    if (OUTFIT) await page.addInitScript((worn) => { localStorage.setItem('mh_assistant_costume_owned_v1', JSON.stringify(Object.values(worn))); localStorage.setItem('mh_assistant_costume_worn_v1', JSON.stringify(worn)); }, OUTFIT);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    // 🔄横: 端末は縦のまま、モンヒロビートの「🔄」で器を回す。モンヒロビートの中だけで効き、HOME へ戻ると解ける(releaseScreenOrientation)。
    //   なので🔄横で見るのはモンヒロビートの場面だけ
    const turn = async () => { if (!v.rot) return; const on = await page.evaluate(() => RHYTHM_VIEW_ROTATION.active()); if (!on) { await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(900); } };
    const boot = async () => {
      await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' }); await toHome(page); await waitFaces(page); await finishTalk(page); await page.waitForTimeout(500);
    };
    const take = async (scene, label, { settle = 350, filter = null } = {}) => {
      await page.waitForTimeout(settle);
      const got = await page.evaluate(probe); if (v.rot && !got.rot) notes.push(`${v.name} ${scene} ${label}: 🔄横になっていない`);
      for (const r of got.imgs) if (!filter || filter(r)) rows.push({ scene: scene + SFX, view: v.id, label, ...r });
      for (const o of got.overlays) overlayRows.push({ scene, view: v.id, label, ...o });
      if (SHOTS) { const file = `${scene}${SFX}-${v.id}-${label}.png`; await page.screenshot({ path: path.join(SHOTS, file) }); shots.push({ scene: scene + SFX, view: v.id, label, file, rot: !!v.rot }); }
      return got;
    };
    const step = async (name, fn) => { try { await fn(); } catch (e) { notes.push(`${v.name} ${name}: 開けなかった(${String(e.message).split('\n')[0].slice(0, 120)})`); } };
    const setLife = (mix) => page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } }); }, mix);
    const closeLife = async () => { for (let i = 0; i < 3 && await page.locator('[data-assistant-life-screen]').count(); i++) { await page.evaluate(() => ASSISTANT_LIFE_STORE.set({ open: false })); await page.waitForTimeout(300); } };
    const openLife = async () => {
      for (let i = 0; i < 5; i++) { const pc = page.locator('[data-assistant-peer-close]'); if (await pc.count()) await pc.first().click({ timeout: 2000 }).catch(() => {}); try { await page.locator('[data-home-assistant-life]').click({ timeout: 4000 }); break; } catch (e) { if (i === 4) { await page.evaluate(() => ASSISTANT_LIFE_STORE.set({ open: true })); await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 4000 }); break; } await finishTalk(page); await page.waitForTimeout(800); } }
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {}); await page.waitForTimeout(600);
    };
    try {
      await boot();

      // ---- HOME(助手の吹き出し・施設の下の顔)とモンヒロビートのモードえらび(立ち絵)。助手を1人ずつ替える
      if (want('home') || want('rhythm')) for (const id of WHO.filter(x => !OUTFIT || arg('--outfit') !== 'a' || true)) await step(`HOME ${id}`, async () => {
        const cur = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_assistant_selected_v1') || 'null'));
        if (cur !== id) { await page.evaluate((x) => localStorage.setItem('mh_assistant_selected_v1', JSON.stringify(x)), id); await boot(); }
        if (want('home')) await take('home', id);
        if (want('rhythm')) {
          await page.locator('.mh-home-facility.rhythm').click({ timeout: 10000 });
          await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 });
          await turn(); await take('rhythm', id, { settle: 900 });
          await page.getByRole('button', { name: '戻る' }).first().click({ timeout: 5000 });
          await page.locator('.mh-home-player').waitFor({ timeout: 15000 }); await page.waitForTimeout(300);
        }
      });

      // ---- 助手ライフ: 家・地図・場面(見守る)・大きな部屋
      const ALL_HOME = (sleep) => ({ groups: [], solo: Object.fromEntries(IDS.map((id) => [id, { doing: sleep ? 'sleep' : 'idle', place: 'home' }])) });
      const SPREAD = { groups: [{ ids: ['kiki', 'mua'], doing: 'walk', place: 'hill' }, { ids: ['dra', 'momosuke'], doing: 'training', place: 'ranch' }],
        solo: { atsu: { doing: 'idle', place: 'garden' }, kyuko: { doing: 'read', place: 'library' }, sorashido: { doing: 'walk', place: 'plaza' }, erubin: { doing: 'idle', place: 'temple' } } };
      if (want('house') || want('map')) for (const [label, mix] of [['awake', ALL_HOME(false)], ['sleep', ALL_HOME(true)], ['spread', SPREAD]]) await step(`家・地図 ${label}`, async () => {
        await closeLife(); await setLife(mix); await page.waitForTimeout(900); await finishTalk(page);
        await openLife();
        if (want('house')) await take('house', label);
        if (want('map')) {
          await page.locator('[data-assistant-life-icon="where"]').click({ timeout: 5000 });
          await page.locator('[data-assistant-life-map]').waitFor({ timeout: 5000 });
          await take('map', label, { settle: 1300 });
        }
      });
      if (want('room')) for (const [label, sleep] of [['awake', false], ['sleep', true]]) {
        await step(`部屋 ${label}`, async () => { await closeLife(); await setLife(ALL_HOME(sleep)); await page.waitForTimeout(700); await finishTalk(page); await openLife(); });
        for (const id of WHO) await step(`部屋 ${label} ${id}`, async () => {
          await page.locator(`[data-assistant-life-room="${id}"]`).click({ timeout: 5000 });
          await page.locator('[data-assistant-life-roomview]').waitFor({ timeout: 5000 });
          await take('room', `${label}-${id}`, { settle: 900 });
          await page.locator('[data-assistant-life-roomview-close]').click({ timeout: 3000 }); await page.waitForTimeout(300);
        });
      }
      if (want('scene')) {
        const PAIRS = [['mua', 'momosuke'], ['kiki', 'dra'], ['atsu', 'sorashido'], ['kyuko', 'erubin']];
        await step('場面', async () => { await closeLife(); await setLife({ groups: PAIRS.map(ids => ({ ids, doing: 'snack', place: 'home' })), solo: {} }); await page.waitForTimeout(700); await finishTalk(page); await openLife(); });
        for (const pair of PAIRS.filter(p => !OUTFIT || p.some(x => OUTFIT[x]))) await step(`場面 ${pair.join('・')}`, async () => {
          const host = await page.evaluate((ids) => assistantLifeHostOf(ids), pair);
          await page.locator(`[data-assistant-life-room="${host}"]`).click({ timeout: 5000 }); await page.waitForTimeout(500);
          const watch = page.locator('[data-assistant-life-roomview-act="watch"], [data-assistant-life-room-act="watch"]').first();
          await watch.click({ timeout: 4000 });
          await page.locator('[data-assistant-life-scene]').waitFor({ timeout: 5000 });
          await take('scene', pair.join('-'), { settle: 1200 });
          await finishTalk(page); await page.locator('[data-assistant-life-scene-back]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(350);
          await page.locator('[data-assistant-life-roomview-close]').click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(250);
        });
      }
      await closeLife();

      // ---- 思い出アルバムのツーショット(本物の部品を、アルバムと同じ器に並べる)
      if (want('album')) await step('思い出アルバム', async () => {
        const PAIRS = [['mua', 'kiki'], ['momosuke', 'dra'], ['atsu', 'sorashido'], ['kyuko', 'erubin']].filter(p => !OUTFIT || p.some(x => OUTFIT[x]));
        for (const pair of PAIRS) {
          await page.evaluate((pair) => {
            const host = document.createElement('div'); host.id = '__art_album'; (document.querySelector('.mh-app') || document.body).appendChild(host);
            const photos = ASSISTANT_PEER_PHOTOS.slice(0, 6);
            const el = React.createElement('div', { className: 'fixed inset-0 flex items-end sm:items-center justify-center bg-black/70 p-2', style: { zIndex: 9100 } },
              React.createElement('div', { className: 'w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border-2 border-amber-300/60 bg-slate-950 p-3' },
                React.createElement('div', { className: 'grid grid-cols-2 gap-2' }, photos.map(ph => React.createElement(AssistantPeerPhoto, { key: ph.lv, pair, photo: ph, open: true })))));
            window.__artRoot = ReactDOM.createRoot(host); window.__artRoot.render(el);
          }, pair);
          await page.waitForTimeout(900);
          await page.evaluate(() => Promise.all([...document.querySelectorAll('#__art_album img')].map(i => (i.complete ? null : new Promise(r => { i.loading = 'eager'; i.onload = i.onerror = r; })))));
          await take('album', pair.join('-'), { filter: r => r.kind === 'full' });
          await page.evaluate(() => { window.__artRoot.unmount(); document.getElementById('__art_album').remove(); });
        }
      });

      // ---- MFバトルカード: 相手えらび(立ち絵とひとこと)→ VS → 結果(立ち絵と吹き出し)
      if (want('card')) {
        const dismiss = async () => { for (let i = 0; i < 16; i++) { const did = await page.evaluate(() => { const inO = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.position === 'fixed' || (s.position === 'absolute' && Number(s.zIndex) >= 40)) return true; } return false; };
          const l = [...document.querySelectorAll('button')].filter((b) => inO(b) && /^(確認|閉じる|OK|受け取る|次へ|わかった|はい|スキップ|あとで読む|あとで)$/.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!l.length) return false; l[0].click(); return true; }); if (!did) break; await page.waitForTimeout(400); } };
        let ready = false;
        await step('カード 下ごしらえ', async () => {
          await page.locator('[data-home-card-battle]').first().dispatchEvent('click');
          await page.locator('[data-card-top="starter"], [data-card-top="top"]').first().waitFor({ timeout: 30000 });
          if (await page.locator('[data-card-top="starter"]').count()) {
            await page.locator('[data-card-kit="powerful"]').click();
            await page.getByRole('button', { name: /にする$/ }).click();
            await starterOpenPass(page);
            await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
            await page.locator('[data-card-quit]').click();
            await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
            // 練習試合を飛ばした結果(先生ドラの立ち絵)
            await page.locator('[data-card-top="result"]').waitFor({ timeout: 8000 }).catch(() => {});
            if (await page.locator('[data-card-top="result"]').count()) await take('cardtutor', 'dra', { filter: r => r.kind === 'full' });
            await page.getByRole('button', { name: 'トップへ' }).click();
          }
          await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 }); await dismiss();
          await page.evaluate(() => { window.__mhCardScene = (st) => { st.turn = 12; st.players[1].mons.forEach((m) => { m.life = 0; }); st.winner = 0; st.reason = '全員KO'; st.phase = 'over'; st.pending = null; return st; }; });
          ready = true;
        });
        if (ready) for (const id of WHO) await step(`カード ${id}`, async () => {
          await dismiss();
          if (!(await page.locator(`[data-card-foe="${id}"]`).count())) {
            if (!(await page.locator('[data-card-top="top"]').count())) { await page.getByRole('button', { name: /トップへ|戻る/ }).first().click({ timeout: 3000 }).catch(() => {}); await page.locator('[data-card-top="top"]').waitFor({ timeout: 8000 }); await dismiss(); }
            await page.locator('[data-card-cpu]').first().click({ timeout: 5000 });
            await page.locator('[data-card-mode-assistant]').click({ timeout: 5000 });
          }
          await page.locator(`[data-card-foe="${id}"]`).waitFor({ timeout: 20000 });
          await page.locator(`[data-card-foe="${id}"]`).click();
          await page.locator(`[data-card-foe-intro="${id}"]`).waitFor({ timeout: 5000 });
          await page.locator(`[data-card-foe-intro="${id}"]`).scrollIntoViewIfNeeded().catch(() => {});
          await take('cardfoe', id, { settle: 700, filter: r => r.kind === 'full' });
          await page.locator('[data-card-start]').click({ timeout: 5000 });
          let vs = false;
          for (let i = 0; i < 30 && !vs; i++) {
            vs = (await page.locator('[data-card-vs-foe-art]').count()) > 0;
            if (!vs) { const go = page.getByRole('button', { name: /^対戦へ$|このデッキで/ }).first(); if (await go.count() && await go.isVisible().catch(() => false)) await go.click().catch(() => {}); await page.waitForTimeout(250); }
          }
          if (vs) await take('cardvs', id, { settle: 1500, filter: r => r.kind === 'full' }); else notes.push(`${v.name} カード ${id}: VS が出ない`);
          for (let i = 0; i < 40; i++) {
            if (await page.locator('[data-card-top="result"]').count()) break;
            const b = page.getByRole('button', { name: /対戦へ|このデッキで|はじめる|スタート|タップ/ }).first();
            if (await b.count() && await b.isVisible().catch(() => false)) await b.click().catch(() => {}); else await page.locator('[data-card-vs], [data-mh-screen]').first().click({ timeout: 800, force: true }).catch(() => {});
            await page.waitForTimeout(600);
          }
          await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
          for (let i = 0, quiet = 0; i < 20 && quiet < 4; i++) { const nx = page.getByText(/押すと(先へ|閉じる)/); if (await nx.count() && await nx.first().isVisible().catch(() => false)) { quiet = 0; await nx.first().click().catch(() => {}); } else quiet++; await page.waitForTimeout(600); }
          await dismiss();
          await page.locator('[data-card-result-talk]').scrollIntoViewIfNeeded().catch(() => {});
          await take('cardresult', id, { filter: r => r.kind === 'full' });
          await page.getByRole('button', { name: /トップへ|相手をえらぶ/ }).first().click({ timeout: 2500 }).catch(() => {});
        });
      }
    } catch (e) { notes.push(`${v.name}: 途中で止まった(${String(e.message).split('\n')[0].slice(0, 160)})`); }
    await page.close();
  }));
  await browser.close(); server.close();

  // ---- まとめ
  const bad = [];
  const add = (r, what, num) => bad.push({ key: `${r.scene}|${r.kind}|${what}`, what, num, r });
  for (const r of rows) {
    if (r.seen <= 0.02) continue; // 画面の外で待っている絵(スクロールの先など)は見ない
    if (r.stretch > LIMIT.stretch) add(r, '伸び', r.stretch);
    if (r.scale > LIMIT.blur) add(r, 'ぼやけ', r.scale);
    if (r.tilt) continue;
    if (r.cutTop > (r.faceCut != null ? LIMIT.cutTopDeco : LIMIT.cutTop)) add(r, '上が切れる', r.cutTop);
    if (r.faceCut != null) { if (r.faceCut > LIMIT.faceCut) add(r, '顔が切れる', r.faceCut); }
    else if (r.cutLeft > LIMIT.cutSide || r.cutRight > LIMIT.cutSide) add(r, '左右が切れる', Math.max(r.cutLeft, r.cutRight));
    if (r.kind === 'full' && !r.bottomEdge && !r.mask && r.cutBottom > LIMIT.cutBottom) add(r, '足元が切れる', r.cutBottom);
    if (r.kind === 'full' && r.facePx != null && r.facePx < LIMIT.faceMin) add(r, '小さすぎ', r.facePx);
    if (r.kind === 'face' && Math.min(r.w, r.h) < LIMIT.iconMin) add(r, '小さすぎ', Math.min(r.w, r.h));
  }
  // ばらつき: 同じ場面・同じ画面の大きさ・同じ使いどころ(tag)で、助手ごとの顔の大きさ
  const groups = new Map();
  for (const r of rows) { if (r.kind !== 'full' || r.facePx == null || r.seen <= 0.02 || r.tilt) continue; const k = `${r.scene}|${r.view}|${r.tag}${/^(scene|album)/.test(r.scene) ? `|${r.label}` : ''}`; if (!groups.has(k)) groups.set(k, new Map()); const g = groups.get(k); g.set(r.who, Math.max(g.get(r.who) || 0, r.facePx)); }
  // 並んで立つ場面(地図・場面・アルバム・部屋・家)は NG。1人ずつ枠いっぱいに出す場面(モードえらび・カード)は、絵ごとの余白のちがいと
  //   社長が1人ずつ決めた寄せ方(あつ・きゅうこ)があるので、参考として出すだけ(--all)
  const SIDE_BY_SIDE = /^(map|scene|album|room|house)/;
  const spreads = [], soloSpreads = [];
  for (const [k, g] of groups) { if (g.size < 2) continue; const e = [...g.entries()].sort((a, b) => a[1] - b[1]); const ratio = e[e.length - 1][1] / e[0][1]; if (ratio > LIMIT.spread) (SIDE_BY_SIDE.test(k) ? spreads : soloSpreads).push({ k, ratio, min: e[0], max: e[e.length - 1] }); }
  const overlayBad = overlayRows.filter(o => o.d > LIMIT.overlay);

  // 問題の大きい順(場面 × 種類ごとにまとめる)
  const byKey = new Map();
  for (const b of bad) { if (!byKey.has(b.key)) byKey.set(b.key, []); byKey.get(b.key).push(b); }
  const weight = { '顔が切れる': 6, '伸び': 5, '上が切れる': 4, '左右が切れる': 3, '足元が切れる': 3, 'ぼやけ': 2, '小さすぎ': 2 };
  const table = [...byKey.entries()].map(([key, l]) => { const worst = l.reduce((a, b) => (b.num > a.num ? b : a)); const [scene, kind, what] = key.split('|');
    return { scene, kind, what, n: l.length, who: [...new Set(l.map(x => x.r.who))], views: [...new Set(l.map(x => x.r.view))], worst, score: weight[what] * 100 + Math.min(99, l.length) }; }).sort((a, b) => b.score - a.score);
  const fmt = (what, n) => (what === 'ぼやけ' ? `${n.toFixed(2)}倍` : what === '小さすぎ' ? `${n.toFixed(1)}px` : `${Math.round(n * 100)}%`);
  console.log(`測った絵 ${rows.length} 枚(場面 ${[...new Set(rows.map(r => r.scene))].length}・画面の大きさ ${VIEWS.length})`);
  for (const t of table.slice(0, ALL ? 999 : 12)) console.log(`NG: ${t.scene} ${t.kind === 'face' ? '顔' : '立ち絵'} ${t.what} ${t.n}件(最大 ${fmt(t.what, t.worst.num)} ${t.worst.r.who}・${t.worst.r.view}・${t.worst.r.label}・${t.worst.r.tag})/ ${t.who.join(',')} / ${t.views.join(',')}`);
  for (const s of spreads.sort((a, b) => b.ratio - a.ratio).slice(0, ALL ? 999 : 8)) console.log(`NG: ばらつき ${s.k} — 最大÷最小 ${s.ratio.toFixed(2)}(${s.min[0]} ${s.min[1].toFixed(1)}px 〜 ${s.max[0]} ${s.max[1].toFixed(1)}px)`);
  if (ALL) for (const s of soloSpreads.sort((a, b) => b.ratio - a.ratio).slice(0, 6)) console.log(`参考: 1人で出す場面の顔の大きさ ${s.k} — 最大÷最小 ${s.ratio.toFixed(2)}(${s.min[0]} ${s.min[1].toFixed(1)}px 〜 ${s.max[0]} ${s.max[1].toFixed(1)}px)`);
  for (const o of overlayBad.slice(0, ALL ? 999 : 5)) console.log(`NG: 寝顔のずれ ${o.scene} ${o.view} ${o.label} ${o.who} ${o.d.toFixed(1)}px`);
  for (const n of notes.slice(0, ALL ? 999 : 8)) console.log(`NG: ${n}`);
  for (const e of [...new Set(errors)].slice(0, 3)) console.log(`NG: ページのエラー ${e}`);
  if (SHOTS) { fs.writeFileSync(path.join(SHOTS, 'rows.json'), JSON.stringify({ rows, overlayRows, shots, table: table.map(t => ({ ...t, worst: { num: t.worst.num, ...t.worst.r } })), spreads, soloSpreads, notes }, null, 0)); }
  const total = table.length + spreads.length + overlayBad.length + notes.length + new Set(errors).size;
  console.log(total ? `NG ${total}種類(絵 ${bad.length} 件・ばらつき ${spreads.length}・寝顔 ${overlayBad.length}・開けない ${notes.length}・エラー ${new Set(errors).size})` : `OK 助手の絵 ${rows.length} 枚: 伸び・ぼやけ・切れ・小さすぎ・ばらつき・寝顔のずれ なし`);
  process.exit(total ? 1 : 0);
})();
