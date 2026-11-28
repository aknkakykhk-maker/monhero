#!/usr/bin/env node
// 全身画から切り出した立ち絵(ASSISTANT_STAND_ART の置き場 images/assistant/stand-*/)の上・左・右の端に、
// 不透明な画素が触れていないか(頭・髪・飾り・上げた腕・羽が枠で切れていないか)を見る検査(助手部ナカヨシ)。
//   経緯: 2026-11-23 r1119-122 社長「切り出しの作りは基本透過してるわけだから頭とか腕とかが切れないように工夫はしてほしい」。下の端は胸で切るので見ない
//   直し方: python3 tools/assistant/life-stand-from-fullbody.py --only <キー> --write(枠を透過の外形から決める)。手で絵を削らない
//   REST … まだ直していない絵(全身画から作り直せない物など)。NG にせず「残り」と1行で出す。直したら消す
//   使い方: node tools/assistant/life-stand-edge-check.js        (NG の絵と端だけ・最後の1行が OK/NG)
const fs = require('fs');
const path = require('path');
const { readAlpha } = require('./life-fullbody-edge-check.js');

const ROOT = path.join(__dirname, '..', '..');
const IMG = path.join(ROOT, 'monster-hero', 'images', 'assistant');
const LIM = 32; // これより濃い画素が端にあれば「触れている」
const REST = {
  // 2026-11-23 r1119-153 で全身画がある組を全部、最新の全身画から切り直し、切れの残りは無くなった
};

function standDirs() {
  const src = fs.readFileSync(path.join(ROOT, 'monster-hero', 'data', 'assistants.js'), 'utf8');
  const m = /const ASSISTANT_STAND_ART = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(src);
  if (!m) throw new Error('assistants.js に ASSISTANT_STAND_ART が見つからない');
  return [...new Set([...m[1].replace(/\/\/[^\n]*/g, '').matchAll(/:\s*'([a-z0-9-]+)'/g)].map((x) => x[1]))];
}

function edges(file) {
  const { w, h, alpha } = readAlpha(file);
  const n = { 上: 0, 左: 0, 右: 0 };
  for (let x = 0; x < w; x++) if (alpha[x] >= LIM) n.上++;
  for (let y = 0; y < h; y++) {
    if (alpha[y * w] >= LIM) n.左++;
    if (alpha[y * w + w - 1] >= LIM) n.右++;
  }
  return Object.entries(n).filter(([, v]) => v).map(([k, v]) => `${k}${v}`);
}

let ng = 0, rest = 0, total = 0;
for (const dir of standDirs()) {
  const d = path.join(IMG, dir);
  if (!fs.existsSync(d)) { ng++; console.log(`NG ${dir}/: 置き場が無い`); continue; }
  for (const f of fs.readdirSync(d).filter((x) => /\.(png|webp)$/i.test(x)).sort()) {
    total++;
    const e = edges(path.join(d, f));
    if (!e.length) continue;
    const key = `${dir}/${f}`;
    if (REST[key]) { rest++; continue; }
    ng++;
    console.log(`NG ${key}: ${e.join('・')}(画素)`);
  }
}
const tail = rest ? `・残り ${rest}枚(${[...new Set(Object.keys(REST).map((k) => k.split('/')[0]))].join('・')}。理由は REST の注)` : '';
console.log(ng ? `立ち絵の端: ${ng}枚 NG(上の行)${tail} — python3 tools/assistant/life-stand-from-fullbody.py --only <キー> --write で作り直す`
  : `立ち絵の端: OK(${total}枚・上・左・右の端に体が触れていない)${tail}`);
process.exitCode = ng ? 1 : 0;
