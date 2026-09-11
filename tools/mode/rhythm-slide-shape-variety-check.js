#!/usr/bin/env node
// SLIDEの形にちゃんとバリエーションが出ているかを、実際に生成させて確かめる。
//
//   node tools/mode/rhythm-slide-shape-variety-check.js
//
// 【なぜ要るか】(2026-09-12・ユーザー指摘)
// 「バリエーションが少ない。カクカクとか広くなったり短くなったりとかそういうのもほしい」
//
// 直す前は配信中の譜面のSLIDE 552本が**全本、太さが一定**だった（途中で変わるものは0本）。
// 中継点はどれも7点前後、移動量は上限に張り付き。データ形式もランタイムも可変幅へ
// 対応済みだったのに、生成器が1本道しか作っていなかった。
//
// この検査は「また単調へ戻っていないか」を見る。数字は**下限**として置き、
// 上げる方向の変更では落ちないようにしてある（形が増えるのは歓迎なので）。
// 同時に「広げすぎて遊べない形」も見張る（幅が急に飛ぶ・細くなりすぎる）。
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-slide-shape-'));
const tracks=fs.readdirSync(path.join(ROOT,'tools/mode/authoring'))
  .filter(f=>f.endsWith('-v3-audio.json')).map(f=>f.replace('-v3-audio.json','')).slice(0,4);
ok('解析済みの曲がある',tracks.length>0,tracks.join(', '));
if(!tracks.length){console.log('\n1件のNGがあります');process.exit(1);}

for(const track of tracks){
  for(const difficulty of ['HARD','EXPERT','MASTER']){
    spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
      '--track',track,'--difficulty',difficulty,'--write','--output-dir',tempDir],
      {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
  }
}
const slides=[];
for(const file of fs.readdirSync(tempDir)){
  const chart=JSON.parse(fs.readFileSync(path.join(tempDir,file),'utf8'));
  for(const note of (chart.notes||chart.chart?.notes||[])){
    if(note.type!=='SLIDE'||!Array.isArray(note.slidePoints)||note.slidePoints.length<2)continue;
    slides.push({file,note,widths:note.slidePoints.map(p=>Number(p.subLaneWidth)),
      lanes:note.slidePoints.map(p=>Number(p.lane))});
  }
}
ok('SLIDEが生成されている',slides.length>=20,`${slides.length}本`);
if(!slides.length){console.log(`\n${failed+1}件のNGがあります`);process.exit(1);}

console.log('\n--- バリエーションが出ているか（単調へ戻っていないか）---');
const varying=slides.filter(s=>new Set(s.widths).size>1);
ok('途中で太さが変わるSLIDEがある',varying.length>=slides.length*.25,
  `${varying.length}/${slides.length}本 (${(varying.length/slides.length*100).toFixed(0)}%)`);
const widthPatterns=new Set(slides.map(s=>s.widths.join('-')));
ok('太さの並びが何通りもある',widthPatterns.size>=15,`${widthPatterns.size}通り`);
ok('途中で太さが変わる割合が十分',varying.length>=slides.length*.35,`${(varying.length/slides.length*100).toFixed(0)}%`);
const pointCounts=slides.map(s=>s.slidePoints?.length??s.widths.length);
ok('中継点の数に幅がある（刻みが固定でない）',
  Math.max(...pointCounts)-Math.min(...pointCounts)>=5,
  `${Math.min(...pointCounts)}〜${Math.max(...pointCounts)}点`);
const reaches=slides.map(s=>Math.abs(s.lanes[s.lanes.length-1]-s.lanes[0]));
ok('移動量が上限へ張り付いていない',new Set(reaches.map(r=>r.toFixed(1))).size>=4,
  `${new Set(reaches.map(r=>r.toFixed(1))).size}通り / ${Math.min(...reaches)}〜${Math.max(...reaches)}レーン`);

console.log('\n--- 広げすぎて遊べない形になっていないか ---');
const jumpy=slides.filter(s=>{
  for(let i=1;i<s.widths.length;i++)if(Math.abs(s.widths[i]-s.widths[i-1])>=2)return true;
  return false;
});
ok('隣り合う中継点で太さが2段以上飛ぶSLIDEは無い',jumpy.length===0,
  jumpy.length?`${jumpy.length}本 例: ${jumpy[0].file} ${jumpy[0].widths.join('-')}`:'');
// 幅1は追従の許容がいちばん狭い(±0.57レーン)。1本まるごと幅1はきつすぎる
const allNarrow=slides.filter(s=>s.widths.every(w=>w<=1));
ok('まるごと幅1のSLIDEは無い',allNarrow.length===0,
  allNarrow.length?`${allNarrow.length}本 例: ${allNarrow[0].file}`:'');
ok('太さは1以上5以下に収まっている',slides.every(s=>s.widths.every(w=>w>=1&&w<=5)),
  `実際の範囲 ${Math.min(...slides.flatMap(s=>s.widths))}〜${Math.max(...slides.flatMap(s=>s.widths))}`);
ok('移動量は難易度の歩幅(最大4レーン)を超えない',
  slides.every(s=>{for(let i=1;i<s.lanes.length;i++)if(Math.abs(s.lanes[i]-s.lanes[i-1])>4)return false;return true;}));

console.log('\n--- ジグザグ（カクカク）が出ているか ---');
// 経路が何回向きを変えるか。音が行き来している曲でだけ出るので、割合そのものは
// 曲に依存する（SLIDEになる伸びのうち、実際に音程が行き来するのは実測で23%）。
// ここで見るのは「折り返しが出る仕組みが生きているか」と「出たときに読める形か」。
const pathTurns=s=>{let t=0,prev=0;
  for(let i=1;i<s.lanes.length;i++){const d=s.lanes[i]-s.lanes[i-1];if(!d)continue;
    const sign=d>0?1:-1;if(prev&&sign!==prev)t++;prev=sign;}
  return t;};
const withTurns=slides.filter(s=>pathTurns(s)>=1);
const totalTurns=slides.reduce((a,s)=>a+pathTurns(s),0);
ok('折り返す経路が出ている',withTurns.length>=slides.length*.3,
  `${withTurns.length}/${slides.length}本 / 折り返し計${totalTurns}回`);
ok('はっきりしたジグザグ(2回以上折り返す)が出ている',slides.filter(s=>pathTurns(s)>=2).length>=3,
  `${slides.filter(s=>pathTurns(s)>=2).length}本`);
// 折り返しが細かすぎると帯が読めない。1回の折り返しで0.5レーン未満しか振らない形は避ける
const shallow=slides.filter(s=>{
  for(let i=1;i<s.lanes.length-1;i++){
    const a=s.lanes[i]-s.lanes[i-1],b=s.lanes[i+1]-s.lanes[i];
    if(a&&b&&(a>0)!==(b>0)&&Math.abs(b)<.5)return true;
  }
  return false;
});
ok('0.5レーン未満しか振らない折り返しは無い（読めない形にしない）',shallow.length===0,
  shallow.length?`${shallow.length}本 例: ${shallow[0].file} ${shallow[0].lanes.join('→')}`:'');

console.log('\n--- 止めたままでも通るSLIDEを増やしていないか ---');
// 【2026-09-12・生成結果の検証で見つけた問題】
// 経路の振れ幅の半分が追従の許容以下だと、指を止めたままでも許容の内側に居続けられる。
// カクカクは増えるが操作を要求しない「見た目だけの形」になる。
// 追従の許容は 0.82 + (幅-2)/4 + 難易度ぶん（2026-09-11の表）。
const TRACK_BONUS={HARD:.24,EXPERT:.12,MASTER:0};
const toleranceOf=(width,difficulty)=>.82+(width-2)/4+(TRACK_BONUS[difficulty]??0);
const difficultyOf=file=>file.includes('master')?'MASTER':file.includes('expert')?'EXPERT':'HARD';
const stillPassing=slides.filter(s=>{
  const amplitude=(Math.max(...s.lanes)-Math.min(...s.lanes))/2;
  const minTolerance=Math.min(...s.widths.map(w=>toleranceOf(w,difficultyOf(s.file))));
  return amplitude<=minTolerance;
});
// 直す前(全SLIDEが単一幅・移動量が上限固定)の実測は 35/67本 = 52%。そこを超えない。
ok('止めたままでも通るSLIDEが半分を超えない',stillPassing.length<=slides.length*.52,
  `${stillPassing.length}/${slides.length}本 (${(stillPassing.length/slides.length*100).toFixed(0)}%)`);
ok('MASTERで「止めたままでも通る」が半分を超えない',(()=>{
  const master=slides.filter(s=>difficultyOf(s.file)==='MASTER');
  const still=stillPassing.filter(s=>difficultyOf(s.file)==='MASTER');
  return !master.length||still.length<=master.length*.5;
})());

console.log('\n--- 作り方が決定的か（乱数を使っていないか）---');
const again=fs.mkdtempSync(path.join(os.tmpdir(),'rhythm-slide-shape2-'));
spawnSync(process.execPath,[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
  '--track',tracks[0],'--difficulty','MASTER','--write','--output-dir',again],
  {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
const nameOf=dir=>fs.readdirSync(dir).find(f=>f.includes(tracks[0])&&f.includes('master'));
const a=nameOf(tempDir),b=nameOf(again);
ok('2回走らせても同じSLIDEになる',
  !!a&&!!b&&fs.readFileSync(path.join(tempDir,a),'utf8')===fs.readFileSync(path.join(again,b),'utf8'));

console.log('\n--- 実装ガード ---');
const generator=fs.readFileSync(path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),'utf8');
ok('太さの形の語彙がある',/const SLIDE_WIDTH_SHAPES=Object\.freeze\(\{/.test(generator));
ok('刻みを音の揺れで決めている',/const waviness=heightWaviness\(heights\);/.test(generator));
ok('移動量を音の動きへ比例させている',/reachMax\*Math\.min\(1,range\//.test(generator));
// 0.028 ≒ 0.5半音(1半音 ≒ height 0.055)。0.04(≒0.73半音)にしたら本物のビブラートまで削れた。
ok('刻みのしきい値が0.5半音相当になっている',/const HEIGHT_TURN_MIN=\.028;/.test(generator));
ok('音が向きを変えた位置を中継点として置く',/const turningPoints=\[\];/.test(generator)
  &&/for\(const index of turningPoints\)/.test(generator));
ok('中継点には上限がある',/const SLIDE_MAX_POINTS=\d+;/.test(generator));
ok('山と谷は必ず中継点として通す',/sampled\.add\(peakIndex\);sampled\.add\(valleyIndex\);/.test(generator));
ok('太さの下限があり、幅1まで細くしない',/const floorWidth=Math\.min\(width,2\);/.test(generator));
ok('全中継点へ同じ太さを入れる書き方へ戻っていない',
  !/points\.push\(\{grid:startGrid\+i,lane:laneAt\(heights\[i\]\),subLaneWidth:width\}\)/.test(generator));

fs.rmSync(tempDir,{recursive:true,force:true});
fs.rmSync(again,{recursive:true,force:true});
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
