// ===== MFバトルカード: 登録デッキの戦い方(画面と保存を触らない部分) =====
// 95-card-deck-share から移した(2026-10-30 ルールくん。中身は変えていない)。大会の試合をサーバ(Edge Function)でも
// 同じ打ち方で回すため、画面(JSX)と保存を触らない部品に分けた。みんなのデッキ(95)・大会(82-card-tournament-core)が使う

// 戦い方の7つの向き(82 の CARD_AI_HABITS の項目と同じ名前)。-1 控えめ / 0 ふつう / 1 強め
const CARD_SHARE_TILTS = Object.freeze([
  { id: 'attack', label: '攻める' }, { id: 'keepGuard', label: '守りを残す' }, { id: 'saveGuts', label: 'ガッツをためる' },
  { id: 'big', label: '大技' }, { id: 'disrupt', label: '相手を崩す' }, { id: 'area', label: '全体技' }, { id: 'finish', label: 'とどめ' },
]);
const CARD_SHARE_TILT_MUL = Object.freeze({ '-1': 0.6, 0: 1, 1: 1.6 });
const CARD_SHARE_ACES_MAX = 3;

// 戦い方をきれいにする(知らない項目は捨てる・無い人は既定で補う)。deck を渡すと、切り札はそのデッキに入っている札だけ残す
const cardShareNormalizeTactics = (v, deck = null) => {
  const r = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const habit = typeof r.habit === 'string' && Object.prototype.hasOwnProperty.call(CARD_AI_HABITS, r.habit) ? r.habit : 'kyuko';
  const tilt = {};
  CARD_SHARE_TILTS.forEach((t) => { const n = r.tilt && r.tilt[t.id]; tilt[t.id] = n === -1 || n === 1 ? n : 0; });
  const inDeck = deck && Array.isArray(deck.cards) ? new Set(deck.cards) : null;
  const aces = [...new Set((Array.isArray(r.aces) ? r.aces : []).filter((x) => typeof x === 'string' && /^[A-Z]?[0-9]{3}$/.test(x) && (!inDeck || inDeck.has(x))))].slice(0, CARD_SHARE_ACES_MAX);
  const name = typeof r.name === 'string' ? r.name.slice(0, 20) : '';
  // f … 戦術カードの枠(82-card-tactics-core の短い形。2026-10-29 社長)。無い登録(前の形)は、くせと傾きで打つ
  const f = r.f && typeof r.f === 'object' && !Array.isArray(r.f) && typeof cardTacticPackFrames === 'function' ? cardTacticPackFrames(cardTacticUnpackFrames(r.f)) : null;
  return { habit, tilt, aces, name, ...(f ? { f } : {}) };
};
// 登録デッキの賢さ(戦術カードの枠から。2026-10-29 社長「デッキ側で決まる・戦う人は選ばない」)。
//   'expert' | 'master' | 'grandmaster' | 'hell' | 'legend'(82 の cardTacticSmartLevel)。前の形の登録(枠が無い)は EXPERT
const cardShareSmartLevel = (tactics) => {
  const t = cardShareNormalizeTactics(tactics);
  return t.f && typeof cardTacticSmartLevel === 'function' ? cardTacticSmartLevel(cardTacticUnpackFrames(t.f)) : 'expert';
};
// 画面に出す段の名前(本編のチャレンジモードの並び。2026-10-30 社長)
const CARD_SHARE_SMART_LABEL = Object.freeze({ expert: 'EXPERT', master: 'MASTER', grandmaster: 'GRAND MASTER', hell: 'HELL', legend: 'LEGEND' });
// MASTER を超える段の先読み(82 の cardAiSearchPick)。k … 試す手の数 / r … 1つの手を試す回数 / h … 何手番先まで進めるか / eval … 場の見方
//   2026-10-30 に MASTER の助手と測った: GRAND MASTER 66% / HELL 71% / LEGEND は下の値(docs/progress/card-tournament/share-ai/README.md)
const CARD_SHARE_SEARCH = Object.freeze({
  grandmaster: Object.freeze({ k: 3, r: 1, h: 1, eval: 'ko' }),
  hell: Object.freeze({ k: 4, r: 2, h: 4, eval: 'ko' }),
  legend: Object.freeze({ k: 4, r: 2, h: 4, eval: 'alive' }),
});
// 土台のくせ(メインの基本カードが助手の型ならその助手。前の形の登録や画面の名前に使う)
const cardShareMainHabit = (frames, fallback = 'kyuko') => {
  const c = frames && typeof cardTacticOf === 'function' ? cardTacticOf(frames.base[0]) : null;
  const g = c && typeof CARD_TACTIC_GROUPS !== 'undefined' ? CARD_TACTIC_GROUPS.find((x) => x.id === c.g) : null;
  return (g && g.habit) || fallback || 'kyuko';
};
// 打ち方の土台の強さ(cardAiPolicy の段)。MASTER を超える段は MASTER の打ち方に先読みを足す
const cardShareFightLevel = (tactics) => (cardShareSmartLevel(tactics) === 'expert' ? 'expert' : 'master');
// 戦い方から、助手の打ち方(cardAiPolicy の形)を作る。戦術カードの枠があれば、その枠で打つ(強さは枠の賢さ)。
//   levelId は使わない(強さは登録デッキの賢さで決まる。前は枠の無い登録だけ呼んだ側の強さで打っていた)
const cardSharePolicy = (tactics, levelId, opts = {}) => {
  const t = cardShareNormalizeTactics(tactics);
  const search = CARD_SHARE_SEARCH[cardShareSmartLevel(t)] || null;
  if (t.f) {
    const frames = cardTacticUnpackFrames(t.f);
    const base = cardAiPolicy(t.habit, cardShareFightLevel(t), { ...opts, noTactics: true });
    return { ...base, gambit: frames, aces: t.aces.slice(), ...(search ? { search } : {}) };
  }
  const base = cardAiPolicy(t.habit, cardShareFightLevel(t), { ...opts, noTactics: true });
  const habit = { ...base.habit };
  CARD_SHARE_TILTS.forEach((x) => { if (Number.isFinite(habit[x.id])) habit[x.id] = habit[x.id] * CARD_SHARE_TILT_MUL[t.tilt[x.id]]; });
  return { ...base, habit, aces: t.aces.slice() };
};
