// 止め絵の場面を本物の HELL 譜面から切り出す: node docs/progress/beat/sky-slide-color-2026-11-23/extract.js
// 見た目の案だけの資料。譜面は読むだけで変えない(台帳 r1119-149)
const fs=require('fs'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..','..','..');
const ctx={Object,Number,Math,JSON,Array,String,Date,Infinity,NaN};
vm.runInNewContext(fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')+'\nthis.H=RHYTHM_HELL_CHARTS;this.S=RHYTHM_SONGS;',ctx);
const SPAN=1700;// 既定。場面ごとに span で変える
const SCENES=[
  {id:'grievous',song:'grievous_lady',t:12950,span:1500,label:'左右の空中スライドが同時(左は空中→地上へ降りる・右は地上→空中へ上がる)'},
  {id:'kiki',song:'kiki_issen',t:37480,span:1000,label:'地上→空中→地上と山なりに行き来する'},
  {id:'beyond',song:'beyond_the_same_sky',t:24790,span:650,label:'空中だけを通るスライド'},
];
const out=SCENES.map(s=>{const notes=ctx.H[s.song].notes.filter(n=>{const end=n.endTimeMs||n.timeMs;return end>=s.t&&n.timeMs<=s.t+(s.span||SPAN);})
  .map(n=>({type:n.type,t:n.timeMs,end:n.endTimeMs,sub:n.slidePoints?null:n.subLane,w:n.subLaneWidth,sky:n.skyHeight||0,hand:n.hand,
    pts:n.slidePoints&&n.slidePoints.map(p=>({t:p.timeMs,sub:p.lane*2,w:p.subLaneWidth,sky:p.sky||0}))}));
  return {span:SPAN,...s,title:ctx.S.find(x=>x.songId===s.song).displayName,notes};});
fs.writeFileSync(path.join(__dirname,'scenes.js'),'window.SCENES='+JSON.stringify(out)+';\n');
console.log(out.map(s=>`${s.id} ${s.notes.length}件 スライド${s.notes.filter(n=>n.pts).length}`).join('\n'));
