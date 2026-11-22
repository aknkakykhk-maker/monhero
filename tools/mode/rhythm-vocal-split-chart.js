#!/usr/bin/env node
// ダブルボーカルの歌い分けから MASTER・HELL を組む(2026-11-22・ビート・台帳 r1119-096 追記・r1119-105)。
//
//   node tools/mode/rhythm-vocal-split-chart.js --song beyond_the_same_sky --diff HELL [--write] [--table <md>]
//
//   入れる物:
//     区間の表   docs/progress/beat/chart-fix-2026-11-22/vocal-split/parts-table.json(声の主: 女声/男声/女声(男声の低い重ね)/2人/間奏)
//     声の拍     docs/progress/beat/chart-fix-2026-11-22/vocal-split/<song>-vocal-notes.json(tools/audio/vocal-notes.py が声だけの音源から作る)
//     伴奏の拍   tools/mode/authoring/<song>-v3-audio.json の onsets(読むだけ・作り直さない)
//   --write でその曲・その難易度のマーカーの中だけを書き換える(ほかの曲・難易度は1バイトも変えない)
//   --table で区間ごとの作り方の一覧(Markdown)を書く
//
// 【組み方】(docs/progress/beat/chart-fix-2026-11-22/vocal-split/hand-design.md)
//   ・女声=右手(右半分)・男声=左手(左半分)。歌っている側の手が言葉の頭を取り、反対の手は自分の側で伴奏の拍を取る
//   ・帯(ホールド・スライド)は歌っている側の手の側にだけ置く。反対の手はその帯の向こうへ行かない → 押さえ中の交差が出ない
//   ・同じ手の押し始めが近すぎる言葉は、反対の手が空いていればその手の内側(真ん中寄り)へ渡す(速い言葉は左右の受け渡し)
//   ・2人・ハモりは両手: 言葉の頭は左右の同時押し(鏡写し)、伸ばしは左右対称の帯
//   ・HELL の空中: サビの伸ばし(右手の空中スライド)・ハモりの言葉の頭(左右の空中の同時押し)。同じ手の地上から250ms以上あける
//   ・MASTER は空中なし・同じ手の間を HELL より広く(密度を下げる)
'use strict';
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const MODE=path.join(ROOT,'monster-hero/data/rhythm-mode.js');
const VS=path.join(ROOT,'docs/progress/beat/chart-fix-2026-11-22/vocal-split');

const SONGS={
  beyond_the_same_sky:{table:'full',audio:'beyond-the-same-sky-v3-audio.json',vocal:'beyond_the_same_sky-vocal-notes.json',marker:'beyond-the-same-sky-v3'},
  beyond_the_same_sky_short:{table:'short',audio:'beyond-the-same-sky-short-v3-audio.json',vocal:'beyond_the_same_sky_short-vocal-notes.json',marker:'beyond-the-same-sky-short-v3'},
};
// 難易度ごとの設定
//   gapMs     同じ手の押し始めの最小の間(HELL 16分2つ=168ms・MASTER 付点8分=252ms)
//   snap      言葉の頭を寄せる細かさ(グリッド=16分の数)
//   vocalMin  拾う言葉の頭の強さの下限(区間の盛り上がりで下げる)
//   beatEvery 反対の手が伴奏を取る間隔(グリッド)
//   holdMin   伸ばしを帯にする長さ(ms)
const DIFFS={
  HELL:{fun:true,funMult:1.8,skyChainEvery:3,fill:{def:2},fillMin:0.15,gapMs:160,snap:1,vocalMin:0.10,beatEvery:4,beatHot:4,hot:0.5,holdMin:280,bandMin:250,runMax:4,skyMin:0.45,skyHot:0.55,sky:true,borrow:true},
  MASTER:{fun:true,fill:{def:2,A:4,B:4,O:4},fillMin:0.2,funMult:0.6,holdScale:1.5,chainScale:1.45,gapMs:245,snap:2,vocalMin:0.16,beatEvery:8,beatHot:4,hot:0.5,holdMin:360,bandMin:250,runMax:4,sky:false,borrow:true},
};
// 曲ごとの上書き(Lv. を今の本番に近づけるための密度の調整)
const TUNE={
  beyond_the_same_sky:{
    HELL:{hot:0.75,vocalMin:0.25,skyMin:0.15,skyHot:0.3},
    MASTER:{hot:0.3,snapHot:1,vocalMin:0.1,gapMs:165,gapHot:160,hotGap:0.75,holdScale:2.2},// 2026-11-23 帯にしたぶんの密度を戻す(Lv. 36→37)
  },
  beyond_the_same_sky_short:{
    HELL:{hot:0.65,vocalMin:0.25,skyMin:0.55,skyHot:0.6,holdMin:240},
    MASTER:{hot:0.35,snapHot:1,vocalMin:0.1,gapMs:200,gapHot:140,hotGap:0.6,holdMin:280,lineEnd:0.5},// 2026-11-23 同上(Lv. 33→34)
  },
};
const VOICE={'女声':'R','男声':'L','女声(男声の低い重ね)':'R+','2人':'B','間奏':'I'};
const OTHER={L:'R',R:'L'};

const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};

const loadInputs=(songId)=>{
  const S=SONGS[songId];if(!S)throw new Error(`知らない曲 ${songId}`);
  const audio=JSON.parse(fs.readFileSync(path.join(ROOT,'tools/mode/authoring',S.audio),'utf8'));
  const vocal=JSON.parse(fs.readFileSync(path.join(VS,S.vocal),'utf8'));
  const parts=JSON.parse(fs.readFileSync(path.join(VS,'parts-table.json'),'utf8'))[S.table];
  return {S,audio,vocal,parts};
};

// mp3 の読み方の違いのずれを、元の音の立ち上がりと解析の立ち上がりの重なりで合わせる
const calibrate=(audio,vocal)=>{
  const ref=audio.onsets.map(o=>o.timeMs).sort((a,b)=>a-b);
  const near=(t)=>{let lo=0,hi=ref.length-1;while(lo<hi){const m=(lo+hi)>>1;if(ref[m]<t)lo=m+1;else hi=m;}
    let d=Math.abs(ref[lo]-t);if(lo>0)d=Math.min(d,Math.abs(ref[lo-1]-t));return d;};
  let best={shift:0,hit:-1};
  for(let s=-120;s<=120;s+=2){let hit=0;for(const t of vocal.mixOnsetsMs)if(near(t+s)<=16)hit++;if(hit>best.hit)best={shift:s,hit};}
  return best;
};

// ── 展開ごとの手触り(2026-11-23・台帳 r1119-116「同じようなノーツが同じように流れてくるだけ」「スライドやホールドもほとんどなし」) ──
//   区間の役(秒の区切り): A=Aメロ(歌う手の階段+伸ばしのホールド) / B=掛け合い(1行ずつ左右の受け渡し・行末のフリック) /
//   C=サビ(メロに沿う長いスライド・小節の頭の両手) / D=2人・ハモりの見せ場(両手のスライド・左右対称の帯・締めの両手フリック) /
//   O=落ちサビ・静かな所(長いホールドとゆっくりのスライド) / I=間奏(伴奏の交互)
//   どの形も歌っている手の側の半分の中だけで作る(反対の手の半分へ出ない → 押さえ中の交差が出ない)
const FUN={
  beyond_the_same_sky:[[3.4,'A'],[35.8,'B'],[51.9,'C'],[73.5,'D'],[89.7,'I'],[92.4,'A'],[113.9,'B'],[131.0,'O'],[164.1,'D'],[168.2,'C'],[209.4,'D'],[228.6,'I'],[236.0,'O'],[245.8,'D']],
  beyond_the_same_sky_short:[[3.4,'A'],[35.8,'B'],[51.9,'C'],[73.5,'D'],[89.7,'I'],[92.4,'A'],[107.8,'D'],[108.5,'C'],[134.0,'I'],[135.5,'O'],[142.2,'D']],
};
// 役ごとの作り方(MASTER・HELL 共通。HELL は数を増やす)
//   chain  なめらかなスライドにする言葉の続き [つなぐ最大の間(拍), 最少の数, 最多の数, 何本に1本スライドにするか(1=全部)]
//   hold   次の同じ手まで何拍空けばホールドにするか / maxHold ホールドの最長(拍) / sw スライドの幅
const ROLE={
  A:{chain:[0.75,3,5,1],hold:1.5,maxHold:1.5,sw:2},
  B:{chain:[0.6,3,4,2],hold:1.75,maxHold:1.0,sw:2},
  C:{chain:[0.75,3,6,1],hold:1.25,maxHold:2.0,sw:3},
  D:{chain:[1.0,3,6,1],hold:1.25,maxHold:2.0,sw:3},
  O:{chain:[1.1,2,5,1],hold:1.0,maxHold:3.0,sw:3},
  I:{chain:null,hold:null,sw:2},
};
const roleOf=songId=>{const r=FUN[songId];return t=>{let k='I';for(const [st,role] of r)if(t>=st*1000-60)k=role;return k;};};
const funPass=(notes,{D,BEAT,GRID,gOf,tOf,roleAt,bump,secOf,onsets,skyZone})=>{
  const half=(h,w,s)=>h==='R'?Math.max(6,Math.min(12-w,s)):Math.max(0,Math.min(6-w,s));
  const byHand=h=>notes.filter(n=>n.hand===h).sort((a,b)=>a.timeMs-b.timeMs);
  const isCand=n=>n.type==='TAP'&&n.vk==='v'&&!n.monsterSlot&&!n.dead;
  const drop=new Set();const mult=D.funMult||1;let chainNo={};
  // HELL の空中フレーズの近く(同じ手の1.5拍以内に空中)には地上の帯を作らない(段変えの仕上げで空中が地上へ戻されてしまう)
  //   空中にしてよい所(サビ・盛り上がり)の言葉は、段変えの仕上げが空中のフレーズへそろえるので、HELL では地上の帯にしない
  //   (2人・見せ場の区間は両手の帯が主役なので、空中のノーツの近くだけをよける)
  const skyNear=(h,t0,t1)=>(roleAt(t0)!=='D'&&skyZone(t0))||D.sky&&notes.some(n=>n.hand===h&&!drop.has(n)&&(n.skyHeight||n.sky)&&(n.endTimeMs||n.timeMs)>=t0-BEAT*1.5&&n.timeMs<=t1+BEAT*1.5);
  for(const h of ['L','R']){
    const a=byHand(h);
    // 1) メロディの上下に沿うスライド(2〜6音をつないだ1本)
    for(let i=0;i<a.length;i++){
      // 空中の言葉の並び(HELL のサビの空中フレーズ)は、skyChainEvery 本に1本だけ空中のスライドにする(ほかはタップのまま)
      const n=a[i];if(!isCand(n)||(n.skyHeight&&!D.skyChainEvery))continue;const role=roleAt(n.timeMs),R=ROLE[role];if(!R.chain)continue;
      const [stepB,minN,maxN,every]=R.chain;const ch=[n];
      for(let j=i+1;j<a.length&&ch.length<maxN;j++){const m=a[j],pv=ch[ch.length-1];
        if(!isCand(m)||roleAt(m.timeMs)!==role||!!m.skyHeight!==!!n.skyHeight)break;
        if(m.timeMs-pv.timeMs>BEAT*stepB*(D.chainScale||1)+2||m.timeMs-pv.timeMs<GRID*0.9)break;ch.push(m);}
      if(ch.length<minN||ch[ch.length-1].timeMs-n.timeMs<BEAT*0.9){continue;}
      if(!n.skyHeight&&skyNear(h,n.timeMs,ch[ch.length-1].timeMs+BEAT))continue;
      const semis=ch.map(x=>x.semi).filter(x=>x!=null);if(semis.length<ch.length-1)continue;
      const ck=(n.skyHeight?'sky':'')+role,k=(chainNo[ck]=(chainNo[ck]||0)+1);if((k-1)%Math.max(1,Math.round(n.skyHeight?D.skyChainEvery:every/mult))!==0){i+=ch.length-1;continue;}
      const w=R.sw,out=h==='R'?1:-1;const s0=half(h,w,n.subLane+(n.subLaneWidth-w)/2|0);
      const base=ch[0].semi??semis[0];
      const pts=ch.map(x=>[x.timeMs,half(h,w,s0+out*Math.max(-3,Math.min(3,Math.round(((x.semi??base)-base)/2))))]);
      // 動かない並びは、外へ1つ払ってから戻す(止まったホールドにしない)
      if(pts.every(p=>p[1]===pts[0][1])){for(let q=1;q<pts.length;q++)pts[q][1]=half(h,w,s0+out*(q%2));}
      const last=ch[ch.length-1],nx=a[a.indexOf(last)+1];
      // 空中のスライドのすぐ後(300ms 未満)に空中のノーツが来るなら作らない(通り道に空中のノーツ・r1022 の「指が同じ位置」)
      if(n.skyHeight&&nx&&(nx.skyHeight||nx.sky)&&nx.timeMs-last.timeMs<300){i+=ch.length-1;continue;}
      const lim=nx?nx.timeMs-Math.max(D.gapMs,BEAT*0.5,n.skyHeight?300:0):last.timeMs+BEAT;
      let end=Math.min(last.timeMs+Math.max(last.vdur||0,GRID*2),lim);end=tOf(gOf(end));
      if(end>last.timeMs+GRID*0.9)pts.push([end,pts[pts.length-1][1]]);else end=last.timeMs;
      const sl={type:'SLIDE',timeMs:n.timeMs,endTimeMs:end,pts,subLane:pts[pts.length-1][1],subLaneWidth:w,sw:w,hand:h,vk:'v',
        sky:D.sky?(n.skyHeight?1:0):undefined,fun:role};
      for(const x of ch)drop.add(x);notes.push(sl);a.splice(i,ch.length,sl);bump(secOf(n.timeMs),'メロのスライド');
    }
    // 2) 次の言葉まで空く所は伸ばし(ホールド。声の高さが動けば2点のスライド)
    for(let i=0;i<a.length;i++){
      const n=a[i];if(!isCand(n)||n.skyHeight||drop.has(n))continue;const role=roleAt(n.timeMs),R=ROLE[role];if(!R.hold)continue;
      const nx=a[i+1];const room=(nx?nx.timeMs:n.timeMs+BEAT*4)-n.timeMs;if(room<BEAT*R.hold/Math.sqrt(mult)*(D.holdScale||1))continue;
      const want=Math.max(BEAT*0.75,Math.min(BEAT*R.maxHold,(n.vdur||0)*1.6));
      let end=Math.min(n.timeMs+want,n.timeMs+room-Math.max(D.gapMs,BEAT*0.5));end=tOf(Math.floor(gOf(end)/2)*2);
      if(end-n.timeMs<BEAT*0.5||skyNear(h,n.timeMs,end))continue;
      const mv=(n.semi!=null&&n.semiEnd!=null)?Math.max(-2,Math.min(2,Math.round((n.semiEnd-n.semi)/2))):0;
      if(mv!==0&&role!=='B'){const w=2,s0=half(h,w,n.subLane),se=half(h,w,s0+mv*(h==='R'?1:-1));
        if(se!==s0){const sl={type:'SLIDE',timeMs:n.timeMs,endTimeMs:end,pts:[[n.timeMs,s0],[end,se]],subLane:se,subLaneWidth:w,sw:w,hand:h,vk:'v',sky:D.sky?0:undefined,fun:role};
          drop.add(n);notes.push(sl);a[i]=sl;bump(secOf(n.timeMs),'伸ばしのスライド');continue;}}
      n.type='HOLD';n.endTimeMs=end;bump(secOf(n.timeMs),'伸ばしのホールド');
    }
  }
  for(let i=notes.length-1;i>=0;i--)if(drop.has(notes[i]))notes.splice(i,1);drop.clear();
  // 3) 帯+刻み: 歌う手が帯を押さえている間、反対の手が自分の側で伴奏を刻む(8分。MASTER の A・B・O は4分)
  if(D.fill){const on=new Map();for(const o of onsets){const g=gOf(o.timeMs);on.set(g,Math.max(on.get(g)||0,o.strength));}
    const bands=notes.filter(n=>(n.type==='HOLD'||n.type==='SLIDE')&&n.endTimeMs-n.timeMs>=BEAT*0.9);
    for(const b of bands){const h=b.hand,o=OTHER[h],role=roleAt(b.timeMs);if(role==='I')continue;
      const every=(D.fill[role]||D.fill.def);if(!every)continue;
      const mine=()=>notes.filter(n=>n.hand===o);
      for(let g=gOf(b.timeMs)+every;tOf(g)<b.endTimeMs-GRID*0.5;g+=every){const t=tOf(g);
        if(!(g%4===0||(on.get(g)||0)>=D.fillMin)||(D.sky&&notes.some(n=>n.hand===o&&(n.skyHeight||n.sky)&&Math.abs(n.timeMs-t)<BEAT*1.5)))continue;
        const near=mine().some(n=>Math.abs(n.timeMs-t)<D.gapMs||(n.endTimeMs&&t>=n.timeMs-D.gapMs&&t<=n.endTimeMs+D.gapMs));if(near)continue;
        const k=Math.round(g/every)%2;const sub=o==='L'?(k?1:2):(k?9:8);
        notes.push({type:'TAP',timeMs:t,subLane:sub,subLaneWidth:2,hand:o,vk:'b',semi:null,vdur:0});bump(secOf(t),'帯+刻み');}}}
  // 4) 2人・見せ場: 左右対称のホールド(同時に始まり同時に終わる対)を、左右へ開く・閉じる鏡写しのスライドにする(開く・閉じるを交互に)
  {let k=0;const hs=notes.filter(n=>n.type==='HOLD'&&roleAt(n.timeMs)==='D'&&n.endTimeMs-n.timeMs>=BEAT*0.75);
    for(const r of hs.filter(n=>n.hand==='R')){const l=hs.find(n=>n.hand==='L'&&n.timeMs===r.timeMs&&n.endTimeMs===r.endTimeMs);if(!l)continue;
      const open=k++%2===0;const [r0,r1]=open?[6,8]:[8,6],[l0,l1]=open?[3,1]:[1,3];
      for(const [n,a0,a1] of [[r,r0,r1],[l,l0,l1]]){Object.assign(n,{type:'SLIDE',pts:[[n.timeMs,a0],[n.endTimeMs,a1]],subLane:a1,subLaneWidth:3,sw:3,sky:D.sky?0:undefined,fun:'D'});}
      bump(secOf(r.timeMs),open?'左右に開くスライド':'左右から閉じるスライド');}}
  // 5) 2人・ハモりの区間の締め: 最後の言葉を両手の外向きフリックに(左右とも空いているときだけ)
  const ends=new Map();for(const n of notes){if(drop.has(n)||n.vk!=='v')continue;const p=secOf(n.timeMs);if(p&&roleAt(n.timeMs)==='D')ends.set(p,n.timeMs);}
  for(const [p,t] of ends){const pair=notes.filter(n=>!drop.has(n)&&n.timeMs===t&&n.type==='TAP'&&!n.monsterSlot);
    if(pair.length===2&&pair[0].hand!==pair[1].hand){for(const n of pair){n.type='FLICK';n.dir=n.hand==='R'?2:1;}bump(p,'締めの両手フリック');}}
  for(let i=notes.length-1;i>=0;i--)if(drop.has(notes[i]))notes.splice(i,1);
  notes.sort((a,b)=>a.timeMs-b.timeMs||(a.subLane-b.subLane));
};

const compose=(songId,diff)=>{
  const {audio,vocal,parts}=loadInputs(songId);const D={...DIFFS[diff],...(TUNE[songId]&&TUNE[songId][diff]||{}),...(process.env.VS_TUNE?JSON.parse(process.env.VS_TUNE):{})};
  const BEAT=audio.timing.beatMs,ZERO=audio.timing.beatZeroMs,GRID=BEAT/4;
  const cal=calibrate(audio,vocal);
  const gOf=t=>Math.round((t-ZERO)/GRID),tOf=g=>Math.round(ZERO+g*GRID);
  const endMs=audio.durationMs-600;
  const secOf=t=>parts.find(p=>t>=p.start*1000-GRID*1.5&&t<p.end*1000-GRID*1.5)||null;
  const intensityAt=t=>{const b=audio.structure.bars.find(x=>t>=x.startMs&&t<x.endMs);return b?b.intensity:0.3;};

  // ── 言葉の頭(声の拍) ──
  const vnotes=[];
  for(const v of vocal.notes){
    const t=v.timeMs+cal.shift;if(t<ZERO-GRID||t>endMs)continue;
    const inten=intensityAt(t);
    const sn=inten>=D.hot&&D.snapHot?D.snapHot:D.snap;
    const g=Math.round(gOf(t)/sn)*sn;
    const min=D.vocalMin*(inten>0.6?0.7:inten<0.25?1.4:1);
    if(v.strength<min)continue;
    const prev=vnotes[vnotes.length-1];
    if(prev&&prev.g===g){if(v.strength>prev.strength)Object.assign(prev,{strength:v.strength,semi:v.semitone??prev.semi});prev.dur=Math.max(prev.dur,v.durMs);continue;}
    vnotes.push({g,t:tOf(g),dur:v.durMs,semi:v.semitone,semiEnd:v.semitoneEnd,strength:v.strength,legato:!!v.legato});
  }
  // なめらかにつながる2音(どちらも200ms以上・合わせて伸ばしの1.4倍以上・高さが動く)は、高さを追う1本の帯にする
  for(let i=0;i+1<vnotes.length;i++){const a=vnotes[i],b=vnotes[i+1];
    if(b.legato&&b.t-(a.t+a.dur)<60&&a.dur>=200&&b.dur>=200&&b.t+b.dur-a.t>=D.holdMin*1.4&&a.semi!=null&&b.semiEnd!=null&&Math.abs(b.semiEnd-a.semi)>=1){
      a.dur=b.t+b.dur-a.t;a.semiEnd=b.semiEnd;a.glide=true;vnotes.splice(i+1,1);}}
  // ── 伴奏の拍(解析の立ち上がり。拍の頭だけ) ──
  const beats=new Map();
  for(const o of audio.onsets){const g=gOf(o.timeMs);if(g<0||o.timeMs>endMs)continue;
    const every=intensityAt(o.timeMs)>=D.hot?D.beatHot:D.beatEvery;
    if(g%every!==0)continue;const s=o.strength;if(!beats.has(g)||beats.get(g)<s)beats.set(g,s);}
  // 拍の頭に立ち上がりが無くても、小節の頭は伴奏として取る(歌のある所)
  const beatList=[...beats.entries()].map(([g,s])=>({g,t:tOf(g),strength:s})).sort((a,b)=>a.g-b.g);

  // ── 手ごとの位置(声の高さ → 半分の中の位置。高い音ほど外側) ──
  const semisBySec=new Map();
  for(const v of vnotes){const p=secOf(v.t);if(!p||v.semi==null)continue;if(!semisBySec.has(p))semisBySec.set(p,[]);semisBySec.get(p).push(v.semi);}
  const rangeOf=p=>{const a=(semisBySec.get(p)||[]).slice().sort((x,y)=>x-y);if(a.length<3)return [60,72];
    return [a[Math.floor(a.length*0.1)],a[Math.floor(a.length*0.9)]];};
  const idxOf=(p,semi)=>{if(semi==null)return 2;const [lo,hi]=rangeOf(p);const r=hi>lo?(semi-lo)/(hi-lo):0.5;return Math.max(0,Math.min(3,Math.round(r*3)));};
  // 右手の始まり 6..10(外側が高い)・左手 4..0(外側が高い)。幅2
  const posOf=(hand,idx)=>hand==='R'?6+idx:4-idx;
  const mirror=(s,w)=>12-s-w;

  // ── 並べる ──
  const notes=[];const last={L:{t:-1e9,end:-1e9,pos:null,ground:-1e9},R:{t:-1e9,end:-1e9,pos:null,ground:-1e9}};
  // 同じ手の間。gapHot を書いた難易度は、盛り上がりの強い所(hotGap 以上)だけ狭める
  const gapAt=t=>D.gapHot&&intensityAt(t)>=(D.hotGap||D.hot)?D.gapHot:D.gapMs;
  const free=(h,t)=>t-last[h].t>=gapAt(t)&&t-last[h].end>=gapAt(t);
  const step=(h,want)=>{const p=last[h].pos;if(p==null)return want;const d=Math.max(-2,Math.min(2,want-p));return p+d;};
  const clampHalf=(h,s)=>h==='R'?Math.max(6,Math.min(9,s)):Math.max(1,Math.min(4,s));
  const run={L:0,R:0};
  let cur=null;// いま並べている言葉(声の高さ・長さを帯の作り直しで使う)
  const put=(h,n)=>{notes.push({...n,hand:h,vk:cur?'v':'b',semi:cur?cur.semi:null,semiEnd:cur?cur.semiEnd:null,vdur:cur?cur.dur:0});run[h]=n.timeMs===last[OTHER[h]].t?run[h]:run[h]+1;run[OTHER[h]]=0;last[h].t=n.timeMs;last[h].end=Math.max(last[h].end,n.endTimeMs||n.timeMs);
    if(!n.skyHeight)last[h].ground=n.endTimeMs||n.timeMs;last[h].pos=n.subLane??last[h].pos;};
  const stats=new Map();const bump=(p,k)=>{if(!p)return;if(!stats.has(p))stats.set(p,{});const s=stats.get(p);s[k]=(s[k]||0)+1;};

  // 言葉の頭と伴奏を時刻順に1本へ
  for(const v of vnotes)v.kind='v';for(const b of beatList)b.kind='b';
  const events=[...vnotes,...beatList].sort((a,b)=>a.g-b.g||(a.kind==='v'?-1:1));
  const vIdx=new Map(vnotes.map((v,i)=>[v,i]));
  const nextVocalGap=(v)=>{const i=vIdx.get(v);const n=vnotes[i+1];return n?n.t-v.t:1e9;};
  const prevVocalGap=(v)=>{const i=vIdx.get(v);const n=vnotes[i-1];return n?v.t-n.t:1e9;};
  const isChorus=p=>p&&(p.voice==='女声(男声の低い重ね)'||(p.voice==='2人'&&/ハモり|Beyond/.test(p.lyrics)));

  // 帯(伸ばし)の長さ: 次の言葉の頭の手前まで・グリッドに寄せる
  const bandEnd=(v,limit)=>{let e=v.t+v.dur;e=Math.min(e,limit-D.gapMs);const g=Math.floor(gOf(e)/2)*2;return tOf(g);};

  for(const e of events){
    const p=secOf(e.t);if(!p)continue;const mode=VOICE[p.voice]||'I';cur=e.kind==='v'?e:null;
    if(e.kind==='b'){
      // 伴奏: 歌の無い所は左右交互・歌のある所は反対の手(2人の所は小節の頭だけ・空いている手)
      if(mode==='I'){const k=Math.round(e.g/2);const h=k%2?'R':'L';if(!free(h,e.t))continue;
        const s=h==='R'?(k%4===1?7:8):(k%4===0?3:2);put(h,{type:'TAP',timeMs:e.t,subLane:s,subLaneWidth:2});bump(p,'伴奏');continue;}
      if(mode==='B'){if(e.g%16!==0)continue;const h=free('L',e.t)?'L':free('R',e.t)?'R':null;if(!h)continue;
        put(h,{type:'TAP',timeMs:e.t,subLane:h==='L'?2:8,subLaneWidth:2});bump(p,'伴奏');continue;}
      const singer=mode==='R+'?'R':mode;const h=OTHER[singer];
      if(e.strength<0.12&&e.g%16!==0)continue;
      if(!free(h,e.t))continue;
      const s=h==='L'?(e.g%16===0?2:3):(e.g%16===0?8:7);
      put(h,{type:'TAP',timeMs:e.t,subLane:s,subLaneWidth:2});bump(p,'伴奏');continue;
    }
    // ── 言葉の頭 ──
    const v=e;const nextGap=nextVocalGap(v);const nextT=v.t+nextGap;
    if(mode==='I')continue;
    if(mode==='B'){
      // 2人: 言葉の頭(前が空いた・拍の頭)は左右の同時押し、ほかは左右交互。伸ばしは左右対称の帯
      const head=prevVocalGap(v)>=BEAT*0.99||v.g%4===0;
      const idx=idxOf(p,v.semi);const rs=clampHalf('R',6+idx),ls=mirror(rs,2);
      const long=v.dur>=D.holdMin&&nextGap>=D.holdMin;
      if(head||long){if(!free('L',v.t)||!free('R',v.t))continue;
        const sky=D.sky&&(isChorus(p)||intensityAt(v.t)>=D.skyHot)&&head&&v.t-last.L.ground>=250&&v.t-last.R.ground>=250&&!long;
        if(long){const end=bandEnd(v,nextT);if(end-v.t>=D.bandMin){
          const chg=(v.semiEnd!=null&&v.semi!=null)?Math.round(Math.max(-2,Math.min(2,(v.semiEnd-v.semi)/2))):0;
          const rEnd=clampHalf('R',rs+chg),lEnd=mirror(rEnd,2);
          if(chg===0){put('R',{type:'HOLD',timeMs:v.t,endTimeMs:end,subLane:rs,subLaneWidth:2});put('L',{type:'HOLD',timeMs:v.t,endTimeMs:end,subLane:ls,subLaneWidth:2});}
          else{put('R',{type:'SLIDE',timeMs:v.t,endTimeMs:end,pts:[[v.t,rs],[end,rEnd]],subLane:rEnd,subLaneWidth:2});put('L',{type:'SLIDE',timeMs:v.t,endTimeMs:end,pts:[[v.t,ls],[end,lEnd]],subLane:lEnd,subLaneWidth:2});}
          bump(p,'左右対称の帯');continue;}}
        if(sky){put('R',{type:'TAP',timeMs:v.t,subLane:rs,subLaneWidth:2,skyHeight:1});put('L',{type:'TAP',timeMs:v.t,subLane:ls,subLaneWidth:2,skyHeight:1});bump(p,'空中の同時押し');}
        else{put('R',{type:'TAP',timeMs:v.t,subLane:rs,subLaneWidth:2});put('L',{type:'TAP',timeMs:v.t,subLane:ls,subLaneWidth:2});bump(p,'同時押し');}
        continue;}
      const h=last.L.t<=last.R.t?'L':'R';const o=OTHER[h];
      const hh=free(h,v.t)?h:free(o,v.t)?o:null;if(!hh)continue;
      const s=hh==='R'?step('R',rs):step('L',ls);put(hh,{type:'TAP',timeMs:v.t,subLane:clampHalf(hh,s),subLaneWidth:2});bump(p,'交互');continue;
    }
    // 片方の声(女声=右・男声=左)。女声+低い男声の所は、低い声(男声の重ね)の言葉だけ左手
    const singer=mode==='R+'?'R':mode;const other=OTHER[singer];
    const idx=idxOf(p,v.semi);
    const long=v.dur>=D.holdMin&&nextGap>=Math.min(D.holdMin,BEAT*1.5);
    // 片手の続きが長い(速い言葉が runMax 個続いた)ときは、反対の手が空いていれば反対の手の内側へ渡す
    const tooLong=run[singer]>=D.runMax&&v.t-last[singer].t<BEAT*0.6&&free(other,v.t)&&last[singer].end<v.t-20&&!long;
    if(free(singer,v.t)&&!tooLong){
      const want=posOf(singer,idx);const s=clampHalf(singer,step(singer,want));
      if(long){const end=bandEnd(v,nextT);if(end-v.t>=D.bandMin){
        const chg=(v.semiEnd!=null&&v.semi!=null)?Math.max(-2,Math.min(2,Math.round((v.semiEnd-v.semi)/2))):0;
        const outward=singer==='R'?1:-1;const se=clampHalf(singer,s+chg*outward);
        // HELL のサビの伸ばしは空中スライド(同じ手の地上から250ms以上)
        const sky=D.sky&&mode==='R+'&&v.t-last[singer].ground>=250;
        if(sky||se!==s){put(singer,{type:'SLIDE',timeMs:v.t,endTimeMs:end,pts:[[v.t,s],[end,se===s?clampHalf(singer,s+outward):se]],subLane:se,subLaneWidth:2,sky:sky?1:0});bump(p,sky?'空中スライド':'スライド');}
        else{put(singer,{type:'HOLD',timeMs:v.t,endTimeMs:end,subLane:s,subLaneWidth:2});bump(p,'ホールド');}
        // 女声(男声の低い重ね): 伸ばしの頭に左手の同時押し
        if(mode==='R+'&&free(other,v.t)){put(other,{type:'TAP',timeMs:v.t,subLane:2,subLaneWidth:2});bump(p,'低い重ね');}
        continue;}}
      // 行の終わり(次の言葉まで2拍以上)はフリックで外へ払う
      const nv=vnotes[vIdx.get(v)+1];const lastOfSec=!nv||secOf(nv.t)!==p;
      const lineEnd=(lastOfSec||nextGap-v.dur>=BEAT*(D.lineEnd||0.75))&&prevVocalGap(v)<BEAT*2;
      if(lineEnd){put(singer,{type:'FLICK',timeMs:v.t,subLane:s,subLaneWidth:2,dir:singer==='R'?2:1});bump(p,'行の終わりのフリック');}
      else if(D.sky&&(mode==='R+'||intensityAt(v.t)>=D.skyHot)&&v.strength>=D.skyMin&&v.g%2===0&&v.t-last[singer].ground>=250){put(singer,{type:'TAP',timeMs:v.t,subLane:s,subLaneWidth:2,skyHeight:1});bump(p,'空中の言葉の頭');}
      else{put(singer,{type:'TAP',timeMs:v.t,subLane:s,subLaneWidth:2});bump(p,'言葉の頭');}
      if(mode==='R+'&&v.g%8===0&&free(other,v.t)){put(other,{type:'TAP',timeMs:v.t,subLane:2,subLaneWidth:2});bump(p,'低い重ね');}
      continue;
    }
    // 歌う手が空いていない: 速い言葉は反対の手の内側へ渡す(帯を押さえている最中は渡さない=交差しない)
    if(D.borrow&&free(other,v.t)&&last[singer].end<v.t-20){
      const s=other==='L'?4:6;put(other,{type:'TAP',timeMs:v.t,subLane:s,subLaneWidth:2});bump(p,'受け渡し');}
  }
  notes.sort((a,b)=>a.timeMs-b.timeMs||(a.subLane-b.subLane));
  if(D.fun&&FUN[songId])funPass(notes,{D,BEAT,GRID,gOf,tOf,secOf,roleAt:roleOf(songId),stats,bump,diff,onsets:audio.onsets,skyZone:t=>!!D.sky&&(isChorus(secOf(t))||intensityAt(t)>=D.skyHot)});
  // 段変え(r1119-090): 同じ手が1.5拍未満で地上⇔空中を持ち替えない。サビ・盛り上がりではタップを空中へそろえてフレーズにし、
  //   それ以外は空中のタップを地上へ戻す。帯は動かさない(前の空中タップを地上へ戻す)
  if(D.sky){const WIN=BEAT*1.5-2,lvS=n=>n.type==='SLIDE'?(n.sky?1:0):(n.skyHeight?1:0),lvE=lvS;
    const isTap=n=>n.type==='TAP'||n.type==='FLICK';
    const skyOK=n=>{const p=secOf(n.timeMs);return p&&(isChorus(p)||intensityAt(n.timeMs)>=D.skyHot);};
    const setLv=(n,l)=>{if(l)n.skyHeight=1;else delete n.skyHeight;};
    for(let pass=0;pass<6;pass++){let changed=0;
      for(const h of ['L','R']){const a=notes.filter(n=>n.hand===h).sort((x,y)=>x.timeMs-y.timeMs);
        for(let i=1;i<a.length;i++){const pv=a[i-1],n=a[i];if(lvS(n)===lvE(pv))continue;
          if(n.timeMs-(pv.endTimeMs||pv.timeMs)>=WIN)continue;
          if(isTap(n)&&lvE(pv)===1&&skyOK(n)){setLv(n,1);changed++;}
          else if(isTap(n)&&lvS(n)===1){setLv(n,0);changed++;}
          else if(isTap(pv)&&lvE(pv)===1){setLv(pv,0);changed++;}}}
      if(!changed)break;}}
  // 幅(2026-11-22 社長「全部ノーツが小さい」): 拍の強さで混ぜる。区間の始まりの小節の頭=5・小節の頭=4・拍の頭=3・
  //   半小節の頭=4・ほか=3・同じ手が16分で続く所=2。真ん中の位置はそのままで、その手の半分の外へは出さない(交差は増えない)。スライドは幅2のまま
  {const byHand={L:[],R:[]};for(const n of notes)byHand[n.hand].push(n);
    const secStart=new Set(parts.map(p=>Math.round(gOf(p.start*1000)/16)*16));
    for(const h of ['L','R']){const a=byHand[h];
      for(let i=0;i<a.length;i++){const n=a[i];if(n.type==='SLIDE')continue;const g=gOf(n.timeMs);
        const fast=(i>0&&n.timeMs-a[i-1].timeMs<130&&n.timeMs!==a[i-1].timeMs)||(i+1<a.length&&a[i+1].timeMs-n.timeMs<130&&a[i+1].timeMs!==n.timeMs);
        let w=fast?2:g%16===0?(secStart.has(g)?5:4):g%8===0?4:3;
        if(n.skyHeight)w=Math.min(w,3);
        const c=n.subLane+n.subLaneWidth/2;let st=Math.round(c-w/2);
        st=h==='R'?Math.max(6,Math.min(12-w,st)):Math.max(0,Math.min(6-w,st));n.subLane=st;n.subLaneWidth=w;}}}
  // モンスターノーツ4個: 曲の 1/5・2/5・3/5・4/5 あたりの、拍の頭の地上タップ(強い所)
  const dur=audio.durationMs;
  for(let k=1;k<=4;k++){const at=dur*k/5;
    const c=notes.filter(n=>n.type==='TAP'&&!n.skyHeight&&!n.monsterSlot&&Math.abs(n.timeMs-at)<6000&&gOf(n.timeMs)%4===0)
      .sort((a,b)=>Math.abs(a.timeMs-at)-Math.abs(b.timeMs-at))[0];
    if(c)c.monsterSlot=k;}
  return {notes,stats,parts,cal,BEAT};
};

// ── ランタイムの形へ(検査に通すため) ──
const laneOfSub=(s,w)=>(s+w/2-1)/2;
// スライドの点のレーン。幅3は0.5刻みにそろえ(押し始めを受け付けるのは0.5刻みだけ・rhythm-slide-start-lane-check)、手の半分の中に収める
const slideLane=(n,s)=>{const w=n.sw||2;if(w!==3)return laneOfSub(s,w);const v=laneOfSub(s,w);
  return n.hand==='R'?Math.max(3.5,Math.min(4.5,Math.ceil(v*2)/2)):Math.max(0.5,Math.min(1.5,Math.floor(v*2)/2));};
const toRuntime=(n)=>{
  if(n.type==='SLIDE'){const w=n.sw||2;const pts=n.pts.map(([t,s])=>({timeMs:t,lane:slideLane(n,s),subLaneWidth:w,...(n.sky!=null?{sky:n.sky}:{})}));
    return {type:'SLIDE',timeMs:n.timeMs,endTimeMs:n.endTimeMs,lane:pts[0].lane,endLane:pts[pts.length-1].lane,subLaneWidth:w,slidePoints:pts,...(n.sky!=null?{hand:n.hand}:{})};}
  const base={type:n.type,timeMs:n.timeMs,lane:Math.floor(n.subLane/2),subLane:n.subLane,subLaneWidth:n.subLaneWidth};
  if(n.type==='HOLD')base.endTimeMs=n.endTimeMs;
  if(n.monsterSlot)base.monsterSlot=n.monsterSlot;
  if(n.type==='FLICK'&&n.dir)base.flickDir=n.dir===1?'left':'right';
  if(n.skyHeight)base.skyHeight=n.skyHeight;
  return base;
};
// ── マーカーの中身(t/h/f/s と HELL の T/F/S) ──
const callOf=(n,diff)=>{
  const hell=diff==='HELL';
  if(n.type==='TAP')return n.skyHeight?`T(${n.timeMs},${n.subLane},${n.subLaneWidth},1)`:`t(${n.timeMs},${n.subLane},${n.subLaneWidth},${n.monsterSlot||0})`;
  if(n.type==='FLICK')return n.skyHeight?`F(${n.timeMs},${n.subLane},${n.subLaneWidth},${n.dir||0},1)`:`f(${n.timeMs},${n.subLane},${n.subLaneWidth},${n.dir||0})`;
  if(n.type==='HOLD')return `h(${n.timeMs},${n.subLane},${n.subLaneWidth},${n.endTimeMs})`;
  const fmt=x=>String(Math.round(x*1000)/1000);
  const w=n.sw||2;
  if(hell)return `S(${n.timeMs},${n.endTimeMs},[${n.pts.map(([t,s],i)=>`[${t},${fmt(slideLane(n,s))},${w},${n.sky||0},${i===0?3:0}]`).join(',')}],0,'${n.hand}')`;
  return `s(${n.timeMs},${n.endTimeMs},[${n.pts.map(([t,s],i)=>`[${t},${fmt(slideLane(n,s))},${w}${i===0?',3':''}]`).join(',')}])`;
};
const writeMarker=(songId,diff,notes)=>{
  const src=fs.readFileSync(MODE,'utf8');const m=`${SONGS[songId].marker}-${diff==='HELL'?'hell':diff.toLowerCase()}-notes`;
  const a=src.indexOf(`// <${m}>`),b=src.indexOf(`// </${m}>`);if(a<0||b<0)throw new Error(`マーカー ${m} が無い`);
  const head=`// <${m}>\n`;const calls=notes.map(n=>callOf(n,diff));const lines=[];
  for(let i=0;i<calls.length;i+=4)lines.push('  '+calls.slice(i,i+4).join(',')+',');
  fs.writeFileSync(MODE,src.slice(0,a)+head+lines.join('\n')+'\n'+src.slice(b));
};

const tableOf=(songId,diff,r)=>{
  const RN={A:'Aメロ',B:'掛け合い',C:'サビ',D:'2人・見せ場',O:'落ちサビ',I:'間奏'};const role=FUN[songId]?roleOf(songId):null;
  const rows=[`| 秒 | 声 | 役 | 手 | 形(タップ・ホールド・スライド・フリック・空中) | 置いた物 | 歌詞 |`,`| --- | --- | --- | --- | --- | --- | --- |`];
  const hand={'R':'右手が歌・左手は伴奏','L':'左手が歌・右手は伴奏','R+':'右手が主旋律・左手が低い重ね','B':'両手','I':'左右交互(伴奏)'};
  for(const p of r.parts){const s=r.stats.get(p)||{};const m=VOICE[p.voice]||'I';
    const inS=r.notes.filter(n=>n.timeMs>=p.start*1000-r.BEAT*0.4&&n.timeMs<p.end*1000-r.BEAT*0.4),ns=inS.length;
    const c=k=>inS.filter(n=>n.type===k).length,sky=inS.filter(n=>n.skyHeight||n.sky).length;
    rows.push(`| ${p.start.toFixed(1)}–${p.end.toFixed(1)} | ${p.voice} | ${role?RN[role(p.start*1000+100)]:''} | ${hand[m]} | ${c('TAP')}・${c('HOLD')}・${c('SLIDE')}・${c('FLICK')}・${sky} | ${ns}個(${Object.entries(s).map(([k,v])=>`${k}${v}`).join('・')}) | ${p.lyrics} |`);}
  return rows.join('\n');
};

module.exports={compose,toRuntime,SONGS,DIFFS};

if(require.main===module){
  const songId=argOf('--song'),diff=argOf('--diff')||'HELL';
  const r=compose(songId,diff);const rt=r.notes.map(toRuntime);
  const ty={};for(const n of rt){const k=n.type+(n.skyHeight||(n.slidePoints&&n.slidePoints.some(p=>p.sky))?'(空中)':'');ty[k]=(ty[k]||0)+1;}
  console.log(`${songId} ${diff}: ${rt.length} ノーツ ${JSON.stringify(ty)} 時刻のずれ合わせ ${r.cal.shift}ms(重なり ${r.cal.hit})`);
  if(args.includes('--json'))fs.writeFileSync(argOf('--json'),JSON.stringify(rt));
  if(argOf('--table'))fs.writeFileSync(argOf('--table'),tableOf(songId,diff,r)+'\n');
  if(args.includes('--write')){writeMarker(songId,diff,r.notes);console.log('マーカーへ書いた');}
}
