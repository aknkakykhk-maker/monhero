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
