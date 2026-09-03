// モンスターノーツのマスモン表示が、通常ノーツ用の last-child CSS に巻き込まれて
// 四角い枠・位置ずれを再発しないことと、特別ノーツ用の金色輪郭・専用オーラを確認する。
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
check('マスモン画像自体は四角い枠・背景なしのまま',
  compact.includes('border:0 !important')
  &&compact.includes('outline:0 !important')
  &&compact.includes('border-radius:0 !important')
  &&compact.includes('background:transparent !important')
  &&compact.includes('box-shadow:none !important'));
check('染色画像側の1px clip hackを打ち消して矩形境界を残さない',
  compact.includes('[data-rhythm-note][data-rhythm-monster-note] > [data-rhythm-monster-face] > *')
  &&compact.includes('clip-path:none !important')
  &&compact.includes('-webkit-clip-path:none !important'));
check('モンスターノーツ本体だけに白金の輪郭と金色発光を足す',
  compact.includes('[data-rhythm-note][data-rhythm-monster-note]::before')
  &&compact.includes('border:1px solid rgba(255,250,205,.98)')
  &&compact.includes('rgba(253,224,71,.92)'));
check('モンスターノーツ本体だけに紫・シアンの薄い外周オーラを足す',
  compact.includes('[data-rhythm-note][data-rhythm-monster-note]::after')
  &&compact.includes('rgba(217,70,239,.45)')
  &&compact.includes('rgba(34,211,238,.28)')
  &&compact.includes('animation:rhythmMonsterNoteAura 1.15s ease-in-out infinite alternate'));
check('マスモンは中央のまま約1.28倍へ拡大し遠近スケールも維持',
  compact.includes('translate(-50%,-50%) scale(var(--rhythm-note-depth-scale, 1)) scale(1.28) !important'));
check('動きを減らす設定では専用オーラを常時アニメーションしない',
  compact.includes('@media(prefers-reduced-motion:reduce)')
  &&compact.includes('[data-rhythm-note][data-rhythm-monster-note]::after { animation:none; opacity:.66; }'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
