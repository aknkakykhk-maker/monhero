const fs=require('fs');
const path=require('path');
const source=fs.readFileSync(path.join(__dirname,'..','..','monster-hero','data','rhythm-mode.js'),'utf8');
const checks=[
  ['ノーツ遠近描画の導入',source.includes('installRhythmPerspectiveNoteVisuals')],
  ['判定ライン基準で奥行きを算出',source.includes('const depth=Math.max(0,Math.min(1,y/judgeY))')],
  ['奥ほど細くする',source.includes('const scale=.44+.56*depth')],
  ['レーン中央へ遠近補間',source.includes('const visualCenter=areaRect.width/2+(baseCenter-areaRect.width/2)*scale')],
  ['HOLD帯を奥側へ絞る',source.includes('clip-path:polygon(34% 0,66% 0,100% 100%,0 100%)')],
  ['判定/入力関数は既存batchを維持',source.includes('const rhythmMatchInputBatch=')],
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'OK':'NG'}: ${name}`);if(!ok)failed++;}
if(failed)process.exit(1);
