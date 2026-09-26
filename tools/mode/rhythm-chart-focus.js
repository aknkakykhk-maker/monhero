// 主役の追跡(2026-09-26・MHB CHART ENGINE Rev.9・ROADMAP の段3)。
//
// 【なぜ要るか】
// 人が譜面を作るときは、すべての音をノーツにしない。その瞬間に耳へ入ってくる層(歌・主旋律・ドラム)を選んで叩かせる。
// Aメロは歌、間奏やドラムのフィルではドラム、サビは両方、のように場面ごとに追う層が移る。
// Rev.7 の作法 layer_follow は、これを「区切りの盛り上がり」だけで決める簡易版だった(静かなら歌、盛り上がっていたら低い打楽器)。
// ここは音の層の解析(rhythm-audio-layers-v3.js の16分ごとの層の強さ)から、小節ごとに実際にどの層が前に出ているかで決める。
//
// 【決め方】
//   ・小節ごとの証拠 = 打楽器の強さ(percussive) − 歌や主旋律の帯の音程楽器の強さ(lead)。
//     どちらも曲の中の順位で 0〜1 にしてあるので、「その曲のいつもより打楽器が前に出ているか」を見ることになる
//   ・状態は3つ: drums(ドラムを追う) / melody(歌・主旋律を追う) / mix(どちらも同じくらい。後押ししない)
//   ・切り替えにコストを付け、曲全体でいちばん筋の通る並びを動的計画法で選ぶ(小節ごとにころころ変えない)。
//     区切りの頭と、区切りの中の4小節ごとの頭では安く切り替えられる(フレーズの境目で追う層が移るのが自然)
// 乱数を使わない。同じ入力なら毎回同じ結果。
'use strict';

const FOCUS_STATES=Object.freeze(['drums','melody','mix']);
// mix を選ぶための下駄(証拠の差がこれより小さい小節は mix が勝つ)
const FOCUS_MIX_MARGIN=.08;
// 切り替えのコスト: フレーズの境目 / それ以外
const FOCUS_SWITCH_AT_BOUNDARY=.05,FOCUS_SWITCH_INSIDE=.6;
// Rev.13: 旋律の音高がほとんど取れない小節(伴奏だけの間奏など)では、歌・主旋律を追いにくくする
//   melodyPresence(小節→旋律の音高が取れている割合)を渡したときだけ効く(Rev.9〜12 は渡さない)
const FOCUS_MELODY_MIN_PRESENCE=.2,FOCUS_NO_MELODY_PENALTY=.3;

// layers: rhythm-audio-layers-v3.js の出力 / bar: 1小節のグリッド数 / sectionStarts: 区切りの頭の小節の集合
// 返り値: {byBar: Map(小節→状態), evidence: Map(小節→証拠)}
const trackFocus=(layers,{bar,sectionStarts=new Set(),firstBar=null,lastBar=null,melodyPresence=null})=>{
  const series=layers&&layers.series;
  if(!series||!Array.isArray(series.percussive)||!Array.isArray(series.lead))return {byBar:new Map(),evidence:new Map()};
  const first=Number(layers.grid.firstGrid)||0;
  const valueAt=(list,grid)=>{const i=grid-first;return i>=0&&i<list.length?list[i]:null;};
  const minBar=firstBar??Math.ceil(first/bar),maxBar=lastBar??Math.floor((first+series.percussive.length-1)/bar);
  const bars=[],evidence=new Map();
  for(let b=minBar;b<=maxBar;b++){
    let p=0,m=0,n=0;
    for(let g=b*bar;g<(b+1)*bar;g++){
      const pv=valueAt(series.percussive,g),mv=valueAt(series.lead,g);
      if(pv==null||mv==null)continue;
      p+=pv;m+=mv;n++;
    }
    const e=n?(p-m)/n:0;
    evidence.set(b,e);
    bars.push(b);
  }
  // フレーズの境目: 区切りの頭、または区切りの頭から4小節ごと
  const starts=[...sectionStarts].sort((a,b)=>a-b);
  const boundary=b=>{
    if(sectionStarts.has(b))return true;
    let start=minBar;for(const s of starts)if(s<=b)start=s;
    return (b-start)%4===0;
  };
  const noMelody=b=>melodyPresence&&melodyPresence.has(b)&&melodyPresence.get(b)<FOCUS_MELODY_MIN_PRESENCE;
  const emissionAt=(state,e,b)=>state==='drums'?e:state==='melody'?-e-(noMelody(b)?FOCUS_NO_MELODY_PENALTY:0):FOCUS_MIX_MARGIN;
  // 動的計画法(得点を最大にする並び)
  let score=FOCUS_STATES.map(state=>emissionAt(state,evidence.get(bars[0])||0,bars[0]));
  const back=[];
  for(let i=1;i<bars.length;i++){
    const e=evidence.get(bars[i])||0,cost=boundary(bars[i])?FOCUS_SWITCH_AT_BOUNDARY:FOCUS_SWITCH_INSIDE;
    const next=[],from=[];
    FOCUS_STATES.forEach((state,s)=>{
      let best=-Infinity,arg=0;
      FOCUS_STATES.forEach((_,t)=>{const v=score[t]-(t===s?0:cost);if(v>best+1e-12){best=v;arg=t;}});
      next.push(best+emissionAt(state,e,bars[i]));from.push(arg);
    });
    score=next;back.push(from);
  }
  const byBar=new Map();
  if(!bars.length)return {byBar,evidence};
  let s=score.indexOf(Math.max(...score));
  for(let i=bars.length-1;i>=0;i--){
    byBar.set(bars[i],FOCUS_STATES[s]);
    if(i>0)s=back[i-1][s];
  }
  return {byBar,evidence};
};

// 追っている層に合う打点ほど大きい後押し(-1〜1)。
//   drums  … 打楽器成分の割合(percussiveShare。その曲の打点の中の順位 0〜1 で渡す)が高い打点を上げ、低い打点を下げる
//   melody … 音程のある打点(pitchHz)と、歌や主旋律の帯が強いグリッドを上げ、音程の無い打楽器だけの打点を下げる
//   mix    … 0
//   (ハイハットの強い位置を上げる後押しも試したが、5曲の MASTER でハイハットの強い位置の打点が 62.1→62.6% にしか動かなかった。
//    MASTER はもともとほぼ全部の打点を拾うので選び直す余地が無い。効かないので入れていない・2026-09-26)
const focusBoost=(state,{percussiveShare=null,pitched=false,lead=null}={})=>{
  if(state==='drums'){
    if(!Number.isFinite(percussiveShare))return 0;
    return Math.max(-1,Math.min(1,(percussiveShare-.5)*2));
  }
  if(state==='melody'){
    let boost=pitched?.6:0;
    if(Number.isFinite(lead))boost+=(lead-.5)*.8;
    if(!pitched&&Number.isFinite(percussiveShare)&&percussiveShare>=.8)boost-=.4;
    return Math.max(-1,Math.min(1,boost));
  }
  return 0;
};

module.exports={FOCUS_MELODY_MIN_PRESENCE,FOCUS_NO_MELODY_PENALTY,FOCUS_STATES,FOCUS_MIX_MARGIN,FOCUS_SWITCH_AT_BOUNDARY,FOCUS_SWITCH_INSIDE,trackFocus,focusBoost};
