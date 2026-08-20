const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ランキングの表示まわりを確認する。
//
//   ① 3種のランキング(スコア・ブリーダーLv・絆Lv)がそれぞれのカードで出ている
//   ② 古い記録でも壊れず、代わりの文言が出る
//   ③ 編成の詳細(行をタップして開く)で、その人が染めた色まで見られる
//   ④ 一覧では染色しない(重いため。実測は tools/ranking/ranking-dye-cost-check.js)
//   ⑤ 編成画面で選んだ初期間合いがバトルへ渡っている
const fs = require('fs');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const src = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => src.includes(needle);

// --- ① 3種のランキング ---
for (const [kind, fn] of [['スコア', 'renderScoreRankingEntry'], ['ブリーダーLv', 'renderBreederRankingEntry'], ['絆Lv', 'renderBondRankingEntry']]) {
  check(`${kind}ランキングのカードがある`, has(`const ${fn} = (entry, index)`));
}

// --- ② 古い記録の受け皿 ---
for (const text of ['勇者モン情報なし', '編成情報なし（過去の記録）', 'ブリーダーLv情報なし', '絆Lv情報なし', 'スコア情報なし']) {
  check(`古い記録でも代わりの文言が出る: ${text}`, has(text));
}
check('ブリーダーLv集計後も編成・スコアを保持', has('{ ...r, userName: name, level: lv }'));
// 絆Lvは個体ごとに畳むが、誰の記録かとアイコンは残す
check('絆Lv集計後もプレイヤー詳細を保持',
  has("const entry={userName,icon:record.icon,monName,bondLevel,"));

// --- ③ 編成の詳細 ---
check('行をタップすると編成の詳細が開く',
  has('onClick={()=>setRankingPartyDetail(entry)}') && has('const [rankingPartyDetail, setRankingPartyDetail] = useState(null);'));
check('詳細でその人が染めた色を出す',
  has('<DyedMonsterImage baseId={rankingMonsterIdOf(m)}') && has('masuColors={colors}'));
check('色を記録にも残している',
  has('const colors = rankingPartyColors(s.id, s.colors);')
    && has('...(dyed ? { colors } : {})'));
// 染めていない子に colors を付けると、記録の形が変わって
// ローカル保存とサーバー取得を畳む rowKey がずれる。付けるのは染めた子だけにする
check('染めていない子には色を付けない', has('const dyed = colors.some(Boolean);') && has('...(dyed ? { colors } : {})'));
check('任意の色でも見本の色が出せる', has('backgroundColor:getColorSwatchHex(c)'));
check('置いていた距離も出す',
  has('const byDistance=raw&&raw.length===RANGE_LABELS.length;') && has('{RANGE_LABELS[m.slotIndex]}距離'));
check('勇者モンが分かるようにする', has("const isHero=(m)=>m?.role==='hero'"));

// --- ④ 一覧では染色しない(重いため) ---
const listStart = src.indexOf('const renderScoreRankingEntry = (entry, index)');
const listEnd = src.indexOf('const renderBreederRankingEntry');
const listBlock = src.slice(listStart, listEnd);
check('一覧では染色しない(一覧はふつうの画像のまま)',
  !listBlock.includes('DyedMonsterImage'),
  '一覧で染めると再着色が重すぎる(実測 tools/ranking/ranking-dye-cost-check.js)');
check('重さを実測する道具がある', fs.existsSync(path.join(root, 'tools/ranking/ranking-dye-cost-check.js')));

// --- ⑤ 初期間合い ---
check('編成画面で選んだ勇者モンの初期間合いを保持', has('initialBattleDistanceRef.current=slotIdx'));
check('通常バトルの最初のWAVEへ初期間合いを反映',
  has('w===1 && !forcedEnemyKey ? initialBattleDistanceRef.current : null'));
check('零・近・中・遠の範囲だけを内部距離に使う',
  has('Number.isInteger(initialDistance)&&initialDistance>=0&&initialDistance<RANGE_LABELS.length'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
