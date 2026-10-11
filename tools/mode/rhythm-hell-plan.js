// HELL(MASTER の上の6段目・空中ノーツあり・デバッグ専用)の「空中の区間」を、MASTER の譜面から決める(2026-10-11 Grievous Lady で作った)。
//
// 作り方: MASTER の譜面はそのまま使い、区間 [始まり,終わり,'L'|'R'] の間だけ、その親指(左=道の左半分・右=右半分)が叩くタップとフリックを空中へ移す。
// 実行時の置き換えは rhythm-mode.js の rhythmHellFromMaster(ノーツ, 区間)。ここでは区間を決めて数字を出すだけ。
// 決まり(2026-10-11 ビート部・Sheriruth の HELL で決めたもの):
//   ・同じ親指が地上と空中を行き来するときは約1.5拍あける(区間の切れ目は、その親指のノーツの間が1.5拍以上ある所に置く)
//   ・人が2段を見分ける時間 R=0.2秒: 段が変わる直前・直後の 0.2秒以内に、同じ親指の別の段のノーツを置かない(上の1.5拍で必ず満たす)
//   ・ホールド・スライド・同時押しの片方は地上のまま(押さえている指を空中へ動かさない)
//   ・速さの演出の最中は地上のまま(--quiet で区間を渡す)
// 使い方:
//   node tools/mode/rhythm-hell-plan.js --song grievous_lady [--blocks 2] [--from-bar 8] [--quiet 16240-18525,93954-96383,131725-132526]
//   出力: 区間の表(そのまま rhythm-mode.js へ貼る)と、空中の割合・段の行き来の最短の間・決まりに外れる数
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:fallback;};
const SONG=arg('--song','grievous_lady');
const BLOCK_BARS=Number(arg('--blocks','2'))||2;
const FROM_BAR=Number(arg('--from-bar','8'))||0;
const QUIET=(arg('--quiet','')||'').split(',').filter(Boolean).map(s=>s.split('-').map(Number));
const ctx={Object,Number,Math,JSON,Array,String,Date,Infinity,NaN};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')}
this.out={songs:RHYTHM_SONGS,beats:RHYTHM_SONG_BEATS,thumbOf:rhythmHellThumb,hell:rhythmHellFromMaster};`,ctx);
const song=ctx.out.songs.find(s=>s.songId===SONG);
if(!song){console.log(`曲が見つかりません: ${SONG}`);process.exit(1);}
const notes=[...song.difficulties.MASTER.notes].sort((a,b)=>a.timeMs-b.timeMs);
const [beatMs,zeroMs,perBar]=ctx.out.beats[SONG];
const barMs=beatMs*perBar,GAP=beatMs*1.5,R=200;
// 親指: 道の左半分=L・右半分=R(サブレーン12本の真ん中で分ける)
const thumbOf=ctx.out.thumbOf;
const byThumb={L:notes.filter(n=>thumbOf(n)==='L'),R:notes.filter(n=>thumbOf(n)==='R')};
const end=notes[notes.length-1].timeMs;
const holdsOf=th=>byThumb[th].filter(n=>Number(n.endTimeMs)>n.timeMs);
const PATTERN=['L','R',null,'R','L',null];
const plan=[];
for(let bar=FROM_BAR,k=0;zeroMs+(bar+BLOCK_BARS)*barMs<end;bar+=BLOCK_BARS,k++){
  const thumb=PATTERN[k%PATTERN.length];if(!thumb)continue;
  const from=zeroMs+bar*barMs,to=zeroMs+(bar+BLOCK_BARS)*barMs;
  if(QUIET.some(([a,b])=>to+GAP>a&&from-GAP<b))continue;
  // その親指のホールド・スライドが区間にかかるなら使わない
  if(holdsOf(thumb).some(n=>Number(n.endTimeMs)>from-GAP/2&&n.timeMs<to+GAP/2))continue;
  // 切れ目は、その親指のノーツが1.5拍の窓にいちばん少ない所へずらす(抜くノーツを減らす・半小節まで)
  const best=near=>{let pick=near,least=Infinity;
    for(let c=near-barMs/2;c<=near+barMs/2;c+=beatMs/4){const n=byThumb[thumb].filter(x=>Math.abs(x.timeMs-c)<GAP/2).length;
      if(n<least||(n===least&&Math.abs(c-near)<Math.abs(pick-near))){least=n;pick=c;}}
    return pick;};
  const a=best(from),b=best(to);
  if(holdsOf(thumb).some(n=>Number(n.endTimeMs)>a-GAP/2&&n.timeMs<b+GAP/2))continue;
  plan.push([Math.round(a),Math.round(b),thumb]);
}
const after=ctx.out.hell(notes,plan,GAP);
const sky=new Set(after.filter(n=>n.skyHeight>0));
const removed=notes.length-after.length;
// 数える: 置き換えたあとの譜面で、同じ親指が段を変える間の最短・決まりに外れる数
let minSwitch=Infinity,bad=0,badR=0;
for(const th of ['L','R']){
  const list=after.filter(n=>thumbOf(n)===th);
  for(let i=1;i<list.length;i++){
    if((list[i].skyHeight>0)===(list[i-1].skyHeight>0))continue;
    const prevEnd=Number(list[i-1].endTimeMs)>list[i-1].timeMs?Number(list[i-1].endTimeMs):list[i-1].timeMs,gap=list[i].timeMs-prevEnd;
    minSwitch=Math.min(minSwitch,gap);if(gap<GAP-1)bad++;if(gap<R)badR++;
  }
}
console.log(`HELL の空中の区間(${SONG}・MASTER ${notes.length}ノーツ・${BLOCK_BARS}小節ずつ・${FROM_BAR}小節目から)`);
console.log(`  区間 ${plan.length}個 / 空中へ移すノーツ ${sky.size}個(${(sky.size/after.length*100).toFixed(1)}%)/ 切れ目で抜いたノーツ ${removed}個 → HELL ${after.length}ノーツ`);
console.log(`  同じ親指が段を変える間の最短 ${Math.round(minSwitch)}ms(決まり ${Math.round(GAP)}ms=1.5拍)/ 1.5拍に足りない ${bad}か所 / 0.2秒に足りない ${badR}か所`);
console.log(JSON.stringify(plan));
process.exit(bad||badR?1:0);
