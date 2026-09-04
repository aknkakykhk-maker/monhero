#!/usr/bin/env node
// 自動譜面制作システム V2 STEP3: 生成ルールへの構造反映。
//
//   node tools/mode/rhythm-chart-v2-step3-generate.js                    # 内訳を表示するだけ
//   node tools/mode/rhythm-chart-v2-step3-generate.js --write            # 3難易度をauthoring/へ書き出す
//   node tools/mode/rhythm-chart-v2-step3-generate.js --difficulty HARD  # 1つだけ
//
// 入力:  tools/mode/authoring/<track>-v2-features.json  （STEP1: 楽曲特徴・盛り上がり解析）
//        tools/mode/authoring/<track>-v2-structure.json （STEP2: セクション/フレーズ解析）
//        tools/mode/authoring/monster-hero-theme-onset-candidates(-dense).json（既存の実音源解析。V1と共用）
//        monster-hero/data/rhythm-timing.js（BPM・beatZero・16分グリッド。V1と共用）
// 出力:  tools/mode/authoring/<track>-v2-chart-<難易度>.json
//
// V1（tools/mode/rhythm-monster-hero-chart-build.js）は一切変更しない。
// V1は「小節ごとの採用オンセット強さ合計」の三分位だけで密度を決めていたが、
// V2 STEP3ではSTEP1のintensity（楽曲全体を通した盛り上がり推移）とSTEP2の
// section種別・フレーズ反復（motif）を使って密度・派手さを決める。
// 当初は採用基準・幅・レーン移動・HOLD/FLICK/SLIDE・複合操作をV1と同じロジックで踏襲していたが、
// 仕上がりの点検(2026-09-04)で次の欠点が見つかり、V2側だけ直した(V1は変更しない)。
//   ・採用ループが「最後に取った音」とだけ間隔を比べ、拍頭を先に取ると同じ小節の裏拍が
//     負の差で全部捨てられていた → 上限も供給も効かず、どの難易度も2〜3音/小節に張り付いていた
//   ・レーン歩きが歩幅の倍数しか踏めず、レーン1に1音も来ない／EXPERT以上は0↔4の往復ばかり
//   ・サビの終盤ほど候補源が薄く、ふつうのサビより薄い譜面になっていた
//   ・SLIDEが全部同じ形、HOLDが4か8だけ
//   ・HOLD中の重ねTAPを同時押しへ割っていて、3本目の指が要る配置ができていた
//
// 出力はreviewRequired=true / runtimeConnected=falseの設計資料であり、
// game-system.jsxやmonster-hero/data/rhythm-mode.jsのランタイムには一切接続しない。
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const TRACKS=Object.freeze({
  monster_hero_theme:Object.freeze({
    featuresInput:'tools/mode/authoring/monster-hero-theme-v2-features.json',
    structureInput:'tools/mode/authoring/monster-hero-theme-v2-structure.json',
    candidateFiles:Object.freeze({
      normal:'tools/mode/authoring/monster-hero-theme-onset-candidates.json',
      dense:'tools/mode/authoring/monster-hero-theme-onset-candidates-dense.json',
    }),
    outputPrefix:'tools/mode/authoring/monster-hero-theme-v2-chart-',
  }),
});
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const write=process.argv.includes('--write');
const only=arg('--difficulty');
const trackId=arg('--track','monster_hero_theme');
const outputDir=arg('--output-dir',null);
const printProfiles=process.argv.includes('--print-profiles');
const config=TRACKS[trackId];
if(!config){console.error(`STEP3未登録トラックです: ${trackId} (${Object.keys(TRACKS).join(', ')})`);process.exit(1);}
// STEP5(複数候補・自動批評)が「同じ音源から作り方だけ変えた別案」を作るための上書き口。
// 既定は上書きなし＝これまでと1バイトも変わらない出力になる(STEP3の決定性チェックが守られる)。
//   --profile-override '{"HARD":{"latticeGrids":2}}'
// 生成そのもののロジックは変えず、難易度ごとの制作方針の数値だけを差し替える。
const profileOverride=(()=>{
  const raw=arg('--profile-override',null);
  if(!raw)return null;
  let parsed;
  try{parsed=JSON.parse(raw);}catch(e){console.error(`--profile-override がJSONとして読めません: ${e.message}`);process.exit(1);}
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)){console.error('--profile-override は難易度をキーにしたオブジェクトで指定してください');process.exit(1);}
  return parsed;
})();
// 上書きしてよいのは「作り方の数値」だけ。出力の意味づけ(level等)や未知のキーは受け付けない。
const OVERRIDABLE_KEYS=Object.freeze(new Set(['candidateSource','minStrength','latticeGrids','perBarByIntensity',
  'maxConsecutiveEighths','maxLaneStep','widths','simultaneous','types',
  'holdMaxCount','holdMinGapGrids','flickMaxCount','slideMaxCount','chordMaxCount','endFlickMaxCount',
  'narrowRate','supplementFromTier']));
const overrideLabel=(()=>{
  if(!profileOverride)return null;
  for(const [difficulty,patch] of Object.entries(profileOverride)){
    if(!patch||typeof patch!=='object'||Array.isArray(patch)){console.error(`--profile-override の ${difficulty} はオブジェクトで指定してください`);process.exit(1);}
    for(const key of Object.keys(patch)){
      if(!OVERRIDABLE_KEYS.has(key)){console.error(`--profile-override で上書きできないキーです: ${difficulty}.${key} (${[...OVERRIDABLE_KEYS].join(', ')})`);process.exit(1);}
    }
  }
  return Object.entries(profileOverride).map(([d,patch])=>`${d}{${Object.entries(patch).map(([k,v])=>`${k}=${JSON.stringify(v)}`).join(',')}}`).join(' ');
})();

// --- 全難易度で共通の下地。V1と同じ値を使う（採用基準を変えると比較ができなくなるため） ---
const COMMON=Object.freeze({
  maxAbsPeakOffsetMs:30,
  earReviewMaxOffsetMs:42,
  minTimeMs:1800,
  endPaddingMs:1200,
  monsterSlots:4,
  monsterTargets:[.2,.4,.6,.8],
  monsterClearGrids:4,
  // 盛り上がる小節で候補が上限に届かないとき、1段細かい候補源から補う音の下限。
  // 「はっきりした音」だけを足し、弱い音で埋めない。
  // 以前は絶対値 0.4 で書いていたが、候補源ごとに強さの尺度が違う
  // (normal は最小0.60 / dense は最小0.30 / step1 は最小0.197)ため、同じ0.4でも
  // dense では下位1割を落とすだけ、step1 では下位7割を落とす、という別物になっていた。
  // その結果、サビの終盤(FINAL_CHORUS)のように dense が薄い区間で step1 から補おうとしても
  // ほぼ全部が弾かれ、ふつうのサビより薄い譜面のままだった。
  // そこで「その候補源の中で弱いほうから何割を使わないか」という順位で書く。
  // .1 は、較正済みだった dense の 0.4 と同じ位置(下位9.8%)にあたる。
  supplementMinStrengthQuantile:.1,
  // 8分未満の間隔では、歩幅いっぱいに跳ばない(最大2レーン)。STEP6の手のモデルと同じ考え方。
  laneStepFastMax:2,
});
// 盛り上がりの順位を、セクション種別で±この量だけずらす(段調整の±1段に相当)。
const SECTION_POSITION_ADJUST=.2;
// 静かな区間。ここへは候補源からの補充を足さない(静けさを潰さないため)
const CALM_SECTION_TYPES=new Set(['INTRO','BREAK','OUTRO']);
// 候補源の細かさの順。盛り上がる小節で足りないときは、この順で1段細かい源から補う。
const SOURCE_ORDER=Object.freeze(['normal','dense','step1']);

// --- 難易度ごとの制作方針 ---
// perBarByIntensity は「盛り上がりの順位 0 / 0.5 / 1 のときの小節あたり上限」(折れ線。端数可)。
// 採用ループの誤り(最後に取った音とだけ間隔を比べていた)を直すまで、この上限は一度も効いて
// おらず較正されていなかった。いまの値は、人が耳で確認した既存の正式候補v1の密度
// (EASY 1.22 / NORMAL 1.45 / HARD 1.80 ノーツ毎秒)へ合うように実測で置き、
// EXPERT / MASTER はそこから約1.2倍ずつ(2.2 / 2.7 毎秒)にしている。
// widths / types / holdMaxCount などの数はV1と同じ。
// widths / narrowRate は「ノーツは大きいほど簡単・細いほど難しい」に沿って決める。
// 幅1(半ノーツ)は難しい側なので低い難易度では使わず、高い難易度ほど割合(narrowRate)を増やす。
// supplementFromTier は「この段以上の小節では、候補が上限に届かないとき1段細かい候補源から補う」。
// どちらも実機で全難易度を遊んでもらった指摘への対応(2026-09-04):
//   ・ノーツが少なくて退屈  → perBarByIntensity を上げ、補充を段1(EXPERT以上は段0)まで広げた
//   ・半ノーツは難しい側なので高難易度用にして → narrowRate を難易度順にし、EASY/NORMALでは0にした
const PROFILES=Object.freeze({
  EASY:Object.freeze({
    level:1,candidateSource:'normal',minStrength:0,latticeGrids:2,
    perBarByIntensity:[1.2,2.9,4.2],maxConsecutiveEighths:2,maxLaneStep:1,
    widths:[3,4,6],narrowRate:0,simultaneous:false,types:['TAP','HOLD'],supplementFromTier:1,
    holdMaxCount:12,holdMinGapGrids:12,flickMaxCount:0,slideMaxCount:0,chordMaxCount:0,endFlickMaxCount:0,accentWidth:10,accentMaxCount:6,holdTaperMaxCount:4,
  }),
  NORMAL:Object.freeze({
    level:3,candidateSource:'dense',minStrength:.40,latticeGrids:2,
    perBarByIntensity:[1.4,3.4,5.2],maxConsecutiveEighths:4,maxLaneStep:2,
    widths:[2,3,4,6],narrowRate:0,simultaneous:false,types:['TAP','HOLD','FLICK'],supplementFromTier:1,
    holdMaxCount:16,holdMinGapGrids:10,flickMaxCount:14,slideMaxCount:0,chordMaxCount:0,endFlickMaxCount:3,accentWidth:10,accentMaxCount:6,holdTaperMaxCount:5,
  }),
  HARD:Object.freeze({
    level:5,candidateSource:'dense',minStrength:.24,latticeGrids:1,
    perBarByIntensity:[1.8,4.3,6.4],maxConsecutiveEighths:6,maxLaneStep:3,
    widths:[1,2,3,4,5],narrowRate:.10,simultaneous:true,types:['TAP','HOLD','FLICK','SLIDE'],supplementFromTier:1,
    holdMaxCount:18,holdMinGapGrids:10,flickMaxCount:18,slideMaxCount:10,chordMaxCount:0,endFlickMaxCount:5,accentWidth:8,accentMaxCount:7,holdTaperMaxCount:6,
  }),
  // EXPERT/MASTERは既存dense候補(しきい値0.30)では供給が頭打ちのため、STEP1の
  // events.onsets(強さ0.197まで持つ)を候補源にする。同時押しは新しい時刻を作らず、
  // 低域と高域が同時に立ち上がった既存ノーツだけを2レーンへ分ける(chordMaxCount)。
  // minStrengthはdense(V1/HARD)とstep1(EXPERT/MASTER)で別アルゴリズムの強さ尺度であり、
  // 同じ数値でも選ばれやすさが違うため、単純な数値の対応では揃わない。
  // ノーツ数・密度がEASY<NORMAL<HARD<EXPERT<MASTERの順で必ず増えることを
  // rhythm-chart-v2-step3-check.jsで実測確認しながら較正した値を使う。
  // MASTERのminStrength=0は「事実上のしきい値(0.197)より下を指定し、候補を絞らない」の意図。
  EXPERT:Object.freeze({
    level:7,candidateSource:'step1',minStrength:.14,latticeGrids:1,
    perBarByIntensity:[2.2,5.4,8],maxConsecutiveEighths:8,maxLaneStep:4,
    widths:[1,2,3,4,5],narrowRate:.22,simultaneous:true,types:['TAP','HOLD','FLICK','SLIDE'],supplementFromTier:0,
    holdMaxCount:20,holdMinGapGrids:8,flickMaxCount:22,slideMaxCount:11,chordMaxCount:12,endFlickMaxCount:7,accentWidth:8,accentMaxCount:7,holdTaperMaxCount:7,
  }),
  MASTER:Object.freeze({
    level:9,candidateSource:'step1',minStrength:0,latticeGrids:1,
    perBarByIntensity:[2.8,6.6,9.6],maxConsecutiveEighths:12,maxLaneStep:4,
    widths:[1,2,3,4],narrowRate:.32,simultaneous:true,types:['TAP','HOLD','FLICK','SLIDE'],supplementFromTier:0,
    holdMaxCount:22,holdMinGapGrids:6,flickMaxCount:26,slideMaxCount:13,chordMaxCount:18,endFlickMaxCount:9,accentWidth:6,accentMaxCount:8,holdTaperMaxCount:8,
  }),
});

// SLIDEの形。順番に使い回し、端からはみ出す・他の長いノーツとぶつかる形は次の形へ譲る。
// steps は始点からの相対レーン(0.5刻み)、widths は各点の幅。
const SLIDE_SHAPES=Object.freeze([
  Object.freeze({id:'straight',grids:12,steps:[0,.5,1],widths:[2,3,2]}),     // まっすぐ1レーン
  Object.freeze({id:'long',grids:16,steps:[0,.5,1,1.5],widths:[2,2,3,2]}),  // 長めに1.5レーン
  Object.freeze({id:'turn',grids:12,steps:[0,1,.5],widths:[2,3,2]}),        // 折り返し
  Object.freeze({id:'short',grids:8,steps:[0,.5],widths:[2,2]}),            // 短く半レーン
  Object.freeze({id:'wide',grids:12,steps:[0,.5,1],widths:[4,4,3]}),        // 太くて掴みやすい
  Object.freeze({id:'taper',grids:16,steps:[0,.5,1,1],widths:[3,3,2,2]}),   // 太いところから細くなる
  Object.freeze({id:'open',grids:12,steps:[0,.5,.5],widths:[2,4,6]}),       // だんだん開く
  Object.freeze({id:'close',grids:12,steps:[0,.5,1],widths:[6,4,2]}),       // だんだん閉じる
  Object.freeze({id:'swell',grids:16,steps:[0,.5,1,1.5],widths:[2,4,4,2]}), // 途中でふくらむ
]);
if(printProfiles){console.log(JSON.stringify(PROFILES));process.exit(0);}

// セクション種別ごとの段調整。INTRO/BREAK/OUTROは1段下げて静けさを出し、
// BUILD系・CHORUS系は1段上げて盛り上げる。VERSE/BRIDGEは調整しない。
const SECTION_TIER_ADJUST=Object.freeze({
  INTRO:-1,OUTRO:-1,BREAK:-1,
  VERSE:0,BRIDGE:0,
  BUILD:1,PRE_CHORUS:1,CHORUS:1,FINAL_CHORUS:1,
});
const sectionTierAdjust=sectionType=>SECTION_TIER_ADJUST[sectionType]??0;

// --- 入力読み込み ---
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(trackId)}];`,timingContext);
const timing=timingContext.__t;
if(!timing)throw new Error(`${trackId} timing data is missing`);
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=g=>timing.beatZeroMs+g*gridMs;
const BEAT=timing.subdivisionsPerBeat;
const BAR=BEAT*4;

const features=JSON.parse(fs.readFileSync(path.join(ROOT,config.featuresInput),'utf8'));
if(features.analysisType!=='rhythm-chart-v2-step1-features')throw new Error('STEP1 V2 JSONではありません');
if(features.trackId!==trackId)throw new Error(`features trackId不一致: ${features.trackId} != ${trackId}`);

const structure=JSON.parse(fs.readFileSync(path.join(ROOT,config.structureInput),'utf8'));
if(structure.analysisType!=='rhythm-chart-v2-step2-structure')throw new Error('STEP2 V2 JSONではありません');
if(structure.trackId!==trackId)throw new Error(`structure trackId不一致: ${structure.trackId} != ${trackId}`);

const loadCandidates=key=>{
  const source=JSON.parse(fs.readFileSync(path.join(ROOT,config.candidateFiles[key]),'utf8'));
  if(source.trackId!==trackId)throw new Error('候補ファイルのtrackIdが一致しません');
  const map=new Map();
  for(const [grid,strength,offsetMs] of source.candidates){
    const prev=map.get(grid);
    if(!prev||strength>prev.strength)map.set(grid,{grid,strength,offsetMs});
  }
  return map;
};
// EXPERT/MASTER用: 既存のdenseファイル(しきい値0.30)より広いオンセット候補が要るが、
// 新しい音源解析(ffmpeg等)を追加せず、STEP1で既に抽出済みのevents.onsets(931件、
// 強さ0.197まで持つ)をそのまま候補へ転用する。STEP1は解析用途で作った副産物であり、
// この転用自体は新しい解析を増やさない。
const candidatesFromStep1Onsets=()=>{
  const map=new Map();
  for(const o of features.events.onsets){
    const grid=o.nearestGridIndex,strength=o.strength,offsetMs=o.gridOffsetMs;
    const prev=map.get(grid);
    if(!prev||strength>prev.strength)map.set(grid,{grid,strength,offsetMs});
  }
  return map;
};
const CANDIDATE_MAPS=Object.freeze({normal:loadCandidates('normal'),dense:loadCandidates('dense'),step1:candidatesFromStep1Onsets()});
// 候補源ごとの補充下限。その源の強さを並べて、下位 supplementMinStrengthQuantile を切る位置。
const supplementFloorOf=map=>{
  const strengths=[...map.values()].map(i=>i.strength).sort((a,b)=>a-b);
  if(!strengths.length)return 0;
  return strengths[Math.min(strengths.length-1,Math.floor(strengths.length*COMMON.supplementMinStrengthQuantile))];
};
const SUPPLEMENT_FLOORS=Object.freeze(Object.fromEntries(Object.entries(CANDIDATE_MAPS).map(([k,v])=>[k,supplementFloorOf(v)])));
const minGrid=Math.ceil((COMMON.minTimeMs-timing.beatZeroMs)/gridMs);
const maxGrid=Math.floor((timing.audioDurationMs-COMMON.endPaddingMs-timing.beatZeroMs)/gridMs);
const minBar=Math.floor(minGrid/BAR),maxBar=Math.floor(maxGrid/BAR);

// --- 構造ルックアップ ---
// bar(小節)ごとのintensityは、STEP1のtimeline(500ms窓)のうちその小節へ重なる窓の平均。
// 窓が無い小節（曲末尾の端数等）は最も近い窓のintensityで埋める。
const timeline=features.timeline;
const barIntensity=barIndex=>{
  const startMs=gridTimeMs(barIndex*BAR),endMs=gridTimeMs((barIndex+1)*BAR);
  const inRange=timeline.filter(w=>w.centerMs>=startMs&&w.centerMs<endMs);
  if(inRange.length)return inRange.reduce((s,w)=>s+w.intensity,0)/inRange.length;
  let nearest=timeline[0],bestDist=Infinity;
  for(const w of timeline){const d=Math.abs(w.centerMs-(startMs+endMs)/2);if(d<bestDist){bestDist=d;nearest=w;}}
  return nearest?nearest.intensity:.5;
};
const sections=structure.sections;
const sectionForMs=ms=>{
  for(const s of sections)if(ms>=s.startMs&&ms<s.endMs)return s;
  return sections[sections.length-1]||null;
};
const phrases=structure.phrases;
const phraseForBar=barIndex=>phrases.find(p=>barIndex>=p.startBar&&barIndex<p.endBarExclusive)||null;
const phraseById=id=>phrases.find(p=>p.id===id)||null;

// --- 小節ごとの基礎段（三分位）を、V1の「オンセット強さ合計」ではなくSTEP1 intensityから決める ---
const barIndices=[];
for(let b=minBar;b<=maxBar;b++)barIndices.push(b);
const intensities=barIndices.map(barIntensity);
const sortedIntensities=intensities.slice().sort((a,b)=>a-b);
const q=r=>sortedIntensities[Math.min(sortedIntensities.length-1,Math.floor(sortedIntensities.length*r))];
const lowCut=q(1/3),midCut=q(2/3);
const baseTier=value=>value<=lowCut?0:value<=midCut?1:2;

const tierForBar=barIndex=>{
  const raw=baseTier(barIntensity(barIndex));
  const section=sectionForMs(gridTimeMs(barIndex*BAR));
  const adjust=section?sectionTierAdjust(section.sectionTypeCandidate):0;
  return Math.max(0,Math.min(2,raw+adjust));
};
// 盛り上がりの「順位」(0=いちばん静か〜1=いちばん盛り上がる)。段(3段階)だと CHORUS(0.6) と
// FINAL_CHORUS(0.9) が同じ段2に潰れ、サビの終盤がふつうのサビより薄くなっていたので、
// 小節ごとの上限はこの連続値から決める。段は「格子の細かさ・必要な強さ」の切り替えにだけ使う。
const intensityRank=value=>{
  let below=0;
  while(below<sortedIntensities.length&&sortedIntensities[below]<value)below++;
  return sortedIntensities.length>1?below/(sortedIntensities.length-1):0;
};
const intensityPosition=barIndex=>{
  const section=sectionForMs(gridTimeMs(barIndex*BAR));
  const adjust=section?sectionTierAdjust(section.sectionTypeCandidate):0;
  return Math.max(0,Math.min(1,intensityRank(barIntensity(barIndex))+adjust*SECTION_POSITION_ADJUST));
};

const buildChart=(difficulty)=>{
  const P=profileOverride&&profileOverride[difficulty]?Object.freeze({...PROFILES[difficulty],...profileOverride[difficulty]}):PROFILES[difficulty];
  const byGrid=CANDIDATE_MAPS[P.candidateSource];
  const inRange=i=>i.grid>=minGrid&&i.grid<=maxGrid;
  const onLattice=i=>i.grid%P.latticeGrids===0;
  const pool=[...byGrid.values()].filter(i=>inRange(i)&&onLattice(i)&&i.strength>=P.minStrength);
  const adopted=pool.filter(i=>Math.abs(i.offsetMs)<=COMMON.maxAbsPeakOffsetMs);
  const earReview=pool
    .filter(i=>Math.abs(i.offsetMs)>COMMON.maxAbsPeakOffsetMs&&Math.abs(i.offsetMs)<=COMMON.earReviewMaxOffsetMs)
    .map(i=>i.grid).sort((a,b)=>a-b);

  // --- 構造反映の核心: 小節ごとの「採用のしやすさ」自体を段で変える ---
  // 実測すると、この曲は下地となるオンセット候補の本数（1小節あたり約4〜5件）が
  // 難易度側のperBarByIntensity上限を下回っており、上限だけを段で変えても
  // 実際の採用数はほぼ変化しない（=盛り上がりが譜面へ出ない）ことが分かった。
  // そのため段の実効差は、上限に加えて「格子の細かさ」と「採用に必要な強さ」でも作る。
  // 静かな段（tier0）は格子を粗く・必要な強さを高くして採用そのものを絞り、
  // 盛り上がる段（tier2）は格子・強さを難易度既定のまま（または僅かに緩め）にして
  // 実際に採用される本数を増やす。
  const effectiveLatticeGrids=tier=>tier===0?P.latticeGrids*2:P.latticeGrids;
  const effectiveMinStrength=tier=>tier===0?Math.min(1,P.minStrength+.15):tier===2?Math.max(0,P.minStrength-.05):P.minStrength;
  const supplementSources=SOURCE_ORDER.slice(SOURCE_ORDER.indexOf(P.candidateSource)+1);
  const admittedInBar=(bar,tier,cap)=>{
    const lattice=effectiveLatticeGrids(tier),minStrength=effectiveMinStrength(tier);
    const start=bar*BAR,end=start+BAR;
    const items=[];
    for(const item of adopted){
      if(item.grid<start||item.grid>=end)continue;
      if(item.grid%lattice!==0)continue;
      if(item.strength<minStrength)continue;
      items.push(item);
    }
    // 候補が上限に届かない小節では、1段細かい候補源から補う。
    // この曲はサビの終盤ほど候補源が薄く(normal: サビ4.3/小節 → 終盤2.4/小節)、
    // 上限をいくら上げても終盤が薄いままだった。補う音は、その候補源の中で下位でない音に限る。
    // どの段から補うかは supplementFromTier。当初は段2(盛り上がり)だけに絞っていたが、
    // 実機で「全体的にノーツが少なくて退屈」と言われたので、段1(EXPERT以上は段0)まで広げた。
    // 静かな区間(INTRO / BREAK / OUTRO)へは足さない。静けさもその曲の一部で、
    // ここを埋めると「ずっと同じ濃さ」の譜面になってしまう。
    const calmSection=CALM_SECTION_TYPES.has(sectionForMs(gridTimeMs(bar*BAR))?.sectionTypeCandidate);
    if(!calmSection&&tier>=(P.supplementFromTier??2)&&items.length<cap){
      const taken=new Set(items.map(i=>i.grid));
      for(const source of supplementSources){
        if(items.length>=cap)break;
        const floor=Math.max(minStrength,SUPPLEMENT_FLOORS[source]);
        const extra=[];
        for(const item of CANDIDATE_MAPS[source].values()){
          if(item.grid<start||item.grid>=end||taken.has(item.grid))continue;
          if(!inRange(item)||item.grid%lattice!==0)continue;
          if(item.strength<floor||Math.abs(item.offsetMs)>COMMON.maxAbsPeakOffsetMs)continue;
          extra.push({...item,supplementedFrom:source});
        }
        // 強い順に、上限までのぶんだけ足す(弱い音で埋めない)
        extra.sort((a,b)=>b.strength-a.strength||a.grid-b.grid);
        for(const item of extra){
          if(items.length>=cap)break;
          items.push(item);taken.add(item.grid);
        }
      }
    }
    return items;
  };
  // 小節ごとの上限。perBarByIntensity の3つの値を、盛り上がりの順位 0 / 0.5 / 1 に置いた折れ線として読む。
  // 端数は次の小節へ持ち越す(誤差拡散)ので、平均は狙いどおりになり、乱数は使わない。
  const capForBar=bar=>{
    const u=intensityPosition(bar);
    const [c0,c1,c2]=P.perBarByIntensity;
    return u<=.5?c0+(c1-c0)*(u/.5):c1+(c2-c1)*((u-.5)/.5);
  };

  // --- 小節ごとに、上限の本数まで拍頭優先→強い順で選ぶ ---
  const picked=[];
  let capCarry=0;
  for(let bar=minBar;bar<=maxBar;bar++){
    const tier=tierForBar(bar);
    capCarry+=capForBar(bar);
    const limit=Math.floor(capCarry+1e-9);
    capCarry-=limit;
    if(limit<=0)continue;
    const items=admittedInBar(bar,tier,limit);
    if(!items.length)continue;
    items.sort((a,b)=>{
      const beatA=a.grid%BEAT===0?0:1,beatB=b.grid%BEAT===0?0:1;
      if(beatA!==beatB)return beatA-beatB;
      if(b.strength!==a.strength)return b.strength-a.strength;
      return a.grid-b.grid;
    });
    const inBar=[];
    for(const item of items){
      if(inBar.length>=limit)break;
      // 近すぎる音は取らない。以前は「最後に取った音」とだけ比べていたため、拍頭を先に取ると
      // それより前の裏拍が全部(負の差で)弾かれ、上限も供給も効かずどの難易度も2〜3音/小節に
      // 張り付いていた(V1から引き継いだ誤り)。同じ小節で取った全部と比べる。
      if(inBar.some(p=>Math.abs(p.grid-item.grid)<P.latticeGrids))continue;
      inBar.push(item);
    }
    picked.push(...inBar);
  }
  picked.sort((a,b)=>a.grid-b.grid);

  // --- フレーズmotif反映: 反復フレーズ(repeatedFromPhraseId)は、小節数が一致する場合だけ
  //     元フレーズと同じ拍位置（フレーズ先頭からの相対グリッド）に音を置く。
  //     ただし架空の音を作らない: 元と同じ相対位置の近傍(±2グリッド)に、そのフレーズ自身の
  //     実オンセット候補（採用基準を満たすもの）が実在する場合だけ採用する。無ければその1音は
  //     motifGapとして数え、無理に置かない。 ---
  let motifPhrasesTotal=0,motifPhrasesApplied=0,motifNotesAttempted=0,motifNotesGrounded=0;
  for(const phrase of phrases){
    if(!phrase.repeatedFromPhraseId)continue;
    if(phrase.startBar<minBar||phrase.endBarExclusive-1>maxBar)continue;
    motifPhrasesTotal++;
    const source=phraseById(phrase.repeatedFromPhraseId);
    if(!source)continue;
    const sourceBarCount=source.endBarExclusive-source.startBar;
    const repeatBarCount=phrase.endBarExclusive-phrase.startBar;
    if(sourceBarCount!==repeatBarCount)continue;
    if(source.startBar<minBar||source.endBarExclusive-1>maxBar)continue;
    motifPhrasesApplied++;
    const sourceStartGrid=source.startBar*BAR,repeatStartGrid=phrase.startBar*BAR;
    const sourcePicks=picked.filter(p=>p.grid>=sourceStartGrid&&p.grid<source.endBarExclusive*BAR);
    const grounded=[];
    for(const sourcePick of sourcePicks){
      motifNotesAttempted++;
      const targetGrid=repeatStartGrid+(sourcePick.grid-sourceStartGrid);
      const targetTier=tierForBar(Math.floor(targetGrid/BAR));
      const minStrength=effectiveMinStrength(targetTier);
      const lattice=effectiveLatticeGrids(targetTier);
      let best=null,bestDist=Infinity;
      for(let d=0;d<=2;d++){
        for(const g of d===0?[targetGrid]:[targetGrid-d,targetGrid+d]){
          const candidate=byGrid.get(g);
          if(!candidate)continue;
          if(!inRange(candidate))continue;
          if(candidate.grid%lattice!==0)continue;
          if(candidate.strength<minStrength)continue;
          if(Math.abs(candidate.offsetMs)>COMMON.maxAbsPeakOffsetMs)continue;
          if(Math.abs(g-targetGrid)<bestDist){bestDist=Math.abs(g-targetGrid);best=candidate;}
        }
        if(best)break;
      }
      if(best){grounded.push(best);motifNotesGrounded++;}
    }
    // このフレーズ範囲の独立選択結果を、motifで根拠づけられた選択へ置き換える。
    for(let i=picked.length-1;i>=0;i--){
      if(picked[i].grid>=repeatStartGrid&&picked[i].grid<phrase.endBarExclusive*BAR)picked.splice(i,1);
    }
    for(const item of grounded){
      if(!picked.some(p=>p.grid===item.grid))picked.push(item);
    }
  }
  picked.sort((a,b)=>a.grid-b.grid);

  // --- 以降はV1と同じ後処理（間引き・幅・レーン・HOLD/FLICK/SLIDE・複合操作・モンスター配置） ---
  const spaced=[];
  let run=1;
  for(const item of picked){
    const last=spaced[spaced.length-1];
    if(!last){spaced.push(item);continue;}
    if(item.grid-last.grid<=P.latticeGrids){
      if(run>=P.maxConsecutiveEighths)continue;
      run++;
    }else run=1;
    spaced.push(item);
  }

  const strengths=spaced.map(i=>i.strength).sort((a,b)=>a-b);
  const pick=r=>strengths[Math.min(strengths.length-1,Math.floor(strengths.length*r))];
  const wideCut=pick(.80),midWideCut=pick(.45);
  // 幅1(半ノーツ)を出す割合。いちばん弱い音から順に、この割合まで細くする
  const narrowCut=P.narrowRate>0?pick(P.narrowRate):-Infinity;
  // 「大きいほど簡単・細いほど難しい」に沿って決める。強い音ほど大きく、
  // 弱い音のうち narrowRate ぶんだけを幅1にする。
  // 以前は「速い連打なら幅1」にしていたため、NORMALに幅1が44個も出ていた
  // (実機で「半ノーツは難しい側だから高難易度用の位置づけにして」という指摘があった)。
  // 以前は「いちばん太い/3/2/1」の4分岐だったため、幅の集合を広げても実際には
  // 3種類しか出ず、幅4が譜面全体で1個だけ、という偏りになっていた。
  // いまは強さの順位(0=いちばん弱い〜1=いちばん強い)を幅の段へ等分に割り当てる。
  const widthsAscending=[...P.widths].sort((a,b)=>a-b);
  const mainWidths=widthsAscending.filter(width=>width>1);
  const strengthRank=strength=>{
    let below=0;
    while(below<strengths.length&&strengths[below]<strength)below++;
    return strengths.length>1?below/(strengths.length-1):0;
  };
  const widthFor=item=>{
    if(!mainWidths.length)return widthsAscending[0];
    if(widthsAscending[0]===1&&P.narrowRate>0&&item.strength<=narrowCut)return 1;
    const rank=strengthRank(item.strength);
    const above=P.narrowRate>0&&widthsAscending[0]===1
      ?Math.max(0,Math.min(1,(rank-P.narrowRate)/(1-P.narrowRate)))
      :rank;
    return mainWidths[Math.max(0,Math.min(mainWidths.length-1,Math.floor(above*mainWidths.length)))];
  };
  // 幅の上限が4から全幅(10)になったので、いちばん大きい幅は「区切りの一発」に取っておく。
  // どこにでも出すと画面が幅広ノーツだらけになり、幅の段階が意味を失う。
  // 大きいほど簡単なので、低い難易度ほど大きな幅(EASY/NORMAL=全幅10、HARD/EXPERT=8、MASTER=6)にする。
  const accentWidth=Math.max(1,Math.min(10,Number(P.accentWidth)||0));

  // --- レーン決め ---
  // 以前は「いまのレーン ± maxLaneStep」へ機械的に進めて端で折り返していたため、歩幅2だと 0/2/4、
  // 歩幅3だと 0/3、歩幅4だと 0/4 しか踏めず、レーン1に1音も来ない譜面になっていた(V1も同じ)。
  // さらに8分未満の間隔でも歩幅いっぱいに跳ぶので、EXPERT/MASTERは 0↔4 の往復ばかりになり、
  // STEP5の handMotion が0点だった。ここでは「届く範囲のうち、これまで踏んだ回数が少ないレーン」を
  // 選び(同数なら向きが続くほう→近いほう)、近い音ほど歩幅を狭める。乱数は使わない。
  const laneUse=[0,0,0,0,0];
  const notes=[];
  let lane=2,dir=1,prevBar=-1;
  spaced.forEach((item,index)=>{
    const bar=Math.floor(item.grid/BAR);
    const sameBar=bar===prevBar;
    if(!sameBar){dir=bar%2===0?1:-1;prevBar=bar;}
    const prev=spaced[index-1];
    const gap=prev?item.grid-prev.grid:Infinity;
    const keepLane=prev&&gap<=P.latticeGrids&&sameBar;
    if(!keepLane){
      const maxJump=gap<BEAT?Math.min(P.maxLaneStep,COMMON.laneStepFastMax):P.maxLaneStep;
      let best=null;
      for(let candidate=0;candidate<=4;candidate++){
        const delta=candidate-lane;
        if(delta===0||Math.abs(delta)>maxJump)continue;
        const key=[laneUse[candidate],Math.sign(delta)===dir?0:1,Math.abs(delta)];
        const better=!best||key[0]<best.key[0]
          ||(key[0]===best.key[0]&&(key[1]<best.key[1]||(key[1]===best.key[1]&&key[2]<best.key[2])));
        if(better)best={lane:candidate,key};
      }
      if(best){dir=Math.sign(best.lane-lane);lane=best.lane;}
    }
    laneUse[lane]++;
    const width=widthFor(item);
    // 幅のあるノーツは選んだレーンを中心に置く(左端寄せだと右のレーンほど踏めなくなる)。
    const subLane=Math.max(0,Math.min(10-width,lane*2+1-Math.ceil(width/2)));
    notes.push({type:'TAP',grid:item.grid,lane:Math.floor(subLane/2),subLane,subLaneWidth:width,
      sourceStrength:Math.round(item.strength*100)/100,sourcePeakOffsetMs:item.offsetMs,
      ...(item.supplementedFrom?{supplementedFrom:item.supplementedFrom}:{})});
  });

  const holdCandidates=[];
  for(let i=0;i<notes.length-1;i++){
    const note=notes[i],next=notes[i+1];
    if(note.grid%BEAT!==0)continue;
    const gap=next.grid-note.grid;
    if(gap<P.holdMinGapGrids)continue;
    // 間が広いほど長く押す(1拍 / 2拍 / 3拍)。以前は4か8だけで単調だった。
    const durationGrids=gap>=20?12:gap>=12?8:4;
    if(note.grid+durationGrids>=next.grid)continue;
    holdCandidates.push({index:i,durationGrids});
  }
  const spread=(candidates,count,minIndexGap)=>{
    const chosen=[],rest=candidates.slice();
    for(let k=0;k<count&&rest.length;k++){
      const first=rest[0].index,last=rest[rest.length-1].index;
      const target=first+(last-first)*(count>1?k/(count-1):0);
      let bestPos=-1,bestDistance=Infinity;
      rest.forEach((c,pos)=>{
        if(chosen.some(h=>Math.abs(h.index-c.index)<minIndexGap))return;
        const distance=Math.abs(c.index-target);
        if(distance<bestDistance){bestDistance=distance;bestPos=pos;}
      });
      if(bestPos<0)break;
      chosen.push(rest[bestPos]);
      rest.splice(bestPos,1);
    }
    return chosen.sort((a,b)=>a.index-b.index);
  };
  for(const {index,durationGrids} of spread(holdCandidates,P.holdMaxCount,2)){
    notes[index].type='HOLD';
    notes[index].durationGrids=durationGrids;
  }

  // --- 押さえている途中で幅が変わるHOLD ---
  // 実機で「ホールド・スライドは途中から広がったり小さくなったりもほしい」と言われて足した。
  // SLIDEは以前から形ごとに幅を変えられたが、HOLDは始点から終点までずっと同じ太さだった。
  // 長いHOLDから順に、広がる → 細くなる → 途中でふくらむ、を順番に割り当てる(乱数は使わない)。
  // 中心は動かさない(動かすとSLIDEになる)。幅は難易度の widths の範囲に収める。
  if(P.holdTaperMaxCount>0){
    const taperCandidates=notes.map((note,index)=>({note,index}))
      .filter(({note})=>note.type==='HOLD'&&Number(note.durationGrids)>=8)
      .map(({index})=>({index}));
    const widest=Math.max(...P.widths),narrowest=Math.min(...P.widths);
    // 中心を保ったまま幅を変える。はみ出す場合は左右へ寄せる。
    const centeredSubLane=(note,width)=>{
      const center=Number(note.subLane)+(Number(note.subLaneWidth)||2)/2;
      return Math.max(0,Math.min(10-width,Math.round(center-width/2)));
    };
    const shapes=['grow','shrink','swell'];
    spread(taperCandidates,P.holdTaperMaxCount,3).forEach(({index},ordinal)=>{
      const note=notes[index],startWidth=Number(note.subLaneWidth)||2;
      const wide=Math.min(widest,Math.max(startWidth+2,startWidth*2));
      const narrow=Math.max(narrowest,Math.min(startWidth,Math.max(1,Math.round(startWidth/2))));
      const startGrid=note.grid,endGrid=note.grid+Number(note.durationGrids);
      const midGrid=startGrid+Math.round(Number(note.durationGrids)/2);
      const point=(grid,width)=>({grid,subLane:centeredSubLane(note,width),subLaneWidth:width});
      const build=shape=>{
        if(shape==='grow')return wide>startWidth?[point(startGrid,startWidth),point(endGrid,wide)]:null;
        if(shape==='shrink')return narrow<startWidth?[point(startGrid,startWidth),point(endGrid,narrow)]:null;
        if(wide>startWidth)return [point(startGrid,startWidth),point(midGrid,wide),point(endGrid,startWidth)];
        return narrow<startWidth?[point(startGrid,startWidth),point(midGrid,narrow),point(endGrid,startWidth)]:null;
      };
      // 順番どおりの形が使えない(もういちばん太い / いちばん細い)ときは、次の形へ譲る
      let shape=null,points=null;
      for(let k=0;k<shapes.length&&!points;k++){
        shape=shapes[(ordinal+k)%shapes.length];
        points=build(shape);
      }
      if(!points||points.every(p=>p.subLaneWidth===startWidth))return;
      note.holdPoints=points;
      note.holdTaper=shape;
    });
  }

  if(P.flickMaxCount>0){
    const flickCandidates=[];
    for(let i=1;i<notes.length-1;i++){
      if(notes[i].type!=='TAP')continue;
      if(notes[i].grid%BEAT!==0)continue;
      // 前後の空きの条件。密度を上げたあとは「6グリッド空き」を満たす拍頭が減り、
      // EXPERT/MASTERでFLICKが7〜8個しか出なくなっていたので、1拍(4グリッド)まで緩める。
      // これで無理な配置になっていないかはSTEP6(両手の指のシミュレート)が見張る。
      if(notes[i+1].grid-notes[i].grid<4)continue;
      if(notes[i].grid-notes[i-1].grid<3)continue;
      flickCandidates.push({index:i});
    }
    for(const {index} of spread(flickCandidates,P.flickMaxCount,3)){
      // FLICKもTAPと同じ幅の決め方に従う。以前は必ず幅1にしていたため、どの難易度でも
      // FLICKだけ半ノーツになり、種類ごとに大きさが固定されて見えていた
      // (実機で「ノーツの種類でサイズが固定されている」という指摘があった)。
      const note=notes[index];
      note.type='FLICK';
      const width=Number(note.subLaneWidth)||2;
      note.subLane=Math.max(0,Math.min(10-width,Number(note.subLane)||0));
      note.lane=Math.floor(note.subLane/2);
    }
  }

  if(P.slideMaxCount>0){
    // 形を順番に使い回す。以前は全部「12グリッドで右へ1レーン」の同じ形だった。
    // 向きは始点の位置で決める(右寄りなら左へ)。端からはみ出す形は次の形へ譲る。
    const shortest=Math.min(...SLIDE_SHAPES.map(s=>s.grids));
    const slideCandidates=[];
    for(let i=1;i<notes.length-1;i++){
      if(notes[i].type!=='TAP')continue;
      if(notes[i].grid%BEAT!==0)continue;
      if(notes.some(o=>o!==notes[i]&&o.grid>notes[i].grid&&o.grid<=notes[i].grid+shortest&&o.type!=='TAP'))continue;
      slideCandidates.push({index:i});
    }
    const chosen=spread(slideCandidates,P.slideMaxCount,8);
    const startGrids=chosen.map(c=>notes[c.index].grid);
    startGrids.forEach((startGrid,ordinal)=>{
      const note=notes.find(n=>n.grid===startGrid);
      if(!note)return;
      const fits=shape=>startGrid+shape.grids<=maxGrid
        &&!notes.some(o=>o!==note&&o.grid>startGrid&&o.grid<=startGrid+shape.grids&&o.type!=='TAP');
      let shape=null;
      for(let k=0;k<SLIDE_SHAPES.length&&!shape;k++){
        const candidate=SLIDE_SHAPES[(ordinal+k)%SLIDE_SHAPES.length];
        if(fits(candidate))shape=candidate;
      }
      if(!shape)return;
      const reach=Math.max(...shape.steps);
      // 右寄りの始点は左へ、左寄りは右へ。はみ出すなら向きを変え、それでも駄目なら始点を寄せる。
      let direction=note.lane>=2.5?-1:1;
      let startLane=note.lane;
      if(startLane+direction*reach<0||startLane+direction*reach>4)direction=-direction;
      if(startLane+direction*reach<0)startLane=reach;
      if(startLane+direction*reach>4)startLane=4-reach;
      const lastStep=shape.steps.length-1;
      const points=shape.steps.map((step,i)=>({
        grid:startGrid+Math.round(shape.grids*(i/lastStep)),
        lane:startLane+direction*step,
        // 形が持つ幅は、その難易度で使うと決めた幅の範囲へ収める
        // (収めないと「幅は難易度で決めた範囲だけを使う」という約束をSLIDEだけが破る)
        subLaneWidth:Math.max(Math.min(...P.widths),Math.min(Math.max(...P.widths),shape.widths[i])),
      }));
      note.type='SLIDE';
      note.durationGrids=shape.grids;
      note.slidePoints=points;
      note.slideShape=shape.id;
      note.lane=points[0].lane;
      note.endLane=points[points.length-1].lane;
      note.subLaneWidth=points[0].subLaneWidth;
      delete note.subLane;
      for(let i=notes.length-1;i>=0;i--){
        const other=notes[i];
        if(other===note)continue;
        if(other.grid>startGrid&&other.grid<=startGrid+shape.grids)notes.splice(i,1);
      }
    });
  }

  const overlaps=[];
  if(P.simultaneous){
    const longNotes=notes.filter(n=>n.type==='HOLD'||n.type==='SLIDE');
    for(const n of longNotes){
      const midGrid=n.grid+Math.round(n.durationGrids/2);
      if(midGrid%P.latticeGrids!==0)continue;
      if(notes.some(o=>o.grid===midGrid))continue;
      // 別の長いノーツも同時に押さえている最中なら、重ねTAPは3本目の指になる。置かない。
      if(longNotes.some(o=>o!==n&&o.grid<midGrid&&o.grid+(Number(o.durationGrids)||0)>=midGrid))continue;
      const support=byGrid.get(midGrid);
      if(!support||Math.abs(support.offsetMs)>COMMON.maxAbsPeakOffsetMs)continue;
      const baseSub=n.type==='SLIDE'?Math.round(n.lane*2):n.subLane;
      const lane=baseSub<=4?4:0;
      overlaps.push({type:'TAP',grid:midGrid,lane,subLane:lane*2,subLaneWidth:2,
        sourceStrength:Math.round(support.strength*100)/100,sourcePeakOffsetMs:support.offsetMs,overlapWithGrid:n.grid});
    }
    notes.push(...overlaps);
    notes.sort((a,b)=>a.grid-b.grid||a.subLane-b.subLane);
  }

  // --- 同時押し（EXPERT/MASTER限定）: 新しい時刻は作らない。既存のTAPのうち、
  //     低域と高域が同時に強く立ち上がった瞬間（=1つの音に複数の音域が乗っている）
  //     だけを、2本指で分けて取る2レーン同時押しへ変える。 ---
  const chords=[];
  if(P.chordMaxCount>0){
    const overlapsRange=(aStart,aWidth,bStart,bWidth)=>aStart<bStart+bWidth&&bStart<aStart+aWidth;
    const bandsAt=grid=>{
      const ms=gridTimeMs(grid);
      let nearest=null,bestDist=Infinity;
      for(const w of timeline){const d=Math.abs(w.centerMs-ms);if(d<bestDist){bestDist=d;nearest=w;}}
      return nearest?nearest.frequencyBands:null;
    };
    const chordCandidates=[];
    for(let i=0;i<notes.length;i++){
      const note=notes[i];
      if(note.type!=='TAP'||note.chordWithGrid!=null)continue;
      // HOLD/SLIDE中の重ねTAPは既に2本目の指。それを同時押しへ割ると3本目が要る(STEP6で「押せない」になっていた)。
      if(note.overlapWithGrid!=null)continue;
      // 長いノーツを押さえている最中の同時押しも、同じ理由で置かない。
      if(notes.some(o=>(o.type==='HOLD'||o.type==='SLIDE')&&o.grid<note.grid&&o.grid+(Number(o.durationGrids)||0)>=note.grid))continue;
      // 同じ時刻に既に2つ以上あるなら、指が足りない。
      if(notes.filter(o=>o.grid===note.grid).length>=2)continue;
      const bands=bandsAt(note.grid);
      if(!bands)continue;
      if(bands.low.attack>=.6&&bands.high.attack>=.6)chordCandidates.push({index:i});
    }
    for(const {index} of spread(chordCandidates,P.chordMaxCount,4)){
      const note=notes[index];
      const baseStart=note.subLane,baseWidth=note.subLaneWidth||1;
      // 相方は「反対側へ2レーン」に置く。以前は必ず端(サブレーン0か8)に置いていたため、
      // 直前まで片側で叩いていた手が16分の間に4レーン跳ぶことになり、STEP6で「押せない」になっていた。
      const baseCenter=baseStart+baseWidth/2;
      const outward=baseCenter<=5?1:-1;
      let companionLane=Math.max(0,Math.min(9,Math.round(baseCenter+outward*4-.5)));
      // 幅広の本体と重なるなら、重ならなくなるまで外側へ寄せる
      while(overlapsRange(companionLane,1,baseStart,baseWidth)&&companionLane>0&&companionLane<9)companionLane+=outward;
      if(overlapsRange(companionLane,1,baseStart,baseWidth))continue;
      const collides=notes.some(o=>o.grid===note.grid&&o.subLane!=null&&overlapsRange(companionLane,1,o.subLane,o.subLaneWidth||1));
      if(collides)continue;
      chords.push({type:'TAP',grid:note.grid,lane:Math.floor(companionLane/2),subLane:companionLane,subLaneWidth:1,
        sourceStrength:note.sourceStrength,sourcePeakOffsetMs:note.sourcePeakOffsetMs,chordWithGrid:note.grid});
    }
    notes.push(...chords);
    notes.sort((a,b)=>a.grid-b.grid||a.subLane-b.subLane);
  }

  // --- 区切りの一発を大きく（幅の上限が全幅になったので、いちばん大きい幅はここへ取っておく） ---
  // セクション（INTRO / VERSE / CHORUS …）の変わり目にいちばん近いノーツを、その難易度の
  // アクセント幅まで広げる。曲の区切りが目で分かるようにするためで、
  // 「大きいほど簡単」なので低い難易度ほど大きくする。
  // 同じ時刻に別のノーツがある(同時押しの相方など)場所は避ける。数はaccentMaxCountまで。
  const accentGrids=[];
  if(accentWidth>Math.max(...P.widths)&&P.accentMaxCount>0){
    // accentWidth はその難易度のふつうの幅より必ず広い(そうでなければ「区切りの一発」に見えない)
    const sectionStarts=sections
      .map(section=>Math.round((section.startMs-timing.beatZeroMs)/gridMs))
      .filter(grid=>grid>minGrid&&grid<maxGrid);
    const claimed=new Set();
    for(const startGrid of sectionStarts){
      if(accentGrids.length>=P.accentMaxCount)break;
      let bestIndex=-1,bestDistance=Infinity;
      notes.forEach((note,index)=>{
        if(claimed.has(index)||note.subLane==null)return;
        if(note.type==='SLIDE')return;
        if(notes.some(other=>other!==note&&other.grid===note.grid))return;
        const distance=Math.abs(note.grid-startGrid);
        // 区切りから1拍以上離れた音は「その区切りの一発」とは言えないので広げない
        if(distance>BEAT||distance>=bestDistance)return;
        bestDistance=distance;bestIndex=index;
      });
      if(bestIndex<0)continue;
      const note=notes[bestIndex];
      const center=Number(note.subLane)+(Number(note.subLaneWidth)||2)/2;
      note.subLane=Math.max(0,Math.min(10-accentWidth,Math.round(center-accentWidth/2)));
      note.subLaneWidth=accentWidth;
      note.lane=Math.floor(note.subLane/2);
      note.sectionAccent=true;
      if(Array.isArray(note.holdPoints))delete note.holdPoints;
      claimed.add(bestIndex);
      accentGrids.push(note.grid);
    }
  }

  const firstGrid=notes[0].grid,lastGrid=notes[notes.length-1].grid;
  const span=lastGrid-firstGrid;
  const used=new Set();
  COMMON.monsterTargets.forEach((ratio,index)=>{
    const target=firstGrid+span*ratio;
    let bestIndex=-1,bestDistance=Infinity;
    notes.forEach((note,i)=>{
      if(note.type!=='TAP'||used.has(i))return;
      if(note.grid%BEAT!==0)return;
      const before=i>0?note.grid-notes[i-1].grid:Infinity;
      const after=i<notes.length-1?notes[i+1].grid-note.grid:Infinity;
      if(before<COMMON.monsterClearGrids||after<COMMON.monsterClearGrids)return;
      const distance=Math.abs(note.grid-target);
      if(distance<bestDistance){bestDistance=distance;bestIndex=i;}
    });
    if(bestIndex>=0){notes[bestIndex].monsterSlot=index+1;used.add(bestIndex);}
  });

  // --- 終点フリック（HOLD / SLIDE の終わりでフリックして離す） ---
  // 弾いたあと指を戻す時間が要るので、終端の前後に1拍（4グリッド）以上の余裕がある
  // HOLD / SLIDE だけを選ぶ。同時押し・重ねTAPが後から入ると余裕の判定が変わってしまうため、
  // 全ノーツが出そろったこの位置で決める。EASYは0（FLICK自体を使わない難易度のため）。
  const END_FLICK_MIN_GAP_GRIDS=4;
  if(P.endFlickMaxCount>0){
    const endFlickCandidates=[];
    notes.forEach((note,index)=>{
      if(note.type!=='HOLD'&&note.type!=='SLIDE')return;
      const endGrid=note.grid+(Number(note.durationGrids)||0);
      if(notes.some(other=>other!==note&&Math.abs(other.grid-endGrid)<END_FLICK_MIN_GAP_GRIDS))return;
      endFlickCandidates.push({index});
    });
    for(const {index} of spread(endFlickCandidates,P.endFlickMaxCount,8))notes[index].endFlick=true;
  }

  const typeCounts=notes.reduce((acc,n)=>{acc[n.type]=(acc[n.type]||0)+1;return acc;},{});
  const spanMs=gridTimeMs(lastGrid)-gridTimeMs(firstGrid);
  return {
    schemaVersion:1,
    analysisType:'rhythm-chart-v2-step3-chart',
    trackId,
    difficulty,
    candidateVersion:1,
    status:'V2_STRUCTURE_CANDIDATE',
    reviewRequired:true,
    runtimeConnected:false,
    bpm:timing.bpm,
    beatZeroMs:timing.beatZeroMs,
    subdivisionsPerBeat:timing.subdivisionsPerBeat,
    source:'rhythm-chart-v2-step3-generate',
    policy:{
      maxAbsPeakOffsetMs:COMMON.maxAbsPeakOffsetMs,
      mainLaneOnly:P.slideMaxCount===0,
      latticeGrids:P.latticeGrids,
      types:[...P.types],
      widths:[...P.widths],
      accentWidth,accentMaxCount:P.accentMaxCount??0,accentGrids:[...accentGrids],
      holdTaperMaxCount:P.holdTaperMaxCount??0,
      holdGrids:[4,8,12],
      perBarCap:'intensity-curve',
      sectionPositionAdjust:SECTION_POSITION_ADJUST,
      supplementSources,
      supplementMinStrengthQuantile:COMMON.supplementMinStrengthQuantile,
      supplementFloorBySource:SUPPLEMENT_FLOORS,
      laneStepFastMax:COMMON.laneStepFastMax,
      slideShapes:SLIDE_SHAPES.map(s=>s.id),
      narrowRate:P.narrowRate,
      supplementFromTier:P.supplementFromTier??2,
      endFlickMaxCount:P.endFlickMaxCount,
      endFlickMinGapGrids:END_FLICK_MIN_GAP_GRIDS,
      maxLaneStep:P.maxLaneStep,
      simultaneous:P.simultaneous,
      structureSource:{features:config.featuresInput,structure:config.structureInput},
      note:'V2 STEP3: 小節の密度段はSTEP1のintensityとSTEP2のsection種別から決め、反復フレーズはmotifとして揃えている。耳確認前の設計資料であり、正式完成譜面ではない。',
    },
    level:P.level,
    noteCount:notes.length,
    typeCounts,
    densityPerSecond:Math.round(notes.length/(spanMs/1000)*100)/100,
    monsterSlotGrids:notes.filter(n=>n.monsterSlot).map(n=>n.grid),
    earReviewGrids:earReview,
    motif:{phrasesTotal:motifPhrasesTotal,phrasesApplied:motifPhrasesApplied,notesAttempted:motifNotesAttempted,notesGrounded:motifNotesGrounded},
    chordCount:chords.length,
    notes,
  };
};

const DIFFICULTIES=only?[only]:['EASY','NORMAL','HARD','EXPERT','MASTER'];
for(const difficulty of DIFFICULTIES){
  if(!PROFILES[difficulty])throw new Error(`未知の難易度: ${difficulty}`);
  const candidate=buildChart(difficulty);
  const first=candidate.notes[0],last=candidate.notes[candidate.notes.length-1];
  console.log(`${difficulty}: ${candidate.noteCount}ノーツ (${Object.entries(candidate.typeCounts).map(([k,v])=>`${k}${v}`).join(' / ')})`);
  console.log(`  ${(gridTimeMs(first.grid)/1000).toFixed(1)}s〜${(gridTimeMs(last.grid)/1000).toFixed(1)}s / ${candidate.densityPerSecond}ノーツ毎秒 / 耳確認${candidate.earReviewGrids.length}件`);
  console.log(`  motif: 反復フレーズ${candidate.motif.phrasesTotal}件中${candidate.motif.phrasesApplied}件へ適用 / 音${candidate.motif.notesAttempted}件中${candidate.motif.notesGrounded}件を実オンセットへ接地${candidate.chordCount?` / 同時押し${candidate.chordCount}件`:''}`);
  if(overrideLabel)console.log(`  作り方の上書き: ${overrideLabel}`);
  if(!write)continue;
  const out=outputDir
    ?path.join(path.resolve(outputDir),`${trackId.replace(/_/g,'-')}-v2-chart-${difficulty.toLowerCase()}.json`)
    :path.join(ROOT,`${config.outputPrefix}${difficulty.toLowerCase()}.json`);
  fs.writeFileSync(out,JSON.stringify(candidate,null,1)+'\n');
  console.log(`  書き出し: ${outputDir?out:path.relative(ROOT,out)}`);
}
if(!write)console.log('（--write を付けると tools/mode/authoring/ へ書き出します。ランタイムへは接続しません）');
