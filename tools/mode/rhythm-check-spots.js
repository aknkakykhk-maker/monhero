#!/usr/bin/env node
// 曲ごとの「ここを確かめて」リスト(2026-09-29・ユーザー判断「1と2を進めて」)。
//
//   node tools/mode/rhythm-check-spots.js --track big_bridge_no_shitou        # 1曲を画面に出す
//   node tools/mode/rhythm-check-spots.js --all --write                        # 公開中の全曲を docs/spec/RHYTHM_CHECK_SPOTS.md へ
//
// 【なぜ要るか】
// 「気持ちよく流れてくるか」は機械では測り切れない(ROADMAP 8・14章)。遊んで気づいた違和感を1つずつ直すのが確実だが
// (例: ビッグブリッヂの死闘の余韻)、全曲を通しで遊んで探すのは手間がかかる。
// そこで、違和感が出やすい所を物差しで拾い、曲・難易度ごとに秒数付きで並べる。遊ぶ人はその秒数だけ確かめればよい。
//
// 【拾うもの】4秒ずつの区間で数え、近いものはまとめる。1つの譜面につき、目立つ順に上から SPOTS_PER_CHART 個
//   ・気になり点が高い区間(rhythm-chart-feel-report.js: 同じ動きの繰り返し・重なって見える・急な折り返し・押しにくい など)
//   ・仮想プレイヤー(rhythm-virtual-player.js)のミスが集まる区間
//   ・弱い音に置いたノーツ(近くのいちばん強い音の 1/4 未満の音)が、その曲の平均の2.5倍以上固まっている区間 … 「何の音に合わせているか分からない」になりやすい
//   ・音の時刻から 25ms 以上離れて置いたノーツが、その曲の平均の2.5倍以上固まっている区間 … 「音とずれて聞こえる」になりやすい
//   ・急に詰まる区間(2秒の密度が曲の平均の2.2倍以上・直前の4秒の1.5倍以上)
//   ・出だし(最初のノーツが3秒より後)・終わり(最後のノーツのあと4秒以上曲が続く)
// 物差しは読むだけ。譜面にも解析にも触らない。
'use strict';
const fs=require('fs'),path=require('path');
const {measureFeel}=require('./rhythm-chart-feel-report.js');
const {playChart}=require('./rhythm-virtual-player.js');
const {tempoWarpForChart}=require('./rhythm-chart-tempo-warp.js');

const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback=null)=>{const i=process.argv.indexOf(name);return i>=0&&i+1<process.argv.length?process.argv[i+1]:fallback;};
const WINDOW_MS=4000,SPOTS_PER_CHART=6;
const DEFAULT_DIFFICULTIES=['HARD','MASTER'];

const clock=ms=>{const s=Math.max(0,ms)/1000;return `${Math.floor(s/60)}:${(s%60).toFixed(1).padStart(4,'0')}`;};

const spotsFor=(chart,audio)=>{
  const timing=audio.timing,gridMs=timing.gridMs||timing.beatMs/timing.subdivisionsPerBeat;
  const warp=tempoWarpForChart(chart,audio);
  const timeOf=grid=>timing.beatZeroMs+grid*gridMs+warp.at(grid);
  const notes=chart.notes.map(note=>({note,ms:timeOf(note.grid)})).sort((a,b)=>a.ms-b.ms);
  if(!notes.length)return [];
  const windows=new Map();
  const add=(ms,score,reason)=>{const key=Math.floor(ms/WINDOW_MS);const w=windows.get(key)||{fromMs:key*WINDOW_MS,score:0,reasons:new Map()};
    w.score+=score;w.reasons.set(reason,(w.reasons.get(reason)||0)+1);windows.set(key,w);};
  // 気になり点
  const feel=measureFeel(chart,audio,{withQuality:false});
  const concerns=feel.segments.map(s=>s.concern).sort((a,b)=>a-b);const concernMedian=concerns[concerns.length>>1]||0;
  for(const seg of feel.segments)if(seg.concern>=Math.max(2,concernMedian*2))
    add(seg.fromMs+WINDOW_MS/2,seg.concern,seg.details&&seg.details.length?seg.details.join('・'):'気になり点が高い');
  // 仮想プレイヤー
  const starts=[];for(let ms=0;ms<Number(audio.durationMs);ms+=WINDOW_MS)starts.push(ms);
  const played=playChart(chart,audio,{runs:40,segmentStartsMs:starts});
  const misses=played.segments.map(s=>s.expectedMisses).sort((a,b)=>a-b);const missMedian=misses[misses.length>>1]||0;
  for(const seg of played.segments)if(seg.expectedMisses>=Math.max(.5,missMedian*2.5))
    add(starts[seg.index]+WINDOW_MS/2,seg.expectedMisses*2,`仮想プレイヤーがつまずく(ミスの見込み ${seg.expectedMisses.toFixed(1)}個)`);
  // 弱い音・音から離れたノーツ
  const onsets=[...audio.onsets].sort((a,b)=>a.timeMs-b.timeMs);
  const localMax=ms=>{let max=0;for(const o of onsets){if(o.timeMs<ms-500)continue;if(o.timeMs>ms+500)break;max=Math.max(max,o.strength);}return max;};
  const weak=new Map(),far=new Map();
  for(const {note,ms} of notes){
    const key=Math.floor(ms/WINDOW_MS);
    if(Number.isFinite(note.sourceStrength)&&note.sourceStrength<localMax(ms)*.25)weak.set(key,(weak.get(key)||0)+1);
    if(Math.abs(Number(note.sourcePeakOffsetMs)||0)>=25)far.set(key,(far.get(key)||0)+1);
  }
  // その曲の中で特に多い区間だけ(曲全体の平均の2.5倍以上・3個以上)。曲によっては全体に多い(低音が遅れて記録される曲など)ので、平均で割る
  const windowCount=Math.max(1,Math.ceil(Number(audio.durationMs)/WINDOW_MS));
  const standout=(map,label,hint)=>{
    const average=[...map.values()].reduce((a,b)=>a+b,0)/windowCount;
    for(const [key,n] of map)if(n>=Math.max(3,average*2.5))add(key*WINDOW_MS+1,n/Math.max(1,average),`${label} ${n}個(${hint})`);
  };
  standout(weak,'弱い音に置いたノーツ','何の音に合わせているか分かりにくいかも');
  standout(far,'音から25ms以上離れたノーツ','音とずれて聞こえるかも');
  // 急に詰まる
  const spanMs=notes[notes.length-1].ms-notes[0].ms,mean=notes.length/Math.max(1,spanMs)*2000;
  for(let i=0,j=0,k=0;i<notes.length;i++){
    const at=notes[i].ms;
    while(notes[j].ms<at-2000)j++;
    while(notes[k].ms<at-6000)k++;
    const now=i-j+1,before=(j-k)/2;
    if(now>=mean*2.2&&now>=before*1.5&&now>=6){add(at,now/mean,`急に詰まる(2秒で${now}個・前の2倍近く)`);i+=now;}
  }
  // 出だしと終わり
  if(notes[0].ms>3000)add(notes[0].ms,3,`最初のノーツが ${(notes[0].ms/1000).toFixed(1)}秒(出だしが長い)`);
  const lastEnd=Math.max(...notes.map(({note,ms})=>ms+(Number(note.durationGrids)||0)*gridMs));
  const endGap=Number(chart.chartEndMs||audio.durationMs)-lastEnd;
  if(endGap>4000)add(lastEnd,3,`最後のノーツのあと ${(endGap/1000).toFixed(1)}秒 曲が続く`);
  return [...windows.values()].sort((a,b)=>b.score-a.score).slice(0,SPOTS_PER_CHART).sort((a,b)=>a.fromMs-b.fromMs)
    .map(w=>({fromMs:w.fromMs,toMs:w.fromMs+WINDOW_MS,score:Math.round(w.score*10)/10,reasons:[...w.reasons.keys()]}));
};

const songList=()=>{
  const {RELEASED_TRACKS}=require('./rhythm-runtime-notes.js');
  return Object.entries(RELEASED_TRACKS);
};
const displayNames=(()=>{
  try{const vm=require('vm');const ctx={Object,Number,Math,JSON,Array,String};
    vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')}\nthis.out=RHYTHM_SONGS;`,ctx);
    return Object.fromEntries(ctx.out.map(song=>[song.songId,`${song.displayName}${song.subtitle?` ${song.subtitle}`:''}`]));}catch(e){return {};}
})();

const reportTrack=(songId,trackId,difficulties)=>{
  const dashed=trackId.replace(/_/g,'-');
  const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-audio.json`),'utf8'));
  const lines=[`### ${displayNames[songId]||songId}（\`${songId}\`）`,''];
  for(const difficulty of difficulties){
    const file=path.join(ROOT,'tools/mode/authoring',`${dashed}-v3-fixed-${difficulty.toLowerCase()}.json`);
    if(!fs.existsSync(file))continue;
    const spots=spotsFor(JSON.parse(fs.readFileSync(file,'utf8')),audio);
    lines.push(`- **${difficulty}**${spots.length?'':' … 目立つ所なし'}`);
    for(const spot of spots)lines.push(`  - ${clock(spot.fromMs)}〜${clock(spot.toMs)}　${spot.reasons.join(' ／ ')}`);
  }
  return lines.join('\n');
};

if(require.main===module){
  const difficulties=(arg('--difficulties','')||DEFAULT_DIFFICULTIES.join(',')).split(',').filter(Boolean);
  const list=songList();
  const targets=process.argv.includes('--all')?list:list.filter(([songId,trackId])=>trackId===arg('--track')||songId===arg('--track'));
  if(!targets.length){console.error('--track <曲id> か --all を付けてください');process.exit(1);}
  const body=targets.map(([songId,trackId])=>reportTrack(songId,trackId,difficulties)).join('\n\n');
  if(process.argv.includes('--write')){
    const out=path.join(ROOT,'docs/spec/RHYTHM_CHECK_SPOTS.md');
    fs.writeFileSync(out,`# モンヒロビート「ここを確かめて」リスト\n\n`
      +`\`node tools/mode/rhythm-check-spots.js --all --write\` が作る（手で書き換えない）。遊んで確かめる秒数の目安。\n`
      +`拾い方は \`tools/mode/rhythm-check-spots.js\` の冒頭。1つの譜面につき目立つ順に${SPOTS_PER_CHART}か所まで、難易度は ${difficulties.join(' / ')}。\n\n${body}\n`);
    console.log(`書き出し: ${path.relative(ROOT,out)}`);
  }else console.log(body);
}

module.exports={spotsFor};
