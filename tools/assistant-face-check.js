// 助手(みゅあ)の顔アイコンが「顔が真ん中」に切り出せているかを見る。
//
// 顔アイコンは丸く切って使う場所が多い(吹き出し・マーケット・プロフィール)。
// 元絵はうさ耳が高く伸びているため、キャラの上端から機械的に正方形を切ると
// 耳が枠の真ん中に来て顔が下へ押し出され、丸くしたときに顔が中心から外れる。
// 実際にその状態で公開してしまったので、ここで数値として見張る。
//
//   node tools/assistant-face-check.js
//
// 見ているのは肌色の画素の位置。
//   ・画像の真ん中あたり(中心40%)が、ちゃんと顔で埋まっているか
//   ・肌色の重心が、縦横とも画像の中心付近にあるか
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createCanvas, loadImage } = require('canvas');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'monster-hero');
const assistantsSrc = fs.readFileSync(path.join(web, 'data/assistants.js'), 'utf8');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nglobalThis.__a={ASSISTANTS,ASSISTANT_EXPRESSIONS,assistantFaceImage};`, ctx);
const { ASSISTANTS, ASSISTANT_EXPRESSIONS, assistantFaceImage } = ctx.__a;

// しきい値。実際の値は 中心の肌色率 74〜84% / 重心 x 45〜50% ・ y 52〜55% で、
// 直す前は 肌色率 54〜64% / 重心 x 41〜43% ・ y 55〜59% だった
const CENTER_SKIN_MIN = 0.70;   // 中心40%の枠が顔で埋まっている割合
const CENTER_X_RANGE = [0.44, 0.56];
const CENTER_Y_RANGE = [0.45, 0.58];
// 肌色とみなす色。アニメ調の肌は赤みが強く、青が少し低い
const isSkin = (r, g, b, a) => a > 128 && r > 200 && g > 160 && b > 140 && r > b + 10 && r - b < 90;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const measure = async (file) => {
  const img = await loadImage(file);
  const W = img.width, H = img.height;
  const cv = createCanvas(W, H);
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, W, H).data;
  const x0 = Math.round(W * 0.3), x1 = Math.round(W * 0.7);
  const y0 = Math.round(H * 0.3), y1 = Math.round(H * 0.7);
  let hit = 0, total = 0, sx = 0, sy = 0, count = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const skin = isSkin(d[i], d[i + 1], d[i + 2], d[i + 3]);
      if (x >= x0 && x < x1 && y >= y0 && y < y1) { total++; if (skin) hit++; }
      if (skin) { sx += x; sy += y; count++; }
    }
  }
  return { W, H, center: total ? hit / total : 0, cx: count ? sx / count / W : 0.5, cy: count ? sy / count / H : 0.5 };
};

const run = async () => {
  const who = ASSISTANTS.find(a => a.id === 'mua');
  check('みゅあの定義がある', !!who);
  if (!who) { process.exit(1); }

  const pct = (v) => `${(v * 100).toFixed(0)}%`;
  const bad = { center: [], x: [], y: [] };
  const sizes = new Set();
  for (const e of ASSISTANT_EXPRESSIONS) {
    const rel = assistantFaceImage(who, e);
    const file = path.join(web, rel);
    if (!fs.existsSync(file)) { check(`${e} の顔アイコンがある`, false, rel); continue; }
    const m = await measure(file);
    sizes.add(`${m.W}x${m.H}`);
    const okCenter = m.center >= CENTER_SKIN_MIN;
    const okX = m.cx >= CENTER_X_RANGE[0] && m.cx <= CENTER_X_RANGE[1];
    const okY = m.cy >= CENTER_Y_RANGE[0] && m.cy <= CENTER_Y_RANGE[1];
    if (!okCenter) bad.center.push(`${e}=${pct(m.center)}`);
    if (!okX) bad.x.push(`${e}=${pct(m.cx)}`);
    if (!okY) bad.y.push(`${e}=${pct(m.cy)}`);
    console.log(`   ${e.padEnd(9)} 中心の顔 ${pct(m.center)} ／ 顔の重心 x ${pct(m.cx)} y ${pct(m.cy)}`);
  }
  check('どの表情も真ん中が顔で埋まっている', bad.center.length === 0, bad.center.join(', '));
  check('顔が左右に寄っていない', bad.x.length === 0, bad.x.join(', '));
  check('顔が上下に寄っていない', bad.y.length === 0, bad.y.join(', '));
  check('顔アイコンは正方形でそろっている', sizes.size === 1, [...sizes].join(', '));
  // 切り出しの設定がツール側に残っているか(数字を直接いじって戻せなくならないように)
  const tool = fs.readFileSync(path.join(root, 'tools/make-assistant-faces.js'), 'utf8');
  check('切り出しの位置を決める設定がツールにある',
    tool.includes('const HEAD_TOP_SKIP =') && tool.includes('const HEAD_RATIO ='));
  check('横の中心は顔の高さで決めている', tool.includes('const headCenterX = (ctx, w, top, side)'));

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
