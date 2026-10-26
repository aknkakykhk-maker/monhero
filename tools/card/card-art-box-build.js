// 助手の標準の服の立ち絵(images/assistant/<接頭辞>_<表情>.PNG)の「透明な余白を除いた範囲」を測り、
// 84-screen-card-battle.jsx の CARD_ART_KNOWN_BOX の表を書き直す(2026-10-26 社長「みゅあの立ち絵だけ小さい」の続き)。
//   端末が canvas の画素を読めないときも、立ち絵を欄の高さに合わせるため。測り方は 84 の cardArtBox と同じ
//   (列・行ごとに不透明(α>24)な点を数え、3点以上ある所だけを範囲にする)。着替えの服(halloween など)は測らない
//
//   node tools/card/card-art-box-build.js          表を書き直す
//   node tools/card/card-art-box-build.js --check  表が今の絵と合っているかだけ見る(合っていなければ NG)
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp'));
const DIR = path.join(ROOT, 'monster-hero', 'images', 'assistant');
const P84 = path.join(ROOT, 'monster-hero', 'src', 'parts', '84-screen-card-battle.jsx');
const BEGIN = '  // <card-art-known-box> ここから下は tools/card/card-art-box-build.js が書く(手で直さない)';
const END = '  // </card-art-known-box>';
const CHECK = process.argv.includes('--check');

const measure = async (file) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width, h = info.height;
  const col = new Array(w).fill(0), row = new Array(h).fill(0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 24) { col[x] += 1; row[y] += 1; }
  const MIN = 3;
  const x0 = col.findIndex((n) => n >= MIN), y0 = row.findIndex((n) => n >= MIN);
  if (x0 < 0 || y0 < 0) return null;
  const x1 = w - 1 - [...col].reverse().findIndex((n) => n >= MIN), y1 = h - 1 - [...row].reverse().findIndex((n) => n >= MIN);
  return [w, h, x0, y0, x1 - x0 + 1, y1 - y0 + 1];
};

(async () => {
  const files = fs.readdirSync(DIR).filter((f) => /^[a-z]+_[a-z]+\.PNG$/.test(f)).sort();
  const lines = [];
  for (const f of files) {
    const box = await measure(path.join(DIR, f));
    if (box) lines.push(`  ${f.replace(/\.PNG$/, '')}: [${box.join(', ')}],`);
  }
  const block = [BEGIN, ...lines, END].join('\n');
  const src = fs.readFileSync(P84, 'utf8');
  const a = src.indexOf(BEGIN), b = src.indexOf(END);
  if (a < 0 || b < 0) { console.log('NG: 84 に表の目印が無い'); process.exit(1); }
  const cur = src.slice(a, b + END.length);
  if (CHECK) {
    const ok = cur === block;
    console.log(`${ok ? 'OK' : 'NG'}: 助手の立ち絵の範囲の表(${lines.length}枚)が、今の絵と合っている${ok ? '' : ' — node tools/card/card-art-box-build.js で書き直す'}`);
    process.exit(ok ? 0 : 1);
  }
  fs.writeFileSync(P84, src.slice(0, a) + block + src.slice(b + END.length));
  console.log(`書き直し: ${lines.length}枚`);
})();
