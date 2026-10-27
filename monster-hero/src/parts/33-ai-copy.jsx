// ==== AIコピー(ソラシドのアシカ「自動化 → 全自動 → 無人運転」)の出し方・消し方・数え方(共通) ====
// 2026-10-27 社長の決め。使った子の「AIコピー」が次のターンから5人目の味方として戦う。
// ここはタクティクスと5つの遊びの**共通**の部品(バトル部セコンドくん・ダイスくんで分担を決めた)。
//   ・数字と判定(強さ・続くターン・もう一度/切りかえ・手札・1枚の選び方・固有技の写し)は開発部の 32-sorashido-copy.jsx を呼ぶ
//   ・タクティクスだけの「置き場所・狙い・ヘイト・ライフ・倒れたら消す」は 32-tactics-units.jsx(tacticsAiCopy*)
// どれも「いまの状態を受けて、新しい状態を返す」だけの関数(画面にも保存にも触らない)。aiCopy は保存しない。
//   state … { aiCopy, zones: { deck, hand, discard } }(zones はみんなの山札・手札・捨て札。コピーの固有技の写しを出し入れする)
//   aiCopy … { srcSlot, srcMonsterId, name, level, spawnTurn, turnsLeft, atk, def, guts, maxGuts, permaAtkPct,
//              hp?, maxHp?(タクティクスだけ), hand, nextCard, picks, uniqueCardUid, pos?, hate?(タクティクスだけ) }
// ★5つの遊びのコピーはパーティのライフを使う(hp を持たない・狙われない・倒されない。ターン切れで消える)。
//   ここでは hp を「あれば使う」形にして、両方を同じ関数で扱う

// コピーが盤に出ているか(使ったターンの次のターンから)
const isAiCopyOut = (aiCopy, turn) => !!aiCopy && aiCopySafeNum(turn) >= aiCopySafeNum(aiCopy.spawnTurn);

// アシカを使った。src … 元の子のいまの値(タクティクスの1体と同じ形)/ uniqueCard … 元の子の固有技のカード /
//   turn … 使ったターン(コピーは turn + 1 から出る)/ mode … 'tactics' | 'classic' / extra … 置き場所・ヘイトなど遊びごとに足すもの
const summonAiCopy = (state, { srcSlot, srcMonsterId, name = '', level = 0, src = null, uniqueCard = null, turn = 0,
  mode = 'tactics', effMul = 1, permaAtkPct = 0, extra = null } = {}) => {
  const now = (state && state.aiCopy) || null;
  let zones = (state && state.zones) || { deck: [], hand: [], discard: [] };
  const plan = aiCopySummonPlan(now, { srcSlot, srcMonsterId, level });
  if (plan.kind === 'refresh') {
    return { aiCopy: { ...now, level, turnsLeft: plan.turnsLeft, ...(extra || {}) }, zones, plan };
  }
  if (plan.removeUniqueOf != null) zones = aiCopyRemoveUnique(zones, { srcMonsterId: plan.removeUniqueOf });
  const uniq = plan.addUniqueOf != null ? aiCopyUniqueCard(uniqueCard, plan.addUniqueOf) : null;
  if (uniq) zones = { ...zones, deck: [...(Array.isArray(zones.deck) ? zones.deck : []), uniq] };
  const stats = aiCopyStats(src, level, { mode, effMul, permaAtkPct });
  const aiCopy = {
    srcSlot, srcMonsterId, name: String(name || ''), level, spawnTurn: aiCopySafeNum(turn) + 1, turnsLeft: plan.turnsLeft,
    ...stats, hand: [], nextCard: null, picks: [], uniqueCardUid: uniq ? uniq.uid : null, ...(extra || {}),
  };
  return { aiCopy, zones, plan };
};

// コピーを外す(ターン切れ・倒された・WAVE の終わり・20ターン経過)。固有技の写しを山札・手札・捨て札から抜く
const dismissAiCopy = (state) => {
  const now = (state && state.aiCopy) || null;
  const zones = (state && state.zones) || { deck: [], hand: [], discard: [] };
  if (!now) return { aiCopy: null, zones };
  const match = now.uniqueCardUid ? { uid: now.uniqueCardUid } : { srcMonsterId: now.srcMonsterId };
  return { aiCopy: null, zones: aiCopyRemoveUnique(zones, match) };
};

// ターンの終わりに1つ数える(出ているときだけ)。0 になったら外す
const tickAiCopy = (state, turn) => {
  const now = (state && state.aiCopy) || null;
  if (!isAiCopyOut(now, turn)) return state;
  const end = aiCopyTurnEnd(now);
  if (end.expired) return { ...dismissAiCopy(state), expired: true };
  return { ...state, aiCopy: { ...now, turnsLeft: end.turnsLeft } };
};

// ターンの始め: コピーの手札を作り、使うカード(0〜2枚)を決める。deck … みんなの山札(減らさない)/
//   score(card) … AUTO の点 / costOf(card) … 消費ガッツ / rng … 乱数(検査では決まった値を渡す)
const planAiCopyTurn = (aiCopy, { deck = [], score = null, costOf = null, rng = Math.random } = {}) => {
  if (!aiCopy) return aiCopy;
  const uniq = (Array.isArray(deck) ? deck : []).find((c) => c && aiCopy.uniqueCardUid && c.uid === aiCopy.uniqueCardUid) || null;
  const rest = (Array.isArray(deck) ? deck : []).filter((c) => c !== uniq);
  const hand = aiCopyHand(rest, uniq, rng);
  const picks = aiCopyPickCards(hand, { score, costOf, guts: aiCopy.guts, maxGuts: aiCopy.maxGuts, rng, level: aiCopy.level });
  return { ...aiCopy, hand, picks, nextCard: picks[0] || null };
};
