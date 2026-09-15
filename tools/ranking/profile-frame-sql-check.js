// docs/sql/rankings/PROFILE_FRAME_*.sql を、実際の PostgreSQL へ流して確かめる。
//
//   node tools/ranking/profile-frame-sql-check.js
//
// PostgreSQL が入っていない環境では SKIP する(検査を落とさない)。
//
// 【なぜ要るか】
// 2026-09-15、予行演習(PROFILE_FRAME_APPLY_TEST.sql)が本番で
//   ERROR: 42P16: cannot change data type of view column "total_score" from numeric to bigint
// で止まった。原因は「リポジトリのSQLに書いてある姿」と「本番のビューの姿」がずれていたこと。
//   ・RHYTHM_TOTAL_APPLY.sql は sum(b.score)::bigint と書いている
//   ・その後 RANKINGS_SCORE_BIGINT_APPLY.sql が score を bigint へ広げ、
//     ビューを pg_get_viewdef の定義で作り直した
//   ・元の ::bigint は「sum(int4) はもともと bigint」なので無意味な変換として消えており、
//     復元後は sum(bigint) = numeric になっていた
//   ・create or replace view は列の型を変えられないので 42P16 で止まる
// SQLはCIで実行していないため、この手のずれは**本番で流すまで分からない**。
// ここでは本番と同じ順番でSQLを流して土台を作り(bigint移行も含めて)、
// そのうえで PROFILE_FRAME_APPLY_TEST → APPLY → VERIFY まで通す。
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '../..');
const SQL_DIR = path.join(ROOT, 'docs/sql/rankings');
const DB = 'monhero_profile_frame_check';
// postgres ユーザーから読める場所へ置く(スクラッチ領域は権限が無いことがある)
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-sqlcheck-'));

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const skip = (why) => { console.log(`SKIP: ${why}`); process.exit(0); };

// ---- PostgreSQL が使えるか ----
const has = (cmd) => spawnSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).status === 0;
if (!has('psql') || !has('pg_ctlcluster')) skip('PostgreSQL が入っていないので、SQLの実行確認は行いません');
if (process.getuid && process.getuid() !== 0) skip('postgres ユーザーで実行できないので、SQLの実行確認は行いません');

const sh = (cmd, opts = {}) => spawnSync('sh', ['-c', cmd], { encoding: 'utf8', ...opts });
// 止まっていれば起動する(すでに動いていればそのまま使う)
if (!/online/.test(sh('pg_lsclusters').stdout || '')) sh('pg_ctlcluster 16 main start');
if (!/online/.test(sh('pg_lsclusters').stdout || '')) skip('PostgreSQL を起動できないので、SQLの実行確認は行いません');

// ---- 本番をまねた土台。score は int4 から始める(bigint移行のずれを再現するため) ----
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
insert into public.rankings (user_name, hero, party, score, level, icon, difficulty, clear_id, breeder_id) values
 ('太郎','EASY','[{"maxCombo":10}]'::jsonb, 1000, 5, 'Mocchi','Rhythm-song_a-EASY','c1','bd-1'),
 ('太郎','HARD','[{"maxCombo":20}]'::jsonb, 2000, 6, 'Mocchi','Rhythm-song_a-HARD','c2','bd-1'),
 ('花子','EASY','[{"maxCombo":30}]'::jsonb, 3000, 9, 'Suezo', 'Rhythm-song_b-EASY','c3','bd-2'),
 ('戦士','Mocchi','[]'::jsonb,               500, 3, 'Golem', 'Normal',            'c4','bd-3');
`;

// 本番へ当てたのと同じ順番。最後の bigint 移行までやって、いまの本番と同じ形にする
const CHAIN = [
  'RHYTHM_TOTAL_APPLY.sql', 'RHYTHM_EVENT_APPLY.sql', 'RHYTHM_EVENT_DETAIL_APPLY.sql',
  'RHYTHM_EVENT_BONUS_APPLY.sql', 'RHYTHM_WEEK_TOTAL_APPLY.sql', 'RANKINGS_SCORE_BIGINT_APPLY.sql',
];
// 絆Lv・総合力ランキングは rankings ではなく bond_levels から読む(別テーブル)
const BOND_CHAIN = ['BOND_LEVELS_APPLY.sql'];
const BOND_SQL_DIR = path.join(ROOT, 'docs/sql/bond-levels');
const PROFILE_FRAME_FILES = [
  'PROFILE_FRAME_APPLY_TEST.sql', 'PROFILE_FRAME_APPLY.sql', 'PROFILE_FRAME_VERIFY.sql',
  'PROFILE_FRAME_BOND_APPLY_TEST.sql', 'PROFILE_FRAME_BOND_APPLY.sql', 'PROFILE_FRAME_BOND_VERIFY.sql',
];

const psql = (args) => spawnSync('su', ['postgres', '-c', `psql ${args}`], { encoding: 'utf8' });
const runFile = (file) => psql(`-v ON_ERROR_STOP=1 -q -d ${DB} -f ${path.join(WORK, file)}`);
const query = (sql) => (psql(`-tA -d ${DB} -c ${JSON.stringify(sql)}`).stdout || '').trim();

try {
  for (const f of [...CHAIN, ...PROFILE_FRAME_FILES]) {
    fs.copyFileSync(path.join(SQL_DIR, f), path.join(WORK, f));
  }
  for (const f of BOND_CHAIN) fs.copyFileSync(path.join(BOND_SQL_DIR, f), path.join(WORK, f));
  fs.writeFileSync(path.join(WORK, '00-base.sql'), BASE);
  fs.chmodSync(WORK, 0o755);
  for (const f of fs.readdirSync(WORK)) fs.chmodSync(path.join(WORK, f), 0o644);

  psql(`-q -c "drop database if exists ${DB}"`);
  const created = psql(`-q -c "create database ${DB}"`);
  check('検査用のデータベースを作れる', created.status === 0, (created.stderr || '').trim().slice(0, 120));
  if (created.status !== 0) throw new Error('createdb failed');

  const base = runFile('00-base.sql');
  check('本番をまねた rankings を用意できる', base.status === 0, (base.stderr || '').trim().slice(0, 200));

  for (const f of [...CHAIN, ...BOND_CHAIN]) {
    const r = runFile(f);
    check(`既存のSQLが通る: ${f}`, r.status === 0, (r.stderr || '').trim().slice(0, 200));
  }
  // bond_levels は BOND_LEVELS_APPLY.sql が作るので、中身はそのあとで入れる
  psql(`-q -d ${DB} -c "insert into public.bond_levels (user_name,individual_id,monster_id,mon_name,bond_level,icon) values ('太郎','m-1','Mocchi','モッチー',50,'Mocchi'),('花子','m-2','Suezo','スエゾー',60,'Suezo')"`);

  // ここが本番と同じ状態になっていることの確認(この前提が崩れたら下の検査の意味が無い)
  check('bigint移行のあと total_score は numeric になる(本番と同じずれを再現できている)',
    query("select data_type from information_schema.columns where table_name='rhythm_total_rankings' and column_name='total_score'") === 'numeric');

  const test = runFile('PROFILE_FRAME_APPLY_TEST.sql');
  check('予行演習(PROFILE_FRAME_APPLY_TEST.sql)が通る', test.status === 0, (test.stderr || '').trim().slice(0, 300));
  check('予行演習は本番へ何も残さない(rollback)',
    query("select count(*) from information_schema.columns where table_name='rankings' and column_name='profile_frame'") === '0');

  const apply = runFile('PROFILE_FRAME_APPLY.sql');
  check('本番用(PROFILE_FRAME_APPLY.sql)が通る', apply.status === 0, (apply.stderr || '').trim().slice(0, 300));
  const again = runFile('PROFILE_FRAME_APPLY.sql');
  check('もう一度流しても壊れない(二重適用に強い)', again.status === 0, (again.stderr || '').trim().slice(0, 200));

  check('profile_frame 列ができている(NULL許容のtext)',
    query("select data_type||'/'||is_nullable from information_schema.columns where table_name='rankings' and column_name='profile_frame'") === 'text/YES');
  check('ビュー4つが profile_frame を返す',
    query("select count(*) from information_schema.columns where column_name='profile_frame' and table_name in ('rhythm_scores','rhythm_identified_scores','rhythm_song_bests','rhythm_total_rankings')") === '4');
  check('関数5つが profile_frame を返す',
    query("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and 'profile_frame' = any(p.proargnames) and p.proname in ('rhythm_event_song_bests','rhythm_event_totals','rhythm_week_score_totals','rhythm_event_song_bests_bonus','rhythm_event_totals_bonus')") === '5');

  // ★集計の型・値を変えていないこと(順位とスコアに触らないのがこの作業の約束)
  check('total_score の型を変えていない(numeric のまま)',
    query("select data_type from information_schema.columns where table_name='rhythm_total_rankings' and column_name='total_score'") === 'numeric');
  check('既存の記録は1件も減っていない', query('select count(*) from public.rankings') === '4');
  check('列を足す前の記録は NULL のまま(＝フレームなし)',
    query('select count(*) from public.rankings where profile_frame is not null') === '0');

  // 実際にフレーム付きの記録を入れて、集計の出口まで届くか
  psql(`-q -d ${DB} -c "insert into public.rankings (user_name,hero,party,score,level,icon,difficulty,clear_id,breeder_id,profile_frame) values ('太郎','MASTER','[{}]'::jsonb,9000,7,'Mocchi','Rhythm-song_a-MASTER','c5','bd-1','gold')"`);
  check('曲別(rankings)にフレームが乗る',
    query("select profile_frame from public.rankings where clear_id='c5'") === 'gold');
  check('全曲合算ビューにフレームが出る',
    query("select profile_frame from public.rhythm_total_rankings where identity_key='bd-1'") === 'gold');
  check('週間の関数にフレームが出る',
    query("select profile_frame from public.rhythm_week_score_totals(now()-interval '1 day', now()+interval '1 day') where identity_key='bd-1'") === 'gold');
  check('イベント総合(加点込み)にフレームが出る',
    query("select profile_frame from public.rhythm_event_totals_bonus(array['song_a'], now()-interval '1 day', now()+interval '1 day', '{}'::jsonb) where identity_key='bd-1'") === 'gold');

  // 変な値を入れられないこと
  const bad = psql(`-q -d ${DB} -c "insert into public.rankings (user_name,score,difficulty,clear_id,profile_frame) values ('x',1,'Normal','c9','DROP TABLE; --')"`);
  check('idの形をしていない値は検査制約が弾く', bad.status !== 0 && /rankings_profile_frame_shape/.test(bad.stderr || ''));

  const verify = runFile('PROFILE_FRAME_VERIFY.sql');
  check('確認用(PROFILE_FRAME_VERIFY.sql)が通る', verify.status === 0, (verify.stderr || '').trim().slice(0, 200));

  // ===== 絆Lv・総合力ランキング(bond_levels)側 =====
  const bondTest = runFile('PROFILE_FRAME_BOND_APPLY_TEST.sql');
  check('絆Lv: 予行演習が通る', bondTest.status === 0, (bondTest.stderr || '').trim().slice(0, 300));
  check('絆Lv: 予行演習は本番へ何も残さない(rollback)',
    query("select count(*) from information_schema.columns where table_name='bond_levels' and column_name='profile_frame'") === '0');
  const bondApply = runFile('PROFILE_FRAME_BOND_APPLY.sql');
  check('絆Lv: 本番用が通る', bondApply.status === 0, (bondApply.stderr || '').trim().slice(0, 300));
  const bondAgain = runFile('PROFILE_FRAME_BOND_APPLY.sql');
  check('絆Lv: もう一度流しても壊れない', bondAgain.status === 0, (bondAgain.stderr || '').trim().slice(0, 200));
  check('絆Lv: profile_frame 列ができている(NULL許容のtext)',
    query("select data_type||'/'||is_nullable from information_schema.columns where table_name='bond_levels' and column_name='profile_frame'") === 'text/YES');
  check('絆Lv: 既存の記録は1件も減っていない', query('select count(*) from public.bond_levels') === '2');
  check('絆Lv: 列を足す前の記録は NULL のまま', query('select count(*) from public.bond_levels where profile_frame is not null') === '0');
  psql(`-q -d ${DB} -c "insert into public.bond_levels (user_name,individual_id,monster_id,mon_name,bond_level,icon,profile_frame) values ('太郎','m-9','Mocchi','モッチー',80,'Mocchi','gold')"`);
  check('絆Lv: フレーム付きで書ける',
    query("select profile_frame from public.bond_levels where individual_id='m-9'") === 'gold');
  const bondBad = psql(`-q -d ${DB} -c "insert into public.bond_levels (user_name,individual_id,mon_name,bond_level,profile_frame) values ('x','m-bad','モッチー',1,'DROP TABLE; --')"`);
  check('絆Lv: idの形をしていない値は検査制約が弾く',
    bondBad.status !== 0 && /bond_levels_profile_frame_shape/.test(bondBad.stderr || ''));
  const bondVerify = runFile('PROFILE_FRAME_BOND_VERIFY.sql');
  check('絆Lv: 確認用が通る', bondVerify.status === 0, (bondVerify.stderr || '').trim().slice(0, 200));
} finally {
  psql(`-q -c "drop database if exists ${DB}"`);
  try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {}
}

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
