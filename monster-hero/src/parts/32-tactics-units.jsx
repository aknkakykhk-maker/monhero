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

// 倒れた子の戻り方(2026-09-19 ユーザーが決めた形)。
// ★「ライフが全快になってはじめて復活」。倒れたあともライフは回復で貯まっていき、
//   上限まで届いたところで立ち上がる。回復カードでも緊急回復でも自動再生でも貯まる。
// ★つまり downed は「ライフが0かどうか」では決まらない。0から上限未満のあいだは
//   ライフを持ったまま倒れている。ここが以前の作り(0なら倒れている)との違い。
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
    // 「ライフ0なのに立っている」は作らない。上限まで戻ったら必ず立ち上がる。
    // そのあいだ(0 < hp < maxHp)は、倒れたままライフが貯まっている状態
    downed: hp <= 0 ? true : (hp >= maxHp ? false : !!unit.downed),
    atk: Math.max(0, tacticsSafeInt(unit.atk, 0)),
    def: Math.max(0, tacticsSafeInt(unit.def, 0)),
    guts: tacticsClamp(tacticsSafeInt(unit.guts, 0), 0, maxGuts),
    maxGuts,
    baseMaxGuts,
  };
};

// ダメージ。0になったらその子は倒れる
const applyTacticsDamage = (unit, damage) => {
  const target = normalizeTacticsUnit(unit);
  if (!target || target.downed) return target;
  const hp = Math.max(0, target.hp - Math.max(0, tacticsSafeInt(damage, 0)));
  return { ...target, hp, downed: hp <= 0 };
};

// 回復。★倒れている子にも入る。上限まで届いたところで立ち上がる(normalizeTacticsUnit が見る)
const healTacticsUnit = (unit, amount) => {
  const target = normalizeTacticsUnit(unit);
  if (!target) return target;
  return normalizeTacticsUnit({ ...target, hp: Math.min(target.maxHp, target.hp + Math.max(0, tacticsSafeInt(amount, 0))) });
};

// 倒れた子を一気に立たせる(WAVE後のトレーニングで「起こす」を選んだとき)。
// ★やっていることは「上限まで回復する」。全快になったら立ち上がる、という決まりは1つだけ
const reviveTacticsUnit = (unit) => {
  const target = normalizeTacticsUnit(unit);
  if (!target) return target;
  return normalizeTacticsUnit({ ...target, hp: target.maxHp });
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
// ★合計へ数えるのは「立っている子」だけ。倒れた子のライフは復活までの貯めなので、
//   ここへ入れると「全員倒れているのに合計が残っている」=敗北にならない、が起きる
const tacticsTotalHp = (units) => tacticsAliveSlots(units)
  .reduce((sum, index) => sum + normalizeTacticsUnit(units[index]).hp, 0);
const tacticsTotalMaxHp = (units) => (Array.isArray(units) ? units : [])
  .reduce((sum, unit) => sum + (unit ? normalizeTacticsUnit(unit).maxHp : 0), 0);
// ★ガッツもライフと同じく「立っている子だけ」を数える(2026-09-20 ユーザー指示)。
//   倒れた子のガッツを合計へ入れると、立っている子が全員満タンでも合計が上限に届かず、
//   リザルトの「強化ポイントでガッツ回復」が押せてしまう(押してもその子には入らないので
//   ポイントだけ減る)。現在値と上限の両方を外さないと、合計だけがちぐはぐになる
const tacticsTotalGuts = (units) => tacticsAliveSlots(units)
  .reduce((sum, index) => sum + normalizeTacticsUnit(units[index]).guts, 0);
const tacticsTotalBaseMaxGuts = (units) => tacticsAliveSlots(units)
  .reduce((sum, index) => sum + normalizeTacticsUnit(units[index]).baseMaxGuts, 0);
// ガッツを入れる余地が残っている子がいるか。★合計で見ない。
//   1体ずつは floor(素の上限×みゅあ補正)、合計は floor(素の上限の合計×補正) なので、
//   全員満タンでも切り捨ての差ぶん「合計 < 上限」になることがある(65が3人・+10%で 213 対 214)。
//   実際に配れるかは1体ずつでしか分からない
const tacticsHasGutsRoom = (units) => tacticsAliveSlots(units)
  .some(index => {
    const unit = normalizeTacticsUnit(units[index]);
    return unit.guts < unit.maxGuts;
  });
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

// 回復を盤面へ配る。足りない量に比例して配り、端数は足りない量の大きい子から埋める。
// 均等割りにすると、瀕死の子が置き去りのまま満タンの子へ回復が消える
// ★倒れた子にも配る。回復カード・緊急回復は「復活までの貯め」に乗る
//   (2026-09-19 ユーザーが決めた形)。足りない量が多いぶん、倒れた子へ多く入る
const healTacticsBoard = (units, amount) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const give = Math.max(0, tacticsSafeInt(amount, 0));
  if (give <= 0) return list;
  const missing = tacticsFilledSlots(list)
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
// ★回復には**全体回復と単体回復**がある(2026-09-19 ユーザーの整理)。
//     全体回復 … 回復カード・自動再生・緊急回復・吸収 → healTacticsBoard で盤面へ配る
//     単体回復 … ガードの余り(構えた子)・ドレイン(殴った子) → ここの healTacticsAt
//   「その効果が誰に起きたことか」で決まる。カードの持ち主では決まらない。
// ★倒れた子へも入る(復活までの貯めになる)。立っていることは条件にしない
const healTacticsAt = (units, slotIndex, amount) => {
  const list = (Array.isArray(units) ? units : []).slice();
  if (!list[slotIndex]) return list;
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
// 倒れた子を一気に立たせる(トレーニングの「起こす」)。中身は「上限まで回復する」
const reviveTacticsAt = (units, slotIndex) => {
  const list = (Array.isArray(units) ? units : []).slice();
  if (!list[slotIndex]) return list;
  list[slotIndex] = reviveTacticsUnit(list[slotIndex]);
  return list;
};
// トレーニングの結果を1体へ入れる。after は resolveTrainingStats が返した
// {atk,def,hp,guts}(hp / guts は「素の上限」)。
// ★1体ずつ選んだぶんを、その子だけへ入れる(段階11)
const applyTacticsTraining = (units, slotIndex, after, hpPct = 0, gutsPct = 0) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const target = list[slotIndex] ? normalizeTacticsUnit(list[slotIndex]) : null;
  if (!target || !after) return list;
  const grown = {
    ...target,
    atk: Math.max(0, tacticsSafeInt(after.atk, target.atk)),
    def: Math.max(0, tacticsSafeInt(after.def, target.def)),
    baseMaxHp: Math.max(1, tacticsSafeInt(after.hp, target.baseMaxHp)),
    baseMaxGuts: Math.max(0, tacticsSafeInt(after.guts, target.baseMaxGuts)),
  };
  list[slotIndex] = scaleTacticsUnitMaxGuts(scaleTacticsUnitMaxHp(grown, hpPct), gutsPct);
  return list;
};

// パーティのちから・丈夫さ。★ダメージには使わない(それは1体ずつの値)。
//   ガードの段階・攻撃段階(カードの枚数と威力)を決めるのに使う。
// ★合計にすると、人数が増えただけでガードが跳ね上がる。平均にする
const tacticsPartyStat = (units, key) => {
  const filled = tacticsFilledSlots(units);
  if (!filled.length) return 0;
  return Math.floor(filled.reduce((sum, index) => sum + normalizeTacticsUnit(units[index])[key], 0) / filled.length);
};
const tacticsPartyAtk = (units) => tacticsPartyStat(units, 'atk');
const tacticsPartyDef = (units) => tacticsPartyStat(units, 'def');
// ガード段階(手札に出るガードカードの段階と枚数)だけは「いちばん硬い子」で決める
// (2026-09-20 ユーザー指示)。平均だと、1体だけ壁役を育てても段階が上がらない。
// ★軽減量そのものは「構えた子の丈夫さ」で1体ずつ出している(ここは段階だけの話)
const tacticsMaxDef = (units) => tacticsFilledSlots(units)
  .reduce((best, index) => Math.max(best, normalizeTacticsUnit(units[index]).def), 0);

// 20ターン経過など、一斉に倒れる場面。敗北の見え方をそろえる
const wipeTacticsBoard = (units) => (Array.isArray(units) ? units : [])
  .map(unit => (unit ? applyTacticsDamage(unit, Number.MAX_SAFE_INTEGER) : null));

// 全滅したか。★1体もいない盤面は「まだ始まっていない」ので全滅にしない
const isTacticsWipedOut = (units) => tacticsFilledSlots(units).length > 0 && tacticsAliveSlots(units).length === 0;
// そのスロットのカードを使えるか。倒れている子のカードは手札に残っていても選べない
const canTacticsSlotAct = (units, slotIndex) => tacticsAliveSlots(units).includes(slotIndex);

// ===== スコア =====
//
// ★式は今までどおり。桁だけ 1/1000 へ縮める(2026-09-19 ユーザーが選択)。
//   いまの式は火力そのものなので、個別ステータスのままだと桁が大きくなりすぎて読めない。
// ★0にしない。1点でも入ったWAVEは1点残す(「何もしていない」と区別が付かなくなる)。
// ★記録もランキングも新モード専用の名前空間(mh_tactics_* / Tactics*)なので、
//   ほかのモードのスコアとは混ざらない。
const TACTICS_SCORE_DIVISOR = 1000;
const shrinkTacticsScore = (score) => {
  const raw = Math.floor(Number(score) || 0);
  if (!(raw > 0)) return 0;
  return Math.max(1, Math.floor(raw / TACTICS_SCORE_DIVISOR));
};

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

// ===== 複数ヒットに分かれる攻撃(連撃)の、ガードが届くぶんと通るぶん =====
// ★連撃は 0.6×3 の3ヒット。ガードが受け止められるのは **1ヒットぶんだけ** で、
//   残りの2ヒットはそのまま通る(2026-09-20 ユーザー指示)。
//   「合計から引く」に戻すと、厚いガード1枚で連撃を完全に止められてしまう。
// ★端数は「通るぶん」へ寄せて、guarded + through が必ず元の合計と一致するようにする。
// ★予告(予定ダメージ)と実行の両方がこの関数を通る。別々に数えると食い違う。
const splitTacticsGuardedHit = (incoming, hits) => {
  const total = Math.max(0, tacticsSafeInt(incoming, 0));
  const count = Math.max(1, tacticsSafeInt(hits, 1));
  const guarded = count > 1 ? Math.floor(total / count) : total;
  return { guarded, through: total - guarded };
};

// 1体ぶんの受け方。ガードが届く1ヒットぶんを相殺し、残りのヒットはそのまま通す。
// 返すのは**ターン軽減を掛ける前**の値(軽減は呼び出し側で掛ける)。
// ★連撃で1ヒットを消しきっても、余ったガードは余らせない(ライフ・ガッツにしない)。
//   余らせると「合計から引く」のと同じになり、厚いガード1枚で連撃が完全に止まってしまう。
// ★1ヒットの攻撃(hits=1)では through が0なので、いままでどおり
//   「余ったぶんがライフとガッツになる」が成り立つ。
// ★blocked は「ガードが1ヒットぶんを受け止めきったか」。演出(ガード成功)の判定に使う。
const resolveTacticsGuardedHit = (incoming, hits, guard) => {
  const { guarded, through } = splitTacticsGuardedHit(incoming, hits);
  const left = Math.max(0, tacticsSafeInt(guard, 0)) - guarded;
  if (left < 0) return { taken: -left + through, saved: 0, guarded, through, blocked: false };
  return through > 0
    ? { taken: through, saved: 0, guarded, through, blocked: true }
    : { taken: 0, saved: left, guarded, through, blocked: true };
};

// ===== 「2枚目以降は効果半減」の数え方 =====
// ★どこで数えるかをモードで変えられるようにするための、器だけの関数。
//   groupOf(slotIndex) が同じカードどうしで枚数を数える。
//     既存5モード … いつも同じ箱（＝そのターンの2枚目以降が半減）
//     新モード     … 枠ごとの箱（＝同じ子が2枚使ったときだけ半減。2026-09-20 ユーザー指示）
// ★isExempt(card) が true のカード（アシストカード）は対象外で、枚数にも数えない。
// ★実処理・カード選択中の予測・合計軽減の表示がすべてここを通る。
//   別々に数えると「予測より実際が弱い」が起きる。
//   peek は数えずに見るだけ、take は1枚使ったことにして、そのカードが半減だったかを返す。
const makeCardHalveCounter = (groupOf, isExempt) => {
  const used = {};
  const counts = (card) => !!card && !(typeof isExempt === 'function' && isExempt(card));
  const keyOf = (slotIndex) => String(typeof groupOf === 'function' ? groupOf(slotIndex) : 'turn');
  return {
    peek: (card, slotIndex) => counts(card) && (used[keyOf(slotIndex)] || 0) > 0,
    take: (card, slotIndex) => {
      if (!counts(card)) return false;
      const key = keyOf(slotIndex);
      const halved = (used[key] || 0) > 0;
      used[key] = (used[key] || 0) + 1;
      return halved;
    },
  };
};

// ===== 「その子の上限 × 率」で回復する =====
// ★1体ずつ自分の率で回す(2026-09-20 ユーザー指摘)。
//   合計の上限から量を出して配る形だと、
//     ・1体だけ傷ついているとき、パーティ全員ぶんの回復がその子へ丸ごと入る
//     ・倒れている子の上限も量の計算に入るので、倒れている子が多いほど
//       残った子がよけいに回復する(逆になっている)
//   の2つが起きる。個別のステータスに合わせて、1体ずつ自分の率で回す。
// ★ライフは includeDowned のときだけ倒れた子にも入れる(復活までの貯め)。
//   自動再生は false(勝手に復活させない)、回復カード・緊急回復は true。
// ★ガッツはいつも立っている子だけ(倒れた子はカードを使えない)。
// ★返す hp / guts は「実際に入ったぶん」。上限で頭打ちになったぶんは数えないので、
//   画面に出す数字と盤面の増え方が食い違わない。
const rateHealTacticsBoard = (units, hpRate, gutsRate, includeDowned = false) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const hpPct = Math.max(0, Number(hpRate) || 0);
  const gutsPct = Math.max(0, Number(gutsRate) || 0);
  const hpSlots = includeDowned ? tacticsFilledSlots(list) : tacticsAliveSlots(list);
  const gutsSlots = tacticsAliveSlots(list);
  let hp = 0, guts = 0;
  tacticsFilledSlots(list).forEach(index => {
    const before = normalizeTacticsUnit(list[index]);
    let next = list[index];
    if (hpPct > 0 && hpSlots.includes(index)) {
      const gain = Math.floor(before.maxHp * hpPct);
      if (gain > 0) next = healTacticsUnit(next, gain);
    }
    if (gutsPct > 0 && gutsSlots.includes(index)) {
      const gain = Math.floor(before.maxGuts * gutsPct);
      if (gain > 0) next = recoverTacticsGuts(next, gain);
    }
    const after = normalizeTacticsUnit(next);
    hp += after.hp - before.hp;
    guts += after.guts - before.guts;
    list[index] = next;
  });
  return { units: list, hp, guts };
};
// 1体だけを「その子の上限 × 率」で回復する。
// 固有技・アシストカードの効果が「使った子」へ入るときに通る
const rateHealTacticsAt = (units, slotIndex, hpRate, gutsRate) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const before = normalizeTacticsUnit(list[slotIndex]);
  if (!before) return { units: list, hp: 0, guts: 0 };
  let next = list[slotIndex];
  const hpGain = Math.floor(before.maxHp * Math.max(0, Number(hpRate) || 0));
  if (hpGain > 0) next = healTacticsUnit(next, hpGain);
  const gutsGain = Math.floor(before.maxGuts * Math.max(0, Number(gutsRate) || 0));
  if (gutsGain > 0 && !before.downed) next = recoverTacticsGuts(next, gutsGain);
  const after = normalizeTacticsUnit(next);
  list[slotIndex] = next;
  return { units: list, hp: after.hp - before.hp, guts: after.guts - before.guts };
};

// ===== あとから入った子の追いつき補正 =====
// ★供モンは WAVE 2 / 4 / 6 で加わる。加入ボーナス(plusStats)は使わず
//   **素のステータスをそのまま**盤面へ入れるが、勇者モンはそこまでにトレーニングを
//   受けているので、遅く入るほど見劣りする(2026-09-20 ユーザー指示)。
// ★そこで「クリアしたWAVE 1つにつき全ステ+10%」を基準に、加入する子へ積んで渡す。
//   実際の率は**そのWAVEを何ターンで抜けたか**で決める。速いほど厚い。
//     remainingTurns = 21 - そのWAVEに使ったターン数(スコア計算と同じ値)
//     率 = remainingTurns × 1%
//   1ターンで抜ければ +20%、11ターン(半分)で +10%、20ターンかかれば +1%、
//   時間切れなら 0%。
// ★WAVEごとに掛け算で積む(トレーニングと同じ複利)。5WAVEぶん10%なら ×1.61。
const TACTICS_JOIN_RATE_PER_TURN = 0.01;
const tacticsJoinWaveRate = (remainingTurns) => Math.max(0, tacticsSafeInt(remainingTurns, 0)) * TACTICS_JOIN_RATE_PER_TURN;
// クリアしたWAVEぶんを積み上げた倍率。加入した子のステータスへそのまま掛ける
const addTacticsJoinCatchUp = (multiplier, remainingTurns) => {
  const base = Math.max(1, Number(multiplier) || 1);
  return base * (1 + tacticsJoinWaveRate(remainingTurns));
};
// 加入した子へ積み上げた倍率を乗せる。
// ★みゅあ補正は素の上限(baseMaxHp)から計算し直す側で掛かるので、ここでは触らない
const applyTacticsJoinCatchUp = (unit, multiplier) => {
  const target = normalizeTacticsUnit(unit);
  if (!target) return unit;
  const rate = Math.max(1, Number(multiplier) || 1);
  const grow = (value) => Math.max(0, Math.floor(Math.max(0, tacticsSafeInt(value, 0)) * rate));
  const baseMaxHp = Math.max(1, grow(target.baseMaxHp));
  const baseMaxGuts = Math.max(0, grow(target.baseMaxGuts));
  return normalizeTacticsUnit({
    ...target,
    baseMaxHp, maxHp: baseMaxHp, hp: baseMaxHp,
    baseMaxGuts, maxGuts: baseMaxGuts,
    guts: Math.floor(baseMaxGuts * TACTICS_START_GUTS_RATE),
    atk: grow(target.atk),
    def: grow(target.def),
  });
};
