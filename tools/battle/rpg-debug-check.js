#!/usr/bin/env node
// ダンジョンRPG戦闘テスト(デバッグ専用試作)の回帰チェック。
//
// この試作は「通常ゲームへ一切影響しない」ことが最優先の約束なので、
// 実装を動かして数値を確かめるだけでなく、分離が崩れていないかも機械的に見る。
//
//   ① RPGの純粋計算(1/10変換・6ステータスのステ振り・敵の自動配分・ダメージ式・ガッツ・
//      行動値・回避率・クリティカル率)を本体からそのまま取り出して実際に動かす
//   ② 戦闘の進行(コマンド入力 → 行動順 → 実行 → 次ターン)を実際に流して確かめる
//   ③ 通常ゲームからの分離。入口がデバッグ設定だけにあること、マスモンを使わないこと、
//      報酬・ランキング・保存(mh_*)へ触れないこと、既存デバッグ戦と干渉しないこと
//   ④ 通常バトルの計算式・ステータスを変更していないこと
//
// ★乱数が絡むものは、本体側が受け取る rng を差し込んで必ず同じ結果になるようにしている。
//   「たまたま当たった／外れた」で通ってしまう検査を作らないこと。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS_DIR = path.join(__dirname, '..');
const REPO_ROOT = path.join(TOOLS_DIR, '..');
const WEB_ROOT = path.join(REPO_ROOT, 'monster-hero');
const source = fs.readFileSync(path.join(WEB_ROOT, 'src/game-system.jsx'), 'utf8');
const helpSource = fs.readFileSync(path.join(WEB_ROOT, 'data/help.js'), 'utf8');
const changelogSource = fs.readFileSync(path.join(WEB_ROOT, 'data/changelog.js'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const grab = (text, startMark, endMark) => {
  const from = text.indexOf(startMark);
  if (from < 0) throw new Error(`見つからない: ${startMark}`);
  const to = text.indexOf(endMark, from);
  if (to < 0) throw new Error(`見つからない: ${endMark}`);
  return text.slice(from, to);
};
// 決まった値を順に返す乱数。0を返せば「必ず起きる」、0.999なら「必ず起きない」
const scriptRng = (values) => { let i = 0; return () => values[Math.min(i++, values.length - 1)]; };
const constRng = (value) => () => value;

// ---------- 本体からRPGの計算・進行だけを取り出して動かす ----------
const rpgSource = grab(source, 'const RPG_MAX_LEVEL = 50;', '// Storage helpers');
const EXPORTS = [
  'RPG_MAX_LEVEL', 'RPG_MAX_PARTY', 'RPG_MAX_ENEMIES', 'RPG_STAT_DIVISOR', 'RPG_POINTS_PER_LEVEL',
  'RPG_GAIN_PER_POINT', 'RPG_STAT_KEYS', 'RPG_STAT_LABELS', 'RPG_ENEMY_TYPES',
  'RPG_NORMAL_ATTACK_MULT', 'RPG_DEF_COEFF', 'RPG_GUARD_MULT',
  'RPG_START_GUTS_RATE', 'RPG_TURN_GUTS_RATE', 'RPG_ENEMY_SKILL_CHANCE',
  'RPG_BASE_SPEED', 'RPG_BASE_LUCK', 'RPG_ACTION_VARIANCE',
  'RPG_EVADE_BASE', 'RPG_EVADE_PER_SPEED', 'RPG_EVADE_MIN', 'RPG_EVADE_MAX',
  'RPG_CRIT_BASE', 'RPG_CRIT_PER_LUCK', 'RPG_CRIT_MIN', 'RPG_CRIT_MAX', 'RPG_CRIT_MULT',
  'rpgScaleStat', 'rpgBaseStatsOf', 'rpgPointsForLevel', 'rpgNormalizeAlloc', 'rpgApplyAlloc',
  'rpgAllocTotal', 'rpgEnemyAlloc', 'rpgEnemyStats', 'rpgSkillOf', 'rpgSkillCost',
  'rpgDamage', 'rpgVarianceRoll', 'rpgActionValue', 'rpgEvadeRate', 'rpgCritRate', 'rpgRollPercent',
  'rpgStartGuts', 'rpgTurnGutsRegen', 'rpgMonsterList', 'rpgMonsterById',
  'rpgCreateBattle', 'rpgSetCommand', 'rpgResolveStep', 'rpgAliveIndexes', 'rpgSpeedOrder', 'rpgUnitAt',
  'rpgLowestHpEnemy', 'rpgStepDelay', 'rpgSteppedOnce', 'rpgBeginInput', 'RPG_FINISH_MS',
  'rpgUndoCommand', 'rpgCanUndo', 'RPG_COMMAND_LABELS', 'RPG_STEP_MS', 'RPG_SPECIAL_STEP_MS', 'RPG_SPECIAL_MS',
];
// index.html と同じ順でデータを流し込む(ALL_PLAYER_MONSTERS を本物のまま使う)
const sandbox = { console, Math, JSON, Number, Object, Array, String, Boolean, isNaN, isFinite };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext([
  fs.readFileSync(path.join(WEB_ROOT, 'data/images/images-ally.js'), 'utf8'),
  fs.readFileSync(path.join(WEB_ROOT, 'data/ally-monsters.js'), 'utf8'),
  rpgSource,
  `;globalThis.__rpg = { ${EXPORTS.join(', ')}, ALL_PLAYER_MONSTERS };`,
].join('\n'), sandbox, { filename: 'rpg.js' });
const R = sandbox.__rpg;
const STATS = R.RPG_STAT_KEYS;

// ================= ① 純粋計算 =================
check('RPGのLv上限は50', R.RPG_MAX_LEVEL === 50);
check('味方は最大4体・敵は最大4体', R.RPG_MAX_PARTY === 4 && R.RPG_MAX_ENEMIES === 4);
check('基礎能力は現在値の約1/10', R.RPG_STAT_DIVISOR === 10 && R.rpgScaleStat(600) === 60 && R.rpgScaleStat(120) === 12 && R.rpgScaleStat(70) === 7);
check('1/10しても最低1は残る', R.rpgScaleStat(1) === 1 && R.rpgScaleStat(0) === 1 && R.rpgScaleStat(4) === 1);

// --- 6ステータス ---
check('味方・敵とも6ステータス（ライフ・ちから・丈夫さ・ガッツ・素早さ・運）',
  STATS.join(',') === 'hp,atk,def,guts,speed,luck', STATS.map(k => R.RPG_STAT_LABELS[k]).join(' / '));
check('6ステータスすべてに表示名がある', STATS.every(k => typeof R.RPG_STAT_LABELS[k] === 'string' && R.RPG_STAT_LABELS[k]));
check('1P＝ライフ+6 / ちから+2 / 丈夫さ+2 / ガッツ+2 / 素早さ+2 / 運+2',
  R.RPG_GAIN_PER_POINT.hp === 6 && ['atk', 'def', 'guts', 'speed', 'luck'].every(k => R.RPG_GAIN_PER_POINT[k] === 2),
  STATS.map(k => `${R.RPG_STAT_LABELS[k]}+${R.RPG_GAIN_PER_POINT[k]}`).join(' / '));
check('素早さ・運のLv1基礎値は全モンスター共通で10',
  R.RPG_BASE_SPEED === 10 && R.RPG_BASE_LUCK === 10
  && R.rpgMonsterList().every(m => { const s = R.rpgBaseStatsOf(m); return s.speed === 10 && s.luck === 10; }));
// 本編のモンスター定義へ baseSpeed / baseLuck を足すと通常ゲーム側へ影響が出る。
// 定義にも、それを読む処理にも入っていないことを見る(コメントでの言及は対象外)
check('本編のモンスターデータへ baseSpeed / baseLuck を足していない',
  !/\bbaseSpeed\s*:|\bbaseLuck\s*:|\.baseSpeed\b|\.baseLuck\b/.test(source)
  && !/baseSpeed|baseLuck/.test(fs.readFileSync(path.join(WEB_ROOT, 'data/ally-monsters.js'), 'utf8')));

// --- ポイントと配分 ---
check('Lvごとの総ポイント数は変わっていない（Lv1=0P / Lv11=10P / Lv50=49P）',
  R.RPG_POINTS_PER_LEVEL === 1 && R.rpgPointsForLevel(1) === 0 && R.rpgPointsForLevel(2) === 1
  && R.rpgPointsForLevel(11) === 10 && R.rpgPointsForLevel(50) === 49);
check('Lvの指定は1〜50へ丸める',
  R.rpgPointsForLevel(0) === 0 && R.rpgPointsForLevel(999) === 49 && R.rpgPointsForLevel('こわれた値') === 0);

const list = R.rpgMonsterList();
check('正式なベースモン定義から候補を作っている', list.length === Object.keys(R.ALL_PLAYER_MONSTERS).length && list.length >= 12, `${list.length}種`);
check('デバッグ専用モンスターは候補に入らない', list.every(m => !m.debugOnly));
check('既存4ステータスは ALL_PLAYER_MONSTERS の現在値から毎回計算する',
  list.every(mon => {
    const s = R.rpgBaseStatsOf(mon);
    return s.hp === R.rpgScaleStat(mon.baseHp) && s.atk === R.rpgScaleStat(mon.baseAtk)
      && s.def === R.rpgScaleStat(mon.baseDef) && s.guts === R.rpgScaleStat(mon.baseGuts);
  }));

const golem = R.rpgMonsterById('Golem');
const golemBase = R.rpgBaseStatsOf(golem);
const allIn = (key) => R.rpgApplyAlloc(golemBase, R.rpgNormalizeAlloc({ [key]: 10 }, 11))[key];
check('Lv11で10P全振りの伸びが6ステータスとも仕様どおり',
  allIn('hp') === golemBase.hp + 60
  && ['atk', 'def', 'guts', 'speed', 'luck'].every(k => allIn(k) === golemBase[k] + 20),
  `ゴーレム ライフ${golemBase.hp}→${allIn('hp')} / 素早さ${golemBase.speed}→${allIn('speed')} / 運${golemBase.luck}→${allIn('luck')}`);

const overAsk = STATS.reduce((o, k) => { o[k] = 99; return o; }, {});
const over = R.rpgNormalizeAlloc(overAsk, 11);
check('ステ振りは使用可能ポイントを超えない（6ステータスすべて要求しても合計10P）',
  R.rpgAllocTotal(over) === 10, JSON.stringify(over));
const before = R.rpgNormalizeAlloc({ hp: 10, atk: 10, def: 10, guts: 10, speed: 5, luck: 4 }, 50);
check('Lv50で49Pまで振れる', R.rpgAllocTotal(before) === 49, JSON.stringify(before));
const after = R.rpgNormalizeAlloc(before, 6);
check('Lvを下げると使用可能ポイントまで切り詰められる',
  R.rpgAllocTotal(after) === 5 && STATS.every(k => after[k] <= before[k]), JSON.stringify(after));

// --- 敵の自動配分 ---
const enemyTwice = [R.rpgEnemyStats(golem, 'red', 20), R.rpgEnemyStats(golem, 'red', 20)];
check('敵の能力生成に乱数を使っていない', JSON.stringify(enemyTwice[0]) === JSON.stringify(enemyTwice[1]), JSON.stringify(enemyTwice[0]));
check('敵も6ステータスを持つ', STATS.every(k => Number.isFinite(enemyTwice[0][k])), Object.keys(enemyTwice[0]).join(','));
check('敵の色タイプは通常・赤・青の3種類',
  R.RPG_ENEMY_TYPES.map(t => t.id).join(',') === 'normal,red,blue', R.RPG_ENEMY_TYPES.map(t => t.label).join(' / '));
check('敵の自動配分も使用可能ポイントを超えない',
  [1, 7, 20, 33, 50].every(lv => R.RPG_ENEMY_TYPES.every(t => R.rpgAllocTotal(R.rpgEnemyAlloc(t.id, lv)) === R.rpgPointsForLevel(lv))));
check('敵の自動配分は6ステータスすべてを対象にする',
  R.RPG_ENEMY_TYPES.every(t => STATS.every(k => t.cycle.includes(k))),
  R.RPG_ENEMY_TYPES.map(t => `${t.short}:${t.cycle.join('>')}`).join(' / '));
check('通常種には能力補正がない', STATS.every(k => R.RPG_ENEMY_TYPES[0].mult[k] === 1));
const red = R.RPG_ENEMY_TYPES[1], blue = R.RPG_ENEMY_TYPES[2];
check('赤はちから寄りで少し打たれ弱い', red.mult.atk === 1.15 && red.mult.hp === 0.95 && red.mult.def === 0.90 && red.mult.guts === 1);
check('青はライフ・丈夫さ寄りでちから控えめ', blue.mult.hp === 1.15 && blue.mult.def === 1.15 && blue.mult.atk === 0.90 && blue.mult.guts === 1);
check('素早さ・運の色補正は今回すべて1.0', R.RPG_ENEMY_TYPES.every(t => t.mult.speed === 1 && t.mult.luck === 1));
const redStats = R.rpgEnemyStats(golem, 'red', 30), blueStats = R.rpgEnemyStats(golem, 'blue', 30);
check('同じLvでも赤はちからが高く、青は丈夫さが高い',
  redStats.atk > blueStats.atk && blueStats.def > redStats.def,
  `Lv30ゴーレム 赤:ちから${redStats.atk}/丈夫さ${redStats.def} 青:ちから${blueStats.atk}/丈夫さ${blueStats.def}`);
check('色違いは画像を作らずCSSフィルタだけで表現する',
  R.RPG_ENEMY_TYPES[0].filter === 'none' && red.filter.includes('hue-rotate') && blue.filter.includes('hue-rotate')
  && !/images\/[a-z-]*rpg|rpg[a-z-]*\.png/i.test(source), `赤: ${red.filter}`);

// --- 既存のダメージ式を壊していない ---
check('ダメージ式は 100/(100+丈夫さ×4) のまま',
  R.RPG_DEF_COEFF === 4 && R.RPG_NORMAL_ATTACK_MULT === 1.0
  && R.rpgDamage({ atk: 100, mult: 1, def: 0 }) === 100
  && R.rpgDamage({ atk: 100, mult: 1, def: 25 }) === 50
  && R.rpgDamage({ atk: 100, mult: 2.2, def: 25 }) === 110,
  `ちから100・丈夫さ25・倍率1.0 → ${R.rpgDamage({ atk: 100, mult: 1, def: 25 })}`);
check('防御中は最終ダメージが半分のまま', R.RPG_GUARD_MULT === 0.5
  && R.rpgDamage({ atk: 100, mult: 1, def: 25, guarding: true }) === 25);
check('最低1ダメージは防御中でも守られる', R.rpgDamage({ atk: 1, mult: 1, def: 999, guarding: true }) === 1);
check('ダメージ乱数はOFFなら必ず1.0倍', R.rpgVarianceRoll(false) === 1 && R.rpgVarianceRoll(false, constRng(0)) === 1);
check('ダメージ乱数はONで0.95〜1.05',
  R.rpgVarianceRoll(true, constRng(0)) === 0.95 && R.rpgVarianceRoll(true, constRng(0.5)) === 1
  && Math.abs(R.rpgVarianceRoll(true, constRng(1)) - 1.05) < 1e-9);

// --- クリティカル倍率 ---
check('クリティカルは最終ダメージ1.5倍',
  R.RPG_CRIT_MULT === 1.5
  && R.rpgDamage({ atk: 100, mult: 1, def: 0, critical: true }) === 150
  && R.rpgDamage({ atk: 100, mult: 1, def: 25, critical: true }) === 75);
check('クリティカルと防御は両方かかる',
  R.rpgDamage({ atk: 100, mult: 1, def: 25, guarding: true, critical: true }) === 38,
  `50 × 0.5 × 1.5 = ${R.rpgDamage({ atk: 100, mult: 1, def: 25, guarding: true, critical: true })}`);

// --- 行動値 ---
check('行動値は素早さを基準にする',
  R.rpgActionValue(100, 0.5) === 100 && R.rpgActionValue(50, 0.5) === 50 && R.rpgActionValue(0, 0.5) === 0);
check('行動値の乱数幅は0.9〜1.1',
  R.RPG_ACTION_VARIANCE === 0.1
  && R.rpgActionValue(100, 0) === 90
  && Math.abs(R.rpgActionValue(100, 1) - 110) < 1e-9
  && Array.from({ length: 400 }, () => R.rpgActionValue(100)).every(v => v >= 90 - 1e-9 && v <= 110 + 1e-9),
  `${R.rpgActionValue(100, 0)}〜${R.rpgActionValue(100, 1)}`);
check('素早さが大きく違えば必ず先に動く（最大の遅い側 < 最小の速い側）',
  R.rpgActionValue(50, 1) < R.rpgActionValue(70, 0), `50の上振れ${R.rpgActionValue(50, 1)} < 70の下振れ${R.rpgActionValue(70, 0)}`);

// --- 回避率 ---
const sp = (speed) => ({ speed });
check('回避率 = 3 + (防御側の素早さ - 攻撃側の素早さ) × 0.3',
  R.RPG_EVADE_BASE === 3 && R.RPG_EVADE_PER_SPEED === 0.3
  && R.rpgEvadeRate(sp(10), sp(10)) === 3
  && R.rpgEvadeRate(sp(10), sp(30)) === 9
  && R.rpgEvadeRate(sp(10), sp(50)) === 15,
  `同速${R.rpgEvadeRate(sp(10), sp(10))}% / +20で${R.rpgEvadeRate(sp(10), sp(30))}% / +40で${R.rpgEvadeRate(sp(10), sp(50))}%`);
check('回避率の下限は1%', R.RPG_EVADE_MIN === 1 && R.rpgEvadeRate(sp(999), sp(1)) === 1);
check('回避率の上限は20%', R.RPG_EVADE_MAX === 20 && R.rpgEvadeRate(sp(1), sp(999)) === 20);

// --- クリティカル率 ---
const lk = (luck) => ({ luck });
check('クリティカル率 = 3 + (攻撃側の運 - 防御側の運) × 0.2',
  R.RPG_CRIT_BASE === 3 && R.RPG_CRIT_PER_LUCK === 0.2
  && R.rpgCritRate(lk(10), lk(10)) === 3
  && R.rpgCritRate(lk(30), lk(10)) === 7
  && R.rpgCritRate(lk(60), lk(10)) === 13,
  `同運${R.rpgCritRate(lk(10), lk(10))}% / +20で${R.rpgCritRate(lk(30), lk(10))}% / +50で${R.rpgCritRate(lk(60), lk(10))}%`);
check('クリティカル率の下限は1%', R.RPG_CRIT_MIN === 1 && R.rpgCritRate(lk(1), lk(999)) === 1);
check('クリティカル率の上限は15%', R.RPG_CRIT_MAX === 15 && R.rpgCritRate(lk(999), lk(1)) === 15);
check('率の抽選は「乱数×100 < 率」で味方も敵も同じ',
  R.rpgRollPercent(3, 0.029) === true && R.rpgRollPercent(3, 0.03) === false && R.rpgRollPercent(20, 0.199) === true);

// ================= ② 戦闘の進行 =================
const party = (...slots) => slots;
const slot = (monId, level, alloc = {}) => ({ monId, level, alloc });
const foe = (monId, typeId, level) => ({ monId, typeId, level });
// 乱数の消費順: 敵の行動決定(対象・技) → 全員の行動値 → 攻撃ごとに(回避 → クリティカル)
const NEVER = 0.999;   // 回避・クリティカルとも起きない
const ALWAYS = 0;      // 必ず起きる

let battle = R.rpgCreateBattle(party(slot('Mocchi', 20, { atk: 19 }), slot('Pixie', 20, { atk: 19 })), party(foe('Golem', 'red', 5)));
check('戦闘開始はコマンド入力から始まり、1体目の味方が対象になる',
  battle.phase === 'command' && battle.inputIndex === 0 && battle.turn === 1 && Object.keys(battle.inputs).length === 0);
check('開始時のガッツは最大の50%', battle.allies.every(u => u.guts === R.rpgStartGuts(u.maxGuts)));
check('味方も敵も6ステータスを持って戦う',
  [...battle.allies, ...battle.enemies].every(u => Number.isFinite(u.speed) && Number.isFinite(u.luck)));

battle = R.rpgSetCommand(battle, 'attack', 0, constRng(NEVER));
check('1体目を入力すると2体目の入力へ進む', battle.phase === 'command' && battle.inputIndex === 1 && Object.keys(battle.inputs).length === 1);
battle = R.rpgSetCommand(battle, 'attack', 0, constRng(NEVER));
check('全員の入力が終わると行動順が確定して実行へ移る',
  battle.phase === 'resolve' && battle.planStep === 0 && battle.plan.length === 3,
  battle.plan.map(e => `${R.rpgUnitAt(battle, e.side, e.index).name}(${e.value.toFixed(1)})`).join(' → '));
check('行動順は味方・敵が混ざって行動値の高い順に並ぶ',
  battle.plan.every((e, i) => i === 0 || battle.plan[i - 1].value >= e.value)
  && battle.plan.some(e => e.side === 'ally') && battle.plan.some(e => e.side === 'enemy'));

// 回避もクリティカルも起きない乱数で1体ぶん処理する
const firstEntry = battle.plan[0];
const firstActor = R.rpgUnitAt(battle, firstEntry.side, firstEntry.index);
const targetsBefore = JSON.parse(JSON.stringify(firstEntry.targetSide === 'ally' ? battle.allies : battle.enemies));
let stepped = R.rpgResolveStep(battle, false, constRng(NEVER));
check('行動順の1体目から処理される',
  stepped.planStep === 1
  && (firstEntry.targetSide === 'ally' ? stepped.allies : stepped.enemies)[firstEntry.targetIndex].hp < targetsBefore[firstEntry.targetIndex].hp,
  `${firstActor.name} が行動`);

// --- 回避 ---
const evadeSetup = () => {
  let b = R.rpgCreateBattle(party(slot('Mocchi', 30, { atk: 29 })), party(foe('Golem', 'normal', 30)));
  return R.rpgSetCommand(b, 'attack', 0, constRng(NEVER));
};
const evadeBattle = evadeSetup();
const evadeFirst = evadeBattle.plan[0];
const evadeTargets = evadeFirst.targetSide === 'ally' ? 'allies' : 'enemies';
const hpBeforeEvade = evadeBattle[evadeTargets][evadeFirst.targetIndex].hp;
const evaded = R.rpgResolveStep(evadeBattle, false, constRng(ALWAYS));
const evadedTarget = evaded[evadeTargets][evadeFirst.targetIndex];
const evadedActor = R.rpgUnitAt(evaded, evadeFirst.side, evadeFirst.index);
check('回避されるとダメージは0', evadedTarget.hp === hpBeforeEvade && evadedTarget.record.taken === 0);
check('回避した側の回避回数が増える', evadedTarget.record.evaded === 1);
check('回避したときはクリティカル判定を行わない（会心にならない）',
  evadedActor.record.crits === 0 && !evaded.log.includes('会心の一撃！'),
  evaded.log.slice(0, 2).join(' / '));
check('回避のログが出る', evaded.log.some(line => line.includes('攻撃をかわした')), evaded.log[0]);

// --- クリティカル ---
// 乱数: 回避(外す=NEVER) → クリティカル(起こす=ALWAYS)
const critBattle = evadeSetup();
const critFirst = critBattle.plan[0];
const critTargets = critFirst.targetSide === 'ally' ? 'allies' : 'enemies';
const plainStep = R.rpgResolveStep(critBattle, false, scriptRng([NEVER, NEVER]));
const critStep = R.rpgResolveStep(critBattle, false, scriptRng([NEVER, ALWAYS]));
const plainDamage = critBattle[critTargets][critFirst.targetIndex].hp - plainStep[critTargets][critFirst.targetIndex].hp;
const critDamage = critBattle[critTargets][critFirst.targetIndex].hp - critStep[critTargets][critFirst.targetIndex].hp;
// 丸めは最後に1回だけなので、「通常ダメージを丸めた値×1.5」ではなく
// 同じ入力で critical:true にした rpgDamage と一致することを見る
const critActor = R.rpgUnitAt(critBattle, critFirst.side, critFirst.index);
const critTarget = critBattle[critTargets][critFirst.targetIndex];
const critMult = critFirst.command === 'skill' ? critActor.skill.mult : R.RPG_NORMAL_ATTACK_MULT;
check('クリティカルで与ダメージが1.5倍になる',
  critDamage === R.rpgDamage({ atk: critActor.atk, mult: critMult, def: critTarget.def, critical: true })
  && plainDamage === R.rpgDamage({ atk: critActor.atk, mult: critMult, def: critTarget.def })
  && critDamage > plainDamage,
  `通常${plainDamage} → 会心${critDamage}（丸め前の1.5倍）`);
check('クリティカル回数が記録され、ログにも出る',
  R.rpgUnitAt(critStep, critFirst.side, critFirst.index).record.crits === 1
  && critStep.log.includes('会心の一撃！'));

// --- 技を回避されても消費ガッツは戻らない ---
let skillBattle = R.rpgCreateBattle(party(slot('Pixie', 30, { guts: 29 })), party(foe('Golem', 'normal', 30)));
const skillCost = skillBattle.allies[0].skill.cost;
const gutsBeforeSkill = skillBattle.allies[0].guts;
skillBattle = R.rpgSetCommand(skillBattle, 'skill', 0, constRng(NEVER));
// 味方が先に動くよう、行動順の先頭が味方になるまで確かめてから処理する
const skillEntryIndex = skillBattle.plan.findIndex(e => e.side === 'ally');
skillBattle.plan = [skillBattle.plan[skillEntryIndex], ...skillBattle.plan.filter((_, i) => i !== skillEntryIndex)];
const skillMissed = R.rpgResolveStep(skillBattle, false, constRng(ALWAYS));
check('技が回避されても消費ガッツは戻らない',
  skillMissed.allies[0].guts === gutsBeforeSkill - skillCost
  && skillMissed.allies[0].record.gutsSpent === skillCost
  && skillMissed.allies[0].record.skills === 1
  && skillMissed.enemies[0].record.taken === 0,
  `消費${skillCost} / ${gutsBeforeSkill}→${skillMissed.allies[0].guts}`);

// --- 倒されたモンスターは未行動でも行動しない ---
let deadBattle = R.rpgCreateBattle(party(slot('Mocchi', 10), slot('Pixie', 10)), party(foe('Golem', 'normal', 10)));
deadBattle = R.rpgSetCommand(deadBattle, 'attack', 0, constRng(NEVER));
deadBattle = R.rpgSetCommand(deadBattle, 'attack', 0, constRng(NEVER));
// 行動順を「味方0 → 味方1 → 敵」に固定し、味方1を倒れた状態にする
deadBattle.plan = [
  { side:'ally', index:0, command:'attack', targetSide:'enemy', targetIndex:0, value:100 },
  { side:'ally', index:1, command:'attack', targetSide:'enemy', targetIndex:0, value:90 },
  { side:'enemy', index:0, command:'attack', targetSide:'ally', targetIndex:0, value:80 },
];
deadBattle.planStep = 0;
deadBattle.allies[1].alive = false;
deadBattle.allies[1].hp = 0;
const afterDeadFirst = R.rpgResolveStep(deadBattle, false, constRng(NEVER));
const afterDeadSecond = R.rpgResolveStep(afterDeadFirst, false, constRng(NEVER));
check('倒されたモンスターは入力済みでも行動しない',
  afterDeadSecond.allies[1].record.attacks === 0 && afterDeadSecond.allies[1].record.dealt === 0
  && afterDeadSecond.enemies[0].hp === afterDeadFirst.enemies[0].hp,
  `味方2の攻撃回数 ${afterDeadSecond.allies[1].record.attacks}`);

// --- 行動前に対象が倒れていたら生存者へ狙いを移す ---
let retargetBattle = R.rpgCreateBattle(party(slot('Golem', 50, { atk: 49 }), slot('Golem', 50, { atk: 49 })), party(foe('Pixie', 'normal', 1), foe('Pixie', 'normal', 1)));
retargetBattle = R.rpgSetCommand(retargetBattle, 'attack', 0, constRng(NEVER));
retargetBattle = R.rpgSetCommand(retargetBattle, 'attack', 0, constRng(NEVER));
retargetBattle.plan = [
  { side:'ally', index:0, command:'attack', targetSide:'enemy', targetIndex:0, value:100 },
  { side:'ally', index:1, command:'attack', targetSide:'enemy', targetIndex:0, value:90 },
];
retargetBattle.planStep = 0;
const killed = R.rpgResolveStep(retargetBattle, false, constRng(NEVER));
check('1体目の攻撃で対象が倒れる', killed.enemies[0].alive === false, `残HP ${killed.enemies[0].hp}`);
const retargeted = R.rpgResolveStep(killed, false, constRng(NEVER));
check('対象が倒れていたら生存している敵へ自動で狙いを移す',
  retargeted.enemies[1].record.taken > 0 && retargeted.allies[1].record.dealt > 0,
  retargeted.log.find(line => line.includes('狙いを変えた')) || '');

// --- 対象が全滅していれば行動をスキップ ---
let noTargetBattle = R.rpgCreateBattle(party(slot('Mocchi', 10)), party(foe('Pixie', 'normal', 1), foe('Pixie', 'normal', 1)));
noTargetBattle = R.rpgSetCommand(noTargetBattle, 'attack', 0, constRng(NEVER));
noTargetBattle.plan = [{ side:'ally', index:0, command:'attack', targetSide:'enemy', targetIndex:0, value:100 }];
noTargetBattle.planStep = 0;
noTargetBattle.enemies.forEach(u => { u.alive = false; u.hp = 0; });
const skippedTurn = R.rpgResolveStep(noTargetBattle, false, constRng(NEVER));
check('対象が誰も残っていなければ勝敗判定へ進む', skippedTurn.phase === 'result' && skippedTurn.outcome === 'win');

// --- 防御 ---
let guardBattle = R.rpgCreateBattle(party(slot('Mocchi', 30, { hp: 29 })), party(foe('Golem', 'normal', 30)));
guardBattle = R.rpgSetCommand(guardBattle, 'guard', null, constRng(NEVER));
check('防御を選んでも、行動が実行されるまでは防御状態にならない',
  guardBattle.phase === 'resolve' && guardBattle.allies[0].guarding === false);
guardBattle.plan = [
  { side:'ally', index:0, command:'guard', targetSide:null, targetIndex:-1, value:100 },
  { side:'enemy', index:0, command:'attack', targetSide:'ally', targetIndex:0, value:90 },
];
guardBattle.planStep = 0;
const guardOn = R.rpgResolveStep(guardBattle, false, constRng(NEVER));
check('防御を実行した時点から防御状態になる', guardOn.allies[0].guarding === true);
const guardHit = R.rpgResolveStep(guardOn, false, constRng(NEVER));
check('防御中の被ダメージは半分',
  guardHit.allies[0].record.taken === R.rpgDamage({ atk: guardBattle.enemies[0].atk, mult: 1, def: guardBattle.allies[0].def, guarding: true }),
  `${guardHit.allies[0].record.taken}ダメージ`);
check('次のターンへ持ち越さず防御は解除される', guardHit.turn === 2 && guardHit.allies.every(u => !u.guarding) && guardHit.enemies.every(u => !u.guarding));

// --- ガッツ回復が二重にならない ---
let gutsBattle = R.rpgCreateBattle(party(slot('Mocchi', 40, { hp: 39 })), party(foe('Mocchi', 'normal', 1)));
const allyMaxGuts = gutsBattle.allies[0].maxGuts;
const gutsTurn1 = gutsBattle.allies[0].guts;
check('1ターン目はガッツを回復しない（戦闘開始時の値のまま）', gutsTurn1 === R.rpgStartGuts(allyMaxGuts));
gutsBattle = R.rpgSetCommand(gutsBattle, 'guard', null, constRng(NEVER));
let steps = 0;
while (gutsBattle.phase === 'resolve' && steps < 20) { gutsBattle = R.rpgResolveStep(gutsBattle, false, constRng(NEVER)); steps += 1; }
check('ターンが終わるとガッツ回復はちょうど1回だけ',
  gutsBattle.turn === 2
  && gutsBattle.allies[0].guts === Math.min(allyMaxGuts, gutsTurn1 + R.rpgTurnGutsRegen(allyMaxGuts)),
  `${gutsTurn1} → ${gutsBattle.allies[0].guts}（回復量 ${R.rpgTurnGutsRegen(allyMaxGuts)}）`);
check('敵のガッツ回復も1ターンに1回だけ',
  gutsBattle.enemies[0].guts === Math.min(gutsBattle.enemies[0].maxGuts,
    R.rpgStartGuts(gutsBattle.enemies[0].maxGuts) + R.rpgTurnGutsRegen(gutsBattle.enemies[0].maxGuts)));

// --- 決着 ---
let run = R.rpgCreateBattle(party(slot('Golem', 50, { atk: 49 })), party(foe('Suezo', 'normal', 1)));
for (let i = 0; i < 300 && run.phase !== 'result'; i++) {
  if (run.phase === 'resolve') run = R.rpgResolveStep(run, false, constRng(NEVER));
  else run = R.rpgSetCommand(run, 'attack', R.rpgAliveIndexes(run.enemies)[0], constRng(NEVER));
}
check('全敵を倒すと勝利になる', run.outcome === 'win' && run.phase === 'result', `${run.turn}ターン`);
let lose = R.rpgCreateBattle(party(slot('Pixie', 1)), party(foe('Golem', 'red', 50)));
for (let i = 0; i < 300 && lose.phase !== 'result'; i++) {
  if (lose.phase === 'resolve') lose = R.rpgResolveStep(lose, false, constRng(NEVER));
  else lose = R.rpgSetCommand(lose, 'guard', null, constRng(NEVER));
}
check('味方が全滅すると敗北になる', lose.outcome === 'lose' && lose.phase === 'result', `${lose.turn}ターン`);
check('結果にバランス確認用の記録が残る（会心・回避を含む）',
  ['dealt', 'taken', 'attacks', 'skills', 'gutsSpent', 'crits', 'evaded'].every(key => key in run.allies[0].record && key in run.enemies[0].record),
  Object.keys(run.allies[0].record).join(','));

// --- 敵AI ---
let aiSkill = false, aiAttack = false;
for (let i = 0; i < 60; i++) {
  let ai = R.rpgCreateBattle(party(slot('Mocchi', 50, { hp: 49 })), party(foe('Pixie', 'normal', 30)));
  // 敵の行動決定は「対象 → 技」の順に2回引く。技のロールだけを振り分ける
  ai = R.rpgSetCommand(ai, 'guard', null, scriptRng([0, i % 2 === 0 ? 0 : NEVER, 0.5, 0.5]));
  const entry = ai.plan.find(e => e.side === 'enemy');
  if (entry?.command === 'skill') aiSkill = true;
  if (entry?.command === 'attack') aiAttack = true;
}
check('敵AIは固有技と通常攻撃を撃ち分ける', aiSkill && aiAttack, `固有技率 ${R.RPG_ENEMY_SKILL_CHANCE}`);

// --- 味方と敵が同じ計算関数を使っている（実際に同じ数値になるか） ---
const mirrorA = { atk: 40, def: 12, speed: 24, luck: 18 };
const mirrorB = { atk: 40, def: 12, speed: 24, luck: 18 };
check('同じ能力なら攻撃側が味方でも敵でも回避率・クリティカル率・ダメージが一致する',
  R.rpgEvadeRate(mirrorA, mirrorB) === R.rpgEvadeRate(mirrorB, mirrorA)
  && R.rpgCritRate(mirrorA, mirrorB) === R.rpgCritRate(mirrorB, mirrorA)
  && R.rpgDamage({ atk: mirrorA.atk, mult: 1, def: mirrorB.def }) === R.rpgDamage({ atk: mirrorB.atk, mult: 1, def: mirrorA.def }));

// ================= ③ 通常ゲームからの分離 =================
const rpgUi = grab(source, '{/* ===== ダンジョンRPG戦闘テスト', "{gameState==='DEBUG_SETTINGS'&&(");
const debugScreen = grab(source, "{gameState==='DEBUG_SETTINGS'&&(", "{gameState==='MONSTER_IMAGE_DEBUG'&&(");
check('入口はデバッグ設定の中にだけある',
  debugScreen.includes('data-debug-rpg-battle') && debugScreen.includes("setGameState('RPG_DEBUG_SETUP')")
  && (source.match(/setGameState\('RPG_DEBUG_SETUP'\)/g) || []).length === 3,
  `RPG_DEBUG_SETUP への遷移 ${(source.match(/setGameState\('RPG_DEBUG_SETUP'\)/g) || []).length}か所`);
check('通常HOME・通常バトル・マスモン管理には入口を作っていない',
  !/mh-home-facility[^\n]*RPG_DEBUG|RPG_DEBUG[^\n]*mh-home-facility/.test(source)
  && !grab(source, "{gameState==='HOME'&&", "{gameState==='MB_MANAGEMENT'").includes('RPG_DEBUG'));
check('RPG側はマスモン(個体)を一切使わない',
  !/masuMons|getMasuColors|masuId|resolveMasuMonster/.test(rpgUi)
  && !/masuMons|masuId/.test(rpgSource));
check('RPG側は保存・報酬・ランキング・ミッション・絆へ触れない',
  !/storeSet|storeGet|awardRunRewards|submitRunScore|recordClearOnce|addAssistantBond|addBondXp|setGold|setDiamond|supabase|mh_/.test(rpgSource)
  && !/storeSet|storeGet|awardRunRewards|submitRunScore|recordClearOnce|addAssistantBond|setGold|supabase|mh_/.test(rpgUi));
const rpgStateBlock = grab(source, '  // ---------- ダンジョンRPG戦闘テスト(デバッグ専用) ----------', '  // 供モンが合流したときの');
check('RPGの状態はメモリ上のuseStateだけ(保存キーを作らない)',
  !/storeSet|storeGet|localStorage|mh_/.test(rpgStateBlock) && rpgStateBlock.includes('useState'));
check('既存のデバッグ戦(debugBattleRef)と混ざらない',
  !/debugBattleRef|setDebugBattle|extremeRunRef/.test(rpgSource) && !/debugBattleRef|setDebugBattle/.test(rpgUi));
check('RPGの3画面はヘルプ対象外として明示されている',
  ['RPG_DEBUG_SETUP', 'RPG_DEBUG_BATTLE', 'RPG_DEBUG_RESULT'].every(name => new RegExp(`${name}:\\s*null`).test(helpSource)));
check('デバッグ専用なので更新履歴には載せない', !/RPG|ダンジョン/.test(changelogSource));
// ヘルプ側にRPGの文字が出てよいのは、画面カバレッジの対象外指定とその説明コメントだけ。
// プレイヤー向けの項目(HELP_CATEGORIES)へは1文字も足さない
const helpCoverage = grab(helpSource, 'const HELP_SCREEN_COVERAGE = {', '\n};');
check('公開ヘルプにRPGの項目を作っていない',
  (helpSource.match(/RPG/g) || []).length === (helpCoverage.match(/RPG/g) || []).length
  && !/素早さ|会心の一撃/.test(helpSource),
  `ヘルプ全体${(helpSource.match(/RPG/g) || []).length}件 / うち画面カバレッジ${(helpCoverage.match(/RPG/g) || []).length}件`);

// --- 画面の作り ---
check('結果画面から再戦・編成変更・デバッグ設定へ戻れる',
  rpgUi.includes('同じ条件でもう一度') && rpgUi.includes('編成・Lv・ステータスを変更') && rpgUi.includes('デバッグ設定へ戻る'));
check('セットアップで基礎→ステ振り後と使用ポイントが見える',
  rpgUi.includes('mh-rpg-stat-base') && rpgUi.includes('mh-rpg-stat-final') && rpgUi.includes('使用 {used} / {limit}P'));
check('セットアップのステ振りは6ステータスすべてを RPG_STAT_KEYS から作る',
  (rpgUi.match(/RPG_STAT_KEYS\.map/g) || []).length === 2 && rpgUi.includes('rpgStepAlloc(index,key,'),
  '画面側でステータス名を書き並べていない');
check('こうげき・技・防御の3コマンドがある',
  rpgUi.includes('>こうげき</button>') && rpgUi.includes("startAction('attack')") && rpgUi.includes("startAction('guard')")
  && rpgUi.includes('setRpgSkillMenu(true)'));
// 「技」は直接発動せず、覚えている技の一覧を経由してから対象選択へ進む。
// 今は固有技1つだけだが、増えても戦闘画面を作り直さずに済むようにしておく
check('技は「技ボタン → 技一覧 → 技選択」の順で選ぶ',
  rpgUi.includes('const skillList=actor&&actor.skill?[actor.skill]:[];')
  && rpgUi.includes('{skillList.map((skill,i)=>{')
  && rpgUi.includes('<b>{skill.name}</b>') && rpgUi.includes('消費ガッツ {skill.cost}')
  && rpgUi.includes("startAction('skill')"));
check('技一覧から通常コマンドへ戻れる', (rpgUi.match(/mh-rpg-cancel/g) || []).length === 1);
// --- ねらい(対象は選ばなくてよい) ---
// 「敵を選んでから撃つ」を必須にすると、コマンドを連打できず試作の回転が悪くなる。
// ふだんは自動でライフ最小の敵へ飛ばし、狙いたいときだけ敵をタップして固定する
check('対象を選ばずに撃つとライフがいちばん低い敵へ飛ぶ',
  rpgUi.includes('const autoTarget=rpgLowestHpEnemy(battle);')
  && rpgUi.includes('const targetIndex=aimIndex>=0?aimIndex:autoTarget;')
  && rpgUi.includes('rpgCommand(command,targetIndex);'));
check('コマンドを押しても対象選択の画面を挟まない',
  !rpgUi.includes("phase:'target'") && !rpgUi.includes('上の敵をタップして選んでください'),
  'こうげき・技はその場で実行される');
check('ねらいは敵をタップして固定・もう一度タップで自動へ戻る',
  rpgUi.includes('const toggleAim=(index)=>setRpgAim(prev=>(prev===index?null:index));')
  && rpgUi.includes('onClick={()=>toggleAim(index)}'));
check('ねらいの誤タップで行動を消費しない',
  !rpgUi.includes("onClick={()=>rpgCommand(battle.pendingCommand||'attack',index)}")
  && rpgUi.includes('const selectable=inputting&&unit.alive;'),
  '敵のタップはねらいの切り替えだけ');
check('ねらった敵が倒れたら自動(ライフ最小)へ戻る',
  rpgUi.includes('const aimUnit=(rpgAim!==null&&battle.enemies[rpgAim]&&battle.enemies[rpgAim].alive)?battle.enemies[rpgAim]:null;')
  && rpgUi.includes('const aimIndex=aimUnit?rpgAim:-1;'));
check('いま誰をねらっているかが画面に出る',
  rpgUi.includes('mh-rpg-aim') && rpgUi.includes('ねらい: <b>{targetUnit?targetUnit.name:') 
  && rpgUi.includes('自動・ライフ最小') && rpgUi.includes('mh-rpg-aim-mark'));
check('ねらいは画面だけの状態で、戦闘の状態には入れない',
  source.includes('const [rpgAim, setRpgAim] = useState(null);') && !/rpgAim/.test(rpgSource),
  '戦闘の状態(rpgBattle)は素のまま');
check('戦闘を始めるときにねらいと技の演出を初期化する',
  source.includes('setRpgAim(null);\n    setRpgSpecial(null);\n    setRpgBattle(rpgCreateBattle('));
// 自動のねらい先は乱数を使わずに決める。同じ盤面なら誰が見ても同じ相手になる
{
  const battle = { enemies: [
    { alive:true, hp:50 }, { alive:true, hp:12 }, { alive:false, hp:1 }, { alive:true, hp:12 },
  ] };
  check('自動のねらい先は生きている敵のうちライフ最小', R.rpgLowestHpEnemy(battle) === 1, `${R.rpgLowestHpEnemy(battle)}番`);
  check('ライフが同じなら並び順が早いほうを狙う(毎回同じ結果)',
    R.rpgLowestHpEnemy(battle) === R.rpgLowestHpEnemy(battle) && R.rpgLowestHpEnemy(battle) === 1);
  check('倒れた敵は狙わない', R.rpgLowestHpEnemy({ enemies: [{ alive:false, hp:1 }, { alive:true, hp:99 }] }) === 1);
  check('全滅していたら狙う相手が無い(-1)', R.rpgLowestHpEnemy({ enemies: [{ alive:false, hp:1 }] }) === -1);
}
check('いまコマンドを入力する味方が分かる',
  rpgUi.includes("const isActor=inputting&&index===battle.inputIndex;")
  && rpgUi.includes('${isActor?\'active\':\'\'}') && rpgUi.includes('<em>COMMAND</em>'));
check('戦闘不能・防御が見て分かる',
  rpgUi.includes('mh-rpg-down-mark') && rpgUi.includes('mh-rpg-guard-mark')
  && /\.mh-rpg-foe\.down\{[^}]*grayscale/.test(source) && /\.mh-rpg-member\.down\{[^}]*grayscale/.test(source));
check('ダメージ・会心・回避がモンスターの上に出る',
  rpgUi.includes('const hitNode=(hit)=>') && rpgUi.includes("hit.evaded?'MISS'") && rpgUi.includes('<i>会心</i>')
  && /\.mh-rpg-hit\{/.test(source) && /\.mh-rpg-hit\.crit\{/.test(source) && /\.mh-rpg-hit\.miss\{/.test(source));
check('ダメージ表示は戦闘の計算に触らず、前後の状態の差だけを見ている',
  source.includes('const rpgPrevBattleRef = useRef(null);')
  && source.includes('if (!rpgSteppedOnce(prev, rpgBattle)) return;')
  && !/rpgHits/.test(rpgSource));
// 同じ相手へ2回続けて当たると、Reactが同じ要素を使い回してアニメーションが動かない。
// 行動の番号をキーにして、当たるたびに必ず出し直す
check('同じ相手へ続けて当たっても数字を出し直す',
  rpgUi.includes('key={rpgHits?rpgHits.at:0}') && source.includes("at: rpgBattle.planStep };"));
check('会心・回避・戦闘不能が数字だけで見分けられる',
  rpgUi.includes("hit.crit?'crit':''") && rpgUi.includes("hit.evaded?'miss':''") && rpgUi.includes("hit.down?'down':''")
  && /\.mh-rpg-hit\.crit\{/.test(source) && /\.mh-rpg-hit\.miss\{/.test(source) && /\.mh-rpg-hit\.down\{/.test(source));
// 「読めない大きさ」に戻さないための下限。CSSの実値をそのまま見る
{
  const hitCss = (grab(source, '.mh-rpg-hit{', '}') + '}');
  const critCss = (grab(source, '.mh-rpg-hit.crit{', '}') + '}');
  const size = (css) => Number((css.match(/font-size:(\d+)px/) || [])[1] || 0);
  const ms = Number((hitCss.match(/rpgHitPop (\d+)ms/) || [])[1] || 0);
  check('ダメージの数字が読める大きさ(通常18px以上・会心22px以上)',
    size(hitCss) >= 18 && size(critCss) >= 22, `通常 ${size(hitCss)}px / 会心 ${size(critCss)}px`);
  check('数字が出てから消えるまで0.8秒以上ある', ms >= 800, `${ms}ms`);
  check('数字を消すまでの時間がアニメーションと揃っている',
    source.includes(`setTimeout(() => setRpgHits(null), ${ms});`), `${ms}ms`);
}

// --- コマンドのやり直し ---
// 次の味方へ進んだあとでも、前の味方まで戻って選び直せる。
// 戻せるのは入力中だけで、行動の実行が始まったあとは戻せない
{
  const mons = R.rpgMonsterList();
  const party = [0, 1, 2].map(i => ({ monId: mons[i].id, level: 30, alloc: R.rpgNormalizeAlloc({ guts: 29 }, 30) }));
  const foes = [{ monId: mons[5].id, level: 30, typeId: 'normal' }, { monId: mons[6].id, level: 30, typeId: 'red' }];
  const rng = constRng(0.5);
  let b = R.rpgCreateBattle(party, foes);
  check('はじめは誰も決めていないので戻せない',
    !R.rpgCanUndo(b, 0) && !R.rpgCanUndo(b, 1) && !R.rpgCanUndo(b, 2));
  b = R.rpgSetCommand(b, 'attack', 0, rng);
  check('1体決めると次の味方へ進む', b.inputIndex === 1 && !!b.inputs[0], `いま ${b.inputIndex}番目`);
  check('決めた味方は戻せて、まだの味方は戻せない',
    R.rpgCanUndo(b, 0) && !R.rpgCanUndo(b, 1) && !R.rpgCanUndo(b, 2));
  b = R.rpgSetCommand(b, 'guard', -1, rng);
  const before = JSON.parse(JSON.stringify(b));
  const undone = R.rpgUndoCommand(b, 0);
  check('戻すとその味方の番に戻る', undone.inputIndex === 0 && undone.phase === 'command');
  check('戻した味方の入力だけが消える',
    !undone.inputs[0] && JSON.stringify(undone.inputs[1]) === JSON.stringify(before.inputs[1]),
    JSON.stringify(undone.inputs));
  check('戻してもライフ・ガッツ・ターン数は変わらない',
    undone.turn === before.turn
    && undone.allies.every((u, i) => u.hp === before.allies[i].hp && u.guts === before.allies[i].guts)
    && undone.enemies.every((u, i) => u.hp === before.enemies[i].hp && u.guts === before.enemies[i].guts));
  check('戻す前の状態を書き換えない（別のオブジェクトを返す）',
    b !== undone && !!b.inputs[0] && b.inputIndex === before.inputIndex);
  // 戻したあと選び直すと、すでに決まっている味方はそのままで、まだの味方へ進む
  const redo = R.rpgSetCommand(undone, 'skill', 1, rng);
  check('やり直したあとは、まだ決めていない味方へ進む',
    redo.inputIndex === 2 && redo.inputs[0].command === 'skill' && redo.inputs[0].targetIndex === 1
    && JSON.stringify(redo.inputs[1]) === JSON.stringify(before.inputs[1]),
    `いま ${redo.inputIndex}番目 / 0番目=${redo.inputs[0].command}`);
  // 3体目まで決めると行動順の実行へ入る。そこからは戻せない
  const all = R.rpgSetCommand(R.rpgSetCommand(undone, 'attack', 0, rng), 'attack', 0, rng);
  check('全員決めると実行へ進む', all.phase === 'resolve', all.phase);
  check('実行が始まったら戻せない',
    !R.rpgCanUndo(all, 0) && !R.rpgCanUndo(all, 1) && !R.rpgCanUndo(all, 2)
    && JSON.stringify(R.rpgUndoCommand(all, 0).inputs) === JSON.stringify(all.inputs));
  check('決めていない味方を戻そうとしても何も起きない',
    JSON.stringify(R.rpgUndoCommand(undone, 2)) === JSON.stringify(undone));
  check('居ない味方を指しても落ちない',
    JSON.stringify(R.rpgUndoCommand(undone, 9)) === JSON.stringify(undone)
    && JSON.stringify(R.rpgUndoCommand(undone, -1)) === JSON.stringify(undone));
}
check('コマンドの呼び名は1か所にまとめてある',
  R.RPG_COMMAND_LABELS.attack === 'こうげき' && R.RPG_COMMAND_LABELS.skill === '技' && R.RPG_COMMAND_LABELS.guard === '防御');
check('決めた味方のカードを押すとやり直せる',
  rpgUi.includes('const canUndo=rpgCanUndo(battle,index);') && rpgUi.includes('onClick={()=>rpgUndo(index)}')
  && rpgUi.includes('disabled={!canUndo}') && source.includes('const rpgUndo = (index) =>'));
check('カードには選んだコマンドを出す',
  rpgUi.includes('{!isActor&&chosen&&<em className="done">{RPG_COMMAND_LABELS[chosen.command]||chosen.command}'));
check('やり直せることを画面に書いてある', rpgUi.includes('決めた味方をタップでやり直し'));

// --- 演出・ダメージ表示の取りこぼし ---
// rpgResolveStep() は3通りの抜け方をする(まだ続く / 決着 / そのターンの最後)。
// 画面側はこの3つすべてを「1手進んだ」と見なさないと、その1手ぶんの
// 技名の帯・ダメージの数字・攻撃モーションが丸ごと出なくなる。
// 実際に戦闘を最後まで流して、1手も取りこぼさないことを確かめる
{
  const mons = R.rpgMonsterList();
  const party = [0, 1].map(i => ({ monId: mons[i].id, level: 24, alloc: R.rpgNormalizeAlloc({ atk: 23 }, 24) }));
  const foes = [0, 1].map(i => ({ monId: mons[i + 2].id, level: 3, typeId: 'normal' }));
  let battle = R.rpgCreateBattle(party, foes);
  const rng = constRng(0.5); // 回避も会心も起きない・敵は通常こうげき
  let steps = 0, missed = 0, turns = 0, ended = false, sawTurnEnd = false;
  for (let guard = 0; guard < 400 && !ended; guard++) {
    if (battle.phase === 'command') {
      // 生きている味方ぜんぶへコマンドを入れて、行動順の実行へ進める
      let safety = 0;
      // 対象は画面と同じ「ライフ最小の敵」。倒れた敵を指すとコマンドが入らない
      while (battle.phase === 'command' && safety++ < 8) battle = R.rpgSetCommand(battle, 'attack', R.rpgLowestHpEnemy(battle), rng);
      if (battle.phase !== 'resolve') break;
      turns += 1;
      continue;
    }
    if (battle.phase !== 'resolve') break;
    const prev = battle;
    battle = R.rpgResolveStep(prev, false, rng);
    steps += 1;
    if (!R.rpgSteppedOnce(prev, battle)) missed += 1;
    if (battle.phase === 'command') sawTurnEnd = true;   // そのターンの最後の行動
    if (battle.phase === 'result') ended = true;         // 決着の一撃
  }
  // 取りこぼしが起きるのはこの2か所なので、テストが両方を通ったことを確かめる
  check('テストがターンの終わりと決着の一撃を両方通っている', ended && sawTurnEnd && turns >= 2,
    `${turns}ターン / ${steps}手 / ターン終わり=${sawTurnEnd} / 決着=${ended}`);
  check('1手ぶんの演出・ダメージ表示を1度も取りこぼさない', missed === 0,
    `取りこぼし ${missed}手 / 全${steps}手`);
}
// 3通りの抜け方を、状態を直接作って1つずつ確かめる
check('そのターンがまだ続くとき', R.rpgSteppedOnce({ phase:'resolve', planStep:2, turn:5 }, { phase:'resolve', planStep:3, turn:5 }) === true);
check('決着がついた一撃も拾う', R.rpgSteppedOnce({ phase:'resolve', planStep:2, turn:5 }, { phase:'result', planStep:3, turn:5 }) === true);
check('そのターン最後の行動も拾う', R.rpgSteppedOnce({ phase:'resolve', planStep:3, turn:5 }, { phase:'command', planStep:0, turn:6 }) === true);
check('戦闘を作り直したときは演出を出さない',
  R.rpgSteppedOnce({ phase:'resolve', planStep:3, turn:5 }, { phase:'command', planStep:0, turn:1 }) === false);
check('コマンド入力中の書き換えでは演出を出さない',
  R.rpgSteppedOnce({ phase:'command', planStep:0, turn:5 }, { phase:'command', planStep:0, turn:5 }) === false
  && R.rpgSteppedOnce({ phase:'command', planStep:0, turn:5 }, { phase:'resolve', planStep:0, turn:5 }) === false);
check('状態が無いときも落ちない',
  R.rpgSteppedOnce(null, { phase:'resolve', planStep:1, turn:1 }) === false
  && R.rpgSteppedOnce({ phase:'resolve', planStep:0, turn:1 }, null) === false);
// 決着がついた瞬間に結果画面へ飛ばすと、最後の一撃だけ何も見えないまま終わる
check('決着の一撃を見せてから結果画面へ移る',
  source.includes("setTimeout(() => setGameState('RPG_DEBUG_RESULT'), RPG_FINISH_MS);")
  && !source.includes("rpgBattle?.phase === 'result') setGameState('RPG_DEBUG_RESULT');"), `${R.RPG_FINISH_MS}ms`);
check('結果画面へ移るまでの間が、いちばん長い演出より長い',
  R.RPG_FINISH_MS > R.RPG_SPECIAL_MS && R.RPG_FINISH_MS > 900,
  `結果へ ${R.RPG_FINISH_MS}ms / 技の演出 ${R.RPG_SPECIAL_MS}ms / ダメージの数字 900ms`);
check('画面側はこの判定だけを使う（planStepの増加を直接見ない）',
  source.includes('if (!rpgSteppedOnce(prev, rpgBattle)) return;')
  && !source.includes("rpgBattle.planStep !== prev.planStep + 1"));

// --- 技の演出 ---
// 技は通常こうげきより重い行動なので、技名の帯・閃光・揺れ・衝撃波で強調する。
// すべて表示だけで、ダメージ・行動順・ガッツの計算には関係しない
check('技を撃つと技名と撃った本人が帯に出る',
  rpgUi.includes('mh-rpg-special-band') && rpgUi.includes('<small>{rpgSpecial.by}</small><b>{rpgSpecial.name}</b>'));
// ダメージの数字はモンスターの頭の上に出る。帯を同じ場所へ出すと数字が読めなくなるので、
// 帯はメッセージ欄を基準にして「敵エリアのすぐ下」へ置く
check('技名の帯はモンスターの上ではなくメッセージ欄の真上に出す',
  /\.mh-rpg-special-band\{[^}]*bottom:calc\(100% \+ 3px\)/.test(source)
  && /\.mh-rpg-message\{position:relative/.test(source)
  && !/\.mh-rpg-special-band\{[^}]*top:\d+%/.test(source));
check('技を撃つと画面が光り、戦う場所が揺れる',
  rpgUi.includes('mh-rpg-special-flash') && rpgUi.includes("${rpgSpecial?'shake':''}")
  && /\.mh-rpg-special-flash\{/.test(source) && /@keyframes rpgSpecialShake\{/.test(source));
// 画面ごと揺らすと、いちばん下のコマンド欄が一瞬だけ画面の外へ出てしまう。
// 揺れは横だけ・戦う場所だけに限る
check('揺れは横だけで、上下には動かさない',
  !/@keyframes rpgSpecialShake\{[^@]*translateY/.test(source)
  && !/@keyframes rpgSpecialShake\{[^@]*translate\(-?\d+px,\s*-?\d+px\)/.test(source),
  grab(source, '@keyframes rpgSpecialShake{', '}}').slice(0, 60) + '…');
check('技を受けた相手にも当たった印が出る（敵は衝撃波・味方はカードが光る）',
  rpgUi.includes("const struckBySpecial=(side,index)=>") && rpgUi.includes("struckBySpecial('enemy',index)")
  && rpgUi.includes("struckBySpecial('ally',index)?'struck':''")
  && /\.mh-rpg-special-ring\{/.test(source) && /\.mh-rpg-member\.struck\{/.test(source));
// ガッツが足りないと技は出ず通常こうげきになる。そのときに演出だけ出ると嘘になる
check('技が出たかどうかは「技を使った回数が増えたか」で見る',
  source.includes("const usedSkill = !!(acted && acted.command === 'skill' && actor && now")
  && source.includes("(now.record.skills || 0) > (actor.record.skills || 0));")
  && source.includes('if (usedSkill && actor.skill) {'));
check('ガッツが足りずに通常こうげきへ落ちたときは必殺モーションも出さない',
  source.includes('rpgMotionName(acted.side, actor.monId, usedSkill)')
  && !source.includes("rpgMotionName(acted.side, actor.monId, acted.command === 'skill')"),
  '選んだコマンドではなく、実際に技が出たかで決めている');
check('技の演出は画面だけの状態で、戦闘の状態には入れない',
  source.includes('const [rpgSpecial, setRpgSpecial] = useState(null);') && !/rpgSpecial/.test(rpgSource));
check('演出を消すまでの時間と、演出そのものの長さが揃っている',
  source.includes('setTimeout(() => setRpgSpecial(null), RPG_SPECIAL_MS);')
  && /animation:rpgSpecialBand 940ms/.test(source) && R.RPG_SPECIAL_MS === 940, `${R.RPG_SPECIAL_MS}ms`);
// 演出を見せるぶん、技の直後だけ次の行動を待つ。順番も結果も変わらない
check('技を撃った直後だけ、次の行動までの間を長くとる',
  R.RPG_SPECIAL_STEP_MS > R.RPG_STEP_MS
  && R.rpgStepDelay({ plan:[{ command:'skill' }], planStep:1 }) === R.RPG_SPECIAL_STEP_MS
  && R.rpgStepDelay({ plan:[{ command:'attack' }], planStep:1 }) === R.RPG_STEP_MS
  && R.rpgStepDelay({ plan:[{ command:'guard' }], planStep:1 }) === R.RPG_STEP_MS,
  `通常 ${R.RPG_STEP_MS}ms / 技のあと ${R.RPG_SPECIAL_STEP_MS}ms`);
check('間の取り方が壊れた戦闘状態でも落ちない',
  R.rpgStepDelay(null) === R.RPG_STEP_MS && R.rpgStepDelay({}) === R.RPG_STEP_MS
  && R.rpgStepDelay({ plan:'こわれた値', planStep:3 }) === R.RPG_STEP_MS
  && R.rpgStepDelay({ plan:[], planStep:0 }) === R.RPG_STEP_MS);
check('間の取り方は plan を読むだけで書き換えない',
  !/rpgStepDelay[\s\S]{0,400}?(plan\s*=|plan\.push|planStep\s*=)/.test(grab(source, 'const rpgStepDelay', '\n};')));

// --- 攻撃モーション(通常バトルからの流用) ---
// モーションの種類は通常バトルとまったく同じ ALL_PLAYER_MONSTERS[].atkMotion から決める。
// RPG用に別のモーションデータを持たないので、モンスターを足しても更新漏れが起きない
check('モーションの種類は通常バトルと同じ atkMotion から決める',
  source.includes('const RPG_MOTION_BY_ATK = Object.freeze({ default:\'Attack\', floatStab:\'Float\', waterBurst:\'Water\', zanCombo:\'Dash\' });')
  && source.includes('RPG_MOTION_BY_ATK[ALL_PLAYER_MONSTERS[monId]?.atkMotion]'));
const atkMotionKinds = [...new Set(Object.values(R.ALL_PLAYER_MONSTERS).map(m => m.atkMotion))];
const motionMap = (source.match(/const RPG_MOTION_BY_ATK = Object\.freeze\(\{([^}]*)\}\)/) || [])[1] || '';
check('本編にある atkMotion がすべて対応表に載っている',
  atkMotionKinds.every(kind => motionMap.includes(`${kind}:`)),
  `本編 ${atkMotionKinds.join(' / ')}`);
// 通常バトルの keyframes は大きな立ち絵向けで移動量が大きい(味方-180px・敵+90px)ので、
// RPG画面の大きさに合わせた縮小版を用意する。味方は上へ、敵は下へ動くのは通常バトルと同じ
const rpgMotionNames = ['rpgAllyAttack', 'rpgAllySpecial', 'rpgAllyFloat', 'rpgAllyWater', 'rpgAllyDash',
  'rpgFoeAttack', 'rpgFoeSpecial', 'rpgFoeFloat', 'rpgFoeWater', 'rpgFoeDash'];
check('RPG画面向けの縮小版モーションがそろっている',
  rpgMotionNames.every(name => source.includes(`@keyframes ${name}{`)), `${rpgMotionNames.length}種`);
check('通常バトルのモーションはそのまま残っている（RPG側が奪っていない）',
  ['attackFly', 'specialLunge', 'floatStabAttack', 'waterBurstAttack', 'zanComboDash', 'enemyAttackFly']
    .every(name => source.includes(`@keyframes ${name} {`) || source.includes(`@keyframes ${name}{`)));
const allyAttackFrames = grab(source, '@keyframes rpgAllyAttack{', '@keyframes rpgAllySpecial{');
const foeAttackFrames = grab(source, '@keyframes rpgFoeAttack{', '@keyframes rpgFoeSpecial{');
check('味方は上へ・敵は下へ動く（通常バトルと同じ向き）',
  /translateY\(-\d+px\)/.test(allyAttackFrames) && !/translateY\(\d\d+px\)/.test(allyAttackFrames)
  && /translateY\(\d+px\)/.test(foeAttackFrames) && !/translateY\(-\d\d+px\)/.test(foeAttackFrames),
  `味方 ${(allyAttackFrames.match(/translateY\((-?\d+)px\)/g) || []).join(' ')} / 敵 ${(foeAttackFrames.match(/translateY\((-?\d+)px\)/g) || []).join(' ')}`);
check('モーションは敵の丸枠と味方の顔アイコンへ当てる',
  rpgUi.includes("const motionOf=(side,index)=>")
  && rpgUi.includes('style={motionOf(\'enemy\',index)}') && rpgUi.includes('style={motionOf(\'ally\',index)}'));
// モーションの対応表は同じ塊の末尾に置いてあるので、そこより前(計算と進行の本体)だけを見る
const rpgEngineSource = grab(rpgSource, 'const RPG_MAX_LEVEL = 50;', '// ---------- RPG戦闘の攻撃モーション(表示だけ) ----------');
check('モーションも戦闘の計算に触らない（表示だけ）',
  !/rpgActing|rpgMotionName|@keyframes|atkMotion/.test(rpgEngineSource)
  && source.includes('const [rpgActing, setRpgActing] = useState(null);'));
check('防御のときはモーションを出さない', source.includes("acted.command !== 'guard'"));

// --- 人数は編成画面のいちばん上でまとめて変える ---
const setupUi = grab(rpgUi, "{gameState==='RPG_DEBUG_SETUP'&&", "{gameState==='RPG_DEBUG_BATTLE'&&");
const countsAt = setupUi.indexOf('mh-rpg-counts');
check('味方・敵の人数を1か所でまとめて変えられる',
  countsAt >= 0 && setupUi.includes('renderCount(rpgPartySize,RPG_MAX_PARTY,setRpgPartySize)')
  && setupUi.includes('renderCount(rpgEnemyCount,RPG_MAX_ENEMIES,setRpgEnemyCount)')
  && (setupUi.match(/renderCount\(/g) || []).length === 2, // 味方1 + 敵1(定義は renderCount= なので数えない)
  `renderCount ${(setupUi.match(/renderCount\(/g) || []).length}か所`);
check('人数はモンスターの詳細カードより前にある（スクロールせずに変えられる）',
  countsAt >= 0 && countsAt < setupUi.indexOf('mh-rpg-card'),
  `人数 ${countsAt} < カード ${setupUi.indexOf('mh-rpg-card')}`);
check('戦闘画面に行動順が出る',
  rpgUi.includes('mh-rpg-order-list') && rpgUi.includes('rpgSpeedOrder(battle)') && rpgUi.includes('battle.plan'));
// 戦闘画面は「能力の表」ではなく「モンスターが戦っている画面」にする。
// 敵は 名前・HPバー・現在HP、味方は 名前・HP・ガッツ が最低限で、素早さ・運は小さく添えるだけ
check('敵は名前とHPバーと現在HPが出る',
  rpgUi.includes('<b>{unit.name}</b>') && rpgUi.includes("bar(unit.hp,unit.maxHp,'hp')")
  && rpgUi.includes('<span className="mh-rpg-foe-hp">{unit.hp} / {unit.maxHp}</span>'));
check('味方は名前・HP・ガッツが出る',
  rpgUi.includes('<small>{unit.hp}/{unit.maxHp}</small>') && rpgUi.includes("bar(unit.guts,unit.maxGuts,'guts')"));
check('素早さ・運は小さく添えるだけで、能力の表にしない',
  (rpgUi.match(/速\{unit\.speed\}/g) || []).length === 1 && (rpgUi.match(/運\{unit\.luck\}/g) || []).length === 1
  && !rpgUi.includes('丈{unit.def}'));
check('結果画面に会心回数・回避回数が出る',
  rpgUi.includes('<span>会心</span>') && rpgUi.includes('<span>回避</span>')
  && rpgUi.includes('{unit.record.crits}') && rpgUi.includes('{unit.record.evaded}'));
check('行動順の表示は折り返して横にはみ出さない',
  /\.mh-rpg-order-list\{[^}]*flex-wrap:wrap/.test(source) && !/\.mh-rpg-order-list\{[^}]*overflow-x/.test(source));

// ================= ④ 通常バトルを変えていない =================
const normalDealt = grab(source, 'const getDmg = useCallback(', '\n  const getAttackPredictedDmg');
const normalTaken = grab(source, 'const getIncomingDamageBeforeTurnReduction = useCallback(', '\n  const applyTurnDamageReduction');
check('通常バトルのダメージ式にRPG側が混ざっていない',
  !/\brpg[A-Z_a-z]/.test(normalDealt) && !/\bRPG_/.test(normalDealt)
  && !/\brpg[A-Z_a-z]/.test(normalTaken) && !/\bRPG_/.test(normalTaken)
  && normalDealt.includes('const distMult = [1.5,1.3,1.1,0.9][distDiff]||1.0;') && normalTaken.includes('Math.max(30,'),
  '与ダメ・被ダメとも既存の式のまま');
check('通常バトルへ素早さ・運を持ち込んでいない',
  !/\bspeed\b|\bluck\b/.test(normalDealt) && !/\bspeed\b|\bluck\b/.test(normalTaken));
check('RPGのダメージ・回避・クリティカルはそれぞれ共通関数1つだけ',
  (source.match(/const rpgDamage = /g) || []).length === 1
  && (source.match(/const rpgEvadeRate = /g) || []).length === 1
  && (source.match(/const rpgCritRate = /g) || []).length === 1
  && (source.match(/const rpgResolveAttack = /g) || []).length === 1
  && (rpgUi.match(/RPG_DEF_COEFF|RPG_EVADE_|RPG_CRIT_/g) || []).length === 0,
  '味方→敵も敵→味方も同じ関数を通る');
const resolveStepBody = rpgSource.slice(rpgSource.indexOf('const rpgResolveStep = '));
check('攻撃の解決は行動順の処理1か所からだけ呼ばれる',
  (rpgSource.match(/rpgResolveAttack\(/g) || []).length === 2
  && (resolveStepBody.match(/rpgResolveAttack\(/g) || []).length === 2,
  '呼び出しは rpgResolveStep の中の通常攻撃1・固有技1だけ');
check('RPGの計算は通常バトルの定数を書き換えていない',
  !/DIFFICULTY_SETTINGS|ENEMY_DATA|BASE_ATK_EVOLUTION|GUARD_EVOLUTION|TEACHING_CARDS/.test(rpgSource));
check('ベースモンの定義そのものを書き換えていない',
  !/ALL_PLAYER_MONSTERS\s*\[[^\]]+\]\s*=|ALL_PLAYER_MONSTERS\.[A-Za-z]+\s*=/.test(rpgSource));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
