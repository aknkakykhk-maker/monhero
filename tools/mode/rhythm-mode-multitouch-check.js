#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const game=read('monster-hero/src/game-system.jsx'),data=read('monster-hero/data/rhythm-mode.js');
const inputKeyHelper=game.match(/const rhythmInputKey=.*?;/)?.[0],projectionHelper=data.match(/const RHYTHM_PROJECTION_TOP_SCALE=[\s\S]*?const rhythmLaneAtPoint=[\s\S]*?\n\};/)?.[0],helper=inputKeyHelper&&projectionHelper?`${inputKeyHelper}\n${projectionHelper}`:null;
check('タッチ入力ヘルパーを抽出できる',!!helper);
if(helper){const c={RHYTHM_LANE_COUNT:5};vm.runInNewContext(`${helper}\nthis.out={rhythmInputKey,rhythmLaneAtPoint,rhythmProjectLane};`,c);const L=c.out,rect={left:0,top:0,width:500,height:800};
  check('入力IDはtouch/pointerで衝突しない',L.rhythmInputKey('touch',7)==='touch:7'&&L.rhythmInputKey('pointer',7)==='pointer:7');
  check('上部・中央・判定線で見た目の5レーン中央を判定', [.05,.5,.88].every(y=>[0,1,2,3,4].every(lane=>L.rhythmLaneAtPoint(L.rhythmProjectLane(lane,y).center*500,y*800,rect)===lane)));
  check('台形レーン外と不正rectを入力対象にしない',L.rhythmLaneAtPoint(0,0,rect)===null&&L.rhythmLaneAtPoint(250,400,{...rect,width:0})===null);
}
check('PR #871の疑似Pointer bridgeを残さない',!data.includes('installRhythmNativeMultitouchBridge')&&!data.includes('__mhRhythmNativeTouchBridgeInstalled'));
check('同時入力はbatch matcherを使う',data.includes('const rhythmMatchInputBatch=')&&game.includes('rhythmMatchInputBatch(run.notes,inputs,now,settings.judgmentTimingOffsetMs)')&&game.includes('inputStarts(starts)'));
check('iPhone向けnative Touch Eventsをpassive:falseでplay areaへ直接登録',game.includes("addEventListener('touchstart',syncTouches,{passive:false})")&&game.includes("addEventListener('touchmove',syncTouches,{passive:false})")&&game.includes("addEventListener('touchend',syncTouches,{passive:false})")&&game.includes("addEventListener('touchcancel',syncTouches,{passive:false})"));
check('touches全体を同期し各touch.identifierを独立管理',game.includes('Array.from(e.touches||[])')&&game.includes("rhythmInputKey('touch',touch.identifier)")&&game.includes('activeTouchInputs'));
// rectは1回だけ測って全部の指で共有する（指ごとに測ると強制レイアウトが指の数だけ起きる）。
// 実際の測定は inputAreaRect が持つ「1フレームに1回」のキャッシュへ寄せてある。
check('同時に始まった複数指を1batchで判定',game.includes('const rect=inputAreaRect(area),live=new Set(),')&&game.includes('starts=[]')&&game.includes('if(starts.length)inputStarts(starts)'));
check('同時に離れた複数指も1batchで終了',game.includes('const ended=[]')&&game.includes('if(ended.length)inputEnds(ended)'));
check('Touch由来PointerEventの二重処理を防ぐ',game.includes("if(e.pointerType==='touch')return")&&(game.match(/if\(e\.pointerType==='touch'\)return/g)||[]).length>=2);
check('各指のclientX/clientYから個別レーンを判定',game.includes('rhythmLaneAtPoint(touch.clientX,touch.clientY,rect)'));
check('レーン表示は入力面を分断しない非操作div',game.includes('pointer-events-none absolute inset-0 grid grid-cols-5')&&!game.includes('onTouchStart={touchStart}'));
check('ノーツ描画もタッチ面を遮らない',game.includes("pointerEvents:'none'"));
check('play areaでブラウザ既定ジェスチャを抑止',game.includes("touchAction:'none'")&&game.includes("WebkitTouchCallout:'none'"));
check('Pointer Eventsはマウス/ペン用フォールバックとして維持',game.includes("rhythmInputKey('pointer',e.pointerId)")&&game.includes('input.captureTarget.setPointerCapture(input.pointerId)'));
check('ポーズ/リスタート/中断でtouch IDもcleanup',game.includes('activeTouchInputs?.clear()')&&game.includes('activeTouchInputs:new Set()'));
check('プレオープンで公開されている',game.includes('const RHYTHM_MODE_PUBLIC_RELEASE = true'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
