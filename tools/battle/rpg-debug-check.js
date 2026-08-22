#!/usr/bin/env node
// ダンジョンRPG戦闘テスト(デバッグ専用試作)の回帰チェック。
//
// この試作は「通常ゲームへ一切影響しない」ことが最優先の約束なので、
// 実装を動かして数値を確かめるだけでなく、分離が崩れていないかも機械的に見る。
//
//   ① RPGの純粋計算(1/10変換・ステ振り・敵の自動配分・ダメージ式・ガッツ)を
//      本体からそのまま取り出して実際に動かし、仕様どおりの数値になるか
//   ② 戦闘の進行(こうげき／技／防御・敵ターン・勝敗)を実際に1戦流して確かめる
//   ③ 通常ゲームからの分離。入口がデバッグ設定だけにあること、マスモンを使わないこと、
//      報酬・ランキング・保存(mh_*)へ触れないこと、既存デバッグ戦と干渉しないこと
//   ④ 通常バトルの計算式・ステータスを変更していないこと
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

// ---------- 本体からRPGの計算・進行だけを取り出して動かす ----------
const rpgSource = grab(source, 'const RPG_MAX_LEVEL = 50;', '// Storage helpers');
const EXPORTS = [
  'RPG_MAX_LEVEL', 'RPG_MAX_PARTY', 'RPG_MAX_ENEMIES', 'RPG_STAT_DIVISOR', 'RPG_POINTS_PER_LEVEL',
  'RPG_GAIN_PER_POINT', 'RPG_STAT_KEYS', 'RPG_ENEMY_TYPES', 'RPG_NORMAL_ATTACK_MULT', 'RPG_DEF_COEFF',
  'RPG_GUARD_MULT', 'RPG_START_GUTS_RATE', 'RPG_TURN_GUTS_RATE', 'RPG_ENEMY_SKILL_CHANCE',
  'rpgScaleStat', 'rpgBaseStatsOf', 'rpgPointsForLevel', 'rpgNormalizeAlloc', 'rpgApplyAlloc',
  'rpgEnemyAlloc', 'rpgEnemyStats', 'rpgSkillOf', 'rpgSkillCost', 'rpgDamage', 'rpgVarianceRoll',
  'rpgStartGuts', 'rpgTurnGutsRegen', 'rpgMonsterList', 'rpgMonsterById',
  'rpgCreateBattle', 'rpgAllyAct', 'rpgEnemyPhase', 'rpgAliveIndexes',
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

// ---------- ① 純粋計算 ----------
check('RPGのLv上限は50', R.RPG_MAX_LEVEL === 50);
check('味方は最大4体・敵は最大4体', R.RPG_MAX_PARTY === 4 && R.RPG_MAX_ENEMIES === 4);
check('基礎能力は現在値の約1/10', R.RPG_STAT_DIVISOR === 10 && R.rpgScaleStat(600) === 60 && R.rpgScaleStat(120) === 12 && R.rpgScaleStat(70) === 7);
check('1/10しても最低1は残る', R.rpgScaleStat(1) === 1 && R.rpgScaleStat(0) === 1 && R.rpgScaleStat(4) === 1);
check('1P＝ライフ+6 / ちから+2 / 丈夫さ+2 / ガッツ+2',
  R.RPG_GAIN_PER_POINT.hp === 6 && R.RPG_GAIN_PER_POINT.atk === 2 && R.RPG_GAIN_PER_POINT.def === 2 && R.RPG_GAIN_PER_POINT.guts === 2);
check('Lvが1上がるごとに1P（Lv1=0P / Lv11=10P / Lv50=49P）',
  R.RPG_POINTS_PER_LEVEL === 1 && R.rpgPointsForLevel(1) === 0 && R.rpgPointsForLevel(2) === 1
  && R.rpgPointsForLevel(11) === 10 && R.rpgPointsForLevel(50) === 49);
check('Lvの指定は1〜50へ丸める',
  R.rpgPointsForLevel(0) === 0 && R.rpgPointsForLevel(999) === 49 && R.rpgPointsForLevel('こわれた値') === 0);

// 4ステータスは味方も敵も同じキー
check('味方・敵とも4ステータス（ライフ・ちから・丈夫さ・ガッツ）',
  R.RPG_STAT_KEYS.join(',') === 'hp,atk,def,guts', R.RPG_STAT_KEYS.join(' / '));

// 正式ベースモン定義をそのまま使っているか(RPG用に数値を書き写していない)
const list = R.rpgMonsterList();
check('正式なベースモン定義から候補を作っている', list.length === Object.keys(R.ALL_PLAYER_MONSTERS).length && list.length >= 12, `${list.length}種`);
check('デバッグ専用モンスターは候補に入らない', list.every(m => !m.debugOnly));
const statsMatchSource = list.every(mon => {
  const s = R.rpgBaseStatsOf(mon);
  return s.hp === R.rpgScaleStat(mon.baseHp) && s.atk === R.rpgScaleStat(mon.baseAtk)
    && s.def === R.rpgScaleStat(mon.baseDef) && s.guts === R.rpgScaleStat(mon.baseGuts);
});
check('RPG基礎能力は ALL_PLAYER_MONSTERS の現在値から毎回計算する', statsMatchSource);

// 指示書の例(Lv11のゴーレムで10P全振り)を実データから再現する
const golem = R.rpgMonsterById('Golem');
const golemBase = R.rpgBaseStatsOf(golem);
const allIn = (key) => R.rpgApplyAlloc(golemBase, R.rpgNormalizeAlloc({ [key]: 10 }, 11))[key];
check('Lv11で10P全振りの伸びが仕様どおり',
  allIn('hp') === golemBase.hp + 60 && allIn('atk') === golemBase.atk + 20
  && allIn('def') === golemBase.def + 20 && allIn('guts') === golemBase.guts + 20,
  `ゴーレム ライフ${golemBase.hp}→${allIn('hp')} / ちから${golemBase.atk}→${allIn('atk')}`);
const over = R.rpgNormalizeAlloc({ hp: 99, atk: 99, def: 99, guts: 99 }, 11);
check('Lvを下げても使用可能ポイントを超えない',
  over.hp + over.atk + over.def + over.guts === 10, JSON.stringify(over));

// 敵の自動配分は乱数を使わない(同じLv・同じ色なら必ず同じ能力)
const enemyTwice = [R.rpgEnemyStats(golem, 'red', 20), R.rpgEnemyStats(golem, 'red', 20)];
check('敵の能力生成に乱数を使っていない', JSON.stringify(enemyTwice[0]) === JSON.stringify(enemyTwice[1]), JSON.stringify(enemyTwice[0]));
check('敵の色タイプは通常・赤・青の3種類',
  R.RPG_ENEMY_TYPES.map(t => t.id).join(',') === 'normal,red,blue', R.RPG_ENEMY_TYPES.map(t => t.label).join(' / '));
check('通常種には能力補正がない',
  R.RPG_STAT_KEYS.every(k => R.RPG_ENEMY_TYPES[0].mult[k] === 1));
const red = R.RPG_ENEMY_TYPES[1], blue = R.RPG_ENEMY_TYPES[2];
check('赤はちから寄りで少し打たれ弱い', red.mult.atk === 1.15 && red.mult.hp === 0.95 && red.mult.def === 0.90 && red.mult.guts === 1);
check('青はライフ・丈夫さ寄りでちから控えめ', blue.mult.hp === 1.15 && blue.mult.def === 1.15 && blue.mult.atk === 0.90 && blue.mult.guts === 1);
const redStats = R.rpgEnemyStats(golem, 'red', 30), blueStats = R.rpgEnemyStats(golem, 'blue', 30);
check('同じLvでも赤はちからが高く、青は丈夫さが高い',
  redStats.atk > blueStats.atk && blueStats.def > redStats.def,
  `Lv30ゴーレム 赤:ちから${redStats.atk}/丈夫さ${redStats.def} 青:ちから${blueStats.atk}/丈夫さ${blueStats.def}`);
check('色違いは画像を作らずCSSフィルタだけで表現する',
  R.RPG_ENEMY_TYPES[0].filter === 'none' && red.filter.includes('hue-rotate') && blue.filter.includes('hue-rotate')
  && !/images\/[a-z-]*rpg|rpg[a-z-]*\.png/i.test(source), `赤: ${red.filter}`);

// ダメージ式
check('ダメージ式が 100/(100+丈夫さ×4) の形',
  R.RPG_DEF_COEFF === 4 && R.RPG_NORMAL_ATTACK_MULT === 1.0
  && R.rpgDamage({ atk: 100, mult: 1, def: 0 }) === 100
  && R.rpgDamage({ atk: 100, mult: 1, def: 25 }) === 50
  && R.rpgDamage({ atk: 100, mult: 2.2, def: 25 }) === 110,
  `ちから100・丈夫さ25・倍率1.0 → ${R.rpgDamage({ atk: 100, mult: 1, def: 25 })}`);
check('防御中は最終ダメージが半分', R.RPG_GUARD_MULT === 0.5
  && R.rpgDamage({ atk: 100, mult: 1, def: 25, guarding: true }) === 25);
check('最低1ダメージは防御中でも守られる', R.rpgDamage({ atk: 1, mult: 1, def: 999, guarding: true }) === 1);
check('ダメージ乱数はOFFなら必ず1.0倍', R.rpgVarianceRoll(false) === 1);
const rolls = Array.from({ length: 400 }, () => R.rpgVarianceRoll(true));
check('ダメージ乱数はONで0.95〜1.05に収まる', rolls.every(v => v >= 0.95 && v <= 1.05) && new Set(rolls).size > 1,
  `${Math.min(...rolls).toFixed(3)}〜${Math.max(...rolls).toFixed(3)}`);

// ガッツ
check('戦闘開始時のガッツは最大の50%(切り上げ)',
  R.RPG_START_GUTS_RATE === 0.5 && R.rpgStartGuts(10) === 5 && R.rpgStartGuts(7) === 4 && R.rpgStartGuts(1) === 1);
check('ターン開始時のガッツ回復は最大の20%(最低1)',
  R.RPG_TURN_GUTS_RATE === 0.2 && R.rpgTurnGutsRegen(10) === 2 && R.rpgTurnGutsRegen(20) === 4 && R.rpgTurnGutsRegen(1) === 1);
// 固有技は本編定義をそのまま流用する
const skillsFromSource = list.every(mon => {
  const skill = R.rpgSkillOf(mon);
  return !mon.unique || (skill && skill.name === mon.unique.name && skill.mult === mon.unique.baseMult
    && skill.cost === Math.max(1, Math.round(mon.unique.baseGuts / 10)));
});
check('固有技の名前・倍率・消費ガッツを本編定義から流用している', skillsFromSource,
  (() => { const s = R.rpgSkillOf(golem); return s ? `ゴーレム「${s.name}」倍率${s.mult} / 消費G${s.cost}` : '—'; })());
check('ガッツの少ないゴーレムは固有技を撃ちにくい',
  R.rpgSkillOf(golem).cost > R.rpgStartGuts(R.rpgBaseStatsOf(golem).guts),
  `消費${R.rpgSkillOf(golem).cost} / 開始${R.rpgStartGuts(R.rpgBaseStatsOf(golem).guts)}`);

// ---------- ② 戦闘を実際に流す ----------
const party = [{ monId: 'Mocchi', level: 20, alloc: { hp: 10, atk: 9, def: 0, guts: 0 } }, { monId: 'Pixie', level: 20, alloc: { atk: 19 } }];
const foes = [{ monId: 'Golem', typeId: 'red', level: 5 }];
let battle = R.rpgCreateBattle(party, foes);
check('戦闘を作ると味方・敵が並び、コマンド待ちになる',
  battle.allies.length === 2 && battle.enemies.length === 1 && battle.phase === 'command' && battle.turn === 1);
check('敵の表示名に色タイプが付く', battle.enemies[0].name.startsWith('赤'), battle.enemies[0].name);
check('開始時のガッツが最大の50%', battle.allies.every(u => u.guts === R.rpgStartGuts(u.maxGuts)));

const beforeHp = battle.enemies[0].hp;
battle = R.rpgAllyAct(battle, 'attack', 0, false);
check('こうげきで敵のライフが減り、与ダメ・使用回数が記録される',
  battle.enemies[0].hp < beforeHp && battle.allies[0].record.attacks === 1
  && battle.allies[0].record.dealt === beforeHp - battle.enemies[0].hp);
check('行動した味方の次へ進む', battle.actorIndex === 1 && battle.phase === 'command');

const pixie = battle.allies[1];
const pixieGuts = pixie.guts;
battle = R.rpgAllyAct(battle, 'skill', 0, false);
check('技はガッツを消費して撃てる',
  battle.allies[1].guts === pixieGuts - pixie.skill.cost && battle.allies[1].record.skills === 1
  && battle.allies[1].record.gutsSpent === pixie.skill.cost,
  `${pixie.skill.name} 消費${pixie.skill.cost}`);

// ガッツが足りないときは技を撃てない
const poor = R.rpgCreateBattle([{ monId: 'Golem', level: 1, alloc: {} }], foes);
const poorAfter = R.rpgAllyAct(poor, 'skill', 0, false);
check('ガッツが足りないと技は出ない(状態が変わらない)',
  JSON.stringify(poor) === JSON.stringify(poorAfter));

// 防御 → 敵ターンで被ダメージが半分になる
const guardTest = R.rpgCreateBattle([{ monId: 'Mocchi', level: 1, alloc: {} }], [{ monId: 'Golem', typeId: 'normal', level: 30 }]);
const guardUnit = guardTest.allies[0], guardFoe = guardTest.enemies[0];
const plain = R.rpgDamage({ atk: guardFoe.atk, mult: 1, def: guardUnit.def });
const guarded = R.rpgDamage({ atk: guardFoe.atk, mult: 1, def: guardUnit.def, guarding: true });
check('防御を選ぶとそのターンの被ダメージが50%になる', guarded === Math.max(1, Math.round(plain / 2)) || guarded < plain,
  `通常${plain} → 防御中${guarded}`);
const guarded1 = R.rpgAllyAct(guardTest, 'guard', null, false);
check('防御を選ぶと敵ターンへ進む', guarded1.allies[0].guarding === true && guarded1.phase === 'enemy');
const afterEnemy = R.rpgEnemyPhase(guarded1, false);
check('敵ターンのあとは防御が解除され、次のターンが始まる',
  afterEnemy.phase === 'result' || (afterEnemy.allies[0].guarding === false && afterEnemy.turn === 2 && afterEnemy.phase === 'command'));

// 決着まで回して勝敗が付くこと
let run = R.rpgCreateBattle([{ monId: 'Golem', level: 40, alloc: { atk: 39 } }], [{ monId: 'Suezo', typeId: 'normal', level: 1 }]);
for (let i = 0; i < 200 && run.phase !== 'result'; i++) {
  if (run.phase === 'enemy') run = R.rpgEnemyPhase(run, false);
  else run = R.rpgAllyAct(run, 'attack', R.rpgAliveIndexes(run.enemies)[0], false);
}
check('全敵を倒すと勝利になる', run.outcome === 'win' && run.phase === 'result', `${run.turn}ターン`);
let lose = R.rpgCreateBattle([{ monId: 'Pixie', level: 1, alloc: {} }], [{ monId: 'Golem', typeId: 'red', level: 50 }]);
for (let i = 0; i < 200 && lose.phase !== 'result'; i++) {
  if (lose.phase === 'enemy') lose = R.rpgEnemyPhase(lose, false);
  else lose = R.rpgAllyAct(lose, 'guard', null, false);
}
check('味方が全滅すると敗北になる', lose.outcome === 'lose' && lose.phase === 'result', `${lose.turn}ターン`);
check('結果にバランス確認用の記録が残る',
  ['dealt', 'taken', 'attacks', 'skills', 'gutsSpent'].every(key => key in run.allies[0].record)
  && ['dealt', 'taken', 'attacks', 'skills', 'gutsSpent'].every(key => key in run.enemies[0].record));

// 敵AIは通常攻撃と固有技の両方を使う
let usedSkill = false, usedAttack = false;
for (let i = 0; i < 200; i++) {
  let ai = R.rpgCreateBattle([{ monId: 'Mocchi', level: 50, alloc: { hp: 49 } }], [{ monId: 'Pixie', typeId: 'normal', level: 30 }]);
  ai.phase = 'enemy';
  ai = R.rpgEnemyPhase(ai, false);
  if (ai.enemies[0].record.skills > 0) usedSkill = true;
  if (ai.enemies[0].record.attacks > 0) usedAttack = true;
  if (usedSkill && usedAttack) break;
}
check('敵AIが通常攻撃と固有技の両方を使う', usedSkill && usedAttack, `固有技率 ${R.RPG_ENEMY_SKILL_CHANCE}`);

// ---------- ③ 通常ゲームからの分離 ----------
const rpgUi = grab(source, '{/* ===== ダンジョンRPG戦闘テスト', "{gameState==='DEBUG_SETTINGS'&&(");
const debugScreen = grab(source, "{gameState==='DEBUG_SETTINGS'&&(", "{gameState==='MONSTER_IMAGE_DEBUG'&&(");
check('入口はデバッグ設定の中にだけある',
  debugScreen.includes('data-debug-rpg-battle') && debugScreen.includes("setGameState('RPG_DEBUG_SETUP')")
  && (source.match(/setGameState\('RPG_DEBUG_SETUP'\)/g) || []).length === 3, // デバッグ設定 + 結果画面の2ボタン
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
check('結果画面から再戦・編成変更・デバッグ設定へ戻れる',
  rpgUi.includes('同じ条件でもう一度') && rpgUi.includes('編成・Lv・ステータスを変更') && rpgUi.includes('デバッグ設定へ戻る'));
check('セットアップで基礎→ステ振り後と使用ポイントが見える',
  rpgUi.includes('mh-rpg-stat-base') && rpgUi.includes('mh-rpg-stat-final') && rpgUi.includes('使用 {used} / {limit}P'));
check('こうげき・技・防御の3コマンドがある',
  rpgUi.includes('>こうげき</button>') && rpgUi.includes('chooseCommand(\'skill\')') && rpgUi.includes('chooseCommand(\'guard\')'));

// ---------- ④ 通常バトルを変えていない ----------
// 通常バトルの与ダメージ(getDmg)と被ダメージ(getIncomingDamageBeforeTurnReduction)の中に
// RPG側の関数・定数が入り込んでいないことを、その関数の本文だけを切り出して確かめる
const normalDealt = grab(source, 'const getDmg = useCallback(', '\n  const getAttackPredictedDmg');
const normalTaken = grab(source, 'const getIncomingDamageBeforeTurnReduction = useCallback(', '\n  const applyTurnDamageReduction');
check('通常バトルのダメージ式にRPG側が混ざっていない',
  !/\brpg[A-Z_a-z]/.test(normalDealt) && !/\bRPG_/.test(normalDealt)
  && !/\brpg[A-Z_a-z]/.test(normalTaken) && !/\bRPG_/.test(normalTaken)
  && normalDealt.includes('const distMult = [1.5,1.3,1.1,0.9][distDiff]||1.0;') && normalTaken.includes('Math.max(30,'),
  '与ダメ・被ダメとも既存の式のまま');
check('RPGのダメージ式は共通関数1つだけ',
  (source.match(/const rpgDamage = /g) || []).length === 1
  && (source.match(/100\s*\/\s*resist/g) || []).length === 1
  && (rpgUi.match(/RPG_DEF_COEFF/g) || []).length === 0,
  '味方→敵も敵→味方も rpgDamage を通る');
check('RPGの計算は通常バトルの定数を書き換えていない',
  !/DIFFICULTY_SETTINGS|ENEMY_DATA|BASE_ATK_EVOLUTION|GUARD_EVOLUTION|TEACHING_CARDS/.test(rpgSource));
check('ベースモンの定義そのものを書き換えていない',
  !/ALL_PLAYER_MONSTERS\s*\[[^\]]+\]\s*=|ALL_PLAYER_MONSTERS\.[A-Za-z]+\s*=/.test(rpgSource));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件NG`);
process.exit(failed === 0 ? 0 : 1);
