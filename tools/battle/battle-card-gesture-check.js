const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero', 'src', 'game-system.jsx'), 'utf8');
let failed = false;
const check = (label, ok) => {
  console.log(`${ok ? 'OK' : 'NG'}: ${label}`);
  if (!ok) failed = true;
};

check('カード名のpointerdownがカード全体への伝播を止めない', !source.includes('onPointerDown={(ev)=>ev.stopPropagation()}'));
check('約10pxの移動でスワイプが成立する', source.includes('const DRAG_THRESHOLD=10;') && source.includes('moved>=DRAG_THRESHOLD'));
check('成立したスワイプをpointerupまでrefで保持する', source.includes('cardDragActiveRef.current=true') && source.includes('const wasActive=cardDragActiveRef.current'));
check('スワイプ後の合成clickをcapture段階で無効化する', source.includes("window.addEventListener('click',suppressSwipeClick,true)") && source.includes('e.stopImmediatePropagation()'));
check('カード名の通常タップでは技選択を開く', source.includes('setSkillPicker({handIndex:i})'));
check('カード全体のpointerdownから従来のドラッグを開始する', source.includes('setDragState({cardIndex:i'));

if (failed) process.exit(1);
console.log('バトルカードのタップ／スワイプ判定は正しく結線されています');
