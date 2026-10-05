// いただいた染色の見本(手描き)を「どのかたまりがどの部位か」を決めるためだけに使い、
// 塗る範囲は立ち絵の色のかたまりで決めて、配信する染色マスクを作る(2026-10-05・ゴーストで作った)。
//
//   node image/finish-dye-mask-components.js ghost
//   node image/finish-dye-mask-components.js ghost --out /tmp/x.png   … 配信フォルダへ書かずに試す
//
// 入力  tools/art-sources/dye-masks/<名前>-dye-mask-aligned.png
//         いただいた見本を立ち絵の座標へ合わせ、色だけリポジトリの約束(赤=① / 緑=② / 青=③ / 透明=対象外)
//         へそろえたもの。形には手を入れていない
//       monster-hero/images/monsters/<名前>.png(配信中の立ち絵)
// 出力  monster-hero/images/monsters/<名前>-dye-mask.PNG
//
// 【なぜ finish-dye-mask.js と分けたか】
// ゴーストの見本は手描きで、帽子の形が立ち絵と少し違っていた(1つの倍率では重なりが0.90までしか上がらない)。
// 見本の形をそのまま使うと、帽子の右側とつばのふちが塗り残り、リボンがずれた。
// いっぽう絵は「紺の帽子・クリームの体・赤いリボン」と色がはっきり分かれているので、
// 色のかたまりごとに見本の多数決で部位を決めれば、見本のずれに関係なく輪郭どおりに塗れる。
//
// やること(順番どおり)
//   ① 立ち絵の画素を色で分ける(紺・クリーム・赤・白)
//   ② 同じ色でつながったかたまりごとに、見本の多数決で部位を決める(見本が黒=0なら染めない。目・口)
//   ③ 白いかたまりは、染めないかたまり(目)に接していれば染めない(白目)。ほかは接している部位へ
//   ④ 小さなかたまり・色の決まらない画素(輪郭線・ふちのにじみ)は、近くの部位から広げて埋める。
//      染めないかたまりからは広げないので、目の中のハイライトは染めないまま残る
//   ⑤ 染めない丸いかたまり(目)を外形で埋める(hullZero)。白目の下の影が体の色に近く、目のふちが欠けるため
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const ROOT = path.resolve(__dirname, '..', '..');
const CONFIGS = {
  ghost: {
    // 色の分け方。紺=帽子と瞳 / クリーム=体 / 赤=リボンと口 / 白=白目と帽子のつや
    classify: (h, s, v) => {
      if (s > 0.45 && (h < 25 || h >= 330) && v > 0.35) return 3;
      if (v > 0.7 && s < 0.2 && h >= 180 && h < 300) return 4;
      if (h >= 25 && h < 75 && v > 0.45) return 2;
      if ((h >= 180 && h < 330) || v < 0.3) return 1;
      return 0;
    },
    minComp: 150,
    // 白目の下の影はクリーム寄りの色で、体として塗られて目のふちがギザギザに欠けた。
    // 染めない丸いかたまり(目)を外形(凸包)で埋める。かたまりの面積が外形の minRatio 以上のものだけ
    // 口は横長の弓形なので対象外にする(maxWide = 幅÷高さの上限)。埋めると口の上の肌まで染めなくなる
    hullZero: { minRatio: 0.75, minSize: 500, maxWide: 1.5 },
  },
};

const args = process.argv.slice(2);
const name = args.find(a => !a.startsWith('--'));
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const cfg = CONFIGS[name];
if (!cfg) { console.log(`使い方: node image/finish-dye-mask-components.js <${Object.keys(CONFIGS).join('|')}> [--out <パス>]`); process.exit(1); }

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
  const guide = await loadImage(path.join(ROOT, 'tools/art-sources/dye-masks', `${name}-dye-mask-aligned.png`));
  const W = art.width, H = art.height, N = W * H;
  const pixels = (im) => { const c = createCanvas(W, H), x = c.getContext('2d'); x.drawImage(im, 0, 0, W, H); return x.getImageData(0, 0, W, H).data; };
  const A = pixels(art), G = pixels(guide);
  const opaque = (i) => A[i * 4 + 3] >= 20;
  const guideLabel = (i) => { const o = i * 4; if (G[o + 3] < 20) return 0; return G[o] > 200 ? 1 : G[o + 1] > 200 ? 2 : G[o + 2] > 200 ? 3 : 0; };
  const nb4 = (i) => { const x = i % W, out = []; if (x > 0) out.push(i - 1); if (x < W - 1) out.push(i + 1); if (i >= W) out.push(i - W); if (i < N - W) out.push(i + W); return out; };

  // ① 色で分ける
  const cls = new Int8Array(N);
  for (let i = 0; i < N; i++) {
    if (!opaque(i)) { cls[i] = -1; continue; }
    const [h, s, v] = hsv(A[i * 4], A[i * 4 + 1], A[i * 4 + 2]);
    cls[i] = cfg.classify(h, s, v);
  }
  // ② 同じ色でつながったかたまり
  const comp = new Int32Array(N).fill(-1);
  const comps = [];
  for (let i = 0; i < N; i++) {
    if (cls[i] <= 0 || comp[i] >= 0) continue;
    const id = comps.length, members = [i], votes = [0, 0, 0, 0];
    comp[i] = id;
    for (let k = 0; k < members.length; k++) {
      const j = members[k];
      votes[guideLabel(j)]++;
      for (const n of nb4(j)) if (comp[n] < 0 && cls[n] === cls[i]) { comp[n] = id; members.push(n); }
    }
    comps.push({ id, cls: cls[i], members, votes, label: -1 });
  }
  const big = comps.filter(c => c.members.length >= cfg.minComp);
  for (const c of big) {
    if (c.cls === 4) continue;
    let best = 0;
    for (let L = 1; L <= 3; L++) if (c.votes[L] > c.votes[best]) best = L;
    c.label = best;
  }
  // ③ 白いかたまり
  const touches = (c) => { const s = new Set(); for (const j of c.members) for (const n of nb4(j)) { const o = comp[n]; if (o >= 0 && o !== c.id) s.add(o); } return [...s].map(o => comps[o]); };
  for (const c of big.filter(c => c.cls === 4)) {
    const around = touches(c).filter(o => o.label >= 0);
    if (around.some(o => o.label === 0)) { c.label = 0; continue; }
    const cnt = [0, 0, 0, 0];
    for (const o of around) cnt[o.label] += o.members.length;
    c.label = cnt.indexOf(Math.max(...cnt));
  }
  const lab = new Int8Array(N).fill(-1);   // -1 = まだ決まっていない
  for (const c of big) for (const j of c.members) lab[j] = c.label;
  // ④ 残りを近くの部位から広げて埋める(染めない部位からは広げない)
  let front = [];
  for (let i = 0; i < N; i++) if (lab[i] > 0) front.push(i);
  while (front.length) {
    const next = [];
    for (const j of front) for (const n of nb4(j)) {
      if (lab[n] !== -1 || !opaque(n)) continue;
      lab[n] = lab[j]; next.push(n);
    }
    front = next;
  }

  // ⑤ 染めない丸いかたまりを外形(凸包)で埋める。透明に接するかたまり(絵の外周)は数えない
  if (cfg.hullZero) {
    const seen = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (seen[i] || !opaque(i) || lab[i] > 0) continue;
      const members = [i]; seen[i] = 1; let edge = false;
      for (let k = 0; k < members.length; k++) for (const n of nb4(members[k])) {
        if (!opaque(n)) { edge = true; continue; }
        if (!seen[n] && !(lab[n] > 0)) { seen[n] = 1; members.push(n); }
      }
      if (edge || members.length < cfg.hullZero.minSize) continue;
      // 凸包(単調連鎖法)
      const pts = members.map(m => [m % W, Math.floor(m / W)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const half = (list) => { const h = []; for (const p of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); } h.pop(); return h; };
      const hull = [...half(pts), ...half(pts.slice().reverse())];
      let area2 = 0; for (let k = 0; k < hull.length; k++) { const a = hull[k], b = hull[(k + 1) % hull.length]; area2 += a[0] * b[1] - b[0] * a[1]; }
      if (members.length / (Math.abs(area2) / 2 + 1) < cfg.hullZero.minRatio) continue;
      const xs = hull.map(p => p[0]), ys = hull.map(p => p[1]);
      if ((Math.max(...xs) - Math.min(...xs) + 1) / (Math.max(...ys) - Math.min(...ys) + 1) > cfg.hullZero.maxWide) continue;
      for (let y = Math.min(...ys); y <= Math.max(...ys); y++) for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
        let inside = true;
        for (let k = 0; k < hull.length && inside; k++) if (cross(hull[k], hull[(k + 1) % hull.length], [x, y]) < 0) inside = false;
        if (inside && opaque(y * W + x)) lab[y * W + x] = 0;
      }
    }
  }

  const count = [0, 0, 0, 0];
  const c = createCanvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H);
  const COL = [null, [255, 0, 0], [0, 255, 0], [0, 0, 255]];
  for (let i = 0; i < N; i++) {
    if (!opaque(i)) continue;
    const L = lab[i] > 0 ? lab[i] : 0;
    count[L]++;
    if (L) img.data.set([...COL[L], 255], i * 4);
  }
  x.putImageData(img, 0, 0);
  const out = outArg || path.join(ROOT, 'monster-hero/images/monsters', `${name}-dye-mask.PNG`);
  fs.writeFileSync(out, c.toBuffer('image/png'));
  console.log(`しあがり  対象外/①/②/③ = ${count.join(' / ')}`);
  console.log(`書き出しました: ${path.relative(process.cwd(), out)}`);
})();
