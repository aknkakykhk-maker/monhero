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
// ここは以前「ボタンの文言で見分けていること」を要求していた。
// そのせいでポーズの文言を「中断して音ゲーデバッグへ戻る」から
// 「曲えらびへ戻る」「練習をやめて曲えらびへ戻る」へ変えたとき、
// 橋渡しが外れて iPhone で戻るが効かなくなったのに検査は通ってしまった
// (2026-09-05・実機の指摘)。見分けは文言ではなく data-rhythm-pause-* で行う。
// 実際に橋渡しが働くかどうかは tools/mode/rhythm-pause-bridge-check.js が
// 本物のReactとブラウザのイベントで確かめる。
check('iPhoneポーズ3ボタンをtouchend captureで判定',
  script.includes('data-rhythm-pause-restart')&&script.includes('data-rhythm-pause-resume')&&script.includes('data-rhythm-pause-exit')
  &&script.includes("document.addEventListener('touchend',onTouchEnd,true)"));
check('ポーズの3ボタンには見分けるための印が付いている',
  source.includes('data-rhythm-pause-resume')&&source.includes('data-rhythm-pause-restart')&&source.includes('data-rhythm-pause-exit'));
check('見分けられないポーズのボタンは素のclickを潰さない',
  script.includes('if(!info.isPauseKnown)return;')&&script.includes('info.isPauseKnown&&info.button===lastPauseButton'));
check('ポーズの再開と中断は元React onClickへ橋渡し',script.includes('bridgePauseClick')&&script.includes('info.button.click()')&&script.includes('bridgingPauseClick'));
check('ポーズのリスタートは旧runを再利用せず完全再マウント',script.includes('if(info.isPauseRestart)')&&script.includes('remount(event)')&&script.includes('RHYTHM_GESTURE_RUNTIME.clear?.()'));
check('touchendを旧プレイ入力へ渡さず遮断',script.includes('if(event.cancelable)event.preventDefault()')&&script.includes('event.stopPropagation()')&&script.includes('event.stopImmediatePropagation?.()'));
check('touch後のghost click二重実行を抑止',script.includes('lastPauseTouchAt')&&script.includes('Date.now()-lastPauseTouchAt<800'));
check('元RhythmTapTestのunmount cleanupを維持',source.includes('return()=>{mountedRef.current=false;++generationRef.current;startLockRef.current=false;disposeRun();};'));
const releaseDate=release.match(/const RHYTHM_RELEASE_DATE='([^']+)'/)?.[1];
const dataBuild=release.match(/const RHYTHM_DATA_BUILD='([^']+)'/)?.[1];
const compiledBuild=release.match(/const RHYTHM_COMPILED_BUILD='([^']+)'/)?.[1];
const buildDate=source.match(/const BUILD_DATE = "([^"]+)";/)?.[1];
const bridgeTargetsCurrentVersion=version.build===dataBuild;
check('data-only橋渡し対象versionはリリース追記と一致',!bridgeTargetsCurrentVersion||version.build===releaseDate);
check('data-only橋渡し使用時は既存compiledへ正しく写す',!bridgeTargetsCurrentVersion||(compiledBuild===buildDate&&release.includes('if(data?.build===RHYTHM_DATA_BUILD)')&&release.includes('build:RHYTHM_COMPILED_BUILD')));
check('将来versionを隠さない',!release.includes('if(data?.build!==RHYTHM_DATA_BUILD)'));
const help=read('monster-hero/data/help.js');
check('ヘルプにポーズ・リスタート対応を記載',help.includes("id:'rhythm-mode'")&&help.includes('ポーズ')&&help.includes('リスタート'));
for(const rel of ['data/rhythm-result-replay-remount.js','data/rhythm-step3-release.js']){
  const file=path.join(ROOT,'monster-hero',rel),buf=fs.readFileSync(file),size=buf.length,hash=crypto.createHash('sha256').update(buf).digest('hex').slice(0,12);
  check(`${rel} のBOOT_SIZESが実サイズと一致`,index.includes(`"${rel}":${size}`));
  check(`${rel} のcache keyが内容hashと一致`,index.includes(`${rel}?v=${hash}`));
}
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
