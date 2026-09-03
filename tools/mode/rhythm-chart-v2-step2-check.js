#!/usr/bin/env node
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const ANALYZER=path.join(ROOT,'tools/mode/rhythm-chart-v2-step2-analyze.js');
const LABELS=new Set(['INTRO','VERSE','BUILD','CHORUS','BREAK','BRIDGE','FINAL_CHORUS','OUTRO']);
const TRACKS=[
  {id:'atsu_cup_theme',input:'tools/mode/authoring/atsu-cup-theme-v2-features.json',output:'tools/mode/authoring/atsu-cup-theme-v2-structure.json'},
  {id:'monster_hero_theme',input:'tools/mode/authoring/monster-hero-theme-v2-features.json',output:'tools/mode/authoring/monster-hero-theme-v2-structure.json'},
];
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const inRange=value=>finite(value)&&value>=0&&value<=1;
const sequential=(items,durationMs)=>items.length>0&&items[0].startMs===0&&items.at(-1).endMs===durationMs&&items.every((item,index)=>item.endMs>item.startMs&&(index===0||item.startMs===items[index-1].endMs));
const walk=(value,visit)=>{
  visit(value);
  if(Array.isArray(value))value.forEach(item=>walk(item,visit));
  else if(value&&typeof value==='object')Object.values(value).forEach(item=>walk(item,visit));
};

const protectedFiles=[
  'monster-hero/data/rhythm-mode.js','monster-hero/data/rhythm-authoring.js',
  'monster-hero/debug/atsu-cup-theme-easy-formal-candidate-v1.json',
  'monster-hero/debug/atsu-cup-theme-easy-formal-candidate-v2-review.json',
  'monster-hero/debug/monster-hero-theme-easy-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-normal-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-hard-formal-candidate-v1.json',
].map(file=>path.join(ROOT,file));
const beforeHashes=new Map(protectedFiles.map(file=>[file,hash(file)]));
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-v2-step2-'));
const analyses=[];
try{
  for(const track of TRACKS){
    const temporary=path.join(tempDir,`${track.id}.json`);
    const run=spawnSync(process.execPath,[ANALYZER,'--track',track.id,'--write','--output',temporary],{cwd:ROOT,encoding:'utf8',maxBuffer:4*1024*1024});
    check(`${track.id} のSTEP2解析が成功`,run.status===0,run.status===0?'':(run.stderr||run.stdout).trim());
    if(run.status!==0||!fs.existsSync(temporary))continue;
    const committed=path.join(ROOT,track.output);
    check(`${track.id} の構造JSONは決定的に再生成可能`,fs.readFileSync(temporary).equals(fs.readFileSync(committed)));
    const analysis=JSON.parse(fs.readFileSync(temporary,'utf8'));
    const step1=JSON.parse(fs.readFileSync(path.join(ROOT,track.input),'utf8'));
    analyses.push(analysis);

    let invalidNumber=false,nullOutsideRepeat=false;
    walk(analysis,value=>{if(typeof value==='number'&&!Number.isFinite(value))invalidNumber=true;});
    for(const phrase of analysis.phrases){
      for(const [key,value] of Object.entries(phrase))if(value===null&&!['repeatGroupId','repeatedFromPhraseId'].includes(key))nullOutsideRepeat=true;
    }
    check(`${track.id} にNaN / Infinityがない`,!invalidNumber&&!/NaN|Infinity/.test(fs.readFileSync(temporary,'utf8')));
    check(`${track.id} のnullは未検出repeatだけ`,!nullOutsideRepeat);
    check(`${track.id} はSTEP2スキーマ`,analysis.schemaVersion===2&&analysis.analysisType==='rhythm-chart-v2-step2-structure');
    check(`${track.id} は正しいSTEP1入力を参照`,analysis.sourceStep1.path===track.input&&analysis.sourceStep1.sha256===hash(path.join(ROOT,track.input))&&analysis.sourceStep1.audioSha256===step1.audioSha256);
    check(`${track.id} のフレーズは全尺を重複なく覆う`,sequential(analysis.phrases,analysis.durationMs));
    check(`${track.id} のセクションは全尺を重複なく覆う`,sequential(analysis.sections,analysis.durationMs));
    check(`${track.id} のフレーズは2〜8小節の可変長`,analysis.phrases.every(item=>item.barCount>=2&&item.barCount<=8)&&new Set(analysis.phrases.map(item=>item.barCount)).size>=2);
    check(`${track.id} のフレーズ境界はdownbeat候補上`,analysis.phrases.every(item=>[0,analysis.durationMs,...step1.timing.downbeat.timesMs].includes(item.startMs)&&[0,analysis.durationMs,...step1.timing.downbeat.timesMs].includes(item.endMs)));
    const phraseById=new Map(analysis.phrases.map(item=>[item.id,item]));
    check(`${track.id} のセクション境界はフレーズ境界上`,analysis.sections.every(item=>phraseById.get(item.startPhraseId)?.startMs===item.startMs&&phraseById.get(item.endPhraseId)?.endMs===item.endMs&&item.phraseIds.every(id=>phraseById.has(id))));
    check(`${track.id} の候補ラベルとscoreが有効`,analysis.sections.every(item=>LABELS.has(item.sectionTypeCandidate)&&item.sectionTypeCandidates.length>=2&&item.sectionTypeCandidates.every(candidate=>LABELS.has(candidate.type)&&inRange(candidate.score))));
    check(`${track.id} のintensity / confidenceが有効`,analysis.sections.every(item=>inRange(item.intensity)&&inRange(item.confidence))&&analysis.phrases.every(item=>inRange(item.intensity)&&inRange(item.confidence)&&inRange(item.boundaryConfidence)&&inRange(item.similarityToSource))&&Object.values(analysis.confidence).every(inRange));
    check(`${track.id} は類似フレーズを検出`,analysis.repeatedPhraseGroups.length>=1&&analysis.repeatedPhraseGroups.every(group=>group.phraseIds.length>=2&&inRange(group.similarity)&&inRange(group.confidence)));
    check(`${track.id} のrepeat参照は過去区間だけ`,analysis.phrases.every((item,index)=>!item.repeatedFromPhraseId||analysis.phrases.findIndex(other=>other.id===item.repeatedFromPhraseId)<index)&&analysis.sections.every((item,index)=>!item.repeatedFromSectionId||analysis.sections.findIndex(other=>other.id===item.repeatedFromSectionId)<index));
    check(`${track.id} の主要accentは区間内`,analysis.sections.every(item=>item.majorAccents.every(accent=>accent.timeMs>=item.startMs&&accent.timeMs<item.endMs&&inRange(accent.accent)&&inRange(accent.confidence))));
    check(`${track.id} はSTEP3以降へ未接続`,analysis.scope.sections===true&&analysis.scope.phrases===true&&analysis.scope.chartGeneration===false&&analysis.scope.expertMaster===false&&analysis.scope.autoCritique===false&&analysis.scope.autoFix===false&&!('charts'in analysis));
  }
}finally{
  fs.rmSync(tempDir,{recursive:true,force:true});
}

check('STEP2解析で既存譜面を変更していない',protectedFiles.every(file=>hash(file)===beforeHashes.get(file)));
check('2曲を同じSTEP2アルゴリズムで解析',analyses.length===2&&analyses[0].algorithm===analyses[1].algorithm);
if(analyses.length===2){
  const labels=new Set(analyses.flatMap(item=>item.sections.map(section=>section.sectionTypeCandidate)));
  check('CHORUS / BREAK / FINAL_CHORUS候補を実データで検出',['CHORUS','BREAK','FINAL_CHORUS'].every(label=>labels.has(label)));
  check('2曲の構造結果が独立',analyses[0].sourceStep1.audioSha256!==analyses[1].sourceStep1.audioSha256&&JSON.stringify(analyses[0].sections)!==JSON.stringify(analyses[1].sections));
}
const sourceText=fs.readFileSync(ANALYZER,'utf8');
check('ゲームruntime・保存・ランキングへ接続しない',!sourceText.includes('localStorage')&&!sourceText.includes('mh_')&&!sourceText.includes('supabase'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
