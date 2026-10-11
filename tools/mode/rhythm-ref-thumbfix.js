#!/usr/bin/env node
// 参考譜面に寄せる道具 段2.5: 下書きを親指2本で押せる形に直し、足りない分を音のある所へ足す(2026-10-11・Grievous Lady)。
//
//   node tools/mode/rhythm-ref-thumbfix.js --track <曲id> --in <ref-work の下書き> --out <ref-work の書き出し先>
//       [--ground]                 空中を地上へ(地上の5難易度用。スライドの高さも0)
//       [--min-level 48]           この Lv. に届くまで、音の立ち上がりへタップを足す(足すのは参考で密度の高い区間から)
//       [--stop a-b,…]             止まる・動く演出の区間(中の打鍵は置かない・足さない)
//       [--sky-gap-beats 1.5]      空中ありのとき: 同じ親指が地上と空中を行き来する間(足りない所は地上へそろえる)
//
// 【何をするか】rhythm-ref-tiers.js の親指2本のモデル(thumbCheck・横持ち)で「押せない」「指が交差」「届きにくい」と出た所を、
//   出た順に1つずつ直す。直し方は、そのノーツを別のレーンへ動かす(スライドは横へずらす)候補を全部試し、前後3秒の点数がいちばん下がるもの。
//   どれでも消えなければ、そのノーツを省く。直したあと「押せない0・指が交差0」になるまで繰り返す。何をいくつ動かした・省いたかを出す。
// 【決めごと】読むのも書くのも tools/mode/ref-work/<曲id>/ だけ(参考の写しはリポジトリに置かない)。
'use strict';
const fs=require('fs'),path=require('path');
const {assertWorkPath,REPO_ROOT}=require('./rhythm-ref-capture.js');
const {thumbCheck,THUMB_PROFILES,chartStats}=require('./rhythm-ref-tiers.js');
const args=process.argv.slice(2),get=(k,d)=>{const i=args.indexOf(`--${k}`);return i>=0?args[i+1]:d;};
const TRACK=get('track'),IN=path.resolve(get('in','')),OUT=path.resolve(get('out',''));
const GROUND=args.includes('--ground'),MIN_LEVEL=Number(get('min-level','0'))||0,SKY_GAP_BEATS=Number(get('sky-gap-beats','1.5'));
const STOPS=(get('stop','')||'').split(',').filter(Boolean).map(s=>s.split('-').map(Number));
assertWorkPath(IN);assertWorkPath(OUT);
const audio=JSON.parse(fs.readFileSync(path.join(REPO_ROOT,`tools/mode/authoring/${TRACK.replace(/_/g,'-')}-v3-audio.json`),'utf8'));
const beatMs=Number(audio.timing.beatMs),zeroMs=Number(audio.timing.beatZeroMs),gridMs=beatMs/4;
const W={impossible:100,cross:60,reach:40,busy:0};
const P=THUMB_PROFILES.landscape;
const startOf=n=>n.k==='s'?n.pts[0][0]:n.t,endOf=n=>n.k==='s'?n.pts[n.pts.length-1][0]:n.k==='h'?n.end:n.t;
const xOf=n=>n.k==='s'?n.pts[0][1]+0.5:(n.sub+n.w/2)/2;
// 区間の両端ちょうどのノーツ(演出の終わりに判定線へ着くノーツ)は残す
const inStop=(a,b)=>STOPS.some(([s,e])=>b>s+1&&a<e-1);
const SRC=JSON.parse(fs.readFileSync(IN,'utf8'));
let notes=SRC.notes.map(n=>JSON.parse(JSON.stringify(n)));
const log={moved:0,shifted:0,dropped:0,droppedSlides:0,skyToGround:0,added:0,stopDropped:0};
// 下ごしらえ: 地上だけにする・演出の区間の中を空ける・曲の前(最初の音より前)の光を外す
const firstOnset=Math.min(...audio.onsets.map(o=>o.timeMs));
notes=notes.filter(n=>{if(startOf(n)<firstOnset-gridMs){log.stopDropped++;return false;}if(inStop(startOf(n),endOf(n))){log.stopDropped++;return false;}return true;});
if(GROUND)for(const n of notes){if(n.sky){n.sky=0;}if(n.k==='s')for(const p of n.pts)p[3]=0;}
const sorted=()=>notes.sort((a,b)=>startOf(a)-startOf(b));
const score=list=>thumbCheck(list,P,beatMs).issues.reduce((a,i)=>a+W[i.kind],0);
const local=(t,except,extra)=>{const list=notes.filter(n=>n!==except&&endOf(n)>=t-3000&&startOf(n)<=t+3000);if(extra)list.push(extra);return list;};
// 空中ありのとき: 同じ親指(道の左右半分)が地上と空中を行き来する間が足りなければ、空中を地上へそろえる
const skyGap=()=>{
  if(GROUND)return;
  // 同じ親指(道の左右半分。スライドは hand)のノーツを「前のノーツの終わりから1.5拍以上あく所」で区切り、かたまりごとに段をそろえる。
  // かたまりの中で多いほうの段にそろえる(スライドも1つと数える)
  const sideOf=n=>n.k==='s'?n.hand:(xOf(n)<3?'L':'R');
  const tierOf=n=>n.k==='s'?(n.pts.some(p=>p[3]>0)?1:0):(n.sky?1:0);
  for(const side of ['L','R']){
    const list=sorted().filter(n=>sideOf(n)===side);
    let run=[];
    const flush=()=>{if(!run.length)return;
      // 多いほうの段にそろえる(スライドも1つと数える)。合わないスライドは高さを0(地上)か1(空中)にそろえる
      const tier=run.filter(n=>tierOf(n)).length*2>=run.length?1:0;
      for(const n of run){if(tierOf(n)===tier)continue;
        if(tier)log.groundToSky=(log.groundToSky||0)+1;else log.skyToGround++;
        if(n.k==='s')n.pts.forEach(p=>p[3]=tier);else n.sky=tier;}
      run=[];};
    let lastEnd=-1e9;
    for(const n of list){if(startOf(n)-lastEnd>=beatMs*SKY_GAP_BEATS-1)flush();run.push(n);lastEnd=Math.max(lastEnd,endOf(n));}
    flush();
  }
};
skyGap();
const severe=()=>thumbCheck(sorted(),P,beatMs).issues.filter(i=>i.kind!=='busy');
const noteFor=iss=>{
  const t=iss.t;
  if(/スライド/.test(iss.what)){
    const hand=(iss.what.match(/\((L|R)\)/)||[])[1];
    const cands=notes.filter(n=>n.k==='s'&&startOf(n)<=t+5&&endOf(n)>=t-5&&(!hand||n.hand===hand));
    if(iss.what==='スライド2本')return cands.sort((a,b)=>(endOf(a)-startOf(a))-(endOf(b)-startOf(b)))[0];
    return cands.sort((a,b)=>Math.abs(xOf(a)-iss.x)-Math.abs(xOf(b)-iss.x))[0];
  }
  return notes.filter(n=>n.k!=='s'&&Math.abs(startOf(n)-t)<5).sort((a,b)=>Math.abs(xOf(a)-iss.x)-Math.abs(xOf(b)-iss.x))[0];
};
const fixAll=()=>{
let guard=0;
for(;;){
  const list=severe();if(!list.length||guard++>2000)break;
  const iss=list[0],n=noteFor(iss);
  if(!n){// 見つからないときは、その時刻のいちばん近いノーツを省く
    const near=notes.slice().sort((a,b)=>Math.abs(startOf(a)-iss.t)-Math.abs(startOf(b)-iss.t))[0];notes=notes.filter(x=>x!==near);log.dropped++;continue;}
  const t=startOf(n),base=score(local(t,null));
  let best=null;
  const variants=[];
  if(n.k==='s'){for(const d of [-0.5,0.5,-1,1,-1.5,1.5,-2,2]){const v=JSON.parse(JSON.stringify(n));v.pts.forEach(p=>p[1]=Math.max(0,Math.min(6-p[2],p[1]+d)));variants.push(v);}}
  else{// 元の位置に近い順に試す(同じ点数なら元に近いほう。左から順に試すと左手へ寄った)
    const subs=[];for(let sub=0;sub+n.w<=12;sub++)if(sub!==n.sub)subs.push(sub);subs.sort((x,y)=>Math.abs(x-n.sub)-Math.abs(y-n.sub));
    for(const sub of subs){const v={...n,sub};variants.push(v);}
    if(n.sky&&!GROUND)variants.push({...n,sky:0});}
  for(const v of variants){const sc=score(local(t,n,v));if(!best||sc<best.sc)best={sc,v};}
  const without=score(local(t,n,null));
  if(best&&best.sc<base&&best.sc<=without){Object.assign(n,best.v);if(n.k==='s')log.shifted++;else log.moved++;}
  else{notes=notes.filter(x=>x!==n);if(n.k==='s')log.droppedSlides++;else log.dropped++;}
}
};
fixAll();
// 足す: Lv. が足りなければ、参考で密度の高い区間の音の立ち上がりへタップを足す(押せない・交差が出ない所だけ)
if(MIN_LEVEL){
  const cap=(()=>{try{return JSON.parse(fs.readFileSync(path.join(path.dirname(IN),'capture.json'),'utf8')).hits||[];}catch{return [];}})();
  const twoBar=beatMs*8,refDensity=t=>cap.filter(h=>Math.abs(h.ms-t)<twoBar/2).length,ourDensity=t=>notes.filter(n=>Math.abs(startOf(n)-t)<twoBar/2).length;
  const busyAt=t=>notes.some(n=>(n.k==='s'||n.k==='h')&&startOf(n)<=t+1&&endOf(n)>=t-1)||notes.filter(n=>Math.abs(startOf(n)-t)<2).length>=1;
  const onsets=audio.onsets.filter(o=>!inStop(o.timeMs,o.timeMs)&&!busyAt(zeroMs+o.grid*gridMs))
    .map(o=>({t:Math.round(zeroMs+o.grid*gridMs),s:Number(o.strength)||0}));
  let level=chartStats(sorted()).level,tries=0;
  while(level<MIN_LEVEL&&tries<4){
    tries++;
    const order=onsets.filter(o=>!busyAt(o.t)).sort((a,b)=>(refDensity(b.t)-ourDensity(b.t))-(refDensity(a.t)-ourDensity(a.t))||b.s-a.s);
    let addedNow=0;
    for(const o of order){
      if(busyAt(o.t))continue;
      const base=score(local(o.t,null));let pick=null;
      // 前後2小節で少ないほうの手の側から試す(足したノーツで左右の偏りを作らない)
      const nearL=notes.filter(n=>Math.abs(startOf(n)-o.t)<beatMs*8&&xOf(n)<3).length,nearR=notes.filter(n=>Math.abs(startOf(n)-o.t)<beatMs*8&&xOf(n)>=3).length;
      for(const sub of nearL<=nearR?[1,4,0,3,7,10,6,9]:[7,10,6,9,1,4,0,3]){const v={k:'t',t:o.t,sub,w:3,sky:0,dir:'',added:1};const sc=score(local(o.t,null,v));if(sc<=base&&(!pick||sc<pick.sc))pick={sc,v};}
      if(pick){notes.push(pick.v);log.added++;addedNow++;}
      if(addedNow%15===0){level=chartStats(sorted()).level;if(level>=MIN_LEVEL)break;}
    }
    level=chartStats(sorted()).level;
    if(!addedNow)break;
  }
}
const gapCount=()=>{let bad=0;if(GROUND)return 0;for(const side of ['L','R']){const list=sorted().filter(n=>(n.k==='s'?n.hand:(xOf(n)<3?'L':'R'))===side);
  for(let i=1;i<list.length;i++){const ta=list[i-1].k==='s'?(list[i-1].pts.some(p=>p[3]>0)?1:0):(list[i-1].sky?1:0),tb=list[i].k==='s'?(list[i].pts.some(p=>p[3]>0)?1:0):(list[i].sky?1:0);
    if(ta!==tb&&startOf(list[i])-endOf(list[i-1])<beatMs*SKY_GAP_BEATS-1)bad++;}}return bad;};
for(let round=0;round<6;round++){skyGap();fixAll();if(!gapCount()&&!severe().length)break;}
const fin=thumbCheck(sorted(),P,beatMs),st=chartStats(notes);
// 同じ親指が段を変える間が1.5拍に足りない所(空中ありのとき)
let gapBad=0;if(!GROUND)for(const side of ['L','R']){const list=sorted().filter(n=>(n.k==='s'?n.hand:(xOf(n)<3?'L':'R'))===side);
  for(let i=1;i<list.length;i++){const ta=list[i-1].k==='s'?(list[i-1].pts.some(p=>p[3]>0)?1:0):(list[i-1].sky?1:0),tb=list[i].k==='s'?(list[i].pts.some(p=>p[3]>0)?1:0):(list[i].sky?1:0);
    if(ta!==tb&&startOf(list[i])-endOf(list[i-1])<beatMs*SKY_GAP_BEATS-1)gapBad++;}}
fs.writeFileSync(OUT,JSON.stringify({track:TRACK,variant:GROUND?'ground':'sky',grid:SRC.grid,range:SRC.range,notes:sorted()},null,0));
console.log(`直した(${GROUND?'地上だけ':'空中あり'}): レーンを動かした ${log.moved}・スライドをずらした ${log.shifted}・省いたノーツ ${log.dropped}・省いたスライド ${log.droppedSlides}・空中を地上へ ${log.skyToGround}・地上を空中へ ${log.groundToSky||0}・演出の区間と曲の前で外した ${log.stopDropped}・足した ${log.added}`);
console.log(`結果: ${st.notes}ノーツ ${JSON.stringify(st.kinds)} Lv.${st.level} 最密4秒${st.max4s} 叩く${st.hits} / 横持ち 押せない${fin.count.impossible}・指が交差${fin.count.cross}・届きにくい${fin.count.reach}・忙しい${fin.count.busy} / 空中のタップ ${notes.filter(n=>n.sky).length}・空中のスライド ${notes.filter(n=>n.k==='s'&&n.pts.some(p=>p[3]>0)).length}`);
if(!GROUND)console.log(`同じ親指が段を変える間が${SKY_GAP_BEATS}拍に足りない所 ${gapBad}か所`);
console.log(`書き出した: ${path.relative(REPO_ROOT,OUT)} (リポジトリには入らない)`);
