// 地上の譜面(MASTER など)の「いやらしい形」を、押す位置(レーン)の並べ方だけで減らす(2026-11-01 社長「指交差のいやらしい場面が多かった」・Rebellion)。
//
//   node tools/mode/rhythm-chart-flow-fix.js --song rebellion --difficulty MASTER            # 何件減るかを出すだけ(書かない)
//   node tools/mode/rhythm-chart-flow-fix.js --song rebellion --difficulty MASTER --write    # 目印の内側を書き換える
//   node tools/mode/rhythm-chart-flow-fix.js --song sheriruth --difficulty MASTER --mode must  # 押せない所だけ直す(交差・届きにくいは動かさない)
//
// 【何を見るか】横持ちの親指2本のモデル(rhythm-ref-tiers.js の thumbCheck)の「押せない」「指が交差」「届きにくい(真ん中を越える)」「忙しい」と、
//   手の決まり(rhythm-chart-hand-rules.js)の「同じ側の押し始めが90ms未満」「真ん中で左右が同じ所」「地上の帯のすぐ横」「同時押しが隣り合う」「帯の中」「水平クロス」、両手のシミュレートの「押せない」。
//   交差の数え方(押さえている指を越える所)に入らない、「左右の手が入れ替わる流れ」「同じ指の速い横移動」も、真ん中越え・忙しいとして数える。
// 【直し方】そういう形が出た所のタップ・フリック(無ければ手前1拍半のもの)を、時刻・種類・幅はそのまま、別のレーンへ動かす候補を全部試し、
//   前後3秒の点数がいちばん下がるものを選ぶ。下がらなければ動かさない。ホールド・スライド・モンスターノーツは動かさない(音は1つも減らさない・増やさない)。
// 【決めごと】書くのは --song の曲の、--difficulty の目印の内側だけ。ほかの目印が1バイトでも変わりそうなら止める。
//   公開中の譜面は控え(rhythm-released-chart-lock-check.js)が見張るので、公開中の曲を直すときは社長が決めてから控えを --update する。
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
const RUNTIME=path.join(ROOT,'monster-hero/data/rhythm-mode.js');
const {thumbCheck,THUMB_PROFILES,simulateRuntime}=require('./rhythm-ref-tiers.js');
const HR=require('./rhythm-chart-hand-rules.js');
const {tokensOf}=require('./rhythm-hell-confuse-fix.js');
const {RELEASED_MARKERS}=require('./rhythm-runtime-notes.js');
const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null;};

const startOf=n=>n.k==='s'?n.pts[0][0]:n.t,endOf=n=>n.k==='s'?n.pts[n.pts.length-1][0]:n.k==='h'?n.end:n.t;
const xOf=n=>n.k==='s'?n.pts[0][1]+0.5:(n.sub+n.w/2)/2;
// ゲームのノーツ → 親指モデルの形
const fromRuntime=list=>list.map(n=>n.type==='SLIDE'?{k:'s',hand:null,pts:(n.slidePoints||[]).map(p=>[p.timeMs,Number(p.lane),Number(p.subLaneWidth)||2,Number(p.sky)||0,0]),src:n}
  :n.type==='HOLD'?{k:'h',t:n.timeMs,end:n.endTimeMs,sub:n.subLane,w:n.subLaneWidth||2,sky:0,src:n}
  :{k:n.type==='FLICK'?'f':'t',t:n.timeMs,sub:n.subLane,w:n.subLaneWidth||2,sky:Number(n.skyHeight)>0?1:0,mon:n.monsterSlot||0,src:n});
// 親指モデルの形 → ゲームのノーツ(数えるとき用。動かしたのはタップ・フリックの subLane だけ)
const toRuntime=list=>list.map(n=>n.k==='t'||n.k==='f'?{...n.src,subLane:n.sub,lane:Math.floor(n.sub/2),subLaneWidth:n.w}:n.src);
// 押せない・帯の中は「必ず直す」ものなので、いやらしい形(交差60・真ん中越え40 など)をいくつ消しても釣り合わない重さにする
//   (Rev.38: 100 のままだと、交差と真ん中越えを同時に消す1手が、ノーツを帯の中へ入れることがあった。7曲の作り比べで 帯の中 0→3 の譜面)
const MUST_W=1000;
const W={impossible:MUST_W,cross:60,reach:40,busy:10};
const SP_W={centerSwap:40,beside:20,chord:40,skyPath:40,stacked:40};
// 流れを崩す1歩(速い続き=半拍以内で、同じ側のまま1.6レーンより大きく跳ぶ・真ん中をまたいで3.5レーンより大きく跳ぶ・同じ所の叩き直し)を数える。
//   数え方は rhythm-chart-flow-report.js の flowStats と同じ。公開前の仕上げで、交差を消す代わりに跳びを増やさないために点数へ足す(flowWeight)
const flowBreaks=(list,beat)=>{const g=[];for(const n of list.slice().sort((a,b)=>startOf(a)-startOf(b))){const t=startOf(n),c=xOf(n),l=g[g.length-1];if(l&&t-l.t<5){l.sum+=c;l.count++;}else g.push({t,sum:c,count:1});}
  let jump=0,jack=0;for(let i=1;i<g.length;i++){const a=g[i-1],b=g[i];if(b.t-a.t>beat*.5+2)continue;const ca=a.sum/a.count,cb=b.sum/b.count,d=Math.abs(cb-ca);
    if(d<.25)jack++;else if(d>1.6&&!((ca<3.5)!==(cb<3.5)&&d<=3.5))jump++;}
  return {jump,jack};};
const score=(list,prof,beat,flowWeight=0)=>{const rt=toRuntime(list),fb=flowWeight?flowBreaks(list,beat):null;
  return (fb?(fb.jump+fb.jack*.5)*flowWeight:0)+thumbCheck(list.slice().sort((a,b)=>startOf(a)-startOf(b)),prof,beat).issues.reduce((a,i)=>a+W[i.kind],0)
    +HR.samePlace(rt).reduce((a,x)=>a+(SP_W[x.kind]||0),0)
    +HR.heldBandBlocked(rt).length*MUST_W+HR.flatCross(rt).length*100+HR.fastSameSide(rt).length*30
    +simulateRuntime(rt.filter(n=>!(n.skyHeight>0))).impossible*MUST_W;};
const counts=(list,prof,beat)=>{const c={cross:0,reach:0,busy:0,impossible:0};for(const i of thumbCheck(list.slice().sort((a,b)=>startOf(a)-startOf(b)),prof,beat).issues)c[i.kind]++;
  const rt=toRuntime(list),sp={};for(const x of HR.samePlace(rt))sp[x.kind]=(sp[x.kind]||0)+1;
  return {同じ側の速い押し始め:HR.fastSameSide(rt).length,交差:c.cross,真ん中越え:c.reach,忙しい:c.busy,押せない:c.impossible,真ん中で入れ替わり:sp.centerSwap||0,帯のすぐ横:sp.beside||0,隣り合う同時押し:sp.chord||0,帯の中:HR.heldBandBlocked(rt).length};};
// 並べ直す本体。直した数を返す
// kinds … 直す対象の親指の物差しの種類(null なら全部=今までどおり)。keepRanges … 交差・真ん中越えを見せ場として残す区間 [[始め,終わり]…](押せないはここでも直す)
// heldBand … 押さえている帯の中のノーツも対象にする(公開前の書き出しの仕上げで使う)
const flowFix=(notes,{prof=THUMB_PROFILES.landscape,beat,kinds=null,keepRanges=[],heldBand=false,flowWeight=0})=>{
  const kept=t=>keepRanges.some(([a,b])=>t>=a&&t<b);
  const local=(t,swap,v)=>notes.filter(n=>endOf(n)>=t-3000&&startOf(n)<=t+3000).map(n=>n===swap?v:n);
  const tried=new Set();let moved=0;
  const targets=()=>{const rt=toRuntime(notes);
    const th=thumbCheck(notes.slice().sort((a,b)=>startOf(a)-startOf(b)),prof,beat).issues.filter(i=>i.kind!=='busy'&&(!kinds||kinds.has(i.kind))&&!(i.kind!=='impossible'&&kept(i.t))).map(i=>({t:i.t,x:i.x,key:`${Math.round(i.t)}|${i.kind}|${i.what}`}));
    const sp=kinds?[]:HR.samePlace(rt).filter(x=>SP_W[x.kind]&&!kept(x.at)).map(x=>({t:x.at,x:null,key:`${Math.round(x.at)}|${x.kind}`}));
    const fs1=kinds?[]:HR.fastSameSide(rt).filter(x=>!kept(x.at)).map(x=>({t:x.at,x:null,key:`${Math.round(x.at)}|fast`}));
    const hb=heldBand?HR.heldBandBlocked(rt).map(x=>({t:x.at,x:null,key:`${Math.round(x.at)}|held`})):[];
    return [...th,...sp,...fs1,...hb].filter(x=>!tried.has(x.key)).sort((a,b)=>a.t-b.t);};
  for(let r=0;r<5000;r++){const list=targets();if(!list.length)break;const i0=list[0];tried.add(i0.key);
    const at=n=>Math.abs(startOf(n)-i0.t)<=5;
    const cands=[...notes.filter(at).sort((a,b)=>i0.x==null?0:Math.abs(xOf(a)-i0.x)-Math.abs(xOf(b)-i0.x)),
      ...notes.filter(n=>!at(n)&&startOf(n)<i0.t&&startOf(n)>=i0.t-beat*1.5).sort((a,b)=>startOf(b)-startOf(a))].filter(n=>n.k==='t'||n.k==='f');
    // モンスターノーツは動かさない。ただし「押さえている帯の中」だけは、ほかのノーツで直せなかったときの最後にモンスターノーツも動かす
    //   (Rev.38: 帯の中に置かれたモンスターノーツが直せずに残った。Rebellion short EXPERT 28.3秒)
    const must=/\|held$/.test(i0.key);
    cands.sort((a,b)=>(a.mon?1:0)-(b.mon?1:0));
    for(const n of cands){if(n.mon&&!must)continue;const t=startOf(n),base=score(local(t,null),prof,beat,flowWeight);let best=null;
      for(let sub=0;sub+n.w<=12;sub++){if(sub===n.sub)continue;const v={...n,sub};const sc=score(local(t,n,v),prof,beat,flowWeight);if(sc<base&&(!best||sc<best.sc))best={sc,sub};}
      if(best){n.sub=best.sub;moved++;break;}}}
  return moved;};

// ── 公開前の書き出し(authoring・作業フォルダ)の仕上げ(2026-11-11・MHB CHART ENGINE Rev.37) ──────────────────
//   node tools/mode/rhythm-chart-flow-fix.js --track <曲> [--dir <場所>] [--difficulty EXPERT,MASTER] [--mode must|keep-climax|smooth] [--write]
// <曲>-v3-fixed-<難易度>.json(自動修正後)のタップ・フリックの位置だけを動かす。時刻・種類・幅・ノーツ数は変えない。ゲームのデータ(rhythm-mode.js)は読まない・書かない。
//   must        … 横持ちの親指で「押せない」所と、押さえている帯の中のノーツだけを直す(交差はそのまま)
//   keep-climax … must に加えて、交差・真ん中越え・左右の入れ替わりなど「いやらしい形」を減らす。いちばん盛り上がる区切りの分は見せ場として残す
//   smooth      … keep-climax と同じだが、盛り上がる区切りの分も減らす(Rebellion の MASTER を直したときと同じ)
// 既定(2026-11-11 社長の決定 A): EXPERT・MASTER は keep-climax(交差・真ん中越えを減らし、いちばん盛り上がる区切りの交差は見せ場として残す)、EASY〜HARD は must。
//   曲の一覧(rhythm-song-registry.json)の handFinish に書けば全難易度その値(「交差はありでいい・普通に作って」と言われた曲は 'must')。--mode が優先
//   handFinish は難易度ごとにも書ける({EASY:'smooth',NORMAL:'smooth',HARD:'smooth'}。書いていない難易度は既定)。2026-11-11 公開中の譜面の作り直しで、
//   下の難易度の交差・届きにくいを跳びを増やさずに減らすため(フメン3)
const FINISH_MODES=['must','keep-climax','smooth'];
const FINISH_FLOW_WEIGHT=30;
// 山場(交差を見せ場として残す区切り)。Rev.38 から: サビ(rhythm-chart-chorus.js)のうち、盛り上がりが山の85%以上の区切り。
//   大きいだけの間奏は山場にしない。サビが見つからない曲は今までどおり、盛り上がりが山の85%以上の区切り
const climaxRanges=(audio,layers=null)=>{const secs=(audio.structure&&audio.structure.sections)||[],max=Math.max(0,...secs.map(s=>Number(s.intensity)||0));
  if(!(max>0))return [];
  const chorus=require('./rhythm-chart-chorus.js').chorusScores(audio,layers);
  if(chorus.hasChorus){const kept=chorus.chorus.filter(s=>s.parts.energy>=.85).map(s=>[s.startMs,s.endMs]);if(kept.length)return kept;}
  return secs.filter(s=>s.intensity>=max*.85).map(s=>[s.startMs,s.endMs]);};
const DEFAULT_FINISH={EXPERT:'keep-climax',MASTER:'keep-climax'};
const finishAuthoring=(track,{dir=null,difficulties=['EASY','NORMAL','HARD','EXPERT','MASTER'],mode:modeArg=null,write=false}={})=>{
  const modeMap=modeArg&&typeof modeArg==='object'?modeArg:null;
  if(modeArg&&!modeMap&&!FINISH_MODES.includes(modeArg))throw new Error(`--mode は ${FINISH_MODES.join(' / ')}`);
  if(modeMap&&Object.values(modeMap).some(m=>!FINISH_MODES.includes(m)))throw new Error(`handFinish の値は ${FINISH_MODES.join(' / ')}`);
  const {toRuntimeChart}=require('./rhythm-chart-review.js'),{assignSideFlickDirs}=require('./rhythm-side-flick.js');
  const dashed=track.replace(/_/g,'-'),base=dir||path.join(__dirname,'authoring');
  const {audio,layers}=require('./rhythm-chart-chorus.js').loadForTrack(track),beat=audio.timing.beatMs,out=[];
  for(const d of difficulties){const file=path.join(base,`${dashed}-v3-fixed-${d.toLowerCase()}.json`);if(!fs.existsSync(file))continue;
    const mode=(modeMap?modeMap[d]:modeArg)||DEFAULT_FINISH[d]||'must';
    const chart=JSON.parse(fs.readFileSync(file,'utf8')),notes=fromRuntime(toRuntimeChart(chart,audio).notes);
    const before=counts(notes,THUMB_PROFILES.landscape,beat);
    const moved=flowFix(notes,{beat,heldBand:true,flowWeight:mode==='must'?0:FINISH_FLOW_WEIGHT,kinds:mode==='must'?new Set(['impossible']):null,keepRanges:mode==='keep-climax'?climaxRanges(audio,layers):[]});
    const after=counts(notes,THUMB_PROFILES.landscape,beat);
    if(moved){for(const n of notes){if(!(n.k==='t'||n.k==='f'))continue;const a=n.src.src;if(a.subLane!==n.sub){a.subLane=n.sub;a.lane=Math.floor(n.sub/2);}}
      // 位置を動かしたので、横フリックの向きを付け直す(自動修正と同じ決め方・MASTER だけ向きを持つ)
      if(d==='MASTER')assignSideFlickDirs(chart.notes,audio.timing);
      if(write){chart.handFinish={mode,moved};fs.writeFileSync(file,JSON.stringify(chart,null,1)+'\n');}}
    out.push({difficulty:d,mode,notes:notes.length,moved,before,after,file});}
  return out;};

if(require.main===module&&argOf('--track')){
  const track=argOf('--track'),write=args.includes('--write');
  const entry=(JSON.parse(fs.readFileSync(path.join(__dirname,'authoring','rhythm-song-registry.json'),'utf8')).songs||{})[track]||{};
  const mode=argOf('--mode')||(FINISH_MODES.includes(entry.handFinish)||(entry.handFinish&&typeof entry.handFinish==='object')?entry.handFinish:null);
  // 帯の中の決まりより前からある曲は、作り直しても今の形のまま(生成器・自動修正と同じ一覧)。確かめたいときは --mode を付ける
  if(!argOf('--mode')&&(JSON.parse(fs.readFileSync(path.join(__dirname,'rhythm-held-band-existing.json'),'utf8')).tracks||[]).includes(track)){console.log('手の仕上げ: 前からある曲なので何もしない(--mode を付ければ試せる)');process.exit(0);}
  const res=finishAuthoring(track,{dir:argOf('--dir'),mode,write,...(argOf('--difficulty')?{difficulties:argOf('--difficulty').split(',').map(x=>x.trim().toUpperCase())}:{})});
  console.log(`手の仕上げ(${mode?(typeof mode==='object'?JSON.stringify(mode):mode):'既定: EXPERT・MASTER は keep-climax / ほかは must'})${write?'':'・書かない(--write で書く)'}`);
  for(const r of res){const ch=Object.keys(r.before).filter(k=>r.before[k]!==r.after[k]).map(k=>`${k} ${r.before[k]}→${r.after[k]}`);
    console.log(`  ${r.difficulty.padEnd(7)} ${r.mode.padEnd(11)} ${r.notes}ノーツ・動かした ${r.moved}か所${ch.length?'  '+ch.join(' / '):''}`);}
}else if(require.main===module){
  const songId=argOf('--song'),difficulty=String(argOf('--difficulty')||'').toUpperCase(),write=args.includes('--write');
  const marker=RELEASED_MARKERS[songId];
  if(!songId||!marker)throw new Error('--song は rhythm-runtime-notes.js の RELEASED_MARKERS にある曲');
  if(!['EASY','NORMAL','HARD','EXPERT','MASTER'].includes(difficulty))throw new Error('--difficulty は EASY〜MASTER(HELL は rhythm-hell-mix.js の uncross)');
  const source=fs.readFileSync(RUNTIME,'utf8');
  const ctx={Object,Number,Math,JSON,Array,String,Date,__MH_RHYTHM_CHART_SWITCH:null};vm.runInNewContext(source+'\nthis.S=RHYTHM_SONGS;this.B=RHYTHM_SONG_BEATS;',ctx);
  const song=ctx.S.find(s=>s.songId===songId);const beat=Number((ctx.B[songId]||[])[0]);
  if(!song||!Number.isFinite(beat))throw new Error(`${songId} の譜面か拍の表が無い`);
  const notes=fromRuntime(song.difficulties[difficulty].notes.map(n=>({...n})));
  const before=counts(notes,THUMB_PROFILES.landscape,beat);
  const orig=new Map(notes.map(n=>[n,n.sub]));
  // --mode must(2026-11-11 フメン3): 公開中の譜面でも「押せない」所だけを位置で直す(交差・届きにくいは動かさない)。
  //   参考動画から作った譜面(Sheriruth)を作り直さずに直すため。付けなければ今までどおり全部減らす形
  const songMode=argOf('--mode');
  if(songMode&&songMode!=='must')throw new Error('--song で使える --mode は must だけ');
  const moved=flowFix(notes,songMode==='must'?{beat,flowWeight:0,kinds:new Set(['impossible'])}:{beat});
  const after=counts(notes,THUMB_PROFILES.landscape,beat);
  console.log(`${songId}/${difficulty}${songMode?`(${songMode})`:''} ノーツ ${notes.length} ・ 動かした ${moved}か所`);
  for(const k of Object.keys(before))console.log(`  ${k} ${before[k]} → ${after[k]}`);
  if(write&&moved){
    const name=`${marker}-${difficulty.toLowerCase()}`,open=`// <${name}-notes>`,close=`// </${name}-notes>`,a=source.indexOf(open),b=source.indexOf(close);
    if(a<0||b<0)throw new Error(`目印 ${name} が無い`);
    let body=source.slice(a+open.length,b);
    for(const n of notes){const o=orig.get(n);if(o===n.sub||!(n.k==='t'||n.k==='f'))continue;
      const call=n.k;const k=tokensOf(body).find(x=>x.call===call&&x.a[0]===n.t&&x.a[1]===o&&x.a[2]===n.w);
      if(!k)throw new Error(`${n.t} の ${call}(${o}) が目印の中に見つからない`);
      const text=body.slice(k.from,k.to);body=body.slice(0,k.from)+text.replace(new RegExp(`^${call}\\(${n.t},${o},${n.w}(?=[,)])`),`${call}(${n.t},${n.sub},${n.w}`)+body.slice(k.to);}
    const next=source.slice(0,a+open.length)+body+source.slice(b);
    const names=t=>[...t.matchAll(/\/\/ <([a-z0-9-]+)-notes>/g)].map(m=>m[1]).filter(x=>x!==name);
    const rt0=require('./rhythm-runtime-notes.js');
    const bad=names(source).filter(x=>(rt0.markerBlock(source,x)||{}).body!==(rt0.markerBlock(next,x)||{}).body);
    if(bad.length)throw new Error(`ほかの目印まで変わりそうなので止めた: ${bad.join(' ')}`);
    fs.writeFileSync(RUNTIME,next);console.log(`書いた: ${name} の目印の内側だけ(Lv. は rhythm-chart-level.js --write で)`);}
}
module.exports={flowFix,fromRuntime,toRuntime,counts,finishAuthoring,climaxRanges,FINISH_MODES,DEFAULT_FINISH};
