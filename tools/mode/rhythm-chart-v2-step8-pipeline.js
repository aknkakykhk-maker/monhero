#!/usr/bin/env node
// 自動譜面制作システム V2 STEP8: 1コマンド制作パイプライン。
//
//   node tools/mode/rhythm-chart-v2-step8-pipeline.js            # 通して結果を見るだけ
//   node tools/mode/rhythm-chart-v2-step8-pipeline.js --write    # 設計資料(authoring/)を更新する
//   node tools/mode/rhythm-chart-v2-step8-pipeline.js --release  # さらに正式候補v2とランタイムへ反映する
//
// 【何をするか】
// STEP3(生成) → STEP5(複数候補・自動批評) → STEP7(問題区間の自動修正) を順に通し、
// 最後にSTEP6(両手の指のシミュレート)で仕上がりを確かめる。
// ここまでは設計資料を作るだけで、ゲームには何も起きない。
//
// --release を付けたときだけ、出来た譜面を**遊べる形**にする。
//
//   1. monster-hero/debug/monster-hero-theme-<難易度>-formal-candidate-v2.json を書き出す
//   2. monster-hero/data/rhythm-mode.js の <monster-hero-v2-*-notes> マーカーの内側を差し替える
//
// 既存の正式候補v1(monster-hero-theme-*-formal-candidate-v1.json と
// <monster-hero-easy-notes> などのマーカー)には**1バイトも触らない**。
// V2は別の曲「Monster Hero 候補v2」として登録してあるので、v1と並べて遊び比べられる。
// 保存データ(mh_*)・ランキングにも触らない。
//
// 【止まる条件】
// STEP6で「押せない」が1件でもあれば、そこで止めてランタイムへは反映しない(終了コード1)。
// 難易度の順(ノーツ数・密度が EASY<NORMAL<HARD<EXPERT<MASTER)が崩れていても止める。
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const release=process.argv.includes('--release');
const write=release||process.argv.includes('--write');
const trackId=arg('--track','monster_hero_theme');
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
const RUNTIME=path.join(ROOT,'monster-hero/data/rhythm-mode.js');

// --- BPM・グリッド(V1・STEP3〜7と同じものを使う) ---
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(trackId)}];`,timingContext);
const timing=timingContext.__t;
if(!timing)throw new Error(`${trackId} timing data is missing`);
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=grid=>Math.round(timing.beatZeroMs+grid*gridMs);

// --- 各工程を順に通す ---
const STEPS=[
  {id:'STEP3',label:'生成（構造をルールへ反映）',tool:'rhythm-chart-v2-step3-generate.js',args:()=>write?['--write']:[]},
  {id:'STEP5',label:'複数候補を作って自動で批評し、良い案を選ぶ',tool:'rhythm-chart-v2-step5-review.js',args:()=>write?['--write']:[]},
  {id:'STEP7',label:'問題区間の自動修正',tool:'rhythm-chart-v2-step7-autofix.js',args:()=>write?['--write']:[]},
];
const runTool=(tool,args)=>spawnSync(process.execPath,[path.join(ROOT,'tools/mode',tool),'--track',trackId,...args],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024});

console.log(`自動譜面制作V2 パイプライン（${trackId}）`);
console.log(write?(release?'書き出し: 設計資料 + 正式候補v2 + ランタイム\n':'書き出し: 設計資料のみ\n'):'書き出し: なし（--write / --release で書き出します）\n');
for(const step of STEPS){
  const started=Date.now();
  const run=runTool(step.tool,step.args());
  if(run.status!==0){
    console.error(`✗ ${step.id} ${step.label} が失敗しました`);
    console.error((run.stderr||run.stdout||'').trim().split('\n').slice(-8).join('\n'));
    process.exit(1);
  }
  const summary=(run.stdout||'').split('\n').filter(line=>/^(EASY|NORMAL|HARD|EXPERT|MASTER):/.test(line));
  console.log(`✓ ${step.id} ${step.label}  (${((Date.now()-started)/1000).toFixed(1)}秒)`);
  for(const line of summary)console.log(`    ${line}`);
}

// --- 仕上がりを確かめる ---
// 書き出していないときは STEP7 の結果ファイルが無いので、直前の工程の出力で見る。
const source=write?'step7':'step5';
const play=runTool('rhythm-chart-v2-step6-playability.js',['--source',source]);
console.log(`\n✓ STEP6 両手の指のシミュレート（${write?'STEP7の結果':'STEP5の採用案'}）`);
const playLines=(play.stdout||'').split('\n').filter(line=>/^(EASY|NORMAL|HARD|EXPERT|MASTER):/.test(line));
for(const line of playLines)console.log(`    ${line}`);

const charts={};
for(const difficulty of DIFFICULTIES){
  const file=path.join(ROOT,`tools/mode/authoring/monster-hero-theme-v2-${write?'step7-':''}chart-${difficulty.toLowerCase()}.json`);
  const fallback=path.join(ROOT,`tools/mode/authoring/monster-hero-theme-v2-step5-chart-${difficulty.toLowerCase()}.json`);
  const target=write&&fs.existsSync(file)?file:fallback;
  if(!fs.existsSync(target)){console.error(`✗ ${difficulty}: 譜面が見つかりません (${path.relative(ROOT,target)})`);process.exit(1);}
  charts[difficulty]=JSON.parse(fs.readFileSync(target,'utf8'));
}

// --- 出荷してよいかを確かめる ---
const problems=[];
if(play.status!==0)problems.push('STEP6で「押せない」箇所が残っている');
for(let i=1;i<DIFFICULTIES.length;i++){
  const lower=charts[DIFFICULTIES[i-1]],upper=charts[DIFFICULTIES[i]];
  if(!(upper.noteCount>lower.noteCount))problems.push(`${DIFFICULTIES[i]}のノーツ数が${DIFFICULTIES[i-1]}以下 (${lower.noteCount} → ${upper.noteCount})`);
  if(!(upper.densityPerSecond>lower.densityPerSecond))problems.push(`${DIFFICULTIES[i]}の密度が${DIFFICULTIES[i-1]}以下 (${lower.densityPerSecond} → ${upper.densityPerSecond})`);
}
console.log('\n--- 出荷してよいか ---');
if(problems.length){
  for(const problem of problems)console.log(`  ✗ ${problem}`);
  console.log('\n問題があるのでランタイムへは反映しません。');
  process.exit(1);
}
console.log('  ✓ 「押せない」0件');
console.log(`  ✓ 難易度の順を守っている (${DIFFICULTIES.map(d=>`${d} ${charts[d].noteCount}`).join(' < ')})`);

// --- 遊べる形にする(--release のときだけ) ---
// 譜面1行の書き方はv1と同じ。終点フリックだけV2のヘルパー(h2 / s2)の第5引数で足す。
const runtimeRow=note=>{
  const timeMs=gridTimeMs(note.grid);
  const endFlick=note.endFlick===true?',1':'';
  if(note.type==='SLIDE'){
    const points=note.slidePoints.map(p=>`[${gridTimeMs(p.grid??Math.round((p.timeMs-timing.beatZeroMs)/gridMs))},${p.lane},${p.subLaneWidth}]`).join(',');
    return `s(${timeMs},${gridTimeMs(note.grid+note.durationGrids)},[${points}]${endFlick})`;
  }
  if(note.type==='HOLD'){
    // 押さえている途中で幅が変わるHOLDは、6番目の引数へ [[時刻,左端,幅], ...] を渡す。
    // 終点フリック(5番目)を書いていなくても位置がずれないよう、必ず両方を並べる。
    const taper=Array.isArray(note.holdPoints)&&note.holdPoints.length>=2
      ?`,[${note.holdPoints.map(point=>`[${gridTimeMs(point.grid)},${point.subLane},${point.subLaneWidth}]`).join(',')}]`
      :'';
    const flickArg=taper?(note.endFlick===true?',1':',0'):endFlick;
    return `h(${timeMs},${note.subLane},${note.subLaneWidth},${gridTimeMs(note.grid+note.durationGrids)}${flickArg}${taper})`;
  }
  if(note.type==='FLICK')return `f(${timeMs},${note.subLane},${note.subLaneWidth})`;
  return `t(${timeMs},${note.subLane},${note.subLaneWidth},${note.monsterSlot||0})`;
};
if(!release){
  console.log(write
    ?'\n（--release を付けると、正式候補v2とランタイム（Monster Hero 候補v2）へ反映します）'
    :'\n（--write で設計資料、--release でランタイムまで反映します）');
  process.exit(0);
}

let runtimeSource=fs.readFileSync(RUNTIME,'utf8');
const beforeV1=DIFFICULTIES.slice(0,3).map(d=>{
  const begin=`// <monster-hero-${d.toLowerCase()}-notes>`,end=`// </monster-hero-${d.toLowerCase()}-notes>`;
  const b=runtimeSource.indexOf(begin),e=runtimeSource.indexOf(end);
  return runtimeSource.slice(b,e);
});
console.log('\n--- 遊べる形にする ---');
for(const difficulty of DIFFICULTIES){
  const chart=charts[difficulty];
  const out=path.join(ROOT,`monster-hero/debug/monster-hero-theme-${difficulty.toLowerCase()}-formal-candidate-v2.json`);
  fs.writeFileSync(out,JSON.stringify({...chart,candidateVersion:2,status:'V2_PIPELINE_CANDIDATE'},null,1)+'\n');
  const begin=`// <monster-hero-v2-${difficulty.toLowerCase()}-notes>`;
  const end=`// </monster-hero-v2-${difficulty.toLowerCase()}-notes>`;
  const b=runtimeSource.indexOf(begin),e=runtimeSource.indexOf(end);
  if(b<0||e<b)throw new Error(`rhythm-mode.js の V2 ${difficulty} 譜面マーカーが見つかりません`);
  const rows=[...chart.notes].sort((a,b2)=>a.grid-b2.grid).map(runtimeRow);
  const lines=[];
  for(let i=0;i<rows.length;i+=4)lines.push('  '+rows.slice(i,i+4).join(',')+',');
  runtimeSource=`${runtimeSource.slice(0,b+begin.length)}\n${lines.join('\n')}\n${runtimeSource.slice(e)}`;
  console.log(`  ${difficulty}: ${chart.noteCount}ノーツ  → ${path.relative(ROOT,out)}`);
}
// v1のマーカーを巻き添えで変えていないことを、書き込む前に確かめる
const afterV1=DIFFICULTIES.slice(0,3).map(d=>{
  const begin=`// <monster-hero-${d.toLowerCase()}-notes>`,end=`// </monster-hero-${d.toLowerCase()}-notes>`;
  const b=runtimeSource.indexOf(begin),e=runtimeSource.indexOf(end);
  return runtimeSource.slice(b,e);
});
if(beforeV1.some((text,i)=>text!==afterV1[i])){
  console.error('✗ 既存の正式候補v1の譜面まで書き換えようとしました。中止します。');
  process.exit(1);
}
fs.writeFileSync(RUNTIME,runtimeSource);
console.log(`  ランタイム: ${path.relative(ROOT,RUNTIME)}（<monster-hero-v2-*-notes> の内側だけ）`);
console.log('\n遊べる形にしました。デバッグ画面の曲選択に「Monster Hero 候補v2」が出ます。');
console.log('※ この後は node tools/build.js を実行してください（配信用JSへ反映するため）。');
