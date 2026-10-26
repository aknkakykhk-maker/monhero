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
async function loadSourceImage(name, dataUrl, quiet = false) {
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
    if (!quiet) console.log(`  ${path.relative(TOOLS_DIR, file)} を使用 (${img.width}x${img.height})`);
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

// 顔のまんなか(ART_ANCHORS・data/images/images-ally.js)。全身絵の中の位置(0〜1)。2026-10-26 社長「顔アイコンと全身絵のずれが出ない仕組み」
// あれば、この点を丸のまんなかに置く(FACE_BOXES の範囲は大きさを決めるだけ)。無ければ前のとおり、範囲の中の「絵がある所」のまんなかに置く
// (範囲を左右対称に取らないと、羽や髪のぶん顔がずれる。アークがそうだった)。表は tools/image/art-anchors.js で書き出す
function loadArtAnchors() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero', 'data', 'images', 'images-ally.js'), 'utf8');
  const m = src.match(/\nconst ART_ANCHORS = Object\.freeze\(([\s\S]*?)\);\n/);
  if (!m) return {};
  // Object.freeze を外して読む(値は数の配列だけ)
  return Function(`return (${m[1].replace(/Object\.freeze\(/g, '(')});`)();
}

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
// 第6要素は横位置の微調整(同じく割合。正で右へ)。絵の左右が非対称で、測った中心では顔が片側へ寄って見えるときに使う
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
  ARK: [0.30, 0.20, 0.70, 0.56, -0.02], // 顔(鼻)は絵の左右のまんなか。左右対称に取らないと羽の分だけ顔が右へずれる(2026-10-26 社長「アークがセンターずれ」)
  // 耳は長すぎるので上半分は入れず、耳の中ほど〜あご下を取る
  HAM: [0.41, 0.22, 0.61, 0.48, -0.02],
  // サンタ帽の先端〜あご下。帽子はこのモンスターの見た目の要なので範囲に含める。
  // 髪は肩より下まで伸びていて全部入れると顔が小さくなるので、顔の左右だけを取る
  SNEGUROCHKA: [0.30, 0.08, 0.66, 0.29, -0.01],
  // V字の角の先端〜あご下。横へ広がる髪と花飾りは範囲の外へ自然に流れるままにする
  // (このツールは矩形で切り抜かないため)。範囲をこれ以上せまくすると、丸型表示にしたとき
  // V字の角の先が円に切られる。逆に広げすぎると頭と肩のあいだに背景の空きが目立つ。
  // 縦の値は「余白を切ったあとの立ち絵(1024x1218)」の座標系。
  // 頭の下に体と刃が続くので、biasYを負にして顔を丸の上寄りへ持ち上げる
  EIKI: [0.37, 0.0, 0.63, 0.207, -0.06],
  // 髪の先端(0.053)〜のどの下端(0.49。コートの襟に隠れるところ)。
  // 左右は髪の広がりの実測(0.275〜0.726)にそろえる。
  // ★下端を口ばしの下(0.40)で切ると、測った中心が本来より上になり、そのぶん頭が
  //   枠の下へずれて口ばしとあごが縁で切れる(2026-09-08・ユーザー指摘「下により過ぎてる」)。
  //   この道具は矩形で切り抜くのではなく「範囲の中心を枠の中心へ合わせる」ので、
  //   範囲は頭のぜんぶ(あご下まで)を含める。
  KENSHI_MOCCHI: [0.275, 0.045, 0.726, 0.495, 0],
  // 人魚2体。立ち絵(1024x1536)は尾ひれまで入っていて頭が小さく写っているため、
  // 顔アイコンを持たせず立ち絵のまま丸枠へ出すと、倍率をいくら上げても
  // 「顔が小さいか、耳が切れて何のキャラか分からないか」のどちらかにしかならない
  // (2026-09-19・ユーザー指摘「アイコンのサイズ感が悪い 特にウンディーネ、ヤオビクニ」
  //  「同じウンディーネ種なんだからそれをもとにしろよ」)。同じ人魚のスネグーラチカは
  // 最初から顔アイコンを持っていて、それが「良い見え方」の正体だった。
  // 範囲の取り方もスネグーラチカにそろえ、髪の先端〜あご下／顔の左右だけを取る。
  UNDINE: [0.255, 0.0, 0.725, 0.28, -0.01],
  YAOBIKUNI: [0.255, 0.0, 0.725, 0.28, -0.01],
  // 近日公開予定の2体(2026-09-28)。縦横は余白を切ったあとの立ち絵の座標系。
  // ユグドラシルは鹿の耳の先〜あご下。角は長いので上半分は枠の外へ流す
  YGGDRASIL: [0.27, 0.15, 0.74, 0.41, -0.02],
  // メルホイップは頭の苺飾り〜あご下。左の傘は範囲に入れない
  MEL_WHIP: [0.31, 0.19, 0.78, 0.40, -0.02],
  // ゴースト(2026-10-05)。シルクハットのつば〜あご下。帽子の上半分は枠の外へ流す
  GHOST: [0.08, 0.13, 0.92, 0.63, -0.01],
  // スプーキー(2026-10-05)。とんがり帽子のつば〜あご下。帽子の先とリボンは枠の外へ流す
  SPOOKY: [0.12, 0.12, 0.88, 0.555, 0.0],
  // メロディー(2026-10-07)。顔を丸の中央へ置く(頭巾全体の中心に合わせると、右へ垂れた耳のぶん顔が右下へ寄った)。
  // 頭巾の上の耳と右の耳の先は枠の外へ流す。左の傘の柄は範囲の端にかかるので、範囲の左端の警告は出てよい。
  // 2026-10-07 にユーザーへ4案を並べて選んでもらった A 案(docs/rules/ASSETS.md「顔アイコンは案を並べて選んでもらう」)。
  // 2026-10-08 の正式実装で作り直し、A案を下げる→大きく→少し下げる、と4案ずつ並べて選んでもらった値
  MELODY: [0.38, 0.238, 0.64, 0.472, 0.16],
  // クロミー(2026-10-07)。頭巾の顔を中心に、右の耳の先まで入る程度に引く。2026-10-07 にユーザーへ4案→A案の調整4案を並べて選んでもらった1案
  KUROMY: [0.37, 0.25, 0.77, 0.54, 0.05],
  // イルミネ・ドリーミィ(2026-10-22)。社長が A〜D の4案から2体とも B(耳の先まで入れる)を選び、イルミネは「もっと上に」で
  // B の位置ちがい6案から「顔をもっと上へ」(顔を丸の上のほうへ寄せ、体の光る髪まで入れる)を選んだ
  //  元の4案: イルミネ A [0.33,0.10,0.66,0.38,0.03] / B [0.30,0.0,0.68,0.36,0.04] / C [0.39,0.18,0.60,0.34,0] / D [0.20,0.02,0.80,0.48,0.03]
  //           ドリーミィ A [0.30,0.10,0.60,0.31,0.02] / B 下 / C [0.34,0.14,0.54,0.28,0] / D [0.12,0.0,0.78,0.42,0.05]
  ILLUMINE: [0.30, 0.0, 0.68, 0.40, -0.08],
  DREAMY: [0.18, 0.0, 0.72, 0.32, 0.03],
  // 新しい16種(2026-10-24・まだ味方には入れていない)。立ち絵は MF_<種族>_IMG(images/monsters/<種族>.png)。
  // 案は元の絵から作ったので(docs/playbot/reports/2026-10-24/face-options/)、ここでは余白を切った立ち絵の座標へ直した値。
  // 社長が A〜D の4案から選んだ(A=顔まんなか / B=耳・角まで / C=寄り / D=引き)
  MF_DINO: [0.074, 0, 0.611, 0.334, 0], // B
  MF_NAGA: [0.316, 0.058, 0.684, 0.274, 0], // C
  MF_HENGER: [0, 0, 1, 1, 0], // D
  MF_ARROWHEAD: [0.013, 0.291, 0.986, 0.983, 0], // B
  MF_ZILLA: [0.099, 0.032, 0.881, 0.449, 0], // A
  MF_JOKER: [0.424, 0.135, 0.616, 0.358, 0], // A
  MF_JELL: [0.293, 0, 0.707, 0.265, 0], // B
  MF_MEW: [0, 0.108, 0.851, 0.629, 0], // A
  MF_METALNER: [0.11, 0.043, 0.915, 0.355, 0], // A
  MF_CENTAUR: [0.405, 0.168, 0.673, 0.38, 0], // A
  MF_COLORPANDORA: [0, 0, 1, 0.627, 0], // B
  // 位置を直してから選んだ5種(face-adjust-5.png の番号)。第6要素は横位置
  MF_GALI: [0.283, 0.007, 0.59, 0.331, 0, -0.1], // A を左へ多め(3)
  MF_DRAGON: [0.347, 0, 0.685, 0.26, 0, 0.05], // A を右へ少し(2)
  MF_DURAHAN: [0.297, 0.116, 0.587, 0.362, 0, 0.02], // A を右へごく少し(1)
  MF_PHOENIX: [0.37, 0.275, 0.604, 0.48, 0, -0.025], // A を左へごく少し(1)
  MF_WORM: [0.097, 0.425, 0.903, 0.941, 0], // C を少し引く(1)
  // 混血モンスター(2026-10-24・まだ味方には入れていない)。立ち絵は HYBRID_C0NN_IMG(images/monsters/c0NN.png)。案は取り込んだ立ち絵から作ったので座標はそのまま。
  // 社長が A〜D の4案から選んだ(docs/playbot/reports/2026-10-24/hybrid-face-options/)
  HYBRID_C051: [0.06, 0, 0.74, 0.554, 0], // バロン B
  HYBRID_C052: [0.31, 0, 0.69, 0.367, 0], // アクアリウス B
  HYBRID_C053: [0.12, 0, 0.85, 0.72, 0], // プラムラー A
  HYBRID_C054: [0.32, 0, 0.68, 0.3, 0], // ストライクリパー A
  HYBRID_C056: [0.19, 0, 0.81, 0.41, 0], // ヘルファット A(2026-10-26 の新しい絵で作り直した)
  HYBRID_C057: [0.31, 0, 0.69, 0.269, 0], // ウロコゲル B
  HYBRID_C058: [0, 0, 1, 1, 0], // ワカクサケンザイ B
  HYBRID_C059: [0.05, 0.3, 0.95, 0.75, 0], // ガーラント A
  HYBRID_C060: [0.15, 0.25, 0.88, 0.62, 0], // ミミニャー A
  HYBRID_C061: [0.1, 0.05, 0.9, 0.9, 0], // ベニヒメソウ B
  HYBRID_C062: [0.1, 0.3, 0.9, 1, 0], // ムラサキチュウ A
  // 位置を直してから選んだ4体(hybrid-face-adjust-4.png の番号)。第5要素は縦・第6要素は横
  HYBRID_C055: [0.28, 0.3, 0.72, 0.55, 0.12, 0], // ダークハム A を下へ多め(3)
  HYBRID_C063: [0.38, 0.08, 0.62, 0.32, -0.075, -0.075], // アーマードラゴン A を左上へ中(3)
  HYBRID_C064: [0.36, 0, 0.585, 0.295, 0, 0.09], // ケルマディクス B を右へ多め(3)
  HYBRID_C065: [0.22, 0.02, 0.82, 0.45, 0, 0.05], // ギガロン A を右へ少し(2)
  // 派生モンスター8体(2026-10-25)。社長が A〜D から選んだ(docs/playbot/reports/2026-10-25/hybrid-face-options/)
  HYBRID_C010: [0.1, 0, 0.68, 0.5, 0, 0.05], // ハムライガー B を少し右
  HYBRID_C012: [0, 0, 1, 0.85, 0], // メロンボ D
  HYBRID_C013: [0.28, 0, 0.72, 0.3, 0], // ラベンダーキール B
  HYBRID_C015: [0.25, 0.17, 0.75, 0.45, -0.05], // ヴァージアハピ A を少し引いて上へ
  HYBRID_C016: [0.33, 0.04, 0.69, 0.33, 0, 0.05], // エンジェル A を少し引いて右
  HYBRID_C017: [0.3, 0.02, 0.68, 0.38, 0], // ヒトツメオウジ A
  HYBRID_C018: [0.05, 0.12, 0.95, 0.78, 0], // ツノマル A
  HYBRID_C019: [0.3, 0.05, 0.7, 0.33, 0], // バズラ A
  HYBRID_C033: [0.35, 0.03, 0.65, 0.34, 0], // ナハトファルター A を少し引く
  HYBRID_C034: [0.15, 0, 0.65, 0.4, 0, 0.05], // カッチュウサウル B を少し右
  HYBRID_C035: [0.15, 0.05, 0.8, 0.5, 0, -0.04], // ヨロイモッチー A を少し左(目とくちばしの真ん中を中心へ)
  HYBRID_C036: [0.25, 0, 0.75, 0.4, 0], // パー・プリン B
  HYBRID_C038: [0, 0, 1, 1, 0], // ダークヘンガー D
  HYBRID_C039: [0.15, 0.08, 0.85, 0.52, 0, 0.1], // ママニャー A を右(鼻を中心へ)
  HYBRID_C040: [0.05, 0, 0.95, 0.9, 0], // ヒネクレソウ B
  HYBRID_C041: [0.1, 0.3, 0.9, 0.95, 0], // コロネ A
  HYBRID_C042: [0.28, 0, 0.72, 0.36, 0], // ジハード B
  HYBRID_C020: [0.12, 0, 0.88, 0.5, 0], // ジェントル B
  HYBRID_C043: [0.24, 0, 0.58, 0.33, 0], // ベスビオス B(中心を合わせる)
  HYBRID_C045: [0.3, 0, 0.7, 0.3, 0], // ムー B
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

// 顔アイコンの置き方を決める(描かずに数だけ返す)。art-anchors.js・art-anchor-check.js もこれを使う
// 返す値: img(背景の飾りを消した元絵)・scale(倍率)・dx/dy(元絵を置く位置)・anchor(使った基準。無ければ null)・opaque(範囲の中の絵がある所)
async function faceIconLayout(dataUrl, box, name, dye, anchors = null, quiet = false) {
  let img = await loadSourceImage(name, dataUrl, quiet);
  if (STRIP_BACKGROUND[name]) {
    const { canvas, removed } = stripBackground(img, STRIP_BACKGROUND[name], dye);
    if (!quiet) console.log(`  背景の飾りを ${removed}px 透明化しました`);
    img = canvas;
  }
  const [x0, y0, x1, y1, biasY = 0, biasX = 0] = box;
  // FACE_BOXES は目視で測った値なので、指定した矩形の中心と、実際に絵が描かれている
  // 部分の中心はズレることがある(モッチーが横にずれて見えていた原因)。
  // 指定範囲の中で不透明な画素が実際に占める範囲を測り直し、大きさはそちらで決める。
  const opaque = opaqueBoundsIn(img, x0, y0, x1, y1);
  if (!quiet && opaque.clipped && opaque.clipped.length) {
    console.log(`  ⚠ ${name}: 指定範囲が絵の${opaque.clipped.join('・')}端を切っています。FACE_BOXESを広げてください`);
  }
  const headW = opaque.w, headH = opaque.h;
  const anchor = anchors && anchors[name] && Array.isArray(anchors[name].face) ? anchors[name].face : null;
  // 基準があるときは、その点を丸のまんなかに置く(biasX・biasY は使わない。ずらしは基準の点そのものに含める)
  const headCx = anchor ? anchor[0] * img.width : opaque.cx, headCy = anchor ? anchor[1] * img.height : opaque.cy;
  // 頭の長辺が枠のFIT分を占めるように倍率を決める。基準に寄り具合(zoom)があれば掛ける(1より大きいと寄る、小さいと引く)
  const zoom = anchor && Number.isFinite(anchors[name].zoom) && anchors[name].zoom > 0 ? anchors[name].zoom : 1;
  const scale = (SIZE * FIT) / Math.max(headW, headH) * zoom;
  // 頭の中心が枠の中心(biasY・biasXぶんずらす)に来るよう、元絵全体を配置する。
  // 枠からはみ出た体や翼は自動的に切り落とされ、直線的な断面は残らない
  const dx = SIZE / 2 + (anchor ? 0 : biasX * SIZE) - headCx * scale;
  const dy = SIZE / 2 + (anchor ? 0 : biasY * SIZE) - headCy * scale;
  return { img, scale, dx, dy, anchor, opaque };
}

async function makeFaceIcon(dataUrl, box, name, dye, anchors = null, quiet = false) {
  const { img, scale, dx, dy } = await faceIconLayout(dataUrl, box, name, dye, anchors, quiet);
  const c = createCanvas(SIZE, SIZE);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, dx, dy, img.width * scale, img.height * scale);
  return c;
}

if (require.main === module) (async () => {
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
    const canvas = await makeFaceIcon(images[srcKey], box, name, dye, loadArtAnchors());
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

// 検査用: 何も表示せずに作る
const makeFaceIconQuiet = (dataUrl, box, name, dye, anchors = null) => makeFaceIcon(dataUrl, box, name, dye, anchors, true);

module.exports = { FACE_BOXES, SIZE, FIT, opaqueBoundsIn, loadSourceImage, faceIconLayout, makeFaceIcon, makeFaceIconQuiet, loadArtAnchors };
