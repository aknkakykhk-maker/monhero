// 染色もどきの「輪郭の塗り残し」を実測して見張る検査。
//
// 部位マスクは解析を軽くするため縮小した画像(MASK_ANALYSIS_MAX_SIZE)で作っている。
// 元絵がそれより大幅に大きいモンスターは、マスクの1画素が元絵の3画素ぶんになり、
//   ・部位の境目がマスクの画素単位の階段(ジャギー)になる
//   ・輪郭の半透明部分が染色から外れ、元の色の縁が残る
// という形で模様カスタムの丸プレビュー(96px表示)に出てしまう。
// これを避けるためMASK_HIRES_BASE_IDSのモンスターはマスクだけ高解像度で書き出しており、
// この検査はその効き目が失われていないかを数値で確かめる。
//
//   輪郭の塗り残し … 元絵の解像度で、絵が見えている(alpha>=32)のにどの部位マスクにも
//                    入っていない画素の割合。輪郭から3px以内に限って数える。
//                    大きいほど「染めたのに元の色の縁が残る」状態になる。
//
// ギザギザそのものは数値にしづらいため、ここではマスクが解析サイズのまま
// 書き出されていないか(=高解像度書き出しが外れていないか)を主に見張る。
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const from = source.indexOf('const MASU_COLOR_TARGET = {');
const to = source.indexOf('const DyedMonsterImage =');
if (from < 0 || to < 0) { console.log('NG: 染色処理を切り出せませんでした'); process.exit(1); }
const dyeSource = source.slice(from, to);

// 染めた色が元の色とはっきり違うほど塗り残しが見つけやすいので、寒色で染めて測る
const COLORS = ['blue', 'blue', 'blue'];
const RIM_BARE_LIMIT = 5; // %
// 高解像度マスクが必ず効いていてほしいモンスター(元絵が解析サイズより大幅に大きいもの)。
// MASK_HIRES_BASE_IDSからうっかり外れたときに気付けるよう、ここにも明示しておく
const EXPECTED = ['Mocchi'];

const page = `<!doctype html><meta charset="utf-8"><body>
<script src="/monster-hero/data/images/images-ally.js"></script>
<script src="/monster-hero/data/ally-monsters.js"></script>
<script>
${dyeSource}
window.__targets = () => Object.keys(MASK_HIRES_BASE_IDS);
window.__analysisSize = () => MASK_ANALYSIS_MAX_SIZE;
const load = (url) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
window.__measure = async (id, colors) => {
  const base = ALL_PLAYER_MONSTERS[id];
  const t0 = performance.now();
  const masks = await Promise.resolve(getDyeRegionMasks(id, base.imgUrl));
  const ms = Math.round(performance.now() - t0);
  if (!masks) return { error: 'マスクを作れませんでした' };
  const art = await load(base.imgUrl);
  const n = art.naturalWidth;
  const cv = document.createElement('canvas'); cv.width = n; cv.height = n;
  const ctx = cv.getContext('2d'); ctx.drawImage(art, 0, 0);
  const ad = ctx.getImageData(0, 0, n, n).data;
  // 全部位のマスクを元絵の解像度へ戻して足し合わせる
  const sum = new Uint16Array(n * n);
  const maskSizes = [];
  for (let i = 0; i < masks.length; i++) {
    if (!masks[i]) { maskSizes.push(0); continue; }
    const mi = await load(masks[i]);
    maskSizes.push(mi.naturalWidth);
    const mc = document.createElement('canvas'); mc.width = n; mc.height = n;
    const mx = mc.getContext('2d');
    mx.imageSmoothingEnabled = true; mx.imageSmoothingQuality = 'high';
    mx.drawImage(mi, 0, 0, n, n);
    const md = mx.getImageData(0, 0, n, n).data;
    for (let p = 0; p < n * n; p++) sum[p] = Math.min(255, sum[p] + md[p * 4 + 3]);
  }
  const on = new Uint8Array(n * n);
  for (let p = 0; p < n * n; p++) on[p] = ad[p * 4 + 3] >= 32 ? 1 : 0;
  let rim = 0, rimBare = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const p = y * n + x;
    if (!on[p]) continue;
    const isRim = [[x-3,y],[x+3,y],[x,y-3],[x,y+3]].some(([a, b]) => (a < 0 || b < 0 || a >= n || b >= n) ? true : !on[b * n + a]);
    if (!isRim) continue;
    rim++;
    if (sum[p] < 32) rimBare++;
  }
  return { ms, n, maskSizes, rim, rimBare, rimBareRatio: +(rimBare / Math.max(1, rim) * 100).toFixed(2) };
};
</script></body>`;

const MIME = { '.js': 'text/javascript', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  if (req.url === '/harness.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright がありません'); process.exit(0); }
  await new Promise(r => server.listen(8982, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const problems = [];
  try {
    const tab = await browser.newPage();
    const errs = [];
    tab.on('pageerror', e => errs.push(String(e)));
    await tab.goto('http://localhost:8982/harness.html', { waitUntil: 'load' });
    if (errs.length) { console.log('NG: 実行時エラー — ' + errs[0]); process.exitCode = 1; }
    const declared = await tab.evaluate(() => window.__targets());
    const analysisSize = await tab.evaluate(() => window.__analysisSize());
    EXPECTED.forEach((id) => { if (!declared.includes(id)) problems.push(`${id}: MASK_HIRES_BASE_IDS から外れています(高解像度マスクが効きません)`); });
    const targets = Array.from(new Set([...EXPECTED, ...declared]));
    for (const id of targets) {
      const r = await tab.evaluate(([i, c]) => window.__measure(i, c), [id, COLORS]);
      if (!r || r.error) { problems.push(`${id}: ${(r && r.error) || '計測できませんでした'}`); continue; }
      console.log(`${id.padEnd(8)} 元絵 ${r.n}px / マスク ${r.maskSizes.join(',')}px / 生成 ${r.ms}ms / 輪郭の塗り残し ${r.rimBareRatio}%`);
      if (r.maskSizes.some(s => s > 0 && s <= analysisSize)) {
        problems.push(`${id}: マスクが解析サイズ(${analysisSize}px)のまま書き出されています。高解像度書き出しが効いていません`);
      }
      if (r.rimBareRatio > RIM_BARE_LIMIT) {
        problems.push(`${id}: 輪郭の塗り残しが ${r.rimBareRatio}% (上限 ${RIM_BARE_LIMIT}%)。染めても元の色の縁が残ります`);
      }
    }
    await tab.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (problems.length) { problems.forEach(p => console.log('NG: ' + p)); process.exitCode = 1; }
  else console.log('OK: 高解像度マスクの輪郭に塗り残しはありません');
})();
