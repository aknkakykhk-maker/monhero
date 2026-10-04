// docs/sql/raid/RAID_JACK_*.sql を、実際の PostgreSQL へ流して確かめる(正本: docs/spec/RAID_BOSS_JACK.md)。
//
//   node tools/ranking/raid-jack-sql-check.js
//
// PostgreSQL が入っていない環境では SKIP する(検査を落とさない)。
//
// 見るもの
//   ① 予行演習(TEST)が通り、何も残さない。本番用(APPLY)が通り、2回流しても壊れない
//   ② 同じ hit_id を2回送っても1行しか入らない(再送しても二重に数えない)
//   ③ 形の違う行(段階・種類・桁・ID)は受け付けない
//   ④ anon は追加と読み出しだけできる(書き換え・削除はできない)
//   ⑤ ビュー3つ(段階ごとの合計・人ごとの貢献・Bの累計)が正しく数える
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '../..');
const SQL_DIR = path.join(ROOT, 'docs/sql/raid');
const DB = 'monhero_raid_jack_check';
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-raid-sqlcheck-'));

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const skip = (why) => { console.log(`SKIP: ${why}`); process.exit(0); };

const sh = (cmd, opts = {}) => spawnSync('sh', ['-c', cmd], { encoding: 'utf8', ...opts });
const has = (cmd) => sh(`command -v ${cmd}`).status === 0;
if (!has('psql') || !has('pg_ctlcluster')) skip('PostgreSQL が入っていないので、SQLの実行確認は行いません');
if (process.getuid && process.getuid() !== 0) skip('postgres ユーザーで実行できないので、SQLの実行確認は行いません');
if (!/online/.test(sh('pg_lsclusters').stdout || '')) sh('pg_ctlcluster 16 main start');
if (!/online/.test(sh('pg_lsclusters').stdout || '')) skip('PostgreSQL を起動できないので、SQLの実行確認は行いません');

const psql = (args) => spawnSync('su', ['postgres', '-c', `psql ${args}`], { encoding: 'utf8' });
const runFile = (file) => psql(`-v ON_ERROR_STOP=1 -q -d ${DB} -f ${path.join(WORK, file)}`);
const query = (sql) => (psql(`-tA -d ${DB} -c ${JSON.stringify(sql)}`).stdout || '').trim();
// anon として流す(RLS と権限が本番と同じ形で効くか)
const asAnon = (sql) => psql(`-v ON_ERROR_STOP=1 -q -d ${DB} -c ${JSON.stringify(`set role anon; ${sql}`)}`);

try {
  for (const f of ['RAID_JACK_APPLY_TEST.sql', 'RAID_JACK_APPLY.sql', 'RAID_JACK_VERIFY.sql']) fs.copyFileSync(path.join(SQL_DIR, f), path.join(WORK, f));
  fs.writeFileSync(path.join(WORK, '00-base.sql'), `
do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; end $$;
do $$ begin if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; end $$;
grant usage on schema public to anon, authenticated;
`);
  fs.chmodSync(WORK, 0o755);
  for (const f of fs.readdirSync(WORK)) fs.chmodSync(path.join(WORK, f), 0o644);

  psql(`-q -c "drop database if exists ${DB}"`);
  const created = psql(`-q -c "create database ${DB}"`);
  check('検査用のデータベースを作れる', created.status === 0, (created.stderr || '').trim().slice(0, 120));
  if (created.status !== 0) throw new Error('createdb failed');
  check('土台(anon / authenticated)を用意できる', runFile('00-base.sql').status === 0);

  const test = runFile('RAID_JACK_APPLY_TEST.sql');
  check('予行演習(RAID_JACK_APPLY_TEST.sql)が通る', test.status === 0, (test.stderr || '').trim().slice(0, 300));
  check('予行演習は何も残さない(rollback)', query("select to_regclass('public.raid_jack_hits') is null") === 't');

  const apply = runFile('RAID_JACK_APPLY.sql');
  check('本番用(RAID_JACK_APPLY.sql)が通る', apply.status === 0, (apply.stderr || '').trim().slice(0, 300));
  const again = runFile('RAID_JACK_APPLY.sql');
  check('もう一度流しても壊れない(二重適用に強い)', again.status === 0, (again.stderr || '').trim().slice(0, 200));
  check('確認用(RAID_JACK_VERIFY.sql)が通る', runFile('RAID_JACK_VERIFY.sql').status === 0);

  // ④ anon の権限
  const ins = (id, kind, tier, breeder, dmg, def = 'false') =>
    `insert into public.raid_jack_hits (hit_id, kind, tier, breeder_id, damage, defeated) values ('${id}','${kind}',${tier},'${breeder}',${dmg},${def}) on conflict (hit_id) do nothing;`;
  check('anon は追加できる', asAnon(ins('hit-0000-0001', 'a', 1, 'breeder-aaaa', 1000)).status === 0);
  check('anon は読み出せる', asAnon('select count(*) from public.raid_jack_hits').status === 0);
  check('anon は書き換えられない', asAnon("update public.raid_jack_hits set damage = 1 where hit_id = 'hit-0000-0001'").status !== 0);
  check('anon は消せない', asAnon("delete from public.raid_jack_hits where hit_id = 'hit-0000-0001'").status !== 0);
  check('書き換え・消去の試みのあとも行はそのまま', query("select damage from public.raid_jack_hits where hit_id='hit-0000-0001'") === '1000');

  // ② 冪等
  asAnon(ins('hit-0000-0001', 'a', 1, 'breeder-aaaa', 1000));
  check('同じ hit_id を2回送っても1行', query("select count(*) from public.raid_jack_hits where hit_id='hit-0000-0001'") === '1');

  // ③ 形の違う行
  const bad = (label, sql) => check(`受け付けない: ${label}`, asAnon(sql).status !== 0);
  bad('段階が0', ins('hit-bad-0001', 'a', 0, 'breeder-aaaa', 10));
  bad('段階が6', ins('hit-bad-0002', 'a', 6, 'breeder-aaaa', 10));
  bad('種類が c', ins('hit-bad-0003', 'c', 1, 'breeder-aaaa', 10));
  bad('ダメージが負', ins('hit-bad-0004', 'a', 1, 'breeder-aaaa', -1));
  bad('ダメージが1億超', ins('hit-bad-0005', 'a', 1, 'breeder-aaaa', 100000001));
  bad('hit_id が短い', ins('short', 'a', 1, 'breeder-aaaa', 10));
  bad('ブリーダーIDに区切り文字', ins('hit-bad-0006', 'a', 1, 'breeder aaaa;', 10));
  check('ライフ最大(35,000,000)のダメージは受け付ける', asAnon(ins('hit-big-0001', 'b', 5, 'breeder-bbbb', 35000000)).status === 0);

  // ⑤ ビュー
  asAnon(ins('hit-0000-0002', 'a', 1, 'breeder-aaaa', 500));
  asAnon(ins('hit-0000-0003', 'a', 1, 'breeder-cccc', 700, 'true'));
  asAnon(ins('hit-0000-0004', 'a', 2, 'breeder-aaaa', 300));
  asAnon(ins('hit-0000-0005', 'b', 1, 'breeder-bbbb', 40000));
  asAnon(ins('hit-0000-0006', 'b', 2, 'breeder-bbbb', 60000));
  asAnon(ins('hit-0000-0007', 'b', 1, 'breeder-dddd', 10));
  check('段階ごとの合計: A段階1 = 1000+500+700',
    query("select total_damage||'/'||hit_count||'/'||player_count||'/'||any_defeated from public.raid_jack_tier_totals where kind='a' and tier=1") === '2200/3/2/true');
  check('段階ごとの合計: A段階2 = 300(倒されていない)',
    query("select total_damage||'/'||any_defeated from public.raid_jack_tier_totals where kind='a' and tier=2") === '300/false');
  check('人ごとの貢献: A段階1の breeder-aaaa = 1500',
    query("select total_damage from public.raid_jack_contributions where kind='a' and tier=1 and breeder_id='breeder-aaaa'") === '1500');
  check('Bの累計は段階をまたいで合算(breeder-bbbb = 35,000,000+40,000+60,000)',
    query("select total_damage from public.raid_jack_b_ranking where breeder_id='breeder-bbbb'") === '35100000');
  check('Bのランキングに A の記録は入らない', query("select count(*) from public.raid_jack_b_ranking where breeder_id='breeder-aaaa'") === '0');
  check('anon はビューも読める', asAnon('select count(*) from public.raid_jack_tier_totals; select count(*) from public.raid_jack_contributions; select count(*) from public.raid_jack_b_ranking').status === 0);
} catch (error) {
  check('検査の実行', false, String(error && error.message || error));
} finally {
  psql(`-q -c "drop database if exists ${DB}"`);
  try { fs.rmSync(WORK, { recursive: true, force: true }); } catch (e) { /* 片づけられなくてもよい */ }
}
if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
console.log('\nすべて OK');
