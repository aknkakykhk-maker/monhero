// 「指の座標 → レーン」の変換1回ごとに強制レイアウトが走っていないかを、実際に動かして数える。
//
// 以前は areaRect() が呼ばれるたびに querySelector と getBoundingClientRect()
// (=強制レイアウト)を行っていた。HOLD/SLIDEを押している最中は、
//   ・ジェスチャー側rAFが毎フレーム、押している指の数だけ
//   ・pointermove / touchmove が来るたびに1回
// 走るため、1フレームのあいだに何度もレイアウトを確定させていた。
//
// 同じフレームのあいだは測り直さず共有するようにしたので、ここではその効果を数値で確かめる。
// あわせて「フレームが変わったら必ず測り直す」「画面サイズが変わったら捨てる」も確認する。
// **キャッシュがズレると入力位置がずれる**ため、鮮度の確認がこの検査の主目的。
//
//   node tools/mode/rhythm-input-cost-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const source=read('monster-hero/data/rhythm-mode.js');
const game=read('monster-hero/src/game-system.jsx');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const laneConsts=[source.match(/const RHYTHM_LANE_COUNT\s*=[^\n]*/)?.[0],source.match(/const RHYTHM_SUB_LANE_COUNT\s*=[^\n]*/)?.[0]].filter(Boolean).join('\n');
const perf=source.match(/const RHYTHM_PERF_KEY=[\s\S]*?\n\}\)\(\);/)?.[0];
const projection=source.match(/const RHYTHM_PROJECTION_TOP_SCALE=[\s\S]*?const rhythmLaneAtPoint=[\s\S]*?\n\};/)?.[0];
// 2026-09-05、終端の窓(RHYTHM_RELEASE_MAX_MS)を判定表のいちばん外側から作るようにしたので、
// 切り出す依存に判定表そのものを足す(数字を2か所に持たないための変更に合わせたもの)。
const judgments=source.match(/const RHYTHM_JUDGMENTS = Object\.freeze\(\[[\s\S]*?const RHYTHM_INPUT_MATCH_WINDOW_MS[\s\S]*?;/)?.[0];
const flickConsts=source.match(/const RHYTHM_FLICK_DISTANCE_PX = 24;[\s\S]*?const rhythmSlideTrackingTolerance=[\s\S]*?4;/)?.[0];
const slideHelpers=source.match(/const rhythmSlidePoints=[\s\S]*?const rhythmSlideExpectedLane=[\s\S]*?\n\};/)?.[0];
const midTracking=source.match(/const RHYTHM_MID_TRACKING_GRACE_MS=[\s\S]*?const rhythmHoldTrackedLane=[\s\S]*?\n\};/)?.[0];
const runtime=source.match(/const RHYTHM_GESTURE_RUNTIME=\(\(\)=>\{[\s\S]*?\n\}\)\(\);/)?.[0];
check('依存ブロックをすべて抽出できる',!!laneConsts&&!!judgments&&!!perf&&!!projection&&!!flickConsts&&!!slideHelpers&&!!midTracking&&!!runtime);
if(!(perf&&projection&&flickConsts&&slideHelpers&&midTracking&&runtime))process.exit(1);

// ── 実装が触る最低限のDOMを用意する ──────────────────────────────────────
let layoutReads=0,domQueries=0;
const RECT={left:0,top:0,width:390,height:743,right:390,bottom:743};
const playArea={
  isConnected:true,
  getBoundingClientRect(){layoutReads++;return {...RECT};},
  dispatchEvent(){return true;},
  closest(){return playArea;},
};
const listeners=new Map();
const context={
  performance:{now:()=>nowMs},
  requestAnimationFrame:()=>0,
  cancelAnimationFrame:()=>{},
  localStorage:undefined,
  document:{
    querySelector(sel){domQueries++;return sel.includes('play-area')?playArea:null;},
    querySelectorAll(){domQueries++;return [];},
    addEventListener(){},removeEventListener(){},
  },
};
context.window={
  addEventListener(type,fn){listeners.set(type,fn);},
  removeEventListener(){},
  visualViewport:null,
};
let nowMs=0;
vm.createContext(context);
vm.runInContext(`${laneConsts}\n${judgments}\n${perf}\n${projection}\n${flickConsts}\n${slideHelpers}\n${midTracking}\n${runtime}\nthis.out={RHYTHM_GESTURE_RUNTIME,RHYTHM_PERF};`,context);
const {RHYTHM_GESTURE_RUNTIME:RUNTIME,RHYTHM_PERF:PERF}=context.out;

check('画面が動く操作でキャッシュを捨てる購読がある',
  listeners.has('resize')&&listeners.has('orientationchange')&&listeners.has('scroll'),
  [...listeners.keys()].join(', '));
check('キャッシュを捨てる入口が公開されている(本体rAFから毎フレーム呼ぶ)',
  typeof RUNTIME.invalidateAreaRect==='function');

// ── 1フレーム内で何度座標を変換しても、測り直しは1回だけ ────────────────
const note={index:0,type:'HOLD',lane:2,subLane:4,subLaneWidth:2,timeMs:1000,endTimeMs:9000,
  activePointerId:'p1',holdJudgment:'MARVELOUS',holdDeltaMs:0,done:false};
// レーン中央・判定ライン付近を押し続ける想定(途中失敗させずに移動だけを数える)
const centerX=RECT.left+RECT.width*((2+.5)/5),lineY=RECT.top+RECT.height;
RUNTIME.record('pointer:1',centerX,lineY);
RUNTIME.bind('pointer:1',note,'HOLD',1000,0);
RUNTIME.invalidateAreaRect();
layoutReads=0;domQueries=0;
for(let i=0;i<12;i++)RUNTIME.record('pointer:1',centerX,lineY);
check('同じフレーム内では何回動かしてもレイアウト測定は1回だけ',layoutReads===1,`${layoutReads}回 / 12回の移動`);
check('同じフレーム内ではDOM検索も1回だけ',domQueries===1,`${domQueries}回`);

// ── フレームが変わったら必ず測り直す(ズレを持ち越さない) ────────────────
RUNTIME.invalidateAreaRect();
layoutReads=0;domQueries=0;
RUNTIME.record('pointer:1',centerX,lineY);
check('フレームが変わったら測り直す',layoutReads===1,`${layoutReads}回`);

// ── 画面サイズが変わったら捨てる ────────────────────────────────────────
layoutReads=0;
RUNTIME.record('pointer:1',centerX,lineY);
check('捨てるまでは測り直さない',layoutReads===0,`${layoutReads}回`);
listeners.get('resize')();
RUNTIME.record('pointer:1',centerX,lineY);
check('resizeが来たら測り直す',layoutReads===1,`${layoutReads}回`);

// ── 位置がずれた古いrectを使い続けない ──────────────────────────────────
RECT.left=100;RECT.right=490;
listeners.get('scroll')();
const before=RUNTIME._sessions.get('pointer:1');
RUNTIME.record('pointer:1',centerX+100,lineY);
check('scrollで画面がずれたら新しいrectで判定する',
  playArea.getBoundingClientRect().left===100&&!!before,'rect.left=100');
RECT.left=0;RECT.right=390;

// ── 計測カウンタと実際の回数が一致する(計測が嘘をつかない) ──────────────
PERF.setEnabled(true);PERF.reset();
RUNTIME.invalidateAreaRect();
layoutReads=0;
for(let i=0;i<5;i++)RUNTIME.record('pointer:1',centerX,lineY);
const snap=PERF.snapshot();
PERF.setEnabled(false);
check('計測カウンタは実際のレイアウト測定回数と一致する',layoutReads===1,`実測${layoutReads}回`);

// (この検査は回数を数えるのが目的なので、判定の確定までは動かさない。
//  判定側は rhythm-mid-tracking-check.js が担当する)

// ── 本体rAFから毎フレーム捨てている ────────────────────────────────────
check('本体のrAFが毎フレームキャッシュを捨てている',
  /const tick=\(frameNowMs\)=>\{RHYTHM_PERF\.frame\(frameNowMs\);RHYTHM_GESTURE_RUNTIME\.invalidateAreaRect\(\);/.test(game));
check('ジェスチャー側rAFも毎フレーム捨てている',
  /const tick=\(\)=>\{\s*\n\s*raf=0;\s*\n\s*invalidateAreaRect\(\);/.test(source));

// ── サブレーン発光の再検索をやめている ──────────────────────────────────
check('サブレーン発光の要素を覚えて使い回す',
  /let glowNodes=null;/.test(source)
  &&/if\(!glowNodes\|\|!glowNodes\.length\|\|!glowNodes\[0\]\.isConnected\)\{/.test(source));
check('発光は変わったサブレーンだけ書き換える',
  /if\(want===\(el\.dataset\.rhythmTouchspan==='true'\)\)return;/.test(source));

// ── DOMの変化のたびに全ノーツを引き直していないか ──────────────────────
// decorate() は area 配下の全ノーツを引き直すので、無関係な変化でも走ると重い。
// 実際にMutationRecordを作って、走る/走らないを確かめる。
const observerFilter=[source.match(/const RHYTHM_DECORATE_TARGET='[^']*';/)?.[0],
  source.match(/const touchesPlayDom=records=>records\.some\([\s\S]*?\n  \}\);/)?.[0]].filter(Boolean).join('\n');
const observerFilterOk=/RHYTHM_DECORATE_TARGET/.test(observerFilter)&&/touchesPlayDom/.test(observerFilter);
check('関係する変化だけを拾うフィルタがある',observerFilterOk);
if(observerFilterOk){
  const el=(sel,inner=null)=>({nodeType:1,matches:s=>s.split(',').some(one=>one.trim()===sel),
    querySelector:s=>inner&&s.split(',').some(one=>one.trim()===inner)?{nodeType:1}:null});
  const ctx={};vm.createContext(ctx);
  vm.runInContext(`${observerFilter}\nthis.out=touchesPlayDom;`,ctx);
  const touches=ctx.out;
  const rec=(added=[],removed=[],type='childList')=>({type,addedNodes:added,removedNodes:removed});
  check('スコアやコンボの文字だけが変わったときは走らせない',
    touches([rec([],[],'characterData')])===false);
  check('関係ない要素が増えただけでは走らせない',
    touches([rec([el('[data-auto-bgm-picker]')],[])])===false);
  check('ノーツが増えたら走らせる',
    touches([rec([el('[data-rhythm-note]')],[])])===true);
  check('プレイ画面ごと差し替わったら走らせる',
    touches([rec([el('[data-nothing]','[data-rhythm-note]')],[])])===true);
  check('ノーツが消えたときも走らせる',
    touches([rec([],[el('[data-rhythm-note]')])])===true);
}
check('走った回数を計測できる',/RHYTHM_PERF\.noteRescan\(\);/.test(source));

// ── 入力の意味・判定条件は変えていない ──────────────────────────────────
check('入力座標の逆投影(rhythmLaneCoordinateAtPoint)は変更していない',
  source.includes('const rhythmLaneCoordinateAtPoint='));
check('途中追従の猶予と許容は変更していない',
  /const RHYTHM_MID_TRACKING_GRACE_MS=120;/.test(source)
  &&/const RHYTHM_HOLD_TRACKING_MARGIN_LANES=\.15;/.test(source));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
