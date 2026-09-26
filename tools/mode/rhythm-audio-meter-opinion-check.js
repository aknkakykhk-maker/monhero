#!/usr/bin/env node
// テンポ・拍子の二つ目の意見(rhythm-audio-meter-opinion.js)を見張る(2026-09-26)。
//   ・4拍子(180 BPM)の打点を 3/4 の速さの3拍子(135 BPM)と読んだら疑う。代わりの候補は 180 BPM・4拍子
//   ・本当の3拍子(135 BPM)は疑わない。4拍子と判定したものは見ない
//   ・人が直した2曲(crossing_field / freedom_dive)は、自動判定のままなら疑われ、代わりの候補が人の決めた値に近い
//   ・警告(rhythm-audio-warnings.js)に meter-doubt として出る
'use strict';
const fs=require('fs'),path=require('path');
const {meterOpinion,METER_DOUBT_NOTICE}=require('./rhythm-audio-meter-opinion.js');
const {collectWarnings}=require('./rhythm-audio-warnings.js');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// 4拍子 180 BPM: キックは1・3拍、スネアは2・4拍
const fourFour=[];for(let bar=0;bar<16;bar++)for(let beat=0;beat<4;beat++)fourFour.push({timeMs:(bar*4+beat)*60000/180,strength:.8,character:beat%2===0?'PUNCH':'FULL'});
// 3拍子 135 BPM: キックは1拍、スネアは2・3拍
const threeFour=[];for(let bar=0;bar<16;bar++)for(let beat=0;beat<3;beat++)threeFour.push({timeMs:(bar*3+beat)*60000/135,strength:.8,character:beat===0?'PUNCH':'FULL'});
const misread=meterOpinion({bpm:135,beatZeroMs:0,beatsPerBar:3},fourFour);
ok('4拍子を 3/4 の速さの3拍子と読んだら疑う',misread&&misread.level==='critical',JSON.stringify(misread));
ok('代わりの候補は 4/3 倍の4拍子',misread&&Math.abs(misread.suggestion.bpm-180)<.01&&misread.suggestion.beatsPerBar===4);
const right=meterOpinion({bpm:135,beatZeroMs:0,beatsPerBar:3},threeFour);
ok('本当の3拍子は疑わない',right&&right.level===null,JSON.stringify(right));
ok('4拍子と判定したものは見ない',meterOpinion({bpm:180,beatZeroMs:0,beatsPerBar:4},fourFour)===null);

// 人が直した2曲
const dir=path.join(__dirname,'authoring');
for(const [id,truth] of [['crossing-field',178.97],['freedom-dive',222.22]]){
  const audio=JSON.parse(fs.readFileSync(path.join(dir,`${id}-v3-audio.json`),'utf8'));
  const opinion=meterOpinion(audio.timing.detected,audio.onsets);
  ok(`${id}: 自動判定のままなら疑われ、代わりの候補が人の決めた値に近い`,opinion&&opinion.ratio>=METER_DOUBT_NOTICE&&Math.abs(opinion.suggestion.bpm/truth-1)<.005,
    opinion?`比 ${opinion.ratio} / 候補 ${opinion.suggestion.bpm}（人が決めた値 ${truth}）`:'');
}

// 警告として出る(自動判定のまま使うときは止める)
const warnings=collectWarnings({timing:{source:'detected'},detected:{bpm:135,beatZeroMs:0,beatsPerBar:3,confidence:{tempo:1},gridFit:1,beatPresence:1},
  durationMs:60000,onsetCount:200,sectionCount:3,onsets:fourFour});
const doubt=warnings.find(w=>w.code==='meter-doubt');
ok('自動判定のまま使うときは meter-doubt で止める',doubt&&doubt.severity==='critical',doubt?doubt.message:'');
const trusted=collectWarnings({timing:{source:'command'},detected:{bpm:135,beatZeroMs:0,beatsPerBar:3,confidence:{tempo:1},gridFit:1,beatPresence:1},
  durationMs:60000,onsetCount:200,sectionCount:3,onsets:fourFour}).find(w=>w.code==='meter-doubt');
ok('人が決めた値を使うときは軽い注意に下げる',trusted&&trusted.severity==='notice');
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ テンポ・拍子の二つ目の意見は期待どおり');
process.exit(failed?1:0);
