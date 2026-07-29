const fs = require('fs');
const src = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
let passed = 0;
const check = (condition, label) => {
  if (!condition) throw new Error(`NG: ${label}`);
  passed += 1;
  console.log(`OK: ${label}`);
};

check(src.includes('const renderRankingEntry = (entry, index, kind) =>'), 'ランキング3種が共通の詳細行を使用');
for (const text of ['勇者モン情報なし', '編成情報なし（過去の記録）', 'ブリーダーLv情報なし', '絆Lv情報なし', 'スコア情報なし']) {
  check(src.includes(text), `旧データの安全な代替表示: ${text}`);
}
for (const kind of ['score', 'breeder', 'bond']) {
  check(src.includes(`renderRankingEntry(r,i,'${kind}')`), `${kind}ランキングに詳細行を表示`);
}
check(src.includes('member?.imgUrl') && src.includes('heroMember?.imgUrl'), '勇者モンとパーティの画像を表示');
check(src.includes('{ ...r, userName: name, level: lv }'), 'ブリーダーLv集計後も編成・スコアを保持');
check(src.includes("{ ...r, userName: r.userName || '名無しのブリーダー'"), '絆Lv集計後もプレイヤー詳細を保持');
check(src.includes('initialBattleDistanceRef.current=slotIdx'), '編成画面で選んだ勇者モンの初期間合いを保持');
check(src.includes("w===1 && !forcedEnemyKey ? initialBattleDistanceRef.current : null"), '通常バトルの最初のWAVEへ初期間合いを反映');
check(src.includes('Number.isInteger(initialDistance)&&initialDistance>=0&&initialDistance<RANGE_LABELS.length'), '零・近・中・遠の範囲だけを内部距離に使用');
console.log(`\n${passed}/${passed} 項目OK`);
