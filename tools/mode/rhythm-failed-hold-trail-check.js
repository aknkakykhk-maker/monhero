// 失敗したHOLD / SLIDEを、その場で消さずに薄いグレーへ落とし、帯の終わりまで流すことを確かめる。
//
// 途中で失敗したロングノーツがいきなり消えると、「取り損ねたのか、そもそも無かったのか」が
// 分からない。表示だけを薄いグレーへ落として、復活しないことを見せる。
// 2026-10-13 午前に「約0.3秒で消す」を入れたが、社長「消すなんてルール決めたことない」で、終わりまで薄く流す形へ戻した
// (地上・空中・全難易度・ひとりもマルチも同じ。灰色はホールドと同じくらいの濃さ RHYTHM_FAILED_SLIDE_FILL)。
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
// 「HOLD/SLIDE か」は note.type ではなく元の種類(rhythmNoteHasBody)で見る。触った FLICK は判定のために
// type が 'HOLD'・終端が60秒先に化けるので、note.type で見ると取り損ねた FLICK が1分間「失敗した HOLD」として残る
// (2026-09-08・実機「レーンに白いあとが出続けた」。canvas 版はその帯を実際に描いていた)
check('失敗して流し続ける条件は元の種類が HOLD/SLIDE のMISSかつ譜面上の終端前',
  game.includes("const failedTrail=note.done&&note._rhythmFinalJudgment==='MISS'&&rhythmNoteHasBody(note)&&songTimeMs<rhythmReleaseTargetMs(note);")
  &&!game.includes("note._rhythmFinalJudgment==='MISS'&&(note.type==='HOLD'||rhythmNoteIsSlide(note))"));
check('元の種類を見る補助関数がある(触った FLICK を帯持ちにしない)',
  data.includes("const rhythmNoteVisualType=note=>note?._rhythmOriginalType||note?.type;")
  &&data.includes("const rhythmNoteHasBody=note=>rhythmNoteIsHold(note)||rhythmNoteIsSlide(note);"));
// 消す・薄くするという扱いは変えていないが、毎フレーム同じ値を書き直さないようにしたので
// (遊んでいるうちに重くなる原因だった)、書き方が「変わったときだけ書く」形になっている。
// 取れたHOLD / SLIDE / FLICKは、消える前に一瞬だけ判定ラインで光る(2026-09-04に追加)。
// 失敗したHOLD / SLIDEは薄いグレーで帯の終わりまで見せる。光っていないノーツは従来どおり消える。
check('TAP・終端を過ぎたノーツはその場で消す(取れたときの短い光と、失敗した帯の終わりまでのあいだだけ残る)',
  game.includes("if(note.done&&!failedTrail&&!clearFlash){if(el._rhythmHidden!==true){el.style.display='none';el._rhythmHidden=true;}return;}")
  &&game.includes("if(note.done&&!failedTrail&&!clearFlash){note._rhythmCanvasSettled=true;return;}")
  &&game.includes('const clearFlash=note.done&&Number.isFinite(note._rhythmClearAt)&&songTimeMs-note._rhythmClearAt<RHYTHM_CLEAR_FLASH_MS;'));
check('光るのは取れたときだけで、失敗したノーツは薄いグレーのまま(扱いを混ぜない)',
  game.includes("const clearedGesture=judgment!=='MISS'&&")
  &&game.includes("const failedTrail=note.done&&note._rhythmFinalJudgment==='MISS'&&"));
check('消したノーツへ毎フレーム同じ指示を書き直さない',
  game.includes('if(el._rhythmHidden===true){el.style.display=\'\';el._rhythmHidden=false;}'));
check('失敗中は判定範囲外になっても表示を続ける',
  game.includes('visible=failedTrail||note.activePointerId!==null||(progress>=-.1&&progress<=1.18)'));
check('失敗中は薄い灰色のまま帯の終わりまで流す(途中で消さない・DOM 版・canvas 版とも)',
  game.includes("const nextOpacity=failedTrail?'0.34':(visible?'1':'0');")
  &&game.includes('failed:failedTrail,')
  &&game.includes("alpha:failedTrail?.34:1")
  &&game.includes("const failedTrail=note.done&&note._rhythmFinalJudgment==='MISS'&&rhythmNoteHasBody(note)&&songTimeMs<rhythmReleaseTargetMs(note);")
  &&!game.includes('rhythmFailedTrailFade')&&!data.includes('rhythmFailedTrailFade')
  &&/const RHYTHM_FAILED_SLIDE_FILL='rgba\(135,145,160,\.8\)';/.test(data));
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
