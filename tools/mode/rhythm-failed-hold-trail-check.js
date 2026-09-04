// 失敗したHOLD / SLIDEを、その場で消さずに終端まで薄いグレーで流し続けることを確かめる。
//
// 途中で失敗したロングノーツがいきなり消えると、「取り損ねたのか、そもそも無かったのか」が
// 分からない。表示だけを薄いグレーへ落として最後まで流し、復活しないことを見せる。
// 判定・コンボ・スコアはここでは一切変えない。
//
//   node tools/mode/rhythm-failed-hold-trail-check.js
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const game=read('monster-hero/src/game-system.jsx'),data=read('monster-hero/data/rhythm-mode.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

check('最終判定をノーツへ控えて、失敗表示の判断に使う',
  game.includes('note.done=true;note._rhythmFinalJudgment=judgment;'));
check('失敗して流し続ける条件はHOLD/SLIDEのMISSかつ譜面上の終端前',
  game.includes("const failedTrail=note.done&&note._rhythmFinalJudgment==='MISS'&&(note.type==='HOLD'||rhythmNoteIsSlide(note))&&songTimeMs<rhythmReleaseTargetMs(note);"));
// 消す・薄くするという扱いは変えていないが、毎フレーム同じ値を書き直さないようにしたので
// (遊んでいるうちに重くなる原因だった)、書き方が「変わったときだけ書く」形になっている。
// 取れたHOLD / SLIDE / FLICKは、消える前に一瞬だけ判定ラインで光る(2026-09-04に追加)。
// 「失敗したHOLD / SLIDEを終端まで薄く流す」扱いは変えておらず、光っていないノーツは従来どおり消える。
check('TAP・終端を過ぎたノーツは従来どおりその場で消す(取れたときの短い光のあいだだけ残る)',
  game.includes("if(note.done&&!failedTrail&&!clearFlash){if(el._rhythmHidden!==true){el.style.display='none';el._rhythmHidden=true;}return;}")
  &&game.includes('const clearFlash=note.done&&Number.isFinite(note._rhythmClearAt)&&songTimeMs-note._rhythmClearAt<RHYTHM_CLEAR_FLASH_MS;'));
check('光るのは取れたときだけで、失敗したノーツは薄いグレーのまま(扱いを混ぜない)',
  game.includes("const clearedGesture=judgment!=='MISS'&&")
  &&game.includes("const failedTrail=note.done&&note._rhythmFinalJudgment==='MISS'&&"));
check('消したノーツへ毎フレーム同じ指示を書き直さない',
  game.includes('if(el._rhythmHidden===true){el.style.display=\'\';el._rhythmHidden=false;}'));
check('失敗中は判定範囲外になっても表示を続ける',
  game.includes('visible=failedTrail||note.activePointerId!==null||(progress>=-.1&&progress<=1.18)'));
check('失敗中は薄く表示する',
  game.includes("const nextOpacity=failedTrail?'.34':(visible?'1':'0');"));
check('見え方が変わったときだけ書き込む',
  game.includes("if(el._rhythmOpacity!==nextOpacity){el.style.opacity=nextOpacity;el._rhythmOpacity=nextOpacity;}"));
// 比較相手はDOM(dataset)ではなく要素へ覚えた値。書き込む条件は同じで、
// 毎フレームのdataset読み出し(style再計算を誘発する)だけをやめている。
check('印は値が変わったときだけ書き換えて、監視の自己発火を避ける',
  game.includes("if(el._rhythmFailedFlag!==failedFlag){el.dataset.rhythmFailed=failedFlag;el._rhythmFailedFlag=failedFlag;}"));
check('失敗したノーツと帯はグレーへ落とす',
  data.includes('[data-rhythm-note][data-rhythm-failed="true"]{filter:grayscale(1) brightness(.72)!important}'));

// 判定側へ影響していないこと
check('判定・コンボ・スコアの計算へ失敗表示を持ち込まない',
  !game.includes('failedTrail&&run.combo')&&!game.includes('rhythmCalculateScore({judgments:run.counts,maxCombo:run.maxCombo,totalNotes:chart,failedTrail')
  &&game.includes('const nextCombo=rhythmComboAfter(run.combo,judgment);'));
check('一度失敗したノーツは復活しない(doneのまま扱う)',
  game.includes('if(!run||run.finished||run.paused||note.done)return;'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
