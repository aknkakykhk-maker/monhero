#!/usr/bin/env node
// 試合の場(MsaStage)の「間合いの移動」だけを録る(音なし)。tools/battle/msa-stage-video.js を写して、
// 移動が3回以上ある試合を選び、最初の移動の1行前から3回目の移動の2行あとまでを流す。2026-11-14 開発部(社長「距離の移動が違和感」の前後比べ)
//
//   VIDEO_OUT=<出力.mp4> node docs/progress/player-raise/wip/rec-arena-move.js
//   VIDEO_OUT=<出力.mp4> SHOT_ROOT=<別のチェックアウト(build 済み)> node docs/progress/player-raise/wip/rec-arena-move.js   … 前の版
//
// 助手マスモン対戦の芯で、大技・会心・とどめが1試合に入る記録を探し、観戦と同じ1行の長さ(msaStepMs・×1)で最後まで流して、
// 勝ち負けの印まで撮る。大きさは iPhone の縦(390×844)
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(process.env.SHOT_ROOT || path.join(__dirname, '..', '..', '..', '..'));
const TOOLS = path.join(__dirname, '..', '..', '..', '..', 'tools');
const OUT = process.env.VIDEO_OUT || '';
// STILL_DIR を渡すと録画はせず、同じ試合を流しながら決まった瞬間を縦の2倍で撮る(ライフが減る・ガッツが伸びる・残りが少ない)
const STILL_DIR = process.env.STILL_DIR || '';
if (!OUT && !STILL_DIR) { console.log('VIDEO_OUT か STILL_DIR を渡してください'); process.exit(0); }
const PORT = 8988;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(TOOLS, 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
  await new Promise((r) => server.listen(PORT, r));
  const exe = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const tmp = path.join(path.dirname(OUT), `.rec-${process.pid}`);
  try {
    // 読み込みは録らない(準備のページ → 準備ができてから録画のページで流す)
    const ctx = await browser.newContext(STILL_DIR ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } : { viewport: { width: 390, height: 844 }, recordVideo: { dir: tmp, size: { width: 390, height: 844 } } });
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
        const mvs = log.map((e, i) => (e.ev === 'move' ? i : -1)).filter((i) => i > 0);
        if (mvs.length >= 3 && mvs[2] - mvs[0] <= 9) pick = { k, r, from: Math.max(1, mvs[0] - 1), to: Math.min(log.length - 1, mvs[2] + 2) };
      }
      if (!pick) return null;
      window.__v = { r: pick.r, teamA, teamB, catalog };
      window.__v.from = pick.from; window.__v.to = pick.to;
      return { k: pick.k, rows: pick.r.log.length, from: pick.from, to: pick.to, ev: pick.r.log.slice(pick.from, pick.to + 1).map((e) => `${e.ev}${e.side || ''}${e.ev === 'move' ? `→${e.to}` : ''}`).join(' ') };
    });
    if (!info) throw new Error('そろう試合が見つからない');
    console.log('試合:', JSON.stringify(info));
    // 流す(観戦と同じ1行の長さ・×1)。終わったら勝ち負けの印
    const startSec = (Date.now() - t0) / 1000;
    // 撮る瞬間: 大きく当たった行(当たって 0.3 秒後=減った分が残っている所)・ためた行・残りが少なくなった行
    let snaps = [];
    if (STILL_DIR) {
      fs.mkdirSync(STILL_DIR, { recursive: true });
      snaps = await page.evaluate(() => {
        const { r } = window.__v; const frames = ambwFramesOf(r.log); const out = [];
        const hitAt = (e) => { const m = ((e.side === 'A' ? window.__v.teamA : window.__v.teamB).members[e.i] || {}); return msaFxOf(r.log, e, false).pre + msaMotionMs(msaMotionKind(m.species, msaTechInfo(r.log, e))).hit; };
        const big = r.log.findIndex((e) => e.ev === 'tech' && e.hit && e.dmg >= 150);
        // 撃つ前の構えの一拍(ふつうの技・大技)
        const gOf = (e) => (msaTechInfo(r.log, e).guts || 0);
        const nw = r.log.findIndex((e) => e.ev === 'tech' && gOf(e) < 40);
        if (nw > 0) out.push({ pos: nw, at: 120, name: '0a-windup' });
        const bw = r.log.findIndex((e) => e.ev === 'tech' && gOf(e) >= 40);
        if (bw > 0) out.push({ pos: bw, at: 430, name: '0b-windup-big' });
        if (big > 0) { out.push({ pos: big, at: hitAt(r.log[big]) + 300, name: '1-life-drop' }); out.push({ pos: big, at: hitAt(r.log[big]) + 1100, name: '2-life-after' }); }
        const ch = r.log.findIndex((e) => e.ev === 'charge' && e.why !== 'sulk');
        if (ch > 0) out.push({ pos: ch, at: 250, name: '3-guts-charge' });
        const mv = r.log.findIndex((e) => e.ev === 'move');
        if (mv > 0) out.push({ pos: mv, at: 250, name: '4-guts-move' });
        const low = frames.findIndex((f, k) => k > 0 && ['A', 'B'].some((s) => { const mx = frames[0].hp[s][f.act[s]]; const v = f.hp[s][f.act[s]]; return v > 0 && v / mx <= 0.25; }));
        if (low > 0) out.push({ pos: low + 1, at: 600, name: '5-life-low' });
        return out;
      });
      const left = snaps.slice();
      const poll = async () => {
        while (left.length) {
          const row = await page.evaluate(() => (window.__row ? { pos: window.__row.pos, el: performance.now() - window.__row.t } : null)).catch(() => null);
          if (row) for (let i = left.length - 1; i >= 0; i--) {
            const sn = left[i];
            if (row.pos > sn.pos) { left.splice(i, 1); continue; }
            if (row.pos === sn.pos && row.el >= sn.at) { await page.screenshot({ path: path.join(STILL_DIR, `${sn.name}.png`), clip: { x: 0, y: 100, width: 390, height: 560 } }); left.splice(i, 1); }
          }
          await new Promise((res) => setTimeout(res, 40));
        }
      };
      poll();
    }
    // TRACE=1: 立ち位置(画面の上の x)を 40ms ごとに記録して、移動の行のなめらかさを数で見る
    if (process.env.TRACE) await page.evaluate(() => { window.__tr = []; const t0 = performance.now(); setInterval(() => { const st = document.querySelector('[data-msa-stage]'); if (!st) return; const R = st.getBoundingClientRect(); const xs = ['A', 'B'].map((sd) => { const el = document.querySelector(`[data-msa-fighter="${sd}"]`); if (!el) return null; const b = el.getBoundingClientRect(); return Math.round(b.left + b.width / 2 - R.left); }); window.__tr.push([Math.round(performance.now() - t0), window.__row ? window.__row.pos : -1, ...xs]); }, 40); });
    await page.evaluate(() => new Promise((done) => {
      const { r, teamA, teamB } = window.__v;
      const frames = ambwFramesOf(r.log); const last = r.log.length - 1;
      // 観戦の画面と同じ並び(上に相手の帯・まん中に場・下に自分の帯)。帯の部品が無い前の版は場だけ
      let d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:linear-gradient(180deg,#221a44,#141026 40%);padding:120px 10px 0;color:#fff;font-weight:700';
      document.body.appendChild(d);
      const root = ReactDOM.createRoot(d);
      const st = r.log[0] || {}; const maxHp = { A: st.aHp || [], B: st.bHp || [] };
      const h = React.createElement;
      const panel = (side, f, e) => (typeof AmbwPanel === 'function' ? h(AmbwPanel, { side, team: side === 'A' ? teamA : teamB, frame: f, maxHp, moves: side === 'A' ? st.aMoves || [] : st.bMoves || [], lastMove: e.side === side && e.ev === 'tech' ? e.move : null, mine: side === 'A', catalog: window.__v.catalog, teams: { A: teamA, B: teamB } }) : null);
      const teams = { A: teamA, B: teamB };
      function Wrap({ pos, ended }) {
        // 上下の欄は β と同じく、技が当たる瞬間までは前のコマ(前の版には無い)
        const sh = typeof useMsaShownFrame === 'function' ? useMsaShownFrame(r.log, frames, pos, teams) : null;
        const f = sh || frames[Math.min(pos, frames.length - 1)]; const e = r.log[pos] || {};
        return h('div', { className: 'ambw-in' }, h('style', null, (typeof AMBW_CSS === 'string' ? AMBW_CSS.replace(/\.ambw\{[^}]*\}/, '') : '') + (typeof MSA_CSS === 'string' ? MSA_CSS : '')),
          panel('B', f, e),
          h('div', { className: 'msa', style: { marginTop: 8 } }, h(MsaStage, { log: r.log, frames, pos, teams: { A: teamA, B: teamB }, venueImg: typeof MSC_VENUE_IMG !== 'undefined' ? MSC_VENUE_IMG.cup : null, ended, win: ended ? r.winner : null, sound: false, introTitle: 'マスモン対戦' })),
          panel('A', f, e));
      }
      const show = (pos, ended) => root.render(h(Wrap, { pos, ended }));
      let pos = window.__v.from; const lastShow = window.__v.to; show(pos, false); window.__row = { pos, t: performance.now() };
      const step = () => {
        const cur = r.log[pos] || {};
        const ms = typeof msaStepMs === 'function' ? msaStepMs(cur, cur.side === 'A' ? teamA : teamB, false, r.log) : 900;
        setTimeout(() => {
          if (pos < lastShow) { pos += 1; show(pos, false); window.__row = { pos, t: performance.now() }; step(); } else { setTimeout(done, 300); }
        }, ms);
      };
      step();
    }));
    if (process.env.TRACE) { const tr = await page.evaluate(() => window.__tr); fs.writeFileSync(process.env.TRACE, JSON.stringify(tr)); console.log(`記録: ${tr.length}点`); }
    if (STILL_DIR) { await ctx.close(); console.log(`撮った: ${snaps.map((x) => x.name).join(' / ')}`); console.log(errs.length ? `実行時エラー: ${errs.slice(0, 2).join(' / ')}` : '実行時エラーなし'); return; }
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
