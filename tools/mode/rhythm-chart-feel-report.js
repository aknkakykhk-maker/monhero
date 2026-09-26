#!/usr/bin/env node
// 遊んだときの「気持ちよさ」に近いものを、区間(8秒)ごとに測る物差し(2026-09-26・段0)。
//
//   node tools/mode/rhythm-chart-feel-report.js --track <曲id>                  # 1曲・全難易度(自動修正後)
//   node tools/mode/rhythm-chart-feel-report.js --track <曲id> --difficulty MASTER
//   node tools/mode/rhythm-chart-feel-report.js --track <曲id> --source v3       # 自動修正前
//   node tools/mode/rhythm-chart-feel-report.js --track <曲id> --dir <dir>       # 別の場所に書き出した譜面
//   node tools/mode/rhythm-chart-feel-report.js --all                            # 一覧にある曲を全部(要約だけ)
//   node tools/mode/rhythm-chart-feel-report.js --track <曲id> --json
//
// 【なぜ要るか】
// 品質の6軸(rhythm-chart-quality-report.js)は、全曲で「読める」「飽きない」がほぼ満点に張り付いている。
// ところが遊ぶと「似た配置が続く」「横フリックの向きがバラバラ」と感じる(2026-09-26 のユーザーの感想)。
// 物差しが体験との差を捉えていないと、生成器を直しても良くなったか分からない。
// 設計と段取り: docs/spec/RHYTHM_CHART_ENGINE_ROADMAP.md の段0。
//
// 【測るもの】どれも**出来上がった譜面**と手のシミュレート(rhythm-hand-simulate.js)から測る
//   単調さ(monotony) … 音(リズム)が違うのに、同じ動き(レーンの動きの並び)が直前4小節・8小節に出ている。
//                       形の名前ではなく実際の動きを見る(名前が違っても指の動きが同じなら同じに感じる)。
//                       リズムも同じなら「同じフレーズは同じ形」なので数えない
//   横フリック(sideFlick) … 向きが ①同じ指が次に取るノーツの方向 ②(次が無ければ)同じ指が来た向き ③(どちらも無ければ)
//                       もう片方の指から離れる外向き、と合っているか。もう片方の指へ向かって払うのは「ぶつかる」。
//                       決め方は Rev.8 の生成器と同じ(rhythm-side-flick.js)
//   手の流れ(handFlow) … 1本の指の急な切り返し(1拍以内に1.5レーン以上行って戻る)・
//                       SLIDE の終わりから同じ指の次の打鍵までが快適な速さを超える(荒い着地)
//                       ⚠️ 両手の交差は測らない。手のシミュレートは親指の左右を区別せず近いほうの指で取るので、
//                       指の番号で交差を数えると EASY でも毎分40回と出てしまう(試して分かった)。
//                       左右の区別を手のモデルへ入れるのは段1以降(ROADMAP)
//   忙しさ(strained)   … 手のシミュレートの「忙しい」
//
// 【まだ暫定】区間の「気になり点」の重み(CONCERN_WEIGHTS)は勘で置いた初期値。
// 遊んだ感想(譜面メモ・ユーザーが挙げた気になる区間)と突き合わせて合わせる。
// 合うまでは品質の6軸には入れない(候補選びの結果が変わってしまうため)。
// 判定・スコア・ランタイム・保存データには一切関与しない。
'use strict';
const fs=require('fs');
const path=require('path');
const {HAND_MODEL,noteTouchSpan,setHandModelFlags,slideLaneOffset}=require('./rhythm-hand-model.js');
const {chartRevisionOf,handModelFlagsForRevision}=require('./rhythm-chart-v3-revision.js');
const {sideFlickContexts,chooseSideFlickDir,collides}=require('./rhythm-side-flick.js');
const {simulateNotes}=require('./rhythm-hand-simulate.js');
const {measure:measureQuality}=require('./rhythm-chart-quality-report.js');

const ROOT=path.resolve(__dirname,'..','..');
const authoringDir=path.join(ROOT,'tools/mode/authoring');
const DIFFICULTIES=['EASY','NORMAL','HARD','EXPERT','MASTER'];
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const round=(value,digits=3)=>Number.isFinite(value)?Math.round(value*10**digits)/10**digits:null;
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));

// 譜面メモ(30-rhythm-play.jsx の RHYTHM_CHART_NOTE_SEGMENT_MS)と同じ区切り。感想と区間を突き合わせるため
const SEGMENT_MS=8000;
// 動きの並びを比べる長さ(ノーツ間の動き4つ＝ノーツ5個)。3だと偶然の一致が多すぎ(どの曲も3〜5割)、
// 6だと完全一致がほとんど起きず(どの曲も0〜3%)曲の差が出ない。4で曲ごとの差がはっきり出た(8小節の窓で1〜24%)
const MOTION_GRAM=4;
// 動きの大きさの段(レーン)。0.5未満は「その場」
const motionStep=delta=>{const size=Math.abs(delta);return size<.5?0:size<1.5?1:size<2.5?2:3;};
// 区間の気になり点の重み(暫定。感想と合わせて直す)
const CONCERN_WEIGHTS=Object.freeze({monotony:1,flickOff:3,flickCollide:5,sharpTurn:2,hardLanding:2,strained:1,againstMelody:.5,overlapLook:.5,typeSwitch:.5});
// 見やすさ・頭の負担の窓(ms)
const OVERLAP_LOOK_MS=100,TYPE_SWITCH_MS=250;

const noteCenter=note=>{const [lo,hi]=noteTouchSpan(note);return (lo+hi)/2;};
const slideEndCenter=note=>{
  const points=Array.isArray(note.slidePoints)&&note.slidePoints.length?note.slidePoints:null;
  return points?Number(points[points.length-1].lane)+slideLaneOffset():noteCenter(note);
};

// ============================================================================
// 測る
// ============================================================================
// SLIDE はどの譜面でもゲーム本体と同じ座標で測る(rhythm-hand-model.js の useRuntimeSlideLanes)。
// 測り終えたら元の読み方へ戻す(同じ手のモデルを使うほかの道具の結果を変えないため)
const measureFeel=(chart,audio,options={})=>{
  // SLIDE の座標はどの譜面でもゲーム本体と同じ。曲線と親指の左右は、その譜面のリビジョンの作り方に合わせる(Rev.14〜)
  const previous=setHandModelFlags({...handModelFlagsForRevision(chartRevisionOf(chart)),runtimeSlideLanes:true});
  try{return measureFeelInner(chart,audio,options);}
  finally{setHandModelFlags(previous);}
};
const measureFeelInner=(chart,audio,options={})=>{
  const timing=audio.timing;
  const gridMs=Number.isFinite(Number(timing.gridMs))?Number(timing.gridMs):timing.beatMs/timing.subdivisionsPerBeat;
  const BEAT=timing.subdivisionsPerBeat;
  const BAR=BEAT*(timing.beatsPerBar||4);
  const beatMs=gridMs*BEAT;
  const timeOf=grid=>timing.beatZeroMs+grid*gridMs;
  const notes=chart.notes.slice().sort((a,b)=>a.grid-b.grid||(Number(a.subLane)||0)-(Number(b.subLane)||0));
  // 区間: 既定は8秒ごと(譜面メモと同じ)。options.segmentStartsMs(昇順の開始時刻の並び)を渡すと、その区切りで数える
  //   (区間の差し替え rhythm-chart-v3-splice.js が曲の区切りごとに数えるのに使う)
  const starts=Array.isArray(options.segmentStartsMs)&&options.segmentStartsMs.length?options.segmentStartsMs:null;
  const segmentOf=ms=>{
    if(!starts)return Math.max(0,Math.floor(ms/SEGMENT_MS));
    let lo=0,hi=starts.length-1;
    while(lo<hi){const mid=(lo+hi+1)>>1;if(starts[mid]<=ms)lo=mid;else hi=mid-1;}
    return lo;
  };
  const segments=new Map();
  const segment=ms=>{
    const index=segmentOf(ms);
    if(!segments.has(index))segments.set(index,{index,fromMs:starts?starts[index]:index*SEGMENT_MS,notes:0,monotony:0,flickOff:0,flickCollide:0,sharpTurn:0,hardLanding:0,strained:0,againstMelody:0,overlapLook:0,typeSwitch:0,details:[]});
    return segments.get(index);
  };
  for(const note of notes)segment(timeOf(note.grid)).notes++;

  // --- 手のシミュレート(どの指で取ったか) ---
  const sim=simulateNotes(notes,timing,{beam:options.beam});
  for(const issue of sim.issues)if(issue.severity==='strained')segment(issue.timeMs).strained++;
  // 指ごとの動き(時刻順)。同じ時刻の組は、組の中の割り当てをそのまま使う
  const fingerOf=index=>sim.assignments.has(index)?sim.assignments.get(index):null;
  const hits=notes.map((note,index)=>({note,index,ms:timeOf(note.grid),finger:fingerOf(index),
    lane:noteCenter(note),endLane:note.type==='SLIDE'?slideEndCenter(note):noteCenter(note),
    endMs:note.type==='HOLD'||note.type==='SLIDE'?timeOf(note.grid+(Number(note.durationGrids)||0)):timeOf(note.grid)}));

  // --- 単調さ: 動きの並び(ノーツ間のレーンの動き)が、リズムの違う所で直前4・8小節に出ているか ---
  // 同じ時刻の組は1つにまとめ(真ん中を使う)、主の流れだけを見る
  const flow=[];
  for(const hit of hits){
    const last=flow[flow.length-1];
    if(last&&last.grid===hit.note.grid){last.lanes.push(hit.lane);last.lane=last.lanes.reduce((a,b)=>a+b,0)/last.lanes.length;last.types.add(hit.note.type);continue;}
    flow.push({grid:hit.note.grid,ms:hit.ms,lane:hit.lane,lanes:[hit.lane],types:new Set([hit.note.type])});
  }
  const tokens=[];
  for(let i=1;i<flow.length;i++){
    const delta=flow[i].lane-flow[i-1].lane;
    const kind=[...flow[i].types].filter(type=>type!=='TAP').sort().join('+');
    tokens.push({motion:`${Math.sign(delta)*motionStep(delta)}${kind?`:${kind}`:''}`,gap:flow[i].grid-flow[i-1].grid,grid:flow[i].grid,ms:flow[i].ms});
  }
  const grams=[];
  for(let end=MOTION_GRAM-1;end<tokens.length;end++){
    const part=tokens.slice(end-MOTION_GRAM+1,end+1);
    // 動かない並び(同じ所の連打)は「単調」の数から外す(縦連は形として意図して置くもの)
    if(part.every(token=>token.motion.startsWith('0')))continue;
    grams.push({motion:part.map(token=>token.motion).join(','),rhythm:part.map(token=>token.gap).join(','),
      fromGrid:part[0].grid,grid:part[part.length-1].grid,ms:part[part.length-1].ms});
  }
  const repeatWithin=bars=>{
    let repeated=0;
    const flagged=[];
    for(let i=0;i<grams.length;i++){
      const gram=grams[i];
      // 前の並びは、重ならず(いまの並びの始まりより前に終わる)、bars小節以内に始まったもの
      for(let k=i-1;k>=0;k--){
        const earlier=grams[k];
        if(gram.grid-earlier.grid>bars*BAR)break;
        if(earlier.grid>=gram.fromGrid)continue;
        if(earlier.motion===gram.motion&&earlier.rhythm!==gram.rhythm){repeated++;flagged.push(gram);break;}
      }
    }
    return {rate:grams.length?repeated/grams.length:0,flagged};
  };
  const monotony4=repeatWithin(4),monotony8=repeatWithin(8);
  for(const gram of monotony8.flagged)segment(gram.ms).monotony++;

  // --- 横フリック(向きの決め方は rhythm-side-flick.js と同じ物差しで見る) ---
  const sideFlicks={count:0,natural:0,byNext:0,byIncoming:0,byOutward:0,undecided:0,collide:0,notes:[]};
  for(const context of sideFlickContexts(notes,timing,{beam:options.beam})){
    const note=notes[context.index];
    const dir=note.flickDir==='left'?-1:note.flickDir==='right'?1:0;
    if(!dir)continue;
    sideFlicks.count++;
    const expected=chooseSideFlickDir(context);
    const basis=expected.basis;
    // 決め手になった材料の向きと同じなら自然(材料が何も無い所の向きは問わない)
    const basisDir=basis==='next'?context.toNext:basis==='incoming'?context.incoming:context.outward;
    const ok=basis==='none'||dir===basisDir;
    const collide=collides(context,dir);
    if(basis==='next')sideFlicks.byNext++;else if(basis==='incoming')sideFlicks.byIncoming++;else if(basis==='outward')sideFlicks.byOutward++;else sideFlicks.undecided++;
    if(ok&&!collide)sideFlicks.natural++;
    if(collide)sideFlicks.collide++;
    const seg=segment(context.ms);
    if(!ok){seg.flickOff++;seg.details.push(`${note.flickDir}フリックが${basis==='next'?'同じ指の次のノーツ':basis==='incoming'?'来た向き':'外向き'}と逆`);}
    if(collide){seg.flickCollide++;seg.details.push(`${note.flickDir}フリックがもう片方の指へ向かう`);}
    sideFlicks.notes.push({grid:note.grid,ms:Math.round(context.ms),dir:note.flickDir,basis,ok,collide});
  }

  // --- 手の流れ ---
  const byFinger=new Map();
  for(const hit of hits){if(hit.finger==null)continue;if(!byFinger.has(hit.finger))byFinger.set(hit.finger,[]);byFinger.get(hit.finger).push(hit);}
  let sharpTurns=0,hardLandings=0,slideEnds=0;
  for(const list of byFinger.values()){
    for(let i=2;i<list.length;i++){
      const a=list[i-2],b=list[i-1],c=list[i];
      const out=b.lane-a.endLane,back=c.lane-b.endLane;
      if(Math.abs(out)>=1.5&&Math.abs(back)>=1.5&&Math.sign(out)!==Math.sign(back)&&c.ms-a.ms<=beatMs){
        sharpTurns++;const seg=segment(c.ms);seg.sharpTurn++;seg.details.push('1本の指が1拍以内に大きく行って戻る');
      }
    }
    for(let i=0;i+1<list.length;i++){
      const hit=list[i],next=list[i+1];
      if(hit.note.type!=='SLIDE')continue;
      slideEnds++;
      const gap=next.ms-hit.endMs,distance=Math.abs(next.lane-hit.endLane);
      if(gap>beatMs)continue;
      const comfortMs=Math.max(HAND_MODEL.restrikeComfortMs,distance/HAND_MODEL.laneSpeedComfort*1000);
      if(gap<comfortMs){hardLandings++;const seg=segment(next.ms);seg.hardLanding++;seg.details.push('SLIDEの終わりから次の打鍵までが急');}
    }
  }

  // --- 次を予想しやすいか・見やすさ・頭の負担(2026-09-26・最初にもらった案の6) ---
  //   旋律と逆向きの動き: 前のノーツから旋律が上がった(下がった)のに、左(右)へ1レーン以上動く。
  //     「音の高さが上がれば右へ」は形の語彙の約束ごと(3.2)で、逆に動くと次を予想しにくい
  //   重なって見える: 0.1秒以内に続く2つのノーツ(同時押しの相方どうしは除く)が横に重なっている
  //   種類の切り替わり: 0.25秒以内に続くノーツで種類(TAP / FLICK / HOLD / SLIDE)が変わる
  const heightAt=(()=>{const map=new Map((audio.pitchCurve||[]).filter(p=>Number(p.clarity)>=.5&&Number(p.hz)>0).map(p=>[p.grid,Number(p.height)]));return grid=>map.has(grid)?map.get(grid):null;})();
  let againstMelody=0,melodyMoves=0,overlapLook=0,typeSwitch=0;
  for(let i=1;i<flow.length;i++){
    const a=flow[i-1],b=flow[i],ha=heightAt(a.grid),hb=heightAt(b.grid);
    if(ha==null||hb==null||Math.abs(hb-ha)<.08||Math.abs(b.lane-a.lane)<1)continue;
    melodyMoves++;
    if(Math.sign(hb-ha)!==Math.sign(b.lane-a.lane)){againstMelody++;segment(b.ms).againstMelody++;}
  }
  const main=hits.filter(hit=>!hit.note.chord);
  for(let i=1;i<main.length;i++){
    const a=main[i-1],b=main[i],gap=b.ms-a.ms;
    if(gap<=0)continue;
    if(gap<=OVERLAP_LOOK_MS){
      const [alo,ahi]=noteTouchSpan(a.note),[blo,bhi]=noteTouchSpan(b.note);
      if(Math.min(ahi,bhi)-Math.max(alo,blo)>0){overlapLook++;const seg=segment(b.ms);seg.overlapLook++;seg.details.push('続くノーツが重なって見える');}
    }
    if(gap<=TYPE_SWITCH_MS&&a.note.type!==b.note.type){typeSwitch++;segment(b.ms).typeSwitch++;}
  }

  // --- 区間の気になり点 ---
  const list=[...segments.values()].sort((a,b)=>a.index-b.index).map(seg=>{
    const raw=Object.entries(CONCERN_WEIGHTS).reduce((sum,[key,weight])=>sum+weight*(seg[key]||0),0);
    // ノーツの多い区間ほど数が増えるので、10ノーツあたりに均す
    const concern=seg.notes?raw/Math.max(1,seg.notes/10):0;
    const details=[...new Set(seg.details)];
    return {...seg,concern:round(concern,2),details};
  });
  const minutes=Math.max(1/60,(timeOf(notes[notes.length-1]?.grid||0)-timeOf(notes[0]?.grid||0))/60000);
  const quality=options.withQuality===false?null:measureQuality(chart,audio,{beam:options.beam});
  return {
    difficulty:chart.difficulty,noteCount:notes.length,
    monotony:{gram:MOTION_GRAM,grams:grams.length,repeat4:round(monotony4.rate),repeat8:round(monotony8.rate)},
    sideFlick:{count:sideFlicks.count,naturalRate:sideFlicks.count?round(sideFlicks.natural/sideFlicks.count):null,
      collide:sideFlicks.collide,basis:{next:sideFlicks.byNext,incoming:sideFlicks.byIncoming,outward:sideFlicks.byOutward,undecided:sideFlicks.undecided},
      notes:sideFlicks.notes},
    readability:{againstMelodyRate:melodyMoves?round(againstMelody/melodyMoves):null,melodyMoves,
      overlapLookPerMinute:round(overlapLook/minutes,2),typeSwitchPerMinute:round(typeSwitch/minutes,2)},
    handFlow:{sharpTurnsPerMinute:round(sharpTurns/minutes,2),
      hardLandings,slideEnds,hardLandingRate:slideEnds?round(hardLandings/slideEnds):null},
    strained:sim.strained,impossible:sim.impossible,
    intensityDensityAgreement:quality?quality.musicality?.intensityDensityAgreement??null:null,
    segments:list,
    worst:list.filter(seg=>seg.concern>0).sort((a,b)=>b.concern-a.concern||a.index-b.index).slice(0,5),
  };
};

// ============================================================================
// 読み込みと表示
// ============================================================================
const chartFileFor=(dir,dashed,source,difficulty)=>path.join(dir,`${dashed}-v3-${source==='v3'?'chart':'fixed'}-${difficulty.toLowerCase()}.json`);
const feelReportFor=(trackId,{source='v3fixed',dir=null,difficulty=null,beam}={})=>{
  const dashed=trackId.replace(/_/g,'-');
  const audioFile=path.join(authoringDir,`${dashed}-v3-audio.json`);
  if(!fs.existsSync(audioFile))return null;
  const audio=readJson(audioFile);
  const out={trackId,source,difficulties:{}};
  for(const diff of difficulty?[difficulty]:DIFFICULTIES){
    const file=chartFileFor(dir||authoringDir,dashed,source,diff);
    if(!fs.existsSync(file))continue;
    out.difficulties[diff]=measureFeel(readJson(file),audio,{beam});
  }
  return Object.keys(out.difficulties).length?out:null;
};

const clock=ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
const pct=value=>value==null?'—':`${Math.round(value*100)}%`;
const printReport=(report,{summaryOnly=false}={})=>{
  console.log(`\n■ ${report.trackId}（${report.source}）`);
  console.log('  難易度  ノーツ  単調(4小節) 単調(8小節) 横フリック自然 ぶつかる 切り返し/分 荒い着地 忙しい 盛り上がり一致');
  for(const [difficulty,m] of Object.entries(report.difficulties)){
    console.log('  '+[difficulty.padEnd(7),String(m.noteCount).padEnd(7),pct(m.monotony.repeat4).padEnd(11),pct(m.monotony.repeat8).padEnd(11),
      (m.sideFlick.count?`${pct(m.sideFlick.naturalRate)}(${m.sideFlick.count}本)`:'—').padEnd(14),String(m.sideFlick.collide).padEnd(8),
      String(m.handFlow.sharpTurnsPerMinute).padEnd(11),
      (m.handFlow.slideEnds?`${m.handFlow.hardLandings}/${m.handFlow.slideEnds}`:'—').padEnd(8),String(m.strained).padEnd(6),
      m.intensityDensityAgreement==null?'—':String(m.intensityDensityAgreement)].join(' '));
  }
  if(summaryOnly)return;
  for(const [difficulty,m] of Object.entries(report.difficulties)){
    if(!m.worst.length)continue;
    console.log(`  ${difficulty} の気になる区間(暫定の重み・上位${m.worst.length})`);
    for(const seg of m.worst){
      const counts=Object.keys(CONCERN_WEIGHTS).filter(key=>seg[key]).map(key=>`${({monotony:'単調',againstMelody:'旋律と逆',overlapLook:'重なり',typeSwitch:'種類の切替',flickOff:'向き',flickCollide:'ぶつかる',sharpTurn:'切り返し',hardLanding:'着地',strained:'忙しい'})[key]}${seg[key]}`).join(' ');
      console.log(`    ${clock(seg.fromMs)}〜${clock(seg.fromMs+SEGMENT_MS)}  点${seg.concern}  ${counts}${seg.details.length?`  （${seg.details.slice(0,3).join('／')}）`:''}`);
    }
  }
};

const registryTracks=()=>{
  const file=path.join(authoringDir,'rhythm-song-registry.json');
  return fs.existsSync(file)?Object.keys(readJson(file).songs||{}):[];
};

module.exports={measureFeel,feelReportFor,SEGMENT_MS,MOTION_GRAM,CONCERN_WEIGHTS};

if(require.main===module){
  const source=arg('--source','v3fixed'),dir=arg('--dir'),difficulty=arg('--difficulty');
  const json=process.argv.includes('--json');
  const tracks=process.argv.includes('--all')?registryTracks():[arg('--track')].filter(Boolean);
  if(!tracks.length){console.error('--track <曲id> か --all を指定してください');process.exit(2);}
  const reports=tracks.map(trackId=>feelReportFor(trackId,{source,dir,difficulty})).filter(Boolean);
  if(json){console.log(JSON.stringify(reports.length===1?reports[0]:reports,null,1));process.exit(0);}
  for(const report of reports)printReport(report,{summaryOnly:tracks.length>1});
}
