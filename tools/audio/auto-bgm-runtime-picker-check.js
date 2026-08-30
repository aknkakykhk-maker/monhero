const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const files=['monster-hero/src/game-system.jsx','monster-hero/game-system.compiled.js'];
let failed=0;
const check=(name,ok)=>{console.log((ok?'OK':'NG')+': '+name);if(!ok)failed++;};
for(const file of files){
  const s=fs.readFileSync(path.join(ROOT,file),'utf8');
  check(file+': AUTO BGM一時上書きstate',s.includes('autoBgmOverride')&&s.includes('showAutoBgmPicker'));
  check(file+': AUTO停止で一時選択を解除',s.includes('setAutoBgmOverride(null)')&&s.includes('setShowAutoBgmPicker(false)'));
  check(file+': バトル中は一時選択を優先',s.includes("if (autoBgmOverride === '__none__') return '__silence_bgm__';")&&s.includes('if (autoBgmOverride) return autoBgmOverride;')&&s.includes('if (autoBattleRef.current) return bgmArrangement.autoBattle;'));
  check(file+': BGMなしはBGMだけ停止',s.includes("if (key === '__silence_bgm__')")&&s.includes('Audio_.stopBGM();'));
  check(file+': 登録曲一覧をBGM選択へ利用',/BGM_TRACKS\.map\(/.test(s));
  if(file.includes('/src/')) { check(file+': BGMボタン常設',s.includes('バトルBGMと音量を調整')&&!s.includes('{(autoBattle||autoRepeat)&&<button data-auto-bgm-button')); check(file+': BGM/SEパネル',s.includes('BGM / 音量')&&s.includes('label=\"SE\"')&&s.includes('label=\"BGM\"')&&s.includes('バトル中に再生するBGM')); }
}
const help=fs.readFileSync(path.join(ROOT,'monster-hero/data/help.js'),'utf8');
const log=fs.readFileSync(path.join(ROOT,'monster-hero/data/changelog.js'),'utf8');
check('ヘルプにバトルBGM操作を掲載',help.includes('通常操作中もAUTO中も常設')&&help.includes('SE音量とBGM音量'));
check('更新履歴にAUTO BGM選択を掲載',log.includes('AUTO中にBGMを選べるようにしました'));
if(failed)process.exit(1);
console.log('OK: AUTO BGM選択の検証に成功しました');
