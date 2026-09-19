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
//   ⑦ バトル本体へ結線されている(盤面が slots と一緒に動き、予告へ狙いが乗る)
//   ⑧ パーティのライフは盤面の合計。増減が正しく振り分けられる(段階5)
//   ⑩⑪ ガッツも1体ずつ。カードは「使う子」を選び、その子のガッツで払う(段階6)
//   ⑫⑬ ガードは使った子自身を守る。回復カードは使う子へ、倒れた子へ向けると起こす(段階7)
//   ⑭⑮ 画面へ1体ずつの帯を出す(段階8)／合流すると総合力に応じて敵も強くなる(段階9)
//   ⑯ ちから・丈夫さも1体ずつ。攻撃はその子のちから、被弾はその子の丈夫さ(段階10)
//   ⑰ トレーニングを1体ずつ選ぶ。倒れた子はここで起こせる(段階11)
//   ⑱ スコアは式そのままで桁だけ 1/1000 へ縮める(段階12)
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
    + 'canTacticsSlotAct,chooseTacticsTarget,withTacticsTarget,tacticsIntentTargets,'
    + 'tacticsTotalHp,tacticsTotalMaxHp,tacticsTotalBaseMaxHp,scaleTacticsUnits,scaleTacticsUnitMaxHp,'
    + 'damageTacticsTargets,healTacticsBoard,selfDamageTacticsBoard,'
    + 'fullHealTacticsBoard,wipeTacticsBoard,tacticsTotalGuts,tacticsTotalBaseMaxGuts,'
    + 'scaleTacticsUnitMaxGuts,canTacticsSlotPay,payTacticsGutsAt,recoverTacticsGutsBoard,'
    + 'healTacticsAt,recoverTacticsGutsAt,selfDamageTacticsAt,'
    + 'reviveTacticsAt,tacticsReviveHelper,tacticsPayerSlot,tacticsEnemyPowerMultiplier,'
    + 'TACTICS_ENEMY_POWER_MAX,applyTacticsTraining,tacticsPartyAtk,'
    + 'tacticsPartyDef,TACTICS_TRAINING_REVIVE_RATE,shrinkTacticsScore,TACTICS_SCORE_DIVISOR};', sandbox);
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
// 予告の吹き出しへ出す呼び名。ここが空だと「誰を狙うか」が画面に出ない
check('狙った子の名前を予告へ持ち歩く',
  api.withTacticsTarget(attack, board, () => 0).targetName === 'モッチー',
  String(api.withTacticsTarget(attack, board, () => 0).targetName));
check('全体攻撃は「全員」と出す',
  api.withTacticsTarget({ type: 'ATTACK', targetsAll: true }, board, () => 0).targetName === '全員');
check('名前が無い子でも呼び名が空にならない',
  !!api.withTacticsTarget(attack, [api.createTacticsUnit({ id: 'X', baseHp: 10 }), null, null, null], () => 0).targetName);
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
// ★倒れた子へ配ると「倒れたのにライフがある」状態になる。戻すのは回復カードかトレーニング
check('倒れた子には配らない', (() => {
  const board = api.damageTacticsTargets(pair, [2], 9999);
  const after = api.healTacticsBoard(api.damageTacticsTargets(board, [0], 200), 200);
  return after[2].hp === 0 && after[2].downed === true;
})());
check('満タンの盤面へ回復しても増えない', api.tacticsTotalHp(api.healTacticsBoard(pair, 500)) === 1000);
check('立っている子がいなければ何も起きない',
  api.tacticsTotalHp(api.healTacticsBoard(api.wipeTacticsBoard(pair), 500)) === 0);
check('WAVEの全回復でも倒れた子は戻らない', (() => {
  const board = api.fullHealTacticsBoard(api.damageTacticsTargets(damagedBoard, [2], 9999));
  return board[0].hp === board[0].maxHp && board[2].downed === true && board[2].hp === 0;
})());

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
    && has('if(!canTacticsSlotPay(tacticsUnitsRef.current,payer,(spent[payer]||0)+cost)) return;'));
// 回復カードだけは倒れた子へも向けられる(段階7)
check('回復カードは倒れた子へも向けられる',
  has("const payer=tacticsPayerSlot(tacticsUnitsRef.current,slotIdx,cost,card.type==='heal');")
    && has('if(payer===null) return;'));
// ★守り・回復まで「1体1枚」に数えると、供モンが居ないWAVE1で1ターン1枚しか使えなくなる
check('枚数制限に数えるのは攻撃カードだけ',
  has('if(isAttackCard(card)&&(attacks[slotIdx]||0)>=slotMaxUses(mon,slotIdx)) return;'));
check('使える子が1体だけなら選ぶ手間を省く',
  has('if(tacticsMode&&usable.length===1){ setCardAssignments(p=>({...p,[i]:usable[0]})); }'));
check('ドラッグでの割り当ても同じ判定を通す',
  has('if(tacticsMode && !tacticsUsableSlots(c,cardIndex).includes(slotIdx)){ setFocusedCard(null); return; }'));
// ★ここを通さないと、払えない組み合わせでカードだけ切れてしまう
check('実行の前に「使う子が払えるか」を見る',
  has('return canTacticsSlotPay(tacticsUnitsRef.current,payer,spentByPayer[payer]);'));
check('払うのは使う子',
  has('if(isTacticsMode(runMode)){ const payer=tacticsCardPayer(slotIdx,card,cardCost); if(payer!==null) tacticsPayGuts(payer,cardCost); }'));
check('ガッツの回復は1か所(gainGuts)へまとめる',
  has('const gainGuts = (amount) => {')
    && (source.match(/gainGuts(At)?\(/g) || []).length >= 11,
  `gainGuts / gainGutsAt を呼ぶ場所 ${(source.match(/gainGuts(At)?\(/g) || []).length}か所`);
// カードで増えるガッツは「使った子」へ入る(段階7)
check('カードで増えるガッツは使った子へ', has('const gainGutsAt = (slotIdx, amount) => {')
  && (source.match(/gainGutsAt\(slotIdx,/g) || []).length === 3,
  `gainGutsAt を使う場所 ${(source.match(/gainGutsAt\(slotIdx,/g) || []).length}か所`);
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
check('合流しても、すでに居る子の現在値を作り直さない',
  has('const same = current && current.id === (mon.id || null) && current.masuId === (mon.masuId ?? null);')
    && has('return same ? current : createTacticsUnit(mon);'));
check('盤面はrefでも持つ(抽選は再描画より先に走る)', has('tacticsUnitsRef.current = next;'));
check('狙いを付けるのは新モードだけ',
  has('const aimTacticsIntent = (intent, mode) => (isTacticsMode(mode) ? withTacticsTarget(intent, tacticsUnitsRef.current) : intent);'));
check('WAVEの最初の予告にも狙いが付く',
  has('const firstIntent = aimTacticsIntent(getNextEnemyAction(newEnemy,dist,null,{unannounced:true,...actionState()}),runMode);'));
// ★予約した時点で狙いを固定すると、そのあいだに倒れた子を狙ったまま予告してしまう
check('狙いは予告を出す直前に決める',
  has('const upcoming = aimTacticsIntent(reserved || getNextEnemyAction(enemy, distAfterExecuted, effective, {unannounced:true,...actionState()}), runMode);'));
// --- ⑨ ライフを盤面の合計にする結線(段階5) ---
// ★盤面と hp が食い違うと敗北判定が壊れる。書き換えの入口が1つであることを見る
check('盤面とパーティのライフを同じ場所で動かす',
  has('const commitTacticsUnits = (nextUnits, mode = runMode) => {')
    && has('const max = tacticsTotalBaseMaxHp(next), total = tacticsTotalHp(next);')
    && has('setMaxHp(max); setHp(total);'));
check('パーティのライフを書き換えるのは commitTacticsUnits だけ',
  (source.match(/tacticsUnitsRef\.current = /g) || []).length === 1,
  `盤面のrefを直に書く場所 ${(source.match(/tacticsUnitsRef\.current = /g) || []).length}か所`);
// ★編成前の画面でライフを0にすると、いきなり敗北画面(hp<=0)が出てしまう
check('1体もいない盤面ではライフに触らない', has("if (!next.some(Boolean)) return null;"));
check('ターンの途中でも新しい上限を読めるようにする', has('maxHpRef.current = max;'));
check('敵の攻撃は当たった子だけを減らす',
  has('const targets = tacticsIntentTargets(intent, tacticsUnitsRef.current, actingDist);')
    && has('return commitTacticsUnits(damageTacticsTargets(tacticsUnitsRef.current, targets, damage));'));
// --- ⑫ ガードは使った子自身を守る(段階7) ---
// ★誰かが構えたガードが全員を守ってしまうと、狙いを読む意味が消える
check('新モードの被弾は専用の経路を通る', has('} else if (isTacticsMode(runMode)) {')
  && has('const targets=tacticsIntentTargets(intent,tacticsUnitsRef.current,actingEnemyDist);'));
check('ガードは構えた子のぶんだけで受ける',
  has('const own=slotGuards[slotIdx]||{flat:0,mult:0};')
    && has('const base=(own.flat>0||own.mult>0)?Math.floor(own.flat+slotDef*own.mult):0;'));
check('誰が構えたかをスロットごとに集める',
  has('const addGuardForSlot=(idx,flat,mult)=>{')
    && (source.match(/addGuardForSlot\(slotIdx,/g) || []).length === 3,
  `構えを数える場所 ${(source.match(/addGuardForSlot\(slotIdx,/g) || []).length}か所`);
check('貫通撃はガードが効かず、連撃は手数ぶん効く',
  has("const slotGuard=intent.variant==='pierce'?0:(intent.variant==='rush'?base*rushHits:base);"));
check('ガードの余りはその子のライフとガッツになる',
  has('units=recoverTacticsGutsAt(healTacticsAt(units,slotIdx,diff),slotIdx,gain);'));
// ★薙ぎ払いの間合いに誰も立っていないターンがある。減っていないのに数字を出すと読めない
check('誰にも当たらなかったターンはダメージの数字を出さない',
  has("addPopup('当たらなかった！','hero','text-cyan-300 font-black text-xl drop-shadow-md');")
    && has('if(!targets.length){'));
check('回復(吸収・自動再生・緊急)は立っている子へ配る',
  ['const absorbed=tacticsHeal(hpGain);', 'if(tacticsHeal(autoHealVal)===null)',
   'const emergencyHp=tacticsHeal(recoverHp);'].every(has));
// 回復カードは使う子へ。倒れた子へ向けたときは起こす(段階7)
check('回復カードは使う子に効く',
  has('hpBeforeEnemyAttack=commitTacticsUnits(healTacticsAt(board,slotIdx,cardHeal));'));
check('倒れた子へ回復カードを向けると起こす',
  has('hpBeforeEnemyAttack=commitTacticsUnits(reviveTacticsAt(board,slotIdx));')
    && has('が起き上がった！'));
check('ドレインは殴った子が吸う',
  has('if(isTacticsMode(runMode)) hpBeforeEnemyAttack=commitTacticsUnits(healTacticsAt(tacticsUnitsRef.current,slotIdx,hRec));'));
check('20ターン経過は全員を倒す', has('if(nextTurn>20){ if(tacticsWipe()===null) setHp(0); }'));
check('自傷は使った子だけが受け、誰も倒れない',
  has('selfDamageTacticsAt(tacticsUnitsRef.current,slotIdx,selfDmgAmt)'));
// ★合流のライフ合算をやめないと、合流した子のぶんが盤面とパーティで二重に入る
check('供モン合流でライフもガッツもちからも合算しない',
  has('const tacticsJoin=isTacticsMode(runMode);')
    && has("if(!tacticsJoin){ setMaxHp(nMaxHp); setHp(p=>p+(nMaxHp-bHp)); setMaxGuts(nMaxGuts); setAtk(nAtk); setDef(nDef); }"));
check('トレーニングの伸びは1体ずつ入れる(段階11で作り直した)',
  has('const after=resolveTrainingStats({atk:unit.atk,def:unit.def,hp:unit.baseMaxHp,guts:unit.baseMaxGuts},'));
check('みゅあ補正が上がったら1体ずつの上限へ効かせ直す',
  has("commitTacticsUnits(scaleTacticsUnits(tacticsUnitsRef.current, getPermaBuff('muaHpPct'), getPermaBuff('muaGutsPct')));"));
// ★ライフを書き換える場所が増えたら、新モードの分岐を足したか必ず見直すこと。
//   1か所でも素通りすると、盤面と合計が食い違って敗北判定が壊れる。
//   数が変わったらこの検査が落ちるので、そこで棚卸しする
const setHpSites = (source.match(/setHp\(/g) || []).length;
check('ライフを書き換える場所は数えてある', setHpSites === 21,
  `いま ${setHpSites}か所(数えたときは21か所)。増えたら新モードの分岐を足したか確かめる`);
const setGutsSites = (source.match(/setGuts\(/g) || []).length;
check('ガッツを書き換える場所は数えてある', setGutsSites === 12,
  `いま ${setGutsSites}か所(数えたときは12か所)。増えたら gainGuts を通すか確かめる`);
// 既存モードを巻き込んでいないこと
check('既存モードの実効最大ライフはそのまま',
  has("const effectiveMaxHp = useMemo(() => resolveEffectiveMaxStat(maxHp, getPermaBuff('muaHpPct')), [maxHp, permaBuffs]);"));

// --- ⑱ スコアを縮める(段階12) ---
// ★式は変えない。桁だけ縮める(2026-09-19 ユーザーが選択)
check('1/1000へ縮める', api.TACTICS_SCORE_DIVISOR === 1000
  && api.shrinkTacticsScore(1234567) === 1234, String(api.shrinkTacticsScore(1234567)));
// ★1点でも入ったWAVEを0にしない。「何もしていない」と区別が付かなくなる
check('入ったぶんは0にしない', api.shrinkTacticsScore(1) === 1 && api.shrinkTacticsScore(999) === 1);
check('0は0のまま', api.shrinkTacticsScore(0) === 0);
check('壊れた値でも落ちない',
  api.shrinkTacticsScore(null) === 0 && api.shrinkTacticsScore(-50) === 0 && api.shrinkTacticsScore('x') === 0);
check('縮めるのは新モードだけ',
  has('const finalRoundScore=isTacticsMode(runMode)?shrinkTacticsScore(rawRoundScore):Math.floor(rawRoundScore);'));
// ★式そのものは触っていない(既存モードのスコアが変わらないこと)
check('スコアの式は今までどおり',
  has('const rawRoundScore=((totalWaveDamage*waveMult)+(totalWaveDamage*turnMult))*scoreMultiplier;'));

// --- ⑰ トレーニングを1体ずつ選ぶ(段階11) ---
check('選んだぶんはその子だけへ入る', (() => {
  const after = api.applyTacticsTraining(pair, 0, { atk: 200, def: 150, hp: 700, guts: 130 });
  return after[0].atk === 200 && after[0].def === 150 && after[0].baseMaxHp === 700 && after[0].baseMaxGuts === 130
    && after[2].atk === 120 && after[2].baseMaxHp === 400;
})());
check('上限の倍率も一緒にかけ直す',
  api.applyTacticsTraining(pair, 0, { atk: 120, def: 120, hp: 700, guts: 100 }, 0.1)[0].maxHp === 770);
check('いないスロットへ入れても壊れない',
  api.applyTacticsTraining(pair, 1, { atk: 1, def: 1, hp: 1, guts: 1 })[1] === null);
// ★パーティのちから・丈夫さは平均。合計にすると人数が増えただけでガードが跳ね上がる
check('パーティのちから・丈夫さは1体ずつの平均',
  api.tacticsPartyAtk(pair) === 120 && api.tacticsPartyDef(pair) === 120);
check('伸ばした子がいれば平均も上がる',
  api.tacticsPartyAtk(api.applyTacticsTraining(pair, 0, { atk: 220, def: 120, hp: 600, guts: 100 })) === 170,
  String(api.tacticsPartyAtk(api.applyTacticsTraining(pair, 0, { atk: 220, def: 120, hp: 600, guts: 100 }))));
check('誰もいなければ0', api.tacticsPartyAtk([null, null, null, null]) === 0);
// ★トレーニングで起こすときは満タンで戻る(回復カードの半分とは別の割合)
check('トレーニングで起こすと満タンで戻る', api.TACTICS_TRAINING_REVIVE_RATE === 1
  && api.TACTICS_TRAINING_REVIVE_RATE > api.TACTICS_REVIVE_HP_RATE);
// 本体への結線
check('新モードのトレーニングは1体ずつ入れる',
  has('units=applyTacticsTraining(units,slotIdx,after,getPermaBuff(\'muaHpPct\'),getPermaBuff(\'muaGutsPct\'));')
    && has('const ids=entries.filter(entry=>entry.slot===slotIdx).map(entry=>entry.id);'));
check('起こすとそのWAVEは誰も強化できない',
  has('commitTacticsUnits(reviveTacticsAt(tacticsUnitsRef.current,revivePick,TACTICS_TRAINING_REVIVE_RATE));')
    && has('const revivePick=tacticsMode&&picks&&!Array.isArray(picks)&&Number.isInteger(picks.revive)?picks.revive:null;'));
check('パーティのちから・丈夫さは盤面から入れ直す',
  has('setAtk(tacticsPartyAtk(next)); setDef(tacticsPartyDef(next));'));

// --- ⑯ ちから・丈夫さも1体ずつ(段階10) ---
check('1体ずつのちから・丈夫さを持っている', pair[0].atk === 120 && pair[0].def === 120,
  `${pair[0].atk} / ${pair[0].def}`);
// 本体への結線
check('攻撃は「その子のちから」で出す',
  has('const attackerAtk=isTacticsMode(runMode)&&tacticsUnitsRef.current[slotIdx]'));
// ★targetSlot を渡したときだけ1体ずつの丈夫さになる。渡さない既存モードは今までどおり
check('被弾は「狙われた子の丈夫さ」で受ける',
  has('const getIncomingDamageBeforeTurnReduction = useCallback((intent, targetSlot=null) => {')
    && has('const targetUnit = Number.isInteger(targetSlot) ? tacticsUnitsRef.current[targetSlot] : null;'));
check('新モードの受け方も1体ずつ計算し直す',
  has('const slotIncoming=getIncomingDamageBeforeTurnReduction(intent,slotIdx);')
    && has('const base=(own.flat>0||own.mult>0)?Math.floor(own.flat+slotDef*own.mult):0;'));
check('トレーニングのちから・丈夫さも盤面が正本',
  has('nDef=tacticsPartyDef(units); nAtk=tacticsPartyAtk(units);'));
{
  const screen = fs.readFileSync(path.join(root, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');
  check('予告の予測も狙われた子で出す',
    screen.includes('const rawDmg=getIncomingDamageBeforeTurnReduction(enemyIntent,aimedSlot);')
      && screen.includes('const guardsAimed=aimedSlot===null||cardAssignments[idx]===aimedSlot;'));
}

// --- ⑮ 供モンが合流すると敵も強くなる(段階9) ---
// ★人数ごとの固定倍率にすると弱い編成ほど苦しくなるので、総合力で決める(ユーザーが選択)
check('合流していなければ敵は強くならない',
  api.tacticsEnemyPowerMultiplier(1000, 1000) === 1 && api.tacticsEnemyPowerMultiplier(1000, 500) === 1);
check('総合力が増えたぶんだけ敵も強くなる',
  api.tacticsEnemyPowerMultiplier(1000, 2000) > 1 && api.tacticsEnemyPowerMultiplier(1000, 4000) > api.tacticsEnemyPowerMultiplier(1000, 2000),
  `2倍→×${api.tacticsEnemyPowerMultiplier(1000, 2000).toFixed(2)} / 4倍→×${api.tacticsEnemyPowerMultiplier(1000, 4000).toFixed(2)}`);
// ★そのまま倍率にすると跳ね上がる。指数で緩めて「弱くても多少はやれる」を残す
check('増えたぶんより緩やかに上がる',
  api.tacticsEnemyPowerMultiplier(1000, 4000) < 4,
  `4倍のとき ×${api.tacticsEnemyPowerMultiplier(1000, 4000).toFixed(2)}`);
check('上限がある', api.tacticsEnemyPowerMultiplier(1, 1e9) === api.TACTICS_ENEMY_POWER_MAX,
  `上限 ×${api.TACTICS_ENEMY_POWER_MAX}`);
// ★同じ倍率になること。育ちきった人にも育っていない人にも同じ手ざわりにする
check('絶対値ではなく「何倍になったか」で決まる',
  api.tacticsEnemyPowerMultiplier(1000, 3000) === api.tacticsEnemyPowerMultiplier(100000, 300000));
check('壊れた値でも1倍に倒す',
  api.tacticsEnemyPowerMultiplier(0, 1000) === 1 && api.tacticsEnemyPowerMultiplier(null, undefined) === 1);
check('敵の生成へ倍率を渡している',
  has('const tacticsEnemyBoost=isTacticsMode(runMode)')
    && has('enemyTurnMultiplier*stagedEnemyMultiplier*tacticsEnemyBoost'));
check('総合力の控えは編成を動かすたびに数え直す',
  has('tacticsPowerRef.current = power > 0'));
check('合流したときに「敵も強くなった」と出す', has('敵も強くなった！ ×'));

// --- ⑭ 画面(段階8) ---
// ★盤面は既存モードでも作っている(モードで分けないほうが事故が少ない)。
//   画面へ渡すときだけ新モード以外を null にしないと、ほかのモードにも帯が出てしまう
check('1体ずつの帯は新モードだけへ渡す',
  has('tacticsUnits={isTacticsMode(runMode)?tacticsUnits:null}'));
check('置けるかの判定も画面へ渡す', has('tacticsCanAssign={tacticsCanAssign}')
  && has('const tacticsCanAssign = (card, cardIndex, slotIdx) => (isTacticsMode(runMode)'));
{
  const screen = fs.readFileSync(path.join(root, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');
  const hasScreen = (needle) => screen.includes(needle);
  check('スロットへ1体ずつのライフ・ガッツを出す',
    hasScreen('data-tactics-hp={`${tacticsUnit.hp}/${tacticsUnit.maxHp}`}')
      && hasScreen('data-tactics-guts={`${tacticsUnit.guts}/${tacticsUnit.maxGuts}`}'));
  check('倒れた子は覆って分かるようにする', hasScreen('data-tactics-down-mark={i}') && hasScreen('ダウン'));
  // ★null のときだけ今までどおりの判定を使う。ここを間違えると既存モードの置き方が変わる
  check('置けるかの判定は新モードだけ差し替える',
    hasScreen('const tacticsAnswer=tacticsCanAssign?tacticsCanAssign(pendingCardObj,pendingIdx,i):null;')
      && hasScreen('if(tacticsAnswer===null||tacticsAnswer===undefined){'));
}

check('予告の吹き出しに狙いを出す',
  fs.readFileSync(path.join(root, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8')
    .includes("{enemyIntent.targetName?` 🎯${enemyIntent.targetName}`:''}"));

console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);
