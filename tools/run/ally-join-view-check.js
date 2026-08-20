const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 供モン合流(PICK_ALLY)の画面を確認する。
//
//   node tools/run/ally-join-view-check.js
//
// 見ているもの:
//   ① 「現在のステータス」パネル(4ステータス＋間合い適性4距離)が出ていること
//   ② 候補カードが加算量ではなく「現在 → 合流後」を出していること
//   ③ 本体の allyJoinPreview をそのまま動かし、通常 / ULTIMATE(累計ターンで加算低下) /
//      NIGHTMARE(適性半減) の数値が、実際に合流させる confirmPick と一致すること
//   ④ あふれる可能性のあるスクロール領域へ justify-center を付けていないこと
//      (中央そろえは、あふれたぶんを上下へはみ出させる。スクロールで追えるのは下側だけなので
//       上側は永久に届かない。リザルト画面で実際に起きた不具合と同じ形)
const fs = require('fs');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i);
  return i >= 0 && j > i ? source.slice(i, j) : '';
};

// ---- ① 現在のステータスのパネル ----
check('供モン合流に「現在のステータス」パネルがある', has('data-join-status'));
const panel = slice('data-join-status', '{gameState===\'PICK_HERO\'&&(');
for (const label of ['ライフ', 'ちから', '丈夫さ', 'ガッツ']) {
  check(`パネルに${label}がある`, panel.includes(`'${label}'`), '');
}
check('パネルに間合い適性(距離補正)がある',
  panel.includes('間合い適性（距離補正）') && panel.includes('RANGE_LABELS.map') && panel.includes('distTotalBonus(idx)'));

// ---- ② カードの表示 ----
check('カードは加算量そのままではなく allyJoinPreview を通す', has('const preview=allyJoinPreview(m);'));
// 現在値はすぐ上のパネルにあるので、カードは合流後の値と変化量を出す。
// 「1480→1600」のように1枠へ両方入れるとiPhone SEの幅で数字が切れる(実測で確認済み)
check('カードに合流後の値と変化量を出す',
  has('{stat.after}</b>') && has("{stat.diff>0?`実際 +${stat.diff}`:'実際 ±0'}"));
check('カードに距離補正の変動を出す',
  has('{preview.apt.map(range=>(') && has('{formatAptPct(range.after)}') && has("{range.diff!==0?formatAptPct(range.diff):'±0'}"));
check('勇者モン選択は今までどおりその子の基礎値を出す',
  has('<span className="text-pink-400 font-bold">{m.baseHp}</span>'));
check('詳細ポップアップも同じ allyJoinPreview を通す',
  has('allyJoinPreview(currentPickingMon).stats.map(') && has('allyJoinPreview(currentPickingMon).apt.map(range=>range.diff)'));
check('NIGHTMAREの適性半減を詳細側にも反映できる(aptDeltaPct)',
  has('aptDeltaPct = null } = opts;') && has('const pct=aptDeltaPct?(aptDeltaPct[idx]||0):aptGradeToPct(grade);'));

check('ULTIMATE補正率は共通倍率を小数精度で表示し、カードは本来値と実際値を比較する',
  has('data-ultimate-join-status') && has('const multiplier=ultimateAllyJoinMultiplier(totalTurns);')
    && has('加入ボーナス {precisePercent(multiplier)}（-{precisePercent(1-multiplier)}）')
    && has('stat.normalDiff!==stat.diff') && has('実際 +${stat.diff}'));
const aptitudeCards = slice('{preview.apt.map(range=>(', "<div className=\"min-h-[32px]");
check('間合い適性にはULTIMATE低下の比較表示を付けない', !aptitudeCards.includes('normalDiff'));

// ---- ④ スクロールで全部たどれること ----
const listArea = slice('flex-1 overflow-y-auto mh-scroll w-full max-w-md mx-auto pb-4 min-h-0', 'バトルチュートリアル中は');
check('候補一覧のスクロール領域で justify-center を使っていない',
  listArea.length > 0 && !listArea.includes('justify-center'), listArea.slice(0, 100));
check('内側の入れ物を m-auto で寄せている(あふれても先頭からたどれる)',
  has("<div className={`w-full${gameState==='PICK_ALLY'?' m-auto':''}`}>"));

// ---- ③ 本体の計算をそのまま動かす ----
const calcSrc = `
const isQuickMode = (mode) => mode === 'quick';
const DIFFICULTY_SETTINGS = {};
${slice('const DIST_APTITUDE_MULT', 'const DIST_APTITUDE_COLOR')}
${slice('const EXTREME_DIFFICULTIES = Object.freeze', 'const extremeRuleSetting')}
${slice('const extremeRuleSetting', 'const specialRulePercent')}
${slice('const applyNightmareSignedModifier', 'const applyNightmareWaveEnhancement')}
${slice('const ultimateAllyJoinMultiplier', '// ===== トレーニング')}
${slice('const aptGradeToPct', '// 補正値の表示用文字列')}
${slice('const formatAptPct', '// 合流ボーナス欄に出す間合い適性')}
${slice('const applyExtremeIntegerRule', '// 極限チャレンジの説明にはモード全体に共通する')}
const RANGE_LABELS = ${JSON.stringify(['零','近','中','遠'])};
module.exports={specialRuleDifficultyForRun,ultimateAllyJoinMultiplier,applyAllyJoinBonus,getMonsterAptPct,formatAptPct,RANGE_LABELS};`;
const mod = { exports: {} };
try {
  new Function('module', 'exports', calcSrc)(mod, mod.exports);
} catch (e) {
  check('本体の計算関数を取り出せる', false, e.message);
}
const C = mod.exports;
check('本体の計算関数を取り出せる', typeof C.applyAllyJoinBonus === 'function' && typeof C.getMonsterAptPct === 'function');

if (typeof C.applyAllyJoinBonus === 'function') {
  check('ULTIMATE加入率は0.75%刻みを丸めず算出する',
    Math.abs(C.ultimateAllyJoinMultiplier(1) - 0.9925) < 1e-9
      && Math.abs(C.ultimateAllyJoinMultiplier(40) - 0.70) < 1e-9);
  // 本体の allyJoinPreview をそのまま持ってきて、状態だけ差し替えて動かす
  const previewSrc = slice('const allyJoinPreview = (mon) => {', '// 極限チャレンジの解放判定');
  const makePreview = new Function('ctx', `with(ctx){${previewSrc}\nreturn allyJoinPreview;}`);

  const build = ({ difficulty = 'Normal', extremeRun = false, extremeDifficulty = null, totalTurns = 0 }) => makePreview({
    specialRuleDifficultyForRun: C.specialRuleDifficultyForRun,
    applyAllyJoinBonus: C.applyAllyJoinBonus,
    getMonsterAptPct: C.getMonsterAptPct,
    RANGE_LABELS: C.RANGE_LABELS,
    runMode: 'extreme', difficulty,
    extremeRunRef: { current: extremeRun }, extremeDifficulty,
    waveResult: { totalTurnCount: totalTurns },
    maxHp: 500, atk: 100, def: 100, maxGuts: 100,
    distTotalBonus: () => 0,
  });

  // 零がM(+25%)・遠がG(-20%)の供モン
  const mon = { plusStats: { hp: 100, atk: 20, def: 20, guts: 10 }, distAptitude: ['M', 'C', 'C', 'G'] };

  const normal = build({})(mon);
  check('通常: ライフ 500 → 600', normal.stats[0].after === 600, String(normal.stats[0].after));
  check('通常: ちから 100 → 120', normal.stats[1].after === 120, String(normal.stats[1].after));
  check('通常: 零の距離補正 ±0 → +25%', Math.abs(normal.apt[0].diff - 0.25) < 1e-9, C.formatAptPct(normal.apt[0].diff));
  check('通常: 遠の距離補正 ±0 → -20%', Math.abs(normal.apt[3].diff + 0.20) < 1e-9, C.formatAptPct(normal.apt[3].diff));
  check('通常: 変化のない距離は ±0', normal.apt[1].diff === 0);

  // ULTIMATE: 累計ターン×0.75%ぶん加算が下がる。40ターンなら30%減
  const ult = build({ extremeRun: true, extremeDifficulty: 'ULTIMATE', totalTurns: 40 })(mon);
  check('ULTIMATE(累計40T): ライフの加算 100 → 70', ult.stats[0].diff === 70, String(ult.stats[0].diff));
  check('ULTIMATE(累計40T): ちからの加算 20 → 14', ult.stats[1].diff === 14, String(ult.stats[1].diff));
  check('ULTIMATE(累計0T)は通常と同じ', build({ extremeRun: true, extremeDifficulty: 'ULTIMATE', totalTurns: 0 })(mon).stats[0].diff === 100);

  // NIGHTMARE: プラス補正×0.5 / マイナス補正×2.0
  const nm = build({ extremeRun: true, extremeDifficulty: 'NIGHTMARE' })(mon);
  check('NIGHTMARE: 零の距離補正 +25% → +12.5%', Math.abs(nm.apt[0].diff - 0.125) < 1e-9, C.formatAptPct(nm.apt[0].diff));
  check('NIGHTMARE: 遠の距離補正 -20% → -40%', Math.abs(nm.apt[3].diff + 0.40) < 1e-9, C.formatAptPct(nm.apt[3].diff));

  // 合流ボーナスを持たない子でも落ちない
  const plain = build({})({ plusStats: null, distAptitude: null });
  check('合流ボーナスの無い候補でも落ちず ±0 になる',
    plain.stats.every(stat => stat.diff === 0) && plain.apt.every(range => range.diff === 0) && plain.changed === false);
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
