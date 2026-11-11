#!/usr/bin/env node
// 譜面の点検・手の仕上げ・つまみ探し(2026-11-11・MHB CHART ENGINE Rev.37)の決まりを見張る。
//
//   node tools/mode/rhythm-chart-review-check.js
//
// ① 点検(rhythm-chart-review.js)は公開中の譜面と作った譜面を同じ物差しで測れ、帯(chart-review-bands.json)が6難易度ぶんある
// ② 生成 → 自動修正 → 手の仕上げ(must)を作業用のフォルダで通すと、モンスターノーツは4個・押さえている帯の中は0個になる
//    (どちらも、それまで新曲のたびに人が公開前に直していた)。手の仕上げはノーツの数・時刻・種類を変えない
// ③ いやらしい形を減らす仕上げ(keep-climax)は、交差+真ん中越えを減らし、跳びを増やさない。既定は EXPERT・MASTER が keep-climax・ほかは must(2026-11-11 社長の決定 A)
// ④ どの道具も、ゲームのデータ(rhythm-mode.js)・曲の一覧・authoring の譜面を書き換えない
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto');
const {spawnSync}=require('child_process');
const R=require('./rhythm-chart-review.js');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const ROOT=path.resolve(__dirname,'..','..');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const WATCH=[path.join(ROOT,'monster-hero/data/rhythm-mode.js'),path.join(__dirname,'authoring','rhythm-song-registry.json'),path.join(__dirname,'authoring','rose-short-v3-fixed-master.json')];
const beforeSha=WATCH.map(sha);

// ①
const bands=R.readBands();
ok('帯のファイルがあり、6難易度ぶんある',!!bands&&R.DIFFS.every(d=>bands.byDifficulty[d]&&bands.byDifficulty[d].nps&&bands.byDifficulty[d].nps.n>=20),bands?`${bands.songs}曲・${bands.charts}譜面`:'無い(--calibrate で作る)');
const released=R.reviewOf(R.loadReleased('humanoid'));
ok('公開中の譜面を測れる(ヒューマノイド MASTER 606ノーツ・HELL も)',released.MASTER&&released.MASTER.notes===606&&released.MASTER.monsters===4&&!!released.HELL,released.MASTER?`MASTER ${released.MASTER.notes}ノーツ Lv.${released.MASTER.level}`:'');
ok('Lv. はゲームのレベル表と同じ式で出る(ヒューマノイド MASTER 50)',released.MASTER&&released.MASTER.level===50,String(released.MASTER&&released.MASTER.level));

// ②③ 短い曲(ROSE short ver.)を作業用のフォルダで通す。MASTER のモンスターが2〜3個・帯の中が残る曲
const track='rose_short',dir=fs.mkdtempSync(path.join(os.tmpdir(),'mh-review-')),run=(tool,a)=>spawnSync(process.execPath,[path.join(__dirname,tool),'--track',track,...a],{encoding:'utf8',maxBuffer:64*1024*1024});
try{
  const g=run('rhythm-chart-v3-generate.js',['--write','--output-dir',dir]),f=run('rhythm-chart-v2-step7-autofix.js',['--source','v3','--input-dir',dir,'--write','--output-dir',dir]);
  ok('生成と自動修正が通る',g.status===0&&f.status===0,String(g.stderr||f.stderr||'').slice(-200));
  const shape=()=>JSON.stringify(R.DIFFS.slice(0,5).map(d=>JSON.parse(fs.readFileSync(path.join(dir,`rose-short-v3-fixed-${d.toLowerCase()}.json`),'utf8')).notes.map(n=>[n.grid,n.type,n.subLaneWidth,n.durationGrids||0]).sort((a,b)=>a[0]-b[0]||String(a).localeCompare(String(b)))));
  const shape0=shape(),m=run('rhythm-chart-flow-fix.js',['--dir',dir,'--mode','must','--write']);
  const a=R.reviewOf(R.loadAuthoring(track,{dir}));
  ok('手の仕上げ(must)が通り、ノーツの数・時刻・種類・幅を変えない',m.status===0&&shape()===shape0,String(m.stderr||'').slice(-200));
  ok('モンスターノーツがどの難易度も4個',Object.values(a).every(x=>x.monsters===4),Object.entries(a).map(([d,x])=>`${d} ${x.monsters}`).join(' '));
  ok('押さえている帯の中が0個',Object.values(a).every(x=>x.heldBand===0),Object.entries(a).map(([d,x])=>`${d} ${x.heldBand}`).join(' '));
  const k=run('rhythm-chart-flow-fix.js',['--dir',dir,'--mode','keep-climax','--write']),b=R.reviewOf(R.loadAuthoring(track,{dir}));
  const bad=x=>x.EXPERT.cross+x.EXPERT.reach+x.MASTER.cross+x.MASTER.reach,jump=x=>x.EXPERT.jump+x.MASTER.jump;
  ok('keep-climax は交差+真ん中越えを増やさず、跳びも増やさない',k.status===0&&shape()===shape0&&bad(b)<=bad(a)&&jump(b)<=jump(a)+1,`交差+真ん中越え ${bad(a)}→${bad(b)}・跳び ${jump(a)}→${jump(b)}`);
}finally{fs.rmSync(dir,{recursive:true,force:true});}

{const F=require('./rhythm-chart-flow-fix.js');ok('手の仕上げの既定は EXPERT・MASTER が keep-climax(社長の決定 A)',F.DEFAULT_FINISH.EXPERT==='keep-climax'&&F.DEFAULT_FINISH.MASTER==='keep-climax'&&!F.DEFAULT_FINISH.HARD);}
// つまみ探しは生成器の --song-settings を使い、一覧を書き換えない(中身は読むだけで確かめる。回すと1分かかるので検査では回さない)
const gen=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8'),tune=fs.readFileSync(path.join(__dirname,'rhythm-chart-tune.js'),'utf8');
ok('生成器の --song-settings は付けたときだけ効く',/const raw=arg\('--song-settings'\);if\(raw\)\{/.test(gen));
ok('つまみ探し・点検は書き込まない(writeFileSync は帯の作り直しと止め絵だけ)',!/writeFileSync/.test(tune)&&(fs.readFileSync(path.join(__dirname,'rhythm-chart-review.js'),'utf8').match(/writeFileSync/g)||[]).length===2);
// ④
ok('ゲームのデータ・曲の一覧・authoring の譜面は1バイトも変わっていない',WATCH.every((f,i)=>sha(f)===beforeSha[i]));
console.log(failed?`\n${failed}件 NG`:'\nすべてOK');process.exit(failed?1:0);
