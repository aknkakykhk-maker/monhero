#!/usr/bin/env node
// 「走る音（アルペジオ・トレモロ）をなぞるSLIDE」が、**実際に鳴っている音の上にあること**と
// **ほかの押さえる形を食い潰していないこと**を、生成して確かめる。
//
//   node tools/mode/rhythm-glide-slide-check.js
//   node tools/mode/rhythm-glide-slide-check.js --tracks a,b,c
//
// 【なぜ要るか】(2026-09-12・ユーザー指示「スライドにする材料を広げる」)
// それまでSLIDEの材料は**伸びている音**だけで、音階を駆け上がる／行き来する
// アルペジオ・トレモロは1音ずつ短いので全部単押しになっていた
// （設計書 §3.1.8 の「SLIDEにする材料そのものを広げるしかない」）。
//
// この検査でいちばん見たいのは次の2つ。
//   ① 経路の中継点が**その打点の音の高さ**であること（幽霊ノーツ §2.1 にしない）
//   ② **指は2本しかない**ので、長く押さえる形どうしは取り合いになる。
//      実際に、避けずに置いたら同時押さえが4組→1組へ減った。
//      ベースの2声が取れている場所（同時押さえの材料）は避けること。
'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const DEFAULT_TRACKS=['monster_hero_theme','eiki_boss','pandora_boss',
  'six_eternel_beat','atsu_cup_theme','eiki_boss_remix'];
const tracks=(arg('--tracks')||'').split(',').map(text=>text.trim()).filter(Boolean);
const targets=tracks.length?tracks:DEFAULT_TRACKS;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'glide-slide-'));

const perTrack=[];
let total=0,lowFound=0;
const offOnset=[],tooFlat=[],notFast=[];
let widest=0,mostTurns=0;
for(const track of targets){
  const dashed=track.replace(/_/g,'-');
  const dir=path.join(tmp,track);
  fs.mkdirSync(dir,{recursive:true});
  const gen=spawnSync('node',[path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),
    '--track',track,'--write','--output-dir',dir],{cwd:ROOT,encoding:'utf8',maxBuffer:1<<26});
  if(gen.status!==0){ok(`${track}: 生成できる`,false,(gen.stderr||'').split('\n')[0]);continue;}
  // お知らせから本数を数える（ノーツ側には印を残していないので、報告と譜面の両方から見る）
  const reported=[...(gen.stdout||'').matchAll(/走る音をなぞるSLIDE (\d+)本/g)].reduce((sum,m)=>sum+Number(m[1]),0);
  const audioFile=path.join(ROOT,`tools/mode/authoring/${dashed}-v3-audio.json`);
  const audio=fs.existsSync(audioFile)?JSON.parse(fs.readFileSync(audioFile,'utf8')):null;
  const onsetGrids=audio?new Set(audio.onsets.map(onset=>onset.grid)):null;
  const heightAt=new Map();
  if(audio)for(const point of audio.pitchCurve)if(point.height!=null)heightAt.set(point.grid,point.height);
  const BEAT=audio?audio.timing.subdivisionsPerBeat:4;
  let here=0;
  for(const difficulty of ['easy','normal','hard','expert','master']){
    const file=path.join(dir,`${dashed}-v3-chart-${difficulty}.json`);
    if(!fs.existsSync(file))continue;
    const chart=JSON.parse(fs.readFileSync(file,'utf8'));
    if(['easy','normal'].includes(difficulty)){
      // SLIDEを持たない難易度には設定も無いこと
      if(chart.policy&&chart.policy.glideSlide!==null&&chart.policy.glideSlide!==undefined)lowFound++;
      continue;
    }
    // ★印(glideSlide)で拾う。条件で拾おうとしたら、端から端まで動くSLIDE（スイープ）まで
    //   混ざって「音は0.4半音なのに3レーン動いている」と誤検出した（スイープは
    //   音の高さではなく見せ場として振る形なので、それで正しい）。
    for(const note of chart.notes){
      if(note.glideSlide!==true)continue;
      const end=note.grid+(Number(note.durationGrids)||0);
      const inside=onsetGrids?[...onsetGrids].filter(g=>g>=note.grid&&g<=end).length:0;
      here++;total++;
      // 走る音の上にあること（8分以下の間隔で打点が4つ以上）
      if(inside<4||(end-note.grid)/Math.max(1,inside-1)>BEAT/2)
        notFast.push(`${track} ${difficulty} grid${note.grid}（打点${inside}個）`);
      if(!Array.isArray(note.slidePoints)||note.slidePoints.length<2)continue;
      const lanes=note.slidePoints.map(point=>Number(point.lane));
      const span=Math.max(...lanes)-Math.min(...lanes);
      let turns=0;
      for(let i=2;i<lanes.length;i++)if((lanes[i]-lanes[i-1])*(lanes[i-1]-lanes[i-2])<0)turns++;
      widest=Math.max(widest,span);mostTurns=Math.max(mostTurns,turns);
      const where=`${track} ${difficulty} grid${note.grid}`;
      // ① 頭が打点の上にあること
      if(onsetGrids&&!onsetGrids.has(note.grid))offOnset.push(where);
      // ① 経路が音の高さに沿っていること（音が動いていないのに動く経路を引いていない）
      const known=note.slidePoints.map(point=>heightAt.has(point.grid)?heightAt.get(point.grid):null)
        .filter(height=>height!=null);
      if(known.length>=2){
        const range=Math.max(...known)-Math.min(...known);
        if(span>=1&&range<.05)tooFlat.push(`${where}（幅${span.toFixed(1)}レーンなのに音は${(range/.055).toFixed(1)}半音）`);
      }
    }
  }
  perTrack.push({track,found:here,reported});
}
fs.rmSync(tmp,{recursive:true,force:true});

for(const row of perTrack)console.log(`   ${row.track.padEnd(24)} 報告 ${row.reported}本 / 譜面から拾えた ${row.found}本`);
ok('EASY・NORMALには設定を持たせていない',lowFound===0,`${lowFound}件`);
const withAny=perTrack.filter(row=>row.reported>0).length;
// ★材料は曲によって無い（走る音が無い曲に無理へ入れない）。半分以上の曲で出れば十分。
ok('半分以上の曲で走る音のSLIDEが出る',perTrack.length>0&&withAny>=Math.ceil(perTrack.length/2),
  `${withAny}/${perTrack.length}曲`);
ok('合計で6本以上置かれる',perTrack.reduce((sum,row)=>sum+row.reported,0)>=6,
  `${perTrack.reduce((sum,row)=>sum+row.reported,0)}本`);
// ★これが本題のひとつ。幽霊ノーツにしない
ok('頭が実際に鳴っている音に乗っている',offOnset.length===0,offOnset.slice(0,3).join(' / ')||'なし');
ok('音が動いていないのに動く経路を引いていない',tooFlat.length===0,tooFlat.slice(0,3).join(' / ')||'なし');
ok('横に動く経路になっている',widest>=1,`いちばん広いもの ${widest.toFixed(1)}レーン`);
ok('走る音（8分以下で打点4つ以上）の上にある',notFast.length===0,notFast.slice(0,3).join(' / ')||'なし');
console.log(`   参考: いちばん折れているもの ${mostTurns}回`);
// ★本題のもうひとつ。ほかの押さえる形を食い潰していないこと（別々の検査で見る）
console.log('   ※ 同時押さえ・同時スライドを食い潰していないことは');
console.log('     rhythm-held-pair-variety-check.js / rhythm-double-slide-check.js が見る');

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
