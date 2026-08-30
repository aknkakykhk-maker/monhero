#!/usr/bin/env node
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
let failed=0;const check=(name,ok)=>{console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++;};
const game=read('monster-hero/src/game-system.jsx');
const helper=game.match(/const rhythmInputKey=[\s\S]*?\n};\nconst RhythmTapTest/)?.[0]?.replace(/\nconst RhythmTapTest$/,'');
check('タッチ入力ヘルパーを抽出できる',!!helper);
if(helper){const c={RHYTHM_LANE_COUNT:5};vm.runInNewContext(`${helper}\nthis.out={rhythmInputKey,rhythmLaneFromClientX};`,c);const L=c.out;
  check('入力IDはtouch/pointerで衝突しない',L.rhythmInputKey('touch',7)==='touch:7'&&L.rhythmInputKey('pointer',7)==='pointer:7');
  check('5レーン境界をplay area幅から算出',L.rhythmLaneFromClientX(0,0,500)===0&&L.rhythmLaneFromClientX(99.9,0,500)===0&&L.rhythmLaneFromClientX(100,0,500)===1&&L.rhythmLaneFromClientX(499,0,500)===4&&L.rhythmLaneFromClientX(500,0,500)===4);
  check('範囲外座標を安全に端レーンへ丸める',L.rhythmLaneFromClientX(-50,0,500)===0&&L.rhythmLaneFromClientX(900,0,500)===4&&L.rhythmLaneFromClientX(0,0,0)===null);
}
check('iPhone向けTouch EventsでchangedTouchesを全件処理',game.includes('onTouchStart={touchStart}')&&game.includes('onTouchEnd={touchEnd}')&&game.includes('onTouchCancel={touchEnd}')&&(game.match(/Array\.from\(e\.changedTouches\|\|\[\]\)\.forEach/g)||[]).length>=2);
check('各touch.identifierを独立した入力キーで管理',game.includes("rhythmInputKey('touch',touch.identifier)")&&game.includes('run.activePointers.set(inputKey,target.index)')&&game.includes('run.activePointers.get(inputKey)'));
check('touch PointerEventは二重処理しない',game.includes("if(e.pointerType==='touch')return")&&(game.match(/if\(e\.pointerType==='touch'\)return/g)||[]).length>=2);
check('TouchStartは各指のclientXから個別レーン判定',game.includes('rhythmLaneFromClientX(touch.clientX,rect.left,rect.width)')&&game.includes("inputStart(lane,rhythmInputKey('touch',touch.identifier))"));
check('ノーツ描画がタッチ面を遮らない',game.includes("pointerEvents:'none'"));
check('play areaでブラウザ既定ジェスチャを抑止',game.includes("touchAction:'none'")&&game.includes("WebkitTouchCallout:'none'"));
check('Pointer Eventsはマウス/ペン用フォールバックとして維持',game.includes("rhythmInputKey('pointer',e.pointerId)")&&game.includes('captureTarget.setPointerCapture(pointerId)'));
check('通常公開はOFF',game.includes('const RHYTHM_MODE_PUBLIC_RELEASE = false'));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);
