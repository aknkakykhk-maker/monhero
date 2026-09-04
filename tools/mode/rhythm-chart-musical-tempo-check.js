#!/usr/bin/env node
// 遊べる形になっている譜面が「指で押せること」と「音楽のテンポを再現していること」を確かめる。
//
//   node tools/mode/rhythm-chart-musical-tempo-check.js
//
// 【なぜ要るか】実機の指摘(2026-09-05)
//   「1枠を隣り合わせで交互に連続押しは物理的に不可能だからそういう譜面は作らないようにして。
//     もちろん速度と押すスピードによるから譜面作成ツールの精度をもっと上げてほしい」
//   「現状ハードですら後半むずすぎる。多分終盤にノーツを増やしてるから後半が異常にむずくなる。
//     サビは盛り上がってむずくするのはいいとおもうけど、あくまでも音楽のテンポを再現してってほしい」
//
// それまでの生成は、小節あたりのノーツ数を**音量・厚み(intensity)だけ**で決めていた。
// この曲はリズムの細かさが曲を通してほぼ一定(1小節あたり4〜8音)で、終盤に増えているのは
// 音量のほうなので、リズムが変わっていないのにノーツだけ倍以上に増えていた。
// 指のモデルにも太さが無く、「16分おきに0.25レーンだけずれた交互押し」を押せると判定していた。
//
// ここでは**実際にゲームへ載っている譜面**(rhythm-mode.js のランタイム)を見る。
// 設計資料だけを見ていると、載せ替えを忘れたときに気づけないため。
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {HAND_MODEL,fingerPairFeasible}=require('./rhythm-hand-model.js');

const ROOT=path.resolve(__dirname,'..','..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};

const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
// 難易度ごとの上限。EASY〜HARDは「その小節に実際にある音の数」を超えない。
// EXPERT / MASTER は、より細かいオンセット(STEP1のevents.onsets)まで拾う難易度なので、
// 参照源(dense)より多くなること自体は正しい。それでも青天井にはしない。
const MAX_OVER_MUSIC=Object.freeze({EASY:1.0,NORMAL:1.0,HARD:1.0,EXPERT:1.45,MASTER:1.8});
// サビの中で「音の数が多い小節ほどノーツも多い」と言えるだけの相関があること。
// ここが0付近だと、上限に張り付いていて音楽ではなく上限が形を決めている。
const MIN_CHORUS_CORRELATION=Object.freeze({EASY:.3,NORMAL:.3,HARD:.3,EXPERT:.3,MASTER:.05});
// 16分の連なりの上限(難易度順に増える)
const MAX_SIXTEENTH_RUN=Object.freeze({EASY:1,NORMAL:1,HARD:2,EXPERT:6,MASTER:8});

// --- ランタイムの譜面 ---
const runtimeSource=read('monster-hero/data/rhythm-mode.js');
const ctx={Object,Number,Math,JSON,Array,String,Boolean,console,Date,Map,Set,isNaN,parseInt,parseFloat};
vm.createContext(ctx);
vm.runInContext(runtimeSource.split('const installRhythmGestureVisuals',1)[0]+'\nthis.out={RHYTHM_SONGS};',ctx);
const song=(ctx.out.RHYTHM_SONGS||[]).find(s=>s.songId==='monster_hero_theme_candidate_v2');
check('ランタイムに「Monster Hero 候補v2」がある',!!song);
if(!song){console.log(`\n${failed}件のNGがあります`);process.exit(1);}

// --- 曲の側(小節ごとに実際にある音の数) ---
const timingCtx={Object,Number,Math};
vm.createContext(timingCtx);
vm.runInContext(`${read('monster-hero/data/rhythm-timing.js')}\nthis.t=RHYTHM_TIMING_DATA.monster_hero_theme;`,timingCtx);
const timing=timingCtx.t;
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const BAR=timing.subdivisionsPerBeat*4;
// ランタイムの timeMs は整数へ丸めてあるので、いったんグリッドへ戻してから小節を出す
// (そのまま割ると、小節の頭のノーツが1つ前の小節へ落ちることがある)
const gridOfMs=ms=>Math.round((ms-timing.beatZeroMs)/gridMs);
const barOfMs=ms=>Math.floor(gridOfMs(ms)/BAR);
const candidates=JSON.parse(read('tools/mode/authoring/monster-hero-theme-onset-candidates-dense.json'));
const musicByBar=new Map();
for(const [grid] of candidates.candidates){
  const bar=Math.floor(grid/BAR);
  musicByBar.set(bar,(musicByBar.get(bar)||0)+1);
}
check('曲の側の「小節ごとの音の数」を測れる',musicByBar.size>50,`${musicByBar.size}小節`);

const structure=JSON.parse(read('tools/mode/authoring/monster-hero-theme-v2-structure.json'));
const sectionOfMs=ms=>{
  for(const s of structure.sections)if(ms>=s.startMs&&ms<s.endMs)return s.sectionTypeCandidate;
  return 'END';
};
const sectionDensity=(notes,type,ordinal=0)=>{
  const matched=structure.sections.filter(s=>s.sectionTypeCandidate===type)[ordinal];
  if(!matched)return null;
  const count=notes.filter(n=>n.timeMs>=matched.startMs&&n.timeMs<matched.endMs).length;
  return count/((matched.endMs-matched.startMs)/1000);
};
const correlation=(xs,ys)=>{
  const n=xs.length;
  if(n<3)return 0;
  const mx=xs.reduce((a,b)=>a+b,0)/n,my=ys.reduce((a,b)=>a+b,0)/n;
  let sxy=0,sxx=0,syy=0;
  for(let i=0;i<n;i++){const dx=xs[i]-mx,dy=ys[i]-my;sxy+=dx*dy;sxx+=dx*dx;syy+=dy*dy;}
  return sxy/Math.sqrt(sxx*syy||1);
};

// --- 難易度ごとに見る ---
const noteCounts={};
for(const difficulty of DIFFICULTIES){
  const chart=song.difficulties[difficulty];
  if(!chart){check(`${difficulty}: ランタイムに譜面がある`,false);continue;}
  const notes=[...chart.notes].sort((a,b)=>a.timeMs-b.timeMs);
  noteCounts[difficulty]=notes.length;

  // (1) 指の物理条件。ここが本丸。
  const impossible=[];
  for(let i=1;i<notes.length;i++){
    for(let j=i-1;j>=0;j--){
      const deltaMs=notes[i].timeMs-notes[j].timeMs;
      if(deltaMs>=HAND_MODEL.restrikeLimitMs)break;
      if(deltaMs<1)continue;
      const feasible=fingerPairFeasible(notes[i],notes[j],deltaMs);
      if(!feasible.ok){impossible.push({timeMs:notes[i].timeMs,reason:feasible.reason});break;}
    }
  }
  check(`${difficulty}: 指が2本入らない近さで速すぎる組み合わせが無い`,impossible.length===0,
    impossible.length?`${impossible.length}件 / 例: ${(impossible[0].timeMs/1000).toFixed(1)}s ${impossible[0].reason}`
      :`${notes.length}ノーツを総当たりで確認`);

  // (2) 音の数を超えて置いていないか
  const byBar=new Map();
  for(const note of notes){
    const bar=barOfMs(note.timeMs);
    byBar.set(bar,(byBar.get(bar)||0)+1);
  }
  let worst=0,worstBar=-1;
  for(const [bar,count] of byBar){
    const music=musicByBar.get(bar)||0;
    const ratio=music?count/music:Infinity;
    if(ratio>worst){worst=ratio;worstBar=bar;}
  }
  check(`${difficulty}: どの小節も、その小節に実際にある音の数に見合っている`,
    worst<=MAX_OVER_MUSIC[difficulty]+1e-9,
    `最大 ${worst.toFixed(2)}倍(第${worstBar+1}小節) / 上限 ${MAX_OVER_MUSIC[difficulty]}倍`);

  // (3) サビの中でも、音が多い小節ほどノーツが多い(上限に張り付いていない)
  const chorusBars=[...byBar.keys()].filter(bar=>{
    const type=sectionOfMs(timing.beatZeroMs+bar*BAR*gridMs);
    return type==='CHORUS'||type==='FINAL_CHORUS';
  });
  const r=correlation(chorusBars.map(bar=>musicByBar.get(bar)||0),chorusBars.map(bar=>byBar.get(bar)));
  check(`${difficulty}: サビの中の濃淡が曲のリズムに沿っている`,
    r>=MIN_CHORUS_CORRELATION[difficulty],
    `相関 ${r.toFixed(2)} / 下限 ${MIN_CHORUS_CORRELATION[difficulty]}`);

  // (4) 終盤へ向かって積み増していない
  const firstChorus=sectionDensity(notes,'CHORUS',0);
  const finalChorus=sectionDensity(notes,'FINAL_CHORUS',0);
  check(`${difficulty}: 終盤(最後のサビ)が最初のサビより濃くなっていない`,
    finalChorus!==null&&firstChorus!==null&&finalChorus<=firstChorus+1e-9,
    `最初のサビ ${firstChorus?.toFixed(2)} → 最後のサビ ${finalChorus?.toFixed(2)} 毎秒`);

  // (5) 16分の連なりが難易度なりの長さで止まっている
  let run=1,maxRun=1;
  for(let i=1;i<notes.length;i++){
    const deltaMs=notes[i].timeMs-notes[i-1].timeMs;
    if(Math.abs(deltaMs-gridMs)<=gridMs*.2){run++;maxRun=Math.max(maxRun,run);}
    else run=1;
  }
  check(`${difficulty}: 16分の連なりが難易度なりの長さで止まっている`,
    maxRun<=MAX_SIXTEENTH_RUN[difficulty],
    `最長 ${maxRun}連 / 上限 ${MAX_SIXTEENTH_RUN[difficulty]}連`);
}

// --- 難易度の順 ---
const ordered=DIFFICULTIES.map(d=>noteCounts[d]);
check('ノーツ数が難易度順に増える',
  ordered.every((value,index)=>index===0||value>ordered[index-1]),
  DIFFICULTIES.map((d,i)=>`${d} ${ordered[i]}`).join(' < '));

// --- 生成側にも同じ条件が入っているか(譜面を作り直したときに戻らないように) ---
const generator=read('tools/mode/rhythm-chart-v2-step3-generate.js');
check('生成側が手のモデルを見て置き場所を決めている',
  generator.includes("require('./rhythm-hand-model.js')")&&generator.includes('const placeable='));
check('生成側の小節あたりの上限が「その小節に実際にある音の数」から決まる',
  generator.includes('const musicalOnsetsInBar=')&&/musicalShare/.test(generator)
  &&/musicalLift/.test(generator));
check('難易度ごとの割合(musicalShare)が難易度順に増える',(()=>{
  const values=[...generator.matchAll(/musicalShare:([0-9.]+)/g)].map(m=>Number(m[1]));
  return values.length===5&&values.every((v,i)=>i===0||v>values[i-1]);
})(),[...generator.matchAll(/musicalShare:([0-9.]+)/g)].map(m=>m[1]).join(' < '));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
