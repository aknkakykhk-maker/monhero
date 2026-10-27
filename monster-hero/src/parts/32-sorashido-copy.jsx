// ===== ソラシドの自動化(アシカ copy_sorashido・2026-10-27 社長の決定)の AIコピーの計算 =====
// 使った子の「AIコピー」が、使った次のターンの始まりに5人目の味方として現れ、決めたターン数のあいだ戦う。
// ここはバトルの外の純粋な計算だけ(画面・保存・乱数の元を持たない)。
// コピーの状態 aiCopy = { srcSlot, srcMonsterId, level, spawnTurn, turnsLeft, hp, maxHp, atk, def, guts, maxGuts, hand, nextCard, uniqueCardUid, pos }
// はバトル部が持ち(保存しない)、出す・消す時期・ダメージ・狙いもバトル部(タクティクス=セコンドくん・5つの遊び=ダイスくん)。
// 数字の正本は data/breeder.js の SORASHIDO_TIERS。つなぎ方は docs/progress/sorashido-assist-parts.md。
// ★乱数は rng(0以上1未満を返す関数)を渡す形にして、検査で固定できるようにしてある(tools/battle/sorashido-copy-check.js)。
// ★MFバトルカードには入れない。

const SORASHIDO_CARD_ID = 'sorashido';
// 5人目の枠の番号(タクティクスの4枠 0〜3 の次)
const SORASHIDO_COPY_SLOT = 4;
// 山札に足すコピーの子の固有技は、どの Lv でもいつも1枚
const SORASHIDO_COPY_UNIQUE_COUNT = 1;
// コピーが毎ターン山札の写しから見るカードの枚数(これに足した固有技を加える)
const SORASHIDO_COPY_HAND_DRAW = 2;

const aiCopySafeNum = (value, fallback = 0) => { const n = Number(value); return Number.isFinite(n) ? n : fallback; };

// Lv(0〜2)ごとの決まり。{ rates, turns, pick, maxCards, hateStart, hateGain, gutsFor2 }
const aiCopyRules = (level) => {
  const tiers = (typeof SORASHIDO_TIERS !== 'undefined' && Array.isArray(SORASHIDO_TIERS)) ? SORASHIDO_TIERS : [];
  const lv = Math.max(0, Math.min(tiers.length - 1, Math.floor(aiCopySafeNum(level)) || 0));
  const t = tiers[lv] || { rates: { hp: 0.5, atk: 0.6, def: 0.5, guts: 0.6 }, turns: 2, pick: 0.5, maxCards: 1, hateStart: 0.5, hateGain: 1 };
  return { ...t, maxCards: Math.max(1, Math.floor(aiCopySafeNum(t.maxCards, 1))), gutsFor2: aiCopySafeNum(t.gutsFor2, Infinity) };
};
const aiCopyTurns = (level) => aiCopyRules(level).turns;

// コピーの強さ。src は元の子の「いまの値」(タクティクスの1体と同じ形: maxHp・atk・def・maxGuts)。
//   mode: 'tactics' のときだけライフ(maxHp・hp)を返す。5つの遊びはパーティのライフを使うので返さない
//   effMul はアシカの効果倍率(EXTREME などでは 0.5)。強さにだけ掛ける(ターン数・うまさ・固有技1枚には掛けない)
//   permaAtkPct は「ずっと続く攻撃アップ」のコピーした時点の値。そのあと元の子が伸びても写さない
const aiCopyStats = (src, level, { mode = 'tactics', effMul = 1, permaAtkPct = 0 } = {}) => {
  const m = Math.max(0, aiCopySafeNum(effMul, 1));
  const r = aiCopyRules(level).rates;
  const of = (key, rate, min = 0) => Math.max(min, Math.floor(Math.max(0, aiCopySafeNum(src && src[key])) * rate * m));
  const maxGuts = of('maxGuts', r.guts);
  const out = { atk: of('atk', r.atk), def: of('def', r.def), maxGuts, guts: maxGuts, permaAtkPct: Math.max(0, aiCopySafeNum(permaAtkPct)) };
  if (mode === 'tactics') { const maxHp = of('maxHp', r.hp, 1); out.maxHp = maxHp; out.hp = maxHp; }
  return out;
};

// タクティクスの🔥。出たときは元の子の🔥 × hateStart(上限100)。そのあとのたまり方は × hateGain(5つの遊びには🔥が無い)
const aiCopyStartHate = (srcHate, level) => Math.max(0, Math.min(100, Math.floor(aiCopySafeNum(srcHate) * aiCopyRules(level).hateStart)));
const aiCopyHateGainMult = (level) => aiCopyRules(level).hateGain;

// アシカを使ったときの判定。aiCopy はいまのコピー(無ければ null)。返す kind ごとにバトル側がやること:
//   'new'     … コピーを作る(次のターンの始まりに出す)。addUniqueOf の固有技を1枚足す
//   'refresh' … 同じ子でもう一度。turnsLeft を最初へ戻すだけ(固有技は足さない・1枚のまま)
//   'switch'  … 別の子へ切りかえ。いまのコピーを外し(removeCopy)、removeUniqueOf の固有技を抜き、addUniqueOf を1枚足す
const aiCopySummonPlan = (aiCopy, { srcSlot, srcMonsterId, level }) => {
  const turnsLeft = aiCopyTurns(level);
  if (!aiCopy) return { kind: 'new', turnsLeft, removeCopy: false, removeUniqueOf: null, addUniqueOf: srcMonsterId };
  if (aiCopy.srcSlot === srcSlot && aiCopy.srcMonsterId === srcMonsterId) return { kind: 'refresh', turnsLeft, removeCopy: false, removeUniqueOf: null, addUniqueOf: null };
  return { kind: 'switch', turnsLeft, removeCopy: true, removeUniqueOf: aiCopy.srcMonsterId, addUniqueOf: srcMonsterId };
};

// ターンの終わり(コピーが出ているときだけ呼ぶ)。0 になったら消える(expired=true のとき、コピーと固有技を抜く)
const aiCopyTurnEnd = (aiCopy) => {
  if (!aiCopy) return { turnsLeft: 0, expired: false, removeUniqueOf: null };
  const turnsLeft = Math.max(0, Math.floor(aiCopySafeNum(aiCopy.turnsLeft)) - 1);
  return { turnsLeft, expired: turnsLeft <= 0, removeUniqueOf: turnsLeft <= 0 ? aiCopy.srcMonsterId : null };
};

// ---- 固有技の出し入れ ----
// 足す1枚。元の固有技のカードに印(sorashidoCopyOf・uid)を付けた写し。抜くときは uid か印で探す
const aiCopyUniqueCard = (card, srcMonsterId) => (card ? { ...card, sorashidoCopyOf: srcMonsterId, uid: `${card.uid || card.id || 'unique'}-aicopy-${srcMonsterId}` } : null);
const aiCopyIsUnique = (card, { uid = null, srcMonsterId = null } = {}) => !!card && card.sorashidoCopyOf != null
  && (uid == null || card.uid === uid) && (srcMonsterId == null || card.sorashidoCopyOf === srcMonsterId);
// 山札・手札・墓地のどこからでも、コピーの分の固有技を抜く。zones は { deck, hand, discard }(どれも配列)。元の配列は変えない
const aiCopyRemoveUnique = (zones, match) => {
  const strip = (list) => (Array.isArray(list) ? list.filter((c) => !aiCopyIsUnique(c, match)) : []);
  return { ...zones, deck: strip(zones && zones.deck), hand: strip(zones && zones.hand), discard: strip(zones && zones.discard) };
};

// ---- コピーの手札と使うカード ----
// コピーは選ばない: 距離技(青い枠 range_atk)と、ソラシドのアシカそのもの。固有技とほかのアシカは選べる
const aiCopyCanPick = (card) => !!card && card.type !== 'range_atk' && card.id !== SORASHIDO_CARD_ID;

// 毎ターンの手札: みんなの山札は減らさず、山札の写しから2枚(選べるものから)+コピーの子の固有技1枚
const aiCopyHand = (deck, uniqueCard, rng, draw = SORASHIDO_COPY_HAND_DRAW) => {
  const rest = (Array.isArray(deck) ? deck : []).filter(aiCopyCanPick);
  const picked = [];
  for (let i = 0; i < draw && rest.length > 0; i++) {
    const at = Math.min(rest.length - 1, Math.floor(Math.max(0, Math.min(0.999999, aiCopySafeNum(rng && rng()))) * rest.length));
    picked.push(rest.splice(at, 1)[0]);
  }
  if (uniqueCard && aiCopyCanPick(uniqueCard)) picked.push(uniqueCard);
  return picked;
};

// 1枚を選ぶ。いちばん点の高いものを pick の見込みで、外れたら2番目以降から同じ重さで。使えるものが無ければ null
const aiCopyPickOne = (cards, score, rng, pick) => {
  if (cards.length === 0) return null;
  const ranked = cards.map((c, i) => ({ c, i, s: aiCopySafeNum(typeof score === 'function' ? score(c) : 0) })).sort((a, b) => (b.s - a.s) || (a.i - b.i));
  if (ranked.length === 1 || aiCopySafeNum(rng && rng()) < pick) return ranked[0].c;
  const others = ranked.slice(1);
  return others[Math.min(others.length - 1, Math.floor(Math.max(0, aiCopySafeNum(rng && rng())) * others.length))].c;
};

// このターンに使うカード(0〜2枚)。score(card) はバトルの AUTO の点(高いほど良い)、costOf(card) は消費ガッツ。
//   1枚目: コピーの今のガッツで足りるカードから選ぶ。
//   2枚目(Lv3 だけ): コピーのガッツの上限が gutsFor2 以上で、1枚目を使ったあとのガッツで足りるカードから、同じうまさで選ぶ(1枚目と同じカードは選ばない)。
//   プレイヤーの使える枚数には数えない。返した配列の先頭が「次に使うカード」
const aiCopyPickCards = (hand, { score, costOf, guts, maxGuts, rng, level }) => {
  const rules = aiCopyRules(level);
  const cost = (c) => Math.max(0, aiCopySafeNum(typeof costOf === 'function' ? costOf(c) : (c && (c.guts ?? c.cost)), 0));
  let left = Math.max(0, aiCopySafeNum(guts));
  const pool = (Array.isArray(hand) ? hand : []).filter(aiCopyCanPick);
  const first = aiCopyPickOne(pool.filter((c) => cost(c) <= left), score, rng, rules.pick);
  if (!first) return [];
  const out = [first];
  left -= cost(first);
  if (rules.maxCards >= 2 && aiCopySafeNum(maxGuts) >= rules.gutsFor2) {
    const second = aiCopyPickOne(pool.filter((c) => c !== first && cost(c) <= left), score, rng, rules.pick);
    if (second) out.push(second);
  }
  return out;
};

// ---- 説明文(ブリーダーの教え・マーケット・カードの詳しい画面) ----
const sorashidoCopyDesc = (level) => {
  const t = aiCopyRules(level), p = (v) => Math.round(v * 100);
  return `使った子のAIコピーが、次のターンから5人目の味方として ${t.turns}ターン戦う（ちから${p(t.rates.atk)}%・丈夫さ${p(t.rates.def)}%・ガッツ${p(t.rates.guts)}%。タクティクスはライフ${p(t.rates.hp)}%も）。いちばん良いカードを選ぶ見込み ${p(t.pick)}%${t.maxCards >= 2 ? `・ガッツの上限${t.gutsFor2}以上なら1ターンに2枚まで` : ''}`;
};
