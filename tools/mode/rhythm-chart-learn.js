#!/usr/bin/env node
// 遊んだ感想(譜面メモ)から、音ゲーの作法の重みを学び直す(2026-09-26・版7〜)。
//
//   node tools/mode/rhythm-chart-learn.js            # 学び直した重みの案を出すだけ(書き換えない)
//   node tools/mode/rhythm-chart-learn.js --write    # 新しい版として chart-knowledge-weights.json へ書き足す
//   node tools/mode/rhythm-chart-learn.js --json
//
// 【なぜ要るか】ユーザー指示「色んな音ゲーが出てるからそれを学習してかつモンビーの中でもどんどん改良出来る仕組みにしていきたい」。
// 作法(rhythm-chart-knowledge.js)の初めの重みは、よその音ゲーの一般的な作り方から決めた「仮の値」。
// このゲームで遊んで 👍 と言われた区間でよく効いていた作法は重みを上げ、👎 の区間でよく効いていた作法は下げる。
//
// 【決めごと】
// ・1回で動かす幅は ±20% まで(数件のメモで作り方がひっくり返らないように)。重みは 0〜2 に収める
// ・その作法が効いた区間が合わせて MIN_EVIDENCE 未満なら動かさない(たまたまを学ばない)
// ・書くときは**新しい版**として書き足す。前の版の重みは消さない(良くならなければ前の版へ戻せる)。
//   書き足すと rhythm-chart-v3-revision.js の最新版が自動で上がり、次に足す曲から効く。
//   公開中の曲を作り直すかは、ユーザーが数字を見て決める(運用ルール ⑩-2)
// ・数えるのは「いま公開中の譜面へのメモ」だけ(譜面メモの指紋が合うもの)。作り直す前の譜面へのメモは、
//   その譜面の作法の印が手元に無いので数えない
// ・作法の印は作者用の譜面(authoring/*-v3-fixed-*.json)から読む。作者用だけ作り直して公開していないと、
//   印が公開中の譜面と食い違うので、作者用の譜面もメモの指紋と合うときだけ数える(丸めの ±2ms は同じとみなす)
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const {KNOWLEDGE,WEIGHTS_FILE,readWeightsFile,latestKnowledgeRevision,weightsForRevision}=require('./rhythm-chart-knowledge.js');
const {loadRuntime,RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
const {validNote,fingerprintOf}=require('./rhythm-chart-feedback.js');

const FEEDBACK_DIR=path.join(ROOT,'tools/mode/authoring/feedback');
const MAX_STEP=.2,MIN_EVIDENCE=3,SMOOTHING=4;

// 作者用の譜面(グリッドで持つ)が、メモの指紋(ノーツ数:最初の時刻:最後の時刻)と同じ譜面か
const authoringMatches=(chart,fingerprint)=>{
  const [count,first,last]=String(fingerprint).split(':').map(Number);
  const notes=Array.isArray(chart&&chart.notes)?chart.notes:[];
  const gridMs=60000/Number(chart&&chart.bpm)/Number(chart&&chart.subdivisionsPerBeat||4);
  if(!notes.length||!Number.isFinite(gridMs))return false;
  const times=notes.map(note=>Number(chart.beatZeroMs)+note.grid*gridMs).sort((a,b)=>a-b);
  return count===notes.length&&Math.abs(first-times[0])<=2&&Math.abs(last-times[times.length-1])<=2;
};

// 👍 と 👎 の数から、次の重みを出す(純粋な式。検査がここを直接たしかめる)
const nextWeight=(weight,good,bad)=>{
  const evidence=good+bad;
  if(evidence<MIN_EVIDENCE)return weight;
  const lean=(good-bad)/(evidence+SMOOTHING);           // -1〜1(件数が少ないほど 0 へ寄る)
  const factor=1+Math.max(-MAX_STEP,Math.min(MAX_STEP,lean*MAX_STEP*2));
  return Math.round(Math.max(0,Math.min(2,weight*factor))*1000)/1000;
};

// メモの区間ごとに、その区間のノーツに付いている作法の印を数える
const tally=()=>{
  const counts=Object.fromEntries(KNOWLEDGE.map(entry=>[entry.id,{good:0,bad:0}]));
  let used=0,stale=0,unreleased=0,segments={good:0,bad:0};
  if(!fs.existsSync(FEEDBACK_DIR))return {counts,used,stale,unreleased,segments};
  const rt=loadRuntime();
  for(const file of fs.readdirSync(FEEDBACK_DIR).filter(f=>f.endsWith('.json'))){
    let list=[];try{list=JSON.parse(fs.readFileSync(path.join(FEEDBACK_DIR,file),'utf8'));}catch{continue;}
    for(const note of Array.isArray(list)?list:[]){
      if(!validNote(note))continue;
      const song=rt.RHYTHM_SONGS.find(entry=>entry.songId===note.songId);
      const runtimeChart=song&&song.difficulties[note.difficulty];
      const trackId=RELEASED_TRACKS[note.songId];
      if(!runtimeChart||!trackId)continue;
      if(fingerprintOf(runtimeChart)!==note.fingerprint){stale++;continue;}
      const chartFile=path.join(ROOT,'tools/mode/authoring',`${trackId.replace(/_/g,'-')}-v3-fixed-${note.difficulty.toLowerCase()}.json`);
      if(!fs.existsSync(chartFile))continue;
      const chart=JSON.parse(fs.readFileSync(chartFile,'utf8'));
      if(!authoringMatches(chart,note.fingerprint)){unreleased++;continue;}
      const gridMs=60000/Number(chart.bpm)/Number(chart.subdivisionsPerBeat||4);
      const timeOf=grid=>Number(chart.beatZeroMs)+grid*gridMs;
      used++;
      note.marks.forEach((mark,i)=>{
        if(mark!=='good'&&mark!=='bad')return;
        segments[mark]++;
        const fromMs=i*note.segmentMs,toMs=fromMs+note.segmentMs;
        const fired=new Set();
        for(const chartNote of chart.notes||[]){
          const t=timeOf(chartNote.grid);
          if(t<fromMs||t>=toMs||!Array.isArray(chartNote.knowledge))continue;
          for(const id of chartNote.knowledge)fired.add(id);
        }
        // 1区間で同じ作法が何回効いても1と数える(音の多い区間が勝ちすぎないように)
        for(const id of fired)if(counts[id])counts[id][mark]++;
      });
    }
  }
  return {counts,used,stale,unreleased,segments};
};

const learn=()=>{
  const base=latestKnowledgeRevision();
  const current=weightsForRevision(base);
  const {counts,used,stale,unreleased,segments}=tally();
  const proposal={};
  for(const entry of KNOWLEDGE){
    const {good,bad}=counts[entry.id];
    proposal[entry.id]={title:entry.title,good,bad,before:current[entry.id],after:nextWeight(current[entry.id],good,bad)};
  }
  const changed=Object.values(proposal).some(row=>row.after!==row.before);
  return {baseRevision:base,nextRevision:base+1,used,stale,unreleased,segments,proposal,changed};
};

module.exports={nextWeight,authoringMatches,tally,learn,MAX_STEP,MIN_EVIDENCE};

if(require.main===module){
  const result=learn();
  if(process.argv.includes('--json')){console.log(JSON.stringify(result,null,1));process.exit(0);}
  console.log(`音ゲーの作法の学び直し（いまの版 ${result.baseRevision}）`);
  console.log(`  使った譜面メモ ${result.used}件（👍 ${result.segments.good}区間 ／ 👎 ${result.segments.bad}区間）${result.stale?` ／ 作り直す前の譜面へのメモ ${result.stale}件は数えない`:''}${result.unreleased?` ／ 作者用の譜面が公開中と違うメモ ${result.unreleased}件は数えない`:''}`);
  for(const [id,row] of Object.entries(result.proposal)){
    console.log(`  ${row.title}\n    効いた区間 👍${row.good} 👎${row.bad}  重み ${row.before} → ${row.after}${row.good+row.bad<MIN_EVIDENCE?`（${MIN_EVIDENCE}区間に満たないので動かさない）`:''}`);
  }
  if(!process.argv.includes('--write')){console.log('\n（--write で新しい版として書き足します）');process.exit(0);}
  if(!result.changed){console.log('\n重みが変わらないので、新しい版は作りません');process.exit(0);}
  const file=readWeightsFile();
  file.revisions[String(result.nextRevision)]={basedOn:result.baseRevision,createdAt:new Date().toISOString().slice(0,10),
    reason:`譜面メモ ${result.used}件（👍${result.segments.good}区間・👎${result.segments.bad}区間）から学び直した`,
    weights:Object.fromEntries(Object.entries(result.proposal).map(([id,row])=>[id,row.after]))};
  fs.writeFileSync(WEIGHTS_FILE,JSON.stringify(file,null,1)+'\n');
  console.log(`\n版 ${result.nextRevision} として書き足しました: ${path.relative(ROOT,WEIGHTS_FILE)}`);
  console.log('次に足す曲からこの版で作られます。公開中の曲を作り直すかは、数字を見て決めてください。');
}
