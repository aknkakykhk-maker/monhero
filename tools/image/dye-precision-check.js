const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 正式マスク(EXACT_DYE_MASKS)を持つモンスターの染色が、実際に画面へ出る解像度で
// どれだけ正確かを測る。
//
//   node image/dye-precision-check.js
//   node image/dye-precision-check.js Eiki    … 1体だけ見る
//
// 【なぜ要るか】
// 既存の <名前>-dye-mask-check.js は「本番が作ったマスク」と「承認済みマスク」を
// マスクの解析解像度どうしで比べている。この比べ方だと、
//   ・解析解像度を上げると境界を細かく見るぶん一致率が下がる
//   ・解析解像度を下げると粗くなって一致率が上がる
// という形で、実際の見た目と逆に動いてしまう(実際、解析を384→768pxへ上げて
// 見た目は良くなったのに mocchi-dye-mask-check.js の一致率だけ下がった)。
//
// ここでは元絵の原寸で測る。マスクはCSSで表示サイズへ引き伸ばされるので、
// 同じく補間ありで原寸へ戻してから、承認済みマスク(原寸)と突き合わせる。
// この指標は解析解像度を変えても意味が変わらない。
//
// 【何を見るか】
// 染色は「染め直した絵」をmask-imageで抜いて元絵へ重ねる。マスクのアルファには
// 元絵のアルファが掛けてあるので、元絵が半透明な場所はマスクも半透明になるのが正常。
// そこで生のアルファではなく「元絵のアルファに対する比(cover)」で見る。
//   白フリンジ … 染めるはずなのに cover が足りず、元の色が縁として残る
//   取り違え   … 別の部位の色で染まる
//   はみ出し   … 染色対象外(背景・目など)なのに染まる
const fs = require('fs');
const path = require('path');
const { loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, createCanvas, REPO_ROOT } = require('../harness');

// 承認済みマスクの置き場所。EXACT_DYE_MASKS が指すのと同じ絵を、原寸の正解として読む
const APPROVED_MASKS = {
  Mocchi: 'images/monsters/mocchi-dye-mask.PNG',
  Yaobikuni: 'images/monsters/yaobikuni-dye-mask2.PNG',
  Plant: 'images/monsters/plant-dye-mask.PNG',
  Eiki: 'images/monsters/eiki-dye-mask.PNG',
  Pandora: 'images/monsters/pandora-dye-mask.PNG',
};
// これ未満しか染まらない画素を「染まっていない」とみなす
const COVER_MIN = 0.5;
// 上限。境目は縮小と補間でどうしても数px分ずれるため0にはできない。
// 現状の実測(2026年8月・解析768px)は
//   モッチー   フリンジ0.02% 取り違え0.09% はみ出し0.02%
//   ヤオビクニ フリンジ0.09% 取り違え0.58% はみ出し0.09%
//   プラント   フリンジ0.05% 取り違え0.09% はみ出し0.52%
//   エイキ     フリンジ0.94% 取り違え0.05% はみ出し1.27%
// エイキは細い刀身と羽根が多く周囲長が長いぶん大きい。悪化に気づける範囲で上限を置く
const MAX_FRINGE = 0.015;   // 1.5%
const MAX_WRONG = 0.010;    // 1.0%
const MAX_BLEED = 0.020;    // 2.0%

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const pixelsAt = (image, w, h, smooth = false) => {
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = smooth;
  if (smooth) x.imageSmoothingQuality = 'high';
  x.drawImage(image, 0, 0, w, h);
  return x.getImageData(0, 0, w, h).data;
};
// game-system.jsx の _exactDyeMaskRegion とまったく同じ判定にする
// (赤=① / 緑=② / 青=③ / 黄=④ / マゼンタ=⑤ / それ以外=対象外)。
// パンドラのように5部位あるマスクもそのまま読めるよう、5色すべてを見る
const approvedRegion = (p, o) => {
  if (p[o + 3] < 20) return -1;
  const r = p[o], g = p[o + 1], b = p[o + 2];
  if (r > 200 && g < 80 && b < 80) return 0;
  if (g > 200 && r < 80 && b < 80) return 1;
  if (b > 200 && r < 80 && g < 80) return 2;
  if (r > 200 && g > 200 && b < 80) return 3;
  if (r > 200 && g < 80 && b > 200) return 4;
  return -1;
};

const measure = async (dye, images, baseId) => {
  const rel = APPROVED_MASKS[baseId];
  if (!fs.existsSync(path.join(REPO_ROOT, 'monster-hero', rel))) {
    check(`${baseId}: 承認済みマスクがある (${rel})`, false);
    return;
  }
  const url = imageForBaseId(baseId, images);
  const [src, approved, maskUrls] = await Promise.all([
    decodeDataUrl(url), decodeDataUrl(rel), dye.getDyeRegionMasks(baseId, url),
  ]);
  if (!maskUrls || !maskUrls.length) { check(`${baseId}: 本番マスクを作れる`, false); return; }
  const masks = await Promise.all(maskUrls.map(decodeDataUrl));
  const W = src.width, H = src.height;
  const sp = pixelsAt(src, W, H);
  const ap = pixelsAt(approved, W, H);
  const mp = masks.map(m => pixelsAt(m, W, H, true)); // 表示と同じく補間ありで引き伸ばす

  let opaque = 0, fringe = 0, wrong = 0, bleed = 0;
  for (let i = 0; i < W * H; i++) {
    const o = i * 4;
    const sa = sp[o + 3];
    if (sa < 20) continue;
    opaque++;
    const want = approvedRegion(ap, o);
    let act = -1, cover = 0;
    for (let r = 0; r < mp.length; r++) {
      const c = mp[r][o + 3] / sa;
      if (c > cover) { cover = c; act = r; }
    }
    if (want < 0) { if (cover >= COVER_MIN) bleed++; continue; }
    if (act !== want) { wrong++; continue; }
    if (cover < COVER_MIN) fringe++;
  }
  const rate = (n) => n / opaque;
  console.log(`  ${baseId.padEnd(10)} 元絵${W}x${H} / マスク${masks[0].width}x${masks[0].height}`
    + ` — フリンジ${(rate(fringe) * 100).toFixed(2)}% 取り違え${(rate(wrong) * 100).toFixed(2)}% はみ出し${(rate(bleed) * 100).toFixed(2)}%`);
  check(`${baseId}: 染めるはずが染まらない縁が${(MAX_FRINGE * 100).toFixed(1)}%以下`,
    rate(fringe) <= MAX_FRINGE, `${(rate(fringe) * 100).toFixed(2)}%`);
  check(`${baseId}: 別の部位で染まる画素が${(MAX_WRONG * 100).toFixed(1)}%以下`,
    rate(wrong) <= MAX_WRONG, `${(rate(wrong) * 100).toFixed(2)}%`);
  check(`${baseId}: 対象外へのはみ出しが${(MAX_BLEED * 100).toFixed(1)}%以下`,
    rate(bleed) <= MAX_BLEED, `${(rate(bleed) * 100).toFixed(2)}%`);
};

(async () => {
  const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const dye = loadDyeModule();
  const images = loadEmbeddedImages();
  const ids = Object.keys(APPROVED_MASKS).filter(id => !only.length || only.includes(id));
  // 正式マスクを持つモンスターの一覧が実装とずれていないか(足したのにここへ書き忘れる事故を防ぐ)
  const inCode = Object.keys(dye.EXACT_DYE_MASKS || {});
  check('正式マスクを持つモンスターをすべて見ている',
    inCode.every(id => APPROVED_MASKS[id]), `実装=${inCode.join(',')} / 検査=${Object.keys(APPROVED_MASKS).join(',')}`);
  console.log('--- 原寸で測った染色の精度 ---');
  for (const id of ids) await measure(dye, images, id);
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
