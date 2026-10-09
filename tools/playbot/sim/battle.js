// 簡易シミュレーター: タクティクスプロを、ブラウザなしで 1 ラン(WAVE 1〜10)まるごと回す。
//
//   node tools/playbot/sim/battle.js --diff Hard,Expert,Master --runs 300 --ex bot,best [--seed 1] [--max-wave 10] [--md <file>]
//     --ex … EX の使い方。bot(いまのボットの決め方 = tactics-brain.js maybeUseEx と同じ条件)・
//            best(上手な使い方)・none(EX を使わない)。カンマ区切りで並べると全部回して並べる(「bot|best」とも書ける)
//   SIM_TRACE=1 を付けると、1ターンごとの経過(予告・EX・使ったカード・与ダメ・ライフ/ガッツ)を出す
//   const { simulateRun } = require('./battle'); simulateRun({ heroId, allies:[id…], difficulty, seed, maxWave, exMode })
//
// ★式はゲームのコードから写す(作り変えない)。純粋な部品(createBattleEnemy・chooseEnemyAction・
//   resolveTacticsGuardedHit・buildAttackHits・EX の状態の関数(32-tactics-units.jsx の 1011〜2408 行)など)は
//   load-game.js でそのまま動かし、React の中(60-app.jsx)にある式だけをここへ行番号つきで写した。
//   行番号は 2026-10-10 の 60-app.jsx(21552 行)のもの。
// ★2 版目(2026-10-10)で入れたもの(社長の決まり「スキル系もちゃんと見て判断して」):
//   - EX 26 体ぶん(effect 23 種)。発動・持続・回数・併用(その子だけカードを使えない)を 32 の関数で数える
//   - 固有技の「次のターンから」「WAVE 限定」「ずっと続く」効果(permaBuffs / waveBuffs / nextTurnBuffs を持つ)
//   - 勇者特性すべて(ステータスの持ち主は「その枠の子」。連撃系の勇者だけのものは buildAttackHits が heroId で見分ける)
//   - 間合い: 勇者モンはいちばん得意な枠、供モンは空いた枠のうち得意なもの。引き寄せはボット(decidePick の pull)に合わせた
// ★3 版目(2026-10-10)でアシストカード(アシカ)を入れた: WAVE の合間に選んで習得・強化する流れ(60-app.jsx 14673・14812・14860)と、
//   手札に入って使ったときの効果 10 枚ぶん(processTurn 12437〜12527・ポルツの消化 11224・メロソの全回復 11878・ききの枚数 9162/12939)。
//   選び方は simulateRun({ assist }) で 'bot'(いまのボット tactics-brain.js 649 と同じ点数)・カードの id(そのカードを優先)・'none'(選ばない)。
//   戦いの中の使い方は assistPlay で 'bot'(tactics-brain.js decidePick 245〜289 と同じ条件)・'best'(上手な使い方)
// ★まだ入れていないもの: トレーニング(倒れた子を起こすのも無し)・魂格・固有技の強化・
//   WAVE 報酬の間合いボーナス(distDmgBonus)・緊急回復。近似したものは md の頭(APPROX)に書く。
const fs = require('fs');
const path = require('path');
const { loadGame } = require('./load-game');

const G = loadGame();
const MONS = Object.values(G.ALL_PLAYER_MONSTERS).filter((m) => m && !m.debugOnly);
const MON_BY_ID = Object.fromEntries(MONS.map((m) => [m.id, m]));
const TRACE = !!process.env.SIM_TRACE;

// 近似したもの・入れなかったもの(md の頭へそのまま出す)
const APPROX = [
  'パンドラの箱の「最後の希望」の反動(次の1ターン動けない)は、ゲームと同じく nextTurnBuffs へ書く(ターン終わりの入れ替えのあとに書くので、実際に止まるのはその次のターン)',
  '氷海の支配者(人魚3体の勇者特性)の「敵と同じ距離」は、ターンの始めの敵の距離で見る(ゲームも描き直し前の enemyDist を見る)',
  'ゲームは1ターンのあいだ permaBuffs・waveBuffs・turnBuffs を「ターンの始めの値」で読む(React の state)。ここもターンの始めに写しを取って読む。ref で持つもの(EX の状態・クッキー・黒音符・運命の輪・運命のコイン/輪の積み)はその場の値',
  'スネグーラチカのプレゼント・コイン・輪・乱心などの乱数は seed 付きの乱数で引く',
  '剣士モッチーの初期スタイルは片手剣(配置の画面で選べる初期スタイルは選ばない)。bot は EX で二刀流へ、best は勇者なら二刀流・供モンなら片手盾へ切り替える',
  'ボットの「見込みのダメージ」は画面の数字を読むが、ここでは同じ式(getDmg・被ダメージ)で出す',
  '緊急回復・トレーニング・魂格・WAVE 報酬・固有技の強化は入れていない(実戦より弱く出る)',
  'アシカのポルツは「味方のだれかが敵の攻撃を受けた・ガードで受け止めた」ターンに1回ぶん消化する(ゲームは handleEnemyTurn の tookEnemyAttack)',
  'アシカのみゅあ・かどみうむ・ももすけの上限アップは、そのカードの回復のあとで1体ずつの上限へ掛ける(ゲームは permaBuffs が変わったあとの useEffect で掛ける)',
  'アシカを選ぶ画面の並び(Math.random の混ぜ方)は seed 付きの乱数で引く。ボットの「ガッツ不足」の数え方は、ガッツが足りずに置けない攻撃カードがあるターンに、ガッツ35%未満の子を1ずつ数える',
];
const APPROX_ASSIST_MISSING = [
  'アシカの演出(fireTeachingFx)・ポップアップの文字は数えない(効果だけ)',
  'デバッグの「すべて解放」と同じく、10 枚すべてを選べる前提(ふだんのプレイは編成の6枚から)',
  'EXTREME などの効果倍率(effMul の難易度ぶん)は無い。同じ子が1ターンに2枚目を使ったときの半分(×0.5)だけを数える',
];

// ---------- 乱数(seed 付き) ----------
function mulberry32(a) {
  let t = a >>> 0;
  return () => { t = (t + 0x6D2B79F5) >>> 0; let r = Math.imul(t ^ (t >>> 15), 1 | t); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
function hashSeed(...parts) {
  let h = 2166136261;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- 総合力 ----------
// 11-masu-progression.jsx monsterPowerParts(1865)から。素のベースモンなので魂格(soul)は0
function monsterPowerOf(mon) {
  if (!mon) return 0;
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const W = G.MONSTER_POWER_STAT_WEIGHT;
  const stat = num(mon.baseHp) * W.hp + num(mon.baseAtk) * W.atk + num(mon.baseDef) * W.def + num(mon.baseGuts) * W.guts;
  const apt = (Array.isArray(mon.distAptitude) ? mon.distAptitude : []).slice(0, 4).reduce((s, g) => s + (G.MONSTER_POWER_APTITUDE[g] ?? 0), 0);
  const uniques = G.monsterPowerUniques(mon);
  const uniquePower = uniques.length * G.MONSTER_POWER_UNIQUE_OWNED
    + uniques.reduce((s, u) => s + Math.max(0, Math.floor(num(u.evoLevel))), 0) * G.MONSTER_POWER_UNIQUE_PER_LEVEL;
  return Math.round(stat + apt + uniquePower);
}

// ---------- 間合い ----------
const APT_CACHE = new Map();
const aptPctOf = (mon) => { // 60-app.jsx tacticsSlotApt(1185)。Hard〜Master は特殊ルール無し(null)
  if (!APT_CACHE.has(mon.id)) APT_CACHE.set(mon.id, G.getMonsterAptPct(mon, null, 1));
  return APT_CACHE.get(mon.id);
};
// computeAtkTier(13608)の段階のしきい
const ATK_TIER_THRESHOLDS = [0, 15, 20, 25, 30, 40, 50, 75, 100];
// 60-app.jsx computeAtkTier(13609): 敵がいる距離の枠に立つ子の適性(+ distDmgBonus。ここでは0)で通常技・距離撃の段階が決まる
function computeAtkTier(mons, dist) {
  const mon = mons[dist];
  if (!mon) return 0;
  const pct = (aptPctOf(mon)[dist] || 0) * 100;
  let lvl = 0;
  for (let i = ATK_TIER_THRESHOLDS.length - 1; i >= 0; i--) { if (pct >= ATK_TIER_THRESHOLDS[i]) { lvl = i; break; } }
  return Math.max(0, Math.min(G.BASE_ATK_EVOLUTION.length - 1, lvl));
}
// 60-app.jsx computeGuardLevel(13620)・guardLevelDef(1422)(タクティクスはいちばん硬い子の丈夫さ)
const computeGuardLevel = (defVal) => Math.max(0, Math.min(G.GUARD_EVOLUTION.length - 1, Math.floor((defVal || 0) / 100)));
// 60-app.jsx guardCardCount(13516)
const guardCardCount = (guardLv) => Math.min(4, 2 + Math.floor(Math.max(0, guardLv || 0) / 2));

// 60-app.jsx buildDeck(13520)を簡略化: 通常技2枚・ガード・各子の距離撃1枚・固有技1枚(強化Lv0)。アシストカードは入れない
function buildDeck(mons, aLvl, gLvl, rng, teachings = []) {
  const pool = [];
  const atk = G.BASE_ATK_EVOLUTION[aLvl];
  pool.push({ ...atk, type: 'atk', name: '通常技' }, { ...atk, type: 'atk', name: '通常技' });
  for (let i = 0; i < guardCardCount(gLvl); i++) pool.push({ ...G.GUARD_EVOLUTION[gLvl], type: 'guard' });
  mons.forEach((m, idx) => {
    if (!m) return;
    const revo = G.RANGE_EVOLUTION[aLvl];
    pool.push({ name: `${G.RANGE_LABELS[idx]}${revo.name}`, type: 'range_atk', rangeIdx: idx, guts: revo.guts, baseGuts: revo.baseGuts, mult: revo.mult, baseMult: revo.baseMult, crit: revo.crit, evoLevel: aLvl });
    const u = m.unique;
    if (u) pool.push({ ...u, name: u.names ? u.names[0] : u.name, type: 'unique', guts: u.guts || u.baseGuts, baseGuts: u.baseGuts, baseMult: u.baseMult, evoLevel: 0, monId: u.monId || m.id, crit: 0.10, ownerSlotIdx: idx });
  });
  // 60-app.jsx buildDeck(13544): 持っているアシカを1枚ずつ(名前は段の名前・消費ガッツ 20)
  teachings.forEach((t) => pool.push({ ...t, name: G.BREEDER_EVO_NAMES[t.id][Math.min(t.evoLevel || 0, 2)], guts: 20, teach: true }));
  return shuffle(pool, rng);
}
// 60-app.jsx applyAtkTierChoice(13587): 敵の距離が変わったら、通常技・距離撃を段階に合わせ直す
function patchAtkTier(card, lvl) {
  if (card.type === 'atk') return { ...card, ...G.BASE_ATK_EVOLUTION[lvl] };
  if (card.type === 'range_atk') { const r = G.RANGE_EVOLUTION[lvl]; return { ...card, guts: r.guts, baseGuts: r.baseGuts, mult: r.mult, baseMult: r.baseMult, crit: r.crit, evoLevel: lvl }; }
  return card;
}

// ---------- いまの状態を読む入口(60-app.jsx の「〜Now」たちを、st を受け取る形にしたもの) ----------
const nowOf = (st) => ({ wave: st.wave, turn: st.turn });
const isAttackType = (c) => !!c && ['atk', 'range_atk', 'unique'].includes(c.type);
const unitAt = (st, slot) => G.normalizeTacticsUnit(st.units[slot]);
// 60-app.jsx tacticsExEffectAt(10562)
const exEffectAt = (st, slot) => { const u = st.units[slot]; return u ? G.tacticsExActiveEffect(st.ex, slot, u.id, nowOf(st)) : null; };
// 60-app.jsx tacticsExStyleAt(10569)
const exStyleAt = (st, slot) => { const u = st.units[slot]; return u ? G.tacticsExActiveStyle(st.ex, slot, u.id, nowOf(st)) : null; };
// 60-app.jsx tacticsBattleUnit(10703): 捨て身・片手盾・二刀流・EX のちから/丈夫さ・味方全員の強化を乗せた1体
const battleUnit = (st, slot) => { const u = st.units[slot]; return u ? G.applyTacticsExStats(G.normalizeTacticsUnit(u), st.ex, slot, nowOf(st)) : u; };
// 60-app.jsx tacticsCoverSlotNow(10712)・tacticsTargetsNow(10716)
const coverSlotNow = (st) => G.tacticsExCoverSlot(st.ex, st.units, nowOf(st));
const targetsNow = (st, intent, dist) => G.coverTacticsTargets(G.tacticsIntentTargets(intent, st.units, dist), coverSlotNow(st));
// 60-app.jsx cookieEffectNow(1071): 立っているメロディーのうち、いちばん多い子のクッキー
const cookieNow = (st) => G.cookieEffectOf(G.tacticsAliveSlots(st.units)
  .filter((i) => (G.sweetStackTraitOf(st.units[i].id) || {}).kind === 'cookie')
  .reduce((most, i) => Math.max(most, G.sweetStackCountOf(st.sweet[i])), 0));
// 60-app.jsx blackNoteEffectAt(1078): 黒音符は持ち主本人の攻撃だけ
const blackNoteAt = (st, slot, actorId) => {
  const owner = st.units[slot] ? st.units[slot].id : null;
  return G.blackNoteEffectOf((G.sweetStackTraitOf(owner) || {}).kind === 'note' && actorId === owner ? G.sweetStackCountOf(st.sweet[slot]) : 0);
};
// 60-app.jsx gainSweetStack(1060)
function gainSweetStack(st, slot, actorId, card, hit = false) {
  const owner = st.units[slot] ? st.units[slot].id : null;
  const gain = G.sweetStackGainOf(owner, actorId, card, hit);
  if (gain > 0) st.sweet[slot] = G.addSweetStack(st.sweet[slot], gain);
}
// 60-app.jsx tacticsExPartyBuffNow(10685)
function partyBuffNow(st) {
  const now = nowOf(st);
  const volt = G.tacticsExVoltageOf(st.ex, st.units, now);
  const pres = G.tacticsExPresentOf(st.ex, st.units, now);
  const box = G.tacticsExCookieBoxOf(st.ex, st.units, now);
  return { dmg: (volt ? volt.dmgMult : 1) * pres.dmg * box.dmgMult, critRate: pres.critRate, taken: pres.taken * box.takenMult, heal: volt ? volt.healMult : 1,
    gutsAdd: volt ? volt.gutsAdd : 0, hpAdd: volt ? volt.hpAdd : 0, combo: pres.combo };
}
// 60-app.jsx tacticsExPsychoLockNow(10598): サイコロックオン+アクアフィールド+悪夢全開の敵の被ダメ
function psychoNow(st) {
  const now = nowOf(st);
  const p = G.tacticsExPsychoLockOf(st.ex, now);
  const aq = G.tacticsExAquaOf(st.ex, st.units, now);
  const withAqua = aq.active ? { ...p, enemyDmgMult: p.enemyDmgMult * aq.enemyDmgMult, enemyTakenBonus: p.enemyTakenBonus + aq.enemyTakenBonus } : p;
  const nm = G.tacticsExNightmareEnemyOf(st.ex, st.units, now);
  return nm.enemyTaken > 0 ? { ...withAqua, enemyTakenBonus: withAqua.enemyTakenBonus + nm.enemyTaken } : withAqua;
}
// 60-app.jsx tacticsExCrossMultNow(10646): 予告した攻撃がハムを狙っていて、カウンターが効いていれば 2×カウンター
function crossMultNow(st, slot) {
  if (!st.aim || !st.aim.intent || !targetsNow(st, st.aim.intent, st.aim.dist).includes(slot)) return 1;
  return G.tacticsExCounterMult(st.ex, st.units, slot, nowOf(st));
}
// 60-app.jsx tacticsExMultiBuffNow(10665)
function multiBuffNow(st, slot) {
  const now = nowOf(st);
  const mine = G.tacticsExMultiBuffOf(st.ex, st.units, slot, now);
  const out = mine ? { ...mine } : { dmg: 1, taken: 1, critRate: 1, critAdd: 0, critDmg: 1, distMult: 0, uniqueCrit: false };
  const party = partyBuffNow(st);
  out.dmg *= party.dmg; out.critRate *= party.critRate;
  out.dmg *= crossMultNow(st, slot);
  out.dmg *= G.tacticsExSpringDmgMult(st.ex, st.units, slot, now);
  return out;
}
// 60-app.jsx tacticsExPandoraDevilNow(10679)
function pandoraDevilNow(st, slot) {
  const d = G.tacticsExPandoraDevil(st.ex, st.units, slot, nowOf(st), false);
  return d ? { dmg: d.dmg, combo: d.combo } : { dmg: 1, combo: null };
}
// 60-app.jsx tacticsExCombosAt(10589)
function exCombosAt(st, slot, card) {
  const own = G.tacticsExExtraCombosAt(st.ex, st.units, slot, nowOf(st));
  const gift = partyBuffNow(st).combo;
  const devil = card && card.type === 'unique' ? pandoraDevilNow(st, slot).combo : null;
  const list = [own, gift, devil].filter(Boolean);
  return list.length === 0 ? null : (list.length === 1 ? list[0] : list);
}
// 60-app.jsx tacticsCritFixedNow(10580): 乱心の「意味不明」のターン・ピクシーの固有技・ゴーストの完全回避が残っているあいだ
function critFixedNow(st, slot, card) {
  if (st.intent && st.intent.type === 'CONFUSED') return true;
  if (card && card.type === 'unique' && multiBuffNow(st, slot).uniqueCrit) return true;
  return G.tacticsExAvoidLeftOf(st.ex, st.units, slot, nowOf(st)) > 0;
}
const exLockedSlots = (st) => { // 60-app.jsx tacticsExLocked(10541): 併用できない EX を使った子・パンドラの反動
  const now = nowOf(st);
  return [0, 1, 2, 3].filter((i) => G.isTacticsExCardLocked(st.ex, i, now) || G.tacticsSlotTurns((st.turnB || {}).bySlot, i, 'pandoraLockTurns') > 0);
};

// ---------- 60-app.jsx から写した式 ----------
// 60-app.jsx getCardGuts(9217)。sn はターンの始めの permaBuffs の写し、st.turnB は turnBuffs
function getCardGuts(st, card, slot) {
  if (!card) return 0;
  const perma = st.snap.perma; const turnB = st.turnB || {};
  let cost = card.type === 'guard' ? 0 : 20;
  if (cost > 0 && isAttackType(card)) {
    let baseMult, curMult, baseGuts;
    if (card.type === 'unique') { const level = card.evoLevel || 0; baseMult = card.baseMult; curMult = card.baseMult + level * 0.5; baseGuts = card.baseGuts; }
    else { curMult = card.mult; baseMult = card.baseMult; baseGuts = card.baseGuts; }
    if (baseMult > 0) cost = Math.floor(baseGuts * (curMult / baseMult));
    if (card.type === 'unique' && (card.monId === 'Ark' || card.monId === 'Iblis')) cost = Math.floor(cost * (1 + 0.1 * (perma.chuuniUniqueStack || 0)));
    if (card.type === 'unique' && card.monId === G.FATE_COIN_MONSTER_ID) cost = Math.floor(cost * G.fateCoinGutsMult(st.fate)); // livePermaBuff
  }
  const bySlot = turnB.bySlot || null;
  if ((turnB.zeroGuts || G.tacticsSlotFlag(bySlot, slot, 'zeroGuts')) && isAttackType(card)) cost = 0;
  cost = Math.floor(cost * (turnB.gutsCostMult || 1) * G.tacticsSlotRate(bySlot, slot, 'gutsCostMult', 1.0));
  if (cost > 0 && ((turnB.pandoraResonanceTurns || 0) > 0 || G.tacticsSlotTurns(bySlot, slot, 'pandoraResonanceTurns') > 0)) cost = Math.floor(cost * 0.5);
  cost = Math.floor(cost * Math.max(0.1, 1 - 0.03 * (perma.snegurochkaGutsDiscountStacks || 0)));
  return cost;
}

// 60-app.jsx getDmg(11057)。攻撃した子のちから・その子の特性・その子の間合い適性・EX・固有技の効果
function getDmg(st, card, slot, additionalOryo, additionalDmgMod, halved, attackStartDist, skillDmgMult = 1) {
  if (!card || ['guard', 'draw', 'buff', 'heal', 'weak_guard'].includes(card.type)) return 0;
  const mon = st.mons[slot];
  const perma = st.snap.perma;
  const distDiff = Math.abs(slot - attackStartDist);
  const mb = multiBuffNow(st, slot);
  const distMult = exEffectAt(st, slot) === 'distMatch' ? G.TACTICS_EX_DIST_MATCH_MULT : (mb.distMult > 0 ? mb.distMult : ([1.5, 1.3, 1.1, 0.9][distDiff] || 1.0));
  let baseDmgMult;
  if (card.subType === 'stun_atsu') baseDmgMult = card.baseValue || 1.5; // 60-app.jsx getDmg 11064(あつの挑発)
  else if (card.type === 'unique') { const chuuniBonus = (card.monId === 'Ark' || card.monId === 'Iblis') ? 0.1 * (perma.chuuniUniqueStack || 0) : 0; baseDmgMult = card.baseMult + (card.evoLevel || 0) * 0.5 + chuuniBonus; }
  else if (card.type === 'range_atk') baseDmgMult = G.rangeAttackDamageMultiplier(card, attackStartDist);
  else baseDmgMult = card.mult || card.baseMult || 1.0;
  const id = mon.id;
  let traitMult = (id === 'Golem' ? 1.2 : 1.0) * ((id === 'Pixie' || id === 'Mia') && card.type === 'unique' ? 2.0 : 1.0);
  if (id === 'Pandora' && card.type === 'unique' && card.monId !== 'Pandora') traitMult *= 1.5; // 禁忌解錠(引き継いだ固有技。ここでは出ない)
  const distBonusMult = 1.0 + (aptPctOf(mon)[slot] || 0);
  const totalBuffMult = traitMult * cookieNow(st).dmgMult * blackNoteAt(st, slot, id).dmgMult * G.bowAtkMultOf(st.bow[slot])
    * mb.dmg * (card.type === 'unique' ? pandoraDevilNow(st, slot).dmg : 1)
    // 60-app.jsx 11086: みゃるの薬(getTurnBuff atkMult・tacticsSlotAtkMult)と、みゅあの muaAtkPct
    * ((st.turnB || {}).atkMult || 1) * G.tacticsSlotRate((st.turnB || {}).bySlot, slot, 'atkMult', 1.0)
    * (1.0 + (perma.atkPct || 0) + (perma.muaAtkPct || 0) + additionalOryo) * distBonusMult;
  const attackerAtk = Math.max(0, G.normalizeTacticsUnit(battleUnit(st, slot)).atk) * G.trickStartAtkMult(st.trick[slot]) * G.fateAtkMult(st.fate, slot);
  const enemyTaken = (st.snap.wave.enemyTakenDmgBonus || 0) + G.fateWheelEnemyTakenBonus(st.fateWheel) + psychoNow(st).enemyTakenBonus + additionalDmgMod;
  let d = Math.floor(attackerAtk * distMult * baseDmgMult * (skillDmgMult > 0 ? skillDmgMult : 1) * totalBuffMult * (1.0 + enemyTaken));
  if (halved) d = Math.floor(d * 0.5);
  return d;
}

// 60-app.jsx getIncomingDamageBeforeTurnReduction(10331)。狙われた子の丈夫さ・特性・敵の弱体
function incomingFor(st, intent, slot, { chuuniActive = (st.snap.wave.chuuniDmgCutUses || 0) < 2 } = {}) {
  if (!intent || (intent.type !== 'ATTACK' && intent.type !== 'SPECIAL')) return 0;
  const wave = st.snap.wave; const perma = st.snap.perma;
  const atkVal = Math.floor(intent.value * (1.0 - (wave.enemyAtkDebuffPct || 0)) * G.fateWheelEnemyAtkMult(st.fateWheel));
  const unit = G.normalizeTacticsUnit(battleUnit(st, slot));
  const id = unit ? unit.id : null;
  const defVal = (unit ? G.resolveEffectiveMaxStat(unit.def, perma.defPct || 0) : 0) * G.trickStartDefMult(st.trick[slot]);
  const defenseRate = Math.min(0.5, defVal * 0.00015);
  const chuuni = chuuniActive && (id === 'Ark' || id === 'Iblis');
  const dmgBase = Math.max(30, (atkVal - defVal * 0.5) * (1 - defenseRate)) * ((id === 'Mocchi' || id === 'Mitarashi') ? 0.8 : 1.0)
    * (chuuni ? 0.5 : 1.0) * G.lifeSourceDamageMult(id, st.turn);
  const iceMult = st.snap.iceLockActive ? 0.7 : 1.0; // 60-app.jsx iceLockEnemyDamageMult(10294)
  return Math.max(1, Math.floor(dmgBase * Math.max(0.01, 1.0 - (perma.dmgCutPct || 0)) * iceMult * psychoNow(st).enemyDmgMult));
}
// 60-app.jsx applyTurnDamageReduction(10376)・handleEnemyTurn の applyImmediateTakenReduction(11257)
function turnReduce(st, damage, slot, immBySlot = null) {
  if (!(damage > 0)) return 0;
  const imm = immBySlot && Number(immBySlot[slot]) > 0 ? Number(immBySlot[slot]) : 1;
  const tb = st.turnB || {};
  return Math.max(1, Math.floor(damage * imm * (tb.takenDamageMult || 1) * G.tacticsSlotRate(tb.bySlot, slot, 'takenDamageMult', 1.0)
    * G.tacticsExPartyTakenMult(st.ex, st.units, nowOf(st)) * multiBuffNow(st, slot).taken * partyBuffNow(st).taken * cookieNow(st).takenMult));
}
// 60-app.jsx guardDefFor(10971)・guardValueOf(10977)・tacticsSpreadGuardValue(10986)・tacticsSlotGuardValue(10995)
const guardDefFor = (st, slot) => G.resolveEffectiveMaxStat(G.normalizeTacticsUnit(battleUnit(st, slot)).def, st.snap.perma.defPct || 0) * G.trickStartDefMult(st.trick[slot]);
function slotGuardValue(st, guardBySlot, slot) {
  if (!G.canTacticsSlotAct(st.units, slot)) return 0;
  const val = (flat, mult) => ((flat > 0 || mult > 0) ? Math.floor(flat + guardDefFor(st, slot) * mult) : 0);
  const own = guardBySlot[slot];
  if (own && own.cards > 0) return val(own.flat, own.mult);
  if (G.isTacticsSpreadGuard(guardBySlot)) { const g = G.GUARD_EVOLUTION[st.guardLevel]; return val(g.flat * 0.5, g.mult * 0.5); }
  return 0;
}

// ---------- 敵の予告 ----------
// 60-app.jsx spawnEnemy(13629)・advanceEnemyIntents(10241)・aimTacticsIntent(1320)
const actionState = (st) => ({ definitions: G.enemyActionDefinitionsFor('tacticsPro', st.enemy.id, st.enemy.difficulty, st.enemy.actionCount), roarStacks: st.roarStacks });
const nextAction = (st, dist, last, extra = {}) => G.chooseEnemyAction(st.enemy, dist, st.rng, { ...G.enemyActionStateFrom(last), ...actionState(st), ...extra });
const aim = (st, intent) => G.withTacticsTarget(intent, st.units, st.rng);
const distAfterIntent = (intent, d) => (intent && intent.type === 'MOVE' && Number.isInteger(intent.targetDist)) ? intent.targetDist : d;
function advanceIntents(st, executed, distAfter, performed) {
  const effective = performed ? executed : null;
  let reserved = st.nextIntent;
  if (reserved && reserved.type === 'SPECIAL' && !(performed && executed && executed.type === 'CHARGE')) reserved = null;
  if (reserved && reserved.variant === 'pierce' && !(performed && executed && executed.type === 'PIERCE_CHARGE')) reserved = null;
  if (reserved && reserved.type === 'MOVE' && reserved.targetDist === distAfter) reserved = null;
  const aimed = aim(st, reserved || nextAction(st, distAfter, effective, { unannounced: true }));
  // 乱心(トリックコンフューズ): 残っていれば1つ使い、50%で「意味不明」(60-app.jsx 10251)
  const conf = G.rollEnemyConfusion(aimed, st.confuse, st.rng);
  st.confuse = conf.turns;
  st.intent = conf.intent;
  st.nextIntent = nextAction(st, distAfterIntent(st.intent, distAfter), st.intent && st.intent.type === 'CONFUSED' ? null : st.intent);
}

// ---------- 味方の戦い方(tactics-brain.js decidePick を簡略化) ----------
const TRAIT_EVADE = { Tiger: 50 };
const TRAIT_REFLECT = { Monol: 30 };
const TRAIT_ABSORB = { Oboro: 30, Plant: 30 };
function threatOf(intent) {
  if (!intent) return 'none';
  if (intent.type === 'CHARGE') return 'charge';
  if (intent.type === 'PIERCE_CHARGE') return 'pierceCharge';
  if (intent.type === 'SPECIAL') return intent.targetsAll ? 'all' : 'big';
  if (intent.type !== 'ATTACK') return 'none';
  if (intent.variant === 'pierce') return 'pierce';
  if (intent.variant === 'allout' || intent.targetsAll) return 'all';
  if (intent.variant === 'rush') return 'multi';
  return 'single';
}
// 1ターンに置けるカード(60-app.jsx baseCardLimit 9171・exCardBonus 9181・slotMaxUses 9184)
function cardLimitOf(st) {
  const alive = G.tacticsAliveSlots(st.units);
  let limit = 1;
  if (alive.length >= 3) limit = 3; else if (alive.length >= 2) limit = 2;
  const heroBonus = alive.filter((i) => G.heroCardBonusOf(st.units[i].id) > 0).length;
  const kikiBonus = ((st.snap ? st.snap.perma : st.perma).kikiCardBonusTurns || 0) > 0 ? 1 : 0; // 60-app.jsx kikiCardBonus 9162
  return Math.min(5, Math.min(5, limit + heroBonus + kikiBonus) + G.tacticsExCardBonusTotal(st.ex, st.units, nowOf(st)));
}
const slotMaxUses = (st, slot, cardLimit) => Math.min(cardLimit, 1 + G.heroCardBonusOf(st.units[slot] && st.units[slot].id) + G.tacticsExCardBonusAt(st.ex, st.units, slot, nowOf(st)));
// 予告で狙われている子が受けるダメージの見込み(画面の数字。ターンの軽減まで入れる)
const aimDamageOf = (st, slot) => (targetsNow(st, st.intent, st.dist).includes(slot) ? turnReduce(st, incomingFor(st, st.intent, slot), slot) : 0);

function decideTurn(st) {
  const picks = []; // {hi, slot}
  const discards = [];
  const limit = cardLimitOf(st);
  const locked = exLockedSlots(st);
  const alive = G.tacticsAliveSlots(st.units);
  const actors = alive.filter((s) => !locked.includes(s));
  const spent = {}; const usesBy = {}; const guarded = {};
  const used = new Set();
  const threat = threatOf(st.intent);
  const turnsLeft = Math.max(1, 20 - st.turn + 1);
  const rushing = st.recentDealt > 0 && st.enemy.hp > st.recentDealt * turnsLeft * 0.9;
  const hint = st.hint || {};
  let planned = 0; let stunned = false; let healed = false; let buffed = false;
  const gutsLeft = (slot) => G.normalizeTacticsUnit(st.units[slot]).guts - (spent[slot] || 0);
  const playBest = st.assistPlay === 'best';
  // ボットの「ガッツ不足」の数え方(tactics-brain.js 443〜445): ガッツが足りずに置けない攻撃カードがあるターンに、ガッツ35%未満の子を数える
  if (st.hand.some((c) => isAttackType(c) && !actors.some((s0) => gutsLeft(s0) >= getCardGuts(st, c, s0)))) {
    st.gutsShort += alive.filter((i) => { const u = G.normalizeTacticsUnit(st.units[i]); return u.guts < u.maxGuts * 0.35; }).length;
  }
  const aimed = targetsNow(st, st.intent, st.dist);
  const aimCache = {};
  const aimDamage = (slot) => (slot in aimCache ? aimCache[slot] : (aimCache[slot] = aimDamageOf(st, slot)));
  // 引き寄せ(decidePick 205): いちばんダメージを出している子の距離に敵がおらず、敵のいる距離にだれも立っていないとき、
  // その子の距離の距離撃を3倍に見る。ボットの ctx.mainDist は「このランでいちばんダメージを出した子」の枠
  const top = alive.slice().sort((p, q) => (st.dmgBySlot[q] || 0) - (st.dmgBySlot[p] || 0))[0];
  const mainDist = top != null && (st.dmgBySlot[top] || 0) > 0 ? top : st.heroSlot;
  const wantPull = mainDist != null && st.dist !== mainDist && !alive.includes(st.dist);
  while (picks.length + discards.length < limit) {
    const left = limit - picks.length - discards.length;
    const atkOpts = []; const guardOpts = []; const supOpts = [];
    st.hand.forEach((card, hi) => {
      if (used.has(hi)) return;
      for (const slot of actors) {
        if ((usesBy[slot] || 0) >= slotMaxUses(st, slot, limit)) continue;
        if (card.type === 'unique' && card.ownerSlotIdx !== slot) continue;
        const halved = (usesBy[slot] || 0) > 0;
        if (card.teach) {
          // アシカ。あつの挑発(debuff)はボットと同じく攻撃の候補にも入れる(見込みのダメージが出るため。tactics-brain.js 189)
          const cost = getCardGuts(st, card, slot);
          if (gutsLeft(slot) < cost) continue;
          if (card.subType === 'stun_atsu') {
            const value = Math.floor(getDmg(st, card, slot, 0, 0, false, st.dist) * (halved ? 0.5 : 1));
            atkOpts.push({ hi, card, slot, value, rank: value / Math.pow(Math.max(8, cost), 0.7) * 7, cost, stunCard: true });
          }
          supOpts.push({ hi, card, slot, cost, halved });
          continue;
        }
        if (isAttackType(card)) {
          const cost = getCardGuts(st, card, slot);
          if (gutsLeft(slot) < cost) continue;
          const value = getDmg(st, card, slot, 0, 0, halved, st.dist);
          const unit = G.normalizeTacticsUnit(st.units[slot]);
          const full = unit.guts >= unit.maxGuts * 0.85;
          let rank = full ? value : value / Math.pow(Math.max(8, cost), 0.7) * 7;
          if (card.type === 'range_atk' && wantPull && card.rangeIdx === mainDist) rank *= 3;
          // best の使い方: 回避の EX が効いている子へ敵を引き寄せる・カウンターのハムに殴らせる
          if (hint.mustAttack != null && slot === hint.mustAttack) rank *= 4;
          atkOpts.push({ hi, card, slot, value, rank, cost });
        } else if (card.type === 'guard') {
          const g = G.GUARD_EVOLUTION[st.guardLevel];
          guardOpts.push({ hi, card, slot, value: Math.floor(guardDefFor(st, slot) * g.mult * (halved ? 0.5 : 1)) });
        }
      }
    });
    atkOpts.sort((a, z) => z.rank - a.rank);
    const take = (o, kind) => {
      picks.push({ hi: o.hi, slot: o.slot }); used.add(o.hi);
      usesBy[o.slot] = (usesBy[o.slot] || 0) + 1; spent[o.slot] = (spent[o.slot] || 0) + (o.cost || 0);
      if (kind === 'attack') planned += o.value;
      if (kind === 'guard') guarded[o.slot] = (guarded[o.slot] || 0) + 1;
      if (o.card && o.card.teach) { if (o.card.type === 'heal') healed = true; if (o.card.type === 'buff') buffed = true; }
      if (o.stunCard) stunned = true;
    };
    // アシカの支援: 払うのはガッツのいちばん多い子(tactics-brain.js placePick 296)。半分になる2枚目は避ける
    const supFor = (id) => supOpts.filter((o) => o.card.id === id).sort((a, z) => (a.halved - z.halved) || (gutsLeft(z.slot) - gutsLeft(a.slot)))[0];
    const supOfType = (fn) => { const o = supOpts.filter((x) => fn(x.card)); return o.length ? supFor(o[0].card.id) : null; };
    const aliveNow = G.tacticsAliveSlots(st.units);
    const hpNow = aliveNow.reduce((a, i) => a + G.normalizeTacticsUnit(st.units[i]).hp, 0);
    const hpMax = G.tacticsFilledSlots(st.units).reduce((a, i) => a + G.normalizeTacticsUnit(st.units[i]).maxHp, 0);
    const downedN = G.tacticsFilledSlots(st.units).length - aliveNow.length;
    const gutsRate = (i) => { const u = G.normalizeTacticsUnit(st.units[i]); return u.maxGuts ? gutsLeft(i) / u.maxGuts : 0; };
    const richestG = aliveNow.reduce((m, i) => Math.max(m, gutsRate(i)), 0);
    const leanG = aliveNow.some((i) => gutsRate(i) < 0.35);
    const enemyRate = st.enemy.hp / Math.max(1, st.enemy.maxHp);
    // best: 回避の EX が効いている子へ敵を引き寄せる距離撃は、ほかより先に置く
    if (hint.pullTo != null && !hint.pulled) {
      const p = atkOpts.find((a) => a.card.type === 'range_atk' && a.card.rangeIdx === hint.pullTo);
      hint.pulled = true;
      if (p) { take(p, 'attack'); continue; }
      hint.noGuard = (hint.noGuard || []).filter((s) => s !== hint.pullTo); // 引き寄せられないなら守る
    }
    // ① とどめ
    const lethal = atkOpts.slice(0, left).reduce((s, x) => s + x.value, 0) + planned >= st.enemy.hp;
    if (!lethal) {
      // ② 予告に合わせた守り
      const needFor = (slot) => {
        if (hint.noGuard && hint.noGuard.includes(slot)) return false;
        const u = G.normalizeTacticsUnit(st.units[slot]);
        const dmg = aimDamage(slot);
        if (!u || u.downed || !dmg) return false;
        const deadly = dmg >= u.hp * 0.85; const heavy = dmg >= u.maxHp * 0.45;
        return rushing ? deadly : (deadly || heavy);
      };
      const guardOn = (slot) => guardOpts.filter((g) => g.slot === slot).sort((a, z) => z.value - a.value)[0];
      if (threat === 'multi' || threat === 'single' || threat === 'big') {
        const target = aimed[0];
        if (target != null) {
          const u = G.normalizeTacticsUnit(st.units[target]);
          const want = threat === 'multi' || (threat === 'big' && aimDamage(target) >= u.hp) ? 2 : 1;
          if (needFor(target) && (guarded[target] || 0) < want) { const g = guardOn(target); if (g) { take(g, 'guard'); continue; } }
        }
      }
      if (threat === 'all' && Object.keys(guarded).length < 2) {
        const pool = alive.filter((s) => needFor(s) && !guarded[s]);
        const g = pool.map(guardOn).find(Boolean);
        if (g) { take(g, 'guard'); continue; }
      }
    }
    // ③ 止める(ハムの固有技はスタン)
    if ((threat === 'charge' || threat === 'pierceCharge') && !stunned) {
      const a0 = atkOpts.find((a) => a.stunCard); // tactics-brain.js 246: スタンのカード(あつの挑発)で止める
      if (a0) { take(a0, 'attack'); continue; }
      const s = atkOpts.find((a) => a.card.type === 'unique' && a.card.monId === 'Ham');
      if (s) { take(s, 'attack'); stunned = true; continue; }
    }
    if (!lethal && !playBest) {
      // ④ 回復(tactics-brain.js 250〜254): 倒れた子がいるか、全体のライフが35%未満
      const heal = supOfType((c) => c.type === 'heal');
      if (heal && !healed && (downedN > 0 || (hpMax && hpNow / hpMax < 0.35))) { take(heal, 'support'); continue; }
      // ④' あとから出たアシカ(tactics-brain.js 256〜264)
      const momo = supFor('momosuke'); const kiki = supFor('kiki'); const poltz = supFor('poltz'); const meloso = supFor('meloso');
      if (momo && leanG && !healed) { take(momo, 'support'); continue; }
      if (kiki && !buffed && richestG >= 0.3 && enemyRate > 0.3) { take(kiki, 'support'); continue; }
      if (poltz && !buffed && richestG >= 0.3 && enemyRate > 0.4) { take(poltz, 'support'); continue; }
      if (meloso && !healed && hpMax && hpNow / hpMax < 0.55) { take(meloso, 'support'); continue; }
    }
    if (!lethal && playBest) {
      // 上手な使い方: ずっと続く強化は WAVE の早いうちに(遅いほど効く回数が減る)、回復は細ったとき、薬は火力の柱に飲ませる
      const heal = supFor('mua') || supFor('meloso') || supFor('momosuke');
      const hurtBad = downedN > 0 || (hpMax && hpNow / hpMax < 0.5) || aimed.some((sl) => { const u = G.normalizeTacticsUnit(st.units[sl]); return u && !u.downed && aimDamage(sl) >= u.hp; });
      if (heal && !healed && hurtBad) { take(heal, 'support'); continue; }
      const momo = supFor('momosuke');
      if (momo && !healed && leanG) { take(momo, 'support'); continue; }
      if (enemyRate > 0.3) {
        // 1ターンに1枚まで(buffed)。ききは早いほど手数が増え、ニコラオ・ポルツ・かどみうむ・ドラはバトル中ずっと続く
        const o = buffed ? null : ['kiki', 'oryo', 'poltz', 'cadmium', 'dra'].map(supFor).find((x) => x && !x.halved);
        if (o) { take(o, 'support'); continue; }
      }
      // みゃるの薬: いちばんダメージを出している子に、次のターン撃てるガッツが残るときだけ飲ませる
      const myaru = supOpts.filter((o) => o.card.id === 'myaru' && o.slot === mainDist && !o.halved)[0];
      if (myaru && enemyRate > 0.35) {
        const u = G.normalizeTacticsUnit(st.units[myaru.slot]);
        if (u.hp > u.maxHp * 0.6 && gutsLeft(myaru.slot) - myaru.cost >= u.maxGuts * 0.4 && !aimed.includes(myaru.slot)) { take(myaru, 'support'); continue; }
      }
      // あつの挑発: ためる・貫通の構えのほか、だれかが一撃で倒れる攻撃も止める
      const atsu = atkOpts.find((a) => a.stunCard);
      if (atsu && !stunned && aimed.some((sl) => { const u = G.normalizeTacticsUnit(st.units[sl]); return u && !u.downed && aimDamage(sl) >= u.hp * 0.85; })) { take(atsu, 'attack'); continue; }
    }
    // ⑤ 攻撃。スタンのカード(あつの挑発)は、とどめ・ためる/貫通の構えのとき以外は取っておく(tactics-brain.js 268)
    const keepStun = !lethal && !(threat === 'charge' || threat === 'pierceCharge');
    const atkUse = keepStun ? atkOpts.filter((a) => !a.stunCard) : atkOpts;
    if (atkUse.length) { take(atkUse[0], 'attack'); continue; }
    // ⑦ 捨ててガッツを戻す(ガッツが足りずに使えない攻撃カードがあるとき)
    const starved = st.hand.findIndex((c, hi) => !used.has(hi) && isAttackType(c) && !actors.some((s) => gutsLeft(s) >= getCardGuts(st, c, s)));
    if (starved >= 0) { discards.push(starved); used.add(starved); continue; }
    // ⑥' 攻撃が置けないときは、狙われた子(いなければライフのいちばん減った子)へガード
    if (guardOpts.length && threat !== 'pierce' && threat !== 'none') {
      const want = aimed.find((s) => actors.includes(s)) ?? [...actors].sort((p, q) => {
        const a = G.normalizeTacticsUnit(st.units[p]); const b = G.normalizeTacticsUnit(st.units[q]);
        return a.hp / a.maxHp - b.hp / b.maxHp;
      })[0];
      const g = guardOpts.filter((x) => x.slot === want).sort((p, q) => q.value - p.value)[0];
      if (g && (guarded[want] || 0) < 2) { take(g, 'guard'); continue; }
    }
    // ⑥ 支援(tactics-brain.js 286〜289): 攻撃が置けないとき、自傷の無い強化を1枚。いちばん多い子でもガッツ6割未満なら使わない
    if (!buffed && enemyRate > 0.3) {
      const richest = aliveNow.reduce((m, i) => Math.max(m, gutsRate(i)), 0);
      const buff = supOfType((c) => c.type === 'buff' && c.id !== 'myaru');
      if (buff && (richest >= 0.6 || playBest)) { take(buff, 'support'); continue; }
    }
    break;
  }
  return { picks, discards };
}

// ---------- EX を使う(60-app.jsx activateTacticsEx 12177) ----------
function useEx(st, slot, choice = null) {
  const mon = st.mons[slot];
  if (!mon) return false;
  const def = G.tacticsExDefOf(mon.id);
  if (!def || !G.isTacticsExEffectImplemented(def)) return false;
  const now = nowOf(st);
  const life = unitAt(st, slot);
  const check = G.checkTacticsExUse({ def, state: st.ex, slot, monId: mon.id, alive: G.canTacticsSlotAct(st.units, slot), selectedCount: 0, now, busy: false,
    hp: life ? life.hp : null, maxHp: life ? life.maxHp : null, stacks: G.sweetStackCountOf(st.sweet[slot]), stackLabel: (G.sweetStackTraitOf(mon.id) || {}).label || null });
  if (!check.ok) return false;
  if (def.duration === 'style' && G.checkTacticsExChoice(def, st.ex, slot, mon.id, choice)) return false;
  if (G.checkTacticsExTarget(def, st.units, choice)) return false;
  const spentStacks = def.stackSpend ? G.sweetStackCountOf(st.sweet[slot]) : 0;
  st.ex = G.applyTacticsExUse(st.ex, { def, slot, monId: mon.id, now,
    snapshot: life ? { atk: life.atk, def: life.def, spent: spentStacks, ...(def.effect === 'timeStop' ? { copied: G.tacticsExCopyableBuffs(st.ex, st.units, now, slot) } : {}) } : null,
    choice, target: def.target === 'ally' ? choice : null });
  if (def.lifeSpring && Number.isInteger(choice)) {
    let units = st.units;
    const before = G.normalizeTacticsUnit(units[choice]);
    if (before) {
      const wasDown = before.downed === true;
      if (!wasDown && def.lifeSpring.maxUpRate > 0) units = G.scaleTacticsUnits(G.setTacticsExMaxHpRate(units, choice, def.lifeSpring.maxUpRate), 0, 0);
      const u = G.normalizeTacticsUnit(units[choice]);
      units = G.healTacticsAt(units, choice, Math.max(0, u.maxHp - u.hp));
      const afterHeal = G.normalizeTacticsUnit(units[choice]);
      units = G.recoverTacticsGutsAt(units, choice, Math.max(0, Math.min(afterHeal.maxGuts - afterHeal.guts, Math.floor(afterHeal.maxGuts * def.lifeSpring.gutsRate))));
      st.units = units;
      st.ex = G.setTacticsExSpringKind(st.ex, slot, wasDown);
    }
    // アクアフィールドが広がった瞬間、味方のデバフ(贖罪の消費ガッツ増・パンドラの反動)が消える(60-app.jsx 12219 clearTacticsAllyDebuffs 10614)
    if (def.aqua) ['gutsCostMult', 'pandoraLockTurns'].forEach((key) => {
      if (st.turnB.bySlot) st.turnB = { ...st.turnB, bySlot: G.clearTacticsSlotFlag(st.turnB.bySlot, key) };
      if (st.nextB.bySlot) st.nextB = { ...st.nextB, bySlot: G.clearTacticsSlotFlag(st.nextB.bySlot, key) };
    });
  }
  if (def.lifeCostRate > 0 && life) {
    const cost = G.tacticsExLifeCost(def, life.maxHp);
    if (cost > 0) st.units = G.damageTacticsTargets(st.units, [slot], cost);
  }
  if (def.fullRecover) {
    let units = st.units;
    if (def.rates.hp > 0 || def.rates.guts > 0) units = G.scaleTacticsUnits(G.setTacticsExMaxRate(units, slot, def.rates.hp, def.rates.guts), 0, 0);
    const u = G.normalizeTacticsUnit(units[slot]);
    if (u) st.units = G.recoverTacticsGutsAt(G.healTacticsAt(units, slot, Math.max(0, u.maxHp - u.hp)), slot, Math.max(0, u.maxGuts - u.guts));
  }
  if (def.guaranteeUnique || (def.pandoraBox && def.pandoraBox.guaranteeUnique)) {
    const ens = G.ensureTacticsExUniqueInHand({ hand: st.hand, deck: st.deck, graveyard: st.graveyard }, (c) => c && c.type === 'unique' && c.ownerSlotIdx === slot);
    if (ens.moved) { st.hand = ens.hand; st.deck = ens.deck; st.graveyard = ens.graveyard; }
  }
  if (def.effect === 'present' && def.present) {
    const pc = (st.ex.effects[slot] && st.ex.effects[slot].presentCfg) || def.present;
    const roll = G.rollTacticsExPresent(Array.from({ length: pc.draws * 2 }, () => st.rng()), pc.jackpot, pc.draws);
    st.ex = G.setTacticsExPresent(st.ex, slot, roll);
    st.units = G.rateHealTacticsBoard(st.units, 0, pc.fixedGuts, false).units;
    if (roll.kinds.includes('heal')) st.units = G.rateHealTacticsBoard(st.units, pc.heal, 0, false).units;
    if (roll.kinds.includes('guts')) st.units = G.rateHealTacticsBoard(st.units, 0, pc.guts, false).units;
  }
  if (def.partyHealRate > 0) st.units = G.rateHealTacticsBoard(st.units, def.partyHealRate, def.partyHealRate, false).units;
  if (def.stackSpend) {
    st.sweet[slot] = 0;
    if (def.effect === 'cookieBox' && spentStacks > 0) st.units = G.rateHealTacticsBoard(st.units, def.stackSpend.heal * spentStacks, def.stackSpend.guts * spentStacks, false).units;
  }
  st.exUses[mon.id] = (st.exUses[mon.id] || 0) + 1;
  if (TRACE) console.log(`  EX ${mon.name}「${def.name}」${choice != null ? `(${choice})` : ''}`);
  return true;
}

// ---------- EX の使い方 ----------
// 盤面の見え方(tactics-brain.js readBoard が読むもの)を、シミュレーターの状態から作る
function boardView(st) {
  const threat = threatOf(st.intent);
  const slots = [0, 1, 2, 3].map((i) => {
    const u = st.units[i] ? unitAt(st, i) : null;
    if (!u) return { i, occupied: false };
    const aimDamage = u.downed ? 0 : aimDamageOf(st, i);
    return { i, occupied: true, downed: !!u.downed, id: u.id, hp: { now: u.hp, max: u.maxHp }, guts: { now: u.guts, max: u.maxGuts },
      aimed: targetsNow(st, st.intent, st.dist).includes(i) && !u.downed, aimDamage,
      exActive: G.isTacticsExEffectActive(st.ex, i, u.id, nowOf(st)), def: G.tacticsExDefOf(u.id) };
  });
  const aimedDamage = slots.reduce((s, x) => s + (x.aimDamage || 0), 0);
  return { threat, slots, aimedDamage, enemy: { hp: st.enemy.hp, max: st.enemy.maxHp, dist: st.dist }, wave: st.wave, turn: st.turn };
}
// tactics-brain.js EX_ROLE_BY_EFFECT(323)を写したもの(名簿の effect → 使い方の役目)
const EX_ROLE_BY_EFFECT = {
  statBoost: 'refill', coverAll: 'shield', partyGuard: 'shield', timeStop: 'shield',
  damageBack: 'selfGuard', avoidCharge: 'selfGuard', dodgeCombo: 'dodge', distMatch: 'distBurst', counter: 'counter',
  allIn: 'allIn', lifeSpring: 'heal', cookieBox: 'heal', trickConfuse: 'burst', present: 'present',
  psychoLock: 'burst', thunder: 'burst', multiBuff: 'burst', stage: 'burst', pandoraBox: 'burst', partyBoost: 'burst',
  weaponChange: 'burst', comboBurst: 'burst', nightmareKey: 'burst',
};
// (a) いまのボットの決め方。tactics-brain.js maybeUseEx(356〜)の条件をそのまま写した。
//   botWhy は「使う理由」(使わないなら '')。best からも呼ぶ
function botWhy(st, b, x) {
  const threat = b.threat;
  const bigHit = threat === 'big' || threat === 'all' || threat === 'pierce' || (threat === 'multi' && b.aimedDamage > 0)
    || b.slots.some((y) => y.aimDamage && y.hp && y.aimDamage >= y.hp.now * 0.8);
  const aliveCount = b.slots.filter((y) => y.occupied && !y.downed).length;
  const role = EX_ROLE_BY_EFFECT[x.def.effect] || 'burst';
  if (role === 'shield' && x.id === 'Monol' && aliveCount < 2) return '';
  const enemyFull = b.enemy.hp >= b.enemy.max * 0.5;
  const gutsLow = x.guts.now < x.guts.max * 0.25;
  const hpLow = x.hp.now < x.hp.max * 0.4;
  const late = b.wave >= 5;
  const victim = b.slots.find((y) => y.occupied && !y.downed && y.i !== x.i && y.aimDamage && y.aimDamage >= y.hp.now * 0.5);
  if (role === 'shield' && x.id === 'Monol') return victim && x.hp.now > victim.aimDamage * 0.4 ? 'cover' : '';
  if (role === 'shield' && x.id === 'Yaobikuni') {
    const heavy = (threat === 'big' || threat === 'pierce' || threat === 'all') && b.slots.some((y) => y.occupied && !y.downed && y.aimDamage && y.aimDamage >= y.hp.now * 0.4);
    return heavy ? 'timeStop' : '';
  }
  if (role === 'shield' && bigHit) return 'shield';
  if (role === 'dodge' && x.aimed && b.enemy.dist === x.i && bigHit) return 'dodge';
  if (role === 'refill' && b.enemy.hp >= b.enemy.max * 0.9 && b.turn <= 2 && st.recentWave && b.enemy.max > st.recentWave * 8 && x.guts.now < x.guts.max * 0.7) return 'refill-start';
  if (role === 'refill' && (gutsLow || hpLow) && (hpLow || b.enemy.hp >= b.enemy.max * 0.4)) return 'refill';
  if (role === 'burst' && enemyFull && (late || b.enemy.max >= 3000)) return 'burst';
  if (role === 'selfGuard' && x.aimDamage && x.aimDamage >= x.hp.now * 0.3) return 'selfGuard';
  if (role === 'counter' && x.aimed && threat !== 'pierce' && x.aimDamage < x.hp.now) return 'counter';
  if (role === 'distBurst' && b.enemy.dist === x.i && enemyFull) return 'distBurst';
  if (role === 'allIn' && !x.aimed && !bigHit && enemyFull && (late || b.enemy.max >= 8000) && x.hp.now >= x.hp.max * 0.7 && !st.allInDone[`${x.id}${b.wave}`]) {
    st.allInDone[`${x.id}${b.wave}`] = 1; return 'allIn';
  }
  if (role === 'heal' && b.slots.some((y) => y.occupied && !y.downed && y.hp.now < y.hp.max * 0.4)) return 'heal';
  if (role === 'present' && b.slots.filter((y) => y.occupied && !y.downed).some((y) => y.guts.now < y.guts.max * 0.5)) return 'present';
  return '';
}
function policyBot(st) {
  const b = boardView(st);
  for (const x of b.slots.filter((y) => y.occupied && !y.downed && y.def && !y.exActive)) {
    if (!botWhy(st, b, x)) continue;
    // 選ぶもの: 味方を選ぶ EX はいちばんライフの細い子(立っている子)、スタイルは二刀流を先に
    let choice = null;
    if (x.def.target === 'ally') choice = (b.slots.filter((y) => y.occupied && !y.downed).sort((p, q) => p.hp.now / p.hp.max - q.hp.now / q.hp.max)[0] || {}).i ?? null;
    if (x.def.duration === 'style') choice = G.tacticsExStyleOf(x.def, st.ex, x.i, x.id) === 'dual' ? 'sword' : 'dual';
    useEx(st, x.i, choice);
  }
}
// (b) 上手な使い方。ボットの条件をもとに、外している場面を足し、まずい場面を外す:
//   回避(血踊・緋桜瞬歩)・カウンターは狙われたターンに必ず(敵が同じ距離にいなければ、その子の距離の距離撃で引き寄せる)、
//   火力・強化は手強い WAVE の始めに、守りは重い攻撃の前に、回復は倒れた子(生命の泉で起こす)・細った子へ
function policyBest(st) {
  const b = boardView(st);
  st.hint = {};
  const threat = b.threat;
  const attackComing = ['single', 'multi', 'big', 'all', 'pierce'].includes(threat);
  const perTurn = st.recentDealt || st.recentWave || 0;
  const tough = !perTurn || b.enemy.hp > perTurn * 5; // いまの火力で5ターンより長くかかる
  const waveStart = b.turn <= 2 && b.enemy.hp >= b.enemy.max * 0.7;
  const alive = b.slots.filter((y) => y.occupied && !y.downed);
  const hurt = (y, r) => y.hp.now < y.hp.max * r;
  const deadly = alive.filter((y) => y.aimDamage && y.aimDamage >= y.hp.now * 0.85);
  const heavy = alive.filter((y) => y.aimDamage && y.aimDamage >= y.hp.now * 0.4);
  const canAttack = (slot) => st.hand.some((c) => isAttackType(c) && (c.type !== 'unique' || c.ownerSlotIdx === slot) && unitAt(st, slot).guts >= getCardGuts(st, c, slot));
  const pullCard = (slot) => st.hand.some((c) => c.type === 'range_atk' && c.rangeIdx === slot && alive.some((y) => y.i !== slot && !exLockedSlots(st).includes(y.i) && unitAt(st, y.i).guts >= getCardGuts(st, c, y.i)));
  for (const x of alive.filter((y) => y.def)) {
    const e = x.def.effect;
    const bot = !x.exActive && !!botWhy(st, b, x);
    let go = false; let choice = null;
    if (e === 'coverAll') go = bot || (heavy.some((y) => y.i !== x.i) && x.hp.now > Math.max(...heavy.map((y) => y.aimDamage)) * 1.2);
    else if (e === 'partyGuard') go = !x.exActive && (bot || heavy.length > 0 || alive.filter((y) => hurt(y, 0.5)).length >= 2);
    else if (e === 'timeStop') go = bot || deadly.length > 0;
    else if (e === 'damageBack') go = !x.exActive && (bot || heavy.length > 0);
    else if (e === 'avoidCharge') go = !x.exActive && x.aimed && attackComing && x.aimDamage >= x.hp.now * 0.15;
    else if (e === 'dodgeCombo' || e === 'distMatch') {
      // 狙われたターンに必ず。敵が同じ距離にいなければ、ほかの子の距離撃で引き寄せる(当てたあと敵はその距離から攻撃する)。
      // 緋桜瞬歩は使ったターン本人がカードを使えないので、ほかの子が引き寄せる。ザンの血踊はザン自身も殴れる
      const same = b.enemy.dist === x.i;
      const dodgeNow = !x.exActive && x.aimed && attackComing && (same || pullCard(x.i));
      const burst = e === 'distMatch' && !x.exActive && same && tough && b.enemy.hp >= b.enemy.max * 0.5;
      go = dodgeNow || burst;
      if ((go || x.exActive) && x.aimed && attackComing) {
        if (!same) st.hint.pullTo = x.i;
        st.hint.noGuard = [...(st.hint.noGuard || []), x.i];
      }
    } else if (e === 'counter') {
      go = !x.exActive && x.aimed && attackComing && threat !== 'pierce' && canAttack(x.i);
      if ((go || x.exActive) && x.aimed && attackComing && threat !== 'pierce') { st.hint.mustAttack = x.i; st.hint.noGuard = [...(st.hint.noGuard || []), x.i]; }
    } else if (e === 'allIn') go = bot; // 丈夫さ0は危ない。ボットの条件(狙われていない・手強い敵・ライフ7割以上・WAVE に1回)のまま
    else if (e === 'lifeSpring') {
      const down = b.slots.filter((y) => y.occupied && y.downed)[0];
      const low = alive.filter((y) => hurt(y, 0.4) || deadly.includes(y)).sort((p, q) => p.hp.now / p.hp.max - q.hp.now / q.hp.max)[0];
      const t = down || low; go = !!t; choice = t ? t.i : null;
    } else if (e === 'cookieBox') {
      const n = G.sweetStackCountOf(st.sweet[x.i]);
      go = (n >= 10 && (alive.some((y) => hurt(y, 0.7)) || (waveStart && tough))) || (n >= 3 && alive.some((y) => hurt(y, 0.4)));
    } else if (e === 'nightmareKey') { const n = G.sweetStackCountOf(st.sweet[x.i]); go = !x.exActive && (n >= 10 || (n >= 6 && tough && waveStart)); }
    else if (e === 'present') go = true; // 1WAVE に1回。3ターンの強化とガッツをいちばん早く
    else if (e === 'trickConfuse') go = !x.exActive && (bot || (waveStart && tough) || alive.filter((y) => hurt(y, 0.6)).length >= 2);
    else if (e === 'comboBurst') go = canAttack(x.i) && (bot || tough);
    else if (e === 'pandoraBox') go = bot && x.hp.now >= x.hp.max * 0.75;
    else if (e === 'multiBuff' && x.def.lifeCostRate > 0) go = !x.exActive && (bot || (tough && waveStart)) && x.hp.now >= x.hp.max * 0.6;
    else if (e === 'weaponChange') {
      // 勇者の剣士モッチーは、手強い敵へは二刀流(連撃が2回ぶん)、ライフが細ったら片手盾(丈夫さ+ちから)。供モンは片手盾
      const style = G.tacticsExStyleOf(x.def, st.ex, x.i, x.id);
      choice = x.i !== st.heroSlot ? 'shield' : (hurt(x, 0.4) ? 'shield' : (tough && x.hp.now >= x.hp.max * 0.6 ? 'dual' : style));
      go = style !== choice;
    } else if (e === 'statBoost') go = !x.exActive && (bot || (waveStart && tough && b.wave >= 3));
    else if (['psychoLock', 'thunder', 'multiBuff', 'stage', 'partyBoost'].includes(e)) go = !x.exActive && (bot || (tough && (waveStart || b.enemy.hp >= b.enemy.max * 0.6)));
    if (go) useEx(st, x.i, choice);
  }
}
const EX_POLICIES = { none: () => {}, bot: policyBot, best: policyBest };

// ---------- 1ターン(60-app.jsx processTurn 12304〜・敵の番 handleEnemyTurn 11250〜・ターン終わり 11742〜) ----------
const addPerma = (st, key, v) => { st.perma[key] = (st.perma[key] || 0) + v; };
const setNextSlot = (st, slot, key, value) => { st.nextB = { ...st.nextB, bySlot: G.withTacticsSlotBuff(st.nextB.bySlot, slot, key, value) }; };

function playTurn(st) {
  const rng = st.rng;
  // トリックスタート: WAVE の 1・4・7…ターン目に、持っている子それぞれが抽選する(60-app.jsx 13724)。同じターンに2回は引かない
  if (G.trickStartRollTurn(st.turn) && st.trickRolled !== st.turn) {
    st.trickRolled = st.turn;
    G.tacticsAliveSlots(st.units).forEach((i) => { if (G.hasTrickStartTrait(st.units[i].id)) st.trick[i] = G.rollTrickStart(st.trick[i], rng).stacks; });
  }
  // ターンの始めの写し(ゲームは1ターンのあいだ state をこの値で読む)
  const iceLockActive = (st.waveB.iceLockTurns || 0) > 0 && !st.waveB.iceLockPreparing; // 60-app.jsx 10267
  st.snap = { perma: { ...st.perma }, wave: { ...st.waveB }, iceLockActive };
  st.aim = { intent: st.intent, dist: st.dist };
  st.hint = {};
  // EX はカードを選ぶ前に使う(tactics.js 463 maybeUseEx → playTurn)
  EX_POLICIES[st.exMode](st);
  const { picks, discards } = decideTurn(st);
  const now = nowOf(st);
  const startDist = st.dist;
  let attackDistance = st.dist; let forcedMoveTarget = null;
  let localOryo = 0; let localDmgMod = 0; let stun = false; let dealt = 0; let iceRefreshed = false;
  let localGlobalCombo = 0; let invincible = false; // ききの全体連撃(その場のぶん)・あつの挑発の無効化(60-app.jsx 12354)
  const immBySlot = {}; const guardBySlot = {}; const usesBy = {};
  const crossed = {};
  // 眼力(スエゾー): その子が攻撃したターンに 40% でスタン(60-app.jsx processTurn 12319)
  if (picks.some((p) => isAttackType(st.hand[p.hi]) && st.units[p.slot].id === 'Suezo') && rng() < G.TACTICS_INTIMIDATE_RATE) stun = true;
  for (const { hi, slot } of picks) {
    const card = st.hand[hi];
    const halved = (usesBy[slot] || 0) > 0; usesBy[slot] = (usesBy[slot] || 0) + 1;
    const effMul = halved ? 0.5 : 1;
    const mon = st.mons[slot];
    // パンドラの箱: 箱のあいだの固有技は、天使の力で味方全員のライフ・ガッツを戻す(60-app.jsx 12408)
    const box = G.tacticsExPandoraBoxOf(st.ex, st.units, slot, now);
    if (box && card.type === 'unique' && box.angelRate > 0) st.units = G.rateHealTacticsBoard(st.units, box.angelRate, box.angelRate, false).units;
    if (card.type === 'guard') {
      const g = G.GUARD_EVOLUTION[st.guardLevel];
      const e = guardBySlot[slot] || (guardBySlot[slot] = { flat: 0, mult: 0, weight: 0, cards: 0 });
      e.flat += g.flat * effMul; e.mult += g.mult * effMul; e.cards += 1;
    }
    const cost = getCardGuts(st, card, slot);
    st.units = G.payTacticsGutsAt(st.units, slot, cost).units;
    if (!card.teach) gainSweetStack(st, slot, mon.id, card); // メロディーのクッキー(カード1枚ごと。アシカは数えない 60-app.jsx 12432)
    if (card.teach) {
      st.assistUses[card.id] = (st.assistUses[card.id] || 0) + 1;
      const r = playTeaching(st, card, slot, effMul, picks.length, guardBySlot, startDist, localOryo, localDmgMod, localGlobalCombo);
      localOryo += r.oryo; localGlobalCombo += r.combo;
      if (r.invincible) invincible = true;
      if (r.dealt > 0) { dealt += r.dealt; st.dmgBySlot[slot] = (st.dmgBySlot[slot] || 0) + r.dealt; if (crossMultNow(st, slot) > 1) crossed[slot] = true; }
      continue;
    }
    if (!isAttackType(card)) continue;
    // ---- 固有技の「使った瞬間」の効果(60-app.jsx 12524〜) ----
    let skillMult = 1; let wheel = null;
    if (card.type === 'unique') {
      if (card.monId === 'Mocchi' || card.monId === 'Mitarashi') { addPerma(st, 'dmgCutPct', 0.03 * effMul); st.waveB.enemyTakenDmgBonus = (st.waveB.enemyTakenDmgBonus || 0) + 0.1 * effMul; localDmgMod += 0.1 * effMul; }
      else if (card.monId === 'Golem') { addPerma(st, 'atkPct', 0.075 * effMul); localOryo += 0.075 * effMul; }
      else if (card.monId === 'Zan') addPerma(st, 'comboDmgPct', 0.03 * effMul);
      else if (card.monId === 'Eiki') { addPerma(st, 'comboDmgPct', 0.03 * effMul); addPerma(st, 'atkPct', 0.03 * effMul); }
      else if (card.monId === 'KenshiMocchi' && exStyleAt(st, slot) === 'shield') { /* 片手盾: ソードスキルなし */ }
      else if (card.monId === 'KenshiMocchi') {
        addPerma(st, 'comboDmgPct', 0.03 * effMul);
        const next = (st.perma.kenshiComboPower || 0) + 1;
        if (next >= G.KENSHI_COMBO_POWER_MAX) { st.perma.kenshiComboPower = 0; addPerma(st, 'kenshiExtraCombo', 1); } else st.perma.kenshiComboPower = next;
      }
      else if (card.monId === G.FATE_COIN_MONSTER_ID) {
        const side = G.rollFateCoin(rng); skillMult = G.fateCoinDmgMult(side);
        st.fate = side === 'heads' ? G.withFateSlotStack(st.fate, slot, 'combo') : G.withFateCoinGuts(st.fate);
      }
      else if (card.monId === G.FATE_WHEEL_MONSTER_ID) { wheel = G.rollFateWheel(rng); if (wheel.dmgMult) skillMult = wheel.dmgMult; }
    }
    const d = getDmg(st, card, slot, localOryo, localDmgMod, halved, attackDistance, skillMult);
    const mb = multiBuffNow(st, slot);
    const bn = blackNoteAt(st, slot, mon.id);
    const perma = st.snap.perma; const tb = st.turnB || {};
    const hits = G.buildAttackHits({ d, card, attackerId: mon.id, heroId: st.heroId, traitOwnerId: mon.id,
      comboDmgBonus: perma.comboDmgPct || 0, critDmgBonus: perma.critDmgPct || 0, kenshiExtraCombos: perma.kenshiExtraCombo || 0,
      guaranteedCrit: !!tb.guaranteedCrit || G.tacticsSlotFlag(tb.bySlot, slot, 'guaranteedCrit') || critFixedNow(st, slot, card),
      rollCrit: () => rng() < Math.min(1, ((card.crit || 0.1) + (perma.critRatePct || 0) + (mb.critAdd || 0) + bn.critAdd) * mb.critRate),
      globalComboRate: (perma.globalComboDmgPct || 0) + localGlobalCombo, swordSkill: exStyleAt(st, slot) !== 'shield', hitRepeat: exStyleAt(st, slot) === 'dual' ? G.TACTICS_EX_DUAL_HIT_REPEAT : 1,
      exCombos: G.withBlackNoteCombo(G.withFateCombo(exCombosAt(st, slot, card), st.fate, slot), bn.combo), critDmgMult: mb.critDmg });
    const finalD = hits[0].dmg;
    let total = hits.reduce((s, h) => s + h.dmg, 0);
    // アクアフィールド: ウンディーネ種の攻撃カードで1つ積む。3つでアクアフィナーレ(敵は1ターン動けない)(60-app.jsx aquaStackFromCard 10622)
    {
      const kind = card.type === 'unique' ? 'unique' : 'normal';
      const r = G.addTacticsExAquaStack(st.ex, st.units, now, slot, kind);
      if (r.event) { st.ex = r.state; if (r.event === 'finale') stun = true; }
    }
    if (crossMultNow(st, slot) > 1) crossed[slot] = true; // ハムのクロスカウンター(60-app.jsx fireTacticsExCross 10655)
    if (card.type === 'range_atk' && card.rangeIdx != null) { forcedMoveTarget = card.rangeIdx; attackDistance = card.rangeIdx; }
    if (G.hasTrickStartTrait(mon.id) && finalD > 0) st.units = G.recoverTacticsGutsAt(st.units, slot, G.trickStartGutsRefund(cost));
    if (finalD > 0) gainSweetStack(st, slot, mon.id, card, true); // クロミーの黒音符(当たったとき)
    if (finalD > 0 && G.tacticsExConfusesOnHit(st.ex, st.units, slot, now)) st.confuse = G.ENEMY_CONFUSE_TURNS;
    // ---- 固有技の「当てたあと」の効果(60-app.jsx 12586〜) ----
    if (card.type === 'unique') {
      const id = card.monId;
      if (id === 'Ham') stun = true;
      else if (id === 'Suezo') st.units = G.rateHealTacticsAt(st.units, slot, 0, 0.5 * effMul).units;
      else if (id === 'Pixie' || id === 'Mia') setNextSlot(st, slot, 'zeroGuts', true);
      else if (id === 'Tiger') { setNextSlot(st, slot, 'guaranteedCrit', true); addPerma(st, 'critRatePct', 0.02 * effMul); addPerma(st, 'critDmgPct', 0.02 * effMul); }
      else if (id === 'Monol') { addPerma(st, 'defPct', 0.03 * effMul); st.waveB.enemyAtkDebuffPct = (st.waveB.enemyAtkDebuffPct || 0) + 0.10 * effMul; st.nextB = { ...st.nextB, reflect: true }; }
      else if (id === 'Oboro' || id === 'Plant') st.units = G.recoverTacticsGutsAt(G.healTacticsAt(st.units, slot, Math.floor(finalD * 0.5)), slot, Math.floor(finalD * 0.05));
      else if (id === 'Ark' || id === 'Iblis') {
        total += G.attackAtonementDmg(card, finalD, 1);
        addPerma(st, 'chuuniUniqueStack', 1);
        setNextSlot(st, slot, 'takenDamageMult', 0.5); setNextSlot(st, slot, 'gutsCostMult', 1.15);
      }
      else if (G.isLifeTreeGuardCard(card)) {
        const fx = G.lifeTreeGuardEffectOf(id);
        st.units = G.rateHealTacticsAt(st.units, slot, 0, fx.guts * effMul).units;
        const guardMult = G.lifeTreeGuardMult(effMul, id);
        if (fx.hp > 0) st.units = G.rateHealTacticsAt(st.units, slot, fx.hp * effMul, 0).units;
        if (fx.cookie > 0 && (G.sweetStackTraitOf(mon.id) || {}).kind === 'cookie') st.sweet[slot] = G.addSweetStack(st.sweet[slot], fx.cookie);
        if (fx.atkStack > 0) st.bow[slot] = (st.bow[slot] || 0) + 1;
        immBySlot[slot] = guardMult;
        st.nextB = { ...st.nextB, bySlot: G.withTacticsSlotBuff(st.nextB.bySlot, slot, 'takenDamageMult', G.tacticsSlotRate(st.nextB.bySlot, slot, 'takenDamageMult', 1.0) * guardMult) };
      }
      else if (id === G.FATE_WHEEL_MONSTER_ID) {
        if (wheel && finalD > 0) {
          if (wheel.id === 'enemyAtkDown') st.fateWheel = { ...st.fateWheel, atkDown: G.FATE_WHEEL_DEBUFF_TURNS };
          else if (wheel.id === 'enemyTakenUp') st.fateWheel = { ...st.fateWheel, takenUp: G.FATE_WHEEL_DEBUFF_TURNS };
          else if (wheel.id === 'combo') st.fate = G.withFateSlotStack(st.fate, slot, 'combo');
          else if (wheel.id === 'atk') st.fate = G.withFateSlotStack(st.fate, slot, 'atk');
        }
      }
      else if (id === 'Pandora') setNextSlot(st, slot, 'pandoraResonanceTurns', 2);
      else if (G.isIceLockMonster(id)) {
        iceRefreshed = true;
        st.waveB = { ...st.waveB, iceLockTurns: 5, iceLockPreparing: (st.waveB.iceLockTurns || 0) <= 0 };
        addPerma(st, 'snegurochkaGutsDiscountStacks', 1);
      }
    }
    dealt += total;
    st.dmgBySlot[slot] = (st.dmgBySlot[slot] || 0) + total;
  }
  st.enemy.hp = Math.max(0, st.enemy.hp - dealt);
  if (TRACE) {
    const u = st.units.map((x) => (x ? `${x.id}:${x.hp}/${x.maxHp} g${x.guts}/${x.maxGuts}${x.downed ? '×' : ''}` : '-')).join(' ');
    console.log(`W${st.wave} T${st.turn} 距離${st.dist} 予告${st.intent ? (st.intent.variant || st.intent.type) + ':' + (st.intent.value || '') + '→' + (st.intent.targetSlot ?? '') : '-'} 使う[${picks.map((p) => st.hand[p.hi].type + '@' + p.slot).join(',')}] 捨て${discards.length} 与${dealt} 敵${st.enemy.hp}/${st.enemy.maxHp} | ${u}`);
  }
  st.dealtTotal += dealt;
  if (st.enemy.hp <= 0) return 'clear';
  st.recentDealt = st.recentDealt ? st.recentDealt * 0.6 + dealt * 0.4 : dealt; // tactics.js 512 の数え方
  // 捨てる: 1枚につき、立っている子それぞれの最大ガッツの5%(60-app.jsx 12891)
  if (discards.length) {
    G.tacticsAliveSlots(st.units).forEach((i) => {
      const v = G.normalizeTacticsUnit(st.units[i]);
      const g = Math.max(0, Math.min(v.maxGuts - v.guts, Math.floor(v.maxGuts * G.TACTICS_DISCARD_GUTS_RATE * discards.length)));
      if (g > 0) st.units = G.recoverTacticsGutsAt(st.units, i, g);
    });
  }
  // 手札の補充(60-app.jsx 12903)
  const usedIdx = new Set([...picks.map((p) => p.hi), ...discards]);
  st.graveyard.push(...[...usedIdx].map((i) => st.hand[i]));
  st.hand = st.hand.filter((_, i) => !usedIdx.has(i));
  const replenish = () => { if (!st.deck.length) { if (!st.graveyard.length) return; st.deck = shuffle(st.graveyard, rng); st.graveyard = []; } if (st.deck.length) st.hand.push(st.deck.pop()); };
  while (st.hand.length < 5 && (st.deck.length || st.graveyard.length)) replenish();
  // ボルテージ(ミーア)・雷(ライガー)をためる(60-app.jsx 12913〜12924)
  if (picks.length) {
    st.ex = G.addTacticsExVoltage(st.ex, st.units, now, picks.length);
    const perSlot = {}; picks.forEach((p) => { perSlot[p.slot] = (perSlot[p.slot] || 0) + 1; });
    Object.keys(perSlot).forEach((k) => { st.ex = G.addTacticsExThunder(st.ex, st.units, now, Number(k), perSlot[k]); });
  }
  // お気に入りの魔法・パンドラの箱: 次のターンの手札に固有技を必ず出す(60-app.jsx 12927)
  {
    const fav = G.tacticsExUniqueGuaranteeSlot(st.ex, st.units, { wave: st.wave, turn: st.turn + 1 });
    if (fav != null) { const e = G.ensureTacticsExUniqueInHand({ hand: st.hand, deck: st.deck, graveyard: st.graveyard }, (c) => c && c.type === 'unique' && c.ownerSlotIdx === fav); st.hand = e.hand; st.deck = e.deck; st.graveyard = e.graveyard; }
  }
  // クロスカウンターを出したハムのカウンター+1(60-app.jsx commitTacticsExCrossCounters 10660)
  Object.keys(crossed).forEach((k) => { st.ex = G.addTacticsExCounter(st.ex, st.units, now, Number(k), 1); });

  if ((st.perma.kikiCardBonusTurns || 0) > 0) st.perma.kikiCardBonusTurns = Math.max(0, st.perma.kikiCardBonusTurns - 1); // 60-app.jsx 12939
  // ===== 敵の番(60-app.jsx handleEnemyTurn 11250〜) =====
  const intent = st.intent;
  const timeStopSlot = G.tacticsExTimeStopSlot(st.ex, st.units, now);
  const tb = st.turnB || {};
  let performed = false;
  if (timeStopSlot != null) { /* 時間停止: 敵は動かない */ }
  else if (intent && intent.type === 'CONFUSED') { /* 意味不明 */ }
  else if (tb.invincible || invincible) { /* 無効化(あつの挑発。60-app.jsx 11281) */ }
  else if (tb.stunEnemy || stun) { /* スタン */ }
  else if (intent) {
    performed = true;
    if (intent.type === 'MOVE' && ((st.snap.wave.iceLockTurns || 0) > 0 || psychoNow(st).active)) { /* 移動できない */ }
    else if (intent.type === 'MOVE' && forcedMoveTarget != null) performed = false;
    else if (intent.type === 'MOVE') st.dist = intent.targetDist;
    else if (intent.type === 'ROAR') { st.roarStacks += 1; st.enemy.atk = Math.floor(Math.max(0, st.enemy.atk) * G.TACTICS_ROAR_ATK_RATE); }
    else if (intent.type === 'REGEN') st.enemy.hp = Math.min(st.enemy.maxHp, st.enemy.hp + G.tacticsRegenHealAmount(st.enemy.maxHp));
    else if (intent.type === 'ATTACK' || intent.type === 'SPECIAL') {
      const actingDist = forcedMoveTarget != null ? forcedMoveTarget : st.dist;
      const actingIntent = G.tacticsSweepIntent(intent, st.units, actingDist);
      const aimedSlots = targetsNow(st, intent, actingDist);
      const defenseSlot = aimedSlots.length ? aimedSlots[Math.floor(rng() * aimedSlots.length)] : null;
      const dId = defenseSlot != null && st.units[defenseSlot] ? st.units[defenseSlot].id : null;
      const table = G.buildUnifiedSpecialDefense({ existingEvasion: TRAIT_EVADE[dId] || 0, existingReflect: TRAIT_REFLECT[dId] || 0, existingAbsorb: TRAIT_ABSORB[dId] || 0 });
      // 中二病: 狙われたらWAVEに2回まで被ダメ半分(数えるのは狙われたターン。被ダメの式はターンの始めの数で見る)
      if (aimedSlots.some((i) => ['Ark', 'Iblis'].includes(st.units[i].id)) && (st.snap.wave.chuuniDmgCutUses || 0) < 2) st.waveB.chuuniDmgCutUses = (st.waveB.chuuniDmgCutUses || 0) + 1;
      const forcedReflect = !!tb.reflect; // モノリスの固有技「次ターン反射」
      const res = forcedReflect ? 'reflect' : G.rollUnifiedSpecialDefense(table, rng(), rng());
      const imm = (slot, dmg) => turnReduce(st, dmg, slot, immBySlot);
      if (res === 'reflect' && forcedReflect) {
        const back = aimedSlots.reduce((s, i) => s + imm(i, incomingFor(st, actingIntent, i)), 0);
        if (back > 0) { st.enemy.hp = Math.max(0, st.enemy.hp - back); if (st.enemy.hp <= 0) return 'clear'; }
      } else if (res === 'absorb') {
        if (defenseSlot != null) {
          const gain = imm(defenseSlot, incomingFor(st, actingIntent, defenseSlot));
          st.units = G.recoverTacticsGutsAt(G.healTacticsAt(st.units, defenseSlot, gain), defenseSlot, Math.floor(gain * 0.1));
        }
      } else {
        const rushHits = intent.variant === 'rush' ? Math.max(1, Math.floor(Number(intent.hits) || 1)) : 1;
        let reflectBack = 0; let tookHit = false;
        const evadedSlot = res === 'evasion' ? defenseSlot : null;
        const reflectedSlot = res === 'reflect' ? defenseSlot : null;
        for (const slot of aimedSlots) {
          if (crossed[slot]) continue; // クロスカウンターで回避
          const exDodge = G.tacticsExDistMatchDodges(exEffectAt(st, slot), slot, actingDist);
          const thunderDodge = rng() < (() => { const t = G.tacticsExThunderOf(st.ex, st.units, slot, nowOf(st)); return t ? t.dodgeRate : 0; })();
          if (exDodge) { if (exEffectAt(st, slot) === 'dodgeCombo') st.dodges += 1; st.ex = G.recordTacticsExDodge(st.ex, st.units, slot, nowOf(st)); }
          const avoidLeft = (slot === evadedSlot || exDodge || thunderDodge) ? 0 : G.tacticsExAvoidLeftOf(st.ex, st.units, slot, nowOf(st));
          if (avoidLeft > 0) st.ex = G.spendTacticsExAvoid(st.ex, st.units, slot, nowOf(st));
          if (slot === evadedSlot || exDodge || thunderDodge || avoidLeft > 0) continue;
          if (slot === reflectedSlot) { reflectBack += imm(slot, incomingFor(st, actingIntent, slot)); continue; }
          const own = guardBySlot[slot] || { cards: 0 };
          const base = slotGuardValue(st, guardBySlot, slot);
          const slotGuard = intent.variant === 'pierce' ? 0 : base;
          const hit = G.resolveTacticsGuardedHit(incomingFor(st, actingIntent, slot), rushHits, slotGuard, G.tacticsGuardHits(own.cards, rushHits));
          tookHit = true;
          if (hit.taken > 0) {
            let fd = imm(slot, hit.taken);
            const ku = G.normalizeTacticsUnit(st.units[slot]);
            // 根性(生命の泉で立ち上がった子): ライフが0になる攻撃を1回だけライフ1で踏ん張る
            if (ku && !ku.downed && fd >= ku.hp && G.tacticsExKonjoLeftOf(st.ex, st.units, slot, nowOf(st)) > 0) {
              fd = Math.max(0, ku.hp - 1); st.ex = G.spendTacticsExKonjo(st.ex, st.units, slot, nowOf(st));
            }
            st.units = G.damageTacticsTargets(st.units, [slot], fd); st.taken += fd;
            // おぼろ返し: 受けたダメージの一部をライフ・ガッツへ
            const back = G.tacticsExDamageBackRates(st.ex, nowOf(st));
            const after = G.normalizeTacticsUnit(st.units[slot]);
            if (fd > 0 && (back.hp > 0 || back.guts > 0) && after && !after.downed) st.units = G.recoverTacticsGutsAt(G.healTacticsAt(st.units, slot, Math.floor(fd * back.hp)), slot, Math.floor(fd * back.guts));
          }
          if (hit.saved > 0) st.units = G.recoverTacticsGutsAt(G.healTacticsAt(st.units, slot, hit.saved), slot, Math.floor(hit.saved * 0.1));
        }
        if (tookHit) consumePoltz(st); // 60-app.jsx 11750 consumePoltzCharge
        if (reflectBack > 0) { st.enemy.hp = Math.max(0, st.enemy.hp - reflectBack); if (st.enemy.hp <= 0) return 'clear'; }
      }
    }
  }
  // 絶氷の楔の残りターン(60-app.jsx 11737)
  if ((st.waveB.iceLockTurns || 0) > 0 && !iceRefreshed && timeStopSlot == null) st.waveB.iceLockTurns -= 1;
  if (iceRefreshed) st.waveB.iceLockPreparing = false;
  if (G.isTacticsWipedOut(st.units)) return 'wipe';
  // ターン終わりの回復(60-app.jsx 11742〜): ライフ autoHpRecovery、ガッツ 5% + (autoHpRecovery − 10%)。ボルテージの上乗せ
  {
    const party = partyBuffNow(st);
    const baseGuts = Math.max(0, 0.05 + (st.autoHp - 0.1)) + (st.perma.gutsRecoverPct || 0); // 60-app.jsx 11761(かどみうむ・ポルツの gutsRecoverPct)
    st.units = G.rateHealTacticsBoard(st.units, st.autoHp + party.hpAdd, baseGuts + party.gutsAdd, false).units;
    // 60-app.jsx tacticsRegen(1367): EX の自動回復の上乗せ(ガッツ全開っちー・世界樹の守り・緑のめぐみ・雷纏・時間停止のコピー)
    const n = nowOf(st);
    const partyHp = G.tacticsExPartyRegenRate(st.ex, st.units, n) + G.tacticsExPartyBoostRegenRate(st.ex, n, 'hp');
    const partyGuts = G.tacticsExPartyBoostRegenRate(st.ex, n, 'guts');
    G.tacticsAliveSlots(st.units).forEach((i) => {
      const hpB = G.tacticsExRegenRateAt(st.ex, st.units, i, n, 'hp');
      const gB = G.tacticsExRegenRateAt(st.ex, st.units, i, n, 'guts') + partyGuts;
      if (hpB + partyHp > 0 || gB > 0) st.units = G.rateHealTacticsAt(st.units, i, hpB + partyHp, gB).units;
    });
    st.units = G.regenDownedTacticsBoard(st.units).units;
    // 氷海の支配者(人魚3体): 絶氷の楔が効いていて、その子の枠が敵と同じ距離なら、ガッツの自動回復 +50%
    G.tacticsAliveSlots(st.units).forEach((i) => {
      const withIce = G.applyIceRulerAutoGutsRecovery(baseGuts, st.units[i].id, iceLockActive, i, startDist);
      const extra = Math.max(0, withIce - baseGuts);
      if (extra > 0) st.units = G.rateHealTacticsAt(st.units, i, 0, extra).units;
    });
  }
  if (timeStopSlot == null && (st.fateWheel.atkDown > 0 || st.fateWheel.takenUp > 0)) st.fateWheel = G.tickFateWheelDebuff(st.fateWheel);
  // 生命の源: 次のターンが 6・9・12… ならガッツ30%。トリックスタートの「毎ターン回復」。クッキーの自動回復
  G.tacticsAliveSlots(st.units).forEach((i) => {
    if (G.lifeSourceGutsTurn(st.units[i].id, st.turn + 1)) st.units = G.rateHealTacticsAt(st.units, i, 0, G.LIFE_SOURCE_GUTS_RATE).units;
    const r = G.trickStartRegenRate(st.trick[i]);
    if (r > 0) st.units = G.rateHealTacticsAt(st.units, i, r, 0).units;
  });
  { const c = cookieNow(st); if (c.hpRegen > 0 || c.gutsRegen > 0) st.units = G.rateHealTacticsBoard(st.units, c.hpRegen, c.gutsRegen, false).units; }
  // ターンのバフの入れ替え(60-app.jsx 11850〜): 次ターン予約 → いま。双極共振の残りターンは持ち越す
  // メロソの最適解: 次のターンの始めにライフ・ガッツ全回復(60-app.jsx 11878)
  if (timeStopSlot == null && (st.nextB.melosoFullRecoveryMult || 0) > 0) {
    const r = st.nextB.melosoFullRecoveryMult;
    st.units = G.rateHealTacticsBoard(st.units, r, r, true).units;
  }
  if (timeStopSlot == null) {
    const active = { ...st.nextB }; delete active.melosoFullRecoveryMult;
    const carryAll = Math.max(0, (st.turnB.pandoraResonanceTurns || 0) - 1);
    if (active.pandoraResonanceTurns == null && carryAll > 0) active.pandoraResonanceTurns = carryAll;
    const carried = G.carryTacticsSlotBuffs(active.bySlot, st.turnB.bySlot, 'pandoraResonanceTurns');
    if (Object.keys(carried).length > 0) active.bySlot = carried; else delete active.bySlot;
    st.turnB = active; st.nextB = {};
  } else st.turnB = { ...st.turnB, invincible: false, stunEnemy: false };
  // パンドラの箱のターン終わり(ライフを払う・最後の希望・倒れた)(60-app.jsx settleTacticsExPandoraBox 12121)
  if (timeStopSlot == null) {
    const step = G.tacticsExPandoraTurnEnd(st.ex, st.units, nowOf(st));
    if (step) settlePandora(st, step);
  }
  if (timeStopSlot != null) st.ex = G.spendTacticsExTimeStop(st.ex);
  // 敵の距離: 距離撃で動かしていればそこ(60-app.jsx 12955)
  if (forcedMoveTarget != null) st.dist = forcedMoveTarget;
  const moveFrozen = intent && intent.type === 'MOVE' && ((st.snap.wave.iceLockTurns || 0) > 0 || psychoNow(st).active);
  const distForNext = forcedMoveTarget != null ? forcedMoveTarget : ((intent && intent.type === 'MOVE' && !moveFrozen) ? intent.targetDist : startDist);
  if (timeStopSlot == null) advanceIntents(st, intent, distForNext, performed);
  if (TRACE && timeStopSlot != null) console.log('  時間停止: ターンは進まない');
  return timeStopSlot != null ? 'frozen' : null;
}
function settlePandora(st, step) {
  const slot = step.slot; const cfg = step.cfg;
  let phase = step.phase;
  const others = () => G.tacticsFilledSlots(st.units).filter((i) => i !== slot);
  const aliveOthers = () => G.tacticsAliveSlots(st.units).filter((i) => i !== slot);
  if (phase === 'cost') {
    const u = G.normalizeTacticsUnit(st.units[slot]);
    let cost = Math.floor(u.maxHp * cfg.costRate);
    if (aliveOthers().length === 0) cost = Math.min(cost, Math.max(0, u.hp - 1));
    if (cost > 0) st.units = G.damageTacticsTargets(st.units, [slot], cost);
    if (!G.normalizeTacticsUnit(st.units[slot]).downed) return;
    phase = 'died';
  }
  if (phase === 'hope') {
    if (others().length) {
      others().forEach((i) => {
        const u = G.normalizeTacticsUnit(st.units[i]);
        st.units = G.healTacticsAt(st.units, i, Math.max(0, u.maxHp - u.hp));
        const v = G.normalizeTacticsUnit(st.units[i]);
        st.units = G.recoverTacticsGutsAt(st.units, i, Math.max(0, Math.min(v.maxGuts - v.guts, Math.floor(v.maxGuts * cfg.hopeGutsRate))));
      });
      if (cfg.lockTurns > 0) setNextSlot(st, slot, 'pandoraLockTurns', 1);
    }
  } else if (phase === 'died') {
    const u = G.normalizeTacticsUnit(st.units[slot]); const alive = aliveOthers();
    if (u && u.guts > 0 && alive.length > 0) {
      const each = Math.floor(u.guts / alive.length);
      alive.forEach((i) => { const v = G.normalizeTacticsUnit(st.units[i]); const g = Math.max(0, Math.min(v.maxGuts - v.guts, each)); if (g > 0) st.units = G.recoverTacticsGutsAt(st.units, i, g); });
      st.units = st.units.map((x, i) => (i === slot && x ? { ...x, guts: 0 } : x));
    }
  }
  st.ex = G.spendTacticsExPandoraBox(st.ex);
}

// ---------- 1ラン ----------
// 勇者モンはいちばん得意な枠、供モンは空いた枠のうち得意なもの(同じなら番号の小さい枠)
const bestSlotFor = (mon, free) => free.slice().sort((a, b) => (G.DIST_APTITUDE_MULT[(mon.distAptitude || [])[b]] ?? 1) - (G.DIST_APTITUDE_MULT[(mon.distAptitude || [])[a]] ?? 1) || a - b)[0];

function simulateRun({ heroId, allies = [], difficulty = 'Hard', seed = 1, maxWave = 10, exMode = 'bot' }) {
  const rng = mulberry32(hashSeed(seed, heroId, difficulty, allies.join(',')));
  const hero = MON_BY_ID[heroId];
  if (!hero) throw new Error(`勇者モンが見つからない: ${heroId}`);
  if (!EX_POLICIES[exMode]) throw new Error(`EX の使い方が分からない: ${exMode}`);
  const st = {
    rng, heroId, difficulty, exMode, mons: [null, null, null, null], units: [null, null, null, null], trick: [{}, {}, {}, {}],
    autoHp: 0.1, joinCatchUp: 1, powerStart: monsterPowerOf(hero), powerNow: monsterPowerOf(hero),
    dealtTotal: 0, taken: 0, recentDealt: 0, recentWave: 0, turnsTotal: 0, waveTurns: [],
    // ランのあいだ残るもの: EX の回数・permaBuffs・クッキー/黒音符・メロディ・ボゥの積み・運命のコイン/輪の積み
    ex: G.createTacticsExState(), perma: {}, sweet: {}, bow: {}, fate: {}, exUses: {}, dodges: 0, allInDone: {}, dmgBySlot: {},
  };
  st.heroSlot = bestSlotFor(hero, [0, 1, 2, 3]);
  st.mons[st.heroSlot] = hero; st.units[st.heroSlot] = G.createTacticsUnit(hero);
  const waiting = allies.slice();
  for (let w = 1; w <= maxWave; w++) {
    st.wave = w;
    // 敵を出す(60-app.jsx spawnEnemy 13629): 総合力で敵が強くなる。WAVE で消えるもの(waveBuffs・turnBuffs・運命の輪・乱心・トリックスタート)を消す
    st.enemy = G.createBattleEnemy(w, difficulty, null, null, G.tacticsEnemyPowerMultiplier(st.powerStart, st.powerNow), { mode: 'tacticsPro' });
    st.dist = w === 1 ? st.heroSlot : Math.floor(rng() * 4);
    st.roarStacks = 0; st.trick = [{}, {}, {}, {}]; st.trickRolled = null;
    st.waveB = {}; st.turnB = {}; st.nextB = {}; st.fateWheel = { atkDown: 0, takenUp: 0 }; st.confuse = 0;
    st.ex = G.resetTacticsExWaveUses(st.ex); // スネグーラチカのプレゼントは WAVE ごとに回数が戻る
    st.guardLevel = computeGuardLevel(G.tacticsMaxDef(st.units));
    const pool = buildDeck(st.mons, computeAtkTier(st.mons, st.dist), st.guardLevel, rng);
    st.hand = pool.slice(0, 5); st.deck = pool.slice(5); st.graveyard = [];
    st.turn = 1;
    st.intent = aim(st, nextAction(st, st.dist, null, { unannounced: true }));
    st.nextIntent = nextAction(st, distAfterIntent(st.intent, st.dist), st.intent);
    let out = null; let frozen = 0;
    while (st.turn <= 20) {
      const before = st.dist;
      out = playTurn(st);
      if (out === 'clear' || out === 'wipe') break;
      if (out === 'frozen') { if (++frozen > 40) break; } else st.turn += 1; // 時間停止のターンは数えない
      // 上限を上げる EX が切れたら戻す(60-app.jsx 10548)
      const exp = G.expireTacticsExMaxRates(st.units, st.ex, nowOf(st));
      if (exp.changed) st.units = G.scaleTacticsUnits(exp.units, st.perma.muaHpPct || 0, st.perma.muaGutsPct || 0);
      // 通常技・距離撃の段階を、敵の今の距離に合わせ直す(syncAtkTierForDist)
      if (st.dist !== before) {
        const lvl = computeAtkTier(st.mons, st.dist);
        const fix = (c) => patchAtkTier(c, lvl);
        st.hand = st.hand.map(fix); st.deck = st.deck.map(fix); st.graveyard = st.graveyard.map(fix);
      }
    }
    const turns = Math.min(st.turn, 20);
    st.turnsTotal += turns; st.waveTurns.push(turns);
    const summary = { turns: st.turnsTotal, waveTurns: st.waveTurns, dealt: st.dealtTotal, taken: st.taken, exUses: st.exUses, dodges: st.dodges };
    if (out !== 'clear') return { result: out === 'wipe' ? 'wipe' : 'timeout', wave: w, ...summary };
    // WAVE を抜けた(60-app.jsx resolveEnemyDefeat 11131〜): 追いつき補正と自動回復の率
    const remaining = Math.max(0, 21 - st.turn);
    st.joinCatchUp = G.addTacticsJoinCatchUp(st.joinCatchUp, remaining);
    st.autoHp = Math.max(0, st.autoHp + Math.max(-0.05, Math.min(0.05, (remaining - 10) * 0.005)));
    st.recentWave = st.recentDealt || st.recentWave; st.recentDealt = 0; // tactics.js 513
    // EX の上限アップは WAVE をまたがない
    const exp = G.expireTacticsExMaxRates(st.units, st.ex, { wave: w + 1, turn: 1 });
    if (exp.changed) st.units = G.scaleTacticsUnits(exp.units, st.perma.muaHpPct || 0, st.perma.muaGutsPct || 0);
    // 供モンは WAVE 2・4・6 のあと(19-difficulties-and-rules.jsx POST_WAVE_JOIN_WAVES)。空いている枠のうち適性のいちばん高いところへ
    const free = [0, 1, 2, 3].filter((i) => !st.units[i]);
    if (G.POST_WAVE_JOIN_WAVES.includes(w) && free.length && waiting.length) {
      const mon = MON_BY_ID[waiting.shift()];
      const slot = bestSlotFor(mon, free);
      st.mons[slot] = mon;
      st.units[slot] = G.applyTacticsJoinCatchUp(G.createTacticsUnit(mon), st.joinCatchUp);
      st.powerNow += monsterPowerOf(mon);
    }
  }
  return { result: 'clear', wave: maxWave, turns: st.turnsTotal, waveTurns: st.waveTurns, dealt: st.dealtTotal, taken: st.taken, exUses: st.exUses, dodges: st.dodges };
}

function pickAllies(heroId, rng, n = 3) {
  return shuffle(MONS.map((m) => m.id).filter((id) => id !== heroId), rng).slice(0, n);
}

// G … シミュレーターが読み込んだゲームのデータ。調整の案の効き目を測るとき、メモリの中だけ数字を変えるのに使う(ゲームのファイルは変えない)
module.exports = { simulateRun, pickAllies, monsterPowerOf, MONS, EX_POLICIES, G };

// ---------- 一括で回す ----------
// 前の版(スキル無し)の md の表を読む。勇者モン名 → 難易度 → { avg, past2, clear }
function readOldTables(file) {
  const out = {};
  if (!file || !fs.existsSync(file)) return out;
  let diff = null; let carried = false;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const h = line.match(/^## (Hard|Expert|Master)\s*$/); if (h) { diff = h[1]; continue; }
    if (/^## /.test(line)) { diff = null; continue; }
    // 2 版目の md(「前の版」の列がある)なら、その列をそのまま引き継ぐ(序盤越え・クリア率は持たない)
    if (diff && /^\| 勇者モン \| 前の版 \|/.test(line)) { carried = true; continue; }
    const m = diff && (carried ? line.match(/^\| ([^|]+) \| ([\d.]+) \|/) : line.match(/^\| ([^|]+) \| ([\d.]+) \| [\d.]+ \| (\d+)% \| (\d+)% \|/));
    if (m) (out[m[1].trim()] = out[m[1].trim()] || {})[diff] = { avg: Number(m[2]), past2: m[3] != null ? Number(m[3]) / 100 : null, clear: m[4] != null ? Number(m[4]) / 100 : null };
  }
  return out;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const DIFFS = argOf('--diff', 'Hard,Expert,Master').split(',');
  const RUNS = Number(argOf('--runs', '300'));
  const SEED = Number(argOf('--seed', '1'));
  const MAX_WAVE = Number(argOf('--max-wave', '10'));
  const MODES = argOf('--ex', 'bot,best').split(/[,|]/).filter((x) => EX_POLICIES[x]);
  const ONLY = argOf('--hero', '');
  const mdFile = argOf('--md', '');
  const oldFile = argOf('--old', path.join(__dirname, '..', '..', '..', 'docs', 'playbot', 'reports', 'tier', 'sim.md'));
  const OLD = readOldTables(oldFile); // md を書き換える前に、前の版の数字を読んでおく
  const t0 = Date.now();
  const stats = {}; // [mode][heroId][diff]
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
  const heroes = ONLY ? MONS.filter((m) => ONLY.split(',').includes(m.id)) : MONS;
  for (const mode of MODES) {
    stats[mode] = {};
    for (const m of heroes) {
      stats[mode][m.id] = {};
      for (const d of DIFFS) {
        const waves = []; let past2 = 0; let clear = 0; let wipe = 0; let timeout = 0; let heroEx = 0; let dodges = 0;
        for (let i = 0; i < RUNS; i++) {
          const allies = pickAllies(m.id, mulberry32(hashSeed(SEED, 'allies', m.id, d, i)));
          const r = simulateRun({ heroId: m.id, allies, difficulty: d, seed: hashSeed(SEED, i), maxWave: MAX_WAVE, exMode: mode });
          waves.push(r.wave);
          if (r.wave > 2 || r.result === 'clear') past2++;
          if (r.result === 'clear') clear++; else if (r.result === 'wipe') wipe++; else timeout++;
          heroEx += r.exUses[m.id] || 0; dodges += r.dodges;
        }
        stats[mode][m.id][d] = { avg: waves.reduce((a, b) => a + b, 0) / waves.length, med: median(waves), past2: past2 / RUNS, clear: clear / RUNS, wipe: wipe / RUNS, timeout: timeout / RUNS, heroEx: heroEx / RUNS, dodges: dodges / RUNS };
      }
    }
    console.log(`  ${mode}: ${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
  }
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  // ブラウザの実戦(tactics-knowledge.json)。ボットが止まった回(stopped)は数えない
  const knowledge = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tactics-knowledge.json'), 'utf8'));
  const idByName = Object.fromEntries(MONS.map((m) => [m.name, m.id]));
  const real = {};
  for (const r of knowledge.runs || []) {
    if (r.mode !== 'tacticsPro' || !['clear', 'wipe', 'timeout'].includes(r.result)) continue;
    const id = idByName[r.hero]; if (!id || !DIFFS.includes(r.difficulty) || !heroes.some((m) => m.id === id)) continue;
    const k = `${id}|${r.difficulty}`;
    (real[k] = real[k] || []).push(r.result === 'clear' ? MAX_WAVE : Number(r.wave) || 0);
  }

  const L = []; const out = (t = '') => L.push(t);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const sgn = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`;
  const MODE_JA = { none: 'EX 無し', bot: 'EX=bot', best: 'EX=best' };
  out(`# 簡易シミュレーター(タクティクスプロ・${DIFFS.join(' / ')}・各 ${RUNS} 回・EX の使い方 ${MODES.join(' / ')})`);
  out();
  out('`node tools/playbot/sim/battle.js` の出力(2 版目・スキル入り)。式はゲームのコード(60-app.jsx・22-enemy・32-tactics-units)から写したもの。');
  out();
  out('**2 版目で入れたもの**(社長の決まり「ステは弱いけどスキル系で調整してるから、そこもちゃんと見て判断して」):');
  out();
  out('- **EX 26 体ぶん(effect 23 種)**: 発動・持続(ターン数/WAVE/スタイル)・回数(1ラン/1WAVE)・併用できない EX はその子だけカードを使えない、まで 32-tactics-units.jsx の関数で数える');
  out('- **固有技の長く続く効果**: モッチー/ミタラシの敵被ダメ+10%(WAVE)・味方被ダメ−3%(永続)、ゴーレムの与ダメ+7.5%(永続)、ザン/エイキ/剣士モッチーの連撃ダメージ+3%(永続)、');
  out('  剣士モッチーの連撃パワー、ピクシー/ミーアの次ターン消費0、ライガーの次ターン会心確定・会心率/会心ダメ+2%、モノリスの丈夫さ+3%・敵の攻撃−10%(WAVE)・次ターン反射、');
  out('  アーク/イブリースの追撃・次ターン被ダメ半分・消費ガッツ増・倍率+0.1、大樹の加護/ピンク音符/メロディ・ボゥ(被ダメ減2ターン・回復・クッキー・与ダメ+5%積み)、');
  out('  パンドラの双極共振(2ターン消費半減)、絶氷の楔(5ターン移動封じ・敵の与ダメ−30%・消費ガッツ−3%積み)、運命のコイン/運命の輪の積み');
  out('- **勇者特性すべて**: 連撃(ザン)・桜花連舞(エイキ)・黒の剣士(剣士モッチー)・禁忌解錠(パンドラ。buildAttackHits が heroId で見分ける)、怪力・魔力開放・もち肌・中二病・眼力・');
  out('  俊足/反射/吸収・生命の源・氷海の支配者・トリックスタート・メロディの手作りクッキー・クロミノート・連続攻撃(枚数+1)');
  out('- **間合い**: 勇者モンはいちばん得意な枠、供モンは空いた枠のうち得意なもの。引き寄せの距離撃はボット(decidePick の pull: いちばんダメージを出した子の距離)に合わせた');
  out();
  out('**EX の使い方**: `bot` = いまのボットの決め方(tactics-brain.js maybeUseEx と同じ条件)。`best` = 上手な使い方(回避・カウンターは狙われたターンに必ず、');
  out('火力・強化は手強い WAVE の始めに、守りは重い攻撃の前に、回復は倒れた子・細った子へ。ザンの血踊は敵が同じ距離にいなければ距離撃で引き寄せる)。');
  out('bot と best の差が大きい子ほど「ボットの EX の使い方が下手で負けている」。');
  out();
  out('**近似したもの・まだ入れていないもの**:');
  out();
  for (const a of APPROX) out(`- ${a}`);
  out();
  out(`編成: 勇者モン1体で始め、WAVE 2・4・6 のあとに供モンが1体ずつ加わる(ゲームの POST_WAVE_JOIN_WAVES)。供モンは debugOnly でない子から seed で3体(どの使い方も同じ3体)。`);
  out('あとから入る子には追いつき補正(残りターン×1%を WAVE ごとに積む)が乗る。敵は編成の総合力で強くなる。');
  out('戦い方は tactics-brain.js の decidePick を縮めたもの(とどめ → 予告に合わせた守り → ハムのスタン → ガッツ1あたりの火力で攻撃 → 捨ててガッツを戻す → 余ればガード)。');
  out();
  out('「届いた WAVE」は負けた WAVE(クリアは 10)。「序盤越え」は WAVE 1〜2(1体の時間)を越えた割合。「EX」は勇者モンが1ランで EX を使った回数の平均。');
  out('「前の版」は 1 版目(スキル無し)の平均 WAVE。');
  for (const d of DIFFS) {
    out();
    out(`## ${d}`);
    out();
    const head = MODES.map((mo) => `${MODE_JA[mo]} 平均 | 序盤越え | クリア | EX`).join(' | ');
    out(`| 勇者モン | 前の版 | ${head} |`);
    out(`| --- | --- | ${MODES.map(() => '--- | --- | --- | ---').join(' | ')} |`);
    const key = MODES.includes('bot') ? 'bot' : MODES[0];
    for (const m of [...heroes].sort((a, b) => stats[key][b.id][d].avg - stats[key][a.id][d].avg)) {
      const old = (OLD[m.name] || {})[d];
      out(`| ${m.name} | ${old ? old.avg.toFixed(2) : '-'} | ${MODES.map((mo) => { const s = stats[mo][m.id][d]; return `${s.avg.toFixed(2)} | ${pct(s.past2)} | ${pct(s.clear)} | ${s.heroEx.toFixed(1)}`; }).join(' | ')} |`);
    }
  }
  if (MODES.includes('bot') && MODES.includes('best')) {
    out();
    out('## EX の使い方: bot と best の差(best − bot。大きいほどボットの使い方が下手)');
    out();
    out(`| 勇者モン | EX | ${DIFFS.join(' | ')} | 平均 |`);
    out(`| --- | --- | ${DIFFS.map(() => '---').join(' | ')} | --- |`);
    const rows = heroes.map((m) => { const gaps = DIFFS.map((d) => stats.best[m.id][d].avg - stats.bot[m.id][d].avg); return { m, gaps, mean: gaps.reduce((a, b) => a + b, 0) / gaps.length }; })
      .sort((a, b) => b.mean - a.mean);
    for (const r of rows) out(`| ${r.m.name} | ${(G.tacticsExDefOf(r.m.id) || {}).name || '-'} | ${r.gaps.map(sgn).join(' | ')} | ${sgn(r.mean)} |`);
  }
  if (heroes.some((m) => m.id === 'Zan')) {
    out();
    out('## ザン(スキル込みで測り直し)');
    out();
    out('ザンはライフ 300・丈夫さ 30 と全員で最も打たれ弱いが、EX「血踊」(3ターン・ラン5回: 敵と同じ距離の枠にいるとき狙われた攻撃を完全回避、回避するたびに与ダメ10%の連撃+1)と');
    out('勇者特性「連撃」(ザンの攻撃に与ダメ30%の連撃)、固有技「連斬」(与ダメ20%の連撃・連撃ダメージ+3%を永続で積む)でステータスの低さを補う作り。');
    out();
    out(`| 難易度 | 前の版(スキル無し) | ${MODES.map((mo) => `${MODE_JA[mo]} 平均 / 序盤越え / クリア`).join(' | ')} | 1ランの血踊 / 回避(bot) | 1ランの血踊 / 回避(best) | 実戦 |`);
    out(`| --- | --- | ${MODES.map(() => '---').join(' | ')} | --- | --- | --- |`);
    for (const d of DIFFS) {
      const old = (OLD['ザン'] || {})[d];
      const r = real[`Zan|${d}`];
      const exCell = (mo) => (stats[mo] ? `${stats[mo].Zan[d].heroEx.toFixed(1)} 回 / ${stats[mo].Zan[d].dodges.toFixed(1)} 回` : '-');
      out(`| ${d} | ${old ? `${old.avg.toFixed(2)}${old.past2 != null ? ` / ${pct(old.past2)} / ${pct(old.clear)}` : ''}` : '-'} | ${MODES.map((mo) => { const s = stats[mo].Zan[d]; return `${s.avg.toFixed(2)} / ${pct(s.past2)} / ${pct(s.clear)}`; }).join(' | ')} | ${exCell('bot')} | ${exCell('best')} | ${r ? `${(r.reduce((a, b) => a + b, 0) / r.length).toFixed(2)}(${r.length} 回)` : '-'} |`);
    }
    out();
    const rank = (mo, d) => [...heroes].sort((a, b) => stats[mo][b.id][d].avg - stats[mo][a.id][d].avg).findIndex((m) => m.id === 'Zan') + 1;
    for (const mo of MODES) out(`- ${MODE_JA[mo]} の順位(平均 WAVE): ${DIFFS.map((d) => `${d} ${rank(mo, d)} 位 / ${heroes.length}`).join('・')}`);
  }
  out();
  out('## ブラウザとの突き合わせ(tactics-knowledge.json の runs)');
  out();
  out('実戦はトレーニング・アシストカードがあるぶん強いはず。ずれは式を合わせに行かず、そのまま書く(差 = 実戦 − シミュレーター)。');
  out('ボットが途中で止まった回(stopped)は除いた。実戦のクリアは WAVE 10 として数えた。「前の版」は 1 版目(スキル無し)。');
  out();
  out(`| 勇者モン | 難易度 | 実戦の回数 | 実戦の平均 WAVE | 前の版 | ${MODES.map((mo) => `${MODE_JA[mo]} | 差`).join(' | ')} |`);
  out(`| --- | --- | --- | --- | --- | ${MODES.map(() => '--- | ---').join(' | ')} |`);
  const gaps = [];
  for (const k of Object.keys(real).sort()) {
    const [id, d] = k.split('|');
    const r = real[k]; const ra = r.reduce((a, b) => a + b, 0) / r.length;
    const old = (OLD[MON_BY_ID[id].name] || {})[d];
    const g = { d, n: r.length, old: old ? ra - old.avg : null };
    MODES.forEach((mo) => { g[mo] = ra - stats[mo][id][d].avg; });
    gaps.push(g);
    out(`| ${MON_BY_ID[id].name} | ${d} | ${r.length} | ${ra.toFixed(2)} | ${old ? old.avg.toFixed(2) : '-'} | ${MODES.map((mo) => `${stats[mo][id][d].avg.toFixed(2)} | ${sgn(g[mo])}`).join(' | ')} |`);
  }
  out();
  out('回数で重みづけした「実戦 − シミュレーター」の平均(0 に近いほど実戦に近い):');
  out();
  out(`| 難易度 | 実戦の回数 | 前の版 | ${MODES.map((mo) => MODE_JA[mo]).join(' | ')} |`);
  out(`| --- | --- | --- | ${MODES.map(() => '---').join(' | ')} |`);
  const summary = [];
  for (const d of DIFFS) {
    const xs = gaps.filter((x) => x.d === d); if (!xs.length) continue;
    const n = xs.reduce((a, x) => a + x.n, 0);
    const w = (key) => { const ys = xs.filter((x) => x[key] != null); const nn = ys.reduce((a, x) => a + x.n, 0); return nn ? ys.reduce((a, x) => a + x[key] * x.n, 0) / nn : null; };
    const line = `| ${d} | ${n} | ${w('old') != null ? sgn(w('old')) : '-'} | ${MODES.map((mo) => sgn(w(mo))).join(' | ')} |`;
    out(line); summary.push(line);
  }
  out();
  out(`(${heroes.length} 体 × ${DIFFS.length} 難易度 × ${RUNS} 回 × 使い方 ${MODES.length} 通りを ${sec} 秒で回した。seed ${SEED})`);
  const text = `${L.join('\n')}\n`;
  if (mdFile) { fs.mkdirSync(path.dirname(path.resolve(mdFile)), { recursive: true }); fs.writeFileSync(path.resolve(mdFile), text); console.log(`書き出した: ${mdFile}`); summary.forEach((s) => console.log(s)); }
  else process.stdout.write(text);
}
