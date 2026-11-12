#!/usr/bin/env node
// モンヒロサクセスのアイテムの絵(15枚)を Claude が SVG で描いて PNG にする道具(2026-11-12 クラフトくん)
//
// 社長「アイテムの絵はクロードで作ったやつでいい。作り込みたくなったらまた考える」。
// そろえ方は docs/progress/player-raise/art/ITEM-ICON-PROMPTS.md の「共通の頭」
//   (正方形・透明背景・やわらかいトゥーン調・光は左上・文字なし・余白は1割ほど)。
// 参考の絵(docs/reference/line-mf/)は見るだけで、形も色も写していない。
//
//   node tools/success/item-icons.js          SVG を tools/art-sources/success/items/ に書き、
//                                             PNG(512×512)を monster-hero/images/success/items/ に作り、
//                                             一覧の絵 docs/progress/player-raise/art/items-sheet.png を作る
//   node tools/success/item-icons.js --check  SVG と PNG がそろっているかだけ確かめる(書かない)
//
// 絵を直すときは、この中の SVG を直して打ち直す(元の SVG は作り直せるよう art-sources に残す)。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SVG_DIR = path.join(ROOT, 'tools', 'art-sources', 'success', 'items');
const PNG_DIR = path.join(ROOT, 'monster-hero', 'images', 'success', 'items');
const SHEET = path.join(ROOT, 'docs', 'progress', 'player-raise', 'art', 'items-sheet.png');
const { SUCCESS_ITEMS } = require(path.join(ROOT, 'monster-hero', 'data', 'success-items.js'));

// ---- 共通の部品 ---------------------------------------------------------------
const OL = '#3d2618';       // ふちの線(こげ茶)。64px でも形が読めるよう太め
const SW = 9;
const line = `stroke="${OL}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"`;
const thin = `stroke="${OL}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
const lg = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) =>
    `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const rg = (id, stops, cx = 0.35, cy = 0.3, r = 0.75) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a]) =>
    `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
// 金(光は左上)
const GOLD = [[0, '#fff3b0'], [0.35, '#f7c948'], [0.75, '#d99a1e'], [1, '#a8680c']];
// 4つ角のきらめき
const sparkle = (x, y, r, fill = '#ffffff', op = 1) =>
  `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z" fill="${fill}" opacity="${op}"/>`;
const star5 = (cx, cy, r, fill, extra = '') => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}" ${extra}/>`;
};
// 足もとの影(全部の絵で同じ)
const groundShadow = (cx = 256, cy = 452, rx = 150, ry = 18) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#2a1a10" opacity="0.22" filter="url(#soft)"/>`;

const wrap = (defs, body, shadow = groundShadow()) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs>
<filter id="soft" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
${defs}
</defs>
${shadow}
${body}
</svg>
`;

// ---- 1つずつの絵 --------------------------------------------------------------
const ART = {};

// 1. 時渡りの砂時計: 金の枠・真珠のように白く光る砂
const hourglass = ({ capA, capB, post, sandTop, sandBot, stream, halo = '', extra = '' }) => {
  const glass = 'M190 112 C190 192 234 222 247 256 C234 290 190 320 190 400 L322 400 C322 320 278 290 265 256 C278 222 322 192 322 112 Z';
  return `${halo}
  <!-- 柱(うしろ) -->
  <rect x="152" y="96" width="22" height="320" rx="11" fill="url(#${post})" ${line}/>
  <rect x="338" y="96" width="22" height="320" rx="11" fill="url(#${post})" ${line}/>
  <!-- ガラス -->
  <path d="${glass}" fill="url(#glass)" ${line}/>
  <clipPath id="gc"><path d="${glass}"/></clipPath>
  <g clip-path="url(#gc)">
    <path d="M196 176 C214 214 238 232 251 256 L261 256 C274 232 298 214 316 176 Z" fill="url(#${sandTop})"/>
    <rect x="252" y="250" width="8" height="96" rx="4" fill="url(#${stream})"/>
    <path d="M186 404 C192 360 226 342 256 332 C286 342 320 360 326 404 Z" fill="url(#${sandBot})"/>
    <path d="M204 126 C204 180 226 210 238 232" stroke="#ffffff" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.75"/>
    <path d="M208 392 C210 368 222 352 236 340" stroke="#ffffff" stroke-width="10" stroke-linecap="round" fill="none" opacity="0.6"/>
  </g>
  <path d="${glass}" fill="none" ${line}/>
  <!-- ふた -->
  <rect x="128" y="62" width="256" height="50" rx="20" fill="url(#${capA})" ${line}/>
  <rect x="128" y="400" width="256" height="50" rx="20" fill="url(#${capA})" ${line}/>
  <rect x="146" y="74" width="220" height="12" rx="6" fill="url(#${capB})" opacity="0.9"/>
  <rect x="146" y="412" width="220" height="12" rx="6" fill="url(#${capB})" opacity="0.9"/>
  <circle cx="163" cy="87" r="9" fill="#ffffff" opacity="0.7"/>
  ${extra}`;
};

ART.hourglass = () => wrap(
  lg('gold', GOLD, 0, 0, 0.4, 1) + lg('goldHi', [[0, '#ffffff', 0.9], [1, '#fff3b0', 0.3]], 0, 0, 1, 0)
  + lg('postG', GOLD, 0, 0, 1, 0)
  + lg('glass', [[0, '#f4fbff', 0.85], [1, '#cfe4f2', 0.75]], 0, 0, 1, 1)
  + lg('pearl', [[0, '#ffffff'], [0.5, '#fbf3ff'], [1, '#e6dcf2']], 0, 0, 1, 1)
  + lg('pearlS', [[0, '#ffffff'], [1, '#efe6f7']]),
  hourglass({ capA: 'gold', capB: 'goldHi', post: 'postG', sandTop: 'pearl', sandBot: 'pearl', stream: 'pearlS',
    extra: sparkle(300, 360, 16) + sparkle(220, 196, 10) + sparkle(398, 150, 20, '#fff6c8') }),
);

// 2. 虹の時渡りの砂時計: 紺と金の豪華な枠・虹色の砂・うしろに虹の光の輪
ART['hourglass-rainbow'] = () => {
  const rainbow = [[0, '#ff6b8b'], [0.2, '#ffb547'], [0.4, '#ffe95c'], [0.6, '#6fe08a'], [0.8, '#5cb8ff'], [1, '#b07cff']];
  const ring = ['#ff6b8b', '#ffb547', '#ffe95c', '#6fe08a', '#5cb8ff', '#b07cff']
    .map((c, i) => `<circle cx="256" cy="256" r="${214 - i * 11}" fill="none" stroke="${c}" stroke-width="12" opacity="0.55"/>`).join('');
  return wrap(
    lg('navy', [[0, '#6a7fd6'], [0.4, '#30419a'], [1, '#151d52']], 0, 0, 0.4, 1)
    + lg('gold', GOLD, 0, 0, 0, 1) + lg('postN', [[0, '#5468c4'], [1, '#1a2463']], 0, 0, 1, 0)
    + lg('glass', [[0, '#f8f4ff', 0.85], [1, '#dcd6f5', 0.75]], 0, 0, 1, 1)
    + lg('rbT', rainbow, 0, 0, 1, 0.3) + lg('rbB', rainbow, 1, 0, 0, 0.4) + lg('rbS', rainbow, 0, 0, 0, 1),
    hourglass({ capA: 'navy', capB: 'gold', post: 'postN', sandTop: 'rbT', sandBot: 'rbB', stream: 'rbS',
      halo: `<g filter="url(#glow)">${ring}</g>`,
      extra: `<circle cx="256" cy="87" r="13" fill="url(#gold)" ${thin}/><circle cx="256" cy="425" r="13" fill="url(#gold)" ${thin}/>`
        + `<circle cx="163" cy="96" r="13" fill="url(#gold)" ${thin}/><circle cx="349" cy="96" r="13" fill="url(#gold)" ${thin}/>`
        + `<circle cx="163" cy="416" r="13" fill="url(#gold)" ${thin}/><circle cx="349" cy="416" r="13" fill="url(#gold)" ${thin}/>`
        + sparkle(406, 128, 22) + sparkle(110, 330, 16) + sparkle(300, 362, 14) + sparkle(222, 196, 10) }),
  );
};

// 3. 博士の導き書: 青い表紙の古いノート・メガネの博士の落書き風の顔・少しくたびれている
ART['doctor-guidebook'] = () => wrap(
  lg('cover', [[0, '#5d9be0'], [0.5, '#2f6fb8'], [1, '#1d4a86']], 0, 0, 1, 1)
  + lg('spine', [[0, '#1f4f8f'], [1, '#143766']], 0, 0, 1, 0)
  + lg('paper', [[0, '#fffaf0'], [1, '#eadfc6']], 0, 0, 0, 1),
  `<g transform="rotate(-7 256 256)">
    <!-- 紙の束(右と下にのぞく) -->
    <path d="M150 92 L384 92 Q398 92 398 106 L398 428 Q398 440 386 440 L150 440 Z" fill="url(#paper)" ${line}/>
    <path d="M386 120 L386 424 M374 430 L160 430" stroke="#d6c7a6" stroke-width="4" fill="none"/>
    <!-- 表紙(右上の角が折れている) -->
    <path d="M122 78 L340 78 L376 114 L376 412 Q376 424 364 424 L134 424 Q122 424 122 412 Z" fill="url(#cover)" ${line}/>
    <path d="M340 78 L340 114 L376 114 Z" fill="#a9c8ec" ${line}/>
    <rect x="122" y="78" width="36" height="346" fill="url(#spine)"/>
    <path d="M122 78 L122 424" ${line} fill="none"/>
    <path d="M158 78 L158 424" stroke="#143766" stroke-width="5"/>
    <!-- 落書きの顔(白い線) -->
    <g fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">
      <path d="M200 236 C200 178 246 150 270 150 C300 150 340 176 340 236 C340 300 302 334 270 334 C236 334 200 300 200 236 Z"/>
      <path d="M206 186 C196 166 212 150 222 162 M238 156 C236 136 258 132 262 150 M290 152 C298 134 318 140 314 160 M328 178 C344 166 352 186 336 196"/>
      <circle cx="244" cy="236" r="22"/><circle cx="300" cy="236" r="22"/><path d="M266 236 L278 236 M222 232 L204 226 M322 232 L338 226"/>
      <path d="M240 280 C252 270 262 274 270 282 C278 274 290 270 302 280 C292 296 280 290 270 286 C260 290 248 296 240 280 Z"/>
    </g>
    <!-- すり切れ・ひかり -->
    <path d="M170 104 C220 98 280 96 320 100" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity="0.45" fill="none"/>
    <path d="M330 380 L356 372 M180 396 L210 402" stroke="#8fb7e6" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
  </g>`,
);

// 4. 博士のルーペ: 黒と金の重ねたレンズ(丸いレンズが3つ重なる)
ART['doctor-loupe'] = () => {
  const lens = (cx, cy, r, i) => `
    <circle cx="${cx}" cy="${cy}" r="${r + 16}" fill="url(#black)" ${line}/>
    <circle cx="${cx}" cy="${cy}" r="${r + 5}" fill="url(#gold)" ${thin}/>
    <circle cx="${cx}" cy="${cy}" r="${r - 4}" fill="url(#lens${i})" ${thin}/>
    <path d="M${cx - r * 0.62} ${cy - r * 0.1} A${r * 0.66} ${r * 0.66} 0 0 1 ${cx - r * 0.08} ${cy - r * 0.62}" stroke="#ffffff" stroke-width="${Math.max(8, r * 0.13)}" stroke-linecap="round" fill="none" opacity="0.85"/>`;
  return wrap(
    lg('black', [[0, '#6b6b78'], [0.35, '#2c2c34'], [1, '#0f0f14']], 0, 0, 0.6, 1)
    + lg('gold', GOLD, 0, 0, 0.5, 1)
    + rg('lens0', [[0, '#ffffff', 0.95], [0.6, '#cfe9f7', 0.9], [1, '#7fb6d6', 0.9]])
    + rg('lens1', [[0, '#ffffff', 0.9], [1, '#9cc6df', 0.9]])
    + rg('lens2', [[0, '#ffffff', 0.9], [1, '#a8cfe4', 0.9]])
    + lg('handle', [[0, '#55555f'], [0.5, '#24242b'], [1, '#0c0c10']], 0, 0, 1, 0),
    `<!-- 柄 -->
    <g transform="rotate(-40 330 360)">
      <rect x="306" y="300" width="52" height="150" rx="24" fill="url(#handle)" ${line}/>
      <rect x="300" y="292" width="64" height="30" rx="10" fill="url(#gold)" ${line}/>
      <rect x="302" y="414" width="60" height="20" rx="8" fill="url(#gold)" ${thin}/>
      <rect x="316" y="326" width="10" height="84" rx="5" fill="#ffffff" opacity="0.3"/>
    </g>
    ${lens(330, 150, 52, 2)}${lens(296, 206, 72, 1)}${lens(212, 236, 104, 0)}
    ${sparkle(132, 152, 18)}`,
    groundShadow(250, 452, 160, 18),
  );
};

// 5. 出会いのミサンガ: 水色・紺・金の糸で編んだ細いミサンガ・結び目の房つき
ART['meeting-misanga'] = () => {
  const ell = 'M256 104 C356 104 412 154 412 214 C412 280 344 318 256 318 C168 318 100 280 100 214 C100 154 156 104 256 104 Z';
  return wrap(
    lg('aqua', [[0, '#bff3ff'], [1, '#3cbfe0']]) + lg('navy', [[0, '#4a62c8'], [1, '#1b2a6e']])
    + lg('gold', GOLD) + lg('tassel', [[0, '#7fdcf2'], [1, '#2a8fb8']]),
    `<!-- 輪(うしろ半分は暗く) -->
    <path d="${ell}" fill="none" stroke="${OL}" stroke-width="50"/>
    <path d="${ell}" fill="none" stroke="#1b2a6e" stroke-width="34"/>
    <path d="${ell}" fill="none" stroke="url(#aqua)" stroke-width="34" stroke-dasharray="22 44"/>
    <path d="${ell}" fill="none" stroke="url(#gold)" stroke-width="34" stroke-dasharray="10 56" stroke-dashoffset="-28"/>
    <path d="M118 176 C150 128 210 118 256 118" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" opacity="0.55"/>
    <!-- 結び目と房 -->
    <g transform="translate(256 318)">
      <path d="M-20 10 C-40 60 -54 96 -62 128" stroke="${OL}" stroke-width="22" stroke-linecap="round" fill="none"/>
      <path d="M-20 10 C-40 60 -54 96 -62 128" stroke="url(#navy)" stroke-width="10" stroke-linecap="round" fill="none"/>
      <path d="M20 10 C36 56 52 92 66 122" stroke="${OL}" stroke-width="22" stroke-linecap="round" fill="none"/>
      <path d="M20 10 C36 56 52 92 66 122" stroke="url(#aqua)" stroke-width="10" stroke-linecap="round" fill="none"/>
      <path d="M-82 120 L-44 120 L-38 170 Q-62 186 -88 170 Z" fill="url(#tassel)" ${line}/>
      <path d="M46 114 L84 114 L92 162 Q66 180 40 162 Z" fill="url(#tassel)" ${line}/>
      <rect x="-86" y="112" width="46" height="16" rx="7" fill="url(#gold)" ${thin}/>
      <rect x="42" y="106" width="46" height="16" rx="7" fill="url(#gold)" ${thin}/>
      <path d="M-72 134 L-70 166 M-58 134 L-58 170 M58 128 L58 160 M72 128 L74 164" stroke="#1c6f94" stroke-width="4" opacity="0.7"/>
      <ellipse cx="0" cy="0" rx="40" ry="30" fill="url(#navy)" ${line}/>
      <path d="M-26 -6 C-10 10 10 10 26 -6 M-24 10 C-8 20 8 20 24 10" stroke="url(#aqua)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <circle cx="-14" cy="-12" r="7" fill="#ffffff" opacity="0.6"/>
    </g>`,
    groundShadow(256, 470, 140, 14),
  );
};

// 6. 週刊!トレーニング: 元気なモンスターのシルエットの表紙・少し開きかけ
ART['weekly-training'] = () => wrap(
  lg('cov', [[0, '#fff27a'], [1, '#ffb52e']], 0, 0, 1, 1) + lg('paper', [[0, '#ffffff'], [1, '#e9e2d4']])
  + lg('band', [[0, '#ff6a5c'], [1, '#d6342a']]) + lg('back', [[0, '#5aa3ff'], [1, '#2d6fd0']]),
  `<g transform="rotate(-6 256 256)">
    <!-- うら表紙と開きかけのページ -->
    <path d="M150 96 L392 110 L392 446 L150 432 Z" fill="url(#back)" ${line}/>
    <path d="M146 92 L374 82 L380 430 L150 438 Z" fill="url(#paper)" ${line}/>
    <path d="M150 300 L376 290 M150 340 L378 330 M150 380 L379 372" stroke="#d8cfbd" stroke-width="5"/>
    <!-- 表紙(右下が少しめくれる) -->
    <path d="M118 74 L356 74 L356 370 Q330 384 318 424 L118 424 Z" fill="url(#cov)" ${line}/>
    <path d="M356 370 Q330 384 318 424 Q348 410 356 370 Z" fill="#fff7d8" ${thin}/>
    <!-- 上の帯(題字のかわりの飾り) -->
    <rect x="118" y="74" width="238" height="70" fill="url(#band)" ${line}/>
    <rect x="140" y="94" width="80" height="14" rx="7" fill="#ffffff" opacity="0.95"/>
    <rect x="140" y="116" width="122" height="12" rx="6" fill="#ffffff" opacity="0.7"/>
    ${star5(318, 109, 22, '#ffe45c', thin)}
    <!-- 集中線 -->
    <g stroke="#ffffff" stroke-width="6" stroke-linecap="round" opacity="0.7">
      <path d="M236 196 L236 160 M300 214 L330 184 M172 214 L144 186 M320 274 L350 270 M152 274 L124 276"/>
    </g>
    <!-- 元気なモンスターの影(力こぶ) -->
    <g fill="#3a2a6e">
      <path d="M190 300 C190 236 214 206 238 206 C262 206 286 236 286 300 C286 352 262 380 238 380 C214 380 190 352 190 300 Z"/>
      <path d="M204 224 L196 186 L224 210 Z M272 224 L280 186 L252 210 Z"/>
      <path d="M278 286 C300 286 312 276 316 248 C318 234 336 232 340 246 C346 270 330 304 288 314 Z"/>
      <circle cx="334" cy="238" r="16"/>
      <path d="M198 290 C176 300 162 318 158 340 C156 352 170 356 176 346 C182 332 192 322 206 318 Z"/>
      <path d="M210 372 L204 404 L228 404 L230 378 Z M246 378 L248 404 L272 404 L266 372 Z"/>
    </g>
    <ellipse cx="226" cy="262" rx="7" ry="10" fill="#ffffff"/><ellipse cx="252" cy="262" rx="7" ry="10" fill="#ffffff"/>
    <path d="M228 292 Q240 304 252 292" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M132 160 L132 400" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity="0.35"/>
  </g>`,
);

// 7. 修行のハチマキ: 赤地に金のひし形もよう・結び目がひらりと
ART['training-hachimaki'] = () => {
  // 輪を斜め上から見た形。前の帯にひし形を並べる
  const cx = 236, cy = 236, rx = 150, ry = 78;
  let dia = '';
  for (let i = 0; i < 7; i++) {
    const t = Math.PI * (0.12 + i * 0.128);
    const x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t) + 6;
    const s = 15 * (0.75 + 0.25 * Math.sin(t));
    dia += `<path d="M${x.toFixed(1)} ${(y - s).toFixed(1)} L${(x + s * 0.8).toFixed(1)} ${y.toFixed(1)} L${x.toFixed(1)} ${(y + s).toFixed(1)} L${(x - s * 0.8).toFixed(1)} ${y.toFixed(1)} Z" fill="url(#gold)" stroke="${OL}" stroke-width="4"/>`;
  }
  const front = `M${cx - rx} ${cy} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy}`;
  const back = `M${cx - rx} ${cy} A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`;
  return wrap(
    lg('red', [[0, '#ff7a6b'], [0.5, '#e8382c'], [1, '#a81b17']]) + lg('redD', [[0, '#b52a22'], [1, '#7a1410']])
    + lg('gold', GOLD) + lg('tail', [[0, '#ff6b5c'], [1, '#b81f19']], 0, 0, 1, 1),
    `<!-- うしろの帯 -->
    <path d="${back}" fill="none" stroke="${OL}" stroke-width="58"/>
    <path d="${back}" fill="none" stroke="url(#redD)" stroke-width="42"/>
    <!-- 結び目からのびる2本の端(ひらり) -->
    <path d="M384 236 C420 270 404 330 446 376 L412 404 C376 360 384 300 356 262 Z" fill="url(#tail)" ${line}/>
    <path d="M378 232 C438 238 452 300 496 318 L478 356 C430 334 420 276 366 262 Z" fill="url(#tail)" ${line}/>
    <path d="M402 336 L428 330 M452 300 L470 310" stroke="#f7c948" stroke-width="6" stroke-linecap="round"/>
    <!-- 前の帯 -->
    <path d="${front}" fill="none" stroke="${OL}" stroke-width="58"/>
    <path d="${front}" fill="none" stroke="url(#red)" stroke-width="42"/>
    <path d="M${cx - rx + 18} ${cy + 30} A${rx - 10} ${ry - 10} 0 0 0 ${cx - 30} ${cy + ry - 4}" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="0.45"/>
    ${dia}
    <!-- 結び目 -->
    <ellipse cx="376" cy="248" rx="30" ry="26" fill="url(#red)" ${line}/>
    <path d="M362 238 Q376 230 390 240" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.6"/>`,
    groundShadow(260, 430, 170, 18),
  );
};

// 8. 縁結びのお守り: 丸い白いお守り(星もよう)・青いひもと青い房が2本
ART['bond-charm'] = () => wrap(
  rg('white', [[0, '#ffffff'], [0.7, '#f1f4fa'], [1, '#cdd6e6']]) + lg('blue', [[0, '#6fb2ff'], [1, '#1f56b8']])
  + lg('tas', [[0, '#5aa6ff'], [1, '#1a3f9a']]) + lg('gold', GOLD),
  `<!-- ひもの輪 -->
  <path d="M232 128 C206 74 226 40 256 40 C286 40 306 74 280 128" fill="none" stroke="${OL}" stroke-width="22" stroke-linecap="round"/>
  <path d="M232 128 C206 74 226 40 256 40 C286 40 306 74 280 128" fill="none" stroke="url(#blue)" stroke-width="10" stroke-linecap="round"/>
  <!-- 房のひも -->
  <path d="M206 330 C196 360 180 380 166 398 M306 330 C316 360 332 380 346 398" stroke="${OL}" stroke-width="20" stroke-linecap="round" fill="none"/>
  <path d="M206 330 C196 360 180 380 166 398 M306 330 C316 360 332 380 346 398" stroke="url(#blue)" stroke-width="8" stroke-linecap="round" fill="none"/>
  <!-- 丸いお守り -->
  <circle cx="256" cy="238" r="122" fill="url(#white)" ${line}/>
  <circle cx="256" cy="238" r="100" fill="none" stroke="#9cc3f0" stroke-width="6" stroke-dasharray="4 12" stroke-linecap="round"/>
  ${star5(256, 238, 40, '#5ea0f0', thin)}
  ${star5(200, 182, 15, '#a9cdf6')}${star5(316, 186, 13, '#a9cdf6')}${star5(316, 292, 15, '#a9cdf6')}${star5(196, 292, 12, '#a9cdf6')}
  <path d="M170 190 C186 152 214 132 246 126" stroke="#ffffff" stroke-width="12" stroke-linecap="round" fill="none" opacity="0.9"/>
  <!-- 上の結び目 -->
  <ellipse cx="256" cy="122" rx="34" ry="22" fill="url(#blue)" ${line}/>
  <path d="M236 118 Q256 108 276 118" stroke="#ffffff" stroke-width="5" fill="none" opacity="0.6" stroke-linecap="round"/>
  <!-- 房2本 -->
  <path d="M146 392 L186 392 L194 446 Q166 462 138 446 Z" fill="url(#tas)" ${line}/>
  <path d="M326 392 L366 392 L374 446 Q346 462 318 446 Z" fill="url(#tas)" ${line}/>
  <rect x="140" y="384" width="52" height="18" rx="8" fill="url(#gold)" ${thin}/>
  <rect x="320" y="384" width="52" height="18" rx="8" fill="url(#gold)" ${thin}/>
  <path d="M156 408 L154 444 M170 408 L170 448 M336 408 L334 444 M350 408 L350 448" stroke="#0f2a6e" stroke-width="4" opacity="0.6"/>`,
  groundShadow(256, 470, 140, 14),
);

// 9. モモのキビダンゴ: ピンクの透明な袋に入った桃色のおだんご・赤いひもで口を結ぶ
ART['momo-kibidango'] = () => {
  const ball = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#dango)" stroke="#c46a74" stroke-width="5"/><ellipse cx="${x - r * 0.35}" cy="${y - r * 0.4}" rx="${r * 0.28}" ry="${r * 0.18}" fill="#ffffff" opacity="0.85"/>`;
  return wrap(
    rg('dango', [[0, '#fff1f0'], [0.55, '#ffc2c4'], [1, '#f08f9b']]) + lg('bag', [[0, '#ffd6ea', 0.55], [1, '#ff9cc8', 0.55]], 0, 0, 1, 1)
    + lg('bagTop', [[0, '#ffe3f1', 0.8], [1, '#ffb3d6', 0.8]]) + lg('red', [[0, '#ff6b6b'], [1, '#c4252a']]),
    `<!-- 袋の口(ひらひら) -->
    <path d="M196 156 L176 76 L208 96 L230 66 L256 92 L282 66 L304 96 L336 76 L316 156 Z" fill="url(#bagTop)" ${line}/>
    <!-- おだんご(袋の中) -->
    ${ball(196, 352, 56)}${ball(312, 352, 56)}${ball(254, 370, 58)}${ball(222, 270, 52)}${ball(292, 268, 54)}
    <!-- 袋 -->
    <path d="M200 160 C120 200 100 300 118 380 C130 432 190 446 256 446 C322 446 382 432 394 380 C412 300 392 200 312 160 Z" fill="url(#bag)" ${line}/>
    <path d="M150 230 C130 280 128 340 142 392" stroke="#ffffff" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.75"/>
    <path d="M362 240 C372 270 374 300 370 324" stroke="#ffffff" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.5"/>
    ${sparkle(170, 210, 14)}
    <!-- 赤いひもと蝶結び -->
    <rect x="186" y="146" width="140" height="24" rx="12" fill="url(#red)" ${line}/>
    <path d="M256 158 C220 120 186 130 196 160 C204 182 236 170 256 158 Z" fill="url(#red)" ${line}/>
    <path d="M256 158 C292 120 326 130 316 160 C308 182 276 170 256 158 Z" fill="url(#red)" ${line}/>
    <path d="M248 166 C238 196 226 214 214 226 M264 166 C276 196 290 212 304 222" stroke="${OL}" stroke-width="20" stroke-linecap="round" fill="none"/>
    <path d="M248 166 C238 196 226 214 214 226 M264 166 C276 196 290 212 304 222" stroke="url(#red)" stroke-width="9" stroke-linecap="round" fill="none"/>
    <circle cx="256" cy="158" r="15" fill="url(#red)" ${thin}/>`,
  );
};

// 10. うけつぎ草: 白くてふわふわの花が束になった草・緑の葉が下に
ART['uketsugi-grass'] = () => {
  const puff = (x, y, r) => {
    let s = `<circle cx="${x}" cy="${y}" r="${r}" fill="${OL}"/>`;
    const n = 9;
    const rim = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      rim.push([x + Math.cos(a) * r * 0.72, y + Math.sin(a) * r * 0.72]);
    }
    s += rim.map(([px, py]) => `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(r * 0.42 + 6).toFixed(1)}" fill="${OL}"/>`).join('');
    s += rim.map(([px, py]) => `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(r * 0.42).toFixed(1)}" fill="url(#fluff)"/>`).join('');
    s += `<circle cx="${x}" cy="${y}" r="${r * 0.82}" fill="url(#fluff)"/>`;
    s += `<circle cx="${x - r * 0.32}" cy="${y - r * 0.34}" r="${r * 0.3}" fill="#ffffff"/>`;
    s += `<circle cx="${x + r * 0.1}" cy="${y + r * 0.1}" r="${r * 0.14}" fill="#f6edc8"/>`;
    return s;
  };
  return wrap(
    rg('fluff', [[0, '#ffffff'], [0.7, '#f4f6f1'], [1, '#d2dcd0']]) + lg('leaf', [[0, '#9be27a'], [1, '#3f9a3a']], 0, 0, 1, 1)
    + lg('leaf2', [[0, '#7bd06a'], [1, '#2e7a32']], 1, 0, 0, 1) + lg('stem', [[0, '#7cc95e'], [1, '#3b8a34']]),
    `<!-- 茎 -->
    <g fill="none" stroke-linecap="round">
      <path d="M256 430 C250 330 210 250 168 178 M256 430 C258 320 262 230 266 136 M256 430 C268 330 304 260 350 190" stroke="${OL}" stroke-width="20"/>
      <path d="M256 430 C250 330 210 250 168 178 M256 430 C258 320 262 230 266 136 M256 430 C268 330 304 260 350 190" stroke="url(#stem)" stroke-width="9"/>
    </g>
    <!-- 葉 -->
    <path d="M250 420 C190 410 132 370 112 300 C170 312 222 350 250 420 Z" fill="url(#leaf)" ${line}/>
    <path d="M262 420 C322 412 380 372 404 300 C344 314 290 352 262 420 Z" fill="url(#leaf2)" ${line}/>
    <path d="M256 430 C236 380 238 330 256 290 C276 330 278 380 256 430 Z" fill="url(#leaf)" ${line}/>
    <path d="M240 404 C200 380 160 350 136 316 M272 404 C312 380 352 350 380 316" stroke="#2e7a32" stroke-width="5" fill="none" opacity="0.6" stroke-linecap="round"/>
    <!-- ふわふわの花 -->
    ${puff(166, 178, 62)}${puff(352, 190, 58)}${puff(266, 128, 70)}
    ${sparkle(410, 112, 16, '#ffffff')}${sparkle(112, 112, 12, '#ffffff')}`,
  );
};

// 11. ガロエ印の野菜ジュース: オレンジ色のびん・白いラベル(文字なし)
ART['garoe-veggie-juice'] = () => {
  const bottle = 'M222 92 L290 92 L290 148 C290 172 346 190 346 250 L346 412 Q346 442 316 442 L196 442 Q166 442 166 412 L166 250 C166 190 222 172 222 148 Z';
  return wrap(
    lg('glass', [[0, '#ffe3b5', 0.85], [1, '#ffcf8a', 0.85]], 0, 0, 1, 0) + lg('juice', [[0, '#ffb347'], [0.5, '#ff8a1f'], [1, '#e2620d']], 0, 0, 1, 1)
    + lg('cap', [[0, '#7fdc6a'], [1, '#2f8f35']]) + lg('label', [[0, '#ffffff'], [1, '#ece6da']], 0, 0, 0, 1)
    + lg('carrot', [[0, '#ffa64d'], [1, '#e25d10']]),
    `<path d="${bottle}" fill="url(#glass)" ${line}/>
    <clipPath id="bc"><path d="${bottle}"/></clipPath>
    <g clip-path="url(#bc)">
      <rect x="150" y="196" width="220" height="260" fill="url(#juice)"/>
      <path d="M150 196 Q200 186 256 196 Q312 206 370 196 L370 210 L150 210 Z" fill="#ffd08a" opacity="0.8"/>
      <rect x="180" y="210" width="20" height="216" rx="10" fill="#ffffff" opacity="0.55"/>
      <rect x="230" y="104" width="12" height="70" rx="6" fill="#ffffff" opacity="0.7"/>
    </g>
    <path d="${bottle}" fill="none" ${line}/>
    <!-- ラベル(文字なし・人参と葉の絵) -->
    <rect x="166" y="268" width="180" height="116" rx="10" fill="url(#label)" ${line}/>
    <path d="M232 296 L284 316 L238 364 Z" fill="url(#carrot)" ${thin}/>
    <path d="M276 304 C290 286 308 288 310 300 C300 302 292 306 284 312 M276 308 C300 304 312 318 304 326 C296 318 290 316 282 314" fill="#5cc254" ${thin}/>
    <path d="M246 320 L258 324 M244 336 L254 340" stroke="#b9470c" stroke-width="4" stroke-linecap="round"/>
    <!-- ふた -->
    <rect x="210" y="56" width="92" height="48" rx="12" fill="url(#cap)" ${line}/>
    <path d="M226 64 L226 98 M246 64 L246 98 M266 64 L266 98 M286 64 L286 98" stroke="#2a7030" stroke-width="5" opacity="0.6"/>
    <rect x="218" y="62" width="20" height="10" rx="5" fill="#ffffff" opacity="0.6"/>
    ${sparkle(372, 170, 16)}`,
    groundShadow(256, 452, 120, 16),
  );
};

// 12. 悪様散: 白いすり鉢に入った茶色い粉薬・木のさじつき
ART.akusamasan = () => wrap(
  lg('bowl', [[0, '#ffffff'], [0.6, '#eef0f2'], [1, '#c9ced6']], 0, 0, 1, 1) + lg('inner', [[0, '#d5d9e0'], [1, '#f6f7f9']])
  + rg('powder', [[0, '#d7a46a'], [0.6, '#a86a34'], [1, '#7a4720']], 0.4, 0.3, 0.8) + lg('wood', [[0, '#f2c98a'], [1, '#b47a3c']], 0, 0, 1, 0)
  + lg('foot', [[0, '#e6e8ec'], [1, '#aeb4be']]),
  `<!-- さじ(うしろ) -->
  <g transform="rotate(32 300 190)">
    <rect x="288" y="40" width="26" height="210" rx="13" fill="url(#wood)" ${line}/>
    <rect x="294" y="52" width="6" height="150" rx="3" fill="#ffffff" opacity="0.5"/>
  </g>
  <!-- 鉢 -->
  <path d="M206 410 L306 410 L318 446 L194 446 Z" fill="url(#foot)" ${line}/>
  <path d="M86 226 C90 340 160 418 256 418 C352 418 422 340 426 226 Z" fill="url(#bowl)" ${line}/>
  <path d="M120 270 C134 336 176 380 226 396" stroke="#ffffff" stroke-width="14" stroke-linecap="round" fill="none" opacity="0.9"/>
  <path d="M160 300 C180 340 210 360 240 368 M300 368 C330 360 352 340 370 306" stroke="#d8dce3" stroke-width="5" fill="none" stroke-linecap="round"/>
  <ellipse cx="256" cy="226" rx="170" ry="52" fill="url(#inner)" ${line}/>
  <!-- 粉の山 -->
  <path d="M120 236 C150 172 214 150 256 150 C304 150 362 176 392 236 C352 262 300 268 256 268 C210 268 156 262 120 236 Z" fill="url(#powder)" ${line}/>
  <path d="M170 196 C200 172 236 164 262 166" stroke="#f2cd98" stroke-width="10" stroke-linecap="round" fill="none" opacity="0.8"/>
  <circle cx="310" cy="208" r="5" fill="#6a3c18"/><circle cx="214" cy="226" r="4" fill="#6a3c18"/><circle cx="284" cy="238" r="4" fill="#6a3c18"/>
  <!-- さじの先(粉にささる) -->
  <g transform="rotate(32 300 190)">
    <ellipse cx="301" cy="252" rx="30" ry="40" fill="url(#wood)" ${line}/>
    <ellipse cx="301" cy="246" rx="18" ry="22" fill="url(#powder)"/>
  </g>`,
);

// 13. ブリーダーライセンス: 金色のカード型の免許証(人の影・文字なし)
ART['breeder-license'] = () => wrap(
  lg('gold', GOLD, 0, 0, 1, 1) + lg('panel', [[0, '#fffbe6'], [1, '#f3e2a6']]) + lg('photo', [[0, '#bfe3ff'], [1, '#7fb8e6']])
  + lg('shine', [[0, '#ffffff', 0], [0.5, '#ffffff', 0.75], [1, '#ffffff', 0]], 0, 0, 1, 0),
  `<g transform="rotate(-8 256 256)">
    <rect x="66" y="128" width="380" height="250" rx="28" fill="url(#gold)" ${line}/>
    <rect x="84" y="146" width="344" height="214" rx="18" fill="none" stroke="#fff3b0" stroke-width="5" opacity="0.8"/>
    <!-- 写真の枠と人の影 -->
    <rect x="102" y="176" width="124" height="150" rx="14" fill="url(#photo)" ${thin}/>
    <clipPath id="ph"><rect x="102" y="176" width="124" height="150" rx="14"/></clipPath>
    <g clip-path="url(#ph)" fill="#3a4f7a">
      <circle cx="164" cy="232" r="32"/>
      <path d="M100 330 C104 284 132 268 164 268 C196 268 224 284 228 330 Z"/>
    </g>
    <rect x="102" y="176" width="124" height="150" rx="14" fill="none" ${thin}/>
    <!-- 文字のかわりの線 -->
    <rect x="248" y="186" width="160" height="22" rx="11" fill="url(#panel)" ${thin}/>
    <rect x="248" y="226" width="124" height="16" rx="8" fill="#b9800f" opacity="0.6"/>
    <rect x="248" y="256" width="142" height="16" rx="8" fill="#b9800f" opacity="0.6"/>
    <rect x="248" y="286" width="100" height="16" rx="8" fill="#b9800f" opacity="0.6"/>
    <!-- 星のしるし -->
    <circle cx="390" cy="312" r="30" fill="#e8454a" ${thin}/>
    ${star5(390, 312, 20, '#ffe45c')}
    <!-- 光の筋 -->
    <clipPath id="cc"><rect x="66" y="128" width="380" height="250" rx="28"/></clipPath>
    <g clip-path="url(#cc)"><path d="M150 100 L210 100 L110 420 L50 420 Z" fill="url(#shine)"/><path d="M226 100 L248 100 L148 420 L126 420 Z" fill="#ffffff" opacity="0.35"/></g>
    <rect x="66" y="128" width="380" height="250" rx="28" fill="none" ${line}/>
  </g>
  ${sparkle(420, 116, 20)}${sparkle(98, 394, 14)}`,
  groundShadow(256, 440, 170, 16),
);

// 14. オイリーパック: 黄緑色の小さなオイルのびん2本と、緑の葉っぱの詰め合わせ
ART['oily-pack'] = () => {
  const bottle = (x, y, s, rot) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
      <path d="M-26 -120 L26 -120 L26 -84 C26 -70 70 -56 70 -6 L70 80 Q70 104 46 104 L-46 104 Q-70 104 -70 80 L-70 -6 C-70 -56 -26 -70 -26 -84 Z" fill="url(#oilG)" ${line}/>
      <path d="M-70 10 L70 10 L70 80 Q70 104 46 104 L-46 104 Q-70 104 -70 80 Z" fill="url(#oil)" opacity="0.95"/>
      <path d="M-70 -6 L70 -6 L70 80 Q70 104 46 104 L-46 104 Q-70 104 -70 80 Z" fill="none" ${line}/>
      <path d="M-50 -20 C-52 20 -52 50 -46 84" stroke="#ffffff" stroke-width="12" stroke-linecap="round" fill="none" opacity="0.7"/>
      <rect x="-34" y="-158" width="68" height="44" rx="12" fill="url(#cork)" ${line}/>
      <rect x="-24" y="-150" width="16" height="10" rx="5" fill="#ffffff" opacity="0.5"/>
      <circle cx="0" cy="48" r="22" fill="#ffffff" opacity="0.9" ${thin}/>
      <path d="M-8 52 C-8 36 6 32 12 38 C10 50 2 56 -8 52 Z" fill="#5cc254"/>
    </g>`;
  const leaf = (x, y, rot, s) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
      <path d="M0 0 C30 -40 90 -46 130 -30 C100 10 40 24 0 0 Z" fill="url(#leaf)" ${line}/>
      <path d="M8 -4 C50 -22 90 -28 120 -28" stroke="#2e7a32" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>`;
  return wrap(
    lg('oilG', [[0, '#f6ffd8', 0.85], [1, '#dff2a8', 0.85]], 0, 0, 1, 0) + lg('oil', [[0, '#e6f55a'], [1, '#9fcc1f']])
    + lg('cork', [[0, '#e8c48c'], [1, '#a6743a']]) + lg('leaf', [[0, '#9be27a'], [1, '#3f9a3a']], 0, 0, 1, 1),
    `${leaf(250, 400, -150, 1.2)}${leaf(262, 400, -30, 1.25)}${leaf(256, 410, -95, 1.05)}
    ${bottle(184, 290, 1.0, -8)}${bottle(330, 296, 0.92, 9)}
    ${leaf(200, 430, -10, 0.9)}${leaf(320, 432, -170, 0.85)}
    ${sparkle(420, 150, 16)}${sparkle(96, 168, 12)}`,
  );
};

// 15. 修行チケット: 金色の紙のチケット・こぶしの絵(文字なし)
ART['training-ticket'] = () => {
  // 左右に半円のかけ込みがあるチケット
  const t = 'M76 150 L436 150 L436 222 A34 34 0 0 0 436 290 L436 362 L76 362 L76 290 A34 34 0 0 0 76 222 Z';
  return wrap(
    lg('gold', GOLD, 0, 0, 1, 1) + rg('disc', [[0, '#fff6cf'], [1, '#f2c24a']]) + lg('fist', [[0, '#ffe2c4'], [1, '#f2a877']], 0, 0, 0, 1)
    + lg('shine', [[0, '#ffffff', 0], [0.5, '#ffffff', 0.7], [1, '#ffffff', 0]], 0, 0, 1, 0),
    `<g transform="rotate(-10 256 256)">
      <path d="${t}" fill="url(#gold)" ${line}/>
      <path d="M100 170 L412 170 M100 342 L412 342" stroke="#fff3b0" stroke-width="5" opacity="0.7"/>
      <path d="M310 168 L310 346" stroke="#a8680c" stroke-width="6" stroke-dasharray="12 12" stroke-linecap="round"/>
      <!-- 右の半券: 星 -->
      ${star5(374, 256, 34, '#fff6cf', thin)}
      <!-- こぶしのしるし -->
      <circle cx="196" cy="256" r="86" fill="url(#disc)" ${line}/>
      <g transform="translate(196 262)">
        <path d="M-56 -30 Q-56 -52 -36 -52 L36 -52 Q58 -52 58 -30 L58 22 Q58 58 20 58 L-26 58 Q-56 58 -56 26 Z" fill="url(#fist)" ${line}/>
        <path d="M-28 -52 L-28 -18 M0 -52 L0 -18 M28 -52 L28 -18" stroke="${OL}" stroke-width="6" stroke-linecap="round"/>
        <path d="M-58 -2 Q-30 -12 6 -6 Q22 -2 18 12 Q14 24 -10 20 L-56 18" fill="url(#fist)" ${thin}/>
        <path d="M-46 -44 Q-40 -48 -34 -44 M-18 -44 Q-12 -48 -6 -44 M10 -44 Q16 -48 22 -44" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.8"/>
      </g>
      <g stroke="#e8454a" stroke-width="7" stroke-linecap="round"><path d="M110 176 L124 194 M92 228 L112 234 M282 176 L268 194 M300 228 L280 234"/></g>
      <clipPath id="tc"><path d="${t}"/></clipPath>
      <g clip-path="url(#tc)"><path d="M120 120 L170 120 L90 400 L40 400 Z" fill="url(#shine)"/></g>
      <path d="${t}" fill="none" ${line}/>
    </g>
    ${sparkle(430, 122, 20)}${sparkle(84, 392, 14)}`,
    groundShadow(256, 430, 170, 16),
  );
};

// ---- 書き出し -----------------------------------------------------------------
async function main() {
  const checkOnly = process.argv.includes('--check');
  const ids = SUCCESS_ITEMS.map((it) => it.id);
  const missingArt = ids.filter((id) => !ART[id]);
  const extraArt = Object.keys(ART).filter((id) => !ids.includes(id));
  if (missingArt.length || extraArt.length) {
    console.error(`✗ 絵と表が合わない: 絵が無い ${missingArt.join(',') || 'なし'} / 表に無い ${extraArt.join(',') || 'なし'}`);
    process.exit(1);
  }
  if (checkOnly) {
    const lack = ids.filter((id) => !fs.existsSync(path.join(SVG_DIR, `${id}.svg`)) || !fs.existsSync(path.join(PNG_DIR, `${id}.png`)));
    console.log(lack.length ? `✗ そろっていない: ${lack.join(', ')}` : `✓ ${ids.length}枚の SVG と PNG がそろっている`);
    process.exit(lack.length ? 1 : 0);
  }
  const sharp = require('sharp');
  fs.mkdirSync(SVG_DIR, { recursive: true });
  fs.mkdirSync(PNG_DIR, { recursive: true });
  for (const it of SUCCESS_ITEMS) {
    const svg = ART[it.id]();
    fs.writeFileSync(path.join(SVG_DIR, `${it.id}.svg`), svg);
    // 2倍で描いてから縮める(ふちをなめらかに)
    await sharp(Buffer.from(svg), { density: 144 }).resize(512, 512)
      .png({ compressionLevel: 9, palette: true, quality: 92, effort: 10 })
      .toFile(path.join(PNG_DIR, `${it.id}.png`));
  }
  await makeSheet(sharp);
  const total = SUCCESS_ITEMS.reduce((n, it) => n + fs.statSync(path.join(PNG_DIR, `${it.id}.png`)).size, 0);
  console.log(`✓ ${SUCCESS_ITEMS.length}枚を書いた(PNG 合計 ${(total / 1024).toFixed(0)}KB)/ 一覧 ${path.relative(ROOT, SHEET)}`);
}

// 一覧の絵: 1枚ごとに「160px(暗い地)・64px(明るい地)・64px(暗い地)・名前」
async function makeSheet(sharp) {
  const cols = 5, cw = 300, ch = 270;
  const rows = Math.ceil(SUCCESS_ITEMS.length / cols);
  const W = cols * cw, H = rows * ch;
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#f4efe6"/>`;
  SUCCESS_ITEMS.forEach((it, i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    const kindCol = it.kind === 'retry' ? '#8a6cd6' : it.kind === 'start' ? '#3f8fd6' : it.kind === 'use' ? '#e0832a' : '#7a7a7a';
    bg += `<rect x="${x + 8}" y="${y + 8}" width="${cw - 16}" height="${ch - 16}" rx="14" fill="#ffffff" stroke="${kindCol}" stroke-width="4"/>`;
    bg += `<rect x="${x + 20}" y="${y + 20}" width="170" height="170" rx="10" fill="#1d2440"/>`;
    bg += `<rect x="${x + 206}" y="${y + 24}" width="76" height="76" rx="8" fill="#fbf6ea" stroke="#d9cfba"/>`;
    bg += `<rect x="${x + 206}" y="${y + 112}" width="76" height="76" rx="8" fill="#1d2440"/>`;
    bg += `<text x="${x + cw / 2}" y="${y + 222}" font-family="WenQuanYi Zen Hei" font-size="20" text-anchor="middle" fill="#3d2618">${i + 1}. ${esc(it.name)}</text>`;
    bg += `<text x="${x + cw / 2}" y="${y + 246}" font-family="DejaVu Sans" font-size="14" text-anchor="middle" fill="#7a6a5a">${it.id}</text>`;
  });
  bg += '</svg>';
  const layers = [];
  for (let i = 0; i < SUCCESS_ITEMS.length; i++) {
    const it = SUCCESS_ITEMS[i];
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    const src = path.join(PNG_DIR, `${it.id}.png`);
    layers.push({ input: await sharp(src).resize(160, 160).toBuffer(), left: x + 25, top: y + 25 });
    const small = await sharp(src).resize(64, 64).toBuffer();
    layers.push({ input: small, left: x + 212, top: y + 30 });
    layers.push({ input: small, left: x + 212, top: y + 118 });
  }
  await sharp(Buffer.from(bg)).composite(layers).png({ compressionLevel: 9, palette: true }).toFile(SHEET);
}

main().catch((e) => { console.error(e); process.exit(1); });
