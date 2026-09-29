// ユグドラシル種の公開のお知らせ画像を作る(2026-09-29 ユーザー指示「更新情報に画像付きのモンスター説明みたいのもいれといて」)。
//
//   node image/make-yggdrasil-release-notice.js <太字フォントのパス> [ふつうの太さのフォントのパス]
//   例) node image/make-yggdrasil-release-notice.js /tmp/mpr800.ttf /tmp/mpr500.ttf
//
// 書き出すのは monster-hero/images/events/ の3枚(どれも JPEG quality 80・mozjpeg)。
//   yggdrasil-release-notice.jpg … 880x880。更新履歴の image(お知らせの詳細と助手の告知の両方に出る)
//   yggdrasil-profile.jpg        … 880x1240。ユグドラシルの紹介カード(更新履歴の gallery)
//   mel-whip-profile.jpg         … 880x1240。メルホイップの紹介カード(同上)
// 紹介カードの数字(能力値・間合い適性・固有技の倍率と消費ガッツ)は data/ally-monsters.js から読むので、
// 数字を変えたらこのツールを流し直せば絵も合う。棒の長さは味方全員の中での位置(いちばん低い子〜高い子)。
// フォントは「M PLUS Rounded 1c」(ExtraBold 800 と Medium 500)。make-yggdrasil-lineage-notice.js と同じく
// Google Fonts から一時的に取ってきて使い、リポジトリには入れない。
// 1760px幅で描いてから半分へ縮めるので、文字のふちがなめらかになる。乱数は種を固定している。
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { createCanvas, loadImage, registerFont } = require('canvas');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', '..');
const BOLD = process.argv[2];
const MEDIUM = process.argv[3] || BOLD;
if (!BOLD || !fs.existsSync(BOLD)) { console.log('使い方: node image/make-yggdrasil-release-notice.js <太字フォントのパス> [ふつうの太さのフォントのパス]'); process.exit(1); }
registerFont(BOLD, { family: 'MPB' });
registerFont(MEDIUM, { family: 'MPM' });
const OUT_DIR = path.join(ROOT, 'monster-hero', 'images', 'events');

// 数字はゲームのデータから読む
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero/data/images/images-ally.js'), 'utf8')}\n${fs.readFileSync(path.join(ROOT, 'monster-hero/data/ally-monsters.js'), 'utf8')}\n${fs.readFileSync(path.join(ROOT, 'monster-hero/data/lineages.js'), 'utf8')}\nglobalThis.M=ALL_PLAYER_MONSTERS;globalThis.D=MONSTER_DEX_DESCRIPTIONS;`, ctx);
const ALL = Object.values(ctx.M);
const bandOf = (key) => { const v = ALL.map(m => Number(m[key]) || 0); return { min: Math.min(...v), max: Math.max(...v) }; };

let seed = 20260929;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const artPath = (mon) => path.join(ROOT, 'monster-hero', String(mon.imgUrl).split('?')[0]);

// 日本語を1文字ずつ測って折り返す
const wrap = (x, text, maxW) => {
  const lines = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of para) {
      if (x.measureText(line + ch).width > maxW && line) { lines.push(line); line = ch; } else line += ch;
    }
    lines.push(line);
  }
  return lines;
};
const leaf = (x, cx, cy, len, ang, col) => { x.save(); x.translate(cx, cy); x.rotate(ang); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(len * .5, -len * .28, len, 0); x.quadraticCurveTo(len * .5, len * .28, 0, 0); x.fillStyle = col; x.fill(); x.restore(); };
const sparkles = (x, W, H, n, col) => {
  x.save(); x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const px = rnd() * W, py = rnd() * H, pr = 2 + rnd() * 6; const g = x.createRadialGradient(px, py, 0, px, py, pr * 3); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, pr * 3, 0, 7); x.fill(); }
  x.restore();
};
const ribbon = (x, cx, cy, w, h, text, size, from = '#fff3b0', to = '#b87918', ink = '#3d2305') => {
  x.save(); x.translate(cx, cy);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.roundRect(-w / 2 + 6, -h / 2 + 12, w, h, 24); x.fill();
  const g = x.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, from); g.addColorStop(1, to);
  x.fillStyle = g; x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, 24); x.fill(); x.lineWidth = 6; x.strokeStyle = '#fff8d6'; x.stroke();
  x.font = `${size}px MPB`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = ink; x.fillText(text, 0, 4); x.restore();
};
const outlined = (x, text, cx, cy, size, from, to, stroke, align = 'center') => {
  x.save(); x.font = `${size}px MPB`; x.textAlign = align; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.lineWidth = size * .22; x.strokeStyle = stroke; x.strokeText(text, cx, cy);
  x.lineWidth = size * .08; x.strokeStyle = '#fffbe6'; x.strokeText(text, cx, cy);
  const g = x.createLinearGradient(0, cy - size / 2, 0, cy + size / 2); g.addColorStop(0, from); g.addColorStop(1, to); x.fillStyle = g; x.fillText(text, cx, cy); x.restore();
};
const drawMon = async (x, file, cx, bottom, boxW, boxH, glow) => {
  const im = await loadImage(file); const s = Math.min(boxW / im.width, boxH / im.height); const w = im.width * s, h = im.height * s;
  const g = x.createRadialGradient(cx, bottom - h * .45, 20, cx, bottom - h * .45, Math.max(w, h) * .62); g.addColorStop(0, glow); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.beginPath(); x.arc(cx, bottom - h * .45, Math.max(w, h) * .62, 0, 7); x.fill();
  x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(cx, bottom - 6, w * .4, 30, 0, 0, 7); x.fill();
  x.drawImage(im, cx - w / 2, bottom - h, w, h);
};
const save = async (canvas, name, w, h) => {
  const out = path.join(OUT_DIR, name);
  const info = await sharp(canvas.toBuffer('image/png')).resize(w, h).jpeg({ quality: 80, mozjpeg: true }).toFile(out);
  console.log(`書き出しました: ${path.relative(ROOT, out)} (${Math.round(info.size / 1024)}KB)`);
};

// ---- 1枚目: キー画像(880x880) ----
const keyVisual = async () => {
  const W = 1760, H = 1760, c = createCanvas(W, H), x = c.getContext('2d');
  let g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b2a17'); g.addColorStop(.5, '#236b33'); g.addColorStop(1, '#16311a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // 右半分はケーキの甘い色
  const pg = x.createLinearGradient(W * .45, 0, W, 0); pg.addColorStop(0, 'rgba(255,190,210,0)'); pg.addColorStop(1, 'rgba(255,190,210,.35)');
  x.fillStyle = pg; x.fillRect(0, 0, W, H);
  const r = x.createRadialGradient(W / 2, 700, 40, W / 2, 700, 1100); r.addColorStop(0, 'rgba(255,255,210,.8)'); r.addColorStop(.4, 'rgba(200,245,150,.3)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = r; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 24; i++) { const side = i % 2 ? 1 : -1; leaf(x, side < 0 ? rnd() * 240 - 60 : W - rnd() * 240 + 60, rnd() * H, 170 + rnd() * 190, (side < 0 ? 0 : Math.PI) + (rnd() - .5) * 1.4, `rgba(${30 + rnd() * 40 | 0},${90 + rnd() * 70 | 0},${30 + rnd() * 30 | 0},${.55 + rnd() * .35})`); }
  for (let i = 0; i < 36; i++) leaf(x, rnd() * W, rnd() * H * .9, 28 + rnd() * 40, rnd() * 6.3, `rgba(${150 + rnd() * 80 | 0},${220 + rnd() * 35 | 0},${90 + rnd() * 60 | 0},${.35 + rnd() * .4})`);
  for (let i = 0; i < 30; i++) { const col = ['rgba(255,120,150,.6)', 'rgba(255,255,255,.65)', 'rgba(120,110,230,.45)', 'rgba(255,200,120,.55)'][i % 4]; x.fillStyle = col; x.beginPath(); x.arc(W * .55 + rnd() * W * .42, 560 + rnd() * 900, 6 + rnd() * 10, 0, 7); x.fill(); }
  sparkles(x, W, H, 120, 'rgba(255,255,230,.9)');

  ribbon(x, W / 2, 140, 760, 118, '新モンスター 登場！', 76);
  x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 30; x.shadowOffsetY = 10; outlined(x, 'ユグドラシル', W / 2, 322, 200, '#f7ffb8', '#5fbf2a', '#123f18'); x.restore();
  x.save(); x.font = '60px MPB'; x.textAlign = 'center'; x.fillStyle = '#fffde8'; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 14; x.fillText('森と甘い香りのふたりが、仲間になった', W / 2, 482); x.restore();

  await drawMon(x, artPath(ctx.M.Yggdrasil), W * .285, 1370, 760, 790, 'rgba(230,255,170,.75)');
  await drawMon(x, artPath(ctx.M.MelWhip), W * .715, 1370, 700, 810, 'rgba(255,235,220,.85)');
  const plate = (cx, cy, name, chip, chipCol, sub) => {
    x.save(); const w = 680, h = 150;
    x.fillStyle = 'rgba(12,40,20,.85)'; x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, 36); x.fill(); x.lineWidth = 6; x.strokeStyle = '#e7c45a'; x.stroke();
    x.font = '62px MPB'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fffbe0'; x.fillText(name, cx + 82, cy - 20);
    x.fillStyle = chipCol; x.beginPath(); x.roundRect(cx - w / 2 + 26, cy - 52, 136, 64, 32); x.fill(); x.font = '42px MPB'; x.fillStyle = '#fff'; x.fillText(chip, cx - w / 2 + 94, cy - 19);
    x.font = '36px MPB'; x.fillStyle = '#cfe9b5'; x.fillText(sub, cx, cy + 44); x.restore();
  };
  plate(W * .285, 1452, 'ユグドラシル', '純血', '#3f9d3a', '守りの要・ライフと丈夫さ');
  plate(W * .715, 1452, 'メルホイップ', 'レア', '#c7862a', '中距離が得意・攻めも守りも');

  const bg = x.createLinearGradient(0, 1540, 0, H); bg.addColorStop(0, 'rgba(60,20,90,0)'); bg.addColorStop(.22, 'rgba(40,16,70,.92)'); bg.addColorStop(1, 'rgba(20,8,40,.96)');
  x.fillStyle = bg; x.fillRect(0, 1540, W, H - 1540);
  x.save(); x.font = '78px MPB'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = 16; x.strokeStyle = '#3a1560';
  const msg = 'ビートP交換所で交換スタート！'; x.strokeText(msg, W / 2, 1640);
  const bt = x.createLinearGradient(0, 1600, 0, 1680); bt.addColorStop(0, '#fff6c2'); bt.addColorStop(1, '#f0b93a'); x.fillStyle = bt; x.fillText(msg, W / 2, 1640); x.restore();
  x.save(); x.font = '42px MPB'; x.textAlign = 'center'; x.fillStyle = '#e6d6ff'; x.fillText('円盤石 各1,500ビートP', W / 2, 1726); x.restore();
  x.lineWidth = 14; x.strokeStyle = '#e7c45a'; x.strokeRect(7, 7, W - 14, H - 14);
  await save(c, 'yggdrasil-release-notice.jpg', 880, 880);
};

// ---- 2・3枚目: 紹介カード(880x1240) ----
const TRAIT_TEXT = {
  name: '生命の源',
  desc: '勇者モンにすると、1〜5ターン目は受けるダメージが30%減る。\n6ターン目からは3ターンごとにガッツが30%回復する。',
};
const UNIQUE_TEXT = (mon) => ({
  name: `${mon.unique.name}`,
  meta: `×${mon.unique.baseMult}　消費ガッツ ${mon.unique.baseGuts}`,
  desc: '大樹の加護：使ったターンから2ターン、受けるダメージが30%減る。\nさらにガッツが最大の20%回復する。',
});
const EX_TEXT = {
  Yggdrasil: { name: '世界樹の守り', desc: '3ターンのあいだ、味方全員の受けるダメージが30%減る。\nターンの終わりに全員のライフが20%回復する(1ラン5回)。' },
  MelWhip: { name: 'スイーツパラダイス', desc: '使ったターン、メルホイップの攻撃に\n与ダメージ30%の連撃が4回追加される(1ラン3回)。' },
};
const BEAT_TEXT = { name: '必死', desc: 'モンスターノーツを取ると、7秒のあいだ\nGREAT以上の判定がすべてJUST MARVELOUSになる。' };
const APT_LABELS = ['零', '近', '中', '遠'];
const APT_COLORS = { S: '#f472b6', A: '#f59e0b', B: '#22c55e', C: '#38bdf8', D: '#94a3b8', E: '#64748b', F: '#475569', G: '#334155' };

const profileCard = async (id, file, theme) => {
  const mon = ctx.M[id];
  const W = 1760, H = 2480, c = createCanvas(W, H), x = c.getContext('2d');
  let g = x.createLinearGradient(0, 0, 0, H); theme.bg.forEach(([at, col]) => g.addColorStop(at, col));
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const r = x.createRadialGradient(560, 820, 40, 560, 820, 900); r.addColorStop(0, theme.glow); r.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = r; x.fillRect(0, 0, W, H);
  theme.deco(x, W, H);
  sparkles(x, W, 1300, 70, 'rgba(255,255,230,.8)');

  // 見出し
  ribbon(x, W / 2, 110, 640, 104, '新モンスター紹介', 64, theme.ribbon[0], theme.ribbon[1], theme.ribbon[2]);
  x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 24; x.shadowOffsetY = 8; outlined(x, mon.name, W / 2, 285, 170, theme.title[0], theme.title[1], theme.title[2]); x.restore();
  x.save(); x.font = '46px MPB'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const chipW = 150, lineText = theme.lineage, lw = x.measureText(lineText).width, total = chipW + 24 + lw, sx = W / 2 - total / 2;
  x.fillStyle = theme.chipCol; x.beginPath(); x.roundRect(sx, 390, chipW, 70, 35); x.fill(); x.fillStyle = '#fff'; x.fillText(theme.chip, sx + chipW / 2, 426);
  x.textAlign = 'left'; x.fillStyle = theme.sub; x.fillText(lineText, sx + chipW + 24, 426); x.restore();

  // 立ち絵(左)
  await drawMon(x, file, 470, 1200, 820, 700, theme.glow);

  // 能力値(右)
  const px = 930, pw = 770;
  x.save(); x.fillStyle = 'rgba(0,0,0,.42)'; x.beginPath(); x.roundRect(px, 500, pw, 700, 40); x.fill(); x.lineWidth = 4; x.strokeStyle = theme.frame; x.stroke(); x.restore();
  x.save(); x.font = '44px MPB'; x.fillStyle = theme.head; x.textBaseline = 'middle'; x.fillText('能力値', px + 40, 566); x.font = '34px MPM'; x.fillStyle = '#e2e8f0'; x.textAlign = 'right'; x.fillText(theme.type, px + pw - 40, 568); x.restore();
  const stats = [['ライフ', 'baseHp', '#f87171'], ['ガッツ', 'baseGuts', '#fbbf24'], ['ちから', 'baseAtk', '#fb923c'], ['丈夫さ', 'baseDef', '#60a5fa']];
  stats.forEach(([label, key, col], i) => {
    const y = 650 + i * 104, band = bandOf(key), v = Number(mon[key]) || 0, t = Math.max(.06, (v - band.min) / Math.max(1, band.max - band.min));
    x.save(); x.font = '38px MPB'; x.fillStyle = '#f8fafc'; x.textBaseline = 'middle'; x.fillText(label, px + 40, y);
    x.textAlign = 'right'; x.fillText(String(v), px + pw - 40, y); x.restore();
    const bx = px + 200, bw = pw - 380;
    x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.roundRect(bx, y - 16, bw, 32, 16); x.fill();
    const bg2 = x.createLinearGradient(bx, 0, bx + bw, 0); bg2.addColorStop(0, col); bg2.addColorStop(1, '#fff'); x.fillStyle = bg2; x.beginPath(); x.roundRect(bx, y - 16, bw * t, 32, 16); x.fill();
  });
  x.save(); x.font = '38px MPB'; x.fillStyle = theme.head; x.textBaseline = 'middle'; x.fillText('間合い適性', px + 40, 1072); x.restore();
  mon.distAptitude.forEach((rank, i) => {
    const cx = px + 90 + i * 172, cy = 1140;
    x.save(); x.fillStyle = APT_COLORS[rank] || '#475569'; x.beginPath(); x.roundRect(cx - 70, cy - 36, 140, 72, 20); x.fill();
    x.font = '34px MPB'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(`${APT_LABELS[i]} ${rank}`, cx, cy + 2); x.restore();
  });

  // 図鑑のひとこと
  x.save(); x.font = '38px MPM'; x.fillStyle = theme.flavor; x.textAlign = 'center';
  // 図鑑の文は行の切れ目をそのまま使う(つなげると「モンスター普段は」のように読みにくくなる)
  wrap(x, String(ctx.D[id] || ''), W - 240).slice(0, 3).forEach((ln, i) => x.fillText(ln, W / 2, 1296 + i * 50)); x.restore();

  // 技・特性の4枠
  const u = UNIQUE_TEXT(mon);
  const boxes = [
    { tag: '勇者特性', name: TRAIT_TEXT.name, meta: '', desc: TRAIT_TEXT.desc, col: '#16a34a' },
    { tag: '固有技', name: u.name, meta: u.meta, desc: u.desc, col: '#dc2626' },
    { tag: 'タクティクスEX', name: EX_TEXT[id].name, meta: '', desc: EX_TEXT[id].desc, col: '#7c3aed' },
    { tag: 'モンヒロビート', name: BEAT_TEXT.name, meta: '', desc: BEAT_TEXT.desc, col: '#0891b2' },
  ];
  boxes.forEach((b, i) => {
    const y = 1450 + i * 250, bx = 70, bw = W - 140, bh = 226;
    x.save(); x.fillStyle = 'rgba(8,12,24,.72)'; x.beginPath(); x.roundRect(bx, y, bw, bh, 32); x.fill(); x.lineWidth = 4; x.strokeStyle = theme.frame; x.stroke();
    x.fillStyle = b.col; x.beginPath(); x.roundRect(bx + 28, y + 26, 300, 62, 31); x.fill();
    x.font = '34px MPB'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(b.tag, bx + 178, y + 58);
    x.textAlign = 'left'; x.font = '54px MPB'; x.fillStyle = '#fffbe6'; x.fillText(b.name, bx + 360, y + 58);
    if (b.meta) { x.font = '36px MPB'; x.fillStyle = '#fca5a5'; x.textAlign = 'right'; x.fillText(b.meta, bx + bw - 36, y + 60); x.textAlign = 'left'; }
    x.font = '36px MPM'; x.fillStyle = '#e2e8f0'; x.textBaseline = 'alphabetic';
    wrap(x, b.desc, bw - 80).slice(0, 2).forEach((ln, j) => x.fillText(ln, bx + 40, y + 146 + j * 52));
    x.restore();
  });
  x.lineWidth = 14; x.strokeStyle = theme.frame; x.strokeRect(7, 7, W - 14, H - 14);
  await save(c, theme.out, 880, 1240);
};

(async () => {
  await keyVisual();
  await profileCard('Yggdrasil', artPath(ctx.M.Yggdrasil), {
    out: 'yggdrasil-profile.jpg',
    bg: [[0, '#0b2a17'], [.45, '#1f5f2e'], [1, '#0f2414']],
    glow: 'rgba(220,255,170,.7)', frame: '#e7c45a', head: '#d9f99d', sub: '#d9f99d', flavor: '#ecfccb',
    ribbon: ['#fff3b0', '#b87918', '#3d2305'], title: ['#f7ffb8', '#5fbf2a', '#123f18'],
    chip: '純血', chipCol: '#3f9d3a', lineage: 'ユグドラシル × ユグドラシル', type: 'ライフ・丈夫さ型',
    deco: (x, W, H) => { for (let i = 0; i < 22; i++) { const side = i % 2 ? 1 : -1; leaf(x, side < 0 ? rnd() * 200 - 60 : W - rnd() * 200 + 60, rnd() * 1300, 150 + rnd() * 160, (side < 0 ? 0 : Math.PI) + (rnd() - .5) * 1.4, `rgba(${30 + rnd() * 40 | 0},${100 + rnd() * 70 | 0},${30 + rnd() * 30 | 0},${.5 + rnd() * .35})`); } },
  });
  await profileCard('MelWhip', artPath(ctx.M.MelWhip), {
    out: 'mel-whip-profile.jpg',
    bg: [[0, '#4a1d3a'], [.45, '#8a3f63'], [1, '#2a1024']],
    glow: 'rgba(255,230,210,.8)', frame: '#f9c9d9', head: '#fbcfe8', sub: '#fde2ec', flavor: '#fdf2f8',
    ribbon: ['#fff1f5', '#e889a8', '#5b1633'], title: ['#fff5f8', '#f472b6', '#5b1633'],
    chip: 'レア', chipCol: '#c7862a', lineage: 'ユグドラシル × ？？？', type: '中距離が得意',
    deco: (x, W, H) => { for (let i = 0; i < 46; i++) { const col = ['rgba(255,120,150,.55)', 'rgba(255,255,255,.6)', 'rgba(120,110,230,.4)', 'rgba(255,200,120,.5)'][i % 4]; x.fillStyle = col; x.beginPath(); x.arc(rnd() * W, rnd() * 1300, 6 + rnd() * 12, 0, 7); x.fill(); } },
  });
})();
