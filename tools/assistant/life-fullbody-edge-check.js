#!/usr/bin/env node
// 助手の全身画(monster-hero/images/assistant/fullbody/*.png)の、ふちの透過が2値(ギザギザ)に戻っていないかを見る検査(助手部ナカヨシ)。
//   経緯: 2026-11-12 社長「昨日言った助手の全身画の透過の荒さ直ってないね」。前の作りはふちのアルファを 0/255 近くへ寄せ、
//   256 色に減らすときも半透明の段が荒れていた(カードマスターの8表情は完全に 0/255)。暗い背景に置くと、髪・羽・服の外側がギザギザに見える。
//   見方: となり合う画素でアルファが変わる所のうち、一気に 200 より大きく跳ぶ所の割合(段の硬さ)。なめらかなふちは 0.04 以下、
//   2値のふちは 1.0、前の作りは 0.06〜0.17 だった。あわせて、ふちの画素に半透明が残っているか(中間値の割合)も見る。
//   直し方: tools/assistant/life-fullbody-art.py で作り直す(手で絵を直さない・基準をゆるめて済ませない)
//   あわせて、ふちの白マット(元絵の白い背景の残り)が戻っていないかも見る(2026-11-12 社長「あつもひどいしちゃんと全部確認して直して」)。
//   見方: ふち(透明から2画素以内)の画素のうち、白っぽく、かつすぐ内側(4画素以内)の体が白くない所(色のある体の外に白が乗っている)の割合。
//   羽・ドレスなど本当に白い物のふちは、内側も白いので数えない。ただしソラシドの着物のつや・みゅあの髪のふちのような描き込みの白も
//   数に入るので、1つの上限では分けられない。白い縁取りが付いたまま切り抜かれていた5人(MATTE_HALO)は直したあとの値のすぐ上を上限に、
//   ほかの子は 2026-11-12 に全部見て確かめた値(MATTE_BASE)から 0.01 より増えたら NG
//   PNG は自前で読む(canvas などの追加の部品が無くても回るように)。対応: 8bit のパレット(tRNS つき)・RGBA・RGB
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = path.join(__dirname, '..', '..', 'monster-hero', 'images', 'assistant', 'fullbody');
const MAX_HARD = 0.05; // 跳ぶ所の割合の上限
const MIN_MID = 0.5; // ふちの画素のうち、半透明(8〜247)の割合の下限
// 縁取りのあった5人: 直したあとの値 + 0.005(直す前は あつ 0.009・きき 0.041・ききハロウィン 0.005・キュウコ 0.067・ももすけ 0.035)
const MATTE_HALO = { atsu: 0.004, kiki: 0.011, kiki_halloween: 0.004, kyuko: 0.038, momosuke: 0.022 };
// 2026-11-12 の値(作り直したあと。全部見て、残る白は描き込みと確かめた)。名前はファイル名から .png を除いたもの。表情の絵は「__」の前の名前でまとめる
// 'kiki__' … ききの8表情(縁取りの無い元絵。2026-11-12 に全部見た。数えられるのは太ももの肌のつや・靴の白いふち)
const MATTE_BASE = { 'kiki__': 0.040, erubin: 0.001, erubin_sekiyuou: 0.040, momosuke_halloween: 0.015, mua: 0.110, 'mua_card-master': 0.050, mua_halloween: 0.010, sorashido: 0.138 };
const MATTE_MARGIN = 0.01;

function readAlpha(file) {
  const buf = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0, trns = null, plte = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; inter = data[12]; }
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'PLTE') plte = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  const bpp = { 3: 1, 6: 4, 2: 3 }[type];
  if (depth !== 8 || inter !== 0 || !bpp) throw new Error(`読めない形の PNG です(bit ${depth}・種類 ${type}・インターレース ${inter})`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp, out = Buffer.alloc(stride * h), alpha = new Uint8Array(w * h), rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i], a = i >= bpp ? out[dst + i - bpp] : 0, b = y ? out[dst - stride + i] : 0, c = (i >= bpp && y) ? out[dst - stride + i - bpp] : 0;
      let v;
      if (f === 0) v = x; else if (f === 1) v = x + a; else if (f === 2) v = x + b; else if (f === 3) v = x + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[dst + i] = v & 255;
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (type === 3) alpha[i] = trns && out[i] < trns.length ? trns[out[i]] : 255;
    else if (type === 6) alpha[i] = out[i * 4 + 3];
    else alpha[i] = 255;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = type === 3 ? (plte ? plte[out[i] * 3 + c] : 0) : out[i * bpp + c];
  }
  return { w, h, alpha, rgb };
}

function measure({ w, h, alpha }) {
  let steps = 0, hard = 0, edge = 0, mid = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = alpha[i];
    for (const j of [x < w - 1 ? i + 1 : -1, y < h - 1 ? i + w : -1]) {
      if (j < 0) continue;
      const d = Math.abs(a - alpha[j]);
      if (d > 24) { steps++; if (d > 200) hard++; }
    }
    // ふちの画素: 128 を境に、上下左右のどれかと向こう側にある
    const op = a >= 128;
    if ((x > 0 && (alpha[i - 1] >= 128) !== op) || (x < w - 1 && (alpha[i + 1] >= 128) !== op)
      || (y > 0 && (alpha[i - w] >= 128) !== op) || (y < h - 1 && (alpha[i + w] >= 128) !== op)) {
      edge++; if (a > 8 && a < 247) mid++;
    }
  }
  return { hard: steps ? hard / steps : 0, mid: edge ? mid / edge : 1 };
}

// ふちの白マットの割合(上の説明の見方)
function matte({ w, h, alpha, rgb }) {
  const N = w * h, near = new Uint8Array(N), core = new Uint8Array(N);
  // 透明(<32)から2画素以内(8方向) / 不透明(>=200)の中で、ふちから3画素より内側
  const grow = (src, r, val) => {
    let cur = src;
    for (let k = 0; k < r; k++) {
      const nx = cur.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (cur[y * w + x] !== val) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < h && xx >= 0 && xx < w) nx[yy * w + xx] = val;
        }
      }
      cur = nx;
    }
    return cur;
  };
  for (let i = 0; i < N; i++) { near[i] = alpha[i] < 32 ? 1 : 0; core[i] = alpha[i] >= 200 ? 1 : 0; }
  const nearT = grow(near, 2, 1), coreE = grow(core, 3, 0);
  const white = (i) => { const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2], mn = Math.min(r, g, b), mx = Math.max(r, g, b); return mn >= 215 && mx - mn <= 25; };
  // 内側の白・白くない所の数を、4画素四方の合計で(積分画像)
  const W1 = w + 1, sw = new Int32Array(W1 * (h + 1)), sn = new Int32Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, cw = coreE[i] && white(i) ? 1 : 0, cn = coreE[i] && !white(i) ? 1 : 0, j = (y + 1) * W1 + x + 1;
    sw[j] = cw + sw[j - 1] + sw[j - W1] - sw[j - W1 - 1];
    sn[j] = cn + sn[j - 1] + sn[j - W1] - sn[j - W1 - 1];
  }
  const sum = (S, x0, y0, x1, y1) => S[y1 * W1 + x1] - S[y0 * W1 + x1] - S[y1 * W1 + x0] + S[y0 * W1 + x0];
  let edge = 0, bad = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!nearT[i] || alpha[i] < 128) continue;
    edge++;
    if (!white(i)) continue;
    const x0 = Math.max(0, x - 4), y0 = Math.max(0, y - 4), x1 = Math.min(w, x + 5), y1 = Math.min(h, y + 5);
    if (sum(sn, x0, y0, x1, y1) >= 4 * Math.max(1, sum(sw, x0, y0, x1, y1))) bad++;
  }
  return edge ? bad / edge : 0;
}

let failed = 0, n = 0, worst = { hard: 0, name: '' };
for (const f of fs.readdirSync(DIR).filter((x) => /\.png$/i.test(x)).sort()) {
  n++;
  const img = readAlpha(path.join(DIR, f));
  const m = measure(img);
  const key = f.replace(/\.png$/i, ''), base = key.split('__')[0];
  const mt = matte(img);
  const exprKey = key.includes('__') ? `${base}__` : null; // 表情の絵だけの上限があればそれ
  const lim = exprKey && MATTE_BASE[exprKey] != null ? MATTE_BASE[exprKey] + MATTE_MARGIN
    : MATTE_HALO[base] != null ? MATTE_HALO[base] : MATTE_BASE[base] != null ? MATTE_BASE[base] + MATTE_MARGIN : 0.02 + MATTE_MARGIN;
  if (mt > lim) {
    failed++;
    console.log(`NG ${f}: ふちの白マット ${mt.toFixed(3)}(上限 ${lim.toFixed(3)}) — 元絵の白い背景が残っている。tools/assistant/life-fullbody-art.py の HALO・AUTO_POCKETS を見直して作り直す`);
  }
  if (m.hard > worst.hard) worst = { hard: m.hard, name: f };
  if (m.hard > MAX_HARD || m.mid < MIN_MID) {
    failed++;
    console.log(`NG ${f}: ふちの段の硬さ ${m.hard.toFixed(3)}(上限 ${MAX_HARD})・ふちの半透明 ${m.mid.toFixed(2)}(下限 ${MIN_MID}) — tools/assistant/life-fullbody-art.py で作り直す`);
  }
}
console.log(failed ? `全身画のふち: ${failed}件 NG(上の行)` : `全身画のふちの透過・白マット: OK(${n}枚・いちばん硬いのは ${worst.name} の ${worst.hard.toFixed(3)})`);
process.exitCode = failed ? 1 : 0;
