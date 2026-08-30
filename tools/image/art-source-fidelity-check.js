// 配信中の立ち絵が、原本(`art-sources/monsters/`)から絵を削っていないかを見張る。
//
//   node image/art-source-fidelity-check.js
//
// 【なぜ要るか】
// 立ち絵は「背景の白を透過にする」「余白を切る」「256色へ減色する」といった加工を通して
// 配信用にする。このうち透過の加工は、閾値の取り方を誤ると背景と一緒に絵そのものを消す。
// 実際にパンドラで、頭上の輪の内側を透過しようとして輪の金色まで4772画素ぶん削り取り、
// 輪が途切れたまま公開してしまった(2026年8月・コミット ad1f3af)。
// 減色や圧縮の検査(compress-images.js のPSNR判定)は「残っている画素の色」しか見ないので、
// 消えてしまった画素には気づけない。ここでは原本と突き合わせて「絵が減っていないか」だけを見る。
//
// 【何と何を比べるか】
// 原本と配信画像の大きさが同じものだけを比べる。余白を切ってあるもの(エイキ)や
// 別の絵から作り直すもの(プラント)は、座標が対応しないので比較の対象外として理由を出す。
// 減色で境界の半透明画素がいくつか落ちるのは避けられないため、割合で上限を置く。
const fs = require('fs');
const path = require('path');
const { createCanvas, REPO_ROOT } = require('../harness');
const { loadImage } = require('canvas');

// 配信中の立ち絵 → その原本。原本が配信画像と同じ座標系のものだけがここの対象になる
const PAIRS = [
  {
    id: 'Pandora',
    art: 'monster-hero/images/monsters/pandora.PNG',
    source: 'tools/art-sources/monsters/PANDORA-original.PNG',
  },
  {
    id: 'Eiki',
    art: 'monster-hero/images/monsters/eiki.png',
    source: 'tools/art-sources/monsters/EIKI-original.png',
    // trim-art-margin.js で上下の余白を切ってあるので、原本と座標が1対1にならない
  },
  {
    id: 'Plant',
    art: 'monster-hero/images/monsters/plant.PNG',
    source: 'tools/art-sources/monsters/PLANT.PNG',
    // make-plant-dye-mask.js が原本から作り直す。向きも大きさも違う
  },
];

// 「絵として見えている」とみなすアルファ。これ以上の画素が消えていたら数える
const ALPHA_VISIBLE = 40;
// 減色で境界の半透明画素が落ちるぶんの上限。
// パンドラの実測は、原本から作り直して減色しただけなら0.18%、
// 輪を削ってしまっていた公開版は0.88%だった。その間に線を引く
const MAX_LOST_RATE = 0.0035;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const pixelsOf = (image) => {
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, image.width, image.height).data;
};

(async () => {
  for (const pair of PAIRS) {
    const artPath = path.join(REPO_ROOT, pair.art);
    const sourcePath = path.join(REPO_ROOT, pair.source);
    if (!fs.existsSync(sourcePath)) {
      check(`${pair.id}: 原本がある (${pair.source})`, false);
      continue;
    }
    const [art, source] = await Promise.all([loadImage(artPath), loadImage(sourcePath)]);
    if (art.width !== source.width || art.height !== source.height) {
      console.log(`- ${pair.id}: 原本${source.width}x${source.height} / 配信${art.width}x${art.height}`
        + ' — 大きさが違うので比較しない(余白を切る・作り直す加工が入っている)');
      continue;
    }
    const a = pixelsOf(art), s = pixelsOf(source);
    let visible = 0, lost = 0, top = 0;
    for (let i = 0; i < art.width * art.height; i++) {
      if (s[i * 4 + 3] < ALPHA_VISIBLE) continue;
      visible++;
      if (a[i * 4 + 3] >= ALPHA_VISIBLE) continue;
      lost++;
      // 頭部まわり(上から1/6)は輪・角・髪飾りのような細い装飾が集まっていて、
      // 透過の加工で真っ先に消える。どこが減ったのか分かるよう別に数える
      if (i < art.width * Math.round(art.height / 6)) top++;
    }
    const rate = lost / visible;
    console.log(`  ${pair.id.padEnd(10)} 原本の絵${visible}px — 配信で消えている${lost}px`
      + `(${(rate * 100).toFixed(2)}% / うち上部${top}px)`);
    check(`${pair.id}: 原本から絵を削っていない(${(MAX_LOST_RATE * 100).toFixed(2)}%以下)`,
      rate <= MAX_LOST_RATE, `${(rate * 100).toFixed(2)}%`);
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
