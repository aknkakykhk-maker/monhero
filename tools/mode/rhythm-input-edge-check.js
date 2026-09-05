#!/usr/bin/env node
// 「画面の端を押しても反応しない」の再発を防ぐ。
//
//   node tools/mode/rhythm-input-edge-check.js
//
// 【何が起きていたか】(2026-09-05・#156 演奏時の操作性の調査)
// 叩いた場所は rhythmLaneCoordinateAtPoint がレーン座標へ直す。ここが
// 「レーンの台形の内側でなければ null」だったため、台形の外を押すと
// **空打ちの音すら鳴らずに入力そのものが消えていた**。
// 台形は画面の端まで届いていないので、判定ライン(下から12%)の高さで実測すると
// 390px幅のプレイエリアに対して左右23pxずつが完全な死角だった。
//
// 困るのはいちばん外のレーン(左端・右端)のノーツ。ノーツの当たりは
// RHYTHM_TAP_TOLERANCE_SUB_LANES(0.6サブレーン)ぶん外側まで受け付ける作りなのに、
// 台形の外はここで先に落とされるので**外側だけこの猶予が使えなかった**。
// 内側へ0.6サブレーンずれても取れるのに、外側は数pxずれただけで無反応になる。
//
// 【この検査で見ること】
//   ① 判定ラインの高さでは、画面のいちばん左端・右端を押しても反応する
//   ② 猶予はノーツの当たりの猶予(0.6サブレーン)より広い(でないと猶予が使えない)
//   ③ それでも「関係ないところ」は反応しない。画面の上のほうはレーンが細いので
//      猶予も狭く、四すみや中ほどの端は今までどおり無反応
//   ④ レーン番号は 0〜4 に収まる(外側へはみ出した座標がそのまま出ていかない)
//   ⑤ 台形の内側の判定はこれまでと1つも変わらない
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const src=fs.readFileSync(path.join(ROOT,'monster-hero','data','rhythm-mode.js'),'utf8');
const stub=()=>({style:{setProperty(){},removeProperty(){}},setAttribute(){},removeAttribute(){},
  getAttribute:()=>null,appendChild(){},removeChild(){},addEventListener(){},removeEventListener(){},
  classList:{add(){},remove(){}},dataset:{},querySelector:()=>null,querySelectorAll:()=>[],
  textContent:'',isConnected:false,children:[],childNodes:[],closest:()=>null,
  getBoundingClientRect:()=>({top:0,left:0,width:0,height:0,bottom:0,right:0})});
const ctx={console,navigator:{},performance:{now:()=>0},requestAnimationFrame:()=>0,setTimeout,clearTimeout,
  MutationObserver:function(){this.observe=()=>{};this.disconnect=()=>{};},
  document:{createElement:stub,createElementNS:stub,head:stub(),body:stub(),documentElement:stub(),
    addEventListener(){},removeEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]}};
ctx.window=ctx;ctx.globalThis=ctx;vm.createContext(ctx);
// 端の猶予そのものが無い(＝修正前の)コードでも、落ちずに「NG」を出したい。
// typeof で受けないと ReferenceError で止まり、検査が壊れているのか
// 実装が戻っているのかが見分けられなくなる
vm.runInContext(src+`
globalThis.__x={rhythmLaneAtPoint,rhythmSubLaneCoordinateAtPoint,rhythmProjectBoundary,
  RHYTHM_LANE_COUNT,RHYTHM_TAP_TOLERANCE_SUB_LANES,
  RHYTHM_INPUT_EDGE_MARGIN_SUB_LANES:(typeof RHYTHM_INPUT_EDGE_MARGIN_SUB_LANES!=='undefined'?RHYTHM_INPUT_EDGE_MARGIN_SUB_LANES:null)};`,ctx);
const {rhythmLaneAtPoint:laneAt,rhythmSubLaneCoordinateAtPoint:subAt,rhythmProjectBoundary:B,
  RHYTHM_LANE_COUNT:N,RHYTHM_TAP_TOLERANCE_SUB_LANES:TOL,RHYTHM_INPUT_EDGE_MARGIN_SUB_LANES:MARGIN}=ctx.__x;

let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// 縦画面のプレイエリアのおよその大きさ。判定ラインは下から12%(＝上から88%)
const W=390,H=520,LINE_Y=Math.round(H*.88),rect={left:0,top:0,width:W,height:H};

ok('② 端の猶予(RHYTHM_INPUT_EDGE_MARGIN_SUB_LANES)がある',MARGIN!==null,
  MARGIN===null?'定義が見つからない(台形の外を落とす作りに戻っている)':'');
ok('② 端の猶予はノーツの当たりの猶予より広い',
  Number.isFinite(MARGIN)&&MARGIN>TOL,
  `端の猶予 ${MARGIN}サブレーン / ノーツの当たりの猶予 ${TOL}サブレーン`);

// ① 判定ラインの高さは端まで反応する
for(const [x,label] of [[0,'左端ぴったり'],[1,'左端から1px'],[W,'右端ぴったり'],[W-1,'右端から1px']]){
  const lane=laneAt(x,LINE_Y,rect);
  ok(`① 判定ラインの高さで ${label}(x=${x}) を押すと反応する`,lane!==null,lane===null?'反応しない':`レーン${lane}`);
}
// 端から何pxで反応しはじめるか(修正前は23px)
const firstResponsive=(fromLeft)=>{
  for(let d=0;d<=W;d++){const x=fromLeft?d:W-d;if(laneAt(x,LINE_Y,rect)!==null)return d;}
  return null;};
ok('① 判定ラインの高さでは左右とも死角が無い',
  firstResponsive(true)===0&&firstResponsive(false)===0,
  `左端から${firstResponsive(true)}px / 右端から${firstResponsive(false)}px で反応しはじめる`);

// ③ 関係ないところは反応しない
for(const [x,y,label] of [[0,0,'左上のかど'],[W,0,'右上のかど'],
  [0,Math.round(H*.5),'左端の中ほど'],[W,Math.round(H*.5),'右端の中ほど']]){
  ok(`③ ${label}(${x},${y}) は反応しない`,laneAt(x,y,rect)===null,
    laneAt(x,y,rect)===null?'':`レーン${laneAt(x,y,rect)}になっている`);
}
// 猶予はその高さのレーンに比例する(上へ行くほど狭い)
const marginPx=y=>{const l=B(0,y),r=B(N,y);return (r-l)/N/2*(MARGIN||0)*W;};
ok('③ 猶予は画面の上へ行くほど狭い(レーンの幅に比例する)',
  MARGIN!==null&&marginPx(.88)>marginPx(.5)&&marginPx(.5)>marginPx(0),
  `判定ライン ${marginPx(.88).toFixed(1)}px / 中ほど ${marginPx(.5).toFixed(1)}px / 上端 ${marginPx(0).toFixed(1)}px`);

// ④ レーン番号は 0〜4 に収まる
let outOfRange=0,sampled=0;
for(let x=0;x<=W;x+=2)for(let y=0;y<=H;y+=10){
  const lane=laneAt(x,y,rect);
  if(lane===null)continue;
  sampled++;
  if(!(Number.isInteger(lane)&&lane>=0&&lane<N))outOfRange++;
}
ok('④ どこを押してもレーン番号は 0〜4 に収まる',outOfRange===0&&sampled>0,`${sampled}点を試して範囲外 ${outOfRange}件`);

// ⑤ 台形の内側の答えはこれまでと変わらない(レーンの中央は必ずそのレーン)
let centerNg=[];
for(const y of [.05,.3,.5,.7,.88,1]){
  for(let lane=0;lane<N;lane++){
    const l=B(lane,y),r=B(lane+1,y),cx=(l+r)/2*W,cy=Math.round(y*H);
    if(laneAt(cx,cy,rect)!==lane)centerNg.push(`y=${y} lane=${lane}`);
  }
}
ok('⑤ どの高さでも、レーンの中央を押せばそのレーンになる',centerNg.length===0,centerNg.slice(0,3).join(' / '));
// 端のレーンの外側でも、ノーツの当たりの猶予ぶんは座標が届く
const laneWidthAtLine=(B(N,.88)-B(0,.88))/N;
const justOutside=(B(0,.88)-laneWidthAtLine/2*TOL)*W;   // 左端のノーツから猶予ぶん外側
const sub=subAt(justOutside,LINE_Y,rect);
ok('⑤ 左端のノーツの猶予ぶん外側でも座標が届く(そこで消えない)',
  sub!==null&&sub>=-TOL-1e-6&&sub<0,sub===null?'消えている':`サブレーン座標 ${sub.toFixed(3)}`);

console.log(failed===0?'\nすべてOK':`\n${failed}件のNGがあります`);
process.exit(failed===0?0:1);
