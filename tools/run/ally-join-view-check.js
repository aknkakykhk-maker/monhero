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
const panel = slice('data-join-status', '{pickMode===\'hero\'&&(');
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
  has('{preview.apt.map(range=>(') && has('{formatAptPct(range.after)}') && has("${formatAptPct(range.diff)}`:'±0'}"));
// ★タクティクスはステータスを1体ずつ持つ(設計 4.4)。合計(ライフ・ガッツ)と
//   平均(ちから・丈夫さ)が混ざった4つを並べても読み取れないので、
//   **立っている子ごと**に出す(2026-09-21 ユーザー指示)
check('タクティクスは盤面を1体ずつ出す',
  has('data-tactics-board-status') && has('data-tactics-board-slot={idx}')
    && has('{mon.masuName||mon.name}') && has('力 {unit.atk}') && has('防 {unit.def}'));
// ★空いている間合いを 0% と出すと「適性が0なのか、誰もいないのか」が見分けられない
check('空いている間合いは「空き」と出す', has('>空き</span>'));
// ★既存5モードは今までどおり合計の4つを出す(1体ずつのステータスを持たないため)
check('既存モードは今までどおり「現在のステータス」',
  has('現在のステータス') && has('{Array.isArray(tacticsUnits)?(<>'));
check('勇者モン選択は今までどおりその子の基礎値を出す',
  has('<span className="text-pink-400 font-bold">{m.baseHp}</span>'));
check('詳細ポップアップも同じ allyJoinPreview を通す',
  has('const joinPreview = pickMode===\'hero\' ? null : allyJoinPreview(currentPickingMon);')
    && has('joinPreview.stats.map(') && has('joinPreview.apt.map(range=>range.diff)'));
// ★タクティクスは「素の値 → 盤面に入る値」。見出しもそう書く(合流で増えるわけではない)
check('タクティクスの詳細は「素の値 → 盤面に入る値」と書く',
  has("joinPreview?.tactics ? '基本ステータス(素の値 → 盤面に入る値)' : '基本ステータス(現在 → 合流後)'"));
check('タクティクスの距離補正は0から始める(合算しない)',
  has('aptCurrentPct: joinPreview?.tactics ? [0,0,0,0] : [0,1,2,3].map(i=>distTotalBonus(i)),'));
// ★カードは増分(実際 +130)を出さない。パーティが増えるわけではないので嘘になる
check('タクティクスのカードは増分を出さない',
  has("{preview.tactics\n                        ?null\n                        :<span className={`block leading-none ${stat.diff>0?'text-emerald-400':'text-slate-700'}`}>"));
check('タクティクスのカードは素の値も並べる',
  has("?(stat.diff>0?<span className=\"block leading-none text-slate-500\">{stat.before} →</span>:null)"));
check('追いつき補正を出す', has('data-tactics-join-catchup='));
// ★「速く抜けたぶん」のような曖昧な言い方をやめ、**何ターン残したか**を出す
//   (2026-09-21 ユーザー指示「速く抜けた分とか言う表示ダサすぎる」)
check('追いつきは残したターン数で説明する',
  has('data-tactics-join-turns={preview.catchUpTurns}')
    && has('（${preview.catchUpTurns}ターン残して勝ったぶん）')
    && !has('（速く抜けたぶん）'));
// ★率(残りターン×1%)を積むときに、残りターンも一緒に積む。片方だけだと画面の説明が合わなくなる
check('WAVEを抜けるたび、残したターン数も積む',
  has('tacticsJoinCatchUpRef.current=addTacticsJoinCatchUp(tacticsJoinCatchUpRef.current,remainingTurns);')
    && has('tacticsJoinCatchUpTurnsRef.current+=Math.max(0,Number(remainingTurns)||0);'));
check('1周ごとに、率もターン数も数え直す',
  has('tacticsJoinCatchUpRef.current=1;') && has('tacticsJoinCatchUpTurnsRef.current=0;'));
check('NIGHTMAREの適性半減を詳細側にも反映できる(aptDeltaPct)',
  has('aptDeltaPct = null, growth = null } = opts;') && has('const pct=aptDeltaPct?(aptDeltaPct[idx]||0):aptGradeToPct(grade);'));
check('マスモンの合流値は種族値＋通常強化＋超越基礎UPを4能力へ各1回加算する',
  ['hp', 'atk', 'def', 'guts'].every(key =>
    has(`${key}: (base.plusStats?.${key} || 0) + (sp.${key} || 0) + tsp.${key}`))
  && has('const tsp = normalizeTranscendStatPoints(masu?.transcendStatPoints);'));

check('ULTIMATE補正率は共通倍率を小数精度で表示し、カードは本来値と実際値を比較する',
  has('data-ultimate-join-status={joinRule}') && has('const multiplier=ultimateAllyJoinMultiplier(totalTurns,joinRule);')
    && has('加入ボーナス {precisePercent(multiplier)}（-{precisePercent(1-multiplier)}）')
    && has('stat.normalDiff!==stat.diff') && has('実際 +${stat.diff}'));
// 加入B低下はULTIMATE専用ではなく、その率を持つ難易度(INFINITYを含む)で共通に出す
check('加入B低下の表示は難易度名ではなくルールの有無で出す',
  has("if(extremeRuleNumber(joinRule,'allyJoinPenaltyRate')==null)return null;")
    && has("const floorValue=extremeRuleNumber(joinRule,'minimumAllyJoinBonus');")
    && has('／最低${specialRulePercent(floorValue)}'));
const aptitudeCards = slice('{preview.apt.map(range=>(', "<div className=\"min-h-[32px]");
check('間合い適性の比較表示はNIGHTMAREだけに限定する',
  aptitudeCards.includes("===NIGHTMARE_SETTING.id&&range.normalDiff!==range.diff") && !aptitudeCards.includes('ULTIMATE_SETTING.id'));
check('NIGHTMAREは間合い適性だけ通常値と実値を比較する',
  has('data-nightmare-join-status') && aptitudeCards.includes('通常 {formatAptPct(range.normalDiff)} →') && aptitudeCards.includes("'実際 ':''"));
check('CHAOSは4ステータスの加入ボーナスだけ通常値と実値を比較する',
  has('data-chaos-join-status') && has("[ULTIMATE_SETTING.id,CHAOS_SETTING.id,INFINITY_SETTING.id].includes") && !aptitudeCards.includes('CHAOS_SETTING.id'));

// ---- ④ スクロールで全部たどれること ----
const listArea = slice('flex-1 overflow-y-auto mh-scroll w-full max-w-md mx-auto pb-4 min-h-0', 'バトルチュートリアル中は');
check('候補一覧のスクロール領域で justify-center を使っていない',
  listArea.length > 0 && !listArea.includes('justify-center'), listArea.slice(0, 100));
check('内側の入れ物を m-auto で寄せている(あふれても先頭からたどれる)',
  has("<div className={`w-full${pickMode==='ally'?' m-auto':''}`}>"));

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
${slice('const TACTICS_START_GUTS_RATE', '// ダメージ。0になったらその子は倒れる')}
${slice('const applyTacticsJoinCatchUp', '\n};')}\n};
module.exports={specialRuleDifficultyForRun,ultimateAllyJoinMultiplier,applyAllyJoinBonus,getMonsterAptPct,formatAptPct,RANGE_LABELS,createTacticsUnit,applyTacticsJoinCatchUp};`;
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
    // ★タクティクスの分岐が見るもの。既存モードの計算を確かめるときは false で通す
    isTacticsMode: () => false,
    createTacticsUnit: C.createTacticsUnit,
    applyTacticsJoinCatchUp: C.applyTacticsJoinCatchUp,
    tacticsJoinCatchUpRef: { current: 1 },
    tacticsJoinCatchUpTurnsRef: { current: 0 },
    wave: 1,
  });

  // ★タクティクスは「その子の素のステータスがそのまま盤面へ入る」ので、
  //   合流ボーナス(plusStats)の増分ではなく **素の値 → 盤面に入る値** を出す
  //   (2026-09-21 ユーザー指示)。追いつき補正の率は tacticsJoinCatchUpRef が持つ
  const buildTactics = (catchUp = 1, catchUpTurns = 0) => makePreview({
    specialRuleDifficultyForRun: C.specialRuleDifficultyForRun,
    applyAllyJoinBonus: C.applyAllyJoinBonus,
    getMonsterAptPct: C.getMonsterAptPct,
    RANGE_LABELS: C.RANGE_LABELS,
    runMode: 'tactics', difficulty: 'Normal',
    extremeRunRef: { current: false }, extremeDifficulty: null,
    waveResult: { totalTurnCount: 0 },
    maxHp: 500, atk: 100, def: 100, maxGuts: 100,
    distTotalBonus: () => 0,
    isTacticsMode: () => true,
    createTacticsUnit: C.createTacticsUnit,
    applyTacticsJoinCatchUp: C.applyTacticsJoinCatchUp,
    tacticsJoinCatchUpRef: { current: catchUp },
    tacticsJoinCatchUpTurnsRef: { current: catchUpTurns },
    wave: 1,
  });

  // 種族値＋通常強化＋超越基礎UPを合成済みの供モン。
  // 例: HP 100 + 300 + 50 = 450。超越適性は distAptitude 側ですでに解決済みなので別加算しない。
  const mon = { plusStats: { hp: 450, atk: 60, def: 50, guts: 40 }, distAptitude: ['M', 'C', 'C', 'G'] };

  const normal = build({})(mon);
  check('通常: ライフに種族100＋通常強化300＋基礎UP50が乗る', normal.stats[0].after === 950, String(normal.stats[0].after));
  check('通常: ちからに通常強化と基礎UPを含む合計60が乗る', normal.stats[1].after === 160, String(normal.stats[1].after));
  check('通常: 零の距離補正 ±0 → +25%', Math.abs(normal.apt[0].diff - 0.25) < 1e-9, C.formatAptPct(normal.apt[0].diff));
  check('通常: 遠の距離補正 ±0 → -20%', Math.abs(normal.apt[3].diff + 0.20) < 1e-9, C.formatAptPct(normal.apt[3].diff));
  check('通常: 変化のない距離は ±0', normal.apt[1].diff === 0);

  // ULTIMATE: 累計ターン×0.75%ぶん加算が下がる。40ターンなら30%減
  const ult = build({ extremeRun: true, extremeDifficulty: 'ULTIMATE', totalTurns: 40 })(mon);
  check('ULTIMATE(累計40T): 基礎UP込みのライフ加算 450 → 315', ult.stats[0].diff === 315, String(ult.stats[0].diff));
  check('ULTIMATE(累計40T): 基礎UP込みのちから加算 60 → 42', ult.stats[1].diff === 42, String(ult.stats[1].diff));
  check('ULTIMATE(累計0T)は通常と同じ', build({ extremeRun: true, extremeDifficulty: 'ULTIMATE', totalTurns: 0 })(mon).stats[0].diff === 450);

  // NIGHTMARE: プラス補正×0.5 / マイナス補正×2.0
  const nm = build({ extremeRun: true, extremeDifficulty: 'NIGHTMARE' })(mon);
  check('NIGHTMARE: 零の距離補正 +25% → +12.5%', Math.abs(nm.apt[0].diff - 0.125) < 1e-9, C.formatAptPct(nm.apt[0].diff));
  check('NIGHTMARE: 遠の距離補正 -20% → -40%', Math.abs(nm.apt[3].diff + 0.40) < 1e-9, C.formatAptPct(nm.apt[3].diff));

  // 合流ボーナスを持たない子でも落ちない
  const plain = build({})({ plusStats: null, distAptitude: null });
  check('合流ボーナスの無い候補でも落ちず ±0 になる',
    plain.stats.every(stat => stat.diff === 0) && plain.apt.every(range => range.diff === 0) && plain.changed === false);

  // ---- タクティクスは「素の値がそのまま盤面へ入る」(2026-09-21 ユーザー指示) ----
  // 「タクティクスは個別のステータスだからそもそも増えるって言うのがおかしい」。
  // ★合流ボーナス(plusStats)を持っている候補でも、そちらは見ない
  const tacticsMon = { baseHp: 600, baseAtk: 120, baseDef: 100, baseGuts: 80,
    plusStats: { hp: 450, atk: 60, def: 50, guts: 40 }, distAptitude: ['M', 'C', 'C', 'G'] };
  const flat = buildTactics(1)(tacticsMon);
  check('タクティクス: 素の値がそのまま盤面へ入る',
    flat.stats[0].before === 600 && flat.stats[0].after === 600, `${flat.stats[0].before} → ${flat.stats[0].after}`);
  check('タクティクス: 合流ボーナス(plusStats)は足さない',
    flat.stats[0].after !== 1050 && flat.stats[1].after === 120, `ちから ${flat.stats[1].after}`);
  check('タクティクス: 追いつきが無ければ素の値のまま', flat.stats.every(stat => stat.diff === 0) && flat.catchUp === 1);
  // ★追いつき補正はWAVEを速く抜けるほど厚くなる。盤面へ入れるときと同じ関数を通す
  const caught = buildTactics(1.2)(tacticsMon);
  check('タクティクス: 追いつき補正が乗る',
    caught.stats[0].before === 600 && caught.stats[0].after === 720, `${caught.stats[0].before} → ${caught.stats[0].after}`);
  check('タクティクス: 追いつきの率を画面へ渡す', caught.catchUp === 1.2, `${caught.catchUp}`);
  // ★率は「残りターン×1%」で決まるので、**何ターン残して抜けたか**も画面へ渡す
  //   (2026-09-21 ユーザー指示「ターン数でボーナス値決まってるんだからそれでわかるようにして」)
  const withTurns = buildTactics(1.87, 57)(tacticsMon);
  check('タクティクス: 残して抜けたターン数も画面へ渡す', withTurns.catchUpTurns === 57, `${withTurns.catchUpTurns}`);
  check('タクティクス: 抜けていなければ0', flat.catchUpTurns === 0, `${flat.catchUpTurns}`);
  check('タクティクス: タクティクスの印を持つ', caught.tactics === true && plain.tactics !== true);
  // ★距離適性も合算しない(その子の適性が、その子の攻撃に効く)
  check('タクティクス: 距離補正は0から始まる(合算しない)', caught.apt.every(range => range.before === 0));
  check('タクティクス: 距離補正はその子のぶんだけ',
    Math.abs(caught.apt[0].diff - 0.25) < 1e-9 && Math.abs(caught.apt[3].diff + 0.20) < 1e-9,
    `${C.formatAptPct(caught.apt[0].diff)} / ${C.formatAptPct(caught.apt[3].diff)}`);
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
