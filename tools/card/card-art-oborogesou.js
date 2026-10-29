// オボロゲソウ(C-208・C-208S・C-208V)の元の絵を、社長から届いた原本から切り出して作る(2026-10-29 カード部パックくん)。
//   原本は1枚の絵に、左から ふつう・キラ・別絵キラ の3枚が、すき間なく並んでいる(1846×852。境目は数ピクセルの黒い線)。
//   前の作り方(届いた3枚の完成画像を縦横比のまま入れて、ふちと丸を写して継ぎはぎ #4201)はやめ、原本を3等分して切り出す。
//   1枚は約615×852で、ほかのカードの元の絵(742×1038)と縦横比の差は1%ほど。そのまま 742×1038 に合わせる(字・絵は描き直さない)。
//   原本は main に入れない(社長の指示)。使うときに場所を渡す:
//     node tools/card/card-art-oborogesou.js <原本のpng>
//     node tools/card/card-image-build.js --build --only=C208.jpg,C208S.jpg,C208V.jpg
const path = require('path');
const sharp = require('../node_modules/sharp');

const root = path.resolve(__dirname, '../..');
const out = path.join(root, 'tools/art-sources/card-battle/hybrid');
const W = 742, H = 1038;

(async () => {
  const input = process.argv[2];
  if (!input) throw new Error('原本の png を渡してください(node tools/card/card-art-oborogesou.js <原本のpng>)');
  const meta = await sharp(input).metadata();
  const third = meta.width / 3;
  for (const [i, suffix] of [[0, ''], [1, 'S'], [2, 'V']]) {
    const left = Math.round(third * i);
    const width = Math.round(third * (i + 1)) - left;
    await sharp(input).extract({ left, top: 0, width, height: meta.height }).removeAlpha()
      .resize(W, H, { fit: 'fill' })
      .jpeg({ quality: 95, mozjpeg: true }).toFile(path.join(out, `C208${suffix}.jpg`));
    console.log(`書き出し: tools/art-sources/card-battle/hybrid/C208${suffix}.jpg(原本の x=${left}〜${left + width - 1})`);
  }
})().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
