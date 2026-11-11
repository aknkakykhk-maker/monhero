#!/usr/bin/env node
// HELL の Lv. を手ごとに測る物差し(v4・rhythm-hell-level.js・2026-11-11)の決まりを見張る。
//
//   node tools/mode/rhythm-hell-level-check.js            # 見張る
//   node tools/mode/rhythm-hell-level-check.js --update   # 控え(authoring/hell-level-v4-snapshot.json)を今の値で書き直す(重みを合わせ直したとき・HELL を足したとき)
//
// ① 社長の値がある HELL(表示が v3 と違う譜面)は、v4 が社長の値の ±2 以内(v3 は 4〜13 低い)
// ② v4 は v3 より下がらない。段取りの要るノーツが無い譜面は v3 と同じ値。空中の無い譜面は測らない(null)
// ③ 控えにある譜面の v4 は控えと同じ(重み・数え方を知らないうちに変えていない)。控えに無い HELL があれば知らせる
// ④ 内訳: どのまとまりも0以上・「速さと量だけ」+ まとまり + 重なり = 全体
// ⑤ 左右の親指への割り振り: 押さえている手には割り振らない(作った小さい譜面で確かめる)
// ⑥ 参考値のまま: 既定の測り方(levelFormulaFor)は v3・道具はゲームのデータを書き換えない(表示の Lv. は rhythm-chart-level-check.js が見張る)
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const H=require('./rhythm-hell-level.js'),L=require('./rhythm-chart-level.js');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const ROOT=path.resolve(__dirname,'..','..'),DATA=path.join(ROOT,'monster-hero/data/rhythm-mode.js'),SNAP=path.join(__dirname,'authoring','hell-level-v4-snapshot.json');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),before=sha(DATA);
const short=id=>id.replace(/_hell_debug$/,'');

const rows=H.hellCharts().map(c=>({id:c.songId,d:c.difficulty,chart:c.chart,shown:L.shownLevel(c.songId,c.difficulty,c.chart),
  v3:L.chartLevel(c.chart,{formula:'v3'}).level,v4:H.hellLevel(c.chart,{explain:true})}));
if(process.argv.includes('--update')){
  fs.writeFileSync(SNAP,JSON.stringify({note:'HELL の v4 の値の控え(rhythm-hell-level-check.js --update が書く)。参考値で、表示の Lv. ではない',
    weights:H.COORD_WEIGHTS,offset:H.COORD_OFFSET,p:H.COMBINE_P,levels:Object.fromEntries(rows.map(r=>[`${r.id}:${r.d}`,r.v4.level]))},null,1)+'\n');
  console.log(`控えを書きました: ${path.relative(ROOT,SNAP)}(${rows.length}譜面)`);
}

// ①
const anchors=rows.filter(r=>r.shown!==r.v3);
ok('社長の値がある HELL が7譜面以上ある',anchors.length>=7,`${anchors.length}譜面`);
for(const r of anchors)ok(`${short(r.id)}: v4 は社長の値 Lv.${r.shown} の ±2 以内`,Math.abs(r.v4.level-r.shown)<=2,`v3 ${r.v3} / v4 ${r.v4.level}`);
{const e3=Math.max(...anchors.map(r=>Math.abs(r.v3-r.shown))),e4=Math.max(...anchors.map(r=>Math.abs(r.v4.level-r.shown)));
  ok('社長の値との外れの最大は、v4 が v3 の半分以下',e4*2<=e3,`v3 ${e3} / v4 ${e4}`);}
// ②
ok('v4 は v3 より下がらない(全 HELL)',rows.every(r=>r.v4.level>=r.v3),rows.filter(r=>r.v4.level<r.v3).map(r=>short(r.id)).join(','));
{const flat=rows.filter(r=>r.v4.coord===0);ok('段取りの要るノーツが無い譜面は v3 と同じ値',flat.every(r=>r.v4.level===r.v3),`${flat.length}譜面`);}
{const o=L.loadRuntimeSongs(),ground=o.RHYTHM_SONGS.find(s=>s.songId==='haruka').difficulties.MASTER;
  ok('空中の無い譜面は測らない(null)',H.hellLevel(ground)===null);}
ok('合わせ方の形: C が0なら S のまま・S と C が同じなら 2^(1/3) 倍',Math.abs(H.combine(40,0)-40)<1e-9&&Math.abs(H.combine(40,40)-40*Math.cbrt(2))<1e-9);
// ③
if(fs.existsSync(SNAP)){
  const snap=JSON.parse(fs.readFileSync(SNAP,'utf8')),known=rows.filter(r=>snap.levels[`${r.id}:${r.d}`]!=null),fresh=rows.filter(r=>snap.levels[`${r.id}:${r.d}`]==null);
  const moved=known.filter(r=>snap.levels[`${r.id}:${r.d}`]!==r.v4.level);
  ok('控えにある譜面の v4 は控えと同じ',moved.length===0,moved.slice(0,6).map(r=>`${short(r.id)} ${snap.levels[`${r.id}:${r.d}`]}→${r.v4.level}`).join(' / ')||`${known.length}譜面`);
  ok('控えの重みは道具の重みと同じ',JSON.stringify(snap.weights)===JSON.stringify(H.COORD_WEIGHTS)&&snap.offset===H.COORD_OFFSET&&snap.p===H.COMBINE_P);
  if(fresh.length)console.log(`知らせ: 控えに無い HELL が ${fresh.length}譜面(${fresh.slice(0,5).map(r=>short(r.id)).join('・')})。値を見てから --update`);
}else ok('控え(hell-level-v4-snapshot.json)がある',false,'--update で作る');
// ④
{const bad=rows.filter(r=>Object.values(r.v4.groups).some(v=>v<-.011)||r.v4.base>r.v4.exact+.011
    ||Math.abs(r.v4.base+Object.values(r.v4.groups).reduce((a,b)=>a+b,0)+r.v4.overlap-r.v4.exact)>.06);
  ok('内訳: まとまりは0以上・足すと全体になる',bad.length===0,bad.slice(0,4).map(r=>short(r.id)).join(','));
  const stay=rows.find(r=>r.id==='stay_with_me_hell_debug');
  ok('Stay With Me の HELL は「押さえながら」がいちばん効いている',!!stay&&Object.entries(stay.v4.groups).sort((a,b)=>b[1]-a[1])[0][0]==='押さえながら',stay?JSON.stringify(stay.v4.groups):'');}
// ⑤ 左のホールド(0〜2000ms)の間に、左側の空中タップが3つ → 右手が取る(片手で叩く・伸ばす・高さが違う)
{const tap=(t,sub,sky=0)=>({type:'TAP',timeMs:t,lane:Math.floor(sub/2),subLane:sub,subLaneWidth:2,skyHeight:sky});
  const notes=[{type:'HOLD',timeMs:0,endTimeMs:2000,lane:0,subLane:0,subLaneWidth:2,skyHeight:0},tap(500,3,1),tap(1000,3,1),tap(1500,3,1),
    tap(3000,9),tap(3500,9),tap(4000,9),tap(4500,9),tap(5000,2),tap(5500,2)];
  const ex=H.extract({notes}),mid=ex.rows.filter(r=>r.timeMs>=500&&r.timeMs<=1500);
  ok('押さえている手には割り振らない(左のホールド中の左側のノーツは右手)',mid.length===3&&mid.every(r=>r.hand==='R'&&r.f.oneHand===1&&r.f.oneHandFar>0&&r.f.heldSplit===1&&r.f.blocked===0),mid.map(r=>r.hand).join(''));
  const after=ex.rows.filter(r=>r.timeMs>=3000);
  ok('押さえていないときは、側のとおりに割り振る',after.slice(0,4).every(r=>r.hand==='R'&&r.f.oneHand===0)&&after.slice(4).every(r=>r.hand==='L'),after.map(r=>r.hand).join(''));
  ok('同じ親指の地上⇔空中を数える(右手: 空中3つのあと地上)',ex.rows.find(r=>r.timeMs===3000).f.switchAny+ex.rows.find(r=>r.timeMs===3000).f.switchNatural===1);}
// ⑥
ok('既定の測り方は v3 のまま(新しい曲)',L.levelFormulaFor('some_new_song')==='v3');
ok('道具はゲームのデータを書き換えない',sha(DATA)===before);

console.log(failed?`\n${failed} 件の NG`:'\nすべて OK');
process.exit(failed?1:0);
