// 地上の譜面(MASTER など)の「いやらしい形」を、押す位置(レーン)の並べ方だけで減らす(2026-11-01 社長「指交差のいやらしい場面が多かった」・Rebellion)。
//
//   node tools/mode/rhythm-chart-flow-fix.js --song rebellion --difficulty MASTER            # 何件減るかを出すだけ(書かない)
//   node tools/mode/rhythm-chart-flow-fix.js --song rebellion --difficulty MASTER --write    # 目印の内側を書き換える
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
const W={impossible:100,cross:60,reach:40,busy:10};
const SP_W={centerSwap:40,beside:20,chord:40,skyPath:40,stacked:40};
const score=(list,prof,beat)=>{const rt=toRuntime(list);
  return thumbCheck(list.slice().sort((a,b)=>startOf(a)-startOf(b)),prof,beat).issues.reduce((a,i)=>a+W[i.kind],0)
    +HR.samePlace(rt).reduce((a,x)=>a+(SP_W[x.kind]||0),0)
    +HR.heldBandBlocked(rt).length*100+HR.flatCross(rt).length*100+HR.fastSameSide(rt).length*30
    +simulateRuntime(rt.filter(n=>!(n.skyHeight>0))).impossible*100;};
const counts=(list,prof,beat)=>{const c={cross:0,reach:0,busy:0,impossible:0};for(const i of thumbCheck(list.slice().sort((a,b)=>startOf(a)-startOf(b)),prof,beat).issues)c[i.kind]++;
  const rt=toRuntime(list),sp={};for(const x of HR.samePlace(rt))sp[x.kind]=(sp[x.kind]||0)+1;
  return {同じ側の速い押し始め:HR.fastSameSide(rt).length,交差:c.cross,真ん中越え:c.reach,忙しい:c.busy,押せない:c.impossible,真ん中で入れ替わり:sp.centerSwap||0,帯のすぐ横:sp.beside||0,隣り合う同時押し:sp.chord||0,帯の中:HR.heldBandBlocked(rt).length};};
// 並べ直す本体。直した数を返す
const flowFix=(notes,{prof=THUMB_PROFILES.landscape,beat})=>{
  const local=(t,swap,v)=>notes.filter(n=>endOf(n)>=t-3000&&startOf(n)<=t+3000).map(n=>n===swap?v:n);
  const tried=new Set();let moved=0;
  const targets=()=>{const rt=toRuntime(notes);
    const th=thumbCheck(notes.slice().sort((a,b)=>startOf(a)-startOf(b)),prof,beat).issues.filter(i=>i.kind!=='busy').map(i=>({t:i.t,x:i.x,key:`${Math.round(i.t)}|${i.kind}|${i.what}`}));
    const sp=HR.samePlace(rt).filter(x=>SP_W[x.kind]).map(x=>({t:x.at,x:null,key:`${Math.round(x.at)}|${x.kind}`}));
    const fs1=HR.fastSameSide(rt).map(x=>({t:x.at,x:null,key:`${Math.round(x.at)}|fast`}));
    return [...th,...sp,...fs1].filter(x=>!tried.has(x.key)).sort((a,b)=>a.t-b.t);};
  for(let r=0;r<5000;r++){const list=targets();if(!list.length)break;const i0=list[0];tried.add(i0.key);
    const at=n=>Math.abs(startOf(n)-i0.t)<=5;
    const cands=[...notes.filter(at).sort((a,b)=>i0.x==null?0:Math.abs(xOf(a)-i0.x)-Math.abs(xOf(b)-i0.x)),
      ...notes.filter(n=>!at(n)&&startOf(n)<i0.t&&startOf(n)>=i0.t-beat*1.5).sort((a,b)=>startOf(b)-startOf(a))].filter(n=>(n.k==='t'||n.k==='f')&&!n.mon);
    for(const n of cands){const t=startOf(n),base=score(local(t,null),prof,beat);let best=null;
      for(let sub=0;sub+n.w<=12;sub++){if(sub===n.sub)continue;const v={...n,sub};const sc=score(local(t,n,v),prof,beat);if(sc<base&&(!best||sc<best.sc))best={sc,sub};}
      if(best){n.sub=best.sub;moved++;break;}}}
  return moved;};

if(require.main===module){
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
  const moved=flowFix(notes,{beat});
  const after=counts(notes,THUMB_PROFILES.landscape,beat);
  console.log(`${songId}/${difficulty} ノーツ ${notes.length} ・ 動かした ${moved}か所`);
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
module.exports={flowFix,fromRuntime,toRuntime,counts};
