#!/usr/bin/env node
// 斜めのSLIDEに付いた終点フリックを、実際の画面の大きさで確かめる。
//
//   node tools/mode/rhythm-end-flick-diagonal-check.js
//
// 【なぜ要るか】(2026-09-18・プレイヤーの声)
//   「イベ曲のstay with meのスライドノーツ＋フリックフィニッシュノーツが、
//     指置いてるだけで手前で勝手にBAD判定になっちゃう」
//
// 終点フリックは「基準の位置から24px動いたら弾いた」と見る。斜めのSLIDEでは
// 指が経路を追って動くので、2026-09-14に「経路が動いたぶんを基準からも差し引く」
// 補正を入れた。ところがこれは裏返すと、**指を置いたままでも経路が逃げたぶんが
// 距離として積み上がる**。弾いていないのにフリック成立と見なされ、終端の判定窓へ
// 入った瞬間に早い判定(BAD)が確定していた。指を戻して立て直す機会も無くなる。
//
// ★既存の rhythm-end-flick-check.js がこれを見逃したのは、
//   テスト譜面が**まっすぐなSLIDE**(lane 0 → 0)だけで、しかも DOM が無いため
//   レーンの幅が 0px になり、補正そのものが動いていなかったから。
//   ここでは 390x700 の画面を与えて、斜めのSLIDEで実際に動かす。
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');

let now=0,rafCb=null;
const AREA={left:0,top:0,width:390,height:700,right:390,bottom:700,x:0,y:0};
const area={getBoundingClientRect:()=>AREA,dataset:{}};
const stub=()=>({setAttribute(){},appendChild(){},style:{},dataset:{},textContent:''});
const context={console,performance:{now:()=>now},
  requestAnimationFrame:cb=>{rafCb=cb;return 1;},cancelAnimationFrame:()=>{rafCb=null;},
  document:{querySelector:s=>String(s).includes('rhythm-play-area')?area:null,
    addEventListener(){},removeEventListener(){},createElement:stub,
    head:{appendChild(){}},body:{appendChild(){}},getElementById:()=>null},
  window:{addEventListener(){},removeEventListener(){},innerWidth:390,innerHeight:700}};
context.window.document=context.document;
vm.createContext(context);
vm.runInContext(source.split('const RHYTHM_SONGS',1)[0]
  +'\nthis.out={RHYTHM_GESTURE_RUNTIME,rhythmSlideExpectedLane,rhythmTrackingLaneCoordinateAtPoint,'
  +'RHYTHM_FLICK_DISTANCE_PX,RHYTHM_END_FLICK_ARM_MS};',context);
const O=context.out,runtime=O.RHYTHM_GESTURE_RUNTIME;

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const Y=AREA.top+AREA.height*0.86;              // 判定ラインのあたり
const laneAt=x=>O.rhythmTrackingLaneCoordinateAtPoint(x,Y,AREA);
const xForLane=lane=>{let lo=0,hi=AREA.width;
  for(let i=0;i<50;i++){const m=(lo+hi)/2;const v=laneAt(m);if(v===null||v<lane)lo=m;else hi=m;}
  return (lo+hi)/2;};
const LANE_PX=(xForLane(3)-xForLane(0))/3;
check('画面の大きさが入っていて、レーンの幅が測れている',LANE_PX>0,`${LANE_PX.toFixed(1)}px/レーン`);

// laneStart → laneEnd の SLIDE(終点フリック付き)を1000〜2000msで動かす。
//   mode: 'still'(置いたまま) / 'follow'(経路を追う) / 末尾に '+flick' で終端40ms手前に弾く
const play=(laneStart,laneEnd,mode)=>{
  runtime.clear();now=1000;rafCb=null;
  const note={type:'SLIDE',timeMs:1000,endTimeMs:2000,lane:laneStart,subLane:laneStart*2,subLaneWidth:2,
    done:false,holdJudgment:null,holdDeltaMs:0,index:0,endFlick:true,
    slidePoints:[{timeMs:1000,lane:laneStart},{timeMs:2000,lane:laneEnd}]};
  runtime.record('touch:1',xForLane(laneStart),Y);
  runtime.bind('touch:1',note,'SLIDE',1000,0);
  note.holdJudgment='MARVELOUS';note.holdDeltaMs=0;
  let settledAt=null;
  for(let t=1010;t<=2400;t+=10){
    if(mode.startsWith('follow')){
      runtime.record('touch:1',xForLane(O.rhythmSlideExpectedLane(note,Math.min(t,2000))),Y);
    }
    if(mode.endsWith('flick')&&t===1960){
      const base=mode.startsWith('follow')?O.rhythmSlideExpectedLane(note,1960):laneStart;
      runtime.record('touch:1',xForLane(base),Y-60);       // 上へ弾く
    }
    now=t;const cb=rafCb;rafCb=null;if(cb)cb();
    if(settledAt===null&&!runtime._sessions.has('touch:1')&&t<1950)settledAt=t;
    if(note.done)break;
  }
  return {judgment:note.holdJudgment,earlyMs:settledAt===null?0:2000-settledAt};
};

// ── 本題。指を置いたままなら、勝手にフリック成立にしない ──
for(const [a,b,label] of [[0,3,'急な斜め(0→3)'],[0,1,'ゆるい斜め(0→1)'],[3,0,'逆向きの斜め(3→0)']]){
  const r=play(a,b,'still');
  check(`${label}で指を置いたままでも、終端より手前で判定が確定しない`,
    r.earlyMs===0&&r.judgment!=='BAD',`判定=${r.judgment}${r.earlyMs?` / ${r.earlyMs}ms手前で確定`:''}`);
}

// ── 弾いたときはこれまでどおり成立する ──
check('まっすぐなSLIDEを弾けば成立する',play(0,0,'still+flick').judgment==='MARVELOUS');
check('斜めのSLIDEを経路どおり追って弾けば成立する',play(0,3,'follow+flick').judgment==='MARVELOUS',
  '2026-09-14の補正(経路を追った動きをフリックと数えない)が生きているか');
check('ゆるい斜めでも弾けば成立する',play(0,1,'still+flick').judgment==='MARVELOUS');

// ── 弾かなければ成立しない(終点フリックを付けた意味が消えていないか) ──
check('経路を追っても弾かなければ成立しない',play(0,3,'follow').judgment==='MISS');
check('置いたまま弾かなければ成立しない',play(0,3,'still').judgment==='MISS');

// ── ジグザグのSLIDE(2026-09-18・動画で示された症状) ──
// 実物は pandora_boss_remix の MASTER 13.44〜14.92s。17点の折れ線で、終端250msの受付のあいだに
// 経路が 0.694 → 2.414 → 1.500 レーン(＝115px。フリック距離24pxの約4.8倍)も振れる。
// 指は経路を追うしかないが、追従はどうしても遅れる。すると
//   ・経路ぶんを引いた距離(＝遅れぶん)  … 大きい
//   ・指そのものの移動                  … 大きい
// の両方が成り立ってしまい、弾いていないのに「弾いた」と見なされる。
// そのまま早く確定させると、終端の手前でBADが出る。ここではその形をそのまま組む。
const playZigzag=(lagMs,flick)=>{
  runtime.clear();now=1000;rafCb=null;
  const points=[{timeMs:1000,lane:1.5},{timeMs:1750,lane:0.694},{timeMs:1870,lane:2.414},{timeMs:2000,lane:1.5}];
  const note={type:'SLIDE',timeMs:1000,endTimeMs:2000,lane:1,subLane:3,subLaneWidth:3,
    done:false,holdJudgment:null,holdDeltaMs:0,index:0,endFlick:true,slidePoints:points};
  runtime.record('touch:1',xForLane(1.5),Y);
  runtime.bind('touch:1',note,'SLIDE',1000,0);
  note.holdJudgment='MARVELOUS';note.holdDeltaMs=0;
  let settledAt=null;
  for(let t=1010;t<=2400;t+=10){
    // 遅れて追う指。lagMs だけ前の経路の位置にいる
    const lane=O.rhythmSlideExpectedLane(note,Math.min(Math.max(t-lagMs,1000),2000));
    runtime.record('touch:1',xForLane(lane),Y-(flick&&t>=1960?60:0));
    now=t;const cb=rafCb;rafCb=null;if(cb)cb();
    if(settledAt===null&&!runtime._sessions.has('touch:1')&&t<1950)settledAt=t;
    if(note.done)break;
  }
  return {judgment:note.holdJudgment,earlyMs:settledAt===null?0:2000-settledAt};
};

for(const lag of [20,40,60,80,100]){
  const r=playZigzag(lag,false);
  check(`ジグザグの経路を${lag}ms遅れで追っただけでは、終端より手前で確定しない`,
    r.earlyMs===0,`判定=${r.judgment}${r.earlyMs?` / ${r.earlyMs}ms手前で確定`:''}`);
}
for(const lag of [20,40,60,80,100]){
  const r=playZigzag(lag,true);
  check(`ジグザグの経路を${lag}ms遅れで追って弾けば、BADにもMISSにもならない`,
    r.judgment!=='BAD'&&r.judgment!=='MISS',`判定=${r.judgment}`);
}

// ── 実装の決めごと ──
check('フリックは「経路ぶんを引いた距離」と「指そのものの移動」の両方で見る',
  /const rawDx=pos\.clientX-session\.endFlickAnchorX,rawDy=pos\.clientY-session\.endFlickAnchorY;/.test(source)
  &&/Math\.hypot\(dx,dy\)>=RHYTHM_FLICK_DISTANCE_PX\s*\n\s*&&Math\.hypot\(rawDx,rawDy\)>=RHYTHM_FLICK_DISTANCE_PX/.test(source));

check('経路が速く動いているあいだの検出では、指を離すのを待たずに確定させない',
  /session\.endFlickUncertain=true;/.test(source)
  &&/session\.endFlickDone&&!session\.endFlickUncertain&&!session\.endFlickReleased/.test(source));
check('弾いたまま指を置いていたら、終端でMISSにしない',
  /session\.failed\|\|\(session\.endFlickRequired&&!session\.endFlickDone\)\?'MISS'/.test(source));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
