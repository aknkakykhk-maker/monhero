#!/usr/bin/env node
// モンヒロビートの判定の決まり(判定の窓・受付の横幅・追い方の余裕など)が、知らないうちに変わっていないかを見張る(2026-11-07・ビート部 マモリ)。
//
//   node tools/mode/rhythm-judgment-rules-lock-check.js                          # 見張る(CI でも回す)
//   node tools/mode/rhythm-judgment-rules-lock-check.js --update --reason "<理由>"  # 意図して変えたときだけ控えを更新
//   node tools/mode/rhythm-judgment-rules-lock-check.js --root <フォルダ> --print   # 別のチェックアウトの値を出すだけ
//
// 【なぜ要るか】譜面が同じでも、判定の決まりが変わると遊んだ感じが変わる(例: 2026-11-02 受付の横幅 +0.25レーン)。
//   社長「既存曲ちょこちょこ勝手に変わる」(2026-11-07)。決まった直しのときだけ --update --reason で控えを変える。
// 【何を見るか】下の RULES の数字そのものと、判定の関数に ms を流したときの答え(窓の境目が1msでも動けば分かる)。
//   値は演奏と同じ rhythm-mode.js と parts を動かして取る(書いてある式ではなく、出来上がった値)。
'use strict';
const path=require('path'),vm=require('vm');
const L=require('./rhythm-play-lock-lib.js');

const LOCK=path.join(__dirname,'rhythm-judgment-rules-lock.json');
const NOTE='モンヒロビートの判定の決まりの控え。勝手に書き換えない。意図して変えたときだけ rhythm-judgment-rules-lock-check.js --update --reason で更新する';
// rhythm-mode.js の判定まわりの数字(判定の窓・コンボ・入力の当て先・受付の横幅・追い方・離し・フリック・刻み)
const RULES=['RHYTHM_JUDGMENTS','RHYTHM_COMBO_SAFE_JUDGMENT_IDS','RHYTHM_COMBO_SAFE_WINDOW_MS','RHYTHM_INPUT_MATCH_WINDOW_MS',
  'RHYTHM_TAP_TOLERANCE_EXTRA_SUB_LANES','RHYTHM_NARROW_TAP_TOLERANCE_SUB_LANES','RHYTHM_TAP_TOLERANCE_SUB_LANES','RHYTHM_INPUT_EDGE_MARGIN_SUB_LANES',
  'RHYTHM_SLIDE_TOLERANCE_LANES','RHYTHM_SLIDE_TRACKING_BY_DIFFICULTY','RHYTHM_MID_TRACKING_GRACE_MS','RHYTHM_HOLD_TRACKING_MARGIN_LANES',
  'RHYTHM_HOLD_HANDOVER_GRACE_MS','RHYTHM_HOLD_RELEASE_GRACE_MS','RHYTHM_RELEASE_MAX_MS','RHYTHM_RELEASE_LATE_FLOOR','RHYTHM_RELEASE_JUDGMENT_IDS',
  'RHYTHM_RECLAIM_WIDE_WINDOW_MS','RHYTHM_INPUT_AGE_MAX_MS','RHYTHM_INPUT_AGE_BASE_ALIGNED_MS','RHYTHM_INPUT_AGE_CAP_WIDE_MS',
  'RHYTHM_FLICK_DISTANCE_PX','RHYTHM_FLICK_MAX_MS','RHYTHM_FLICK_SIDE_DOMINANCE',
  'RHYTHM_SKY_ACCEPT_BELOW','RHYTHM_GROUND_ACCEPT_ABOVE','RHYTHM_SKY_ACCEPT_TOP_BASE','RHYTHM_ACCEPT_WIDTH',
  'RHYTHM_SLIDE_CHECKPOINT_BASE_MS','RHYTHM_SLIDE_CHECKPOINT_REFERENCE_LEVEL','RHYTHM_SLIDE_CHECKPOINT_MIN_MS','RHYTHM_COMBO_TICK_DIVISION','RHYTHM_TICK_SWITCH_AT'];
// parts 側にある判定の数字
const PARTS_RULES=['RHYTHM_TAP_REJUDGE_MOVE_SUBLANES'];
// 関数に流して答えを控える(窓の境目・遅い離しの扱い・帯の外側の余白)
const PROBES={
  rhythmJudgeTap:Array.from({length:501},(_,i)=>i-250),
  rhythmJudgeRelease:Array.from({length:501},(_,i)=>i-250),
  rhythmJudgeReleaseLenient:Array.from({length:651},(_,i)=>i-250),
  rhythmHoldTrackingMarginLanes:Array.from({length:12},(_,i)=>i+1),
};

const args=process.argv.slice(2);
const root=L.rootFrom(args);
const collect=()=>{
  const play=L.loadPlay(root);
  const get=expr=>{try{return vm.runInContext(`typeof ${expr}!=='undefined'?${expr}:undefined`,play.context);}catch(e){return undefined;}};
  const items={};
  for(const name of RULES)items[name]=JSON.parse(L.stable(get(name)??null));
  for(const name of PARTS_RULES){const src=L.extractConst(play.parts,name);let v=null;
    if(src){try{v=vm.runInContext(`(()=>{${src}\nreturn ${name};})()`,play.context);}catch(e){v=null;}}items[name]=JSON.parse(L.stable(v));}
  for(const [fn,inputs] of Object.entries(PROBES)){
    const f=get(fn);if(typeof f!=='function'){items[`${fn}()`]=null;continue;}
    // 同じ答えが続く区間にまとめて控える([はじめ, おわり, 答え])。境目が動けば区間がずれる
    const runs=[];for(const x of inputs){const y=L.stable(f(x));const last=runs[runs.length-1];if(last&&last[2]===y)last[1]=x;else runs.push([x,x,y]);}
    items[`${fn}()`]=runs.map(([a,b,y])=>[a,b,JSON.parse(y)]);
  }
  return {items};
};

if(require.main===module){
  const {items}=collect();
  if(args.includes('--print')){console.log(JSON.stringify({items}));process.exit(0);}
  if(args.includes('--update')){
    const reason=L.argOf(args,'--reason');if(!reason)throw new Error('--reason "<理由>" が要る(だれが決めた、どの直しか)');
    const old=L.readLock(LOCK).items||{};
    const changed=Object.keys(items).filter(k=>JSON.stringify(old[k])!==JSON.stringify(items[k]));
    L.writeLock(LOCK,NOTE,items,reason,changed);
    console.log(`控えを更新した(${changed.length}項目): ${changed.join(' ')||'なし'}`);
    process.exit(0);
  }
  const r=L.reporter();
  const lock=L.readLock(LOCK).items||{};
  const absent=Object.keys(items).filter(k=>items[k]===null&&lock[k]!==null);
  r.ok('判定の決まりの数字と関数が、ゲームの中に見つかる',!absent.length,`見つからない: ${absent.join(' ')}。名前を変えたならこの検査の RULES も合わせる`);
  const changed=Object.keys(lock).filter(k=>k in items&&JSON.stringify(lock[k])!==JSON.stringify(items[k]));
  r.ok(`判定の決まり(${Object.keys(lock).length}項目)が控えと同じ`,!changed.length,
    `変わった: ${changed.map(k=>`${k} ${JSON.stringify(lock[k]).slice(0,80)} → ${JSON.stringify(items[k]).slice(0,80)}`).join(' / ')}。`
    +'判定が変わると公開中の曲の遊んだ感じが変わる。決まった直しなら node tools/mode/rhythm-judgment-rules-lock-check.js --update --reason "<理由>"');
  const fresh=Object.keys(items).filter(k=>!(k in lock));
  r.ok('見張る項目がすべて控えにある',!fresh.length,`控えに無い: ${fresh.join(' ')}。--update で入れる`);
  r.finish();
}
module.exports={collect};
