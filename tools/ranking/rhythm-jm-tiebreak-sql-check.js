#!/usr/bin/env node
// モンヒロビートの総合・週間・イベントの同点を JUST MARVELOUS で分ける SQL(2026-10-15・社長の決定「案2」)を、
// 手元の PostgreSQL 16 で本番と同じ順番に当てた土台の上で通す。
//   ① 予行演習は何も残さない・本番用は通り、二度流しても同じ・確かめ用(読み取りだけ)が通る
//   ② 既存のビュー・関数・rankings には何も起きない(定義の指紋と件数が同じ)
//   ③ 数え方: 総合は曲ごとのベスト(同点なら JM の多いほう)の合計・週間は期間中の全部・イベントは期間×対象曲のベスト
//      party が無い・壊れている記録は 0。人を絞る引数が効く。anon が呼べる
//   ④ SQL の本文に、記録を消す・書き換える・既存を置き換える文が無い
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.resolve(__dirname, '../..');
const SQL_DIR = path.join(ROOT, 'docs/sql/rankings');
const DB = 'monhero_jm_tiebreak_check';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const readSql = (f) => fs.readFileSync(path.join(SQL_DIR, f), 'utf8');

// ---- ④ 本文(PostgreSQL が無くても見る) ----
const FILES = ['RHYTHM_JM_TIEBREAK_APPLY_TEST.sql', 'RHYTHM_JM_TIEBREAK_APPLY.sql', 'RHYTHM_JM_TIEBREAK_VERIFY.sql'];
{
  const apply = readSql('RHYTHM_JM_TIEBREAK_APPLY.sql').replace(/--[^\n]*/g, '');
  const test = readSql('RHYTHM_JM_TIEBREAK_APPLY_TEST.sql').replace(/--[^\n]*/g, '');
  const verify = readSql('RHYTHM_JM_TIEBREAK_VERIFY.sql').replace(/--[^\n]*/g, '');
  check('本番用は commit で終わり、予行演習は rollback で終わる', /\ncommit;\s*$/.test(apply) && /\nrollback;\s*$/.test(test) && !/\ncommit;/.test(test));
  check('記録を消す・書き換える・表を変える文が無い', ![apply, test].some((s) => /\b(delete|update|truncate|alter\s+table|insert)\b|(?<!on commit )\bdrop\b/i.test(s)));
  const made = [...apply.matchAll(/create or replace function public\.([a-z_]+)/g)].map((m) => m[1]).sort().join(',');
  check('作るのは新しい関数4つだけ(既存の名前を置き換えない)', made === 'rhythm_event_precise,rhythm_party_precise,rhythm_total_precise,rhythm_week_precise', made);
  check('確かめ用は読むだけ', !/\b(create|drop|delete|update|insert|alter|grant|truncate|commit)\b/i.test(verify));
}

const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).status === 0;
if (!has('psql') || !has('pg_ctlcluster') || (process.getuid && process.getuid() !== 0)) {
  console.log('SKIP: PostgreSQL を postgres ユーザーで動かせないので、SQLの実行確認は行いません');
  console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`); process.exit(failed ? 1 : 0);
}
const sh = (cmd) => spawnSync('sh', ['-c', cmd], { encoding: 'utf8' });
if (!/online/.test(sh('pg_lsclusters').stdout || '')) sh('pg_ctlcluster 16 main start');
const psql = (args) => spawnSync('su', ['postgres', '-c', `psql ${args}`], { encoding: 'utf8' });
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-jm-'));
const runFile = (f) => psql(`-v ON_ERROR_STOP=1 -q -d ${DB} -f ${path.join(WORK, f)}`);
const query = (sql) => (psql(`-tA -F '|' -d ${DB} -c ${JSON.stringify(sql)}`).stdout || '').trim();
const asAnon = (sql) => psql(`-tA -F '|' -v ON_ERROR_STOP=1 -d ${DB} -c ${JSON.stringify(`set role anon; ${sql}`)}`);

// 本番をまねた土台(profile-frame-sql-check.js と同じ順番で既存のSQLを当てる)
const BASE = `
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end $$;
do $$ begin if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
create table public.rankings (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_name text, hero text, party jsonb,
  score integer, level integer, icon text, difficulty text, clear_id text,
  reached_wave integer, turns integer, breeder_id text
);
alter table public.rankings enable row level security;
create policy "anyone can read rankings"   on public.rankings for select using (true);
create policy "anyone can insert rankings" on public.rankings for insert with check (true);
grant usage on schema public to anon, authenticated;
grant select, insert on public.rankings to anon, authenticated;
insert into public.rankings (created_at, user_name, hero, party, score, level, icon, difficulty, clear_id, breeder_id) values
 ('2026-10-13 10:00+09','A','MASTER','[{"precise":5}]'::jsonb,  1000, 5, 'Mocchi','Rhythm-song_x-MASTER','a1','bd-a'),
 ('2026-10-13 10:05+09','A','MASTER','[{"precise":3}]'::jsonb,  1000, 5, 'Mocchi','Rhythm-song_y-MASTER','a2','bd-a'),
 ('2026-10-13 09:00+09','B','MASTER','[{"precise":2}]'::jsonb,  1000, 5, 'Suezo', 'Rhythm-song_x-MASTER','b1','bd-b'),
 ('2026-10-13 09:05+09','B','MASTER','[{"precise":2}]'::jsonb,  1000, 5, 'Suezo', 'Rhythm-song_y-MASTER','b2','bd-b'),
 ('2026-10-13 11:00+09','B','HELL',  '[{"precise":9.7}]'::jsonb,1000, 5, 'Suezo', 'Rhythm-song_x-HELL',  'b3','bd-b'),
 ('2026-10-13 08:00+09','C','EASY',  null,                      1000, 5, 'Golem', 'Rhythm-song_x-EASY',  'c1','bd-c'),
 ('2026-10-13 08:01+09','C','EASY',  '{"precise":50}'::jsonb,   1000, 5, 'Golem', 'Rhythm-song_y-EASY',  'c2','bd-c'),
 ('2026-10-13 08:02+09','C','EASY',  '[{"precise":"abc"}]'::jsonb,10, 5, 'Golem', 'Rhythm-song_z-EASY',  'c3','bd-c'),
 ('2026-10-01 08:00+09','D','EASY',  '[{"precise":40}]'::jsonb,  500, 5, 'Golem', 'Rhythm-song_x-EASY',  'd1','bd-d'),
 ('2026-10-13 08:00+09','戦士','Mocchi','[]'::jsonb,               500, 3, 'Golem', 'Normal',            'w1','bd-w');
`;
const BOND_DIR = path.join(ROOT, 'docs/sql/bond-levels');
const CHAIN = ['RHYTHM_TOTAL_APPLY.sql', 'RHYTHM_EVENT_APPLY.sql', 'RHYTHM_EVENT_DETAIL_APPLY.sql', 'RHYTHM_EVENT_BONUS_APPLY.sql',
  'RHYTHM_WEEK_TOTAL_APPLY.sql', 'RANKINGS_SCORE_BIGINT_APPLY.sql', 'BOND_LEVELS_APPLY.sql', 'PROFILE_FRAME_APPLY.sql', 'PROFILE_LOOK_ALL_APPLY.sql'];
const FINGERPRINT = `select md5(string_agg(x, '|' order by x)) from (
  select c.relname || ':' || pg_get_viewdef(c.oid) as x from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'
  union all select p.proname || ':' || pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname not in ('rhythm_party_precise','rhythm_total_precise','rhythm_week_precise','rhythm_event_precise')
  union all select 'rows:' || count(*)::text from public.rankings) t`;

try {
  for (const f of [...CHAIN, ...FILES]) fs.copyFileSync(path.join(f.startsWith('BOND_') ? BOND_DIR : SQL_DIR, f), path.join(WORK, f));
  fs.writeFileSync(path.join(WORK, '00-base.sql'), BASE);
  fs.chmodSync(WORK, 0o755); for (const f of fs.readdirSync(WORK)) fs.chmodSync(path.join(WORK, f), 0o644);
  psql(`-q -c "drop database if exists ${DB}"`);
  check('検査用のデータベースを作れる', psql(`-q -c "create database ${DB}"`).status === 0);
  const base = runFile('00-base.sql');
  check('本番をまねた rankings を用意できる', base.status === 0, (base.stderr || '').trim().slice(0, 200));
  for (const f of CHAIN) { const r = runFile(f); check(`既存のSQLが通る: ${f}`, r.status === 0, (r.stderr || '').trim().slice(0, 200)); }
  const before = query(FINGERPRINT);
  const verifyBefore = runFile('RHYTHM_JM_TIEBREAK_VERIFY.sql');
  check('当てる前: 確かめ用の①は通る(②〜④は関数が無いので止まってよい)', /関数が?|does not exist/.test(verifyBefore.stderr || '') || verifyBefore.status === 0);
  const t = runFile('RHYTHM_JM_TIEBREAK_APPLY_TEST.sql');
  check('予行演習が通る', t.status === 0, (t.stderr || '').trim().slice(0, 300));
  check('予行演習は何も残さない', query("select count(*) from pg_proc where proname like 'rhythm_%_precise'") === '0');
  const a = runFile('RHYTHM_JM_TIEBREAK_APPLY.sql');
  check('本番用が通る', a.status === 0, (a.stderr || '').trim().slice(0, 300));
  check('もう一度流しても通る(何度流しても同じ)', runFile('RHYTHM_JM_TIEBREAK_APPLY.sql').status === 0);
  check('既存のビュー・関数・rankings の件数は何も変わらない', query(FINGERPRINT) === before);
  const v = runFile('RHYTHM_JM_TIEBREAK_VERIFY.sql');
  check('確かめ用(読み取りだけ)が通る', v.status === 0, (v.stderr || '').trim().slice(0, 300));

  const map = (sql) => Object.fromEntries(query(sql).split('\n').filter(Boolean).map((l) => l.split('|')));
  const total = map('select identity_key, total_precise from public.rhythm_total_precise()');
  check('総合: 曲ごとのベスト(同じ点なら JM の多いほう)の合計', total['bd-a'] === '8' && total['bd-b'] === '11', JSON.stringify(total));
  check('総合: party が無い・形が違う・数でない記録は 0', total['bd-c'] === '0');
  check('総合: 総合ランキングと同じ人数', query('select count(*) from public.rhythm_total_rankings') === String(Object.keys(total).length));
  const week = map("select identity_key, total_precise from public.rhythm_week_precise('2026-10-12 05:00+09','2026-10-19 05:00+09')");
  check('週間: 期間中に出した記録すべての合計・期間外は数えない', week['bd-a'] === '8' && week['bd-b'] === '13' && week['bd-d'] === undefined, JSON.stringify(week));
  const ev = map("select identity_key, total_precise from public.rhythm_event_precise(array['song_x'],'2026-10-12 05:00+09','2026-10-19 05:00+09')");
  check('イベント: 期間×対象曲のベストの合計', ev['bd-a'] === '5' && ev['bd-b'] === '9' && ev['bd-c'] === '0' && ev['bd-d'] === undefined, JSON.stringify(ev));
  const only = map("select identity_key, total_precise from public.rhythm_total_precise(array['bd-b'])");
  check('人を絞る引数が効く', Object.keys(only).join() === 'bd-b' && only['bd-b'] === '11');
  const anon = asAnon("select count(*) from public.rhythm_total_precise(); select count(*) from public.rhythm_week_precise(now()-interval '30 days', now()); select count(*) from public.rhythm_event_precise(array['song_x'], now()-interval '30 days', now())");
  check('anon が呼べる', anon.status === 0, (anon.stderr || '').trim().slice(0, 200));
} finally {
  psql(`-q -c "drop database if exists ${DB}"`);
  try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {}
}
console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed ? 1 : 0);
