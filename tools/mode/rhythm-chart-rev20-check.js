#!/usr/bin/env node
// MHB CHART ENGINE Rev.20(歯ごたえの測り方をテンポの数字から切り離す・2026-09-29)を見張る。
//   ・Rev.20 から歯ごたえのテンポの効きを0.35乗、拍のはっきりさを0.15乗へ弱める(Rev.19 までは今までどおり)
//   ・人が歯ごたえを決めた曲(一覧の challengeFactor)について、自動の値が人の決めた値へ近づく
//   ・決めていない曲の自動の値はほとんど動かない(いまの帯を崩さない)
//   ・決めた歯ごたえを書いた曲は、Rev.19 と Rev.20 で同じ量になる
'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
const {CHART_REVISION_CODE_LATEST}=require('./rhythm-chart-v3-revision.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('作り方の最新は Rev.20 以上',CHART_REVISION_CODE_LATEST>=20);

const generator=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
const constant=(name,keys)=>{
  const m=new RegExp(`const ${name}=Object\\.freeze\\(\\{([^}]*)\\}\\)`).exec(generator);
  if(!m)return null;
  const out={};for(const part of m[1].split(',')){const [k,v]=part.split(':');out[k.trim()]=Number(v);}
  return keys.every(k=>Number.isFinite(out[k]))?out:null;
};
const REF=constant('CHALLENGE_REFERENCE',['bpm','onsetsPerSecond','beatClarity']);
const OLD=constant('CHALLENGE_EXPONENT',['bpm','onsets','beatClarity']);
const NEW=constant('CHALLENGE_EXPONENT_REV20',['bpm','onsets','beatClarity']);
const RATIO=constant('CHALLENGE_RATIO_RANGE',['min','max']),RANGE=constant('CHALLENGE_RANGE',['min','max']);
const GAIN=Number((/const CHALLENGE_GAIN=([\d.]+);/.exec(generator)||[])[1]);
ok('Rev.20 の効きが書いてあり、テンポと拍のはっきりさを弱めている',!!(REF&&OLD&&NEW&&RATIO&&RANGE&&GAIN)
  &&NEW.bpm<OLD.bpm&&NEW.beatClarity<OLD.beatClarity&&NEW.onsets===OLD.onsets);
ok('Rev.20 からだけ使う',/const CHALLENGE_DECOUPLE_REVISION=20;/.test(generator)
  &&/const exponent=chartRevision>=CHALLENGE_DECOUPLE_REVISION\?CHALLENGE_EXPONENT_REV20:CHALLENGE_EXPONENT;/.test(generator));

if(REF&&OLD&&NEW&&RATIO&&RANGE&&GAIN){
  const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring','rhythm-song-registry.json'),'utf8')).songs;
  const ratio=(value,reference,exponent)=>!(value>0)?1:Math.max(RATIO.min,Math.min(RATIO.max,Math.pow(value/reference,exponent)));
  const factorOf=(audio,exponent)=>{
    const seconds=Number(audio.durationMs)/1000;
    const raw=ratio(Number(audio.timing.bpm),REF.bpm,exponent.bpm)
      *ratio(Number(audio.summary.onsetCount)/seconds,REF.onsetsPerSecond,exponent.onsets)
      *ratio(Number(audio.summary.beatClarity&&audio.summary.beatClarity.ratio),REF.beatClarity,exponent.beatClarity);
    return Math.max(RANGE.min,Math.min(RANGE.max,Math.pow(raw,GAIN)));
  };
  const pinnedOld=[],pinnedNew=[],moved=[];
  for(const [trackId,entry] of Object.entries(registry)){
    const file=path.join(__dirname,'authoring',`${trackId.replace(/_/g,'-')}-v3-audio.json`);
    if(!fs.existsSync(file))continue;
    const audio=JSON.parse(fs.readFileSync(file,'utf8'));
    const before=factorOf(audio,OLD),after=factorOf(audio,NEW);
    const pin=Number(entry.challengeFactor);
    if(pin>0){pinnedOld.push(Math.abs(Math.log(before/pin)));pinnedNew.push(Math.abs(Math.log(after/pin)));}
    else moved.push(Math.abs(Math.log(after/before)));
  }
  const mean=list=>list.reduce((a,b)=>a+b,0)/Math.max(1,list.length);
  ok('人が決めた歯ごたえへ、自動の値が近づく(ずれの対数の平均が 0.2 以上縮む)',pinnedOld.length>=5&&mean(pinnedNew)<=mean(pinnedOld)-.2,
    `${pinnedOld.length}曲 ${mean(pinnedOld).toFixed(3)} → ${mean(pinnedNew).toFixed(3)}`);
  ok('決めていない曲の自動の値はほとんど動かない(対数の平均 0.2 以下)',moved.length>=10&&mean(moved)<=.2,
    `${moved.length}曲 平均 ${mean(moved).toFixed(3)}・最大 ${Math.max(...moved).toFixed(3)}`);
}

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mh-rev20-'));
try{
  const generate=(trackId,revision)=>{
    const dir=path.join(tmp,`${trackId}-${revision}`);fs.mkdirSync(dir);
    spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',trackId,'--chart-revision',String(revision),'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
    const dashed=trackId.replace(/_/g,'-');
    return difficulty=>JSON.parse(fs.readFileSync(path.join(dir,`${dashed}-v3-chart-${difficulty}.json`),'utf8'));
  };
  // 決めた歯ごたえを書いた曲は同じ
  const p19=generate('six_eternel_beat',19),p20=generate('six_eternel_beat',20);
  const same=['easy','master'].every(d=>p19(d).noteCount===p20(d).noteCount&&p20(d).policy.songChallenge.pinned===true);
  ok('決めた歯ごたえを書いた曲は Rev.19 と Rev.20 で同じ量',same,['easy','master'].map(d=>`${d} ${p19(d).noteCount}/${p20(d).noteCount}`).join(' / '));
  // 決めていない遅い曲(拍の立ちが強い)は、テンポと拍の立ちを二重に数えなくなるぶん軽くなる
  const d19=generate('dullahan',19),d20=generate('dullahan',20);
  ok('決めていない曲では Rev.20 の歯ごたえが使われる',d20('hard').policy.songChallenge.factor<d19('hard').policy.songChallenge.factor
    &&d20('hard').noteCount<d19('hard').noteCount,
    `歯ごたえ ${d19('hard').policy.songChallenge.factor.toFixed(2)} → ${d20('hard').policy.songChallenge.factor.toFixed(2)} / HARD ${d19('hard').noteCount} → ${d20('hard').noteCount}`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
console.log(failed?`\n✗ ${failed}件NG`:'\n✓ Rev.20(歯ごたえをテンポの数字から切り離す)は期待どおり');
process.exit(failed?1:0);
