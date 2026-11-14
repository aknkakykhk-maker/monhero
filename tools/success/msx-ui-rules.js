'use strict';
// モンサクの画面の決まり(docs/spec/MONSUC_UI.md)の機械の見張り。success-shoot.js・success-r3-shoot.js がページの中で回す。
//   ・下の空き: 本体(.v-body)の中身のいちばん下と、ボタンの列(.v-ft)の上のあいだが 48px を超えない(縦画面だけ)
//   ・見せ場の数字: .v-num の数字が、札の真ん中から 6px 以上ずれない
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
    const kids = [...body.children].filter((e) => vis(e) && getComputedStyle(e).position !== 'absolute' && getComputedStyle(e).position !== 'fixed');
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
  return { blank, offNum };
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
