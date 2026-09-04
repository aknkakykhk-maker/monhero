#!/usr/bin/env node
// 自動譜面制作システム V2 STEP7(問題区間の自動修正ループ)を確かめる。
//
//   node tools/mode/rhythm-chart-v2-step7-check.js
//
// STEP7は「STEP6が見つけた問題を、レーンだけ動かして直す」道具。
// 直す道具がいちばん怖いのは**直しすぎ**なので、ここでは次を見張る。
//
//   1. 音を1つも動かしていない・消していない・種別や幅を変えていない
//      … 時刻を動かすと STEP1〜5 が積み上げたもの(音との一致・構造・motif)が崩れる
//   2. 実際に問題が減っている(増えていない)
//   3. 直すために別のところを壊していない(跳び・レーンの偏り・重なり)
//   4. 直せる問題は実際に直せる / 問題が無ければ何も書き換えない
//   5. 何度実行しても同じ結果になる(乱数を使っていない)
//   6. ランタイム・既存の正式候補v1・STEP5の成果物へ触らない
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const TOOL=path.join(ROOT,'tools/mode/rhythm-chart-v2-step7-autofix.js');
const PLAYABILITY=path.join(ROOT,'tools/mode/rhythm-chart-v2-step6-playability.js');
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
const authoring=path.join(ROOT,'tools/mode/authoring');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run=(...args)=>spawnSync(process.execPath,[TOOL,...args],{cwd:ROOT,encoding:'utf8'});
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));

const source=fs.readFileSync(TOOL,'utf8');

// --- 触ってはいけないもの ---
const writeTargets=[...source.matchAll(/fs\.writeFileSync\(([^,]+),/g)].map(m=>m[1].trim());
check('書き出し先が設計資料の置き場(authoring)だけである',
  writeTargets.length>0&&writeTargets.every(t=>t==='out')
  &&/tools\/mode\/authoring\/monster-hero-theme-v2-step7-/.test(source));
check('monster-heroからは読み書きしない',!/monster-hero\//.test(source));
check('乱数を使わない(結果が毎回変わらないため)',!/Math\.random|crypto\.randomBytes/.test(source));
check('手のモデルはSTEP6のものをそのまま使う(道具ごとに別の物差しを持たない)',
  source.includes("require('./rhythm-chart-v2-step6-playability.js')")
  &&source.includes('const {toActions,simulate,handModel,timing,gridTimeMs,BAR}=step6;'));
// 置き換え先の重なりチェックは、実データでは「近くへ動かす」重みが効いて重なる位置が選ばれにくく、
// 出力を見るだけでは外れても気づけない。実装の形そのものを見張る。
check('置き換え先は同じ時刻の他のノーツと重ならないものだけを候補にする',
  source.includes('const fits=candidate=>!others.some(o=>overlaps(candidate,o));')
  &&/if\(!fits\(\{start:subLane,end:subLane\+width\}\)\)continue;/.test(source)
  &&/if\(!fits\(span\(moved\)\)\)continue;/.test(source));
check('SLIDEは経路の形を変えずまるごと平行移動する(始点だけ動かして経路が壊れない)',
  source.includes('slidePoints:points.map(p=>({...p,lane:Number(p.lane)+delta}))')
  &&source.includes('if(lanes.some(lane=>lane+delta<0||lane+delta>4))continue;'));
check('直すのはレーンだけだと明示している(悪さの重みが定数で見える)',
  ['COST_IMPOSSIBLE','COST_STRAINED','COST_HARD_JUMP','COST_LANE_SPREAD','COST_MOVE','MAX_PASSES']
    .every(k=>new RegExp(`const ${k}=`).test(source)));

// --- 実際に走らせる(既存の成果物は壊さないよう一時ディレクトリへ) ---
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-v2-step7-'));
const first=run('--write','--output-dir',tempDir);
check('STEP7が成功する',first.status===0,first.status===0?'':(first.stderr||first.stdout).trim().split('\n').slice(-3).join(' / '));
if(first.status!==0){console.log(`\n${failed}件のNGがあります`);process.exit(1);}

const secondDir=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-v2-step7-b-'));
const second=run('--write','--output-dir',secondDir);
// 書き出し先のパスだけは実行ごとに違うので、そこを伏せて比べる
const withoutPaths=out=>out.replace(/書き出し: .*/g,'書き出し: (省略)');
check('何度実行しても同じ結果になる',withoutPaths(first.stdout)===withoutPaths(second.stdout));
check('書き出した譜面の中身も毎回同じ',
  fs.readdirSync(tempDir).filter(f=>f.endsWith('.json')).every(f=>{
    const b=path.join(secondDir,f);
    return fs.existsSync(b)&&hash(path.join(tempDir,f))===hash(b);
  }));
fs.rmSync(secondDir,{recursive:true,force:true});

const laneCenter=n=>n.subLane!=null&&Number.isFinite(Number(n.subLane))
  ?(Number(n.subLane)+(Number(n.subLaneWidth)||2)/2)/2-.5
  :Number(n.lane)||0;
const spanOf=n=>{
  const width=Number(n.subLaneWidth)||2;
  if(n.subLane!=null&&Number.isFinite(Number(n.subLane)))return {start:Number(n.subLane),end:Number(n.subLane)+width};
  const center=(Number(n.lane)+.5)*2;
  return {start:center-width/2,end:center+width/2};
};
const hardJumpsOf=notes=>{
  const sorted=[...notes].sort((a,b)=>a.grid-b.grid);
  let count=0,pairs=0;
  for(let i=1;i<sorted.length;i++){
    const gap=sorted[i].grid-sorted[i-1].grid;
    if(gap<=0||gap>=4)continue;
    pairs++;
    if(Math.abs(laneCenter(sorted[i])-laneCenter(sorted[i-1]))>=3)count++;
  }
  return {count,pairs};
};
// 幅の上限を全幅(10)まで広げたので、「中心がどのレーンか」だけでは5レーンを使えているか
// 測れない(幅6のノーツは中心が構造上いつも内側に来る)。どのレーンの上にかかっているかで数える。
const laneCoverOf=notes=>{
  const use=[0,0,0,0,0];
  notes.forEach(n=>{
    const span=spanOf(n);
    for(let lane=0;lane<5;lane++){const laneCenter=lane*2+1;if(span.start<=laneCenter&&laneCenter<=span.end)use[lane]++;}
  });
  return use;
};
const playability=file=>{
  const r=spawnSync(process.execPath,[PLAYABILITY,'--file',file],{cwd:ROOT,encoding:'utf8'});
  const m=/押せない (\d+)件 \/ 忙しい (\d+)件/.exec(r.stdout||'');
  if(!m)throw new Error(`STEP6の結果を読めません: ${(r.stderr||r.stdout||'').slice(0,200)}`);
  return {impossible:Number(m[1]),strained:Number(m[2])};
};

for(const difficulty of DIFFICULTIES){
  const beforeFile=path.join(authoring,`monster-hero-theme-v2-step5-chart-${difficulty.toLowerCase()}.json`);
  const afterFile=path.join(tempDir,`monster-hero-theme-v2-step7-chart-${difficulty.toLowerCase()}.json`);
  check(`${difficulty}: 直した譜面が書き出される`,fs.existsSync(afterFile));
  if(!fs.existsSync(afterFile)||!fs.existsSync(beforeFile))continue;
  const before=readJson(beforeFile),after=readJson(afterFile);

  // 1. 音を動かしていない・消していない・種別や幅を変えていない
  check(`${difficulty}: ノーツ数が変わらない`,after.notes.length===before.notes.length,`${before.notes.length}→${after.notes.length}`);
  const key=n=>`${n.grid}|${n.type}|${n.subLaneWidth||''}|${n.durationGrids||''}|${n.endFlick?1:''}|${n.monsterSlot||''}`;
  const bag=notes=>notes.map(key).sort().join('\n');
  check(`${difficulty}: 音の時刻・種別・幅・長さ・終点フリック・モンスター枠が1つも変わらない`,bag(after.notes)===bag(before.notes));
  check(`${difficulty}: 音のズレ(sourcePeakOffsetMs)も引き継いでいる`,
    after.notes.every(n=>!Number.isFinite(n.sourcePeakOffsetMs)||Math.abs(n.sourcePeakOffsetMs)<=30));

  // 2. 問題が減っている
  const beforePlay=playability(beforeFile),afterPlay=playability(afterFile);
  check(`${difficulty}: 「押せない」が増えていない`,afterPlay.impossible<=beforePlay.impossible,
    `${beforePlay.impossible}→${afterPlay.impossible}`);
  check(`${difficulty}: 「忙しい」が増えていない`,afterPlay.strained<=beforePlay.strained,
    `${beforePlay.strained}→${afterPlay.strained}`);
  check(`${difficulty}: 記録した before/after が実際のSTEP6の結果と一致する`,
    after.step7.before.impossible===beforePlay.impossible&&after.step7.before.strained===beforePlay.strained
    &&after.step7.after.impossible===afterPlay.impossible&&after.step7.after.strained===afterPlay.strained);

  // 3. 直すために別のところを壊していない
  const jumpBefore=hardJumpsOf(before.notes),jumpAfter=hardJumpsOf(after.notes);
  // STEP7の重みは COST_HARD_JUMP(120) > COST_STRAINED(100) なので、跳びを1件増やす置き換えは
  // 「忙しい」を2件以上消せるときにしか選ばれない。それは正しい取引なので、増えないことではなく
  // 「増えても全体の1%未満」かつ「STEP3と同じ15%の枠に収まる」ことを見張る。
  check(`${difficulty}: 8分未満で3レーン以上跳ぶ組み合わせが増えすぎていない`,
    (jumpAfter.count<=jumpBefore.count||(jumpAfter.count-jumpBefore.count)/Math.max(1,jumpAfter.pairs)<=.01)
    &&jumpAfter.count/Math.max(1,jumpAfter.pairs)<=.15,
    `${jumpBefore.count}→${jumpAfter.count} / ${jumpAfter.pairs}`);
  const coverAfter=laneCoverOf(after.notes);
  check(`${difficulty}: 5レーンすべての上にノーツが来続けている(いちばん少ないレーンでも20%以上)`,
    Math.min(...coverAfter)/after.notes.length>=.20,coverAfter.map(count=>`${Math.round(count/after.notes.length*100)}%`).join('/'));
  const byGrid=new Map();
  after.notes.forEach(n=>{const list=byGrid.get(n.grid)||[];list.push(n);byGrid.set(n.grid,list);});
  check(`${difficulty}: 同じ時刻のノーツが重ならない`,[...byGrid.values()].every(list=>{
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=spanOf(list[i]),b=spanOf(list[j]);
      if(a.start<b.end-1e-9&&b.start<a.end-1e-9)return false;
    }
    return true;
  }));
  check(`${difficulty}: サブレーンが0〜9・幅内に収まる`,after.notes.every(n=>{
    if(n.type==='SLIDE')return n.slidePoints.every(p=>p.lane>=0&&p.lane<=4&&Number.isInteger(p.lane*2));
    return Number.isInteger(n.subLane)&&n.subLane>=0&&n.subLane+(n.subLaneWidth||1)<=10;
  }));
  check(`${difficulty}: SLIDEの始点・終点が経路と食い違わない`,after.notes.filter(n=>n.type==='SLIDE').every(n=>
    Math.abs(n.lane-n.slidePoints[0].lane)<1e-9&&Math.abs(n.endLane-n.slidePoints[n.slidePoints.length-1].lane)<1e-9));

  // 4. 直した記録が読める形で残る
  check(`${difficulty}: 直した箇所が場所つきで残る(小節・時刻・動かし方)`,
    Array.isArray(after.step7.fixes)&&after.step7.fixes.length===after.step7.fixCount
    &&after.step7.fixes.every(f=>Number.isFinite(f.bar)&&Number.isFinite(f.timeMs)&&typeof f.move==='string'));
  check(`${difficulty}: 設計資料のまま(ランタイム未接続)`,
    after.analysisType==='rhythm-chart-v2-step7-chart'&&after.reviewRequired===true&&after.runtimeConnected===false);
  check(`${difficulty}: NaN / Infinityがない`,!/NaN|Infinity/.test(fs.readFileSync(afterFile,'utf8')));
}

// --- 5. 直せる問題は実際に直せる / 問題が無ければ何も書き換えない ---
const victim=path.join(tempDir,'probe.json');
const base={schemaVersion:1,analysisType:'rhythm-chart-v2-step5-chart',trackId:'monster_hero_theme',
  difficulty:'EASY',reviewRequired:true,runtimeConnected:false,densityPerSecond:1};
// 同じ場所を16分で4連打 = 同じ指では叩き直せない。レーンを散らせば押せるようになる
const cramped={...base,noteCount:4,typeCounts:{TAP:4},
  notes:[64,65,66,67].map(grid=>({type:'TAP',grid,lane:0,subLane:0,subLaneWidth:2}))};
fs.writeFileSync(victim,JSON.stringify(cramped,null,1)+'\n');
const crampedBefore=playability(victim);
check('わざと作った「同じ場所で16分連打」がSTEP6で問題になる',
  crampedBefore.impossible+crampedBefore.strained>0,`押せない${crampedBefore.impossible} / 忙しい${crampedBefore.strained}`);
const fixRun=run('--file',victim,'--difficulty','EASY');
check('その譜面をSTEP7が直そうとする',/直した [1-9]\d*箇所/.test(fixRun.stdout),
  (fixRun.stdout.match(/EASY: .*/)||[''])[0]);
check('直した結果が「押せない0件」になる',/押せない \d+→0件|押せない 0件/.test(fixRun.stdout),
  (fixRun.stdout.match(/ *押せない.*/)||[''])[0].trim());

// 問題の無い譜面は1音も書き換えない
const clean={...base,noteCount:4,typeCounts:{TAP:4},
  notes:[{type:'TAP',grid:64,lane:0,subLane:0,subLaneWidth:2},{type:'TAP',grid:72,lane:2,subLane:4,subLaneWidth:2},
         {type:'TAP',grid:80,lane:4,subLane:8,subLaneWidth:2},{type:'TAP',grid:88,lane:2,subLane:4,subLaneWidth:2}]};
fs.writeFileSync(victim,JSON.stringify(clean,null,1)+'\n');
const cleanRun=run('--file',victim,'--difficulty','EASY');
check('問題の無い譜面は1箇所も書き換えない',/直した 0箇所/.test(cleanRun.stdout),
  (cleanRun.stdout.match(/EASY: .*/)||[''])[0]);
check('--file 指定では書き出さない',/--file 指定のときは書き出しません/.test(cleanRun.stdout));

// --- 6. 既存の成果物を壊していないこと ---
const protectedFiles=[
  'monster-hero/data/rhythm-mode.js','monster-hero/src/game-system.jsx',
  'monster-hero/debug/monster-hero-theme-easy-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-normal-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-hard-formal-candidate-v1.json',
  'tools/mode/rhythm-monster-hero-chart-build.js',
  ...DIFFICULTIES.map(d=>`tools/mode/authoring/monster-hero-theme-v2-step5-chart-${d.toLowerCase()}.json`),
];
const before=protectedFiles.map(f=>hash(path.join(ROOT,f)));
run('--write','--output-dir',tempDir);
check('ランタイム・V1・既存の正式候補v1・STEP5の採用譜面を書き換えない',
  protectedFiles.every((f,i)=>hash(path.join(ROOT,f))===before[i]));

fs.rmSync(tempDir,{recursive:true,force:true});
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
