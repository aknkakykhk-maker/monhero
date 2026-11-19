// 見た目の点検(r1119-014 PR3): 撮った画面に機械でかける見つけ方。
//
//   measurePage(page)        … ページの中で測る(画面の文の変な字・字と字/字と絵の重なり・横はみ出し・文字の箱と色)
//   contrastFromPixels(...)  … 撮った画素から、文字の後ろの地の色を取り、文字色とのコントラスト比を出す
//   diffAgainst(...)         … 前の版の止め絵と比べ、変わった割合を出す(縮めた白黒で比べる。tools/playbot/scenarios/look.js と同じ考え)
//
// どれも「合否」ではなく「見つけた物の候補」を返す。優先度は visual-shoot.js が決める。
'use strict';

// 画面の文に出てはいけない字(未置換の変数・型の名前・文字化け)
const BAD_TEXT = /\bundefined\b|\bNaN\b|\bnull\b|\[object [A-Za-z]+\]|\$\{|\{\{|\}\}|�|Infinity/;

async function measurePage(page) {
  return page.evaluate((badSrc) => {
    const bad = new RegExp(badSrc);
    const WORD = /[\p{L}\p{N}]/u;
    const W = innerWidth, H = innerHeight;
    const vis = (r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W;
    const shown = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const st = getComputedStyle(e);
        if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
      }
      return true;
    };
    const pathOf = (el) => {
      const parts = [];
      for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
        const cls = (typeof e.className === 'string' ? e.className : '').split(/\s+/).filter((c) => c && !/[:[\]/]/.test(c)).slice(0, 2).join('.');
        parts.unshift(e.tagName.toLowerCase() + (cls ? '.' + cls : ''));
      }
      return parts.join('>');
    };
    // その要素が乗っている層(窓・固定の帯など、画面の上に重ねた物の根)。違う層どうしの重なりは「窓の下」なので数えない
    const layerOf = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        if (e.getAttribute && (e.getAttribute('role') === 'dialog' || e.getAttribute('aria-modal') === 'true')) return e;
        const st = getComputedStyle(e);
        if (st.position === 'fixed' || (st.position !== 'static' && (Number(st.zIndex) || 0) >= 20)) return e;
      }
      return null;
    };
    // 文字を直に持つ要素(葉に近い文字の箱)
    const leaves = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const el = n.parentElement;
      if (!el || seen.has(el) || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(el.tagName)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (!vis(r) || r.width < 2 || r.height < 4) continue;
      if (!shown(el)) continue;
      seen.add(el);
      const st = getComputedStyle(el);
      // 薄い飾り字(難易度の札の透かし文字など)は数えない
      let op = 1;
      for (let e = el; e && e !== document.body; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      const ca = (st.color.match(/rgba\([^)]*,\s*([\d.]+)\)/) || [])[1];
      if (op < 0.6 || (ca !== undefined && Number(ca) < 0.5)) continue;
      // 字の真ん中で一番上に描かれている物が、この字(か、その中の物)でなければ、窓・幕の下に隠れている
      const cx = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
      const topEl = document.elementFromPoint(cx, cy);
      const covered = !topEl || !(el.contains(topEl) || topEl.contains(el));
      leaves.push({ el, layer: layerOf(el), covered, text: t.slice(0, 60), r: { x: r.left, y: r.top, w: r.width, h: r.height }, color: st.color, size: parseFloat(st.fontSize) || 0,
        weight: Number(st.fontWeight) || 400, shadow: (st.textShadow && st.textShadow !== 'none') || (st.webkitTextStrokeWidth && parseFloat(st.webkitTextStrokeWidth) > 0) });
      if (leaves.length >= 400) break;
    }
    // ① 変な字
    const badText = leaves.filter((l) => bad.test(l.text)).map((l) => ({ text: l.text, where: pathOf(l.el), r: l.r }));
    // ② 字と字の重なり(親子ではない2つの文字の箱が、小さいほうの 35% 以上かぶる)
    const area = (r) => r.w * r.h;
    const inter = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const textOverlap = [];
    for (let i = 0; i < leaves.length && textOverlap.length < 20; i++) {
      for (let j = i + 1; j < leaves.length; j++) {
        const a = leaves[i], b = leaves[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (a.layer !== b.layer || a.covered || b.covered) continue;
        const ov = inter(a.r, b.r);
        if (ov < 30 || ov < 0.35 * Math.min(area(a.r), area(b.r))) continue;
        // 絵文字・記号だけの字(アイコンの代わり)は、字の箱が絵より広く出るので数えない
        if (!WORD.test(a.text) || !WORD.test(b.text)) continue;
        // かぶった所の真ん中で一番上に描かれているのがどちらかの字のときだけ(スクロールの外に隠れた字・飾りの層は数えない)
        const ix = Math.max(a.r.x, b.r.x), iy = Math.max(a.r.y, b.r.y);
        const iw = Math.min(a.r.x + a.r.w, b.r.x + b.r.w) - ix, ih = Math.min(a.r.y + a.r.h, b.r.y + b.r.h) - iy;
        const top = document.elementFromPoint(Math.min(W - 1, Math.max(0, ix + iw / 2)), Math.min(H - 1, Math.max(0, iy + ih / 2)));
        if (!top || !(a.el.contains(top) || b.el.contains(top) || top.contains(a.el) || top.contains(b.el))) continue;
        // それぞれの字の真ん中でも、一番上はその字か相手の字(窓・幕の下に隠れた字は数えない)
        const mine = (l) => { const t = document.elementFromPoint(Math.min(W - 1, Math.max(0, l.r.x + l.r.w / 2)), Math.min(H - 1, Math.max(0, l.r.y + l.r.h / 2)));
          return !!t && [a.el, b.el].some((e) => e.contains(t) || t.contains(e)); };
        if (!mine(a) || !mine(b)) continue;
        textOverlap.push({ a: a.text, b: b.text, where: pathOf(a.el), r: a.r, rate: Math.round(ov / Math.min(area(a.r), area(b.r)) * 100) });
        if (textOverlap.length >= 20) break;
      }
    }
    // ③ 字と絵の重なり(背景ではない小さめの絵が、文字の箱の 40% 以上にかぶり、しかも絵が文字より上に描かれている)
    const pics = [...document.querySelectorAll('img,svg,canvas,video')].map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ el, r }) => vis(r) && r.width >= 12 && r.height >= 12 && r.width * r.height < W * H * 0.25 && shown(el) && !el.closest('svg:not(:scope)'));
    const textImage = [];
    for (const l of leaves) {
      if (textImage.length >= 20) break;
      for (const p of pics) {
        if (p.el.contains(l.el) || l.el.contains(p.el)) continue;
        if (layerOf(p.el) !== l.layer) continue;
        const pr = { x: p.r.left, y: p.r.top, w: p.r.width, h: p.r.height };
        const ov = inter(l.r, pr);
        if (ov < 0.4 * area(l.r) || ov < 40) continue;
        // 文字の真ん中で一番上に描かれている物が絵なら、字が隠れている
        const cx = l.r.x + l.r.w / 2, cy = l.r.y + l.r.h / 2;
        const top = document.elementFromPoint(Math.min(W - 1, Math.max(0, cx)), Math.min(H - 1, Math.max(0, cy)));
        const hidden = top && (top === p.el || p.el.contains(top));
        if (!hidden) continue;
        textImage.push({ text: l.text, pic: p.el.tagName.toLowerCase() + (p.el.getAttribute('alt') ? `「${p.el.getAttribute('alt').slice(0, 20)}」` : ''), where: pathOf(l.el), r: l.r });
        break;
      }
    }
    // ④ 横のはみ出し(ページが画面より広い)
    const doc = document.documentElement;
    const overflowX = Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0) - W;
    // ⑤ 色の読みにくさを画素で測るための、文字の箱と文字色(影・縁どりのある字は除く)
    const forContrast = leaves.filter((l) => !l.shadow && !l.covered && l.r.w >= 8 && l.r.h >= 8 && l.text.replace(/[\s\p{P}\p{S}]/gu, '').length >= 1)
      .slice(0, 250).map((l) => ({ text: l.text, color: l.color, size: l.size, weight: l.weight, r: l.r, where: pathOf(l.el) }));
    const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').trim();
    return { badText, textOverlap, textImage, overflowX, forContrast, textLen: text.length, view: { w: W, h: H } };
  }, BAD_TEXT.source);
}

// ---- 色 ----
const parseRgb = (s) => { const m = String(s).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// 撮った画素(raw RGB)から、文字の箱の中で「文字色から遠い画素」の中央値を地の色とみなし、比を出す。
// 大きい字(24px 以上・太字 18.66px 以上)は 3:1、ふつうの字は 4.5:1 が目安だが、
// 見落としより空振りを嫌って、ここでは 大きい字 2:1・ふつうの字 2.5:1 を下回る物だけ返す(本当に読みにくい物だけ)
function contrastFromPixels(raw, info, scale, boxes) {
  const out = [];
  for (const bx of boxes) {
    const fg = parseRgb(bx.color);
    if (!fg || fg.a < 0.5) continue;
    const x0 = Math.max(0, Math.floor(bx.r.x * scale)), y0 = Math.max(0, Math.floor(bx.r.y * scale));
    const x1 = Math.min(info.width, Math.ceil((bx.r.x + bx.r.w) * scale)), y1 = Math.min(info.height, Math.ceil((bx.r.y + bx.r.h) * scale));
    if (x1 - x0 < 3 || y1 - y0 < 3) continue;
    const far = [];
    const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 600)));
    let near = 0, all = 0;
    for (let y = y0; y < y1; y += step) {
      for (let x = x0; x < x1; x += step) {
        const i = (y * info.width + x) * info.channels;
        const p = { r: raw[i], g: raw[i + 1], b: raw[i + 2] };
        all += 1;
        const d = Math.abs(p.r - fg.r) + Math.abs(p.g - fg.g) + Math.abs(p.b - fg.b);
        if (d < 60) near += 1; else far.push(p);
      }
    }
    if (far.length < 4) continue;
    // 地の色: 明るさの中央値の画素
    far.sort((a, b) => lum(a) - lum(b));
    const bg = far[Math.floor(far.length / 2)];
    const cr = ratio(fg, bg);
    const big = bx.size >= 24 || (bx.size >= 18.66 && bx.weight >= 700);
    const limit = big ? 2 : 2.5;
    // 地がまだらな所(絵の上の字)は、中央値が地を表さないことがあるので、文字色に近い画素が少なすぎる物は外す
    if (near / all < 0.03) continue;
    if (cr < limit) out.push({ text: bx.text, ratio: Math.round(cr * 100) / 100, fg: bx.color, bg: `rgb(${bg.r},${bg.g},${bg.b})`, size: bx.size, where: bx.where, r: bx.r });
  }
  return out;
}

// ---- 前の版との比べ ----
const DIFF_W = 120, PIXEL_DIFF = 40;
async function smallGray(sharp, input) {
  return sharp(input).resize(DIFF_W, DIFF_W, { fit: 'fill' }).grayscale().raw().toBuffer();
}
async function diffAgainst(sharp, nowPng, prevPng) {
  const [a, b] = await Promise.all([smallGray(sharp, nowPng), smallGray(sharp, prevPng)]);
  let d = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > PIXEL_DIFF) d += 1;
  return d / a.length;
}

module.exports = { measurePage, contrastFromPixels, diffAgainst, BAD_TEXT };
