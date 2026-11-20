'use strict';
// モンサクの画面の決まり(docs/spec/MONSUC_UI.md)の機械の見張り。success-shoot.js・success-r3-shoot.js がページの中で回す。
//   ・下の空き: 本体(.v-body)の中身のいちばん下と、ボタンの列(.v-ft)の上のあいだが 48px を超えない(縦画面だけ)
//   ・見せ場の数字: .v-num の数字が、札の真ん中から 6px 以上ずれない
//   ・ボタンの文字: ボタンの中の文字・記号が上下左右とも真ん中(3px まで)
// 使い方: const m = await page.evaluate(msxUiRulesMeasure); 戻りは { blank, blankOk, offNum: [...] }
const BLANK_MAX = 48;
const NUM_OFF_MAX = 6;

// ページの中で動く(外の変数を使わない)
function msxUiRulesMeasure() {
  const root = document.querySelector('.msx');
  if (!root) return null;
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const body = [...root.querySelectorAll('.v-body')].filter(vis).pop();
  const ft = [...root.querySelectorAll('.v-ft')].filter(vis).pop();
  let blank = null;
  if (body && ft && window.innerHeight > window.innerWidth && body.scrollHeight <= body.clientHeight + 2) {
    // display:contents の器(開始の段の .v-lmain)は箱を作らないので、その中身を子として数える
    const flat = (els) => els.flatMap((e) => (getComputedStyle(e).display === 'contents' ? flat([...e.children]) : [e]));
    const kids = flat([...body.children]).filter((e) => vis(e) && getComputedStyle(e).position !== 'absolute' && getComputedStyle(e).position !== 'fixed');
    // 中身の無い空き箱(押し下げ用の <div style="flex:1"/>)は中身に数えない
    const real = kids.filter((e) => e.children.length || (e.innerText || '').trim() || e.tagName === 'IMG');
    if (real.length) blank = Math.round(ft.getBoundingClientRect().top - Math.max(...real.map((e) => e.getBoundingClientRect().bottom)));
  }
  const offNum = [...root.querySelectorAll('.v-num')].filter(vis).map((n) => {
    const b = n.querySelector(':scope > b'); if (!b) return null;
    const R = n.getBoundingClientRect(); const r = b.getBoundingClientRect();
    const off = Math.abs((r.left + r.right) / 2 - (R.left + R.right) / 2);
    return off >= 6 ? `${(b.innerText || '').trim().slice(0, 12)}(${Math.round(off)}px)` : null;
  }).filter(Boolean);
  // ボタンの中の文字・記号が、ボタンの真ん中(上下左右)から 3px 以上ずれていないか(r1115-066)。中身は Range で測る
  //   左寄せが決まりの行ボタン(幅 260px 超・data-msx-left 付き)は外す
  const offBtn = [...root.querySelectorAll('button, .v-ft span, .btn, .btn2, .btn3')].filter(vis).map((b) => {
    if (b.hasAttribute('data-msx-left')) return null;
    // 見るのは、記号・短い字(4字まで)のボタンと、チップ・主なボタン・下のボタンの列。絵やゲージを含む札・長い選択肢の行は外す
    if (b.querySelector('img, svg, canvas, [style*="background"]')) return null; // 絵・染め色の見本を持つ札は対象外
    if (!((b.innerText || '').replace(/\s+/g, '').length <= 4 || b.matches('.chip, .go, .msx-md-alt, .v-ft button, .v-ft span, .btn, .btn2, .btn3'))) return null;
    const R = b.getBoundingClientRect(); if (R.width > 260 && R.height > 70) return null;
    // 文字の箱だけを測る(角に重ねたバッジ・絶対配置の物は、中身の真ん中の対象にしない)
    const rs = []; const walk = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (!(n.nodeValue || '').trim()) continue;
      let abs = false; for (let e = n.parentElement; e && e !== b; e = e.parentElement) { if (getComputedStyle(e).position === 'absolute') { abs = true; break; } }
      if (abs) continue;
      const rg = document.createRange(); rg.selectNodeContents(n); rs.push(...[...rg.getClientRects()].filter((q) => q.width > 0 && q.height > 0));
    }
    if (!rs.length) return null;
    const L = Math.min(...rs.map((q) => q.left)); const Rr = Math.max(...rs.map((q) => q.right)); const T = Math.min(...rs.map((q) => q.top)); const B = Math.max(...rs.map((q) => q.bottom));
    const dx = (L + Rr) / 2 - (R.left + R.right) / 2; const dy = (T + B) / 2 - (R.top + R.bottom) / 2;
    return Math.abs(dx) >= 3 || Math.abs(dy) >= 3 ? `${(b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 10)}(横${Math.round(dx)}・縦${Math.round(dy)})` : null;
  }).filter(Boolean);
  return { blank, offNum, offBtn };
}

module.exports = { msxUiRulesMeasure, BLANK_MAX, NUM_OFF_MAX };

// 横に送れる帯(タブ・カルーセル)の中の文字は、画面の外にあって当然なので、折れの見張りから外すための一覧
function msxScrollStripTexts() {
  const out = [];
  document.querySelectorAll('.msx *').forEach((e) => {
    for (let p = e.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth + 2) { const t = (e.innerText || '').replace(/\s+/g, ' ').trim(); if (t) out.push(t); break; }
    }
  });
  return out;
}
module.exports.msxScrollStripTexts = msxScrollStripTexts;
