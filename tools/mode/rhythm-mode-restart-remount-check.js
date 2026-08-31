#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const script=read('monster-hero/data/rhythm-result-replay-remount.js');
const release=read('monster-hero/data/rhythm-step3-release.js');
const source=read('monster-hero/src/game-system.jsx');
const index=read('monster-hero/index.html');
const version=JSON.parse(read('monster-hero/version.json'));
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
check('リザルト再プレイはclick captureで完全再マウント',script.includes("label==='もう一度プレイ'")&&script.includes('setRunKey(value=>value+1)'));
check('iPhoneポーズ3ボタンをtouchend captureで判定',script.includes("isPauseResume:label==='再開'")&&script.includes("isPauseRestart:label==='リスタート'")&&script.includes('中断して音ゲーデバッグへ戻る')&&script.includes("document.addEventListener('touchend',onTouchEnd,true)"));
check('ポーズの再開と中断は元React onClickへ橋渡し',script.includes('bridgePauseClick')&&script.includes('info.button.click()')&&script.includes('bridgingPauseClick'));
check('ポーズのリスタートは旧runを再利用せず完全再マウント',script.includes('if(info.isPauseRestart)')&&script.includes('remount(event)')&&script.includes('RHYTHM_GESTURE_RUNTIME.clear?.()'));
check('touchendを旧プレイ入力へ渡さず遮断',script.includes('if(event.cancelable)event.preventDefault()')&&script.includes('event.stopPropagation()')&&script.includes('event.stopImmediatePropagation?.()'));
check('touch後のghost click二重実行を抑止',script.includes('lastPauseTouchAt')&&script.includes('Date.now()-lastPauseTouchAt<800'));
check('元RhythmTapTestのunmount cleanupを維持',source.includes('return()=>{mountedRef.current=false;++generationRef.current;startLockRef.current=false;disposeRun();};'));
const releaseDate=release.match(/const RHYTHM_RELEASE_DATE='([^']+)'/)?.[1];
const dataBuild=release.match(/const RHYTHM_DATA_BUILD='([^']+)'/)?.[1];
const compiledBuild=release.match(/const RHYTHM_COMPILED_BUILD='([^']+)'/)?.[1];
const buildDate=source.match(/const BUILD_DATE = "([^"]+)";/)?.[1];
check('今回versionはリリース追記と一致',version.build===releaseDate&&version.build===dataBuild);
check('更新後だけ今回versionを既存compiledへ橋渡し',compiledBuild===buildDate&&release.includes('if(data?.build===RHYTHM_DATA_BUILD)')&&release.includes('build:RHYTHM_COMPILED_BUILD'));
check('将来versionを隠さない',!release.includes('if(data?.build!==RHYTHM_DATA_BUILD)'));
check('更新情報とヘルプにポーズ3ボタン修正を追記',release.includes('CHANGELOG.unshift')&&release.includes("item.id==='rhythm-mode'")&&release.includes('再開')&&release.includes('中断して音ゲーデバッグへ戻る'));
for(const rel of ['data/rhythm-result-replay-remount.js','data/rhythm-step3-release.js']){
  const file=path.join(ROOT,'monster-hero',rel),buf=fs.readFileSync(file),size=buf.length,hash=crypto.createHash('sha256').update(buf).digest('hex').slice(0,12);
  check(`${rel} のBOOT_SIZESが実サイズと一致`,index.includes(`"${rel}":${size}`));
  check(`${rel} のcache keyが内容hashと一致`,index.includes(`${rel}?v=${hash}`));
}
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
