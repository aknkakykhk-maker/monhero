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
ok('review modeは音ゲーデバッグと譜面エディタだけを対象にする',review.includes("document.querySelector('[data-rhythm-debug]')")&&review.includes("querySelector(':scope > [data-rhythm-chart-authoring-ui]')"));
ok('通常テスト一覧を制作ツールより先に残す',review.includes('placeProductionToolsAfterTests')&&review.includes('root.appendChild(editor)')&&review.includes('React管理の曲/難易度セクションには触れず'));
ok('旧details収納と全子要素reparentを撤去',!review.includes("document.createElement('details')")&&!review.includes('content.appendChild(child)')&&!review.includes('data-rhythm-review-advanced'));
ok('デバッグ一覧はSafe Area付きスクロールを維持し初回だけ先頭へ戻す',review.includes("scrollPaddingTop='calc(56px + env(safe-area-inset-top))'")&&review.includes("root.dataset.rhythmReviewScrollFixed")&&review.includes('root.scrollTop=0'));
ok('耳確認ナビ16区間と44px以上の操作領域を維持',review.includes('groups.length===16')&&review.includes('data-rhythm-ear-review-play')&&review.includes('min-h-[44px]')&&review.includes('min-h-[46px]'));
ok('ノーツ本体色を通常CSSでも保証',review.includes('data-rhythm-note-visibility-fallback')&&review.includes('[data-rhythm-note] > span:last-child')&&review.includes('linear-gradient(to bottom,#fde68a')&&review.includes('[data-note-type="HOLD"]'));
ok('ノーツ可視化fallbackは座標・判定・速度を変更しない',!review.includes('rhythmProjectBoundary=')&&!review.includes('rhythmLayoutNoteVisual=')&&!review.includes('judgmentTimingOffsetMs=')&&!review.includes('noteSpeed='));
ok('プレイ中はデバッグDOMを並べ替えない',review.includes("dataset.rhythmPlayActive==='true'")&&review.includes('return;\n    layout();'));
ok('iPhone用EASY開始は候補セットと実テスト開始を2タップへ分離',review.includes('① EASY候補をテスト欄へセット')&&review.includes('黄色枠の「テストプレイ」を直接押してください')&&review.includes('event.stopImmediatePropagation()'));
ok('review側からテストプレイを自動clickしない',!review.includes('startButton.click()'));
ok('本物のテストプレイボタンを見つけて強調・スクロール・focusする',review.includes("/テストプレイ/.test(button.textContent||'')")&&review.includes("startButton.style.outline='3px solid #fbbf24'")&&review.includes('startButton.scrollIntoView')&&review.includes('startButton.focus'));
ok('EASYと仮想preview曲だけを選択しゲーム開始はユーザー操作へ残す',review.includes("dispatchValue(difficultySelect,'EASY')")&&review.includes('dispatchValue(songSelect,PREVIEW_SONG_ID,PREVIEW_LABEL)'));
ok('保存データやBESTへ書き込まない',!review.includes('localStorage')&&!review.includes('mh_rhythm_best')&&!review.includes('mh_rhythm_settings'));
ok('既存制作UIは削除せずそのまま残す',editor.includes('data-rhythm-chart-copy-json')&&editor.includes('data-rhythm-chart-copy-js')&&editor.includes('data-rhythm-chart-clear')&&editor.includes('data-rhythm-chart-sublane'));
ok('review modeは不正配置UI成立後に遅延ロード',calibration.includes("reviewScript.src='debug/rhythm-review-mode.js?v=20260902b'")&&calibration.includes('invalidScript.onload=loadReviewMode')&&calibration.includes("if(document.querySelector('[data-rhythm-invalid-placement-loader]')){loadReviewMode();return;}"));
console.log('OK: 音ゲーデバッグ確認者向け簡易モード');
