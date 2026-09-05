const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// プレイ画面の手元にレーン番号(1〜5)が出ていないかを見る。
//
//   node tools/mode/rhythm-lane-number-check.js
//
// 【なぜ道具にするか】
// 番号を消したつもりが、実機では出たままだったことがある(2026-09-05)。
// レーンの見た目は「プレイ画面のJSX」と「レーンのSVG(data/rhythm-lane-svg.js)」の
// 2か所で作っていて、片方だけ消しても画面はもう片方の絵を出し続けるため、
// このサンドボックスの静的な確認では気づけなかった。
// どちらの側にも番号が残っていないことを、まとめてここで見張る。
const fs = require('fs');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const laneSvg = fs.readFileSync(path.join(web, 'data/rhythm-lane-svg.js'), 'utf8');
const game = fs.readFileSync(path.join(web, 'src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
// コメントは対象から外す(「番号は消した」という説明文まで拾わないため)
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

const svgBody = stripComments(laneSvg);

// ---- レーンのSVG側 ----
check('レーンのSVGに文字を描いていない', !/svgEl\(\s*['"]text['"]/.test(svgBody));
check('レーン番号(lane + 1)を文字にしていない',
  !/textContent\s*=\s*String\(\s*lane\s*\+\s*1\s*\)/.test(svgBody));
// style要素へCSSを流し込むのは別の話なので、そこは対象から外す
check('SVGの図形へ文字を流し込んでいない',
  !/(?<!style)\.textContent\s*=(?!\s*`)/.test(svgBody));

// ---- プレイ画面のJSX側 ----
// 判定ラインの手前に並ぶ番号は、レーンの数だけ作る形で書かれていた。
// 同じ形が戻っていないかを見る
const playFrom = game.indexOf('data-rhythm-play');
const playArea = playFrom >= 0 ? stripComments(game.slice(playFrom, playFrom + 40000)) : '';
check('プレイ画面のJSXにも番号を並べていない',
  !/RHYTHM_LANE_COUNT[^\n]{0,120}(lane|i)\s*\+\s*1[^\n]{0,60}<\/(span|div|b|small)>/.test(playArea));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
