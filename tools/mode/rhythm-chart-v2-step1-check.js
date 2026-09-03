#!/usr/bin/env node
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const ANALYZER=path.join(ROOT,'tools/mode/rhythm-audio-timing-analyze.js');
const TRACKS=[
  {id:'atsu_cup_theme',file:'tools/mode/authoring/atsu-cup-theme-v2-features.json'},
  {id:'monster_hero_theme',file:'tools/mode/authoring/monster-hero-theme-v2-features.json'},
];
const ffmpegAvailable=spawnSync('ffmpeg',['-version'],{encoding:'utf8'}).status===0;
let failed=0;
const check=(name,ok,detail='')=>{
  console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);
  if(!ok)failed++;
};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const inRange=(value,min=0,max=1)=>finite(value)&&value>=min&&value<=max;
const ascending=values=>values.every((value,index)=>index===0||value>values[index-1]);
const walk=(value,visit)=>{
  visit(value);
  if(Array.isArray(value))value.forEach(item=>walk(item,visit));
  else if(value&&typeof value==='object')Object.values(value).forEach(item=>walk(item,visit));
};

const protectedFiles=[
  'monster-hero/data/rhythm-mode.js',
  'monster-hero/data/rhythm-authoring.js',
  'monster-hero/debug/atsu-cup-theme-easy-draft.json',
  'monster-hero/debug/atsu-cup-theme-easy-formal-candidate-v1.json',
  'monster-hero/debug/atsu-cup-theme-easy-formal-candidate-v2-review.json',
  'monster-hero/debug/monster-hero-theme-easy-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-normal-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-hard-formal-candidate-v1.json',
  'tools/mode/authoring/atsu-cup-theme-easy-draft.json',
  'tools/mode/authoring/atsu-cup-theme-onset-candidates.json',
  'tools/mode/authoring/monster-hero-theme-onset-candidates.json',
  'tools/mode/authoring/monster-hero-theme-onset-candidates-dense.json',
].map(file=>path.join(ROOT,file));
const beforeHashes=new Map(protectedFiles.map(file=>[file,hash(file)]));
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-v2-step1-'));
const generated=[];
try{
  for(const track of TRACKS){
    const output=path.join(tempDir,`${track.id}.json`);
    const committed=path.join(ROOT,track.file);
    if(ffmpegAvailable){
      const run=spawnSync(process.execPath,[ANALYZER,'--v2','--track',track.id,'--write','--output',output,'--require-ffmpeg'],{
        cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024,
      });
      check(`${track.id} の実音源解析が成功`,run.status===0,run.status===0?'':(run.stderr||run.stdout).trim());
      if(run.status!==0||!fs.existsSync(output))continue;
      check(`${track.id} の保存JSONは決定的に再生成可能`,fs.readFileSync(output).equals(fs.readFileSync(committed)));
    }else{
      console.log(`- SKIP ${track.id} の再解析: ffmpegなし（保存JSONの内容・音源hashは引き続き検査）`);
    }
    const analysisFile=ffmpegAvailable?output:committed;
    const analysis=JSON.parse(fs.readFileSync(analysisFile,'utf8'));
    generated.push(analysis);

    let invalidNumber=false,nullValue=false;
    walk(analysis,value=>{
      if(typeof value==='number'&&!Number.isFinite(value))invalidNumber=true;
      if(value===null)nullValue=true;
    });
    check(`${track.id} にNaN / Infinityがない`,!invalidNumber&&!/NaN|Infinity/.test(fs.readFileSync(analysisFile,'utf8')));
    check(`${track.id} に数値欠損nullがない`,!nullValue);
    check(`${track.id} はSTEP1スキーマ`,analysis.schemaVersion===2&&analysis.analysisType==='rhythm-chart-v2-step1-features');
    check(`${track.id} は音源ハッシュを保持`,/^[0-9a-f]{64}$/.test(analysis.audioSha256));
    check(`${track.id} の音源ハッシュが実ファイルと一致`,hash(path.join(ROOT,analysis.audio))===analysis.audioSha256);
    check(`${track.id} は全尺を250ms刻みで保持`,analysis.windowMs===500&&analysis.hopMs===250&&analysis.timeline.length>500&&analysis.timeline.at(-1).endMs===analysis.durationMs);
    check(`${track.id} の時系列が昇順`,ascending(analysis.timeline.map(item=>item.startMs))&&analysis.timeline.every((item,index)=>index===0||item.startMs-analysis.timeline[index-1].startMs===250));
    check(`${track.id} のダウンビートが昇順`,analysis.timing.downbeat.beatsPerBar===4&&ascending(analysis.timing.downbeat.timesMs));
    check(`${track.id} のonsetイベントが昇順`,analysis.events.onsets.length>100&&ascending(analysis.events.onsets.map(item=>item.timeMs)));
    check(`${track.id} のonsetは近傍グリッド差を保持`,analysis.events.onsets.every(item=>finite(item.gridOffsetMs)&&Math.abs(item.gridOffsetMs)<=analysis.timing.beatMs/analysis.timing.subdivisionsPerBeat/2+.01));
    check(`${track.id} の主要confidenceが範囲内`,Object.values(analysis.confidence).every(value=>inRange(value))&&inRange(analysis.timing.downbeat.confidence));
    check(`${track.id} のintensityが0〜1`,analysis.timeline.every(item=>inRange(item.intensity))&&analysis.summary.intensity.max===1);
    check(`${track.id} のenergy / low / mid / highが有効`,analysis.timeline.every(item=>finite(item.energy.rms)&&inRange(item.energy.normalized)&&['low','mid','high'].every(key=>finite(item.frequencyBands[key].rms)&&inRange(item.frequencyBands[key].normalized)&&inRange(item.frequencyBands[key].attack))));
    check(`${track.id} のonset density / spectral changeが有効`,analysis.timeline.every(item=>finite(item.onset.densityPerSecond)&&item.onset.densityPerSecond>=0&&inRange(item.spectral.change)));
    check(`${track.id} はSTEP2以降へ未接続`,Object.values(analysis.scope).every(value=>value===false)&&!('sections'in analysis)&&!('phrases'in analysis)&&!('charts'in analysis));
  }
}finally{
  fs.rmSync(tempDir,{recursive:true,force:true});
}

check('解析実行で既存譜面・候補を変更していない',protectedFiles.every(file=>hash(file)===beforeHashes.get(file)));
check('2曲を同じスキーマで解析',generated.length===2&&generated[0].algorithm===generated[1].algorithm&&generated[0].windowMs===generated[1].windowMs);
if(generated.length===2){
  const [atsu,monster]=generated;
  check('2曲の音源と特徴結果を独立保持',atsu.audioSha256!==monster.audioSha256&&atsu.trackId!==monster.trackId);
  check('特定曲の固定結果ではない',Math.abs(atsu.summary.bandBalance.low-monster.summary.bandBalance.low)>.005&&JSON.stringify(atsu.timeline.map(item=>item.intensity))!==JSON.stringify(monster.timeline.map(item=>item.intensity)));
}
const analyzerSource=fs.readFileSync(ANALYZER,'utf8');
check('ゲームruntime・保存・ランキングへ接続しない',!analyzerSource.includes('localStorage')&&!analyzerSource.includes('mh_')&&!analyzerSource.includes('supabase'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
