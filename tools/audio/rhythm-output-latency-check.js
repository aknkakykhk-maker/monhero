#!/usr/bin/env node
// 音の出力遅延の補正が効いているかを見る。
//
//   node tools/audio/rhythm-output-latency-check.js
//
// 【なぜ要るか】(2026-09-13・ユーザー報告「他の人からもマーベラス出ないという声がある」)
// 曲の再生位置を ctx.currentTime だけで作っていたため、音が耳へ届くまでの遅れ
// (outputLatency)がまるごと無視されていた。ゲームが「1.000秒」と思う瞬間に聞こえているのは
// 「1.000秒 − 出力遅延」の音なので、音に合わせて叩く人は必ずその分だけ遅れて判定される。
// MARVELOUS は ±55ms しかなく、Android Chrome の outputLatency は 40〜120ms がふつうなので、
// **耳で合わせるかぎりMARVELOUSが原理的に出ない**状態だった。
// 見た目(ノーツの位置)と判定はどちらも同じ songTimeSeconds から出ているので、直すのはここ1か所。
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const data=fs.readFileSync(path.join(ROOT,'monster-hero','data','rhythm-mode.js'),'utf8');
const audio=fs.readFileSync(path.join(ROOT,'monster-hero','src','parts','14-audio.jsx'),'utf8');
const latencyMs=new Function(data+'\nreturn rhythmAudioOutputLatencyMs;')();
const maxMs=new Function(data+'\nreturn RHYTHM_OUTPUT_LATENCY_MAX_MS;')();

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

console.log('--- 出力遅延の読み取り ---');
check('outputLatency があればそれを使う(0.08秒 → 80ms)',latencyMs({outputLatency:.08,baseLatency:.01})===80);
check('outputLatency が無い端末では baseLatency で代える(Safari)',latencyMs({baseLatency:.012})===12);
check('どちらも無ければ補正しない(従来どおり)',latencyMs({})===0&&latencyMs(null)===0);
check('負の値・数でない値は補正しない',latencyMs({outputLatency:-1,baseLatency:-1})===0&&latencyMs({outputLatency:'x'})===0);
check(`端末の申告ミスに備えて上限(${maxMs}ms)で止める`,latencyMs({outputLatency:1.5})===maxMs);

console.log('\n--- 演奏側の配線 ---');
check('曲の時刻から出力遅延を差し引いている',
  /const songTimeSeconds=\(\)=>[^\n]*ctx\.currentTime-startedAt-outputLatencySeconds/.test(audio));
check('曲を鳴らしはじめるときに1回だけ測って固定する',
  /outputLatencySeconds=rhythmAudioOutputLatencyMs\(ctx\)\/1000;/.test(audio)
  &&(audio.match(/rhythmAudioOutputLatencyMs\(/g)||[]).length===1);
check('songTimeSeconds の中で測り直していない(曲の時刻が飛ばない)',
  !/const songTimeSeconds=\(\)=>[^\n]*rhythmAudioOutputLatencyMs/.test(audio));
check('鳴りはじめる前は 0 に留める(音より先にノーツが動き出さない)',
  /const songTimeSeconds=\(\)=>Math\.min\(buffer\.duration,Math\.max\(0,/.test(audio));

console.log('');
if(failed){console.log(`${failed}件のNGがあります`);process.exit(1);}
console.log('すべてOK');
