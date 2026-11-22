#!/usr/bin/env node
// 助手ライフの作り直し 段7: 型に載せた家(56-assistant-life-house-typed.jsx)を本物の画面で撮って、型の決まりを測る。ゲーム本体は変えない・読むだけ。
//   node tools/assistant/life-house-typed-shoot.js [--out <置き場>] [--2x]
//   置き場の既定: docs/progress/assistant-life/step7-house/(<大きさ>-<場面>.png と measure.json)
// 場面: house(開いたところ)・house-bottom(下まで送った)・daily(7日のごほうびを開いた)・guide(❓ 見かたの窓)・result(👀 見る → 場面の終わり → 結果の1枚)
//       town・town-bottom(段9: 町)・room(段8: 部屋を開いたところ。--room <id> 既定 atsu)・room-more(「もっと見る」を開いて下まで送った)
// 測る決まりは tools/assistant/life-ui-shoot.js の measure(字の4段・主なボタン1つ・帯とタブ・はみ出し・下の空き・窓・段組み)。
// 偽のデータでページの中だけ(Supabase は偽物)。時刻は 15:00 に固定。最後の1行が OK / NG。
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..');
const { measure } = require('./life-ui-shoot');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const OUT = path.resolve(root, opt('--out', 'docs/progress/assistant-life/step7-house'));
const SIZES = argv.includes('--quick') ? { tate: { w: 390, h: 844 } } : argv.includes('--phone') ? { tate: { w: 390, h: 844 }, s320: { w: 320, h: 568 } } : { tate: { w: 390, h: 844 }, s320: { w: 320, h: 568 }, yoko: { w: 844, h: 390 }, pc: { w: 1280, h: 800 } };
// SHOT_REV=<コミット> … ゲームの画面だけその版から配る(前の見え方と比べる・tools/browser/serve-rev.js)
const serveRev = require('../browser/serve-rev');
const FROM_REV = serveRev.make(root);
const PORT = 9289;
// --hour <時>(既定15)・--untyped(段7の前の家の並びで撮る)・--sleep(寝ている助手の部屋も撮る。測らない)
const HOUR = Number(opt('--hour', '15')) || 15, UNTYPED = argv.includes('--untyped'), SLEEP = argv.includes('--sleep') || HOUR >= 21 || HOUR < 6;
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が無い'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(root, 'tools/boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require('./life-browser-shared');
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (file.startsWith(root) && serveRev.serve(FROM_REV, root, file, res, MIME[path.extname(file).toLowerCase()])) return;
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const MIX = SLEEP ? { groups: [], solo: { mua: { doing: 'sleep', place: 'home' }, kiki: { doing: 'sleep', place: 'home' }, dra: { doing: 'sleep', place: 'home' }, kyuko: { doing: 'sleep', place: 'home' }, momosuke: { doing: 'sleep', place: 'home' }, atsu: { doing: 'sleep', place: 'home' }, sorashido: { doing: 'sleep', place: 'home' }, erubin: { doing: 'sleep', place: 'home' } } } : { groups: [{ ids: ['mua', 'kiki'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'sorashido', 'erubin'], doing: 'cards', place: 'cardroom' }],
    solo: { momosuke: { doing: 'battle', place: 'battle' }, atsu: { doing: 'idle', place: 'home' }, kyuko: { doing: 'read', place: 'library' } } };
  const result = { shots: {}, errors: [], miss: [] };
  let failed = 0;
  for (const [sizeId, v] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: argv.includes('--2x') ? 2 : 1 });
    const page = await ctx.newPage();
    const jst = new Date(Date.now() + 9 * 3600000); jst.setUTCHours(HOUR, 0, 0, 0);
    await page.clock.setFixedTime(new Date(jst.getTime() - 9 * 3600000));
    page.on('pageerror', e => result.errors.push(`${sizeId}: ${String(e.message || e).slice(0, 160)}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = ['assistant_life_friend']; window.__mhKeepRoomFold = true; if (window.__untyped) window.__mhAssistantLifeUntypedHouse = true; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); localStorage.setItem('mh_assistant_life_guide_seen_v1', 'true'); });
    if (UNTYPED) await page.addInitScript(() => { window.__untyped = true; });
    // --untyped-town … 段9の前の町(型に載せる前)で撮る(比べる用・検査だけの印)
    if (argv.includes('--untyped-town')) await page.addInitScript(() => { window.__mhAssistantLifeUntypedTown = true; });
    // --bedtry '{"headDiv":3,"bedHeads":3,"quiltDrop":0.2}' … 寝ている部屋のベッドの釣り合いの案(ページの中だけ)
    if (opt('--bedtry', '')) await page.addInitScript((t) => { window.__mhAssistantLifeBedTry = t; }, JSON.parse(opt('--bedtry', '{}')));
    // --worn kiki:kiki_twintail_v1,… … 着せ替えを着せて撮る(着替えの保存 mh_assistant_costume_*_v1 はページの中だけ)
    const WORN = Object.fromEntries((opt('--worn', '') || '').split(',').filter(Boolean).map(x => x.split(':')));
    if (Object.keys(WORN).length) await page.addInitScript((worn) => { localStorage.setItem('mh_assistant_costume_owned_v1', JSON.stringify(Object.values(worn))); localStorage.setItem('mh_assistant_costume_worn_v1', JSON.stringify(worn)); }, WORN);
    // --notch … iPhone の切り欠きあり(縦: 上47px・下34px / 横: 左右47px・下21px)で撮る。env() はブラウザで作れないので、ゲームの切り欠きの変数(--mh-safe-top ほか)に入れる(2026-11-22 社長の iPhone で上の帯が時刻に重なった r1119-098)
    if (argv.includes('--notch')) await page.addInitScript(() => { const set = () => { const r = document.documentElement; const land = window.innerWidth > window.innerHeight; // 横は左右47px・下21px(2026-11-22 窓口: 全部の部への決まり)
        r.style.setProperty('--mh-safe-top', land ? '0px' : '47px'); r.style.setProperty('--mh-safe-bottom', land ? '21px' : '34px');
        r.style.setProperty('--mh-safe-left', land ? '47px' : '0px'); r.style.setProperty('--mh-safe-right', land ? '47px' : '0px'); }; if (document.documentElement) set(); document.addEventListener('DOMContentLoaded', set); });
    // --short-bottom <px> … 助手ライフの器が画面の下の端まで届かない形(社長の iPhone のホーム画面のアプリで器の下に黒い帯が出ていた)を作って撮る
    if (opt('--short-bottom', '')) await page.addInitScript((px) => { document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = `.mhl-root{bottom:${px}px!important}`; document.head.appendChild(st); }); }, Number(opt('--short-bottom', '0')));
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: Number(opt('--bond', '')) || null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const shot = async (name, mo = {}) => {
      await page.waitForTimeout(700);
      const file = `${sizeId}-${name}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      const m = await page.evaluate(measure, { withScene: true, badMax: Number(process.env.BAD_MAX) || 0, ...mo });
      const wantTwo = sizeId === 'pc' || sizeId === 'yoko';
      if (m.twoCol !== undefined && m.twoCol !== wantTwo) m.ng = [...(m.ng || []), `⑦ ${wantTwo ? '2段組になっていない' : '縦なのに2段組'}`];
      result.shots[file] = m;
      console.log(`${m.ng.length ? 'NG' : 'OK'}: ${file} 字 ${(m.fontSteps || []).join('/')}px · 主 ${m.main ? `${m.main.w}×${m.main.h}・${m.main.font}px` : '-'} · 下の空き ${m.bottomGap}px${m.ng.length ? ` — ${m.ng.join(' / ')}` : ''}`);
      if (m.ng.length) failed++;
    };
    try {
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page); await waitFaces(page); await finishTalk(page);
      await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, moods: { atsu: 'lonely' }, watched: [] } }); }, MIX);
      await page.waitForTimeout(600); await finishTalk(page);
      await page.locator('[data-home-assistant-life]').first().click({ timeout: 20000 });
      await page.locator(UNTYPED || process.env.SHOT_REV ? '[data-assistant-life-screen]' : '[data-assistant-life-typed-house]').waitFor({ timeout: 15000 });
      await shot('house');
      if (SLEEP) {
        await page.waitForTimeout(1500);
        for (const id of (opt('--rooms', 'dra,kyuko') || '').split(',').filter(Boolean)) {
          await page.locator(`[data-assistant-life-room="${id}"]`).first().click({ timeout: 5000 }).catch(e => result.miss.push(`${sizeId} 部屋 ${id}: ${String(e.message).slice(0, 80)}`));
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(OUT, `${sizeId}-room-${id}.png`) });
          await page.locator('[data-assistant-life-roomview-close]:visible').first().click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(600);
        }
        await ctx.close(); continue;
      }
      await page.evaluate(() => { const m = document.querySelector('[data-alu-main]'); if (m) m.scrollTop = m.scrollHeight; });
      await shot('house-bottom', { skipMain: true });
      // 段7の残り(2026-11-22): 7日のごほうびを開いた中身・予定の行・「❓ 見かた」の窓も型で測る
      await page.locator('[data-assistant-life-typed-daily] > button').first().click({ timeout: 5000 });
      await page.waitForTimeout(300);
      await page.evaluate(() => { const d = document.querySelector('[data-assistant-life-daily-typed]'); if (d) d.scrollIntoView({ block: 'center' }); });
      await shot('daily', { skipMain: true });
      await page.locator('[data-assistant-life-typed-daily] > button').first().click({ timeout: 5000 });
      await page.locator('[data-assistant-life-guide-open]').click({ timeout: 5000 });
      await page.locator('[data-assistant-life-typed-guide] [data-alu-sheet]').waitFor({ timeout: 5000 });
      await shot('guide');
      await page.locator('[data-assistant-life-typed-guide] [data-alu-sheet-close]').click({ timeout: 5000 });
      await page.evaluate(() => { const m = document.querySelector('[data-alu-main]'); if (m) m.scrollTop = 0; });
      await page.locator('[data-assistant-life-typed-house] [data-assistant-life-today-act="watch"]').click({ timeout: 5000 });
      for (let i = 0; i < 30 && !(await page.locator('[data-assistant-life-scene-done]').count()); i++) { await finishTalk(page); await page.waitForTimeout(300); }
      await page.locator('[data-assistant-life-scene-back]').first().click({ timeout: 5000 });
      await page.locator('[data-assistant-life-house-result] [data-alu-sheet]').waitFor({ timeout: 5000 });
      await shot('result');
      // 段8: 部屋(型に載せた部屋。段8の前の版では型が無いので絵だけ撮る)
      await page.locator('[data-assistant-life-house-result] [data-alu-sheet-close]').first().click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
      // 段9: 町(型に載せた町。地図の中の字は HOME と同じ札なので数えない)
      if (await page.locator('[data-alu-tab="where"]').count()) {
        await page.locator('[data-alu-tab="where"]').first().click({ timeout: 5000 });
        if (await page.locator('[data-assistant-life-typed-town]').waitFor({ timeout: 5000 }).then(() => true).catch(() => false)) {
          await page.waitForTimeout(900);
          await shot('town', { withScene: false });
          await page.evaluate(() => { const m = document.querySelector('[data-assistant-life-typed-town] [data-alu-main]'); if (m) m.scrollTop = m.scrollHeight; });
          await shot('town-bottom', { withScene: false, skipMain: true });
          // 「見る」→ その場所の窓(地図の窓。中身は前の部品)・「部屋へ」→ 部屋。開けたかだけ見る(測らない)
          await page.locator('[data-assistant-life-town-see]').first().click({ timeout: 5000 });
          if (!(await page.locator('[data-assistant-life-map-sheet]').waitFor({ timeout: 5000 }).then(() => true).catch(() => false))) result.miss.push(`${sizeId} 町: 「見る」で場所の窓が開かない`);
          else { await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${sizeId}-town-sheet.png`) }); await page.locator('[data-assistant-life-map-sheet-close]').first().click({ timeout: 3000 }); }
          await page.evaluate(() => { const m = document.querySelector('[data-assistant-life-typed-town] [data-alu-main]'); if (m) m.scrollTop = 0; });
          await page.locator('[data-assistant-life-town-room]').first().click({ timeout: 5000 });
          if (!(await page.locator('[data-assistant-life-room-sheet]').waitFor({ timeout: 5000 }).then(() => true).catch(() => false))) result.miss.push(`${sizeId} 町: 「部屋へ」で部屋が開かない`);
          else { await page.waitForTimeout(500); await page.locator('[data-assistant-life-typed-room] [data-alu-tab="where"], [data-alu-tab="where"]').last().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400); }
        } else { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, `${sizeId}-town-untyped.png`) }); }
        await page.locator('[data-alu-tab="house"], [data-assistant-life-icon="house"]').first().click({ timeout: 5000 });
        await page.locator('[data-assistant-life-typed-house]').waitFor({ timeout: 5000 });
        await page.waitForTimeout(400);
      }
      const RID = opt('--room', 'atsu');
      await page.locator(`[data-assistant-life-room="${RID}"]`).first().click({ timeout: 5000 });
      await page.locator(`[data-assistant-life-room-sheet="${RID}"]`).waitFor({ timeout: 5000 });
      const typedRoom = await page.locator('[data-assistant-life-typed-room]').count();
      if (typedRoom) {
        await shot('room', { frame: '[data-assistant-life-typed-room]', withScene: false });
        const moreBtn = page.locator('[data-assistant-life-typed-room] [data-assistant-life-room-more]').first();
        if ((await moreBtn.getAttribute('aria-expanded')) !== 'true') await moreBtn.click({ timeout: 3000 });
        await page.evaluate(() => { const m = document.querySelector('[data-assistant-life-typed-room] [data-alu-main]'); if (m) m.scrollTop = m.scrollHeight; });
        await shot('room-more', { frame: '[data-assistant-life-typed-room]', skipMain: true, withScene: false });
      } else {
        await page.waitForTimeout(900); await page.screenshot({ path: path.join(OUT, `${sizeId}-room.png`) });
        await page.evaluate(() => { const m = document.querySelector('[data-assistant-life-roomview-scroll]'); if (m) m.scrollTop = m.scrollHeight; });
        await page.waitForTimeout(400); await page.screenshot({ path: path.join(OUT, `${sizeId}-room-more.png`) });
      }
    } catch (e) { result.miss.push(`${sizeId}: ${String(e.message || e).split('\n')[0].slice(0, 140)}`); failed++; }
    await ctx.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(result, null, 1) + '\n');
  if (result.miss.length) console.log(`撮れず: ${result.miss.join(' / ')}`);
  if (result.errors.length) console.log(`ページのエラー ${result.errors.length}件: ${result.errors.slice(0, 3).join(' / ')}`);
  console.log(failed ? `NG: ${failed}件が型の決まりを外れた・撮れなかった` : `OK: 型に載せた家 ${Object.keys(result.shots).length}枚が決まりどおり`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
