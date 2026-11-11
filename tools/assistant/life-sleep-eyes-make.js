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
const pinkHair = (r, g, b) => r > 215 && b > 130 && r - g > 75; // きき: あざやかな桃色の髪(瞳の濃い赤紫・肌は入らない)
const roseHair = (r, g, b) => r > 120 && r < 235 && g > 75 && r - g > 45 && Math.abs(g - b) < 22; // きゅうこ: くすんだばら色の髪(茶色の瞳・目じりの赤い線・肌は入らない)
const FULL = {
  mua: { ang: 8, eyes: [[0.46, 0.334, 0.043, 0.048], [0.524, 0.347, 0.032, 0.046]] },
  kiki: { ang: -3, keepHair: pinkHair, hairAbove: true, eyes: [[0.4492, 0.4868, 0.0579, 0.0703], [0.5592, 0.4766, 0.0579, 0.0664]] },
  momosuke: { ang: -17, eyes: [[0.4254, 0.4363, 0.0918, 0.0781], [0.5967, 0.3836, 0.0918, 0.0859]] },
  atsu: { ang: -27, keepHair: redHair, skinMin: 0.88, eyes: [[0.4188, 0.3125, 0.0768, 0.0391], [0.5661, 0.2553, 0.0911, 0.0342]] },
  kyuko: { ang: -10, keepHair: roseHair, eyes: [[0.342, 0.415, 0.117, 0.072], [0.579, 0.383, 0.142, 0.075]] },
};
const FACE = {
  mua: { ang: 10, eyes: [[0.375, 0.49, 0.14, 0.10], [0.61, 0.53, 0.115, 0.095]] },
  kiki: { ang: -2, keepHair: pinkHair, hairAbove: true, eyes: [[0.37, 0.565, 0.14, 0.10], [0.645, 0.545, 0.145, 0.105]] },
  momosuke: { ang: -19, eyes: [[0.39, 0.53, 0.11, 0.095], [0.605, 0.455, 0.125, 0.09]] },
  atsu: { ang: -30, keepHair: redHair, skinMin: 0.88, eyes: [[0.35, 0.60, 0.095, 0.05], [0.56, 0.48, 0.12, 0.06]] },
  kyuko: { ang: -11, keepHair: roseHair, eyes: [[0.31, 0.64, 0.16, 0.125], [0.605, 0.585, 0.185, 0.115]] },
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
    const cx = fx * W, cy = fy * H, ew = fw * W, eh = fh * H;
    const toUV = (x, y) => { const dx = x - cx, dy = y - cy; return [dx * ca + dy * sa, -dx * sa + dy * ca]; };
    const ell = (x, y, rx, ry) => { const [u, v] = toUV(x, y); return (u / rx) ** 2 + (v / ry) ** 2; };
    const R = Math.max(ew, eh) * 1.1;
    const x0 = Math.max(2, Math.floor(cx - R)), x1 = Math.min(W - 3, Math.ceil(cx + R)), y0 = Math.max(2, Math.floor(cy - R)), y1 = Math.min(H - 3, Math.ceil(cy + R));
    // 肌の手本: 目のまわり(楕円の外側の輪)の明るい側の中央値
    const ring = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = ell(x, y, ew * 0.66, eh * 0.72); if (d > 1 && d < 1.6) ring.push(y * W + x); }
    const br = ring.slice().sort((p, q) => L(q) - L(p)).slice(Math.floor(ring.length * 0.1), Math.max(3, ring.length * 0.6 | 0));
    const med = [0, 1, 2].map(c => { const v = br.map(i => px[i * 3 + c]).sort((p, q) => p - q); return v[v.length >> 1]; });
    const Lsk = 0.3 * med[0] + 0.59 * med[1] + 0.11 * med[2], Csk = Math.max(...med) - Math.min(...med);
    const chr = i => Math.max(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]) - Math.min(px[i * 3], px[i * 3 + 1], px[i * 3 + 2]);
    // 影の肌も肌に数える(明るさが手本の6割以上・色みが近い)。髪・線・瞳は数えない
    // 肌の色を明るく・暗くしただけの色(k 倍)なら肌(影の肌も入る)。髪・線・瞳・白目は色の向きがちがうので入らない
    const mm = med[0] ** 2 + med[1] ** 2 + med[2] ** 2;
    const skinLike = i => { const k = (px[i * 3] * med[0] + px[i * 3 + 1] * med[1] + px[i * 3 + 2] * med[2]) / mm; if (k < (def.skinMin || 0.8) || k > 1.04) return false; return Math.hypot(px[i * 3] - k * med[0], px[i * 3 + 1] - k * med[1], px[i * 3 + 2] - k * med[2]) < 16 + 6 * k; };
    // 前髪(keepHair): 目の範囲の髪の画素は塗らずに元の絵を見せる
    if (def.keepHair) {
      const h0 = new Uint8Array(W * H); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (def.keepHair(px[i * 3], px[i * 3 + 1], px[i * 3 + 2])) h0[i] = 1; }
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += h0[i + dy * W + dx]; hair[i] = n >= 5 ? 1 : 0; }
    }
    // ① 上まぶたの線を測る: 回した座標の列ごとに、上から最初に続く暗い所(太さは目の高さの22%まで)
    const runs = new Map();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const [u, v] = toUV(x, y); if (Math.abs(u) > ew * 0.62 || v < -eh * 0.75 || v > eh * 0.15) continue; const k = Math.round(u); if (!runs.has(k)) runs.set(k, []); runs.get(k).push({ i: y * W + x, v }); }
    const lash = [];
    for (const [k, arr] of runs) { arr.sort((p, q) => p.v - q.v); let run = [];
      for (const p of arr) { const d = L(p.i) < Lsk * 0.5 && !hair[p.i]; if (d) { run.push(p); if (run.length > eh * 0.22) break; } else if (run.length) break; }
      if (run.length >= 1) lash.push({ k, top: run[0].v, n: run.length, run }); }
    lash.sort((p, q) => p.k - q.k);
    const thick = lash.map(l => l.n).sort((p, q) => p - q);
    // 顔アイコンは画面で小さく(40px ほど)出るので、線を1.4倍にする(細いとかすれる)
    const T = Math.min(eh * 0.2, Math.max(eh * 0.07, 1.4, thick[Math.floor(thick.length * 0.7)] || eh * 0.1)) * (kind === 'face' ? 1.4 : 1);
    const dkPix = lash.flatMap(l => l.run.map(r => r.i)).sort((p, q) => L(p) - L(q));
    const pick = (arr) => [0, 1, 2].map(c => Math.round(arr.reduce((s, i) => s + px[i * 3 + c], 0) / Math.max(1, arr.length)));
    const dark = dkPix.length ? pick(dkPix.slice(0, Math.max(3, dkPix.length * 0.3 | 0))) : [60, 30, 40];
    const mid = dkPix.length ? pick(dkPix.slice(dkPix.length >> 1)) : dark;
    // 目の端(線の両端): 測れた列の外れを除いた範囲
    const ks = lash.map(l => l.k); const kLo = ks.length ? ks[Math.floor(ks.length * 0.04)] : -ew * 0.5, kHi = ks.length ? ks[Math.ceil(ks.length * 0.96) - 1] : ew * 0.5;
    // ② 埋める所: 目の形に合わせた楕円(上まぶたの線の上〜下まつげ・目頭〜目じり)をまるごと。ふちは少しずつ透かす
    const vTop = lash.length ? Math.min(...lash.map(l => l.top)) : -eh * 0.5, vBot = eh * 0.46;
    // hairAbove: 瞳の色が髪に近い助手(きき)は、上まぶたの線より上の髪だけを残す(瞳の光を髪と取りちがえない)
    if (def.hairAbove) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (hair[i] && toUV(x, y)[1] > vTop + T * 0.5) hair[i] = 0; }
    const rx = Math.max(ew * 0.42, (kHi - kLo) / 2 + T * 0.9 + ew * 0.05), uc = (kHi + kLo) / 2, vc = (vTop + vBot) / 2, ry = (vBot - vTop) / 2 + T * 0.6;
    const inEye = (x, y) => { const [u, v] = toUV(x, y); return ((u - uc) / rx) ** 2 + ((v - vc) / ry) ** 2; };
    const m = new Uint8Array(W * H);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * W + x; if (inEye(x, y) <= 1 && !hair[i]) m[i] = 1; }
    const mask = []; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m[y * W + x]) mask.push(y * W + x);
    const skin = new Uint8Array(W * H); for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) { const i = y * W + x; if (!m[i] && skinLike(i)) skin[i] = 1; }
    // 肌の濃淡をなぞる: まわりの肌(影の肌も含む)だけを元に滑らかに埋める
    for (const i of mask) for (let c = 0; c < 3; c++) px[i * 3 + c] = med[c];
    for (let it = 0; it < 1500; it++) for (const i of mask) { let s0 = 0, s1 = 0, s2 = 0, n = 0; for (const o of [-1, 1, -W, W]) { const j = i + o; if (!m[j] && !skin[j]) continue; s0 += px[j * 3]; s1 += px[j * 3 + 1]; s2 += px[j * 3 + 2]; n++; } if (n) { px[i * 3] = s0 / n; px[i * 3 + 1] = s1 / n; px[i * 3 + 2] = s2 / n; } }
    // 肌の細かな粒: 元の絵のまわりの肌のゆらぎ(標準偏差)ぶんだけ、ごく弱い粒を足す(のっぺり防ぎ)
    const sdv = Math.sqrt(br.reduce((s, i) => s + (L(i) - Lsk) ** 2, 0) / Math.max(1, br.length));
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5);
    for (const i of mask) { const r = rnd() * Math.min(3, sdv * 0.4); for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(px[i * 3 + c] + r))); const d = inEye(i % W, (i / W) | 0); out[i * 4 + 3] = d > 0.8 ? Math.round(255 * Math.min(1, (1 - d) / 0.2 + 0.15)) : 255; }
    // ③ 閉じた線: 目の端から端へ、下へふくらむ弧。内側(鼻の側)は細く、外側(目じり)は太く・少し跳ねる
    const outer = fx < 0.5 ? -1 : 1; // 外側の向き(回した座標の u の符号)
    const uIn = outer > 0 ? kLo : kHi, uOut = outer > 0 ? kHi : kLo;
    const vBase = eh * 0.1, sag = eh * 0.2, N = 40;
    const P = s => { let u = uIn + (uOut - uIn) * s, v = vBase + sag * (1 - (2 * s - 1) ** 2); if (s > 0.86) { const q = (s - 0.86) / 0.14; v -= eh * 0.1 * q * q; u += outer * T * 0.6 * q * q; } return [u, v]; };
    const tw = s => T * (0.18 + 0.82 * Math.pow(s, 0.7)) * Math.min(1, s / 0.1 + 0.25) * (s > 0.93 ? Math.max(0.35, 1 - (s - 0.93) / 0.07 * 0.65) : 1);
    const up = [], dn = [];
    for (let j = 0; j <= N; j++) { const s = j / N, [u, v] = P(s), [u2, v2] = P(Math.min(1, s + 0.01)), [u1, v1] = P(Math.max(0, s - 0.01)); let nx = -(v2 - v1), ny = u2 - u1; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; if (ny < 0) { nx = -nx; ny = -ny; } const t = tw(s) / 2; up.push([u - nx * t * 0.9, v - ny * t * 0.9]); dn.push([u + nx * t * 1.1, v + ny * t * 1.1]); }
    const f2 = n => n.toFixed(2);
    const toXY = ([u, v]) => [cx + u * ca - v * sa, cy + u * sa + v * ca];
    const poly = [...up, ...dn.reverse()].map(toXY);
    const gid = `g${pid}${kind}${outer}`;
    const [gx1, gy1] = toXY([uIn, vBase]), [gx2, gy2] = toXY([uOut, vBase]);
    const rgb = c => `rgb(${c.join(',')})`, lite = mid.map((c, j) => Math.round(c * 0.55 + med[j] * 0.45));
    // まぶたの影(くぼみ): 線の少し上に、まわりの影の肌の色をぼかして薄くのせる
    const shade = br.length ? pick(br.slice().sort((p, q) => L(p) - L(q)).slice(0, Math.max(3, br.length * 0.25 | 0))) : med;
    const crease = Array.from({ length: 21 }, (_, j) => { const [u, v] = P(j / 20); return toXY([u, v - T * 0.9]); });
    svg += `<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f2(gx1)}" y1="${f2(gy1)}" x2="${f2(gx2)}" y2="${f2(gy2)}"><stop offset="0" stop-color="${rgb(lite)}"/><stop offset="0.45" stop-color="${rgb(mid)}"/><stop offset="1" stop-color="${rgb(dark)}"/></linearGradient>`
      + `<filter id="b${gid}" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="${f2(Math.max(0.8, eh * 0.06))}"/></filter></defs>`
      + `<polyline points="${crease.map(p => p.map(f2).join(',')).join(' ')}" fill="none" stroke="${rgb(shade)}" stroke-width="${f2(eh * 0.2)}" stroke-linecap="round" opacity=".45" filter="url(#b${gid})"/>`
      + `<path d="M${poly.map(p => p.map(f2).join(',')).join(' L')} Z" fill="url(#${gid})"/>`;
    // ④ まつげ: 目じり寄りに、根元が太く先が細い束を3本(下・外向き)
    [[0.7, 0.16, 1.15], [0.82, 0.2, 1.0], [0.93, 0.17, 0.85]].forEach(([s, len, wd]) => {
      const [u, v] = P(s), base = tw(s) * 0.5, L2 = eh * len, w0 = T * 0.42 * wd;
      const ang2 = Math.PI * (0.32 + (s - 0.7) * 0.5); const du = outer * Math.cos(ang2), dv = Math.sin(ang2);
      const tip = [u + du * L2, v + base + dv * L2], b1 = [u - outer * w0 * 0.5, v + base * 0.6], b2 = [u + outer * w0 * 0.5, v + base * 0.6];
      const ctl = [u + du * L2 * 0.45 - outer * w0 * 0.2, v + base + dv * L2 * 0.55];
      const pts = [b1, ctl, tip, b2].map(toXY).map(p => p.map(f2).join(','));
      svg += `<path d="M${pts[0]} Q${pts[1]} ${pts[2]} L${pts[3]} Z" fill="${rgb(dark)}"/>`;
    });
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
