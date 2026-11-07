#!/usr/bin/env node
// 配信している tailwind.css の「横画面の規則」(landscape:)が、1つ残らず「🔄 横」(アプリが画面を回したとき)にも写っているかを数える(2026-11-07)。
//
//   node tools/boot/tailwind-rotation-copy-check.js
//
// 【なぜ要るか】
// iPhone の「🔄 横」は、端末は縦のまま、アプリが画面を90度回して横長に描く。端末が縦なので @media (orientation: landscape) は効かない。
// そこで tools/build-tailwind.js の withRotationCopy が、横画面の規則を [data-mh-view-rotation=true] の下へ書き写している。
// 2026-11-07、横画面のクラスに入れ子の @media が1つ足されただけで、その写しが数百件まとめて消えた
// (入れ子があると、かたまりを丸ごと捨てる作りだった)。画面はふつうに動くので、気づけたのは社長の実機だけだった
// (社長「モンビーの画面ひどくなってる」「切れてるとこが多い」)。
// ここでは、横画面の規則のセレクタを全部数え、同じセレクタの「回したとき用」が無いものを名指しする。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const css = fs.readFileSync(path.join(ROOT, 'monster-hero', 'tailwind.css'), 'utf8');
const SCOPE = '[data-mh-view-rotation=true]';
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

const blockEnd = (text, open) => { let depth = 1, j = open + 1; for (; j < text.length && depth > 0; j++) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; } return j; };
// かたまりの中のセレクタを集める(入れ子の @ 規則の中も)
const selectorsIn = (body, out) => {
  let i = 0;
  while (i < body.length) {
    const open = body.indexOf('{', i);
    if (open < 0) break;
    const sel = body.slice(i, open).trim();
    if (sel.startsWith('@')) { const end = blockEnd(body, open); selectorsIn(body.slice(open + 1, end - 1), out); i = end; continue; }
    const close = body.indexOf('}', open);
    sel.split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => out.push(x));
    i = close + 1;
  }
  return out;
};
const landscape = [];
const head = /@media \(orientation:\s*landscape\)\{/g;
let m;
while ((m = head.exec(css))) { const end = blockEnd(css, m.index + m[0].length - 1); selectorsIn(css.slice(m.index + m[0].length, end - 1), landscape); head.lastIndex = end; }
const missing = [...new Set(landscape)].filter((sel) => !css.includes(`${SCOPE} ${sel}{`) && !css.includes(`${SCOPE} ${sel},`));
ok('横画面の規則が見つかる', landscape.length >= 100, `${landscape.length}件`);
ok('横画面の規則が、1つ残らず「🔄 横」(回したとき)にも写っている', missing.length === 0, missing.length ? `${missing.length}件が無い: ${missing.slice(0, 5).join(' / ')}` : `${landscape.length}件`);
console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
