#!/usr/bin/env node
// 16分の曲に3連符が混ざっていないかの見分け(rhythm-audio-triplet-mix.js・2026-09-29)を見張る。
//   ・16分の曲の一部の小節が3連のフィルなら、注意(triplet-mixed)を出す。止めはしない
//   ・ふつうの16分の曲・曲全体が3連の曲(拍を3つに割っている)には出さない
//   ・解析済みの曲はどれも出ない(いまの曲には3連が混ざる曲が無い)
'use strict';
const fs=require('fs'),path=require('path');
const {tripletMix}=require('./rhythm-audio-triplet-mix.js');
const {collectWarnings}=require('./rhythm-audio-warnings.js');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const bpm=180,beatMs=60000/bpm,timing={bpm,beatMs,beatZeroMs:0,beatsPerBar:4,subdivisionsPerBeat:4};
// 64小節の16分の曲。fills に入れた小節だけ、拍の後ろ2拍を3連で刻む
const song=fills=>{
  const onsets=[];
  for(let bar=0;bar<64;bar++)for(let beat=0;beat<4;beat++){
    const at=(bar*4+beat)*beatMs;
    if(fills.has(bar)&&beat>=2)for(let k=0;k<3;k++)onsets.push({timeMs:at+k*beatMs/3,strength:.6});
    else for(let k=0;k<4;k++)onsets.push({timeMs:at+k*beatMs/4,strength:k===0?.8:.4});
  }
  return onsets;
};
const fills=new Set([7,15,23,31,39,47,55,63]);
const mixed=tripletMix(timing,song(fills));
ok('一部の小節が3連のフィルなら、混ざっていると見る',mixed&&mixed.mixed&&mixed.tripletBars.join(',')===[...fills].join(','),JSON.stringify(mixed&&{ratio:mixed.ratio,bars:mixed.tripletBars}));
const straight=tripletMix(timing,song(new Set()));
ok('ふつうの16分の曲は、混ざっていると見ない',straight&&!straight.mixed,JSON.stringify(straight&&{ratio:straight.ratio,bars:straight.tripletBars.length}));
ok('曲全体が3連(拍を3つに割っている)なら見ない',tripletMix({...timing,subdivisionsPerBeat:3},song(fills))===null);
// フィルが2小節だけなら、まだ偶然と見分けられないので出さない
ok('3連の小節が少なすぎるときは出さない',!tripletMix(timing,song(new Set([15,47]))).mixed);

const base={detected:{bpm,beatZeroMs:0,beatsPerBar:4,confidence:{tempo:1},gridFit:1,beatPresence:1},durationMs:64*4*beatMs,onsetCount:999,sectionCount:3};
const warning=collectWarnings({...base,timing:{...timing,source:'detected'},onsets:song(fills)}).find(w=>w.code==='triplet-mixed');
ok('警告に triplet-mixed として出る(軽い注意・止めない)',warning&&warning.severity==='notice',warning?warning.message:'');
ok('ふつうの16分の曲では警告に出ない',!collectWarnings({...base,timing:{...timing,source:'detected'},onsets:song(new Set())}).some(w=>w.code==='triplet-mixed'));

const dir=path.join(__dirname,'authoring');
const flagged=[];
for(const file of fs.readdirSync(dir).filter(name=>/-v3-audio\.json$/.test(name))){
  const audio=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  const result=tripletMix(audio.timing,audio.onsets);
  if(result&&result.mixed)flagged.push(file);
}
ok('解析済みの曲には出ない',flagged.length===0,flagged.join(' / '));
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 3連が混ざる曲の見分けは期待どおり');
process.exit(failed?1:0);
