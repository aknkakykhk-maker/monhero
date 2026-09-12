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
  // --- 2026-09-07 に足した形(「バリエーションがまだ少ない」への対応) ---
  // 長い階段: 6〜8個で端から端まで昇る/降りる。ゆっくりの区間(8分以下)でしか組めない長さ。
  // 4個までの階段しか無いと、長いフレーズが「階段→階段」に割れて、同じ形の繰り返しに見えていた。
  Object.freeze({id:'stair_up_long',   minLength:6, maxLength:8,
    lanes:length=>Array.from({length},(_,i)=>Math.min(i,4)-(i>4?i-4:0))}),
  Object.freeze({id:'stair_down_long', minLength:6, maxLength:8,
    lanes:length=>Array.from({length},(_,i)=>-(Math.min(i,4)-(i>4?i-4:0)))}),
  // コール＆レスポンス: 短い呼びかけ(0,1,0)を、1つ上/下で受ける(1,2,1)。跳び1なのでEASYから。
  // 同じ音形が2回続くフレーズに当てると、「呼んで、返す」の形が画面に出る。
  Object.freeze({id:'echo_up',   minLength:4, maxLength:6,
    lanes:length=>{const base=[0,1,0,1,2,1];return Array.from({length},(_,i)=>base[i%base.length]);}}),
  Object.freeze({id:'echo_down', minLength:4, maxLength:6,
    lanes:length=>{const base=[0,-1,0,-1,-2,-1];return Array.from({length},(_,i)=>base[i%base.length]);}}),
  // 外→内→外 / 内→外→内: 中央を軸に開いて閉じる。跳び2なのでNORMALから(centered)。
  // 「開き」「閉じ」は一方通行で終わるので、往復する形を別に持つ。
  Object.freeze({id:'out_in_out', minLength:4, maxLength:7, centered:true,
    lanes:length=>{const base=[-2,0,2,0,-2,0,2];return Array.from({length},(_,i)=>base[i%base.length]);}}),
  Object.freeze({id:'in_out_in',  minLength:4, maxLength:7, centered:true,
    lanes:length=>{const base=[0,-2,0,2,0,-2,0];return Array.from({length},(_,i)=>base[i%base.length]);}}),
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
      push('fold_up');push('stair_up');push('out_in_out');push('expand');push('zigzag2_up');push('echo_up');
    }else if(inner(valleyIndex)){
      push('fold_down');push('stair_down');push('in_out_in');push('contract');push('zigzag2_down');push('echo_down');
    }else if(move>=.5){
      // 上がっていく音。素直な階段が第一候補で、跳ね上がりが大きいときだけ
      // 大股の形（2つ飛ばし・交差ステップ）を候補に足す。長いフレーズなら長い階段。
      if(span>=.22)push('stair2_up');
      push('stair_up');push('stair_up_long');
      if(span>=.4)push('cross_step_up');
      push('echo_up');push('expand');push('zigzag2_up');
    }else if(move<=-.5){
      if(span>=.22)push('stair2_down');
      push('stair_down');push('stair_down_long');
      if(span>=.4)push('cross_step_down');
      push('echo_down');push('contract');push('zigzag2_down');
    }else{
      push('fold_up');push('bounce');push('echo_up');push('alternate2');push('trill');push('out_in_out');push('edge_swing');
    }
  }else if(rhythmShape){
    // 音の高さが取れない（打楽器だけの区切り）。刻みの細かさで形を選ぶ。
    //   細かい＝トリル / 拍ごと＝階段や折り返し / 2つだけ＝交互
    if(rhythmShape==='fast'){push('trill');push('zigzag');push('zigzag2_up');push('alternate2');push('in_out_in');}
    else if(rhythmShape==='beat'){push('fold_up');push('stair_up');push('bounce');push('stair_down');push('echo_up');push('zigzag2_up');push('alternate2');}
    else{push('alternate2');push('alternate3');push('stair_up_long');push('edge_swing');}
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
  // 候補ごとに「音との合いかた」の順位を残す(0がいちばん合っている)。
  // 直前を避ける入れ替えのあとで付ける(先に付けると、下の rankShapes が入れ替えを元に戻してしまう)。
  // rankShapes は、この順位が同じくらいの候補(上位 FRESH_WINDOW 件)の中でしか入れ替えない。
  order.forEach((candidate,index)=>{candidate.fit=index;});
  return order;
};

// --- 譜面文法: 候補を「音との合いかた」だけでなく、つなぎ・使用回数・場面で点数化して選ぶ ---
//
// 【なぜ要るか】(2026-09-07・ユーザー指摘「同じようなレーン移動、同じような配置が繰り返されやすい」)
// shapeCandidatesFor は候補を「音に合う順」に並べるだけで、選ぶのは常に先頭だった。
// 「直前と同じ形を避ける」は入っていたが、
//   ・その曲で何度も使った形が、直前でさえなければまた選ばれる
//   ・前の形の終わりと次の形の始まりの向きが合わず、手の流れが途切れる
//   ・同じ候補列が出るたびに同じ順で決まる(散らしが「偶数番目か」の1ビットしか無い)
// が残っていた。ここでは**上位 FRESH_WINDOW 件(＝音との合いかたが同じくらいの候補)の中だけ**で
// 次を足して点数化する。音に合わない形が上がってくることは無い。
//
//   ・音との合いかた … 順位そのもの(最優先。1段で 2 点)
//   ・つなぎ         … 前の形の最後の動きと、次の形の最初の動きが同じ向きなら 1 点(流れる)、
//                      前の形の終わりから次の始まりまでが跳びの上限を超えるなら 2 点引く
//   ・使用回数       … その曲でその形を使った回数 × 0.5 点(語彙を均す)
//   ・場面           … 呼び出し側が渡す好み(サビで「開き」を前へ、イントロで交互を前へ、など)
//   ・散らし         … 決定的なハッシュ(曲・難易度・かたまり番号)で 0〜0.9 点。乱数は使わない
const hash32=text=>{let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0);};
const firstMove=offsets=>offsets.length>=2?Math.sign(offsets[1]-offsets[0]):0;
const lastMove=offsets=>offsets.length>=2?Math.sign(offsets[offsets.length-1]-offsets[offsets.length-2]):0;
const rankShapes=(candidates,{usage=null,previousOffsets=null,prefer=null,seed='',maxStep=4}={})=>{
  if(!candidates||candidates.length<2)return candidates||[];
  const limit=Math.min(candidates.length,FRESH_WINDOW);
  const head=candidates.slice(0,limit),tail=candidates.slice(limit);
  const scored=head.map((candidate,index)=>{
    let score=candidate.fit*2;
    const id=candidate.pattern.id;
    if(usage)score+=(usage.get?usage.get(id)||0:usage[id]||0)*.5;
    if(previousOffsets&&previousOffsets.length>=2){
      const prev=lastMove(previousOffsets),next=firstMove(candidate.offsets);
      // 同じ向きへ続けば流れる。ただし3つ続けて同じ向きに進む(ずっと右へ)のは避けたいので、
      // 呼び出し側が prefer.turn=true を渡したときは逆向きを前へ出す
      if(prev!==0&&next!==0){
        if(prefer&&prefer.turn){score+=prev===next?1:-1;}
        else score+=prev===next?-1:0;
      }
    }
    if(prefer&&prefer.ids&&prefer.ids[id])score-=prefer.ids[id];
    score+=(hash32(`${seed}:${id}`)%10)/10;
    return {candidate,score,index};
  });
  scored.sort((a,b)=>a.score-b.score||a.index-b.index);
  return scored.map(entry=>entry.candidate).concat(tail);
};

// ── 同時押さえ（HOLD/SLIDEを2本いちどに押さえる形）の語彙 ──────────────────────
//
// 【2026-09-12・ユーザー指示】
// 「ノーツの置き方は曲のタイプや難易度でそれに見合った形に置くようにするようにして /
//   決めごとがあるとつまんなくなる / バリエーションが大事」
//
// なので「2本目は必ず遠い端へ」のような**1つの決めごとにはしない**。形に名前を付けて
// 語彙にし、**その場の曲の性質（2本それぞれの動き量）と難易度**で点数を付けて選ぶ
// （§3.1.6「形を順位でなく点数で選ぶ」と同じ考え方）。直前に使った形にはペナルティを
// 掛け、同点は種(seed)で崩すので、同じ曲でも同じ形が並ばない。
//
// 各形は「相方（旋律側の押さえノーツ）の経路」を受けて、2本目のレーンの行き先を返す。
//   partnerFrom / partnerTo … 相方の始点・終点のレーン
//   room                    … 使えるレーンの幅（0〜room）
// 返すのは {from,to}。from===to なら HOLD、違えば SLIDE になる。
//
// wantsBassMove / wantsMelodyMove は「その形が似合う動き量」。
// ★目安は **SLIDEになる下限(slideMinMove=0.10)を1.0とした倍率**で書く。
//   はじめ0〜1の生の moves で書いていたら実データと桁が合わなかった。
//   伸びる音の moves は中央0.023・p90 0.125・最大0.36で、1.0近くには**絶対に来ない**。
//   そのため wantsBassMove:.8 のような形は一度も1位になれなかった(2026-09-12)。
//   呼ぶ側は heldPairMoveScale() を通してから渡す。
//     0.0 … 動かない / 1.0 … ちょうどSLIDEになる / 2.0以上 … よく動く
// minLevel は難易度の段（PROFILES.level）。上の形は上の難易度だけに出る。
// ★端で潰れないように「ずらして収める」。端ごとに丸めると、行き先と出発点が同じに
//   なって**動くはずの形が動かないHOLDになる**（2026-09-12に実際そうなった。
//   cross を選んだのに2本目がHOLDで、形の名前と中身が食い違っていた）。
const fitPair=(from,to,room)=>{
  const lo=Math.min(from,to),hi=Math.max(from,to);
  let shift=0;
  if(lo<0)shift=-lo;
  else if(hi>room)shift=room-hi;
  const a=from+shift,b=to+shift;
  // 幅そのものがレーンより広いときだけは、やむなく端で丸める
  return {from:Math.max(0,Math.min(room,Math.round(a))),to:Math.max(0,Math.min(room,Math.round(b)))};
};
// 相方の平均から見て、空いている側（レーンが広く残っている側）を選ぶ
const sideAwayFrom=(partnerFrom,partnerTo,room)=>{
  const center=(partnerFrom+partnerTo)/2;
  return center<=room/2?1:-1;
};
// follows は「2本目が動くかどうかの決まり方」。
//   'none'    … いつも動かない（支える形）
//   'partner' … 相方が動けば動く（並んで動く形）
//   'own'     … 相方が動かなくても自分で動く（開く・閉じる・入れ替わる形）
// 'own' の形が端で潰れて動かなくなったら、その形は**採らずに次の形へ回す**
// （名前と中身が食い違ったままにしない）。
const HELD_PAIR_SHAPES=Object.freeze([
  // 支える形: 2本目を動かさない。旋律が動くぶんを受け止める。いちばん読みやすい
  Object.freeze({id:'anchor_out', minLevel:1, follows:'none', wantsBassMove:0,   wantsMelodyMove:1.2,
    place:({partnerFrom,partnerTo,room})=>{
      const lane=sideAwayFrom(partnerFrom,partnerTo,room)>0?room:0;
      return {from:lane,to:lane};
    }}),
  Object.freeze({id:'anchor_in',  minLevel:5, follows:'none', wantsBassMove:0,   wantsMelodyMove:2.0,
    place:({partnerFrom,partnerTo,room})=>{
      // 内側（中央寄り）で支え、旋律を外で動かす。外で支えるより忙しく見える
      const side=sideAwayFrom(partnerFrom,partnerTo,room);
      const lane=side>0?Math.min(room,Math.round(room/2)+1):Math.max(0,Math.round(room/2)-1);
      return {from:lane,to:lane};
    }}),
  // 並んで動く形: ベースと旋律が同じ向きへ動く曲に似合う。間隔は保つ
  Object.freeze({id:'parallel',   minLevel:7, follows:'partner', wantsBassMove:1.2, wantsMelodyMove:1.2,
    place:({partnerFrom,partnerTo,room,gap})=>{
      const side=sideAwayFrom(partnerFrom,partnerTo,room);
      return fitPair(partnerFrom+side*gap,partnerTo+side*gap,room);
    }}),
  // 逆向きに動く形（開く・閉じる）: 対旋律のある曲に似合う
  Object.freeze({id:'contrary',   minLevel:7, follows:'own', wantsBassMove:1.6, wantsMelodyMove:1.0,
    place:({partnerFrom,partnerTo,room,gap})=>{
      const side=sideAwayFrom(partnerFrom,partnerTo,room);
      // 相方が動かない曲でも自分は動く。行き先は相方の反対側へ回り込む
      const span=Math.max(1,Math.abs(partnerTo-partnerFrom)||gap);
      return fitPair(partnerFrom+side*gap,partnerFrom+side*(gap+span),room);
    }}),
  // ★「相方の from と to にそれぞれ足す」書き方はしない。相方が少し動くと
  //   足し引きが打ち消し合って**動かなくなる**（converge が実際そうなった）。
  //   自分の出発点を決めてから、必ず動く量(extra)を足し引きする。
  Object.freeze({id:'diverge',    minLevel:7, follows:'own', wantsBassMove:1.0, wantsMelodyMove:0.6,
    place:({partnerFrom,partnerTo,room,gap})=>{
      const side=sideAwayFrom(partnerFrom,partnerTo,room);
      const extra=Math.max(1,Math.round(Math.abs(partnerTo-partnerFrom))||1);
      const start=partnerFrom+side*gap;
      return fitPair(start,start+side*extra,room);   // 必ず extra ぶん離れる
    }}),
  Object.freeze({id:'converge',   minLevel:9, follows:'own', wantsBassMove:0.8, wantsMelodyMove:0.4,
    place:({partnerFrom,partnerTo,room,gap})=>{
      const side=sideAwayFrom(partnerFrom,partnerTo,room);
      const extra=Math.max(1,Math.round(Math.abs(partnerTo-partnerFrom))||1);
      const start=partnerFrom+side*(gap+extra);
      return fitPair(start,start-side*extra,room);   // 必ず extra ぶん相方へ寄る
    }}),
  // 左右対称の形: 相方の経路を鏡にして返す。同時スライドでいちばん見栄えのする形。
  // 相方が中央を通る曲では終わりで指がぶつかるので、指の間隔の検査で落ちて別の形へ回る。
  // follows は 'partner'。鏡なので**相方が動いたぶんだけ**動く（相方が止まっていれば止まる）。
  Object.freeze({id:'mirror',     minLevel:7, follows:'partner', wantsBassMove:2.6, wantsMelodyMove:1.6,
    place:({partnerFrom,partnerTo,room})=>fitPair(room-partnerFrom,room-partnerTo,room)}),
  // 内外が入れ替わる形: いちばん忙しい。上の難易度だけ
  Object.freeze({id:'cross',      minLevel:9, follows:'own', wantsBassMove:2.2, wantsMelodyMove:1.0,
    place:({partnerFrom,partnerTo,room,gap})=>{
      const side=sideAwayFrom(partnerFrom,partnerTo,room);
      // 相方の外側から入って、相方をまたいで反対の外側へ抜ける
      const span=Math.max(2,Math.abs(partnerTo-partnerFrom)+gap);
      return fitPair(partnerFrom+side*gap,partnerFrom-side*(span-gap),room);
    }}),
]);

// 語彙から、その場に似合う順で候補を返す。
//   level        … PROFILES.level（難易度の段）
//   bassMove     … 2本目の素（ベース）の動き量 0〜1
//   melodyMove   … 相方（旋律）の動き量 0〜1
//   usage        … 形ごとの使用回数（Map）。使ったものは後ろへ回す
//   previousId   … 直前に使った形。続けて同じ形は出さない
//   seed         … 同点を崩す種
// 生の moves を「SLIDEになる下限を1.0とした倍率」へ直す。
// 上限は3.0（最大0.36 ÷ 0.10 = 3.6 なので、実データの上のほうまで届く）。
const HELD_PAIR_MOVE_UNIT=.10;   // = COMMON.slideMinMove
const heldPairMoveScale=moves=>{
  const value=Number(moves);
  if(!Number.isFinite(value)||value<=0)return 0;
  return Math.min(3,value/HELD_PAIR_MOVE_UNIT);
};
const heldPairShapeCandidates=({level,bassMove,melodyMove,usage=null,previousId=null,seed=''})=>{
  const usable=HELD_PAIR_SHAPES.filter(shape=>shape.minLevel<=level);
  const scored=usable.map((shape,index)=>{
    // 動き量の近さ（小さいほど似合う）
    // 倍率で比べるので、差も倍率のまま。ベース側を重く見る（2本目の性格を決めるのはベース）
    let score=Math.abs(shape.wantsBassMove-bassMove)*1.2+Math.abs(shape.wantsMelodyMove-melodyMove)*.6;
    if(usage)score+=(usage.get?usage.get(shape.id)||0:usage[shape.id]||0)*.6;
    if(previousId===shape.id)score+=1.5;            // 続けて同じ形は出さない
    score+=(hash32(`${seed}:${shape.id}`)%10)/10;   // 同点は種で崩す（曲ごとに並びが変わる）
    return {shape,score,index};
  });
  scored.sort((a,b)=>a.score-b.score||a.index-b.index);
  return scored.map(entry=>entry.shape);
};

module.exports={LANES,PATTERNS,PATTERN_BY_ID,mirror,fitToLanes,baseRange,maxStepOf,shapeCandidatesFor,rankShapes,hash32,FRESH_WINDOW,
  HELD_PAIR_SHAPES,heldPairShapeCandidates,heldPairMoveScale,HELD_PAIR_MOVE_UNIT};


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
