#!/usr/bin/env node
// 自動譜面制作V3が、譜面設計の原則（docs/spec/RHYTHM_CHART_DESIGN.md）を守っているか。
//
//   node tools/mode/rhythm-chart-v3-check.js
//
// V3は「音の種類でノーツの種類を決め、音の高さの動きで形を選び、HOLDの長さとSLIDEの経路を
// 実際の音から取る」作り方をしている。ここでは、その主張が**出来上がった譜面で本当か**を測る。
// 言葉で書いただけで実際は乱数と変わらない、という状態を防ぐためのもの。
'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {spawnSync}=require('child_process');
const {HAND_MODEL,fingerPairFeasible,noteTouchLane,usableTouchSpan,separationRange}=require('./rhythm-hand-model.js');
const {PATTERNS}=require('./rhythm-chart-v3-patterns.js');

const ROOT=path.resolve(__dirname,'..','..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const readJson=file=>JSON.parse(read(file));
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};

const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
const generator=read('tools/mode/rhythm-chart-v3-generate.js');
const patternsSource=read('tools/mode/rhythm-chart-v3-patterns.js');
const pipeline=read('tools/mode/rhythm-chart-v3-pipeline.js');

// --- 1. 道具のふるまい ---
check('乱数を使わない（結果が毎回変わらないため）',
  ![generator,patternsSource,pipeline].some(source=>/Math\.random|crypto\.randomBytes/.test(source)));
check('生成器はランタイムへ書き込まない（設計資料だけを作る）',
  !/writeFileSync\([^)]*monster-hero\//.test(generator)&&/runtimeConnected:false/.test(generator));
check('ランタイムを書き換えるのはパイプラインのマーカーの内側だけ',
  // マーカー名は曲ごとに変えられる（--markers）。既定は Monster Hero の従来名。
  /\$\{markerPrefix\}-\$\{difficulty\.toLowerCase\(\)\}-notes/.test(pipeline)
  &&/monster_hero_theme'\?'monster-hero-v3'/.test(pipeline.replace(/\s+/g,''))
  &&/ほかの譜面（v1 \/ 候補v2 \/ 候補v3）まで書き換えようとしました/.test(pipeline));
check('手のモデルは共通のものを使う（道具ごとに別の物差しにしない）',
  generator.includes("require('./rhythm-hand-model.js')"));
check('形の語彙を別ファイルへ分けてある',
  generator.includes("require('./rhythm-chart-v3-patterns.js')")&&PATTERNS.length>=10,
  `${PATTERNS.length}種類`);

// 生成が決定的か（2回走らせて同じになるか）
// ★測る譜面は、この生成器の出力(1回目の一時出力 GEN_DIR)。配信済みの譜面(authoring の -fixed-)は、公開のあとに自動修正・
//   手直しを重ねて Rev.38 になっており、V3 生成器の上限では測れない(公開中の曲の譜面は作り直さない決まり。2026-11-13 窓口の決め)。
//   配信済みの譜面を見るのは、下の「公開中の全曲のクロス」だけ(既知の例外つき)
let GEN_DIR=null;
process.on('exit',()=>{if(GEN_DIR)try{fs.rmSync(GEN_DIR,{recursive:true,force:true});}catch(_){/* 一時出力の片づけ */}});
{
  const tempDir=fs.mkdtempSync(path.join(require('os').tmpdir(),'rhythm-v3-check-'));
  const run=()=>spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
    '--write','--output-dir',tempDir],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
  const first=run();
  GEN_DIR=first.status===0?tempDir:null;
  const hashOf=()=>crypto.createHash('sha256').update(
    fs.readdirSync(tempDir).sort().map(f=>fs.readFileSync(path.join(tempDir,f))).reduce((a,b)=>Buffer.concat([a,b]),Buffer.alloc(0))
  ).digest('hex');
  const a=first.status===0?hashOf():null;
  const firstFiles=first.status===0?fs.readdirSync(tempDir).sort().map(f=>[f,fs.readFileSync(path.join(tempDir,f))]):[];
  const second=run();
  const b=second.status===0?hashOf():null;
  check('2回走らせても同じ譜面になる（決定的）',first.status===0&&second.status===0&&a===b,
    a?`${a.slice(0,12)} / ${b?.slice(0,12)}`:(first.stderr||'').split('\n')[0]);
  // 2回目の出力で上書きされても同じ中身(決定的)だが、念のため1回目の中身を戻して、測るのは1回目の出力にする
  for(const [f,buf] of firstFiles)fs.writeFileSync(path.join(tempDir,f),buf);
}

// --- 2. 出来上がった譜面を測る ---
const audio=readJson('tools/mode/authoring/monster-hero-theme-v3-audio.json');
const onsetByGrid=new Map(audio.onsets.map(onset=>[onset.grid,onset]));
const heightByGrid=new Map(audio.pitchCurve.filter(p=>p.height!=null).map(p=>[p.grid,p.height]));
const sustainByStart=new Map(audio.sustains.map(span=>[span.startGrid,span]));
const gridMs=audio.timing.gridMs;
const BEAT=audio.timing.subdivisionsPerBeat;

const charts={};
for(const difficulty of DIFFICULTIES){
  const file=GEN_DIR?path.join(GEN_DIR,`monster-hero-theme-v3-chart-${difficulty.toLowerCase()}.json`):'';
  if(!file||!fs.existsSync(file)){check(`${difficulty}: 生成器の出力に譜面がある`,false,file||'生成できなかった');continue;}
  charts[difficulty]=JSON.parse(fs.readFileSync(file,'utf8'));
}
check('5難易度そろっている',DIFFICULTIES.every(d=>charts[d]));
if(!DIFFICULTIES.every(d=>charts[d])){console.log(`\n${failed}件のNGがあります`);process.exit(1);}

// (a) 鳴っている音の上にだけ置いているか（幽霊ノーツを作らない）
for(const difficulty of DIFFICULTIES){
  const notes=charts[difficulty].notes.filter(note=>!note.chord);
  const off=notes.filter(note=>!onsetByGrid.has(note.grid));
  check(`${difficulty}: すべてのノーツが実際に鳴っている場所にある`,off.length===0,
    off.length?`${off.length}件がずれている`:`${notes.length}ノーツ`);
}

// (b) 音の種類でノーツの種類・幅を決めているか
{
  const master=charts.MASTER.notes.filter(note=>!note.chord&&note.type==='TAP'&&!note.sectionAccent);
  const widthOf=character=>{
    const list=master.filter(note=>note.sourceCharacter===character);
    return list.length?list.reduce((sum,note)=>sum+note.subLaneWidth,0)/list.length:null;
  };
  const full=widthOf('FULL'),punch=widthOf('PUNCH'),light=widthOf('LIGHT');
  check('重い音ほど太く、軽い音ほど細く置いている',
    full!=null&&punch!=null&&light!=null&&full>punch&&punch>light,
    `FULL ${full?.toFixed(2)} > PUNCH ${punch?.toFixed(2)} > LIGHT ${light?.toFixed(2)}`);
  const accents=charts.MASTER.notes.filter(note=>note.sectionAccent);
  check('区切りの一発は「大きな一発（FULL）」から選んでいる',
    accents.length>0&&accents.every(note=>note.sourceCharacter==='FULL'),
    `${accents.length}個 / ${[...new Set(accents.map(n=>n.sourceCharacter))].join('/')}`);
  // 押さえノーツの同時押さえ(生成器の 15.5〜15.7)が足す2本目は、打点から作らないので出どころを持たない。
  // かわりに「どの組の2本目か」(heldPair)を持つ。2026-09-24 に設計資料を作り直すまで、
  // ここは同時押さえより前の古い設計資料を読んでいたので、この例外が無くても通っていた。
  const unsourced=charts.MASTER.notes.filter(note=>!note.chord&&typeof note.sourceCharacter!=='string');
  check('どのノーツにも「どの音から作ったか」が残っている（同時押さえの2本目は組の印を持つ）',
    unsourced.every(note=>note.heldPair&&typeof note.heldPairShape==='string'),
    `出どころ無し ${unsourced.length}本（組の印なし ${unsourced.filter(note=>!note.heldPair).length}本）`);
}

// (c) HOLDの長さが「実際に伸びている区間」から来ているか
for(const difficulty of ['HARD','EXPERT','MASTER']){
  const holds=charts[difficulty].notes.filter(note=>note.type==='HOLD');
  const grounded=holds.filter(note=>[0,1,-1,2,-2].some(shift=>sustainByStart.has(note.grid+shift)));
  check(`${difficulty}: HOLDが解析の「伸びている区間」から来ている`,
    holds.length>0&&grounded.length===holds.length,`${grounded.length}/${holds.length}`);
}

// (d) SLIDEの経路が音の高さの動きに沿っているか
for(const difficulty of ['HARD','EXPERT','MASTER']){
  const slides=charts[difficulty].notes.filter(note=>note.type==='SLIDE');
  let agree=0,total=0;
  for(const slide of slides){
    const points=(slide.slidePoints||[]).filter(point=>heightByGrid.has(point.grid));
    for(let i=1;i<points.length;i++){
      const laneMove=points[i].lane-points[i-1].lane;
      const heightMove=heightByGrid.get(points[i].grid)-heightByGrid.get(points[i-1].grid);
      if(Math.abs(heightMove)<.02)continue;
      total++;
      if(laneMove*heightMove>=0)agree++;
    }
  }
  check(`${difficulty}: SLIDEの向きが音の高さの向きと合っている`,
    total>0&&agree/total>=.9,`${agree}/${total}`);
}

// (e) 形の語彙が実際に使われているか（乱数と変わらない置き方になっていないか）
for(const difficulty of DIFFICULTIES){
  const shapes=charts[difficulty].shapes||[];
  const counts=new Map();
  for(const entry of shapes)if(entry.pattern)counts.set(entry.pattern,(counts.get(entry.pattern)||0)+1);
  const total=[...counts.values()].reduce((a,b)=>a+b,0);
  const top=Math.max(0,...counts.values());
  check(`${difficulty}: 形の語彙を6種類以上使っている`,counts.size>=6,
    `${counts.size}種類 / ${[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`${k}${v}`).join(' ')}`);
  check(`${difficulty}: 1つの形に偏っていない（半分を超えない）`,total>0&&top/total<=.5,
    `いちばん多い形が ${(top/Math.max(1,total)*100).toFixed(0)}%`);
}

// (f) 難易度が「同じ骨格の濃淡」になっているか
for(let i=1;i<DIFFICULTIES.length;i++){
  const lower=new Set(charts[DIFFICULTIES[i-1]].notes.filter(n=>!n.chord).map(n=>n.grid));
  const upper=new Set(charts[DIFFICULTIES[i]].notes.filter(n=>!n.chord).map(n=>n.grid));
  const inside=[...lower].filter(grid=>upper.has(grid)).length;
  check(`${DIFFICULTIES[i-1]}の音が${DIFFICULTIES[i]}にもある（骨格を共有している）`,
    inside/lower.size>=.9,`${inside}/${lower.size} (${(inside/lower.size*100).toFixed(0)}%)`);
}
check('ノーツ数が難易度順に増える',
  DIFFICULTIES.every((d,i)=>i===0||charts[d].notes.length>charts[DIFFICULTIES[i-1]].notes.length),
  DIFFICULTIES.map(d=>`${d} ${charts[d].notes.length}`).join(' < '));

// (g) 難易度ごとの「できること」を守っているか
const RULES={
  EASY:{lattice:2,maxStep:1,types:['TAP','HOLD']},
  NORMAL:{lattice:2,maxStep:2,types:['TAP','HOLD','FLICK']},
  HARD:{lattice:1,maxStep:2,types:['TAP','HOLD','FLICK','SLIDE']},
  EXPERT:{lattice:1,maxStep:3,types:['TAP','HOLD','FLICK','SLIDE']},
  MASTER:{lattice:1,maxStep:4,types:['TAP','HOLD','FLICK','SLIDE']},
};
for(const difficulty of DIFFICULTIES){
  const rule=RULES[difficulty];
  const notes=charts[difficulty].notes;
  check(`${difficulty}: 使うノーツの種類が決めたとおり`,
    notes.every(note=>rule.types.includes(note.type)),
    [...new Set(notes.map(n=>n.type))].join('/'));
  if(rule.lattice>1){
    check(`${difficulty}: 8分の位置だけを使う`,
      notes.every(note=>note.grid%rule.lattice===0));
  }
  // 跳びは「指が実際に動かなければならない距離」で測る。中心どうしの差で測ると、
  // 幅が違うだけで動かなくていい場面まで跳びに数えてしまう。
  const sorted=notes.slice().sort((a,b)=>a.grid-b.grid);
  let worst=0;
  for(let i=1;i<sorted.length;i++){
    if(sorted[i].grid===sorted[i-1].grid)continue;
    if((sorted[i].grid-sorted[i-1].grid)*gridMs>=BEAT*gridMs)continue;   // 1拍以上あけば跳びではない
    worst=Math.max(worst,separationRange(usableTouchSpan(sorted[i]),usableTouchSpan(sorted[i-1])).min);
  }
  check(`${difficulty}: 速い区間で指が動く距離が決めた上限以内`,worst<=rule.maxStep+1e-9,
    `最大 ${worst.toFixed(2)}レーン / 上限 ${rule.maxStep}`);
}

// (h) 押せるか
for(const difficulty of DIFFICULTIES){
  const notes=charts[difficulty].notes.slice().sort((a,b)=>a.grid-b.grid);
  const bad=[];
  for(let i=1;i<notes.length;i++){
    for(let j=i-1;j>=0;j--){
      const deltaMs=(notes[i].grid-notes[j].grid)*gridMs;
      if(deltaMs>=HAND_MODEL.restrikeLimitMs)break;
      if(deltaMs<1)continue;
      if(!fingerPairFeasible(notes[i],notes[j],deltaMs).ok){bad.push(notes[i].grid);break;}
    }
  }
  check(`${difficulty}: 指が2本入らない近さで速すぎる組み合わせが無い`,bad.length===0,
    bad.length?`${bad.length}件`:`${notes.length}ノーツを総当たりで確認`);
}

// (i) 休符が残っているか（上限まで埋めていないか）
for(const difficulty of DIFFICULTIES){
  const notes=charts[difficulty].notes.slice().sort((a,b)=>a.grid-b.grid);
  let longest=0;
  for(let i=1;i<notes.length;i++)longest=Math.max(longest,(notes[i].grid-notes[i-1].grid)*gridMs);
  const gaps=[];
  for(let i=1;i<notes.length;i++)gaps.push((notes[i].grid-notes[i-1].grid)*gridMs);
  const rests=gaps.filter(gap=>gap>=BEAT*gridMs).length;
  check(`${difficulty}: 手を止められる間（1拍以上）が残っている`,rests>=20,
    `${rests}箇所 / いちばん長い間 ${(longest/1000).toFixed(2)}秒`);
}

// (j) 同時押し — EASYから出す。難しさは「置き方」で作る
//
// 同時押しそのものは難しくない（指は2本あるので、離れた2か所を同時に押すのは
// 1か所を押すのとほとんど変わらない）。だからEASYから出す。
// かわりに下の難易度ほど、置き方を易しくする。ここではその**置き方**を確かめる。
{
  // 難易度ごとの「守るべき置き方」。生成器の値ではなく、狙いをここへ書く
  // （生成器の定数をそのまま読むと、生成器が変わったときに一緒に緩んでしまう）。
  const CHORD_RULES={
    EASY:  {minGapLanes:2,   onBeat:true, clearGrids:3, minWidth:3},
    NORMAL:{minGapLanes:2,   onBeat:true, clearGrids:2, minWidth:3},
    HARD:  {minGapLanes:1.5, onBeat:false,clearGrids:2, minWidth:3},
    EXPERT:{minGapLanes:1.25,onBeat:false,clearGrids:1, minWidth:2},
    MASTER:{minGapLanes:1,   onBeat:false,clearGrids:1, minWidth:2},
  };
  const counts={};
  for(const difficulty of DIFFICULTIES){
    const notes=charts[difficulty].notes;
    const rule=CHORD_RULES[difficulty];
    const byGrid=new Map();
    for(const note of notes){
      if(!byGrid.has(note.grid))byGrid.set(note.grid,[]);
      byGrid.get(note.grid).push(note);
    }
    const groups=[...byGrid.entries()].filter(([,group])=>group.length>=2);
    counts[difficulty]=groups.length;
    const sustains=notes.filter(note=>note.type==='HOLD'||note.type==='SLIDE')
      .map(note=>({startGrid:note.grid,endGrid:note.grid+(Number(note.durationGrids)||0)}));
    const problems=[];
    for(const [grid,group] of groups){
      if(group.length>HAND_MODEL.hands)problems.push(`${grid}: ${group.length}個同時`);
      const gap=separationRange(usableTouchSpan(group[0]),usableTouchSpan(group[1])).min;
      if(gap+1e-9<rule.minGapLanes-.01)problems.push(`${grid}: 間隔${gap.toFixed(2)}レーン`);
      if(rule.onBeat&&grid%BEAT!==0)problems.push(`${grid}: 拍の頭でない`);
      if(group.some(note=>(Number(note.subLaneWidth)||0)<rule.minWidth))problems.push(`${grid}: 細すぎる`);
      const near=notes.some(note=>!group.includes(note)
        &&Math.abs(note.grid-grid)>0&&Math.abs(note.grid-grid)<rule.clearGrids);
      if(near)problems.push(`${grid}: 前後が空いていない`);
      if(sustains.some(span=>span.startGrid<grid&&grid<=span.endGrid))problems.push(`${grid}: 押さえっぱなしの最中`);
    }
    check(`${difficulty}: 同時押しがその難易度の置き方を守っている`,problems.length===0,
      problems.length?problems.slice(0,3).join(' / '):`${groups.length}組 / 最低${rule.minGapLanes}レーン離す`);
  }
  check('EASYにも同時押しがある（同時押し自体は難しくないため）',counts.EASY>=1,`${counts.EASY}組`);
  check('難易度が上がるほど同時押しが増える',
    DIFFICULTIES.every((d,i)=>i===0||counts[d]>=counts[DIFFICULTIES[i-1]]),
    DIFFICULTIES.map(d=>`${d} ${counts[d]}`).join(' / '));
  check('生成器は同時押しの置き方を難易度ごとに持っている',
    /chord:Object\.freeze\(\{perMinute:/.test(generator)&&generator.includes('minGapLanes')
    &&generator.includes('onBeat')&&generator.includes('clearGrids')&&generator.includes('minWidth'),
    '同時押しの条件（間隔・拍の頭・前後の空き・太さ）');
  check('「押さえながら別を叩く」は同時押しとは別に持っている（EXPERT以上）',
    generator.includes('tapDuringHold:false')&&generator.includes('tapDuringHold:true'));
}

// (k) 大きく動かす見せ場 — スイープ・同時押しの連なり・クロス
//
// 「バリエーションが少ない」という指摘（2026-09-05）で足した3つ。
// どれも**難易度ごとにどこまで許すか**が本体なので、生成器の定数ではなく
// 狙いをここへ書いて、出来上がった譜面で確かめる。
{
  const MOVE_RULES={
    EASY:  {sweep:false,chordRun:false,cross:false,maxSweepSpeed:0},
    NORMAL:{sweep:false,chordRun:false,cross:false,maxSweepSpeed:0},
    HARD:  {sweep:true, chordRun:false,cross:false,maxSweepSpeed:6},
    EXPERT:{sweep:true, chordRun:true, cross:true, maxSweepSpeed:8},
    MASTER:{sweep:true, chordRun:true, cross:true, maxSweepSpeed:10},
  };
  const counts={};
  for(const difficulty of DIFFICULTIES){
    const notes=charts[difficulty].notes;
    const rule=MOVE_RULES[difficulty];
    const sweeps=notes.filter(note=>note.sweep===true);
    const runs=notes.filter(note=>typeof note.chordRun==='string');
    const crosses=notes.filter(note=>note.cross===true);
    counts[difficulty]={sweep:sweeps.length,run:runs.length,cross:crosses.length};
    // その難易度で許していないものが出ていないか
    const forbidden=[];
    if(!rule.sweep&&sweeps.length)forbidden.push(`スイープ${sweeps.length}`);
    if(!rule.chordRun&&runs.length)forbidden.push(`連なり${runs.length}`);
    if(!rule.cross&&crosses.length)forbidden.push(`クロス${crosses.length}`);
    check(`${difficulty}: その難易度で許していない見せ場が出ていない`,forbidden.length===0,
      forbidden.length?forbidden.join(' / '):'—');
    // スイープ: 本当に大きく動いているか・追従が速すぎないか
    const problems=[];
    for(const note of sweeps){
      const points=Array.isArray(note.slidePoints)?note.slidePoints:[];
      const lanes=points.map(point=>Number(point.lane));
      if(!lanes.length){problems.push(`${note.grid}: 経路が無い`);continue;}
      if(Math.max(...lanes)-Math.min(...lanes)<2.5)
        problems.push(`${note.grid}: ${(Math.max(...lanes)-Math.min(...lanes)).toFixed(1)}レーンしか動かない`);
      for(let i=1;i<points.length;i++){
        const deltaMs=(points[i].grid-points[i-1].grid)*gridMs;
        if(deltaMs<=0){problems.push(`${note.grid}: 中継点の順番がおかしい`);break;}
        const speed=Math.abs(lanes[i]-lanes[i-1])/(deltaMs/1000);
        if(speed>rule.maxSweepSpeed+.01){problems.push(`${note.grid}: 追従${speed.toFixed(1)}レーン毎秒`);break;}
      }
    }
    if(rule.sweep)check(`${difficulty}: スイープが大きく動き、追従の速さも上限内`,problems.length===0,
      problems.length?problems.slice(0,3).join(' / '):`${sweeps.length}本 / 上限${rule.maxSweepSpeed}レーン毎秒`);
    // クロス: 押さえっぱなしより外側にあるか（内側では交差にならない）
    if(rule.cross&&crosses.length){
      const holds=notes.filter(note=>note.type==='HOLD');
      const bad=crosses.filter(note=>{
        const covering=holds.filter(hold=>hold.grid<note.grid
          &&note.grid<=hold.grid+(Number(hold.durationGrids)||0));
        if(covering.length!==1)return true;
        const holdLane=noteTouchLane(covering[0]),noteLane=noteTouchLane(note);
        // 道の真ん中は譜面のレーン数から(5レーンなら2、6レーンなら2.5)。生成器の (LANES-1)/2 とそろえる
        const middle=((Number(charts[difficulty].laneCount)===6?6:5)-1)/2;
        const outside=holdLane<=middle?noteLane<holdLane:noteLane>holdLane;
        const apart=separationRange(usableTouchSpan(note),usableTouchSpan(covering[0])).min
          >=HAND_MODEL.fingerMinGapLanes-1e-9;
        return !(outside&&apart);
      });
      check(`${difficulty}: クロスが押さえっぱなしの外側にある`,bad.length===0,
        bad.length?`${bad.length}件が内側`:`${crosses.length}箇所`);
    }
  }
  check('SLIDEを持つ難易度には端まで走る一本がある',
    counts.HARD.sweep+counts.EXPERT.sweep+counts.MASTER.sweep>=3,
    DIFFICULTIES.map(d=>`${d} ${counts[d].sweep}`).join(' / '));
  check('同時押しの連なりはEXPERT以上にある',counts.EXPERT.run>=2&&counts.MASTER.run>=counts.EXPERT.run,
    DIFFICULTIES.map(d=>`${d} ${counts[d].run}`).join(' / '));
  check('クロスはMASTERがいちばん多い',counts.MASTER.cross>=1&&counts.MASTER.cross>=counts.EXPERT.cross,
    DIFFICULTIES.map(d=>`${d} ${counts[d].cross}`).join(' / '));
  check('生成器は3つの見せ場を難易度ごとに持っている',
    /sweep:Object\.freeze\(\{perMinute:/.test(generator)
    &&/chordRun:Object\.freeze\(\{perMinute:/.test(generator)
    &&/crossPerMinute:/.test(generator)
    &&generator.includes('sweep:null')&&generator.includes('chordRun:null'),
    'スイープ / 同時押しの連なり / クロス');
  check('自動修正は同時押しの離れかたを縮めない',
    read('tools/mode/rhythm-chart-v2-step7-autofix.js').includes('keepsChord'),
    '忙しさを直すために設計のほうを壊さない');
}

// (l) 形の語彙を実際に使い切っているか
for(const difficulty of DIFFICULTIES){
  const shapes=(charts[difficulty].shapes||[]).filter(entry=>entry.pattern);
  const kinds=new Set(shapes.map(entry=>entry.pattern));
  check(`${difficulty}: 形の語彙を8種類以上使っている`,kinds.size>=8,`${kinds.size}種類`);
}

// (m) 終点フリックを「弾いた動きと見分けられる場所」にだけ置いているか（2026-09-18）
//
// 終点フリックは「受付に入った位置から24px動いたら弾いた」と見る。斜めやジグザグのSLIDEでは
// 指は経路を追って動き続けるしかなく、人の追従は遅れる。受付のあいだに経路そのものが24pxより
// 大きく振れる区間では「弾いた」と「追っただけ」を見分けられず、弾かなくても成立してしまう。
// 配信中の譜面は rhythm-end-flick-swing-check.js が見張っているので、ここでは**生成した譜面**を見る。
{
  const ARM_MS=250,BACK_MS=80,BACK_STEPS=4,MAX_SWING_LANES=.35;   // 24px ÷ 68.6px(幅390pxの画面の1レーン)
  const laneAt=(note,grid)=>{
    const points=note.slidePoints;
    if(!Array.isArray(points)||!points.length)return Number(note.lane)||0;
    if(grid<=points[0].grid)return Number(points[0].lane)||0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      if(grid<=b.grid){
        const span=Math.max(1e-6,Number(b.grid)-Number(a.grid));
        const p=Math.max(0,Math.min(1,(grid-Number(a.grid))/span));
        return Number(a.lane)+(Number(b.lane)-Number(a.lane))*p;
      }
    }
    return Number(points[points.length-1].lane)||0;
  };
  const swingLanes=note=>{
    if(note.type!=='SLIDE')return 0;
    const endGrid=note.grid+(Number(note.durationGrids)||0);
    let peak=0;
    for(let ms=-ARM_MS;ms<=0;ms+=10){
      let min=Infinity,max=-Infinity;
      for(let i=0;i<=BACK_STEPS;i++){
        const lane=laneAt(note,endGrid+(ms-BACK_MS*(1-i/BACK_STEPS))/gridMs);
        if(!Number.isFinite(lane))continue;
        if(lane<min)min=lane;
        if(lane>max)max=lane;
      }
      if(max>=min&&max-min>peak)peak=max-min;
    }
    return peak;
  };
  for(const difficulty of DIFFICULTIES){
    const flicks=charts[difficulty].notes.filter(note=>note.endFlick===true);
    const bad=flicks.filter(note=>swingLanes(note)>=MAX_SWING_LANES);
    check(`${difficulty}: 終点フリックが、経路の大きく振れる場所に無い`,bad.length===0,
      bad.length?bad.slice(0,3).map(note=>`${note.grid}(${swingLanes(note).toFixed(2)}レーン)`).join(' / ')
        :`${flicks.length}本 / 上限${MAX_SWING_LANES}レーン`);
  }
  check('生成器も同じ条件で候補から外している',
    /endFlickPathSwingLanes\(note\)>=END_FLICK_MAX_SWING_LANES/.test(generator)
    &&/const END_FLICK_MAX_SWING_LANES=0\.35/.test(generator));
}

// --- 公開中の全曲の交差(2026-09-26) ---
const KNOWN_RELEASED_CROSS_EXCEPTIONS=Object.freeze([
  // 名前つきの既知の例外(曲 難易度 位置)。2026-11-13 窓口の決め: 公開中の譜面は作り直さない決まりのため、
  // 今週より前に公開した曲の今ある違反だけを認める。中身は「押さえっぱなしと逆の側にある、名ばかりのクロス」がほとんど
  // (押しにくくはなっていない)。直すかは社長に聞いてから決める。
  // 新曲の7件(下の最後の2行)も同じ形(cross の印が付いたノーツが押さえっぱなしと逆の側にあるだけで、押しにくくはない)なので、
  // 2026-11-13 窓口の判断で同じ理由で入れた。公開中の譜面は直さない。生成器(自動修正)の側の件は docs/progress/beat-cross-opposite-side.md
  // ★これより後の新曲の違反は、ここへ足さずに譜面の側を直す
  'monster_hero_theme EXPERT 980',
  'monster_hero_theme_alt EXPERT 588', 'monster_hero_theme_alt MASTER 256',
  'six_eternel_remix_beat EXPERT 116', 'six_eternel_remix_beat MASTER 380', 'six_eternel_remix_beat MASTER 494', 'six_eternel_remix_beat MASTER 638',
  'six_eternel_beat EXPERT 369', 'six_eternel_beat MASTER 369',
  'pandora_boss EXPERT 196', 'pandora_boss EXPERT 776', 'pandora_boss MASTER 202', 'pandora_boss MASTER 776', 'pandora_boss MASTER 1254', 'pandora_boss MASTER 1413',
  'eiki_boss EXPERT 169', 'eiki_boss EXPERT 288', 'eiki_boss MASTER 169', 'eiki_boss MASTER 288', 'eiki_boss MASTER 743', 'eiki_boss MASTER 880', 'eiki_boss MASTER 996', 'eiki_boss MASTER 1051',
  'eiki_boss_remix EXPERT 76', 'eiki_boss_remix EXPERT 308', 'eiki_boss_remix MASTER 76', 'eiki_boss_remix MASTER 216', 'eiki_boss_remix MASTER 308', 'eiki_boss_remix MASTER 580', 'eiki_boss_remix MASTER 660', 'eiki_boss_remix MASTER 916', 'eiki_boss_remix MASTER 1300',
  'pandora_boss_remix EXPERT 736', 'pandora_boss_remix EXPERT 904', 'pandora_boss_remix MASTER 736',
  '4u_hitasura MASTER 372',
  'crossing_field EXPERT 132', 'crossing_field MASTER 132',
  'freedom_dive EXPERT 625',
  'the_city_beneath_the_comets EXPERT 112', 'the_city_beneath_the_comets MASTER 112', 'the_city_beneath_the_comets MASTER 276', 'the_city_beneath_the_comets MASTER 770', 'the_city_beneath_the_comets MASTER 952',
  'mou_hitotsu_no_sekai_e EXPERT 356', 'mou_hitotsu_no_sekai_e EXPERT 622', 'mou_hitotsu_no_sekai_e MASTER 508', 'mou_hitotsu_no_sekai_e MASTER 622', 'mou_hitotsu_no_sekai_e MASTER 856', 'mou_hitotsu_no_sekai_e MASTER 932', 'mou_hitotsu_no_sekai_e MASTER 1236',
  'senjou_no_shippuu EXPERT 580', 'senjou_no_shippuu EXPERT 1362', 'senjou_no_shippuu MASTER 132', 'senjou_no_shippuu MASTER 580', 'senjou_no_shippuu MASTER 1362',
  'makutsu_no_senritsu EXPERT 150', 'makutsu_no_senritsu EXPERT 234', 'makutsu_no_senritsu MASTER 234', 'makutsu_no_senritsu MASTER 806',
  'haruka EXPERT 228',
  'stay_with_me_short EXPERT 156', 'stay_with_me_short EXPERT 308', 'stay_with_me_short EXPERT 660', 'stay_with_me_short MASTER 308', 'stay_with_me_short MASTER 507', 'stay_with_me_short MASTER 813', 'stay_with_me_short MASTER 1194', 'stay_with_me_short MASTER 1373', 'stay_with_me_short MASTER 1840',
  'kiki_issen_short EXPERT 492',
  'crazy_party_night_full EXPERT 2046', 'crazy_party_night_full MASTER 2046',
  'monster EXPERT 276', 'monster EXPERT 560', 'monster EXPERT 1648', 'monster MASTER 276', 'monster MASTER 580',
  'anima EXPERT 900', 'anima MASTER 900', 'anima MASTER 1366',
  'rose EXPERT 344',
  'sad_song EXPERT 396', 'sad_song EXPERT 536', 'sad_song MASTER 216', 'sad_song MASTER 1792', 'sad_song MASTER 2356',
  'sad_song_short EXPERT 216',
  'toward_the_stars_short MASTER 280', 'toward_the_stars_short MASTER 746',
  'black_shout MASTER 388',
  'light_player EXPERT 344', 'light_player EXPERT 792', 'light_player EXPERT 1172', 'light_player MASTER 344', 'light_player MASTER 792', 'light_player MASTER 1172', 'light_player MASTER 1750', 'light_player MASTER 2068', 'light_player MASTER 2150', 'light_player MASTER 2378', 'light_player MASTER 2532',
  'light_player_short EXPERT 222', 'light_player_short EXPERT 356', 'light_player_short EXPERT 1648', 'light_player_short MASTER 222',
  'tsuki_ga_michiru_mae_ni EXPERT 1728', 'tsuki_ga_michiru_mae_ni EXPERT 2368', 'tsuki_ga_michiru_mae_ni MASTER 1344', 'tsuki_ga_michiru_mae_ni MASTER 2368',
  'rebellion EXPERT 440', 'rebellion EXPERT 1112', 'rebellion MASTER 403', 'rebellion MASTER 1227',
  'rebellion_short MASTER 10', 'rebellion_short MASTER 114',
  'altar_world_tree EXPERT 1220', 'altar_world_tree EXPERT 1344', 'altar_world_tree EXPERT 2194', 'altar_world_tree MASTER 2254',
  'altar_world_tree_short EXPERT 612', 'altar_world_tree_short EXPERT 872',
  'megalovania_sans EXPERT 174', 'megalovania_sans EXPERT 1480', 'megalovania_sans MASTER 1480', 'megalovania_smash EXPERT 528',
  'saudade_short EXPERT 476', 'evans EXPERT 22', 'evans MASTER 22',
]);
// 上のクロスの確かめは Monster Hero だけを見ていた。Rev.7で作り直したとき、自動修正が押さえっぱなしのHOLDの側を動かして
// 交差を内側へ入れた譜面が10曲にあった(直したのは rhythm-chart-v2-step7-autofix.js の keepsCoveredCrosses・Rev.7から)。
// Rev.7以降の公開曲は、どの難易度でも交差が外側にあることを見る(Rev.6以前の譜面は作り直さないので対象にしない)
{
  const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
  let total=0;const bad=[];
  for(const trackId of new Set(Object.values(RELEASED_TRACKS))){
    for(const difficulty of DIFFICULTIES){
      const file=path.join(ROOT,`tools/mode/authoring/${trackId.replace(/_/g,'-')}-v3-fixed-${difficulty.toLowerCase()}.json`);
      if(!fs.existsSync(file))continue;
      const chart=JSON.parse(fs.readFileSync(file,'utf8'));
      if(!(Number(chart.chartRevision)>=7))continue;
      const holds=(chart.notes||[]).filter(note=>note.type==='HOLD');
      const middle=((Number(chart.laneCount)===6?6:5)-1)/2;
      for(const note of (chart.notes||[]).filter(note=>note.cross===true)){
        total++;
        const covering=holds.filter(hold=>hold.grid<note.grid&&note.grid<=hold.grid+(Number(hold.durationGrids)||0));
        let good=covering.length===1;
        if(good){
          const holdLane=noteTouchLane(covering[0]),noteLane=noteTouchLane(note);
          good=(holdLane<=middle?noteLane<holdLane:noteLane>holdLane)
            &&separationRange(usableTouchSpan(note),usableTouchSpan(covering[0])).min>=HAND_MODEL.fingerMinGapLanes-1e-9;
        }
        if(!good)bad.push(`${trackId} ${difficulty} ${note.grid}`);
      }
    }
  }
  if(process.env.V3_CHECK_LIST_BAD)console.log(bad.join('\n'));
  // 既知の例外(曲・難易度・位置まで名前つき)。公開中の譜面は作り直さない決まりのため、今ある違反はそのまま認める。
  // 一覧にない曲・難易度・位置の違反は、今までどおり落とす(新曲や、公開中の譜面を書き換えて増えた違反を見逃さない)。
  // ★この一覧に足してよいのは「すでに公開されている譜面で、作り直せないもの」だけ。新曲の違反は譜面の側を直す
  const unexpected=bad.filter(item=>!KNOWN_RELEASED_CROSS_EXCEPTIONS.includes(item));
  const stale=KNOWN_RELEASED_CROSS_EXCEPTIONS.filter(item=>!bad.includes(item));
  check('公開中の全曲(Rev.7以降): クロスが押さえっぱなしの外側にある(既知の例外を除く)',unexpected.length===0,
    unexpected.length?unexpected.slice(0,4).join(' / '):`${total}箇所 / 既知の例外 ${KNOWN_RELEASED_CROSS_EXCEPTIONS.length-stale.length}件`);
  // 譜面が直って例外が要らなくなったら、一覧から外す(古い例外を残さない)
  check('既知の例外が、いまも実際に違反している(直ったものは一覧から外す)',stale.length===0,
    stale.length?stale.slice(0,4).join(' / '):'');
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
