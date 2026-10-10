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
const {chartLevel,chartStrain,songLevels,loadRuntimeSongs,LEVEL_ANCHOR,LEVEL_SCALE,LEVEL_MIN,LEVEL_MAX,LEVEL_MIN_NOTES}
  =require('./rhythm-chart-level.js');

const ROOT=path.resolve(__dirname,'..','..');
// 固定した物差しと、基準の曲に許すずれ(下の「1. 基準点」を見る)
const LEVEL_SCALE_FIXED=23.2739,LEVEL_ANCHOR_TOLERANCE=1;
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
    // ★物差し(LEVEL_SCALE)は固定する(2026-09-27・ユーザー指示「今後の運用に適した設定にして」)。
    //   基準の曲も作り直しのたびに少し変わる(6レーンで作り直したあと Lv.29 になった)。そのたびに取り直すと、
    //   何も変わっていない他の曲のレベルまで上下する(取り直すと115譜面のうち57譜面が +1 だった)。
    //   基準は「物差しを決めたときの目印」として扱い、作り直しで ±1 動くのは許す。大きくずれたら物差しを見直す合図
    check(`基準（${LEVEL_ANCHOR.songId} ${LEVEL_ANCHOR.difficulty}）が Lv.${LEVEL_ANCHOR.level}±${LEVEL_ANCHOR_TOLERANCE} に収まっている`,
      Math.abs(chart.level-LEVEL_ANCHOR.level)<=LEVEL_ANCHOR_TOLERANCE,`いま Lv.${chart.level}`);
    check('基準の譜面から計算した値も同じ範囲',Math.abs(chartLevel(chart).level-LEVEL_ANCHOR.level)<=LEVEL_ANCHOR_TOLERANCE,
      `計算 Lv.${chartLevel(chart).level} / 生の値 ${chartStrain(chart)?.raw}`);
    check('物差し(LEVEL_SCALE)を黙って取り直していない',LEVEL_SCALE===LEVEL_SCALE_FIXED,
      `いま ${LEVEL_SCALE} / 決めた値 ${LEVEL_SCALE_FIXED}(取り直すと全曲のレベルが動く。変えるときはユーザーに確かめてからここも直す)`);
  }
}

// --- 2. ランタイムの表が、いまの譜面から計算した値と一致している ---
{
  const mismatched=[];
  for(const song of RHYTHM_SONGS){
    // 曲えらびに出る数字は songLevels() が決める（生の値が上なら表示も必ず1以上上げる）。
    // 1難易度ずつ chartLevel() で測ると、その手当てのぶんだけ食い違って見える。
    const levels=songLevels(song,RHYTHM_DIFFICULTIES);
    for(const difficulty of RHYTHM_DIFFICULTIES){
      const chart=song.difficulties[difficulty.id];
      const computed=levels[difficulty.id].level;
      // 数個しか無い確認用の型は測れない（そのときは譜面が持っている値をそのまま使う）
      // HELL(6段目)は譜面がある曲だけにある。無い曲は測らない
      if(!chart||chart.totalNotes<LEVEL_MIN_NOTES)continue;
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
    // 6レーン化(2026-09-26)で、譜面は道の上へ寄せる rhythmChartOnRoad(…) に包んでから渡す形になった。どちらの形でも通す
    runtime.includes('const rhythmChartWithLevel=')
      &&/rhythmChartWithLevel\(song\.songId,id,(?:rhythmChartOnRoad\()?song\.difficulties\[id\]/.test(runtime));
  check('レベル表は手で決めない、と書いてある',runtime.includes('rhythm-chart-level.js が'));
}

// --- 4. レベルの並びが難易度の順になっている（同じ曲の中で下がらない） ---
{
  const broken=[];
  for(const song of RHYTHM_SONGS){
    const levels=RHYTHM_DIFFICULTIES
      .map(difficulty=>({id:difficulty.id,chart:song.difficulties[difficulty.id]}))
      .filter(entry=>entry.chart&&entry.chart.totalNotes>=LEVEL_MIN_NOTES);
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

// --- 4b. 空中の段(HELL)は、空中のぶんだけが数字に効く(2026-10-10・社長「空中のぶんを数字に足す」) ---
// 空中のノーツが無い譜面は1つも数字が変わらないこと、HELL は空中のぶんだけ MASTER より重くなることを見る。
// Sheriruth の HELL は MASTER の時刻・位置のまま一部を空中へ上げたものなので、空中を地上へ戻すと MASTER と同じ生の値になるはず
{
  const hasSky=chart=>(chart&&Array.isArray(chart.notes)?chart.notes:[]).some(note=>Number(note.skyHeight)>0
    ||(Array.isArray(note.slidePoints)&&note.slidePoints.some(point=>Number(point.sky)>0)));
  const grounded=chart=>({...chart,notes:chart.notes.map(note=>({...note,skyHeight:0,
    ...(Array.isArray(note.slidePoints)?{slidePoints:note.slidePoints.map(point=>({...point,sky:0}))}:{})}))});
  const skyless=[];
  for(const song of RHYTHM_SONGS){
    for(const difficulty of RHYTHM_DIFFICULTIES){
      const chart=song.difficulties[difficulty.id];
      if(!chart||hasSky(chart))continue;
      const strain=chartStrain(chart);
      if(strain&&strain.parts.skySwitch!==0)skyless.push(`${song.songId} ${difficulty.id}`);
    }
  }
  check('空中のノーツが無い譜面では、空中⇄地上の切り替えを1度も数えない',skyless.length===0,skyless.join(' / '));
  const sheriruth=RHYTHM_SONGS.find(song=>song.songId==='sheriruth');
  // 公開前は HELL をデバッグの試作の枠(RHYTHM_PROTO_SONGS の sheriruth_hell_debug)に置いている。公開したら公開曲のほうを見る
  const hellDebug=(loadRuntimeSongs().RHYTHM_PROTO_SONGS||[]).find(song=>song.songId==='sheriruth_hell_debug');
  const hell=(sheriruth&&sheriruth.difficulties.HELL)||(hellDebug&&hellDebug.difficulties.HELL),master=sheriruth&&sheriruth.difficulties.MASTER;
  check('Sheriruth HELL の譜面が見つかる(公開曲かデバッグの試作の枠)',!!(hell&&hell.notes&&hell.notes.length));
  if(hell&&master){
    // 公開前は表(RHYTHM_CHART_LEVELS)を通らないので、譜面に書いた Lv. が式の値と一致しているかも見る
    check('Sheriruth HELL の Lv. が式で出した値と同じ',hell.level===chartLevel(hell).level,`譜面 Lv.${hell.level} / 式 Lv.${chartLevel(hell).level}`);
    const back=chartStrain(grounded(hell)),masterStrain=chartStrain(master),hellStrain=chartStrain(hell);
    check('Sheriruth HELL の空中を地上へ戻すと、MASTER と同じ生の値になる',back.raw===masterStrain.raw,
      `戻した HELL ${back.raw} / MASTER ${masterStrain.raw}`);
    check('Sheriruth HELL は空中のぶん MASTER より重い',hellStrain.raw>masterStrain.raw&&hell.level>master.level,
      `HELL 生${hellStrain.raw} Lv.${hell.level} / MASTER 生${masterStrain.raw} Lv.${master.level}`);
  }
}

// --- 5. レベルが決めた範囲に収まっている ---
{
  const out=[];
  for(const song of RHYTHM_SONGS){
    for(const difficulty of RHYTHM_DIFFICULTIES){
      const chart=song.difficulties[difficulty.id];
      // HELL(6段目)は譜面がある曲だけにある。無い曲は測らない
      if(!chart||chart.totalNotes<LEVEL_MIN_NOTES)continue;
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
