#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const game=read('monster-hero/src/game-system.jsx'),data=read('monster-hero/data/rhythm-mode.js');
const helper=game.match(/const rhythmInputKey=[\s\S]*?\n};\nconst RhythmTapTest/)?.[0]?.replace(/\nconst RhythmTapTest$/,'');
check('タッチ入力ヘルパーを抽出できる',!!helper);
if(helper){const c={RHYTHM_LANE_COUNT:5};vm.runInNewContext(`${helper}\nthis.out={rhythmInputKey,rhythmLaneFromClientX};`,c);const L=c.out;
  check('入力IDはtouch/pointerで衝突しない',L.rhythmInputKey('touch',7)==='touch:7'&&L.rhythmInputKey('pointer',7)==='pointer:7');
  check('5レーン境界をplay area幅から算出',L.rhythmLaneFromClientX(0,0,500)===0&&L.rhythmLaneFromClientX(99.9,0,500)===0&&L.rhythmLaneFromClientX(100,0,500)===1&&L.rhythmLaneFromClientX(499,0,500)===4&&L.rhythmLaneFromClientX(500,0,500)===4);
  check('範囲外座標を安全に端レーンへ丸める',L.rhythmLaneFromClientX(-50,0,500)===0&&L.rhythmLaneFromClientX(900,0,500)===4&&L.rhythmLaneFromClientX(0,0,0)===null);
}
check('PR #871の疑似Pointer bridgeを残さない',!data.includes('installRhythmNativeMultitouchBridge')&&!data.includes('__mhRhythmNativeTouchBridgeInstalled'));
check('同時入力はbatch matcherを使う',data.includes('const rhythmMatchInputBatch=')&&game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)')&&game.includes('inputStarts(starts)'));
check('iPhone向けnative Touch Eventsをpassive:falseでplay areaへ直接登録',game.includes("addEventListener('touchstart',syncTouches,{passive:false})")&&game.includes("addEventListener('touchmove',syncTouches,{passive:false})")&&game.includes("addEventListener('touchend',syncTouches,{passive:false})")&&game.includes("addEventListener('touchcancel',syncTouches,{passive:false})"));
check('touches全体を同期し各touch.identifierを独立管理',game.includes('Array.from(e.touches||[])')&&game.includes("rhythmInputKey('touch',touch.identifier)")&&game.includes('activeTouchInputs'));
check('同時に始まった複数指を1batchで判定',game.includes('const rect=area.getBoundingClientRect(),live=new Set(),')&&game.includes('starts=[]')&&game.includes('if(starts.length)inputStarts(starts)'));
check('同時に離れた複数指も1batchで終了',game.includes('const ended=[]')&&game.includes('if(ended.length)inputEnds(ended)'));
check('Touch由来PointerEventの二重処理を防ぐ',game.includes("if(e.pointerType==='touch')return")&&(game.match(/if\(e\.pointerType==='touch'\)return/g)||[]).length>=2);
check('各指のclientXから個別レーンを判定',game.includes('rhythmLaneFromClientX(touch.clientX,rect.left,rect.width)'));
check('レーン表示は入力面を分断しない非操作div',game.includes('pointer-events-none absolute inset-0 grid grid-cols-5')&&!game.includes('onTouchStart={touchStart}'));
check('ノーツ描画もタッチ面を遮らない',game.includes("pointerEvents:'none'"));
check('play areaでブラウザ既定ジェスチャを抑止',game.includes("touchAction:'none'")&&game.includes("WebkitTouchCallout:'none'"));
check('Pointer Eventsはマウス/ペン用フォールバックとして維持',game.includes("rhythmInputKey('pointer',e.pointerId)")&&game.includes('input.captureTarget.setPointerCapture(input.pointerId)'));
check('ポーズ/リスタート/中断でtouch IDもcleanup',game.includes('activeTouchInputs?.clear()')&&game.includes('activeTouchInputs:new Set()'));
check('通常公開はOFF',game.includes('const RHYTHM_MODE_PUBLIC_RELEASE = false'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
