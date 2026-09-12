#!/usr/bin/env node
// スライドの**分岐・合流**が、形として成立していて指2本で押せることを、
// 実際に生成して確かめる。
//
//   node tools/mode/rhythm-slide-fan-check.js
//   node tools/mode/rhythm-slide-fan-check.js --tracks a,b,c
//
// 【なぜ要るか】(2026-09-12)
// docs/spec/RHYTHM_CHART_DESIGN.md §3.1.8 の「まだやっていないこと」に
// 「分岐・合流は slidePoints が1本道なのでデータ形式から要る」と書いてあった。
// これは**1本のノーツの中で経路が割れる**形(maimai の扇)を考えていたためで、
// 遊ぶ形として要る「1本が2本になる／2本が1本になる」は
// **2本のSLIDEの端をそろえる**だけで出せる。形式は変えていない。
//
// この検査がいちばん見たいのは、名前と中身が食い違わないこと。
//   分岐 … 親の途中から生えて、親が**そのあとも続く**（生えた側は親の終わりまで）
//   合流 … 親へ近づいていって途中で消え、親が**そのあとも続く**
// どちらも、くっついて見える側の端で指が2本ぶん離れていて、
// もう片方の端では**そこから離れている**(＝ほんとうに割れて見える)必要がある。
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const {HAND_MODEL}=require('./rhythm-hand-model.js');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// HOLDは subLane、SLIDEは lane を経路の中心として持つ(単位がちがう)。
// SLIDEは中継点に沿って折れるので、端どうしを直線で結んで済ませない。
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

const DEFAULT_TRACKS=['pandora_boss','eiki_boss_remix','pandora_boss_remix',
  'six_eternel_remix_beat','4u_hitasura','dullahan_clockwork'];
const tracks=(arg('--tracks')||'').split(',').map(text=>text.trim()).filter(Boolean);
const targets=tracks.length?tracks:DEFAULT_TRACKS;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'slide-fan-'));

const perTrack=[];
let total=0,outCount=0,inCount=0,lowFound=0;
let worstJoin=Infinity,worstJoinAt='',worstFar=Infinity,worstFarAt='';
const noParentAfter=[],wrongEnd=[],noOnset=[],thirdFinger=[];
for(const track of targets){
  const dashed=track.replace(/_/g,'-');
  const dir=path.join(tmp,track);
  fs.mkdirSync(dir,{recursive:true});
  const gen=spawnSync('node',[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
    '--track',track,'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
  if(gen.status!==0){ok(`${track}: 生成できる`,false,(gen.stderr||'').split('\n')[0]);continue;}
  const audioFile=path.join(ROOT,`tools/mode/authoring/${dashed}-v3-audio.json`);
  const audio=fs.existsSync(audioFile)?JSON.parse(fs.readFileSync(audioFile,'utf8')):null;
  const onsetGrids=audio?new Set(audio.onsets.map(onset=>onset.grid)):null;
  const BEAT=audio?audio.timing.subdivisionsPerBeat:4;
  let here=0;
  for(const difficulty of ['easy','normal','hard','expert','master']){
    const file=path.join(dir,`${dashed}-v3-chart-${difficulty}.json`);
    if(!fs.existsSync(file))continue;
    const chart=JSON.parse(fs.readFileSync(file,'utf8'));
    const notes=chart.notes||[];
    const fans=notes.filter(note=>note.slideFan==='out'||note.slideFan==='in');
    // むずかしい側だけ。低い難易度は設定(policy)も null であること
    if(['easy','normal','hard'].includes(difficulty)){
      if(fans.length)lowFound+=fans.length;
      if(chart.policy&&chart.policy.slideFan!==null&&chart.policy.slideFan!==undefined)lowFound+=1;
      continue;
    }
    here+=fans.length;
    total+=fans.length;
    const helds=notes.filter(note=>note.type==='HOLD'||note.type==='SLIDE');
    for(const fan of fans){
      if(fan.slideFan==='out')outCount++;else inCount++;
      const own=spanOf(fan);
      const where=`${track} ${difficulty} grid${fan.grid} ${fan.slideFan}`;
      // ★頭が実際に鳴っている音に乗っていること（幽霊ノーツにしない）
      if(onsetGrids&&!onsetGrids.has(fan.grid))noOnset.push(where);
      // 親を探す（自分の区間をまるごと含むSLIDE）
      const parent=helds.find(other=>other!==fan&&other.type==='SLIDE'
        &&spanOf(other).start<own.start&&spanOf(other).end>=own.end);
      if(!parent){noParentAfter.push(`${where}（親が見つからない）`);continue;}
      const parentSpan=spanOf(parent);
      // ★分岐は親が「そのあとも続く」ので終わりがそろう。合流は1拍以上手前で消える
      if(fan.slideFan==='out'&&own.end!==parentSpan.end)wrongEnd.push(`${where}（分岐なのに終わりが親とずれている）`);
      if(fan.slideFan==='in'&&parentSpan.end-own.end<BEAT)wrongEnd.push(`${where}（合流なのに親が1拍も残らない）`);
      if(fan.slideFan==='out'&&own.start-parentSpan.start<BEAT)wrongEnd.push(`${where}（分岐なのに親が1本で見える時間が無い）`);
      // ★くっついて見える側の端で指2本ぶん離れ、反対の端ではもっと離れていること
      const joinGrid=fan.slideFan==='out'?own.start:own.end;
      const farGrid=fan.slideFan==='out'?own.end:own.start;
      const joinGap=Math.abs(centerAt(fan,joinGrid)-centerAt(parent,joinGrid));
      const farGap=Math.abs(centerAt(fan,farGrid)-centerAt(parent,farGrid));
      if(joinGap<worstJoin){worstJoin=joinGap;worstJoinAt=where;}
      if(farGap-joinGap<worstFar){worstFar=farGap-joinGap;worstFarAt=where;}
      // 2本押さえているあいだに3本目を要求するノーツが残っていないか
      const stillHeld=grid=>helds.filter(other=>{
        const that=spanOf(other);
        return that.start<grid&&grid<=that.end;
      }).length;
      for(const note of notes){
        if(note.type==='HOLD'||note.type==='SLIDE')continue;
        if(note.grid<=own.start||note.grid>=own.end)continue;
        if(stillHeld(note.grid)+1>HAND_MODEL.hands)thirdFinger.push(`${where} → grid${note.grid}`);
      }
    }
  }
  perTrack.push({track,placed:here});
}
fs.rmSync(tmp,{recursive:true,force:true});

for(const row of perTrack)console.log(`   ${row.track.padEnd(24)} EXPERT+MASTER ${row.placed}箇所`);
ok('EASY/NORMAL/HARDには分岐・合流が出ない',lowFound===0,`${lowFound}件`);
const withAny=perTrack.filter(row=>row.placed>0).length;
ok('ほとんどの曲で分岐・合流が出る',perTrack.length>0&&withAny>=Math.ceil(perTrack.length*.8),
  `${withAny}/${perTrack.length}曲`);
ok('合計で6箇所以上置かれる',total>=6,`${total}箇所`);
// ★どちらか片方に寄っていないこと（決めごと1つに戻していない）
ok('分岐と合流の両方が出る',outCount>0&&inCount>0,`分岐${outCount} / 合流${inCount}`);
ok('2本目の頭が実際に鳴っている音に乗っている',noOnset.length===0,
  noOnset.slice(0,3).join(' / ')||`${total}箇所すべて打点の上`);
ok('親のSLIDEが自分の区間をまるごと含んでいる',noParentAfter.length===0,
  noParentAfter.slice(0,3).join(' / ')||'なし');
ok('名前どおりの端になっている(分岐は終わりがそろう / 合流は親が残る)',wrongEnd.length===0,
  wrongEnd.slice(0,3).join(' / ')||'なし');
// ★これが本題。くっついて見える側でも指が2本入る
ok('分岐点・合流点で指2本が入る',worstJoin===Infinity||worstJoin>=HAND_MODEL.fingerMinGapLanes,
  worstJoin===Infinity?'なし':`いちばん狭いところ ${worstJoin.toFixed(2)}レーン（下限 ${HAND_MODEL.fingerMinGapLanes}）[${worstJoinAt}]`);
// ★そして反対の端では離れている（＝ほんとうに割れて／合わさって見える）
ok('反対の端では分岐点より離れている(割れて見える)',worstFar===Infinity||worstFar>=.5,
  worstFar===Infinity?'なし':`いちばん開きが小さいところ ${worstFar.toFixed(2)}レーン（下限 0.50）[${worstFarAt}]`);
ok('2本押さえているあいだに3本目を要求するノーツが残っていない',thirdFinger.length===0,
  thirdFinger.slice(0,3).join(' / ')||'なし');

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
