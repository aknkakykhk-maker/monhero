// 検査部ミハリが 2026-11-07 の通し検査で使った数え方(Playwright の page を渡す)。
// 名前が途中で折れている所・箱で切れている文字・「子」・「ブリーダー」呼びを数える。検査に足すときの種にする。
// 名前が途中で折れている・文字が箱で切れている を探す
const NAMES = ['みゅあ','きき','ももすけ','ドラ','あつ','きゅうこ','ソラシド','えるびん','助手ライフ','モンヒロビート','MFバトルカード'];
const lint = (page, scopeSel = 'body') => page.evaluate(({ NAMES, scopeSel }) => {
  const out = { brokenNames: [], clipped: [], ko: [], breeder: [] };
  const scope = document.querySelector(scopeSel) || document.body;
  const vis = (el) => { const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) {
    const t = n.nodeValue; if (!t || !t.trim()) continue; const el = n.parentElement; if (!el || !vis(el)) continue;
    for (const nm of NAMES) { let i = -1; while ((i = t.indexOf(nm, i + 1)) >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + nm.length); const rects = [...r.getClientRects()].filter(x => x.width > 0.5); const tops = new Set(rects.map(x => Math.round(x.top))); if (tops.size > 1) out.brokenNames.push({ name: nm, text: t.slice(0, 60) }); } }
    if (/ブリーダー(さん|くん|ちゃん)?[、。！!？?]|ブリーダーさん/.test(t)) out.breeder.push(t.slice(0, 80));
    if (/(この|あの|その|どの|うちの|ほかの|他の)子|子たち|子が|子を|子に|子は|子も/.test(t) && !/(様子|調子|椅子|菓子|子ども|男の子|女の子|息子|弟子|帽子|団子|格子|拍子|振り子|子守)/.test(t)) out.ko.push(t.slice(0, 80));
  }
  // 箱で切れている文字
  for (const el of scope.querySelectorAll('*')) {
    if (!vis(el)) continue; const s = getComputedStyle(el);
    const hasText = [...el.childNodes].some(c => c.nodeType === 3 && c.nodeValue.trim());
    if (!hasText) continue;
    const clipX = (s.overflowX === 'hidden' || s.overflow === 'hidden' || s.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1;
    const clipY = (s.overflowY === 'hidden' || s.overflow === 'hidden') && el.scrollHeight > el.clientHeight + 2;
    const r = el.getBoundingClientRect();
    const off = r.right > innerWidth + 1 || r.left < -1;
    if (clipX || clipY || off) out.clipped.push({ text: el.innerText.slice(0, 40), why: [clipX && 'X', clipY && 'Y', off && 'off'].filter(Boolean).join(''), w: Math.round(el.clientWidth), sw: el.scrollWidth });
  }
  return out;
}, { NAMES, scopeSel });
module.exports = { lint, NAMES };
