#!/usr/bin/env node
// 自動譜面制作システム V2 STEP5: 複数候補・自動批評。
//
//   node tools/mode/rhythm-chart-v2-step5-review.js                    # 全難易度の候補を採点して順位を出す
//   node tools/mode/rhythm-chart-v2-step5-review.js --difficulty HARD  # 1難易度だけ
//   node tools/mode/rhythm-chart-v2-step5-review.js --write            # 勝った案と講評をauthoring/へ書き出す
//   node tools/mode/rhythm-chart-v2-step5-review.js --verbose          # 全案の内訳を表示
//
// 【何をするか】
// STEP3/4の生成器は「1つの難易度から1つの譜面」しか作らない。だが実際の譜面作りは
// 「何案か作って、良いものを選ぶ」作業なので、そこを機械化する。
//
//   1. 同じ音源・同じ構造解析から、作り方の数値だけを変えた候補を複数作る
//      (生成器の --profile-override を使う。生成ロジックそのものは触らない)
//   2. 出来た譜面を機械的に採点する
//   3. 順位を付け、いちばん良い案を選ぶ
//
// 【採点で見ているもの】どれも譜面のJSONだけから測れる値で、人の好みは入れていない。
//
//   音との一致   … 採用した音からのズレ(sourcePeakOffsetMs)が小さいほど良い
//   構造への追随 … 盛り上がる区間ほどノーツが増えているか(小節ごとの密度と楽曲の
//                  盛り上がり度の相関)。曲に合っていない譜面はここが落ちる
//   狙いの密度   … 難易度ごとに決めた「毎秒このくらい」から離れていないか
//   単調さ       … 同じレーンの連続・同じ間隔の連続・4つ組パターンの使い回し。少ないほど良い
//   手の動き     … 短い時間での大きなレーン移動が多すぎないか
//   種類の配分   … その難易度で使ってよい種別が、極端に偏らず使えているか
//   休符         … 休みが1つも無い/長すぎる、を避けられているか
//
// 出力は設計資料であり、ランタイム・既存譜面・保存・ランキングへは一切接続しない。
// V1(tools/mode/rhythm-monster-hero-chart-build.js)と既存の正式候補v1は変更しない。
const fs=require('fs');
const os=require('os');
const path=require('path');
const vm=require('vm');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const GENERATOR=path.join(ROOT,'tools/mode/rhythm-chart-v2-step3-generate.js');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const write=process.argv.includes('--write');
const verbose=process.argv.includes('--verbose');
const only=arg('--difficulty');
const trackId=arg('--track','monster_hero_theme');

const TRACKS=Object.freeze({
  monster_hero_theme:Object.freeze({
    featuresInput:'tools/mode/authoring/monster-hero-theme-v2-features.json',
    structureInput:'tools/mode/authoring/monster-hero-theme-v2-structure.json',
    outputPrefix:'tools/mode/authoring/monster-hero-theme-v2-step5-',
  }),
});
const config=TRACKS[trackId];
if(!config){console.error(`STEP5未登録トラックです: ${trackId} (${Object.keys(TRACKS).join(', ')})`);process.exit(1);}

// --- 候補の作り分け。既定(variant名 base)を必ず含め、そこから1軸ずつ動かす ---
// 作り方の数値だけを変えるので、どの案も「同じ音源・同じ構造解析」から作られる。
// 乱数は使わない。したがって何度実行しても同じ順位になる。
const VARIANTS=Object.freeze([
  {id:'base',   label:'既定',                    patch:{}},
  {id:'tight',  label:'音を細かく拾う',           patch:{latticeGrids:1,minStrength:-.05}},
  {id:'loose',  label:'音を粗く拾う',             patch:{latticeGrids:2,minStrength:.05}},
  {id:'dense',  label:'密度を上げる',             patch:{perBarDelta:1}},
  {id:'sparse', label:'密度を下げる',             patch:{perBarDelta:-1}},
  {id:'calm',   label:'手の移動を抑える',         patch:{maxLaneStepDelta:-1}},
  {id:'wide',   label:'手の移動を広げる',         patch:{maxLaneStepDelta:1}},
  {id:'variety',label:'HOLD/FLICK/SLIDEを増やす', patch:{holdDelta:4,flickDelta:4,slideDelta:3}},
]);

// 難易度ごとの狙い(毎秒ノーツ数)。既存の正式候補v1と生成済みV2の実測から置いた目安で、
// ここから離れるほど「狙いの密度」の点が下がる。判定・スコアには一切関与しない。
const DENSITY_TARGET=Object.freeze({
  EASY:{min:.7,max:1.1},NORMAL:{min:1.0,max:1.5},HARD:{min:1.4,max:2.0},
  EXPERT:{min:1.8,max:2.6},MASTER:{min:2.3,max:3.4},
});
const ALLOWED_TYPES=Object.freeze({
  EASY:['TAP','HOLD'],NORMAL:['TAP','HOLD','FLICK'],
  HARD:['TAP','HOLD','FLICK','SLIDE'],EXPERT:['TAP','HOLD','FLICK','SLIDE'],MASTER:['TAP','HOLD','FLICK','SLIDE'],
});
// 採点の重み。合計1.0。カクつき対策と同じで「何を良いとするか」を数字で固定しておく。
const WEIGHTS=Object.freeze({
  onsetFit:.24,      // 音との一致
  structureFit:.22,  // 構造への追随
  densityTarget:.18, // 狙いの密度
  monotony:.16,      // 単調でないこと
  handMotion:.10,    // 手の動きの妥当性
  typeBalance:.06,   // 種類の配分
  breathing:.04,     // 休符
});

// --- 入力（BPM・グリッド・楽曲の盛り上がり・セクション） ---
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(trackId)}];`,timingContext);
const timing=timingContext.__t;
if(!timing)throw new Error(`${trackId} timing data is missing`);
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=g=>timing.beatZeroMs+g*gridMs;
const BAR=timing.subdivisionsPerBeat*4;

const features=JSON.parse(fs.readFileSync(path.join(ROOT,config.featuresInput),'utf8'));
if(features.analysisType!=='rhythm-chart-v2-step1-features')throw new Error('STEP1 V2 JSONではありません');
const structure=JSON.parse(fs.readFileSync(path.join(ROOT,config.structureInput),'utf8'));
if(structure.analysisType!=='rhythm-chart-v2-step2-structure')throw new Error('STEP2 V2 JSONではありません');

// 「静かな区間」と「盛り上がる区間」。STEP2のセクション種別で分ける。
// STEP3の生成ルールもこの分類で密度を上げ下げしているので、同じ物差しで測る。
const CALM_SECTIONS=new Set(['INTRO','BREAK','OUTRO']);
const HOT_SECTIONS=new Set(['CHORUS','FINAL_CHORUS','BUILD','PRE_CHORUS']);
const sectionAt=timeMs=>(structure.sections||[]).find(s=>timeMs>=s.startMs&&timeMs<s.endMs)||null;

// --- 採点 ---
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const clamp01=v=>Math.max(0,Math.min(1,v));

const scoreChart=(chart,difficulty)=>{
  const notes=chart.notes||[];
  const detail={};
  if(!notes.length)return {total:0,detail:{empty:0}};

  // 音との一致: ズレの平均。生成器の上限が±30msなので、そこを0点として正規化する
  const offsets=notes.map(n=>Number(n.sourcePeakOffsetMs)).filter(Number.isFinite).map(Math.abs);
  detail.onsetFit=offsets.length?clamp01(1-mean(offsets)/30):0;

  // 構造への追随: 静かな区間と盛り上がる区間で、小節あたりのノーツ数がどれだけ違うか。
  // 小節ごとの相関は整数カウントのばらつきに埋もれて実態を映さなかったため、
  // STEP3の生成ルール(セクション種別で段を上下させる)と同じ物差しで測る。
  const barCounts=new Map();
  for(const n of notes){const bar=Math.floor(n.grid/BAR);barCounts.set(bar,(barCounts.get(bar)||0)+1);}
  const calmBars=[],hotBars=[];
  for(const [bar,count] of barCounts){
    const type=sectionAt(gridTimeMs(bar*BAR+BAR/2))?.sectionTypeCandidate;
    if(CALM_SECTIONS.has(type))calmBars.push(count);
    else if(HOT_SECTIONS.has(type))hotBars.push(count);
  }
  // 盛り上がりが静かの2倍あれば満点。同じなら0点。逆転していても0点。
  const calmMean=mean(calmBars),hotMean=mean(hotBars);
  detail.structureFit=(calmBars.length>=2&&hotBars.length>=2&&hotMean>0)
    ?clamp01((hotMean-calmMean)/hotMean/.5)
    :0;

  // 狙いの密度: 帯の中なら満点、外れるほど下がる
  const target=DENSITY_TARGET[difficulty];
  const density=Number(chart.densityPerSecond)||0;
  detail.densityTarget=target
    ?(density>=target.min&&density<=target.max?1:clamp01(1-Math.abs(density<target.min?target.min-density:density-target.max)/target.min))
    :0;

  // 単調さ(少ないほど良い): 同じレーンの連続 / 同じ間隔の連続 / 4つ組パターンの使い回し
  let sameLane=0,sameGap=0;
  for(let i=1;i<notes.length;i++){
    if(notes[i].lane===notes[i-1].lane)sameLane++;
    if(i>=2&&(notes[i].grid-notes[i-1].grid)===(notes[i-1].grid-notes[i-2].grid))sameGap++;
  }
  const quads=new Map();
  for(let i=3;i<notes.length;i++){
    const key=notes.slice(i-3,i+1).map(n=>n.lane).join('-');
    quads.set(key,(quads.get(key)||0)+1);
  }
  const repeatedQuads=[...quads.values()].filter(v=>v>1).reduce((a,b)=>a+b,0);
  const monotonyRaw=(sameLane/notes.length)*.4+(sameGap/Math.max(1,notes.length-2))*.35
    +(repeatedQuads/Math.max(1,notes.length-3))*.25;
  detail.monotony=clamp01(1-monotonyRaw);

  // 手の動き: 短い間隔(8分未満)で3レーン以上跳ぶ組み合わせが多すぎないか
  let hardJumps=0,pairs=0;
  for(let i=1;i<notes.length;i++){
    const dg=notes[i].grid-notes[i-1].grid;
    if(dg<=0||dg>=timing.subdivisionsPerBeat)continue;
    pairs++;
    if(Math.abs(notes[i].lane-notes[i-1].lane)>=3)hardJumps++;
  }
  detail.handMotion=pairs?clamp01(1-(hardJumps/pairs)/.25):1; // 25%を超えたら0点

  // 種類の配分: 許可された種別が使われているか(TAPだけの譜面を避ける)
  const allowed=ALLOWED_TYPES[difficulty]||['TAP'];
  const used=allowed.filter(t=>(chart.typeCounts||{})[t]>0).length;
  const tapShare=((chart.typeCounts||{}).TAP||0)/notes.length;
  detail.typeBalance=clamp01((used/allowed.length)*.6+clamp01((1-tapShare)/.35)*.4);

  // 休符: いちばん長い空白が長すぎない(退屈)・空白がまったく無い(息切れ)を避ける
  let maxGapGrids=0;
  for(let i=1;i<notes.length;i++)maxGapGrids=Math.max(maxGapGrids,notes[i].grid-notes[i-1].grid);
  const restBars=maxGapGrids/BAR;
  // 0.5〜4小節の空白があるのが自然。0に近い/8小節以上は減点
  detail.breathing=clamp01(restBars<=0?0:restBars<.5?restBars/.5:restBars<=4?1:clamp01(1-(restBars-4)/4));

  const total=Object.entries(WEIGHTS).reduce((sum,[key,w])=>sum+(detail[key]??0)*w,0);
  return {total,detail};
};

// --- 候補を作る ---
// perBarDelta等の「相対指定」は、生成器が受け取れる絶対値へここで直す。
// 生成器側の既定値を知る必要があるので、まず既定で1回作ってから読む。
const PROFILE_DEFAULTS=Object.freeze({
  EASY:{perBarByIntensity:[2,3,4],maxLaneStep:1,holdMaxCount:10,flickMaxCount:0,slideMaxCount:0,latticeGrids:2,minStrength:0},
  NORMAL:{perBarByIntensity:[3,4,6],maxLaneStep:2,holdMaxCount:14,flickMaxCount:12,slideMaxCount:0,latticeGrids:2,minStrength:.45},
  HARD:{perBarByIntensity:[5,7,9],maxLaneStep:3,holdMaxCount:14,flickMaxCount:16,slideMaxCount:8,latticeGrids:1,minStrength:.30},
  EXPERT:{perBarByIntensity:[7,10,13],maxLaneStep:4,holdMaxCount:15,flickMaxCount:18,slideMaxCount:9,latticeGrids:1,minStrength:.20},
  MASTER:{perBarByIntensity:[10,14,18],maxLaneStep:4,holdMaxCount:18,flickMaxCount:22,slideMaxCount:11,latticeGrids:1,minStrength:0},
});
const resolvePatch=(difficulty,patch)=>{
  const base=PROFILE_DEFAULTS[difficulty];
  const out={};
  for(const [key,value] of Object.entries(patch)){
    if(key==='perBarDelta')out.perBarByIntensity=base.perBarByIntensity.map(v=>Math.max(1,v+value));
    else if(key==='maxLaneStepDelta')out.maxLaneStep=Math.max(1,Math.min(4,base.maxLaneStep+value));
    else if(key==='holdDelta')out.holdMaxCount=Math.max(0,base.holdMaxCount+value);
    else if(key==='flickDelta'){if(base.flickMaxCount>0)out.flickMaxCount=Math.max(0,base.flickMaxCount+value);}
    else if(key==='slideDelta'){if(base.slideMaxCount>0)out.slideMaxCount=Math.max(0,base.slideMaxCount+value);}
    else if(key==='minStrength')out.minStrength=Math.max(0,Number((base.minStrength+value).toFixed(3)));
    else out[key]=value;
  }
  return out;
};

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-v2-step5-'));
const generate=(difficulty,patch)=>{
  const args=[GENERATOR,'--track',trackId,'--difficulty',difficulty,'--write','--output-dir',tempDir];
  const resolved=resolvePatch(difficulty,patch);
  if(Object.keys(resolved).length)args.push('--profile-override',JSON.stringify({[difficulty]:resolved}));
  const run=spawnSync(process.execPath,args,{cwd:ROOT,encoding:'utf8'});
  if(run.status!==0)throw new Error(`生成に失敗 (${difficulty}): ${(run.stderr||run.stdout||'').trim()}`);
  const file=path.join(tempDir,`${trackId.replace(/_/g,'-')}-v2-chart-${difficulty.toLowerCase()}.json`);
  const chart=JSON.parse(fs.readFileSync(file,'utf8'));
  fs.unlinkSync(file);
  return {chart,resolved};
};

const DIFFICULTIES=only?[only]:['EASY','NORMAL','HARD','EXPERT','MASTER'];
const report={
  schemaVersion:1,
  analysisType:'rhythm-chart-v2-step5-review',
  trackId,
  generatedFrom:{features:config.featuresInput,structure:config.structureInput,generator:'tools/mode/rhythm-chart-v2-step3-generate.js'},
  reviewRequired:true,
  runtimeConnected:false,
  weights:WEIGHTS,
  densityTarget:DENSITY_TARGET,
  difficulties:{},
};

for(const difficulty of DIFFICULTIES){
  if(!PROFILE_DEFAULTS[difficulty]){console.error(`未知の難易度: ${difficulty}`);process.exit(1);}
  // 候補を作る。作り方を変えても出来上がりが既定と1バイトも変わらない案がありうる
  // (その難易度ではその数値が効いていない)。そういう案を「別案」として数に入れると
  // 「8案から選んだ」と誤解する報告になるので、同じ譜面はまとめて印を付ける。
  const scored=[],seen=new Map();
  for(const variant of VARIANTS){
    const {chart,resolved}=generate(difficulty,variant.patch);
    const fingerprint=JSON.stringify(chart.notes);
    const sameAs=seen.get(fingerprint);
    if(sameAs!==undefined){
      scored.push({variant,chart,resolved,...scoreChart(chart,difficulty),duplicateOf:sameAs});
      continue;
    }
    seen.set(fingerprint,variant.id);
    scored.push({variant,chart,resolved,...scoreChart(chart,difficulty),duplicateOf:null});
  }
  const distinct=scored.filter(s=>!s.duplicateOf);
  scored.sort((a,b)=>b.total-a.total||a.variant.id.localeCompare(b.variant.id));
  // 同じ譜面が並んだときは、素性のはっきりした既定(base)を代表にする
  const winner=scored.find(s=>!s.duplicateOf)&&scored[0].duplicateOf
    ?scored.find(s=>!s.duplicateOf&&Math.abs(s.total-scored[0].total)<1e-9)||scored[0]
    :scored[0];
  const baseEntry=scored.find(s=>s.variant.id==='base');

  console.log(`\n=== ${difficulty} ===  実際に違う譜面になった案: ${distinct.length}/${VARIANTS.length}`);
  for(const [rank,s] of scored.entries()){
    const mark=s.variant.id===winner.variant.id?'★':'  ';
    const dup=s.duplicateOf?`  ← ${s.duplicateOf}と同じ譜面(この難易度では効いていない)`:'';
    console.log(`${mark} ${String(rank+1).padStart(2)}位 ${s.total.toFixed(3)}  ${s.variant.id.padEnd(8)} ${s.variant.label.padEnd(22)} ${String(s.chart.noteCount).padStart(4)}ノーツ / ${String(s.chart.densityPerSecond).padStart(5)}毎秒${dup}`);
    if(verbose){
      console.log(`      ${Object.entries(s.detail).map(([k,v])=>`${k} ${v.toFixed(2)}`).join(' / ')}`);
    }
  }
  console.log(`  → 採用: ${winner.variant.id} (${winner.variant.label}) ${winner.total.toFixed(3)}点`
    +(baseEntry&&winner.variant.id!=='base'?`  ※既定より ${((winner.total-baseEntry.total)*1000/1000).toFixed(3)}点よい`:'  ※既定が最良'));
  console.log(`     内訳: ${Object.entries(winner.detail).map(([k,v])=>`${k} ${v.toFixed(2)}`).join(' / ')}`);

  report.difficulties[difficulty]={
    winner:winner.variant.id,
    winnerLabel:winner.variant.label,
    winnerOverride:winner.resolved,
    distinctCandidates:distinct.length,
    totalVariants:VARIANTS.length,
    candidates:scored.map(s=>({
      variant:s.variant.id,label:s.variant.label,override:s.resolved,duplicateOf:s.duplicateOf,
      score:Number(s.total.toFixed(4)),detail:Object.fromEntries(Object.entries(s.detail).map(([k,v])=>[k,Number(v.toFixed(4))])),
      noteCount:s.chart.noteCount,densityPerSecond:s.chart.densityPerSecond,typeCounts:s.chart.typeCounts,
    })),
  };

  if(write){
    const out=path.join(ROOT,`${config.outputPrefix}chart-${difficulty.toLowerCase()}.json`);
    const chosen={...winner.chart,
      analysisType:'rhythm-chart-v2-step5-chart',
      step5:{variant:winner.variant.id,label:winner.variant.label,override:winner.resolved,
        score:Number(winner.total.toFixed(4)),
        detail:Object.fromEntries(Object.entries(winner.detail).map(([k,v])=>[k,Number(v.toFixed(4))]))},
    };
    fs.writeFileSync(out,JSON.stringify(chosen,null,1)+'\n');
    console.log(`     書き出し: ${path.relative(ROOT,out)}`);
  }
}

fs.rmSync(tempDir,{recursive:true,force:true});

if(write){
  const out=path.join(ROOT,`${config.outputPrefix}review.json`);
  fs.writeFileSync(out,JSON.stringify(report,null,1)+'\n');
  console.log(`\n講評: ${path.relative(ROOT,out)}`);
}else{
  console.log('\n（--write を付けると採用案と講評を tools/mode/authoring/ へ書き出します。ランタイムへは接続しません）');
}
