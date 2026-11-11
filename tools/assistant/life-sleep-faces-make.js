// 助手ライフの寝顔: 社長が描いた「目を閉じた絵」から、立ち絵・顔アイコンに重ねる絵を作る(2026-11-11 社長「寝顔こっちでつくる」→ 7枚を受け取り)
//   node tools/assistant/life-sleep-faces-make.js                 作る(monster-hero/images/assistant/sleep/ の下に、元の絵と同じ並びで置く)
//   node tools/assistant/life-sleep-faces-make.js --preview <フォルダ>   [元 | 重ねた後] の目のまわりの比較も書き出す
// 受け取った物: tools/art-sources/sleep-faces/received-v1.png(1枚に7人。背景は抜いてある。加工せずに残す)
// 作り方
//   ① 人ごとの枠の中で、いちばん大きなつながった塊だけを取る(背景を抜いた跡の点・筋・隣の人のはみ出しを捨てる)
//   ② 社長の絵を元の立ち絵へ合わせる(縮尺・回転・位置)。体全体の明るさと形でざっと → 目のまわり(目そのものは除く)で細かく
//   ③ 重ねる範囲は目ごとの楕円。元の開いた目とまつげがまるごと隠れる芯の外側を、なめらかにぼかす(口・前髪の先までは届かない)
//   ④ 顔アイコン(face/)は、元の全身から顔アイコンへの対応(縮尺・位置)を求め、全身の合わせ方を写したうえで目のまわりでもう一度詰める
// 出来るのは元の絵と同じ大きさの透明PNG。ゲームでは元の絵と同じ位置・大きさで重ねるだけ(AssistantLifeSleepEyes)
const sharp = require('sharp'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'), IMG = path.join(ROOT, 'monster-hero/images/assistant');
const SRC = path.join(ROOT, 'tools/art-sources/sleep-faces/received-v1.png');
// 受け取った絵の中の人ごとの枠 [x0, y0, x1, y1]
const BOX = { atsu: [0, 0, 425, 487], kiki: [426, 0, 722, 487], 'kiki-halloween': [722, 0, 1128, 487], kyuko: [1128, 0, 1536, 487], myua: [40, 487, 565, 1024], 'myua-card-master': [545, 487, 975, 1024], 'myua-halloween': [975, 487, 1536, 1024] };
// 重ね先。eyes … 元の全身の絵の開いた目 [x, y, 幅, 高さ](絵に対する割合。56-assistant-life-roomview.jsx の表と同じ測り方)
//   panelEyes … 目の位置の表が無い着せ替えは、社長の絵(切り出した後)の閉じた線から測る [線の中心 x, y, 線の長さ](画素)
const JOBS = [
  { panel: 'atsu', full: 'atsu_normal.PNG', eyes: [[0.4188, 0.3125, 0.0768, 0.0391], [0.5661, 0.2553, 0.0911, 0.0342]] },
  { panel: 'kiki', full: 'kiki_normal.PNG', eyes: [[0.4492, 0.4868, 0.0579, 0.0703], [0.5592, 0.4766, 0.0579, 0.0664]] },
  { panel: 'kiki-halloween', full: 'halloween/kiki_normal.PNG', panelEyes: [[165, 243, 36], [239, 222, 40]] },
  { panel: 'kyuko', full: 'kyuko_normal.PNG', eyes: [[0.342, 0.415, 0.117, 0.072], [0.579, 0.383, 0.142, 0.075]] },
  { panel: 'myua', full: 'myua_normal.PNG', eyes: [[0.46, 0.334, 0.043, 0.048], [0.524, 0.347, 0.032, 0.046]] },
  { panel: 'myua-card-master', full: 'card-master/myua_normal.PNG', panelEyes: [[190, 190, 38], [253, 208, 32]] },
  { panel: 'myua-halloween', full: 'halloween/myua_normal.PNG', panelEyes: [[188, 216, 36], [251, 230, 30]] },
];
const faceOf = (rel) => rel.includes('/') ? rel.replace(/\/([^/]+)$/, '/face/$1') : `face/${rel}`;
const outOf = (rel) => path.join(IMG, 'sleep', rel);

const loadRaw = async (f, resize) => { const { data, info } = await sharp(f).ensureAlpha().resize(resize).raw().toBuffer({ resolveWithObject: true }); return { d: data, W: info.width, H: info.height }; };

// ① 人ごとに切り出す
async function cutPanels() {
  const { d, W } = await loadRaw(SRC); const out = {};
  for (const [name, [bx0, by0, bx1, by1]] of Object.entries(BOX)) {
    const w = bx1 - bx0, h = by1 - by0, A = i => d[((by0 + ((i / w) | 0)) * W + bx0 + (i % w)) * 4 + 3];
    const lab = new Int32Array(w * h).fill(-1); let best = -1, bestN = 0, id = 0;
    for (let s = 0; s < w * h; s++) { if (lab[s] >= 0 || A(s) < 40) continue; const st = [s]; lab[s] = id; let n = 0;
      while (st.length) { const p = st.pop(); n++; const x = p % w; for (const q of [p - 1, p + 1, p - w, p + w]) { if (q < 0 || q >= w * h || Math.abs((q % w) - x) > 1) continue; if (lab[q] < 0 && A(q) >= 40) { lab[q] = id; st.push(q); } } }
      if (n > bestN) { bestN = n; best = id; } id++; }
    const keep = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) if (lab[i] === best) keep[i] = 1;
    for (let g = 0; g < 2; g++) { const n = keep.slice(); for (let i = 0; i < w * h; i++) { if (keep[i] || A(i) === 0) continue; const x = i % w; if ((x > 0 && keep[i - 1]) || (x < w - 1 && keep[i + 1]) || keep[i - w] || keep[i + w]) n[i] = 1; } keep.set(n); }
    let x0 = w, y0 = h, x1 = 0, y1 = 0; for (let i = 0; i < w * h; i++) if (keep[i]) { const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const ow = x1 - x0 + 1, oh = y1 - y0 + 1, buf = Buffer.alloc(ow * oh * 4);
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) { if (!keep[(y0 + y) * w + x0 + x]) continue; const p = ((by0 + y0 + y) * W + bx0 + x0 + x) * 4; d.copy(buf, (y * ow + x) * 4, p, p + 4); }
    out[name] = { d: buf, W: ow, H: oh, png: await sharp(buf, { raw: { width: ow, height: oh, channels: 4 } }).png().toBuffer() };
  }
  return out;
}

// 変換: 絵の点 p → s·Rot(r)·p + t
const fwd = (R, x, y) => { const r = R.rDeg * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r); return [R.s * (c * x - sn * y) + R.tx, R.s * (sn * x + c * y) + R.ty]; };
const inv = (R, X, Y) => { const r = R.rDeg * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r); const dx = (X - R.tx) / R.s, dy = (Y - R.ty) / R.s; return [c * dx + sn * dy, -sn * dx + c * dy]; };

// ② ざっと合わせる(明るさ×不透明さ と 形の差)。src を tgt へ
async function coarse(srcPng, tgtFile, sRange) {
  const lum = (o) => { const n = o.W * o.H, L = new Float32Array(n), A = new Float32Array(n); for (let i = 0; i < n; i++) { const a = o.d[i * 4 + 3] / 255; A[i] = a; L[i] = (0.3 * o.d[i * 4] + 0.59 * o.d[i * 4 + 1] + 0.11 * o.d[i * 4 + 2]) * a; } return { ...o, L, A }; };
  const tFull = await sharp(tgtFile).metadata(); const tw = 160, k = tw / tFull.width; const T = lum(await loadRaw(tgtFile, { width: tw }));
  const sMeta = await sharp(srcPng).metadata(); let best = { c: 1e9 };
  for (let s = sRange[0]; s <= sRange[1]; s *= 1.03) {
    const pw = Math.round(sMeta.width * s * k); if (pw < 16 || pw > tw * 3) continue; const P = lum(await loadRaw(srcPng, { width: pw }));
    for (let ty = -P.H * 0.5; ty < T.H - 8; ty += 2) for (let tx = -P.W * 0.5; tx < T.W - P.W * 0.5; tx += 2) {
      let sum = 0, n = 0; for (let y = 0; y < P.H; y += 2) for (let x = 0; x < P.W; x += 2) { const i = y * P.W + x, X = (x + tx) | 0, Y = (y + ty) | 0; if (X < 0 || Y < 0 || X >= T.W || Y >= T.H) { sum += P.A[i] > 0.5 ? 120 : 0; n++; continue; } const j = Y * T.W + X; sum += Math.abs(P.L[i] - T.L[j]) + 120 * Math.abs(P.A[i] - T.A[j]); n++; }
      const c = sum / n; if (c < best.c) best = { c, s, tx: tx / k, ty: ty / k };
    }
  }
  return { s: best.s, rDeg: 0, tx: best.tx, ty: best.ty };
}

// ② 目のまわりで細かく詰める(目そのものは描き方がちがうので数えない)。eyesT … 重ね先の目 [x, y, 幅, 高さ](画素)
async function refine(src, tgtFile, R0, eyesT, { skipEyes = true } = {}) {
  const T = await loadRaw(tgtFile); const P = src;
  const [[ax, ay], [bx, by]] = eyesT, cx = (ax + bx) / 2, cy = (ay + by) / 2, dd = Math.hypot(bx - ax, by - ay);
  const pts = []; const st = Math.max(1, Math.round(dd / 90));
  for (let Y = Math.round(cy - dd * 1.1); Y < cy + dd * 1.1; Y += st) for (let X = Math.round(cx - dd * 1.3); X < cx + dd * 1.3; X += st) {
    if (X < 0 || Y < 0 || X >= T.W || Y >= T.H) continue; if (skipEyes && (Math.hypot(X - ax, Y - ay) < dd * 0.35 || Math.hypot(X - bx, Y - by) < dd * 0.35)) continue;
    const o = (Y * T.W + X) * 4; if (T.d[o + 3] < 200) continue; pts.push([X, Y, T.d[o], T.d[o + 1], T.d[o + 2]]); }
  const cost = (R) => { let sum = 0; for (const [X, Y, r, g, b] of pts) { const [x, y] = inv(R, X, Y).map(Math.round); if (x < 0 || y < 0 || x >= P.W || y >= P.H) { sum += 200; continue; } const o = (y * P.W + x) * 4; if (P.d[o + 3] < 128) { sum += 200; continue; } sum += Math.abs(P.d[o] - r) + Math.abs(P.d[o + 1] - g) + Math.abs(P.d[o + 2] - b); } return sum / pts.length; };
  let b = { ...R0 }; b.c = cost(b); const c0 = b.c;
  for (const [ds, dr, dt] of [[0.01, 0.6, 3], [0.004, 0.25, 1], [0.0015, 0.08, 0.5]]) for (let rep = 0; rep < 3; rep++) { const c = { ...b };
    for (let s = c.s * (1 - ds * 2); s <= c.s * (1 + ds * 2) + 1e-9; s += c.s * ds) for (let r = c.rDeg - dr * 2; r <= c.rDeg + dr * 2 + 1e-9; r += dr) for (let tx = c.tx - dt * 3; tx <= c.tx + dt * 3 + 1e-9; tx += dt) for (let ty = c.ty - dt * 3; ty <= c.ty + dt * 3 + 1e-9; ty += dt) { const R = { s, rDeg: r, tx, ty }; const v = cost(R); if (v < b.c) b = { ...R, c: v }; } }
  return { s: b.s, rDeg: b.rDeg, tx: b.tx, ty: b.ty, before: c0, after: b.c };
}

// ③ 変形して重ねる絵を作る(目ごとの楕円の芯 + なめらかなぼかし)
async function compose(src, tgtFile, R, eyesT, out, { core = [0.62, 0.75], fe = 0.6 } = {}) {
  const m = await sharp(tgtFile).metadata(), W = m.width, H = m.height, P = src, buf = Buffer.alloc(W * H * 4);
  const ang = Math.atan2(eyesT[1][1] - eyesT[0][1], eyesT[1][0] - eyesT[0][0]), ca = Math.cos(ang), sa = Math.sin(ang);
  const reach = Math.max(...eyesT.map(e => Math.max(e[2] * core[0], e[3] * core[1]) * (1 + fe))) + 2;
  for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
    if (!eyesT.some(e => Math.abs(X - e[0]) < reach && Math.abs(Y - e[1]) < reach)) continue;
    let f = 0; for (const [ex, ey, ew, eh] of eyesT) { const dx = X - ex, dy = Y - ey, u = dx * ca + dy * sa, v = -dx * sa + dy * ca; const e = Math.sqrt((u / (ew * core[0])) ** 2 + (v / (eh * core[1])) ** 2); const g = e <= 1 ? 1 : e >= 1 + fe ? 0 : 1 - (e - 1) / fe; if (g > f) f = g; }
    if (f <= 0) continue; const sm = f * f * (3 - 2 * f);
    const [x, y] = inv(R, X, Y); if (x < 0 || y < 0 || x > P.W - 1 || y > P.H - 1) continue;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, x1 = Math.min(P.W - 1, x0 + 1), y1 = Math.min(P.H - 1, y0 + 1); let aSum = 0; const acc = [0, 0, 0];
    for (const [xx, yy, w] of [[x0, y0, (1 - fx) * (1 - fy)], [x1, y0, fx * (1 - fy)], [x0, y1, (1 - fx) * fy], [x1, y1, fx * fy]]) { const p = (yy * P.W + xx) * 4, a = P.d[p + 3] * w; aSum += a; for (let k = 0; k < 3; k++) acc[k] += P.d[p + k] * a; }
    if (aSum <= 0) continue; const o = (Y * W + X) * 4; for (let k = 0; k < 3; k++) buf[o + k] = Math.round(acc[k] / aSum); buf[o + 3] = Math.round(aSum * sm);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(out);
}

// 着せ替え: 社長の絵の閉じた線 → 開いた目の楕円(線の少し上が目の中心。幅は線の1.25倍・高さは線の長さ)
const eyesFromPanel = (R, pe) => pe.map(([x, y, len]) => { const [X, Y] = fwd(R, x, y - len * 0.25); return [X, Y, len * 1.25 * R.s, len * 1.0 * R.s]; });

async function main() {
  const panels = await cutPanels(); const log = [];
  for (const job of JOBS) {
    const P = panels[job.panel], fullFile = path.join(IMG, job.full), fm = await sharp(fullFile).metadata();
    // 全身
    let R = await coarse(P.png, fullFile, [0.3, 4.5]);
    let eyesT = job.eyes ? job.eyes.map(([fx, fy, fw, fh]) => [fx * fm.width, fy * fm.height, fw * fm.width, fh * fm.height]) : eyesFromPanel(R, job.panelEyes);
    R = await refine(P, fullFile, R, eyesT);
    if (!job.eyes) eyesT = eyesFromPanel(R, job.panelEyes);
    await compose(P, fullFile, R, eyesT, outOf(job.full));
    log.push(`${job.full}: 縮尺 ${R.s.toFixed(3)} 回転 ${R.rDeg.toFixed(1)}° 差 ${R.before.toFixed(0)}→${R.after.toFixed(0)}`);
    // 顔アイコン: 元の全身 → 顔アイコン の対応を求めて写す
    const faceRel = faceOf(job.full), faceFile = path.join(IMG, faceRel);
    if (!fs.existsSync(faceFile)) { log.push(`${faceRel}: 無い(とばす)`); continue; }
    const fullRaw = await loadRaw(fullFile); const fullPng = await sharp(fullFile).png().toBuffer();
    let F = await coarse(fullPng, faceFile, [0.1, 1.5]);
    const faceEyesFromFull = (F) => eyesT.map(([x, y, w, h]) => { const [X, Y] = fwd(F, x, y); return [X, Y, w * F.s, h * F.s]; });
    F = await refine(fullRaw, faceFile, F, faceEyesFromFull(F), { skipEyes: false });
    const eyesF = faceEyesFromFull(F);
    let RF = { s: R.s * F.s, rDeg: R.rDeg + F.rDeg, tx: 0, ty: 0 }; const [ox, oy] = fwd(F, R.tx, R.ty); RF.tx = ox; RF.ty = oy;
    RF = await refine(P, faceFile, RF, eyesF);
    await compose(P, faceFile, RF, eyesF, outOf(faceRel));
    log.push(`${faceRel}: 全身→顔 縮尺 ${F.s.toFixed(3)}(差 ${F.after.toFixed(0)})/ 社長の絵→顔 差 ${RF.before.toFixed(0)}→${RF.after.toFixed(0)}`);
  }
  console.log(log.join('\n'));
  const i = process.argv.indexOf('--preview'); if (i > 0) await preview(process.argv[i + 1]);
}

// [元 | 重ねた後] を目のまわりで切り出して並べる(全身・顔アイコン)
async function preview(dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const job of JOBS) for (const rel of [job.full, faceOf(job.full)]) {
    const f = path.join(IMG, rel), o = outOf(rel); if (!fs.existsSync(o)) continue;
    const { d, W, H } = await loadRaw(o); let x0 = W, y0 = H, x1 = 0, y1 = 0; for (let i = 0; i < W * H; i++) if (d[i * 4 + 3] > 8) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const pad = Math.round((x1 - x0) * 0.25); const ex = { left: Math.max(0, x0 - pad), top: Math.max(0, y0 - pad) }; ex.width = Math.min(W - ex.left, x1 - x0 + pad * 2); ex.height = Math.min(H - ex.top, y1 - y0 + pad * 2);
    const a = await sharp(f).extract(ex).resize({ width: 480 }).png().toBuffer(), b = await sharp(await sharp(f).composite([{ input: o }]).png().toBuffer()).extract(ex).resize({ width: 480 }).png().toBuffer(); const h = (await sharp(a).metadata()).height;
    await sharp({ create: { width: 968, height: h, channels: 3, background: '#333' } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: 488, top: 0 }]).png().toFile(path.join(dir, rel.replace(/\//g, '_')));
  }
}
module.exports = { JOBS, faceOf };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
