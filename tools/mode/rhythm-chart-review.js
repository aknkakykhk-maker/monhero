#!/usr/bin/env node
// 譜面の点検(人の目の代わりに、数字と一覧と止め絵で問題を出す)。2026-11-11 フメン。社長「最新モデルで譜面制作ツールを強化したい」。
//
//   node tools/mode/rhythm-chart-review.js --track <曲>                       # 作った譜面(authoring の自動修正後)を点検
//   node tools/mode/rhythm-chart-review.js --track <曲> --dir <場所>          # 別の場所へ書き出した譜面を点検(--source v3 で自動修正前)
//   node tools/mode/rhythm-chart-review.js --released <songId>                # 公開中の譜面を点検(読むだけ。HELL も)
//   node tools/mode/rhythm-chart-review.js --track <曲> --before <場所A> --after <場所B>   # 2つの書き出しを比べる(強化の前後)
//   node tools/mode/rhythm-chart-review.js … --picture <フォルダ>             # 止め絵(SVG と PNG)を書き出す。比べるときは左右に並べる
//   node tools/mode/rhythm-chart-review.js … --difficulty EXPERT,MASTER --top 12 --json
//   node tools/mode/rhythm-chart-review.js --calibrate                        # 公開中の全譜面から「帯」を作り直す(authoring/chart-review-bands.json)
//
// 【なぜ要るか】新曲のたびに、人(社長・ビート部)が遊んで「交差がいやらしい」「静かな所が重い」「EXPERT と MASTER の差が無い」と
//   気づいてから直していた。気づく前に、作った時点で数字と場所で出す。道具は読むだけで、譜面もゲームのデータも書き換えない。
//
// 【見るもの】どれも「ゲームが読む形のノーツ」(時刻は ms)から測る。作った譜面も公開中の譜面も同じ物差し。
//   量       … ノーツ数・毎秒・最密4秒・最短間隔・Lv.(rhythm-chart-level.js と同じ式)
//   手       … 横持ちの親指2本(rhythm-ref-tiers.js の thumbCheck)の 押せない・交差・届きにくい・忙しい
//   流れ     … 速い続き(半拍以内)の 流れの割合・跳び・同じ所の連打・片手だけで続く長さ
//   盛り上がり… 曲の盛り上がり(解析の小節ごとの intensity)とノーツの密度の合い方(順位の相関)。逆になっている区切りを出す
//   息つぎ   … 1拍以上の休みが無いまま続く長さ
//   形       … 押さえている帯の中のノーツ・スライドの太さの飛び・モンスターノーツの数
//   段の差   … となりの難易度とのノーツ数・最密4秒の比(差が無い/飛びすぎ)
// 【帯】「多い/少ない」は決め打ちの数字ではなく、公開中の譜面の同じ難易度の 5%〜95% の幅(帯)と比べる。帯の外は「※帯の外」と出す。
//   帯は --calibrate で作り直す(曲が増えたら打つ)。帯の外=悪いではない。曲に合った狙いなら理由を残して進めてよい。
'use strict';
const fs=require('fs'),path=require('path');
const {thumbCheck,THUMB_PROFILES,fromRuntime}=require('./rhythm-ref-tiers.js');
const {chartLevel,loadRuntimeSongs,levelFormulaFor}=require('./rhythm-chart-level.js');
const {tempoWarpForChart}=require('./rhythm-chart-tempo-warp.js');
const HR=require('./rhythm-chart-hand-rules.js');
const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');

const AUTHORING=path.join(__dirname,'authoring');
const BANDS_FILE=path.join(AUTHORING,'chart-review-bands.json');
const DIFFS=['EASY','NORMAL','HARD','EXPERT','MASTER','HELL'];
const LANES=6,CENTER=3,FAST_BEAT=.5,JUMP_LANES=1.6;
const round=(v,d=2)=>Number.isFinite(v)?Math.round(v*10**d)/10**d:null;
const dashedOf=track=>String(track).replace(/_/g,'-');

// ── 読む ─────────────────────────────────────────────────────────────
// 音の層の解析(あれば・いまの解析ファイルに合うものだけ)。サビ見つけが歌の帯を読むのに使う
const readLayers=track=>{try{const a=path.join(AUTHORING,`${dashedOf(track)}-v3-audio.json`),d=JSON.parse(fs.readFileSync(path.join(AUTHORING,`${dashedOf(track)}-v3-layers.json`),'utf8'));
  return d.basedOn&&d.basedOn.sha256===require('crypto').createHash('sha256').update(fs.readFileSync(a)).digest('hex')?d:null;}catch(e){return null;}};
const readAudio=track=>{const f=path.join(AUTHORING,`${dashedOf(track)}-v3-audio.json`);return fs.existsSync(f)?JSON.parse(fs.readFileSync(f,'utf8')):null;};
// 作った譜面(格子)を、ゲームが読む形(ms)へ。書き出しの道(rhythm-chart-v3-pipeline.js の runtimeRow)と同じ時刻の出し方
const toRuntimeChart=(chart,audio)=>{
  const t=audio.timing,gridMs=t.gridMs||t.beatMs/t.subdivisionsPerBeat,warp=tempoWarpForChart(chart,audio);
  const T=g=>Math.round(t.beatZeroMs+g*gridMs+warp.at(g));
  const conv=n=>{
    if(n.type==='SLIDE'){const pts=n.slidePoints.map(p=>({timeMs:T(p.grid),lane:p.lane,subLaneWidth:p.subLaneWidth??2,...(p.ease?{ease:p.ease}:{})}));
      return {type:'SLIDE',timeMs:T(n.grid),endTimeMs:T(n.grid+n.durationGrids),lane:pts[0].lane,endLane:pts[pts.length-1].lane,subLaneWidth:pts[0].subLaneWidth,slidePoints:pts,...(n.endFlick?{endFlick:true}:{})};}
    if(n.type==='HOLD')return {type:'HOLD',timeMs:T(n.grid),endTimeMs:T(n.grid+n.durationGrids),lane:Math.floor(n.subLane/2),subLane:n.subLane,subLaneWidth:n.subLaneWidth,...(n.endFlick?{endFlick:true}:{})};
    if(n.type==='FLICK')return {type:'FLICK',timeMs:T(n.grid),lane:Math.floor(n.subLane/2),subLane:n.subLane,subLaneWidth:n.subLaneWidth,...(n.flickDir?{flickDir:n.flickDir}:{})};
    return {type:'TAP',timeMs:T(n.grid),lane:Math.floor(n.subLane/2),subLane:n.subLane,subLaneWidth:n.subLaneWidth,...(n.monsterSlot?{monsterSlot:n.monsterSlot}:{})};
  };
  // src … もとの(格子の)ノーツ。位置を直す道具(rhythm-chart-flow-fix.js)が書き戻すのに使う(数えるときは見ない)
  const notes=chart.notes.map(n=>Object.defineProperty(conv(n),'src',{value:n})).sort((a,b)=>a.timeMs-b.timeMs);
  return {notes,laneCount:chart.laneCount||6};
};
const loadAuthoring=(track,{dir=null,source='fixed',difficulties=DIFFS}={})=>{
  const audio=readAudio(track);if(!audio)throw new Error(`解析ファイルが無い: ${dashedOf(track)}-v3-audio.json`);
  const base=dir||AUTHORING,out={};
  for(const d of difficulties){
    // 自動修正後(fixed)が無ければ自動修正前(chart)を読む(生成器だけを通した書き出しを比べるとき)
    const names=source==='v3'?['chart']:['fixed','chart'];
    const file=names.map(n=>path.join(base,`${dashedOf(track)}-v3-${n}-${d.toLowerCase()}.json`)).find(f=>fs.existsSync(f));
    if(!file)continue;
    out[d]=toRuntimeChart(JSON.parse(fs.readFileSync(file,'utf8')),audio);
  }
  return {audio,layers:readLayers(track),charts:out,formula:'v3'};
};
let runtimeCache=null;
const loadReleased=(songId,{track=null,difficulties=DIFFS}={})=>{
  const rt=runtimeCache||(runtimeCache=loadRuntimeSongs());
  const song=rt.RHYTHM_SONGS.find(s=>s.songId===songId);if(!song)throw new Error(`公開中の曲に無い: ${songId}`);
  const out={};
  for(const d of difficulties){const c=song.difficulties&&song.difficulties[d];if(c&&Array.isArray(c.notes)&&c.notes.length>=8)out[d]={notes:c.notes.slice().sort((a,b)=>a.timeMs-b.timeMs),laneCount:c.laneCount||5};}
  if(difficulties.includes('HELL')&&!out.HELL){const proto=(rt.RHYTHM_PROTO_SONGS||[]).find(s=>s&&String(s.songId).startsWith(`${songId}_hell`));
    const c=proto&&proto.difficulties&&(proto.difficulties.HELL||Object.values(proto.difficulties)[0]);
    if(c&&Array.isArray(c.notes)&&c.notes.length>=8)out.HELL={notes:c.notes.slice().sort((a,b)=>a.timeMs-b.timeMs),laneCount:c.laneCount||6};}
  const tr=track||RELEASED_TRACKS[songId]||songId;
  return {audio:readAudio(tr),layers:readLayers(tr),charts:out,formula:levelFormulaFor(songId)};
};

// ── 測る ─────────────────────────────────────────────────────────────
// 5レーン時代の譜面は、ゲームと同じく6レーンの道の真ん中へ寄せて測る(サブレーン +1)
const onSixLanes=chart=>(chart.laneCount||5)>=6?chart.notes:chart.notes.map(n=>({...n,...(Number.isFinite(n.subLane)?{subLane:n.subLane+1}:{}),lane:Number(n.lane)+.5,
  ...(n.endLane!=null?{endLane:Number(n.endLane)+.5}:{}),...(n.slidePoints?{slidePoints:n.slidePoints.map(p=>({...p,lane:Number(p.lane)+.5}))}:{})}));
const centerOf=n=>n.type==='SLIDE'?Number(n.slidePoints?n.slidePoints[0].lane:n.lane)+.5:(Number(n.subLane)+Number(n.subLaneWidth||2)/2)/2;
const isSky=n=>Number(n.skyHeight)>0||(Array.isArray(n.slidePoints)&&n.slidePoints.some(p=>Number(p.sky??p.skyHeight)>0));
const spearman=(xs,ys)=>{const rank=a=>{const o=a.map((v,i)=>[v,i]).sort((p,q)=>p[0]-q[0]),r=Array(a.length);
    for(let i=0;i<o.length;){let j=i;while(j<o.length&&o[j][0]===o[i][0])j++;for(let k=i;k<j;k++)r[o[k][1]]=(i+j-1)/2;i=j;}return r;};
  if(xs.length<4)return null;const a=rank(xs),b=rank(ys),m=(a.length-1)/2;let sab=0,saa=0,sbb=0;
  for(let i=0;i<a.length;i++){sab+=(a[i]-m)*(b[i]-m);saa+=(a[i]-m)**2;sbb+=(b[i]-m)**2;}return saa&&sbb?sab/Math.sqrt(saa*sbb):null;};

const measureChart=(chart,audio,{formula='v3',difficulty='',layers=null}={})=>{
  const notes=onSixLanes(chart),beatMs=audio?audio.timing.beatMs:500,issues=[];
  const starts=notes.map(n=>n.timeMs),first=starts[0],last=Math.max(...notes.map(n=>Number(n.endTimeMs)||n.timeMs));
  const seconds=Math.max(1,(last-first)/1000);
  const types={TAP:0,FLICK:0,HOLD:0,SLIDE:0};for(const n of notes)types[n.type]=(types[n.type]||0)+1;
  // 量
  let peak4s=0,peakAt=first;for(let i=0,j=0;i<starts.length;i++){while(starts[i]-starts[j]>4000)j++;if(i-j+1>peak4s){peak4s=i-j+1;peakAt=starts[j];}}
  let minGapMs=Infinity;for(let i=1;i<starts.length;i++)if(starts[i]>starts[i-1])minGapMs=Math.min(minGapMs,starts[i]-starts[i-1]);
  const {level}=chartLevel({notes:chart.notes,laneCount:chart.laneCount},{formula});
  // 手(横持ちの親指2本)
  const th=thumbCheck(fromRuntime(notes),THUMB_PROFILES.landscape,beatMs);
  for(const i of th.issues)if(i.kind!=='busy')issues.push({timeMs:Math.round(i.t),kind:i.kind,lane:round(i.x,1),detail:`${i.what}: ${i.why}`});
  // 流れ(同じ時刻のノーツは1つのかたまり。数え方は rhythm-chart-flow-report.js の flowStats と同じ区切り)
  const groups=[];for(const n of notes){const g=groups[groups.length-1],c=centerOf(n);if(g&&n.timeMs-g.t<5){g.sum+=c;g.count++;}else groups.push({t:n.timeMs,sum:c,count:1});}
  const flow={fast:0,stair:0,swing:0,alternate:0,jump:0,jack:0};let lastDir=0;
  for(let i=1;i<groups.length;i++){const a=groups[i-1],b=groups[i];if(b.t-a.t>beatMs*FAST_BEAT+2){lastDir=0;continue;}
    const ca=a.sum/a.count,cb=b.sum/b.count,d=cb-ca,dir=Math.sign(d);flow.fast++;
    if(Math.abs(d)<.25)flow.jack++;
    else if(Math.abs(d)<=JUMP_LANES){if(lastDir!==0&&dir===lastDir)flow.stair++;else flow.swing++;}
    else if((ca<CENTER+.5)!==(cb<CENTER+.5)&&Math.abs(d)<=3.5)flow.alternate++;
    else{flow.jump++;issues.push({timeMs:b.t,kind:'jump',lane:round(cb,1),detail:`速い続きで ${Math.abs(d).toFixed(1)} レーン跳ぶ(${Math.round(b.t-a.t)}ms)`});}
    lastDir=Math.abs(d)<.25?lastDir:dir;}
  const flowRatio=flow.fast?(flow.stair+flow.swing+flow.alternate)/flow.fast:1;
  // 片手だけで速く続く長さ(親指の振り分けの結果から)
  let oneHandRun=0;{const seq=[];const raw=fromRuntime(notes);// thumbCheck は渡した並びを写して使うので、振り分けは別に数え直す
    const th2=thumbCheck(raw,THUMB_PROFILES.landscape,beatMs);for(const n of raw){const h=n.hand||th2.hands.get(n);if(h)seq.push({t:n.k==='s'?n.pts[0][0]:n.t,h});}
    seq.sort((a,b)=>a.t-b.t);let run=1,runStart=seq.length?seq[0].t:0;
    for(let i=1;i<seq.length;i++){const same=seq[i].h===seq[i-1].h&&seq[i].t-seq[i-1].t<=beatMs*FAST_BEAT+2&&seq[i].t>seq[i-1].t;
      if(same){run++;if(run>oneHandRun)oneHandRun=run;if(run===6)issues.push({timeMs:runStart,kind:'onehand',lane:null,detail:`片手(${seq[i].h==='L'?'左':'右'})だけで速い続きが6つ以上`});}
      else{run=1;runStart=seq[i].t;}}}
  // 息つぎ(1拍以上の休みが無いまま続く長さ)
  let noRestMs=0;{let from=first,prevEnd=first;for(const n of notes){if(n.timeMs-prevEnd>=beatMs-2){noRestMs=Math.max(noRestMs,prevEnd-from);from=n.timeMs;}prevEnd=Math.max(prevEnd,Number(n.endTimeMs)||n.timeMs);}noRestMs=Math.max(noRestMs,prevEnd-from);}
  // 形
  const held=HR.heldBandBlocked(notes);for(const x of held)issues.push({timeMs:Math.round((x.note||x).timeMs??x.timeMs),kind:'heldband',lane:null,detail:'押さえている帯の中にノーツ'});
  let widthJumps=0;for(const n of notes)if(n.slidePoints)for(let i=1;i<n.slidePoints.length;i++)if(Math.abs((n.slidePoints[i].subLaneWidth||2)-(n.slidePoints[i-1].subLaneWidth||2))>=2){widthJumps++;
    issues.push({timeMs:n.slidePoints[i].timeMs,kind:'widthjump',lane:round(n.slidePoints[i].lane+.5,1),detail:`スライドの太さが ${n.slidePoints[i-1].subLaneWidth}→${n.slidePoints[i].subLaneWidth}`});}
  const monsters=notes.filter(n=>n.monsterSlot).length;
  // 盛り上がりと密度(小節2つずつの窓で順位の相関。区切りごとの差も出す)
  let energy=null;
  if(audio&&audio.structure&&Array.isArray(audio.structure.bars)){
    const bars=audio.structure.bars.filter(b=>b.endMs>first&&b.startMs<last),xs=[],ys=[];
    for(let i=0;i+1<bars.length;i+=2){const a=bars[i].startMs,b=bars[i+1].endMs;xs.push((bars[i].intensity+bars[i+1].intensity)/2);ys.push(notes.filter(n=>n.timeMs>=a&&n.timeMs<b).length/((b-a)/1000));}
    const secs=(audio.structure.sections||[]).filter(s=>s.endMs>first+1000&&s.startMs<last-1000).map(s=>{const a=Math.max(s.startMs,first),b=Math.min(s.endMs,last);
      return {label:s.label,startMs:s.startMs,endMs:s.endMs,intensity:s.intensity,density:notes.filter(n=>n.timeMs>=a&&n.timeMs<b).length/Math.max(1,(b-a)/1000)};});
    const maxI=Math.max(...secs.map(s=>s.intensity),.001),maxD=Math.max(...secs.map(s=>s.density),.001);
    for(const s of secs){s.gap=round(s.density/maxD-s.intensity/maxI);s.density=round(s.density);}
    // 逆になっている区切り: 静かなのに重い(+)・盛り上がるのに軽い(−)。入りを軽くする引き出し R2 の分は「軽い」に出るが、狙いどおり
    for(const s of secs)if(Math.abs(s.gap)>=.4&&s.endMs-s.startMs>=8000)issues.push({timeMs:Math.round(s.startMs),kind:'energy',lane:null,
      detail:`区切り${s.label}(${fmt(s.startMs)}〜${fmt(s.endMs)}): ${s.gap>0?'静かなのに重い':'盛り上がるのに軽い'}(盛り上がり ${round(s.intensity/maxI)}・密度 ${round(s.density/maxD)})`});
    // サビ(rhythm-chart-chorus.js がはっきり見つけたとき)と、サビ以外の密度の比。人の譜面はサビが濃い(1より大きい)
    let chorusLift=null,chorus=[];
    try{const c=require('./rhythm-chart-chorus.js').detectChorus(audio,layers);if(c.confident){chorus=c.sections.filter(x=>x.chorus).map(x=>[x.startMs,x.endMs]);
      const inC=n=>chorus.some(([a,b])=>n.timeMs>=a&&n.timeMs<b),cSec=chorus.reduce((a,[x,y])=>a+Math.max(0,Math.min(y,last)-Math.max(x,first)),0)/1000,cN=notes.filter(inC).length;
      if(cSec>4&&seconds-cSec>4&&notes.length>cN)chorusLift=round((cN/cSec)/((notes.length-cN)/(seconds-cSec)));}}catch(e){}
    energy={corr:round(spearman(xs,ys)),sections:secs,chorusLift,chorus};
  }
  const n100=v=>round(v/notes.length*100,1),count=k=>issues.filter(i=>i.kind===k).length;
  return {difficulty,notes:notes.length,types,sky:notes.filter(isSky).length,seconds:round(seconds,1),nps:round(notes.length/seconds),peak4s,peakAtMs:peakAt,minGapMs:Math.round(minGapMs),level,
    impossible:count('impossible'),cross:count('cross'),reach:count('reach'),busy:th.count.busy,
    crossPer100:n100(count('cross')),reachPer100:n100(count('reach')),
    flowRatio:round(flowRatio,3),jump:flow.jump,jack:flow.jack,jumpRate:round(flow.fast?flow.jump/flow.fast:0,3),jackRate:round(flow.fast?flow.jack/flow.fast:0,3),fast:flow.fast,
    oneHandRun,noRestSec:round(noRestMs/1000,1),heldBand:held.length,widthJumps,monsters,
    longShare:round((types.HOLD+types.SLIDE)/notes.length,3),flickShare:round(types.FLICK/notes.length,3),
    energyCorr:energy?energy.corr:null,chorusLift:energy?energy.chorusLift:null,chorus:energy?energy.chorus:[],sections:energy?energy.sections:[],issues:issues.sort((a,b)=>a.timeMs-b.timeMs)};
};
// となりの難易度との差
const ladderOf=byDiff=>{const out=[],ds=DIFFS.filter(d=>byDiff[d]);
  for(let i=1;i<ds.length;i++){const a=byDiff[ds[i-1]],b=byDiff[ds[i]];out.push({from:ds[i-1],to:ds[i],notesRatio:round(b.notes/a.notes),peakRatio:round(b.peak4s/Math.max(1,a.peak4s)),levelStep:b.level-a.level});}
  return out;};
// 「ここを見て」: 4秒の窓ごとに問題の重さを足して、重い順に並べる
const WEIGHT={impossible:10,heldband:6,cross:3,widthjump:3,onehand:2,jump:2,reach:1,energy:0};
const hotSpots=(m,top=8)=>{const win=new Map();
  for(const i of m.issues){if(!WEIGHT[i.kind])continue;const k=Math.floor(i.timeMs/4000);const w=win.get(k)||{fromMs:k*4000,score:0,kinds:{}};w.score+=WEIGHT[i.kind];w.kinds[i.kind]=(w.kinds[i.kind]||0)+1;win.set(k,w);}
  return [...win.values()].sort((a,b)=>b.score-a.score||a.fromMs-b.fromMs).slice(0,top);};

// ── 帯(公開中の譜面の幅) ─────────────────────────────────────────────
const BAND_KEYS=['nps','peak4s','minGapMs','crossPer100','reachPer100','flowRatio','jumpRate','jackRate','oneHandRun','noRestSec','longShare','flickShare','energyCorr'];
const LADDER_KEYS=['notesRatio','peakRatio','levelStep'];
const quantile=(sorted,q)=>{if(!sorted.length)return null;const p=(sorted.length-1)*q,i=Math.floor(p);return sorted[i]+(sorted[Math.min(sorted.length-1,i+1)]-sorted[i])*(p-i);};
const calibrate=()=>{
  const rt=runtimeCache||(runtimeCache=loadRuntimeSongs()),demo=new Set(rt.RHYTHM_DEMO_SONG_IDS||[]);
  const acc={},lad={};let charts=0,songs=0;
  for(const song of rt.RHYTHM_SONGS){if(demo.size&&!demo.has(song.songId))continue;
    let loaded;try{loaded=loadReleased(song.songId);}catch(e){continue;}
    if(!loaded.audio)continue;songs++;const by={};
    for(const d of DIFFS){if(!loaded.charts[d])continue;const m=by[d]=measureChart(loaded.charts[d],loaded.audio,{formula:loaded.formula,difficulty:d});charts++;
      for(const k of BAND_KEYS)if(Number.isFinite(m[k]))((acc[d]=acc[d]||{})[k]=acc[d][k]||[]).push(m[k]);}
    for(const l of ladderOf(by))for(const k of LADDER_KEYS)if(Number.isFinite(l[k]))((lad[`${l.from}>${l.to}`]=lad[`${l.from}>${l.to}`]||{})[k]=lad[`${l.from}>${l.to}`][k]||[]).push(l[k]);}
  const band=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>{v.sort((a,b)=>a-b);return [k,{lo:round(quantile(v,.05),3),mid:round(quantile(v,.5),3),hi:round(quantile(v,.95),3),n:v.length}];}));
  return {schemaVersion:1,note:'公開中の譜面の同じ難易度の 5%〜95% の幅。node tools/mode/rhythm-chart-review.js --calibrate が作る。手で書かない',songs,charts,
    byDifficulty:Object.fromEntries(Object.entries(acc).map(([d,o])=>[d,band(o)])),ladder:Object.fromEntries(Object.entries(lad).map(([d,o])=>[d,band(o)]))};
};
const readBands=()=>fs.existsSync(BANDS_FILE)?JSON.parse(fs.readFileSync(BANDS_FILE,'utf8')):null;
// 帯の外かどうか。どちら向きが「気になる側」かは項目ごとに決める(両側を見るものは both)
const WATCH={nps:'both',peak4s:'both',minGapMs:'lo',crossPer100:'hi',reachPer100:'hi',flowRatio:'lo',jumpRate:'hi',jackRate:'hi',oneHandRun:'hi',noRestSec:'hi',longShare:'both',flickShare:'both',energyCorr:'lo',
  notesRatio:'both',peakRatio:'both',levelStep:'both'};
const outOfBand=(key,value,band)=>{if(!band||!Number.isFinite(value))return '';const w=WATCH[key];
  if((w==='lo'||w==='both')&&value<band.lo)return '低';if((w==='hi'||w==='both')&&value>band.hi)return '高';return '';};

// ── 出す ─────────────────────────────────────────────────────────────
function fmt(ms){const s=Math.max(0,ms)/1000;return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`;}
const LABEL={notes:'ノーツ',level:'Lv.',nps:'毎秒',peak4s:'最密4秒',minGapMs:'最短ms',impossible:'押せない',cross:'交差',reach:'届きにくい',crossPer100:'交差/100',reachPer100:'届きにくい/100',flowRatio:'流れの割合',jump:'跳び',jack:'連打',jumpRate:'跳びの割合',jackRate:'連打の割合',
  oneHandRun:'片手の続き',noRestSec:'休みなし秒',heldBand:'帯の中',widthJumps:'太さの飛び',monsters:'モンスター',longShare:'長押しの割合',flickShare:'フリックの割合',energyCorr:'盛り上がりとの合い方',chorusLift:'サビ/ほかの密度',sky:'空中',
  notesRatio:'ノーツ数の比',peakRatio:'最密4秒の比',levelStep:'Lv.の差'};
const KIND_LABEL={impossible:'押せない',cross:'交差',reach:'届きにくい',jump:'跳び',onehand:'片手の続き',heldband:'帯の中',widthjump:'太さの飛び',energy:'盛り上がりと密度'};
const SHOW=['notes','level','nps','peak4s','minGapMs','impossible','cross','reach','flowRatio','jump','jack','oneHandRun','noRestSec','heldBand','widthJumps','monsters','longShare','flickShare','energyCorr','chorusLift'];
const printReview=(title,byDiff,bands,{top=8}={})=>{
  const ds=DIFFS.filter(d=>byDiff[d]),flags=[];
  console.log(`\n■ ${title}`);
  console.log(`${'　'.repeat(9)} ${ds.map(d=>d.padStart(8)).join('')}`);
  for(const k of SHOW){const cells=ds.map(d=>{const m=byDiff[d],b=bands&&bands.byDifficulty[d]&&bands.byDifficulty[d][k],o=outOfBand(k,m[k],b);
      if(o)flags.push(`${d} ${LABEL[k]} ${m[k]} が帯(${b.lo}〜${b.hi})より${o}い`);return `${String(m[k]??'-')}${o?'※':''}`.padStart(8);});
    console.log(`${LABEL[k].padEnd(9,'　')} ${cells.join('')}`);}
  // 絶対に直すもの(帯とは関係なく)
  for(const d of ds){const m=byDiff[d];if(m.impossible)flags.unshift(`${d} 横持ちの親指で押せない ${m.impossible} 件(rhythm-chart-flow-fix.js で直す)`);if(m.heldBand)flags.unshift(`${d} 押さえている帯の中 ${m.heldBand} 件`);
    if(m.widthJumps)flags.unshift(`${d} スライドの太さの飛び ${m.widthJumps} 件`);if(m.monsters!==4)flags.unshift(`${d} モンスターノーツが ${m.monsters} 個(4個ちょうどにする)`);}
  const lad=ladderOf(byDiff);
  if(lad.length){console.log('段の差   '+lad.map(l=>{const b=bands&&bands.ladder[`${l.from}>${l.to}`];const o1=outOfBand('notesRatio',l.notesRatio,b&&b.notesRatio),o2=outOfBand('peakRatio',l.peakRatio,b&&b.peakRatio);
      if(o1)flags.push(`${l.from}→${l.to} ノーツ数の比 ${l.notesRatio} が帯(${b.notesRatio.lo}〜${b.notesRatio.hi})より${o1}い`);if(o2)flags.push(`${l.from}→${l.to} 最密4秒の比 ${l.peakRatio} が帯(${b.peakRatio.lo}〜${b.peakRatio.hi})より${o2}い`);
      if(l.to==='HELL')return `${l.from[0]}→HELL ×${l.notesRatio}(最密×${l.peakRatio})`;// HELL は空中で難しくするので、数が MASTER より少なくてもよい
      if(l.notesRatio<1.03)flags.unshift(`${l.from}→${l.to} ノーツ数がほぼ同じ(${l.notesRatio}倍)。難易度の差が出ていない`);
      if(l.peakRatio<1)flags.unshift(`${l.from}→${l.to} いちばん忙しい所が下の難易度より軽い(最密4秒 ${l.peakRatio}倍)`);
      return `${l.from[0]}→${l.to[0]} ×${l.notesRatio}(最密×${l.peakRatio})`;}).join('  '));}
  if(flags.length){console.log('気になる所:');for(const f of flags)console.log(`  ・${f}`);}else console.log('気になる所: なし(帯の中)');
  for(const d of ds){const m=byDiff[d],hs=hotSpots(m,top);const en=m.issues.filter(i=>i.kind==='energy');
    if(!hs.length&&!en.length)continue;console.log(`ここを見て ${d}:`);
    for(const e of en)console.log(`  ${e.detail}`);
    for(const h of hs)console.log(`  ${fmt(h.fromMs)}〜 ${Object.entries(h.kinds).map(([k,c])=>`${KIND_LABEL[k]}${c}`).join('・')}`);}
  return flags;
};
const printCompare=(before,after)=>{
  console.log('\n■ 比べる(前 → 後)');
  for(const d of DIFFS.filter(x=>before[x]&&after[x])){const a=before[d],b=after[d],parts=[];
    for(const k of SHOW){if(a[k]===b[k])continue;parts.push(`${LABEL[k]} ${a[k]}→${b[k]}`);}
    console.log(`  ${d.padEnd(7)} ${parts.length?parts.join(' / '):'同じ'}`);}
};

// ── 止め絵 ───────────────────────────────────────────────────────────
// 下から上へ時間が進む(ゲームの見え方と同じ)。1本の柱が8小節ぶん。柱の左に盛り上がり(灰色の棒)、右に問題の印。
const COLORS={TAP:'#38bdf8',FLICK:'#f472b6',HOLD:'#4ade80',SLIDE:'#a78bfa',sky:'#fbbf24',monster:'#f97316'};
const ISSUE_COLORS={impossible:'#ef4444',heldband:'#ef4444',cross:'#fb923c',widthjump:'#fb923c',jump:'#c084fc',onehand:'#2dd4bf',reach:'#facc15'};
const pictureSvg=(panels,audio,title)=>{
  // panels: [{label, chart, metrics}](1つなら1譜面・2つなら左右に並べて比べる)
  const beatMs=audio?audio.timing.beatMs:500,barMs=beatMs*(audio?audio.timing.beatsPerBar||4:4),zero=audio?audio.timing.beatZeroMs:0;
  const all=panels.flatMap(p=>p.chart.notes),t0=Math.min(...all.map(n=>n.timeMs)),t1=Math.max(...all.map(n=>Number(n.endTimeMs)||n.timeMs));
  const firstBar=Math.floor((t0-zero)/barMs),lastBar=Math.ceil((t1-zero)/barMs),BARS=8,cols=Math.ceil((lastBar-firstBar)/BARS);
  const LW=14,PW=LANES*LW,GAP=10,EN=8,IS=10,COLW=EN+panels.length*(PW+IS)+(panels.length-1)*4+GAP+26,BH=44,H=BARS*BH,TOP=46,W=cols*COLW+20;
  const bars=audio&&audio.structure?audio.structure.bars:[],secs=audio&&audio.structure?audio.structure.sections||[]:[];
  const o=[`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H+TOP+26}" viewBox="0 0 ${W} ${H+TOP+26}" font-family="sans-serif">`,
    `<rect width="100%" height="100%" fill="#0f172a"/>`,`<text x="10" y="18" fill="#e2e8f0" font-size="13">${esc(title)}</text>`,
    `<text x="10" y="35" fill="#94a3b8" font-size="10">下→上へ進む・1本=8小節 / 青TAP 桃FLICK 緑HOLD 紫SLIDE 黄=空中 橙=モンスター / 左の灰=盛り上がり / ★=サビと見た区切り / 右の印: 赤 押せない・帯の中 / 橙 交差・太さの飛び / 紫 跳び / 緑 片手の続き / 黄 届きにくい</text>`];
  for(let c=0;c<cols;c++){
    const x0=10+c*COLW,from=zero+(firstBar+c*BARS)*barMs,yOf=t=>TOP+H-(t-from)/barMs*BH,inCol=t=>t>=from-1&&t<from+BARS*barMs;
    for(const b of bars)if(inCol(b.startMs)){o.push(`<rect x="${x0}" y="${round(Math.max(TOP,yOf(b.startMs)-BH+1))}" width="${round(EN*b.intensity,1)}" height="${BH-2}" fill="#64748b"/>`);}
    panels.forEach((p,pi)=>{const px=x0+EN+2+pi*(PW+IS+4);
      o.push(`<rect x="${px}" y="${TOP}" width="${PW}" height="${H}" fill="#1e293b"/>`);
      for(let l=1;l<LANES;l++)o.push(`<line x1="${px+l*LW}" y1="${TOP}" x2="${px+l*LW}" y2="${TOP+H}" stroke="${l===CENTER?'#475569':'#273449'}" stroke-width="${l===CENTER?1:.5}"/>`);
      for(let b=0;b<=BARS;b++)o.push(`<line x1="${px}" y1="${TOP+H-b*BH}" x2="${px+PW}" y2="${TOP+H-b*BH}" stroke="#334155" stroke-width=".7"/>`);
      const X=lane=>px+lane*LW;
      for(const n of onSixLanes(p.chart)){const end=Number(n.endTimeMs)||n.timeMs;if(end<from||n.timeMs>=from+BARS*barMs)continue;
        const sky=isSky(n),col=sky?COLORS.sky:n.monsterSlot?COLORS.monster:COLORS[n.type];
        const clampY=y=>Math.max(TOP,Math.min(TOP+H,y));
        if(n.type==='SLIDE'&&n.slidePoints){const L=[],R=[];for(const q of n.slidePoints){const y=clampY(yOf(q.timeMs)),cx=q.lane+.5,w=(q.subLaneWidth||2)/4;L.push(`${round(X(cx-w),1)},${round(y,1)}`);R.unshift(`${round(X(cx+w),1)},${round(y,1)}`);}
          o.push(`<polygon points="${L.concat(R).join(' ')}" fill="${col}" fill-opacity=".55" stroke="${col}" stroke-width=".6"/>`);}
        else if(n.type==='HOLD'){const y1=clampY(yOf(n.timeMs)),y2=clampY(yOf(end));o.push(`<rect x="${round(X(n.subLane/2)+1,1)}" y="${round(y2,1)}" width="${round((n.subLaneWidth||2)/2*LW-2,1)}" height="${round(Math.max(2,y1-y2),1)}" fill="${col}" fill-opacity=".55" stroke="${col}" stroke-width=".6"/>`);}
        if(inCol(n.timeMs)&&n.type!=='SLIDE'){const y=yOf(n.timeMs),x=X(n.subLane/2)+1,w=(n.subLaneWidth||2)/2*LW-2;
          o.push(n.type==='FLICK'?`<polygon points="${round(x,1)},${round(y+1.5,1)} ${round(x+w,1)},${round(y+1.5,1)} ${round(x+w/2,1)},${round(y-4.5,1)}" fill="${col}"/>`
            :`<rect x="${round(x,1)}" y="${round(y-1.8,1)}" width="${round(w,1)}" height="3.6" rx="1" fill="${col}"/>`);}
        else if(inCol(n.timeMs)&&n.slidePoints){const q=n.slidePoints[0],y=yOf(n.timeMs);o.push(`<rect x="${round(X(q.lane+.5-(q.subLaneWidth||2)/4),1)}" y="${round(y-1.8,1)}" width="${round((q.subLaneWidth||2)/2*LW,1)}" height="3.6" fill="${col}"/>`);}
      }
      // 問題の印
      const ix=px+PW+2;for(const i of p.metrics.issues){if(!ISSUE_COLORS[i.kind]||!inCol(i.timeMs))continue;o.push(`<rect x="${ix}" y="${round(yOf(i.timeMs)-2,1)}" width="${IS-4}" height="4" fill="${ISSUE_COLORS[i.kind]}"/>`);}
      if(c===0||panels.length>1)o.push(`<text x="${px}" y="${TOP+H+12}" fill="#94a3b8" font-size="8">${esc(p.label)}</text>`);
    });
    o.push(`<text x="${x0+EN+2}" y="${TOP+H+22}" fill="#cbd5e1" font-size="9">${fmt(from)}</text>`);
    for(const s of secs)if(inCol(s.startMs)){const star=(panels[0].metrics.chorus||[]).some(([a])=>Math.abs(a-s.startMs)<5);o.push(`<text x="${x0+COLW-GAP-24}" y="${round(yOf(s.startMs)-2,1)}" fill="${star?'#fde047':'#f1f5f9'}" font-size="9">▸${esc(s.label)}${star?'★':''}</text>`);}
  }
  o.push('</svg>');return o.join('\n');
};
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
// 止め絵を PNG にするブラウザ。入っている Playwright の版に合うものが無ければ、置いてある Chromium(/opt/pw-browsers/chromium・PLAYWRIGHT_CHROMIUM)を使う
const launchChromium=async pw=>{for(const opt of [{},{executablePath:process.env.PLAYWRIGHT_CHROMIUM||'/opt/pw-browsers/chromium'}]){try{return await pw.chromium.launch(opt);}catch(e){}}return null;};
const writePicture=async(file,svg)=>{
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(`${file}.svg`,svg);
  let pw=null;try{pw=require('playwright');}catch(e){try{pw=require(path.join(__dirname,'..','node_modules','playwright'));}catch(e2){}}
  if(!pw)return [`${file}.svg`];
  const m=svg.match(/width="(\d+)" height="(\d+)"/),browser=await launchChromium(pw);
  if(!browser)return [`${file}.svg`];// ブラウザが無い環境では SVG だけ(SVG はそのまま開ける)
  try{const page=await browser.newPage({viewport:{width:Number(m[1]),height:Number(m[2])},deviceScaleFactor:2});await page.setContent(`<body style="margin:0;background:#0f172a">${svg}</body>`);
    await page.screenshot({path:`${file}.png`});}finally{await browser.close();}
  return [`${file}.svg`,`${file}.png`];
};

const reviewOf=(loaded,difficulties)=>{const by={};for(const d of DIFFS){if(!loaded.charts[d]||(difficulties&&!difficulties.includes(d)))continue;by[d]=measureChart(loaded.charts[d],loaded.audio,{formula:loaded.formula,difficulty:d,layers:loaded.layers});}return by;};

module.exports={launchChromium,writePicture,measureChart,ladderOf,hotSpots,toRuntimeChart,loadAuthoring,loadReleased,reviewOf,calibrate,readBands,outOfBand,pictureSvg,BAND_KEYS,BANDS_FILE,DIFFS};

if(require.main===module)(async()=>{
  const args=process.argv.slice(2),arg=(n,d=null)=>{const i=args.indexOf(n);return i>=0&&i+1<args.length?args[i+1]:d;},has=n=>args.includes(n);
  if(has('--calibrate')){const b=calibrate();fs.writeFileSync(BANDS_FILE,JSON.stringify(b,null,1)+'\n');console.log(`帯を作り直した: ${path.relative(process.cwd(),BANDS_FILE)}(${b.songs}曲・${b.charts}譜面)`);return;}
  const track=arg('--track'),released=arg('--released'),difficulties=arg('--difficulty')?arg('--difficulty').split(',').map(s=>s.trim().toUpperCase()):null;
  if(!track&&!released){console.error('--track <曲> か --released <songId> が要る(使い方はファイルの頭)');process.exit(1);}
  const bands=readBands(),top=Number(arg('--top',8))||8,source=arg('--source','fixed'),picture=arg('--picture');
  const load=dir=>loadAuthoring(track,{dir,source});
  const out={},files=[];
  if(arg('--before')&&arg('--after')){
    const A=load(arg('--before')),B=load(arg('--after')),a=reviewOf(A,difficulties),b=reviewOf(B,difficulties);
    if(has('--json')){console.log(JSON.stringify({before:a,after:b}));return;}
    printReview(`${track} 前(${arg('--before')})`,a,bands,{top});printReview(`${track} 後(${arg('--after')})`,b,bands,{top});printCompare(a,b);
    if(picture)for(const d of Object.keys(b).filter(x=>a[x]))files.push(...await writePicture(path.join(picture,`${dashedOf(track)}-${d.toLowerCase()}-compare`),
      pictureSvg([{label:'前',chart:A.charts[d],metrics:a[d]},{label:'後',chart:B.charts[d],metrics:b[d]}],B.audio,`${track} ${d}  前 ${a[d].notes}ノーツ Lv.${a[d].level} → 後 ${b[d].notes}ノーツ Lv.${b[d].level}`)));
  }else{
    const L=released?loadReleased(released,{track}):load(arg('--dir')),by=reviewOf(L,difficulties),name=released||track;
    if(!Object.keys(by).length){console.error('譜面が見つからない');process.exit(1);}
    if(has('--json')){console.log(JSON.stringify(by));return;}
    printReview(`${name}${released?'(公開中)':arg('--dir')?`(${arg('--dir')})`:''}`,by,bands,{top});
    if(!L.audio)console.log('(解析ファイルが無いので、盛り上がりとの合い方は測っていない)');
    if(picture)for(const d of Object.keys(by))files.push(...await writePicture(path.join(picture,`${dashedOf(name)}-${d.toLowerCase()}`),
      pictureSvg([{label:d,chart:L.charts[d],metrics:by[d]}],L.audio,`${name} ${d}  ${by[d].notes}ノーツ Lv.${by[d].level} 毎秒${by[d].nps} 最密4秒${by[d].peak4s}`)));
  }
  if(files.length){console.log('\n止め絵:');for(const f of files)console.log(`  ${f}`);}
  if(!bands)console.log('\n(帯のファイルがまだ無い。node tools/mode/rhythm-chart-review.js --calibrate で作る)');
  void out;
})().catch(e=>{console.error(e.message||e);process.exit(1);});
