// 新コンテンツ「MFバトルカード」近日公開の告知画像を、スターターキット3つのモンスターのカードから作る(2026-10-25 社長
// 「お知らせで新コンテンツのお知らせを出して、近日公開みたいな感じでホームに出して」)。
//
//   node image/make-card-battle-teaser-notice.js <太字フォントのパス>
//
// 書き出すのは monster-hero/images/events/card-battle-teaser.jpg(880x880・JPEG quality 80・mozjpeg)。
// 更新履歴の image に使う(お知らせの詳細と、助手の一度きりの告知の両方に出る)。
// 作りはほかの予告(make-illumine-dreamy-lineage-notice.js)と同じ: 上に金のリボン・大見出し・まんなかに絵・下の帯・外枠。
// 1760pxで描いてから半分へ縮めるので、文字のふちがなめらかになる。
//
// フォントは「M PLUS Rounded 1c」の ExtraBold(800)。Google Fonts から一時的に取ってきて使い、リポジトリには入れない。
// カードの絵は、ゲームに入っているもの(monster-hero/images/card-battle/l/)をそのまま使う。スターターの顔ぶれは data/card-battle-cards.js の starters。
const path = require('path');
const vm = require('vm');
const { createCanvas, loadImage, registerFont } = require('canvas');
const sharp = require('sharp');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const FONT = process.argv[2];
if (!FONT || !fs.existsSync(FONT)) { console.log('使い方: node image/make-card-battle-teaser-notice.js <太字フォントのパス>'); process.exit(1); }
registerFont(FONT, { family: 'MPR' });
const OUT = path.join(ROOT, 'monster-hero', 'images', 'events', 'card-battle-teaser.jpg');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero/data/card-battle-cards.js'), 'utf8')};this.D=CARD_BATTLE_DATA;`, ctx);
const D = ctx.D;
// 左から 先手必勝スピードチーム / 一撃必殺パワフルチーム / 一発逆転ミラクルチーム(箱の色: 青・赤・黄)
const KITS = [['speed', '#2f7fe0'], ['powerful', '#d9433a'], ['miracle', '#e0a420']];
const W = 1760, H = 1760;
const c = createCanvas(W, H), x = c.getContext('2d');
let seed = 20261025; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
(async () => {
  // 背景: 対戦の盤と同じ、深い紫からまんなかが明るい
  let g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0d0a1f'); g.addColorStop(.45, '#2b1f5a'); g.addColorStop(.8, '#1b1438'); g.addColorStop(1, '#0d0a1f');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const r = x.createRadialGradient(W / 2, 980, 60, W / 2, 980, 980);
  r.addColorStop(0, 'rgba(120,90,230,.55)'); r.addColorStop(.5, 'rgba(70,50,160,.2)'); r.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = r; x.fillRect(0, 0, W, H);
  // 光の粒
  for (let i = 0; i < 140; i++) { const px = rnd() * W, py = rnd() * H, pr = 1 + rnd() * 4; x.fillStyle = `rgba(255,${200 + Math.floor(rnd() * 55)},255,${.2 + rnd() * .5})`; x.beginPath(); x.arc(px, py, pr, 0, 7); x.fill(); }

  // 上のリボン(金の板は文字の長さに合わせて伸ばす。ほかの予告と同じ)
  const ribbon = (cy, w, h, text, size) => {
    x.save(); x.translate(W / 2, cy);
    x.font = `${size}px MPR`; const tm = x.measureText(text); w = Math.max(w, Math.ceil(tm.width + size * 1.2));
    x.fillStyle = '#7a4a12'; x.beginPath(); x.moveTo(-w / 2 - 70, -h / 2 + 18); x.lineTo(-w / 2 + 10, -h / 2 + 18); x.lineTo(-w / 2 + 10, h / 2 + 18); x.lineTo(-w / 2 - 70, h / 2 + 18); x.lineTo(-w / 2 - 40, 18); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(w / 2 + 70, -h / 2 + 18); x.lineTo(w / 2 - 10, -h / 2 + 18); x.lineTo(w / 2 - 10, h / 2 + 18); x.lineTo(w / 2 + 70, h / 2 + 18); x.lineTo(w / 2 + 40, 18); x.closePath(); x.fill();
    const rg = x.createLinearGradient(0, -h / 2, 0, h / 2); rg.addColorStop(0, '#fff3b0'); rg.addColorStop(.5, '#e7b43a'); rg.addColorStop(1, '#b87918');
    x.fillStyle = rg; x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, 22); x.fill(); x.lineWidth = 6; x.strokeStyle = '#fff8d6'; x.stroke();
    x.font = `${size}px MPR`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#3d2305'; x.fillText(text, 0, (tm.actualBoundingBoxAscent - tm.actualBoundingBoxDescent) / 2); x.restore();
  };
  ribbon(150, 720, 120, '新コンテンツ 近日公開', 78);

  // 大見出し
  const title = (text, cy, size, from, to, stroke) => {
    x.save(); x.font = `${size}px MPR`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = size * .22; x.strokeStyle = stroke; x.strokeText(text, W / 2, cy);
    x.lineWidth = size * .09; x.strokeStyle = '#fffbe6'; x.strokeText(text, W / 2, cy);
    const tg = x.createLinearGradient(0, cy - size / 2, 0, cy + size / 2); tg.addColorStop(0, from); tg.addColorStop(1, to); x.fillStyle = tg; x.fillText(text, W / 2, cy); x.restore();
  };
  x.save(); x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 30; x.shadowOffsetY = 10; title('MFバトルカード', 345, 176, '#e0f2ff', '#7dd3fc', '#14104a'); x.restore();
  x.save(); x.font = '62px MPR'; x.textAlign = 'center'; x.fillStyle = '#fffde8'; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 14; x.fillText('助手たちと、カードで対戦！', W / 2, 520); x.restore();

  // スターターキット3つ: モンスターのカード3枚を扇に開く
  const cardW = 262, cardH = Math.round(cardW * 672 / 480);
  for (let k = 0; k < KITS.length; k++) {
    const [id, col] = KITS[k];
    const kit = D.starters[id];
    const cx = W * (0.19 + k * 0.31), base = 1200;
    // 箱の色の光
    const gl = x.createRadialGradient(cx, base - 220, 20, cx, base - 220, 420); gl.addColorStop(0, `${col}aa`); gl.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gl; x.beginPath(); x.arc(cx, base - 220, 420, 0, 7); x.fill();
    for (let i = 0; i < 3; i++) {
      const no = kit.monsters[i];
      const im = await loadImage(path.join(ROOT, 'monster-hero/images/card-battle/l', `${D.monsters[no].img}.jpg`));
      const ang = (i - 1) * 0.2;
      x.save(); x.translate(cx + (i - 1) * 100, base - (i === 1 ? 30 : 0)); x.rotate(ang);
      x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 26; x.shadowOffsetY = 12;
      x.fillStyle = '#fff'; x.beginPath(); x.roundRect(-cardW / 2 - 8, -cardH - 8, cardW + 16, cardH + 16, 18); x.fill();
      x.shadowColor = 'transparent';
      x.save(); x.beginPath(); x.roundRect(-cardW / 2, -cardH, cardW, cardH, 12); x.clip(); x.drawImage(im, -cardW / 2, -cardH, cardW, cardH); x.restore();
      x.restore();
    }
    // キットの名札
    const name = kit.name;
    x.save(); const pw = 500, ph = 120, py = base + 110;
    x.fillStyle = 'rgba(16,12,40,.9)'; x.beginPath(); x.roundRect(cx - pw / 2, py - ph / 2, pw, ph, 30); x.fill(); x.lineWidth = 6; x.strokeStyle = col; x.stroke();
    x.font = '44px MPR'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fffbe0';
    const half = Math.ceil([...name].length / 2);
    // 「先手必勝 / スピードチーム」のように、四字熟語とチーム名で2行にする
    const head = name.match(/^(.{4})(.+)$/);
    const l1 = head ? head[1] : [...name].slice(0, half).join(''), l2 = head ? head[2] : [...name].slice(half).join('');
    x.fillText(l1, cx, py - 26); x.font = '40px MPR'; x.fillStyle = '#ffe6d2'; x.fillText(l2, cx, py + 26); x.restore();
  }

  // 下の帯
  const bg = x.createLinearGradient(0, 1500, 0, H); bg.addColorStop(0, 'rgba(20,14,48,0)'); bg.addColorStop(.3, 'rgba(18,12,44,.92)'); bg.addColorStop(1, 'rgba(10,8,28,.96)'); x.fillStyle = bg; x.fillRect(0, 1500, W, H - 1500);
  x.save(); x.font = '72px MPR'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = 16; x.strokeStyle = '#1a1050';
  const msg = 'スターターキットを選んで、はじめよう';
  x.strokeText(msg, W / 2, 1630);
  const bt = x.createLinearGradient(0, 1590, 0, 1670); bt.addColorStop(0, '#fff6c2'); bt.addColorStop(1, '#f0b93a'); x.fillStyle = bt; x.fillText(msg, W / 2, 1630); x.restore();
  // 外枠
  x.lineWidth = 14; x.strokeStyle = '#e7c45a'; x.strokeRect(7, 7, W - 14, H - 14);
  const info = await sharp(c.toBuffer('image/png')).resize(880, 880).jpeg({ quality: 80, mozjpeg: true }).toFile(OUT);
  console.log(`書き出しました: ${path.relative(ROOT, OUT)} (${Math.round(info.size / 1024)}KB)`);
})();
