const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const files=['monster-hero/src/game-system.jsx','monster-hero/game-system.compiled.js'];
let failed=0;
const check=(name,ok)=>{console.log(`${ok ? 'OK' : 'NG'}: ${name}`);if(!ok)failed++;};
for(const file of files){
  const source=fs.readFileSync(path.join(ROOT,file),'utf8');
  const compact=source.replace(/\s+/g,'');
  check(`${file}: AUTO∞最終リザルトBGMは既定OFF`,compact.includes("autoRepeatResultBgm:'off'"));
  check(`${file}: AUTO∞最終リザルトBGMを保存正規化`,source.includes("'autoRepeatResultBgm'")&&source.includes('BGM_TOGGLE_SCENES'));
  check(`${file}: AUTO∞の最終リザルトはOFF時に直前BGMを継続`,/autoRepeatRef\.current\s*&&\s*bgmArrangement\.autoRepeatResultBgm\s*!==\s*['"]on['"]\) return ['"]__keep_battle_bgm__['"]/.test(source));
  check(`${file}: BGMアレンジにAUTO∞最終リザルト設定を表示`,source.includes('AUTO∞ 最終リザルトBGM'));
}
const help=fs.readFileSync(path.join(ROOT,'monster-hero/data/help.js'),'utf8');
const changelog=fs.readFileSync(path.join(ROOT,'monster-hero/data/changelog.js'),'utf8');
check('ヘルプにAUTO∞最終リザルトBGMを説明',help.includes('AUTO∞では最終リザルトのゲームクリアBGMも初期設定はOFF'));
check('更新履歴にAUTO∞最終リザルトBGMを掲載',changelog.includes('AUTO∞の最終リザルトBGMを設定できるようにしました'));
if(failed)process.exit(1);
console.log('OK: AUTO∞最終リザルトBGMの検証に成功しました');
