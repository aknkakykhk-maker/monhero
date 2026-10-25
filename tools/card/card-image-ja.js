// 英語版のカードの絵の文字を、日本語版と同じ見た目の日本語にする(設計書 2-5・社長「英語を消して日本語にして」)
//   全モンスター19枚・ブリーダー18枚・混血15枚。絵(イラスト)には手を加えない。消すのは文字だけ
//   消し方: その行の「字でない所」の色で埋める(文の箱のしま模様・種類の札の色が、行ごとにそのまま続く)
//   書き方: 日本語版の技カードに合わせる(題字・札は白い字＋太い黒のふち＋右下の影、文は黒い字・「ちから」「かしこさ」は赤)
//
// 字体: Noto Sans JP(SIL Open Font License)。リポジトリには入れず、使うときに取ってくる:
//   cd <作業場所> && npm pack @fontsource/noto-sans-jp@5.0.19 && tar xzf fontsource-noto-sans-jp-5.0.19.tgz
//   → --font-dir <作業場所>/package/files
// 使い方:
//   node tools/card/card-image-ja.js --font-dir <dir> --out <フォルダ> 109 112 C-051   … 指定したカードだけ書き出す(見本)
//   node tools/card/card-image-ja.js --font-dir <dir> --out <フォルダ> --all          … 52枚全部
//   書き出した絵は <フォルダ>/<元のファイル名>(742×1038 の JPEG)。配信用に縮めるのは card-image-build.js
// ゲームに入れるとき(社長 台帳 #3511「このやり方で全部作る」):
//   --out tools/art-sources/card-battle-ja --all → node tools/card/card-image-build.js --build
//   (card-image-build は、card-battle-ja に同じ名前の絵があれば英語版の代わりに使い、©・URL を消して縮める)
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'tools', 'art-sources', 'card-battle');
const sharp = require(path.join(ROOT, 'tools', 'node_modules', 'sharp'));
const { normalizeField } = require(path.join(__dirname, 'card-image-build.js'));
const W = 742, H = 1038;
const KIND_JA = { DGE: '回避', BLK: '防御', SPE: '特殊', POW: 'ちから', INT: 'かしこさ' };
const TYPE_JA = { G: '地上', A: '空中', W: '水中' };

// ---- 配置(英語版の絵を測って決めた。座標は 742×1038 の元の絵の上) ----
// 消す所: rect … 範囲 / keep … 「字でない」と見なす色(その行の、この色の点の真ん中の色で、ほかの点を埋める)
//   light … 明るい地(白・しま模様)/ colored … 色の濃い地(種類の札の中)/ dark … 暗い地(ブリーダーの題字のうしろ)
const LAYOUTS = {
  any: {
    erase: [
      // 題字の下と右は、絵のふちの黒い線(下は y≈129、x≈485 から右上へ斜めに上がる)。その先は絵なので消さない(tab)
      { name: 'title', rect: [205, 48, 524, 127], keep: 'white', shape: 'tab', tab: [484, 124, 0.95], grow: 3 },
      { name: 'kind', rect: [72, 80, 170, 232], keep: 'colored', shape: 'stadium' },
      { name: 'label', rect: [52, 698, 260, 741], keep: 'light' },
      { name: 'guts', rect: [64, 900, 150, 941], keep: 'light' },
      { name: 'text', rect: [198, 772, 683, 937], keep: 'light', grow: 3 },
    ],
    draw: (c) => [
      { t: c.name, x: 214, y: 118, size: 60, weight: 900, align: 'left', style: 'title', maxW: 270 },
      ...kindLines(c.kind, 121, 156),
      { t: '全モンスター', x: 58, y: 734, size: 33, weight: 900, align: 'left', style: 'title', maxW: 200 },
      { t: 'ガッツ', x: 107, y: 931, size: 24, weight: 500, align: 'center', color: '#1a1a1a' },
      { body: c.text, cx: 440, cy: 854, w: 452, size: 30, lh: 39 },
    ],
  },
  // ブリーダー(題字と「BREEDER」の地は、横へ色が変わる暗い灰色なので列ごとに埋める。種類の札は赤い角丸の四角)
  breeder: {
    erase: [
      // 長い題字(Shadow Bind など)は x≈480 まで。下と右は絵のふちの黒い線(下 y≈128、x≈478 から右上へ)
      { name: 'title', rect: [208, 50, 520, 125], keep: 'dark', dir: 'col', shape: 'tab', tab: [476, 122, 1.0] },
      // 種類の札: ちから・特殊は赤い角丸の四角。防御・回避は全モンスターと同じ青い縦長の札なので、同じ範囲で消す(280 おいのりで「K」が残っていた)
      (c) => (/^(BLK|DGE)$/.test(c.kind) ? { name: 'kind', rect: [72, 80, 170, 232], keep: 'colored', shape: 'stadium' } : { name: 'kind', rect: [74, 80, 171, 200], keep: 'colored' }),
      // 左のほうは地がほとんど黒で、黒いふちと見分けられない。すぐ下の2行の色を、列ごとにそのまま写す(card-image-build の © の消し方と同じ)
      { name: 'label', rect: [56, 699, 256, 742], from: 'bottom' },
      { name: 'guts', rect: [64, 900, 150, 941], keep: 'light' },
      { name: 'text', rect: [198, 772, 683, 937], keep: 'light', grow: 3 },
    ],
    draw: (c) => [
      { t: c.name, x: 214, y: 116, size: 58, weight: 900, align: 'left', style: 'title', maxW: 250 },
      ...kindLines(c.kind, 122, 140, 46),
      { t: 'ブリーダー', x: 64, y: 734, size: 33, weight: 900, align: 'left', style: 'title', maxW: 200 },
      { t: 'ガッツ', x: 107, y: 931, size: 24, weight: 500, align: 'center', color: '#1a1a1a' },
      { body: c.text, cx: 440, cy: 854, w: 452, size: 30, lh: 39 },
    ],
  },
  // 全体カード(breeder-field。2026-10-25 社長「文字を描き直す」)。元の絵は画面から切り出したもので文字がにじんでいる。
  // card-image-build.js の normalizeField で枠にそろえたあとの絵(座標はその上)に、加勢(112)と同じ字・大きさで描き直す。
  // 左上は赤い「全体」の札、その下の盾は空(ガッツの札は下の箱)。絵の部分は手を加えない
  field: {
    erase: [
      { name: 'title', rect: [205, 55, 503, 122], keep: 'dark', dir: 'col' },   // 右は x≈505 で題字の帯が終わり、その先は絵
      // 絵の右下の「© TECMO」(にじんでいる)。すぐ上の行の色を列ごとに写す
      { name: 'copy', rect: [494, 704, 676, 722], from: 'top' },
      { name: 'kind', rect: [76, 78, 178, 206], keep: 'colored' },
      { name: 'label', rect: [56, 688, 232, 733], from: 'bottom' },
      { name: 'guts', rect: [66, 768, 158, 941], keep: 'paint', fill: 228, shape: 'round', r: 18 },   // 箱の角の外(暗い地)は塗らない
      { name: 'text', rect: [198, 766, 683, 944], keep: 'paint', stripe: [244, 232, 10], shape: 'round', r: 20 },
      { name: 'no', rect: [58, 952, 214, 994], keep: 'hlerp' },
      // 文の箱のすぐ下の暗いふち(元の字が箱からはみ出して写っていることがある)
      { name: 'under', rect: [214, 944, 668, 953], keep: 'hlerp' },
    ],
    draw: (c) => [
      { t: c.name, x: 214, y: 112, size: 52, weight: 900, align: 'left', style: 'title', maxW: 285 },
      ...kindLines(c.kind, 127, 142, 46),
      { t: 'ブリーダー', x: 64, y: 724, size: 33, weight: 900, align: 'left', style: 'title', maxW: 200 },
      { t: String(c.guts ?? ''), x: 112, y: 878, size: 118, weight: 900, align: 'center', color: '#111' },
      { t: 'ガッツ', x: 112, y: 931, size: 24, weight: 500, align: 'center', color: '#1a1a1a' },
      { body: c.text, cx: 440, cy: 854, w: 452, size: 30, lh: 39 },
      { t: `No. ${String(c.no).replace(/^F/, '')}`, x: 62, y: 988, size: 25, weight: 500, align: 'left', color: '#ffffff' },
    ],
  },
  // 全体カードの高画質版(breeder-field/hi/。統括部長が作った描き直しの絵。絵はきれいだが文字は化けている)がある子。
  // 高画質版は下半分(箱・番号)の配置が1枚ごとにばらばらなので、上(題字・絵・「ブリーダー」の札。FIELD_HI_SEAM より上)だけ
  // 高画質版を使い、下は元の絵のまま。座標はどちらも normalizeField で枠にそろえたあと。上は高画質版で測り、下は field と同じ
  fieldHi: {
    erase: [
      { name: 'title', rect: [182, 47, 505, 114], keep: 'dark', dir: 'col' },
      { name: 'kind', rect: [78, 78, 158, 158], keep: 'colored' },
      { name: 'label', rect: [58, 684, 244, 744], keep: 'hlerp' },
    ],
    draw: (c) => [
      { t: c.name, x: 210, y: 104, size: 52, weight: 900, align: 'left', style: 'title', maxW: 285 },
      ...kindLines(c.kind, 118, 118, 44),
      { t: 'ブリーダー', x: 66, y: 708, size: 33, weight: 900, align: 'left', style: 'title', maxW: 200 },
    ],
  },
  // 混血のモンスター(左上「メイン」の札・右上の特徴の丸・右下「サブ」の札・左下の名前)
  hybrid: {
    erase: [
      // 札の地は色つき・黒・灰色とさまざまなので、列ごとに上と下の端の色を地と見なし、それと違う点(白い字・黒いふち)を消す(edge)
      // 英語の名前は長いと札の端近くまである(DURAHAN・ARMOR DRAGON など)ので、範囲は札いっぱい
      { name: 'main', rect: [64, 71, 194, 133], keep: 'edge', dir: 'col', grow: 5 },
      { name: 'type', rect: [554, 83, 660, 187], keep: 'colored', shape: 'circle' },
      { name: 'sub', rect: [558, 779, 679, 843], keep: 'edge', dir: 'col', grow: 5, cut: [574, 806] },
      { name: 'name', rect: [40, 916, 240, 966], keep: 'edge', dir: 'col', grow: 6 },
    ],
    draw: (c) => [
      { t: c.main || '', x: 72, y: 101, size: 23, weight: 900, align: 'left', style: 'title', sw: 5, maxW: 116 },
      { t: 'メイン', x: 76, y: 126, size: 19, weight: 900, align: 'left', style: 'title', sw: 5 },
      ...kindLines(TYPE_JA[c.type] || c.type, 607, 136, 38, 1.06),
      { t: 'サブ', x: 668, y: 806, size: 19, weight: 900, align: 'right', style: 'title', sw: 5 },
      { t: c.sub || '', x: 670, y: 833, size: 23, weight: 900, align: 'right', style: 'title', sw: 5, maxW: 96 },
      { t: c.name, x: 48, y: 953, size: 32, weight: 900, align: 'left', style: 'title', maxW: 180 },
    ],
  },
};
// 高画質版の下半分は元の絵なので、箱・番号の消し方と描き方は field のものをそのまま使う
const FIELD_HI_SEAM = 734;
// 高画質版のうち、絵の窓が短い(「ブリーダー」の札が上に寄っている)もの。[縦の倍率, ずらす量]で、札を元の絵の場所(y≈697)へ下ろす
const FIELD_HI_FIT = { F255: [1.048, -3], F263: [1.0325, -2] };
const FIELD_LOWER = ['guts', 'text', 'no', 'under'];
LAYOUTS.fieldHi.erase.push(...LAYOUTS.field.erase.filter((e) => FIELD_LOWER.includes(e.name)));
const fieldHiTop = LAYOUTS.fieldHi.draw;
LAYOUTS.fieldHi.draw = (c) => [...fieldHiTop(c), ...LAYOUTS.field.draw(c).slice(-4)];
// 種類の札の字(縦に2字。3字以上は小さく)
const kindLines = (kind, cx, cy, base = 52, gap = 1.18) => {
  const s = [...(KIND_JA[kind] || kind || '')];
  const size = s.length <= 2 ? base : Math.round(base * 0.7);
  const step = size * gap;
  const top = cy - ((s.length - 1) * step) / 2;
  return s.map((ch, i) => ({ t: ch, x: cx, y: top + i * step + size * 0.36, size, weight: 900, align: 'center', style: 'title', sw: 9 }));
};

// どのカードがどの配置か・名前と文(cards.json の日本語。社長が決めた名前)
const loadCards = () => {
  const out = {};
  const add = (folder, layout) => {
    const j = JSON.parse(fs.readFileSync(path.join(SRC, folder, 'cards.json'), 'utf8'));
    (j.skills || []).forEach((k) => { out[k.no] = { no: k.no, folder, layout, file: `${k.no}.jpg`, name: k.name, text: k.text || '', kind: k.kind_en || k.kind || '', guts: k.guts }; });
    (j.monsters || j.monster || []).forEach((m) => { if (!m.excluded) out[m.no] = { no: m.no, folder, layout, file: m.img || `${m.no.replace('-', '')}.jpg`, name: m.name, type: m.type_en || m.type, main: m.main, sub: m.sub }; });
  };
  add('any-monster', 'any');
  if (fs.existsSync(path.join(SRC, 'breeder', 'cards.json'))) add('breeder', 'breeder');
  if (fs.existsSync(path.join(SRC, 'hybrid', 'cards.json'))) add('hybrid', 'hybrid');
  if (fs.existsSync(path.join(SRC, 'breeder-field', 'cards.json'))) add('breeder-field', 'field');
  return out;
};

const pageScript = async ({ imgUrl, fontUrls, layout, ops }) => {
  for (const [w, url] of Object.entries(fontUrls)) {
    const f = new FontFace('NotoJP', `url(${url})`, { weight: String(w) });
    await f.load(); document.fonts.add(f);
  }
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = imgUrl; });
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
  // ---- 消す ----
  const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
  const sat = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
  const keepOf = {
    light: (r, g, b) => Math.min(r, g, b) > 195 && sat(r, g, b) < 40,
    white: (r, g, b) => Math.min(r, g, b) > 236 && sat(r, g, b) < 18, // 題字のうしろの白い枠(英語の字の薄い影も消す)
    colored: (r, g, b) => sat(r, g, b) > 70 && lum(r, g, b) > 40 && lum(r, g, b) < 215,
    dark: (r, g, b) => lum(r, g, b) > 45 && lum(r, g, b) < 225 && sat(r, g, b) < 45, // 灰色の地(白い字と黒いふちを除く)
  };
  for (const e of layout.erase) {
    const [x0, y0, x1, y1] = e.rect;
    const w = x1 - x0, h = y1 - y0;
    const id = cx.getImageData(x0, y0, w, h); const d = id.data;
    // from: 'top' … すぐ上の2行の色を列ごとに写す(全体カードの絵の右下の ©)/ 'bottom' … すぐ下の2行
    if (e.from === 'bottom' || e.from === 'top') {
      const below = cx.getImageData(x0, e.from === 'top' ? y0 - 2 : y1, w, 2).data;
      for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
        let sum = 0, n = 0;
        for (let dx = -3; dx <= 3; dx++) { const xx = Math.min(w - 1, Math.max(0, x + dx)); for (let yy = 0; yy < 2; yy++) { sum += below[(yy * w + xx) * 4 + c]; n++; } }
        for (let y = 0; y < h; y++) d[(y * w + x) * 4 + c] = Math.round(sum / n);
      }
      cx.putImageData(id, x0, y0);
      continue;
    }
    const inShape = (x, y) => {
      if (e.shape === 'circle') return (x - w / 2) ** 2 + (y - h / 2) ** 2 <= (Math.min(w, h) / 2) ** 2;
      if (e.shape === 'tab') { const ax = x + x0, ay = y + y0; const [tx, ty, tk] = e.tab; return ax <= tx || ay < ty - (ax - tx) * tk; }
      // cut: 左上の角(札の丸い角のふち)は消さない。[x, y] より左かつ上
      if (e.cut && x + x0 < e.cut[0] && y + y0 < e.cut[1]) return false;
      // round: 角の丸い四角(箱の角の外=暗い地は消さない)。半径は e.r
      if (e.shape === 'round') {
        const r = e.r || 16; const dx = Math.max(r - x, x - (w - 1 - r), 0); const dy = Math.max(r - y, y - (h - 1 - r), 0);
        return dx * dx + dy * dy <= r * r;
      }
      if (e.shape !== 'stadium') return true;
      const r = w / 2; const cxx = w / 2;
      if (y < r) return (x - cxx) ** 2 + (y - r) ** 2 <= r * r;
      if (y > h - r) return (x - cxx) ** 2 + (y - (h - r)) ** 2 <= r * r;
      return true;
    };
    // hlerp: 横向きに濃淡のある帯(全体カードの番号の帯)。行ごとに、四角のすぐ左とすぐ右の色を、横へまっすぐつなぐ
    if (e.keep === 'hlerp') {
      const L = cx.getImageData(x0 - 2, y0, 1, h).data, R = cx.getImageData(x1 + 1, y0, 1, h).data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const t = (x + 1) / (w + 1);
        for (let c = 0; c < 3; c++) d[(y * w + x) * 4 + c] = Math.round(L[y * 4 + c] * (1 - t) + R[y * 4 + c] * t);
      }
      cx.putImageData(id, x0, y0);
      continue;
    }
    // paint: 箱を塗り直す(全体カード。元の絵の字はにじんで消しきれないので、加勢(112)と同じ色の箱にする)。
    //   stripe … [明るい色, 濃い色, 段の高さ](横じま) / 無ければ fill の一色
    if (e.keep === 'paint') {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!inShape(x, y)) continue;
        const v = e.stripe ? (Math.floor((y + y0) / e.stripe[2]) % 2 ? e.stripe[1] : e.stripe[0]) : e.fill;
        const k = (y * w + x) * 4; d[k] = v; d[k + 1] = v; d[k + 2] = v;
      }
      cx.putImageData(id, x0, y0);
      continue;
    }
    // rowMedian: 横じまの箱(全体カードの文の箱)。形の中を、行ごとの真ん中の色でそのまま塗る(うすい字の影も残さない)
    if (e.keep === 'rowMedian') {
      for (let y = 0; y < h; y++) {
        const xs = []; for (let x = 0; x < w; x++) if (inShape(x, y)) xs.push(x);
        if (!xs.length) continue;
        const inner = xs.slice(Math.floor(xs.length * 0.15), Math.ceil(xs.length * 0.85));
        for (let c = 0; c < 3; c++) {
          const vals = inner.map((x) => d[(y * w + x) * 4 + c]).sort((p, q) => p - q);
          // 字の点は暗いので、明るいほうの真ん中(上から4分の1)を地の色にする
          const v = vals[Math.floor(vals.length * 0.75)];
          xs.forEach((x) => { d[(y * w + x) * 4 + c] = v; });
        }
      }
      cx.putImageData(id, x0, y0);
      continue;
    }
    const keep = keepOf[e.keep];
    // 字の点(地の色でない点)を印にし、まわり grow 点ぶんも広げる(字のふちの薄い線を残さない)
    const grow = e.grow ?? 2;
    const raw = new Uint8Array(w * h);
    if (e.keep === 'edge') {
      // 列ごとの地の色: 上の2行・下の2行。どちらかに近ければ地(tol)。消すのは地と違う白い字の点だけで、黒いふちは grow で広げて消す
      //   (黒い点まで消すと、札の角の外=上下が地の列で、札の黒い所まで塗りつぶしてしまう)
      const px = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
      const avg = (a, b) => a.map((v, j) => (v + b[j]) / 2);
      const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      const tol = e.tol || 60;
      for (let x = 0; x < w; x++) {
        const top = avg(px(x, 0), px(x, 1)), bot = avg(px(x, h - 1), px(x, h - 2));
        for (let y = 0; y < h; y++) { const c = px(x, y); raw[y * w + x] = inShape(x, y) && Math.min(dist(c, top), dist(c, bot)) > tol && Math.min(...c) > 185 && sat(...c) < 50 ? 1 : 0; }
      }
    } else for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; raw[y * w + x] = inShape(x, y) && !keep(d[i], d[i + 1], d[i + 2]) ? 1 : 0; }
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inShape(x, y)) continue;
      let on = 0;
      for (let dy = -grow; dy <= grow && !on; dy++) for (let dx = -grow; dx <= grow; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && raw[yy * w + xx]) { on = 1; break; } }
      mask[y * w + x] = on;
    }
    if (e.keep === 'edge') {
      // 列ごとに、消す点の続きを、そのすぐ上とすぐ下の点の色でつなぐ(札の上の明るい帯などの、縦の色の変わり方を残す)
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          if (!mask[y * w + x]) continue;
          let y2 = y; while (y2 < h && mask[y2 * w + x]) y2++;
          const a = y > 0 ? (y - 1) * w + x : null, b = y2 < h ? y2 * w + x : null;
          for (let t = y; t < y2; t++) {
            const f = a === null ? 1 : b === null ? 0 : (t - y + 1) / (y2 - y + 1);
            for (let c = 0; c < 3; c++) d[(t * w + x) * 4 + c] = Math.round((a === null ? d[b * 4 + c] : d[a * 4 + c]) * (1 - f) + (b === null ? d[a * 4 + c] : d[b * 4 + c]) * f);
          }
          y = y2;
        }
      }
      // 列ごとにつなぐと細い縦じまが出るので、塗った所だけ横に軽くならす(前後3点)
      const src = new Uint8ClampedArray(d);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!mask[y * w + x]) continue;
        for (let c = 0; c < 3; c++) { let sum = 0, n = 0; for (let dx = -3; dx <= 3; dx++) { const xx = x + dx; if (xx < 0 || xx >= w) continue; sum += src[(y * w + xx) * 4 + c]; n++; } d[(y * w + x) * 4 + c] = Math.round(sum / n); }
      }
      cx.putImageData(id, x0, y0);
      continue;
    }
    const med = (q) => q.sort((p1, p2) => p1 - p2)[q.length >> 1];
    const lines = e.dir === 'col' ? w : h;
    const len = e.dir === 'col' ? h : w;
    let last = null;
    for (let k = 0; k < lines; k++) {
      const at = (t) => (e.dir === 'col' ? t * w + k : k * w + t);
      const rs = [], gs = [], bs = [];
      for (let t = 0; t < len; t++) { const pidx = at(t); const x = pidx % w, y = (pidx / w) | 0; if (!inShape(x, y) || mask[pidx]) continue; const i = pidx * 4; rs.push(d[i]); gs.push(d[i + 1]); bs.push(d[i + 2]); }
      let col = last;
      if (rs.length >= 3) { col = [med(rs), med(gs), med(bs)]; last = col; }
      if (!col) continue;
      for (let t = 0; t < len; t++) { const pidx = at(t); if (!mask[pidx]) continue; const i = pidx * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; }
    }
    cx.putImageData(id, x0, y0);
  }
  // ---- 書く ----
  const font = (o) => `${o.weight || 500} ${o.size}px NotoJP`;
  const drawTitle = (o) => {
    cx.font = font(o); cx.textAlign = o.align || 'left'; cx.textBaseline = 'alphabetic';
    const mw = cx.measureText(o.t).width;
    const sx = o.maxW && mw > o.maxW ? o.maxW / mw : 1;
    cx.save(); cx.translate(o.x, o.y); cx.scale(sx, 1);
    const sw = o.sw || Math.max(6, o.size * 0.16);
    cx.lineJoin = 'round';
    // 影(右下にずらした灰色のふち)
    cx.strokeStyle = 'rgba(70,70,70,0.55)'; cx.lineWidth = sw; cx.strokeText(o.t, o.size * 0.06, o.size * 0.07);
    cx.strokeStyle = '#111'; cx.lineWidth = sw; cx.strokeText(o.t, 0, 0);
    cx.fillStyle = '#fff'; cx.fillText(o.t, 0, 0);
    cx.restore();
  };
  const drawPlain = (o) => { cx.font = font(o); cx.textAlign = o.align || 'left'; cx.textBaseline = 'alphabetic'; cx.fillStyle = o.color || '#111'; cx.fillText(o.t, o.x, o.y); };
  // 文: 日本語版と同じく、まん中そろえで折る。「ちから」「かしこさ」は赤
  const drawBody = (o) => {
    const RED = /(ちから|かしこさ)/;
    let size = o.size;
    const breakable = (s) => { // 折ってよい所: 「、」「。」のあと・語の切れ目(Intl.Segmenter)
      const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(s)].map((x) => x.segment) : [...s];
      // 日本語版のカードと同じく、「、」「。」と助詞のあとでだけ折る(「回避/する」のように言葉の途中で切らない)
      const out = [];
      let cur = '';
      seg.forEach((x) => {
        // 「、」「。」「」」などは前のかたまりにつける(行の頭に来ないように)
        if (!cur && out.length && /^[、。」)]/.test(x)) { out[out.length - 1] += x; return; }
        cur += x; if (/[、。をはがにでともへのや」)]$/.test(cur)) { out.push(cur); cur = ''; }
      });
      if (cur) out.push(cur);
      // 1つのかたまりが1行に入りきらないときは、語の切れ目でも折る
      return out.flatMap((piece) => (cx.measureText(piece).width <= o.w * 0.98 ? [piece] : seg.length ? (() => {
        const sub = [...new Intl.Segmenter('ja', { granularity: 'word' }).segment(piece)].map((x) => x.segment);
        const res = []; let c2 = '';
        sub.forEach((x) => { if (c2 && cx.measureText(c2 + x).width > o.w * 0.6 && !/^[\u3041-\u309f、。」)ー]/.test(x)) { res.push(c2); c2 = x; } else c2 += x; });
        if (c2) res.push(c2);
        return res;
      })() : [piece]));
    };
    let lines;
    for (; size >= 20; size -= 1) {
      cx.font = `500 ${size}px NotoJP`;
      lines = [];
      let cur = '';
      for (const piece of breakable(o.body)) {
        if (cx.measureText(cur + piece).width > o.w && cur) { lines.push(cur); cur = piece.replace(/^\s+/, ''); } else cur += piece;
      }
      if (cur) lines.push(cur);
      if (lines.length * (o.lh * size / o.size) <= 150) break;
    }
    // 行の長さをそろえる(最後の行に1〜2語だけ落ちないように): 同じ行数のまま、折る幅をいちばん狭くする
    const wrapAt = (wmax) => { const out = []; let cur = ''; for (const piece of breakable(o.body)) { if (cx.measureText(cur + piece).width > wmax && cur) { out.push(cur); cur = piece.replace(/^\s+/, ''); } else cur += piece; } if (cur) out.push(cur); return out; };
    for (let wmax = o.w; wmax > o.w * 0.4; wmax -= 4) { const t = wrapAt(wmax); if (t.length > lines.length) break; lines = t; }
    const lh = o.lh * size / o.size;
    const top = o.cy - ((lines.length - 1) * lh) / 2 + size * 0.36;
    lines.forEach((ln, i) => {
      const parts = ln.split(RED).filter(Boolean);
      const total = parts.reduce((a, p) => a + cx.measureText(p).width, 0);
      let x = o.cx - total / 2;
      parts.forEach((p) => { cx.fillStyle = RED.test(p) ? '#d1121b' : '#1a1a1a'; cx.textAlign = 'left'; cx.fillText(p, x, top + i * lh); x += cx.measureText(p).width; });
    });
  };
  for (const o of ops) { if (o.body !== undefined) drawBody(o); else if (o.style === 'title') drawTitle(o); else drawPlain(o); }
  return cv.toDataURL('image/jpeg', 0.92);
};

(async () => {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const fontDir = opt('--font-dir');
  const outDir = opt('--out');
  if (!fontDir || !outDir) { console.log('使い方: --font-dir <dir> --out <フォルダ> [--all | カード番号...]'); process.exit(1); }
  const cards = loadCards();
  const want = args.includes('--all') ? Object.keys(cards) : args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--font-dir' && args[i - 1] !== '--out');
  let playwright;
  try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch { playwright = require('playwright'); }
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.goto('about:blank');
  fs.mkdirSync(outDir, { recursive: true });
  const fileUrl = (p) => `data:font/woff2;base64,${fs.readFileSync(p).toString('base64')}`;
  const fontUrls = { 500: fileUrl(path.join(fontDir, 'noto-sans-jp-japanese-500-normal.woff2')), 900: fileUrl(path.join(fontDir, 'noto-sans-jp-japanese-900-normal.woff2')) };
  for (const no of want) {
    const c = cards[no];
    if (!c) { console.log(`知らないカード: ${no}`); continue; }
    const layout = LAYOUTS[c.layout === 'field' && fs.existsSync(path.join(SRC, c.folder, 'hi', c.file)) ? 'fieldHi' : c.layout];
    if (!layout) { console.log(`まだ配置を決めていない: ${no}(${c.layout})`); continue; }
    const src = path.join(SRC, c.folder, c.file);
    // 全体カードは、先に枠にそろえた絵(card-image-build.js の normalizeField)に描く。高画質版(breeder-field/hi/)があれば、上半分だけそちらに替える
    const hi = c.layout === 'field' ? path.join(SRC, c.folder, 'hi', c.file) : null;
    const useHi = !!hi && fs.existsSync(hi);
    let buf = c.layout === 'field' ? await normalizeField(src) : fs.readFileSync(src);
    if (useHi) {
      const [sy, dy] = FIELD_HI_FIT[path.basename(c.file, '.jpg')] || [1, 0];
      const hiBuf = await sharp(await normalizeField(hi)).resize(W, Math.round(H * sy), { fit: 'fill' }).toBuffer();
      const top = await sharp(hiBuf).extract({ left: 0, top: -dy, width: W, height: FIELD_HI_SEAM }).toBuffer();
      buf = await sharp(buf).composite([{ input: top, left: 0, top: 0 }]).png().toBuffer();
    }
    const imgUrl = `data:image/${c.layout === 'field' ? 'png' : 'jpeg'};base64,${buf.toString('base64')}`;
    const ops = layout.draw(c);
    const data = await page.evaluate(pageScript, { imgUrl, fontUrls, layout: { erase: layout.erase.map((e) => (typeof e === 'function' ? e(c) : e)) }, ops });
    fs.writeFileSync(path.join(outDir, c.file), Buffer.from(data.split(',')[1], 'base64'));
    console.log(`書き出し: ${c.file}(${c.name})`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
