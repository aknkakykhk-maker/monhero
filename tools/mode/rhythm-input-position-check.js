#!/usr/bin/env node
// 押した位置・時刻まわりの取り決め(2026-10-07・「押した位置とタイミングが命」の点検で足したもの)が崩れていないかを見張る。
//
//   node tools/mode/rhythm-input-position-check.js
//
// 実ブラウザでは次を確かめてある(点検の記録は docs/spec/RHYTHM_MODE.md「点検で見つけた小さな不具合を直した」)。
//   ・判定ラインより下を押した指は、指の高さで測った位置と、判定ラインの高さに直した位置のどちらかが帯の中なら受け付ける
//     (外側の幅1のノーツを、画面の一番下で押しても範囲外にならない)
//   ・道の外に降りた指が道へ滑ってきたら、そこから押した指として扱う(空押しの音が1回鳴る=入力が始まった)
//   ・疑似TAPは本物の指が触れた時刻から数える
//   ・押さえ始めの時計は、押した瞬間の遅れぶん巻き戻して数える(単体の検査は rhythm-mid-tracking-check.js)
// ここでは、その部品が消えていないことだけを文字で見張る。
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const runtime=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};

const below=runtime.match(/const rhythmSubLaneCoordinateAtLineIfBelow=[\s\S]*?\n\};/)?.[0]||'';
check('判定ラインより下の位置の関数がある',below.length>100);
check('判定ラインより上(奥)では使わない(undefined を返す)',/yRatio>RHYTHM_JUDGMENT_LINE_Y\.ratio\)\)return undefined/.test(below));
check('照合は、どちらかの座標が帯の中なら受け付ける',/within\(subCoordinate\)\|\|within\(altCoordinate\)/.test(runtime));
check('照合の「いま帯の内側にいる指」も、もう一方の座標を見る',/altCoordinate>=span\.start&&altCoordinate<=span\.end/.test(runtime));
check('押し始めの3つの入口(タッチ・ポインタ・取り戻し)が、判定ラインより下の位置を渡す',
  (play.match(/subLaneCoordinateAtLine:rhythmSubLaneCoordinateAtLineIfBelow\(/g)||[]).length>=4);
check('道の外に降りた指を覚えている(outsideStartInputs)',/outsideStartInputs\?\.has\(inputKey\)/.test(play)&&/outsideStartInputs=current\.outsideStartInputs\|\|new Set\(\)/.test(play));
check('道の外から滑ってきた指は、道へ1サブレーン以上入ってから押した指にする',/RHYTHM_OUTSIDE_SLIDE_IN_SUBLANES=1;/.test(play)&&/subLaneCoordinate>=RHYTHM_OUTSIDE_SLIDE_IN_SUBLANES&&subLaneCoordinate<=RHYTHM_SUB_LANE_COUNT-RHYTHM_OUTSIDE_SLIDE_IN_SUBLANES/.test(play));
check('道の外の指は、離れたら・ポーズしたら忘れる',/outsideStartInputs\?\.delete\(inputKey\)/.test(play)&&/run\.outsideStartInputs\?\.clear\(\)/.test(play));
check('疑似TAPに、本物の指が触れた時刻を持たせる',/downEvent\.__mhOriginStamp=Number\(originStamp\)/.test(runtime)&&/dispatchTapProbe\(area,action\.touch,lane,baseKey,event\?\.timeStamp\)/.test(runtime));
// 2026-10-07 21時: 疑似TAPを本物の指の時刻まで巻き戻すのと、押さえ始めの時計の巻き戻しは、いったん戻した(タップ抜けの報告。原因を調べるまで)
check('ポインタ入力の遅れは、いまはそのイベントの時刻から数える(疑似TAPの元の時刻へは巻き戻さない)',/captureTarget:e\.currentTarget,pointerId:e\.pointerId\}\],rhythmInputAgeMs\(e\.timeStamp,perfNow\)\)/.test(play));
check('押さえ始めの時計へ遅れは渡すが、いまは巻き戻さない',/setInputAge\?\.\(ageMs\)[\s\S]{0,200}rhythmMatchInputBatch[\s\S]{0,120}setInputAge\?\.\(0\)/.test(play)&&/startPerfMs:perf\/\*/.test(runtime)&&!/startPerfMs:perf-pendingInputAgeMs/.test(runtime));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
