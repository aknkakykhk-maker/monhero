// 新モンスター「イルミネ」「ドリーミィ」の予告に付ける「染色イメージ」の画像を作る(2026-10-22)。
//
//   node image/make-illumine-dreamy-dye-preview.js <太字フォントのパス>
//
// メロディー・クロミーの染色イメージ(make-melody-kuromy-dye-preview.js)を写して、2体と色・背景だけ差し替えた。
// 染めた姿は**ゲームと同じ処理で作る**(getDyeRegionMasks で部位マスクを作り、getRecoloredImage で
// 色を置き換えた絵をマスクで切り抜いて元絵へ重ねる。DyedMonsterImage と同じ重ね方)。手で塗らない。
// 色は「custom:色相:彩度:明るさ@濃さ」。濃さ(@)は染め直した絵を重ねるときの不透明度(ゲームの染色の「濃さ」)。
// 部位: イルミネ ①黒い体 ②頭の後ろの黒い髪 ③光る髪とスカートの裏 ④耳と頭の金の飾り ⑤目と体の模様
//       ドリーミィ ①体の毛 ②雲 ③頭の後ろの縞の帽子 ④玉の飾り ⑤ピンクと水色の飾り
//
// 書き出すのは monster-hero/images/events/ の2枚(1000x520・JPEG quality 80・mozjpeg)。
//   illumine-dye-preview.jpg / dreamy-dye-preview.jpg … 社長が案(DYE_CANDIDATES)から選んだ配色
// 案を並べて選んでもらうとき: CANDIDATES=1 OUT_DIR=<フォルダ> を付けると、DYE_CANDIDATES の全部を <ID>-<案>.jpg で書く
// フォントは M PLUS Rounded 1c ExtraBold(リポジトリには入れない)。
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { registerFont } = require('canvas');
const { loadDyeModule, decodeDataUrl, createCanvas, loadEmbeddedImages, imageForBaseId } = require('../harness');

const ROOT = path.resolve(__dirname, '..', '..');
const FONT = process.argv[2];
if (!FONT || !fs.existsSync(FONT)) { console.log('使い方: node image/make-illumine-dreamy-dye-preview.js <太字フォントのパス>'); process.exit(1); }
registerFont(FONT, { family: 'MPR' });

const c = (h, s, v, a) => `custom:${h}:${s}:${v}${a ? '@' + a : ''}`;
// 2026-10-22 社長に選んでもらう配色の案(A〜D)。選ばれた案を PREVIEWS の colors・style に写す
const DYE_CANDIDATES = {
  Illumine: {
    A: { style: 'ムーンライト', colors: [c(230,35,25), c(230,40,18), c(200,40,100), c(50,25,100), c(190,70,100)], bg: ['#0b1230', '#25407a', '#8fb8e8'], accent: '#cfe6ff', dots: ['rgba(200,230,255,.6)', 'rgba(150,190,255,.55)', 'rgba(255,255,255,.5)'] },
    B: { style: 'サクラナイト', colors: [c(330,30,30), c(330,35,20), c(340,45,100), c(0,0,100), c(340,75,100)], bg: ['#2a0b1f', '#7a2a55', '#f2a7c8'], accent: '#ffd0e4', dots: ['rgba(255,190,220,.6)', 'rgba(255,150,200,.55)', 'rgba(255,255,255,.5)'] },
    C: { style: 'エメラルドオーロラ', colors: [c(160,45,22), c(160,50,15), c(140,70,90), c(50,80,100), c(120,80,100)], bg: ['#05201a', '#0f6b52', '#9be8c4'], accent: '#b8ffd8', dots: ['rgba(150,255,200,.6)', 'rgba(100,230,170,.55)', 'rgba(255,255,200,.5)'] },
    D: { style: 'サンセットドレス', colors: [c(280,45,25), c(20,45,22), c(25,85,100), c(50,80,100), c(10,80,100)], bg: ['#24082e', '#a0405a', '#f59e0b'], accent: '#ffd27a', dots: ['rgba(255,170,60,.6)', 'rgba(255,120,120,.55)', 'rgba(255,230,140,.5)'] },
  },
  Dreamy: {
    A: { style: 'ミントキャンディ', colors: [c(150,30,100), c(160,20,100), c(160,45,95), c(340,55,100), c(150,60,85)], bg: ['#0c3a32', '#3fae8e', '#c8f5e3'], accent: '#c8ffe8', dots: ['rgba(180,255,220,.6)', 'rgba(255,190,220,.55)', 'rgba(255,255,255,.5)'] },
    B: { style: 'ラベンダードリーム', colors: [c(270,25,100), c(260,20,100), c(280,45,95), c(50,60,100), c(290,60,90)], bg: ['#24123f', '#7a5bb8', '#e3d4ff'], accent: '#ecdcff', dots: ['rgba(220,200,255,.6)', 'rgba(255,240,170,.55)', 'rgba(255,255,255,.5)'] },
    C: { style: 'チョコミルク', colors: [c(25,55,60), c(30,25,100), c(25,65,45), c(0,70,85), c(340,70,90)], bg: ['#2a1508', '#7a4422', '#f0d2a8'], accent: '#ffe4c0', dots: ['rgba(255,220,180,.6)', 'rgba(255,170,170,.55)', 'rgba(255,255,255,.5)'] },
    D: { style: 'そらとほし', colors: [c(205,60,95), c(50,45,100), c(205,75,80), c(50,85,100), c(20,80,100)], bg: ['#0a1d45', '#2f6fc0', '#ffe58a'], accent: '#fff2a8', dots: ['rgba(255,240,150,.7)', 'rgba(170,210,255,.55)', 'rgba(255,255,255,.5)'] },
  },
};
// 予告に載せる配色(社長が選んだ案)。選ぶ前は A を仮に入れておく
const CHOSEN = { Illumine: 'A', Dreamy: 'A' };
const PREVIEWS = [
  { baseId: 'Illumine', out: 'illumine-dye-preview.jpg', name: 'イルミネ', ...DYE_CANDIDATES.Illumine[CHOSEN.Illumine] },
  { baseId: 'Dreamy', out: 'dreamy-dye-preview.jpg', name: 'ドリーミィ', ...DYE_CANDIDATES.Dreamy[CHOSEN.Dreamy] },
];

const dyed = async (dye, url, baseId, colors) => {
  const src = await decodeDataUrl(url);
  const W = src.width, H = src.height;
  const c = createCanvas(W, H), x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  const masks = await dye.getDyeRegionMasks(baseId, url);
  for (let i = 0; i < colors.length; i++) {
    if (!colors[i]) continue;
    // 「濃さ」(色id の末尾 @NN)は、ゲームと同じく染め直した絵を重ねるときの不透明度にする
    // (DyedMonsterImage の opacity:alpha/100)。濃さを下げると元の絵の陰影や色味が少し透けてなじむ
    const at = colors[i].lastIndexOf('@');
    const base = at >= 0 ? colors[i].slice(0, at) : colors[i];
    const alpha = at >= 0 ? Math.max(0, Math.min(100, Number(colors[i].slice(at + 1)))) / 100 : 1;
    const [re, ma] = await Promise.all([decodeDataUrl(await dye.getRecoloredImage(url, base, baseId, i)), decodeDataUrl(masks[i])]);
    const t = createCanvas(W, H), tx = t.getContext('2d');
    tx.drawImage(re, 0, 0, W, H);
    tx.globalCompositeOperation = 'destination-in';
    tx.imageSmoothingEnabled = true;
    tx.drawImage(ma, 0, 0, W, H);
    x.save(); x.globalAlpha = alpha; x.drawImage(t, 0, 0); x.restore();
  }
  return { src, dyedCanvas: c };
};

(async () => {
  // 案を並べて選んでもらうとき(CANDIDATES=1): DYE_CANDIDATES の全部を OUT_DIR へ <ID>-<案>.jpg で書く
  const list = process.env.CANDIDATES ? Object.entries(DYE_CANDIDATES).flatMap(([baseId, set]) => Object.entries(set).map(([key, v]) =>
    ({ baseId, out: `${baseId}-${key}.jpg`, name: baseId === 'Illumine' ? 'イルミネ' : 'ドリーミィ', ...v }))) : [...PREVIEWS];
  PREVIEWS.length = 0; PREVIEWS.push(...list);
  const dye = loadDyeModule();
  const images = loadEmbeddedImages();
  for (const p of PREVIEWS) {
    const url = imageForBaseId(p.baseId, images);
    const { src, dyedCanvas } = await dyed(dye, url, p.baseId, p.colors);
    const W = 2000, H = 1040;
    const c = createCanvas(W, H), x = c.getContext('2d');
    let seed = 928; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    // 背景: 斜めのグラデーションと集中線
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, p.bg[0]); g.addColorStop(.55, p.bg[1]); g.addColorStop(1, p.bg[2]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const cx0 = W * .68, cy0 = H * .5;
    x.save(); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2 + rnd() * .05, wd = .012 + rnd() * .02;
      x.beginPath(); x.moveTo(cx0, cy0);
      x.lineTo(cx0 + Math.cos(a - wd) * 2400, cy0 + Math.sin(a - wd) * 2400);
      x.lineTo(cx0 + Math.cos(a + wd) * 2400, cy0 + Math.sin(a + wd) * 2400);
      x.closePath(); x.fillStyle = `rgba(255,255,255,${.04 + rnd() * .06})`; x.fill();
    }
    x.restore();
    const halo = x.createRadialGradient(cx0, cy0, 40, cx0, cy0, 620);
    halo.addColorStop(0, 'rgba(255,255,240,.55)'); halo.addColorStop(1, 'rgba(255,255,240,0)');
    x.fillStyle = halo; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) { x.fillStyle = p.dots[i % p.dots.length]; x.beginPath(); x.arc(rnd() * W, rnd() * H, 6 + rnd() * 16, 0, 7); x.fill(); }
    // 左: いつもの姿(丸枠)
    const lx = 400, ly = 640, lr = 250;
    x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 30;
    x.fillStyle = 'rgba(255,255,255,.92)'; x.beginPath(); x.arc(lx, ly, lr, 0, 7); x.fill(); x.restore();
    x.save(); x.beginPath(); x.arc(lx, ly, lr - 12, 0, 7); x.clip();
    const bgc = x.createRadialGradient(lx, ly, 20, lx, ly, lr); bgc.addColorStop(0, '#ffffff'); bgc.addColorStop(1, '#e6dcf2'); x.fillStyle = bgc; x.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    const s1 = Math.min((lr * 1.75) / src.width, (lr * 1.8) / src.height);
    x.drawImage(src, lx - src.width * s1 / 2, ly - src.height * s1 / 2 + 10, src.width * s1, src.height * s1); x.restore();
    x.lineWidth = 12; x.strokeStyle = p.accent; x.beginPath(); x.arc(lx, ly, lr, 0, 7); x.stroke();
    const chip = (tx, ty, text, size, fill, color) => { x.save(); x.font = `${size}px MPR`; const tw = x.measureText(text).width; x.fillStyle = fill; x.beginPath(); x.roundRect(tx - tw / 2 - 30, ty - size * .78, tw + 60, size * 1.5, size * .75); x.fill(); x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, tx, ty); x.restore(); };
    chip(lx, ly + lr + 20, 'いつもの姿', 50, 'rgba(20,20,20,.75)', '#ffffff');
    // 矢印
    x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
    for (const [w, col] of [[40, '#ffffff'], [22, '#e2233a']]) {
      x.lineWidth = w; x.strokeStyle = col; x.beginPath(); x.moveTo(720, 470); x.bezierCurveTo(800, 360, 900, 380, 960, 440); x.stroke();
      x.fillStyle = col; x.beginPath(); x.moveTo(1010, 490); x.lineTo(915, 470); x.lineTo(975, 395); x.closePath(); x.fill();
    }
    x.restore();
    // 右: 染めた姿
    const dw = dyedCanvas.width, dh = dyedCanvas.height;
    const s2 = Math.min(820 / dw, 960 / dh);
    x.save(); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 40; x.shadowOffsetY = 16;
    x.drawImage(dyedCanvas, cx0 - dw * s2 / 2, H - 30 - dh * s2, dw * s2, dh * s2); x.restore();
    // 見出し
    chip(250, 110, '染色イメージ', 58, p.accent, '#3a1a08');
    x.save(); x.font = '112px MPR'; x.textAlign = 'left'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const title = `${p.style}`;
    x.lineWidth = 26; x.strokeStyle = '#2a0f06'; x.strokeText(title, 90, 240);
    x.lineWidth = 10; x.strokeStyle = '#fffaf0'; x.strokeText(title, 90, 240);
    const tg = x.createLinearGradient(0, 180, 0, 300); tg.addColorStop(0, '#fff6c8'); tg.addColorStop(1, p.accent); x.fillStyle = tg; x.fillText(title, 90, 240);
    x.restore();
    x.save(); x.font = '52px MPR'; x.fillStyle = '#ffffff'; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 10; x.fillText(p.name, 96, 332); x.restore();
    x.save(); x.font = '34px MPR'; x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,.85)'; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 8;
    x.fillText('※「染色もどき」で部位ごとに染めた例です', W - 40, H - 36); x.restore();
    x.lineWidth = 12; x.strokeStyle = p.accent; x.strokeRect(6, 6, W - 12, H - 12);
    const outPath = path.join(process.env.CANDIDATES && process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(ROOT, 'monster-hero', 'images', 'events'), p.out);
    const info = await sharp(c.toBuffer('image/png')).resize(1000, 520).jpeg({ quality: 80, mozjpeg: true }).toFile(outPath);
    console.log(`書き出しました: ${path.relative(ROOT, outPath)} (${Math.round(info.size / 1024)}KB)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
