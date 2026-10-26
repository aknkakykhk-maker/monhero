#!/usr/bin/env node
// ホールド・スライドで線(チェックポイント)を通ったときの光・音・コンボのはね(2026-10-17 案A)を見張る。
//
//   node tools/mode/rhythm-hold-tick-check.js
//
// 見ること:
//   ・見た目と音だけ。コンボの数・スコア・判定(checkpointPassed の数え方)は変えない
//   ・落とした線(外れているあいだ)では印を付けない
//   ・ホールドは線が無いので、スライドの線と同じ間隔の時刻で出す(終わりの手前は置かない)
//   ・光はノーツの canvas の中(叩いた光とは別の枠)、はねは今あるコンボの数字を animate で動かすだけ。画面の部品を足さない
//   ・軽量モードでは光とはねを出さない。演出量「最小」では弱い形で出す。音は叩いた音の大きさ(タップ音量)に従い、新しく音の作りを起こさない
//   ・2026-10-17 社長「全然わかんないし音もないし」: 音は叩いた音と同じくらいの強さ、光はひとめで分かる大きさ(0.3秒・帯の幅の線・星・8本の筋)
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'../..');
const data=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const play=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
let failed=0;const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};
const grab=(from,to)=>{const i=data.indexOf(from),j=data.indexOf(to,i);return i>=0&&j>i?data.slice(i,j):'';};

// ホールドの時刻
const consts=['RHYTHM_SLIDE_CHECKPOINT_BASE_MS','RHYTHM_SLIDE_CHECKPOINT_REFERENCE_LEVEL','RHYTHM_SLIDE_CHECKPOINT_MIN_MS','RHYTHM_SLIDE_CHECKPOINT_MAX_MS','RHYTHM_SLIDE_CHECKPOINT_SCALE_MIN','RHYTHM_SLIDE_CHECKPOINT_SCALE_MAX','RHYTHM_SLIDE_CHECKPOINT_TAIL_GUARD_MS']
  .map(n=>{const m=data.match(new RegExp(`const ${n}=[\\s\\S]*?;\\n`));return m?m[0]:'';}).join('');
const interval=grab('const rhythmSlideCheckpointIntervalMs=','\n};')+'\n};';
const holdTicks=grab('const rhythmHoldTickTimes=','\n};')+'\n};';
check('ホールドの時刻を作る関数がある',holdTicks.length>20);
const api=new Function(`${consts}\n${interval}\n${holdTicks}\nreturn {rhythmHoldTickTimes,RHYTHM_SLIDE_CHECKPOINT_TAIL_GUARD_MS};`)();
const t=api.rhythmHoldTickTimes({timeMs:1000,endTimeMs:2000,_rhythmCheckpointIntervalMs:125});
check('ホールドはスライドの線と同じ間隔で出す',t.length===7&&t[0]===1125&&t.every((v,i)=>!i||v-t[i-1]===125),JSON.stringify(t));
check('終わりの手前(30ms)には置かない',t.every(v=>v<=2000-api.RHYTHM_SLIDE_CHECKPOINT_TAIL_GUARD_MS));
check('壊れたノーツでは出さない',api.rhythmHoldTickTimes({timeMs:5,endTimeMs:5}).length===0&&api.rhythmHoldTickTimes(null).length===0);

// 数え方は変えない(判定に使う checkpointPassed はそのまま・印だけ足す)
const ev=grab('  const evaluateCheckpoints=(session,perf)=>{','\n  const tick=()=>{');
check('落とした線では印を付けない(スライド)',/if\(session\.trackingBadSincePerf==null\|\|perf-session\.trackingBadSincePerf<graceMs\)\{session\.checkpointPassed\+\+;markLine\(session\.note\);\}/.test(ev));
check('外れているあいだは印を付けない(ホールド)',/if\(session\.trackingBadSincePerf==null\)markTick\(session\.note\);/.test(ev)&&/session\.failed\|\|/.test(ev));
check('ホールドの印は判定に使う数(checkpointPassed)を動かさない',!/session\.kind==='HOLD'[\s\S]{0,400}checkpointPassed/.test(ev));
check('印を増やすのは evaluateCheckpoints だけ',(data.match(/_rhythmTicks=/g)||[]).length===1);

// 演奏画面: 光は canvas・はねは animate・最小と軽量では見た目を出さない
const i=play.indexOf('RHYTHM_NOTE_SE_RUNTIME.holdSync(heldNotes);'),block=play.slice(i,i+2200);
check('曲がりの多い帯でも、1本につき決まった間隔に1回までにまとめる',/if\(frameNowMs-\(Number\(note\._rhythmTickFxAt\)\|\|-1e9\)<RHYTHM_HOLD_TICK_FX_GAP_MS\)continue;/.test(block)&&/const RHYTHM_HOLD_TICK_FX_GAP_MS=100;/.test(data));
check('刻みごとの音は設定「刻みの音の大きさ」しだい(既定0=鳴らさない。2026-10-17 社長「ださい」→「設定でいじれるように」)',/RHYTHM_NOTE_SE_RUNTIME\.playTick\(slide\)/.test(block)&&/noteSeTickVolume:0,/.test(read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'))&&/!\(settings\.tickVolume>0\)/.test(data));
check('軽量モードでは光とはねを出さない・演出量「最小」では弱い形',/if\(settings\.lightweightMode\)continue;\n  const weak=settings\.effectAmount==='MINIMAL';/.test(block));
check('光はノーツの canvas の中に出す',/RHYTHM_CANVAS_RENDERER\.pushTick\(/.test(block)&&!/createElement|appendChild/.test(block));
check('はねは今あるコンボの数字を動かすだけ',/const combo=comboRef\.current;/.test(block)&&/combo\.animate\(/.test(block));
check('コンボの数・スコアには触らない',!/setCombo|combo\+\+|score\s*\+=|addScore|applyJudgment/.test(block));
const push=grab('    pushTick(tick){','\n    },');
check('描き手も軽量モードでは受け付けず、最小では弱い形にする',/\|\|lightweight\)return false;/.test(push)&&/weak:effect==='MINIMAL'/.test(push));
check('光はひとめで分かる長さ(0.3秒)',/const RHYTHM_HOLD_TICK_MS=300;/.test(data));
check('叩いた光の枠を使わない(別の枠)',/tickSlots\[tickNext\]=/.test(push)&&!/hitSlots/.test(push));
const se=grab('  const playTick=(slide=false)=>{','\n  };');
check('音はタップ音量 × 刻みの音の大きさ(押さえている間の音の大きさは使わない)',/const volume=settings\.volume\/100\*settings\.tickVolume\/100;/.test(se)&&!/holdVolume/.test(se));
check('音は曲に埋もれない強さ(叩いた音の基準 .035 に近い)',/tone\('triangle',base,now,\.11,\.03\)/.test(se));
check('音の作りを新しく起こさない(止まっていたら起こすだけ)',/const audio=ctx;/.test(se)&&!/context\(\)/.test(se)&&/audio\.resume\(\)/.test(se));
check('効果音の設定を、保存値が無い端末でも既定で読む',/let ctx=null,cachedRaw=undefined,/.test(data));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
