const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 届いたスクリーンショットから背景を抜いて、既存の敵の絵と同じ形
// (長辺160pxの透過PNG・数KB)にそろえる道具。
//
//   node tools/image/cutout-enemy-art.js <入力> <出力> [<入力> <出力> …]
//   FILL_ALL=1 node tools/image/cutout-enemy-art.js …   体のあいだに背景が見えていない絵のとき
//
// 原本は tools/art-sources/enemies-tactics/ に置いてある。
//
// 【なぜ道具にするか】
// 背景は単色ではなく**なだらかなグラデーション**で、モンスターのほうにも白い部分がある
// (メタルナーの体・イナリのお腹・コイノボリの鱗)。色の近さだけで塗り広げると、輪郭の
// 1点を通って体の中へ入り込み、白いところがまるごと消える。実際に一度そうなった。
//
// そこで次の4段で抜く。
//   ① 明るさの変化(勾配)が急なところを「壁」にする。モンスターの輪郭には影と線があるので
//      壁が立ち、背景のグラデーションは変化が緩いので壁にならない
//   ② 外周から、背景色に近く・壁でないところだけを塗り広げる。
//      背景の見本は四隅ではなく**外周1周**から取る(四隅だけだとグラデーションの途中を拾えない)
//   ③ 体の中にできた抜けを埋め戻す。上下左右の4方向すべてで本体に挟まれているところだけなので、
//      脚のあいだのような「下が開いている隙間」は埋まらない。
//      さらに、もっと厳しい目で見てもなお背景そのものなら埋めない(股のあいだが埋まるのを防ぐ)
//   ④ 画面の端に写り込んだUIの切れ端を落とす(いちばん大きい塊の2%に満たない島)
//
// 【使ったあと】
// 切り抜いた絵を monster-hero/images/enemies/ へ置くのは、データへ組み込むときだけ。
// 先に置くと tools/image-asset-check.js が「どこからも参照されていない絵」として落とす。
const sharp = require(require('path').join(TOOLS_DIR, 'node_modules/sharp'));
const path = require('path');

// 既定値は2026-09-21に4体(カワズモー・メタルナー・イナリ・コイノボリ)で合わせた値。
// 背景と体の白が近い絵でも中まで抜けないところまで絞ってある
const TOLERANCE = Number(process.env.TOL || 24);  // 背景色からどれだけ離れてよいか
const EDGE = Number(process.env.EDGE || 24);      // これより急な変化は輪郭とみなす
const TINT = Number(process.env.TINT || 10);     // 色みの差(R-B)。白い体と黄色い背景を分ける
// 体のあいだに背景が見えていない絵(イナリのように顔と体がくっついている)では、
// 囲まれた抜けを色を問わず全部埋める
const FILL_ALL = process.env.FILL_ALL === '1';
const LONG_SIDE = 160;

const cutout = async (src, dest) => {
  const img = sharp(src);
  const { width, height } = await img.metadata();
  const raw = await img.ensureAlpha().raw().toBuffer();
  const gray = await sharp(src).greyscale().raw().toBuffer();
  const at = (x, y) => (y * width + x) * 4;
  const g = (x, y) => gray[y * width + x];

  // ① ソーベルで輪郭の強さを出す
  const edge = new Uint8Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const gx = (g(x + 1, y - 1) + 2 * g(x + 1, y) + g(x + 1, y + 1))
        - (g(x - 1, y - 1) + 2 * g(x - 1, y) + g(x - 1, y + 1));
      const gy = (g(x - 1, y + 1) + 2 * g(x, y + 1) + g(x + 1, y + 1))
        - (g(x - 1, y - 1) + 2 * g(x, y - 1) + g(x + 1, y - 1));
      if (Math.hypot(gx, gy) / 4 > EDGE) edge[y * width + x] = 1;
    }
  }

  const px = (x, y) => [raw[at(x, y)], raw[at(x, y) + 1], raw[at(x, y) + 2]];
  // 背景の見本は四隅ではなく**外周1周**から取る。四隅だけだと、グラデーションの途中の色を
  // 「背景ではない」と見なしてしまう(または許容を広げすぎて白い体まで巻き込む)
  const base = [];
  const step = Math.max(1, Math.round((width + height) / 120));
  for (let x = 0; x < width; x += step) { base.push(px(x, 0)); base.push(px(x, height - 1)); }
  for (let y = 0; y < height; y += step) { base.push(px(0, y)); base.push(px(width - 1, y)); }
  const near = (p, q, limit) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) <= limit * 3;
  // ★背景は黄色み(青が低い)、白い体は無彩色。明るさの差だけを見ると混ざるので、
  //   「色みのバランス(R-B)」も比べる。これで白い毛・白い鱗が残る
  const tint = (p) => p[0] - p[2];
  const bgLike = (c) => base.some(b => near(c, b, TOLERANCE) && Math.abs(tint(c) - tint(b)) <= TINT);

  // ② 外周から塗り広げる(壁は越えない)
  const bg = new Uint8Array(width * height);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (bg[i] || edge[i]) return;
    if (!bgLike(px(x, y))) return;
    bg[i] = 1;
    stack.push(x, y);
  };
  for (let x = 0; x < width; x += 1) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y += 1) { push(0, y); push(width - 1, y); }
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  // ③ 体の中に残った背景色の塊(外周とつながっていない)は、穴なので埋め戻す
  //    ＝ bg に入らなかったところはすべて本体。ここでは何もしなくてよい。
  //    逆に、輪郭の壁のせいで**背景側に残った細い縁**は、まわりが全部背景なら背景へ寄せる
  for (let pass = 0; pass < 2; pass += 1) {
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const i = y * width + x;
        if (bg[i]) continue;
        const around = bg[i - 1] + bg[i + 1] + bg[i - width] + bg[i + width];
        if (around >= 4 && bgLike(px(x, y))) bg[i] = 1;
      }
    }
  }

  // ★体の中にできた抜け(顔の白いところなど)を埋め戻す。
  //   上下左右の**4方向すべて**で本体に挟まれているところだけを埋めるので、
  //   脚のあいだのような「下が開いている隙間」は埋まらない
  const solidLeft = new Int32Array(width * height);
  const solidRight = new Int32Array(width * height);
  const solidUp = new Int32Array(width * height);
  const solidDown = new Int32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    let seen = 0;
    for (let x = 0; x < width; x += 1) { const i = y * width + x; if (!bg[i]) seen = 1; solidLeft[i] = seen; }
    seen = 0;
    for (let x = width - 1; x >= 0; x -= 1) { const i = y * width + x; if (!bg[i]) seen = 1; solidRight[i] = seen; }
  }
  for (let x = 0; x < width; x += 1) {
    let seen = 0;
    for (let y = 0; y < height; y += 1) { const i = y * width + x; if (!bg[i]) seen = 1; solidUp[i] = seen; }
    seen = 0;
    for (let y = height - 1; y >= 0; y -= 1) { const i = y * width + x; if (!bg[i]) seen = 1; solidDown[i] = seen; }
  }
  // ★ただし、脚のあいだのように**本当に背景が見えている**ところは埋めない。
  //   見分け方は色。埋めたいのは「白い体を背景とまちがえた」ところなので、
  //   もっと厳しい目で見てもなお背景そのものなら、そこは埋めない
  const strictBg = (c) => base.some(b => near(c, b, TOLERANCE * 0.5) && Math.abs(tint(c) - tint(b)) <= TINT * 0.5);
  let filled = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (!bg[i]) continue;
      if (!(solidLeft[i] && solidRight[i] && solidUp[i] && solidDown[i])) continue;
      if (!FILL_ALL && strictBg(px(x, y))) continue;
      bg[i] = 0; filled += 1;
    }
  }

  // ★画面の端に写り込んだUIの切れ端などを落とす。
  //   残った塊のうち、いちばん大きいものの2%に満たない小さな島は本体ではない
  const label = new Int32Array(width * height).fill(-1);
  const sizes = [];
  for (let start = 0; start < width * height; start += 1) {
    if (bg[start] || label[start] >= 0) continue;
    const id = sizes.length;
    let count = 0;
    const queue = [start];
    label[start] = id;
    while (queue.length) {
      const i = queue.pop();
      count += 1;
      const x = i % width, y = (i - x) / width;
      const next = [];
      if (x > 0) next.push(i - 1);
      if (x < width - 1) next.push(i + 1);
      if (y > 0) next.push(i - width);
      if (y < height - 1) next.push(i + width);
      for (const j of next) if (!bg[j] && label[j] < 0) { label[j] = id; queue.push(j); }
    }
    sizes.push(count);
  }
  const biggest = Math.max(0, ...sizes);
  let dropped = 0;
  for (let i = 0; i < width * height; i += 1) {
    if (bg[i]) continue;
    if (sizes[label[i]] < biggest * 0.02) { bg[i] = 1; dropped += 1; }
  }

  let cleared = 0;
  for (let i = 0; i < width * height; i += 1) if (bg[i]) { raw[i * 4 + 3] = 0; cleared += 1; }

  const out = await sharp(raw, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const meta = await sharp(out).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
  const w = meta.info.width, h = meta.info.height;
  const resize = w >= h ? { width: LONG_SIDE } : { height: LONG_SIDE };
  await sharp(meta.data).resize({ ...resize, fit: 'inside' })
    .png({ palette: true, quality: 90, effort: 10 })
    .toFile(dest);
  const done = await sharp(dest).metadata();
  console.log(`${path.basename(dest)}  ${width}x${height} → ${done.width}x${done.height}  背景 ${Math.round(cleared / (width * height) * 100)}% / 埋め戻し ${filled}px / 切れ端 ${dropped}px`);
};

(async () => {
  const jobs = process.argv.slice(2);
  for (let i = 0; i < jobs.length; i += 2) await cutout(jobs[i], jobs[i + 1]);
})();
