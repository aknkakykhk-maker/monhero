#!/usr/bin/env node
// HELL の作り方の「精度の強化」(rhythm-hell-mix.js の precision・2026-11-11)と、作りの点検(rhythm-hell-review.js)の決まりを見張る。
//
//   node tools/mode/rhythm-hell-precision-check.js
//
// ① precision を書いた曲は、空中・地上の回し方を小節の盛り上がりで決める(静かな小節は地上・盛り上がる小節は両手が空)。量は順番で回したときと同じ
// ② precision を書いていない曲は、今までどおり順番で回す(作る譜面は変わらない)。公開中の曲の設定に precision は書かれていない
// ③ 仕上げ(settleSwitches)は、同じ親指の速い持ち替えに関わる空中のタップを地上へ下ろす。ノーツの数・時刻・位置は変えない
// ④ 空中の量は、順番で回したときの9割を下回らない所まで寄せる(下回るときは両手が空の小節を増やす)
// ⑤ 点検(rhythm-hell-review.js)は公開中の HELL を読むだけで数えられ、ゲームのデータを書き換えない
// ⑥ Rev.39(2026-11-11 社長の決定 A): HELL の骨組みは短い動機の写しを使わない(生成器 --difficulty HELL。試すときだけ --hell-motifs)
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const M=require('./rhythm-hell-mix.js'),R=require('./rhythm-hell-review.js'),HR=require('./rhythm-chart-hand-rules.js');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const DATA=path.resolve(__dirname,'..','..','monster-hero/data/rhythm-mode.js'),sha=()=>crypto.createHash('sha256').update(fs.readFileSync(DATA)).digest('hex'),before=sha();

// 16小節の小さい譜面(1拍ごとに左右交互のタップ)。盛り上がりは 静か4小節 → 中4 → 山4 → 中4
const beat=500,bar=2000,E=[.1,.1,.1,.1,.5,.5,.5,.5,.9,.9,.9,.9,.5,.5,.5,.5];
const master=()=>{const out=[];for(let b=0;b<16;b++)for(let k=0;k<4;k++)out.push({k:'t',t:b*bar+k*beat,sub:k%2?8:2,w:2,sky:0});return out;};
const audio={structure:{bars:E.map((e,i)=>({bar:i,intensity:e,startMs:i*bar,endMs:(i+1)*bar}))}};
const run=precision=>M.mixBest(master(),{zero:0,beat,crosses:[],audio,drawersOn:false,precision});
const perBar=out=>E.map((e,i)=>out.filter(n=>n.sky&&n.t>=i*bar&&n.t<(i+1)*bar).length);
const sum=a=>a.reduce((x,y)=>x+y,0);
const plain=run(false),fine=run(true),pp=perBar(plain),pf=perBar(fine);
// ①
ok('precision: 静かな4小節に空中のタップを置かない',sum(pf.slice(0,4))===0,pf.join(' '));
ok('precision: 山の4小節は両手が空(1小節4つとも空中)',pf.slice(8,12).every(v=>v===4),pf.join(' '));
ok('precision: 中くらいの小節は片手が空(左右を交互に)',pf.slice(4,8).every(v=>v===2)&&(()=>{const side=i=>fine.find(n=>n.sky&&n.t>=i*bar&&n.t<(i+1)*bar).sub<6?'L':'R';return side(4)!==side(5)&&side(5)!==side(6);})(),pf.join(' '));
ok('precision: 空中の量は順番で回したときと同じ',sum(pf)===sum(pp),`${sum(pp)} → ${sum(pf)}`);
ok('precision: 空中の量と盛り上がりの順位の相関が上がる',R.rankCorr(E,pf)>.8&&R.rankCorr(E,pf)>R.rankCorr(E,pp)+.4,`${R.rankCorr(E,pp)} → ${R.rankCorr(E,pf)}`);
// ②
ok('書いていなければ順番で回す(左・右・地上・両手)',pp.slice(0,4).join(',')==='2,2,0,4'&&!plain.precision&&!plain.settle,pp.slice(0,8).join(' '));
{const released=Object.entries(M.SONGS).filter(([,c])=>c.precision);
  const rt=require('./rhythm-chart-level.js').loadRuntimeSongs(),live=new Set((rt.RHYTHM_PROTO_SONGS||[]).map(s=>String(s.songId).replace(/_hell_debug$/,'')));
  // precision を書くのは、これから作る曲だけ。2026-11-11 より前に公開した HELL の設定には書かない(作り直したとき譜面が変わる)
  const OLD=['sheriruth','kaze_ga_soyogu','against_my_own_shadow','rose','rose_short','sad_song','sad_song_short','black_shout','light_player','light_player_short','tsuki_ga_michiru_mae_ni','tsuki_ga_michiru_mae_ni_short','rebellion','rebellion_short','altar_world_tree','altar_world_tree_short','humanoid','evans','toward_the_stars_short'];
  ok('2026-11-11 より前に公開した HELL の設定に precision を書いていない',released.every(([id])=>!OLD.includes(id)),released.map(x=>x[0]).join(','));
  ok('公開中の HELL が読める',live.size>=40,String(live.size));}
// ③ 同じ側の地上タップの 100ms あとに空中タップ → 下ろす
{const notes=[{k:'t',t:0,sub:2,w:2,sky:0},{k:'t',t:100,sub:2,w:2,sky:1},{k:'t',t:1000,sub:8,w:2,sky:1},{k:'t',t:2000,sub:2,w:2,sky:0},{k:'t',t:3000,sub:8,w:2,sky:0},{k:'t',t:4000,sub:2,w:2,sky:0},{k:'t',t:5000,sub:8,w:2,sky:0},{k:'t',t:6000,sub:2,w:2,sky:0}];
  const beforeCount=HR.sideHeightSwitch(M.toRuntime(notes)).length,keep=notes.map(n=>`${n.t}:${n.sub}:${n.w}`).join('|');
  M.settleSwitches(notes);
  ok('仕上げ: 150ms以内の持ち替えの空中タップを地上へ下ろす',beforeCount===1&&HR.sideHeightSwitch(M.toRuntime(notes)).length===0&&notes[1].sky===0&&notes.settle.lowered===1,JSON.stringify(notes.settle));
  ok('仕上げ: 関係ない空中タップはそのまま・時刻と位置は変えない',notes[2].sky===1&&notes.map(n=>`${n.t}:${n.sub}:${n.w}`).join('|')===keep);}
// ④
ok('空中の量を保つ割合は9割',M.PRECISION_SKY_KEEP===.9&&fine.precision&&fine.precision.sky>=fine.precision.baseSky*.9,JSON.stringify(fine.precision));
// ⑤
{const rows=R.releasedRows(),m=R.measure(M.toRuntime(fine),null);
  ok('点検: 公開中の HELL を数えられる(40譜面以上・速い持ち替えと合い方が出る)',rows.length>=40&&rows.every(r=>Number.isFinite(r.sw150)&&Number.isFinite(r.sky250))&&rows.some(r=>r.energySky!=null),`${rows.length}譜面`);
  ok('点検: 解析が無くても数えられる',m.notes===64&&m.offSound===null);
  ok('点検と作る道具は、ゲームのデータを書き換えない',sha()===before);}

// ⑥ 短い曲(ROSE short ver.)の HELL の骨組みを作業用のフォルダへ作る(authoring には書かない)
{const os=require('os'),{spawnSync}=require('child_process'),rev=require('./rhythm-chart-v3-revision.js');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mh-hell39-')),gen=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
  const r=spawnSync(process.execPath,[path.join(__dirname,'rhythm-chart-v3-generate.js'),'--track','rose_short','--difficulty','HELL','--variant','2','--output-dir',dir,'--write'],{encoding:'utf8',maxBuffer:64*1024*1024});
  const f=path.join(dir,'rose-short-v3-chart-hell.json'),chart=r.status===0&&fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null;
  ok('作り方の最新は Rev.39 以上',rev.CHART_REVISION_CODE_LATEST>=39,String(rev.CHART_REVISION_CODE_LATEST));
  ok('HELL の骨組みは短い動機の写しを使わない(写した小節 0)',!!chart&&chart.motifs&&chart.motifs.bars===0,chart?`写した小節 ${chart.motifs&&chart.motifs.bars}・ノーツ ${chart.notes.length}`:String(r.stderr||r.stdout).slice(-200));
  ok('試すときの入口(--hell-motifs)がある',/--hell-motifs/.test(gen));
  fs.rmSync(dir,{recursive:true,force:true});
  ok('骨組みを作っても、ゲームのデータを書き換えない',sha()===before);}

console.log(failed?`\n${failed} 件の NG`:'\nすべて OK');
process.exit(failed?1:0);
