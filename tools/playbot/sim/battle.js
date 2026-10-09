// 簡易シミュレーター: タクティクスプロを、ブラウザなしで 1 ラン(WAVE 1〜10)まるごと回す。
//
//   node tools/playbot/sim/battle.js --diff Hard,Expert,Master --runs 300 [--seed 1] [--max-wave 10] [--md <file>]
//   SIM_TRACE=1 を付けると、1ターンごとの経過(予告・使ったカード・与ダメ・ライフ/ガッツ)を出す
//   const { simulateRun } = require('./battle'); simulateRun({ heroId, allies:[id…], difficulty, seed, maxWave })
//
// ★式はゲームのコードから写す(作り変えない)。純粋な部品(createBattleEnemy・chooseEnemyAction・
//   resolveTacticsGuardedHit・buildAttackHits など)は load-game.js でそのまま動かし、
//   React の中(60-app.jsx)にある式だけをここへ行番号つきで写した。行番号は 2026-10-09 の 60-app.jsx のもの。
// ★最初の版で入れていないもの(md の頭にも書く): トレーニング(倒れた子を起こすのも無し)・アシストカード・EX・
//   魂格・固有技の強化・WAVE 報酬の間合いボーナス(distDmgBonus)・固有技の「次のターンから/ずっと続く」効果。
//   入れた固有技の効果は「その場で効くもの」だけ(ハムのスタン・スエゾーのガッツ・オボロゲソウ/プラントの吸収・
//   ゴーレム/モッチー/ミタラシの即時補正・アーク/イブリースの追撃・ゴーストのコイン・スプーキーの輪のダメージ倍率)。
// ★勇者特性は「狙われた子・攻撃した子」の分を入れた(怪力・魔力開放・もち肌・中二病・生命の源・トリックスタート・
//   眼力・回避/反射/吸収の確率・連撃系(buildAttackHits が heroId で見分ける)・ハム/剣士モッチーの枚数+1)。
const fs = require('fs');
const path = require('path');
const { loadGame } = require('./load-game');

const G = loadGame();
const MONS = Object.values(G.ALL_PLAYER_MONSTERS).filter((m) => m && !m.debugOnly);
const MON_BY_ID = Object.fromEntries(MONS.map((m) => [m.id, m]));

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

// ---------- 60-app.jsx から写した式 ----------
const APT_CACHE = new Map();
const aptPctOf = (mon) => { // 60-app.jsx tacticsSlotApt(1185)。Hard〜Master は特殊ルール無し(null)
  if (!APT_CACHE.has(mon.id)) APT_CACHE.set(mon.id, G.getMonsterAptPct(mon, null, 1));
  return APT_CACHE.get(mon.id);
};
const TRACE = !!process.env.SIM_TRACE;
// computeAtkTier(13573)の段階のしきい
const ATK_TIER_THRESHOLDS = [0, 15, 20, 25, 30, 40, 50, 75, 100];
// 60-app.jsx computeAtkTier(13574): 敵がいる距離の枠に立つ子の適性(+ distDmgBonus。ここでは0)で通常技・距離撃の段階が決まる
function computeAtkTier(mons, dist) {
  const mon = mons[dist];
  if (!mon) return 0;
  const pct = (aptPctOf(mon)[dist] || 0) * 100;
  let lvl = 0;
  for (let i = ATK_TIER_THRESHOLDS.length - 1; i >= 0; i--) { if (pct >= ATK_TIER_THRESHOLDS[i]) { lvl = i; break; } }
  return Math.max(0, Math.min(G.BASE_ATK_EVOLUTION.length - 1, lvl));
}
// 60-app.jsx computeGuardLevel(13585)・guardLevelDef(1422)(タクティクスはいちばん硬い子の丈夫さ)
const computeGuardLevel = (defVal) => Math.max(0, Math.min(G.GUARD_EVOLUTION.length - 1, Math.floor((defVal || 0) / 100)));
// 60-app.jsx guardCardCount(13481)
const guardCardCount = (guardLv) => Math.min(4, 2 + Math.floor(Math.max(0, guardLv || 0) / 2));

// 60-app.jsx buildDeck(13485)を簡略化: 通常技2枚・ガード・各子の距離撃1枚・固有技1枚(強化Lv0)。アシストカードは入れない
function buildDeck(mons, aLvl, gLvl, rng) {
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
  return shuffle(pool, rng);
}
// 60-app.jsx applyAtkTierChoice(13552): 敵の距離が変わったら、通常技・距離撃を段階に合わせ直す
function patchAtkTier(card, lvl) {
  if (card.type === 'atk') return { ...card, ...G.BASE_ATK_EVOLUTION[lvl] };
  if (card.type === 'range_atk') { const r = G.RANGE_EVOLUTION[lvl]; return { ...card, guts: r.guts, baseGuts: r.baseGuts, mult: r.mult, baseMult: r.baseMult, crit: r.crit, evoLevel: lvl }; }
  return card;
}

// 60-app.jsx getCardGuts(9215)。バフ・特殊ルールは無し。ゴーストの「裏で+20%」は積まない
function getCardGuts(card) {
  if (!card) return 0;
  let cost = card.type === 'guard' ? 0 : 20;
  if (cost > 0 && ['atk', 'range_atk', 'unique'].includes(card.type)) {
    let baseMult, curMult, baseGuts;
    if (card.type === 'unique') { const level = card.evoLevel || 0; baseMult = card.baseMult; curMult = card.baseMult + level * 0.5; baseGuts = card.baseGuts; }
    else { curMult = card.mult; baseMult = card.baseMult; baseGuts = card.baseGuts; }
    if (baseMult > 0) cost = Math.floor(baseGuts * (curMult / baseMult));
  }
  return cost;
}

// 60-app.jsx getDmg(11048)。攻撃した子のちから・その子の特性・その子の間合い適性。バフは即時補正(oryo/dmgMod)だけ
function getDmg(st, card, slotIdx, additionalOryo, additionalDmgMod, halved, attackStartDist, skillDmgMult = 1) {
  if (!card || ['guard', 'draw', 'buff', 'heal', 'weak_guard'].includes(card.type)) return 0;
  const mon = st.mons[slotIdx];
  const distDiff = Math.abs(slotIdx - attackStartDist);
  const distMult = [1.5, 1.3, 1.1, 0.9][distDiff] || 1.0;
  let baseDmgMult;
  if (card.type === 'unique') baseDmgMult = card.baseMult + (card.evoLevel || 0) * 0.5;
  else if (card.type === 'range_atk') baseDmgMult = G.rangeAttackDamageMultiplier(card, attackStartDist);
  else baseDmgMult = card.mult || card.baseMult || 1.0;
  const id = mon.id;
  const traitMult = (id === 'Golem' ? 1.2 : 1.0) * ((id === 'Pixie' || id === 'Mia') && card.type === 'unique' ? 2.0 : 1.0);
  const distBonusMult = 1.0 + (aptPctOf(mon)[slotIdx] || 0);
  const totalBuffMult = traitMult * (1.0 + additionalOryo) * distBonusMult;
  const unit = G.normalizeTacticsUnit(st.units[slotIdx]);
  const attackerAtk = Math.max(0, unit.atk) * G.trickStartAtkMult(st.trick[slotIdx]);
  let d = Math.floor(attackerAtk * distMult * baseDmgMult * (skillDmgMult > 0 ? skillDmgMult : 1) * totalBuffMult * (1.0 + additionalDmgMod));
  if (halved) d = Math.floor(d * 0.5);
  return d;
}
// 60-app.jsx localBoostFromCard(10997)。固有技は自分の効果を乗せてから同じカードで攻撃する(boostsForCardDamage 11017)
function localBoostFromCard(card) {
  if (card.type === 'unique' && card.monId === 'Golem') return { oryo: 0.075 };
  if (card.type === 'unique' && (card.monId === 'Mocchi' || card.monId === 'Mitarashi')) return { dmgMod: 0.1 };
  return null;
}

// 60-app.jsx getIncomingDamageBeforeTurnReduction(10322)。狙われた子の丈夫さ・特性
function incomingFor(st, intent, slot, { chuuniActive = false } = {}) {
  if (!intent || (intent.type !== 'ATTACK' && intent.type !== 'SPECIAL')) return 0;
  const atkVal = Math.floor(intent.value);
  const unit = G.normalizeTacticsUnit(st.units[slot]);
  const id = unit ? unit.id : null;
  const defVal = (unit ? G.resolveEffectiveMaxStat(unit.def, 0) : 0) * G.trickStartDefMult(st.trick[slot]);
  const defenseRate = Math.min(0.5, defVal * 0.00015);
  const chuuni = chuuniActive && (id === 'Ark' || id === 'Iblis');
  const dmgBase = Math.max(30, (atkVal - defVal * 0.5) * (1 - defenseRate)) * ((id === 'Mocchi' || id === 'Mitarashi') ? 0.8 : 1.0)
    * (chuuni ? 0.5 : 1.0) * G.lifeSourceDamageMult(id, st.turn);
  return Math.max(1, Math.floor(dmgBase));
}
// 60-app.jsx guardDefFor(10962)・guardValueOf(10968)・tacticsSpreadGuardValue・tacticsSlotGuardValue
function slotGuardValue(st, guardBySlot, slot) {
  if (!G.canTacticsSlotAct(st.units, slot)) return 0;
  const def = G.normalizeTacticsUnit(st.units[slot]).def * G.trickStartDefMult(st.trick[slot]);
  const val = (flat, mult) => ((flat > 0 || mult > 0) ? Math.floor(flat + def * mult) : 0);
  const own = guardBySlot[slot];
  if (own && own.cards > 0) return val(own.flat, own.mult);
  if (G.isTacticsSpreadGuard(guardBySlot)) { const g = G.GUARD_EVOLUTION[st.guardLevel]; return val(g.flat * 0.5, g.mult * 0.5); }
  return 0;
}

// ---------- 敵の予告 ----------
// 60-app.jsx spawnEnemy(13594)・advanceEnemyIntents(10216)・aimTacticsIntent(1320)
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
  st.intent = aim(st, reserved || nextAction(st, distAfter, effective, { unannounced: true }));
  st.nextIntent = nextAction(st, distAfterIntent(st.intent, distAfter), st.intent);
}

// ---------- 味方の戦い方(tactics-brain.js decidePick を簡略化) ----------
const TRAIT_EVADE = { Tiger: 50 };
const TRAIT_REFLECT = { Monol: 30 };
const TRAIT_ABSORB = { Oboro: 30, Plant: 30 };
const isAttackType = (c) => ['atk', 'range_atk', 'unique'].includes(c.type);
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
// 1ターンに置けるカード(60-app.jsx baseCardLimit 9169・slotMaxUses 9195)
function cardLimitOf(st) {
  const alive = G.tacticsAliveSlots(st.units);
  let limit = 1;
  if (alive.length >= 3) limit = 3; else if (alive.length >= 2) limit = 2;
  const heroBonus = alive.filter((i) => G.heroCardBonusOf(st.units[i].id) > 0).length;
  return Math.min(5, limit + heroBonus);
}
const slotMaxUses = (st, slot, cardLimit) => Math.min(cardLimit, 1 + G.heroCardBonusOf(st.units[slot] && st.units[slot].id));

function decideTurn(st) {
  const picks = []; // {hi, slot}
  const discards = [];
  const limit = cardLimitOf(st);
  const alive = G.tacticsAliveSlots(st.units);
  const spent = {}; const usesBy = {}; const guarded = {};
  const used = new Set();
  const threat = threatOf(st.intent);
  const turnsLeft = Math.max(1, 20 - st.turn + 1);
  const rushing = st.recentDealt > 0 && st.enemy.hp > st.recentDealt * turnsLeft * 0.9;
  let planned = 0; let stunned = false;
  const gutsLeft = (slot) => G.normalizeTacticsUnit(st.units[slot]).guts - (spent[slot] || 0);
  const aimed = G.tacticsIntentTargets(st.intent, st.units, st.dist);
  const aimDamage = (slot) => (aimed.includes(slot) ? incomingFor(st, st.intent, slot, { chuuniActive: st.chuuniUses < 2 }) : 0);
  while (picks.length + discards.length < limit) {
    const left = limit - picks.length - discards.length;
    const atkOpts = []; const guardOpts = [];
    st.hand.forEach((card, hi) => {
      if (used.has(hi)) return;
      for (const slot of alive) {
        if ((usesBy[slot] || 0) >= slotMaxUses(st, slot, limit)) continue;
        if (card.type === 'unique' && card.ownerSlotIdx !== slot) continue;
        const halved = (usesBy[slot] || 0) > 0;
        if (isAttackType(card)) {
          const cost = getCardGuts(card);
          if (gutsLeft(slot) < cost) continue;
          let value = getDmg(st, card, slot, 0, 0, halved, st.dist);
          const unit = G.normalizeTacticsUnit(st.units[slot]);
          const full = unit.guts >= unit.maxGuts * 0.85;
          let rank = full ? value : value / Math.pow(Math.max(8, cost), 0.7) * 7;
          // 敵が誰もいない距離にいるときは、勇者モンの距離の距離撃で引き寄せる(通常技の段階が上がる)
          if (card.type === 'range_atk' && card.rangeIdx === st.heroSlot && !alive.includes(st.dist)) rank *= 3;
          atkOpts.push({ hi, card, slot, value, rank, cost });
        } else if (card.type === 'guard') {
          const g = G.GUARD_EVOLUTION[st.guardLevel];
          const def = G.normalizeTacticsUnit(st.units[slot]).def;
          guardOpts.push({ hi, card, slot, value: Math.floor(def * g.mult * (halved ? 0.5 : 1)) });
        }
      }
    });
    atkOpts.sort((a, z) => z.rank - a.rank);
    const take = (o, kind) => {
      picks.push({ hi: o.hi, slot: o.slot }); used.add(o.hi);
      usesBy[o.slot] = (usesBy[o.slot] || 0) + 1; spent[o.slot] = (spent[o.slot] || 0) + (o.cost || 0);
      if (kind === 'attack') planned += o.value;
      if (kind === 'guard') guarded[o.slot] = (guarded[o.slot] || 0) + 1;
    };
    // ① とどめ
    const lethal = atkOpts.slice(0, left).reduce((s, x) => s + x.value, 0) + planned >= st.enemy.hp;
    if (!lethal) {
      // ② 予告に合わせた守り
      const needFor = (slot) => {
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
      const s = atkOpts.find((a) => a.card.type === 'unique' && a.card.monId === 'Ham');
      if (s) { take(s, 'attack'); stunned = true; continue; }
    }
    // ⑤ 攻撃
    if (atkOpts.length) { take(atkOpts[0], 'attack'); continue; }
    // ⑦ 捨ててガッツを戻す(ガッツが足りずに使えない攻撃カードがあるとき)
    const starved = st.hand.findIndex((c, hi) => !used.has(hi) && isAttackType(c) && !alive.some((s) => gutsLeft(s) >= getCardGuts(c)));
    if (starved >= 0) { discards.push(starved); used.add(starved); continue; }
    // ⑥' 攻撃が置けないときは、狙われた子(いなければライフのいちばん減った子)へガード
    if (guardOpts.length && threat !== 'pierce' && threat !== 'none') {
      const want = aimed.find((s) => alive.includes(s)) ?? [...alive].sort((p, q) => {
        const a = G.normalizeTacticsUnit(st.units[p]); const b = G.normalizeTacticsUnit(st.units[q]);
        return a.hp / a.maxHp - b.hp / b.maxHp;
      })[0];
      const g = guardOpts.filter((x) => x.slot === want).sort((p, q) => q.value - p.value)[0];
      if (g && (guarded[want] || 0) < 2) { take(g, 'guard'); continue; }
    }
    break;
  }
  return { picks, discards };
}

// ---------- 1ターン(60-app.jsx processTurn 12295〜・敵の番 11257〜・ターン終わり 11751〜) ----------
function playTurn(st) {
  const rng = st.rng;
  // トリックスタート: WAVE の 1・4・7…ターン目に、持っている子それぞれが抽選する(60-app.jsx 13689)
  if (G.trickStartRollTurn(st.turn)) {
    G.tacticsAliveSlots(st.units).forEach((i) => { if (G.hasTrickStartTrait(st.units[i].id)) st.trick[i] = G.rollTrickStart(st.trick[i], rng).stacks; });
  }
  const { picks, discards } = decideTurn(st);
  const startDist = st.dist;
  let attackDistance = st.dist; let forcedMoveTarget = null;
  let localOryo = 0; let localDmgMod = 0; let stun = false; let dealt = 0;
  const guardBySlot = {}; const usesBy = {};
  // 眼力(スエゾー): その子が攻撃したターンに 40% でスタン(60-app.jsx processTurn 12311)
  if (picks.some((p) => isAttackType(st.hand[p.hi]) && st.units[p.slot].id === 'Suezo') && rng() < G.TACTICS_INTIMIDATE_RATE) stun = true;
  for (const { hi, slot } of picks) {
    const card = st.hand[hi];
    const halved = (usesBy[slot] || 0) > 0; usesBy[slot] = (usesBy[slot] || 0) + 1;
    const effMul = halved ? 0.5 : 1;
    if (card.type === 'guard') {
      const g = G.GUARD_EVOLUTION[st.guardLevel];
      const e = guardBySlot[slot] || (guardBySlot[slot] = { flat: 0, mult: 0, weight: 0, cards: 0 });
      e.flat += g.flat * effMul; e.mult += g.mult * effMul; e.cards += 1;
      continue;
    }
    const cost = getCardGuts(card);
    st.units = G.payTacticsGutsAt(st.units, slot, cost).units;
    // 固有技は自分の即時補正を乗せてから攻撃する
    const self = card.type === 'unique' ? localBoostFromCard(card) : null;
    const oryo = localOryo + (self && self.oryo ? self.oryo * effMul : 0);
    const dmgMod = localDmgMod + (self && self.dmgMod ? self.dmgMod * effMul : 0);
    let skillMult = 1;
    if (card.type === 'unique' && card.monId === G.FATE_COIN_MONSTER_ID) skillMult = G.fateCoinDmgMult(G.rollFateCoin(rng));
    if (card.type === 'unique' && card.monId === G.FATE_WHEEL_MONSTER_ID) { const pick = G.rollFateWheel(rng); if (pick.dmgMult) skillMult = pick.dmgMult; }
    const d = getDmg(st, card, slot, oryo, dmgMod, halved, attackDistance, skillMult);
    const mon = st.mons[slot];
    const hits = G.buildAttackHits({ d, card, attackerId: mon.id, heroId: st.heroId, traitOwnerId: mon.id, rollCrit: () => rng() < Math.min(1, card.crit || 0.1) });
    const finalD = hits[0].dmg;
    let total = hits.reduce((s, h) => s + h.dmg, 0);
    if (card.type === 'unique') total += G.attackAtonementDmg(card, finalD, 1);
    dealt += total;
    if (card.type === 'range_atk' && card.rangeIdx != null) { forcedMoveTarget = card.rangeIdx; attackDistance = card.rangeIdx; }
    if (G.hasTrickStartTrait(mon.id) && finalD > 0) st.units = G.recoverTacticsGutsAt(st.units, slot, G.trickStartGutsRefund(cost));
    if (card.type === 'unique') {
      if (card.monId === 'Ham') stun = true;
      else if (card.monId === 'Suezo') st.units = G.rateHealTacticsAt(st.units, slot, 0, 0.5 * effMul).units;
      else if (card.monId === 'Oboro' || card.monId === 'Plant') {
        st.units = G.recoverTacticsGutsAt(G.healTacticsAt(st.units, slot, Math.floor(finalD * 0.5)), slot, Math.floor(finalD * 0.05));
      }
    }
    const boost = localBoostFromCard(card);
    if (boost) { localOryo += (boost.oryo || 0) * effMul; localDmgMod += (boost.dmgMod || 0) * effMul; }
  }
  st.enemy.hp = Math.max(0, st.enemy.hp - dealt);
  if (TRACE) {
    const u = st.units.map((x) => (x ? `${x.id}:${x.hp}/${x.maxHp} g${x.guts}/${x.maxGuts}${x.downed ? '×' : ''}` : '-')).join(' ');
    console.log(`W${st.wave} T${st.turn} 距離${st.dist} 予告${st.intent ? (st.intent.variant || st.intent.type) + ':' + (st.intent.value || '') + '→' + (st.intent.targetSlot ?? '') : '-'} 使う[${picks.map((p) => st.hand[p.hi].type + '@' + p.slot).join(',')}] 捨て${discards.length} 与${dealt} 敵${st.enemy.hp}/${st.enemy.maxHp} | ${u}`);
  }
  st.recentDealt = dealt; st.dealtTotal += dealt;
  if (st.enemy.hp <= 0) return 'clear';
  // 捨てる: 1枚につき、立っている子それぞれの最大ガッツの5%(60-app.jsx 12886)
  if (discards.length) {
    G.tacticsAliveSlots(st.units).forEach((i) => {
      const v = G.normalizeTacticsUnit(st.units[i]);
      const g = Math.max(0, Math.min(v.maxGuts - v.guts, Math.floor(v.maxGuts * G.TACTICS_DISCARD_GUTS_RATE * discards.length)));
      if (g > 0) st.units = G.recoverTacticsGutsAt(st.units, i, g);
    });
  }
  // 手札の補充(60-app.jsx 12898)
  const usedIdx = new Set([...picks.map((p) => p.hi), ...discards]);
  st.graveyard.push(...[...usedIdx].map((i) => st.hand[i]));
  st.hand = st.hand.filter((_, i) => !usedIdx.has(i));
  const replenish = () => { if (!st.deck.length) { if (!st.graveyard.length) return; st.deck = shuffle(st.graveyard, rng); st.graveyard = []; } if (st.deck.length) st.hand.push(st.deck.pop()); };
  while (st.hand.length < 5 && (st.deck.length || st.graveyard.length)) replenish();

  // ===== 敵の番 =====
  const intent = st.intent;
  const performed = !stun;
  if (performed && intent) {
    const actingDist = forcedMoveTarget != null ? forcedMoveTarget : st.dist;
    if (intent.type === 'ROAR') { st.roarStacks += 1; st.enemy.atk = Math.floor(Math.max(0, st.enemy.atk) * G.TACTICS_ROAR_ATK_RATE); }
    else if (intent.type === 'REGEN') st.enemy.hp = Math.min(st.enemy.maxHp, st.enemy.hp + G.tacticsRegenHealAmount(st.enemy.maxHp));
    else if (intent.type === 'ATTACK' || intent.type === 'SPECIAL') {
      const actingIntent = G.tacticsSweepIntent(intent, st.units, actingDist);
      const aimedSlots = G.tacticsIntentTargets(intent, st.units, actingDist);
      const defenseSlot = aimedSlots.length ? aimedSlots[Math.floor(rng() * aimedSlots.length)] : null;
      const dId = defenseSlot != null ? st.units[defenseSlot].id : null;
      const table = G.buildUnifiedSpecialDefense({ existingEvasion: TRAIT_EVADE[dId] || 0, existingReflect: TRAIT_REFLECT[dId] || 0, existingAbsorb: TRAIT_ABSORB[dId] || 0 });
      const res = G.rollUnifiedSpecialDefense(table, rng(), rng());
      // 中二病: 狙われたらWAVEに2回まで被ダメ半分(数えるのは狙われたターン)
      const chuuniActive = st.chuuniUses < 2;
      if (aimedSlots.some((i) => ['Ark', 'Iblis'].includes(st.units[i].id)) && st.chuuniUses < 2) st.chuuniUses += 1;
      if (res === 'absorb') {
        if (defenseSlot != null) {
          const gain = incomingFor(st, actingIntent, defenseSlot, { chuuniActive });
          st.units = G.recoverTacticsGutsAt(G.healTacticsAt(st.units, defenseSlot, gain), defenseSlot, Math.floor(gain * 0.1));
        }
      } else {
        const rushHits = intent.variant === 'rush' ? Math.max(1, Math.floor(Number(intent.hits) || 1)) : 1;
        let reflectBack = 0;
        for (const slot of aimedSlots) {
          if (res === 'evasion' && slot === defenseSlot) continue;
          if (res === 'reflect' && slot === defenseSlot) { reflectBack += incomingFor(st, actingIntent, slot, { chuuniActive }); continue; }
          const own = guardBySlot[slot] || { cards: 0 };
          const base = slotGuardValue(st, guardBySlot, slot);
          const slotGuard = intent.variant === 'pierce' ? 0 : base;
          const hit = G.resolveTacticsGuardedHit(incomingFor(st, actingIntent, slot, { chuuniActive }), rushHits, slotGuard, G.tacticsGuardHits(own.cards, rushHits));
          if (hit.taken > 0) { st.units = G.damageTacticsTargets(st.units, [slot], hit.taken); st.taken += hit.taken; }
          if (hit.saved > 0) st.units = G.recoverTacticsGutsAt(G.healTacticsAt(st.units, slot, hit.saved), slot, Math.floor(hit.saved * 0.1));
        }
        if (reflectBack > 0) { st.enemy.hp = Math.max(0, st.enemy.hp - reflectBack); if (st.enemy.hp <= 0) return 'clear'; }
      }
    }
  }
  if (G.isTacticsWipedOut(st.units)) return 'wipe';
  // 敵の距離: 距離撃で動かしていればそこ、敵が移動したならその先(60-app.jsx 12950〜12957)
  const distAfter = forcedMoveTarget != null ? forcedMoveTarget
    : (performed && intent && intent.type === 'MOVE' ? intent.targetDist : st.dist);
  st.dist = distAfter;
  advanceIntents(st, intent, distAfter, performed);
  // ターン終わりの回復(60-app.jsx 11751〜): ライフ autoHpRecovery、ガッツ 5% + (autoHpRecovery − 10%)。倒れた子は上限の10%
  const gutsRate = Math.max(0, 0.05 + (st.autoHp - 0.1));
  st.units = G.rateHealTacticsBoard(st.units, st.autoHp, gutsRate, false).units;
  st.units = G.regenDownedTacticsBoard(st.units).units;
  // 生命の源: 次のターンが 6・9・12… ならガッツ30%。トリックスタートの「毎ターン回復」
  G.tacticsAliveSlots(st.units).forEach((i) => {
    if (G.lifeSourceGutsTurn(st.units[i].id, st.turn + 1)) st.units = G.rateHealTacticsAt(st.units, i, 0, G.LIFE_SOURCE_GUTS_RATE).units;
    const r = G.trickStartRegenRate(st.trick[i]);
    if (r > 0) st.units = G.rateHealTacticsAt(st.units, i, r, 0).units;
  });
  // 通常技・距離撃の段階を、敵の今の距離に合わせ直す(syncAtkTierForDist)
  if (st.dist !== startDist) {
    const lvl = computeAtkTier(st.mons, st.dist);
    const fix = (c) => patchAtkTier(c, lvl);
    st.hand = st.hand.map(fix); st.deck = st.deck.map(fix); st.graveyard = st.graveyard.map(fix);
  }
  return null;
}

// ---------- 1ラン ----------
const bestSlotFor = (mon, free) => free.slice().sort((a, b) => (G.DIST_APTITUDE_MULT[(mon.distAptitude || [])[b]] ?? 1) - (G.DIST_APTITUDE_MULT[(mon.distAptitude || [])[a]] ?? 1) || a - b)[0];

function simulateRun({ heroId, allies = [], difficulty = 'Hard', seed = 1, maxWave = 10 }) {
  const rng = mulberry32(hashSeed(seed, heroId, difficulty, allies.join(',')));
  const hero = MON_BY_ID[heroId];
  if (!hero) throw new Error(`勇者モンが見つからない: ${heroId}`);
  const st = {
    rng, heroId, difficulty, mons: [null, null, null, null], units: [null, null, null, null], trick: [{}, {}, {}, {}],
    autoHp: 0.1, joinCatchUp: 1, powerStart: monsterPowerOf(hero), powerNow: monsterPowerOf(hero),
    dealtTotal: 0, taken: 0, recentDealt: 0, turnsTotal: 0, waveTurns: [],
  };
  st.heroSlot = bestSlotFor(hero, [0, 1, 2, 3]);
  st.mons[st.heroSlot] = hero; st.units[st.heroSlot] = G.createTacticsUnit(hero);
  const waiting = allies.slice();
  for (let w = 1; w <= maxWave; w++) {
    st.wave = w;
    // 敵を出す(60-app.jsx spawnEnemy 13594): 総合力で敵が強くなる
    st.enemy = G.createBattleEnemy(w, difficulty, null, null, G.tacticsEnemyPowerMultiplier(st.powerStart, st.powerNow), { mode: 'tacticsPro' });
    st.dist = w === 1 ? st.heroSlot : Math.floor(rng() * 4);
    st.roarStacks = 0; st.chuuniUses = 0; st.trick = [{}, {}, {}, {}]; st.recentDealt = 0;
    st.guardLevel = computeGuardLevel(G.tacticsMaxDef(st.units));
    const pool = buildDeck(st.mons, computeAtkTier(st.mons, st.dist), st.guardLevel, rng);
    st.hand = pool.slice(0, 5); st.deck = pool.slice(5); st.graveyard = [];
    st.intent = aim(st, nextAction(st, st.dist, null, { unannounced: true }));
    st.nextIntent = nextAction(st, distAfterIntent(st.intent, st.dist), st.intent);
    let out = null;
    for (st.turn = 1; st.turn <= 20; st.turn++) {
      out = playTurn(st);
      if (out) break;
    }
    const turns = Math.min(st.turn, 20);
    st.turnsTotal += turns; st.waveTurns.push(turns);
    if (out !== 'clear') return { result: out === 'wipe' ? 'wipe' : 'timeout', wave: w, turns: st.turnsTotal, waveTurns: st.waveTurns, dealt: st.dealtTotal, taken: st.taken };
    // WAVE を抜けた(60-app.jsx resolveEnemyDefeat 11122〜): 追いつき補正と自動回復の率
    const remaining = Math.max(0, 21 - st.turn);
    st.joinCatchUp = G.addTacticsJoinCatchUp(st.joinCatchUp, remaining);
    st.autoHp = Math.max(0, st.autoHp + Math.max(-0.05, Math.min(0.05, (remaining - 10) * 0.005)));
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
  return { result: 'clear', wave: maxWave, turns: st.turnsTotal, waveTurns: st.waveTurns, dealt: st.dealtTotal, taken: st.taken };
}

function pickAllies(heroId, rng, n = 3) {
  return shuffle(MONS.map((m) => m.id).filter((id) => id !== heroId), rng).slice(0, n);
}

module.exports = { simulateRun, pickAllies, monsterPowerOf, MONS };

// ---------- 一括で回す ----------
if (require.main === module) {
  const args = process.argv.slice(2);
  const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const DIFFS = argOf('--diff', 'Hard,Expert,Master').split(',');
  const RUNS = Number(argOf('--runs', '300'));
  const SEED = Number(argOf('--seed', '1'));
  const MAX_WAVE = Number(argOf('--max-wave', '10'));
  const mdFile = argOf('--md', '');
  const t0 = Date.now();
  const stats = {}; // [heroId][diff]
  const median = (a) => { const s = a.slice().sort((x, y) => x - y); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
  for (const m of MONS) {
    stats[m.id] = {};
    for (const d of DIFFS) {
      const waves = []; let past2 = 0; let clear = 0; let wipe = 0; let timeout = 0;
      for (let i = 0; i < RUNS; i++) {
        const allies = pickAllies(m.id, mulberry32(hashSeed(SEED, 'allies', m.id, d, i)));
        const r = simulateRun({ heroId: m.id, allies, difficulty: d, seed: hashSeed(SEED, i), maxWave: MAX_WAVE });
        waves.push(r.wave);
        if (r.wave > 2 || r.result === 'clear') past2++;
        if (r.result === 'clear') clear++; else if (r.result === 'wipe') wipe++; else timeout++;
      }
      stats[m.id][d] = { avg: waves.reduce((a, b) => a + b, 0) / waves.length, med: median(waves), past2: past2 / RUNS, clear: clear / RUNS, wipe: wipe / RUNS, timeout: timeout / RUNS };
    }
  }
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  // ブラウザの実戦(tactics-knowledge.json)。ボットが止まった回(stopped)は数えない
  const knowledge = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tactics-knowledge.json'), 'utf8'));
  const idByName = Object.fromEntries(MONS.map((m) => [m.name, m.id]));
  const real = {};
  for (const r of knowledge.runs || []) {
    if (r.mode !== 'tacticsPro' || !['clear', 'wipe', 'timeout'].includes(r.result)) continue;
    const id = idByName[r.hero]; if (!id || !DIFFS.includes(r.difficulty)) continue;
    const k = `${id}|${r.difficulty}`;
    (real[k] = real[k] || []).push(r.result === 'clear' ? MAX_WAVE : Number(r.wave) || 0);
  }

  const L = []; const out = (t = '') => L.push(t);
  const pct = (x) => `${Math.round(x * 100)}%`;
  out(`# 簡易シミュレーター(タクティクスプロ・${DIFFS.join(' / ')}・各 ${RUNS} 回)`);
  out();
  out('`node tools/playbot/sim/battle.js` の出力。式はゲームのコード(60-app.jsx・22-enemy・32-tactics-units)から写したもの。');
  out();
  out('**入れていないもの**(実戦より弱く出る): トレーニング(倒れた子を起こす選択も無し)・アシストカード・EX・魂格・固有技の強化・');
  out('WAVE 報酬の間合いボーナス・固有技の「次のターンから」「ずっと続く」効果(ピクシー/ミーアの消費0、ライガーの会心確定、モノリスの反射、');
  out('絶氷の楔、大樹の加護など)。入れた固有技の効果は、その場で効くもの(ハムのスタン・スエゾーのガッツ・吸収・ゴーレム/モッチーの即時補正・');
  out('追撃・コイン/輪のダメージ倍率)だけ。勇者特性は入れた。');
  out();
  out(`編成: 勇者モン1体で始め、WAVE 2・4・6 のあとに供モンが1体ずつ加わる(ゲームの POST_WAVE_JOIN_WAVES)。供モンは debugOnly でない子から seed で3体。`);
  out('置く枠は適性のいちばん高い空き枠。あとから入る子には追いつき補正(残りターン×1%を WAVE ごとに積む)が乗る。敵は編成の総合力で強くなる。');
  out('戦い方は tactics-brain.js の decidePick を縮めたもの(とどめ → 予告に合わせた守り → ハムのスタン → ガッツ1あたりの火力で攻撃 → 捨ててガッツを戻す → 余ればガード)。');
  out();
  out('「届いた WAVE」は負けた WAVE(クリアは 10)。「序盤越え」は WAVE 1〜2(1体の時間)を越えた割合。');
  for (const d of DIFFS) {
    out();
    out(`## ${d}`);
    out();
    out('| 勇者モン | 届いた WAVE 平均 | 中央値 | 序盤越え | クリア率 | 全滅 / 時間切れ |');
    out('| --- | --- | --- | --- | --- | --- |');
    for (const m of [...MONS].sort((a, b) => stats[b.id][d].avg - stats[a.id][d].avg)) {
      const s = stats[m.id][d];
      out(`| ${m.name} | ${s.avg.toFixed(2)} | ${s.med} | ${pct(s.past2)} | ${pct(s.clear)} | ${pct(s.wipe)} / ${pct(s.timeout)} |`);
    }
  }
  out();
  out('## ブラウザとの突き合わせ(tactics-knowledge.json の runs)');
  out();
  out('実戦はトレーニング・アシストカード・EX があるぶん強いはず。ずれは式を合わせに行かず、そのまま書く(差 = 実戦 − シミュレーター)。');
  out('ボットが途中で止まった回(stopped)は除いた。実戦のクリアは WAVE 10 として数えた。');
  out();
  out('| 勇者モン | 難易度 | 実戦の回数 | 実戦の平均 WAVE | シミュレーターの平均 WAVE | 差 |');
  out('| --- | --- | --- | --- | --- | --- |');
  const diffs = [];
  for (const k of Object.keys(real).sort()) {
    const [id, d] = k.split('|');
    const r = real[k]; const ra = r.reduce((a, b) => a + b, 0) / r.length;
    const sa = stats[id][d].avg; diffs.push({ d, gap: ra - sa, n: r.length });
    out(`| ${MON_BY_ID[id].name} | ${d} | ${r.length} | ${ra.toFixed(2)} | ${sa.toFixed(2)} | ${(ra - sa >= 0 ? '+' : '')}${(ra - sa).toFixed(2)} |`);
  }
  out();
  for (const d of DIFFS) {
    const xs = diffs.filter((x) => x.d === d); if (!xs.length) continue;
    const n = xs.reduce((a, x) => a + x.n, 0); const g = xs.reduce((a, x) => a + x.gap * x.n, 0) / n;
    const up = xs.filter((x) => x.gap > 0).length;
    out(`- ${d}: 実戦 ${n} 回(勇者 ${xs.length} 体)。回数で重みづけした差の平均 ${(g >= 0 ? '+' : '')}${g.toFixed(2)} WAVE。実戦のほうが先まで届いた勇者 ${up} / ${xs.length} 体`);
  }
  out();
  out(`(${MONS.length} 体 × ${DIFFS.length} 難易度 × ${RUNS} 回を ${sec} 秒で回した。seed ${SEED})`);
  const text = `${L.join('\n')}\n`;
  if (mdFile) { fs.mkdirSync(path.dirname(path.resolve(mdFile)), { recursive: true }); fs.writeFileSync(path.resolve(mdFile), text); console.log(`書き出した: ${mdFile}`); }
  else process.stdout.write(text);
}
