#!/usr/bin/env node
// 画面の部品(DOM)から「大きさの釣り合い」を数字で測り、基準を外れた所を必ず指摘にする道具(2026-11-20 ミハリ・社長の目に合わせる)。
// API(絵を見る AI)に頼らない。止め絵を撮るときに一緒に測る。モンサク・モンビー・助手ライフのどの撮影にも付けられる。
//
// 測る物(基準は docs/progress/kensa/president-eye/README.md の較正で決めた。下の TH を直すときは、較正を回し直す):
//   大事なボタン … 決定・始める・次へ などの面積・画面に占める割合・高さ。ほかのボタンより小さくないか
//   下の空き     … いちばん下の部品から画面の下まで
//   大きな空き   … 部品の無い長方形のうち、いちばん大きい物(画面に占める割合)
//   小さい字     … 字の大きさのいちばん小さい所
//   小さい押す所 … 押せる物の幅か高さが 44px 未満
//   二重         … 同じ数字(+28・−16・30%・3/5)・同じ文が画面の中で2回以上
//   中央そろえ   … 2行以上の文が中央そろえ
//   言葉の途中   … 言葉(Intl.Segmenter の1語)の途中で行が折れる
//   中心のずれ   … 中央そろえの1行の字が、絵文字や字間のせいで枠の真ん中からずれる
//   暗幕の上     … 窓を開いたとき、暗幕の上に窓の外の部品(帯・タブなど)が出ていて押せる
//
// 使い方(撮影の道具から):
//   const uiMeasure = require('../browser/ui-measure');
//   await page.screenshot({ path: file }); await uiMeasure.record(page, file);   … <file のフォルダ>/_measure.jsonl に1行足す
//   UI_MEASURE=0 で止める。
// 使い方(手で):
//   node tools/browser/ui-measure.js --report <撮った置き場>         … _measure.jsonl を表にする
//   node tools/browser/ui-measure.js --url <URL> [--w 390 --h 844]   … その場で1枚測る(試し)
'use strict';
const fs = require('fs');
const path = require('path');

// 基準(仮で決め、較正で合わせた)。数字は CSS の px。縦 390×844 と PC 1280×800 の両方で使う
const TH = {
  primaryMinRatio: 0.018, // 大事なボタンが画面に占める割合の下限(縦 390×844 で約 5900px² ≒ 150×40)
  primaryMinH: 44, // 大事なボタンの高さの下限
  primaryVsOthers: 0.8, // 大事なボタンが、ほかのボタンの大きい方から2番目の面積のこれ倍より小さいと指摘
  bottomGapRatio: 0.15, // 下の空きが画面の高さのこれを超えると指摘(縦 844 で 127px)
  emptyRatio: 0.2, // いちばん大きい空きの長方形が画面のこれを超えると指摘
  emptyMinSide: 0.35, // 空きの長方形の短い辺が、画面の幅(縦)か高さ(横長)のこれ以上のときだけ数える(細い隙間は数えない)
  fontMin: 10, // 字の大きさの下限(px)
  tapMin: 44, // 押す所の幅・高さの下限
  tapHard: 30, // これ未満は「中」
  dupMin: 2, // 同じ数字・文がこの回数以上で指摘
  centerOffset: 4, // 中央そろえの1行の字の中心が枠の真ん中からこれ px 以上ずれたら指摘
};
const PRIMARY_RE = /^(決定|けってい|始める|はじめる|スタート|START|PLAY|プレイ|次へ|つぎへ|次に進む|進む|すすむ|OK|開始|育成開始|この子で|合体する|演奏する|挑戦する|出場する|エントリー|受付する|けっていする|これにする|つづける|続ける|確定|決める)/i;

// ページの中で動かす(page.evaluate に渡す)。戻り値は数字と見つけた物の生の材料
function measureInPage(TH, PRIMARY_SRC) {
  const PRIMARY = new RegExp(PRIMARY_SRC, 'i');
  const W = innerWidth, H = innerHeight;
  const vis = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return false;
    }
    return true;
  };
  const onScreen = (r) => r.width > 1 && r.height > 1 && r.right > 0 && r.bottom > 0 && r.left < W && r.top < H;
  const clip = (r) => ({ left: Math.max(0, r.left), top: Math.max(0, r.top), right: Math.min(W, r.right), bottom: Math.min(H, r.bottom) });
  const textOf = (el) => (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
  // 真ん中が本当にその部品か(窓の裏に隠れた物を数えない)
  const topAt = (el, r) => { const x = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(H - 1, Math.max(0, r.top + r.height / 2)); const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t) || t.contains(el)); };
  const out = { view: { w: W, h: H }, primary: null, buttons: [], bottomGap: 0, empty: null, fontMin: null, smallTaps: [], dups: [], centered: [], midword: [], offcenter: [], overBackdrop: [] };

  // 文字を持つ一番下の部品(葉)と、絵・押せる物を「中身」として集める
  const all = [...document.body.querySelectorAll('*')];
  const content = [];
  const textLeaves = [];
  for (const el of all) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HTML', 'BODY'].includes(el.tagName)) continue;
    const r = el.getBoundingClientRect();
    if (!onScreen(r)) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const media = ['IMG', 'SVG', 'CANVAS', 'VIDEO', 'svg'].includes(el.tagName);
    const bgImg = !ownText && !media && r.width * r.height < W * H * 0.6 && getComputedStyle(el).backgroundImage !== 'none';
    const isBtn = el.matches('button,[role=button],a[href],input,select,textarea');
    if (!(ownText || media || bgImg || isBtn)) continue;
    if (r.width >= W * 0.9 && r.height >= H * 0.9) continue; // 画面いっぱいの背景は中身に数えない
    if (!vis(el)) continue;
    content.push({ el, r, ownText, media, isBtn });
    if (ownText) textLeaves.push({ el, r });
  }

  // 1. 押せる物と大事なボタン
  const btns = [];
  for (const el of document.querySelectorAll('button,[role=button],a[href],input[type=button],input[type=submit]')) {
    const r = el.getBoundingClientRect();
    if (!onScreen(r) || !vis(el) || el.disabled) continue;
    if (!topAt(el, r)) continue;
    const t = textOf(el);
    btns.push({ el, r, t, area: Math.round(Math.min(r.width, W) * Math.min(r.height, H)) });
  }
  // 入れ子のボタン(ボタンの中のボタン)は外側だけ
  const btnsTop = btns.filter((b) => !btns.some((o) => o !== b && o.el.contains(b.el) && o.el !== b.el));
  out.buttons = btnsTop.map((b) => ({ t: b.t.slice(0, 16), w: Math.round(b.r.width), h: Math.round(b.r.height), area: b.area }));
  const prim = btnsTop.filter((b) => PRIMARY.test(b.t.replace(/^[^\p{L}\p{N}]+/u, ''))).sort((a, b) => b.area - a.area)[0];
  if (prim) {
    const others = btnsTop.filter((b) => b !== prim).map((b) => b.area).sort((a, b) => b - a);
    out.primary = { t: prim.t.slice(0, 16), w: Math.round(prim.r.width), h: Math.round(prim.r.height), area: prim.area, ratio: +(prim.area / (W * H)).toFixed(4), rankArea: others.filter((a) => a > prim.area).length + 1, secondOther: others[1] || others[0] || 0 };
  }
  for (const b of btnsTop) {
    const w = Math.round(b.r.width), h = Math.round(b.r.height);
    if (Math.min(w, h) < TH.tapMin) out.smallTaps.push({ t: b.t.slice(0, 12) || b.el.getAttribute('aria-label') || b.el.tagName.toLowerCase(), w, h });
  }

  // 2. 下の空き(中身のいちばん下)・3. 大きな空き(10px の升目で、中身の無い最大の長方形)
  let maxBottom = 0;
  const CELL = 10, cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL);
  const grid = Array.from({ length: rows }, () => new Uint8Array(cols));
  // ゲームの枠(中身の左右の端)。PC で枠の外の黒い所は空きに数えない
  const fl = Math.min(...content.map((c) => Math.max(0, c.r.left)), W), fr = Math.max(...content.map((c) => Math.min(W, c.r.right)), 0);
  out.frame = { left: Math.round(fl), right: Math.round(fr) };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if ((x + 1) * CELL <= fl || x * CELL >= fr) grid[y][x] = 1;
  for (const c of content) {
    const r = clip(c.r);
    if (r.bottom - r.top < 1) continue;
    maxBottom = Math.max(maxBottom, r.bottom);
    for (let y = Math.floor(r.top / CELL); y < Math.ceil(r.bottom / CELL) && y < rows; y++) for (let x = Math.floor(r.left / CELL); x < Math.ceil(r.right / CELL) && x < cols; x++) grid[y][x] = 1;
  }
  // 中身が画面の下へ続いている(スクロールで続く)なら下の空きは 0
  const scrolls = [document.scrollingElement, ...all.filter((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4; })];
  const continues = scrolls.some((e) => e && e.scrollHeight > e.clientHeight + 4 && e.getBoundingClientRect().bottom >= H - 20);
  out.bottomGap = continues ? 0 : Math.round(H - maxBottom);
  if (!content.length) out.bottomGap = 0;
  {
    const hgt = new Array(cols).fill(0);
    let best = { area: 0 };
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) hgt[x] = grid[y][x] ? 0 : hgt[x] + 1;
      const st = [];
      for (let x = 0; x <= cols; x++) {
        const hh = x < cols ? hgt[x] : 0;
        let start = x;
        while (st.length && st[st.length - 1][1] >= hh) {
          const [sx, sh] = st.pop();
          const wcells = x - sx;
          const FW = Math.max(1, fr - fl), minSide = Math.min(wcells * CELL, sh * CELL), need = Math.min(FW, H) * TH.emptyMinSide;
          if (sh * wcells > best.area && minSide >= need) best = { area: sh * wcells, x: sx * CELL, y: (y - sh + 1) * CELL, w: wcells * CELL, h: sh * CELL };
          start = sx;
        }
        st.push([start, hh]);
      }
    }
    if (best.area) out.empty = { x: best.x, y: best.y, w: Math.min(best.w, W - best.x), h: Math.min(best.h, H - best.y), ratio: +((Math.min(best.w, W - best.x) * Math.min(best.h, H - best.y)) / (Math.max(1, fr - fl) * H)).toFixed(3) };
  }
  // 列(縦に長い箱)ごとの下の空き: 画面を左右に分けた列で、片方だけ下が大きく空いている(モンビーの曲えらびの右側)
  {
    const cands = [];
    for (const el of all) {
      const r = el.getBoundingClientRect();
      const top = Math.max(0, r.top), bot = Math.min(H, r.bottom), hh = bot - top;
      if (hh < H * 0.55 || r.width < 120 || r.width > (fr - fl) * 0.8 || !vis(el)) continue;
      if (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight + 4) continue;
      const inner = content.filter((c) => el.contains(c.el) && c.el !== el);
      if (inner.length < 3) continue;
      const mb = Math.max(...inner.map((c) => Math.min(H, c.r.bottom)));
      const gap = Math.round(bot - mb);
      if (gap >= Math.max(150, hh * 0.3)) cands.push({ el, r, gap, hh, t: textOf(el).slice(0, 14) });
    }
    cands.sort((a, b) => a.r.width * a.r.height - b.r.width * b.r.height);
    const took = [];
    for (const c of cands) {
      if (took.some((t) => !(c.r.right <= t.r.left || c.r.left >= t.r.right))) continue;
      took.push(c);
    }
    out.colGaps = took.map((c) => ({ t: c.t, x: Math.round(c.r.left), w: Math.round(c.r.width), gap: c.gap, ratio: +(c.gap / c.hh).toFixed(2) }));
  }

  // 4. 小さい字
  for (const { el } of textLeaves) {
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (!t || !/[\p{L}\p{N}]/u.test(t) || /^VERSION\b/.test(t)) continue; // 隅の版の表示は数えない
    if (!out.fontMin || fs < out.fontMin.px) out.fontMin = { px: Math.round(fs * 10) / 10, t: t.slice(0, 16) };
  }

  // 5. 二重(同じ数字・同じ文)。入れ子は葉だけ数える
  const seen = new Map();
  const sig = new Map(); // 種類 → 部品の形(タグと class)。同じ形の札が並ぶ一覧の数字は二重と数えない
  let curSig = '';
  const add = (k, t) => { const v = seen.get(k) || seen.set(k, []).get(k); v.push(t); (sig.get(k) || sig.set(k, []).get(k)).push(curSig); };
  const NUM = /[+＋\-−▲▼][0-9０-９]+(?:\.[0-9]+)?%?|[0-9０-９]+(?:\.[0-9]+)?[%％]|(?<![\/0-9])[0-9]+\s*\/\s*[0-9]+(?![\/0-9])/g;
  const norm = (n) => n.replace(/[＋]/, '+').replace(/[−]/, '-').replace(/\s/g, '');
  const leafToks = new Map(textLeaves.map(({ el }) => { const t = textOf(el); return [el, { t, nums: new Set((t.match(NUM) || []).map(norm)) }]; }));
  for (const { el } of textLeaves) {
    const { t, nums } = leafToks.get(el);
    if (!t) continue;
    // ボタンの字そのもの(「+1」で振る など)は操作で、情報の二重ではない
    const btn = el.closest('button,[role=button]');
    if (btn && textOf(btn) === t && t.length <= 4) continue;
    const card = el.closest('li,button,[role=button],[class*=card],[class*=row]') || el.parentElement;
    curSig = `${el.tagName}.${el.className}|${card ? `${card.tagName}.${String(card.className).slice(0, 60)}` : ''}`;
    // 子の部品が持つ数字・文は子で数える(親と子で2回数えない)
    const kids = textLeaves.filter((o) => o.el !== el && el.contains(o.el)).map((o) => leafToks.get(o.el));
    for (const n of nums) if (!kids.some((k) => k.nums.has(n))) add(`数:${n}`, t.slice(0, 20));
    if (t.length >= 8 && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(t) && !kids.some((k) => k.t === t)) add(`文:${t}`, t.slice(0, 20));
  }
  for (const [k, v] of seen) if (v.length >= TH.dupMin && !(v.length >= 3 && new Set(sig.get(k)).size === 1)) out.dups.push({ k, n: v.length, where: [...new Set(v)].slice(0, 3) });
  out.dups.sort((a, b) => b.n - a.n || (/^数:[+-]\d{2,}/.test(b.k) ? 1 : 0) - (/^数:[+-]\d{2,}/.test(a.k) ? 1 : 0));
  if (TH.debug) out.texts = textLeaves.map(({ el, r }) => `${Math.round(r.left)},${Math.round(r.top)} ${textOf(el).slice(0, 40)}`);
  out.seenNums = [...seen.keys()].filter((k) => k.startsWith('数:')).slice(0, 80);

  // 6. 2行以上の中央そろえ・7. 言葉の途中の折り返し・8. 中心のずれ
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('ja', { granularity: 'word' }) : null;
  for (const { el, r } of textLeaves) {
    const cs = getComputedStyle(el);
    const nodes = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!nodes.length) continue;
    // 行ごとの位置(字ごとの矩形の上端で数える)
    const chars = [];
    for (const n of nodes) {
      const s = n.textContent;
      for (let i = 0; i < s.length; i++) {
        if (/\s/.test(s[i])) continue;
        const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
        const rr = rg.getClientRects()[0];
        if (rr && rr.width > 0) chars.push({ n, i, ch: s[i], top: Math.round(rr.top), left: rr.left, right: rr.right });
      }
    }
    if (chars.length < 2) continue;
    const lineTops = [];
    for (const c of chars) if (!lineTops.some((t) => Math.abs(t - c.top) < 4)) lineTops.push(c.top);
    const text = nodes.map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();
    const align = cs.textAlign;
    if (lineTops.length >= 2 && align === 'center' && text.length >= 8) out.centered.push({ t: text.slice(0, 24), lines: lineTops.length });
    if (lineTops.length >= 2 && seg) {
      for (const n of nodes) {
        const s = n.textContent;
        const bounds = new Set([0, s.length]);
        for (const g of seg.segment(s)) { bounds.add(g.index); bounds.add(g.index + g.segment.length); }
        const cs2 = chars.filter((c) => c.n === n);
        for (let k = 1; k < cs2.length; k++) {
          const a = cs2[k - 1], b = cs2[k];
          if (Math.abs(a.top - b.top) < 4) continue;
          if (b.i !== a.i + 1) continue; // 空白で折れた所は言葉の切れ目
          if (!bounds.has(b.i) && /[\p{L}]/u.test(a.ch) && /[\p{L}ー]/u.test(b.ch)) out.midword.push({ t: `${s.slice(Math.max(0, a.i - 6), a.i + 1)}/${s.slice(b.i, b.i + 6)}`.trim() });
        }
      }
    }
    if (lineTops.length === 1 && align === 'center') {
      // 字の見えている中心(字間の最後の分は引く)と、枠(行内の部品なら外の箱)の中身の真ん中
      let box = el;
      while (box.parentElement && getComputedStyle(box).display.startsWith('inline')) box = box.parentElement;
      const bcs = getComputedStyle(box), br = box.getBoundingClientRect();
      if (br.width >= W * 0.95) continue;
      const EMO = /\p{Emoji_Presentation}|\uFE0F/u;
      // 箱の中に、この字のほかは絵文字・記号だけ(ほかの字が並ぶ箱は比べない)
      const rest = (box.innerText || '').replace(text, '');
      if (/[\p{L}\p{N}]/u.test(rest)) continue;
      const ls = parseFloat(cs.letterSpacing) || 0;
      const glyphs = chars.filter((c) => !EMO.test(c.ch));
      // 絵文字のずれは見出しだけ(14px 以上の太字・ボタンの外)。片側にだけ絵文字があるとき。矢印(▶ など)は飾りの決まった形なので数えない
      const bt = (box.innerText || '').replace(/[▶◀▷◁→←]\uFE0F?/g, '').trim();
      const head = parseFloat(cs.fontSize) >= 14 && Number(cs.fontWeight) >= 700 && !el.closest('button,[role=button],a');
      const cps = Array.from(bt), lead = EMO.test(cps.slice(0, 2).join('')), tail = EMO.test(cps.slice(-2).join(''));
      const emoji = head && lead !== tail;
      if (!glyphs.length) continue;
      const l = Math.min(...glyphs.map((c) => c.left)), rr = Math.max(...glyphs.map((c) => c.right)) - ls;
      const boxMid = br.left + parseFloat(bcs.paddingLeft) + (br.width - parseFloat(bcs.paddingLeft) - parseFloat(bcs.paddingRight)) / 2;
      const d = (l + rr) / 2 - boxMid;
      if (Math.abs(d) >= TH.centerOffset && (emoji || ls >= 2)) out.offcenter.push({ t: text.slice(0, 16), dx: Math.round(d), why: emoji ? '絵文字' : `字間 ${Math.round(ls)}px` });
    }
  }

  // 10. 上が切れている: 画面の頭から撮っても、文字の部品や窓の上が画面の外へ出ている
  out.topCut = [];
  for (const { el, r } of textLeaves) if (r.top < -3 && r.bottom > 6) out.topCut.push({ t: textOf(el).slice(0, 14), y: Math.round(r.top) });
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'absolute') continue;
    const r = el.getBoundingClientRect();
    if (r.top < -6 && r.bottom > H * 0.3 && r.height > H * 0.4 && r.width > W * 0.5 && textOf(el) && vis(el)) out.topCut.push({ t: `窓「${textOf(el).slice(0, 12)}」`, y: Math.round(r.top) });
  }
  // 9. 暗幕の上: 画面の大半を覆う、暗い半透明の地の部品(暗幕)があるとき、その範囲で、暗幕でも窓でもない部品がいちばん上にある所
  const dark = all.filter((e) => {
    const cs = getComputedStyle(e);
    if (!/(fixed|absolute)/.test(cs.position)) return false;
    const r = e.getBoundingClientRect();
    if (r.width < W * 0.9 || r.height < H * 0.85) return false;
    const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(cs.backgroundColor);
    if (!m) return false;
    const a = m[4] === undefined ? 1 : Number(m[4]);
    const lum = (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3;
    return a >= 0.3 && a <= 0.92 && lum < 90 && vis(e);
  });
  const veil = dark[dark.length - 1];
  if (veil) {
    // 窓 = 画面の真ん中でいちばん上の部品の、暗幕の中の祖先(暗幕の外なら、真ん中の部品の一番外の fixed の祖先)
    const mid = document.elementFromPoint(W / 2, H / 2);
    let win = mid;
    while (win && win.parentElement && win.parentElement !== veil && win.parentElement !== document.body) {
      if (veil.contains(win) && win.parentElement === veil) break;
      win = win.parentElement;
    }
    const inModal = (t) => veil.contains(t) || (win && win.contains(t)) || t === veil;
    const hits = new Map();
    for (let y = 8; y < H; y += 24) for (let x = 8; x < W; x += 24) {
      const t = document.elementFromPoint(x, y);
      if (!t || inModal(t) || t === document.body || t === document.documentElement) continue;
      const b = t.closest('button,[role=button],a[href],nav,header,footer') || t;
      const k = textOf(b).slice(0, 14) || b.tagName.toLowerCase();
      hits.set(k, (hits.get(k) || 0) + 1);
    }
    for (const [t, n] of hits) if (n >= 2) out.overBackdrop.push({ t, n });
  }
  return out;
}

// 測った数字 → 指摘(種類・優先度・中身)
function judge(m) {
  const f = [];
  const W = m.view.w, H = m.view.h;
  const add = (kind, pri, detail) => f.push({ kind, pri, detail });
  if (m.primary) {
    const p = m.primary;
    const small = p.ratio < TH.primaryMinRatio || p.h < TH.primaryMinH || (m.buttons.length >= 3 && p.secondOther && p.area < p.secondOther * TH.primaryVsOthers);
    if (small) add('大事なボタンが小さい', '高', `「${p.t}」${p.w}×${p.h}px・画面の ${(p.ratio * 100).toFixed(1)}%(基準 ${(TH.primaryMinRatio * 100).toFixed(1)}%・高さ ${TH.primaryMinH}px)・面積はボタンの中で ${p.rankArea}番目`);
  }
  if (m.bottomGap > H * TH.bottomGapRatio) add('下が空いている', '高', `いちばん下の部品から画面の下まで ${m.bottomGap}px(画面の高さの ${Math.round((m.bottomGap / H) * 100)}%・基準 ${Math.round(TH.bottomGapRatio * 100)}%)`);
  for (const c of (m.colGaps || []).slice(0, 2)) add('下が空いている', '高', `列(左 ${c.x}px・幅 ${c.w}px「${c.t}」)の中身のいちばん下から列の下まで ${c.gap}px(列の高さの ${Math.round(c.ratio * 100)}%)`);
  if (m.empty && m.empty.ratio > TH.emptyRatio) add('大きな空き', '中', `何も無い長方形 ${m.empty.w}×${m.empty.h}px(左上 ${m.empty.x},${m.empty.y})が画面の ${Math.round(m.empty.ratio * 100)}%(基準 ${Math.round(TH.emptyRatio * 100)}%)`);
  if (m.fontMin && m.fontMin.px < TH.fontMin) add('字が小さい', m.fontMin.px < 8 ? '高' : '中', `「${m.fontMin.t}」が ${m.fontMin.px}px(基準 ${TH.fontMin}px)`);
  if (m.smallTaps.length) {
    const hard = m.smallTaps.filter((t) => Math.min(t.w, t.h) < TH.tapHard);
    add('押す所が小さい', hard.length ? '中' : '低', `${TH.tapMin}px 未満 ${m.smallTaps.length}個(${TH.tapHard}px 未満 ${hard.length}個): ${m.smallTaps.slice().sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h)).slice(0, 4).map((t) => `「${t.t}」${t.w}×${t.h}`).join('・')}`);
  }
  const dn = m.dups.filter((d) => d.k.startsWith('数:'));
  const ds = m.dups.filter((d) => d.k.startsWith('文:'));
  if (dn.length) add('同じ数字が二重', '高', `${dn.length}種: ` + dn.slice(0, 6).map((d) => `${d.k.slice(2)} が ${d.n}回(${d.where.join(' / ')})`).join('・'));
  if (ds.length) add('同じ文が二重', '高', ds.slice(0, 3).map((d) => `「${d.k.slice(2, 22)}」が ${d.n}回`).join('・'));
  if (m.centered.length) add('2行以上の中央そろえ', '高', m.centered.slice(0, 3).map((c) => `「${c.t}」${c.lines}行`).join('・'));
  if (m.midword.length) add('言葉の途中で折り返し', '高', [...new Set(m.midword.map((x) => x.t))].slice(0, 4).map((t) => `「${t}」`).join('・'));
  if (m.offcenter.length) add('字の中心がずれる', '高', m.offcenter.slice(0, 3).map((c) => `「${c.t}」${c.dx > 0 ? '右' : '左'}へ ${Math.abs(c.dx)}px(${c.why})`).join('・'));
  if ((m.topCut || []).length) add('上が切れている', '高', m.topCut.slice(0, 3).map((c) => `${c.t.startsWith('窓') ? c.t : `「${c.t}」`}の上が画面の外へ ${-c.y}px`).join('・'));
  if (m.overBackdrop.length) add('暗幕の上に窓の外の部品', '高', m.overBackdrop.slice(0, 4).map((o) => `「${o.t}」`).join('・') + ' が窓を開いた暗幕の上に出ていて押せる');
  void W;
  return f;
}

// page.evaluate に関数を渡す(PRIMARY_RE は文字で渡す)
const run = async (page) => {
  try { return await page.evaluate(({ th, src, re }) => (new Function(`return (${src})`)())(th, re), { th: { ...TH, debug: !!process.env.UI_MEASURE_DEBUG }, src: measureInPage.toString(), re: PRIMARY_RE.source }); } catch (e) { return { error: String(e && e.message || e).slice(0, 200) }; }
};

// 撮った止め絵の隣の _measure.jsonl に1行足す。戻り値は指摘の配列
const record = async (page, file, extra = {}) => {
  if (process.env.UI_MEASURE === '0') return [];
  const m = await run(page);
  if (!m || m.error) return [];
  const findings = judge(m);
  try { fs.appendFileSync(path.join(path.dirname(file), '_measure.jsonl'), JSON.stringify({ file: path.basename(file), ...extra, findings, m: { view: m.view, frame: m.frame, primary: m.primary, bottomGap: m.bottomGap, colGaps: m.colGaps, empty: m.empty, fontMin: m.fontMin, ...(process.env.UI_MEASURE_DEBUG ? { dups: m.dups, seenNums: m.seenNums, buttons: m.buttons, texts: m.texts } : {}) } }) + '\n'); } catch (e) { /* 測れなくても撮影は止めない */ }
  return findings;
};

// 置き場の _measure.jsonl を読む(止め絵のファイル名 → 指摘)。同じ名前が2回あれば後の方
const load = (dir) => {
  const map = new Map();
  const f = path.join(dir, '_measure.jsonl');
  if (!fs.existsSync(f)) return map;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) { if (!line.trim()) continue; try { const j = JSON.parse(line); map.set(j.file, j); } catch (e) {} }
  return map;
};
// API へ添える1行(機械の見つけ物)
const lines = (rec) => (rec && rec.findings || []).filter((x) => x.pri !== '低').map((x) => `[測る・${x.pri}] ${x.kind}: ${x.detail}`.slice(0, 220));

module.exports = { TH, PRIMARY_RE, measureInPage, judge, run, record, load, lines };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const opt = (n, d = '') => { const i = argv.indexOf(n); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
  (async () => {
    if (opt('--report')) {
      const map = load(opt('--report'));
      const cnt = {};
      for (const [file, r] of map) { for (const x of r.findings) { cnt[x.kind] = (cnt[x.kind] || 0) + 1; console.log(`${file}\t${x.pri}\t${x.kind}\t${x.detail}`); } }
      console.log(`\n止め絵 ${map.size}枚 / ${Object.entries(cnt).map(([k, v]) => `${k} ${v}`).join('・') || '指摘なし'}`);
      return;
    }
    if (opt('--url')) {
      const { chromium } = require('playwright');
      const b = await chromium.launch();
      const p = await b.newPage({ viewport: { width: Number(opt('--w', '390')), height: Number(opt('--h', '844')) } });
      await p.goto(opt('--url'), { waitUntil: 'load' });
      await p.waitForTimeout(1500);
      const m = await run(p);
      console.log(JSON.stringify(judge(m), null, 1));
      await b.close();
      return;
    }
    console.log('使い方はこのファイルの先頭を見てください');
  })().catch((e) => { console.error(e.message); process.exit(1); });
}
