// MFバトルカード 公式杯: 終わった大会の一覧の SQL(docs/sql/card-tournament/CARD_TOURNAMENT_HISTORY_APPLY.sql・2026-10-31 ブレイブくん)を確かめる。
//
//   node tools/card/card-tour-history-sql-check.js
//
//   A(いつも): 足すだけ・読むだけ(DELETE・DROP・ALTER・TRUNCATE・UPDATE・INSERT が無い)。ゲームから呼べるのは card_tournament_history だけ
//   B(PostgreSQL が手元にあるときだけ): 使い捨てのデータベースに大会の表(CARD_TOURNAMENT_APPLY.sql)とこの関数を流し、
//     終わった大会だけを新しい順に返す / 結果発表(最終日 4:00)の前の大会は返さない / 受付中・開催中は返さない /
//     出ていた人には順位、出ていない人は null / 優勝した席(助手なら assist_id)/ 出場人数は助手と辞退を数えない
//   本物のデータベースには何もしない
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SQL = fs.readFileSync(path.join(ROOT, 'docs/sql/card-tournament/CARD_TOURNAMENT_HISTORY_APPLY.sql'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ---- A ----
const code = SQL.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
check('A 足すだけ・読むだけ', !/\b(delete\s+from|drop\s+(table|function|index)|alter\s+table|truncate|update\s+\w+\s+set|insert\s+into)\b/i.test(code));
const fns = [...code.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
check('A 関数は card_tournament_history の1つだけ', JSON.stringify(fns) === JSON.stringify(['card_tournament_history']), fns.join('・'));
check('A 読むだけの関数(stable)', /returns jsonb language sql stable security definer set search_path = public/.test(code));
check('A ゲームから呼べる(anon・authenticated)', /grant execute on function public\.card_tournament_history\(text\) to anon, authenticated;/.test(code));

// ---- B ----
const pgBin = ['/usr/lib/postgresql/16/bin', '/usr/lib/postgresql/15/bin', '/usr/lib/postgresql/17/bin'].find((d) => fs.existsSync(path.join(d, 'initdb')));
const canSu = pgBin && typeof process.getuid === 'function' && process.getuid() === 0 && spawnSync('id', ['postgres']).status === 0;
if (!pgBin || !canSu) {
  console.log('SKIP: B(PostgreSQL の使い捨てのデータベースを作れない環境。A だけ見た)');
} else {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-tour-history-'));
  fs.chmodSync(dir, 0o777);
  const port = String(57000 + Math.floor(Math.random() * 900));
  const asPg = (cmd) => execFileSync('su', ['postgres', '-c', cmd], { stdio: 'pipe' });
  let started = false;
  try {
    asPg(`${pgBin}/initdb -D ${dir}/data -A trust`);
    asPg(`${pgBin}/pg_ctl -D ${dir}/data -o '-p ${port} -k ${dir}' -l ${dir}/log -w start`);
    started = true;
    const psql = (sql, file = null) => execFileSync('psql', ['-h', dir, '-p', port, '-U', 'postgres', '-q', '-tA', '-v', 'ON_ERROR_STOP=1', ...(file ? ['-f', file] : ['-c', sql])], { encoding: 'utf8' }).trim();
    psql('create role anon; create role authenticated; create role service_role;');
    // Supabase にある合言葉の置き場(vault)の形だけ。大会の表の関数が名前を参照するので置く(中身は空)
    psql('create schema vault; create table vault.decrypted_secrets (name text, decrypted_secret text);');
    const share = fs.readFileSync(path.join(ROOT, 'docs/sql/card-deck-share/CARD_DECK_SHARE_APPLY.sql'), 'utf8');
    const at = share.indexOf('create table if not exists public.card_deck_entries');
    psql(share.slice(at, share.indexOf('\n);', at) + 3));
    psql(null, path.join(ROOT, 'docs/sql/card-tournament/CARD_TOURNAMENT_APPLY.sql'));
    psql(null, path.join(ROOT, 'docs/sql/card-tournament/CARD_TOURNAMENT_HISTORY_APPLY.sql'));
    const today = "(now() at time zone 'Asia/Tokyo')::date";
    // old … 30日前に終わった / new … 2日前に終わった / soon … 今日終わるが 4:00 より前とみなすため明日 / run … 開催中
    psql(`insert into card_tournaments (id, name, open_on, entry_until, status, rewards, first_day, done_day, groups) values
      ('old', '第1回', ${today} - 40, now() - interval '38 days', 'done', '{"ranks":[{"point":10000}]}', ${today} - 37, ${today} - 30, 1),
      ('new', '第2回', ${today} - 10, now() - interval '8 days', 'done', '{"ranks":[{"point":20000}]}', ${today} - 7, ${today} - 2, 1),
      ('soon', '第3回', ${today} - 5, now() - interval '3 days', 'done', '{}', ${today} - 2, ${today} + 1, 1),
      ('run', '第4回', ${today} - 3, now() - interval '1 days', 'group', '{}', ${today}, ${today} + 6, 1)`);
    psql(`insert into card_tournament_entries (tournament_id, seat_id, owner_id, is_assist, assist_id, dropped, user_name, place) values
      ('old', 's1', 'p1', false, null, false, 'P1', 2), ('old', 's2', null, true, 'kiki', false, 'きき', 1), ('old', 's3', 'p3', false, null, true, 'P3', null),
      ('new', 's1', 'p2', false, null, false, 'P2', 1), ('new', 's2', 'p1', false, null, false, 'P1', 3), ('new', 's3', 'p4', false, null, false, 'P4', 2)`);
    const H = (owner) => JSON.parse(psql(`select card_tournament_history('${owner}')`));
    const h1 = H('p1');
    check('B 終わった大会だけを新しい順(発表前・開催中は出さない)', JSON.stringify(h1.map((x) => x.id)) === JSON.stringify(['new', 'old']), h1.map((x) => x.id).join('・'));
    check('B 出ていた大会の順位', h1[0].my_place === 3 && h1[1].my_place === 2 && h1[0].my_entered === true, `${h1[0].my_place}・${h1[1].my_place}`);
    check('B 優勝した席(人・助手)', h1[0].winner.name === 'P2' && h1[0].winner.is_assist === false && h1[1].winner.is_assist === true && h1[1].winner.assist_id === 'kiki');
    check('B 出場人数は助手と辞退を数えない', h1[1].players === 1 && h1[0].players === 3, `${h1[1].players}・${h1[0].players}`);
    check('B ごほうびをそのまま返す', h1[0].rewards.ranks[0].point === 20000);
    const h9 = H('nobody');
    check('B 出ていない人は順位なし', h9.length === 2 && h9.every((x) => x.my_place === null && x.my_entered === false));
    const h3 = H('p3');
    check('B 辞退した大会は出場なし', h3[1].my_entered === false && h3[1].my_place === null);
    check('B 空の持ち主でも読める', H('').length === 2);
    psql("set role anon; select card_tournament_history('p1');");
    check('B anon で呼べる', true);
  } catch (e) {
    check('B 使い捨てのデータベースで流せる', false, String(e.stderr || e.message || e).slice(0, 300));
  } finally {
    if (started) { try { asPg(`${pgBin}/pg_ctl -D ${dir}/data -m fast -w stop`); } catch (_) { /* 止まっていればよい */ } }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exitCode = failed ? 1 : 0;
