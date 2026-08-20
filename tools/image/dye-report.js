const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 染色もどきの回帰テスト。本番と同じ getDyeRegionMasks を実画像に対して呼び、
// 部位ごとの画素数・被覆率を出す。染色ロジックを触ったあと、意図しないモンスターの
// 部位分けまで動いていないかを数値で確認するために使う。
//
//   node image/dye-report.js                  … 全モンスター(ベースラインがあれば差分表示)
//   node image/dye-report.js Iblis Suezo      … 指定モンスターのみ
//   node image/dye-report.js --save-baseline  … 現在の結果を dye-baseline.json に保存
const fs = require('fs');
const path = require('path');
const { loadDyeModule, loadEmbeddedImages, imageForBaseId, decodeDataUrl, createCanvas } = require('../harness');

const BASELINE = path.join(TOOLS_DIR, 'dye-baseline.json');
// 被覆率がこの割合(相対)以上動いたら差分として警告する
const DIFF_TOLERANCE = 0.005;

async function analyze(baseId, dataUrl, dye) {
  const img = await decodeDataUrl(dataUrl);
  const urls = await dye.getDyeRegionMasks(baseId, dataUrl);
  if (!urls) return { baseId, width: img.width, height: img.height, opaque: 0, regions: null };
  // マスクは表示サイズに合わせて縮小した解像度で作られるため、被覆率は
  // 「元画像の画素数」ではなく「マスクと同じ解像度に縮めた元画像の不透明画素数」で割る。
  // こうしておけば解析解像度を変えても被覆率は変わらず、部位分けの変化だけを検出できる
  const first = await decodeDataUrl(urls[0]);
  const w = first.width, h = first.height;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h).data;
  let opaque = 0;
  for (let i = 0; i < w * h; i++) if (src[i * 4 + 3] >= 20) opaque++;
  const regions = [];
  for (const url of urls) {
    const mimg = await decodeDataUrl(url);
    const mc = createCanvas(mimg.width, mimg.height);
    const mctx = mc.getContext('2d');
    mctx.drawImage(mimg, 0, 0);
    const md = mctx.getImageData(0, 0, mimg.width, mimg.height).data;
    let n = 0;
    for (let i = 0; i < mimg.width * mimg.height; i++) if (md[i * 4 + 3] >= 20) n++;
    regions.push(n);
  }
  const covered = regions.reduce((a, b) => a + b, 0);
  return { baseId, width: w, height: h, opaque, regions, uncolored: opaque - covered };
}

(async () => {
  const args = process.argv.slice(2);
  const save = args.includes('--save-baseline');
  const targets = args.filter((a) => !a.startsWith('--'));
  const dye = loadDyeModule();
  const images = loadEmbeddedImages();
  const ids = (targets.length ? targets : Object.keys(dye.MASU_COLOR_REGION_HUES));

  const baseline = (!save && fs.existsSync(BASELINE)) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : null;
  const result = {};
  let warned = 0;

  for (const baseId of ids) {
    const dataUrl = imageForBaseId(baseId, images);
    if (!dataUrl) { console.log(`${baseId}: 画像が見つかりません(スキップ)`); continue; }
    const r = await analyze(baseId, dataUrl, dye);
    if (!r.regions) { console.log(`${baseId}: 部位マスクが生成されませんでした`); continue; }
    const pct = (n) => ((n / r.opaque) * 100).toFixed(2) + '%';
    const parts = r.regions.map((n, i) => `染色${i + 1} ${pct(n)}`).join(' / ');
    console.log(`${baseId.padEnd(10)} ${String(r.width) + 'x' + r.height} 不透明 ${r.opaque}px  ${parts}  無染色 ${pct(r.uncolored)}`);
    result[baseId] = { width: r.width, height: r.height, opaque: r.opaque, regions: r.regions, uncolored: r.uncolored };

    if (baseline && baseline[baseId]) {
      const b = baseline[baseId];
      if (b.regions.length !== r.regions.length) {
        console.log(`  ⚠ 部位数が ${b.regions.length} → ${r.regions.length} に変化`);
        warned++;
      } else {
        r.regions.forEach((n, i) => {
          const before = b.regions[i] / b.opaque, after = n / r.opaque;
          if (Math.abs(after - before) > DIFF_TOLERANCE) {
            console.log(`  ⚠ 染色${i + 1} の被覆率が ${(before * 100).toFixed(2)}% → ${(after * 100).toFixed(2)}% に変化`);
            warned++;
          }
        });
      }
    }
  }

  if (save) {
    fs.writeFileSync(BASELINE, JSON.stringify(result, null, 2) + '\n');
    console.log(`\nベースラインを保存しました: ${path.relative(process.cwd(), BASELINE)}`);
  } else if (baseline) {
    console.log(warned ? `\n${warned}件の差分があります(意図した変更か確認すること)` : '\nベースラインとの差分はありません');
  } else {
    console.log('\nベースライン未作成。--save-baseline で保存すると次回から差分が出ます');
  }
})().catch((e) => { console.error(e); process.exit(1); });
