#!/usr/bin/env node
// 実機でしか分からないことの診断(stats.timing)と、直し方の切り替え(2026-10-07)が崩れていないかを見張る。
//
//   node tools/mode/rhythm-timing-diag-check.js
//
// 【なぜ要るか】ユーザー指示「実機で確認しないと直せないものは、直せる仕組みを作って」「人の手で調整する前提の作りにしないで」。
//   直し方は、ゲームが端末の記録から自分で入れ切りする。
//   ・診断: 入力の遅れの分布・補正の上限を超えた数・曲の時計の止まったコマ・アプリを離れた回数・端末の音の遅れ・曲の頭の無音
//   ・直し方: inputAgeCap(補正の上限を300msへ・コマ落ちが見えたときだけ・iPhone) / smoothSongClock(時計をなめらかに・止まるコマが多い端末だけ自動) / autoPauseOnHidden(離れたら一時停止・全端末)
//   ・ゲームが記録から決める入れ切り(rhythmTouchFixAutoFrom)と、デバッグ用の上書き(mh_rhythm_fix_override_v1・コンソールから)
//   ・報告ツール(rhythm-touch-diag.js)の timing の判定
// 既定のままでは、これまでの判定・スコアは1ミリも変わらないことを確かめる。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
const runtime=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
const audio=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/14-audio.jsx'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};

// ── 判定側(rhythm-mode.js)を切り出して動かす ──
const pick=re=>runtime.match(re)?.[0]||'';
const ageBlock=pick(/const RHYTHM_INPUT_AGE_MAX_MS=80;[\s\S]*?const rhythmInputAgeMs=[\s\S]*?\n\};/);
const timingBlock=pick(/const RHYTHM_TIMING_DIAG=\(\(\)=>\{[\s\S]*?\n\}\)\(\);/);
const capBlock=pick(/const RHYTHM_INPUT_AGE_CAP_WIDE_MS=300;[\s\S]*?const rhythmInputAgeCapMs=[^\n]*\n/);
const fixBlock=pick(/const RHYTHM_TOUCH_FIXES=\{[\s\S]*?const rhythmTouchFixesActive=[^\n]*\n/);
const platformBlock=pick(/const rhythmTouchPlatform=\(\)=>\{[\s\S]*?\n\};/);
check('必要なブロックを切り出せる',!!(ageBlock&&timingBlock&&capBlock&&fixBlock&&platformBlock));
if(!(ageBlock&&timingBlock&&capBlock&&fixBlock&&platformBlock)){console.log(`\n${failed}件のNGがあります`);process.exit(1);}

const makeContext=(ua,store={})=>{
  const clock={now:0};
  const ctx={navigator:{userAgent:ua,maxTouchPoints:5},performance:{now:()=>clock.now},localStorage:{getItem:k=>(k in store?store[k]:null),setItem:(k,v)=>{store[k]=String(v);}},console};
  ctx.clock=clock;
  vm.createContext(ctx);
  // ageBlock は rhythmInputAgeMs を、timingBlock は RHYTHM_TIMING_DIAG を持つ。順番は本体と同じ(定数→診断→上限→年齢)
  // ageBlock には、上限の定数・診断(RHYTHM_TIMING_DIAG)・上限の関数・rhythmInputAgeMs がこの順で入っている
  vm.runInContext(`${ageBlock}\n${platformBlock}\n${fixBlock}\nthis.out={clock,rhythmTouchFixAutoSet,rhythmTouchFixAutoFrom,rhythmInputAgeMs,rhythmInputAgeResetFloor,RHYTHM_TIMING_DIAG,rhythmTouchFixOn,rhythmTouchFixSetOverride,rhythmTouchFixesActive,rhythmInputAgeCapMs,RHYTHM_TOUCH_FIXES};`,ctx);
  return ctx.out;
};
const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const PC='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120';

// 1. 既定ではこれまでどおり
{
  const o=makeContext(IPHONE);
  // 2026-10-07 21時: inputAgeCap は標準で切った(ユーザー報告「タップ抜けがひどくなった」。補正の効きすぎを疑い、原因が分かるまで10/6夕方の動きへ戻す)
  check('標準: autoPauseOnHidden は入れてあり、inputAgeCap と smoothSongClock は標準では切',o.RHYTHM_TOUCH_FIXES.inputAgeCap===false&&o.RHYTHM_TOUCH_FIXES.autoPauseOnHidden===true&&o.RHYTHM_TOUCH_FIXES.smoothSongClock===false);
  check('iPhone: inputAgeCap は標準では入らない(いったん戻した)',o.rhythmTouchFixOn('inputAgeCap')===false);
  check('パソコン・Android: inputAgeCap は入らない(iPhoneの記録から決めた直し方)',makeContext(PC).rhythmTouchFixOn('inputAgeCap')===false);
  check('全端末: autoPauseOnHidden が入っている',makeContext(PC).rhythmTouchFixOn('autoPauseOnHidden')===true);
  check('標準: smoothSongClock は、記録から決めるまで切',o.rhythmTouchFixOn('smoothSongClock')===false);
  o.rhythmInputAgeResetFloor();
  check('20ms遅れた入力は20msのまま',o.rhythmInputAgeMs(1000,1020)===20);
  o.clock.now=5000;o.RHYTHM_TIMING_DIAG.frame(1);o.clock.now=5005;
  check('コマが止まっていないのに古い時刻の入力(200ms)は、80msで止める',o.rhythmInputAgeMs(4805,5005)===80);
}
// 2. 診断の数え
{
  const o=makeContext(PC);o.rhythmInputAgeResetFloor();o.RHYTHM_TIMING_DIAG.reset();
  [10,30,60,100,200,400].forEach((age,i)=>o.rhythmInputAgeMs(1000*(i+1),1000*(i+1)+age));
  const snap=o.RHYTHM_TIMING_DIAG.snapshot();
  check('入力の遅れの分布を数える',JSON.stringify(snap.ageHist)==='[1,1,1,1,1,1]',JSON.stringify(snap.ageHist));
  check('80msを超えた入力を数える',snap.ageCapped===3,String(snap.ageCapped));
  o.RHYTHM_TIMING_DIAG.reset();[100,100,100.5,101,101,103].forEach(v=>o.RHYTHM_TIMING_DIAG.frame(v));o.RHYTHM_TIMING_DIAG.hidden();o.RHYTHM_TIMING_DIAG.pen();
  const s2=o.RHYTHM_TIMING_DIAG.snapshot();
  check('曲の時計が前と同じ値だったコマを数える',s2.frames===6&&s2.stalls===2&&s2.maxStepMs===2,JSON.stringify(s2));
  check('離れた回数・ペンを数える',s2.hidden===1&&s2.pen===1);
  o.RHYTHM_TIMING_DIAG.meta({outLatMs:30,baseLatMs:10,hasTs:true,rate:48000,headMs:103});
  check('端末の音の事情を持てる',o.RHYTHM_TIMING_DIAG.snapshot().headMs===103&&o.RHYTHM_TIMING_DIAG.snapshot().hasTs===true);
  check('診断の大きさは小さい(サーバーの上限4KBの十分内側)',JSON.stringify(o.RHYTHM_TIMING_DIAG.snapshot()).length<400);
}
// 2b. ゲームが記録から自分で決める入れ切り
{
  const row=(frames,stalls,backed,unbacked)=>({stats:{timing:{frames,stalls,ageBacked:backed,ageUnbacked:unbacked}}});
  const o=makeContext(IPHONE);
  check('記録が3曲に足りないときは、何も決めない',JSON.stringify(o.rhythmTouchFixAutoFrom([row(5000,300,0,0),row(5000,300,0,0)]))==='{}');
  check('記録が無い・壊れていても落ちない',JSON.stringify(o.rhythmTouchFixAutoFrom(null))==='{}'&&JSON.stringify(o.rhythmTouchFixAutoFrom([null,{},{stats:5}]))==='{}');
  check('止まるコマが2%以上ある端末は、時計をなめらかにする(自動で入れる)',o.rhythmTouchFixAutoFrom([row(5000,150,0,0),row(5000,150,0,0),row(5000,150,0,0)]).smoothSongClock===true);
  check('止まるコマが少ない端末は、時計をいじらない',o.rhythmTouchFixAutoFrom([row(5000,10,0,0),row(5000,10,0,0),row(5000,10,0,0)]).smoothSongClock===undefined);
  check('遅れた入力に、止まりが見えないものが多い端末は、広げた上限を自分で切る',o.rhythmTouchFixAutoFrom([row(5000,0,1,5),row(5000,0,0,2),row(5000,0,0,2)]).inputAgeCap===false);
  check('止まりが見えた遅れた入力が多い端末は、広げた上限を切らない',o.rhythmTouchFixAutoFrom([row(5000,0,6,1),row(5000,0,3,0),row(5000,0,2,0)]).inputAgeCap===undefined);
  o.rhythmTouchFixAutoSet({smoothSongClock:true});
  check('自動で入れると決めた時計の直し方は、iPhone以外でも入る',makeContext(PC).rhythmTouchFixOn('smoothSongClock')===false&&(()=>{const p=makeContext(PC);p.rhythmTouchFixAutoSet({smoothSongClock:true});return p.rhythmTouchFixOn('smoothSongClock');})()===true);
  const q=makeContext(IPHONE);q.rhythmTouchFixAutoSet({inputAgeCap:false});
  check('自動で切ると決めた直し方は、iPhoneでも切れる',q.rhythmTouchFixOn('inputAgeCap')===false&&!q.rhythmTouchFixesActive().includes('inputAgeCap'));
  q.rhythmTouchFixAutoSet({});
  check('自動の決めを空にすると、標準(いまは切)へ戻る',q.rhythmTouchFixOn('inputAgeCap')===false);
}
// 3. この端末だけの上書き
{
  const store={};
  const o=makeContext(PC,store);
  check('パソコンでは、既定の「切る」のままなら入らない',o.rhythmTouchFixOn('inputAgeCap')===false);
  o.rhythmTouchFixSetOverride('inputAgeCap',true);
  check('この端末だけで入れると、パソコンでも入る',o.rhythmTouchFixOn('inputAgeCap')===true&&o.rhythmInputAgeCapMs()===300);
  check('上書きは新しい保存キーへ書く(既存のキーは触らない)',Object.keys(store).join()==='mh_rhythm_fix_override_v1'&&JSON.parse(store.mh_rhythm_fix_override_v1).inputAgeCap===true);
  check('入れた直し方は診断の fixes に残る',o.rhythmTouchFixesActive().includes('inputAgeCap'));
  o.rhythmInputAgeResetFloor();
  o.rhythmInputAgeMs(1000,1005); // 遅れの小さい入力を一度見る(時計の基準がそろっている印)
  // ゲームが本当に止まっていた(直前のコマが200ms前)ときだけ、広げた上限を使う
  o.clock.now=1000;o.RHYTHM_TIMING_DIAG.frame(1);o.clock.now=1200;
  check('入れると、コマが止まっていた間に遅れた入力(200ms)は200msのまま使う',o.rhythmInputAgeMs(1000,1200)===200);
  // 直前のコマがつい今来ていた(止まっていない)のに「200ms遅れた」と言う入力は、これまでの上限(80ms)で止める
  o.clock.now=2195;o.RHYTHM_TIMING_DIAG.frame(2);o.clock.now=2200;
  check('入れても、コマが止まっていないのに古い時刻の入力は、80msで止める(時刻が古いだけの疑い)',o.rhythmInputAgeMs(2000,2200)===80);
  // 300msを超える遅れは300msまで
  o.clock.now=3000;o.RHYTHM_TIMING_DIAG.frame(3);o.clock.now=3500;
  check('広げた上限は300msまで',o.rhythmInputAgeMs(3000,3500)===300);
  const snap=o.RHYTHM_TIMING_DIAG.snapshot();
  check('止まりが見えた/見えなかった遅れた入力を、別々に数える',snap.ageBacked===2&&snap.ageUnbacked===1,JSON.stringify([snap.ageBacked,snap.ageUnbacked]));
  check('入れても、基準がずれている端末(いつも大きい差)は使わない',(()=>{const p=makeContext(PC,{mh_rhythm_fix_override_v1:'{"inputAgeCap":true}'});p.rhythmInputAgeResetFloor();p.clock.now=1000;p.RHYTHM_TIMING_DIAG.frame(1);p.clock.now=1500;return p.rhythmInputAgeMs(1000,1500)===0;})());
  o.rhythmTouchFixSetOverride('inputAgeCap',null);
  check('上書きをやめると、既定へ戻る',o.rhythmTouchFixOn('inputAgeCap')===false&&o.rhythmInputAgeCapMs()===80);
  const broken=makeContext(PC,{mh_rhythm_fix_override_v1:'{壊れた'});
  check('壊れた保存値でも落ちず、既定のまま',broken.rhythmTouchFixOn('inputAgeCap')===false);
  check('名前の無い直し方・allPlatforms は上書きできない',o.rhythmTouchFixSetOverride('そんな名前',true)===false&&o.rhythmTouchFixSetOverride('allPlatforms',true)===false);
}
// 4. 本体のつなぎ
check('取りこぼしの回収は、ゲームが直前に本当に止まったときだけ長くする',/const rhythmMissReclaimMs=\(\)=>RHYTHM_INPUT_MATCH_WINDOW_MS\+\(rhythmTouchFixOn\('inputAgeCap'\)&&RHYTHM_TIMING_DIAG\.recentStall\(RHYTHM_RECLAIM_WIDE_WINDOW_MS\)\?RHYTHM_INPUT_AGE_CAP_WIDE_MS:RHYTHM_INPUT_AGE_MAX_MS\);/.test(runtime)&&/const RHYTHM_MISS_RECLAIM_MS=rhythmMissReclaimMs\(\);/.test(play));
check('曲の時計の止まったコマを、コマごとに数える',/RHYTHM_TIMING_DIAG\.frame\(songTimeMs\)/.test(play));
check('演奏の始めに数え直し、端末の音の事情を入れる',/RHYTHM_TIMING_DIAG\.reset\(\);RHYTHM_TIMING_DIAG\.meta\(audio\.info\?\.\(\)\);RHYTHM_TOUCH_BRIDGE\.reset\(\)/.test(play));
check('診断の行へ timing を入れる',/timing:RHYTHM_TIMING_DIAG\.snapshot\(\)/.test(play));
check('演奏の始めに、ゲームが記録から直し方の入れ切りを決める',/rhythmTouchFixAutoSet\(rhythmTouchFixAutoFrom\(await storeGet\(RHYTHM_TOUCH_DIAG_KEY,\[\]\)\)\)/.test(play));
check('人が触るパネルは置かない(人の手で調整する前提にしない)',!/RhythmFixOverridePanel/.test(play)&&!/RhythmFixOverridePanel/.test(app));
check('アプリを離れたら数え、直し方が入っていれば一時停止する',/visibilitychange/.test(play)&&/RHYTHM_TIMING_DIAG\.hidden\(\)/.test(play)&&/rhythmTouchFixOn\('autoPauseOnHidden'\)\)pause\(\)/.test(play));
check('音の時計の直し方(smoothSongClock)は、入っていないときは ctx.currentTime から作った値のまま',/const rawSongTimeSeconds=\(\)=>Math\.min\(buffer\.duration,Math\.max\(0,offsetSeconds\+\(playing\?ctx\.currentTime-startedAt-outputLatencySeconds:0\)\)\);/.test(audio)&&/if\(!playing\|\|!rhythmTouchFixOn\('smoothSongClock'\)\|\|typeof performance==='undefined'\)\{smoothPerf=0;return raw;\}/.test(audio));
check('端末の音の事情(info)を返す',/info:\(\)=>\(\{outLatMs:/.test(audio)&&/headMs/.test(audio));

// 5. 報告ツール
{
  const d=require('./rhythm-touch-diag.js');
  const mk=(platform,n,t,song='haruka')=>Array.from({length:n},(_,i)=>({platform,device_key:'d'+i,song_id:song,note_count:300,created_at:new Date().toISOString(),stats:{touchStarts:300,timing:t}}));
  const rows=[...mk('ios',12,{ageHist:[250,20,10,12,6,2],ageCapped:20,frames:5000,stalls:300,hidden:1,pen:0,outLatMs:0,baseLatMs:10,hasTs:false,headMs:140}),...mk('android',12,{ageHist:[300,0,0,0,0,0],ageCapped:0,frames:5000,stalls:5,hidden:0,pen:0,outLatMs:60,baseLatMs:20,hasTs:true,headMs:103})];
  const lines=d.timingLines(d.timingSummary(rows));
  check('報告ツール: 遅れて届いた入力・止まったコマ・離れた曲を見つけ、直し方を出す',JSON.stringify(d.timingFixesFor(lines))===JSON.stringify(['inputAgeCap','smoothSongClock','autoPauseOnHidden']),JSON.stringify(d.timingFixesFor(lines)));
  check('報告ツール: iPhone の出力遅延が小さい疑い・曲の頭の差を見つける',lines.some(l=>/出力遅延/.test(l.text))&&lines.some(l=>/曲の頭の無音/.test(l.text)));
  const calm=mk('ios',12,{ageHist:[300,0,0,0,0,0],ageCapped:0,frames:5000,stalls:5,hidden:0,pen:0});
  check('報告ツール: 問題のない記録では何も疑わない',d.timingLines(d.timingSummary(calm)).every(l=>l.level!=='found'));
  check('報告ツール: 記録が少ないあいだは判定しない',d.timingLines(d.timingSummary(mk('ios',3,{ageHist:[1,0,0,0,0,0],frames:10,stalls:0}))).some(l=>l.level==='wait'));
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
