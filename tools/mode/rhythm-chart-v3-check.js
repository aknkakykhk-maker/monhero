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
{
  const tempDir=fs.mkdtempSync(path.join(require('os').tmpdir(),'rhythm-v3-check-'));
  const run=()=>spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
    '--write','--output-dir',tempDir],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
  const first=run();
  const hashOf=()=>crypto.createHash('sha256').update(
    fs.readdirSync(tempDir).sort().map(f=>fs.readFileSync(path.join(tempDir,f))).reduce((a,b)=>Buffer.concat([a,b]),Buffer.alloc(0))
  ).digest('hex');
  const a=first.status===0?hashOf():null;
  const second=run();
  const b=second.status===0?hashOf():null;
  check('2回走らせても同じ譜面になる（決定的）',first.status===0&&second.status===0&&a===b,
    a?`${a.slice(0,12)} / ${b?.slice(0,12)}`:(first.stderr||'').split('\n')[0]);
  fs.rmSync(tempDir,{recursive:true,force:true});
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
  const file=`tools/mode/authoring/monster-hero-theme-v3-fixed-${difficulty.toLowerCase()}.json`;
  if(!fs.existsSync(path.join(ROOT,file))){check(`${difficulty}: 譜面がある`,false,file);continue;}
  charts[difficulty]=readJson(file);
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
  check('どのノーツにも「どの音から作ったか」が残っている',
    charts.MASTER.notes.every(note=>note.chord||typeof note.sourceCharacter==='string'));
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
        const outside=holdLane<=2?noteLane<holdLane:noteLane>holdLane;
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

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
