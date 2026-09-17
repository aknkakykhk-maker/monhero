// 「表情が1枚に並んだシート」を、表情ごとの透過PNGへ切り分ける。
//
//   node tools/image/split-expression-sheet.js [シート] [出力フォルダ] [接頭辞]
//   (既定: tools/art-sources/assistants/dra-expressions-sheet.png → 同じフォルダへ dra_*.PNG)
//
// ドラの表情集(2026-09-17に受け取った1536x1024・8種)を切り分けるために作った。
// 同じ作りのシート(4列2行・背景透過・見出しとラベルが入っている)なら、
// 別のキャラクターでもそのまま使える。
//
// 【切り分け方】
// 顔(肌色)の中心を枚ごとに測り、そこを中心にした同じ大きさの正方形で切る。
// 単純にグリッドで割ると絵ごとに顔の位置が数pxずれ、吹き出しで表情を
// 入れ替えたときに顔が動いて見えるため。
// 見出しとラベル(「通常」などのピル)は帯ごと透明にしてから切る。切り出す正方形は
// 怒りマークや汗のぶん顔より広いので、消しておかないとラベルの端が入り込む。
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
let sharp = null;
try { sharp = require('sharp'); } catch { /* 無ければ減色せずに書き出す */ }

const REPO = path.resolve(__dirname, '../..');
const SRC = process.argv[2] || path.join(REPO, 'tools/art-sources/assistants/dra-expressions-sheet.png');
const OUT = process.argv[3] || path.dirname(SRC);
const PREFIX = process.argv[4] || 'dra';

const HALF = 192;                                  // 切り出す正方形の半径(px) → 384x384
const MASK_BANDS = [[0, 131], [445, 546], [845, 936]]; // 見出し・ラベルの帯(y)
const COLS = [[0, 390], [390, 765], [765, 1150], [1150, 1536]];
const ROWS = [[131, 445], [546, 845]];
// 並びの順に、助手の表情スロット(ASSISTANT_EXPRESSIONS)の名前を当てる。
// 「照れ」「考え中」には対応する名前が無いので excited / wink へ寄せた
// (理由は tools/art-sources/assistants/README.md)
const CELLS = [
  { col: 0, row: 0, label: '通常',   name: 'normal' },
  { col: 1, row: 0, label: '笑顔',   name: 'happy' },
  { col: 2, row: 0, label: '怒り',   name: 'angry' },
  { col: 3, row: 0, label: '驚き',   name: 'surprise' },
  { col: 0, row: 1, label: '悲しみ', name: 'crying' },
  { col: 1, row: 1, label: '照れ',   name: 'excited' },
  { col: 2, row: 1, label: '困り',   name: 'troubled' },
  { col: 3, row: 1, label: '考え中', name: 'wink' },
];
const ALPHA_MIN = 24;
const isSkin = (r, g, b) => r > 190 && g > 140 && g < 215 && b > 100 && b < 190 && r - b > 45;

(async () => {
  const img = await loadImage(SRC);
  const W = img.width, H = img.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const image = ctx.getImageData(0, 0, W, H);
  const d = image.data;
  for (const [y0, y1] of MASK_BANDS) {
    for (let y = y0; y < Math.min(y1, H); y++) for (let x = 0; x < W; x++) d[(y * W + x) * 4 + 3] = 0;
  }
  ctx.putImageData(image, 0, 0);

  fs.mkdirSync(OUT, { recursive: true });
  for (const cell of CELLS) {
    const [x0, x1] = COLS[cell.col];
    const [y0, y1] = ROWS[cell.row];
    let sx0 = Infinity, sx1 = -1, sy0 = Infinity, sy1 = -1;
    let ox0 = Infinity, ox1 = -1, oy0 = Infinity, oy1 = -1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] < ALPHA_MIN) continue;
      if (x < ox0) ox0 = x; if (x > ox1) ox1 = x; if (y < oy0) oy0 = y; if (y > oy1) oy1 = y;
      if (isSkin(d[i], d[i + 1], d[i + 2])) {
        if (x < sx0) sx0 = x; if (x > sx1) sx1 = x; if (y < sy0) sy0 = y; if (y > sy1) sy1 = y;
      }
    }
    if (sx1 < 0) throw new Error(`${cell.label}: 顔(肌色)が見つかりませんでした`);
    const cx = Math.round((sx0 + sx1) / 2), cy = Math.round((sy0 + sy1) / 2);
    const left = cx - HALF, top = cy - HALF;
    // 怒りマーク・汗・「？」が枠から切れていないかを機械的に確かめる
    if (ox0 < left || ox1 >= left + HALF * 2 || oy0 < top || oy1 >= top + HALF * 2) {
      throw new Error(`${cell.label}: 絵が ${HALF * 2}px の枠に収まっていません(HALF を広げてください)`);
    }
    const out = createCanvas(HALF * 2, HALF * 2);
    out.getContext('2d').drawImage(canvas, left, top, HALF * 2, HALF * 2, 0, 0, HALF * 2, HALF * 2);
    let buf = out.toBuffer('image/png');
    // 減色しないと、同じ絵でもRGBAのまま3倍近く重くなる(make-assistant-faces.js と同じ理由)
    if (sharp) buf = await sharp(buf).png({ palette: true, quality: 90, compressionLevel: 9 }).toBuffer();
    const file = path.join(OUT, `${PREFIX}_${cell.name}.PNG`);
    fs.writeFileSync(file, buf);
    console.log(`${cell.label} → ${path.basename(file)}  顔${sx1 - sx0}x${sy1 - sy0}  ${(buf.length / 1024).toFixed(0)}KB`);
  }
  console.log(`\n${CELLS.length}枚を ${path.relative(REPO, OUT)} へ書き出しました`);
})();
