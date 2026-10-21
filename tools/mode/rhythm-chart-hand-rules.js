#!/usr/bin/env node
// 譜面の「手の決まり」を数える共通の物差し(2026-10-12・オンプくん。社長「譜面製作ツールも今回のことで大きく改良できそうだから更新しといてね」)。
//
//   node tools/mode/rhythm-chart-hand-rules.js --song <曲id> [--diff HELL]   # その譜面の件数と場所
//   node tools/mode/rhythm-chart-hand-rules.js --all                          # 公開曲・試作の枠の全譜面の件数
//
// 【なぜ要るか】HELL(空中のノーツ)と Grievous Lady を作って遊ばせて分かったことを、これから作る譜面と検査に効かせる。
//   どれも「ゲームが読む形のノーツ」(rhythm-chart-level.js の loadRuntimeSongs)だけから数える。親指モデルやボットは使わない。
//
// 【手の分け方】画面の左半分・右半分(ノーツの真ん中のレーン座標が 3 より左なら左手)。テンポくんと数え方をそろえた(2026-10-12)。
//   点は押し始め(TAP・FLICK・HOLD・SLIDE の頭)と、HOLD・SLIDE の終わり(指が離れる所)。同時押し(時間差0)は両手で取るので数えない。
//
// 数えるもの(名前は検査・道具の出力と同じ):
//   sideHeightSwitch … 同じ側の続く2点で、SIDE_GAP_MS 以内に高さ(地上⇔空中)が変わる(#2830。親指で上げきれず落ちやすい)
//   skyAfterGround   … 同じ側の地上の点から SKY_RAISE_MS 以内に、空中のタップ・空中から始まるスライド
//                      (テンポくん #2826・#2840: 上下が半分しか届かない構えだと、ここの空中で MISS が出る。案Aで取れるが、置き方の目安として)
//   besideHeldBand   … 押さえている HOLD・SLIDE と同じ側に、押さえている間にノーツが来て、反対の手もふさがっている
//                      (反対の手も押さえている・反対の側で同時に叩く)。押さえている親指では叩けない(#2843・9/18 の帯の隣の決めごと)
//   fastSameSide     … 同じ側の続く押し始めが FAST_SAME_SIDE_MS 未満(片方の親指で1秒に約11回より速い)。
//                      遅れて叩いたときに次のノーツへ移りやすい並び(9/5 の決めごと。判定の側は直っているので、置き方の目安)
'use strict';
const SIDE_GAP_MS=150;          // 同じ側で高さを変えるまでの間(rhythm-hell-mix.js と同じ値)
const SKY_RAISE_MS=250;         // 地上から空中へ上げるまでの間の目安(テンポくんのボットの「届ききらない」条件と同じ 250ms)
const FAST_SAME_SIDE_MS=90;     // 同じ側の続く押し始めの下限の目安
const SAME_TIME_MS=2;           // これ以内の時間差は同時押し

const num=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
const pointsOf=n=>n.type==='SLIDE'?(n.slidePoints||[]):n.type==='HOLD'&&Array.isArray(n.holdPoints)?n.holdPoints:null;
// その時刻のノーツの真ん中のレーン座標(0〜6)
const centerAt=(n,at)=>{
  const pts=pointsOf(n);
  const one=p=>n.type==='SLIDE'?num(p.lane,num(n.lane,0))+num(p.subLaneWidth,num(n.subLaneWidth,2))/4
    :(num(p.subLane,num(n.lane,0)*2)+num(p.subLaneWidth,num(n.subLaneWidth,2))/2)/2;
  if(!pts||!pts.length)return n.type==='SLIDE'?num(n.lane,0)+num(n.subLaneWidth,2)/4:(num(n.subLane,num(n.lane,0)*2)+num(n.subLaneWidth,2)/2)/2;
  if(at<=pts[0].timeMs)return one(pts[0]);
  for(let i=1;i<pts.length;i++)if(at<=pts[i].timeMs){const a=pts[i-1],b=pts[i],r=(at-a.timeMs)/Math.max(1,b.timeMs-a.timeMs);return one(a)+(one(b)-one(a))*r;}
  return one(pts[pts.length-1]);};
const sideAt=(n,at)=>centerAt(n,at)<3?'L':'R';
// その時刻の高さ(1=空中)。スライドは点の sky、ほかは skyHeight
const levelAt=(n,at)=>{
  if(n.type==='SLIDE'){const pts=n.slidePoints||[];if(!pts.length)return 0;let p=pts[0];for(const q of pts)if(q.timeMs<=at+0.5)p=q;return num(p.sky,0)>=0.5?1:0;}
  return num(n.skyHeight,0)>0?1:0;};
const endOf=n=>n.type==='HOLD'||n.type==='SLIDE'?num(n.endTimeMs,n.timeMs):n.timeMs;
const isLong=n=>n.type==='HOLD'||n.type==='SLIDE';

// 押し始めと長押しの終わりの点の一覧
const eventsOf=notes=>{const ev=[];
  for(const n of notes){if(!n||!Number.isFinite(n.timeMs))continue;
    ev.push({n,at:n.timeMs,end:false,side:sideAt(n,n.timeMs),level:levelAt(n,n.timeMs)});
    if(isLong(n)){const e=endOf(n);ev.push({n,at:e,end:true,side:sideAt(n,e),level:levelAt(n,e)});}}
  return ev.sort((a,b)=>a.at-b.at||(a.end?-1:1));};
const bySide=(ev,side)=>ev.filter(e=>e.side===side);

// 同じ側で、その点より前のいちばん近い時刻の点(同時のものはまとめて)。同じノーツの点と、同時押し(SAME_TIME_MS 以内)は除く
const previousGroup=(l,i)=>{const e=l[i];let j=i-1;
  while(j>=0&&(l[j].n===e.n||e.at-l[j].at<=SAME_TIME_MS))j--;
  if(j<0)return null;const at=l[j].at,group=[];
  for(let k=j;k>=0&&at-l[k].at<=SAME_TIME_MS;k--)if(l[k].n!==e.n)group.push(l[k]);
  return {at,group};};
// 手前の同時の点のどれかが同じ高さなら、その高さの指がある(和音で地上と空中を押し分けている・2026-10-12)ので切り替えに数えない
const sideHeightSwitch=(notes,gap=SIDE_GAP_MS)=>{const out=[],ev=eventsOf(notes);
  for(const side of ['L','R']){const l=bySide(ev,side);
    for(let i=1;i<l.length;i++){const e=l[i],prev=previousGroup(l,i);if(!prev)continue;const d=e.at-prev.at;
      if(d<=gap&&!prev.group.some(p=>p.level===e.level))out.push({at:e.at,side,gapMs:Math.round(d),from:e.level?'地上':'空中',to:e.level?'空中':'地上'});}}
  return out.sort((a,b)=>a.at-b.at);};

const skyAfterGround=(notes,gap=SKY_RAISE_MS)=>{const out=[],ev=eventsOf(notes);
  for(const side of ['L','R']){const l=bySide(ev,side);
    for(let i=1;i<l.length;i++){const e=l[i];if(e.end||e.level!==1)continue;
      const prev=previousGroup(l,i);if(!prev)continue;const d=e.at-prev.at;
      if(d<=gap&&prev.group.every(p=>p.level===0))out.push({at:e.at,side,gapMs:Math.round(d),what:e.n.type==='SLIDE'?'空中から始まるスライド':'空中のタップ'});}}
  return out.sort((a,b)=>a.at-b.at);};

const besideHeldBand=notes=>{const out=[],longs=notes.filter(isLong);
  for(const h of longs){const a=h.timeMs,b=endOf(h);
    for(const n of notes){if(n===h||n.timeMs<=a+SAME_TIME_MS||n.timeMs>=b-SAME_TIME_MS)continue;
      const side=sideAt(h,n.timeMs);if(sideAt(n,n.timeMs)!==side)continue;
      const other=side==='L'?'R':'L';
      // 反対の手がふさがっているか: 反対の側で押さえている長押し、または反対の側で同時に叩くノーツ
      const heldOther=longs.some(m=>m!==h&&m!==n&&m.timeMs<n.timeMs-SAME_TIME_MS&&endOf(m)>n.timeMs+SAME_TIME_MS&&sideAt(m,n.timeMs)===other);
      const tapOther=notes.some(m=>m!==n&&m!==h&&Math.abs(m.timeMs-n.timeMs)<=SAME_TIME_MS&&sideAt(m,m.timeMs)===other);
      if(heldOther||tapOther)out.push({at:n.timeMs,side,held:`${h.type} ${a}〜${b}`,why:heldOther?'反対の手も押さえている':'反対の側で同時に叩く'});}}
  return out.sort((a,b)=>a.at-b.at);};

const fastSameSide=(notes,gap=FAST_SAME_SIDE_MS)=>{const out=[],ev=eventsOf(notes).filter(e=>!e.end);
  for(const side of ['L','R']){const l=bySide(ev,side);
    for(let i=1;i<l.length;i++){const d=l[i].at-l[i-1].at;if(d>SAME_TIME_MS&&d<gap)out.push({at:l[i].at,side,gapMs:Math.round(d)});}}
  return out.sort((a,b)=>a.at-b.at);};

// 長押し中の手は使えない、として手を割り振る(2026-10-12 テンポくん「片方の手が長押し中で、もう片方の手が両側を受け持つ所が見えない」)。
//   長押し(HOLD・SLIDE)を押さえている手は、その間ほかのノーツを叩けない。押さえている間に来るノーツは、レーンの側に関係なく反対の手。
//   長押しの手は、書いてあればその手(hand)、無ければ始まりのレーンの側。始まりの時にもう片方の長押しを押さえていれば、その反対の手。
//   両手とも押さえているときはレーンの側のまま。点は押し始めと長押しの終わり(終わりは押さえていた手)
const handEventsOf=notes=>{
  const sorted=notes.filter(n=>n&&Number.isFinite(n.timeMs)).slice().sort((a,b)=>a.timeMs-b.timeMs);
  const held=[];const handOf=new Map();
  for(const n of sorted){
    for(let i=held.length-1;i>=0;i--)if(endOf(held[i])<=n.timeMs+SAME_TIME_MS)held.splice(i,1);
    const busy=held.filter(h=>h!==n&&h.timeMs<n.timeMs-SAME_TIME_MS).map(h=>handOf.get(h));
    let hand=sideAt(n,n.timeMs);
    if(isLong(n)&&(n.hand==='L'||n.hand==='R'))hand=n.hand;
    else if(busy.length===1)hand=busy[0]==='L'?'R':'L';
    handOf.set(n,hand);
    if(isLong(n))held.push(n);
  }
  const ev=[];
  for(const n of sorted){const hand=handOf.get(n);
    ev.push({n,at:n.timeMs,end:false,hand,level:levelAt(n,n.timeMs)});
    if(isLong(n)){const e=endOf(n);ev.push({n,at:e,end:true,hand,level:levelAt(n,e)});}}
  return ev.sort((a,b)=>a.at-b.at||(a.end?-1:1));};
// 長押し中の手を使えないとして割り振った手で、150ms 以内の高さの切り替え・地上から 250ms 以内の空中を数える。
// レーンの左右で数える sideHeightSwitch・skyAfterGround で見つかる所は除く(この割り振りで新しく見える所だけ)
const heldHandSwitch=notes=>{const out=[],ev=handEventsOf(notes);
  const seen=new Set([...sideHeightSwitch(notes),...skyAfterGround(notes)].map(x=>x.at));
  for(const hand of ['L','R']){const l=ev.filter(e=>e.hand===hand);
    for(let i=1;i<l.length;i++){const e=l[i],prev=previousGroup(l,i);if(!prev)continue;const d=e.at-prev.at;
      const raise=!e.end&&e.level===1&&prev.group.every(p=>p.level===0);
      const limit=raise?Math.max(SIDE_GAP_MS,SKY_RAISE_MS):SIDE_GAP_MS;
      if(d<=limit&&!prev.group.some(p=>p.level===e.level)&&!seen.has(e.at))
        out.push({at:e.at,side:hand,gapMs:Math.round(d),from:e.level?'地上':'空中',to:e.level?'空中':'地上'});}}
  return out.sort((a,b)=>a.at-b.at);};

// 地上と空中の入り乱れ(2026-10-21 社長「地上と空中が近辺で入り混じってるのがあるけどこれかなり難易度高い」「空中地上は基本は指を離した位置に置くのが基本」)。
//   押し始めの点を時刻の順に見て、直前(同時押しはまとめる)と高さが違い、MIXED_GAP_MS 以内に来るものを分ける。手は handEventsOf の割り振り
//   near  … 同じ手が、直前に叩いた・離した位置から MIXED_NEAR_LANES 以内で高さを変える(指を離した位置へ持ち上げる・下ろす。自然な形)
//   far   … 同じ手が、それより遠い所で高さを変える(入り乱れ)
//   cross … 違う手が、直前の点から MIXED_CROSS_LANES 以内の近い所で高さを変える(近くで地上と空中が交互に来る。入り乱れ)
//   違う手が離れた所で高さを変えるもの(左手は地上・右手は空中で、それぞれの場所で叩く)は数えない
const MIXED_GAP_MS=250,MIXED_NEAR_LANES=1,MIXED_CROSS_LANES=1.5;
const skyMixedSwitch=(notes,{gapMs=MIXED_GAP_MS,nearLanes=MIXED_NEAR_LANES,crossLanes=MIXED_CROSS_LANES}={})=>{
  const ev=handEventsOf((notes||[]).filter(n=>n&&Number.isFinite(n.timeMs))).filter(e=>!e.end),out=[];
  for(let i=0;i<ev.length;i++){const e=ev[i];let j=i-1;while(j>=0&&e.at-ev[j].at<=SAME_TIME_MS)j--;if(j<0)continue;
    const p=ev[j];if(e.at-p.at>gapMs||p.level===e.level)continue;
    const pos=centerAt(e.n,e.at),dPrev=Math.abs(pos-centerAt(p.n,p.at));
    const kind=p.hand===e.hand?(dPrev<=nearLanes?'near':'far'):(dPrev<=crossLanes?'cross':null);
    if(kind)out.push({at:e.at,kind,hand:e.hand,note:e.n,prev:p.n,lanes:Math.round(dPrev*100)/100,gapMs:Math.round(e.at-p.at),level:e.level?'空中':'地上'});}
  return out;};
const SKY_MIXED_LABEL='地上と空中の入り乱れ(250ms以内に、離した位置から遠い所・近くの別の手で高さが変わる)';
// 見分けにくさ(2026-10-21 社長「見分けづらいってのが相当難易度高いんだよ」)。
//   同じ左右の位置(画面の上で重なって見える範囲)へ、短い間に高さの違うノーツが続く・同時に見えていると、どちらの高さか一瞬で読み分けられない。
//   押し始めの点どうしで、CONFUSE_GAP_MS 以内・横の重なり(真ん中の差が2つの幅の半分の和以下)・高さが違う組を拾う。
//   近いほど・短いほど重い(score 0〜1)。形が同じ(タップどうし・長押しどうし)で高さだけが違う組は重く、形が違えば CONFUSE_SHAPE_RELIEF 倍に軽くする。
//   同じ手が1つ前に離した位置から1レーン以内で高さを変える(指を離した位置へ・自然な形)は数えない。1つのノーツにはいちばん重い組だけを付ける
const CONFUSE_GAP_MS=500,CONFUSE_SHAPE_RELIEF=.6;
const widthOf=n=>num(n.subLaneWidth,2)/2;
const shapeOf=n=>n.type==='TAP'||n.type==='FLICK'?'tap':'long';
const skyConfusable=(notes,{gapMs=CONFUSE_GAP_MS}={})=>{
  const ev=handEventsOf((notes||[]).filter(n=>n&&Number.isFinite(n.timeMs))),starts=ev.filter(e=>!e.end),out=[];
  // その手が最後に触った点(同じ時刻に2つ以上あれば、全部)。並び順で答えが変わらないように、同時の点はまとめて返す
  //   (2026-10-21 Journey の HELL: 1913ms に地上 sub4 と空中 sub0 が同時にあり、ゲームの形と道具の形で並びが逆だったので数がずれた)
  const lastOfHand=(hand,at,self)=>{let best=[];for(const x of ev){if(x.at>=at-SAME_TIME_MS)break;if(x.hand!==hand||x.n===self)continue;
    if(best.length&&x.at-best[0].at>SAME_TIME_MS)best=[];best.push(x);}return best;};
  for(let i=0;i<starts.length;i++){const e=starts[i],pos=centerAt(e.n,e.at);let top=null;
    // 相手は、前の点(500ms 以内)と同時の点。同時の組は並び順によらず、空中の側に1つ数える(地上の側では数えない)
    let lo=i;while(lo>0&&e.at-starts[lo-1].at<=gapMs)lo--;let hi=i;while(hi+1<starts.length&&starts[hi+1].at-e.at<=SAME_TIME_MS)hi++;
    for(let j=lo;j<=hi;j++){if(j===i)continue;const p=starts[j],dt=Math.max(0,e.at-p.at);if(p.level===e.level||p.n===e.n)continue;
      if(Math.abs(e.at-p.at)<=SAME_TIME_MS&&!(e.level>p.level))continue;
      const reach=(widthOf(e.n)+widthOf(p.n))/2,d=Math.abs(pos-centerAt(p.n,p.at));if(d>reach)continue;
      if(p.hand===e.hand&&dt>SAME_TIME_MS){const last=lastOfHand(e.hand,e.at,e.n);
        const from=last.find(x=>x.n===p.n);if(from&&Math.abs(pos-centerAt(p.n,from.at))<=MIXED_NEAR_LANES)continue;}
      const same=shapeOf(e.n)===shapeOf(p.n),score=(1-.5*d/reach)*(1-.6*dt/gapMs)*(same?1:CONFUSE_SHAPE_RELIEF);
      if(!top||score>top.score)top={at:e.at,note:e.n,prev:p.n,score:Math.round(score*100)/100,gapMs:Math.round(dt),lanes:Math.round(d*100)/100,sameShape:same,level:e.level?'空中':'地上'};}
    if(top)out.push(top);}
  return out;};
const SKY_CONFUSE_LABEL='見分けにくい所(500ms以内に、重なって見える近いレーンへ高さの違うノーツ)';
// 水平クロス(2026-10-13 社長「ヘル譜面で水平クロスは意味ないから、クロスのときは上下を活用してほしい」)。
//   2本の長押し(HOLD・SLIDE)が同じ時間に押さえられていて、左右が入れ替わる瞬間に、2本が同じ高さ(地上どうし・空中どうし)のもの。
//   HELL の交差は上下に分ける(交わる瞬間は片方が空中・片方が地上)。上下に分かれていれば親指の先どうしは当たらない。
//   公開中の地上だけの譜面(交差の持ち替え #2770 で遊ぶ形)は数えない。空中のある譜面(HELL)だけで使い、0を見張る(rhythm-chart-hand-rules-check.js)
const FLAT_CROSS_STEP_MS=10;
const hasSky=notes=>(notes||[]).some(n=>Number(n.skyHeight)>0||(n.slidePoints||[]).some(p=>Number(p.sky)>0));
const flatCross=notes=>{const out=[],longs=(notes||[]).filter(isLong);
  for(let i=0;i<longs.length;i++)for(let j=i+1;j<longs.length;j++){const a=longs[i],b=longs[j];
    const s=Math.max(a.timeMs,b.timeMs),e=Math.min(endOf(a),endOf(b));if(e-s<FLAT_CROSS_STEP_MS)continue;
    let prev=0;
    for(let t=s;t<=e;t+=FLAT_CROSS_STEP_MS){const d=centerAt(a,t)-centerAt(b,t),sg=Math.abs(d)<1e-6?0:Math.sign(d);
      if(sg&&prev&&sg!==prev){const la=levelAt(a,t),lb=levelAt(b,t);
        if(la===lb)out.push({at:t,side:centerAt(a,t)<3?'L':'R',level:la?'空中どうし':'地上どうし',pair:`${a.type} ${a.timeMs}〜${endOf(a)} × ${b.type} ${b.timeMs}〜${endOf(b)}`});}
      if(sg)prev=sg;}}
  return out.sort((x,y)=>x.at-y.at);};
// 押さえている帯の中のノーツ(2026-10-13 社長「ホールド・スライド中に同じところにノーツを出すのはやめたほうがいい」
//   「地上と空中なら同じ位置でも良いけど、地上同士・空中同士は無理。半レーン被りならまだしも。ただ、1レーンのノーツに半レーン被りはかなり厳しい」)。
//   長押し(HOLD・SLIDE)を押さえている最中(始まりと終わりの間)に、同じ高さ(地上どうし・空中どうし)で、その時刻の帯の幅と横に重なる位置へ来る別のノーツ。
//   スライドはその時刻にいる位置で見る。高さが違えば(地上の押さえと空中のノーツ)同じ位置でもよい(数えない)。幅はレーン単位(サブレーン2つで1レーン)。
//   kind(重なり方):
//     overlap   … 半レーンより深く重なる                                   → 置かない
//     halfThin  … 半レーンまでの重なりで、押さえている帯か来るノーツが幅1レーン以下 → 置かない(「かなり厳しい」)
//     halfWide  … 半レーンまでの重なりで、両方とも幅1.5レーン以上                → 許す(数だけ出す。幅1.5も許す・2026-10-13 社長)
//   置かない形(blocked)は、HELL(rhythm-hell-mix.js)と新曲の5難易度(rhythm-chart-v3-generate.js)が作らず、rhythm-chart-hand-rules-check.js が止める
const widthAt=(n,at)=>{const pts=pointsOf(n),w=p=>num(p&&p.subLaneWidth!=null?p.subLaneWidth:undefined,num(n.subLaneWidth,2))/2;
  if(!pts||!pts.length)return w(null);let p=pts[0];for(const q of pts)if(q.timeMs<=at+0.5)p=q;return w(p);};
const spanAt=(n,at)=>{const c=centerAt(n,at),w=widthAt(n,at);return [c-w/2,c+w/2];};
const HELD_BAND_HALF=.5,EPS=1e-6;
const HELD_BAND_KINDS=Object.freeze({overlap:'重なる',halfThin:'半レーン(幅1が絡む)',halfWide:'半レーン(両方幅1.5以上・許す)'});
const heldBandKind=(overlap,wh,wn)=>overlap>HELD_BAND_HALF+EPS?'overlap':Math.min(wh,wn)<=1+EPS?'halfThin':'halfWide';
const onHeldBand=notes=>{const out=[],list=(notes||[]).filter(n=>n&&Number.isFinite(n.timeMs)),longs=list.filter(isLong);
  for(const h of longs){const a=h.timeMs,b=endOf(h);
    for(const n of list){if(n===h||n.timeMs<=a+SAME_TIME_MS||n.timeMs>=b-SAME_TIME_MS)continue;
      if(levelAt(h,n.timeMs)!==levelAt(n,n.timeMs))continue;
      const [h0,h1]=spanAt(h,n.timeMs),[n0,n1]=spanAt(n,n.timeMs),overlap=Math.min(h1,n1)-Math.max(h0,n0);
      if(overlap>EPS){const kind=heldBandKind(overlap,h1-h0,n1-n0);
        out.push({at:n.timeMs,side:sideAt(n,n.timeMs),type:n.type,note:n,level:levelAt(n,n.timeMs)?'空中':'地上',kind,blocked:kind!=='halfWide',
        lanes:`${n0.toFixed(2)}〜${n1.toFixed(2)}`,held:`${h.type} ${a}〜${b}`,heldNote:h,heldSpan:[h0,h1],heldLanes:`${h0.toFixed(2)}〜${h1.toFixed(2)}`,overlap:Math.round(overlap*100)/100});}}}
  return out.sort((x,y)=>x.at-y.at);};
const heldBandBlocked=notes=>onHeldBand(notes).filter(x=>x.blocked);
const ON_HELD_BAND_LABEL='押さえている帯の中(同じ高さで重なる・幅1が絡む半レーン)に別のノーツ(置かない)';
// 置かない形のタップ・フリックを、帯の外へ置き直す(ゲームの形のノーツをその場で書き換える。HELL と新曲の5難易度の道具が使う)。
//   時刻はそのまま(音に合わせたまま)。向きは帯を押さえていない手の側(押さえている手の側へ出すと、空いている親指が押さえている親指を越えて交差する)、入らなければ反対の向き。
//   帯の端から半レーン(サブレーン1つ)あけて、入らなければあけずに・幅を詰めて(幅2まで)。置き直した先は同じ時刻のノーツ・同じ高さの帯と少しも重ならない所。
//   それでも入らないものは、canRemove(n) なら取り除き、canMirror(n) なら左右を反対側へ写す(モンスターノーツ)。どれもできなければ残す(検査が止める)
//   keepWidth: 幅を詰めない(公開中の譜面を直すとき。置き場所だけ変える)。gaps: 帯の端からあける量(サブレーン)の候補の順
const fixHeldBand=(notes,{canRemove=()=>true,canMirror=()=>false,lanes=12,keepWidth=false,gaps=[1,0]}={})=>{const done={moved:0,removed:[],mirrored:0,left:0},stuck=new Set();
  for(let r=0;r<400;r++){const bad=heldBandBlocked(notes).find(v=>(v.type==='TAP'||v.type==='FLICK')&&!stuck.has(v.note));if(!bad)break;
    const n=bad.note,[h0,h1]=bad.heldSpan,hh=bad.heldNote,holdHand=hh.hand==='L'||hh.hand==='R'?hh.hand:sideAt(hh,hh.timeMs),level=levelAt(n,n.timeMs);
    const fits=(sub,w)=>{if(sub<0||sub+w>lanes)return false;const a=sub/2,b=(sub+w)/2;
      for(const m of notes){if(m===n||levelAt(m,n.timeMs)!==level)continue;
        const covers=Math.abs(m.timeMs-n.timeMs)<=SAME_TIME_MS||isLong(m)&&m.timeMs<n.timeMs-SAME_TIME_MS&&n.timeMs<endOf(m)-SAME_TIME_MS;if(!covers)continue;
        const [m0,m1]=spanAt(m,n.timeMs);if(Math.min(b,m1)-Math.max(a,m0)>EPS)return false;}
      return true;};
    const w0=num(n.subLaneWidth,2);let placed=false;
    for(const away of holdHand==='L'?[1,-1]:[-1,1])for(const gap of gaps)for(const w of keepWidth?[w0]:[...new Set([w0,Math.max(2,w0-1),2])]){if(placed)break;
      const sub=away>0?Math.ceil(h1*2-EPS)+gap:Math.floor(h0*2+EPS)-gap-w;
      if(fits(sub,w)){n.subLane=sub;n.subLaneWidth=w;n.lane=Math.floor(sub/2);placed=true;}}
    if(placed){done.moved++;continue;}
    const mirror=lanes-num(n.subLane,0)-w0;
    if(canRemove(n)){notes.splice(notes.indexOf(n),1);done.removed.push(n);}
    else if(canMirror(n)&&fits(mirror,w0)){n.subLane=mirror;n.lane=Math.floor(mirror/2);done.mirrored++;stuck.add(n);}
    else{stuck.add(n);done.left++;}}
  return done;};
const FLAT_CROSS_LABEL='同じ高さのまま左右が入れ替わる(水平クロス・HELL は0にする)';
const RULES={sideHeightSwitch,skyAfterGround,besideHeldBand,fastSameSide,heldHandSwitch};
const RULE_LABELS={sideHeightSwitch:`同じ側で${SIDE_GAP_MS}ms以内に高さが変わる`,skyAfterGround:`同じ側の地上から${SKY_RAISE_MS}ms以内に空中`,
  besideHeldBand:'押さえている帯と同じ側で、反対の手もふさがっている',heldHandSwitch:'長押し中の手を使えないとして、反対の手で高さの切り替えが近い',fastSameSide:`同じ側の押し始めが${FAST_SAME_SIDE_MS}ms未満`};
const analyze=notes=>Object.fromEntries(Object.entries(RULES).map(([k,f])=>[k,f(notes||[])]));
const countsOf=notes=>Object.fromEntries(Object.entries(analyze(notes)).map(([k,v])=>[k,v.length]));

module.exports={skyConfusable,CONFUSE_GAP_MS,CONFUSE_SHAPE_RELIEF,SKY_CONFUSE_LABEL,skyMixedSwitch,MIXED_GAP_MS,MIXED_NEAR_LANES,MIXED_CROSS_LANES,SKY_MIXED_LABEL,flatCross,hasSky,FLAT_CROSS_LABEL,onHeldBand,heldBandBlocked,fixHeldBand,spanAt,ON_HELD_BAND_LABEL,HELD_BAND_KINDS,SIDE_GAP_MS,SKY_RAISE_MS,FAST_SAME_SIDE_MS,centerAt,sideAt,levelAt,eventsOf,handEventsOf,heldHandSwitch,sideHeightSwitch,skyAfterGround,besideHeldBand,fastSameSide,RULES,RULE_LABELS,analyze,countsOf};

if(require.main===module){
  const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
  const {loadRuntimeSongs}=require('./rhythm-chart-level.js');const r=loadRuntimeSongs();
  const songs=[...(r.RHYTHM_SONGS||[]),...(r.RHYTHM_PROTO_SONGS||[])];
  if(args.includes('--all')){
    for(const s of songs)for(const [d,c] of Object.entries(s.difficulties||{}))if(c&&Array.isArray(c.notes)){const k=countsOf(c.notes);
      if(Object.values(k).some(Boolean))console.log(`${s.songId}/${d}`.padEnd(40),Object.entries(k).map(([a,b])=>`${a} ${b}`).join(' / '));}
    process.exit(0);}
  const song=songs.find(s=>s.songId===argOf('--song'));
  if(!song){console.error('--song <曲id> か --all を付ける');process.exit(1);}
  const diffs=argOf('--diff')?[argOf('--diff')]:Object.keys(song.difficulties||{});
  for(const d of diffs){const c=song.difficulties[d];if(!c)continue;const res=analyze(c.notes);
    console.log(`== ${song.songId}/${d}`);
    if(hasSky(c.notes)){const fc=flatCross(c.notes);console.log(`  ${FLAT_CROSS_LABEL}: ${fc.length}件`+(fc.length?' — '+fc.slice(0,12).map(x=>`${(x.at/1000).toFixed(2)}(${x.level})`).join(' '):''));}
    {const ob=onHeldBand(c.notes),bl=ob.filter(x=>x.blocked);console.log(`  ${ON_HELD_BAND_LABEL}: ${bl.length}件(`+Object.entries(HELD_BAND_KINDS).map(([k,l])=>`${l} ${ob.filter(x=>x.kind===k).length}`).join('・')+')'
      +(bl.length?' — '+bl.slice(0,12).map(x=>`${(x.at/1000).toFixed(3)} ${x.type} ${x.level} ${x.lanes}(押さえ ${x.held} ${x.heldLanes}・${HELD_BAND_KINDS[x.kind]})`).join(' / '):''));}
    for(const [k,list] of Object.entries(res))console.log(`  ${RULE_LABELS[k]}: ${list.length}件`+(list.length?' — '+list.slice(0,12).map(x=>`${(x.at/1000).toFixed(2)}${x.side}`+(x.gapMs!=null?`(${x.gapMs})`:'')).join(' ')+(list.length>12?' …':''):''));}
}
