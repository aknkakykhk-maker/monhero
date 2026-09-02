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
ok('速度・サイズ・タイミングを指定範囲と刻みへnormalize',game.includes("rhythmFiniteStep(source.noteSpeed,RHYTHM_NOTE_SPEED_MIN,RHYTHM_NOTE_SPEED_MAX,RHYTHM_NOTE_SPEED_STEP")&&game.includes('const RHYTHM_NOTE_SPEED_MIN=1;')&&game.includes('const RHYTHM_NOTE_SPEED_MAX=12;')&&game.includes('const RHYTHM_NOTE_SPEED_STEP=.1;')&&game.includes('rhythmFiniteStep(source.noteSize,80,120,5')&&game.includes('rhythmFiniteStep(source.judgmentTimingOffsetMs,-100,100,5'));
ok('デバッグ画面だけに44px以上の入口',game.includes('data-rhythm-options-open')&&game.includes("setGameState('RHYTHM_OPTIONS')")&&game.includes('min-h-[44px]'));
ok('下部固定操作バーと独立スクロール領域',game.includes('data-rhythm-options-scroll')&&game.includes('data-rhythm-options-actions')&&game.includes("env(safe-area-inset-bottom)")&&game.includes('data-rhythm-options-save'));
ok('数値5項目はスライダーではなく押しやすい−／＋操作',
  game.includes('const stepper=(key,min,max,step')
  &&['bgmVolume','noteSeVolume','noteSpeed','noteSize','judgmentTimingOffsetMs'].every(key=>game.includes(`stepper('${key}'`))
  &&game.includes('data-rhythm-option-stepper={key}')
  &&game.includes('min-h-[48px] min-w-[48px]')
  &&!game.match(/const RhythmOptions=[\s\S]*?const RhythmTapTest/)?.[0].includes('type="range"'));
ok('−／＋は現行刻みを使い上下限でclamp・無効化',
  game.includes('rhythmStepOptionValue(value,min,max,step,direction)')
  &&game.includes('disabled={value<=min}')
  &&game.includes('disabled={value>=max}'));
const stepperBlock=game.match(/const rhythmStepOptionValue=.*?;/)?.[0];
assert(stepperBlock,'数値step helperが存在する');
const stepperSandbox={};
vm.runInNewContext(`${stepperBlock}\nthis.stepValue=rhythmStepOptionValue;`,stepperSandbox);
const stepCases=[
  ['BGM音量',50,0,100,1,49,51],['タップ音量',70,0,100,1,69,71],
  ['ノーツ速度',6,1,12,.1,5.9,6.1],['ノーツサイズ',100,80,120,5,95,105],
  ['判定タイミング調整',0,-100,100,5,-5,5],
];
stepCases.forEach(([name,value,min,max,step,down,up])=>ok(`${name}の−／＋刻み`,stepperSandbox.stepValue(value,min,max,step,-1)===down&&stepperSandbox.stepValue(value,min,max,step,1)===up));
ok('全項目の最小・最大clamp',stepCases.every(([,value,min,max,step])=>stepperSandbox.stepValue(min,min,max,step,-1)===min&&stepperSandbox.stepValue(max,min,max,step,1)===max));
ok('簡易ゲージと現在値を常時表示',game.includes('role="meter"')&&game.includes('aria-valuenow={value}')&&game.includes('<output aria-live="polite"'));
ok('変更時に保存ボタンを明示',game.includes("data-dirty={dirty?'true':'false'}")&&game.includes("dirty?'変更を保存':'保存'"));
ok('試聴はボタンの直接イベントから既存音声経路を使う',game.includes('onClick={previewBgm}')&&game.includes("Audio_.startRhythmTrack('atsu_cup_theme',draft.bgmVolume)")&&game.includes('onClick={()=>RHYTHM_NOTE_SE_RUNTIME.preview(draft)}')&&data.includes('preview:settings=>play(settings)'));
ok('音ゲーBGM音量だけを専用gainへ反映(メインのbgmGainは経由しない)',
  game.includes('const raw=Math.max(0,Math.min(1,Number(rhythmVolumePct)/100))*safeTrackGain(track);')
  &&game.includes('rhythmGain.connect(ctx.destination);')
  &&game.includes('Audio_.startRhythmTrack(song.bgmTrackId,settings.bgmVolume)'));

const speedBlock=game.match(/const RHYTHM_NOTE_TRAVEL_BASE_MS=2150;[\s\S]*?const rhythmTravelMsForSpeed=value=>\{[\s\S]*?\n\};/);
ok('速度変換を独立した描画helperに集約',!!speedBlock&&game.includes('travelMs=rhythmTravelMsForSpeed(settings.noteSpeed)'));
const rangeBlock=game.match(/const RHYTHM_NOTE_SPEED_MIN=[\s\S]*?const RHYTHM_NOTE_SPEED_STEP=[^\n]*/);
ok('速度の範囲と刻みを定数へ集約',!!rangeBlock);
const sandbox={DEFAULT_RHYTHM_SETTINGS:{noteSpeed:6}};
vm.runInNewContext(`${rangeBlock[0]}\n${speedBlock[0]}\nthis.speed=rhythmTravelMsForSpeed;this.min=RHYTHM_NOTE_SPEED_MIN;this.max=RHYTHM_NOTE_SPEED_MAX;this.step=RHYTHM_NOTE_SPEED_STEP;`,sandbox);
const slowest=sandbox.speed(1),slow=sandbox.speed(3),normal=sandbox.speed(6),fast=sandbox.speed(10),fastest=sandbox.speed(12);
ok('速度1/3/6/10/12は7000/5000/2150/800/500msで明確な実効差',slowest===7000&&slow===5000&&normal===2150&&fast===800&&fastest===500);
ok('速度は1.0〜12.0を0.1刻みで扱う',sandbox.min===1&&sandbox.max===12&&Math.abs(sandbox.step-.1)<1e-9);
let speedMonotonic=true;
for(let value=sandbox.min;value<sandbox.max-sandbox.step/2;value+=sandbox.step){
  if(!(sandbox.speed(Math.round((value+sandbox.step)*10)/10)<sandbox.speed(Math.round(value*10)/10)))speedMonotonic=false;
}
ok('0.1刻みのどこでもtravelが必ず変わる',speedMonotonic);
ok('速度は判定関数・入力照合へ渡さない',!game.includes('rhythmJudgeTap(deltaMs,settings.noteSpeed)')&&!game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.noteSpeed)'));
ok('サイズはノーツ頭の描画scaleだけで、帯・ENDバー・入力hitboxへ渡さない',
  game.includes("'--rhythm-note-size-scale':settings.noteSize/100")
  &&data.includes('transform:scale(var(--rhythm-note-size-scale,1)) scaleY(var(--rhythm-note-depth-scale,1))')
  &&!game.includes('scale(${settings.noteSize/100})')
  &&!game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.noteSize'));
ok('表示と入力で同じ判定offsetを使い窓幅は不変',game.includes('visualTime=songTimeMs-settings.judgmentTimingOffsetMs')&&game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)')&&game.includes('const rhythmJudgeTap = deltaMs => RHYTHM_JUDGMENTS.find'));
ok('表示切替・レーン発光は入力を消さない',game.includes('settings.judgmentTextDisplay?view.last')&&game.includes('settings.fastSlowDisplay?(view.fastSlow')&&game.includes("settings.laneGlow==='NONE'?'0'")&&game.includes('inputStarts(starts)'));
ok('振動未対応を安全に扱う',game.includes('try{navigator.vibrate?.(8);}catch{}'));
ok('演出量は彩度だけでなくグローも段階化',game.includes("settings.effectAmount==='MINIMAL'?'none'")&&game.includes("settings.effectAmount==='LOW'?'0 0 8px #67e8f9'"));
ok('軽量モードはtransitionと複数グローを停止',game.includes("transition:settings.lightweightMode?'none'")&&game.match(/settings\.lightweightMode\|\|settings\.effectAmount==='MINIMAL'\?'none'/g)?.length>=4);
ok('軽量モードでもプレイ領域とDOM判定ラインを維持',game.includes('data-rhythm-lightweight')&&game.includes('data-rhythm-judgment-line')&&game.includes('data-rhythm-note'));
ok('仕様書へSTEP1と正式HOME未接続を記録',docs.includes('オプション STEP1')&&docs.includes('通常HOMEや一般公開導線には接続しない')&&docs.includes('正式HOMEへの入口と、正式公開時の最終デザインは未実装'));
console.log(`OK: 音ゲーオプション STEP1 runtime / speed ${slow}ms -> ${normal}ms -> ${fast}ms`);
