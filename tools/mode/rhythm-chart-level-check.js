#!/usr/bin/env node
// 難易度レベル（Lv.）の物差しが、ずれていないことを毎回確かめる。
//
//   node tools/mode/rhythm-chart-level-check.js
//
// 【なぜ要るか】
// レベルは「Monster Hero 候補v3 の MASTER = Lv.30」を基準にした相対の数字なので、
// 譜面を作り直すたびに全曲の意味が変わる。ランタイムに書いてある表が
// **いまの譜面から計算した値と一致している**ことを機械で確かめておかないと、
// 譜面だけ更新してレベルが古いまま、という食い違いに気づけない。
'use strict';
const fs=require('fs');
const path=require('path');
const {chartLevel,chartStrain,loadRuntimeSongs,LEVEL_ANCHOR,LEVEL_MIN,LEVEL_MAX,LEVEL_MIN_NOTES}
  =require('./rhythm-chart-level.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};

const {RHYTHM_SONGS,RHYTHM_DIFFICULTIES,RHYTHM_DEMO_SONG_IDS}=loadRuntimeSongs();
const runtime=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');

// --- 1. 基準点 ---
{
  const song=RHYTHM_SONGS.find(entry=>entry.songId===LEVEL_ANCHOR.songId);
  check('基準の曲がランタイムにある',!!song,LEVEL_ANCHOR.songId);
  if(song){
    const chart=song.difficulties[LEVEL_ANCHOR.difficulty];
    check(`基準（${LEVEL_ANCHOR.songId} ${LEVEL_ANCHOR.difficulty}）が Lv.${LEVEL_ANCHOR.level} になっている`,
      chart.level===LEVEL_ANCHOR.level,`いま Lv.${chart.level}`);
    check('基準の譜面から計算した値も同じ',chartLevel(chart).level===LEVEL_ANCHOR.level,
      `計算 Lv.${chartLevel(chart).level} / 生の値 ${chartStrain(chart)?.raw}`);
  }
}

// --- 2. ランタイムの表が、いまの譜面から計算した値と一致している ---
{
  const mismatched=[];
  for(const song of RHYTHM_SONGS){
    for(const difficulty of RHYTHM_DIFFICULTIES){
      const chart=song.difficulties[difficulty.id];
      const computed=chartLevel(chart).level;
      // 数個しか無い確認用の型は測れない（そのときは譜面が持っている値をそのまま使う）
      if(chart.totalNotes<LEVEL_MIN_NOTES)continue;
      if(chart.level!==computed)mismatched.push(`${song.songId} ${difficulty.id}: 表 ${chart.level} / 計算 ${computed}`);
    }
  }
  check('全曲・全難易度のレベルが、いまの譜面から計算した値と一致している',
    mismatched.length===0,mismatched.slice(0,4).join(' / ')
      +(mismatched.length>4?` ほか${mismatched.length-4}件`:'')
      +(mismatched.length?'（node tools/mode/rhythm-chart-level.js --write で直す）':''));
}

// --- 3. 表はツールが書く場所にあり、手書きしていない ---
{
  check('レベル表がマーカーの内側にある',
    runtime.includes('// <rhythm-chart-levels>')&&runtime.includes('// </rhythm-chart-levels>'));
  check('レベルを差し替える口が1か所にまとまっている',
    runtime.includes('const rhythmChartWithLevel=')&&runtime.includes('rhythmChartWithLevel(song.songId,id,song.difficulties[id])'));
  check('レベル表は手で決めない、と書いてある',runtime.includes('rhythm-chart-level.js が'));
}

// --- 4. レベルの並びが難易度の順になっている（同じ曲の中で下がらない） ---
{
  const broken=[];
  for(const song of RHYTHM_SONGS){
    const levels=RHYTHM_DIFFICULTIES
      .map(difficulty=>({id:difficulty.id,chart:song.difficulties[difficulty.id]}))
      .filter(entry=>entry.chart.totalNotes>=LEVEL_MIN_NOTES);
    // テスト用の譜面は、難易度ごとに別々の確認内容を入れてあるので順番を持たない。
    // 曲えらびへ出る曲(RHYTHM_DEMO_SONG_IDS)は全部見る。以前は songId の綴りで
    // 拾っていたため、stay_with_me や kiki_issen のような正式曲が丸ごと外れていた。
    const released=RHYTHM_DEMO_SONG_IDS.includes(song.songId)||/candidate|six_eternel/.test(song.songId);
    if(!released)continue;
    for(let i=1;i<levels.length;i++){
      if(levels[i].chart.level<levels[i-1].chart.level){
        broken.push(`${song.songId} ${levels[i-1].id}(${levels[i-1].chart.level})→${levels[i].id}(${levels[i].chart.level})`);
      }
    }
  }
  check('本物の曲は、難易度が上がるほどレベルも上がる',broken.length===0,broken.join(' / '));
}

// --- 5. レベルが決めた範囲に収まっている ---
{
  const out=[];
  for(const song of RHYTHM_SONGS){
    for(const difficulty of RHYTHM_DIFFICULTIES){
      const chart=song.difficulties[difficulty.id];
      if(chart.totalNotes<LEVEL_MIN_NOTES)continue;
      if(!(chart.level>=LEVEL_MIN&&chart.level<=LEVEL_MAX))out.push(`${song.songId} ${difficulty.id}=${chart.level}`);
    }
  }
  check(`レベルが ${LEVEL_MIN}〜${LEVEL_MAX} に収まっている`,out.length===0,out.join(' / '));
}

// --- 6. 画面へ出ている ---
{
  const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
  check('体験版の曲えらびにレベルが出る',game.includes('data-rhythm-demo-level')&&/Lv\.\{chart\.level\}/.test(game));
  check('デバッグの曲一覧にもレベルが出る',/Lv\.\{chart\.level\}/.test(game));
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
