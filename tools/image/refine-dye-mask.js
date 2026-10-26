// 実装済みのモンスターの染色の部位分けを、**分け方は変えずに境目だけ**元の絵の線・色の変わり目へ寄せて、
// 配信マスク(PNG)にする(2026-10-26・社長「実装されてるモンスターの染色マスクも確認してズレがあったら
// 調整してきれいにして」)。
//
//   node image/refine-dye-mask.js <id> [--out <パス>]   … 試すだけ。既定の出力は tools/out/dye-mask-review/<id>-refined.png
//   node image/refine-dye-mask.js <id> --apply          … 配信マスク(monster-hero/images/monsters/<名前>-dye-mask.PNG)へ書き、
//        images-ally.js のキャッシュキーを付け直す。初回は出発点を tools/art-sources/dye-masks/<名前>-dye-mask-before-refine.png に残す。
//        色相ルール・埋め込み部位マップの子は、15-dye-and-art.jsx の EXACT_DYE_MASKS へ足し、部位定義を {hue:0…} の形にする(手で)
//
// 出発点は「いまゲームが実際に使っている部位分け」(色相ルール・配信マスク・埋め込み部位マップのどれでも、
// getDyeRegionMasks の結果を原寸へ引き伸ばしたもの)。形(四角い範囲・位置の帯)で部位を決めた子や、
// 解析サイズ(384px)で作った子は、境目が絵の線から数画素ずれたり、まっすぐな切れ目が出たりする。
//
// やること
//   ① 元の絵を「同じ色が続くかたまり」に分ける。暗い線(絵の輪郭線・目・口)と半透明のふちは、かたまりに入れない。
//      となりとの色の差が小さく(near)、かたまりの最初の色からも離れすぎない(far)画素だけつなぐ
//   ② かたまりごとに、いまの部位分けの多数決を取る。いちばん多い部位が snap 以上なら、かたまり全体をその部位にする
//      (境目が絵の線・色の変わり目へ寄る)。足りないかたまり(同じ色の面を、形でわざと分けている所)は、
//      いまの分け方のまま残して、中の小さな点だけならす
//   ③ 暗い線は、いまの部位のまま。ただし線のまわりにその部位が無い(はみ出した)ときは、まわりで多い部位へ。
//      染めない線で、まわりが1つの部位だけのもの(瞳のふち・外周の輪郭線)は、その部位へ
//   ④ 小さな点をならす: ほかの部位に囲まれた小さなかたまり(部位の点・つやの点)は、囲んでいる部位へ入れる。
//      暗い点(瞳・口)と、染めない所の中の点はそのまま
//   ⓪ 子ごとの指示(CONFIGS の pre): 今の部位分けが部品を丸ごと別の部位に入れている所は、おおまかな多角形(絵の画素座標)で
//      部位を指示してから①〜④を通す(スキル §4 の指示図と同じ考え方。境目は①②で絵の線へ寄る)
//   ⑤ 子ごとの手直し(CONFIGS): keep … この範囲は今の分け方のまま / set … この範囲の、ある部位を別の部位へ
//      (範囲は絵の幅・高さに対する割合 [x0,y0,x1,y1])
const fs = require('fs');
const path = require('path');
const { currentLabels, labelsToMaskCanvas } = require('./dye-mask-lib');

const TOOLS_DIR = path.join(__dirname, '..');
const DEFAULTS = { near: 22, far: 90, darkV: 60, snap: 0.6, snapDist: 6, speck: 60, thin: 1.6, lineFix: true };
// 子ごとの設定。書いていない値は DEFAULTS
const CONFIGS = {
  // 白い毛は②、紫の毛は①。あご下・胸の陰になった白い毛と、右後ろ足(四角い範囲の外で縦に切れていた)が①に入っていた。
  // 白い毛は陰でも彩度が低い(0.28未満)か青緑寄り、紫の毛は色相240前後で彩度0.5前後なので、色で分ける。尾の先の白(染めない)は触らない
  Tiger: { far: 250, snap: 0.01, snapDist: Infinity, pre: [
    { from: 0, to: 1, sat: [0, 0.28], poly: [[0, 300], [700, 300], [700, 1024], [0, 1024]] },
    // あご下の陰は青緑(色相150〜228)に寄っていて彩度も少し高い。紫の毛は色相240前後
    { from: 0, to: 1, sat: [0, 0.45], hue: [150, 228], poly: [[0, 300], [700, 300], [700, 1024], [0, 1024]] },
  ] },
  // 黒目は②。明るい下半分と右のふちが体①に入っていた(黒目の円。上下はまぶたの手前まで)
  Suezo: { pre: [{ from: 0, to: 1, poly: [[727, 521], [725, 545], [718, 569], [707, 591], [692, 611], [673, 628], [652, 642], [628, 653], [603, 659], [577, 661], [551, 659], [526, 653], [502, 642], [481, 628], [462, 611], [447, 591], [436, 569], [429, 545], [427, 521], [429, 497], [436, 473], [447, 451], [462, 431], [481, 414], [502, 405], [526, 405], [551, 405], [577, 405], [603, 405], [628, 405], [652, 405], [673, 414], [692, 431], [707, 451], [718, 473], [725, 497]] }] },
  // 腕の肌色は肌③、緑のひれは①。左腕は肌色の所まで①、右腕は上半分だけ③で、左右が食い違っていた
  Yaobikuni: { pre: [
    // 胸から手先まで: 肌色(色相0〜45)は肌③、緑(55〜140)は①。桃色の髪(色相340前後)はどちらにも入らないので動かない
    { to: 2, hue: [0, 45], poly: [[100, 465], [900, 465], [900, 830], [100, 830]] },
    { to: 0, hue: [55, 140], poly: [[100, 465], [900, 465], [900, 830], [100, 830]] },
  ] },
  // 腕と手(水色のひれ)は肌②。手の先とひじのまわりが髪①に入っていた
  Undine: { pre: [
    { from: 0, to: 1, poly: [[300, 600], [358, 600], [358, 660], [345, 700], [330, 760], [300, 800], [260, 835], [180, 835], [160, 800], [180, 740], [230, 690], [280, 640]] },
    { from: 0, to: 1, poly: [[610, 615], [640, 640], [700, 700], [750, 760], [780, 826], [700, 826], [660, 800], [630, 760], [610, 700], [600, 650]] },
  ] },
};

const args = process.argv.slice(2);
const id = args.find(a => !a.startsWith('--'));
const outArg = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
if (!id) { console.log('使い方: node image/refine-dye-mask.js <id> [--out <パス>]'); process.exit(1); }
const cfg = { ...DEFAULTS, ...(CONFIGS[id] || {}) };

const hsvOf = (d, i) => {
  const r = d[i * 4] / 255, g = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
  let h = 0;
  if (dl) { if (mx === r) h = 60 * (((g - b) / dl) % 6); else if (mx === g) h = 60 * ((b - r) / dl + 2); else h = 60 * ((r - g) / dl + 4); }
  if (h < 0) h += 360;
  return [h, mx ? dl / mx : 0, mx];
};
// 点が多角形の中か(座標は絵の画素)
const inPoly = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

const refine = (srcData, Lin, W, H, cfg) => {
  const N = W * H;
  // 子ごとの指示(pre): 多角形の中を、ある部位にしてから仕上げる(指示図の代わり)。
  // 多角形はおおまかでよい。そのあとの①②で、境目が絵の線・色の変わり目へ寄る
  const L0 = new Int8Array(Lin);
  for (const pr of cfg.pre || []) {
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (const [x, y] of pr.poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
      const i = y * W + x;
      if (L0[i] < -1 || !inPoly(x + 0.5, y + 0.5, pr.poly)) continue;
      if (pr.from !== undefined && !(Array.isArray(pr.from) ? pr.from : [pr.from]).includes(L0[i])) continue;
      // hue: [下, 上] … その色相の画素だけ(肌色とひれの緑のように、ぼかしで続く2色を色で分けるとき)
      // sat: [下, 上] … その彩度の画素だけ(陰で暗くなった白い毛と、紫の毛を分けるとき)
      if (pr.sat) { const sat = hsvOf(srcData, i)[1]; if (sat < pr.sat[0] || sat > pr.sat[1]) continue; }
      if (pr.hue) { const [h, sat] = hsvOf(srcData, i); if (sat < 0.06 || !(pr.hue[0] <= pr.hue[1] ? (h >= pr.hue[0] && h <= pr.hue[1]) : (h >= pr.hue[0] || h <= pr.hue[1]))) continue; }
      L0[i] = pr.to;
    }
  }
  const scale2 = (Math.max(W, H) / 1024) ** 2;
  const px = (i) => [srcData[i * 4], srcData[i * 4 + 1], srcData[i * 4 + 2]];
  const vOf = (i) => Math.max(srcData[i * 4], srcData[i * 4 + 1], srcData[i * 4 + 2]);
  const d = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const opaque = (i) => L0[i] >= -1;
  const isLine = (i) => !opaque(i) || srcData[i * 4 + 3] < 250 || vOf(i) < cfg.darkV;
  const nb4 = (i) => { const x = i % W, o = []; if (x > 0) o.push(i - 1); if (x < W - 1) o.push(i + 1); if (i >= W) o.push(i - W); if (i < N - W) o.push(i + W); return o; };

  // ① かたまりに分ける
  const seg = new Int32Array(N).fill(-1);
  const segs = [];
  for (let s = 0; s < N; s++) {
    if (seg[s] >= 0 || !opaque(s) || isLine(s)) continue;
    const k = segs.length, seed = px(s), members = [s];
    seg[s] = k;
    for (let q = 0; q < members.length; q++) {
      const p = members[q], cp = px(p);
      for (const n of nb4(p)) {
        if (seg[n] >= 0 || !opaque(n) || isLine(n)) continue;
        const cn = px(n);
        if (d(cp, cn) <= cfg.near && d(seed, cn) <= cfg.far) { seg[n] = k; members.push(n); }
      }
    }
    segs.push(members);
  }
  // ② 多数決。付け直すのは、もとの境目から snapDist 画素以内だけ(境目のずれを直すため。離れた所まで塗り替えると、
  // 金の星とスカートの金のしまのように、つながった別の部品の分け方まで変えてしまう)
  const L = new Int8Array(L0);
  let snapped = 0, kept = 0;
  const SNAP_D = Number.isFinite(cfg.snapDist) ? Math.max(1, Math.round(cfg.snapDist * Math.sqrt(scale2))) : Infinity;
  const bdist = new Uint16Array(N).fill(65535);
  if (Number.isFinite(SNAP_D)) {
    let front = [];
    for (let i = 0; i < N; i++) if (opaque(i) && nb4(i).some(j => opaque(j) && L0[j] !== L0[i])) { bdist[i] = 0; front.push(i); }
    for (let dd = 1; dd <= SNAP_D && front.length; dd++) {
      const next = [];
      for (const i of front) for (const j of nb4(i)) if (opaque(j) && bdist[j] > dd) { bdist[j] = dd; next.push(j); }
      front = next;
    }
  }
  for (const members of segs) {
    const cnt = new Map();
    for (const p of members) cnt.set(L0[p], (cnt.get(L0[p]) || 0) + 1);
    let top = null, tn = 0;
    for (const [lab, n] of cnt) if (n > tn) { tn = n; top = lab; }
    if (cnt.size === 1) continue;
    if (tn / members.length >= cfg.snap) { for (const p of members) if (bdist[p] <= SNAP_D || !Number.isFinite(SNAP_D)) L[p] = top; snapped++; }
    else kept++;
  }
  // ②の続き: 細いかたまり(石のふちの明るい面・スカートの折り目の淡い線)で、まわりの8割以上が1つの部位なら、その部位へ。
  // まわりが透明(絵の外)の細い部品(剣・細い髪)は、まわりが1つの部位にならないので動かない
  let thin = 0;
  for (let k = 0; k < segs.length; k++) {
    const members = segs[k];
    if (members.length > 4000 * scale2) continue;
    const lab = L[members[0]];
    if (members.some(p => L[p] !== lab)) continue;
    const around = new Map();
    let per = 0;
    for (const p of members) for (const n of nb4(p)) {
      if (seg[n] === k) continue;
      per++;
      const key = !opaque(n) ? 'T' : isLine(n) ? null : L[n];
      if (key !== null) around.set(key, (around.get(key) || 0) + 1);
    }
    if (!per || members.length / per >= cfg.thin) continue;
    let top = null, tn = 0, all = 0;
    for (const [key, n] of around) { all += n; if (n > tn) { tn = n; top = key; } }
    if (top === null || top === 'T' || top === lab || tn / all < 0.8) continue;
    for (const p of members) L[p] = top;
    thin++;
  }
  // ③ 暗い線: まわり(半径3)に同じ部位が無ければ、まわりで多い部位へ
  if (cfg.lineFix) {
    const next = new Int8Array(L);
    for (let i = 0; i < N; i++) {
      if (!opaque(i) || !isLine(i) || L[i] < 0) continue;
      const x = i % W, y = (i - x) / W;
      const cnt = new Map();
      let same = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!opaque(j) || isLine(j)) continue;
        if (L[j] === L[i]) same++;
        cnt.set(L[j], (cnt.get(L[j]) || 0) + 1);
      }
      if (same || !cnt.size) continue;
      let top = null, tn = 0;
      for (const [lab, n] of cnt) if (n > tn) { tn = n; top = lab; }
      next[i] = top;
    }
    L.set(next);
    // 染めない暗い線のうち、まわり(半径3)が1つの部位だけのもの(瞳のふち・部位の中の線・絵の外周の輪郭線)は、その部位へ。
    // 染めても線は暗いまま残るので、白やパステルで染めたときに線の途切れが点線になって見えるのを防ぐ。
    // まわりに染めない所(白目・肌など)がある線はそのまま
    for (let pass = 0; pass < 2; pass++) {
      const nx2 = new Int8Array(L);
      for (let i = 0; i < N; i++) {
        if (!opaque(i) || !isLine(i) || L[i] !== -1) continue;
        const x = i % W, y = (i - x) / W;
        let only = null, mixed = false;
        for (let dy = -3; dy <= 3 && !mixed; dy++) for (let dx = -3; dx <= 3; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (!opaque(j) || (isLine(j) && L[j] === -1)) continue;
          if (L[j] < 0 || (only !== null && L[j] !== only)) { mixed = true; break; }
          only = L[j];
        }
        if (!mixed && only !== null) nx2[i] = only;
      }
      L.set(nx2);
    }
    // 部位と部位のあいだの線は、まわり(半径2)の線の多数決でそろえる(交互に入って点線に見えるのを防ぐ)
    for (let pass = 0; pass < 2; pass++) {
      const nx3 = new Int8Array(L);
      for (let i = 0; i < N; i++) {
        if (!opaque(i) || !isLine(i) || L[i] < 0) continue;
        const x = i % W, y = (i - x) / W;
        const cnt = new Map();
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (!opaque(j) || !isLine(j) || L[j] < 0) continue;
          cnt.set(L[j], (cnt.get(L[j]) || 0) + 1);
        }
        let top = L[i], tn = 0;
        for (const [lab, n] of cnt) if (n > tn) { tn = n; top = lab; }
        nx3[i] = top;
      }
      L.set(nx3);
    }
  }
  // ④ 小さな点をならす
  const SPECK = Math.max(4, Math.round(cfg.speck * scale2));
  let specks = 0;
  for (let pass = 0; pass < 2; pass++) {
    const seen = new Uint8Array(N);
    for (let s = 0; s < N; s++) {
      if (seen[s] || !opaque(s)) continue;
      const lab = L[s], comp = [s];
      seen[s] = 1;
      const around = new Map();
      let edge = false;
      for (let q = 0; q < comp.length; q++) {
        const p = comp[q];
        if (p % W === 0 || p % W === W - 1 || p < W || p >= N - W) edge = true;
        for (const n of nb4(p)) {
          if (!opaque(n)) { edge = true; continue; }
          if (L[n] === lab) { if (!seen[n]) { seen[n] = 1; comp.push(n); } }
          else around.set(L[n], (around.get(L[n]) || 0) + 1);
        }
        if (comp.length > SPECK) break;
      }
      if (comp.length > SPECK) { // 大きいかたまりは残りも見た印だけ付ける
        for (let q = 0; q < comp.length; q++) for (const n of nb4(comp[q])) if (opaque(n) && L[n] === lab && !seen[n]) { seen[n] = 1; comp.push(n); }
        continue;
      }
      if (edge || around.size !== 1) continue;
      const outer = [...around.keys()][0];
      if (outer < 0) { if (lab >= 0 && comp.every(p => isLine(p))) continue; }
      // 暗い点(瞳・口・線)を染めない所から部位へは入れない
      if (lab < 0 && comp.some(p => vOf(p) < cfg.darkV + 30)) continue;
      for (const p of comp) L[p] = outer;
      specks++;
    }
  }
  // ④の続き: 部位と部位のあいだに挟まった、暗くない小さな塗り残し(まぶたのふちの淡い線など)は、
  // 画素ごとに色がいちばん近いとなりの部位へ。透明に触れるもの・染めない所(白目など)とつながるものはそのまま
  {
    const seen = new Uint8Array(N);
    for (let s0 = 0; s0 < N; s0++) {
      if (seen[s0] || !opaque(s0) || L[s0] !== -1) continue;
      const comp = [s0];
      seen[s0] = 1;
      let bad = false;
      for (let q = 0; q < comp.length; q++) {
        for (const n of nb4(comp[q])) {
          if (!opaque(n)) { bad = true; continue; }
          if (L[n] === -1 && !seen[n]) { seen[n] = 1; comp.push(n); }
        }
        if (comp.length > SPECK) bad = true;
      }
      if (bad || comp.some(p => vOf(p) < cfg.darkV + 30)) continue;
      for (const p of comp) {
        let best = -1, bd = Infinity;
        const x = p % W, y = (p - x) / W;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (L[j] < 0) continue;
          const dd = d(px(p), px(j));
          if (dd < bd) { bd = dd; best = L[j]; }
        }
        if (best >= 0) L[p] = best;
      }
      specks++;
    }
  }
  // ⑤ 子ごとの手直し
  const inBox = (i, b) => { const x = (i % W + 0.5) / W, y = (Math.floor(i / W) + 0.5) / H; return x >= b[0] && x < b[2] && y >= b[1] && y < b[3]; };
  for (const b of cfg.keep || []) for (let i = 0; i < N; i++) if (inBox(i, b)) L[i] = L0[i];
  for (const s of cfg.set || []) for (let i = 0; i < N; i++) if (opaque(i) && inBox(i, s.box) && (s.from === undefined || L[i] === s.from)) L[i] = s.to;
  return { L, snapped, kept, specks, thin, segs: segs.length };
};

const ROOT = path.join(TOOLS_DIR, '..');
const ALLY_IMAGES = path.join(ROOT, 'monster-hero/data/images/images-ally.js');
const MASK_DIR = path.join(TOOLS_DIR, 'art-sources/dye-masks');
// 配信する染色マスクのファイル名(拡張子なし)と、images-ally.js の定数名。
// すでに配信マスクを持つ子はそのファイル、無い子は立ち絵のファイル名から決める
const maskNames = (dye) => {
  const ally = fs.readFileSync(ALLY_IMAGES, 'utf8');
  const exact = dye.EXACT_DYE_MASKS && dye.EXACT_DYE_MASKS[id];
  if (exact) {
    const file = exact.split('?')[0].replace(/^images\/monsters\//, '');
    const m = ally.match(new RegExp(`const ([A-Z0-9_]+) = "images/monsters/${file.replace(/[.]/g, '[.]')}\\?v=`));
    return { file, constName: m && m[1] };
  }
  const imgConst = `${id.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_IMG`;
  const m = ally.match(new RegExp(`const ${imgConst} = "images/monsters/([a-z0-9-]+)[.]`, 'i'));
  if (!m) throw new Error(`${imgConst} が images-ally.js に見つからない`);
  return { file: `${m[1]}-dye-mask.PNG`, constName: `${id.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_DYE_MASK` };
};
// 出発点の部位図を PNG から読む(約束の色 → 部位。透明は染めない。絵の透明な所は -2)
const labelsFromPng = async (file, srcData, W, H) => {
  const { loadImage } = require('canvas');
  const { getData } = require('./dye-mask-lib');
  const md = getData(await loadImage(file), W, H, false);
  const L = new Int8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (srcData[i * 4 + 3] < 128) { L[i] = -2; continue; }
    const R = md[i * 4], G = md[i * 4 + 1], B = md[i * 4 + 2];
    L[i] = md[i * 4 + 3] < 20 ? -1 : (R > 200 && G < 80 && B < 80) ? 0 : (G > 200 && R < 80 && B < 80) ? 1 : (B > 200 && R < 80 && G < 80) ? 2 : (R > 200 && G > 200 && B < 80) ? 3 : (R > 200 && G < 80 && B > 200) ? 4 : -1;
  }
  return L;
};

(async () => {
  const apply = args.includes('--apply');
  const cur = await currentLabels(id);
  if (!cur) { console.log(`${id}: 絵が見つからない`); process.exit(1); }
  const { srcData, W, H } = cur;
  const names = maskNames(cur.dye);
  // 出発点: 仕上げ直す前の部位分けを残してあればそれを使う(仕上げ直しても毎回同じ結果になるように)。
  // 無ければ、いまゲームが使っている部位分け
  const beforeFile = path.join(MASK_DIR, `${names.file.replace(/-dye-mask2?[.]PNG$/, '')}-dye-mask-before-refine.png`);
  const L0 = fs.existsSync(beforeFile) ? await labelsFromPng(beforeFile, srcData, W, H) : cur.L;
  const r = refine(srcData, L0, W, H, cfg);
  let changed = 0; for (let i = 0; i < W * H; i++) if (r.L[i] !== L0[i]) changed++;
  const out = outArg || path.join(TOOLS_DIR, 'out', 'dye-mask-review', `${id}-refined.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const png = labelsToMaskCanvas(r.L, W, H).toBuffer('image/png', { compressionLevel: 9 });
  fs.writeFileSync(out, png);
  console.log(`${id}: かたまり${r.segs} 寄せた${r.snapped} 残した${r.kept} 細い${r.thin} 点${r.specks} 変わった画素${changed}(${(changed / (W * H) * 100).toFixed(2)}%) → ${out}`);
  if (!apply) return;
  // --apply: 出発点を残す / 配信マスクを書く / キャッシュキーを付ける / 正解見本があれば更新する
  if (!fs.existsSync(beforeFile)) {
    fs.writeFileSync(beforeFile, labelsToMaskCanvas(cur.L, W, H).toBuffer('image/png', { compressionLevel: 9 }));
    console.log(`出発点を残した: ${path.relative(ROOT, beforeFile)}`);
  }
  const dest = path.join(ROOT, 'monster-hero/images/monsters', names.file);
  fs.writeFileSync(dest, png);
  const hash = require('crypto').createHash('sha256').update(png).digest('hex').slice(0, 12);
  let ally = fs.readFileSync(ALLY_IMAGES, 'utf8');
  const line = `const ${names.constName} = "images/monsters/${names.file}?v=${hash}";`;
  const re = new RegExp(`^const ${names.constName} = .*$`, 'm');
  if (re.test(ally)) ally = ally.replace(re, line);
  else {
    const imgRe = new RegExp(`^const ${id.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}_IMG = .*$`, 'm');
    ally = ally.replace(imgRe, (m0) => `${m0}\n${line}`);
  }
  fs.writeFileSync(ALLY_IMAGES, ally);
  console.log(`配信マスク: ${path.relative(ROOT, dest)}(${(png.length / 1024).toFixed(0)}KB) / ${line}`);
  // 正解見本(tools/art-sources/dye-masks/)と比べる検査がある子は、見本も新しいマスクにそろえる。
  // ほかの子の検査(eiki・mocchi・plant・yaobikuni)は配信中のマスクそのものと比べるので、見本は無い
  const REFS = { Mia: 'mia-dye-mask.PNG', Undine: 'undine-dye-mask.PNG' };
  if (REFS[id]) { fs.writeFileSync(path.join(MASK_DIR, REFS[id]), png); console.log(`正解見本も更新: tools/art-sources/dye-masks/${REFS[id]}`); }
})();
