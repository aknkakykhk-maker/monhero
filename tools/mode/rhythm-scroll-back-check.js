// 速さの表の「後ろに戻る」(倍率がマイナス・[時刻,'MOVE',割合])を確かめる(2026-10-11 Grievous Lady の試作)。
//
// ① 戻る区間の無い表(公開中の Sheriruth・試作の枠の表)は、直す前の計算とまったく同じ位置・時刻を返すか
// ② 戻る表で、どのノーツも判定の時刻ちょうどに判定線へ着くか(判定はずれない)
// ③ 'MOVE' の割合が、ノーツ速度3〜10のどれでも同じ見え方(道の何割動くか)になるか
// ④ ノーツを探す打ち切り(この先いちばん手前へ来る位置で判断)で、見えるはずのノーツを1つも落とさないか(総当たりと比べる)
// ⑤ 「判定の前に判定線へ触れてしまうノーツ」の数え方(rhythmScrollEarlyTouches)が、触れない表で0・触れる表で1以上を返すか
// 数字は一般化した例(参考譜面のノーツは使わない)。
//   node tools/mode/rhythm-scroll-back-check.js
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const ctx={Object,Number,Math,JSON,Array,String,Date,Infinity,NaN,console};
vm.runInNewContext(`${source}
this.out={RHYTHM_SCROLL,rhythmScrollSet,rhythmScrollPos,rhythmScrollTimeAt,rhythmScrollMinAfter,rhythmScrollEarlyTouches,
  songs:[...RHYTHM_SONGS,...(typeof RHYTHM_PROTO_SONGS!=='undefined'?RHYTHM_PROTO_SONGS:[])]};`,ctx);
const R=ctx.out;
// ノーツ速度 3〜10 の、道を流れる時間(28-rhythm-shared.jsx の RHYTHM_NOTE_TRAVEL_MS_POINTS と同じ。速度1始まり)
const TRAVEL={3:5000,4:4000,5:3000,6:2150,7:1680,8:1300,9:1020,10:800};

// ── ① 直す前の計算(戻らない表だけを読む版)をここに写しておき、比べる ──
const old=(()=>{
  let points=null;
  const set=(changes,travelMs)=>{
    const raw=(Array.isArray(changes)?changes:[]).filter(c=>Array.isArray(c)&&Number.isFinite(Number(c[0]))).slice().sort((a,b)=>Number(a[0])-Number(b[0]));
    const travel=Number(travelMs)>0?Number(travelMs):2150;
    const list=raw.map((c,i)=>{
      if(c[1]!=='RUSH')return [Number(c[0]),Number(c[1])];
      const next=raw[i+1],span=next?Number(next[0])-Number(c[0]):0;
      const reach=Number(c[2])>0?Number(c[2]):.97;
      return [Number(c[0]),span>0?travel*reach/span:1];
    }).filter(([t,m])=>Number.isFinite(t)&&Number.isFinite(m)&&m>=0);
    if(!list.length){points=null;return;}
    points=[{t:list[0][0],s:list[0][0],m:list[0][1]}];
    for(let i=1;i<list.length;i++){const p=points[points.length-1];points.push({t:list[i][0],s:p.s+(list[i][0]-p.t)*p.m,m:list[i][1]});}
  };
  const pos=t=>{const x=Number(t);if(!points||!(x>points[0].t))return x;let lo=0,hi=points.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(points[mid].t<=x)lo=mid;else hi=mid-1;}const p=points[lo];return p.s+(x-p.t)*p.m;};
  const timeAt=s=>{const y=Number(s);if(!points||!(y>points[0].s))return y;let lo=0,hi=points.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(points[mid].s<y)lo=mid;else hi=mid-1;}const p=points[lo];return p.m>0?p.t+(y-p.s)/p.m:(lo+1<points.length?points[lo+1].t:Infinity);};
  return {set,pos,timeAt};
})();
const tables=[];
for(const song of R.songs)for(const [id,chart] of Object.entries(song.difficulties||{}))if(chart&&Array.isArray(chart.scrollChanges))tables.push({name:`${song.songId}/${id}`,changes:chart.scrollChanges});
tables.push({name:'表なし',changes:null});
let diffs=0,checked=0;
for(const tb of tables)for(const travel of Object.values(TRAVEL)){
  old.set(tb.changes,travel);R.rhythmScrollSet(tb.changes,travel);
  if(R.RHYTHM_SCROLL.back){diffs++;continue;}
  const first=tb.changes&&tb.changes.length?Number(tb.changes[0][0]):0;
  for(let t=first-3000;t<first+6000;t+=7){
    checked++;
    const a=R.rhythmScrollPos(t),b=old.pos(t),m=R.rhythmScrollMinAfter(t),ta=R.rhythmScrollTimeAt(a),tb2=old.timeAt(b);
    if(a!==b||m!==a||!(ta===tb2||(ta!==ta&&tb2!==tb2)))diffs++;
  }
}
ok('戻る区間の無い表は、直す前とまったく同じ位置・時刻を返す',diffs===0&&checked>0,`表 ${tables.length}本 × 速度8通り・${checked}点 / 違い ${diffs}`);

// ── 戻る表の例(一般化した形): ふつうに流れる → 2小節かけて奥へ戻る → 加速して戻ってくる → 止まる → 一瞬で後ろへ → 速めに来る ──
const BEAT=60000/210,T0=20000;
const BACK_TABLE=[
  [T0,'MOVE',-.37],[T0+BEAT*6,'MOVE',.52],[T0+BEAT*8,1],
  [T0+BEAT*16,0],[T0+BEAT*17,'MOVE',-.45],[T0+BEAT*17+33,'MOVE',.45],[T0+BEAT*17.5,0],[T0+BEAT*18.2,'MOVE',.44],[T0+BEAT*18.5,1],
];
const noteTimes=[];for(let k=-8;k<=40;k++){const t=T0+BEAT*k/2;if(t>T0&&t<T0+BEAT*8)continue;if(t>T0+BEAT*16&&t<T0+BEAT*18.5)continue;noteTimes.push(t);}

// ② 判定の時刻ちょうどに判定線(位置1)へ着くか
let worst=0;
for(const travel of Object.values(TRAVEL)){
  R.rhythmScrollSet(BACK_TABLE,travel);
  for(const t of noteTimes){const p=1-(R.rhythmScrollPos(t)-R.rhythmScrollPos(t))/travel;worst=Math.max(worst,Math.abs(p-1));}
}
R.rhythmScrollSet(BACK_TABLE,2150);
ok('戻る表になっている(倍率がマイナスの区間がある)',R.RHYTHM_SCROLL.back===true);
ok('戻る表でも、どのノーツも判定の時刻ちょうどに判定線へ着く(判定はずれない)',worst<1e-9,`最大のずれ ${worst}`);

// ③ 'MOVE' の割合は速度によらず同じ見え方
const moved=[];
for(const [sp,travel] of Object.entries(TRAVEL)){
  R.rhythmScrollSet(BACK_TABLE,travel);
  const d1=(R.rhythmScrollPos(T0+BEAT*6)-R.rhythmScrollPos(T0))/travel,d2=(R.rhythmScrollPos(T0+BEAT*17+33)-R.rhythmScrollPos(T0+BEAT*17))/travel;
  moved.push({sp,d1,d2});
}
ok('奥へ戻る量が、ノーツ速度3〜10のどれでも道の37%',moved.every(m=>Math.abs(m.d1+.37)<1e-9),moved.map(m=>`速度${m.sp}:${(m.d1*100).toFixed(1)}%`).join(' '));
ok('一瞬で後ろへ戻る量が、ノーツ速度3〜10のどれでも道の45%',moved.every(m=>Math.abs(m.d2+.45)<1e-9));

// ④ 打ち切りで見えるノーツを落とさないか(総当たりと比べる)
let missed=0,frames=0,scannedMax=0;
for(const travel of Object.values(TRAVEL)){
  R.rhythmScrollSet(BACK_TABLE,travel);
  for(let now=T0-BEAT*6;now<T0+BEAT*22;now+=16.67){
    frames++;
    const sNow=R.rhythmScrollPos(now),horizon=sNow+travel*1.2;
    const visible=noteTimes.filter(t=>{const p=1-(R.rhythmScrollPos(t)-sNow)/travel;return t>=now-200&&p>=-.1&&p<=1.18;});
    const scanned=[];for(const t of noteTimes){if(t<now-200)continue;if(R.rhythmScrollMinAfter(t)>horizon)break;scanned.push(t);}
    scannedMax=Math.max(scannedMax,scanned.length);
    for(const t of visible)if(!scanned.includes(t))missed++;
  }
}
ok('ノーツを探す打ち切りで、見えるはずのノーツを1つも落とさない',missed===0,`${frames}コマ・落とし ${missed}・1コマで調べる最大 ${scannedMax}個(全 ${noteTimes.length}個)`);
// 拍の線の探し始め(rhythmScrollTimeAt)が、その位置へ初めて届く時刻か
R.rhythmScrollSet(BACK_TABLE,2150);
let timeAtBad=0;
for(let s=T0-2000;s<T0+BEAT*20;s+=11){
  const t=R.rhythmScrollTimeAt(s);
  if(!Number.isFinite(t))continue;
  if(Math.abs(R.rhythmScrollPos(t)-s)>1e-6)timeAtBad++;
  for(let u=T0-4000;u<t-1;u+=13)if(R.rhythmScrollPos(u)>=s+1e-6){timeAtBad++;break;}
}
ok('拍の線の探し始めが「その位置へ初めて届く時刻」になっている',timeAtBad===0,`違い ${timeAtBad}`);

// ⑤ 判定の前に判定線へ触れるノーツの数え方
const early=R.rhythmScrollEarlyTouches(BACK_TABLE,noteTimes.map(t=>({timeMs:t})),2150);
ok('この例の表では、判定の前に判定線へ触れるノーツは0個',early.length===0,early.slice(0,3).map(e=>Math.round(e.timeMs)).join(','));
const bad=R.rhythmScrollEarlyTouches(BACK_TABLE,[{timeMs:T0+BEAT*4}],2150);
ok('戻る途中に置いたノーツは「判定の前に触れる」と数えられる(数え方が空振りしていない)',bad.length===1);
// 止まりの終わりにそのままふつうの速さで流すと、止まっている間ノーツが判定線の上で止まって見える(作り間違いの例)
const sitting=R.rhythmScrollEarlyTouches([[T0,0],[T0+BEAT,1]],[{timeMs:T0+BEAT}],2150);
ok('止まっている間に判定線の上で待つノーツも「判定の前に触れる」と数えられる',sitting.length===1);
R.rhythmScrollSet(null);
console.log(failed?`\n✗ ${failed}件の失敗`:'\n✓ すべて通過');
process.exit(failed?1:0);
