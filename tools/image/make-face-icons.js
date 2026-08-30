const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 立ち絵から顔部分を切り出して、正方形の顔アイコン(faceIconUrl)を生成し
// data/images-ally.js の _FACE_ICON 宣言を差し替える。
//
//   node image/make-face-icons.js --preview   … out/ にプレビューPNGを書くだけ(データは変更しない)
//   node image/make-face-icons.js             … images-ally.js に書き戻す
//   node image/make-face-icons.js MOCCHI      … 指定したモンスターだけを書き戻す
//   node image/make-face-icons.js --force     … 既存が高解像度でも上書きする
//
// 2026年に高解像度イラストへ差し替えた6体は、顔クロップを別途用意しておらず
// faceIconUrl に立ち絵をそのまま入れていた(プロフィールアイコン選択画面で全身が
// 小さく縮んで表示されてしまっていた)。この6体分の顔アイコンをここで作る。
const fs = require('fs');
const path = require('path');
const { REPO_ROOT, loadEmbeddedImages, decodeDataUrl, imageFilePath, createCanvas, loadDyeModule } = require('../harness');
const { loadImage } = require('canvas');

// 顔アイコン用の高解像度の元画像を置く場所(art-sources/README.md 参照)。
// ここに <名前>.png があれば、埋め込みの立ち絵より優先して使う
const ART_SOURCES = path.join(TOOLS_DIR, 'art-sources');
async function loadSourceImage(name, dataUrl) {
  // 現行のモンスター原本置き場を優先し、過去の顔アイコン専用原本にも対応する。
  // GitHub 経由で保存されたファイルは拡張子が大文字になる場合があるため、双方を探す。
  // 配信フォルダに大文字名の原本(マーケットのアイコン商品として使っている高解像度版)が
  // ある場合はそれも原本として扱う。以前は同じ画像を art-sources へコピーして置いていたが、
  // 1バイトも違わない二重管理になっていたため、配信側の1枚を正本にした。
  const shipped = path.join(REPO_ROOT, 'monster-hero', 'images', 'monsters');
  const candidates = [
    path.join(ART_SOURCES, 'monsters', `${name}.png`),
    path.join(ART_SOURCES, 'monsters', `${name}.PNG`),
    path.join(ART_SOURCES, `${name}.png`),
    path.join(ART_SOURCES, `${name}.PNG`),
    path.join(shipped, `${name}.PNG`),
  ];
  const file = candidates.find(candidate => fs.existsSync(candidate));
  if (file) {
    const img = await loadImage(file);
    console.log(`  ${path.relative(TOOLS_DIR, file)} を使用 (${img.width}x${img.height})`);
    return img;
  }
  return decodeDataUrl(dataUrl);
}

// 出力する顔アイコンの一辺(px)。表示は最大でも60px程度だが、高DPI端末でも
// にじまないよう余裕をもって256pxにしている(旧来の顔アイコンは128px)
const SIZE = 256;
// 顔(FACE_BOXESの範囲)が枠の何割を占めるか。残りが余白になる。
// プロフィールアイコンは丸(rounded-full)で表示されるため、四隅は切り落とされる。
// 顔が丸の内側に収まるよう、正方形いっぱいには広げない
const FIT = 0.86;
// 顔アイコンを作るときに、MASU_COLOR_EXCLUDE(染色対象外の背景装飾)を透明にするモンスター。
// イブリースは頭の右後ろに背景の飾り(淡い紫の円)があり、顔だけ切り出すと
// 四角く途切れた薄い板のように写り込んでしまうため、切り出す前に消しておく
const STRIP_BACKGROUND = { IBLIS: 'Iblis' };

// 立ち絵に対する「頭」の範囲(正規化座標 [x0, y0, x1, y1])。
// tools/image/grid-overlay.js で目盛りを重ねた画像を出し、元絵から目視で実測した値。
//
// ここは「切り抜く矩形」ではなく「枠の中央に、この大きさで収めたい部分」を表す。
// 描画は元絵全体をこの倍率・位置で置くので、頭の周りの体や翼は自然に枠外へ流れる。
// 矩形で切り抜くと、体を横切ったところが直線で途切れて丸アイコンにしたとき
// 板状に見えてしまうため、この方式にしている。
//
// 第5要素は縦位置の微調整(枠の一辺に対する割合。正で下へ)。頭の下に体が続く
// モンスターは少し上に寄せたほうが、丸くトリミングしたときの収まりが良い。
const FACE_BOXES = {
  // 葉っぱの帽子の上端〜あご。頭の実際の左右端は0.297〜0.700なので、
  // 切り落とさないよう少し広めに取る(以前は右端を0.675で切っていたため
  // 測った中心が本来より左になり、結果として絵が右へずれていた)
  MOCCHI: [0.25, 0.04, 0.75, 0.42, -0.02],
  // 全身がほぼ頭。球状の頭部そのもの
  SUEZO: [0.22, 0.205, 0.78, 0.705, 0],
  // 角の先端〜あご
  PIXIE: [0.355, 0.11, 0.625, 0.315, -0.02],
  // 頭の岩ブロック(上端〜あご)
  GOLEM: [0.375, 0.03, 0.61, 0.245, -0.02],
  // 頭頂のクレスト〜あご下
  MITARASHI: [0.245, 0.04, 0.74, 0.425, -0.02],
  // 頭上に浮かぶ玉〜あご下。玉と輪はイブリースの意匠なので、中途半端に切れないよう
  // 玉の上端から範囲に含めている(背景の飾りはSTRIP_BACKGROUNDで消してから配置する)
  IBLIS: [0.245, 0.05, 0.735, 0.515, 0],
  // 頭の角の先端〜あご
  ZAN: [0.32, 0.05, 0.68, 0.40, -0.01],
  // 王冠の先端〜あご下。王冠と輪はアークの意匠なので範囲に含める
  ARK: [0.28, 0.23, 0.65, 0.56, -0.02],
  // 耳は長すぎるので上半分は入れず、耳の中ほど〜あご下を取る
  HAM: [0.41, 0.22, 0.61, 0.48, -0.02],
  // サンタ帽の先端〜あご下。帽子はこのモンスターの見た目の要なので範囲に含める。
  // 髪は肩より下まで伸びていて全部入れると顔が小さくなるので、顔の左右だけを取る
  SNEGUROCHKA: [0.30, 0.08, 0.66, 0.29, -0.01],
  // V字の角の先端(y=0.075あたりから絵が始まる)〜あご下。横へ広がる髪と花飾りは
  // 範囲の外へ自然に流れるままにする(このツールは矩形で切り抜かないため)。
  // 範囲をこれ以上せまくすると、丸型表示にしたときV字の角の先が円に切られる。
  // 逆に広げすぎると頭と肩のあいだに背景の空きが目立つので、その手前で止めている。
  // V字の角が高いぶん範囲の中心が顔より上に来るので、biasYで少し下げて顔を丸の中央へ寄せる
  EIKI: [0.37, 0.065, 0.63, 0.235, 0.04],
};

// MASU_COLOR_EXCLUDE に合致する画素(背景の飾り)を透明にした元画像を作る
function stripBackground(img, baseId, dye) {
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, img.width, img.height);
  const d = imgData.data;
  let removed = 0;
  for (let i = 0; i < img.width * img.height; i++) {
    const o = i * 4;
    if (d[o + 3] < 20) continue;
    const [hh, ss, vv] = dye._rgbToHsv(d[o], d[o + 1], d[o + 2]);
    const x = (i % img.width) / img.width, y = ((i / img.width) | 0) / img.height;
    if (dye._isExcludedDyePixel(baseId, hh, ss, vv, x, y)) { d[o + 3] = 0; removed++; }
  }
  ctx.putImageData(imgData, 0, 0);
  return { canvas: c, removed };
}

// 指定した正規化範囲の中で、実際に不透明な画素が占める範囲(と中心)を測る。
// 透明な余白を除いた「絵が本当にある位置」を基準にできるので、目視で測った矩形が
// 多少ずれていても、顔が枠の中央に来るように自動で補正される。
function opaqueBoundsIn(img, x0, y0, x1, y1) {
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, img.width, img.height).data;
  const sx = Math.max(0, Math.floor(x0 * img.width)), ex = Math.min(img.width, Math.ceil(x1 * img.width));
  const sy = Math.max(0, Math.floor(y0 * img.height)), ey = Math.min(img.height, Math.ceil(y1 * img.height));
  let minX = ex, maxX = sx, minY = ey, maxY = sy, found = false;
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      if (d[(y * img.width + x) * 4 + 3] < 20) continue;
      found = true;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  // 不透明な画素が見つからなければ指定範囲をそのまま使う(想定外の保険)
  if (!found) return { w: ex - sx, h: ey - sy, cx: (sx + ex) / 2, cy: (sy + ey) / 2 };
  // 指定範囲が被写体を左右どちらか片方だけで切っていると、測った中心が本来の中心から
  // ずれ、その分だけ絵が反対側へ寄って見える(モッチーが横にずれていた原因がこれ)。
  // 頭の下に体が続くモンスターでは上下や左右の両方が「切れて」いるのが普通なので、
  // 中心がずれる原因になる「片側だけ切れている」場合にかぎって警告する。
  const hitLeft = minX <= sx && sx > 0;
  const hitRight = maxX >= ex - 1 && ex < img.width;
  const clipped = [];
  if (hitLeft !== hitRight) clipped.push(hitLeft ? '左' : '右');
  return { w: maxX - minX + 1, h: maxY - minY + 1, cx: (minX + maxX + 1) / 2, cy: (minY + maxY + 1) / 2, clipped };
}

async function makeFaceIcon(dataUrl, box, name, dye) {
  let img = await loadSourceImage(name, dataUrl);
  if (STRIP_BACKGROUND[name]) {
    const { canvas, removed } = stripBackground(img, STRIP_BACKGROUND[name], dye);
    console.log(`  背景の飾りを ${removed}px 透明化しました`);
    img = canvas;
  }
  const [x0, y0, x1, y1, biasY = 0] = box;
  // FACE_BOXES は目視で測った値なので、指定した矩形の中心と、実際に絵が描かれている
  // 部分の中心はズレることがある(モッチーが横にずれて見えていた原因)。
  // 指定範囲の中で不透明な画素が実際に占める範囲を測り直し、そちらを中心として使う。
  const opaque = opaqueBoundsIn(img, x0, y0, x1, y1);
  if (opaque.clipped && opaque.clipped.length) {
    console.log(`  ⚠ ${name}: 指定範囲が絵の${opaque.clipped.join('・')}端を切っています。FACE_BOXESを広げてください`);
  }
  const headW = opaque.w, headH = opaque.h;
  const headCx = opaque.cx, headCy = opaque.cy;
  // 頭の長辺が枠のFIT分を占めるように倍率を決める
  const scale = (SIZE * FIT) / Math.max(headW, headH);
  // 頭の中心が枠の中心(縦だけbiasYぶんずらす)に来るよう、元絵全体を配置する。
  // 枠からはみ出た体や翼は自動的に切り落とされ、直線的な断面は残らない
  const dx = SIZE / 2 - headCx * scale;
  const dy = SIZE / 2 + biasY * SIZE - headCy * scale;

  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, img.width * scale, img.height * scale);
  return c;
}

(async () => {
  const preview = process.argv.includes('--preview');
  const force = process.argv.includes('--force');
  const requested = new Set(process.argv.slice(2)
    .filter(arg => arg !== '--preview' && arg !== '--force').map(arg => arg.toUpperCase()));
  const images = loadEmbeddedImages();
  const dye = loadDyeModule();
  fs.mkdirSync(path.join(TOOLS_DIR, 'out'), { recursive: true });

  let changed = 0;

  for (const [name, box] of Object.entries(FACE_BOXES)) {
    if (requested.size && !requested.has(name)) continue;
    const srcKey = `${name}_IMG`;
    if (!images[srcKey]) { console.log(`${srcKey}: 見つかりません(スキップ)`); continue; }
    const canvas = await makeFaceIcon(images[srcKey], box, name, dye);
    const buf = canvas.toBuffer('image/png');

    fs.writeFileSync(path.join(TOOLS_DIR, 'out', `${name}_FACE_ICON.png`), buf);
    console.log(`${name.padEnd(10)} 顔クロップ ${SIZE}x${SIZE}  ${(buf.length / 1024).toFixed(0)} KB`);

    if (preview) continue;
    // 顔アイコンはPNGファイルなので、変数が指しているファイルをそのまま上書きする。
    // 全身アイコンを顔アイコンとして使い回しているモンスター(変数が別名になっている)は
    // 上書きすると全身側まで書き換えてしまうため、対象外にする。
    const dest = images[`${name}_FACE_ICON`];
    if (!dest) { console.log(`  ⚠ ${name}_FACE_ICON の宣言が見つかりませんでした`); continue; }
    if (dest === images[srcKey]) { console.log(`  ⚠ ${name}_FACE_ICON は全身画像と同じファイルを共有しているため書き換えません`); continue; }
    const destPath = imageFilePath(dest);
    // すでに置いてある顔アイコンがこのツールより高解像度な場合は、上書きすると画質が落ちる。
    // ミタラシは512pxで手当てされており、うっかりこのツールを流して256pxへ縮んだうえ
    // 切り出し範囲まで変わってしまう、という事故を防ぐ(--force で上書きできる)。
    if (!force && fs.existsSync(destPath)) {
      const current = await loadImage(destPath);
      if (current.width > SIZE || current.height > SIZE) {
        console.log(`  ⚠ ${name} は既存が ${current.width}x${current.height} で、このツールの ${SIZE}px より大きいので書き換えません`);
        console.log(`     わざと ${SIZE}px へ作り直すときは --force を付ける`);
        continue;
      }
    }
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, buf);
    changed++;
  }

  if (preview) { console.log('\n--preview のため顔アイコンのPNGは更新していません'); return; }
  console.log(`\n${changed}件の顔アイコンPNGを作り直しました`);
})().catch((e) => { console.error(e); process.exit(1); });
