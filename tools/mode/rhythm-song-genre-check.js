#!/usr/bin/env node
// 曲えらびのジャンル(タブ)とお気に入り(2026-09-26・ユーザー指示
// 「オール、オリジナル、コラボ、イベント、お気に入り。あとはこれから追加できる仕組みを」)を見る。
//
//   ・ジャンルは RHYTHM_GENRES の1件ずつで、見分け方は tag / whileEvent / favorite のどれか(画面は書き換えずに増やせる)
//   ・曲の印は RHYTHM_SONG_GENRE_TAGS。書いていない曲は 'original'
//   ・お気に入りは曲えらびの保存値(mh_rhythm_select_v1)の favorites。持っていない既存ユーザーは空で補う
//   ・イベントのタブは開催していなくても出したまま(押せないだけ)
//
//   node tools/mode/rhythm-song-genre-check.js
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const settings=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'),'utf8');
const screens=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/29-rhythm-screens.jsx'),'utf8');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const from=settings.indexOf('const RHYTHM_SORT_ORDERS'),to=settings.indexOf('// ノーツ速度は見た目のtravelだけを変える');
ok('設定の定義を切り出せる',from>0&&to>from);
const ctx={};vm.createContext(ctx);
vm.runInContext(`${settings.slice(from,to)}\nthis.out={RHYTHM_GENRES,RHYTHM_SONG_GENRE_TAGS,rhythmSongGenreTags,normalizeRhythmSelectView,DEFAULT_RHYTHM_SELECT_VIEW,RHYTHM_FAVORITES_MAX};`,ctx);
const X=ctx.out;

const ids=X.RHYTHM_GENRES.map(item=>item.id);
ok('ジャンルは ALL・オリジナル・コラボ・イベント・お気に入り の順',JSON.stringify(ids)==='["all","original","collab","event","favorite"]',ids.join(','));
ok('保存値になる前からのid(all / event)を残している',ids.includes('all')&&ids.includes('event'));
ok('ALL以外は、見分け方(tag / whileEvent / favorite)をどれか1つ持つ',
  X.RHYTHM_GENRES.filter(item=>item.id!=='all').every(item=>[!!item.tag,!!item.whileEvent,!!item.favorite].filter(Boolean).length===1));
ok('印を書いていない曲はオリジナル',JSON.stringify(X.rhythmSongGenreTags({songId:'monster_hero'}))==='["original"]');
ok('表に書いた曲はその印になる(もう一つの世界へ=コラボ)',X.rhythmSongGenreTags({songId:'mou_hitotsu_no_sekai_e'}).includes('collab'));

const n=X.normalizeRhythmSelectView;
ok('お気に入りを持っていない保存値は空で補う',Array.isArray(n({sort:'name'}).favorites)&&n({sort:'name'}).favorites.length===0&&n(null).favorites.length===0);
ok('お気に入りは文字列だけ・重なりなし',JSON.stringify(n({favorites:['a','b','a',3,null,'']}).favorites)==='["a","b"]');
ok('お気に入りは上限まで',n({favorites:Array.from({length:500},(_,i)=>`s${i}`)}).favorites.length===X.RHYTHM_FAVORITES_MAX);
ok('今までの項目はそのまま読める',n({sort:'level',desc:true,noticeOpen:false,genre:'event'}).sort==='level'&&n({genre:'event'}).genre==='event'&&n({eventOnly:true}).genre==='event');
ok('新しいジャンルのidも保存値として読める',n({genre:'favorite'}).genre==='favorite'&&n({genre:'collab'}).genre==='collab'&&n({genre:'nope'}).genre==='all');

ok('画面はジャンルを RHYTHM_GENRES から並べる(idを書き写さない)',
  screens.includes('const genres=RHYTHM_GENRES;')&&screens.includes('if(item.tag)return rhythmSongGenreTags(entry).includes(item.tag);')
  &&!/genre\.id===['"](original|collab|favorite)['"]/.test(screens));
ok('イベントのタブは開催していなくても出したまま押せなくする',
  screens.includes('const genreUsable=item=>!item.whileEvent||eventActive;')&&screens.includes('disabled={!usable}'));
ok('お気に入りの付け外しは曲えらびの保存値へ',screens.includes('setView({...state,favorites:next});')&&screens.includes('data-rhythm-song-favorite'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
