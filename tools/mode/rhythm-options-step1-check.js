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
ok('速度・サイズ・タイミングを指定範囲と刻みへnormalize',game.includes("rhythmFiniteStep(source.noteSpeed,RHYTHM_NOTE_SPEED_MIN,RHYTHM_NOTE_SPEED_MAX,RHYTHM_NOTE_SPEED_STEP")&&game.includes('const RHYTHM_NOTE_SPEED_MIN=1;')&&game.includes('const RHYTHM_NOTE_SPEED_MAX=12;')&&game.includes('const RHYTHM_NOTE_SPEED_STEP=.1;')&&game.includes('rhythmFiniteStep(source.noteSize,80,120,5')&&game.includes('rhythmFiniteStep(source.judgmentTimingOffsetMs,-RHYTHM_TIMING_OFFSET_MAX_MS,RHYTHM_TIMING_OFFSET_MAX_MS,RHYTHM_TIMING_OFFSET_STEP_MS')
  &&game.includes('const RHYTHM_TIMING_OFFSET_MAX_MS = 100;')&&game.includes('const RHYTHM_TIMING_OFFSET_STEP_MS = 1;'));
ok('デバッグ画面だけに44px以上の入口',game.includes('data-rhythm-options-open')&&game.includes("setGameState('RHYTHM_OPTIONS')")&&game.includes('min-h-[44px]'));
ok('下部固定操作バーと独立スクロール領域',game.includes('data-rhythm-options-scroll')&&game.includes('data-rhythm-options-actions')&&game.includes("env(safe-area-inset-bottom)")&&game.includes('data-rhythm-options-save'));
// 当初は「−／＋だけ」にしていたが、実機で「プラスマイナスでしか変えられないからめんどう」という
// 指摘があり(2026-09-04)、スライダーを足した。押しやすい−／＋は微調整用に残す。
// 2026-09-13・ユーザーが実際の音ゲーの画面を示して「オプションはこういうのを参考にしたい」。
// ±1つずつの形をやめ、**粗く動かす／細かく動かす**の4つのボタン(-10 -1 値 +1 +10)にした。
// 音量(0〜200)のように幅の広い項目を、±1だけで動かすと何十回も押すことになるため。
ok('数値5項目は粗細4つのボタンとスライダーで変えられる',
  game.includes('const stepper=(key,min,max,step,{fine=step,coarse=step*10')
  &&['bgmVolume','noteSeVolume','noteSpeed','noteSize','judgmentTimingOffsetMs'].every(key=>game.includes(`stepper('${key}'`))
  // 音量は0〜200(2026-09-12・ユーザー指示)。100の意味は今までと同じで、上へ広げただけ
  &&game.includes("stepper('bgmVolume',0,RHYTHM_VOLUME_MAX,1,{fine:1,coarse:10})")
  &&game.includes("stepper('noteSeVolume',0,RHYTHM_VOLUME_MAX,1,{fine:1,coarse:10})")
  &&game.includes('rhythmFiniteStep(source.bgmVolume,0,RHYTHM_VOLUME_MAX,1')
  &&game.includes('rhythmFiniteStep(source.noteSeVolume,0,RHYTHM_VOLUME_MAX,1')
  &&game.includes('data-rhythm-option-stepper={key}')
  // 押す場所は44px以上を保つ(字を詰めて入れる量を増やさない)
  &&game.includes("${wide?'min-h-[38px]':'min-h-[46px]'} rounded-xl border ${dim?'border-white/25 bg-slate-300 text-slate-900':'border-white/40 bg-slate-100 text-slate-900'}")
  &&game.includes('<input type="range" data-rhythm-option-slider={key}'));
ok('4つのボタンは保存する刻みへ丸め、上下限で無効になる',
  game.includes('rhythmNudgeOptionValue(value,min,max,step,amount)')
  &&game.includes('disabled={amount<0?value<=min:value>=max}'));
const stepperBlock=game.match(/const rhythmSnapOptionValue=[\s\S]*?\nconst rhythmNudgeOptionValue=[^\n]*\n/)?.[0];
assert(stepperBlock,'数値を動かすhelperが存在する');
const stepperSandbox={};
vm.runInNewContext(`${stepperBlock}\nthis.nudge=rhythmNudgeOptionValue;`,stepperSandbox);
// [名前, いまの値, min, max, 刻み, 細かく動かす量, 粗く動かす量, 細かく下げた値, 粗く上げた値]
const stepCases=[
  ['BGM音量',50,0,200,1,1,10,49,60],['タップ音量',70,0,200,1,1,10,69,80],
  ['ノーツ速度',6,1,12,.1,.1,1,5.9,7],['ノーツサイズ',100,80,120,5,5,10,95,110],
  ['判定タイミング調整',0,-100,100,1,1,10,-1,10],
];
stepCases.forEach(([name,value,min,max,step,fine,coarse,down,up])=>ok(`${name}の粗細の動き`,
  stepperSandbox.nudge(value,min,max,step,-fine)===down&&stepperSandbox.nudge(value,min,max,step,coarse)===up));
ok('全項目の最小・最大clamp',stepCases.every(([,,min,max,step,,coarse])=>
  stepperSandbox.nudge(min,min,max,step,-coarse)===min&&stepperSandbox.nudge(max,min,max,step,coarse)===max));
// 簡易ゲージはスライダーの溝そのものになった(いまの値までを色で塗り分ける)。
// input[type=range] は現在値・最小・最大を暗黙で読み上げるので、role="meter" は要らない。
ok('現在量が溝の色で見えて、現在値も常時表示',
  game.includes('<input type="range" data-rhythm-option-slider={key}')
  &&game.includes('min={min} max={max} step={step} value={value}')
  &&game.includes('linear-gradient(90deg,#d946ef 0%,#22d3ee ${percent}%')
  &&game.includes('aria-label={`${key}を変える`}')
  &&game.includes('<output aria-live="polite"'));
ok('変更時に保存ボタンを明示',game.includes("data-dirty={dirty?'true':'false'}")&&game.includes("dirty?'変更を保存':'保存'"));
ok('試聴はボタンの直接イベントから既存音声経路を使う',game.includes('onClick={previewBgm}')&&game.includes("Audio_.startRhythmTrack('atsu_cup_theme',draft.bgmVolume)")&&game.includes('onClick={()=>RHYTHM_NOTE_SE_RUNTIME.preview(draft)}')&&data.includes('preview:settings=>play(settings)'));
// 2026-09-12: 音量の上限を200まで開けた(ユーザー指示)。100までの値は今までとまったく同じで、
// クランプの上限だけが 1 → RHYTHM_VOLUME_MAX/100 へ広がっている。
ok('音ゲーBGM音量だけを専用gainへ反映(メインのbgmGainは経由しない)',
  game.includes('const raw=Math.max(0,Math.min(RHYTHM_VOLUME_MAX/100,Number(rhythmVolumePct)/100))*safeTrackGain(track);')
  // 2026-09-11: 「音が出ないとき」の音量メーターを足したとき、出口が masterOut(計測用の
  // ノード)経由になった。メーターが無い環境では ctx.destination へ落ちる。
  // どちらでも「メインの bgmGain を経由していない」ことに変わりはないので、両方を通す
  &&(game.includes('rhythmGain.connect(masterOut||ctx.destination);')
     ||game.includes('rhythmGain.connect(ctx.destination);'))
  &&!/rhythmGain\.connect\(bgmGain/.test(game)
  // 2026-09-05: 曲は「画面が組み上がってから」鳴らすので autoStart:false を渡している。
  // 音量が専用gainへ渡るところは変わっていない
  &&game.includes('Audio_.startRhythmTrack(song.bgmTrackId,settings.bgmVolume,{autoStart:false})'));

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
ok('表示切替・レーン発光は入力を消さない',game.includes('settings.judgmentTextDisplay?view.last')&&game.includes('settings.fastSlowDisplay?(view.fastSlow')&&game.includes("settings.laneGlow==='NONE'?'0'")&&game.includes('inputStarts(starts,ageMs)'));
// 振動は 2026-09-05 に作り直した（iPhoneには Vibration API が無く、8msは短すぎた）。
// 見ているのは「対応していない端末で落ちない・黙って何も起きないままにしない」こと。
ok('振動未対応を安全に扱う',
  game.includes('const RHYTHM_HAPTICS=')
  &&game.includes("typeof navigator.vibrate==='function'")
  &&game.includes('try{navigator.vibrate(ms);}catch{}')
  &&game.includes("'switch' in input")
  &&game.includes('data-rhythm-vibration-unsupported'));
ok('演出量は彩度だけでなくグローも段階化',game.includes("settings.effectAmount==='MINIMAL'?'none'")&&game.includes("settings.effectAmount==='LOW'?'0 0 8px #67e8f9'"));
ok('軽量モードはtransitionと複数グローを停止',game.includes("transition:settings.lightweightMode?'none'")&&game.match(/settings\.lightweightMode\|\|settings\.effectAmount==='MINIMAL'\?'none'/g)?.length>=4);
ok('軽量モードでもプレイ領域とDOM判定ラインを維持',game.includes('data-rhythm-lightweight')&&game.includes('data-rhythm-judgment-line')&&game.includes('data-rhythm-note'));
ok('仕様書へSTEP1と正式HOME未接続を記録',docs.includes('オプション STEP1')&&docs.includes('通常HOMEや一般公開導線には接続しない')&&docs.includes('正式HOMEへの入口と、正式公開時の最終デザインは未実装'));
// --- タップのタイミング合わせ(2026-09-05・ユーザー指示) ---
// 「レーンとノーツに合わせて何回かタップして調整するみたいなやつ」。
// 計算の部分だけを取り出して、実際に動かして確かめる。
{
  const block=game.match(/const RHYTHM_CALIBRATION_MAX_MS=[\s\S]*?const rhythmCalibrationOffsetFromTaps=[\s\S]*?^};$/m)?.[0];
  ok('タイミング合わせの計算を抽出できる',!!block);
  if(block){
    const calCtx={};
    vm.runInNewContext(`const RHYTHM_TIMING_OFFSET_MAX_MS=100,RHYTHM_TIMING_OFFSET_STEP_MS=1;\n${block}\nthis.out={rhythmCalibrationOffsetFromTaps,RHYTHM_CALIBRATION_MAX_MS,RHYTHM_CALIBRATION_STEP_MS,RHYTHM_CALIBRATION_STABLE_SPREAD_MS};`,calCtx);
    const O=calCtx.out;
    // 回数と助走は譜面側(data/rhythm-mode.js)が持つ
    const tapCount=Number((data.match(/const RHYTHM_CALIBRATION_TAP_COUNT=(\d+);/)||[])[1]);
    const warmup=Number((data.match(/const RHYTHM_CALIBRATION_WARMUP_COUNT=(\d+);/)||[])[1]);
    const many=(value,count=tapCount)=>Array.from({length:count},()=>value);
    // 2026-09-13・ユーザー指示「タップ調整ももっと精度良くつくって」。
    // 8回→16回、助走4回を捨てる、5ms刻み→1ms刻み、外れ値はMADで落とす。
    ok('数に入れる回数を増やし、助走を捨てている',tapCount>=16&&warmup>=4);
    ok('出す値の範囲と刻みは設定と同じ(1ms刻み)',O.RHYTHM_CALIBRATION_MAX_MS===100&&O.RHYTHM_CALIBRATION_STEP_MS===1);
    ok('叩いていなければ何も出さない',O.rhythmCalibrationOffsetFromTaps([])===null);
    ok('いつも30ms遅いなら+30msになる',O.rhythmCalibrationOffsetFromTaps(many(30)).offsetMs===30);
    ok('いつも20ms早いなら-20msになる',O.rhythmCalibrationOffsetFromTaps(many(-20)).offsetMs===-20);
    // 1回の押し間違いで全部が狂わないこと(中央値からの離れ具合で落とす)
    const withMistake=O.rhythmCalibrationOffsetFromTaps([...many(30,15),900]);
    ok('1回の押し間違いに引きずられない',withMistake.offsetMs===30&&withMistake.droppedCount===1);
    // ★きれいに叩けている回を外れ値にしない。上下1つずつ機械的に落とす作りだと、
    //   ここで「1回も間違えていないのに2回捨てる」ことになっていた
    const clean=O.rhythmCalibrationOffsetFromTaps([...many(30,8),...many(32,8)]);
    ok('間違えていないときは1回も捨てない',clean.droppedCount===0&&clean.usedCount===16);
    ok('1ms刻みで出す(5ms刻みへ丸めない)',
      O.rhythmCalibrationOffsetFromTaps(many(23)).offsetMs===23);
    // ばらつきを出す。合わせられているかを画面で伝えるため
    ok('ばらつきを出す',
      O.rhythmCalibrationOffsetFromTaps(many(30)).spreadMs===0
      &&O.rhythmCalibrationOffsetFromTaps(many(30)).stable===true);
    const noisy=O.rhythmCalibrationOffsetFromTaps([-60,-40,-20,0,20,40,60,80,-55,-35,-15,5,25,45,65,85]);
    ok('ばらつきが大きいときは「安定していない」と分かる',noisy.stable===false&&noisy.spreadMs>O.RHYTHM_CALIBRATION_STABLE_SPREAD_MS);
    ok('設定の範囲(±100ms)を超えない',
      O.rhythmCalibrationOffsetFromTaps(many(500)).offsetMs===100
      &&O.rhythmCalibrationOffsetFromTaps(many(-500)).offsetMs===-100);
    // 数でない値が混ざっても、混ざっていないときと同じ結果になること
    ok('数でない値は数えない',
      O.rhythmCalibrationOffsetFromTaps([10,null,'x',10,undefined,10]).offsetMs
      ===O.rhythmCalibrationOffsetFromTaps([10,10,10]).offsetMs);
  }
  // 2026-09-13: 専用の小さな画面をやめ、演奏画面をそのまま使う形にした
  // (ユーザー指示「普通に実際の画面を使ってやればいい / そこで判定も合わせて出して調整する」)。
  // 貯める先は**演奏の状態(run)**。画面の状態(view)へ足すと、叩いた瞬間に
  // `Cannot read properties of undefined (reading 'push')` で applyJudgment が止まり、
  // 判定もコンボも出ず、曲の終わりでも落ちて進行不能になる(2026-09-13に実際に出した)
  ok('ずれは演奏側が判定に使っている値をそのまま貯める',
    game.includes("if(calibrating&&judgment!=='MISS'&&typeof deltaMs==='number'&&Number.isFinite(deltaMs)){if(!Array.isArray(run.deltas))run.deltas=[];run.deltas.push(deltaMs);}"));
  ok('貯める先は演奏の状態(run)で、画面の状態(view)ではない',
    /runRef\.current=\{[^}]*deltas:\[\]/.test(game)&&!/initialView=\(\)=>\(\{[^}]*deltas:/.test(game));
  ok('助走ぶんを捨ててから値を出す',
    game.includes('rhythmCalibrationOffsetFromTaps((Array.isArray(run.deltas)?run.deltas:[]).slice(RHYTHM_CALIBRATION_WARMUP_COUNT))'));
  ok('専用の譜面を演奏画面で流す(判定もFAST/SLOWもいつもどおり出る)',
    data.includes('const RHYTHM_CALIBRATION_SONG=Object.freeze({')
    &&data.includes("songId:'rhythm_calibration'")
    &&game.includes("calibrating={rhythmPlay.from==='calibration'}"));
  ok('ばらつきが大きいときはやり直しを勧める',game.includes('ばらつきが大きめです'));
  ok('オプションから「実際の画面で合わせる」を開ける',
    game.includes('data-rhythm-calibrator-open')&&game.includes('実際の画面で合わせる')
    &&game.includes('onClick={goCalibrate}'));
  // 2026-09-13・ユーザー指摘「設定にもなってない」。測り終わった画面でそのまま決める
  ok('測った値と、入れるかどうかのボタンを測り終わった画面で出す',
    ['data-rhythm-calibration-result','data-rhythm-calibration-offset','data-rhythm-calibration-apply',
     'data-rhythm-calibration-retry','data-rhythm-calibration-cancel'].every(hook=>game.includes(hook)));
  ok('オプションへ戻ったら入れた値が分かる',
    game.includes('data-rhythm-calibrator-result')&&game.includes('にしました'));
  ok('測った値は判定タイミング調整へ入る(新しい設定を増やさない)',
    game.includes('judgmentTimingOffsetMs:offsetMs')&&!/mh_rhythm_calibration/.test(game));
  // チュートリアルの流用にしない(2026-09-13・ユーザー指摘「チュートリアルの流用？」)
  ok('チュートリアルの説明ではなく専用の案内を出す',
    game.includes('data-rhythm-calibration-banner')&&game.includes('data-rhythm-calibration-title')
    &&game.includes("tutorial={rhythmPlay.from==='tutorial'}")
    &&!game.includes("tutorial={rhythmPlay.from==='tutorial'||rhythmPlay.from==='calibration'}"));
  ok('タイミング合わせでもライフは減らない(途中で落ちて測れなくならない)',
    game.includes('run.life=(tutorial||calibrating)?RHYTHM_LIFE_MAX:')
    &&game.includes('const failed=!tutorial&&!calibrating&&run.lifeDepleted===true;'));
}

console.log(`OK: 音ゲーオプション STEP1 runtime / speed ${slow}ms -> ${normal}ms -> ${fast}ms`);
