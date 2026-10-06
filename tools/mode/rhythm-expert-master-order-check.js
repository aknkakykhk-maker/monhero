#!/usr/bin/env node
// EXPERT のほうが MASTER より「叩く回数」「速い連打」が多い曲を見つける(2026-10-07)。
//
// 【なぜ要るか】(2026-10-07・ユーザー指摘「アニマがマスターよりエキスパートのほうがむずいという声がある」)
// レベル(Lv.)は同時押し・跳び・押さえを重く数えるので、MASTER が同時押しで数を稼ぐと
// 「Lv. は MASTER が上なのに、速い単押しの連打は EXPERT のほうが多い」譜面ができる。
// ANiMA(激しさ strong)は EXPERT Lv.33・叩く回数 522 / MASTER Lv.40・494 で、遊んだ人には EXPERT が難しく感じられた。
// 曲が短く置ける音に限りがあると、EXPERT の時点で音を使い切り、MASTER は数を増やせずに同時押しへ回る。
//
// 見るもの(公開中の曲 RHYTHM_DEMO_SONG_IDS):
//   叩く回数 … 同じ時刻のノーツは1回と数える
//   速い連打 … 前の打鍵から 90ms 以内の打鍵の数
// EXPERT が MASTER を 3% より多く上回ったら NG。直し方は曲の一覧の chartIntensityByDifficulty
// (EXPERT を 'mild' などで軽く・MASTER を 'extreme' などで重く)。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// ユーザーに直すかどうかを聞いている曲(公開中の譜面なので勝手に作り直さない。決まったらここから外す)
// 2026-10-07 に Stay With Me short ver.(EXPERT 518回・連打120 / MASTER 484回・106)もユーザー判断で直したので、いまは空
const KNOWN=Object.freeze({});

const ctx={Object,Number,Math,JSON,Array,String};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')}
this.out={RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS};`,ctx);
const {RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS}=ctx.out;
const measure=chart=>{
  const notes=chart&&Array.isArray(chart.notes)?chart.notes:[];
  const times=[...new Set(notes.map(n=>n.timeMs).filter(Number.isFinite))].sort((a,b)=>a-b);
  let fast=0;for(let i=1;i<times.length;i++)if(times[i]-times[i-1]<=90)fast++;
  return {hits:times.length,fast};
};
const over=(a,b)=>a>b*1.03&&a-b>=3;
let compared=0;const inverted=[];
for(const id of RHYTHM_DEMO_SONG_IDS){
  const song=RHYTHM_SONGS.find(s=>s.songId===id);
  if(!song||!song.difficulties||!song.difficulties.EXPERT||!song.difficulties.MASTER)continue;
  const e=measure(song.difficulties.EXPERT),m=measure(song.difficulties.MASTER);
  if(!e.hits||!m.hits)continue;
  compared++;
  if(over(e.hits,m.hits)||over(e.fast,m.fast))inverted.push({id,e,m});
}
ok('EXPERT と MASTER を比べた曲がある',compared>=20,`${compared}曲`);
const bad=inverted.filter(x=>!KNOWN[x.id]);
ok('EXPERT が MASTER より叩く回数・速い連打で上回る曲が無い(聞いている曲を除く)',bad.length===0,
  bad.map(x=>`${x.id}: EXPERT ${x.e.hits}回・連打${x.e.fast} / MASTER ${x.m.hits}回・連打${x.m.fast}`).join(' ／ ')||'なし');
for(const x of inverted.filter(x=>KNOWN[x.id]))console.log(`  (聞いている曲) ${x.id}: ${KNOWN[x.id]}`);
const stale=Object.keys(KNOWN).filter(id=>!inverted.some(x=>x.id===id));
ok('聞いている曲の一覧に、もう直った曲が残っていない',stale.length===0,stale.join(', ')||'なし');
// ANiMA は直した(2026-10-07)
const anima=RHYTHM_SONGS.find(s=>s.songId==='anima');
if(anima){const e=measure(anima.difficulties.EXPERT),m=measure(anima.difficulties.MASTER);
  ok('ANiMA は MASTER のほうが叩く回数も速い連打も多い',m.hits>e.hits&&m.fast>e.fast,`EXPERT ${e.hits}回・連打${e.fast} / MASTER ${m.hits}回・連打${m.fast}`);}
console.log(failed?`\n✗ ${failed}件NG`:'\nすべてOK');
process.exit(failed?1:0);
