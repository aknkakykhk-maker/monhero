#!/usr/bin/env node
// ホールド・スライドを押さえているあいだの音の検査(2026-09-28)。
// ユーザー「押してる間にウィーンみたいな溜めてるような音があるとさらにそれっぽくなりそう」で入れ、同じ日に
// 「音ゲーってなんかしゃらららみたいなそんなかんじ」で、1回だけ作ったきらめく音を繰り返し鳴らす形へ作り替えた。
//
// 見るのは「鳴りっぱなしにならない」こと。押さえ終わった・取り損ねた・ポーズ・曲の終わり・画面を出た・タブを隠した、の
// どれでも音が止まるか。本体は毎フレーム holdSync(押さえているノーツの並び) を呼び、並びから消えた音はそこで止まる。
// 呼ばれなくなったときは見張り(0.25秒)が全部止める。音の組み立ては偽の AudioContext で数える。
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
const settingsSrc=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'),'utf8');
const screens=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/29-rhythm-screens.jsx'),'utf8');
let failed=0;
const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};

// ---- 偽の音の部品。鳴っている音(発振器・再生)の数(始めた数 − 止めた数)を数える ----
let live=0,lastLevel=0,buffersMade=0;
class Param{constructor(){this.value=0;}setValueAtTime(v){this.value=v;}setTargetAtTime(v){this.target=v;}exponentialRampToValueAtTime(){}linearRampToValueAtTime(){}cancelScheduledValues(){}}
class Node{connect(){}disconnect(){}}
class Osc extends Node{constructor(){super();this.frequency=new Param();this.detune=new Param();this.onended=null;this.started=false;this.stopped=false;}
  start(){this.started=true;live++;}
  stop(){if(this.started&&!this.stopped){this.stopped=true;live--;if(typeof this.onended==='function')this.onended();}}}
class Src extends Node{constructor(){super();this.playbackRate=new Param();this.buffer=null;this.loop=false;this.onended=null;this.started=false;this.stopped=false;}
  start(){this.started=true;live++;}
  stop(){if(this.started&&!this.stopped){this.stopped=true;live--;if(typeof this.onended==='function')this.onended();}}}
class Gain extends Node{constructor(){super();const g=new Param();const set=g.setTargetAtTime.bind(g);g.setTargetAtTime=(v,...r)=>{if(v>.001)lastLevel=v;return set(v,...r);};this.gain=g;}}
class Filter extends Node{constructor(){super();this.frequency=new Param();this.Q=new Param();this.type='';}}
class Ctx{constructor(){this.state='running';this.currentTime=1;this.destination={};this.sampleRate=48000;}
  createOscillator(){return new Osc();}createGain(){return new Gain();}createBiquadFilter(){return new Filter();}
  createWaveShaper(){return Object.assign(new Node(),{curve:null,oversample:''});}
  createBuffer(channels,length){buffersMade++;const data=[...Array(channels)].map(()=>new Float32Array(length));return {length,numberOfChannels:channels,getChannelData:c=>data[c]};}
  createBufferSource(){return new Src();}
  resume(){return Promise.resolve();}}
// 偽の時計とタイマー(見張りと試聴の止めを進めるため)
let now=0;const timers=[];let timerId=0;
const setInterval_=(fn,ms)=>{const id=++timerId;timers.push({id,fn,ms,next:now+ms,repeat:true});return id;};
const setTimeout_=(fn,ms)=>{const id=++timerId;timers.push({id,fn,ms,next:now+ms,repeat:false});return id;};
const clear=id=>{const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);};
const advance=ms=>{const end=now+ms;for(;;){const t=timers.filter(x=>x.next<=end).sort((a,b)=>a.next-b.next)[0];if(!t)break;now=t.next;if(t.repeat)t.next+=t.ms;else clear(t.id);t.fn();}now=end;};
let saved={noteSeEnabled:true,noteSeVolume:70};
const win={AudioContext:Ctx};
const context={window:win,localStorage:{getItem:key=>key==='mh_rhythm_settings_v1'?JSON.stringify(saved):null},console,
  performance:{now:()=>now},setInterval:setInterval_,clearInterval:clear,setTimeout:setTimeout_,clearTimeout:clear};
vm.runInNewContext(`${source}\nthis.out={RHYTHM_NOTE_SE_RUNTIME};`,context);
const SE=context.out.RHYTHM_NOTE_SE_RUNTIME;
const hold=(index,slide=false)=>({index,type:'HOLD',_rhythmOriginalType:slide?'SLIDE':'HOLD',timeMs:1000,done:false,activePointerId:1});
const reset=()=>{SE.holdStopAll();advance(1000);};

// ---- 押さえている間だけ鳴る ----
SE.holdSync([hold(1)]);
check('押さえると1本ぶんの音を組む',SE._holdVoiceCount()===1&&live>0);
check('繰り返しの音は1回だけ作る(押さえるたびに作らない)',buffersMade===1);
const perVoice=live;
SE.holdSync([hold(1)]);SE.holdSync([hold(1)]);
check('押さえ続けているあいだは組み直さない(毎フレーム呼ばれても増えない)',SE._holdVoiceCount()===1&&live===perVoice);
SE.holdSync([]);
check('押さえ終わったら止まる(音の再生も止まる)',SE._holdVoiceCount()===0&&live===0);

SE.holdSync([hold(1),hold(2,true)]);
check('2本押さえると2本ぶん鳴る(SLIDEも)',SE._holdVoiceCount()===2&&live===perVoice*2);
SE.holdSync([hold(2,true)]);
check('片方だけ離すと、その1本だけ止まる',SE._holdVoiceCount()===1&&live===perVoice);
check('何本押さえても、繰り返しの音は作り直さない',buffersMade===1);
reset();

SE.holdSync([1,2,3,4,5,6].map(i=>hold(i)));
check('同時に鳴らすのは4本まで',SE._holdVoiceCount()===4);
reset();

// ---- 呼ばれなくなったら見張りが止める(ポーズ・タブを隠した・画面を出た) ----
SE.holdSync([hold(1)]);
advance(100);
check('0.1秒ではまだ鳴っている',SE._holdVoiceCount()===1);
advance(400);
check('呼ばれなくなって0.25秒を過ぎると、見張りが全部止める',SE._holdVoiceCount()===0&&live===0);
check('止めたあとは見張りも止まる(タイマーが残らない)',timers.length===0);
reset();

// ---- 設定 ----
saved={noteSeEnabled:false,noteSeVolume:70};SE.holdSync([hold(1)]);
check('タップ音OFFなら鳴らさない',SE._holdVoiceCount()===0);
saved={noteSeEnabled:true,noteSeVolume:70,noteSeHoldVolume:0};SE.holdSync([hold(1)]);
check('押さえている間の音の大きさ0%なら鳴らさない',SE._holdVoiceCount()===0);
saved={noteSeEnabled:true,noteSeVolume:70};SE.holdSync([hold(1)]);
saved={noteSeEnabled:true,noteSeVolume:70,noteSeHoldVolume:0};SE.holdSync([hold(1)]);
check('鳴っている途中で0%にしたら止まる',SE._holdVoiceCount()===0);
saved={noteSeEnabled:true,noteSeVolume:70};win.__mhAudioEnabled=false;SE.holdSync([hold(1)]);
check('全体ミュート中は鳴らさない',SE._holdVoiceCount()===0);
win.__mhAudioEnabled=true;reset();
saved={noteSeEnabled:true,noteSeVolume:70,noteSeHoldVolume:100};SE.holdSync([hold(1)]);const full=lastLevel;reset();
saved={noteSeEnabled:true,noteSeVolume:70,noteSeHoldVolume:40};SE.holdSync([hold(1)]);const low=lastLevel;reset();
check('大きさの設定が効く(40%のほうが小さい)',full>0&&low>0&&low<full);
saved={noteSeEnabled:true,noteSeVolume:70,noteSeHoldVolume:'x'};SE.holdSync([hold(1)]);
check('保存値が壊れていても既定(100%)で鳴る',SE._holdVoiceCount()===1);
reset();

// ---- 試聴 ----
SE.preview({noteSeEnabled:true,noteSeVolume:70},'hold');
check('設定画面の試聴で鳴る',SE._holdVoiceCount()===1);
advance(1500);
check('試聴は1.2秒で止まる',SE._holdVoiceCount()===0&&live===0);

// ---- 本体の配線 ----
const flat=src=>src.replace(/\s+/g,'');
check('演奏のループが毎フレーム、押さえている HOLD/SLIDE を渡す',
  /heldNotes\.length=0;/.test(play)&&/if\(!note\.done&&note\.activePointerId!==null&&note\.type==='HOLD'&&rhythmNoteHasBody\(note\)\)heldNotes\.push\(note\);/.test(play)
  &&play.includes('RHYTHM_NOTE_SE_RUNTIME.holdSync(heldNotes);'));
check('曲の終わり・画面を出るとき・ポーズで止める',
  /run\.finished=true;stopFrame\(\);RHYTHM_NOTE_SE_RUNTIME\.holdStopAll\(/.test(flat(play))
  &&/constdisposeRun=useCallback\(\(\)=>\{stopFrame\(\);RHYTHM_NOTE_SE_RUNTIME\.holdStopAll\(/.test(flat(play))
  &&/if\(!run\|\|run\.finished\|\|run\.paused\)return;RHYTHM_NOTE_SE_RUNTIME\.holdStopAll\([^)]*\);run\.activePointers\.clear\(\)/.test(flat(play)));
check('設定は新しい項目(既定100%・壊れた値は既定へ)',settingsSrc.includes('noteSeHoldVolume:100')
  &&/noteSeHoldVolume:rhythmFiniteStep\(source\.noteSeHoldVolume,0,RHYTHM_NOTE_SE_PART_VOLUME_MAX,1,DEFAULT_RHYTHM_SETTINGS\.noteSeHoldVolume\)/.test(settingsSrc));
check('設定画面に大きさの欄と試聴ボタンがある',screens.includes("stepper('noteSeHoldVolume'")&&screens.includes('data-rhythm-se-preview="hold"'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
