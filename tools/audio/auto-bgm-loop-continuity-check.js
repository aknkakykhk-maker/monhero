const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const files=['monster-hero/src/game-system.jsx','monster-hero/game-system.compiled.js'];
let failed=0;const check=(n,ok)=>{console.log((ok?'OK':'NG')+': '+n);if(!ok)failed++;};
for(const f of files){const s=fs.readFileSync(path.join(ROOT,f),'utf8');
check(f+': BGMボタンを上部コントロールから撤去',!s.includes('w-[28px] h-[28px] flex items-center justify-center rounded bg-indigo-800 border border-indigo-400/50 text-[13px] active:scale-90'));
check(f+': 下部BGMボタン',s.includes('data-auto-bgm-button'));
check(f+': AUTO∞次周の中間フェーズでBGM継続',s.includes("if (autoRepeatRef.current && !wavesDone) return '__keep_battle_bgm__';"));}
const help=fs.readFileSync(path.join(ROOT,'monster-hero/data/help.js'),'utf8');const log=fs.readFileSync(path.join(ROOT,'monster-hero/data/changelog.js'),'utf8');
check('ヘルプに配置変更と次周継続を掲載',help.includes('VIEW／AUTO付近')&&help.includes('曲頭へ戻りません'));
check('更新履歴に修正を掲載',log.includes('AUTO∞のBGM操作と周回継続を改善しました'));
if(failed)process.exit(1);console.log('OK: AUTO BGM layout/loop continuity checks passed');
