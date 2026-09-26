#!/usr/bin/env node
// MHB CHART ENGINE Rev.11(繰り返すたびの発展とラスサビ・主役に合わせた種類・2026-09-26・ROADMAP の段4)を見張る。
//   ・ラスサビ(最後の盛り上がりの区切りで、前に同じ名札の区切りがあるもの)を見つけ、発展の回の小節を譜面に残す
//   ・発展の回の小節に、FLICK・同時押しが Rev.10 より増える(HARD以上)
//   ・新しく FLICK になった音は、どれも FLICK にふさわしい音(音の性格の点が0より大きい)
//   ・同じフレーズの写し率を大きく下げない・押せない配置を作らない
// 音の層の解析を使わずに確かめる(主役に合わせた種類の後押しは、層の解析がある曲だけで効く。rev9 の検査が材料の側を見る)。
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');
const {measure}=require('./rhythm-chart-quality-report.js');
const {measureFeel}=require('./rhythm-chart-feel-report.js');
const {soundTraitsFor,flickScoreOf}=require('./rhythm-sound-traits.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.11 以上',CHART_REVISION_CODE_LATEST>=11);

const trackId='dullahan',dashed='dullahan';
const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`),'utf8'));
const BAR=audio.timing.subdivisionsPerBeat*audio.timing.beatsPerBar;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev11-'));
try{
  const generate=revision=>{
    const dir=path.join(tmp,`rev${revision}`);fs.mkdirSync(dir);
    const result=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',dir],
      {cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
    return {status:result.status,stdout:result.stdout||'',chart:d=>JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-chart-${d}.json`),'utf8'))};
  };
  const rev10=generate(10),rev11=generate(11);
  ok('Rev.10・Rev.11 とも作れる',rev10.status===0&&rev11.status===0);
  ok('ラスサビを見つけて発展の回を出す',/発展の回: [1-9]\d*小節（ラスサビ \d+〜\d+小節/.test(rev11.stdout),(rev11.stdout.match(/発展の回.*/)||[''])[0]);
  const master=rev11.chart('master');
  ok('譜面に発展の回の小節とラスサビが残る',Array.isArray(master.develop?.bars)&&master.develop.bars.length>0&&master.develop.lastChorus!=null);
  ok('Rev.10 の譜面には発展の記録が無い',rev10.chart('master').develop===undefined);
  const developBars=new Set(master.develop.bars);
  const traits=soundTraitsFor(audio);
  let add10=0,add11=0,echo10=0,echo11=0,impossible=0,newFlicks=0,newFlicksBacked=0;
  for(const d of ['hard','expert','master']){
    const c10=rev10.chart(d),c11=rev11.chart(d);
    // 発展で足したもの = 発展の小節の FLICK・同時押しのうち、元の小節の同じ位置では FLICK・同時押しではなかったもの
    //   (元の形を写すので、元の FLICK・同時押しが写されただけでは数えない)
    const sourceBarOf=bar=>{const section=audio.structure.sections.find(x=>bar>=x.startBar&&bar<x.endBarExclusive);return section&&section.repeatOf!=null?section.repeatOf+(bar-section.startBar):null;};
    const count=chart=>{
      const byGrid=new Map();for(const note of chart.notes)byGrid.set(note.grid,(byGrid.get(note.grid)||0)+1);
      const special=grid=>chart.notes.some(note=>note.grid===grid&&!note.chord&&(note.type==='FLICK'||(byGrid.get(grid)||0)>=2));
      return chart.notes.filter(note=>{
        if(note.chord)return false;
        const bar=Math.floor(note.grid/BAR);
        if(!developBars.has(bar)||!special(note.grid))return false;
        const source=sourceBarOf(bar);
        return source==null||!special(source*BAR+(note.grid-bar*BAR));
      }).length;
    };
    add10+=count(c10);add11+=count(c11);
    echo10+=measure(c10,audio).musicality.phraseEcho||0;echo11+=measure(c11,audio).musicality.phraseEcho||0;
    impossible+=measureFeel(c11,audio,{withQuality:false}).impossible;
    const flicks10=new Set(c10.notes.filter(n=>n.type==='FLICK').map(n=>n.grid));
    for(const note of c11.notes)if(note.type==='FLICK'&&!flicks10.has(note.grid)){newFlicks++;if(flickScoreOf(traits.get(note.grid))>0)newFlicksBacked++;}
  }
  ok('発展の回の小節に、元の小節には無い FLICK・同時押しを足す(HARD〜MASTER)',add11>=add10*2&&add11>=add10+5,`${add10} → ${add11}`);
  ok('新しく FLICK になった音は、どれも FLICK にふさわしい音',newFlicks===newFlicksBacked,`${newFlicksBacked}/${newFlicks}`);
  ok('同じフレーズの写し率を大きく下げない',echo11>=echo10-.15,`HARD〜MASTER の合計 ${echo10.toFixed(3)} → ${echo11.toFixed(3)}`);
  ok('押せない配置を作らない(生成直後・両手のシミュレート)',impossible===0,`${impossible}件`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.11(繰り返すたびの発展とラスサビ・主役に合わせた種類)は期待どおり');
process.exit(failed?1:0);
