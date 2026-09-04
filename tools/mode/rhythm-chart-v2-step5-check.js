#!/usr/bin/env node
// 自動譜面制作システム V2 STEP5(複数候補・自動批評)を確かめる。
//
//   node tools/mode/rhythm-chart-v2-step5-check.js
//
// STEP5は「作り方を変えた候補を複数作り、機械的に採点して選ぶ」道具。
// ここで見張るのは次の4点。
//
//   1. 何度実行しても同じ順位・同じ採用になる(乱数を使っていない)
//   2. 採点が実際に働いている(全案が同点にならない・順位と点数が矛盾しない)
//   3. 「効いていない候補」を別案として数えていない(6/8などと正直に出る)
//   4. ランタイム・既存譜面・V1へ一切触っていない
const fs=require('fs');
const os=require('os');
const path=require('path');
const crypto=require('crypto');
const vm=require('vm');
const {spawnSync}=require('child_process');

const ROOT=path.resolve(__dirname,'..','..');
const REVIEWER=path.join(ROOT,'tools/mode/rhythm-chart-v2-step5-review.js');
const GENERATOR=path.join(ROOT,'tools/mode/rhythm-chart-v2-step3-generate.js');
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// --- 触ってはいけないものが変わっていないこと ---
// STEP5は設計資料を作るだけの道具で、ゲーム側・既存の正式候補・V1生成器へは接続しない。
const source=fs.readFileSync(REVIEWER,'utf8');
// 「monster-hero が出てこない」ではなく「書き出し先が設計資料の置き場だけ」を見る。
// BPM・グリッドの読み取りで monster-hero/data/rhythm-timing.js を読むのは正しい使い方なので、
// 名前の有無ではなく writeFileSync の行き先そのものを確かめる。
const writeTargets=[...source.matchAll(/fs\.writeFileSync\(([^,]+),/g)].map(m=>m[1].trim());
check('書き出し先が設計資料の置き場(authoring)だけである',
  writeTargets.length>0&&writeTargets.every(t=>t==='out'),
  writeTargets.join(' / '));
check('書き出し先の組み立てにoutputPrefixとauthoringだけを使う',
  /outputPrefix:'tools\/mode\/authoring\//.test(source)
  &&!/writeFileSync\([^)]*monster-hero/.test(source));
check('monster-heroからは読み取りしかしない(BPM・グリッドのみ)',
  [...source.matchAll(/monster-hero\/[^'`\s]+/g)].map(m=>m[0]).every(p=>p==='monster-hero/data/rhythm-timing.js'));
check('出力はreviewRequired/runtimeConnectedを持つ設計資料である',
  source.includes('reviewRequired:true')&&source.includes('runtimeConnected:false'));
// 説明文にV1の名前が出るのは構わない(触らないと書いてある)。実際に起動しないことを見る。
check('V1生成器を起動しない(V2 STEP3の生成器とSTEP6の検査だけを使う)',
  source.includes("const GENERATOR=path.join(ROOT,'tools/mode/rhythm-chart-v2-step3-generate.js');")
  &&source.includes("const PLAYABILITY=path.join(ROOT,'tools/mode/rhythm-chart-v2-step6-playability.js');")
  &&[...source.matchAll(/spawnSync\(process\.execPath,\[([^,\]]+)/g)].every(m=>['GENERATOR','PLAYABILITY'].includes(m[1].trim())));
check('乱数を使わない(順位が毎回変わらないため)',
  !/Math\.random|crypto\.randomBytes/.test(source));
// 格子(16分か8分か)は難易度の設計そのもの。案として動かすと、HARD以上で16分の無い譜面が勝ってしまう。
check('候補の作り分けで格子(latticeGrids)を変えない',
  !/const VARIANTS=Object\.freeze\(\[[\s\S]*?\]\);/.exec(source)[0].includes('latticeGrids'));
check('生成器の既定値は生成器自身から読む(写しを持たない)',
  source.includes("'--print-profiles'")&&!/const PROFILE_DEFAULTS=Object\.freeze\(\{\s*EASY:\{perBar/.test(source));

// --- 生成器の上書き口が「既定を変えない」こと ---
// STEP5は生成器へ --profile-override を渡す。既定(上書きなし)の出力が変わってしまうと
// STEP3の決定性が壊れるので、ここでも直接確かめる。
const genSource=fs.readFileSync(GENERATOR,'utf8');
// 曲のタイプ(2026-09-05)を足したので、上書きが乗る土台は「素の PROFILES」ではなく
// 「曲のタイプを効かせたあとの tuned」になった。--print-profiles も tuned を出すので、
// STEP5の案は曲の性格の上に積まれる(素の値へ戻してしまうと、案を作った瞬間に性格が消える)。
check('上書き口は既定では何もしない',
  genSource.includes("const raw=arg('--profile-override',null);")
  &&genSource.includes("if(!raw)return null;")
  &&genSource.includes('const tuned=applySongType(difficulty,PROFILES[difficulty]);')
  &&genSource.includes('profileOverride&&profileOverride[difficulty]?Object.freeze({...tuned,...profileOverride[difficulty]}):tuned'));
check('--print-profiles は曲のタイプを効かせたあとの値を出す',
  genSource.includes('applySongType(id,PROFILES[id])'));
check('上書きできるのは作り方の数値だけ(levelなど出力の意味づけは拒む)',
  genSource.includes('OVERRIDABLE_KEYS')&&!/OVERRIDABLE_KEYS=Object\.freeze\(new Set\(\[[^\]]*'level'/.test(genSource));

// --- 実際に走らせて確かめる ---
const run=(...args)=>spawnSync(process.execPath,[REVIEWER,...args],{cwd:ROOT,encoding:'utf8'});
const first=run();
check('STEP5が成功する',first.status===0,first.status===0?'':(first.stderr||first.stdout).trim().split('\n').slice(-3).join(' / '));
if(first.status!==0){console.log(`\n${failed}件のNGがあります`);process.exit(1);}

const second=run();
check('何度実行しても同じ結果になる(乱数を使っていない)',first.stdout===second.stdout);

// --- 講評JSONの中身 ---
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-v2-step5-check-'));
const before=new Map();
const authoring=path.join(ROOT,'tools/mode/authoring');
for(const file of fs.readdirSync(authoring))before.set(file,hash(path.join(authoring,file)));

const written=run('--write');
check('--write が成功する',written.status===0,written.status===0?'':(written.stderr||'').trim());

const reviewFile=path.join(authoring,'monster-hero-theme-v2-step5-review.json');
check('講評JSONが書き出される',fs.existsSync(reviewFile));
if(fs.existsSync(reviewFile)){
  const review=JSON.parse(fs.readFileSync(reviewFile,'utf8'));
  check('講評のスキーマ',review.schemaVersion===1&&review.analysisType==='rhythm-chart-v2-step5-review'
    &&review.trackId==='monster_hero_theme'&&review.reviewRequired===true&&review.runtimeConnected===false);
  check('採点の重みの合計が1.0',
    Math.abs(Object.values(review.weights).reduce((a,b)=>a+b,0)-1)<1e-9,
    Object.values(review.weights).reduce((a,b)=>a+b,0).toFixed(4));
  check('5難易度すべてに講評がある',DIFFICULTIES.every(d=>review.difficulties[d]));

  for(const difficulty of DIFFICULTIES){
    const entry=review.difficulties[difficulty];
    if(!entry)continue;
    const cands=entry.candidates||[];
    check(`${difficulty}: 全候補が採点されている`,cands.length>=2&&cands.every(c=>typeof c.score==='number'&&Number.isFinite(c.score)));
    // 難易度の順を守るために外した案(excludedByOrdering)を除けば、採用案が最高得点。
    const excluded=new Set([...(entry.excludedByOrdering||[]),...(entry.excludedByPlayability||[])]);
    const inPlay=cands.filter(c=>!excluded.has(c.variant));
    check(`${difficulty}: 難易度の順を守る案の中で、採用案が最高得点である`,
      inPlay.length>0&&Math.abs(Math.max(...inPlay.map(c=>c.score))-(cands.find(c=>c.variant===entry.winner)||{}).score)<1e-9,
      `採用${entry.winner}${excluded.size?` / 順のため対象外: ${[...excluded].join(',')}`:''}`);
    check(`${difficulty}: 難易度の順を守れたかを記録している`,typeof entry.orderingKept==='boolean'&&Array.isArray(entry.excludedByOrdering)&&Array.isArray(entry.excludedByPlayability));
    check(`${difficulty}: 候補ごとにSTEP6(押せるか)の結果を持つ`,cands.every(c=>c.playability&&Number.isInteger(c.playability.impossible)&&Number.isInteger(c.playability.strained)));
    check(`${difficulty}: 採用案はSTEP6で「押せない」0件`,(cands.find(c=>c.variant===entry.winner)||{}).playability?.impossible===0);
    check(`${difficulty}: 難易度の順を守る案が1つは残る`,entry.orderingKept===true);
    check(`${difficulty}: 採用案は「効いていない候補」ではない`,
      (cands.find(c=>c.variant===entry.winner)||{}).duplicateOf==null);
    // 全案が同点なら採点が働いていない
    const scores=cands.map(c=>c.score);
    check(`${difficulty}: 採点が案を区別できている(全案同点ではない)`,
      Math.max(...scores)-Math.min(...scores)>1e-6,
      `最高${Math.max(...scores).toFixed(3)} / 最低${Math.min(...scores).toFixed(3)}`);
    check(`${difficulty}: 実際に違う譜面になった案の数を正直に数えている`,
      entry.distinctCandidates>=1&&entry.distinctCandidates<=entry.totalVariants
      &&entry.distinctCandidates===cands.filter(c=>c.duplicateOf==null).length,
      `${entry.distinctCandidates}/${entry.totalVariants}`);
    // 同じ譜面なら点も同じでなければ、採点が譜面以外のものを見てしまっている
    const byVariant=new Map(cands.map(c=>[c.variant,c]));
    check(`${difficulty}: 同じ譜面の案は同じ点になる(採点が譜面だけを見ている)`,
      cands.filter(c=>c.duplicateOf).every(c=>Math.abs(c.score-byVariant.get(c.duplicateOf).score)<1e-9));

    const chartFile=path.join(authoring,`monster-hero-theme-v2-step5-chart-${difficulty.toLowerCase()}.json`);
    check(`${difficulty}: 採用案の譜面が書き出される`,fs.existsSync(chartFile));
    if(fs.existsSync(chartFile)){
      const chart=JSON.parse(fs.readFileSync(chartFile,'utf8'));
      check(`${difficulty}: 採用案の譜面が設計資料のまま`,
        chart.analysisType==='rhythm-chart-v2-step5-chart'&&chart.reviewRequired===true&&chart.runtimeConnected===false);
      check(`${difficulty}: どの案を採用したかが譜面に残る`,
        chart.step5&&chart.step5.variant===entry.winner&&Number.isFinite(chart.step5.score));
      check(`${difficulty}: ノーツ数が講評と一致`,chart.noteCount===(byVariant.get(entry.winner)||{}).noteCount);
      check(`${difficulty}: NaN / Infinityがない`,!/NaN|Infinity/.test(fs.readFileSync(chartFile,'utf8')));
    }
  }
}

// --- 採用した譜面どうしで、難易度の順が守られていること ---
// 以前は MASTER に EXPERT よりノーツが少なく16分も無い案を採用していた。
(()=>{
  const adopted=DIFFICULTIES.map(d=>{
    const file=path.join(authoring,`monster-hero-theme-v2-step5-chart-${d.toLowerCase()}.json`);
    return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
  });
  if(adopted.some(c=>!c))return;
  const minGap=chart=>{let m=Infinity;for(let i=1;i<chart.notes.length;i++){const g=chart.notes[i].grid-chart.notes[i-1].grid;if(g>0&&g<m)m=g;}return m;};
  check('採用譜面のノーツ数が EASY<NORMAL<HARD<EXPERT<MASTER',
    adopted.every((c,i)=>i===0||adopted[i-1].noteCount<c.noteCount),adopted.map(c=>c.noteCount).join(' < '));
  check('採用譜面の密度(毎秒)も難易度順に増える',
    adopted.every((c,i)=>i===0||adopted[i-1].densityPerSecond<c.densityPerSecond),adopted.map(c=>c.densityPerSecond).join(' < '));
  check('採用譜面の最小の間隔は難易度が上がるほど粗くならない(上の難易度で16分が消えない)',
    adopted.every((c,i)=>i===0||minGap(c)<=minGap(adopted[i-1])),adopted.map(c=>minGap(c)).join(' ≥ '));
  check('EXPERT / MASTER の採用譜面には16分(隣り合うグリッド)がある',
    minGap(adopted[3])===1&&minGap(adopted[4])===1);
  // 区間ごとにも順を守る(静かな区間だけEASYより薄いNORMAL、を作らない)
  const timingContext={Object,Number,Math};
  vm.createContext(timingContext);
  vm.runInContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-timing.js'),'utf8')}\nthis.__t=RHYTHM_TIMING_DATA['monster_hero_theme'];`,timingContext);
  const timing=timingContext.__t,gridMs=timing.beatMs/timing.subdivisionsPerBeat,BAR=timing.subdivisionsPerBeat*4;
  const structure=JSON.parse(fs.readFileSync(path.join(authoring,'monster-hero-theme-v2-structure.json'),'utf8'));
  const typeAt=grid=>{const ms=timing.beatZeroMs+grid*gridMs;return (structure.sections.find(x=>ms>=x.startMs&&ms<x.endMs)||{}).sectionTypeCandidate||'?';};
  // 区間の全小節で割る(音の無い小節も数える)。STEP5本体と同じ許容幅: 8小節以上の区間だけ、0.35音か20%の大きいほう
  const sectionBars=new Map();
  {const endMs=Math.max(...structure.sections.map(x=>x.endMs));for(let bar=0;timing.beatZeroMs+bar*BAR*gridMs<endMs;bar++){const t=typeAt(bar*BAR+BAR/2);if(t!=='?')sectionBars.set(t,(sectionBars.get(t)||0)+1);}}
  const density=chart=>{const c=new Map();for(const n of chart.notes){const t=typeAt(Math.floor(n.grid/BAR)*BAR+BAR/2);c.set(t,(c.get(t)||0)+1);}return Object.fromEntries([...sectionBars].map(([t,total])=>[t,(c.get(t)||0)/total]));};
  const longSections=[...sectionBars].filter(([,n])=>n>=8).map(([t])=>t);
  check('採用譜面は、8小節以上あるどの区間でも1つ下の難易度より薄くならない(許容: 小節あたり0.35音か20%)',
    adopted.every((c,i)=>i===0||longSections.every(t=>{const v=density(adopted[i-1])[t]||0;return (density(c)[t]||0)>=v-Math.max(.35,v*.2)-1e-9;})),
    adopted.map(c=>{const d=density(c);return ['INTRO','BREAK','VERSE','CHORUS','FINAL_CHORUS'].map(t=>(d[t]||0).toFixed(2)).join('/');}).join(' | '));
})();

// --- 既存の成果物を壊していないこと ---
const protectedFiles=[
  'monster-hero/data/rhythm-mode.js','monster-hero/src/game-system.jsx',
  'monster-hero/debug/monster-hero-theme-easy-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-normal-formal-candidate-v1.json',
  'monster-hero/debug/monster-hero-theme-hard-formal-candidate-v1.json',
  'tools/mode/rhythm-monster-hero-chart-build.js',
];
const protectedBefore=protectedFiles.map(f=>hash(path.join(ROOT,f)));
run('--write');
check('ランタイム・V1・既存の正式候補v1を書き換えない',
  protectedFiles.every((f,i)=>hash(path.join(ROOT,f))===protectedBefore[i]));

// STEP3の成果物(V2 STEP3出力)にも触っていないこと
const step3Files=fs.readdirSync(authoring).filter(f=>/-v2-chart-/.test(f));
check('STEP3の出力を書き換えない',
  step3Files.every(f=>before.get(f)===hash(path.join(authoring,f))),
  `${step3Files.length}件`);

// --write を2回流しても同じ内容になる(書き出しも決定的)
const reviewHash=hash(reviewFile);
run('--write');
check('--write を繰り返しても同じ内容になる',hash(reviewFile)===reviewHash);

fs.rmSync(tempDir,{recursive:true,force:true});
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
