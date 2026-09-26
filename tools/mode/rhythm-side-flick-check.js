#!/usr/bin/env node
// 横フリック(FLICK の flickDir: 'left' / 'right')を確かめる。2026-09-26。
//
//   ・その向きへ払えば成立、逆向き・真上へ払っても成立しない
//   ・横が主なら少し斜めでも成立する(RHYTHM_FLICK_SIDE_DOMINANCE)
//   ・向きを書いていない FLICK は今までどおり、どの向きでも成立する
//   ・ミラー譜面では左右が入れ替わる
//   ・配信データの短い形 f(時刻,位置,幅,向き) の読み書きがそろっている
//   ・配信中の譜面は、横フリックを書いていないかぎり今までと同じ
//
//   node tools/mode/rhythm-side-flick-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const settingsSource=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'),'utf8');
let failed=0;
const ok=(name,value,detail='')=>{console.log(`${value?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!value)failed++;};

const context={console,performance};
vm.createContext(context);
vm.runInContext(`${source}\n;globalThis.__t={RHYTHM_SONGS,rhythmMatchInputBatch,RHYTHM_GESTURE_RUNTIME,rhythmFlickMatches,rhythmFlickDir,RHYTHM_FLICK_DIRS,mhFlick,RHYTHM_FLICK_DISTANCE_PX};`,context);
const api=context.__t;

// 1. 向きの判定そのもの
const left={type:'FLICK',flickDir:'left'},right={type:'FLICK',flickDir:'right'},any={type:'FLICK'};
ok('左フリックは左へ24px以上で成立',api.rhythmFlickMatches(left,-30,0)&&!api.rhythmFlickMatches(left,-20,0));
ok('左フリックは右へ払っても成立しない',!api.rhythmFlickMatches(left,40,0));
ok('左フリックは真上へ払っても成立しない',!api.rhythmFlickMatches(left,0,-40));
ok('横が主なら少し斜めでも成立する(左30px・上20px)',api.rhythmFlickMatches(left,-30,-20));
ok('縦のほうが大きい斜めは成立しない(左25px・上40px)',!api.rhythmFlickMatches(left,-25,-40));
ok('右フリックは右へ払えば成立・左では成立しない',api.rhythmFlickMatches(right,30,0)&&!api.rhythmFlickMatches(right,-30,0));
ok('向きの無いFLICKは今までどおりどの向きでも成立',api.rhythmFlickMatches(any,30,0)&&api.rhythmFlickMatches(any,0,-30)&&api.rhythmFlickMatches(any,-30,0)&&!api.rhythmFlickMatches(any,10,10));
ok('知らない向きは向きなし扱い',api.rhythmFlickDir({type:'FLICK',flickDir:'up'})===''&&api.rhythmFlickDir({type:'FLICK'})==='');

// 2. 実際の入力の流れ(記録 → 対応付け → 指を動かす)
const hard=api.RHYTHM_SONGS[0].difficulties.HARD;
const flickTime=2600;
const runtime=dir=>hard.notes.map((note,index)=>({...note,index,done:false,activePointerId:null,holdJudgment:null,holdDeltaMs:0,
  ...(note.type==='FLICK'&&Math.abs(note.timeMs-flickTime)<1&&dir?{flickDir:dir}:{})}));
const attempt=(dir,key,dx,dy)=>{
  api.RHYTHM_GESTURE_RUNTIME.clear();
  const notes=runtime(dir);
  api.RHYTHM_GESTURE_RUNTIME.record(key,100,100);
  const hit=api.rhythmMatchInputBatch(notes,[{lane:0,inputKey:key}],flickTime,0)[0];
  if(!hit||!hit.target)return {matched:false};
  hit.target.holdJudgment='MARVELOUS';
  api.RHYTHM_GESTURE_RUNTIME.record(key,100+dx,100+dy);
  return {matched:true,done:hit.target._rhythmGestureDone===true,judgment:hit.target.holdJudgment,dir:hit.target.flickDir||''};
};
const a=attempt('left','touch:11',-30,0);
ok('入力の流れで: 左フリックを左へ払うと成立',a.matched&&a.dir==='left'&&a.done&&a.judgment==='MARVELOUS',JSON.stringify(a));
const b=attempt('left','touch:12',30,0);
ok('入力の流れで: 左フリックを右へ払っても成立しない(時間切れで取り逃しになる)',b.matched&&!b.done,JSON.stringify(b));
const c=attempt('right','touch:13',30,0);
ok('入力の流れで: 右フリックを右へ払うと成立',c.matched&&c.done,JSON.stringify(c));
const d=attempt('','touch:14',0,-30);
ok('入力の流れで: 向きの無いFLICKは上へ払って今までどおり成立',d.matched&&d.done,JSON.stringify(d));
api.RHYTHM_GESTURE_RUNTIME.clear();

// 3. ミラー譜面で左右が入れ替わる(実装の1行を確かめる)
ok('ミラー譜面では flickDir の左右を入れ替える',
  settingsSource.includes("if(note.flickDir==='left')next.flickDir='right';else if(note.flickDir==='right')next.flickDir='left';"));

// 4. 短い形の読み書き
ok('向きの番号の並びは ["","left","right"]',JSON.stringify([...api.RHYTHM_FLICK_DIRS])==='["","left","right"]');
ok('f(…,1) は左、f(…,2) は右、書かなければ向きなし',
  api.mhFlick(1000,2,2,1).flickDir==='left'&&api.mhFlick(1000,2,2,2).flickDir==='right'&&!('flickDir' in api.mhFlick(1000,2,2))&&!('flickDir' in api.mhFlick(1000,2,2,9)));
const {runtimeRow,FLICK_DIR_CODES}=require('./rhythm-runtime-notes.js');
ok('書き出しの番号の並びが本体と同じ',JSON.stringify(FLICK_DIR_CODES)===JSON.stringify([...api.RHYTHM_FLICK_DIRS]));
ok('書き出し: 向きがあれば4つ目に番号・無ければ今までどおり3つ',
  runtimeRow({type:'FLICK',timeMs:1000,subLane:2,subLaneWidth:2,flickDir:'right'})==='f(1000,2,2,2)'
  &&runtimeRow({type:'FLICK',timeMs:1000,subLane:2,subLaneWidth:2})==='f(1000,2,2)');
const pipeline=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-pipeline.js'),'utf8');
ok('パイプラインも同じ番号で書き出す',pipeline.includes('FLICK_DIR_CODES.indexOf(note.flickDir)'));

// 5. 自動譜面制作は版4のMASTERだけに付ける
const generator=fs.readFileSync(path.join(__dirname,'rhythm-chart-v3-generate.js'),'utf8');
ok('自動譜面制作: 版4以上で、MASTERの譜面だけに横フリックを付ける',
  generator.includes('const sideFlick=chartRevision>=4;')&&generator.includes('if(sideFlick&&results.MASTER){')
  &&(generator.match(/applySideFlicks\(/g)||[]).length===2);

// 6. 配信中の譜面は横フリックを書いていない(=今までと同じ)ことを数えて残す
let flicks=0,side=0;
for(const song of api.RHYTHM_SONGS)for(const chart of Object.values(song.difficulties||{})){
  for(const note of (chart&&chart.notes)||[]){if(note.type==='FLICK'){flicks++;if(api.rhythmFlickDir(note))side++;}}
}
ok('配信中の譜面を読めた',flicks>0,`FLICK ${flicks}本 / うち横フリック ${side}本`);

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
