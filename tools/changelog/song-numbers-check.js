#!/usr/bin/env node
// お知らせ(更新履歴)に書いた曲の数字が、いまの実データと合っているか。
//
//   node tools/changelog/song-numbers-check.js
//
// 【なぜ要るか】(2026-09-08・ユーザー指摘「お知らせの詳細が前のままだからなおしといてね」)
// 「crossing field」の譜面を作り直して Lv.38 → Lv.27 にしたのに、
// 追加を知らせるお知らせの本文が Lv.11/15/26/34/38・242ノーツのままだった。
// このお知らせは**みゅあの告知の本文そのもの**(assistantUpdateNoticeFromChangelog が
// items をページとして使う)なので、放っておくと助手が古い数字を読み上げる。
//
// 譜面を作り直したとき、更新履歴に「作り直した」という新しい項目を足すことは思い出せても、
// **前に書いた項目のほうが古くなる**ことは忘れやすい。機械で拾う。
//
// 見るのは「曲名がタイトルに入っているお知らせ」の中の、
//   ・Lv.◯ が5つ並んでいるところ（EASY〜MASTER）
//   ・「ノーツ数は ◯ ／ ◯ …です」
// の2つだけ。それ以外の文章には触らない(日本語の言い回しまで機械で縛らない)。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const ctx={Object,Number,Math,JSON,Array,String};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8')}
this.out={RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS,RHYTHM_DEMO_DIFFICULTY_IDS};`,ctx);
const {RHYTHM_SONGS,RHYTHM_DEMO_SONG_IDS,RHYTHM_DEMO_DIFFICULTY_IDS:DIFFS}=ctx.out;

// 曲名 → いまのレベルとノーツ数。**長い名前から当てる**。
// 「Monster Hero -Another-」を「Monster Hero」と取り違えると、正しい記述を誤りだと言い出す。
const songs=RHYTHM_DEMO_SONG_IDS
  .map(id=>{
    const song=RHYTHM_SONGS.find(entry=>entry.songId===id);
    if(!song)return null;
    return {
      id,name:song.displayName,
      levels:DIFFS.map(d=>Number(song.difficulties[d]&&song.difficulties[d].level)),
      notes:DIFFS.map(d=>((song.difficulties[d]||{}).notes||[]).length),
    };
  })
  .filter(Boolean)
  .sort((a,b)=>b.name.length-a.name.length);

const changelogCtx={};
vm.runInNewContext(`${fs.readFileSync(path.join(ROOT,'monster-hero/data/changelog.js'),'utf8')}
this.out=CHANGELOG;`,changelogCtx);
const changelog=changelogCtx.out;

const wrong=[];
let compared=0;
for(const entry of changelog){
  const title=String(entry.title||'');
  const song=songs.find(item=>title.includes(item.name));
  if(!song)continue;
  for(const text of (entry.items||[])){
    const body=String(text);
    // 「Lv.11→9」のように**変わったことを書いている**行は、古い数字が出て当たり前なので見ない
    const rewritten=/→\s*\d/.test(body)||/Lv\.\d+\s*→/.test(body);
    const levels=[...body.matchAll(/Lv\.(\d+)/g)].map(m=>Number(m[1]));
    if(levels.length===5&&!rewritten){
      compared++;
      if(!levels.every((value,i)=>value===song.levels[i])){
        wrong.push(`${entry.date} [${song.name}] レベル ${levels.join('/')} → いまは ${song.levels.join('/')}`);
      }
    }
    const noteText=body.match(/ノーツ数は\s*([\d\s／/、]+)\s*です/);
    if(noteText&&!rewritten){
      const got=(noteText[1].match(/\d+/g)||[]).map(Number);
      if(got.length===5){
        compared++;
        if(!got.every((value,i)=>value===song.notes[i])){
          wrong.push(`${entry.date} [${song.name}] ノーツ数 ${got.join('/')} → いまは ${song.notes.join('/')}`);
        }
      }
    }
  }
}

ok('お知らせに書いた曲の数字が、いまの譜面と合っている',wrong.length===0,
  wrong.length?wrong.slice(0,4).join(' ／ '):`${compared}か所を照合`);

// 助手の告知は、お知らせの本文をそのまま読む。
// つまり上のズレは、そのまま「助手が古い数字を言う」ことになる。
const assistants=fs.readFileSync(path.join(ROOT,'monster-hero/data/assistants.js'),'utf8');
ok('助手の告知が、お知らせの本文をそのまま使う作りのままである',
  /pages:\s*items\.slice\(\)/.test(assistants),
  'data/assistants.js の assistantUpdateNoticeFromChangelog');

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
