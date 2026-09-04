#!/usr/bin/env node
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');
const vm=require('vm');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const GENERATOR=path.join(ROOT,'tools/mode/rhythm-chart-v2-step3-generate.js');
const TRACK_ID='monster_hero_theme';
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
const FULL_TYPES=new Set(['TAP','HOLD','FLICK','SLIDE']);
const ALLOWED_TYPES={EASY:new Set(['TAP','HOLD']),NORMAL:new Set(['TAP','HOLD','FLICK']),HARD:FULL_TYPES,EXPERT:FULL_TYPES,MASTER:FULL_TYPES};
const CALM_SECTIONS=new Set(['INTRO','BREAK','OUTRO']);
const HOT_SECTIONS=new Set(['CHORUS','FINAL_CHORUS','BUILD','PRE_CHORUS']);

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const walk=(value,visit)=>{
  visit(value);
  if(Array.isArray(value))value.forEach(item=>walk(item,visit));
  else if(value&&typeof value==='object')Object.values(value).forEach(item=>walk(item,visit));
};

const protectedFiles=[
  'monster-hero/data/rhythm-mode.js','monster-hero/data/rhythm-authoring.js',
  'monster-hero/debug/monster-hero-theme-easy-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-normal-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-hard-formal-candidate-v1.json',
  'tools/mode/authoring/monster-hero-theme-v2-features.json',
  'tools/mode/authoring/monster-hero-theme-v2-structure.json',
].map(file=>path.join(ROOT,file));
const beforeHashes=new Map(protectedFiles.map(file=>[file,hash(file)]));

// timing・structureは、生成アルゴリズムを再実装せず「観測可能な性質」を検証するためだけに読む。
const timingContext={Object,Number,Math};
vm.createContext(timingContext);
vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA[${JSON.stringify(TRACK_ID)}];`,timingContext);
const timing=timingContext.__t;
const gridMs=timing.beatMs/timing.subdivisionsPerBeat;
const gridTimeMs=g=>timing.beatZeroMs+g*gridMs;
const BAR=timing.subdivisionsPerBeat*4;
const structure=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring/monster-hero-theme-v2-structure.json'),'utf8'));
const sections=structure.sections;
const sectionForMs=ms=>{for(const s of sections)if(ms>=s.startMs&&ms<s.endMs)return s;return sections[sections.length-1];};
const sectionTypeForGrid=grid=>sectionForMs(gridTimeMs(Math.floor(grid/BAR)*BAR)).sectionTypeCandidate;

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-v2-step3-'));
const candidates={};
try{
  const run=spawnSync(process.execPath,[GENERATOR,'--track',TRACK_ID,'--write','--output-dir',tempDir],{cwd:ROOT,encoding:'utf8',maxBuffer:4*1024*1024});
  check('STEP3生成が成功',run.status===0,run.status===0?'':(run.stderr||run.stdout).trim());

  for(const difficulty of DIFFICULTIES){
    const tempFile=path.join(tempDir,`monster-hero-theme-v2-chart-${difficulty.toLowerCase()}.json`);
    const committedFile=path.join(ROOT,`tools/mode/authoring/monster-hero-theme-v2-chart-${difficulty.toLowerCase()}.json`);
    check(`${difficulty}: STEP3出力が存在`,fs.existsSync(tempFile));
    if(!fs.existsSync(tempFile))continue;
    check(`${difficulty}: 決定的に再生成可能`,fs.readFileSync(tempFile).equals(fs.readFileSync(committedFile)));
    const candidate=JSON.parse(fs.readFileSync(tempFile,'utf8'));
    candidates[difficulty]=candidate;

    let invalidNumber=false;
    walk(candidate,value=>{if(typeof value==='number'&&!Number.isFinite(value))invalidNumber=true;});
    check(`${difficulty}: NaN / Infinityがない`,!invalidNumber&&!/NaN|Infinity/.test(fs.readFileSync(tempFile,'utf8')));
    check(`${difficulty}: STEP3スキーマ`,candidate.schemaVersion===1&&candidate.analysisType==='rhythm-chart-v2-step3-chart'&&candidate.trackId===TRACK_ID&&candidate.difficulty===difficulty);
    check(`${difficulty}: 耳確認前の設計資料のまま`,candidate.reviewRequired===true&&candidate.runtimeConnected===false);
    check(`${difficulty}: ノーツが存在する`,Array.isArray(candidate.notes)&&candidate.notes.length>0);
    check(`${difficulty}: noteCount・typeCountsが実ノーツ数と一致`,candidate.noteCount===candidate.notes.length&&Object.values(candidate.typeCounts).reduce((a,b)=>a+b,0)===candidate.notes.length);
    check(`${difficulty}: 使用ノーツ種別は難易度で許可された範囲内`,Object.keys(candidate.typeCounts).every(type=>ALLOWED_TYPES[difficulty].has(type)));
    check(`${difficulty}: サブレーンが0〜9・幅内に収まる`,candidate.notes.every(n=>{
      if(n.type==='SLIDE')return n.slidePoints.every(p=>p.lane>=0&&p.lane<=4);
      return typeof n.subLane==='number'&&n.subLane>=0&&n.subLane+(n.subLaneWidth||1)<=10;
    }));
    check(`${difficulty}: 採用ノーツの音ズレは±30ms以内`,candidate.notes.every(n=>!finite(n.sourcePeakOffsetMs)||Math.abs(n.sourcePeakOffsetMs)<=30));

    // --- 仕上がりの点検(2026-09-04)で見つけた欠点を見張る ---
    // レーンは幅の中心で見る(lane はいちばん左のレーンなので、幅広ノーツが左に見える)
    const center=n=>n.subLane!=null?(n.subLane+(n.subLaneWidth||2)/2)/2-.5:Number(n.lane)||0;
    // 幅の上限を全幅(10)まで広げたので、「ノーツの中心がどのレーンか」だけでは
    // 5レーンを使えているか測れない。幅6のノーツは中心が必ず内側へ寄り、
    // 端のレーンに中心が来ることが構造上ありえないため。
    // ここでは(1)その幅がどのレーンの上にかかっているか(カバー率)と、
    // (2)幅3以下の細いノーツの中心の散らばり、の両方を見る。
    // (2)が「レーン歩きが壊れていないか」(以前レーン1に1音も来なかった不具合)の見張り。
    const laneCover=[0,0,0,0,0],narrowShare=[0,0,0,0,0];
    let spanNotes=0,narrowNotes=0;
    candidate.notes.forEach(n=>{
      if(n.type==='SLIDE'||n.subLane==null)return;
      spanNotes++;
      const width=Number(n.subLaneWidth)||2,start=Number(n.subLane);
      for(let lane=0;lane<5;lane++){const laneCenter=lane*2+1;if(start<=laneCenter&&laneCenter<=start+width)laneCover[lane]++;}
      if(width<=3){narrowNotes++;narrowShare[Math.max(0,Math.min(4,Math.round(center(n))))]++;}
    });
    check(`${difficulty}: 5レーンすべての上にノーツが来る(いちばん少ないレーンでも20%以上)`,
      spanNotes>0&&Math.min(...laneCover)/spanNotes>=.20,laneCover.map(count=>`${Math.round(count/Math.max(1,spanNotes)*100)}%`).join('/'));
    check(`${difficulty}: 細いノーツ(幅3以下)の中心も5レーンへ散る(いちばん少ないレーンでも12%。以前はレーン1に1音も無かった)`,
      narrowNotes>=20&&Math.min(...narrowShare)/narrowNotes>=.12,narrowShare.join('/'));
    let hardJumps=0,pairs=0;
    for(let i=1;i<candidate.notes.length;i++){
      const dg=candidate.notes[i].grid-candidate.notes[i-1].grid;
      if(dg<=0||dg>=timing.subdivisionsPerBeat)continue;
      pairs++;
      if(Math.abs(center(candidate.notes[i])-center(candidate.notes[i-1]))>=3)hardJumps++;
    }
    check(`${difficulty}: 8分未満の間隔で3レーン以上跳ぶ組み合わせが15%以下(以前はEXPERT以上で0↔4の往復ばかりだった)`,
      pairs===0||hardJumps/pairs<=.15,`${hardJumps}/${pairs}`);
    check(`${difficulty}: 小節ごとの上限は盛り上がりの連続値から決めている`,candidate.policy.perBarCap==='intensity-curve');

    // --- 幅の割り当て(2026-09-04の実機指摘への対応) ---
    // 「ノーツは大きいほど簡単・細いほど難しい」ので、半ノーツ(幅1)は高難易度へ寄せる。
    const widths={};
    candidate.notes.forEach(n=>{const w=Number(n.subLaneWidth)||2;widths[w]=(widths[w]||0)+1;});
    // 区切りの一発(sectionAccent)だけは、その難易度のふつうの幅より広い accentWidth を使う。
    check(`${difficulty}: 幅は難易度で決めた範囲＋区切りの一発の幅だけを使う`,
      Object.keys(widths).every(w=>candidate.policy.widths.includes(Number(w))||Number(w)===candidate.policy.accentWidth),
      Object.entries(widths).map(([w,c])=>`幅${w}:${c}`).join(' / '));
    check(`${difficulty}: 区切りの一発はふつうの幅より広い`,
      candidate.policy.accentWidth>Math.max(...candidate.policy.widths),
      `${candidate.policy.accentWidth} > ${Math.max(...candidate.policy.widths)}`);
    const accents=candidate.notes.filter(n=>n.sectionAccent);
    check(`${difficulty}: 区切りの一発は数を絞る(上限内で、譜面全体の3%以下)`,
      accents.length>0&&accents.length<=candidate.policy.accentMaxCount&&accents.length/candidate.notes.length<=.03,
      `${accents.length}個 / 上限${candidate.policy.accentMaxCount}`);
    check(`${difficulty}: 区切りの一発はすべてアクセント幅で、同じ時刻に他のノーツが無い`,
      accents.every(n=>Number(n.subLaneWidth)===candidate.policy.accentWidth
        &&!candidate.notes.some(o=>o!==n&&o.grid===n.grid)));
    // HOLDの途中で幅が変わる形(2026-09-04の実機指摘「途中から広がったり小さくなったりもほしい」)
    const tapers=candidate.notes.filter(n=>Array.isArray(n.holdPoints));
    check(`${difficulty}: 押さえている途中で幅が変わるHOLDがある`,tapers.length>=3,
      `${tapers.length}本 / ${[...new Set(tapers.map(n=>n.holdTaper))].join(' ')}`);
    check(`${difficulty}: 幅が変わるHOLDの点は時刻順で、幅・位置がレーン内に収まる`,
      tapers.every(n=>n.holdPoints.length>=2
        &&n.holdPoints.every((point,index)=>index===0||point.grid>n.holdPoints[index-1].grid)
        &&n.holdPoints[0].grid===n.grid
        &&n.holdPoints[n.holdPoints.length-1].grid===n.grid+n.durationGrids
        &&n.holdPoints.every(point=>candidate.policy.widths.includes(point.subLaneWidth)
          &&point.subLane>=0&&point.subLane+point.subLaneWidth<=10)));
    check(`${difficulty}: 幅が変わるHOLDは実際に太さが変わる(同じ幅を並べただけにしない)`,
      tapers.every(n=>new Set(n.holdPoints.map(point=>point.subLaneWidth)).size>=2));
    if(['EASY','NORMAL'].includes(difficulty)){
      check(`${difficulty}: 半ノーツ(幅1)を出さない(低い難易度では難しい側の幅を使わない)`,!widths[1]);
      check(`${difficulty}: 幅が1種類だけにならない(大きさのバリエーションがある)`,
        Object.keys(widths).length>=2,`${Object.keys(widths).length}種類`);
    }else{
      check(`${difficulty}: 半ノーツ(幅1)を使う(高い難易度の難しさとして)`,widths[1]>0,`${widths[1]||0}個`);
    }
    // 種類ごとに大きさが固定されていないこと(以前はFLICKが必ず幅1だった)
    for(const type of ['TAP','FLICK']){
      const ofType=candidate.notes.filter(n=>n.type===type);
      if(ofType.length<8)continue;
      check(`${difficulty}: ${type}の大きさが1種類に固定されていない`,
        new Set(ofType.map(n=>Number(n.subLaneWidth)||2)).size>=2,
        [...new Set(ofType.map(n=>Number(n.subLaneWidth)||2))].sort().join('/'));
    }
    check(`${difficulty}: 候補源の補充は静かな区間(INTRO/BREAK/OUTRO)には入らない`,
      candidate.notes.filter(n=>n.supplementedFrom).every(n=>!CALM_SECTIONS.has(sectionTypeForGrid(n.grid))));
    // 補充で「弱い音を敷き詰めない」ことの確認。以前は絶対値0.4で見ていたが、候補源ごとに
    // 強さの尺度が違う(normalは最小0.60 / denseは最小0.30 / step1は最小0.197)ため、
    // 同じ0.4がdenseでは下位1割・step1では下位7割を落とす別物の条件になっていた。
    // いまはその源の中の順位(下位10%)で切るので、こちらもその源ごとの下限で確かめる。
    const floors=candidate.policy&&candidate.policy.supplementFloorBySource;
    check(`${difficulty}: 補充の下限が候補源ごとに記録されている`,
      !!floors&&['normal','dense','step1'].every(k=>Number.isFinite(floors[k])&&floors[k]>0));
    if(floors){
      check(`${difficulty}: 補充した音はその候補源の下位10%より強い(弱い音で埋めない)`,
        candidate.notes.filter(n=>n.supplementedFrom).every(n=>n.sourceStrength>=floors[n.supplementedFrom]-.005),
        Object.entries(floors).map(([k,v])=>`${k}${v.toFixed(2)}`).join(' / '));
    }
    const slides=candidate.notes.filter(n=>n.type==='SLIDE');
    if(slides.length>=4)check(`${difficulty}: SLIDEの形が3種類以上(以前は全部同じ形だった)`,
      new Set(slides.map(n=>n.slideShape)).size>=3,[...new Set(slides.map(n=>n.slideShape))].join('/'));
    if(slides.length)check(`${difficulty}: SLIDEの経路が0〜4レーン・0.5刻みに収まる`,
      slides.every(n=>n.slidePoints.every(p=>p.lane>=0&&p.lane<=4&&Number.isInteger(p.lane*2))));
    const holds=candidate.notes.filter(n=>n.type==='HOLD');
    if(holds.length>=4)check(`${difficulty}: HOLDの長さが2種類以上`,new Set(holds.map(n=>n.durationGrids)).size>=2);
    // 3本目の指が要る配置(長いノーツを押さえている最中に、同じ時刻へ他のノーツが2つ以上)
    const longNotes=candidate.notes.filter(n=>n.type==='HOLD'||n.type==='SLIDE');
    const byGridCount=new Map();
    candidate.notes.forEach(n=>byGridCount.set(n.grid,(byGridCount.get(n.grid)||0)+1));
    let threeFingers=0;
    for(const [grid,count] of byGridCount){
      const active=longNotes.filter(l=>l.grid<grid&&l.grid+(Number(l.durationGrids)||0)>=grid).length;
      if(active+count>2)threeFingers++;
    }
    check(`${difficulty}: 3本目の指が要る配置を作らない(HOLD/SLIDE中の同時押し)`,threeFingers===0,`${threeFingers}箇所`);
    // --- 終点フリック(HOLD / SLIDEの終わりでフリックして離す) ---
    const endFlickNotes=candidate.notes.filter(n=>n.endFlick!==undefined);
    check(`${difficulty}: 終点フリックはtrueだけを書く(falseや0を書き散らかさない)`,
      endFlickNotes.every(n=>n.endFlick===true));
    check(`${difficulty}: 終点フリックが付くのはHOLD / SLIDEだけ`,
      endFlickNotes.every(n=>n.type==='HOLD'||n.type==='SLIDE'));
    check(`${difficulty}: 終点フリックの数が方針の上限内`,
      endFlickNotes.length<=candidate.policy.endFlickMaxCount,
      `${endFlickNotes.length}件 / 上限${candidate.policy.endFlickMaxCount}件`);
    // 弾いたあと指を戻す時間が要るので、終端の前後に決めたぶんの余裕が空いていること。
    // ここが崩れると「押せない譜面」を自動で作ってしまう。
    check(`${difficulty}: 終点フリックの終端の前後に決めた余裕がある`,(()=>{
      const gap=candidate.policy.endFlickMinGapGrids;
      if(!Number.isFinite(gap))return false;
      return endFlickNotes.every(note=>{
        const endGrid=note.grid+(Number(note.durationGrids)||0);
        return !candidate.notes.some(o=>o!==note&&Math.abs(o.grid-endGrid)<gap);
      });
    })(),`余裕${candidate.policy.endFlickMinGapGrids}グリッド`);
    // 上の検査はpolicyの値を使うので、policy自体が緩んだら気づけない。最低ラインは固定で見る。
    check(`${difficulty}: 終点フリックの余裕は最低でも1拍(4グリッド)ある`,
      candidate.policy.endFlickMinGapGrids>=4);
    check(`${difficulty}: motif統計の範囲が妥当`,candidate.motif&&candidate.motif.phrasesApplied<=candidate.motif.phrasesTotal&&candidate.motif.notesGrounded<=candidate.motif.notesAttempted&&candidate.motif.phrasesTotal>=1);

    if(['EASY','NORMAL','HARD'].includes(difficulty)){
      check(`${difficulty}: 同時押しを使わない難易度`,!candidate.notes.some(n=>n.chordWithGrid!=null)&&candidate.chordCount===0);
    }else{
      const chordNotes=candidate.notes.filter(n=>n.chordWithGrid!=null);
      check(`${difficulty}: 同時押しを使っている`,chordNotes.length>0&&candidate.chordCount===chordNotes.length);
      check(`${difficulty}: 同時押しは既存ノーツと同じ時刻に、離れたレーンで発生する(新しい時刻を作らない)`,chordNotes.every(n=>{
        const base=candidate.notes.find(o=>o.grid===n.chordWithGrid&&o!==n&&o.type==='TAP');
        if(!base)return false;
        const baseStart=base.subLane,baseWidth=base.subLaneWidth||1;
        return n.subLane+n.subLaneWidth<=baseStart||baseStart+baseWidth<=n.subLane;
      }));
    }
  }
}finally{
  fs.rmSync(tempDir,{recursive:true,force:true});
}

const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
for(const difficulty of ['HARD','EXPERT','MASTER']){
  const candidate=candidates[difficulty];
  if(!candidate)continue;
  // 構造(section種別)が実際に密度へ反映されているかを、生成済みノーツ自体から検証する
  // （アルゴリズムを再実装せず、出力結果の性質として確認する）。
  const notesByBar=new Map();
  for(const n of candidate.notes){
    const bar=Math.floor(n.grid/BAR);
    notesByBar.set(bar,(notesByBar.get(bar)||0)+1);
  }
  const calmBars=[],hotBars=[];
  for(const [bar,count] of notesByBar){
    const type=sectionTypeForGrid(bar*BAR);
    if(CALM_SECTIONS.has(type))calmBars.push(count);
    else if(HOT_SECTIONS.has(type))hotBars.push(count);
  }
  check(`${difficulty}: INTRO/BREAK/OUTRO区間の小節あたりノーツ数を計測できた`,calmBars.length>=2,`${calmBars.length}小節`);
  check(`${difficulty}: CHORUS/FINAL_CHORUS区間の小節あたりノーツ数を計測できた`,hotBars.length>=2,`${hotBars.length}小節`);
  check(`${difficulty}: 盛り上がり区間のほうが静かな区間より密度が高い(構造がgeneration ruleへ反映されている)`,mean(hotBars)>mean(calmBars),`静か${mean(calmBars).toFixed(2)} / 盛り上がり${mean(hotBars).toFixed(2)}`);
  check(`${difficulty}: 盛り上がり区間は静かな区間の1.8倍以上の密度(差がはっきり出ている)`,
    mean(hotBars)>=mean(calmBars)*1.8,`${(mean(hotBars)/Math.max(1e-9,mean(calmBars))).toFixed(2)}倍`);
  // サビの終盤(FINAL_CHORUS)が、ふつうのサビより薄くならない(以前は全難易度で薄かった)。
  const barsOfType=type=>{
    const counts=new Map();
    for(const n of candidates[difficulty].notes){const bar=Math.floor(n.grid/BAR);if(sectionTypeForGrid(bar*BAR)===type)counts.set(bar,(counts.get(bar)||0)+1);}
    return [...counts.values()];
  };
  const chorus=mean(barsOfType('CHORUS')),finalChorus=mean(barsOfType('FINAL_CHORUS'));
  check(`${difficulty}: サビの終盤(FINAL_CHORUS)がふつうのサビ(CHORUS)の9割を下回らない`,
    finalChorus>=chorus*.9,`CHORUS ${chorus.toFixed(2)} / FINAL ${finalChorus.toFixed(2)} 音/小節`);
}

if(DIFFICULTIES.every(d=>candidates[d])){
  check('難易度が上がるほどノーツ数が増える(EASY<NORMAL<HARD<EXPERT<MASTER)',
    DIFFICULTIES.every((d,i)=>i===0||candidates[DIFFICULTIES[i-1]].noteCount<candidates[d].noteCount));
  check('難易度が上がるほど密度(ノーツ毎秒)も増える',
    DIFFICULTIES.every((d,i)=>i===0||candidates[DIFFICULTIES[i-1]].densityPerSecond<candidates[d].densityPerSecond));
  // 半ノーツ(幅1)の割合は難易度が上がるほど増える。「細いほど難しい」ため。
  const narrowShare=d=>candidates[d].notes.filter(n=>(Number(n.subLaneWidth)||2)===1).length/candidates[d].noteCount;
  check('半ノーツ(幅1)の割合が難易度順に増える(低い難易度ほど大きいノーツ)',
    DIFFICULTIES.every((d,i)=>i===0||narrowShare(DIFFICULTIES[i-1])<=narrowShare(d)+1e-9),
    DIFFICULTIES.map(d=>`${d} ${(narrowShare(d)*100).toFixed(0)}%`).join(' / '));
  check('難易度ごとの半ノーツの割合が、決めた上限(narrowRate)を超えない',
    DIFFICULTIES.every(d=>narrowShare(d)<=candidates[d].policy.narrowRate+.05),
    DIFFICULTIES.map(d=>`${d} ${(narrowShare(d)*100).toFixed(0)}%/${(candidates[d].policy.narrowRate*100).toFixed(0)}%`).join(' / '));
  // 実機で「全体的にノーツが少なくて退屈」と言われたので、v1(人が確認した譜面)より多いことを見る
  const V1_DENSITY={EASY:1.22,NORMAL:1.45,HARD:1.80};
  check('EASY / NORMAL / HARD は既存の正式候補v1より密度が高い(薄い譜面へ戻らない)',
    Object.entries(V1_DENSITY).every(([d,v])=>candidates[d].densityPerSecond>v),
    Object.entries(V1_DENSITY).map(([d,v])=>`${d} ${candidates[d].densityPerSecond}>${v}`).join(' / '));
  const endFlickCount=d=>candidates[d].notes.filter(n=>n.endFlick===true).length;
  check('EASYには終点フリックを出さない(FLICK自体を使わない難易度のため)',endFlickCount('EASY')===0);
  check('NORMAL以上には終点フリックが実際に出ている',
    DIFFICULTIES.slice(1).every(d=>endFlickCount(d)>0),
    DIFFICULTIES.map(d=>`${d}:${endFlickCount(d)}`).join(' / '));
  check('難易度が上がるほど終点フリックも減らない',
    DIFFICULTIES.every((d,i)=>i===0||endFlickCount(DIFFICULTIES[i-1])<=endFlickCount(d)));
  check('HOLDとSLIDEの両方に終点フリックが付く難易度がある(片方だけに偏っていない)',
    DIFFICULTIES.some(d=>{
      const kinds=new Set(candidates[d].notes.filter(n=>n.endFlick===true).map(n=>n.type));
      return kinds.has('HOLD')&&kinds.has('SLIDE');
    }));
}

if(candidates.EXPERT&&candidates.MASTER){
  const features=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring/monster-hero-theme-v2-features.json'),'utf8'));
  const bandsAt=grid=>{
    const ms=gridTimeMs(grid);
    let nearest=null,bestDist=Infinity;
    for(const w of features.timeline){const d=Math.abs(w.centerMs-ms);if(d<bestDist){bestDist=d;nearest=w;}}
    return nearest?nearest.frequencyBands:null;
  };
  for(const difficulty of['EXPERT','MASTER']){
    const chordNotes=candidates[difficulty].notes.filter(n=>n.chordWithGrid!=null);
    check(`${difficulty}: 同時押しは低域・高域が同時に立ち上がった瞬間だけに発生する`,
      chordNotes.every(n=>{const bands=bandsAt(n.chordWithGrid);return bands&&bands.low.attack>=.6&&bands.high.attack>=.6;}));
  }
}

check('V1・STEP1・STEP2の既存出力を変更していない',protectedFiles.every(file=>hash(file)===beforeHashes.get(file)));
// STEP6(両手の指のシミュレート)で「押せない」が0件。生成の段階で3本指の配置を作らないため。
const step6=spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-chart-v2-step6-playability.js'),'--source','step3'],{cwd:ROOT,encoding:'utf8'});
check('STEP6の両手シミュレートで「押せない」が0件(全難易度)',step6.status===0,
  (step6.stdout.match(/(EASY|NORMAL|HARD|EXPERT|MASTER): .*/g)||[]).map(l=>l.replace(/\s+/g,' ')).join(' / '));

const sourceText=fs.readFileSync(GENERATOR,'utf8');
check('V1ジェネレータ本体を読み込んでいない(完全に独立した実装)',!sourceText.includes("require(")||!/require\([^)]*rhythm-monster-hero-chart-build/.test(sourceText));
check('rhythm-mode.jsへ書き込まない(ランタイム未接続)',!sourceText.includes("'monster-hero/data/rhythm-mode.js'"));
check('ゲームruntime・保存・ランキングへ接続しない',!sourceText.includes('localStorage')&&!sourceText.includes('mh_')&&!sourceText.includes('supabase'));
check('構造入力(STEP1/STEP2)を読み込んでいる',sourceText.includes('rhythm-chart-v2-step1-features')&&sourceText.includes('rhythm-chart-v2-step2-structure'));
check('セクション種別による段調整を実装している',sourceText.includes('SECTION_TIER_ADJUST')&&sourceText.includes('sectionTierAdjust'));
check('反復フレーズのmotif接地を実装している',sourceText.includes('repeatedFromPhraseId')&&sourceText.includes('motifNotesGrounded'));
check('EXPERT/MASTERはSTEP1のonsetイベントを候補源にしている(新しい音源解析を増やさない)',sourceText.includes('candidatesFromStep1Onsets')&&sourceText.includes("candidateSource:'step1'"));
check('同時押し(chord)は新しい時刻を作らず既存ノーツの分割として実装している',sourceText.includes('chordWithGrid')&&sourceText.includes('bandsAt'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
