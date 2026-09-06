#!/usr/bin/env node
// モンビーの曲の「長さ」がそろっているか。
//
//   node tools/mode/rhythm-song-length-check.js
//
// 【なぜ要るか】(2026-09-06・ユーザー指示「いま追加した2曲は長すぎるから2分ぐらいで
//  ちょうどいいとこで終わるような作りにして」)
// デュラハンの2曲は音源をバトルのBGMと共用しているので、音源そのものは切れない。
// かわりに譜面のほうを途中までにして、そこで終わるようにした。
// この「どこで終わるか」は tools/mode/authoring/rhythm-song-registry.json の playEndMs が持つ。
//
// ここを書き忘れたまま譜面を作り直すと、**黙って元の長さへ戻る**。
// 画面はふつうに動いてしまい、遊んで初めて「また4分52秒ある」と気づくことになる。
// 曲を足すときに表を埋め忘れて Lv.1 のまま公開しかけた前例もあるので、機械で見張る。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const seconds=ms=>`${(Number(ms)/1000).toFixed(1)}秒`;

const context={Object,Number,Math,JSON,Array,String};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')}
this.out={RHYTHM_SONGS,RHYTHM_DIFFICULTIES,RHYTHM_DEMO_SONG_IDS};`,context);
const {RHYTHM_SONGS,RHYTHM_DIFFICULTIES,RHYTHM_DEMO_SONG_IDS}=context.out;
const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring/rhythm-song-registry.json'),'utf8'));

// 遊ぶのが長すぎない上限。先行公開の曲はどれもこれより短い。
const MAX_PLAY_MS=5*60*1000;

for(const songId of RHYTHM_DEMO_SONG_IDS){
  const song=RHYTHM_SONGS.find(entry=>entry.songId===songId);
  if(!song){ok(`${songId} がランタイムにある`,false);continue;}
  const charts=RHYTHM_DIFFICULTIES.map(({id})=>song.difficulties[id]).filter(chart=>chart&&chart.notes.length>0);
  if(!charts.length){ok(`${song.displayName} に譜面がある`,false);continue;}

  // 難易度が違っても曲の長さは同じ
  const durations=new Set(charts.map(chart=>Number(chart.durationMs)));
  ok(`${song.displayName}: どの難易度でも曲の長さが同じ`,durations.size===1,
    [...durations].map(seconds).join(' / '));
  const durationMs=Number(charts[0].durationMs);

  // 最後のノーツは曲の終わりより前にある（終わったあとに叩かせない）
  const lastNoteMs=Math.max(...charts.map(chart=>Math.max(...chart.notes
    .map(note=>Number(note.endTimeMs||note.timeMs)||0))));
  ok(`${song.displayName}: 最後のノーツが曲の終わりより前にある`,lastNoteMs<durationMs,
    `最後 ${seconds(lastNoteMs)} / 終わり ${seconds(durationMs)}`);

  ok(`${song.displayName}: 遊ぶ長さが5分を超えない`,durationMs<=MAX_PLAY_MS,seconds(durationMs));

  // 音源より短く終わる曲は、どこで終わるかが曲の一覧に書いてあること。
  // 書いていないと、次に譜面を作り直したとき黙って元の長さへ戻る。
  const trackId=RELEASED_TRACKS[songId];
  const entry=trackId?registry.songs?.[trackId]:null;
  if(!entry){ok(`${song.displayName}: 音源の一覧に登録がある`,false,`${songId} → ${trackId||'対応表に無し'}`);continue;}
  const audioMs=Number(entry.durationMs),playEndMs=Number(entry.playEndMs);
  const shortened=durationMs<audioMs-2000;
  if(shortened){
    ok(`${song.displayName}: 途中で終わる曲は playEndMs が書いてある`,
      Number.isFinite(playEndMs)&&playEndMs>0,
      `譜面 ${seconds(durationMs)} / 音源 ${seconds(audioMs)}`);
    if(Number.isFinite(playEndMs)){
      ok(`${song.displayName}: 譜面の長さと playEndMs が一致している`,Math.abs(durationMs-playEndMs)<=1,
        `譜面 ${durationMs}ms / playEndMs ${playEndMs}ms`);
    }
  }else{
    ok(`${song.displayName}: 最後まで遊ぶ曲に playEndMs を書いていない`,
      !Number.isFinite(playEndMs),
      `譜面 ${seconds(durationMs)} / 音源 ${seconds(audioMs)}`);
  }
}

// 生成器が playEndMs を見ていること（引数を覚えていないと元へ戻る、を防ぐ）
const generator=fs.readFileSync(path.join(ROOT,'tools/mode/rhythm-chart-v3-generate.js'),'utf8');
ok('生成器が曲の一覧の playEndMs を見て譜面を途中までにする',
  /playEndMs/.test(generator)&&/chartEndMs-COMMON\.endPaddingMs/.test(generator));
// 音源そのものはコピーしない。デュラハンの2曲はバトルのBGMと同じファイルを指したまま、
// 譜面だけを途中までにしている（CLAUDE.md ⑥-2「既にある音源が使えるならコピーを作らない」）。
// モンビー用に切ったmp3を足してしまうと、同じ曲が2本ぶん端末へ落ちてくる。
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
const sharedTracks={dullahan:'original_dullahan',dullahan_clockwork:'melo_dullahan_clockwork'};
for(const [songId,trackId] of Object.entries(sharedTracks)){
  const song=RHYTHM_SONGS.find(entry=>entry.songId===songId);
  ok(`${song?song.displayName:songId}: バトルのBGMと同じ音源を指している`,
    !!song&&song.bgmTrackId===trackId,`${song?song.bgmTrackId:'曲が無い'}（期待 ${trackId}）`);
}
ok('デュラハンの音源はバトルと同じファイルのまま（モンビー用のコピーを作っていない）',
  /id:'original_dullahan'[^}]*src:'audio\/bgm-dullahan\.mp3'/.test(game)
  &&/id:'melo_dullahan_clockwork'[^}]*src:'audio\/bgm-dullahan-clockwork\.mp3'/.test(game)
  &&!fs.readdirSync(path.join(ROOT,'monster-hero/audio'))
    .some(name=>/dullahan.*(beat|short)/i.test(name)));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
