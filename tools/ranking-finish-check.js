// ラン終了時のランキング処理が、再び画面遷移を通信待ちにしたり多重送信を許したりしないか確認する。
// 実通信に依存せず、配信用ソースと生成物の両方を対象にした回帰チェック。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const compiled = fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8');
const checks = [];
const check = (name, ok) => {
  checks.push(ok);
  console.log(`${ok ? 'OK' : 'NG'}: ${name}`);
};

for (const [label, code] of [['ソース', source], ['配信用JS', compiled]]) {
  check(`${label}: 周回単位の送信ロックがある`, code.includes('scoreSubmittedRef.current'));
  check(`${label}: 終了処理の連打ロックがある`, code.includes('runFinalizingRef.current'));
  check(`${label}: 報酬付与にも独立した一度だけロックがある`, code.includes('rewardsAwardedRef.current'));
  check(`${label}: 最終リザルト遷移中は次へボタンを無効化`,
    (code.includes('disabled={runFinalizing}') || code.includes('disabled: runFinalizing'))
      && (code.includes('aria-busy={runFinalizing}') || code.includes('"aria-busy": runFinalizing')));
  check(`${label}: 共通の一度だけ送信する処理を使う`, code.includes('submitRunScoreOnce'));
  check(`${label}: clear_idでランキングPOSTを冪等化`, code.includes("'?on_conflict=clear_id'") && code.includes('resolution=ignore-duplicates'));
  check(`${label}: clear_id未対応時に非冪等POSTへ退避しない`, code.includes('unsafe insert skipped') && !code.includes("if (!saved && clearIdUnsupported) await sbInsertScore"));
  check(`${label}: 最終画面の遷移ボタンを同期ロックする`, code.includes('resultActionRef.current') && code.includes('runResultActionOnce'));
  check(`${label}: 終了処理中は画面全体の入力を遮断する`, code.includes('resultProcessing') && code.includes('aria-label') && code.includes('touchAction'));

  const nextWave = code.slice(code.indexOf('const handleNextWave'), code.indexOf('// スロットで現在選べる固有技一覧'));
  check(`${label}: ムー撃破処理がランキングPOSTを直接待たない`, !/await\s+submitLocalScore/.test(nextWave));
  check(`${label}: リザルト表示後にランキング送信を始める`, nextWave.indexOf("setGameState('CHAMPION')") < nextWave.lastIndexOf('submitRunScoreOnce()'));

  const submit = code.slice(code.indexOf('const submitLocalScore'), code.indexOf('const handleSaveName'));
  check(`${label}: POST直後に全難易度を再取得しない`, !/await\s+loadRankings\(\)/.test(submit));
  check(`${label}: 過去の完全重複をプレイ内容で畳む`, code.includes('const rowKey =') && code.includes('uniqueScoreRows'));
  check(`${label}: 通常スコア表示は選択難易度だけ取得`, code.includes('loadRankings(difficulty)') && code.includes('targetDiff') && code.includes('[targetDiff]'));
  const preloadAt = code.indexOf('background preload failed');
  check(`${label}: 起動後に全難易度をバックグラウンド先読み`, preloadAt > 0 && code.includes('!targetDiff') && code.includes('Object.keys(DIFFICULTY_SETTINGS)'));
  check(`${label}: ランキング先読みを起動完了条件にしない`, code.indexOf('setDataLoaded(true)') < preloadAt && !code.includes('await loadRankings()'));
  check(`${label}: 先読みと画面表示の通信を共有`, code.includes('rankingRequestsRef.current.has(requestKey)') && code.includes('rankingRequestsRef.current.set(requestKey, request)'));
  check(`${label}: 30秒以内の取得済みデータを再利用`, code.includes('Date.now() - fetchedAt < 30000'));
  check(`${label}: ランキング通信に8秒の上限`, code.includes('setTimeout(() => controller.abort(), 8000)'));
  check(`${label}: ランキング取得列を必要項目に限定`, code.includes("const select = 'user_name,hero,party,score,level,icon'"));
  check(`${label}: 起動時はNormalとMasterを優先`, code.includes("['Normal', 'Master', ...allDiffs.filter"));
  check(`${label}: 起動時の同時取得を2難易度に制限`, code.includes('diffs.slice(i, i + 2).map(loadOne)'));
  check(`${label}: 診断用の取得上限は20件`, code.includes('const RANKING_DIAGNOSTIC_LIMIT = 20'));
  check(`${label}: 端末内自己ベストから復旧`, code.includes('`mh_hs_${d}`') && code.includes("hero: '記録復旧'"));
  check(`${label}: score.desc失敗時も診断用上限を使う`, code.includes("sbFetchRankings(d, RANKING_DIAGNOSTIC_LIMIT, 'id.desc', 0"));
  check(`${label}: stateの最新ハイスコアも復旧元に使う`, code.includes('highScoresRef.current[d]'));
  check(`${label}: 0件成功をローカル復旧へ誤分類しない`, !code.includes('if (byDiff[d].length === 0)'));
  check(`${label}: 古い同難易度リクエストを画面へ反映しない`, code.includes("'stale-result-discarded'") && code.includes('rankingLatestRequestRef.current.get(d) !== requestId'));
  check(`${label}: HTTP応答とフォールバック理由を診断ログへ残す`, code.includes("'supabase-response'") && code.includes("'fallback'"));
}

const failed = checks.filter(ok => !ok).length;
console.log(`\n${checks.length - failed}/${checks.length} 項目OK`);
process.exit(failed ? 1 : 0);
