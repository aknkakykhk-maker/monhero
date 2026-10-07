#!/usr/bin/env node
// タッチの診断(2026-09-30・docs/spec/RHYTHM_TOUCH_DIAG.md)の、送る側・SQL・読む道具を見張る。
//   ① ゲームが送る列を表がすべて持ち、名前・ブリーダーIDは送らない
//   ② SQL は新しい表を1つ作るだけ(ほかの表に触らない)。手元の PostgreSQL 16 で、予行演習は何も残さず、本番は二重に流しても壊れず、
//      anon は追加・読み出しができて、書き換え・削除はできず、形の違う行は受け付けない
//   ③ 読む道具が、作り物の記録から原因を言い当てる(ブラウザが落とした / 手前で消えた / 5本 / 差が無い / 記録が足りない)
'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const {aggregate,diagnose,MIN_PLAYS,compareReported,compareFix,fixesFor,MIN_REPORTED}=require('./rhythm-touch-diag.js');

const ROOT=path.resolve(__dirname,'..','..');
let failed=0;
const ok=(label,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${label}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');

// ── ① 送る側 ──
const play=read('monster-hero/src/parts/30-rhythm-play.jsx'),supa=read('monster-hero/src/parts/26-supabase.jsx');
const sendBlock=(play.match(/const rhythmTouchDiagRecord=[\s\S]*?\n\};/)||[''])[0];
const diagBlock=(play.match(/const rhythmTouchDiagOf=[\s\S]*?\n\};/)||[''])[0];
ok('送り先は rhythm_touch_diagnostics・表が無い(404)・権限が無いと分かったら送るのをやめる',
  /const RHYTHM_TOUCH_DIAG_TABLE = 'rhythm_touch_diagnostics';/.test(supa)&&/res\.status === 404 \|\| res\.status === 401 \|\| res\.status === 403\) rhythmTouchDiagDisabled = true/.test(supa));
ok('名前・ブリーダーIDは送らない',sendBlock.length>0&&!/user_name|breeder|userName|breederId/i.test(sendBlock+diagBlock));
ok('送るのは公開中の曲だけ',/RHYTHM_DEMO_SONG_IDS\.includes\(diag\.song_id\)/.test(sendBlock));
ok('端末に残すのは新しいキー mh_rhythm_touch_diag_v1 だけ(直近20曲)',/const RHYTHM_TOUCH_DIAG_KEY='mh_rhythm_touch_diag_v1';/.test(play)&&/const RHYTHM_TOUCH_DIAG_KEEP=20;/.test(play));

// ── ② SQL ──
const sqlDir='docs/sql/rankings';
const apply=read(`${sqlDir}/RHYTHM_TOUCH_DIAG_APPLY.sql`),test=read(`${sqlDir}/RHYTHM_TOUCH_DIAG_APPLY_TEST.sql`);
const statements=apply.replace(/--[^\n]*/g,'');
ok('SQL は rhythm_touch_diagnostics だけを作り、ほかの表を変えない',!/\b(alter|drop|delete|update|truncate)\b[^;]*\b(rankings|breeder|bond|rhythm_(?!touch_diag))/i.test(statements)
  &&!/\bdrop\s+table\b/i.test(statements)&&/create table if not exists public\.rhythm_touch_diagnostics/.test(statements));
ok('書き換え・削除のポリシーを作らない',!/for\s+(update|delete|all)\b/i.test(statements));
ok('予行演習は rollback で終わり、本番は commit で終わる',/rollback;\s*$/.test(test)&&!/^commit;/m.test(test)&&/^commit;/m.test(apply));
ok('ゲームが送る列を、表がすべて持っている',['device_key','app_build','platform','standalone','song_id','difficulty','note_count','stats','schema_version']
  .every(column=>new RegExp(`\\b${column}\\b`).test(statements)&&new RegExp(`\\b${column}\\s*:`).test(sendBlock)));

const has=cmd=>spawnSync('sh',['-c',`command -v ${cmd}`],{encoding:'utf8'}).status===0;
if(has('psql')&&has('pg_ctlcluster')&&process.getuid&&process.getuid()===0){
  const sh=cmd=>spawnSync('sh',['-c',cmd],{encoding:'utf8'});
  if(!/online/.test(sh('pg_lsclusters').stdout||''))sh('pg_ctlcluster 16 main start');
  const psql=args=>spawnSync('su',['postgres','-c',`psql ${args}`],{encoding:'utf8'});
  const DB='monhero_touch_diag_check';
  const WORK=fs.mkdtempSync(path.join(os.tmpdir(),'touchdiag-'));
  const files=['RHYTHM_TOUCH_DIAG_APPLY_TEST.sql','RHYTHM_TOUCH_DIAG_APPLY.sql','RHYTHM_TOUCH_DIAG_VERIFY.sql'];
  files.forEach(f=>fs.copyFileSync(path.join(ROOT,sqlDir,f),path.join(WORK,f)));
  fs.writeFileSync(path.join(WORK,'00-base.sql'),`
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end $$;
do $$ begin if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
grant usage on schema public to anon, authenticated;
create table public.rankings (id bigint generated always as identity primary key, user_name text, score bigint);
insert into public.rankings (user_name, score) values ('太郎', 1);
`);
  fs.chmodSync(WORK,0o755);fs.readdirSync(WORK).forEach(f=>fs.chmodSync(path.join(WORK,f),0o644));
  const runFile=f=>psql(`-v ON_ERROR_STOP=1 -q -d ${DB} -f ${path.join(WORK,f)}`);
  const query=sql=>(psql(`-tA -d ${DB} -c ${JSON.stringify(sql)}`).stdout||'').trim();
  const asAnon=sql=>psql(`-tA -v ON_ERROR_STOP=1 -d ${DB} -c ${JSON.stringify(`set role anon; ${sql}`)}`);
  try{
    psql(`-q -c "drop database if exists ${DB}"`);
    ok('検査用のデータベースを作れる',psql(`-q -c "create database ${DB}"`).status===0);
    ok('本番をまねた土台を用意できる',runFile('00-base.sql').status===0);
    const t=runFile('RHYTHM_TOUCH_DIAG_APPLY_TEST.sql');
    ok('予行演習が通る',t.status===0,(t.stderr||'').trim().slice(0,200));
    ok('予行演習は何も残さない(rollback)',query("select count(*) from information_schema.tables where table_name='rhythm_touch_diagnostics'")==='0');
    const a=runFile('RHYTHM_TOUCH_DIAG_APPLY.sql');
    ok('本番用が通る',a.status===0,(a.stderr||'').trim().slice(0,200));
    ok('もう一度流しても壊れない(二重適用に強い)',runFile('RHYTHM_TOUCH_DIAG_APPLY.sql').status===0);
    ok('確かめ用(読み取りだけ)が通る',runFile('RHYTHM_TOUCH_DIAG_VERIFY.sql').status===0);
    ok('既存の表(rankings)は何も変わらない',query('select count(*)||\'/\'||max(user_name) from public.rankings')==='1/太郎');
    const good=`insert into public.rhythm_touch_diagnostics (device_key,app_build,platform,standalone,song_id,difficulty,note_count,stats,schema_version) values ('abcdefgh1234','2026-09-30 12:00','ios',true,'mf_ichika_mix','EXPERT',480,'{"pointerOnly":2,"touchStarts":900}'::jsonb,1)`;
    ok('anon は正しい形の行を追加できる',asAnon(good).status===0,(asAnon(good).stderr||'').trim().slice(0,160));
    ok('anon は読み出せる',Number((asAnon('select count(*) from public.rhythm_touch_diagnostics').stdout||'').trim().split('\n').pop())>=1);
    ok('anon は書き換えできない',!/UPDATE [1-9]/.test((asAnon("update public.rhythm_touch_diagnostics set platform='other'").stdout||''))&&query("select count(*) from public.rhythm_touch_diagnostics where platform='other'")==='0');
    ok('anon は削除できない',(()=>{asAnon('delete from public.rhythm_touch_diagnostics');return Number(query('select count(*) from public.rhythm_touch_diagnostics'))>=1;})());
    const bad=[
      ['知らない系統',good.replace("'ios'","'windows'")],
      ['形の違う端末ID',good.replace("'abcdefgh1234'","'NG!'")],
      ['知らない難易度',good.replace("'EXPERT'","'HELL'")],
      ['stats が配列',good.replace(`'{"pointerOnly":2,"touchStarts":900}'::jsonb`,`'[1,2]'::jsonb`)],
      ['stats が大きすぎる',good.replace(`'{"pointerOnly":2,"touchStarts":900}'::jsonb`,`jsonb_build_object('x',repeat('a',9000))`)],
      ['ノーツ数が0',good.replace(",480,",",0,")],
    ];
    bad.forEach(([label,sql])=>ok(`形の違う行は受け付けない(${label})`,asAnon(sql).status!==0));
  }finally{
    psql(`-q -c "drop database if exists ${DB}"`);
    fs.rmSync(WORK,{recursive:true,force:true});
  }
}else console.log('SKIP: PostgreSQL が使えないので、SQLの実行確認は行いません');

// ── ③ 読む道具 ──
let seed=7;const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
const make=(platform,n,{pointerOnly=0,noInput=0,max5=0,cancels=0,late=0}={})=>[...Array(n)].map((_,i)=>({id:`${platform}${i}`,created_at:'2026-09-30T00:00:00Z',platform,standalone:platform==='ios',
  device_key:`${platform}dev${i%7}xx`,note_count:500,
  stats:{touchStarts:600,pointerDowns:600+pointerOnly,matched:600,pointerOnly,recovered:pointerOnly,touchOnly:0,lateStart:0,lateDelivery:late,cancels,
    misses:20,noInputMisses:rnd()<.5?Math.floor(noInput):Math.ceil(noInput),maxTouches:i<n*max5?5:2,maxDelayMs:late?120:20,ignored:0,outside:0,gestures:0}}));
const verdictOf=rows=>diagnose(aggregate(rows)).filter(line=>line.level==='found').map(line=>line.text).join(' / ');
{
  const v=verdictOf([...make('ios',40,{pointerOnly:3}),...make('android',40)]);
  ok('道具: ブラウザがタッチを落としている(ポインタだけ届いた)を言い当てる',/ブラウザがタッチを落としています/.test(v)&&!/入力が1つも来ない/.test(v),v);
}
{
  const v=verdictOf([...make('ios',40,{noInput:6}),...make('android',40,{noInput:1})]);
  ok('道具: 指がブラウザより手前で消えている(入力の無いMISSが多い)を言い当てる',/入力が1つも来ないMISS/.test(v)&&!/ブラウザがタッチを落として/.test(v),v);
}
{
  const v=verdictOf([...make('ios',40,{max5:.3}),...make('android',40)]);
  ok('道具: 同時に5本を言い当てる',/5本/.test(v),v);
}
{
  const v=verdictOf([...make('ios',40,{late:40}),...make('android',40,{late:2})]);
  ok('道具: タッチが遅れて届いている(処理が重い)を言い当てる',/遅れて届いた/.test(v),v);
}
{
  const lines=diagnose(aggregate([...make('ios',40),...make('android',40)]));
  ok('道具: 差が無いときは、差が無いと言う',lines.length===1&&lines[0].level==='none',lines.map(l=>l.text).join(' / '));
}
{
  const lines=diagnose(aggregate(make('ios',MIN_PLAYS-1,{pointerOnly:5})));
  ok('道具: 記録が足りないうちは判定しない',lines.length===1&&lines[0].level==='wait',lines[0]&&lines[0].text);
}
{
  const rows=[...make('ios',30,{pointerOnly:3}),...make('ios',10,{pointerOnly:3}).map(r=>({...r,stats:{...r.stats,assist:true}}))];
  ok('道具: アシストモードの記録は比べる数に入れない',aggregate(rows).find(g=>g.key==='ios').plays===30);
}

// ── ④ 「押したのに反応しないことがあった」の報告(2026-10-01) ──
{
  const reportBlock=(play.match(/const rhythmTouchDiagReport=[\s\S]*?\n\};/)||[''])[0];
  ok('報告: 診断の行を直さず、報告の行を1行足す(stats は kind と playId だけ)',/stats:\{kind:'report',playId:report\.playId\}/.test(reportBlock));
  ok('報告: 名前・ブリーダーIDは送らない・公開中の曲だけ',reportBlock.length>0&&!/user_name|breeder|userName|breederId/i.test(reportBlock)&&/RHYTHM_DEMO_SONG_IDS\.includes\(report\.song_id\)/.test(reportBlock));
  ok('報告: 診断の行に、結ぶための playId と、効いていた直し方を入れる',/playId:rhythmTouchDiagPlayId\(\),fixes:rhythmTouchFixesActive\(\)/.test(diagBlock));
  ok('報告: ボタンはタッチで遊ぶ端末の公開プレイだけ(練習・タイミング合わせ・デバッグは診断そのものを作らない)',
    /const touchDiag=!debugPlay&&!tutorial&&!calibrating\?rhythmTouchDiagOf\(/.test(play)&&/touchDiag&&touchDiag\.platform!=='other'\?/.test(play)&&/\{result\.touchReport&&<div data-rhythm-touch-report/.test(play));
  ok('報告: 同じ曲では1回だけ送る',/touchReportSent===result\.touchReport\.playId/.test(play));
  // 報告の行は数に入れず、playId で結ぶ
  const ios=make('ios',30),android=make('android',30);
  ios.forEach((row,i)=>{row.stats.playId=`p${i}`;if(i<8)row.stats.lateStart=6;});
  const reports=ios.slice(0,8).map((row,i)=>({id:`r${i}`,created_at:row.created_at,platform:'ios',standalone:true,device_key:row.device_key,note_count:500,stats:{kind:'report',playId:row.stats.playId}}));
  const all=[...ios,...android,...reports];
  ok('報告: 報告の行は曲の数に入れない',aggregate(all).find(g=>g.key==='ios').plays===30);
  const compared=compareReported(all);
  const found=compared.lines.filter(line=>line.level==='found');
  ok('報告: 報告のあった曲だけ多い数字を言い当てる(touchstart が来ずにあとで見えた指)',compared.reports===8&&found.length===1&&found[0].metric==='lateStartPer1k',compared.lines.map(l=>l.text).join(' / '));
  const few=compareReported([...ios,...android,...reports.slice(0,MIN_REPORTED-1)]);
  ok('報告: 報告が少ないうちは比べない',few.lines.length===1&&few.lines[0].level==='wait',few.lines[0]&&few.lines[0].text);
}
// ── ⑤ 用意してある直し方(入れてあるのは lateInputEffectDown だけ。ほかは切ってある) ──
{
  const mode=read('monster-hero/data/rhythm-mode.js');
  const fixes=(mode.match(/const RHYTHM_TOUCH_FIXES=\{[\s\S]*?\n\};/)||[''])[0];
  // 2026-10-07 21時: inputAgeCap は標準で切った(ユーザー報告「タップ抜けがひどくなった」。補正の効きすぎを疑い、原因が分かるまで戻す)
  ok('直し方: 公開で入れてあるのは lateInputEffectDown・autoPauseOnHidden だけ(wideEdge・inputAgeCap・smoothSongClock・allPlatforms は切ってある。smoothSongClock は端末の記録からゲームが自分で入れる)',/lateInputEffectDown:true/.test(fixes)&&/wideEdge:false/.test(fixes)&&/allPlatforms:false/.test(fixes)&&/inputAgeCap:false/.test(fixes)&&/smoothSongClock:false/.test(fixes)&&/autoPauseOnHidden:true/.test(fixes)&&(fixes.match(/:true/g)||[]).length===2,fixes.replace(/\s+/g,' ').slice(0,200));
  ok('直し方: 効くのは iPhone だけ',/return rhythmTouchPlatformCache==='ios';/.test(mode));
  ok('直し方: 道の外の受け付けは、切り替えを通して決める',/const margin=laneWidth\/2\*rhythmInputEdgeMarginSubLanes\(\);/.test(mode));
  ok('直し方: タッチの遅れで演出を下げるのは「重いときは演出を自動で控えめに」の中だけ(設定を切った人には効かない)',
    /if\(settingsLiveRef\.current\.autoEffectDown!==false&&stepEffectCapRef\.current\)\{[\s\S]{0,1800}lateBurst=rhythmTouchFixOn\('lateInputEffectDown'\)/.test(play));
  const late=diagnose(aggregate([...make('ios',40,{late:40}),...make('android',40,{late:2})]));
  const picks=fixesFor(late,null).map(item=>item.fix);
  ok('直し方: 「遅れて届いた」の判定には lateInputEffectDown を示す',picks.length===1&&picks[0]==='lateInputEffectDown',picks.join(','));
  ok('直し方: 差が無いときは何も示さない',fixesFor(diagnose(aggregate([...make('ios',40),...make('android',40)])),null).length===0);
}

// ── ⑥ 直し方を入れる前と後の比べ(2026-10-05) ──
{
  const before=make('ios',20,{late:40}),after=make('ios',20,{late:5}).map(r=>({...r,id:`a${r.id}`,stats:{...r.stats,fixes:['lateInputEffectDown']}}));
  const res=compareFix([...before,...after,...make('android',20)],'lateInputEffectDown');
  const good=res.lines.filter(l=>l.level==='good');
  ok('比べ: 入れたあとで「遅れて届いた」が半分以下になれば、良くなったと言う',good.length===1&&good[0].metric==='lateDeliveryPer1k',res.lines.map(l=>l.text).join(' / '));
  ok('比べ: 入れたあと・入れる前に分けて数える(Android は入れない)',res.summary.length===2&&res.summary.every(g=>g.key.startsWith('ios:')));
  const worse=compareFix([...make('ios',20,{late:5}),...make('ios',20,{late:40}).map(r=>({...r,id:`b${r.id}`,stats:{...r.stats,fixes:['lateInputEffectDown']}}))],'lateInputEffectDown');
  ok('比べ: 入れたあとで数字が1.5倍以上に増えたら、悪さを疑う',worse.lines.some(l=>l.level==='bad'&&l.metric==='lateDeliveryPer1k'),worse.lines.map(l=>l.text).join(' / '));
  const wait=compareFix(make('ios',30),'lateInputEffectDown');
  ok('比べ: 入れたあとの記録が無いうちは、足りないと言う(比べない)',wait.lines.length===1&&wait.lines[0].level==='wait',wait.lines[0]&&wait.lines[0].text);
  ok('比べ: 報告の行は数に入れない',compareFix([...before,...after,{id:'r1',platform:'ios',stats:{kind:'report',playId:'x',fixes:['lateInputEffectDown']}}],'lateInputEffectDown').summary.find(g=>g.key==='ios:入れたあと').plays===20);
}

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);
