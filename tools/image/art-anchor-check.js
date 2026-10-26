// 顔アイコンと全身絵の「顔のまんなか」の基準(ART_ANCHORS)を見張る(2026-10-26 社長「顔アイコンと全身絵作るけど、
// 他の場面でズレが出るときあるから、そうならない仕組みをちゃんと作って。助手とかアシカもおなじ」)。
//
//   node tools/image/art-anchor-check.js
//
// 【なぜ要るか】
// 顔アイコンは make-face-icons.js が FACE_BOXES(顔の範囲)から作る。以前は「範囲の中で絵がある所」のまんなかに置いていたので、
// 範囲を左右対称に取らないと羽や髪のぶん顔がずれた(アークで右へ約9%)。それを、マーケット・プロフィールの2画面だけで手書きの値で
// 寄せていたので、ほかの画面ではずれたままだった。いまは子ごとの「顔のまんなか」(ART_ANCHORS)を1か所に持ち、そこを丸のまんなかに置く。
//
// 【見るもの】
// ① モンスター・混血・案の子の顔アイコンで、自分の絵(全身絵と別のファイル)を持つ子は、全員が基準と顔の範囲を持つ(足し忘れたら止まる)
// ② 顔アイコンが全身絵そのものの子は、例外の表(ART_FACE_FULL_BODY)に書いてある(書いていない子が来たら止まる)
// ③ 基準の点は顔の範囲(FACE_BOXES)の中にある
// ④ 顔アイコンの画像が、基準どおりに作られている(作り直した絵とくらべて、ほぼ同じ。手で直した・基準だけ変えた、を止める)
// ⑤ マーケット・プロフィールとアシストカードの「手書きの寄せ」が、いまある分から増えていない(増やさず、基準の側で直す)
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');
const { loadEmbeddedImages, loadDyeModule, imageFilePath, REPO_ROOT } = require('../harness');
const face = require('./make-face-icons');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const ally = read('monster-hero/data/images/images-ally.js');
const breeder = read('monster-hero/data/breeder.js');
const monsters = read('monster-hero/data/ally-monsters.js');
const market = read('monster-hero/src/parts/20-market-notices-help.jsx');
const dyeArt = read('monster-hero/src/parts/15-dye-and-art.jsx');

// 定数の中身(パス)。別の定数を指す別名(TIGER_FACE_ICON = TIGER_ICON)は、たどって同じパスにそろえる
const consts = {};
for (const src of [ally, breeder]) {
  for (const m of src.matchAll(/^const ([A-Z0-9_]+) = "([^"]+)";/gm)) consts[m[1]] = m[2].split('?')[0];
  for (const m of src.matchAll(/^const ([A-Z0-9_]+) = ([A-Z0-9_]+);/gm)) consts[m[1]] = { alias: m[2] };
}
const resolve = (name, depth = 0) => { const v = consts[name]; if (v && typeof v === 'object' && depth < 5) return resolve(v.alias, depth + 1); return typeof v === 'string' ? v : null; };

const anchors = face.loadArtAnchors();
const fullBodyMatch = ally.match(/const ART_FACE_FULL_BODY = Object\.freeze\(\[([^\]]*)\]\)/);
const fullBody = fullBodyMatch ? [...fullBodyMatch[1].matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]) : null;
check('基準の表(ART_ANCHORS)と、顔アイコンが全身絵の子の表(ART_FACE_FULL_BODY)がある', Object.keys(anchors).length > 50 && Array.isArray(fullBody), `${Object.keys(anchors).length}件 / ${fullBody ? fullBody.length : '無し'}`);

// 顔アイコンを使う子(モンスター・案の子の faceIconUrl・混血の HYBRID_MONSTER_FACE_ICONS)
const faceConsts = new Set();
for (const m of monsters.matchAll(/faceIconUrl:\s*([A-Z0-9_]+_FACE_ICON)/g)) faceConsts.add(m[1]);
const hyBlock = (ally.match(/const HYBRID_MONSTER_FACE_ICONS = Object\.freeze\(\{([\s\S]*?)\}\);/) || [])[1] || '';
for (const m of hyBlock.matchAll(/:\s*([A-Z0-9_]+_FACE_ICON)/g)) faceConsts.add(m[1]);
const missing = [], notListed = [], outside = [];
for (const c of faceConsts) {
  const prefix = c.replace(/_FACE_ICON$/, '');
  const facePath = resolve(c), imgPath = resolve(`${prefix}_IMG`) || resolve(`${prefix}_ICON`);
  if (!facePath) { missing.push(`${c}(パスが読めない)`); continue; }
  if (facePath === imgPath || !/monster-icons\/face\//.test(facePath)) {
    if (!(fullBody || []).includes(prefix)) notListed.push(prefix);
    continue;
  }
  if (!face.FACE_BOXES[prefix] || !anchors[prefix]) { missing.push(prefix); continue; }
  const [x0, y0, x1, y1] = face.FACE_BOXES[prefix]; const [ax, ay] = anchors[prefix].face;
  if (!(ax >= x0 && ax <= x1 && ay >= y0 && ay <= y1)) outside.push(`${prefix}(${ax},${ay})`);
}
check(`① 顔アイコンを持つ子は、全員が基準(ART_ANCHORS)と顔の範囲(FACE_BOXES)を持つ(${faceConsts.size}件を見た)`, missing.length === 0,
  missing.length ? `足りない: ${missing.join('・')} … 全身絵で顔のまんなかを測って ART_ANCHORS に書き、make-face-icons.js で作る` : '');
check('② 顔アイコンが全身絵そのものの子は、ART_FACE_FULL_BODY に書いてある', notListed.length === 0, notListed.join('・'));
check('③ 基準の点は、顔の範囲(FACE_BOXES)の中にある', outside.length === 0, outside.join('・'));

// ④ 画像が基準どおりか。基準で作り直した絵と、置いてある絵を 128px にしてくらべる(色の数を減らした誤差は 3 前後)
(async () => {
  const images = loadEmbeddedImages();
  const dye = loadDyeModule();
  const W = 128, LIMIT = 6;
  const off = [];
  let n = 0;
  for (const prefix of Object.keys(anchors)) {
    const box = face.FACE_BOXES[prefix];
    if (!box || !images[`${prefix}_IMG`] || !images[`${prefix}_FACE_ICON`]) continue;
    const dest = imageFilePath(images[`${prefix}_FACE_ICON`]);
    if (!fs.existsSync(dest)) { off.push(`${prefix}(絵が無い)`); continue; }
    const made = await face.makeFaceIconQuiet(images[`${prefix}_IMG`], box, prefix, dye, anchors);
    const placed = await loadImage(dest);
    const ca = createCanvas(W, W), cb = createCanvas(W, W);
    ca.getContext('2d').drawImage(made, 0, 0, W, W); cb.getContext('2d').drawImage(placed, 0, 0, W, W);
    const da = ca.getContext('2d').getImageData(0, 0, W, W).data, db = cb.getContext('2d').getImageData(0, 0, W, W).data;
    let sum = 0; for (let i = 0; i < da.length; i++) sum += Math.abs(da[i] - db[i]);
    const diff = sum / da.length;
    if (diff > LIMIT) off.push(`${prefix}(${diff.toFixed(1)})`);
    n++;
  }
  check(`④ 顔アイコンの画像が、基準どおりに作られている(${n}件)`, off.length === 0, off.length ? `${off.join('・')} … make-face-icons.js で作り直すか、基準を直す` : '');

  // ⑤ 手書きの寄せ。いまある分(2026-10-26)だけを認める。増やすときは基準の側(顔アイコンを作り直す)で直す
  // 円盤石の行(◯◯_disc_icon と、モンスターの id そのもの)は円盤を真ん中に置く値なので数えない。ライガー(Tiger)は顔の行
  const ALLOWED_MARKET = ['kiki_icon', 'snegurochka_awakened_icon', 'mia_icon', 'mua'];
  const ALLOWED_ASSIST = ['kiki'];
  const marketBlock = (market.match(/const MARKET_PROFILE_ICON_STYLES = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const marketKeys = [...marketBlock.matchAll(/^\s{2}([A-Za-z_]+):/gm)].map((m) => m[1]);
  const faceRows = marketKeys.filter((k) => !/_disc_icon$/.test(k) && (!/^[A-Z]/.test(k) || k === 'Tiger'));
  const extraMarket = faceRows.filter((id) => !ALLOWED_MARKET.includes(id));
  check('⑤ マーケット・プロフィールの手書きの寄せ(顔の分)が増えていない', marketKeys.length > 10 && extraMarket.length === 0, extraMarket.length ? `増えた: ${extraMarket.join('・')} … 顔アイコンを基準で作り直して、寄せを使わない` : `${faceRows.length}件(これから基準へ移す)`);
  const assistBlock = (dyeArt.match(/const ASSIST_CARD_ICON_STYLES = Object\.freeze\(\{([\s\S]*?)\}\);/) || [])[1] || '';
  const assistRows = [...assistBlock.matchAll(/^\s+([a-z_]+):/gm)].map((m) => m[1]);
  const extraAssist = assistRows.filter((id) => !ALLOWED_ASSIST.includes(id));
  check('⑤ アシストカードの手書きの寄せが増えていない', extraAssist.length === 0, extraAssist.join('・'));

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
