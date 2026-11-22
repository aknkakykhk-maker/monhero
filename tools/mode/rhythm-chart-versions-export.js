#!/usr/bin/env node
// 譜面を git の版ごとに抜き出して、比べ絵の材料(JSON)にする(2026-11-22・ビート・台帳 r1119-105)。
//
//   node tools/mode/rhythm-chart-versions-export.js --song beyond_the_same_sky --diff HELL \
//        --rev "#7187の前=b35fc9e3^" --rev "#7187=b35fc9e3" --rev "#7198=c5d801a8" --rev "新しい版=WORK" --out <json>
//
//   WORK は作業中のファイル。各版の押さえ中の交差(rhythm-held-cross.js)の秒も一緒に書き出す
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const REL='monster-hero/data/rhythm-mode.js';
const {heldCrosses}=require('./rhythm-held-cross.js');

const args=process.argv.slice(2);const argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
const revs=[];args.forEach((a,i)=>{if(a==='--rev')revs.push(args[i+1]);});

const chartFrom=(source,songId,diff)=>{
  const context={Object,Number,Math,JSON,Array,String,Date,__MH_RHYTHM_CHART_SWITCH:null};
  vm.runInNewContext(`${source}\nthis.out={RHYTHM_SONGS,RHYTHM_PROTO_SONGS:typeof RHYTHM_PROTO_SONGS!=='undefined'?RHYTHM_PROTO_SONGS:[]};`,context);
  const s=context.out.RHYTHM_SONGS.find(x=>x.songId===songId);
  let c=s&&s.difficulties[diff];
  if(!c&&diff==='HELL'){const p=context.out.RHYTHM_PROTO_SONGS.find(x=>x.songId===songId+'_hell_debug');c=p&&p.difficulties.HELL;}
  return c;
};

const songId=argOf('--song'),diff=argOf('--diff');
const out={songId,diff,versions:[]};
for(const r of revs){
  const [label,rev]=r.split('=');
  const source=rev==='WORK'?fs.readFileSync(path.join(ROOT,REL),'utf8'):execFileSync('git',['show',`${rev}:${REL}`],{cwd:ROOT,maxBuffer:1<<28}).toString();
  const c=chartFrom(source,songId,diff);
  const notes=JSON.parse(JSON.stringify(c.notes));
  const crosses=heldCrosses(notes).list.map(x=>x.at);
  out.versions.push({label,rev,level:c.level,count:notes.length,crosses,notes});
  console.log(`${label}(${rev}): ${notes.length} ノーツ・Lv.${c.level}・押さえ中の交差 ${crosses.length}`);
}
fs.writeFileSync(argOf('--out'),JSON.stringify(out));
