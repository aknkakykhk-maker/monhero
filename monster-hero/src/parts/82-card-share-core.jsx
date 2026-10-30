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
// 登録デッキの賢さ(戦術カードの枠から。2026-10-29 社長「デッキ側で決まる・戦う人は選ばない」)。前の形の登録は NORMAL
//   'random' … 何も入れていない(出せる手からランダム)。報酬と経験値は EASY で数える
const cardShareSmartLevel = (tactics) => {
  const t = cardShareNormalizeTactics(tactics);
  return t.f && typeof cardTacticSmartLevel === 'function' ? cardTacticSmartLevel(cardTacticUnpackFrames(t.f)) : 'normal';
};
// 土台のくせ(メインの基本カードが助手の型ならその助手。前の形の登録や画面の名前に使う)
const cardShareMainHabit = (frames, fallback = 'kyuko') => {
  const c = frames && typeof cardTacticOf === 'function' ? cardTacticOf(frames.base[0]) : null;
  const g = c && typeof CARD_TACTIC_GROUPS !== 'undefined' ? CARD_TACTIC_GROUPS.find((x) => x.id === c.g) : null;
  return (g && g.habit) || fallback || 'kyuko';
};
const cardShareFightLevel = (tactics) => { const lv = cardShareSmartLevel(tactics); return lv === 'random' ? 'easy' : lv; };
// 戦い方から、助手の打ち方(cardAiPolicy の形)を作る。戦術カードの枠があれば、その枠で打つ(強さは枠の賢さ)
const cardSharePolicy = (tactics, levelId, opts = {}) => {
  const t = cardShareNormalizeTactics(tactics);
  if (t.f) {
    const frames = cardTacticUnpackFrames(t.f);
    const base = cardAiPolicy(t.habit, cardShareFightLevel(t), { ...opts, noTactics: true });
    return { ...base, gambit: frames, gambitRandom: true, aces: t.aces.slice() };
  }
  const base = cardAiPolicy(t.habit, levelId, { ...opts, noTactics: true });
  const habit = { ...base.habit };
  CARD_SHARE_TILTS.forEach((x) => { if (Number.isFinite(habit[x.id])) habit[x.id] = habit[x.id] * CARD_SHARE_TILT_MUL[t.tilt[x.id]]; });
  return { ...base, habit, aces: t.aces.slice() };
};
