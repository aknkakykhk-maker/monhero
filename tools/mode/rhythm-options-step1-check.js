#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..','..');
const game=fs.readFileSync(path.join(ROOT,'monster-hero','src','game-system.jsx'),'utf8');
const data=fs.readFileSync(path.join(ROOT,'monster-hero','data','rhythm-mode.js'),'utf8');
const docs=fs.readFileSync(path.join(ROOT,'docs','spec','RHYTHM_MODE.md'),'utf8');
const ok=(name,value)=>{assert(value,name);console.log(`OK: ${name}`);};

ok('既存設定キーを後方互換で拡張',game.includes("RHYTHM_SETTINGS_KEY = 'mh_rhythm_settings_v1'")&&game.includes("noteSeEnabled:bool('noteSeEnabled')")&&game.includes('DEFAULT_RHYTHM_SETTINGS'));
ok('STEP1項目と現行相当の既定値',game.includes('bgmVolume:100, noteSpeed:6, noteSize:100')&&game.includes('vibrationEnabled:false')&&game.includes("laneGlow:'NORMAL'")&&game.includes("effectAmount:'NORMAL', lightweightMode:false"));
ok('速度・サイズ・タイミングを指定範囲と刻みへnormalize',game.includes("rhythmFiniteStep(source.noteSpeed,3,10,.5")&&game.includes('rhythmFiniteStep(source.noteSize,80,120,5')&&game.includes('rhythmFiniteStep(source.judgmentTimingOffsetMs,-100,100,5'));
ok('デバッグ画面だけに44px以上の入口',game.includes('data-rhythm-options-open')&&game.includes("setGameState('RHYTHM_OPTIONS')")&&game.includes('min-h-[44px]'));
ok('下部固定操作バーと独立スクロール領域',game.includes('data-rhythm-options-scroll')&&game.includes('data-rhythm-options-actions')&&game.includes("env(safe-area-inset-bottom)")&&game.includes('data-rhythm-options-save'));
ok('変更時に保存ボタンを明示',game.includes("data-dirty={dirty?'true':'false'}")&&game.includes("dirty?'変更を保存':'保存'"));
ok('試聴はボタンの直接イベントから既存音声経路を使う',game.includes('onClick={previewBgm}')&&game.includes("Audio_.startRhythmTrack('atsu_cup_theme',draft.bgmVolume)")&&game.includes('onClick={()=>RHYTHM_NOTE_SE_RUNTIME.preview(draft)}')&&data.includes('preview:settings=>play(settings)'));
ok('音ゲーBGM音量だけを専用gainへ反映',game.includes('rhythmGain.gain.value=Math.max(0,Math.min(1,Number(rhythmVolumePct)/100))')&&game.includes('Audio_.startRhythmTrack(song.bgmTrackId,settings.bgmVolume)'));

const speedBlock=game.match(/const RHYTHM_NOTE_TRAVEL_BASE_MS=2150;[\s\S]*?const rhythmTravelMsForSpeed=value=>\{[\s\S]*?\n\};/);
ok('速度変換を独立した描画helperに集約',!!speedBlock&&game.includes('travelMs=rhythmTravelMsForSpeed(settings.noteSpeed)'));
const sandbox={};
vm.runInNewContext(`${speedBlock[0]}\nthis.speed=rhythmTravelMsForSpeed;`,sandbox);
const slow=sandbox.speed(3),normal=sandbox.speed(6),fast=sandbox.speed(10);
ok('速度3/6/10は3200/2150/1200msで明確な実効差',slow===3200&&normal===2150&&fast===1200&&slow>normal&&normal>fast);
ok('速度は判定関数・入力照合へ渡さない',!game.includes('rhythmJudgeTap(deltaMs,settings.noteSpeed)')&&!game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.noteSpeed)'));
ok('サイズは描画scaleだけで入力hitboxへ渡さない',game.includes('scale(${settings.noteSize/100})')&&!game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.noteSize'));
ok('表示と入力で同じ判定offsetを使い窓幅は不変',game.includes('visualTime=songTimeMs-settings.judgmentTimingOffsetMs')&&game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)')&&game.includes('const rhythmJudgeTap = deltaMs => RHYTHM_JUDGMENTS.find'));
ok('表示切替・レーン発光は入力を消さない',game.includes('settings.judgmentTextDisplay?view.last')&&game.includes('settings.fastSlowDisplay?(view.fastSlow')&&game.includes("settings.laneGlow==='NONE'?'0'")&&game.includes('inputStarts(starts)'));
ok('振動未対応を安全に扱う',game.includes('try{navigator.vibrate?.(8);}catch{}'));
ok('演出量は彩度だけでなくグローも段階化',game.includes("settings.effectAmount==='MINIMAL'?'none'")&&game.includes("settings.effectAmount==='LOW'?'0 0 8px #67e8f9'"));
ok('軽量モードはtransitionと複数グローを停止',game.includes("transition:settings.lightweightMode?'none'")&&game.match(/settings\.lightweightMode\|\|settings\.effectAmount==='MINIMAL'\?'none'/g)?.length>=4);
ok('軽量モードでもプレイ領域とDOM判定ラインを維持',game.includes('data-rhythm-lightweight')&&game.includes('data-rhythm-judgment-line')&&game.includes('data-rhythm-note'));
ok('仕様書へSTEP1と正式HOME未接続を記録',docs.includes('オプション STEP1')&&docs.includes('通常HOMEや一般公開導線には接続しない')&&docs.includes('正式HOMEへの入口と、正式公開時の最終デザインは未実装'));
console.log(`OK: 音ゲーオプション STEP1 runtime / speed ${slow}ms -> ${normal}ms -> ${fast}ms`);
