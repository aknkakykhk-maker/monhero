const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 新モード(id: tactics)の「1体ぶん」の値と盤面を、本体の純関数をそのまま動かして確かめる。
// 設計の正本: docs/spec/BATTLE_NEW_MODE_PLAN.md
//
//   ① 1体ぶんの値を作れる(ライフ・ちから・丈夫さ・ガッツを個別に持つ)
//   ② 狙われた子だけがライフを減らし、0になったその子だけが倒れる
//   ③ 倒れた子はカードを使えない。戻す手段は2つあり、戻るライフが違う
//   ④ 全員倒れたときだけ全滅
//   ⑤ 敵はライフの少ない子を狙いやすい。全体攻撃と間合い攻撃は狙いを決めない
//   ⑥ 壊れた値が来ても落ちない
//   ⑦ バトル本体へ結線されている(盤面が slots と一緒に動き、予告へ狙いが乗る)
//   ⑧ パーティのライフは盤面の合計。増減が正しく振り分けられる(段階5)
//   ⑩⑪ ガッツも1体ずつ。カードは「使う子」を選び、その子のガッツで払う(段階6)
//   ⑫⑬ ガードは使った子自身を守る。回復カードは使う子へ、倒れた子へ向けると起こす(段階7)
//   ⑭⑮ 画面へ1体ずつの帯を出す(段階8)／合流すると総合力に応じて敵も強くなる(段階9)
//   ⑯ ちから・丈夫さも1体ずつ。攻撃はその子のちから、被弾はその子の丈夫さ(段階10)
//   ⑰ トレーニングを1体ずつ選ぶ。倒れた子はここで起こせる(段階11)
//   ⑱ スコアは式そのままで桁だけ 1/1000 へ縮める(段階12)
//   ⑲ 距離適性も1体ずつ。その子の適性がその子の攻撃に効く
//
// 数式をこのファイルへ書き写すと、本体を変えたときに検査だけ古くなる。
// 計算は必ず本体から切り出した実装をそのまま動かす。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  return source.slice(i, j);
};

// このファイルは純関数だけなので、そのまま切り出して動かせる
const sandbox = { Math, Number, console };
vm.createContext(sandbox);
vm.runInContext(
  slice('const TACTICS_START_GUTS_RATE', '// ==== 画面ライフサイクル')
    + ';globalThis.api={TACTICS_START_GUTS_RATE,'
    + 'createTacticsUnit,normalizeTacticsUnit,applyTacticsDamage,healTacticsUnit,reviveTacticsUnit,'
    + 'payTacticsGuts,recoverTacticsGuts,tacticsAliveSlots,tacticsDownedSlots,isTacticsWipedOut,'
    + 'canTacticsSlotAct,chooseTacticsTarget,withTacticsTarget,tacticsIntentTargets,'
    + 'tacticsTotalHp,tacticsTotalMaxHp,tacticsTotalBaseMaxHp,scaleTacticsUnits,scaleTacticsUnitMaxHp,'
    + 'damageTacticsTargets,healTacticsBoard,rateHealTacticsBoard,rateHealTacticsAt,'
    + 'tacticsMaxDef,selfDamageTacticsBoard,'
    + 'wipeTacticsBoard,tacticsTotalGuts,tacticsTotalBaseMaxGuts,tacticsHasGutsRoom,'
    + 'scaleTacticsUnitMaxGuts,canTacticsSlotPay,payTacticsGutsAt,recoverTacticsGutsBoard,'
    + 'healTacticsAt,recoverTacticsGutsAt,selfDamageTacticsAt,'
    + 'reviveTacticsAt,tacticsEnemyPowerMultiplier,'
    + 'TACTICS_ENEMY_POWER_MAX,applyTacticsTraining,tacticsPartyAtk,'
    + 'tacticsPartyDef,shrinkTacticsScore,TACTICS_SCORE_DIVISOR,'
    + 'splitTacticsGuardedHit,resolveTacticsGuardedHit,tacticsGuardHits,makeCardHalveCounter,'
    + 'regenDownedTacticsBoard,TACTICS_DOWNED_REGEN_RATE,rateHealTacticsBoard,splitTacticsHitAmounts,'
    + 'tacticsJoinWaveRate,addTacticsJoinCatchUp,applyTacticsJoinCatchUp,'
    + 'TACTICS_JOIN_RATE_PER_TURN,TACTICS_JOIN_DIST_BASE_TURNS,tacticsJoinDistWaveRate,'
    + 'addTacticsJoinDistCatchUp,tacticsJoinDistBonus,applyTacticsJoinDistBonus,'
    + 'isSameTacticsUnit,tacticsJoinedSlots};', sandbox);
const api = sandbox.api;
// ★合計へみゅあ補正を掛ける式は本体から切り出して動かす(検査へ書き写さない)。
//   1体ずつは floor(素の上限×補正)、合計は floor(素の上限の合計×補正) なので、
//   全員満タンでも「合計 < 上限」になることがある。㉔でそれを実際に出す
vm.runInContext(slice('const resolveEffectiveMaxStat', '\n')
  + ';globalThis.resolveEffectiveMaxStat=resolveEffectiveMaxStat;', sandbox);
// 間合いのボーナスの換算率も本体から切り出す(検査へ 0.001/100 を書き写さない)
vm.runInContext(slice('const DIST_BONUS_PER_DAMAGE', '\n')
  + ';globalThis.DIST_BONUS_PER_DAMAGE=DIST_BONUS_PER_DAMAGE;', sandbox);

// モンスター1体ぶんの入力。マスモンなら育成済みの値が baseHp などに入っている
const mon = (over = {}) => ({ id: 'Mocchi', name: 'モッチー', baseHp: 600, baseAtk: 120, baseDef: 120, baseGuts: 100, ...over });

// --- ① 1体ぶんの値を作る ---
const unit = api.createTacticsUnit(mon());
check('1体ぶんの値を作れる',
  unit.maxHp === 600 && unit.hp === 600 && unit.atk === 120 && unit.def === 120 && unit.maxGuts === 100,
  `HP${unit.hp}/${unit.maxHp} 力${unit.atk} 防${unit.def} G${unit.guts}/${unit.maxGuts}`);
check('ガッツは最大の半分から始まる', unit.guts === Math.floor(100 * api.TACTICS_START_GUTS_RATE), `${unit.guts}`);
check('満タンで始めることもできる', api.createTacticsUnit(mon(), { fullGuts: true }).guts === 100);
check('作った直後は倒れていない', unit.downed === false);
check('モンスターがいなければ null', api.createTacticsUnit(null) === null);
// 合算しないことの確認。2体作っても互いの値に影響しない
const a = api.createTacticsUnit(mon());
const b = api.createTacticsUnit(mon({ id: 'Golem', baseHp: 900, baseAtk: 80 }));
check('2体目を作っても1体目の値は変わらない（合算しない）',
  a.maxHp === 600 && b.maxHp === 900 && a.atk === 120 && b.atk === 80,
  `${a.maxHp}/${a.atk} と ${b.maxHp}/${b.atk}`);

// --- ② ダメージと戦闘不能 ---
const hit = api.applyTacticsDamage(unit, 100);
check('ダメージはその子のライフだけ減らす', hit.hp === 500 && hit.downed === false, `${hit.hp}`);
const downed = api.applyTacticsDamage(unit, 9999);
check('ライフが0になったら倒れる', downed.hp === 0 && downed.downed === true);
check('倒れた子へさらに当たっても何も起きない', api.applyTacticsDamage(downed, 100).hp === 0);
check('元の値を書き換えない（新しい値を返す）', unit.hp === 600, `元のHP ${unit.hp}`);
check('回復はライフを超えない', api.healTacticsUnit(hit, 9999).hp === 600);
// --- ③ 倒れた子は「ライフが全快になってはじめて復活」(2026-09-19 ユーザーが決めた形) ---
// ★倒れたあともライフは回復で貯まる。途中では立たない
const healingDowned = api.healTacticsUnit(downed, 500);
check('倒れた子にも回復は入る', healingDowned.hp === 500, `${healingDowned.hp}/600`);
check('全快の手前では立たない', healingDowned.downed === true);
check('全快になったら立ち上がる', api.healTacticsUnit(healingDowned, 100).downed === false);
check('全快を超えて回復しても上限どまり', api.healTacticsUnit(downed, 9999).hp === 600);
// トレーニングの「起こす」は、中身は「上限まで回復する」
check('起こすと全快で立ち上がる',
  api.reviveTacticsUnit(downed).hp === 600 && api.reviveTacticsUnit(downed).downed === false);
check('立っている子に起こす操作をしても何も起きない', api.reviveTacticsUnit(unit).hp === 600);

// --- ガッツは個別。足りなければ払えない ---
const paid = api.payTacticsGuts(unit, 20);
check('ガッツを払える', paid.payable === true && paid.unit.guts === unit.guts - 20, `${paid.unit.guts}`);
check('足りなければ払えず、値も変わらない',
  api.payTacticsGuts(unit, 9999).payable === false && api.payTacticsGuts(unit, 9999).unit.guts === unit.guts);
check('倒れた子はガッツを払えない', api.payTacticsGuts(downed, 0).payable === false);
check('ガッツの回復は最大を超えない', api.recoverTacticsGuts(unit, 9999).guts === 100);

// --- ④ 盤面と全滅 ---
const board = [api.createTacticsUnit(mon()), null, api.createTacticsUnit(mon({ id: 'Golem' })), null];
check('生きているスロットを数えられる', api.tacticsAliveSlots(board).join(',') === '0,2', api.tacticsAliveSlots(board).join(','));
const boardOneDown = [api.applyTacticsDamage(board[0], 9999), null, board[2], null];
check('倒れた子は生存から外れる', api.tacticsAliveSlots(boardOneDown).join(',') === '2');
check('倒れた子のスロットは空かない', api.tacticsDownedSlots(boardOneDown).join(',') === '0');
check('1体でも生きていれば全滅ではない', api.isTacticsWipedOut(boardOneDown) === false);
const allDown = boardOneDown.map(u => (u ? api.applyTacticsDamage(u, 9999) : null));
check('全員倒れたら全滅', api.isTacticsWipedOut(allDown) === true);
check('誰も置いていない盤面は全滅にしない', api.isTacticsWipedOut([null, null, null, null]) === false);
check('倒れた子のカードは選べない',
  api.canTacticsSlotAct(boardOneDown, 0) === false && api.canTacticsSlotAct(boardOneDown, 2) === true);
check('空きスロットのカードも選べない', api.canTacticsSlotAct(board, 1) === false);

// --- ⑤ 敵の狙い ---
// 生きている子からしか選ばない
const picks = new Set();
for (let i = 0; i < 200; i++) picks.add(api.chooseTacticsTarget(boardOneDown, () => i / 200));
check('倒れた子は狙われない', [...picks].every(index => index === 2), [...picks].join(','));
check('誰も生きていなければ狙いは決まらない', api.chooseTacticsTarget(allDown, () => 0) === null);
// ライフの少ない子を狙いやすい(重み付け)。偏りを0にすると一様になる
const hurt = [api.applyTacticsDamage(board[0], 540), null, board[2], null]; // 0番は残り10%
const countLow = (bias) => {
  let low = 0;
  for (let i = 0; i < 1000; i++) if (api.chooseTacticsTarget(hurt, () => i / 1000, bias) === 0) low++;
  return low;
};
check('ライフの少ない子を狙いやすい', countLow() > 500, `1000回中 ${countLow()}回`);
check('偏りを0にすると一様になる', Math.abs(countLow(0) - 500) <= 5, `1000回中 ${countLow(0)}回`);

// --- 予告へ狙いを足す ---
const attack = { type: 'ATTACK', value: 100 };
check('攻撃の予告には狙いが付く', Number.isInteger(api.withTacticsTarget(attack, board, () => 0).targetSlot));
check('ためる・移動には狙いを付けない',
  api.withTacticsTarget({ type: 'CHARGE' }, board, () => 0).targetSlot === undefined
    && api.withTacticsTarget({ type: 'MOVE', targetDist: 1 }, board, () => 0).targetSlot === undefined);
check('全体攻撃は狙いを決めない', api.withTacticsTarget({ type: 'ATTACK', targetsAll: true }, board, () => 0).targetSlot === undefined);
// 予告の吹き出しへ出す呼び名。ここが空だと「誰を狙うか」が画面に出ない
check('狙った子の名前を予告へ持ち歩く',
  api.withTacticsTarget(attack, board, () => 0).targetName === 'モッチー',
  String(api.withTacticsTarget(attack, board, () => 0).targetName));
check('全体攻撃は「全員」と出す',
  api.withTacticsTarget({ type: 'ATTACK', targetsAll: true }, board, () => 0).targetName === '全員');
check('名前が無い子でも呼び名が空にならない',
  !!api.withTacticsTarget(attack, [api.createTacticsUnit({ id: 'X', baseHp: 10 }), null, null, null], () => 0).targetName);
check('間合い攻撃は狙いを決めない（間合いで当たる相手が決まる）',
  api.withTacticsTarget({ type: 'ATTACK', variant: 'sweep', sweepDist: 2 }, board, () => 0).targetSlot === undefined);

// --- 実際に当たる相手 ---
check('単体狙いは1体だけに当たる',
  api.tacticsIntentTargets({ type: 'ATTACK', targetSlot: 2 }, board).join(',') === '2');
check('全体攻撃は生きている全員に当たる',
  api.tacticsIntentTargets({ type: 'ATTACK', targetsAll: true }, boardOneDown).join(',') === '2');
check('間合い攻撃はその間合いにいる子へ当たる',
  api.tacticsIntentTargets({ type: 'ATTACK', variant: 'sweep', sweepDist: 2 }, board, 2).join(',') === '2');
check('間合い攻撃は間合いをずらせば誰にも当たらない',
  api.tacticsIntentTargets({ type: 'ATTACK', variant: 'sweep', sweepDist: 2 }, board, 1).length === 0);
check('倒れた子は狙いに残っていても当たらない',
  api.tacticsIntentTargets({ type: 'ATTACK', targetSlot: 0 }, boardOneDown).length === 0);

// --- ⑥ 壊れた値でも落ちない ---
check('壊れた値を渡しても落ちない', (() => {
  const broken = api.normalizeTacticsUnit({ hp: 'x', maxHp: null, atk: NaN, def: -5, guts: 999, maxGuts: 10 });
  return broken.hp === 0 && broken.maxHp === 1 && broken.atk === 0 && broken.def === 0
    && broken.guts === 10 && broken.downed === true;
})());
check('ライフ0なのに立っている状態を作らない',
  api.normalizeTacticsUnit({ hp: 0, maxHp: 100, downed: false }).downed === true);
// ★「ライフがあるのに倒れている」は**作ってよい**。全快までの貯めがその状態
check('全快の手前ではライフがあっても倒れたまま',
  api.normalizeTacticsUnit({ hp: 50, maxHp: 100, downed: true }).downed === true);
check('全快なら必ず立っている',
  api.normalizeTacticsUnit({ hp: 100, maxHp: 100, downed: true }).downed === false);
check('unitでないものは null', api.normalizeTacticsUnit(null) === null && api.normalizeTacticsUnit('x') === null);
check('盤面が配列でなくても落ちない',
  api.tacticsAliveSlots(null).length === 0 && api.isTacticsWipedOut(undefined) === false);

// --- ⑧ 盤面の合計と、ライフの振り分け(段階5) ---
// ★ここが崩れると「合計は残っているのに全員倒れている」「誰も倒れていないのに敗北」になる
const makeBoard = (...mons) => {
  const units = [null, null, null, null];
  mons.forEach(([index, over]) => { units[index] = api.createTacticsUnit(mon(over)); });
  return units;
};
const pair = makeBoard([0, {}], [2, { id: 'Golem', name: 'ゴーレム', baseHp: 400 }]);
check('合計ライフは1体ずつの足し算', api.tacticsTotalHp(pair) === 1000, String(api.tacticsTotalHp(pair)));
check('合計の上限も1体ずつの足し算', api.tacticsTotalMaxHp(pair) === 1000);
check('素の上限の合計を別に取れる', api.tacticsTotalBaseMaxHp(pair) === 1000);
check('空の盤面は合計0', api.tacticsTotalHp([null, null, null, null]) === 0 && api.tacticsTotalHp(null) === 0);

// 狙われた子だけが減る
const hitOne = api.damageTacticsTargets(pair, [0], 100);
check('狙われた子だけが減る', api.tacticsTotalHp(hitOne) === 900 && hitOne[0].hp === 500 && hitOne[2].hp === 400,
  `${hitOne[0].hp} / ${hitOne[2].hp}`);
const hitAll = api.damageTacticsTargets(pair, [0, 2], 100);
check('全体攻撃は立っている全員が減る', hitAll[0].hp === 500 && hitAll[2].hp === 300);
check('誰にも当たらない行動では減らない', api.tacticsTotalHp(api.damageTacticsTargets(pair, [], 100)) === 1000);
const downOne = api.damageTacticsTargets(pair, [2], 9999);
check('0になった子だけが倒れる', downOne[2].downed === true && downOne[0].downed === false);
check('1体倒れただけでは全滅ではない', api.isTacticsWipedOut(downOne) === false);
check('倒れた子のぶんは合計から消える', api.tacticsTotalHp(downOne) === 600, String(api.tacticsTotalHp(downOne)));
check('全員倒れたら合計0＝敗北', api.tacticsTotalHp(api.wipeTacticsBoard(pair)) === 0
  && api.isTacticsWipedOut(api.wipeTacticsBoard(pair)) === true);

// 回復は立っている子へ配る
const damagedBoard = api.damageTacticsTargets(api.damageTacticsTargets(pair, [0], 300), [2], 100);
const healedBoard = api.healTacticsBoard(damagedBoard, 200);
check('回復は足りない量の多い子から配る', healedBoard[0].hp > damagedBoard[0].hp && api.tacticsTotalHp(healedBoard) === api.tacticsTotalHp(damagedBoard) + 200,
  `${damagedBoard[0].hp}→${healedBoard[0].hp} / ${damagedBoard[2].hp}→${healedBoard[2].hp}`);
check('上限を超えて回復しない', api.tacticsTotalHp(api.healTacticsBoard(damagedBoard, 99999)) === api.tacticsTotalMaxHp(damagedBoard));
// ★自動再生・緊急回復も「復活までの貯め」に乗る(2026-09-19 ユーザーが決めた形)
check('倒れた子にも配る(オート回復も乗る)', (() => {
  const board = api.damageTacticsTargets(pair, [2], 9999);
  const after = api.healTacticsBoard(api.damageTacticsTargets(board, [0], 200), 200);
  return after[2].hp > 0 && after[2].downed === true;
})());
check('配り切っても全快でなければ立たない', (() => {
  const board = api.damageTacticsTargets(pair, [2], 9999);
  return api.healTacticsBoard(board, 100)[2].downed === true;
})());
check('配ったぶんで全快になれば立ち上がる', (() => {
  const board = api.damageTacticsTargets(pair, [2], 9999);
  return api.healTacticsBoard(board, 9999)[2].downed === false;
})());
// ★合計ライフへ数えるのは立っている子だけ。数えると「全員倒れているのに敗北しない」が起きる
check('倒れた子のライフは合計へ数えない', (() => {
  const board = api.healTacticsBoard(api.damageTacticsTargets(pair, [2], 9999), 100);
  return api.tacticsTotalHp(board) === 600 && board[2].hp > 0;
})());
check('全員倒れていれば合計は0', (() => {
  const board = api.healTacticsBoard(api.wipeTacticsBoard(pair), 100);
  return api.tacticsTotalHp(board) === 0 && api.isTacticsWipedOut(board) === true;
})());
// --- 回復はすべて「その子の上限 × 率」で1体ずつ(2026-09-20 ユーザー指摘) ---
// ★合計の上限から量を出して配る形だと、1体だけ傷ついているときに
//   パーティ全員ぶんがその子へ丸ごと入り、倒れている子が多いほど残った子がよけいに回復する
// pair は 0番が600(ガッツ100)・2番が400(ガッツ100)
check('回復はその子の上限の率だけ入る', (() => {
  const board = api.damageTacticsTargets(api.damageTacticsTargets(pair, [0], 300), [2], 300);
  const res = api.rateHealTacticsBoard(board, 0.1, 0);
  // 0番は600の10%＝60、2番は400の10%＝40。合計の10%(100)を配るのとは違う
  return res.units[0].hp === 360 && res.units[2].hp === 140 && res.hp === 100;
})(), JSON.stringify(api.rateHealTacticsBoard(api.damageTacticsTargets(api.damageTacticsTargets(pair, [0], 300), [2], 300), 0.1, 0).units.map(u => u && u.hp)));
check('倒れている子がいても、残った子の回復量は変わらない', (() => {
  // 2番を倒しても、0番が受け取るのは自分の上限の10%(60)のまま
  const board = api.damageTacticsTargets(api.damageTacticsTargets(pair, [2], 9999), [0], 300);
  const res = api.rateHealTacticsBoard(board, 0.1, 0);
  return res.units[0].hp === 360 && res.hp === 60;
})(), JSON.stringify(api.rateHealTacticsBoard(api.damageTacticsTargets(api.damageTacticsTargets(pair, [2], 9999), [0], 300), 0.1, 0).hp));
// 自動再生(includeDowned なし)は倒れた子へ入れない
check('自動再生は倒れた子のライフを貯めない', (() => {
  const board = api.damageTacticsTargets(pair, [2], 9999);
  const res = api.rateHealTacticsBoard(board, 1, 1);
  return res.units[2].hp === 0 && res.units[2].downed === true;
})());
check('全員倒れていれば自動再生では誰も起きない', (() => {
  const res = api.rateHealTacticsBoard(api.wipeTacticsBoard(pair), 1, 1);
  return api.isTacticsWipedOut(res.units) === true && res.hp === 0;
})());
// 回復カード・緊急回復(includeDowned あり)は倒れた子にも入り、全快で立つ
check('回復カード・緊急回復は倒れた子にも入る', (() => {
  const board = api.damageTacticsTargets(pair, [2], 9999);
  const res = api.rateHealTacticsBoard(board, 0.5, 0, true);
  // 2番は400の50%＝200ぶん貯まるが、全快ではないのでまだ倒れたまま
  return res.units[2].hp === 200 && res.units[2].downed === true;
})(), JSON.stringify(api.rateHealTacticsBoard(api.damageTacticsTargets(pair, [2], 9999), 0.5, 0, true).units.map(u => u && u.hp)));
check('倒れた子も全快まで入れば立ち上がる', (() => {
  const res = api.rateHealTacticsBoard(api.damageTacticsTargets(pair, [2], 9999), 1, 0, true);
  return res.units[2].hp === 400 && res.units[2].downed === false;
})());
check('倒れた子にガッツは入れない(カードを使えないので)', (() => {
  const board = api.payTacticsGutsAt(api.damageTacticsTargets(pair, [2], 9999), 2, 0).units;
  const res = api.rateHealTacticsBoard(board, 0, 1, true);
  return res.units[2].guts === 50;
})(), JSON.stringify(api.rateHealTacticsBoard(api.damageTacticsTargets(pair, [2], 9999), 0, 1, true).units.map(u => u && u.guts)));
check('上限で頭打ちになったぶんは数えない', (() => {
  // 満タンの盤面へ回しても、入った量は0
  const res = api.rateHealTacticsBoard(pair, 0.5, 0);
  return res.hp === 0 && api.tacticsTotalHp(res.units) === 1000;
})());
check('ガッツも1体ずつその子の上限の率で戻る', (() => {
  const board = api.payTacticsGutsAt(api.payTacticsGutsAt(pair, 0, 40).units, 2, 40).units;
  const res = api.rateHealTacticsBoard(board, 0, 0.1);
  // どちらもガッツ上限100なので10ずつ
  return res.units[0].guts === 20 && res.units[2].guts === 20 && res.guts === 20;
})(), JSON.stringify(api.rateHealTacticsBoard(api.payTacticsGutsAt(api.payTacticsGutsAt(pair, 0, 40).units, 2, 40).units, 0, 0.1).units.map(u => u && u.guts)));
// 固有技など「使った子」だけへ入るもの
check('1体だけの回復もその子の上限の率', (() => {
  const board = api.payTacticsGutsAt(api.payTacticsGutsAt(pair, 0, 40).units, 2, 40).units;
  const res = api.rateHealTacticsAt(board, 0, 0, 0.5);
  // 0番だけ上限100の50%＝50戻る(10→60)。2番は触らない
  return res.units[0].guts === 60 && res.units[2].guts === 10 && res.guts === 50;
})(), JSON.stringify(api.rateHealTacticsAt(api.payTacticsGutsAt(api.payTacticsGutsAt(pair, 0, 40).units, 2, 40).units, 0, 0, 0.5).units.map(u => u && u.guts)));
check('空きスロットへ回しても落ちない',
  api.rateHealTacticsAt(pair, 1, 1, 1).hp === 0);
// ガード段階は「いちばん硬い子」(2026-09-20 ユーザー指示)
check('ガード段階はいちばん硬い子の丈夫さで決める', (() => {
  const board = api.makeBoardForDef
    ? null
    : [api.createTacticsUnit({ id: 'a', name: 'a', baseHp: 500, baseAtk: 100, baseDef: 120, baseGuts: 100 }),
       null,
       api.createTacticsUnit({ id: 'b', name: 'b', baseHp: 500, baseAtk: 100, baseDef: 380, baseGuts: 100 }), null];
  // 平均は250だがいちばん硬いのは380
  return api.tacticsMaxDef(board) === 380 && api.tacticsPartyDef(board) === 250;
})());
// ★回復カード・緊急回復・吸収は今までどおり倒れた子にも入る
check('全体回復は倒れた子にも入ったまま', (() => {
  const board = api.damageTacticsTargets(pair, [2], 9999);
  return api.healTacticsBoard(board, 9999)[2].downed === false;
})());

check('満タンの盤面へ回復しても増えない', api.tacticsTotalHp(api.healTacticsBoard(pair, 500)) === 1000);
// 全員倒れていても、貯めには入る(ただし合計は0のままなので敗北は動かない)
check('全員倒れていても合計は0のまま',
  api.tacticsTotalHp(api.healTacticsBoard(api.wipeTacticsBoard(pair), 500)) === 0);

// 自傷では倒れない
const selfHurt = api.selfDamageTacticsBoard(pair, 99999);
check('自傷では誰も倒れない', selfHurt.filter(Boolean).every(u => u.hp >= 1 && u.downed === false),
  selfHurt.filter(Boolean).map(u => u.hp).join(','));
check('自傷は立っている子へ配る', api.tacticsTotalHp(api.selfDamageTacticsBoard(pair, 200)) === 800);

// みゅあ補正は1体ずつの上限へ効かせる
const scaledBoard = api.scaleTacticsUnits(pair, 0.1);
check('上限の倍率は1体ずつへ効く', scaledBoard[0].maxHp === 660 && scaledBoard[2].maxHp === 440,
  `${scaledBoard[0].maxHp} / ${scaledBoard[2].maxHp}`);
check('素の上限は残る(倍率が戻れば元に戻る)',
  api.scaleTacticsUnits(scaledBoard, 0).map(u => (u ? u.maxHp : 0)).join(',') === '600,0,400,0');
check('倍率を上げても現在のライフは増えない', scaledBoard[0].hp === 600);

// トレーニングで伸びた上限は、配ったぶんの合計が必ず一致する
check('1体もいない盤面でも落ちない',
  api.tacticsTotalHp(api.selfDamageTacticsBoard(null, 10)) === 0
    && api.tacticsPartyAtk(null) === 0);

// 本体のソースを直に見る検査で使う
const has = (needle) => source.includes(needle);

// --- ⑩ ガッツを1体ずつ持つ(段階6) ---
// ★カードを使うのは「選んだその子」で、払うのもその子のガッツ。
//   合計で足りていても、その子が足りなければ使えない。ここが新モードの手ざわりの中心
check('ガッツの合計も1体ずつの足し算', api.tacticsTotalGuts(pair) === 100 && api.tacticsTotalBaseMaxGuts(pair) === 200,
  `いま${api.tacticsTotalGuts(pair)} / 上限${api.tacticsTotalBaseMaxGuts(pair)}`);
check('ガッツは最大の半分から始まる', pair[0].guts === 50 && pair[0].maxGuts === 100);
check('ガッツの上限の倍率も1体ずつへ効く', api.scaleTacticsUnitMaxGuts(pair[0], 0.2).maxGuts === 120);
check('その子が払えるかで決まる',
  api.canTacticsSlotPay(pair, 0, 50) === true && api.canTacticsSlotPay(pair, 0, 51) === false);
// ★合計では足りていても、その子が足りなければ使えない
check('合計で足りていても、その子が足りなければ払えない',
  api.tacticsTotalGuts(pair) === 100 && api.canTacticsSlotPay(pair, 0, 80) === false);
check('倒れた子は払えない',
  api.canTacticsSlotPay(api.damageTacticsTargets(pair, [0], 9999), 0, 0) === false);
check('空のスロットは払えない', api.canTacticsSlotPay(pair, 1, 0) === false);
const gutsPaid = api.payTacticsGutsAt(pair, 0, 30);
check('払うとその子のガッツだけ減る',
  gutsPaid.payable === true && gutsPaid.units[0].guts === 20 && gutsPaid.units[2].guts === 50,
  `${gutsPaid.units[0].guts} / ${gutsPaid.units[2].guts}`);
check('払えないときは盤面を変えない', (() => {
  const failed = api.payTacticsGutsAt(pair, 0, 999);
  return failed.payable === false && api.tacticsTotalGuts(failed.units) === 100;
})());
const gutsHealed = api.recoverTacticsGutsBoard(gutsPaid.units, 20);
check('ガッツの回復も立っている子へ配る',
  api.tacticsTotalGuts(gutsHealed) === api.tacticsTotalGuts(gutsPaid.units) + 20 && gutsHealed[0].guts > gutsPaid.units[0].guts,
  `${gutsPaid.units[0].guts}→${gutsHealed[0].guts}`);
check('ガッツも上限を超えない', api.tacticsTotalGuts(api.recoverTacticsGutsBoard(pair, 9999)) === api.tacticsTotalMaxHp(pair) - api.tacticsTotalMaxHp(pair) + 200,
  String(api.tacticsTotalGuts(api.recoverTacticsGutsBoard(pair, 9999))));
check('倒れた子のガッツは回復しない', (() => {
  const board = api.damageTacticsTargets(pair, [2], 9999);
  const after = api.recoverTacticsGutsBoard(api.payTacticsGutsAt(board, 0, 40).units, 999);
  return after[2].guts === 50 && after[0].guts === 100;
})());

// --- ⑪ カードの払い主を選ぶ結線(段階6) ---
check('新モードはどのカードも使う子を選ぶ', has('if(isTacticsMode(runMode)) return true;')
  && has('// 新モードはどのカードも「使う子」を選ぶ。その子のガッツで払い、効果もその子に乗る'));
check('割り当てられる子は「その子が払えるか」で決まる',
  has('const tacticsUsableSlots = (card, excludeHandIndex = null) => {')
    && has('if(!canTacticsSlotPay(tacticsUnitsRef.current,slotIdx,(spent[slotIdx]||0)+getCardGuts(card,slotIdx))) return;'));
// ★回復カードも「全体回復」なので、倒れた子へ向ける必要はない。
//   どのカードも「立っていて、その子が払えるか」だけで決まる
check('払い主に特別扱いは無い', !has('tacticsPayerSlot') && !has('tacticsReviveHelper'));
// ★「1体につき何枚まで」(slotMaxUses)は**アシストカード以外のすべて**に効く
//   (2026-09-21 ユーザー指摘「パンドラに2枚カード使えるのはおかしい」)。
//   攻撃カードだけ数えていたころは、守り・回復を何枚でも同じ子へ置けてしまい、
//   👑(ハム・剣士モッチー)を持たない子にも2枚目が乗っていた。
// ★全体の枚数(baseCardLimit)は「立っている人数＋👑」で決まるので、1体1枚に絞っても
//   配り切れる。WAVE1で使える枚数も減らない(盤面1体なら全体も1枚)
check('枚数制限はアシスト以外のすべてに効く',
  has('if(!isAssistCard(card)&&(used[slotIdx]||0)>=slotMaxUses(mon,slotIdx)) return;')
    && has('if(!isAssistCard(assigned)) used[slotIdx]=(used[slotIdx]||0)+1;'));
// ★攻撃だけ数える書き方が戻っていないか。戻ると、守りと回復がまた数え落ちる
check('攻撃カードだけ数える書き方が残っていない', !has('attacks[slotIdx]'));
// ★「なぜ使えないか」を出すほうも同じ数え方にする。ずれると、置けないのに理由が出ない
check('使えない理由も同じ数え方で出す',
  (s => (s.match(/if\(!isAssistCard\(assigned\)\) used\[slotIdx\]=\(used\[slotIdx\]\|\|0\)\+1;/g) || []).length >= 2)(source));
check('使える子が1体だけなら選ぶ手間を省く',
  has('if(tacticsMode&&usable.length===1){ setCardAssignments(p=>({...p,[i]:usable[0]})); }'));
check('ドラッグでの割り当ても同じ判定を通す',
  has('if(tacticsMode && !tacticsUsableSlots(c,cardIndex).includes(slotIdx)){ setFocusedCard(null); return; }'));
// ★ここを通さないと、払えない組み合わせでカードだけ切れてしまう
check('実行の前に「使う子が払えるか」を見る',
  has('return canTacticsSlotPay(tacticsUnitsRef.current,idx,spentBySlot[idx]);'));
check('払うのは使う子',
  has('if(isTacticsMode(runMode)) tacticsPayGuts(slotIdx,cardCost);'));
check('ガッツの回復は1か所(gainGuts)へまとめる',
  has('const gainGuts = (amount) => {')
    && (source.match(/gainGuts(At|ByRate)?\(/g) || []).length >= 11,
  `gainGuts / gainGutsAt / gainGutsByRate を呼ぶ場所 ${(source.match(/gainGuts(At|ByRate)?\(/g) || []).length}か所`);
// カードで増えるガッツの行き先(段階7 → 2026-09-21に整理し直した)。
// ★量はどちらも「その子の上限 × 率」。違うのは**誰に入るか**。
// ★**回復カード(助手の教え)は全体へ**。使う子を選ぶのはガッツを払うためだけで、
//   効くのは盤面ぜんぶ(2026-09-19 ユーザーの整理)。ライフはそうなっていたのに
//   ガッツだけ「使った子」へ入れていた
//   (2026-09-21 ユーザー指摘「みゅあの回復は全体なのに1体にしかきいてなかった」)。
// ★「その子だけ」へ入るのは2つ。固有技(スエゾー＝そのモンスターの技)と、
//   氷海の支配者(持っている子だけ・仕様 4.9)
check('ガッツを増やすものは、行き先を名指しで渡す', has('const gainGutsAt = (slotIdx, amount) => {')
  && has('const gainGutsByRate = (slotIdx, rate) => {')
  && has('const gainGutsByRateAll = (rate) => {')
  && (source.match(/gainGutsByRate\(slotIdx,/g) || []).length === 2
  && (source.match(/gainGutsByRateAll\(/g) || []).length === 3
  && (source.match(/gainGutsAt\(slotIdx,/g) || []).length === 2,
  `その子だけ ${(source.match(/gainGutsByRate\(slotIdx,/g) || []).length}か所 / 全体 ${(source.match(/gainGutsByRateAll\(/g) || []).length}か所 / 固定量 ${(source.match(/gainGutsAt\(slotIdx,/g) || []).length}か所`);
// 氷海ぶんは全員へ配る率に混ぜず、持っている子へだけ足す(混ぜると誰か1人の特性で全員が得をする)
check('氷海ぶんは持っている子へだけ足す',
  has('const extra=iceExtraRateAt(slotIdx);')
    && has('if (extra>0) gutsRegen+=gainGutsByRate(slotIdx,extra);'));
// AUTO。倒れた子を空スロットとして渡し、ガッツは1体ずつ見る
check('オートは倒れた子を選ばない',
  has('? slots.map((mon,idx)=>(canTacticsSlotAct(tacticsUnitsRef.current,idx)?mon:null))'));
check('オートも1体ずつのガッツで選ぶ',
  has('gutsForSlot:(slotIdx)=>(tacticsUnitsRef.current[slotIdx]?.guts||0),'));
// ★新モードは cardNeedsMonster がどのカードでも true になる。
//   isAttackCardFn を渡さないと「守りだけのターン」を防ぐ仕掛けが効かなくなる
check('オートへ攻撃カードの見分け方を渡す', has('isAttackCardFn:isAttackCard,'));

// --- ⑦ バトル本体への結線 ---
// 純関数だけ足して結線を忘れると、盤面がいつまでも空のまま「狙いなし」で予告が出る。
// 例外は出ず画面も壊れないので、遊んで気付けない
check('盤面は slots と同じ入口で動かす',
  has('const applySlots = (nextSlots, mode = runMode) => {')
    && has('    syncTacticsUnits(nextSlots, mode);'));
// ★バトルを始める処理の中では runMode(state)がまだ前のモードのまま。
//   ここでモードを渡し忘れると、1戦目だけ盤面がライフに反映されない
check('バトル開始時は runMode ではなく決まったモードを渡す',
  has('applySlots(initialSlots, resolved.runMode);'));
// ★画面へ setSlots を直に渡すと、そこだけ applySlots を通らず盤面が古いまま残る
//   (勇者モンを選び直す画面で実際に通っていた。2026-09-19)
check('画面へ渡すのも applySlots', has('setSlots={applySlots}'));
check('編成スロットを applySlots 以外から書き換えていない',
  (source.match(/setSlots\(/g) || []).length === 2,
  `setSlots を呼ぶ場所 ${(source.match(/setSlots\(/g) || []).length}か所`
  + '(applySlots の中と、applySlots を受け取った画面の1か所だけ)');
// ★すでに居る子のライフを持ち越さないと、供モンが合流した瞬間に全員が満タンへ戻る
// ★同じかどうかの判定は isSameTacticsUnit ひとつだけ(㉚)。盤面を作り直す側と、
//   あとから入った枠を数える側が別々の判定を持つと「入れ替えたのに追いつかない」になる
check('合流しても、すでに居る子の現在値を作り直さない',
  has('const isSame = (mon, index) => isSameTacticsUnit(before[index], mon);')
    && has('if (isSame(mon, index)) return before[index];'));
// --- ㉓ あとから入った子の追いつき補正(2026-09-20 ユーザー指示) ---
// ★加入ボーナス(plusStats)は使わず素のステータスをそのまま入れるが、
//   勇者モンはそこまでトレーニングを受けているので遅く入るほど見劣りする。
//   クリアしたWAVE1つにつき全ステ+10%を基準に、そのWAVEの残りターンで厚みを決めて積む
check('加入した子へ積み上げた補正を掛ける',
  has('return isTacticsMode(mode) ? applyTacticsJoinCatchUp(fresh, tacticsJoinCatchUpRef.current) : fresh;'));
check('補正はWAVEを倒しきった瞬間に1回だけ積む',
  has('tacticsJoinCatchUpRef.current=addTacticsJoinCatchUp(tacticsJoinCatchUpRef.current,remainingTurns);')
    && has('const waveMult=1.0+(wave*0.1); const remainingTurns=Math.max(0,21-turnCount);'));
check('積み上げは1周ごとに数え直す',
  (source.match(/tacticsJoinCatchUpRef\.current=1;/g) || []).length === 2,
  `戻す場所 ${(source.match(/tacticsJoinCatchUpRef\.current=1;/g) || []).length}か所`);
check('加入ボーナス(plusStats)は新モードでは使わない',
  has("const nAtk=atk+joinBonus('atk'), nDef=def+joinBonus('def');")
    && has('if(!tacticsJoin){ setMaxHp(nMaxHp); setHp(p=>p+(nMaxHp-bHp)); setMaxGuts(nMaxGuts); setAtk(nAtk); setDef(nDef); }'));
check('合流ボーナスの説明も新モード向けに出す',
  has('素のステータスがそのまま入ります')
    && has('あとから入るほど、先に育った子に追いつく補正がかかります'));
{
  // 率は「残りターン × 1%」。remainingTurns は 21 - そのWAVEに使ったターン数
  check('1ターンで抜ければ+20%', Math.abs(api.tacticsJoinWaveRate(20) - 0.2) < 1e-9,
    String(api.tacticsJoinWaveRate(20)));
  check('11ターン(半分)で+10%', Math.abs(api.tacticsJoinWaveRate(10) - 0.1) < 1e-9,
    String(api.tacticsJoinWaveRate(10)));
  check('20ターンかかれば+1%', Math.abs(api.tacticsJoinWaveRate(1) - 0.01) < 1e-9);
  check('時間切れなら増えない', api.tacticsJoinWaveRate(0) === 0 && api.tacticsJoinWaveRate(-5) === 0);
  // WAVEごとに掛け算で積む
  check('WAVEごとに掛け算で積む', (() => {
    let m = 1;
    m = api.addTacticsJoinCatchUp(m, 10);   // +10%
    m = api.addTacticsJoinCatchUp(m, 10);   // さらに+10%
    return Math.abs(m - 1.21) < 1e-9;
  })());
  check('速いWAVEが続くほど厚くなる', (() => {
    let fast = 1, slow = 1;
    for (let i = 0; i < 5; i++) { fast = api.addTacticsJoinCatchUp(fast, 20); slow = api.addTacticsJoinCatchUp(slow, 1); }
    return fast > 2.4 && slow < 1.06;
  })(), (() => {
    let fast = 1, slow = 1;
    for (let i = 0; i < 5; i++) { fast = api.addTacticsJoinCatchUp(fast, 20); slow = api.addTacticsJoinCatchUp(slow, 1); }
    return `最速5WAVE ${fast.toFixed(2)} / 最遅5WAVE ${slow.toFixed(2)}`;
  })());
  // 実際に加入する子へ乗せる。mon() は 600/120/120/100
  const joined = api.applyTacticsJoinCatchUp(api.createTacticsUnit(mon()), 1.61);
  check('積み上げたぶんだけ強くなる',
    joined.baseMaxHp === 966 && joined.atk === 193 && joined.def === 193 && joined.baseMaxGuts === 161,
    `${joined.baseMaxHp}/${joined.atk}/${joined.def}/${joined.baseMaxGuts}`);
  check('満タンで加わる', joined.hp === joined.maxHp && joined.downed === false);
  check('ガッツは半分から始まるのは変わらない', joined.guts === Math.floor(161 * api.TACTICS_START_GUTS_RATE));
  check('積み上げが1なら素のまま', (() => {
    const flat = api.applyTacticsJoinCatchUp(api.createTacticsUnit(mon()), 1);
    return flat.baseMaxHp === 600 && flat.atk === 120;
  })());
  check('壊れた値でも落ちない',
    api.applyTacticsJoinCatchUp(null, 2) === null
      && api.applyTacticsJoinCatchUp(api.createTacticsUnit(mon()), null).baseMaxHp === 600
      && api.addTacticsJoinCatchUp(null, null) === 1);
}

check('1体ずつの帯は新モードだけへ渡す',
  has('tacticsUnits={isTacticsMode(runMode)?tacticsUnits:null}'));
check('置けるかの判定も画面へ渡す', has('tacticsCanAssign={tacticsCanAssign}')
  && has('const tacticsCanAssign = (card, cardIndex, slotIdx) => (isTacticsMode(runMode)'));
{
  const screen = fs.readFileSync(path.join(root, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');
  const hasScreen = (needle) => screen.includes(needle);
  // ★距離枠の上へ、下の枠と同じ4列でそろえて出す(2026-09-19 ユーザー依頼)。
  //   スロットの中の小さい帯は、小さすぎて読めないのでやめた
  check('距離枠の上に1体ずつの帯を出す',
    // ★末尾の ${...} は、タクティクスのれんしゅうで光らせるための印(2026-09-21)
    hasScreen('<div data-tactics-party className={`relative w-full grid grid-cols-4 gap-1${battleTutorialSpotClass(\'tacticsParty\')}`}>')
      && hasScreen('data-tactics-hp={u?`${u.hp}/${u.maxHp}`:undefined}')
      && hasScreen('data-tactics-guts={u?`${u.guts}/${u.maxGuts}`:undefined}'));
  // ★ライフ・ガッツのポップアップ(吸収・ガードの余り・回復カード)は、合計の帯に重ねて出していた。
  //   その帯をやめたときに出す場所ごと消えていたので、1体ずつの帯の上へ置き直した(2026-09-20)
  check('ライフ・ガッツの数字が出る場所がある',
    hasScreen('<div data-tactics-party-popups className="absolute inset-x-0 -top-1 flex flex-col items-center gap-0.5 pointer-events-none" style={{zIndex:210}}>')
      && hasScreen("popups.filter(p=>p.side==='life'||p.side==='guts')"));
  // ★合計のライフ・ガッツは出さない。個別と両方出すと読むものが増えるだけ
  check('新モードでは合計の帯を出さない', hasScreen('{Array.isArray(tacticsUnits)?(') && hasScreen('):('));
  check('スロットの中の小さい帯はやめた', !hasScreen('data-tactics-unit={i}'));
  check('倒れた子は覆って分かるようにする', hasScreen('data-tactics-down-mark={i}') && hasScreen('ダウン'));
  // ★「全快になったら復活」なので、あとどれだけかを出さないと回復を回す判断が立たない
  check('復活まであとどれだけかを出す',
    hasScreen('data-tactics-revive={`${revivePct}`}') && hasScreen('復活まで {100-revivePct}%'));
  check('ダウン中の帯は復活ゲージとして色を変える',
    hasScreen("u.downed?'bg-gradient-to-r from-emerald-600 to-teal-300'"));
  // 1体ずつのステータスは「ステータス」から見る(2026-09-19 ユーザーの質問)
  check('ステータスに1体ずつの値を出す',
    has('<div data-tactics-status className="space-y-1.5 text-left">')
      && has('data-tactics-status-slot={i}'));
  check('ちから・丈夫さ・距離適性まで出す',
    has('この枠の距離適性') && has("<div className=\"text-[8px] font-black text-red-400\">ちから</div>")
      && has("<div className=\"text-[8px] font-black text-emerald-400\">丈夫さ</div>"));
  // ★null のときだけ今までどおりの判定を使う。ここを間違えると既存モードの置き方が変わる
  // ★予告と実行で数え方がずれると「ガードしたのに予定より減った」になる
  // ★数え方は1か所(plannedDamageFor)にまとめる。吹き出しと枠で別々に書くと、
  //   ガードの数え方を直したときに片方だけ古くなる
  check('予定ダメージの数え方は1か所にまとまっている',
    hasScreen('const plannedDamageFor = (slotIdx) => {')
      && hasScreen('const plannedDmg=plannedDamageFor(aimedSlot);')
      && hasScreen('const slotPlanned=plannedDamageFor(i);'));
  check('予定ダメージは本番と同じ受け方を通る',
    hasScreen('return applyTurnDamageReduction(resolveTacticsGuardedHit(raw, hits, guard, tacticsGuardHits(weight)).taken);'));
  // ★ガードの枚数を数えないと、2枚構えても予定が減らない
  check('予定ダメージもガードの枚数を数える', hasScreen('weight += w;'));
  // ★全体攻撃は立っている全員に当たり、受ける量は**その子の丈夫さ**で1体ずつ変わる。
  //   ガードも枠ごとなので、その枠へ置いたぶんだけを数える
  check('枠ごとに、その子へ置いたガードだけを数える',
    hasScreen('if (!(slotIdx === null || cardAssignments[idx] === slotIdx)) return;'));
  check('狙われている枠にその子の予定ダメージを出す',
    hasScreen('data-tactics-aimed-damage={slotPlanned}')
      && hasScreen('🎯{slotPlanned>0?` -${slotPlanned}`:\'\'}'));
  // ★1つの数字にまとめると、どの子がどれだけ減るのか分からなくなる
  check('全体攻撃は吹き出しに1つの数字を出さない',
    hasScreen('const showPlannedInBubble=!enemyIntent.targetsAll;')
      && hasScreen('{rawDmg>0&&showPlannedInBubble?` (予定: ${plannedDmg})`:\'\'}'));
  // ★連撃だと予告の時点で分かる(2026-09-21 ユーザー指摘「敵の連撃技が連撃表示になってない」)
  check('予告に何連撃かを出す', hasScreen('{previewHits>1?` ${previewHits}連撃`:\'\'}'));
  check('置けるかの判定は新モードだけ差し替える',
    hasScreen('const tacticsAnswer=tacticsCanAssign?tacticsCanAssign(pendingCardObj,pendingIdx,i):null;')
      && hasScreen('if(tacticsAnswer===null||tacticsAnswer===undefined){'));

  // --- ⑳ 手札の灰色も1体ずつのガッツで決める(2026-09-19 ユーザー指摘) ---
  // ★合計で見ていたころは、⚡242(125と117)持っていれば ⚡128 のカードが灰色にならず、
  //   枠に合わせてはじめて使えないと分かった。しかも理由が出なかった
  check('「使えるか・なぜ使えないか」を返す入口がある',
    has('const tacticsCardBlock = (card, cardIndex = null) => {')
      && has("if(!isTacticsMode(runMode)||!card) return null;"));
  check('使える子がいるかで決める(合計では決めない)',
    has('if(tacticsUsableSlots(card,cardIndex).length>0){'));
  check('理由はガッツ不足・ダウン・枚数の上限を見分ける',
    has("kind:'guts', short:'ガッツ不足'") && has("kind:'down', short:'ダウン'")
      && has("kind:'uses', short:'枚数上限'") && has("kind:'limit', short:null"));
  check('いちばん近い子の数字を理由に出す',
    has('if(!best||left-need>best.left-best.need) best={name:mon.masuName||mon.name,left,need};'));
  check('画面へ渡している', has('tacticsCardBlock={tacticsCardBlock}'));
  // ★null のときだけ今までどおりの合計での判定を使う
  check('手札の灰色は新モードだけ差し替える',
    hasScreen('const cardBlock=tacticsCardBlock?tacticsCardBlock(c,i):null;')
      && hasScreen('const isSelectable=isSel||(cardBlock?cardBlock.ok:(remainingGuts>=requiredGuts&&selectedCards.length<cardLimit));'));
  // ★理由の帯は grayscale の中へ置くと赤も灰色になる。ボタンの外(枠のdiv)へ出す
  check('使えないカードには理由の帯を出す',
    hasScreen('{cardBlock&&!cardBlock.ok&&cardBlock.short&&!isDragging&&(<div data-tactics-card-block={cardBlock.short}')
      && hasScreen('return(<div key={c.uid} className="relative flex-1 min-w-0 max-w-[20%] flex">'));
  // ★1ターンに選べる枚数の上限は、いままでの5モードと同じ見え方(灰色だけ)にする
  check('枚数の上限では帯を出さない(理由はカード詳細で出す)',
    hasScreen('data-card-block={cardBlock&&!cardBlock.ok?cardBlock.kind:undefined}'));
  check('カード詳細には理由の全文を出す', has('data-tactics-card-why'));
  // ★帯のアニメーションを外すと、回復もダメージも瞬間で増減して見える(2026-09-20 ユーザー指摘)。
  //   合計の帯と同じ速さ(ライフ1秒・ガッツ0.5秒)にそろえる
  check('1体ずつの帯は合計の帯と同じ速さで動く',
    hasScreen('data-tactics-hp-bar className={`h-full transition-all duration-1000 ')
      && hasScreen('data-tactics-guts-bar className="h-full bg-gradient-to-r from-amber-600 to-yellow-300 transition-all duration-500"'));
  check('手札に検査の手がかりがある',
    hasScreen('data-hand-card={i}') && hasScreen('data-card-cost={requiredGuts}')
      && hasScreen("data-card-usable={isSelectable?'true':'false'}"));
}

// --- 誰が狙われているか(2026-09-21 ユーザー指摘「誰に攻撃か分からない」) ---
// ★間合い攻撃(sweep)だけは相手を1体決めず「予告した間合いに立っている子」へ当たるので、
//   ほかの技と違って targetName を持たない。targetName だけを見ていたころは、
//   間合い攻撃の予告が「突進: 中 (予定: 186)」で終わり、誰に来るのか読めなかった
{
  const battleScreen = fs.readFileSync(path.join(root, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');
  const inScreen = (needle) => battleScreen.includes(needle);
  check('予告の吹き出しに狙いを出す', inScreen("{aimedName?` 🎯${aimedName}`:''}"));
  // ★数え方は本番と同じ関数を通す。別に書くと、距離撃でずらしたときに予告と実際がずれる
  check('狙いの数え方は本番と同じ関数を通す',
    inScreen('tacticsIntentTargets(enemyIntent, tacticsUnits, enemyDist)'));
  check('間合い攻撃で誰もいないときは、それが分かる',
    inScreen("(enemyIntent?.variant === 'sweep' ? 'だれもいない' : '')"));
  // ★名前だけでは4つの枠から自分で探すことになる。枠のほうにも印を出す
  check('狙われている枠に印を出す',
    inScreen("data-tactics-aimed={slotAimed?'true':undefined}")
      && inScreen('const slotAimed=aimedSlots.includes(i);')
      && inScreen('data-tactics-aimed-ring'));
  // ★輪(ring)で出すと、カードを置ける黄色の輪・ドラッグ中の緑の輪と重なって読めなくなる
  check('狙われている印は輪ではなく枠の内側の線で出す',
    !inScreen("${slotAimed?'ring-2 ring-red-500':''}"));
}

// --- ㉔ ガッツの合計と、1ターンに選べる枚数(2026-09-20 ユーザー指示) ---
// ★ユーザーの問い「行動回数ってガッツも見るようにしてるんだっけ？」から2つ決まった。
//   (1) 枚数はガッツのしきい(120/180)を見ず、立っている人数だけで決める
//   (2) ガッツの合計はライフと同じく「立っている子だけ」にする
// ★もとは「立っている子が全員満タンでも、倒れた子のぶんで合計が上限に届かず、
//   リザルトの『強化ポイントでガッツ回復』が押せてポイントだけ減る」が起きていた
const downedPair = api.damageTacticsTargets(pair, [2], 9999);
check('倒れた子はガッツの合計に数えない',
  api.tacticsTotalGuts(downedPair) === 50 && api.tacticsTotalBaseMaxGuts(downedPair) === 100,
  `いま${api.tacticsTotalGuts(downedPair)} / 上限${api.tacticsTotalBaseMaxGuts(downedPair)}`);
check('ガッツを入れる余地は1体ずつで見る',
  api.tacticsHasGutsRoom(pair) === true
  && api.tacticsHasGutsRoom(api.recoverTacticsGutsBoard(pair, 9999)) === false);
check('倒れた子のガッツが減っていても、立っている子が満タンなら余地なし', (() => {
  const filled = api.recoverTacticsGutsBoard(downedPair, 9999);
  return api.tacticsHasGutsRoom(filled) === false
    && api.tacticsTotalGuts(filled) === api.tacticsTotalBaseMaxGuts(filled);
})());
check('空の盤面でも落ちない',
  api.tacticsHasGutsRoom([null, null, null, null]) === false
  && api.tacticsHasGutsRoom(null) === false
  && api.tacticsTotalGuts(undefined) === 0);
// ★切り捨ての差。ここがもう1つの原因で、倒れた子を外すだけでは直らない
const oddFull = api.recoverTacticsGutsBoard(
  api.scaleTacticsUnits(makeBoard([0, { baseGuts: 65 }], [1, { baseGuts: 65 }], [2, { baseGuts: 65 }]), 0, 0.1),
  9999);
const oddTotalMax = sandbox.resolveEffectiveMaxStat(api.tacticsTotalBaseMaxGuts(oddFull), 0.1);
check('全員満タンでも、合計で見ると上限に届かないことがある',
  api.tacticsTotalGuts(oddFull) < oddTotalMax,
  `1体ずつの合計${api.tacticsTotalGuts(oddFull)} / 合計に掛けた上限${oddTotalMax}`);
check('それでも1体ずつなら「余地なし」と分かる', api.tacticsHasGutsRoom(oddFull) === false);
// 本体への結線
check('枚数は新モードだとガッツのしきいを見ない',
  has('if ((tactics || effectiveMaxGuts >= 180) && allyCount >= 3) limit = 3;')
  && has('else if ((tactics || effectiveMaxGuts >= 120) && allyCount >= 2) limit = 2;'));
check('枚数は立っている人数で数える',
  has('const allyCount = tactics') && has('? tacticsAliveSlots(tacticsUnits).length'));
check('ガッツ回復のボタンは1体ずつで出し分ける',
  has('&& (isTacticsMode(runMode) ? tacticsHasGutsRoom(tacticsUnits) : guts < effectiveMaxGuts);'));
check('ガッツ回復は新モードだと合計を足さずに配る',
  has('      gutsRecoveryLockRef.current = true;\n      // 新モードは立っている子へ配る(合計だけ増やすと、払える子が増えない)\n      gainGuts(GUTS_RECOVERY_AMOUNT);'));

// --- ㉕ 連撃の受け方(2026-09-21 ユーザー指示) ---
// 「連撃はガード1個で1個めのガードが出来て、2個使えば2個目までも出来る とかそういう感じだよ」
// ★ここは**実際に計算して**確かめる。文字列で見るだけだと、式を1つ書き換えただけで
//   受け方が変わったことに気づけない。予告と実行が同じ関数を通ることは上で見ている
{
  const HITS = 3, INCOMING = 300;              // 1ヒット = 100
  const rush = (guard, weight) => api.resolveTacticsGuardedHit(INCOMING, HITS, guard, api.tacticsGuardHits(weight));
  check('ガードが無ければ連撃は全部通る', rush(0, 0).taken === INCOMING, `${rush(0, 0).taken}`);
  check('ガード1枚で1ヒットぶんを受け止める',
    rush(150, 1).taken === 200 && rush(150, 1).covered === 1, `通ったぶん ${rush(150, 1).taken}`);
  check('ガード2枚で2ヒットぶんまで受け止める',
    rush(300, 2).taken === 100 && rush(300, 2).covered === 2, `通ったぶん ${rush(300, 2).taken}`);
  check('ガード3枚で連撃を受け止めきる',
    rush(450, 3).taken === 0 && rush(450, 3).covered === HITS, `通ったぶん ${rush(450, 3).taken}`);
  // ★ここが肝。厚さをいくら積んでも、1枚では1ヒットしか止まらない
  //   (「合計から引く」に戻すと、厚いガード1枚で連撃が完全に止まってしまう)
  check('厚いガード1枚では連撃は止まらない', rush(100000, 1).taken === 200, `通ったぶん ${rush(100000, 1).taken}`);
  check('弱ガードは2枚でようやく1ヒットぶん',
    api.tacticsGuardHits(0.5) === 1 && api.tacticsGuardHits(1.5) === 1 && api.tacticsGuardHits(2) === 2,
    `0.5→${api.tacticsGuardHits(0.5)} / 1.5→${api.tacticsGuardHits(1.5)} / 2→${api.tacticsGuardHits(2)}`);
  check('ヒット数を超えては数えない', rush(100000, 9).covered === HITS);
  check('受け止めたぶんと通ったぶんを足すと元の値に戻る',
    [0, 1, 2, 3, 9].every(w => { const r = rush(100000, w); return r.guarded + r.through === INCOMING; }));
  // ★1ヒットの攻撃(通常攻撃・必殺技・貫通撃)は今までどおり
  check('1ヒットの攻撃は余ったガードがライフになる',
    api.resolveTacticsGuardedHit(100, 1, 150, api.tacticsGuardHits(3)).saved === 50);
  check('ガードが足りなければ足りないぶんだけ通る',
    api.resolveTacticsGuardedHit(100, 1, 40, api.tacticsGuardHits(1)).taken === 60);
}

// --- ㉖ 倒れた子は毎ターン戻る(2026-09-21 ユーザー指示) ---
// 「死んだら毎ターン10%は回復する仕様に変更 何もしなくても10ターンで生き返れる」。
// ★2026-09-20 の「勝手に起きる回復では復活しない」をここで覆した。
//   何ターンで起きるかは遊びの手ざわりそのものなので、**実際に回して数える**
{
  const downedMon = { id: 'Mocchi', name: 'モッチー', baseHp: 600, baseAtk: 120, baseDef: 120, baseGuts: 100 };
  check('戻る率は本体が持つ', api.TACTICS_DOWNED_REGEN_RATE === 0.1, `${api.TACTICS_DOWNED_REGEN_RATE}`);
  let units = api.damageTacticsTargets([api.createTacticsUnit(downedMon)], [0], 9999);
  check('倒れた直後は0から始まる',
    api.normalizeTacticsUnit(units[0]).hp === 0 && api.normalizeTacticsUnit(units[0]).downed === true);
  let turns = 0;
  while (api.normalizeTacticsUnit(units[0]).downed && turns < 30) {
    units = api.regenDownedTacticsBoard(units).units;
    turns += 1;
  }
  check('何もしなくても10ターンで立ち上がる', turns === 10, `${turns}ターン`);
  check('立ち上がったときは満タン',
    api.normalizeTacticsUnit(units[0]).hp === api.normalizeTacticsUnit(units[0]).maxHp);
  // ★立っている子には入れない(そちらは自動再生がバフの率で別に回す)。
  //   ここへ入れると、強い編成ほど早く起き上がることになる
  let alive = api.damageTacticsTargets([api.createTacticsUnit(downedMon)], [0], 300);
  const aliveBefore = api.normalizeTacticsUnit(alive[0]).hp;
  alive = api.regenDownedTacticsBoard(alive).units;
  check('立っている子には入れない', api.normalizeTacticsUnit(alive[0]).hp === aliveBefore,
    `${aliveBefore} → ${api.normalizeTacticsUnit(alive[0]).hp}`);
  // ★ガッツは戻さない(倒れている子はカードを使えないので、戻しても行き場がない)
  let downedGuts = api.damageTacticsTargets([api.createTacticsUnit(downedMon)], [0], 9999);
  const gutsBefore = api.normalizeTacticsUnit(downedGuts[0]).guts;
  downedGuts = api.regenDownedTacticsBoard(downedGuts).units;
  check('倒れている子のガッツは戻さない', api.normalizeTacticsUnit(downedGuts[0]).guts === gutsBefore);
  // ★戻したぶんは枠ごとに返す(画面がその枠へ出す)
  let one = api.damageTacticsTargets([api.createTacticsUnit(downedMon)], [0], 9999);
  const got = api.regenDownedTacticsBoard(one);
  check('戻したぶんを枠ごとに返す', got.healed && got.healed[0] === 60 && got.hp === 60,
    JSON.stringify(got.healed || {}));
}

// --- ㉗ 誰に何が起きたかを枠ごとに出す(2026-09-21 ユーザー指摘) ---
// 「個別ダメージと全体ダメージで誰に何が起きてるか分かりにくいからそこはちゃんと仕上げて」
{
  const battleScreen = fs.readFileSync(path.join(root, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');
  const inScreen = (needle) => battleScreen.includes(needle);
  check('枠ごとに何が起きたかを出す',
    inScreen('data-tactics-slot-fx={i}') && inScreen('tacticsSlotFx&&tacticsSlotFx[i]'));
  // ★連撃のときは1ヒットずつ並べるので、まとめた数字は連撃でないときだけ出る
  check('減った・受け止めた・戻ったを出し分ける',
    inScreen('f.dmg>0&&') && inScreen('{f.guard&&') && inScreen('{f.heal>0&&')
      && inScreen('{f.revive>0&&') && inScreen('f.evade?') && inScreen('f.reflect?'));
  // --- 合計の重ね出しをやめる(2026-09-21 ユーザー指示) ---
  // 「個別をみんなに出してるならただ見にくいだけだから出さないで
  //  ただし連撃は最後に合計を出すようにして」
  // ★枠ごとに出しているものは、まんなかへ同じ数字を重ねない
  check('減ったぶんの合計をまんなかへ重ねない', !has("addPopup(`-${dealt}`,'hero'"));
  check('ガードで戻ったぶんの合計も重ねない',
    !has("addPopup(`💚 ライフ +${saved}`") && !has("addPopup(`⚡ ガッツ +${gutsBack}`"));
  check('回復カードの合計も重ねない', !has('addPopup(`💚 回復 +${healedAll.hp}`'));
  // ★既存5モードは今までどおり合計で出す。消すのはタクティクスの枝だけ
  check('吸収の合計は既存モードだけ',
    (source.match(/addPopup\(`💚 ライフ \+\$\{hpGain\}`/g) || []).length === 1,
    `${(source.match(/addPopup\(`💚 ライフ \+\$\{hpGain\}`/g) || []).length}か所`);
  check('自動再生・緊急回復の合計は既存モードだけ',
    has('const showRegenTotal=!isTacticsMode(runMode);')
      && has('if(showRegenTotal) addPopup(`🌿 自動再生 +${autoHealVal}`')
      && has('if(!isTacticsMode(runMode)){\n      if(recoverHp>0) addPopup('));
  // ★連撃だけは最後に合計を出す(味方が敵へ連撃したときと同じ見せ方)
  check('連撃だけは最後に合計を出す',
    has('if(rushSlot!=null&&dealt>0){') && has('addPopup(`合計 ${dealt}`,\'hero\''));
  check('味方が敵へ連撃したときも最後に合計を出す(今までどおり)',
    has('addPopup(`合計 ${totalDmg}`,\'enemy\''));
  // ★何も起きなかったことは、枠に数字が出ないだけでは分からないので残す
  check('無傷のときは今までどおり知らせる', has("addPopup('無傷！','hero'"));
  // ★出した数字は時間で消す(2026-09-21 ユーザー指摘「前ターンのダメージとか
  //   アイコンみたいのが残ってる」)。もとは「次に自分がカードを切るまで残す」だったが、
  //   敵が何もしないターン(様子を見ている)を挟むと前のターンの数字が居座っていた
  check('出した数字は時間で消す',
    has('const showTacticsSlotFx = (updater) => {')
      && has('tacticsSlotFxTimerRef.current = setTimeout(() => {')
      && has('const TACTICS_SLOT_FX_MS = 2600;'));
  check('自分が動いたら、その場で消す', has('clearTacticsSlotFx();'));
  // ★出すときは必ず showTacticsSlotFx を通す。直に setTacticsSlotFx を呼ぶと
  //   時計が張られず、その表示だけ消えずに残る
  check('出すのは必ず時計つきの入口を通す',
    has('showTacticsSlotFx(Object.keys(slotFx).length?slotFx:null);')
      && !has('setTacticsSlotFx(Object.keys(slotFx)'));
  check('画面を離れるときに時計を片づける',
    has('useEffect(() => () => { if (tacticsSlotFxTimerRef.current) clearTimeout(tacticsSlotFxTimerRef.current); }, []);'));
  check('倒れた子が戻ったぶんもその枠へ出す', has('slotIdx,{revive:got}'));
  // ★回復カード・緊急回復・メロソ・ポルツはすべて tacticsRateHeal を通る。
  //   ここ1か所で枠へ出せば、足すたびに書き足さなくてよい
  check('回復も枠ごとに出す',
    has('mergeTacticsSlotFx(result.healed, result.gutsHealed);')
      && has('const mergeTacticsSlotFx = (healed, gutsHealed) => {'));
  // ★置き換えではなく重ねる。同じターンのガードぶんと回復カードぶんが両方残る
  check('枠ごとの表示は重ねて足す',
    has('next[slotIdx] = { ...(next[slotIdx] || {}), ...value };'));
  // --- 回復カードのガッツも全体へ(2026-09-21 ユーザー指摘) ---
  // 「みゅあの回復は全体なのに1体にしかきいてなかった」。ライフは tacticsRateHeal で
  // 全体へ入っていたのに、**ガッツだけ gainGutsByRate(slotIdx,…) で使った子にしか
  // 入っていなかった**。回復カードは全体回復で、使う子を選ぶのはガッツを払うためだけ
  check('回復カードのガッツは全体へ入る入口がある',
    has('const gainGutsByRateAll = (rate) => {') && has('const result = tacticsRateHeal(0, rate);'));
  check('みゅあ・メロソ・助手カードのガッツが全体へ入る',
    has('const gutsVal=gainGutsByRateAll(0.3*effMul);')
      && has('if(gutsRecRate>0) gainGutsByRateAll(gutsRecRate*effMul);')
      && has('if(level>=1) gainGutsByRateAll((0.5+level*0.2)*effMul);'));
  // ★固有技は「そのモンスターの技」なので、使った子だけに入る(スエゾー)。
  //   ここまで全体にすると、単体へ効く技が1つも無くなる
  check('固有技のガッツは使った子だけのまま',
    has("else if(card.monId==='Suezo'){const gRec=gainGutsByRate(slotIdx,0.5*effMul);"));
  // ★絶氷の楔は立っている子を1体ずつ回すループなので、そのまま
  check('絶氷の楔は1体ずつ回す形のまま',
    has('if (extra>0) gutsRegen+=gainGutsByRate(slotIdx,extra);'));
  // ★吸ったのは狙われた子ひとり。誰が吸ったのかを出す
  check('吸収も誰が吸ったかを出す',
    has('if(absorbSlot!=null&&(hpGain>0||gutsGain>0)) mergeTacticsSlotFx({[absorbSlot]:hpGain},{[absorbSlot]:gutsGain});'));
  check('ガッツの増えたぶんも枠へ出す', inScreen('{f.guts>0&&'));
  // --- 連撃は1ヒットずつ出す(2026-09-21 ユーザー指示) ---
  // 「連撃の表示が1回だけだった 敵の3連撃なら3回ダメージ表記が出るようにして
  //  60なら20、20，20みたいな」
  check('連撃は1ヒットずつ並べて出す',
    inScreen('Array.isArray(f.hits)&&f.hits.length>1')
      && inScreen('f.hits.map((value,hitIndex)=>'));
  check('連撃は1ヒットずつ順に出す(まとめて出さない)',
    has('for(let shown=1; shown<=allHits.length; shown+=1){')
      && has('hits:allHits.slice(0,shown)'));
  check('通ったヒットの数だけ数字を出す(受け止めたぶんは数えない)',
    has('const stoppedHits=hit.blocked?hit.covered:0;')
      && has('const throughHits=Math.max(1,rushHits-stoppedHits);')
      && has('if(rushHits>1) fx.hits=splitTacticsHitAmounts(fd,throughHits);'));
}

// --- ㉙ 連撃を1ヒットずつに割る(2026-09-21 ユーザー指示) ---
// 「60なら20、20，20みたいな」。**実際に割って**、足すと元の合計へ戻ることまで見る
{
  check('60を3ヒットに割ると 20/20/20',
    JSON.stringify(api.splitTacticsHitAmounts(60, 3)) === '[20,20,20]',
    JSON.stringify(api.splitTacticsHitAmounts(60, 3)));
  // ★端数はいちばん最後のヒットへ寄せる。足して元へ戻らないと、枠の数字と実際の減り方が食い違う
  check('割り切れないときも足すと元の合計に戻る',
    [61, 100, 7, 1].every(total => api.splitTacticsHitAmounts(total, 3).reduce((sum, value) => sum + value, 0) === total),
    JSON.stringify(api.splitTacticsHitAmounts(61, 3)));
  check('端数は最後のヒットへ寄せる',
    JSON.stringify(api.splitTacticsHitAmounts(61, 3)) === '[20,20,21]',
    JSON.stringify(api.splitTacticsHitAmounts(61, 3)));
  check('1ヒットならそのまま1つ', JSON.stringify(api.splitTacticsHitAmounts(60, 1)) === '[60]');
  check('0なら何も出さない', JSON.stringify(api.splitTacticsHitAmounts(0, 3)) === '[]');
}

// --- ㉘ 回復の内訳を枠ごとに返す(2026-09-21 ユーザー指摘) ---
// 「ダメージや回復表示は個別で分かるようになった？」。合計だけでは、4体のうち
// 誰が戻ったのかが分からない。**実際に動かして**内訳が合うことを確かめる
{
  const healMon = { id: 'Mocchi', name: 'モッチー', baseHp: 600, baseAtk: 120, baseDef: 120, baseGuts: 100 };
  let board = [api.createTacticsUnit(healMon), api.createTacticsUnit(healMon)];
  board = api.applyTacticsDamage ? board : board;
  board = api.damageTacticsTargets(board, [0], 300);   // 1体目だけ300減らす
  const res = api.rateHealTacticsBoard(board, 0.3, 0.3, false);
  check('回復の内訳を枠ごとに返す',
    res.healed && res.healed[0] === 180 && res.healed[1] === undefined,
    JSON.stringify(res.healed || {}));
  check('内訳の合計が、返す合計と合う',
    Object.values(res.healed || {}).reduce((sum, value) => sum + value, 0) === res.hp, `${res.hp}`);
  check('ガッツの内訳も枠ごとに返す',
    res.gutsHealed && res.gutsHealed[0] === 30 && res.gutsHealed[1] === 30,
    JSON.stringify(res.gutsHealed || {}));
}

// --- ㉚ 追いつき補正を間合いのボーナスへも乗せる(2026-09-21 ユーザー指示) ---
// 「そうしたら追いつき補正で距離ボーナスも乗せないとだね」
//   ・ベース値は「これまでの合計ダメージ」で見る
//   ・残りターン10がベース値どおりになる基準で、そこより速いか遅いかで上下する
// ★上下するのは**ベース値を基準にした位置**であって、もらえるボーナスがマイナスへ
//   なるわけではない(2026-09-21 ユーザー指摘「ボーナスがマイナスになるわけじゃなくて、
//   ベースボーナスが基準値より上か下かっていう意味」)。手間取っても引き上げ幅は残る。
// 数字は本体の定数から出す(検査へ 1% や 10ターンを書き写さない)
{
  const perTurn = api.TACTICS_JOIN_RATE_PER_TURN;
  const baseTurns = api.TACTICS_JOIN_DIST_BASE_TURNS;
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  check('基準のターン数ならベース値どおり', near(api.addTacticsJoinDistCatchUp(1, baseTurns), 1),
    `${api.addTacticsJoinDistCatchUp(1, baseTurns)}`);
  check('基準より速く抜ければベース値より上',
    api.addTacticsJoinDistCatchUp(1, baseTurns + 5) > 1
      && near(api.tacticsJoinDistWaveRate(baseTurns + 5), 5 * perTurn));
  check('基準より遅ければベース値より下',
    api.addTacticsJoinDistCatchUp(1, 0) < 1 && near(api.tacticsJoinDistWaveRate(0), -baseTurns * perTurn));
  // ★ここが読み違えやすいところ。**引き上げる値そのものはマイナスにならない**
  const slowBonus = api.tacticsJoinDistBonus(2000000, sandbox.DIST_BONUS_PER_DAMAGE,
    api.addTacticsJoinDistCatchUp(1, 0));
  check('いちばん遅い抜け方でも、引き上げる値はマイナスにならない', slowBonus > 0, `${slowBonus}`);
  check('遅く抜けたぶんはベース値より下に収まる',
    slowBonus < api.tacticsJoinDistBonus(2000000, sandbox.DIST_BONUS_PER_DAMAGE, 1), `${slowBonus}`);
  // ステータス側は基準を持たない。ここが2つの補正の違いなので、実際に並べて確かめる
  check('ステータス側は基準を持たない（残りターンのぶんだけ上がる）',
    api.tacticsJoinWaveRate(0) === 0 && api.tacticsJoinWaveRate(baseTurns) > 0);
  // WAVEごとに掛け算で積む
  const oneWave = api.addTacticsJoinDistCatchUp(1, baseTurns + 10);
  const twoWaves = api.addTacticsJoinDistCatchUp(oneWave, baseTurns + 10);
  check('WAVEごとに掛け算で積む', near(twoWaves, oneWave * oneWave), `${oneWave} → ${twoWaves}`);
  check('倍率がマイナスへ落ちない', api.addTacticsJoinDistCatchUp(0, 0) >= 0 && api.addTacticsJoinDistCatchUp(-5, 0) >= 0);
  // ベース値は合計ダメージ。実際に計算して確かめる
  const bonus = api.tacticsJoinDistBonus(2000000, sandbox.DIST_BONUS_PER_DAMAGE, oneWave);
  check('ベース値は合計ダメージから出す',
    near(bonus, 2000000 * sandbox.DIST_BONUS_PER_DAMAGE * oneWave), `${bonus}`);
  check('ダメージを与えていなければ引き上げもない',
    api.tacticsJoinDistBonus(0, sandbox.DIST_BONUS_PER_DAMAGE, oneWave) === 0);
  // 加入した枠だけ引き上げる。ほかの枠は1つも動かさない
  const before = [0.5, 0, 0.1, 0];
  const after = api.applyTacticsJoinDistBonus(before, [1, 3], 0.2);
  check('あとから入った枠だけ引き上げる',
    near(after[1], 0.2) && near(after[3], 0.2), JSON.stringify(after));
  check('入っていない枠はそのまま', near(after[0], 0.5) && near(after[2], 0.1), JSON.stringify(after));
  // ★すでに積み上がっている枠を下げない。間合いのボーナスは枠ごとの配列をパーティで
  //   共有しているので、下げるとそこへ立っていた子のぶんまで削れる
  const kept = api.applyTacticsJoinDistBonus([0.9, 0, 0, 0], [0], 0.2);
  check('すでに上へ積み上がっている枠は下げない', near(kept[0], 0.9), JSON.stringify(kept));
  check('加入した枠が無ければ何も変えない',
    JSON.stringify(api.applyTacticsJoinDistBonus(before, [], 0.2)) === JSON.stringify(before));
  // 「あとから入った枠」の数え方
  const board = [api.createTacticsUnit(mon()), null, api.createTacticsUnit(mon({ id: 'Golem' })), null];
  const next = [{ id: 'Mocchi' }, { id: 'Pixie' }, { id: 'Golem' }, null];
  check('入れ替わった枠と空いていた枠だけを拾う',
    JSON.stringify(api.tacticsJoinedSlots(board, next)) === '[1]',
    JSON.stringify(api.tacticsJoinedSlots(board, next)));
  check('同じ枠の別の子は「入った」とみなす',
    JSON.stringify(api.tacticsJoinedSlots(board, [{ id: 'Pixie' }, null, { id: 'Golem' }, null])) === '[0]');
  check('マスモンは個体(masuId)まで見て同じかを決める',
    api.isSameTacticsUnit(api.createTacticsUnit(mon({ masuId: 'm1' })), { id: 'Mocchi', masuId: 'm1' })
      && !api.isSameTacticsUnit(api.createTacticsUnit(mon({ masuId: 'm1' })), { id: 'Mocchi', masuId: 'm2' }));
  // 本体への結線。合計ダメージは ref から読む(周回のはじめに前周ぶんを配らないため)
  check('加入した枠を、盤面を作り直す前に数えている',
    has('const joinedSlots = isTacticsMode(mode) ? tacticsJoinedSlots(tacticsUnitsRef.current, nextSlots) : [];'));
  check('加入した枠があるときだけ引き上げる',
    has('if (joinedSlots.length) catchUpTacticsDistBonus(joinedSlots, mode);'));
  check('合計ダメージは ref から読む（周回のはじめに前周ぶんを配らない）',
    has('tacticsJoinDistBonus(totalAllDamageRef.current, DIST_BONUS_PER_DAMAGE, tacticsJoinDistCatchUpRef.current)'));
  check('難易度の距離強化も既存の子と同じように通す',
    has('return Math.max(0, applyDistanceEnhancement(base, specialRuleDifficulty, wave));'));
  check('WAVEを抜けるたびに積む',
    has('tacticsJoinDistCatchUpRef.current=addTacticsJoinDistCatchUp(tacticsJoinDistCatchUpRef.current,remainingTurns);'));
  check('周回のはじめに数え直す',
    has('tacticsJoinCatchUpRef.current = 1;\n    tacticsJoinCatchUpTurnsRef.current = 0;\n    tacticsJoinDistCatchUpRef.current = 1;'));
  check('供モン選びの画面にも同じ値を出す', has('distCatchUp: tacticsJoinDistCatchUpBonus()'));
}

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
