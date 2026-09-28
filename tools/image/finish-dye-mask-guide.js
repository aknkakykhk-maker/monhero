// 部位ごとに色を塗り分けた「指示図」から、配信する染色マスク(最大5部位)を作る(2026-09-28)。
//
//   node image/finish-dye-mask-guide.js mel-whip
//   node image/finish-dye-mask-guide.js mel-whip --out /tmp/x.png   … 配信フォルダへ書かずに試す
//
// 2026-09-28・ユーザーが元の絵の上に部位ごとの色を塗った指示図(凡例つき・5部位＋目)を用意してくれた。
// 指示図は元の絵(tools/art-sources/monsters/<ID>-original.png)と同じ大きさで、ずれは0〜3px。
// 色ははっきりした単色なので、色相で部位を読む。そのうえで次を機械的に直す。**塗り分けの意図は変えない**。
//   ① 指示図の色を読む(赤=1 緑=2 青=3 黄=4 紫=5 水色=目 → eyesTo へ。灰・黒=染めない)
//   ② 境目のそば(band px)だけ、近くの確実な画素(境目から離れた所)の平均色にいちばん近い部位へ寄せる。
//      指示図の数pxのずれを、元の絵の色の境目へそろえる
//   ③ 指示図の線(暗い画素)は、まわりの塗られた部位へ入れる(同じ部位に囲まれているときだけ)
//   ④ 部位の付け替え(moves)。ユーザーの指示で、指示図と違う部位へ移すもの
//   ⑤ 立ち絵(配信中の大きさ)へ、多数決で縮める
//   ⑥ 小さな切れ端をならす
// 出力は赤=1 緑=2 青=3 黄=4 マゼンタ=5(_exactDyeMaskRegion と同じ読み方)。
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIGS = {
  'mel-whip': {
    guide: 'mel-whip-dye-mask-received-v5.png',
    original: 'MEL_WHIP-original.png',
    // 指示図の凡例の色(実測)
    palette: [[1, 0], [2, 120], [3, 225], [4, 58], [5, 280], [6, 185]],   // [部位, 色相]
    eyesTo: 5,                    // 目は髪と同じ(2026-09-28 ユーザー指示「目は髪の毛と同じ色にして」)
    band: 3, radius: 8,
    // ケーキの目と口の線(④の中の真っ暗な画素)と、そのふちのやや暗い画素は染めない
    cakeFaceDark: { region: 4, dark: 70, edge: 190, steps: 4 },
    // 元の絵 → 立ち絵(634x916)。立ち絵は元の絵の (269,2) から 793x1145 を切り出して縮めたもの
    crop: [269, 2, 793, 1145],
    moves: [
      // 傘の本体は赤(1)でなく緑(2)。服と同じ色で染まる(同日「傘はむしろ赤を緑マスクに変更」)。
      // 1 に塗られているのは傘とイチゴ・腰の実だけなので、元の絵で赤くない画素を 2 へ移す
      { from: 1, to: 2, when: 'notRed' },
      // ケーキの上のホイップはケーキのクリーム(4)と同じ(同日「ホイップはケーキの色がいい」)。
      // 指示図では果物と一緒に「染めない」なので、白く明るい所を 4 へ。脚(白いタイツ)は範囲から外す
      { from: 0, to: 4, when: 'whip', box: [320, 690, 1070, 880], exclude: [[600, 640, 770, 830]], minArea: 250 },
      // 傘のてっぺんの縞(黄緑の帯と白い線)は細く、指示図では帯と線が入り混じっていた。縞の範囲だけ、
      // 元の絵の色ではっきりしたもの(濃い黄緑=2・白=3)を決め直す。淡い黄緑のフリルは中間の色なので動かない
      { when: 'stripes', to: [2, 3], polys: [[[300, 170], [340, 125], [400, 88], [460, 70], [560, 60], [640, 60], [720, 68], [790, 86], [840, 118], [875, 160], [860, 185], [820, 160], [760, 136], [680, 119], [600, 117], [530, 119], [460, 129], [400, 146], [340, 171], [300, 200]]] },
    ],
  },
};

const args = process.argv.slice(2);
const name = args.find(a => !a.startsWith('--'));
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const cfg = CONFIGS[name];
if (!cfg) { console.log(`使い方: node image/finish-dye-mask-guide.js <${Object.keys(CONFIGS).join('|')}> [--out <パス>]`); process.exit(1); }

const hsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
  let h = 0;
  if (dl) { if (mx === r) h = 60 * (((g - b) / dl) % 6); else if (mx === g) h = 60 * ((b - r) / dl + 2); else h = 60 * ((r - g) / dl + 4); }
  if (h < 0) h += 360;
  return [h, mx ? dl / mx : 0, mx];
};

(async () => {
  const art = await loadImage(path.join(ROOT, 'tools/art-sources/monsters', cfg.original));
  const guide = await loadImage(path.join(ROOT, 'tools/art-sources/dye-masks', cfg.guide));
  const W = art.width, H = art.height, N = W * H;
  const pixels = (im, bg) => { const c = createCanvas(W, H), x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, W, H); } x.drawImage(im, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; };
  const A = pixels(art), G = pixels(guide, '#000');
  const opaque = (i) => A[i * 4 + 3] >= 128;
  const nb4 = (i) => { const x = i % W, o = []; if (x > 0) o.push(i - 1); if (x < W - 1) o.push(i + 1); if (i >= W) o.push(i - W); if (i < N - W) o.push(i + W); return o; };
  const count = (lab) => { const c = [0, 0, 0, 0, 0, 0]; for (let i = 0; i < N; i++) if (opaque(i)) c[lab[i]]++; return c.join(' / '); };

  // ① 指示図の色を読む
  let lab = new Int8Array(N);
  const gdark = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    if (!opaque(i)) continue;
    const [h, s, v] = hsv(G[i * 4], G[i * 4 + 1], G[i * 4 + 2]);
    if (v < 0.35) { gdark[i] = 1; continue; }
    if (s < 0.35) continue;
    let best = 0, bd = 40;
    for (const [L, hue] of cfg.palette) { const d = Math.min(Math.abs(h - hue), 360 - Math.abs(h - hue)); if (d < bd) { bd = d; best = L; } }
    lab[i] = best === 6 ? cfg.eyesTo : best;
  }
  console.log(`指示図      染めない/1/2/3/4/5 = ${count(lab)}`);

  // ② 境目のそばを、元の絵の色でそろえる(線の画素は③で扱う)
  {
    const B = cfg.band, R = cfg.radius;
    const dist = new Uint8Array(N).fill(255); let front = [];
    for (let i = 0; i < N; i++) if (opaque(i) && !gdark[i] && nb4(i).some(j => opaque(j) && !gdark[j] && lab[j] !== lab[i])) { dist[i] = 0; front.push(i); }
    for (let d = 1; d <= B; d++) { const nx = []; for (const i of front) for (const j of nb4(i)) if (opaque(j) && dist[j] === 255) { dist[j] = d; nx.push(j); } front = nx; }
    const sure = (j) => opaque(j) && !gdark[j] && dist[j] > B && A[j * 4 + 3] > 200;
    const next = lab.slice();
    for (let i = 0; i < N; i++) {
      if (dist[i] > B || gdark[i] || !opaque(i)) continue;
      const x = i % W, y = (i / W) | 0;
      const acc = {};
      for (let yy = Math.max(0, y - R); yy <= Math.min(H - 1, y + R); yy++) for (let xx = Math.max(0, x - R); xx <= Math.min(W - 1, x + R); xx++) {
        const j = yy * W + xx; if (!sure(j)) continue;
        const a = acc[lab[j]] || (acc[lab[j]] = [0, 0, 0, 0]); a[0] += A[j * 4]; a[1] += A[j * 4 + 1]; a[2] += A[j * 4 + 2]; a[3]++;
      }
      let best = null, bd = Infinity;
      for (const L in acc) { const a = acc[L]; if (a[3] < 6) continue; const d = (A[i * 4] - a[0] / a[3]) ** 2 + (A[i * 4 + 1] - a[1] / a[3]) ** 2 + (A[i * 4 + 2] - a[2] / a[3]) ** 2; if (d < bd) { bd = d; best = +L; } }
      if (best !== null) next[i] = best;
    }
    lab = next;
  }

  // ③ 指示図の線は、まわりの塗られた部位へ(2px以内が1つの部位だけのとき)
  {
    const next = lab.slice();
    for (let i = 0; i < N; i++) {
      if (!gdark[i]) continue;
      const x = i % W, y = (i / W) | 0, seen = new Set(); let zero = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X; if (gdark[j] || !opaque(j)) continue;
        if (lab[j]) seen.add(lab[j]); else zero++;
      }
      next[i] = seen.size === 1 && !zero ? [...seen][0] : 0;
    }
    lab = next;
  }

  // ④ 部位の付け替え
  for (const mv of cfg.moves) {
    if (mv.when === 'notRed') {
      for (let i = 0; i < N; i++) if (lab[i] === mv.from) { const [h, s] = hsv(A[i * 4], A[i * 4 + 1], A[i * 4 + 2]); if (!((h < 25 || h >= 330) && s > 0.35)) lab[i] = mv.to; }
    } else if (mv.when === 'stripes') {
      const inPoly = (px, py, poly) => { let c = false; for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) { const [xa, ya] = poly[a], [xb, yb] = poly[b]; if ((ya > py) !== (yb > py) && px < (xb - xa) * (py - ya) / (yb - ya) + xa) c = !c; } return c; };
      for (let i = 0; i < N; i++) {
        // 指示図で線(黒)扱いだった白い線の画素も対象(染めない所の画素のうち、元の絵で色のはっきりしたもの)
        if (!(mv.to.includes(lab[i]) || lab[i] === 0) || A[i * 4 + 3] < 200) continue;
        const x = i % W, y = (i / W) | 0; if (!mv.polys.some(p => inPoly(x + 0.5, y + 0.5, p))) continue;
        const [h, s, v] = hsv(A[i * 4], A[i * 4 + 1], A[i * 4 + 2]);
        if (h >= 45 && h < 110 && s >= 0.45 && v > 0.35) lab[i] = mv.to[0];
        else if (s <= 0.15 && v > 0.85) lab[i] = mv.to[1];
      }
    } else if (mv.when === 'whip') {
      const [x0, y0, x1, y1] = mv.box, inEx = (x, y) => (mv.exclude || []).some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d);
      const cand = new Uint8Array(N);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * W + x; if (lab[i] !== mv.from || !opaque(i) || inEx(x, y)) continue;
        const [h, s, v] = hsv(A[i * 4], A[i * 4 + 1], A[i * 4 + 2]);
        // 白いホイップと、その影(うすいベージュ)。果物の色(彩度が高い)と葉の緑は入れない
        if (v > 0.5 && (s < 0.12 || (s < 0.3 && h >= 20 && h < 70))) cand[i] = 1;
      }
      const seen = new Uint8Array(N);
      for (let s0 = 0; s0 < N; s0++) {
        if (!cand[s0] || seen[s0]) continue;
        const comp = [s0]; seen[s0] = 1;
        for (let k = 0; k < comp.length; k++) for (const j of nb4(comp[k])) if (cand[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
        if (comp.length >= mv.minArea) for (const i of comp) lab[i] = mv.to;
      }
      // ホイップの輪郭線(灰〜茶の細い線)も、ホイップに囲まれていれば入れる
      for (let pass = 0; pass < 2; pass++) {
        const next = lab.slice();
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const i = y * W + x; if (lab[i] !== mv.from || !opaque(i) || inEx(x, y)) continue;
          const [, s] = hsv(A[i * 4], A[i * 4 + 1], A[i * 4 + 2]); if (s > 0.3) continue;
          let c = 0; for (const j of nb4(i)) if (lab[j] === mv.to) c++;
          if (c >= 2) next[i] = mv.to;
        }
        lab = next;
      }
    }
  }
  // ケーキの目と口(真っ暗な線とそのふちの暗い画素)は染めない。指示図では線のふちが④に塗られていて、
  // ケーキを染めると口の輪郭が色づいた。④の中の暗い画素から、暗めの画素だけを数歩たどって外す
  if (cfg.cakeFaceDark) {
    const { region, dark, edge, steps } = cfg.cakeFaceDark;
    const val = (i) => Math.max(A[i * 4], A[i * 4 + 1], A[i * 4 + 2]);
    let front = [];
    for (let i = 0; i < N; i++) if (lab[i] === region && val(i) < dark) { lab[i] = 0; front.push(i); }
    for (let k = 0; k < steps && front.length; k++) {
      const nx = [];
      for (const i of front) for (const j of nb4(i)) if (lab[j] === region && val(j) < edge) { lab[j] = 0; nx.push(j); }
      front = nx;
    }
  }
  console.log(`付け替え後  染めない/1/2/3/4/5 = ${count(lab)}`);
  // 確かめる用: 元の絵の大きさのままの塗り分けを書き出す(FULL_OUT=<パス>)
  if (process.env.FULL_OUT) {
    const fc = createCanvas(W, H), fx = fc.getContext('2d'), fd = fx.createImageData(W, H);
    const CC = { 1: [255, 0, 0], 2: [0, 255, 0], 3: [0, 0, 255], 4: [255, 255, 0], 5: [255, 0, 255] };
    for (let i = 0; i < N; i++) if (lab[i]) fd.data.set([...CC[lab[i]], 255], i * 4);
    fx.putImageData(fd, 0, 0); fs.writeFileSync(process.env.FULL_OUT, fc.toBuffer('image/png'));
  }

  // ⑤ 立ち絵の大きさへ(元の絵の crop を、立ち絵の画素ごとの多数決で縮める)
  const ship = await loadImage(path.join(ROOT, 'monster-hero/images/monsters', `${name}.png`));
  const w = ship.width, h = ship.height, n = w * h;
  const sc = createCanvas(w, h), sx = sc.getContext('2d'); sx.drawImage(ship, 0, 0); const S = sx.getImageData(0, 0, w, h).data;
  const [cx, cy, cw, ch] = cfg.crop;
  let out = new Int8Array(n);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * w + x; if (S[o * 4 + 3] < 20) continue;
    const X0 = cx + x * cw / w, X1 = cx + (x + 1) * cw / w, Y0 = cy + y * ch / h, Y1 = cy + (y + 1) * ch / h;
    const c = [0, 0, 0, 0, 0, 0];
    for (let Y = Math.floor(Y0); Y < Math.ceil(Y1); Y++) for (let X = Math.floor(X0); X < Math.ceil(X1); X++) { if (X < 0 || Y < 0 || X >= W || Y >= H) continue; c[lab[Y * W + X]]++; }
    let best = 0; for (let k = 1; k < 6; k++) if (c[k] > c[best]) best = k;
    out[o] = best;
  }

  // ⑥ 小さな切れ端(12画素未満)は、接しているいちばん多い部位へ
  {
    const seen = new Uint8Array(n);
    const nb = (i) => { const x = i % w, r = []; if (x > 0) r.push(i - 1); if (x < w - 1) r.push(i + 1); if (i >= w) r.push(i - w); if (i < n - w) r.push(i + w); return r; };
    for (let s0 = 0; s0 < n; s0++) {
      if (seen[s0] || !out[s0]) continue;
      const L = out[s0], comp = [s0]; seen[s0] = 1; const touch = [0, 0, 0, 0, 0, 0];
      for (let k = 0; k < comp.length; k++) for (const j of nb(comp[k])) { if (out[j] === L) { if (!seen[j]) { seen[j] = 1; comp.push(j); } } else if (S[j * 4 + 3] >= 20) touch[out[j]]++; }
      if (comp.length >= 12) continue;
      let best = 0; for (let k = 1; k < 6; k++) if (touch[k] > touch[best]) best = k;
      for (const i of comp) out[i] = touch[best] ? best : 0;
    }
  }

  const COLORS = { 1: [255, 0, 0, 255], 2: [0, 255, 0, 255], 3: [0, 0, 255, 255], 4: [255, 255, 0, 255], 5: [255, 0, 255, 255] };
  const oc = createCanvas(w, h), ox = oc.getContext('2d'), od = ox.createImageData(w, h);
  const cnt = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) { if (S[i * 4 + 3] < 20) continue; cnt[out[i]]++; if (out[i]) od.data.set(COLORS[out[i]], i * 4); }
  ox.putImageData(od, 0, 0);
  console.log(`しあがり    染めない/1/2/3/4/5 = ${cnt.join(' / ')}`);
  const dest = outArg || path.join(ROOT, 'monster-hero/images/monsters', `${name}-dye-mask.PNG`);
  fs.writeFileSync(dest, oc.toBuffer('image/png'));
  console.log(`書き出しました: ${path.relative(ROOT, dest)}`);
})().catch((e) => { console.error(e); process.exit(1); });
