#!/usr/bin/env node
// 助手ライフを開いたまま、裏でクイック∞周回を回す(2026-11-08 社長「助手ライフ画面でも裏クイックほしい」)を実際のブラウザで確かめる。
//
//   node tools/assistant/assistant-life-quick-run-browser-check.js
//
// 見るもの(60-app.jsx 側。札の見た目は 56-assistant-life*.jsx・ナカヨシ8)
//   ① 助手ライフを開くと、AUTO設定のクイック周回がそろっていれば「始められる」(quickRun.canStart)。開いただけでは始まらない
//   ② 始めると、HOME(助手ライフの下)のまま周回が進む。バトル画面へ飛ばない
//   ③ 裏で回しているあいだ、バトルの効果音を鳴らさない(効果音の音量が0)
//   ④ 助手ライフを閉じると締まる: 報酬(ダイヤ・ブリーダー経験値)が入り、HOME に残り、周回(段階)が残らない
//   ⑤ 止める(onQuickRunStop)でも同じく締まり、助手ライフは開いたまま
//   ⑥ どこでも実行時エラーが出ない
//   ⑦ AUTO設定の「モンヒロビート・助手ライフを開いたら自動で始める」が ON なら、開いた瞬間に始まる(OFF なら始まらない=①)。
//      止めたあとは、開いたままでは始め直さない。閉じてもう一度開けば、また始まる(2026-11-08 社長)
//   ⑨ 回しているあいだ、助手ライフが揺れない・お祝いの全面シートは貯めておく(止めると出る)
//   ⑧ 本物の帯で(ナカヨシ8): ほかのモードと同じ帯(RhythmQuickRunPill・詳細・止める)の「◯周目」が進む・縦/横/タブレット/🔄横で重ならない・
//      🔄横で助手ライフが回した画面いっぱいに出る・詳細の窓が上に出る・止めると締まる・止めたあと始め直せる(--shots で shots/lifequick/strip-*.jpg)
// 札(ボタン)がまだ無くても動くよう、AssistantLifeScreen に渡る props を横から受け取って押す(札ができたらそのボタンでも同じ道を通る)
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8981;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const seed = () => {
  if (sessionStorage.getItem('__alqSeeded')) return;
  sessionStorage.setItem('__alqSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3); put('mh_quick_clears_Beginner', 3);
  put('mh_auto_settings_v1', { strategy: 'random', allies: [{ rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }, { rosterEntry: null, slot: null }],
    breakthroughReserve: { gold: 0, psyche: 0 }, quickRun: { heroRosterEntry: 'Suezo', distance: 2, difficulty: 'Beginner', autoStart: false } });
  put('mh_gold', 1000);
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.addInitScript(seed);
  await page.addInitScript(quiet.quietBootSeed());
  await page.addInitScript(quiet.updateNoticeSeed());
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  try {
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
    const closePopups = () => page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText || '').trim()) && !x.closest('[data-mh-screen]'));
      if (b) { b.click(); return true; }
      const fx = document.querySelector('[data-growth-fx-sheet]'); if (fx) { fx.click(); return true; }
      return false;
    });
    for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) {
      if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {});
      await closePopups();
      await page.waitForTimeout(500);
    }
    for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(300);
    // AssistantLifeScreen に渡る props を受け取る口・効果音の音量の控え
    await page.evaluate(() => {
      const orig = window.AssistantLifeScreen;
      window.AssistantLifeScreen = function (p) { window.__alq = p; return orig(p); };
      const set = Audio_.setSeVolume;
      Audio_.setSeVolume = (v) => { window.__seVol = v; return set(v); };
    });
    const state = () => page.evaluate(() => ({ q: window.__alq ? window.__alq.quickRun : undefined, se: window.__seVol,
      battle: !!document.querySelector('button[aria-label^="AUTO"]'), home: !!document.querySelector('button[aria-label="モンヒロバトル"]'),
      gold: JSON.parse(localStorage.getItem('mh_gold') || '0'), xp: JSON.parse(localStorage.getItem('mh_breeder_xp') || '0') }));
    const openLife = async () => { await page.evaluate(() => assistantLifeOpenScreen()); await page.waitForTimeout(1500); for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300); };
    // ① 開くと始められる。開いただけでは始まらない
    await openLife();
    let s = await state();
    check('① 助手ライフを開くと、AUTO設定のクイック周回を始められる(開いただけでは始まらない)', !!s.q && s.q.canStart === true && s.q.live === false && s.q.loops === 0, JSON.stringify(s.q));
    // ② 始めると HOME のまま進む
    const before = await state();
    await page.evaluate(() => window.__alq.onQuickRunStart());
    let live = false, loopsSeen = 0, jumped = false;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(500);
      s = await state();
      if (s.battle) jumped = true;
      if (s.q && s.q.live) live = true;
      if (s.q) loopsSeen = Math.max(loopsSeen, s.q.loops || 0);
    }
    check('② 始めると、助手ライフの下(HOME)のまま周回が進む。バトル画面へ飛ばない', live && loopsSeen >= 1 && !jumped && s.home, JSON.stringify({ live, loopsSeen, jumped, q: s.q }));
    check('② 獲得の見込み(ダイヤ・経験値)が増えていく', !!s.q && (s.q.gold > 0 || s.q.xp > 0), JSON.stringify(s.q));
    // ③ 効果音は鳴らさない
    check('③ 裏で回しているあいだ、バトルの効果音は鳴らさない(効果音の音量0)', s.se === 0, String(s.se));
    // ④ 閉じると締まる
    await page.evaluate(() => ASSISTANT_LIFE_STORE.set({ open: false }));
    await page.waitForTimeout(3500);
    for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(400);
    const afterClose = await state();
    check('④ 閉じると締まり、報酬(ダイヤか経験値)が入る', afterClose.gold > before.gold || afterClose.xp > before.xp, JSON.stringify({ before: [before.gold, before.xp], after: [afterClose.gold, afterClose.xp] }));
    check('④ 閉じたあとも HOME のまま(バトル画面へ行かない)', afterClose.home && !afterClose.battle);
    await page.waitForTimeout(6000);
    check('④ 閉じたあと、しばらく待ってもバトルへ飛ばない(段階が残っていない)', !(await state()).battle && (await state()).home);
    check('④ 閉じたあとは効果音の音量が元に戻る', (await state()).se !== 0, String((await state()).se));
    await openLife();
    s = await state();
    check('④ 開き直すと、前の周回は残っておらず、新しく始められる', !!s.q && s.q.live === false && s.q.canStart === true && s.q.loops === 0, JSON.stringify(s.q));
    // ⑤ 止めるでも締まる(助手ライフは開いたまま)
    const before2 = await state();
    await page.evaluate(() => window.__alq.onQuickRunStart());
    await page.waitForTimeout(12000);
    for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300);
    await page.evaluate(() => window.__alq.onQuickRunStop());
    await page.waitForTimeout(3000);
    s = await state();
    check('⑤ 止めると締まり、報酬が入る。助手ライフは開いたまま・HOME のまま', (s.gold > before2.gold || s.xp > before2.xp) && !!s.q && s.q.live === false && s.home && !s.battle
      && await page.evaluate(() => !!(ASSISTANT_LIFE_STORE.state && ASSISTANT_LIFE_STORE.state.open)), JSON.stringify({ q: s.q, gold: [before2.gold, s.gold] }));
    // ⑦ 自動で始める(スイッチ ON にして開き直す)
    await page.evaluate(() => ASSISTANT_LIFE_STORE.set({ open: false }));
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const k = 'mh_auto_settings_v1'; const v = JSON.parse(localStorage.getItem(k)); v.quickRun.autoStart = true; localStorage.setItem(k, JSON.stringify(v)); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) {
      if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {});
      await closePopups();
      await page.waitForTimeout(500);
    }
    for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(300);
    await page.evaluate(() => { const orig = window.AssistantLifeScreen; window.AssistantLifeScreen = function (p) { window.__alq = p; return orig(p); }; });
    await openLife();
    await page.waitForTimeout(2500);
    s = await state();
    check('⑦ スイッチ ON なら、助手ライフを開いた瞬間に周回が始まる', !!s.q && s.q.live === true, JSON.stringify(s.q));
    await page.evaluate(() => window.__alq.onQuickRunStop());
    await page.waitForTimeout(7000);
    s = await state();
    check('⑦ 止めたあとは、開いたままでは始め直さない', !!s.q && s.q.live === false && s.q.loops === 0, JSON.stringify(s.q));
    await page.evaluate(() => ASSISTANT_LIFE_STORE.set({ open: false }));
    await page.waitForTimeout(2000);
    await openLife();
    await page.waitForTimeout(2500);
    s = await state();
    check('⑦ 閉じてもう一度開けば、また自動で始まる', !!s.q && s.q.live === true, JSON.stringify(s.q));
    // ⑨ 回しているあいだ、助手ライフが揺れない(裏のバトルの画面の揺れが効かない)・お祝いの全面シートは貯めておく(2026-11-08 社長「画面がめちゃくちゃ動く」「中途半端」)
    {
      await page.evaluate(() => { window.__q9 = { moves: 0, sheets: 0, fx: 0, dim: 0, n: 0 }; let prev = null; window.__q9T = setInterval(() => { const r = document.querySelector('.mhl-root'); if (!r) return; const b = r.getBoundingClientRect(); const k = `${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.width)}`; if (prev && prev !== k) window.__q9.moves++; prev = k; if (document.querySelector('[data-growth-fx-sheet]')) window.__q9.sheets++; if (/NEW CARD!|POWER UP!|VICTORY|DEFEAT/.test(document.body.innerText)) window.__q9.fx++; if (document.querySelector('[data-ultra-eco-session-dimmer]')) window.__q9.dim++; window.__q9.n++; }, 100); });
      await page.waitForTimeout(45000); // 1周(約40秒)のあいだに、WAVE10 のあとの割り込みの場面も通る
      const q9 = await page.evaluate(() => { clearInterval(window.__q9T); return window.__q9; });
      check('⑨ 回しているあいだ、助手ライフの画面が揺れない(裏のバトルの揺れが効かない)', q9.n > 100 && q9.moves === 0, JSON.stringify(q9));
      check('⑨ 回しているあいだ、お祝いの全面シートは出さずに貯めておく', q9.sheets === 0, JSON.stringify(q9));
      check('⑨ 回しているあいだ、裏のバトルの全面の演出(NEW CARD!・VICTORY など)と超省エネの暗幕を出さない(モンヒロビート・カードと同じ)', q9.fx === 0 && q9.dim === 0, JSON.stringify(q9));
    }
    // ⑧ 本物の帯で(ナカヨシ8。社長「他のモードと同じような表示に」: ビート・カードと同じ RhythmQuickRunPill の帯)
    {
      const SHOTS = process.argv.includes('--shots');
      const shotDir = path.join(root, 'docs/progress/assistant-peer/shots/lifequick');
      const strip = () => page.evaluate(() => { const el = document.querySelector('[data-assistant-life-quick-strip] [data-life-quick-run]'); if (!el) return null;
        const rot = typeof RHYTHM_VIEW_ROTATION !== 'undefined' && RHYTHM_VIEW_ROTATION.active(); const R0 = (e) => (rot ? RHYTHM_VIEW_ROTATION.rectOf(e) : e.getBoundingClientRect());
        const W = rot ? innerHeight : innerWidth;
        const R = R0(el); const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1; const ng = [];
        for (const sel of ['[data-assistant-life-title]', '[data-assistant-life-clock-box]', '[data-assistant-life-clock]', '[data-assistant-life-tier]', '[data-assistant-life-close]', '[data-assistant-life-icons]']) for (const o of document.querySelectorAll(sel)) if (o.getClientRects().length && hit(R, R0(o))) ng.push(sel);
        // 帯は助手ライフの画面の中に収まる。助手ライフの画面は、回した器(🔄横)か画面の中に収まる(器の大きさが遅れて変わる回もあるので、器そのものと比べる)
        const root = document.querySelector('.mhl-root'), RR = root ? R0(root) : null;
        const frame = rot ? document.querySelector('[data-mh-view-rotation="true"]') : null, FR = frame ? R0(frame) : { left: 0, right: innerWidth };
        if (RR && (R.right > RR.right + 1 || R.left < RR.left - 1)) ng.push(`帯が助手ライフからはみ出す ${Math.round(R.left)}〜${Math.round(R.right)} / ${Math.round(RR.left)}〜${Math.round(RR.right)}`);
        if (RR && (RR.right > FR.right + 1 || RR.left < FR.left - 1)) ng.push(`助手ライフが画面からはみ出す ${Math.round(RR.left)}〜${Math.round(RR.right)} / ${Math.round(FR.left)}〜${Math.round(FR.right)}${rot ? '(器)' : ''}`);
        for (const t of el.querySelectorAll('button,small')) if (t.getClientRects().length && t.scrollWidth > t.clientWidth + 1 && !/周目|WAVE/.test(t.textContent)) ng.push(`字が切れる ${t.textContent}`);
        const m = el.textContent.match(/(\d+)周目/);
        return { run: el.getAttribute('data-life-quick-run'), loop: m ? Number(m[1]) : 0, text: el.textContent, ng, oldChip: !!document.querySelector('[data-assistant-life-quick-run]') }; });
      let c0 = await strip();
      check('⑧ 開くと、ほかのモードと同じ帯(「🔁 WAVE ◯/10・◯周目」・詳細・止める)が出る。前の小さな札は出さない', !!c0 && c0.run === 'live' && /WAVE \d+\/10・\d+周目/.test(c0.text) && /詳細/.test(c0.text) && /止める/.test(c0.text) && !c0.oldChip, JSON.stringify(c0));
      let grew = false; for (let i = 0; i < 180 && !grew; i++) { await page.waitForTimeout(500); const c = await strip(); if (c && c.loop > (c0 ? c0.loop : 0)) grew = true; }
      check('⑧ 帯の「◯周目」が進む', grew, JSON.stringify(await strip()));
      for (const [w, h, tag, rot] of [[390, 844, 'tate', 0], [844, 390, 'yoko', 0], [820, 1180, 'tablet', 0], [390, 844, 'rot', 90]]) {
        await page.setViewportSize({ width: w, height: h }); await page.evaluate((a) => { if (typeof RHYTHM_VIEW_ROTATION !== 'undefined') RHYTHM_VIEW_ROTATION.set(a); }, rot); await page.waitForTimeout(rot ? 2000 : 1200); // 回したあとは器と大きさの見直し(0.5秒ごと)を待つ
        for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(400);
        let c = await strip();
        // 報酬のお祝いなどで画面を一瞬揺らす演出の最中だと、助手ライフごと数px ずれて測れる。0.6秒おいて測り直し、続けてずれているときだけ NG
        for (let k = 0; k < 3 && c && c.ng.length; k++) { await page.waitForTimeout(600); c = await strip(); }
        check(`⑧ ${tag}: 帯が題・時計・アイコンに重ならない・はみ出さない・字が切れない`, !!c && c.ng.length === 0, JSON.stringify(c));
        // 仲良し度の知らせ(44-growth-fx)を出して、帯のボタン(とくに「止める」)・時計にかぶらない(2026-11-08 ミハリ)
        await page.evaluate(() => { growthFxAssistantBond('mua', 100, 160); growthFxAssistantBond('dra', 20, 30); growthFxAssistantBond('atsu', 20, 30); }); await page.waitForTimeout(1200);
        // 周回の報酬でお祝いの全面シートが出ていると、その下はどこも埋まって見え、知らせは逃げ場が無い(シートを閉じると0.7秒以内に置き直す)。閉じてから測る
        for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300);
        await page.waitForTimeout(900);
        const cover = await page.evaluate(() => { const rot = typeof RHYTHM_VIEW_ROTATION !== 'undefined' && RHYTHM_VIEW_ROTATION.active(); const R0 = (e) => (rot ? RHYTHM_VIEW_ROTATION.rectOf(e) : e.getBoundingClientRect());
          const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1; const out = [];
          for (const ch of document.querySelectorAll('.mh-gfx-chip')) { if (!ch.getClientRects().length) continue; const r = R0(ch); for (const o of document.querySelectorAll('[data-life-quick-run] button,[data-life-quick-run] small,[data-assistant-life-clock-box],[data-assistant-life-close]')) if (o.getClientRects().length && hit(r, R0(o))) out.push((o.textContent || o.getAttribute('data-assistant-life-clock-box') || '').trim().slice(0, 10) || '時計'); }
          const box = document.querySelector('[data-growth-fx-chips]');
          return { hits: [...new Set(out)], top: box ? box.dataset.growthFxChipsTop : '' }; });
        check(`⑧ ${tag}: 仲良し度の知らせが帯のボタン・時計にかぶらない`, cover.hits.length === 0, `${cover.hits.join(' / ')} (置き場所 ${cover.top})`);
        if (rot) { const fit = await page.evaluate(() => { const p = document.querySelector('.mhl-page'); const r = RHYTHM_VIEW_ROTATION.rectOf(p); return { w: Math.round(r.width), h: Math.round(r.height), land: document.querySelector('[data-assistant-life-screen]').getAttribute('data-assistant-life-land') }; });
          check('⑧ 🔄横: 助手ライフが回した画面いっぱい(横の形)に出る', fit.w >= 844 - 2 && fit.h >= 390 - 2 && fit.land === '1', JSON.stringify(fit)); }
        if (SHOTS) await page.screenshot({ path: path.join(shotDir, `strip-live-${tag}.jpg`), type: 'jpeg', quality: 78 });
        if (rot) await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(0));
      }
      await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(500);
      // 詳細の窓(カードと同じ CardQuickRunDetail)が助手ライフの上に出て、閉じられる
      await page.locator('[data-life-quick-run-detail]').click({ force: true }); await page.waitForTimeout(500);
      const det = await page.evaluate(() => { const d = document.querySelector('[data-card-quick-detail]'); if (!d) return null; const r = d.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { onTop: !!top && d.contains(top), text: d.textContent.slice(0, 40) }; });
      check('⑧ 「詳細」でカードと同じ詳細の窓が助手ライフの上に出る', !!det && det.onTop, JSON.stringify(det));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'strip-detail-tate.jpg'), type: 'jpeg', quality: 78 });
      await page.locator('[data-card-quick-detail-close]').click({ force: true }).catch(() => {}); await page.waitForTimeout(300);
      for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(400);
      const b1 = await state();
      await page.locator('[data-life-quick-run-stop]').click({ force: true });
      await page.waitForTimeout(3000);
      for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300);
      const c1 = await strip(), s1 = await state();
      check('⑧ 帯の「止める」で締まり(報酬が入る)、帯が止まった形になる', !!c1 && c1.run === 'stopped' && (s1.gold > b1.gold || s1.xp > b1.xp), JSON.stringify({ c1, gold: [b1.gold, s1.gold], xp: [b1.xp, s1.xp] }));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'strip-stopped-tate.jpg'), type: 'jpeg', quality: 78 });
      const again = page.locator('[data-assistant-life-quick-strip] [data-life-quick-run-start], [data-assistant-life-quick-strip] [data-rhythm-multi-quick-run-restart]').first();
      // 止めると貯めていたお祝いが少し遅れて出るので、閉じてから押す(押しても始まらなければもう一度)
      for (let t = 0; t < 3; t++) {
        for (let i = 0; i < 4 && await closePopups(); i++) await page.waitForTimeout(300);
        await again.click({ force: true }).catch(() => {});
        await page.waitForTimeout(2500);
        const c = await strip(); if (c && c.run === 'live') break;
      }
      const c2 = await strip();
      check('⑧ 止めたあと、帯から始め直せる', !!c2 && c2.run === 'live', JSON.stringify(c2));
    }
    await page.evaluate(() => ASSISTANT_LIFE_STORE.set({ open: false }));
    await page.waitForTimeout(3000);
    check('⑦ 閉じると締まり、バトルへ飛ばない', !(await state()).battle && (await state()).home);
    check('⑥ 実行時エラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } catch (e) {
    check('ブラウザで確認できた', false, String(e && e.stack || e).slice(0, 400));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
