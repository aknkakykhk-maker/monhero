#!/usr/bin/env node
// モンヒロサクセスの景色(住む場所の季節×時間 12枚・大会の会場 4枚・修行の段 3枚)を
// Claude が SVG で描いて PNG にする道具(2026-11-12 開発部)
//
// 社長の決め: 住む場所の景色は季節と時間で替わる・明るくて遊びたくなる・まわりの帯とボタンは暗い紺。
// 外の画像AIは使っていない。参考の動画(docs/reference/line-mf/)は「住む場所が大きく、真ん中の地面に子が立つ」
// という組み立て方だけを見て、絵・形・色は写していない。
//
//   node tools/success/scene-art.js           SVG を tools/art-sources/success/scenes/ に書き、
//                                             PNG(1080×1920)を monster-hero/images/success/scenes/ に作り、
//                                             一覧の絵 docs/progress/player-raise/art/scenes-sheet.png を作る
//   node tools/success/scene-art.js --check   表(monster-hero/data/success-scenes.js)と SVG・PNG がそろっているかだけ見る
//   node tools/success/scene-art.js --only home-spring-day   1枚だけ作り直す(一覧の絵も作り直す)
//
// 画面の決まり(縦 1080×1920):
//   ・上の約15%(y<290)は帯で隠れる/下の約30%(y>1344)はボタンで隠れる
//   ・育てる子は真ん中に立つ(足もと y≈1190・高さ約650)。真ん中(x 330〜750・y 520〜1190)は込み入った物を置かず、
//     色の差を小さくして子が浮いて見えるようにする。見どころ(家・木・観客)は左右に寄せる
//   ・光は左上(アイテムの絵とそろえる)。ふちの線はこげ茶 #3d2618 を細めに
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SVG_DIR = path.join(ROOT, 'tools', 'art-sources', 'success', 'scenes');
const PNG_DIR = path.join(ROOT, 'monster-hero', 'images', 'success', 'scenes');
const SHEET = path.join(ROOT, 'docs', 'progress', 'player-raise', 'art', 'scenes-sheet.png');
const CHILD = path.join(ROOT, 'monster-hero', 'images', 'monsters', 'mocchi.png');
const { SUCCESS_SCENES } = require(path.join(ROOT, 'monster-hero', 'data', 'success-scenes.js'));

const W = 1080, H = 1920;
const FEET_Y = 1190;          // 育てる子の足もと
const OL = '#3d2618';

// ---- 色 ----------------------------------------------------------------------
const hx = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
const scale = (c, k) => { const A = hx(c); return toHex(A[0] * k, A[1] * k, A[2] * k); };
// 時間の色のかけ方(光るもの=窓・灯り・月はかけない)
const TIME_TINT = {
  day: (c) => c,
  evening: (c) => scale(mix(c, '#ff9466', 0.24), 0.95),
  night: (c) => scale(mix(c, '#4a58b0', 0.38), 0.86),
};

// ---- 小さな道具 ----------------------------------------------------------------
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f = (n) => (+n).toFixed(1);
const lg = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) =>
    `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const rg = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a]) =>
    `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
// ふくらんだ雲(円をいくつか重ねる)
const cloud = (x, y, s, fill, op = 1) => {
  const parts = [[0, 0, 60], [55, -25, 55], [110, -5, 62], [160, 10, 45], [-50, 12, 42]];
  return `<g opacity="${op}">${parts.map(([dx, dy, r]) => `<circle cx="${f(x + dx * s)}" cy="${f(y + dy * s)}" r="${f(r * s)}" fill="${fill}"/>`).join('')}` +
    `<rect x="${f(x - 70 * s)}" y="${f(y + 5 * s)}" width="${f(250 * s)}" height="${f(50 * s)}" rx="${f(25 * s)}" fill="${fill}"/></g>`;
};
// なめらかな稜線(点の列を Q でつなぐ)。下は bottom まで塗る
const ridge = (pts, bottom, fill, extra = '') => {
  let d = `M${pts[0][0]} ${bottom} L${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i];
    d += ` Q${f(px + (x - px) * 0.5)} ${f(py)} ${f((px + x) / 2)} ${f((py + y) / 2)} T${x} ${y}`;
  }
  d += ` L${pts[pts.length - 1][0]} ${bottom}Z`;
  return `<path d="${d}" fill="${fill}" ${extra}/>`;
};
const star4 = (x, y, r, fill = '#fff', op = 1) =>
  `<path d="M${f(x)} ${f(y - r)} Q${f(x + r * 0.18)} ${f(y - r * 0.18)} ${f(x + r)} ${f(y)} Q${f(x + r * 0.18)} ${f(y + r * 0.18)} ${f(x)} ${f(y + r)} Q${f(x - r * 0.18)} ${f(y + r * 0.18)} ${f(x - r)} ${f(y)} Q${f(x - r * 0.18)} ${f(y - r * 0.18)} ${f(x)} ${f(y - r)}Z" fill="${fill}" opacity="${op}"/>`;
const star5 = (cx, cy, r, fill, extra = '') => {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rr = i % 2 ? r * 0.45 : r; pts.push(`${f(cx + rr * Math.cos(a))},${f(cy + rr * Math.sin(a))}`); }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" ${extra}/>`;
};

const wrap = (defs, body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<filter id="blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="blur20" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="20"/></filter>
<filter id="blur40" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="40"/></filter>
${defs}
</defs>
${body}
</svg>
`;

// ---- 空(時間ごと)-----------------------------------------------------------------
const SKY = {
  day: { spring: ['#6fb8ff', '#a9d8ff', '#e6f6ff'], summer: ['#3f9dff', '#8fd0ff', '#dff4ff'], autumn: ['#78b4f0', '#b5d8f5', '#fdf0d8'], winter: ['#8ab8e8', '#c4def5', '#f2f8ff'] },
  evening: { spring: ['#7a6cd6', '#ff8fae', '#ffd08a'], summer: ['#6c5fd0', '#ff7f8e', '#ffc46b'], autumn: ['#6a58c4', '#ff7a6a', '#ffb85c'], winter: ['#7c78d4', '#f59cc0', '#ffd6a8'] },
  night: { spring: ['#1e2a66', '#33408f', '#6b6bc0'], summer: ['#172463', '#2c3d92', '#5a6ec4'], autumn: ['#1f2560', '#3a3a8c', '#7064b4'], winter: ['#1b2a62', '#344c9c', '#7b8ed0'] },
};

// ---- 季節の色 ----------------------------------------------------------------------
const SEASON = {
  spring: { far: '#8fb5e0', farSnow: null, hill: '#7fcf6a', hillDark: '#62b356', ground: ['#a4e07a', '#86cc62'], tree: ['#ffc4dc', '#ff9fc4', '#f27aa8'], trunk: '#8a5a3a' },
  summer: { far: '#6e9fd6', farSnow: null, hill: '#5cc254', hillDark: '#43a246', ground: ['#8ed866', '#66bd4c'], tree: ['#8fe06a', '#5cc24e', '#3f9a3e'], trunk: '#7a4e30' },
  autumn: { far: '#a59ac8', farSnow: null, hill: '#c9b552', hillDark: '#b0913c', ground: ['#d6cd78', '#bfae5c'], tree: ['#ffcf5a', '#ff9a3c', '#e2622e'], trunk: '#6e4428' },
  winter: { far: '#a8bfe2', farSnow: '#ffffff', hill: '#e9f2ff', hillDark: '#cddcf3', ground: ['#f6faff', '#dbe7f7'], tree: ['#ffffff', '#e2edfa', '#b9cbe6'], trunk: '#6a4a36' },
};

// ================================================================================
// 住む場所(季節 × 時間)
// ================================================================================
function homeScene(season, time) {
  const T = TIME_TINT[time];
  const S = SEASON[season];
  const sky = SKY[time][season];
  const R = rng(season.length * 97 + time.length * 13 + 7);
  const night = time === 'night', eve = time === 'evening';
  const defs = [];
  const b = [];

  // 空
  defs.push(lg('sky', [[0, sky[0]], [0.55, sky[1]], [1, sky[2]]]));
  b.push(`<rect width="${W}" height="1000" fill="url(#sky)"/>`);
  // 日・月・星
  if (time === 'day') {
    defs.push(rg('sunGlow', [[0, '#fffbe0', 0.95], [0.35, '#fff1a8', 0.55], [1, '#fff1a8', 0]]));
    b.push(`<circle cx="860" cy="380" r="210" fill="url(#sunGlow)"/><circle cx="860" cy="380" r="62" fill="#fffbe6"/>`);
  } else if (eve) {
    defs.push(rg('sunGlow', [[0, '#fff2c0', 1], [0.3, '#ffc070', 0.7], [1, '#ff8a60', 0]]));
    b.push(`<circle cx="300" cy="760" r="330" fill="url(#sunGlow)"/><circle cx="300" cy="770" r="96" fill="#ffe7a8"/>`);
  } else {
    for (let i = 0; i < 70; i++) {
      const x = R() * W, y = 120 + R() * 700, r = 1.5 + R() * 3.2;
      b.push(i % 9 === 0 ? star4(x, y, r * 3.2, '#fffbe0', 0.9) : `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#fffbe8" opacity="${f(0.55 + R() * 0.45)}"/>`);
    }
    defs.push(rg('moonGlow', [[0, '#fff6c8', 0.7], [0.4, '#c8d4ff', 0.25], [1, '#c8d4ff', 0]]));
    b.push(`<circle cx="830" cy="400" r="200" fill="url(#moonGlow)"/><circle cx="830" cy="400" r="70" fill="#fff6d0"/><circle cx="858" cy="382" r="62" fill="${sky[1]}"/>`);
  }
  // 雲
  const cloudCol = { day: '#ffffff', evening: '#ffd0c4', night: '#5a6bb4' }[time];
  const cloudOp = night ? 0.55 : 0.92;
  b.push(cloud(130, 420, 0.9, cloudCol, cloudOp), cloud(620, 560, 0.7, cloudCol, cloudOp * 0.85));
  if (season === 'summer') b.push(cloud(820, 700, 1.5, cloudCol, cloudOp), cloud(900, 600, 1.1, cloudCol, cloudOp));
  else b.push(cloud(860, 640, 0.8, cloudCol, cloudOp * 0.8));

  // 遠い山
  const farPts = [[-40, 800], [120, 690], [300, 760], [470, 650], [640, 740], [820, 670], [1000, 750], [1120, 700]];
  b.push(ridge(farPts, 980, T(S.far), 'opacity="0.95"'));
  if (S.farSnow) {
    b.push(`<path d="M430 690 L470 650 L510 690 L490 685 L470 700 L450 684Z M780 705 L820 670 L860 703 L838 699 L820 712 L800 699Z M85 718 L120 690 L156 716 L136 712 L120 724 L104 712Z" fill="${T(S.farSnow)}"/>`);
  }
  // 近い丘
  b.push(ridge([[-40, 880], [200, 820], [480, 870], [760, 815], [1120, 860]], 1000, T(S.hillDark)));
  b.push(ridge([[-40, 920], [260, 870], [560, 905], [860, 860], [1120, 900]], 1000, T(S.hill)));
  // 地面
  defs.push(lg('ground', [[0, T(S.ground[0])], [1, T(S.ground[1])]]));
  b.push(`<rect y="900" width="${W}" height="${H - 900}" fill="url(#ground)"/>`);
  // 地面の明るい帯(光は左上)
  b.push(`<ellipse cx="380" cy="1000" rx="520" ry="60" fill="#ffffff" opacity="${night ? 0.05 : 0.14}"/>`);

  // 奥の柵(真ん中はあける)
  const fence = T('#c99a62'), fenceD = T('#9a6e40');
  const fenceSeg = (x1, x2) => {
    let s = `<rect x="${x1}" y="930" width="${x2 - x1}" height="14" rx="6" fill="${fence}" stroke="${fenceD}" stroke-width="3"/>` +
      `<rect x="${x1}" y="962" width="${x2 - x1}" height="14" rx="6" fill="${fence}" stroke="${fenceD}" stroke-width="3"/>`;
    for (let x = x1 + 10; x < x2; x += 70) s += `<rect x="${x}" y="912" width="18" height="84" rx="6" fill="${fence}" stroke="${fenceD}" stroke-width="3"/>`;
    if (season === 'winter') s += `<rect x="${x1}" y="924" width="${x2 - x1}" height="9" rx="4" fill="#ffffff"/>`;
    return s;
  };
  b.push(fenceSeg(420, 640), fenceSeg(880, 1080));

  // 右の大きな木
  b.push(`<path d="M905 1010 Q890 840 915 600 L985 600 Q1000 840 1010 1010Z" fill="${T(S.trunk)}" stroke="${T('#4e3020')}" stroke-width="5"/>`);
  b.push(`<path d="M940 760 Q870 700 830 650" stroke="${T(S.trunk)}" stroke-width="22" fill="none" stroke-linecap="round"/>`);
  if (season === 'winter') {
    // 雪のつもった枝
    b.push(`<path d="M950 640 Q900 520 860 470 M960 620 Q1010 520 1060 470 M940 700 Q880 640 800 620 M970 700 Q1030 640 1090 630" stroke="${T(S.trunk)}" stroke-width="16" fill="none" stroke-linecap="round"/>`);
    b.push(`<path d="M855 468 Q880 456 905 520 M1058 468 Q1035 460 1010 520 M800 616 Q840 604 880 636 M1090 626 Q1050 612 1020 650" stroke="#ffffff" stroke-width="10" fill="none" stroke-linecap="round"/>`);
    // 雪の木(もみ)を奥に
    b.push(`<g transform="translate(1000 560)"><polygon points="0,-180 90,40 -90,40" fill="${T('#5f9e86')}"/><polygon points="0,-120 110,120 -110,120" fill="${T('#4f8c76')}"/>` +
      `<path d="M-40 -90 L0 -180 L40 -90 Q0 -70 -40 -90Z M-60 30 L0 -100 L60 30 Q0 50 -60 30Z" fill="#ffffff"/></g>`);
  } else {
    const [c1, c2, c3] = S.tree.map(T);
    const blobs = [[930, 470, 150], [820, 560, 110], [1040, 560, 130], [880, 380, 100], [1010, 380, 110], [960, 600, 120]];
    b.push(blobs.map(([x, y, r]) => `<circle cx="${x}" cy="${y + 14}" r="${r}" fill="${c3}"/>`).join(''));
    b.push(blobs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r * 0.94}" fill="${c2}"/>`).join(''));
    b.push(blobs.map(([x, y, r]) => `<circle cx="${x - r * 0.25}" cy="${y - r * 0.28}" r="${r * 0.55}" fill="${c1}"/>`).join(''));
    if (season === 'summer') b.push([[860, 520], [990, 450], [1050, 600]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="16" fill="${T('#ff6f8e')}"/>`).join(''));
  }

  // 左の家(モンスターの住む家)
  const wall = T('#fff1d6'), wallD = T('#e8cfa6'), roof = T('#ff7a6b'), roofD = T('#d9534f'), wood = T('#a86a3e'), woodD = T('#7a4526');
  b.push(`<g>`);
  b.push(`<rect x="275" y="470" width="56" height="130" fill="${T('#c46a4a')}" stroke="${T(OL)}" stroke-width="5"/>`);   // 煙突
  b.push(`<rect x="60" y="640" width="320" height="330" fill="${wall}" stroke="${T(OL)}" stroke-width="6"/>`);
  b.push(`<rect x="60" y="900" width="320" height="70" fill="${wallD}"/>`);
  b.push(`<path d="M20 670 Q30 640 60 620 L190 470 Q220 440 250 470 L380 620 Q410 640 420 670Z" fill="${roof}" stroke="${T(OL)}" stroke-width="6" stroke-linejoin="round"/>`);
  b.push(`<path d="M60 662 Q45 650 40 660 L200 486" stroke="${T('#ffb0a4')}" stroke-width="12" fill="none" stroke-linecap="round" opacity="0.8"/>`);
  b.push(`<path d="M24 668 Q220 690 416 668" stroke="${roofD}" stroke-width="12" fill="none" stroke-linecap="round"/>`);
  if (season === 'winter') b.push(`<path d="M30 655 Q40 632 66 618 L190 478 Q220 450 250 478 L374 618 Q400 632 410 655 Q360 640 330 652 Q300 630 260 646 Q230 624 200 644 Q160 626 130 648 Q90 630 30 655Z" fill="#ffffff" stroke="${T('#c9d8ee')}" stroke-width="3"/><rect x="272" y="462" width="62" height="16" rx="8" fill="#ffffff"/>`);
  // 破風の丸窓(肉球の印)
  const winLit = night || eve;
  const glass = night ? '#ffd770' : eve ? '#ffe0a0' : T('#bfe6ff');
  b.push(`<circle cx="220" cy="580" r="40" fill="${glass}" stroke="${T(OL)}" stroke-width="6"/>`);
  b.push(`<g fill="${night ? '#e08a2e' : T('#ff8fa8')}"><ellipse cx="220" cy="592" rx="15" ry="12"/><circle cx="203" cy="571" r="6"/><circle cx="215" cy="565" r="6"/><circle cx="228" cy="565" r="6"/><circle cx="239" cy="572" r="6"/></g>`);
  // 窓
  for (const x of [110, 290]) {
    if (winLit) b.push(`<circle cx="${x + 20}" cy="760" r="90" fill="#ffd770" opacity="${night ? 0.35 : 0.18}" filter="url(#blur20)"/>`);
    b.push(`<rect x="${x}" y="720" width="70" height="80" rx="10" fill="${glass}" stroke="${T(OL)}" stroke-width="6"/>`);
    b.push(`<path d="M${x + 35} 722 V798 M${x + 2} 760 H${x + 68}" stroke="${T(OL)}" stroke-width="5"/>`);
    if (!winLit) b.push(`<path d="M${x + 10} 734 L${x + 26} 734" stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.8"/>`);
    b.push(`<rect x="${x - 8}" y="800" width="86" height="22" rx="6" fill="${wood}" stroke="${T(OL)}" stroke-width="4"/>`);
    const flower = { spring: '#ff86b0', summer: '#ffd23f', autumn: '#ff8a3c', winter: '#d8423f' }[season];
    for (let k = 0; k < 4; k++) b.push(`<circle cx="${x + 6 + k * 20}" cy="796" r="9" fill="${T(flower)}"/>`);
  }
  // 戸
  b.push(`<path d="M180 970 V860 Q220 815 260 860 V970Z" fill="${wood}" stroke="${T(OL)}" stroke-width="6"/>`);
  b.push(`<path d="M220 840 V970" stroke="${woodD}" stroke-width="4"/><circle cx="244" cy="915" r="6" fill="${T('#f7c948')}"/>`);
  if (night) b.push(`<circle cx="290" cy="850" r="70" fill="#ffcf6a" opacity="0.45" filter="url(#blur20)"/><rect x="282" y="836" width="16" height="26" rx="6" fill="#ffe7a0" stroke="${T(OL)}" stroke-width="3"/>`);
  b.push(`</g>`);
  // 煙突のけむり(夕方・夜・冬)
  if (eve || night || season === 'winter') {
    const sm = night ? '#8f9bd0' : '#ffffff';
    b.push(`<g opacity="0.6"><circle cx="305" cy="440" r="22" fill="${sm}"/><circle cx="325" cy="400" r="28" fill="${sm}"/><circle cx="352" cy="355" r="34" fill="${sm}"/></g>`);
  }
  // 家の足もとの影
  b.push(`<ellipse cx="220" cy="975" rx="210" ry="18" fill="#000" opacity="0.12"/>`);

  // 右手前: トレーニングの丸太とバケツ
  b.push(`<ellipse cx="860" cy="1080" rx="70" ry="14" fill="#000" opacity="0.12"/>`);
  b.push(`<rect x="830" y="960" width="60" height="120" rx="12" fill="${T('#b07a48')}" stroke="${T(OL)}" stroke-width="5"/>`);
  b.push(`<ellipse cx="860" cy="962" rx="30" ry="10" fill="${T('#e6c08a')}" stroke="${T(OL)}" stroke-width="4"/>`);
  b.push(`<path d="M832 1000 Q860 1012 888 1000 M832 1040 Q860 1052 888 1040" stroke="${T('#f2e3c0')}" stroke-width="6" fill="none"/>`);
  if (season === 'winter') b.push(`<ellipse cx="860" cy="954" rx="34" ry="10" fill="#ffffff"/>`);
  b.push(`<path d="M920 1040 L930 1090 H980 L990 1040Z" fill="${T('#7cb4e0')}" stroke="${T(OL)}" stroke-width="5" stroke-linejoin="round"/><path d="M922 1048 H988" stroke="${T('#bfe0ff')}" stroke-width="5"/>`);

  // 真ん中の広場(子が立つところ)
  const dirt = season === 'winter' ? ['#e8f0fb', '#cfdcef'] : season === 'autumn' ? ['#e6c98e', '#c9a46a'] : ['#ecd39a', '#d2b073'];
  defs.push(rg('plaza', [[0, T(dirt[0])], [0.75, T(dirt[1])], [1, T(dirt[1]), 0]], 0.45, 0.42, 0.55));
  b.push(`<path d="M430 1260 L380 ${H} H700 L650 1260Z" fill="${T(dirt[1])}" opacity="0.8"/>`);
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="390" ry="120" fill="url(#plaza)"/>`);
  // 平らな石を少し
  for (const [x, y] of [[300, 1210], [770, 1170], [420, 1270], [690, 1260]]) b.push(`<ellipse cx="${x}" cy="${y}" rx="24" ry="9" fill="${T(season === 'winter' ? '#b8c8de' : '#b89a6a')}" opacity="0.7"/>`);

  // 季節の飾り
  if (season === 'spring') {
    // チューリップの列(左手前・右手前)
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 32, y = 1050 + (i % 2) * 18;
      const c = ['#ff6fa0', '#ffd23f', '#ff9a5c'][i % 3];
      b.push(`<path d="M${x} ${y + 60} V${y + 10}" stroke="${T('#3f9a3e')}" stroke-width="5"/><path d="M${x - 12} ${y} Q${x - 12} ${y + 22} ${x} ${y + 22} Q${x + 12} ${y + 22} ${x + 12} ${y} L${x + 6} ${y + 8} L${x} ${y - 2} L${x - 6} ${y + 8}Z" fill="${T(c)}"/>`);
    }
    // 舞う花びら
    for (let i = 0; i < 26; i++) {
      const x = R() * W, y = 300 + R() * 1100;
      if (x > 330 && x < 750 && y > 520 && y < 1190 && R() < 0.7) continue;
      b.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="9" ry="5" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})" fill="${T('#ffb6d2')}" opacity="0.9"/>`);
    }
  } else if (season === 'summer') {
    // ひまわり(家の右・柵の前)
    for (const [x, y, s] of [[440, 900, 1], [500, 930, 0.85], [1000, 1150, 1.1]]) {
      b.push(`<path d="M${x} ${y + 140 * s} V${y}" stroke="${T('#3f9a3e')}" stroke-width="${7 * s}"/><ellipse cx="${x + 18 * s}" cy="${y + 80 * s}" rx="${20 * s}" ry="${9 * s}" fill="${T('#4fae48')}"/>`);
      for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; b.push(`<ellipse cx="${f(x + Math.cos(a) * 26 * s)}" cy="${f(y + Math.sin(a) * 26 * s)}" rx="${f(16 * s)}" ry="${f(7 * s)}" transform="rotate(${f(a * 180 / Math.PI)} ${f(x + Math.cos(a) * 26 * s)} ${f(y + Math.sin(a) * 26 * s)})" fill="${T('#ffd23f')}"/>`); }
      b.push(`<circle cx="${x}" cy="${y}" r="${18 * s}" fill="${T('#8a5a2a')}"/>`);
    }
    if (night) for (let i = 0; i < 22; i++) { const x = R() * W, y = 850 + R() * 500; if (x > 360 && x < 720 && y < 1190) continue; b.push(`<circle cx="${f(x)}" cy="${f(y)}" r="16" fill="#dfff7a" opacity="0.35" filter="url(#blur8)"/><circle cx="${f(x)}" cy="${f(y)}" r="4" fill="#f4ffb0"/>`); }
  } else if (season === 'autumn') {
    // かぼちゃと落ち葉
    for (const [x, y, s] of [[70, 1090, 1], [140, 1110, 0.75], [1010, 1210, 0.9]]) {
      b.push(`<ellipse cx="${x}" cy="${y}" rx="${46 * s}" ry="${34 * s}" fill="${T('#ff8a2c')}" stroke="${T(OL)}" stroke-width="4"/><path d="M${x} ${y - 32 * s} V${y + 32 * s} M${x - 22 * s} ${y - 28 * s} Q${x - 34 * s} ${y} ${x - 22 * s} ${y + 28 * s} M${x + 22 * s} ${y - 28 * s} Q${x + 34 * s} ${y} ${x + 22 * s} ${y + 28 * s}" stroke="${T('#c9561a')}" stroke-width="4" fill="none"/><rect x="${x - 5}" y="${y - 46 * s}" width="10" height="${16 * s}" rx="3" fill="${T('#5a7a2a')}"/>`);
    }
    for (let i = 0; i < 40; i++) {
      const x = R() * W, y = (i < 14 ? 350 + R() * 800 : 980 + R() * 500);
      if (x > 340 && x < 740 && y > 520 && y < 1190 && R() < 0.7) continue;
      const c = ['#ff9a3c', '#e2622e', '#ffcf5a'][i % 3];
      b.push(`<path d="M${f(x)} ${f(y - 10)} Q${f(x + 10)} ${f(y)} ${f(x)} ${f(y + 10)} Q${f(x - 10)} ${f(y)} ${f(x)} ${f(y - 10)}Z" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})" fill="${T(c)}" opacity="0.95"/>`);
    }
  } else {
    // 雪だるま(左手前)と降る雪
    const sn = T('#ffffff'), snD = T('#c9d8ee');
    b.push(`<ellipse cx="110" cy="1180" rx="80" ry="14" fill="#000" opacity="0.1"/><circle cx="110" cy="1120" r="62" fill="${sn}" stroke="${snD}" stroke-width="5"/><circle cx="110" cy="1030" r="44" fill="${sn}" stroke="${snD}" stroke-width="5"/>` +
      `<circle cx="96" cy="1022" r="6" fill="${T(OL)}"/><circle cx="124" cy="1022" r="6" fill="${T(OL)}"/><path d="M110 1034 L138 1040 L110 1044Z" fill="${T('#ff8a2c')}"/>` +
      `<path d="M70 1062 Q110 1078 150 1062" stroke="${T('#e2483f')}" stroke-width="14" fill="none" stroke-linecap="round"/><rect x="138" y="1062" width="14" height="36" rx="5" fill="${T('#e2483f')}"/>`);
    for (let i = 0; i < 60; i++) { const x = R() * W, y = 200 + R() * 1300, r = 3 + R() * 5; b.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#ffffff" opacity="${f(0.55 + R() * 0.4)}"/>`); }
  }

  // 草むら(手前の左右)
  const bush = T(season === 'winter' ? '#e6eefa' : season === 'autumn' ? '#b99a46' : S.hillDark);
  const bushL = T(season === 'winter' ? '#ffffff' : season === 'autumn' ? '#d6bd62' : S.hill);
  for (const [x, y, s] of [[40, 1330, 1.2], [1050, 1300, 1.3], [150, 1420, 1], [960, 1430, 1.1], [520, 1560, 0.9]]) {
    b.push(`<g><circle cx="${x}" cy="${y}" r="${70 * s}" fill="${bush}"/><circle cx="${x + 60 * s}" cy="${y + 20 * s}" r="${55 * s}" fill="${bush}"/><circle cx="${x - 60 * s}" cy="${y + 20 * s}" r="${55 * s}" fill="${bush}"/><circle cx="${x - 18 * s}" cy="${y - 22 * s}" r="${36 * s}" fill="${bushL}"/></g>`);
  }
  // 草の小さな束
  if (season !== 'winter') for (let i = 0; i < 40; i++) {
    const x = R() * W, y = 1000 + R() * 600;
    if (Math.abs(x - 540) < 380 && Math.abs(y - FEET_Y) < 110) continue;
    b.push(`<path d="M${f(x - 8)} ${f(y)} L${f(x - 4)} ${f(y - 16)} L${f(x)} ${f(y)} L${f(x + 5)} ${f(y - 20)} L${f(x + 9)} ${f(y)}Z" fill="${T(S.hillDark)}"/>`);
  }

  // 夜の灯り(右の灯籠)
  if (night || eve) {
    b.push(`<rect x="1004" y="980" width="12" height="190" fill="${T('#5a4030')}"/>`);
    b.push(`<circle cx="1010" cy="980" r="120" fill="#ffcf6a" opacity="${night ? 0.4 : 0.2}" filter="url(#blur40)"/>`);
    b.push(`<rect x="988" y="950" width="44" height="54" rx="10" fill="#ffe7a0" stroke="${T(OL)}" stroke-width="4"/><path d="M982 950 H1038 L1010 928Z" fill="${T('#5a4030')}"/>`);
  }
  // 時間の空気(夕方は下から暖かく・夜は四すみを少し暗く)
  if (eve) { defs.push(lg('warm', [[0, '#ffb070', 0], [1, '#ff8a50', 0.18]])); b.push(`<rect width="${W}" height="${H}" fill="url(#warm)"/>`); }
  if (night) { defs.push(rg('vig', [[0.6, '#0a1030', 0], [1, '#0a1030', 0.22]], 0.5, 0.5, 0.75)); b.push(`<rect width="${W}" height="${H}" fill="url(#vig)"/>`); }
  return wrap(defs.join('\n'), b.join('\n'));
}

// ================================================================================
// 大会の会場
// ================================================================================
// 観客席の段(左右から真ん中へ下がる弧)。crowd = 色とりどりの頭
function stands(R, { top, bottom, tiers, wall, wallD, crowd, gapL = 330, gapR = 750, light = '#fff' }) {
  const b = [];
  for (let k = 0; k < tiers; k++) {
    const y = top + (bottom - top) * k / tiers, h = (bottom - top) / tiers;
    b.push(`<rect x="0" y="${f(y)}" width="${W}" height="${f(h)}" fill="${k % 2 ? wallD : wall}"/>`);
    for (let x = 14; x < W; x += 30) {
      if (x > gapL && x < gapR && k >= tiers - 2) continue;
      if (R() < 0.12) continue;
      const c = crowd[Math.floor(R() * crowd.length)];
      b.push(`<circle cx="${f(x + R() * 8)}" cy="${f(y + h * 0.45)}" r="${f(h * 0.26)}" fill="${c}"/>`);
      if (R() < 0.08) b.push(`<path d="M${f(x)} ${f(y + h * 0.3)} L${f(x - 6)} ${f(y - h * 0.3)}" stroke="${light}" stroke-width="4" stroke-linecap="round"/>`);
    }
  }
  return b.join('');
}
const bunting = (x1, y1, x2, y2, sag, cols, n = 14) => {
  let s = `<path d="M${x1} ${y1} Q${(x1 + x2) / 2} ${y1 + sag} ${x2} ${y2}" stroke="#7a5030" stroke-width="3" fill="none"/>`;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * (x1 + x2) / 2 + t * t * x2, y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * (y1 + sag) + t * t * y2;
    s += `<path d="M${f(x - 14)} ${f(y)} L${f(x + 14)} ${f(y)} L${f(x)} ${f(y + 34)}Z" fill="${cols[i % cols.length]}"/>`;
  }
  return s;
};
const flagPole = (x, y, h, col) => `<path d="M${x} ${y} V${y - h}" stroke="#6a4a30" stroke-width="7"/><path d="M${x} ${y - h} Q${x + 40} ${y - h + 8} ${x + 80} ${y - h - 4} L${x + 80} ${y - h + 46} Q${x + 40} ${y - h + 56} ${x} ${y - h + 46}Z" fill="${col}"/>`;
const CROWD = ['#ff7a9c', '#ffb347', '#ffe066', '#7fd1ff', '#9b8cff', '#7ee08a', '#ffffff', '#ff8a6b'];

function venueDebut() {
  const R = rng(11), defs = [], b = [];
  defs.push(lg('sky', [[0, '#5fb0ff'], [0.6, '#a6dbff'], [1, '#eaf8ff']]));
  b.push(`<rect width="${W}" height="1000" fill="url(#sky)"/>`);
  b.push(cloud(120, 400, 0.9, '#fff'), cloud(780, 470, 1.0, '#fff'), cloud(500, 330, 0.6, '#fff', 0.8));
  b.push(ridge([[-40, 820], [240, 760], [520, 800], [820, 740], [1120, 790]], 1000, '#84c870'));
  // 木の観客席(左右)
  for (const side of [0, 1]) {
    const x0 = side ? 700 : 0, x1 = side ? W : 380;
    for (let k = 0; k < 5; k++) {
      const y = 720 + k * 50;
      b.push(`<rect x="${x0}" y="${y}" width="${x1 - x0}" height="50" fill="${k % 2 ? '#c9935a' : '#dba66a'}" stroke="#8a5a34" stroke-width="3"/>`);
      for (let x = x0 + 18; x < x1 - 10; x += 34) if (R() > 0.3) b.push(`<circle cx="${f(x + R() * 6)}" cy="${y + 20}" r="13" fill="${CROWD[Math.floor(R() * CROWD.length)]}"/>`);
    }
    // テントの屋根
    const cx = (x0 + x1) / 2;
    b.push(`<path d="M${x0 - 20} 720 L${cx} 600 L${x1 + 20} 720Z" fill="#ff7a6b" stroke="${OL}" stroke-width="5"/>`);
    for (let i = 0; i < 6; i++) { const xa = x0 - 20 + (x1 - x0 + 40) * i / 6, xb = x0 - 20 + (x1 - x0 + 40) * (i + 0.5) / 6; b.push(`<path d="M${f(xa)} 720 L${cx} 600 L${f(xb)} 720Z" fill="#fff3e0"/>`); }
    b.push(`<path d="M${x0 - 20} 720 Q${cx} 740 ${x1 + 20} 720" stroke="#d9534f" stroke-width="10" fill="none"/>`);
  }
  // 奥の木の門(子の後ろ・色は控えめ)
  b.push(`<rect x="400" y="760" width="26" height="200" fill="#c9935a" stroke="#8a5a34" stroke-width="3"/><rect x="654" y="760" width="26" height="200" fill="#c9935a" stroke="#8a5a34" stroke-width="3"/>`);
  b.push(`<path d="M380 770 Q540 720 700 770 L700 800 Q540 750 380 800Z" fill="#ffd56b" stroke="#c99a30" stroke-width="4"/>`);
  b.push(star5(540, 748, 22, '#ff7a6b'));
  b.push(bunting(0, 560, 540, 600, 90, ['#ff7a9c', '#ffd23f', '#7fd1ff', '#7ee08a']), bunting(540, 600, W, 560, 90, ['#ffd23f', '#ff8a3c', '#9b8cff', '#ff7a9c']));
  b.push(flagPole(40, 720, 220, '#ffb347'), flagPole(960, 720, 220, '#7fd1ff'));
  // 地面と土の円
  defs.push(lg('grass', [[0, '#97da70'], [1, '#6cbf52']]));
  b.push(`<rect y="960" width="${W}" height="${H - 960}" fill="url(#grass)"/>`);
  defs.push(rg('ring', [[0, '#f2dba6'], [0.8, '#dcbb7c'], [1, '#c9a464']], 0.45, 0.4, 0.6));
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="470" ry="170" fill="url(#ring)" stroke="#fff6e0" stroke-width="10"/>`);
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="140" ry="48" fill="none" stroke="#fff6e0" stroke-width="6" opacity="0.7"/>`);
  for (let i = 0; i < 36; i++) { const x = R() * W, y = 1000 + R() * 700; if (Math.abs(x - 540) < 480 && Math.abs(y - FEET_Y) < 180) continue; b.push(`<path d="M${f(x - 8)} ${f(y)} L${f(x - 3)} ${f(y - 18)} L${f(x + 2)} ${f(y)} L${f(x + 7)} ${f(y - 14)} L${f(x + 10)} ${f(y)}Z" fill="#4fa83e"/>`); }
  // 手前の旗の列
  for (const [x, c] of [[60, '#ff7a9c'], [1020, '#ffd23f']]) b.push(`<rect x="${x - 5}" y="1080" width="10" height="200" fill="#8a5a34"/><path d="M${x + 5} 1085 L${x + 85} 1110 L${x + 5} 1140Z" fill="${c}"/>`);
  return wrap(defs.join('\n'), b.join('\n'));
}

function venueCup() {
  const R = rng(22), defs = [], b = [];
  defs.push(lg('sky', [[0, '#4a9cff'], [0.6, '#92ceff'], [1, '#dff3ff']]));
  b.push(`<rect width="${W}" height="1000" fill="url(#sky)"/>`);
  b.push(cloud(180, 360, 0.9, '#fff'), cloud(760, 420, 1.1, '#fff', 0.9));
  // 石の観客席(大きな弧の壁)
  defs.push(lg('stone', [[0, '#e9e2d4'], [1, '#c8bca6']]));
  b.push(`<path d="M-20 560 Q540 470 1100 560 V980 H-20Z" fill="url(#stone)" stroke="#8c7d64" stroke-width="5"/>`);
  defs.push(`<clipPath id="bowlC"><path d="M-20 590 Q540 500 1100 590 V900 H-20Z"/></clipPath>`);
  b.push(`<g clip-path="url(#bowlC)">${stands(R, { top: 500, bottom: 900, tiers: 9, wall: '#8a7fb8', wallD: '#7a6fa8', crowd: CROWD })}</g>`);
  b.push(`<path d="M-20 900 H1100 V960 H-20Z" fill="#d8ccb4" stroke="#8c7d64" stroke-width="4"/>`);
  // 垂れ幕
  for (const [x, c] of [[90, '#ff7a9c'], [250, '#ffb347'], [830, '#ffe066'], [990, '#ff7a9c']]) b.push(`<path d="M${x - 34} 900 H${x + 34} V990 L${x} 965 L${x - 34} 990Z" fill="${c}" stroke="${OL}" stroke-width="3"/>${star5(x, 935, 16, '#fff')}`);
  // 塔の旗
  for (const [x, c] of [[40, '#ff7a9c'], [300, '#ffd23f'], [780, '#7fd1ff'], [1040, '#ffb347']]) b.push(flagPole(x, 560 - (x > 200 && x < 900 ? 34 : 0), 130, c));
  // 芝の場と白い円
  defs.push(lg('field', [[0, '#7fd06a'], [1, '#55b048']]));
  b.push(`<rect y="960" width="${W}" height="${H - 960}" fill="url(#field)"/>`);
  for (let i = 0; i < 8; i++) b.push(`<rect y="${960 + i * 120}" width="${W}" height="60" fill="#ffffff" opacity="0.06"/>`);
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="450" ry="160" fill="#a8e08a" opacity="0.55"/>`);
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="450" ry="160" fill="none" stroke="#ffffff" stroke-width="10"/>`);
  b.push(`<path d="M90 ${FEET_Y} H990" stroke="#ffffff" stroke-width="6" opacity="0.6"/>`);
  return wrap(defs.join('\n'), b.join('\n'));
}

function venueHero() {
  const R = rng(33), defs = [], b = [];
  defs.push(lg('sky', [[0, '#2a2f7a'], [0.5, '#7a4fb8'], [1, '#ff9aa8']]));
  b.push(`<rect width="${W}" height="1000" fill="url(#sky)"/>`);
  for (let i = 0; i < 40; i++) b.push(`<circle cx="${f(R() * W)}" cy="${f(120 + R() * 380)}" r="${f(1.5 + R() * 2.5)}" fill="#fff8e0" opacity="0.8"/>`);
  // 光の柱(サーチライト)
  for (const [x, a] of [[60, 25], [1020, -25], [300, 10], [780, -10]]) b.push(`<path d="M${x} 620 L${x - 90 + a * 6} 100 L${x + 90 + a * 6} 100Z" fill="#fff6c0" opacity="0.18"/>`);
  // 金の縁どりの大きな観客席
  defs.push(lg('gold', [[0, '#fff3b0'], [0.4, '#f7c948'], [1, '#b8781a']]));
  defs.push(`<clipPath id="bowlH"><path d="M-20 600 Q540 500 1100 600 V900 H-20Z"/></clipPath>`);
  b.push(`<path d="M-20 580 Q540 480 1100 580 V980 H-20Z" fill="#3b2f6e"/>`);
  b.push(`<g clip-path="url(#bowlH)">${stands(R, { top: 520, bottom: 900, tiers: 9, wall: '#4a3b86', wallD: '#3f3276', crowd: ['#ffe066', '#ff7a9c', '#ffb347', '#ffffff', '#9fe0ff'], light: '#ffe9a0' })}</g>`);
  b.push(`<path d="M-20 580 Q540 480 1100 580" stroke="url(#gold)" stroke-width="18" fill="none"/>`);
  b.push(`<path d="M-20 900 H1100 V960 H-20Z" fill="url(#gold)" stroke="#8a5a10" stroke-width="4"/>`);
  // 奥の大きな紋章(星の盾)。子の頭より上
  b.push(`<circle cx="540" cy="420" r="150" fill="#ffe07a" opacity="0.35" filter="url(#blur40)"/>`);
  b.push(`<path d="M540 320 L640 360 V440 Q640 500 540 540 Q440 500 440 440 V360Z" fill="url(#gold)" stroke="#8a5a10" stroke-width="6"/>`);
  b.push(star5(540, 430, 54, '#fff8d8', 'stroke="#c98a1a" stroke-width="4"'));
  b.push(`<path d="M420 470 Q360 480 330 440 Q370 450 420 440Z M660 470 Q720 480 750 440 Q710 450 660 440Z" fill="url(#gold)"/>`);
  // 垂れ幕(赤と金)
  for (const x of [80, 230, 850, 1000]) b.push(`<path d="M${x - 36} 900 H${x + 36} V1010 L${x} 980 L${x - 36} 1010Z" fill="#e2483f" stroke="#8a5a10" stroke-width="4"/>${star5(x, 945, 18, '#ffe066')}`);
  // 床: 赤いじゅうたんの円と金の輪
  defs.push(lg('floor', [[0, '#6b4fa8'], [1, '#4a3480']]));
  b.push(`<rect y="960" width="${W}" height="${H - 960}" fill="url(#floor)"/>`);
  defs.push(rg('stage', [[0, '#ffe9c0'], [0.7, '#f2c27a'], [1, '#d9a050']], 0.45, 0.4, 0.6));
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="470" ry="170" fill="url(#stage)"/>`);
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="470" ry="170" fill="none" stroke="url(#gold)" stroke-width="14"/>`);
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="200" ry="70" fill="#ffffff" opacity="0.35"/>`);
  // 紙吹雪
  for (let i = 0; i < 60; i++) {
    const x = R() * W, y = 250 + R() * 1150;
    if (x > 330 && x < 750 && y > 520 && y < 1190 && R() < 0.75) continue;
    b.push(`<rect x="${f(x)}" y="${f(y)}" width="14" height="7" transform="rotate(${f(R() * 180)} ${f(x)} ${f(y)})" fill="${['#ffe066', '#ff7a9c', '#7fd1ff', '#ffffff', '#ffb347'][i % 5]}"/>`);
  }
  return wrap(defs.join('\n'), b.join('\n'));
}

function venueSummit() {
  const R = rng(44), defs = [], b = [];
  defs.push(lg('sky', [[0, '#3c3a9a'], [0.45, '#b874c8'], [0.75, '#ffb48a'], [1, '#ffe2a0']]));
  b.push(`<rect width="${W}" height="1100" fill="url(#sky)"/>`);
  for (let i = 0; i < 30; i++) b.push(`<circle cx="${f(R() * W)}" cy="${f(100 + R() * 300)}" r="${f(1.5 + R() * 2)}" fill="#fff" opacity="0.7"/>`);
  // 昇る日(奥の真ん中・子の後ろで後光になる)
  defs.push(rg('sun', [[0, '#fffbe0', 1], [0.25, '#ffe08a', 0.8], [1, '#ffb070', 0]]));
  b.push(`<circle cx="540" cy="820" r="420" fill="url(#sun)"/>`);
  // 遠い峰
  b.push(ridge([[-40, 780], [150, 640], [330, 760], [760, 760], [930, 620], [1120, 760]], 900, '#8a6fb4', 'opacity="0.8"'));
  b.push(`<path d="M120 668 L150 640 L182 668 L164 664 L150 676 L136 664Z M900 648 L930 620 L962 648 L944 644 L930 656 L916 644Z" fill="#fff"/>`);
  // 雲の海
  for (let i = 0; i < 14; i++) b.push(cloud(-60 + i * 90, 880 + (i % 3) * 18, 0.9, i % 2 ? '#ffe9e0' : '#fff6ee', 0.95));
  b.push(`<rect y="900" width="${W}" height="80" fill="#fff0e6"/>`);
  // 石の舞台(山の頂)
  b.push(`<path d="M-40 1000 Q540 940 1120 1000 V${H} H-40Z" fill="#9a8a9e"/>`);
  defs.push(rg('plat', [[0, '#f4ead8'], [0.75, '#d6c6ae'], [1, '#b8a68e']], 0.45, 0.4, 0.6));
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="480" ry="180" fill="url(#plat)" stroke="#7d6c80" stroke-width="8"/>`);
  for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; b.push(`<path d="M540 ${FEET_Y} L${f(540 + Math.cos(a) * 480)} ${f(FEET_Y + Math.sin(a) * 180)}" stroke="#b8a68e" stroke-width="3" opacity="0.5"/>`); }
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="180" ry="66" fill="none" stroke="#ffe08a" stroke-width="8" opacity="0.8"/>`);
  // 左右の古い石の柱
  for (const [x, h, broken] of [[70, 560, false], [230, 420, true], [850, 420, true], [1010, 560, false]]) {
    const top = 1100 - h;
    b.push(`<rect x="${x - 42}" y="${top}" width="84" height="${h}" fill="#e6dccb" stroke="#7d6c80" stroke-width="5"/>`);
    for (let k = 1; k < 4; k++) b.push(`<path d="M${x - 42 + k * 21} ${top + 6} V1094" stroke="#c9bba6" stroke-width="4"/>`);
    b.push(broken ? `<path d="M${x - 50} ${top} L${x - 20} ${top - 26} L${x + 6} ${top - 8} L${x + 30} ${top - 30} L${x + 50} ${top}Z" fill="#e6dccb" stroke="#7d6c80" stroke-width="5"/>`
      : `<rect x="${x - 58}" y="${top - 30}" width="116" height="34" fill="#f2e9da" stroke="#7d6c80" stroke-width="5"/>`);
    b.push(`<rect x="${x - 58}" y="1094" width="116" height="30" fill="#d6c6ae" stroke="#7d6c80" stroke-width="5"/>`);
    b.push(`<rect x="${x - 36}" y="${top + 10}" width="12" height="${h - 30}" fill="#ffffff" opacity="0.45"/>`);
  }
  // 光の粒
  for (let i = 0; i < 24; i++) { const x = R() * W, y = 300 + R() * 900; if (x > 330 && x < 750 && y > 520) continue; b.push(star4(x, y, 8 + R() * 10, '#fff6c8', 0.85)); }
  return wrap(defs.join('\n'), b.join('\n'));
}

// ================================================================================
// 修行の段
// ================================================================================
function trainingVolcano() {
  const R = rng(55), defs = [], b = [];
  defs.push(lg('sky', [[0, '#5a2a6a'], [0.5, '#c8506a'], [1, '#ffa060']]));
  b.push(`<rect width="${W}" height="1000" fill="url(#sky)"/>`);
  // けむり
  for (const [x, y, s] of [[820, 300, 1.6], [680, 380, 1.1], [960, 260, 1.2]]) b.push(cloud(x, y, s, '#7a4a6a', 0.55));
  // 火山(右奥)
  b.push(`<path d="M480 900 L760 420 Q800 390 840 420 Q860 400 900 430 L1140 900Z" fill="#6a3a3a" stroke="#3d2020" stroke-width="5"/>`);
  b.push(`<path d="M760 420 Q800 470 840 420 Q860 470 900 430" fill="#ff8a2c"/>`);
  b.push(`<circle cx="830" cy="400" r="140" fill="#ff7a2c" opacity="0.45" filter="url(#blur40)"/>`);
  b.push(`<path d="M820 430 Q790 560 760 700 Q750 760 720 820" stroke="#ff9a3c" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M860 440 Q900 600 960 760" stroke="#ffc060" stroke-width="10" fill="none" stroke-linecap="round"/>`);
  // 左の岩山
  b.push(ridge([[-40, 700], [80, 620], [220, 720], [380, 820], [520, 900]], 1000, '#7a4440'));
  b.push(ridge([[-40, 860], [300, 830], [600, 880], [900, 840], [1120, 870]], 1000, '#8a5048'));
  // 地面(真ん中は明るめの赤茶)
  defs.push(lg('rock', [[0, '#a8604e'], [1, '#7a4038']]));
  b.push(`<rect y="900" width="${W}" height="${H - 900}" fill="url(#rock)"/>`);
  defs.push(rg('plaza', [[0, '#e0a07a'], [0.75, '#bf7a5e'], [1, '#bf7a5e', 0]], 0.45, 0.42, 0.55));
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="400" ry="130" fill="url(#plaza)"/>`);
  // 溶岩の割れ目(左右)
  for (const d of ['M0 1060 Q80 1080 140 1050 Q200 1030 260 1080', 'M820 1080 Q900 1050 960 1090 Q1020 1120 1080 1090', 'M40 1300 Q160 1280 240 1330', 'M860 1320 Q960 1290 1060 1340']) {
    b.push(`<path d="${d}" stroke="#ff7a2c" stroke-width="22" fill="none" opacity="0.5" filter="url(#blur8)"/><path d="${d}" stroke="#ffc860" stroke-width="8" fill="none" stroke-linecap="round"/>`);
  }
  // 岩
  for (const [x, y, s] of [[120, 1000, 1], [960, 1000, 1.2], [60, 1180, 0.8], [1010, 1200, 0.9]]) b.push(`<path d="M${x - 60 * s} ${y + 30 * s} L${x - 40 * s} ${y - 30 * s} L${x + 10 * s} ${y - 50 * s} L${x + 60 * s} ${y - 10 * s} L${x + 66 * s} ${y + 30 * s}Z" fill="#6a3a36" stroke="#3d2020" stroke-width="5"/><path d="M${x - 36 * s} ${y - 24 * s} L${x + 6 * s} ${y - 42 * s}" stroke="#a8685e" stroke-width="6" stroke-linecap="round"/>`);
  // 火の粉
  for (let i = 0; i < 40; i++) { const x = R() * W, y = 300 + R() * 1100; if (x > 330 && x < 750 && y > 520 && y < 1190) continue; b.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(2 + R() * 4)}" fill="${R() < 0.5 ? '#ffd060' : '#ff8a3c'}" opacity="0.9"/>`); }
  return wrap(defs.join('\n'), b.join('\n'));
}

function trainingIceberg() {
  const R = rng(66), defs = [], b = [];
  defs.push(lg('sky', [[0, '#5aa8ff'], [0.6, '#b4e0ff'], [1, '#effaff']]));
  b.push(`<rect width="${W}" height="1000" fill="url(#sky)"/>`);
  // オーロラの帯(昼でもうっすら)
  b.push(`<path d="M-20 360 Q300 260 560 340 Q820 420 1100 300" stroke="#a8ffe0" stroke-width="60" fill="none" opacity="0.35" filter="url(#blur20)"/>`);
  b.push(cloud(140, 420, 0.8, '#fff', 0.9));
  // 氷の山(とがった形)
  const ice = (pts, fill, edge) => `<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${fill}" stroke="${edge}" stroke-width="5" stroke-linejoin="round"/>`;
  b.push(ice([[-20, 900], [80, 560], [180, 640], [300, 470], [420, 900]], '#cfe8ff', '#6a9ac8'));
  b.push(ice([[640, 900], [760, 520], [860, 600], [960, 430], [1100, 900]], '#cfe8ff', '#6a9ac8'));
  b.push(`<path d="M300 470 L260 900 M80 560 L120 900 M960 430 L920 900 M760 520 L800 900" stroke="#ffffff" stroke-width="10" opacity="0.7"/>`);
  b.push(`<path d="M300 470 L340 900 L420 900Z M960 430 L1000 900 L1100 900Z" fill="#9cc4ec" opacity="0.6"/>`);
  b.push(ridge([[-40, 880], [300, 850], [600, 890], [900, 850], [1120, 880]], 1000, '#e2f2ff'));
  // 氷の床
  defs.push(lg('floor', [[0, '#eaf6ff'], [1, '#c4e0f6']]));
  b.push(`<rect y="900" width="${W}" height="${H - 900}" fill="url(#floor)"/>`);
  defs.push(rg('plaza', [[0, '#ffffff'], [0.75, '#dcefff'], [1, '#dcefff', 0]], 0.45, 0.42, 0.55));
  b.push(`<ellipse cx="540" cy="${FEET_Y}" rx="400" ry="130" fill="url(#plaza)"/>`);
  for (const d of ['M60 1080 L160 1110 L210 1090', 'M880 1100 L960 1130 L1040 1110', 'M120 1320 L220 1300 L260 1340', 'M840 1300 L940 1340']) b.push(`<path d="${d}" stroke="#8ab8e0" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  // 氷の柱(左右手前)
  for (const [x, h] of [[90, 260], [170, 180], [940, 240], [1020, 300]]) b.push(`<polygon points="${x - 34},1090 ${x - 10},${1090 - h} ${x + 34},1090" fill="#bfe2ff" stroke="#5a8ac0" stroke-width="5" stroke-linejoin="round"/><path d="M${x - 14} 1080 L${x - 6} ${1100 - h}" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`);
  for (let i = 0; i < 30; i++) { const x = R() * W, y = 300 + R() * 1100; if (x > 330 && x < 750 && y > 520 && y < 1190) continue; b.push(star4(x, y, 6 + R() * 10, '#ffffff', 0.9)); }
  return wrap(defs.join('\n'), b.join('\n'));
}

function trainingWaterfall() {
  const R = rng(77), defs = [], b = [];
  defs.push(lg('sky', [[0, '#5fb4ff'], [0.6, '#b0e2ff'], [1, '#eafaff']]));
  b.push(`<rect width="${W}" height="1000" fill="url(#sky)"/>`);
  b.push(cloud(700, 380, 1, '#fff'), cloud(160, 470, 0.7, '#fff', 0.9));
  // 左の崖と大滝
  b.push(`<path d="M-20 300 L330 340 L360 960 H-20Z" fill="#6aa86a" stroke="#3f6e46" stroke-width="5"/>`);
  b.push(`<path d="M-20 300 L330 340 L332 380 L-20 350Z" fill="#8ad07a"/>`);
  defs.push(lg('fall', [[0, '#e6f8ff'], [1, '#8ad0ff']], 0, 0, 1, 0));
  b.push(`<path d="M120 330 L250 340 L270 980 L100 980Z" fill="url(#fall)"/>`);
  for (let i = 0; i < 7; i++) b.push(`<path d="M${130 + i * 20} 340 L${118 + i * 22} 980" stroke="#ffffff" stroke-width="5" opacity="0.7"/>`);
  b.push(`<ellipse cx="185" cy="985" rx="170" ry="50" fill="#ffffff" opacity="0.8" filter="url(#blur20)"/>`);
  // 右の崖と木
  b.push(`<path d="M760 960 L800 420 L1100 380 V960Z" fill="#7ab47a" stroke="#3f6e46" stroke-width="5"/>`);
  for (const [x, y, r] of [[860, 420, 70], [960, 390, 80], [1060, 400, 70]]) b.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#4fae48"/><circle cx="${x - 20}" cy="${y - 22}" r="${r * 0.5}" fill="#7ad06a"/>`);
  b.push(ridge([[300, 860], [540, 820], [800, 860]], 1000, '#8ac07a'));
  // 川(左の滝つぼから手前へ)
  b.push(`<path d="M0 980 Q200 1000 260 1040 Q300 1090 200 1180 Q120 1260 -20 1300Z" fill="#7fc8f0"/><path d="M40 1020 Q160 1040 210 1080" stroke="#fff" stroke-width="6" fill="none" opacity="0.7"/>`);
  // 草地と岩の平場
  defs.push(lg('grass', [[0, '#9ad874'], [1, '#6cbf52']]));
  b.push(`<path d="M260 960 H${W} V${H} H-20 V1300 Q120 1260 200 1180 Q300 1090 260 1040Z" fill="url(#grass)"/>`);
  defs.push(rg('plaza', [[0, '#e6e2d4'], [0.75, '#c8c2ae'], [1, '#c8c2ae', 0]], 0.45, 0.42, 0.55));
  b.push(`<ellipse cx="560" cy="${FEET_Y}" rx="380" ry="125" fill="url(#plaza)"/>`);
  for (const [x, y, s] of [[920, 1060, 1], [1010, 1120, 0.8], [330, 1080, 0.7]]) b.push(`<ellipse cx="${x}" cy="${y}" rx="${70 * s}" ry="${44 * s}" fill="#a8a89a" stroke="#5a5a50" stroke-width="5"/><ellipse cx="${x - 20 * s}" cy="${y - 16 * s}" rx="${26 * s}" ry="${10 * s}" fill="#d6d6c8"/>`);
  // しぶき
  for (let i = 0; i < 26; i++) { const x = 40 + R() * 340, y = 900 + R() * 260; b.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(3 + R() * 5)}" fill="#ffffff" opacity="0.8"/>`); }
  // 虹(滝のそば)
  b.push(`<g opacity="0.45" fill="none" stroke-width="12"><path d="M60 900 Q200 640 380 860" stroke="#ff8a8a"/><path d="M76 904 Q200 660 366 864" stroke="#ffd060"/><path d="M92 908 Q200 680 352 868" stroke="#8ae08a"/><path d="M108 912 Q200 700 338 872" stroke="#8ab8ff"/></g>`);
  return wrap(defs.join('\n'), b.join('\n'));
}

// ---- 表の id → 絵 ------------------------------------------------------------------
function artFor(sc) {
  if (sc.kind === 'home') return homeScene(sc.season, sc.time);
  const fn = {
    'venue-debut': venueDebut, 'venue-cup': venueCup, 'venue-hero': venueHero, 'venue-summit': venueSummit,
    'training-volcano': trainingVolcano, 'training-iceberg': trainingIceberg, 'training-waterfall': trainingWaterfall,
  }[sc.id];
  if (!fn) throw new Error(`絵がありません: ${sc.id}(scene-art.js に描き方を足す)`);
  return fn();
}

const pngPath = (sc) => path.join(ROOT, 'monster-hero', sc.image.split('?')[0]);

async function main() {
  const checkOnly = process.argv.includes('--check');
  const onlyIdx = process.argv.indexOf('--only');
  const only = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;
  const problems = [];
  for (const sc of SUCCESS_SCENES) {
    if (!/^images\/success\/scenes\/[a-z0-9-]+\.png/.test(sc.image)) problems.push(`${sc.id}: image の置き場所が違う`);
    if (path.basename(sc.image.split('?')[0], '.png') !== sc.id) problems.push(`${sc.id}: image のファイル名が id と違う`);
  }
  if (checkOnly) {
    for (const sc of SUCCESS_SCENES) {
      if (!fs.existsSync(path.join(SVG_DIR, `${sc.id}.svg`))) problems.push(`${sc.id}: SVG がない`);
      if (!fs.existsSync(pngPath(sc))) problems.push(`${sc.id}: PNG がない`);
    }
    if (problems.length) { console.error('NG\n  ' + problems.join('\n  ')); process.exit(1); }
    console.log(`OK: 景色 ${SUCCESS_SCENES.length}枚の SVG と PNG がそろっている`);
    return;
  }
  if (problems.length) { console.error('NG\n  ' + problems.join('\n  ')); process.exit(1); }
  const sharp = require('sharp');
  fs.mkdirSync(SVG_DIR, { recursive: true });
  fs.mkdirSync(PNG_DIR, { recursive: true });
  let total = 0;
  for (const sc of SUCCESS_SCENES) {
    if (only && sc.id !== only) continue;
    const svg = artFor(sc);
    fs.writeFileSync(path.join(SVG_DIR, `${sc.id}.svg`), svg);
    // 色数を絞った PNG(通信量を抑える。グラデーションはディザで段を目立たなくする)
    await sharp(Buffer.from(svg)).resize(W, H).png({ compressionLevel: 9, palette: true, quality: 90, colours: 192, dither: 0.6 }).toFile(pngPath(sc));
    const size = fs.statSync(pngPath(sc)).size;
    total += size;
    console.log(`  ${sc.id}.png  ${(size / 1024).toFixed(0)}KB`);
  }
  console.log(`作った: ${(total / 1024).toFixed(0)}KB`);
  await makeSheet(sharp);
  console.log(`一覧の絵: ${path.relative(ROOT, SHEET)}`);
}

// 一覧の絵: 1枚ごとに「景色だけ」と「帯・ボタン・育てる子を重ねた見え方」を並べる
async function makeSheet(sharp) {
  const tw = 216, th = 384, gap = 14, pairW = tw * 2 + gap, cols = 4, labelH = 34, pad = 24;
  const rows = Math.ceil(SUCCESS_SCENES.length / cols);
  const SW = pad * 2 + cols * pairW + (cols - 1) * 36, SH = pad * 2 + 60 + rows * (th + labelH + 26);
  const k = tw / W;
  const child = await sharp(CHILD).resize(Math.round(650 * k), Math.round(650 * k)).toBuffer();
  // 重ねる帯とボタン(暗い紺+ピンク・オレンジ・黄。見本 v3 の色)
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${th}">
    <rect width="${tw}" height="${f(th * 0.15)}" fill="#1c1d4a" opacity="0.96"/>
    <rect x="8" y="10" width="70" height="16" rx="8" fill="#ff7a9c"/><rect x="${tw - 70}" y="10" width="62" height="16" rx="8" fill="#ffcf4a"/>
    <rect x="8" y="34" width="${tw - 16}" height="8" rx="4" fill="#3a3c7a"/><rect x="8" y="34" width="${(tw - 16) * 0.6}" height="8" rx="4" fill="#7ee08a"/>
    <rect y="${f(th * 0.7)}" width="${tw}" height="${f(th * 0.3)}" fill="#1c1d4a" opacity="0.97"/>
    <rect x="6" y="${f(th * 0.7 + 8)}" width="${tw - 12}" height="16" rx="5" fill="#2c2e66"/>
    <rect x="6" y="${f(th * 0.7 + 30)}" width="48" height="34" rx="8" fill="#3a3c7a"/><rect x="60" y="${f(th * 0.7 + 30)}" width="96" height="34" rx="8" fill="#ff8a6b"/><rect x="162" y="${f(th * 0.7 + 30)}" width="48" height="34" rx="8" fill="#3a3c7a"/>
    ${[0, 1, 2, 3].map((i) => `<rect x="${6 + i * 52}" y="${f(th * 0.7 + 70)}" width="48" height="28" rx="7" fill="#33357a"/>`).join('')}
    <rect x="6" y="${f(th * 0.15 + 8)}" width="22" height="120" rx="6" fill="#1c1d4a" opacity="0.7"/>
  </svg>`);
  const layers = [];
  let svgText = '';
  SUCCESS_SCENES.forEach((sc, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const x = pad + c * (pairW + 36), y = pad + 60 + r * (th + labelH + 26);
    svgText += `<text x="${x}" y="${y + 22}" font-size="20" font-family="sans-serif" fill="#ffffff">${sc.name}</text>`;
    layers.push({ x, y: y + labelH, sc });
  });
  const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}"><rect width="100%" height="100%" fill="#15163a"/>
    <text x="${pad}" y="${pad + 34}" font-size="28" font-family="sans-serif" fill="#ffd56b">モンヒロサクセスの景色(左: 景色だけ / 右: 帯・ボタン・育てる子を重ねた見え方)</text>${svgText}</svg>`);
  const comps = [];
  for (const { x, y, sc } of layers) {
    const thumb = await sharp(pngPath(sc)).resize(tw, th).toBuffer();
    comps.push({ input: thumb, left: x, top: y });
    const over = await sharp(thumb).composite([
      { input: child, left: Math.round(tw / 2 - 325 * k), top: Math.round((FEET_Y - 560) * k) },
      { input: overlay, left: 0, top: 0 },
    ]).toBuffer();
    comps.push({ input: over, left: x + tw + gap, top: y });
  }
  await sharp(bg).composite(comps).png({ compressionLevel: 9, palette: true }).toFile(SHEET);
}

main().catch((e) => { console.error(e); process.exit(1); });
