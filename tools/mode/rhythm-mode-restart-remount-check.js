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
check('リザルト再プレイはclick captureで完全再マウント',script.includes("label==='もう一度プレイ'")&&script.includes("button.closest?.('[data-rhythm-result]')")&&script.includes('setRunKey(value=>value+1)'));
check('iPhoneポーズリスタートはtouchend captureで直接処理',script.includes("label==='リスタート'")&&script.includes("button.closest?.('[data-rhythm-pause-menu]')")&&script.includes("document.addEventListener('touchend',onTouchEnd,true)"));
check('touchendを旧プレイ入力へ渡さず遮断',script.includes('if(event.cancelable)event.preventDefault()')&&script.includes('event.stopPropagation()')&&script.includes('event.stopImmediatePropagation?.()'));
check('touch後のsynthetic click二重再起動を抑止',script.includes('lastTouchRestartAt')&&script.includes('Date.now()-lastTouchRestartAt<800'));
check('再マウント前にgesture runtimeをclear',script.includes('RHYTHM_GESTURE_RUNTIME.clear?.()'));
check('元RhythmTapTestのunmount cleanupを維持',source.includes('return()=>{mountedRef.current=false;++generationRef.current;startLockRef.current=false;disposeRun();};'));
const releaseDate=release.match(/const RHYTHM_RELEASE_DATE='([^']+)'/)?.[1];
const dataBuild=release.match(/const RHYTHM_DATA_BUILD='([^']+)'/)?.[1];
const compiledBuild=release.match(/const RHYTHM_COMPILED_BUILD='([^']+)'/)?.[1];
const buildDate=source.match(/const BUILD_DATE = "([^"]+)";/)?.[1];
check('今回versionはリリース追記と一致',version.build===releaseDate&&version.build===dataBuild);
check('更新後だけ今回versionを既存compiledへ橋渡し',compiledBuild===buildDate&&release.includes('if(data?.build===RHYTHM_DATA_BUILD)')&&release.includes('build:RHYTHM_COMPILED_BUILD'));
check('将来versionを隠さない',!release.includes('if(data?.build!==RHYTHM_DATA_BUILD)'));
check('更新情報とヘルプにiPhoneポーズ修正を追記',release.includes('CHANGELOG.unshift')&&release.includes("item.id==='rhythm-mode'")&&release.includes('touchend'));
for(const rel of ['data/rhythm-result-replay-remount.js','data/rhythm-step3-release.js']){
  const file=path.join(ROOT,'monster-hero',rel),buf=fs.readFileSync(file),size=buf.length,hash=crypto.createHash('sha256').update(buf).digest('hex').slice(0,12);
  check(`${rel} のBOOT_SIZESが実サイズと一致`,index.includes(`"${rel}":${size}`));
  check(`${rel} のcache keyが内容hashと一致`,index.includes(`${rel}?v=${hash}`));
}
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
