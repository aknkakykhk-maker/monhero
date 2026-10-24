// カードバトルの元のカード画像(742×1038)から、下の帯の「© TECMO, LTD. 1999」「monsterrancherbc.com」を消して、配信用の2つの大きさに縮める。
//
// 【なぜ道具にするか】(2026-10-24 社長「それだけ消せない？」・許可を取ったときに消してよいと言われた)
// カードは数百枚になるので、1枚ずつ手で塗ると、塗り残しや絵へのはみ出しが出る。
// 消すのは下の細い帯の文字だけで、絵・数字・名前・番号には手を加えない。
// 消し方: 文字の入った四角の、すぐ上の行とすぐ下の行の色をつないで塗る(列ごとに上から下へ色を移す)。
// 帯の色はほとんど縦にそろっているので、これで周りの色になじむ。
//
// 使い方:
//   node tools/card/card-image-build.js --sample <出力.png> [カード画像...]   消す前と後を並べた見本を1枚作る(配信には何も書かない)
//   node tools/card/card-image-build.js --build                                   全カードを monster-hero/images/card-battle/{s,l}/ へ書き出す
//   技カードの絵の右下に乗っている「© TECMO」も同じやり方で消す(2026-10-24 社長が決めた)。--keep-art-copyright で残せる(比べる見本用)
const fs = require('fs');
const path = require('path');
const sharp = require(path.join(__dirname, '..', 'node_modules', 'sharp'));

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'tools', 'art-sources', 'card-battle');
const OUT = path.join(ROOT, 'monster-hero', 'images', 'card-battle');
const W = 742, H = 1038;
const SIZES = { s: [240, 336], l: [480, 672] };

// 消す四角(元の大きさの座標)。モンスターカード(番号が C- で始まる)と技カードで、文字の場所が違う
const BAND = {
  // 名前とライフのあいだ。© は絵の板の下のふちの内側、URL はふちの下の帯にあるので、四角を分ける
  // (1つの四角にすると、ふちをまたいで塗ってしまい、四角く浮いて見えた)
  monster: [{ x0: 265, y0: 935, x1: 452, y1: 955, from: 'top' }, { x0: 272, y0: 967, x1: 444, y1: 987 }],
  skill: [{ x0: 402, y0: 957, x1: 690, y1: 989 }],     // 右下: URL の行(© は帯ではなく絵の上にある)
};
const ART_COPYRIGHT = { x0: 496, y0: 702, x1: 690, y1: 731, from: 'top' }; // 技カードの絵の右下の「© TECMO, LTD. 1999」
// 日本語にした絵(全モンスター・ブリーダー)は、縦じまが目立たないように広くならす(blur)。
// ブリーダーの絵は右のふちが x≈678 から灰色の枠なので、その手前で止める(ふちの明るい色が左へ伸びて白くにじんでいた・カゲあつくん 113・122・126)
const ART_COPYRIGHT_JA = { ...ART_COPYRIGHT, blur: 9 };
const ART_COPYRIGHT_BREEDER = { ...ART_COPYRIGHT_JA, x1: 674 };

// ★混血の絵は「C051.jpg」と「-」が無い名前なので、C のあとに数字が続くものもモンスターカードにする
//   (前は技カードとして扱っていて、© が残り、右下の「No. C-051」を塗りつぶしていた・2026-10-24 に気づいた)
const isMonster = (file) => /^C-?\d/.test(path.basename(file));

// 四角の中を、上の2行と下の2行の色から列ごとにつないで塗る。from:'top' は上の2行の色だけで塗る(下がふちのとき)
const fillRect = (px, ch, r) => {
  const at = (x, y, c) => px[(y * W + x) * ch + c];
  // 帯の地にはざらつきがあるので、1列だけ拾うと縦すじになる。左右3列ずつ・2行をならして拾う
  const near = (x, ys, c) => {
    let sum = 0, n = 0;
    // 絵の上(© の所)は色の変わりが大きいので、もっと広くならす(blur)。四角の外の列は拾わない(ふちの色を引きこまない)
    const k = r.blur || 3;
    for (let dx = -k; dx <= k; dx += 1) for (const y of ys) { sum += at(Math.min(r.blur ? r.x1 : W - 1, Math.max(r.blur ? r.x0 : 0, x + dx)), y, c); n += 1; }
    return sum / n;
  };
  for (let x = r.x0; x <= r.x1; x += 1) {
    for (let c = 0; c < ch; c += 1) {
      const top = near(x, [r.y0 - 1, r.y0 - 2], c);
      const bot = r.from === 'top' ? top : near(x, [r.y1 + 1, r.y1 + 2], c);
      for (let y = r.y0; y <= r.y1; y += 1) {
        const t = (y - r.y0 + 1) / (r.y1 - r.y0 + 2);
        px[(y * W + x) * ch + c] = Math.round(top * (1 - t) + bot * t);
      }
    }
  }
};

const erase = async (file, { artCopyright = true, breeder = false } = {}) => {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== W || info.height !== H) throw new Error(`${file}: 大きさが ${info.width}×${info.height}(${W}×${H} のはず)`);
  const rects = [...(isMonster(file) ? BAND.monster : BAND.skill)];
  if (artCopyright && !isMonster(file)) rects.push(breeder ? ART_COPYRIGHT_BREEDER : file.startsWith(JA) ? ART_COPYRIGHT_JA : ART_COPYRIGHT);
  for (const r of rects) fillRect(data, info.channels, r);
  return sharp(data, { raw: { width: W, height: H, channels: info.channels } });
};

// 日本語にした絵(card-image-ja.js が書き出したもの)。同じファイル名があれば、英語版の代わりにこちらを使う(社長 台帳 #3511「このやり方で全部作る」)
const JA = path.join(ROOT, 'tools', 'art-sources', 'card-battle-ja');
const jaOf = (f) => { const j = path.join(JA, path.basename(f)); return fs.existsSync(j) ? j : f; };
const allCards = () => fs.readdirSync(SRC, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(SRC, d.name, 'cards.json')))
  .flatMap((d) => fs.readdirSync(path.join(SRC, d.name)).filter((f) => f.endsWith('.jpg')).map((f) => path.join(SRC, d.name, f)));

const sample = async (out, files, opts) => {
  const scale = 0.5, w = Math.round(W * scale), h = Math.round(H * scale), gap = 12;
  const comp = [];
  for (let i = 0; i < files.length; i += 1) {
    const before = await sharp(files[i]).resize(w, h).toBuffer();
    const after = await (await erase(files[i], opts)).resize(w, h).png().toBuffer();
    const y = i * (h + gap + 30);
    const label = (t) => Buffer.from(`<svg width="${w}" height="28"><rect width="100%" height="100%" fill="#222"/><text x="8" y="20" font-size="18" fill="#fff">${t}</text></svg>`);
    comp.push({ input: label(`${path.basename(files[i])} 消す前`), left: 0, top: y },
      { input: before, left: 0, top: y + 30 },
      { input: label(`${path.basename(files[i])} 消した後`), left: w + gap, top: y },
      { input: after, left: w + gap, top: y + 30 });
  }
  await sharp({ create: { width: w * 2 + gap, height: files.length * (h + gap + 30), channels: 3, background: '#555' } })
    .composite(comp).png().toFile(out);
  console.log(`見本: ${out}(${files.length}枚)`);
};

const build = async (opts) => {
  const files = allCards();
  for (const [key, [w, h]] of Object.entries(SIZES)) fs.mkdirSync(path.join(OUT, key), { recursive: true });
  for (const f of files) {
    const img = await erase(jaOf(f), { ...opts, breeder: path.basename(path.dirname(f)) === 'breeder' });
    const buf = await img.png().toBuffer();
    for (const [key, [w, h]] of Object.entries(SIZES)) {
      await sharp(buf).resize(w, h).jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(OUT, key, path.basename(f)));
    }
  }
  console.log(`書き出し: ${files.length}枚 × ${Object.keys(SIZES).length}つの大きさ → ${path.relative(ROOT, OUT)}`);
};

module.exports = { erase, allCards, isMonster, jaOf };

if (require.main === module) (async () => {
  const args = process.argv.slice(2);
  const opts = { artCopyright: !args.includes('--keep-art-copyright') };
  const rest = args.filter((a) => !a.startsWith('--'));
  if (args.includes('--sample')) {
    const [out, ...files] = rest;
    if (!out || !files.length) throw new Error('--sample <出力.png> <カード画像...>');
    await sample(out, files, opts);
  } else if (args.includes('--build')) {
    await build(opts);
  } else {
    console.log('使い方: --sample <出力.png> <カード画像...> / --build  (どちらにも --keep-art-copyright を足せる)');
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
