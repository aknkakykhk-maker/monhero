// 顔のまんなか(ART_ANCHORS)を書き出す道具(2026-10-26 社長「顔アイコンと全身絵のずれが出ない仕組みをちゃんと作って」)。
//
//   node tools/image/art-anchors.js                 … いまの顔アイコンから求めた基準を表示するだけ
//   node tools/image/art-anchors.js --write         … data/images/images-ally.js の ART_ANCHORS を書き直す(書いてある子はそのまま残す)
//   node tools/image/art-anchors.js --write ARK     … 指定した子だけ書き直す
//
// 【基準の意味】
// ART_ANCHORS[名前].face = [x, y] … 全身絵(<名前>_IMG)の中で「顔アイコンの丸のまんなかに来る点」(0〜1)。
// 顔(目のあいだ・鼻)のまんなかを書く。make-face-icons.js は、この点を丸のまんなかに置いて顔アイコンを作る。
//
// 【はじめの値の取り方】
// 2026-10-26 時点の顔アイコンは、全部を丸に入れて十字を引いて目で確かめ、顔がまんなかに来ていた(アークは直した)。
// そこで「いまの顔アイコンの丸のまんなかに来ている点」を、そのまま基準として書き出した。
// これから足す子は、全身絵で顔のまんなかを測って手で書く(monster-add スキル)。
const fs = require('fs');
const path = require('path');
const { loadEmbeddedImages, loadDyeModule } = require('../harness');
const face = require('./make-face-icons');

const write = process.argv.includes('--write');
const only = new Set(process.argv.slice(2).filter((a) => !a.startsWith('--')).map((a) => a.toUpperCase()));
const ALLY = path.resolve(__dirname, '..', '..', 'monster-hero', 'data', 'images', 'images-ally.js');

const r3 = (v) => Math.round(v * 1000) / 1000;

// いまの置き方(基準なし)で、丸のまんなかに来ている点を求める
async function currentCenter(name, images, dye) {
  const box = face.FACE_BOXES[name];
  const layout = await face.faceIconLayout(images[`${name}_IMG`], box, name, dye, null, true);
  const cx = (face.SIZE / 2 - layout.dx) / layout.scale, cy = (face.SIZE / 2 - layout.dy) / layout.scale;
  return [r3(cx / layout.img.width), r3(cy / layout.img.height)];
}

// 書き出す表の文字。名前の並びは FACE_BOXES と同じ
const renderTable = (table) => {
  const rows = Object.keys(face.FACE_BOXES).filter((n) => table[n]).map((n) => `  ${n}: Object.freeze({ face: Object.freeze([${table[n].face.join(', ')}]) }),`);
  return `const ART_ANCHORS = Object.freeze({\n${rows.join('\n')}\n});`;
};

(async () => {
  const images = loadEmbeddedImages();
  const dye = loadDyeModule();
  const current = face.loadArtAnchors();
  const table = { ...current };
  let n = 0;
  for (const name of Object.keys(face.FACE_BOXES)) {
    if (only.size && !only.has(name)) continue;
    if (!images[`${name}_IMG`]) continue;
    // 顔アイコンが全身絵そのもの(作っていない)子は、基準の対象にしない
    if (images[`${name}_FACE_ICON`] === images[`${name}_IMG`]) continue;
    if (!only.size && current[name]) continue; // 書いてある子は残す
    table[name] = { face: await currentCenter(name, images, dye) };
    console.log(`${name.padEnd(18)} face: [${table[name].face.join(', ')}]`);
    n++;
  }
  if (!write) { console.log(`\n${n}件(--write で images-ally.js へ書く)`); return; }
  const src = fs.readFileSync(ALLY, 'utf8');
  const head = '// 顔のまんなか(2026-10-26 社長「顔アイコンと全身絵のずれが出ない仕組み」)。全身絵(◯◯_IMG)の中で、顔アイコンの丸のまんなかに来る点(0〜1)。\n'
    + '// 顔(目のあいだ・鼻)のまんなかを書く。顔アイコンは tools/image/make-face-icons.js がこの点を丸のまんなかに置いて作る。\n'
    + '// 新しい子を足したら、ここにも書く(tools/image/art-anchor-check.js が、書いていない子を止める)。書き出しは tools/image/art-anchors.js\n';
  const re = /\n(?:\/\/[^\n]*\n)*const ART_ANCHORS = Object\.freeze\([\s\S]*?\n\}\);\n/;
  const block = `\n${head}${renderTable(table)}\n`;
  const next = re.test(src) ? src.replace(re, block) : `${src.replace(/\n*$/, '\n')}${block}`;
  fs.writeFileSync(ALLY, next);
  console.log(`\n${n}件を書きました(${path.relative(process.cwd(), ALLY)})`);
})().catch((e) => { console.error(e); process.exit(1); });
