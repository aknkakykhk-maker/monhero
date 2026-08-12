// 染色もどきの「輪郭の塗り残し」を実測して見張る検査。
//
// 部位マスクは解析を軽くするため縮小した画像(MASK_ANALYSIS_MAX_SIZE)で作っている。
// 元絵がそれより大幅に大きいモンスターは、マスクの1画素が元絵の3画素ぶんになり、
//   ・部位の境目がマスクの画素単位の階段(ジャギー)になる
//   ・輪郭の半透明部分が染色から外れ、元の色の縁が残る
// という形で模様カスタムの丸プレビュー(96px表示)に出てしまう。
// これを避けるためMASK_HIRES_BASE_IDSのモンスターはマスクだけ高解像度で書き出しており、
// この検査はその効き目が失われていないかを数値で確かめる。
//
//   輪郭の塗り残し … 元絵の解像度で、絵が見えている(alpha>=32)のにどの部位マスクにも
//                    入っていない画素の割合。輪郭から3px以内に限って数える。
//                    大きいほど「染めたのに元の色の縁が残る」状態になる。
//
// ギザギザそのものは数値にしづらいため、ここではマスクが解析サイズのまま
// 書き出されていないか(=高解像度書き出しが外れていないか)を主に見張る。
const fs = require('fs');
const path = require('path');
const http = require('http');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const from = source.indexOf('const MASU_COLOR_TARGET = {');
const to = source.indexOf('const DyedMonsterImage =');
if (from < 0 || to < 0) { console.log('NG: 染色処理を切り出せませんでした'); process.exit(1); }
const dyeSource = source.slice(from, to);

// 染めた色が元の色とはっきり違うほど塗り残しが見つけやすいので、寒色で染めて測る
const COLORS = ['blue', 'blue', 'blue'];
const RIM_BARE_LIMIT = 5; // %
// 内側の塗り残し。部位の定義が実際のイラストの色とずれていると、腕と体の境目などに
// 元の色の筋(点線状の塗り残し)が残る。定義を実測値へ合わせた状態で0%なので、
// 「気づかないうちに定義とイラストがずれた」ことを拾えるよう厳しめにしておく
const INNER_BARE_LIMIT = 0.2; // %
// 例外: 肌そのものを染めない仕様のモンスター。人魚2体は肌が寒色/暖色の淡い色で塗られていて
// 「色が付いている画素」として数えられるが、仕様として髪・尾・衣装だけを染め、肌・目・白目は
// 元の色のまま残す。実測(ウンディーネ5.6%・ヤオビクニ2.5%)のほとんどが顔と首の肌なので、
// ここだけ上限を分ける。値は実測+2%程度にしてあり、部位定義が崩れて塗り残しが増えれば落ちる
const INNER_BARE_LIMIT_BY_ID = { Undine: 7.5, Yaobikuni: 4.5 };
// 元の陰影を保つ設定(MASU_COLOR_REGION_DYE の gloss に数値を入れたモンスター)で、
// 染め上がりの彩度がどれだけばらつくか。彩度を一律に固定する塗りだと0になる
const GLOSS_SPREAD_MIN = 0.05;
// 元の陰影を保つ設定が外れていないか気付けるよう、対象をここにも明示しておく
const GLOSS_EXPECTED = ['Mocchi'];
// 部位ごとの「染め上がりの彩度 ÷ その部位で狙っている彩度」の下限。
// 元の彩度に比例させる塗り(MASU_COLOR_REGION_DYE の gloss)は、元が白い部位だと
// 「元が白い＝染めても白い」となり、明度しか変わらず色がほとんど入らなくなる。
// 実際にアークの染色②(元の彩度0.008の白い部分)が「黒しか入らない」状態になっていた。
// 見た目では気付きにくく例外も出ないので、部位ごとに数値で見張る。
//
// 比べる相手は「選んだ色の彩度」ではなく「その部位の sat を掛けた彩度」にしている。
// sat は淡く仕上げたいときに意図して下げる設定なので、そこまで不具合として数えると
// 意図した調整のたびに落ちてしまい、検査の意味がなくなる
const REGION_SAT_RATIO_MIN = 0.45;
// 高解像度マスクが必ず効いていてほしいモンスター(元絵が解析サイズより大幅に大きいもの)。
// MASK_HIRES_BASE_IDSからうっかり外れたときに気付けるよう、ここにも明示しておく
const EXPECTED = ['Mocchi', 'Ark', 'Ham', 'Zan', 'Undine', 'Yaobikuni'];

const page = `<!doctype html><meta charset="utf-8">
<!-- 画像はPNGファイルになったので、monster-hero/ を基準にパスを解決させる -->
<base href="/monster-hero/"><body>
<script src="/monster-hero/data/images/images-ally.js"></script>
<script src="/monster-hero/data/ally-monsters.js"></script>
<script>
${dyeSource}
window.__targets = () => Object.keys(MASK_HIRES_BASE_IDS);
window.__glossTargets = () => Object.entries(MASU_COLOR_REGION_DYE)
  .filter(([, v]) => (Array.isArray(v) ? v : [v]).some((x) => x && typeof x.gloss === 'number')).map(([k]) => k);
// 部位ごとに、染めたあとの彩度が狙った彩度のどれくらいまで届いているかを測る。
// 部位マスクの中だけを見るので、「①は染まるが②は白いまま」のような部位単位の
// 塗り漏れを拾える(画像全体の平均では①に埋もれて気付けない)
window.__regionSaturation = async (id, colorId) => {
  const base = ALL_PLAYER_MONSTERS[id];
  const masks = await Promise.resolve(getDyeRegionMasks(id, base.imgUrl));
  if (!masks) return { error: 'マスクを作れませんでした' };
  const art = await load(base.imgUrl);
  const n = art.naturalWidth;
  const grab = (im) => { const c = document.createElement('canvas'); c.width = n; c.height = n;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.drawImage(im, 0, 0, n, n); return x.getImageData(0, 0, n, n).data; };
  const target = _resolveColorTarget(colorId);
  const out = [];
  for (let i = 0; i < masks.length; i++) {
    if (!masks[i]) { out.push(null); continue; }
    // 実際の表示と同じく、その部位に効く設定で染めた画像を使う
    const dyedUrl = await Promise.resolve(getRecoloredImage(base.imgUrl, colorId, id, i));
    if (!dyedUrl) { out.push(null); continue; }
    const dd = grab(await load(dyedUrl));
    const md = grab(await load(masks[i]));
    let cnt = 0, sum = 0;
    for (let p = 0; p < n * n; p += 3) {
      // マスクは位置で決める部位(posBbox)だと絵の無い透明な余白まで含むことがある。
      // 透明な画素はRGBが0で彩度0と出てしまい、染まっていないように見えるので除く
      if (md[p*4+3] < 128 || dd[p*4+3] < 250) continue;
      cnt++; sum += _rgbToHsv(dd[p*4], dd[p*4+1], dd[p*4+2])[1];
    }
    // その部位で狙っている彩度(選んだ色の彩度 × その部位の sat)
    const want = Math.max(0.01, Math.min(1, target.s * _regionDyeSettingFor(id, i).sat));
    out.push(cnt ? { mean: +(sum / cnt).toFixed(3), want: +want.toFixed(3), ratio: +(sum / cnt / want).toFixed(2) } : null);
  }
  return { target: target.s, regions: out };
};
// 染め上がりの彩度がどれだけばらついているかを測る。
// 彩度を一律に固定する塗り方だと全画素が同じ値になり、ばらつきは0になる
window.__glossSpread = async (id) => {
  const base = ALL_PLAYER_MONSTERS[id];
  const url = await Promise.resolve(getRecoloredImage(base.imgUrl, 'blue', id));
  if (!url) return { error: '染め直せませんでした' };
  const im = await load(url);
  const n = im.naturalWidth;
  const cv = document.createElement('canvas'); cv.width = n; cv.height = n;
  const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0);
  const d = ctx.getImageData(0, 0, n, n).data;
  const vals = [];
  for (let p = 0; p < n * n; p += 7) {
    if (d[p*4+3] < 250) continue;
    vals.push(_rgbToHsv(d[p*4], d[p*4+1], d[p*4+2])[1]);
  }
  if (!vals.length) return { error: '不透明な画素がありません' };
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length);
  return { sd: +sd.toFixed(4), mean: +mean.toFixed(3), n: vals.length };
};
window.__analysisSize = () => MASK_ANALYSIS_MAX_SIZE;
const load = (url) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
window.__measure = async (id, colors) => {
  const base = ALL_PLAYER_MONSTERS[id];
  const t0 = performance.now();
  const masks = await Promise.resolve(getDyeRegionMasks(id, base.imgUrl));
  const ms = Math.round(performance.now() - t0);
  if (!masks) return { error: 'マスクを作れませんでした' };
  const art = await load(base.imgUrl);
  // 立ち絵は正方形とは限らない(人魚2体は1024x1536)。正方形で測ると下半分を見落とすので実寸で測る
  const n = art.naturalWidth, nh = art.naturalHeight;
  const cv = document.createElement('canvas'); cv.width = n; cv.height = nh;
  const ctx = cv.getContext('2d'); ctx.drawImage(art, 0, 0);
  const ad = ctx.getImageData(0, 0, n, nh).data;
  // 全部位のマスクを元絵の解像度へ戻して足し合わせる
  const sum = new Uint16Array(n * nh);
  const maskSizes = [];
  for (let i = 0; i < masks.length; i++) {
    if (!masks[i]) { maskSizes.push(0); continue; }
    const mi = await load(masks[i]);
    maskSizes.push(mi.naturalWidth);
    const mc = document.createElement('canvas'); mc.width = n; mc.height = nh;
    const mx = mc.getContext('2d');
    mx.imageSmoothingEnabled = true; mx.imageSmoothingQuality = 'high';
    mx.drawImage(mi, 0, 0, n, nh);
    const md = mx.getImageData(0, 0, n, nh).data;
    for (let p = 0; p < n * nh; p++) sum[p] = Math.min(255, sum[p] + md[p * 4 + 3]);
  }
  // 部位定義の notBbox は「肌・目なので狙って染めない」と宣言した範囲なので、塗り残しに数えない
  const skip = (MASU_COLOR_REGION_HUES[id] || []).flatMap((def) => (Array.isArray(def) ? def : [def])
    .flatMap((a) => (a && a.notBbox) ? (Array.isArray(a.notBbox[0]) ? a.notBbox : [a.notBbox]) : []));
  const isSkipped = (x, y) => skip.some(([x0, y0, x1, y1]) => {
    const nx = x / n, ny = y / nh;
    return nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1;
  });
  const on = new Uint8Array(n * nh);
  for (let p = 0; p < n * nh; p++) on[p] = ad[p * 4 + 3] >= 32 ? 1 : 0;
  let rim = 0, rimBare = 0, inner = 0, innerBare = 0;
  for (let y = 0; y < nh; y++) for (let x = 0; x < n; x++) {
    const p = y * n + x;
    if (!on[p]) continue;
    if (skip.length && isSkipped(x, y)) continue;
    // 数えるのは「色が付いている画素」だけ。白いハイライトや黒い輪郭線は
    // もともと染めない部分なので、塗り残しとして数えると意味がなくなる
    const r = ad[p*4], g = ad[p*4+1], b2 = ad[p*4+2];
    const mx = Math.max(r, g, b2), mn = Math.min(r, g, b2);
    const s = mx === 0 ? 0 : (mx - mn) / mx, v = mx / 255;
    if (s < 0.1 || v < 0.25) continue;
    const isRim = [[x-3,y],[x+3,y],[x,y-3],[x,y+3]].some(([a, b]) => (a < 0 || b < 0 || a >= n || b >= nh) ? true : !on[b * n + a]);
    if (isRim) { rim++; if (sum[p] < 32) rimBare++; continue; }
    inner++;
    if (sum[p] < 32) innerBare++;
  }
  return { ms, n, maskSizes, rim, rimBare, inner, innerBare,
    rimBareRatio: +(rimBare / Math.max(1, rim) * 100).toFixed(2),
    innerBareRatio: +(innerBare / Math.max(1, inner) * 100).toFixed(2) };
};
</script></body>`;

const MIME = { '.js': 'text/javascript', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  if (req.url === '/harness.html') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(page); return; }
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright がありません'); process.exit(0); }
  await new Promise(r => server.listen(8982, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const problems = [];
  try {
    const tab = await browser.newPage();
    const errs = [];
    tab.on('pageerror', e => errs.push(String(e)));
    await tab.goto('http://localhost:8982/harness.html', { waitUntil: 'load' });
    if (errs.length) { console.log('NG: 実行時エラー — ' + errs[0]); process.exitCode = 1; }
    const declared = await tab.evaluate(() => window.__targets());
    const analysisSize = await tab.evaluate(() => window.__analysisSize());
    EXPECTED.forEach((id) => { if (!declared.includes(id)) problems.push(`${id}: MASK_HIRES_BASE_IDS から外れています(高解像度マスクが効きません)`); });
    const targets = Array.from(new Set([...EXPECTED, ...declared]));
    // 元の陰影を保つ設定にしたモンスターは、染めたあとも彩度にばらつきが残ること。
    // 設定が外れると全画素が同じ彩度になり、のっぺりした塗りに戻ってしまう
    const glossDeclared = await tab.evaluate(() => window.__glossTargets());
    GLOSS_EXPECTED.forEach((id) => { if (!glossDeclared.includes(id)) problems.push(`${id}: MASU_COLOR_REGION_DYE の gloss 指定が外れています(のっぺりした塗りに戻ります)`); });
    for (const id of Array.from(new Set([...GLOSS_EXPECTED, ...glossDeclared]))) {
      const g = await tab.evaluate((i) => window.__glossSpread(i), id);
      if (!g || g.error) { problems.push(`${id}: 染め上がりを測れませんでした（${(g && g.error) || '不明'}）`); continue; }
      console.log(`${id.padEnd(8)} 染め上がりの彩度 平均 ${g.mean} / ばらつき ${g.sd}`);
      if (g.sd < GLOSS_SPREAD_MIN) {
        problems.push(`${id}: 染め上がりの彩度のばらつきが ${g.sd} (下限 ${GLOSS_SPREAD_MIN})。元の陰影が消えてのっぺりした塗りになっています`);
      }
    }
    // 部位ごとに色がちゃんと入るか(白い部位が染まらないまま残っていないか)
    for (const id of targets) {
      const g = await tab.evaluate((i) => window.__regionSaturation(i, 'blue'), id);
      if (!g || g.error) { problems.push(`${id}: 部位ごとの染め上がりを測れませんでした（${(g && g.error) || '不明'}）`); continue; }
      console.log(`${id.padEnd(8)} 部位ごとの染め上がりの彩度 ${g.regions.map((r, i) => `染色${i+1} ${r ? `${r.mean}(狙い${r.want}の${Math.round(r.ratio*100)}%)` : '—'}`).join(' / ')}`);
      g.regions.forEach((r, i) => {
        if (r && r.ratio < REGION_SAT_RATIO_MIN) {
          problems.push(`${id}: 染色${i+1}の染め上がりの彩度が${r.mean}で、その部位で狙っている${r.want}の${Math.round(r.ratio*100)}%しかありません。元が白い部位に元の彩度比例の塗り(gloss)を掛けていないか確認してください(MASU_COLOR_REGION_DYEはモンスターごとだけでなく部位ごとにも書けます)`);
        }
      });
    }
    for (const id of targets) {
      const r = await tab.evaluate(([i, c]) => window.__measure(i, c), [id, COLORS]);
      if (!r || r.error) { problems.push(`${id}: ${(r && r.error) || '計測できませんでした'}`); continue; }
      console.log(`${id.padEnd(8)} 元絵 ${r.n}px / マスク ${r.maskSizes.join(',')}px / 生成 ${r.ms}ms / 輪郭の塗り残し ${r.rimBareRatio}% / 内側の塗り残し ${r.innerBareRatio}%`);
      if (r.maskSizes.some(s => s > 0 && s <= analysisSize)) {
        problems.push(`${id}: マスクが解析サイズ(${analysisSize}px)のまま書き出されています。高解像度書き出しが効いていません`);
      }
      if (r.rimBareRatio > RIM_BARE_LIMIT) {
        problems.push(`${id}: 輪郭の塗り残しが ${r.rimBareRatio}% (上限 ${RIM_BARE_LIMIT}%)。染めても元の色の縁が残ります`);
      }
      const innerLimit = INNER_BARE_LIMIT_BY_ID[id] ?? INNER_BARE_LIMIT;
      if (r.innerBareRatio > innerLimit) {
        problems.push(`${id}: 内側の塗り残しが ${r.innerBareRatio}% (上限 ${innerLimit}%)。腕と体の境目などに元の色の筋が残ります — 部位定義の色相がイラストと合っているか確認してください`);
      }
    }
    await tab.close();
  } finally {
    await browser.close();
    server.close();
  }
  if (problems.length) { problems.forEach(p => console.log('NG: ' + p)); process.exitCode = 1; }
  else console.log('OK: 高解像度マスクの輪郭にも内側にも塗り残しはありません');
})();
