// モンヒロサクセス公開用のキー画像(更新履歴・助手の告知の image)を作る道具。
//   node tools/success/make-key-visual.js            → monster-hero/images/events/monsaku-open.jpg(880×1000)
// 景色は monster-hero/images/success/scenes/ の最初の画像があればそれを、無ければ story-bg の森を暗くして使う。
// イッサ博士は docs/progress/player-raise/art/issa-hakase.png、アイテムは monster-hero/images/success/items/。
const path = require('path');
const fs = require('fs');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));
const root = path.resolve(__dirname, '..', '..');
const W = 880, H = 1000;

const pickScene = () => {
  const dir = path.join(root, 'monster-hero/images/success/scenes');
  if (fs.existsSync(dir)) { const f = fs.readdirSync(dir).filter(n => /\.(png|jpe?g)$/i.test(n)).sort()[0]; if (f) return path.join(dir, f); }
  return path.join(root, 'monster-hero/images/story-bg/forest_deep.jpg');
};

(async () => {
  const bg = await sharp(pickScene()).resize(W, H, { fit: 'cover' }).modulate({ brightness: 0.55, saturation: 0.9 }).toBuffer();
  const shade = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0f1b3d" stop-opacity=".78"/><stop offset=".45" stop-color="#14224a" stop-opacity=".25"/><stop offset="1" stop-color="#0f1b3d" stop-opacity=".88"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/></svg>`);
  const issa = await sharp(path.join(root, 'docs/progress/player-raise/art/issa-hakase.png')).resize({ height: 720 }).toBuffer();
  const im = await sharp(issa).metadata();
  const names = ['training-ticket', 'hourglass-rainbow', 'weekly-training', 'momo-kibidango', 'garoe-veggie-juice', 'breeder-license'];
  const size = 120, gap = 22, rowW = names.length * size + (names.length - 1) * gap, x0 = Math.round((W - rowW) / 2), y0 = H - 190;
  const icons = [];
  for (let i = 0; i < names.length; i++) {
    const p = path.join(root, `monster-hero/images/success/items/${names[i]}.png`);
    icons.push({ input: await sharp(p).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), left: x0 + i * (size + gap), top: y0 });
  }
  // 期の流れ(PLAN.md・TOURNAMENT.md の正式な呼び方とターン数)
  const periods = [['デビュー期', '5'], ['ジュニア期', '12'], ['ミドル期', '12'], ['プロ期', '12'], ['最後の期', '5']];
  const bw = 150, bgap = 14, bx0 = 48, by = 350;
  const flow = periods.map((p, i) => {
    const x = bx0 + i * (bw + bgap), last = i === periods.length - 1;
    const sub = last ? 'ヒーローズファイナル' : p[1] + 'ターン';
    return `<rect x="${x}" y="${by}" width="${bw}" height="78" rx="14" fill="#0f1b3d" fill-opacity=".92" stroke="${last ? '#ffd54a' : '#fb7185'}" stroke-width="3"/>
    <text x="${x + bw / 2}" y="${by + 34}" font-size="23" font-weight="700" fill="#fff" text-anchor="middle">${p[0]}</text>
    <text x="${x + bw / 2}" y="${by + 64}" font-size="20" fill="${last ? '#ffd54a' : '#ffb4cf'}" text-anchor="middle">${sub}</text>` + (last ? '' : `<text x="${x + bw + bgap / 2}" y="${by + 48}" font-size="18" fill="#ffd54a" text-anchor="middle">▶</text>`);
  }).join('\n');
  const text = Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" font-family="WenQuanYi Zen Hei, Noto Sans CJK JP, sans-serif">
    <text x="48" y="150" font-size="84" font-weight="700" fill="#ffffff" stroke="#0f1b3d" stroke-width="10" paint-order="stroke">モンヒロ</text>
    <text x="48" y="250" font-size="84" font-weight="700" fill="#ffd54a" stroke="#0f1b3d" stroke-width="10" paint-order="stroke">サクセス</text>
    <text x="52" y="318" font-size="38" font-weight="700" fill="#ffb4cf" stroke="#0f1b3d" stroke-width="7" paint-order="stroke">最大46ターンの育成</text>
    ${flow}
    <rect x="${x0 - 18}" y="${y0 - 16}" width="${rowW + 36}" height="${size + 32}" rx="22" fill="#0f1b3d" fill-opacity=".55" stroke="#fb7185" stroke-opacity=".7" stroke-width="3"/>
  </svg>`);
  const rectLayer = text; // 枠はアイコンの下に敷きたいので先に重ねる
  const out = path.join(root, 'monster-hero/images/events/monsaku-open.jpg');
  await sharp(bg).composite([
    { input: shade },
    { input: issa, left: W - im.width - 20, top: H - im.height - 215 },
    { input: rectLayer },
    ...icons,
  ]).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  console.log(out, fs.statSync(out).size);
})();
