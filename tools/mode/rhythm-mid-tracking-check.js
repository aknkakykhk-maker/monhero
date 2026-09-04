// HOLD / SLIDE の途中追従判定(暫定値)を確認する。
//
// これまでSLIDEは、経路から1サンプルでも外れた瞬間に即MISS確定していた。iPhoneの
// 指ブレで一瞬だけ外れても即失敗になり得るため、外れてから一定の猶予(暫定120ms)を
// 超えて戻らない場合だけMISS確定するよう変更した。またHOLDには横ズレ判定が無く、
// 指をどれだけ動かしても始点さえ取れば通ってしまっていたため、HOLDにも同様の
// 追従判定(暫定: 帯の半分幅+0.3サブレーン)を追加した。
//
// 途中失敗を確定した瞬間、指を離すのを待たずその場でMISS扱いにする(既存の
// scheduleTickが持つ「endTimeMs到達でapplyJudgmentを呼ぶ」経路をそのまま使い、
// 新しい判定経路・追加スコアは作らない)。
//
//   node tools/mode/rhythm-mid-tracking-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- 実装から依存ブロックを抜き出してNode上で動かす ---
// 性能計測(デバッグ限定)の記録器。areaRect などが呼ぶので、抽出範囲へ含める
const perf=source.match(/const RHYTHM_PERF_KEY=[\s\S]*?\n\}\)\(\);/)?.[0];
const projection=source.match(/const RHYTHM_PROJECTION_TOP_SCALE=[\s\S]*?const rhythmLaneAtPoint=[\s\S]*?\n\};/)?.[0];
// 2026-09-05、終端の窓(RHYTHM_RELEASE_MAX_MS)を判定表のいちばん外側から作るようにしたので、
// 切り出す依存に判定表そのものを足す(数字を2か所に持たないための変更に合わせたもの)。
const judgments=source.match(/const RHYTHM_JUDGMENTS = Object\.freeze\(\[[\s\S]*?const RHYTHM_INPUT_MATCH_WINDOW_MS[\s\S]*?;/)?.[0];
const flickConsts=source.match(/const RHYTHM_FLICK_DISTANCE_PX = 24;[\s\S]*?const rhythmSlideTrackingTolerance=[\s\S]*?4;/)?.[0];
const slideHelpers=source.match(/const rhythmSlidePoints=[\s\S]*?const rhythmSlideExpectedLane=[\s\S]*?\n\};/)?.[0];
const midTrackingConsts=source.match(/const RHYTHM_MID_TRACKING_GRACE_MS=[\s\S]*?const rhythmHoldTrackedLane=[\s\S]*?\n\};/)?.[0];
const runtimeBody=source.match(/const RHYTHM_GESTURE_RUNTIME=\(\(\)=>\{[\s\S]*?\n\}\)\(\);/)?.[0];
check('依存ブロックをすべて抽出できる',!!perf&&!!projection&&!!flickConsts&&!!slideHelpers&&!!midTrackingConsts&&!!runtimeBody);
if(!(projection&&flickConsts&&slideHelpers&&midTrackingConsts&&runtimeBody)){console.log(`\n${failed}件のNGがあります`);process.exit(1);}

check('猶予は暫定120ms',/const RHYTHM_MID_TRACKING_GRACE_MS=120;/.test(midTrackingConsts));
check('HOLD横ズレの余白は暫定0.15レーン(0.3サブレーン)',/const RHYTHM_HOLD_TRACKING_MARGIN_LANES=\.15;/.test(midTrackingConsts));

let now=0;
const rect={left:0,top:0,width:500,height:1000};
const fakeArea={getBoundingClientRect:()=>rect};
const fakeDocument={
  querySelector:sel=>sel==='[data-rhythm-play-area]'?fakeArea:null,
  addEventListener:()=>{},
};
const context={
  document:fakeDocument,
  performance:{now:()=>now},
  requestAnimationFrame:()=>0,
  cancelAnimationFrame:()=>{},
  RHYTHM_LANE_COUNT:5,
};
vm.createContext(context);
vm.runInContext(`${judgments}\n${perf}\n${projection}\n${flickConsts}\n${slideHelpers}\n${midTrackingConsts}\n${runtimeBody}\nthis.out=RHYTHM_GESTURE_RUNTIME;this.tracked=rhythmHoldTrackedLane;`,context);
const runtime=context.out;

// レーン座標→実座標(クリック位置)への変換。rhythmLaneCoordinateAtPointの逆算。
// yRatio=1(判定ライン付近)固定でよい: rhythmProjectBoundaryは1.24乗のscaleを使うが、
// yRatio=1では scale=1 になるため、境界も等間隔(0,1,2,3,4,5)になる。
const clientXFor=laneCenterCoordinate=>{
  const nx=(laneCenterCoordinate+.5)/5;
  return rect.left+nx*rect.width;
};
const clientY=rect.top+rect.height; // yRatio=1

const advance=ms=>{now+=ms;};

// --- HOLD: 中心に置き続ける限り絶対に失敗しない ---
{
  const note={type:'HOLD',timeMs:1000,endTimeMs:3000,lane:2,subLane:4,subLaneWidth:2,activePointerId:'p1',holdJudgment:'MARVELOUS',holdDeltaMs:0,done:false};
  now=0;
  runtime.record('touch:1',clientXFor(2),clientY);
  runtime.bind('touch:1',note,'HOLD',1000,0);
  for(let i=0;i<20;i++){advance(50);runtime.record('touch:1',clientXFor(2),clientY);}
  check('HOLD: 中心に置き続ける限り途中失敗しない',note.holdJudgment==='MARVELOUS','holdJudgment='+note.holdJudgment);
  runtime.clear();
}

// --- HOLD: 猶予未満の一瞬のズレは失敗にしない ---
{
  const note={type:'HOLD',timeMs:1000,endTimeMs:3000,lane:2,subLane:4,subLaneWidth:2,activePointerId:'p1',holdJudgment:'MARVELOUS',holdDeltaMs:0,done:false};
  const tracked=context.tracked(note),farLane=tracked.center+tracked.half+RHYTHM_HOLD_TRACKING_MARGIN_LANES_VALUE(midTrackingConsts)+.2;
  now=0;
  runtime.record('touch:1',clientXFor(2),clientY);
  runtime.bind('touch:1',note,'HOLD',1000,0);
  advance(60);runtime.record('touch:1',clientXFor(farLane),clientY); // 許容を超える位置(猶予内)
  advance(60);runtime.record('touch:1',clientXFor(2),clientY); // 猶予(120ms)未満で中心へ戻す
  check('HOLD: 猶予(120ms)未満で戻れば失敗にならない',note.holdJudgment==='MARVELOUS','holdJudgment='+note.holdJudgment);
  runtime.clear();
}

// --- HOLD: 猶予を超えて外れたままなら、その場でMISS確定し離すのを待たない ---
{
  const note={type:'HOLD',timeMs:1000,endTimeMs:3000,lane:2,subLane:4,subLaneWidth:2,activePointerId:'p1',holdJudgment:'MARVELOUS',holdDeltaMs:0,done:false};
  const tracked=context.tracked(note),farLane=tracked.center+tracked.half+RHYTHM_HOLD_TRACKING_MARGIN_LANES_VALUE(midTrackingConsts)+1;
  now=0;
  runtime.record('touch:1',clientXFor(2),clientY);
  runtime.bind('touch:1',note,'HOLD',1000,0);
  advance(60);runtime.record('touch:1',clientXFor(farLane),clientY); // 外れ始め(この時点ではまだ猶予内)
  check('HOLD: 外れ始めた直後はまだ確定しない',note.holdJudgment==='MARVELOUS','holdJudgment='+note.holdJudgment);
  advance(200);runtime.record('touch:1',clientXFor(farLane),clientY); // 猶予(120ms)を超えて外れたまま
  check('HOLD: 猶予を超えて外れたままならMISS確定',note.holdJudgment==='MISS');
  check('HOLD: 指を離す前にendTimeMsを現在より前へ寄せて即座に判定させる',note.endTimeMs<1260&&note.endTimeMs<3000,'endTimeMs='+note.endTimeMs);
  check('HOLD: 指が有効なまま(activePointerIdは維持=applyJudgment側が処理する)',note.activePointerId==='p1');
  runtime.clear();
}

// --- SLIDE: 経路上に居続ける限り失敗しない ---
{
  const note={type:'SLIDE',timeMs:1000,endTimeMs:3000,lane:0,endLane:4,slidePoints:[{timeMs:1000,lane:0},{timeMs:3000,lane:4}],subLaneWidth:2,activePointerId:'p1',holdJudgment:'MARVELOUS',holdDeltaMs:0,done:false};
  now=0;
  runtime.record('touch:1',clientXFor(0),clientY);
  runtime.bind('touch:1',note,'SLIDE',1000,0);
  for(let i=1;i<=10;i++){advance(100);const expectedLane=i*0.2;runtime.record('touch:1',clientXFor(expectedLane),clientY);}
  check('SLIDE: 経路どおりに追従する限り途中失敗しない',note.holdJudgment==='MARVELOUS','holdJudgment='+note.holdJudgment);
  runtime.clear();
}

// --- SLIDE: 猶予を超えて経路から外れたままならMISS確定 ---
{
  const note={type:'SLIDE',timeMs:1000,endTimeMs:3000,lane:0,endLane:4,slidePoints:[{timeMs:1000,lane:0},{timeMs:3000,lane:4}],subLaneWidth:2,activePointerId:'p1',holdJudgment:'MARVELOUS',holdDeltaMs:0,done:false};
  now=0;
  runtime.record('touch:1',clientXFor(0),clientY);
  runtime.bind('touch:1',note,'SLIDE',1000,0);
  advance(500); // chartNow=1500, expectedLane=0.2
  runtime.record('touch:1',clientXFor(4),clientY); // 経路と大きく離れた位置に居座る
  advance(200); // 猶予(120ms)超過
  runtime.record('touch:1',clientXFor(4),clientY);
  check('SLIDE: 猶予を超えて経路から外れたままならMISS確定',note.holdJudgment==='MISS');
  check('SLIDE: 指を離す前に即座に判定させる',note.endTimeMs<1700);
  runtime.clear();
}

// --- 猶予が0.1msでも短縮されていないか、定数の値を直接確認 ---
function RHYTHM_HOLD_TRACKING_MARGIN_LANES_VALUE(text){return Number(text.match(/RHYTHM_HOLD_TRACKING_MARGIN_LANES=([\d.]+);/)?.[1]);}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
