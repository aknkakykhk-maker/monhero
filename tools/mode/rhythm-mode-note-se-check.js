#!/usr/bin/env node
// 空押しSEが、ノーツを取ったときのSEと混ざらないか。
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
check('空押しSEはノーツ未取得の新規入力と境界越え再判定の対象なし時に呼ぶ',gameSource.includes('if(!target){RHYTHM_NOTE_SE_RUNTIME.playEmpty()')&&// ★引数の並びを丸ごと固定で書かない。あとから項目が増えるだけで落ちてしまう
//   (2026-09-13、rejudge:true が足されたときに実際に落ちた)。見たいのは
//   「対象なしのときに、同じ指・同じ場所でもう一度判定へ回している」こと。
  /if\(state\.empty\)inputStarts\(\[\{lane:Math\.floor\(subLane\/2\),subLaneCoordinate,inputKey[^\]]*\}\]/.test(gameSource));
check('TAP後は次の境界で再判定し、操作中ノーツの指は横取りしない',gameSource.includes("empty:!target||target.type==='TAP'")&&gameSource.includes("if(state.empty)inputStarts(")&&gameSource.includes("if(subLane===state.subLane)return"));
// 2026-09-27 から、触れた瞬間のずれで出した判定を渡して音を鳴らし分ける。フリックは触れた瞬間には鳴らさない(払えたときに鳴らす)
check('ノーツ取得時は従来SEだけを鳴らす(フリックは触れた瞬間には鳴らさない)',source.includes("if(originalType==='FLICK')RHYTHM_NOTE_SE_RUNTIME.markInputGroupHandled();\n    else RHYTHM_NOTE_SE_RUNTIME.play(null,typeof rhythmJudgeTap==='function'?rhythmJudgeTap(touchDelta):null);\n    return {input,target:picked,deltaMs:touchDelta};"));
check('空押しSEは短いノイズ系Web Audio',source.includes('const duration=.055')&&source.includes("filter.type='bandpass'")&&source.includes('audio.createBufferSource()'));
check('接触幅の1物理イベントは空押しをまとめ、成功があれば空押しを抑止',source.includes('inputGroupDepth')&&source.includes('inputGroupHit')&&source.includes('markInputGroupHandled')&&source.includes('return handled?true:emitEmpty()'));

let saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:70});
let contextCount=0,startCount=0,lastGain=0;
class FakeParam{
  setValueAtTime(value){lastGain=Number(value)||0;}
  exponentialRampToValueAtTime(){}
  linearRampToValueAtTime(){}
  setTargetAtTime(){}
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
// 作り置き(OfflineAudioContext)の偽物。はじめは置かない(作れない端末ではクラシックで鳴ることを先に見る)
class FakeOffline extends FakeAudioContext{
  constructor(channels,length,rate){super();contextCount--;this.length=length;this.sampleRate=rate;}
  createConvolver(){return new FakeNode();}
  createBuffer(channels,length){const data=new Float32Array(length);return {length,getChannelData:()=>data};}
  startRendering(){const data=new Float32Array(this.length);for(let i=0;i<400;i++)data[i]=.5*Math.sin(i*.3);return Promise.resolve({length:this.length,getChannelData:()=>data});}
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
// 2026-09-26 にタップ音の種類を足し、叩いた音は tone(波形,高さ,高さ,係数,長さ) で鳴らす形になった。「標準」は元の係数 .035 のまま
check('元の係数は書き換えず、倍率を掛ける形にしている',
  source.includes("tap:(T)=>{T('triangle',1120,820,.035,.045);}")
  &&source.includes('rhythmNoteSeLevel(.022,settings.volume/100)')
  &&source.includes("end:(T)=>{T('triangle',1318.51,1975.53,.028,.13);}")
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
// タップ音量だけ上限を400へ広げた(2026-09-26・ユーザー指示「タップ音量の上限をもっと上げて」)
check('タップ音の読み取り・試聴の両方で上限(400)まで受け取る',
  Number(source.match(/const RHYTHM_NOTE_SE_VOLUME_MAX = (\d+);/)?.[1])===400
  &&source.includes('Math.min(RHYTHM_NOTE_SE_VOLUME_MAX,number)')
  // 試聴も同じ読み取り(settingsFrom)を通す
  &&source.includes('const settings=previewSettings?settingsFrom(previewSettings):readSettings();')
  &&source.includes('const settings=settingsFrom(previewSettings);'));
check('200より上は割れ止めを通す(遅れの出るコンプレッサーは使わない)',
  source.includes('audio.createWaveShaper()')&&source.includes("shaper.oversample='none'")
  &&!/createDynamicsCompressor/.test(source.slice(source.indexOf('const RHYTHM_NOTE_SE_RUNTIME='),source.indexOf('const RHYTHM_NOTE_SE_RUNTIME=')+20000)));
check('200までの蓋はこれまでと同じ(.8)で、それより上だけ開ける',
  /const cap = volume > 2 \? Math\.min\(RHYTHM_NOTE_SE_LOUD_LEVEL_MAX, RHYTHM_NOTE_SE_LEVEL_MAX \* volume \/ 2\) : RHYTHM_NOTE_SE_LEVEL_MAX;/.test(source));
// 200より上は100ごとに2倍(2026-09-27・ユーザー指示「400まで効くようにする」)。200以下は1つも変えない
{
  const m=source.match(/const rhythmNoteSeDrive = volume => (.+);/);
  const drive=m?new Function('volume','return '+m[1]):null;
  const loud=Number(source.match(/const RHYTHM_NOTE_SE_LOUD_LEVEL_MAX = ([\d.]+);/)?.[1]);
  check('200以下の音量はこれまでと同じ大きさで鳴る',!!drive&&[0,.35,.7,1,1.5,2].every(v=>drive(v)===v));
  check('200より上は100ごとに2倍(300で4倍・400で8倍)',!!drive&&drive(3)===4&&drive(4)===8);
  check('400の大きさまで蓋を開けている',loud>=.8*8/2,String(loud));
  check('音の大きさを決める関数が倍々の値を使う',/const rhythmNoteSeLevel = \(base, volumeIn\) => \{\s*const volume = rhythmNoteSeDrive\(volumeIn\);/.test(source));
}
// タップ音の種類(2026-09-26・ユーザー指示「ノーツを押したときの音のバリエーションがほしい / 設定で変えられるように」)
{
  const ids=[...source.matchAll(/Object\.freeze\(\{ id:'([A-Z]+)', +label:'[^']+'/g)].map(m=>m[1]);
  check('タップ音の種類は スタンダード・クラップ・ドラム・ウッド・ベル・クラシック の6つ',JSON.stringify(ids.filter(id=>['STANDARD','CLAP','DRUM','WOOD','BELL','CLASSIC'].includes(id)))==='["STANDARD","CLAP","DRUM","WOOD","BELL","CLASSIC"]',ids.join(','));
  check('保存値に無い・知らない種類は「標準」で鳴らす',source.includes("const rhythmNoteSeTypeOf = value => RHYTHM_NOTE_SE_TYPE_IDS.includes(value) ? value : 'STANDARD';")
    &&source.includes('type:rhythmNoteSeTypeOf(value?.noteSeType)'));
  // 2026-09-27 から、1つのセットに タップ・フリック・ロングの終わり の3つの音を持つ。
  // 同じ日の夜に音そのものを作り直し、設計図(RHYTHM_NOTE_SE_DESIGNS)から作り置きする形にした。これまでの音は「クラシック」
  const setsText=source.slice(source.indexOf('const RHYTHM_NOTE_SE_DESIGNS = Object.freeze({'),source.indexOf('const RHYTHM_NOTE_SE_RENDER_SECONDS'));
  const setIds=[...setsText.matchAll(/^  ([A-Z]+):Object\.freeze\(\{/gm)].map(m=>m[1]);
  check('種類ごとに鳴らし分けている(5つのセットの設計図がそろっている)',JSON.stringify(setIds)==='["STANDARD","CLAP","DRUM","WOOD","BELL"]',setIds.join(','));
  const blocks=setsText.split(/^  [A-Z]+:Object\.freeze\(\{/m).slice(1);
  check('どのセットも タップ・フリック・ロングの終わり の3つの音を持つ',blocks.length===5&&blocks.every(b=>/\btap:/.test(b)&&/\bflick:/.test(b)&&/\bend:/.test(b)));
  check('これまでの標準の音は「クラシック」として残す',source.includes("Object.freeze({ id:'CLASSIC',")
    &&/const RHYTHM_NOTE_SE_CLASSIC=Object\.freeze\(\{\s*tap:\(T\)=>\{T\('triangle',1120,820,\.035,\.045\);\}/.test(source));
}
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

for(const type of ['HOLD','SLIDE']){
  const before=startCount;
  const n=note(type);
  const hit=rhythmMatchInputBatch([n],[input(`${type}-start`)],1000,0)[0];
  check(`${type}始点の正常取得でSEを鳴らす`,!!hit.target&&startCount===before+1);
  RHYTHM_GESTURE_RUNTIME.clear();
}
// フリックは触れた瞬間には鳴らさない(払えたときに playFlick で鳴らす)。空打ちの音も出さない
{
  const before=startCount;
  RHYTHM_NOTE_SE_RUNTIME.beginInputGroup();
  const hit=rhythmMatchInputBatch([note('FLICK')],[input('FLICK-start')],1000,0)[0];
  RHYTHM_NOTE_SE_RUNTIME.endInputGroup();
  check('FLICK始点は触れた瞬間には鳴らさず、空打ちの音にもしない',!!hit.target&&startCount===before);
  RHYTHM_GESTURE_RUNTIME.clear();
  const beforeFlick=startCount;
  RHYTHM_NOTE_SE_RUNTIME.playFlick('MARVELOUS');
  check('フリックが成立したときの音(playFlick)は鳴る',startCount>beforeFlick);
}
check('AudioContextはヒットごとに作らず1個を再利用',contextCount===1);
check('既存の設定保存キーだけを読む',source.includes("localStorage.getItem('mh_rhythm_settings_v1')")&&source.includes('noteSeEnabled')&&source.includes('noteSeVolume'));
const missIndex=source.indexOf('if(!picked)return {input,target:null,deltaMs:null};');
const playIndex=source.indexOf('RHYTHM_NOTE_SE_RUNTIME.play(null,',missIndex);
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

// ===== 他の音ゲーにならった鳴らし方(2026-09-27・ユーザー指示「タップ音を他の音ゲーを見習ってほしい / それを設定で色々変えれるようにしてほしい」) =====
{
  const gainOf=(settingsValue,run)=>{saved=JSON.stringify(settingsValue);const before=startCount;run();return startCount>before?lastGain:0;};
  const base={noteSeEnabled:true,noteSeVolume:100};
  const best=gainOf(base,()=>RHYTHM_NOTE_SE_RUNTIME.play(null,'MARVELOUS'));
  const great=gainOf(base,()=>RHYTHM_NOTE_SE_RUNTIME.play(null,'GREAT'));
  const good=gainOf(base,()=>RHYTHM_NOTE_SE_RUNTIME.play(null,'GOOD'));
  check('判定がずれるほど小さく鳴る(MARVELOUS > GREAT > GOOD)',best>great&&great>good&&good>0,[best,great,good].join(' / '));
  const flat=gainOf({...base,noteSeJudgeVary:false},()=>RHYTHM_NOTE_SE_RUNTIME.play(null,'GOOD'));
  check('「判定で音を変える」を切ると、いつもいちばん良い音',Math.abs(flat-best)<1e-12);
  const unknown=gainOf(base,()=>RHYTHM_NOTE_SE_RUNTIME.play());
  check('判定が分からないとき(ホールドの離しなど)はいちばん良い音',Math.abs(unknown-best)<1e-12);
  check('フリック音の大きさ0なら、フリックの音を鳴らさない',gainOf({...base,noteSeFlickVolume:0},()=>RHYTHM_NOTE_SE_RUNTIME.playFlick('MARVELOUS'))===0);
  check('ロングの終わりの音の大きさ0なら、終わりの音を鳴らさない',gainOf({...base,noteSeEndVolume:0},()=>RHYTHM_NOTE_SE_RUNTIME.playClear('MARVELOUS'))===0);
  const end100=gainOf(base,()=>RHYTHM_NOTE_SE_RUNTIME.playClear('MARVELOUS'));
  const end50=gainOf({...base,noteSeEndVolume:50},()=>RHYTHM_NOTE_SE_RUNTIME.playClear('MARVELOUS'));
  check('ロングの終わりの音の大きさ(%)がタップ音量に掛かる',end100>0&&Math.abs(end50-end100/2)<1e-9);
  check('「空打ちの音」を切ると空打ちでは鳴らさない',gainOf({...base,noteSeEmptyEnabled:false},()=>RHYTHM_NOTE_SE_RUNTIME.playEmpty())===0
    &&gainOf(base,()=>RHYTHM_NOTE_SE_RUNTIME.playEmpty())>0);
  check('「空打ちの音」を切っても、ノーツを叩いた音は鳴る',gainOf({...base,noteSeEmptyEnabled:false},()=>RHYTHM_NOTE_SE_RUNTIME.play())>0);
  // 保存値に新しい項目が無い人(これまでの人)は、これまでに近い鳴り方になる
  const read=RHYTHM_NOTE_SE_RUNTIME._readSettings;
  saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:70});
  const legacy=read();
  check('新しい項目が無い保存値は既定(判定で変える・フリック100%・終わり100%・空打ちあり・標準)で補う',
    legacy.judgeVary===true&&legacy.flickVolume===100&&legacy.endVolume===100&&legacy.emptyEnabled===true&&legacy.type==='STANDARD');
  saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:70,noteSeFlickVolume:'x',noteSeEndVolume:9999,noteSeJudgeVary:'yes',noteSeType:'NOPE'});
  const broken=read();
  check('壊れた値は既定へ戻すか範囲へ収める',broken.flickVolume===100&&broken.endVolume===200&&broken.judgeVary===true&&broken.type==='STANDARD');
}
{
  const settingsSource=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'),'utf8');
  check('設定の既定値と正規化に新しい項目がある',
    ['noteSeJudgeVary:true','noteSeFlickVolume:100','noteSeEndVolume:100','noteSeEmptyEnabled:true'].every(k=>settingsSource.includes(k))
    &&settingsSource.includes("noteSeJudgeVary:bool('noteSeJudgeVary')")&&settingsSource.includes("noteSeEmptyEnabled:bool('noteSeEmptyEnabled')"));
}

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


// ===== 作り置き(2026-09-27 夜・ユーザー指示「音の種類と言うか音の質自体をほかの音ゲーにならって作ってほしい」) =====
(async()=>{
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  context.window.OfflineAudioContext=FakeOffline;
  const bank=await RHYTHM_NOTE_SE_RUNTIME.prepare('CLAP');
  check('作り置きは 3つの音 × 判定3段',!!bank&&['tap','flick','end'].every(kind=>['PERFECT','GREAT','GOOD'].every(grade=>bank[kind]?.[grade])));
  check('クラシックは作り置きしない(その場で鳴らす)',(await RHYTHM_NOTE_SE_RUNTIME.prepare('CLASSIC'))===null);
  saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:100,noteSeType:'CLAP'});
  let before=startCount;
  RHYTHM_NOTE_SE_RUNTIME.play(null,'MARVELOUS');
  check('作り置きのあとは、叩くたびに鳴らすのは再生1つだけ',startCount===before+1&&Math.abs(lastGain-.035*seScale)<1e-9,String(lastGain));
  RHYTHM_NOTE_SE_RUNTIME.play(null,'GOOD');
  check('作り置きの音も、判定がずれるほど小さい',Math.abs(lastGain-.035*seScale*.64)<1e-9,String(lastGain));
  saved=JSON.stringify({noteSeEnabled:true,noteSeVolume:100,noteSeType:'CLAP',noteSeJudgeVary:false});
  RHYTHM_NOTE_SE_RUNTIME.play(null,'GOOD');
  check('「判定で音を変える」を切ると、作り置きの音もいつもいちばん良い音',Math.abs(lastGain-.035*seScale)<1e-9);
  delete context.window.OfflineAudioContext;
  // 試聴: 作り置きの無い端末でも、全セットの3つの音が(クラシックで)鳴る
  let silent=[];
  for(const type of ['STANDARD','CLAP','DRUM','WOOD','BELL','CLASSIC'])for(const kind of ['tap','flick','end']){
    before=startCount;
    RHYTHM_NOTE_SE_RUNTIME.preview({noteSeEnabled:true,noteSeVolume:100,noteSeType:type},kind,'MARVELOUS');
    await tick();await tick();
    if(startCount===before)silent.push(`${type}/${kind}`);
  }
  check('試聴で全セットの3つの音が鳴る',silent.length===0,silent.join(','));
  // 2026-09-28: 見本(プロセカのプレイ動画から叩いた音を重ねて取り出したもの)を測って、スタンダードと空打ちをそろえた。
  //   見本は音の7〜8割が 6.4〜12.8kHz、約30msで膨らんで150msほどで消える。曲に対する大きさも見本に合わせて上げた
  const standardTap=source.slice(source.indexOf('  STANDARD:Object.freeze({'),source.indexOf('  CLAP:Object.freeze({'));
  check('スタンダードのタップ音は、高いきらめき(8kHzあたり)をゆっくり減らす形',/K\.noise\('bandpass',8300\*s,7800\*s,1\.7,\.95,0,\{attack:\.02,tau:\.07\*L\}\)/.test(standardTap));
  // 2026-09-28: ほかの4セットも同じ作り(持ち味の音＋叩いた瞬間の「チッ」＋ゆっくり減る高いきらめき＋空気感)にした
  {
    const designs=source.slice(source.indexOf('const RHYTHM_NOTE_SE_DESIGNS = Object.freeze({'),source.indexOf('const RHYTHM_NOTE_SE_RENDER_SECONDS'));
    const lacking=['STANDARD','CLAP','DRUM','WOOD','BELL'].filter(id=>{
      const start=designs.indexOf(`  ${id}:Object.freeze({`),block=designs.slice(start,designs.indexOf('\n  }),',start));
      const tap=block.slice(block.indexOf('tap:'),block.indexOf('flick:'));
      return !(/K\.noise\('bandpass',8500,8500,\.8,/.test(tap)&&/K\.noise\('bandpass',[^;]*tau:/.test(tap)&&/K\.noise\('highpass',1\d000,/.test(tap));
    });
    check('どのセットのタップ音も、叩いた瞬間の「チッ」・ゆっくり減るきらめき・空気感を持つ',lacking.length===0,lacking.join(','));
  }
  check('作り置きの大きさは見本に合わせた(タップ .3)',source.includes('const RHYTHM_NOTE_SE_TARGET_RMS = Object.freeze({ tap:.3, flick:.28, end:.28 });'));
  check('空打ちはクラシック以外で明るい「シャッ」(クラシックはこれまでの音)',source.includes('filter.frequency.setValueAtTime(classic?2800:7000,now);'));
  const renderText=source.slice(source.indexOf('const renderOne=('),source.indexOf('const renderBank='));
  check('作り置きは決まった並びの雑音で作る(開くたびに音が変わらない)',source.includes('const seededNoise=(off,seconds)=>')&&!/Math\.random/.test(renderText));
  check('作り置きのあと大きさをそろえる',renderText.includes('let scale=rms>0?target/rms:1;'));
  const gameText=gameSource;
  check('曲えらび・演奏の画面を開いたときに作り置きする',(gameText.match(/RHYTHM_NOTE_SE_RUNTIME\.prepare\?\.\(\)/g)||[]).length>=2);
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})().catch(error=>{console.error(error);process.exit(1);});
