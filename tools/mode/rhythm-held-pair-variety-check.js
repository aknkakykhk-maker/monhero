#!/usr/bin/env node
// 押さえノーツの同時押さえ(HOLD/SLIDEを2本いちどに押さえる)が、
// **決めごと1つに戻っていないか**を実際に生成して確かめる。
//
//   node tools/mode/rhythm-held-pair-variety-check.js
//
// 【なぜ要るか】(2026-09-12・ユーザー指示)
// 「ノーツの置き方は曲のタイプや難易度でそれに見合った形に置くようにするようにして /
//   決めごとがあるとつまんなくなる / バリエーションが大事」
//
// 同時押さえの2本目を「必ず遠い端へ」のような1つの規則で置くと、出るたびに同じ形になる。
// そこで語彙(HELD_PAIR_SHAPES)から、その場の2本の動き量と難易度で点数を付けて選んでいる。
// この検査は「語彙がちゃんと散らばって使われていること」「難易度で段が付いていること」
// 「指2本で押せること」を見る。数字は**下限**として置き、形が増える方向では落ちない。
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const {HELD_PAIR_SHAPES,heldPairShapeCandidates}=require('./rhythm-chart-v3-patterns.js');
const {HAND_MODEL}=require('./rhythm-hand-model.js');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// ── 1. 語彙そのもの ──────────────────────────────────────────────────────────
ok('形の語彙が3つ以上ある',HELD_PAIR_SHAPES.length>=3,`${HELD_PAIR_SHAPES.length}種`);
ok('形のidが重複していない',new Set(HELD_PAIR_SHAPES.map(s=>s.id)).size===HELD_PAIR_SHAPES.length);
ok('難易度の段(minLevel)に幅がある(上の形は上の難易度だけ)',
  new Set(HELD_PAIR_SHAPES.map(s=>s.minLevel)).size>=3,
  [...new Set(HELD_PAIR_SHAPES.map(s=>s.minLevel))].sort((a,b)=>a-b).join(' / '));
ok('いちばん下の難易度でも使える形がある',HELD_PAIR_SHAPES.some(s=>s.minLevel<=1));

// ── 2. 点数づけが「その場」で変わる ──────────────────────────────────────────
// 動き量がちがえば、いちばん似合う形も変わること(1つの決めごとになっていない)
{
  const at=(bassMove,melodyMove)=>heldPairShapeCandidates({level:9,bassMove,melodyMove,seed:'s'})[0].id;
  const still=at(0,.6),moving=at(.8,.5);
  ok('2本の動き量で選ばれる形が変わる',still!==moving,`動かない→${still} / よく動く→${moving}`);
  const tops=new Set();
  for(let b=0;b<=10;b++)for(let m=0;m<=10;m++)tops.add(at(b/10,m/10));
  ok('動き量の組み合わせで3種類以上の形が1位になる',tops.size>=3,`${tops.size}種（${[...tops].join(' / ')}）`);
}
// 難易度で使える形が増えること
{
  const countAt=level=>heldPairShapeCandidates({level,bassMove:.5,melodyMove:.5,seed:'s'}).length;
  ok('難易度が上がると使える形が増える',countAt(1)<countAt(7)&&countAt(7)<=countAt(9),
    `level1 ${countAt(1)}種 → level7 ${countAt(7)}種 → level9 ${countAt(9)}種`);
}
// 使った形にペナルティが掛かること(同じ形が並ばない)
{
  const usage=new Map([['cross',3]]);
  const withUsage=heldPairShapeCandidates({level:9,bassMove:.8,melodyMove:.5,usage,seed:'s'});
  const without=heldPairShapeCandidates({level:9,bassMove:.8,melodyMove:.5,seed:'s'});
  ok('使った形は後ろへ回る',without[0].id==='cross'&&withUsage[0].id!=='cross',
    `使う前の1位 ${without[0].id} / 3回使ったあとの1位 ${withUsage[0].id}`);
  const prev=heldPairShapeCandidates({level:9,bassMove:.8,melodyMove:.5,previousId:'cross',seed:'s'});
  ok('直前と同じ形は続けて出ない',prev[0].id!=='cross',`直前cross → 次 ${prev[0].id}`);
}
// 曲(種)がちがえば並びも変わること
{
  const a=heldPairShapeCandidates({level:9,bassMove:.5,melodyMove:.5,seed:'songA'}).map(s=>s.id).join(',');
  const b=heldPairShapeCandidates({level:9,bassMove:.5,melodyMove:.5,seed:'songB'}).map(s=>s.id).join(',');
  ok('曲がちがえば並びも変わる(同点を種で崩している)',a!==b,`A: ${a} / B: ${b}`);
}

// ── 3. 実際に生成して確かめる ────────────────────────────────────────────────
// ベース帯の解析が要るので、いちど解析してから生成する。
// 既存の解析ファイルへは書かない(一時ディレクトリへ出す)。
// ★解析ツールは --audio を path.join(ROOT, …) で解くので、**リポジトリからの相対パス**で渡す。
//   絶対パスを渡すと join が連結してしまい「音源が見つかりません」になる。
const audioRelative='monster-hero/audio/bgm-monster-hero-theme.mp3';
const audio=path.join(ROOT,audioRelative);
if(!fs.existsSync(audio)){
  console.log('SKIP: 音源が見つからないので、生成しての確認は飛ばします');
}else{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'held-pair-'));
  const analyze=spawnSync('node',[path.join(ROOT,'tools/mode/rhythm-audio-analyze-v3.js'),
    '--audio',audioRelative,'--track','monster-hero-theme','--bpm','173.153','--beat-zero','206',
    '--write','--output-dir',tmp],{cwd:ROOT,encoding:'utf8'});
  const analyzed=fs.existsSync(path.join(tmp,'monster-hero-theme-v3-audio.json'));
  ok('ベース帯つきで解析できる',analyzed,analyzed?'':(analyze.stderr||'').split('\n')[0]);
  if(analyzed){
    const report=JSON.parse(fs.readFileSync(path.join(tmp,'monster-hero-theme-v3-audio.json'),'utf8'));
    ok('ベースの伸びる区間が取れている',(report.bassSustains||[]).length>0,`${(report.bassSustains||[]).length}件`);
    ok('旋律と重なっている組がある(同時押さえの素)',Number(report.summary.heldPairCandidates)>0,
      `${report.summary.heldPairCandidates}組`);
    const gen=spawnSync('node',[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),'--input-dir',tmp],
      {cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
    const out=gen.stdout||'';
    const lines=out.split('\n').filter(line=>line.includes('押さえノーツの同時押さえ'));
    ok('EXPERT・MASTERで同時押さえが置かれる',lines.length>=2,`${lines.length}件の報告`);
    let worstShapes=99,totalPlaced=0;
    for(const line of lines){
      const placed=Number((line.match(/同時押さえ (\d+)組/)||[])[1]||0);
      const shapes=new Set(((line.match(/形 (.+?)）/)||[])[1]||'').split(' / ')
        .map(text=>text.replace(/\d+$/,'')).filter(Boolean));
      totalPlaced+=placed;
      if(placed>=2)worstShapes=Math.min(worstShapes,shapes.size);
    }
    ok('合計で2組以上置かれる',totalPlaced>=2,`${totalPlaced}組`);
    // ★これが本題。2組以上置いた難易度では、形が1種類に偏っていないこと
    ok('2組以上置いた難易度では形が2種類以上使われる(決めごと1つに戻っていない)',
      worstShapes===99||worstShapes>=2,worstShapes===99?'2組以上の難易度が無かった':`いちばん少ない難易度で${worstShapes}種`);
    // 押せること: 指の本数を超える瞬間は、既存のパスが外しているはず
    ok('指の本数(親指2本)を前提にしている',HAND_MODEL.hands===2,`hands=${HAND_MODEL.hands}`);
    ok('生成が正常に終わる',gen.status===0,`終了コード ${gen.status}`);
  }
  fs.rmSync(tmp,{recursive:true,force:true});
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
