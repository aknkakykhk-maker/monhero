#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..','..');
const review=fs.readFileSync(path.join(ROOT,'monster-hero','debug','rhythm-review-mode.js'),'utf8');
const candidate=JSON.parse(fs.readFileSync(path.join(ROOT,'monster-hero','debug','atsu-cup-theme-easy-formal-candidate-v1.json'),'utf8'));

const ok=(name,value)=>{assert(value,name);console.log(`OK: ${name}`);};
new vm.Script(review,{filename:'rhythm-review-mode.js'});
ok('耳確認ナビを含むreview mode JSの構文が有効',true);
ok('candidate v1をno-storeで読み込む',review.includes("EAR_CANDIDATE_URL='debug/atsu-cup-theme-easy-formal-candidate-v1.json'")&&review.includes("fetch(EAR_CANDIDATE_URL,{cache:'no-store'})"));
ok('正式候補v1の未完成状態だけを対象にする',review.includes("candidate?.candidateVersion!==1")&&review.includes("candidate?.status!=='FORMAL_CANDIDATE'")&&review.includes("candidate?.reviewRequired!==true")&&review.includes("candidate?.runtimeConnected!==false"));
ok('22点を24grid間隔・前後8gridで16区間へまとめる',review.includes('EAR_GROUP_GAP_GRIDS=24')&&review.includes('EAR_LOOP_PADDING_GRIDS=8')&&review.includes('reviews.length!==22')&&review.includes('groups.length===16'));
ok('既存の区間ループUIを再利用して別タイマーを作らない',review.includes("querySelector('[data-rhythm-loop-set-start]')")&&review.includes("querySelector('[data-rhythm-loop-set-end]')")&&review.includes("querySelector('[data-rhythm-loop-toggle]')")&&review.includes('setStart.click()')&&review.includes('setEnd.click()')&&review.includes('loopToggle.click()')&&!review.includes('setInterval(')&&!review.includes('setTimeout('));
ok('既存編集audioと共通timing helperを利用',review.includes("querySelector('[data-rhythm-chart-audio]')")&&review.includes("typeof rhythmTimingAt==='function'"));
ok('前後移動・ループ再生・停止を44px以上で用意',review.includes('data-rhythm-ear-review-prev')&&review.includes('data-rhythm-ear-review-next')&&review.includes('data-rhythm-ear-review-play')&&review.includes('data-rhythm-ear-review-stop')&&review.includes('min-h-[44px]')&&review.includes('min-h-[46px]'));
ok('区間移動時に再生中ループを止める',review.includes('stopEarLoop(editor())')&&review.includes('earIndex=(earIndex-1+earPlan.groups.length)%earPlan.groups.length')&&review.includes('earIndex=(earIndex+1)%earPlan.groups.length'));
ok('耳確認ナビは折りたたみで通常のテスト導線を圧迫しない',review.includes('data-rhythm-ear-review-details')&&review.includes('🎧 耳確認22点ナビ'));
ok('採用・移動・不採用を保存しないことを明示',review.includes('採用・移動・不採用はここでは保存しません')&&!review.includes('localStorage')&&!review.includes('mh_rhythm_best')&&!review.includes('mh_rhythm_settings'));

const reviews=candidate.earReviewGrids.map(Number);
const groups=[];
for(const grid of reviews){const current=groups[groups.length-1];if(!current||grid-current[current.length-1]>24)groups.push([grid]);else current.push(grid);}
ok('現行candidateも22点→16区間になる',reviews.length===22&&groups.length===16);
ok('candidateはまだ正式runtime未接続',candidate.reviewRequired===true&&candidate.runtimeConnected===false);
console.log('OK: EASY耳確認ナビは確認補助のみで正式譜面を確定しない');
