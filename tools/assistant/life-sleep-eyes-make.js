// 助手ライフの寝顔: 「閉じ目の重ね絵」を作る(2026-11-11 社長「寝顔で目を瞑ってるやつが変な感じ」→ 案A)
//   node tools/assistant/life-sleep-eyes-make.js            作る(monster-hero/images/assistant/sleep/ と sleep/face/)
//   node tools/assistant/life-sleep-eyes-make.js --preview <フォルダ>   [元 | 重ねた後] の目元の比較も書き出す
// 作り方: ふつうの顔(◯◯_normal)の絵の目の範囲を、まわりの「肌の画素だけ」から滑らかに埋め(ラプラス補間。髪や線の色は混ぜない)、
//   その絵の線の色(目の範囲でいちばん暗い所)で、絵の解像度のまま細いまぶた(下向きの弧)と外側の短いまつげ2本を描く。
//   出来るのは元の絵と同じ大きさの透明PNG。ゲームでは元の絵と同じ位置・大きさで重ねるだけなので、小さく出しても線が太らない。
//   keepHair … 目にかかる前髪の画素はそのまま見せる(あつ: 赤い髪)
// 目の位置: [x, y, 幅, 高さ](絵の幅・高さに対する割合)/ang … 顔の傾き(度)。もとは 56-assistant-life-roomview.jsx の SVG の表(目盛りつきで手で読んだ)
const sharp = require('sharp'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), IMG = path.join(ROOT, 'monster-hero/images/assistant');
const PRE = { mua: 'myua', kiki: 'kiki', momosuke: 'momosuke', atsu: 'atsu', kyuko: 'kyuko' };
const redHair = (r, g, b) => r > 85 && r - g > 45 && r - b > 35;
const FULL = {
  mua: { ang: 8, eyes: [[0.46, 0.334, 0.043, 0.048], [0.524, 0.347, 0.032, 0.046]] },
  kiki: { ang: -3, eyes: [[0.4492, 0.4868, 0.0579, 0.0703], [0.5592, 0.4766, 0.0579, 0.0664]] },
  momosuke: { ang: -17, eyes: [[0.4254, 0.4363, 0.0918, 0.0781], [0.5967, 0.3836, 0.0918, 0.0859]] },
  atsu: { ang: -27, keepHair: redHair, eyes: [[0.4188, 0.3125, 0.0768, 0.0391], [0.5661, 0.2553, 0.0911, 0.0342]] },
  kyuko: { ang: -10, eyes: [[0.342, 0.415, 0.117, 0.072], [0.579, 0.383, 0.142, 0.075]] },
};
const FACE = {
  mua: { ang: 10, eyes: [[0.375, 0.49, 0.14, 0.10], [0.61, 0.53, 0.115, 0.095]] },
  kiki: { ang: -2, eyes: [[0.37, 0.565, 0.14, 0.10], [0.645, 0.545, 0.145, 0.105]] },
  momosuke: { ang: -19, eyes: [[0.39, 0.53, 0.11, 0.095], [0.605, 0.455, 0.125, 0.09]] },
  atsu: { ang: -30, keepHair: redHair, eyes: [[0.35, 0.60, 0.095, 0.05], [0.56, 0.48, 0.12, 0.06]] },
  kyuko: { ang: -11, eyes: [[0.31, 0.64, 0.16, 0.125], [0.605, 0.585, 0.185, 0.115]] },
};
const srcOf = (pid, kind) => path.join(IMG, kind === 'face' ? 'face' : '', `${PRE[pid]}_normal.PNG`);
const outOf = (pid, kind) => path.join(IMG, 'sleep', kind === 'face' ? 'face' : '', `${PRE[pid]}_normal.PNG`);

async function make(pid, kind) {
  const def = (kind === 'face' ? FACE : FULL)[pid];
  const { data, info } = await sharp(srcOf(pid, kind)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, px = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) px[i * 3 + c] = data[i * 4 + c];
  const out = Buffer.alloc(W * H * 4), hair = new Uint8Array(W * H);
  const a = def.ang * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
  const L = i => 0.3 * px[i * 3] + 0.59 * px[i * 3 + 1] + 0.11 * px[i * 3 + 2];
  let svg = '';
  for (const [fx, fy, fw, fh] of def.eyes) {
    const cx = fx * W, cy = fy * H, ew = fw * W, eh = fh * H, rx = ew * 0.62, ry = eh * 0.66;
    const inside = (x, y) => { const dx = x - cx, dy = y - cy; const u = dx * ca + dy * sa, v = -dx * sa + dy * ca; return (u / rx) ** 2 + (v / ry) ** 2; };
    const R = Math.max(rx, ry) * 1.4;
    const x0 = Math.max(1, Math.floor(cx - R)), x1 = Math.min(W - 2, Math.ceil(cx + R)), y0 = Math.max(1, Math.floor(cy - R)), y1 = Math.min(H - 2, Math.ceil(cy + R));
    const mask = [], ring = [], inM = new Uint8Array(W * H);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = inside(x, y), i = y * W + x; if (d <= 1) { mask.push(i); inM[i] = 1; } else if (d < 1.4) ring.push(i); }
    // 線の色: 目の範囲でいちばん暗い6%の平均(上まつげの色)
    const dk = mask.slice().sort((p, q) => L(p) - L(q)).slice(0, Math.max(3, mask.length * 0.06 | 0));
    const lc = [0, 1, 2].map(c => Math.round(dk.reduce((s, i) => s + px[i * 3 + c], 0) / dk.length));
    // 前髪(keepHair): 目の範囲の髪の画素は塗らずに元の絵を見せる
    if (def.keepHair) {
      const h0 = new Uint8Array(W * H); for (const i of mask) if (def.keepHair(px[i * 3], px[i * 3 + 1], px[i * 3 + 2])) h0[i] = 1;
      // まわり3×3の過半数で決め直す(髪の縁のまだら・ぽつんと残る点をならす)
      for (const i of mask) { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += h0[i + dy * W + dx]; hair[i] = n >= 5 ? 1 : 0; }
    }
    // 肌の手本: 外周のうち明るい半分の中央値。手本から遠い外周(髪・線)は塗りの元にしない
    const br = ring.slice().sort((p, q) => L(q) - L(p)).slice(0, Math.max(3, ring.length * 0.5 | 0));
    const med = [0, 1, 2].map(c => { const v = br.map(i => px[i * 3 + c]).sort((p, q) => p - q); return v[v.length >> 1]; });
    const skin = new Uint8Array(W * H);
    for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) { const i = y * W + x; if (Math.hypot(px[i * 3] - med[0], px[i * 3 + 1] - med[1], px[i * 3 + 2] - med[2]) < 38) skin[i] = 1; }
    for (const i of mask) for (let c = 0; c < 3; c++) px[i * 3 + c] = med[c];
    const NB = [-1, 1, -W, W];
    for (let it = 0; it < 1500; it++) for (const i of mask) { let s0 = 0, s1 = 0, s2 = 0, n = 0; for (const o of NB) { const j = i + o; if (!inM[j] && !skin[j]) continue; s0 += px[j * 3]; s1 += px[j * 3 + 1]; s2 += px[j * 3 + 2]; n++; } if (n) { px[i * 3] = s0 / n; px[i * 3 + 1] = s1 / n; px[i * 3 + 2] = s2 / n; } }
    for (const i of mask) { if (hair[i]) continue; for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(px[i * 3 + c]); const d = inside(i % W, (i / W) | 0); out[i * 4 + 3] = d > 0.85 ? Math.round(255 * (1 - d) / 0.15) : 255; }
    const lw = Math.max(1.2, eh * 0.12), hw = ew * 0.5, ly = cy + eh * 0.08, col = `rgb(${lc.join(',')})`, outer = fx < 0.5 ? -1 : 1;
    svg += `<g transform="rotate(${def.ang} ${cx} ${cy})"><path d="M${cx - hw},${ly - eh * 0.04} Q${cx},${ly + eh * 0.36} ${cx + hw},${ly - eh * 0.04}" fill="none" stroke="${col}" stroke-width="${lw}" stroke-linecap="round"/>`
      + [0, 1].map(k => { const sx = cx + outer * hw * (0.92 - k * 0.2), sy = ly - eh * 0.02 + k * eh * 0.08; return `<path d="M${sx},${sy} l${outer * ew * 0.1},${eh * (0.12 + k * 0.03)}" fill="none" stroke="${col}" stroke-width="${lw * 0.6}" stroke-linecap="round"/>`; }).join('') + '</g>';
  }
  const fill = await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  let img = await sharp(fill).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svg}</svg>`) }]).raw().toBuffer();
  // 前髪の画素は、まぶたの線より前(元の絵のまま=透明)
  for (let i = 0; i < W * H; i++) if (hair[i]) img[i * 4 + 3] = 0;
  const f = outOf(pid, kind); fs.mkdirSync(path.dirname(f), { recursive: true });
  await sharp(img, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(f);
  return f;
}
async function preview(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const kind of ['face', 'full']) for (const pid of Object.keys(PRE)) {
    const src = srcOf(pid, kind), m = await sharp(src).metadata(), xs = (kind === 'face' ? FACE : FULL)[pid].eyes;
    const minX = Math.min(...xs.map(e => e[0] - e[2])), maxX = Math.max(...xs.map(e => e[0] + e[2])), minY = Math.min(...xs.map(e => e[1] - e[2] * m.width / m.height)), maxY = Math.max(...xs.map(e => e[1] + e[2] * m.width / m.height));
    const ex = { left: Math.max(0, Math.round((minX - 0.04) * m.width)), top: Math.max(0, Math.round((minY - 0.04) * m.height)) }; ex.width = Math.min(m.width - ex.left, Math.round((maxX - minX + 0.08) * m.width)); ex.height = Math.min(m.height - ex.top, Math.round((maxY - minY + 0.08) * m.height));
    const a = await sharp(src).extract(ex).resize({ width: 400 }).png().toBuffer();
    const b = await sharp(await sharp(src).composite([{ input: outOf(pid, kind) }]).png().toBuffer()).extract(ex).resize({ width: 400 }).png().toBuffer();
    const h = (await sharp(a).metadata()).height;
    await sharp({ create: { width: 808, height: h, channels: 3, background: '#333' } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: 408, top: 0 }]).png().toFile(path.join(dir, `${kind}-${pid}.png`));
  }
}
module.exports = { FULL, FACE, PRE };
if (require.main === module) (async () => {
  for (const pid of Object.keys(PRE)) for (const kind of ['full', 'face']) { const f = await make(pid, kind); console.log(path.relative(ROOT, f), fs.statSync(f).size); }
  const i = process.argv.indexOf('--preview'); if (i > 0) await preview(process.argv[i + 1]);
})().catch(e => { console.error(e); process.exit(1); });
