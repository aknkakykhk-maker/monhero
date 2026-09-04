#!/usr/bin/env node
// 譜面の「形」の語彙。レーンの決め方を、条件を満たす置き場所探しから**形を当てる**へ変える。
//
// 【なぜ要るか】(docs/spec/RHYTHM_CHART_DESIGN.md 3章)
// レーンを「乱数で」「使用回数が少ない順で」決めると、押せるし音とも合っているのに
// **まったく読めない譜面**になる。人が作った譜面が読めるのは、限られた「形」の
// 組み合わせでできていて、次に来る形が予測できるから。
//
// ここでは形を「相対レーンの並び」で持つ。実際のレーンは 起点 + 並び[i]。
// 形を選ぶのは、その区切りの中で**音の高さがどう動いたか**。
// 音が上がれば階段、下がれば逆階段、山なら折り返し——と、画面の動きを音の動きに合わせる。
//
//   node tools/mode/rhythm-chart-v3-patterns.js   # 語彙と選び方を並べて見る
'use strict';

const LANES=5;

// --- 形の語彙 ---
// lanes(length) … 相対レーンの並び（0起点。負にもなる）
// centered      … 中央に置くことを前提にした形（起点は中央寄りを優先する）
const PATTERNS=Object.freeze([
  // 階段: 音階が動くところ。いちばん読みやすい形
  Object.freeze({id:'stair_up',   minLength:3, maxLength:5,
    lanes:length=>Array.from({length},(_,i)=>i)}),
  Object.freeze({id:'stair_down', minLength:3, maxLength:5,
    lanes:length=>Array.from({length},(_,i)=>-i)}),
  // 2つ飛ばしの階段: 大きく動くメロディに当てる
  Object.freeze({id:'stair2_up',  minLength:3, maxLength:3,
    lanes:length=>Array.from({length},(_,i)=>i*2)}),
  Object.freeze({id:'stair2_down',minLength:3, maxLength:3,
    lanes:length=>Array.from({length},(_,i)=>-i*2)}),
  // 折り返し: フレーズの山・谷
  Object.freeze({id:'fold_up',    minLength:3, maxLength:7,
    lanes:length=>{const top=Math.floor(length/2);return Array.from({length},(_,i)=>i<=top?i:2*top-i);}}),
  Object.freeze({id:'fold_down',  minLength:3, maxLength:7,
    lanes:length=>{const top=Math.floor(length/2);return Array.from({length},(_,i)=>i<=top?-i:i-2*top);}}),
  // 交互: 左右で受け合うリズム。離れているほど「振られる」
  Object.freeze({id:'alternate2', minLength:2, maxLength:8,
    lanes:length=>Array.from({length},(_,i)=>i%2===0?0:2)}),
  Object.freeze({id:'alternate3', minLength:2, maxLength:8,
    lanes:length=>Array.from({length},(_,i)=>i%2===0?0:3)}),
  Object.freeze({id:'alternate4', minLength:2, maxLength:8,
    lanes:length=>Array.from({length},(_,i)=>i%2===0?0:4)}),
  // トリル: 隣どうしの交互。速い区間の基本形
  Object.freeze({id:'trill',      minLength:2, maxLength:8,
    lanes:length=>Array.from({length},(_,i)=>i%2)}),
  // 縦連: 同じ場所の連打。1本の指で叩ける速さのときだけ選ぶ
  Object.freeze({id:'jack',       minLength:2, maxLength:4,
    lanes:length=>Array.from({length},()=>0)}),
  // ゆれ: 中央を挟んで左右へ1レーンずつ揺れる。跳びが1なのでEASYでも置ける。
  // トリル（0,1,0,1）は片側にしか行かないので、EASYの見た目が「右へ寄る交互」ばかりに
  // なっていた。こちらは左右へ均等に振れるので、同じ跳び1でも印象が変わる。
  Object.freeze({id:'bounce',     minLength:3, maxLength:6, centered:true,
    lanes:length=>{const base=[0,1,0,-1,0,1];return Array.from({length},(_,i)=>base[i%base.length]);}}),
  // 踊り場つき階段: 同じ場所を2つ続けてから次のレーンへ上がる。
  // 同じ場所の連打を含むので、1本の指で叩ける速さのときだけ（jackLike）。
  Object.freeze({id:'plateau_up',  minLength:4, maxLength:6, jackLike:true,
    lanes:length=>{const base=[0,0,1,1,2,2];return Array.from({length},(_,i)=>base[i%base.length]);}}),
  Object.freeze({id:'plateau_down',minLength:4, maxLength:6, jackLike:true,
    lanes:length=>{const base=[0,0,-1,-1,-2,-2];return Array.from({length},(_,i)=>base[i%base.length]);}}),
  // 開き: 中央から外へ広がる（盛り上がり）
  Object.freeze({id:'expand',     minLength:3, maxLength:5, centered:true,
    lanes:length=>Array.from({length},(_,i)=>i%2===0?-Math.ceil(i/2):Math.ceil(i/2))}),
  // 閉じ: 外から中央へ集まる（収束）
  Object.freeze({id:'contract',   minLength:3, maxLength:5, centered:true,
    lanes:length=>{const half=Math.ceil((length-1)/2);
      return Array.from({length},(_,i)=>i%2===0?-(half-Math.floor(i/2)):(half-Math.floor(i/2)));}}),
  // ジグザグ: 外と内を振りながら進む。高難易度の忙しい区間。
  // 「閉じ」と同じ並びにならないよう、大きく振る側と小さく振る側を交互にする。
  Object.freeze({id:'zigzag',     minLength:4, maxLength:6, centered:true,
    lanes:length=>{const base=[-2,1,-1,2,0,-2];return Array.from({length},(_,i)=>base[i%base.length]);}}),
  // 小さいジグザグ: 右へ左へ振りながら少しずつ上がる。跳びが2までなのでHARDでも置ける。
  // zigzag（跳び3）はEXPERT以上でしか組み立てられず、HARDの譜面が階段と交互だけに
  // なってしまっていたので、その1段下を用意した。
  Object.freeze({id:'zigzag2_up',  minLength:4, maxLength:6,
    lanes:length=>{const base=[0,2,1,3,2,4];return Array.from({length},(_,i)=>base[i%base.length]);}}),
  Object.freeze({id:'zigzag2_down',minLength:4, maxLength:6,
    lanes:length=>{const base=[0,-2,-1,-3,-2,-4];return Array.from({length},(_,i)=>base[i%base.length]);}}),
  // 交差ステップ: 外側と内側を大きく飛び越えながら進む。
  // 触る場所が「右→左→右」と本体を追い越していくので、指を交差させて取ることになる。
  // 跳びが3なのでEXPERT以上でしか組み立てられない（＝難易度の精査は跳びの上限で効く）。
  Object.freeze({id:'cross_step_up',  minLength:4, maxLength:5,
    lanes:length=>{const base=[0,3,1,4,2];return Array.from({length},(_,i)=>base[i%base.length]);}}),
  Object.freeze({id:'cross_step_down',minLength:4, maxLength:5,
    lanes:length=>{const base=[0,-3,-1,-4,-2];return Array.from({length},(_,i)=>base[i%base.length]);}}),
  // 端振り: 端から端へ大きく振ってから内側へ収める。跳び4なのでMASTERだけ。
  Object.freeze({id:'edge_swing', minLength:3, maxLength:6,
    lanes:length=>{const base=[0,4,1,3,2,4];return Array.from({length},(_,i)=>base[i%base.length]);}}),
]);
// 直近に使った形を避けるとき、候補の上位いくつまでを見るか。
// 大きくすると語彙は散るが、音の動きに合っていない形まで選ばれてしまう。
const FRESH_WINDOW=4;
const PATTERN_BY_ID=Object.freeze(Object.fromEntries(PATTERNS.map(p=>[p.id,p])));

// その長さで実際に何レーン跳ぶか（難易度の maxLaneStep と比べるのに使う）
const maxStepOf=offsets=>{
  let step=0;
  for(let i=1;i<offsets.length;i++)step=Math.max(step,Math.abs(offsets[i]-offsets[i-1]));
  return step;
};
// 形を左右反転する（反復フレーズの2回目に使う）
const mirror=offsets=>offsets.map(value=>-value);
// 並びを実際のレーン（0〜4）へ収まるようにずらす。収まらなければ null。
const fitToLanes=(offsets,base)=>{
  const lanes=offsets.map(value=>base+value);
  if(lanes.some(lane=>lane<0||lane>LANES-1))return null;
  return lanes;
};
// その形を置ける起点の範囲
const baseRange=offsets=>{
  const min=Math.min(...offsets),max=Math.max(...offsets);
  return {from:-min,to:LANES-1-max};
};

// --- 音の高さの動きから形を決める ---
// length     … その区切りのノーツ数
// heights    … ノーツごとの音の高さ（0〜1。取れなければ null）
// maxStep    … その難易度で許すレーンの跳び幅
// fastest    … その区切りがいちばん細かい刻み（16分など）でできているか
// allowJack  … 同じ場所の連打を許す間隔か（1本の指で叩ける速さか）
// recent     … 直前に使った形のid（続けて同じ形にしないため）
// 返り値: 形の候補（好ましい順）。それぞれ {pattern, offsets, step}
const shapeCandidatesFor=({length,heights,maxStep,fastest=false,allowJack=false,rhythmShape=null,rotate=0,recent=null})=>{
  const build=pattern=>{
    if(length<pattern.minLength||length>pattern.maxLength)return null;
    // 同じ場所を続けて叩く形は、1本の指で叩き直せる速さのときだけ
    if((pattern.id==='jack'||pattern.jackLike===true)&&!allowJack)return null;
    const offsets=pattern.lanes(length);
    const step=maxStepOf(offsets);
    if(step>maxStep)return null;
    const {from,to}=baseRange(offsets);
    if(from>to)return null;   // 5レーンに収まらない
    return {pattern,offsets,step};
  };
  const order=[];
  const seen=new Set();
  const push=id=>{
    if(seen.has(id))return;
    const pattern=PATTERN_BY_ID[id];
    if(!pattern)return;
    const built=build(pattern);
    seen.add(id);
    if(built)order.push(built);
  };

  const known=(heights||[]).filter(value=>value!=null);
  // 音の高さは、その区切りの中での**動きの形**で見る。絶対値で見ると、
  // 曲全体では動いていても1つの区切りの中では「ほぼ平ら」に見えてしまい、
  // どの区切りも同じ形（左右の交互）になってしまう。
  if(known.length>=2){
    const max=Math.max(...known),min=Math.min(...known);
    const span=max-min;
    const flat=span<.03;
    // その区切りの中で0〜1へ伸ばしてから形を見る
    const rel=known.map(value=>(value-min)/Math.max(span,1e-6));
    const move=rel[rel.length-1]-rel[0];
    const peakIndex=rel.indexOf(1),valleyIndex=rel.indexOf(0);
    const inner=index=>index>0&&index<rel.length-1;
    let turns=0;
    for(let i=2;i<rel.length;i++){
      const a=rel[i-1]-rel[i-2],b=rel[i]-rel[i-1];
      if(a*b<0&&Math.abs(a)>.2&&Math.abs(b)>.2)turns++;
    }
    const turnRatio=rel.length>2?turns/(rel.length-2):0;

    if(flat){
      // 本当に同じ高さが続く＝同じ音の連打
      if(allowJack){push('jack');push('plateau_up');}
      if(fastest)push('trill');
      push('bounce');push('alternate2');
    }else if(turnRatio>=.55){
      // 上下に振れる音。振れ幅の大きいものから並べるので、跳びの上限で
      // 難易度が自然に効く（cross_step は跳び3＝EXPERT以上、zigzag2 は跳び2＝HARD以上）。
      if(fastest)push('trill');
      push('zigzag');push('zigzag2_up');push('cross_step_up');
      push('alternate3');push('alternate2');
    }else if(inner(peakIndex)){
      push('fold_up');push('stair_up');push('expand');push('zigzag2_up');
    }else if(inner(valleyIndex)){
      push('fold_down');push('stair_down');push('contract');push('zigzag2_down');
    }else if(move>=.5){
      // 上がっていく音。素直な階段が第一候補で、跳ね上がりが大きいときだけ
      // 大股の形（2つ飛ばし・交差ステップ）を候補に足す。
      if(span>=.22)push('stair2_up');
      push('stair_up');
      if(span>=.4)push('cross_step_up');
      push('expand');push('zigzag2_up');
    }else if(move<=-.5){
      if(span>=.22)push('stair2_down');
      push('stair_down');
      if(span>=.4)push('cross_step_down');
      push('contract');push('zigzag2_down');
    }else{
      push('fold_up');push('bounce');push('alternate2');push('trill');push('edge_swing');
    }
  }else if(rhythmShape){
    // 音の高さが取れない（打楽器だけの区切り）。刻みの細かさで形を選ぶ。
    //   細かい＝トリル / 拍ごと＝階段や折り返し / 2つだけ＝交互
    if(rhythmShape==='fast'){push('trill');push('zigzag');push('zigzag2_up');push('alternate2');}
    else if(rhythmShape==='beat'){push('fold_up');push('stair_up');push('bounce');push('stair_down');push('zigzag2_up');push('alternate2');}
    else{push('alternate2');push('alternate3');push('edge_swing');}
  }

  // 高さが取れないとき（打楽器だけの区間）は、左右で受け合う形を基本にする
  push(length>=4?'alternate3':'alternate2');
  push('stair_up');push('stair_down');push('fold_up');push('fold_down');
  push('bounce');push('plateau_up');push('plateau_down');
  push('trill');push('jack');
  for(const pattern of PATTERNS)push(pattern.id);
  // 同じ条件がずっと続く区間で、毎回まったく同じ形にならないようにする。
  // 乱数は使わず「何番目の区切りか」で上位2つを入れ替えるだけなので、結果は毎回同じになる。
  if(rotate%2===1&&order.length>=2)[order[0],order[1]]=[order[1],order[0]];
  // 直前に使った形は後回しにする。
  // これが無いと、音の高さの動きが同じ区切りが続くたびに同じ形が選ばれ、
  // 語彙を14種類そろえても実際には上位4〜5種類しか出てこない（実測: EASYで6種類しか出ていなかった）。
  // 「ふさわしい形」を捨てるのではなく、**同じくらいふさわしい候補の中で**新しいほうを前へ出すだけなので、
  // 音との対応は崩さない（見るのは上位 FRESH_WINDOW 件だけ）。
  if(recent&&recent.length&&order.length>=2){
    const avoid=new Set(recent);
    const limit=Math.min(order.length,FRESH_WINDOW);
    const fresh=order.slice(0,limit).findIndex(candidate=>!avoid.has(candidate.pattern.id));
    if(fresh>0){const [pick]=order.splice(fresh,1);order.unshift(pick);}
  }
  return order;
};

module.exports={LANES,PATTERNS,PATTERN_BY_ID,mirror,fitToLanes,baseRange,maxStepOf,shapeCandidatesFor};

if(require.main===module){
  console.log('形の語彙（長さ5のとき）:');
  for(const pattern of PATTERNS){
    const length=Math.min(pattern.maxLength,Math.max(pattern.minLength,5));
    const offsets=pattern.lanes(length);
    console.log(`  ${pattern.id.padEnd(12)} 跳び${maxStepOf(offsets)} 長さ${pattern.minLength}〜${pattern.maxLength}  ${length}個= [${offsets.join(',')}]`);
  }
  const show=(label,heights,options={})=>{
    const candidates=shapeCandidatesFor({length:heights.length,heights,maxStep:options.maxStep??4,
      fastest:options.fastest??false,allowJack:options.allowJack??true});
    console.log(`  ${label.padEnd(26)} → ${candidates.slice(0,3).map(c=>`${c.pattern.id}[${c.offsets.join(',')}]`).join('  ')}`);
  };
  console.log('\n音の高さから選ぶ形:');
  show('上がっていく',[.2,.4,.6,.8]);
  show('大きく上がる',[.1,.4,.8]);
  show('下がっていく',[.8,.6,.4,.2]);
  show('山（上がって下がる）',[.2,.5,.8,.5,.2]);
  show('谷（下がって上がる）',[.8,.5,.2,.5,.8]);
  show('交互に上下',[.2,.7,.2,.7,.2]);
  show('動かない',[.5,.5,.5,.5]);
  show('取れなかった',[null,null,null]);
  console.log('\n難易度で絞ったとき（跳びは1レーンまで）:');
  show('上がっていく(EASY)',[.2,.4,.6,.8],{maxStep:1,allowJack:false});
  show('交互に上下(EASY)',[.2,.7,.2,.7,.2],{maxStep:1,allowJack:false});
}
