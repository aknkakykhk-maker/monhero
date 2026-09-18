#!/usr/bin/env node
// 終点フリックを「弾いた動きと、経路を追った動きが見分けられる場所」にだけ置いているかを見る。
//
//   node tools/mode/rhythm-end-flick-swing-check.js
//   node tools/mode/rhythm-end-flick-swing-check.js --list   # 対象を全部出す
//
// 【なぜ要るか】(2026-09-18・ユーザーから動画で「ここのスライドフリックのとこが失敗になる」)
//   終点フリックは「基準の位置から24px(RHYTHM_FLICK_DISTANCE_PX)動いたら弾いた」と見る。
//   ところが斜めやジグザグのSLIDEでは、指は経路を追って動き続けるしかない。
//   人の追従はどうしても遅れる(動画の症状は遅れ80msで再現した)ので、
//   受付のあいだに経路そのものが24pxより大きく動く区間では、
//     ・経路ぶんを引いた距離(＝遅れぶん)
//     ・指そのものの移動
//   の両方が大きくなり、**弾いていないのに弾いたことになる**。
//   実装側は「そういう区間では早く確定させない」ようにして BAD を止めたが、
//   それは見分けられないことを認めた上での安全側の措置で、
//   **そもそも見分けられない場所へ終点フリックを置かない**のが本筋。
//
//   実物: pandora_boss_remix の MASTER 13.44〜14.92s。受付250msのあいだに
//   経路が 0.694 → 2.414 → 1.500 レーン(＝115px。フリック距離の約4.8倍)も振れていた。
//
// 【測り方】
//   受付(終端の RHYTHM_END_FLICK_ARM_MS 前)のあいだの各時刻で、
//   「直近 RHYTHM_END_FLICK_TRUST_BACK_MS に経路が横へどれだけ振れたか」を測り、
//   その最大がフリック距離以上なら見分けられない＝NG。実装側の見送り条件と同じ物差し。
//   画面の横幅は 390px(よくある携帯の幅)を基準にする。広い画面ほど1レーンが広く、
//   同じ譜面でも px の振れは大きくなるので、ここが通れば広い画面でも成り立つ。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const RUNTIME=path.join(ROOT,'monster-hero/data/rhythm-mode.js');
const EVENTS=path.join(ROOT,'monster-hero/data/rhythm-event.js');
const REFERENCE_WIDTH=390;

const load=()=>{
  const source=fs.readFileSync(RUNTIME,'utf8');
  const context={console};
  vm.createContext(context);
  vm.runInContext(`${source}\nglobalThis.__x={RHYTHM_SONGS,RHYTHM_DIFFICULTIES,rhythmSlideExpectedLane,`
    +`rhythmProjectBoundary,RHYTHM_JUDGMENT_LINE_Y,RHYTHM_LANE_COUNT,RHYTHM_FLICK_DISTANCE_PX,`
    +`RHYTHM_END_FLICK_ARM_MS,RHYTHM_END_FLICK_TRUST_BACK_MS,RHYTHM_END_FLICK_TRUST_STEPS};`,context);
  return context.__x;
};

// 開催中(まだ終わっていない)イベントの対象曲。CLAUDE.md ⑥-4「イベント対象曲の譜面は
// 開催中に触らない」があるので、見つけても直せない。**保留**として分けて出し、
// イベントが終わったらNGになる(直し忘れがそのまま残らないように)。
const eventHeldSongs=nowMs=>{
  const held=new Map();
  try{
    const context={console};
    vm.createContext(context);
    vm.runInContext(`${fs.readFileSync(EVENTS,'utf8')}\nglobalThis.__e=RHYTHM_EVENTS;`,context);
    for(const event of context.__e||[]){
      if(!event||event.kind!=='limited'||!Array.isArray(event.songIds))continue;
      const endMs=Date.parse(event.endAt);
      if(!Number.isFinite(endMs)||endMs<=nowMs)continue;
      for(const id of event.songIds)held.set(id,event);
    }
  }catch(e){
    console.log(`  (イベントの一覧が読めませんでした: ${e.message})`);
  }
  return held;
};

// 1レーンぶんの横幅(px)。判定ラインの高さで測る(実装の trackingLaneWidthPx と同じ)。
const laneWidthPx=rt=>{
  const yRatio=rt.RHYTHM_JUDGMENT_LINE_Y.ratio;
  const left=rt.rhythmProjectBoundary(0,yRatio),right=rt.rhythmProjectBoundary(rt.RHYTHM_LANE_COUNT,yRatio);
  return (right-left)/rt.RHYTHM_LANE_COUNT*REFERENCE_WIDTH;
};

// 受付のあいだの「直近 BACK_MS の経路の振れ」の最大(px)。
const peakSwingPx=(rt,note,width)=>{
  const back=rt.RHYTHM_END_FLICK_TRUST_BACK_MS,steps=rt.RHYTHM_END_FLICK_TRUST_STEPS;
  const end=Number(note.endTimeMs??note.timeMs);
  let peak=0,peakAt=end;
  for(let t=end-rt.RHYTHM_END_FLICK_ARM_MS;t<=end;t+=10){
    let min=Infinity,max=-Infinity;
    for(let i=0;i<=steps;i++){
      const lane=Number(rt.rhythmSlideExpectedLane(note,t-back*(1-i/steps)));
      if(!Number.isFinite(lane))continue;
      if(lane<min)min=lane;
      if(lane>max)max=lane;
    }
    const swing=max>=min?(max-min)*width:0;
    if(swing>peak){peak=swing;peakAt=t;}
  }
  return {peak,peakAt};
};

// 譜面ぜんぶを測って、見分けられない終点フリックを返す。fix ツールも同じ物差しを使う。
const swingReport=(nowMs=Date.now())=>{
  const rt=load();
  const width=laneWidthPx(rt);
  const held=eventHeldSongs(nowMs);
  const rows=[];
  for(const song of rt.RHYTHM_SONGS){
    const difficulties=song.difficulties||{};
    for(const {id} of rt.RHYTHM_DIFFICULTIES){
      const chart=difficulties[id];
      if(!chart||!Array.isArray(chart.notes))continue;
      for(const note of chart.notes){
        if(note.endFlick!==true)continue;
        if((note._rhythmOriginalType||note.type)!=='SLIDE')continue;
        const {peak,peakAt}=peakSwingPx(rt,note,width);
        rows.push({songId:song.songId,displayName:song.displayName,difficulty:id,
          timeMs:Number(note.timeMs),endTimeMs:Number(note.endTimeMs??note.timeMs),
          peakPx:peak,peakAtMs:peakAt,
          over:peak>=rt.RHYTHM_FLICK_DISTANCE_PX,
          heldByEvent:held.has(song.songId),eventId:held.get(song.songId)?.id||null});
      }
    }
  }
  return {rows,width,limitPx:rt.RHYTHM_FLICK_DISTANCE_PX,
    armMs:rt.RHYTHM_END_FLICK_ARM_MS,backMs:rt.RHYTHM_END_FLICK_TRUST_BACK_MS};
};

if(require.main===module){
  const listAll=process.argv.includes('--list');
  const report=swingReport();
  const over=report.rows.filter(r=>r.over);
  const ng=over.filter(r=>!r.heldByEvent);
  const holdOn=over.filter(r=>r.heldByEvent);
  const line=r=>`  ${r.songId} ${r.difficulty} ${(r.endTimeMs/1000).toFixed(2)}s`
    +` — 直近${report.backMs}msで${r.peakPx.toFixed(0)}px振れる(上限${report.limitPx}px)`;
  console.log(`終点フリック付きSLIDE ${report.rows.length}本 / 1レーン=${report.width.toFixed(1)}px(幅${REFERENCE_WIDTH}pxの画面)`);
  if(listAll)for(const r of report.rows.slice().sort((a,b)=>b.peakPx-a.peakPx))console.log(line(r));
  if(holdOn.length){
    console.log(`\n保留: ${holdOn.length}本 — イベント開催中の曲なので、いまは直せません(CLAUDE.md ⑥-4)。`);
    for(const r of holdOn)console.log(`${line(r)} [${r.eventId}]`);
    console.log('  イベントが終わったら node tools/mode/rhythm-end-flick-swing-fix.js --write で直す。');
  }
  if(ng.length){
    console.error(`\nNG: 見分けられない場所に終点フリックが ${ng.length}本あります。`);
    for(const r of ng)console.error(line(r));
    console.error('  node tools/mode/rhythm-end-flick-swing-fix.js --write で終点フリックを外せます。');
    process.exit(1);
  }
  console.log(`\nOK: 見分けられない終点フリックはありません${holdOn.length?`(保留${holdOn.length}本を除く)`:''}`);
}

module.exports={swingReport,peakSwingPx,laneWidthPx,load,REFERENCE_WIDTH};
