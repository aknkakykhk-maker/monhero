// Grievous Lady の流れの速さの演出(止まる・前へ飛ぶ・後ろへ戻る)が、参考どおりで遊べる形かを数字で見る(2026-10-11)。
//
// ① 全難易度・ノーツ速度3〜10で、判定の前に判定線へ触れるノーツが0個(rhythmScrollEarlyTouches)
// ② 演出の最中(A 拍56〜64・B 拍328〜336.5・C 拍460.3〜464.25)に判定線へ来るノーツが参考と同じ
//    (A 0個・B 0個・C は拍461.75 の同時押しだけ)。「判定前に触れる」とは別の数字
// ③ 止まっている間・戻っている間に、次に叩くノーツが道の上に見えている(待っているノーツ)。位置を参考と並べる
// ④ 飛んだ直後・速く来る間も目で追えるか: 1コマ(60fps)で動く量の最大(道の何割か)を出す
// 参考の数字は参考動画を1コマずつ測った一般化した値だけ(参考の譜面のノーツは置かない)。
//   node tools/mode/grievous-lady-scroll-check.js
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const ctx={Object,Number,Math,JSON,Array,String,Date,Infinity,NaN};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')}
this.out={songs:[...RHYTHM_SONGS,...(typeof RHYTHM_PROTO_SONGS!=='undefined'?RHYTHM_PROTO_SONGS:[])],rhythmScrollSet,rhythmScrollPos,rhythmScrollEarlyTouches,proj:rhythmProjectTravelProgress};`,ctx);
const R=ctx.out;
const TRAVEL={3:5000,4:4000,5:3000,6:2150,7:1680,8:1300,9:1020,10:800};
const BEAT=60000/210,ZERO=2240,ms=b=>ZERO+b*BEAT;
const WINDOWS=[
  {name:'A',from:56,to:64,refHits:[]},
  {name:'B',from:328,to:336.5,refHits:[]},
  {name:'C',from:460.3,to:464.25,refHits:[461.75]},
];
// 待っているノーツの位置(参考動画を測った値・参考の道の奥行きで奥の端0〜判定線1)。[拍, 参考の先頭の位置]
// 参考の道は奥の端が判定線の約8.8倍の遠さ(こちらは2.5倍)なので、比べるのは「道の上での画面の高さ」(奥の端0〜判定線1)
const K_REF=(1/(122.6-92))/(1/268),screenRef=p=>(1/(K_REF-(K_REF-1)*p)-1/K_REF)/(1-1/K_REF);
const REF_WAITING=[['A',61.9,.48],['B',328.4,.54],['B',334,.345],['C',460.8,.56],['C',462.3,.57]];
const songs=R.songs.filter(s=>/^grievous_lady/.test(s.songId));
// ⑤ 押せるか(横持ち・親指2本): ゲームの譜面から、スライドの手は位置で決めて数える(遊ぶ人と同じ)。
//    親指2本のモデル(rhythm-ref-tiers.js の thumbCheck)で押せない・指の交差・届きにくいが0、
//    両手のシミュレート(rhythm-hand-simulate.js)で押せないが0(空中のある譜面は地上のノーツだけで数える)
// 物差しはオンプくんの rhythm-ref-tiers.js --song と同じ(fromRuntime・simulateRuntime・thumbCheck。スライドの手はモデルが選ぶ)。
// 空中のスライドは点の sky を高さとして渡す(fromRuntime は skyHeight だけを読むため)
const {thumbCheck,THUMB_PROFILES,fromRuntime,simulateRuntime}=require('./rhythm-ref-tiers.js');
const pressable=notes=>{
  const d=fromRuntime(notes).map((x,i)=>x.k==='s'&&notes[i].slidePoints?{...x,pts:x.pts.map((p,k)=>[p[0],p[1],p[2],Number(notes[i].slidePoints[k]?.sky)||p[3],p[4]]),hand:notes[i].hand||null}:x);
  const ground=notes.filter(n=>!(n.skyHeight>0)&&!(n.slidePoints||[]).some(p=>p.sky>0));
  return {th:thumbCheck(d,THUMB_PROFILES.landscape,500).count,sim:simulateRuntime(ground).impossible|0};
};
ok('Grievous Lady の譜面がある',songs.length>0);
for(const song of songs)for(const [id,chart] of Object.entries(song.difficulties||{})){
  const notes=(chart&&chart.notes)||[];if(!notes.length)continue;
  const tag=`${song.songId}/${id}`;
  ok(`${tag}: 速さの表がある`,Array.isArray(chart.scrollChanges)&&chart.scrollChanges.length>0);
  // ①
  const early=[];for(const [sp,tr] of Object.entries(TRAVEL)){const e=R.rhythmScrollEarlyTouches(chart.scrollChanges,notes,tr,chart.scrollGroups);if(e.length)early.push(`速度${sp}:${e.length}個(${e.slice(0,3).map(n=>Math.round(n.timeMs)).join(',')})`);}
  ok(`${tag}: 判定の前に判定線へ触れるノーツ 0個(速度3〜10)`,early.length===0,early.join(' '));
  { const r=pressable(notes);
    ok(`${tag}: 横持ち・親指2本で押せる(押せない・交差・届きにくい0/両手のシミュレートの押せない0)`,!r.th.impossible&&!r.th.cross&&!r.th.reach&&!r.sim,
      `親指モデル 押せない${r.th.impossible}・交差${r.th.cross}・届きにくい${r.th.reach}/両手のシミュレート 押せない${r.sim}`); }
  // ②
  const counts=WINDOWS.map(w=>{
    const inside=notes.filter(n=>{const a=Number(n.timeMs),b=Number(n.endTimeMs)>a?Number(n.endTimeMs):a;return b>ms(w.from)+1&&a<ms(w.to)-1;});
    const allowed=inside.filter(n=>w.refHits.some(b=>Math.abs(Number(n.timeMs)-ms(b))<=40&&!(Number(n.endTimeMs)>Number(n.timeMs))));
    return {w,inside:inside.length,extra:inside.length-allowed.length,kept:allowed.length};
  });
  ok(`${tag}: 演出の最中に判定線へ来るノーツが参考どおり`,counts.every(c=>c.extra===0),
    counts.map(c=>`${c.w.name} ${c.inside}個${c.w.refHits.length?`(参考 拍${c.w.refHits.join('・')}に2個・こちら${c.kept}個)`:'(参考0個)'}`).join(' / '));
  // ③④(速度6と10で見る)
  if(id==='MASTER'||id==='HELL'){
    for(const sp of [6,10]){
      const tr=TRAVEL[sp];R.rhythmScrollSet(chart.scrollChanges,tr,chart.scrollGroups);
      const waits=REF_WAITING.map(([n,b,ref])=>{
        const now=ms(b),sNow=R.rhythmScrollPos(now);
        const ahead=notes.filter(x=>Number(x.timeMs)>now).map(x=>1-(R.rhythmScrollPos(x.timeMs)-sNow)/tr).filter(p=>p>=0&&p<=1);
        const lead=ahead.length?Math.max(...ahead):null;
        return `${n} 拍${b}: 参考${Math.round(screenRef(ref)*100)}% / こちら${lead==null?'見えない':Math.round(R.proj(lead)*100)+'%'}`;
      });
      console.log(`      ${tag} 速度${sp} 待っているノーツの先頭(画面の高さ) … ${waits.join(' ・ ')}`);
      // 組1(判定線の近くで待つ同時押し)。参考: B は道の約99%・C は約88%(参考の奥行き)
      const pairs=[['B',332,.99],['C',461,.88]].map(([n,b,ref])=>{
        const now=ms(b),near=notes.filter(x=>x.scrollGroup&&Number(x.timeMs)>now).map(x=>R.proj(1-(R.rhythmScrollPos(x.timeMs,x.scrollGroup)-R.rhythmScrollPos(now,x.scrollGroup))/tr));
        return `${n} 拍${b}: 参考${Math.round(screenRef(ref)*100)}% / こちら${near.length?Math.round(Math.max(...near)*100)+'%':'無し'}`;});
      console.log(`      ${tag} 速度${sp} 判定線の近くで待つ同時押し(画面の高さ) … ${pairs.join(' ・ ')}`);
      let maxStep=0,where=0;
      for(const w of WINDOWS)for(let t=ms(w.from)-200;t<ms(w.to)+200;t+=1000/60){const d=Math.abs(R.rhythmScrollPos(t+1000/60)-R.rhythmScrollPos(t))/tr;if(d>maxStep){maxStep=d;where=t;}}
      console.log(`      ${tag} 速度${sp} 演出の中で1コマに動く量の最大 道の${(maxStep*100).toFixed(1)}%(拍${((where-ZERO)/BEAT).toFixed(2)})・ふだんは${(1000/60/tr*100).toFixed(1)}%`);
    }
  }
}
R.rhythmScrollSet(null);
console.log(failed?`\n✗ ${failed}件の失敗`:'\n✓ すべて通過');
process.exit(failed?1:0);
