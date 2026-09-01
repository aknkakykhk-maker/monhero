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
ok('確認者向けreview mode JSの構文が有効',true);
ok('review modeはデバッグ譜面エディタだけを対象にする',review.includes("document.querySelector('[data-rhythm-chart-authoring-ui]')")&&review.includes("document.querySelector('[data-rhythm-debug]')"));
ok('今回の確認手順を最上段へ表示',review.includes('今回ここだけ確認')&&review.includes('現在のEASY譜面をテストプレイ')&&review.includes('まずは <b>0 ms</b>'));
ok('HOLD開始終端と音ハメを確認項目として明示',review.includes('音とノーツが気持ちよく合うか')&&review.includes('HOLDの開始・終端が自然か'));
ok('タイミング補正は違和感時だけ使う案内',review.includes('全体が明らかに早い/遅い時だけ −10 / ＋10 ms'));
ok('制作ツールはdetailsへ収納し初期openを強制しない',review.includes("details=document.createElement('details')")&&review.includes('制作ツールを表示')&&!review.includes('details.open=true'));
ok('音源解析パネルも制作ツールへ移す',review.includes("querySelector('[data-rhythm-authoring]')")&&review.includes('content.prepend(analysis)'));
ok('テストプレイ・status・実機補正は確認画面へ残す',review.includes("querySelector('[data-rhythm-chart-status]')")&&review.includes("querySelector('[data-rhythm-chart-preview]')")&&review.includes("querySelector('[data-rhythm-preview-offset-ui]')"));
ok('制作ツール表示は44px以上のタッチ領域',review.includes('min-h-[48px]')&&review.includes('touch-action:manipulation'));
ok('DOM順が変わる時だけ移動してObserver自己発火ループを避ける',review.includes('anchor.nextElementSibling!==node')&&review.includes("new MutationObserver(layout)"));
ok('保存データやBESTへ書き込まない',!review.includes('localStorage')&&!review.includes('mh_rhythm_best')&&!review.includes('mh_rhythm_settings'));
ok('既存制作UIは削除せずそのまま残す',editor.includes('data-rhythm-chart-copy-json')&&editor.includes('data-rhythm-chart-copy-js')&&editor.includes('data-rhythm-chart-clear')&&editor.includes('data-rhythm-chart-sublane'));
ok('review modeは不正配置UI成立後に遅延ロード',calibration.includes("reviewScript.src='debug/rhythm-review-mode.js?v=20260901b'")&&calibration.includes('invalidScript.onload=loadReviewMode')&&calibration.includes("if(document.querySelector('[data-rhythm-invalid-placement-loader]')){loadReviewMode();return;}"));
console.log('OK: 音ゲーデバッグ確認者向け簡易モード');