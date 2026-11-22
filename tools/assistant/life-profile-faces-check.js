// 助手の紹介「◯◯のこと」のひとことを押すと、ひとことと全身画の表情が8つ順に変わる(2026-11-15 社長 r1115-142)
//   ① 台詞: 8人 × 7本(ふつうは今のひとこと)・40字まで・{name} 以外の { } なし・ほかの助手の一人称や口ぐせの目印が混ざらない
//   ② 本物の画面: 押すたびに「タップで表情 n/8」と全身画の表情が変わり、9回目で最初に戻る・ひとことの札が画面と枠からはみ出さない
//   --shots [置き場]  縦390・縦320・横844 の止め絵と、縦390の8表情を並べた1枚(既定 docs/progress/assistant-life/report-1115/)
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9287;
const argv = process.argv.slice(2), si = argv.indexOf('--shots');
const SHOTS = si >= 0, shotDir = path.resolve(root, si >= 0 && argv[si + 1] && !argv[si + 1].startsWith('--') ? argv[si + 1] : 'docs/progress/assistant-life/report-1115');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
// ① 台詞(部品のファイルから表を読む)
const src = fs.readFileSync(path.join(root, 'monster-hero/src/parts/56-assistant-life-profile.jsx'), 'utf8');
const m = src.match(/const ASSISTANT_LIFE_PROFILE_FACE_LINES = Object\.freeze\((\{[\s\S]*?\})\);/);
const table = m ? Function(`return ${m[1]}`)() : null;
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const MARKS = [[/おで/, ['dra']], [/あたし/, ['mua']], [/もも/, ['momosuke']], [/でつ|まつ/, ['kiki']], [/ぢゃん|まぢ/, ['mua']], [/ｗ/, ['mua']], [/自分/, ['sorashido']], [/ありがとん|ぐぬぬ/, ['kyuko']], [/♡/, ['momosuke']], [/くさ$/, ['dra']]];
{
  const ng = [];
  if (!table) ng.push('表が読めない');
  else for (const id of IDS) {
    const a = table[id];
    if (!Array.isArray(a) || a.length !== 7) { ng.push(`${id}: 7本でない`); continue; }
    a.forEach((t, i) => {
      if (typeof t !== 'string' || !t || [...t].length > 40) ng.push(`${id}[${i}] 長さ`);
      if (/[{}]/.test(String(t).replace(/\{name\}/g, ''))) ng.push(`${id}[${i}] 穴`);
      for (const [re, ok] of MARKS) if (re.test(t) && !ok.includes(id)) ng.push(`${id}[${i}] ほかの助手の目印 ${re.source}: ${t}`);
      if (/笑/.test(t) && /w|ｗ/.test(t)) ng.push(`${id}[${i}] 笑とwの両方`);
    });
    if (new Set(a).size !== a.length) ng.push(`${id}: 同じ台詞が2本`);
  }
  check('① 台詞: 8人×7本・40字まで・穴なし・ほかの助手の目印が混ざらない', ng.length === 0, ng.slice(0, 5).join(' / '));
}
// ③ 表情を変えても体の大きさがそろう(r1115-203): 表の「8表情でいちばん高い絵の高さ」が、いまの全身画と合っている
{
  const mt = src.match(/const ASSISTANT_LIFE_PROFILE_FULL_MAX_H = Object\.freeze\((\{[\s\S]*?\})\);/);
  const tbl = mt ? Function(`return ${mt[1]}`)() : null;
  const dir = path.join(root, 'monster-hero/images/assistant/fullbody');
  const pngH = (f) => { const b = fs.readFileSync(f); return b.readUInt32BE(20); };
  const ng = [];
  if (!tbl || !Object.keys(tbl).length) ng.push('表が読めない');
  const names = new Set(fs.readdirSync(dir).map(f => (/^(.+?)__[a-z]+\.png$/.exec(f) || [])[1]).filter(Boolean));
  for (const n of [...names].filter(x => tbl && x in tbl)) { // 表にある子だけ(表に無い子は今までどおり絵ごとに枠へ収める)
    const hs = fs.readdirSync(dir).filter(f => f.startsWith(n + '__') && /^[a-z]+\.png$/.test(f.slice(n.length + 2))).map(f => pngH(path.join(dir, f)));
    const want = Math.max(...hs);
    if (!tbl || tbl[n] !== want) ng.push(`${n}: 表 ${tbl && tbl[n]} / 絵 ${want}`);
  }
  check('③ 紹介の全身画の高さの表が、いまの絵と合っている(表情で体の大きさがずれない)', !ng.length, ng.slice(0, 5).join(' / '));
}
const EXPR = ['normal', 'happy', 'excited', 'wink', 'surprise', 'troubled', 'angry', 'crying'];
const VIEWS = [{ id: 'v390', w: 390, h: 844 }, { id: 'v320', w: 320, h: 700 }, { id: 'h844', w: 844, h: 390 }];
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていない'); process.exit(failed ? 1 : 0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const errors = [];
  for (const v of VIEWS) {
    const T = `[${v.id}] `;
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${v.id}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); localStorage.setItem('mh_assistant_life_profile_seen_v1', JSON.stringify({ atsu: { n: 0 } })); });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.addInitScript(() => { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeProfile = true; clearInterval(t); } } catch {} }, 2); });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    // 新UIの紹介の入口は家の上の「📖 紹介」(r1119-114。下のタブの「📖 紹介」は段12で「🐾 マスモン」に替わった)
    await page.locator('[data-assistant-life-house-profile], [data-assistant-life-icon="profile"]').first().click(); await page.waitForTimeout(700);
    await page.locator('[data-assistant-life-profile-card="atsu"]').click(); await page.waitForTimeout(1000);
    const read = () => page.evaluate(() => {
      const b = document.querySelector('[data-assistant-life-profile-greeting]'), hero = document.querySelector('[data-assistant-life-profile-hero]');
      const img = document.querySelector('[data-assistant-life-profile-stand] img');
      const r = b && b.getBoundingClientRect(), hr = hero && hero.getBoundingClientRect();
      const kids = b ? [...b.querySelectorAll('span')].filter(s => s.scrollWidth > s.clientWidth + 1) : [];
      return { face: b && b.getAttribute('data-assistant-life-profile-face'), chip: (b && b.querySelector('[data-assistant-life-profile-face-chip]') || {}).textContent || '', text: b ? b.innerText : '', src: img ? img.getAttribute('src') : '',
        out: !r || r.left < -1 || r.right > innerWidth + 1 || (hr && (r.bottom > hr.bottom + 1 || r.top < hr.top - 1)), cut: kids.length, h: r ? Math.round(r.height) : 0, imgOk: !!img && img.complete && img.naturalWidth > 0 };
    });
    const seen = [], parts = [];
    for (let k = 0; k < 8; k++) {
      await page.waitForTimeout(450);
      const s = await read(); seen.push(s);
      if (SHOTS && v.id === 'v390') parts.push((await page.locator('[data-assistant-life-profile-hero]').screenshot()).toString('base64'));
      if (SHOTS && k === 0) await page.screenshot({ path: path.join(shotDir, `r1115-142-intro-faces-${v.id}.png`) });
      await page.locator('[data-assistant-life-profile-greeting]').click();
    }
    await page.waitForTimeout(400);
    const back = await read();
    check(`${T}② 押すたびに表情が8つ順に変わる(ふつう→…→なみだ)・札に n/8`, seen.every((s, k) => s.face === EXPR[k] && s.chip.includes(`${k + 1}/8`)), seen.map(s => s.face).join(','));
    check(`${T}② 全身画が表情の絵になる(__表情.png)・読めている`, seen.every((s, k) => s.src.includes(k === 0 ? '__normal' : `__${EXPR[k]}`) && s.imgOk), seen.filter((s, k) => !s.src.includes(`__${EXPR[k]}`)).map(s => s.src).slice(0, 2).join(' / '));
    check(`${T}② ひとことの文が表情ごとに変わる(8通り)`, new Set(seen.map(s => s.text)).size === 8);
    check(`${T}② 9回目で最初(ふつう 1/8)に戻る`, back.face === 'normal' && back.chip.includes('1/8'));
    check(`${T}② ひとことの札が画面・絵の枠からはみ出さず、字が切れない`, seen.every(s => !s.out && !s.cut), JSON.stringify(seen.filter(s => s.out || s.cut).map(s => [s.face, s.h])));
    if (SHOTS && v.id === 'v390') {
      const sheet = await browser.newPage({ viewport: { width: 1600, height: 700 }, deviceScaleFactor: 1 });
      await sheet.setContent(`<body style="margin:0;background:#0f172a;display:grid;grid-template-columns:repeat(4,390px);gap:8px;padding:8px">${parts.map((b, i) => `<div style="color:#fff;font:bold 16px sans-serif"><div>${i + 1}/8 ${EXPR[i]}</div><img style="width:390px" src="data:image/png;base64,${b}"></div>`).join('')}</body>`);
      await sheet.waitForTimeout(300);
      await sheet.screenshot({ path: path.join(shotDir, 'r1115-142-intro-faces-8-v390.png'), fullPage: true }); await sheet.close();
    }
    await page.close();
  }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `${failed} 件 NG` : 'OK: 紹介のひとことの8表情');
  process.exit(failed ? 1 : 0);
})();
