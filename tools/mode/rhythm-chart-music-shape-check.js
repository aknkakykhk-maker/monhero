#!/usr/bin/env node
// 曲の形に合わせる(MHB CHART ENGINE Rev.38・2026-11-11 社長「1→2→3 の順で」=サビ見つけ → 盛り上がりに合わせた配り → 同じ動機は同じ手)の決まりを見張る。
//
//   node tools/mode/rhythm-chart-music-shape-check.js
//
// ① 既定は切: 指定も曲の一覧の musicShape も無ければ、--no-music-shape を付けたときと1バイトも同じ譜面になる(公開中の曲は作り直さない・⑩-2)
// ② 前からある曲(Rev.37 以下で作った曲)の一覧に musicShape を書いていない(書くのは、社長が新曲の既定にすると決めたあとの新曲だけ)
// ③ サビ見つけは乱数を使わず、知っている曲で外さない(only my railgun のサビは 52秒から・crossing field は 46秒から)。区切りが3つ未満の曲では決めつけない
// ④ --music-shape を付けると譜面が変わり、同じレーンへ写せたかたまりが減らない・サビ/ほかの密度の比が下がらない
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {chorusForTrack,detectChorus}=require('./rhythm-chart-chorus.js');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const gen=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
ok('既定は切(--music-shape か曲の一覧の musicShape:true のときだけ効く)',/let MUSIC_SHAPE=process\.argv\.includes\('--music-shape'\)&&!process\.argv\.includes\('--no-music-shape'\);/.test(gen)
  &&/entry&&entry\.musicShape===true&&!process\.argv\.includes\('--no-music-shape'\)\)MUSIC_SHAPE=true/.test(gen));
const songs=JSON.parse(fs.readFileSync(path.join(__dirname,'authoring','rhythm-song-registry.json'),'utf8')).songs||{};
const FIRST_REVISION=38,flagged=Object.entries(songs).filter(([,e])=>e&&e.musicShape===true).map(([id])=>id);
ok('前からある曲(Rev.37 以下)には musicShape を書いていない',flagged.filter(id=>!(Number(songs[id].chartRevision)>=FIRST_REVISION)).length===0,flagged.join(' ')||'なし');
// ③
const starts=track=>chorusForTrack(track).chorus.sections.filter(s=>s.chorus).map(s=>Math.round(s.startMs/1000));
const rail=chorusForTrack('only_my_railgun').chorus,cross=starts('crossing_field');
ok('only my railgun のサビは 52秒から(はっきり見つかる)',rail.confident&&starts('only_my_railgun').includes(52),starts('only_my_railgun').join(' '));
ok('crossing field のサビは 46秒から',cross.includes(46),cross.join(' '));
ok('同じ入力なら同じ結果(乱数を使わない)',JSON.stringify(starts('humanoid'))===JSON.stringify(starts('humanoid')));
{const {audio}=chorusForTrack('only_my_railgun'),few={...audio,structure:{...audio.structure,sections:audio.structure.sections.slice(0,2)}};
  ok('区切りが3つ未満の曲では決めつけない',detectChorus(few,null).confident===false);}
// ①④ 実際に作って比べる(短い曲・書き込みなし)
const track='rose_short',run=flags=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mh-shape-'));
  const r=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track',track,'--output-dir',dir,'--write',...flags],{encoding:'utf8',maxBuffer:64*1024*1024});
  const out={ok:r.status===0,log:String(r.stdout||''),master:r.status===0?JSON.parse(fs.readFileSync(path.join(dir,'rose-short-v3-chart-master.json'),'utf8')):null};fs.rmSync(dir,{recursive:true,force:true});return out;};
const plain=run([]),off=run(['--no-music-shape']),on=run(['--music-shape']);
ok(`指定なしは --no-music-shape と1バイトも同じ(${track} MASTER)`,plain.ok&&off.ok&&JSON.stringify(plain.master.notes)===JSON.stringify(off.master.notes),plain.master?`${plain.master.notes.length}ノーツ`:'作れなかった');
const copied=log=>{let p=0;for(const m of log.matchAll(/同じレーンへ写したかたまり (\d+)\/(\d+)/g))p+=Number(m[1]);return p;};
ok('--music-shape を付けると譜面が変わり、写せたかたまりが減らない',on.ok&&JSON.stringify(on.master.notes)!==JSON.stringify(off.master.notes)&&copied(on.log)>=copied(off.log),`写せたかたまり ${copied(off.log)} → ${copied(on.log)}`);
{const c=chorusForTrack(track).chorus,audio=chorusForTrack(track).audio,t=audio.timing,gridMs=t.gridMs||t.beatMs/t.subdivisionsPerBeat,ch=c.sections.filter(s=>s.chorus);
  const lift=chart=>{const ms=chart.notes.map(n=>t.beatZeroMs+n.grid*gridMs),inC=x=>ch.some(s=>x>=s.startMs&&x<s.endMs),cSec=ch.reduce((a,s)=>a+(s.endMs-s.startMs),0)/1000,all=(Math.max(...ms)-Math.min(...ms))/1000,cN=ms.filter(inC).length;return (cN/cSec)/((ms.length-cN)/(all-cSec));};
  ok('サビ/ほかの密度の比が下がらない',lift(on.master)>=lift(off.master)-.02,`${lift(off.master).toFixed(2)} → ${lift(on.master).toFixed(2)}`);
  ok('書き出しにサビの区切りを残す(musicShape)',!!on.master.musicShape&&Array.isArray(on.master.musicShape.chorus)&&!off.master.musicShape);}
console.log(failed?`\n${failed}件 NG`:'\nすべてOK');process.exit(failed?1:0);
