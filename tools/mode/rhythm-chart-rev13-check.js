#!/usr/bin/env node
// MHB CHART ENGINE Rev.13(旋律の有無・2026-09-26・最初にもらった案の1)を見張る。
//   ・主役の追跡: 旋律の音高がほとんど取れない小節では、歌・主旋律の帯が強くても「メロディを追う」を選ばない
//   ・旋律の有無を渡さなければ Rev.9〜12 と同じ決め方
//   ・生成器は Rev.13 以降のときだけ旋律の有無を渡す。実際に作ると、メロディを追う小節は旋律の取れている小節へ絞られる
'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const {spawnSync}=require('child_process');
const {trackFocus,FOCUS_MELODY_MIN_PRESENCE}=require('./rhythm-chart-focus.js');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.13 以上',CHART_REVISION_CODE_LATEST>=13);

// ── 1. 主役の追跡 ──
{
  const BAR=16,bars=16,percussive=[],lead=[];
  // 全部の小節で歌・主旋律の帯が前に出ている。ただし 8〜15 小節は旋律の音高が取れない(伴奏だけ)
  for(let b=0;b<bars;b++)for(let g=0;g<BAR;g++){percussive.push(.4);lead.push(.6);}
  const layers={grid:{firstGrid:0},series:{percussive,lead}};
  const presence=new Map();for(let b=0;b<bars;b++)presence.set(b,b<8?.7:0);
  const sectionStarts=new Set([0,8]);
  const without=trackFocus(layers,{bar:BAR,sectionStarts}).byBar;
  const withPresence=trackFocus(layers,{bar:BAR,sectionStarts,melodyPresence:presence}).byBar;
  ok('旋律の有無を渡さなければ、歌・主旋律の帯が前に出る小節は全部メロディを追う',[...without.values()].every(s=>s==='melody'));
  ok('旋律の取れる小節はメロディを追う',[0,1,2,3,4,5,6,7].every(b=>withPresence.get(b)==='melody'));
  ok(`旋律の音高が取れない小節(${FOCUS_MELODY_MIN_PRESENCE*100}%未満)ではメロディを追わない`,[8,9,10,11,12,13,14,15].every(b=>withPresence.get(b)!=='melody'));
}

// ── 2. 生成器 ──
{
  const source=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
  ok('生成器は Rev.13 以降のときだけ旋律の有無を渡す',/const melodyPresence=chartRevision>=13\?/.test(source)&&/trackFocus\(layers,\{bar:BAR,sectionStarts,melodyPresence\}\)/.test(source));
  const trackId='monster_hero_theme',dashed='monster-hero-theme';
  const audioFile=path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`);
  const audio=JSON.parse(fs.readFileSync(audioFile,'utf8'));
  const BAR=audio.timing.subdivisionsPerBeat*audio.timing.beatsPerBar;
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev13-'));
  try{
    // 検査の中で作った層の解析: 全部の小節で歌・主旋律の帯が前に出ている(旋律の有無だけが決め手になる)
    const lastGrid=Math.max(...audio.onsets.map(o=>o.grid).filter(Number.isFinite))+BAR;
    const layers={schemaVersion:1,analysisType:'rhythm-audio-layers-v3',
      basedOn:{file:path.basename(audioFile),sha256:crypto.createHash('sha256').update(fs.readFileSync(audioFile)).digest('hex')},
      grid:{firstGrid:0,count:lastGrid+1},series:{percussive:Array(lastGrid+1).fill(.4),lead:Array(lastGrid+1).fill(.6),harmonic:Array(lastGrid+1).fill(.6),high:Array(lastGrid+1).fill(.4)},
      onsets:audio.onsets.map(o=>({timeMs:o.timeMs,drums:[],percussiveShare:.2}))};
    const input=path.join(tmp,'in');fs.mkdirSync(input);
    fs.copyFileSync(audioFile,path.join(input,`${dashed}-v3-audio.json`));
    fs.writeFileSync(path.join(input,`${dashed}-v3-layers.json`),JSON.stringify(layers));
    const generate=revision=>{
      const out=path.join(tmp,`rev${revision}`);fs.mkdirSync(out);
      const result=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--difficulty','MASTER','--input-dir',input,'--write','--output-dir',out],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
      const chart=JSON.parse(fs.readFileSync(path.join(out,`${dashed}-v3-chart-master.json`),'utf8'));
      return {status:result.status,bars:new Map((chart.focus?.bars||'').split(' ').filter(Boolean).map(x=>{const [b,s]=x.split(':');return [Number(b),s];}))};
    };
    const rev12=generate(12),rev13=generate(13);
    const presence=new Map();
    for(const point of audio.pitchCurve||[]){const bar=Math.floor(point.grid/BAR),o=presence.get(bar)||{n:0,c:0};o.n++;if(point.clarity>=.5&&point.hz>0)o.c++;presence.set(bar,o);}
    const melodyBars=r=>[...r.bars.entries()].filter(([,s])=>s==='v').map(([b])=>b);
    const low=r=>melodyBars(r).filter(b=>{const o=presence.get(b);return !o||o.c/o.n<FOCUS_MELODY_MIN_PRESENCE;}).length;
    ok('Rev.12・Rev.13 とも作れる',rev12.status===0&&rev13.status===0);
    // フレーズの途中で1小節だけ旋律が途切れる所(息継ぎ)は、切り替えのコストでそのまま追い続けるので0にはならない
    ok('Rev.13 は旋律の取れない小節でメロディを追う数が半分以下になる',low(rev12)>0&&low(rev13)*2<=low(rev12),`旋律の取れない小節でメロディを追う数 Rev.12 ${low(rev12)} → Rev.13 ${low(rev13)}`);
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.13(旋律の有無)は期待どおり');
process.exit(failed?1:0);
