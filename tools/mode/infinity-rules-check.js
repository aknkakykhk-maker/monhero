const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 極限チャレンジ INFINITY を確認する。
//
//   node tools/mode/infinity-rules-check.js
//
// 見ているもの:
//   ① 基本設定(敵×50 / スコア×20 / 経験値×45 / ダイヤ×30 / 虹80 / ULTIMATEクリアで解放)
//   ② 特殊ルールを**本体の関数をそのまま取り出して動かし**、依頼された数値表で確かめる
//   ③ CHAOS由来の与ダメ50%・加入B50%と、NIGHTMARE由来のWAVE後強化50%を
//      INFINITYへ重複適用していないこと(役割が重なるルールを重ねない、が今回の要)
//   ④ 既存ULTIMATE(35T / -0.75pt / 下限25%)が変わっていないこと
//   ⑤ 記録キーとランキングキーが既存方式のまま分離されていること
//   ⑥ クイックINFINITYを作っていないこと
//
// 数式をこのファイルへ書き写すと、本体を変えたときにテストだけ古くなる。
// そのため計算は必ず本体から切り出した実装を動かして確かめる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const help = fs.readFileSync(path.join(root, 'monster-hero/data/help.js'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'monster-hero/data/changelog.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i);
  if (i < 0 || j <= i) {
    console.log(`NG: 本体から切り出せませんでした（${from}）`);
    process.exit(1);
  }
  return source.slice(i, j);
};

// ---- 本体の難易度表とルール実装をそのまま動かす ----
const sandbox = {
  DIFFICULTY_SETTINGS: {},
  RANGE_LABELS: ['零', '近', '中', '遠'],
  QUICK_GROWTH_MULT: 1.1,
  isQuickMode: () => false,
  isProMode: () => false,
  PRO_RANKING_PREFIX: 'Pro',
  EXTREME_MODE: { id: 'extreme' },
  console,
};
vm.createContext(sandbox);
vm.runInContext([
  // 種族チャレンジのモードidは rankingDifficultyForMode が最初に見るので、実物を入れる
  // (種族チャレンジのランキングキーそのものは species-challenge 系checkが見る)
  slice("const BATTLE_MODE_SPECIES_CHALLENGE = 'speciesChallenge';", '// 種族チャレンジを一般公開するかどうか'),
  slice('const EXTREME_DIFFICULTIES = Object.freeze([', '// ===== トレーニング'),
  slice('const TRAINING_PICK_COUNT', '// 極限チャレンジの説明には'),
  slice('const EXTREME_RANKING_PREFIX', '// ランキングの難易度キーから'),
  slice('const extremeBestScoreKey', 'const normalizeExtremeRecordValue'),
  slice('const isUltimateUnlocked', 'const normalizeBattleDifficulty'),
  slice('const normalizeBattleDifficulty', '// 難易度選択を開いたときの既定位置'),
].join('\n'), sandbox);
const G = (name) => vm.runInContext(name, sandbox);

const INFINITY = G('INFINITY_SETTING');
const ULTIMATE = G('ULTIMATE_SETTING');
const CHAOS = G('CHAOS_SETTING');
const NIGHTMARE = G('NIGHTMARE_SETTING');
const EXTREME = G('EXTREME_SETTING');
const enemyMul = G('ultimateEnemyTurnMultiplier');
const joinMul = G('ultimateAllyJoinMultiplier');
const damageMul = G('ultimateDamageTurnMultiplier');
const applyBreak = G('applyUltimateDistanceBreak');
const pendingBreak = G('pendingUltimateDistanceBreak');
const drawBreak = G('drawUltimateDistanceBreak');
const trainingStep = G('resolveTrainingStep');
const applyDistance = G('applyDistanceEnhancement');
const trainingRate = G('trainingGainRate');
const applyJoin = G('applyAllyJoinBonus');
const specialRule = G('extremeSpecialRule');
const ruleLines = G('extremeRuleDetailGroups');
const near = (a, b) => Math.abs(a - b) < 1e-9;
const percents = (fn, cases) => cases.every(([turns, expected]) => near(fn(turns), expected));

// ---- ① 基本設定 ----
check('INFINITYが正式に選べる', INFINITY.id === 'INFINITY' && INFINITY.available === true);
check('基本倍率が依頼どおり',
  INFINITY.power === 50 && INFINITY.score === 20 && INFINITY.xp === 45 && INFINITY.gold === 30 && INFINITY.psyche === 80,
  `敵×${INFINITY.power} / スコア×${INFINITY.score} / 経験値×${INFINITY.xp} / ダイヤ×${INFINITY.gold} / 虹${INFINITY.psyche}`);
check('10WAVE制のまま（WAVE数を難易度で変えていない）', !/waveCount|maxWave/.test(JSON.stringify(INFINITY)));
check('解放条件はULTIMATEクリア',
  INFINITY.unlockRequirement === 'ULTIMATE' && G('isInfinityUnlocked')(0) === false && G('isInfinityUnlocked')(1) === true);
check('カード説明を短くまとめている',
  typeof INFINITY.cardDescription === 'string' && INFINITY.cardDescription.length <= 60,
  `${INFINITY.cardDescription?.length}文字`);

// ---- ② 特殊ルールの数値 ----
check('アシストカード効果 50%', specialRule('INFINITY', 'assistCardEffect') === 0.5);
check('＋補正50% / －補正200%',
  specialRule('INFINITY', 'positiveModifier') === 0.5 && specialRule('INFINITY', 'negativeModifier') === 2.0);
check('消費ガッツ 150%', specialRule('INFINITY', 'gutsCost') === 1.5);
check('敵HP/攻撃は累計Tごと+0.75%',
  percents(t => enemyMul(t, 'INFINITY'), [[0, 1], [20, 1.15], [40, 1.30]]),
  `0T=${enemyMul(0, 'INFINITY')} / 20T=${enemyMul(20, 'INFINITY').toFixed(4)} / 40T=${enemyMul(40, 'INFINITY').toFixed(4)}`);
check('加入Bは累計Tごと-0.75pt・最低10%',
  percents(t => joinMul(t, 'INFINITY'), [[0, 1], [20, 0.85], [40, 0.70], [80, 0.40], [120, 0.10], [200, 0.10]]),
  `120T=${joinMul(120, 'INFINITY')} / 200T=${joinMul(200, 'INFINITY')}`);
check('与ダメは経過Tごと-1.0pt・最低30%',
  percents(t => damageMul(t, 'INFINITY'), [[0, 1], [10, 0.9], [25, 0.75], [50, 0.5], [70, 0.3], [100, 0.3]]),
  `70T=${damageMul(70, 'INFINITY')} / 100T=${damageMul(100, 'INFINITY')}`);
check('トレーニングは1Tごと-5%・20Tで0%（ULTIMATEと同じ計算を共有する）', (() => {
  const probe = { atk: 10000, def: 10000, hp: 10000, guts: 10000 };
  return [0, 5, 10, 20, 30].every(t => trainingStep(probe, 'hp', t, 'INFINITY').hp === trainingStep(probe, 'hp', t, 'ULTIMATE').hp)
    && [[0, 1], [1, 0.95], [10, 0.5], [19, 0.05], [20, 0], [30, 0]].every(([turns, want]) => near(trainingRate(turns, 'INFINITY'), want));
})(), `10T=${trainingRate(10, 'INFINITY')} / 20T=${trainingRate(20, 'INFINITY')}`);
// 低下は増える量へ掛ける。率から引くと、ちから+5%・ガッツ+5%だけが数ターンで増加0になる
check('低下は増える量へ掛かる（率から引いていない）', (() => {
  const probe = { atk: 10000, def: 10000, hp: 10000, guts: 10000 };
  const gain = (id, stat, difficulty) => trainingStep(probe, id, 10, difficulty)[stat] - probe[stat];
  return [['hp', 'hp'], ['atk', 'atk'], ['def', 'def'], ['guts', 'guts']]
    .every(([id, stat]) => gain(id, stat, 'INFINITY') === Math.floor(gain(id, stat, null) * 0.5));
})());
check('ちから+5%・ガッツ+5%が10ターンでも増える（率から引いていたころは7Tで0）', (() => {
  const probe = { atk: 10000, def: 10000, hp: 10000, guts: 10000 };
  return trainingStep(probe, 'atk', 10, 'INFINITY').atk > probe.atk
    && trainingStep(probe, 'guts', 10, 'INFINITY').guts > probe.guts;
})());
check('20ターンかかると4項目とも増えない', (() => {
  const probe = { atk: 10000, def: 10000, hp: 10000, guts: 10000 };
  return ['hp', 'atk', 'def', 'guts'].every(id => trainingStep(probe, id, 20, 'INFINITY')[id] === probe[id]);
})());
check('距離強化は50%',
  applyDistance(100, 'INFINITY') === 50 && applyDistance(100, 'ULTIMATE') === 100,
  `INFINITY=${applyDistance(100, 'INFINITY')} / ULTIMATE=${applyDistance(100, 'ULTIMATE')}`);
check('DISTANCE BREAKは25Tごと', (() => {
  const b = [0, 0, 0, 0];
  return pendingBreak(24, b, 1, 'INFINITY') === null && pendingBreak(25, b, 1, 'INFINITY') === 25
    && pendingBreak(50, [1, 0, 0, 0], 1, 'INFINITY') === 50
    && pendingBreak(75, [1, 1, 0, 0], 1, 'INFINITY') === 75
    && pendingBreak(100, [1, 1, 1, 0], 1, 'INFINITY') === 100
    && pendingBreak(100, [1, 1, 1, 0], 10, 'INFINITY') === null;
})());
check('BREAK倍率は Lv1 50% / Lv2 25% / Lv3 12.5%',
  applyBreak(1000, 0, [1, 0, 0, 0], 'INFINITY', 'atk') === 500
  && applyBreak(1000, 0, [2, 0, 0, 0], 'INFINITY', 'atk') === 250
  && applyBreak(1000, 0, [3, 0, 0, 0], 'INFINITY', 'atk') === 125);
check('4距離のうち1距離は安全距離として残る', (() => {
  const levels = [0, 0, 0, 0];
  for (let event = 0; event < 9; event++) {
    const picked = drawBreak(levels, () => (event % 4) / 4);
    if (picked == null) return false;
    levels[picked] += 1;
  }
  return levels.filter(level => level === 0).length === 1 && levels.filter(Boolean).length === 3;
})());
check('与ダメ低下→BREAKの順で掛かる（25Tで75%→BREAK Lv1で37.5%相当）', (() => {
  const turnPressed = Math.floor(1000 * damageMul(25, 'INFINITY'));
  return turnPressed === 750 && applyBreak(turnPressed, 0, [1, 0, 0, 0], 'INFINITY', 'atk') === 375;
})());

// ---- ③ 役割が重なるルールを重ねていないこと ----
check('CHAOSの与ダメ50%をINFINITYへ入れていない', INFINITY.specialRules.damageDealt === undefined);
check('CHAOSの加入B50%をINFINITYへ入れていない',
  INFINITY.specialRules.allyJoinBonus === undefined
  && applyJoin(100, 'INFINITY', 0) === 100 && applyJoin(100, 'CHAOS', 0) === 50);
check('NIGHTMAREのWAVE後強化50%をINFINITYの通常トレーニングへ重ねていない', (() => {
  const probe = { atk: 10000, def: 10000, hp: 10000, guts: 10000 };
  const plain = trainingStep(probe, 'hp', 0, null).hp;
  return INFINITY.specialRules.waveEnhancement === undefined
    && trainingStep(probe, 'hp', 0, 'INFINITY').hp === plain
    && trainingStep(probe, 'hp', 0, 'NIGHTMARE').hp < plain;
})());
check('距離強化の50%はトレーニングへ掛からない', (() => {
  const probe = { atk: 10000, def: 10000, hp: 10000, guts: 10000 };
  return trainingStep(probe, 'hp', 8, 'INFINITY').hp === trainingStep(probe, 'hp', 8, 'ULTIMATE').hp;
})());

// ---- ④ 既存4難易度の回帰 ----
check('EXTREMEはアシストカード効果50%のまま',
  JSON.stringify(EXTREME.specialRules) === JSON.stringify({ assistCardEffect: 0.5 }));
check('NIGHTMAREは 強化50% / ＋50% / －200% のまま',
  JSON.stringify(NIGHTMARE.specialRules) === JSON.stringify({ waveEnhancement: 0.5, positiveModifier: 0.5, negativeModifier: 2.0 }));
check('CHAOSは 与ダメ50% / 加入B50% / ガッツ150% のまま',
  JSON.stringify(CHAOS.specialRules) === JSON.stringify({ damageDealt: 0.5, allyJoinBonus: 0.5, gutsCost: 1.5 }));
check('ULTIMATEのトレーニング低下も増える量へ掛かる', (() => {
  const probe = { atk: 10000, def: 10000, hp: 10000, guts: 10000 };
  const gain = (difficulty) => trainingStep(probe, 'atk', 10, difficulty).atk - probe.atk;
  return gain('ULTIMATE') === Math.floor(gain(null) * 0.5) && gain('ULTIMATE') > 0;
})());
check('ULTIMATEの率と下限とBREAK間隔が変わっていない',
  ULTIMATE.specialRules.enemyTurnRate === 0.0075 && ULTIMATE.specialRules.allyJoinPenaltyRate === 0.0075
  && ULTIMATE.specialRules.damageTurnRate === 0.0075 && ULTIMATE.specialRules.minimumDamageDealt === 0.25
  && ULTIMATE.specialRules.awakeningPenaltyRate === 0.0075 && ULTIMATE.specialRules.distanceBreak.interval === 35);
check('ULTIMATEへ加入Bの下限10%を勝手に足していない',
  ULTIMATE.specialRules.minimumAllyJoinBonus === undefined
  && joinMul(200, 'ULTIMATE') === 0 && near(joinMul(40, 'ULTIMATE'), 0.7));
check('ULTIMATEの与ダメは-0.75pt・下限25%のまま',
  percents(t => damageMul(t, 'ULTIMATE'), [[0, 1], [100, 0.25], [999, 0.25]]));
check('ULTIMATEのBREAKは35Tごとのまま',
  pendingBreak(34, [0, 0, 0, 0], 1, 'ULTIMATE') === null && pendingBreak(35, [0, 0, 0, 0], 1, 'ULTIMATE') === 35);
check('特殊ルールを持たない難易度では倍率が1のまま',
  enemyMul(50, null) === 1 && damageMul(50, null) === 1 && joinMul(50, 'CHAOS') === 1
  && applyBreak(1000, 0, [3, 0, 0, 0], 'NIGHTMARE', 'atk') === 1000);

// ---- ⑤ 記録・ランキング ----
check('ローカル記録は既存の動的キー方式のまま',
  G('extremeBestScoreKey')('INFINITY') === 'mh_extreme_hs_INFINITY'
  && G('extremeClearCountKey')('INFINITY') === 'mh_extreme_clears_INFINITY');
check('旧セーブに無くても0として読む（移行処理を足していない）',
  source.includes('normalizeExtremeRecordValue(await storeGet(extremeBestScoreKey(setting.id), 0, false))')
  && !/mh_extreme_(hs|clears)_INFINITY[^\n]*migrat/i.test(source));
check('ランキングはExtremeINFINITYへ分離される',
  G('rankingDifficultyForMode')('extreme', 'INFINITY') === 'ExtremeINFINITY'
  && G('RANKING_DIFFICULTY_KEYS').includes('ExtremeINFINITY'));
check('既存の極限ランキングと混ざらない',
  ['EXTREME', 'NIGHTMARE', 'CHAOS', 'ULTIMATE'].every(id => G('rankingDifficultyForMode')('extreme', id) === `Extreme${id}`)
  && new Set(G('RANKING_DIFFICULTY_KEYS')).size === G('RANKING_DIFFICULTY_KEYS').length);
check('通常チャレンジ・プロのキーへ混ざらない',
  G('rankingDifficultyForMode')('challenge', 'Normal') === 'Normal'
  && !G('RANKING_DIFFICULTY_KEYS').includes('INFINITY'));

// ---- ⑥ クイックINFINITYを作っていない ----
check('クイックへINFINITYを足していない',
  G('QUICK_EXTREME_SETTINGS').INFINITY === undefined
  && !/QUICK_EXTREME_SETTINGS[\s\S]{0,400}INFINITY/.test(source));

// ---- ルール詳細UI ----
check('ルール詳細の本文はspecialRulesから作る（数値を書き写していない）', (() => {
  const groups = ruleLines('INFINITY');
  const flat = groups.flatMap(group => group.lines.map(([label, value]) => `${label} ${value}`)).join(' / ');
  return groups.length >= 4 && flat.includes('50%') && flat.includes('150%') && flat.includes('0.75%')
    && flat.includes('1.0pt') && flat.includes('30%で停止') && flat.includes('最低10%') && flat.includes('25Tごと')
    && flat.includes('強化量が WAVE Tごと-5%（20Tで0%）');
})());
check('難易度ごとに違う内容が出る', (() => {
  const key = (id) => JSON.stringify(ruleLines(id));
  const all = ['EXTREME', 'NIGHTMARE', 'CHAOS', 'ULTIMATE', 'INFINITY'].map(key);
  return new Set(all).size === all.length && all.every(text => text !== '[]');
})());
check('カードは特殊ルールの全文を並べない',
  source.includes('extremeRuleSummaryText(setting.id)')
  && !source.includes('extremeSpecialRuleLines(setting.id).map')
  && G('extremeRuleSummaryText')('INFINITY') === '複合特殊ルールあり'
  && G('extremeRuleSummaryText')('EXTREME') === '特殊ルールあり');
check('全難易度にルール詳細ボタンがある（難易度ごとに出し分けていない）',
  source.includes('data-extreme-rule-detail-open={setting.id}')
  && source.includes('onClick={()=>setExtremeRuleDetail(setting.id)}'));
check('ルール詳細はSafe Area・縦スクロール・44pxの閉じるを備える', (() => {
  const at = source.indexOf('data-extreme-rule-detail={setting.id}');
  const modal = at < 0 ? '' : source.slice(at - 700, at + 3200);
  return modal.includes('env(safe-area-inset-bottom)') && modal.includes('env(safe-area-inset-top)')
    && modal.includes('data-extreme-rule-detail-body') && modal.includes('overflow-y-auto')
    && modal.includes('min-h-[44px] min-w-[44px]') && modal.includes('aria-label="閉じる"');
})());
check('ルール詳細を開いても難易度の選択を変えない', (() => {
  const at = source.indexOf("{gameState==='EXTREME_DIFFICULTY_SELECT'&&extremeRuleDetail&&");
  const modal = at < 0 ? '' : source.slice(at, at + 3600);
  return !!modal && !modal.includes('setExtremeDifficulty') && !modal.includes('setGameState')
    && !modal.includes('extremeRunRef.current=true');
})());
check('バトル開始の案内もルール詳細と同じ本文から作る',
  source.includes('const groups=extremeRuleDetailGroups(specialDifficulty,isQuickMode(runMode));')
  && source.includes('data-extreme-rule-intro={specialDifficulty}'));
check('バトル中は動的な倍率だけをコンパクトに出す', (() => {
  const at = source.indexOf('data-ultimate-battle-status={statusRule}');
  const bar = at < 0 ? '' : source.slice(at - 900, at + 800);
  return bar.includes("extremeRuleNumber(statusRule,'enemyTurnRate')") && bar.includes('敵強化') && bar.includes('与ダメ') && bar.includes('加入B');
})());

// ---- ヘルプ・更新履歴 ----
check('ヘルプにINFINITYの解放条件と主要ルールが書いてある',
  ['ULTIMATEをクリア', '最低10%', '最低30%', '25ターンごと', '距離強化', 'クイックモードにINFINITYとGODはありません']
    .every(text => help.includes(text)));
check('ヘルプの難易度表は実データから作る（手で書き写していない）',
  help.includes("{ t:'data', id:'extremeDifficulties' }") && !help.includes('敵×50 ／ スコア×20'));
check('更新履歴にINFINITY追加とルール詳細が載っている',
  changelog.includes('INFINITY') && changelog.includes('ルール詳細'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
