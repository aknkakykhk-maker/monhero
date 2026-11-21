#!/usr/bin/env node
// モンサクの試合の場(MsaStage の wide)の大きさ・間合いの見張り(2026-11-19 段1・docs/progress/monsuc-battle-redesign)
//   社長「モンスターがでかすぎて演出がちゃんと見えない」「距離感が機能していないように見える」の再発を止める。
//   縦・横・小さい横の場の大きさで、零・近・中・遠の行を出して数える(撮らない。動きを減らす設定で、カメラの寄せ・揺れを除いた立ち位置を測る):
//   社長の決め r1119-008(場の幅に対する割合・零近中遠の順):
//   - 絵の幅 ÷ 場の幅 が 20%・17%・13%・10%(低い場で上の帯にかかるときは4段そろって小さくなるので、下は 0.75 倍まで許す)
//   - 2体の中心の間 ÷ 場の幅 が 20%・35%・55%・75%(±1.5点)。零で2体の絵が重ならない
//   - 絵が場の外へ出ない(左右とも安全域の内側)
//   - 零近中遠の字が、技の行でも出ている
//   node tools/battle/msa-layout-check.js
//   SHOT_DIR=<フォルダ> node tools/battle/msa-layout-check.js   … 闘技場の背景を付けて、場面ごとの止め絵も書き出す(見本と見比べる用)
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(path.join(__dirname, '..', '..'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
});
// 場の大きさ(縦 390×844 の手動・オート / 横 844×390 の 2/3 / 小さい横 568×320 の 3/5 を目安に。縦の 420 は段2の配置)
const STAGES = [['縦', 370, 359], ['縦420', 374, 420], ['横', 548, 296], ['小さい横', 323, 228], ['PC', 640, 420]];
const FIG = [0.22, 0.19, 0.16, 0.14]; // 2026-11-21 r1119-061 で見直し(ゲーム本体の MSA_FIG_W・MSA_GAP_W と同じ)
const GAP = [0.22, 0.38, 0.55, 0.72];

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'))); } catch (_) { ({ chromium } = require('playwright')); }
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const exe = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(fs.existsSync(exe) ? { executablePath: exe } : {});
  const ng = [];
  let n = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
    await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof MsaStage === 'function' && typeof ambwLoadEngine === 'function' && typeof ambwFramesOf === 'function', null, { timeout: 60000 });
    // 零・近・中・遠の行(技の行を優先)を探す
    const found = await page.evaluate(async () => {
      Object.keys(Audio_.fgSe || {}).forEach((k) => { Audio_.fgSe[k] = () => {}; });
      const engine = await ambwLoadEngine();
      const catalog = engine.buildCatalog({ ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS: ambwTechTable() });
      const unit = (sp, name, st) => ({ species: sp, name, lv: 1, stats: st, techs: catalog.species[sp].techs.map((t) => t.id).slice(0, 8), mastery: Object.fromEntries(catalog.species[sp].techs.map((t) => [t.id, 60])) });
      const teamA = { assistantId: 'mua', tactics: 30, members: [unit('Mocchi', 'もちまる', { life: 520, pow: 610, wise: 300, hit: 480, eva: 300, tough: 460 })] };
      const teamB = { assistantId: 'kiki', tactics: 30, members: [unit('Kyubi', 'こんこ', { life: 500, pow: 540, wise: 420, hit: 430, eva: 330, tough: 450 })] };
      const at = [null, null, null, null];
      for (let k = 0; k < 200 && at.some((x) => !x); k++) {
        const r = engine.simulate({ seed: `layout-${k}`, catalog, teamA, teamB, balance: 'A', trace: true });
        const fr = ambwFramesOf(r.log);
        r.log.forEach((e, i) => { const d = fr[i] && fr[i].d; if (Number.isFinite(d) && d >= 0 && d <= 3 && (!at[d] || (e.ev === 'tech' && !at[d].tech))) at[d] = { k, i, tech: e.ev === 'tech' }; });
      }
      window.__lay = { engine, catalog, teamA, teamB };
      return at;
    });
    for (const [tag, W, H] of STAGES) {
      for (let d = 0; d < 4; d++) {
        const at = found[d];
        if (!at) { ng.push(`${tag}: ${'零近中遠'[d]} の行が見つからない`); continue; }
        const m = await page.evaluate(({ at, W, H, bg }) => {
          const { engine, catalog, teamA, teamB } = window.__lay;
          const r = engine.simulate({ seed: `layout-${at.k}`, catalog, teamA, teamB, balance: 'A', trace: true });
          if (window.__root) window.__root.unmount();
          let box = document.getElementById('lay'); if (!box) { box = document.createElement('div'); box.id = 'lay'; document.body.appendChild(box); }
          box.style.cssText = `position:fixed;left:0;top:0;z-index:99999;width:${W}px;height:${H}px;display:flex;flex-direction:column;background:#14102a`;
          window.__root = ReactDOM.createRoot(box);
          window.__root.render(React.createElement('div', { className: 'msa', style: { width: W, height: H, display: 'flex', flexDirection: 'column' } }, React.createElement('style', null, MSA_CSS),
            React.createElement(MsaStage, { log: r.log, frames: ambwFramesOf(r.log), pos: at.i, teams: { A: teamA, B: teamB }, venueImg: bg && typeof msaVenueBg === 'function' ? msaVenueBg('cup', 'arena') : null, sound: false, fill: true, wide: true, lite: true })));
          return null;
        }, { at, W, H, bg: !!process.env.SHOT_DIR });
        void m;
        await page.waitForTimeout(900); // ResizeObserver → 立ち位置の移り(0.64秒)が終わるまで
        const r = await page.evaluate(() => {
          const st = document.querySelector('[data-msa-stage]'); if (!st) return null;
          const sb = st.getBoundingClientRect();
          const fw = parseFloat(getComputedStyle(st).getPropertyValue('--msa-fw')) || 0;
          const fs2 = [...st.querySelectorAll('[data-msa-fighter]')].map((e) => { const b = (e.closest('.msa-f') || e).getBoundingClientRect(); return { l: b.left - sb.left, w: b.width, c: b.left - sb.left + b.width / 2 }; });
          const dist = st.querySelector('[data-msa-dist]');
          return { sw: sb.width, sh: sb.height, fw, fs: fs2, dist: !!(dist && dist.getBoundingClientRect().width > 0) };
        });
        n++;
        if (process.env.SHOT_DIR) { fs.mkdirSync(process.env.SHOT_DIR, { recursive: true }); const el = await page.$('[data-msa-stage]'); if (el) await el.screenshot({ path: path.join(process.env.SHOT_DIR, `${tag}-${d}.jpg`), type: 'jpeg', quality: 70 }); }
        const nm = `${tag} ${'零近中遠'[d]}`;
        if (!r) { ng.push(`${nm}: 場が出ない`); continue; }
        if (r.fs.length < 2) { ng.push(`${nm}: 2体が出ない`); continue; }
        if (process.env.VERBOSE) console.log(nm, JSON.stringify(r));
        const [a, b] = r.fs.sort((x, y) => x.c - y.c);
        const fw = r.fw || a.w;
        const ratio = fw / r.sw;
        if (ratio > FIG[d] + 0.01 || ratio < FIG[d] * 0.75) ng.push(`${nm}: 絵の幅が場の ${(ratio * 100).toFixed(1)}%(${FIG[d] * 100}% のはず)`);
        const x = (b.c - a.c) / r.sw;
        if (Math.abs(x - GAP[d]) > 0.015) ng.push(`${nm}: 中心の間が場の ${(x * 100).toFixed(1)}%(${GAP[d] * 100}% のはず)`);
        if (b.c - a.c < fw * 0.98) ng.push(`${nm}: 2体の絵が重なる`);
        const out = Math.min(a.c - fw / 2, r.sw - (b.c + fw / 2));
        if (out < 0) ng.push(`${nm}: 絵が場の外へ ${Math.round(-out)}px 出る`);
        if (!r.dist) ng.push(`${nm}: 零近中遠の字が出ていない${found[d].tech ? '(技の行)' : ''}`);
      }
    }
    if (errs.length) ng.push(`実行時エラー: ${errs.slice(0, 2).join(' / ')}`);
  } finally {
    await browser.close(); server.close();
  }
  if (ng.length) { console.log(`NG: 試合の場の大きさ・間合い ${ng.length}件`); ng.slice(0, 12).forEach((s) => console.log(`  - ${s}`)); process.exit(1); }
  console.log(`OK: 試合の場の大きさ・間合い(${n}場面: 縦・横・小さい横・PC × 零近中遠)`);
})().catch((e) => { console.error(e); process.exit(1); });
