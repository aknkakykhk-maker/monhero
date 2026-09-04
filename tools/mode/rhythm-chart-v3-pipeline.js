#!/usr/bin/env node
// 自動譜面制作V3 パイプライン: 音源解析 → 生成 → 自動修正 → 検証 → 遊べる形にする。
//
//   node tools/mode/rhythm-chart-v3-pipeline.js             # 通して結果を見るだけ
//   node tools/mode/rhythm-chart-v3-pipeline.js --write     # 設計資料(authoring/)を更新する
//   node tools/mode/rhythm-chart-v3-pipeline.js --release   # ランタイム(Monster Hero 候補v3)へ反映する
//   node tools/mode/rhythm-chart-v3-pipeline.js --reanalyze # 音源の解析からやり直す
//   node tools/mode/rhythm-chart-v3-pipeline.js --force     # 重い警告を承知のうえで押し切る
//   node tools/mode/rhythm-chart-v3-pipeline.js --track <曲id> --markers <マーカー名>
//
// 曲は --track で切り替える。拍の基準（BPM・拍の頭）は音源解析の結果をそのまま使うので、
// 新しい曲のために rhythm-timing.js へ手で書き足す必要は無い。
//
// 【止まる条件】
//   ・「押せない」が1件でもある
//   ・難易度の順（ノーツ数）が崩れている
//   ・鳴っていない場所にノーツを置いている（音に乗る率が100%でない）
//   ・音源解析が「重い警告」を出している（テンポが途中で変わる・候補が拮抗している等）
// どれかに当たれば、ランタイムへは反映しない（終了コード1）。
// 重い警告は --force で押し切れるが、そのときは何を無視したかを必ず表示する。
//
// V1（正式候補v1）・V2（候補v2）の譜面には1バイトも触れない。書き換えるのは
// <monster-hero-v3-*-notes> マーカーの内側だけで、書き込む前後で他が変わっていないことを確かめる。
'use strict';
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const {criticalWarnings,formatWarnings}=require('./rhythm-audio-warnings.js');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const release=process.argv.includes('--release');
const write=release||process.argv.includes('--write');
const reanalyze=process.argv.includes('--reanalyze');
const force=process.argv.includes('--force');
const trackId=arg('--track','monster_hero_theme');
const dashed=trackId.replace(/_/g,'-');
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
// ランタイムの譜面を入れる場所（マーカー）の名前。曲ごとに別のマーカーを使う。
// Monster Hero だけは先に <monster-hero-v3-*-notes> で入れてあるので、その名前を保つ。
const markerPrefix=arg('--markers',trackId==='monster_hero_theme'?'monster-hero-v3':`${dashed}-v3`);
const RUNTIME=path.join(ROOT,'monster-hero/data/rhythm-mode.js');

const runTool=(tool,args)=>spawnSync(process.execPath,[path.join(ROOT,'tools/mode',tool),'--track',trackId,...args],
  {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
const step=(label,tool,args)=>{
  const started=Date.now();
  const result=runTool(tool,args);
  if(result.status!==0){
    console.log(`✗ ${label} が失敗しました`);
    console.log((result.stdout||'').split('\n').slice(-12).join('\n'));
    console.log((result.stderr||'').trim());
    process.exit(1);
  }
  console.log(`✓ ${label}  (${((Date.now()-started)/1000).toFixed(1)}秒)`);
  for(const line of (result.stdout||'').trim().split('\n'))if(line.trim())console.log(`    ${line}`);
  return result;
};

console.log(`自動譜面制作V3 パイプライン（${trackId}）`);
console.log(write?(release?'書き出し: 設計資料 + ランタイム（Monster Hero 候補v3）\n':'書き出し: 設計資料のみ\n')
  :'書き出し: なし（--write / --release で書き出します）\n');

const audioFile=path.join(ROOT,`tools/mode/authoring/${dashed}-v3-audio.json`);
if(reanalyze||!fs.existsSync(audioFile))step('音源解析（音の種類・高さ・伸び）','rhythm-audio-analyze-v3.js',['--write']);
else console.log(`✓ 音源解析は既にある（やり直すなら --reanalyze）  ${path.relative(ROOT,audioFile)}`);
step('生成（音の種類・高さ・形の語彙から組み立てる）','rhythm-chart-v3-generate.js',write?['--write']:[]);
if(write)step('自動修正（押せない・忙しい配置をレーンだけ直す）','rhythm-chart-v2-step7-autofix.js',['--source','v3','--write']);

// --- 検証 ---
const sourceKind=write?'v3fixed':'v3';
const verify=runTool('rhythm-chart-v2-step6-playability.js',['--source',sourceKind]);
console.log(`\n${verify.status===0?'✓':'✗'} 両手の指のシミュレート`);
for(const line of (verify.stdout||'').trim().split('\n'))if(/ノーツ|×/.test(line))console.log(`    ${line.trim()}`);

const chartFile=difficulty=>path.join(ROOT,
  `tools/mode/authoring/${dashed}-v3-${write?'fixed':'chart'}-${difficulty.toLowerCase()}.json`);
const charts={};
for(const difficulty of DIFFICULTIES){
  const file=chartFile(difficulty);
  if(!fs.existsSync(file)){console.log(`✗ ${difficulty} の譜面がありません: ${path.relative(ROOT,file)}`);process.exit(1);}
  charts[difficulty]=JSON.parse(fs.readFileSync(file,'utf8'));
}
const audio=JSON.parse(fs.readFileSync(audioFile,'utf8'));
const onsetGrids=new Set(audio.onsets.map(onset=>onset.grid));
// 拍の基準は解析結果のものをそのまま使う。人が monster-hero/data/rhythm-timing.js へ
// 登録した値があれば、解析の段で既にそちらが採用されている（source が registered になる）。
// ここで rhythm-timing.js を直接読むと、登録の無い新しい曲では動かせなくなる。
const timing=audio.timing;
const gridMs=timing.gridMs||timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=grid=>Math.round(timing.beatZeroMs+grid*gridMs);

// --- 音源解析の警告 ---
// テンポを取り違えたまま出来た譜面は、遊ぶ人には「ゲームが壊れている」ようにしか見えない。
// 曲は今後も増えるので、あやしいまま黙って通すことだけは無いようにする。
const warnings=Array.isArray(audio.warnings)?audio.warnings:[];
const critical=criticalWarnings(warnings);
if(warnings.length){
  console.log('\n--- 音源解析からの注意 ---');
  for(const line of formatWarnings(warnings))console.log(`  ${line}`);
}

const problems=[];
if(critical.length&&!force){
  problems.push(`音源解析が重い警告を出している（${critical.map(warning=>warning.code).join(' / ')}）`);
}
if(verify.status!==0)problems.push('「押せない」配置が残っている');
for(let i=1;i<DIFFICULTIES.length;i++){
  const previous=charts[DIFFICULTIES[i-1]].notes.length,current=charts[DIFFICULTIES[i]].notes.length;
  if(current<=previous)problems.push(`難易度の順が崩れている（${DIFFICULTIES[i-1]} ${previous} → ${DIFFICULTIES[i]} ${current}）`);
}
for(const difficulty of DIFFICULTIES){
  const notes=charts[difficulty].notes;
  const off=notes.filter(note=>!onsetGrids.has(note.grid)&&!note.chord);
  if(off.length)problems.push(`${difficulty}: 鳴っていない場所へ置いたノーツが${off.length}件ある`);
}

console.log('\n--- 出荷してよいか ---');
if(problems.length){
  for(const problem of problems)console.log(`  ✗ ${problem}`);
  console.log('\n問題があるのでランタイムへは反映しません。');
  if(critical.length&&!force){
    console.log('（テンポなどを人が確かめたうえで押し切るなら --force、');
    console.log('  正しい値が分かっているなら monster-hero/data/rhythm-timing.js へ登録するか');
    console.log('  rhythm-audio-analyze-v3.js に --bpm / --beat-zero を渡してください）');
  }
  process.exit(1);
}
console.log('  ✓ 「押せない」0件');
console.log(`  ✓ 難易度の順を守っている (${DIFFICULTIES.map(d=>`${d} ${charts[d].notes.length}`).join(' < ')})`);
console.log('  ✓ すべてのノーツが実際に鳴っている場所に乗っている');
if(critical.length&&force){
  console.log(`  ! --force なので重い警告を無視しました（${critical.map(warning=>warning.code).join(' / ')}）`);
}else if(!critical.length){
  console.log('  ✓ 音源解析からの重い警告は無し');
}

if(!release){
  console.log(write?'\n（--release を付けると、ランタイム（Monster Hero 候補v3）へ反映します）'
    :'\n（--write で設計資料、--release でランタイムまで反映します）');
  process.exit(0);
}

// --- 遊べる形にする ---
// 譜面1行の書き方はV1・V2と同じヘルパー（t / h / f / s）を使う。
const runtimeRow=note=>{
  const timeMs=gridTimeMs(note.grid);
  const endFlick=note.endFlick===true?',1':'';
  if(note.type==='SLIDE'){
    const points=note.slidePoints.map(p=>`[${gridTimeMs(p.grid)},${p.lane},${p.subLaneWidth}]`).join(',');
    return `s(${timeMs},${gridTimeMs(note.grid+note.durationGrids)},[${points}]${endFlick})`;
  }
  if(note.type==='HOLD'){
    const taper=Array.isArray(note.holdPoints)&&note.holdPoints.length>=2
      ?`,[${note.holdPoints.map(point=>`[${gridTimeMs(point.grid)},${point.subLane},${point.subLaneWidth}]`).join(',')}]`
      :'';
    const flickArg=taper?(note.endFlick===true?',1':',0'):endFlick;
    return `h(${timeMs},${note.subLane},${note.subLaneWidth},${gridTimeMs(note.grid+note.durationGrids)}${flickArg}${taper})`;
  }
  if(note.type==='FLICK')return `f(${timeMs},${note.subLane},${note.subLaneWidth})`;
  return `t(${timeMs},${note.subLane},${note.subLaneWidth},${note.monsterSlot||0})`;
};

let runtimeSource=fs.readFileSync(RUNTIME,'utf8');
// V1・V2のマーカーの中身を覚えておき、書き込む前に「巻き添えで変えていないか」を確かめる
const snapshot=source=>{
  const out=[];
  for(const prefix of ['monster-hero','monster-hero-v2','monster-hero-v3'].filter(name=>name!==markerPrefix)){
    for(const difficulty of DIFFICULTIES){
      const begin=`// <${prefix}-${difficulty.toLowerCase()}-notes>`;
      const end=`// </${prefix}-${difficulty.toLowerCase()}-notes>`;
      const b=source.indexOf(begin),e=source.indexOf(end);
      out.push(b<0||e<b?null:source.slice(b,e));
    }
  }
  return out;
};
const before=snapshot(runtimeSource);

console.log('\n--- 遊べる形にする ---');
for(const difficulty of DIFFICULTIES){
  const chart=charts[difficulty];
  const out=path.join(ROOT,`monster-hero/debug/${dashed}-${difficulty.toLowerCase()}-formal-candidate-v3.json`);
  fs.writeFileSync(out,JSON.stringify({...chart,candidateVersion:3,status:'V3_PIPELINE_CANDIDATE'},null,1)+'\n');
  const begin=`// <${markerPrefix}-${difficulty.toLowerCase()}-notes>`;
  const end=`// </${markerPrefix}-${difficulty.toLowerCase()}-notes>`;
  const b=runtimeSource.indexOf(begin),e=runtimeSource.indexOf(end);
  if(b<0||e<b){
    console.error(`✗ rhythm-mode.js に ${begin} … ${end} がありません。`);
    console.error('  新しい曲をランタイムへ入れるときは、先に rhythm-mode.js へ空のマーカーと曲の登録を足してください。');
    console.error('  （--markers <名前> で使うマーカー名を変えられます）');
    process.exit(1);
  }
  const rows=[...chart.notes].sort((a,b2)=>a.grid-b2.grid).map(runtimeRow);
  const lines=[];
  for(let i=0;i<rows.length;i+=4)lines.push('  '+rows.slice(i,i+4).join(',')+',');
  runtimeSource=`${runtimeSource.slice(0,b+begin.length)}\n${lines.join('\n')}\n${runtimeSource.slice(e)}`;
  console.log(`  ${difficulty}: ${chart.notes.length}ノーツ  → ${path.relative(ROOT,out)}`);
}
const after=snapshot(runtimeSource);
if(before.some((text,i)=>text!==after[i])){
  console.error('✗ ほかの譜面（v1 / 候補v2 / 候補v3）まで書き換えようとしました。中止します。');
  process.exit(1);
}
fs.writeFileSync(RUNTIME,runtimeSource);
console.log(`  ランタイム: ${path.relative(ROOT,RUNTIME)}（<monster-hero-v3-*-notes> の内側だけ）`);
console.log('\n遊べる形にしました。デバッグ画面の曲選択に「Monster Hero 候補v3」が出ます。');
console.log('※ この後は node tools/build.js を実行してください（配信用JSへ反映するため）。');
