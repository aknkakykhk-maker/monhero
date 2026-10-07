// 新モンスター「メロディー」「クロミー」の予告に付ける「染色イメージ」の画像を作る(2026-10-07)。
//
//   node image/make-melody-kuromy-dye-preview.js <太字フォントのパス>
//
// ゴーストの染色イメージ(make-ghost-dye-preview.js)を写して、2体と色・背景だけ差し替えた。
// 染めた姿は**ゲームと同じ処理で作る**(getDyeRegionMasks で部位マスクを作り、getRecoloredImage で
// 色を置き換えた絵をマスクで切り抜いて元絵へ重ねる。DyedMonsterImage と同じ重ね方)。手で塗らない。
// 色は「custom:色相:彩度:明るさ@濃さ」。濃さ(@)は染め直した絵を重ねるときの不透明度(ゲームの染色の「濃さ」)。
//
// 書き出すのは monster-hero/images/events/ の2枚(1000x520・JPEG quality 80・mozjpeg)。
//   melody-dye-preview.jpg … もりのくまさん(ユーザーが選んだ。5部位すべてに色、濃さも使う。色は下の colors のとおり)
//   kuromy-dye-preview.jpg … ゆうやけグラデ(ユーザーが8案から選んだ。5部位すべてに色、濃さも使う)
// 試し塗り用: MELODY_COLORS / KUROMY_COLORS に「①,②,③…」を書くと、その色で作る(- は染めない)。
// フォントは M PLUS Rounded 1c ExtraBold(リポジトリには入れない)。
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { registerFont } = require('canvas');
const { loadDyeModule, decodeDataUrl, createCanvas, loadEmbeddedImages, imageForBaseId } = require('../harness');

const ROOT = path.resolve(__dirname, '..', '..');
const FONT = process.argv[2];
if (!FONT || !fs.existsSync(FONT)) { console.log('使い方: node image/make-melody-kuromy-dye-preview.js <太字フォントのパス>'); process.exit(1); }
registerFont(FONT, { family: 'MPR' });

const PREVIEWS = [
  { baseId: 'Melody', out: 'melody-dye-preview.jpg', name: 'メロディー', style: 'もりのくまさん',
    colors: ['custom:105:60:85@90', 'custom:145:70:35', 'custom:75:25:100@55', 'custom:28:55:55@95', 'custom:52:75:100@85'], bg: ['#0f2a14', '#2f6b2e', '#d9a441'], accent: '#ffe27a', dots: ['rgba(190,255,120,.6)', 'rgba(255,225,120,.55)', 'rgba(120,200,110,.5)'] },
  { baseId: 'Kuromy', out: 'kuromy-dye-preview.jpg', name: 'クロミー', style: 'ゆうやけグラデ',
    colors: ['custom:18:80:100@85', 'custom:50:60:100@70', 'custom:290:55:34@90', 'custom:350:35:100@50', 'custom:325:60:90@75'], bg: ['#2a0f2e', '#a03a6b', '#f59e0b'], accent: '#ffd27a', dots: ['rgba(255,170,60,.6)', 'rgba(255,120,160,.55)', 'rgba(255,230,140,.5)'] },
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
  // 試し塗り用: MELODY_COLORS / KUROMY_COLORS に「①,②,③…」を書くと、その色で作る(- は染めない)
  const over = { Melody: process.env.MELODY_COLORS, Kuromy: process.env.KUROMY_COLORS };
  for (const p of PREVIEWS) if (over[p.baseId]) p.colors = over[p.baseId].split(',').map(v => v === '-' ? null : v);
  if (process.env.OUT_SUFFIX) for (const p of PREVIEWS) p.out = p.out.replace('.jpg', `${process.env.OUT_SUFFIX}.jpg`);
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
    const outPath = path.join(ROOT, 'monster-hero', 'images', 'events', p.out);
    const info = await sharp(c.toBuffer('image/png')).resize(1000, 520).jpeg({ quality: 80, mozjpeg: true }).toFile(outPath);
    console.log(`書き出しました: ${path.relative(ROOT, outPath)} (${Math.round(info.size / 1024)}KB)`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
