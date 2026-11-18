// 寝ているときの目(2026-11-11 社長「助手ライフで寝ているときに、目を開けっぱなしの人がいる。えるびんだけそのままでいい」)
//   node tools/assistant/assistant-life-sleep-eyes-check.js
//   8人とも家で寝ている様子にして、寝姿が出る所に閉じた目(AssistantLifeSleepEyes)が重なっているかを見る
//   ① 家の部屋の顔・② 地図の全身・③ 大きな部屋のベッド: みゅあ・きき・ももすけ・あつ・きゅうこ には閉じた目が付く(社長の寝顔の絵 ◯◯_sleep.PNG に差し替えたものも数える)
//   ④ えるびん(そのまま)には付かない。ソラシドは『馬骨』の寝顔の絵 sorashido_sleep.PNG(2026-11-15 r1115-013)に差し替わるので、閉じた目に数える
//   ⑦ ドラ(眼鏡)は眼鏡を外した顔(3の字の目)になり、外した眼鏡がそばに置かれる(2026-11-11 社長「ドラはメガネ外して…メガネ3の字に」)
//   ⑤ 顔の表と全身の表に、5人とも目の位置がある ⑥ ページのエラーが出ない
//   ⑧ (2026-11-19 社長「寝顔があるのに、寝顔じゃない顔を無理やり寝顔にしようとしてる」)8人×着せ替え全部×(全身・顔・立ち絵)で、
//      寝顔の絵がある絵には SVG の目を重ねない/SVG の目・眼鏡を外した顔を重ねるのは、目の位置の表を測った絵(ふだんの服の全身・顔アイコン)だけ。ずれた目を出すくらいなら出さない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9267;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const IDS = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const CLOSE = ['mua', 'kiki', 'momosuke', 'atsu', 'kyuko'];
const OFF = ['dra']; // 眼鏡を外した顔を重ねる人
const ART_ONLY = ['sorashido']; // 目の位置の表は持たず、寝顔の絵(◯◯_sleep.PNG)だけで閉じた目になる人(r1115-013)
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
  const tables = await page.evaluate(() => ({ full: Object.keys(ASSISTANT_LIFE_SLEEP_EYES), face: Object.keys(ASSISTANT_LIFE_SLEEP_EYES_FACE), glasses: Object.keys(ASSISTANT_LIFE_SLEEP_GLASSES) }));
  check('⑤ 閉じた目の全身と顔の表に、5人とも目の位置がある(ドラ・ソラシド・えるびんは無い)', CLOSE.every(id => tables.full.includes(id) && tables.face.includes(id)) && !['dra', 'sorashido', 'erubin'].some(id => tables.full.includes(id) || tables.face.includes(id)), JSON.stringify(tables));
  check('⑦ 眼鏡を外す表にドラがいる', OFF.every(id => tables.glasses.includes(id)), tables.glasses.join(','));
  // ⑧ 絵の組み合わせ全部での決まり(画面を開かず、関数を直接呼ぶ)
  const combo = await page.evaluate(() => {
    const out = { n: 0, stacked: [], misplaced: [], noArt: [] };
    const outfits = [null, ...ASSISTANT_COSTUMES.map(c => c.id)];
    for (const who of ASSISTANTS) {
      for (const cid of outfits) {
        const c = cid ? ASSISTANT_COSTUMES.find(x => x.id === cid) : null;
        if (c && c.assistantId && c.assistantId !== who.id) continue;
        setAssistantCostumeWornNow(c ? { [who.id]: cid } : {});
        const srcs = [assistantFullImage(who, 'normal'), assistantFaceImage(who, 'normal'), `${who.imageDir}/${who.imagePrefix}_normal.PNG`, `${who.imageDir}/face/${who.imagePrefix}_normal.PNG`];
        for (const s0 of [...new Set(srcs)]) {
          out.n++;
          const shown = assistantLifeSleepSrc(who.id, s0), replaced = /_sleep\.PNG/i.test(shown);
          const el = AssistantLifeSleepEyes({ pid: who.id, src: shown, w: 100, h: 100, style: {} });
          const tag = `${who.id}/${cid || 'base'}/${s0.split('/assistant/').pop()}`;
          if (replaced && el && el.type !== 'img') out.stacked.push(tag);
          if (replaced && el && el.type === 'img' && el.props.src !== shown && !/face\//.test(shown)) out.stacked.push(tag + '(全身に顔の絵)');
          if (!replaced && el && el.type === 'svg' && !assistantLifeSleepMeasured(who.id, shown)) out.misplaced.push(tag);
          if (!replaced && !el && who.id !== 'erubin' && !(cid && true)) out.noArt.push(tag);
        }
      }
    }
    setAssistantCostumeWornNow({});
    return out;
  });
  check('⑧ 寝顔の絵がある絵には SVG の目を重ねない', combo.stacked.length === 0, `${combo.n}通り ${combo.stacked.slice(0, 3).join(' / ')}`);
  check('⑧ SVG の目・眼鏡を外した顔は、目の位置を測った絵(ふだんの服の全身・顔)にだけ重なる', combo.misplaced.length === 0, combo.misplaced.slice(0, 3).join(' / '));
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
  const want = [...CLOSE, ...OFF, ...ART_ONLY].sort().join(',');
  const gotOff = (sel) => page.evaluate((sel) => document.querySelectorAll(sel).length, sel);
  const house = await got('[data-assistant-life-room-face] [data-assistant-life-roomview-sleep-eyes]');
  check('① 家の部屋の顔: 5人とソラシド(寝顔の絵)に閉じた目・ドラは眼鏡を外した顔', house.join(',') === want, house.join(','));
  check('⑦ 家の部屋の顔: ドラは眼鏡を外した顔で、外した眼鏡が置いてある', await gotOff('[data-assistant-life-room-face="dra"] [data-assistant-life-sleep-glasses-off="dra"]') === 1 && await gotOff('[data-assistant-life-room-face="dra"] [data-assistant-life-sleep-glasses-put="dra"]') === 1);
  await page.locator('[data-assistant-life-icon="where"]').click(); await page.waitForTimeout(1800);
  const map = await gotAll('[data-assistant-life-map-fig]');
  check('② 地図の全身: 5人とソラシド(寝顔の絵)に閉じた目・ドラは眼鏡を外した顔', map.join(',') === want, map.join(','));
  check('⑦ 地図の全身: ドラの足もとに外した眼鏡', await gotOff('[data-assistant-life-map-fig] [data-assistant-life-sleep-glasses-off="dra"]') === 1 && await gotOff('[data-assistant-life-sleep-glasses-put="dra"]') >= 1);
  await page.locator('[data-assistant-life-map-back]').click(); await page.waitForTimeout(600);
  const bed = [];
  for (const id of IDS) {
    await page.locator(`[data-assistant-life-room="${id}"]`).first().click({ timeout: 3000 }); await page.waitForTimeout(1200);
    const g = await gotAll('[data-assistant-life-room-sheet]');
    if (g.includes(id)) bed.push(id);
    if (id === 'dra') check('⑦ 大きな部屋のベッド: ドラは眼鏡を外した顔で、横の台に眼鏡', await gotOff('[data-assistant-life-room-sheet] [data-assistant-life-sleep-glasses-off="dra"]') === 1 && await gotOff('[data-assistant-life-room-sheet] [data-assistant-life-roomview-nightstand="dra"] [data-assistant-life-sleep-glasses-put="dra"]') === 1);
    else if (await gotOff('[data-assistant-life-room-sheet] [data-assistant-life-roomview-nightstand]')) check(`⑦ ${id} の部屋には眼鏡の台が出ない`, false);
    await page.locator('[data-assistant-life-roomview-close]').click().catch(() => {}); await page.waitForTimeout(400);
  }
  check('③④ 大きな部屋のベッド: 5人とソラシド(寝顔の絵)に閉じた目・ドラは眼鏡を外した顔・えるびんには付かない', [...bed].sort().join(',') === want, bed.join(','));
  check('⑥ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
