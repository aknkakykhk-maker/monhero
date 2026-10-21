// レイドの1回ごとの記録(raid_battle_logs・2026-10-21 下準備)と、記録の範囲を確かめる。設計: docs/spec/BATTLE_LOG.md
//
//   node tools/ranking/battle-log-check.js
//
//   ① RELEASE_FLAGS.battleLog は真(表を作って確かめたあと)。偽にすると sbSendRaidBattleLog は送らない(fetch を呼ばない)
//   ② 送る形(buildRaidBattleLogRow)は決めた項目だけ。レイドでない入力からは行を作らない。名前・ブリーダーID・マスモンの中身を通さない
//   ③ 記録の範囲(2026-10-21 社長「レイド、タクティクスプロのベースモンを使ったもののデータでいい。育てたモンスターははかれない」):
//      送る所はレイドの2か所(レイドバトル・グランドスラム / モンヒロビート挑戦)だけ。通常のバトル(submitLocalScore)からは送らない。
//      タクティクスプロはベースモンだけの回に限る(tactics-pro-log-check.js が見る)。raid_jack_hits への送り方は変えない
//   ④ SQL(docs/sql/battle-log/BATTLE_LOGS_*.sql)は新しい表2つ(raid_battle_logs・tactics_pro_logs)を作るだけで既存の表に触らない。
//      本番用は1本で、1つのトランザクション。予行演習は rollback で終わる。確かめ用は読むだけ
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const supa = read('monster-hero/src/parts/26-supabase.jsx');
const rel = read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const take = (src, name) => {
  const at = src.indexOf(`const ${name} = `);
  if (at < 0) return '';
  const first = src.slice(at, src.indexOf('\n', at));
  if (/;\s*(\/\/.*)?$/.test(first)) return first + '\n';
  const end = src.slice(at).search(/\n\};\n/);
  return src.slice(at, at + end + 3);
};
// ①
check('① RELEASE_FLAGS.battleLog は真(2026-10-22 表を作って確かめたあと)', /\n  battleLog: true,\n/.test(rel));
const names = ['RAID_BATTLE_LOG_TABLE', 'BATTLE_LOG_SCHEMA_VERSION', 'battleLogInt', 'battleLogId', 'buildRaidBattleLogRow', 'sbSendRaidBattleLog'];
const code = `let raidBattleLogDisabled = false;\n${names.map((n) => take(supa, n)).join('\n')}`;
check('使う関数を取り出せる', names.every((n) => code.includes(`const ${n} = `)), names.filter((n) => !code.includes(`const ${n} = `)).join(','));
const calls = [];
const ctx = { RELEASE_FLAGS: { battleLog: false }, BUILD_DATE: '2026-10-21 12:00', SUPABASE_URL: 'https://example.invalid', SB_HEADERS: {},
  sbTelemetryLocal: () => false, fetch: async (...a) => { calls.push(a); return { ok: true, status: 201 }; }, AbortController, setTimeout, clearTimeout };
vm.createContext(ctx);
vm.runInContext(`${code}\nthis.o = { buildRaidBattleLogRow, sbSendRaidBattleLog };`, ctx);
const { buildRaidBattleLogRow: B, sbSendRaidBattleLog: S } = ctx.o;
const party = [{ role: 'hero', monsterId: 'Golem', name: 'ドラちゃん', masuId: 'm1' }, { role: 'ally', monsterId: 'Pixie' }, null, { role: 'ally', monsterId: 'Ham' }];
const row = B({ party, raid: { event: 'raid_jack_2026', kind: 'b', tier: 3, source: 'battle', damage: 5659457, defeated: true, turns: 14 },
  units: { Golem: { dmg: 5000.7, ex: 2, unique: 3, taken: 900, name: 'x' }, 'bad id!': { dmg: 1 } }, user_name: 'あつ', breeder_id: 'b1' });
(async () => {
  check('① 印が偽のあいだは送らない(fetch を呼ばない)', (await S(row)) === false && calls.length === 0);
  ctx.RELEASE_FLAGS.battleLog = true;
  check('① 印を真にすると raid_battle_logs へ1回送る(仕組みが動く)', (await S(row)) === true && calls.length === 1 && String(calls[0][0]).endsWith('/rest/v1/raid_battle_logs') && calls[0][1].method === 'POST');
  ctx.RELEASE_FLAGS.battleLog = false;
  // ②
  const keys = Object.keys(row).sort().join(',');
  check('② 送る形は決めた項目だけ', keys === 'allies,app_build,damage,event_id,hero,kind,result,schema_version,score,source,tier,turns,units', keys);
  check('② 段階・ダメージ・ターン・倒したら defeated', row.event_id === 'raid_jack_2026' && row.kind === 'b' && row.tier === 3 && row.damage === 5659457 && row.turns === 14 && row.result === 'defeated');
  check('② 勇者モン・供モンは monsterId', row.hero === 'Golem' && row.allies.join() === 'Pixie,Ham');
  check('② 名前・ブリーダーID・マスモンの中身を通さない', !/あつ|b1|ドラちゃん|m1|masu|name/.test(JSON.stringify(row)), JSON.stringify(row));
  check('② units は決めた4つの数だけ・おかしなidは捨てる', JSON.stringify(row.units) === '{"Golem":{"dmg":5000,"ex":2,"unique":3,"taken":900}}');
  const rh = B({ score: 900000, raid: { event: 'raid_jack_2026', kind: 'a', tier: 5, source: 'rhythm', damage: 12000, defeated: false } });
  check('② モンヒロビート挑戦は勇者モンが無くても作る', rh && rh.hero === null && rh.source === 'rhythm' && rh.result === 'end' && rh.score === 900000);
  check('② レイドでない入力からは行を作らない(通常のバトルは記録しない)', B({ party, difficultyKey: 'TacticsProBetaHard', reachedWave: 7 }) === null && B(null) === null);
  check('② イベントidや段階がおかしい・勇者モンが無いバトルは作らない', B({ party, raid: { event: 'x y', kind: 'a', tier: 1 } }) === null && B({ party: [], raid: { event: 'raid_jack_2026', kind: 'a', tier: 2, source: 'battle' } }) === null && B({ party, raid: { event: 'raid_jack_2026', kind: 'c', tier: 2 } }) === null);
  // ③
  const at = app.indexOf('const submitLocalScore = async');
  const body = app.slice(at, app.indexOf('const row = { difficulty: diff, user_name: name', at));
  check('③ 通常のバトル(submitLocalScore)からは送らない', !/sbSendRaidBattleLog|sbSendBattleLog|buildBattleLogRow|buildRaidBattleLogRow/.test(body));
  check('③ 前の名前(buildBattleLogRow・sbSendBattleLog・battle_logs)が残っていない', !/buildBattleLogRow|sbSendBattleLog\b|'battle_logs'/.test(app + supa));
  const hooks = (app.match(/if ?\(RELEASE_FLAGS\.battleLog ?=== ?true ?&& ?!isDebugRun[^\n]*\n[^\n]*sbSendRaidBattleLog\(buildRaidBattleLogRow\(\{[^\n]*raid: ?\{[^\n]*/g) || []);
  check('③ 送る所はレイドの2か所(レイドバトル・グランドスラム / モンヒロビート挑戦)だけで、印が真・デバッグでないときだけ', hooks.length === 2 && (app.match(/sbSendRaidBattleLog\(/g) || []).length === 2
    && hooks.some((t) => /source: ?'battle'/.test(t)) && hooks.some((t) => /source: ?'rhythm'/.test(t)));
  check('③ レイドの送る所で名前・ブリーダーIDを渡していない', hooks.every((t) => !/breederId|user_name|breederName|icon/.test(t)));
  check('③ raid_jack_hits への送り方は変えていない', /const sent=await raidJackSubmitHit\(next,hit,breederId,run\.eventId\);/.test(app));
  check('③ 手元のサーバーからは送らない', /sbTelemetryLocal\(\)\) return false;/.test(take(supa, 'sbSendRaidBattleLog')));
  // ④
  const dir = 'docs/sql/battle-log';
  const files = ['BATTLE_LOGS_APPLY.sql', 'BATTLE_LOGS_APPLY_TEST.sql', 'BATTLE_LOGS_VERIFY.sql'];
  check('④ SQL は3本(本番用・予行演習・確かめ用)だけ', files.every((f) => fs.existsSync(path.join(ROOT, dir, f))) && fs.readdirSync(path.join(ROOT, dir)).sort().join() === files.slice().sort().join(), fs.readdirSync(path.join(ROOT, dir)).join(','));
  const strip = (t) => t.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  const apply = strip(read(`${dir}/BATTLE_LOGS_APPLY.sql`)), test = strip(read(`${dir}/BATTLE_LOGS_APPLY_TEST.sql`)), verify = strip(read(`${dir}/BATTLE_LOGS_VERIFY.sql`));
  const allSql = apply + test + verify;
  const tables = new Set(['raid_battle_logs', 'tactics_pro_logs']);
  check('④ 既存の表に触らない(DROP TABLE・DELETE・UPDATE・TRUNCATE なし。ALTER・ON・INTO・FROM は新しい2つの表だけ)',
    !/drop\s+table|delete\s+from|truncate|\bupdate\s+public\./i.test(allSql) && [...allSql.matchAll(/alter\s+table\s+public\.(\w+)/gi)].every((m) => tables.has(m[1]))
    && [...allSql.matchAll(/(?:on|into|from)\s+public\.(\w+)/gi)].every((m) => tables.has(m[1])));
  check('④ 本番用は1本で、1つのトランザクション(begin が1つ・commit が1つ)・2つの表を作る', (apply.match(/^begin;$/gm) || []).length === 1 && (apply.match(/^commit;$/gm) || []).length === 1
    && /create table if not exists public\.raid_battle_logs/.test(apply) && /create table if not exists public\.tactics_pro_logs/.test(apply));
  check('④ 予行演習は本番用と同じ中身で rollback で終わる', /rollback;\s*$/.test(read(`${dir}/BATTLE_LOGS_APPLY_TEST.sql`)) && !/^commit;$/m.test(test)
    && apply.slice(apply.indexOf('begin;'), apply.indexOf('commit;')).trim() === test.slice(test.indexOf('begin;'), test.indexOf('select t.table_name')).trim());
  check('④ 確かめ用は読むだけ(select だけ)', !/^\s*(create|alter|insert|grant|drop|update|delete|begin|commit)\b/im.test(verify) && /^select/im.test(verify));
  check('④ 新しい表の権限は、いったん外してから読む・足すだけを付ける(Supabase が初めから全部付けることがあるため)', ['raid_battle_logs', 'tactics_pro_logs'].every((t) => new RegExp(`revoke all on public\\.${t} from anon, authenticated;\\s*grant select, insert on public\\.${t} to anon, authenticated;`).test(apply)));
  check('④ 書き換え・削除のポリシーを作らない・列の数の確かめは raid 15・tactics 14', !/for\s+(update|delete|all)\b/i.test(allSql) && (apply.match(/column_count <> 15/g) || []).length === 1 && (apply.match(/column_count <> 14/g) || []).length === 1);
  // 表の列(create table の中の列)と、ゲームが送る項目+id・created_at が合っているか(2026-10-22 窓口: tactics_pro_logs は14列)
  const colsOf = (t) => { const m = apply.match(new RegExp(`create table if not exists public\\.${t} \\(([\\s\\S]*?)\\n\\);`)); return m ? m[1].split('\n').map((l) => l.trim()).filter((l) => l && !/^constraint /.test(l)).map((l) => l.split(/\s+/)[0]) : []; };
  const raidCols = colsOf('raid_battle_logs'), tpCols = colsOf('tactics_pro_logs');
  check('④ raid_battle_logs の列は15で、送る形の項目と合う', raidCols.length === 15 && Object.keys(row).every((k) => raidCols.includes(k)) && raidCols.filter((c) => !['id', 'created_at'].includes(c)).every((c) => c in row), raidCols.join(','));
  const tpKeys = ['difficulty', 'result', 'reached_wave', 'turns', 'score', 'hero', 'candidates', 'cause', 'seconds', 'detail', 'app_build', 'schema_version'];
  check('④ tactics_pro_logs の列は14で、送る形(buildTacticsProLogRow)の項目と合う', tpCols.length === 14 && tpKeys.every((k) => tpCols.includes(k)) && tpCols.filter((c) => !['id', 'created_at'].includes(c)).every((c) => tpKeys.includes(c)) && tpKeys.every((k) => new RegExp(`\\b${k}[:,]`).test(take(supa, 'buildTacticsProLogRow'))), tpCols.join(','));
  check('④ 設計の1枚がある', fs.existsSync(path.join(ROOT, 'docs/spec/BATTLE_LOG.md')) && /raid_battle_logs/.test(read('docs/spec/BATTLE_LOG.md')));
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
