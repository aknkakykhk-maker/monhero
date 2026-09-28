// 近日公開予定の2体(ユグドラシル・メルホイップ)の染色マスクを見張る(2026-09-28)。
//
//   node image/upcoming-dye-mask-check.js
//
// 2026-09-28・ユーザー指示「染色はこのゲームの重要な部分だから本気で仕上げて」。
// 配信中の染色マスクは、いただいた3色マスク(立ち絵へ位置を合わせただけのもの)を
// tools/image/finish-dye-mask.js で仕上げたもの。ここでは次の3つを見る。
//   ① 出発点(tools/art-sources/dye-masks/<名前>-dye-mask-aligned.png)から仕上げ直すと、
//      配信中のマスクと1画素も違わない(手で直して、作り直せないマスクにしていない)
//   ② メルホイップ: ケーキの目と口の暗い線、ブルーベリーの紺は染めない
//   ③ 部位ごとの染め方(MASU_COLOR_REGION_DYE)が3部位ぶんある。白・クリーム(③)に gloss を
//      付けると色が乗らなくなるので、メルホイップの③には付けない
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
const regionOf = (d, o) => d[o + 3] < 20 ? 0 : d[o] > 200 ? 1 : d[o + 1] > 200 ? 2 : d[o + 2] > 200 ? 3 : 0;

(async () => {
  for (const name of ['yggdrasil', 'mel-whip']) {
    const tmp = path.join(os.tmpdir(), `finish-${name}-${process.pid}.png`);
    execFileSync('node', [path.join(__dirname, 'finish-dye-mask.js'), name, '--out', tmp], { stdio: 'ignore' });
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
    check('メルホイップ: ケーキの目と口の暗い線を染めない', darkDyed === 0, `${darkDyed}画素が染まる`);
    check('メルホイップ: ブルーベリーの紺を染めない', berries > 100 && berryDyed / berries < 0.02, `${berryDyed} / ${berries}画素`);

    // 4回目のマスク(2026-09-28)で決めたこと。立ち絵の幅・高さに対する割合の範囲で数える
    const hsv = (o) => { const r = art.d[o] / 255, g = art.d[o + 1] / 255, b = art.d[o + 2] / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); } if (h < 0) h += 360; return [h, mx ? d / mx : 0, mx]; };
    const scan = (x0, x1, y0, y1, pick) => {
      const c = [0, 0, 0, 0]; let n = 0;
      for (let y = Math.floor(y0 * H); y < y1 * H; y++) for (let x = Math.floor(x0 * W); x < x1 * W; x++) {
        const o = (y * W + x) * 4; if (art.d[o + 3] < 200 || !pick(hsv(o))) continue; n++; c[regionOf(mask.d, o)]++;
      }
      return { n, c };
    };
    const hoof = scan(0.4, 0.6, 0.64, 0.74, ([, , v]) => v < 0.27);
    check('メルホイップ: 黒い蹄を染めない', hoof.n > 100 && hoof.c[1] + hoof.c[2] + hoof.c[3] === 0, `${hoof.n - hoof.c[0]} / ${hoof.n}画素が染まる`);
    // 傘のストライプは細く、いただいたマスクでは黄緑の帯と白い線が入れ替わっていた
    const stripe = scan(0.2, 0.6, 0.06, 0.11, ([, s, v]) => s < 0.1 && v > 0.9);
    check('メルホイップ: 傘の白いストライプは③(白・クリーム)', stripe.n > 500 && stripe.c[3] / stripe.n > 0.95, `${stripe.c[3]} / ${stripe.n}画素`);
    const band = scan(0.2, 0.6, 0.06, 0.13, ([h, s]) => s > 0.55 && h >= 45 && h < 110);
    check('メルホイップ: 傘の帯の黄緑は①(緑系)', band.n > 5000 && band.c[1] / band.n > 0.85, `${band.c[1]} / ${band.n}画素`);
    // バラの芯(淡い緑)は、いただいたマスクで毎回②に塗られていた。色で①へ付け直さない
    const rose = scan(0.5, 0.56, 0.37, 0.41, () => true);
    check('メルホイップ: 胸のバラの芯は②(いただいたマスクのとおり)', rose.c[2] / rose.n > 0.5, `${rose.c[2]} / ${rose.n}画素`);
    // 顔(目と口のまわり)に髪の色の点を散らさない。境目の寄せ直しを、染めない所との境目にまで広げたときに起きた
    const face = scan(0.49, 0.57, 0.33, 0.36, ([h, s, v]) => (h < 40 || h >= 340) && s > 0.08 && v > 0.7);
    check('メルホイップ: 顔の肌を染めない', face.n > 200 && (face.n - face.c[0]) / face.n < 0.03, `${face.n - face.c[0]} / ${face.n}画素`);
  }

  // ③ 部位ごとの染め方
  const dye = loadDyeModule();
  const regionDye = dye.MASU_COLOR_REGION_DYE || {};
  for (const id of ['Yggdrasil', 'MelWhip']) {
    const v = regionDye[id];
    check(`${id}: 部位ごとの染め方が3部位ぶんある`, Array.isArray(v) && v.length === 3);
  }
  check('MelWhip: 白・クリーム(③)に gloss を付けていない', Array.isArray(regionDye.MelWhip) && !regionDye.MelWhip[2]?.gloss);

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
