// 文字の折り返しの見張り(見た目係)。画面の文字を1文字ずつの位置で見て、次の崩れを探す。
//   ・値の途中で行が割れている      「0/4」「Lv.12」「1,200」のように、ひと続きの値が2行に割れた
//   ・数だけが次の行へ落ちている    「マスモン」と「0/4」のように、見出しと数が別の行になった(2026-10-09 ユーザー指摘)
//   ・短い札の最後が1〜2字だけ落ちた  ボタン・札のような短い文字で、行の最後に1〜2字だけ残った
//   ・隣り合う要素の値が別の行へ落ちた  横に並べたつもりの「見出し」と「値」の段がずれた
//   ・文字が画面の外・枠の外へはみ出した / 「…」で切れて読めない
// ブラウザの中で動く関数 1 つ(page.evaluate に渡す)。結果は { kind, text, where, detail } の配列。
const SCAN = () => {
  const out = [];
  const seen = new Set();
  const vw = window.innerWidth, vh = window.innerHeight;
  const TOKEN = /[0-9A-Za-z.,%:+\-×/]/;           // 途中で割れてほしくない「値」の字
  const NUMLIKE = /^[0-9.,%:+\-×/xX]+$/;           // 数だけ(0/4, 12, 3.5, 1,200)
  const where = (el) => {
    const parts = [];
    for (let e = el, n = 0; e && e !== document.body && n < 3; e = e.parentElement, n++) {
      let s = e.tagName.toLowerCase();
      const attr = [...e.attributes].find((a) => /^data-/.test(a.name));
      if (attr) s += `[${attr.name}]`;
      parts.unshift(s);
    }
    return parts.join('>');
  };
  const add = (kind, text, el, detail) => {
    const key = `${kind}|${text}|${where(el)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, text: text.slice(0, 40), where: where(el), detail });
  };
  const visible = (el) => {
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // 文字の行ごとの文字列(1文字ずつの上端で行を分ける。要素の直下の文字をつなげて見る:
  //   JSX の「マスモン {n}/{max}」は文字が何個にも分かれて入っているため)
  const linesOf = (nodes) => {
    const range = document.createRange();
    const lines = [];
    let curTop = null, cur = '';
    for (const node of nodes) {
      const text = node.textContent;
      for (let i = 0; i < text.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const rects = range.getClientRects();
        if (!rects.length) { cur += text[i]; continue; }
        const r = rects[0];
        if (r.width === 0 && /\s/.test(text[i])) { cur += text[i]; continue; }
        const top = Math.round(r.top);
        if (curTop === null) curTop = top;
        else if (Math.abs(top - curTop) > Math.max(4, r.height * 0.5)) { lines.push(cur); cur = ''; curTop = top; }
        cur += text[i];
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (/^(SCRIPT|STYLE|NOSCRIPT)$/.test(el.tagName)) continue;
    const nodes = [...el.childNodes].filter((n) => n.nodeType === 3);
    if (!nodes.some((n) => n.textContent.trim())) continue;
    if (!visible(el) || el.closest('[aria-hidden="true"]')) continue;
    const box = el.getBoundingClientRect();
    if (box.bottom < 0 || box.top > vh * 3) continue;
    const lines = linesOf(nodes);
    const trimmed = lines.map((l) => l.replace(/\s+$/g, '')).map((l) => l.replace(/^\s+/, ''));
    if (lines.length >= 2) {
      // 値の途中で割れた: 前の行の終わりと次の行の頭が、どちらも「値の字」でつながっている
      for (let i = 1; i < lines.length; i++) {
        const a = lines[i - 1], b = lines[i];
        if (/\s$/.test(a) || /^\s/.test(b)) continue;       // 空白で割れたのは普通の折り返し
        if (TOKEN.test(a.slice(-1)) && TOKEN.test(b[0]) && /[0-9]/.test(a.slice(-1) + b[0])) add('値の途中で折り返し', `${trimmed[i - 1]}⏎${trimmed[i]}`, el, `「${trimmed[i - 1].slice(-6)}」と「${trimmed[i].slice(0, 6)}」の間で行が割れている`);
      }
      const last = trimmed[trimmed.length - 1];
      const total = trimmed.join('');
      if (NUMLIKE.test(last) && trimmed.length === 2 && total.length <= 24) add('数だけが次の行へ落ちている', trimmed.join(' ⏎ '), el, `「${trimmed[0]}」の次の行に「${last}」だけが落ちている`);
      else if (total.length <= 16 && last.length <= 2 && trimmed.length >= 2 && (el.closest('button') || el.closest('[role="button"]'))) add('札の最後だけ落ちた', trimmed.join(' ⏎ '), el, `ボタンの文字の最後の「${last}」だけが次の行に落ちている`);
    }
    // 画面の外・枠の外へはみ出した
    const range = document.createRange();
    range.setStartBefore(nodes[0]); range.setEndAfter(nodes[nodes.length - 1]);
    const rr = range.getBoundingClientRect();
    if (rr.width > 0 && (rr.right > vw + 1 || rr.left < -1) && lines.length) add('画面の外へはみ出した文字', trimmed.join(' ').slice(0, 30), el, `文字が画面の幅(${vw}px)の外へ ${Math.round(Math.max(rr.right - vw, -rr.left))}px はみ出している`);
    // 「…」で切れて読めない(text-overflow:ellipsis)
    for (let e = el, n = 0; e && e !== document.body && n < 4; e = e.parentElement, n++) {
      const st = getComputedStyle(e);
      if (st.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) {
        add('…で切れた文字', (e.innerText || '').replace(/\s+/g, ' ').slice(0, 30), e, `幅 ${e.clientWidth}px に対して文字が ${e.scrollWidth}px ある`);
        break;
      }
    }
  }
  // 横に並べたつもりの「見出し」と「値」が別の行へ落ちた(折り返す flex の、短い数だけの子)
  for (const p of document.querySelectorAll('body *')) {
    if (!visible(p)) continue;
    const st = getComputedStyle(p);
    if (!(st.display.includes('flex') && st.flexWrap !== 'nowrap' && st.flexDirection.startsWith('row'))) continue;
    const kids = [...p.children].filter((c) => visible(c) && (c.innerText || '').trim());
    if (kids.length < 2 || kids.length > 4) continue;
    for (let i = 1; i < kids.length; i++) {
      const prev = kids[i - 1].getBoundingClientRect(), cur = kids[i].getBoundingClientRect();
      const t = (kids[i].innerText || '').trim();
      if (cur.top > prev.bottom - 2 && NUMLIKE.test(t) && t.length <= 8 && (kids[i - 1].innerText || '').trim().length <= 12) add('値が別の行へ落ちている', `${(kids[i - 1].innerText || '').trim()} ⏎ ${t}`, p, `見出し「${(kids[i - 1].innerText || '').trim()}」と値「${t}」が別の行になっている`);
    }
  }
  return out;
};

async function scanTextWrap(page) {
  return page.evaluate(SCAN).catch(() => []);
}

module.exports = { scanTextWrap };
