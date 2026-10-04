#!/usr/bin/env node
// tools/supabase-apply.js(Supabase へ用意したSQLを流す道具)の安全装置を見張る(2026-09-30)。通信はしない。
'use strict';
const {forbiddenIn,isReadOnly,findTrio}=require('./supabase-apply.js');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('タッチの診断の3本組が見つかる',!!findTrio('RHYTHM_TOUCH_DIAG'));
ok('遊んだ記録の3本組が見つかる',!!findTrio('RHYTHM_PLAY_LOG'));
ok('ジャックの3本組が見つかる',!!findTrio('RAID_JACK'));
ok('3本組がそろっていない名前は見つからない(流さない)',!findTrio('RANKINGS_DELETE_KIKI_ULTIMATE'));
const fs=require('fs');
for(const name of ['RHYTHM_TOUCH_DIAG','RHYTHM_PLAY_LOG','RAID_JACK']){
  const trio=findTrio(name);
  ok(`${name} に消す操作が無い(流せる)`,trio.files.every(file=>!forbiddenIn(fs.readFileSync(file,'utf8'))));
}
['drop table public.rankings;','truncate public.rankings;','delete from public.rankings;','alter table public.rankings drop column score;','drop schema public cascade;','DROP   TABLE x;']
  .forEach(sql=>ok(`消す操作を見つけて止める: ${sql}`,!!forbiddenIn(sql)));
ok('コメントの中の「drop table」では止めない',!forbiddenIn('-- drop table はしない\ncreate table if not exists public.x (id int);'));
ok('drop policy / drop view は止めない(作り直しに使う)',!forbiddenIn('drop policy if exists p on public.x; drop view if exists public.v;'));
ok('--query は読み取りだけ通す',isReadOnly('select count(*) from public.rankings')&&isReadOnly('with a as (select 1) select * from a'));
['delete from public.rankings','select 1; delete from public.rankings','update public.rankings set score=0','select 1; drop table x']
  .forEach(sql=>ok(`--query で書き込みは通さない: ${sql}`,!isReadOnly(sql)));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
