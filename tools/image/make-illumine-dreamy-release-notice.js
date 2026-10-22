// イルミネ・ドリーミィの公開のお知らせ画像を作る(2026-10-23 正式実装・新しい助手きゅうこのお話と同時)。
// メロディー・クロミーの公開(make-melody-kuromy-release-notice.js)を写して、色と飾りを月夜(紫・ラベンダー・三日月・星・雲)にした。
//
//   node image/make-illumine-dreamy-release-notice.js <太字フォントのパス> [ふつうの太さのフォントのパス]
//
// 書き出すのは monster-hero/images/events/ の3枚(どれも JPEG quality 80・mozjpeg)。
//   illumine-dreamy-release-notice.jpg … 880x880。更新履歴の image(お知らせの詳細と助手の告知の両方に出る)
//   illumine-profile.jpg               … 880x1240。イルミネの紹介カード(更新履歴の gallery)
//   dreamy-profile.jpg                 … 880x1240。ドリーミィの紹介カード(同上)
// 紹介カードの数字(能力値・間合い適性・固有技の倍率と消費ガッツ)は data/ally-monsters.js から読む。
// フォントは「M PLUS Rounded 1c」。Google Fonts から一時的に取ってきて使い、リポジトリには入れない。
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { createCanvas, loadImage, registerFont } = require('canvas');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', '..');
const BOLD = process.argv[2];
const MEDIUM = process.argv[3] || BOLD;
if (!BOLD || !fs.existsSync(BOLD)) { console.log('使い方: node image/make-illumine-dreamy-release-notice.js <太字フォントのパス> [ふつうの太さのフォントのパス]'); process.exit(1); }
registerFont(BOLD, { family: 'MPB' });
registerFont(MEDIUM, { family: 'MPM' });
const OUT_DIR = path.join(ROOT, 'monster-hero', 'images', 'events');

// 数字はゲームのデータから読む
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero/data/images/images-ally.js'), 'utf8')}\n${fs.readFileSync(path.join(ROOT, 'monster-hero/data/ally-monsters.js'), 'utf8')}\n${fs.readFileSync(path.join(ROOT, 'monster-hero/data/lineages.js'), 'utf8')}\nglobalThis.M=ALL_PLAYER_MONSTERS;globalThis.D=MONSTER_DEX_DESCRIPTIONS;`, ctx);
const ALL = Object.values(ctx.M);
const bandOf = (key) => { const v = ALL.map(m => Number(m[key]) || 0); return { min: Math.min(...v), max: Math.max(...v) }; };

let seed = 20261023;
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
// 音符(八分音符)。玉と棒と旗
const note = (x, cx, cy, s, col) => {
  x.save(); x.translate(cx, cy); x.scale(s, s); x.fillStyle = col; x.strokeStyle = col; x.lineWidth = 6;
  x.beginPath(); x.ellipse(0, 0, 16, 12, -.4, 0, 7); x.fill();
  x.beginPath(); x.moveTo(13, -4); x.lineTo(13, -58); x.stroke();
  x.beginPath(); x.moveTo(13, -58); x.quadraticCurveTo(34, -46, 30, -24); x.quadraticCurveTo(26, -38, 13, -40); x.fill(); x.restore();
};
// ハート
const heart = (x, cx, cy, r, col, a = 1) => {
  x.save(); x.globalAlpha = a; x.translate(cx, cy); x.fillStyle = col; x.beginPath();
  x.moveTo(0, r * .35); x.bezierCurveTo(-r * 1.1, -r * .45, -r * .45, -r * 1.2, 0, -r * .5); x.bezierCurveTo(r * .45, -r * 1.2, r * 1.1, -r * .45, 0, r * .35); x.fill(); x.restore();
};
// 三日月
const crescent = (x, cx, cy, r, col, a = 1) => {
  // 外の丸で切り抜いてから、2つの丸を偶奇で塗る(重なったところが欠ける。背景は消さない)
  x.save(); x.globalAlpha = a; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.moveTo(cx + r * .42 + r * .9, cy - r * .2); x.arc(cx + r * .42, cy - r * .2, r * .9, 0, Math.PI * 2);
  x.fillStyle = col; x.fill('evenodd'); x.restore();
};
// 雲(ドリーミィのふわふわ)
const cloud = (x, cx, cy, s, col) => {
  x.save(); x.fillStyle = col; [[0, 0, 1], [-.9, .2, .7], [.9, .2, .72], [-.4, -.45, .75], [.45, -.4, .7]].forEach(([dx, dy, rr]) => { x.beginPath(); x.arc(cx + dx * s, cy + dy * s, rr * s, 0, 7); x.fill(); }); x.restore();
};
const sparkles = (x, W, H, n, col) => {
  x.save(); x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const px = rnd() * W, py = rnd() * H, pr = 2 + rnd() * 6; const g = x.createRadialGradient(px, py, 0, px, py, pr * 3); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, pr * 3, 0, 7); x.fill(); }
  x.restore();
};
// 板は文字の長さに合わせて伸ばし(左右の余白は字の大きさの0.6倍ずつ)、文字は字の形の上下の中心を板の中心にそろえる
// (2026-10-22 社長「文字の位置というか後ろのやつずれてない？」。前に出した絵は作り直していない)
const ribbon = (x, cx, cy, w, h, text, size, from = '#fff3b0', to = '#b87918', ink = '#3d2305') => {
  x.save(); x.translate(cx, cy);
  x.font = `${size}px MPB`; const tm = x.measureText(text); w = Math.max(w, Math.ceil(tm.width + size * 1.2));
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.roundRect(-w / 2 + 6, -h / 2 + 12, w, h, 24); x.fill();
  const g = x.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, from); g.addColorStop(1, to);
  x.fillStyle = g; x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, 24); x.fill(); x.lineWidth = 6; x.strokeStyle = '#fff8d6'; x.stroke();
  x.font = `${size}px MPB`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = ink; x.fillText(text, 0, (tm.actualBoundingBoxAscent - tm.actualBoundingBoxDescent) / 2); x.restore();
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
  g.addColorStop(0, '#120a2e'); g.addColorStop(.5, '#3b2470'); g.addColorStop(1, '#100826');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // 左はイルミネの夜の紫、右はドリーミィのパステル
  const lg = x.createLinearGradient(0, 0, W, 0); lg.addColorStop(0, 'rgba(76,29,149,.5)'); lg.addColorStop(.5, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(244,182,232,.35)');
  x.fillStyle = lg; x.fillRect(0, 0, W, H);
  const r = x.createRadialGradient(W / 2, 700, 40, W / 2, 700, 1100); r.addColorStop(0, 'rgba(226,214,255,.7)'); r.addColorStop(.4, 'rgba(167,139,250,.28)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = r; x.fillRect(0, 0, W, H);
  crescent(x, 260, 640, 190, '#fff6d6', .9);
  for (let i = 0; i < 9; i++) cloud(x, W * .55 + rnd() * W * .45, 900 + rnd() * 600, 60 + rnd() * 50, `rgba(255,240,252,${.35 + rnd() * .3})`);
  sparkles(x, W, H, 160, 'rgba(240,235,255,.9)');

  ribbon(x, W / 2, 140, 760, 118, '新モンスター 登場！', 76);
  x.save(); x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 30; x.shadowOffsetY = 10; outlined(x, 'イルミネ & ドリーミィ', W / 2, 318, 150, '#f5f0ff', '#a78bfa', '#1e0b4a'); x.restore();
  x.save(); x.font = '58px MPB'; x.textAlign = 'center'; x.fillStyle = '#fffde8'; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 14; x.fillText('月夜と夢の雲から、新しい血統のふたりが登場', W / 2, 482); x.restore();

  await drawMon(x, artPath(ctx.M.Illumine), W * .285, 1370, 680, 840, 'rgba(196,181,253,.75)');
  await drawMon(x, artPath(ctx.M.Dreamy), W * .715, 1370, 700, 830, 'rgba(255,214,245,.8)');
  const plate = (cx, cy, name, chip, chipCol, sub) => {
    x.save(); const w = 700, h = 150;
    x.fillStyle = 'rgba(22,12,52,.88)'; x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, 36); x.fill(); x.lineWidth = 6; x.strokeStyle = '#c4b5fd'; x.stroke();
    x.font = '62px MPB'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fffbe0'; x.fillText(name, cx + 82, cy - 20);
    x.fillStyle = chipCol; x.beginPath(); x.roundRect(cx - w / 2 + 26, cy - 52, 136, 64, 32); x.fill(); x.font = '42px MPB'; x.fillStyle = '#fff'; x.fillText(chip, cx - w / 2 + 94, cy - 19);
    x.font = '36px MPB'; x.fillStyle = '#ede9fe'; x.fillText(sub, cx, cy + 44); x.restore();
  };
  plate(W * .285, 1452, 'イルミネ', '純血', '#6d28d9', '楔を重ねて連撃で攻める');
  plate(W * .715, 1452, 'ドリーミィ', '派生', '#db2777', '夢の雲で味方を守る');

  const bg = x.createLinearGradient(0, 1540, 0, H); bg.addColorStop(0, 'rgba(30,14,70,0)'); bg.addColorStop(.22, 'rgba(26,12,60,.92)'); bg.addColorStop(1, 'rgba(14,6,34,.96)');
  x.fillStyle = bg; x.fillRect(0, 1540, W, H - 1540);
  x.save(); x.font = '78px MPB'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = 16; x.strokeStyle = '#2e1065';
  const msg = 'ダイヤショップで販売スタート！'; x.strokeText(msg, W / 2, 1640);
  const bt = x.createLinearGradient(0, 1600, 0, 1680); bt.addColorStop(0, '#fff6c2'); bt.addColorStop(1, '#f0b93a'); x.fillStyle = bt; x.fillText(msg, W / 2, 1640); x.restore();
  x.save(); x.font = '42px MPB'; x.textAlign = 'center'; x.fillStyle = '#ede9fe'; x.fillText('円盤石 各150,000ダイヤ', W / 2, 1726); x.restore();
  x.lineWidth = 14; x.strokeStyle = '#c4b5fd'; x.strokeRect(7, 7, W - 14, H - 14);
  await save(c, 'illumine-dreamy-release-notice.jpg', 880, 880);
};

// ---- 2・3枚目: 紹介カード(880x1240) ----
const KAGESEN = { name: '影潜', desc: '攻撃が当たるたびに敵へ楔+1(最大6)。楔1つごとに与ダメ15%の\n連撃1回・回避率+15%。自分が回避すると楔は0に戻る。' };
const TRAIT_TEXT = { Illumine: KAGESEN, Dreamy: KAGESEN };
const UNIQUE_DESC = {
  Illumine: 'セレーネチェイサー：与ダメ5%の連撃と連撃ダメ+1%が\nずっと重なる。どちらも(楔の数+1)倍。',
  Dreamy: 'ドリームペイン：次のターンから3ターン、敵の被ダメ+20%。\n楔1つごとにさらに+20%(楔6つで+140%)。',
};
const UNIQUE_TEXT = (mon) => ({
  name: `${mon.unique.name}`,
  meta: `×${mon.unique.baseMult}　消費ガッツ ${mon.unique.baseGuts}`,
  desc: UNIQUE_DESC[mon.id],
});
const EX_TEXT = {
  Illumine: { name: 'ジエンド', desc: '3ターン、楔が1回で2つ付き、上限12。\n使った瞬間にヘイト−30(1ラン5回)。' },
  Dreamy: { name: 'ミルフィーシールド', desc: '味方全員に最大ライフぶんのシールド(3ターン)。シールドのある子は\n全ステータス+5%＋楔1つごとに+5%(1ラン5回)。' },
};
const BEAT_TEXTS = {
  Illumine: { name: '我慢', desc: 'モンスターノーツを取ると、15秒のあいだ\nBAD・MISSで減るライフが半分になる。' },
  Dreamy: { name: '必死', desc: 'モンスターノーツを取ると、7秒のあいだ\nGREAT・EXCELLENTの判定がMARVELOUSになる。' },
};
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
    { tag: '勇者特性', name: TRAIT_TEXT[id].name, meta: '', desc: TRAIT_TEXT[id].desc, col: '#6d28d9' },
    { tag: '固有技', name: u.name, meta: u.meta, desc: u.desc, col: '#dc2626' },
    { tag: 'タクティクスEX', name: EX_TEXT[id].name, meta: '', desc: EX_TEXT[id].desc, col: '#7c3aed' },
    { tag: 'モンヒロビート', name: BEAT_TEXTS[id].name, meta: '', desc: BEAT_TEXTS[id].desc, col: '#0891b2' },
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
  await profileCard('Illumine', artPath(ctx.M.Illumine), {
    out: 'illumine-profile.jpg',
    bg: [[0, '#0f0a2a'], [.45, '#3b2470'], [1, '#0a0620']],
    glow: 'rgba(196,181,253,.7)', frame: '#c4b5fd', head: '#ddd6fe', sub: '#ede9fe', flavor: '#f5f3ff',
    ribbon: ['#f5f3ff', '#a78bfa', '#1e0b4a'], title: ['#f5f3ff', '#a78bfa', '#1e0b4a'],
    chip: '純血', chipCol: '#6d28d9', lineage: 'イルミネ × イルミネ', type: '中距離が得意・攻め役',
    deco: (x, W, H) => { crescent(x, W - 240, 240, 130, '#fff6d6', .8); for (let i = 0; i < 18; i++) sparkles(x, W, 1300, 4, 'rgba(255,246,214,.9)'); },
  });
  await profileCard('Dreamy', artPath(ctx.M.Dreamy), {
    out: 'dreamy-profile.jpg',
    bg: [[0, '#2a1846'], [.45, '#8a5ab8'], [1, '#1e1236']],
    glow: 'rgba(255,214,245,.75)', frame: '#f5c2e7', head: '#fbcfe8', sub: '#fdf2f8', flavor: '#fff1f8',
    ribbon: ['#fff1f8', '#f0a6d8', '#4a0a35'], title: ['#fff1f8', '#f0a6d8', '#4a0a35'],
    chip: '派生', chipCol: '#db2777', lineage: 'イルミネ × ニャー', type: '遠い間合いが得意・支え役',
    // 雲は能力値の枠(右)へ重ねない
    deco: (x, W, H) => { for (let i = 0; i < 10; i++) cloud(x, rnd() * 820, rnd() < .5 ? rnd() * 380 : 500 + rnd() * 760, 40 + rnd() * 40, 'rgba(255,240,252,.35)'); for (let i = 0; i < 8; i++) heart(x, rnd() * W, rnd() * 1300, 24 + rnd() * 20, '#f9a8d4', .45); },
  });
})();
