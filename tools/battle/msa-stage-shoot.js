#!/usr/bin/env node
// 試合の場(56-monhero-success-arena.jsx の MsaStage)の止め絵を撮る。2026-11-12 バトル部
//   社長「バトル演出はもっとアクセントもつけて迫力とか見ごたえとかあるようにして」の前と後を見くらべる用
//
//   SHOT_DIR=<フォルダ> node tools/battle/msa-stage-shoot.js
//   SHOT_BG=stadium SHOT_VENUE=hero SHOT_DIR=<フォルダ> node tools/battle/msa-stage-shoot.js … 背景と会場を選んで撮る
//   SHOT_DIR=<フォルダ> SHOT_ROOT=<別のチェックアウト> node tools/battle/msa-stage-shoot.js   … 前の版を撮る(そちらで build 済みのこと)
//
// 助手マスモン対戦の芯で本物の試合を回し、大技・会心・とどめ・KO・勝ちの行を探して、その行の決まった瞬間で動きを止めて撮る。
// 撮るもの: 1 大技のため / 2 大技の当たった瞬間 / 3 会心の瞬間 / 4 とどめの瞬間 / 5 KO / 6 間合いの移動 / 7 勝ちの印
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(process.env.SHOT_ROOT || path.join(__dirname, '..', '..'));
const SHOT_DIR = process.env.SHOT_DIR || '';
if (!SHOT_DIR) { console.log('SHOT_DIR を渡してください'); process.exit(0); }
fs.mkdirSync(SHOT_DIR, { recursive: true });
const PORT = 8987;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
  await new Promise((r) => server.listen(PORT, r));
  const exe = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  try {
    const page = await browser.newPage({ viewport: { width: Number(process.env.SHOT_W) || 390, height: Number(process.env.SHOT_H) || 844 }, deviceScaleFactor: 2 });
    const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
    // SHOT_BG=arena|stadium(背景)・SHOT_VENUE=debut|cup|hero|summit(会場)。無ければ闘技場のカップ
    await page.addInitScript(([bg, v]) => { window.__SHOT_BG = bg; window.__SHOT_VENUE = v; }, [process.env.SHOT_BG || 'arena', process.env.SHOT_VENUE || 'cup']);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof MsaStage === 'function' && typeof ambwLoadEngine === 'function' && typeof ambwFramesOf === 'function', null, { timeout: 60000 });
    await page.waitForTimeout(800);
    // 試合を回して、撮る行を探す
    const found = await page.evaluate(async () => {
      Object.keys(Audio_.fgSe || {}).forEach((k) => { Audio_.fgSe[k] = () => {}; });
      const engine = await ambwLoadEngine();
      const catalog = engine.buildCatalog({ ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS: ambwTechTable() });
      const unit = (sp, name, st) => ({ species: sp, name, lv: 1, stats: st, techs: catalog.species[sp].techs.map((t) => t.id).slice(0, 8), mastery: Object.fromEntries(catalog.species[sp].techs.map((t) => [t.id, 60])) });
      const want = { big: null, crit: null, fin: null, move: null };
      for (let k = 0; k < 400; k++) {
        const teamA = { assistantId: 'mua', tactics: 30, members: [unit('Mocchi', 'もちまる', { life: 520, pow: 610, wise: 300, hit: 480, eva: 300, tough: 460 })] };
        const teamB = { assistantId: 'kiki', tactics: 30, members: [unit('Kyubi', 'こんこ', { life: 500, pow: 540, wise: 420, hit: 430, eva: 330, tough: 450 })] };
        const r = engine.simulate({ seed: `shoot-${k}`, catalog, teamA, teamB, balance: 'A', trace: true });
        const log = r.log; const st = log[0] || {};
        const gutsOf = (e) => { const all = (e.side === 'A' ? st.aMoves : st.bMoves) || []; const m = (all[e.i || 0] || []).find((x) => x.id === e.move); return m ? m.guts : 0; };
        log.forEach((e, i) => {
          if (e.ev !== 'tech' || !e.hit) { if (e.ev === 'move' && !want.move) want.move = { k, i }; return; }
          const fin = log[i + 1] && log[i + 1].ev === 'ko';
          if (!want.big && gutsOf(e) >= 40 && !e.crit && !fin) want.big = { k, i };
          if (!want.crit && e.crit && !fin) want.crit = { k, i };
          if (!want.fin && fin) want.fin = { k, i };
        });
        if (want.big && want.crit && want.fin && want.move) break;
      }
      window.__shoot = { engine, catalog, unit };
      return want;
    });
    console.log('見つけた行:', JSON.stringify(found));
    // 1枚撮る: k 番の試合の i 行目を出し、ms 経ったら動きを止める
    const shot = async (name, at, ms, ended) => {
      if (!at) { console.log(`SKIP: ${name}(行が見つからない)`); return; }
      await page.evaluate(({ at, ended }) => {
        const { engine, catalog, unit } = window.__shoot;
        const teamA = { assistantId: 'mua', tactics: 30, members: [unit('Mocchi', 'もちまる', { life: 520, pow: 610, wise: 300, hit: 480, eva: 300, tough: 460 })] };
        const teamB = { assistantId: 'kiki', tactics: 30, members: [unit('Kyubi', 'こんこ', { life: 500, pow: 540, wise: 420, hit: 430, eva: 330, tough: 450 })] };
        const r = engine.simulate({ seed: `shoot-${at.k}`, catalog, teamA, teamB, balance: 'A', trace: true });
        if (window.__root) window.__root.unmount();
        let d = document.getElementById('shoot'); if (!d) { d = document.createElement('div'); d.id = 'shoot'; d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#14102a;padding:60px 10px'; document.body.appendChild(d); }
        window.__root = ReactDOM.createRoot(d);
        const pos = ended ? r.log.length - 1 : at.i;
        window.__root.render(React.createElement('div', { className: 'msa' }, React.createElement('style', null, typeof MSA_CSS === 'string' ? MSA_CSS : ''),
          React.createElement(MsaStage, { log: r.log, frames: ambwFramesOf(r.log), pos, teams: { A: teamA, B: teamB }, venueImg: typeof msaVenueBg === 'function' ? msaVenueBg(window.__SHOT_VENUE || 'cup', window.__SHOT_BG || 'arena') : (typeof MSC_VENUE_IMG !== 'undefined' ? MSC_VENUE_IMG.cup : null), ended: !!ended, win: ended ? r.winner : null, sound: false })));
      }, { at, ended });
      await page.waitForTimeout(ms);
      await page.evaluate(() => document.getAnimations().forEach((a) => { try { a.pause(); } catch (_) {} }));
      const el = await page.$('[data-msa-stage]');
      if (!el) { console.log(`NG: ${name}(場が出ない)`); return; }
      await el.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) });
      console.log(`撮った: ${name}`);
    };
    // 当たる瞬間の時刻(場の中の動きの「当たり」+ 大技のため)を数える
    const hitAt = async (at) => (at ? page.evaluate(({ at }) => {
      const { engine, catalog, unit } = window.__shoot;
      const r = engine.simulate({ seed: `shoot-${at.k}`, catalog, teamA: { assistantId: 'mua', tactics: 30, members: [unit('Mocchi', 'もちまる', { life: 520, pow: 610, wise: 300, hit: 480, eva: 300, tough: 460 })] }, teamB: { assistantId: 'kiki', tactics: 30, members: [unit('Kyubi', 'こんこ', { life: 500, pow: 540, wise: 420, hit: 430, eva: 330, tough: 450 })] }, balance: 'A', trace: true });
      const e = r.log[at.i]; const sp = e.side === 'A' ? 'Mocchi' : 'Kyubi';
      const pre = typeof msaFxOf === 'function' ? msaFxOf(r.log, e, false).pre : 0;
      return pre + msaMotionMs(msaMotionKind(sp, msaTechInfo(r.log, e))).hit;
    }, { at }) : 0);
    const hBig = await hitAt(found.big); const hCrit = await hitAt(found.crit); const hFin = await hitAt(found.fin);
    await shot('1-big-charge', found.big, 300);
    await shot('2-big-hit', found.big, hBig + 200);
    await shot('3-crit', found.crit, hCrit + 330);
    await shot('4-finish', found.fin, hFin + 420);
    await shot('5-ko', found.fin && { k: found.fin.k, i: found.fin.i + 1 }, 450);
    await shot('6-move', found.move, 160);
    await shot('7-win', found.fin, 500, true);
    console.log(errs.length ? `実行時エラー: ${errs.slice(0, 2).join(' / ')}` : '実行時エラーなし');
  } finally {
    await browser.close(); server.close();
  }
})();
