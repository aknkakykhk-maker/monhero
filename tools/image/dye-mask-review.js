const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 実装済みのモンスターの染色マスク(部位分け)を、ゲームと同じ処理で染めて見直すための道具(2026-10-26)。
//
//   node image/dye-mask-review.js [出力フォルダ] [id ...]
//   node image/dye-mask-review.js <出力フォルダ> <id> --mask <仕上げ案のPNG>  … ゲームへ入れる前の案を同じ処理で試し塗りする
//                                   (配信マスクと同じく、解析サイズ(最大768px)へ最近傍で縮めて読む)
//
// 本番と同じ getDyeRegionMasks で部位マスクを作り、getRecoloredImage で染めた絵をマスクで切り抜いて
// 元絵へ重ねる(DyedMonsterImage と同じ重ね方)。マスクは原寸へ補間つきで引き伸ばし、アルファ128以上を
// その部位として、原寸の部位図を作ってから次を数える。
//
//   平らな所の境目 … 部位の境目(部位どうし・部位と染めない所)のうち、両側3画素先の元の絵の色が
//                    ほとんど同じ(差が小さい)所。境目が絵の線や色の変わり目に乗らず、同じ色の面の
//                    中を通っている = ずれている。境目の画素数に対する割合(%)
//   まっすぐな切れ目 … 境目が縦か横に一直線に24画素以上続く所(形・四角い範囲で部位を決めた跡)の長さ
//   散らばった点 … どこかの部位(または染めない所)が、ほかの部位に囲まれた小さなかたまり(原寸で
//                  4〜120画素)になっている数。囲んでいる部位と元の色がほぼ同じものだけ数える
//                  (目・口・模様など、絵として色の違う小さい部品は数えない)
//
// 書き出すもの(出力フォルダ。既定は tools/out/dye-mask-review/):
//   <id>.png     … 元絵 / 部位図 / 濃い色 / 白 / パステル を横に並べた全身と、問題の多い所の4倍の拡大
//   summary.json … 数値の一覧(ずれの大きい順)
const fs = require('fs');
const path = require('path');
const { currentLabels, getData, labelMap, decodeDataUrl, createCanvas } = require('./dye-mask-lib');

const args = process.argv.slice(2);
const MASK_ARG = args.includes('--mask') ? args.splice(args.indexOf('--mask'), 2)[1] : null;
const OUT = path.resolve(args[0] && !/^[A-Z]/.test(args[0]) ? args.shift() : path.join(TOOLS_DIR, 'out', 'dye-mask-review'));
const ONLY = args;
fs.mkdirSync(OUT, { recursive: true });

// 部位ごとの見分け色(部位図)と、染める色(濃い色・白・パステル)
const REGION_TINT = [[255, 40, 40], [40, 200, 60], [40, 90, 255], [255, 210, 0], [230, 40, 230]];
const PALETTES = {
  dark: ['custom:225:85:35', 'custom:0:90:60', 'custom:140:85:35', 'custom:280:75:40', 'custom:25:95:55'],
  white: ['custom:0:0:100', 'custom:0:0:100', 'custom:0:0:100', 'custom:0:0:100', 'custom:0:0:100'],
  pastel: ['custom:330:30:100', 'custom:190:30:100', 'custom:60:35:100', 'custom:270:28:100', 'custom:100:30:100'],
};

const dyedCanvas = async (dye, url, baseId, src, masks, colors) => {
  const W = src.width, H = src.height;
  const c = createCanvas(W, H), x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  for (let i = 0; i < masks.length; i++) {
    const [re, ma] = await Promise.all([decodeDataUrl(await dye.getRecoloredImage(url, colors[i % colors.length], baseId, i)), decodeDataUrl(masks[i])]);
    const t = createCanvas(W, H), tx = t.getContext('2d');
    tx.drawImage(re, 0, 0, W, H);
    tx.globalCompositeOperation = 'destination-in';
    tx.imageSmoothingEnabled = true;
    tx.drawImage(ma, 0, 0, W, H);
    x.drawImage(t, 0, 0);
  }
  return c;
};

const colorDiff = (d, i, j) => {
  const dr = d[i * 4] - d[j * 4], dg = d[i * 4 + 1] - d[j * 4 + 1], db = d[i * 4 + 2] - d[j * 4 + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

const analyze = (srcData, L, W, H) => {
  const flat = new Uint8Array(W * H); // 平らな所の境目
  const straight = new Uint8Array(W * H);
  let boundary = 0, flatN = 0;
  const FLAT_DIFF = 28, REACH = 3;
  // 境目: 右隣・下隣とラベルが違う(どちらも不透明)
  const isB = (i, j) => L[i] >= -1 && L[j] >= -1 && L[i] !== L[j];
  for (let y = REACH; y < H - REACH; y++) for (let x = REACH; x < W - REACH; x++) {
    const i = y * W + x;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const j = i + dx + dy * W;
      if (!isB(i, j)) continue;
      boundary++;
      // 両側 REACH 画素先の色を比べる。間に暗い線があれば線に乗っているとみなす
      const a = i - (dx + dy * W) * (REACH - 1), b = j + (dx + dy * W) * (REACH - 1);
      if (L[a] < -1 || L[b] < -1) continue;
      let darkLine = false;
      for (let k = -(REACH - 1); k <= REACH; k++) {
        const p = i + (dx + dy * W) * k;
        const v = Math.max(srcData[p * 4], srcData[p * 4 + 1], srcData[p * 4 + 2]);
        if (v < 70) { darkLine = true; break; }
      }
      if (darkLine) continue;
      if (colorDiff(srcData, a, b) < FLAT_DIFF && colorDiff(srcData, i, j) < FLAT_DIFF) { flat[i] = 1; flatN++; }
    }
  }
  // まっすぐな切れ目: 横方向の境目(上下でラベルが違う)が横一直線に続く/縦方向も同じ
  let straightLen = 0;
  const RUN = 24;
  for (let y = 0; y < H - 1; y++) {
    let run = 0, la = null, lb = null;
    for (let x = 0; x <= W; x++) {
      const i = y * W + x, j = i + W;
      const ok = x < W && isB(i, j) && (run === 0 || (L[i] === la && L[j] === lb));
      if (ok) { if (run === 0) { la = L[i]; lb = L[j]; } run++; }
      if (!ok || x === W) {
        if (run >= RUN) { straightLen += run; for (let k = x - run; k < x; k++) straight[y * W + k] = 1; }
        run = 0;
        if (x < W && isB(i, j)) { la = L[i]; lb = L[j]; run = 1; }
      }
    }
  }
  for (let x = 0; x < W - 1; x++) {
    let run = 0, la = null, lb = null;
    for (let y = 0; y <= H; y++) {
      const i = y * W + x, j = i + 1;
      const ok = y < H && isB(i, j) && (run === 0 || (L[i] === la && L[j] === lb));
      if (ok) { if (run === 0) { la = L[i]; lb = L[j]; } run++; }
      if (!ok || y === H) {
        if (run >= RUN) { straightLen += run; for (let k = y - run; k < y; k++) straight[k * W + x] = 1; }
        run = 0;
        if (y < H && isB(i, j)) { la = L[i]; lb = L[j]; run = 1; }
      }
    }
  }
  // 散らばった点: 小さなかたまりで、まわりが1つの部位に囲まれ、元の色がまわりとほぼ同じもの
  const seen = new Uint8Array(W * H);
  const specks = [];
  const scale = Math.max(W, H) / 1024;
  const MINS = Math.max(3, Math.round(4 * scale * scale)), MAXS = Math.round(120 * scale * scale);
  const stack = [];
  for (let s = 0; s < W * H; s++) {
    if (seen[s] || L[s] < -1) continue;
    const lab = L[s];
    const comp = [];
    stack.push(s); seen[s] = 1;
    let around = new Map(), touchesTransparent = false;
    while (stack.length) {
      const p = stack.pop(); comp.push(p);
      const px = p % W, py = (p - px) / W;
      for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) { touchesTransparent = true; continue; }
        const q = ny * W + nx;
        if (L[q] === lab) { if (!seen[q]) { seen[q] = 1; stack.push(q); } }
        else if (L[q] < -1) touchesTransparent = true;
        else around.set(L[q], (around.get(L[q]) || 0) + 1);
      }
      if (comp.length > MAXS) break;
    }
    // 大きいかたまりは途中で止めたので、残りも見た印を付けておく
    if (comp.length > MAXS) {
      while (stack.length) { const p = stack.pop(); const px = p % W, py = (p - px) / W; for (const [nx, ny] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) { if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const q = ny * W + nx; if (L[q] === lab && !seen[q]) { seen[q] = 1; stack.push(q); } } }
      continue;
    }
    if (comp.length < MINS || touchesTransparent || around.size !== 1) continue;
    const outer = [...around.keys()][0];
    // 中と、まわり(1画素外)の平均色を比べる
    let ir = 0, ig = 0, ib = 0;
    for (const p of comp) { ir += srcData[p * 4]; ig += srcData[p * 4 + 1]; ib += srcData[p * 4 + 2]; }
    ir /= comp.length; ig /= comp.length; ib /= comp.length;
    let or = 0, og = 0, ob = 0, on = 0;
    for (const p of comp) {
      const px = p % W, py = (p - px) / W;
      for (const [nx, ny] of [[px - 2, py], [px + 2, py], [px, py - 2], [px, py + 2]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (L[q] === outer) { or += srcData[q * 4]; og += srcData[q * 4 + 1]; ob += srcData[q * 4 + 2]; on++; }
      }
    }
    if (!on) continue;
    or /= on; og /= on; ob /= on;
    const d = Math.sqrt((ir - or) ** 2 + (ig - og) ** 2 + (ib - ob) ** 2);
    if (d < 40) {
      let sx = 0, sy = 0; for (const p of comp) { sx += p % W; sy += Math.floor(p / W); }
      specks.push({ x: Math.round(sx / comp.length), y: Math.round(sy / comp.length), n: comp.length, lab, outer });
    }
  }
  return { boundary, flatN, flatPct: boundary ? flatN / boundary * 100 : 0, straightLen, specks, flat, straight };
};

// 問題の多い所を探す(ブロックごとの点数の上位)
const hotspots = (W, H, res, k = 3) => {
  const B = Math.round(Math.max(W, H) / 8);
  const cells = [];
  for (let by = 0; by < H; by += Math.round(B / 2)) for (let bx = 0; bx < W; bx += Math.round(B / 2)) {
    let s = 0;
    for (let y = by; y < Math.min(H, by + B); y++) for (let x = bx; x < Math.min(W, bx + B); x++) {
      const i = y * W + x; s += res.flat[i] + res.straight[i] * 2;
    }
    for (const sp of res.specks) if (sp.x >= bx && sp.x < bx + B && sp.y >= by && sp.y < by + B) s += 40;
    cells.push({ bx, by, B, s });
  }
  cells.sort((a, b) => b.s - a.s);
  const picked = [];
  for (const c of cells) {
    if (c.s <= 0) break;
    if (picked.some(p => Math.abs(p.bx - c.bx) < B && Math.abs(p.by - c.by) < B)) continue;
    picked.push(c);
    if (picked.length >= k) break;
  }
  return picked;
};

const overlayCanvas = (src, L, W, H, res) => {
  const c = createCanvas(W, H), x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  const id = x.getImageData(0, 0, W, H), d = id.data;
  for (let i = 0; i < W * H; i++) {
    if (L[i] < -1) continue;
    const g = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11);
    if (L[i] === -1) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.round(g * 0.55 + 100 * 0.45); continue; }
    const t = REGION_TINT[L[i] % REGION_TINT.length];
    for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.round(g * 0.45 + t[k] * 0.55);
  }
  // 境目の問題: 平らな所の境目=水色、まっすぐな切れ目=黒
  for (let i = 0; i < W * H; i++) {
    if (res.straight[i]) { d[i * 4] = 0; d[i * 4 + 1] = 0; d[i * 4 + 2] = 0; d[i * 4 + 3] = 255; }
    else if (res.flat[i]) { d[i * 4] = 0; d[i * 4 + 1] = 255; d[i * 4 + 2] = 255; d[i * 4 + 3] = 255; }
  }
  x.putImageData(id, 0, 0);
  return c;
};

// 仕上げ案のPNGから、配信マスクと同じ読み方で部位マスク(dataURL)を作る
const candidateMasks = async (file, src, srcData, W, H, n) => {
  const { loadImage } = require('canvas');
  const im = await loadImage(file);
  const scale = Math.min(1, 768 / Math.max(W, H));
  const w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale));
  const md = getData(im, w, h, false), sd = getData(src, w, h);
  const masks = [];
  for (let r = 0; r < n; r++) {
    const c = createCanvas(w, h), x = c.getContext('2d'), id = x.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const R = md[i * 4], G = md[i * 4 + 1], B = md[i * 4 + 2];
      if (md[i * 4 + 3] < 20) continue;
      const lab = (R > 200 && G < 80 && B < 80) ? 0 : (G > 200 && R < 80 && B < 80) ? 1 : (B > 200 && R < 80 && G < 80) ? 2 : (R > 200 && G > 200 && B < 80) ? 3 : (R > 200 && G < 80 && B > 200) ? 4 : -1;
      if (lab === r) id.data[i * 4 + 3] = sd[i * 4 + 3];
    }
    x.putImageData(id, 0, 0);
    masks.push(c.toDataURL());
  }
  const maskImgs = await Promise.all(masks.map(decodeDataUrl));
  return { masks, maskW: w, L: labelMap(srcData, maskImgs.map(m => getData(m, W, H)), W, H) };
};

(async () => {
  const { dyeModule } = require('./dye-mask-lib');
  const dye = dyeModule();
  const ids = ONLY.length ? ONLY : Object.keys(dye.MASU_COLOR_REGION_HUES);
  const summary = [];
  for (const baseId of ids) {
    const cur = await currentLabels(baseId);
    if (!cur) { console.log(`${baseId}: 絵が見つからない`); continue; }
    const { url, src, W, H, srcData } = cur;
    let { masks, maskW, L } = cur;
    if (MASK_ARG) ({ masks, maskW, L } = await candidateMasks(MASK_ARG, src, srcData, W, H, masks.length));
    const res = analyze(srcData, L, W, H);
    const views = {
      src: (() => { const c = createCanvas(W, H); c.getContext('2d').drawImage(src, 0, 0); return c; })(),
      map: overlayCanvas(src, L, W, H, res),
      dark: await dyedCanvas(dye, url, baseId, src, masks, PALETTES.dark),
      white: await dyedCanvas(dye, url, baseId, src, masks, PALETTES.white),
      pastel: await dyedCanvas(dye, url, baseId, src, masks, PALETTES.pastel),
    };
    const spots = hotspots(W, H, res);
    // 1枚にまとめる: 上段 全身5枚(高さ480)、下段 問題の所ごとに 元絵/部位図/濃い色 の4倍
    const TH = 480, tw = Math.round(W * TH / H);
    const CROP = 120; // 原寸での切り出しの一辺(4倍で480)
    const sheetW = Math.max(tw * 5 + 60, 3 * 480 + 40);
    const sheetH = 40 + TH + 20 + spots.length * (480 + 30) + 10;
    const sheet = createCanvas(sheetW, sheetH), sx = sheet.getContext('2d');
    sx.fillStyle = '#2b2b2b'; sx.fillRect(0, 0, sheetW, sheetH);
    sx.fillStyle = '#fff'; sx.font = '22px sans-serif';
    const stat = `${baseId}  部位${masks.length}  マスク${maskW}px→原寸${W}px  平らな所の境目 ${res.flatPct.toFixed(1)}%  まっすぐ ${res.straightLen}px  点 ${res.specks.length}`;
    sx.fillText(stat, 10, 28);
    ['src', 'map', 'dark', 'white', 'pastel'].forEach((k, n) => {
      const bg = k === 'white' ? '#556' : '#888';
      sx.fillStyle = bg; sx.fillRect(10 + n * (tw + 10), 40, tw, TH);
      sx.drawImage(views[k], 0, 0, W, H, 10 + n * (tw + 10), 40, tw, TH);
    });
    spots.forEach((sp, n) => {
      const cx = Math.min(W - CROP, Math.max(0, sp.bx + Math.round(sp.B / 2) - CROP / 2));
      const cy = Math.min(H - CROP, Math.max(0, sp.by + Math.round(sp.B / 2) - CROP / 2));
      const y0 = 40 + TH + 20 + n * 510;
      sx.fillStyle = '#fff'; sx.font = '18px sans-serif';
      sx.fillText(`(${cx},${cy}) 4倍`, 10, y0 + 16);
      sx.imageSmoothingEnabled = false;
      ['src', 'map', 'dark'].forEach((k, m) => {
        sx.fillStyle = '#888'; sx.fillRect(10 + m * 490, y0 + 24, 480, 480);
        sx.drawImage(views[k], cx, cy, CROP, CROP, 10 + m * 490, y0 + 24, 480, 480);
      });
      sx.imageSmoothingEnabled = true;
    });
    fs.writeFileSync(path.join(OUT, `${baseId}.png`), sheet.toBuffer('image/png'));
    // 全身の2倍・4倍を見るため、各図を原寸で残す
    for (const k of ['map', 'dark', 'white', 'pastel']) fs.writeFileSync(path.join(OUT, `${baseId}-${k}.png`), views[k].toBuffer('image/png'));
    const row = { baseId, regions: masks.length, maskW, W, H, flatPct: +res.flatPct.toFixed(2), flatN: res.flatN, straightLen: res.straightLen, specks: res.specks.length, spots: spots.map(s => [s.bx, s.by, s.B]) };
    summary.push(row);
    console.log(stat);
  }
  summary.sort((a, b) => (b.flatPct + b.straightLen / 50 + b.specks) - (a.flatPct + a.straightLen / 50 + a.specks));
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
  console.log(`書き出し: ${OUT}`);
})();
