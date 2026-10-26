// 立ち絵(モンスター・助手)の「中身の範囲」(透けていない所を囲む四角)を測って、一覧を書く(2026-10-27 カード部パックくん)。
//
//   node tools/image/make-art-content-boxes.js          … 測って、data/images/images-ally.js の <art-content-boxes> の間に書く
//   node tools/image/make-art-content-boxes.js --check  … 書かずに、一覧が今の絵と合っているかだけ見る
//
// 【なぜ要るか】
// 絵の画像は、子によって余白の取り方と縦横の比がまちまち(みゅあ・ききは 1536×1024 の横長で人物は真ん中の一部、
// ももすけ・きゅうこは上半身のアップで枠いっぱい)。同じ枠に object-contain で入れると、中身の見た目の大きさが
// 2倍ほど違って写った(MFバトルカードの対戦開始(VS)の画面。開発部ピンセットくんの見回り #3886)。
// 中身の範囲が分かれば、画面の側で「中身が枠に収まる」ように拡大でき、1体ずつ手で寄せる数字(台帳 #202 で禁止)が要らない。
//
// 【決めごと】
// ・対象は images/monsters/*.png(立ち絵・混血の全身絵)と images/assistant/ の下の *.PNG(顔アイコンの face/ は除く)
// ・中身は「不透明度が CUT を超える画素」。透けていない絵(四角い絵)は全体が中身になる
// ・値は [左, 上, 右, 下, 横÷縦] で、左〜下は画像の幅・高さに対する割合(小数3桁)。
//   キーは images/ の下の道(「images/」は付けない。付けると tools/stamp-version.js が ?v= を打って、引けなくなる)
// ・元の絵は変えない
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..');
const GAME = path.join(REPO, 'monster-hero');
const IMAGES_ALLY = path.join(GAME, 'data', 'images', 'images-ally.js');
const sharp = require(path.join(REPO, 'tools', 'node_modules', 'sharp'));
const BEGIN = '// <art-content-boxes>';
const END = '// </art-content-boxes>';
const CUT = 16;

const listFiles = () => {
  const out = [];
  const mon = path.join(GAME, 'images', 'monsters');
  fs.readdirSync(mon).filter((f) => /\.png$/i.test(f)).sort().forEach((f) => out.push(`images/monsters/${f}`));
  const walk = (dir, rel) => fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1)).forEach((d) => {
    if (d.isDirectory()) { if (d.name !== 'face') walk(path.join(dir, d.name), `${rel}/${d.name}`); return; }
    if (/\.png$/i.test(d.name)) out.push(`${rel}/${d.name}`);
  });
  walk(path.join(GAME, 'images', 'assistant'), 'images/assistant');
  return out;
};

const boxOf = async (rel) => {
  const { data, info } = await sharp(path.join(GAME, rel)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > CUT) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  const r = (v) => Math.round(v * 1000) / 1000;
  return [r(x0 / w), r(y0 / h), r((x1 + 1) / w), r((y1 + 1) / h), r(w / h)];
};

const keyOf = (rel) => rel.replace(/^images\//, '');
const blockOf = (entries) => `${BEGIN}\n// 立ち絵の中身の範囲 [左, 上, 右, 下(画像に対する割合), 横÷縦]。キーは images/ の下の道。tools/image/make-art-content-boxes.js が作る(手で書かない)\n`
  + `// 使う所: MFバトルカードの対戦開始(VS)の画面で、助手とモンスターの見た目の大きさをそろえる(83-card-battle-vs.jsx の CardVsArt)\n`
  + `const ART_CONTENT_BOXES = {\n${entries.map(([k, v]) => `  ${JSON.stringify(keyOf(k))}: [${v.join(', ')}],`).join('\n')}\n};\n${END}`;

const writeBlock = (text, block) => {
  const a = text.indexOf(BEGIN), b = text.indexOf(END);
  if (a >= 0 && b > a) return text.slice(0, a) + block + text.slice(b + END.length);
  return `${text.replace(/\s*$/, '')}\n${block}\n`;
};

(async () => {
  const files = listFiles();
  const entries = [];
  for (const rel of files) entries.push([rel, await boxOf(rel)]);
  const block = blockOf(entries);
  const text = fs.readFileSync(IMAGES_ALLY, 'utf8');
  const next = writeBlock(text, block);
  if (process.argv.includes('--check')) {
    if (next !== text) { console.log('NG: data/images/images-ally.js の ART_CONTENT_BOXES が今の立ち絵と合っていません(node tools/image/make-art-content-boxes.js で作り直す)'); process.exit(1); }
    console.log(`OK: ART_CONTENT_BOXES は今の立ち絵と合っている(${entries.length}枚)`);
    return;
  }
  if (next !== text) fs.writeFileSync(IMAGES_ALLY, next);
  console.log(`書き出し: ART_CONTENT_BOXES ${entries.length}枚 → data/images/images-ally.js`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
