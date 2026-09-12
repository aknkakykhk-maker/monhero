#!/usr/bin/env node
// 同時スライド(2本のSLIDEをいちどになぞる)が、**曲によって丸ごと欠けないこと**と
// **指2本で押せること**を、実際に生成して確かめる。
//
//   node tools/mode/rhythm-double-slide-check.js
//   node tools/mode/rhythm-double-slide-check.js --tracks a,b,c   # 曲を指定する
//
// 【なぜ要るか】(2026-09-12・ユーザー指示)
// 「同時スライドは結構重要な譜面だから入る仕組みを構築してほしい / むずかしい側にはなるとおもうけど」
//
// 同時押さえ(15.5)は2本目の素をベースの伸びから取るので、**ベースと旋律が同時に、
// どちらもSLIDEになるだけ動いている場所**が要る。実測でその場所は曲ごとに0〜3箇所しか無く、
// SLIDE＋SLIDEの組は一度も出なかった。だから同時スライドは狙って置く段(15.6)を別に持つ。
// この検査は「狙って置けていること」を見張る。ゆるめる方向に数字を動かすのではなく、
// 置けなくなったら生成器のほうを直す。
//
// 見るもの:
//   ・左右対称(mirror)が語彙にあり、名前どおり鏡になっていること
//   ・EASY/NORMAL/HARDには出ないこと(むずかしい側だけ)
//   ・曲をまたいで「ほとんどの曲で1組は出る」こと(丸ごと欠けない)
//   ・出た組は**2本とも動くSLIDE**であること(片方がHOLDなら同時スライドではない)
//   ・同じ時間に重なっている押さえノーツすべてとの指の間隔が足りていること
//   ・形が1種類に偏っていないこと(決めごとに戻っていない)
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const {HELD_PAIR_SHAPES}=require('./rhythm-chart-v3-patterns.js');
const {HAND_MODEL}=require('./rhythm-hand-model.js');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// ── 1. 語彙 ──────────────────────────────────────────────────────────────────
{
  const mirrorShape=HELD_PAIR_SHAPES.find(shape=>shape.id==='mirror');
  ok('左右対称(mirror)が語彙にある',!!mirrorShape);
  if(mirrorShape){
    const room=4;
    const cases=[[0,1],[1,0],[0,2],[3,4]];
    const broken=cases.filter(([from,to])=>{
      const lanes=mirrorShape.place({partnerFrom:from,partnerTo:to,room,gap:2});
      return lanes.from!==room-from||lanes.to!==room-to;
    });
    ok('mirrorが名前どおり鏡になっている',broken.length===0,
      broken.map(c=>c.join('→')).join(' / ')||`${cases.length}通りを確認`);
    // 鏡なので「相方が動いたぶんだけ動く」＝follows:'partner'。
    // 'own'(相方が止まっていても自分は動く)にすると、相方が動かないときに
    // 名前と中身が食い違う(同時押さえの検査がそこを落とす)。
    ok("mirrorは相方に合わせて動く形(follows:'partner')",mirrorShape.follows==='partner',mirrorShape.follows);
    // 相方が動けば必ず動くこと。同時スライドの相方は必ず動くので、mirrorは必ず動く
    const stays=[[0,1],[1,0],[0,2],[3,4]].filter(([from,to])=>{
      const lanes=mirrorShape.place({partnerFrom:from,partnerTo:to,room:4,gap:2});
      return lanes.from===lanes.to;
    });
    ok('相方が動くときmirrorも必ず動く',stays.length===0,stays.map(c=>c.join('→')).join(' / ')||'4通りを確認');
  }
  // 同時スライドは「動く形」しか使わない。動く形が3種類以上ないと、形が偏る
  const moving=HELD_PAIR_SHAPES.filter(shape=>shape.follows!=='none');
  ok('動く形が3種類以上ある(同時スライドで使えるもの)',moving.length>=3,
    `${moving.length}種（${moving.map(s=>s.id).join(' / ')}）`);
}

// ── 2. 実際に生成して確かめる ────────────────────────────────────────────────
const DEFAULT_TRACKS=['monster_hero_theme','pandora_boss','eiki_boss',
  'close_to_your_heart','six_eternel_beat','kindan_no_resistance'];
const tracks=(arg('--tracks')||'').split(',').map(text=>text.trim()).filter(Boolean);
const targets=tracks.length?tracks:DEFAULT_TRACKS;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'double-slide-'));

// HOLDは subLane、SLIDEは lane を経路の中心として持つ(単位がちがう)。
// 手のモデルと同じ物差しへ直してから比べる。SLIDEは中継点に沿って折れる。
const centerAt=(note,grid)=>{
  const duration=Number(note.durationGrids)||0;
  if(note.type==='SLIDE'&&duration>0){
    const points=Array.isArray(note.slidePoints)&&note.slidePoints.length>=2?note.slidePoints:null;
    if(!points){
      const from=Number(note.lane),to=Number(note.endLane??note.lane);
      return from+(to-from)*Math.max(0,Math.min(1,(grid-note.grid)/duration));
    }
    if(grid<=Number(points[0].grid))return Number(points[0].lane);
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],ag=Number(a.grid),bg=Number(b.grid);
      if(grid<=bg)return Number(a.lane)+(Number(b.lane)-Number(a.lane))*(bg>ag?(grid-ag)/(bg-ag):0);
    }
    return Number(points[points.length-1].lane);
  }
  const sub=Number(note.subLane),width=(Number(note.subLaneWidth)||2)/2;
  return Number.isFinite(sub)?sub/2+width/2:Number(note.lane);
};
const spanOf=note=>({start:note.grid,end:note.grid+(Number(note.durationGrids)||0)});

const perTrack=[];
let worstGap=Infinity,worstAt='',lowFound=0,shapeIds=new Set(),bothSlide=0,total=0,thirdFinger=[];
for(const track of targets){
  const dashed=track.replace(/_/g,'-');
  const dir=path.join(tmp,track);
  fs.mkdirSync(dir,{recursive:true});
  const gen=spawnSync('node',[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
    '--track',track,'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
  if(gen.status!==0){ok(`${track}: 生成できる`,false,(gen.stderr||'').split('\n')[0]);continue;}
  let placedHere=0;
  for(const difficulty of ['easy','normal','hard','expert','master']){
    const file=path.join(dir,`${dashed}-v3-chart-${difficulty}.json`);
    if(!fs.existsSync(file))continue;
    const chart=JSON.parse(fs.readFileSync(file,'utf8'));
    const notes=chart.notes||[];
    const pairs=notes.filter(note=>note.doubleSlide===true);
    // むずかしい側だけ。低い難易度の設定(policy)も null になっていること
    if(['easy','normal','hard'].includes(difficulty)){
      if(pairs.length)lowFound+=pairs.length;
      if(chart.policy&&chart.policy.doubleSlide!==null&&chart.policy.doubleSlide!==undefined)
        lowFound+=1;
      continue;
    }
    placedHere+=pairs.length;
    total+=pairs.length;
    const helds=notes.filter(note=>note.type==='HOLD'||note.type==='SLIDE');
    for(const pair of pairs){
      shapeIds.add(pair.heldPairShape);
      const own=spanOf(pair);
      // 2本とも動くSLIDEか（相方に、同じ時間へ重なる「動くSLIDE」がいるか）
      const partner=helds.find(other=>other!==pair&&other.type==='SLIDE'
        &&Math.min(spanOf(other).end,own.end)-Math.max(spanOf(other).start,own.start)>0
        &&Math.abs(Number(other.endLane??other.lane)-Number(other.lane))>0);
      if(pair.type==='SLIDE'&&Math.abs(Number(pair.endLane??pair.lane)-Number(pair.lane))>0&&partner)bothSlide++;
      // 指の間隔（重なっている押さえノーツすべてと）
      for(const other of helds){
        if(other===pair)continue;
        const that=spanOf(other);
        const from=Math.max(own.start,that.start),to=Math.min(own.end,that.end);
        if(to<=from)continue;
        const shift=other.type==='SLIDE'?0
          :Math.min(((Number(other.subLaneWidth)||2)/2)/4,HAND_MODEL.holdShiftLanes);
        for(let grid=from;grid<=to;grid++){
          const distance=Math.abs(centerAt(pair,grid)-centerAt(other,grid))+shift;
          if(distance<worstGap){worstGap=distance;worstAt=`${track} ${difficulty} ${pair.heldPairShape} と ${other.type}`;}
        }
      }
      // 2本押さえているあいだに3本目を要求するノーツが残っていないか
      const inside=notes.filter(note=>note.grid>own.start&&note.grid<own.end
        &&!(note.type==='HOLD'||note.type==='SLIDE'));
      const stillHeld=grid=>helds.filter(other=>{
        const that=spanOf(other);
        return that.start<grid&&grid<=that.end;
      }).length;
      for(const note of inside)if(stillHeld(note.grid)+1>HAND_MODEL.hands)
        thirdFinger.push(`${track} ${difficulty} grid${note.grid}`);
    }
  }
  perTrack.push({track,placed:placedHere});
}
fs.rmSync(tmp,{recursive:true,force:true});

for(const row of perTrack)console.log(`   ${row.track.padEnd(24)} EXPERT+MASTER ${row.placed}組`);
ok('EASY/NORMAL/HARDには同時スライドが出ない',lowFound===0,`${lowFound}件`);
// ★ここが本題。「運よく重なったら出る」に戻っていないこと。
const withAny=perTrack.filter(row=>row.placed>0).length;
ok('ほとんどの曲で同時スライドが出る(曲ごとに丸ごと欠けない)',
  perTrack.length>0&&withAny>=Math.ceil(perTrack.length*.8),
  `${withAny}/${perTrack.length}曲`);
ok('合計で4組以上置かれる',total>=4,`${total}組`);
ok('置いた組は2本とも動くSLIDEになっている',total>0&&bothSlide===total,`${bothSlide}/${total}組`);
ok('同時に押さえる2本へ指2本が入る',worstGap===Infinity||worstGap>=HAND_MODEL.fingerMinGapLanes,
  worstGap===Infinity?'重なりなし':`いちばん狭いところ ${worstGap.toFixed(2)}レーン（下限 ${HAND_MODEL.fingerMinGapLanes}）[${worstAt}]`);
ok('2本押さえているあいだに3本目を要求するノーツが残っていない',thirdFinger.length===0,
  thirdFinger.slice(0,3).join(' / ')||'なし');
ok('形が3種類以上使われる(決めごと1つに戻っていない)',shapeIds.size>=3,
  `${shapeIds.size}種（${[...shapeIds].join(' / ')}）`);

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
