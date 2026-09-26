// 横フリックの向きの決め方(2026-09-26・Rev.8〜)。生成器・自動修正(step7)・気持ちよさの物差しが同じ決め方を使う。
//
// 【なぜ作り直したか】
// Rev.4〜7 は生成器の最後に「旋律が上がれば右・下がれば左、動かなければ次のノーツの方向、それも無ければ端なら外向き」
// で向きを付けていた。遊んだ感想は「なぜここが左で次が右なのか、向きがバラバラ」。測ると、公開曲の MASTER で
// 向きが手の動きと合っているのは25〜71%、もう片方の指へ向かって払うものが1曲に1〜11本あった
// (rhythm-chart-feel-report.js)。旋律の上下は耳では分かっても、指の動きとは関係が無い。
// さらに、向きを付けたあとで自動修正がレーンを動かすので、付けたときに合っていた向きも崩れていた。
//
// 【決め方】払う指の動きで決める。親指はそのまま次の場所へ流れる向きへ払うのがいちばん自然
//   ① 同じ指が次に取るノーツが近く(SIDE_FLICK_NEIGHBOR_MS 以内)にあれば、その方向(払いが次の動きの始まりになる)
//   ② 無ければ、同じ指が来た向きへ払い抜ける
//   ③ どちらも無ければ、もう片方の指から離れる向き(外向き。両手がぶつからない)
//   ・決めた向きが、近く(SIDE_FLICK_COLLIDE_LANES 未満)にいるもう片方の指へ向かうなら、向きを付けない(上向きのまま)
//   ・どれでも決まらなければ向きを付けない
// 「同じフレーズは同じ向き」は、写した小節のレーンが同じ(反転なら左右逆)なので、この決め方なら自然に揃う。
'use strict';
const {noteTouchSpan,slideLaneAtGrid,slideLaneOffset}=require('./rhythm-hand-model.js');
const {simulateNotes}=require('./rhythm-hand-simulate.js');

// 同じ指の前後のノーツを「近い」とみなす時間(ms)
const SIDE_FLICK_NEIGHBOR_MS=500;
// これより小さい横の動きは「その場」とみなす(レーン)
const SIDE_FLICK_MIN_SHIFT_LANES=.5;
// もう片方の指にこれより近い所で、その指へ向かって払うと「ぶつかる」(レーン)
const SIDE_FLICK_COLLIDE_LANES=1.5;

const centerOf=note=>{const [lo,hi]=noteTouchSpan(note);return (lo+hi)/2;};
const endCenterOf=note=>note.type==='SLIDE'&&Array.isArray(note.slidePoints)&&note.slidePoints.length
  ?Number(note.slidePoints[note.slidePoints.length-1].lane)+slideLaneOffset():centerOf(note);
const gridMsOf=timing=>Number.isFinite(Number(timing.gridMs))?Number(timing.gridMs):timing.beatMs/timing.subdivisionsPerBeat;

// 譜面の FLICK ごとに、向きを決める材料を集める。notes の並びのまま手のシミュレートにかける。
//   返り値: [{index, toNext, incoming, outward, otherLane, center}]  (向きは -1 / 0 / 1)
const sideFlickContexts=(notes,timing,options={})=>{
  const gridMs=gridMsOf(timing);
  const timeOf=grid=>timing.beatZeroMs+grid*gridMs;
  const sim=simulateNotes(notes,timing,{beam:options.beam});
  const hits=notes.map((note,index)=>({note,index,ms:timeOf(note.grid),finger:sim.assignments.has(index)?sim.assignments.get(index):null,
    lane:centerOf(note),endLane:endCenterOf(note),
    endMs:note.type==='HOLD'||note.type==='SLIDE'?timeOf(note.grid+(Number(note.durationGrids)||0)):timeOf(note.grid)}))
    .sort((a,b)=>a.ms-b.ms||a.lane-b.lane);
  // その時刻にもう片方の指がいる場所(押さえている最中なら帯の上の位置、離したあとなら最後に触った場所)
  const otherFingerLane=(finger,ms)=>{
    let last=null;
    for(const hit of hits){
      if(hit.ms>ms+1e-6)break;
      if(hit.finger!=null&&hit.finger!==finger)last=hit;
    }
    if(!last)return null;
    if(last.endMs>ms&&last.note.type==='SLIDE'){
      const onPath=slideLaneAtGrid(last.note,(ms-timing.beatZeroMs)/gridMs);
      if(onPath!=null)return onPath;
    }
    return last.endMs>ms?last.lane:last.endLane;
  };
  const sign=value=>Math.abs(value)>=SIDE_FLICK_MIN_SHIFT_LANES?Math.sign(value):0;
  const out=[];
  hits.forEach((hit,position)=>{
    if(hit.note.type!=='FLICK'||hit.note.chord)return;
    const sameFinger=other=>hit.finger!=null&&other.finger===hit.finger;
    const next=hits.slice(position+1).find(other=>other.ms>hit.ms+1e-6&&sameFinger(other));
    const prev=hits.slice(0,position).reverse().find(other=>other.ms<hit.ms-1e-6&&sameFinger(other));
    const toNext=next&&next.ms-hit.ms<=SIDE_FLICK_NEIGHBOR_MS?sign(next.lane-hit.lane):0;
    const incoming=prev&&hit.ms-prev.endMs<=SIDE_FLICK_NEIGHBOR_MS?sign(hit.lane-prev.endLane):0;
    const otherLane=otherFingerLane(hit.finger,hit.ms);
    const outward=otherLane==null?0:(Math.abs(hit.lane-otherLane)<.25?0:Math.sign(hit.lane-otherLane));
    out.push({index:hit.index,ms:hit.ms,toNext,incoming,outward,otherLane,center:hit.lane});
  });
  return out;
};

// 材料から向きを決める。{dir:-1|0|1, basis:'next'|'incoming'|'outward'|'none', blocked}
const collides=(context,dir)=>dir!==0&&context.otherLane!=null
  &&Math.sign(context.otherLane-context.center)===dir&&Math.abs(context.otherLane-context.center)<SIDE_FLICK_COLLIDE_LANES;
const chooseSideFlickDir=context=>{
  let dir=0,basis='none';
  if(context.toNext){dir=context.toNext;basis='next';}
  else if(context.incoming){dir=context.incoming;basis='incoming';}
  else if(context.outward){dir=context.outward;basis='outward';}
  if(collides(context,dir))return {dir:0,basis,blocked:true};
  return {dir,basis,blocked:false};
};

// 譜面の FLICK に向きを付け直す(もとの向きは消す)。ノーツの数・時刻・位置は変えない。
const assignSideFlickDirs=(notes,timing,options={})=>{
  for(const note of notes)if(note.type==='FLICK')delete note.flickDir;
  let left=0,right=0,plain=0,blocked=0;
  for(const context of sideFlickContexts(notes,timing,options)){
    const choice=chooseSideFlickDir(context);
    if(choice.blocked)blocked++;
    if(!choice.dir){plain++;continue;}
    notes[context.index].flickDir=choice.dir<0?'left':'right';
    if(choice.dir<0)left++;else right++;
  }
  return {left,right,plain,blocked};
};

module.exports={SIDE_FLICK_NEIGHBOR_MS,SIDE_FLICK_MIN_SHIFT_LANES,SIDE_FLICK_COLLIDE_LANES,
  sideFlickContexts,chooseSideFlickDir,collides,assignSideFlickDirs};
