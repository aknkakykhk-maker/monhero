#!/usr/bin/env node
// 譜面の「手の決まり」(rhythm-chart-hand-rules.js)を見張る(2026-10-12・オンプくん。社長「譜面製作ツールも今回のことで大きく改良できそうだから更新しといてね」)。
//
//   node tools/mode/rhythm-chart-hand-rules-check.js
//   node tools/mode/rhythm-chart-hand-rules-check.js --update --reason "<理由>"   # 公開中の譜面の件数の控えを書き直す
//
// 見ること:
//   1. 物差しが正しく数える(作った小さな譜面で。同時押しは数えない・長押しの終わりも点に入る・左右はレーンの真ん中で分ける)
//   2. 公開中の全譜面で、どの決まりの件数も控え(rhythm-chart-hand-rules-baseline.json)より増えていない。
//      公開中の譜面は作り直さない(tools/mode/CLAUDE.md ⑩-2)ので、いまの件数を控えにして「これから悪くしない」を見張る。
//      新しい曲を足したら --update --reason で控えに足す(そのとき件数を見て、多ければ置き方を直してから足す)
//   3. 空中の無い公開譜面は、空中の決まり(sideHeightSwitch・skyAfterGround)が0件
//   4. HELL(試作の枠)は件数と場所を出すだけ(公開前・直すかは社長が決める)
//   5. HELL の交差は上下に分ける: 同じ高さのまま左右が入れ替わる「水平クロス」が0(2026-10-13 社長「クロスのときは上下を活用してほしい」)
//   6. 押さえている帯の中にノーツを置かない(2026-10-13 社長「ホールド・スライド中に同じところにノーツを出すのはやめたほうがいい」)。
//      同じ高さで重なる・幅1が絡む半レーンの重なりは0件(地上の押さえと空中のノーツは同じ位置でもよい・両方幅1.5以上の半レーンは許す)。
//      決まりより前からある譜面は rhythm-held-band-existing.json の件数を上限に見るだけ(公開中の譜面は変えない・直すかは社長が決める)。新しい曲・新しい HELL は0
'use strict';
const fs=require('fs'),path=require('path');
const R=require('./rhythm-chart-hand-rules.js');
const BASELINE=path.join(__dirname,'rhythm-chart-hand-rules-baseline.json');
const args=process.argv.slice(2),argOf=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:undefined;};
let ng=0;const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?' — '+detail:''}`);if(!cond)ng++;};

// ── 1. 物差しの正しさ ──
{
  const T=(t,sub,sky=0)=>({type:'TAP',timeMs:t,lane:Math.floor(sub/2),subLane:sub,subLaneWidth:2,...(sky?{skyHeight:1}:{})});
  const H=(t,e,sub)=>({type:'HOLD',timeMs:t,endTimeMs:e,lane:Math.floor(sub/2),subLane:sub,subLaneWidth:2});
  const S=(t,e,lane,skyA,skyB)=>({type:'SLIDE',timeMs:t,endTimeMs:e,lane,endLane:lane,subLaneWidth:2,slidePoints:[{timeMs:t,lane,subLaneWidth:2,sky:skyA},{timeMs:e,lane,subLaneWidth:2,sky:skyB}]});
  // 左手(サブレーン0〜1)で地上→81ms後に空中: 高さの切り替え1・地上から空中1・速い押し始め1
  const a=R.analyze([T(1000,0),T(1081,0,1)]);
  ok('同じ側で81msの地上→空中を、高さの切り替え・地上からの空中・速い押し始めに数える',a.sideHeightSwitch.length===1&&a.skyAfterGround.length===1&&a.fastSameSide.length===1);
  // 同時押し(時間差0)は数えない・左右に分かれていれば数えない
  ok('同時押しは数えない',R.analyze([T(1000,0),T(1000,1,1)]).sideHeightSwitch.length===0);
  ok('左右に分かれた2つは数えない(真ん中はレーン3)',R.analyze([T(1000,0),T(1081,10,1)]).sideHeightSwitch.length===0&&R.sideAt(T(0,4),0)==='L'&&R.sideAt(T(0,5),0)==='R');
  // 長押しの終わり(地上)から72ms後に空中のタップ: 終わりも点に入る
  ok('長押しの終わりも点に入る',R.analyze([H(1000,2000,0),T(2072,1,1)]).sideHeightSwitch.length===1);
  // 150ms ちょうどは数え、151ms は数えない(150ms 以上あける決まり)
  ok('150ms以内を数え、それより開いていれば数えない',R.analyze([T(1000,0),T(1150,0,1)]).sideHeightSwitch.length===1&&R.analyze([T(1000,0),T(1151,0,1)]).sideHeightSwitch.length===0);
  // 空中から始まるスライドも空中として数える
  ok('空中から始まるスライドを、地上からの空中に数える',R.analyze([T(1000,0),S(1200,1800,0.5,1,1)]).skyAfterGround.length===1);
  // 左で押さえている間に左へタップ、右も押さえている → 反対の手もふさがっている
  ok('押さえている帯と同じ側のノーツで、反対の手もふさがっているものを数える',R.analyze([H(1000,3000,0),H(1000,3000,10),T(2000,2)]).besideHeldBand.length===1);
  ok('反対の手が空いていれば数えない',R.analyze([H(1000,3000,0),T(2000,2)]).besideHeldBand.length===0);
  // 右手が右端で長押し中に、右側の地上タップ(サブレーン8)を左手で叩き、143ms後に左側の空中タップへ上がる(テンポくん 52.60秒の型)。
  // レーンの左右で手を分けると「右の地上 → 左の空中」で別の手に見えるが、長押し中の手は使えないので、どちらも左手
  {const a=R.analyze([H(1000,3000,10),T(2000,8),T(2143,4,1)]);
    ok('長押し中の手は使えないとして、反対の手の高さの切り替えを数える(レーンの左右では見えない形)',a.heldHandSwitch.length===1&&a.sideHeightSwitch.length===0&&a.skyAfterGround.length===0,JSON.stringify(a.heldHandSwitch));}
  ok('長押しが無ければ、長押し中の手の数え方では数えない',R.analyze([T(2000,8),T(2143,4,1)]).heldHandSwitch.length===0);
  // 水平クロス: 左の帯が右へ・右の帯が左へ動いて入れ替わる。同じ高さなら数え、交わる瞬間に高さが分かれていれば数えない
  {const X=(t,e,from,to,skyA,skyB)=>({type:'SLIDE',timeMs:t,endTimeMs:e,lane:from,endLane:to,subLaneWidth:2,slidePoints:[{timeMs:t,lane:from,subLaneWidth:2,sky:skyA},{timeMs:e,lane:to,subLaneWidth:2,sky:skyB}]});
    ok('同じ高さのまま左右が入れ替わる2本を、水平クロスに数える',R.flatCross([X(1000,2000,1,4,1,1),X(1000,2000,4,1,1,1)]).length===1&&R.flatCross([X(1000,2000,1,4,0,0),X(1000,2000,4,1,0,0)]).length===1);
    ok('交わる瞬間に片方が空中・片方が地上なら、水平クロスに数えない',R.flatCross([X(1000,2000,1,4,1,1),X(1000,2000,4,1,0,0)]).length===0);
    ok('入れ替わらない2本は数えない',R.flatCross([X(1000,2000,1,2,1,1),X(1000,2000,4,5,1,1)]).length===0);}
  // 押さえている帯の中: 幅1レーン(サブレーン2つ)のホールド(サブレーン2〜3)に、同じ位置のタップは「重なる」、半レーンずれたタップは「幅1が絡む半レーン」。どちらも置かない形
  {const W=(t,sub,w,sky=0)=>({...T(t,sub,sky),subLaneWidth:w}),HW=(t,e,sub,w)=>({...H(t,e,sub),subLaneWidth:w});
    const k=list=>R.onHeldBand(list).map(x=>x.kind).join(',');
    ok('同じ高さで同じ位置は「重なる」、半レーンずれは幅1が絡めば「半レーン(幅1が絡む)」で、どちらも置かない形',k([H(1000,2000,2),T(1500,2)])==='overlap'&&k([H(1000,2000,2),T(1500,3)])==='halfThin'&&R.heldBandBlocked([H(1000,2000,2),T(1500,3)]).length===1);
    ok('両方とも幅1.5レーン以上の半レーンの重なりは許す(数だけ)',k([HW(1000,2000,2,4),W(1500,5,4)])==='halfWide'&&k([HW(1000,2000,2,3),W(1500,4,3)])==='halfWide'&&R.heldBandBlocked([HW(1000,2000,2,3),W(1500,4,3)]).length===0);
    ok('帯の外(端が接するだけ)・地上の押さえと空中のノーツ・押さえる前と離した後は数えない',R.onHeldBand([H(1000,2000,2),T(1500,4)]).length===0&&R.onHeldBand([H(1000,2000,2),T(1500,2,1)]).length===0
      &&R.onHeldBand([H(1000,2000,2),T(1000,2),T(2000,2)]).length===0);
    ok('空中のスライドの帯の中の空中のタップも数える',R.heldBandBlocked([S(1000,2000,1,1,1),T(1500,2,1)]).length===1);
    // 直す道具: 左手で押さえている帯の上のタップを、時刻はそのまま、右(押さえていない手の側)へ半レーンあけて置き直す
    {const list=[H(1000,2000,2),T(1500,2)],res=R.fixHeldBand(list);
      ok('直す道具は、帯の上のタップを押さえていない手の側へ置き直す(時刻はそのまま)',res.moved===1&&list[1].timeMs===1500&&list[1].subLane===5&&R.heldBandBlocked(list).length===0,JSON.stringify(list[1]));}}
}

// ── 2〜4. 公開中の譜面と HELL ──
const {loadRuntimeSongs}=require('./rhythm-chart-level.js');const runtime=loadRuntimeSongs();
const released={};
for(const s of runtime.RHYTHM_SONGS||[])for(const [d,c] of Object.entries(s.difficulties||{}))if(c&&Array.isArray(c.notes))released[`${s.songId}/${d}`]=R.countsOf(c.notes);
if(args.includes('--update')){
  const reason=argOf('--reason');if(!reason){console.error('NG: --update には --reason "<理由>" を付ける');process.exit(1);}
  const old=fs.existsSync(BASELINE)?JSON.parse(fs.readFileSync(BASELINE,'utf8')):{history:[]};
  const changed=Object.keys(released).filter(k=>JSON.stringify((old.charts||{})[k])!==JSON.stringify(released[k]));
  const next={note:'公開中の譜面の「手の決まり」の件数の控え。rhythm-chart-hand-rules-check.js が、これより増えていないかを見る。書き直しは --update --reason',
    rules:R.RULE_LABELS,charts:released,history:[...(old.history||[]),{at:new Date().toISOString().slice(0,16),reason,changed:changed.length}]};
  fs.writeFileSync(BASELINE,JSON.stringify(next,null,1)+'\n');
  console.log(`控えを書き直した(${changed.length}譜面): ${changed.slice(0,10).join(' ')}${changed.length>10?' …':''}`);process.exit(0);}
const base=fs.existsSync(BASELINE)?JSON.parse(fs.readFileSync(BASELINE,'utf8')):null;
ok('控え(rhythm-chart-hand-rules-baseline.json)がある',!!base);
if(base){
  const missing=Object.keys(released).filter(k=>!base.charts[k]);
  ok('公開中の譜面がすべて控えにある(新しい曲は件数を見てから --update --reason で足す)',missing.length===0,missing.slice(0,8).join(' '));
  const worse=[];
  for(const [k,c] of Object.entries(released)){const b=base.charts[k];if(!b)continue;for(const [rule,n] of Object.entries(c))if(n>(b[rule]||0))worse.push(`${k} ${R.RULE_LABELS[rule]} ${b[rule]||0}→${n}`);}
  ok('公開中の譜面で、手の決まりの件数が控えより増えていない',worse.length===0,worse.slice(0,6).join(' / '));
}
const skyInGround=Object.entries(released).filter(([,c])=>c.sideHeightSwitch||c.skyAfterGround).map(([k])=>k);
ok('空中の無い公開譜面は、空中の決まりが0件',skyInGround.length===0,skyInGround.join(' '));
// HELL(試作の枠の空中のある譜面)は件数と場所だけ
for(const s of runtime.RHYTHM_PROTO_SONGS||[])for(const [d,c] of Object.entries(s.difficulties||{})){
  if(!c||!Array.isArray(c.notes)||!c.notes.some(n=>Number(n.skyHeight)>0||(n.slidePoints||[]).some(p=>Number(p.sky)>0)))continue;
  const res=R.analyze(c.notes);
  console.log(`参考: ${s.songId}/${d} `+Object.entries(res).map(([k,v])=>`${R.RULE_LABELS[k]} ${v.length}`+(v.length&&k!=='fastSameSide'?`(${v.slice(0,8).map(x=>(x.at/1000).toFixed(2)).join(' ')}${v.length>8?' …':''})`:'')).join(' / '));}
// 5. HELL(空中のある譜面)の交差は上下に分ける: 同じ高さのまま左右が入れ替わる水平クロスは0(2026-10-13 社長の決定)
{const flats=[];
  for(const s of runtime.RHYTHM_PROTO_SONGS||[])for(const [d,c] of Object.entries(s.difficulties||{})){
    if(!c||!Array.isArray(c.notes)||!R.hasSky(c.notes))continue;
    for(const x of R.flatCross(c.notes))flats.push(`${s.songId}/${d} ${(x.at/1000).toFixed(2)}秒(${x.level})`);}
  ok('HELL の交差は上下に分かれている(水平クロス0)',flats.length===0,flats.slice(0,8).join(' / '));}
// 6. 押さえている帯の中にノーツを置かない(2026-10-13 社長の決定)。前からある譜面は控えの件数を上限に、新しい譜面は0
{const caps=JSON.parse(fs.readFileSync(path.join(__dirname,'rhythm-held-band-existing.json'),'utf8')).charts||{},bad=[];let wide=0;
  for(const s of [...(runtime.RHYTHM_SONGS||[]),...(runtime.RHYTHM_PROTO_SONGS||[])])for(const [d,c] of Object.entries(s.difficulties||{})){
    if(!c||!Array.isArray(c.notes))continue;const key=`${s.songId}/${d}`,all=R.onHeldBand(c.notes),list=all.filter(x=>x.blocked),limit=caps[key]||0;wide+=all.length-list.length;
    if(list.length>limit)bad.push(`${key} ${list.length}件`+(limit?`(上限${limit})`:'')+` ${list.slice(0,6).map(x=>`${(x.at/1000).toFixed(2)}秒(${R.HELD_BAND_KINDS[x.kind]})`).join(' ')}`);}
  ok('押さえている帯の中にノーツを置かない(前からある譜面は控えの件数より増えない・新しい譜面は0)',bad.length===0,bad.slice(0,6).join(' / '));
  console.log(`参考: 両方幅1.5以上の半レーンの重なり(許す) ${wide}件 / 控えに残っている置かない形 ${Object.values(caps).reduce((a,b)=>a+b,0)}件(${Object.keys(caps).length}譜面)`);}
// 7. 見分けにくい所(2026-10-21 社長「見分けづらいってのが相当難易度高い」)。見分けにくい形を入れない決まりで作った HELL は、ゲームに読み込んだ形で0。
//   数え方は同時のノーツの並び順で変わらない(Journey の HELL で、道具の形では0・ゲームの形では2と食い違った)
{const NO_CONFUSE=['rose_hell_debug','rose_short_hell_debug','sad_song_hell_debug','sad_song_short_hell_debug','toward_the_stars_short_hell_debug','anima_hell_debug','journey_hell_debug'];
  const bad=[];
  for(const id of NO_CONFUSE){const s=(runtime.RHYTHM_PROTO_SONGS||[]).find(x=>x.songId===id),c=s&&s.difficulties&&s.difficulties.HELL;
    if(!c||!Array.isArray(c.notes)||!c.notes.length){bad.push(`${id} 譜面が無い`);continue;}
    const cf=R.skyConfusable(c.notes);if(cf.length)bad.push(`${id} ${cf.length}件 ${cf.slice(0,4).map(x=>`${(x.at/1000).toFixed(2)}秒`).join(' ')}`);}
  ok('見分けにくい形を入れない決まりで作った HELL は、ゲームの形で見分けにくい所0',bad.length===0,bad.join(' / '));
  // 同時の点の並びを入れ替えても数が同じ(同じ時刻のノーツを逆順にして数え直す)
  const flip=notes=>{const out=notes.slice().sort((a,b)=>a.timeMs-b.timeMs);for(let i=0;i<out.length;){let j=i;while(j+1<out.length&&out[j+1].timeMs-out[i].timeMs<=2)j++;
    out.splice(i,j-i+1,...out.slice(i,j+1).reverse());i=j+1;}return out;};
  const diff=[];
  for(const s of runtime.RHYTHM_PROTO_SONGS||[])for(const [d,c] of Object.entries(s.difficulties||{})){if(!c||!Array.isArray(c.notes)||!R.hasSky(c.notes))continue;
    const a=R.skyConfusable(c.notes).length,b=R.skyConfusable(flip(c.notes)).length;if(a!==b)diff.push(`${s.songId}/${d} ${a}→${b}`);}
  ok('見分けにくい所の数は、同時のノーツの並び順で変わらない',diff.length===0,diff.slice(0,6).join(' / '));}
console.log(ng?`\n✗ ${ng}件NG`:'\nすべてOK');
process.exit(ng?1:0);
