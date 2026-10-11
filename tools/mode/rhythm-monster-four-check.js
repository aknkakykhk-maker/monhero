// モンスターノーツは、公開曲のどの難易度にも4個ちょうど(TAP の枠1〜4を1個ずつ)の決まり(2026-10-11 社長「どの曲も基本4個入るルールだよ」)。
// それを外れた譜面があれば落ちる。例外の表は持たない(4個でない譜面は決まり破りとして直す)。
// 見るのは公開曲(RHYTHM_DEMO_SONG_IDS)だけ。検査用の曲(width_test など、ふつうのプレイに出ない曲)は公開曲に入らないので見ない。
// 譜面に載っている難易度はすべて見る(6段目 HELL を公開したら、それも同じく4個)。
// ただし、いま開催中の期間限定イベントの対象曲は「イベント中で後回し」と出して通す
// (monster-hero/data/CLAUDE.md ⑥-4「イベント対象曲の譜面は開催中に触らない」。終わったら直す予定として出すだけで、例外として残すものではない)。
//
// 直し方: 今あるノーツ(t(時刻,サブレーン,幅,枠) の4つ目)に枠を付ける。ノーツの数・時刻は変えない。
// 新しく作る譜面は、生成器(rhythm-chart-v3-generate.js の「13. モンスターノーツ」)が必ず4個置く。
//
//   node tools/mode/rhythm-monster-four-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const ctx={Object,Number,Math,JSON,Array,String,Date};
vm.runInNewContext(`${read('monster-hero/data/rhythm-mode.js')}\n${read('monster-hero/data/rhythm-event.js')}\nthis.out={RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS,RHYTHM_EVENTS:typeof RHYTHM_EVENTS!=='undefined'?RHYTHM_EVENTS:[]};`,ctx);
const {RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS,RHYTHM_EVENTS}=ctx.out;

let failed=0,checked=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// いま開催中の期間限定イベントの対象曲
const now=Date.now();
const liveEventSongs=new Map();
for(const event of Array.isArray(RHYTHM_EVENTS)?RHYTHM_EVENTS:[]){
  if(!event||event.kind!=='limited'||!Array.isArray(event.songIds))continue;
  const start=Date.parse(event.startAt),end=Date.parse(event.endAt);
  if(!(Number.isFinite(start)&&Number.isFinite(end)&&now>=start&&now<end))continue;
  event.songIds.forEach(id=>liveEventSongs.set(id,event.name||event.id));
}

const wrong=[],later=[];
for(const song of RHYTHM_SONGS){
  if(!RHYTHM_DEMO_SONG_IDS.includes(song.songId))continue;
  for(const [difficulty,chart] of Object.entries(song.difficulties||{})){
    const notes=chart&&Array.isArray(chart.notes)?chart.notes:[];
    if(!notes.length)continue;
    checked++;
    const slots=notes.filter(note=>note.type==='TAP'&&Number(note.monsterSlot)>0).map(note=>Number(note.monsterSlot)).sort((a,b)=>a-b);
    // 印の付いた TAP 以外(HOLD などに書いた枠)はゲームが数えないので、別に拾う
    const stray=notes.filter(note=>note.type!=='TAP'&&Number(note.monsterSlot)>0).length;
    if(slots.join(',')==='1,2,3,4'&&!stray)continue;
    const row=`${song.songId} ${difficulty}: 枠[${slots.join(',')}]${stray?`・TAP以外に${stray}個`:''}`;
    if(liveEventSongs.has(song.songId))later.push(`${row}(イベント中で後回し・${liveEventSongs.get(song.songId)}が終わったら直す)`);
    else wrong.push(row);
  }
}
later.forEach(row=>console.log(`… ${row}`));
check('公開曲の譜面がある',checked>0,`${checked}譜面`);
check('公開曲のどの難易度も、モンスターノーツが4個ちょうど(TAP の枠1〜4を1個ずつ)',wrong.length===0,wrong.join(' / '));

if(failed){console.log(`\n${failed}件のNGがあります`);process.exit(1);}
console.log('\nすべてOK');
