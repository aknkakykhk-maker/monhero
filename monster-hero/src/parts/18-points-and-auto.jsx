// 強化ポイント1つあたりのステータス上昇量。ライフだけ他より大きく上がる(バランス調整中の暫定値)
const STAT_POINT_GAIN = { hp: 10, atk: 3, def: 3, guts: 3 };
// 強化ポイントで伸ばせる能力の表示名。強化の下書き適用(applyEnhancePlanToMasu)からも見るのでモジュール直下に置く
const STAT_POINT_KEYS = { hp: 'ライフ', atk: 'ちから', def: '丈夫さ', guts: 'ガッツ' };
// 間合い適性は「距離ごとの与ダメージ補正(%)」として扱う。
// Cが±0、Mなら+25%、Gなら-20%。編成した勇者モン・供モンの補正は、そのモンスターを
// どの距離に置いたかに関係なく、4距離すべての補正値へ加算されていく。
// 例) 零距離の補正が+6%のところへ、零距離M(+25%)のモンスターが合流すると+31%になる。
const aptGradeToPct = (grade) => (DIST_APTITUDE_MULT[grade] ?? 1.0) - 1.0;
// モンスター(素の種・マスモン反映後のどちらでも可)の4距離分の補正値(小数)を返す
const getMonsterAptPct = (mon, nightmare=false, waveNumber=1) => {
  const apt = (mon && mon.distAptitude) || ['C','C','C','C'];
  return [0,1,2,3].map(i => applyNightmareSignedModifier(aptGradeToPct(apt[i] || 'C'), nightmare,waveNumber));
};
// 補正値の表示用文字列(小数第1位まで。整数のときは小数を出さない)
const formatAptPct = (v) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${Math.round(Math.abs(v) * 1000) / 10}%`;
// 合流ボーナス欄に出す間合い適性の加算表示(例: 「零+25% 中-5%」)。加算が無ければ空文字
const formatAptBonus = (mon) => getMonsterAptPct(mon)
  .map((d, i) => d !== 0 ? `${RANGE_LABELS[i]}${formatAptPct(d)}` : null)
  .filter(Boolean).join(' ');
// マスモンが「これまでに得たはずの強化ポイント総数」は絆レベル-1で決まる。
// 使用済み(間合い適性・ステータス強化に振った分)と未使用の合計がこれを下回っていたら、
// 不足分を未使用ポイントとして補填したマスモンを返す。
const ENHANCE_POINT_BAND_REPAIR_VERSION = 1;
const normalEnhanceSpentPoints = (masu, base) => {
  const aptSpent = Array.isArray(masu?.distAptBoosts)
    ? masu.distAptBoosts.reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0)
    : (Array.isArray(masu?.distApt) && base?.distAptitude
      ? masu.distApt.reduce((sum, grade, index) => {
          const from = DIST_APTITUDE_GRADES.indexOf(base.distAptitude[index]);
          const to = DIST_APTITUDE_GRADES.indexOf(grade);
          return sum + (from >= 0 && to >= 0 ? Math.max(0, to - from) : 0);
        }, 0)
      : 0);
  const statSpent = Object.keys(STAT_POINT_GAIN).reduce((sum, key) => {
    const gain = Math.max(1, Number(STAT_POINT_GAIN[key]) || 1);
    const value = Math.max(0, Number(masu?.statPoints?.[key]) || 0);
    return sum + Math.ceil(value / gain);
  }, 0);
  return { aptSpent, statSpent, total:aptSpent + statSpent };
};
const earnedEnhancePointTotal = (masu) => {
  const normalized = normalizeMasuProgression(masu);
  return levelBasedEnhancePoints(masuBondLevelInfo(normalized).level)
    + totalBreakthroughPoints(normalized.rebirthCount)
    + ownReincarnateBonusPoints(normalized)
    + inheritedReincarnateBonusPointsOf(normalized);
};
const repairEnhancePointBandOvergrant = (masu) => {
  if (!masu || Math.floor(Number(masu.enhancePointBandRepairVersion) || 0) >= ENHANCE_POINT_BAND_REPAIR_VERSION) return masu;
  // 旧形式ゴーレムは、過去のベース適性変更(A/C/E/G → A/E/G/G)により distApt だけでは
  // 実際に使った適性Pを一意に戻せない。reconcileMasuPoints と同じく、distAptBoosts を持つ
  // 新形式へ安全に移行済みになるまでは推測でポイントを減らしたり通常強化を白紙化しない。
  if (masu.baseId === 'Golem' && !Object.prototype.hasOwnProperty.call(masu, 'distAptBoosts')) return masu;
  const normalized = normalizeMasuProgression(masu);
  if (normalized.rebirthCount < 34) return masu;
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[normalized.baseId] : null;
  if (!base) return masu;
  const level = masuBondLevelInfo(normalized).level;
  const correctLevelPoints = levelBasedEnhancePoints(level);
  const badLevelPoints = legacyRetroactiveLevelBasedEnhancePoints(level, normalized.rebirthCount);
  const knownOvergrant = Math.max(0, badLevelPoints - correctLevelPoints);
  if (knownOvergrant <= 0) return masu;
  const bonusPoints = totalBreakthroughPoints(normalized.rebirthCount)
    + ownReincarnateBonusPoints(normalized)
    + inheritedReincarnateBonusPointsOf(normalized);
  const badTotal = badLevelPoints + bonusPoints;
  const spent = normalEnhanceSpentPoints(normalized, base);
  const unused = Math.max(0, Math.floor(Number(normalized.distAptPoints) || 0));
  const currentTotal = spent.total + unused;
  // 不具合版を通った個体なら、少なくとも誤式の総数まで補填されている。
  // そこに届いていない個体は「不具合による増加」と断定できないので減らさない。
  if (currentTotal < badTotal) return masu;
  const targetTotal = Math.max(0, currentTotal - knownOvergrant); // 不具合以前からの余剰があればそのまま保持
  if (unused >= knownOvergrant) {
    return {
      ...masu,
      distAptPoints: unused - knownOvergrant,
      enhancePointBandRepairVersion: ENHANCE_POINT_BAND_REPAIR_VERSION,
    };
  }
  // 過剰分が能力・適性へ既に振られている場合、「どの振り分けが過剰分だったか」は保存履歴から判別不能。
  // 任意の能力だけ削るより、通常強化だけを白紙にして正しい総数を未使用Pへ戻す。
  // 超越強化・個体基礎値・固有技・限界突破・転生・合体履歴などは一切触らない。
  return {
    ...masu,
    distAptPoints: targetTotal,
    statPoints: { hp:0, atk:0, def:0, guts:0 },
    distAptBoosts: [0,0,0,0],
    distApt: [...base.distAptitude],
    enhancePointBandRepairVersion: ENHANCE_POINT_BAND_REPAIR_VERSION,
  };
};
//
// 必要経験値の緩和(BOND_XP_DISCOUNTの引き下げ)を行うと、同じ絆経験値のまま絆レベルだけが
// 上がるため、レベルアップ時に配っている強化ポイントが後追いで配られず
// 「絆レベル8なのにポイントが4しかない」という食い違いが起きていた。
// 読み込み時にここを通すことで、過去の緩和分も今後の調整分も自動的に辻褄が合う。
const reconcileMasuPoints = (masu) => {
  const base = (typeof ALL_PLAYER_MONSTERS !== 'undefined') ? ALL_PLAYER_MONSTERS[masu.baseId] : null;
  if (!base) return masu;
  // 旧ゴーレムはベース適性が A/C/E/G から A/E/G/G へ変わっており、完成値の distApt だけでは
  // 実際に何段階強化したかを一意に戻せない。現在ベースとの差を使用済みポイントとして推測すると
  // 不足補填を誤るため、新形式になるまでは既存の能力・適性・ポイントを丸ごと保留する。
  if (masu.baseId === 'Golem' && !Object.prototype.hasOwnProperty.call(masu, 'distAptBoosts')) return masu;
  const baseApt = base.distAptitude || ['C','C','C','C'];
  const aptSpent = Array.isArray(masu.distAptBoosts)
    ? masu.distAptBoosts.reduce((sum, value) => sum + Math.max(0, Math.floor(Number(value) || 0)), 0)
    : (masu.distApt || baseApt).reduce((sum, g, i) => sum + Math.max(0, DIST_APTITUDE_GRADES.indexOf(g) - DIST_APTITUDE_GRADES.indexOf(baseApt[i])), 0);
  const statSpent = Object.entries(masu.statPoints || {}).reduce((sum, [key, val]) => sum + Math.ceil((val || 0) / (STAT_POINT_GAIN[key] || 1)), 0);
  // 合体で上がったレベルも「絆レベルが上がった」ことに変わりはないので、強化ポイントの
  // 付与対象に含める(合体の確認画面も「強化ポイント +N」と出しており、実際に増えていなかった)。
  // 過去に合体でレベルを上げた分も、ここの不足補填でまとめて受け取れる。
  // 限界突破・転生でもらえるぶんも「得たはずの総数」に含める。ここに入れておかないと、
  // 限界突破の直後にレベルが1つ上がったとき「レベルぶんの不足」として相殺されてしまい、
  // せっかく足したポイントが消えたように見える。
  // ここを新しい方式で数え直すことが、そのまま既存のマスモンの調整にもなる
  // (読み込みのたびに不足分だけを補うので、二重に配られることはない)。
  // 通常強化ポイントの「レベル由来ぶん」は levelBasedEnhancePoints が正本。
  // Lv1→270は1P、270→330は2P、330→400は3Pで、現在の凸数を過去レベルへ遡及しない。
  // Lv401以降で得られるのは通常Pではなく超越P。
  const earned = levelBasedEnhancePoints(masuBondLevelInfo(masu).level)
    + totalBreakthroughPoints(masu.rebirthCount)
    + ownReincarnateBonusPoints(masu)
    + inheritedReincarnateBonusPointsOf(masu);
  const missing = earned - (aptSpent + statSpent + (masu.distAptPoints || 0));
  return missing > 0 ? { ...masu, distAptPoints: (masu.distAptPoints || 0) + missing } : masu;
};
const RANGE_STYLES = {
  0: { bg: "bg-red-950/90", border: "border-red-500", text: "text-red-400", shadow: "shadow-red-500/50", glow: "drop-shadow-[0_0_15px_rgba(239,68,68,0.9)]", slotBg: "bg-red-900/50", labelBg: "bg-red-600 text-white" },
  1: { bg: "bg-yellow-950/90", border: "border-yellow-500", text: "text-yellow-400", shadow: "shadow-yellow-500/50", glow: "drop-shadow-[0_0_15px_rgba(234,179,8,0.9)]", slotBg: "bg-yellow-900/50", labelBg: "bg-yellow-600 text-black" },
  2: { bg: "bg-emerald-950/90", border: "border-emerald-500", text: "text-emerald-400", shadow: "shadow-emerald-500/50", glow: "drop-shadow-[0_0_15px_rgba(16,185,129,0.9)]", slotBg: "bg-emerald-900/50", labelBg: "bg-emerald-600 text-white" },
  3: { bg: "bg-blue-950/90", border: "border-blue-500", text: "text-blue-400", shadow: "shadow-blue-500/50", glow: "drop-shadow-[0_0_15px_rgba(59,130,246,0.9)]", slotBg: "bg-blue-900/50", labelBg: "bg-blue-600 text-white" }
};

const AUTO_SETTINGS_KEY = 'mh_auto_settings_v1';
const AUTO_STRATEGIES = ['random','offense','defense','guts'];
const DEFAULT_AUTO_SETTINGS = Object.freeze({
  strategy:'random',
  allies:[
    { rosterEntry:null, slot:null },
    { rosterEntry:null, slot:null },
    { rosterEntry:null, slot:null },
  ],
});
// roster entry が正本。候補外・重複・壊れた距離は、安全な未指定/自動へ落とす。
const normalizeAutoSettings = (value, validRosterEntries = null) => {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const valid = validRosterEntries == null ? null : new Set(Array.isArray(validRosterEntries) ? validRosterEntries : []);
  const seen = new Set();
  const allies = Array.from({length:3}, (_, index) => {
    const raw = Array.isArray(source.allies) && source.allies[index] && typeof source.allies[index] === 'object' ? source.allies[index] : {};
    const entry = typeof raw.rosterEntry === 'string' && raw.rosterEntry.length > 0 ? raw.rosterEntry : null;
    const rosterEntry = entry && (!valid || valid.has(entry)) && !seen.has(entry) ? entry : null;
    if (rosterEntry) seen.add(rosterEntry);
    const slot = raw.slot === null || raw.slot === undefined ? null : Number(raw.slot);
    return { rosterEntry, slot:Number.isInteger(slot) && slot >= 0 && slot <= 3 ? slot : null };
  });
  return { strategy:AUTO_STRATEGIES.includes(source.strategy) ? source.strategy : 'random', allies };
};

// AUTOの1ターンぶんの選択だけを組み立てる。実際の選択stateや戦闘進行には触れず、
// 手動操作と同じ判定関数を呼び出し側から受け取ることで、カードルールを二重管理しない。
const chooseAutoTurn = ({
  hand = [], slots = [], guts = 0, cardLimit = 0, strategy = 'random',
  getCardGuts, cardNeedsMonster, slotMaxUses,
}, rng = Math.random) => {
  if (!Array.isArray(hand) || !Array.isArray(slots) || typeof getCardGuts !== 'function'
      || typeof cardNeedsMonster !== 'function' || typeof slotMaxUses !== 'function') return [];
  const limit = Math.max(0, Math.floor(Number(cardLimit) || 0));
  const availableGuts = Math.max(0, Number(guts) || 0);
  const picked = [];
  const usedHandIndexes = new Set();
  const slotUseCounts = Array(slots.length).fill(0);
  let usedGuts = 0;

  const legalActions = () => {
    const actions = [];
    hand.forEach((card, handIndex) => {
      if (!card || usedHandIndexes.has(handIndex)) return;
      const cost = Math.max(0, Number(getCardGuts(card)) || 0);
      if (usedGuts + cost > availableGuts) return;
      if (!cardNeedsMonster(card)) {
        actions.push({ handIndex, card, slotIdx:null, cost });
        return;
      }
      slots.forEach((monster, slotIdx) => {
        if (!monster) return;
        if (card.type === 'unique' && card.ownerSlotIdx !== slotIdx) return;
        const maxUses = Math.max(0, Math.floor(Number(slotMaxUses(monster)) || 0));
        if (slotUseCounts[slotIdx] >= maxUses) return;
        actions.push({ handIndex, card, slotIdx, cost });
      });
    });
    return actions;
  };
  const attackCard = card => !!card && cardNeedsMonster(card);
  const priorityOf = card => {
    if (strategy === 'offense') {
      if (card.type === 'unique') return 0;
      if (attackCard(card)) return 1;
      if (card.type === 'guard' || card.type === 'heal') return 3;
      return 2;
    }
    if (strategy === 'defense') {
      if (card.type === 'heal') return 0;
      if (card.type === 'guard') return 1;
      return attackCard(card) ? 3 : 2;
    }
    return 0;
  };
  const randomIndex = length => Math.min(length - 1, Math.max(0, Math.floor((Number(rng()) || 0) * length)));

  while (picked.length < limit) {
    let actions = legalActions();
    // ★重要: どの方針でも「敵のライフが1も減らないターン」を作らない。
    // 耐久重視はガードが常に手札にあり、ガードの優先度が攻撃より高かったため、
    // 毎ターン守りだけを選び続けて敵のライフが1も減らず、20ターン切れでそのまま負けていた
    // (イブリースのAUTOで実際に発生。固有技が高ガッツで撃てず、残りが通常技とガードだった)。
    // そのターンの最後の1枠まで来ても攻撃を1枚も選んでいないときは、
    // 攻撃できるならその中から選ぶ。攻撃が1つも使えないときは、これまでどおり守りを選ぶ。
    const needsAttack = picked.length === limit - 1 && !picked.some(entry => attackCard(entry.card));
    if (needsAttack) {
      const attacks = actions.filter(action => attackCard(action.card));
      if (attacks.length > 0) actions = attacks;
    }
    if (strategy === 'guts') {
      const attacks = actions.filter(action => attackCard(action.card));
      actions = attacks.length ? attacks : actions;
      if (!actions.length) break;
      const lowestCost = Math.min(...actions.map(action => action.cost));
      actions = actions.filter(action => action.cost === lowestCost);
    } else if (strategy !== 'random') {
      if (!actions.length) break;
      const bestPriority = Math.min(...actions.map(action => priorityOf(action.card)));
      actions = actions.filter(action => priorityOf(action.card) === bestPriority);
    }
    if (!actions.length) break;
    const action = actions[randomIndex(actions.length)];
    picked.push({ handIndex:action.handIndex, card:action.card, slotIdx:action.slotIdx });
    usedHandIndexes.add(action.handIndex);
    usedGuts += action.cost;
    if (action.slotIdx != null) slotUseCounts[action.slotIdx]++;
    if (strategy === 'guts') break;
  }
  return picked;
};

// 現在の配置・手札では合法だが、ガッツだけが足りない行動があるかを確認する。
// 方針や合法判定はchooseAutoTurnへ一本化し、存在確認なので固定rngを使う。
const hasAutoTurnWithEnoughGuts = options => chooseAutoTurn({
  ...options,
  guts:Number.MAX_SAFE_INTEGER,
}, () => 0).length > 0;
