#!/usr/bin/env node
// 味方モンスターの待機アニメ(翼の羽ばたき・しっぽの揺れ など)の「切り抜き」と「動かし方の表」を作る。
//
// 【仕組み】(2026-09-24 ユーザー指示「ミーアで試して」→「他の味方モンスターもアニメーション実装よろしく」)
// 絵は1枚のPNGなので描き足しはしない。同じ絵を「体」と「動かす部分(翼・しっぽ・耳・花…)」に
// マスクで切り抜いて重ね、部分だけを付け根を軸に回す。全体の動き(浮く・跳ねる・呼吸…)は種ごとに1つ。
//
// 【ここで書くもの】
// RIGS の1体ぶん = { id, img, body, parts:[{ name, poly, pivot, anim, amp, dur, delay, layer }] }
//   poly  : 切り抜く範囲。元絵の左上を(0,0)、右下を(100,100)とした % の多角形
//   pivot : 回す軸。同じく元絵の %
//   anim  : flapL / flapR(羽ばたき) / swing(ゆったり揺れ) / wag(しっぽ振り) / twitch(ときどきピクッ) / bob(上下)
//   layer : back(体の後ろ) / front(体の前)。翼・しっぽは back、頭の上の花や耳は front
//   keep  : 多角形の中でも、この色の画素だけを部分にする(毛・腕・体を巻き込まないため)。
//           { minLum, maxLum }(明るさ0〜255) / { hue:[下,上], minSat }(色相0〜360・彩度0〜1)
//           orDark:N … 明るさNより暗い画素(輪郭線)は色に関係なく部分に入れる
//   share : 付け根の重なり。この多角形の中の画素は、部分と体の両方に描く(2026-09-24 ユーザー指摘「よーく見ると切れてる」)。
//           部分を回すと付け根のつなぎ目にすき間が開き、背景が細く見えて「切れて」見えた。
//           back(体の後ろ)の部分なら、体のふちの画素を部分にも持たせる→止まっているときは体に隠れ、動くとすき間を埋める。
//           front(体の前)の部分なら、部分の根元の画素を体にも残す→部分が動いて空いた所に同じ絵が見える。
//           付け根の近く(軸のまわり)だけを小さく囲む。広く取ると、止まっている絵が二重に見える
//   確かめ方: node tools/monster/idle-rig-preview.js <出力先> <ID> … いちばん動いた姿勢を合成し、抜けを赤紫で塗る
// masks:{ body:定数名 } と部分の mask:定数名 で、手で作ったマスクを直接使うこともできる(いまは誰も使っていない)。
//
// 【出すもの】
//   monster-hero/images/monsters/idle/<id>-<name>.png … 部分のマスク(少し太らせる)
//   monster-hero/images/monsters/idle/<id>-body.png   … 体のマスク(部分を抜いた残り)
//   data/images/images-ally.js の「待機アニメのマスク」区画 … 画像のパス(?v= は build.js が付ける)
//   src/parts/24-battle-fx.jsx の「MONSTER_IDLE_RIGS」区画 … 動かし方の表(軸は正方形の枠での % に直す)
//
//   node tools/monster/idle-rig-build.js        … 作り直す(そのあと node tools/build.js)
//   node tools/monster/idle-rig-build.js --check … 表・マスクが今の定義と合っているかだけ見る
'use strict';
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const OUT_DIR = path.join(GAME, 'images', 'monsters', 'idle');
const IMAGES_JS = path.join(GAME, 'data', 'images', 'images-ally.js');
const FX_JSX = path.join(GAME, 'src', 'parts', '24-battle-fx.jsx');
const MASK_LONG = 256; // マスクの長い辺(px)。表示は58〜64pxなので十分

const RIGS = [
  // 頭の葉は切れ目が頭の上を横切り、傾けると継ぎ目が見えたので動かさない(全体の弾みだけ)
  { id:'Mocchi', img:'images/monsters/mocchi.png', body:'bounce', parts:[] },
  { id:'Suezo', img:'images/monsters/suezo.png', body:'bounce', parts:[] },
  { id:'Golem', img:'images/monsters/golem.png', body:'breathe', parts:[] },
  { id:'Tiger', img:'images/monsters/tiger.PNG', body:'breathe', parts:[
    { name:'tail', poly:[[66.6,43],[70,42.6],[74,42.4],[78,40],[99,33],[99.5,70],[69.5,70],[67.2,65],[66.6,58],[66.3,50]], share:[[64.8,41.8],[67.4,41.8],[67.4,44],[66.8,44],[66.8,60],[64.8,60]], pivot:[65.5,53], anim:'wag', amp:8, dur:1100, layer:'back' },
  ]},
  { id:'Ham', img:'images/monsters/ham.png', body:'breathe', parts:[
    { name:'earL', poly:[[31,0],[47,0],[47.5,22],[47.8,27],[46.5,29.5],[45.5,32.5],[42,33.8],[40,34.2],[37.5,34.2],[35.5,30],[35,27],[31,20]], pivot:[40,32.5], anim:'twitch', amp:-9, dur:3200, delay:0, layer:'back' },
    { name:'earR', poly:[[53,0],[69,0],[69,20],[65,27],[64,31],[62.8,32.8],[60,33.8],[57,33.6],[55,31],[53.5,27],[53,24]], pivot:[59.5,33], anim:'twitch', amp:9, dur:3200, delay:1300, layer:'back' },
  ]},
  { id:'Pixie', img:'images/monsters/pixie.png', body:'hover', parts:[
    { name:'wingL', poly:[[24.5,55],[25,48],[29.5,38],[34.5,30],[39.3,27],[39.3,31.5],[38.6,34],[38.6,39.4],[41.6,39.6],[41.6,43.4],[41,44.2],[39.5,45.8],[37.5,48.2],[35.5,50.5],[33,52.3],[27,55.5]], share:[[40.8,39.4],[43.2,39.4],[43.2,43.4],[40.8,43.4]], pivot:[41.8,41.5], anim:'flapL', amp:12, dur:900, layer:'back' },
    { name:'wingR', poly:[[59,27.5],[61.5,29.5],[66,34],[70,42],[73.5,52],[73,55.5],[71,55],[67,52.3],[64.5,50.5],[62.5,48.2],[60.5,45.8],[59,44.2],[58.4,43.4],[58.4,40.3],[59.4,40],[59.4,34],[59.2,31.5]], share:[[56.8,40],[59.2,40],[59.2,44.4],[56.8,44.4]], pivot:[58.2,42.3], anim:'flapR', amp:12, dur:900, layer:'back' },
    { name:'tail', poly:[[57,63.5],[62,63.5],[78,66],[78,79],[62,79],[59,73],[57.2,70.5],[57,67]], pivot:[57.2,67.5], anim:'wag', amp:7, dur:1600, layer:'back' },
  ]},
  // 翼は色で切り抜いた専用マスク(mia-wing-*.png)を使っていたが、袖のふちの線と袖口の縞の一部まで翼に入り、
  // 羽ばたくと袖が欠けて袖口の欠片が一緒に動いた(2026-09-24 ユーザー指摘「ミーアも少し怪しい」)。
  // 翼の形に沿った多角形にし、袖と袖口の外側を回る。軸は袖の後ろの肩の付け根
  { id:'Mia', img:'images/monsters/mia.PNG', body:'hover', parts:[
    { name:'wingL', poly:[[0,44],[5,42],[10,39.8],[13,35.5],[17,32.5],[20.5,31.8],[24,33.5],[28,37],[33,38.2],[37.5,37.3],[39.6,35.5],[38.9,37.8],[38.2,40],[36.2,42.5],[34.4,44.5],[32.5,46.5],[31,48],[28.5,48.6],[26.8,50],[25.5,52],[20,52.5],[10,53.5],[0,52]], pivot:[41.5,38.1], anim:'flapL', amp:16, dur:1300, layer:'back' },
    { name:'wingR', poly:[[100,44],[95,42],[90,39.8],[87,35.5],[83,32.5],[79.5,31.8],[76,33.5],[72,37],[67,38.2],[62.5,37.3],[60.4,35.5],[61.1,37.8],[61.9,40],[63.8,42.5],[65.6,44.5],[67.5,46.5],[69,48],[71.8,48.4],[73,50],[74,52],[80,52.5],[90,53.5],[100,52]], pivot:[58.5,38.1], anim:'flapR', amp:16, dur:1300, layer:'back' },
  ]},
  { id:'Pandora', img:'images/monsters/pandora.PNG', body:'hover', parts:[
    { name:'wingL', poly:[[0,31],[20,28.5],[26,27.5],[31,28],[32.5,31],[34,33.8],[37,36.3],[36,37.8],[35.1,38.8],[34.4,41.2],[33.3,42.4],[31.9,44.2],[30.4,45.9],[28.9,47.4],[27.5,48],[25.5,48],[23.8,48.6],[22.5,50.5],[21.5,53],[15,54.5],[3,56],[0,56]], share:[[32.5,31.5],[36,33],[37.6,36.4],[34.2,37]], pivot:[33.5,34], anim:'flapL', amp:12, dur:1200, layer:'back' },
    { name:'wingR', poly:[[68.5,26],[100,24],[100,68],[84,68],[83.3,59],[82.3,55.8],[80,53],[76.8,50.4],[74,48.6],[71,48.7],[69.3,48.2],[67.6,46],[66,43.8],[64.8,41.8],[64.8,39],[66,36.5],[68.2,33]], pivot:[67.5,36], anim:'flapR', amp:12, dur:1200, layer:'back' },
    { name:'tailL', poly:[[12,72],[20,69.5],[26.5,64],[31.5,61],[34,60.3],[36.6,60.5],[36.4,61.2],[35.8,63],[33.5,66],[31.5,68.5],[29.8,70.5],[28,73],[27.8,78],[26,83],[21,84.5],[11,80]], pivot:[35.2,61.2], anim:'swing', amp:7, dur:2000, layer:'back' },
    { name:'tailR', poly:[[66,61.8],[70,61.6],[72.5,64.5],[76,68.5],[79,71.5],[86,73],[86,85],[73,85],[71,76],[69,70.5],[66.8,66]], pivot:[67.6,63], anim:'swing', amp:-7, dur:2200, delay:400, layer:'back' },
  ]},
  { id:'Monol', img:'images/monsters/monol.png', body:'hover', parts:[] },
  // 花は花びらの形に沿って切り抜く(四角で切ると、花びらの先が体の側に残り、傾けたとき線が出た)。
  // 軸は茎の付け根。脇の花の下の花びらは葉に重なっているので、葉を少し含むのは許す
  { id:'Oboro', img:'images/monsters/oboro.png', body:'sway', parts:[
    { name:'flowerT', poly:[[31,8],[71,8],[71,36],[62,45],[52.5,47],[51.8,54],[47.5,54],[47,47],[38,45],[31,36]], share:[[46.5,52.5],[53,52.5],[53,56],[46.5,56]], pivot:[49.5,54.5], anim:'swing', amp:5, dur:2600, layer:'front' },
    { name:'flowerL', poly:[[9,32],[35,32],[35,47],[37,51],[40.5,54.5],[41.5,55.5],[41.5,58.3],[37,57.8],[32,57.6],[30.5,58.5],[28,59.6],[23,59.2],[20,58.2],[17,59],[12,58.8],[9,57.5]], share:[[39.5,54],[43,54],[43,59],[39.5,59]], pivot:[41,57], anim:'swing', amp:-6, dur:2300, delay:500, layer:'front' },
    { name:'flowerR', poly:[[91,32],[65,32],[65,47],[63,51],[59.5,54.5],[58.5,55.5],[58.5,58.3],[63,57.8],[68,57.6],[69.5,58.5],[72,59.6],[77,59.2],[80,58.2],[83,59],[88,58.8],[91,57.5]], share:[[60.5,54],[57,54],[57,59],[60.5,59]], pivot:[59,57], anim:'swing', amp:6, dur:2500, delay:900, layer:'front' },
  ]},
  { id:'Plant', img:'images/monsters/plant.PNG', body:'sway', parts:[
    { name:'flowerT', poly:[[32,12],[68,12],[68,36],[57,43],[52.2,47.5],[51.5,55],[47.5,55],[47,47.5],[43,43],[32,36]], share:[[46.5,53.5],[52.5,53.5],[52.5,57],[46.5,57]], pivot:[49.5,55.5], anim:'swing', amp:5, dur:2600, layer:'front' },
    { name:'flowerL', poly:[[7,34],[35,34],[35,48],[36,52.5],[41,54.5],[44.5,55.5],[44.5,59.8],[40,58.6],[35.5,57.2],[33,56.2],[30,56.5],[27.5,58.5],[25,62.4],[22,62.6],[19.5,60],[17,57],[12,55.5],[7,53]], share:[[42.5,54.5],[46.5,54.5],[46.5,60.5],[42.5,60.5]], pivot:[44,57.5], anim:'swing', amp:-6, dur:2300, delay:500, layer:'front' },
    { name:'flowerR', poly:[[93,34],[65,34],[65,48],[64,52.5],[59,54.5],[55.5,55.5],[55.5,59.8],[60,58.6],[64.5,57.2],[67,56.2],[70,56.5],[72.5,58.5],[75,62.4],[78,62.6],[80.5,60],[83,57],[88,55.5],[93,53]], share:[[57.5,54.5],[53.5,54.5],[53.5,60.5],[57.5,60.5]], pivot:[56,57.5], anim:'swing', amp:6, dur:2500, delay:900, layer:'front' },
  ]},
  { id:'Zan', img:'images/monsters/zan.png', body:'hover', parts:[
    { name:'bladeL', poly:[[2,27],[20,29],[24.5,27.8],[27,28.2],[30.5,28.3],[29.5,31],[28.5,35],[28.5,60],[27.5,92],[2,92]], share:[[28.5,27.5],[32,27.5],[32,31],[28.5,31]], pivot:[30,29.5], anim:'swing', amp:-5, dur:1800, layer:'back' },
    { name:'bladeR', poly:[[98,27],[80,29],[75.5,27.8],[73,28.2],[69.5,28.3],[70.5,31],[71.5,35],[71.5,60],[72.5,92],[98,92]], share:[[71.5,27.5],[68,27.5],[68,31],[71.5,31]], pivot:[70,29.5], anim:'swing', amp:5, dur:1800, layer:'back' },
  ]},
  { id:'Mitarashi', img:'images/monsters/mitarashi.png', body:'breathe', parts:[
    // 翼は体と同じ赤の骨とふちの線を持つので、色で絞ると骨と線が体の側に残り、羽ばたくたびに
    // 「元の場所の線」と「縦にまっすぐ切れた付け根」が見えて動きがあらく見えた(2026-09-24 ユーザー指摘
    // 「ミタラシの動きがあらい」)。翼の形に沿った多角形で色を問わず切り抜き、体側の辺は体のふちに沿わせる。
    // 付け根が体の後ろへ回り込んでいるので、軸は付け根(首の切れ込みの手前)に置き、振れ幅を小さく・ゆっくりにする
    { name:'wingL', poly:[[5,45],[12,39.5],[18,36.5],[22,35],[23.5,32],[26.6,32],[26.4,37.5],[27.8,39.1],[30.3,40.6],[27.8,44.5],[25.6,47.5],[23.6,50.5],[22.2,53.8],[21.5,55.5],[18.5,53.5],[17.5,51],[13,50.5],[9,48]], pivot:[28,41.5], anim:'flapL', amp:9, dur:1400, layer:'back' },
    { name:'wingR', poly:[[95,45],[88,39.5],[82,36.5],[78,35],[76.5,32],[73.4,32],[73.6,37.5],[72.2,39.1],[69.7,40.6],[72.2,44.5],[74.4,47.5],[76.4,50.5],[77.8,53.8],[78.5,55.5],[81.5,53.5],[82.5,51],[87,50.5],[91,48]], pivot:[72,41.5], anim:'flapR', amp:9, dur:1400, layer:'back' },
  ]},
  // 翼は半透明で、右は大きなしっぽの前、左は体の上に重なっている。翼を切り抜いて動かすと、翼の後ろの
  // (絵に描かれていない)しっぽ・体の所が穴になり、明るさで翼だけ拾うと細かい点が体に散らばった
  // (2026-09-24 ユーザー指摘「まだ怪しいの結構いそう」)。翼は動かさず、全体をふわりと浮かせるだけにする
  { id:'Ark', img:'images/monsters/ark.png', body:'hover', parts:[] },
  { id:'Iblis', img:'images/monsters/iblis.png', body:'hover', parts:[
    // 翼は前足(手)の後ろ、右はさらに三日月の前にある。暗い色で拾うと手まで翼と一緒に動き、手のふちに穴が開いた
    // (2026-09-24 ユーザー指摘「まだ怪しいの結構いそう」)。手と三日月を避けて翼の見えている所だけを囲み、
    // 軸は手の後ろの肩。三日月に重なる翼は動かさない(動かすと三日月に穴が開く)ので、振れ幅は小さめ
    { name:'wingL', poly:[[25,48],[26.6,48.8],[27.3,50.5],[27,52.5],[26.5,54.3],[24,54.6],[22,55.5],[20.6,57.5],[20.5,61],[22,64],[25,65.8],[26,66.5],[26.8,70],[25.5,72.8],[20,74.2],[10,73.3],[3,70],[4,66],[12,58],[20,50.5]], share:[[23.5,65],[27.5,65],[27.5,73.5],[23.5,73.5]], pivot:[24,56], anim:'flapL', amp:6, dur:1400, layer:'back' },
    { name:'wingR', poly:[[73.3,56.2],[76,55.2],[79,51.5],[81.5,47],[92,52],[97,68],[90,70.5],[80,73.5],[72,73],[68,70.5],[67.8,67.2],[71,66.3],[74.2,64.8],[76.2,61.3],[75.8,58]], share:[[66.5,65],[71,65],[71,73.5],[66.5,73.5]], pivot:[74,57], anim:'flapR', amp:6, dur:1400, layer:'back' },
    { name:'orb', poly:[[39,1],[57,1],[57,15],[39,15]], pivot:[48,8], anim:'bob', amp:-6, dur:1900, layer:'front' },
  ]},
  { id:'Snegurochka', img:'images/monsters/snegurochka.png', body:'swim', parts:[
    // 尾びれは尾がいちばん細い所(y80)で切る。太い所で切ると傾けたとき継ぎ目が出た
    { name:'fin', poly:[[52,79],[76,77],[76,98],[52,98]], share:[[52,79],[61,78.5],[61,82],[52,82]], pivot:[58.5,80], anim:'swing', amp:5, dur:1500, layer:'front' },
  ]},
  { id:'Undine', img:'images/monsters/undine.PNG', body:'swim', parts:[
    { name:'fin', poly:[[49,78],[93,78],[93,100],[49,100]], share:[[49,78],[64,78],[64,81.5],[49,81.5]], pivot:[62,80], anim:'swing', amp:6, dur:1500, layer:'front' },
  ]},
  { id:'Yaobikuni', img:'images/monsters/yaobikuni.PNG', body:'swim', parts:[
    { name:'fin', poly:[[55,80],[95,80],[95,100],[55,100]], share:[[55,80],[68,80],[68,83.5],[55,83.5]], pivot:[66,82], anim:'swing', amp:6, dur:1500, layer:'front' },
  ]},
  // 外側の刃の翼は、剣・房飾り・内側の刃と何重にも重なっていて、どこで切っても動かすと重なりに切れ目が出た
  // (2026-09-24 ユーザー指摘「まだ怪しいの結構いそう」)。刃は動かさず、全体をふわりと浮かせるだけにする
  { id:'Eiki', img:'images/monsters/eiki.png', body:'hover', parts:[] },
  { id:'KenshiMocchi', img:'images/monsters/kenshi-mocchi.png', body:'bounce', parts:[] },
];

const constName = (id, name) => `IDLE_${id.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_${name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_MASK`;
const fileName = (id, name) => `${id.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}-${name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}.png`;

// 多角形の中か(偶奇規則)
const inPoly = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
};
// 絵の % → 正方形の枠(object-fit:contain)の %
const toBox = (w, h, [px, py]) => {
  const s = Math.max(w, h);
  const ox = (s - w) / 2, oy = (s - h) / 2;
  const r = (v) => Math.round(v * 10) / 10;
  return [r((ox + px / 100 * w) / s * 100), r((oy + py / 100 * h) / s * 100)];
};
const writeMask = async (file, mw, mh, fn) => {
  const buf = Buffer.alloc(mw * mh * 4);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    const p = (y * mw + x) * 4; buf[p] = buf[p + 1] = buf[p + 2] = 255; buf[p + 3] = fn(x, y) ? 255 : 0;
  }
  const png = await sharp(buf, { raw: { width: mw, height: mh, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  return png;
};

const replaceBlock = (text, begin, end, body) => {
  const a = text.indexOf(begin), b = text.indexOf(end);
  if (a < 0 || b < 0 || b < a) throw new Error(`区画の目印が見つかりません: ${begin}`);
  return text.slice(0, a + begin.length) + '\n' + body + text.slice(b);
};

(async () => {
  const check = process.argv.includes('--check');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const consts = [];
  const rigs = [];
  let stale = [];
  for (const rig of RIGS) {
    const meta = await sharp(path.join(GAME, rig.img)).metadata();
    const W = meta.width, H = meta.height;
    const sc = MASK_LONG / Math.max(W, H);
    const mw = Math.round(W * sc), mh = Math.round(H * sc);
    const at = (x, y) => [ (x + 0.5) / mw * 100, (y + 0.5) / mh * 100 ];
    // 色で絞るとき用に、元絵をマスクと同じ大きさへ縮めた画素
    const px = await sharp(path.join(GAME, rig.img)).resize(mw, mh, { fit:'fill' }).ensureAlpha().raw().toBuffer();
    const passes = (x, y, keep) => {
      if (!keep) return true;
      const i = (y * mw + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (keep.orDark != null && lum < keep.orDark) return true;
      if (keep.minLum != null && lum < keep.minLum) return false;
      if (keep.maxLum != null && lum > keep.maxLum) return false;
      if (keep.hue) {
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, sat = mx ? d / mx : 0;
        if (sat < (keep.minSat ?? 0.25)) return false;
        let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
        if (h < keep.hue[0] || h > keep.hue[1]) return false;
      }
      return true;
    };
    const parts = [];
    // ★部分どうしの範囲が重なると、同じ画素が2か所で別々に動いて継ぎ目が出る(オボロゲソウの花で起きた)。
    //   各画素は「先に書いた部分」だけのものにする。太らせるのも、ほかの部分の画素には広げない
    const owner = new Int16Array(mw * mh).fill(-1);
    rig.parts.forEach((part, index) => {
      if (!part.poly) return;
      for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
        const i = y * mw + x; if (owner[i] >= 0) continue;
        const [qx, qy] = at(x, y); if (inPoly(qx, qy, part.poly) && passes(x, y, part.keep)) owner[i] = index;
      }
    });
    const ownedBy = (x, y) => (x < 0 || y < 0 || x >= mw || y >= mh) ? -2 : owner[y * mw + x];
    for (const [partIndex, part] of rig.parts.entries()) {
      let maskConst = part.mask;
      if (!maskConst) {
        maskConst = constName(rig.id, part.name);
        const file = fileName(rig.id, part.name);
        // 部分は1px太らせる(体との境目に継ぎ目が出ないように。後ろの層は体に隠れる)
        const png = await writeMask(file, mw, mh, (x, y) => {
          const own = ownedBy(x, y);
          if (own === partIndex) return true;
          // 付け根の重なり: 体の画素も部分に持たせる(ほかの部分の画素は取らない)
          if (own === -1 && part.share && inPoly(...at(x, y), part.share)) return true;
          if (own >= 0) return false; // ほかの部分の画素には広げない
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ownedBy(x + dx, y + dy) === partIndex) return true;
          return false;
        });
        const dest = path.join(OUT_DIR, file);
        if (check) { if (!fs.existsSync(dest) || !fs.readFileSync(dest).equals(png)) stale.push(file); }
        else fs.writeFileSync(dest, png);
        consts.push(`const ${maskConst} = "images/monsters/idle/${file}";`);
      }
      parts.push({ name: part.name, mask: maskConst, origin: toBox(W, H, part.pivot), anim: part.anim, amp: part.amp, dur: part.dur, delay: part.delay || 0, layer: part.layer });
    }
    let bodyConst = null;
    if (rig.parts.length) {
      if (rig.masks && rig.masks.body) bodyConst = rig.masks.body;
      else {
        bodyConst = constName(rig.id, 'body');
        const file = fileName(rig.id, 'body');
        // 体 = どの部分のものでもない画素 ＋ 部分の付け根の重なり(share)
        const png = await writeMask(file, mw, mh, (x, y) => {
          const own = ownedBy(x, y);
          if (own < 0) return true;
          const part = rig.parts[own];
          return !!(part && part.share && inPoly(...at(x, y), part.share));
        });
        const dest = path.join(OUT_DIR, file);
        if (check) { if (!fs.existsSync(dest) || !fs.readFileSync(dest).equals(png)) stale.push(file); }
        else fs.writeFileSync(dest, png);
        consts.push(`const ${bodyConst} = "images/monsters/idle/${file}";`);
      }
    }
    rigs.push({ id: rig.id, body: rig.body, bodyMask: bodyConst, parts });
  }
  const imagesBlock = consts.join('\n') + '\n';
  const rigLines = rigs.map(r => `  ${r.id}: { body:'${r.body}', bodyMask:${r.bodyMask || 'null'}, parts:[${r.parts.map(p =>
    `{ mask:${p.mask}, origin:'${p.origin[0]}% ${p.origin[1]}%', anim:'${p.anim}', amp:${p.amp}, dur:${p.dur}, delay:${p.delay}, layer:'${p.layer}' }`).join(', ')}] },`).join('\n');
  const fxBlock = `const MONSTER_IDLE_RIGS = Object.freeze({\n${rigLines}\n});\n`;
  const B1 = '// ==== 待機アニメのマスク(tools/monster/idle-rig-build.js が書く。手で直さない) ====';
  const E1 = '// ==== 待機アニメのマスク ここまで ====';
  const B2 = '// ==== MONSTER_IDLE_RIGS(tools/monster/idle-rig-build.js が書く。手で直さない) ====';
  const E2 = '// ==== MONSTER_IDLE_RIGS ここまで ====';
  const imagesJs = fs.readFileSync(IMAGES_JS, 'utf8');
  const fxJsx = fs.readFileSync(FX_JSX, 'utf8');
  // images-ally.js の ?v= は build.js が付けるので、比べるときは外す
  const stripV = (t) => t.replace(/\?v=[0-9a-f]+/g, '');
  const nextImages = replaceBlock(imagesJs, B1, E1, imagesBlock);
  const nextFx = replaceBlock(fxJsx, B2, E2, fxBlock);
  if (check) {
    if (stripV(nextImages) !== stripV(imagesJs)) stale.push('images-ally.js の区画');
    if (nextFx !== fxJsx) stale.push('24-battle-fx.jsx の MONSTER_IDLE_RIGS');
    if (stale.length) { console.log(`NG: 待機アニメの表・マスクが定義と合っていません: ${stale.join(', ')}。node tools/monster/idle-rig-build.js を実行してください`); process.exit(1); }
    console.log(`OK: 待機アニメ ${rigs.length}体(部分 ${rigs.reduce((a, r) => a + r.parts.length, 0)}か所)の表とマスクは定義どおり`);
    return;
  }
  fs.writeFileSync(IMAGES_JS, nextImages.replace(/(const IDLE_[A-Z_]+_MASK = "images\/monsters\/idle\/[^"?]+)(?:\?v=[0-9a-f]+)?"/g, '$1"'));
  fs.writeFileSync(FX_JSX, nextFx);
  console.log(`書き出しました: ${rigs.length}体 / 部分 ${rigs.reduce((a, r) => a + r.parts.length, 0)}か所。続けて node tools/build.js`);
})();
