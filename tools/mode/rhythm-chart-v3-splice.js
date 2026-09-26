#!/usr/bin/env node
// 区間ごとに良い候補を継ぎ合わせる(2026-09-26・MHB CHART ENGINE 強化の段5)。
//
//   node tools/mode/rhythm-chart-v3-splice.js --track <曲id>                       # 候補4本で試して、良くなるかを出すだけ
//   node tools/mode/rhythm-chart-v3-splice.js --track <曲id> --count 6 --chart-revision 10
//   node tools/mode/rhythm-chart-v3-splice.js --track <曲id> --input-dir <dir>     # 解析ファイルの置き場を変える
//   node tools/mode/rhythm-chart-v3-splice.js --track <曲id> --output-dir <dir>    # 継ぎ合わせた譜面(自動修正の前)を書き出す
//   node tools/mode/rhythm-chart-v3-splice.js --track <曲id> --apply               # 公開の流れ(パイプライン)から呼ぶ。Rev.12 以降の曲だけ、
//                                                                                   関門を通った難易度の authoring/<曲>-v3-chart-*.json を差し替える
//
// 【なぜ要るか】
// 「品質が悪ければ譜面全体を作り直す」のではなく「悪い区間だけ直す」(ROADMAP の段5)。
// 生成器の --variant は、ノーツの位置をほぼそのままに形(レーンの並び)だけが違う候補を作る。
// 候補ごとに区間の気になり点(気持ちよさの物差し rhythm-chart-feel-report.js と同じ数え方)を数え、区間ごとに良い候補を採る。
//
// 【決めごと】
//   ・曲の区切り(構造解析の sections)を単位にする。**同じ名札(A・B…)の区切りはまとめて同じ候補を採る**
//     (1番と2番で違う候補を採ると「同じフレーズは同じ形」が崩れる)
//   ・気になり点が同じなら候補0(=いまの作り方)を採る。ほかの候補は、はっきり良いときだけ
//   ・継ぎ合わせたあと両手のシミュレートにかけ、押せない所が出た区切り(とその前)は候補0へ戻す
//   ・authoring/ も公開データも書き換えない。書き出すのは --output-dir を渡したときだけ(自動修正の前の譜面)。
//     例外は --apply(Rev.12 以降の曲だけ・パイプラインが生成の直後に呼ぶ): 関門を通った難易度だけ、生成器が書いたばかりの
//     authoring/<曲>-v3-chart-<難易度>.json を差し替える。関門 = 押せない配置が無い・品質の6軸の合計が候補0より下がらない・
//     気になり点が SPLICE_MIN_GAIN 以上減る。通らなければ候補0(生成器が書いたまま)
//     (2026-09-26・ユーザー指示「俺にやらせないではじめに出した案を取り入れるように進めて」で公開の流れへ入れた。
//      気になり点の重みはまだ仮なので、6軸が下がらないことを関門にして守る)
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {measureFeel,CONCERN_WEIGHTS}=require('./rhythm-chart-feel-report.js');
const {simulateNotes}=require('./rhythm-hand-simulate.js');
const {setHandModelFlags}=require('./rhythm-hand-model.js');
const {chartRevisionOf,handModelFlagsForRevision}=require('./rhythm-chart-v3-revision.js');
const {measure:measureQuality,AXES}=require('./rhythm-chart-quality-report.js');
// 公開の流れで差し替えるのは、このリビジョン以降の曲だけ(それより前の曲の作り方は変えない)
const SPLICE_REVISION=12;

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
// 候補0以外を採るのは、区切りの気になり点がこれ以上少ないときだけ
const SPLICE_MIN_GAIN=1;

const rawConcern=seg=>Object.entries(CONCERN_WEIGHTS).reduce((sum,[key,weight])=>sum+weight*(seg[key]||0),0);

// charts: 候補の譜面の並び(0番がいまの作り方) / audio: 解析ファイル
// 返り値: {notes, choice:Map(名札→候補), before, after, reverted}
const spliceCharts=(charts,audio)=>{
  const timing=audio.timing;
  const gridMs=Number.isFinite(Number(timing.gridMs))?Number(timing.gridMs):timing.beatMs/timing.subdivisionsPerBeat;
  const BAR=timing.subdivisionsPerBeat*(timing.beatsPerBar||4);
  const sections=(audio.structure&&Array.isArray(audio.structure.sections)?audio.structure.sections:[]).slice().sort((a,b)=>a.startBar-b.startBar);
  if(!sections.length)return {notes:charts[0].notes,choice:new Map(),before:null,after:null,reverted:0};
  const startsMs=sections.map(section=>timing.beatZeroMs+section.startBar*BAR*gridMs);
  const labelOf=index=>sections[index].label||`#${index}`;
  // 候補ごとの区切りの気になり点
  const costs=charts.map(chart=>{
    const feel=measureFeel(chart,audio,{withQuality:false,segmentStartsMs:startsMs});
    const bySection=new Array(sections.length).fill(0);
    for(const seg of feel.segments)bySection[seg.index]+=rawConcern(seg);
    return bySection;
  });
  // 同じ名札の区切りはまとめて選ぶ
  const labels=[...new Set(sections.map((_,i)=>labelOf(i)))];
  const choice=new Map();
  for(const label of labels){
    const members=sections.map((_,i)=>i).filter(i=>labelOf(i)===label);
    const total=k=>members.reduce((sum,i)=>sum+costs[k][i],0);
    let best=0;
    for(let k=1;k<charts.length;k++)if(total(k)<=total(best)-SPLICE_MIN_GAIN&&total(k)<total(best))best=k;
    choice.set(label,best);
  }
  const sectionOfGrid=grid=>{let lo=0,hi=sections.length-1;const bar=Math.floor(grid/BAR);while(lo<hi){const mid=(lo+hi+1)>>1;if(sections[mid].startBar<=bar)lo=mid;else hi=mid-1;}return lo;};
  const build=chosen=>{
    const notes=[];
    charts.forEach((chart,k)=>{for(const note of chart.notes){if(chosen[sectionOfGrid(note.grid)]===k)notes.push(JSON.parse(JSON.stringify(note)));}});
    return notes.sort((a,b)=>a.grid-b.grid||(Number(a.subLane)||0)-(Number(b.subLane)||0));
  };
  const chosen=sections.map((_,i)=>choice.get(labelOf(i)));
  // 押せない所が出た区切り(継ぎ目なので、その前の区切りも)を候補0へ戻す。戻すたびに全体を測り直す
  let reverted=0,notes=build(chosen);
  const previous=setHandModelFlags(handModelFlagsForRevision(chartRevisionOf(charts[0])));
  try{
    for(let guard=0;guard<sections.length;guard++){
      const issues=simulateNotes(notes,timing).issues.filter(issue=>issue.severity==='impossible');
      if(!issues.length)break;
      let changed=false;
      for(const issue of issues){
        const index=sectionOfGrid(Math.round((issue.timeMs-timing.beatZeroMs)/gridMs));
        for(const i of [index,index-1])if(i>=0&&chosen[i]!==0){chosen[i]=0;reverted++;changed=true;}
      }
      if(!changed)break;
      notes=build(chosen);
    }
  }finally{setHandModelFlags(previous);}
  const sum=list=>list.reduce((a,b)=>a+b,0);
  const sectionCosts=sections.map((_,i)=>costs[chosen[i]][i]);
  const after=sum(sectionCosts);
  return {notes,chosen,choice,before:sum(costs[0]),after,bestSingle:Math.min(...costs.map(sum)),reverted,sections:sections.length,sectionCosts};
};

// 関門: 押せない配置が無い・品質の6軸の合計が候補0より下がらない・気になり点が SPLICE_MIN_GAIN 以上減る
const spliceGate=(charts,audio,result)=>{
  if(!(result.before-result.after>=SPLICE_MIN_GAIN))return {pass:false,reason:'気になり点がほとんど減らない'};
  const total=chart=>{const m=measureQuality(chart,audio);return {sum:AXES.reduce((a,axis)=>a+m.scores[axis],0),impossible:m.gate.impossible};};
  const before=total(charts[0]),after=total({...charts[0],notes:result.notes});
  if(after.impossible>0)return {pass:false,reason:`押せない配置が${after.impossible}件`};
  if(after.sum<before.sum)return {pass:false,reason:`品質の6軸の合計が下がる(${before.sum.toFixed(1)}→${after.sum.toFixed(1)})`};
  return {pass:true,reason:`品質の6軸の合計 ${before.sum.toFixed(1)}→${after.sum.toFixed(1)}`};
};

// 差し替えたあとも気になり点が高い区切りがあるか(悪い区間だけ作り直す二段目の合図)。
//   区切りの気になり点が SPLICE_BAD_MIN 以上、かつ区切りの中央値の2倍以上
const SPLICE_BAD_MIN=3,SPLICE_EXTRA_COUNT=4,SPLICE_RETRY_REVISION=14;
const badSections=result=>{
  const list=(result.sectionCosts||[]).slice().sort((a,b)=>a-b);
  if(!list.length)return [];
  const median=list[list.length>>1];
  return (result.sectionCosts||[]).map((cost,i)=>({cost,i})).filter(x=>x.cost>=SPLICE_BAD_MIN&&x.cost>=median*2).map(x=>x.i);
};

module.exports={spliceCharts,spliceGate,badSections,SPLICE_MIN_GAIN,SPLICE_REVISION,SPLICE_BAD_MIN,SPLICE_EXTRA_COUNT,SPLICE_RETRY_REVISION};

if(require.main===module){
  const trackId=arg('--track','monster_hero_theme'),dashed=trackId.replace(/_/g,'-');
  const count=Math.max(2,Math.min(8,Number(arg('--count',4))||4));
  const inputDir=arg('--input-dir',null),outputDir=arg('--output-dir',null),revision=arg('--chart-revision',null);
  const apply=process.argv.includes('--apply');
  const authoringDir=path.join(ROOT,'tools/mode/authoring');
  // --apply の書き出し先(生成器が譜面を書いた場所)。既定は authoring/
  const chartDir=arg('--chart-dir',null)?path.resolve(ROOT,arg('--chart-dir')):authoringDir;
  const registry=JSON.parse(fs.readFileSync(path.join(authoringDir,'rhythm-song-registry.json'),'utf8'));
  // --chart-revision があればそれで試す(生成器と同じ。一覧は書き換えない)
  const songRevision=revision!=null?chartRevisionOf({chartRevision:Number(revision)}):chartRevisionOf((registry.songs||{})[trackId]);
  if(apply){
    if(songRevision<SPLICE_REVISION){console.log(`区間の差し替え: Rev.${songRevision} の曲なので差し替えない（Rev.${SPLICE_REVISION} から）`);process.exit(0);}
  }
  const audioFile=path.join(inputDir?path.resolve(ROOT,inputDir):path.join(ROOT,'tools/mode/authoring'),`${dashed}-v3-audio.json`);
  const audio=JSON.parse(fs.readFileSync(audioFile,'utf8'));
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'v3-splice-'));
  try{
    const makeVariant=v=>{
      const dir=path.join(tmp,`v${v}`);if(fs.existsSync(dir))return;fs.mkdirSync(dir);
      const args=[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--variant',String(v),'--write','--output-dir',dir,
        ...(inputDir?['--input-dir',inputDir]:[]),...(revision?['--chart-revision',revision]:[])];
      const result=spawnSync(process.execPath,args,{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
      if(result.status!==0){console.error(`候補${v}を作れませんでした`);process.exit(1);}
    };
    for(let v=0;v<count;v++)makeVariant(v);
    console.log(`区間の差し替え（${trackId}・候補${count}本）`);
    for(const difficulty of DIFFICULTIES){
      const file=v=>path.join(tmp,`v${v}`,`${dashed}-v3-chart-${difficulty.toLowerCase()}.json`);
      if(!fs.existsSync(file(0)))continue;
      let charts=Array.from({length:count},(_,v)=>JSON.parse(fs.readFileSync(file(v),'utf8')));
      let result=spliceCharts(charts,audio);
      // 二段目(Rev.14 から): 差し替えても気になり点の高い区切りが残るなら、候補を SPLICE_EXTRA_COUNT 本足して選び直す(悪い区間だけ作り直す)
      const bad=badSections(result);
      let regenerated='';
      if(bad.length&&songRevision>=SPLICE_RETRY_REVISION){
        for(let v=count;v<count+SPLICE_EXTRA_COUNT;v++)makeVariant(v);
        const more=Array.from({length:SPLICE_EXTRA_COUNT},(_,k)=>JSON.parse(fs.readFileSync(file(count+k),'utf8')));
        const retry=spliceCharts(charts.concat(more),audio);
        const stillBad=badSections(retry).length;
        const adopted=retry.after<result.after,firstAfter=result.after;
        if(adopted){charts=charts.concat(more);result=retry;}
        regenerated=adopted?`  気になり点の高い区切り ${bad.length}つを作り直した（候補を${SPLICE_EXTRA_COUNT}本足す・一巡目 ${firstAfter} → ${result.after}・まだ高い区切り ${stillBad}つ）`
          :`  気になり点の高い区切り ${bad.length}つを作り直そうとしたが、足した候補では良くならなかった`;
      }
      const picked=[...result.choice.entries()].filter(([,k])=>k!==0).map(([label,k])=>`${label}→候補${k}`).join(' ')||'すべて候補0';
      console.log(`  ${difficulty}: 気になり点 ${result.before} → ${result.after}（1本だけ選ぶなら最良 ${result.bestSingle}）  ${picked}${result.reverted?`  押せないので候補0へ戻した区切り ${result.reverted}`:''}${regenerated}`);
      if(apply){
        const gate=spliceGate(charts,audio,result);
        if(gate.pass){
          const out={...charts[0],notes:result.notes,splice:{count:charts.length,choice:Object.fromEntries(result.choice),gate:gate.reason}};
          fs.writeFileSync(path.join(chartDir,path.basename(file(0))),JSON.stringify(out,null,1)+'\n');
          console.log(`    → 差し替えた（${gate.reason}）`);
        }else console.log(`    → 差し替えない（${gate.reason}）`);
      }
      if(outputDir){
        const out={...charts[0],notes:result.notes,splice:{count:charts.length,choice:Object.fromEntries(result.choice)}};
        fs.mkdirSync(path.resolve(ROOT,outputDir),{recursive:true});
        fs.writeFileSync(path.join(path.resolve(ROOT,outputDir),path.basename(file(0))),JSON.stringify(out,null,1)+'\n');
      }
    }
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
