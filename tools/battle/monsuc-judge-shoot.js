#!/usr/bin/env node
// モンサクの試合の「判定!」の画面(MsaJudge・r1115-058)を実機で確かめる。node tools/battle/monsuc-judge-shoot.js [--shots]
//   試合の上限を4ラウンドに縮めてオートで回し、判定の画面が出る → はみ出さない・縦にも収まる → 「結果へ」で結果が出る、を幅390・320・横844で見る
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
let ng = 0;
const check = (label, ok, info = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${info ? ` — ${info}` : ''}`); if (!ok) ng++; };
const PORT = 8985;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

const open = async (browser, reducedMotion, width = 390, species = 'Mocchi', loy = null, seed = null, height = null) => {
  const page = await browser.newPage({ viewport: { width, height: height || (width < 360 ? 700 : 844) }, reducedMotion });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof MonsucCupShow === 'function' && typeof MsaStage === 'function', null, { timeout: 60000 });
  await page.addScriptTag({ url: '/monster-hero/data/monhero-success-regulars.js' });
  await page.addScriptTag({ url: '/monster-hero/data/monhero-success.js' });
  await page.addScriptTag({ url: '/monster-hero/data/assistant-masmon-battle.js' });
  await page.waitForTimeout(1000);
  await page.evaluate(([SPECIES, LOY, SEED]) => {
    // 効果音を数える(鳴らさない)
    { const E = window.ASSISTANT_MASMON_BATTLE; const W = { ...E }; W.simulate = (i) => E.simulate({ ...i, roundLimit: 4 }); W.createMatch = (i) => E.createMatch({ ...i, roundLimit: 4 }); if (E.replay) W.replay = (i, c) => E.replay({ ...i, roundLimit: 4 }, c); window.ASSISTANT_MASMON_BATTLE = W; }   // 判定の画面まで早く行くため上限を4に
    window.__se = {};
    Object.keys(Audio_.fgSe).forEach((k) => { Audio_.fgSe[k] = () => { window.__se[k] = (window.__se[k] || 0) + 1; }; });
    window.__fx = 0;
    window.__acc = {};
    new MutationObserver(() => { if (document.querySelector('[data-skill-fx]')) window.__fx++; ['.msa-dim', '.msa-flash', '.msa-critcut', '.msa-dust', '.msa-fin', '.msa-burst', '[data-msa-tier]', '.msa-ko.big'].forEach((q) => { if (document.querySelector(q)) window.__acc[q] = (window.__acc[q] || 0) + 1; }); }).observe(document.body, { subtree: true, childList: true });
    const SUC = MONHERO_SUCCESS.create({ calc: MASMON_CALC, apt: AMG_APT, init: AMG_INIT, techs: ASSISTANT_MASMON_TECHS, monsters: ALL_PLAYER_MONSTERS, regulars: MONSUC_REGULARS, cupNames: MONSUC_REGULAR_CUPS });
    const s = JSON.parse(JSON.stringify(SUC.newRun({ id: 'arena-check', species: SPECIES, aid: 'mua', rivals: [{ name: 'こんこ', species: 'Kyubi', stats: { life: 455, pow: 472, wise: 180, hit: 341, eva: 260, tough: 498 } }] })));
    s.stats = { life: 412, pow: 506, wise: 233, hit: 380, eva: 198, tough: 441 }; s.turn = 24;
    if (LOY != null) { s.ama = 0; s.fear = LOY; }
    if (SEED) try { localStorage.setItem('mh_monsuc_arena_ctl_run_v1', JSON.stringify(SEED)); } catch (_) {}
    s.battle = { kind: 'cup', id: 'middle:4:spring:3', sys: 'spring', star: 3, rival: { name: 'こんこ' }, round: 0 };
    const d = document.createElement('div'); document.body.appendChild(d);
    window.__root = ReactDOM.createRoot(d);
    window.__root.render(React.createElement(MonsucCupShow, { suc: SUC, s, me: { name: 'もちまる' }, startAt: 'match', settle: () => ({}), onRematch() {}, onNext() {}, onClose() {} }));
  }, [species, loy, seed]);
  return { page, errs };
};

(async () => {
  const { chromium } = require('playwright');
  await new Promise((r) => server.listen(PORT, r));
  const exe = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const shots = process.argv.includes('--shots');
  const dir = path.join(ROOT, 'docs', 'progress', 'r1115-058');
  if (shots) fs.mkdirSync(dir, { recursive: true });
  try {
    for (const [w, h] of [[390, 844], [320, 700], [844, 390]]) {
      const { page, errs } = await open(browser, 'reduce', w, 'Mocchi', null, { id: 'arena-check', ctl: 'auto' }, h);
      await page.waitForSelector('[data-msa-judge]', { timeout: 120000 }).catch(() => {}); if (false) { console.log(await page.evaluate(() => ({ e: !!document.querySelector('[data-msc-end]'), a: !!document.querySelector('[data-msxm="act"]'), r: (document.querySelector('.msa-rnd')||{}).textContent, ctl: localStorage.getItem('mh_monsuc_arena_ctl_run_v1') }))); await page.screenshot({ path: '/tmp/dbg.png' }); }
      await page.waitForTimeout(600);
      const st = await page.evaluate(() => {
        const j = document.querySelector('[data-msa-judge]'); if (!j) return null;
        const bad = []; const vw = innerWidth;
        j.querySelectorAll('*').forEach((x) => { const r = x.getBoundingClientRect(); if (r.width && (r.right > vw + 0.5 || r.left < -0.5)) bad.push((x.textContent || x.tagName).slice(0, 12)); });
        const go = j.querySelector('.msa-judge-go').getBoundingClientRect();
        return { rows: j.querySelectorAll('[data-msa-judge-row]').length, bad, fit: j.scrollHeight <= j.clientHeight + 1, goIn: go.bottom <= innerHeight && go.top >= 0, text: j.innerText.replace(/\s+/g, ' ').slice(0, 220), res: j.dataset.msaJudge };
      });
      check(`判定の画面が出る(${w}×${h})`, !!st && st.rows === 3, st ? st.text : '出ない');
      if (st) {
        check(`はみ出さない(${w}×${h})`, st.bad.length === 0, JSON.stringify(st.bad));
        check(`縦に収まり、ボタンが見える(${w}×${h})`, st.fit && st.goIn, JSON.stringify({ fit: st.fit, goIn: st.goIn }));
        if (shots) await page.screenshot({ path: path.join(dir, `judge-${w}x${h}-${st.res}.png`) });
        await page.click('.msa-judge-go');
        await page.waitForSelector('[data-msc-end]', { timeout: 20000 }).catch(() => {});
        check(`「結果へ」で結果の画面に進む(${w}×${h})`, await page.evaluate(() => !!document.querySelector('[data-msc-end]') && !document.querySelector('[data-msa-judge]')));
      }
      check(`実行時エラーなし(${w}×${h})`, errs.length === 0, errs.join('|'));
      await page.close();
    }
    // 止め絵: 勝ち(2勝1敗)と、勝ち数が同じで残ライフの量(実数)で決まった場合を、部品だけで描く(390×844)
    if (shots) {
      const { page } = await open(browser, 'reduce', 390, 'Mocchi', null, { id: 'arena-check', ctl: 'auto' }, 844);
      const cases = { win: { rows: [{ key: 'pct', a: 62.5, b: 41.2, win: 'A' }, { key: 'dmg', a: 318, b: 402, win: 'B' }, { key: 'guts', a: 190, b: 120, win: 'A' }], winner: 'A', winsA: 2, winsB: 1, by: 'wins', hpA: 250, hpB: 165, mxA: 400, mxB: 400, limit: 30 },
        hp: { rows: [{ key: 'pct', a: 55, b: 55, win: null }, { key: 'dmg', a: 210, b: 340, win: 'B' }, { key: 'guts', a: 150, b: 90, win: 'A' }], winner: 'A', winsA: 1, winsB: 1, by: 'hp', hpA: 330, hpB: 275, mxA: 600, mxB: 500, limit: 30 } };
      for (const k of Object.keys(cases)) {
        await page.evaluate(([row]) => { document.body.innerHTML = '<div id="jr"></div>'; ReactDOM.createRoot(document.getElementById('jr')).render(React.createElement(MsaJudge, { row, names: { A: 'もちまる', B: 'こんこ' }, onGo() {} })); }, [cases[k]]);
        await page.waitForSelector('[data-msa-judge]'); await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(dir, `judge-sample-${k}.png`) });
      }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(ng ? `\nNG ${ng}件` : '\nすべて OK'); process.exit(ng ? 1 : 0);
})();
