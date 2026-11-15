'use strict';
// モンサクのボタンの中の文字・記号が、実際に描いた画素で真ん中にあるかを測る(r1115-066 社長「プラスマイナスの位置ずれ。ちゃんとして」)。
//   CSS の指定でなく、画面を撮って、ボタンの中の「字・記号の画素」の外枠の中心と、ボタンの中心の差を見る(±TOL px まで)。
//   フォントの「−」「＋」は字の幅に余白があり、CSS では真ん中でも見た目がずれるので、記号は線で描く(.msx .sym)。
// 使い方: const bad = await measureBtnPixels(page); → ずれたボタンの説明の配列(空なら OK)
const path = require('path');
const TOL = 1.5; // 記号(線で描く物)
const TOL_TEXT = 2.5; // 文字(字体によって上下の余白の取り方が 1〜2px 違う)
let sharp = null;
try { sharp = require(path.resolve(__dirname, '..', 'node_modules', 'sharp')); } catch (e) { sharp = null; }

// ページの中で: 見る対象のボタンの箱(画面の座標)を集める
function collectBtns() {
  const root = document.querySelector('.msx'); if (!root) return [];
  const out = [];
  root.querySelectorAll('button, .v-ft span').forEach((b) => {
    const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
    if (r.width < 14 || r.height < 14 || cs.visibility === 'hidden' || cs.display === 'none') return;
    if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return; // 画面の外・切れている物は撮れない
    if (b.hasAttribute('data-msx-left')) return;
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); if (!top || !(top === b || b.contains(top))) return; // 吹き出し・幕に隠れた物は測らない
    if (b.querySelector('img, svg, canvas, [style*="background"]')) return;
    const txt = (b.innerText || '').replace(/\s+/g, '');
    const ok = b.classList.contains('sym') || txt.length <= 4 || b.matches('.chip, .go, .msx-md-alt, .v-ft button, .v-ft span, .btn, .btn2, .btn3');
    if (!ok) return;
    if (!txt && !b.classList.contains('sym')) return;
    // 下にだけ太いふち(押した感じの 3D)の札は、ふちを除いた「面」の真ん中で測る
    const bb = parseFloat(cs.borderBottomWidth) || 0; const bt = parseFloat(cs.borderTopWidth) || 0; const dh = Math.max(0, bb - bt);
    // 測る枠は、ふち・角丸の内側だけ(ふちの曲がりを字と見間違えない)
    const rad = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, Math.min(r.width, r.height) / 2);
    const m = Math.max(Math.max(bb, bt, parseFloat(cs.borderLeftWidth) || 0) + 2, rad * 0.4 + Math.max(bb, bt) + 1, 3);
    out.push({ m0: Math.max(bb, bt, parseFloat(cs.borderLeftWidth) || 0) + 2, sym: b.classList.contains('sym'), m, x: r.left, y: r.top, w: r.width, h: r.height - dh, name: (txt || b.getAttribute('aria-label') || '').slice(0, 10) });
  });
  return out;
}

async function measureBtnPixels(page) {
  if (!sharp) return [];
  const list = await page.evaluate(collectBtns);
  if (!list.length) return [];
  const png = await page.screenshot();
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const sc = info.width / page.viewportSize().width; const ch = info.channels;
  const bad = [];
  for (const b of list) {
    const x0 = Math.round((b.x + b.m) * sc), x1 = Math.round((b.x + b.w - b.m) * sc), y0 = Math.round((b.y + b.m) * sc), y1 = Math.round((b.y + b.h - b.m) * sc);
    if (x1 - x0 < 4 || y1 - y0 < 4) continue;
    const px = (x, y) => { const i = (y * info.width + x) * ch; return [data[i], data[i + 1], data[i + 2]]; };
    // 地の色 = 行ごと・列ごとの中央値(横や縦にグラデーションのあるボタンでも、字だけを拾う)。両方と違う画素を「字・記号」にする
    const med = (arr) => { arr.sort((p, q) => p - q); return arr[arr.length >> 1]; };
    // 地の色の見積もりは、ボタンの内側いっぱい(ふちの内側まで)の行・列の中央値。字より広い範囲で取るので、字・記号が半分を超えても地と取り違えない
    const wx0 = Math.round((b.x + b.m0) * sc), wx1 = Math.round((b.x + b.w - b.m0) * sc), wy0 = Math.round((b.y + b.m0) * sc), wy1 = Math.round((b.y + b.h - b.m0) * sc);
    const rowBg = [], colBg = [];
    for (let y = y0; y < y1; y += 1) { const ch3 = [[], [], []]; for (let x = wx0; x < wx1; x += 1) { const c = px(x, y); for (let k = 0; k < 3; k++) ch3[k].push(c[k]); } rowBg[y - y0] = ch3.map(med); }
    for (let x = x0; x < x1; x += 1) { const ch3 = [[], [], []]; for (let y = wy0; y < wy1; y += 1) { const c = px(x, y); for (let k = 0; k < 3; k++) ch3[k].push(c[k]); } colBg[x - x0] = ch3.map(med); }
    const dist = (c, g) => Math.abs(c[0] - g[0]) + Math.abs(c[1] - g[1]) + Math.abs(c[2] - g[2]);
    let L = 1e9, R = -1, T = 1e9, B = -1;
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) { const c = px(x, y); if (dist(c, rowBg[y - y0]) > 60 && dist(c, colBg[x - x0]) > 60) { if (x < L) L = x; if (x > R) R = x; if (y < T) T = y; if (y > B) B = y; } }
    if (R < 0) continue; // 字の画素が見つからない(押せない暗い札など)は測れない
    const cx = ((L + R + 1) / 2) / sc, cy = ((T + B + 1) / 2) / sc;
    const dx = cx - (b.x + b.w / 2), dy = cy - (b.y + b.h / 2);
    const tol = b.sym ? TOL : TOL_TEXT;
    if (process.env.MSX_PX_DEBUG && (Math.abs(dx) > tol || Math.abs(dy) > tol)) console.log("DBG", b.name, JSON.stringify(b), "ink", L / sc, R / sc, T / sc, B / sc);
    if (Math.abs(dx) > tol || Math.abs(dy) > tol) bad.push(`${b.name}(横${dx.toFixed(1)}・縦${dy.toFixed(1)})`);
  }
  return bad;
}
module.exports = { measureBtnPixels, TOL };
