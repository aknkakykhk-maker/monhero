// 新モンスター「キュービ」「オリヒメ」の予告に付ける「染色イメージ」の画像を作る(2026-10-27)。
//
//   node image/make-kyubi-orihime-dye-preview.js <太字フォントのパス>
//
// イルミネ・ドリーミィの染色イメージ(make-illumine-dreamy-dye-preview.js)を写して、2体と色・背景だけ差し替えた。
// 染めた姿は**ゲームと同じ処理で作る**(getDyeRegionMasks で部位マスクを作り、getRecoloredImage で
// 色を置き換えた絵をマスクで切り抜いて元絵へ重ねる。DyedMonsterImage と同じ重ね方)。手で塗らない。
// 色は「custom:色相:彩度:明るさ@濃さ」。null の部位は染めない(元の色のまま)。
// 部位: キュービ ①髪 ②しっぽ・耳の毛 ③服の白・胸元の毛 ④胸の紫・下駄・提灯の紫の房 ⑤手袋・脚(提灯は染めない)
//       オリヒメ ①髪・耳 ②しっぽ・羽衣 ③上の着物(帯・リボン) ④外の羽織 ⑤手袋・紫の靴下(風鈴は染めない)
// 案A は社長が見せてくれた元のゲームの色違い(ツワモン)に寄せた色。
//
// 書き出すのは monster-hero/images/events/ の2枚(1000x520・JPEG quality 80・mozjpeg)。
//   kyubi-dye-preview.jpg / orihime-dye-preview.jpg … 選んだ配色(CHOSEN)
// 案を並べて選んでもらうとき: CANDIDATES=1 OUT_DIR=<フォルダ> を付けると、DYE_CANDIDATES の全部を <ID>-<案>.jpg で書く
// フォントは M PLUS Rounded 1c ExtraBold(リポジトリには入れない)。
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { registerFont } = require('canvas');
const { loadDyeModule, decodeDataUrl, createCanvas, loadEmbeddedImages, imageForBaseId } = require('../harness');

const ROOT = path.resolve(__dirname, '..', '..');
const FONT = process.argv[2];
if (!FONT || !fs.existsSync(FONT)) { console.log('使い方: node image/make-kyubi-orihime-dye-preview.js <太字フォントのパス>'); process.exit(1); }
registerFont(FONT, { family: 'MPR' });

const c = (h, s, v, a) => `custom:${h}:${s}:${v}${a ? '@' + a : ''}`;
// 2026-10-22 社長に選んでもらう配色の案(A〜D)。選ばれた案を PREVIEWS の colors・style に写す
const DYE_CANDIDATES = {
  Kyubi: {
    A: { style: '白ぎつね', colors: [c(250,18,100), c(250,15,100), c(210,6,100), c(355,85,85), c(0,0,100)], bg: ['#1b1638', '#5a5aa8', '#e4e2ff'], accent: '#f1edff', dots: ['rgba(240,235,255,.6)', 'rgba(255,170,170,.45)'] },
    B: { style: '紅葉ぎつね', colors: [c(15,60,40), c(25,85,95), c(40,15,100), c(45,85,95), c(15,60,35)], bg: ['#2a0e05', '#a0401a', '#ffc27a'], accent: '#ffd9a0', dots: ['rgba(255,200,120,.6)', 'rgba(255,140,90,.5)'] },
    C: { style: '月夜ぎつね', colors: [c(230,55,45), c(230,35,85), c(220,18,100), c(280,60,70), c(230,30,22)], bg: ['#070c2a', '#24366e', '#8fb2e8'], accent: '#cfe0ff', dots: ['rgba(200,220,255,.6)', 'rgba(170,140,255,.45)'] },
    D: { style: '桜ぎつね', colors: [c(340,35,95), c(340,30,100), c(350,8,100), c(330,70,90), c(340,18,100)], bg: ['#2a0b1f', '#a04a78', '#ffd0e4'], accent: '#ffd8ea', dots: ['rgba(255,200,225,.6)', 'rgba(255,255,255,.45)'] },
    // C を色の札と濃さだけで作り直した物(遊ぶ人が染色の画面でそのまま選べる形。2026-10-27)
    C2: { style: '月夜ぎつね', colors: ['blue@55', 'blue_light@80', 'blue_light@45', 'purple', 'black'], bg: ['#070c2a', '#24366e', '#8fb2e8'], accent: '#cfe0ff', dots: ['rgba(200,220,255,.6)', 'rgba(170,140,255,.45)'] },
    E: { style: '黒ぎつね', colors: [c(0,0,22), c(0,0,30), c(0,0,35), c(0,85,80), c(0,0,15)], bg: ['#0a0a0a', '#3a1018', '#c0303a'], accent: '#ffb0b0', dots: ['rgba(255,120,120,.5)', 'rgba(255,255,255,.3)'] },
  },
  Orihime: {
    A: { style: '天の川', colors: [c(170,45,90), c(50,30,100), c(230,60,30), c(215,75,85), c(215,75,85)], bg: ['#071a3a', '#1f5aa8', '#fff1b0'], accent: '#d8f4ff', dots: ['rgba(255,245,200,.7)', 'rgba(160,230,255,.5)'] },
    B: { style: '夕焼け', colors: [c(20,70,85), c(30,40,100), c(45,50,100), c(350,70,55), c(350,70,55)], bg: ['#2a0a14', '#b04a3a', '#ffd38a'], accent: '#ffe0b0', dots: ['rgba(255,210,150,.6)', 'rgba(255,150,120,.5)'] },
    C: { style: '新緑', colors: [c(120,50,55), c(90,30,100), c(60,40,100), c(150,60,40), c(150,60,40)], bg: ['#06200f', '#2f7a3f', '#e0f7b0'], accent: '#dcffc8', dots: ['rgba(220,255,190,.6)', 'rgba(255,255,255,.4)'] },
    D: { style: '雪月花', colors: [c(220,10,100), c(210,15,100), c(0,0,100), c(220,40,40), c(220,40,40)], bg: ['#0e1630', '#4a5a88', '#eef3ff'], accent: '#eef4ff', dots: ['rgba(255,255,255,.6)', 'rgba(200,220,255,.5)'] },
    E: { style: '紅の織姫', colors: [c(350,60,55), c(350,25,100), c(40,60,100), c(350,80,40), c(350,80,40)], bg: ['#2a0510', '#8a1a35', '#ffc0cc'], accent: '#ffd0da', dots: ['rgba(255,190,200,.6)', 'rgba(255,240,200,.4)'] },
    // 2026-10-27 社長「A〜E のどれでもない」→ A〜E と似た色(水色・茶・緑・白紺・えんじ)を外して作り直した5案。
    // 遊ぶ人が染色の画面でそのまま選べるよう、カスタムではなく色の札と濃さだけで染める
    F: { style: '星空', colors: ['yellow_light', 'purple_light', 'yellow', 'purple', 'purple'], bg: ['#0c0620', '#3a1f6e', '#f3d27a'], accent: '#ffe9a8', dots: ['rgba(255,230,150,.7)', 'rgba(200,170,255,.5)'] },
    G: { style: '桜', colors: ['pink', 'pink_light', 'red_light', 'white', 'pink_light'], bg: ['#3a1024', '#c25a86', '#ffe4ee'], accent: '#ffe0ec', dots: ['rgba(255,210,230,.7)', 'rgba(255,255,255,.5)'] },
    H: { style: '黒と朱', colors: ['black', 'gray', 'black', 'red', 'black'], bg: ['#080808', '#3a0c08', '#e0452a'], accent: '#ffb39a', dots: ['rgba(255,120,80,.55)', 'rgba(255,255,255,.3)'] },
    I: { style: '月光', colors: ['gray', 'blue_light', 'white', 'blue', 'blue'], bg: ['#05081e', '#1e2a6a', '#d8e0f0'], accent: '#e4ecff', dots: ['rgba(230,240,255,.65)', 'rgba(160,180,255,.45)'] },
    J: { style: '朝顔', colors: ['purple', 'pink_light', 'pink', 'blue', 'magenta'], bg: ['#120a3a', '#5a3aa8', '#ffc4e6'], accent: '#ffd6f0', dots: ['rgba(255,190,230,.6)', 'rgba(180,160,255,.5)'] },
  },
};
// 予告に載せる配色(2026-10-27 社長: キュービ C 月夜ぎつね・オリヒメ G 桜)
const CHOSEN = { Kyubi: 'C', Orihime: 'G' };
const NAMES = { Kyubi: 'キュービ', Orihime: 'オリヒメ' };
// 部位の名前(社長が決めた区分け)。染色イメージの下の表に、この順で ①〜⑤ を並べる
const REGION_NAMES = {
  Kyubi: ['①髪', '②しっぽ・耳の毛', '③服の白・胸元の毛・首の襟', '④胸の紫・下駄・提灯の紫の房', '⑤手袋・脚'],
  Orihime: ['①髪・耳', '②しっぽ・羽衣', '③上の着物・帯', '④外の羽織', '⑤手袋・靴下'],
};
// 染色イメージの下に「どの色の札・どの濃さで染めたか」の表を描く(2026-10-27 社長「どの色と透明度とかわかるようにして」)。
// 値は手で書かず、染めるのに使った colors から出す。色の札の名前と見本の色はゲームの MASU_COLOR_LABELS・MASU_COLOR_SWATCH を
// そのまま読むので、染色の画面の呼び方と同じになる。スマホの更新履歴(幅340pxほど)でも読めるよう、字は大きめにする
const TABLE_HEAD = 120;
// カスタムの色がある表は2段組み(上に「カスタム」と濃さ、下に数字)にするので、行を高くする
const tableRowOf = (colors) => (colors || []).some((cid) => typeof cid === 'string' && cid.startsWith('custom:')) ? 136 : 112;
const hsvHex = (h, s, v) => { const f = (n) => { const k = (n + h / 60) % 6; return Math.round(255 * v * (1 - s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return '#' + [f(5), f(3), f(1)].map((n) => n.toString(16).padStart(2, '0')).join(''); };
const describeColor = (dye, colorId) => {
  if (!colorId) return { swatch: null, name: '元の色のまま', alpha: null };
  const { base, alpha } = dye.splitColorAlpha(colorId);
  const m = /^custom:(\d+):(\d+):(\d+)$/.exec(base);
  if (m) return { swatch: hsvHex(+m[1], +m[2] / 100, +m[3] / 100), name: 'カスタム', note: `(色相${m[1]}・彩度${m[2]}・明るさ${m[3]})`, alpha };
  return { swatch: dye.MASU_COLOR_SWATCH[base] || '#888888', name: dye.MASU_COLOR_LABELS[base] || base, alpha };
};
const drawDyeTable = (x, top, W, dye, p) => {
  const names = REGION_NAMES[p.baseId] || [];
  const ROW = tableRowOf(p.colors);
  const h = TABLE_HEAD + ROW * names.length + 30;
  x.fillStyle = '#16122a'; x.fillRect(0, top, W, h);
  x.lineWidth = 12; x.strokeStyle = p.accent; x.strokeRect(6, top - 6, W - 12, h);
  x.save(); x.font = '58px MPR'; x.fillStyle = p.accent; x.textBaseline = 'middle';
  x.fillText('染め方(染色の画面で選ぶ色と濃さ)', 60, top + TABLE_HEAD / 2 + 6); x.restore();
  names.forEach((label, i) => {
    const y = top + TABLE_HEAD + i * ROW + ROW / 2;
    const d = describeColor(dye, p.colors[i]);
    if (i % 2 === 0) { x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(30, y - ROW / 2, W - 60, ROW); }
    x.save(); x.textBaseline = 'middle';
    x.font = '56px MPR'; x.fillStyle = '#ffffff'; x.fillText(label, 60, y);
    // 画面(染色の窓)と同じ書き方にする: 色の札は名前、カスタムは「カスタム(色相○・彩度○・明るさ○)」、濃さは「濃さ○%」
    const top1 = d.note ? y - 28 : y;
    if (d.swatch) { x.fillStyle = d.swatch; x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 5; x.beginPath(); x.roundRect(890, top1 - 38, 76, 76, 14); x.fill(); x.stroke(); }
    x.font = d.note ? '52px MPR' : '60px MPR'; x.fillStyle = '#fff6d8'; x.fillText(d.name, 990, top1);
    if (d.note) { x.font = '46px MPR'; x.fillStyle = '#ffffff'; x.fillText(d.note, 890, y + 34); }
    if (d.alpha !== null) { x.font = d.note ? '52px MPR' : '60px MPR'; x.fillStyle = '#ffffff'; x.textAlign = 'right'; x.fillText(`濃さ${d.alpha}%`, W - 60, top1); }
    x.restore();
  });
  return h;
};
const PREVIEWS = [
  { baseId: 'Kyubi', out: 'kyubi-dye-preview.jpg', name: NAMES.Kyubi, ...DYE_CANDIDATES.Kyubi[CHOSEN.Kyubi] },
  { baseId: 'Orihime', out: 'orihime-dye-preview.jpg', name: NAMES.Orihime, ...DYE_CANDIDATES.Orihime[CHOSEN.Orihime] },
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
    ({ baseId, out: `${baseId}-${key}.jpg`, name: NAMES[baseId], ...v }))) : [...PREVIEWS];
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
    // 下に表の帯を足す(高さは部位の数で決まる)
    const tableH = TABLE_HEAD + tableRowOf(p.colors) * (REGION_NAMES[p.baseId] || []).length + 30;
    const full = createCanvas(W, H + tableH), fx = full.getContext('2d');
    fx.drawImage(c, 0, 0);
    drawDyeTable(fx, H, W, dye, p);
    const info = await sharp(full.toBuffer('image/png')).resize(1000, Math.round((H + tableH) / 2)).jpeg({ quality: 80, mozjpeg: true }).toFile(outPath);
    console.log(`書き出しました: ${path.relative(ROOT, outPath)} (${Math.round(info.size / 1024)}KB)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
