#!/usr/bin/env node
// 仮想プレイヤー(rhythm-virtual-player.js・2026-09-28・MHB CHART ENGINE Rev.18)を見張る。
//   ・同じ譜面なら毎回同じ結果(乱数は曲と難易度から決めた種)
//   ・難しい譜面ほどミスが多く、押す時刻がばらつく。詰まった譜面は、まばらな譜面よりミスが多い
//   ・手のシミュレートが「押せない」と言うノーツは、ミスの見込みが上がる
//   ・区間の差し替えは Rev.18 からだけ仮想プレイヤーを使う(Rev.17 までは今までどおり)
'use strict';
const fs=require('fs'),path=require('path');
const {playChart,noteModel}=require('./rhythm-virtual-player.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',file),'utf8'));

const audio=read('freedom-dive-v3-audio.json');
const easy=read('freedom-dive-v3-fixed-easy.json'),master=read('freedom-dive-v3-fixed-master.json');
{
  const a=playChart(master,audio,{runs:100}),b=playChart(master,audio,{runs:100});
  ok('同じ譜面なら毎回同じ結果',JSON.stringify(a)===JSON.stringify(b));
  const e=playChart(easy,audio,{runs:100});
  ok('難しい譜面ほどミスが多く、押す時刻がばらつく',a.missRate>e.missRate&&a.spreadMs>e.spreadMs,
    `EASY ミス ${(e.missRate*100).toFixed(1)}%・${e.spreadMs.toFixed(1)}ms / MASTER ミス ${(a.missRate*100).toFixed(1)}%・${a.spreadMs.toFixed(1)}ms`);
  const model=noteModel(master,audio);
  ok('どのノーツも、ばらつき・狙い・ミスの見込みが数になっている',model.every(m=>Number.isFinite(m.sigma)&&Number.isFinite(m.aimMs)&&Number.isFinite(m.miss)));
}
{
  // 作り物の譜面: 同じ音の数を、まばらに置いたものと、詰めて置いたもの
  const timing={bpm:120,beatMs:500,beatZeroMs:0,subdivisionsPerBeat:4,gridMs:125,beatsPerBar:4};
  const onsets=[];for(let g=0;g<2000;g++)onsets.push({grid:g,timeMs:g*125,strength:.8});
  const flat={timing,onsets};
  const sparse={trackId:'t',difficulty:'HARD',chartRevision:18,notes:Array.from({length:60},(_,i)=>({type:'TAP',grid:i*8,subLane:(i%4)*2,subLaneWidth:2}))};
  const dense={trackId:'t',difficulty:'HARD',chartRevision:18,notes:Array.from({length:60},(_,i)=>({type:'TAP',grid:i,subLane:(i%2)*8,subLaneWidth:2}))};
  const s=playChart(sparse,flat,{runs:200}),d=playChart(dense,flat,{runs:200});
  ok('詰まった譜面は、まばらな譜面よりミスが多く、ばらつく',d.missRate>s.missRate&&d.spreadMs>s.spreadMs,
    `まばら ${(s.missRate*100).toFixed(1)}%・${s.spreadMs.toFixed(1)}ms / 詰まり ${(d.missRate*100).toFixed(1)}%・${d.spreadMs.toFixed(1)}ms`);
  // 押せない配置(同じ時刻に離れた3か所)
  const three={trackId:'t',difficulty:'HARD',chartRevision:18,notes:[{type:'TAP',grid:8,subLane:0,subLaneWidth:2},{type:'TAP',grid:8,subLane:5,subLaneWidth:2},{type:'TAP',grid:8,subLane:10,subLaneWidth:2}]};
  const model=noteModel(three,flat);
  ok('手のシミュレートが押せないと言うノーツは、ミスの見込みが上がる',Math.max(...model.map(m=>m.miss))>=.5,model.map(m=>m.miss.toFixed(2)).join(' / '));
}
{
  const splice=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-splice.js'),'utf8');
  ok('区間の差し替えは Rev.18 からだけ仮想プレイヤーを使う',/const VIRTUAL_SPLICE_REVISION=18,/.test(splice)&&/const virtualParams=revision>=VIRTUAL_SPLICE_REVISION\?/.test(splice)&&/if\(virtualParams\)\{/.test(splice));
}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 仮想プレイヤーは期待どおり');
process.exit(failed?1:0);
