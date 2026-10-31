// MFバトルカードのパック(第1〜8弾)の絵を、社長から届いた絵(1024×1536 の PNG)から作る(2026-10-31 社長「バトルカードのパック作ったから差し替えて」。カード部パックくん)
//   届いた絵はそのまま入れない(CLAUDE.md ⑥-2)。2つの絵にして monster-hero/images/card-battle/packs/ に置く:
//     p1.webp … 袋の全体(512×835)。パックを開ける画面・見本の一覧など、大きく出す所。
//               社長「ふちぎりぎりにして、いらないとこは透過」: 袋のふちぎりぎりで切り出し(BAG)、それでも残る袋の外の黒(角など)は、
//               絵のふちから黒い点をたどって透けさせる(袋の中の黒は、ふちからつながっていないので残る)
//     p1-thumb.jpg … 袋の真ん中(モンスターと「第◯弾」の字の所)だけを、同じ縦横比(2:3)で切り出したもの(200×300)。
//                    マーケットの一覧のように幅60px ほどで出す所。全体を縮めると「第◯弾」の字が高さ6px ほどになって読めないため
//   絵の中の字(1パック8枚入り・300円・全◯種類 など)は社長の絵のまま。描き直さない
//
//   node tools/card/card-pack-art-build.js <届いた絵のフォルダ(pack-01.png 〜 pack-08.png)>
//   そのあと node tools/build.js(キャッシュキー)→ node tools/image-asset-check.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp'));
const OUT = path.join(ROOT, 'monster-hero', 'images', 'card-battle', 'packs');
// 一覧用に切り出す範囲(届いた絵 1024×1536 の上)。2:3 のまま、上のモンスターの顔から「MFバトルカード」の字までが入る
const THUMB = { left: 212, top: 420, width: 600, height: 900 };
// 袋のふちぎりぎりの範囲(第1〜8弾とも、黒でない点はこの中に収まる)。縦横比 1.631(ゲームの CardPackArt の高さもこれに合わせる)
const BAG = { left: 48, top: 11, width: 927, height: 1512 };
const FULL_W = 512, FULL_H = 835;

// 袋の外の黒を透けさせた RGBA を作る(ふちから、黒い点のつながりをたどる。袋に接する点は半分だけ透けさせて、ふちのギザギザを和らげる)
const cutOutside = async (file) => {
  const { data, info } = await sharp(file).removeAlpha().extract(BAG).resize(FULL_W, FULL_H).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const dark = (i) => data[i * ch] + data[i * ch + 1] + data[i * ch + 2] < 60;
  const out = new Uint8Array(W * H);
  const q = [];
  for (let x = 0; x < W; x++) q.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) q.push(y * W, y * W + W - 1);
  while (q.length) {
    const i = q.pop();
    if (out[i] || !dark(i)) continue;
    out[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) q.push(i - 1); if (x < W - 1) q.push(i + 1); if (y > 0) q.push(i - W); if (y < H - 1) q.push(i + W);
  }
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    for (let k = 0; k < 3; k++) rgba[i * 4 + k] = data[i * ch + k];
    let a = 255;
    if (out[i]) {
      const x = i % W, y = (i / W) | 0;
      const nearBag = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && !out[yy * W + xx]; });
      a = nearBag ? 110 : 0;
    }
    rgba[i * 4 + 3] = a;
  }
  return sharp(rgba, { raw: { width: W, height: H, channels: 4 } });
};

(async () => {
  const src = process.argv[2];
  if (!src) throw new Error('使い方: node tools/card/card-pack-art-build.js <届いた絵のフォルダ>');
  fs.mkdirSync(OUT, { recursive: true });
  for (let i = 1; i <= 8; i++) {
    const file = path.join(src, `pack-0${i}.png`);
    const meta = await sharp(file).metadata();
    if (meta.width !== 1024 || meta.height !== 1536) throw new Error(`${file}: 大きさが ${meta.width}×${meta.height}(1024×1536 のはず)`);
    await (await cutOutside(file)).webp({ quality: 80, alphaQuality: 90 }).toFile(path.join(OUT, `p${i}.webp`));
    await sharp(file).removeAlpha().extract(THUMB).resize(200, 300).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, `p${i}-thumb.jpg`));
    const a = fs.statSync(path.join(OUT, `p${i}.webp`)).size, b = fs.statSync(path.join(OUT, `p${i}-thumb.jpg`)).size;
    console.log(`書き出し: 第${i}弾 p${i}.webp ${Math.round(a / 1024)}KB / p${i}-thumb.jpg ${Math.round(b / 1024)}KB`);
  }
})().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
