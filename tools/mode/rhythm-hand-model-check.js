#!/usr/bin/env node
// 「指の物理条件」の物差しそのものを確かめる。
//
//   node tools/mode/rhythm-hand-model-check.js
//
// 【なぜ要るか】(2026-09-05・実機の指摘)
// 「まだスライド時、物理的に押せない（押しづらすぎる？）箇所がある」
//
// それまでの物差しは「幅の広い帯なら端から端まで好きな場所を押せる」としていた。
// 理屈の上では指が入るのだが、**次に何が来るかを知らないと端へ寄せられない**。
// 初見では中心を押さえるのが自然なので、この甘さで押せない配置が
// 生成でも検査でも素通りしていた（先行公開5曲で163か所）。
//
// いまは「押さえ続ける指は中心からわずかしか動かせない」を物差しに入れてある。
// この検査は、その物差しが緩められていないことと、
// 生成・検査・自動修正がすべて同じ物差しを見ていることを守る。
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const M=require(path.join(ROOT,'tools','mode','rhythm-hand-model.js'));
const {HAND_MODEL,fingerSpan,heldTouchSpan,usableTouchSpan,fingerPairFeasible}=M;
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const near=(a,b)=>Math.abs(a-b)<1e-9;

check('押さえている指が寄せられる幅が決めてある',
  Number.isFinite(HAND_MODEL.holdShiftLanes)&&HAND_MODEL.holdShiftLanes>0,
  `${HAND_MODEL.holdShiftLanes}レーン`);
check('寄せられる幅は指の太さより小さい(端まで寄せられることにしない)',
  HAND_MODEL.holdShiftLanes<HAND_MODEL.fingerMinGapLanes,
  `寄せ${HAND_MODEL.holdShiftLanes} < 指の太さ${HAND_MODEL.fingerMinGapLanes}`);

// 幅3レーン(6サブ)のHOLD。端まで寄せられるなら [0.5,2.5]、いまの物差しなら中心±0.25
{
  const hold={type:'HOLD',subLane:0,subLaneWidth:6};
  const held=heldTouchSpan(hold),usable=usableTouchSpan(hold);
  check('押さえているHOLDの指は中心の近くしか動けない',
    near(held[0],1.25)&&near(held[1],1.75),`[${held}]`);
  check('叩くだけのノーツは今までどおり幅の中を使える',
    near(usable[0],.5)&&near(usable[1],2.5),`[${usable}]`);
  check('押さえているHOLDには狭いほうの物差しを使う',
    near(fingerSpan(hold)[0],held[0])&&near(fingerSpan(hold)[1],held[1]));
  check('叩くノーツには広いほうの物差しを使う',
    near(fingerSpan({type:'TAP',subLane:0,subLaneWidth:6})[0],usable[0]));
}
// SLIDEを押さえている指は経路に沿うので、中心から動かせない
{
  const slide=heldTouchSpan({type:'SLIDE',lane:2,subLaneWidth:6});
  check('SLIDEを押さえている指は中心から動かせない',near(slide[0],slide[1]),`[${slide}]`);
}
// 実機の指摘そのものの形。幅3レーンのHOLDの、中心のすぐ横に来るTAP
{
  const hold={type:'HOLD',subLane:0,subLaneWidth:6};      // サブ0〜6(中心3)
  const onCenter={type:'TAP',subLane:2,subLaneWidth:2};   // サブ2〜4(中心3)＝ちょうど真上
  const farEnough={type:'TAP',subLane:8,subLaneWidth:2};  // 離れている
  check('押さえている帯の真上に来るノーツは押せないと分かる',
    fingerPairFeasible(hold,onCenter,0).ok===false,
    fingerPairFeasible(hold,onCenter,0).reason||'');
  check('十分に離れていれば押せると分かる(何でも弾く物差しになっていない)',
    fingerPairFeasible(hold,farEnough,0).ok===true);
}
// 叩くノーツどうしの判定は変えていない(既存の譜面が急に全部NGにならないこと)
{
  const a={type:'TAP',subLane:0,subLaneWidth:2},b={type:'TAP',subLane:8,subLaneWidth:2};
  check('離れた同時押しは今までどおり押せる',fingerPairFeasible(a,b,0).ok===true);
  const c={type:'TAP',subLane:4,subLaneWidth:2},d={type:'TAP',subLane:5,subLaneWidth:2};
  check('ほぼ同じ場所を87msで叩き分けるのは押せない',fingerPairFeasible(c,d,87).ok===false);
  check('間隔が空けば同じ場所でも押せる',fingerPairFeasible(c,d,200).ok===true);
}
// 物差しを1か所にまとめてあること。道具ごとに書き直すと直したつもりで別物になる
{
  const users=['rhythm-chart-v3-generate.js','rhythm-chart-v2-step3-generate.js',
    'rhythm-chart-v2-step6-playability.js','rhythm-chart-v3-check.js',
    'rhythm-chart-v2-step7-autofix.js','rhythm-runtime-notes.js'];
  for(const file of users){
    const src=fs.readFileSync(path.join(ROOT,'tools','mode',file),'utf8');
    const usesModel=src.includes("rhythm-hand-model");
    check(`${file} は共通の物差しを使う`,usesModel);
  }
  const runtimeNotes=fs.readFileSync(path.join(ROOT,'tools','mode','rhythm-runtime-notes.js'),'utf8');
  check('配信データを測る側も「寄せられる幅」を見ている',
    runtimeNotes.includes('HAND_MODEL.holdShiftLanes'));
}
console.log('');
if(failed){console.log(`${failed}件のNGがあります`);process.exit(1);}
console.log('すべてOK');
