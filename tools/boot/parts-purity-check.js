const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// parts.json で pure:true とした部品が、本当に「純粋な計算とデータ」だけでできているかを確かめる。
//
//   node tools/boot/parts-purity-check.js
//
// 【なぜ要るか】
// 共有層を節ごとの部品へ分けた(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 4)ねらいは、
// 「マスモンの育成の式」「難易度の表」「敵の行動」のような計算とデータを、画面(React/DOM)・保存・音・通信から
// 切り離して、Node の vm から追加のスタブ無しで呼べるようにすること。
// 分けただけでは、次に手を入れる人が pure な部品へ useState や storeSet を書き足しても誰も気づかない。
// ここで機械的に止める。
//
// 【見ているもの】
// React / フック / JSX / document / window / storeGet・storeSet・storeList・localStorage /
// Audio_ / fetch / setTimeout・setInterval・requestAnimationFrame を、
// **その部品の外から降ってくる名前として**使っていないこと。
//
// 【名前で弾くのをやめた理由】(2026-09-11)
// 以前はコメントを消して正規表現を当てていたため、「引数で受け取った storeGet」まで弾いていた。
// 実際に 19-difficulties-and-rules.jsx の persistSpeciesChallengeClearRewardTransaction は
//   ({ progress, ownedItems, ..., storeSet, storeGet }) => ...
// と保存の道具を**引数で受け取る**形で、本体も検査も自前の storeGet/storeSet を渡して呼んでいる。
// つまり「vm から追加のスタブ無しで呼べる」というねらいはすでに満たしているのに、
// 名前が同じというだけで pure:true にできなかった。
//
// そこで undefined-reference-check.js と同じくBabelで解析し、スコープをたどって
// **その部品の中で宣言されていない参照だけ**をNGにする。
//   ・引数・const・let で受け取っている  → その部品の中の名前なのでOK(依存性注入)
//   ・どこにも宣言が無い                 → 外のグローバルを掴んでいるのでNG
// 文字列やコメントの中の綴りを拾うこともなくなる。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const { PARTS_DIR, PARTS_MANIFEST } = require(path.join(TOOLS_DIR, 'harness'));

// 外から降ってきたら困る名前 → 表示するときの分類
const FORBIDDEN = new Map([
  ['React', 'React / フック'],
  ['useState', 'React / フック'], ['useEffect', 'React / フック'], ['useLayoutEffect', 'React / フック'],
  ['useRef', 'React / フック'], ['useMemo', 'React / フック'], ['useCallback', 'React / フック'],
  ['useContext', 'React / フック'], ['useReducer', 'React / フック'],
  ['document', 'document'],
  ['window', 'window'],
  ['storeGet', '保存'], ['storeSet', '保存'], ['storeList', '保存'], ['localStorage', '保存'],
  ['Audio_', 'Audio_'],
  ['fetch', 'fetch'],
  ['setTimeout', 'タイマー'], ['setInterval', 'タイマー'], ['requestAnimationFrame', 'タイマー'],
]);

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const manifest = JSON.parse(fs.readFileSync(PARTS_MANIFEST, 'utf8'));
const pureParts = manifest.parts.filter(p => p.pure === true);
check('pure:true の部品が parts.json にある', pureParts.length >= 5, `${pureParts.length}個: ${pureParts.map(p => p.file).join(', ')}`);

for (const part of pureParts) {
  const source = fs.readFileSync(path.join(PARTS_DIR, part.file), 'utf8');
  let ast;
  try {
    ast = parser.parse(source, { sourceType: 'script', plugins: ['jsx'] });
  } catch (e) {
    check(`${part.file} を解析できる`, false, e.message);
    continue;
  }
  const hits = [];
  const seen = new Set();
  traverse(ast, {
    JSXElement(p) {
      const line = p.node.loc.start.line;
      const key = `JSX:${line}`;
      if (seen.has(key)) return;
      seen.add(key);
      hits.push(`JSX(${line}行目)`);
    },
    Identifier(p) {
      const name = p.node.name;
      const label = FORBIDDEN.get(name);
      if (!label) return;
      if (!p.isReferencedIdentifier()) return;
      // その部品の中で宣言されていれば、外の名前ではない(引数で受け取った保存など)
      if (p.scope.getBinding(name)) return;
      const line = p.node.loc.start.line;
      const key = `${name}:${line}`;
      if (seen.has(key)) return;
      seen.add(key);
      hits.push(`${label}(${line}行目: ${name})`);
    },
  });
  check(`${part.file} は画面・保存・音・通信・タイマーを外から掴まない`, hits.length === 0, hits.slice(0, 5).join(' / '));
}

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
