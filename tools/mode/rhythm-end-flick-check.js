#!/usr/bin/env node
// 終点フリック(HOLD / SLIDE の終わりでフリックして離す)を確かめる。
//
//   node tools/mode/rhythm-end-flick-check.js
//
// ここで見張るのは次の4点。
//
//   1. endFlick を書いていない既存ノーツの挙動が1ミリも変わっていないこと
//      … 既存譜面・既存のBEST・ランキングは「離すだけ」で成立する前提で積み上がっている
//   2. 終点フリックが実際に成立すること(指を離さなくてもその場で判定が出る)
//   3. フリックしないまま離したらMISSになること(付けた意味が無くならないように)
//   4. 判定の基準そのもの(判定窓・rhythmJudgeRelease・フリック距離)を変えていないこと
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');

let now=0,rafCb=null;
const context={console,performance:{now:()=>now},requestAnimationFrame:cb=>{rafCb=cb;return 1;},cancelAnimationFrame:()=>{rafCb=null;}};
vm.createContext(context);
// デバッグ譜面の定義まで読み込む(曲テーブルはdocument前提の処理を含むため手前で切る)。
const prefix=source.split('const RHYTHM_SONGS',1)[0];
vm.runInContext(prefix+'\nthis.out={RHYTHM_GESTURE_RUNTIME,rhythmJudgeRelease,rhythmNoteWantsEndFlick,RHYTHM_END_FLICK_ARM_MS,RHYTHM_FLICK_DISTANCE_PX,RHYTHM_RELEASE_MAX_MS,endFlickHoldTestNotes,endFlickSlideTestNotes,endFlickMixTestNotes,monsterHeroEasyNotes,monsterHeroNormalNotes,monsterHeroHardNotes,atsuCupGestureTestNotes,atsuCupHoldTestNotes};',context);
const {RHYTHM_GESTURE_RUNTIME:runtime,rhythmJudgeRelease,rhythmNoteWantsEndFlick,
  RHYTHM_END_FLICK_ARM_MS,RHYTHM_FLICK_DISTANCE_PX,RHYTHM_RELEASE_MAX_MS,
  endFlickHoldTestNotes,endFlickSlideTestNotes,endFlickMixTestNotes,
  monsterHeroEasyNotes,monsterHeroNormalNotes,monsterHeroHardNotes,
  atsuCupGestureTestNotes,atsuCupHoldTestNotes}=context.out;

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};

// timeMs=1000 / endTimeMs=2000 のノーツを1本だけ握った状態から始める。
const start=(kind='HOLD',endFlick=false)=>{
  runtime.clear();now=1000;rafCb=null;
  const note={type:kind,timeMs:1000,endTimeMs:2000,lane:0,subLane:0,subLaneWidth:2,done:false,holdJudgment:null,holdDeltaMs:0,index:0,...(endFlick?{endFlick:true}:{})};
  if(kind==='SLIDE')note.slidePoints=[{timeMs:1000,lane:0},{timeMs:2000,lane:0}];
  runtime.record('touch:1',0,0);
  runtime.bind('touch:1',note,kind,1000,0);
  note.holdJudgment='MARVELOUS';note.holdDeltaMs=0;
  return note;
};
const session=()=>[...runtime._sessions.values()][0];
const frame=at=>{now=at;const cb=rafCb;rafCb=null;if(cb)cb();};

// --- 1. 判定の基準そのものを変えていない ---
// 終端の窓は、単発のタップの判定表のいちばん外側と同じ。数字を別に持たない
// (別々に持つと、タップだけ緩めて終端が置き去りになる)。
check('終端の判定窓はタップのいちばん外側と同じ',RHYTHM_RELEASE_MAX_MS===185);
// 終端の判定も、単発のタップと同じ表を使う（終点フリックのために別の表を作っていない）。
// 幅そのものは 2026-09-05 にユーザー指示で2回ゆるくした
// （25→40→55 / 50→75→100 / 100→130→150 / 150→170→200 / 200→240）。
check('終端の判定表を変えていない',
  [[0,'MARVELOUS'],[55,'MARVELOUS'],[56,'EXCELLENT'],[100,'EXCELLENT'],[101,'GREAT'],[150,'GREAT'],
   [151,'GOOD'],[170,'GOOD'],[171,'BAD'],[185,'BAD'],[186,'MISS']].every(([d,e])=>rhythmJudgeRelease(d)===e));
check('フリックの距離は単発FLICKと同じ24px',RHYTHM_FLICK_DISTANCE_PX===24);
check('終点フリックの受付は終端の250ms前から',RHYTHM_END_FLICK_ARM_MS===250);

// --- 2. endFlick を書いていないノーツは何も変わらない ---
check('endFlickを書かないHOLDは終点フリックの対象外',
  rhythmNoteWantsEndFlick({type:'HOLD'})===false&&rhythmNoteWantsEndFlick({type:'HOLD',endFlick:false})===false);
check('TAP / FLICK にendFlickを書いても対象にしない(HOLD・SLIDEだけ)',
  rhythmNoteWantsEndFlick({type:'TAP',endFlick:true})===false
  &&rhythmNoteWantsEndFlick({type:'FLICK',endFlick:true})===false
  &&rhythmNoteWantsEndFlick({type:'HOLD',endFlick:true})===true
  &&rhythmNoteWantsEndFlick({type:'SLIDE',endFlick:true})===true);
// SLIDE/FLICKはbindでtypeを'HOLD'へ化かすので、元の種別でも見分けられること
check('bind後(type=HOLDへ化けたあと)も元の種別で見分けられる',
  rhythmNoteWantsEndFlick({type:'HOLD',_rhythmOriginalType:'SLIDE',endFlick:true})===true
  &&rhythmNoteWantsEndFlick({type:'HOLD',_rhythmOriginalType:'FLICK',endFlick:true})===false);

let note=start('HOLD',false);
check('従来のHOLDは終点フリックの状態を持たない',session().endFlickRequired===false);
now=2000;runtime.release('touch:1');
check('従来のHOLDは終端で離すだけでMARVELOUS(挙動が変わっていない)',note.holdJudgment==='MARVELOUS',note.holdJudgment);

note=start('SLIDE',false);
now=2000;runtime.release('touch:1');
check('従来のSLIDEも終端で離すだけでMARVELOUS',note.holdJudgment==='MARVELOUS',note.holdJudgment);

// --- 3. 受付が終端の手前で始まる ---
note=start('HOLD',true);
check('終点フリックのHOLDはbind時にrequiredが立つ',session().endFlickRequired===true&&note._rhythmEndFlickRequired===true);
frame(1700);// 終端300ms前 = まだ受付前
check('受付は終端250msより前には始まらない',session().endFlickArmed===false);
frame(1800);// 終端200ms前 = 受付内
check('終端250ms以内に入ると受付が始まる',session().endFlickArmed===true);

// --- 4. 受付中は追従の外れでMISSにしない ---
// このNode上ではdocumentが無く laneCoordinate は必ずnull(=外れ)を返す。
// 受付前に同じ操作をするとMISSになる(下の対照)ので、受付中だけ見逃していることが分かる。
note=start('HOLD',true);
frame(1800);
for(let t=1800;t<=2000;t+=20){now=t;runtime.record('touch:1',10,0);}// 24px未満なので成立しない
check('受付中は的から外れてもMISSにしない(フリックの動作そのものだから)',note.holdJudgment==='MARVELOUS',note.holdJudgment);
check('24px未満の動きでは終点フリックが成立しない',session()&&session().endFlickDone===false&&!note._rhythmReleaseDone);
// 対照: 受付前に同じことをすると、従来どおり追従の外れでMISSになる
note=start('HOLD',true);
for(let t=1100;t<=1400;t+=20){now=t;runtime.record('touch:1',10,0);}
check('受付前は従来どおり追従が外れたままだとMISS(緩めていない)',note.holdJudgment==='MISS',note.holdJudgment);

// --- 5. フリックすれば、指を離さなくてもその場で判定が出る ---
note=start('HOLD',true);
frame(1800);
now=2000;runtime.record('touch:1',RHYTHM_FLICK_DISTANCE_PX,0);
check('24px動かせば終点フリックが成立する',note._rhythmEndFlickDone===true);
check('指を離さなくても終端判定が出る',note._rhythmReleaseDone===true&&note.holdJudgment==='MARVELOUS',note.holdJudgment);
check('本体が拾えるようendTimeMsを現在より前へ寄せる',note.endTimeMs<2000);
check('成立したらセッションを片付ける',runtime._sessions.size===0);

note=start('SLIDE',true);
frame(1800);
now=2000;runtime.record('touch:1',0,-RHYTHM_FLICK_DISTANCE_PX);// 上へ弾いても成立(方向指定なし)
check('SLIDEでも終点フリックが成立する',note._rhythmEndFlickDone===true&&note.holdJudgment==='MARVELOUS',note.holdJudgment);

// 判定は既存の窓のまま。ずれた時刻でフリックすれば、そのぶん判定が下がる。
note=start('HOLD',true);
frame(1800);
// 判定窓を広げたので、GOODになる遅れも変わる(+150msは今はGREAT)。
// 見張りたいのは「ずれたぶん判定が下がる」ことなので、いまGOODに当たる遅れへ直す。
now=2180;runtime.record('touch:1',30,0);
check('フリックの時刻で既存の判定窓どおりに判定する(+180ms=GOOD)',note.holdJudgment==='GOOD',note.holdJudgment);

// --- 6. フリックしないまま終わったらMISS ---
note=start('HOLD',true);
frame(1800);
now=2000;runtime.release('touch:1');
check('フリックせずに離すと、終端ちょうどでもMISS',note.holdJudgment==='MISS',note.holdJudgment);
check('フリックしなかったことが記録に残る',note._rhythmEndFlickDone===false);

note=start('HOLD',true);
frame(1800);frame(2000);frame(2200);
check('押しっぱなしのまま終端を過ぎたら従来どおりMISSガードが働く',note.holdJudgment==='MISS',note.holdJudgment);

// --- 7. 斜めのSLIDE(2026-09-14・ユーザー報告) ---
//
//   「斜めになってるスライダーノーツのフィニッシュ部分のフリックがなぜか到達前にミス扱いになる」
//
// 原因は、受付に入った瞬間の**指の位置**を基準にして移動量を測っていたこと。
// 斜めのSLIDEは受付(終端250ms前)に入ったあとも終端へ向かって指が動き続けるので、
// その移動がフリックとして拾われ、終端へ着く前に判定が確定していた。
// 終端まで200msあれば -200ms の終端判定になるので、窓(185ms)を外れてMISSになる。
//
// ここでは実際に指を軌道どおりへ動かして、
//   ・なぞるだけでは確定しない(フリックと取り違えない)
//   ・斜めでもフリックすれば、まっすぐなSLIDEと同じように成立する
// を確かめる。★laneCoordinate は画面の大きさを見るので、ここだけDOMを用意する。
{
  const RECT={left:0,top:0,width:390,height:743,right:390,bottom:743};
  const playArea={isConnected:true,getBoundingClientRect:()=>({...RECT}),dispatchEvent:()=>true,closest(){return playArea;}};
  context.document={querySelector:(sel)=>String(sel).includes('play-area')?playArea:null,
    querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
  vm.runInContext('this.geo={rhythmSlideExpectedLane,rhythmProjectBoundary,RHYTHM_LANE_COUNT,RHYTHM_JUDGMENT_LINE_Y};',context);
  const {rhythmSlideExpectedLane,rhythmProjectBoundary,RHYTHM_LANE_COUNT,RHYTHM_JUDGMENT_LINE_Y}=context.geo;
  const yRatio=RHYTHM_JUDGMENT_LINE_Y.ratio;
  const edgeL=rhythmProjectBoundary(0,yRatio),edgeR=rhythmProjectBoundary(RHYTHM_LANE_COUNT,yRatio);
  // 判定ラインの高さでの、そのレーンの中心x(px)
  const laneToX=(lane)=>(edgeL+(lane+.5)*(edgeR-edgeL)/RHYTHM_LANE_COUNT)*RECT.width;
  // points の軌道どおりに指を動かす。flickAt を渡すと、その時刻から上へ弾く
  const trace=(points,flickAt)=>{
    const target={type:'SLIDE',timeMs:1000,endTimeMs:2000,lane:points[0].lane,subLane:0,subLaneWidth:2,
      done:false,holdJudgment:'MARVELOUS',holdDeltaMs:0,index:0,endFlick:true,slidePoints:points};
    runtime.clear();now=1000;rafCb=null;
    runtime.record('touch:1',laneToX(points[0].lane),650);
    runtime.bind('touch:1',target,'SLIDE',1000,0);
    target.holdJudgment='MARVELOUS';target.holdDeltaMs=0;
    let settledAt=null;
    for(let t=1000;t<=2000;t+=5){
      now=t;
      const lane=rhythmSlideExpectedLane(target,t);
      const lift=(flickAt!==null&&t>=flickAt)?Math.min(60,(t-flickAt)*1.5):0;
      runtime.record('touch:1',laneToX(lane),650-lift);
      if(settledAt===null&&target.endTimeMs!==2000)settledAt=t;
    }
    return {note:target,settledAt};
  };
  const straight=[{timeMs:1000,lane:2},{timeMs:2000,lane:2}];
  const gentle=[{timeMs:1000,lane:0},{timeMs:2000,lane:4}];     // 1秒かけて4レーン移動
  const sharp=[{timeMs:1000,lane:0},{timeMs:1750,lane:0},{timeMs:2000,lane:4}]; // 終端250msで4レーン

  // ★なぞるだけ(フリックしない)なら、どの形でも終端の前に確定しない
  for(const [label,points] of [['まっすぐ',straight],['ゆるい斜め',gentle],['急な斜め',sharp]]){
    const {note:traced,settledAt}=trace(points,null);
    check(`${label}のSLIDEは、なぞるだけでは終端の前に確定しない`,
      settledAt===null&&traced.endTimeMs===2000&&traced.holdJudgment!=='MISS',
      `確定=${settledAt??'—'} / 判定=${traced.holdJudgment}`);
  }
  // ★フリックすれば、斜めでもまっすぐと同じように成立する
  //   ただし対象は「弾いたのか経路を追っただけなのか**見分けられる**形」だけ。
  //   急な斜めは下で別に見る(2026-09-18)。
  const results=[['まっすぐ',straight],['ゆるい斜め',gentle]]
    .map(([label,points])=>{const {note:traced}=trace(points,1900);return [label,traced.holdJudgment,traced._rhythmEndFlickDone];});
  check('斜めでもフリックすれば成立する',results.every(([,,done])=>done===true),
    results.map(([label,judgment])=>`${label}:${judgment}`).join(' / '));
  check('斜めかどうかで判定が変わらない',new Set(results.map(([,judgment])=>judgment)).size===1,
    results.map(([label,judgment])=>`${label}:${judgment}`).join(' / '));

  // ★受付のあいだに経路そのものが24pxより大きく振れる形(急な斜め＝終端250msで4レーン)は、
  //   指の追従が遅れるぶんだけで24pxを超えてしまい、「弾いた」と「追っただけ」を見分けられない。
  //   弾いたことは覚えるが、**指を離すのを待たずに確定させるのはやめる**(2026-09-18)。
  //   早く確定させると、終端の185ms手前で「大きく早い離し」としてBADが出ていた。
  //   確定させないあとの判定は rhythm-end-flick-swing-check.js / -diagonal-check.js が見る。
  {
    const {settledAt}=trace(sharp,1900);
    check('経路が大きく振れる形は、弾いても早く確定させない(見分けられないため)',
      settledAt===null,`確定=${settledAt??'—'}`);
  }

  // ★受付(250ms前)は終端の判定窓(185ms)より早い。窓の外で弾いても、そこでは確定しない。
  //   確定を待たずに release すると「まだ届いていない終端」への早い判定になってMISSになる
  {
    const early=trace(gentle,1760);          // 受付(1750ms〜)に入った直後に弾く
    check('窓の外で弾いても、そこでは確定しない(窓に入ってから確定する)',
      early.settledAt!==null&&early.settledAt>=2000-RHYTHM_RELEASE_MAX_MS,
      `確定=${early.settledAt??'—'} / 窓に入るのは ${2000-RHYTHM_RELEASE_MAX_MS}ms から`);
  }
  context.document=undefined;
}

// 【2026-09-05・指の置き換えに対応してから】
// 受付前に離しても、その場では判定を確定しない。持ち替えの途中かもしれないので
// 「浮いている」状態にして、戻ってこなければ本体のrAFが猶予(200ms)後にMISSにする。
// 終点フリックのノーツでも持ち替えはできる(押さえ直してから終わりで払う)
note=start('HOLD',true);
now=1500;runtime.release('touch:1');// 受付前に離した
check('受付前に離しても、その場では判定を確定しない',note.holdJudgment!=='MISS'&&note.releasedAtMs!=null,note.holdJudgment);
check('終わりの時刻を書き換えない(押さえ直せば続きから払える)',note.endTimeMs===2000,String(note.endTimeMs));
// 指が取り消されたときは持ち替えではないので、これまでどおりMISSで確定する
note=start('HOLD',true);
now=1500;runtime.release('touch:1',true);
check('指が取り消されたときはMISSで確定する',note.holdJudgment==='MISS',note.holdJudgment);

// --- 7. 実装の形 ---
check('受付に入ったら追従の外れ計測を捨てる',source.includes('session.trackingBadSincePerf=null;')
  &&/armEndFlick=\(session,pos\)=>\{/.test(source));
check('tickからも受付を始める(指が動かないままでも基準を作る)',
  /armEndFlick\(session,pos\);\n\s*evaluatePosition\(session,pos\);/.test(source));
check('フリックしなければ終端判定をMISSにする',
  source.includes("session.endFlickRequired&&!session.endFlickDone?'MISS'"));

// --- 8. 見た目 ---
check('終端バーへ終点フリックの目印を付ける',
  game.includes("data-rhythm-end-bar data-rhythm-end-flick={note.endFlick===true?'1':undefined}"));
check('終点フリックの終端バーだけ色と印を変える',
  source.includes('[data-rhythm-end-bar][data-rhythm-end-flick]{')
  &&source.includes('[data-rhythm-end-bar][data-rhythm-end-flick]::after{'));
// 「ここで弾く」の合図は単発FLICKと同じにする。別の記号・別の色にすると覚えることが増える。
// 2026-09-07・ユーザー指摘「フリックの矢印が小さくて見にくい」。文字(⇧)をやめ、
// 単発FLICK・終点フリックとも clip-path の三角を同じ大きさ(24×17px)で描く形にそろえた。
const html=fs.readFileSync(path.join(ROOT,'monster-hero/index.html'),'utf8');
check('印は単発FLICKと同じ形（clip-pathの三角。端末のフォントに左右されない）',
  source.includes('clip-path:polygon(50% 0,100% 100%,0 100%);')
  &&html.includes('[data-rhythm-flick-arrow] {')
  &&!/content:"[⇧▲]"/.test(source)&&!/content:"[⇧▲]"/.test(html));
check('印の大きさは単発FLICKとそろえる',
  (source.match(/width:24px;height:17px;/g)||[]).length>=2);
check('色も単発FLICKと同じ緑（判定と違う操作に見えないように）',
  /\[data-rhythm-end-bar\]\[data-rhythm-end-flick\]\{[^}]*#22c55e/.test(source)
  &&/\[data-rhythm-end-bar\]\[data-rhythm-end-flick\]::after\{[\s\S]*?#4ade80/.test(source));
check('印は奥行きの縦つぶれを打ち消す',
  source.includes('scaleY(calc(1 / var(--rhythm-end-depth-scale, 1)))'));
// 200コンボの演出が消えたのと同じ罠(backgroundショートハンドがbackground-clip等を巻き添えにする)を避ける
check('終端バーの色はbackground-imageだけを上書きする',
  /\[data-rhythm-end-bar\]\[data-rhythm-end-flick\]\{background-image:/.test(source)
  &&!/\[data-rhythm-end-bar\]\[data-rhythm-end-flick\]\{background:/.test(source));

// --- 9. 確認用の譜面 ---
const hasEndFlick=notes=>notes.some(n=>n.endFlick===true);
const hasPlain=notes=>notes.some(n=>(n.type==='HOLD'||n.type==='SLIDE')&&n.endFlick!==true);
check('確認用譜面(EASY)にHOLDの終点フリックがある',hasEndFlick(endFlickHoldTestNotes)
  &&endFlickHoldTestNotes.filter(n=>n.endFlick).every(n=>n.type==='HOLD'));
check('確認用譜面(NORMAL)にSLIDEの終点フリックがある',hasEndFlick(endFlickSlideTestNotes)
  &&endFlickSlideTestNotes.filter(n=>n.endFlick).every(n=>n.type==='SLIDE'));
check('確認用譜面(HARD)はTAP/FLICKと混ざっている',hasEndFlick(endFlickMixTestNotes)
  &&endFlickMixTestNotes.some(n=>n.type==='TAP')&&endFlickMixTestNotes.some(n=>n.type==='FLICK'));
check('どの確認用譜面にも「終点フリックではないHOLD/SLIDE」が混ざっている(見分けが付くか試せる)',
  [endFlickHoldTestNotes,endFlickSlideTestNotes,endFlickMixTestNotes].every(hasPlain));
check('確認用譜面が曲として登録されている',
  source.includes("songId:'end_flick_test'")&&source.includes("displayName:'END FLICK TEST'"));
check('終点フリックの終端はすべて始点より後ろ',
  [...endFlickHoldTestNotes,...endFlickSlideTestNotes,...endFlickMixTestNotes]
    .filter(n=>n.endFlick).every(n=>Number(n.endTimeMs)>Number(n.timeMs)));

// --- 10. 既存譜面を1ノーツも書き換えていない ---
check('既存の正式候補v1・既存テスト譜面へ終点フリックを混ぜていない',
  [monsterHeroEasyNotes,monsterHeroNormalNotes,monsterHeroHardNotes,atsuCupGestureTestNotes,atsuCupHoldTestNotes]
    .every(notes=>!notes.some(n=>n.endFlick!==undefined)));

// --- 11. 実ブラウザで、本当に矢印が出るか ---
// CSSの文字列が入っていることと、実際にその記号が描かれることは別。
// 200コンボの演出が「書いてあるのに見えない」不具合を出したのと同じ種類の見落としを防ぐ。
(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{
    console.log('（playwright が無いので実ブラウザ確認はスキップしました）');
    console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
    process.exit(failed?1:0);
  }}
  const css=(source.match(/const style=document\.createElement\('style'\);\s*style\.textContent=`([\s\S]*?)`;/)||[])[1];
  check('ノーツのCSSを取り出せる',!!css);
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage();
    // 終端バーの見た目(Tailwindのclassで付く背景・奥行きのscaleY)を最小限で再現し、
    // 終点フリックの指定だけが上乗せされることを実測する。
    await page.setContent(`<style>${css}
      .bar{position:absolute;left:20px;width:120px;height:8px;border-radius:999px;border:1px solid rgba(255,255,255,.8);
           background-image:linear-gradient(to right,#e879f9,#cffafe,#e879f9);transform:scaleY(var(--rhythm-end-depth-scale,1))}
    </style>
    <div data-rhythm-note data-note-type="HOLD" style="position:relative;height:300px">
      <span class="bar" id="plain" data-rhythm-end-bar style="top:100px"></span>
      <span class="bar" id="flick" data-rhythm-end-bar data-rhythm-end-flick="1" style="top:200px;--rhythm-end-depth-scale:0.6"></span>
    </div>`);
    const read=sel=>page.evaluate(s=>{
      const el=document.querySelector(s),base=getComputedStyle(el),after=getComputedStyle(el,'::after');
      return {bg:base.backgroundImage,border:base.borderTopColor,content:after.content,
              color:after.color,transform:after.transform,fontSize:after.fontSize,
              clip:after.clipPath,width:after.width,height:after.height};
    },sel);
    const plain=await read('#plain'),flick=await read('#flick');
    check('終点フリックではない終端バーには印が出ない(既存ノーツの見た目が変わらない)',
      plain.content==='none',plain.content);
    check('終点フリックではない終端バーの色は元のまま',
      plain.bg.includes('232, 121, 249'),plain.bg.slice(0,48));
    check('実ブラウザで矢印(三角)が描かれる',
      /polygon/.test(flick.clip)&&flick.width==='24px'&&flick.height==='17px',
      `${flick.clip} / ${flick.width}×${flick.height}`);
    check('実ブラウザで終端バーが緑になる',
      flick.bg.includes('34, 197, 94')&&!flick.bg.includes('232, 121, 249'),flick.bg.slice(0,48));
    check('印の縦つぶれが実際に打ち消される(scaleY 0.6 → 約1.67)',(()=>{
      const m=flick.transform.match(/matrix\(([^)]+)\)/);
      if(!m)return false;
      const scaleY=Number(m[1].split(',')[3]);
      return Math.abs(scaleY-1/0.6)<.01;
    })(),flick.transform);
  }catch(error){
    check('実ブラウザ確認が動く',false,String(error).split('\n')[0]);
  }finally{
    if(browser)await browser.close();
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();
