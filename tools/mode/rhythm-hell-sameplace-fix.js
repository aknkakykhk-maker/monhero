#!/usr/bin/env node
// 公開中の HELL から「指が同じ位置に来る形」のうち空中が絡む2つ(rhythm-chart-hand-rules.js の samePlace の skyPath・stacked)を、
// Lv. ごとの許す数まで減らす(2026-10-22)。今の譜面をできるだけ残したまま、時刻と幅はそのままで横へずらす・抜く。
// 社長「指が同じ位置くるやつが多い」「空中がないやつはそういうシビア差の譜面で良いけど空中入り交じるとまじで厳しいから
//      なんでもかんでもそういうのいれないで。高難易度ならまだしも」
//
//   node tools/mode/rhythm-hell-sameplace-fix.js --all                 # 全 HELL で何をするかだけ出す(書かない)
//   node tools/mode/rhythm-hell-sameplace-fix.js --song kiki_issen     # 1曲(書かない・--verbose で1か所ずつ)
//   node tools/mode/rhythm-hell-sameplace-fix.js --song kiki_issen --write   # 目印の内側を書き換える(Lv. は書かない)
//
// 許す数(SAME_PLACE_ALLOW): HELL の Lv. が 45未満 0・45〜54 2・55〜64 4・65以上 6。残すのは曲の盛り上がる区間(RHYTHM_SONG_CLIMAX)の中から。
// 直し方(1か所ずつ): ① 動かすノーツ(長押しでないほう・モンスターのノーツは動かさない)を、時刻と幅はそのまま、近い順に2レーンまで横へずらす
//                    ② 空中のタップは同じ位置のまま地上へ下ろす(数を減らさない)
//                    ③ どれもできなければ抜く(タップ・フリック)
// ずらした先・抜いたあとで、押せない所(横持ちの物差し)・帯の中・見分けにくい所・水平クロスが1つでも増えたら、その手は使わない。
// 空中の無い譜面・地上どうしの型(すぐ横・同時押し・真ん中)は対象にしない(社長「空中がないやつはそういうシビア差の譜面で良い」)。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const HR=require('./rhythm-chart-hand-rules.js');
const {thumbCheck}=require('./rhythm-ref-tiers.js');
const {HELL_LANDSCAPE}=require('./rhythm-hell-mix.js');
const {tokensOf}=require('./rhythm-hell-confuse-fix.js');
const ROOT=path.resolve(__dirname,'..','..'),RUNTIME=path.join(ROOT,'monster-hero/data/rhythm-mode.js');
const args=process.argv.slice(2),argOf=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null;};
const SKY_KINDS=['skyPath','stacked'];
const SAME_PLACE_ALLOW=lv=>lv>=65?6:lv>=55?4:lv>=45?2:0;
const LANES=12,MAX_SHIFT=4;   // 横へずらすのは2レーン(半レーン4つ)まで。それより遠くは流れを崩すので抜く

const runtime=src=>{const c={Object,Number,Math,JSON,Array,String,Date,__MH_RHYTHM_CHART_SWITCH:null};
  vm.runInNewContext(`${src}\nthis.o={H:RHYTHM_HELL_CHARTS,B:RHYTHM_SONG_BEATS,C:typeof RHYTHM_SONG_CLIMAX!=='undefined'?RHYTHM_SONG_CLIMAX:{}};`,c);return c.o;};
// 曲 → HELL の目印(RHYTHM_HELL_CHARTS の変数名 → その Notes の入れ物の目印)
// 数字で始まる曲(4u_hitasura)は鍵が引用符つき('4u_hitasura':)なので、引用符があっても見つける
const markerOf=(src,id)=>{const m=new RegExp(`[{,]['"]?${id}['"]?:(\\w+)HellChart[,}]`).exec(src);if(!m)return null;
  // 演出の間を外す曲(grievous_lady)は、本体が …HellBaseNotes にある(…HellNotes はそれを通した結果)
  for(const name of [`${m[1]}HellNotes`,`${m[1]}HellBaseNotes`]){const at=src.indexOf(`const ${name}=`);if(at<0)continue;
    const mk=/\/\/ <([\w-]+)-notes>/.exec(src.slice(at,at+400));if(mk)return mk[1];}
  return null;};
const internalOf=notes=>notes.map(n=>n.type==='SLIDE'?{k:'s',hand:n.hand||null,pts:(n.slidePoints||[]).map(p=>[p.timeMs,p.lane,p.subLaneWidth??2,p.sky||0,0])}
  :n.type==='HOLD'?{k:'h',t:n.timeMs,sub:n.subLane,w:n.subLaneWidth,end:n.endTimeMs,sky:0}
  :n.type==='FLICK'?{k:'f',t:n.timeMs,sub:n.subLane,w:n.subLaneWidth,args:[n.timeMs,n.subLane,n.subLaneWidth],sky:n.skyHeight>0?1:0}
  :{k:'t',t:n.timeMs,sub:n.subLane,w:n.subLaneWidth,sky:n.skyHeight>0?1:0,...(n.monsterSlot?{mon:n.monsterSlot}:{})});
const guards=(notes,beat)=>({impossible:thumbCheck(internalOf(notes),HELL_LANDSCAPE,beat).issues.filter(i=>i.kind==='impossible').length,
  band:HR.heldBandBlocked(notes).length,confuse:HR.skyConfusable(notes).length,flat:HR.flatCross(notes).length});
const worse=(a,b)=>b.impossible>a.impossible||b.band>a.band||b.confuse>a.confuse||b.flat>a.flat;
const skyHits=notes=>HR.samePlace(notes).filter(x=>SKY_KINDS.includes(x.kind));
const inClimax=(t,cl)=>(cl||[]).some(([a,b])=>t>=a&&t<=b);
// ずらす先が空いているか(2026-10-22 窓口: Journey HELL 154.725秒で、同時の空中タップと重なる所へずらし、真ん中を押すと取れなくなった)。
//   同時のノーツ(高さを問わない)と横に重ならない・同じ高さで押さえている帯(長押しの最中)と重ならない所だけを候補にする
const SAME_TIME_MS=2,EPS=1e-6;
const freeAt=(notes,n,sub,w)=>{const a=sub/2,b=(sub+w)/2,t=n.timeMs,lv=HR.levelAt(n,t);
  for(const m of notes){if(m===n)continue;
    const same=Math.abs(m.timeMs-t)<=SAME_TIME_MS,held=(m.type==='HOLD'||m.type==='SLIDE')&&m.timeMs<t-SAME_TIME_MS&&t<Number(m.endTimeMs)-SAME_TIME_MS&&HR.levelAt(m,t)===lv;
    if(!same&&!held)continue;const [m0,m1]=HR.spanAt(m,t);if(Math.min(b,m1)-Math.max(a,m0)>EPS)return false;}
  return true;};

// 1曲ぶん: ゲームの形のノーツをその場で直し、どのノーツをどうしたかを返す
const planSong=(notes,{level,beat,climax})=>{
  const allow=SAME_PLACE_ALLOW(level),before=skyHits(notes).length,g0=guards(notes,beat),log=[],stuck=new Set();
  for(let round=0;round<300;round++){
    const hits=skyHits(notes);
    // 許す数: 盛り上がる区間の中のものから残す
    const keep=new Set([...hits.filter(h=>inClimax(h.at,climax)),...hits.filter(h=>!inClimax(h.at,climax))].slice(0,allow));
    const over=hits.filter(h=>!keep.has(h));if(!over.length)break;
    const h=over.find(x=>{const m=x.note.type==='HOLD'||x.note.type==='SLIDE'?x.heldNote:x.note;return !stuck.has(m);});if(!h)break;
    // 動かすのは長押しでないほう(通り道・真上真下はふつう叩くノーツのほう)
    const n=(h.note.type==='HOLD'||h.note.type==='SLIDE')?h.heldNote:h.note;
    if(!n||n.type==='HOLD'||n.type==='SLIDE'||n.monsterSlot){stuck.add(n);continue;}
    const count0=skyHits(notes).length,sub0=n.subLane,w=Number(n.subLaneWidth)||2;let done=false;
    const cands=[];for(let s=0;s+w<=LANES;s++)if(s!==sub0&&Math.abs(s-sub0)<=MAX_SHIFT)cands.push(s);cands.sort((a,b)=>Math.abs(a-sub0)-Math.abs(b-sub0));
    for(const s of cands){if(!freeAt(notes,n,s,w))continue;n.subLane=s;n.lane=Math.floor(s/2);
      const still=skyHits(notes).some(x=>x.note===n||x.heldNote===n),cnt=skyHits(notes).length;
      if(!still&&cnt<count0&&!worse(g0,guards(notes,beat))){log.push({at:n.timeMs,how:'ずらす',from:sub0,to:s,w,sky:n.skyHeight>0,type:n.type});done=true;break;}}
    if(done)continue;n.subLane=sub0;n.lane=Math.floor(sub0/2);
    // ② 空中のタップは、同じ位置のまま地上へ下ろす(ノーツの数を減らさない)
    if(n.type==='TAP'&&n.skyHeight>0){const sh=n.skyHeight;n.skyHeight=0;
      if(skyHits(notes).length<count0&&!worse(g0,guards(notes,beat))){log.push({at:n.timeMs,how:'下ろす',from:sub0,w,sky:true,type:n.type});continue;}
      n.skyHeight=sh;}
    const i=notes.indexOf(n);notes.splice(i,1);
    if(skyHits(notes).length<count0&&!worse(g0,guards(notes,beat))){log.push({at:n.timeMs,how:'抜く',from:sub0,w,sky:n.skyHeight>0,type:n.type});continue;}
    notes.splice(i,0,n);stuck.add(n);}
  return {allow,before,after:skyHits(notes).length,log,g0,g1:guards(notes,beat)};};

// 目印の内側のトークンへ、決めた直しを当てる(時刻・高さ・元の位置で探す)
const applyLog=(body,log)=>{let out=body;
  for(const e of log){const toks=tokensOf(out);const call=e.type==='FLICK'?(e.sky?'F':'f'):(e.sky?'T':'t');
    const k=toks.find(t=>t.call===call&&t.a[0]===e.at&&t.a[1]===e.from&&t.a[2]===e.w);if(!k)throw new Error(`${(e.at/1000).toFixed(2)}秒の ${call}(${e.from}) が見つからない`);
    const text=out.slice(k.from,k.to);
    if(e.how==='ずらす')out=out.slice(0,k.from)+text.replace(`${call}(${e.at},${e.from},`,`${call}(${e.at},${e.to},`)+out.slice(k.to);
    else if(e.how==='下ろす')out=out.slice(0,k.from)+`t(${e.at},${e.from},${e.w},0)`+out.slice(k.to);
    else out=out.slice(0,k.from)+out.slice(out[k.to]===','?k.to+1:k.to);}
  return out;};

// 全曲(または ids)の直す案を作る。write なら目印の内側を書いた文字を返す
const planAll=({ids=null,write=false,verbose=false}={})=>{
  const src=fs.readFileSync(RUNTIME,'utf8'),rt=runtime(src),LV=require('./rhythm-chart-level.js');
  const list=ids||Object.keys(rt.H);const rows=[];let text=src;
  for(const id of list){const ch=rt.H[id];if(!ch)throw new Error(`${id} の HELL が無い`);const notes=ch.notes.map(n=>({...n}));const beat=(rt.B[id]||[500])[0];
    const r=planSong(notes,{level:ch.level,beat,climax:rt.C[id]});
    // 直したあとの Lv.(測った値。公開中の HELL の表示は LEVEL_OVERRIDES の値のままなので、参考)
    const f=LV.levelFormulaFor(`${id}_hell_debug`);
    const lv0=LV.chartLevel({...ch,notes:ch.notes},{formula:f}).level,lv1=LV.chartLevel({...ch,notes},{formula:f}).level;
    rows.push({id,level:ch.level,lv0,lv1,notes0:ch.notes.length,notes1:notes.length,...r});
    if(verbose)for(const e of r.log)console.log(`  ${id} ${(e.at/1000).toFixed(2)}秒 ${e.sky?'空':'地'}${e.type} ${e.how}${e.how==='ずらす'?` ${e.from}→${e.to}`:''}`);
    if(write&&r.log.length){const mk=markerOf(text,id);if(!mk)throw new Error(`${id} の目印が見つからない`);
      const open=`// <${mk}-notes>`,close=`// </${mk}-notes>`,a=text.indexOf(open),b=text.indexOf(close);
      text=text.slice(0,a+open.length)+applyLog(text.slice(a+open.length,b),r.log)+text.slice(b);}}
  return {rows,text,runtime};};
const howCount=(r,h)=>r.log.filter(e=>e.how===h).length;

if(require.main===module){
  const all=args.includes('--all');
  const {rows,text}=planAll({ids:all?null:[argOf('--song')].filter(Boolean),write:args.includes('--write'),verbose:args.includes('--verbose')});
  for(const r of rows)console.log(`${r.id.padEnd(28)} Lv.${r.level} 許す${r.allow} 前${String(r.before).padStart(3)} → 後${String(r.after).padStart(3)}  ずらす${howCount(r,'ずらす')} 下ろす${howCount(r,'下ろす')} 抜く${howCount(r,'抜く')}  押せない${r.g0.impossible}→${r.g1.impossible}  ノーツ${r.notes0}→${r.notes1}  測ったLv.${r.lv0}→${r.lv1}`);
  const T=k=>rows.reduce((a,r)=>a+r[k],0),H=h=>rows.reduce((a,r)=>a+howCount(r,h),0);
  console.log(`計 ${rows.length}曲 前${T('before')} → 後${T('after')} / ずらす${H('ずらす')} 下ろす${H('下ろす')} 抜く${H('抜く')}`);
  if(args.includes('--write')){fs.writeFileSync(RUNTIME,text);
    // 書いたあとをゲームの形で数え直す(道具と同じになっているか)
    const rt2=runtime(text);for(const r of rows){const n=skyHits(rt2.H[r.id].notes).length;if(n!==r.after){console.error(`${r.id}: 書いたあと ${n}件(道具は ${r.after}件)`);process.exitCode=1;}}
    console.log('書いた: monster-hero/data/rhythm-mode.js の HELL の目印の内側だけ(Lv. は書かない)。この後 node tools/build.js');}
}
module.exports={SAME_PLACE_ALLOW,SKY_KINDS,planSong,planAll,skyHits,howCount};
