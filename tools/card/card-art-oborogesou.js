// 提供済みの完成画像を既存の原本サイズへ変換する。描き直し・文字の変更・切り抜きはしない。
// node tools/card/card-art-oborogesou.js
// node tools/card/card-image-build.js --build --only=C208.jpg,C208S.jpg,C208V.jpg
const path = require('path');
const sharp = require('../node_modules/sharp');
const root = path.resolve(__dirname, '../..');
const src = path.join(root, 'tools/art-sources/card-battle');
(async () => {
  for (const [name, suffix] of [['normal', ''], ['holo', 'S'], ['rare_holo', 'V']]) {
    const input = path.join(src, 'oborogesou', `oborogesou_${name}.png`);
    // contain は元の縦横比を守る。端数の差は余白で吸収しカードの端を落とさない。
    await sharp(input).flatten({ background: '#ffffff' })
      .resize(742, 1038, { fit: 'contain', background: '#ffffff' })
      .jpeg({ quality: 95, mozjpeg: true }).toFile(path.join(src, 'hybrid', `C208${suffix}.jpg`));
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
