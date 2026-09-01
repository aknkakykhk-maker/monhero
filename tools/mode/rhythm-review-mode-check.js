#!/usr/bin/env node
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..','..');
const review=fs.readFileSync(path.join(ROOT,'monster-hero/debug/rhythm-review-mode.js'),'utf8');
const calibration=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-geometry-calibration.js'),'utf8');
const editor=fs.readFileSync(path.join(ROOT,'monster-hero/debug/rhythm-chart-authoring-ui.js'),'utf8');

const ok=(name,value)=>{assert(value,name);console.log(`OK: ${name}`);};
new vm.Script(review,{filename:'rhythm-review-mode.js'});
new vm.Script(calibration,{filename:'rhythm-geometry-calibration.js'});
ok('確認者向けreview mode JSの構文が有効',true);
ok('review modeは音ゲーデバッグ画面だけを対象にする',review.includes("document.querySelector('[data-rhythm-debug]')")&&review.includes('data-rhythm-review-dock'));
ok('EASY候補テストの直通ボタンを44px以上で上部へ用意',review.includes('data-rhythm-review-preview-proxy')&&review.includes('EASY候補をテストプレイ')&&review.includes('min-h-[48px]'));
ok('直通ボタンは既存preview処理を再利用',review.includes("querySelector('[data-rhythm-chart-preview]')")&&review.includes('target.click()'));
ok('React本体の子要素を制作detailsへ移動しない',!review.includes('content.appendChild(child)')&&!review.includes('adoptAuthoringPanel')&&!review.includes('data-rhythm-review-advanced-content'));
ok('制作パネルだけをデバッグ末尾へ移動',review.includes("querySelector(':scope > [data-rhythm-authoring]')")&&review.includes("querySelector(':scope > [data-rhythm-chart-authoring-ui]')")&&review.includes('root.append(authoring,chartEditor)'));
ok('デバッグ画面へ入った時だけスクロール先頭へ戻す',review.includes("root.dataset.rhythmReviewScrollReset!=='true'")&&review.includes('root.scrollTop=0'));
ok('root内監視は直下childListだけで再配置負荷を抑える',review.includes("rootObserver.observe(root,{childList:true})"));
ok('耳確認ナビは折りたたみで上部を圧迫しない',review.includes('data-rhythm-ear-review-details')&&review.includes('🎧 耳確認22点ナビ')&&!review.includes('details.open=true'));
ok('保存データやBESTへ書き込まない',!review.includes('localStorage')&&!review.includes('mh_rhythm_best')&&!review.includes('mh_rhythm_settings'));
ok('既存制作UIは削除せずそのまま残す',editor.includes('data-rhythm-chart-copy-json')&&editor.includes('data-rhythm-chart-copy-js')&&editor.includes('data-rhythm-chart-clear')&&editor.includes('data-rhythm-chart-sublane'));
ok('review modeは新キャッシュキーで遅延ロード',calibration.includes("reviewScript.src='debug/rhythm-review-mode.js?v=20260901c'")&&calibration.includes('invalidScript.onload=loadReviewMode'));
ok('ノーツ本体は高さ20pxの表示fallbackを持つ',calibration.includes('[data-rhythm-note]{display:block!important;position:absolute!important;height:20px!important;min-height:20px!important'));
ok('ノーツheadは最低12pxを維持',calibration.includes('[data-rhythm-note]>span:last-child{display:block!important;position:absolute!important;inset:4px 0!important;min-height:12px!important'));
ok('表示fallbackはopacity/transform/left/widthを上書きしない',!calibration.includes('[data-rhythm-note]{opacity:')&&!calibration.includes('[data-rhythm-note]{transform:')&&!calibration.includes('[data-rhythm-note]{left:')&&!calibration.includes('[data-rhythm-note]{width:'));
console.log('OK: 音ゲーデバッグ導線とノーツ表示fallback');
