#!/usr/bin/env node
// 曲えらびのジャンルとお気に入り(2026-09-26・ユーザー指示
// 「オール、オリジナル、コラボ、イベント、お気に入り。あとはこれから追加できる仕組みを」)を見る。
// 同じ日に「ジャンルは常時出すより押して選べるタイプにしたい / いまのとこはイベントとお気に入り以外は
// 作らなくていい」と指示があり、並べるのは ALL・イベント・お気に入りの3つ、選ぶところは押すと下から出る形にした。
//
//   ・ジャンルは RHYTHM_GENRES の1件ずつで、見分け方は tag / whileEvent / favorite のどれか(画面は書き換えずに増やせる)
//   ・曲の印は RHYTHM_SONG_GENRE_TAGS。書いていない曲は 'original'
//   ・お気に入りは曲えらびの保存値(mh_rhythm_select_v1)の favorites。持っていない既存ユーザーは空で補う
//   ・ジャンルは押すと出るシートで選ぶ(常に並べない)。イベントは開催していなくても出したまま(押せないだけ)
//   ・一度出した 'original' / 'collab' の保存値は ALL に倒す(一覧が空になる人を出さない)
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
// 2026-11-11 社長「分け方はそっちに任せる」で出どころの3つ(案A)を足した
ok('ジャンルは ALL・オリジナル・コラボ・ほかの作品・イベント・お気に入り の順',JSON.stringify(ids)==='["all","original","collab","external","event","favorite"]',ids.join(','));
ok('保存値になる前からのid(all / event)を残している',ids.includes('all')&&ids.includes('event'));
ok('ALL以外は、見分け方(tag / whileEvent / favorite)をどれか1つ持つ',
  X.RHYTHM_GENRES.filter(item=>item.id!=='all').every(item=>[!!item.tag,!!item.whileEvent,!!item.favorite].filter(Boolean).length===1));
ok('印を書いていない曲はオリジナル',JSON.stringify(X.rhythmSongGenreTags({songId:'monster_hero'}))==='["original"]');
ok('曲の印の表は、足せる形のまま残っている',X.RHYTHM_SONG_GENRE_TAGS&&typeof X.RHYTHM_SONG_GENRE_TAGS==='object'&&typeof X.rhythmSongGenreTags==='function');

const n=X.normalizeRhythmSelectView;
ok('お気に入りを持っていない保存値は空で補う',Array.isArray(n({sort:'name'}).favorites)&&n({sort:'name'}).favorites.length===0&&n(null).favorites.length===0);
ok('お気に入りは文字列だけ・重なりなし',JSON.stringify(n({favorites:['a','b','a',3,null,'']}).favorites)==='["a","b"]');
ok('お気に入りは上限まで',n({favorites:Array.from({length:500},(_,i)=>`s${i}`)}).favorites.length===X.RHYTHM_FAVORITES_MAX);
ok('今までの項目はそのまま読める',n({sort:'level',desc:true,noticeOpen:false,genre:'event'}).sort==='level'&&n({genre:'event'}).genre==='event'&&n({eventOnly:true}).genre==='event');
ok('新しいジャンルのidも保存値として読める',n({genre:'favorite'}).genre==='favorite'&&n({genre:'nope'}).genre==='all');
ok('2026-09-26 に半日だけ出していたオリジナル・コラボの保存値は、同じ意味のタブとして読める',n({genre:'original'}).genre==='original'&&n({genre:'collab'}).genre==='collab');

// 曲ごとのジャンル(1か所の表)。公開曲の代表の行は全部書いてある・書いた印は一覧にある・版は代表とそろう
{
  const rsrc=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
  const rc={window:{}};vm.createContext(rc);
  vm.runInContext(rsrc+';this.__o={ids:RHYTHM_DEMO_SONG_IDS,head:rhythmSongVersionHead};',rc);
  const ids2=[...rc.__o.ids],head=rc.__o.head;
  const heads=[...new Set(ids2.map(id=>head(id)))];
  const tagIds=new Set(X.RHYTHM_GENRES.filter(g=>g.tag).map(g=>g.tag));
  const missing=heads.filter(id=>!X.RHYTHM_SONG_GENRE_TAGS[id]);
  ok('公開曲の代表の行は、全部ジャンルの表に書いてある(新曲は rhythm-song-add スキルで1行足す)',missing.length===0,missing.join(','));
  const badTag=Object.entries(X.RHYTHM_SONG_GENRE_TAGS).filter(([,t])=>!Array.isArray(t)||!t.length||t.some(x=>!tagIds.has(x))).map(([k])=>k);
  ok('表に書いた印は、どれもジャンルの一覧にある',badTag.length===0,badTag.join(','));
  // 版の解決は画面と同じく rhythmSongVersionHead で(vm の中に関数を渡して確かめる)
  const tagsOf=id=>{const t=X.RHYTHM_SONG_GENRE_TAGS[id]||X.RHYTHM_SONG_GENRE_TAGS[head(id)];return Array.isArray(t)&&t.length?t:['original'];};
  const split=ids2.filter(id=>head(id)!==id&&JSON.stringify(tagsOf(id))!==JSON.stringify(tagsOf(head(id))));
  ok('版のある曲は、版どうしで同じジャンル(版だけ別にするなら、ここで止まるので確かめてから)',split.length===0,split.join(','));
  const counts={};for(const id of heads)for(const t of tagsOf(id))counts[t]=(counts[t]||0)+1;
  console.log('  ジャンルごとの行の数:',JSON.stringify(counts),`/ 代表の行 ${heads.length}・曲 ${ids2.length}`);
}

ok('画面はジャンルを RHYTHM_GENRES から並べる(idを書き写さない)',
  screens.includes('const genres=RHYTHM_GENRES;')&&screens.includes('if(item.tag)return rhythmSongGenreTags(entry).includes(item.tag);')
  &&!/genre\.id===['"](original|collab|favorite)['"]/.test(screens));
ok('イベントのタブは開催していなくても出したまま押せなくする',
  screens.includes('const genreUsable=item=>!item.whileEvent||eventActive;')&&screens.includes('disabled={!usable}'));
ok('ジャンルは常に並べず、押すと出るシートで選ぶ',
  screens.includes('data-rhythm-genre-open')&&screens.includes('{genreOpen&&<div data-rhythm-genre-sheet')
  &&!screens.includes('<nav data-rhythm-genre-tabs'));
ok('お気に入りの付け外しは曲えらびの保存値へ',screens.includes('setView({...state,favorites:next});')&&screens.includes('data-rhythm-song-favorite'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
