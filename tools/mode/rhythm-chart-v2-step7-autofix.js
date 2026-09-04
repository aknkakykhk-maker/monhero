#!/usr/bin/env node
// 自動譜面制作システム V2 STEP7: 問題区間の自動修正ループ。
//
//   node tools/mode/rhythm-chart-v2-step7-autofix.js                  # 直した結果を表示するだけ
//   node tools/mode/rhythm-chart-v2-step7-autofix.js --write          # authoring/ へ書き出す
//   node tools/mode/rhythm-chart-v2-step7-autofix.js --source step3   # STEP3出力を直す(既定はSTEP5採用案)
//   node tools/mode/rhythm-chart-v2-step7-autofix.js --difficulty MASTER
//   node tools/mode/rhythm-chart-v2-step7-autofix.js --verbose        # 直した箇所を全部出す
//   node tools/mode/rhythm-chart-v2-step7-autofix.js --file <path>    # 1つの譜面JSONだけ直す(書き出さない)
//   node tools/mode/rhythm-chart-v2-step7-autofix.js --write --output-dir <dir>  # 書き出し先を変える(検査用)
//
// 【何をするか】
// STEP6(両手の指のシミュレート)が「押せない」「忙しい」を場所つきで出すので、それを入力に譜面を直す。
//
// 直すのは**レーンだけ**。音の時刻・種別・幅・長さ・ノーツ数には一切触らない。
// 音を動かしたり消したりすると、STEP1〜5が積み上げたもの(音との一致・構造への追随・motif)が
// 崩れてしまい、「押せるようになったが曲に合っていない譜面」ができるため。
// レーンだけなら、その音を鳴らすタイミングは変わらないまま、手の動きだけが楽になる。
//
// 【どう直すか】
// 悪さを1つの数(cost)にまとめ、下がる置き換えだけを採る。乱数は使わない。
//
//   cost = 押せない×10000 + 忙しい×100 + 8分未満で3レーン以上跳ぶ×10 + レーンの偏り×1
//
// 押せないを最優先で潰し、次に忙しいを減らす。ただし「忙しいを消すために全部を端へ寄せる」
// といった直し方をしないよう、跳びとレーンの偏りも同じ数へ入れている。
// さらに、置き換えを選ぶときだけ「元の場所からどれだけ動かすか」もサブレーン1つあたり3として足す。
// 同じ問題が近い場所でも直せるなら、そちらを選ぶ(譜面の見た目を必要以上に変えないため)。
// 1回のパスで問題のあるノーツを順に試し、cost が下がらなくなったら止める。
//
// 出力は reviewRequired=true / runtimeConnected=false の設計資料で、
// ゲームのランタイム・既存の正式候補v1・V1生成器へは一切接続しない。
const fs=require('fs');
const path=require('path');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const write=process.argv.includes('--write');
const verbose=process.argv.includes('--verbose');
const only=arg('--difficulty');
const sourceKind=arg('--source','step5');
const fileArg=arg('--file',null);
// 検査が既存の成果物を壊さずに書き出せるよう、行き先を差し替えられるようにする
const outputDir=arg('--output-dir',null);
const trackId=arg('--track','monster_hero_theme');
// ファイル名は曲idから作る（曲が増えても、ここへ手で書き足さなくてよい）
const dashed=trackId.replace(/_/g,'-');

// 手のモデルはSTEP6のものをそのまま使う。道具ごとに書き直すと、直したつもりで別の物差しになる。
const step6=require('./rhythm-chart-v2-step6-playability.js');
const {toActions,simulate,handModel,timing,gridTimeMs,BAR}=step6;
const BEAT=timing.subdivisionsPerBeat;

// --- 悪さの重みづけ ---
const COST_IMPOSSIBLE=10000;  // 押せない: 何よりも先に潰す
const COST_STRAINED=100;      // 忙しい: 次に減らす
// 8分未満で3レーン以上跳ぶ配置は、遊ぶ側にはっきり効く難しさなので、
// 「忙しい」1件(100)を消すためでも増やさない重みにする。
const COST_HARD_JUMP=120;
const COST_LANE_SPREAD=1;     // レーンの偏り(いちばん多い-いちばん少ない): 同上
const COST_MOVE=3;            // 元の場所からの移動(サブレーン1つあたり)。近い場所で直せるならそちらを選ぶ
const MAX_PASSES=8;           // これ以上は回さない(下がらなくなれば早く止まる)

const SOURCES=Object.freeze({
  step5:{label:'V2 STEP5 採用案',file:d=>`tools/mode/authoring/${dashed}-v2-step5-chart-${d.toLowerCase()}.json`},
  step3:{label:'V2 STEP3/4 出力',file:d=>`tools/mode/authoring/${dashed}-v2-chart-${d.toLowerCase()}.json`},
  v3:{label:'V3 生成',file:d=>`tools/mode/authoring/${dashed}-v3-chart-${d.toLowerCase()}.json`,
    outFile:d=>`tools/mode/authoring/${dashed}-v3-fixed-${d.toLowerCase()}.json`},
});
const source=fileArg?{label:`指定ファイル ${fileArg}`,file:()=>path.resolve(ROOT,fileArg)}:SOURCES[sourceKind];
if(!source){console.error(`未知の --source です: ${sourceKind} (${Object.keys(SOURCES).join(', ')})`);process.exit(1);}

// --- ノーツの位置 ---
// 指が触るのは中心。式は rhythm-hand-model.js に一本化してある(STEP3・STEP6と同じ物差しにするため)。
const {noteTouchLane,usableTouchSpan,separationRange}=require('./rhythm-hand-model.js');
const laneCenter=note=>noteTouchLane(note);
// 重なり判定のため、どのノーツもサブレーン座標の範囲へ揃える
const span=note=>{
  const width=Number(note.subLaneWidth)||2;
  if(note.subLane!=null&&Number.isFinite(Number(note.subLane)))return {start:Number(note.subLane),end:Number(note.subLane)+width};
  const center=(Number(note.lane)+.5)*2;
  return {start:center-width/2,end:center+width/2};
};
const overlaps=(a,b)=>a.start<b.end-1e-9&&b.start<a.end-1e-9;

// --- 悪さを測る ---
const evaluate=notes=>{
  const issues=simulate(toActions(notes));
  const impossible=issues.filter(x=>x.severity==='impossible').length;
  const strained=issues.filter(x=>x.severity==='strained').length;
  const sorted=[...notes].sort((a,b)=>a.grid-b.grid);
  let hardJumps=0;
  for(let i=1;i<sorted.length;i++){
    const gap=sorted[i].grid-sorted[i-1].grid;
    if(gap<=0||gap>=BEAT)continue;
    if(Math.abs(laneCenter(sorted[i])-laneCenter(sorted[i-1]))>=3)hardJumps++;
  }
  const use=[0,0,0,0,0];
  for(const note of notes)use[Math.max(0,Math.min(4,Math.floor(laneCenter(note))))]++;
  const spread=Math.max(...use)-Math.min(...use);
  return {issues,impossible,strained,hardJumps,spread,
    cost:impossible*COST_IMPOSSIBLE+strained*COST_STRAINED+hardJumps*COST_HARD_JUMP+spread*COST_LANE_SPREAD};
};

// --- そのノーツを置ける場所を全部あげる(いまの場所も含む) ---
const placements=(notes,index)=>{
  const note=notes[index];
  const width=Number(note.subLaneWidth)||2;
  const sameGrid=notes.filter((other,i)=>i!==index&&other.grid===note.grid);
  const others=sameGrid.map(span);
  const fits=candidate=>!others.some(o=>overlaps(candidate,o));
  // 同時押しの相方がいるノーツは、動かすと**同時押しの離れかた**が変わる。
  // 離れかたは難易度ごとに決めた「置き方」そのもの（EASYほど大きく離す）なので、
  // 忙しさを直すために縮めてしまうと、譜面の設計のほうが壊れる。
  // そこで「いま離れているぶんより狭くしない」を条件に足す。
  // （2026-09-05・同時押しの連なりを入れたときに、EXPERTの1組が1.00レーンまで
  //   縮められて設計の1.25レーンを割った。実際に出た不具合）
  const partnerGap=sameGrid.length
    ?Math.min(...sameGrid.map(other=>separationRange(usableTouchSpan(note),usableTouchSpan(other)).min))
    :null;
  const keepsChord=moved=>partnerGap===null||sameGrid.every(other=>
    separationRange(usableTouchSpan(moved),usableTouchSpan(other)).min+1e-9>=partnerGap);
  const out=[];
  if(note.type==='SLIDE'){
    // 経路の形は変えず、まるごと0.5レーンずつ平行移動する
    const points=Array.isArray(note.slidePoints)?note.slidePoints:[];
    if(!points.length)return out;
    const lanes=points.map(p=>Number(p.lane));
    for(let step=-8;step<=8;step++){
      const delta=step*.5;
      if(lanes.some(lane=>lane+delta<0||lane+delta>4))continue;
      const moved={...note,
        lane:lanes[0]+delta,
        endLane:lanes[lanes.length-1]+delta,
        slidePoints:points.map(p=>({...p,lane:Number(p.lane)+delta})),
      };
      if(!fits(span(moved)))continue;
      if(!keepsChord(moved))continue;
      out.push({note:moved,label:`レーン${(lanes[0]).toFixed(1)}→${(lanes[0]+delta).toFixed(1)}`,delta});
    }
    return out;
  }
  // 幅が途中で変わるHOLD(holdPoints)は、いちばん広い時刻でもレーンからはみ出さない範囲だけ動かす。
  // 点だけ置き去りにすると帯と頭がずれるので、点も同じだけ平行移動する。
  const points=Array.isArray(note.holdPoints)?note.holdPoints:null;
  const widest=points?Math.max(width,...points.map(point=>Number(point.subLaneWidth)||width)):width;
  const lowestStart=points?Math.min(...points.map(point=>Number(point.subLane)??Number(note.subLane))):Number(note.subLane);
  for(let subLane=0;subLane+width<=10;subLane++){
    const delta=subLane-Number(note.subLane);
    if(points&&(lowestStart+delta<0||lowestStart+delta+widest>10))continue;
    const moved={...note,subLane,lane:Math.floor(subLane/2),
      ...(points?{holdPoints:points.map(point=>({...point,subLane:Number(point.subLane)+delta}))}:{})};
    if(!fits({start:subLane,end:subLane+width}))continue;
    if(!keepsChord(moved))continue;
    out.push({note:moved,label:`サブレーン${note.subLane}→${subLane}`,delta});
  }
  return out;
};

// --- 直すループ ---
const autofix=notes=>{
  let current=notes.map(n=>({...n}));
  let state=evaluate(current);
  const before={impossible:state.impossible,strained:state.strained,hardJumps:state.hardJumps,spread:state.spread,cost:state.cost};
  const fixes=[];
  let passes=0;
  for(;passes<MAX_PASSES;passes++){
    if(state.impossible===0&&state.strained===0)break;
    // 問題のあるノーツを、押せない→忙しいの順に、譜面の頭から試す。
    // 「押せない」は2つのノーツの**関係**なので、指摘されたノーツだけでなく
    // 直前のノーツも動かせるようにする。片方しか動かせないと、
    // どこへ動かしても別の問題が立つ配置(1つだけ直せないまま残る)が出る。
    // (2026-09-05・全尺の Stay With Me HARD と ドパガキリミックス EXPERT で
    //  実際に1件ずつ残った。相手を動かす手が使えれば直せた)
    // 相手は「直前の1つ」では足りない。実際に出た形は
    // 「SLIDEが終わり、その88ms後に同時押しが来る」というもので、
    // 指摘されるのは同時押しの側、動かしたいのはSLIDEの側だった。
    // 同じgridに相方がいると直前の1つはその相方になってしまい、SLIDEまで届かない。
    // そこで**1拍前までに始まっている音**を全部いっしょに動かせるようにする。
    const withNeighbour=indexes=>indexes.flatMap(index=>{
      const grid=current[index]?.grid;
      if(!Number.isFinite(grid))return [index];
      const near=[index];
      for(let other=0;other<current.length;other++){
        if(other===index)continue;
        const otherGrid=current[other]?.grid;
        if(Number.isFinite(otherGrid)&&otherGrid<=grid&&grid-otherGrid<=BEAT)near.push(other);
      }
      return near;
    });
    const targets=[...new Set([
      ...withNeighbour(state.issues.filter(x=>x.severity==='impossible').map(x=>x.noteIndex)),
      ...withNeighbour(state.issues.filter(x=>x.severity==='strained').map(x=>x.noteIndex)),
    ])];
    let improvedInPass=false;
    for(const index of targets){
      const note=current[index];
      if(!note)continue;
      let best=null;
      for(const candidate of placements(current,index)){
        if(candidate.delta===0)continue;
        const trial=current.slice();
        trial[index]=candidate.note;
        const result=evaluate(trial);
        // SLIDEのdeltaは0.5レーン刻み(=サブレーン1つ)なので、移動量の単位をサブレーンへ揃える
        const moved=Math.abs(candidate.delta)*(note.type==='SLIDE'?2:1);
        const score=result.cost+moved*COST_MOVE;
        // 同点は動かさない(意味のない書き換えを増やさないため)。乱数も使わない
        if(score<state.cost-1e-9&&(!best||score<best.score-1e-9))best={candidate,result,score};
      }
      if(!best)continue;
      fixes.push({
        grid:note.grid,bar:Math.floor(note.grid/BAR),timeMs:Math.round(gridTimeMs(note.grid)),
        type:note.type,move:best.candidate.label,pass:passes+1,
        costBefore:state.cost,costAfter:best.result.cost,
        impossibleAfter:best.result.impossible,strainedAfter:best.result.strained,
      });
      current[index]=best.candidate.note;
      state=best.result;
      improvedInPass=true;
    }
    if(!improvedInPass)break;
  }
  const after={impossible:state.impossible,strained:state.strained,hardJumps:state.hardJumps,spread:state.spread,cost:state.cost};
  return {notes:current,fixes,passes,before,after,issues:state.issues};
};

// --- 実行 ---
const DIFFICULTIES=only?[only]:(fileArg?[null]:['EASY','NORMAL','HARD','EXPERT','MASTER']);
const report={
  schemaVersion:1,
  analysisType:'rhythm-chart-v2-step7-autofix',
  trackId,
  source:fileArg?'file':sourceKind,
  sourceLabel:source.label,
  reviewRequired:true,
  runtimeConnected:false,
  handModel,
  weights:{impossible:COST_IMPOSSIBLE,strained:COST_STRAINED,hardJump:COST_HARD_JUMP,laneSpread:COST_LANE_SPREAD,move:COST_MOVE,maxPasses:MAX_PASSES},
  difficulties:{},
};
console.log(`直す対象: ${source.label}  /  レーンだけを動かす(音の時刻・種別・幅・長さ・ノーツ数は変えない)\n`);
let anyImpossible=false;
for(const difficulty of DIFFICULTIES){
  const rel=difficulty?source.file(difficulty):source.file();
  const file=path.isAbsolute(rel)?rel:path.join(ROOT,rel);
  if(!fs.existsSync(file)){console.log(`${difficulty}: 入力が無いので飛ばす (${path.relative(ROOT,file)})`);continue;}
  const chart=JSON.parse(fs.readFileSync(file,'utf8'));
  const key=difficulty||chart.difficulty||'FILE';
  const {notes,fixes,passes,before,after}=autofix(chart.notes||[]);
  if(after.impossible)anyImpossible=true;

  const arrow=(a,b)=>a===b?`${a}`:`${a}→${b}`;
  console.log(`${key}: ${notes.length}ノーツ  直した ${fixes.length}箇所`);
  console.log(`    押せない ${arrow(before.impossible,after.impossible)}件 / 忙しい ${arrow(before.strained,after.strained)}件`
    +` / 3レーン以上の跳び ${arrow(before.hardJumps,after.hardJumps)} / レーンの偏り ${arrow(before.spread,after.spread)}`);
  const show=verbose?fixes:fixes.slice(0,5);
  for(const fix of show)console.log(`      ${(fix.timeMs/1000).toFixed(1)}s 第${fix.bar+1}小節 ${fix.type}: ${fix.move}`);
  if(!verbose&&fixes.length>5)console.log(`      … ほか${fixes.length-5}箇所(--verbose で全件)`);

  report.difficulties[key]={noteCount:notes.length,fixCount:fixes.length,passes,before,after,fixes};

  if(write&&!fileArg){
    // 入力の系統ごとに書き出し先を変える（V2はSTEP7の名前、V3はV3の名前）
    const relative=source.outFile
      ?source.outFile(key)
      :`tools/mode/authoring/${dashed}-v2-step7-chart-${key.toLowerCase()}.json`;
    const out=outputDir
      ?path.join(path.resolve(ROOT,outputDir),path.basename(relative))
      :path.join(ROOT,relative);
    const fixed={...chart,
      analysisType:source.outFile?'rhythm-chart-v3-fixed':'rhythm-chart-v2-step7-chart',
      step7:{source:sourceKind,fixCount:fixes.length,passes,before,after,
        weights:report.weights,fixes},
      notes,
    };
    fs.writeFileSync(out,JSON.stringify(fixed,null,1)+'\n');
    console.log(`    書き出し: ${path.relative(ROOT,out)}`);
  }
}
if(write&&!fileArg){
  const out=outputDir
    ?path.join(path.resolve(ROOT,outputDir),`${dashed}-v2-step7-autofix-${sourceKind}.json`)
    :path.join(ROOT,`tools/mode/authoring/${dashed}-v2-step7-autofix-${sourceKind}.json`);
  fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
  console.log(`\n書き出し: ${path.relative(ROOT,out)}`);
}else if(fileArg){
  console.log('\n（--file 指定のときは書き出しません）');
}else{
  console.log('\n（--write を付けると tools/mode/authoring/ へ書き出します。ランタイムへは接続しません）');
}
process.exit(anyImpossible?1:0);
