#!/usr/bin/env node
// メインrAFがノーツを「必要な範囲だけ」走査していること、そしてその絞り込みで
// 判定・表示を取りこぼしていないことを確かめる。
//
// 実機(iPhone)の性能計測で平均18.6ms・16.7ms超が63%と、毎フレームの固定コストが
// 予算を超えていた。HARDでは毎フレーム266ノーツを見ていたが、実際に描画更新が
// 要るのは約5ノーツだけだったため、走査範囲を絞った。
//
// 速くするために判定を落としては本末転倒なので、ここでは曲全体を60fpsで最後まで
// 回して「全ノーツ走査」と「絞り込み走査」の結果が完全に一致することを確認する。
//
//   node tools/mode/rhythm-note-scan-window-check.js
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// ── 実装が「絞り込み」の形になっているか ──────────────────────────────
check('1ノーツぶんの処理を関数へ切り出している',game.includes('const visitNote=note=>{'));
check('終わって非表示にし終えたノーツから先頭を進める',
  game.includes('if(!(head.done&&(headEl?headEl._rhythmHidden===true:true)))break;')
  &&game.includes('run.scanFrom=scanFrom;'));
// 要素が無いノーツで先頭が止まると、絞り込みがまるごと効かなくなる。
// 判定さえ終わっていれば隠す対象は無いので進めてよい、という形になっていること。
check('要素が無いノーツで先頭が止まらない',
  game.includes('headEl?headEl._rhythmHidden===true:true'));
// 実機で「効いているのか」を数字で確かめられること(推測で直さないため)
check('走査の内訳と絞り込みの有無を計測へ渡している',
  game.includes('RHYTHM_PERF.notes(perfScanned,perfDrawn,scanFrom,run.notesAscending);'));
// tickが0msでも「JSが無実」とは言えないので、フレームが始まってから実際に
// tickへ入るまでの遅れ(tickへ入る前にメインスレッドが塞がっていた時間)も一緒に渡す。
check('tick本体の処理時間と、tickへ入るまでの遅れを計測している',
  game.includes('RHYTHM_PERF.tick(performance.now()-perfTickStart,perfTickStart-frameNowMs);')
  &&game.includes('const perfTickStart=RHYTHM_PERF.enabled?performance.now():0;'));
check('出番がまだ遠いノーツで打ち切る',
  game.includes('const scanHorizonMs=visualTime+travelMs*1.2;')
  &&game.includes('if(run.notesReady&&run.notesAscending&&note.timeMs>scanHorizonMs)break;'));
// 末尾の打ち切りは「時刻の昇順」が前提。譜面エディタなどから並び順が崩れた譜面が来ても
// 取りこぼさないよう、昇順でないときは絞り込まず全ノーツを見る形になっていること。
check('昇順でない譜面のときは打ち切りを自動で止める',
  game.includes('if(run.notesAscending===undefined)run.notesAscending=notes.every((n,i)=>i===0||n.timeMs>=notes[i-1].timeMs);'));
check('初回フレームだけは全ノーツを一巡して初期表示を作る',game.includes('run.notesReady=true;'));

// ── 絞り込んでも判定・表示を取りこぼさないか(曲全体をシミュレート) ────────
const chartFile=path.join(ROOT,'monster-hero/debug/monster-hero-theme-hard-formal-candidate-v1.json');
const chart=JSON.parse(fs.readFileSync(chartFile,'utf8'));
const gridMs=86.63,beatZero=206,travelMs=2150,offset=0;
const base=chart.notes.map((n,i)=>({index:i,timeMs:Math.round(beatZero+n.grid*gridMs),
  type:n.type,durationGrids:n.durationGrids||0}));
const releaseTargetMs=n=>n.durationGrids?n.timeMs+n.durationGrids*gridMs:n.timeMs;
check('検証に使う譜面が時刻の昇順',base.every((n,i)=>i===0||n.timeMs>=base[i-1].timeMs),`${base.length}ノーツ`);

const simulate=(narrow,source=base)=>{
  const ns=source.map(n=>({...n,done:false,activePointerId:null,hidden:false,everVisible:false}));
  // 実装と同じく、時刻の昇順でない譜面のときは末尾の打ち切りを行わない
  const ascending=ns.every((n,i)=>i===0||n.timeMs>=ns[i-1].timeMs);
  const missAt=new Map();let scanFrom=0,ready=false,maxScan=0,totalScan=0,frames=0,unhide=0;
  for(let t=0;t<=160000;t+=1000/60){
    const songTimeMs=t,visualTime=t-offset;let scanned=0;
    if(narrow){while(scanFrom<ns.length){const h=ns[scanFrom];if(!(h.done&&h.hidden))break;scanFrom++;}}
    const horizon=visualTime+travelMs*1.2;
    for(let i=narrow?scanFrom:0;i<ns.length;i++){
      const note=ns[i];
      if(narrow&&ready&&ascending&&note.timeMs>horizon)break;
      scanned++;
      if(!note.done&&note.activePointerId===null&&songTimeMs-(note.timeMs+offset)>200){
        note.done=true;note.judgment='MISS';missAt.set(note.index,Math.round(songTimeMs));
      }
      const failedTrail=note.done&&note.judgment==='MISS'&&(note.type==='HOLD'||note.type==='SLIDE')&&songTimeMs<releaseTargetMs(note);
      if(note.done&&!failedTrail){note.hidden=true;continue;}
      if(note.hidden){note.hidden=false;unhide++;}
      const progress=1-(note.timeMs-visualTime)/travelMs;
      if(failedTrail||(progress>=-.1&&progress<=1.18))note.everVisible=true;
    }
    if(narrow)ready=true;
    if(scanned>maxScan)maxScan=scanned;totalScan+=scanned;frames++;
  }
  return {ns,missAt,unhide,maxScan,avgScan:totalScan/frames};
};
const full=simulate(false),narrow=simulate(true);

check('絞り込んでも全ノーツが判定される',
  narrow.missAt.size===base.length&&full.missAt.size===base.length,
  `絞込${narrow.missAt.size} / 全走査${full.missAt.size} / 譜面${base.length}`);
let worst=0;
for(const [i,t] of full.missAt){const d=Math.abs((narrow.missAt.get(i)??-1e9)-t);if(d>worst)worst=d;}
check('判定が発生する時刻が全走査と完全に一致',worst===0,`最大ズレ ${worst}ms`);
check('すべてのノーツが一度は表示対象になる(突然消えない・出現が遅れない)',
  narrow.ns.every(n=>n.everVisible),`${narrow.ns.filter(n=>n.everVisible).length}/${base.length}`);
check('一度隠したノーツが復活しない',narrow.unhide===0);
check('走査数が実際に減っている',narrow.avgScan<full.avgScan/10,
  `全走査 平均${full.avgScan.toFixed(1)} → 絞込 平均${narrow.avgScan.toFixed(1)} (${(100-narrow.avgScan/full.avgScan*100).toFixed(1)}%減)`);
check('初回だけは全ノーツを一巡する',narrow.maxScan===base.length,`最大${narrow.maxScan}`);

// 譜面の並び順が崩れていても取りこぼさないこと(打ち切りが自動で止まる)
const shuffled=base.slice();
for(let i=shuffled.length-1;i>0;i--){const j=(i*7919+13)%(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
const messy=simulate(true,shuffled);
check('並び順が崩れた譜面でも全ノーツが判定される',
  messy.missAt.size===base.length,`${messy.missAt.size}/${base.length}`);
check('並び順が崩れた譜面でもノーツが消えない',
  messy.ns.every(n=>n.everVisible)&&messy.unhide===0);

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
