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
// pure:true の部品に、React / フック / JSX / document / window / storeGet・storeSet・localStorage /
// Audio_ / fetch / setTimeout・requestAnimationFrame が(コメントを除いて)1つも無いこと。
// 逆に pure でない部品に何があってもよい(そちらは段階的に減らす)。
const fs = require('fs');
const path = require('path');
const { PARTS_DIR, PARTS_MANIFEST } = require(path.join(TOOLS_DIR, 'harness'));

const FORBIDDEN = [
  ['React / フック', /\bReact\b|\buse(?:State|Effect|LayoutEffect|Ref|Memo|Callback|Context|Reducer)\b/],
  ['JSX', /<[A-Za-z][\w.]*(?:\s[^<>]*)?\/?>/],
  ['document', /\bdocument\b/],
  ['window', /\bwindow\b/],
  ['保存(storeGet / storeSet / storeList / localStorage)', /\bstore(?:Get|Set|List)\b|\blocalStorage\b/],
  ['Audio_', /\bAudio_\b/],
  ['fetch', /\bfetch\s*\(/],
  ['タイマー(setTimeout / setInterval / requestAnimationFrame)', /\bset(?:Timeout|Interval)\s*\(|\brequestAnimationFrame\b/],
];
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const manifest = JSON.parse(fs.readFileSync(PARTS_MANIFEST, 'utf8'));
const pureParts = manifest.parts.filter(p => p.pure === true);
check('pure:true の部品が parts.json にある', pureParts.length >= 5, `${pureParts.length}個: ${pureParts.map(p => p.file).join(', ')}`);

for (const part of pureParts) {
  const src = stripComments(fs.readFileSync(path.join(PARTS_DIR, part.file), 'utf8'));
  const hits = [];
  for (const [label, re] of FORBIDDEN) {
    const m = src.match(re);
    if (m) {
      const line = src.slice(0, m.index).split('\n').length;
      hits.push(`${label}(${line}行目付近: ${m[0].slice(0, 40)})`);
    }
  }
  check(`${part.file} は画面・保存・音・通信・タイマーを参照しない`, hits.length === 0, hits.join(' / '));
}

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
