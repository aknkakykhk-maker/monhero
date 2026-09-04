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
  /monster-hero-v3-\$\{difficulty\.toLowerCase\(\)\}-notes/.test(pipeline)
  &&/v1 または 候補v2 の譜面まで書き換えようとしました/.test(pipeline));
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

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
