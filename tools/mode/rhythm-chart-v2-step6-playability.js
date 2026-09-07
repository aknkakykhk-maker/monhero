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
// ファイル名は曲idから作る（曲が増えても、ここへ手で書き足さなくてよい）
const dashed=trackId.replace(/_/g,'-');
// --file <path>: 1つの譜面JSONだけを検査する(STEP5が候補ごとに呼ぶ)。書き出しはしない。
const fileArg=arg('--file',null);
const canWrite=write&&!fileArg;

// --- 手のモデルの定数 ---
// 値は tools/mode/rhythm-hand-model.js に一本化してある(STEP3の生成側と必ず同じ物差しを使うため)。
const {HAND_MODEL,fingerPairFeasible,fingerPairStrain,noteTouchLane}=require('./rhythm-hand-model.js');
const HANDS=HAND_MODEL.hands;
const LANE_SPEED_COMFORT=HAND_MODEL.laneSpeedComfort;
const LANE_SPEED_LIMIT=HAND_MODEL.laneSpeedLimit;
const RESTRIKE_COMFORT_MS=HAND_MODEL.restrikeComfortMs;
const RESTRIKE_LIMIT_MS=HAND_MODEL.restrikeLimitMs;
// 指の太さ。同時押しの最低レーン差でもあり、時間がずれた連続ノーツの「指2本で分担できる距離」でもある。
const CHORD_MIN_LANE_GAP=HAND_MODEL.fingerMinGapLanes;
const RELEASE_MARGIN_MS=HAND_MODEL.releaseMarginMs;
const END_FLICK_RELEASE_MS=HAND_MODEL.endFlickReleaseMs;

const SOURCES=Object.freeze({
  step5:{label:'V2 STEP5 採用案',file:d=>`tools/mode/authoring/${dashed}-v2-step5-chart-${d.toLowerCase()}.json`,
    difficulties:['EASY','NORMAL','HARD','EXPERT','MASTER']},
  step3:{label:'V2 STEP3/4 出力',file:d=>`tools/mode/authoring/${dashed}-v2-chart-${d.toLowerCase()}.json`,
    difficulties:['EASY','NORMAL','HARD','EXPERT','MASTER']},
  step7:{label:'V2 STEP7 自動修正後',file:d=>`tools/mode/authoring/${dashed}-v2-step7-chart-${d.toLowerCase()}.json`,
    difficulties:['EASY','NORMAL','HARD','EXPERT','MASTER']},
  v3:{label:'V3 生成',file:d=>`tools/mode/authoring/${dashed}-v3-chart-${d.toLowerCase()}.json`,
    difficulties:['EASY','NORMAL','HARD','EXPERT','MASTER']},
  v3fixed:{label:'V3 自動修正後',file:d=>`tools/mode/authoring/${dashed}-v3-fixed-${d.toLowerCase()}.json`,
    difficulties:['EASY','NORMAL','HARD','EXPERT','MASTER']},
  v1:{label:'既存の正式候補v1',file:d=>`monster-hero/debug/${dashed}-${d.toLowerCase()}-formal-candidate-v1.json`,
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
// 人が耳で合わせた値が無い曲（これから足す曲）は、V3の音源解析の結果を使う。
// ここで必ず rhythm-timing.js を要求すると、登録済みの曲しか検査できない。
const audioAnalysisTiming=()=>{
  const file=path.join(ROOT,`tools/mode/authoring/${dashed}-v3-audio.json`);
  if(!fs.existsSync(file))return null;
  try{
    const report=JSON.parse(fs.readFileSync(file,'utf8'));
    const t=report&&report.timing;
    if(!t||!Number.isFinite(t.beatMs))return null;
    return {bpm:t.bpm,beatMs:t.beatMs,beatZeroMs:t.beatZeroMs,subdivisionsPerBeat:t.subdivisionsPerBeat};
  }catch{return null;}
};
// --file でよその曲の譜面を直接渡されたときは、**その譜面が持っているテンポ**を使う。
// (2026-09-06) ここは元は trackId（既定 monster_hero_theme）だけを見ていたので、
// BPM128の曲の譜面をBPM173の物差しで測っていた。
// 1グリッドを117msではなく87msとして数えるため、実際には叩き直せる間隔なのに
// 「87msでは同じ指で叩き直せない」と誤って「押せない」を出していた
// （rhythm-audio-general-check.js が --file で渡すので、その曲だけ件数が跳ねていた）。
const fileTiming=()=>{
  if(!fileArg)return null;
  try{
    const chart=JSON.parse(fs.readFileSync(path.resolve(ROOT,fileArg),'utf8'));
    const bpm=Number(chart&&chart.bpm);
    const subdivisionsPerBeat=Number(chart&&chart.subdivisionsPerBeat);
    if(!(bpm>0)||!(subdivisionsPerBeat>0))return null;
    return {bpm,beatMs:60000/bpm,beatZeroMs:Number(chart.beatZeroMs)||0,subdivisionsPerBeat};
  }catch{return null;}
};
const timing=fileTiming()||timingContext.__t||audioAnalysisTiming();
if(!timing)throw new Error(`${trackId} の拍の基準が見つかりません（rhythm-timing.js の登録か、V3音源解析の結果が要ります）`);
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=g=>timing.beatZeroMs+g*gridMs;
const BAR=timing.subdivisionsPerBeat*4;

// --- ノーツを「指の仕事」へ均す・両手の指でシミュレートする ---
// 本体は rhythm-hand-simulate.js へ移した(2026-09-07)。
// あちらは「いま届く指のうち近いほう」だけでなく**数ノーツ先まで見て**指を割り当てる
// (ビームサーチ)。その場最適だと、
//   いまのノーツだけなら右手が楽 → でも右手を使うと数十ms後のノーツが取れない
// という配置を「押せない」と誤判定していた(合成テストで再現できた)。
// 手のモデルの値(rhythm-hand-model.js)も、押せる/忙しいの式も同じものを使う。
const handSimulate=require('./rhythm-hand-simulate.js');
const laneCenter=note=>noteTouchLane(note);
const toActions=notes=>handSimulate.toActions(notes,gridTimeMs,BAR);
const simulate=actions=>handSimulate.simulateActions(actions).issues;
// --- STEP7(自動修正ループ)から使い回せるように、手のモデルをそのまま公開する。
//     道具ごとにシミュレートを書き直すと、直したつもりで別の物差しになってしまう。 ---
module.exports={
  toActions,simulate,
  handModel:Object.freeze({hands:HANDS,laneSpeedComfort:LANE_SPEED_COMFORT,laneSpeedLimit:LANE_SPEED_LIMIT,
    restrikeComfortMs:RESTRIKE_COMFORT_MS,restrikeLimitMs:RESTRIKE_LIMIT_MS,
    chordMinLaneGap:CHORD_MIN_LANE_GAP,releaseMarginMs:RELEASE_MARGIN_MS,endFlickReleaseMs:END_FLICK_RELEASE_MS}),
  timing,gridTimeMs,BAR,
};
if(require.main!==module)return;

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
  const out=path.join(ROOT,`tools/mode/authoring/${dashed}-v2-step6-playability-${sourceKind}.json`);
  fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
  console.log(`\n書き出し: ${path.relative(ROOT,out)}`);
}else if(fileArg){
  console.log('\n（--file 指定のときは書き出しません）');
}else{
  console.log('\n（--write を付けると tools/mode/authoring/ へ書き出します。ランタイムへは接続しません）');
}
process.exit(anyImpossible?1:0);
