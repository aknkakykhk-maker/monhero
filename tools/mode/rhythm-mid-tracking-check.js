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
// 2026-09-11、許容の式に難易度ぶんのボーナスが乗ったので末尾が `4;` ではなくなった。
// 式そのものを追いかけると同じことを繰り返すので、その1行の終わり(改行)までで切る。
const flickConsts=source.match(/const RHYTHM_FLICK_DISTANCE_PX = 24;[\s\S]*?const rhythmSlideTrackingTolerance=[^\n]*\n/)?.[0];
const slideHelpers=source.match(/const rhythmSlidePoints=[\s\S]*?const rhythmSlideExpectedLane=[\s\S]*?\n\};/)?.[0];
// 2026-09-12、SLIDEの途中判定がチェックポイント方式になったので、そのしくみも切り出す。
// bind が rhythmSlideNoteCheckpoints を呼ぶため、無いと runtime がそもそも動かない。
const slideCheckpoints=source.match(/const RHYTHM_SLIDE_CHECKPOINT_BASE_MS=[\s\S]*?const rhythmSlideTrackingFloor=[\s\S]*?\n\};/)?.[0];
// release() が終端の判定を合成するのに使う道具。最終判定まで通して確かめるために要る。
const releaseHelpers=source.match(/const rhythmJudgeRelease=deltaMs=>\{[\s\S]*?const rhythmWorseJudgment=[\s\S]*?\n\};/)?.[0];
const floatingHelpers=source.match(/const RHYTHM_HOLD_HANDOVER_GRACE_MS=[\s\S]*?const rhythmFloatingNotesClear=[^\n]*\n/)?.[0];
const midTrackingConsts=source.match(/const RHYTHM_MID_TRACKING_GRACE_MS=[\s\S]*?const rhythmHoldTrackedLane=[\s\S]*?\n\};/)?.[0];
const runtimeBody=source.match(/const RHYTHM_GESTURE_RUNTIME=\(\(\)=>\{[\s\S]*?\n\}\)\(\);/)?.[0];
check('依存ブロックをすべて抽出できる',!!perf&&!!projection&&!!flickConsts&&!!slideHelpers&&!!slideCheckpoints&&!!releaseHelpers&&!!floatingHelpers&&!!midTrackingConsts&&!!runtimeBody);
if(!(projection&&flickConsts&&slideHelpers&&slideCheckpoints&&releaseHelpers&&floatingHelpers&&midTrackingConsts&&runtimeBody)){console.log(`\n${failed}件のNGがあります`);process.exit(1);}

check('猶予は暫定120ms',/const RHYTHM_MID_TRACKING_GRACE_MS=120;/.test(midTrackingConsts));
check('HOLD横ズレの余白は暫定0.15レーン(0.3サブレーン)',/const RHYTHM_HOLD_TRACKING_MARGIN_LANES=\.15;/.test(midTrackingConsts));

let now=0;
const pendingFrames=[];
const rect={left:0,top:0,width:500,height:1000};
const fakeArea={getBoundingClientRect:()=>rect};
const fakeDocument={
  querySelector:sel=>sel==='[data-rhythm-play-area]'?fakeArea:null,
  addEventListener:()=>{},
};
const context={
  document:fakeDocument,
  performance:{now:()=>now},
  // 2026-09-12: チェックポイント(SLIDEの途中判定)は tick から見るので、
  // rAF を本物らしく動かす。空のままだと「1件も見ないまま終わる」経路しか試せない。
  requestAnimationFrame:fn=>{pendingFrames.push(fn);return pendingFrames.length;},
  cancelAnimationFrame:()=>{pendingFrames.length=0;},
  RHYTHM_LANE_COUNT:5,
  rhythmInputEdgeMarginSubLanes:()=>1, // 切り出し範囲の外の関数の代役(既定の余白1)
};
vm.createContext(context);
vm.runInContext(`${judgments}\n${perf}\n${projection}\n${flickConsts}\n${slideHelpers}\n${slideCheckpoints}\n${releaseHelpers}\n${floatingHelpers}\n${midTrackingConsts}\n${runtimeBody}\nthis.out=RHYTHM_GESTURE_RUNTIME;this.margin=rhythmHoldTrackingMarginLanes;this.tracked=rhythmHoldTrackedLane;`,context);
const runtime=context.out;

// レーン座標→実座標(クリック位置)への変換。rhythmLaneCoordinateAtPointの逆算。
// yRatio=1(判定ライン付近)固定でよい: rhythmProjectBoundaryは1.24乗のscaleを使うが、
// yRatio=1では scale=1 になるため、境界も等間隔(0,1,2,3,4,5)になる。
const clientXFor=laneCenterCoordinate=>{
  const nx=(laneCenterCoordinate+.5)/5;
  return rect.left+nx*rect.width;
};
const clientY=rect.top+rect.height; // yRatio=1

// 実機と同じく、時間を進めるあいだ 16ms ごとに1フレーム回す。
// これを回さないと tick が動かず、チェックポイントが1件も見られない。
const pump=()=>{const frames=pendingFrames.splice(0,pendingFrames.length);frames.forEach(fn=>{try{fn();}catch(e){}});};
const advance=ms=>{
  const end=now+ms;
  while(now<end){now=Math.min(end,now+16);pump();}
};

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

// --- HOLD: 判定ラインより奥を押さえた指でも、帯の上に居れば失敗しない(2026-10-06・ハルカ MASTER 15.26秒の端の細いHOLD) ---
// 追従は、押し始めのタップと同じ「指のその場の高さ」で位置を測る。判定ラインの高さへ直して測ると、
// 奥を押さえた指が中央寄りへずれて見え、押し始めは通ったのに押している最中に外れ扱いになっていた。
{
  const depth=.62,fingerY=rect.top+rect.height*depth;
  const stripeX=lane=>rect.left+vm.runInContext(`rhythmProjectLane(${lane},${depth}).center`,context)*rect.width;
  const run=(lane,subLane,width)=>{
    const note={type:'HOLD',timeMs:1000,endTimeMs:3000,lane,subLane,subLaneWidth:width,activePointerId:'p1',holdJudgment:'MARVELOUS',holdDeltaMs:0,done:false};
    now=0;
    runtime.record('touch:1',stripeX(lane),fingerY);
    runtime.bind('touch:1',note,'HOLD',1000,0);
    for(let i=0;i<30;i++){advance(50);runtime.record('touch:1',stripeX(lane),fingerY);}
    const result=note.holdJudgment;runtime.clear();return result;
  };
  check('HOLD: 奥を押さえた指が端のレーンの帯の上に居続けても失敗しない(幅2)',run(4,8,2)==='MARVELOUS','holdJudgment='+run(4,8,2));
  check('HOLD: 奥を押さえた指が端のレーンの細い帯(幅1)の上に居続けても失敗しない',run(4,9,1)==='MARVELOUS','holdJudgment='+run(4,9,1));
  check('HOLD: 追従の許容は押し始めのタップの受付と同じ広がり(細い帯 .45 / それ以外 .6 サブレーン)',
    context.margin(1)===.45/2&&context.margin(2)===.6/2,'細い='+context.margin(1)+' ふつう='+context.margin(2));
}

// --- HOLD: 終わりの100msは外れを見ない(離すときの接点の動きで外れ扱いにしない・2026-10-07) ---
{
  const run=(farFromElapsed)=>{
    const note={type:'HOLD',timeMs:1000,endTimeMs:3000,lane:2,subLane:4,subLaneWidth:2,activePointerId:'p1',holdJudgment:'MARVELOUS',holdDeltaMs:0,done:false};
    const tracked=context.tracked(note),farLane=tracked.center+tracked.half+1;
    now=0;runtime.record('touch:1',clientXFor(2),clientY);runtime.bind('touch:1',note,'HOLD',1000,0);
    let t=0;while(t<farFromElapsed){advance(50);t+=50;runtime.record('touch:1',clientXFor(2),clientY);}
    for(let i=0;i<4;i++){advance(50);runtime.record('touch:1',clientXFor(farLane),clientY);}
    const result=note.holdJudgment;runtime.clear();return result;
  };
  check('HOLD: 終わりの100ms以内に外れても(猶予を超えても)MISSにしない',run(1950)==='MARVELOUS','holdJudgment='+run(1950));
  check('HOLD: 終わりの100msより前に外れて猶予を超えたらMISS(従来どおり)',run(1000)==='MISS','holdJudgment='+run(1000));
}

// --- HOLD: 帯が細くなっていくとき、少し前の太さまでは外れにしない(指は目で見て動くので帯の変化に遅れる・2026-10-07) ---
{
  const mk=()=>({type:'HOLD',timeMs:1000,endTimeMs:3000,lane:2,subLane:2,subLaneWidth:6,
    holdPoints:[{timeMs:1000,subLane:2,subLaneWidth:6},{timeMs:1500,subLane:2,subLaneWidth:6},{timeMs:1560,subLane:4,subLaneWidth:2}],
    activePointerId:'p1',holdJudgment:'MARVELOUS',holdDeltaMs:0,done:false});
  const note0=mk(),wide=context.tracked(note0);
  const edgeLane=wide.center+wide.half-.1; // 太い帯のふちの内側(細くなると帯の外)
  const play=(elapsedEnd)=>{
    const note=mk();now=0;runtime.record('touch:1',clientXFor(wide.center),clientY);runtime.bind('touch:1',note,'HOLD',1000,0);
    let t=0;while(t<450){advance(50);t+=50;runtime.record('touch:1',clientXFor(edgeLane),clientY);}
    while(t<elapsedEnd){advance(20);t+=20;runtime.record('touch:1',clientXFor(edgeLane),clientY);}
    const result=note.holdJudgment;runtime.clear();return result;
  };
  check('HOLD: 帯が細くなった直後(少し前の太さの間)は、ふちにいた指を外れにしない',play(560+140)==='MARVELOUS','holdJudgment='+play(560+140));
  check('HOLD: 細くなって十分たち、まだ外れたままならMISS',play(560+700)==='MISS','holdJudgment='+play(560+700));
}

// --- 押さえ始めの時計(2026-10-07・点検で「押した瞬間の遅れぶん巻き戻す」を入れたが、同日21時に戻した) ---
// ユーザー報告「昨日から色々直してかなりタップ抜けがひどくなった」。補正の効きすぎを疑い、原因が分かるまで巻き戻さない
{
  const note0=()=>({type:'HOLD',timeMs:1000,endTimeMs:3000,lane:2,subLane:4,subLaneWidth:2,activePointerId:'p1',holdJudgment:'MARVELOUS',holdDeltaMs:0,done:false});
  now=500;runtime.record('touch:1',clientXFor(2),clientY);
  runtime.setInputAge(60);runtime.bind('touch:1',note0(),'HOLD',1000,0);
  const withAge=runtime._sessions.get('touch:1')?.startPerfMs;runtime.clear();
  runtime.record('touch:1',clientXFor(2),clientY);
  runtime.setInputAge(0);runtime.bind('touch:1',note0(),'HOLD',1000,0);
  const noAge=runtime._sessions.get('touch:1')?.startPerfMs;runtime.clear();
  check('押さえ始めの時計: 遅れがあっても、いまは巻き戻さない(10/6夕方の動き)',withAge===now,'startPerfMs='+withAge);
  check('押さえ始めの時計: 遅れが無いときはこれまでどおり',noAge===now,'startPerfMs='+noAge);
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

// --- SLIDE: 外れても打ち切らない。落ちるのはチェックポイントだけ ---
//
// 【2026-09-12・ユーザー指示】
// 「スライドってずれたりしたらミス扱いになるでしょ / あれを判定線を設けてそのときに
//   押されてなきゃミス扱いになるようにできないの？ / 音ゲーとかってだいたいそうなってない？」
//
// 直す前は、猶予を超えて外れた**その場でノーツを打ち切って**いた
// (holdJudgment='MISS' / endTimeMs を現在より前へ)。復帰する道が無かった。
// いまは、外れているあいだに来たチェックポイントが落ちるだけで、指を戻せば続きは拾える。
const makeSlideNote=()=>({type:'SLIDE',timeMs:1000,endTimeMs:3000,lane:0,endLane:4,
  slidePoints:[{timeMs:1000,lane:0},{timeMs:3000,lane:4}],subLaneWidth:2,
  activePointerId:'p1',holdJudgment:'MARVELOUS',holdDeltaMs:0,done:false});
{
  const note=makeSlideNote();
  now=0;
  runtime.record('touch:1',clientXFor(0),clientY);
  runtime.bind('touch:1',note,'SLIDE',1000,0);
  advance(500); // chartNow=1500, expectedLane=0.2
  runtime.record('touch:1',clientXFor(4),clientY); // 経路と大きく離れた位置に居座る
  advance(400); // 猶予(120ms)を大きく超過
  check('SLIDE: 猶予を超えて外れてもその場で打ち切らない',note.holdJudgment!=='MISS','holdJudgment='+note.holdJudgment);
  check('SLIDE: 終了時刻を手前へ寄せない(復帰できる)',Number(note.endTimeMs)===3000,'endTimeMs='+note.endTimeMs);
  const session=[...runtime._sessions.values()][0];
  check('SLIDE: 外れているあいだのチェックポイントが落ちている',
    session&&session.checkpointIndex>0&&session.checkpointPassed<session.checkpointIndex,
    session?`${session.checkpointPassed}/${session.checkpointIndex}`:'セッションなし');
  runtime.clear();
}

// --- SLIDE: 指を戻せば続きは拾える(復帰できる) ---
{
  const note=makeSlideNote();
  now=0;
  runtime.record('touch:1',clientXFor(0),clientY);
  runtime.bind('touch:1',note,'SLIDE',1000,0);
  advance(400);
  runtime.record('touch:1',clientXFor(4),clientY); // いったん外れる
  advance(300);
  const session=[...runtime._sessions.values()][0];
  const droppedWhileOff=session.checkpointIndex-session.checkpointPassed;
  // 経路へ戻す。bind は now=0 / startSongMs=1000 なので chartNow=1000+now、
  // 的の位置は (chartNow-1000)/2000*4 = now/500 レーン。
  for(let i=0;i<40;i++){
    runtime.record('touch:1',clientXFor(Math.max(0,Math.min(4,now/500))),clientY);
    advance(16);
  }
  const recovered=session.checkpointIndex-session.checkpointPassed;
  check('SLIDE: 指を戻したあとのチェックポイントは落ちない',recovered===droppedWhileOff,
    `外れていた間 ${droppedWhileOff}件 / 戻したあとも ${recovered}件`);
  runtime.clear();
}

// --- SLIDE: たくさん落とすと最終判定が下がる ---
{
  const note=makeSlideNote();
  now=0;
  runtime.record('touch:1',clientXFor(0),clientY);
  runtime.bind('touch:1',note,'SLIDE',1000,0);
  runtime.record('touch:1',clientXFor(4),clientY); // 最初から最後まで外れっぱなし
  advance(1900);
  const session=[...runtime._sessions.values()][0];
  const seen=session.checkpointIndex,passed=session.checkpointPassed;
  runtime.release('touch:1');
  check('SLIDE: 半分以上落としたらMISS',note.holdJudgment==='MISS',
    `${passed}/${seen} → ${note.holdJudgment}`);
  runtime.clear();
}

// --- SLIDE: 全部通ればこれまでどおり(押さえを掛けない) ---
{
  const note=makeSlideNote();
  now=0;
  runtime.record('touch:1',clientXFor(0),clientY);
  runtime.bind('touch:1',note,'SLIDE',1000,0);
  for(let i=0;i<110;i++){
    runtime.record('touch:1',clientXFor(Math.max(0,Math.min(4,now/500))),clientY);
    advance(16);
  }
  const session=[...runtime._sessions.values()][0];
  check('SLIDE: 経路どおりならチェックポイントを全部通る',
    session.checkpointIndex>0&&session.checkpointPassed===session.checkpointIndex,
    `${session.checkpointPassed}/${session.checkpointIndex}`);
  runtime.clear();
}

// --- 通過率から決まる押さえ(判定のグレード) ---
{
  const grade=vm.runInContext('rhythmSlideTrackingFloor',context);
  check('通過率100%は押さえを掛けない(nullを返す)',grade(10,10)===null);
  check('通過率90%はGREATまで',grade(9,10)==='GREAT');
  check('通過率70%はGOODまで',grade(7,10)==='GOOD');
  check('通過率50%はBADまで',grade(5,10)==='BAD');
  check('通過率50%未満はMISS',grade(4,10)==='MISS');
  check('1件も見ていないときは押さえを掛けない(rAFが止まっていても全滅しない)',grade(0,0)===null);
}

// --- チェックポイントの間隔は曲(レベル)と難易度で変わる ---
{
  const interval=vm.runInContext('rhythmSlideCheckpointIntervalMs',context);
  const masterMedian=interval('MASTER',25),masterHard=interval('MASTER',39),masterEasy=interval('MASTER',15);
  // 難易度どうしは「その難易度の標準的な譜面どうし」で比べる。
  // レベルを固定して比べると、起こらない状況(EASYのLv.13など)を比べることになる。
  const atOwnLevel={EASY:interval('EASY',4),NORMAL:interval('NORMAL',8),HARD:interval('HARD',13),
    EXPERT:interval('EXPERT',18),MASTER:interval('MASTER',25)};
  check('やさしい難易度ほど間隔が長い(チェックポイントが少ない)',
    atOwnLevel.EASY>atOwnLevel.NORMAL&&atOwnLevel.NORMAL>atOwnLevel.HARD
    &&atOwnLevel.HARD>atOwnLevel.EXPERT&&atOwnLevel.EXPERT>atOwnLevel.MASTER,
    Object.entries(atOwnLevel).map(([k,v])=>`${k} ${v.toFixed(0)}ms`).join(' > '));
  check('同じ難易度でも歯ごたえのある譜面ほど細かい',masterHard<masterMedian&&masterMedian<masterEasy,
    `Lv.39 ${masterHard.toFixed(0)}ms < Lv.25 ${masterMedian.toFixed(0)}ms < Lv.15 ${masterEasy.toFixed(0)}ms`);
  check('レベルが無くても壊れない(基準値そのまま)',interval('MASTER',null)===125&&interval('MASTER',0)===125);
  check('極端なレベルでも上下の限界を超えない',
    interval('EASY',1)<=400&&interval('MASTER',99)>=90);
}

// --- 猶予が0.1msでも短縮されていないか、定数の値を直接確認 ---
function RHYTHM_HOLD_TRACKING_MARGIN_LANES_VALUE(text){return Number(text.match(/RHYTHM_HOLD_TRACKING_MARGIN_LANES=([\d.]+);/)?.[1]);}

// --- HOLDを押さえている途中も、押し始めと同じ範囲で見るか(2026-10-07) ---
// 押し始めは「判定ラインより下の指は判定ラインの高さに直した位置でも見る」。押さえている最中が指のその場の高さだけだと、
// 端のレーンを画面の手前で押さえたとき「押し始めは通るのに途中で外れ」になる(ユーザー報告「ホールド近くのノーツを押すときにホールドが切れる」)
{
  const src=require('fs').readFileSync(require('path').join(__dirname,'..','..','monster-hero','data','rhythm-mode.js'),'utf8');
  const holdBranch=src.slice(src.indexOf('// 終わりの100msは外れを見ない'),src.indexOf('if(!bad){session.trackingBadSincePerf=null;return;}'));
  check('HOLDの追従が、判定ラインより下では判定ラインの高さに直した位置でも見る(押し始めと同じ)',
    /rhythmSubLaneCoordinateAtLineIfBelow\(pos\.clientX,pos\.clientY,areaBox\)/.test(holdBranch)&&/bad=off\(actual\)&&off\(atLine\)/.test(holdBranch));
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
