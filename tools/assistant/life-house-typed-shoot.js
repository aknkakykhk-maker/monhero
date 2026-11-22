#!/usr/bin/env node
// 助手ライフの作り直し 段7: 型に載せた家(56-assistant-life-house-typed.jsx)を本物の画面で撮って、型の決まりを測る。ゲーム本体は変えない・読むだけ。
//   node tools/assistant/life-house-typed-shoot.js [--out <置き場>] [--2x]
//   置き場の既定: docs/progress/assistant-life/step7-house/(<大きさ>-<場面>.png と measure.json)
// 場面: house(開いたところ)・house-bottom(下まで送った)・result(👀 見る → 場面の終わり → 結果の1枚)
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
    await page.addInitScript(() => { window.__mhSupabaseStubbed = ['assistant_life_friend']; if (window.__untyped) window.__mhAssistantLifeUntypedHouse = true; localStorage.setItem('mh_assistant_life_ui_v2', 'true'); localStorage.setItem('mh_assistant_life_guide_seen_v1', 'true'); });
    if (UNTYPED) await page.addInitScript(() => { window.__untyped = true; });
    // --bedtry '{"headDiv":3,"bedHeads":3,"quiltDrop":0.2}' … 寝ている部屋のベッドの釣り合いの案(ページの中だけ)
    if (opt('--bedtry', '')) await page.addInitScript((t) => { window.__mhAssistantLifeBedTry = t; }, JSON.parse(opt('--bedtry', '{}')));
    // --worn kiki:kiki_twintail_v1,… … 着せ替えを着せて撮る(着替えの保存 mh_assistant_costume_*_v1 はページの中だけ)
    const WORN = Object.fromEntries((opt('--worn', '') || '').split(',').filter(Boolean).map(x => x.split(':')));
    if (Object.keys(WORN).length) await page.addInitScript((worn) => { localStorage.setItem('mh_assistant_costume_owned_v1', JSON.stringify(Object.values(worn))); localStorage.setItem('mh_assistant_costume_worn_v1', JSON.stringify(worn)); }, WORN);
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: Number(opt('--bond', '')) || null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const shot = async (name, mo = {}) => {
      await page.waitForTimeout(700);
      const file = `${sizeId}-${name}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      const m = await page.evaluate(measure, mo);
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
      await page.evaluate(() => { const m = document.querySelector('[data-alu-main]'); if (m) m.scrollTop = 0; });
      await page.locator('[data-assistant-life-typed-house] [data-assistant-life-today-act="watch"]').click({ timeout: 5000 });
      for (let i = 0; i < 30 && !(await page.locator('[data-assistant-life-scene-done]').count()); i++) { await finishTalk(page); await page.waitForTimeout(300); }
      await page.locator('[data-assistant-life-scene-back]').first().click({ timeout: 5000 });
      await page.locator('[data-assistant-life-house-result] [data-alu-sheet]').waitFor({ timeout: 5000 });
      await shot('result');
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
