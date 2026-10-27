// ==== AIコピー(ソラシドのアシカ「自動化 → 全自動 → 無人運転」)の出し方・消し方・数え方(共通) ====
// 2026-10-27 社長の決め。使った子の「AIコピー」が次のターンから5人目の味方として戦う。
// ここはタクティクスと5つの遊びの**共通**の部品(バトル部セコンドくん・ダイスくんで分担を決めた)。
//   ・数字と判定(強さ・続くターン・もう一度/切りかえ・コピーの山札と引き方・1枚の選び方)は開発部の 32-sorashido-copy.jsx を呼ぶ
//   ・タクティクスだけの「置き場所・狙い・ヘイト・ライフ・倒れたら消す」は 32-tactics-units.jsx(tacticsAiCopy*)
// どれも「いまの状態を受けて、新しい状態を返す」だけの関数(画面にも保存にも触らない)。aiCopy は保存しない。
//   state … { aiCopy, zones: { deck, hand, discard } }(zones はプレイヤーの山札・手札・捨て札。写しを取るだけで変えない)
//   aiCopy … { srcSlot, srcMonsterId, name, level, spawnTurn, turnsLeft, atk, def, guts, maxGuts, permaAtkPct,
//              hp?, maxHp?(タクティクスだけ), deck, discard, hand, nextCard, picks, pos?, hate?(タクティクスだけ) }
// ★コピーは自分の山札を持つ(2026-10-27 社長「山札自体を別物として扱う」「プレイヤーと同じように引く」)。
//   出たとき(と切りかえたとき)にプレイヤーの山札・手札・捨て札の写しから作り(距離撃・このアシカ・ほかの味方の固有技は抜く)、
//   毎ターン引いて、ターンの終わりに手札を捨て札へ。尽きたら捨て札を混ぜ直す。プレイヤーの山札には何も足さない・抜かない
// ★5つの遊びのコピーはパーティのライフを使う(hp を持たない・狙われない・倒されない。ターン切れで消える)。
//   ここでは hp を「あれば使う」形にして、両方を同じ関数で扱う

// コピーが盤に出ているか(使ったターンの次のターンから)
const isAiCopyOut = (aiCopy, turn) => !!aiCopy && aiCopySafeNum(turn) >= aiCopySafeNum(aiCopy.spawnTurn);

// アシカを使った。src … 元の子のいまの値(タクティクスの1体と同じ形)/
//   turn … 使ったターン(コピーは turn + 1 から出る)/ mode … 'tactics' | 'classic' / extra … 置き場所・ヘイトなど遊びごとに足すもの
const summonAiCopy = (state, { srcSlot, srcMonsterId, name = '', level = 0, src = null, turn = 0,
  mode = 'tactics', effMul = 1, permaAtkPct = 0, extra = null } = {}) => {
  const now = (state && state.aiCopy) || null;
  const zones = (state && state.zones) || { deck: [], hand: [], discard: [] };
  const plan = aiCopySummonPlan(now, { srcSlot, srcMonsterId, level });
  if (plan.kind === 'refresh') {
    return { aiCopy: { ...now, level, turnsLeft: plan.turnsLeft, ...(extra || {}) }, zones, plan };
  }
  // new・switch(plan.rebuildDeck)は山札を作り直す
  const pile = aiCopyBuildDeck(zones, { srcSlot, srcMonsterId });
  const stats = aiCopyStats(src, level, { mode, effMul, permaAtkPct });
  const aiCopy = {
    srcSlot, srcMonsterId, name: String(name || ''), level, spawnTurn: aiCopySafeNum(turn) + 1, turnsLeft: plan.turnsLeft,
    ...stats, deck: pile.deck, discard: pile.discard, hand: [], nextCard: null, picks: [], ...(extra || {}),
  };
  return { aiCopy, zones, plan };
};

// コピーを外す(ターン切れ・倒された・WAVE の終わり・20ターン経過)。プレイヤーの山札は触らない(コピーの山札ごと消える)
const dismissAiCopy = (state) => ({ aiCopy: null, zones: (state && state.zones) || { deck: [], hand: [], discard: [] } });

// ターンの終わりに1つ数える(出ているときだけ)。0 になったら外す
const tickAiCopy = (state, turn) => {
  const now = (state && state.aiCopy) || null;
  if (!isAiCopyOut(now, turn)) return state;
  const end = aiCopyTurnEnd(now);
  if (end.expired) return { ...dismissAiCopy(state), expired: true };
  return { ...state, aiCopy: { ...now, turnsLeft: end.turnsLeft } };
};

// ターンの始め: コピー自身の山札から count 枚引いて(プレイヤーの手札と同じ枚数)、使うカード(0〜2枚)を決める。
//   前のターンの手札が残っていれば、先に捨て札へ回す(endAiCopyTurn を呼び忘れても二重に持たない)
//   score(card) … AUTO の点 / costOf(card) … 消費ガッツ / usable(card) … 選んでよいか(タクティクスは与ダメの出ない攻撃を外す)/
//   rng … 乱数(検査では決まった値を渡す)
const planAiCopyTurn = (aiCopy, { count = SORASHIDO_COPY_HAND_DRAW, score = null, costOf = null, usable = null, rng = Math.random } = {}) => {
  if (!aiCopy) return aiCopy;
  const cleared = (Array.isArray(aiCopy.hand) && aiCopy.hand.length) ? endAiCopyTurn(aiCopy) : aiCopy;
  const drawn = aiCopyDraw({ deck: cleared.deck, discard: cleared.discard }, count, rng);
  const choosable = drawn.hand.filter((c) => typeof usable !== 'function' || usable(c));
  const picks = aiCopyPickCards(choosable, { score, costOf, guts: cleared.guts, maxGuts: cleared.maxGuts, rng, level: cleared.level });
  return { ...cleared, deck: drawn.deck, discard: drawn.discard, hand: drawn.hand, picks, nextCard: picks[0] || null };
};

// ターンの終わり: 手札(使ったカードも使わなかったカードも)を捨て札へ
const endAiCopyTurn = (aiCopy) => {
  if (!aiCopy) return aiCopy;
  const pile = aiCopyDiscardHand({ deck: aiCopy.deck, discard: aiCopy.discard }, aiCopy.hand);
  return { ...aiCopy, deck: pile.deck, discard: pile.discard, hand: [], picks: [], nextCard: null };
};

// コピーが札を選ぶときの点(高いほど良い・2026-10-27 部長「AUTO の見方で選ぶ」)。タクティクスも5つの遊びもこれを通す。
//   並びは AUTO(18-points-and-auto.jsx の chooseAutoTurn の priorityOf)と同じ:
//     offense … 固有技0・攻撃1・ほか2・ガード/回復3 / defense … 回復0・ガード1・ほか2・攻撃3 / それ以外(random) … みな0
//   同じ優先なら dmgOf(card) の大きい順(攻撃でない札は0)。isAttack・isGuard・dmgOf は呼ぶ側の見方を渡す
const aiCopyAutoScore = (card, { strategy = 'random', isAttack = null, isGuard = null, dmgOf = null } = {}) => {
  if (!card) return -Infinity;
  const attack = typeof isAttack === 'function' ? !!isAttack(card) : (card.type === 'atk' || card.type === 'unique');
  const guard = typeof isGuard === 'function' ? !!isGuard(card) : (card.type === 'guard' || card.type === 'weak_guard');
  const prio = strategy === 'offense' ? (card.type === 'unique' ? 0 : attack ? 1 : (guard || card.type === 'heal') ? 3 : 2)
    : strategy === 'defense' ? (card.type === 'heal' ? 0 : card.type === 'guard' ? 1 : attack ? 3 : 2)
    : 0;
  const dmg = attack && typeof dmgOf === 'function' ? Math.max(0, aiCopySafeNum(dmgOf(card))) : 0;
  return -prio * 1e7 + dmg;
};
