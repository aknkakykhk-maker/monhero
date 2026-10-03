// スコアの 1/1000 化(2026-10-03・ユーザー指示「1000分の1でタクティクス以外全部」)を確認する。
//
//   node tools/battle/score-shrink-check.js
//
// 見張るのは次の4点。
//   1. 全モードのスコアが、式はそのまま最後に 1/1000 へ縮むこと(0にならず、モードで分岐しないこと)
//   2. 端末に残った自己ベストなどを一度だけ縮める移行が、対象のキーだけを縮めること
//      (タクティクス・モンヒロビートの記録は一切触らない)
//   3. 二度走らせても二重に縮まないこと(縮めすぎは元に戻せない)
//   4. 保存に失敗したら、半分だけ縮んだ状態を残さず、完了フラグも立てないこと
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { REPO_ROOT } = require('../harness');

const read = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
const tactics = read('monster-hero/src/parts/32-tactics-units.jsx');
const masu = read('monster-hero/src/parts/11-masu-progression.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const from = tactics.indexOf('const TACTICS_SCORE_DIVISOR');
const to = tactics.indexOf('// ===== 供モンが合流すると敵も強くなる');
check('縮め方と移行が 32-tactics-units.jsx にある', from >= 0 && to > from);
const txStart = masu.indexOf('const saveStoredValuesOrRollback');
const txEnd = masu.indexOf('\n};', txStart) + 3;
check('取引関数が 11-masu-progression.jsx にある', txStart >= 0 && txEnd > txStart);

const context = { SPECIES_CHALLENGE_PROGRESS_KEY: 'mh_species_challenge_progress_v1', console: { error() {} } };
vm.createContext(context);
vm.runInContext(`${masu.slice(txStart, txEnd)}\n${tactics.slice(from, to)}\n;globalThis.api = {
  shrinkBattleScore, shrinkSavedBattleScore, isBattleScoreShrinkRankingKey, shrinkSpeciesProgressScores,
  migrateBattleScoresToShrunk, saveStoredValuesOrRollback, FLAG: BATTLE_SCORE_SHRINK_MIGRATED_KEY };`, context);
const api = context.api;

// ---- 1. 縮め方 ----
check('1,500,000 点は 1,500 点になる', api.shrinkBattleScore(1500000) === 1500);
check('1点でも入っていれば 0 にしない(999 → 1)', api.shrinkBattleScore(999) === 1);
check('0・負・数でないものは 0', api.shrinkBattleScore(0) === 0 && api.shrinkBattleScore(-5) === 0 && api.shrinkBattleScore('x') === 0);
check('スコアの計算はモードを見ずに shrinkBattleScore を通る',
  app.includes('const finalRoundScore=shrinkBattleScore(rawRoundScore);'));
check('保存値は 0 や壊れた値をそのまま返す',
  api.shrinkSavedBattleScore(0) === 0 && api.shrinkSavedBattleScore('abc') === 'abc' && api.shrinkSavedBattleScore(null) === null
  && api.shrinkSavedBattleScore(2500000) === 2500);
check('送信待ちの難易度: タクティクス・モンヒロビートは対象外',
  !api.isBattleScoreShrinkRankingKey('TacticsHard') && !api.isBattleScoreShrinkRankingKey('TacticsProBetaNormal')
  && !api.isBattleScoreShrinkRankingKey('TacticsSpecies-x-Hard') && !api.isBattleScoreShrinkRankingKey('Rhythm-a-b')
  && api.isBattleScoreShrinkRankingKey('Hard') && api.isBattleScoreShrinkRankingKey('ProMaster')
  && api.isBattleScoreShrinkRankingKey('ExtremeEXTREME') && api.isBattleScoreShrinkRankingKey('Species-mocchi-Hell'));

// ---- 2〜4. 移行 ----
const makeStore = (initial, failOn) => {
  const data = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
  return {
    data,
    get: async (key, def) => (data.has(key) ? JSON.parse(JSON.stringify(data.get(key))) : def),
    set: async (key, value) => {
      if (failOn && failOn(key, value)) throw new Error('disk full');
      if (value === null) data.delete(key); else data.set(key, JSON.parse(JSON.stringify(value)));
    },
    list: async (prefix) => [...data.keys()].filter(k => k.startsWith(prefix)),
  };
};
const initial = () => ({
  mh_hs_Hard: 4500000, mh_hs_Normal: 0, mh_hs_Easy: 700,
  mh_quick_hs_Hard: 1200000, mh_pro_hs_Master: 90000000, mh_extreme_hs_EXTREME: 123456789,
  mh_tactics_hs_Hard: 4200, mh_tactics_pro_hs_Hard: 3100,
  mh_species_challenge_progress_v1: { version: 1, species: { mocchi: { cleared: { Hard: true }, firstRewardClaimed: {},
    records: { Hard: { bestScore: 8000000, bestTurns: 40, clears: 2 }, Easy: { bestScore: 0, bestTurns: null, clears: 0 } } } } },
  mh_tactics_species_challenge_progress_v1: { version: 1, species: { mocchi: { records: { Hard: { bestScore: 5000 } } } } },
  mh_rank_Hard: [{ userName: 'a', score: 3000000, clearId: 'x', nationalSaved: false }, { userName: 'b', score: 10, clearId: 'y' }],
  mh_rank_TacticsHard: [{ userName: 'a', score: 4000, clearId: 'z' }],
  'mh_rank_Rhythm-song-EASY': [{ userName: 'a', score: 987654, clearId: 'r' }],
  mh_ranking_cache: { score: { Hard: [{ score: 1 }] }, at: 1 },
  mh_gold: 12345,
});
(async () => {
  const s = makeStore(initial());
  const first = await api.migrateBattleScoresToShrunk(s.get, s.set, s.list, api.saveStoredValuesOrRollback);
  check('移行が完了し、完了フラグが立つ', first.done === true && s.data.get(api.FLAG) === true, JSON.stringify(first));
  check('チャレンジ・クイック・プロ・極限の自己ベストが 1/1000 になる',
    s.data.get('mh_hs_Hard') === 4500 && s.data.get('mh_hs_Easy') === 1 && s.data.get('mh_quick_hs_Hard') === 1200
    && s.data.get('mh_pro_hs_Master') === 90000 && s.data.get('mh_extreme_hs_EXTREME') === 123456);
  check('0 の自己ベストは 0 のまま(キーも増えない)', s.data.get('mh_hs_Normal') === 0);
  check('タクティクスの自己ベストは触らない', s.data.get('mh_tactics_hs_Hard') === 4200 && s.data.get('mh_tactics_pro_hs_Hard') === 3100);
  const sp = s.data.get('mh_species_challenge_progress_v1').species.mocchi;
  check('種族チャレンジの自己ベストだけが縮み、ほかの項目は変わらない',
    sp.records.Hard.bestScore === 8000 && sp.records.Hard.bestTurns === 40 && sp.records.Hard.clears === 2
    && sp.records.Easy.bestScore === 0 && sp.cleared.Hard === true);
  check('タクティクスの種族チャレンジは触らない',
    s.data.get('mh_tactics_species_challenge_progress_v1').species.mocchi.records.Hard.bestScore === 5000);
  check('送信待ちの score が縮み、ほかの項目は変わらない',
    s.data.get('mh_rank_Hard')[0].score === 3000 && s.data.get('mh_rank_Hard')[1].score === 1
    && s.data.get('mh_rank_Hard')[0].clearId === 'x' && s.data.get('mh_rank_Hard')[0].nationalSaved === false);
  check('タクティクス・モンヒロビートの送信待ちは触らない',
    s.data.get('mh_rank_TacticsHard')[0].score === 4000 && s.data.get('mh_rank_Rhythm-song-EASY')[0].score === 987654);
  check('ランキングの控え(表示用)は捨てて取り直させる', !s.data.has('mh_ranking_cache'));
  check('関係ない保存値は変わらない', s.data.get('mh_gold') === 12345);

  const second = await api.migrateBattleScoresToShrunk(s.get, s.set, s.list, api.saveStoredValuesOrRollback);
  check('二度目は何もしない(二重に縮めない)', second.done === false && second.changed === 0 && s.data.get('mh_hs_Hard') === 4500);

  // 保存に失敗したら全部元へ戻し、フラグも立てない
  let diskFull = true;
  const bad = makeStore(initial(), (key) => diskFull && key === 'mh_pro_hs_Master');
  const snapshot = (store) => JSON.stringify([...store.data.entries()].filter(([k]) => k !== api.FLAG).sort(([x], [y]) => (x < y ? -1 : 1)));
  const beforeJson = snapshot(bad);
  const failedRun = await api.migrateBattleScoresToShrunk(bad.get, bad.set, bad.list, api.saveStoredValuesOrRollback);
  check('保存に失敗したら完了にしない(フラグは立たない)', failedRun.done === false && bad.data.get(api.FLAG) !== true);
  check('失敗したら半分だけ縮んだ状態を残さない(全部元の値に戻る)', snapshot(bad) === beforeJson);
  diskFull = false;
  const retry = await api.migrateBattleScoresToShrunk(bad.get, bad.set, bad.list, api.saveStoredValuesOrRollback);
  check('保存できるようになったら次の起動でやり直せて、一度だけ縮む',
    retry.done === true && bad.data.get('mh_hs_Hard') === 4500 && bad.data.get('mh_pro_hs_Master') === 90000);

  // 壊れた保存値でも落ちない
  const odd = makeStore({ mh_hs_Hard: 'abc', mh_species_challenge_progress_v1: 'x', mh_rank_Hard: 'y', mh_quick_hs_Easy: null });
  const oddRun = await api.migrateBattleScoresToShrunk(odd.get, odd.set, odd.list, api.saveStoredValuesOrRollback);
  check('壊れた保存値があっても落ちずに完了する', oddRun.done === true && odd.data.get('mh_hs_Hard') === 'abc');

  check('読み込みの前に移行を呼ぶ',
    app.indexOf('await migrateBattleScoresToShrunk(storeGet, storeSet, storeList, saveStoredValuesOrRollback);')
      > 0
    && app.indexOf('await migrateBattleScoresToShrunk(')
      < app.indexOf("scores[d] = await storeGet(`mh_hs_${d}`, 0, false);"));

  if (failed) { console.log(`\nNG ${failed}件`); process.exit(1); }
  console.log('\nすべてOK');
})();
