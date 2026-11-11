// 流れの速さが変わる譜面(変動・速さの表 scrollChanges)を、どの曲にも同じ物差しで確かめる(2026-11-11 ヘンドウ)。
//
// ① 表を持つ全部の譜面(5難易度・HELL)・ノーツ速度1〜12のどれでも、判定より前に判定線へ触れてしまうノーツが0
//    (止まる・戻るの前後で、ノーツが一度判定線へ着いてから奥へ戻る見え方は読めない)。
//    公開中で残っているものは KNOWN に書き、増えたら止める(公開中の譜面はこの検査では直さない)
// ② 曲の終わりまで止まりっぱなし(最後の区切りが倍率0)の表が無い(Evans の撮影で演奏画面が固まった件。止めて終わるなら 0.1)
// ③ 1コマ(60fps)で動く量の最大が道の LIMIT_PER_FRAME 割以下(一気に来る所も目で追える)
// ④ 変動の口(rhythmScrollFxChart)が決めどおりに表と組を作るか(一般化した例で)
//    ・止まる・戻る間のノーツに組1が付く ・行って戻るの直後のノーツも早触れしないよう組1へ移る ・quiet の区間はノーツを外す ・書かなければ譜面はそのまま
// ⑥ マルチ観戦のレーン(77-screen-rhythm-multi.jsx の RhythmWatchLane)は、演奏画面と同じ位置で流す(2026-11-11 社長が選択)。
//    観戦用の位置 rhythmScrollLocal が、演奏画面の rhythmScrollPos と全譜面・全組で一致し、表の無い譜面は null。レーンがそれを使っている
// ⑤ 変動の口を使った譜面(scrollFx を持つ)は、演出の時刻が読めて種類が正しく、区間が重ならない
//   node tools/mode/rhythm-scroll-fx-check.js
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{if(!cond||process.env.VERBOSE)console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const ctx={Object,Number,Math,JSON,Array,String,Date,Infinity,NaN,Set,console};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')}
this.out={probe:RHYTHM_SCROLL_FX_PROBE_TRAVEL,songs:RHYTHM_SONGS,hell:RHYTHM_HELL_CHARTS,rhythmScrollSet,rhythmScrollPos,rhythmScrollEarlyTouches,rhythmScrollFxChart,rhythmScrollFxBuild,rhythmScrollLocal,rhythmScrollFxMs,mhChart};`,ctx);
const R=ctx.out;
// ノーツ速度1〜12の、道を流れる時間(28-rhythm-shared.jsx の RHYTHM_NOTE_TRAVEL_MS_POINTS と同じ)
const src=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/28-rhythm-shared.jsx'),'utf8');
const base=Number((/const RHYTHM_NOTE_TRAVEL_BASE_MS=(\d+)/.exec(src)||[])[1]);
const pts=(/const RHYTHM_NOTE_TRAVEL_MS_POINTS=Object\.freeze\(\[([^\]]+)\]/.exec(src)||[])[1];
const TRAVEL=pts?pts.split(',').map(s=>s.trim()==='RHYTHM_NOTE_TRAVEL_BASE_MS'?base:Number(s)):[];
ok('ノーツ速度の表を読めた',TRAVEL.length===12&&TRAVEL.every(Number.isFinite),TRAVEL.join(','));
ok('変動の口の見張りの速度が、ゲーム本体のノーツ速度の表と同じ',JSON.stringify([...R.probe])===JSON.stringify(TRAVEL),`${[...R.probe]} / ${TRAVEL}`);
// 公開中で、判定より前に判定線へ触れるノーツ(曲/難易度/時刻ms)。直すのは窓口の判断(2026-11-11 窓口へ報告)。ここに無いものが出たら止める
const KNOWN=new Set(['evans/EXPERT/84687','evans/MASTER/84687','evans/HELL/84687']);
const LIMIT_PER_FRAME=.25;
const FRAME=1000/60;

const charts=[];
for(const s of R.songs)for(const [d,c] of Object.entries(s.difficulties||{}))if(c&&c.scrollChanges)charts.push([s.songId,d,c]);
for(const [id,c] of Object.entries(R.hell||{}))if(c&&c.scrollChanges)charts.push([id,'HELL',c]);
ok('速さの表を持つ譜面が見つかる',charts.length>=15,`${charts.length}譜面`);

let known=0,worstFrame=0,worstAt='';
for(const [id,d,c] of charts){
  const early=new Set();
  for(const t of TRAVEL)for(const n of R.rhythmScrollEarlyTouches(c.scrollChanges,c.notes,t,c.scrollGroups))early.add(`${id}/${d}/${n.timeMs}`);
  const fresh=[...early].filter(k=>!KNOWN.has(k));known+=early.size-fresh.length;
  ok(`① ${id} ${d}: 判定より前に判定線へ触れるノーツ0`,!fresh.length,fresh.slice(0,5).join(' '));
  const last=c.scrollChanges[c.scrollChanges.length-1];
  ok(`② ${id} ${d}: 終わりで止まりっぱなしにならない`,!(Array.isArray(last)&&typeof last[1]!=='string'&&Number(last[1])===0),JSON.stringify(last));
  // ③ 1コマで動く量(道の割合)。表の区切りの前後だけ細かく見る(一定の区間は端で最大)
  const from=Math.max(0,Number(c.scrollChanges[0][0])-1000),to=Math.min(Number(c.durationMs)||0,Number(last[0])+3000);
  for(const travel of [TRAVEL[0],TRAVEL[5],TRAVEL[11]]){
    R.rhythmScrollSet(c.scrollChanges,travel,c.scrollGroups);
    for(const g of [undefined,...Object.keys(c.scrollGroups||{})]){
      let prev=R.rhythmScrollPos(from,g);
      for(let t=from+FRAME;t<=to;t+=FRAME){const s=R.rhythmScrollPos(t,g),mv=Math.abs(s-prev)/travel;prev=s;
        if(mv>worstFrame){worstFrame=mv;worstAt=`${id} ${d} ${Math.round(t)}ms 速さ${TRAVEL.indexOf(travel)+1}`;}}
    }
    R.rhythmScrollSet(null);
  }
  // ⑤ 変動の口を使った譜面
  if(Array.isArray(c.scrollFx)){
    const kinds=new Set(['stop','back','backHold','rush','ease','speed']);
    const items=c.scrollFx.map(f=>({...f,at:R.rhythmScrollFxMs(f.at),len:Number(f.len)||0})).sort((a,b)=>a.at-b.at);
    ok(`⑤ ${id} ${d}: 演出の時刻・種類が読める`,items.every(f=>Number.isFinite(f.at)&&kinds.has(f.kind)),JSON.stringify(c.scrollFx).slice(0,160));
    const overlap=items.filter((f,i)=>i&&items[i-1].at+items[i-1].len>f.at);
    ok(`⑤ ${id} ${d}: 演出の区間が重ならない`,!overlap.length,overlap.map(f=>f.at).join(','));
  }
}
ok('③ 1コマで動く量が道の25%以下',worstFrame<=LIMIT_PER_FRAME,`最大 ${(worstFrame*100).toFixed(1)}%(${worstAt})`);

// ④ 変動の口
{
  const tap=(timeMs,lane=2)=>({type:'TAP',timeMs,lane,width:1});
  const notes=[];for(let t=1000;t<=20000;t+=250)notes.push(tap(t,(t/250)%6));
  notes.push(tap(8620,4));
  notes.push({type:'HOLD',timeMs:4800,endTimeMs:5300,lane:1,width:1});
  const chart=R.mhChart(30,notes,22000,6);
  ok('④ 書かなければ譜面はそのまま',R.rhythmScrollFxChart(chart,[])===chart&&R.rhythmScrollFxChart(chart,null)===chart);
  ok('④ 時刻は分:秒でも書ける',R.rhythmScrollFxMs('1:23.450')===83450&&R.rhythmScrollFxMs(5000)===5000&&Number.isNaN(R.rhythmScrollFxMs('x')));
  const fx=[{at:'0:05',kind:'stop',len:500},{at:8000,kind:'back',len:600,amount:.2},{at:12000,kind:'backHold',len:400,amount:.3,hold:true},{at:12400,kind:'stop',len:300,hold:true},
    {at:12700,kind:'rush',len:500},{at:15000,kind:'ease',len:1000,to:2},{at:17000,kind:'speed',to:1},{at:18000,kind:'stop',len:400,quiet:true}];
  const b=R.rhythmScrollFxBuild(fx);
  ok('④ 表の形',JSON.stringify(b.changes)===JSON.stringify([[5000,0],[5500,1],[8000,'GLIDE',-0.2,0.5],[8300,'GLIDE',0.2,0.5],[8600,1],[12000,'GLIDE',-0.3,0.5],[12400,0],[12700,'RUSH',0.97],[13200,1],[15000,'LERP',1],[16000,2],[17000,1],[18000,0],[18400,1]]),JSON.stringify(b.changes));
  const c=R.rhythmScrollFxChart(chart,fx);
  const g=t=>c.notes.find(n=>n.timeMs===t)?.scrollGroup;
  ok('④ 止まる間のノーツと、またがる長押しに組1',g(5000)===1&&g(5250)===1&&g(5500)===1&&g(4800)===1,`${g(5000)},${g(5250)},${g(5500)},${g(4800)}`);
  ok('④ 演出の外のノーツは組なし',g(3000)==null&&g(10000)==null);
  ok('④ quiet の区間はノーツを外す',!c.notes.some(n=>n.timeMs>=18000&&n.timeMs<=18400)&&c.notes.some(n=>n.timeMs===17750));
  const early=new Set();for(const t of TRAVEL)for(const n of R.rhythmScrollEarlyTouches(c.scrollChanges,c.notes,t,c.scrollGroups))early.add(n.timeMs);
  ok('④ 口で作った譜面は全速度で早触れ0(行って戻るの直後も)',!early.size,[...early].join(','));
  ok('④ 行って戻るの直後のノーツが組1へ移る',g(8620)===1&&g(8750)==null,`${g(8620)},${g(8750)}`);
  ok('④ 譜面の他の項目(Lv.・長さ)は保つ',c.level===30&&c.durationMs===22000&&c.totalNotes===c.notes.length);
}
// ⑥ 観戦
{
  let worst=0,where='';
  for(const [id,d,c] of charts){
    const local=R.rhythmScrollLocal(c,1800);R.rhythmScrollSet(c.scrollChanges,1800,c.scrollGroups);
    const end=Number(c.durationMs)||0;
    for(const g of [undefined,...Object.keys(c.scrollGroups||{})])for(let t=0;t<=end;t+=97){const diff=Math.abs(local(t,g)-R.rhythmScrollPos(t,g));if(diff>worst){worst=diff;where=`${id} ${d} ${t}ms 組${g??'なし'}`;}}
    R.rhythmScrollSet(null);
  }
  ok('⑥ 観戦の位置が演奏画面と同じ(全譜面・全組)',worst<1e-6,`最大のずれ ${worst}(${where})`);
  const plain=R.songs.flatMap(s=>Object.values(s.difficulties||{})).find(c=>c&&!c.scrollChanges);
  ok('⑥ 表の無い譜面は観戦も今までどおり(null)',plain&&R.rhythmScrollLocal(plain,1800)===null);
  const multi=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/77-screen-rhythm-multi.jsx'),'utf8');
  const lane=(/function RhythmWatchLane[\s\S]*?\n}\n/.exec(multi)||[''])[0];
  ok('⑥ 観戦のレーンが観戦用の位置を使う',/rhythmScrollLocal\(chart, RHYTHM_WATCH_LANE_SPAN_MS\)/.test(lane)&&/yOf\(n\.timeMs, n\.scrollGroup\)/.test(lane));
}
console.log(failed?`NG ${failed}件`:`OK: 速さの表 ${charts.length}譜面・ノーツ速度1〜12(公開中の既知の早触れ ${known}件・1コマの最大 ${(worstFrame*100).toFixed(1)}%)`);
process.exit(failed?1:0);
