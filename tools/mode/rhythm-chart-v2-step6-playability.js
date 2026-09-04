#!/usr/bin/env node
// 自動譜面制作システム V2 STEP6: 自動プレイ可能性検査の強化。
//
//   node tools/mode/rhythm-chart-v2-step6-playability.js                      # V2 STEP5の採用案を検査
//   node tools/mode/rhythm-chart-v2-step6-playability.js --source step3       # V2 STEP3の出力を検査
//   node tools/mode/rhythm-chart-v2-step6-playability.js --source v1          # 既存の正式候補v1を検査(較正用)
//   node tools/mode/rhythm-chart-v2-step6-playability.js --difficulty HARD
//   node tools/mode/rhythm-chart-v2-step6-playability.js --write              # 結果をauthoring/へ書き出す
//   node tools/mode/rhythm-chart-v2-step6-playability.js --verbose            # 問題箇所を全件表示
//
// 【なぜ要るか】
// STEP5の自動批評は「8分未満の間隔で3レーン以上跳ぶ組み合わせの割合」だけを見ていて、
// EXPERT / MASTER はそこが0点だった。ただしあの指標は割合を数えるだけで、
// 「実際に人間の手で押せるのか」は答えていない。HOLDで指が塞がっている最中の別ノーツも、
// 同時押しの指の届く範囲も、指を戻す時間も見ていない。
//
// ここでは両手の指を実際に割り当ててシミュレートし、押せない箇所を場所つきで出す。
// STEP7(問題区間の自動修正ループ)がそのまま入力として使える形で報告する。
//
// 【手のモデル】
// スマホを両手で持って親指2本で押す、という前提。指は2本。
//   ・指は「いまいるレーン」と「いつ空くか」を持つ
//   ・ノーツは時刻順に、届く指のうち移動距離の小さいほうへ割り当てる
//   ・HOLD / SLIDE はその長さのあいだ指を占有する(SLIDEは経路を追う)
//   ・同じ指で続けて叩くには最低限の間隔が要る(指を戻す時間)
//
// しきい値は「快適」と「限界」の2段。快適を超えたら警告、限界を超えたら押せないとする。
// どちらも実測ではなく設計上の目安で、ここを動かすと判定結果が変わるため定数で明示しておく。
//
// 判定・スコア・ランタイムには一切関与しない。既存譜面も書き換えない。
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const write=process.argv.includes('--write');
const verbose=process.argv.includes('--verbose');
const only=arg('--difficulty');
const sourceKind=arg('--source','step5');
const trackId=arg('--track','monster_hero_theme');
// --file <path>: 1つの譜面JSONだけを検査する(STEP5が候補ごとに呼ぶ)。書き出しはしない。
const fileArg=arg('--file',null);
const canWrite=write&&!fileArg;

// --- 手のモデルの定数 ---
// レーンは0〜4。親指1本がレーンをまたぐ速さと、同じ指で叩き直す間隔を決める。
const HANDS=2;                       // 親指2本
const LANE_SPEED_COMFORT=10;         // 快適に動かせる速さ(レーン/秒)。1レーン100ms
const LANE_SPEED_LIMIT=18;           // ここを超えると押せないとみなす。1レーン約56ms
const RESTRIKE_COMFORT_MS=90;        // 同じ指で叩き直すのに欲しい間隔
const RESTRIKE_LIMIT_MS=55;          // これより短いと同じ指では押せない
const CHORD_MIN_LANE_GAP=1;          // 同時押しは1レーン以上離れていないと2本の指が入らない
const RELEASE_MARGIN_MS=30;          // HOLD/SLIDEを離してから次を押すまでの余裕
const END_FLICK_RELEASE_MS=80;       // 終点フリックは「弾いて戻す」ぶん、指の解放がこれだけ遅れる

const SOURCES=Object.freeze({
  step5:{label:'V2 STEP5 採用案',file:d=>`tools/mode/authoring/monster-hero-theme-v2-step5-chart-${d.toLowerCase()}.json`,
    difficulties:['EASY','NORMAL','HARD','EXPERT','MASTER']},
  step3:{label:'V2 STEP3/4 出力',file:d=>`tools/mode/authoring/monster-hero-theme-v2-chart-${d.toLowerCase()}.json`,
    difficulties:['EASY','NORMAL','HARD','EXPERT','MASTER']},
  v1:{label:'既存の正式候補v1',file:d=>`monster-hero/debug/monster-hero-theme-${d.toLowerCase()}-formal-candidate-v1.json`,
    difficulties:['EASY','NORMAL','HARD']},
});
const source=fileArg
  ?{label:`指定ファイル ${path.relative(ROOT,path.resolve(ROOT,fileArg))}`,file:()=>path.resolve(ROOT,fileArg),difficulties:null}
  :SOURCES[sourceKind];
if(!source){console.error(`未知の --source です: ${sourceKind} (${Object.keys(SOURCES).join(', ')})`);process.exit(1);}

// --- BPM・グリッド ---
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(trackId)}];`,timingContext);
const timing=timingContext.__t;
if(!timing)throw new Error(`${trackId} timing data is missing`);
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=g=>timing.beatZeroMs+g*gridMs;
const BAR=timing.subdivisionsPerBeat*4;

// --- ノーツを「指の仕事」へ均す ---
// TAP/FLICK: その瞬間だけ指を使う
// HOLD:      始点から終点まで、同じレーンで指を占有する
// SLIDE:     始点から終点まで、経路のレーンを追いながら指を占有する
// endFlick:  終わりを弾いて離すので、指が空くのが END_FLICK_RELEASE_MS だけ遅れる
const toActions=notes=>notes.map((note,index)=>{
  const startMs=gridTimeMs(note.grid);
  const lane=Number(note.lane)||0;
  const endFlick=note.endFlick===true&&(note.type==='HOLD'||note.type==='SLIDE');
  if(note.type==='HOLD'){
    const endMs=gridTimeMs(note.grid+(Number(note.durationGrids)||0));
    return {index,type:note.type,startMs,endMs,startLane:lane,endLane:lane,grid:note.grid,endFlick,note};
  }
  if(note.type==='SLIDE'){
    const points=Array.isArray(note.slidePoints)&&note.slidePoints.length?note.slidePoints:null;
    const endGrid=note.grid+(Number(note.durationGrids)||0);
    const endLane=points?Number(points[points.length-1].lane):Number(note.endLane??lane);
    return {index,type:note.type,startMs,endMs:gridTimeMs(endGrid),startLane:lane,endLane,grid:note.grid,endFlick,note};
  }
  return {index,type:note.type,startMs,endMs:startMs,startLane:lane,endLane:lane,grid:note.grid,endFlick:false,note};
}).sort((a,b)=>a.startMs-b.startMs||a.startLane-b.startLane);

// --- 両手の指でシミュレートする ---
const simulate=actions=>{
  // 指の初期位置は中央寄りの2レーン。曲が始まる前なので好きな場所に置ける
  const fingers=Array.from({length:HANDS},(_,i)=>({lane:i===0?1:3,freeAtMs:-Infinity,lastHitMs:-Infinity}));
  const issues=[];
  const addIssue=(severity,kind,action,detail)=>issues.push({
    severity,kind,noteIndex:action.index,grid:action.grid,
    timeMs:Math.round(action.startMs),bar:Math.floor(action.grid/BAR),
    lane:action.startLane,type:action.type,detail,
  });

  // 同じ時刻に複数のノーツ(同時押し)があるときはまとめて配る
  let i=0;
  while(i<actions.length){
    let j=i;
    while(j+1<actions.length&&Math.abs(actions[j+1].startMs-actions[i].startMs)<1)j++;
    const group=actions.slice(i,j+1);

    if(group.length>HANDS){
      addIssue('impossible','同時に押す数が指より多い',group[0],
        `同じ瞬間に${group.length}個(指は${HANDS}本)`);
    }
    if(group.length===2){
      const gap=Math.abs(group[0].startLane-group[1].startLane);
      if(gap<CHORD_MIN_LANE_GAP){
        addIssue('impossible','同時押しが近すぎて指が2本入らない',group[0],
          `レーン差${gap}(最低${CHORD_MIN_LANE_GAP})`);
      }
    }

    // グループ内の各ノーツを、届く指へ割り当てる。
    // 以前は1音ずつ「その場で安い指」を取っていたため、同時押しで右手を近い相方へ使ってしまい、
    // 残った本体に左手が間に合わない(左右を入れ替えれば押せる)配置を「押せない」と誤判定していた。
    // 同時押しの組は、指の割り当ての全通りを試し、全部押せる組み合わせのうち無理の少ないものを選ぶ。
    const evaluate=(f,action)=>{
      // まだ前のHOLD/SLIDEを押さえている指は使えない
      if(f.freeAtMs+RELEASE_MARGIN_MS>action.startMs)
        return {ok:false,reason:`前のHOLD/SLIDEを${Math.round(f.freeAtMs-action.startMs)}ms後まで押さえている`};
      const availableMs=action.startMs-Math.max(f.freeAtMs,f.lastHitMs);
      const distance=Math.abs(f.lane-action.startLane);
      // 限界: これを満たせないと、その指では物理的に間に合わない
      const needLimitMs=distance===0?RESTRIKE_LIMIT_MS:distance/LANE_SPEED_LIMIT*1000;
      if(availableMs+1e-6<needLimitMs){
        return {ok:false,reason:distance===0
          ?`同じレーンを${Math.round(availableMs)}msで叩き直せない(最低${RESTRIKE_LIMIT_MS}ms)`
          :`${distance}レーンを${Math.round(availableMs)}msで移動できない(最低${Math.round(needLimitMs)}ms)`};
      }
      // 快適: これを満たせないと「押せるが忙しい」
      const needComfortMs=distance===0?RESTRIKE_COMFORT_MS:distance/LANE_SPEED_COMFORT*1000;
      const strain=availableMs<needComfortMs
        ?(distance===0
          ?`同じレーンの叩き直しが${Math.round(availableMs)}ms(快適には${RESTRIKE_COMFORT_MS}ms欲しい)`
          :`${distance}レーンの移動が${Math.round(availableMs)}ms(快適には${Math.round(needComfortMs)}ms欲しい)`)
        :null;
      // 移動が短く、時間に余裕があるほど無理がない
      return {ok:true,cost:distance*1000+Math.max(0,200-availableMs),strain};
    };
    // 各ノーツ×各指の評価を先に取っておく(割り当てを試すあいだ指の状態は動かさない)
    const table=group.map(action=>fingers.map(f=>evaluate(f,action)));
    // 割り当ての全通り。null は「その音に使える指が無い」枠で、指が足りないときだけ意味を持つ。
    let best=null;
    const tryAssign=(k,used,current)=>{
      if(k===group.length){
        let feasible=0,cost=0;
        current.forEach((fi,idx)=>{if(fi!==null&&table[idx][fi].ok){feasible++;cost+=table[idx][fi].cost;}});
        const better=!best||feasible>best.feasible||(feasible===best.feasible&&cost<best.cost);
        if(better)best={feasible,cost,assign:current.slice()};
        return;
      }
      for(let fi=0;fi<fingers.length;fi++){
        if(used.has(fi))continue;
        used.add(fi);current.push(fi);tryAssign(k+1,used,current);current.pop();used.delete(fi);
      }
      current.push(null);tryAssign(k+1,used,current);current.pop();
    };
    tryAssign(0,new Set(),[]);
    group.forEach((action,idx)=>{
      const fi=best.assign[idx];
      const result=fi===null?null:table[idx][fi];
      if(!result||!result.ok){
        // 押せない理由: 使える指が1本も無いときは、各指が使えない理由を並べる
        const reasons=table[idx].map(r=>r.ok?null:r.reason).filter(Boolean);
        const detail=result?result.reason:(reasons.length?reasons[0]:'他のノーツに指を使っていて指が足りない');
        addIssue('impossible','押せる指がない',action,detail);
        return;
      }
      if(result.strain)addIssue('strained','手の動きが忙しい',action,result.strain);
      const f=fingers[fi];
      f.lane=action.endLane;
      f.lastHitMs=action.startMs;
      f.freeAtMs=(action.endMs>action.startMs?action.endMs:action.startMs)+(action.endFlick?END_FLICK_RELEASE_MS:0);
    });
    i=j+1;
  }
  return issues;
};
// --- 実行 ---
const DIFFICULTIES=only?[only]:source.difficulties||[(()=>{
  const chart=JSON.parse(fs.readFileSync(source.file(),'utf8'));
  return chart.difficulty||'FILE';
})()];
const report={
  schemaVersion:1,
  analysisType:'rhythm-chart-v2-step6-playability',
  trackId,
  source:fileArg?'file':sourceKind,
  sourceLabel:source.label,
  reviewRequired:true,
  runtimeConnected:false,
  handModel:{hands:HANDS,laneSpeedComfort:LANE_SPEED_COMFORT,laneSpeedLimit:LANE_SPEED_LIMIT,
    restrikeComfortMs:RESTRIKE_COMFORT_MS,restrikeLimitMs:RESTRIKE_LIMIT_MS,
    chordMinLaneGap:CHORD_MIN_LANE_GAP,releaseMarginMs:RELEASE_MARGIN_MS,endFlickReleaseMs:END_FLICK_RELEASE_MS},
  difficulties:{},
};

let anyImpossible=false;
console.log(`検査対象: ${source.label}  /  指${HANDS}本・移動の限界${LANE_SPEED_LIMIT}レーン毎秒・叩き直し最低${RESTRIKE_LIMIT_MS}ms\n`);
for(const difficulty of DIFFICULTIES){
  const sourceFile=source.file(difficulty);
  const file=path.isAbsolute(sourceFile)?sourceFile:path.join(ROOT,sourceFile);
  if(!fs.existsSync(file)){console.log(`${difficulty}: 入力が無いので飛ばす (${path.relative(ROOT,file)})`);continue;}
  const chart=JSON.parse(fs.readFileSync(file,'utf8'));
  const actions=toActions(chart.notes||[]);
  const issues=simulate(actions);
  const impossible=issues.filter(x=>x.severity==='impossible');
  const strained=issues.filter(x=>x.severity==='strained');
  if(impossible.length)anyImpossible=true;

  const byKind=new Map();
  for(const x of issues)byKind.set(`${x.severity}/${x.kind}`,(byKind.get(`${x.severity}/${x.kind}`)||0)+1);

  const total=chart.notes.length;
  console.log(`${difficulty}: ${total}ノーツ  押せない ${impossible.length}件 / 忙しい ${strained.length}件 (${(strained.length/total*100).toFixed(1)}%)`);
  for(const [kind,count] of [...byKind].sort((a,b)=>b[1]-a[1]))console.log(`    ${kind}: ${count}件`);
  const show=verbose?issues:impossible.slice(0,5);
  for(const x of show){
    console.log(`      ${x.severity==='impossible'?'×':'△'} ${(x.timeMs/1000).toFixed(1)}s 第${x.bar+1}小節 レーン${x.lane} ${x.type}: ${x.detail}`);
  }
  if(!verbose&&impossible.length>5)console.log(`      … ほか${impossible.length-5}件(--verbose で全件)`);

  report.difficulties[difficulty]={
    noteCount:total,
    impossibleCount:impossible.length,
    strainedCount:strained.length,
    strainedRatio:Number((strained.length/total).toFixed(4)),
    byKind:Object.fromEntries(byKind),
    // STEP7がそのまま使えるよう、直すべき場所を小節つきで残す
    issues:issues.map(x=>({severity:x.severity,kind:x.kind,noteIndex:x.noteIndex,grid:x.grid,
      bar:x.bar,timeMs:x.timeMs,lane:x.lane,type:x.type,detail:x.detail})),
  };
}

if(canWrite){
  const out=path.join(ROOT,`tools/mode/authoring/monster-hero-theme-v2-step6-playability-${sourceKind}.json`);
  fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
  console.log(`\n書き出し: ${path.relative(ROOT,out)}`);
}else if(fileArg){
  console.log('\n（--file 指定のときは書き出しません）');
}else{
  console.log('\n（--write を付けると tools/mode/authoring/ へ書き出します。ランタイムへは接続しません）');
}
process.exit(anyImpossible?1:0);
