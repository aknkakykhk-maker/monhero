// いただいた染色の見本(手描き)を「どのかたまりがどの部位か」を決めるためだけに使い、
// 塗る範囲は立ち絵の色のかたまりで決めて、配信する染色マスクを作る(2026-10-05・ゴーストで作った)。
//
//   node image/finish-dye-mask-components.js ghost
//   node image/finish-dye-mask-components.js ghost --out /tmp/x.png   … 配信フォルダへ書かずに試す
//
// 入力  tools/art-sources/dye-masks/<名前>-dye-mask-aligned.png
//         いただいた見本を立ち絵の座標へ合わせ、色だけリポジトリの約束(赤=① / 緑=② / 青=③ / 黄=④ / 透明=対象外)
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
//   ②' 見本とのずれで取り違えるかたまりは、位置で決め直す(overrides。理由を1件ずつ書く)
//   ②'' 顔の中の淡い色のかたまり(zeroInside)は目か歯なので染めない
//   ③ 暗い線のかたまり(darkClass)は、目に接していれば染めない(瞳)、ほかは④で近くの部位から埋める
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
    // 白(4)のかたまりは見本の多数決ではなく、染めないかたまり(目)に接しているかで決める
    whiteClass: 4,
    // 白目の下の影はクリーム寄りの色で、体として塗られて目のふちがギザギザに欠けた。
    // 染めない丸いかたまり(目)を外形(凸包)で埋める。かたまりの面積が外形の minRatio 以上のものだけ
    // 口は横長の弓形なので対象外にする(maxWide = 幅÷高さの上限)。埋めると口の上の肌まで染めなくなる
    hullZero: { minRatio: 0.75, minSize: 500, maxWide: 1.5 },
  },
  spooky: {
    // 色の分け方。暗い線(5) / 青緑=帽子と服(1) / クリーム色=リボンと胸元の飾り(4) / 茶=かぼちゃの顔と枝(3) /
    // 淡い色=手・しっぽ・目・歯(2)。どのかたまりをどの部位にするかは見本の多数決で決まる
    classify: (h, s, v) => {
      if (v < 0.25) return 5;
      if (h >= 155 && h < 205 && s > 0.35) return 1;
      if (h >= 38 && h < 70 && s > 0.12 && s < 0.7 && v > 0.7) return 4;
      if ((h < 45 || h >= 345) && s > 0.35) return 3;
      if (s < 0.45 && v > 0.6) return 2;
      // 目の淡い緑は彩度が0.47〜0.48あり、上の条件から漏れて右目だけ顔として塗られた
      if (h >= 120 && h < 155 && s < 0.6 && v > 0.6) return 2;
      return 0;
    },
    minComp: 150,
    whiteClass: 0,
    // 暗い線(5)は見本の多数決にしない。目のかたまりに接していれば染めない(瞳)、ほかは近くの部位から埋める
    darkClass: 5,
    // 顔(③)の中にある淡い色のかたまりは、目か歯なので染めない(見本とのずれで一部が③に入るため)
    zeroInside: { cls: 2, within: 3 },
    // 目は丸いので外形で埋める(ゴーストと同じ)。口は横長なので外れる
    hullZero: { minRatio: 0.6, minSize: 500, maxWide: 1.5 },
    // 見本とのずれで取り違えるかたまりを、位置で決め直す(near はかたまりの中心。cls はそのかたまりの色)
    overrides: [
      { near: [351, 424], cls: 2, label: 0, why: '口の歯。見本では口は黒(染めない)だが、ずれて顔の範囲に入る' },
      { near: [351, 488], cls: 4, label: 4, why: '首元の結び目。見本では顔の範囲だが、色は服の黄色い飾りと同じ' },
      { near: [544, 663], cls: 4, label: 2, why: '右手のつや。見本の手の円の外へはみ出している(左手のつやは②になっている)' },
    ],
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
  const guideLabel = (i) => { const o = i * 4; if (G[o + 3] < 20) return 0; const r = G[o], g = G[o + 1], b = G[o + 2]; if (r > 200 && g > 200 && b < 100) return 4; return r > 200 ? 1 : g > 200 ? 2 : b > 200 ? 3 : 0; };
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
    const id = comps.length, members = [i], votes = [0, 0, 0, 0, 0];
    comp[i] = id;
    for (let k = 0; k < members.length; k++) {
      const j = members[k];
      votes[guideLabel(j)]++;
      for (const n of nb4(j)) if (comp[n] < 0 && cls[n] === cls[i]) { comp[n] = id; members.push(n); }
    }
    comps.push({ id, cls: cls[i], members, votes, label: -1 });
  }
  const big = comps.filter(c => c.members.length >= cfg.minComp);
  const report = args.includes('--report');
  for (const c of big) {
    if (c.cls === cfg.whiteClass) continue;
    let best = 0;
    for (let L = 1; L <= 4; L++) if (c.votes[L] > c.votes[best]) best = L;
    c.label = best;
  }
  const touches = (c) => { const s = new Set(); for (const j of c.members) for (const n of nb4(j)) { const o = comp[n]; if (o >= 0 && o !== c.id) s.add(o); } return [...s].map(o => comps[o]); };
  // ②' 位置で決め直す
  for (const o of cfg.overrides || []) {
    let hit = null, bestD = 8;
    for (const c of big) {
      if (c.cls !== o.cls) continue;
      const cx = c.members.reduce((t, j) => t + j % W, 0) / c.members.length;
      const cy = c.members.reduce((t, j) => t + Math.floor(j / W), 0) / c.members.length;
      const d = Math.hypot(cx - o.near[0], cy - o.near[1]);
      if (d < bestD) { bestD = d; hit = c; }
    }
    if (!hit) { console.log(`⚠ 決め直す相手が見つかりません: ${o.why}`); process.exitCode = 1; continue; }
    hit.label = o.label; hit.fixed = true;
  }
  // ③ 白いかたまり
  // 顔の中の淡い色のかたまり(目・歯)は染めない。透明に接するもの(絵の外周)は対象外
  if (cfg.zeroInside) for (const c of big.filter(c => c.cls === cfg.zeroInside.cls && !c.fixed)) {
    let edge = false;
    for (const j of c.members) { for (const n of nb4(j)) if (!opaque(n)) { edge = true; break; } if (edge) break; }
    if (edge) continue;
    const around = touches(c).filter(o => o.label > 0 && o.cls !== cfg.darkClass);
    if (around.length && around.every(o => o.label === cfg.zeroInside.within)) c.label = 0;
  }
  // 暗い線のかたまり: 目に接していれば染めない、ほかは決めずに④で埋める
  if (cfg.darkClass) for (const c of big.filter(c => c.cls === cfg.darkClass && !c.fixed)) {
    c.label = touches(c).some(o => o.label === 0 && o.cls !== cfg.darkClass) ? 0 : -1;
  }
  for (const c of big.filter(c => c.cls === cfg.whiteClass)) {
    const around = touches(c).filter(o => o.label >= 0);
    if (around.some(o => o.label === 0)) { c.label = 0; continue; }
    const cnt = [0, 0, 0, 0, 0];
    for (const o of around) cnt[o.label] += o.members.length;
    c.label = cnt.indexOf(Math.max(...cnt));
  }
  if (report) for (const c of big.slice().sort((a, b) => b.members.length - a.members.length)) {
    const cy = Math.round(c.members.reduce((t, j) => t + Math.floor(j / W), 0) / c.members.length);
    const cx = Math.round(c.members.reduce((t, j) => t + j % W, 0) / c.members.length);
    console.log(`  色${c.cls} 画素${c.members.length} 中心(${cx},${cy}) 見本 ${c.votes.join('/')} → 部位${c.label}`);
  }
  const lab = new Int8Array(N).fill(-1);   // -1 = まだ決まっていない
  for (const c of big) if (c.label >= 0) for (const j of c.members) lab[j] = c.label;
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

  const count = [0, 0, 0, 0, 0];
  const c = createCanvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H);
  const COL = [null, [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
  for (let i = 0; i < N; i++) {
    if (!opaque(i)) continue;
    const L = lab[i] > 0 ? lab[i] : 0;
    count[L]++;
    if (L) img.data.set([...COL[L], 255], i * 4);
  }
  x.putImageData(img, 0, 0);
  const out = outArg || path.join(ROOT, 'monster-hero/images/monsters', `${name}-dye-mask.PNG`);
  fs.writeFileSync(out, c.toBuffer('image/png'));
  console.log(`しあがり  対象外/①/②/③/④ = ${count.join(' / ')}`);
  console.log(`書き出しました: ${path.relative(process.cwd(), out)}`);
})();
