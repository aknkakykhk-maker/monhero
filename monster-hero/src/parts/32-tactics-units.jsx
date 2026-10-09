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
// ★exMaxRate … タクティクスのEX(ガッツ全開っちー)で上がっている上限の割合。無ければ0。
//   みゅあ補正で上限を作り直しても消えないよう、ここで一緒に掛ける(既存の子は0なので値は今までどおり)
//   ★ガッツの上限は exMaxGutsRate を別に持てる(ミタラシのように上げ幅がライフと違うEX)。
//     無ければ exMaxRate と同じ(ガッツ全開っちーはライフ・ガッツとも同じ率)
const tacticsExMaxRateOf = (unit, kind = 'hp') => {
  const own = kind === 'guts' ? Number(unit && unit.exMaxGutsRate) : NaN;
  const rate = Number.isFinite(own) ? own : Number(unit && unit.exMaxRate);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
};
const scaleTacticsUnitMaxHp = (unit, hpPct = 0) => {
  const target = normalizeTacticsUnit(unit);
  if (!target) return null;
  const pct = Number.isFinite(Number(hpPct)) ? Math.max(0, Number(hpPct)) : 0;
  const exRate = tacticsExMaxRateOf(target);
  const maxHp = Math.max(1, Math.floor(target.baseMaxHp * (1 + pct) * (1 + exRate)));
  return normalizeTacticsUnit({ ...target, maxHp });
};
// ガッツの上限も同じ考え方。みゅあ補正は合計ではなく1体ずつへ効かせる
const scaleTacticsUnitMaxGuts = (unit, gutsPct = 0) => {
  const target = normalizeTacticsUnit(unit);
  if (!target) return null;
  const pct = Number.isFinite(Number(gutsPct)) ? Math.max(0, Number(gutsPct)) : 0;
  const exRate = tacticsExMaxRateOf(target, 'guts');
  const maxGuts = Math.max(0, Math.floor(target.baseMaxGuts * (1 + pct) * (1 + exRate)));
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

// ===== タクティクス以外のスコアも同じ 1/1000 へ(2026-10-03・ユーザー指示) =====
//
// チャレンジ・プロ・クイック・極限・種族チャレンジのスコアも桁が大きくなりすぎたため、
// タクティクスと同じ縮め方(式はそのまま、最後に 1/1000)にした。経験値・ダイヤの倍率は
// score 倍率を直接変えずに済ませている(xpMultiplier が scoreMultiplier を使っているため)。
// ★すでに端末に残っている自己ベストなども、一度だけ同じ割り方で縮める(下の移行)。
//   タクティクス(mh_tactics_* / Tactics* / TacticsSpecies-*)はもう縮んでいるので触らない。
const shrinkBattleScore = shrinkTacticsScore;
const BATTLE_SCORE_SHRINK_MIGRATED_KEY = 'mh_battle_score_shrink_migrated_v1';
// 保存されている1つの数値(自己ベストなど)を縮める。0・数でないものはそのまま返す
const shrinkSavedBattleScore = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || !(n > 0)) return value;
  return shrinkBattleScore(n);
};
// 端末に積んだランキング送信待ち(mh_rank_<難易度>)のうち、縮める対象の難易度か。
// タクティクス(Tactics*)とモンヒロビート(Rhythm-*)は別の尺度なので触らない
const isBattleScoreShrinkRankingKey = (difficulty) => {
  const d = String(difficulty || '');
  return d.length > 0 && !/^(tactics|rhythm)/i.test(d);
};
// 種族チャレンジの進行 { species: { <血統>: { records: { <難易度>: { bestScore, ... } } } } }。
// 記録の形は変えず、bestScore だけを縮める
const shrinkSpeciesProgressScores = (progress) => {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return progress;
  if (!progress.species || typeof progress.species !== 'object' || Array.isArray(progress.species)) return progress;
  const species = {};
  Object.keys(progress.species).forEach(speciesId => {
    const entry = progress.species[speciesId];
    if (!entry || typeof entry !== 'object' || !entry.records || typeof entry.records !== 'object' || Array.isArray(entry.records)) {
      species[speciesId] = entry; return;
    }
    const records = {};
    Object.keys(entry.records).forEach(difficultyId => {
      const record = entry.records[difficultyId];
      records[difficultyId] = record && typeof record === 'object' && !Array.isArray(record) && 'bestScore' in record
        ? { ...record, bestScore: shrinkSavedBattleScore(record.bestScore) } : record;
    });
    species[speciesId] = { ...entry, records };
  });
  return { ...progress, species };
};
// ランキング送信待ちの一覧の score を縮める(送り直すときに大きい数のまま届かないように)
const shrinkLocalRankingEntries = (list) => (Array.isArray(list) ? list : []).map(entry =>
  entry && typeof entry === 'object' && 'score' in entry ? { ...entry, score: shrinkSavedBattleScore(entry.score) } : entry);
// 端末に保存したスコアを、一度だけ縮める。縮めた値と完了フラグは1つの取引で書くので、
// 途中で終了しても「半分だけ縮んだ」状態は残らない(二重に縮むと元に戻せない)。
// 引数は storeGet / storeSet / storeList / 取引関数。取り違えないよう呼び出し側から渡す。
// 戻り値は { done, changed }。失敗しても例外は投げず、次の起動でやり直す。
const migrateBattleScoresToShrunk = async (get, set, list, transaction) => {
  try {
    if (await get(BATTLE_SCORE_SHRINK_MIGRATED_KEY, false, false)) return { done: false, changed: 0 };
    const entries = [];
    const plan = (key, before, next) => { if (JSON.stringify(before) !== JSON.stringify(next)) entries.push({ key, before, next }); };
    // 自己ベスト(チャレンジ mh_hs_ / クイック mh_quick_hs_ / プロ mh_pro_hs_ / 極限 mh_extreme_hs_)
    for (const prefix of ['mh_hs_', 'mh_quick_hs_', 'mh_pro_hs_', 'mh_extreme_hs_']) {
      for (const key of (await list(prefix, false)) || []) {
        const before = await get(key, 0, false);
        plan(key, before, shrinkSavedBattleScore(before));
      }
    }
    // 種族チャレンジの自己ベスト(タクティクス側のキーは触らない)
    const speciesBefore = await get(SPECIES_CHALLENGE_PROGRESS_KEY, null, false);
    if (speciesBefore) plan(SPECIES_CHALLENGE_PROGRESS_KEY, speciesBefore, shrinkSpeciesProgressScores(speciesBefore));
    // ランキング送信待ち
    for (const key of (await list('mh_rank_', false)) || []) {
      if (!isBattleScoreShrinkRankingKey(key.slice('mh_rank_'.length))) continue;
      const before = await get(key, [], false);
      if (Array.isArray(before)) plan(key, before, shrinkLocalRankingEntries(before));
    }
    // ランキングの控え(表示用)。古い大きい数字を一瞬でも出さないよう捨てる(開けば取り直す)
    const cacheBefore = await get('mh_ranking_cache', null, false);
    if (cacheBefore) plan('mh_ranking_cache', cacheBefore, null);
    const changed = entries.length;
    entries.push({ key: BATTLE_SCORE_SHRINK_MIGRATED_KEY, before: false, next: true });
    const ok = await transaction(entries, get, set);
    return { done: ok, changed: ok ? changed : 0 };
  } catch (error) {
    console.error('[score-shrink] migration failed:', error && error.message ? error.message : error);
    return { done: false, changed: 0 };
  }
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
//   duration  … 効果の続く長さ。'turn'(発動ターン) / 'wave'(発動WAVEの終わりまで) / 'style'(もう一度使って選び直すまで)
//               / 'turns'(使ったターンから turns ターンのあいだ。WAVEが変わったらそこで切れる)
//   turns     … duration:'turns' のときのターン数
//   statRate  … 効いているあいだ、力と丈夫さを何割上げるか(0.3 なら30%)
//   regenRate … 効いているあいだ、ターン終わりのライフ・ガッツの自動回復の率へそのまま足す値(0.3 なら上限の30%ぶんを上乗せ)
//   rates     … ステータスごとに上げ幅を変えるとき { atk, def, hp, guts }(hp・guts は上限)。書かなかった項目は statRate
//   regenRates … 自動回復の上乗せをライフとガッツで変えるとき { hp, guts }。書かなかった項目は regenRate
//   fullRecover … true なら、使った瞬間にその子のライフとガッツを満タンにする
//   styles    … duration:'style' のときの選択肢 [{ id, label, desc }]。使うたびに1つ選ぶ(いまのものは選べない)
//   defaultStyle … バトルを始めたときのスタイル(styles の id)
//   heroInitialStyle … true なら、勇者モンに選んだときだけ配置の画面で初期スタイルを選べる
//   conditions … 使うための追加の条件(TACTICS_EX_CONDITIONS のキー)。無ければ空
//   conditionText … 条件を画面に出すときの文(任意)
//   partyTakenRate … 効いているあいだ、味方全員の被ダメージを何割減らすか(0.3 なら30%軽減。ほかの軽減と掛け算で重なる)
//   partyRegenRate … 効いているあいだ、ターンの終わりに味方全員(立っている子)のライフを上限の何割ぶん多く回復するか
//   extraCombos … { count, rate } 効いているあいだ、その子の攻撃へ与ダメージ rate の連撃を count 回足す
//   dmgRate   … (multiBuff) 効いているあいだ、その子の与ダメージを何割上げるか(0.3 なら×1.3。最終ダメージへの乗算)
//   selfTakenRate … (multiBuff) 効いているあいだ、その子が受けるダメージを何割減らすか(0.2 なら×0.8。ほかの軽減と掛け算で重なる)
//   critRateRate … (multiBuff) 会心率を何割増やすか(0.5 なら×1.5。足し算ではなく、いまの会心率にかける)
//   critDmgRate  … (multiBuff) 会心ダメージを何割増やすか(0.3 なら×1.3。足し算ではなく、いまの会心ダメージ倍率にかける)
//   distMult  … (multiBuff) 効いているあいだ、その子の攻撃の距離補正をこの値に固定する(0なら変えない。1.5 なら敵と同じ距離のときと同じ)
//   uniqueCrit … true なら、効いているあいだ、その子の固有技が必ず会心になる(ピクシー)
//   guaranteeUnique … true なら、効いているあいだ毎ターン、その子の固有技カードが手札に必ず出る(ピクシー)
//   cardBonus … (stage) 効いているあいだ、1ターンに使えるカード枚数(盤面ぜんぶ・その子自身)を何枚増やすか
//   voltage   … (stage) { max, dmg, heal, guts, hp } 味方がカードを1枚使うたびに1たまる。1段階ごとに 与ダメ+dmg・回復量+heal・ガッツの自動回復+guts(全員)
//   pandoraBox … (pandoraBox) パンドラの箱。{ costRate(ターン終わりに払う最大ライフの割合), selfCardBonus(パンドラ自身が使えるカード+), devilDmg(1枚目の与ダメ倍率), devilCombo{count,rate}(1枚目に付く連撃), angelRate(2枚目で味方全員のライフ・ガッツ上限の何割戻すか), hopeGutsRate(最後の希望で戻すガッツ) }
//   target    … 'ally' なら、使うとき味方1体(自分も含む)を選ぶ。選んだ枠は applyTacticsExUse の target に入る
//   aqua … (lifeSpring と一緒に置く) アクアフィールド { needed, dmgPerStack, takenPerStack, finaleTaken, finaleTurns }。水牢・氷結のスタック
//   lifeSpring … (lifeSpring) { maxUpRate, gutsRate } 選んだ子が立っていればライフ上限を maxUpRate 上げて(効果のあいだ)満タンに、ダウン中なら立たせて満タンに。どちらもガッツを上限の gutsRate 戻す
//   usesPerWave … true なら、回数がWAVEのはじめに戻る(maxUses は1WAVEぶん)
//   present   … (present) スネグーラチカのプレゼントの数字。fixedGuts=必ず入る全員のガッツ(上限の割合) / jackpot=大当たりの確率 / dmg・taken・crit・heal・guts=ランダム1種の効き目 / combo={count,rate}
//   lifeCostRate … 使うとき、その子の最大ライフのこの割合(0.3 なら30%)を払う。ライフがそれより多いときだけ使える(払って倒れることはない)
//   dodgeComboRate … 回避するたびに増える連撃の rate(0.1 なら、回避1回ごとに与ダメージ10%の連撃が1回増える)
//   avoidCharges … (avoidCharge) 使うともらう「完全回避」の回数。狙われた攻撃1回(技1回)につき1つ減る
//   partyHealRate … 使った瞬間に、味方全員のライフとガッツを上限のこの割合ぶん回復する
//   partyStatRate … (trickConfuse) 効いているあいだ、味方全員のちから・丈夫さをこの割合上げる
//   stackSpend … (cookieBox / nightmareKey) 勇者特性のスタック(クッキー・黒音符)を全部使うEX。数字は「1個あたり」。
//                cookieBox:   { full, heal, guts, dmg, taken, fullTurns } 使った瞬間に全員のライフ heal×個・ガッツ guts×個、
//                             効いているあいだ全員の与ダメ+dmg×個・被ダメ−taken×個。full個で使うと効果が fullTurns ターンに伸びる
//                nightmareKey: { full, dmg, crit, enemyTaken, fullCombo } 効いているあいだ本人の与ダメ+dmg×個・会心率+crit×個・
//                             敵の被ダメ+enemyTaken×個。full個で使うと本人の攻撃へ fullCombo の連撃が付く
//   effect    … 効果の種類。中身は TACTICS_EX_IMPLEMENTED_EFFECTS に入ったものだけが動く
const TACTICS_EX_DURATION_TEXT = Object.freeze({
  turn: '発動したターンだけ',
  wave: '発動したWAVEが終わるまで',
  style: 'もう一度使って選び直すまで',
});
// 緋桜瞬歩(distMatch)が効いているあいだの距離補正。ふだんは敵との距離の差 0/1/2/3 で ×1.5/1.3/1.1/0.9
const TACTICS_EX_DIST_MATCH_MULT = 1.7;
// 緋桜瞬歩(エイキ)・血踊(ザン)が効いている子が、敵と同じ距離の枠にいるとき、敵の攻撃を完全に回避するか
// (枠の番号がそのまま距離なので、枠の番号と敵の距離が同じかどうかで見る)
const tacticsExDistMatchDodges = (effect, slotIdx, enemyDist) =>
  (effect === 'distMatch' || effect === 'dodgeCombo') && Number.isInteger(slotIdx) && Number.isInteger(enemyDist) && slotIdx === enemyDist;
const TACTICS_EX_SKILLS = Object.freeze({
  Monol: Object.freeze({
    id: 'monol_cover_all',
    name: 'みんなをかばう',
    useNote: '敵の攻撃を全部モノリスが受ける',
    desc: 'このターン、敵の攻撃をすべてモノリスが引き受ける。\n・単体攻撃も全体攻撃も、モノリスが受ける（全体攻撃は、本来当たる人数ぶんを受ける）\n・連撃や貫通撃も、モノリスが受ける（貫通撃はガードで防げない）',
    // ★2026-09-25 ユーザー指示で 1ラン3回 → 10回
    maxUses: 10, unlimited: false, withCards: true, duration: 'turn',
    effect: 'coverAll',
  }),
  // ★2026-09-25 ユーザー指示で上げ幅を20% → 30%。さらに効いているあいだ自動回復を30%増やす
  //   (「ステータス30%アップに変更。更に効果中ライフとガッツの自動回復を30%上昇」)。
  //   自動回復は「いまの率 + 30%」(倍率ではなく固定値で足す。ユーザー指示「1.3倍じゃなくて30%固定値でプラス」)
  // ★2026-09-25 ユーザー指示「モッチー ガッツ全開っちー 5ターンの間全てのステータスが20%上がり、
  //   ライフとガッツを全回復する 使用回数3回」。上がるのは力と丈夫さ(ライフ・ガッツは満タンにする)。
  //   カードとの併用は指定が無かったので、制限なし(併用できる)にしてある
  Mocchi: Object.freeze({
    id: 'mocchi_guts_full',
    name: 'ガッツ全開っちー',
    useNote: '5ターン 全ステータス+30%・満タン・自動回復+30%',
    // ★2026-09-25 ユーザー指示「ライフとガッツは上限も上げてさらに全回復のイメージだった」。
    //   上限も20%上げ、その上がった上限まで満タンにする
    desc: '5ターンのあいだ、モッチーが大きく強くなる。\n・ちから・丈夫さ・ライフ上限・ガッツ上限が+30%\n・ターン終わりの自動回復が、ライフ・ガッツとも上限の30%ぶん多くなる\n・使った瞬間に、ライフとガッツが満タンになる',
    maxUses: 3, unlimited: false, withCards: true, duration: 'turns', turns: 5,
    statRate: 0.3, regenRate: 0.3, fullRecover: true,
    effect: 'statBoost',
  }),
  // ★2026-09-27 ユーザー指示「ミタラシ EXスキル【ドラゴンだっちー】ガッツ全開だっちーの上がるステが違う版
  //   同じようなバランスで少し攻撃寄りにして」。回数・ターン・併用はモッチーと同じ。
  //   上げ幅はユーザーが3案から選んだ「ちから＋ガッツ」(ちから・ガッツ上限40% / 丈夫さ・ライフ上限20%、
  //   自動回復の上乗せはガッツ40%・ライフ20%)。効果の種類はガッツ全開っちーと同じ statBoost
  Mitarashi: Object.freeze({
    id: 'mitarashi_dragon',
    name: 'ドラゴンだっちー',
    useNote: '5ターン 力・ガッツ+40% 丈夫さ・ライフ+20%・満タン',
    desc: '5ターンのあいだ、ミタラシが強くなる。\n・ちから・ガッツ上限が+40%、丈夫さ・ライフ上限が+20%\n・ターン終わりの自動回復が、ガッツは上限の40%、ライフは上限の20%ぶん多くなる\n・使った瞬間に、ライフとガッツが満タンになる',
    maxUses: 3, unlimited: false, withCards: true, duration: 'turns', turns: 5,
    statRate: 0.2, regenRate: 0.2, fullRecover: true,
    rates: Object.freeze({ atk: 0.4, def: 0.2, hp: 0.2, guts: 0.4 }),
    regenRates: Object.freeze({ hp: 0.2, guts: 0.4 }),
    effect: 'statBoost',
  }),
  // ★2026-10-02 ユーザー指示(エイキのEX)。「EX中は敵と距離があってる分のダメージになる」。
  //   getDmg の距離補正(敵との距離の差 0/1/2/3 で ×1.5/1.3/1.1/0.9)を、効いているあいだは
  //   差0(×1.5)で数える。どの距離枠にいても、敵と同じ距離から殴ったことになる。
  //   間合い適性(その枠に立っている子の適性)は変えない。
  // ★2026-10-02 ユーザー指示で 3ターン・ラン2回・併用できる・距離補正×1.5 → 5ターン・ラン3回・併用できない・
  //   距離補正×1.7、さらに敵と同じ距離の枠にいるときは敵の攻撃を完全に回避する
  //   (使ったターンは、エイキだけほかのカードを使えない。ほかの子は使える)
  Eiki: Object.freeze({
    id: 'eiki_dist_match',
    name: '緋桜瞬歩',
    useNote: '3ターン 距離補正×1.7・同じ距離は完全回避',
    desc: '3ターンのあいだ、エイキの攻撃が強くなり、敵の攻撃をよける。\n・攻撃の距離補正が、どの距離でも×1.7に固定される（ふだんは、敵と同じ距離で×1.5、離れるほど下がって×0.9）\n・敵と同じ距離の枠にいるとき、エイキが狙われた攻撃を完全に回避する\n・使ったターン、エイキはカードを使えない（ほかの子は使える）',
    maxUses: 3, unlimited: false, withCards: false, duration: 'turns', turns: 3,
    effect: 'distMatch',
  }),
  // ★2026-10-02 ユーザー指示(ザンのEX)。「敵と同じ距離の場合は完全回避、回避するごとに10%連撃付与
  //   (与ダメ10%連撃が増えてく) 5ターン、ラン5回 併用あり」。名前はユーザー指定「血踊」(最初は仮に「見切り連斬」)。
  //   のちに社長が3ターンに修正(2026-10-10 確認。ゲームの3ターンが正しい)。
  //   回避の判定はエイキの緋桜瞬歩と同じ(tacticsExDistMatchDodges)。回避した数(effects[slot].dodges)だけ、
  //   その子の攻撃へ与ダメージ10%の連撃が1回ずつ増える(tacticsExExtraCombosAt)。効果が切れたら数も消える
  Zan: Object.freeze({
    id: 'zan_dodge_combo',
    name: '血踊',
    useNote: '3ターン 同じ距離は完全回避・回避で連撃が増える',
    desc: '3ターンのあいだ、敵をよけるたびにザンの攻撃が増える。\n・敵と同じ距離の枠にいるとき、ザンが狙われた攻撃を完全に回避する\n・回避するたびに、攻撃へ「与ダメージ10%の連撃」が1回ずつ増える（2回よければ2回）',
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 3,
    dodgeComboRate: 0.1,
    effect: 'dodgeCombo',
  }),
  // ★2026-10-02 ユーザー指示(アークのEX)。「抗えぬ宿命を追え、5ターン、5回、与ダメ30%アップ、連撃10%、被ダメ20%低下」。
  //   カードとの併用は指定が無かったので「併用できる」(自己強化なので、使ったターンも殴れないと意味が薄い)
  Ark: Object.freeze({
    id: 'ark_chase_fate',
    name: '抗えぬ宿命を追え',
    useNote: '5ターン 与ダメ+30%・連撃10%・被ダメ−20%',
    desc: '5ターンのあいだ、アークが攻めも守りも強くなる。\n・与ダメージ+30%\n・攻撃に「与ダメージ10%の連撃」が1回付く\n・受けるダメージ−20%',
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 5,
    dmgRate: 0.3, selfTakenRate: 0.2, extraCombos: Object.freeze({ count: 1, rate: 0.1 }),
    effect: 'multiBuff',
  }),
  // ★2026-10-02 ユーザー指示(イブリースのEX)。「堕天の烙印、5ターン、5回、5%連撃×5、クリ率50%アップ(乗算)、
  //   クリダメ30%アップ(乗算)、丈夫さ30%アップ」。併用は指定が無かったので「併用できる」
  Iblis: Object.freeze({
    id: 'iblis_fallen_brand',
    name: '堕天の烙印',
    useNote: '5ターン 連撃5%×5・会心UP・丈夫さ+30%',
    desc: '最大ライフの30%を払って、5ターンのあいだ攻撃が鋭くなる。\n・攻撃に「与ダメージ5%の連撃」が5回付く\n・会心率×1.5、会心ダメージ×1.3\n・丈夫さ+30%\n・ライフが払う量より多いときだけ使える（払って倒れることはない）',
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 5,
    // ★2026-10-02 ユーザー指示「堕天は最大ライフの30%を消費して」を追加。払って倒れないよう、ライフが30%より多いときだけ使える
    lifeCostRate: 0.3, conditionText: 'ライフが最大の30%より多いときだけ使える',
    rates: Object.freeze({ def: 0.3 }), critRateRate: 0.5, critDmgRate: 0.3, extraCombos: Object.freeze({ count: 5, rate: 0.05 }),
    effect: 'multiBuff',
  }),
  // ★2026-10-03 ユーザーの案(数字は仮。「決め打ちしないで細かい数値は調整したい」)。ピクシー「お気に入りの魔法」。
  //   毎ターン固有技が手札に必ず出る。魔法空間(次ターンの使用ガッツ0)がその子の枠だけに効くので、連発できる。
  //   距離補正は ×1.5 に固定(敵と同じ距離から攻撃したときと同じ。エイキの ×1.7 より低い)。併用は指定が無かったので「できる」
  Pixie: Object.freeze({
    id: 'pixie_favorite_magic',
    name: 'お気に入りの魔法',
    useNote: '3ターン 毎ターン固有技が手札に・距離補正×1.5・固有技は必ず会心',
    desc: '3ターンのあいだ、固有技を撃ちやすくなり、近くから殴ったことになる。\n・毎ターン、ピクシーの固有技カードが必ず手札に出る\n・距離補正が、どの距離でも×1.5（敵と同じ距離から攻撃したときと同じ）\n・ピクシーの固有技が、必ず会心になる',
    maxUses: 3, unlimited: false, withCards: true, duration: 'turns', turns: 3,
    distMult: 1.5, guaranteeUnique: true, uniqueCrit: true,
    effect: 'multiBuff',
  }),
  // ★2026-10-03 ミーア「オン・ステージ！」(数字は仮)。ボルテージは味方がカードを使うたびに1たまる(最大10)。
  //   1段階ごとに 味方全員の与ダメージ+3%・回復カードの回復量+5%・ターン終わりのガッツ自動回復+2%・ライフ自動回復+3%。終わると0に戻る
  Mia: Object.freeze({
    id: 'mia_on_stage',
    name: 'オン・ステージ！',
    useNote: '4ターン カード+1・使うほどボルテージ上昇',
    desc: '4ターンのあいだ、味方全員が動きやすくなる。\n・1ターンに使えるカードが+1枚（ミーア自身も+1）\n・味方がカードを1枚使うたびに、ボルテージが1たまる（最大10）\n・ボルテージ1段階ごとに、味方全員の与ダメージ+3%・回復カードの回復量+5%・ライフ自動回復+3%・ガッツ自動回復+2%\n・効果が終わると、ボルテージは0に戻る',
    maxUses: 3, unlimited: false, withCards: true, duration: 'turns', turns: 4,
    cardBonus: 1, voltage: Object.freeze({ max: 10, dmg: 0.03, heal: 0.05, guts: 0.02, hp: 0.03 }),
    effect: 'stage',
  }),
  // ★2026-10-03 スネグーラチカ「クリスマスプレゼント」(数字は仮)。各WAVE1回。必ず全員のガッツが少し戻り、
  //   そのうえランダムで6種のうち1つ(低確率の大当たりは6つ全部)。持続のある効果は2ターン
  Snegurochka: Object.freeze({
    id: 'snegurochka_present',
    name: 'クリスマスプレゼント',
    useNote: '全員のガッツ回復＋ランダムで2つ(使うほど豪華に)',
    desc: '味方全員にプレゼントを配る（回数は各WAVEで1回）。\n・必ず：全員のガッツが上限の20%回復\n・さらにランダムで2回、中身を引く（同じものは出ない・3ターン続く）：\n　与ダメージ+20%\n　被ダメージ−20%\n　連撃 与ダメ10%×2回\n　全員のライフが上限の20%回復\n　全員のガッツがさらに上限の20%回復\n　会心率×1.3\n・引くたびに10%の確率で「大当たり」：6つ全部が起き、そこで抽選は終わる\n・WAVEをまたいで使うほど、そのランのプレゼントが豪華になる（効果量・ガッツ回復量・大当たりの確率が少しずつ上がる）\n・レイドバトルでは、WAVEの代わりに戦闘ターンが進むほど豪華になる（2ターンごとに1段階）。早く使えば安定、温存すれば強いプレゼントを狙える',
    maxUses: 1, unlimited: false, usesPerWave: true, withCards: true, duration: 'turns', turns: 3,
    present: Object.freeze({ draws: 2, grow: Object.freeze({ effect: 0.1, fixedGuts: 0.02, jackpot: 0.02, maxLevel: 10 }), fixedGuts: 0.2, jackpot: 0.1, dmg: 0.2, taken: 0.2, crit: 0.3, heal: 0.2, guts: 0.2, combo: Object.freeze({ count: 2, rate: 0.1 }) }),
    effect: 'present',
  }),
  // ★2026-10-03 ウンディーネ「生命の泉」(ユーザーの案・数字は仮)。味方1体を選んで使う回復のEX。
  //   ダウン中の子はすぐ立ち上がってライフ満タン、立っている子はライフ満タン＋3ターンのライフ上限アップ。どちらもガッツが戻る
  Undine: Object.freeze({
    id: 'undine_spring_of_life',
    name: '生命の泉',
    useNote: '選んだ味方が満タン・ガッツ30%回復＋アクアフィールド(水牢/氷結)',
    desc: '味方1体（自分でもよい）を選んで、立て直す。使うと「アクアフィールド」も広がる。\n・ダウン中の子：すぐ立ち上がり、ライフが満タンになる。3ターンのあいだ「根性」がつく（ライフが0になる攻撃を、1回だけライフ1で踏ん張る）\n・立っている子：ライフが満タンになり、3ターンのあいだライフ上限が+30%・与ダメージ+20%\n・どちらも、選んだ子のガッツが上限の30%回復する\n・アクアフィールド（3ターン）：広がった瞬間、味方全員のデバフが消える\n　ウンディーネ・ヤオビクニ・スネグーラチカが、フィールドで最初に使った技で道が決まる\n　通常技を最初に使う→「水牢」：通常技を使うたびに1たまり、1つごとに敵の与ダメージ−10%\n　固有技を最初に使う→「氷結」：固有技を使うたびに1たまり、1つごとに敵の被ダメージ+10%\n　決まった道は変わらず、水牢と氷結は同時にたまらない\n　3つたまると「アクアフィナーレ」：3つ使い切り、敵は1ターン動けず、2ターンのあいだ敵の被ダメージが+50%',
    // ★2026-10-03 ユーザー指示で 3回 → 5回
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 3,
    target: 'ally', lifeSpring: Object.freeze({ maxUpRate: 0.3, gutsRate: 0.3, konjo: 1, dmgUp: 0.2 }),
    aqua: Object.freeze({ needed: 3, dmgPerStack: 0.1, takenPerStack: 0.1, finaleTaken: 0.5, finaleTurns: 2 }),
    effect: 'lifeSpring',
  }),
  // ★2026-10-03 ヤオビクニ「悠久の刻」(ユーザーの案・回数2回)。時間を止める。使ったターンは敵が行動せず、
  //   そのターンはWAVEの20ターン制限にも数えない(ターン数が進まない)。止めたターンのあとの「同じターン」では、もう一度は使えない
  Yaobikuni: Object.freeze({
    id: 'yaobikuni_eternal_moment',
    name: '悠久の刻',
    useNote: '時間停止 このターン敵は動かない・味方の強化をコピー',
    desc: '時間を止める。\n・使ったターンは、敵が行動しない\n・そのターンは、WAVEの20ターンの数に入らない（ターンの数字が進まない）\n・止まっているあいだ、味方のバフ・敵のデバフの残りターンは減らない（味方だけが動ける）\n・使った瞬間、ほかの味方にかかっている強化をヤオビクニもそのターンだけ受ける\n　コピーする：与ダメ・被ダメ軽減・力・丈夫さ・会心率・会心ダメージ・ライフ／ガッツの自動回復\n　コピーしない：完全回避・連撃・カード枚数・形態変化・フィールド効果（全体バフは元から全員に効いている）',
    maxUses: 2, unlimited: false, withCards: true, duration: 'turn',
    effect: 'timeStop',
  }),
  // ★2026-10-03 パンドラ「パンドラの箱」(ユーザーの案・数字は仮。見た目の分離(悪魔側・天使側の画像)と3枚の染色は、あとの段階で入れる)。
  //   天使側と悪魔側に分かれて3ターン戦う(システム上は1体のまま)。毎ターン終わりにライフを削り(1・2ターン目)、
  //   自分が使えるカード+1。1枚目は悪魔側(与ダメ+50%・与ダメ30%の連撃×1)、2枚目は天使側(味方全員のライフ・ガッツ上限の10%回復)。
  //   2026-10-06 の強化案: 毎ターン固有技が手札に出て、箱のあいだの固有技は「強化ダイスキライライ」(威力アップ＋悪魔の追加連撃＋天使の味方回復)。
  //   最後の希望ではパンドラはダウンせず、反動で次の1ターン動けない(味方のデバフ。アクアフィールドで消せる)。
  //   3ターン生き残ると「最後の希望」(ダウン中の味方は復活・味方全員ライフ満タン・ガッツ大幅回復)。
  //   途中で倒れると、倒れたときのガッツが生きている味方へ均等に分けられる
  Pandora: Object.freeze({
    id: 'pandora_box',
    name: 'パンドラの箱',
    useNote: '3ターン 毎ターン固有技が出る(強化ダイスキライライ)・最後の希望で味方全回復',
    desc: '3ターンのあいだ、天使と悪魔の力で戦う（ライフ・ガッツ・距離・狙われ方は1体のまま）。\n・パンドラが使えるカードが+1枚\n・毎ターン、パンドラの固有技のカードが必ず手札に出る\n・箱のあいだの固有技は「強化ダイスキライライ」になる：威力が2倍・悪魔の力で与ダメージ50%の連撃が2回付く・天使の力で味方全員のライフ・ガッツが上限の15%回復する\n・1・2ターン目の終わりに、最大ライフの30%を払う\n・3ターン生き残ると「最後の希望」：ダウン中の味方は立ち上がり、味方全員のライフが満タン・ガッツが上限の80%回復する。パンドラはダウンしないが、反動で次の1ターンは動けない（味方のデバフ。アクアフィールドで消せる）\n・途中で倒れると「最後の希望」は起きず、倒れたときのガッツが、生きている味方へ均等に分けられる',
    maxUses: 3, unlimited: false, withCards: true, duration: 'turns', turns: 3,
    pandoraBox: Object.freeze({ costRate: 0.3, selfCardBonus: 1, devilDmg: 2, devilCombo: Object.freeze({ count: 2, rate: 0.5 }), angelRate: 0.15, hopeGutsRate: 0.8, guaranteeUnique: true, lockTurns: 1 }),
    effect: 'pandoraBox',
    // ラン3回のあいだ、箱が効いている途中でもう一度使うことはできない(重ね掛けで3ターンが延びないように)
    conditions: Object.freeze(['notActive']),
  }),
  // ★2026-10-05 ユーザー指示(ライガーのEX)。「雷狼影・3ターン・ラン5回。3ターンの間、自身の行動回数ぶん『雷』がたまる
  //   (ガードやききの効果で増えていればそれも行動分)。3ターンのターン終了後に『雷纏』が始まり、3ターンの間、
  //   雷の数だけ強化(雷×与ダメ30%・雷×クリ率10%・雷×連撃10%)」。のちに「雷×回避率5%」(敵の攻撃を確率で回避。上限90%)・「雷×ライフ自動回復5%」・「雷×ガッツ自動回復5%」(ターン終わりの自動回復の率へ足す)も追加。
  //   前半3ターン=ためる(その子が使ったカード1枚につき雷+1)、後半3ターン=雷纏。効果は合計6ターン続く(WAVEをまたがない)。
  //   連撃は「与ダメージ10%の連撃が雷の数だけ付く」、クリ率は足し算(いまの会心率に+10%×雷)、与ダメは最終ダメージへの乗算。
  //   カードとの併用は指定が無かったので「併用できる」。雷の数に上限は設けない
  Tiger: Object.freeze({
    id: 'tiger_thunder_shadow',
    name: '雷狼影',
    useNote: '3ターン雷をため、そのあと3ターン雷纏で強化',
    desc: '3ターンのあいだ雷をため、そのあと3ターン、雷をまとって戦う（効果は合計6ターン）。\n・前半3ターン：ライガーへ置いたカードを使う（行動する）たびに「雷」が1つたまる（ガード・アシストカードも数える。ききの効果でカードが増えたぶんも数える）\n・3ターン目の終わりに「雷纏」が始まる\n・後半3ターン：雷1つにつき、与ダメージ+30%・会心率+10%・回避率+5%・ライフ自動回復+5%・ガッツ自動回復+5%・与ダメージ10%の連撃が1回付く\n・効果中は、もう一度使えない',
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 6,
    thunder: Object.freeze({ chargeTurns: 3, dmg: 0.3, crit: 0.1, comboRate: 0.1, dodge: 0.05, regenHp: 0.05, regenGuts: 0.05 }),
    effect: 'thunder',
    conditions: Object.freeze(['notActive']),
  }),
  // ★2026-10-05 ユーザー指示(プラントのEX)。名前は「緑のめぐみ」。「5ターンの間、味方全員、力10%、丈夫さ10%、
  //   ライフ自動回復+10%、ガッツ自動回復+10%」。回数はラン5回(ユーザー選択)。カードとの併用は指定が無かったので「併用できる」。
  //   力・丈夫さは+10%(切り捨て)、自動回復は「いまの率 + 10%」(ガッツ全開っちーと同じく固定値で足す)。味方全員が対象
  Plant: Object.freeze({
    id: 'plant_green_blessing',
    name: '緑のめぐみ',
    useNote: '5ターン 味方全員 力・丈夫さ+10%・自動回復+10%',
    desc: '5ターンのあいだ、味方全員が緑の力に包まれる。\n・味方全員のちから・丈夫さが+10%\n・ターン終わりの自動回復が、ライフ・ガッツとも上限の10%ぶん多くなる\n・使った子が倒れても効果は続く',
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 5,
    partyBoost: Object.freeze({ statRate: 0.1, hpRegen: 0.1, gutsRegen: 0.1 }),
    effect: 'partyBoost',
  }),
  // ★2026-10-05 ユーザー選択(オボロゲソウのEX)。案「おぼろ返し」・ラン5回(ターン数は案のとおり3ターン)。
  //   特性「吸収」(被ダメージをライフとガッツへ変える)の味方全員版: 3ターンのあいだ、味方が敵の攻撃で受けたダメージの
  //   50%を、受けた子のライフへすぐ回復し、ガッツも受けたダメージの5%ぶん回復する。カードとの併用は指定が無かったので「併用できる」。
  //   倒れた子には回復しない(ダメージで倒れたら、そのまま)
  Oboro: Object.freeze({
    id: 'oboro_misty_return',
    name: 'おぼろ返し',
    useNote: '3ターン 受けたダメージの50%がライフに戻る',
    desc: '3ターンのあいだ、受けたダメージを回復に変える。\n・味方が敵の攻撃で受けたダメージの50%を、受けた子のライフへすぐ回復する\n・ガッツも、受けたダメージの5%ぶん回復する\n・倒れた子には回復しない\n・使った子が倒れても効果は続く',
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 3,
    damageBack: Object.freeze({ hpRate: 0.5, gutsRate: 0.05 }),
    effect: 'damageBack',
  }),
  // ★2026-10-05 ユーザー指定(スエゾーのEX)。名前は「サイコロックオン」・ラン3回(ユーザー選択)・併用できる。
  //   「効果時間5ターン。敵の距離を固定(行動で移動が出た場合は行動なし)。効果ターン、相手の与ダメ30%ダウン・相手の被ダメ30%アップ」。
  //   敵の距離移動の封じ方は、絶氷の楔(iceLockTurns)と同じ「移動できない！」(その移動は何もしない)に合わせる
  Suezo: Object.freeze({
    id: 'suezo_psycho_lock_on',
    name: 'サイコロックオン',
    useNote: '5ターン 敵の距離を固定・敵の与ダメ−30%・被ダメ+30%',
    desc: '5ターンのあいだ、念力で敵を縛りつける。\n・敵の距離を固定する（敵が「移動」を選んだときは、何もしない）\n・敵の与ダメージが30%下がる\n・敵の被ダメージが30%上がる（味方の攻撃が通りやすくなる）\n・使った子が倒れても効果は続く',
    maxUses: 3, unlimited: false, withCards: true, duration: 'turns', turns: 5,
    psychoLock: Object.freeze({ enemyDmgDown: 0.3, enemyTakenUp: 0.3 }),
    effect: 'psychoLock',
  }),
  // ★2026-10-05 ユーザー指定(ハムのEX)。名前は「ハムボクシング」・3ターン・ラン5回。
  //   「使用時『カウンター』を1付与。自分が狙われたときに攻撃をすると、クロスカウンター発動。相手の攻撃を回避して…
  //   クロスカウンターが発動するとカウンターを1付与。効果が切れるとカウンターもなくなる」。
  //   2026-10-06 ユーザー指示で発動の形を確定: 敵が攻撃を予告していて、それがハムを狙っているターンに、ハムが攻撃すると、
  //   ハムの攻撃のタイミングで「クロスカウンター」が出て、与えるはずだったダメージが「2×カウンターの数」倍になる
  //   (そのターンにハムが与えるダメージ全部。連撃も含む)。敵の攻撃は回避し、カウンターが1つ増える。
  //   カードとの併用は指定が無かったが、攻撃しないと発動しないので「併用できる」
  Ham: Object.freeze({
    id: 'ham_boxing',
    name: 'ハムボクシング',
    useNote: '3ターン カウンター1・狙われた日に攻撃するとクロスカウンター(与ダメ×2×カウンター)',
    desc: '3ターンのあいだ、ハムがボクシングの構えで敵の攻撃を迎え撃つ。\n・使うと「カウンター」が1つ付く\n・敵が予告した攻撃がハムを狙っているターンに、ハムが攻撃すると、攻撃のタイミングで「クロスカウンター」が発動する\n・クロスカウンター：敵の攻撃を回避し、そのターンにハムが与えるダメージが「2×カウンターの数」倍になる（カウンター1なら2倍、2なら4倍）\n・クロスカウンターが発動するたび、カウンターが1つ増える\n・効果が切れると、カウンターもなくなる',
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 3,
    counter: Object.freeze({ start: 1, mult: 2 }),
    effect: 'counter',
    // 効いている途中でもう一度使うと、カウンターが1に戻ってしまうので使えない
    conditions: Object.freeze(['notActive']),
  }),
  Golem: Object.freeze({
    id: 'golem_all_in',
    name: '捨て身',
    useNote: '丈夫さが0になり、その50%が力へ',
    desc: '丈夫さを0にして、その分を力へ足す。\n・足す量は、0にした丈夫さの50%\n・効き目は、そのWAVEが終わるまで',
    maxUses: 3, unlimited: false, withCards: false, duration: 'wave',
    // ★効果中にもう一度使っても何も変わらない(丈夫さはもう0)。回数だけ減るのを防ぐ
    conditions: Object.freeze(['notActive']),
    effect: 'allIn',
  }),
  KenshiMocchi: Object.freeze({
    id: 'kenshi_mocchi_weapon_change',
    name: 'ソード・コンバージョン',
    useNote: '戦い方を切り替えた',
    // ★2026-09-25 ユーザー指示で3択にした(片手剣・片手盾・二刀流。既定は片手剣)。
    //   スタイルの効き目は、いつも「元のステータス」から数え直す(切り替えても積み重ならない)
    // ★説明だけで3つの効き目が分かるように、スタイルごとに1行ずつ書く(2026-09-25 ユーザー指摘
    //   「説明があれじゃ効果が分からない」)。画面は改行をそのまま出す(whitespace-pre-line)
    desc: '戦い方（スタイル）を3つから選び直す。いまのスタイルは選べない。\n'
      + '片手剣：いつもの戦い方。固有技でソードスキルも出る。\n'
      + '片手盾：力と同じ数値を丈夫さへ足す。固有技を使ってもソードスキルは出ない。\n'
      + '二刀流：丈夫さが半分になる代わりに、連撃がすべて2回ぶん入る（メインのダメージは1回のまま）。',
    // ★2026-10-04 ユーザー指示「ラン5回・併用可」(それまでは無制限・カードと併用できない。いったん10回と言われ、すぐ5回に直った)
    maxUses: 5, unlimited: false, withCards: true, duration: 'style',
    styles: Object.freeze([
      Object.freeze({ id: 'sword', label: '片手剣', desc: 'いつもの戦い方。ソードスキルも出る' }),
      Object.freeze({ id: 'shield', label: '片手盾', desc: '力と同じ数値を丈夫さへ足す。固有技を使ってもソードスキルは出ない' }),
      Object.freeze({ id: 'dual', label: '二刀流', desc: '丈夫さが半分になる代わりに、連撃がすべて2回ぶん入る（メインのダメージは1回のまま）' }),
    ]),
    defaultStyle: 'sword',
    heroInitialStyle: true,
    effect: 'weaponChange',
  }),
  // ★2026-09-29 ユーザー指示「世界樹の守り。回復は20%、回数は5回」。
  //   3ターンのあいだ味方全員の被ダメージ30%軽減＋ターン終わりに味方全員のライフを上限の20%回復。
  //   カードとの併用はモッチー・ミタラシと同じく「できる」
  Yggdrasil: Object.freeze({
    id: 'yggdrasil_world_tree',
    name: '世界樹の守り',
    useNote: '3ターン 被ダメ−30%・毎ターン全員ライフ20%回復',
    desc: '3ターンのあいだ、味方全員を守り、癒やす。\n・味方全員の被ダメージ−30%\n・ターン終わりに、味方全員のライフが上限の20%回復',
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 3,
    partyTakenRate: 0.3, partyRegenRate: 0.2,
    effect: 'partyGuard',
  }),
  // ★2026-09-29 ユーザー指示「スイーツパラダイス。連撃30%×4にして」。効くのは発動したターンだけ、1ラン3回
  MelWhip: Object.freeze({
    id: 'melwhip_sweets_paradise',
    name: 'スイーツパラダイス',
    useNote: 'このターン 連撃30%×4・先にカードで攻撃',
    desc: 'このターンだけ、メルホイップの攻撃に連撃が付く。\n・与ダメージ30%の連撃が4回追加される\n・先にEXを使ってから、同じターンにメルホイップのカードで攻撃する',
    maxUses: 3, unlimited: false, withCards: true, duration: 'turn',
    extraCombos: Object.freeze({ count: 4, rate: 0.3 }),
    effect: 'comboBurst',
  }),
  // ★2026-10-05 ユーザー指示「オフリィアボイド、完全回避（2回）を付与。完全回避がなくなるまでクリティカル確定、連撃10%×3」
  //   「ゴーストが狙われた攻撃。連撃も技を1回とみなして消化は1」「5回」。
  //   残りは使ったWAVEのあいだ(ほかのEXと同じく、WAVEをまたがない)
  Ghost: Object.freeze({
    id: 'ghost_offlia_avoid',
    name: 'オフリィアボイド',
    useNote: '完全回避×2・残っているあいだ会心確定と連撃10%×3',
    desc: 'ゴーストが「完全回避」を2回ぶんもらう。\n・ゴーストが狙われた攻撃を、完全にかわす（連撃も全体攻撃も、技1回ぶんで1回減る）\n・完全回避が残っているあいだ、ゴーストの攻撃は会心が確定し、与ダメージ10%の連撃が3回付く\n・2回使い切るか、WAVEが変わると終わる',
    maxUses: 5, unlimited: false, withCards: true, duration: 'wave',
    avoidCharges: 2,
    extraCombos: Object.freeze({ count: 3, rate: 0.1 }),
    effect: 'avoidCharge',
  }),
  // ★2026-10-05 ユーザー指示「効果3ターン、ラン5回、効果中攻撃を当てたら相手が3ターン乱心になる。乱心は相手の行動が
  //   50%の確率で意味不明になる。（行動予測で出る）意味不明のときは行動不能、被クリ率100%アップ。更に使用した時に
  //   味方全員のライフガッツが30%回復。効果ターン中味方全員の力、丈夫さが10%アップ」「スプーキーの攻撃だけ」
  Spooky: Object.freeze({
    id: 'spooky_trick_confuse',
    name: 'トリックコンフューズ',
    useNote: '全員ライフ・ガッツ30%回復・3ターン 全員ちから丈夫さ+10%・当てると乱心',
    desc: '味方全員を回復し、3ターンのあいだ敵を惑わせる。\n・使った瞬間に、味方全員のライフとガッツが上限の30%回復\n・3ターンのあいだ、味方全員のちから・丈夫さ+10%\n・3ターンのあいだにスプーキーの攻撃を当てると、敵が3ターン「乱心」になる（乱心中にまた当てたら3ターンに数え直す）\n・乱心: 敵の行動が50%の確率で「意味不明」になる（次の行動に出る）。意味不明のターン、敵は動けず、味方の攻撃は会心が確定する',
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 3,
    partyHealRate: 0.3, partyStatRate: 0.1,
    effect: 'trickConfuse',
  }),
  // ★2026-10-08 ユーザーと決めた値(docs/spec/MELODY_KUROMY_SKILLS.md)。勇者特性のクッキーを全部配る「蓄積型の支援EX」。
  //   クッキーを持ち続けて常時の支援を保つか、全部配って一気に立て直すかを選ぶ
  Melody: Object.freeze({
    id: 'melody_melody_box',
    name: 'おねがい♪メロディボックス',
    useNote: 'クッキーを全部配る・全員回復＋3ターン与ダメ↑被ダメ↓',
    desc: 'クッキーを全部使って、味方全員へ振る舞う（1個から使える）。\n・使った瞬間に、味方全員のライフが上限の「個数×5%」、ガッツが「個数×4%」回復\n・3ターンのあいだ、味方全員の与ダメージ+「個数×2%」・被ダメージ−「個数×2%」\n・10個で使うと、効果が5ターンに伸びる\n・使うとクッキーは0個に戻る',
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 3,
    stackSpend: Object.freeze({ full: 10, heal: 0.05, guts: 0.04, dmg: 0.02, taken: 0.02, fullTurns: 5 }),
    conditions: Object.freeze(['hasStack']),
    effect: 'cookieBox',
  }),
  // ★2026-10-08 ユーザーと決めた値。黒音符を全部使って本人の攻撃を一気に上げる「攻撃特化EX」(メロディーの「配る」に対して「叩き込む」)
  Kuromy: Object.freeze({
    id: 'kuromy_melody_key',
    name: '悪夢全開！メロディ・キー',
    useNote: '黒音符を全部使う・3ターン クロミーの与ダメ・会心率・敵の被ダメ↑',
    desc: '黒音符を全部使って、悪夢魔法を全開にする（1個から使える）。\n・3ターンのあいだ、クロミーの与ダメージ+「個数×4%」・会心率+「個数×3%」\n・3ターンのあいだ、敵の被ダメージ+「個数×2%」\n・10個で使うと、さらにクロミーの攻撃へ与ダメージ30%の連撃が2回付く\n・使うと黒音符は0個に戻る',
    maxUses: 5, unlimited: false, withCards: true, duration: 'turns', turns: 3,
    stackSpend: Object.freeze({ full: 10, dmg: 0.04, crit: 0.03, enemyTaken: 0.02, fullCombo: Object.freeze({ count: 2, rate: 0.3 }) }),
    conditions: Object.freeze(['hasStack']),
    effect: 'nightmareKey',
  }),
});
// 追加の条件。ctx を受け取り、使えないときだけ理由の文を返す(使えるなら null)。
// ctx: { active(その子のEXがいま効いているか) }
// 条件の中身を本体へ書かずにここへ集めるので、EXを足すときは定義に名前を書くだけで済む
const TACTICS_EX_CONDITIONS = Object.freeze({
  notActive: (ctx) => (ctx && ctx.active ? '効果が続いているあいだは使えない' : null),
  // 勇者特性のスタック(クッキー・黒音符)を全部使うEX。1個も無いと使えない。ctx.stacks はいまの数、ctx.stackLabel はその呼び名
  hasStack: (ctx) => (ctx && Number(ctx.stacks) > 0 ? null : `${(ctx && ctx.stackLabel) || 'スタック'}が1つも無いと使えない`),
});
// 効果を実装済みの種類。★ここに無い effect は「回数と併用の決まりだけ動き、効果はまだ出ない」。
//   画面は「開発中」と出す(使ったのに何も起きない、を黙って出さない)。
//   STEP2 で効果を入れたら、ここへ名前を足す
const TACTICS_EX_IMPLEMENTED_EFFECTS = Object.freeze(['coverAll', 'allIn', 'weaponChange', 'statBoost', 'distMatch', 'partyGuard', 'comboBurst', 'dodgeCombo', 'multiBuff', 'stage', 'present', 'lifeSpring', 'timeStop', 'pandoraBox', 'thunder', 'partyBoost', 'damageBack', 'psychoLock', 'counter', 'avoidCharge', 'trickConfuse', 'cookieBox', 'nightmareKey']);
// 捨て身で力へ移す割合(0にした丈夫さの50%)
const TACTICS_EX_ALL_IN_ATK_RATE = 0.5;
const TACTICS_EX_DURATIONS = Object.freeze(['turn', 'wave', 'style', 'turns']);
// 二刀流で、連撃を何回ぶん入れるか(メインのダメージは1回のまま。連撃だけ2回ぶん)
const TACTICS_EX_DUAL_HIT_REPEAT = 2;

// 定義を安全な形へそろえる。壊れた項目があっても落とさず、いちばん控えめな既定値へ倒す
const normalizeTacticsExDef = (raw) => {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const unlimited = raw.unlimited === true;
  const duration = TACTICS_EX_DURATIONS.includes(raw.duration) ? raw.duration : 'turn';
  const styles = Array.isArray(raw.styles)
    ? raw.styles.filter(st => st && typeof st.id === 'string' && st.id)
      .map(st => ({ id: st.id, label: String(st.label || st.id), desc: String(st.desc || '') }))
    : [];
  // スタイル式なのに選択肢が2つ未満なら、選び直せないので発動ターンへ倒す
  const safeDuration = duration === 'style' && styles.length < 2 ? 'turn' : duration;
  const defaultStyle = styles.some(st => st.id === raw.defaultStyle) ? raw.defaultStyle : (styles[0] ? styles[0].id : null);
  return {
    id: raw.id,
    name: String(raw.name || raw.id),
    desc: String(raw.desc || ''),
    useNote: String(raw.useNote || ''),
    maxUses: unlimited ? 0 : Math.max(0, tacticsSafeInt(raw.maxUses, 0)),
    unlimited,
    // ★併用できるかが書かれていなければ「併用できない」へ倒す(強すぎる側へ倒さない)
    withCards: raw.withCards === true,
    duration: safeDuration,
    styles: safeDuration === 'style' ? styles : [],
    defaultStyle: safeDuration === 'style' ? defaultStyle : null,
    heroInitialStyle: safeDuration === 'style' && raw.heroInitialStyle === true,
    turns: safeDuration === 'turns' ? Math.max(1, tacticsSafeInt(raw.turns, 1)) : 0,
    statRate: Math.max(0, Number.isFinite(Number(raw.statRate)) ? Number(raw.statRate) : 0),
    regenRate: Math.max(0, Number.isFinite(Number(raw.regenRate)) ? Number(raw.regenRate) : 0),
    // ステータスごとの上げ幅。書いていない項目は statRate / regenRate(ガッツ全開っちーはすべて同じ率)
    rates: ['atk', 'def', 'hp', 'guts'].reduce((acc, key) => {
      const v = Number(raw.rates && raw.rates[key]);
      const fallback = Number(raw.statRate);
      acc[key] = Math.max(0, Number.isFinite(v) ? v : (Number.isFinite(fallback) ? fallback : 0));
      return acc;
    }, {}),
    regenRates: ['hp', 'guts'].reduce((acc, key) => {
      const v = Number(raw.regenRates && raw.regenRates[key]);
      const fallback = Number(raw.regenRate);
      acc[key] = Math.max(0, Number.isFinite(v) ? v : (Number.isFinite(fallback) ? fallback : 0));
      return acc;
    }, {}),
    fullRecover: raw.fullRecover === true,
    partyTakenRate: Math.min(0.9, Math.max(0, Number.isFinite(Number(raw.partyTakenRate)) ? Number(raw.partyTakenRate) : 0)),
    partyRegenRate: Math.max(0, Number.isFinite(Number(raw.partyRegenRate)) ? Number(raw.partyRegenRate) : 0),
    dodgeComboRate: Math.max(0, Number.isFinite(Number(raw.dodgeComboRate)) ? Number(raw.dodgeComboRate) : 0),
    avoidCharges: Math.min(9, Math.max(0, tacticsSafeInt(raw.avoidCharges, 0))),
    partyHealRate: Math.min(1, Math.max(0, Number.isFinite(Number(raw.partyHealRate)) ? Number(raw.partyHealRate) : 0)),
    partyStatRate: Math.min(1, Math.max(0, Number.isFinite(Number(raw.partyStatRate)) ? Number(raw.partyStatRate) : 0)),
    distMult: Math.max(0, Number.isFinite(Number(raw.distMult)) ? Number(raw.distMult) : 0),
    guaranteeUnique: raw.guaranteeUnique === true,
    uniqueCrit: raw.uniqueCrit === true,
    cardBonus: Math.min(3, Math.max(0, tacticsSafeInt(raw.cardBonus, 0))),
    voltage: raw.voltage && typeof raw.voltage === 'object' && tacticsSafeInt(raw.voltage.max, 0) > 0
      ? { max: Math.min(99, tacticsSafeInt(raw.voltage.max, 0)),
        dmg: Math.max(0, Number(raw.voltage.dmg) || 0), heal: Math.max(0, Number(raw.voltage.heal) || 0), guts: Math.max(0, Number(raw.voltage.guts) || 0), hp: Math.max(0, Number(raw.voltage.hp) || 0) } : null,
    usesPerWave: raw.usesPerWave === true,
    target: raw.target === 'ally' ? 'ally' : null,
    counter: raw.counter && typeof raw.counter === 'object'
      ? { start: Math.max(0, tacticsSafeInt(raw.counter.start, 0)), mult: Math.max(0, Number(raw.counter.mult) || 0) } : null,
    psychoLock: raw.psychoLock && typeof raw.psychoLock === 'object'
      ? { enemyDmgDown: Math.min(0.9, Math.max(0, Number(raw.psychoLock.enemyDmgDown) || 0)), enemyTakenUp: Math.max(0, Number(raw.psychoLock.enemyTakenUp) || 0) } : null,
    damageBack: raw.damageBack && typeof raw.damageBack === 'object'
      ? { hpRate: Math.max(0, Number(raw.damageBack.hpRate) || 0), gutsRate: Math.max(0, Number(raw.damageBack.gutsRate) || 0) } : null,
    partyBoost: raw.partyBoost && typeof raw.partyBoost === 'object'
      ? { statRate: Math.max(0, Number(raw.partyBoost.statRate) || 0), hpRegen: Math.max(0, Number(raw.partyBoost.hpRegen) || 0), gutsRegen: Math.max(0, Number(raw.partyBoost.gutsRegen) || 0) } : null,
    thunder: raw.thunder && typeof raw.thunder === 'object' && tacticsSafeInt(raw.thunder.chargeTurns, 0) > 0
      ? { chargeTurns: Math.min(9, tacticsSafeInt(raw.thunder.chargeTurns, 0)), dmg: Math.max(0, Number(raw.thunder.dmg) || 0), crit: Math.max(0, Number(raw.thunder.crit) || 0), comboRate: Math.max(0, Number(raw.thunder.comboRate) || 0), dodge: Math.max(0, Number(raw.thunder.dodge) || 0), regenHp: Math.max(0, Number(raw.thunder.regenHp) || 0), regenGuts: Math.max(0, Number(raw.thunder.regenGuts) || 0) } : null,
    pandoraBox: raw.pandoraBox && typeof raw.pandoraBox === 'object' ? (() => {
      const n = (v) => Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0);
      const c = raw.pandoraBox.devilCombo;
      return { costRate: Math.min(0.9, n(raw.pandoraBox.costRate)), selfCardBonus: Math.min(3, tacticsSafeInt(raw.pandoraBox.selfCardBonus, 0)),
        devilDmg: Math.max(1, n(raw.pandoraBox.devilDmg) || 1), guaranteeUnique: raw.pandoraBox.guaranteeUnique === true, lockTurns: Math.min(1, tacticsSafeInt(raw.pandoraBox.lockTurns, 0)), angelRate: n(raw.pandoraBox.angelRate), hopeGutsRate: n(raw.pandoraBox.hopeGutsRate),
        devilCombo: c && typeof c === 'object' && tacticsSafeInt(c.count, 0) > 0 && Number(c.rate) > 0 ? { count: tacticsSafeInt(c.count, 0), rate: Number(c.rate) } : null };
    })() : null,
    lifeSpring: raw.lifeSpring && typeof raw.lifeSpring === 'object'
      ? { maxUpRate: Math.max(0, Number(raw.lifeSpring.maxUpRate) || 0), gutsRate: Math.max(0, Number(raw.lifeSpring.gutsRate) || 0),
        konjo: Math.min(3, tacticsSafeInt(raw.lifeSpring.konjo, 0)), dmgUp: Math.max(0, Number(raw.lifeSpring.dmgUp) || 0) } : null,
    aqua: raw.aqua && typeof raw.aqua === 'object' && tacticsSafeInt(raw.aqua.needed, 0) > 0 ? (() => {
      const n = (v) => Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0);
      return { needed: Math.min(9, tacticsSafeInt(raw.aqua.needed, 0)), dmgPerStack: Math.min(0.3, n(raw.aqua.dmgPerStack)), takenPerStack: n(raw.aqua.takenPerStack),
        finaleTaken: n(raw.aqua.finaleTaken), finaleTurns: Math.min(5, Math.max(1, tacticsSafeInt(raw.aqua.finaleTurns, 1))) };
    })() : null,
    present: raw.present && typeof raw.present === 'object' ? (() => {
      const n = (v) => Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0);
      const c = raw.present.combo;
      return { fixedGuts: n(raw.present.fixedGuts), jackpot: Math.min(1, n(raw.present.jackpot)), dmg: n(raw.present.dmg), taken: Math.min(0.9, n(raw.present.taken)),
        crit: n(raw.present.crit), heal: n(raw.present.heal), guts: n(raw.present.guts), draws: Math.min(6, Math.max(1, tacticsSafeInt(raw.present.draws, 1))),
        grow: raw.present.grow && typeof raw.present.grow === 'object' ? { effect: n(raw.present.grow.effect), fixedGuts: n(raw.present.grow.fixedGuts), jackpot: n(raw.present.grow.jackpot), maxLevel: Math.min(30, tacticsSafeInt(raw.present.grow.maxLevel, 0)) } : null,
        combo: c && typeof c === 'object' && tacticsSafeInt(c.count, 0) > 0 && Number(c.rate) > 0 ? { count: tacticsSafeInt(c.count, 0), rate: Number(c.rate) } : null };
    })() : null,
    stackSpend: raw.stackSpend && typeof raw.stackSpend === 'object' && tacticsSafeInt(raw.stackSpend.full, 0) > 0 ? (() => {
      const n = (v) => Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0);
      const c = raw.stackSpend.fullCombo;
      return { full: Math.min(99, tacticsSafeInt(raw.stackSpend.full, 0)), heal: Math.min(0.2, n(raw.stackSpend.heal)), guts: Math.min(0.2, n(raw.stackSpend.guts)),
        dmg: n(raw.stackSpend.dmg), taken: Math.min(0.09, n(raw.stackSpend.taken)), crit: n(raw.stackSpend.crit), enemyTaken: n(raw.stackSpend.enemyTaken),
        fullTurns: Math.min(9, tacticsSafeInt(raw.stackSpend.fullTurns, 0)),
        fullCombo: c && typeof c === 'object' && tacticsSafeInt(c.count, 0) > 0 && Number(c.rate) > 0 ? { count: tacticsSafeInt(c.count, 0), rate: Number(c.rate) } : null };
    })() : null,
    lifeCostRate: Math.min(0.9, Math.max(0, Number.isFinite(Number(raw.lifeCostRate)) ? Number(raw.lifeCostRate) : 0)),
    dmgRate: Math.max(0, Number.isFinite(Number(raw.dmgRate)) ? Number(raw.dmgRate) : 0),
    selfTakenRate: Math.min(0.9, Math.max(0, Number.isFinite(Number(raw.selfTakenRate)) ? Number(raw.selfTakenRate) : 0)),
    critRateRate: Math.max(0, Number.isFinite(Number(raw.critRateRate)) ? Number(raw.critRateRate) : 0),
    critDmgRate: Math.max(0, Number.isFinite(Number(raw.critDmgRate)) ? Number(raw.critDmgRate) : 0),
    extraCombos: raw.extraCombos && typeof raw.extraCombos === 'object'
      && tacticsSafeInt(raw.extraCombos.count, 0) > 0 && Number(raw.extraCombos.rate) > 0
      ? { count: tacticsSafeInt(raw.extraCombos.count, 0), rate: Number(raw.extraCombos.rate) } : null,
    conditions: Array.isArray(raw.conditions) ? raw.conditions.filter(k => typeof TACTICS_EX_CONDITIONS[k] === 'function') : [],
    conditionText: raw.conditionText ? String(raw.conditionText) : null,
    effect: typeof raw.effect === 'string' ? raw.effect : null,
  };
};
// 効果時間の文(「5ターンのあいだ」のようにターン数を入れる)
const tacticsExDurationText = (def) => (!def ? null
  : def.duration === 'turns' ? `使ったターンから${def.turns}ターンのあいだ（WAVEが変わると切れる）`
  : (TACTICS_EX_DURATION_TEXT[def.duration] || null));
// そのモンスターのEX。持っていなければ null
const tacticsExDefOf = (monId, table = TACTICS_EX_SKILLS) =>
  (monId && table && Object.prototype.hasOwnProperty.call(table, monId) ? normalizeTacticsExDef(table[monId]) : null);
const isTacticsExEffectImplemented = (def, implemented = TACTICS_EX_IMPLEMENTED_EFFECTS) =>
  !!(def && def.effect && implemented.includes(def.effect));

// ラン中の状態。枠(スロット)ごとに持つ(配置はラン中に変わらないので枠で数えてよい)。
// ★念のため monId も持ち、枠の子が違えば「その子はまだ使っていない」として数える
//   uses[slot]    = { monId, count }                1ランで使った回数
//   effects[slot] = { monId, exId, effect, duration, wave, turn, on, style, snapshot }   いま載っている効果
//                   (style はスタイル式のいまのスタイル。on は「既定のスタイル以外か」)
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
// このランで、その子がそのEXを使った合計回数(WAVEで回数が戻るEXでも戻らない。プレゼントの成長に使う)
const tacticsExTotalUsesOf = (state, slot, monId) => {
  const own = normalizeTacticsExState(state).uses[slot];
  return own && own.monId === monId ? Math.max(tacticsSafeInt(own.count, 0), tacticsSafeInt(own.total, 0)) : 0;
};
// プレゼントの成長: 使った回数(level)ぶん、効果量・ガッツ回復量・大当たりの確率が上がる(上限つき)
const tacticsExPresentScaled = (cfg, level) => {
  if (!cfg) return cfg;
  const g = cfg.grow, lv = g ? Math.min(tacticsSafeInt(g.maxLevel, 0), Math.max(0, tacticsSafeInt(level, 0))) : 0;
  if (!g || lv <= 0) return { ...cfg };
  const k = 1 + (Number(g.effect) || 0) * lv;
  return { ...cfg, fixedGuts: Math.min(0.6, cfg.fixedGuts + (Number(g.fixedGuts) || 0) * lv), jackpot: Math.min(0.5, cfg.jackpot + (Number(g.jackpot) || 0) * lv),
    dmg: cfg.dmg * k, taken: Math.min(0.9, cfg.taken * k), crit: cfg.crit * k, heal: cfg.heal * k, guts: cfg.guts * k,
    combo: cfg.combo ? { count: cfg.combo.count, rate: cfg.combo.rate * k } : null };
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
  if (effect.duration === 'style') return effect.on === true;
  // ★オフリィアボイド(avoidCharge)は、完全回避を使い切ったら終わる(会心確定・連撃も一緒に終わる)
  if (effect.effect === 'avoidCharge' && tacticsSafeInt(effect.avoidLeft, 0) <= 0) return false;
  // ★ターン数で切れるもの。**WAVEをまたがない**(2026-09-25 ユーザー指示「WAVE跨ぎはなし」)。
  //   同じWAVEのあいだだけ、使ったターンから数えて turns ターン目まで効く
  if (effect.duration === 'turns') {
    if (!now || tacticsSafeInt(effect.wave, -1) !== tacticsSafeInt(now.wave, -2)) return false;
    const at = tacticsSafeInt(now.turn, -1), from = tacticsSafeInt(effect.turn, -1), len = tacticsSafeInt(effect.turns, 0);
    return from >= 0 && at >= from && at < from + len;
  }
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
// 使うときに払うライフ(最大ライフの lifeCostRate。切り捨て)。払わないEXは0
const tacticsExLifeCost = (def, maxHp) => (def && def.lifeCostRate > 0 ? Math.floor(Math.max(0, Number(maxHp) || 0) * def.lifeCostRate) : 0);
// hp / maxHp … 使う子のいまのライフと最大ライフ(ライフを払うEXの判定に使う。渡さなければ見ない)
// stacks / stackLabel … 勇者特性のスタックを使うEX(hasStack)のための、いまの数と呼び名
const checkTacticsExUse = ({ def, state, slot, monId, alive, selectedCount = 0, now, busy = false, hp = null, maxHp = null, stacks = null, stackLabel = null } = {}) => {
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
  if (def.lifeCostRate > 0 && hp != null && maxHp != null && Number.isFinite(Number(hp)) && Number.isFinite(Number(maxHp)) && Number(hp) <= tacticsExLifeCost(def, maxHp)) {
    return { ok: false, reason: `ライフが足りない（最大ライフの${Math.round(def.lifeCostRate * 100)}%を払うので、それより多く残っているときだけ使える）` };
  }
  const active = isTacticsExEffectActive(safe, slot, monId, now);
  for (const key of def.conditions || []) {
    const why = TACTICS_EX_CONDITIONS[key] ? TACTICS_EX_CONDITIONS[key]({ active, stacks, stackLabel }) : null;
    if (why) return { ok: false, reason: why };
  }
  return { ok: true, reason: null };
};
// 使ったあとの状態を返す(渡された state は書き換えない)。
// ★回数を減らすのは無制限でないときだけ。無制限は数えるが、残りには効かない
// snapshot … 使った瞬間の値(捨て身なら使ったときの丈夫さ)。効果の計算はこの値から出す
// choice … スタイル式のとき、選んだスタイルの id(checkTacticsExChoice を通したもの)
// target … 味方を選んで使うEX(生命の泉)で、選んだ味方の枠
// スタックを使うEX(stackSpend)で、使った個数(snapshot.spent)。ほかのEXは0
const tacticsExSpentOf = (snapshot) => Math.min(99, Math.max(0, tacticsSafeInt(snapshot && snapshot.spent, 0)));
// 効く長さ。スタックを満タン(full個)で使い、fullTurns があればそのターン数(おねがい♪メロディボックスの5ターン)
const tacticsExStackSpendTurns = (def, snapshot) => {
  const cfg = def && def.stackSpend;
  return cfg && cfg.fullTurns > 0 && tacticsExSpentOf(snapshot) >= cfg.full ? cfg.fullTurns : def.turns;
};
const applyTacticsExUse = (state, { def, slot, monId, now, snapshot = null, choice = null, target = null, presentLevel = null } = {}) => {
  const safe = normalizeTacticsExState(state);
  if (!def || !Number.isInteger(slot)) return safe;
  // スタイル式は、選べないスタイル(いまのもの・知らないもの)なら何もしない(回数も減らさない)
  if (def.duration === 'style' && checkTacticsExChoice(def, safe, slot, monId, choice)) return safe;
  const stamp = { wave: tacticsSafeInt(now && now.wave, 0), turn: tacticsSafeInt(now && now.turn, 0) };
  const count = tacticsExUsesOf(safe, slot, monId) + 1;
  const style = def.duration === 'style' ? choice : null;
  return {
    uses: { ...safe.uses, [slot]: { monId, count, total: tacticsExTotalUsesOf(safe, slot, monId) + 1 } },
    effects: { ...safe.effects, [slot]: { monId, exId: def.id, effect: def.effect, duration: def.duration, wave: stamp.wave, turn: stamp.turn,
      on: def.duration === 'style' ? style !== def.defaultStyle : true,
      style,
      turns: def.duration === 'turns' ? tacticsExStackSpendTurns(def, snapshot) : 0, statRate: def.statRate || 0, regenRate: def.regenRate || 0,
      rates: def.rates ? { ...def.rates } : null, regenRates: def.regenRates ? { ...def.regenRates } : null,
      partyTakenRate: def.partyTakenRate || 0, partyRegenRate: def.partyRegenRate || 0,
      extraCombos: def.extraCombos ? { ...def.extraCombos } : null,
      dodgeComboRate: def.dodgeComboRate || 0, dodges: 0,
      avoidLeft: def.avoidCharges || 0, partyStatRate: def.partyStatRate || 0,
      dmgRate: def.dmgRate || 0, selfTakenRate: def.selfTakenRate || 0, critRateRate: def.critRateRate || 0, critDmgRate: def.critDmgRate || 0,
      distMult: def.distMult || 0, guaranteeUnique: def.guaranteeUnique === true, uniqueCrit: def.uniqueCrit === true, cardBonus: def.cardBonus || 0,
      voltageCfg: def.voltage ? { ...def.voltage } : null, voltage: 0,
      presentCfg: def.present ? tacticsExPresentScaled(def.present, Number.isInteger(presentLevel) ? presentLevel : tacticsExTotalUsesOf(safe, slot, monId)) : null, present: null,
      target: Number.isInteger(target) ? target : null, lifeSpringCfg: def.lifeSpring ? { ...def.lifeSpring } : null, aquaCfg: def.aqua ? { ...def.aqua } : null, aqua: def.aqua ? { route: null, stacks: 0, finale: null } : null, springDown: false, konjoLeft: 0,
      pandoraBoxCfg: def.pandoraBox ? { ...def.pandoraBox } : null,
      thunderCfg: def.thunder ? { ...def.thunder } : null, thunder: 0,
      partyBoostCfg: def.partyBoost ? { ...def.partyBoost } : null,
      damageBackCfg: def.damageBack ? { ...def.damageBack } : null,
      psychoLockCfg: def.psychoLock ? { ...def.psychoLock } : null,
      counterCfg: def.counter ? { ...def.counter } : null, counter: def.counter ? def.counter.start : 0,
      stackSpendCfg: def.stackSpend ? { ...def.stackSpend } : null, spent: def.stackSpend ? tacticsExSpentOf(snapshot) : 0,
      snapshot: snapshot && typeof snapshot === 'object' ? { ...snapshot } : null } },
    lastUse: { ...safe.lastUse, [slot]: stamp },
    turnUsed: stamp,
    cardLock: def.withCards ? safe.cardLock : { ...safe.cardLock, [slot]: stamp },
  };
};
// スタイル式のEXの、いまのスタイル(id)。選んだことが無ければ既定のスタイル
const tacticsExStyleOf = (def, state, slot, monId) => {
  if (!def || def.duration !== 'style') return null;
  const effect = normalizeTacticsExState(state).effects[slot];
  const style = effect && effect.monId === monId ? effect.style : null;
  return def.styles.some(st => st.id === style) ? style : def.defaultStyle;
};
// いまのスタイルの呼び名(画面に「いま：片手盾」のように出す)
const tacticsExStyleLabel = (def, state, slot, monId) => {
  const id = tacticsExStyleOf(def, state, slot, monId);
  const st = id && def.styles.find(x => x.id === id);
  return st ? st.label : null;
};
// そのスタイルを選べるか。選べないときだけ理由を返す(いまのスタイルは選べない)
const checkTacticsExChoice = (def, state, slot, monId, choice) => {
  if (!def || def.duration !== 'style') return null;
  if (!def.styles.some(st => st.id === choice)) return 'スタイルを選ぶ';
  if (tacticsExStyleOf(def, state, slot, monId) === choice) return 'いまのスタイルは選べない';
  return null;
};
// 勇者モンの初期スタイル(配置の画面で選ぶ)。回数も「このターン」も数えない。
// ★バトルを始める前にしか呼ばないので、ほかの記録はまっさらにして、その枠の1件だけにする
//   (選び直して別の枠へ置き直したとき、前の枠に古いスタイルが残らないように)
const setTacticsExInitialStyle = (state, { def, slot, monId, style } = {}) => {
  const base = createTacticsExState();
  if (!def || !def.heroInitialStyle || !Number.isInteger(slot) || !def.styles.some(st => st.id === style)) return base;
  if (style === def.defaultStyle) return base;
  return { ...base, effects: { [slot]: { monId, exId: def.id, effect: def.effect, duration: def.duration,
    wave: 0, turn: 0, on: true, style, snapshot: null } } };
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
//   ソード・コンバージョン(weaponChange) の片手盾 … いまの力と同じ数値を丈夫さへ足す(力は減らない)
//                                         二刀流 … 丈夫さを半分にする(ヒット列の2回ぶんは tacticsExActiveStyle を見て別に掛ける)
// ターン終わりの自動回復の率へ足す値(ガッツ全開っちーが効いている子だけ。ほかは0)。
// ★倍率ではなく固定値で足す(いまの率 + regenRate)。倒れている子の戻り(10%ずつ)には乗せない
// kind … 'hp' か 'guts'。regenRates があればその項目、無ければ regenRate(ライフ・ガッツ共通)
const tacticsExRegenRateAt = (state, units, slot, now, kind = 'hp') => {
  const unit = Array.isArray(units) ? units[slot] : null;
  if (!unit) return 0;
  const kindNow = tacticsExActiveEffect(state, slot, unit.id, now);
  // 雷狼影(thunder): 雷纏のあいだ、雷の数ぶん自動回復の率へ足す(ライフ・ガッツそれぞれ regenHp・regenGuts × 雷)
  if (kindNow === 'thunder') {
    const t = tacticsExThunderOf(state, units, slot, now), cfg = normalizeTacticsExState(state).effects[slot].thunderCfg;
    const per = Number(cfg && (kind === 'guts' ? cfg.regenGuts : cfg.regenHp));
    return t && t.phase === 'wrap' && Number.isFinite(per) && per > 0 ? t.charge * per : 0;
  }
  if (kindNow === 'timeStop') {
    const cp = normalizeTacticsExState(state).effects[slot].snapshot, c = cp && cp.copied;
    const v = Number(c && (kind === 'guts' ? c.regenGuts : c.regenHp));
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  if (kindNow !== 'statBoost') return 0;
  const effect = normalizeTacticsExState(state).effects[slot];
  const own = Number(effect.regenRates && effect.regenRates[kind]);
  const rate = Number.isFinite(own) ? own : Number(effect.regenRate);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
};
// 世界樹の守り(partyGuard)。味方全員の被ダメージへ掛ける倍率。効いている子が複数いれば掛け算で重なる。
// ★使った子が倒れても効果は残る(守りは場に張られたもの)。WAVEが変わると切れる
const tacticsExPartyTakenMult = (state, units, now) => {
  const effects = normalizeTacticsExState(state).effects;
  return Object.keys(effects).reduce((mult, key) => {
    const slot = Number(key);
    const unit = Array.isArray(units) ? units[slot] : null;
    if (!unit || tacticsExActiveEffect(state, slot, unit.id, now) !== 'partyGuard') return mult;
    const rate = Number(effects[key].partyTakenRate);
    return Number.isFinite(rate) && rate > 0 ? mult * (1 - Math.min(0.9, rate)) : mult;
  }, 1);
};
// 世界樹の守りの、ターン終わりのライフ回復(味方全員へ足す率)
const tacticsExPartyRegenRate = (state, units, now) => {
  const effects = normalizeTacticsExState(state).effects;
  return Object.keys(effects).reduce((sum, key) => {
    const slot = Number(key);
    const unit = Array.isArray(units) ? units[slot] : null;
    if (!unit || tacticsExActiveEffect(state, slot, unit.id, now) !== 'partyGuard') return sum;
    const rate = Number(effects[key].partyRegenRate);
    return Number.isFinite(rate) && rate > 0 ? sum + rate : sum;
  }, 0);
};
// スイーツパラダイス(comboBurst)。その子の攻撃へ足す連撃 { count, rate }。効いていなければ null
const tacticsExExtraCombosAt = (state, units, slot, now) => {
  const unit = Array.isArray(units) ? units[slot] : null;
  if (!unit) return null;
  const kind = tacticsExActiveEffect(state, slot, unit.id, now);
  // 血踊(dodgeCombo): 回避した数だけ、与ダメージ rate の連撃が1回ずつ増える
  if (kind === 'dodgeCombo') {
    const mine = normalizeTacticsExState(state).effects[slot];
    const dodges = tacticsSafeInt(mine && mine.dodges, 0), rate = Number(mine && mine.dodgeComboRate);
    return dodges > 0 && Number.isFinite(rate) && rate > 0 ? { count: dodges, rate, label: '血踊' } : null;
  }
  // 雷狼影(thunder): 雷纏のあいだ、雷の数だけ与ダメージ comboRate の連撃が付く
  if (kind === 'thunder') {
    const t = tacticsExThunderOf(state, units, slot, now);
    return t && t.combo ? t.combo : null;
  }
  // 悪夢全開！メロディ・キー: 黒音符を満タン(10個)で使ったときだけ、連撃が付く
  if (kind === 'nightmareKey') {
    const k = tacticsExNightmareOf(state, units, slot, now);
    return k && k.combo ? k.combo : null;
  }
  if (kind !== 'comboBurst' && kind !== 'multiBuff' && kind !== 'avoidCharge') return null;
  const own = normalizeTacticsExState(state).effects[slot].extraCombos;
  const count = tacticsSafeInt(own && own.count, 0), rate = Number(own && own.rate);
  if (!(count > 0 && Number.isFinite(rate) && rate > 0)) return null;
  // 連撃の名前は、アーク・イブリース(multiBuff)ではそのEXの名前(スイーツパラダイスは、これまでどおり名前を渡さない)
  return kind === 'multiBuff' || kind === 'avoidCharge' ? { count, rate, label: (tacticsExDefOf(unit.id) || {}).name || '' } : { count, rate };
};
// ---- ライガー(thunder): 雷狼影 ----
// いまの雷と段階。phase は 'charge'(ためている前半)か 'wrap'(雷纏の後半)。効いていなければ null
const tacticsExThunderOf = (state, units, slot, now) => {
  const unit = Array.isArray(units) ? units[slot] : null;
  if (!unit || tacticsExActiveEffect(state, slot, unit.id, now) !== 'thunder') return null;
  const mine = normalizeTacticsExState(state).effects[slot], cfg = mine.thunderCfg;
  if (!cfg) return null;
  const charge = Math.min(99, Math.max(0, tacticsSafeInt(mine.thunder, 0)));
  const offset = tacticsSafeInt(now && now.turn, 0) - tacticsSafeInt(mine.turn, 0);
  const chargeTurns = tacticsSafeInt(cfg.chargeTurns, 0), total = tacticsSafeInt(mine.turns, 0);
  const phase = offset < chargeTurns ? 'charge' : 'wrap';
  const wrap = phase === 'wrap';
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  return { slot, phase, charge, turnsLeft: Math.max(0, (wrap ? total : chargeTurns) - offset),
    dmgMult: wrap ? 1 + charge * num(cfg.dmg) : 1, critAdd: wrap ? charge * num(cfg.crit) : 0,
    dodgeRate: wrap ? Math.min(0.9, charge * num(cfg.dodge)) : 0,
    combo: wrap && charge > 0 && num(cfg.comboRate) > 0 ? { count: charge, rate: num(cfg.comboRate), label: '雷纏' } : null };
};
// そのターンにライガーが使ったカード n 枚ぶん、雷をためる(ためている前半のターンだけ。ほかは状態をそのまま返す)
const addTacticsExThunder = (state, units, now, slot, n) => {
  const safe = normalizeTacticsExState(state);
  const add = Math.max(0, tacticsSafeInt(n, 0));
  const t = tacticsExThunderOf(safe, units, slot, now);
  if (!t || t.phase !== 'charge' || add <= 0) return safe;
  return { ...safe, effects: { ...safe.effects, [slot]: { ...safe.effects[slot], thunder: Math.min(99, t.charge + add) } } };
};
// アーク・イブリース(multiBuff)が効いている子の、与ダメージ・被ダメージ・会心の倍率(効いていなければ全部1)
const tacticsExMultiBuffOf = (state, units, slot, now) => {
  const unit = Array.isArray(units) ? units[slot] : null;
  if (!unit) return null;
  const kind = tacticsExActiveEffect(state, slot, unit.id, now);
  // 雷狼影(thunder): 雷纏のあいだだけ、雷の数ぶん与ダメージが乗り、会心率が足される(critAdd は足し算)
  if (kind === 'thunder') {
    const t = tacticsExThunderOf(state, units, slot, now);
    return t && t.phase === 'wrap' && t.charge > 0 ? { dmg: t.dmgMult, taken: 1, critRate: 1, critAdd: t.critAdd, critDmg: 1, distMult: 0 } : null;
  }
  // 悠久の刻(timeStop): 使った瞬間にコピーした味方の強化を、そのターンだけ受ける
  if (kind === 'timeStop') {
    const cp = normalizeTacticsExState(state).effects[slot].snapshot;
    const c = cp && cp.copied;
    return c ? { dmg: c.dmg, taken: c.taken, critRate: c.critRate, critAdd: c.critAdd, critDmg: c.critDmg, distMult: 0 } : null;
  }
  // 悪夢全開！メロディ・キー(nightmareKey): 使った黒音符の数ぶん、本人の与ダメージと会心率(足し算)が上がる
  if (kind === 'nightmareKey') {
    const k = tacticsExNightmareOf(state, units, slot, now);
    return k ? { dmg: k.dmgMult, taken: 1, critRate: 1, critAdd: k.critAdd, critDmg: 1, distMult: 0 } : null;
  }
  if (kind !== 'multiBuff') return null;
  const own = normalizeTacticsExState(state).effects[slot];
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  return { dmg: 1 + num(own.dmgRate), taken: 1 - Math.min(0.9, num(own.selfTakenRate)), critRate: 1 + num(own.critRateRate), critAdd: 0, critDmg: 1 + num(own.critDmgRate), uniqueCrit: own.uniqueCrit === true, distMult: num(own.distMult) };
};
// ---- ピクシー(guaranteeUnique): 効いているあいだ、毎ターン固有技カードを手札へ出す ----
// 出す子の枠(効いていなければ null)。次のターンに効くかを見たいときは、now にそのターンを渡す
const tacticsExUniqueGuaranteeSlot = (state, units, now) => {
  const effects = normalizeTacticsExState(state).effects;
  const hit = Object.keys(effects).map(Number).find(slot => {
    const unit = Array.isArray(units) ? units[slot] : null;
    if (!unit) return false;
    const kind = tacticsExActiveEffect(state, slot, unit.id, now);
    // パンドラの箱も、効いているあいだ毎ターン固有技を手札へ出す
    return (effects[slot].guaranteeUnique === true && kind === 'multiBuff') || (kind === 'pandoraBox' && !!(effects[slot].pandoraBoxCfg && effects[slot].pandoraBoxCfg.guaranteeUnique));
  });
  return hit == null ? null : hit;
};
// 手札に predicate を満たすカードが無ければ、山札→捨て札の順で探して手札へ入れる。
// 手札がいっぱい(5枚)なら、いちばん後ろの別のカードを山札の底へ戻して入れ替える。見つからなければそのまま
const ensureTacticsExUniqueInHand = ({ hand, deck, graveyard }, predicate, handMax = 5) => {
  const h = Array.isArray(hand) ? hand.slice() : [], d = Array.isArray(deck) ? deck.slice() : [], g = Array.isArray(graveyard) ? graveyard.slice() : [];
  if (h.some(predicate)) return { hand: h, deck: d, graveyard: g, moved: false };
  let card = null;
  let at = d.findIndex(predicate);
  if (at >= 0) card = d.splice(at, 1)[0];
  else { at = g.findIndex(predicate); if (at >= 0) card = g.splice(at, 1)[0]; }
  if (!card) return { hand: h, deck: d, graveyard: g, moved: false };
  if (h.length >= handMax) { const out = h.pop(); if (out) d.push(out); }
  h.push(card);
  return { hand: h, deck: d, graveyard: g, moved: true };
};
// ---- ミーア(stage): カード枚数+1・ボルテージ ----
const tacticsExStageEntries = (state, units, now) => {
  const effects = normalizeTacticsExState(state).effects;
  return Object.keys(effects).map(Number).filter(slot => {
    const unit = Array.isArray(units) ? units[slot] : null;
    return unit && tacticsExActiveEffect(state, slot, unit.id, now) === 'stage';
  }).map(slot => ({ slot, mine: effects[slot] }));
};
// 1ターンに使えるカード枚数(盤面ぜんぶ)へ足す数
// ★パンドラの箱(selfCardBonus)も、盤面の枚数に足す(少人数のとき、パンドラ自身の+1が盤面の上限に止められないように)
const tacticsExCardBonusTotal = (state, units, now) => tacticsExStageEntries(state, units, now).reduce((sum, e) => sum + tacticsSafeInt(e.mine.cardBonus, 0), 0)
  + Object.keys(normalizeTacticsExState(state).effects).map(Number).reduce((sum, slot) => {
    const box = tacticsExPandoraBoxOf(state, units, slot, now);
    return sum + (box ? tacticsSafeInt(box.selfCardBonus, 0) : 0);
  }, 0);
// その子自身が1ターンに使えるカード枚数へ足す数(効果を使った子だけ)
const tacticsExCardBonusAt = (state, units, slot, now) => {
  const hit = tacticsExStageEntries(state, units, now).find(e => e.slot === slot);
  const box = tacticsExPandoraBoxOf(state, units, slot, now);
  return (hit ? tacticsSafeInt(hit.mine.cardBonus, 0) : 0) + (box ? tacticsSafeInt(box.selfCardBonus, 0) : 0);
};
// いまのボルテージと、その強化(効いていなければ null)。dmgMult/healMult は掛け算、gutsAdd はガッツ・hpAdd はライフの自動回復率へ足す
const tacticsExVoltageOf = (state, units, now) => {
  const hit = tacticsExStageEntries(state, units, now).find(e => e.mine.voltageCfg);
  if (!hit) return null;
  const cfg = hit.mine.voltageCfg, v = Math.min(tacticsSafeInt(cfg.max, 0), Math.max(0, tacticsSafeInt(hit.mine.voltage, 0)));
  return { voltage: v, max: tacticsSafeInt(cfg.max, 0), dmgMult: 1 + v * (Number(cfg.dmg) || 0), healMult: 1 + v * (Number(cfg.heal) || 0), gutsAdd: v * (Number(cfg.guts) || 0), hpAdd: v * (Number(cfg.hp) || 0) };
};
// 味方がカードを n 枚使ったぶん、ボルテージをためる(上限まで。効いていなければ状態をそのまま返す)
const addTacticsExVoltage = (state, units, now, n) => {
  const safe = normalizeTacticsExState(state);
  const add = Math.max(0, tacticsSafeInt(n, 0));
  const entries = tacticsExStageEntries(safe, units, now).filter(e => e.mine.voltageCfg);
  if (!entries.length || add <= 0) return safe;
  const effects = { ...safe.effects };
  entries.forEach(e => { effects[e.slot] = { ...e.mine, voltage: Math.min(tacticsSafeInt(e.mine.voltageCfg.max, 0), tacticsSafeInt(e.mine.voltage, 0) + add) }; });
  return { ...safe, effects };
};
// ---- スネグーラチカ(present): クリスマスプレゼント ----
const TACTICS_EX_PRESENT_KINDS = Object.freeze(['dmg', 'taken', 'combo', 'heal', 'guts', 'crit']);
const TACTICS_EX_PRESENT_LABELS = Object.freeze({ dmg: '与ダメージアップ', taken: '被ダメージダウン', combo: '連撃付与', heal: 'ライフ回復', guts: 'ガッツ追加回復', crit: '会心率アップ' });
// 中身を、数字つきの短い言い方にする(使った直後のカットイン・ログ・詳細に出す。cfg は def.present)
const tacticsExPresentKindText = (kind, cfg, turns = 3) => {
  const c = cfg || {}, pct = (v) => Math.round((Number(v) || 0) * 100);
  switch (kind) {
    case 'dmg': return `与ダメージ+${pct(c.dmg)}%（${turns}ターン）`;
    case 'taken': return `被ダメージ−${pct(c.taken)}%（${turns}ターン）`;
    case 'combo': return c.combo ? `連撃 与ダメ${pct(c.combo.rate)}%×${c.combo.count}回（${turns}ターン）` : '連撃付与';
    case 'heal': return `全員のライフが上限の${pct(c.heal)}%回復`;
    case 'guts': return `全員のガッツがさらに上限の${pct(c.guts)}%回復`;
    case 'crit': return `会心率×${(Number(c.crit) || 0) + 1}（${turns}ターン）`;
    default: return '';
  }
};
const tacticsExPresentNote = (roll, cfg, turns = 3) => {
  if (!roll || !Array.isArray(roll.kinds)) return '';
  const c = cfg || {};
  const head = `全員のガッツが上限の${Math.round((Number(c.fixedGuts) || 0) * 100)}%回復`;
  const body = roll.kinds.map(k => tacticsExPresentKindText(k, c, turns)).filter(Boolean).join('・');
  return `${head}＋${roll.jackpot ? '大当たり！ ' : ''}${body}`;
};
// 乱数(0以上1未満)から中身を決める。1回の抽選に乱数を2つ使う(大当たり判定・種類)。
// draws 回引き、同じ種類は出ない。大当たりが出たら6つ全部になり、残りの抽選は行わない
const rollTacticsExPresent = (rands, jackpot = 0.1, draws = 2) => {
  const list = Array.isArray(rands) ? rands : [];
  const left = TACTICS_EX_PRESENT_KINDS.slice(), kinds = [];
  for (let d = 0; d < Math.max(1, tacticsSafeInt(draws, 1)) && left.length; d++) {
    const rJ = Number(list[d * 2]), rP = Number(list[d * 2 + 1]);
    if (rJ < jackpot) return { jackpot: true, kinds: TACTICS_EX_PRESENT_KINDS.slice() };
    kinds.push(left.splice(Math.min(left.length - 1, Math.max(0, Math.floor((Number.isFinite(rP) ? rP : 0) * left.length))), 1)[0]);
  }
  return { jackpot: false, kinds };
};
// 決まった中身を、使った子の効果へ控える(持続のある4種(与ダメ・被ダメ・連撃・会心率)は効いているあいだ見る。回復・ガッツはその場で入れる)
const setTacticsExPresent = (state, slot, roll) => {
  const safe = normalizeTacticsExState(state);
  const mine = safe.effects[slot];
  if (!mine || !roll || !Array.isArray(roll.kinds)) return safe;
  return { ...safe, effects: { ...safe.effects, [slot]: { ...mine, present: { jackpot: roll.jackpot === true, kinds: roll.kinds.filter(k => TACTICS_EX_PRESENT_KINDS.includes(k)) } } } };
};
// いま効いているプレゼントの、味方全員への効き目(効いていなければ全部1・連撃は null)
const tacticsExPresentOf = (state, units, now) => {
  const out = { dmg: 1, taken: 1, critRate: 1, combo: null, kinds: [], jackpot: false };
  const effects = normalizeTacticsExState(state).effects;
  Object.keys(effects).map(Number).forEach(slot => {
    const unit = Array.isArray(units) ? units[slot] : null;
    const mine = effects[slot];
    if (!unit || tacticsExActiveEffect(state, slot, unit.id, now) !== 'present' || !mine.present || !mine.presentCfg) return;
    const cfg = mine.presentCfg, kinds = mine.present.kinds || [];
    out.kinds = kinds.slice(); out.jackpot = mine.present.jackpot === true;
    if (kinds.includes('dmg')) out.dmg *= 1 + (Number(cfg.dmg) || 0);
    if (kinds.includes('taken')) out.taken *= 1 - Math.min(0.9, Number(cfg.taken) || 0);
    if (kinds.includes('crit')) out.critRate *= 1 + (Number(cfg.crit) || 0);
    if (kinds.includes('combo') && cfg.combo && cfg.combo.count > 0 && cfg.combo.rate > 0) out.combo = { count: tacticsSafeInt(cfg.combo.count, 0), rate: Number(cfg.combo.rate), label: 'クリスマスプレゼント' };
  });
  return out;
};
// WAVEのはじめに、「各WAVEで回数が戻る」EX(スネグーラチカ)の回数を0へ戻す(変わらなければ同じ state を返す)
const resetTacticsExWaveUses = (state) => {
  const safe = normalizeTacticsExState(state);
  const uses = { ...safe.uses };
  let changed = false;
  Object.keys(uses).forEach(key => {
    const rec = uses[key];
    const def = rec && TACTICS_EX_SKILLS[rec.monId];
    if (def && def.usesPerWave && tacticsSafeInt(rec.count, 0) > 0) { uses[key] = { ...rec, count: 0 }; changed = true; }
  });
  return changed ? { ...safe, uses } : state;
};
// ---- ウンディーネ(lifeSpring): 根性・与ダメアップ・アクアフィールド ----
// 使った直後に、選んだ子の状態(ダウンから立ち上がったか)を泉の効果へ控える。立ち上がった子には根性、立っていた子には与ダメアップ
const setTacticsExSpringKind = (state, casterSlot, wasDown) => {
  const safe = normalizeTacticsExState(state), mine = safe.effects[casterSlot];
  if (!mine || !mine.lifeSpringCfg) return safe;
  return { ...safe, effects: { ...safe.effects, [casterSlot]: { ...mine, springDown: wasDown === true, konjoLeft: wasDown === true ? tacticsSafeInt(mine.lifeSpringCfg.konjo, 0) : 0 } } };
};
// いま効いている泉(ウンディーネの枠)のうち、slot の子を対象にしているもの
const tacticsExSpringEntries = (state, units, now) => {
  const effects = normalizeTacticsExState(state).effects;
  return Object.keys(effects).map(Number).filter(from => {
    const caster = Array.isArray(units) ? units[from] : null;
    return caster && effects[from] && effects[from].lifeSpringCfg && tacticsExActiveEffect(state, from, caster.id, now) === 'lifeSpring';
  }).map(from => ({ from, mine: effects[from] }));
};
// 泉の対象になっている子(立っていたとき)の与ダメ倍率。効いていなければ 1
const tacticsExSpringDmgMult = (state, units, slot, now) => tacticsExSpringEntries(state, units, now)
  .filter(e => e.mine.target === slot && !e.mine.springDown)
  .reduce((mult, e) => mult * (1 + Math.max(0, Number(e.mine.lifeSpringCfg.dmgUp) || 0)), 1);
// 根性が残っている回数(slot の子)。0 なら踏ん張れない
const tacticsExKonjoLeftOf = (state, units, slot, now) => tacticsExSpringEntries(state, units, now)
  .filter(e => e.mine.target === slot).reduce((sum, e) => sum + Math.max(0, tacticsSafeInt(e.mine.konjoLeft, 0)), 0);
// 根性を1回使う(残っていなければ同じ state)
const spendTacticsExKonjo = (state, units, slot, now) => {
  const hit = tacticsExSpringEntries(state, units, now).find(e => e.mine.target === slot && tacticsSafeInt(e.mine.konjoLeft, 0) > 0);
  if (!hit) return state;
  const safe = normalizeTacticsExState(state);
  return { ...safe, effects: { ...safe.effects, [hit.from]: { ...hit.mine, konjoLeft: tacticsSafeInt(hit.mine.konjoLeft, 0) - 1 } } };
};
// アクアフィールドに参加できるモンスター(ウンディーネ種)
const TACTICS_EX_AQUA_SPECIES = Object.freeze(['Undine', 'Yaobikuni', 'Snegurochka']);
// アクアフィールドのいま。効いていなければ active:false・倍率は変えない。route は 'prison'(水牢)・'freeze'(氷結)・null
const tacticsExAquaOf = (state, units, now) => {
  const out = { active: false, slot: null, route: null, stacks: 0, needed: 0, enemyDmgMult: 1, enemyTakenBonus: 0, finale: false, turnsLeft: 0 };
  const hit = tacticsExSpringEntries(state, units, now).find(e => e.mine.aquaCfg && e.mine.aqua);
  if (!hit) return out;
  const cfg = hit.mine.aquaCfg, a = hit.mine.aqua;
  const stacks = Math.max(0, tacticsSafeInt(a.stacks, 0));
  const fin = a.finale && Number.isFinite(Number(a.finale.wave)) && Number.isFinite(Number(a.finale.turn)) ? a.finale : null;
  const finaleOn = !!fin && tacticsSafeInt(fin.wave, -1) === tacticsSafeInt(now && now.wave, -2)
    && tacticsSafeInt(now && now.turn, 0) - tacticsSafeInt(fin.turn, 0) >= 0 && tacticsSafeInt(now && now.turn, 0) - tacticsSafeInt(fin.turn, 0) < tacticsSafeInt(cfg.finaleTurns, 1);
  return { active: true, slot: hit.from, route: a.route === 'prison' || a.route === 'freeze' ? a.route : null, stacks, needed: tacticsSafeInt(cfg.needed, 3),
    enemyDmgMult: a.route === 'prison' ? 1 - Math.min(0.9, stacks * (Number(cfg.dmgPerStack) || 0)) : 1,
    enemyTakenBonus: (a.route === 'freeze' ? stacks * (Number(cfg.takenPerStack) || 0) : 0) + (finaleOn ? Number(cfg.finaleTaken) || 0 : 0),
    finale: finaleOn, turnsLeft: tacticsExTurnsLeft(state, hit.from, units[hit.from].id, now) };
};
// ウンディーネ種が攻撃カードを使ったとき、アクアフィールドへ1つ積む。kind は 'normal'(通常技)か 'unique'(固有技)。
// 返り値 { state, event }: event は 'stack'(積んだ)・'finale'(3つたまって使い切った)・null(積めない: フィールド無し・種が違う・道が違う)
const addTacticsExAquaStack = (state, units, now, slot, kind) => {
  const unit = Array.isArray(units) ? units[slot] : null;
  const none = { state, event: null };
  if (!unit || !TACTICS_EX_AQUA_SPECIES.includes(unit.id) || (kind !== 'normal' && kind !== 'unique')) return none;
  const hit = tacticsExSpringEntries(state, units, now).find(e => e.mine.aquaCfg && e.mine.aqua);
  if (!hit) return none;
  const route = kind === 'normal' ? 'prison' : 'freeze';
  const cur = hit.mine.aqua.route === 'prison' || hit.mine.aqua.route === 'freeze' ? hit.mine.aqua.route : null;
  if (cur && cur !== route) return none;
  const stacks = Math.max(0, tacticsSafeInt(hit.mine.aqua.stacks, 0)) + 1;
  const done = stacks >= tacticsSafeInt(hit.mine.aquaCfg.needed, 3);
  const aqua = { route, stacks: done ? 0 : stacks, finale: done ? { wave: tacticsSafeInt(now && now.wave, 0), turn: tacticsSafeInt(now && now.turn, 0) } : hit.mine.aqua.finale };
  const safe = normalizeTacticsExState(state);
  return { state: { ...safe, effects: { ...safe.effects, [hit.from]: { ...hit.mine, aqua } } }, event: done ? 'finale' : 'stack', route, stacks: aqua.stacks };
};
// ---- 味方を選んで使うEX(生命の泉) ----
// 選べる味方の一覧(立っている子もダウン中の子も。自分も含む)。選ぶEXでなければ null
const tacticsExTargetOptions = (def, units) => (def && def.target === 'ally'
  ? (Array.isArray(units) ? units : []).map((unit, slot) => ({ unit: normalizeTacticsUnit(unit), slot })).filter(e => e.unit)
    .map(e => ({ slot: e.slot, hp: e.unit.hp, maxHp: e.unit.maxHp, downed: e.unit.downed === true })) : null);
// 選んだ味方が使えるか。使えれば null、使えなければ理由
const checkTacticsExTarget = (def, units, target) => {
  if (!def || def.target !== 'ally') return null;
  if (!Number.isInteger(target)) return 'どの味方に使うか選ぶ';
  return Array.isArray(units) && units[target] ? null : 'そこには味方がいない';
};
// ---- パンドラ(pandoraBox): パンドラの箱 ----
// その枠で「パンドラの箱」が効いているときの数字(効いていなければ null)
const tacticsExPandoraBoxOf = (state, units, slot, now) => {
  const unit = Array.isArray(units) ? units[slot] : null;
  if (!unit || tacticsExActiveEffect(state, slot, unit.id, now) !== 'pandoraBox') return null;
  const cfg = normalizeTacticsExState(state).effects[slot].pandoraBoxCfg;
  return cfg && typeof cfg === 'object' ? cfg : null;
};
// 1枚目(「同じ子の2枚目」ではないほう)の悪魔側の力。与ダメ倍率と連撃。2枚目以降・効いていなければ null
const tacticsExPandoraDevil = (state, units, slot, now, halved = false) => {
  const cfg = halved ? null : tacticsExPandoraBoxOf(state, units, slot, now);
  if (!cfg) return null;
  const c = cfg.devilCombo;
  return { dmg: Math.max(1, Number(cfg.devilDmg) || 1), combo: c && c.count > 0 && c.rate > 0 ? { count: tacticsSafeInt(c.count, 0), rate: Number(c.rate), label: '悪魔の力' } : null };
};
// ターンの終わりに、パンドラの箱がどうなるか。cost=ライフを払う / hope=最後の希望(最後のターン) / died=倒れていた(ガッツを分ける)。
// 箱が効いていなければ null。slot=パンドラの枠、cfg=数字
const tacticsExPandoraTurnEnd = (state, units, now) => {
  const effects = normalizeTacticsExState(state).effects;
  const slot = Object.keys(effects).map(Number).find(s => {
    const unit = Array.isArray(units) ? units[s] : null;
    return unit && tacticsExActiveEffect(state, s, unit.id, now) === 'pandoraBox';
  });
  if (slot == null) return null;
  const mine = effects[slot], unit = normalizeTacticsUnit(units[slot]);
  if (!unit || !mine.pandoraBoxCfg) return null;
  const last = tacticsSafeInt(mine.turn, 0) + tacticsSafeInt(mine.turns, 0) - 1;
  return { slot, cfg: mine.pandoraBoxCfg, phase: unit.downed ? 'died' : (tacticsSafeInt(now && now.turn, 0) >= last ? 'hope' : 'cost') };
};
// 箱の始末(最後の希望・倒れた)が済んだことにする。これ以降は何も起きない(同じターンの数字が続いても)。効いていなければ同じ state
const spendTacticsExPandoraBox = (state) => {
  const safe = normalizeTacticsExState(state);
  const keys = Object.keys(safe.effects).filter(k => safe.effects[k] && safe.effects[k].effect === 'pandoraBox');
  if (!keys.length) return state;
  const effects = { ...safe.effects };
  keys.forEach(k => { effects[k] = { ...effects[k], effect: 'pandoraBoxSpent' }; });
  return { ...safe, effects };
};
// ---- ヤオビクニ(timeStop): 使ったターンは敵が行動せず、ターン数も進まない ----
// いま時間が止まっている枠(まだ敵の番を止めていないもの)。なければ null
const tacticsExTimeStopSlot = (state, units, now) => {
  const effects = normalizeTacticsExState(state).effects;
  const hit = Object.keys(effects).map(Number).find(slot => {
    const unit = Array.isArray(units) ? units[slot] : null;
    return unit && tacticsExActiveEffect(state, slot, unit.id, now) === 'timeStop';
  });
  return hit == null ? null : hit;
};
// 敵の番を止めたあと、時間停止を「使い終わった」ことにする(同じターンの数字が続いても、止め続けない)。止まっていなければ同じ state を返す
// 悠久の刻を使った瞬間に、ほかの味方にかかっている「能力強化系」のバフを集める(ヤオビクニ自身はそのターンだけ受ける)。
// 味方が何人も強化されているときは、種類ごとにいちばん強いものを1つ取る(足し算にはしない)。
// コピーしないもの: 完全回避・連撃付与・カード枚数・形態変化・フィールド効果(全体バフは元から全員に効いている)
const tacticsExCopyableBuffs = (state, units, now, exceptSlot) => {
  const out = { dmg: 1, taken: 1, critRate: 1, critAdd: 0, critDmg: 1, atk: 0, def: 0, regenHp: 0, regenGuts: 0 };
  const effects = normalizeTacticsExState(state).effects;
  Object.keys(effects).map(Number).forEach(slot => {
    if (slot === exceptSlot || !Array.isArray(units) || !units[slot]) return;
    const kind = tacticsExActiveEffect(state, slot, units[slot].id, now);
    if (!kind) return;
    const mb = tacticsExMultiBuffOf(state, units, slot, now);
    if (mb) {
      out.dmg = Math.max(out.dmg, mb.dmg); out.taken = Math.min(out.taken, mb.taken); out.critRate = Math.max(out.critRate, mb.critRate);
      out.critAdd = Math.max(out.critAdd, mb.critAdd); out.critDmg = Math.max(out.critDmg, mb.critDmg);
    }
    if (kind === 'statBoost' || kind === 'multiBuff') {
      const e = effects[slot];
      const rateOf = (key) => { const own = Number(e.rates && e.rates[key]); return Math.max(0, Number.isFinite(own) ? own : (Number(e.statRate) || 0)); };
      out.atk = Math.max(out.atk, rateOf('atk')); out.def = Math.max(out.def, rateOf('def'));
    }
    out.regenHp = Math.max(out.regenHp, tacticsExRegenRateAt(state, units, slot, now, 'hp'));
    out.regenGuts = Math.max(out.regenGuts, tacticsExRegenRateAt(state, units, slot, now, 'guts'));
  });
  return out;
};
const spendTacticsExTimeStop = (state) => {
  const safe = normalizeTacticsExState(state);
  const keys = Object.keys(safe.effects).filter(k => safe.effects[k] && safe.effects[k].effect === 'timeStop');
  if (!keys.length) return state;
  const effects = { ...safe.effects };
  keys.forEach(k => { effects[k] = { ...effects[k], effect: 'timeStopSpent' }; });
  return { ...safe, effects };
};
// 血踊が効いている子が敵の攻撃を回避したことを数える(効いていなければ状態をそのまま返す)
const recordTacticsExDodge = (state, units, slot, now) => {
  const safe = normalizeTacticsExState(state);
  const unit = Array.isArray(units) ? units[slot] : null;
  if (!unit || tacticsExActiveEffect(safe, slot, unit.id, now) !== 'dodgeCombo') return safe;
  const mine = safe.effects[slot];
  return { ...safe, effects: { ...safe.effects, [slot]: { ...mine, dodges: tacticsSafeInt(mine.dodges, 0) + 1 } } };
};
// ---- ゴースト(avoidCharge): オフリィアボイド ----
// その子に残っている完全回避の数(効いていなければ0)
const tacticsExAvoidLeftOf = (state, units, slot, now) => {
  const unit = Array.isArray(units) ? units[slot] : null;
  if (!unit || tacticsExActiveEffect(state, slot, unit.id, now) !== 'avoidCharge') return 0;
  return Math.max(0, tacticsSafeInt(normalizeTacticsExState(state).effects[slot].avoidLeft, 0));
};
// 完全回避を1つ使う(狙われた攻撃1回ぶん。連撃でも1つ)。残っていなければ状態をそのまま返す
const spendTacticsExAvoid = (state, units, slot, now) => {
  const safe = normalizeTacticsExState(state);
  if (tacticsExAvoidLeftOf(safe, units, slot, now) <= 0) return safe;
  const mine = safe.effects[slot];
  return { ...safe, effects: { ...safe.effects, [slot]: { ...mine, avoidLeft: Math.max(0, tacticsSafeInt(mine.avoidLeft, 0) - 1) } } };
};
// その子の攻撃の会心が確定するか(完全回避が残っているあいだ)
const tacticsExCritFixedAt = (state, units, slot, now) => tacticsExAvoidLeftOf(state, units, slot, now) > 0;
// 味方全員のちから・丈夫さへ上乗せする倍率。効いている子が複数いれば足し算(使った子が倒れても残る)。効いていなければ 0
//   緑のめぐみ(partyBoost・プラント) … partyBoostCfg.statRate
//   トリックコンフューズ(trickConfuse・スプーキー。2026-10-05) … partyStatRate
const tacticsExPartyStatRate = (state, now) => {
  const effects = normalizeTacticsExState(state).effects;
  return Object.keys(effects).reduce((sum, key) => {
    const e = effects[key];
    if (!e || (e.effect !== 'partyBoost' && e.effect !== 'trickConfuse') || !isTacticsExEffectActive(state, key, e.monId, now)) return sum;
    const rate = Number(e.effect === 'partyBoost' ? (e.partyBoostCfg && e.partyBoostCfg.statRate) : e.partyStatRate);
    return Number.isFinite(rate) && rate > 0 ? sum + rate : sum;
  }, 0);
};
// ---- ハム(counter): ハムボクシング ----
// いまのカウンターの数(効いていなければ null)。mult は「カウンター1つあたりの与ダメ倍率」(2 なら 1つで×2・2つで×4)
const tacticsExCounterOf = (state, units, slot, now) => {
  const unit = Array.isArray(units) ? units[slot] : null;
  if (!unit || tacticsExActiveEffect(state, slot, unit.id, now) !== 'counter') return null;
  const mine = normalizeTacticsExState(state).effects[slot], cfg = mine.counterCfg;
  if (!cfg) return null;
  const mult = Number(cfg.mult);
  return { slot, counter: Math.min(99, Math.max(0, tacticsSafeInt(mine.counter, 0))), mult: Number.isFinite(mult) && mult > 0 ? mult : 0 };
};
// クロスカウンターが発動した子のカウンターを n 増やす(効いていなければ状態をそのまま返す)
const addTacticsExCounter = (state, units, now, slot, n) => {
  const safe = normalizeTacticsExState(state);
  const c = tacticsExCounterOf(safe, units, slot, now);
  const add = Math.max(0, tacticsSafeInt(n, 0));
  if (!c || add <= 0) return safe;
  return { ...safe, effects: { ...safe.effects, [slot]: { ...safe.effects[slot], counter: Math.min(99, c.counter + add) } } };
};
// クロスカウンターが発動したときの、ハムの与ダメ倍率(2 × カウンターの数。カウンター1なら×2・2なら×4・3なら×6)。効いていなければ 1
const tacticsExCounterMult = (state, units, slot, now) => {
  const c = tacticsExCounterOf(state, units, slot, now);
  return c && c.counter > 0 && c.mult > 0 ? c.mult * c.counter : 1;
};
// ---- メロディー(cookieBox): おねがい♪メロディボックス ----
// 効いているあいだの味方全員の与ダメ・被ダメの倍率(使ったクッキーの数ぶん)。効いていなければ両方1。
// ★使った子が倒れても効果は残る(振る舞ったクッキーはもう配ってある)。WAVEが変わると切れる
const tacticsExCookieBoxOf = (state, units, now) => {
  const effects = normalizeTacticsExState(state).effects;
  return Object.keys(effects).reduce((acc, key) => {
    const slot = Number(key), unit = Array.isArray(units) ? units[slot] : null, e = effects[key];
    if (!unit || !e || !e.stackSpendCfg || tacticsExActiveEffect(state, slot, unit.id, now) !== 'cookieBox') return acc;
    const spent = tacticsSafeInt(e.spent, 0), cfg = e.stackSpendCfg;
    return { dmgMult: acc.dmgMult * (1 + (Number(cfg.dmg) || 0) * spent), takenMult: acc.takenMult * (1 - Math.min(0.9, (Number(cfg.taken) || 0) * spent)) };
  }, { dmgMult: 1, takenMult: 1 });
};
// ---- クロミー(nightmareKey): 悪夢全開！メロディ・キー ----
// その子の強化(使った黒音符の数ぶん)。効いていなければ null。
// { spent, dmgMult, critAdd(足し算), enemyTaken(敵の被ダメへ足す), combo(満タンで使ったときだけ), turnsLeft }
const tacticsExNightmareOf = (state, units, slot, now) => {
  const unit = Array.isArray(units) ? units[slot] : null;
  if (!unit || tacticsExActiveEffect(state, slot, unit.id, now) !== 'nightmareKey') return null;
  const e = normalizeTacticsExState(state).effects[slot], cfg = e.stackSpendCfg;
  if (!cfg) return null;
  const spent = tacticsSafeInt(e.spent, 0);
  return { spent, dmgMult: 1 + (Number(cfg.dmg) || 0) * spent, critAdd: (Number(cfg.crit) || 0) * spent, enemyTaken: (Number(cfg.enemyTaken) || 0) * spent,
    combo: spent >= cfg.full && cfg.fullCombo ? { count: cfg.fullCombo.count, rate: cfg.fullCombo.rate, label: '悪夢全開' } : null,
    turnsLeft: Math.max(0, tacticsSafeInt(e.turn, 0) + tacticsSafeInt(e.turns, 0) - tacticsSafeInt(now && now.turn, 0)) };
};
// 盤面のだれかの「悪夢全開」で、敵の被ダメージへ足す割合(いちばん大きいもの)と残りターン。効いていなければ0
const tacticsExNightmareEnemyOf = (state, units, now) => (Array.isArray(units) ? units : []).reduce((acc, unit, slot) => {
  const k = unit ? tacticsExNightmareOf(state, units, slot, now) : null;
  return k && k.enemyTaken > acc.enemyTaken ? { enemyTaken: k.enemyTaken, turnsLeft: k.turnsLeft } : acc;
}, { enemyTaken: 0, turnsLeft: 0 });
// 使った直後に出す文(カットインの下の行・ログ)
const tacticsExStackSpendNote = (def, spent) => {
  const cfg = def && def.stackSpend;
  if (!cfg) return '';
  const pct = (v) => Math.round(v * 100);
  const full = spent >= cfg.full;
  if (def.effect === 'cookieBox') {
    const turns = full && cfg.fullTurns > 0 ? cfg.fullTurns : def.turns;
    return `クッキー${spent}個を配った・全員ライフ+${pct(cfg.heal * spent)}% ガッツ+${pct(cfg.guts * spent)}%・${turns}ターン与ダメ+${pct(cfg.dmg * spent)}% 被ダメ−${pct(cfg.taken * spent)}%`;
  }
  return `黒音符${spent}個で全開・${def.turns}ターン与ダメ+${pct(cfg.dmg * spent)}% 会心率+${pct(cfg.crit * spent)}% 敵の被ダメ+${pct(cfg.enemyTaken * spent)}%`
    + (full && cfg.fullCombo ? `・連撃${pct(cfg.fullCombo.rate)}%×${cfg.fullCombo.count}` : '');
};
// サイコロックオン(psychoLock)が効いているか。効いているあいだ、敵は距離を動かせず(移動を選んでも何もしない)、
// 敵の与ダメージが enemyDmgDown 下がり、敵の被ダメージが enemyTakenUp 上がる。効いていなければ active:false・倍率は変えない
const tacticsExPsychoLockOf = (state, now) => {
  const effects = normalizeTacticsExState(state).effects;
  return Object.keys(effects).reduce((acc, key) => {
    const e = effects[key];
    if (!e || e.effect !== 'psychoLock' || !isTacticsExEffectActive(state, key, e.monId, now)) return acc;
    const down = Number(e.psychoLockCfg && e.psychoLockCfg.enemyDmgDown), up = Number(e.psychoLockCfg && e.psychoLockCfg.enemyTakenUp);
    // 残りターン(画面の「敵の状態」に出す)。ターン数で切れるものだけ。いまのターンを含めて数える
    const left = e.duration === 'turns' && now ? Math.max(0, tacticsSafeInt(e.turn, 0) + tacticsSafeInt(e.turns, 0) - tacticsSafeInt(now.turn, 0)) : 0;
    return { active: true, enemyDmgMult: Math.min(acc.enemyDmgMult, 1 - (Number.isFinite(down) && down > 0 ? Math.min(0.9, down) : 0)),
      enemyTakenBonus: Math.max(acc.enemyTakenBonus, Number.isFinite(up) && up > 0 ? up : 0), turnsLeft: Math.max(acc.turnsLeft || 0, left) };
  }, { active: false, enemyDmgMult: 1, enemyTakenBonus: 0, turnsLeft: 0 });
};
// おぼろ返し(damageBack)が効いているとき、味方が敵の攻撃で受けたダメージのうち、ライフ・ガッツへ回復する割合。効いていなければ 0
const tacticsExDamageBackRates = (state, now) => {
  const effects = normalizeTacticsExState(state).effects;
  return Object.keys(effects).reduce((acc, key) => {
    const e = effects[key];
    if (!e || e.effect !== 'damageBack' || !isTacticsExEffectActive(state, key, e.monId, now)) return acc;
    const hp = Number(e.damageBackCfg && e.damageBackCfg.hpRate), guts = Number(e.damageBackCfg && e.damageBackCfg.gutsRate);
    return { hp: acc.hp + (Number.isFinite(hp) && hp > 0 ? hp : 0), guts: acc.guts + (Number.isFinite(guts) && guts > 0 ? guts : 0) };
  }, { hp: 0, guts: 0 });
};
// 緑のめぐみのターン終わりの自動回復(味方全員へ足す率)。kind … 'hp' か 'guts'
const tacticsExPartyBoostRegenRate = (state, now, kind = 'hp') => {
  const effects = normalizeTacticsExState(state).effects;
  return Object.keys(effects).reduce((sum, key) => {
    const e = effects[key];
    if (!e || e.effect !== 'partyBoost' || !isTacticsExEffectActive(state, key, e.monId, now)) return sum;
    const rate = Number(e.partyBoostCfg && (kind === 'guts' ? e.partyBoostCfg.gutsRegen : e.partyBoostCfg.hpRegen));
    return Number.isFinite(rate) && rate > 0 ? sum + rate : sum;
  }, 0);
};
// その子の攻撃が当たったら敵を乱心にするか(トリックコンフューズが効いている本人だけ。2026-10-05 ユーザー指示「スプーキーの攻撃だけ」)
const tacticsExConfusesOnHit = (state, units, slot, now) => {
  const unit = Array.isArray(units) ? units[slot] : null;
  return !!unit && tacticsExActiveEffect(state, slot, unit.id, now) === 'trickConfuse';
};
// 乱心: 敵の行動が50%で「意味不明」になる。ターン数は乱心のまま決めた予告の数(3つ)。
// 意味不明のターン、敵は動けず、味方の攻撃は会心が確定する(被会心率+100%)
const ENEMY_CONFUSE_TURNS = 3;
const ENEMY_CONFUSE_CHANCE = 0.5;
// 予告を「意味不明」へ差し替えたもの。狙い(targetSlot)は持たせない(だれも狙われない)
const confusedEnemyIntent = (intent) => ({ type: 'CONFUSED', label: '意味不明', icon: '❓', value: 0, notice: '乱心',
  confusedFrom: intent && typeof intent.label === 'string' ? intent.label : null });
// 次の予告を決めるときの乱心。turns が残っていれば1つ使い、rnd() が確率未満なら意味不明にする
const rollEnemyConfusion = (intent, turns, rnd = Math.random) => {
  const left = Math.max(0, tacticsSafeInt(turns, 0));
  if (!intent || left <= 0) return { intent, turns: left };
  return { intent: rnd() < ENEMY_CONFUSE_CHANCE ? confusedEnemyIntent(intent) : intent, turns: left - 1 };
};
// 味方全員のちから・丈夫さ(緑のめぐみ・トリックコンフューズ)は、その子自身のEXで変わったあとの値へ掛ける
const applyTacticsExStats = (unit, state, slot, now) => {
  const own = applyTacticsExOwnStats(unit, state, slot, now);
  const party = unit && typeof unit === 'object' ? tacticsExPartyStatRate(state, now) : 0;
  return party > 0 ? { ...own, atk: Math.floor(Math.max(0, tacticsSafeInt(own.atk, 0)) * (1 + party)), def: Math.floor(Math.max(0, tacticsSafeInt(own.def, 0)) * (1 + party)) } : own;
};
const applyTacticsExOwnStats = (unit, state, slot, now) => {
  if (!unit || typeof unit !== 'object') return unit;
  const kind = tacticsExActiveEffect(state, slot, unit.id, now);
  if (kind === 'allIn') {
    const snap = normalizeTacticsExState(state).effects[slot].snapshot;
    const usedDef = Math.max(0, tacticsSafeInt(snap && snap.def, tacticsSafeInt(unit.def, 0)));
    return { ...unit, atk: Math.max(0, tacticsSafeInt(unit.atk, 0)) + Math.floor(usedDef * TACTICS_EX_ALL_IN_ATK_RATE), def: 0 };
  }
  // ステータスアップ(ガッツ全開っちー・ドラゴンだっちー): 力と丈夫さを上げる(切り捨て)。
  // 上げ幅は rates の項目、無ければ statRate(力・丈夫さ共通)
  if (kind === 'statBoost' || kind === 'multiBuff') {
    const effect = normalizeTacticsExState(state).effects[slot];
    const rateOf = (key) => {
      const own = Number(effect.rates && effect.rates[key]);
      return Math.max(0, Number.isFinite(own) ? own : (Number(effect.statRate) || 0));
    };
    return { ...unit, atk: Math.floor(Math.max(0, tacticsSafeInt(unit.atk, 0)) * (1 + rateOf('atk'))),
      def: Math.floor(Math.max(0, tacticsSafeInt(unit.def, 0)) * (1 + rateOf('def'))) };
  }
  // 悠久の刻(timeStop): コピーした味方の力・丈夫さの強化を、そのターンだけ受ける
  if (kind === 'timeStop') {
    const cp = normalizeTacticsExState(state).effects[slot].snapshot, c = cp && cp.copied;
    if (!c) return unit;
    return { ...unit, atk: Math.floor(Math.max(0, tacticsSafeInt(unit.atk, 0)) * (1 + (Number(c.atk) || 0))),
      def: Math.floor(Math.max(0, tacticsSafeInt(unit.def, 0)) * (1 + (Number(c.def) || 0))) };
  }
  // ★スタイルの効き目は、いつも「元のステータス」(盤面の値)から数え直す。積み重ならない
  if (kind === 'weaponChange') {
    const style = normalizeTacticsExState(state).effects[slot].style;
    const atk = Math.max(0, tacticsSafeInt(unit.atk, 0));
    const def = Math.max(0, tacticsSafeInt(unit.def, 0));
    if (style === 'shield') return { ...unit, def: def + atk };
    if (style === 'dual') return { ...unit, def: Math.floor(def / 2) };
  }
  return unit;
};
// ライフ・ガッツの上限を上げるEX(ガッツ全開っちー)の、上げ下げ。
// ★上限そのものは盤面の値なので、効いているあいだは unit.exMaxRate に割合を持たせ、
//   scaleTacticsUnits(みゅあ補正と同じ作り直し)で上限へ掛ける。切れたら0へ戻して作り直す
//   (ライフ・ガッツは normalizeTacticsUnit が新しい上限で丸める)
//   gutsRate … ガッツの上限だけ別の率にするとき(ドラゴンだっちー)。省くとライフと同じ率
const setTacticsExMaxRate = (units, slot, rate, gutsRate = rate) => (Array.isArray(units) ? units : [])
  .map((unit, i) => (unit && i === slot
    ? { ...unit, exMaxRate: Math.max(0, Number(rate) || 0), exMaxGutsRate: Math.max(0, Number(gutsRate) || 0) } : unit));
// ライフの上限だけを rate 上げる(すでに上がっていれば大きいほうを残す。ガッツの上限は触らない)
const setTacticsExMaxHpRate = (units, slot, rate) => (Array.isArray(units) ? units : [])
  .map((unit, i) => (unit && i === slot
    // ★ガッツの上限の率は、いまの値のまま明示する(書かないと、ライフの率がガッツの上限にまで効いてしまう)
    ? { ...unit, exMaxGutsRate: tacticsExMaxRateOf(unit, 'guts'), exMaxRate: Math.max(tacticsExMaxRateOf(unit), Math.max(0, Number(rate) || 0)) } : unit));
// 効果が切れているのに上限が上がったままの枠を、0へ戻す。戻した枠があれば changed:true
const expireTacticsExMaxRates = (units, state, now) => {
  let changed = false;
  // ★生命の泉(lifeSpring)は、使った子ではなく選んだ味方のライフ上限を上げる。その子は泉が効いているあいだ戻さない
  const springEffects = normalizeTacticsExState(state).effects;
  const springTargets = new Set(Object.keys(springEffects).map(Number).filter(from => {
    const caster = Array.isArray(units) ? units[from] : null;
    return caster && tacticsExActiveEffect(state, from, caster.id, now) === 'lifeSpring' && Number.isInteger(springEffects[from].target);
  }).map(from => springEffects[from].target));
  const next = (Array.isArray(units) ? units : []).map((unit, slot) => {
    if (!unit || !(tacticsExMaxRateOf(unit) > 0 || tacticsExMaxRateOf(unit, 'guts') > 0)) return unit;
    if (tacticsExActiveEffect(state, slot, unit.id, now) === 'statBoost') return unit;
    if (springTargets.has(slot)) return unit; // 生命の泉の対象(効いているあいだ)
    changed = true;
    return { ...unit, exMaxRate: 0, exMaxGutsRate: 0 };
  });
  return { units: next, changed };
};
// ターン数で切れる効果の、あと何ターン残っているか(使ったターンを含めて数える)。効いていなければ 0
const tacticsExTurnsLeft = (state, slot, monId, now) => {
  const effect = normalizeTacticsExState(state).effects[slot];
  if (!effect || effect.duration !== 'turns' || !isTacticsExEffectActive(state, slot, monId, now)) return 0;
  return tacticsSafeInt(effect.turn, 0) + tacticsSafeInt(effect.turns, 0) - tacticsSafeInt(now.turn, 0);
};
// 効いているEXの「残り」(画面に出す言い方)。効いていなければ null
//   turns … ターン数で切れるもの。残りは「このターンを含めて」数える(使ったターンは def.turns、次のターンは def.turns-1 …)
//   wave / turn / style … ターン数ではないので、いつまで続くかを言葉で出す
const tacticsExRemainOf = (def, state, slot, monId, now) => {
  if (!def || !isTacticsExEffectActive(state, slot, monId, now)) return null;
  if (def.duration === 'turns') {
    const left = tacticsExTurnsLeft(state, slot, monId, now);
    return { kind: 'turns', turns: left, text: `あと${left}ターン（このターンを含む）`, short: `あと${left}ターン` };
  }
  if (def.duration === 'wave') return { kind: 'wave', turns: null, text: 'このWAVEが終わるまで', short: 'WAVE中' };
  if (def.duration === 'style') return { kind: 'style', turns: null, text: '切り替えるまでずっと', short: '' };
  return { kind: 'turn', turns: 0, text: 'このターンだけ', short: 'このターン' };
};
// いま効いているスタイル(既定のスタイルのときは null)。戦闘の計算側がヒット列やソードスキルの有無に使う
const tacticsExActiveStyle = (state, slot, monId, now) => {
  if (!tacticsExActiveEffect(state, slot, monId, now)) return null;
  const style = normalizeTacticsExState(state).effects[slot].style;
  return typeof style === 'string' ? style : null;
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
