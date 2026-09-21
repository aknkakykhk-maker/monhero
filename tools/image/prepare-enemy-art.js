const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// **すでに透過してある**敵の絵を、配信中の敵と同じ形(長辺160pxの透過PNG・数KB)へそろえる道具。
// 背景は抜かない。抜くのは cutout-enemy-art.js。
//
//   node tools/image/prepare-enemy-art.js <入力> <出力> [<入力> <出力> …]
//   LONG=1024 node tools/image/prepare-enemy-art.js …   ボスなど、大きく拡大して出す絵のとき
//   PAD=2 node tools/image/prepare-enemy-art.js …       まわりに余白を残す(既定0)
//
// 【なぜ道具を分けるか】
// 背景をこちらで抜くと、白い体や薄い色のところまで一緒に消える。2026-09-21にユーザーから
// 「透過精度が悪すぎる」と言われ、絵を出し直してもらうことにした。
// 透過済みで受け取るほうが確実なので、こちらは**大きさをそろえることだけ**をする。
//
// 【そのうえで、届いた絵の透過を数字で出す】
// 見たまま「きれい」かどうかは、開かないと分からない。次の3つで機械的に測って、
// 手を入れる必要があるかどうかをその場で判断できるようにする。
//   ・縁のなめらかさ … アルファが0でも255でもない画素の割合。0%に近いとギザギザに見える
//   ・切れ端         … 本体から離れた小さな島の数。背景の消し残り・UIの写り込み
//   ・縁の明るさ     … 本体のまわり1周の明るさ。白い背景の消し残り(ハロー)があると高くなる
//
// 【使ったあと】
// 出した絵を monster-hero/images/enemies/ へ置くのは、データ(TACTICS_ENEMY_DATA)へ
// 組み込むときだけ。先に置くと tools/image-asset-check.js が
// 「どこからも参照されていない絵」として落とす。
const path = require('path');
const fs = require('fs');
const sharp = require(path.join(TOOLS_DIR, 'node_modules/sharp'));

const LONG_SIDE = Number(process.env.LONG || 160); // 長辺。ふだんは160px(配信中の敵と同じ)
const PAD = Number(process.env.PAD || 0);          // トリムのあとに残す余白
const BOX = 56;          // バトル画面・全WAVE詳細で敵の絵を収めている枠(w-14 h-14)
const ON = 40;           // ここより濃ければ「絵がある」とみなす(enemy-art-size-report.js と同じ)
const SOLID = 200;       // ここより濃ければ「本体」とみなす(縁の明るさを測るときの基準)
const CHIP_RATE = 0.02;  // いちばん大きい塊のこの割合に満たない島は「切れ端」

// アルファの通った画素の外接矩形。sharp の trim は色で切るので、透過はこちらで数える
const alphaBounds = (raw, width, height) => {
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (raw[(y * width + x) * 4 + 3] <= ON) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
};

// 絵のある画素を4連結でまとめ、塊の大きさを大きい順に返す
const islands = (raw, width, height) => {
  const seen = new Uint8Array(width * height);
  const sizes = [];
  const stack = [];
  for (let start = 0; start < width * height; start += 1) {
    if (seen[start] || raw[start * 4 + 3] <= ON) continue;
    let size = 0;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop();
      size += 1;
      const x = i % width, y = (i - x) / width;
      const push = (nx, ny) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
        const j = ny * width + nx;
        if (seen[j] || raw[j * 4 + 3] <= ON) return;
        seen[j] = 1;
        stack.push(j);
      };
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    }
    sizes.push(size);
  }
  return sizes.sort((a, b) => b - a);
};

// 透過の質。縁のなめらかさ・切れ端の数・縁の明るさ
const quality = (raw, width, height) => {
  let opaque = 0, clear = 0, soft = 0;
  for (let i = 0; i < width * height; i += 1) {
    const a = raw[i * 4 + 3];
    if (a === 255) opaque += 1;
    else if (a === 0) clear += 1;
    else soft += 1;
  }
  // 本体のうち、隣が透明になっているところ(＝輪郭の1周)の明るさ
  let edgeSum = 0, edgeCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (raw[i * 4 + 3] < SOLID) continue;
      const touchesClear = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
        return raw[(ny * width + nx) * 4 + 3] <= ON;
      });
      if (!touchesClear) continue;
      edgeSum += (raw[i * 4] + raw[i * 4 + 1] + raw[i * 4 + 2]) / 3;
      edgeCount += 1;
    }
  }
  const sizes = islands(raw, width, height);
  const chips = sizes.filter((s, i) => i > 0 && s < sizes[0] * CHIP_RATE).length;
  return {
    opaque, clear,
    softRate: (opaque + soft) > 0 ? soft / (opaque + soft) : 0,
    chips, islandCount: sizes.length,
    edgeBrightness: edgeCount ? edgeSum / edgeCount : 0,
  };
};

const measureInBox = async (file) => {
  const { data, info } = await sharp(file)
    .resize({ width: BOX, height: BOX, fit: 'inside' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let on = 0;
  for (let i = 0; i < info.width * info.height; i += 1) if (data[i * 4 + 3] > ON) on += 1;
  return { w: info.width, h: info.height, rate: on / (BOX * BOX) };
};

const prepare = async (src, dest) => {
  const input = sharp(src);
  const meta = await input.metadata();
  const { data: raw, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;

  const q = quality(raw, width, height);
  if (q.clear === 0) {
    // 透過されていない絵。ここで止める。黙って進めると、背景ごと枠へ収まって絵だけ小さく並ぶ
    console.log(`NG: ${path.basename(src)} は透過されていません（完全に透明な画素が1つもない）。`);
    console.log('    透過済みで出し直してもらうか、背景を抜くなら tools/image/cutout-enemy-art.js を使ってください。');
    return false;
  }

  const bounds = alphaBounds(raw, width, height);
  if (!bounds) {
    console.log(`NG: ${path.basename(src)} は中身が空です（濃さ${ON}を超える画素が1つもない）。`);
    return false;
  }
  const left = Math.max(0, bounds.x0 - PAD), top = Math.max(0, bounds.y0 - PAD);
  const cropW = Math.min(width - left, bounds.x1 - bounds.x0 + 1 + PAD * 2);
  const cropH = Math.min(height - top, bounds.y1 - bounds.y0 + 1 + PAD * 2);
  const resize = cropW >= cropH ? { width: LONG_SIDE } : { height: LONG_SIDE };

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await sharp(raw, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: cropW, height: cropH })
    .resize({ ...resize, fit: 'inside' })
    .png({ palette: true, quality: 90, effort: 10 })
    .toFile(dest);

  const box = await measureInBox(dest);
  const out = await sharp(dest).metadata();
  const kb = (fs.statSync(dest).size / 1024).toFixed(1);
  console.log(`OK: ${path.basename(dest)}  ←  ${path.basename(src)}`);
  console.log(`    もとの大きさ ${meta.width}x${meta.height} → 余白を切って ${cropW}x${cropH} → ${out.width}x${out.height}（${kb}KB）`);
  console.log(`    透過: 縁のなめらかさ ${(q.softRate * 100).toFixed(1)}% / 切れ端 ${q.chips}個（塊は全部で${q.islandCount}個）/ 縁の明るさ ${Math.round(q.edgeBrightness)}`);
  console.log(`    ${BOX}px の枠での面積: ${Math.round(box.rate * 100)}%（配信中の敵は13〜68%。外れたら ENEMY_ART_LAYOUT の scale で持ち上げる）`);
  // 気になるところだけ、その場で言う。数字を並べるだけだと見落とす
  if (q.softRate < 0.005) console.log('    ⚠ 縁がほぼ硬い（アンチエイリアスが無い）。拡大するとギザギザが見えます');
  if (q.chips > 0) console.log(`    ⚠ 本体から離れた小さな島が ${q.chips} 個あります。背景の消し残りかもしれません`);
  if (q.edgeBrightness > 210) console.log('    ⚠ 輪郭が明るい。白い背景が1px残っている（ハロー）かもしれません');
  return true;
};

(async () => {
  const args = process.argv.slice(2);
  if (args.length < 2 || args.length % 2 !== 0) {
    console.log('使い方: node tools/image/prepare-enemy-art.js <入力> <出力> [<入力> <出力> …]');
    console.log('        LONG=1024 …  ボスなど、大きく拡大して出す絵のとき');
    console.log('        PAD=2 …      まわりに余白を残す(既定0)');
    process.exit(1);
  }
  let failed = 0;
  for (let i = 0; i < args.length; i += 2) {
    if (!(await prepare(args[i], args[i + 1]))) failed += 1;
  }
  process.exit(failed ? 1 : 0);
})();
