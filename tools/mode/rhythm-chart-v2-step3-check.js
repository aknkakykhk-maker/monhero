#!/usr/bin/env node
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');
const vm=require('vm');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const GENERATOR=path.join(ROOT,'tools/mode/rhythm-chart-v2-step3-generate.js');
const TRACK_ID='monster_hero_theme';
const DIFFICULTIES=['EASY','NORMAL','HARD'];
const ALLOWED_TYPES={EASY:new Set(['TAP','HOLD']),NORMAL:new Set(['TAP','HOLD','FLICK']),HARD:new Set(['TAP','HOLD','FLICK','SLIDE'])};
const CALM_SECTIONS=new Set(['INTRO','BREAK','OUTRO']);
const HOT_SECTIONS=new Set(['CHORUS','FINAL_CHORUS','BUILD','PRE_CHORUS']);

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const walk=(value,visit)=>{
  visit(value);
  if(Array.isArray(value))value.forEach(item=>walk(item,visit));
  else if(value&&typeof value==='object')Object.values(value).forEach(item=>walk(item,visit));
};

const protectedFiles=[
  'monster-hero/data/rhythm-mode.js','monster-hero/data/rhythm-authoring.js',
  'monster-hero/debug/monster-hero-theme-easy-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-normal-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-hard-formal-candidate-v1.json',
  'tools/mode/authoring/monster-hero-theme-v2-features.json',
  'tools/mode/authoring/monster-hero-theme-v2-structure.json',
].map(file=>path.join(ROOT,file));
const beforeHashes=new Map(protectedFiles.map(file=>[file,hash(file)]));

// timing・structureは、生成アルゴリズムを再実装せず「観測可能な性質」を検証するためだけに読む。
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(TRACK_ID)}];`,timingContext);
const timing=timingContext.__t;
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=g=>timing.beatZeroMs+g*gridMs;
const BAR=timing.subdivisionsPerBeat*4;
const structure=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring/monster-hero-theme-v2-structure.json'),'utf8'));
const sections=structure.sections;
const sectionForMs=ms=>{for(const s of sections)if(ms>=s.startMs&&ms<s.endMs)return s;return sections[sections.length-1];};
const sectionTypeForGrid=grid=>sectionForMs(gridTimeMs(Math.floor(grid/BAR)*BAR)).sectionTypeCandidate;

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-v2-step3-'));
const candidates={};
try{
  const run=spawnSync(process.execPath,[GENERATOR,'--track',TRACK_ID,'--write','--output-dir',tempDir],{cwd:ROOT,encoding:'utf8',maxBuffer:4*1024*1024});
  check('STEP3生成が成功',run.status===0,run.status===0?'':(run.stderr||run.stdout).trim());

  for(const difficulty of DIFFICULTIES){
    const tempFile=path.join(tempDir,`monster-hero-theme-v2-chart-${difficulty.toLowerCase()}.json`);
    const committedFile=path.join(ROOT,`tools/mode/authoring/monster-hero-theme-v2-chart-${difficulty.toLowerCase()}.json`);
    check(`${difficulty}: STEP3出力が存在`,fs.existsSync(tempFile));
    if(!fs.existsSync(tempFile))continue;
    check(`${difficulty}: 決定的に再生成可能`,fs.readFileSync(tempFile).equals(fs.readFileSync(committedFile)));
    const candidate=JSON.parse(fs.readFileSync(tempFile,'utf8'));
    candidates[difficulty]=candidate;

    let invalidNumber=false;
    walk(candidate,value=>{if(typeof value==='number'&&!Number.isFinite(value))invalidNumber=true;});
    check(`${difficulty}: NaN / Infinityがない`,!invalidNumber&&!/NaN|Infinity/.test(fs.readFileSync(tempFile,'utf8')));
    check(`${difficulty}: STEP3スキーマ`,candidate.schemaVersion===1&&candidate.analysisType==='rhythm-chart-v2-step3-chart'&&candidate.trackId===TRACK_ID&&candidate.difficulty===difficulty);
    check(`${difficulty}: 耳確認前の設計資料のまま`,candidate.reviewRequired===true&&candidate.runtimeConnected===false);
    check(`${difficulty}: ノーツが存在する`,Array.isArray(candidate.notes)&&candidate.notes.length>0);
    check(`${difficulty}: noteCount・typeCountsが実ノーツ数と一致`,candidate.noteCount===candidate.notes.length&&Object.values(candidate.typeCounts).reduce((a,b)=>a+b,0)===candidate.notes.length);
    check(`${difficulty}: 使用ノーツ種別は難易度で許可された範囲内`,Object.keys(candidate.typeCounts).every(type=>ALLOWED_TYPES[difficulty].has(type)));
    check(`${difficulty}: サブレーンが0〜9・幅内に収まる`,candidate.notes.every(n=>{
      if(n.type==='SLIDE')return n.slidePoints.every(p=>p.lane>=0&&p.lane<=4);
      return typeof n.subLane==='number'&&n.subLane>=0&&n.subLane+(n.subLaneWidth||1)<=10;
    }));
    check(`${difficulty}: 採用ノーツの音ズレは±30ms以内`,candidate.notes.every(n=>!finite(n.sourcePeakOffsetMs)||Math.abs(n.sourcePeakOffsetMs)<=30));
    check(`${difficulty}: motif統計の範囲が妥当`,candidate.motif&&candidate.motif.phrasesApplied<=candidate.motif.phrasesTotal&&candidate.motif.notesGrounded<=candidate.motif.notesAttempted&&candidate.motif.phrasesTotal>=1);
  }
}finally{
  fs.rmSync(tempDir,{recursive:true,force:true});
}

if(candidates.HARD){
  // 構造(section種別)が実際に密度へ反映されているかを、生成済みノーツ自体から検証する
  // （アルゴリズムを再実装せず、出力結果の性質として確認する）。
  const notesByBar=new Map();
  for(const n of candidates.HARD.notes){
    const bar=Math.floor(n.grid/BAR);
    notesByBar.set(bar,(notesByBar.get(bar)||0)+1);
  }
  const calmBars=[],hotBars=[];
  for(const [bar,count] of notesByBar){
    const type=sectionTypeForGrid(bar*BAR);
    if(CALM_SECTIONS.has(type))calmBars.push(count);
    else if(HOT_SECTIONS.has(type))hotBars.push(count);
  }
  const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
  check('HARD: INTRO/BREAK/OUTRO区間の小節あたりノーツ数を計測できた',calmBars.length>=2,`${calmBars.length}小節`);
  check('HARD: CHORUS/FINAL_CHORUS区間の小節あたりノーツ数を計測できた',hotBars.length>=2,`${hotBars.length}小節`);
  check('HARD: 盛り上がり区間のほうが静かな区間より密度が高い(構造がgeneration ruleへ反映されている)',mean(hotBars)>mean(calmBars),`静か${mean(calmBars).toFixed(2)} / 盛り上がり${mean(hotBars).toFixed(2)}`);
}

if(candidates.EASY&&candidates.HARD){
  check('難易度が上がるほどノーツ数が増える',candidates.EASY.noteCount<candidates.NORMAL.noteCount&&candidates.NORMAL.noteCount<candidates.HARD.noteCount);
}

check('V1・STEP1・STEP2の既存出力を変更していない',protectedFiles.every(file=>hash(file)===beforeHashes.get(file)));

const sourceText=fs.readFileSync(GENERATOR,'utf8');
check('V1ジェネレータ本体を読み込んでいない(完全に独立した実装)',!sourceText.includes("require(")||!/require\([^)]*rhythm-monster-hero-chart-build/.test(sourceText));
check('rhythm-mode.jsへ書き込まない(ランタイム未接続)',!sourceText.includes("'monster-hero/data/rhythm-mode.js'"));
check('ゲームruntime・保存・ランキングへ接続しない',!sourceText.includes('localStorage')&&!sourceText.includes('mh_')&&!sourceText.includes('supabase'));
check('構造入力(STEP1/STEP2)を読み込んでいる',sourceText.includes('rhythm-chart-v2-step1-features')&&sourceText.includes('rhythm-chart-v2-step2-structure'));
check('セクション種別による段調整を実装している',sourceText.includes('SECTION_TIER_ADJUST')&&sourceText.includes('sectionTierAdjust'));
check('反復フレーズのmotif接地を実装している',sourceText.includes('repeatedFromPhraseId')&&sourceText.includes('motifNotesGrounded'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
