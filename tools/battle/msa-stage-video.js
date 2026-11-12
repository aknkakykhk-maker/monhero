#!/usr/bin/env node
// 試合の場(MsaStage)で1試合を流して録画する(音なし)。2026-11-12 バトル部
//   社長「(やりすぎは)押し間違い。動画で見ないと分からない」→ 前と後を動画で見くらべる用
//
//   VIDEO_OUT=<出力.webm> node tools/battle/msa-stage-video.js
//   VIDEO_OUT=<出力.webm> SHOT_ROOT=<別のチェックアウト(build 済み)> node tools/battle/msa-stage-video.js   … 前の版
//
// 助手マスモン対戦の芯で、大技・会心・とどめが1試合に入る記録を探し、観戦と同じ1行の長さ(msaStepMs・×1)で最後まで流して、
// 勝ち負けの印まで撮る。大きさは iPhone の縦(390×844)
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(process.env.SHOT_ROOT || path.join(__dirname, '..', '..'));
const OUT = process.env.VIDEO_OUT || '';
if (!OUT) { console.log('VIDEO_OUT を渡してください'); process.exit(0); }
const PORT = 8988;
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
  const tmp = path.join(path.dirname(OUT), `.rec-${process.pid}`);
  try {
    // 読み込みは録らない(準備のページ → 準備ができてから録画のページで流す)
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: tmp, size: { width: 390, height: 844 } } });
    const page = await ctx.newPage();
    const t0 = Date.now();
    const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof MsaStage === 'function' && typeof ambwLoadEngine === 'function' && typeof ambwFramesOf === 'function', null, { timeout: 60000 });
    await page.waitForTimeout(800);
    const info = await page.evaluate(async () => {
      Object.keys(Audio_.fgSe || {}).forEach((k) => { Audio_.fgSe[k] = () => {}; });
      const engine = await ambwLoadEngine();
      const catalog = engine.buildCatalog({ ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS: ambwTechTable() });
      const unit = (sp, name, st) => ({ species: sp, name, lv: 1, stats: st, techs: catalog.species[sp].techs.map((t) => t.id).slice(0, 8), mastery: Object.fromEntries(catalog.species[sp].techs.map((t) => [t.id, 60])) });
      const teamA = { assistantId: 'mua', tactics: 30, members: [unit('Mocchi', 'もちまる', { life: 520, pow: 610, wise: 300, hit: 480, eva: 300, tough: 460 })] };
      const teamB = { assistantId: 'kiki', tactics: 30, members: [unit('Kyubi', 'こんこ', { life: 500, pow: 540, wise: 420, hit: 430, eva: 330, tough: 450 })] };
      // 大技・会心・とどめがそろい、長すぎない試合
      let pick = null;
      for (let k = 0; k < 600 && !pick; k++) {
        const r = engine.simulate({ seed: `video-${k}`, catalog, teamA, teamB, balance: 'A', trace: true });
        const log = r.log; const st = log[0] || {};
        const gutsOf = (e) => { const all = (e.side === 'A' ? st.aMoves : st.bMoves) || []; const m = (all[e.i || 0] || []).find((x) => x.id === e.move); return m ? m.guts : 0; };
        const big = log.some((e) => e.ev === 'tech' && e.hit && gutsOf(e) >= 40);
        const crit = log.some((e) => e.ev === 'tech' && e.hit && e.crit);
        const ko = log.some((e) => e.ev === 'ko');
        const mv = log.some((e) => e.ev === 'move');
        if (big && crit && ko && mv && r.winner === 'A' && log.length >= 14 && log.length <= 34) pick = { k, r };
      }
      if (!pick) return null;
      window.__v = { r: pick.r, teamA, teamB };
      return { k: pick.k, rows: pick.r.log.length };
    });
    if (!info) throw new Error('そろう試合が見つからない');
    console.log('試合:', JSON.stringify(info));
    // 流す(観戦と同じ1行の長さ・×1)。終わったら勝ち負けの印
    const startSec = (Date.now() - t0) / 1000;
    await page.evaluate(() => new Promise((done) => {
      const { r, teamA, teamB } = window.__v;
      const frames = ambwFramesOf(r.log); const last = r.log.length - 1;
      let d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#14102a;padding:200px 10px 0';
      document.body.appendChild(d);
      const root = ReactDOM.createRoot(d);
      const show = (pos, ended) => root.render(React.createElement('div', { className: 'msa' }, React.createElement('style', null, typeof MSA_CSS === 'string' ? MSA_CSS : ''),
        React.createElement(MsaStage, { log: r.log, frames, pos, teams: { A: teamA, B: teamB }, venueImg: typeof MSC_VENUE_IMG !== 'undefined' ? MSC_VENUE_IMG.cup : null, ended, win: ended ? r.winner : null, sound: false })));
      let pos = 0; show(0, false);
      const step = () => {
        const cur = r.log[pos] || {};
        const ms = typeof msaStepMs === 'function' ? msaStepMs(cur, cur.side === 'A' ? teamA : teamB, false, r.log) : 900;
        setTimeout(() => {
          if (pos < last) { pos += 1; show(pos, false); step(); } else { setTimeout(() => { show(pos, true); setTimeout(done, 2600); }, 900); }
        }, ms);
      };
      step();
    }));
    const video = page.video();
    await ctx.close();
    const src = await video.path();
    // 読み込みの所を切り、mp4 にする(ffmpeg が無ければ webm のまま)
    const { execFileSync } = require('child_process');
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, startSec - 0.2)), '-i', src, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart', OUT]);
    } catch (e) { fs.renameSync(src, OUT.replace(/\.mp4$/, '.webm')); }
    console.log(`録った: ${OUT}`);
    console.log(errs.length ? `実行時エラー: ${errs.slice(0, 2).join(' / ')}` : '実行時エラーなし');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
    await browser.close(); server.close();
  }
})();
