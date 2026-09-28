// いただいた染色マスク(立ち絵に位置を合わせただけのもの)を、配信する染色マスクへ仕上げる(2026-09-28)。
//
//   node image/finish-dye-mask.js yggdrasil
//   node image/finish-dye-mask.js mel-whip
//   node image/finish-dye-mask.js mel-whip --out /tmp/x.png   … 配信フォルダへ書かずに試す
//
// 入力  tools/art-sources/dye-masks/<名前>-dye-mask-aligned.png
//         いただいた3色マスクを立ち絵と同じ座標・同じ大きさへ合わせ、色だけリポジトリの約束
//         (赤=① / 緑=② / 青=③ / 透明=対象外)へそろえたもの。形には手を入れていない。
//       monster-hero/images/monsters/<名前>.png(配信中の立ち絵)
// 出力  monster-hero/images/monsters/<名前>-dye-mask.PNG
//
// 2026-09-28・ユーザー指示「染色はこのゲームの重要な部分だから本気で仕上げて」。
// 手で塗ったマスクは、どうしても輪郭線の手前で止まったり、境目が数pxずれたりする。
// そのまま使うと「白や黒に染めたとき、髪のふちや葉の輪郭に元の色が細く残る」「胸元の飾りが
// 別の部位で染まる」といった崩れが出た。ここで機械的に直す。**マスクの塗り分けの意図は変えない**。
//
// やること(順番どおり)
//   ① 位置合わせの誤差ぶんだけ埋める(slack)。塗り残しのうち、隣の部位と色がほぼ同じ画素だけ。
//      広げすぎると、耳の中のように「わざと塗っていない場所」まで染まる(1回目にやってしまった)
//   ② 部位の境目のそばだけ、近くの「確実にその部位の画素」の平均色にいちばん近い部位へ寄せる(refine)。
//      色を決め打ちすると髪の白いハイライトと白い布を取り違えるので、その場所の色どうしで比べる
//   ③ 決め直す範囲(boxes)。マスクの塗り分けが絵と合っていない所だけ、元の絵の色で部位を決める
//     (growCream … ケーキの下のクリームの塗り残しを、クリーム色が続くかぎり③へ広げる)
//   ④ 赤系(②)なのに赤くない画素(白いバラなど)は、近くのほかの部位へ付け直す
//   ⑤ ブルーベリー(berries)は対象外にする。紺色は どの部位の色でもない
//   ⑥ 暗い線(目・口・蹄・輪郭線)は、1つの部位の中にある線だけその部位へ入れ、ほかは染めない
//   ⑦ 絵の外周の輪郭線は、となりの部位へ入れる(白や黒に染めたとき、ふちに元の色が残らないように)
//   ⑧ 小さな点をならす
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIGS = {
  yggdrasil: {
    slack: 2,
    refine: null,
    boxes: [],
    fixNonRed: false,
    berries: false,
  },
  'mel-whip': {
    slack: 2,
    refine: { band: 4, radius: 10 },
    // 胸元(白いバラ・襟の葉・胸当て)と左右の腕。立ち絵(634x916)の座標
    boxes: [[288, 337, 384, 440], [252, 362, 292, 425], [378, 362, 418, 425]],
    fixNonRed: true,
    berries: true,
    // ケーキの下のほう(立ち絵の高さの80%より下)で、ケーキ(③)に隣り合うクリーム色は③へ広げる。
    // いただいたマスクでは、たれの下側の明るい帯が塗られておらず、濃い色に染めるとクリームのかけらが残った。
    // スポンジは彩度が高い(0.3以上)ので取り違えない。脚(白いタイツ)は高さで外す
    growCream: { yFrom: 0.8, region: 3 },
    // ケーキの上の果物(立ち絵の高さの55%より下)で、塗り残しの鮮やかな画素を、色がつながる隣の部位へ広げる。
    // 左の黄緑の実の上半分が塗られていなかった。目(緑)に広がらないよう高さで区切る
    growVivid: { yFrom: 0.55 },
    darkNotIn: [3],
  },
};

const args = process.argv.slice(2);
const name = args.find(a => !a.startsWith('--'));
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const cfg = CONFIGS[name];
if (!cfg) { console.log(`使い方: node image/finish-dye-mask.js <${Object.keys(CONFIGS).join('|')}> [--out <パス>]`); process.exit(1); }

const hsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
  let h = 0;
  if (dl) { if (mx === r) h = 60 * (((g - b) / dl) % 6); else if (mx === g) h = 60 * ((b - r) / dl + 2); else h = 60 * ((r - g) / dl + 4); }
  if (h < 0) h += 360;
  return [h, mx ? dl / mx : 0, mx];
};

(async () => {
  const art = await loadImage(path.join(ROOT, 'monster-hero/images/monsters', `${name}.png`));
  const aligned = await loadImage(path.join(ROOT, 'tools/art-sources/dye-masks', `${name}-dye-mask-aligned.png`));
  const W = art.width, H = art.height, N = W * H;
  const pixels = (im) => { const c = createCanvas(W, H), x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; };
  const A = pixels(art), M = pixels(aligned);
  const opaque = (i) => A[i * 4 + 3] >= 20;
  const maxc = (i) => Math.max(A[i * 4], A[i * 4 + 1], A[i * 4 + 2]);
  const hsvAt = (i) => hsv(A[i * 4], A[i * 4 + 1], A[i * 4 + 2]);
  const diff = (i, j) => Math.abs(A[i * 4] - A[j * 4]) + Math.abs(A[i * 4 + 1] - A[j * 4 + 1]) + Math.abs(A[i * 4 + 2] - A[j * 4 + 2]);
  const nb4 = (i) => { const x = i % W, out = []; if (x > 0) out.push(i - 1); if (x < W - 1) out.push(i + 1); if (i >= W) out.push(i - W); if (i < N - W) out.push(i + W); return out; };
  const count = (lab) => { const c = [0, 0, 0, 0]; for (let i = 0; i < N; i++) if (opaque(i)) c[lab[i]]++; return c.join(' / '); };

  let lab = new Int8Array(N);
  for (let i = 0; i < N; i++) {
    if (!opaque(i) || M[i * 4 + 3] < 20) continue;
    lab[i] = M[i * 4] > 200 ? 1 : M[i * 4 + 1] > 200 ? 2 : M[i * 4 + 2] > 200 ? 3 : 0;
  }
  console.log(`はじめ    対象外/①/②/③ = ${count(lab)}`);
  // いただいたマスクそのままの塗り分け。⑥で「わざと塗っていない場所の線」を見分けるのに使う
  const raw = lab.slice();

  // ① 位置合わせの誤差ぶんだけ埋める
  for (let step = 0; step < cfg.slack; step++) {
    const next = lab.slice();
    for (let i = 0; i < N; i++) {
      if (lab[i] || !opaque(i) || maxc(i) < 70) continue;
      for (const j of nb4(i)) if (lab[j] && diff(i, j) < 40) { next[i] = lab[j]; break; }
    }
    lab = next;
  }

  // ② 境目のそばだけ、近くの確実な画素の平均色で寄せる / ④ 赤くない赤系を付け直す
  if (cfg.refine || cfg.fixNonRed) {
    const B = cfg.refine ? cfg.refine.band : 0, R = cfg.refine ? cfg.refine.radius : 10;
    const redo = new Uint8Array(N);
    if (cfg.fixNonRed) for (let i = 0; i < N; i++) {
      if (lab[i] !== 2) continue;
      const [h, s, v] = hsvAt(i);
      if (!((h < 25 || h >= 320) && s > 0.3 && v > 0.25)) redo[i] = 1;
    }
    const dist = new Uint8Array(N).fill(255);
    let front = [];
    for (let i = 0; i < N; i++) {
      if (!opaque(i)) continue;
      if (nb4(i).some(j => opaque(j) && lab[j] !== lab[i])) { dist[i] = 0; front.push(i); }
    }
    for (let d = 1; d <= B; d++) {
      const next = [];
      for (const i of front) for (const j of nb4(i)) if (opaque(j) && dist[j] === 255) { dist[j] = d; next.push(j); }
      front = next;
    }
    const sure = (j) => opaque(j) && dist[j] > B && !redo[j];
    const mean = (cx, cy, L, rad) => {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = Math.max(0, cy - rad); y <= Math.min(H - 1, cy + rad); y++) for (let x = Math.max(0, cx - rad); x <= Math.min(W - 1, cx + rad); x++) {
        const j = y * W + x; if (!sure(j) || lab[j] !== L) continue;
        r += A[j * 4]; g += A[j * 4 + 1]; b += A[j * 4 + 2]; n++;
      }
      return n >= 6 ? [r / n, g / n, b / n] : null;
    };
    const next = lab.slice();
    for (let i = 0; i < N; i++) {
      if (!opaque(i)) continue;
      const near = cfg.refine && dist[i] <= B;
      if (!near && !redo[i]) continue;
      const x = i % W, y = (i / W) | 0, rad = redo[i] ? R * 2 : R;
      const cands = new Set();
      for (let yy = Math.max(0, y - rad); yy <= Math.min(H - 1, y + rad); yy += 2) for (let xx = Math.max(0, x - rad); xx <= Math.min(W - 1, x + rad); xx += 2) { const j = yy * W + xx; if (sure(j)) cands.add(lab[j]); }
      if (redo[i]) cands.delete(2);
      let best = null, bd = Infinity;
      for (const L of cands) {
        const m = mean(x, y, L, rad); if (!m) continue;
        const d = (A[i * 4] - m[0]) ** 2 + (A[i * 4 + 1] - m[1]) ** 2 + (A[i * 4 + 2] - m[2]) ** 2;
        if (d < bd) { bd = d; best = L; }
      }
      if (best !== null) next[i] = best;
    }
    lab = next;
  }

  // ③ 決め直す範囲
  for (const [x0, y0, x1, y1] of cfg.boxes) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x; if (!opaque(i)) continue;
    const [h, s, v] = hsvAt(i);
    if (maxc(i) < 70) lab[i] = 0;
    else if ((h < 20 || h >= 330) && s > 0.45 && v > 0.3) lab[i] = 2;
    else if (h >= 50 && h < 170 && s >= 0.14) lab[i] = 1;
    else if (h < 30 && s > 0.12 && v > 0.55) lab[i] = 0;
    else if (s < 0.17 && v > 0.55 && (h >= 30 || s < 0.08)) lab[i] = 3;
  }

  // ③-2 ケーキの下のクリームの塗り残しを③へ広げる
  if (cfg.growCream) {
    const y0 = Math.floor(H * cfg.growCream.yFrom), L = cfg.growCream.region;
    for (let step = 0; step < 40; step++) {
      let changed = 0; const next = lab.slice();
      for (let i = y0 * W; i < N; i++) {
        if (lab[i] || !opaque(i) || maxc(i) < 70) continue;
        const [h, s, v] = hsvAt(i);
        if (!(s < 0.24 && v > 0.78 && (h >= 25 && h < 70 || s < 0.06))) continue;
        if (nb4(i).some(j => lab[j] === L)) { next[i] = L; changed++; }
      }
      lab = next; if (!changed) break;
    }
  }

  // ③-3 果物の塗り残し(鮮やかな色)を、色がつながる隣の部位へ広げる
  if (cfg.growVivid) {
    const y0 = Math.floor(H * cfg.growVivid.yFrom);
    for (let step = 0; step < 30; step++) {
      let changed = 0; const next = lab.slice();
      for (let i = y0 * W; i < N; i++) {
        if (lab[i] || !opaque(i) || maxc(i) < 70) continue;
        const [h, s] = hsvAt(i);
        // 果物の色(黄緑・緑は①、赤は②)だけ。スポンジの橙やクリームを伝ってケーキへ広がらないよう、
        // 橙〜黄土(色相20〜50)と淡い色は広げず、広げる先も①②に限る(③へ広げたらスポンジまで染まった)
        const green = h >= 50 && h < 170, red = h < 20 || h >= 330;
        if (s < 0.35 || !(green || red)) continue;
        const want = green ? 1 : 2;
        for (const j of nb4(i)) if (lab[j] === want && diff(i, j) < 70) { next[i] = want; changed++; break; }
      }
      lab = next; if (!changed) break;
    }
  }

  // ⑤ ブルーベリー(紺色の粒とそのツヤ)
  if (cfg.berries) {
    const seed = new Uint8Array(N);
    for (let i = 0; i < N; i++) { if (!opaque(i)) continue; const [h, s, v] = hsvAt(i); if (h >= 200 && h < 275 && s > 0.2 && v < 0.8) seed[i] = 1; }
    let grow = seed;
    for (let k = 0; k < 3; k++) { const next = grow.slice(); for (let i = 0; i < N; i++) if (!grow[i] && opaque(i)) { const [h, s] = hsvAt(i); if ((h >= 180 && h < 290) || s < 0.12) if (nb4(i).some(j => grow[j])) next[i] = 1; } grow = next; }
    for (let i = 0; i < N; i++) if (grow[i]) lab[i] = 0;
  }

  // ⑥ 暗い線。1つの部位だけに囲まれた線はその部位へ、ほかは染めない。
  //   ただし、いただいたマスクで線のすぐそば(1px)まで塗っていなかった線は、わざと外した線
  //   (ケーキの口・目など)なので必ず染めない。①で抜きが埋まっても、ここで元へ戻る
  {
    const next = lab.slice();
    for (let i = 0; i < N; i++) {
      if (!opaque(i) || maxc(i) >= 70) continue;
      const x = i % W, y = (i / W) | 0, seen = new Set();
      let blocked = false;
      for (let dy = -3; dy <= 3 && !blocked; dy++) for (let dx = -3; dx <= 3; dx++) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const j = Y * W + X; if (!opaque(j) || maxc(j) < 70) continue;
        // いただいたマスクで塗っていなかった画素(目のまわりの抜きなど)が近くにあれば、わざと外した線とみなす。
        // 今の塗り分け(lab)ではなく raw で見る。①で抜きが埋まったあとでも、目のふちを染めないように
        if (lab[j] === 0 || raw[j] === 0) { blocked = true; break; }
        seen.add(lab[j]);
      }
      let painted = false;
      for (let dy = -1; dy <= 1 && !painted; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H && raw[Y * W + X]) { painted = true; break; } }
      // darkNotIn の部位の中の真っ暗な線は染めない。メルホイップの③(白・クリーム)の中の真っ暗な線は
      // ケーキの目と口だけ(ドレスやクリームの輪郭線は灰色〜茶色で、ここまで暗くない)。
      // ユグドラシルの③は角・マント・蹄の茶色で、暗い蹄も③なので指定しない
      const only = seen.size === 1 ? [...seen][0] : 0;
      next[i] = (painted && !blocked && only && !(cfg.darkNotIn || []).includes(only)) ? only : 0;
    }
    lab = next;
  }

  // ⑦ 外周の輪郭線(透明のすぐ内側)は、となりの部位へ
  for (let step = 0; step < 3; step++) {
    const next = lab.slice();
    for (let i = 0; i < N; i++) {
      if (lab[i] || !opaque(i)) continue;
      const x = i % W, y = (i / W) | 0;
      let edge = false;
      for (let dy = -2; dy <= 2 && !edge; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H || !opaque(Y * W + X)) { edge = true; break; } }
      if (!edge) continue;
      const c = [0, 0, 0, 0];
      for (const j of nb4(i)) c[lab[j]]++;
      let best = 0; for (let k = 1; k < 4; k++) if (c[k] > c[best] || (best === 0 && c[k] > 0)) best = k;
      if (best) next[i] = best;
    }
    lab = next;
  }

  // ⑧ 小さな点をならす(8近傍の多数決。染める画素どうしだけ)
  for (let pass = 0; pass < 2; pass++) {
    const next = lab.slice();
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x; if (!lab[i]) continue;
      const c = [0, 0, 0, 0];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) c[lab[i + dy * W + dx]]++;
      let best = lab[i]; for (let k = 1; k < 4; k++) if (c[k] > c[best]) best = k;
      if (c[best] >= 6 && best !== lab[i]) next[i] = best;
    }
    lab = next;
  }
  console.log(`しあがり  対象外/①/②/③ = ${count(lab)}`);

  const out = createCanvas(W, H), ox = out.getContext('2d'), od = ox.createImageData(W, H);
  const COLORS = { 1: [255, 0, 0, 255], 2: [0, 255, 0, 255], 3: [0, 0, 255, 255] };
  for (let i = 0; i < N; i++) if (lab[i]) od.data.set(COLORS[lab[i]], i * 4);
  ox.putImageData(od, 0, 0);
  const dest = outArg || path.join(ROOT, 'monster-hero/images/monsters', `${name}-dye-mask.PNG`);
  fs.writeFileSync(dest, out.toBuffer('image/png'));
  console.log(`書き出しました: ${path.relative(ROOT, dest)}`);
})().catch((e) => { console.error(e); process.exit(1); });
