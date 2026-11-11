#!/usr/bin/env node
// 公開中の HELL を、空中を押せるボット(rhythm-cross-swap-bot.js・指のくせあり)で1譜面ずつ通して、取りこぼしを集める(2026-11-11・ジゴク)。
// 社長「ボットで55譜面すべて通す」。HELL の Lv. の式(今の v3 と、手ごとに測る v4)のどちらが取りこぼしの並びに合うかを比べる材料。
//
//   node tools/playbot/rhythm-hell-bot-sweep.js --out <結果.json> [--root <ゲームの場所(写しの worktree)>] [--jobs 3] [--only <曲id,…>]
//       終わった譜面は結果に足していく。途中で止めても、同じ --out で続きから回る
//   node tools/playbot/rhythm-hell-bot-sweep.js --report <結果.json>
//       取りこぼしの割合と Lv.(表示・v3・v4)の順位の相関・式より取りこぼしが多い/少ない譜面の上位だけを出す
//   --persona thumb(既定)|lean|normal  --seed 3  --travel 0.5(親指の上下が届ききらない人。0 で切)
//
// 本物の Supabase へは送らない(ボットの中のにせの Supabase)。ゲームのデータは読むだけ。回している間は --root の場所の道具を編集しない
// (写しの worktree で回す。tools/node_modules は元の場所へつなぐ)。
'use strict';
const fs=require('fs'),path=require('path');
const {spawn}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const args=process.argv.slice(2),argOf=(k,d)=>{const i=args.indexOf(`--${k}`);return i>=0&&args[i+1]!==undefined?args[i+1]:d;};
const H=require(path.join(ROOT,'tools/mode/rhythm-hell-level.js')),L=require(path.join(ROOT,'tools/mode/rhythm-chart-level.js'));
const short=id=>id.replace(/_hell_debug$/,'');
const rank=v=>{const o=v.map((x,i)=>[x,i]).sort((p,q)=>p[0]-q[0]),r=new Array(v.length);for(let i=0;i<o.length;){let j=i;while(j<o.length&&o[j][0]===o[i][0])j++;for(let k=i;k<j;k++)r[o[k][1]]=(i+j-1)/2;i=j;}return r;};
const rankCorr=(a,b)=>{const n=a.length;if(n<4)return null;a=rank(a);b=rank(b);const m=(n-1)/2;let sab=0,sa=0,sb=0;for(let i=0;i<n;i++){sab+=(a[i]-m)*(b[i]-m);sa+=(a[i]-m)**2;sb+=(b[i]-m)**2;}return Math.round(sab/Math.sqrt(sa*sb||1)*100)/100;};
// 取りこぼしの重さ: MISS・BAD は1、GOOD .5、GREAT .25、EXCELLENT .05(MARVELOUS は0)。1ノーツあたり
const LOSS={MISS:1,BAD:1,GOOD:.5,GREAT:.25,EXCELLENT:.05};
const lossOf=counts=>{let n=0,s=0;for(const [k,v] of Object.entries(counts||{})){n+=v;s+=(LOSS[k]||0)*v;}return n?s/n:null;};
const levelsOf=()=>Object.fromEntries(H.hellCharts().map(c=>[c.songId,{difficulty:c.difficulty,notes:c.chart.notes.length,endMs:Math.max(...c.chart.notes.map(n=>Number(n.endTimeMs)||Number(n.timeMs)||0)),
  shown:L.shownLevel(c.songId,c.difficulty,c.chart),v3:L.chartLevel(c.chart,{formula:'v3'}).level,v4:H.hellLevel(c.chart).level}]));

const report=file=>{
  const data=JSON.parse(fs.readFileSync(file,'utf8')),lv=levelsOf();
  const rows=Object.entries(data.results||{}).filter(([id,r])=>lv[id]&&r.counts).map(([id,r])=>({id,...lv[id],loss:lossOf(r.counts),miss:((r.counts.MISS||0)+(r.counts.BAD||0))/Math.max(1,Object.values(r.counts).reduce((a,b)=>a+b,0))}));
  if(rows.length<4){console.log(`結果が ${rows.length}譜面(4譜面から比べられる)`);return rows;}
  const c=k=>rankCorr(rows.map(r=>r[k]),rows.map(r=>r.loss));
  console.log(`通した HELL ${rows.length}譜面(指のくせ ${data.persona}・種 ${data.seed}・上下の届き ${data.travel})`);
  console.log(`取りこぼしの重さと Lv. の順位の相関: 表示 ${c('shown')} / 今の式(v3) ${c('v3')} / 新しい式(v4) ${c('v4')}(1に近いほど、Lv. の高い譜面ほど取りこぼす)`);
  // Lv. の順位に対して取りこぼしの順位が大きくずれる譜面(表示より難しい/易しい)
  const rl=rank(rows.map(r=>r.loss)),rs=rank(rows.map(r=>r.shown));rows.forEach((r,i)=>{r.gap=Math.round(rl[i]-rs[i]);});
  const line=r=>`  ${short(r.id).padEnd(30)} 表示 ${String(r.shown).padStart(2)} v3 ${String(r.v3).padStart(2)} v4 ${String(r.v4).padStart(2)}  取りこぼし ${(r.loss*100).toFixed(1)}%(MISS・BAD ${(r.miss*100).toFixed(1)}%) 順位のずれ ${r.gap>0?'+':''}${r.gap}`;
  const top=Number(argOf('top',6));
  console.log('表示のわりに取りこぼしが多い(上位):');for(const r of rows.slice().sort((a,b)=>b.gap-a.gap).slice(0,top))console.log(line(r));
  console.log('表示のわりに取りこぼしが少ない(上位):');for(const r of rows.slice().sort((a,b)=>a.gap-b.gap).slice(0,top))console.log(line(r));
  return rows;
};
module.exports={lossOf,rankCorr,LOSS,report};

if(require.main===module){
  if(argOf('report')){report(path.resolve(argOf('report')));process.exit(0);}
  const out=argOf('out');if(!out){console.error('--out <結果.json> か --report <結果.json> を付ける');process.exit(1);}
  const root=path.resolve(argOf('root',ROOT)),jobs=Math.max(1,Number(argOf('jobs',3))||3),persona=argOf('persona','thumb'),seed=argOf('seed','3'),travel=argOf('travel','0.5');
  const only=argOf('only','').split(',').filter(Boolean);
  const file=path.resolve(out),data=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{persona,seed,travel,results:{}};
  const lv=levelsOf(),todo=Object.keys(lv).filter(id=>!(data.results[id]&&data.results[id].counts)&&(!only.length||only.includes(short(id))||only.includes(id)))
    .sort((a,b)=>lv[a].endMs-lv[b].endMs);
  console.log(`通す HELL: ${todo.length}譜面(済み ${Object.keys(data.results).length})・同時に ${jobs}本・ゲームの場所 ${root}`);
  const runOne=id=>new Promise(resolve=>{
    const a=[path.join(root,'tools/playbot/rhythm-cross-swap-bot.js'),'--entry','proto','--song',id,'--diff',lv[id].difficulty,'--from','0','--to',String(lv[id].endMs+400),
      '--persona',persona,'--seed',seed,'--root',root,...(Number(travel)>0?['--travel',travel]:[])];
    const child=spawn(process.execPath,a,{stdio:['ignore','pipe','pipe']});let text='';
    child.stdout.on('data',d=>{text+=d;});child.stderr.on('data',d=>{text+=d;});
    const timer=setTimeout(()=>child.kill('SIGKILL'),lv[id].endMs+240000);
    child.on('close',()=>{clearTimeout(timer);const m=text.match(/^判定 (\{.*\})$/m);let counts=null;try{counts=m?JSON.parse(m[1])['合計']:null;}catch(e){}
      data.results[id]=counts?{counts,notes:lv[id].notes}:{error:text.slice(-300)};
      fs.writeFileSync(file,JSON.stringify(data,null,1));
      console.log(`${counts?'済み':'失敗'} ${short(id)}${counts?` 取りこぼし ${(lossOf(counts)*100).toFixed(1)}%`:''}(残り ${todo.length})`);resolve();});
  });
  (async()=>{const workers=[];for(let w=0;w<jobs;w++)workers.push((async()=>{while(todo.length)await runOne(todo.shift());})());await Promise.all(workers);
    console.log('通し終わり。--report で比べる');})();
}
