#!/usr/bin/env node
// 同じ難易度のノーツの幅が1種類に偏っていないかを見張る(2026-11-22・ビート・台帳 r1119-105 の続き)。
//
//   node tools/mode/rhythm-width-variety-check.js
//
// 【なぜ要るか】社長「あつみゅあの曲の譜面変じゃない？ 全部ノーツが小さい」。
//   Beyond the Same Sky の MASTER・HELL を歌い分けで組み直した道(tools/mode/rhythm-vocal-split-chart.js)で、
//   生成器の幅の付け方が効かず、MASTER は全部幅3・HELL は全部幅2になっていた。どの検査も幅の偏りは見ていなかった。
// 【見るもの】公開中の全曲の MASTER・HELL(ノーツ100以上)。スライドを除いた地上・空中のタップ・フリック・ホールドのうち、
//   いちばん多い幅が 95% 以上なら NG。前からそういう作りの譜面(参考動画どおりに作った sheriruth)だけは控えで許す。
// 【足した物(2026-11-23・台帳 r1119-116)】社長「ただ同じようなノーツが同じように流れてくるだけ」「スライドやホールドもほとんどなし」。
//   組み直した MASTER はタップ92〜94%・帯(ホールド+スライド)3〜6% で、同じ曲の EXPERT(9〜11%)より少なかった。
//   公開中の MASTER・HELL で ①タップが9割を超える ②帯の割合が同じ曲の EXPERT より低い を NG にする。
//   前からある譜面は控え(rhythm-chart-mix-baseline.json・2026-11-23 の55譜面)で許す。新曲・組み直した譜面は控えに足さない
//   (控えの譜面を直して条件を満たしたら、控えから消す。控えに残っていて条件を満たしている譜面は「控えを消してよい」と出す)
'use strict';
const {loadCharts}=require('./rhythm-held-cross.js');

const LIMIT=0.95,MIN_NOTES=100,DIFFS=['MASTER','HELL'];
// 前からある譜面で、作りとして幅が1種類のもの(参考動画の譜面をそのまま写した)。ここへ足すときは理由を書く
const KNOWN={'sheriruth/MASTER':'参考動画どおり(幅3だけ)','sheriruth/HELL':'参考動画どおり(幅3だけ)'};

const shareOf=notes=>{const g=notes.filter(n=>n&&n.type!=='SLIDE');const m={};for(const n of g){const w=Number(n.subLaneWidth)||2;m[w]=(m[w]||0)+1;}
  const top=Math.max(0,...Object.values(m));return {count:g.length,top:g.length?top/g.length:0,widths:m};};

const {songs,chartOf}=loadCharts();
let ng=0,checked=0;const res=[];
for(const s of songs)for(const d of DIFFS){const c=chartOf(s.songId,d);if(!c||!Array.isArray(c.notes))continue;
  const r=shareOf(c.notes);if(r.count<MIN_NOTES)continue;checked++;
  const key=`${s.songId}/${d}`;if(r.top>=LIMIT&&!KNOWN[key]){ng++;res.push(`${key} いちばん多い幅が ${(r.top*100).toFixed(1)}% ${JSON.stringify(r.widths)}`);}}
// 物差しそのものの確かめ: 全部同じ幅なら NG・混ざっていれば OK
const t1=shareOf(Array.from({length:120},(_,i)=>({type:'TAP',subLaneWidth:2})));
const t2=shareOf(Array.from({length:120},(_,i)=>({type:'TAP',subLaneWidth:2+i%3})));
const ok=(c,label,detail='')=>{console.log(`${c?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!c)ng++;};
ok(t1.top>=LIMIT,'物差し: 全部同じ幅の譜面を偏りとして拾う',`${(t1.top*100).toFixed(0)}%`);
ok(t2.top<LIMIT,'物差し: 幅が混ざった譜面は通す',`${(t2.top*100).toFixed(0)}%`);
ok(res.length===0,`公開中の MASTER・HELL(${checked}譜面)で、ノーツの幅が1種類に偏っていない(いちばん多い幅が ${LIMIT*100}% 未満)`,res.slice(0,6).join(' / '));
// ── タップの割合・帯の割合(r1119-116) ──
const MIX_BASE=require('./rhythm-chart-mix-baseline.json');
const mixOf=notes=>{let tap=0,band=0;for(const n of notes){if(n.type==='HOLD'||n.type==='SLIDE')band++;else if(n.type!=='FLICK')tap++;}
  return {tap:notes.length?tap/notes.length:0,band:notes.length?band/notes.length:0};};
const mixBad=(c,e)=>{const r=mixOf(c),why=[];if(r.tap>0.9)why.push(`タップ${(r.tap*100).toFixed(1)}%`);
  if(e&&e.length){const E=mixOf(e);if(r.band<E.band)why.push(`帯${(r.band*100).toFixed(1)}% < EXPERT ${(E.band*100).toFixed(1)}%`);}return why;};
{const bad=[],stale=[];let n=0;
  for(const s of songs){const e=chartOf(s.songId,'EXPERT');for(const d of DIFFS){const c=chartOf(s.songId,d);if(!c||!Array.isArray(c.notes)||c.notes.length<MIN_NOTES)continue;n++;
    const key=`${s.songId}/${d}`,why=mixBad(c.notes,e&&e.notes);
    if(why.length&&!MIX_BASE[key])bad.push(`${key} ${why.join('・')}`);if(!why.length&&MIX_BASE[key])stale.push(key);}}
  const T=k=>({type:k});const flat=[...Array(95).fill(T('TAP')),...Array(5).fill(T('HOLD'))],ex=[...Array(90).fill(T('TAP')),...Array(10).fill(T('HOLD'))];
  ok(mixBad(flat,ex).length===2,'物差し: タップ95%・帯がEXPERTより少ない譜面を拾う',mixBad(flat,ex).join('・'));
  ok(mixBad([...Array(80).fill(T('TAP')),...Array(15).fill(T('SLIDE')),...Array(5).fill(T('FLICK'))],ex).length===0,'物差し: タップ8割・帯15% の譜面は通す');
  ok(bad.length===0,`公開中の MASTER・HELL(${n}譜面)で、タップが9割以下・帯の割合が同じ曲の EXPERT 以上(前からある譜面は控え)`,bad.slice(0,6).join(' / '));
  ok(stale.length===0,'控えに、もう条件を満たした譜面が残っていない(満たしたら rhythm-chart-mix-baseline.json から消す)',stale.join(' / '));}
console.log(ng?`\n${ng}件のNGがあります`:'\nすべてOK');
process.exit(ng?1:0);
