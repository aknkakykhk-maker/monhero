#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..','..');
const review=fs.readFileSync(path.join(ROOT,'monster-hero','debug','rhythm-review-mode.js'),'utf8');
const candidate=JSON.parse(fs.readFileSync(path.join(ROOT,'monster-hero','debug','atsu-cup-theme-easy-formal-candidate-v2-review.json'),'utf8'));

const ok=(name,value)=>{assert(value,name);console.log(`OK: ${name}`);};
new vm.Script(review,{filename:'rhythm-review-mode.js'});
ok('耳確認ナビを含むreview mode JSの構文が有効',true);
ok('candidate v2-reviewをno-storeで読み込む',review.includes("EAR_CANDIDATE_URL='debug/atsu-cup-theme-easy-formal-candidate-v2-review.json'")&&review.includes("fetch(EAR_CANDIDATE_URL,{cache:'no-store'})"));
ok('v2-reviewの未完成状態だけを対象にする',review.includes("candidate?.candidateVersion!==2")&&review.includes("candidate?.status!=='FORMAL_CANDIDATE_REVIEW'")&&review.includes("candidate?.reviewRequired!==true")&&review.includes("candidate?.runtimeConnected!==false"));
ok('22点を24grid間隔・前後8gridで16区間へまとめる',review.includes('EAR_GROUP_GAP_GRIDS=24')&&review.includes('EAR_LOOP_PADDING_GRIDS=8')&&review.includes('reviews.length!==22')&&review.includes('groups.length===16'));
ok('既存の区間ループUIを再利用して別タイマーを作らない',review.includes("querySelector('[data-rhythm-loop-set-start]')")&&review.includes("querySelector('[data-rhythm-loop-set-end]')")&&review.includes("querySelector('[data-rhythm-loop-toggle]')")&&review.includes('setStart.click()')&&review.includes('setEnd.click()')&&review.includes('loopToggle.click()')&&!review.includes('setInterval(')&&!review.includes('setTimeout('));
ok('既存編集audioと共通timing helperを利用',review.includes("querySelector('[data-rhythm-chart-audio]')")&&review.includes("typeof rhythmTimingAt==='function'"));
ok('前後移動・ループ再生・停止を44px以上で用意',review.includes('data-rhythm-ear-review-prev')&&review.includes('data-rhythm-ear-review-next')&&review.includes('data-rhythm-ear-review-play')&&review.includes('data-rhythm-ear-review-stop')&&review.includes('min-h-[44px]')&&review.includes('min-h-[46px]'));
ok('区間移動と曲変更で再生中ループを止める',review.includes('stopEarLoop(editor)')&&review.includes("track.addEventListener('change',()=>{stopEarLoop(editor);refreshEarNav(editor);})"));
ok('採用・移動・不採用を保存しないことを明示',review.includes('採用・移動・不採用はここでは保存しません')&&!review.includes('localStorage')&&!review.includes('mh_rhythm_best')&&!review.includes('mh_rhythm_settings'));
ok('22候補のoffset・strength・機械推奨を表示',review.includes('sourcePeakOffsetMs')&&review.includes('sourceStrength')&&review.includes('machineRecommendation'));
ok('候補単位ナビと5種類のreview decision',review.includes('data-rhythm-ear-candidate-prev')&&review.includes('data-rhythm-ear-candidate-next')&&['KEEP','DROP','SHIFT_PREVIOUS_GRID','SHIFT_NEXT_GRID','PENDING'].every(value=>review.includes(`data-review-decision="${value}"`)));
ok('レビューJSONをコピー可能',review.includes('data-rhythm-ear-copy-review')&&review.includes('navigator.clipboard.writeText(text)')&&review.includes('data-rhythm-ear-review-output'));
ok('仮適用はDEBUGエディタeventだけで正式chartへ書かない',review.includes("new CustomEvent('rhythm-chart-load-review-preview'")&&!review.includes('RHYTHM_SONGS.push')&&!review.includes('saveRhythmBestRecord'));

const reviews=candidate.pendingReviews.map(row=>Number(row.grid));
const groups=[];
for(const grid of reviews){
  const current=groups[groups.length-1];
  if(!current||grid-current[current.length-1]>24)groups.push([grid]);
  else current.push(grid);
}
ok('現行v2-reviewも22点→16区間になる',reviews.length===22&&groups.length===16);
ok('candidateはまだ正式runtime未接続',candidate.reviewRequired===true&&candidate.runtimeConnected===false&&candidate.status==='FORMAL_CANDIDATE_REVIEW');
console.log('OK: EASY耳確認ナビは確認補助のみで正式譜面を確定しない');
