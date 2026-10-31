// MFバトルカードのパック(第1〜8弾)の絵を、社長から届いた絵(1024×1536 の PNG)から作る(2026-10-31 社長「バトルカードのパック作ったから差し替えて」。カード部パックくん)
//   届いた絵はそのまま入れない(CLAUDE.md ⑥-2)。2つの大きさの JPEG にして monster-hero/images/card-battle/packs/ に置く:
//     p1.jpg … 袋の全体(512×768)。パックを開ける画面・見本の一覧など、大きく出す所
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

(async () => {
  const src = process.argv[2];
  if (!src) throw new Error('使い方: node tools/card/card-pack-art-build.js <届いた絵のフォルダ>');
  fs.mkdirSync(OUT, { recursive: true });
  for (let i = 1; i <= 8; i++) {
    const file = path.join(src, `pack-0${i}.png`);
    const meta = await sharp(file).metadata();
    if (meta.width !== 1024 || meta.height !== 1536) throw new Error(`${file}: 大きさが ${meta.width}×${meta.height}(1024×1536 のはず)`);
    await sharp(file).removeAlpha().resize(512, 768).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(OUT, `p${i}.jpg`));
    await sharp(file).removeAlpha().extract(THUMB).resize(200, 300).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(OUT, `p${i}-thumb.jpg`));
    const a = fs.statSync(path.join(OUT, `p${i}.jpg`)).size, b = fs.statSync(path.join(OUT, `p${i}-thumb.jpg`)).size;
    console.log(`書き出し: 第${i}弾 p${i}.jpg ${Math.round(a / 1024)}KB / p${i}-thumb.jpg ${Math.round(b / 1024)}KB`);
  }
})().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
