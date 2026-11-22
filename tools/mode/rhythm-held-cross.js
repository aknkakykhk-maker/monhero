#!/usr/bin/env node
// 押さえ中の交差(片手がホールド・スライドを押さえている間に、もう片手がその帯をまたいで叩く所)を数える・直す(2026-11-22・ビート)。
//
//   node tools/mode/rhythm-held-cross.js --all                              公開中の全曲の MASTER・HELL の件数(多い順)
//   node tools/mode/rhythm-held-cross.js --song <songId> --diff HELL --list  1件ずつ(秒・何を・位置)
//   node tools/mode/rhythm-held-cross.js --fix --song <songId> --diff HELL [--write] [--json <ファイル>]
//        交差しているタップ・フリックの「横の位置だけ」を、押さえていない手の側へ動かす(時刻・種類・幅・高さ・ノーツ数はそのまま)。
//        --write で rhythm-mode.js のその譜面のマーカーへ書く(ほかの曲・ほかの難易度は1バイトも変えない)
//
// 【なぜ要るか】(台帳 r1119-096・社長)
//   「Beyond the Same Sky はクロスが多すぎていやらしすぎる。片手ホールド・スライドで片手タップならいいけど、それがクロス混じりでやりづらい」
//   「Desert Crown の HELL はホールドかスライドとスカイ中に、さらにタップがある。親指2本じゃ押せない」
//   どちらも同じ形だった: 片方の親指が帯を押さえて動けないまま、もう片方の親指がその帯の向こう側(押さえている親指の側)を叩く。
//   押さえている指は離せないので、またぐか3本目の指が要る。
// 【今までの検査が見逃した理由】
//   ・親指2本のモデル(rhythm-ref-tiers.js の thumbCheck)はこの形を「指が交差」(注意・重み60)として数えるだけで、「押せない」にしない。
//     しかも交差は、帯を押さえていて動けない交差と、空いている指どうしの入れ替わり(指をどければ済む)を区別していなかった
//   ・手の決まり(rhythm-chart-hand-rules.js)は左右を「画面の半分」で決め打ちして数えるので、帯の向こう側へ渡る形は
//     「反対側のノーツ」に見えて引っかからない(besideHeldBand は同じ側だけを見る)。交差の検査は HELL の水平クロス(空中どうし)だけ
//   ・帯の中の検査(onHeldBand)は帯に「重なる」ノーツだけを見る。隣や向こう側は見ない
//   → ここでは thumbCheck の振り分け(先読みで交差が最小になる左右)のうち、反対の手が帯を押さえている最中の交差だけを抜き出す。
//     rhythm-chart-hand-rules-check.js が公開中の譜面の件数を控え(rhythm-held-cross-baseline.json)より増やさないことを見張る
'use strict';
const fs=require('fs'),path=require('path');
const T=require('./rhythm-ref-tiers.js');
const R=require('./rhythm-chart-hand-rules.js');

const SAME_MS=15;                 // 帯の押し始めとこれ以内のノーツは「同時」(押さえ中ではない)
const W={impossible:10000,cross:60,reach:40,busy:10};
const isBand=n=>n&&(n.type==='HOLD'||n.type==='SLIDE');
const xOf=n=>n.type==='SLIDE'?null:(Number(n.subLane)+Number(n.subLaneWidth||2)/2)/2;

// thumbCheck の交差のうち、その時刻に別の帯を押さえている最中のもの
const heldCrosses=notes=>{
  const list=(notes||[]).filter(n=>n&&Number.isFinite(n.timeMs));
  const res=T.thumbCheck(T.fromRuntime(list));
  const bands=list.filter(isBand);
  const out=[];
  for(const i of res.issues){
    if(i.kind!=='cross'||i.what==='スライド2本')continue;
    const held=bands.filter(b=>b.timeMs<i.t-SAME_MS&&Number(b.endTimeMs)>i.t);
    if(!held.length)continue;
    // 交差したノーツ(同じ時刻・同じ横の位置)
    const note=list.find(n=>Math.abs(n.timeMs-i.t)<1&&!isBand(n)&&Math.abs(xOf(n)-i.x)<0.01)
      ||list.find(n=>Math.abs(n.timeMs-i.t)<1&&i.what.startsWith('スライド')&&n.type==='SLIDE')
      ||list.find(n=>Math.abs(n.timeMs-i.t)<1&&i.what==='ホールド'&&n.type==='HOLD')||null;
    out.push({at:i.t,x:i.x,what:i.what,note,bands:held,held:held.map(b=>b.type+(b.type==='SLIDE'&&(b.slidePoints||[]).some(p=>p.sky>0)?'(空中を通る)':''))});
  }
  return {list:out,cost:res.issues.reduce((a,i)=>a+(W[i.kind]||0),0),issues:res.issues};
};

// ── 公開中の譜面を読む ──
const loadCharts=()=>{
  const {loadRuntimeSongs}=require('./rhythm-chart-level.js');const r=loadRuntimeSongs();
  const songs=r.RHYTHM_SONGS||[],proto=r.RHYTHM_PROTO_SONGS||[];
  const chartOf=(songId,diff)=>{const s=songs.find(x=>x.songId===songId);
    if(diff==='HELL'){const h=s&&s.difficulties.HELL||(proto.find(x=>x.songId===songId+'_hell_debug')||{difficulties:{}}).difficulties.HELL;return h||null;}
    return s&&s.difficulties[diff]||null;};
  return {songs,chartOf};
};

// ── 直す(横の位置だけ) ──
// 手の決まりの件数(悪くしないために数える)。空中の無い譜面では空中の決まりは0のまま
const ruleScore=notes=>{const k=R.countsOf(notes);let s=0;for(const v of Object.values(k))s+=v;
  s+=R.onHeldBand(notes).filter(x=>x.blocked).length*5;
  // 空中が絡む形(水平クロス・指が同じ位置に来る形・見分けにくい形・地上と空中の混ざり)も、手の決まりの検査と同じ物差しで増やさない
  if(R.hasSky(notes))s+=(R.flatCross(notes).length+SP().skyHits(notes).length+R.skyConfusable(notes).length+R.skyMixedSwitch(notes).length)*5;
  return s;};
let SP_=null;const SP=()=>SP_||(SP_=require('./rhythm-hell-sameplace-fix.js'));
// 同じ時刻に幅が重なるノーツ(置けない)
const overlapsSameTime=(notes,n)=>notes.some(o=>o!==n&&!isBand(o)&&Math.abs(o.timeMs-n.timeMs)<=2&&!!o.skyHeight===!!n.skyHeight
  &&Number(o.subLane)<Number(n.subLane)+Number(n.subLaneWidth)&&Number(n.subLane)<Number(o.subLane)+Number(o.subLaneWidth));
const windowOf=(notes,at,ms=5000)=>notes.filter(n=>Number(n.endTimeMs||n.timeMs)>=at-ms&&n.timeMs<=at+ms);
const scoreWindow=(notes,at)=>{const w=windowOf(notes,at);const h=heldCrosses(w);return {held:h.list.length,cost:h.cost,rules:ruleScore(w)};};
const better=(a,b)=>a.held!==b.held?a.held<b.held:a.rules!==b.rules?a.rules<b.rules:a.cost+a.move<b.cost+b.move;

const fixChart=notes=>{
  const work=notes.map(n=>({...n}));const moves=[];
  for(let pass=0;pass<3;pass++){
    const found=heldCrosses(work).list.filter(c=>c.note&&(c.note.type==='TAP'||c.note.type==='FLICK'));
    if(!found.length)break;let changed=false;
    for(const c of found){const n=c.note;if(!work.includes(n))continue;
      const base={...scoreWindow(work,n.timeMs),move:0};const from=n.subLane,w=Number(n.subLaneWidth)||2;
      let best=null;
      for(let s=0;s<=12-w;s++){if(s===from)continue;n.subLane=s;n.lane=Math.floor(s/2);
        if(overlapsSameTime(work,n))continue;
        const sc={...scoreWindow(work,n.timeMs),move:Math.abs(s-from)*2};
        if(sc.rules>base.rules)continue;                    // 手の決まりを悪くしない
        if(better(sc,best||base))best={...sc,s};}
      n.subLane=from;n.lane=Math.floor(from/2);
      if(best&&best.held<base.held){n.subLane=best.s;n.lane=Math.floor(best.s/2);changed=true;
        moves.push({at:n.timeMs,type:n.type+(n.skyHeight?'(空中)':''),width:w,from,to:best.s,fromX:(from+w/2)/2,toX:(best.s+w/2)/2,held:c.held.join('・')});}
    }
    // 手の色の決まった空中スライドが、反対の端まで行く所: タップの動かし先が無いので、その帯の手(色)を入れ替えて得になるかを見る
    for(const c of heldCrosses(work).list){for(const b of c.bands){if(b.type!=='SLIDE'||(b.hand!=='L'&&b.hand!=='R')||b._flipped)continue;
      const base={...scoreWindow(work,c.at),move:0},was=b.hand;b.hand=was==='L'?'R':'L';
      const sc={...scoreWindow(work,c.at),move:0};
      if(sc.held<base.held&&sc.rules<=base.rules){b._flipped=true;changed=true;moves.push({at:b.timeMs,end:b.endTimeMs,type:'SLIDE',fromHand:was,toHand:b.hand,held:'手の色 '+was+'→'+b.hand});}
      else b.hand=was;}}
    if(!changed)break;
  }
  for(const n of work)delete n._flipped;
  return {notes:work,moves};
};

// ── マーカーへ書く ──
const MODE=path.join(__dirname,'../../monster-hero/data/rhythm-mode.js');
const markerOf=(songId,diff)=>{const base=songId.replace(/_/g,'-');return `${base}-v3-${diff==='HELL'?'hell':diff.toLowerCase()}-notes`;};
// マーカーの中の t( / f( / T( / F( の呼び出しのうち、時刻・サブレーン・幅が同じ1つだけの subLane を書き換える
const writeMoves=(songId,diff,moves)=>{
  const src=fs.readFileSync(MODE,'utf8');const m=markerOf(songId,diff);
  const a=src.indexOf(`// <${m}>`),b=src.indexOf(`// </${m}>`);
  if(a<0||b<0)throw new Error(`マーカー ${m} が無い`);
  let body=src.slice(a,b);
  for(const mv of moves){
    if(mv.type==='SLIDE'){const re=new RegExp(`S\\(${Math.round(mv.at)},${Math.round(mv.end)},(\\[\\[[^\\]]*\\](?:,\\[[^\\]]*\\])*\\]),([^,()]*),'${mv.fromHand}'\\)`,'g');
      const hits=body.match(re)||[];if(hits.length!==1)throw new Error(`${(mv.at/1000).toFixed(3)}秒の空中スライド(手 ${mv.fromHand})が ${hits.length} 個(1個のはず)`);
      body=body.replace(re,(m0,pts,x)=>`S(${Math.round(mv.at)},${Math.round(mv.end)},${pts},${x},'${mv.toHand}')`);continue;}
    const fn=mv.type.startsWith('TAP')?(mv.type.includes('空中')?'T':'t'):(mv.type.includes('空中')?'F':'f');
    const re=new RegExp(`(?<![A-Za-z_])${fn}\\(${Math.round(mv.at)},${mv.from},${mv.width}(?=[,)])`,'g');
    const hits=body.match(re)||[];
    if(hits.length!==1)throw new Error(`${(mv.at/1000).toFixed(3)}秒の ${fn}(${Math.round(mv.at)},${mv.from},${mv.width}) が ${hits.length} 個(1個のはず)`);
    body=body.replace(re,`${fn}(${Math.round(mv.at)},${mv.to},${mv.width}`);
  }
  fs.writeFileSync(MODE,src.slice(0,a)+body+src.slice(b));
};

module.exports={heldCrosses,fixChart,loadCharts,markerOf,SAME_MS};

if(require.main===module){
  const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
  const {songs,chartOf}=loadCharts();
  if(args.includes('--all')){
    const diffs=(argOf('--diff')||'MASTER,HELL').split(',');const rows=[];
    for(const s of songs)for(const d of diffs){const c=chartOf(s.songId,d);if(!c||!Array.isArray(c.notes)||!c.notes.length)continue;
      const h=heldCrosses(c.notes).list;if(h.length)rows.push({song:s.songId,diff:d,n:h.length,at:h.slice(0,6).map(x=>(x.at/1000).toFixed(1)).join(' ')});}
    rows.sort((a,b)=>b.n-a.n);
    console.log(`押さえ中の交差がある譜面: ${rows.length}(${diffs.join('・')})`);
    for(const r of rows)console.log(`  ${String(r.n).padStart(3)}  ${(r.song+'/'+r.diff).padEnd(42)} ${r.at}${r.n>6?' …':''}`);
    if(argOf('--json'))fs.writeFileSync(argOf('--json'),JSON.stringify(rows,null,1));
    process.exit(0);}
  const songId=argOf('--song'),diff=argOf('--diff');
  const c=songId&&diff&&chartOf(songId,diff);
  if(!c){console.error('--all か、--song <songId> --diff <難易度> が要る');process.exit(1);}
  if(args.includes('--fix')){
    const before=heldCrosses(c.notes);const res=fixChart(c.notes);
    // --also <時刻ms>:<サブレーン>[,…] 道具では外せない所を手で動かす(理由は直しの記録に書く)
    for(const tok of (argOf('--also')||'').split(',').filter(Boolean)){const [at,to]=tok.split(':').map(Number);
      const n=res.notes.find(x=>x.timeMs===at&&(x.type==='TAP'||x.type==='FLICK'));if(!n)throw new Error(`--also ${tok}: その時刻のタップが無い`);
      const w=Number(n.subLaneWidth)||2,prev=res.moves.find(m=>m.at===at&&m.type!=='SLIDE');const from=prev?prev.from:n.subLane;
      if(prev)res.moves.splice(res.moves.indexOf(prev),1);n.subLane=to;n.lane=Math.floor(to/2);
      res.moves.push({at,type:n.type+(n.skyHeight?'(空中)':''),width:w,from,to,fromX:(from+w/2)/2,toX:(to+w/2)/2,held:'手で(--also)'});}
    res.moves.sort((a,b)=>a.at-b.at);const after=heldCrosses(res.notes);
    const {chartLevel}=require('./rhythm-chart-level.js');
    const lv=n=>{try{return chartLevel({notes:n}).level;}catch(e){return '?';}};
    console.log(`${songId}/${diff}: 押さえ中の交差 ${before.list.length} → ${after.list.length}・動かしたノーツ ${res.moves.length}(ノーツ数 ${c.notes.length} のまま)・Lv.の式 ${lv(c.notes)} → ${lv(res.notes)}`);
    console.log(`  手の決まり ${JSON.stringify(R.countsOf(c.notes))} → ${JSON.stringify(R.countsOf(res.notes))}`);
    for(const m of res.moves)console.log(m.type==='SLIDE'?`  ${(m.at/1000).toFixed(3)}〜${(m.end/1000).toFixed(3)}秒 空中スライドの手(色) ${m.fromHand} → ${m.toHand}`
      :`  ${(m.at/1000).toFixed(3)}秒 ${m.type} 幅${m.width/2} 位置 ${m.fromX.toFixed(2)} → ${m.toX.toFixed(2)}(押さえ ${m.held})`);
    for(const x of after.list)console.log(`  残り: ${(x.at/1000).toFixed(3)}秒 ${x.what} x=${x.x.toFixed(2)}`);
    if(argOf('--json'))fs.writeFileSync(argOf('--json'),JSON.stringify({songId,diff,before:before.list.map(x=>({at:x.at,x:x.x,what:x.what})),after:after.list.map(x=>({at:x.at,x:x.x,what:x.what})),moves:res.moves},null,1));
    if(args.includes('--write')){writeMoves(songId,diff,res.moves);console.log(`  書いた: ${markerOf(songId,diff)}`);}
    process.exit(0);}
  const h=heldCrosses(c.notes).list;
  console.log(`${songId}/${diff}: 押さえ中の交差 ${h.length}`);
  if(args.includes('--list'))for(const x of h)console.log(`  ${(x.at/1000).toFixed(3)}秒 ${x.what} x=${x.x.toFixed(2)}(押さえ ${x.held.join('・')})`);
}
