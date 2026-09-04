#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const releaseSource=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-step3-release.js'),'utf8');
const gameSource=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

check('空押しSEは既存の音ゲーSE runtimeと設定を共用',source.includes('const playEmpty=()=>')&&source.includes('beginInputGroup')&&source.includes('endInputGroup')&&source.includes('_readSettings:readSettings'));
check('空押しSEはノーツ未取得の新規入力と境界越え再判定の対象なし時に呼ぶ',gameSource.includes('if(!target){RHYTHM_NOTE_SE_RUNTIME.playEmpty()')&&gameSource.includes('if(state.empty)inputStarts([{lane:Math.floor(subLane/2),subLaneCoordinate,inputKey}]'));
check('TAP後は次の境界で再判定し、操作中ノーツの指は横取りしない',gameSource.includes("empty:!target||target.type==='TAP'")&&gameSource.includes("if(state.empty)inputStarts(")&&gameSource.includes("if(subLane===state.subLane)return"));
check('ノーツ取得時は従来SEだけを鳴らす',source.includes('RHYTHM_NOTE_SE_RUNTIME.play();\n    return {input,target:picked.note'));
check('空押しSEは短いノイズ系Web Audio',source.includes('const sampleRate=audio.sampleRate||44100,duration=.055')&&source.includes("emptyFilter.type='bandpass'")&&source.includes('audio.createBufferSource()'));
check('接触幅の1物理イベントは空押しをまとめ、成功があれば空押しを抑止',source.includes('inputGroupDepth')&&source.includes('inputGroupHit')&&source.includes('markInputGroupHandled')&&source.includes('return handled?true:emitEmpty()'));
check('プレイ中の判定SEはOscillator/Gainを毎回生成せずAudioBufferを再利用',source.includes('const hitBuffers=new Map(),emptyBufferPools=new Map();')&&source.includes('source.buffer=hitBufferFor(audio,settings.volume)')&&source.includes('source.buffer=pool[emptyCursor++%pool.length]'));

let saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:70});
let contextCount=0,startCount=0,sourceCount=0,bufferCount=0,gainCount=0,filterCount=0,oscillatorCount=0;
class FakeParam{
  setValueAtTime(){}
  exponentialRampToValueAtTime(){}
}
class FakeNode{connect(){} disconnect(){}}
class FakeOscillator extends FakeNode{
  constructor(){super();this.frequency=new FakeParam();this.onended=null;}
  start(){startCount++;}
  stop(){}
}
class FakeGain extends FakeNode{constructor(){super();this.gain=new FakeParam();}}
class FakeBuffer{
  constructor(length){this.data=new Float32Array(length);}
  getChannelData(){return this.data;}
}
class FakeBufferSource extends FakeNode{
  constructor(){super();this.buffer=null;}
  start(){startCount++;}
  stop(){}
}
class FakeFilter extends FakeNode{constructor(){super();this.frequency=new FakeParam();this.Q=new FakeParam();this.type='';}}
class FakeAudioContext{
  constructor(){contextCount++;this.state='running';this.currentTime=1;this.destination={};this.sampleRate=44100;}
  createOscillator(){oscillatorCount++;return new FakeOscillator();}
  createGain(){gainCount++;return new FakeGain();}
  createBuffer(_channels,length){bufferCount++;return new FakeBuffer(length);}
  createBufferSource(){sourceCount++;return new FakeBufferSource();}
  createBiquadFilter(){filterCount++;return new FakeFilter();}
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

RHYTHM_NOTE_SE_RUNTIME.warm();
check('warmで判定音1種+空押し4種を先に準備',bufferCount===5,`buffers=${bufferCount}`);
check('warmで空押しfilterを1個だけ作る',filterCount===1,`filters=${filterCount}`);
check('通常判定SE用のOscillator/Gainはwarm時に作らない',oscillatorCount===0&&gainCount===0,`osc=${oscillatorCount} gain=${gainCount}`);

let result=rhythmMatchInputBatch([note('TAP')],[input('tap-hit')],1000,0);
check('TAP正常取得でSEを1回鳴らす',!!result[0].target&&startCount===1);
const buffersAfterFirstHit=bufferCount;
result=rhythmMatchInputBatch([note('TAP')],[input('tap-hit-2')],1000,0);
check('同じ音量の連続判定でAudioBufferを作り直さない',!!result[0].target&&bufferCount===buffersAfterFirstHit&&startCount===2);

result=rhythmMatchInputBatch([note('TAP')],[input('tap-empty',4)],1000,0);
check('マッチャー単体の対象なしでは空押しSEを勝手に鳴らさない',!result[0].target&&startCount===2);

saved=JSON.stringify({noteSeEnabled:false,noteSeVolume:70});
rhythmMatchInputBatch([note('TAP')],[input('tap-off')],1000,0);
check('noteSeEnabled=falseで鳴らさない',startCount===2);

saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:0});
rhythmMatchInputBatch([note('TAP')],[input('tap-zero')],1000,0);
check('noteSeVolume=0で鳴らさない',startCount===2);

saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:50});
const beforeVolumeBuffer=bufferCount;
rhythmMatchInputBatch([note('TAP')],[input('tap-half')],1000,0);
check('別音量はその音量用bufferを1回だけ作って鳴らす',startCount===3&&bufferCount===beforeVolumeBuffer+1);

for(const type of ['HOLD','FLICK','SLIDE']){
  const before=startCount;
  const n=note(type);
  const hit=rhythmMatchInputBatch([n],[input(`${type}-start`)],1000,0)[0];
  check(`${type}始点の正常取得でSEを鳴らす`,!!hit.target&&startCount===before+1);
  RHYTHM_GESTURE_RUNTIME.clear();
}
check('AudioContextはヒットごとに作らず1個を再利用',contextCount===1);
check('通常判定SEでOscillator/Gainを増やしていない',oscillatorCount===0&&gainCount===0,`osc=${oscillatorCount} gain=${gainCount}`);
check('既存の設定保存キーだけを読む',source.includes("localStorage.getItem('mh_rhythm_settings_v1')")&&source.includes('noteSeEnabled')&&source.includes('noteSeVolume'));
const missIndex=source.indexOf('if(!picked)return {input,target:null,deltaMs:null};');
const playIndex=source.indexOf('RHYTHM_NOTE_SE_RUNTIME.play();',missIndex);
check('対象取得後だけSE呼び出しへ進む',missIndex>=0&&playIndex>missIndex);

saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:50});
const beforeEmptyBuffers=bufferCount,beforeEmptySources=sourceCount,beforeEmptyStarts=startCount;
RHYTHM_NOTE_SE_RUNTIME.playEmpty();
check('空押し初回は4種のnoise bufferをまとめて作る',bufferCount===beforeEmptyBuffers+4,`buffers +${bufferCount-beforeEmptyBuffers}`);
RHYTHM_NOTE_SE_RUNTIME.playEmpty();
check('空押し2回目以降はnoise bufferを作り直さない',bufferCount===beforeEmptyBuffers+4);
check('空押し1回につきone-shot sourceだけ増える',sourceCount===beforeEmptySources+2&&startCount===beforeEmptyStarts+2);

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
  window:{addEventListener:(type,handler)=>{listeners[type]=handler;}},
  RHYTHM_GESTURE_RUNTIME:{_sessions:sessions},
  RHYTHM_NOTE_SE_RUNTIME:{play:()=>{releasePlayCount++;return true;}},
  RHYTHM_RELEASE_MAX_MS:200,
  performance:{now:()=>1000},
  console,
};
vm.runInNewContext(releaseSource,releaseContext);
const holdSession=(overrides={})=>({
  releaseRequired:true,kind:'HOLD',note:{done:false},failed:false,
  startSongMs:1800,startPerfMs:1000,releaseTargetMs:1800,offsetMs:0,...overrides,
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
