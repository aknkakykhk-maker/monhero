#!/usr/bin/env node
// 近接TAPの「前へ流れる／後ろへ引っ張られる」を両方まとめて検査する。
//
//   node tools/mode/rhythm-near-note-match-check.js
//
// 判定ランクの幅(最大±185ms)と「どのノーツを狙った入力か」は別問題。
// 単純な近い方は遅押しを次へ飛ばし、過去側100%固定は次ノーツ直前の早押しを前へ吸う。
// 現行は前75%へ寄せた所有境界を使い、次側の早取りはMARVELOUS窓以内へ制限する。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const prefix=source.split('const emptyRhythmChart',1)[0];
const ctx={console,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}};
vm.createContext(ctx);
vm.runInContext(prefix+'\nthis.out={rhythmMatchInputBatch,RHYTHM_INPUT_MATCH_WINDOW_MS,RHYTHM_JUDGMENTS,RHYTHM_TAP_TARGET_PREVIOUS_SHARE,RHYTHM_TAP_TARGET_UPCOMING_MAX_EARLY_MS,RHYTHM_COMBO_SAFE_WINDOW_MS};',ctx);
const {
  rhythmMatchInputBatch,
  RHYTHM_INPUT_MATCH_WINDOW_MS:WINDOW,
  RHYTHM_TAP_TARGET_PREVIOUS_SHARE:PREVIOUS_SHARE,
  RHYTHM_TAP_TARGET_UPCOMING_MAX_EARLY_MS:UPCOMING_EARLY,
  RHYTHM_COMBO_SAFE_WINDOW_MS:SAFE,
}=ctx.out;

const note=(timeMs,index,extra={})=>({type:'TAP',timeMs,lane:2,subLane:5,subLaneWidth:2,
  done:false,activePointerId:null,index,...extra});
const hit=(notes,at,coordinate=6,offset=0)=>{
  const result=rhythmMatchInputBatch(notes,[{inputKey:`k${at}`,lane:2,subLaneCoordinate:coordinate}],at,offset);
  return result[0].target?result[0].target.index:null;
};
// 【2026-09-11】所有境界に上限が付いた。
// 前ノーツがもうBADにしかならない位置(GOODの窓の外)まで落ちていて、次ノーツはまだ
// コンボがつながる範囲にいるなら、そこで次へ渡す。どちらを取っても取らなかったほうは
// 見逃しMISSになるので、捨てるならBADにしかならないほうを捨てる(rhythmChooseTapTarget)。
const comboSwitchDelay=gap=>Math.max(SAFE+1,gap-SAFE);
const switchDelay=gap=>Math.min(Math.max(gap*PREVIOUS_SHARE,gap-UPCOMING_EARLY),comboSwitchDelay(gap));

ok('所有境界は前75%寄せ',PREVIOUS_SHARE===.75,String(PREVIOUS_SHARE));
ok('次ノーツの早取り上限はMARVELOUS窓55ms',UPCOMING_EARLY===55,String(UPCOMING_EARLY));

console.log('\n--- 前方引っ張りを戻さない / 後方引っ張りも止める ---');
const GAPS=[['16分 88ms',88],['3連相当 118ms',118],['8分 176ms',176],['付点8分 264ms',264]];
for(const [label,gap] of GAPS){
  const sw=switchDelay(gap);
  const before=Math.max(0,Math.ceil(sw)-1),at=Math.ceil(sw);
  ok(`${label}: 所有境界の直前は前ノーツ`,
    hit([note(1000,0),note(1000+gap,1)],1000+before)===0,
    `境界=${sw.toFixed(1)}ms / ${before}ms遅れ`);
  ok(`${label}: 所有境界から次ノーツ`,
    hit([note(1000,0),note(1000+gap,1)],1000+at)===1,
    `境界=${sw.toFixed(1)}ms / 次の${(gap-at).toFixed(1)}ms前`);
  ok(`${label}: 次ノーツ時刻ちょうどなら次ノーツ`,
    hit([note(1000,0),note(1000+gap,1)],1000+gap)===1);
}

ok('16分で+60ms遅れは前ノーツのまま',
  hit([note(1000,0),note(1088,1)],1060)===0,
  'A=+60ms / B=-28ms');
ok('16分で次ノーツ10ms前は次ノーツ',
  hit([note(1000,0),note(1088,1)],1078)===1,
  'A=+78ms / B=-10ms');
ok('BAD級の過去ノーツより、ほぼジャストの次ノーツ',
  hit([note(1000,0),note(1240,1)],1239)===1,
  'A=+239ms(BAD) / B=-1ms');

console.log('\n--- 連続入力で位相がずれ続けない ---');
{
  const notes=[note(1000,0),note(1088,1),note(1176,2),note(1264,3)],picked=[];
  for(const at of [1060,1148,1236,1324]){
    const index=hit(notes,at);picked.push(index);
    if(index!==null)notes[index].done=true;
  }
  ok('16分を毎回+60ms遅く叩いても0→1→2→3',picked.join(',')==='0,1,2,3',picked.join(','));
}
{
  const notes=[note(1000,0),note(1088,1),note(1176,2),note(1264,3)],picked=[];
  for(const at of [1078,1166,1254]){
    const index=hit(notes,at);picked.push(index);
    if(index!==null)notes[index].done=true;
  }
  ok('1つめMISS後に各ノーツを10ms早く叩いても1→2→3へ追従',picked.join(',')==='1,2,3',picked.join(','));
}

console.log('\n--- 空間・同時押し・受付窓は従来どおり ---');
{
  const pair=()=>[
    {type:'TAP',timeMs:1000,lane:0,subLane:1,subLaneWidth:2,done:false,activePointerId:null,index:0},
    {type:'TAP',timeMs:1000,lane:4,subLane:8,subLaneWidth:2,done:false,activePointerId:null,index:1}];
  const left=rhythmMatchInputBatch(pair(),[{inputKey:'L',lane:0,subLaneCoordinate:2}],1000,0)[0].target;
  const right=rhythmMatchInputBatch(pair(),[{inputKey:'R',lane:4,subLaneCoordinate:9}],1000,0)[0].target;
  ok('同時押しは押した位置に近いほう',left&&right&&left.index===0&&right.index===1);
}
ok(`受付幅より遅い(${WINDOW+1}ms)と取らない`,hit([note(1000,0)],1000+WINDOW+1)===null);
ok(`受付幅ちょうど(${WINDOW}ms)なら取る`,hit([note(1000,0)],1000+WINDOW)===0);

console.log('\n--- 判定タイミングoffsetでも所有境界は同じ ---');
for(const offset of [50,-50]){
  const gap=176,sw=Math.ceil(switchDelay(gap));
  ok(`offset ${offset>=0?'+':''}${offset}ms: 境界直前は前`,
    hit([note(1000,0),note(1176,1)],1000+offset+sw-1,6,offset)===0);
  ok(`offset ${offset>=0?'+':''}${offset}ms: 境界から次`,
    hit([note(1000,0),note(1176,1)],1000+offset+sw,6,offset)===1);
}

console.log('\n--- 実装ガード ---');
// 引数の並びまで丸ごと一致で見ていたので、候補の比べ方に項目が増えるたびに落ちていた
// (2026-09-11に「同じ時刻なら細いほうを優先」を足して落ちた)。
// ここで見たいのは「過去側と未来側を別々のbestへ絞っているか」なので、そこだけを見る。
ok('過去側と未来側を別々に絞る',
  /passedBest=candidate\(passedBest,note,index,noteTime,inside,distance,true/.test(source)
  &&/upcomingBest=candidate\(upcomingBest,note,index,noteTime,inside,distance,false/.test(source));
ok('共通の所有境界関数を通す',
  /const rhythmChooseTapTarget=\(passed,upcoming,now\)=>/.test(source)
  &&/const chosen=rhythmChooseTapTarget\(passedBest,upcomingBest,now\);/.test(source));
ok('判定段の良い方を選ぶ旧judgeRankは残っていない',!/judgeRank/.test(source));
ok('同時刻では押した位置の内側を優先',
  /const isInside=note=>/.test(source)&&/if\(inside!==current\.inside\)/.test(source));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
