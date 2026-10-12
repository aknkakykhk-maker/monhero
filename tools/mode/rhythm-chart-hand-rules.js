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

const sideHeightSwitch=(notes,gap=SIDE_GAP_MS)=>{const out=[],ev=eventsOf(notes);
  for(const side of ['L','R']){const l=bySide(ev,side);
    for(let i=1;i<l.length;i++){const p=l[i-1],e=l[i],d=e.at-p.at;
      if(p.n!==e.n&&d>SAME_TIME_MS&&d<=gap&&p.level!==e.level)out.push({at:e.at,side,gapMs:Math.round(d),from:p.level?'空中':'地上',to:e.level?'空中':'地上'});}}
  return out.sort((a,b)=>a.at-b.at);};

const skyAfterGround=(notes,gap=SKY_RAISE_MS)=>{const out=[],ev=eventsOf(notes);
  for(const side of ['L','R']){const l=bySide(ev,side);
    for(let i=1;i<l.length;i++){const e=l[i];if(e.end||e.level!==1)continue;
      // 同じ側で、前にある地上の点のうち最も近いもの(同じノーツ・同時押しは除く)
      for(let j=i-1;j>=0;j--){const p=l[j],d=e.at-p.at;if(d>gap)break;if(p.n===e.n||d<=SAME_TIME_MS)continue;
        if(p.level===0){out.push({at:e.at,side,gapMs:Math.round(d),what:e.n.type==='SLIDE'?'空中から始まるスライド':'空中のタップ'});}break;}}}
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

const RULES={sideHeightSwitch,skyAfterGround,besideHeldBand,fastSameSide};
const RULE_LABELS={sideHeightSwitch:`同じ側で${SIDE_GAP_MS}ms以内に高さが変わる`,skyAfterGround:`同じ側の地上から${SKY_RAISE_MS}ms以内に空中`,
  besideHeldBand:'押さえている帯と同じ側で、反対の手もふさがっている',fastSameSide:`同じ側の押し始めが${FAST_SAME_SIDE_MS}ms未満`};
const analyze=notes=>Object.fromEntries(Object.entries(RULES).map(([k,f])=>[k,f(notes||[])]));
const countsOf=notes=>Object.fromEntries(Object.entries(analyze(notes)).map(([k,v])=>[k,v.length]));

module.exports={SIDE_GAP_MS,SKY_RAISE_MS,FAST_SAME_SIDE_MS,centerAt,sideAt,levelAt,eventsOf,sideHeightSwitch,skyAfterGround,besideHeldBand,fastSameSide,RULES,RULE_LABELS,analyze,countsOf};

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
    for(const [k,list] of Object.entries(res))console.log(`  ${RULE_LABELS[k]}: ${list.length}件`+(list.length?' — '+list.slice(0,12).map(x=>`${(x.at/1000).toFixed(2)}${x.side}`+(x.gapMs!=null?`(${x.gapMs})`:'')).join(' ')+(list.length>12?' …':''):''));}
}
