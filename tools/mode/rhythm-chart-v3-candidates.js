#!/usr/bin/env node
// 同じ曲から譜面の候補を何本か作って、6つの軸で自動採点し、いちばん良いものを選ぶ。
//
//   node tools/mode/rhythm-chart-v3-candidates.js --track <曲id>              # 5本作って比べる
//   node tools/mode/rhythm-chart-v3-candidates.js --track <曲id> --count 8     # 本数を変える
//   node tools/mode/rhythm-chart-v3-candidates.js --track <曲id> --input-dir <dir>
//   node tools/mode/rhythm-chart-v3-candidates.js --track <曲id> --write       # 勝った候補を authoring/ へ
//
// 【なぜ要るか】(2026-09-12)
// V2には「複数候補を作って自動で批評する」段(STEP5)があったが、V3へ移していなかった
// (docs/spec/RHYTHM_ROADMAP.md に2回「まだ無い」と書かれていた)。
// いまは1回生成して検査に通れば出荷なので、「検査は通るが面白くない」譜面が出うる。
//
// 【作り】
// 生成器の --variant に番号を渡すと、同点を崩す種が変わって**別の譜面**になる
// (ノーツの数と位置は音源で決まるので変わらない。変わるのは形＝レーンの並び)。
// その候補を rhythm-chart-quality-report.js の6軸で採点し、合計で並べる。
//
// ★variant 0 は今までの出力とまったく同じ。既定の出荷はいまも0なので、
//   この道具を通さない限り既存の作り方は1ミリも変わらない(運用ルール ⑩-2)。
//
// 【採点】
//   ・出荷を止める条件(gate.impossible=押せない箇所)が1つでもあれば失格
//   ・6軸(押せる/音/読める/流れ/飽きない/難易度の濃淡)の合計で比べる
//   ・同点なら variant の小さいほう(＝いまの作り方に近いほう)を採る
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const {reportFor,AXES}=require('./rhythm-chart-quality-report.js');

const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const trackId=arg('--track','monster_hero_theme');
const count=Math.max(2,Math.min(16,Number(arg('--count',5))||5));
const inputDir=arg('--input-dir',null);
const write=process.argv.includes('--write');
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
const AXIS_LABEL={playability:'押せる',musicality:'音',readability:'読める',flow:'流れ',variety:'飽きない',difficultyFit:'濃淡'};

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'v3-candidates-'));
const dirs=[];
try{
  // ── 候補を作る ────────────────────────────────────────────────────────────
  for(let variant=0;variant<count;variant++){
    const dir=path.join(tmp,`v${variant}`);
    fs.mkdirSync(dir,{recursive:true});
    const args=[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
      '--track',trackId,'--variant',String(variant),'--write','--output-dir',dir];
    if(inputDir)args.push('--input-dir',inputDir);
    const run=spawnSync('node',args,{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
    if(run.status!==0){
      console.error(`✗ 候補${variant}の生成に失敗しました`);
      console.error((run.stderr||'').split('\n').slice(0,4).join('\n'));
      process.exit(1);
    }
    dirs.push({variant,dir});
  }

  // ── 採点する ──────────────────────────────────────────────────────────────
  const scored=[];
  for(const {variant,dir} of dirs){
    const report=reportFor(trackId,{source:'v3',dir,audioDir:inputDir||undefined});
    if(!report){console.error(`✗ 候補${variant}を採点できませんでした`);process.exit(1);}
    const rows={};
    let total=0,impossible=0,measured=0;
    for(const difficulty of DIFFICULTIES){
      const m=report.difficulties[difficulty];
      if(!m)continue;
      measured++;
      impossible+=Number(m.gate?.impossible)||0;
      const sum=AXES.reduce((acc,axis)=>acc+(Number(m.scores?.[axis])||0),0);
      total+=sum;
      rows[difficulty]={sum,scores:m.scores,impossible:Number(m.gate?.impossible)||0};
    }
    scored.push({variant,total:measured?total/measured:0,impossible,rows});
  }

  // 押せない箇所があるものは失格。そのうえで合計の高い順。同点は variant の小さい順
  scored.sort((a,b)=>
    (a.impossible>0?1:0)-(b.impossible>0?1:0)
    ||b.total-a.total
    ||a.variant-b.variant);

  // ── 表に出す ──────────────────────────────────────────────────────────────
  console.log(`\n■ ${trackId} の候補 ${count}本（6軸の合計・難易度ごとの平均）\n`);
  const header=['候補','合計',...AXES.map(a=>AXIS_LABEL[a]),'押せない'];
  console.log('  '+header.map((h,i)=>String(h).padEnd(i===0?6:7)).join(''));
  for(const entry of scored){
    // 表に出す軸の値は、難易度ごとの平均
    const perAxis=AXES.map(axis=>{
      const values=Object.values(entry.rows).map(row=>Number(row.scores?.[axis])||0);
      return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;
    });
    const mark=entry===scored[0]?'★':'  ';
    console.log('  '+[`${mark}v${entry.variant}`,entry.total.toFixed(1),...perAxis,
      entry.impossible>0?`${entry.impossible}件`:'0']
      .map((v,i)=>String(v).padEnd(i===0?6:7)).join(''));
  }
  const winner=scored[0];
  console.log(`\n  勝った候補: v${winner.variant}（合計 ${winner.total.toFixed(1)}）`);
  if(scored.length>1){
    const runnerUp=scored[1];
    console.log(`  2位との差: ${(winner.total-runnerUp.total).toFixed(1)}点（v${runnerUp.variant}）`);
  }
  const disqualified=scored.filter(entry=>entry.impossible>0);
  if(disqualified.length)console.log(`  失格（押せない箇所あり）: ${disqualified.map(e=>'v'+e.variant).join(' / ')}`);

  // 難易度ごとの内訳（勝った候補だけ）
  console.log(`\n  v${winner.variant} の難易度ごとの点数`);
  console.log('    難易度   '+AXES.map(a=>AXIS_LABEL[a].padEnd(7)).join(''));
  for(const difficulty of DIFFICULTIES){
    const row=winner.rows[difficulty];
    if(!row)continue;
    console.log('    '+difficulty.padEnd(9)+AXES.map(a=>String(row.scores?.[a]??'-').padEnd(7)).join(''));
  }

  if(write){
    const target=inputDir?path.resolve(ROOT,inputDir):path.join(ROOT,'tools/mode/authoring');
    const from=path.join(tmp,`v${winner.variant}`);
    let copied=0;
    for(const file of fs.readdirSync(from)){
      if(!file.endsWith('.json'))continue;
      fs.copyFileSync(path.join(from,file),path.join(target,file));
      copied++;
    }
    console.log(`\n書き出し: ${path.relative(ROOT,target)} へ ${copied}件（v${winner.variant}）`);
    console.log('※ ランタイム(rhythm-mode.js)へは反映しません。反映は rhythm-chart-v3-pipeline.js --release です');
  }else{
    console.log('\n（--write を付けると勝った候補を authoring/ へ書き出します。ランタイムへは反映しません）');
  }
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}
