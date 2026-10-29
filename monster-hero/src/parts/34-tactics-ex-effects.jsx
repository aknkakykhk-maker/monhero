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
