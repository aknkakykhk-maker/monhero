#!/usr/bin/env node
// HELL(空中のノーツがある譜面)の Lv. を「左右の親指に割り振ってから、手ごとに」測る物差し(v4・2026-11-11・ジゴク)。
// 社長「譜面の作成とその難しさをはかるのがヘルだとかなり難しいからそこをしっかり精度上げてつくってほしい」。
//
//   node tools/mode/rhythm-hell-level.js                      # 公開中の HELL 全譜面: 表示・今の式(v3)・新しい式(v4)・差・いちばん効いた要素
//   node tools/mode/rhythm-hell-level.js --song <曲id>        # 1譜面の内訳(どの要素が Lv. をいくつ動かしたか・いちばん重い区間)
//   node tools/mode/rhythm-hell-level.js --top 10             # 差の大きい順に上位だけ
//   node tools/mode/rhythm-hell-level.js --json <ファイル>    # 表を JSON で書き出す(止め絵・表の画像を作る道具が読む)
//
// 【なぜ要るか】今の式(rhythm-chart-level.js の v3)は「1つ前のノーツ」を手に関係なく見る。HELL で難しいのは
//   ・片手が長押しを押さえている間、残りの親指1本で空中と地上を叩く(10/27 に社長が表示を上げた7譜面はここが多い。v3 は 4〜13 低く出る)
//   ・同じ親指が地上⇔空中を持ち替える速さ(手の決まりの 150ms・250ms)
//   ・地上と空中の入り乱れ・見分けにくさ(2026-10-20・21 社長)
//   で、どれも「どちらの手が何をしているか」を決めないと数えられない。
// 【分かったこと】表示と v3 の差(10/27 の7譜面)は、ノーツの量と結びつかない(相関 -0.4)。結びつくのは「ノーツのうち何割が、手の段取りの要るノーツか」
//   (同じ親指の地上⇔空中 0.65・押さえている手の側まで伸ばす 0.60・押さえている帯と高さが違う 0.58・入り乱れ 0.56・片手で叩く 0.50)。
//   v3 は毎秒の仕事量なので、ノーツが少なめで1つ1つが難しい譜面を低く出す。
// 【測り方】Lv. = (S^P + C^P)^(1/P)
//   S … 速さ・密度の難しさ = v3 の値(丸める前)。いちばん忙しい4秒と平均(今までと同じ)
//   C … 段取りの難しさ = Σ 重み×(その要素の量 ÷ ノーツ数) − COORD_OFFSET(0より下にはしない)。速さに関係なく、1ノーツあたりで数える
//   P=3。S が大きい譜面では C はほとんど足されず、S と C が近い譜面で効く。C が0なら v3 と同じ値。v3 より下がることは無い
//   手は、ノーツを時刻順に左右の親指へ割り振って決める(押さえている手は使えない・速い続きは楽な方の手)。
// 【合わせ先】社長の値がある譜面(LEVEL_OVERRIDES の HELL で、v3 と違うもの)。--calibrate で重みを出し直せる(1つ抜きの外れも出す)
// 【決めごと】これは参考値。公開中の譜面・表示の Lv.(LEVEL_OVERRIDES)・既定の測り方(levelFormulaFor)は変えない。
//   既定にするかは社長が決める(変える案は表にして窓口へ)。空中の無い譜面には使わない(hellLevel は null を返す)。
'use strict';
const path=require('path');
const L=require('./rhythm-chart-level.js');
const HR=require('./rhythm-chart-hand-rules.js');
const {HAND_MODEL}=require('./rhythm-hand-model.js');

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const SKY_LANES=.86;            // 空中の高さ1が横に何レーンぶんか(rhythm-chart-level.js と同じ)
const SAME_TIME_MS=8;           // これ以内は同時押し(rhythm-chart-level.js の束ね方と同じ)
const CENTER=3;                 // レーン座標の真ん中(0〜6)
// 同じ親指の間隔: これより長ければ楽・これより短ければ叩き直しの限界(HAND_MODEL.restrikeLimitMs の少し下まで見る)
const TEMPO_EASY_MS=260,TEMPO_HARD_MS=90;
// 同じ親指の地上⇔空中: 手の決まりの 150ms(上げきれない)・250ms(目安)と、読んで動く余裕の 450ms
const SWITCH_RULE_MS=HR.SIDE_GAP_MS,SWITCH_RAISE_MS=HR.SKY_RAISE_MS,SWITCH_EASY_MS=450;
const MIX_WINDOW_MS=1000;       // 入り乱れを見る前後の幅

// --- 要素(名前・社長の言い方でのまとまり・説明) ---
const FEATURES=Object.freeze([
  ['stream','密度','全体の詰まり(手に関係なく1つ前との間隔が150msより短い)'],
  ['handTempo','連打','同じ親指で続けて叩く速さ(260msより短いと少しずつ重い)'],
  ['handJack','連打','同じ親指の叩き直しが快適な150msより短い'],
  ['handMove','手の動き','同じ親指の横と上下の動き(距離÷時間)'],
  ['switchFast','持ち替え','同じ親指の地上⇔空中が速い(250msより短い・150ms未満はさらに重い)'],
  ['switchAny','持ち替え','同じ親指の地上⇔空中(指を離した位置から離れた所へ)'],
  ['switchNatural','持ち替え','同じ親指の地上⇔空中(指を離した位置へ・自然な形)'],
  ['mix','入り乱れ','前後1秒に地上と空中が混ざっている割合'],
  ['confuse','入り乱れ','見分けにくい所(重なって見える高さ違い)'],
  ['chordSplit','入り乱れ','同時押しの片方が空中・片方が地上'],
  ['oneHand','押さえながら','片手が押さえている間に、残りの親指で叩く'],
  ['oneHandFar','押さえながら','押さえている手の側まで、反対の親指を伸ばす(レーン数)'],
  ['heldSplit','押さえながら','押さえている帯と高さが違うノーツ'],
  ['heldMoving','押さえながら','押さえている帯が動いている最中(なぞりながら叩く)'],
  ['blocked','押さえながら','両手ともふさがっている所へ来るノーツ'],
  ['chord','同時押し','同時押しの近さ(v1 と同じ)'],
  ['skyCross','交差','上下に分かれた交差(帯の途中で両手が入れ替わる)'],
  ['armCross','交差','押さえている帯の向こう側を叩く(腕が交わる)'],
  ['misc','そのほか','細いノーツ・フリック・終点フリック・スライドの折り返しと速さ(v1 と同じ重み)'],
]);
const FEATURE_KEYS=FEATURES.map(f=>f[0]);
const GROUPS=[...new Set(FEATURES.map(f=>f[1]))];
const GROUP_OF=Object.fromEntries(FEATURES.map(f=>[f[0],f[1]]));

// --- 段取りの難しさ C の重み(1ノーツあたりの量に掛ける。合わせ方は docs/rules/CHART_ENGINE.md「HELL の Lv. を手ごとに測る(v4)」) ---
//   2026-11-11 に公開中の HELL 56譜面で合わせた(--calibrate)。合わせ先の7譜面の外れ 4〜13 → 2 以内、1つ抜きでも ±3.5 以内。ほかの譜面は +3 まで
const COORD_WEIGHTS=Object.freeze({switchAny:63,oneHand:82,oneHandFar:21,heldSplit:58,mix:44});
const COORD_OFFSET=4.4,COMBINE_P=3;
const COORD_KEYS=Object.keys(COORD_WEIGHTS);
// 内訳のまとまり(社長の言い方)。s は v3 の重みの名前(その重みを0にして測り直す)・c は C の要素
const BREAKDOWN=Object.freeze([
  ['持ち替え',{s:['skySwitch','skySwitchFast','skyNatural'],c:['switchAny']},'同じ親指の地上⇔空中の切り替え'],
  ['押さえながら',{s:['whileHeld','sameSideHeld','skySplit','cross'],c:['oneHand','oneHandFar','heldSplit']},'片手が長押しを押さえている間に、残りの親指で叩く'],
  ['入り乱れ',{s:['skyConfuse'],c:['mix']},'地上と空中が混ざる・見分けにくい'],
  ['交差',{s:['skyCross'],c:[]},'上下に分かれた交差'],
  ['連打',{s:['sameHandFast'],c:[]},'同じ側の速い連打'],
]);

// --- ノーツの形 ---
const startMsOf=n=>num(n.timeMs);
const isLong=n=>n.type==='HOLD'||n.type==='SLIDE';
const endMsOf=n=>isLong(n)?Math.max(startMsOf(n),num(n.endTimeMs,startMsOf(n))):startMsOf(n);
const dist=(dx,dz)=>Math.hypot(dx,dz*SKY_LANES);
// v1 と同じ重みで数える小さい要素(細さ・フリック・終点フリック・スライドの経路)
const miscOf=n=>{
  const W=L.WORK;let w=0;
  const width=num(n.subLaneWidth,2)||2;
  if(width<=1)w+=W.thinWidth1;else if(width<=2)w+=W.thinWidth2;
  if(n.type==='FLICK')w+=W.flick;
  if(n.endFlick===true)w+=W.endFlick;
  if(n.type==='SLIDE'&&Array.isArray(n.slidePoints)&&n.slidePoints.length>=2){
    const p=n.slidePoints;let turns=0,last=0,fastest=0;
    for(let i=1;i<p.length;i++){
      const d=num(p[i].lane)-num(p[i-1].lane),dir=d>.01?1:d<-.01?-1:0;
      if(dir&&last&&dir!==last)turns++;if(dir)last=dir;
      const ms=num(p[i].timeMs)-num(p[i-1].timeMs),dz=clamp(num(p[i].sky),0,1)-clamp(num(p[i-1].sky),0,1);
      if(ms>0)fastest=Math.max(fastest,dist(d,dz)/(ms/1000));
    }
    w+=Math.min(W.slideTurnMax,turns*W.slideTurn)+Math.min(W.slideTrackMax,W.slideTrack*fastest/HAND_MODEL.laneSpeedComfort);
  }
  return w;
};
const tempoStrain=gap=>gap>=TEMPO_EASY_MS?0:Math.pow(clamp((TEMPO_EASY_MS-gap)/(TEMPO_EASY_MS-TEMPO_HARD_MS),0,1.3),1.5);

// --- 左右の親指へ割り振る ---
// 手の状態: 押さえている長押し(held)・最後に触った時刻/位置/高さ。押さえている手は、その帯のいる位置にいる
const newHand=()=>({held:null,lastT:-Infinity,lastX:null,lastZ:0});
const handBusy=(h,t)=>!!h.held&&t<endMsOf(h.held)-1;
const handPos=(h,t)=>handBusy(h,t)?{x:HR.centerAt(h.held,t),z:HR.levelAt(h.held,t)}:{x:h.lastX,z:h.lastZ};
const settle=(h,t)=>{if(h.held&&t>=endMsOf(h.held)-1){const e=endMsOf(h.held);h.lastT=e;h.lastX=HR.centerAt(h.held,e);h.lastZ=HR.levelAt(h.held,e);h.held=null;}};
// その手で取るときの「楽でなさ」(割り振りにだけ使う。Lv. の重みとは別)
const pickCost=(h,side,t,x,z)=>{
  const wrong=side==='L'?Math.max(0,x-CENTER):Math.max(0,CENTER-x);
  let cost=wrong>0?.3+.5*wrong:0;
  if(Number.isFinite(h.lastT)&&h.lastX!=null){
    const gap=Math.max(1,t-h.lastT);
    cost+=tempoStrain(gap)+.5*clamp(dist(x-h.lastX,z-h.lastZ)/(gap/1000)/HAND_MODEL.laneSpeedComfort,0,1.5);
  }
  return cost;
};

// --- 1譜面の要素を取り出す(重みを掛ける前) ---
const extract=chart=>{
  const notes=(chart&&Array.isArray(chart.notes)?chart.notes:[]).slice().sort((a,b)=>startMsOf(a)-startMsOf(b));
  if(notes.length<L.LEVEL_MIN_NOTES||!L.chartHasSky(chart))return null;
  const confuse=new Map();for(const c of HR.skyConfusable(notes))confuse.set(c.note,c.score);
  const natural=new Set();for(const m of HR.skyMixedSwitch(notes))if(m.kind==='near')natural.add(m.note);
  const starts=notes.map(n=>({t:startMsOf(n),z:HR.levelAt(n,startMsOf(n))>=.5?1:0}));
  const hands={L:newHand(),R:newHand()},other={L:'R',R:'L'};
  const rows=[];     // {timeMs, hand, f:{要素:値}}
  let prevGroupT=-Infinity,lo=0,hi=0;
  for(let i=0;i<notes.length;){
    let j=i+1;while(j<notes.length&&startMsOf(notes[j])-startMsOf(notes[i])<=SAME_TIME_MS)j++;
    const t=startMsOf(notes[i]);
    settle(hands.L,t);settle(hands.R,t);
    const group=notes.slice(i,j).map(n=>({n,x:HR.centerAt(n,t),z:HR.levelAt(n,t)>=.5?1:0})).sort((a,b)=>a.x-b.x);
    // 割り振り
    const busy={L:handBusy(hands.L,t),R:handBusy(hands.R,t)};
    const assign=[];
    if(group.length===1){
      const g=group[0],side=g.x<CENTER?'L':'R';
      let hand,blocked=false;
      if(busy.L&&busy.R){hand=side;blocked=true;}
      else if(busy.L)hand='R';else if(busy.R)hand='L';
      else{const cl=pickCost(hands.L,'L',t,g.x,g.z),cr=pickCost(hands.R,'R',t,g.x,g.z);hand=Math.abs(cl-cr)<1e-9?side:cl<cr?'L':'R';}
      assign.push({...g,hand,blocked});
    }else{
      // 同時押し: 左のノーツを左手・右のノーツを右手。3つ目からと、押さえている手に当たるぶんは「ふさがっている」
      group.forEach((g,k)=>{
        const hand=k===0?'L':k===group.length-1?'R':(g.x<CENTER?'L':'R');
        assign.push({...g,hand,blocked:busy[hand]||(k>0&&k<group.length-1)});
      });
    }
    // 入り乱れ: 前後 MIX_WINDOW_MS に始まるノーツのうち、少ない方の高さの割合(0〜1)
    while(lo<starts.length&&starts[lo].t<t-MIX_WINDOW_MS)lo++;
    while(hi<starts.length&&starts[hi].t<=t+MIX_WINDOW_MS)hi++;
    let air=0;for(let k=lo;k<hi;k++)air+=starts[k].z;
    const total=hi-lo,mix=total>=4?2*Math.min(air,total-air)/total:0;
    const globalGap=t-prevGroupT;
    const chordGap=group.length>=2?Math.min(...group.slice(1).map((g,k)=>Math.abs(g.x-group[k].x))):null;
    const chordSplit=group.length>=2&&group.some(g=>g.z!==group[0].z);
    for(const a of assign){
      const h=hands[a.hand],o=hands[other[a.hand]],f={};
      for(const k of FEATURE_KEYS)f[k]=0;
      if(globalGap<HAND_MODEL.restrikeComfortMs&&a===assign[0])f.stream=(HAND_MODEL.restrikeComfortMs-Math.max(1,globalGap))/HAND_MODEL.restrikeComfortMs;
      if(a.blocked){f.blocked=1;}
      else if(Number.isFinite(h.lastT)&&h.lastX!=null){
        const gap=Math.max(1,t-h.lastT);
        f.handTempo=tempoStrain(gap);
        if(gap<HAND_MODEL.restrikeComfortMs)f.handJack=(HAND_MODEL.restrikeComfortMs-gap)/HAND_MODEL.restrikeComfortMs;
        f.handMove=clamp(dist(a.x-h.lastX,a.z-h.lastZ)/(gap/1000)/HAND_MODEL.laneSpeedComfort,0,1.5);
        if(a.z!==(h.lastZ>=.5?1:0)){
          if(natural.has(a.n))f.switchNatural=1;else f.switchAny=1;
          if(gap<SWITCH_RAISE_MS)f.switchFast=(SWITCH_RAISE_MS-gap)/SWITCH_RAISE_MS+(gap<SWITCH_RULE_MS?(SWITCH_RULE_MS-gap)/SWITCH_RULE_MS:0);
          else if(gap<SWITCH_EASY_MS)f.switchFast=.25*(SWITCH_EASY_MS-gap)/(SWITCH_EASY_MS-SWITCH_RAISE_MS);
        }
      }
      // 反対の手が押さえている間
      if(handBusy(o,t)&&o.held!==a.n){
        const hx=HR.centerAt(o.held,t),hz=HR.levelAt(o.held,t)>=.5?1:0,oside=other[a.hand];
        f.oneHand=1;
        f.oneHandFar=clamp(oside==='L'?CENTER-a.x:a.x-CENTER,0,3);
        if(oside==='L'?a.x<hx-.5:a.x>hx+.5)f.armCross=1;
        if(hz!==a.z)f.heldSplit=1;
        const hx2=HR.centerAt(o.held,t+100),hz2=HR.levelAt(o.held,t+100);
        f.heldMoving=clamp(dist(hx2-hx,hz2-HR.levelAt(o.held,t))/.1/HAND_MODEL.laneSpeedComfort,0,1);
      }
      f.mix=mix;
      f.confuse=confuse.get(a.n)||0;
      if(chordGap!=null){const W=L.WORK,r=clamp((chordGap-W.chordTightLanes)/(W.chordWideLanes-W.chordTightLanes),0,1);
        f.chord=W.chordTight+(W.chordWide-W.chordTight)*r;if(chordSplit)f.chordSplit=1;}
      f.misc=miscOf(a.n);
      rows.push({timeMs:t,hand:a.hand,f});
    }
    // 手の状態を進める
    for(const a of assign){
      if(a.blocked)continue;
      const h=hands[a.hand];
      if(isLong(a.n)&&endMsOf(a.n)>t+1){h.held=a.n;h.lastT=t;h.lastX=a.x;h.lastZ=a.z;}
      else{h.lastT=t;h.lastX=a.x;h.lastZ=a.z;}
    }
    prevGroupT=t;i=j;
  }
  // 上下に分かれた交差(帯の途中で起きる。その時刻の出来事として足す)
  const longs=notes.filter(isLong);
  for(let a=0;a<longs.length;a++)for(let b=a+1;b<longs.length;b++){
    const A=longs[a],B=longs[b],s0=Math.max(startMsOf(A),startMsOf(B)),e0=Math.min(endMsOf(A),endMsOf(B));
    if(e0-s0<10)continue;let prev=0;
    for(let t=s0;t<=e0;t+=10){const d=HR.centerAt(A,t)-HR.centerAt(B,t),sg=Math.abs(d)<1e-6?0:Math.sign(d);
      if(sg&&prev&&sg!==prev&&HR.levelAt(A,t)!==HR.levelAt(B,t)){const f={};for(const k of FEATURE_KEYS)f[k]=0;f.skyCross=1;rows.push({timeMs:t,hand:null,event:true,f});}
      if(sg)prev=sg;}
  }
  const firstMs=startMsOf(notes[0]),lastMs=Math.max(...notes.map(endMsOf));
  return {rows,firstMs,spanMs:Math.max(L.WORK.windowMs,lastMs-firstMs),notes:notes.length};
};

// --- 1譜面の Lv. と内訳 ---
// 1ノーツあたりの量(要素ごと)。交差の出来事はノーツではないので数えない
const perNote=ex=>{const rs=ex.rows.filter(r=>!r.event),out={};for(const k of FEATURE_KEYS)out[k]=rs.reduce((a,r)=>a+r.f[k],0)/Math.max(1,rs.length);return out;};
const coordOf=(per,weights=COORD_WEIGHTS,offset=COORD_OFFSET)=>{let c=-offset;for(const k of Object.keys(weights))c+=weights[k]*(per[k]||0);return Math.max(0,c);};
const combine=(s,c,p=COMBINE_P)=>Math.pow(Math.pow(Math.max(0,s),p)+Math.pow(Math.max(0,c),p),1/p);
const speedOf=(chart,work=L.WORK_V3)=>L.LEVEL_SCALE*L.chartStrain(chart,{formula:work}).raw/10;
const r2=v=>Math.round(v*100)/100;
// 内訳は「そのまとまりを抜く(v3 の重みと C の重みを0にする)と Lv. がいくつ下がるか」。抜く順で変わらないように1つずつ抜く。
//   まとまりどうしは山の区間と合わせ方(P乗)でつながっているので、足しても全体とぴったりにはならない(差は「重なり」に出す)
const hellLevel=(chart,{explain=false}={})=>{
  const ex=extract(chart);if(!ex)return null;
  const per=perNote(ex),speed=speedOf(chart),coord=coordOf(per),exact=combine(speed,coord);
  const counts={};for(const k of FEATURE_KEYS)counts[k]=0;
  for(const r of ex.rows)for(const k of FEATURE_KEYS)if(r.f[k])counts[k]++;
  const out={level:clamp(Math.round(exact),L.LEVEL_MIN,L.LEVEL_MAX),exact:r2(exact),speed:r2(speed),coord:r2(coord),notes:ex.notes,counts,
    perNote:Object.fromEntries(COORD_KEYS.map(k=>[k,r2(per[k])]))};
  if(explain){
    const without=({s=[],c=[]})=>{const w={...L.WORK_V3};for(const k of s)w[k]=0;const cw={...COORD_WEIGHTS};for(const k of c)cw[k]=0;
      return combine(s.length?speedOf(chart,w):speed,coordOf(per,cw));};
    out.groups={};for(const [name,keys] of BREAKDOWN)out.groups[name]=r2(exact-without(keys));
    const all={s:BREAKDOWN.flatMap(b=>b[1].s),c:BREAKDOWN.flatMap(b=>b[1].c)};
    out.base=r2(without(all));                       // 速さと量だけ(空中・押さえながら・交差・連打を全部抜いた値)
    out.overlap=r2(exact-out.base-Object.values(out.groups).reduce((a,b)=>a+b,0));
    out.coordParts=Object.fromEntries(COORD_KEYS.map(k=>[k,r2(COORD_WEIGHTS[k]*per[k])]));
    // いちばん重い区間: 段取りの要るノーツ(C の要素)がいちばん多い8秒
    const rs=ex.rows.filter(r=>!r.event),score=r=>COORD_KEYS.reduce((a,k)=>a+COORD_WEIGHTS[k]*r.f[k],0);let best=[];
    for(let s0=ex.firstMs;s0<ex.firstMs+ex.spanMs;s0+=2000){const w=rs.filter(r=>r.timeMs>=s0&&r.timeMs<s0+8000);if(w.length>=6)best.push({startMs:s0,value:w.reduce((a,r)=>a+score(r),0)/w.length});}
    out.hardestMs=best.sort((a,b)=>b.value-a.value).slice(0,3).map(b=>b.startMs);
  }
  return out;
};

// --- 公開中の HELL(空中のある譜面)を並べる ---
// 古い試作(見分けにくい形を残したままの30秒の型)は並べない
const OLD_PROTOS=new Set(['sheriruth_proto']);
const hellCharts=()=>{
  const o=L.loadRuntimeSongs(),out=[];
  for(const song of [...o.RHYTHM_SONGS,...o.RHYTHM_PROTO_SONGS])for(const [difficulty,chart] of Object.entries(song.difficulties||{})){
    if(!chart||!Array.isArray(chart.notes)||!L.chartHasSky(chart)||OLD_PROTOS.has(song.songId))continue;
    out.push({songId:song.songId,title:song.displayName||song.songId,difficulty,chart});
  }
  return out;
};

// --- 合わせ直し(--calibrate): 社長の値がある譜面に C の重みを合わせる。ほかの譜面は「動かさない」を弱い条件にする ---
const calibrate=({others=.15,p=COMBINE_P}={})=>{
  const rows=hellCharts().map(c=>({id:c.songId,shown:L.shownLevel(c.songId,c.difficulty,c.chart),
    v3:L.chartLevel(c.chart,{formula:'v3'}).level,speed:speedOf(c.chart),per:perNote(extract(c.chart))})).map(r=>({...r,anchor:r.shown!==r.v3}));
  const K=COORD_KEYS,pred=(r,q)=>combine(r.speed,coordOf(r.per,Object.fromEntries(K.map((k,i)=>[k,q[i]])),q[K.length]),p);
  const loss=(set,q)=>{let s=0;for(const r of set){const e=pred(r,q)-r.shown;s+=(r.anchor?1:others)*e*e;}for(let i=0;i<K.length;i++)s+=.0005*q[i]*q[i];return s;};
  const fit=set=>{let q=new Array(K.length+1).fill(50);q[K.length]=5;let best=loss(set,q);
    for(let sweep=0;sweep<200;sweep++){let moved=false;
      for(let k=0;k<q.length;k++)for(const step of [20,5,1,.2])for(const dir of [1,-1])for(;;){const n=q.slice();n[k]=Math.max(0,n[k]+dir*step);if(n[k]===q[k])break;
        const l=loss(set,n);if(l<best-1e-9){best=l;q=n;moved=true;}else break;}
      if(!moved)break;}
    return q;};
  const q=fit(rows),anchors=rows.filter(r=>r.anchor);
  return {weights:Object.fromEntries(K.map((k,i)=>[k,Math.round(q[i])])),offset:Math.round(q[K.length]*10)/10,
    anchors:anchors.map(r=>({id:r.id,shown:r.shown,v3:r.v3,fitted:r2(pred(r,q)),leftOut:r2(pred(r,fit(rows.filter(x=>x!==r))))})),
    othersMax:r2(Math.max(...rows.filter(r=>!r.anchor).map(r=>pred(r,q)-r.shown)))};
};

module.exports={FEATURES,FEATURE_KEYS,GROUPS,GROUP_OF,COORD_WEIGHTS,COORD_OFFSET,COMBINE_P,COORD_KEYS,BREAKDOWN,extract,perNote,coordOf,combine,speedOf,hellLevel,hellCharts,calibrate,tempoStrain,
  TEMPO_EASY_MS,TEMPO_HARD_MS,SWITCH_RULE_MS,SWITCH_RAISE_MS,SWITCH_EASY_MS};

if(require.main===module){
  const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
  const songArg=argOf('--song'),top=Number(argOf('--top'))||0,jsonOut=argOf('--json');
  const short=id=>id.replace(/_hell_debug$/,''),sign=v=>(v>0?'+':'')+v;
  if(args.includes('--calibrate')){
    const c=calibrate();
    console.log(`合わせた重み: ${JSON.stringify(c.weights)} / 引く値 ${c.offset}(いまの道具: ${JSON.stringify(COORD_WEIGHTS)} / ${COORD_OFFSET})`);
    for(const a of c.anchors)console.log(`  ${short(a.id).padEnd(24)} 社長の値 ${a.shown} / v3 ${a.v3} / 合わせた値 ${a.fitted} / この譜面を抜いて合わせた値 ${a.leftOut}`);
    console.log(`  ほかの譜面の上がり幅の最大: +${c.othersMax}`);
    process.exit(0);
  }
  const rows=hellCharts().filter(c=>!songArg||short(c.songId)===songArg||c.songId===songArg).map(c=>{
    const v4=hellLevel(c.chart,{explain:true}),v3=L.chartLevel(c.chart,{formula:'v3'}).level,shown=L.shownLevel(c.songId,c.difficulty,c.chart);
    const best=Object.entries(v4.groups).sort((a,b)=>b[1]-a[1]);
    return {songId:c.songId,title:c.title,difficulty:c.difficulty,notes:v4.notes,shown,v3,v4:v4.level,exact:v4.exact,speed:v4.speed,coord:v4.coord,diff:v4.level-shown,
      groups:v4.groups,base:v4.base,overlap:v4.overlap,coordParts:v4.coordParts,perNote:v4.perNote,counts:v4.counts,hardestMs:v4.hardestMs,
      top:best.slice(0,2).map(([g,v])=>`${g}+${v.toFixed(1)}`).join(' ')};
  });
  if(jsonOut){require('fs').writeFileSync(path.resolve(jsonOut),JSON.stringify(rows,null,1));console.log(`書き出しました: ${jsonOut}(${rows.length}譜面)`);}
  if(songArg&&rows.length){
    for(const r of rows){
      console.log(`${r.title||r.songId} ${r.difficulty}  表示 Lv.${r.shown} / 今の式(v3) Lv.${r.v3} / 新しい式(v4) Lv.${r.v4}  (${r.notes}ノーツ)`);
      console.log(`  速さ・密度の難しさ S ${r.speed} / 段取りの難しさ C ${r.coord} → 合わせて ${r.exact}`);
      console.log(`  速さと量だけ(下の5つを全部抜く): ${r.base}`);
      for(const [g,v] of Object.entries(r.groups).sort((a,b)=>b[1]-a[1]))console.log(`    ${g.padEnd(6,'　')} +${v.toFixed(1).padStart(5)}  ${BREAKDOWN.find(b=>b[0]===g)[2]}`);
      console.log(`    重なり(まとまりどうしがつながっているぶん): ${sign(r.overlap)}`);
      console.log(`  段取りの中身(ノーツのうちの割合 → C に足す点): ${COORD_KEYS.map(k=>`${FEATURES.find(f=>f[0]===k)[2].split('(')[0]} ${Math.round(r.perNote[k]*100)}% → ${r.coordParts[k]}`).join(' / ')}(ここから ${COORD_OFFSET} を引く)`);
      console.log(`  段取りがいちばん濃い8秒: ${r.hardestMs.map(ms=>`${(ms/1000).toFixed(0)}秒〜`).join('・')}`);
    }
  }else{
    const list=rows.slice().sort((a,b)=>Math.abs(b.v4-b.v3)-Math.abs(a.v4-a.v3)||b.v4-a.v4),show=top?list.slice(0,top):list;
    console.log('曲'.padEnd(32)+'表示  v3  v4 表示との差  S(速さ) C(段取り)  いちばん効いた要素');
    for(const r of show)console.log(short(r.songId).padEnd(32)+String(r.shown).padStart(4)+String(r.v3).padStart(4)+String(r.v4).padStart(4)+sign(r.diff).padStart(6)+r.speed.toFixed(1).padStart(12)+r.coord.toFixed(1).padStart(8)+'    '+r.top);
    const within=n=>rows.filter(r=>Math.abs(r.diff)<=n).length;
    console.log(`${rows.length}譜面: 表示との差 0 が ${within(0)}・±1 以内 ${within(1)}・±2 以内 ${within(2)}・最大 ${Math.max(...rows.map(r=>Math.abs(r.diff)))}(今の式 v3 は 表示との差の最大 ${Math.max(...rows.map(r=>Math.abs(r.v3-r.shown)))})`);
  }
}
