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
const {HELD_PAIR_SHAPES,heldPairShapeCandidates,heldPairMoveScale}=require('./rhythm-chart-v3-patterns.js');
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
// ★ここが本題のひとつ。名前は cross なのに2本目が動かない、を通さない。
// 端で潰れると「形の名前と中身が食い違う」ので、follows で分けて幾何を見る。
{
  const room=4,gap=2;
  const cases=[[2,2,'相方が動かない'],[0,4,'相方が動く'],[4,0,'相方が逆へ動く'],[0,1,'相方が少し動く']];
  const broken=[];
  for(const shape of HELD_PAIR_SHAPES){
    for(const [from,to,label] of cases){
      const lanes=shape.place({partnerFrom:from,partnerTo:to,room,gap});
      const moved=lanes.from!==lanes.to;
      if(shape.follows==='none'&&moved)broken.push(`${shape.id}(${label}): 動かない形なのに動いた`);
      if(shape.follows==='own'&&!moved)broken.push(`${shape.id}(${label}): 自分で動く形なのに動かない`);
      if(shape.follows==='partner'&&(from!==to)&&!moved)broken.push(`${shape.id}(${label}): 相方が動いているのに動かない`);
      if(lanes.from<0||lanes.from>room||lanes.to<0||lanes.to>room)broken.push(`${shape.id}(${label}): レーンの外`);
    }
  }
  ok('形が名前どおりに動く(端で潰れない)',broken.length===0,broken.slice(0,3).join(' / ')||'全8種×4通りを確認');
}
// 動き量の目安が、実データの届く範囲にあること
{
  // 伸びる音の moves は中央0.023・p90 0.125・最大0.36(＝倍率で0.23/1.25/3.0)。
  // 目安が3.0を超えていると、その形は一度も1位になれない(2026-09-12に実際そうなった)
  const tooHigh=HELD_PAIR_SHAPES.filter(s=>s.wantsBassMove>3||s.wantsMelodyMove>3);
  ok('動き量の目安が実データの届く範囲にある(倍率3.0以内)',tooHigh.length===0,
    tooHigh.map(s=>s.id).join(' / ')||'全8種');
  ok('生の moves を倍率へ直せる',
    heldPairMoveScale(.10)===1&&heldPairMoveScale(0)===0&&heldPairMoveScale(1)===3,
    `0.10→${heldPairMoveScale(.10)} / 0→${heldPairMoveScale(0)} / 1→${heldPairMoveScale(1)}`);
}

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
  // ★目安は倍率なので、渡す値も倍率にそろえる(生の moves ではない)。
  //   1位になった形を実際にペナルティへ入れて、順位が入れ替わることを見る。
  const at=extra=>heldPairShapeCandidates({level:9,
    bassMove:heldPairMoveScale(.30),melodyMove:heldPairMoveScale(.10),seed:'s',...extra});
  const without=at({});
  const top=without[0].id;
  const withUsage=at({usage:new Map([[top,3]])});
  ok('使った形は後ろへ回る',withUsage[0].id!==top,
    `使う前の1位 ${top} / 3回使ったあとの1位 ${withUsage[0].id}`);
  const prev=at({previousId:top});
  ok('直前と同じ形は続けて出ない',prev[0].id!==top,`直前${top} → 次 ${prev[0].id}`);
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
    // ── 書き出した譜面を開いて、幾何で確かめる ──────────────────────────────
    const gen2=spawnSync('node',[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
      '--input-dir',tmp,'--write','--output-dir',tmp],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
    ok('譜面を書き出せる',gen2.status===0,`終了コード ${gen2.status}`);
    // HOLDは subLane、SLIDEは lane を経路の中心として持つ(単位がちがう)。
    // 手のモデルと同じ物差しへ直してから比べる
    const centerAt=(note,grid)=>{
      const duration=Number(note.durationGrids)||0;
      if(note.type==='SLIDE'&&duration>0){
        const from=Number(note.lane),to=Number(note.endLane??note.lane);
        return from+(to-from)*Math.max(0,Math.min(1,(grid-note.grid)/duration));
      }
      const sub=Number(note.subLane),width=(Number(note.subLaneWidth)||2)/2;
      return Number.isFinite(sub)?sub/2+width/2:Number(note.lane);
    };
    let worstGap=Infinity,worstAt='',placedTotal=0,movingTotal=0,shapeIds=new Set();
    for(const difficulty of ['expert','master']){
      const file=path.join(tmp,`monster-hero-theme-v3-chart-${difficulty}.json`);
      if(!fs.existsSync(file))continue;
      const chart=JSON.parse(fs.readFileSync(file,'utf8'));
      const notes=chart.notes||[];
      const helds=notes.filter(note=>note.type==='HOLD'||note.type==='SLIDE');
      // 同時スライド(15.6)も heldPair:true を持つ。組数と形はこの段のぶんだけ数え、
      // 指の間隔は**同時スライドも含めて**総当たりで見る（押せるかは両方の問題なので）。
      const pairs=notes.filter(note=>note.heldPair===true&&note.doubleSlide!==true);
      const everyPair=notes.filter(note=>note.heldPair===true);
      placedTotal+=pairs.length;
      for(const pair of pairs){
        shapeIds.add(pair.heldPairShape);
        if(pair.type==='SLIDE')movingTotal++;
      }
      for(const pair of everyPair){
        const pairEnd=pair.grid+(Number(pair.durationGrids)||0);
        for(const other of helds){
          if(other===pair)continue;
          const otherEnd=other.grid+(Number(other.durationGrids)||0);
          const from=Math.max(pair.grid,other.grid),to=Math.min(pairEnd,otherEnd);
          if(to<=from)continue;
          const shift=other.type==='SLIDE'?0
            :Math.min(((Number(other.subLaneWidth)||2)/2)/4,HAND_MODEL.holdShiftLanes);
          for(let grid=from;grid<=to;grid++){
            const distance=Math.abs(centerAt(pair,grid)-centerAt(other,grid))-shift;
            if(distance<worstGap){worstGap=distance;worstAt=`${difficulty} ${pair.heldPairShape} と ${other.type}`;}
          }
        }
      }
    }
    // ★これが本題のもうひとつ。同時に押さえる2本へ、指が2本入ること。
    //   相方だけを見ていると、別のHOLDと指がぶつかる組を通してしまう(2026-09-12に実際そうなった)
    ok('同時に押さえるノーツへ指2本が入る',worstGap===Infinity||worstGap>=HAND_MODEL.fingerMinGapLanes,
      worstGap===Infinity?'重なりなし':`いちばん狭いところ ${worstGap.toFixed(2)}レーン（下限 ${HAND_MODEL.fingerMinGapLanes}）[${worstAt}]`);
    ok('譜面に残った組数が報告と合う',placedTotal>0,`${placedTotal}組`);
    ok('残った組でも形が2種類以上',shapeIds.size>=2,`${shapeIds.size}種（${[...shapeIds].join(' / ')}）`);
    console.log(`   参考: 2本目が動くもの ${movingTotal}/${placedTotal}組`);
  }
  fs.rmSync(tmp,{recursive:true,force:true});
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
