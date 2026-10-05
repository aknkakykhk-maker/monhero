// 近日公開予定の2体(ユグドラシル・メルホイップ)の染色マスクを見張る(2026-09-28)。
//
//   node image/upcoming-dye-mask-check.js
//
// 2026-09-28・ユーザー指示「染色はこのゲームの重要な部分だから本気で仕上げて」。
// ユグドラシルの配信マスクは、いただいた3色マスク(立ち絵へ位置を合わせただけのもの)を
// tools/image/finish-dye-mask.js で仕上げたもの。メルホイップは、ユーザーが元の絵の上に部位ごとの色を
// 塗った指示図(5部位)を tools/image/finish-dye-mask-guide.js で仕上げたもの。ここでは次の3つを見る。
//   ① 出発点から仕上げ直すと、配信中のマスクと1画素も違わない(2026-10-05 からゴーストも)(手で直して、作り直せないマスクにしていない)
//   ② メルホイップ: ケーキの目と口の暗い線、ブルーベリーの紺、黒い蹄、顔の肌は染めない。
//      ユーザーが決めた部位の分け方(イチゴ=1 / 服と傘=2 / フリルと白い線=3 / ケーキとホイップ=4 / 髪と目=5)
//   ③ 部位ごとの染め方(MASU_COLOR_REGION_DYE)が部位の数だけある。白に近い部位に gloss を
//      付けると色が乗らなくなるので、メルホイップの③④には付けない
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { createCanvas, loadImage } = require('canvas');
const { loadDyeModule } = require('../harness');

const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const pixels = async (file, W, H) => { const im = await loadImage(file); const c = createCanvas(W || im.width, H || im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height); return { W: c.width, H: c.height, d: x.getImageData(0, 0, c.width, c.height).data }; };
// _exactDyeMaskRegion と同じ読み方(赤=1 緑=2 青=3 黄=4 マゼンタ=5)
const regionOf = (d, o) => {
  if (d[o + 3] < 20) return 0;
  const r = d[o], g = d[o + 1], b = d[o + 2];
  if (r > 200 && g < 80 && b < 80) return 1;
  if (g > 200 && r < 80 && b < 80) return 2;
  if (b > 200 && r < 80 && g < 80) return 3;
  if (r > 200 && g > 200 && b < 80) return 4;
  if (r > 200 && g < 80 && b > 200) return 5;
  return 0;
};

(async () => {
  // ゴースト・スプーキー(2026-10-05)は、見本で部位を決めて絵の色のかたまりで塗る finish-dye-mask-components.js で仕上げた
  const TOOLS = { yggdrasil: 'finish-dye-mask.js', 'mel-whip': 'finish-dye-mask-guide.js', ghost: 'finish-dye-mask-components.js', spooky: 'finish-dye-mask-components.js' };
  for (const name of Object.keys(TOOLS)) {
    const tmp = path.join(os.tmpdir(), `finish-${name}-${process.pid}.png`);
    const tool = TOOLS[name];
    execFileSync('node', [path.join(__dirname, tool), name, '--out', tmp], { stdio: 'ignore' });
    const shipped = await pixels(path.join(ROOT, 'monster-hero/images/monsters', `${name}-dye-mask.PNG`));
    const again = await pixels(tmp, shipped.W, shipped.H);
    fs.unlinkSync(tmp);
    let diff = 0;
    for (let o = 0; o < shipped.d.length; o += 4) if (regionOf(shipped.d, o) !== regionOf(again.d, o)) diff++;
    check(`${name}: 出発点から仕上げ直すと配信中のマスクと同じになる`, diff === 0, `${diff}画素ちがう`);
  }

  // ② メルホイップのケーキの顔とブルーベリー
  {
    const art = await pixels(path.join(ROOT, 'monster-hero/images/monsters/mel-whip.png'));
    const mask = await pixels(path.join(ROOT, 'monster-hero/images/monsters/mel-whip-dye-mask.PNG'), art.W, art.H);
    const { W, H } = art;
    let darkDyed = 0, berryDyed = 0, berries = 0;
    for (let y = Math.floor(H * 0.78); y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4; if (art.d[o + 3] < 200) continue;
      if (Math.max(art.d[o], art.d[o + 1], art.d[o + 2]) < 70 && regionOf(mask.d, o)) darkDyed++;
    }
    for (let o = 0; o < art.d.length; o += 4) {
      if (art.d[o + 3] < 200) continue;
      const r = art.d[o], g = art.d[o + 1], b = art.d[o + 2];
      // 紺色(青が強く、赤・緑が低い)
      if (b > 60 && b > r * 1.6 && b > g * 1.4 && Math.max(r, g) < 90) { berries++; if (regionOf(mask.d, o)) berryDyed++; }
    }
    check('メルホイップ: ケーキの目と口の暗い線を染めない(ふちの数画素まで)', darkDyed <= 10, `${darkDyed}画素が染まる`);
    check('メルホイップ: ブルーベリーの紺を染めない', berries > 100 && berryDyed / berries < 0.02, `${berryDyed} / ${berries}画素`);

    // 4回目のマスク(2026-09-28)で決めたこと。立ち絵の幅・高さに対する割合の範囲で数える
    const hsv = (o) => { const r = art.d[o] / 255, g = art.d[o + 1] / 255, b = art.d[o + 2] / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); } if (h < 0) h += 360; return [h, mx ? d / mx : 0, mx]; };
    const scan = (x0, x1, y0, y1, pick) => {
      const c = [0, 0, 0, 0, 0, 0]; let n = 0;
      for (let y = Math.floor(y0 * H); y < y1 * H; y++) for (let x = Math.floor(x0 * W); x < x1 * W; x++) {
        const o = (y * W + x) * 4; if (art.d[o + 3] < 200 || !pick(hsv(o))) continue; n++; c[regionOf(mask.d, o)]++;
      }
      return { n, c };
    };
    const hoof = scan(0.4, 0.6, 0.64, 0.74, ([, , v]) => v < 0.27);
    check('メルホイップ: 黒い蹄を染めない', hoof.n > 100 && hoof.c[1] + hoof.c[2] + hoof.c[3] + hoof.c[4] + hoof.c[5] === 0, `${hoof.n - hoof.c[0]} / ${hoof.n}画素が染まる`);
    const face = scan(0.49, 0.57, 0.33, 0.36, ([h, s, v]) => (h < 40 || h >= 340) && s > 0.08 && v > 0.7);
    check('メルホイップ: 顔の肌を染めない', face.n > 200 && (face.n - face.c[0]) / face.n < 0.03, `${face.n - face.c[0]} / ${face.n}画素`);
    // 部位の分け方(2026-09-28 ユーザーの指示図と、同日「傘はむしろ赤を緑マスクに変更」「ホイップはケーキの色がいい」
    // 「目は髪の毛と同じ色にして」)
    const share = (r, L) => r.c[L] / Math.max(1, r.n);
    const strawberry = scan(0.3, 0.8, 0.2, 0.3, ([h, s, v]) => (h < 12 || h >= 345) && s > 0.75 && v > 0.55);
    check('メルホイップ: 頭のイチゴは1', strawberry.n > 300 && share(strawberry, 1) > 0.85, `${strawberry.c[1]} / ${strawberry.n}画素`);
    const umbrella = scan(0.1, 0.8, 0.1, 0.28, ([h, s, v]) => h >= 55 && h < 100 && s > 0.6 && v > 0.4);
    check('メルホイップ: 傘の本体は2(服と同じ)', umbrella.n > 5000 && share(umbrella, 2) > 0.85, `${umbrella.c[2]} / ${umbrella.n}画素`);
    const stripe = scan(0.2, 0.6, 0.06, 0.11, ([, s, v]) => s < 0.1 && v > 0.9);
    check('メルホイップ: 傘の白い線は3', stripe.n > 300 && share(stripe, 3) > 0.85, `${stripe.c[3]} / ${stripe.n}画素`);
    const dress = scan(0.44, 0.58, 0.52, 0.57, ([, , v]) => v > 0.6);
    check('メルホイップ: 服(真ん中のスカート)は2', dress.n > 1000 && share(dress, 2) > 0.9, `${dress.c[2]} / ${dress.n}画素`);
    const cake = scan(0.1, 0.9, 0.75, 0.9, ([, s, v]) => s < 0.15 && v > 0.8);
    check('メルホイップ: ケーキのクリームは4', cake.n > 20000 && share(cake, 4) > 0.9, `${cake.c[4]} / ${cake.n}画素`);
    const whip = scan(0.02, 0.98, 0.66, 0.76, ([h, s, v]) => v > 0.8 && s < 0.1);
    check('メルホイップ: ケーキの上のホイップは4', whip.n > 1000 && share(whip, 4) > 0.75, `${whip.c[4]} / ${whip.n}画素`);
    const hair = scan(0.66, 0.76, 0.36, 0.48, ([h, s, v]) => h >= 55 && h < 90 && s > 0.3 && v > 0.8);
    check('メルホイップ: 髪は5', hair.n > 1000 && share(hair, 5) > 0.85, `${hair.c[5]} / ${hair.n}画素`);
    const eye = scan(0.45, 0.62, 0.3, 0.34, ([h, s, v]) => h >= 60 && h < 110 && s > 0.6 && v > 0.5);
    check('メルホイップ: 目は5(髪と同じ)', eye.n > 50 && share(eye, 5) > 0.75, `${eye.c[5]} / ${eye.n}画素`);
    const fruit = scan(0.02, 0.98, 0.64, 0.78, ([h, s, v]) => h >= 60 && h < 90 && s > 0.7 && v > 0.6);
    check('メルホイップ: ケーキの上の緑の実は染めない', fruit.n > 1000 && share(fruit, 0) > 0.9, `${fruit.c[0]} / ${fruit.n}画素`);
  }

  // ③ 部位ごとの染め方
  const dye = loadDyeModule();
  const regionDye = dye.MASU_COLOR_REGION_DYE || {};
  for (const [id, n] of [['Yggdrasil', 3], ['MelWhip', 5]]) {
    const v = regionDye[id];
    check(`${id}: 部位ごとの染め方が${n}部位ぶんある`, Array.isArray(v) && v.length === n);
  }
  check('MelWhip: 白に近い部位(③フリル・④ケーキ)に gloss を付けていない', Array.isArray(regionDye.MelWhip) && !regionDye.MelWhip[2]?.gloss && !regionDye.MelWhip[3]?.gloss);

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
