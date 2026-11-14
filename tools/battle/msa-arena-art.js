#!/usr/bin/env node
// モンヒロサクセスの試合の場(MsaStage)の背景「闘技場」4枚を、Claude が SVG で描いて PNG にする道具(2026-11-14 バトル部)
//
// 社長「バトル中の背景がサッカー場みたいなのが気になった。参考資料の中にバトル中もあると思うから背景はそっちにならってつくってほしい。
//       ただせっかくサッカー場みたいのも作ったからオプションで選べるように」
// 参考(docs/reference/line-mf/battle-video-2026-11-13.mp4)からは「奥に石の観客席と門・階段・かがり火、手前に岩の地面と床の紋章」
// という組み立て方だけを見た。絵・形・色は写していない。外の画像AIは使っていない。
//
//   node tools/battle/msa-arena-art.js           SVG を tools/art-sources/success/arena/ に、PNG(1280×960)を
//                                                 monster-hero/images/success/arena/ に書く
//   node tools/battle/msa-arena-art.js --check   4枚の SVG と PNG がそろっているかだけ見る
//
// 場の決まり(横 1280×960・場は background-size:cover で中央合わせ):
//   ・横長の場(390×290 ほど)ではほぼ全体、縦長の場(β の観戦)では左右が切れる → 見どころ(門)は真ん中に置く
//   ・子は下のほう(y≈780〜900)に立つ。足もとの床は色の差を小さくして子が浮いて見えるようにする
//   ・上の帯(ライフ・ガッツ)が y<230 ほどに重なる。そこは観客席の暗めの段にする
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SVG_DIR = path.join(ROOT, 'tools', 'art-sources', 'success', 'arena');
const PNG_DIR = path.join(ROOT, 'monster-hero', 'images', 'success', 'arena');
const W = 1280, H = 960;
const IDS = ['arena-debut', 'arena-cup', 'arena-hero', 'arena-summit'];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f = (n) => (+n).toFixed(1);
const lg = (id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a]) =>
    `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
const rg = (id, stops, cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a]) =>
    `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`).join('')}</radialGradient>`;
const hx = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };

// 弧の高さ: 真ん中がいちばん奥(上)、左右へ行くほど手前(下)に下がる
const arc = (x, top, drop) => top + drop * Math.pow((x - W / 2) / (W / 2), 2);
const arcPath = (top, drop, bottom) => {
  let d = `M0 ${bottom} L0 ${f(arc(0, top, drop))}`;
  for (let x = 32; x <= W; x += 32) d += ` L${x} ${f(arc(x, top, drop))}`;
  return d + ` L${W} ${bottom}Z`;
};
const arcLine = (top, drop) => { let d = `M0 ${f(arc(0, top, drop))}`; for (let x = 32; x <= W; x += 32) d += ` L${x} ${f(arc(x, top, drop))}`; return d; };

// 会場ごとの色
const PAL = {
  'arena-debut': { // 昼の砂岩の闘技場
    sky: ['#7cc4ff', '#bfe4ff', '#fff3d6'], cloud: '#ffffff', stone: '#e6c99a', stoneD: '#b8935f', stoneL: '#f6e2bd', line: '#7a5a34',
    seat: '#c9a676', crowd: ['#ff8a8a', '#ffd166', '#8ecae6', '#ffffff', '#b5e48c', '#f4a261'], open: '#5a3d22',
    floor: ['#e9c992', '#d6ad72', '#c08f55'], crack: '#a77a45', glow: null, gate: '#ffe4a8', fire: ['#fff3b0', '#ffb703', '#fb8500'],
    flags: ['#ff7a9c', '#ffd23f', '#7fd1ff', '#9be27a'], emblem: '#fff4d8', dim: 0.0, seed: 11,
  },
  'arena-cup': { // 夕方の石の闘技場(かがり火)
    sky: ['#3d3a6b', '#c0607a', '#ffb070'], cloud: '#ffc9a8', stone: '#a99a8c', stoneD: '#6f6258', stoneL: '#cbbcae', line: '#3b2d26',
    seat: '#85766a', crowd: ['#ffb4a2', '#ffd166', '#e5e5e5', '#a3c4f3', '#f28482', '#cdb4db'], open: '#2c1f1a',
    floor: ['#a9754f', '#8c5a3a', '#6e4129'], crack: '#5a3420', glow: null, gate: '#ffb45e', fire: ['#fff1b8', '#ffb347', '#e8590c'],
    flags: ['#e63946', '#ffb703', '#457b9d', '#e63946'], emblem: '#f2d3a8', dim: 0.06, seed: 22,
  },
  'arena-hero': { // 夜の溶岩の闘技場
    sky: ['#1a1022', '#4a2030', '#8a3a2a'], cloud: '#6a3a3a', stone: '#6e5850', stoneD: '#3e302c', stoneL: '#93786c', line: '#1c1210',
    seat: '#4e3e38', crowd: ['#ff9f80', '#ffd6a0', '#c9b8b0', '#ffcf6b', '#e07a5f', '#a5a0c8'], open: '#1a0d0a',
    floor: ['#8a3c28', '#6a2a1c', '#4a1a12'], crack: '#2a0d08', glow: '#ff7a1a', gate: '#ff6a1a', fire: ['#fff3b0', '#ff9a1f', '#d62828'],
    flags: ['#b51d2a', '#e9a23b', '#b51d2a', '#e9a23b'], emblem: '#ffb070', dim: 0.1, seed: 33,
  },
  'arena-summit': { // 雲の上の白い闘技場(たそがれ)
    sky: ['#2c2a6e', '#8a6bc0', '#ffc8b8'], cloud: '#fff0f4', stone: '#eee8f2', stoneD: '#b9aecb', stoneL: '#ffffff', line: '#5d5277',
    seat: '#cfc4dd', crowd: ['#ffe066', '#ffffff', '#ffb3c6', '#a0e7ff', '#c8b6ff', '#ffd6a5'], open: '#4a3f68',
    floor: ['#e4dcef', '#c9bedb', '#a99cc0'], crack: '#9a8db4', glow: null, gate: '#fff2b8', fire: ['#ffffff', '#c7f0ff', '#7ab8ff'],
    flags: ['#f7c948', '#ffffff', '#f7c948', '#ffffff'], emblem: '#f7c948', dim: 0.04, seed: 44,
  },
};

function arena(id) {
  const P = PAL[id], R = rng(P.seed), defs = [], b = [];
  const WALL_TOP = 330, WALL_DROP = 70;     // 手前の壁(床との境)の上
  const FLOOR_TOP = 452, FLOOR_DROP = 90;   // 床が始まる線(壁の下)
  const STAND_TOP = 120, STAND_DROP = 50;   // 観客席のいちばん上

  // 空
  defs.push(lg('sky', [[0, P.sky[0]], [0.6, P.sky[1]], [1, P.sky[2]]]));
  b.push(`<rect width="${W}" height="${H}" fill="url(#sky)"/>`);
  defs.push(`<filter id="soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>`);
  defs.push(`<filter id="soft4"><feGaussianBlur stdDeviation="4"/></filter>`);
  defs.push(`<filter id="glowF" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>`);
  for (let i = 0; i < 7; i++) {
    const x = R() * W, y = 20 + R() * 90;
    b.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(90 + R() * 120)}" ry="${f(18 + R() * 16)}" fill="${P.cloud}" opacity="${f(0.35 + R() * 0.3)}" filter="url(#soft)"/>`);
  }
  if (id === 'arena-summit') for (let i = 0; i < 40; i++) b.push(`<circle cx="${f(R() * W)}" cy="${f(R() * 110)}" r="${f(1 + R() * 2)}" fill="#fff" opacity="${f(0.5 + R() * 0.5)}"/>`);
  if (id === 'arena-hero') for (let i = 0; i < 26; i++) b.push(`<circle cx="${f(R() * W)}" cy="${f(R() * 120)}" r="${f(1 + R() * 2)}" fill="#ffb070" opacity="${f(0.4 + R() * 0.5)}"/>`);

  // 外の壁(アーチの並ぶ外周)。観客席の上のふち
  defs.push(lg('stone', [[0, P.stoneL], [0.5, P.stone], [1, P.stoneD]]));
  const RIM = STAND_TOP - 46;
  b.push(`<path d="${arcPath(RIM, STAND_DROP, WALL_TOP + 40)}" fill="url(#stone)" stroke="${P.line}" stroke-width="3"/>`);
  for (let x = 20; x < W; x += 64) {
    const y = arc(x + 22, RIM, STAND_DROP);
    b.push(`<path d="M${x} ${f(y + 46)} V${f(y + 22)} Q${x + 22} ${f(y + 4)} ${x + 44} ${f(y + 22)} V${f(y + 46)}Z" fill="${P.open}" opacity="0.85"/>`);
  }
  // 旗(外のふちの上)
  [[60, 0], [250, 1], [450, 2], [830, 3], [1030, 0], [1220, 1]].forEach(([x, k]) => {
    const y = arc(x, RIM, STAND_DROP);
    const c = P.flags[k % P.flags.length];
    b.push(`<path d="M${x} ${f(y)} V${f(y - 70)}" stroke="${P.line}" stroke-width="4"/>`);
    b.push(`<path d="M${x + 2} ${f(y - 70)} Q${x + 26} ${f(y - 76)} ${x + 48} ${f(y - 62)} Q${x + 26} ${f(y - 56)} ${x + 2} ${f(y - 46)}Z" fill="${c}" stroke="${P.line}" stroke-width="2"/>`);
  });

  // 観客席の段(弧の帯を重ねる)と観客
  defs.push(`<clipPath id="standC"><path d="${arcPath(STAND_TOP, STAND_DROP, H)}"/></clipPath>`);
  const tiers = 7, tierH = (WALL_TOP - STAND_TOP + 6) / tiers;
  let st = `<path d="${arcPath(STAND_TOP, STAND_DROP, H)}" fill="${P.seat}"/>`;
  for (let t = 0; t < tiers; t++) {
    const top = STAND_TOP + t * tierH;
    const shade = mix(P.seat, '#000000', 0.06 + (t % 2) * 0.06);
    st += `<path d="${arcPath(top, STAND_DROP, H)}" fill="${shade}"/>`;
    st += `<path d="${arcLine(top, STAND_DROP)}" stroke="${P.stoneL}" stroke-width="2" fill="none" opacity="0.55"/>`;
    // 観客(頭と肩の小さな形)。真ん中の門の上は少しまばら
    for (let x = 6 + (t % 2) * 9; x < W; x += 15 + R() * 6) {
      if (R() < 0.12) continue;
      const y = arc(x, top, STAND_DROP) + tierH * 0.62;
      const c = P.crowd[Math.floor(R() * P.crowd.length)];
      const op = f(0.55 + R() * 0.35);
      st += `<path d="M${f(x - 6)} ${f(y + 8)} Q${f(x)} ${f(y - 2)} ${f(x + 6)} ${f(y + 8)}Z" fill="${mix(c, '#000000', 0.35)}" opacity="${op}"/>`;
      st += `<circle cx="${f(x)}" cy="${f(y - 4)}" r="4.2" fill="${c}" opacity="${op}"/>`;
    }
  }
  b.push(`<g clip-path="url(#standC)">${st}</g>`);
  // 観客席を少し奥へ沈める(子より目立たせない)
  b.push(`<path d="${arcPath(STAND_TOP, STAND_DROP, WALL_TOP + 20)}" fill="#000000" opacity="${f(0.1 + P.dim)}"/>`);

  // 手前の壁(床との境)。石の積み
  b.push(`<path d="${arcPath(WALL_TOP, WALL_DROP, FLOOR_TOP + FLOOR_DROP + 10)}" fill="url(#stone)" stroke="${P.line}" stroke-width="4"/>`);
  defs.push(`<clipPath id="wallC"><path d="${arcPath(WALL_TOP, WALL_DROP, H)}"/></clipPath>`);
  let wl = '';
  for (let row = 0; row < 5; row++) {
    const yOff = row * 26 + 26;
    wl += `<path d="${arcLine(WALL_TOP + yOff, WALL_DROP)}" stroke="${P.stoneD}" stroke-width="2" fill="none" opacity="0.7"/>`;
    for (let x = (row % 2) * 40; x < W; x += 80) {
      const y = arc(x, WALL_TOP + yOff - 26, WALL_DROP);
      wl += `<path d="M${x} ${f(y)} v26" stroke="${P.stoneD}" stroke-width="2" opacity="0.6"/>`;
    }
  }
  // 壁の暗いアーチ(門の左右)
  for (const x of [120, 300, 980, 1160]) {
    const y = arc(x, WALL_TOP, WALL_DROP);
    wl += `<path d="M${x - 34} ${f(y + 120)} V${f(y + 52)} Q${x} ${f(y + 18)} ${x + 34} ${f(y + 52)} V${f(y + 120)}Z" fill="${P.open}" stroke="${P.line}" stroke-width="3"/>`;
    wl += `<path d="M${x - 34} ${f(y + 52)} Q${x} ${f(y + 18)} ${x + 34} ${f(y + 52)}" stroke="${P.stoneL}" stroke-width="3" fill="none" opacity="0.7"/>`;
  }
  b.push(`<g clip-path="url(#wallC)">${wl}</g>`);
  b.push(`<path d="${arcLine(WALL_TOP, WALL_DROP)}" stroke="${P.stoneL}" stroke-width="6" fill="none"/>`);

  // 真ん中の門と階段
  const gx = W / 2, gTop = 200, gBot = FLOOR_TOP + 4;
  defs.push(lg('gateIn', [[0, P.fire[0]], [0.45, P.gate], [1, P.fire[2]]]));
  defs.push(rg('gateGlow', [[0, P.gate, 0.75], [1, P.gate, 0]]));
  b.push(`<ellipse cx="${gx}" cy="${gTop + 120}" rx="230" ry="170" fill="url(#gateGlow)"/>`);
  // 門の柱と上の梁
  b.push(`<path d="M${gx - 150} ${gBot} V${gTop + 40} H${gx + 150} V${gBot}Z" fill="url(#stone)" stroke="${P.line}" stroke-width="4"/>`);
  b.push(`<path d="M${gx - 172} ${gTop + 40} H${gx + 172} V${gTop + 12} L${gx} ${gTop - 26} L${gx - 172} ${gTop + 12}Z" fill="${P.stoneL}" stroke="${P.line}" stroke-width="4"/>`);
  b.push(`<circle cx="${gx}" cy="${gTop + 10}" r="16" fill="${P.flags[0]}" stroke="${P.line}" stroke-width="3"/>`);
  // 門の口(奥が光る)
  b.push(`<path d="M${gx - 92} ${gBot - 10} V${gTop + 130} Q${gx} ${gTop + 52} ${gx + 92} ${gTop + 130} V${gBot - 10}Z" fill="url(#gateIn)" stroke="${P.line}" stroke-width="4"/>`);
  if (id === 'arena-hero') b.push(`<path d="M${gx - 30} ${gTop + 90} Q${gx - 10} ${gTop + 200} ${gx - 24} ${gBot - 10} H${gx + 26} Q${gx + 12} ${gTop + 200} ${gx + 30} ${gTop + 90}Z" fill="#ffe08a" opacity="0.8"/>`);
  // 階段(門から床へ広がる)
  const steps = 6;
  for (let s = 0; s < steps; s++) {
    const y0 = gBot - 10 + s * 12, w0 = 100 + s * 20;
    b.push(`<path d="M${gx - w0} ${y0} H${gx + w0} L${gx + w0 + 10} ${y0 + 12} H${gx - w0 - 10}Z" fill="${s % 2 ? P.stone : P.stoneL}" stroke="${P.line}" stroke-width="2"/>`);
  }

  // かがり火の台(門の左右・壁の前)
  defs.push(rg('fireGlow', [[0, P.fire[1], 0.8], [1, P.fire[1], 0]]));
  for (const x of [gx - 250, gx + 250, 40, W - 40]) {
    const base = arc(x, FLOOR_TOP, FLOOR_DROP) + 4;
    const big = Math.abs(x - gx) < 400;
    const hgt = big ? 150 : 120;
    b.push(`<ellipse cx="${x}" cy="${f(base - hgt - 10)}" rx="${big ? 90 : 70}" ry="${big ? 80 : 60}" fill="url(#fireGlow)"/>`);
    b.push(`<path d="M${x - 14} ${f(base)} L${x - 9} ${f(base - hgt)} H${x + 9} L${x + 14} ${f(base)}Z" fill="${P.stoneD}" stroke="${P.line}" stroke-width="3"/>`);
    b.push(`<path d="M${x - 34} ${f(base - hgt)} H${x + 34} L${x + 20} ${f(base - hgt + 22)} H${x - 20}Z" fill="${P.stone}" stroke="${P.line}" stroke-width="3"/>`);
    const fy = base - hgt;
    b.push(`<path d="M${x - 26} ${f(fy)} Q${x - 30} ${f(fy - 30)} ${x - 10} ${f(fy - 48)} Q${x - 8} ${f(fy - 26)} ${x} ${f(fy - 62)} Q${x + 12} ${f(fy - 30)} ${x + 14} ${f(fy - 46)} Q${x + 32} ${f(fy - 24)} ${x + 26} ${f(fy)}Z" fill="${P.fire[2]}"/>`);
    b.push(`<path d="M${x - 15} ${f(fy)} Q${x - 16} ${f(fy - 20)} ${x - 4} ${f(fy - 32)} Q${x} ${f(fy - 18)} ${x + 4} ${f(fy - 40)} Q${x + 16} ${f(fy - 18)} ${x + 15} ${f(fy)}Z" fill="${P.fire[1]}"/>`);
    b.push(`<path d="M${x - 7} ${f(fy)} Q${x - 6} ${f(fy - 14)} ${x + 1} ${f(fy - 22)} Q${x + 8} ${f(fy - 12)} ${x + 7} ${f(fy)}Z" fill="${P.fire[0]}"/>`);
  }

  // 床
  defs.push(lg('floor', [[0, P.floor[0]], [0.5, P.floor[1]], [1, P.floor[2]]]));
  b.push(`<path d="${arcPath(FLOOR_TOP, FLOOR_DROP, H)}" fill="url(#floor)"/>`);
  defs.push(`<clipPath id="floorC"><path d="${arcPath(FLOOR_TOP, FLOOR_DROP, H)}"/></clipPath>`);
  let fl = '';
  // ぼかしたまだら(遠くは小さく・手前は大きく)
  for (let i = 0; i < 70; i++) {
    const y = FLOOR_TOP + Math.pow(R(), 0.8) * (H - FLOOR_TOP), k = 0.4 + (y - FLOOR_TOP) / (H - FLOOR_TOP);
    const x = R() * W;
    fl += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f((40 + R() * 90) * k)}" ry="${f((10 + R() * 20) * k)}" fill="${R() < 0.5 ? P.floor[0] : P.floor[2]}" opacity="${f(0.25 + R() * 0.3)}" filter="url(#soft4)"/>`;
  }
  // ひび(溶岩の会場は光る)
  const cracks = [];
  for (let i = 0; i < 16; i++) {
    let x = R() * W, y = FLOOR_TOP + 30 + R() * (H - FLOOR_TOP - 30);
    let d = `M${f(x)} ${f(y)}`;
    const k = 0.5 + (y - FLOOR_TOP) / (H - FLOOR_TOP);
    const dir = R() < 0.5 ? -1 : 1;
    for (let j = 0; j < 5; j++) { x += dir * (20 + R() * 40) * k; y += (R() - 0.4) * 16 * k; d += ` L${f(x)} ${f(y)}`; }
    cracks.push([d, k]);
  }
  if (P.glow) {
    for (const [d, k] of cracks) fl += `<path d="${d}" stroke="${P.glow}" stroke-width="${f(10 * k)}" fill="none" opacity="0.55" filter="url(#glowF)"/>`;
    for (const [d, k] of cracks) fl += `<path d="${d}" stroke="#ffd27a" stroke-width="${f(2.4 * k)}" fill="none" stroke-linecap="round"/>`;
    // 遠くの溶岩の流れ(壁ぎわ)
    fl += `<path d="${arcLine(FLOOR_TOP + 10, FLOOR_DROP)}" stroke="${P.glow}" stroke-width="18" fill="none" opacity="0.7" filter="url(#glowF)"/>`;
    fl += `<path d="${arcLine(FLOOR_TOP + 6, FLOOR_DROP)}" stroke="#ffcf6b" stroke-width="5" fill="none" opacity="0.9"/>`;
  } else {
    for (const [d, k] of cracks) fl += `<path d="${d}" stroke="${P.crack}" stroke-width="${f(2.6 * k)}" fill="none" opacity="0.6" stroke-linecap="round"/>`;
  }
  // 床の紋章(子が立つあたりの真ん中・薄く)
  const ecx = W / 2, ecy = 790;
  fl += `<g opacity="${id === 'arena-summit' ? 0.7 : 0.42}" fill="none" stroke="${P.emblem}">`;
  fl += `<ellipse cx="${ecx}" cy="${ecy}" rx="470" ry="118" stroke-width="7"/>`;
  fl += `<ellipse cx="${ecx}" cy="${ecy}" rx="430" ry="104" stroke-width="2.5"/>`;
  fl += `<ellipse cx="${ecx}" cy="${ecy}" rx="200" ry="50" stroke-width="4"/>`;
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
    fl += `<path d="M${f(ecx + c * 430)} ${f(ecy + s * 104)} L${f(ecx + c * 470)} ${f(ecy + s * 118)}" stroke-width="3"/>`;
  }
  for (let a = 0; a < 8; a++) {
    const t = (a / 8) * Math.PI * 2 + Math.PI / 8, c = Math.cos(t), s = Math.sin(t);
    fl += `<path d="M${f(ecx + c * 200)} ${f(ecy + s * 50)} L${f(ecx + c * 330)} ${f(ecy + s * 80)}" stroke-width="2" opacity="0.7"/>`;
  }
  fl += `</g>`;
  b.push(`<g clip-path="url(#floorC)">${fl}</g>`);
  // 壁の根元の影
  b.push(`<path d="${arcLine(FLOOR_TOP + 4, FLOOR_DROP)}" stroke="#000000" stroke-width="16" fill="none" opacity="0.22" filter="url(#soft4)"/>`);

  // 頂の会場: 床の外は雲の海(左右の手前に雲)
  if (id === 'arena-summit') {
    for (const [x, y, r] of [[-40, 900, 160], [120, 950, 130], [1320, 900, 160], [1160, 950, 130]]) b.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" opacity="0.75" filter="url(#soft)"/>`);
  }
  // 火の粉 / 光の粒
  const spark = id === 'arena-summit' ? '#fffbe0' : P.fire[1];
  for (let i = 0; i < (id === 'arena-hero' ? 46 : 18); i++) {
    const x = R() * W, y = 140 + R() * 520;
    b.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(1.5 + R() * 2.5)}" fill="${spark}" opacity="${f(0.4 + R() * 0.5)}"/>`);
  }
  // まわりを少し暗く(真ん中へ目が行く)
  defs.push(rg('vig', [[0.55, '#000000', 0], [1, '#000000', 0.38 + P.dim]], 0.5, 0.55, 0.75));
  b.push(`<rect width="${W}" height="${H}" fill="url(#vig)"/>`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
${defs.join('\n')}
</defs>
${b.join('\n')}
</svg>
`;
}

async function main() {
  if (process.argv.includes('--check')) {
    const miss = IDS.flatMap((id) => [path.join(SVG_DIR, `${id}.svg`), path.join(PNG_DIR, `${id}.png`)]).filter((p) => !fs.existsSync(p));
    if (miss.length) { console.error('NG\n  ' + miss.map((p) => path.relative(ROOT, p)).join('\n  ')); process.exit(1); }
    console.log(`OK: 闘技場 ${IDS.length}枚の SVG と PNG がそろっている`);
    return;
  }
  let sharp; try { sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp')); } catch (_) { sharp = require('sharp'); }
  fs.mkdirSync(SVG_DIR, { recursive: true });
  fs.mkdirSync(PNG_DIR, { recursive: true });
  let total = 0;
  for (const id of IDS) {
    const svg = arena(id);
    fs.writeFileSync(path.join(SVG_DIR, `${id}.svg`), svg);
    const out = path.join(PNG_DIR, `${id}.png`);
    await sharp(Buffer.from(svg)).resize(W, H).png({ compressionLevel: 9, palette: true, quality: 90, colours: 192, dither: 0.6 }).toFile(out);
    const size = fs.statSync(out).size; total += size;
    console.log(`  ${id}.png  ${(size / 1024).toFixed(0)}KB`);
  }
  console.log(`作った: ${(total / 1024).toFixed(0)}KB`);
}

main().catch((e) => { console.error(e); process.exit(1); });
