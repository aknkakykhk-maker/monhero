#!/usr/bin/env node
// 参考譜面に寄せる道具 段2: 置き換え(2026-10-10・オンプくん。台帳 r2610101530refcap)
//
//   node tools/mode/rhythm-ref-map.js --track <曲id>                     # ref-work/<曲id>/capture.json → draft.json
//   node tools/mode/rhythm-ref-map.js --track <曲id> --uncross           # 2本のスライドを交わらせない(左の線は常に左手)
//   node tools/mode/rhythm-ref-map.js --track <曲id> --audio-json <path> # 拍と音の立ち上がりを読む解析ファイル(既定 authoring/<曲id>-v3-audio.json)
//
// 【何をするか】段1(rhythm-ref-capture.js)の表を、こちらの譜面の形(6レーン・12サブレーン)へ写した「下書き」にする。
//   ・打鍵: 光の時刻の ±16分 に音の立ち上がり(解析の onsets)があればその16分へ、無ければ16分へ丸める
//     (動画は1コマ≒16分なので、絵だけで寄せると前後へ1つずれる)
//   ・地上/空中・ホールド・アーク→スライドの写し方は、約束の表(rhythm-ref-profiles.json の map)に従う
//   ・スライドは16分ごとに拾い、レーン・高さのずれが表の幅を超える所だけ点を残す(多すぎる点は押し心地を変えない)
//   ・押せる形にする: 2本のスライドの間はほかのノーツを置かない / 片手のスライドの間は同じ16分に1つ / 同じ16分は2つまで。
//     そのあと両手のシミュレート(rhythm-hand-simulate.js)にかけ、押せない打鍵は16分1つ前後へずらし、だめなら省く
//   ・何を省いた・ずらしたかは数えて出す(黙って消さない)
//
// 【下書きの形】(sheriruth の試作でゲーム側と取り決めた形。時刻はゲームの音源の ms)
//   タップ/フリック {k:'t'|'f', t, sub, w, sky:0|1, dir:''}  ホールド {k:'h', t, end, sub, w, sky:0}
//   スライド {k:'s', hand:'L'|'R', pts:[[ms, レーン(左端・0〜5・0.5刻み), 幅, 高さ0〜1, ease]], endFlick}
//   ※ sky と高さを読むのは試作ブランチのゲームだけ。main のゲームは空中の段をまだ持たない
//
// 【決めごと】下書きは参考譜面の写しに近いので、書き出すのは tools/mode/ref-work/<曲id>/ だけ(リポジトリに置かない)。
'use strict';
const fs=require('fs'),path=require('path');
const {loadProfile,workDirFor,REPO_ROOT}=require('./rhythm-ref-capture.js');
const {simulateNotes}=require('./rhythm-hand-simulate.js');

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const interp=(t,xs,ys)=>{
  if(t<=xs[0])return ys[0];
  for(let i=1;i<xs.length;i++)if(t<=xs[i]){const r=(t-xs[i-1])/Math.max(1,xs[i]-xs[i-1]);return ys[i-1]+(ys[i]-ys[i-1])*r;}
  return ys[ys.length-1];
};
// 点 [t, レーン, 高さ] の列を、ずれが許す幅に収まるところまで間引く(Ramer–Douglas–Peucker)
const simplify=(pts,laneTol,heightTol)=>{
  if(pts.length<3)return pts.slice();
  const [t0,l0,h0]=pts[0],[t1,l1,h1]=pts[pts.length-1];let worst=0,at=-1;
  for(let i=1;i<pts.length-1;i++){
    const [t,l,h]=pts[i],r=(t-t0)/Math.max(1,t1-t0);
    const d=Math.max(Math.abs(l-(l0+(l1-l0)*r))/laneTol,Math.abs(h-(h0+(h1-h0)*r))/heightTol);
    if(d>worst){worst=d;at=i;}
  }
  if(worst<=1)return [pts[0],pts[pts.length-1]];
  return simplify(pts.slice(0,at+1),laneTol,heightTol).slice(0,-1).concat(simplify(pts.slice(at),laneTol,heightTol));
};
const median=a=>{const s=a.slice().sort((x,y)=>x-y);return s[Math.floor(s.length/2)];};

const mapCapture=(cap,audio,profile,{uncross=false}={})=>{
  const {beatZeroMs:Z,beatMs:B}=audio.timing,Q=B/4;
  const slot=ms=>Math.round((ms-Z)/Q),msOf=s=>Math.round(Z+s*Q);
  const [LO,HI]=cap.rangeMs,F=profile.floor,J=profile.judge,M=profile.map;
  const laneW=(F.right-F.left)/F.lanes;
  const center6=x=>(x-F.left)/(F.right-F.left)*6;          // 画面の x → 6レーンでの横位置(0〜6)
  const heightOf=y=>clamp((J.groundY-y)/(J.groundY-J.skyY),0,1);
  const onsets=(audio.onsets||[]).map(o=>Number(o.timeMs)).filter(Number.isFinite).sort((a,b)=>a-b);
  const stat={byOnset:0,byFrame:0,moved:0,dropped:{twoSlides:0,oneSlideSecond:0,thirdInSlot:0,duplicate:0,unplayable:0,unplayableSky:0}};
  const snap=ms=>{
    let best=null;for(const o of onsets){if(o<ms-Q)continue;if(o>ms+Q)break;if(best===null||Math.abs(o-ms)<Math.abs(best-ms))best=o;}
    if(best!==null){stat.byOnset++;return slot(best);}
    stat.byFrame++;return slot(ms);
  };
  // ── アーク → スライド ──
  const slides=[];
  for(const arc of profile.arcs){
    const pts=(cap.arcs[arc.id]||[]).filter(p=>p[0]>=LO-Q&&p[0]<=HI);
    const segs=[];let cur=[];
    for(const p of pts){if(cur.length&&p[0]-cur[cur.length-1][0]>2*B){segs.push(cur);cur=[];}cur.push(p);}
    if(cur.length)segs.push(cur);
    for(const sg of segs){
      if(sg.length<4||sg[sg.length-1][0]-sg[0][0]<2*Q)continue;
      const ts=sg.map(p=>p[0]),xs=sg.map(p=>p[1]),ys=sg.map((p,i)=>median(sg.slice(Math.max(0,i-2),i+3).map(q=>q[2])));
      const samples=[];
      for(let s=slot(ts[0]);s<=slot(ts[ts.length-1]);s++){
        const t=msOf(s);samples.push([t,clamp(center6(interp(t,ts,xs))-0.5,0,5),heightOf(interp(t,ts,ys))]);
      }
      slides.push({hand:arc.hand,samples});
    }
  }
  if(uncross){
    // 同時に2本あるところは、左の線を左手・右の線を右手へ持ち替える。1レーン未満まで近づいたら1レーン空ける
    const L=slides.filter(s=>s.hand==='L'),R=slides.filter(s=>s.hand==='R');
    for(const l of L)for(const r of R){
      const lm=new Map(l.samples.map(p=>[p[0],p])),rm=new Map(r.samples.map(p=>[p[0],p]));
      for(const [t,lp] of lm){const rp=rm.get(t);if(!rp)continue;
        let [lo,hi]=lp[1]<=rp[1]?[lp,rp]:[rp,lp];lo=lo.slice();hi=hi.slice();
        if(hi[1]-lo[1]<1){const m=(lo[1]+hi[1])/2;lo[1]=Math.max(0,m-0.5);hi[1]=Math.min(5,m+0.5);}
        lm.set(t,[t,lo[1],lo[2]]);rm.set(t,[t,hi[1],hi[2]]);
      }
      l.samples=[...lm.values()];r.samples=[...rm.values()];
    }
  }
  const slideNotes=slides.map(s=>({k:'s',hand:s.hand,endFlick:false,
    pts:simplify(s.samples,M.slide.laneTolerance,M.slide.heightTolerance).map(([t,l,h])=>[t,Math.round(l*2)/2,M.slide.width,Math.round(h*4)/4,0])}));
  // 同時に2本のスライドが終わる所で同じレーンに着くと指がぶつかる → 1レーン空ける
  for(const a of slideNotes)for(const b of slideNotes){
    if(a===b||a.hand!=='L'||b.hand!=='R')continue;
    const ea=a.pts[a.pts.length-1],eb=b.pts[b.pts.length-1];
    if(Math.abs(ea[0]-eb[0])<B&&Math.abs(ea[1]-eb[1])<1){const m=(ea[1]+eb[1])/2;ea[1]=Math.max(0,Math.floor(m*2-1)/2);eb[1]=Math.min(5,ea[1]+1);}
  }
  const span=n=>[n.pts[0][0],n.pts[n.pts.length-1][0]];
  const slidesAt=t=>slideNotes.filter(n=>{const [a,b]=span(n);return a-40<=t&&t<=b+40;}).length;
  // ── 打鍵 → タップ/ホールド ──
  const notes=[];
  for(const h of cap.hits.slice().sort((a,b)=>a.ms-b.ms)){
    const s=snap(h.ms),t=msOf(s);if(t<LO||t>HI)continue;
    let n;
    if(h.sky){const sub=clamp(Math.round(center6(h.x)*2-M.sky.width/2),0,12-M.sky.width);n={k:'t',t,sub,w:M.sky.width,sky:1,dir:''};}
    else{
      const i=clamp(Math.floor((h.x-F.left)/laneW),0,F.lanes-1);
      n={k:'t',t,sub:M.ground.subLanes[i],w:M.ground.width,sky:0,dir:''};
      if(h.frames>=profile.hit.holdMinFrames){const e=msOf(slot(h.endMs));if(e-t>=2*Q)n={k:'h',t,end:e,sub:n.sub,w:n.w,sky:0};}
    }
    n._s=s;
    const busy=slidesAt(t);
    if(busy>=2){stat.dropped.twoSlides++;continue;}
    const same=notes.filter(m=>m._s===s);
    if(same.some(m=>m.sub===n.sub&&m.sky===n.sky)){stat.dropped.duplicate++;continue;}
    const held=notes.filter(m=>m.k==='h'&&m.t<t&&t<=m.end).length;
    if(same.length>=2-busy-held){stat.dropped[busy?'oneSlideSecond':'thirdInSlot']++;continue;}
    if(n.k==='h'&&slideNotes.some(sn=>{const [a,b]=span(sn);return a<=n.end&&b>=n.t;}))n={k:'t',t,sub:n.sub,w:n.w,sky:0,dir:'',_s:s};
    notes.push(n);
  }
  // ── 両手のシミュレートで押せない打鍵を直す ──
  const timing={beatZeroMs:Z,gridMs:Q,subdivisionsPerBeat:4,beatsPerBar:audio.timing.beatsPerBar||4};
  const toSim=n=>n.k==='s'?{type:'SLIDE',grid:slot(n.pts[0][0]),durationGrids:slot(n.pts[n.pts.length-1][0])-slot(n.pts[0][0]),lane:n.pts[0][1],subLaneWidth:n.pts[0][2],endFlick:n.endFlick,slidePoints:n.pts.map(([t,l,w])=>({timeMs:t,lane:l,subLaneWidth:w}))}
    :n.k==='h'?{type:'HOLD',grid:slot(n.t),durationGrids:slot(n.end)-slot(n.t),subLane:n.sub,subLaneWidth:n.w}
    :{type:n.k==='f'?'FLICK':'TAP',grid:slot(n.t),subLane:n.sub,subLaneWidth:n.w};
  // 直しても押せないスライドは「要確認」として残す(参考の主役なので消さない。2本が交わる所で起きる → --uncross)
  const givenUp=new Set();
  const impossible=list=>simulateNotes(list.map(toSim),timing).issues
    .filter(i=>i.severity==='impossible'&&!givenUp.has(list[i.noteIndex]));
  let list=[...slideNotes,...notes];
  for(let guard=0;guard<list.length*3;guard++){
    const bad=impossible(list);if(!bad.length)break;
    let i=bad[0].noteIndex;
    if(list[i].k==='s'){
      // スライドは動かさない。始まりの直前(4拍以内。指の割り振りは数ノーツ前から決まる)の打鍵のほうを直す
      const st=list[i].pts[0][0];
      const prev=list.map((o,j)=>[o,j]).filter(([o])=>o.k!=='s'&&o.t<=st&&st-o.t<=4*B).sort((a,b)=>b[0].t-a[0].t)[0];
      if(!prev){givenUp.add(list[i]);continue;}
      i=prev[1];
    }
    const n=list[i];
    let best=null;
    for(const d of [-1,1]){
      const t=msOf(n._s+d);if(slidesAt(t)>=2)continue;
      const m={...n,t,_s:n._s+d,...(n.k==='h'?{end:msOf(slot(n.end)+d)}:{})};
      const trial=list.slice();trial[i]=m;
      if(trial.some((o,j)=>j!==i&&o.k!=='s'&&o._s===m._s&&o.sub===m.sub&&o.sky===m.sky))continue;
      const c=impossible(trial).length;if(c<bad.length&&(!best||c<best.c))best={c,trial};
    }
    if(best){list=best.trial;stat.moved++;}
    else{list.splice(i,1);stat.dropped.unplayable++;if(n.sky)stat.dropped.unplayableSky++;}
  }
  const sim=simulateNotes(list.map(toSim),timing);
  stat.slidesToCheck=[...givenUp].map(n=>({hand:n.hand,startMs:n.pts[0][0],beat:+((n.pts[0][0]-Z)/B).toFixed(2)}));
  // 2本のスライドの間隔を16分ごとに自前で見る(両手のシミュレートは、スライドを押さえる指を始めから終点のレーンに置くので、
  // 長いスライドの途中で2本が近づく・交わるのを見ない。rhythm-hand-simulate.js は共用なので変えない)
  const laneAt=(n,t)=>interp(t,n.pts.map(p=>p[0]),n.pts.map(p=>p[1]));
  stat.slidePairs={crossings:0,tooClose:0};
  const Ls=list.filter(n=>n.k==='s'&&n.hand==='L'),Rs=list.filter(n=>n.k==='s'&&n.hand==='R');
  for(const l of Ls)for(const r of Rs){
    const a=Math.max(l.pts[0][0],r.pts[0][0]),b=Math.min(l.pts[l.pts.length-1][0],r.pts[r.pts.length-1][0]);
    let prev=null;
    for(let s=Math.ceil((a-Z)/Q);msOf(s)<=b;s++){
      const d=laneAt(r,msOf(s))-laneAt(l,msOf(s));
      if(Math.abs(d)<1)stat.slidePairs.tooClose++;
      if(prev!==null&&Math.sign(d)!==Math.sign(prev)&&d!==0)stat.slidePairs.crossings++;
      prev=d;
    }
  }
  const startOf=n=>n.k==='s'?n.pts[0][0]:n.t;
  list.sort((a,b)=>startOf(a)-startOf(b));
  for(const n of list)delete n._s;
  return {draft:{track:cap.track,variant:uncross?'交わらない':'参考どおり',range:cap.rangeMs,
    grid:{zero:Z,beat:B,div:4},notes:list},stat,sim:{impossible:sim.impossible,strained:sim.strained}};
};

if(require.main===module){
  const args=process.argv.slice(2),get=k=>{const i=args.indexOf(`--${k}`);return i>=0?args[i+1]:undefined;};
  try{
    const track=get('track'),dir=workDirFor(track);
    const cap=JSON.parse(fs.readFileSync(path.join(dir,'capture.json'),'utf8'));
    const audioPath=get('audio-json')||path.join(__dirname,'authoring',`${track}-v3-audio.json`);
    const audio=JSON.parse(fs.readFileSync(audioPath,'utf8'));
    const uncross=args.includes('--uncross');
    const {draft,stat,sim}=mapCapture(cap,audio,loadProfile(cap.profile),{uncross});
    const file=path.join(dir,uncross?'draft-uncross.json':'draft.json');
    fs.writeFileSync(file,JSON.stringify(draft));
    const k=draft.notes.reduce((a,n)=>{const key=n.k==='s'?'スライド':n.k==='h'?'ホールド':n.sky?'空中タップ':'地上タップ';a[key]=(a[key]||0)+1;return a;},{});
    const d=stat.dropped;
    console.log(`下書き(${draft.variant}): ${Object.entries(k).map(([a,b])=>`${a}${b}`).join('・')} / 押せない ${sim.impossible}・無理がある ${sim.strained}`);
    console.log(`時刻: 音の立ち上がりへ ${stat.byOnset}・コマのまま ${stat.byFrame} / 16分1つずらした ${stat.moved}`);
    console.log(`省いた: 2本のスライドの間 ${d.twoSlides}・片手のスライド中の2つ目 ${d.oneSlideSecond}・同じ16分の3つ目 ${d.thirdInSlot}・同じ所の重なり ${d.duplicate}・押せない ${d.unplayable}(うち空中 ${d.unplayableSky})`);
    console.log(`2本のスライド: 左右が入れ替わる ${stat.slidePairs.crossings} 回・1レーン未満まで近づく16分 ${stat.slidePairs.tooClose}${stat.slidePairs.crossings?'(指が交差する。--uncross で無くせる)':''}`);
    if(stat.slidesToCheck.length)console.log(`要確認: 両手のシミュレートが押せないとしたスライド ${stat.slidesToCheck.map(s=>`${s.hand}・拍${s.beat}`).join(' / ')}`
      +'(シミュレートは押さえている指を始めから終点のレーンに置くので、長いスライドでは誤って出ることがある。上の2本の間隔の数で判断する)');
    console.log('書き出した:',path.relative(REPO_ROOT,file),'(リポジトリには入らない)');
  }catch(e){console.error('止まった:',e.message);process.exit(1);}
}

module.exports={mapCapture,simplify};
