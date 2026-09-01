#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..','..');
const ui=fs.readFileSync(path.join(ROOT,'monster-hero/debug/rhythm-chart-authoring-ui.js'),'utf8');
const calibration=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-geometry-calibration.js'),'utf8');
const timing=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8');
const draft=JSON.parse(fs.readFileSync(path.join(ROOT,'monster-hero/debug/atsu-cup-theme-easy-draft.json'),'utf8'));
const sourceDraft=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring/atsu-cup-theme-easy-draft.json'),'utf8'));

const ok=(name,value)=>{assert(value,name);console.log(`OK: ${name}`);};
ok('デバッグ画面だけへ譜面エディタをマウント',ui.includes("document.querySelector('[data-rhythm-debug]')")&&ui.includes("dataset.rhythmChartAuthoringUi='ready'"));
ok('通常プレイでは本体を読み込まずデバッグ画面で遅延ロード',calibration.includes("!document.querySelector('[data-rhythm-debug]')")&&calibration.includes("script.src='debug/rhythm-chart-authoring-ui.js?v=20260901a'"));
ok('固定timing正本を使い16分へ配置',ui.includes("TIMING_URL='data/rhythm-timing.js'")&&ui.includes('rhythmTimingAt')&&ui.includes('rhythmSnapTimeToGrid')&&timing.includes('subdivisionsPerBeat:4'));
ok('TAP/HOLD/FLICK/SLIDEを編集対象にする',['TAP','HOLD','FLICK','SLIDE'].every(type=>ui.includes(`<option>${type}</option>`)));
ok('10サブレーンと幅1〜4を編集可能',ui.includes('サブレーン 1〜10')&&ui.includes('min="1" max="10"')&&ui.includes("int(width.value,1,4)"));
ok('HOLDは終端時刻、SLIDEは始終点とslidePointsを生成',ui.includes("noteType==='HOLD'")&&ui.includes("type:'SLIDE'")&&ui.includes('slidePoints:['));
ok('iPhone向け操作サイズを確保',ui.includes('min-h-[44px]')&&ui.includes('min-h-[50px]')&&ui.includes('playsinline'));
ok('音源の拍シークと再生位置スナップを実装',ui.includes('data-rhythm-chart-seek-grid')&&ui.includes('data-rhythm-chart-capture-grid')&&ui.includes('audio.currentTime'));
ok('JSONと実装JSを書き出せる',ui.includes('data-rhythm-chart-copy-json')&&ui.includes('data-rhythm-chart-copy-js')&&ui.includes('authoringDraftChart'));
ok('デバッグ編集はセーブデータへ書き込まない',!ui.includes('localStorage.setItem')&&!ui.includes('mh_rhythm_best'));
ok('自動EASYドラフトの配信用スナップショットが制作元と一致',JSON.stringify(draft)===JSON.stringify(sourceDraft)&&draft.noteCount===100&&draft.runtimeConnected===false);
ok('自動ドラフトはタイミング確認用の中央仮配置として読み込む',ui.includes("lane:2,subLane:4,subLaneWidth:2")&&ui.includes('中央仮配置'));
ok('前回フリーズ対策を維持',calibration.includes('if(button.textContent!==label)button.textContent=label')&&!calibration.includes("button.textContent=enabled?'座標校正 ON':'座標校正';"));
console.log('OK: 音ゲー譜面エディタv1（拍配置・音源シーク・4種ノーツ・自動EASYドラフト・出力・フリーズ回帰）');
