const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 染色もどきの「部位マスク」の品質を実測して、モンスターごとに比べる。
//
// 模様カスタム画面でモッチーだけ輪郭がギザギザ・白い縁が出る、という報告の原因を
// 画像を差し替えずに切り分けるための調査用。game-system.jsx の染色処理をそのまま
// 切り出し、実際のブラウザでマスクを作って次を数える。
//
//   面積      … その部位として塗られた画素数
//   縁の割合  … 塗られた画素のうち、隣に塗られていない画素がある割合。
//                大きいほど輪郭がギザギザ・櫛状に荒れている
//   飛び画素  … 上下左右に仲間がいない孤立画素。多いほどムラ・ノイズが出る
//
// 解析の解像度(MASK_ANALYSIS_MAX_SIZE)を変えて比べられるようにしてある。
// 部位定義を1画素単位で書いているモンスター(posBbox)は、解析解像度を下げると
// 定義そのものが潰れるため、ここで差がはっきり出る。
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.resolve(TOOLS_DIR, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const source = read('monster-hero/src/game-system.jsx');

const from = source.indexOf('const MASU_COLOR_TARGET = {');
const to = source.indexOf('const DyedMonsterImage =');
if (from < 0 || to < 0) { console.log('NG: 染色処理を切り出せませんでした'); process.exit(1); }
const dyeSource = source.slice(from, to);

const TARGETS = ['Mocchi', 'Iblis', 'Golem', 'Pixie'];
// いまの実装値と、原寸に近い値で比べる
const ANALYSIS_SIZES = [384, 1200];

const pageFor = (maxSize) => `<!doctype html><meta charset="utf-8">
<!-- 画像はPNGファイルになったので、monster-hero/ を基準にパスを解決させる -->
<base href="/monster-hero/"><body>
<script src="/monster-hero/data/images/images-ally.js"></script>
<script src="/monster-hero/data/ally-monsters.js"></script>
<script>
${dyeSource.replace(/const MASK_ANALYSIS_MAX_SIZE = \d+;/, `let MASK_ANALYSIS_MAX_SIZE = ${maxSize};`)}
window.__setSize = (n) => { MASK_ANALYSIS_MAX_SIZE = n; };
window.__clearCache = () => { for (const k of Object.keys(_dyeRegionMaskCache)) delete _dyeRegionMaskCache[k]; };
// マスク画像(白=その部位)を読み直して、面積・縁の割合・飛び画素を数える
const measureMask = (url) => new Promise((resolve) => {
  if (!url) { resolve(null); return; }
  const img = new Image();
  img.onload = () => {
    const w = img.naturalWidth, h = img.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    const on = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) on[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    let area = 0, edge = 0, specks = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!on[i]) continue;
      area++;
      const n = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]].map(([a,b]) => (a<0||b<0||a>=w||b>=h) ? 0 : on[b*w+a]);
      const around = n.reduce((s,v) => s+v, 0);
      if (around < 4) edge++;
      if (around === 0) specks++;
    }
    resolve({ w, h, area, edge, specks });
  };
  img.onerror = () => resolve(null);
  img.src = url;
});
// 「原寸で作ったマスク」と「384pxで作って引き伸ばしたマスク」のズレを、
// 元画像の画素単位で測る。ズレが大きいほど、絵の輪郭とマスクの輪郭が合わず
// 白い縁・階段状のギザギザになる
window.__mismatch = async (ids) => {
  const rasterize = (url, size) => new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
      const ctx = cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;   // 引き伸ばしの階段をそのまま見たいので補間しない
      ctx.drawImage(img, 0, 0, size, size);
      const d = ctx.getImageData(0, 0, size, size).data;
      const on = new Uint8Array(size * size);
      for (let i = 0; i < size * size; i++) on[i] = d[i * 4 + 3] > 127 ? 1 : 0;
      resolve(on);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  const out = {};
  for (const id of ids) {
    const base = ALL_PLAYER_MONSTERS[id];
    const nat = await new Promise((r) => { const im = new Image(); im.onload = () => r(im.naturalWidth); im.onerror = () => r(0); im.src = base.imgUrl; });
    const hues = MASU_COLOR_REGION_HUES[id] || [];
    // 384pxのマスク(いまの実装)
    window.__setSize(384);
    const coarse = await Promise.resolve(getDyeRegionMasks(id, base.imgUrl));
    // 原寸のマスク(理想)
    window.__setSize(2048);
    window.__clearCache();
    const fine = await Promise.resolve(getDyeRegionMasks(id, base.imgUrl));
    const regions = [];
    for (let i = 0; i < hues.length; i++) {
      const a = await rasterize(coarse && coarse[i], nat);
      const b = await rasterize(fine && fine[i], nat);
      if (!a || !b) { regions.push(null); continue; }
      let diff = 0, areaFine = 0, perim = 0;
      for (let y = 0; y < nat; y++) for (let x = 0; x < nat; x++) {
        const i2 = y * nat + x;
        if (b[i2]) { areaFine++; if (!(x && y && x < nat-1 && y < nat-1 && b[i2-1] && b[i2+1] && b[i2-nat] && b[i2+nat])) perim++; }
        if (a[i2] !== b[i2]) diff++;
      }
      regions.push({ diff, areaFine, perim, offsetPx: perim ? +(diff / perim).toFixed(2) : null });
    }
    out[id] = { nat, maskPx: 384, ratio: +(nat / 384).toFixed(2), regions };
    window.__setSize(384); window.__clearCache();
  }
  return out;
};
// 元画像そのものの質を測る。
//   にじみ幅   … 輪郭で半透明になっている帯の太さ(画素)。太いほど拡大された絵で、
//                 染色時にアンチエイリアス除外へ引っかかり白い縁が出やすい
//   実効解像度 … 1/2・1/3・1/4へ縮めてから戻したときの差。差が小さいほど
//                 「大きいだけで中身の細かさが無い(引き伸ばした)絵」
window.__imageQuality = async (ids) => {
  const load = (url) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
  const out = {};
  for (const id of ids) {
    const im = await load(ALL_PLAYER_MONSTERS[id].imgUrl);
    const n = im.naturalWidth;
    const cv = document.createElement('canvas'); cv.width = n; cv.height = n;
    const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0);
    const d = ctx.getImageData(0, 0, n, n).data;
    // にじみ幅: 不透明(>=200)の画素から外へ向かって、半透明(1..199)が何画素続くか
    let bands = 0, bandTotal = 0;
    for (let y = 0; y < n; y += 3) {
      let run = 0;
      for (let x = 0; x < n; x++) {
        const a = d[(y * n + x) * 4 + 3];
        if (a > 0 && a < 200) run++;
        else { if (run > 0 && run < 30) { bands++; bandTotal += run; } run = 0; }
      }
    }
    // 実効解像度: 縮めて戻したときの平均差(不透明部分だけ)
    const reduce = (f) => {
      const s2 = Math.max(1, Math.round(n / f));
      const a1 = document.createElement('canvas'); a1.width = s2; a1.height = s2;
      const c1 = a1.getContext('2d'); c1.imageSmoothingEnabled = true; c1.imageSmoothingQuality = 'high';
      c1.drawImage(im, 0, 0, s2, s2);
      const a2 = document.createElement('canvas'); a2.width = n; a2.height = n;
      const c2 = a2.getContext('2d'); c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = 'high';
      c2.drawImage(a1, 0, 0, n, n);
      const e = c2.getImageData(0, 0, n, n).data;
      let sum = 0, cnt = 0;
      for (let i = 0; i < n * n; i++) {
        if (d[i * 4 + 3] < 200) continue;
        sum += Math.abs(d[i*4] - e[i*4]) + Math.abs(d[i*4+1] - e[i*4+1]) + Math.abs(d[i*4+2] - e[i*4+2]);
        cnt++;
      }
      return cnt ? +(sum / cnt / 3).toFixed(2) : null;
    };
    out[id] = { n, blur: bands ? +(bandTotal / bands).toFixed(2) : null, d2: reduce(2), d3: reduce(3), d4: reduce(4) };
  }
  return out;
};
window.__measure = async (ids) => {
  const out = {};
  for (const id of ids) {
    const base = ALL_PLAYER_MONSTERS[id];
    const hues = MASU_COLOR_REGION_HUES[id] || [];
    const t0 = performance.now();
    const masks = await Promise.resolve(getDyeRegionMasks(id, base.imgUrl));
    const ms = Math.round(performance.now() - t0);
    const regions = [];
    for (let i = 0; i < hues.length; i++) {
      const m = await measureMask(masks && masks[i]);
      const def = hues[i];
      const kind = (def && def.posBbox) ? '1画素定義' : (def && def.bbox) ? '色相＋範囲' : (def && def.white) ? '白' : '色相';
      regions.push({ kind, ...(m || {}) });
    }
    out[id] = { natural: null, ms, regions };
    // 元画像の実寸も返す
    await new Promise((r) => { const im = new Image(); im.onload = () => { out[id].natural = im.naturalWidth; r(); }; im.onerror = r; im.src = base.imgUrl; });
  }
  return out;
};
</script></body>`;

const MIME = { '.js':'text/javascript', '.html':'text/html' };
let currentPage = '';
const server = http.createServer((req, res) => {
  if (req.url === '/harness.html') { res.writeHead(200, {'Content-Type':'text/html'}); res.end(currentPage); return; }
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright がありません'); process.exit(0); }
  await new Promise(r => server.listen(8979, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const size of ANALYSIS_SIZES) {
      currentPage = pageFor(size);
      const page = await browser.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String(e)));
      await page.goto('http://localhost:8979/harness.html', { waitUntil: 'load' });
      const r = await page.evaluate((ids) => window.__measure(ids), TARGETS);
      if (errs.length) console.log(`NG: 実行時エラー — ${errs[0]}`);
      console.log(`\n===== 解析の解像度 ${size}px ${size === 384 ? '(いまの実装値)' : '(原寸に近い値)'} =====`);
      for (const id of TARGETS) {
        const d = r[id];
        if (!d) { console.log(`${id}: 取得できませんでした`); continue; }
        console.log(`\n【${id}】元画像 ${d.natural}x${d.natural} / マスク生成 ${d.ms}ms`);
        d.regions.forEach((g, i) => {
          if (!g || !g.area) { console.log(`  染色${i + 1} (${g && g.kind}) : マスクなし`); return; }
          const edgeRatio = (g.edge / g.area * 100).toFixed(1);
          console.log(`  染色${i + 1} (${String(g.kind).padEnd(6)}) 面積 ${String(g.area).padStart(6)}px / 縁の割合 ${String(edgeRatio).padStart(5)}% / 飛び画素 ${g.specks}`);
        });
      }
      await page.close();
    }
    {
      const page = await browser.newPage();
      await page.goto('http://localhost:8979/harness.html', { waitUntil: 'load' });
      const q = await page.evaluate((ids) => window.__imageQuality(ids), TARGETS);
      console.log('\n===== 元画像そのものの質 =====');
      console.log('  にじみ幅 = 輪郭の半透明の帯の太さ(画素)。実効解像度 = 縮めて戻したときの平均色差(小さいほど中身が無い)');
      for (const id of TARGETS) {
        const g = q[id]; if (!g) continue;
        console.log(`  ${id.padEnd(7)} ${String(g.n).padStart(4)}px / にじみ幅 ${String(g.blur).padStart(5)}px / 1/2に縮めた差 ${String(g.d2).padStart(5)} / 1/3 ${String(g.d3).padStart(5)} / 1/4 ${String(g.d4).padStart(5)}`);
      }
      await page.close();
    }
    console.log('\n※ 縁の割合は「塗られた画素のうち、隣に塗られていない画素がある割合」。');
    console.log('  なめらかな面なら数%、櫛状に荒れていると数十%になる。');
    // 絵とマスクの解像度差が、輪郭のズレとして何画素になるかを測る
    currentPage = pageFor(384);
    {
      const page = await browser.newPage();
      await page.goto('http://localhost:8979/harness.html', { waitUntil: 'load' });
      const r = await page.evaluate((ids) => window.__mismatch(ids), TARGETS);
      console.log('\n===== 絵の輪郭とマスクの輪郭のズレ(元画像の画素単位) =====');
      for (const id of TARGETS) {
        const d = r[id];
        if (!d) continue;
        console.log(`\n【${id}】絵 ${d.nat}px / マスク ${d.maskPx}px → 絵はマスクの ${d.ratio} 倍こまかい`);
        d.regions.forEach((g, i) => {
          if (!g) { console.log(`  染色${i + 1}: 測れず`); return; }
          console.log(`  染色${i + 1} ズレ面積 ${String(g.diff).padStart(6)}px / 輪郭の長さ ${String(g.perim).padStart(6)}px → 平均 ${g.offsetPx} 画素ぶん輪郭がずれる`);
        });
      }
      await page.close();
    }
    await browser.close(); server.close();
  } catch (e) {
    console.log(`NG: 計測できませんでした — ${e.message}`);
    await browser.close(); server.close(); process.exit(1);
  }
})();
