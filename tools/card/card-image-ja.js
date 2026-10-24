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
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'tools', 'art-sources', 'card-battle');
const W = 742, H = 1038;
const KIND_JA = { DGE: '回避', BLK: '防御', SPE: '特殊', POW: 'ちから', INT: 'かしこさ' };
const TYPE_JA = { G: '地上', A: '空中', W: '水中' };

// ---- 配置(英語版の絵を測って決めた。座標は 742×1038 の元の絵の上) ----
// 消す所: rect … 範囲 / keep … 「字でない」と見なす色(その行の、この色の点の真ん中の色で、ほかの点を埋める)
//   light … 明るい地(白・しま模様)/ colored … 色の濃い地(種類の札の中)/ dark … 暗い地(ブリーダーの題字のうしろ)
const LAYOUTS = {
  any: {
    erase: [
      { name: 'title', rect: [205, 48, 486, 142], keep: 'light' },
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
      { name: 'title', rect: [208, 50, 340, 136], keep: 'dark', dir: 'col' },
      { name: 'kind', rect: [74, 80, 171, 200], keep: 'colored' },
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
  // 混血のモンスター(左上「メイン」の札・右上の特徴の丸・右下「サブ」の札・左下の名前)
  hybrid: {
    erase: [
      { name: 'main', rect: [68, 74, 180, 131], keep: 'colored' },
      { name: 'type', rect: [554, 83, 660, 187], keep: 'colored', shape: 'circle' },
      { name: 'sub', rect: [600, 782, 676, 840], keep: 'colored' },
      { name: 'name', rect: [64, 920, 236, 959], keep: 'colored', dir: 'col' },
    ],
    draw: (c) => [
      { t: c.main || '', x: 76, y: 101, size: 23, weight: 900, align: 'left', style: 'title', sw: 5, maxW: 100 },
      { t: 'メイン', x: 76, y: 126, size: 19, weight: 900, align: 'left', style: 'title', sw: 5 },
      ...kindLines(TYPE_JA[c.type] || c.type, 607, 136, 38, 1.06),
      { t: 'サブ', x: 668, y: 806, size: 19, weight: 900, align: 'right', style: 'title', sw: 5 },
      { t: c.sub || '', x: 668, y: 833, size: 23, weight: 900, align: 'right', style: 'title', sw: 5, maxW: 70 },
      { t: c.name, x: 76, y: 953, size: 32, weight: 900, align: 'left', style: 'title', maxW: 160 },
    ],
  },
};
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
    (j.skills || []).forEach((k) => { out[k.no] = { no: k.no, folder, layout, file: `${k.no}.jpg`, name: k.name, text: k.text || '', kind: k.kind_en || '', guts: k.guts }; });
    (j.monsters || j.monster || []).forEach((m) => { if (!m.excluded) out[m.no] = { no: m.no, folder, layout, file: m.img || `${m.no.replace('-', '')}.jpg`, name: m.name, type: m.type_en || m.type, main: m.main, sub: m.sub }; });
  };
  add('any-monster', 'any');
  if (fs.existsSync(path.join(SRC, 'breeder', 'cards.json'))) add('breeder', 'breeder');
  if (fs.existsSync(path.join(SRC, 'hybrid', 'cards.json'))) add('hybrid', 'hybrid');
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
    colored: (r, g, b) => sat(r, g, b) > 70 && lum(r, g, b) > 40 && lum(r, g, b) < 215,
    dark: (r, g, b) => lum(r, g, b) > 45 && lum(r, g, b) < 225 && sat(r, g, b) < 45, // 灰色の地(白い字と黒いふちを除く)
  };
  for (const e of layout.erase) {
    const [x0, y0, x1, y1] = e.rect;
    const w = x1 - x0, h = y1 - y0;
    const id = cx.getImageData(x0, y0, w, h); const d = id.data;
    if (e.from === 'bottom') {
      const below = cx.getImageData(x0, y1, w, 2).data;
      for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
        let sum = 0, n = 0;
        for (let dx = -3; dx <= 3; dx++) { const xx = Math.min(w - 1, Math.max(0, x + dx)); for (let yy = 0; yy < 2; yy++) { sum += below[(yy * w + xx) * 4 + c]; n++; } }
        for (let y = 0; y < h; y++) d[(y * w + x) * 4 + c] = Math.round(sum / n);
      }
      cx.putImageData(id, x0, y0);
      continue;
    }
    const keep = keepOf[e.keep];
    const inShape = (x, y) => {
      if (e.shape === 'circle') return (x - w / 2) ** 2 + (y - h / 2) ** 2 <= (Math.min(w, h) / 2) ** 2;
      if (e.shape !== 'stadium') return true;
      const r = w / 2; const cxx = w / 2;
      if (y < r) return (x - cxx) ** 2 + (y - r) ** 2 <= r * r;
      if (y > h - r) return (x - cxx) ** 2 + (y - (h - r)) ** 2 <= r * r;
      return true;
    };
    // 字の点(地の色でない点)を印にし、まわり grow 点ぶんも広げる(字のふちの薄い線を残さない)
    const grow = e.grow ?? 2;
    const raw = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; raw[y * w + x] = inShape(x, y) && !keep(d[i], d[i + 1], d[i + 2]) ? 1 : 0; }
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inShape(x, y)) continue;
      let on = 0;
      for (let dy = -grow; dy <= grow && !on; dy++) for (let dx = -grow; dx <= grow; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && raw[yy * w + xx]) { on = 1; break; } }
      mask[y * w + x] = on;
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
      seg.forEach((x) => { cur += x; if (/[、。をはがにでともへのや」)]$/.test(cur)) { out.push(cur); cur = ''; } });
      if (cur) out.push(cur);
      return out;
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
    const layout = LAYOUTS[c.layout];
    if (!layout) { console.log(`まだ配置を決めていない: ${no}(${c.layout})`); continue; }
    const src = path.join(SRC, c.folder, c.file);
    const imgUrl = `data:image/jpeg;base64,${fs.readFileSync(src).toString('base64')}`;
    const ops = layout.draw(c);
    const data = await page.evaluate(pageScript, { imgUrl, fontUrls, layout: { erase: layout.erase }, ops });
    fs.writeFileSync(path.join(outDir, c.file), Buffer.from(data.split(',')[1], 'base64'));
    console.log(`書き出し: ${c.file}(${c.name})`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
