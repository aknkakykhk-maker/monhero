// ==== 新モード(id: tactics)の「1体ぶん」の値と盤面 ====
//
// 設計の正本: docs/spec/BATTLE_NEW_MODE_PLAN.md
//
// いまのバトルは ライフ・ちから・丈夫さ・ガッツ を**パーティで1セット**持ち、
// 供モンが合流すると plusStats を合算する。新モードはこれをやめて、
// **モンスターごとに自分の値を持つ**。狙われた子のライフが減り、0になったその子だけが倒れる。
//
// ここに置くのは**純粋関数だけ**。state も画面も触らないので、検査から本体をそのまま動かせる。
// 実際の盤面(どの state に持つか・いつ更新するか)は 60-app.jsx 側の仕事。
//
// ★どの関数も「新しいオブジェクトを返す」。渡された unit を書き換えないので、
//   setState(prev => ...) の中からそのまま呼べる。
// ★壊れた値(null・NaN・負数)が来ても落とさず、意味のある既定値へ倒す。
//   ラン中の値はセーブデータから復元されることもあるため。

// 倒れた子を戻したときのライフ。バトル中の回復カードと、WAVE後のトレーニングで払うものが違う
// (docs の §4.3)。割合はここが正本で、画面や説明文へ数字を書き写さない
const TACTICS_REVIVE_HP_RATE = 0.5;      // 回復カードで戻したとき
const TACTICS_TRAINING_REVIVE_RATE = 1.0; // WAVE後のトレーニングで戻したとき(そのWAVEの強化を全部あきらめる)
// 勇者モンがバトルを始めるときのガッツ。いまの実装と同じく最大の半分から始める
const TACTICS_START_GUTS_RATE = 0.5;

const tacticsSafeInt = (value, fallback = 0) => {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? n : fallback;
};
const tacticsClamp = (value, min, max) => Math.max(min, Math.min(max, value));

// モンスター1体から、ラン中の現在値を作る。
// mon は slots へ入るのと同じ形(マスモンなら育成済みの値が baseHp などに入っている)。
// ★ちから・丈夫さは「いまの値」をそのまま持つ。トレーニングで伸びるのもこの値
const createTacticsUnit = (mon, { fullGuts = false } = {}) => {
  if (!mon) return null;
  const maxHp = Math.max(1, tacticsSafeInt(mon.baseHp, 1));
  const maxGuts = Math.max(0, tacticsSafeInt(mon.baseGuts, 0));
  return {
    id: mon.id || null,
    masuId: mon.masuId ?? null,
    name: mon.masuName || mon.name || '',
    hp: maxHp,
    maxHp,
    atk: Math.max(0, tacticsSafeInt(mon.baseAtk, 0)),
    def: Math.max(0, tacticsSafeInt(mon.baseDef, 0)),
    guts: fullGuts ? maxGuts : Math.floor(maxGuts * TACTICS_START_GUTS_RATE),
    maxGuts,
    downed: false,
  };
};

// 壊れた値を含む unit を安全な形へ戻す。ライフが0なら倒れている扱いに揃える
const normalizeTacticsUnit = (unit) => {
  if (!unit || typeof unit !== 'object') return null;
  const maxHp = Math.max(1, tacticsSafeInt(unit.maxHp, 1));
  const maxGuts = Math.max(0, tacticsSafeInt(unit.maxGuts, 0));
  const hp = tacticsClamp(tacticsSafeInt(unit.hp, 0), 0, maxHp);
  return {
    ...unit,
    hp,
    maxHp,
    atk: Math.max(0, tacticsSafeInt(unit.atk, 0)),
    def: Math.max(0, tacticsSafeInt(unit.def, 0)),
    guts: tacticsClamp(tacticsSafeInt(unit.guts, 0), 0, maxGuts),
    maxGuts,
    // 「ライフ0なのに立っている」「ライフがあるのに倒れている」を作らない
    downed: hp <= 0,
  };
};

// ダメージ。0になったらその子は倒れる
const applyTacticsDamage = (unit, damage) => {
  const target = normalizeTacticsUnit(unit);
  if (!target || target.downed) return target;
  const hp = Math.max(0, target.hp - Math.max(0, tacticsSafeInt(damage, 0)));
  return { ...target, hp, downed: hp <= 0 };
};

// 回復。倒れている子は healTacticsUnit では戻らない(戻すのは reviveTacticsUnit)
const healTacticsUnit = (unit, amount) => {
  const target = normalizeTacticsUnit(unit);
  if (!target || target.downed) return target;
  return { ...target, hp: Math.min(target.maxHp, target.hp + Math.max(0, tacticsSafeInt(amount, 0))) };
};

// 倒れた子を戻す。戻ったときのライフは払うものによって違う(§4.3)
const reviveTacticsUnit = (unit, rate = TACTICS_REVIVE_HP_RATE) => {
  const target = normalizeTacticsUnit(unit);
  if (!target || !target.downed) return target;
  const safeRate = Number.isFinite(Number(rate)) ? tacticsClamp(Number(rate), 0, 1) : TACTICS_REVIVE_HP_RATE;
  return { ...target, hp: Math.max(1, Math.floor(target.maxHp * safeRate)), downed: false };
};

// ガッツ。足りなければ払えない(payable:false を返し、値は変えない)
const payTacticsGuts = (unit, cost) => {
  const target = normalizeTacticsUnit(unit);
  const need = Math.max(0, tacticsSafeInt(cost, 0));
  if (!target || target.downed || target.guts < need) return { unit: target, payable: false };
  return { unit: { ...target, guts: target.guts - need }, payable: true };
};
const recoverTacticsGuts = (unit, amount) => {
  const target = normalizeTacticsUnit(unit);
  if (!target || target.downed) return target;
  return { ...target, guts: Math.min(target.maxGuts, target.guts + Math.max(0, tacticsSafeInt(amount, 0))) };
};

// ===== 盤面(4スロット) =====
// 空きスロットは null。倒れた子は残り続ける(スロットは空かない)

const tacticsAliveSlots = (units) => (Array.isArray(units) ? units : [])
  .map((unit, index) => (unit && !normalizeTacticsUnit(unit).downed ? index : -1))
  .filter(index => index >= 0);
const tacticsFilledSlots = (units) => (Array.isArray(units) ? units : [])
  .map((unit, index) => (unit ? index : -1)).filter(index => index >= 0);
const tacticsDownedSlots = (units) => (Array.isArray(units) ? units : [])
  .map((unit, index) => (unit && normalizeTacticsUnit(unit).downed ? index : -1))
  .filter(index => index >= 0);
// 全滅したか。★1体もいない盤面は「まだ始まっていない」ので全滅にしない
const isTacticsWipedOut = (units) => tacticsFilledSlots(units).length > 0 && tacticsAliveSlots(units).length === 0;
// そのスロットのカードを使えるか。倒れている子のカードは手札に残っていても選べない
const canTacticsSlotAct = (units, slotIndex) => tacticsAliveSlots(units).includes(slotIndex);

// ===== 敵の狙い =====
//
// ★完全なランダムだと「誰を守るか」の判断が立たないので、ライフの少ない子を狙いやすくする。
//   重みは「残りライフの割合が低いほど大きい」。倒れている子は狙わない。
//   weightBias を0にすると一様ランダムになる(検査で確かめる)。
const TACTICS_TARGET_LOW_HP_BIAS = 2;
const tacticsTargetWeights = (units, bias = TACTICS_TARGET_LOW_HP_BIAS) => {
  const safeBias = Number.isFinite(Number(bias)) ? Math.max(0, Number(bias)) : TACTICS_TARGET_LOW_HP_BIAS;
  return tacticsAliveSlots(units).map(index => {
    const unit = normalizeTacticsUnit(units[index]);
    const remain = unit.maxHp > 0 ? tacticsClamp(unit.hp / unit.maxHp, 0, 1) : 1;
    return { index, weight: 1 + safeBias * (1 - remain) };
  });
};
// 狙うスロットを1つ選ぶ。生きている子がいなければ null
const chooseTacticsTarget = (units, random = Math.random, bias = TACTICS_TARGET_LOW_HP_BIAS) => {
  const weights = tacticsTargetWeights(units, bias);
  if (!weights.length) return null;
  const total = weights.reduce((sum, entry) => sum + entry.weight, 0);
  if (!(total > 0)) return weights[0].index;
  const roll = tacticsClamp(Number(random()) || 0, 0, 0.999999999999) * total;
  let cursor = roll;
  for (const entry of weights) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.index;
  }
  return weights[weights.length - 1].index;
};

// 敵の予告へ「誰を狙うか」を足す。
// ★全体攻撃(targetsAll)は狙いを決めない。薙ぎ払いは間合いで当たる相手が決まるので、
//   ここでは狙いを持たせず、実行時に「その間合いにいる子」を見る。
// ★ダメージの無い行動(ためる・移動・咆哮・再生)にも狙いは要らない。
const TACTICS_TARGETED_TYPES = ['ATTACK', 'SPECIAL'];
const withTacticsTarget = (intent, units, random = Math.random, bias = TACTICS_TARGET_LOW_HP_BIAS) => {
  if (!intent || !TACTICS_TARGETED_TYPES.includes(intent.type)) return intent;
  if (intent.targetsAll || intent.variant === 'sweep') return intent;
  const targetSlot = chooseTacticsTarget(units, random, bias);
  return targetSlot == null ? intent : { ...intent, targetSlot };
};
// その行動が実際に当たるスロット。予告と実行で同じ関数を通すので食い違わない
const tacticsIntentTargets = (intent, units, enemyDist = null) => {
  const alive = tacticsAliveSlots(units);
  if (!intent || !alive.length) return [];
  if (intent.targetsAll) return alive;
  // 薙ぎ払いは「予告した間合いにいる子」。距離撃でずらせば誰にも当たらないこともある
  if (intent.variant === 'sweep') {
    const dist = Number.isInteger(enemyDist) ? enemyDist : intent.sweepDist;
    return alive.filter(index => index === dist);
  }
  return Number.isInteger(intent.targetSlot) && alive.includes(intent.targetSlot) ? [intent.targetSlot] : [];
};
