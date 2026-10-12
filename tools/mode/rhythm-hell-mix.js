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
  crosses:[75960,78550,83419],showcase:[[107900,112600],[130200,132100]]},
  // 風がそよぐ場所(2026-10-12 社長「もう1曲だけ簡単な曲のヘルも作ってみるのが良いと思う」)。空中のノーツを覚える入口なので gentle:
  // 空中は片手だけが空の小節の、拍の頭のタップだけ(スライド・ホールドは地上のまま・両手が空の小節は作らない)。交差の見せ場は置かない。
  // 土台はいま遊ばれている切り替わったあとの譜面(-v4-・RHYTHM_EVENT の after)
  kaze_ga_soyogu:{marker:'kaze-ga-soyogu-v4',zero:209,beat:60000/118.88,levelRe:/const kazeGaSoyoguHellChart=mhChart\((\d+),/,gentle:true}};
const BEAT_GAP=1.5;                      // 同じ親指が段を変えるまでの拍
// 同じ側(レーンの左右)で高さ(地上⇔空中)を変えるまでの間(2026-10-12 社長「HELL の操作性をもっと改良して」・テンポくんの数え方)。
// 親指の振り分けとは別に、画面の左半分・右半分ごとに見る。点は押し始めと、長押し・スライドの終わり(指が離れる高さ)。同時押し(0ms)は両手で取るので数えない
const SIDE_GAP_MS=150;
// 地上から空中へ上げる押し始めは、同じ側の地上の点からこれだけあける(テンポくんの「上下が半分しか届かない」条件・rhythm-chart-hand-rules.js の SKY_RAISE_MS)
const SKY_RAISE_MS=require('./rhythm-chart-hand-rules.js').SKY_RAISE_MS;
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
  // フリック(風がそよぐ場所の MASTER にある)。書いてあった引数のまま書き戻す。HELL では地上のまま(fixedGround)
  const f=(at,sub,w,...rest)=>notes.push({k:'f',t:at,sub,w,args:[at,sub,w,...rest],sky:0});
  new Function('t','h','s','f','return ['+block.body+']')(t,h,s,f);
  return notes;
};
// 画面のどちら側か(ノーツの真ん中のレーン座標が 3 より左なら左)。スライドは始まりと終わりで見る
const sideOf=(n,end)=>{const c=n.k==='s'?n.pts[end?n.pts.length-1:0][1]+0.5:(n.sub+n.w/2)/2;return c<3?'L':'R';};
const startOf=n=>n.k==='s'?n.pts[0][0]:n.t,endOf=n=>n.k==='s'?n.pts[n.pts.length-1][0]:n.k==='h'?n.end:n.t;
const laneAt=(pts,at)=>{if(at<=pts[0][0])return pts[0][1];for(let i=1;i<pts.length;i++)if(at<=pts[i][0]){const r=(at-pts[i-1][0])/Math.max(1,pts[i][0]-pts[i-1][0]);return pts[i-1][1]+(pts[i][1]-pts[i-1][1])*r;}return pts[pts.length-1][1];};

const mix=(master,{zero,beat,crosses=[],gentle=false})=>{
  // 格子へ寄せる。元の譜面に近い時刻(3ms以内)があればその時刻を使う(丸め方が1ms違うと、2本のスライドの間がその瞬間だけ詰まる)
  const chartTimes=[...new Set(master.flatMap(n=>n.k==='s'?n.pts.map(p=>p[0]):[n.t,n.end].filter(x=>x!=null)))].sort((a,b)=>a-b);
  const Q=beat/4,snap=at=>{const g=Math.round(zero+Math.round((at-zero)/Q)*Q);const near=chartTimes.find(x=>Math.abs(x-g)<=3);return near!=null?near:g;};
  const hands=thumbCheck(master,THUMB_PROFILES.landscape,beat).hands;
  const handOf=n=>n.hand||hands.get(n)||((n.k==='s'?n.pts[0][1]+0.5:(n.sub+n.w/2)/2)<3?'L':'R');
  const notes=master.map(n=>n.k==='s'?{...n,hand:handOf(n),pts:n.pts.map(p=>p.slice())}:{...n,hand:handOf(n)});
  // スライドの形: 2拍以上は「降りる・上がる・上がって降りる」を順に。短いものは段の回し方に従う(行き来しない)
  const PROFILES=['down','up','hill'];let slideIndex=0;
  const phraseOf=at=>PHRASE_MODES[((Math.floor((at-zero)/(beat*PHRASE_BEATS))%PHRASE_MODES.length)+PHRASE_MODES.length)%PHRASE_MODES.length];
  // gentle: 拍の頭(3ms 以内)のタップだけを空にする・両手が空の小節は片手(その音の手)だけ
  const onBeat=at=>{const k=(at-zero)/beat;return Math.abs(k-Math.round(k))*beat<=3;};
  const wantSky=(n)=>{const m=phraseOf(startOf(n));
    if(gentle)return n.k==='t'&&onBeat(n.t)&&m===n.hand;
    return m==='both'||m===n.hand;};
  const fixedGround=n=>n.k==='h'||n.k==='f'||!!n.mon||!!n.pin;   // pin: 同じ側の高さの切り替えを避けるため段を固定したタップ(空中のこともある。前後は fix・backFix がその段へそろえる)
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
    // gentle のスライドは地上のまま形を固定する(あとの段の直しで空へ上げない)
    if(n.k==='s'&&gentle){n.profile='ground';n.fixed=true;}
    else if(n.k==='s'){n.profile=endOf(n)-startOf(n)>=2*beat-2?PROFILES[slideIndex++%PROFILES.length]:(wantSky(n)?'sky':'ground');}
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
  // 同じ側(レーンの左右)の続く2点で、150ms 以内に高さが変わる所を直す。空中を減らしすぎないよう、タップは前の点の高さにそろえ(前が空なら空のまま)、
  // タップで直せないときだけスライドの形を替える
  // そのタップをこの段にしても、同じ親指の前後のノーツと段を変える間(1.5拍)を守れるか
  const handOk=(n,level)=>{const list=notes.filter(m=>m.hand===n.hand).sort((x,y)=>startOf(x)-startOf(y)),i=list.indexOf(n),p=list[i-1],q=list[i+1];
    const pEnd=p&&(p.k==='s'?eLv(p):p.k==='h'?0:p.want),qStart=q&&(q.k==='s'?sLv(q):q.k==='h'?0:q.want);
    return !(p&&startOf(n)-endOf(p)<gap&&pEnd!==level)&&!(q&&startOf(q)-endOf(n)<gap&&qStart!==level);};
  const sideFix=()=>{let changed=0;
    const ev=[];for(const n of notes){ev.push({n,at:startOf(n),end:false,side:sideOf(n,false)});if(n.k!=='t')ev.push({n,at:endOf(n),end:true,side:sideOf(n,true)});}
    const lv=e=>e.n.k==='s'?(e.end?eLv(e.n):sLv(e.n)):e.n.k==='h'?0:e.n.want;
    // スライドの片方の端だけ段を替える(もう片方の端と、行き来の形はなるべく残す)
    const reshape=(n,s0,e0)=>s0===1&&e0===0?'down':s0===0&&e0===1?'up':s0===1&&e0===1?'sky':['hill','down','up'].includes(n.profile)?'hill':'ground';
    // 段を固定する(タップは pin、スライドは端の段を決めて形を固定)。固定したものの前後は fix・backFix が親指の決まりどおりその段へそろえる
    // 同じ親指で詰まって(1.5拍未満の間で)続くノーツの鎖の中に、段の違う固定のノーツ(ホールド・モンスター・固定したタップやスライド)があると、
    // 固定どうしで親指の決まりを破り、fix と backFix が行ったり来たりするので固定しない
    const lockedClash=(n,startLevel,endLevel=startLevel)=>{const list=notes.filter(m=>m.hand===n.hand).sort((x,y)=>startOf(x)-startOf(y)),i=list.indexOf(n);
      const locked=m=>m.k==='t'||m.k==='h'?fixedGround(m):m.fixed;
      const lvS=m=>m.k==='s'?sLv(m):m.k==='h'?0:m.want,lvE=m=>m.k==='s'?eLv(m):m.k==='h'?0:m.want;
      for(let j=i-1;j>=0&&startOf(list[j+1])-endOf(list[j])<gap;j--)if(locked(list[j])){if(lvE(list[j])!==startLevel)return true;break;}
      for(let j=i+1;j<list.length&&startOf(list[j])-endOf(list[j-1])<gap;j++)if(locked(list[j])){if(lvS(list[j])!==endLevel)return true;break;}
      return false;};
    const pinTo=(x,level)=>{const n=x.n;
      if(n.k==='t'&&!n.mon&&!n.pin&&!lockedClash(n,level)){n.want=level;n.pin=true;return true;}
      if(n.k==='s'&&!n.fixed){const s0=x.end?sLv(n):level,e0=x.end?level:eLv(n);if(lockedClash(n,s0,e0))return false;n.profile=reshape(n,s0,e0);n.fixed=true;return true;}
      return false;};
    for(const side of ['L','R']){const list=ev.filter(e=>e.side===side).sort((a,b)=>a.at-b.at||(a.end?-1:1));
      for(let i=1;i<list.length;i++){
        // 比べる相手は、同時の点(和音の相手)を飛ばした、その前の点(同じ側で同時に地上と空中を押す和音も、手前の地上から数える)
        let j=i-1;while(j>0&&list[i].at-list[j].at<=2)j--;
        const p=list[j],e=list[i],d=e.at-p.at;
        // 下ろす・長押しの終わりは SIDE_GAP_MS、地上から空中の押し始めへ上げるのは SKY_RAISE_MS
        const limit=!e.end&&lv(p)===0&&lv(e)===1?Math.max(SIDE_GAP_MS,SKY_RAISE_MS):SIDE_GAP_MS;
        if(p.n===e.n||d<=0||d>limit||lv(p)===lv(e))continue;
        // 手前の同時の点のどれかが同じ高さなら、その高さの指がある(和音で押し分けている)ので直さない
        if(list.some(q=>q!==e&&q.n!==e.n&&Math.abs(q.at-p.at)<=2&&lv(q)===lv(e)))continue;
        // まず、タップを相手の段にそろえる(同じ親指の前後とも段がそろうときだけ。前が空なら空のまま残る)
        if(!e.end&&e.n.k==='t'&&!fixedGround(e.n)&&handOk(e.n,lv(p))){e.n.want=lv(p);changed++;continue;}
        if(!p.end&&p.n.k==='t'&&!fixedGround(p.n)&&handOk(p.n,lv(e))){p.n.want=lv(e);changed++;continue;}
        // そろえられないときは、地上の側を空中へ上げて固定する(空中を減らさない)。上げられないもの(ホールド・モンスター・交差の形)なら、空中の側を地上へ固定する
        // どちらで固定するかは、試しに当てて親指の決まりまで直し切ったあとの空中の数が多いほう(固定は1つでも、前後のフレーズごと地上へ連なって下りることがある)
        const [low,high]=lv(e)===1?[p,e]:[e,p];
        const snap=()=>notes.map(n=>[n.want,n.pin,n.profile,n.fixed]),restore=v=>notes.forEach((n,k)=>{[n.want,n.pin,n.profile,n.fixed]=v[k];});
        const skyAmount=()=>notes.reduce((a,n)=>a+(n.k==='t'?n.want:n.k==='s'?sLv(n)+eLv(n):0),0);
        const before=snap();let best=null;
        for(const [x,level] of [[low,1],[high,0]]){
          if(!pinTo(x,level)){restore(before);continue;}
          let settled=false;for(let r=0;r<40;r++)if(!fix()&&!backFix()){settled=true;break;}
          const score=settled?skyAmount():-1;restore(before);
          if(score>=0&&(!best||score>best.score))best={x,level,score};}
        if(best&&pinTo(best.x,best.level))changed++;
      }}
    return changed;};
  for(let i=0;i<40;i++){const a=fix(),b=backFix(),c=sideFix();if(!a&&!b&&!c)break;}
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
// 同じ側(レーンの左右)の続く2点で、SIDE_GAP_MS 以内に高さが変わる所(同時押しは除く)。テンポくんの数え方
const sideSwitches=notes=>{const out=[],lv=(n,e)=>n.k==='s'?(n.pts[e?n.pts.length-1:0][3]>=0.5?1:0):(n.sky?1:0);
  const ev=[];for(const n of notes){ev.push({n,at:startOf(n),e:false});if(n.k!=='t')ev.push({n,at:endOf(n),e:true});}
  for(const side of ['L','R']){const l=ev.filter(x=>sideOf(x.n,x.e)===side).sort((a,b)=>a.at-b.at||(a.e?-1:1));
    for(let i=1;i<l.length;i++){const p=l[i-1],x=l[i],d=x.at-p.at;if(p.n!==x.n&&d>0&&d<=SIDE_GAP_MS&&lv(p.n,p.e)!==lv(x.n,x.e))out.push(x.at);}}
  return out.sort((a,b)=>a-b);};
const counts=notes=>{const slides=notes.filter(n=>n.k==='s');
  const kind=s=>{const hs=s.pts.map(p=>p[3]);return hs.every(x=>x===0)?'地上だけ':hs.every(x=>x>0)?'空だけ':'行き来';};
  const c={地上タップ:notes.filter(n=>n.k==='t'&&!n.sky).length,空タップ:notes.filter(n=>n.k==='t'&&n.sky).length,ホールド:notes.filter(n=>n.k==='h').length,
    スライド:slides.length,地上だけ:0,空だけ:0,行き来:0,モンスター:notes.filter(n=>n.mon).length};
  for(const s of slides)c[kind(s)]++;return c;};
// 書き出し(t=地上タップ・h=ホールド・T=空中のタップ・S=手の決まったスライド[時刻,レーン,幅,高さ,なめらかさ])
const render=notes=>{const items=notes.slice().sort((a,b)=>startOf(a)-startOf(b)||(a.k==='s'?1:-1)).map(n=>
  n.k==='s'?`S(${startOf(n)},${endOf(n)},${JSON.stringify(n.pts)},${n.endFlick?1:0},'${n.hand}')`
  :n.k==='h'?`h(${n.t},${n.sub},${n.w},${n.end})`
  :n.k==='f'?`f(${n.args.join(',')})`
  :n.sky?`T(${n.t},${n.sub},${n.w},1)`:`t(${n.t},${n.sub},${n.w},${n.mon||0})`);
  const lines=[];for(let i=0;i<items.length;i+=4)lines.push('  '+items.slice(i,i+4).join(',')+',');
  // 改行から始める(目印の行 // <…-hell-notes> にくっつくと、最初の行がコメントとして読み飛ばされる・2026-10-12 に4ノーツ落ちていたのを直した)
  return '\n'+lines.join('\n')+'\n';};
// ゲームのノーツの形(レベルの式・両手のシミュレートへ渡す)
const toRuntime=notes=>notes.map(n=>n.k==='s'?{type:'SLIDE',timeMs:startOf(n),endTimeMs:endOf(n),lane:n.pts[0][1],endLane:n.pts[n.pts.length-1][1],subLaneWidth:n.pts[0][2],hand:n.hand,
  slidePoints:n.pts.map(p=>({timeMs:p[0],lane:p[1],subLaneWidth:p[2],sky:p[3]}))}
  :n.k==='h'?{type:'HOLD',timeMs:n.t,endTimeMs:n.end,lane:Math.floor(n.sub/2),subLane:n.sub,subLaneWidth:n.w}
  :n.k==='f'?{type:'FLICK',timeMs:n.t,lane:Math.floor(n.sub/2),subLane:n.sub,subLaneWidth:n.w}
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
    const ss=sideSwitches(hell);console.log(`同じ側で${SIDE_GAP_MS}ms以内に高さが変わる ${ss.length}件`+(ss.length?': '+ss.map(t=>(t/1000).toFixed(2)).join(' / '):''));
    // 共通の物差し(rhythm-chart-hand-rules.js・検査 rhythm-chart-hand-rules-check.js と同じ数え方)で、ほかの手の決まりも出す(作り方は変えない・目安)
    {const HR=require('./rhythm-chart-hand-rules.js'),res=HR.analyze(rt);
      for(const k of ['skyAfterGround','besideHeldBand'])console.log(`  目安: ${HR.RULE_LABELS[k]} ${res[k].length}件`+(res[k].length?': '+res[k].slice(0,12).map(x=>(x.at/1000).toFixed(2)).join(' / ')+(res[k].length>12?' …':''):''));
      if(res.sideHeightSwitch.length!==ss.length)console.log(`  ※ 共通の物差しでは ${res.sideHeightSwitch.length}件(ゲームの形へ写したあとで数えたため)`);}
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
    // Lv. はゲームに読み込んだ形(道の上へ置き直したあと)で式を通した値にする。社長の値(rhythm-chart-level.js の LEVEL_OVERRIDES)があればそちら(rhythm-chart-level-check.js が同じ値か見る)
    const {spawnSync}=require('child_process');
    const probe=spawnSync(process.execPath,['-e',`const {loadRuntimeSongs,chartLevel}=require(${JSON.stringify(path.join(__dirname,'rhythm-chart-level.js'))});
      const {shownLevel}=require(${JSON.stringify(path.join(__dirname,'rhythm-chart-level.js'))});const s=(loadRuntimeSongs().RHYTHM_PROTO_SONGS||[]).find(x=>x.songId===${JSON.stringify(songId+'_hell_debug')});console.log(shownLevel(s.songId,'HELL',s.difficulties.HELL));`],{encoding:'utf8'});
    const runtimeLevel=Number(String(probe.stdout).trim());
    let finalLevel=level;
    if(Number.isFinite(runtimeLevel)&&runtimeLevel!==level){finalLevel=runtimeLevel;fs.writeFileSync(rt0.RUNTIME,fs.readFileSync(rt0.RUNTIME,'utf8').replace(conf.levelRe,m=>m.replace(/\(\d+,/,`(${runtimeLevel},`)));}
    console.log(`書いた: ${path.relative(rt0.ROOT,rt0.RUNTIME)} の <${conf.marker}-hell-notes> と HELL の Lv.${finalLevel}(ほかのマーカーは1バイトも変えていない)。この後 node tools/build.js`);
  }catch(e){console.error('止まった:',e.message);process.exit(1);}
}
module.exports={mix,readBlock,render,counts,levelSwitchViolations,sideSwitches,toRuntime,HELL_LANDSCAPE,SONGS};
