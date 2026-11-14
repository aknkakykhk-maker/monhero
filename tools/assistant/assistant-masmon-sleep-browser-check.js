#!/usr/bin/env node
// 助手のマスモンの「冬眠」と「合体」を、本物のゲームを開いて確かめる(印 assistantMasmonSleep・assistantMasmonFuse・assistantMasmonBond をページの中だけ真にする)。2026-11-12 キズナ
//   node tools/assistant/assistant-masmon-sleep-browser-check.js [--shots]   縦 390×844・横 844×390・幅 320×640
//   ① 冬眠の一覧: 冬眠中のマスモンにランクと総合力、寿命が来た子には「⏳ 寿命」の印。くわしい画面に忠誠度・人気・年齢・寿命(眠らせたときの写し)
//   ② 眠らせる(起きている子と冬眠中の子の入れ替え): 起きた子は眠らせたときの忠誠度・人気・年齢のまま、その日から数え直す(眠っていた日は年をとらない)。
//      眠った子は絆の写しを持って冬眠へ。6能力も眠らせたときのまま
//   ③ 合体: 見通しに総合力とランク・年齢(0歳・寿命も新しく)・忠誠度(主のまま)・人気(2体の高い方の半分)。2回押すと合体し、素材はいなくなり、
//      できた子は Lv 1・0歳・寿命0。起こすと伸びる(寿命が来た主から生まれても伸びが止まらない)・育てた次の日に1か月年をとる
//   ⑤ ミハリ fable の指摘の再現: 眠らせて起こしても、その日の伸びの数え(dg)は数え直しにならない/眠った子の育成・修行の行は箱を書き終えたら外れる
//      (同じ枠に同じ種類の別の子が来ても受け継がない)/合体のすばやい2度押しでは合体しない/修行の読み込み前は入れ替えない
//   ④ どの画面も横にはみ出さない・ボタンが画面の外に出ない・ページのエラーが無い
//   --shots で docs/progress/assistant-peer/shots/masmon-sleep-*.png / masmon-fuse-*.png
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9264;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/shots');
const VIEWS = [{ id: 'p', name: '縦 390×844', w: 390, h: 844 }, { id: 'l', name: '横 844×390', w: 844, h: 390 }, { id: 'n', name: '幅 320×640', w: 320, h: 640 }];
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 開いているシート(または一覧)の中身が横にはみ出さない・ボタンが画面の外に出ない
const layoutNg = (page, sel) => page.evaluate((sel) => {
  const ng = []; const box = document.querySelector(sel); if (!box) return [`${sel} が無い`];
  const W = window.innerWidth;
  for (const el of box.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    if (r.right > W + 1 || r.left < -1) ng.push(`画面の外へ: ${(el.getAttribute('data-amgs-bed') || el.tagName)} ${Math.round(r.left)}〜${Math.round(r.right)}`);
  }
  for (const el of box.querySelectorAll('div,p')) if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible') ng.push(`横にはみ出す: ${el.textContent.slice(0, 16)}`);
  return [...new Set(ng)].slice(0, 5);
}, sel);

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const v of VIEWS) {
      const T = `[${v.name}] `;
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
      const errors = []; page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 160)));
      await page.route(/supabase\.co|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
      // 仲良し度を上げて、ききに迎えたマスモンを3体以上にする(ページの中だけ)
      await page.addInitScript(() => { try { localStorage.setItem('mh_assistant_bond_kiki_v1', JSON.stringify({ points: 1800 })); } catch {} });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page);
      // 仕込み: 起きている子(枠2)の絆と、冬眠中の2体(主=寿命が来た子・素材)。保存はページの中だけ
      const prep = await page.evaluate(async () => {
        Object.assign(RELEASE_FLAGS, { assistantMasmonGrow: true, assistantMasmonPlan: true, assistantMasmonBond: true, assistantMasmonSleep: true, assistantMasmonFuse: true });
        await ASSISTANT_MASMON_STORE.load(); await assistantMasmonEnsureMade();
        await Promise.all([AMG_STORE.load(), AMGT_STORE.load(), AMGB_STORE.load(), AMGP_STORE.load(), AMGP_CSTORE.load(), AMGS_STORE.load(), AMGS_FSTORE.load()]);
        const rows = assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, 'kiki');
        await amgTick('kiki');
        const day = amgSlotDay(amgSlotOf());
        const awake = rows.find(r => r.slot === 2) || rows[1] || rows[0];
        const e = amgEntryOf('kiki', awake);
        if (!e) return { err: '起きている子の育成が無い' };
        // 起きている子: 忠誠77・人気33・9か月・寿命の3割
        const k = amgbKey('kiki', awake.slot, awake.monster); const st0 = AMGB_STORE.state;
        amgbSave({ ...st0, start: st0.start < 0 ? day - 9 : st0.start, mons: { ...st0.mons, [k]: amgbNormOne({ ...(st0.mons[k] || {}), loy: 77, pop: 33, age: 9, life: 300, last: day, touch: day, fight: day }) } });
        const used = new Set(rows.map(r => r.monster));
        const free = Object.keys(AMG_INIT).filter(m => !used.has(m) && ALL_PLAYER_MONSTERS[m]);
        const [mA, mB] = free;
        const stOf = (base) => { const o = {}; AMG_KEYS.forEach((kk, i) => { o[kk] = base + i * 7; }); return o; };
        const techA = (amgtTechsOf(mA) || [])[0]; const techB = (amgtTechsOf(mB) || [])[0];
        const gOf = (base, lv) => ({ ...e, st: stOf(base), lv, xp: 0, fat: 12, str: 8, log: [], dg: { d: 0, n: 0 } });
        const tOf = (tech, m) => (tech ? { m: { [tech.id]: m }, learn: [tech.id], day: { d: -1, n: 0 }, log: [], src: 'init_v1' } : null);
        const beds = [
          { id: 'b901', aid: 'kiki', slot: awake.slot, src: 'sleep', at: '2026-11-01', fat: '', row: { monster: mA, nick: 'ながいきの主', lv: 34, grow: '攻撃型', colors: ['red', 'gold'] }, g: gOf(620, 18), t: tOf(techA, 80), c: null, bd: amgbNormOne({ loy: 70, pop: 80, age: 30, life: 1000, last: day - 3, touch: day - 3, fight: day - 3 }) },
          { id: 'b902', aid: 'kiki', slot: awake.slot, src: 'sleep', at: '2026-11-05', fat: '', row: { monster: mB, nick: 'そざいくん', lv: 25, grow: '防御型', colors: ['blue'] }, g: { ...gOf(560, 14), dg: { d: day, n: 30 } }, t: tOf(techB, 40), c: null, bd: amgbNormOne({ loy: 40, pop: 20, age: 20, life: 700, last: day - 4, touch: day - 4, fight: day - 4 }) },
        ];
        const ss = AMGS_STORE.state;
        AMGS_STORE.save({ ...ss, seq: Math.max(ss.seq, 902), beds: [...ss.beds, ...beds.map(b => ({ ...b, g: amgsGrowOk('kiki', b.row.monster, b.g), t: b.t ? amgsTrainOk('kiki', b.row.monster, b.t) : null }))] });
        const el = document.createElement('div'); el.id = 'sleep-browser-check'; document.body.appendChild(el);
        ReactDOM.createRoot(el).render(React.createElement(AssistantMasmonNote, { onClose: () => {} }));
        return { awake: { slot: awake.slot, monster: awake.monster, nick: awake.nick, key: amgpKey('kiki', awake.slot, awake.monster), pow: e.st.pow }, mA, mB, day, slots: rows.map(r => r.slot) };
      });
      if (prep.err) { check(`${T}仕込み`, false, prep.err); await page.close(); continue; }
      await page.locator('[data-amgs-section]').waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(600);

      // ① 冬眠の一覧
      const list = await page.evaluate(() => {
        const b1 = document.querySelector('[data-amgs-bed="b901"]'); const b2 = document.querySelector('[data-amgs-bed="b902"]');
        return { b1: !!b1, b2: !!b2, tag1: !!(b1 && b1.querySelector('[data-amgb-bed-power]')), tag2: !!(b2 && b2.querySelector('[data-amgb-bed-power]')), over1: !!(b1 && b1.querySelector('[data-amgb-bed-over]')), over2: !!(b2 && b2.querySelector('[data-amgb-bed-over]')), fuse: !!document.querySelector('[data-amgs-fuse-open]') };
      });
      check(`${T}① 冬眠の一覧にランクと総合力・寿命が来た子だけ「⏳ 寿命」`, list.b1 && list.b2 && list.tag1 && list.tag2 && list.over1 && !list.over2, JSON.stringify(list));
      check(`${T}① 冬眠中が2体そろうと「🧬 合体する」が出る`, list.fuse);
      check(`${T}① 冬眠の一覧が横にはみ出さない`, !(await layoutNg(page, '[data-amgs-section]')).length, (await layoutNg(page, '[data-amgs-section]')).join(' / '));
      if (SHOTS) { await page.locator('[data-amgs-section]').scrollIntoViewIfNeeded().catch(() => {}); await page.locator('[data-amgs-section]').screenshot({ path: path.join(shotDir, `masmon-sleep-list-${v.id}.png`) }).catch(() => {}); }

      await page.locator('[data-amgs-bed="b901"]').click();
      await page.locator('[data-amgs-detail]').waitFor({ timeout: 5000 });
      const det = await page.evaluate(() => { const p = document.querySelector('[data-amgs-detail] [data-amgb-bed-panel]'); const g = (s) => (p && p.querySelector(s) ? p.querySelector(s).textContent : ''); return { panel: !!p, loy: g('[data-amgb-bed-loy]'), pop: g('[data-amgb-bed-pop]'), age: g('[data-amgb-bed-age]'), life: g('[data-amgb-bed-life]') }; });
      check(`${T}① くわしい画面に眠らせたときの忠誠度・人気・年齢・寿命`, det.panel && det.loy === '70' && det.pop === '80' && /2歳6か月/.test(det.age) && /寿命/.test(det.life) && /もう伸びません/.test(det.life), JSON.stringify(det));
      const dng = await layoutNg(page, '[data-amgs-detail]');
      check(`${T}① くわしい画面が横にはみ出さない`, !dng.length, dng.join(' / '));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-sleep-detail-${v.id}.png`) });
      await page.locator('[data-amgs-detail] [data-mhl-sheet-close]').first().click();

      // ⑤ 修行の保存を読み込む前は入れ替えない(技と熟練の写しを取り損ねない)
      const notYet = await page.evaluate((slot) => { AMGT_STORE.loaded = false; const r = amgsSwap('b902', slot); AMGT_STORE.loaded = true; return { r, still: AMGS_STORE.state.beds.some(b => b.id === 'b902') }; }, prep.awake.slot);
      check(`${T}⑤ 修行の読み込み前は「読み込み中です」で入れ替えない`, notYet.r === '読み込み中です' && notYet.still, JSON.stringify(notYet));
      // ② 眠らせる: 起きている子(枠2)と、冬眠中の素材候補(b902)を入れ替える
      const card = page.locator(`[data-amgp-mon="${prep.awake.key}"]`);
      await card.locator('[data-amgs-sleep]').scrollIntoViewIfNeeded().catch(() => {});
      await card.locator('[data-amgs-sleep]').click();
      await page.locator('[data-amgs-sleep-sheet]').waitFor({ timeout: 5000 });
      const sng = await layoutNg(page, '[data-amgs-sleep-sheet]');
      check(`${T}② 眠らせるシートが横にはみ出さない`, !sng.length, sng.join(' / '));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-sleep-swap-${v.id}.png`) });
      await page.locator('[data-amgs-sleep-with="b902"]').click();
      await page.waitForTimeout(800);
      const fx = await page.evaluate((a) => {
        const rows = assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, 'kiki'); const r = rows.find(x => x.slot === a.slot); const e = amgEntryOf('kiki', r);
        const key = amgMonKey(a.slot, a.monster); let saved = null; try { saved = JSON.parse(localStorage.getItem('mh_assistant_masmon_grow_v1')); } catch (_) {}
        const savedRow = saved && saved.mons && saved.mons.kiki ? saved.mons.kiki[key] : undefined;
        return { dgN: e && e.dg ? e.dg.n : null, dgD: e && e.dg ? e.dg.d : null, day: amgSlotDay(amgSlotOf()), gRow: !!(AMG_STORE.state.mons.kiki || {})[key], tRow: !!(AMGT_STORE.state.mons.kiki || {})[key], savedRow: savedRow === undefined ? 'なし' : (savedRow ? 'あり' : 'なし'), bedG: AMGS_STORE.state.beds.some(b => b.row.monster === a.monster && b.g) };
      }, { ...prep.awake });
      check(`${T}⑤ 起こした子のその日の伸びの数えは眠らせたときのまま(30)`, fx.dgN === 30 && fx.dgD === fx.day, JSON.stringify(fx));
      check(`${T}⑤ 眠った子の育成・修行の行は外れ、6能力は冬眠の箱にだけある`, !fx.gRow && !fx.tRow && fx.savedRow === 'なし' && fx.bedG, JSON.stringify(fx));
      const sw = await page.evaluate((a) => {
        const rows = assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, 'kiki'); const r = rows.find(x => x.slot === a.slot);
        const b = r ? AMGB_STORE.state.mons[amgbKey('kiki', r.slot, r.monster)] : null; const e = r ? amgEntryOf('kiki', r) : null;
        const bed = AMGS_STORE.state.beds.find(x => x.row.monster === a.monster && x.aid === 'kiki');
        const day = amgSlotDay(amgSlotOf());
        return { now: r && r.monster, nick: r && r.nick, loy: b && b.loy, pop: b && b.pop, age: b && b.age, life: b && b.life, last: b && b.last, day, pow: e && e.st.pow,
          old: !!AMGB_STORE.state.mons[amgbKey('kiki', a.slot, a.monster)], bed: bed ? { id: bed.id, loy: bed.bd && bed.bd.loy, age: bed.bd && bed.bd.age, pow: bed.g && bed.g.st.pow } : null, gone: !AMGS_STORE.state.beds.some(x => x.id === 'b902') };
      }, { ...prep.awake });
      check(`${T}② 起きた子は眠らせたときの忠誠度・人気・年齢・寿命のまま、今日から数え直す`, sw.now === prep.mB && sw.loy === 40 && sw.pop === 20 && sw.age === 20 && sw.life === 700 && sw.last === sw.day && sw.pow === 567 && sw.gone, JSON.stringify(sw));
      check(`${T}② 眠った子は絆の写し(忠誠77・9か月)と6能力を持って冬眠へ・起きている行は消える`, sw.bed && sw.bed.loy === 77 && sw.bed.age === 9 && sw.bed.pow === prep.awake.pow && !sw.old, JSON.stringify(sw.bed));

      // ③ 合体: 主 b901(寿命が来た子) + 素材 = いま眠った子
      await page.locator('[data-amgs-fuse-open]').scrollIntoViewIfNeeded().catch(() => {});
      await page.locator('[data-amgs-fuse-open]').click();
      await page.locator('[data-amgs-fuse]').waitFor({ timeout: 5000 });
      await page.locator('[data-amgs-fuse] [data-amgs-fuse-pick="b901"]').click();
      await page.locator(`[data-amgs-fuse] [data-amgs-fuse-pick="${sw.bed.id}"]`).click();
      await page.locator('[data-amgs-fuse-plan]').waitFor({ timeout: 5000 });
      const pv = await page.evaluate(() => { const p = document.querySelector('[data-amgb-fuse-preview]'); const at = (s, a) => { const x = p && p.querySelector(s); return x ? x.getAttribute(a) : null; }; return { has: !!p, loy: at('[data-amgb-fuse-loy]', 'data-amgb-fuse-loy'), pop: at('[data-amgb-fuse-pop]', 'data-amgb-fuse-pop'), power: at('[data-amgb-fuse-power]', 'data-amgb-fuse-power'), age: p && p.querySelector('[data-amgb-fuse-age]') ? p.querySelector('[data-amgb-fuse-age]').textContent : '', lose: !!document.querySelector('[data-amgs-fuse-lose]') }; });
      check(`${T}③ 見通しに総合力・0歳・忠誠度(主のまま70)・人気(高い方80の半分=40)`, pv.has && pv.loy === '70' && pv.pop === '40' && Number(pv.power) > 0 && /0歳0か月/.test(pv.age) && pv.lose, JSON.stringify(pv));
      const fng = await layoutNg(page, '[data-amgs-fuse]');
      check(`${T}③ 合体の画面が横にはみ出さない`, !fng.length, fng.join(' / '));
      if (SHOTS) { await page.locator('[data-amgb-fuse-preview]').scrollIntoViewIfNeeded().catch(() => {}); await page.screenshot({ path: path.join(shotDir, `masmon-fuse-plan-${v.id}.png`) }); }
      const fast = await page.evaluate(async () => { const n0 = AMGS_STORE.state.beds.length; const b = () => document.querySelector('[data-amgs-fuse-go]'); b().click(); await new Promise(r => setTimeout(r, 60)); b().click(); await new Promise(r => setTimeout(r, 120)); return { n0, n1: AMGS_STORE.state.beds.length, sure: b().getAttribute('data-amgs-fuse-go') }; });
      check(`${T}⑤ すばやい2度押しでは合体しない(2回目は少し待ってから)`, fast.n0 === fast.n1 && fast.sure === '1', JSON.stringify(fast));
      const once = await page.evaluate(() => AMGS_STORE.state.beds.length);
      await page.locator('[data-amgs-fuse-go="1"][data-amgs-fuse-ready="1"]').waitFor({ timeout: 3000 });
      await page.locator('[data-amgs-fuse-go="1"]').scrollIntoViewIfNeeded().catch(() => {});
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-fuse-sure-${v.id}.png`) });
      await page.locator('[data-amgs-fuse-go="1"]').click();
      await page.locator('[data-amgs-fuse-done]').waitFor({ timeout: 5000 }).catch(() => {});
      const fz = await page.evaluate((a) => {
        const beds = AMGS_STORE.state.beds; const c = beds.find(b => b.row.monster === a.mA);
        return { n: beds.length, mat: beds.some(b => b.row.monster === a.monster), c: c ? { id: c.id, lv: c.row.lv, glv: c.g && c.g.lv, age: c.bd && c.bd.age, life: c.bd && c.bd.life, loy: c.bd && c.bd.loy, pop: c.bd && c.bd.pop, fat: c.g && c.g.fat } : null, log: AMGS_FSTORE.state.log.length, done: !!document.querySelector('[data-amgs-fuse-done]'), doneText: (document.querySelector('[data-amgs-fuse-done]') || {}).textContent || '' };
      }, { mA: prep.mA, monster: prep.awake.monster });
      check(`${T}③ 1回目の「合体する」では、まだ合体しない(2回押す)`, once === fz.n + 1, `${once}→${fz.n}`);
      check(`${T}③ 合体すると素材はいなくなり、できた子は Lv1・育成Lv1・0歳・寿命0・忠誠70・人気40`, fz.done && !fz.mat && fz.c && fz.c.lv === 1 && fz.c.glv === 1 && fz.c.age === 0 && fz.c.life === 0 && fz.c.loy === 70 && fz.c.pop === 40 && fz.c.fat === 0 && fz.log === 1 && /0歳/.test(fz.doneText), JSON.stringify(fz));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-fuse-done-${v.id}.png`) });
      await page.locator('[data-amgs-fuse] [data-mhl-sheet-close]').first().click();

      // ③ できた子を起こす(枠2の子と入れ替え)→ 伸びる・次の日に1か月
      await page.locator(`[data-amgs-bed="${fz.c.id}"]`).scrollIntoViewIfNeeded().catch(() => {});
      await page.locator(`[data-amgs-bed="${fz.c.id}"]`).click();
      await page.locator('[data-amgs-detail] [data-amgs-wake]').click();
      await page.locator(`[data-amgs-detail] [data-amgs-slot="${prep.awake.slot}"]`).click();
      await page.waitForTimeout(400);
      const wk = await page.evaluate((a) => {
        const rows = assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, 'kiki'); const r = rows.find(x => x.slot === a.slot);
        const b = AMGB_STORE.state.mons[amgbKey('kiki', r.slot, r.monster)];
        const over = amgbLifeOver('kiki', r); const mult = amgbGainMult('kiki', r, null);
        // 次の日の育成の回(ページの中だけ・保存はしない)
        const keep = AMGB_STORE.state; const s = amgSlotOf(); amgbTick('kiki', r, s); amgbTick('kiki', r, s + 3); // 合体の子は最初の育成の回から数え始める(last<0)
        const next = AMGB_STORE.state.mons[amgbKey('kiki', r.slot, r.monster)]; AMGB_STORE.set(keep);
        return { now: r.monster, age: b && b.age, life: b && b.life, over, mult, nextAge: next && next.age, nextLife: next && next.life };
      }, { ...prep.awake });
      check(`${T}③ 起こした合体の子は伸びる(寿命が来た主から生まれても止まらない)`, wk.now === prep.mA && wk.age === 0 && wk.over === false && wk.mult > 0, JSON.stringify(wk));
      check(`${T}③ 合体の子は育てた次の日に0歳1か月`, wk.nextAge === 1 && wk.nextLife > 0 && wk.nextLife < 1000, JSON.stringify(wk));

      check(`${T}④ ページのエラーが無い`, !errors.length, errors.slice(0, 3).join(' / '));
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `NG ${failed} 件` : 'OK: 冬眠と合体(縦・横・幅320)');
  process.exit(failed ? 1 : 0);
})();
