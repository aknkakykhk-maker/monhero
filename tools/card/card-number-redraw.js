// カードの右下の番号(「No.C-005」など)の数字だけを描き直す(2026-10-29 カード部パックくん)。
//   社長の原本のパンドラは「No.C-005」と刷ってあり、ゲームの番号 C-067 と違う。社長「(b) 番号だけ C-067 に」。
//   ほかの所は描き直さない。数字の字の形・色・大きさは、原本に刷ってある「0」に合わせる(丸い字体 M PLUS Rounded 1c で描き、
//   原本の「0」の高さ・幅に合わせて縮める。白い字に、原本と同じ暗い赤のふち)。
//
//   node tools/card/card-number-redraw.js --font <M PLUS Rounded 1c の woff2(700)> <元の絵.jpg> <今の番号> <新しい番号>
//     例: node tools/card/card-number-redraw.js --font m-plus-rounded-1c-latin-700-normal.woff2 tools/art-sources/card-battle/hybrid/C067.jpg 005 067
//   字体はリポジトリに入れない。使うときに取ってくる:
//     npm pack @fontsource/m-plus-rounded-1c@5.0.13 && tar xzf fontsource-m-plus-rounded-1c-5.0.13.tgz → package/files/
//   --weight <太さ>(既定 700)・--stroke <ふちの太さ px>(既定 5.2)で、原本の字が太いときに合わせる(ピンクグジラは「XXX」→「068」を 900・8)
//   --test を付けると、変えない字(同じ数字)の上にも描いて、原本と重なるかを見る絵を <元の絵>.test.png に書き出す(元の絵は変えない)
//
// やり方
//   ① 番号の段(右下の大きい数字の下)で、白い字の列のまとまりを左から数え、最後の N 個(N = 番号の桁数)を数字の場所とする
//   ② 変える数字の場所だけ、上下の地の色を列ごとにつないで消す(ふちの外側まで)
//   ③ 新しい数字を、その場所の真ん中・同じ高さに描く(暗い赤のふち → 白)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp'));

const args = process.argv.slice(2);
const fi = args.indexOf('--font');
const font = fi >= 0 ? args.splice(fi, 2)[1] : null;
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? Number(args.splice(i, 2)[1]) : def; };
const weight = opt('--weight', 700);
const stroke = opt('--stroke', 5.2);
const test = args.includes('--test');
const [file, from, to] = args.filter((a) => a !== '--test');

// 番号の段を探す: 右下(x 500〜720)で、白い点がある行のまとまりのうち、いちばん下のもの
const findDigits = async (img, n) => {
  const { data, info } = await sharp(img).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, ch = info.channels;
  const white = (x, y) => { const i = (y * W + x) * ch; return Math.min(data[i], data[i + 1], data[i + 2]) > 215; };
  const rows = [];
  for (let y = 860; y < 1010; y++) { let k = 0; for (let x = 500; x < 720; x++) if (white(x, y)) k++; rows.push(k); }
  const bands = []; let bs = -1;
  rows.forEach((k, i) => { if (k > 0 && bs < 0) bs = i; if (k === 0 && bs >= 0) { bands.push([bs + 860, i + 859]); bs = -1; } });
  if (bs >= 0) bands.push([bs + 860, rows.length + 859]);
  const runsOf = (top, bot) => {
    const out = []; let st = -1;
    for (let x = 500; x <= 720; x++) {
      let k = 0; if (x < 720) for (let y = top; y <= bot; y++) if (white(x, y)) k++;
      if (k > 0 && st < 0) st = x;
      if (k === 0 && st >= 0) { out.push([st, x - 1]); st = -1; }
    }
    return out;
  };
  // 下から見て、高さ40px以下で、字(白い列のまとまり)が桁数以上ならんでいる段が番号の段(下のふちの白い線などは字が並ばないので外れる)
  let top = -1, bot = -1, runs = [];
  for (let i = bands.length - 1; i >= 0; i--) {
    const [t, b] = bands[i];
    const r = b - t + 1 <= 40 ? runsOf(t, b) : [];
    if (r.length >= n + 2) { top = t; bot = b; runs = r; break; }
  }
  if (runs.length < n) throw new Error(`番号の字が見つかりません(${runs.length}個)`);
  return { top, bot, digits: runs.slice(-n) };
};

(async () => {
  if (!font || !file || !from || !to || from.length !== to.length) throw new Error('使い方: node tools/card/card-number-redraw.js --font <woff2> <元の絵> <今の番号> <新しい番号>(同じ桁数)');
  const { top, bot, digits } = await findDigits(file, from.length);
  const jobs = digits.map(([x0, x1], i) => ({ x0, x1, ch: to[i], same: from[i] === to[i] })).filter((j) => test || !j.same);
  const ref = digits[from.indexOf('0') >= 0 ? from.indexOf('0') : 0]; // 大きさを合わせる手本(原本の「0」)
  const playwright = require('playwright');
  const b = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await b.newPage();
    const url = await page.evaluate(async ({ fontUrl, imgUrl, top, bot, jobs, ref, test, weight, stroke }) => {
      const f = new FontFace('R', `url(${fontUrl})`, { weight: String(weight) });
      await f.load(); document.fonts.add(f);
      const im = new Image(); await new Promise((r) => { im.onload = r; im.src = imgUrl; });
      const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
      const x = cv.getContext('2d'); x.drawImage(im, 0, 0);
      const H = bot - top + 1;                 // 白い字の高さ
      const refW = ref[1] - ref[0] + 1;        // 白い「0」の幅
      // 字体の「0」の白い部分の高さ・幅を測って、原本の「0」に合わせる倍率を決める
      const probe = document.createElement('canvas'); probe.width = 200; probe.height = 200;
      const px = probe.getContext('2d'); px.font = `${weight} 100px R`; px.textBaseline = 'alphabetic';
      const m0 = px.measureText('0');
      const gh = m0.actualBoundingBoxAscent + m0.actualBoundingBoxDescent;
      const gw = m0.actualBoundingBoxLeft + m0.actualBoundingBoxRight;
      const sy = H / gh, sx = refW / gw;
      const pad = 4;
      const draw = ({ x0, x1, ch, same }) => {
        // ② 消す(test のときは同じ字を消さずに、その横へ描き比べる)
        const cx = (x0 + x1 + 1) / 2;
        const ox = test && same ? 0 : 0;
        if (!(test && same)) {
          const L = x0 - pad, R = x1 + pad, T = top - pad, B = bot + pad;
          const d = x.getImageData(L, T - 1, R - L + 1, B - T + 3);
          const w = d.width, hh = d.height;
          for (let c = 0; c < w; c++) for (let r = 1; r < hh - 1; r++) {
            const t = r / (hh - 1);
            for (let k = 0; k < 3; k++) d.data[(r * w + c) * 4 + k] = Math.round(d.data[c * 4 + k] * (1 - t) + d.data[((hh - 1) * w + c) * 4 + k] * t);
          }
          x.putImageData(d, L, T - 1);
        }
        // ③ 描く: 字体の文字を、原本の「0」の大きさへ縮めて、場所の真ん中・下をそろえる
        const m = px.measureText(ch);
        x.save();
        x.translate(cx + ox, bot + 1);
        x.scale(sx, sy);
        x.font = `${weight} 100px R`; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
        const left = -(m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 - m.actualBoundingBoxLeft * 0;
        const dx = -((m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2);
        x.lineWidth = stroke / sx; x.strokeStyle = 'rgb(40,2,4)';
        x.strokeText(ch, dx, 0);
        x.fillStyle = test && same ? 'rgba(80,200,255,.75)' : '#fff';
        x.fillText(ch, dx, 0);
        x.restore();
        return left;
      };
      jobs.forEach(draw);
      return cv.toDataURL(test ? 'image/png' : 'image/jpeg', 0.95);
    }, {
      fontUrl: `data:font/woff2;base64,${fs.readFileSync(font).toString('base64')}`,
      imgUrl: `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}`,
      top, bot, jobs, ref, test, weight, stroke,
    });
    const buf = Buffer.from(url.split(',')[1], 'base64');
    if (test) { fs.writeFileSync(`${file}.test.png`, buf); console.log(`見本: ${file}.test.png(同じ数字の上に水色で描き比べ)`); }
    else { await sharp(buf).jpeg({ quality: 95, mozjpeg: true }).toFile(`${file}.tmp.jpg`); fs.renameSync(`${file}.tmp.jpg`, file); console.log(`書き直し: ${path.relative(ROOT, file)}(${from} → ${to}・字の高さ ${bot - top + 1}px)`); }
  } finally { await b.close(); }
})().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
