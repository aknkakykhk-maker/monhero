// タクティクスプロの1回ぶんの記録(tactics_pro_logs・2026-10-21 下準備)を確かめる。設計: docs/spec/BATTLE_LOG.md
//
//   node tools/ranking/tactics-pro-log-check.js
//
//   ① 印(RELEASE_FLAGS.battleLog)が偽のあいだは入れ物を作らず(null)、出来事を足しても何も起きず、送らない
//   ② 印を真にして10 WAVE ぶんを流すと、プロモードの仕様で決まるものが全部入る
//      (難易度・勇者モンと間合い・候補5体・WAVE ごとの3体と選んだ1体・アシカ・トレーニング・EX・固有技・与えた/受けたダメージ・倒れた回と敵・WAVE ごとの残りライフ・届いた WAVE・ターン・負けた原因)
//   ③ 名前・ブリーダーID・マスモンの中身が入らない。大きすぎるときは出来事の古いほうから捨て、上限に収まる。1回のおおよその大きさを出す
//   ④ ゲームの各所へつながっている(ベースモンだけの回に限る・始まり・アシカ・WAVE の始まり・候補・選んだ子・トレーニング・EX・固有技・与えた/受けたダメージ・倒れた・WAVE の終わり・終わり)
//   ⑤ SQL は新しい表を1つ作るだけ(既存の表に触らない)。予行演習は rollback で終わる
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const supa = read('monster-hero/src/parts/26-supabase.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const take = (src, name) => {
  const at = src.indexOf(`const ${name} = `);
  if (at < 0) return '';
  const first = src.slice(at, src.indexOf('\n', at));
  if (/;\s*(\/\/.*)?$/.test(first)) return first + '\n';
  const end = src.slice(at).search(/\n\};\n/);
  return src.slice(at, at + end + 3);
};
const names = ['battleLogInt', 'battleLogId', 'TACTICS_PRO_LOG_TABLE', 'TACTICS_PRO_LOG_MAX_BYTES', 'TACTICS_PRO_LOG_MAX_EVENTS', 'tpId', 'tpIds', 'tacticsProLogStart', 'tpWave', 'tpUnit', 'tpPush',
  'tacticsProLogWaveStart', 'tacticsProLogOffer', 'tacticsProLogPick', 'tacticsProLogAssist', 'tacticsProLogTraining', 'tacticsProLogSkill', 'tacticsProLogDamage', 'tacticsProLogDown',
  'tacticsProLogWaveEnd', 'tacticsProLogFinish', 'buildTacticsProLogRow', 'sbSendTacticsProLog'];
const code = `let tacticsProLogDisabled = false;\n${names.map((n) => take(supa, n)).join('\n')}`;
check('使う関数を取り出せる', names.every((n) => code.includes(`const ${n} = `)), names.filter((n) => !code.includes(`const ${n} = `)).join(','));
const calls = [];
const ctx = { RELEASE_FLAGS: { battleLog: false }, BUILD_DATE: '2026-10-21 12:00', SUPABASE_URL: 'https://example.invalid', SB_HEADERS: {}, Date,
  sbTelemetryLocal: () => false, fetch: async (...a) => { calls.push(a); return { ok: true, status: 201 }; }, AbortController, setTimeout, clearTimeout };
vm.createContext(ctx);
vm.runInContext(`${code}\nthis.o = { ${names.filter((n) => /^[a-z]/.test(n) || n.startsWith('TACTICS')).join(', ')} };`, ctx);
const T = ctx.o;
// 1回ぶんを流す
const play = ({ waves = 10, turnsPerWave = 6, hitsPerTurn = 4 } = {}) => {
  const log = T.tacticsProLogStart({ difficulty: 'Expert', hero: 'Golem', heroDistance: 1, candidates: ['Pixie', 'Ham', 'Mocchi', 'Tiger', 'Monol'], extreme: null });
  if (!log) return null;
  const team = ['Golem'];
  T.tacticsProLogAssist(log, 'mua');
  for (let w = 1; w <= waves; w++) {
    T.tacticsProLogWaveStart(log, { wave: w, party: team.map((id, i) => ({ id, dist: i === 0 ? 1 : null })), enemy: `enemy_${w}` });
    for (let t = 1; t <= turnsPerWave; t++) {
      for (let h = 0; h < hitsPerTurn; h++) T.tacticsProLogDamage(log, { by: team[h % team.length], amount: 1000 + h });
      T.tacticsProLogDamage(log, { to: team[t % team.length], amount: 300, taken: true });
      if (t === 2) T.tacticsProLogSkill(log, 'unique', team[0], t);
      if (t === 3) T.tacticsProLogSkill(log, 'ex', team[team.length - 1], t);
    }
    if (w === 5) T.tacticsProLogDown(log, team[1] || team[0], 'enemy_5', 4);
    T.tacticsProLogWaveEnd(log, { turns: turnsPerWave, units: team.map((id) => ({ id, hp: 500, maxHp: 900 })) });
    if (w % 2 === 0 && team.length < 4) {
      const offered = ['Pixie', 'Ham', 'Mocchi'];
      T.tacticsProLogOffer(log, offered.map((id) => ({ id, name: '表示名' })));
      T.tacticsProLogPick(log, offered[w / 2 - 1]);
      team.push(offered[w / 2 - 1]);
    }
    T.tacticsProLogTraining(log, [{ slot: 0, id: 'atk' }, { revive: 2 }]);
    if (w === 4) T.tacticsProLogAssist(log, 'kiki');
  }
  return T.buildTacticsProLogRow(T.tacticsProLogFinish(log, { result: 'lose', reachedWave: waves, turns: null, score: 54321, cause: `enemy_${waves}` }));
};
(async () => {
  // ①
  check('① 印が偽なら入れ物を作らない(null)', T.tacticsProLogStart({ difficulty: 'Hard', hero: 'Golem' }) === null && play() === null);
  T.tacticsProLogDamage(null, { by: 'Golem', amount: 1 }); T.tacticsProLogWaveStart(null, { wave: 1 }); T.tacticsProLogFinish(null, {});
  check('① 入れ物が null でも出来事を足して落ちない', true);
  check('① 印が偽なら送らない', (await T.sbSendTacticsProLog({ difficulty: 'Hard' })) === false && calls.length === 0);
  // ②
  ctx.RELEASE_FLAGS.battleLog = true;
  const row = play();
  const d = row && row.detail;
  check('② 1行ができる', !!row, row ? '' : 'null');
  check('② 難易度・結果・届いた WAVE・スコア・勇者モン・候補5体・負けた原因', row.difficulty === 'Expert' && row.result === 'lose' && row.reached_wave === 10 && row.score === 54321 && row.hero === 'Golem'
    && row.candidates.join() === 'Pixie,Ham,Mocchi,Tiger,Monol' && row.cause === 'enemy_10');
  check('② 勇者モンの間合い', d.heroDistance === 1 && d.waves[0].party[0].dist === 1);
  check('② WAVE ごとの並び・敵・かかったターン・残りライフ', d.waves.length === 10 && d.waves.every((w) => w.turns === 6 && w.lifeLeft.length >= 1 && w.enemy) && d.waves[9].party.length === 4);
  check('② 候補の3体と選んだ1体', d.waves[1].offered.join() === 'Pixie,Ham,Mocchi' && d.waves[1].picked === 'Pixie' && d.waves[3].picked === 'Ham');
  check('② アシカの選択(いつ・どれ)', JSON.stringify(d.assists) === '[{"wave":0,"id":"mua"},{"wave":4,"id":"kiki"}]', JSON.stringify(d.assists));
  check('② トレーニングの選び方(起こした枠も)', JSON.stringify(d.waves[0].training) === '[{"slot":0,"id":"atk"},{"revive":2}]');
  check('② モンスターごとの与えた/受けたダメージ・EX・固有技・倒れた回', d.units.Golem.dmg > 0 && d.units.Golem.taken > 0 && d.units.Golem.unique === 10 && Object.values(d.units).some((u) => u.ex > 0) && Object.values(d.units).some((u) => u.downs === 1));
  check('② 出来事(EX・固有技・倒れた)に WAVE とターンと誰が', d.events.some((e) => e[0] === 'ex' && e[1] >= 1 && e[2] === 3) && d.events.some((e) => e[0] === 'down' && e[4] === 'enemy_5'));
  const clear = T.buildTacticsProLogRow(T.tacticsProLogFinish(T.tacticsProLogStart({ difficulty: 'Hard', hero: 'Golem' }), { result: 'clear', reachedWave: 10, turns: 88, score: 1 }));
  const retire = T.buildTacticsProLogRow(T.tacticsProLogFinish(T.tacticsProLogStart({ difficulty: 'Hard', hero: 'Golem' }), { result: 'retire', reachedWave: 2 }));
  check('② 勝ち・途中でやめた回も1行になる', clear.result === 'clear' && clear.turns === 88 && retire.result === 'retire');
  // ③
  const text = JSON.stringify(row);
  check('③ 名前・表示名を通さない', !/表示名|user_name|breeder|masu/.test(text));
  const bytes = Buffer.byteLength(text);
  check(`③ 10 WAVE・1 WAVE 6ターンの1回はおよそ ${(bytes / 1024).toFixed(1)} KB(上限 ${T.TACTICS_PRO_LOG_MAX_BYTES / 1000}KB の内)`, bytes < T.TACTICS_PRO_LOG_MAX_BYTES + 1000);
  const big = play({ waves: 20, turnsPerWave: 60, hitsPerTurn: 8 });
  check('③ 長い戦いでも上限に収まる(出来事の古いほうから捨てる)', !!big && Buffer.byteLength(JSON.stringify(big.detail)) <= T.TACTICS_PRO_LOG_MAX_BYTES && big.detail.events.length <= T.TACTICS_PRO_LOG_MAX_EVENTS, big ? `${Buffer.byteLength(JSON.stringify(big)) / 1024 | 0}KB・出来事 ${big.detail.events.length}` : 'null');
  check('③ 終わっていない記録は送る形にしない', T.buildTacticsProLogRow(T.tacticsProLogStart({ difficulty: 'Hard', hero: 'Golem' })) === null);
  const sent = await T.sbSendTacticsProLog(row);
  check('③ 印が真なら tactics_pro_logs へ1回送る', sent === true && calls.length === 1 && String(calls[0][0]).endsWith('/rest/v1/tactics_pro_logs'));
  ctx.RELEASE_FLAGS.battleLog = false;
  // ④
  const hooks = {
    '始まり(候補5体・勇者モンと間合い)': /tacticsProLogRef\.current = runMode === BATTLE_MODE_TACTICS_PRO && !debugBattleRef\.current && proAllBase\s*\? tacticsProLogStart\(/,
    'ベースモンだけの回に限る(マスモンが混ざれば作らない)': /const proAllBase = mainHero\.masuId == null && proAllyPool\.every\(mon => mon && mon\.masuId == null\);/,
    'アシカ': /tacticsProLogAssist\(tacticsProLogRef\.current, teaching\.id\)/,
    'WAVE の始まり': /tacticsProLogWaveStart\(tacticsProLogRef\.current, \{ wave: w,/,
    '候補の3体(2か所)': /tacticsProLogOffer\(tacticsProLogRef\.current, avail\)[\s\S]*tacticsProLogOffer\(tacticsProLogRef\.current, avail\)/,
    '選んだ1体': /if \(!isHero && gameState === 'PICK_ALLY'\) tacticsProLogPick\(/,
    'トレーニング': /tacticsProLogTraining\(tacticsProLogRef\.current, picks\)/,
    'EX': /tacticsProLogSkill\(tacticsProLogRef\.current, 'ex', mon\.id, turnCount\)/,
    '固有技': /if \(hit\.isUnique\) tacticsProLogSkill\(tacticsProLogRef\.current, 'unique'/,
    '与えたダメージ(2か所)': /tacticsProLogDamage\(tacticsProLogRef\.current, \{ by: slots\[h\.slotIdx\][\s\S]*tacticsProLogDamage\(tacticsProLogRef\.current, \{ by: slots\[hit\.slotIdx\]/,
    '受けたダメージ・倒れた(commitTacticsUnits の1か所)': /tacticsProLogDown\(tacticsProLogRef\.current[\s\S]{0,400}tacticsProLogDamage\(tacticsProLogRef\.current, \{ to: slots\[index\]\?\.id, amount: lost, taken: true \}\)/,
    'WAVE の終わり(ターン・残りライフ)': /tacticsProLogWaveEnd\(tacticsProLogRef\.current, \{ turns: turnCount,/,
    '終わり(勝ち・負け・やめた)': /tacticsProLogFinish\(tacticsProLogRef\.current, \{ result: clearTurns \? 'clear' : \(gaveUp \? 'retire' : 'lose'\)/,
    'ほかの戦いでは捨てる': /if \(runMode !== BATTLE_MODE_TACTICS_PRO \|\| raidJackRunRef\.current\) tacticsProLogRef\.current = null;/,
  };
  const missing = Object.entries(hooks).filter(([, re]) => !re.test(app)).map(([k]) => k);
  check(`④ ゲームの各所へつながっている(${Object.keys(hooks).length}か所)`, missing.length === 0, missing.join('・'));
  // ⑤
  const dir = 'docs/sql/battle-log';
  const files = ['BATTLE_LOGS_APPLY.sql', 'BATTLE_LOGS_APPLY_TEST.sql', 'BATTLE_LOGS_VERIFY.sql'];
  check('⑤ SQL のファイルがある', files.every((f) => fs.existsSync(path.join(ROOT, dir, f))));
  const sqlAll = files.map((f) => read(`${dir}/${f}`)).join('\n').split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  check('⑤ 既存の表に触らない', !/drop\s+table|delete\s+from|truncate|\bupdate\s+public\./i.test(sqlAll) && [...sqlAll.matchAll(/alter\s+table\s+([\w.]+)/gi)].every((m) => ['public.tactics_pro_logs', 'public.raid_battle_logs'].includes(m[1]))
    && [...sqlAll.matchAll(/(?:on|into|from)\s+public\.(\w+)/gi)].every((m) => ['tactics_pro_logs', 'raid_battle_logs'].includes(m[1])));
  check('⑤ 予行演習は rollback で終わる・書き換え削除のポリシーを作らない', /rollback;\s*$/.test(read(`${dir}/BATTLE_LOGS_APPLY_TEST.sql`)) && !/for\s+(update|delete|all)\b/i.test(sqlAll));
  check('⑤ detail の上限(32,000 バイト)は送る側の上限より大きい', /octet_length\(detail::text\) <= 32000/.test(sqlAll) && T.TACTICS_PRO_LOG_MAX_BYTES < 32000);
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
