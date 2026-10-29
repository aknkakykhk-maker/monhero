// ==== タクティクス(とレイド)の EX で、いま効いている強化・弱化の一覧(見せる用・読むだけ) ====
// 2026-10-29 社長の決め「ア＋イ」(EX の効果を見やすく)。見た目は 71-screen-battle.jsx(レフェリーくん)、ここはデータだけ。
// 効き目の計算は変えない。32-tactics-units.jsx の判定(tacticsExActiveEffect・tacticsExRemainOf ほか)を読んで並べるだけ。
// 1つの要素の形(味方・敵とも同じ):
//   { key, name, icon, kind:'buff'|'debuff', pct, fromName, fromSlot, turnsLeft, allAllies, note }
//   key … `${effect}@${使った子の枠}`(同じ枠の一覧の中で一意) / name … 画面の短い呼び名(EX の名前) / icon … 絵文字1つ
//   pct … 何%(数・無ければ null) / fromName・fromSlot … 誰の EX か / turnsLeft … 残りターンの数(このターンだけは 1)・
//   WAVE のあいだは 'wave'・切り替えるまでは null / allAllies … 味方全員に効く EX か / note … 詳細の窓の1行
// 一覧は docs/progress/battle-ex-buffs.md(31種)。表に無い effect は出さない(足したらここにも足す)
const tacticsExPct = (v) => (Number.isFinite(Number(v)) && Number(v) !== 0 ? Math.round(Number(v) * 100) : null);
// to … 'self'(使った子)/'all'(味方全員)/'others'(使った子以外の味方)/'target'(選ばれた子)/'enemy'(敵だけ。listTacticsExEnemyEffects で出す)
// pct・note は def(TACTICS_EX_SKILLS の1つ)を受けて作る
const TACTICS_EX_EFFECT_VIEW = Object.freeze({
  coverAll:     { icon: '🛡️', to: 'others', note: () => '敵の攻撃をモノリスが代わりに受ける' },
  statBoost:    { icon: '💪', to: 'self', pct: (d) => tacticsExPct(d.rates ? Math.max(...Object.values(d.rates)) : d.statRate),
    note: (d) => d.rates ? `力・ガッツ+${tacticsExPct(d.rates.atk)}%・丈夫さ・ライフ+${tacticsExPct(d.rates.def)}%・自動回復アップ` : `全ステータス+${tacticsExPct(d.statRate)}%・自動回復+${tacticsExPct(d.regenRate)}%` },
  distMatch:    { icon: '🌸', to: 'self', note: () => '距離補正×1.7・同じ距離は完全回避' },
  dodgeCombo:   { icon: '🩸', to: 'self', note: (d) => `同じ距離は完全回避・回避するたびに連撃+${tacticsExPct(d.dodgeComboRate)}%` },
  multiBuff:    { icon: '✨', to: 'self', pct: (d) => tacticsExPct(d.dmgRate),
    note: (d) => [d.dmgRate ? `与ダメ+${tacticsExPct(d.dmgRate)}%` : '', d.selfTakenRate ? `被ダメ−${tacticsExPct(d.selfTakenRate)}%` : '',
      d.rates && d.rates.def ? `丈夫さ+${tacticsExPct(d.rates.def)}%` : '', d.critRateRate ? '会心アップ' : '', d.distMult ? `距離補正×${d.distMult}` : '',
      d.uniqueCrit ? '固有技は必ず会心' : '', d.extraCombos ? `連撃${tacticsExPct(d.extraCombos.rate)}%×${d.extraCombos.count}` : ''].filter(Boolean).join('・') },
  stage:        { icon: '🎤', to: 'all', note: () => 'カード+1・ボルテージが上がるほど全員の与ダメ・回復アップ' },
  present:      { icon: '🎁', to: 'all', note: () => '全員のガッツ回復とランダムな贈り物' },
  lifeSpring:   { icon: '⛲', to: 'target', note: (d) => `ライフ上限+${tacticsExPct(d.lifeSpring && d.lifeSpring.maxUpRate)}%・根性・与ダメアップ` },
  timeStop:     { icon: '⏱️', to: 'self', note: () => 'このターン、敵は動かない・味方の強化を写す' },
  pandoraBox:   { icon: '📦', to: 'self', note: () => '毎ターン固有技・悪魔の連撃と天使の回復' },
  thunder:      { icon: '⚡', to: 'self', note: (d) => `雷をためて雷纏・与ダメ+${tacticsExPct(d.thunder && d.thunder.dmg)}%・回避アップ` },
  partyBoost:   { icon: '🌱', to: 'all', pct: (d) => tacticsExPct(d.partyBoost && d.partyBoost.statRate),
    note: (d) => `力・丈夫さ+${tacticsExPct(d.partyBoost && d.partyBoost.statRate)}%・自動回復+${tacticsExPct(d.partyBoost && d.partyBoost.hpRegen)}%` },
  damageBack:   { icon: '🌫️', to: 'all', pct: (d) => tacticsExPct(d.damageBack && d.damageBack.hpRate),
    note: (d) => `受けたダメージの${tacticsExPct(d.damageBack && d.damageBack.hpRate)}%がライフに戻る` },
  psychoLock:   { icon: '🎯', to: 'enemy', note: () => '敵の距離を固定・敵の与ダメダウン・被ダメアップ(敵の一覧で出す)' },
  counter:      { icon: '🥊', to: 'self', note: () => '狙われたターンに攻撃するとカウンター(与ダメ×2×カウンター)' },
  allIn:        { icon: '👊', to: 'self', note: () => '丈夫さが0になり、その50%が力へ' },
  weaponChange: { icon: '🗡️', to: 'self', note: () => '戦い方を切り替えた' },
  partyGuard:   { icon: '🍃', to: 'all', pct: (d) => tacticsExPct(d.partyTakenRate),
    note: (d) => `被ダメ−${tacticsExPct(d.partyTakenRate)}%・毎ターン全員ライフ${tacticsExPct(d.partyRegenRate)}%回復` },
  comboBurst:   { icon: '🍬', to: 'self', note: (d) => `連撃${tacticsExPct(d.extraCombos && d.extraCombos.rate)}%×${d.extraCombos && d.extraCombos.count}` },
  avoidCharge:  { icon: '👻', to: 'self', note: () => '完全回避・残っているあいだ会心確定と連撃' },
  kitsunebi:    { icon: '🦊', to: 'self', note: () => '狐火1つにつき与ダメ+4%・被ダメ−3%' },
  hoshiai:      { icon: '🌌', to: 'self', note: () => '相方と続けて攻撃' },
  kogare:       { icon: '🌠', to: 'self', note: () => '攻撃が当たると25%で敵が「意味不明」' },
  trickConfuse: { icon: '🌀', to: 'all', pct: (d) => tacticsExPct(d.partyStatRate), note: (d) => `全員の力・丈夫さ+${tacticsExPct(d.partyStatRate)}%` },
  cookieBox:    { icon: '🍪', to: 'all', note: () => '全員の与ダメアップ・被ダメダウン(配ったクッキーの数で決まる)' },
  nightmareKey: { icon: '🗝️', to: 'self', note: () => '与ダメ・会心率アップ(使った黒音符の数で決まる)' },
  kusabiDouble: { icon: '🔻', to: 'self', note: (d) => `楔が1回で2つ・上限12・ヘイト−${d.hateDown || 0}` },
  millefeuille: { icon: '🥞', to: 'all', pct: (d) => tacticsExPct(d.millefeuille && d.millefeuille.statBase),
    note: (d) => `シールドのある子は全ステータス+${tacticsExPct(d.millefeuille && d.millefeuille.statBase)}%(楔1つごとに+${tacticsExPct(d.millefeuille && d.millefeuille.statPer)}%)` },
});
const tacticsExTurnsLeftOf = (rm) => (!rm ? null : rm.kind === 'turns' ? Math.max(1, tacticsSafeInt(rm.turns, 1)) : rm.kind === 'wave' ? 'wave' : rm.kind === 'turn' ? 1 : null);
// 枠ごとの一覧(味方)。defOf(monId, slot) は使う EX の定義(60 の raidExDefOf と同じもの)、nameOf(slot) は子の名前
const listTacticsExEffectsAt = (state, units, slot, now, { defOf = null, nameOf = null } = {}) => {
  const list = Array.isArray(units) ? units : [];
  if (!Number.isInteger(slot) || !list[slot]) return [];
  const effects = normalizeTacticsExState(state).effects;
  const out = [];
  list.forEach((u, j) => {
    if (!u) return;
    const eff = tacticsExActiveEffect(state, j, u.id, now);
    const view = eff ? TACTICS_EX_EFFECT_VIEW[eff] : null;
    const def = view && typeof defOf === 'function' ? defOf(u.id, j) : null;
    if (!view || !def) return;
    const hits = view.to === 'self' ? j === slot : view.to === 'all' ? true : view.to === 'others' ? j !== slot
      : view.to === 'target' ? (effects[j] && effects[j].target === slot) : false;
    if (!hits) return;
    out.push({
      key: `${eff}@${j}`, name: def.name || '', icon: view.icon, kind: 'buff',
      pct: view.pct ? view.pct(def) : null, fromName: typeof nameOf === 'function' ? (nameOf(j) || '') : '', fromSlot: j,
      turnsLeft: tacticsExTurnsLeftOf(tacticsExRemainOf(def, state, j, u.id, now)),
      allAllies: view.to === 'all', note: view.note ? view.note(def) : '',
    });
  });
  // 自分の EX が先、そのあとほかの子の EX(枠の順)
  return out.sort((a, b) => (a.fromSlot === slot ? -1 : 0) - (b.fromSlot === slot ? -1 : 0) || a.fromSlot - b.fromSlot);
};
// 敵に付く EX の弱化の一覧。乱心(スプーキー)は EX の状態ではなく 60 の enemyConfuse で数えるので、ここには入れない(60 の enemyDebuffs にある)
const listTacticsExEnemyEffects = (state, units, now, { defOf = null, nameOf = null } = {}) => {
  const list = Array.isArray(units) ? units : [];
  const out = [];
  const nameAt = (j) => (typeof nameOf === 'function' && Number.isInteger(j) ? (nameOf(j) || '') : '');
  const slotOfEffect = (kind) => list.findIndex((u, j) => u && tacticsExActiveEffect(state, j, u.id, now) === kind);
  const item = (o) => out.push({ kind: 'debuff', pct: null, fromName: '', fromSlot: null, turnsLeft: null, allAllies: false, note: '', ...o });
  const psycho = tacticsExPsychoLockOf(state, now);
  if (psycho && psycho.active) { const j = slotOfEffect('psychoLock');
    item({ key: `psychoLock@${j}`, name: 'サイコロックオン', icon: '🎯', pct: tacticsExPct(psycho.enemyTakenBonus), fromName: nameAt(j), fromSlot: j >= 0 ? j : null,
      turnsLeft: psycho.turnsLeft > 0 ? psycho.turnsLeft : null, note: `間合いを動けない・与ダメ−${tacticsExPct(1 - psycho.enemyDmgMult) || 0}%・被ダメ+${tacticsExPct(psycho.enemyTakenBonus) || 0}%` }); }
  const aqua = tacticsExAquaOf(state, list, now);
  if (aqua && aqua.active && aqua.stacks > 0 && (aqua.route === 'prison' || aqua.route === 'freeze')) {
    item({ key: `aqua${aqua.route}@${aqua.slot}`, name: aqua.route === 'prison' ? '水牢' : '氷結', icon: aqua.route === 'prison' ? '💧' : '❄️',
      fromName: nameAt(aqua.slot), fromSlot: Number.isInteger(aqua.slot) ? aqua.slot : null, turnsLeft: aqua.turnsLeft > 0 ? aqua.turnsLeft : null,
      note: `${aqua.stacks}つ・${aqua.route === 'prison' ? '敵の与ダメダウン' : '敵の被ダメアップ'}` }); }
  if (aqua && aqua.active && aqua.finale) item({ key: `aquaFinale@${aqua.slot}`, name: 'アクアフィナーレ', icon: '🌊', fromName: nameAt(aqua.slot),
    fromSlot: Number.isInteger(aqua.slot) ? aqua.slot : null, note: '敵の被ダメが大きく上がる' });
  const nm = tacticsExNightmareEnemyOf(state, list, now);
  if (nm && nm.enemyTaken > 0) { const j = slotOfEffect('nightmareKey');
    item({ key: `nightmareKey@${j}`, name: '悪夢全開', icon: '🗝️', pct: tacticsExPct(nm.enemyTaken), fromName: nameAt(j), fromSlot: j >= 0 ? j : null,
      turnsLeft: nm.turnsLeft > 0 ? nm.turnsLeft : null, note: `敵の被ダメ+${tacticsExPct(nm.enemyTaken)}%` }); }
  // 敵の弱化一覧に出ていなかった2つ(2026-10-29)
  [['kogare', '焦がれ待つ天ノ河', '🌠', '味方の攻撃が当たると25%で「意味不明」(1ターン2回まで)'], ['timeStop', '悠久の刻', '⏱️', 'このターン、敵は動けない']].forEach(([kind, name, icon, note]) => {
    const j = slotOfEffect(kind); if (j < 0) return;
    const def = typeof defOf === 'function' ? defOf(list[j].id, j) : null;
    item({ key: `${kind}@${j}`, name, icon, fromName: nameAt(j), fromSlot: j, turnsLeft: tacticsExTurnsLeftOf(def ? tacticsExRemainOf(def, state, j, list[j].id, now) : null), note });
  });
  return out;
};

// ---- 溜まる物(勇者特性・固有技・EX で積み上がる物)も、同じ形の要素(kind:'stack')で返す(2026-10-29 社長「楔とか溜まってくやつもわかるように」) ----
//   counts … { 種類: 数 }(71 の allyStackCounts[i]・60 の enemyStackCounts と同じ形)。名前と絵は BATTLE_STACK_MARKS(ズカンくんの持ち場)を読む
//   要素は { key:`stack:${種類}`, name, icon, kind:'stack', count, max, turnsLeft(残りターンで数えるものだけ), pct:null, fromName:'', fromSlot:null, allAllies:false, note }
//   「マーク×数」に無い物(中二病の重ね・カウンター・回避数・雷・ボルテージ)は、名前と絵をここで持つ
const TACTICS_STACK_EXTRA = Object.freeze({
  chuuni:      { mark: '😈', label: '中二病の固有技の重ね', note: '固有技の威力+10%・消費ガッツ+10%(1つにつき)' },
  chuuniCut:   { mark: '🛡️', label: '被ダメ半減の残り', note: 'このWAVEのあいだ、被ダメ50%カットをあと何回使えるか' },
  counter:     { mark: '🥊', label: 'カウンター', note: '狙われたターンに攻撃すると、与ダメ×2×カウンター' },
  dodges:      { mark: '🩸', label: '回避した数', note: '回避するたびに連撃が増える' },
  thunder:     { mark: '⚡', label: '雷', note: 'ためたあと雷纏で強化' },
  voltage:     { mark: '🎤', label: 'ボルテージ', note: '1段階ごとに全員の与ダメ・回復アップ' },
});
// 上限(わかるものだけ)。定数は 22-enemy-and-bond-entries.jsx(読めないときは null)
const tacticsStackMaxOf = (kind) => {
  const n = (name) => (typeof globalThis !== 'undefined' && Number.isFinite(globalThis[name]) ? globalThis[name] : null);
  const table = {
    cookie: typeof SWEET_STACK_MAX !== 'undefined' ? SWEET_STACK_MAX : n('SWEET_STACK_MAX'),
    note: typeof SWEET_STACK_MAX !== 'undefined' ? SWEET_STACK_MAX : n('SWEET_STACK_MAX'),
    kenshi: typeof KENSHI_COMBO_POWER_MAX !== 'undefined' ? KENSHI_COMBO_POWER_MAX : null,
    rengoku: typeof KYUBI_RENGOKU_MAX !== 'undefined' ? KYUBI_RENGOKU_MAX : null,
    kitsunebi: typeof KITSUNEBI_MAX !== 'undefined' ? KITSUNEBI_MAX : null,
    roar: typeof TACTICS_ROAR_MAX_STACKS !== 'undefined' ? TACTICS_ROAR_MAX_STACKS : null,
    kagero: 1, konjo: 1, avoid: 2, counter: 3, thunder: 5, voltage: 10, chuuniCut: 2,
  };
  return Number.isFinite(table[kind]) ? table[kind] : null;
};
// 残りターンで数えるもの(BATTLE_STACK_MARKS の unit:'T')。exTurns は EX の要素の turnsLeft と同じなので出さない
const listTacticsStackItems = (counts, { keepZero = ['cookie', 'note'] } = {}) => {
  const marks = typeof BATTLE_STACK_MARKS !== 'undefined' ? BATTLE_STACK_MARKS : {};
  return Object.entries(counts && typeof counts === 'object' ? counts : {}).reduce((out, [kind, raw]) => {
    if (kind === 'exTurns') return out;
    const count = Math.max(0, Math.floor(Number(raw) || 0));
    if (count <= 0 && !keepZero.includes(kind)) return out;
    const m = marks[kind] || TACTICS_STACK_EXTRA[kind];
    if (!m) return out;
    const isTurns = m.unit === 'T';
    out.push({ key: `stack:${kind}`, name: m.label || kind, icon: m.mark || '', kind: 'stack', count, max: isTurns ? null : tacticsStackMaxOf(kind),
      turnsLeft: isTurns ? count : null, pct: null, fromName: '', fromSlot: null, allAllies: false, note: (TACTICS_STACK_EXTRA[kind] && TACTICS_STACK_EXTRA[kind].note) || '' });
    return out;
  }, []);
};

// ---- 本編(5つの遊び)とタクティクスの EX 以外: 強化の札(71 の battleBuffChips)・敵の弱化(60 の enemyDebuffs)を同じ形に直す ----
// 2026-10-29 社長「効果の札を本編にも足す」。本編には EX が無いので、固有技・アシカ・勇者特性・ブリーダーの教えで付く物は
// いまの強化の札(chip)がすべて数え上げている。それを読んで並べ直すだけ(効き目は変えない)。
//   chip … { key, label, value, short, owner(その子だけに効く札の枠・全員なら null) } / debuff … { key, label, value, short, note }
//   札の種類を足したら、下の表にも足す(tools/battle/battle-effects-check.js が見張る)
// turns … 'now'(このターンだけ) / 'next'(次のターン) / 'run'(ランのあいだ・WAVE をまたぐ) / 'wave'(この WAVE)
const CLASSIC_CHIP_VIEW = Object.freeze({
  atk:          { icon: '⚔️', turns: 'run' },  dmgCut:     { icon: '🛡️', turns: 'run' },  def:        { icon: '🛡️', turns: 'run' },
  muaHp:        { icon: '❤️', turns: 'run' },  muaGuts:    { icon: '⚡', turns: 'run' },  critRate:   { icon: '🎯', turns: 'run' },
  critDmg:      { icon: '💥', turns: 'run' },  combo:      { icon: '💫', turns: 'run' },  globalCombo:{ icon: '💫', turns: 'run' },
  kikiCard:     { icon: '🃏', turns: 'count' }, kyukoCut:  { icon: '🎼', turns: 'count' }, kenshi:    { icon: '💥', turns: 'run', stack: 'kenshi' },
  autoHp:       { icon: '💚', turns: 'run' },  autoGuts:   { icon: '⚡', turns: 'run' },  poltz:      { icon: '🌿', turns: 'run' },
  trick:        { icon: '🎃', turns: 'wave', stack: ['trickAtk', 'trickDef', 'trickRegen'] }, sweet: { icon: '🍪', turns: 'run', stack: ['cookie', 'note'] },
  bow:          { icon: '🎀', turns: 'run', stack: 'bow' }, fate: { icon: '🪙', turns: 'run', stack: ['fateCombo', 'fateAtk'] },
  fateCoinGuts: { icon: '🪙', turns: 'run', kind: 'debuff' },
  meloso:       { icon: '💖', turns: 'next' }, boost:      { icon: '✨', turns: 'now' },  critFix:    { icon: '🎯', turns: 'now' },
  zeroGuts:     { icon: '⭐', turns: 'now' },  reflectNext:{ icon: '🔁', turns: 'next' }, reflectNow: { icon: '🔁', turns: 'now' },
  takenNext:    { icon: '🛡️', turns: 'next' }, takenNow:  { icon: '🛡️', turns: 'now' },
  costNext:     { icon: '⚡', turns: 'next', kind: 'debuff' }, costNow: { icon: '⚡', turns: 'now', kind: 'debuff' },
});
const CLASSIC_DEBUFF_VIEW = Object.freeze({
  shell: 'wave', ice: 'wave', confuse: 'count', aquaPrison: 'count', aquaFreeze: 'count', aquaFinale: 'count', nightmare: 'count', psycho: 'count',
  fateAtkDown: 'count', fateTakenUp: 'count', stun: 'next', atkDown: 'wave', taken: 'wave', roar: 'wave',
});
// 札の key は「種類+枠」(trick0・sweetparty など)のことがあるので、表の種類へ戻す
const classicChipKindOf = (key) => {
  const k = String(key || '');
  if (CLASSIC_CHIP_VIEW[k]) return k;
  return ['trick', 'sweet', 'bow', 'fate'].find((p) => k.startsWith(p) && !CLASSIC_CHIP_VIEW[k]) || null;
};
const classicPctOf = (text) => { const m = String(text || '').match(/([+\-−]?)(\d+)%/); return m ? Number(m[2]) * (m[1] === '-' || m[1] === '−' ? -1 : 1) : null; };
const classicTurnsLeftOf = (text, turns) => {
  const m = String(text || '').match(/残り(\d+)T/);
  if (m) return Number(m[1]);
  return turns === 'now' || turns === 'next' ? 1 : turns === 'wave' ? 'wave' : null;
};
// 枠ごとの一覧(本編)。chips は battleBuffChips() の戻り値。stackCounts を渡すと、札に無い溜まる物を kind:'stack' で足す
const classicEffectsFromChips = (chips, slot = null, stackCounts = null) => {
  const out = [], covered = new Set();
  (Array.isArray(chips) ? chips : []).forEach((c) => {
    if (!c) return;
    const owner = Number.isInteger(c.owner) ? c.owner : null;
    if (owner != null && Number.isInteger(slot) && owner !== slot) return;
    const kind = classicChipKindOf(c.key), v = kind ? CLASSIC_CHIP_VIEW[kind] : null;
    if (!v) return;
    [].concat(v.stack || []).forEach((s) => covered.add(s));
    const text = [c.value, c.short].filter(Boolean).join(' ');
    out.push({ key: `chip:${c.key}`, name: c.label || '', icon: v.icon, kind: v.kind || 'buff', pct: classicPctOf(c.value),
      fromName: '', fromSlot: owner, turnsLeft: classicTurnsLeftOf(text, v.turns), allAllies: owner == null,
      note: `${c.value || ''}${v.turns === 'next' ? '(次のターン)' : v.turns === 'now' ? '(このターン)' : v.turns === 'run' ? '(このランのあいだ)' : ''}` });
  });
  const counts = Object.fromEntries(Object.entries(stackCounts && typeof stackCounts === 'object' ? stackCounts : {}).filter(([k]) => !covered.has(k)));
  return [...out, ...listTacticsStackItems(counts, { keepZero: [] })];
};
// 敵の一覧(本編もタクティクスも)。debuffs は 60 の enemyDebuffs。stackCounts は enemyStackCounts(弱化の一覧と同じ物は出さない)
//   withoutEx … タクティクスで true にすると、EX から付く弱化(listTacticsExEnemyEffects が出す物)を外す(二重に出さない)
const CLASSIC_DEBUFF_FROM_EX = Object.freeze(['psycho', 'aquaPrison', 'aquaFreeze', 'aquaFinale', 'nightmare']);
const classicEnemyEffectsFromDebuffs = (debuffs, stackCounts = null, { withoutEx = false } = {}) => {
  const out = [];
  (Array.isArray(debuffs) ? debuffs : []).forEach((d) => {
    if (!d || !CLASSIC_DEBUFF_VIEW[d.key] || (withoutEx && CLASSIC_DEBUFF_FROM_EX.includes(d.key))) return;
    const turns = CLASSIC_DEBUFF_VIEW[d.key];
    out.push({ key: `debuff:${d.key}`, name: d.label || '', icon: d.mark || '', kind: 'debuff', pct: classicPctOf(d.value),
      fromName: '', fromSlot: null, turnsLeft: classicTurnsLeftOf(`${d.value || ''} ${d.short || ''}`, turns), allAllies: false, note: d.note || d.value || '' });
  });
  const covered = new Set(['aquaPrison', 'aquaFreeze', 'roar'].filter((k) => out.some((x) => x.key === `debuff:${k}`)));
  const counts = Object.fromEntries(Object.entries(stackCounts && typeof stackCounts === 'object' ? stackCounts : {}).filter(([k]) => !covered.has(k)));
  return [...out, ...listTacticsStackItems(counts, { keepZero: [] })];
};
