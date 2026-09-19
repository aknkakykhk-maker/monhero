const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 新モード(id: tactics)の「1体ぶん」の値と盤面を、本体の純関数をそのまま動かして確かめる。
// 設計の正本: docs/spec/BATTLE_NEW_MODE_PLAN.md
//
//   ① 1体ぶんの値を作れる(ライフ・ちから・丈夫さ・ガッツを個別に持つ)
//   ② 狙われた子だけがライフを減らし、0になったその子だけが倒れる
//   ③ 倒れた子はカードを使えない。戻す手段は2つあり、戻るライフが違う
//   ④ 全員倒れたときだけ全滅
//   ⑤ 敵はライフの少ない子を狙いやすい。全体攻撃と薙ぎ払いは狙いを決めない
//   ⑥ 壊れた値が来ても落ちない
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
const sandbox = { Math, console };
vm.createContext(sandbox);
vm.runInContext(
  slice('const TACTICS_REVIVE_HP_RATE', '// ==== 画面ライフサイクル')
    + ';globalThis.api={TACTICS_REVIVE_HP_RATE,TACTICS_TRAINING_REVIVE_RATE,TACTICS_START_GUTS_RATE,'
    + 'createTacticsUnit,normalizeTacticsUnit,applyTacticsDamage,healTacticsUnit,reviveTacticsUnit,'
    + 'payTacticsGuts,recoverTacticsGuts,tacticsAliveSlots,tacticsDownedSlots,isTacticsWipedOut,'
    + 'canTacticsSlotAct,chooseTacticsTarget,withTacticsTarget,tacticsIntentTargets};', sandbox);
const api = sandbox.api;

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
check('倒れた子は回復では戻らない', api.healTacticsUnit(downed, 500).downed === true);

// --- ③ 戻す手段は2つ。払うものが違うので戻るライフも違う ---
const revivedByCard = api.reviveTacticsUnit(downed, api.TACTICS_REVIVE_HP_RATE);
const revivedByTraining = api.reviveTacticsUnit(downed, api.TACTICS_TRAINING_REVIVE_RATE);
check('回復カードで戻すとライフは一部',
  revivedByCard.downed === false && revivedByCard.hp === Math.floor(600 * api.TACTICS_REVIVE_HP_RATE),
  `${revivedByCard.hp}/600`);
check('トレーニングで戻すほうがライフは多い', revivedByTraining.hp >= revivedByCard.hp,
  `カード${revivedByCard.hp} / トレーニング${revivedByTraining.hp}`);
check('戻したライフは必ず1以上', api.reviveTacticsUnit(downed, 0).hp >= 1);
check('倒れていない子に戻す操作をしても何も起きない', api.reviveTacticsUnit(unit, 1).hp === 600);

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
check('薙ぎ払いは狙いを決めない（間合いで当たる相手が決まる）',
  api.withTacticsTarget({ type: 'ATTACK', variant: 'sweep', sweepDist: 2 }, board, () => 0).targetSlot === undefined);

// --- 実際に当たる相手 ---
check('単体狙いは1体だけに当たる',
  api.tacticsIntentTargets({ type: 'ATTACK', targetSlot: 2 }, board).join(',') === '2');
check('全体攻撃は生きている全員に当たる',
  api.tacticsIntentTargets({ type: 'ATTACK', targetsAll: true }, boardOneDown).join(',') === '2');
check('薙ぎ払いはその間合いにいる子へ当たる',
  api.tacticsIntentTargets({ type: 'ATTACK', variant: 'sweep', sweepDist: 2 }, board, 2).join(',') === '2');
check('薙ぎ払いは間合いをずらせば誰にも当たらない',
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
check('ライフがあるのに倒れている状態を作らない',
  api.normalizeTacticsUnit({ hp: 50, maxHp: 100, downed: true }).downed === false);
check('unitでないものは null', api.normalizeTacticsUnit(null) === null && api.normalizeTacticsUnit('x') === null);
check('盤面が配列でなくても落ちない',
  api.tacticsAliveSlots(null).length === 0 && api.isTacticsWipedOut(undefined) === false);

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
