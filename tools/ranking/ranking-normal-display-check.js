const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// SupabaseのNormal応答が、取得入口から画面表示まで同じ内部キーで流れることを確認する。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(TOOLS_DIR, '..', 'monster-hero/src/game-system.jsx'), 'utf8');
// normalizeRankingDifficulty はモードごとの難易度キー一覧(チャレンジ＋プロ)を見るので、
// その一覧を作っている PRO_RANKING_PREFIX からまとめて取り出す
const normalizeStart = source.indexOf('const PRO_RANKING_PREFIX =');
const normalizeEnd = source.indexOf('\n};', source.indexOf('const normalizeRankingDifficulty =')) + 3;
const stateKeyStart = source.indexOf('const rankingDifficultyKey =');
const stateKeyEnd = source.indexOf('\n', stateKeyStart);
if (normalizeStart < 0 || normalizeEnd < 3 || stateKeyStart < 0) {
  throw new Error('ランキング内部キーの共通関数を抽出できません');
}

// 極限チャレンジの段階もランキングの難易度キーに入るので、その一覧も渡す
const extremeStart = source.indexOf('const EXTREME_DIFFICULTIES = Object.freeze([');
const extremeEnd = source.indexOf(']);', extremeStart) + 3;
const context = { DIFFICULTY_SETTINGS: { Normal: {}, Hard: {}, Master: {} }, String, Error, Object };
vm.createContext(context);
vm.runInContext(source.slice(extremeStart, extremeEnd), context);
vm.runInContext(`${source.slice(normalizeStart, normalizeEnd)}\n${source.slice(stateKeyStart, stateKeyEnd)}\nthis.key=rankingDifficultyKey;`, context);

const checks = [];
const check = (name, ok) => {
  checks.push(ok);
  console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
};

// Supabase GETが返した3件を本番と同じ変換・dedupe・state保存・UI参照順で流す。
const supabaseRows = [
  { user_name: 'Normal A', difficulty: 'Normal', score: 300 },
  { user_name: 'Normal B', difficulty: 'Normal', score: 200 },
  { user_name: 'Normal C', difficulty: 'Normal', score: 100 },
];
const localRankings = {};
const loadRankingsModel = (selectedDifficulty, rows) => {
  const key = context.key(selectedDifficulty);
  const transformed = rows.map(row => ({ userName: row.user_name, score: row.score }));
  const filtered = transformed.filter(row => Number.isFinite(row.score));
  const sorted = filtered.sort((a, b) => b.score - a.score);
  const deduped = [...new Map(sorted.map(row => [`${row.userName}|${row.score}`, row])).values()];
  localRankings[key] = deduped;
  return { key, responseCount: rows.length, transformedCount: transformed.length, filteredCount: filtered.length, sortedCount: sorted.length, dedupedCount: deduped.length };
};

const trace = loadRankingsModel('normal', supabaseRows);
const uiKey = context.key('Normal');
const displayed = localRankings[uiKey] || [];
check('Supabase GETはNormalを3件返す', trace.responseCount === 3);
check('変換/filter/sort/dedupe後も3件', [trace.transformedCount, trace.filteredCount, trace.sortedCount, trace.dedupedCount].every(n => n === 3));
check('Normal / normal / NORMALは同じstateキー', ['Normal', 'normal', 'NORMAL'].every(value => context.key(value) === 'Normal'));
check('state保存キーとUI参照キーが一致', trace.key === uiKey && uiKey === 'Normal');
check('Normalランキング画面へ3件表示', displayed.length === 3);
check('Normalが配列index 0でも除外されない', Object.keys(context.DIFFICULTY_SETTINGS).indexOf(uiKey) === 0 && displayed.length === 3);
check('NO RECORDS YET判定にならない', displayed.length !== 0);
check('loadRankings入口で内部キーへ正規化', source.includes('const normalizedTargetDiff = targetDiff == null ? null : rankingDifficultyKey(targetDiff)'));
check('state系Mapとstate更新が同じ内部キーを使用', source.includes('const d = rankingDifficultyKey(requestedDiff)'));
// 旧バトル画面のランキングはチャレンジ固定。極限の段階IDが選ばれたままでも
// normalizeRankingDifficulty を落とさないよう、通常の難易度へ寄せてから同じ内部キーにする
check('UI参照も同じ内部キーを使用', source.includes('const rankingViewKey = rankingDifficultyKey(')
  && source.includes('Object.prototype.hasOwnProperty.call(DIFFICULTY_SETTINGS, rankingViewDiff) ? rankingViewDiff : BATTLE_DEFAULT_DIFFICULTY)'));

for (const difficulty of ['Hard', 'Master']) {
  const result = loadRankingsModel(difficulty.toLowerCase(), [{ user_name: difficulty, difficulty, score: 1 }]);
  check(`${difficulty}は従来のキーで表示`, result.key === difficulty && (localRankings[context.key(difficulty)] || []).length === 1);
}

const failed = checks.filter(Boolean).length !== checks.length;
console.log(`\n${checks.filter(Boolean).length}/${checks.length} 項目OK`);
process.exit(failed ? 1 : 0);
