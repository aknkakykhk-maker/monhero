#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..','..');
const game=fs.readFileSync(path.join(ROOT,'monster-hero','src','game-system.jsx'),'utf8');
const data=fs.readFileSync(path.join(ROOT,'monster-hero','data','rhythm-mode.js'),'utf8');
const docs=fs.readFileSync(path.join(ROOT,'docs','spec','RHYTHM_MODE.md'),'utf8');
const ok=(name,value)=>{assert(value,name);console.log(`OK: ${name}`);};

ok('既存設定キーを後方互換で拡張',game.includes("RHYTHM_SETTINGS_KEY = 'mh_rhythm_settings_v1'")&&game.includes("noteSeEnabled:bool('noteSeEnabled')")&&game.includes('DEFAULT_RHYTHM_SETTINGS'));
ok('STEP1項目と現行相当の既定値',game.includes('bgmVolume:100, noteSpeed:6, noteSize:100')&&game.includes('vibrationEnabled:false')&&game.includes("laneGlow:'NORMAL'")&&game.includes("effectAmount:'NORMAL', lightweightMode:false"));
ok('速度・サイズ・タイミングを指定範囲と刻みへnormalize',game.includes("rhythmFiniteStep(source.noteSpeed,3,10,.5")&&game.includes('rhythmFiniteStep(source.noteSize,80,120,5')&&game.includes('rhythmFiniteStep(source.judgmentTimingOffsetMs,-100,100,5'));
ok('4カードと保存・未保存リセットを備える',game.includes('🔊 音量')&&game.includes('🎯 プレイ')&&game.includes('👁 表示')&&game.includes('✨ 演出・端末')&&game.includes("setDraft(normalizeRhythmSettings(DEFAULT_RHYTHM_SETTINGS))")&&game.includes('await onSave(draft)'));
ok('デバッグ画面だけに44px以上の入口',game.includes('data-rhythm-options-open')&&game.includes("setGameState('RHYTHM_OPTIONS')")&&game.includes('min-h-[44px]'));
ok('試聴はボタンの直接イベントから既存音声経路を使う',game.includes('onClick={previewBgm}')&&game.includes("Audio_.startRhythmTrack('atsu_cup_theme',draft.bgmVolume)")&&game.includes('onClick={()=>RHYTHM_NOTE_SE_RUNTIME.preview(draft)}')&&data.includes('preview:settings=>play(settings)'));
ok('音ゲーBGM音量だけを専用gainへ反映',game.includes('rhythmGain.gain.value=Math.max(0,Math.min(1,Number(rhythmVolumePct)/100))')&&game.includes('Audio_.startRhythmTrack(song.bgmTrackId,settings.bgmVolume)'));
ok('速度は見た目のtravelMsだけを変更',game.includes('travelMs=Math.max(650,2690-settings.noteSpeed*90)')&&!game.includes('rhythmJudgeTap(deltaMs,settings.noteSpeed)'));
ok('サイズは描画scaleだけで入力hitboxへ渡さない',game.includes('scale(${settings.noteSize/100})')&&!game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.noteSize'));
ok('表示と入力で同じ判定offsetを使い窓幅は不変',game.includes('visualTime=songTimeMs-settings.judgmentTimingOffsetMs')&&game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)')&&game.includes('const rhythmJudgeTap = deltaMs => RHYTHM_JUDGMENTS.find'));
ok('表示切替・レーン発光は入力を消さない',game.includes('settings.judgmentTextDisplay?view.last')&&game.includes('settings.fastSlowDisplay?(view.fastSlow')&&game.includes("settings.laneGlow==='NONE'?'0'")&&game.includes('inputStarts(starts)'));
ok('振動未対応を安全に扱う',game.includes('try{navigator.vibrate?.(8);}catch{}'));
ok('演出量を表示効果だけへ適用',game.includes("settings.effectAmount==='MINIMAL'?'saturate(.78)'")&&game.includes('data-rhythm-effect={settings.effectAmount}'));
ok('軽量モードでもプレイ領域とDOM判定ラインを維持',game.includes('data-rhythm-lightweight')&&game.includes("transition:settings.lightweightMode?'none'")&&game.includes('data-rhythm-judgment-line')&&game.includes('data-rhythm-note'));
ok('仕様書へSTEP1と正式HOME未接続を記録',docs.includes('オプション STEP1')&&docs.includes('通常HOMEや一般公開導線には接続しない')&&docs.includes('正式HOMEへの入口と、正式公開時の最終デザインは未実装'));
console.log('OK: 音ゲーオプション STEP1');
