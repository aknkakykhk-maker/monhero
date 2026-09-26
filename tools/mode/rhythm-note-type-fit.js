#!/usr/bin/env node
// ノーツの**種類**が、その音の性格に合っているかを測る(2026-09-26)。
//
//   node tools/mode/rhythm-note-type-fit.js                  # 一覧にある曲を全部(authoring の自動修正後)
//   node tools/mode/rhythm-note-type-fit.js --track <曲id>
//   node tools/mode/rhythm-note-type-fit.js --dir <dir> --source v3   # 別の場所に書き出した譜面(生成直後)
//   node tools/mode/rhythm-note-type-fit.js --json
//
// 【なぜ要るか】ユーザー指摘「ただ適当にフリックとかを置くじゃなくて、譜面にあわせてあった配置や
// ノーツの種類があるとおもう」。品質レポートの6軸は「鳴っている音の上か」は見ていたが、
// 「その音が**フリックにふさわしい音か**」は見ていなかった。
//
// 物差しは rhythm-sound-traits.js(生成器と同じ)。比べる相手は「ふつうのTAPの中での割合」。
// フリックが音の性格に乗っている割合が、TAP全体の割合とほとんど同じなら、それは**音を見ずに散らしている**。
//
//   フリック     … 切れる音・歌の語尾・シンバルのどれかに乗っている割合
//   同時押し     … シンバル・大きな一発に乗っている割合
//   横フリック   … 向きが旋律の上がり下がりと合っている割合(上がる=右・下がる=左。旋律が動いた所だけ数える)
'use strict';
const fs=require('fs'),path=require('path');
const {soundTraitsFor,flickScoreOf,chordScoreOf}=require('./rhythm-sound-traits.js');
const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
const authoringDir=path.join(ROOT,'tools/mode/authoring');

const measure=(chart,traitsByGrid)=>{
  const at=grid=>traitsByGrid.get(grid)||null;
  const main=chart.notes.filter(note=>!note.chord);
  const taps=main.filter(note=>note.type==='TAP');
  const flicks=main.filter(note=>note.type==='FLICK');
  const rate=(list,test)=>list.length?list.filter(test).length/list.length:null;
  const flickFit=rate(flicks,note=>flickScoreOf(at(note.grid))>0);
  const tapFlickLike=rate(taps,note=>flickScoreOf(at(note.grid))>0);
  // 同時押し: 同じグリッドに2つ以上(chord の印が付いた2本目がいる)
  const chordGrids=[...new Set(chart.notes.filter(note=>note.chord).map(note=>note.grid))];
  const allGrids=[...new Set(main.map(note=>note.grid))];
  const chordFit=rate(chordGrids,grid=>chordScoreOf(at(grid))>0);
  const gridChordLike=rate(allGrids,grid=>chordScoreOf(at(grid))>0);
  // 横フリック
  const sided=flicks.filter(note=>note.flickDir==='left'||note.flickDir==='right');
  const moving=sided.filter(note=>(at(note.grid)?.pitchMove||0)!==0);
  const sideFit=rate(moving,note=>(note.flickDir==='right')===(at(note.grid).pitchMove>0));
  return {notes:main.length,flicks:flicks.length,flickFit,tapFlickLike,chords:chordGrids.length,chordFit,gridChordLike,
    sideFlicks:sided.length,sideJudged:moving.length,sideFit};
};

const reportFor=(trackId,{dir=null,source='v3fixed'}={})=>{
  const dashed=trackId.replace(/_/g,'-');
  const audioFile=path.join(authoringDir,`${dashed}-v3-audio.json`);
  if(!fs.existsSync(audioFile))return null;
  const traits=soundTraitsFor(JSON.parse(fs.readFileSync(audioFile,'utf8')));
  const out={trackId,difficulties:{}};
  for(const difficulty of DIFFICULTIES){
    const file=path.join(dir||authoringDir,`${dashed}-v3-${source==='v3'?'chart':'fixed'}-${difficulty.toLowerCase()}.json`);
    if(!fs.existsSync(file))continue;
    out.difficulties[difficulty]=measure(JSON.parse(fs.readFileSync(file,'utf8')),traits);
  }
  return Object.keys(out.difficulties).length?out:null;
};

module.exports={measure,reportFor};

if(require.main===module){
  const dir=arg('--dir')?path.resolve(ROOT,arg('--dir')):null;
  const source=arg('--source','v3fixed');
  const registry=JSON.parse(fs.readFileSync(path.join(authoringDir,'rhythm-song-registry.json'),'utf8')).songs||{};
  const tracks=arg('--track')?[arg('--track')]:Object.keys(registry);
  const reports=tracks.map(trackId=>reportFor(trackId,{dir,source})).filter(Boolean);
  if(process.argv.includes('--json')){console.log(JSON.stringify(reports,null,1));process.exit(0);}
  const pct=value=>value==null?'  —':`${Math.round(value*100)}%`.padStart(4);
  const sum={};
  for(const report of reports){
    for(const [difficulty,m] of Object.entries(report.difficulties)){
      const s=sum[difficulty]||(sum[difficulty]={flicks:0,flickHit:0,tapLike:[],chords:0,chordHit:0,gridLike:[],side:0,sideHit:0});
      s.flicks+=m.flicks;s.flickHit+=Math.round((m.flickFit||0)*m.flicks);if(m.tapFlickLike!=null)s.tapLike.push(m.tapFlickLike);
      s.chords+=m.chords;s.chordHit+=Math.round((m.chordFit||0)*m.chords);if(m.gridChordLike!=null)s.gridLike.push(m.gridChordLike);
      s.side+=m.sideJudged;s.sideHit+=Math.round((m.sideFit||0)*m.sideJudged);
    }
  }
  const mean=list=>list.length?list.reduce((a,b)=>a+b,0)/list.length:null;
  console.log('ノーツの種類が音の性格に合っているか（全曲の合計）');
  console.log('  難易度   フリック 音に合う (TAP全体なら)   同時押し 音に合う (全体なら)   横フリック 旋律と同じ向き');
  for(const difficulty of DIFFICULTIES){
    const s=sum[difficulty];if(!s)continue;
    console.log(`  ${difficulty.padEnd(7)} ${String(s.flicks).padStart(6)}本 ${pct(s.flicks?s.flickHit/s.flicks:null)}  (${pct(mean(s.tapLike))})`
      +`        ${String(s.chords).padStart(5)}組 ${pct(s.chords?s.chordHit/s.chords:null)}  (${pct(mean(s.gridLike))})`
      +`        ${String(s.side).padStart(4)}本 ${pct(s.side?s.sideHit/s.side:null)}`);
  }
}
