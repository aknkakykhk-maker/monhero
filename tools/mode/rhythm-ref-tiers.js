#!/usr/bin/env node
// 参考譜面に寄せる道具 段3: 難易度を作る(2026-10-10・オンプくん。台帳 r2610101530refcap の④)
//
//   node tools/mode/rhythm-ref-tiers.js --track <曲id>                         # ref-work/<曲id>/master.json → tier-<難易度>.json
//   node tools/mode/rhythm-ref-tiers.js --track <曲id> --master <下書き>         # MASTER の下書きを別の所から読む(ref-work/ の下だけ)
//   node tools/mode/rhythm-ref-tiers.js --track <曲id> --stop 85061-85357       # 止まる区間(曲の ms。いくつでも)。中のノーツを抜く
//   node tools/mode/rhythm-ref-tiers.js --track <曲id> --levels 33,22,14,11     # EXPERT,HARD,NORMAL,EASY の上限(既定は MASTER の 0.73/0.49/0.31/0.24 倍)
//   node tools/mode/rhythm-ref-tiers.js --report <下書き> [--stop a-b]           # 1つの下書きの数字だけ見る(書き出さない)
//
// 【何をするか】段2の下書き(rhythm-ref-map.js)を手で詰めた MASTER から、EXPERT〜EASY を「MASTER の部分集合」で作る。
//   sheriruth 地上(2026-10-10)で通した作り方を、そのまま道具にしたもの。
//   ・止まる区間: 中の打鍵を抜く。止まり終わりは次のノーツより 0.17秒以上前か(STOP_END_GAP_MS)を数えて出す
//   ・EXPERT: 16分の裏・同じ時刻の2つ目・音の弱い所から抜く。叩く回数と速い連打(90ms以内)は MASTER の97%以下
//     (rhythm-expert-master-order-check の「3%超かつ3以上多いと NG」に掛からないように)。スライドはそのまま
//   ・HARD: スライドを1本ずつに(2本同時の所は左を抜く)、点を1拍ごとに置き直す。速い連打は EXPERT の6割・30以下
//   ・NORMAL: スライドを拍の頭のタップに置き換える。速い連打5以下
//   ・EASY: スライドを2拍ごとのタップにし、8分(拍の半分)より詰まった所を抜き、左右半分の太いノーツ(幅6)にする
//   ・どれも、レベルは rhythm-chart-level.js の式で測り、上限まで間引く
//   ・押せるかは2つの物差しで数える: 既存の両手のシミュレート(rhythm-hand-simulate.js)と、
//     画面の画素で測る親指2本のモデル(下の THUMB_PROFILES。横持ちは親指が左右の端から伸びる)
//
// 【決めごと】MASTER は参考譜面に寄せた下書きなので、読むのも書くのも tools/mode/ref-work/<曲id>/ だけ(リポジトリに置かない)。
'use strict';
const fs=require('fs'),path=require('path');
const {workDirFor,assertWorkPath,REPO_ROOT}=require('./rhythm-ref-capture.js');
const {chartLevel}=require('./rhythm-chart-level.js');
const {HAND_MODEL:H}=require('./rhythm-hand-model.js');
const {simulateNotes}=require('./rhythm-hand-simulate.js');

const STOP_END_GAP_MS=170;          // 止まり終わり → 次のノーツ(テンポ部長の取り決め)
const FAST_MS=90;                   // 速い連打(rhythm-expert-master-order-check と同じ線)
const DIFFS=['EASY','NORMAL','HARD','EXPERT','MASTER'];
const LEVEL_RATIO={EXPERT:0.73,HARD:0.49,NORMAL:0.31,EASY:0.24};

// ── 下書き ⇄ ゲームのノーツ ──
const startOf=n=>n.k==='s'?n.pts[0][0]:n.t;
const endOf=n=>n.k==='s'?n.pts[n.pts.length-1][0]:n.k==='h'?n.end:n.t;
const slideX=(s,t)=>{const p=s.pts;if(t<=p[0][0])return p[0][1]+0.5;
  for(let i=1;i<p.length;i++)if(t<=p[i][0]){const r=(t-p[i-1][0])/Math.max(1,p[i][0]-p[i-1][0]);return p[i-1][1]+(p[i][1]-p[i-1][1])*r+0.5;}
  return p[p.length-1][1]+0.5;};
const toRuntime=notes=>notes.map(n=>{
  if(n.k==='s'){const p=n.pts;return {type:'SLIDE',timeMs:p[0][0],endTimeMs:p[p.length-1][0],lane:p[0][1],endLane:p[p.length-1][1],subLaneWidth:p[0][2],
    slidePoints:p.map(([t,l,w])=>({timeMs:t,lane:l,subLaneWidth:w})),...(n.endFlick?{endFlick:true}:{})};}
  if(n.k==='h')return {type:'HOLD',timeMs:n.t,endTimeMs:n.end,lane:Math.floor(n.sub/2),subLane:n.sub,subLaneWidth:n.w};
  return {type:n.k==='f'?'FLICK':'TAP',timeMs:n.t,lane:Math.floor(n.sub/2),subLane:n.sub,subLaneWidth:n.w};
}).sort((a,b)=>a.timeMs-b.timeMs);

// レベル・最密4秒・最短間隔・叩く回数・速い連打
const chartStats=notes=>{
  const rt=toRuntime(notes),{level}=chartLevel({notes:rt});
  const ts=rt.map(n=>n.timeMs).sort((a,b)=>a-b);let max4s=0;for(let i=0,j=0;i<ts.length;i++){while(ts[i]-ts[j]>4000)j++;max4s=Math.max(max4s,i-j+1);}
  let minGapMs=Infinity;for(let i=1;i<ts.length;i++)if(ts[i]>ts[i-1])minGapMs=Math.min(minGapMs,ts[i]-ts[i-1]);
  const hitsAt=[...new Set(notes.map(startOf))].sort((a,b)=>a-b);let fast=0;for(let i=1;i<hitsAt.length;i++)if(hitsAt[i]-hitsAt[i-1]<=FAST_MS)fast++;
  const kinds=notes.reduce((a,n)=>(a[n.k]=(a[n.k]||0)+1,a),{});
  return {notes:notes.length,kinds,level,max4s,minGapMs:Math.round(minGapMs),hits:hitsAt.length,fast};
};

// ── 親指2本のモデル(画面の画素で測る) ──
// 速さ・叩き直しは HAND_MODEL の値を、縦画面の判定ラインのレーン幅で画素毎秒に直して使う
const PORTRAIT_LANE_PX=390*0.81/6;
const V_LIMIT=H.laneSpeedLimit*PORTRAIT_LANE_PX,V_COMFORT=H.laneSpeedComfort*PORTRAIT_LANE_PX;
const THUMB_PROFILES={
  // 横: 844×390・道の幅「ふつう」(判定ラインで画面幅の約75%)・空中は画面の高さの25%上(RHYTHM_SKY_LIFT 横 .25)
  landscape:{name:'横持ち',laneW:844*0.75/6,skyDy:390*0.25,sideReach:true},
  // 縦: 390×844・空中は地上の16%上
  portrait:{name:'縦持ち',laneW:PORTRAIT_LANE_PX,skyDy:836*0.16,sideReach:false},
};
const THUMB_KINDS=[['impossible','押せない'],['busy','忙しい'],['cross','指が交差'],['reach','届きにくい']];
const thumbCheck=(notes,prof=THUMB_PROFILES.landscape,beatMs=500)=>{
  const xOf=n=>(n.sub+n.w/2)/2,W={impossible:100,cross:60,reach:40,busy:10};
  const list=notes.slice().sort((a,b)=>startOf(a)-startOf(b)||(a.k==='s'?-1:1));
  const hand={L:{x:1.5,y:0,last:-1e9,busyUntil:-1e9,slide:null},R:{x:4.5,y:0,last:-1e9,busyUntil:-1e9,slide:null}};
  const issues=[];
  const posAt=(h,t)=>{const s=hand[h].slide;return s&&t<=endOf(s)+H.releaseMarginMs?slideX(s,t):hand[h].x;};
  const free=(h,t)=>t>=hand[h].busyUntil+H.releaseMarginMs;
  const judge=(h,t,x,y,other)=>{
    const st=hand[h],out=[];
    if(!free(h,t))return [{kind:'impossible',why:'その手はスライド/ホールド中'}];
    if(st.last>-1e8){
      const dt=t-st.last,dist=Math.hypot((x-st.x)*prof.laneW,(y-st.y)*prof.skyDy),v=dist/dt*1000;
      if(dt<H.restrikeLimitMs)out.push({kind:'impossible',why:`同じ指で${Math.round(dt)}msの叩き直し`});
      else if(v>V_LIMIT)out.push({kind:'impossible',why:`${Math.round(dist)}pxを${Math.round(dt)}ms`});
      else if(dt<H.restrikeComfortMs||v>V_COMFORT)out.push({kind:'busy',why:`${Math.round(dist)}pxを${Math.round(dt)}ms`});
    }
    // 横持ちは親指が左右の端から伸びる: 真ん中(3)を1レーン越えると届きにくい、2レーン越えると押せない(仮の線引き)
    if(prof.sideReach){const over=h==='L'?x-3:3-x;
      if(over>2)out.push({kind:'impossible',why:`真ん中を${over.toFixed(1)}レーン越える`});
      else if(over>1)out.push({kind:'reach',why:`真ん中を${over.toFixed(1)}レーン越える`});}
    // 相手の親指が押さえている最中か、直前(250ms以内)に押したときだけ、その位置にいると見る(空いている指はどけられる)
    const oh=h==='L'?'R':'L',pinned=other!=null||!free(oh,t)||t-hand[oh].last<250,ox=other!=null?other:posAt(oh,t);
    if(pinned&&(h==='L'?x>ox:x<ox))out.push({kind:'cross',why:'左右の親指が入れ替わる'});
    else if(Math.abs(x-ox)<H.fingerMinGapLanes-1e-6&&(other!=null||!free(oh,t)))out.push({kind:'impossible',why:`2本の指の間が${Math.abs(x-ox).toFixed(2)}レーン`});
    return out;
  };
  const apply=(n,h,t,x,y)=>{const st=hand[h];
    st.x=n.k==='s'?slideX(n,endOf(n)):x;st.y=n.k==='s'?0:y;st.last=n.k==='s'?endOf(n):t;
    if(n.k==='s'){st.slide=n;st.busyUntil=endOf(n);}else if(n.k==='h')st.busyUntil=n.end;};
  const groups=[];for(const n of list){const g=groups[groups.length-1];if(g&&Math.abs(startOf(g[0])-startOf(n))<5)g.push(n);else groups.push([n]);}
  for(const g of groups){
    const t=startOf(g[0]);
    for(const s of g.filter(n=>n.k==='s')){const x0=s.pts[0][1]+0.5;
      for(const i of judge(s.hand,t,x0,0,null))issues.push({t,x:x0,what:`スライド(${s.hand})の始まり`,...i});apply(s,s.hand,t,null,0);}
    let taps=g.filter(n=>n.k!=='s').sort((a,b)=>xOf(a)-xOf(b));
    const fr=['L','R'].filter(h=>free(h,t));
    if(taps.length>fr.length){issues.push({t,x:xOf(taps[0]),what:`${taps.length}つ同時`,kind:'impossible',why:'空いている手より多い'});taps=taps.slice(0,fr.length);}
    const plans=taps.length===2?[['L','R']]:taps.length===1?fr.map(h=>[h]):[];let best=null;
    for(const plan of plans){
      const res=taps.map((n,i)=>judge(plan[i],t,xOf(n),n.sky?1:0,taps.length===2?xOf(taps[1-i]):null));
      const sc=res.reduce((a,r)=>a+r.reduce((b,i)=>b+W[i.kind],0),0)+taps.reduce((a,n,i)=>a+Math.abs(xOf(n)-hand[plan[i]].x)*0.01+((xOf(n)<3)!==(plan[i]==='L')?0.5:0),0);
      if(!best||sc<best.sc)best={sc,plan,res};}
    if(best)taps.forEach((n,i)=>{for(const iss of best.res[i])issues.push({t,x:xOf(n),what:n.k==='h'?'ホールド':'タップ',...iss});apply(n,best.plan[i],t,xOf(n),n.sky?1:0);});
  }
  const slides=list.filter(n=>n.k==='s');
  for(const l of slides.filter(s=>s.hand==='L'))for(const r of slides.filter(s=>s.hand==='R')){
    // 近すぎる所と入れ替わる所は別に数える(近づいてから入れ替わると、両方出る)
    const a=Math.max(startOf(l),startOf(r)),b=Math.min(endOf(l),endOf(r));let state='';
    for(let t=a;t<=b;t+=beatMs/8){const d=slideX(r,t)-slideX(l,t),now=d<0?'cross':d<H.fingerMinGapLanes-1e-6?'impossible':'';
      if(now&&now!==state&&!(now==='impossible'&&state==='cross'))issues.push({t,x:slideX(l,t),what:'スライド2本',kind:now,why:now==='cross'?'左右の線が入れ替わる':`2本の間が${d.toFixed(2)}レーン`});
      state=now;}
  }
  if(prof.sideReach)for(const s of slides)for(let t=startOf(s),on=false;t<=endOf(s);t+=beatMs/8){const x=slideX(s,t),over=s.hand==='L'?x-3:3-x;
    if(over>1){if(!on)issues.push({t,x,what:`スライド(${s.hand})`,kind:over>2?'impossible':'reach',why:`真ん中を${over.toFixed(1)}レーン越える`});on=true;}else on=false;}
  issues.sort((a,b)=>a.t-b.t);
  const count=Object.fromEntries(THUMB_KINDS.map(([k])=>[k,issues.filter(i=>i.kind===k).length]));
  return {issues,count};
};

// ── 止まる区間 ──
// stops: [[始め,終わり],…](曲の ms)。中の打鍵(タップ・ホールドの頭)を抜く。スライドは手で直す(数えて出すだけ)
const clearStops=(notes,stops)=>notes.filter(n=>n.k==='s'||!stops.some(([a,b])=>n.t>=a&&n.t<=b));
const stopReport=(notes,stops)=>stops.map(([a,b])=>{
  const inside=notes.filter(n=>startOf(n)<=b&&endOf(n)>=a).length;
  const next=notes.map(startOf).filter(t=>t>b).sort((x,y)=>x-y)[0];
  const gap=next==null?Infinity:next-b;
  return {from:a,to:b,inside,nextGapMs:gap,ok:inside===0&&gap>=STOP_END_GAP_MS};
});

// スライドの同じ時刻(5ms未満)の点をまとめる(ゲームで長さ0の区間を作らない)
const dedupeSlidePoints=notes=>notes.map(n=>{if(n.k!=='s')return n;const q=[n.pts[0]];
  for(let i=1;i<n.pts.length;i++){const p=n.pts[i];if(p[0]-q[q.length-1][0]<5)q[q.length-1]=[q[q.length-1][0],...p.slice(1)];else q.push(p);}
  return {...n,pts:q};});

// ── 難易度を作る ──
const deriveTiers=(master,{grid,audio,stops=[],levels}={})=>{
  const Z=grid.zero,B=grid.beat,Q=B/(grid.div||4);
  const M=dedupeSlidePoints(clearStops(master,stops));
  const onsets=(audio&&audio.onsets||[]).map(o=>[o.timeMs,o.strength||0]);
  const strengthAt=t=>{let s=0;for(const [ms,v] of onsets)if(Math.abs(ms-t)<=45)s=Math.max(s,v);return s;};
  const slotOf=t=>Math.round((t-Z)/Q),msOf=s=>Math.round(Z+s*Q);
  const beatPos=t=>{const s=((slotOf(t)%4)+4)%4;return s===0?0:s===2?1:2;};   // 0=拍の頭 1=8分の裏 2=16分
  const groundSub=x=>3*Math.max(0,Math.min(3,Math.floor(x/1.5)));
  // 打鍵の抜きやすさ(大きいほど先に抜く): 16分の裏・同じ時刻の2つ目・詰まった所・音の弱い所。ホールドは少し残しやすく
  const removeScore=(n,list)=>{
    if(n.k==='s')return -1e9;
    const taps=list.filter(m=>m.k!=='s');
    const same=taps.some(m=>m!==n&&m.t===n.t);
    const prev=taps.filter(m=>m.t<n.t).reduce((a,m)=>Math.max(a,m.t),-1e9),next=taps.filter(m=>m.t>n.t).reduce((a,m)=>Math.min(a,m.t),1e9);
    const gap=Math.min(n.t-prev,next-n.t);
    return beatPos(n.t)*3+(same?2.5:0)+(gap<=FAST_MS?2:gap<=170?1:0)-strengthAt(n.t)*2+(n.k==='h'?-0.5:0);
  };
  const thin=(notes,target,{minGap=0,maxFast=Infinity,maxHits=Infinity}={})=>{
    const list=notes.slice();
    if(minGap>0)for(let changed=true;changed;){changed=false;const taps=list.filter(n=>n.k!=='s').sort((a,b)=>a.t-b.t);
      for(let i=1;i<taps.length;i++){const a=taps[i-1],b=taps[i];if(b.t!==a.t&&b.t-a.t<minGap){list.splice(list.indexOf(removeScore(a,list)>=removeScore(b,list)?a:b),1);changed=true;break;}}}
    const ok=()=>{const s=chartStats(list);return s.level<=target&&s.fast<=maxFast&&s.hits<=maxHits;};
    for(let guard=0;!ok()&&guard<5000;guard++){
      let best=null,bs=-Infinity;for(const n of list)if(n.k!=='s'){const s=removeScore(n,list);if(s>bs){bs=s;best=n;}}
      if(!best)break;list.splice(list.indexOf(best),1);
    }
    return list.sort((a,b)=>startOf(a)-startOf(b));
  };
  const simplifySlides=notes=>{
    const S=notes.filter(n=>n.k==='s'),out=notes.filter(n=>n.k!=='s');
    for(const s of S){
      const t0=s.pts[0][0],t1=s.pts[s.pts.length-1][0];if(t1-t0<B)continue;
      if(s.hand==='L'&&S.some(o=>o!==s&&startOf(o)<t1&&endOf(o)>t0))continue;   // 2本同時は右だけ残す
      const lane=t=>Math.max(0,Math.min(5,Math.round((slideX(s,t)-0.5)*2)/2)),pts=[];
      for(let t=t0;t<t1-4;t+=B)pts.push([Math.round(t),lane(t),2,0,0]);
      pts.push([t1,lane(t1),2,0,0]);
      out.push({...s,pts});
    }
    return dedupeSlidePoints(out);
  };
  const slidesToTaps=(notes,everyBeats)=>{
    const rest=notes.filter(n=>n.k!=='s'),seen=new Set(rest.map(n=>n.t+'|'+n.sub)),add=[];
    for(const s of notes.filter(n=>n.k==='s')){const t0=startOf(s),t1=endOf(s),step=B*everyBeats;
      for(let k=Math.ceil((t0-Z)/step-1e-6);Z+k*step<=t1+1;k++){const t=msOf(slotOf(Z+k*step)),n={k:'t',t,sub:groundSub(slideX(s,t)),w:3,sky:0,dir:''};
        const key=n.t+'|'+n.sub;if(seen.has(key)||stops.some(([a,b])=>t>=a&&t<=b))continue;seen.add(key);add.push(n);}}
    return [...rest,...add];
  };
  // 横持ちの親指で押せない・交差・届きにくい所を、打鍵を抜いて無くす(スライドは抜かない。始まりのじゃまは直前の打鍵を抜く)
  const playable=notes=>{
    let list=notes.slice();
    for(let guard=0;guard<200;guard++){
      const bad=thumbCheck(list,THUMB_PROFILES.landscape,B).issues.find(i=>i.kind!=='busy');if(!bad)break;
      const taps=list.filter(n=>n.k!=='s');
      const at=taps.filter(n=>Math.abs(n.t-bad.t)<5).sort((a,b)=>Math.abs((a.sub+a.w/2)/2-bad.x)-Math.abs((b.sub+b.w/2)/2-bad.x))[0];
      const rm=at||taps.filter(n=>n.t<bad.t).sort((a,b)=>b.t-a.t)[0];
      if(!rm)break;list=list.filter(n=>n!==rm);
    }
    return list;
  };
  // 長い空き(4小節より長い)に上の難易度の打鍵があれば、step ごとに戻す(EASY で曲の終わりが空かないように)
  const fillLongGaps=(notes,from,step,target)=>{
    let list=notes.slice();const taps=()=>list.filter(n=>n.k!=='s').map(n=>n.t).sort((a,b)=>a-b);
    const end=Math.max(...from.map(endOf));
    const ts=taps(),edges=[...ts,end+step];
    for(let i=0;i<edges.length-1;i++){const a=edges[i],b=edges[i+1];if(b-a<=B*16)continue;
      let last=a;
      for(const n of from.filter(m=>m.k==='t'&&m.t>a&&m.t<b).sort((x,y)=>x.t-y.t)){
        if(n.t-last<step-2||(b<=end&&b-n.t<step-2))continue;
        const trial=[...list,n];if(chartStats(trial).level>target)break;list=trial;last=n.t;}
    }
    return list.sort((a,b)=>startOf(a)-startOf(b));
  };
  const mStat=chartStats(M);
  const lv=levels||Object.fromEntries(Object.entries(LEVEL_RATIO).map(([d,r])=>[d,Math.max(1,Math.round(mStat.level*r))]));
  const out={MASTER:M};
  out.EXPERT=playable(thin(M,lv.EXPERT,{maxHits:Math.floor(mStat.hits*0.97),maxFast:Math.floor(mStat.fast*0.97)}));
  out.HARD=playable(thin(simplifySlides(out.EXPERT),lv.HARD,{maxFast:Math.min(30,Math.floor(chartStats(out.EXPERT).fast*0.6))}));
  out.NORMAL=playable(thin(slidesToTaps(out.HARD,1),lv.NORMAL,{maxFast:5}));
  const nStat=chartStats(out.NORMAL);
  let easy=thin(slidesToTaps(out.NORMAL,2),lv.EASY,{minGap:Math.round(B/2),maxHits:Math.floor(nStat.hits*0.85)});
  easy=fillLongGaps(easy,out.NORMAL,B*2,lv.EASY);
  const seen=new Set();
  out.EASY=easy.map(n=>n.k==='s'?n:{...n,sub:n.sub<=3?0:6,w:6}).filter(n=>{if(n.k==='s')return true;const k=n.t+'|'+n.sub;if(seen.has(k))return false;seen.add(k);return true;});
  return {tiers:out,levels:lv};
};

// 1つの難易度の数字(押せるかを2つの物差しで)
const tierReport=(notes,{grid,stops=[]})=>{
  const s=chartStats(notes);
  // 既存の両手のシミュレートは格子で読む(段2の toSim と同じ写し方)
  const Q=grid.beat/(grid.div||4),slot=t=>Math.round((t-grid.zero)/Q);
  const toSim=n=>n.k==='s'?{type:'SLIDE',grid:slot(n.pts[0][0]),durationGrids:slot(endOf(n))-slot(n.pts[0][0]),lane:n.pts[0][1],subLaneWidth:n.pts[0][2],endFlick:n.endFlick,slidePoints:n.pts.map(([t,l,w])=>({timeMs:t,lane:l,subLaneWidth:w}))}
    :n.k==='h'?{type:'HOLD',grid:slot(n.t),durationGrids:slot(n.end)-slot(n.t),subLane:n.sub,subLaneWidth:n.w}
    :{type:n.k==='f'?'FLICK':'TAP',grid:slot(n.t),subLane:n.sub,subLaneWidth:n.w};
  const sim=simulateNotes(notes.map(toSim),{beatZeroMs:grid.zero,gridMs:Q,subdivisionsPerBeat:grid.div||4,beatsPerBar:4});
  const th=thumbCheck(notes,THUMB_PROFILES.landscape,grid.beat);
  return {...s,simImpossible:sim.impossible|0,thumbs:th.count,stops:stopReport(notes,stops)};
};
const fmtReport=(d,r)=>`${d.padEnd(6)} ${r.notes}ノーツ ${JSON.stringify(r.kinds)} Lv.${r.level} 最密4秒${r.max4s} 最短${r.minGapMs}ms 叩く${r.hits} 速い連打${r.fast}`
  +` | 両手のシミュレート 押せない${r.simImpossible} | 横持ち `+THUMB_KINDS.map(([k,l])=>`${l}${r.thumbs[k]}`).join('・')
  +(r.stops.length?` | 止まる区間 `+r.stops.map(s=>`${s.from}〜${s.to}: 中${s.inside}・次まで${s.nextGapMs}ms${s.ok?'':'(NG)'}`).join(' / '):'');

if(require.main===module){
  const args=process.argv.slice(2),get=k=>{const i=args.indexOf(`--${k}`);return i>=0?args[i+1]:undefined;};
  const stops=[];args.forEach((a,i)=>{if(a==='--stop'){const m=/^(\d+)-(\d+)$/.exec(args[i+1]||'');if(!m)throw new Error('--stop は 始め-終わり(ms)');stops.push([+m[1],+m[2]]);}});
  try{
    if(get('report')){
      const file=assertWorkPath(path.resolve(get('report'))),d=JSON.parse(fs.readFileSync(file,'utf8'));
      console.log(fmtReport(d.difficulty||'下書き',tierReport(d.notes,{grid:d.grid,stops})));
    }else{
      const track=get('track'),dir=workDirFor(track);
      const mFile=get('master')?assertWorkPath(path.resolve(get('master'))):path.join(dir,'master.json');
      const m=JSON.parse(fs.readFileSync(mFile,'utf8'));
      const audioPath=get('audio-json')||path.join(__dirname,'authoring',`${track}-v3-audio.json`);
      const audio=fs.existsSync(audioPath)?JSON.parse(fs.readFileSync(audioPath,'utf8')):null;
      let levels;if(get('levels')){const v=get('levels').split(',').map(Number);levels={EXPERT:v[0],HARD:v[1],NORMAL:v[2],EASY:v[3]};}
      const {tiers,levels:lv}=deriveTiers(m.notes,{grid:m.grid,audio,stops,levels});
      console.log(`上限: EXPERT ${lv.EXPERT}・HARD ${lv.HARD}・NORMAL ${lv.NORMAL}・EASY ${lv.EASY}${audio?'':'(解析ファイルが無いので音の強さは見ていない)'}`);
      for(const d of DIFFS){
        const file=path.join(dir,`tier-${d}.json`);
        fs.writeFileSync(assertWorkPath(file),JSON.stringify({track,grid:m.grid,range:m.range,difficulty:d,stops,notes:tiers[d]}));
        console.log(fmtReport(d,tierReport(tiers[d],{grid:m.grid,stops})));
      }
      console.log('書き出した:',path.relative(REPO_ROOT,dir),'の tier-*.json(リポジトリには入らない)');
    }
  }catch(e){console.error('止まった:',e.message);process.exit(1);}
}

module.exports={deriveTiers,chartStats,thumbCheck,THUMB_PROFILES,clearStops,stopReport,dedupeSlidePoints,toRuntime,tierReport,STOP_END_GAP_MS};
