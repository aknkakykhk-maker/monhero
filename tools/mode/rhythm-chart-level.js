#!/usr/bin/env node
// 譜面の難易度レベル（Lv.）を、譜面そのものから数字で出す。
//
//   node tools/mode/rhythm-chart-level.js            # ランタイムの全曲・全難易度を一覧
//   node tools/mode/rhythm-chart-level.js --verbose  # 内訳（ピーク・平均・要素別）も出す
//   node tools/mode/rhythm-chart-level.js --write    # ランタイムのレベル表を書き換える
//   node tools/mode/rhythm-chart-level.js --calibrate # 基準（MASTER=30）に合う係数を出す
//
// 【なぜ要るか】
// これまでレベルは EASY=1 / NORMAL=3 / HARD=5 / EXPERT=7 / MASTER=9 の決め打ちで、
// **曲が変わっても同じ数字**だった。曲によって難しさは違うのに、その差が表に出ない。
// 曲が増えるほど「どれから遊べばいいか」が分からなくなる。
//
// 【基準】
// **Monster Hero 候補v3 の MASTER を Lv.30** とし、そこから全部の譜面を測る。
// 30 という数字はユーザーが決めた基準点で、ここだけは動かさない（LEVEL_ANCHOR）。
//
// 【測り方】
// 音ゲーの難しさは「1曲の合計」ではなく「いちばん忙しいところ」で決まる。
// 長いだけの曲が難しいわけではないので、
//   ・4秒の窓ごとに「毎秒どれだけ指を動かすか（仕事量）」を出す
//   ・その上位10%の平均（＝いちばん忙しいところ）を6割
//   ・曲全体の平均（＝ずっと忙しいか）を4割
// で合わせる。1ノーツの仕事量は、次の5つを掛け合わせて出す。
//   1. 詰まり具合  … 直前のノーツとの間隔が短いほど重い
//   2. 横の移動    … 直前に触った場所からの距離÷時間（レーン毎秒）
//   3. 細さ        … 幅1・幅2のノーツは狙いが要る
//   4. 種類        … 同時押し・FLICK・終点フリック・押さえながらの別ノーツ
//   5. 経路        … SLIDEの折り返しの多さ
// 空中の段(6段目 HELL・2026-10-10 社長「空中のぶんを数字に足す」)は、2. の「横の移動」と 5. の「追従の速さ」を
// 横と縦の距離で数える(空中と地上を同じ指で行き来するぶん、指の動く距離が増える)。
// 空中のノーツが無い譜面は縦の距離が0なので、数字は1つも変わらない。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {HAND_MODEL,noteTouchLane,noteTouchSpan,separationRange}=require('./rhythm-hand-model.js');

const ROOT=path.resolve(__dirname,'..','..');

// --- ここだけは動かさない基準点 ---
const LEVEL_ANCHOR=Object.freeze({
  songId:'monster_hero_theme_candidate_v3',
  difficulty:'MASTER',
  level:30,
});
// 生の値をレベルへ直す係数。LEVEL_ANCHOR がぴったり30になるよう、
// tools/mode/rhythm-chart-level.js --calibrate で出した値をここへ書く。
// 2026-09-05、譜面の作り方を直した（同時押しの手前判定にHOLD/SLIDEの終わりを含める／
// 自動修正が1拍前まで動かせる／拍が立たない曲は16分裏を絞る／曲ごとの歯ごたえで量を変える）
// ので、基準の譜面も変わった。--calibrate で取り直した値。
// 基準(Monster Hero 候補v3 MASTER = 30)そのものは動かしていない。
// ★2026-09-27 からは**この値を固定する**(ユーザー指示「今後の運用に適した設定にして」)。
// 基準の曲も作り直しで少し変わる(6レーンで作り直したあと Lv.29 に)。そのたびに --calibrate で取り直すと、
// 何も変わっていない他の曲のレベルまで上下してしまう(取り直すと115譜面のうち57譜面が +1)。
// 基準の曲が Lv.30±1 に収まっているうちは取り直さない。変えるときはユーザーに確かめてから
// (rhythm-chart-level-check.js の LEVEL_SCALE_FIXED も一緒に直す)
const LEVEL_SCALE=23.2739;
// レベルは仕事量に**そのまま比例**させる（曲がりを付けない）。
// こうしておくと「Lv.が2倍なら忙しさも2倍」と説明でき、
// 曲が増えても物差しがぶれない。上限は先の曲のために広く取っておく。
const LEVEL_GAMMA=1;
// 上限は「振り切れ」を作らないためのもの。50 に置いていたが、FREEDOM DiVE↓ の MASTER が
// そこへ張り付いたので広げた(2026-09-13・ユーザー指示「50ぐらいにしてほしいけど
// 最大は決めないでほしい」)。上限に当たった譜面は、それ以上どれだけ忙しくても同じ数字になり、
// **後から来たもっと難しい曲と区別できなくなる**。数字はそのまま仕事量に比例するので、
// 広げても既存の曲のレベルは1つも動かない(いちばん高い曲でも Lv.38)。
const LEVEL_MIN=1,LEVEL_MAX=999;

// --- 仕事量の重み（意味のある単位で持つ） ---
const WORK=Object.freeze({
  windowMs:4000,          // 「いちばん忙しいところ」を測る窓
  peakShare:.1,           // 上位何割をピークとするか
  peakWeight:.62,         // ピークと平均の混ぜ方
  gapBoostMax:1.2,        // 詰まりで増える上限（1 + これ）
  laneBoostMax:1.2,       // 横移動で増える上限
  thinWidth1:.35,         // 幅1の狙いにくさ
  thinWidth2:.15,
  // 同時押しの重さは「離れているかどうか」で決める。
  // 2つ同時に押すこと自体は難しくない（指は2本ある）。難しいのは近いときで、
  // 指の太さぎりぎりだと狙いが要る。左端と右端なら、ほとんど1つ押すのと変わらない。
  chordWide:.15,          // 2レーン以上離れた同時押し
  chordTight:.6,          // 1レーン（指の太さ）しか離れていない同時押し
  chordWideLanes:2,
  chordTightLanes:1,
  // 同時押しが続けて来るか（1つだけの「決めの一発」と、右左へ振られる連なりは別もの）
  chordChain:.25,
  chordChainMs:280,
  flick:.25,
  endFlick:.35,
  whileHeld:.5,           // 押さえっぱなしの最中に押す
  // 押さえている指の**外側**を叩く（指を交差させる）。押さえながら叩くだけより重い。
  cross:.45,
  slideTurn:.2,           // SLIDEの折り返し1回ぶん
  slideTurnMax:.8,
  // SLIDEの追従の速さ。端から端まで走る一本は、同じ長さの小さいSLIDEより重い。
  slideTrack:.5,
  slideTrackMax:.9,
  // 空中と地上を切り替える(直前のノーツと狙う判定ラインが違う)。狙う線そのものが変わるので、
  // 指の交差(cross)と同じ重さで足す(どちらも「いま押さえている・触っている所とは別の所を狙い直す」動き。2026-10-10・社長「空中のぶんを数字に足す」)。
  // 空中のノーツが無い譜面では一度も起きないので、既存の曲の数字は変わらない
  // 2026-10-13 夜 合わせ直し(社長「空中はけっこう難しい。難易度の見積もりが甘い」): 公開中の HELL 3曲を新しい式で測った値が、
  // 社長が遊んで違和感の無かった表示(54・60・23)に近づくように4つの重みを組み合わせで探した。ずれの最大がいちばん小さい組
  // (Sheriruth 57(+3)・Grievous Lady 56(-4)・風がそよぐ場所 22(-1))。表示は空中を地上と見なした値の一律1.2倍なので、
  // 空中の量を数える式ではこれより近づかない(Sheriruth は切り替えが多く、Grievous Lady は地上だけでも重い)。社長が遊んで微調整する
  // 2026-10-13 夜(2回目) 同じ側の速い連打(sameHandFast)を足して4曲(公開中3曲の表示 54・60・23 と、社長の体感の AMOS HELL 42)で合わせ直した:
  // Sheriruth 54(0)・Grievous Lady 60(0)・風がそよぐ場所 21(-2)・AMOS 42(0)。切り替えの2つは少し戻した(Sheriruth が先に高く出るため)
  skySwitch:.7,           // (前 1 ← .45)空中のノーツが無い譜面では一度も起きない
  // 空中の難しさをそのまま測る(2026-10-13 社長「今後作るものは測る形で」。一律の SKY_LEVEL_FACTOR のかわり)。空中の無い譜面では一度も起きない
  skySwitchFast:1,        // (前 1.6 ← .45)地上⇔空中の切り替えが SKY_FAST_MS より速いほど足す(最大この値)
  skyCross:1.2,           // 上下に分かれた交差1回ぶん(帯の途中で両手が入れ替わる動き。その時刻に仕事として足す)
  skySplit:.5,            // (前 .25)片手が空中・片手が地上で押さえている最中のノーツ(高さの違う長押しを押さえながら叩く)
  // 同じ側の親指で続けて叩く間隔が、叩き直しの快適な間隔(HAND_MODEL.restrikeComfortMs・150ms)より短いほど足す(最大この値)。空中の無い譜面では数えない。
  // 2026-10-13 夜 社長が AMOS HELL を遊んで「Lv.42 はありそう」(式では36)。AMOS は約0.1秒おきの速い続きの8割近くが同じ側(Sheriruth・Grievous Lady は4割強)で、
  // 「1つ前のノーツとの間隔」だけを見る詰まり具合(1.)では、左右交互の連打と同じ側の連打が同じ重さになっていた
  sameHandFast:6,
});
// --- 新しい測り方(v2・2026-10-20 社長「ヘルは空中が入ることで難易度設定として地上空中の入り乱れを重く考えたほうがいい」
//     「スライド、ホールドも例えば右側にスライドやホールドがあって右で押さえてるのに右側にノーツが来るパターンとかも難易度として重くなる」) ---
// ① 地上と空中の入り乱れ: 切り替え・速い切り替え・上下の交差・高さの違う押さえ中・同じ手の速い連打の重みを、まとめて SKY_MIX_FACTOR 倍。
//    Toward the Stars(short)の HELL が社長の体感 57 になる倍率(1.6倍で55・1.8倍で58)。空中の無い譜面では一度も起きない
// ② 押さえている手の側にノーツが来る(sameSideHeld): ホールド・スライドを押さえている間に、その帯のいる側(左右の半分)へ別のノーツ。
//    地上・空中・全難易度で数える。重みは SAME_SIDE_HELD(「押さえながら叩く」whileHeld の6倍)。今の267譜面で 1→27譜面がどれも+1、2→46譜面(+2が3)、
//    3→67譜面(+1が53・+2が13・+4が1=The City Beneath the Comets EXPERT 押さえ側53個)、4→+6が出て HARD でも+4。社長「もっと重く(2倍より上)」で3
// ★v2 はこれから足す曲に使う。いま公開・試作中の曲(LEVEL_V1_SONGS)は v1(上の WORK)のまま測るので、表示は1つも動かない
const SKY_MIX_FACTOR=1.7,SAME_SIDE_HELD=3;
const WORK_V2=Object.freeze({...WORK,
  skySwitch:WORK.skySwitch*SKY_MIX_FACTOR,skySwitchFast:WORK.skySwitchFast*SKY_MIX_FACTOR,skyCross:WORK.skyCross*SKY_MIX_FACTOR,
  skySplit:WORK.skySplit*SKY_MIX_FACTOR,sameHandFast:WORK.sameHandFast*SKY_MIX_FACTOR,sameSideHeld:SAME_SIDE_HELD});
// v1(前の測り方)で測る曲。2026-10-20 にあった全曲(公開中・試作の枠)。ここへ足さない曲は v2 で測る。★消さない(消すと表示が動く)
const LEVEL_V1_SONGS=Object.freeze(new Set([
  'atsu_cup_theme_test', 'width_test', 'wide_width_test', 'end_flick_test', 'monster_note_test', 'monster_hero_theme_candidate',
  'monster_hero_theme_candidate_v2', 'monster_hero_theme_candidate_v3', 'six_eternel_remix_beat', 'mf_ichika_mix', 'monster_hero', 'monster_hero_another',
  'six_eternel_beat', 'six_eternel_remix', 'stay_with_me', 'kiki_issen', 'kaze_ga_soyogu', 'close_to_your_heart',
  'eiki_boss_remix', 'pandora_boss_remix', 'dullahan', 'dullahan_clockwork', 'toriko', '4u_hitasura',
  'kindan_no_resistance', 'crossing_field', 'nothing_without_you', 'mou_hitotsu_no_sekai_e', 'senjou_no_shippuu', 'makutsu_no_senritsu',
  'the_city_beneath_the_comets', 'freedom_dive', 'only_my_railgun', 'big_bridge_no_shitou', 'rising_hope', 'haruka',
  'stay_with_me_short', 'kiki_issen_short', 'crazy_party_night', 'crazy_party_night_full', 'emerald_rush', 'wrath_of_the_thorn_king',
  'monster', 'monster_short', 'anima', 'journey', 'sheriruth', 'grievous_lady',
  'against_my_own_shadow', 'rose', 'rose_short', 'sad_song', 'sad_song_short', 'toward_the_stars_short',
  'atsu_cup_theme_debug_short', 'sheriruth_proto', 'sheriruth_hell_debug', 'sheriruth_stop_ref', 'sheriruth_stop_ref_trim', 'against_my_own_shadow_hell_debug',
  'rose_hell_debug', 'rose_short_hell_debug', 'sad_song_hell_debug', 'sad_song_short_hell_debug', 'toward_the_stars_short_hell_debug', 'kaze_ga_soyogu_hell_debug',
  'grievous_lady_hell'
]));
const levelFormulaFor=songId=>LEVEL_V1_SONGS.has(songId)?'v1':'v2';
const formulaWork=formula=>formula==='v1'?WORK:WORK_V2;
const SKY_FAST_MS=250;


const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
// 空中の高さ1が、横に何レーンぶんの距離か。
// 横画面(844×390)で、空中の判定ラインは地上より画面の高さの25%上(RHYTHM_SKY_LIFT・97.5px)。
// 判定ラインの高さでの道の幅は画面の約81%で6レーン(1レーン約114px)。97.5÷114 ≒ 0.86レーン。
// 横の移動と同じ物差し(HAND_MODEL.laneSpeedComfort・レーン毎秒)で数えるため、距離をレーンへそろえる。
const SKY_LANES=.86;
// ノーツの「触る点」の高さ(0=地上〜1=空中)。SLIDEは始点の高さ
const noteTouchSky=note=>{
  if(note&&note.type==='SLIDE'&&Array.isArray(note.slidePoints)&&note.slidePoints.length){
    return clamp(Number(note.slidePoints[0].sky)||0,0,1);
  }
  return clamp(Number(note&&note.skyHeight)||0,0,1);
};
// 横と縦を合わせた距離(レーン)。縦が0なら横の距離そのもの(Math.hypot(x,0) は |x| と同じ値)
const touchDistance=(laneDelta,skyDelta)=>Math.hypot(laneDelta,skyDelta*SKY_LANES);
const round=(value,digits=3)=>Math.round(value*10**digits)/10**digits;

// --- 1ノーツぶんの仕事量 ---
const noteWork=(note,previous,context,WORK)=>{
  const timeMs=Number(note.timeMs)||0;
  let work=1;
  // 1. 詰まり具合
  if(previous){
    const gap=Math.max(1,timeMs-(Number(previous.timeMs)||0));
    if(gap<HAND_MODEL.restrikeComfortMs){
      work*=1+WORK.gapBoostMax*(HAND_MODEL.restrikeComfortMs-gap)/HAND_MODEL.restrikeComfortMs;
    }
    // 2. 横の移動（触る点どうしの距離を時間で割る）
    const laneSpeed=touchDistance(noteTouchLane(note)-noteTouchLane(previous),noteTouchSky(note)-noteTouchSky(previous))/(gap/1000);
    work*=1+clamp(laneSpeed/HAND_MODEL.laneSpeedComfort,0,WORK.laneBoostMax);
  }
  // 3. 細さ
  const width=Number(note.subLaneWidth)||2;
  if(width<=1)work+=WORK.thinWidth1;
  else if(width<=2)work+=WORK.thinWidth2;
  // 4. 種類
  if(context.chordGapLanes!=null){
    const t=clamp((context.chordGapLanes-WORK.chordTightLanes)/(WORK.chordWideLanes-WORK.chordTightLanes),0,1);
    work+=WORK.chordTight+(WORK.chordWide-WORK.chordTight)*t;
  }
  if(context.chordChain)work+=WORK.chordChain;
  if(note.type==='FLICK')work+=WORK.flick;
  if(note.endFlick===true)work+=WORK.endFlick;
  if(context.held)work+=WORK.whileHeld;
  if(context.cross)work+=WORK.cross;
  if(context.sameSideHeld&&WORK.sameSideHeld)work+=WORK.sameSideHeld;
  if(context.skySwitch)work+=WORK.skySwitch;
  if(context.skySwitchFast)work+=WORK.skySwitchFast*context.skySwitchFast;
  if(context.skySplit)work+=WORK.skySplit;
  if(context.sameHandFast)work+=WORK.sameHandFast*context.sameHandFast;
  // 5. SLIDEの経路（折り返しの多さ と 追従の速さ）
  if(note.type==='SLIDE'&&Array.isArray(note.slidePoints)&&note.slidePoints.length>=2){
    const points=note.slidePoints;
    let turns=0,lastDirection=0,fastest=0;
    for(let i=1;i<points.length;i++){
      const delta=(Number(points[i].lane)||0)-(Number(points[i-1].lane)||0);
      const direction=delta>.01?1:delta<-.01?-1:0;
      if(direction&&lastDirection&&direction!==lastDirection)turns++;
      if(direction)lastDirection=direction;
      const deltaMs=(Number(points[i].timeMs)||0)-(Number(points[i-1].timeMs)||0);
      const skyDelta=clamp(Number(points[i].sky)||0,0,1)-clamp(Number(points[i-1].sky)||0,0,1);
      if(deltaMs>0)fastest=Math.max(fastest,touchDistance(delta,skyDelta)/(deltaMs/1000));
    }
    work+=Math.min(WORK.slideTurnMax,turns*WORK.slideTurn);
    work+=Math.min(WORK.slideTrackMax,WORK.slideTrack*fastest/HAND_MODEL.laneSpeedComfort);
  }
  return work;
};

// --- 譜面1つぶんの生の値 ---
// これより少ないノーツの譜面は測らない。数個しか無い確認用の型は、
// 「いちばん忙しい4秒」を取っても意味のある数字にならない。
const LEVEL_MIN_NOTES=8;
const chartStrain=(chart,{formula='v2'}={})=>{
  const WORK=formulaWork(formula);
  const notes=(chart&&Array.isArray(chart.notes)?chart.notes:[])
    .slice().sort((a,b)=>(Number(a.timeMs)||0)-(Number(b.timeMs)||0));
  if(notes.length<LEVEL_MIN_NOTES)return null;
  const firstMs=Number(notes[0].timeMs)||0;
  const lastMs=Math.max(...notes.map(note=>Number(note.endTimeMs)||Number(note.timeMs)||0));
  const spanMs=Math.max(WORK.windowMs,lastMs-firstMs);
  // 押さえっぱなしの区間（HOLD/SLIDE）
  const sustains=notes.filter(note=>note.type==='HOLD'||note.type==='SLIDE')
    .map(note=>({note,startMs:Number(note.timeMs)||0,endMs:Number(note.endTimeMs)||0}));
  // 同時押しの判定用。「同じ瞬間に何個あるか」だけでなく、
  // 「いちばん近い相方とどれだけ離れているか」まで持つ（離れているほど易しい）。
  const sameTime=new Map();
  for(const note of notes){
    const key=Math.round((Number(note.timeMs)||0)/8);
    if(!sameTime.has(key))sameTime.set(key,[]);
    sameTime.get(key).push(note);
  }
  const chordGapOf=note=>{
    const group=sameTime.get(Math.round((Number(note.timeMs)||0)/8))||[];
    if(group.length<2)return null;
    let best=Infinity;
    for(const other of group){
      if(other===note)continue;
      best=Math.min(best,separationRange(noteTouchSpan(note),noteTouchSpan(other)).min);
    }
    return Number.isFinite(best)?best:null;
  };
  // 同時押しが続けて来るところ（右左へ振られる連なり）。
  // ノーツに印が付いていなくても、譜面の形だけで分かるように「同じ瞬間に2つある位置」の
  // 並びから見つける。ランタイムの譜面には印が入らないため、印には頼らない。
  const chordTimes=[...sameTime.entries()].filter(([,group])=>group.length>=2)
    .map(([key])=>key*8).sort((a,b)=>a-b);
  const chainedChord=timeMs=>chordTimes.some(other=>
    other<timeMs-1&&timeMs-other<=WORK.chordChainMs);
  // 押さえている指の外側を叩いているか（＝指を交差させる置き方）。
  // 押さえているノーツの中心が画面の左寄りなら、そのさらに左を叩くのが交差。
  const crossOf=(note,timeMs)=>{
    const covering=sustains.filter(span=>span.startMs<timeMs-1&&timeMs<span.endMs);
    if(covering.length!==1)return false;
    const holdLane=noteTouchLane(covering[0].note),noteLane=noteTouchLane(note);
    if(Math.abs(noteLane-holdLane)<.5)return false;
    return holdLane<=2?noteLane<holdLane:noteLane>holdLane;
  };
  // 空中の難しさ(空中のある譜面だけ・2026-10-13)。上下に分かれた交差の時刻と、長押しのその時刻の高さ
  const sky=chartHasSky(chart),HR=sky||WORK.sameSideHeld?require('./rhythm-chart-hand-rules.js'):null;
  const skyCrossTimes=[];
  if(sky)for(let i=0;i<sustains.length;i++)for(let j=i+1;j<sustains.length;j++){const a=sustains[i],b=sustains[j];
    const s0=Math.max(a.startMs,b.startMs),e0=Math.min(a.endMs,b.endMs);if(e0-s0<10)continue;let prev=0;
    for(let t=s0;t<=e0;t+=10){const d=HR.centerAt(a.note,t)-HR.centerAt(b.note,t),sg=Math.abs(d)<1e-6?0:Math.sign(d);
      if(sg&&prev&&sg!==prev&&HR.levelAt(a.note,t)!==HR.levelAt(b.note,t))skyCrossTimes.push(t);if(sg)prev=sg;}}
  const works=[];
  let previous=null;
  const lastByHand={};
  const parts={sameSideHeld:0,gap:0,lane:0,thin:0,chord:0,chordChain:0,flick:0,held:0,cross:0,slide:0,skySwitch:0,...(sky?{skySwitchFast:0,skyCross:0,skySplit:0,sameHandFast:0}:{})};
  for(const note of notes){
    const timeMs=Number(note.timeMs)||0;
    const chordGapLanes=chordGapOf(note);
    const held=sustains.some(span=>span.startMs<timeMs-1&&timeMs<span.endMs);
    const chordChain=chordGapLanes!=null&&chainedChord(timeMs);
    const cross=held&&crossOf(note,timeMs);
    // ② 押さえている手の側に来るノーツ(v2 だけが重みを持つ。v1 では空中のある譜面だけ数を内訳に出す)。帯のいる位置はその時刻の位置(スライドは動く)
    const sameSideHeld=!!HR&&sustains.some(span=>span.note!==note&&span.startMs<timeMs-1&&timeMs<span.endMs-1&&(HR.centerAt(span.note,timeMs)<3)===(noteTouchLane(note)<3));
    // 空中(高さ半分以上)と地上の切り替え。同時押しの相方が違う段なのも切り替えに数える(並べた順で直前になる)
    const skySwitch=!!previous&&(noteTouchSky(note)>=.5)!==(noteTouchSky(previous)>=.5);
    const gapMs=previous?Math.max(1,timeMs-(Number(previous.timeMs)||0)):Infinity;
    const skySwitchFast=sky&&skySwitch&&gapMs<SKY_FAST_MS?(SKY_FAST_MS-gapMs)/SKY_FAST_MS:0;
    const noteSky=noteTouchSky(note)>=.5?1:0;
    const skySplit=sky&&sustains.some(span=>span.note!==note&&span.startMs<timeMs-1&&timeMs<span.endMs&&HR.levelAt(span.note,timeMs)!==noteSky);
    // 触る点が左半分なら左手・右半分なら右手(同じ瞬間の同時押しどうしは数えない)
    const hand=noteTouchLane(note)<3?'L':'R',handGap=lastByHand[hand]!=null?timeMs-lastByHand[hand]:Infinity;
    const sameHandFast=sky&&handGap>8&&handGap<HAND_MODEL.restrikeComfortMs?(HAND_MODEL.restrikeComfortMs-handGap)/HAND_MODEL.restrikeComfortMs:0;
    lastByHand[hand]=timeMs;
    const work=noteWork(note,previous,{chordGapLanes,held,chordChain,cross,skySwitch,skySwitchFast,skySplit,sameHandFast,sameSideHeld},WORK);
    if(sameSideHeld)parts.sameSideHeld++;
    if(sameHandFast)parts.sameHandFast++;
    if(skySwitchFast)parts.skySwitchFast++;
    if(skySplit)parts.skySplit++;
    works.push({timeMs,work});
    if(chordGapLanes!=null)parts.chord++;
    if(chordChain)parts.chordChain++;
    if(cross)parts.cross++;
    if(skySwitch)parts.skySwitch++;
    if(held)parts.held++;
    if(note.type==='FLICK')parts.flick++;
    if((Number(note.subLaneWidth)||2)<=2)parts.thin++;
    previous=note;
  }
  // 上下に分かれた交差は、その時刻に1回ぶんの仕事として足す(帯の途中で起きるので、ノーツの重さには乗らない)
  for(const t of skyCrossTimes){works.push({timeMs:t,work:WORK.skyCross});parts.skyCross++;}
  // 4秒の窓（1秒ずつずらす）で、毎秒の仕事量を出す
  const step=1000;
  const windows=[];
  for(let start=firstMs;start<=firstMs+spanMs-WORK.windowMs+step;start+=step){
    const end=start+WORK.windowMs;
    let sum=0;
    for(const entry of works){
      if(entry.timeMs>=start&&entry.timeMs<end)sum+=entry.work;
    }
    windows.push(sum/(WORK.windowMs/1000));
  }
  if(!windows.length)windows.push(works.reduce((a,b)=>a+b.work,0)/(spanMs/1000));
  const sorted=windows.slice().sort((a,b)=>b-a);
  const peakCount=Math.max(1,Math.round(sorted.length*WORK.peakShare));
  const peak=sorted.slice(0,peakCount).reduce((a,b)=>a+b,0)/peakCount;
  const average=windows.reduce((a,b)=>a+b,0)/windows.length;
  const raw=peak*WORK.peakWeight+average*(1-WORK.peakWeight);
  return {raw:round(raw),peak:round(peak),average:round(average),
    notes:notes.length,seconds:round(spanMs/1000,1),
    notesPerSecond:round(notes.length/(spanMs/1000),2),parts};
};

const levelFromRaw=raw=>{
  if(!(raw>0))return 0;
  return clamp(Math.round(LEVEL_SCALE*Math.pow(raw,LEVEL_GAMMA)/10),LEVEL_MIN,LEVEL_MAX);
};

// (前の式・2026-10-13 まで)空中のノーツがある譜面(HELL)は、空中を地上と見なした難しさの SKY_LEVEL_FACTOR 倍をレベルにしていた。
// いまは空中の難しさを1ノーツの重さに足して測る(chartLevel)。SKY_LEVEL_FACTOR は比べるための値(skyFactorLevel)と、公開中の HELL の固定値の根拠として残す
// (2026-10-11 社長「空中あるだけで難易度2割増しぐらいの認識で数値設定したほうがいいよ」→ 10/12 朝に3割 → 同日夕方「マスターの2割増しぐらいをベース難易度に」で2割へ戻した)。
// 空中のノーツが無い譜面(地上の5難易度・公開中の曲)は、今までと1つも変わらない。
// 生の値(strain.raw)は空中込みのまま返す(内訳で「空中⇄地上の切り替え」がどれだけ効いているかを見られるように)
const SKY_LEVEL_FACTOR=1.2;
const chartHasSky=chart=>(chart&&Array.isArray(chart.notes)?chart.notes:[]).some(note=>Number(note&&note.skyHeight)>0
  ||(Array.isArray(note&&note.slidePoints)&&note.slidePoints.some(point=>Number(point&&point.sky)>0)));
const groundedChart=chart=>({...chart,notes:chart.notes.map(note=>({...note,skyHeight:0,
  ...(Array.isArray(note.slidePoints)?{slidePoints:note.slidePoints.map(point=>({...point,sky:0}))}:{})}))});
// formula … 'v2'(新しい測り方・既定)か 'v1'(前の測り方)。曲ごとの決め方は levelFormulaFor
const chartLevel=(chart,{formula='v2'}={})=>{
  const strain=chartStrain(chart,{formula});
  if(!strain)return {level:0,strain:null};
  if(!chartHasSky(chart))return {level:levelFromRaw(strain.raw),strain};
  // 空中のある譜面(HELL)は、空中の難しさを1ノーツの重さに足した生の値をそのまま Lv. にする(2026-10-13 社長「今後作るものは測る形で」)。
  //   一律の SKY_LEVEL_FACTOR 倍はやめた。公開中の HELL 3曲の表示は LEVEL_OVERRIDES で前の値のまま(「今あるものは変えなくていい」)。
  //   groundLevel(空中を地上と見なした Lv.)・skyFactorLevel(前の式の値)は比べるために返す
  const ground=chartStrain(groundedChart(chart),{formula}),groundLevel=levelFromRaw(ground.raw);
  return {level:levelFromRaw(strain.raw),strain,groundLevel,skyFactorLevel:clamp(Math.round(groundLevel*SKY_LEVEL_FACTOR),LEVEL_MIN,LEVEL_MAX)};
};

// --- 1曲ぶんのレベルを、難易度の順に並べて出す ---
// レベルは整数なので、生の値がちゃんと上がっていても丸めると同じ数字になることがある。
// 2026-09-06、Stay With Me が EASY 生2.107(→Lv.5) / NORMAL 生2.421(→Lv.5) となり、
// 曲えらびに「EASY Lv.5 / NORMAL Lv.5」と同じ数字が2つ並んだ。
// 譜面は確かにNORMALのほうが重い（ノーツ271→309・フリック0→19）のに、
// プレイヤーには「同じ難しさ」または「表示の不具合」に見える。
// そこで、**生の値が確かに上なら、表示のレベルも必ず1以上上げる**。
// 生の値そのものは変えないので、内訳（--verbose）を見れば本当の値が分かる。
// --- 人が遊んで確かめて決めた上書き ---
// 式の数字が手ごたえと大きく外れた譜面だけ、ここに根拠つきで書く。式・物差し(LEVEL_SCALE)・ほかの曲の数字は変えない。
// 書くときは「人の指のくせのボット」で既存曲と同じ条件で比べ、取りこぼし方が近い曲のレベルに合わせる。
const LEVEL_OVERRIDES=Object.freeze({
  // 2026-10-11 社長「MASTER が難易度(Lv.45)ほど難しく感じなかった」→「数字を下げる(譜面は変えない)」。
  // 人の指のくせのボット(横画面・指のくせ3種)で、MISS 0.87%・GREAT以下 2.49%・MARVELOUS未満 15.3%。
  // Journey MASTER(36)・ハルカ MASTER(33)より少なく、ビッグブリッヂの死闘 MASTER(34)より多い → 35。
  // 式が高く出たのは「同時押し」224・「押さえながら叩く」110 を1つずつ重く数えるため(この曲の同時押しは左右に離れた両手で取る形、
  // 押さえているのはゆっくり動く長いスライドが多く、数ほど難しくない)
  sheriruth:Object.freeze({MASTER:35}),
  // 2026-10-13 夜 社長「(Against My Own Shadow の)マスターの被りって、さっき決めたルール的にアウトだよね?」→ MASTER と EXPERT の押さえている帯の中のノーツを
  // 帯の外へ置き直した(時刻・幅・ノーツ数は同じ)。帯から外すと横の動きが少し増え、EXPERT の式の値が 22.44→22.58 で丸めると 23 になる。
  // どこへ置いても 22.5 を越える(1か所ずつ候補を比べても 22.53)。直したのは押せなかった所なので、表示は前の Lv.22 のまま(社長「Lv. は変えない」)
  against_my_own_shadow:Object.freeze({EXPERT:22}),
  // デバッグの試作の枠の HELL も、曲の名前(試作の枠の songId)で書ける(2026-10-11 社長「ヘル2つの難易度は、両方デバッグしてみたときにまた数値の調整はすると思う」)。
  // 書いた値が表示に出る(rhythm-hell-mix.js が譜面の Lv. に書く)。式の値(空中を地上と見なした Lv. の SKY_LEVEL_FACTOR 倍)は消えずに検査で並べて出る。
  // 例: sheriruth_hell_debug:Object.freeze({HELL:50}), grievous_lady_hell:Object.freeze({MASTER:55}),
  // 2026-10-13 社長「(HELL の Lv. は)今後作るものは測る形で。今あるものは変えなくていい」: 空中を測る新しい式に変えても、
  // 公開中の HELL 3曲(と古い試作の Sheriruth)の表示は前の式(空中を地上と見なした Lv. の 1.2倍)の値のまま。
  // 新しい式の値は検査(rhythm-chart-level-check.js)で並べて出る。これから作る HELL は書かない(新しい式の値が出る)
  sheriruth_hell_debug:Object.freeze({HELL:61}),
  grievous_lady_hell:Object.freeze({MASTER:69}),
  kaze_ga_soyogu_hell_debug:Object.freeze({HELL:22}),
  // Against My Own Shadow の HELL は新しい式で測った値(社長の体感42)。公開したので表示を固定する(2026-10-13)
  against_my_own_shadow_hell_debug:Object.freeze({HELL:51}),
  sheriruth_proto:Object.freeze({MASTER:47}),
  // 2026-10-20 社長「この曲のヘルは難易度57はある」「ローズとさっどそんぐも変えといて」: 新しい測り方(v2)の値を表示にする(譜面は1音も変えない)。
  // 前の測り方では Toward 46・ROSE 45・ROSE short 44・SAD SONG 34・SAD SONG short 35。ほかの公開中の HELL は前の値のまま
  // 2026-10-20 夕方 社長の決定(改善部の指摘 L1): 残りの公開中の HELL 4曲(上の Sheriruth・Grievous Lady・風がそよぐ場所・AMOS)も v2 の値にそろえた。
  //   前の値 Sheriruth 54・Grievous Lady 60・風がそよぐ場所 23・AMOS 42 → 61・69・22・51(風がそよぐ場所だけ1下がる)。これで公開中の HELL 9譜面がすべて v2 の値
  toward_the_stars_short_hell_debug:Object.freeze({HELL:57}),
  rose_hell_debug:Object.freeze({HELL:52}),
  rose_short_hell_debug:Object.freeze({HELL:50}),
  sad_song_hell_debug:Object.freeze({HELL:39}),
  sad_song_short_hell_debug:Object.freeze({HELL:43}),
});
// 表示に出す Lv.: 上書き(社長の値)があればそれ、無ければ式の値
const shownLevel=(songId,difficultyId,chart)=>{const o=LEVEL_OVERRIDES[songId];return o&&Number.isFinite(o[difficultyId])?o[difficultyId]:chartLevel(chart,{formula:levelFormulaFor(songId)}).level;};
const songLevels=(song,difficulties)=>{
  const out={};
  let previous=null;
  const overrides=song&&LEVEL_OVERRIDES[song.songId]||null;
  for(const difficulty of difficulties){
    const {level,strain}=chartLevel(song.difficulties[difficulty.id],{formula:levelFormulaFor(song&&song.songId)});
    if(!strain){out[difficulty.id]={level:0,strain:null};continue;}
    let shown=level;
    if(previous&&strain.raw>previous.raw&&shown<=previous.level)shown=Math.min(LEVEL_MAX,previous.level+1);
    // 上書きがあればそれを使う(下の難易度より下がらないようにだけは守る)
    if(overrides&&Number.isFinite(overrides[difficulty.id]))shown=Math.max(overrides[difficulty.id],previous?previous.level+1:LEVEL_MIN);
    out[difficulty.id]={level:shown,strain};
    previous={level:shown,raw:strain.raw};
  }
  return out;
};

// --- ランタイムの曲を読む ---
const loadRuntimeSongs=()=>{
  const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
  // Date を渡すのは、時刻で入れ替わる譜面(RHYTHM_SWITCHING_CHARTS)を測るため。
  // __MH_RHYTHM_CHART_SWITCH=after を付けて走らせると、切り替え後の姿でレベルを測れる。
  const context={Object,Number,Math,JSON,Array,String,Date,
    __MH_RHYTHM_CHART_SWITCH:process.env.__MH_RHYTHM_CHART_SWITCH||null};
  vm.runInNewContext(`${source}\nthis.out={RHYTHM_SONGS,RHYTHM_DIFFICULTIES,RHYTHM_DEMO_SONG_IDS,
    RHYTHM_PLAY_DIFFICULTIES:typeof RHYTHM_PLAY_DIFFICULTIES!=='undefined'?RHYTHM_PLAY_DIFFICULTIES:RHYTHM_DIFFICULTIES,
    RHYTHM_PROTO_SONGS:typeof RHYTHM_PROTO_SONGS!=='undefined'?RHYTHM_PROTO_SONGS:[]};`,context);
  // HELL(6段目)も測る。譜面の無い曲は chartStrain が null を返して表に載らない
  context.out.RHYTHM_DIFFICULTIES=context.out.RHYTHM_PLAY_DIFFICULTIES;
  return context.out;
};

// --- ランタイムのレベル表を作り直す ---
// 書き換えるのは <rhythm-chart-levels> マーカーの内側だけ。譜面には触らない。
const RUNTIME_FILE='monster-hero/data/rhythm-mode.js';
const writeRuntimeLevels=()=>{
  const {RHYTHM_SONGS,RHYTHM_DIFFICULTIES}=loadRuntimeSongs();
  const lines=[];
  for(const song of RHYTHM_SONGS){
    const cells=[];
    const levels=songLevels(song,RHYTHM_DIFFICULTIES);
    for(const difficulty of RHYTHM_DIFFICULTIES){
      const {level}=levels[difficulty.id];
      if(level>0)cells.push(`${difficulty.id}:${level}`);
    }
    // 曲idがそのままJSの名前として書けるとはかぎらない(数字で始まる「4u_hitasura」など)。
    // 引用符なしで書くと構文エラーになり、書き出した直後に読めなくなる(2026-09-06)。
    const key=/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(song.songId)?song.songId:`'${song.songId}'`;
    if(cells.length)lines.push(`  ${key}:Object.freeze({${cells.join(',')}}),`);
  }
  const file=path.join(ROOT,RUNTIME_FILE);
  const source=fs.readFileSync(file,'utf8');
  const begin='// <rhythm-chart-levels>',end='// </rhythm-chart-levels>';
  const from=source.indexOf(begin),to=source.indexOf(end);
  if(from<0||to<from)throw new Error(`${RUNTIME_FILE} に ${begin} … ${end} がありません`);
  const before=source.slice(0,from+begin.length),after=source.slice(to);
  const next=`${before}\n${lines.join('\n')}\n${after}`;
  // マーカーの外は1バイトも変えていないことを確かめる
  if(source.slice(0,from)!==next.slice(0,from)||source.slice(to)!==next.slice(next.indexOf(end))){
    throw new Error('マーカーの外を書き換えようとしました');
  }
  fs.writeFileSync(file,next);
  return lines.length;
};

module.exports={levelFormulaFor,LEVEL_V1_SONGS,WORK_V2,SKY_MIX_FACTOR,SAME_SIDE_HELD,chartLevel,chartStrain,songLevels,levelFromRaw,loadRuntimeSongs,writeRuntimeLevels,LEVEL_MIN_NOTES,LEVEL_OVERRIDES,
  LEVEL_ANCHOR,LEVEL_SCALE,LEVEL_GAMMA,LEVEL_MIN,LEVEL_MAX,WORK,SKY_LEVEL_FACTOR,chartHasSky,LEVEL_OVERRIDES,shownLevel};

if(require.main===module){
  const verbose=process.argv.includes('--verbose');
  const calibrate=process.argv.includes('--calibrate');
  if(process.argv.includes('--write')){
    const count=writeRuntimeLevels();
    console.log(`レベル表を書き換えました: ${RUNTIME_FILE}（${count}曲）`);
    console.log('※ この後は node tools/build.js を実行してください');
  }
  const {RHYTHM_SONGS,RHYTHM_DIFFICULTIES}=loadRuntimeSongs();
  if(calibrate){
    const song=RHYTHM_SONGS.find(entry=>entry.songId===LEVEL_ANCHOR.songId);
    const strain=chartStrain(song.difficulties[LEVEL_ANCHOR.difficulty]);
    // Lv = SCALE * raw^GAMMA / 10 が LEVEL_ANCHOR.level になる SCALE
    const scale=LEVEL_ANCHOR.level*10/Math.pow(strain.raw,LEVEL_GAMMA);
    console.log(`基準: ${LEVEL_ANCHOR.songId} ${LEVEL_ANCHOR.difficulty} = Lv.${LEVEL_ANCHOR.level}`);
    console.log(`  生の値 ${strain.raw} / ピーク ${strain.peak} / 平均 ${strain.average}`);
    console.log(`  LEVEL_SCALE=${Math.round(scale*10000)/10000}  (いまは ${LEVEL_SCALE})`);
    console.log('  ※ 物差しは固定の運用(2026-09-27)。取り直すと全曲のレベルが動くので、書き換える前にユーザーに確かめる');
    process.exit(0);
  }
  for(const song of RHYTHM_SONGS){
    const levels=songLevels(song,RHYTHM_DIFFICULTIES);
    const cells=RHYTHM_DIFFICULTIES.map(difficulty=>{
      const {level,strain}=levels[difficulty.id];
      if(!strain)return `${difficulty.id.slice(0,2)} —`;
      return `${difficulty.id.slice(0,2)} Lv.${String(level).padStart(2)}`;
    });
    console.log(`${song.displayName.padEnd(30)} ${cells.join(' / ')}`);
    if(verbose){
      for(const difficulty of RHYTHM_DIFFICULTIES){
        const {level,strain}=levels[difficulty.id];
        if(!strain)continue;
        console.log(`    ${difficulty.id.padEnd(6)} Lv.${String(level).padStart(2)}`
          +`  生${String(strain.raw).padEnd(6)} ピーク${String(strain.peak).padEnd(6)} 平均${String(strain.average).padEnd(6)}`
          +`  ${strain.notes}ノーツ/${strain.seconds}秒 (毎秒${strain.notesPerSecond})`
          +`  細${strain.parts.thin} 同時${strain.parts.chord} 押しながら${strain.parts.held} フリック${strain.parts.flick}`
          +(strain.parts.skySwitch?`  空中⇄地上${strain.parts.skySwitch}`:'')
          +(strain.parts.sameHandFast?`  同じ側の速い連打${strain.parts.sameHandFast}`:''));
      }
    }
  }
}
