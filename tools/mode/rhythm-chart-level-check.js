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
// Sheriruth の HELL は 2026-10-11 に案Z・高さの差39%で組み直した(MASTER の写しではない)ので、空中を地上へ戻すと
// 空中⇄地上の切り替えのぶんだけ生の値が下がり、切り替えを1度も数えなくなることを見る
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
    // 社長の値(LEVEL_OVERRIDES の sheriruth_hell_debug)があればその値、無ければ式の値と同じか
    {const {shownLevel,LEVEL_OVERRIDES}=require('./rhythm-chart-level.js');const want=shownLevel('sheriruth_hell_debug','HELL',hell),over=(LEVEL_OVERRIDES.sheriruth_hell_debug||{}).HELL;
      check(`Sheriruth HELL の Lv. が${Number.isFinite(over)?'社長の値':'式で出した値'}と同じ`,hell.level===want,`譜面 Lv.${hell.level} / ${Number.isFinite(over)?`社長の値 Lv.${over}・`:''}式 Lv.${chartLevel(hell).level}`);}
    const back=chartStrain(grounded(hell)),masterStrain=chartStrain(master),hellStrain=chartStrain(hell);
    check('Sheriruth HELL の空中を地上へ戻すと、空中のぶんだけ生の値が下がる',back.raw<hellStrain.raw&&back.parts.skySwitch===0&&hellStrain.parts.skySwitch>0,
      `戻した HELL ${back.raw}(切り替え ${back.parts.skySwitch}) / HELL ${hellStrain.raw}(切り替え ${hellStrain.parts.skySwitch})`);
    // 空中を測る式(2026-10-13 社長「今後作るものは測る形で。今あるものは変えなくていい」): 空中のある譜面の式の Lv. は、空中の難しさを
    // 1ノーツの重さに足した生の値そのもの(一律の倍率ではない)で、空中を地上と見なした Lv. より下にならない
    {const {levelFromRaw}=require('./rhythm-chart-level.js');const groundLv=chartLevel(grounded(hell)).level,lv=chartLevel(hell);
      check('Sheriruth HELL の式の Lv. は、空中込みの生の値から測った値(空中を地上と見なした Lv. 以上)',lv.level===levelFromRaw(lv.strain.raw)&&lv.level>=groundLv,`式 Lv.${lv.level} / 地上と見なして Lv.${groundLv}`);}
    // 公開中の HELL 4曲の表示(2026-10-20 夕方からは新しい測り方 v2 の値。下の 5-2 で9譜面まとめて見る)
    {const {shownLevel,loadRuntimeSongs:loadSongs}=require('./rhythm-chart-level.js');const all=[...(loadSongs().RHYTHM_PROTO_SONGS||[])];
      for(const [id,d,want] of [['sheriruth_hell_debug','HELL',61],['grievous_lady_hell','MASTER',69],['kaze_ga_soyogu_hell_debug','HELL',22],['against_my_own_shadow_hell_debug','HELL',51]]){
        const s=all.find(x=>x.songId===id),c=s&&s.difficulties[d];
        check(`公開中の HELL ${id} の表示は Lv.${want}(新しい測り方の値)`,!!c&&shownLevel(id,d,c)===want&&c.level===want,`譜面 Lv.${c&&c.level} / 表示 ${c&&shownLevel(id,d,c)} / 新しい式 ${c&&chartLevel(c).level}`);}}
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

// --- 5-2. 新しい測り方(v2・2026-10-20)。これから足す曲だけに使い、いまある曲の表示は1つも動かさない ---
{
  const L=require('./rhythm-chart-level.js');
  const {RHYTHM_PROTO_SONGS}=loadRuntimeSongs();
  const all=[...RHYTHM_SONGS,...(RHYTHM_PROTO_SONGS||[])];
  check('いまある曲は全部、前の測り方(v1)で測る一覧に入っている',all.length>0&&all.every(song=>L.levelFormulaFor(song.songId)==='v1'),
    all.filter(song=>L.levelFormulaFor(song.songId)!=='v1').map(song=>song.songId).join(','));
  check('一覧に無い曲(これから足す曲)はいちばん新しい測り方(v3・2026-10-21)',L.levelFormulaFor('a_new_song_not_listed')==='v3');
  check('v3 の重み: 入り乱れ 6・指を離した位置への持ち上げ・下ろしは 0.6 軽く(ほかは v2 と同じ)',L.SKY_MIXED_WORK===6&&L.SKY_NATURAL_RELIEF===.6
    &&L.WORK_V3.skyMixed===6&&L.WORK_V3.skyNatural===.6&&L.WORK_V3.sameSideHeld===L.WORK_V2.sameSideHeld&&L.WORK_V3.skySwitch===L.WORK_V2.skySwitch&&!L.WORK_V2.skyMixed);
  check('v2 の重み: 空中の入り乱れは 1.7倍、押さえている手の側は 3',L.SKY_MIX_FACTOR===1.7&&L.SAME_SIDE_HELD===3
    &&Math.abs(L.WORK_V2.sameHandFast-L.WORK.sameHandFast*1.7)<1e-9&&Math.abs(L.WORK_V2.skySwitch-L.WORK.skySwitch*1.7)<1e-9&&L.WORK_V2.sameSideHeld===3&&!L.WORK.sameSideHeld);
  // 社長が決めた5曲の HELL(2026-10-20)は、新しい測り方の値を表示にした。値は v2 で測った値と同じ・譜面の数字とも同じ
  // 2026-10-20 夕方からは公開中の HELL 9譜面すべて(Grievous Lady は試作の枠の MASTER の段に置いてある)。表示は v2 の値のまま(v3 は新曲から)
  const SET={toward_the_stars_short_hell_debug:57,rose_hell_debug:52,rose_short_hell_debug:50,sad_song_hell_debug:39,sad_song_short_hell_debug:43,
    sheriruth_hell_debug:61,grievous_lady_hell:69,against_my_own_shadow_hell_debug:51,kaze_ga_soyogu_hell_debug:22};
  for(const [id,want] of Object.entries(SET)){
    const d=id==='grievous_lady_hell'?'MASTER':'HELL',song=all.find(x=>x.songId===id),c=song&&song.difficulties[d];
    check(`${id} の HELL は Lv.${want}(新しい測り方の値・譜面の数字と表示が同じ)`,!!c&&c.level===want&&L.shownLevel(id,d,c)===want&&L.chartLevel(c,{formula:'v2'}).level===want,
      c?`譜面 ${c.level} / 表示 ${L.shownLevel(id,d,c)} / v2 ${L.chartLevel(c,{formula:'v2'}).level} / v1 ${L.chartLevel(c,{formula:'v1'}).level}`:'譜面が無い');
  }
  // ② 押さえている手の側に来るノーツ: 右で押さえている間に右へ来るタップは数え、左へ来るタップは数えない
  const hold={type:'HOLD',lane:4,subLane:8,subLaneWidth:2,timeMs:1000,endTimeMs:3000};
  const taps=(lane)=>Array.from({length:10},(_,i)=>({type:'TAP',lane,subLane:lane*2,subLaneWidth:2,timeMs:1200+i*150}));
  const same=chartStrain({notes:[hold,...taps(5)]},{formula:'v2'}),other=chartStrain({notes:[hold,...taps(0)]},{formula:'v2'});
  check('② 押さえている側へ来るノーツを数え、反対側は数えない',same.parts.sameSideHeld===10&&other.parts.sameSideHeld===0,`同じ側 ${same.parts.sameSideHeld} / 反対側 ${other.parts.sameSideHeld}`);
  const sameV1=chartStrain({notes:[hold,...taps(5)]},{formula:'v1'}),otherV1=chartStrain({notes:[hold,...taps(0)]},{formula:'v1'});
  check('② は新しい測り方だけで重くなる(前の測り方では足さない)',same.raw>sameV1.raw&&Math.abs(other.raw-otherV1.raw)<1e-9,
    `同じ側 v2 ${same.raw} / v1 ${sameV1.raw}・反対側 v2 ${other.raw} / v1 ${otherV1.raw}`);
}

// --- 5-3. 地上と空中の入り乱れ(v3・2026-10-21)。入り乱れは重く、指を離した位置への持ち上げ・下ろしは軽く ---
{
  const L=require('./rhythm-chart-level.js');
  // 右手が地上の帯の終わり(レーン4)を離した直後に、同じ位置で空中のタップ(自然)/遠い位置で空中のタップ(入り乱れ)
  const base=Array.from({length:12},(_,i)=>({type:'TAP',lane:i%2?4:1,subLane:i%2?8:2,subLaneWidth:2,timeMs:500+i*400}));
  const pair=(lane)=>[{type:'TAP',lane:4,subLane:8,subLaneWidth:2,timeMs:6000},{type:'TAP',lane,subLane:lane*2,subLaneWidth:2,skyHeight:1,timeMs:6200}];
  const near=chartStrain({notes:[...base,...pair(4)]}),far=chartStrain({notes:[...base,...pair(6)]});
  check('v3 は、指を離した位置への持ち上げを自然として数え、遠い位置での高さの入れ替わりを入り乱れとして数える',near.parts.skyNatural===1&&near.parts.skyMixed===0&&far.parts.skyMixed===1&&far.parts.skyNatural===0,
    `近い: 自然 ${near.parts.skyNatural}・入り乱れ ${near.parts.skyMixed} / 遠い: 自然 ${far.parts.skyNatural}・入り乱れ ${far.parts.skyMixed}`);
  check('v3 は入り乱れを重く数える(同じ形の v2 より生の値が上)',far.raw>chartStrain({notes:[...base,...pair(6)]},{formula:'v2'}).raw&&far.raw>near.raw,`遠い v3 ${far.raw} / v2 ${chartStrain({notes:[...base,...pair(6)]},{formula:'v2'}).raw} / 近い v3 ${near.raw}`);
}

// --- 6. 画面へ出ている ---
{
  const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
  check('体験版の曲えらびにレベルが出る',game.includes('data-rhythm-demo-level')&&/Lv\.\{chart\.level\}/.test(game));
  check('デバッグの曲一覧にもレベルが出る',/Lv\.\{chart\.level\}/.test(game));
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
