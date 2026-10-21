// バトルの1回ごとの記録(battle_logs・2026-10-21 下準備)を確かめる。設計: docs/spec/BATTLE_LOG.md
//
//   node tools/ranking/battle-log-check.js
//
//   ① RELEASE_FLAGS.battleLog は偽。偽のあいだ sbSendBattleLog は送らない(fetch を呼ばない)
//   ② 送る形(buildBattleLogRow)は決めた項目だけ。名前・ブリーダーID・アイコン・マスモンの中身を通さない。数は範囲に収める
//   ③ 送る所は submitLocalScore の中で、印が真のときだけ。名前・IDを渡していない
//   ③' レイド(レイドバトル・グランドスラム・モンヒロビート挑戦)も同じ表へ。raid_jack_hits・ランキング・報酬には触らない
//   ④ SQL は新しい表を1つ作るだけ(既存の表を DROP・DELETE・UPDATE・ALTER しない)。予行演習は rollback で終わる
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
check('① RELEASE_FLAGS.battleLog は偽', /\n  battleLog: false,\n/.test(rel));
const names = ['BATTLE_LOG_TABLE', 'BATTLE_LOG_SCHEMA_VERSION', 'battleLogInt', 'battleLogId', 'buildBattleLogRow', 'sbSendBattleLog'];
const code = `let battleLogDisabled = false;\n${names.map((n) => take(supa, n)).join('\n')}`;
check('使う関数を取り出せる', names.every((n) => code.includes(`const ${n} = `)), names.filter((n) => !code.includes(`const ${n} = `)).join(','));
const calls = [];
const ctx = { RELEASE_FLAGS: { battleLog: false }, BUILD_DATE: '2026-10-21 12:00', SUPABASE_URL: 'https://example.invalid', SB_HEADERS: {},
  sbTelemetryLocal: () => false, fetch: async (...a) => { calls.push(a); return { ok: true, status: 201 }; }, AbortController, setTimeout, clearTimeout };
vm.createContext(ctx);
vm.runInContext(`${code}\nthis.o = { buildBattleLogRow, sbSendBattleLog };`, ctx);
const { buildBattleLogRow, sbSendBattleLog } = ctx.o;
const input = { difficultyKey: 'TacticsProBetaHard', reachedWave: 7, clearTurns: null, score: 1234,
  party: [{ role: 'hero', monsterId: 'Golem', name: 'ドラちゃん', masuId: 'm1', detail: { name: 'ドラちゃん' } }, { role: 'ally', monsterId: 'Pixie' }, null, { role: 'ally', monsterId: 'Ham' }],
  units: { Golem: { dmg: 5000.7, ex: 2, unique: 3, taken: 900, name: 'x' }, 'bad id!': { dmg: 1 } }, user_name: 'あつ', breeder_id: 'b1', icon: 'Mocchi' };
const row = buildBattleLogRow(input);
(async () => {
  const sent1 = await sbSendBattleLog(row);
  check('① 印が偽のあいだは送らない(fetch を呼ばない)', sent1 === false && calls.length === 0);
  ctx.RELEASE_FLAGS.battleLog = true;
  const sent2 = await sbSendBattleLog(row);
  check('① 印を真にすると battle_logs へ1回送る(仕組みが動く)', sent2 === true && calls.length === 1 && String(calls[0][0]).endsWith('/rest/v1/battle_logs') && calls[0][1].method === 'POST');
  ctx.RELEASE_FLAGS.battleLog = false;
  // ②
  const keys = Object.keys(row).sort().join(',');
  check('② 送る形は決めた項目だけ', keys === 'allies,app_build,difficulty,hero,raid_damage,raid_event,raid_kind,raid_source,raid_tier,reached_wave,result,schema_version,score,turns,units', keys);
  // レイド(2026-10-21 追加)
  const ra = buildBattleLogRow({ ...input, raid: { event: 'raid_jack_2026', kind: 'b', tier: 3, source: 'battle', damage: 5659457, defeated: true, turns: 14 } });
  check('② レイドの1回: 難易度 RaidJackB・段階・ダメージ・ターン・倒したら clear', ra && ra.difficulty === 'RaidJackB' && ra.raid_tier === 3 && ra.raid_damage === 5659457 && ra.turns === 14 && ra.result === 'clear' && ra.hero === 'Golem' && ra.reached_wave === null, JSON.stringify(ra));
  const rh = buildBattleLogRow({ score: 900000, raid: { event: 'raid_jack_2026', kind: 'a', tier: 5, source: 'rhythm', damage: 12000, defeated: false } });
  check('② モンヒロビート挑戦は勇者モンが無くても作る(RaidJackRhythm)', rh && rh.difficulty === 'RaidJackRhythm' && rh.hero === null && rh.raid_source === 'rhythm' && rh.result === 'end');
  check('② ふつうのバトルはレイドの列が null', row.raid_event === null && row.raid_kind === null && row.raid_damage === null);
  check('② レイドでもイベントidや段階がおかしければ作らない', buildBattleLogRow({ ...input, raid: { event: 'x y', kind: 'a', tier: 1 } }) === null && buildBattleLogRow({ party: [], raid: { event: 'raid_jack_2026', kind: 'a', tier: 2, source: 'battle' } }) === null);
  check('② 名前・ブリーダーID・アイコン・マスモンの中身を通さない', !/あつ|b1|Mocchi|ドラちゃん|m1|masu|name/.test(JSON.stringify(row)), JSON.stringify(row));
  check('② 勇者モン・供モンは monsterId', row.hero === 'Golem' && row.allies.join() === 'Pixie,Ham');
  check('② 負けた回は end・クリアは clear(ターンつき)', row.result === 'end' && row.turns === null && buildBattleLogRow({ ...input, clearTurns: 88 }).result === 'clear' && buildBattleLogRow({ ...input, clearTurns: 88 }).turns === 88);
  check('② units は決めた4つの数だけ・おかしなidは捨てる', JSON.stringify(row.units) === '{"Golem":{"dmg":5000,"ex":2,"unique":3,"taken":900}}', JSON.stringify(row.units));
  check('② 難易度か勇者モンが無ければ行を作らない', buildBattleLogRow({ ...input, difficultyKey: '' }) === null && buildBattleLogRow({ ...input, party: [] }) === null && buildBattleLogRow(null) === null);
  check('② 数は範囲に収める', buildBattleLogRow({ ...input, reachedWave: 9999, score: -5 }).reached_wave === 100 && buildBattleLogRow({ ...input, score: -5 }).score === 0);
  // ③
  const at = app.indexOf('const submitLocalScore = async');
  const body = app.slice(at, app.indexOf('const row = { difficulty: diff, user_name: name', at));
  check('③ 送る所は submitLocalScore の中で、印が真のときだけ', /if \(RELEASE_FLAGS\.battleLog === true\) \{\s*try \{ void sbSendBattleLog\(buildBattleLogRow\(/.test(body));
  const callText = (body.match(/sbSendBattleLog\(buildBattleLogRow\(\{[^\n]*\}\)\)/) || [''])[0];
  check('③ 名前・ブリーダーID・アイコンを渡していない', !!callText && !/name|breederId|icon|masu/.test(callText.replace(/difficultyKey/, '')), callText);
  const raidHooks = (app.match(/if ?\(RELEASE_FLAGS\.battleLog ?=== ?true ?&& ?!isDebugRun[^\n]*\n[^\n]*sbSendBattleLog\(buildBattleLogRow\(\{[^\n]*raid: ?\{[^\n]*/g) || []);
  check('③ レイドの2か所(レイドバトル・グランドスラム / モンヒロビート挑戦)も、印が真で・デバッグでないときだけ', raidHooks.length === 2 && raidHooks.some((t) => /source: ?'battle'/.test(t)) && raidHooks.some((t) => /source: ?'rhythm'/.test(t)));
  check('③ レイドの送る所でも名前・ブリーダーIDを渡していない', raidHooks.every((t) => !/breederId|user_name|breederName|icon/.test(t)));
  check('③ raid_jack_hits への送り方は変えていない(raidJackSubmitHit・sbSendRaidJackHit はそのまま)', /const sent=await raidJackSubmitHit\(next,hit,breederId,run\.eventId\);/.test(app));
  check('③ 手元のサーバーからは送らない', /sbTelemetryLocal\(\)\) return false;/.test(take(supa, 'sbSendBattleLog')));
  // ④
  const dir = 'docs/sql/battle-log';
  const files = ['BATTLE_LOG_APPLY.sql', 'BATTLE_LOG_APPLY_TEST.sql', 'BATTLE_LOG_VERIFY.sql'];
  check('④ SQL のファイルがある', files.every((f) => fs.existsSync(path.join(ROOT, dir, f))));
  const sqlAll = files.map((f) => read(`${dir}/${f}`)).join('\n').split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  check('④ 既存の表に触らない(DROP TABLE・DELETE・UPDATE・TRUNCATE・ALTER は battle_logs 以外にしない)',
    !/drop\s+table|delete\s+from|truncate|\bupdate\s+public\./i.test(sqlAll) && [...sqlAll.matchAll(/alter\s+table\s+([\w.]+)/gi)].every((m) => m[1] === 'public.battle_logs')
    && [...sqlAll.matchAll(/(?:on|into|from)\s+public\.(\w+)/gi)].every((m) => m[1] === 'battle_logs'));
  check('④ 予行演習は rollback で終わる', /rollback;\s*$/.test(read(`${dir}/BATTLE_LOG_APPLY_TEST.sql`)));
  check('④ 列は18個(レイドの5列を含む)', /column_count <> 18/.test(read(`${dir}/BATTLE_LOG_APPLY.sql`)) && /raid_damage bigint/.test(read(`${dir}/BATTLE_LOG_APPLY.sql`)));
  check('④ 書き換え・削除のポリシーを作らない', !/for\s+(update|delete|all)\b/i.test(sqlAll));
  check('④ 設計の1枚がある', fs.existsSync(path.join(ROOT, 'docs/spec/BATTLE_LOG.md')));
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
