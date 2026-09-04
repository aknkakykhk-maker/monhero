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
check('終端の判定窓は200msのまま',RHYTHM_RELEASE_MAX_MS===200);
// 終端の判定も、単発のタップと同じ表を使う（終点フリックのために別の表を作っていない）。
// 幅そのものは 2026-09-05 にユーザー指示でゆるくした（25→40 / 50→75 / 100→130 / 150→170）。
check('終端の判定表を変えていない',
  [[0,'MARVELOUS'],[40,'MARVELOUS'],[41,'EXCELLENT'],[75,'EXCELLENT'],[76,'GREAT'],[130,'GREAT'],
   [131,'GOOD'],[170,'GOOD'],[171,'BAD'],[200,'BAD'],[201,'MISS']].every(([d,e])=>rhythmJudgeRelease(d)===e));
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
now=2150;runtime.record('touch:1',30,0);
check('フリックの時刻で既存の判定窓どおりに判定する(+150ms=GOOD)',note.holdJudgment==='GOOD',note.holdJudgment);

// --- 6. フリックしないまま終わったらMISS ---
note=start('HOLD',true);
frame(1800);
now=2000;runtime.release('touch:1');
check('フリックせずに離すと、終端ちょうどでもMISS',note.holdJudgment==='MISS',note.holdJudgment);
check('フリックしなかったことが記録に残る',note._rhythmEndFlickDone===false);

note=start('HOLD',true);
frame(1800);frame(2000);frame(2200);
check('押しっぱなしのまま終端を過ぎたら従来どおりMISSガードが働く',note.holdJudgment==='MISS',note.holdJudgment);

note=start('HOLD',true);
now=1500;runtime.release('touch:1');// 受付前に離した
check('受付前に離してもMISS',note.holdJudgment==='MISS',note.holdJudgment);

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
const html=fs.readFileSync(path.join(ROOT,'monster-hero/index.html'),'utf8');
const flickMark=(html.match(/content:"([^"]+)" !important;/)||[])[1];
check('印は単発FLICKと同じ記号',flickMark==='⇧'&&source.includes('content:"⇧"'),`FLICK=${flickMark}`);
check('色も単発FLICKと同じ緑（判定と違う操作に見えないように）',
  /\[data-rhythm-end-bar\]\[data-rhythm-end-flick\]\{[^}]*#22c55e/.test(source)
  &&/\[data-rhythm-end-bar\]\[data-rhythm-end-flick\]::after\{[^}]*#22c55e/.test(source));
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

// --- 11. 実ブラウザで、本当に「⇧」が出るか ---
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
              color:after.color,transform:after.transform,fontSize:after.fontSize};
    },sel);
    const plain=await read('#plain'),flick=await read('#flick');
    check('終点フリックではない終端バーには印が出ない(既存ノーツの見た目が変わらない)',
      plain.content==='none',plain.content);
    check('終点フリックではない終端バーの色は元のまま',
      plain.bg.includes('232, 121, 249'),plain.bg.slice(0,48));
    check('実ブラウザで「⇧」が描かれる',flick.content==='"⇧"',flick.content);
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
