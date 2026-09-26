#!/usr/bin/env node
// 味方モンスターの待機アニメを「いちばん動いた瞬間」で合成して、切れ目・抜けを目で確かめる画像を作る。
//
//   node tools/monster/idle-rig-preview.js [出力先フォルダ] [ID ...]   … 既定は全員。1体1枚の PNG を書く
//   node tools/monster/idle-rig-preview.js --report [ID ...]          … 抜けの大きさを数えて表で出す(画像は作らない)
//
// 【なぜ道具にするか】(2026-09-24 ユーザー指摘「よーく見ると尻尾が切れてる」「羽が切れてる」「全部確認して改善して」)
// 待機アニメは同じ絵を部分のマスクで切り抜いて重ね、部分だけを回す。切り抜きが部分を取りこぼすと
// 取りこぼした所が体の側に残って「切れて」見え、部分を回したときに体の側が空くと穴が見える。
// どちらも 58px のバトルの枠では気づきにくく、図鑑の大きな立ち絵で初めて見える。
// ブラウザで止めて撮るより、ここで同じ計算をして合成するほうが速く、全員を同じ条件で見比べられる。
//
// 【1枚の中身】1段目: 元の絵 / 体だけ(部分を抜いた残り。部分の取りこぼしがここに残る)
//              2段目以降: 止まっているとき・部分をいちばん振った2つの姿勢。元の絵より薄くなった所を赤紫で塗る
// 表示と同じく、正方形の枠へ絵とマスクを contain で置き、軸は MONSTER_IDLE_RIGS の origin(枠の %)を使う。
// 全体の動き(浮く・弾む…)は絵全体が一緒に動くだけで切れ目を作らないので、ここでは動かさない。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
// 合成する枠の大きさ(px)。図鑑の立ち絵はスマホで 540px 前後(CSS 180px × 3倍)で描かれるので、それに合わせる
const S = Number(process.env.IDLE_PREVIEW_SIZE) || 600;
const BG = [34, 44, 70];
const HOLE = [255, 0, 200];

// 表示に使っている表とマスクのパスを、そのまま読む
const loadRigs = () => {
  const ctx = { Object, Array, String, Number, Math };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(GAME, 'data/images/images-ally.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(GAME, 'data/ally-monsters.js'), 'utf8'), ctx);
  const fx = fs.readFileSync(path.join(GAME, 'src/parts/24-battle-fx.jsx'), 'utf8');
  const a = fx.indexOf('const MONSTER_IDLE_RIGS ='), b = fx.indexOf('// ==== MONSTER_IDLE_RIGS ここまで');
  vm.runInContext(fx.slice(a, b) + '\nthis.__r = MONSTER_IDLE_RIGS; this.__m = ALL_PLAYER_MONSTERS;', ctx);
  return { rigs: ctx.__r, monsters: ctx.__m };
};
const fileOf = (url) => path.join(GAME, String(url).split('?')[0]);

// 正方形の枠へ contain で置いた RGBA(S×S)
const inBox = async (file) => sharp(file).resize(S, S, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();

// 部分をいちばん振った姿勢(角度・横の縮み・縦のずれ)。keyframes(70-bootstrap.jsx)の極の値
const posesOf = (part, flip) => {
  const a = part.amp;
  if (part.rest) return [{ rot: 0, sx: 1 }, { rot: 0, sx: 1 }];
  switch (part.anim) {
    case 'flapL': return [{ rot: a * -0.2, sx: 1 }, { rot: a, sx: 0.9 }];
    case 'flapR': return [{ rot: -a * -0.2, sx: 1 }, { rot: -a, sx: 0.9 }];
    case 'swing': return [{ rot: a * -0.4, sx: 1 }, { rot: a, sx: 1 }];
    case 'swingIn': return [{ rot: 0, sx: 1 }, { rot: a, sx: 1 }];
    case 'wag': return [{ rot: -a, sx: 1 }, { rot: a, sx: 1 }];
    case 'twitch': return [{ rot: 0, sx: 1 }, { rot: a, sx: 1 }];
    case 'bob': return [{ rot: 0, sx: 1 }, { rot: 0, sx: 1, dy: a / 100 * S }];
    default: return [{ rot: 0, sx: 1 }, { rot: 0, sx: 1 }];
  }
};

// src(RGBA) を origin 中心に rotate(deg) scaleX(sx) → translateY(dy) した画像(双一次補間)
const transform = (src, [ox, oy], { rot = 0, sx = 1, dy = 0 }) => {
  if (!rot && sx === 1 && !dy) return src;
  const out = Buffer.alloc(S * S * 4);
  const t = -rot * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    // 逆変換: 平行移動を戻す → 回転を戻す → 横の縮みを戻す
    const qx = x - ox, qy = y - dy - oy;
    const rx = (qx * c - qy * s) / sx, ry = qx * s + qy * c;
    const px = rx + ox, py = ry + oy;
    const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
    if (x0 < 0 || y0 < 0 || x0 + 1 >= S || y0 + 1 >= S) continue;
    const o = (y * S + x) * 4;
    // 透明の縁で色が黒ずまないよう、アルファを掛けてから補間する
    let A = 0, R = 0, G = 0, B = 0;
    for (const [dx, dyy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
      const i = ((y0 + dyy) * S + x0 + dx) * 4, al = src[i + 3] * w;
      A += al; R += src[i] * al; G += src[i + 1] * al; B += src[i + 2] * al;
    }
    if (A > 0) { out[o] = R / A; out[o + 1] = G / A; out[o + 2] = B / A; out[o + 3] = Math.min(255, A); }
  }
  return out;
};
const masked = (img, mask) => {
  const out = Buffer.from(img);
  for (let i = 0; i < S * S; i++) out[i * 4 + 3] = Math.round(img[i * 4 + 3] * mask[i * 4 + 3] / 255);
  return out;
};
// 下から順に重ねる(ふつうの「上に重ねる」合成)
const over = (dst, src) => {
  for (let i = 0; i < S * S; i++) {
    const sa = src[i * 4 + 3] / 255; if (!sa) continue;
    const da = dst[i * 4 + 3] / 255, oa = sa + da * (1 - sa);
    for (let k = 0; k < 3; k++) dst[i * 4 + k] = Math.round((src[i * 4 + k] * sa + dst[i * 4 + k] * da * (1 - sa)) / oa);
    dst[i * 4 + 3] = Math.round(oa * 255);
  }
};
const originPx = (origin) => origin.split(' ').map(v => parseFloat(v) / 100 * S);

// 1つの姿勢を合成し、抜け(元は不透明なのに合成で薄くなった画素)を数える
const compose = (img, body, parts, poseIndex) => {
  const out = Buffer.alloc(S * S * 4);
  const layers = (which) => parts.filter(p => (p.layer === 'back') === (which === 'back'));
  for (const p of layers('back')) over(out, transform(p.img, originPx(p.origin), posesOf(p)[poseIndex]));
  if (body) over(out, body);
  for (const p of layers('front')) over(out, transform(p.img, originPx(p.origin), posesOf(p)[poseIndex]));
  let holes = 0;
  const hole = Buffer.alloc(S * S);
  // ★元は不透明なのに合成で薄くなった画素。境目で体と部分の両方が半透明になると、止まっていても細い線が見える
  //   (2026-09-24 ユーザー指摘「まだ切れがある」)。その薄さも拾う
  for (let i = 0; i < S * S; i++) if (img[i * 4 + 3] > 200 && out[i * 4 + 3] < img[i * 4 + 3] - 25) { hole[i] = 1; holes++; }
  return { out, hole, holes };
};
const flatten = (rgba, hole) => {
  const rgb = Buffer.alloc(S * S * 3);
  for (let i = 0; i < S * S; i++) {
    const a = rgba[i * 4 + 3] / 255;
    for (let k = 0; k < 3; k++) rgb[i * 3 + k] = hole && hole[i] ? HOLE[k] : Math.round(rgba[i * 4 + k] * a + BG[k] * (1 - a));
  }
  return rgb;
};

const buildOne = async (id, rig, mon) => {
  const img = await inBox(fileOf(mon.imgUrl));
  const parts = [];
  for (const p of rig.parts) parts.push({ ...p, img: masked(img, await inBox(fileOf(p.mask))) });
  const body = rig.bodyMask ? masked(img, await inBox(fileOf(rig.bodyMask))) : img;
  const rest = parts.map(p => ({ ...p, rest: true }));
  const poses = parts.length ? [compose(img, body, rest, 0), compose(img, body, parts, 0), compose(img, body, parts, 1)] : [];
  return { img, body, poses };
};

(async () => {
  const args = process.argv.slice(2);
  const report = args.includes('--report');
  const rest = args.filter(a => a !== '--report');
  const outDir = !report && rest[0] && !/^[A-Z]/.test(rest[0]) ? rest.shift() : null;
  const { rigs, monsters } = loadRigs();
  const ids = rest.length ? rest : Object.keys(rigs);
  if (!report) fs.mkdirSync(outDir || '.', { recursive: true });
  const rows = [];
  for (const id of ids) {
    const rig = rigs[id], mon = monsters[id];
    if (!rig || !mon) { console.log(`${id}: 表にありません`); continue; }
    const r = await buildOne(id, rig, mon);
    rows.push({ id, parts: rig.parts.length, holes: r.poses.map(p => p.holes) });
    if (report) continue;
    const tile = (rgb) => sharp(rgb, { raw: { width: S, height: S, channels: 3 } }).png().toBuffer();
    const tiles = [await tile(flatten(r.img)), await tile(flatten(r.body))];
    for (const p of r.poses) tiles.push(await tile(flatten(p.out, p.hole)));
    const cols = 2, rowsN = Math.ceil(tiles.length / cols);
    const file = path.join(outDir || '.', `idle-${id}.png`);
    await sharp({ create: { width: S * cols, height: S * rowsN, channels: 3, background: { r: 10, g: 12, b: 20 } } })
      .composite(tiles.map((input, i) => ({ input, left: (i % cols) * S, top: Math.floor(i / cols) * S }))).png().toFile(file);
  }
  console.log(`ID            部分  抜け(止まっているとき / 姿勢1 / 姿勢2 の画素数。枠${S}px)`);
  for (const r of rows) console.log(`${r.id.padEnd(13)} ${String(r.parts).padStart(3)}   ${r.holes.length ? r.holes.join(' / ') : '—'}`);
})();
