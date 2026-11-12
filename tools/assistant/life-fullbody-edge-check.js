#!/usr/bin/env node
// 助手の全身画(monster-hero/images/assistant/fullbody/*.png)の、ふちの透過が2値(ギザギザ)に戻っていないかを見る検査(助手部ナカヨシ)。
//   経緯: 2026-11-12 社長「昨日言った助手の全身画の透過の荒さ直ってないね」。前の作りはふちのアルファを 0/255 近くへ寄せ、
//   256 色に減らすときも半透明の段が荒れていた(カードマスターの8表情は完全に 0/255)。暗い背景に置くと、髪・羽・服の外側がギザギザに見える。
//   見方: となり合う画素でアルファが変わる所のうち、一気に 200 より大きく跳ぶ所の割合(段の硬さ)。なめらかなふちは 0.04 以下、
//   2値のふちは 1.0、前の作りは 0.06〜0.17 だった。あわせて、ふちの画素に半透明が残っているか(中間値の割合)も見る。
//   直し方: tools/assistant/life-fullbody-art.py で作り直す(手で絵を直さない・基準をゆるめて済ませない)
//   PNG は自前で読む(canvas などの追加の部品が無くても回るように)。対応: 8bit のパレット(tRNS つき)・RGBA・RGB
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIR = path.join(__dirname, '..', '..', 'monster-hero', 'images', 'assistant', 'fullbody');
const MAX_HARD = 0.05; // 跳ぶ所の割合の上限
const MIN_MID = 0.5; // ふちの画素のうち、半透明(8〜247)の割合の下限

function readAlpha(file) {
  const buf = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), kind = buf.toString('ascii', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; inter = data[12]; }
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  const bpp = { 3: 1, 6: 4, 2: 3 }[type];
  if (depth !== 8 || inter !== 0 || !bpp) throw new Error(`読めない形の PNG です(bit ${depth}・種類 ${type}・インターレース ${inter})`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp, out = Buffer.alloc(stride * h), alpha = new Uint8Array(w * h);
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
  }
  return { w, h, alpha };
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

let failed = 0, n = 0, worst = { hard: 0, name: '' };
for (const f of fs.readdirSync(DIR).filter((x) => /\.png$/i.test(x)).sort()) {
  n++;
  const m = measure(readAlpha(path.join(DIR, f)));
  if (m.hard > worst.hard) worst = { hard: m.hard, name: f };
  if (m.hard > MAX_HARD || m.mid < MIN_MID) {
    failed++;
    console.log(`NG ${f}: ふちの段の硬さ ${m.hard.toFixed(3)}(上限 ${MAX_HARD})・ふちの半透明 ${m.mid.toFixed(2)}(下限 ${MIN_MID}) — tools/assistant/life-fullbody-art.py で作り直す`);
  }
}
console.log(failed ? `全身画のふちの透過: ${failed}/${n}枚が2値に近い` : `全身画のふちの透過: OK(${n}枚・いちばん硬いのは ${worst.name} の ${worst.hard.toFixed(3)})`);
process.exitCode = failed ? 1 : 0;
