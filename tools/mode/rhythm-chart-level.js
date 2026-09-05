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
const LEVEL_SCALE=24.9087;
// レベルは仕事量に**そのまま比例**させる（曲がりを付けない）。
// こうしておくと「Lv.が2倍なら忙しさも2倍」と説明でき、
// 曲が増えても物差しがぶれない。上限は先の曲のために広く取っておく。
const LEVEL_GAMMA=1;
const LEVEL_MIN=1,LEVEL_MAX=50;

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
});

const clamp=(value,lo,hi)=>Math.max(lo,Math.min(hi,value));
const round=(value,digits=3)=>Math.round(value*10**digits)/10**digits;

// --- 1ノーツぶんの仕事量 ---
const noteWork=(note,previous,context)=>{
  const timeMs=Number(note.timeMs)||0;
  let work=1;
  // 1. 詰まり具合
  if(previous){
    const gap=Math.max(1,timeMs-(Number(previous.timeMs)||0));
    if(gap<HAND_MODEL.restrikeComfortMs){
      work*=1+WORK.gapBoostMax*(HAND_MODEL.restrikeComfortMs-gap)/HAND_MODEL.restrikeComfortMs;
    }
    // 2. 横の移動（触る点どうしの距離を時間で割る）
    const laneSpeed=Math.abs(noteTouchLane(note)-noteTouchLane(previous))/(gap/1000);
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
      if(deltaMs>0)fastest=Math.max(fastest,Math.abs(delta)/(deltaMs/1000));
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
const chartStrain=chart=>{
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
  const works=[];
  let previous=null;
  const parts={gap:0,lane:0,thin:0,chord:0,chordChain:0,flick:0,held:0,cross:0,slide:0};
  for(const note of notes){
    const timeMs=Number(note.timeMs)||0;
    const chordGapLanes=chordGapOf(note);
    const held=sustains.some(span=>span.startMs<timeMs-1&&timeMs<span.endMs);
    const chordChain=chordGapLanes!=null&&chainedChord(timeMs);
    const cross=held&&crossOf(note,timeMs);
    const work=noteWork(note,previous,{chordGapLanes,held,chordChain,cross});
    works.push({timeMs,work});
    if(chordGapLanes!=null)parts.chord++;
    if(chordChain)parts.chordChain++;
    if(cross)parts.cross++;
    if(held)parts.held++;
    if(note.type==='FLICK')parts.flick++;
    if((Number(note.subLaneWidth)||2)<=2)parts.thin++;
    previous=note;
  }
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

const chartLevel=chart=>{
  const strain=chartStrain(chart);
  if(!strain)return {level:0,strain:null};
  return {level:levelFromRaw(strain.raw),strain};
};

// --- ランタイムの曲を読む ---
const loadRuntimeSongs=()=>{
  const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
  const context={Object,Number,Math,JSON,Array,String};
  vm.runInNewContext(`${source}\nthis.out={RHYTHM_SONGS,RHYTHM_DIFFICULTIES,RHYTHM_DEMO_SONG_IDS};`,context);
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
    for(const difficulty of RHYTHM_DIFFICULTIES){
      const {level}=chartLevel(song.difficulties[difficulty.id]);
      if(level>0)cells.push(`${difficulty.id}:${level}`);
    }
    if(cells.length)lines.push(`  ${song.songId}:Object.freeze({${cells.join(',')}}),`);
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

module.exports={chartLevel,chartStrain,levelFromRaw,loadRuntimeSongs,writeRuntimeLevels,LEVEL_MIN_NOTES,
  LEVEL_ANCHOR,LEVEL_SCALE,LEVEL_GAMMA,LEVEL_MIN,LEVEL_MAX,WORK};

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
    process.exit(0);
  }
  for(const song of RHYTHM_SONGS){
    const cells=RHYTHM_DIFFICULTIES.map(difficulty=>{
      const chart=song.difficulties[difficulty.id];
      const {level,strain}=chartLevel(chart);
      if(!strain)return `${difficulty.id.slice(0,2)} —`;
      return `${difficulty.id.slice(0,2)} Lv.${String(level).padStart(2)}`;
    });
    console.log(`${song.displayName.padEnd(30)} ${cells.join(' / ')}`);
    if(verbose){
      for(const difficulty of RHYTHM_DIFFICULTIES){
        const {level,strain}=chartLevel(song.difficulties[difficulty.id]);
        if(!strain)continue;
        console.log(`    ${difficulty.id.padEnd(6)} Lv.${String(level).padStart(2)}`
          +`  生${String(strain.raw).padEnd(6)} ピーク${String(strain.peak).padEnd(6)} 平均${String(strain.average).padEnd(6)}`
          +`  ${strain.notes}ノーツ/${strain.seconds}秒 (毎秒${strain.notesPerSecond})`
          +`  細${strain.parts.thin} 同時${strain.parts.chord} 押しながら${strain.parts.held} フリック${strain.parts.flick}`);
      }
    }
  }
}
