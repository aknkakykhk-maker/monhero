// MHB CHART ENGINE Rev.29(モンスターノーツを必ず4個)を確かめる(2026-10-11 社長「どの曲も基本4個入るルールだよ」)。
//   ・作り方の最新は Rev.29 以上
//   ・Rev.29 で作ると、どの難易度もモンスターノーツが4個ちょうど(枠1〜4を1個ずつ)
//   ・Rev.28 で作ると、これまでどおり(Monster Hero の MASTER は条件に合う単打が無く3個のまま=既存曲の作り方は変えない・⑩-2)
//
//   node tools/mode/rhythm-chart-rev29-check.js
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../..');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');

let failed=0;
const ok=(name,pass,detail='')=>{console.log(`${pass?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!pass)failed++;};

ok('作り方の最新は Rev.29 以上',CHART_REVISION_CODE_LATEST>=29,String(CHART_REVISION_CODE_LATEST));

const trackId='monster_hero_theme',dashed='monster-hero-theme';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev29-'));
const slotsOf=(revision)=>{
  const dir=path.join(tmp,`rev${revision}`);fs.mkdirSync(dir,{recursive:true});
  const result=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',dir],
    {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
  if(result.status!==0)return null;
  return Object.fromEntries(['easy','normal','hard','expert','master'].map(d=>{
    const chart=JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-chart-${d}.json`),'utf8'));
    const notes=Array.isArray(chart)?chart:chart.notes||[];
    return [d,notes.filter(note=>Number(note.monsterSlot)>0).map(note=>Number(note.monsterSlot)).sort((a,b)=>a-b).join(',')];
  }));
};
try{
  const rev29=slotsOf(29),rev28=slotsOf(28);
  ok('Rev.28・Rev.29 とも作れる',!!rev29&&!!rev28);
  if(rev29)ok('Rev.29 はどの難易度も枠1〜4を1個ずつ',Object.values(rev29).every(s=>s==='1,2,3,4'),JSON.stringify(rev29));
  if(rev28)ok('Rev.28 はこれまでどおり(MASTER は3個のまま=既存曲の作り方を変えない)',rev28.master!=='1,2,3,4',JSON.stringify(rev28));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}

if(failed){console.log(`\n${failed}件のNGがあります`);process.exit(1);}
console.log('\nすべてOK');
