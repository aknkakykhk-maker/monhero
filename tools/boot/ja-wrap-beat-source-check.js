#!/usr/bin/env node
// モンヒロビートの画面の parts から、2行以上になりうる長さの日本語の文で、折る部品(jaWrap など)も break-keep も通していない所を、ソースから数える(2026-10-27)。
// ビート部・部長テンポくんの依頼。いきさつ: マルチの選曲の説明が jaWrap を通っておらず、手元の画面では通るのに、
// 字の幅が違う環境では「シャッフ／ルで」と折れた(#4067)。画面を撮って数えるやり方(ja-wrap-beat-*-check.js)は、
// その環境の字の幅で折れた所しか見えないので、「環境によっては折れる文」を取りこぼす。ここでは画面を開かず、書き方で見る。
//
//   node tools/boot/ja-wrap-beat-source-check.js          # 数える
//   node tools/boot/ja-wrap-beat-source-check.js --list   # 当てはまる所を全部出す(ファイル:行 と文の頭)
//
// 数える文: JSX の地の文と、{…} の中の文字列(条件 ? 'A' : 'B'・x && 'A'・`…` も)。かな漢字を含み、MIN_CHARS 字以上のもの
// 守られているとみなす(数えない):
//   ・折る部品の引数の中(WRAP_FUNCS: jaWrap・helpWrap・jaWrapParts・rhythmJaWrapOnce)
//   ・外側の要素の className に break-keep・whitespace-nowrap・truncate・line-clamp、または style に JA_WRAP_STYLE・
//     wordBreak:'keep-all'・whiteSpace:'nowrap'・textOverflow:'ellipsis'・WebkitLineClamp がある
//   ・中に <wbr> を置いている(作り手が折り目を決めた)
// 数えない: 宣言の前の説明書きに「デバッグ」とある部品・試作の切り替え(…Switch で、60-app.jsx のデバッグの画面だけで使う部品)・debug… ? '…' のデバッグのときだけ出る文・属性の文字列(title・aria-label など。画面に字として出ない)・変数に入れてから出す文(ここでは追えない)
// 直し方: 文を jaWrap('…') で包み、その要素の style に JA_WRAP_STYLE を付ける(41-screen-ui.jsx)。文は変えない
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const { parse } = require(path.join(ROOT, 'tools/node_modules/@babel/parser'));
const LIST = process.argv.includes('--list');
// 見る parts(モンヒロビートの画面)
const FILES = ['29-rhythm-screens.jsx', '30-rhythm-play.jsx', '58-screen-rhythm.jsx', '77-screen-rhythm-multi.jsx', '80-screen-rhythm-buddy.jsx'];
// これより短い文は、いちばん狭い札でも1行に入るとみなす
const MIN_CHARS = 12;
// 守られていない文の上限。2026-10-27 に154件を洗い出し、ファイルごとに直して下げていく(29 → 58 → 80 → 77 → 30。最後の PR で0にする)
const SOURCE_WRAP_LIMIT = 137;
const WRAP_FUNCS = new Set(['jaWrap', 'helpWrap', 'jaWrapParts', 'rhythmJaWrapOnce']);
const KEEP_CLASS = /(^|\s|:)(break-keep|whitespace-nowrap|truncate|line-clamp-\d+)(\s|$)/;
const KEEP_STYLE = /JA_WRAP_STYLE|wordBreak\s*:\s*['"]keep-all|whiteSpace\s*:\s*['"]nowrap|textOverflow\s*:\s*['"]ellipsis|WebkitLineClamp/;
const JA = /[ぁ-んァ-ヶ一-龯]/;
let failed = 0;
const check = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

// その部品を <名前 で使っているのが 60-app.jsx(デバッグの画面がある)だけか
const PARTS_DIR = path.join(ROOT, 'monster-hero/src/parts');
let partsCache = null;
const usedOnlyInDebug = (name) => {
  partsCache = partsCache || fs.readdirSync(PARTS_DIR).filter((f) => f.endsWith('.jsx')).map((f) => [f, fs.readFileSync(path.join(PARTS_DIR, f), 'utf8')]);
  const users = partsCache.filter(([, t]) => t.includes(`<${name}`)).map(([f]) => f);
  return users.length > 0 && users.every((f) => f === '60-app.jsx');
};
// 1つのファイルのソースから、守られていない文を探す。直す道具からも使えるよう、文の場所(node)と外側の要素(el)も返す
const scanSource = (src) => {
  const ast = parse(src, { sourceType: 'script', plugins: ['jsx'], errorRecovery: true, allowReturnOutsideFunction: true });
  const items = []; let texts = 0;
  const attrSrc = (el, name) => {
    const a = el.openingElement.attributes.find((x) => x.type === 'JSXAttribute' && x.name && x.name.name === name);
    return a && a.value ? src.slice(a.value.start, a.value.end) : '';
  };
  const hasWbr = (el) => el.children.some((c) => c.type === 'JSXElement' && c.openingElement.name.name === 'wbr');
  // stack: 外側からの [node] の並び
  const visit = (node, stack) => {
    if (!node || typeof node.type !== 'string') return;
    let text = null;
    if (node.type === 'JSXText') text = node.value;
    else if (node.type === 'StringLiteral' || node.type === 'TemplateLiteral') {
      // {…} の中で、要素の子として出る文字列だけ(属性・関数の引数・比べる値は数えない)
      let ok = false;
      for (let i = stack.length - 1; i >= 0; i--) {
        const p = stack[i], child = stack[i + 1] || node;
        // デバッグのときだけ出る文(debugPlay ? '…' : …)は数えない
        if (p.type === 'ConditionalExpression' && child === p.consequent && /debug/i.test(src.slice(p.test.start, p.test.end))) { ok = false; break; }
        if (p.type === 'ConditionalExpression' && child !== p.test) continue;
        if (p.type === 'LogicalExpression' && child === p.right) continue;
        if (p.type === 'JSXExpressionContainer') { ok = stack[i - 1] && (stack[i - 1].type === 'JSXElement' || stack[i - 1].type === 'JSXFragment'); break; }
        break;
      }
      if (ok) text = node.type === 'StringLiteral' ? node.value : node.quasis.map((q) => q.value.cooked).join('');
    }
    if (text !== null) {
      const t = text.replace(/\s+/g, '');
      if (JA.test(t) && [...t].length >= MIN_CHARS) {
        texts++;
        let safe = false;
        for (let i = stack.length - 1; i >= 0 && !safe; i--) {
          const p = stack[i];
          if (p.type === 'CallExpression' && p.callee.type === 'Identifier' && WRAP_FUNCS.has(p.callee.name)) safe = true;
          if (p.type === 'JSXElement') {
            if (KEEP_CLASS.test(attrSrc(p, 'className')) || KEEP_STYLE.test(attrSrc(p, 'style')) || hasWbr(p)) safe = true;
          }
        }
        if (!safe) {
          const el = [...stack].reverse().find((x) => x.type === 'JSXElement') || null;
          items.push({ node, el, text: t, line: src.slice(0, node.start).split('\n').length });
        }
      }
    }
    for (const k of Object.keys(node)) {
      if (k === 'loc' || k === 'leadingComments' || k === 'trailingComments' || k === 'innerComments') continue;
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && visit(c, [...stack, node]));
      else if (v && typeof v.type === 'string') visit(v, [...stack, node]);
    }
  };
  // 宣言の前の説明書きに「デバッグ」とある部品(試作・見比べ用の切り替えなど)は、ふつうのプレイに出ないので数えない
  for (const st of ast.program.body) {
    if ((st.leadingComments || []).some((c) => /デバッグ/.test(c.value))) continue;
    // 試作・見比べ用の切り替え(名前が …Switch で終わる部品)は、デバッグの画面(60-app.jsx)からしか出さない。ほかで使っていたら数える
    const name = st.type === 'FunctionDeclaration' && st.id ? st.id.name : '';
    if (/Switch$/.test(name) && usedOnlyInDebug(name)) continue;
    visit(st, [ast.program]);
  }
  return { items, texts };
};
module.exports = { scanSource, FILES, ROOT };

if (require.main === module) {
  const found = []; let parsed = 0, texts = 0;
  for (const file of FILES) {
    const src = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts', file), 'utf8');
    let r;
    try { r = scanSource(src); parsed++; } catch (e) { check(`${file} を読めた`, false, e.message.slice(0, 120)); continue; }
    texts += r.texts;
    for (const x of r.items) found.push(`${file}:${x.line} 「${x.text.slice(0, 24)}${[...x.text].length > 24 ? '…' : ''}」`);
  }
  check('ビートの parts を全部読めた', parsed === FILES.length, `${parsed}/${FILES.length}`);
  check('数える文が見つかった(読み方が壊れていない)', texts > 50, `${texts}件`);
  if (LIST) for (const x of found) console.log('  ', x);
  check('折る部品も break-keep も通していない長い日本語の文が上限(SOURCE_WRAP_LIMIT)以下', found.length <= SOURCE_WRAP_LIMIT,
    `${found.length}件(上限 ${SOURCE_WRAP_LIMIT})${found.length ? ' — ' + found.slice(0, 5).join(' / ') : ''}`);
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
}
