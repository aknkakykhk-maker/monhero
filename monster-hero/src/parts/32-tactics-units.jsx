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
    // 素の上限。みゅあ補正などの倍率は「合計」ではなく1体ずつへ効かせるので、
    // 倍率が変わるたびにここから maxHp を計算し直す(scaleTacticsUnitMaxHp)
    baseMaxHp: maxHp,
    atk: Math.max(0, tacticsSafeInt(mon.baseAtk, 0)),
    def: Math.max(0, tacticsSafeInt(mon.baseDef, 0)),
    guts: fullGuts ? maxGuts : Math.floor(maxGuts * TACTICS_START_GUTS_RATE),
    maxGuts,
    // ライフと同じく、素の上限を残す。みゅあ補正の倍率はここから計算し直す
    baseMaxGuts: maxGuts,
    downed: false,
  };
};

// 壊れた値を含む unit を安全な形へ戻す。ライフが0なら倒れている扱いに揃える
const normalizeTacticsUnit = (unit) => {
  if (!unit || typeof unit !== 'object') return null;
  const maxHp = Math.max(1, tacticsSafeInt(unit.maxHp, 1));
  // 素の上限が無い(古い形)ときは、いまの上限をそのまま素の上限とみなす
  const baseMaxHp = Math.max(1, tacticsSafeInt(unit.baseMaxHp, maxHp));
  const maxGuts = Math.max(0, tacticsSafeInt(unit.maxGuts, 0));
  const baseMaxGuts = Math.max(0, tacticsSafeInt(unit.baseMaxGuts, maxGuts));
  const hp = tacticsClamp(tacticsSafeInt(unit.hp, 0), 0, maxHp);
  return {
    ...unit,
    hp,
    maxHp,
    baseMaxHp,
    atk: Math.max(0, tacticsSafeInt(unit.atk, 0)),
    def: Math.max(0, tacticsSafeInt(unit.def, 0)),
    guts: tacticsClamp(tacticsSafeInt(unit.guts, 0), 0, maxGuts),
    maxGuts,
    baseMaxGuts,
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
// ===== 盤面の合計 =====
//
// 新モードでは、パーティのライフ(hp / maxHp)を**盤面の合計**にする。こうすると
// 全滅＝合計0 が自動的に成り立ち、いまある敗北判定・ライフバー・20ターン経過を
// そのまま使える。
// ★合計と盤面が食い違うと即座に壊れる(「合計は残っているのに全員倒れている」)。
//   書き換えの入口は 60-app.jsx の commitTacticsUnits ひとつだけにしてある。
const tacticsTotalHp = (units) => (Array.isArray(units) ? units : [])
  .reduce((sum, unit) => sum + (unit ? normalizeTacticsUnit(unit).hp : 0), 0);
const tacticsTotalMaxHp = (units) => (Array.isArray(units) ? units : [])
  .reduce((sum, unit) => sum + (unit ? normalizeTacticsUnit(unit).maxHp : 0), 0);
const tacticsTotalGuts = (units) => (Array.isArray(units) ? units : [])
  .reduce((sum, unit) => sum + (unit ? normalizeTacticsUnit(unit).guts : 0), 0);
const tacticsTotalBaseMaxGuts = (units) => (Array.isArray(units) ? units : [])
  .reduce((sum, unit) => sum + (unit ? normalizeTacticsUnit(unit).baseMaxGuts : 0), 0);
// 素の上限の合計。パーティの maxHp はこちらを持つ。
// ★みゅあ補正は既存モードと同じく effectiveMaxHp が掛ける。1体ずつの上限にも同じ倍率が
//   入っているので、ゲージの満タンと盤面の合計はほぼ一致する(1体ごとの切り捨てぶんだけ下)
const tacticsTotalBaseMaxHp = (units) => (Array.isArray(units) ? units : [])
  .reduce((sum, unit) => sum + (unit ? normalizeTacticsUnit(unit).baseMaxHp : 0), 0);

// みゅあ・かどみうむ・回復カードで上がるライフ上限の倍率。
// ★合計へ掛けると1体ずつの上限と基準が食い違うので、1体ずつの maxHp へ効かせる。
//   素の上限(baseMaxHp)は残したまま計算し直すので、倍率が下がっても元へ戻せる
const scaleTacticsUnitMaxHp = (unit, hpPct = 0) => {
  const target = normalizeTacticsUnit(unit);
  if (!target) return null;
  const pct = Number.isFinite(Number(hpPct)) ? Math.max(0, Number(hpPct)) : 0;
  const maxHp = Math.max(1, Math.floor(target.baseMaxHp * (1 + pct)));
  return normalizeTacticsUnit({ ...target, maxHp });
};
// ガッツの上限も同じ考え方。みゅあ補正は合計ではなく1体ずつへ効かせる
const scaleTacticsUnitMaxGuts = (unit, gutsPct = 0) => {
  const target = normalizeTacticsUnit(unit);
  if (!target) return null;
  const pct = Number.isFinite(Number(gutsPct)) ? Math.max(0, Number(gutsPct)) : 0;
  const maxGuts = Math.max(0, Math.floor(target.baseMaxGuts * (1 + pct)));
  return normalizeTacticsUnit({ ...target, maxGuts });
};
const scaleTacticsUnits = (units, hpPct = 0, gutsPct = 0) => (Array.isArray(units) ? units : [])
  .map(unit => (unit ? scaleTacticsUnitMaxGuts(scaleTacticsUnitMaxHp(unit, hpPct), gutsPct) : null));

// 敵の攻撃。当たった子だけが減り、0になったその子が倒れる
const damageTacticsTargets = (units, targetSlots, damage) => {
  const hit = new Set((Array.isArray(targetSlots) ? targetSlots : []).filter(Number.isInteger));
  return (Array.isArray(units) ? units : [])
    .map((unit, index) => (unit && hit.has(index) ? applyTacticsDamage(unit, damage) : unit));
};

// 回復を盤面へ配る。★倒れた子には配らない(戻すのは回復カードかトレーニング)。
// 足りない量に比例して配り、端数は足りない量の大きい子から埋める。
// 均等割りにすると、瀕死の子が置き去りのまま満タンの子へ回復が消える
const healTacticsBoard = (units, amount) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const give = Math.max(0, tacticsSafeInt(amount, 0));
  if (give <= 0) return list;
  const missing = tacticsAliveSlots(list)
    .map(index => {
      const unit = normalizeTacticsUnit(list[index]);
      return { index, need: Math.max(0, unit.maxHp - unit.hp) };
    })
    .filter(entry => entry.need > 0)
    .sort((a, b) => b.need - a.need);
  const totalNeed = missing.reduce((sum, entry) => sum + entry.need, 0);
  if (totalNeed <= 0) return list;
  const budget = Math.min(give, totalNeed);
  let handed = 0;
  const shares = missing.map(entry => {
    const value = Math.floor(budget * entry.need / totalNeed);
    handed += value;
    return { ...entry, value };
  });
  let left = budget - handed;
  for (let i = 0; i < shares.length && left > 0; i++) {
    const add = Math.min(left, shares[i].need - shares[i].value);
    shares[i].value += add;
    left -= add;
  }
  shares.forEach(entry => { if (entry.value > 0) list[entry.index] = healTacticsUnit(list[entry.index], entry.value); });
  return list;
};

// ===== ガッツ(1体ずつ) =====
//
// ★カードを使うのは「選んだその子」で、払うのもその子のガッツ。
//   合計で足りていても、その子が足りなければ使えない。ここが新モードの手ざわりの中心。

// そのスロットがそのカードを払えるか。倒れている子は払えない
const canTacticsSlotPay = (units, slotIndex, cost) => {
  const list = Array.isArray(units) ? units : [];
  if (!canTacticsSlotAct(list, slotIndex)) return false;
  return normalizeTacticsUnit(list[slotIndex]).guts >= Math.max(0, tacticsSafeInt(cost, 0));
};
// ガッツを払う。払えないときは盤面を変えずに payable:false を返す
const payTacticsGutsAt = (units, slotIndex, cost) => {
  const list = (Array.isArray(units) ? units : []).slice();
  if (!canTacticsSlotPay(list, slotIndex, cost)) return { units: list, payable: false };
  const paid = payTacticsGuts(list[slotIndex], cost);
  if (!paid.payable) return { units: list, payable: false };
  list[slotIndex] = paid.unit;
  return { units: list, payable: true };
};
// ガッツの回復。ライフと同じく、立っている子へ足りない量に比例して配る。
// ★倒れた子には配らない(戻ってきたときに満タンで復帰してしまうため)
const recoverTacticsGutsBoard = (units, amount) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const give = Math.max(0, tacticsSafeInt(amount, 0));
  if (give <= 0) return list;
  const missing = tacticsAliveSlots(list)
    .map(index => {
      const unit = normalizeTacticsUnit(list[index]);
      return { index, need: Math.max(0, unit.maxGuts - unit.guts) };
    })
    .filter(entry => entry.need > 0)
    .sort((a, b) => b.need - a.need);
  const totalNeed = missing.reduce((sum, entry) => sum + entry.need, 0);
  if (totalNeed <= 0) return list;
  const budget = Math.min(give, totalNeed);
  let handed = 0;
  const shares = missing.map(entry => {
    const value = Math.floor(budget * entry.need / totalNeed);
    handed += value;
    return { ...entry, value };
  });
  let left = budget - handed;
  for (let i = 0; i < shares.length && left > 0; i++) {
    const add = Math.min(left, shares[i].need - shares[i].value);
    shares[i].value += add;
    left -= add;
  }
  shares.forEach(entry => { if (entry.value > 0) list[entry.index] = recoverTacticsGuts(list[entry.index], entry.value); });
  return list;
};
// トレーニングで伸びたガッツの上限を配る。ライフと同じ配り方(段階7で1体ずつ選ぶ形にする)
const growTacticsMaxGuts = (units, delta, gutsPct = 0) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const add = tacticsSafeInt(delta, 0);
  if (add <= 0) return list;
  const filled = tacticsFilledSlots(list)
    .map(index => ({ index, base: normalizeTacticsUnit(list[index]).baseMaxGuts }));
  const totalBase = filled.reduce((sum, entry) => sum + entry.base, 0);
  if (!filled.length || totalBase <= 0) return list;
  let handed = 0;
  const shares = filled.map(entry => {
    const value = Math.floor(add * entry.base / totalBase);
    handed += value;
    return { ...entry, value };
  });
  const order = [...shares].sort((a, b) => b.base - a.base);
  for (let left = add - handed, i = 0; left > 0; i = (i + 1) % order.length, left--) order[i].value += 1;
  shares.forEach(entry => {
    if (entry.value <= 0) return;
    const target = normalizeTacticsUnit(list[entry.index]);
    list[entry.index] = scaleTacticsUnitMaxGuts({ ...target, baseMaxGuts: target.baseMaxGuts + entry.value }, gutsPct);
  });
  return list;
};

// 自分のカードによる自傷(みゅあの札など)。★これで倒れることはない。
// いまのライフに比例して配り、1体ずつ最低1は残す(元の実装も合計が1を下回らない)
const selfDamageTacticsBoard = (units, damage) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const total = Math.max(0, tacticsSafeInt(damage, 0));
  if (total <= 0) return list;
  const alive = tacticsAliveSlots(list)
    .map(index => ({ index, room: Math.max(0, normalizeTacticsUnit(list[index]).hp - 1) }))
    .filter(entry => entry.room > 0);
  const room = alive.reduce((sum, entry) => sum + entry.room, 0);
  if (room <= 0) return list;
  const budget = Math.min(total, room);
  let handed = 0;
  const shares = alive.map(entry => {
    const value = Math.floor(budget * entry.room / room);
    handed += value;
    return { ...entry, value };
  });
  let left = budget - handed;
  for (let i = 0; i < shares.length && left > 0; i++) {
    const add = Math.min(left, shares[i].room - shares[i].value);
    shares[i].value += add;
    left -= add;
  }
  shares.forEach(entry => { if (entry.value > 0) list[entry.index] = applyTacticsDamage(list[entry.index], entry.value); });
  return list;
};

// ===== 「その子だけ」へ効かせる =====
//
// ★カードは使う子を選ぶので、効果もその子に乗る(設計 §4.4)。
//   盤面全体へ配る healTacticsBoard とは使い分ける
//   (自動再生・吸収のように「パーティ全体に起きること」だけが配るほう)。

const healTacticsAt = (units, slotIndex, amount) => {
  const list = (Array.isArray(units) ? units : []).slice();
  if (!canTacticsSlotAct(list, slotIndex)) return list;
  list[slotIndex] = healTacticsUnit(list[slotIndex], amount);
  return list;
};
const recoverTacticsGutsAt = (units, slotIndex, amount) => {
  const list = (Array.isArray(units) ? units : []).slice();
  if (!canTacticsSlotAct(list, slotIndex)) return list;
  list[slotIndex] = recoverTacticsGuts(list[slotIndex], amount);
  return list;
};
// 使う子の自傷。★これで倒れることはない(最低1を残す)
const selfDamageTacticsAt = (units, slotIndex, amount) => {
  const list = (Array.isArray(units) ? units : []).slice();
  if (!canTacticsSlotAct(list, slotIndex)) return list;
  const unit = normalizeTacticsUnit(list[slotIndex]);
  const hurt = Math.min(Math.max(0, tacticsSafeInt(amount, 0)), Math.max(0, unit.hp - 1));
  if (hurt <= 0) return list;
  list[slotIndex] = applyTacticsDamage(list[slotIndex], hurt);
  return list;
};
// 倒れた子を戻す(回復カード)。立っていれば何もしない
const reviveTacticsAt = (units, slotIndex, rate = TACTICS_REVIVE_HP_RATE) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const unit = list[slotIndex] ? normalizeTacticsUnit(list[slotIndex]) : null;
  if (!unit || !unit.downed) return list;
  list[slotIndex] = reviveTacticsUnit(unit, rate);
  return list;
};
// 倒れた子へ回復カードを向けたとき、代わりに払う子。いちばんガッツが多い立っている子。
// ★倒れた子自身のガッツで払う形にすると、ガッツを使い切って倒れた子が永久に戻せなくなる。
//   立っている子が手を貸して起こす、という形にした
const tacticsReviveHelper = (units, slotIndex, cost) => {
  const list = Array.isArray(units) ? units : [];
  if (!list[slotIndex] || !normalizeTacticsUnit(list[slotIndex]).downed) return null;
  const need = Math.max(0, tacticsSafeInt(cost, 0));
  const helpers = tacticsAliveSlots(list)
    .filter(index => normalizeTacticsUnit(list[index]).guts >= need)
    .sort((a, b) => normalizeTacticsUnit(list[b]).guts - normalizeTacticsUnit(list[a]).guts);
  return helpers.length ? helpers[0] : null;
};
// そのカードを、そのスロットへ向けたときに実際に払う子。
// ふだんは本人。倒れた子へ回復カードを向けたときだけ、手を貸す子が払う
const tacticsPayerSlot = (units, slotIndex, cost, isHealCard = false) => {
  const list = Array.isArray(units) ? units : [];
  if (canTacticsSlotPay(list, slotIndex, cost)) return slotIndex;
  if (isHealCard) return tacticsReviveHelper(list, slotIndex, cost);
  return null;
};

// トレーニングで伸びたライフ上限を盤面へ配る。
// ★段階6で「1体ずつ選ぶ」形にする。それまでは素の上限に比例して配る(合算していた頃と同じ配分)。
// ★いまのライフは増やさない(トレーニングは上限を上げるだけ、という既存の挙動に合わせる)。
// ★配ったぶんの合計は必ず delta と一致させる。ずれるとパーティのライフと盤面が食い違う
const growTacticsMaxHp = (units, delta, hpPct = 0) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const add = tacticsSafeInt(delta, 0);
  if (add <= 0) return list;
  const filled = tacticsFilledSlots(list)
    .map(index => ({ index, base: normalizeTacticsUnit(list[index]).baseMaxHp }));
  const totalBase = filled.reduce((sum, entry) => sum + entry.base, 0);
  if (!filled.length || totalBase <= 0) return list;
  let handed = 0;
  const shares = filled.map(entry => {
    const value = Math.floor(add * entry.base / totalBase);
    handed += value;
    return { ...entry, value };
  });
  // 端数は素の上限が大きい子から1ずつ。合計を delta にぴったり合わせる
  const order = [...shares].sort((a, b) => b.base - a.base);
  for (let left = add - handed, i = 0; left > 0; i = (i + 1) % order.length, left--) order[i].value += 1;
  shares.forEach(entry => {
    if (entry.value <= 0) return;
    const target = normalizeTacticsUnit(list[entry.index]);
    list[entry.index] = scaleTacticsUnitMaxHp({ ...target, baseMaxHp: target.baseMaxHp + entry.value }, hpPct);
  });
  return list;
};

// トレーニングで伸びたちから・丈夫さを盤面へ配る。
// ★段階11で「1体ずつ選ぶ」形にする。それまでは、いまの値に比例して配る。
// ★倒れた子にも配る(起き上がったときに置いていかれないように)
const growTacticsAtkDef = (units, atkDelta, defDelta) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const spread = (key, delta) => {
    const add = tacticsSafeInt(delta, 0);
    if (add <= 0) return;
    const filled = tacticsFilledSlots(list)
      .map(index => ({ index, base: Math.max(1, normalizeTacticsUnit(list[index])[key]) }));
    const total = filled.reduce((sum, entry) => sum + entry.base, 0);
    if (!filled.length || total <= 0) return;
    let handed = 0;
    const shares = filled.map(entry => {
      const value = Math.floor(add * entry.base / total);
      handed += value;
      return { ...entry, value };
    });
    const order = [...shares].sort((a, b) => b.base - a.base);
    for (let left = add - handed, i = 0; left > 0; i = (i + 1) % order.length, left--) order[i].value += 1;
    shares.forEach(entry => {
      if (entry.value <= 0) return;
      const target = normalizeTacticsUnit(list[entry.index]);
      list[entry.index] = normalizeTacticsUnit({ ...target, [key]: target[key] + entry.value });
    });
  };
  spread('atk', atkDelta);
  spread('def', defDelta);
  return list;
};

// 立っている子を満タンへ(WAVEクリアの全回復)。★倒れた子はここでは戻らない
const fullHealTacticsBoard = (units) => (Array.isArray(units) ? units : []).map(unit => {
  if (!unit) return null;
  const target = normalizeTacticsUnit(unit);
  return target.downed ? target : { ...target, hp: target.maxHp };
});

// 20ターン経過など、一斉に倒れる場面。敗北の見え方をそろえる
const wipeTacticsBoard = (units) => (Array.isArray(units) ? units : [])
  .map(unit => (unit ? applyTacticsDamage(unit, Number.MAX_SAFE_INTEGER) : null));

// 全滅したか。★1体もいない盤面は「まだ始まっていない」ので全滅にしない
const isTacticsWipedOut = (units) => tacticsFilledSlots(units).length > 0 && tacticsAliveSlots(units).length === 0;
// そのスロットのカードを使えるか。倒れている子のカードは手札に残っていても選べない
const canTacticsSlotAct = (units, slotIndex) => tacticsAliveSlots(units).includes(slotIndex);

// ===== 供モンが合流すると敵も強くなる =====
//
// ★「何人増えたか」ではなく「連れてきた子の総合力」で決める(2026-09-19 ユーザーが選択)。
//   人数ごとの固定倍率にすると、弱い編成ほど苦しくなる。
// ★増えたぶんをそのまま倍率にすると跳ね上がるので、指数で緩める。
//   強く育てた子を連れていくほど敵も手ごわいが、弱い編成でも「多少はやれる」を残す。
// ★基準はバトルを始めた時点(勇者モン1体)の総合力。絶対値で決めないので、
//   育ちきった人にも育っていない人にも同じ手ざわりになる。
const TACTICS_ENEMY_POWER_EXPONENT = 0.7;
const TACTICS_ENEMY_POWER_MAX = 6;
const tacticsEnemyPowerMultiplier = (startPower, nowPower, exponent = TACTICS_ENEMY_POWER_EXPONENT) => {
  const start = Math.max(0, Number(startPower) || 0);
  const now = Math.max(0, Number(nowPower) || 0);
  if (!(start > 0) || !(now > start)) return 1;
  const safeExponent = Number.isFinite(Number(exponent)) ? Math.max(0, Number(exponent)) : TACTICS_ENEMY_POWER_EXPONENT;
  const raw = Math.pow(now / start, safeExponent);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(TACTICS_ENEMY_POWER_MAX, Math.max(1, raw));
};

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

// 予告の吹き出しへ出す「狙い」の呼び名。名前が無い子でも空欄にしない
const TACTICS_ALL_TARGET_LABEL = '全員';
const tacticsTargetName = (units, slotIndex) => {
  const unit = Array.isArray(units) ? units[slotIndex] : null;
  return (unit && String(unit.name || '').trim()) || `${slotIndex + 1}番目の子`;
};

// 敵の予告へ「誰を狙うか」を足す。
// ★全体攻撃(targetsAll)は狙いを決めない。立っている全員に当たるので、抽選するものが無い。
//   薙ぎ払いは間合いで当たる相手が決まるので、ここでは狙いを持たせず、
//   実行時に「その間合いにいる子」を見る(予告には間合いが出ている)。
// ★ダメージの無い行動(ためる・移動・咆哮・再生)にも狙いは要らない。
const TACTICS_TARGETED_TYPES = ['ATTACK', 'SPECIAL'];
const withTacticsTarget = (intent, units, random = Math.random, bias = TACTICS_TARGET_LOW_HP_BIAS) => {
  if (!intent || !TACTICS_TARGETED_TYPES.includes(intent.type)) return intent;
  if (intent.targetsAll) return { ...intent, targetName: TACTICS_ALL_TARGET_LABEL };
  if (intent.variant === 'sweep') return intent;
  const targetSlot = chooseTacticsTarget(units, random, bias);
  return targetSlot == null ? intent : { ...intent, targetSlot, targetName: tacticsTargetName(units, targetSlot) };
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
