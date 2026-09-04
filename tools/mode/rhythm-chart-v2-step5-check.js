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
check('V1生成器を起動しない(V2 STEP3の生成器だけを使う)',
  source.includes("const GENERATOR=path.join(ROOT,'tools/mode/rhythm-chart-v2-step3-generate.js');")
  &&[...source.matchAll(/spawnSync\(process\.execPath,\[([^,\]]+)/g)].every(m=>m[1].trim()==='GENERATOR'));
check('乱数を使わない(順位が毎回変わらないため)',
  !/Math\.random|crypto\.randomBytes/.test(source));

// --- 生成器の上書き口が「既定を変えない」こと ---
// STEP5は生成器へ --profile-override を渡す。既定(上書きなし)の出力が変わってしまうと
// STEP3の決定性が壊れるので、ここでも直接確かめる。
const genSource=fs.readFileSync(GENERATOR,'utf8');
check('上書き口は既定では何もしない',
  genSource.includes("const raw=arg('--profile-override',null);")
  &&genSource.includes("if(!raw)return null;")
  &&genSource.includes('profileOverride&&profileOverride[difficulty]?Object.freeze({...PROFILES[difficulty],...profileOverride[difficulty]}):PROFILES[difficulty]'));
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
    check(`${difficulty}: 採用案が最高得点である`,
      cands.length>0&&Math.abs(Math.max(...cands.map(c=>c.score))-(cands.find(c=>c.variant===entry.winner)||{}).score)<1e-9,
      `採用${entry.winner}`);
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
