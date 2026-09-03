// モンスターノーツのマスモン表示が、通常ノーツ用の last-child CSS に巻き込まれて
// 四角い枠・位置ずれを再発しないことを静的に確認する。
//
//   node tools/mode/rhythm-monster-face-css-check.js
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(ROOT,'monster-hero/index.html'),'utf8');
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const compact=html.replace(/\s+/g,' ');
check('通常ノーツ用の last-child CSS が存在する前提を確認',
  compact.includes('[data-rhythm-note] > span:last-child'));
check('モンスターノーツ専用の高詳細度ルールで位置を中央へ戻す',
  compact.includes('[data-rhythm-note][data-rhythm-monster-note] > [data-rhythm-monster-face]')
  &&compact.includes('inset:auto !important')
  &&compact.includes('left:50% !important')
  &&compact.includes('top:50% !important')
  &&compact.includes('right:auto !important')
  &&compact.includes('bottom:auto !important'));
check('モンスターノーツ専用ルールで枠・背景・影を消す',
  compact.includes('border:0 !important')
  &&compact.includes('outline:0 !important')
  &&compact.includes('border-radius:0 !important')
  &&compact.includes('background:transparent !important')
  &&compact.includes('box-shadow:none !important'));
check('染色画像側の1px clip hackを打ち消して矩形境界を残さない',
  compact.includes('[data-rhythm-note][data-rhythm-monster-note] > [data-rhythm-monster-face] > *')
  &&compact.includes('clip-path:none !important')
  &&compact.includes('-webkit-clip-path:none !important'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
