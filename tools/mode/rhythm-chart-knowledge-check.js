#!/usr/bin/env node
// Rev.7「音ゲーの作法」と、遊んだ感想からの学び直しを見張る(2026-09-26)。
//
//   node tools/mode/rhythm-chart-knowledge-check.js
//   node tools/mode/rhythm-chart-knowledge-check.js --tracks a,b,c
//
// 【なぜ要るか】ユーザー指示「よその作品の譜面知識や音ゲーとしての一般的知識は生成器にいれとてほしい」
// 「決めつけはしないであくまでも曲に合わせた作りをできるようにして」
// 「色んな音ゲーが出てるからそれを学習してかつモンビーの中でもどんどん改良出来る仕組みにしていきたい」。
//
// 見るもの:
//   ・作法の一覧の形(出どころ・効く段・好む形が実在する)
//   ・決めつけない: 曲の音の裏づけが無いときは、どの作法も 0(何もしない)
//   ・学び直しの式: 1回で ±20% まで／区間が少ないと動かさない／0〜2 に収まる
//   ・リビジョンの数え方: 重みを書き足したリビジョンまで最新リビジョンが上がる。前のリビジョンの重みは消えない
//   ・実際にRev.6・Rev.7で生成し、Rev.7は作法が効き、ノーツに印が残り、押せない配置・ノーツ数・質を悪くしない。
//     Rev.6以前の生成には作法の印が一切付かない(公開中の譜面を作り直しても同じものができる)
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const knowledge=require('./rhythm-chart-knowledge.js');
const {nextWeight,authoringMatches,MAX_STEP,MIN_EVIDENCE}=require('./rhythm-chart-learn.js');
const {CHART_REVISION_LATEST,chartRevisionOf}=require('./rhythm-chart-v3-revision.js');
const {PATTERN_BY_ID}=require('./rhythm-chart-v3-patterns.js');
const {reportFor:qualityReportFor}=require('./rhythm-chart-quality-report.js');
const {reportFor:fitReportFor}=require('./rhythm-note-type-fit.js');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// ── 1. 作法の一覧の形 ────────────────────────────────────────────────────────
const {KNOWLEDGE}=knowledge;
const STAGES=new Set(['pick','accent','chord','shape']);
ok('作法が1件以上ある',KNOWLEDGE.length>0);
ok('作法の id が重ならない',new Set(KNOWLEDGE.map(entry=>entry.id)).size===KNOWLEDGE.length);
for(const entry of KNOWLEDGE){
  const shapeOk=!entry.stage.includes('shape')||(Array.isArray(entry.shapeIds)&&entry.shapeIds.length>0&&entry.shapeIds.every(id=>PATTERN_BY_ID[id]));
  ok(`作法「${entry.id}」の形`,typeof entry.title==='string'&&entry.title.length>0
    &&Array.isArray(entry.sources)&&entry.sources.length>0&&entry.sources.every(s=>typeof s==='string'&&s.length>0)
    &&Array.isArray(entry.stage)&&entry.stage.length>0&&entry.stage.every(stage=>STAGES.has(stage))
    &&typeof entry.evidence==='function'&&Number.isFinite(entry.defaultWeight)&&entry.defaultWeight>=0&&entry.defaultWeight<=2&&shapeOk,
  shapeOk?'':'好む形に実在しない形がある');
}

// ── 2. 決めつけない(音の裏づけが無ければ何もしない) ───────────────────────────
{
  const BAR=16,BEAT=4;
  const quiet={intensity:.2,startBar:0,endBarExclusive:8},loud={intensity:.9,startBar:8,endBarExclusive:16};
  const empties=[{},{BAR,BEAT,grid:8*BAR,bar:8,section:loud,previousSection:quiet,nextSection:null,traits:null,onset:null,sectionIntensity:NaN,barDensityRatio:0,isLastNote:false}];
  ok('音の裏づけが無いときは、どの作法も効かない',empties.every(ctx=>KNOWLEDGE.every(entry=>!(entry.evidence(ctx)>0))));
  const flat={character:'PUNCH',strength:.3,crash:false,accent:false,gapBeats:0};
  const flatCtx={BAR,BEAT,grid:8*BAR,bar:8,section:loud,previousSection:quiet,nextSection:null,traits:flat,
    onset:{character:'LIGHT',pitchHz:0,share:{low:.1,lowMid:.1}},sectionIntensity:.5,barDensityRatio:1,isLastNote:true};
  ok('ふつうの音(大きな一発でも歌でもない)には、どの作法も効かない',KNOWLEDGE.every(entry=>!(entry.evidence(flatCtx)>0)));
  const boost=knowledge.knowledgeBoost('accent',flatCtx,knowledge.defaultWeights());
  ok('効かないときは後押しが0',boost.total===0&&boost.fired.length===0);
  // 裏づけがあるときには、それぞれ効く
  const crash={character:'FULL',strength:.9,crash:true,accent:true,gapBeats:2};
  const fire={
    section_opening_hit:{...flatCtx,traits:crash,isLastNote:false},
    final_hit:{...flatCtx,traits:crash,isLastNote:true},
    build_up_fill:{...flatCtx,bar:7,grid:7*BAR,section:quiet,previousSection:null,nextSection:loud,barDensityRatio:1.8},
    layer_follow:{...flatCtx,sectionIntensity:.2,onset:{character:'LIGHT',pitchHz:440,share:{}}},
  };
  for(const entry of KNOWLEDGE){
    if(!fire[entry.id]){ok(`作法「${entry.id}」を確かめる場面がこの検査にある`,false,'新しい作法を足したら、ここへ効く場面を1つ書く');continue;}
    const strength=entry.evidence(fire[entry.id]);
    ok(`作法「${entry.id}」は音の裏づけがあれば効く(0〜1)`,strength>0&&strength<=1,String(strength));
  }
  ok('重み0の作法は効かない',knowledge.knowledgeBoost('accent',fire.final_hit,{...knowledge.defaultWeights(),final_hit:0,section_opening_hit:0}).total===0);
  const shape=knowledge.knowledgeShapePrefer(fire.build_up_fill,knowledge.defaultWeights());
  ok('形の好みは、効いた作法の好む形へだけ足す',shape.fired.includes('build_up_fill')
    &&Object.keys(shape.ids).every(id=>KNOWLEDGE.find(entry=>entry.id==='build_up_fill').shapeIds.includes(id)));
}

// ── 3. 学び直しの式 ──────────────────────────────────────────────────────────
{
  ok('区間が少ないうちは動かさない',nextWeight(1,MIN_EVIDENCE-1,0)===1&&nextWeight(1,0,MIN_EVIDENCE-1)===1);
  ok('👍が多いと上がり、👎が多いと下がる',nextWeight(1,10,0)>1&&nextWeight(1,0,10)<1&&nextWeight(1,5,5)===1);
  let bounded=true;
  for(const weight of [0,.3,1,1.7,2])for(let good=0;good<=60;good+=7)for(let bad=0;bad<=60;bad+=7){
    const next=nextWeight(weight,good,bad);
    if(!(next>=0&&next<=2))bounded=false;
    if(Math.abs(next-weight)>weight*MAX_STEP+.001&&!(next===2||next===0))bounded=false;
  }
  ok(`1回で動くのは ±${Math.round(MAX_STEP*100)}% まで・0〜2 に収まる`,bounded);
  // 作法の印は作者用の譜面から読むので、公開中の譜面(メモの指紋)と同じものかを確かめてから数える
  const chart={bpm:120,subdivisionsPerBeat:4,beatZeroMs:1000,notes:[{grid:0},{grid:8},{grid:16}]};
  ok('作者用の譜面が公開中と同じか見分ける(丸めの ±2ms は同じ)',authoringMatches(chart,'3:1000:3000')&&authoringMatches(chart,'3:1001:2999')
    &&!authoringMatches(chart,'4:1000:3000')&&!authoringMatches(chart,'3:1000:3250')&&!authoringMatches({notes:[]},'0:0:0'));
}

// ── 4. リビジョンの数え方 ────────────────────────────────────────────────────────────
{
  const file=knowledge.readWeightsFile();
  const numbers=Object.keys(file.revisions).map(Number);
  ok('重みの置き場が読める',file.schemaVersion===1&&numbers.length>0&&numbers.every(n=>Number.isInteger(n)&&n>=knowledge.KNOWLEDGE_BASE_REVISION));
  ok('最新リビジョンは、重みを書き足したリビジョンまで上がる',CHART_REVISION_LATEST===Math.max(7,...numbers)&&CHART_REVISION_LATEST===knowledge.latestKnowledgeRevision());
  ok('Rev.7以降はリビジョンとして読める',chartRevisionOf({chartRevision:7})===7&&chartRevisionOf({chartRevision:CHART_REVISION_LATEST})===CHART_REVISION_LATEST);
  let shapeOk=true;
  for(const [key,revision] of Object.entries(file.revisions)){
    const n=Number(key);
    if(!revision||typeof revision.weights!=='object')shapeOk=false;
    else for(const [id,value] of Object.entries(revision.weights))if(!knowledge.KNOWLEDGE_BY_ID[id]||!(Number(value)>=0&&Number(value)<=2))shapeOk=false;
    if(n>knowledge.KNOWLEDGE_BASE_REVISION&&!(Number.isInteger(revision.basedOn)&&revision.basedOn<n&&file.revisions[String(revision.basedOn)]))shapeOk=false;
  }
  ok('各リビジョンの重みは既知の作法だけ・0〜2・学び直したリビジョンは元のリビジョンを指す',shapeOk);
  const weights=knowledge.weightsForRevision(CHART_REVISION_LATEST);
  ok('最新リビジョンの重みが全部の作法にある',KNOWLEDGE.every(entry=>Number.isFinite(weights[entry.id])));
}

// ── 5. Rev.6・Rev.7で実際に作って比べる ─────────────────────────────────────────
const tracks=(arg('--tracks','nothing_without_you,dullahan,kindan_no_resistance,monster_hero_theme')||'').split(',').filter(Boolean);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'chart-knowledge-'));
try{
  const AXES=['playability','musicality','readability','flow','variety','difficultyFit'];
  const sum={6:{notes:0,impossible:0,marked:0,axes:{},flickFit:0,chordFit:0,fitN:0},7:{notes:0,impossible:0,marked:0,axes:{},flickFit:0,chordFit:0,fitN:0}};
  const fired={};let badIds=0,chordPartnerMarked=0,rows=0;
  for(const trackId of tracks){
    for(const revision of [6,7]){
      const dir=path.join(tmp,`${trackId}-r${revision}`);
      fs.mkdirSync(dir,{recursive:true});
      const run=spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),'--track',trackId,
        '--chart-revision',String(revision),'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
      if(run.status!==0){ok(`${trackId} Rev.${revision}を生成できる`,false,(run.stderr||'').split('\n')[0]);continue;}
      const quality=qualityReportFor(trackId,{dir,source:'v3'});
      const fit=fitReportFor(trackId,{dir,source:'v3'});
      for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){
        const chart=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
        if(!Array.isArray(chart.notes))continue;
        for(const note of chart.notes){
          if(!Array.isArray(note.knowledge))continue;
          sum[revision].marked++;
          if(note.chord)chordPartnerMarked++;
          for(const id of note.knowledge){if(!knowledge.KNOWLEDGE_BY_ID[id])badIds++;fired[id]=(fired[id]||0)+1;}
        }
        if(revision===6&&chart.knowledge)sum[6].marked++;
      }
      for(const [difficulty,report] of Object.entries(quality.difficulties)){
        const s=sum[revision];
        s.notes+=report.noteCount;s.impossible+=report.gate.impossible;
        for(const axis of AXES)s.axes[axis]=(s.axes[axis]||0)+(Number(report.scores[axis])||0);
        const m=fit.difficulties[difficulty];
        if(m){s.flickFit+=m.flickFit||0;s.chordFit+=m.chordFit||0;s.fitN++;}
        if(revision===7)rows++;
      }
    }
  }
  ok('Rev.6以前の生成には作法の印が付かない',sum[6].marked===0,`${sum[6].marked}件`);
  ok('Rev.7は作法が効いてノーツに印が残る',sum[7].marked>0,Object.entries(fired).map(([id,n])=>`${id} ${n}`).join(' / '));
  ok('印は既知の作法だけ・同時押しの2本目には付けない',badIds===0&&chordPartnerMarked===0);
  ok('Rev.7で押せない配置を増やしていない',sum[7].impossible<=sum[6].impossible,`Rev.6 ${sum[6].impossible} → Rev.7 ${sum[7].impossible}`);
  ok('Rev.7でノーツ数を大きく変えていない',Math.abs(sum[7].notes-sum[6].notes)<=sum[6].notes*.03,`Rev.6 ${sum[6].notes} → Rev.7 ${sum[7].notes}`);
  const avg=(s,axis)=>rows?s.axes[axis]/rows:0;
  const worse=AXES.filter(axis=>avg(sum[7],axis)<avg(sum[6],axis)-3);
  ok('Rev.7で質の6軸がどれも3点より下がらない',worse.length===0,
    AXES.map(axis=>`${axis} ${avg(sum[6],axis).toFixed(0)}→${avg(sum[7],axis).toFixed(0)}`).join(' / '));
  const fitAvg=(s,key)=>s.fitN?s[key]/s.fitN:0;
  ok('Rev.7でノーツの種類が音に合う割合を下げていない',fitAvg(sum[7],'flickFit')>=fitAvg(sum[6],'flickFit')-.05&&fitAvg(sum[7],'chordFit')>=fitAvg(sum[6],'chordFit')-.05,
    `フリック ${Math.round(fitAvg(sum[6],'flickFit')*100)}%→${Math.round(fitAvg(sum[7],'flickFit')*100)}% / 同時押し ${Math.round(fitAvg(sum[6],'chordFit')*100)}%→${Math.round(fitAvg(sum[7],'chordFit')*100)}%`);
}finally{
  fs.rmSync(tmp,{recursive:true,force:true});
}

console.log(failed?`\n✗ ${failed}件NG`:'\n✓ 音ゲーの作法(Rev.7)と学び直しは期待どおり');
process.exit(failed?1:0);
