// ランキングの編成情報を確認する。
// 一覧には出さず、行をタップして開く「パーティー詳細」で見せる形になっている。
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
// 記録の作り方(勇者モンの区別・個体ID・染めた色)
for(const token of [
  "role:index===heroSlotIndex?'hero':'ally'",
  'masuId:s.masuId||null',
  'const colors = rankingPartyColors(s.id, s.colors);',
  'const splitRankingParty',
  "entry?.heroMasuId",
]) assert(src.includes(token), token);
// 詳細で編成を見せる(勇者モンの区別・距離・絆Lv・染めた色・古い記録の受け皿)
for(const token of [
  'const [rankingPartyDetail, setRankingPartyDetail] = useState(null);',
  "const isHero=(m)=>m?.role==='hero'",
  '{RANGE_LABELS[m.slotIndex]}距離',
  '<DyedMonsterImage baseId={rankingMonsterIdOf(m)}',
  '編成情報なし（過去の記録）',
  '勇者モン情報なし',
]) assert(src.includes(token), token);
// 一覧には編成を出さない(50件×最大4体で開いた瞬間に引っかかるため)
const listStart=src.indexOf('const renderScoreRankingEntry = (entry, index)');
const listEnd=src.indexOf('const renderBreederRankingEntry');
const list=src.slice(listStart,listEnd);
assert(!list.includes('供モン:'), '一覧に供モンを出さない');
assert(!list.includes('DyedMonsterImage'), '一覧で染色しない');
assert(list.includes('パーティー詳細'), '一覧から詳細へ入れることが分かる');
assert(!src.includes('パーティ:</span>{party.slice(0,3)'));
console.log('OK: ランキングの編成は詳細でだけ見せている');
