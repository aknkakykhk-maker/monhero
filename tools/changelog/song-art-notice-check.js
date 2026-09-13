#!/usr/bin/env node
// モンヒロビートの新曲を知らせるお知らせに、ジャケットの絵が付いているか。
//
//   node tools/changelog/song-art-notice-check.js
//
// 【なぜ要るか】(2026-09-13・ユーザー指示「今後の新曲更新はお知らせにジャケット画もつけて」)
// 更新履歴の項目に image を書くと、更新情報の詳細にも、みゅあの告知にも同じ絵が出る
// (assistantUpdateNoticeFromChangelog が entry.image をそのまま持ってくる)。
// 書き忘れても画面はふつうに動いてしまい、「曲は増えたのにどんな曲か分からない」状態に
// 気づけないため、機械で拾う。
//
// 見るのは「その曲の曲名がタイトルに入っていて、助手の告知(type:'content')を付けた項目」だけ。
// 譜面の作り直し・不具合修正のお知らせには要らない。
//
// 【いつからか】
// ユーザーの指示は「今後の」なので、指示より前のお知らせ(FROM_DATE より古いもの)は対象外。
// 遡って足す必要はない。
//
// 【ほかの曲の難易度を混ぜない】(2026-09-13・ユーザー指摘
// 「違う譜面の難易度を出す文面はそもそもおかしくない？」)
// FREEDOM DiVE↓ のお知らせに「これまでの最高は EASY Lv.10／…／MASTER Lv.38 でした」と
// **比較のつもりでほかの曲(SIX ÉTERNEL)の数字**を並べて書いてしまい、
// その曲の難易度と見分けがつかなくなった。新曲のお知らせに出してよい Lv. は
// **その曲のものだけ**。1行にLv.の5つ組が2回出ていたら、それは比較を書いている。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
const FROM_DATE='2026-09-13';
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const ctx={Object,Number,Math,JSON,Array,String};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')}
this.out={RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS};`,ctx);
const {RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS}=ctx.out;

// 曲名 → その曲のジャケット。**長い名前から当てる**
// (「Monster Hero -Another-」を「Monster Hero」と取り違えないため)。
const songs=RHYTHM_DEMO_SONG_IDS
  .map(id=>{
    const song=RHYTHM_SONGS.find(entry=>entry.songId===id);
    if(!song)return null;
    // artwork は 'images/song-art/xxx.jpg?v=…' の形。キャッシュキーは比べない
    // (build.js が中身のハッシュで付け替えるので、ここで縛ると毎回ずれる)。
    const artwork=String(song.artwork||'').split('?')[0];
    return {id,name:String(song.displayName||''),artwork};
  })
  .filter(song=>song&&song.name)
  .sort((a,b)=>b.name.length-a.name.length);

const changelogCtx={};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/changelog.js'),'utf8')}
this.out=CHANGELOG;`,changelogCtx);
const changelog=changelogCtx.out;

const missing=[],wrongPath=[],notFound=[];
let checked=0;
for(const entry of changelog){
  const date=String(entry.date||'');
  if(date.slice(0,10)<FROM_DATE)continue;
  const notice=entry.assistantNotice;
  // 新曲のお知らせ＝曲名がタイトルに入っていて、助手の告知(content)を付けたもの
  if(!notice||notice.type!=='content')continue;
  const title=String(entry.title||'');
  const song=songs.find(item=>title.includes(item.name));
  if(!song)continue;
  checked++;
  const image=String(entry.image||'').split('?')[0];
  if(!image){missing.push(`${date} ${title}`);continue;}
  if(song.artwork&&image!==song.artwork){
    wrongPath.push(`${date} ${song.name}: image=${image} / その曲の絵=${song.artwork}`);
    continue;
  }
  if(!fs.existsSync(path.join(ROOT,'monster-hero',image)))notFound.push(`${date} ${image}`);
}

ok(`新曲のお知らせにジャケットの絵が付いている（${FROM_DATE} 以降）`,missing.length===0,
  missing.length?missing.join(' / '):`${checked}件を照合`);
ok('お知らせの絵が、その曲のジャケットと同じものを指している',wrongPath.length===0,wrongPath.join(' / '));
ok('お知らせの絵のファイルが実在する',notFound.length===0,notFound.join(' / '));

// ── ほかの曲の難易度を混ぜていないか ────────────────────────────────────────
// 「Lv.◯ が5つ並ぶ」かたまりが1行に2回以上あれば、片方はこの曲のものではない。
const mixed=[];
for(const entry of changelog){
  const date=String(entry.date||'');
  if(date.slice(0,10)<FROM_DATE)continue;
  const notice=entry.assistantNotice;
  if(!notice||notice.type!=='content')continue;
  const title=String(entry.title||'');
  const song=songs.find(item=>title.includes(item.name));
  if(!song)continue;
  for(const text of (entry.items||[])){
    const body=String(text);
    // 「Lv.11→9」のように変化を書いている行は、作り直しの記録なので対象外
    if(/Lv\.\s*\d+\s*(?:→|->)/.test(body))continue;
    // 「Lv.◯」が5つ続くかたまり。区切りの中に 'Lv.' が現れないことを否定先読みで見る
    // （[^Lv] と書くと NORMAL の L で止まってしまい、いちども拾えなかった）。
    const groups=body.match(/(?:Lv\.\s*\d+(?:(?!Lv\.).){0,40}){5}/g)||[];
    if(groups.length>=2)mixed.push(`${date} ${song.name}: ${body.slice(0,60)}…`);
    // 曲名で名指しして数字を出しているものも拾う
    for(const other of songs){
      if(other.id===song.id)continue;
      if(body.includes(other.name)&&/Lv\.\s*\d+|\d+\s*回/.test(body))
        mixed.push(`${date} ${song.name}: ほかの曲「${other.name}」の数字が混ざっている`);
    }
  }
}
ok('新曲のお知らせに、ほかの曲の難易度を混ぜていない',mixed.length===0,
  mixed.join(' / ')||'その曲の Lv. だけを書いている');

// 絵は更新履歴の image を助手の告知がそのまま使う。2か所に書く形へ戻っていないかを見る。
const assistants=fs.readFileSync(path.join(ROOT,'monster-hero/data/assistants.js'),'utf8');
ok('助手の告知が、お知らせの image をそのまま使う作りのままである',
  /image:\s*typeof entry\.image === 'string'/.test(assistants),
  'data/assistants.js の assistantUpdateNoticeFromChangelog');

console.log(failed?`\nNG が ${failed} 件あります`:'\nすべてOK');
process.exit(failed?1:0);
