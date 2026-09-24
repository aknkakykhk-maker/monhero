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
// ミーアだけは色で翼を切り抜いた専用マスク(mia-wing-*.png)を使うので、masks を直接書く。
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
    { name:'tail', poly:[[68,37],[99,34],[99,67],[71,67],[68,58]], pivot:[68,52], anim:'wag', amp:8, dur:1100, layer:'back' },
  ]},
  { id:'Ham', img:'images/monsters/ham.png', body:'breathe', parts:[
    { name:'earL', poly:[[31,0],[47,0],[47,24],[43,28],[35,28],[31,20]], pivot:[43,27], anim:'twitch', amp:-9, dur:3200, delay:0, layer:'front' },
    { name:'earR', poly:[[53,0],[69,0],[69,20],[65,28],[57,28],[53,24]], pivot:[57,27], anim:'twitch', amp:9, dur:3200, delay:1300, layer:'front' },
  ]},
  { id:'Pixie', img:'images/monsters/pixie.png', body:'hover', parts:[
    { name:'wingL', poly:[[24,27],[36,27],[36,34],[33,50],[24,53]], pivot:[36,32], anim:'flapL', amp:14, dur:900, layer:'back' },
    { name:'wingR', poly:[[64,27],[76,27],[76,53],[67,50],[64,34]], pivot:[64,32], anim:'flapR', amp:14, dur:900, layer:'back' },
    { name:'tail', poly:[[58,57],[77,59],[77,77],[62,77],[58,68]], pivot:[58,62], anim:'wag', amp:7, dur:1600, layer:'back' },
  ]},
  { id:'Mia', img:'images/monsters/mia.PNG', body:'hover', masks:{ body:'MIA_WING_BODY_MASK' }, parts:[
    { name:'wingL', mask:'MIA_WING_LEFT_MASK', pivot:[41.5,38.1], anim:'flapL', amp:16, dur:1300, layer:'back' },
    { name:'wingR', mask:'MIA_WING_RIGHT_MASK', pivot:[58.5,38.1], anim:'flapR', amp:16, dur:1300, layer:'back' },
  ]},
  { id:'Pandora', img:'images/monsters/pandora.PNG', body:'hover', parts:[
    { name:'wingL', poly:[[0,23],[31,23],[31,37],[22,45],[12,53],[0,53]], pivot:[30,33], anim:'flapL', amp:12, dur:1200, layer:'back' },
    { name:'wingR', poly:[[68,23],[100,23],[100,63],[93,63],[88,57],[80,50],[72,40],[68,36]], pivot:[68,32], anim:'flapR', amp:12, dur:1200, layer:'back' },
    { name:'tailL', poly:[[2,56],[20,56],[26,64],[24,83],[2,83]], pivot:[22,58], anim:'swing', amp:7, dur:2000, layer:'back' },
    { name:'tailR', poly:[[72,56],[95,56],[95,85],[74,85],[70,64]], pivot:[72,58], anim:'swing', amp:-7, dur:2200, delay:400, layer:'back' },
  ]},
  { id:'Monol', img:'images/monsters/monol.png', body:'hover', parts:[] },
  // 花は花びらの形に沿って切り抜く(四角で切ると、花びらの先が体の側に残り、傾けたとき線が出た)。
  // 軸は茎の付け根。脇の花の下の花びらは葉に重なっているので、葉を少し含むのは許す
  { id:'Oboro', img:'images/monsters/oboro.png', body:'sway', parts:[
    { name:'flowerT', poly:[[31,8],[71,8],[71,36],[62,45],[53,49],[47,49],[38,45],[31,36]], pivot:[50,50], anim:'swing', amp:6, dur:2600, layer:'front' },
    { name:'flowerL', poly:[[9,32],[35,32],[35,52],[31,60],[20,60],[9,58]], pivot:[33,54], anim:'swing', amp:-7, dur:2300, delay:500, layer:'front' },
    { name:'flowerR', poly:[[65,30],[91,30],[91,57],[80,59],[69,60],[65,52]], pivot:[67,54], anim:'swing', amp:7, dur:2500, delay:900, layer:'front' },
  ]},
  { id:'Plant', img:'images/monsters/plant.PNG', body:'sway', parts:[
    { name:'flowerT', poly:[[33,12],[67,12],[67,36],[56,43],[52,48],[48,48],[44,43],[33,36]], pivot:[50,50], anim:'swing', amp:6, dur:2600, layer:'front' },
    { name:'flowerL', poly:[[8,34],[35,34],[35,50],[29,62],[20,62],[12,56],[8,52]], pivot:[31,52], anim:'swing', amp:-7, dur:2300, delay:500, layer:'front' },
    { name:'flowerR', poly:[[65,34],[92,34],[92,52],[88,56],[80,62],[71,62],[65,50]], pivot:[69,52], anim:'swing', amp:7, dur:2500, delay:900, layer:'front' },
  ]},
  { id:'Zan', img:'images/monsters/zan.png', body:'hover', parts:[
    { name:'bladeL', poly:[[3,27],[34,25],[36,40],[30,55],[27,91],[3,91]], pivot:[30,30], anim:'swing', amp:-5, dur:1800, layer:'back' },
    { name:'bladeR', poly:[[66,25],[97,27],[97,91],[73,91],[70,55],[64,40]], pivot:[70,30], anim:'swing', amp:5, dur:1800, layer:'back' },
  ]},
  { id:'Mitarashi', img:'images/monsters/mitarashi.png', body:'breathe', parts:[
    // 翼は体と同じ赤の骨とふちの線を持つので、色で絞ると骨と線が体の側に残り、羽ばたくたびに
    // 「元の場所の線」と「縦にまっすぐ切れた付け根」が見えて動きがあらく見えた(2026-09-24 ユーザー指摘
    // 「ミタラシの動きがあらい」)。翼の形に沿った多角形で色を問わず切り抜き、体側の辺は体のふちに沿わせる。
    // 付け根が体の後ろへ回り込んでいるので、軸は付け根(首の切れ込みの手前)に置き、振れ幅を小さく・ゆっくりにする
    { name:'wingL', poly:[[5,45],[12,39.5],[18,36.5],[22,35],[23.5,32],[26.6,32],[26.4,37.5],[27.8,39.1],[30.3,40.6],[27.8,44.5],[25.6,47.5],[23.6,50.5],[22.2,53.8],[21.5,55.5],[18.5,53.5],[17.5,51],[13,50.5],[9,48]], pivot:[28,41.5], anim:'flapL', amp:9, dur:1400, layer:'back' },
    { name:'wingR', poly:[[95,45],[88,39.5],[82,36.5],[78,35],[76.5,32],[73.4,32],[73.6,37.5],[72.2,39.1],[69.7,40.6],[72.2,44.5],[74.4,47.5],[76.4,50.5],[77.8,53.8],[78.5,55.5],[81.5,53.5],[82.5,51],[87,50.5],[91,48]], pivot:[72,41.5], anim:'flapR', amp:9, dur:1400, layer:'back' },
  ]},
  { id:'Ark', img:'images/monsters/ark.png', body:'hover', parts:[
    // 翼は白っぽい明るい羽と、その輪郭線(腕は範囲から外し、しっぽ・頬の毛は濃い青なので巻き込まない)。
    // 翼が半透明でしっぽ・腕に重なって描かれているため、大きく動かすと切れ目が見える。振れ幅は小さめ
    { name:'wingL', poly:[[3,46],[34,46],[36,52],[27,57],[26,73],[3,73]], keep:{ minLum:125, orDark:118 }, pivot:[34,52], anim:'flapL', amp:6, dur:1300, layer:'back' },
    { name:'wingR', poly:[[66,46],[97,55],[97,73],[74,73],[73,57],[64,52]], keep:{ minLum:125, orDark:118 }, pivot:[66,52], anim:'flapR', amp:6, dur:1300, layer:'back' },
  ]},
  { id:'Iblis', img:'images/monsters/iblis.png', body:'hover', parts:[
    // 黒い翼だけ(白い毛は巻き込まない)
    { name:'wingL', poly:[[2,49],[30,47],[32,60],[28,75],[2,75]], keep:{ maxLum:110 }, pivot:[30,56], anim:'flapL', amp:10, dur:1400, layer:'back' },
    { name:'wingR', poly:[[68,49],[98,54],[98,75],[72,75],[68,62]], keep:{ maxLum:110 }, pivot:[70,56], anim:'flapR', amp:10, dur:1400, layer:'back' },
    { name:'orb', poly:[[39,1],[57,1],[57,15],[39,15]], pivot:[48,8], anim:'bob', amp:-6, dur:1900, layer:'front' },
  ]},
  { id:'Snegurochka', img:'images/monsters/snegurochka.png', body:'swim', parts:[
    // 尾びれは尾がいちばん細い所(y80)で切る。太い所で切ると傾けたとき継ぎ目が出た
    { name:'fin', poly:[[52,79],[76,77],[76,98],[52,98]], pivot:[58.5,80], anim:'swing', amp:7, dur:1500, layer:'front' },
  ]},
  { id:'Undine', img:'images/monsters/undine.PNG', body:'swim', parts:[
    { name:'fin', poly:[[49,78],[93,78],[93,100],[49,100]], pivot:[62,80], anim:'swing', amp:8, dur:1500, layer:'front' },
  ]},
  { id:'Yaobikuni', img:'images/monsters/yaobikuni.PNG', body:'swim', parts:[
    { name:'fin', poly:[[55,80],[95,80],[95,100],[55,100]], pivot:[66,82], anim:'swing', amp:8, dur:1500, layer:'front' },
  ]},
  { id:'Eiki', img:'images/monsters/eiki.png', body:'hover', parts:[
    // 外側の刃の翼だけを小さく動かす(内側の刃・腕・剣と重なっているので、大きく動かすと切れ目が見える)
    { name:'wingL', poly:[[0,40],[18,38],[14,56],[8,82],[0,82]], pivot:[18,40], anim:'flapL', amp:4, dur:1600, layer:'back' },
    { name:'wingR', poly:[[82,38],[100,40],[100,82],[92,82],[86,56]], pivot:[82,40], anim:'flapR', amp:4, dur:1600, layer:'back' },
  ]},
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
        const png = await writeMask(file, mw, mh, (x, y) => ownedBy(x, y) < 0);
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
