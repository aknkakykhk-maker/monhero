#!/usr/bin/env node
// 台詞が「言葉の途中」で折れていないかを、折り目(jaWrap の印)とは別の物差しで数える(2026-10-26)。
// 社長「助手のコメントで、ストーリーやバトルカードとかでも変なとこで切れるのが多々あった」(「や/さしく」「ひと/とおり」「ビート/P」)。
//
//   node tools/boot/ja-wrap-word-check.js                     # いまの jaWrapPoints で数える
//   node tools/boot/ja-wrap-word-check.js --compare origin/main  # その版の jaWrapPoints と並べて、直す前と後の数を出す
//   node tools/boot/ja-wrap-word-check.js --list               # 折れた所を全部出す
//
// ja-wrap-lines-check.js は「印の無い所で折れていないか」を見る。印そのものが言葉の途中に付いていると通ってしまうので、
// ここでは描いた行の変わり目ごとに、前後の字から「言葉の途中か」を決まり(BAD_RULES)で判定する。漢字どうし・ひらがなどうしの区切りは
// 文節の切れ目のこと(「数人／来て」「よろしく／お願い」)も多いので数えず、言葉の途中と言い切れる形だけを数える
//   台詞: 助手・ジャック・お話(data/assistants.js・38-raid-jack-home-lines.jsx)と MFバトルカード(83-card-battle-lines・83-card-battle-vs・86-card-tutorial)
//   幅: 320・375・390 の縦で、お話の窓(字13px・本文 幅-64px)・助手の吹き出し(字12px・幅-130px)・カードの台詞(字12px・幅-150px)
'use strict';
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2), argOf = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const P = (f) => fs.readFileSync(path.join(ROOT, 'monster-hero', f), 'utf8');
let failed = 0;
// 言葉の途中で折れてよい数。2026-10-26 に0まで直した(直す前 140)。台詞を書き足して増えたら、41-screen-ui.jsx の jaWrapPoints の決まりか JA_WORDS_KEEP を直す
const JA_WRAP_WORD_LIMIT = 0;
const check = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

// 41-screen-ui.jsx から jaWrapPoints まわりを取り出す(ja-wrap-lines-check.js と同じ切り出し)
const fnOf = (ui) => ui.slice(ui.indexOf('let _jaSegmenter;'), ui.indexOf('const jaWrap ='));
const nowSrc = fnOf(P('src/parts/41-screen-ui.jsx'));
const base = argOf('--compare');
const baseSrc = base ? fnOf(execSync(`git show ${base}:monster-hero/src/parts/41-screen-ui.jsx`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 })) : null;

// 台詞を集める
const asst = P('data/assistants.js'), jack = P('src/parts/38-raid-jack-home-lines.jsx');
const quoted = (src) => [...src.matchAll(/'([^'\n{}]{8,200})'/g)].map((m) => m[1]);
const bubble = [...new Set([...quoted(jack), ...[...asst.matchAll(/t:'([^'\n{}]{8,200})'/g)].map((m) => m[1])].filter((t) => /[ぁ-ん]/.test(t)))];
const story = [...new Set([...asst.matchAll(/who:'[^']+',\s*e:'[^']*',\s*t:'([^'\n{}]{8,200})'/g)].map((m) => m[1]))];
const card = [...new Set(['src/parts/83-card-battle-lines.jsx', 'src/parts/83-card-battle-vs.jsx', 'src/parts/86-card-tutorial.jsx']
  .flatMap((f) => quoted(P(f))).map((t) => t.replace(/[《》]/g, '')).filter((t) => /[ぁ-ん]/.test(t) && !/^[\w.\-/ ]+$/.test(t)))];
check('台詞を集められた', bubble.length >= 500 && story.length >= 300 && card.length >= 200, `吹き出し ${bubble.length}本・お話 ${story.length}本・カード ${card.length}本`);

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(failed ? 1 : 0); }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  await page.setContent('<!doctype html><meta charset="utf-8"><div id=r></div>');
  const run = (src) => page.evaluate(({ src, bubble, story, card }) => {
    let _jaSegmenter, jaWrapPoints, jaKeepWhole, JA_PARTICLE_END, JA_WRAP_TIGHT, jaWrapPieces, JA_WRAP_LINE, JA_WORDS_KEEP;
    eval(src.replace(/\bconst (jaWrapPoints|jaKeepWhole|JA_PARTICLE_END|JA_WRAP_TIGHT|jaWrapPieces|JA_WRAP_LINE|JA_WORDS_KEEP) =/g, '$1 ='));
    // 言葉の途中かを決める物差し(jaWrapPoints の作りとは別に、行の変わり目の前後の字だけで決める)
    const K = '[一-龯々]', KA = '[ァ-ヶー]', H = '[ぁ-ゖ]';
    const WORDS = ['ひととおり', 'やさし', 'はね返', 'しとけ', 'しとく', 'ちょっと', 'いっしょ', 'やっぱ', 'おねがい', 'ありがと', 'ひとつ', 'ふたつ', 'みんな', 'ぜったい', 'いっぱい', 'もっと', 'ずっと', 'きっと', 'たくさん'];
    // 言葉の区切りを見つける道具(Intl.Segmenter)の1語の中なら、言葉の途中
    const seg = new Intl.Segmenter('ja', { granularity: 'word' });
    const inWord = (full, at) => { let p = 0; for (const { segment } of seg.segment(full)) { if (at > p && at < p + segment.length) return true; p += segment.length; if (p >= at) break; } return false; };
    const BAD_RULES = [
      ['道具の1語の中', (l, r, full, at) => inWord(full, at)],
      ['よく使う言葉の中', (l, r, full, at) => WORDS.some((w) => { for (let i = full.indexOf(w); i >= 0; i = full.indexOf(w, i + 1)) if (at > i && at < i + w.length) return true; return false; })],
      ['笑・wだけが行の頭', (l, r) => /^(?:笑+|[ｗwW]+)(?:[\s！!？?。、♪✨]|$)/.test(r)],
      ['記号が行の頭', (l, r) => /^[！？!?、。，．」』）)】〕〉》…‥〜～ー・]/.test(r)],
      ['「お・ご」と漢字', (l, r) => /(?:^|[^ぁ-ゖ])[おご]$/.test(l) && new RegExp(`^${K}`).test(r)],
      ['くっついた言葉(読み|合い)', (l, r) => new RegExp(`${K}[きしちひみりっ]$`).test(l) && !/少し$/.test(l) && new RegExp(`^${K}`).test(r)],
      ['カタカナと英字', (l, r) => new RegExp(`${KA}$`).test(l) && /^[A-Za-zＡ-Ｚ]/.test(r)],
    ];
    const sets = [['お話', story, [[320, 256, 13], [375, 311, 13], [390, 326, 13]]], ['吹き出し', bubble, [[320, 190, 12], [375, 245, 12], [390, 260, 12]]], ['カード', card, [[320, 170, 12], [375, 225, 12], [390, 240, 12]]]];
    const out = { lines: 0, breaks: 0, bad: [], byRule: {} };
    const range = document.createRange();
    for (const [kind, texts, sizes] of sets) for (const t of texts) for (const [vw, w, fz] of sizes) {
      const d = document.createElement('div');
      d.style.cssText = `width:${w}px;font-size:${fz}px;font-weight:700;line-height:1.6;word-break:keep-all;overflow-wrap:anywhere;text-wrap:wrap;font-family:sans-serif`;
      // jaWrap と同じ: 印を <wbr> に(折らない枠 data-ja-keep は jaWrapPieces が決める)
      jaWrapPoints(t).split('​').forEach((seg, i) => {
        if (i > 0 && !/^\s/.test(seg)) d.appendChild(document.createElement('wbr'));
        for (const [s, keep] of jaWrapPieces(seg)) { if (keep) { const sp = document.createElement('span'); sp.style.whiteSpace = 'nowrap'; sp.textContent = s; d.appendChild(sp); } else d.appendChild(document.createTextNode(s)); }
      });
      document.body.appendChild(d);
      // 1字ずつの位置で行の変わり目を出す
      const chars = []; const w2 = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
      for (let n = w2.nextNode(); n; n = w2.nextNode()) for (let i = 0; i < n.length; i++) { range.setStart(n, i); range.setEnd(n, i + 1); const r = range.getClientRects()[0]; chars.push([n.data[i], r ? r.top : null]); }
      // 行の終わりの空白は位置を持たないので、手前の字の行に入れる(字の並びから空白を落とさない)
      for (let i = 0; i < chars.length; i++) if (chars[i][1] == null) chars[i][1] = i ? chars[i - 1][1] : 0;
      const full = chars.map((c) => c[0]).join(''); out.lines++;
      for (let i = 1; i < chars.length; i++) if (chars[i][1] > chars[i - 1][1] + 3) {
        out.breaks++;
        const l = full.slice(0, i).replace(/\s+$/, ''), r = full.slice(i).replace(/^\s+/, '');
        if (/\s/.test(full[i - 1] || '') || /\s/.test(full[i] || '')) continue; // 空白で折れたのは言葉の切れ目
        const hit = BAD_RULES.find(([, f]) => f(l, r, full, i));
        if (hit) { out.byRule[hit[0]] = (out.byRule[hit[0]] || 0) + 1; out.bad.push(`${kind} ${vw} ${hit[0]}: ${l.slice(-8)}／${r.slice(0, 8)}`); }
      }
      d.remove();
    }
    return out;
  }, { src, bubble, story, card });
  const now = await run(nowSrc);
  if (baseSrc) {
    const before = await run(baseSrc);
    console.log(`直す前(${base}): 描いた ${before.lines}・行の変わり目 ${before.breaks}・言葉の途中 ${before.bad.length}  ${JSON.stringify(before.byRule)}`);
  }
  console.log(`いま: 描いた ${now.lines}・行の変わり目 ${now.breaks}・言葉の途中 ${now.bad.length}  ${JSON.stringify(now.byRule)}`);
  if (args.includes('--list')) for (const b of now.bad) console.log('  ', b);
  check('言葉の途中で折れた所が上限(JA_WRAP_WORD_LIMIT)以下', now.bad.length <= JA_WRAP_WORD_LIMIT, `${now.bad.length}件(上限 ${JA_WRAP_WORD_LIMIT})${now.bad.length ? ' — ' + now.bad.slice(0, 5).join(' / ') : ''}`);
  await browser.close();
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
