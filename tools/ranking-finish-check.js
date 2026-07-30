// ラン終了時のランキング処理が、再び画面遷移を通信待ちにしたり多重送信を許したりしないか確認する。
// 実通信に依存せず、配信用ソースと生成物の両方を対象にした回帰チェック。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const compiled = fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202607280001_rankings_clear_id.sql'), 'utf8');
const checks = [];
const check = (name, ok) => {
  checks.push(ok);
  console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
};

for (const [label, code] of [['ソース', source], ['配信用JS', compiled]]) {
  check(`${label}: 周回単位の送信ロックがある`, code.includes('scoreSubmittedRef.current'));
  check(`${label}: 終了処理の連打ロックがある`, code.includes('runFinalizingRef.current'));
  check(`${label}: 報酬付与にも独立した一度だけロックがある`, code.includes('rewardsAwardedRef.current'));
  check(`${label}: クリア回数にも独立した一度だけロックがある`, code.includes('clearRecordedRef.current') && code.includes('recordClearOnce'));
  check(`${label}: クリア回数の永続化をReact state updaterの外で行う`,
    code.includes('await storeSet(`mh_clears_${difficulty}`, nextCount, false)')
      && !/setClearCounts\(prev\s*=>\s*\{[^}]*storeSet\(/s.test(code));
  check(`${label}: 最終リザルト遷移中は次へボタンを無効化`,
    (code.includes('disabled={runFinalizing}') || code.includes('disabled: runFinalizing'))
      && (code.includes('aria-busy={runFinalizing}') || code.includes('"aria-busy": runFinalizing')));
  check(`${label}: 共通の一度だけ送信する処理を使う`, code.includes('submitRunScoreOnce'));
  check(`${label}: clear_idでランキングPOSTを冪等化`, code.includes("'?on_conflict=clear_id'") && code.includes('resolution=ignore-duplicates'));
  check(`${label}: ランキングPOSTはclear_idを必須にして非冪等経路を持たない`,
    code.includes("typeof row?.clear_id !== 'string'")
      && code.includes('ranking clear_id is required; unsafe insert skipped')
      && !/sbInsertScore\s*=\s*async\s*\(row,\s*idempotent/.test(code));
  check(`${label}: clear_id未対応時に非冪等POSTへ退避しない`, code.includes('unsafe insert skipped') && !code.includes("if (!saved && clearIdUnsupported) await sbInsertScore"));
  check(`${label}: Normalを含む全難易度で共通の周回IDリセットを使う`,
    code.includes('const beginNewRankingRun') && (code.match(/beginNewRankingRun\(\{/g) || []).length === 2);
  check(`${label}: UNIQUE違反のHTTP statusとPostgres codeを診断ログへ残す`,
    code.includes("errorCode = JSON.parse(body)?.code") && code.includes("res.status === 409 && errorCode === '23505'")
      && code.includes('status: res.status') && /errorCode,\s*isUniqueViolation,\s*error:/s.test(code));
  check(`${label}: 最終画面の遷移ボタンを同期ロックする`, code.includes('resultActionRef.current') && code.includes('runResultActionOnce'));
  check(`${label}: 終了処理中は画面全体の入力を遮断する`, code.includes('resultProcessing') && code.includes('aria-label') && code.includes('touchAction'));
  check(`${label}: ランキングPOSTに8秒の上限`, code.includes("new Error('ranking insert timed out after 8000ms')") && code.includes('signal: controller.signal'));
  check(`${label}: 全難易度を全項目の単一payloadで1回だけPOST`,
    /const row = \{\s*difficulty: diff,\s*user_name: name,\s*hero: heroName,\s*party,\s*score: finalScore,\s*level,\s*icon,\s*clear_id: clearId\s*\}/s.test(code)
      && !code.includes('const variants = ['));
  check(`${label}: 全国保存とローカル保存の成功判定を分離`,
    /nationalSaved: false,\s*localSaved/s.test(code) && /if \(!result(?:\?\.nationalSaved|\.nationalSaved)\)/.test(code));

  const nextWave = code.slice(code.indexOf('const handleNextWave'), code.indexOf('// スロットで現在選べる固有技一覧'));
  check(`${label}: ムー撃破処理がランキングPOSTを直接待たない`, !/await\s+submitLocalScore/.test(nextWave));
  check(`${label}: リザルト表示後もランキング保存完了まで入力ロック`, nextWave.indexOf("setGameState('CHAMPION')") < nextWave.indexOf('await submitRunScoreOnce()') && nextWave.indexOf('await submitRunScoreOnce()') < nextWave.indexOf('setResultProcessing(false)'));

  const submit = code.slice(code.indexOf('const submitLocalScore'), code.indexOf('const handleSaveName'));
  check(`${label}: ランキング保存を自己ベスト判定より先に完了`,
    code.indexOf('await submitLocalScore(difficulty, score, runIdRef.current)') < code.indexOf('if (score > (highScores[difficulty] || 0))'));
  check(`${label}: POST直後に保存した難易度だけを強制再取得`, code.includes('await loadRankings(normalizeRankingDifficulty(diff), false, true)'));
  check(`${label}: POST直後に全難易度を再取得しない`, !/await\s+loadRankings\(\)/.test(submit));
  check(`${label}: 強制再取得は保存前の同難易度通信完了後に開始`, code.includes('if (!force) return pending') && code.includes('await pending'));
  check(`${label}: 過去の完全重複をプレイ内容で畳む`, code.includes('const rowKey =') && code.includes('uniqueScoreRows'));
  check(`${label}: 通常スコア表示は選択難易度だけ取得`, code.includes('loadRankings(difficulty)') && code.includes('normalizedTargetDiff') && code.includes('[normalizedTargetDiff]'));
  const preloadAt = code.indexOf('background preload failed');
  check(`${label}: 起動後に全難易度をバックグラウンド先読み`, preloadAt > 0 && code.includes('!normalizedTargetDiff') && code.includes('Object.keys(DIFFICULTY_SETTINGS)'));
  check(`${label}: ランキング先読みを起動完了条件にしない`, code.indexOf('setDataLoaded(true)') < preloadAt && !code.includes('await loadRankings()'));
  check(`${label}: 先読みと画面表示の通信を共有`, code.includes('rankingRequestsRef.current.has(requestKey)') && code.includes('rankingRequestsRef.current.set(requestKey, request)'));
  check(`${label}: 30秒以内の取得済みデータを再利用`, code.includes('Date.now() - fetchedAt < 30000'));
  check(`${label}: ランキング通信に8秒の上限`, code.includes('setTimeout(() => controller.abort(), 8000)'));
  check(`${label}: ランキング取得列を必要項目に限定`, code.includes("const select = 'user_name,hero,party,score,level,icon'"));
  check(`${label}: 起動時はNormalとMasterを優先`, code.includes("['Normal', 'Master', ...allDiffs.filter"));
  check(`${label}: スコアは同時取得し一部失敗も完了扱い`, code.includes('Promise.allSettled(diffs.map(loadOne))'));
  check(`${label}: レベル系は難易度で絞らず1回で取得`, code.includes("sbFetchRankings(null, RANKING_LEVEL_FETCH_LIMIT, order, 0, requestId)"));
  check(`${label}: 取得上限は仕様どおり上位50件`, code.includes('const RANKING_DIAGNOSTIC_LIMIT = 50'));
  check(`${label}: 端末内自己ベストから復旧`, code.includes('`mh_hs_${d}`') && code.includes("hero: '記録復旧'"));
  check(`${label}: score.desc失敗時も診断用上限を使う`, code.includes("sbFetchRankings(d, RANKING_DIAGNOSTIC_LIMIT, 'id.desc', 0"));
  // 取得順は primaryOrder に集約されている。score系は score.desc.nullslast、絆は id.desc。
  check(`${label}: score=NULLの旧データが取得枠を埋めない`, code.includes("const primaryOrder = includeLevels && levelKind === 'bond' ? 'id.desc' : 'score.desc.nullslast'") && code.includes('fetchMasterRows(primaryOrder, requestId)'));
  check(`${label}: stateの最新ハイスコアも復旧元に使う`, code.includes('highScoresRef.current[d]'));
  check(`${label}: 0件成功をローカル復旧へ誤分類しない`, !code.includes('if (byDiff[d].length === 0)'));
  check(`${label}: 古い同一取得単位のリクエストを画面へ反映しない`, code.includes("'stale-result-discarded'") && code.includes('rankingLatestRequestRef.current.get(latestKey) !== requestId'));
  check(`${label}: HTTP応答とフォールバック理由を診断ログへ残す`, code.includes("'supabase-response'") && code.includes("'fallback'"));
  check(`${label}: 難易度を共通keyへ正規化してeqで取得`, code.includes('normalizeRankingDifficulty') && code.includes('difficulty=eq.'));
  check(`${label}: 取得失敗を0件表示で隠さない`, code.includes('status.error') && code.includes('!status.fetched'));
  check(`${label}: 取得済み一覧を再取得中も維持`, /loading:\s*!current\.fetched/.test(code) && /refreshing:\s*current\.fetched/.test(code));
  check(`${label}: 表示状態をランキングkeyごとに分離`, code.includes('score:${d}') && code.includes('`${levelKind}:all`'));
}

check('Migration: clear_idを既存行互換のNULL許容列として追加する',
  /add column if not exists clear_id text\s*;/i.test(migration)
    && !/clear_id text\s+not null/i.test(migration));
check('Migration: clear_idだけを対象にしたUNIQUE indexがある',
  /create unique index if not exists rankings_clear_id_unique\s+on public\.rankings\s*\(clear_id\)/i.test(migration));
check('Migration: 既存ランキングを削除・再作成しない',
  !/\b(delete\s+from|truncate|drop\s+table)\s+(?:public\.)?rankings\b/i.test(migration));
check('Migration: 再実行可能なDDLになっている',
  /add column if not exists/i.test(migration) && /create unique index if not exists/i.test(migration));
check('Migration: 既存clear_idが重複していれば削除せず停止する',
  /where clear_id is not null\s*group by clear_id\s*having count\(\*\) > 1/is.test(migration)
    && /raise exception 'rankings\.clear_id has duplicate values; existing rows were not changed'/i.test(migration));
check('Migration: 同名indexの定義・有効性まで検証する',
  /index_state\.indisunique/i.test(migration)
    && /index_state\.indisvalid/i.test(migration)
    && /index_state\.indisready/i.test(migration)
    && /index_state\.indnkeyatts = 1/i.test(migration)
    && /attname = 'clear_id'/i.test(migration));

const failed = checks.filter(ok => !ok).length;
console.log(`\n${checks.length - failed}/${checks.length} 項目OK`);
process.exit(failed ? 1 : 0);
