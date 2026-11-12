#!/usr/bin/env node
// 助手の全身画(monster-hero/images/assistant/fullbody/*.png)に、「囲まれた背景の残り」が無いかを見る検査(助手部ナカヨシ)。
//   経緯: 2026-11-12 社長「あつは、コートの内側・両足のあいだに白い背景が抜けずに残っている」。外から切り抜くだけでは、
//   腕と頭・両足のあいだのように輪郭に囲まれた背景は抜けない。濃い背景に置くと白く浮く。
//   見方: 白に近い・不透明な画素のつながりのうち、透明な所に一度も触れていない塊の最大の大きさを、絵ごとの許す大きさと比べる。
//   服の白(靴・ソックス・ドレス)は残してよいので、絵ごとに「いまの白の最大」を許す大きさとして持つ。
//   直し方: tools/assistant/life-fullbody-art.py の POCKETS に、その背景の座標(元の絵の上)を足して回す。許す大きさを上げて済ませない
const fs = require('fs');
const path = require('path');
const { createCanvas, Image } = require('canvas');

const DIR = path.join(__dirname, '..', '..', 'monster-hero', 'images', 'assistant', 'fullbody');
const DEFAULT_MAX = 300; // 表に無い絵(新しく足した絵)は、これを超える白の塊があれば止める
// 絵ごとの許す大きさ(画素)。いまの服の白の最大に、ゆとりを付けたもの
const ALLOWED = {
  'kiki': 500, 'sorashido': 500, 'kiki_halloween': 1000, 'kyuko': 2500, 'momosuke': 1500, 'mua': 2000,
  'mua_halloween': 1000, 'mua_card-master': 1400,
};

const nearWhite = (d, i) => d[i + 3] >= 250 && Math.min(d[i], d[i + 1], d[i + 2]) >= 225
  && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) <= 22;

const worstEnclosedWhite = (file) => {
  const img = new Image();
  img.src = fs.readFileSync(file);
  const w = img.width, h = img.height;
  const cv = createCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;
  // 透明(アルファ40未満)から2画素以内か
  const near = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (d[p * 4 + 3] < 40) near[p] = 1;
  for (let r = 0; r < 2; r++) {
    const prev = near.slice();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!prev[p] && ((x > 0 && prev[p - 1]) || (x < w - 1 && prev[p + 1]) || (y > 0 && prev[p - w]) || (y < h - 1 && prev[p + w]))) near[p] = 1;
    }
  }
  const seen = new Uint8Array(w * h);
  let worst = 0, at = null;
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !nearWhite(d, s * 4)) continue;
    const stack = [s]; seen[s] = 1;
    let n = 0, touch = false, sx = 0, sy = 0;
    while (stack.length) {
      const p = stack.pop(); n++; sx += p % w; sy += (p / w) | 0;
      if (near[p]) touch = true;
      const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && !seen[q] && nearWhite(d, q * 4)) { seen[q] = 1; stack.push(q); }
      }
    }
    if (!touch && n > worst) { worst = n; at = [Math.round(sx / n), Math.round(sy / n)]; }
  }
  return { worst, at };
};

let failed = 0;
for (const f of fs.readdirSync(DIR).filter((n) => /\.png$/.test(n)).sort()) {
  const name = f.replace(/\.png$/, '');
  if (name.includes('__')) continue; // 表情の絵は、元の絵(表情なし)と同じ作り方
  const { worst, at } = worstEnclosedWhite(path.join(DIR, f));
  const max = ALLOWED[name] ?? DEFAULT_MAX;
  if (worst > max) {
    failed++;
    console.log(`NG ${f}: 囲まれた白い塊 ${worst}画素(許す ${max})。中心 ${at[0]},${at[1]} — 背景の残りなら life-fullbody-art.py の POCKETS に座標を足して回す`);
  }
}
console.log(failed ? `全身画の囲まれた背景: ${failed}枚で残りあり` : '全身画の囲まれた背景: OK');
process.exitCode = failed ? 1 : 0;
