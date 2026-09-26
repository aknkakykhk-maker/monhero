// 曲ごとの拍の表(RHYTHM_SONG_BEATS・monster-hero/data/rhythm-mode.js)を見張る。
//
//   node tools/mode/rhythm-song-beats-check.js
//
// 道の演出(拍の線・道のふちの光)は、この表の拍に合わせて動く。表は、譜面を作ったときの
// 音源の解析(tools/mode/authoring/*-v3-audio.json の timing)を写したもの。
// ・公開中の曲(RELEASED_TRACKS)がすべて表にあるか(曲を足したときの書き忘れ)
// ・値が解析ファイルと一致しているか(写し間違い)
// ・その曲の譜面のノーツが、表の拍から作った格子に乗っているか(拍の線とノーツがずれていないか)
const fs=require('fs'),path=require('path'),vm=require('vm');
const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
const ROOT=path.resolve(__dirname,'..','..');
const RUNTIME=path.join(ROOT,'monster-hero','data','rhythm-mode.js');
const AUTHORING=path.join(ROOT,'tools','mode','authoring');

const context={console};vm.createContext(context);
vm.runInContext(`${fs.readFileSync(RUNTIME,'utf8')}\nglobalThis.__x={RHYTHM_SONGS,RHYTHM_SONG_BEATS,rhythmSongBeatGrid};`,context);
const {RHYTHM_SONGS,RHYTHM_SONG_BEATS,rhythmSongBeatGrid}=context.__x;

const timingByTrack={};
for(const file of fs.readdirSync(AUTHORING).filter(name=>name.endsWith('-v3-audio.json'))){
  const json=JSON.parse(fs.readFileSync(path.join(AUTHORING,file),'utf8'));
  if(json&&json.trackId&&json.timing)timingByTrack[json.trackId]=json.timing;
}

let failures=0;
const check=(ok,label,detail='')=>{console.log(`${ok?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!ok)failures++;};

const missing=[],mismatch=[],offGrid=[];
for(const [songId,trackId] of Object.entries(RELEASED_TRACKS)){
  const grid=rhythmSongBeatGrid(songId),timing=timingByTrack[trackId];
  if(!grid){missing.push(songId);continue;}
  if(!timing){mismatch.push(`${songId}(解析ファイルが無い)`);continue;}
  if(Math.abs(grid.beatMs-timing.beatMs)>.01||Math.abs(grid.zeroMs-timing.beatZeroMs)>.1||grid.bar!==timing.beatsPerBar)mismatch.push(songId);
  const song=RHYTHM_SONGS.find(entry=>entry.songId===songId);
  if(!song)continue;
  const step=grid.beatMs/(Number(timing.subdivisionsPerBeat)||4);
  for(const [difficulty,chart] of Object.entries(song.difficulties)){
    const notes=chart&&Array.isArray(chart.notes)?chart.notes:[];
    if(!notes.length)continue;
    const on=notes.filter(note=>{const k=(note.timeMs-grid.zeroMs)/step;return Math.abs(k-Math.round(k))*step<=20;}).length;
    if(on/notes.length<.98)offGrid.push(`${songId} ${difficulty} ${(on/notes.length*100).toFixed(1)}%`);
  }
}
check(!missing.length,'公開中の曲がすべて RHYTHM_SONG_BEATS にある',missing.length?`無い: ${missing.join(', ')}`:`${Object.keys(RELEASED_TRACKS).length}曲`);
check(!mismatch.length,'表の値が音源の解析(timing)と一致している',mismatch.join(', '));
check(!offGrid.length,'譜面のノーツが表の拍の格子に乗っている(98%以上・±20ms)',offGrid.join(' / '));
const extra=Object.keys(RHYTHM_SONG_BEATS).filter(songId=>!RELEASED_TRACKS[songId]);
check(!extra.length,'表に公開していない曲が混ざっていない',extra.join(', '));

console.log(failures?`\n${failures}件のNGがあります`:'\nすべてOK');
process.exit(failures?1:0);
