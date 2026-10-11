#!/usr/bin/env node
// HELL(6段目・空中のノーツあり)を「空と地上が混ざって行き来する」形で作る(2026-10-11・オンプくん。社長の依頼)。
//
//   node tools/mode/rhythm-hell-mix.js --song sheriruth                # 作って数字を出すだけ(書かない)
//   node tools/mode/rhythm-hell-mix.js --song sheriruth --write        # rhythm-mode.js の <曲-v3-hell-notes> の内側と HELL の Lv. だけを書く
//
// 【なぜ要るか】社長「HELL やってみたけどマスターと譜面同じ過ぎてつまらない。空中ノーツをあんまり活かしてない。
//   もっと混ざったりとかそういう難易度の上げ方のほうがいい。空中スライドが地上に降りてきたりとか最初あったけど、なくしたの?」
//   前の HELL は MASTER の写しに空中のタップを足しただけで、空と地上を行き来するスライドが0本だった。
// 【作り方】土台は同じ曲の MASTER(ノーツの時刻・レーンはそのまま。数を増やして難しくしない)。難しさは「空と地上の混ざり方」で上げる。
//   ・スライド(2拍以上): 空から地上へ降りる/地上から空へ上がる/上がって降りる、を順に当てる。行き来は拍の頭から1拍かけて
//   ・タップ: 2小節ごとに「左手が空・右手が地上」「右手が空・左手が地上」「両手とも地上」を回す(片手が空・片手が地上、交互に叩く流れ)
//   ・ホールドとモンスターノーツ(4個)は地上のまま
//   ・同じ親指が段(空⇄地上)を変えるのは、その親指の前のノーツから1.5拍以上あいてから(人が段を見分けて動く時間。前の HELL と同じ決まり)
//   ・左右の手は、横持ちの親指2本のモデル(rhythm-ref-tiers.js の thumbCheck)が MASTER で選んだ振り分けに従う
// 【決めごと】既存曲の譜面は変えない(tools/mode/CLAUDE.md ⑩-2)。書くのはその曲の HELL のマーカーの内側と HELL の Lv. だけ。
//   地上の5難易度のマーカーが1バイトでも変わるなら、書く前に止める。HELL はデバッグ専用(公開の印は触らない)。
'use strict';
const fs=require('fs'),path=require('path');
const rt0=require('./rhythm-runtime-notes.js');
const {thumbCheck,THUMB_PROFILES,simulateRuntime,chartStats}=require('./rhythm-ref-tiers.js');

const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
// crosses: 交差する両手の長押し(片手が空・片手が地上)を入れる所(両手のスライドが重なる所の始まりの時刻・音で選んだ)。
// showcase: MASTER にもともとある交差の見せ場(社長が決めた形・押せないの例外はこの中だけ)
const SONGS={sheriruth:{marker:'sheriruth-v3',zero:711.6-2594.75,beat:324.342,levelRe:/const sheriruthHellChart=mhChart\((\d+),/,
  crosses:[75960,78550,83419],showcase:[[107900,112600],[130200,132100]]}};
const BEAT_GAP=1.5;                      // 同じ親指が段を変えるまでの拍
const PHRASE_BEATS=4;                    // タップの段を回す長さ(1小節)
const PHRASE_MODES=['L','R','ground','both'];   // L=左手が空 / R=右手が空 / ground=両手とも地上 / both=両手が空(同時押しは片方だけ)
const HELL_LANDSCAPE={...THUMB_PROFILES.landscape,name:'横持ち(HELL・高さの差39%)',skyDy:390*0.39};

// MASTER のマーカーを下書きの形へ(t=タップ・h=ホールド・s=スライド)
const readBlock=(source,name)=>{
  const block=rt0.markerBlock(source,name);if(!block)throw new Error(`<${name}-notes> が無い`);
  const notes=[];
  const t=(at,sub,w,mon)=>notes.push({k:'t',t:at,sub,w,sky:0,...(mon?{mon}:{})});
  const h=(at,sub,w,end)=>notes.push({k:'h',t:at,sub,w,end,sky:0});
  const s=(at,end,pts,ef)=>notes.push({k:'s',hand:null,endFlick:!!ef,pts:pts.map(p=>[p[0],p[1],p[2]??2,0,0])});
  new Function('t','h','s','return ['+block.body+']')(t,h,s);
  return notes;
};
const startOf=n=>n.k==='s'?n.pts[0][0]:n.t,endOf=n=>n.k==='s'?n.pts[n.pts.length-1][0]:n.k==='h'?n.end:n.t;
const laneAt=(pts,at)=>{if(at<=pts[0][0])return pts[0][1];for(let i=1;i<pts.length;i++)if(at<=pts[i][0]){const r=(at-pts[i-1][0])/Math.max(1,pts[i][0]-pts[i-1][0]);return pts[i-1][1]+(pts[i][1]-pts[i-1][1])*r;}return pts[pts.length-1][1];};

const mix=(master,{zero,beat,crosses=[]})=>{
  // 格子へ寄せる。元の譜面に近い時刻(3ms以内)があればその時刻を使う(丸め方が1ms違うと、2本のスライドの間がその瞬間だけ詰まる)
  const chartTimes=[...new Set(master.flatMap(n=>n.k==='s'?n.pts.map(p=>p[0]):[n.t,n.end].filter(x=>x!=null)))].sort((a,b)=>a-b);
  const Q=beat/4,snap=at=>{const g=Math.round(zero+Math.round((at-zero)/Q)*Q);const near=chartTimes.find(x=>Math.abs(x-g)<=3);return near!=null?near:g;};
  const hands=thumbCheck(master,THUMB_PROFILES.landscape,beat).hands;
  const handOf=n=>n.hand||hands.get(n)||((n.k==='s'?n.pts[0][1]+0.5:(n.sub+n.w/2)/2)<3?'L':'R');
  const notes=master.map(n=>n.k==='s'?{...n,hand:handOf(n),pts:n.pts.map(p=>p.slice())}:{...n,hand:handOf(n)});
  // スライドの形: 2拍以上は「降りる・上がる・上がって降りる」を順に。短いものは段の回し方に従う(行き来しない)
  const PROFILES=['down','up','hill'];let slideIndex=0;
  const phraseOf=at=>PHRASE_MODES[((Math.floor((at-zero)/(beat*PHRASE_BEATS))%PHRASE_MODES.length)+PHRASE_MODES.length)%PHRASE_MODES.length];
  const wantSky=(n)=>{const m=phraseOf(startOf(n));return m==='both'||m===n.hand;};
  const fixedGround=n=>n.k==='h'||!!n.mon;
  // 交差する両手の長押し(2026-10-11 社長「スカイホールドのダブルで右と左で地上と空中でクロスさせるのもいれたいね」)。
  // 両手のスライドが重なる所で、真ん中に近いほうを横に動かない空中の長押し、もう片方を地上で空中の長押しの下をくぐって反対側へ渡らせる。
  // 渡るのは重なりの真ん中の1拍。遊ぶ人は交差のところで指を置き換える(右で押していたものが左指に変わる)。2本の形は固定し、前後のタップを合わせる
  const crossWindows=[];
  for(const at of crosses){
    const pair=notes.filter(n=>n.k==='s'&&startOf(n)<=at+5&&endOf(n)>=at+5);
    if(pair.length!==2||pair[0].hand===pair[1].hand)throw new Error(`${at}ms に左右のスライド2本が無い(交差の長押しを置けない)`);
    const a=Math.max(...pair.map(startOf)),b=Math.min(...pair.map(endOf));
    const lanes=pair.map(n=>laneAt(n.pts,a)),k=Math.abs(lanes[0]-2.5)<Math.abs(lanes[1]-2.5)||(Math.abs(lanes[0]-2.5)===Math.abs(lanes[1]-2.5)&&pair[0].hand==='R')?0:1;
    const hold=pair[k],mover=pair[1-k],L0=Math.round(lanes[k]*4)/4,x0=lanes[1-k],side=x0<L0?-1:1;
    const xEnd=Math.max(0,Math.min(5,Math.round((L0-side*Math.max(1,Math.abs(x0-L0)))*4)/4));
    const mid=(a+b)/2,c0=snap(mid-beat/2),c1=snap(mid+beat/2);
    // 横に動かないのは両手が重なってから(それより前は元の通り道。前から止めると、同じ時刻の反対の手のタップと重なることがある)
    const holdLane=t=>t<a?Math.round(laneAt(hold.pts,t)*1000)/1000:L0;
    hold.pts=[...new Set([...hold.pts.map(p=>p[0]),a])].sort((x,y)=>x-y).filter(t=>t>=startOf(hold)&&t<=endOf(hold)).map(t=>[t,holdLane(t),hold.pts[0][2],1,0]);hold.profile='sky';hold.fixed=true;
    // 同じ手の次が地上に固定のノーツ(ホールド・モンスター)で近いときは、渡り終えたあとの最後の1拍で地上へ降ろす(段を変える間 1.5拍を守る)
    const holdEnd=endOf(hold),nextFixed=notes.filter(n=>n!==hold&&n.hand===hold.hand&&startOf(n)>holdEnd&&(n.k==='h'||n.mon)).sort((x,y)=>startOf(x)-startOf(y))[0];
    if(nextFixed&&startOf(nextFixed)-holdEnd<(BEAT_GAP+3)*beat&&holdEnd-snap(mid+beat/2)>=beat/2-2){const d0=Math.max(snap(holdEnd-beat),snap(mid+beat/2));
      hold.pts=[...hold.pts.filter(p=>p[0]<d0),[d0,L0,hold.pts[0][2],1,0],...hold.pts.filter(p=>p[0]>d0)].map(p=>[p[0],p[1],p[2],p[0]<=d0?1:Math.max(0,1-(p[0]-d0)/(holdEnd-d0)),0]);
      hold.pts=hold.pts.map(p=>[p[0],p[1],p[2],Math.round(p[3]*4)/4,0]);hold.profile='custom';}
    // 空中の長押しが重なりより前から始まるときは、地上から始めて重なりの始まりまでに空へ上げる(押さえたまま上がるので、段を変える間の決まりに当たらない)
    if(startOf(hold)<a-2){const r0=Math.max(startOf(hold),snap(a-beat));
      const pts2=[...new Set([...hold.pts.map(p=>p[0]),r0,a])].sort((x,y)=>x-y).map(t=>{const old=hold.pts.find(p=>p[0]===t);return [t,old?old[1]:holdLane(t),hold.pts[0][2],old?old[3]:1,0];});
      hold.pts=pts2.map(p=>[p[0],p[1],p[2],p[0]<=r0?(p[0]===startOf(hold)&&r0===startOf(hold)?1:0):p[0]>=a?p[3]:Math.round((p[0]-r0)/(a-r0)*4)/4,0]);
      if(r0===startOf(hold))hold.pts[0][3]=0;
      hold.profile='custom';}
    const laneOf=t=>t<a?laneAt(mover.pts,t):t<=c0?x0:t>=c1?xEnd:x0+(xEnd-x0)*(t-c0)/(c1-c0);
    const times=[...new Set([...mover.pts.map(p=>p[0]),a,c0,c1].filter(t=>t>=startOf(mover)&&t<=endOf(mover)))].sort((x,y)=>x-y);
    mover.pts=times.map(t=>[t,Math.round(laneOf(t)*1000)/1000,mover.pts[0][2],0,0]);mover.profile='ground';mover.fixed=true;
    crossWindows.push([a-120,b+120]);   // 押せない・交差の例外は両手が重なっている所だけ
  }
  for(const n of notes){
    if(n.fixed)continue;
    if(n.k==='s'){n.profile=endOf(n)-startOf(n)>=2*beat-2?PROFILES[slideIndex++%PROFILES.length]:(wantSky(n)?'sky':'ground');}
    else n.want=fixedGround(n)?0:(wantSky(n)?1:0);
  }
  // 同時押しは片方だけ空(両手が空の回では、右手を地上に残す)
  const byTime=new Map();for(const n of notes)if(n.k!=='s'){const k=n.t;byTime.set(k,[...(byTime.get(k)||[]),n]);}
  for(const g of byTime.values())if(g.length>1&&g.every(n=>n.want===1))g.filter(n=>n.hand==='R').forEach(n=>{n.want=0;});
  // スライドの高さを形どおりに置く(行き来は真ん中の拍の頭から1拍)
  const shape=(n,profile)=>{
    if(profile==='custom')return;   // 交差の長押しで高さを点ごとに決めたもの
    const a=startOf(n),b=endOf(n),pts=n.pts.map(p=>[p[0],p[1],p[2],0,0]);
    const levelAt=at=>{const mid=snap((a+b)/2),down=[mid-beat/2,mid+beat/2];
      const ramp=(x,u,v)=>x<=u?0:x>=v?1:(x-u)/(v-u);
      if(profile==='sky')return 1;if(profile==='ground')return 0;
      if(profile==='down')return 1-ramp(at,down[0],down[1]);
      if(profile==='up')return ramp(at,down[0],down[1]);
      const q1=snap(a+(b-a)/3),q2=snap(a+2*(b-a)/3);return Math.min(ramp(at,q1-beat/2,q1+beat/2),1-ramp(at,q2-beat/2,q2+beat/2));};
    // 行き来の区間には16分ごとに点を足す(高さの変わり目で道がとぎれないように)
    const extra=[];if(profile!=='sky'&&profile!=='ground')for(let at=snap(a)+Q;at<b-1;at=Math.round(at+Q)){const at2=snap(at);if(!pts.some(p=>Math.abs(p[0]-at2)<2))extra.push([at2,laneAt(n.pts,at2),pts[0][2],0,0]);}
    const all=[...pts,...extra].sort((x,y)=>x[0]-y[0]).map(p=>[p[0],Math.round(p[1]*1000)/1000,p[2],Math.round(levelAt(p[0])*4)/4,0]);   // 足した点のレーンは元の線の上(丸めると2本の間が詰まる)
    // 同じ高さ・同じレーンが続く点は間引く(始まりと終わりは残す)
    n.pts=all.filter((p,i,A)=>i===0||i===A.length-1||!(A[i-1][1]===p[1]&&A[i+1][1]===p[1]&&A[i-1][3]===p[3]&&A[i+1][3]===p[3]));
  };
  // 親指ごとに時刻順で、段を変える間(1.5拍)を守る。守れないタップは前の段のまま、スライドは前の段から始まる形へ替える
  const gap=BEAT_GAP*beat-2;
  // スライドの始まり・終わりの段。交差の2本(形を点ごとに決めたもの)は点の高さから読む
  const START={down:1,up:0,hill:0,sky:1,ground:0},END={down:0,up:1,hill:0,sky:1,ground:0};
  const sLv=n=>n.profile in START?START[n.profile]:(n.pts[0][3]>=0.5?1:0),eLv=n=>n.profile in END?END[n.profile]:(n.pts[n.pts.length-1][3]>=0.5?1:0);
  const fix=()=>{let changed=0;
    for(const h of ['L','R']){let prevEnd=-1e9,prevLevel=0;
      for(const n of notes.filter(m=>m.hand===h).sort((x,y)=>startOf(x)-startOf(y))){
        const close=startOf(n)-prevEnd<gap;
        if(n.k==='s'){
          const startLevel=sLv(n);
          if(close&&startLevel!==prevLevel&&!n.fixed){n.profile={down:'up',up:'down',hill:'sky',sky:'ground',ground:'sky'}[n.profile];if(n.profile==='sky'&&prevLevel===0)n.profile='ground';changed++;}
          prevLevel=eLv(n);
        }else{
          if(close&&n.want!==prevLevel){if(fixedGround(n)){/* 地上に固定のノーツの前は、下で後ろから直す */}else{n.want=prevLevel;changed++;}}
          prevLevel=n.want;
        }
        prevEnd=endOf(n);
      }}
    return changed;};
  // 地上に固定のノーツ(ホールド・モンスター)の直前に空があれば、そのタップを地上へ戻す(前から順に何度か回す)
  const backFix=()=>{let changed=0;
    for(const h of ['L','R']){const list=notes.filter(m=>m.hand===h).sort((x,y)=>startOf(x)-startOf(y));
      for(let i=list.length-1;i>0;i--){const n=list[i],p=list[i-1];
        const nStart=n.k==='s'?sLv(n):n.want,pEnd=p.k==='s'?eLv(p):p.want;
        if(startOf(n)-endOf(p)<gap&&nStart!==pEnd){
          if(p.k!=='s'&&!fixedGround(p)){p.want=nStart;changed++;}
          else if(p.k==='s'&&!p.fixed){p.profile={down:'hill',up:'ground',hill:'up',sky:'down',ground:'up'}[p.profile];if(nStart===0&&(p.profile==='up'||p.profile==='sky'))p.profile=p.profile==='up'?'hill':'down';changed++;}
          else if(n.k!=='s'&&!fixedGround(n)){n.want=pEnd;changed++;}
        }}}
    return changed;};
  for(let i=0;i<40;i++){const a=fix(),b=backFix();if(!a&&!b)break;}
  for(const n of notes){if(n.k==='s')shape(n,n.profile);else n.sky=n.want;delete n.want;delete n.fixed;delete n.profile;}
  notes.crossWindows=crossWindows;
  return notes;
};

// 段を変える間の違反(同じ親指で、前のノーツの終わりから1.5拍未満に段が変わる)
const levelSwitchViolations=(notes,beat)=>{const out=[];
  const startLv=n=>n.k==='s'?(n.pts[0][3]>=0.5?1:0):(n.sky?1:0),endLv=n=>n.k==='s'?(n.pts[n.pts.length-1][3]>=0.5?1:0):(n.sky?1:0);
  for(const h of ['L','R']){const list=notes.filter(n=>n.hand===h).sort((a,b)=>startOf(a)-startOf(b));
    for(let i=1;i<list.length;i++)if(startLv(list[i])!==endLv(list[i-1])&&startOf(list[i])-endOf(list[i-1])<BEAT_GAP*beat-2)out.push(startOf(list[i]));}
  return out;};
const counts=notes=>{const slides=notes.filter(n=>n.k==='s');
  const kind=s=>{const hs=s.pts.map(p=>p[3]);return hs.every(x=>x===0)?'地上だけ':hs.every(x=>x>0)?'空だけ':'行き来';};
  const c={地上タップ:notes.filter(n=>n.k==='t'&&!n.sky).length,空タップ:notes.filter(n=>n.k==='t'&&n.sky).length,ホールド:notes.filter(n=>n.k==='h').length,
    スライド:slides.length,地上だけ:0,空だけ:0,行き来:0,モンスター:notes.filter(n=>n.mon).length};
  for(const s of slides)c[kind(s)]++;return c;};
// 書き出し(t=地上タップ・h=ホールド・T=空中のタップ・S=手の決まったスライド[時刻,レーン,幅,高さ,なめらかさ])
const render=notes=>{const items=notes.slice().sort((a,b)=>startOf(a)-startOf(b)||(a.k==='s'?1:-1)).map(n=>
  n.k==='s'?`S(${startOf(n)},${endOf(n)},${JSON.stringify(n.pts)},${n.endFlick?1:0},'${n.hand}')`
  :n.k==='h'?`h(${n.t},${n.sub},${n.w},${n.end})`
  :n.sky?`T(${n.t},${n.sub},${n.w},1)`:`t(${n.t},${n.sub},${n.w},${n.mon||0})`);
  const lines=[];for(let i=0;i<items.length;i+=4)lines.push('  '+items.slice(i,i+4).join(',')+',');
  return lines.join('\n')+'\n';};
// ゲームのノーツの形(レベルの式・両手のシミュレートへ渡す)
const toRuntime=notes=>notes.map(n=>n.k==='s'?{type:'SLIDE',timeMs:startOf(n),endTimeMs:endOf(n),lane:n.pts[0][1],endLane:n.pts[n.pts.length-1][1],subLaneWidth:n.pts[0][2],hand:n.hand,
  slidePoints:n.pts.map(p=>({timeMs:p[0],lane:p[1],subLaneWidth:p[2],sky:p[3]}))}
  :n.k==='h'?{type:'HOLD',timeMs:n.t,endTimeMs:n.end,lane:Math.floor(n.sub/2),subLane:n.sub,subLaneWidth:n.w}
  :{type:'TAP',timeMs:n.t,lane:Math.floor(n.sub/2),subLane:n.sub,subLaneWidth:n.w,...(n.sky?{skyHeight:1}:{}),...(n.mon?{monsterSlot:n.mon}:{})}).sort((a,b)=>a.timeMs-b.timeMs);

if(require.main===module){
  try{
    const songId=argOf('--song');const conf=SONGS[songId];if(!conf)throw new Error(`--song は ${Object.keys(SONGS).join('/')} のどれか`);
    const source=fs.readFileSync(rt0.RUNTIME,'utf8');
    const master=readBlock(source,`${conf.marker}-master`),before=readBlock(source,`${conf.marker}-master`);
    const oldHell=rt0.markerBlock(source,`${conf.marker}-hell`);
    const hell=mix(master,conf);
    const {chartLevel}=require('./rhythm-chart-level.js');
    const rt=toRuntime(hell),level=chartLevel({notes:rt}).level,mLevel=chartLevel({notes:toRuntime(before)}).level;
    const windows=[...(conf.showcase||[]),...(hell.crossWindows||[])],inWin=t=>windows.some(([a,b])=>t>=a&&t<=b);
    const th0=thumbCheck(hell,HELL_LANDSCAPE,conf.beat),outside=th0.issues.filter(i=>i.kind!=='busy'&&!inWin(i.t));
    const th={count:{impossible:outside.filter(i=>i.kind==='impossible').length,cross:outside.filter(i=>i.kind==='cross').length,reach:outside.filter(i=>i.kind==='reach').length},issues:outside};
    console.log(`交差の区間(見せ場 ${(conf.showcase||[]).length}・両手の長押し ${(hell.crossWindows||[]).length}): `+windows.map(([a,b])=>`${(a/1000).toFixed(2)}〜${(b/1000).toFixed(2)}`).join(' / ')
      +` | 区間の中(わざと) ${th0.issues.filter(i=>i.kind!=='busy'&&inWin(i.t)).length}件`);
    const sim=simulateRuntime(rt.filter(n=>!(n.skyHeight>0)&&!(n.slidePoints&&n.slidePoints.some(p=>p.sky>0))));
    const viol=levelSwitchViolations(hell,conf.beat);
    console.log('数:',JSON.stringify(counts(hell)));
    console.log(`Lv.${level}(MASTER Lv.${mLevel}) | 横持ち(高さの差39%・交差の区間の外) 押せない${th.count.impossible}・交差${th.count.cross}・届きにくい${th.count.reach} | 両手のシミュレート(地上だけ) 押せない${sim.impossible} | 同じ親指が1.5拍未満で段を変える ${viol.length}`);
    if(th.count.impossible||th.count.cross||th.count.reach)console.log('  横持ち:',th.issues.filter(i=>i.kind!=='busy').slice(0,12).map(i=>`${(i.t/1000).toFixed(2)} ${i.kind} ${i.what} ${i.why}`).join(' / '));
    if(!args.includes('--write')){console.log('※ --write を付けると HELL のマーカーの内側と Lv. だけを書く');process.exit(0);}
    let next=source.slice(0,oldHell.from)+render(hell)+source.slice(oldHell.to);
    next=next.replace(conf.levelRe,m=>m.replace(/\(\d+,/,`(${level},`));
    // 地上の5難易度(とほかの曲)のマーカーが1バイトも変わっていないこと
    const names=t=>[...t.matchAll(/\/\/ <([a-z0-9-]+)-notes>/g)].map(m=>m[1]).filter(n=>n!==`${conf.marker}-hell`);
    const bad=names(source).filter(n=>(rt0.markerBlock(source,n)||{}).body!==(rt0.markerBlock(next,n)||{}).body);
    if(bad.length)throw new Error(`HELL のほかのマーカーまで変わりそうなので止めた: ${bad.join(' ')}`);
    fs.writeFileSync(rt0.RUNTIME,next);
    // Lv. はゲームに読み込んだ形(道の上へ置き直したあと)で式を通した値にする(rhythm-chart-level-check.js が同じ値か見る)
    const {spawnSync}=require('child_process');
    const probe=spawnSync(process.execPath,['-e',`const {loadRuntimeSongs,chartLevel}=require(${JSON.stringify(path.join(__dirname,'rhythm-chart-level.js'))});
      const s=(loadRuntimeSongs().RHYTHM_PROTO_SONGS||[]).find(x=>x.songId===${JSON.stringify(songId+'_hell_debug')});console.log(chartLevel(s.difficulties.HELL).level);`],{encoding:'utf8'});
    const runtimeLevel=Number(String(probe.stdout).trim());
    let finalLevel=level;
    if(Number.isFinite(runtimeLevel)&&runtimeLevel!==level){finalLevel=runtimeLevel;fs.writeFileSync(rt0.RUNTIME,fs.readFileSync(rt0.RUNTIME,'utf8').replace(conf.levelRe,m=>m.replace(/\(\d+,/,`(${runtimeLevel},`)));}
    console.log(`書いた: ${path.relative(rt0.ROOT,rt0.RUNTIME)} の <${conf.marker}-hell-notes> と HELL の Lv.${finalLevel}(ほかのマーカーは1バイトも変えていない)。この後 node tools/build.js`);
  }catch(e){console.error('止まった:',e.message);process.exit(1);}
}
module.exports={mix,readBlock,render,counts,levelSwitchViolations,toRuntime,HELL_LANDSCAPE,SONGS};
