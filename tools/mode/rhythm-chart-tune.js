#!/usr/bin/env node
// 狙い(ノーツ数・Lv.)に合う「つまみ」の組み合わせを探す(2026-11-11 フメン。社長「最新モデルで譜面制作ツールを強化したい」)。
//
//   node tools/mode/rhythm-chart-tune.js --track <曲> --target MASTER:notes=600
//   node tools/mode/rhythm-chart-tune.js --track <曲> --target MASTER:level=44 --target EXPERT:notes=420
//   node tools/mode/rhythm-chart-tune.js --track <曲> --target MASTER:notes=600 --json
//
// 【なぜ要るか】社長は「MASTER を600ノーツ前後で」「Lv.44 あたり」「ノーツ数で難しく」のように狙いで言う。それまでは曲の一覧
//   (rhythm-song-registry.json)の challengeFactor・chartIntensity・chartIntensityByDifficulty・masterDensity・sustainScale を
//   人が1つずつ書き換えては作り直して数字を見ていた(ヒューマノイドで5回以上)。ここは同じことを書かずに回して、近い順に並べる。
// 【すること】いまの一覧の設定から始めて、つまみを1つずつ動かした候補を作業用のフォルダへ作る(生成器の --song-settings)。
//   いちばん狙いに近い候補を次の出発点にして、もう1周する(計2周・20〜30回・1回約5秒を4つ並べて回す)。
//   authoring/ も rhythm-mode.js も曲の一覧も書き換えない。決めるのは人(難易度は社長に聞く・⑥-3)。出た設定を一覧へ書いてからパイプラインを通す。
// 【見る数字】自動修正の前の譜面で測る(自動修正・手の仕上げは位置しか動かさないので、ノーツ数は同じ・Lv. は±1ほど動くことがある)。
//   難易度の順(ノーツ数が EASY<…<MASTER)が崩れる候補は「順が崩れる」と出して後ろへ回す。
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawn}=require('child_process');
const {loadAuthoring,reviewOf}=require('./rhythm-chart-review.js');
const args=process.argv.slice(2),argOf=(n,d=null)=>{const i=args.indexOf(n);return i>=0&&i+1<args.length?args[i+1]:d;};
const argsOf=n=>args.map((a,i)=>a===n?args[i+1]:null).filter(Boolean);
const DIFFS=['EASY','NORMAL','HARD','EXPERT','MASTER'];
const INTENSITIES=[null,'mild','strong','extreme'];

const generate=(track,settings)=>new Promise(resolve=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mh-tune-'));
  const child=spawn(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',track,'--write','--output-dir',dir,'--song-settings',JSON.stringify(settings)],{stdio:['ignore','ignore','pipe']});
  let err='';child.stderr.on('data',d=>{err+=d;});
  child.on('close',code=>{let by=null;if(code===0){try{by=reviewOf(loadAuthoring(track,{dir,source:'v3',difficulties:DIFFS}));}catch(e){err+=e.message;}}
    fs.rmSync(dir,{recursive:true,force:true});resolve({settings,by,error:by?null:String(err).slice(-200)});});});
const pool=async(jobs,size=4)=>{const out=[];let i=0;await Promise.all(Array.from({length:size},async()=>{while(i<jobs.length){const k=i++;out[k]=await jobs[k]();}}));return out;};

// 狙いからの遠さ(ノーツ数は割合・Lv. は1つを2.5%として足す)。順が崩れていれば大きく足す
//   狙っていない難易度がいまの数から動くぶんも少し足す(同じ近さなら、ほかの難易度を動かさない候補を前に出す)
const distanceOf=(by,targets,now=null)=>{let d=0;for(const t of targets){const m=by[t.difficulty];if(!m)return Infinity;d+=t.key==='notes'?Math.abs(m.notes-t.value)/t.value:Math.abs(m.level-t.value)*.025;}
  if(now){const others=DIFFS.filter(x=>by[x]&&now[x]&&!targets.some(t=>t.difficulty===x));if(others.length)d+=.25*others.reduce((a,x)=>a+Math.abs(by[x].notes-now[x].notes)/now[x].notes,0)/others.length;}
  return d;};
const orderBroken=by=>{for(let i=1;i<DIFFS.length;i++)if(by[DIFFS[i]]&&by[DIFFS[i-1]]&&by[DIFFS[i]].notes<=by[DIFFS[i-1]].notes)return `${DIFFS[i-1]} ${by[DIFFS[i-1]].notes} ≧ ${DIFFS[i]} ${by[DIFFS[i]].notes}`;return '';};
const keyOf=s=>JSON.stringify(Object.keys(s).sort().map(k=>[k,s[k]]));
// つまみを1つ動かした近所。動かすのは狙いの難易度に効くものだけ
const neighbours=(base,targets,auto)=>{const out=[],push=o=>out.push({...base,...o});
  const cf=Number(base.challengeFactor)||auto||1;
  for(const m of [.85,.93,1.08,1.18])push({challengeFactor:Math.round(cf*m*100)/100});
  for(const v of INTENSITIES)if((base.chartIntensity||null)!==v)push({chartIntensity:v});
  for(const d of new Set(targets.map(t=>t.difficulty))){
    const cur=(base.chartIntensityByDifficulty||{})[d]||null;
    for(const v of INTENSITIES)if(v!==cur){const by={...(base.chartIntensityByDifficulty||{})};if(v)by[d]=v;else delete by[d];push({chartIntensityByDifficulty:Object.keys(by).length?by:null});}
    const ss=(base.sustainScale||{})[d];
    for(const v of [null,.7,.4,.2])if((ss??null)!==v){const by={...(base.sustainScale||{})};if(v==null)delete by[d];else by[d]=v;push({sustainScale:Object.keys(by).length?by:null});}
    if(d==='MASTER')for(const v of [null,1.2,1.4,1.6,1.8])if((base.masterDensity||null)!==v)push({masterDensity:v});
  }
  return out;};
const KNOBS=['challengeFactor','chartIntensity','chartIntensityByDifficulty','masterDensity','sustainScale'];
const shown=s=>{const o={};for(const k of KNOBS)if(s[k]!=null)o[k]=s[k];return Object.keys(o).length?JSON.stringify(o):'(つまみなし=自動)';};

(async()=>{
  const track=argOf('--track');
  const targets=argsOf('--target').map(t=>{const m=String(t).match(/^([A-Za-z]+):(notes|level)=(\d+(?:\.\d+)?)$/);if(!m)throw new Error(`--target は MASTER:notes=600 か MASTER:level=44 の形: ${t}`);
    return {difficulty:m[1].toUpperCase(),key:m[2],value:Number(m[3])};});
  if(!track||!targets.length){console.error('使い方: --track <曲> --target MASTER:notes=600 [--target EXPERT:level=27]');process.exit(1);}
  if(targets.some(t=>!DIFFS.includes(t.difficulty)))throw new Error('狙えるのは EASY〜MASTER(HELL は rhythm-hell-mix.js の hellDensity・phrases)');
  const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring','rhythm-song-registry.json'),'utf8')).songs||{};
  if(!registry[track])throw new Error(`曲の一覧に無い: ${track}`);
  const start=Object.fromEntries(KNOBS.map(k=>[k,registry[track][k]??null]));
  const seen=new Map(),run=async list=>{const fresh=list.filter(s=>!seen.has(keyOf(s)));for(const s of fresh)seen.set(keyOf(s),null);
    const res=await pool(fresh.map(s=>()=>generate(track,s)));for(const r of res)seen.set(keyOf(r.settings),r);};
  await run([start]);
  const first=seen.get(keyOf(start));if(!first.by)throw new Error(`いまの設定で作れない: ${first.error}`);
  let best=start;
  for(let round=0;round<2;round++){
    await run(neighbours(best,targets,null));
    const ranked=[...seen.values()].filter(r=>r&&r.by).map(r=>({...r,broken:orderBroken(r.by),distance:distanceOf(r.by,targets,first.by)})).sort((a,b)=>(a.broken?1:0)-(b.broken?1:0)||a.distance-b.distance);
    if(keyOf(ranked[0].settings)===keyOf(best))break;best=ranked[0].settings;
  }
  const ranked=[...seen.values()].filter(r=>r&&r.by).map(r=>({...r,broken:orderBroken(r.by),distance:distanceOf(r.by,targets,first.by)})).sort((a,b)=>(a.broken?1:0)-(b.broken?1:0)||a.distance-b.distance);
  if(args.includes('--json')){console.log(JSON.stringify(ranked.slice(0,10).map(r=>({settings:r.settings,broken:r.broken,distance:r.distance,by:Object.fromEntries(Object.entries(r.by).map(([d,m])=>[d,{notes:m.notes,level:m.level,nps:m.nps,peak4s:m.peak4s}]))}))));return;}
  const row=by=>DIFFS.map(d=>by[d]?`${d[0]} ${by[d].notes}/Lv.${by[d].level}`:'').join('  ');
  console.log(`狙い: ${targets.map(t=>`${t.difficulty} ${t.key==='notes'?'ノーツ':'Lv.'} ${t.value}`).join('・')}   (試した ${ranked.length} 通り・書き込みなし)`);
  console.log(`いま: ${row(first.by)}   ${shown(start)}`);
  console.log('近い順:');
  for(const r of ranked.slice(0,6))console.log(`  ${row(r.by)}${r.broken?`  ※順が崩れる(${r.broken})`:''}\n      ${shown(r.settings)}`);
  console.log('\n決めたら、その設定を tools/mode/authoring/rhythm-song-registry.json のその曲へ書いてから、パイプライン → rhythm-chart-review.js で点検する。');
  console.log('(難易度は社長に聞いてから決める。上の数字は自動修正の前のもので、Lv. は仕上げで±1ほど動くことがある)');
})().catch(e=>{console.error(e.message||e);process.exit(1);});
