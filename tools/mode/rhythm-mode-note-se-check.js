#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const releaseSource=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-step3-release.js'),'utf8');
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};

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
class FakeAudioContext{
  constructor(){contextCount++;this.state='running';this.currentTime=1;this.destination={};}
  createOscillator(){return new FakeOscillator();}
  createGain(){return new FakeGain();}
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
check('noteSeVolumeをゲインへ反映する',startCount===2&&lastGain>0&&lastGain<.035);

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
