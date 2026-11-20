#!/usr/bin/env node
// モンサクのモンスターの札(MonsucMonCard)で、絵を枠いっぱいの同じくらいの大きさに出すための「絵の中身の範囲」の表を作る(2026-11-20 窓口経由 #6914 の残り)。
//   絵(ALL_PLAYER_MONSTERS[id].imgUrl)ごとに、透明でない所の範囲を本物のブラウザで測り、
//   monster-hero/src/parts/56-monsuc-artbox.jsx の MONSUC_ART_BOX = { 絵のURL: [幅, 高さ, 左, 上, 右, 下] }(px)へ書く。
//   node tools/success/monsuc-art-box.js          … 測って書き直す(絵を足した・差し替えたら回す)
//   node tools/success/monsuc-art-box.js --check  … 表に無い絵・大きさの変わった絵があれば NG(書き直さない)
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'monster-hero', 'src', 'parts', '56-monsuc-artbox.jsx');
const CHECK = process.argv.includes('--check');
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので測れません'); process.exit(0); }
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const PORT = Number(process.env.SHOT_PORT) || 8977;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let code = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(quietBootSeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    await page.waitForFunction(() => typeof ALL_PLAYER_MONSTERS === 'object' && ALL_PLAYER_MONSTERS, undefined, { timeout: 90000 });
    const rows = await page.evaluate(async () => {
      const urls = [...new Set(Object.values(ALL_PLAYER_MONSTERS).map((m) => m && m.imgUrl).filter((u) => typeof u === 'string' && u))];
      const out = {};
      for (const u of urls) {
        const img = new Image(); img.src = u;
        try { await img.decode(); } catch (e) { continue; }
        const w = img.naturalWidth; const h = img.naturalHeight; if (!w || !h) continue;
        const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 < 0) continue;
        out[u.split('?')[0]] = [w, h, x0, y0, x1 + 1, y1 + 1];
      }
      return out;
    });
    const keys = Object.keys(rows).sort();
    if (CHECK) {
      const src = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
      const bad = keys.filter((k) => !src.includes(`${JSON.stringify(k)}: ${JSON.stringify(rows[k])}`));
      console.log(bad.length ? `NG: 札の絵の範囲の表が古い ${bad.length} 枚(node tools/success/monsuc-art-box.js で作り直す): ${bad.slice(0, 5).join(', ')}` : `OK: 札の絵の範囲の表 ${keys.length} 枚が今の絵と同じ`);
      code = bad.length ? 1 : 0;
    } else {
      const body = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(rows[k])},`).join('\n');
      fs.writeFileSync(OUT, `// ===== モンサクのモンスターの札の「絵の中身の範囲」(生成物: node tools/success/monsuc-art-box.js。手で直さない) =====
// { 絵のパス(?v= を外す): [絵の幅, 高さ, 中身の左, 上, 右, 下] }(px)。MonsucMonCard が、中身を札の絵の枠いっぱい(下合わせ)に収めるのに使う。
// 表に無い絵は今までどおり絵全体を枠に収める。何も保存しない
const MONSUC_ART_BOX = Object.freeze({
${body}
});
`);
      console.log(`書きました: ${path.relative(ROOT, OUT)}(${keys.length} 枚)`);
    }
  } finally { await browser.close(); server.close(); }
  process.exit(code);
})().catch((e) => { console.error(e); process.exit(1); });
