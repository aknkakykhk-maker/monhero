#!/usr/bin/env node
// 距離の札(零/近/中/遠。RANGE_STYLES の labelBg)の字の見た目を見る(2026-10-13 社長「縁を付けて中を白くするとかはどう? 全距離統一で」)。
//
//   node tools/battle/range-label-check.js
//
//   ① 4つとも同じ字の見た目(mh-range-label)を使い、地の色だけが距離ごとに違う。黒い字・白い字を個別に書かない
//   ② mh-range-label は白い字+黒い細い縁(4方向の影)。8pxの字でもにじまないよう、ぼかしの大きい影は使わない
//   ③ 距離の札に、距離の色の字(RANGE_STYLES[i].text)を重ねている所が無い(白い字にそろえる)
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const pts = read('monster-hero/src/parts/18-points-and-auto.jsx');
const labels = [...pts.matchAll(/labelBg: "([^"]+)"/g)].map((m) => m[1]);
check('① 距離の札は4つ', labels.length === 4, labels.join(' | '));
check('① 4つとも mh-range-label を使い、字の色を個別に書かない', labels.every((l) => /\bmh-range-label\b/.test(l) && !/\btext-(black|white)\b/.test(l)), labels.join(' | '));
check('① 地の色は距離ごとに違う(赤・黄・緑・青)', ['bg-red-', 'bg-yellow-', 'bg-emerald-', 'bg-blue-'].every((c, i) => (labels[i] || '').includes(c)));

const html = read('monster-hero/index.html');
const rule = (html.match(/\.mh-range-label \{[^}]*\}/) || [''])[0];
check('② mh-range-label は白い字', /color: #fff/.test(rule), rule);
const shadows = (rule.match(/text-shadow:([^;]+);/) || [])[1] || '';
check('② 黒い細い縁(4方向にずらした影)', ['1px 0 0 #000', '-1px 0 0 #000', '0 1px 0 #000', '0 -1px 0 #000'].every((s) => shadows.includes(s)), shadows);
check('② ぼかしの大きい影(2px以上)は使わない', !/\s0 0 ([2-9]|\d{2,})px/.test(shadows), shadows);

const parts = fs.readdirSync(path.join(root, 'monster-hero/src/parts')).filter((f) => f.endsWith('.jsx'));
const mixed = parts.filter((f) => /RANGE_STYLES\[[^\]]+\]\.labelBg\}\s*\$\{RANGE_STYLES\[[^\]]+\]\.text\}/.test(read(`monster-hero/src/parts/${f}`)));
check('③ 距離の札に距離の色の字を重ねている所が無い', mixed.length === 0, mixed.join(', '));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
