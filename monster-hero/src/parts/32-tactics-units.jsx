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
  // ★間合い攻撃も「誰を狙うか」を決める(2026-09-22 ユーザー指示「誰に攻撃するかが大事」)。
  //   予告した間合いに立っている子がいればその子(敵と同じ距離なので当たり)。
  //   いなければ、ほかの技と同じ決め方で1体選ぶ(そのときは距離が違うので威力が落ちる)。
  //   以前はここで何も決めず、狙い先を「予告した間合いにいる子」から探していたため、
  //   誰も立っていない間合いだと攻撃そのものが起きなかった
  const sweepSlot = intent.variant === 'sweep' && Number.isInteger(intent.sweepDist)
    && tacticsAliveSlots(units).includes(intent.sweepDist) ? intent.sweepDist : null;
  const targetSlot = sweepSlot != null ? sweepSlot : chooseTacticsTarget(units, random, bias);
  return targetSlot == null ? intent : { ...intent, targetSlot, targetName: tacticsTargetName(units, targetSlot) };
};
// その行動が実際に当たるスロット。予告と実行で同じ関数を通すので食い違わない
// 間合い攻撃が「当たり」(×TACTICS_SWEEP_MULT)になる条件。
// ★見るのは2つだけ。**敵がどの距離にいるか**と、**狙われた子がどの距離にいるか**
//   (2026-09-22 ユーザー指示「誰に攻撃するかが大事で、それに対して敵がどの距離で
//    狙われた味方がどの距離かを見るんだよ」)。同じならフルの威力、違えば威力が落ちる。
//   味方の枠＝その子の間合いなので、狙われた子の距離は targetSlot そのもの。
// ★予告した間合い(sweepDist)は「敵がどこから薙ぐか」の見出しであって、当たり外れの材料ではない。
//   ここを sweepDist で見ていたころは、その間合いに誰も立っていないと狙いが空になり、
//   ダメージそのものが起きなかった。
// ★狙いが付いていない予告(既存5モード・古い保存)は true。ここで既存モードの振る舞いを変えない
const isTacticsSweepOnSpot = (intent, units, enemyDist) => {
  if (!intent || intent.variant !== 'sweep') return true;
  if (!Number.isInteger(intent.targetSlot)) return true;
  return enemyDist === intent.targetSlot;
};
// 外れた間合い攻撃は威力を missValue へ落とす。★予告(画面)と実行(processTurn)が
// この1つを通るので、「予定より減った・増えた」が起きない
const tacticsSweepIntent = (intent, units, enemyDist) =>
  (intent && intent.variant === 'sweep' && !isTacticsSweepOnSpot(intent, units, enemyDist))
    ? { ...intent, value: Math.max(0, Math.floor(Number(intent.missValue) || 0)) }
    : intent;

const tacticsIntentTargets = (intent, units, enemyDist = null) => {
  const alive = tacticsAliveSlots(units);
  if (!intent || !alive.length) return [];
  if (intent.targetsAll) return alive;
  // ★間合い攻撃は「**予告した間合い**にいる子」を狙う。距離撃で敵を動かしても狙いは変わらず、
  //   威力だけが落ちる(missValue ＝ ×TACTICS_SWEEP_MISS_MULT)。
  //   2026-09-22 ユーザー指摘「近距離にいる場合は1.2倍攻撃だけど敵を移動させて中距離とかに
  //   させたら狙われてるモンスターが0.4倍攻撃に変わるイメージ」。
  //   ここを enemyDist(いまの敵の間合い)にすると、ずらした先の**別の子**が食らってしまう
  // ★間合い攻撃も、ほかの技と同じく「狙う子」(targetSlot)で決まる(2026-09-22 ユーザー指示)。
  //   狙いが付いていない予告(古い保存など)だけ、不発にしないための保険を通す
  if (intent.variant === 'sweep' && !Number.isInteger(intent.targetSlot)) {
    const dist = Number.isInteger(intent.sweepDist) ? intent.sweepDist : enemyDist;
    const onSpot = alive.filter(index => index === dist);
    if (onSpot.length) return onSpot;
    const nearest = alive.reduce((best, index) =>
      (best === null || Math.abs(index - dist) < Math.abs(best - dist)) ? index : best, null);
    return nearest === null ? [] : [nearest];
  }
  return Number.isInteger(intent.targetSlot) && alive.includes(intent.targetSlot) ? [intent.targetSlot] : [];
};

// ===== ガードの数え方(2026-09-22 ユーザー指示の新仕様) =====
// 決めごとは3つ。どれも「枚数をどう配ったか」で変わる。
//
//   ① ガードは **1ヒットごと** に効く。3連撃300(各100)をガード150で受け止めると、
//      1ヒットずつ150が当たるので全部止まる(合計同士で引き算しない)
//   ② 同じ子へ **2枚以上** 構えると「連撃ガード」。その子は連撃の **全ヒット** を、
//      構えた値の合計で受け止める(1枚なら今までどおり1ヒットぶん)
//   ③ **2体以上** へ別々に構えると「全体ガード」。構えていない子にも
//      「その子の丈夫さ × ガード段階の倍率」ぶんのガードが付く(固定値は乗らない)
//
// ②と③は**同時に成り立つ**(ユーザー確認済み)。Aに2枚・Bに1枚なら、
// Aは合計値の連撃ガード、Bは自分の1枚ぶん、残りの子は丈夫さぶん。
//
// ★端数は「通るぶん」へ寄せて、guarded + through が必ず元の合計と一致するようにする。
// ★予告(予定ダメージ)と実行の両方がこの関数を通る。別々に数えると食い違う。
const TACTICS_RUSH_GUARD_CARDS = 2;    // 同じ子へこれだけ構えると連撃ガード
const TACTICS_SPREAD_GUARD_SLOTS = 2;  // これだけの子が別々に構えると全体ガード
// その枠が受け止めるヒット数。2枚以上なら連撃の全部、1枚なら1ヒットぶん。
// ★数えるのは**枚数**(cards)。厚さ(flat/mult)や重み(weight)では増えない
const tacticsGuardHits = (cards, hits = 1) =>
  (Math.max(0, tacticsSafeInt(cards, 0)) >= TACTICS_RUSH_GUARD_CARDS)
    ? Math.max(1, tacticsSafeInt(hits, 1)) : 1;
// 全体ガードになっているか。2体以上が別々に構えているとき
const isTacticsSpreadGuard = (guardBySlot) => Object.values(guardBySlot || {})
  .filter(entry => entry && tacticsSafeInt(entry.cards, 0) > 0).length >= TACTICS_SPREAD_GUARD_SLOTS;

const splitTacticsGuardedHit = (incoming, hits, guardHits = 1) => {
  const total = Math.max(0, tacticsSafeInt(incoming, 0));
  const count = Math.max(1, tacticsSafeInt(hits, 1));
  // 受け止められるのは、構えた枚数ぶんのヒットまで(ヒット数を超えては数えない)
  const covered = Math.min(count, Math.max(1, tacticsSafeInt(guardHits, 1)));
  const perHit = count > 1 ? Math.floor(total / count) : total;
  const guarded = perHit * covered;
  return { guarded, through: total - guarded, covered, hits: count, perHit };
};

// 1体ぶんの受け方。ガードが届くヒットぶんを相殺し、残りのヒットはそのまま通す。
// 返すのは**ターン軽減を掛ける前**の値(軽減は呼び出し側で掛ける)。
// ★連撃でヒットを消しきっても、余ったガードは余らせない(ライフ・ガッツにしない)。
//   余らせると「合計から引く」のと同じになり、厚いガード1枚で連撃が完全に止まってしまう。
// ★1ヒットの攻撃(hits=1)では through が0なので、いままでどおり
//   「余ったぶんがライフとガッツになる」が成り立つ。
// ★blocked は「ガードが届いたヒットを受け止めきったか」。演出(ガード成功)の判定に使う。
// ★covered は「ガードが受け止めたヒット数」。画面に「ガードは◯ヒットぶん」と出すのに使う。
// ★通ったぶんを「1ヒットずつ」に割る。60が3ヒットなら 20 / 20 / 20。
//   端数はいちばん最後のヒットへ寄せて、足すと必ず元の合計に戻るようにする
//   (2026-09-21 ユーザー指示「敵の3連撃なら3回ダメージ表記が出るようにして
//    60なら20、20，20みたいな」)
const splitTacticsHitAmounts = (total, count) => {
  const amount = Math.max(0, tacticsSafeInt(total, 0));
  const times = Math.max(1, tacticsSafeInt(count, 1));
  if (amount <= 0) return [];
  if (times <= 1) return [amount];
  const per = Math.floor(amount / times);
  const parts = new Array(times - 1).fill(per);
  parts.push(amount - per * (times - 1));
  return parts;
};

// 発ごとの通る量。ガードが当たった発は軽減され、当たらなかった発はそのまま通る。
// ★端数は最後の発へ寄せて、足すと必ず元の合計に戻るようにする
// ★ここを「合計を均等に割る」に戻すと、ガードが効いた発とそうでない発が同じ数字で出て、
//   「ガードを入れたのに全部同じダメージ」に見える(2026-09-22 ユーザー指摘)
const splitTacticsGuardedAmounts = (incoming, hits, guard, guardHits = 1) => {
  const total = Math.max(0, tacticsSafeInt(incoming, 0));
  const count = Math.max(1, tacticsSafeInt(hits, 1));
  const { covered, perHit } = splitTacticsGuardedHit(total, count, guardHits);
  const value = Math.max(0, tacticsSafeInt(guard, 0));
  const amounts = [];
  for (let i = 0; i < count; i += 1) {
    const base = i === count - 1 ? total - perHit * (count - 1) : perHit;
    amounts.push(i < covered ? Math.max(0, base - value) : base);
  }
  return amounts;
};
// 発ごとの通る量を、実際に受けた合計(ターン軽減のあと)へ合わせて割り直す。
// 端数は最後の発へ寄せるので、足すと必ずその合計に戻る
const scaleTacticsHitAmounts = (parts, total) => {
  const list = (Array.isArray(parts) ? parts : []).map(value => Math.max(0, tacticsSafeInt(value, 0)));
  const sum = list.reduce((acc, value) => acc + value, 0);
  const goal = Math.max(0, tacticsSafeInt(total, 0));
  if (!(sum > 0) || !(goal > 0)) return [];
  const out = list.map(value => Math.floor(goal * value / sum));
  out[out.length - 1] += goal - out.reduce((acc, value) => acc + value, 0);
  return out;
};

const resolveTacticsGuardedHit = (incoming, hits, guard, guardHits = 1) => {
  const { guarded, through, covered, perHit } = splitTacticsGuardedHit(incoming, hits, guardHits);
  // ★構えた値は「1ヒットごと」にまるごと当たる(2026-09-22 ユーザー指示)。
  //   受け止めきれなかったぶんだけ、止めようとしたヒットの数だけ通る
  const amounts = splitTacticsGuardedAmounts(incoming, hits, guard, guardHits);
  const left = Math.max(0, tacticsSafeInt(guard, 0)) - perHit;
  if (left < 0) return { taken: (-left) * covered + through, saved: 0, guarded, through, covered, amounts, blocked: false };
  // ★余りは1ヒットぶんで数える。受け止めたヒットの数だけ足すと、連撃を止めただけで
  //   ライフとガッツが膨れ上がってしまう
  return through > 0
    ? { taken: through, saved: 0, guarded, through, covered, amounts, blocked: true }
    : { taken: 0, saved: left, guarded, through, covered, amounts, blocked: true };
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
// 倒れた子が毎ターン戻るぶん(2026-09-21 ユーザー指示「死んだら毎ターン10%は回復する仕様に
// 変更 何もしなくても10ターンで生き返れる」)。その子の上限の10%なので、何もしなくても
// 10ターンで満タンに戻り、そこで立ち上がる(復活の決まりは「上限まで届くこと」ひとつだけ)。
// ★2026-09-20 の「勝手に起きる回復では復活しない」をここで覆した。当時の心配
//   (何もしなくても毎ターン貯まって、誰も倒れたままにならない)は10ターンという長さで受け止める。
//   回復カード・緊急回復で早められるのは今までどおり
const TACTICS_DOWNED_REGEN_RATE = 0.1;

// 倒れている子だけを、その子の上限の率で戻す。
// ★立っている子には入れない(そちらは rateHealTacticsBoard がバフの率で別に回す)。
// ★ガッツは戻さない。倒れている子はカードを使えないので、戻しても行き場がない
const regenDownedTacticsBoard = (units, rate = TACTICS_DOWNED_REGEN_RATE) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const pct = Math.max(0, Number(rate) || 0);
  const healed = {};
  let hp = 0;
  if (pct > 0) {
    tacticsDownedSlots(list).forEach(index => {
      const before = normalizeTacticsUnit(list[index]);
      const gain = Math.floor(before.maxHp * pct);
      if (gain <= 0) return;
      const next = healTacticsUnit(list[index], gain);
      const got = normalizeTacticsUnit(next).hp - before.hp;
      if (got > 0) { healed[index] = got; hp += got; }
      list[index] = next;
    });
  }
  return { units: list, hp, healed };
};

const rateHealTacticsBoard = (units, hpRate, gutsRate, includeDowned = false) => {
  const list = (Array.isArray(units) ? units : []).slice();
  const hpPct = Math.max(0, Number(hpRate) || 0);
  const gutsPct = Math.max(0, Number(gutsRate) || 0);
  const hpSlots = includeDowned ? tacticsFilledSlots(list) : tacticsAliveSlots(list);
  const gutsSlots = tacticsAliveSlots(list);
  // ★誰にいくつ入ったかも返す(healed / gutsHealed)。合計だけでは、4体のうち
  //   誰が戻ったのか画面から分からない(2026-09-21 ユーザー指摘)
  let hp = 0, guts = 0;
  const healed = {}, gutsHealed = {};
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
    const gotHp = after.hp - before.hp, gotGuts = after.guts - before.guts;
    if (gotHp > 0) healed[index] = gotHp;
    if (gotGuts > 0) gutsHealed[index] = gotGuts;
    hp += gotHp;
    guts += gotGuts;
    list[index] = next;
  });
  return { units: list, hp, guts, healed, gutsHealed };
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

// ===== 追いつき補正・間合いのボーナス側 =====
// ★間合いのボーナス(distDmgBonus)は「その間合いで与えたダメージ」で伸びるので、
//   あとから埋まった間合いは0から始まってしまう。勇者モンの間合いにはWAVE1から
//   積み上がっているため、ステータスをそろえても火力だけが置いていかれる
//   (2026-09-21 ユーザー指示「追いつき補正で距離ボーナスも乗せないとだね」)。
// ★考え方はステータス側と同じで、クリアしたWAVEごとに残りターンで倍率を積む。
//   違うのは2つだけ。
//     ・ベース値はその子の素の値ではなく「これまでの合計ダメージ」で見る
//     ・残りターン10がベース値どおりになる基準で、そこより速いか遅いかで上下する
// ★ここで言う上下は「ベース値より上か下か」であって、**もらえるボーナスが
//   マイナスになるわけではない**(2026-09-21 ユーザー指摘)。倍率が1を割るだけで、
//   引き上げる値そのものは必ず0以上。
//   残り20ターン(1ターンで抜けた)ならベース値の1.1倍、残り10ターンならベース値どおり、
//   残り0ターン(時間切れ)でもベース値の0.9倍は残る。
const TACTICS_JOIN_DIST_BASE_TURNS = 10;
const tacticsJoinDistWaveRate = (remainingTurns) =>
  (Math.max(0, tacticsSafeInt(remainingTurns, 0)) - TACTICS_JOIN_DIST_BASE_TURNS) * TACTICS_JOIN_RATE_PER_TURN;
// クリアしたWAVEぶんを積み上げた倍率。合計ダメージから出したベース値へ掛ける
const addTacticsJoinDistCatchUp = (multiplier, remainingTurns) => {
  const base = Math.max(0, Number(multiplier) || 0);
  return Math.max(0, base * (1 + tacticsJoinDistWaveRate(remainingTurns)));
};
// 合計ダメージと積み上げた倍率から、加入する子の間合いへ渡すボーナスを出す
const tacticsJoinDistBonus = (totalDamage, perDamage, multiplier) => {
  const damage = Math.max(0, Number(totalDamage) || 0);
  const rate = Math.max(0, Number(perDamage) || 0);
  const mult = Math.max(0, Number(multiplier) || 0);
  return damage * rate * mult;
};
// 今回あたらしく入った枠だけ、間合いのボーナスを追いつかせる。
// ★すでに積み上がっている値より低いときは下げない。間合いのボーナスは枠ごとの配列を
//   パーティで共有しているので、下げるとそこへ立っていた子のぶんまで削れてしまう
const applyTacticsJoinDistBonus = (bonusList, joinedSlots, bonus) => {
  const list = Array.isArray(bonusList) ? bonusList : [];
  const joined = Array.isArray(joinedSlots) ? joinedSlots : [];
  const gained = Math.max(0, Number(bonus) || 0);
  if (!joined.length || !(gained > 0)) return list;
  return list.map((value, index) => {
    const now = Math.max(0, Number(value) || 0);
    return joined.includes(index) ? Math.max(now, gained) : now;
  });
};
// 盤面の子と編成の子が同じかどうか。盤面を作り直す側と、加入した枠を数える側で
// 同じ判定を使う(別々に書くと「入れ替えたのに追いつかない」事故になる)
const isSameTacticsUnit = (unit, mon) =>
  !!(unit && mon && unit.id === (mon.id || null) && unit.masuId === (mon.masuId ?? null));
// 前の盤面と新しい編成を突き合わせて、今回あたらしく入った枠の番号を返す
const tacticsJoinedSlots = (units, nextSlots) => {
  const before = Array.isArray(units) ? units : [];
  const list = Array.isArray(nextSlots) ? nextSlots : [];
  const joined = [];
  list.forEach((mon, index) => {
    if (!mon) return;
    if (!isSameTacticsUnit(before[index], mon)) joined.push(index);
  });
  return joined;
};

// ===== 枠ごとのターンバフ(タクティクスだけ) =====
// ★「その子だけに効く」効果は nextTurnBuffs.bySlot = { 枠: {キー:値} } に置く。
//   ターンの入れ替え(nextTurnBuffs を丸ごと turnBuffs へ移す)も、WAVEのリセット
//   (setTurnBuffs({}))も今までの仕掛けがそのまま効くので、新しい state を増やさない。
//   既存5モードはここを使わず、今までどおり全体のターンバフ(turnBuffs)だけを見る。
// ★入っているもの(2026-09-22時点)
//     atkMult               … みゃるの薬(次ターンの攻撃倍率)
//     zeroGuts              … ピクシー/ミーアの固有技(次ターン、攻撃カードの消費0)
//     guaranteedCrit        … タイガーの固有技(次ターン、会心確定)
//     takenDamageMult       … アーク/イブリースの贖罪(次ターン、被ダメ半減)
//     gutsCostMult          … 同上(次ターン、消費ガッツ+15%)
//     pandoraResonanceTurns … パンドラの共鳴(2ターン、消費ガッツ半減)
//   モノリスの反射とメロソの被ダメ減は**味方全体**のままなので、ここには入れない
const tacticsSlotFlag = (bySlot, slotIndex, key) => ((bySlot || {})[slotIndex] || {})[key] === true;
const tacticsSlotRate = (bySlot, slotIndex, key, fallback = 1) => {
  const value = Number(((bySlot || {})[slotIndex] || {})[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const tacticsSlotTurns = (bySlot, slotIndex, key) => {
  const value = Math.floor(Number(((bySlot || {})[slotIndex] || {})[key]));
  return Number.isFinite(value) && value > 0 ? value : 0;
};
// 枠ごとのバフを1つ書き込む。★同じターンに2人が使っても消し合わないよう、枠ごとに足す
const withTacticsSlotBuff = (bySlot, slotIndex, key, value) => ({
  ...(bySlot || {}),
  [slotIndex]: { ...((bySlot || {})[slotIndex] || {}), [key]: value },
});
// ターンが変わるときの持ち越し。★複数ターン続くもの(パンドラの共鳴)だけ1ずつ減らして残す。
//   同じ枠へ新しく予約が入っていたら、そちらを優先する(張り直し)
const carryTacticsSlotBuffs = (nextBySlot, currentBySlot, key) => {
  const merged = { ...(nextBySlot || {}) };
  Object.entries(currentBySlot || {}).forEach(([slot, own]) => {
    const left = Math.max(0, Math.floor(Number((own || {})[key]) || 0) - 1);
    if (left > 0 && (merged[slot] || {})[key] == null) merged[slot] = { ...(merged[slot] || {}), [key]: left };
  });
  return merged;
};
// 使い切ったフラグを落とす(ピクシー/ミーアの消費0は、そのターンのカードを使ったら終わり)
const clearTacticsSlotFlag = (bySlot, key) => {
  const next = {};
  Object.entries(bySlot || {}).forEach(([slot, own]) => {
    const rest = { ...(own || {}) };
    delete rest[key];
    if (Object.keys(rest).length > 0) next[slot] = rest;
  });
  return next;
};

// ==== タクティクス専用 EXスキル(STEP1: 共通基盤) ====
//
// 設計の正本: docs/spec/TACTICS_EX_SKILLS.md
//
// ★モンスターごとの if を本体へ書かない。1体ぶんの決めごとは TACTICS_EX_SKILLS の1行に書き、
//   本体は「回数・併用・効果の続く長さ」をこの純関数で数えるだけにする。20体へ増やしても本体は変わらない
// ★EXはカードではない。1ターンに選べる枚数(cardLimit)にも、👑の+1にも数えない
// ★回数は1ランぶん。WAVEが変わっても戻らない。新しいランでは createTacticsExState からやり直す
// ★保存はしない。ランそのものがメモリの中だけにあり(中断・再開の保存が無い)、それに合わせる
//
// 1体ぶんの項目:
//   id        … EXスキルのid(あとから変えない。ログや今後の記録の手がかり)
//   name      … 画面に出す名前
//   desc      … 効果の説明(画面にそのまま出す)
//   maxUses   … 1ランで使える回数。unlimited:true なら数えない
//   withCards … 同じターンにその子が通常カードも使えるか。false なら「使ったターン、**その子は**カードを使えない」
//               ★止まるのは使った子だけ。ほかの子はいつもどおりカードを使える(2026-09-23 ユーザー指示
//                 「EXで他行動禁止はそのモンスターだけ」)
//   duration  … 効果の続く長さ。'turn'(発動ターン) / 'wave'(発動WAVEの終わりまで) / 'toggle'(もう一度使うまで)
//   toggleLabels … duration:'toggle' のときの [切り替える前, 切り替えたあと] の呼び名
//   conditions … 使うための追加の条件(TACTICS_EX_CONDITIONS のキー)。無ければ空
//   conditionText … 条件を画面に出すときの文(任意)
//   effect    … 効果の種類。中身は TACTICS_EX_IMPLEMENTED_EFFECTS に入ったものだけが動く
const TACTICS_EX_DURATION_TEXT = Object.freeze({
  turn: '発動したターンだけ',
  wave: '発動したWAVEが終わるまで',
  toggle: 'もう一度使って切り替えるまで',
});
const TACTICS_EX_SKILLS = Object.freeze({
  Monol: Object.freeze({
    id: 'monol_cover_all',
    name: 'みんなをかばう',
    desc: 'そのターンの敵の攻撃を、単体・全体・連撃までまとめてモノリスが引き受ける。',
    maxUses: 3, unlimited: false, withCards: true, duration: 'turn',
    effect: 'coverAll',
  }),
  Golem: Object.freeze({
    id: 'golem_all_in',
    name: '捨て身',
    desc: '丈夫さを0にし、0にした丈夫さの50%を力へ加える。',
    maxUses: 3, unlimited: false, withCards: false, duration: 'wave',
    // ★効果中にもう一度使っても何も変わらない(丈夫さはもう0)。回数だけ減るのを防ぐ
    conditions: Object.freeze(['notActive']),
    effect: 'allIn',
  }),
  KenshiMocchi: Object.freeze({
    id: 'kenshi_mocchi_weapon_change',
    name: 'ソード・コンバージョン',
    desc: '二刀流と片手持ちを切り替える。片手持ちのあいだは力と同じ数値を丈夫さへ加える。固有技は使えるが、ソードスキルの効果は出ない。',
    maxUses: 0, unlimited: true, withCards: false, duration: 'toggle',
    toggleLabels: Object.freeze(['二刀流', '片手持ち']),
    effect: 'weaponChange',
  }),
});
// 追加の条件。ctx を受け取り、使えないときだけ理由の文を返す(使えるなら null)。
// ctx: { active(その子のEXがいま効いているか) }
// 条件の中身を本体へ書かずにここへ集めるので、EXを足すときは定義に名前を書くだけで済む
const TACTICS_EX_CONDITIONS = Object.freeze({
  notActive: (ctx) => (ctx && ctx.active ? '効果が続いているあいだは使えない' : null),
});
// 効果を実装済みの種類。★ここに無い effect は「回数と併用の決まりだけ動き、効果はまだ出ない」。
//   画面は「開発中」と出す(使ったのに何も起きない、を黙って出さない)。
//   STEP2 で効果を入れたら、ここへ名前を足す
const TACTICS_EX_IMPLEMENTED_EFFECTS = Object.freeze(['coverAll', 'allIn', 'weaponChange']);
// 捨て身で力へ移す割合(0にした丈夫さの50%)
const TACTICS_EX_ALL_IN_ATK_RATE = 0.5;
const TACTICS_EX_DURATIONS = Object.freeze(['turn', 'wave', 'toggle']);

// 定義を安全な形へそろえる。壊れた項目があっても落とさず、いちばん控えめな既定値へ倒す
const normalizeTacticsExDef = (raw) => {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const unlimited = raw.unlimited === true;
  const duration = TACTICS_EX_DURATIONS.includes(raw.duration) ? raw.duration : 'turn';
  const toggleLabels = Array.isArray(raw.toggleLabels) && raw.toggleLabels.length === 2
    ? raw.toggleLabels.map(String) : ['OFF', 'ON'];
  return {
    id: raw.id,
    name: String(raw.name || raw.id),
    desc: String(raw.desc || ''),
    maxUses: unlimited ? 0 : Math.max(0, tacticsSafeInt(raw.maxUses, 0)),
    unlimited,
    // ★併用できるかが書かれていなければ「併用できない」へ倒す(強すぎる側へ倒さない)
    withCards: raw.withCards === true,
    duration,
    toggleLabels,
    conditions: Array.isArray(raw.conditions) ? raw.conditions.filter(k => typeof TACTICS_EX_CONDITIONS[k] === 'function') : [],
    conditionText: raw.conditionText ? String(raw.conditionText) : null,
    effect: typeof raw.effect === 'string' ? raw.effect : null,
  };
};
// そのモンスターのEX。持っていなければ null
const tacticsExDefOf = (monId, table = TACTICS_EX_SKILLS) =>
  (monId && table && Object.prototype.hasOwnProperty.call(table, monId) ? normalizeTacticsExDef(table[monId]) : null);
const isTacticsExEffectImplemented = (def, implemented = TACTICS_EX_IMPLEMENTED_EFFECTS) =>
  !!(def && def.effect && implemented.includes(def.effect));

// ラン中の状態。枠(スロット)ごとに持つ(配置はラン中に変わらないので枠で数えてよい)。
// ★念のため monId も持ち、枠の子が違えば「その子はまだ使っていない」として数える
//   uses[slot]    = { monId, count }                1ランで使った回数
//   effects[slot] = { monId, exId, duration, wave, turn, on }   いま載っている効果
//   lastUse[slot] = { wave, turn }                  同じ子は1ターンに1回まで
//   turnUsed      = { wave, turn }                  このターンにだれかがEXを使ったか
//   cardLock[slot]= { wave, turn }                  このターン、その子はカードを使えない(使った子だけ)
const createTacticsExState = () => ({ uses: {}, effects: {}, lastUse: {}, turnUsed: null, cardLock: {} });
const normalizeTacticsExState = (state) => {
  const base = createTacticsExState();
  if (!state || typeof state !== 'object') return base;
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const stamp = (v) => (v && typeof v === 'object' && Number.isFinite(Number(v.wave)) && Number.isFinite(Number(v.turn))
    ? { wave: tacticsSafeInt(v.wave, 0), turn: tacticsSafeInt(v.turn, 0) } : null);
  return { uses: obj(state.uses), effects: obj(state.effects), lastUse: obj(state.lastUse),
    turnUsed: stamp(state.turnUsed), cardLock: obj(state.cardLock) };
};
const sameTacticsExTurn = (stamp, now) => !!(stamp && now
  && tacticsSafeInt(stamp.wave, -1) === tacticsSafeInt(now.wave, -2)
  && tacticsSafeInt(stamp.turn, -1) === tacticsSafeInt(now.turn, -2));
const tacticsExUsesOf = (state, slot, monId) => {
  const own = normalizeTacticsExState(state).uses[slot];
  return own && own.monId === monId ? Math.max(0, tacticsSafeInt(own.count, 0)) : 0;
};
// 残りの回数。無制限なら left は Infinity(画面は「無制限」と出す)
const tacticsExRemaining = (def, count) => {
  if (!def) return { unlimited: false, max: 0, left: 0, used: 0 };
  const used = Math.max(0, tacticsSafeInt(count, 0));
  if (def.unlimited) return { unlimited: true, max: Infinity, left: Infinity, used };
  return { unlimited: false, max: def.maxUses, left: Math.max(0, def.maxUses - used), used };
};
// その子のEXの効果が、いま(now = { wave, turn })効いているか。
// ★時間で切れるものは「見るたびに数え直す」。WAVEの切り替わりで消す処理を別に持たないので、
//   消し忘れで次のWAVEへ持ち越すことが起きない
const isTacticsExEffectActive = (state, slot, monId, now) => {
  const effect = normalizeTacticsExState(state).effects[slot];
  if (!effect || effect.monId !== monId) return false;
  if (effect.duration === 'toggle') return effect.on === true;
  if (effect.duration === 'wave') return !!now && tacticsSafeInt(effect.wave, -1) === tacticsSafeInt(now.wave, -2);
  return sameTacticsExTurn(effect, now);
};
// このターンは他のカードを使えないか(併用できないEXを使ったターン)
// ★枠ごと。止まるのはEXを使った子だけ
const isTacticsExCardLocked = (state, slot, now) => sameTacticsExTurn(normalizeTacticsExState(state).cardLock[slot], now);
// このターンにカードを使えない枠の一覧
const tacticsExLockedSlots = (state, now) => Object.keys(normalizeTacticsExState(state).cardLock)
  .map(Number).filter(slot => Number.isInteger(slot) && isTacticsExCardLocked(state, slot, now));
// このターンにだれかがEXを使ったか(カードを使わずにターンを進められるようにする)
const isTacticsExTurnUsed = (state, now) => sameTacticsExTurn(normalizeTacticsExState(state).turnUsed, now);

// 使えるかどうか。使えないときは理由を1つだけ返す(画面の灰色のボタンの下へ出す)。
//   alive         … その子が立っているか(倒れた子はカードと同じくEXも使えない)
//   selectedCount … このターンに**その子へ**置いたカードの枚数(ほかの子へ置いたカードは数えない)
//   busy          … 行動中・AUTO中
const checkTacticsExUse = ({ def, state, slot, monId, alive, selectedCount = 0, now, busy = false } = {}) => {
  if (!def) return { ok: false, reason: 'EXスキルを持っていない' };
  if (busy) return { ok: false, reason: '行動中は使えない' };
  if (!alive) return { ok: false, reason: '倒れているあいだは使えない' };
  const safe = normalizeTacticsExState(state);
  const remaining = tacticsExRemaining(def, tacticsExUsesOf(safe, slot, monId));
  if (!remaining.unlimited && remaining.left <= 0) return { ok: false, reason: 'このランで使える回数が残っていない' };
  if (sameTacticsExTurn(safe.lastUse[slot], now)) return { ok: false, reason: 'このターンはもう使った' };
  if (!def.withCards && Math.max(0, tacticsSafeInt(selectedCount, 0)) > 0) {
    return { ok: false, reason: 'この子にカードを置いていると使えないEX。先にこの子のカードを外す' };
  }
  const active = isTacticsExEffectActive(safe, slot, monId, now);
  for (const key of def.conditions || []) {
    const why = TACTICS_EX_CONDITIONS[key] ? TACTICS_EX_CONDITIONS[key]({ active }) : null;
    if (why) return { ok: false, reason: why };
  }
  return { ok: true, reason: null };
};
// 使ったあとの状態を返す(渡された state は書き換えない)。
// ★回数を減らすのは無制限でないときだけ。無制限は数えるが、残りには効かない
// snapshot … 使った瞬間の値(捨て身なら使ったときの丈夫さ)。効果の計算はこの値から出す
const applyTacticsExUse = (state, { def, slot, monId, now, snapshot = null } = {}) => {
  const safe = normalizeTacticsExState(state);
  if (!def || !Number.isInteger(slot)) return safe;
  const stamp = { wave: tacticsSafeInt(now && now.wave, 0), turn: tacticsSafeInt(now && now.turn, 0) };
  const count = tacticsExUsesOf(safe, slot, monId) + 1;
  const prev = safe.effects[slot];
  const wasOn = !!(prev && prev.monId === monId && prev.duration === 'toggle' && prev.on === true);
  return {
    uses: { ...safe.uses, [slot]: { monId, count } },
    effects: { ...safe.effects, [slot]: { monId, exId: def.id, effect: def.effect, duration: def.duration, wave: stamp.wave, turn: stamp.turn,
      on: def.duration === 'toggle' ? !wasOn : true,
      snapshot: snapshot && typeof snapshot === 'object' ? { ...snapshot } : null } },
    lastUse: { ...safe.lastUse, [slot]: stamp },
    turnUsed: stamp,
    cardLock: def.withCards ? safe.cardLock : { ...safe.cardLock, [slot]: stamp },
  };
};
// 切り替え式のEXが、いまどちらの状態か(画面に「いま：片手持ち」のように出す)
const tacticsExToggleLabel = (def, state, slot, monId) => {
  if (!def || def.duration !== 'toggle') return null;
  return def.toggleLabels[isTacticsExEffectActive(state, slot, monId, null) ? 1 : 0];
};
// その枠で、いま効いている効果の種類(effect)。効いていなければ null。
// ★戦闘の計算側はモンスターのidではなく、これを見る(モンスターごとの if を増やさない)
const tacticsExActiveEffect = (state, slot, monId, now) => {
  const effect = normalizeTacticsExState(state).effects[slot];
  if (!effect || !isTacticsExEffectActive(state, slot, monId, now)) return null;
  return typeof effect.effect === 'string' ? effect.effect : null;
};
// EXで変わる力・丈夫さを乗せた1体ぶんを返す(盤面の値そのものは書き換えない)。
// ★読むときに上乗せするだけなので、効果が切れた瞬間(WAVEが変わる・切り替えで戻す)に
//   何もしなくても元の値へ戻る。トレーニングで伸ばした値も失われない
//   捨て身(allIn)     … 丈夫さ0。使ったときの丈夫さの50%を力へ足す
//   ソード・コンバージョン(weaponChange) の片手持ち … いまの力と同じ数値を丈夫さへ足す(力は減らない)
const applyTacticsExStats = (unit, state, slot, now) => {
  if (!unit || typeof unit !== 'object') return unit;
  const kind = tacticsExActiveEffect(state, slot, unit.id, now);
  if (kind === 'allIn') {
    const snap = normalizeTacticsExState(state).effects[slot].snapshot;
    const usedDef = Math.max(0, tacticsSafeInt(snap && snap.def, tacticsSafeInt(unit.def, 0)));
    return { ...unit, atk: Math.max(0, tacticsSafeInt(unit.atk, 0)) + Math.floor(usedDef * TACTICS_EX_ALL_IN_ATK_RATE), def: 0 };
  }
  if (kind === 'weaponChange') {
    const atk = Math.max(0, tacticsSafeInt(unit.atk, 0));
    return { ...unit, def: Math.max(0, tacticsSafeInt(unit.def, 0)) + atk };
  }
  return unit;
};
// 「みんなをかばう」が効いている枠(立っている子だけ)。無ければ null
const tacticsExCoverSlot = (state, units, now) => {
  const safe = normalizeTacticsExState(state);
  const alive = tacticsAliveSlots(units);
  for (const key of Object.keys(safe.effects)) {
    const slot = Number(key);
    const unit = Array.isArray(units) ? units[slot] : null;
    if (!unit || !alive.includes(slot)) continue;
    if (tacticsExActiveEffect(safe, slot, unit.id, now) === 'coverAll') return slot;
  }
  return null;
};
// 敵の攻撃の当たり先を、かばう子へ集める。★当たる回数はそのまま
// (全体攻撃で3体に当たるはずなら、かばう子が3回受ける。連撃は連撃のまま)。
// 攻撃の性質(貫通ならガードが効かない、など)は変えない
const coverTacticsTargets = (targets, coverSlot) => (Number.isInteger(coverSlot) && Array.isArray(targets) && targets.length
  ? targets.map(() => coverSlot) : (Array.isArray(targets) ? targets : []));
// ==== タクティクス専用 EXスキルここまで ====
