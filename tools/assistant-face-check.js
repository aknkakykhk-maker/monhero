// 助手の顔アイコンが「顔が真ん中」に切り出せているかを見る。
//
// 顔アイコンは丸く切って使う場所が多い(吹き出し・マーケット・プロフィール)。
// 元絵はうさ耳や髪が高く伸びているため、キャラの上端から機械的に正方形を切ると
// 耳が枠の真ん中に来て顔が下へ押し出され、丸くしたときに顔が中心から外れる。
// 実際にその状態で公開してしまったので、ここで数値として見張る。
//
//   node tools/assistant-face-check.js
//
// 見ているものは2種類ある。
//
//   ① 頭のシルエット(全助手に共通)
//      白背景を除いた「キャラそのもの」の重心と占有率。髪型や肌の見え方に
//      左右されないので、助手が増えても同じしきい値で使える。
//      切り出しが上下左右へずれると、まっさきにここが動く。
//
//   ② 肌色の位置(助手ごと)
//      顔がどこにあるかを直接見られるが、前髪で額が隠れるかどうかで
//      「見えている肌の量と位置」が大きく変わる。みゅあは額が出ていて
//      顔の中心に肌が集まるが、ききは前髪が額を覆うため肌は頬から下に偏る。
//      そのため助手ごとに実測値(目視で確認済みの切り出し)を基準として持つ。
//      しきい値を緩めるためではなく、その助手の切り出しが動いたら気づくための基準。
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

// ---- ① 頭のシルエット(全助手に共通のしきい値) ----
// 実測: みゅあ 重心x 45〜50% y 53〜55% 占有 63〜70% ／ きき 重心x 48〜49% y 57〜58% 占有 74〜79%
const HEAD_X_RANGE = [0.42, 0.58];
const HEAD_Y_RANGE = [0.48, 0.62];
const HEAD_FILL_MIN = 0.55;      // 枠が頭で埋まっている割合(小さいと背景ばかり写している)
const isBackdrop = (r, g, b) => r > 235 && g > 235 && b > 235;  // ほぼ白は背景とみなす

// ---- ② 肌色の位置(助手ごとの基準) ----
// みゅあの値は今までどおり(直す前は 肌色率 54〜64% / 重心 x 41〜43% ・ y 55〜59% で落ちていた)。
// ききは前髪で額が隠れるため、同じ切り出しでも肌色率が低く・重心が下に出る。
// どちらも実際の顔アイコンを目視で確認したうえでの基準値。
const SKIN_RULES = {
  mua:  { centerMin: 0.70, x: [0.44, 0.56], y: [0.45, 0.58] },
  kiki: { centerMin: 0.10, x: [0.50, 0.66], y: [0.66, 0.80] },
};
const SKIN_FALLBACK = { centerMin: 0.10, x: [0.35, 0.65], y: [0.40, 0.80] };
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
  let hx = 0, hy = 0, head = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const skin = isSkin(d[i], d[i + 1], d[i + 2], d[i + 3]);
      if (x >= x0 && x < x1 && y >= y0 && y < y1) { total++; if (skin) hit++; }
      if (skin) { sx += x; sy += y; count++; }
      // 頭のシルエット。透明でも白でもない画素を「キャラそのもの」とみなす
      if (d[i + 3] >= 128 && !isBackdrop(d[i], d[i + 1], d[i + 2])) { hx += x; hy += y; head++; }
    }
  }
  return {
    W, H,
    center: total ? hit / total : 0,
    cx: count ? sx / count / W : 0.5,
    cy: count ? sy / count / H : 0.5,
    headCx: head ? hx / head / W : 0.5,
    headCy: head ? hy / head / H : 0.5,
    headFill: head / (W * H),
  };
};

const run = async () => {
  check('助手が1人以上いる', Array.isArray(ASSISTANTS) && ASSISTANTS.length >= 1);
  if (!ASSISTANTS.length) { process.exit(1); }
  check('みゅあの定義がある', ASSISTANTS.some(a => a.id === 'mua'));
  check('ききの定義がある', ASSISTANTS.some(a => a.id === 'kiki'));

  const pct = (v) => `${(v * 100).toFixed(0)}%`;
  const sizes = new Set();
  // 助手ごとに見る。1人でも顔が中心から外れていれば、その助手の名前つきで落とす
  for (const who of ASSISTANTS) {
    console.log(`\n[${who.name}]`);
    const skinRule = SKIN_RULES[who.id] || SKIN_FALLBACK;
    const bad = { center: [], x: [], y: [], headX: [], headY: [], fill: [] };
    let measured = 0;
    for (const e of ASSISTANT_EXPRESSIONS) {
      const rel = assistantFaceImage(who, e);
      const file = path.join(web, rel);
      if (!fs.existsSync(file)) { check(`${who.name}: ${e} の顔アイコンがある`, false, rel); continue; }
      const m = await measure(file);
      measured++;
      sizes.add(`${m.W}x${m.H}`);
      if (m.center < skinRule.centerMin) bad.center.push(`${e}=${pct(m.center)}`);
      if (m.cx < skinRule.x[0] || m.cx > skinRule.x[1]) bad.x.push(`${e}=${pct(m.cx)}`);
      if (m.cy < skinRule.y[0] || m.cy > skinRule.y[1]) bad.y.push(`${e}=${pct(m.cy)}`);
      if (m.headCx < HEAD_X_RANGE[0] || m.headCx > HEAD_X_RANGE[1]) bad.headX.push(`${e}=${pct(m.headCx)}`);
      if (m.headCy < HEAD_Y_RANGE[0] || m.headCy > HEAD_Y_RANGE[1]) bad.headY.push(`${e}=${pct(m.headCy)}`);
      if (m.headFill < HEAD_FILL_MIN) bad.fill.push(`${e}=${pct(m.headFill)}`);
      console.log(`   ${e.padEnd(9)} 頭の重心 x ${pct(m.headCx)} y ${pct(m.headCy)} 占有 ${pct(m.headFill)}`
        + ` ／ 肌 中心 ${pct(m.center)} 重心 x ${pct(m.cx)} y ${pct(m.cy)}`);
    }
    check(`${who.name}: 表情が8種そろっている`, measured === ASSISTANT_EXPRESSIONS.length, `${measured}種`);
    // ①全助手に共通の見張り
    check(`${who.name}: 頭が左右に寄っていない`, bad.headX.length === 0, bad.headX.join(', '));
    check(`${who.name}: 頭が上下に寄っていない`, bad.headY.length === 0, bad.headY.join(', '));
    check(`${who.name}: 枠が頭で埋まっている`, bad.fill.length === 0, bad.fill.join(', '));
    // ②その助手ごとの基準
    check(`${who.name}: 真ん中に顔がある(肌色)`, bad.center.length === 0, bad.center.join(', '));
    check(`${who.name}: 顔が左右に寄っていない(肌色)`, bad.x.length === 0, bad.x.join(', '));
    check(`${who.name}: 顔が上下に寄っていない(肌色)`, bad.y.length === 0, bad.y.join(', '));
  }
  // 助手を増やしたときに基準の追加を忘れないようにする(忘れると緩い既定値で通ってしまう)
  const missingRules = ASSISTANTS.filter(a => !SKIN_RULES[a.id]).map(a => a.id);
  check('助手ごとの肌色の基準がそろっている', missingRules.length === 0, missingRules.join(', '));
  console.log('');
  check('顔アイコンは正方形でそろっている', sizes.size === 1, [...sizes].join(', '));
  // 助手を増やしたとき、ツール側を書き換えなくても顔が作られること
  const facesTool = fs.readFileSync(path.join(root, 'tools/make-assistant-faces.js'), 'utf8');
  check('顔アイコンの作成は助手一覧から対象を決めている',
    facesTool.includes('const assistantPrefixes = ()') && facesTool.includes('ASSISTANTS.map(a => a.imagePrefix)'));
  // 切り出しの設定がツール側に残っているか(数字を直接いじって戻せなくならないように)
  const tool = fs.readFileSync(path.join(root, 'tools/make-assistant-faces.js'), 'utf8');
  check('切り出しの位置を決める設定がツールにある',
    tool.includes('const HEAD_TOP_SKIP =') && tool.includes('const HEAD_RATIO ='));
  check('横の中心は顔の高さで決めている', tool.includes('const headCenterX = (ctx, w, top, side)'));

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });
