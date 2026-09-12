#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const releaseSource=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-step3-release.js'),'utf8');
const gameSource=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};

check('空押しSEは既存の音ゲーSE runtimeと設定を共用',source.includes('const playEmpty=()=>')&&source.includes('beginInputGroup')&&source.includes('endInputGroup')&&source.includes('_readSettings:readSettings'));
check('空押しSEはノーツ未取得の新規入力と境界越え再判定の対象なし時に呼ぶ',gameSource.includes('if(!target){RHYTHM_NOTE_SE_RUNTIME.playEmpty()')&&gameSource.includes('if(state.empty)inputStarts([{lane:Math.floor(subLane/2),subLaneCoordinate,inputKey}]'));
check('TAP後は次の境界で再判定し、操作中ノーツの指は横取りしない',gameSource.includes("empty:!target||target.type==='TAP'")&&gameSource.includes("if(state.empty)inputStarts(")&&gameSource.includes("if(subLane===state.subLane)return"));
check('ノーツ取得時は従来SEだけを鳴らす',source.includes('RHYTHM_NOTE_SE_RUNTIME.play();\n    return {input,target:picked,deltaMs:now-(picked.timeMs+offset)};'));
check('空押しSEは短いノイズ系Web Audio',source.includes('const duration=.055')&&source.includes("filter.type='bandpass'")&&source.includes('audio.createBufferSource()'));
check('接触幅の1物理イベントは空押しをまとめ、成功があれば空押しを抑止',source.includes('inputGroupDepth')&&source.includes('inputGroupHit')&&source.includes('markInputGroupHandled')&&source.includes('return handled?true:emitEmpty()'));

let saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:70});
let contextCount=0,startCount=0,lastGain=0;
class FakeParam{
  setValueAtTime(value){lastGain=Number(value)||0;}
  exponentialRampToValueAtTime(){}
}
class FakeNode{
  connect(){}
  disconnect(){}
}
class FakeOscillator extends FakeNode{
  constructor(){super();this.frequency=new FakeParam();this.onended=null;}
  start(){startCount++;}
  stop(){if(typeof this.onended==='function')this.onended();}
}
class FakeGain extends FakeNode{constructor(){super();this.gain=new FakeParam();}}
class FakeBufferSource extends FakeNode{
  constructor(){super();this.onended=null;this.buffer=null;}
  start(){startCount++;}
  stop(){if(typeof this.onended==='function')this.onended();}
}
class FakeFilter extends FakeNode{constructor(){super();this.frequency=new FakeParam();this.Q=new FakeParam();this.type='';}}
class FakeAudioContext{
  constructor(){contextCount++;this.state='running';this.currentTime=1;this.destination={};this.sampleRate=44100;}
  createOscillator(){return new FakeOscillator();}
  createGain(){return new FakeGain();}
  createBuffer(){return {getChannelData:()=>new Float32Array(32)};}
  createBufferSource(){return new FakeBufferSource();}
  createBiquadFilter(){return new FakeFilter();}
  resume(){this.state='running';return Promise.resolve();}
}
const context={
  window:{AudioContext:FakeAudioContext},
  localStorage:{getItem:key=>key==='mh_rhythm_settings_v1'?saved:null},
  console,
};
vm.runInNewContext(`${source}\nthis.out={RHYTHM_NOTE_SE_RUNTIME,RHYTHM_GESTURE_RUNTIME,rhythmMatchInputBatch};`,context);
const {RHYTHM_NOTE_SE_RUNTIME,RHYTHM_GESTURE_RUNTIME,rhythmMatchInputBatch}=context.out;
const note=(type,lane=2)=>({type,timeMs:1000,lane,endTimeMs:1800,done:false,activePointerId:null});
const input=(key,lane=2)=>({inputKey:key,lane});

let result=rhythmMatchInputBatch([note('TAP')],[input('tap-hit')],1000,0);
check('TAP正常取得でSEを1回鳴らす',!!result[0].target&&startCount===1);
result=rhythmMatchInputBatch([note('TAP')],[input('tap-empty',4)],1000,0);
check('空打ち・対象なしでは鳴らさない',!result[0].target&&startCount===1);

saved=JSON.stringify({noteSeEnabled:false,noteSeVolume:70});
rhythmMatchInputBatch([note('TAP')],[input('tap-off')],1000,0);
check('noteSeEnabled=falseで鳴らさない',startCount===1);

saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:0});
rhythmMatchInputBatch([note('TAP')],[input('tap-zero')],1000,0);
check('noteSeVolume=0で鳴らさない',startCount===1);

saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:50});
rhythmMatchInputBatch([note('TAP')],[input('tap-half')],1000,0);
// ===== タップ音の大きさ(2026-09-12・ユーザー報告「アンドロイドでタップ音量が小さい」) =====
// 合成音の振幅がフルスケールの3.5%しかなく、-14 LUFS へそろえた曲のピーク(0.891)より
// 約28dB小さかった。倍率(RHYTHM_NOTE_SE_GAIN_SCALE)でまとめて上げてある。
// ★元の係数(.035 など)は書き換えず、倍率を1に戻せば元の音量へ戻せる形を保つ。
const seScale=Number(source.match(/const RHYTHM_NOTE_SE_GAIN_SCALE = ([\d.]+);/)?.[1]);
check('タップ音の倍率を1か所の定数で持っている(1に戻せば元通り)',Number.isFinite(seScale)&&seScale>0);
check('元の係数は書き換えず、倍率を掛ける形にしている',
  source.includes('rhythmNoteSeLevel(.035,settings.volume/100)')
  &&source.includes('rhythmNoteSeLevel(.022,settings.volume/100)')
  &&source.includes('rhythmNoteSeLevel(.028,settings.volume/100)')
  &&source.includes('rhythmNoteSeLevel(.05,settings.volume/100)')
  &&source.includes('rhythmNoteSeLevel(peak,volume)'));
// 音量50のときのタップ音は .035 × 倍率 × .5。倍率を変えたらこの検査も一緒に動く
check('noteSeVolumeをゲインへ反映する',
  startCount===2&&lastGain>0&&Math.abs(lastGain-.035*seScale*.5)<1e-9);
// ★1音あたりの蓋。倍率を上げすぎて音が割れるのを防ぐ
const seMax=Number(source.match(/const RHYTHM_NOTE_SE_LEVEL_MAX = ([\d.]+);/)?.[1]);
check('1音あたりの上限を持ち、音量100までならどの音もそこへ届かない',
  Number.isFinite(seMax)&&seMax<=1&&.05*seScale<=seMax&&.042*seScale<=seMax);
// ===== 音量の上限を200まで開けた(2026-09-12・ユーザー指示「音量調整を今のベースで200まで」) =====
// ★100の意味は変えない。広げただけなので、保存してある0〜100はそのままの音で鳴る。
const volumeMax=Number(source.match(/const RHYTHM_VOLUME_MAX = (\d+);/)?.[1]);
check('音量の上限を1か所の定数で持っている',volumeMax===200);
check('タップ音の読み取り・試聴の両方で上限まで受け取る',
  source.includes('Math.min(RHYTHM_VOLUME_MAX,number)')
  &&source.includes('Math.min(RHYTHM_VOLUME_MAX,Number(previewSettings.noteSeVolume)||0)'));
// タップ音は上限の音量でもちょうど2倍まで素直に伸びる(蓋に当たらない)
check('タップ音は音量200でも蓋に当たらない(100のちょうど2倍まで伸びる)',
  .035*seScale*(volumeMax/100)<=seMax);
// 重ねて鳴らす音(モンスターノーツ・フルコンボ)は、そこから上は割れるだけなので蓋で止める
check('重ねて鳴らす音は上限の音量では蓋で止まる(割れさせない)',
  .05*seScale*(volumeMax/100)>seMax&&.042*seScale*(volumeMax/100)>seMax);
// ★BGM音量・メインゲームの音量には触れない(タップ音だけを変えたことの担保)
check('BGM音量とメインゲームの音量には触れていない',
  !source.includes('RHYTHM_NOTE_SE_GAIN_SCALE*rhythmVolumePct')
  &&!/RHYTHM_NOTE_SE_GAIN_SCALE[\s\S]{0,200}bgmVolume/.test(source));

for(const type of ['HOLD','FLICK','SLIDE']){
  const before=startCount;
  const n=note(type);
  const hit=rhythmMatchInputBatch([n],[input(`${type}-start`)],1000,0)[0];
  check(`${type}始点の正常取得でSEを鳴らす`,!!hit.target&&startCount===before+1);
  RHYTHM_GESTURE_RUNTIME.clear();
}
check('AudioContextはヒットごとに作らず1個を再利用',contextCount===1);
check('既存の設定保存キーだけを読む',source.includes("localStorage.getItem('mh_rhythm_settings_v1')")&&source.includes('noteSeEnabled')&&source.includes('noteSeVolume'));
const missIndex=source.indexOf('if(!picked)return {input,target:null,deltaMs:null};');
const playIndex=source.indexOf('RHYTHM_NOTE_SE_RUNTIME.play();',missIndex);
check('対象取得後だけSE呼び出しへ進む',missIndex>=0&&playIndex>missIndex);
check('入力ごとのAudioContext新規生成をしない',/let ctx=null/.test(source)&&source.match(/new AudioContextClass\(\)/g)?.length===1);

saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:70});
const beforeGrouped=startCount;
RHYTHM_NOTE_SE_RUNTIME.beginInputGroup();
RHYTHM_NOTE_SE_RUNTIME.playEmpty();
RHYTHM_NOTE_SE_RUNTIME.playEmpty();
RHYTHM_NOTE_SE_RUNTIME.endInputGroup();
check('同じ接触イベント内の複数空押しSEは1回へ集約',startCount===beforeGrouped+1);
const beforeHitGroup=startCount;
RHYTHM_NOTE_SE_RUNTIME.beginInputGroup();
RHYTHM_NOTE_SE_RUNTIME.playEmpty();
RHYTHM_NOTE_SE_RUNTIME.play();
RHYTHM_NOTE_SE_RUNTIME.endInputGroup();
check('同じ接触イベントで成功SEがあれば空押しSEを追加しない',startCount===beforeHitGroup+1);

const listeners={};
const sessions=new Map();
let releasePlayCount=0;
const releaseContext={
  window:{
    addEventListener:(type,handler)=>{listeners[type]=handler;},
  },
  RHYTHM_GESTURE_RUNTIME:{_sessions:sessions},
  RHYTHM_NOTE_SE_RUNTIME:{play:()=>{releasePlayCount++;return true;}},
  RHYTHM_RELEASE_MAX_MS:200,
  performance:{now:()=>1000},
  console,
};
vm.runInNewContext(releaseSource,releaseContext);
const holdSession=(overrides={})=>({
  releaseRequired:true,
  kind:'HOLD',
  note:{done:false},
  failed:false,
  startSongMs:1800,
  startPerfMs:1000,
  releaseTargetMs:1800,
  offsetMs:0,
  ...overrides,
});
sessions.set('touch:1',holdSession());
listeners.touchend?.({changedTouches:[{identifier:1}]});
check('HOLD終端を判定幅内で離すとSEを鳴らす',releasePlayCount===1);

sessions.set('touch:2',holdSession({failed:true,kind:'SLIDE'}));
listeners.touchend?.({changedTouches:[{identifier:2}]});
check('途中失敗したSLIDE/HOLDの離しでは鳴らさない',releasePlayCount===1);

sessions.set('touch:3',holdSession({releaseTargetMs:1500}));
listeners.touchend?.({changedTouches:[{identifier:3}]});
check('±200ms外の離しでは鳴らさない',releasePlayCount===1);

sessions.set('touch:4',holdSession({releaseRequired:false,kind:'FLICK'}));
listeners.touchend?.({changedTouches:[{identifier:4}]});
check('FLICKの指離しでは追加SEを鳴らさない',releasePlayCount===1);

sessions.set('pointer:5',holdSession({kind:'SLIDE'}));
listeners.pointerup?.({pointerType:'mouse',pointerId:5});
check('非touch PointerのHOLD/SLIDE終端でもSEを鳴らす',releasePlayCount===2);

sessions.set('pointer:6',holdSession());
listeners.pointerup?.({pointerType:'touch',pointerId:6});
check('touch由来pointerupはtouchendと二重再生しない',releasePlayCount===2);

check('終端SEも既存RHYTHM_NOTE_SE_RUNTIMEを再利用',releaseSource.includes('RHYTHM_NOTE_SE_RUNTIME.play()'));
check('touchcancel/pointercancelには終端SEを追加しない',!releaseSource.includes("addEventListener('touchcancel'")&&!releaseSource.includes("addEventListener('pointercancel'"));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
