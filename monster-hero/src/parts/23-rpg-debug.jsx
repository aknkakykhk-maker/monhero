// ==================== ダンジョンRPG戦闘テスト(デバッグ専用) ====================
// 将来つくる「独立型ダンジョンRPG／ハクスラ」の戦闘そのものが面白いか、
// ステータスの数値感が妥当かを実機で確かめるための試作。まだ正式コンテンツではない。
//
// ★このブロックの決めごと
//   ・入口はデバッグ設定(DEBUG_SETTINGS)だけ。通常のHOME・バトル・マスモン管理へは出さない
//   ・保存・報酬・ランキング・ミッション・絆経験値へ一切触れない(メモリ上だけの状態)
//   ・使うのはベースモン(ALL_PLAYER_MONSTERS)だけ。マスモン(個体)は使わない
//   ・通常バトルの計算式には触れない。RPGの式はここに閉じている
//
// 数値はすべてこの定数群が正本で、画面側で式を書き直さないこと。
const RPG_MAX_LEVEL = 50;              // デバッグで指定できるLvの上限(味方・敵とも)
const RPG_MAX_PARTY = 4;               // 味方の最大人数。6体編成は今回作らない
const RPG_MAX_ENEMIES = 4;             // 敵の最大数
const RPG_STAT_DIVISOR = 10;           // 現在のベース能力 → RPGのLv1能力(約1/10)
const RPG_POINTS_PER_LEVEL = 1;        // Lvが1上がるごとにもらえる配分ポイント(暫定)
// 配分ポイント1点ぶんの上昇量(暫定)。ライフだけ伸びが大きい
const RPG_GAIN_PER_POINT = Object.freeze({ hp:6, atk:2, def:2, guts:2, speed:2, luck:2 });
const RPG_STAT_KEYS = Object.freeze(['hp','atk','def','guts','speed','luck']);
const RPG_STAT_LABELS = Object.freeze({ hp:'ライフ', atk:'ちから', def:'丈夫さ', guts:'ガッツ', speed:'素早さ', luck:'運' });
// 素早さ・運は本編(ALL_PLAYER_MONSTERS)にまだ正式な基礎能力が無い。
// 本編データへ baseSpeed / baseLuck を足して通常ゲームへ影響させたくないので、
// この試作の中だけで「全モンスター共通で10から」と決め打ちする。
// 実機で触ってからモンスターごとの値を決める予定。
const RPG_BASE_SPEED = 10;
const RPG_BASE_LUCK = 10;
const RPG_NORMAL_ATTACK_MULT = 1.0;    // 「こうげき」の技倍率
const RPG_DEF_COEFF = 4;               // ダメージ式で丈夫さに掛ける係数
const RPG_GUARD_MULT = 0.5;            // 「防御」を選んだターンの被ダメージ倍率
const RPG_START_GUTS_RATE = 0.5;       // 戦闘開始時のガッツ(最大値に対する割合)
const RPG_TURN_GUTS_RATE = 0.2;        // ターン開始時に回復するガッツ(最大値に対する割合)
const RPG_SKILL_GUTS_DIVISOR = 10;     // 固有技の消費ガッツ(本編の baseGuts を割る)
const RPG_ENEMY_SKILL_CHANCE = 0.35;   // 敵が固有技を撃てるときに実際に撃つ確率
const RPG_DAMAGE_VARIANCE = 0.05;      // ダメージ乱数をONにしたときの振れ幅(±)
// 行動値 = 素早さ × (0.9〜1.1)。素早い者ほど先に動きやすいが、
// 素早さが1違うだけで永久に先手、という状態にはならない
const RPG_ACTION_VARIANCE = 0.1;
// 回避率(%) = 3 + (防御側の素早さ - 攻撃側の素早さ) × 0.3。1%〜20%に収める
const RPG_EVADE_BASE = 3;
const RPG_EVADE_PER_SPEED = 0.3;
const RPG_EVADE_MIN = 1;
const RPG_EVADE_MAX = 20;
// クリティカル率(%) = 3 + (攻撃側の運 - 防御側の運) × 0.2。1%〜15%に収める
const RPG_CRIT_BASE = 3;
const RPG_CRIT_PER_LUCK = 0.2;
const RPG_CRIT_MIN = 1;
const RPG_CRIT_MAX = 15;
const RPG_CRIT_MULT = 1.5;             // クリティカル時の最終ダメージ倍率

// 敵の色違いタイプ。画像は正式ベースモンのものをそのまま使い、見た目はCSSフィルタだけで変える
// (画像ファイルの加工・複製・base64化はしない)。補正値と配分の周期はここだけを直せばよい。
//   cycle : 配分ポイントを上から順に振っていく周期。同じLv・同じ種なら必ず同じ能力になる
//   mult  : 配分後に掛ける軽い補正。低Lvでも見た目の性格差が出るようにするためのデバッグ用
const RPG_ENEMY_TYPES = Object.freeze([
  { id:'normal', label:'通常種', short:'通常', accent:'#94a3b8', filter:'none',
    cycle:Object.freeze(['hp','atk','def','guts','speed','luck']),
    mult:Object.freeze({ hp:1, atk:1, def:1, guts:1, speed:1, luck:1 }) },
  { id:'red', label:'赤（攻撃型）', short:'赤', accent:'#f87171',
    filter:'sepia(1) saturate(6) hue-rotate(-25deg) brightness(0.95)',
    cycle:Object.freeze(['atk','atk','hp','guts','speed','def','luck']),
    mult:Object.freeze({ hp:0.95, atk:1.15, def:0.90, guts:1, speed:1, luck:1 }) },
  { id:'blue', label:'青（耐久型）', short:'青', accent:'#60a5fa',
    filter:'sepia(1) saturate(5) hue-rotate(175deg) brightness(1.02)',
    cycle:Object.freeze(['def','hp','def','hp','atk','speed','guts','luck']),
    mult:Object.freeze({ hp:1.15, atk:0.90, def:1.15, guts:1, speed:1, luck:1 }) },
]);
const rpgEnemyType = (id) => RPG_ENEMY_TYPES.find(t => t.id === id) || RPG_ENEMY_TYPES[0];

const rpgClampLevel = (level) => {
  const n = Math.floor(Number(level));
  return Number.isFinite(n) ? Math.max(1, Math.min(RPG_MAX_LEVEL, n)) : 1;
};
// 現在のベース能力をRPG向けの小さな数値へ落とす。最低1は必ず残す
const rpgScaleStat = (value) => Math.max(1, Math.round((Number(value) || 0) / RPG_STAT_DIVISOR));
// ベースモン定義(ALL_PLAYER_MONSTERS の1件)から、そのままRPGのLv1能力を作る。
// RPG用に同じ数値を別表として書き写さないための唯一の入口。
const rpgBaseStatsOf = (mon) => ({
  hp: rpgScaleStat(mon?.baseHp), atk: rpgScaleStat(mon?.baseAtk),
  def: rpgScaleStat(mon?.baseDef), guts: rpgScaleStat(mon?.baseGuts),
  // 素早さ・運は本編に基礎値が無いので、この試作の共通初期値を使う
  speed: RPG_BASE_SPEED, luck: RPG_BASE_LUCK,
});
// そのLvで使える配分ポイント(Lv1は0P、Lv50は49P)
const rpgPointsForLevel = (level) => Math.max(0, rpgClampLevel(level) - 1) * RPG_POINTS_PER_LEVEL;
const rpgEmptyAlloc = () => RPG_STAT_KEYS.reduce((out, key) => { out[key] = 0; return out; }, {});
const rpgAllocTotal = (alloc) => RPG_STAT_KEYS.reduce((sum, key) => sum + Math.max(0, Math.floor(Number(alloc?.[key]) || 0)), 0);
// Lvを下げたときなど、使用可能ポイントを超えた配分を上から順に切り詰める
const rpgNormalizeAlloc = (alloc, level) => {
  const limit = rpgPointsForLevel(level);
  const next = rpgEmptyAlloc();
  let used = 0;
  for (const key of RPG_STAT_KEYS) {
    const want = Math.max(0, Math.floor(Number(alloc?.[key]) || 0));
    const give = Math.max(0, Math.min(want, limit - used));
    next[key] = give; used += give;
  }
  return next;
};
// 基礎能力 + 配分ポイント → 実際に戦う能力
const rpgApplyAlloc = (base, alloc) => RPG_STAT_KEYS.reduce((out, key) => {
  out[key] = Math.max(1, Math.round((base?.[key] || 0) + (Math.max(0, Math.floor(Number(alloc?.[key]) || 0)) * RPG_GAIN_PER_POINT[key])));
  return out;
}, {});
// 敵の自動配分。乱数を使わないので、同じLv・同じ色タイプなら毎回まったく同じ能力になる
const rpgEnemyAlloc = (typeId, level) => {
  const cycle = rpgEnemyType(typeId).cycle;
  const alloc = rpgEmptyAlloc();
  const points = rpgPointsForLevel(level);
  for (let i = 0; i < points; i++) alloc[cycle[i % cycle.length]] += 1;
  return alloc;
};
const rpgEnemyStats = (mon, typeId, level) => {
  const type = rpgEnemyType(typeId);
  const grown = rpgApplyAlloc(rpgBaseStatsOf(mon), rpgEnemyAlloc(typeId, level));
  return RPG_STAT_KEYS.reduce((out, key) => { out[key] = Math.max(1, Math.round(grown[key] * type.mult[key])); return out; }, {});
};
// 固有技のRPG用消費ガッツ。本編の baseGuts をそのまま持ってきて1/10にする
const rpgSkillCost = (unique) => Math.max(1, Math.round((Number(unique?.baseGuts) || 0) / RPG_SKILL_GUTS_DIVISOR));
// そのモンスターの固有技(名前・倍率・消費)を本編定義から取り出す。無ければ null
const rpgSkillOf = (mon) => {
  const unique = mon?.unique;
  if (!unique || !Number.isFinite(Number(unique.baseMult))) return null;
  return { name: unique.name, mult: Number(unique.baseMult), cost: rpgSkillCost(unique) };
};

// ★RPG専用のダメージ計算。味方→敵も敵→味方もここだけを通す(画面ごとに式を複製しない)。
// 通常バトル(getDmg / getIncomingDamageBeforeTurnReduction)とは完全に別物で、互いに影響しない。
//
//   基本ダメージ = ちから × 技倍率 × 100 ÷ (100 + 丈夫さ × 4)
//
// 乱数(variance)は0.95〜1.05の範囲で、デバッグ設定でOFFにすると必ず1.0になる。
// 防御中は0.5、クリティカルなら1.5を掛け、最後に四捨五入して最低1ダメージにする
// (先に丸めてから半分にすると「最低1」が0.5になってしまうため、丸めは最後に1回だけ行う)。
const rpgDamage = ({ atk, mult = RPG_NORMAL_ATTACK_MULT, def, guarding = false, variance = 1, critical = false }) => {
  const power = Math.max(0, Number(atk) || 0) * (Number(mult) || 0);
  const resist = 100 + Math.max(0, Number(def) || 0) * RPG_DEF_COEFF;
  let raw = power * 100 / resist;
  raw *= Number.isFinite(variance) && variance > 0 ? variance : 1;
  if (guarding) raw *= RPG_GUARD_MULT;
  if (critical) raw *= RPG_CRIT_MULT;
  return Math.max(1, Math.round(raw));
};
// ★乱数はすべて外から差し込めるようにしてある(rng)。既定は Math.random で、
// 検査ツールは決まった値を返す関数を渡して「たまたま当たった／外れた」を無くす。
const rpgDefaultRng = () => Math.random();
// 乱数ONのときだけ0.95〜1.05を返す。OFFなら必ず1.0(バランス確認をしやすくするため既定はOFF)
const rpgVarianceRoll = (enabled, rng = rpgDefaultRng) => enabled ? 1 - RPG_DAMAGE_VARIANCE + rng() * RPG_DAMAGE_VARIANCE * 2 : 1;
const rpgStartGuts = (maxGuts) => Math.min(maxGuts, Math.ceil(Math.max(0, maxGuts) * RPG_START_GUTS_RATE));
const rpgTurnGutsRegen = (maxGuts) => Math.max(1, Math.round(Math.max(0, maxGuts) * RPG_TURN_GUTS_RATE));

const rpgClamp = (value, min, max) => Math.min(max, Math.max(min, value));
// 行動値。素早さが高い者ほど大きくなるが、毎ターン0.9〜1.1の幅で少しだけ前後する
const rpgActionValue = (speed, roll = rpgDefaultRng()) =>
  Math.max(0, Number(speed) || 0) * (1 - RPG_ACTION_VARIANCE + rpgClamp(Number(roll) || 0, 0, 1) * RPG_ACTION_VARIANCE * 2);
// 回避率(%)。防御側が速いほど上がる。攻撃側が大幅に速くても最低1%は残る
const rpgEvadeRate = (attacker, defender) => rpgClamp(
  RPG_EVADE_BASE + ((Number(defender?.speed) || 0) - (Number(attacker?.speed) || 0)) * RPG_EVADE_PER_SPEED,
  RPG_EVADE_MIN, RPG_EVADE_MAX);
// クリティカル率(%)。攻撃側の運が高いほど上がる
const rpgCritRate = (attacker, defender) => rpgClamp(
  RPG_CRIT_BASE + ((Number(attacker?.luck) || 0) - (Number(defender?.luck) || 0)) * RPG_CRIT_PER_LUCK,
  RPG_CRIT_MIN, RPG_CRIT_MAX);
// 「率(%)」の抽選。roll は 0以上1未満。味方も敵もこの1つを通す
const rpgRollPercent = (ratePercent, roll) => (Number(roll) || 0) * 100 < (Number(ratePercent) || 0);

// ---------- RPG戦闘の進行(コマンド式ターン制) ----------
// 1ターンの流れ:
//   ① 生存している味方全員のコマンド(と対象)を順番に入力する
//   ② 敵の行動内容と対象を決める
//   ③ 味方・敵をまとめて行動値(素早さ×0.9〜1.1)で並べ、行動順を確定する
//   ④ 行動順に1体ずつ処理する
//   ⑤ 全員終わったら次のターンへ(防御解除・ガッツ回復)
// 味方だけ・敵だけをまとめて動かす固定順ではないので、素早い敵が味方より先に動くこともある。
// 状態はすべてこのオブジェクトの中だけにあり、保存も送信も一切しない。
//
// 使えるベースモンの一覧。正式にプレイできる種だけを自動で拾うので、
// モンスターを追加してもRPGデバッグ側の更新漏れが起きない。
// デバッグ専用個体(debugOnly)とマスモン(個体)は入らない。
const rpgMonsterList = () => Object.values(ALL_PLAYER_MONSTERS).filter(mon => mon && mon.id && !mon.debugOnly);
const rpgMonsterById = (id) => rpgMonsterList().find(mon => mon.id === id) || rpgMonsterList()[0] || null;

const rpgEmptyRecord = () => ({ dealt:0, taken:0, attacks:0, skills:0, gutsSpent:0, crits:0, evaded:0 });
const rpgMakeUnit = (mon, level, stats, extra = {}) => ({
  monId: mon.id, name: mon.name, emoji: mon.emoji,
  imgUrl: mon.imgUrl, iconUrl: mon.iconUrl,
  level: rpgClampLevel(level),
  maxHp: stats.hp, maxGuts: stats.guts, atk: stats.atk, def: stats.def,
  speed: stats.speed, luck: stats.luck,
  hp: stats.hp, guts: rpgStartGuts(stats.guts),
  guarding: false, alive: true,
  skill: rpgSkillOf(mon),
  record: rpgEmptyRecord(),
  ...extra,
});
// セットアップ画面の1枠 → 実際に戦うユニット。ここが味方・敵で共通の入口になる
const rpgBuildAlly = (slot) => {
  const mon = rpgMonsterById(slot?.monId);
  if (!mon) return null;
  const level = rpgClampLevel(slot?.level);
  const stats = rpgApplyAlloc(rpgBaseStatsOf(mon), rpgNormalizeAlloc(slot?.alloc, level));
  return rpgMakeUnit(mon, level, stats, { side:'ally' });
};
const rpgBuildEnemy = (slot) => {
  const mon = rpgMonsterById(slot?.monId);
  if (!mon) return null;
  const type = rpgEnemyType(slot?.typeId);
  const level = rpgClampLevel(slot?.level);
  return rpgMakeUnit(mon, level, rpgEnemyStats(mon, type.id, level), {
    side:'enemy', typeId:type.id,
    name: type.id === 'normal' ? mon.name : `${type.short}${mon.name}`,
  });
};
// ログは最新から積む。画面では先頭数件だけ出すのでスマホでも溢れない
const rpgPushLog = (battle, text) => { battle.log = [text, ...battle.log].slice(0, 40); };
const rpgAliveIndexes = (units) => units.map((u, i) => (u.alive ? i : -1)).filter(i => i >= 0);
const rpgSideUnits = (battle, side) => (side === 'ally' ? battle.allies : battle.enemies);
// 対象を選ばずに撃ったときの相手。生きている敵のうちライフがいちばん低い1体を狙う。
// 同じライフなら並び順が早いほう。乱数を使わないので、同じ盤面なら毎回同じ相手になる
const rpgLowestHpEnemy = (battle) => {
  let pick = -1;
  (battle.enemies || []).forEach((unit, index) => {
    if (!unit || !unit.alive) return;
    if (pick < 0 || unit.hp < battle.enemies[pick].hp) pick = index;
  });
  return pick;
};
const rpgUnitAt = (battle, side, index) => rpgSideUnits(battle, side)[index];
// 行動順のタイブレーク。行動値が同じでも結果がぶれないよう、
// 素早さ → 味方が先 → 並び順 の順で必ず同じ答えになるようにする
const rpgOrderTieBreak = (battle, a, b) =>
  (rpgUnitAt(battle, b.side, b.index)?.speed || 0) - (rpgUnitAt(battle, a.side, a.index)?.speed || 0)
  || (a.side === b.side ? a.index - b.index : (a.side === 'ally' ? -1 : 1));
// コマンド入力中に見せる「素早さ順の予測」。乱数を使わないので毎回同じ並びになる
const rpgSpeedOrder = (battle) => {
  const entries = [];
  battle.allies.forEach((u, index) => { if (u.alive) entries.push({ side:'ally', index }); });
  battle.enemies.forEach((u, index) => { if (u.alive) entries.push({ side:'enemy', index }); });
  return entries.sort((a, b) => rpgOrderTieBreak(battle, a, b));
};
const rpgCheckOutcome = (battle) => {
  if (!battle.enemies.some(u => u.alive)) { battle.outcome = 'win'; battle.phase = 'result'; rpgPushLog(battle, '敵を全滅させた！'); return true; }
  if (!battle.allies.some(u => u.alive)) { battle.outcome = 'lose'; battle.phase = 'result'; rpgPushLog(battle, 'パーティは全滅した…'); return true; }
  return false;
};
// コマンド入力の受け皿を作り直して、最初に入力する味方へ進める
const rpgBeginInput = (battle) => {
  battle.inputs = {};
  battle.plan = [];
  battle.planStep = 0;
  battle.pendingCommand = null;
  const alive = rpgAliveIndexes(battle.allies);
  battle.inputIndex = alive.length ? alive[0] : -1;
  battle.phase = alive.length ? 'command' : 'result';
};
// 決めたコマンドをやり直す。コマンド入力中に、すでに決めた味方まで戻る。
// その味方の入力だけを消し、ほかの味方が決めた内容・ライフ・ガッツには触らない。
// 行動の実行が始まったあと(resolve)は戻せない
const rpgUndoCommand = (battle, index) => {
  const next = JSON.parse(JSON.stringify(battle));
  if (next.phase !== 'command') return next;
  const unit = next.allies[index];
  if (!unit || !unit.alive) return next;
  if (!next.inputs || !next.inputs[index]) return next;
  delete next.inputs[index];
  next.inputIndex = index;
  next.pendingCommand = null;
  return next;
};
// やり直せる味方かどうか(画面のボタンを押せるかの判定にも使う)
const rpgCanUndo = (battle, index) => !!(battle && battle.phase === 'command'
  && battle.allies[index] && battle.allies[index].alive
  && battle.inputs && battle.inputs[index]);
const RPG_COMMAND_LABELS = Object.freeze({ attack:'こうげき', skill:'技', guard:'防御' });

const rpgCreateBattle = (partySlots, enemySlots) => {
  const allies = (partySlots || []).map(rpgBuildAlly).filter(Boolean);
  const enemies = (enemySlots || []).map(rpgBuildEnemy).filter(Boolean);
  const battle = {
    turn: 1, phase: 'command', inputIndex: 0, pendingCommand: null,
    inputs: {}, plan: [], planStep: 0,
    allies, enemies, log: ['戦闘開始！'], outcome: null,
  };
  if (!allies.length || !enemies.length) { battle.phase = 'result'; battle.outcome = 'lose'; return battle; }
  rpgBeginInput(battle);
  return battle;
};

// ★1回の攻撃を解決する。味方→敵も敵→味方もここだけを通る。
// 回避判定 → クリティカル判定 → ダメージ の順で、回避したらクリティカル判定は行わない。
const rpgResolveAttack = (battle, attacker, defender, mult, label, varianceOn, rng) => {
  rpgPushLog(battle, `${attacker.name}の${label}！`);
  if (rpgRollPercent(rpgEvadeRate(attacker, defender), rng())) {
    defender.record.evaded += 1;
    rpgPushLog(battle, `${defender.name}は攻撃をかわした！`);
    return 0;
  }
  const critical = rpgRollPercent(rpgCritRate(attacker, defender), rng());
  const damage = rpgDamage({
    atk: attacker.atk, mult, def: defender.def,
    guarding: defender.guarding, variance: rpgVarianceRoll(varianceOn, rng), critical,
  });
  defender.hp = Math.max(0, defender.hp - damage);
  attacker.record.dealt += damage;
  defender.record.taken += damage;
  if (critical) { attacker.record.crits += 1; rpgPushLog(battle, '会心の一撃！'); }
  rpgPushLog(battle, `${defender.name}に${damage}ダメージ`);
  if (defender.hp <= 0 && defender.alive) { defender.alive = false; rpgPushLog(battle, `${defender.name}は戦闘不能！`); }
  return damage;
};

// 敵1体の行動内容と対象を決める。AIは「撃てるなら一定確率で固有技、それ以外は通常攻撃」だけ
const rpgDecideEnemyAction = (battle, enemy, rng) => {
  const targets = rpgAliveIndexes(battle.allies);
  if (!targets.length) return null;
  // 乱数は必ず同じ回数だけ引く(条件で引いたり引かなかったりすると、
  // 乱数を差し込んだ検査で結果が再現できなくなる)
  const targetRoll = rng();
  const skillRoll = rng();
  const targetIndex = targets[Math.min(targets.length - 1, Math.floor(targetRoll * targets.length))];
  const canSkill = !!enemy.skill && enemy.guts >= enemy.skill.cost;
  return { command: canSkill && skillRoll < RPG_ENEMY_SKILL_CHANCE ? 'skill' : 'attack', targetSide:'ally', targetIndex };
};
// 味方全員の入力がそろったら、敵の行動を決めて行動順を確定する
const rpgBuildTurn = (battle, rng) => {
  const entries = [];
  battle.allies.forEach((unit, index) => {
    if (!unit.alive) return;
    const input = battle.inputs[index];
    if (input) entries.push({ side:'ally', index, ...input });
  });
  battle.enemies.forEach((unit, index) => {
    if (!unit.alive) return;
    const decided = rpgDecideEnemyAction(battle, unit, rng);
    if (decided) entries.push({ side:'enemy', index, ...decided });
  });
  entries.forEach(entry => { entry.value = rpgActionValue(rpgUnitAt(battle, entry.side, entry.index)?.speed, rng()); });
  entries.sort((a, b) => b.value - a.value || rpgOrderTieBreak(battle, a, b));
  battle.plan = entries;
  battle.planStep = 0;
  battle.phase = 'resolve';
};
// 味方1体ぶんのコマンドを記録する。全員そろったら行動順を確定して実行フェーズへ移る
const rpgSetCommand = (battle, command, targetIndex, rng = rpgDefaultRng) => {
  const next = JSON.parse(JSON.stringify(battle));
  if (next.phase !== 'command' && next.phase !== 'target') return next;
  const index = next.inputIndex;
  const actor = next.allies[index];
  if (!actor || !actor.alive) return next;
  if (command === 'skill' && (!actor.skill || actor.guts < actor.skill.cost)) return next;
  if (command === 'guard') next.inputs[index] = { command:'guard', targetSide:null, targetIndex:-1 };
  else {
    const target = next.enemies[targetIndex];
    if (!target || !target.alive) return next;
    next.inputs[index] = { command, targetSide:'enemy', targetIndex };
  }
  next.pendingCommand = null;
  const remaining = next.allies.findIndex((unit, i) => unit.alive && i > index && !next.inputs[i]);
  if (remaining >= 0) { next.inputIndex = remaining; next.phase = 'command'; return next; }
  rpgBuildTurn(next, rng);
  return next;
};
// ターンの終わり。防御を解除し、生存者のガッツを1ターンにつき1回だけ回復する
const rpgEndTurn = (battle) => {
  battle.allies.forEach(u => { u.guarding = false; });
  battle.enemies.forEach(u => { u.guarding = false; });
  battle.turn += 1;
  [...battle.allies, ...battle.enemies].forEach(u => {
    if (u.alive) u.guts = Math.min(u.maxGuts, u.guts + rpgTurnGutsRegen(u.maxGuts));
  });
  rpgPushLog(battle, `--- TURN ${battle.turn} ---`);
  rpgBeginInput(battle);
};
// 行動順の1体ぶんを処理する。画面はこれを間隔をあけて呼ぶ
const rpgResolveStep = (battle, varianceOn, rng = rpgDefaultRng) => {
  const next = JSON.parse(JSON.stringify(battle));
  if (next.phase !== 'resolve') return next;
  const entry = next.plan[next.planStep];
  next.planStep += 1;
  const actor = entry ? rpgUnitAt(next, entry.side, entry.index) : null;
  // 倒されたモンスターは、入力済みでも行動しない
  if (entry && actor && actor.alive) {
    if (entry.command === 'guard') {
      actor.guarding = true;
      rpgPushLog(next, `${actor.name}は身を守っている`);
    } else {
      const targets = rpgSideUnits(next, entry.targetSide);
      let targetIndex = entry.targetIndex;
      // 自分より前の行動で対象が倒れていたら、生きている相手へ狙いを移す
      if (!targets[targetIndex] || !targets[targetIndex].alive) {
        const alive = rpgAliveIndexes(targets);
        targetIndex = alive.length ? alive[0] : -1;
        if (targetIndex >= 0) rpgPushLog(next, `${actor.name}は${targets[targetIndex].name}へ狙いを変えた`);
      }
      if (targetIndex >= 0) {
        const target = targets[targetIndex];
        const useSkill = entry.command === 'skill' && actor.skill && actor.guts >= actor.skill.cost;
        if (useSkill) {
          // 消費ガッツは撃つ前に払う。回避されて外れても戻さない
          actor.guts -= actor.skill.cost;
          actor.record.gutsSpent += actor.skill.cost;
          actor.record.skills += 1;
          rpgResolveAttack(next, actor, target, actor.skill.mult, actor.skill.name, varianceOn, rng);
        } else {
          actor.record.attacks += 1;
          rpgResolveAttack(next, actor, target, RPG_NORMAL_ATTACK_MULT, 'こうげき', varianceOn, rng);
        }
      }
    }
  }
  if (rpgCheckOutcome(next)) return next;
  if (next.planStep >= next.plan.length) rpgEndTurn(next);
  return next;
};

// ---------- RPG戦闘の攻撃モーション(表示だけ) ----------
// 通常バトルのモーションは素のCSS @keyframes なので、そのまま流用できる。
// ただし通常バトルは大きな立ち絵向けに作られていて移動量が大きい(味方-180px・敵+90px)。
// RPGデバッグ画面は味方が38pxの顔アイコン・敵が80〜210pxの丸枠なので、
// 同じ動きを小さくした専用の keyframes を当てる(動きの種類は通常バトルと同じ考え方)。
//
// どのモーションを使うかは、通常バトルとまったく同じ ALL_PLAYER_MONSTERS[].atkMotion で決める。
// RPG用にモーションのデータを別に持たないので、モンスターを足しても更新漏れが起きない。
const RPG_MOTION_BY_ATK = Object.freeze({ default:'Attack', floatStab:'Float', waterBurst:'Water', zanCombo:'Dash', eikiSakuraCombo:'Dash', kenshiTwinBlade:'Dash', pandoraDualThunder:'Thunder' });
// DEBUGと本番バトルが同じatkMotion名・同じkeyframesを通るための共通入口。
const attackMotionAnimation = (anim) => {
  if (!anim) return undefined;
  // パンドラは枠全体を動かさず、PandoraDualThunder 内の実画像2枚を動かす。
  if (anim.motion==='pandoraDualThunder') return undefined;
  // エイキはザンと同じ高速斬撃の動き(zanComboDash)をそのまま使う。
  // 桜の花びらは枠を動かすのではなく、下の SakuraPetals を攻撃中だけ重ねて出す
  // 剣士モッチーは敵まで高速で斬り込み、二度通り抜けてX字を完成させる専用モーション。
  // KenshiTwinSlash は斬撃・速度線・決めの閃光を攻撃中だけ重ねる。
  if (anim.twinBlade || anim.motion==='kenshiTwinBlade') return 'kenshiTwinBladeSlash 560ms cubic-bezier(.18,.76,.2,1) forwards';
  if (anim.zanCombo) return 'zanComboDash 320ms ease-out forwards';
  if (anim.charge) return 'specialCharge 650ms ease-out forwards';
  if (anim.charge===false) return anim.motion==='floatStab'?'floatStabLunge 700ms ease-in forwards':(anim.motion==='waterBurst'?'waterBurstLunge 520ms ease-out forwards':'specialLunge 500ms ease-in forwards');
  return anim.motion==='floatStab'?'floatStabAttack 650ms ease-in forwards':(anim.motion==='waterBurst'?'waterBurstAttack 520ms ease-out forwards':'attackFly 450ms ease-in forwards');
};
// 図鑑・画像デバッグで、本番の atkMotion を「1回の攻撃アクション」として見せるための共通手順。
// 動かし方そのものは attackMotionAnimation / PandoraDualThunder 等の本番演出を使い、
// ここでは「どの状態を何ms見せるか」だけを返す。保存や戦闘計算には触れない。
const attackMotionPreviewSequence = (atkMotion='default') => {
  const motion=atkMotion||'default';
  if(motion==='default') return [{anim:{motion:'default'},ms:450}];
  const isTwin=motion==='kenshiTwinBlade';
  const isComboDash=motion==='zanCombo'||motion==='eikiSakuraCombo'||isTwin;
  if(isComboDash) return [
    {anim:{charge:true},ms:650},
    {anim:{zanCombo:!isTwin,twinBlade:isTwin,sakura:motion==='eikiSakuraCombo'},ms:motion==='eikiSakuraCombo'?500:(isTwin?560:320)},
  ];
  if(motion==='pandoraDualThunder') return [
    {anim:{charge:true},ms:650},
    {anim:{charge:false,motion:'pandoraDualThunder',sakura:false},ms:900},
  ];
  return [
    {anim:{charge:true},ms:650},
    {anim:{charge:false,motion,sakura:false},ms:motion==='floatStab'?700:(motion==='waterBurst'?520:500)},
  ];
};
const rpgMotionName = (side, monId, isSkill) => {
  const prefix = side === 'ally' ? 'rpgAlly' : 'rpgFoe';
  if (isSkill) return `${prefix}Special`;
  const kind = RPG_MOTION_BY_ATK[ALL_PLAYER_MONSTERS[monId]?.atkMotion] || 'Attack';
  return `${prefix}${kind}`;
};
// 固有技は少し長め。連撃(ザン)は短く刻む
const rpgMotionMs = (name) => name.endsWith('Special') ? 460 : (name.endsWith('Dash') ? 360 : 420);

// 画面側で「1体ぶん処理が進んだ」を見分けるための判定(表示だけに使う)。
// rpgResolveStep() の出口は3つあり、抜け方によって phase と planStep の変わり方が違う。
//   ・まだ続く          → phase:'resolve'、planStep が1つ進む
//   ・決着がついた      → phase:'result'、planStep はそのまま
//   ・そのターンの最後  → phase:'command'、planStep は0へ戻り turn が1つ進む
// 以前は1つめしか見ていなかったため、ターンの最後の行動と決着の一撃だけ
// 技名の帯・ダメージの数字・攻撃モーションが丸ごと出ていなかった。
const rpgSteppedOnce = (prev, next) => {
  if (!prev || !next || prev.phase !== 'resolve') return false;
  if (next.phase === 'resolve') return next.planStep === prev.planStep + 1;
  if (next.phase === 'result') return next.turn === prev.turn;
  if (next.phase === 'command') return next.turn === prev.turn + 1;
  return false;
};

// ---------- RPG戦闘の技の演出(表示だけ) ----------
// 技は通常こうげきより重い行動なので、技名の帯・画面の閃光・軽い揺れ・対象への衝撃波を出す。
// 演出が出ている間は次の行動を少し待つ(戦闘の計算・順番・ダメージには一切関係しない)。
const RPG_SPECIAL_MS = 940;   // 技の演出が出ている長さ
const RPG_STEP_MS = 620;      // ふだんの「1体ぶん処理する」間隔
const RPG_SPECIAL_STEP_MS = 1000; // 技を撃った直後だけ、演出を見せるために長くとる間隔
// 決着がついた瞬間に結果画面へ飛ばすと、最後の一撃のダメージも技の演出も見えないまま終わる。
// いちばん長い演出(技の帯940ms・ダメージの数字900ms)より少しだけ長く待ってから移る
const RPG_FINISH_MS = 1100;
// 直前に処理した行動が技だったかどうかだけを見る。plan は読むだけで書き換えない
const rpgStepDelay = (battle) => {
  const last = battle && Array.isArray(battle.plan) ? battle.plan[battle.planStep - 1] : null;
  return last && last.command === 'skill' ? RPG_SPECIAL_STEP_MS : RPG_STEP_MS;
};
