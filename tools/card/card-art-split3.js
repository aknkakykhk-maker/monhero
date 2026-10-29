// 社長から届いた原本(1枚の絵に、左から ふつう・キラ・別絵キラ の3枚が横に並んだもの)から、カードの元の絵を3枚切り出す(2026-10-29 カード部パックくん)。
//   オボロゲソウ(card-art-oborogesou.js・#4219)と同じやり方を、ほかのカードにも使えるようにしたもの。
//   3等分して切り出し、ほかのカードの元の絵と同じ 742×1038 にそろえる(縦横比の差は1%ほど)。字・絵は描き直さない。継ぎはぎもしない。
//   原本は main に入れない(社長の指示)。使うときに場所を渡す:
//     node tools/card/card-art-split3.js <原本のpng> <書き出すフォルダ> <番号>
//     例: node tools/card/card-art-split3.js pandora-original-3.png tools/art-sources/card-battle/hybrid C067
//         → C067.jpg(ふつう)・C067S.jpg(キラ)・C067V.jpg(別絵キラ)
//     そのあと node tools/card/card-image-build.js --build --only=C067.jpg,C067S.jpg,C067V.jpg
const path = require('path');
const sharp = require('../node_modules/sharp');

const root = path.resolve(__dirname, '../..');
const W = 742, H = 1038;

(async () => {
  const [input, outDir, no] = process.argv.slice(2);
  if (!input || !outDir || !no) throw new Error('使い方: node tools/card/card-art-split3.js <原本のpng> <書き出すフォルダ> <番号(例 C067)>');
  const meta = await sharp(input).metadata();
  const third = meta.width / 3;
  for (const [i, suffix] of [[0, ''], [1, 'S'], [2, 'V']]) {
    const left = Math.round(third * i);
    const width = Math.round(third * (i + 1)) - left;
    const out = path.resolve(root, outDir, `${no}${suffix}.jpg`);
    await sharp(input).extract({ left, top: 0, width, height: meta.height }).removeAlpha()
      .resize(W, H, { fit: 'fill' })
      .jpeg({ quality: 95, mozjpeg: true }).toFile(out);
    console.log(`書き出し: ${path.relative(root, out)}(原本の x=${left}〜${left + width - 1})`);
  }
})().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
