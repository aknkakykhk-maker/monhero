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
  check(`${label}: 共通の一度だけ送信する処理を使う`, code.includes('submitRunScoreOnce'));

  const nextWave = code.slice(code.indexOf('const handleNextWave'), code.indexOf('// スロットで現在選べる固有技一覧'));
  check(`${label}: ムー撃破処理がランキングPOSTを直接待たない`, !/await\s+submitLocalScore/.test(nextWave));
  check(`${label}: リザルト表示後にランキング送信を始める`, nextWave.indexOf("setGameState('CHAMPION')") < nextWave.lastIndexOf('submitRunScoreOnce()'));

  const submit = code.slice(code.indexOf('const submitLocalScore'), code.indexOf('const handleSaveName'));
  check(`${label}: POST直後に全難易度を再取得しない`, !/await\s+loadRankings\(\)/.test(submit));
  check(`${label}: 過去の完全重複をプレイ内容で畳む`, code.includes('const rowKey =') && code.includes('uniqueScoreRows'));
}

const failed = checks.filter(ok => !ok).length;
console.log(`\n${checks.length - failed}/${checks.length} 項目OK`);
process.exit(failed ? 1 : 0);
