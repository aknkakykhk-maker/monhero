#!/usr/bin/env node
// 公開中の HELL から「見分けにくい所」(rhythm-chart-hand-rules.js の skyConfusable)を、今の譜面をできるだけ残したまま0件にする(2026-10-21)。
// 社長「古い HELL 4曲も見分けにくい所を0件に直して」「作り直しより小さい直しを優先」。
//
//   node tools/mode/rhythm-hell-confuse-fix.js --song sheriruth            # 何をするかだけ出す(書かない)
//   node tools/mode/rhythm-hell-confuse-fix.js --song sheriruth --write    # 目印の内側を書き換える(Lv. は書かない)
//
// 直し方(1か所ずつ・作る道具 rhythm-hell-mix.js と同じ順):
//   ① 組の中の空中のタップ(モンスターノーツ以外)を地上へ下ろす   T(時刻,位置,幅,1) → t(時刻,位置,幅,0)
//   ② 下ろせなければ、相手の地上のタップ・フリック(モンスターノーツ以外)を抜く
//   ③ どちらも長押しなら、地上で始まる長押し(ホールド・スライド)を抜く
// 数えるのは**ゲームに読み込んだ形**(rhythm-mode.js をそのまま動かした譜面)。書いたあとと同じ形で0件まで直す。
// 直したあと、押せない所(横持ちの物差し)・水平クロス・帯の中・モンスターノーツの数が、直す前より増えていないことを確かめ、増えたら書かずに止まる。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const HR=require('./rhythm-chart-hand-rules.js');
const {thumbCheck}=require('./rhythm-ref-tiers.js');
const {HELL_LANDSCAPE}=require('./rhythm-hell-mix.js');
const ROOT=path.resolve(__dirname,'..','..'),RUNTIME=path.join(ROOT,'monster-hero/data/rhythm-mode.js');
const args=process.argv.slice(2),argOf=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null;};

// 曲 → 目印の名前・HELL の譜面のある枠(試作の枠の songId と段)・1拍の長さ(横持ちの物差しに渡す)
const SONGS=Object.freeze({
  sheriruth:{marker:'sheriruth-v3-hell',slot:['sheriruth_hell_debug','HELL'],beat:324.342},
  grievous_lady:{marker:'grievous-lady-hell',slot:['grievous_lady_hell','MASTER'],beat:60000/210},
  against_my_own_shadow:{marker:'against-my-own-shadow-v3-hell',slot:['against_my_own_shadow_hell_debug','HELL'],beat:419.1788},
  kaze_ga_soyogu:{marker:'kaze-ga-soyogu-v4-hell',slot:['kaze_ga_soyogu_hell_debug','HELL'],beat:60000/118.88},
  // 2026-10-21 量を0.78倍にして作り直したら1件だけ残った(社長「ざしてぃを60ぐらいまで下げる」)
  the_city_beneath_the_comets:{marker:'the-city-beneath-the-comets-v3-hell',slot:['the_city_beneath_the_comets_hell_debug','HELL'],beat:351.976},
});

// rhythm-chart-level.js の loadRuntimeSongs と同じ読み方を、手元の文字列に使う
const loadChart=(source,[songId,diff])=>{
  const context={Object,Number,Math,JSON,Array,String,Date,__MH_RHYTHM_CHART_SWITCH:null};
  vm.runInNewContext(`${source}\nthis.out=typeof RHYTHM_PROTO_SONGS!=='undefined'?RHYTHM_PROTO_SONGS:[];`,context);
  const s=context.out.find(x=>x.songId===songId);
  return s&&s.difficulties&&s.difficulties[diff]||null;
};
// 目印の内側を、上の段の呼び出し(t( h( f( s( T( F( S())ごとに切り分ける
const tokensOf=body=>{const out=[];let i=0;
  while(i<body.length){const m=/[thfsTFS]\(/.exec(body.slice(i));if(!m)break;const at=i+m.index;let depth=0,j=at+1;
    for(;j<body.length;j++){const c=body[j];if(c==='('||c==='[')depth++;else if(c===')'||c===']'){depth--;if(depth===0&&c===')')break;}}
    const text=body.slice(at,j+1),call=text[0],a=JSON.parse(`[${text.slice(2,-1).replace(/'/g,'"')}]`);
    out.push({from:at,to:j+1,call,a});i=j+1;}
  return out;};
// 横持ちの物差し(thumbCheck)へ渡す形
const internalOf=notes=>notes.map(n=>n.type==='SLIDE'?{k:'s',hand:n.hand||null,pts:(n.slidePoints||[]).map(p=>[p.timeMs,p.lane,p.subLaneWidth??2,p.sky||0,0])}
  :n.type==='HOLD'?{k:'h',t:n.timeMs,sub:n.subLane,w:n.subLaneWidth,end:n.endTimeMs,sky:0}
  :n.type==='FLICK'?{k:'f',t:n.timeMs,sub:n.subLane,w:n.subLaneWidth,args:[n.timeMs,n.subLane,n.subLaneWidth],sky:n.skyHeight>0?1:0}
  :{k:'t',t:n.timeMs,sub:n.subLane,w:n.subLaneWidth,sky:n.skyHeight>0?1:0,...(n.monsterSlot?{mon:n.monsterSlot}:{})});
const measure=(notes,beat)=>{const th=thumbCheck(internalOf(notes),HELL_LANDSCAPE,beat);
  return {confuse:HR.skyConfusable(notes).length,impossible:th.issues.filter(i=>i.kind==='impossible').length,flat:HR.flatCross(notes).length,
    band:HR.heldBandBlocked(notes).length,monsters:notes.filter(n=>n.monsterSlot).length,notes:notes.length};};

// 組の1か所を直す手を選ぶ(どのトークンをどう変えるか)。見つからなければ null
const pickFix=(v,tokens)=>{
  const tapTok=(n,sky)=>tokens.find(k=>(sky?k.call==='T':k.call==='t')&&k.a[0]===n.timeMs&&k.a[1]===n.subLane);
  for(const x of [v.note,v.prev])if(x.type==='TAP'&&x.skyHeight>0&&!x.monsterSlot){const k=tapTok(x,true);if(k)return {k,how:'下ろす'};}
  for(const x of [v.note,v.prev])if(!(x.skyHeight>0)&&!x.monsterSlot&&(x.type==='TAP'||x.type==='FLICK')){
    const k=x.type==='TAP'?tapTok(x,false):tokens.find(t=>t.call==='f'&&t.a[0]===x.timeMs&&t.a[1]===x.subLane);if(k)return {k,how:'抜く'};}
  for(const x of [v.note,v.prev]){if(x.skyHeight>0)continue;
    if(x.type==='HOLD'){const k=tokens.find(t=>t.call==='h'&&t.a[0]===x.timeMs&&t.a[1]===x.subLane);if(k)return {k,how:'抜く'};}
    if(x.type==='SLIDE'&&x.slidePoints&&x.slidePoints[0]&&!(x.slidePoints[0].sky>=.5)){
      const k=tokens.find(t=>(t.call==='s'||t.call==='S')&&t.a[0]===x.timeMs&&Array.isArray(t.a[2])&&t.a[2][0]&&Math.abs(t.a[2][0][1]-x.slidePoints[0].lane)<.01&&!(t.a[2][0][3]>=.5));
      if(k)return {k,how:'抜く'};}}
  return null;};

if(require.main===module){
  const songId=argOf('--song'),conf=SONGS[songId];
  if(!conf){console.error(`--song は ${Object.keys(SONGS).join(' / ')} のどれか`);process.exit(1);}
  const original=fs.readFileSync(RUNTIME,'utf8');
  const open=`// <${conf.marker}-notes>`,close=`// </${conf.marker}-notes>`;
  const a=original.indexOf(open),b=original.indexOf(close);
  if(a<0||b<0){console.error(`目印 ${open} が見つからない`);process.exit(1);}
  let body=original.slice(a+open.length,b);
  const sourceWith=bd=>original.slice(0,a+open.length)+bd+original.slice(b);
  const before=measure(loadChart(original,conf.slot).notes,conf.beat);
  const log=[];
  for(let round=0;round<400;round++){
    const notes=loadChart(sourceWith(body),conf.slot).notes,cf=HR.skyConfusable(notes);if(!cf.length)break;
    const tokens=tokensOf(body);let fix=null;for(const v of cf){fix=pickFix(v,tokens);if(fix)break;}
    if(!fix){console.error(`直せない見分けにくい所が残った: ${cf.map(v=>(v.at/1000).toFixed(2)+'秒').join(' ')}`);process.exit(1);}
    const k=fix.k,text=body.slice(k.from,k.to);
    const next=fix.how==='下ろす'?`t(${k.a[0]},${k.a[1]},${k.a[2]},0)`:'';
    log.push(`${(k.a[0]/1000).toFixed(2)}秒 ${fix.how} ${text.slice(0,40)}`);
    // 抜くときは後ろの区切りのカンマも一緒に消す(配列の中の空きを作らない)
    body=fix.how==='下ろす'?body.slice(0,k.from)+next+body.slice(k.to):body.slice(0,k.from)+body.slice(body[k.to]===','?k.to+1:k.to);}
  const after=measure(loadChart(sourceWith(body),conf.slot).notes,conf.beat);
  console.log(`${songId}: 直した ${log.length}か所(下ろす ${log.filter(l=>l.includes('下ろす')).length}・抜く ${log.filter(l=>l.includes('抜く')).length})`);
  console.log(`  前: 見分けにくい ${before.confuse}・押せない ${before.impossible}・水平クロス ${before.flat}・帯の中 ${before.band}・モンスター ${before.monsters}・ノーツ ${before.notes}`);
  console.log(`  後: 見分けにくい ${after.confuse}・押せない ${after.impossible}・水平クロス ${after.flat}・帯の中 ${after.band}・モンスター ${after.monsters}・ノーツ ${after.notes}`);
  if(args.includes('--verbose'))for(const l of log)console.log('   ',l);
  const worse=after.confuse>0||after.impossible>before.impossible||after.flat>before.flat||after.band>before.band||after.monsters!==before.monsters;
  if(worse){console.error('止まった: 直したあとに数が増えた(または見分けにくい所が残った)ので書かない');process.exit(1);}
  if(!args.includes('--write')){console.log('※ --write を付けると目印の内側だけを書く(Lv. は書かない。rhythm-chart-level.js の固定値は手で外す)');process.exit(0);}
  fs.writeFileSync(RUNTIME,sourceWith(body));
  console.log(`書いた: ${path.relative(ROOT,RUNTIME)} の <${conf.marker}-notes> だけ。この後 node tools/build.js`);
}
module.exports={SONGS,tokensOf,pickFix,measure,loadChart};
