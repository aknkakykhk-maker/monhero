// ==== AIコピー(ソラシドのアシカ)の5つの遊び(クラシック・チャレンジ・プロ・クイック・極限)だけの計算 ====
// 2026-10-27 バトル部ダイスくん。出し方・消し方・数え方は共通の 33-ai-copy.jsx、数字は 32-sorashido-copy.jsx。
// ここは「5つの遊びはパーティで1組の値を持つ」ことに合わせる所だけ(画面・保存・乱数の元に触らない)。
//   ・コピーはライフを持たない(パーティのライフを使う。狙われない・倒されない。社長の答え・案2)
//   ・強さの元は「元の子1体の基礎の値」(勇者モンも供モンも同じ物差し。2026-10-27 社長の答え)。
//     そのあとの育成・強化はパーティの値にまとめて入っているので、増えたぶん(いまのパーティ − 4枠がパーティへ足したぶん)を
//     「その子がパーティへ足したぶんの割合」で分けて足す(育成していなければ基礎の値がそのまま出る)
//   ・攻撃は元の子の間合い(srcSlot)から、コピーのちからで撃つ(パーティのちからで出したダメージを、ちからの比で縮める)

// 供モンのコピーの物差し。'base' … その子の基礎の値(勇者モンと同じ) / 'plus' … 合流で足したぶん
const CLASSIC_AI_COPY_ALLY_BASE = 'base';

// その子がパーティへ足しているぶん(勇者モンは基礎、供モンは合流ボーナス)。育成ぶんを分ける割合に使う
const classicAiCopyShareOf = (mon, isHero) => {
  if (!mon) return { atk: 0, def: 0, maxGuts: 0 };
  const plus = (mon.plusStats && typeof mon.plusStats === 'object') ? mon.plusStats : {};
  const pick = (heroKey, plusKey) => Math.max(0, aiCopySafeNum(isHero ? mon[heroKey] : plus[plusKey]));
  return { atk: pick('baseAtk', 'atk'), def: pick('baseDef', 'def'), maxGuts: pick('baseGuts', 'guts') };
};
// コピーの物差しになる「その子の値」(育成ぶんを足す前)
const classicAiCopyBaseOf = (mon, isHero) => {
  if (!mon) return { atk: 0, def: 0, maxGuts: 0 };
  if (isHero || CLASSIC_AI_COPY_ALLY_BASE !== 'base') return classicAiCopyShareOf(mon, isHero);
  return { atk: Math.max(0, aiCopySafeNum(mon.baseAtk)), def: Math.max(0, aiCopySafeNum(mon.baseDef)), maxGuts: Math.max(0, aiCopySafeNum(mon.baseGuts)) };
};

// コピーの元の値(aiCopyStats へ渡す src)。slots … いまの4枠 / heroId … 勇者モンの id / party … パーティの atk・def・maxGuts
const classicAiCopySrc = ({ slots = [], srcSlot = 0, heroId = null, party = {} } = {}) => {
  const list = Array.isArray(slots) ? slots : [];
  const isHeroAt = (m) => !!(m && heroId != null && m.id === heroId);
  const shares = list.map((m) => classicAiCopyShareOf(m, isHeroAt(m)));
  const mine = shares[srcSlot] || { atk: 0, def: 0, maxGuts: 0 };
  const base = classicAiCopyBaseOf(list[srcSlot], isHeroAt(list[srcSlot]));
  const part = (key) => {
    const total = shares.reduce((n, s) => n + s[key], 0);
    const grown = Math.max(0, aiCopySafeNum(party && party[key]) - total);
    const extra = total > 0 ? grown * (mine[key] / total) : 0;
    return Math.floor(base[key] + extra);
  };
  return { atk: part('atk'), def: part('def'), maxGuts: part('maxGuts') };
};

// コピーが撃てるカードか(このあとの段で、ガード・強化・回復・ほかのアシカも効くようにする)
const classicAiCopyIsAttack = (card) => !!card && !['guard', 'draw', 'buff', 'debuff', 'heal', 'weak_guard'].includes(card.type);

// コピーの1枚を選ぶ点(AUTO の「攻撃重視」と同じ並び。固有技 > 攻撃 > 強める > 守り・回復)。
//   ★いまの段は攻撃だけが効くので、攻撃のほうを高くしてある(ジン部長の答え③・仮)
const classicAiCopyScore = (card) => {
  if (!card) return 0;
  if (card.type === 'unique') return 3;
  if (classicAiCopyIsAttack(card)) return 2;
  if (card.type === 'guard' || card.type === 'heal') return 0;
  return 1;
};

// パーティのちからで出したダメージを、コピーのちからへ縮める
const classicAiCopyDamage = (partyDmg, copyAtk, partyAtk) => {
  const d = Math.max(0, aiCopySafeNum(partyDmg));
  const p = Math.max(0, aiCopySafeNum(partyAtk));
  if (!(p > 0) || !(d > 0)) return 0;
  return Math.floor(d * Math.max(0, aiCopySafeNum(copyAtk)) / p);
};

// コピーのガッツを使う / ターンの終わりにパーティと同じ率で戻す(ジン部長の答え②・仮)
const classicAiCopySpendGuts = (aiCopy, cost) => (aiCopy
  ? { ...aiCopy, guts: Math.max(0, aiCopySafeNum(aiCopy.guts) - Math.max(0, aiCopySafeNum(cost))) } : aiCopy);
const classicAiCopyRegenGuts = (aiCopy, rate) => {
  if (!aiCopy) return aiCopy;
  const max = Math.max(0, aiCopySafeNum(aiCopy.maxGuts));
  const add = Math.floor(max * Math.max(0, aiCopySafeNum(rate)));
  return { ...aiCopy, guts: Math.min(max, Math.max(0, aiCopySafeNum(aiCopy.guts)) + add) };
};

// ★固有技の写しを「みんなの山札に1枚足す」(案1)か「コピーが持つ」(案2)かの切りかえ。2026-10-27 社長の答えで案2(false)に決まった。
//   案1の切りかえは残してあるが使わない。
//   true にすると、下の classicAiCopyZones が processTurn の最後(手札・山札・捨て札を確定する1か所)で写しを1枚足し、
//   コピーが消えたら抜く。false のあいだは、もし写しが紛れていても抜くだけ(いまは入らない)
const CLASSIC_AI_COPY_UNIQUE_IN_DECK = false;
// zones … { deck, hand, discard } / copy … いまの aiCopy(いなければ null)。写しは印 sorashidoCopyOf で見分ける
const classicAiCopyZones = (zones, copy, inDeck = CLASSIC_AI_COPY_UNIQUE_IN_DECK) => {
  const z = zones || {};
  const keepUid = inDeck && copy && copy.uniqueCard ? copy.uniqueCard.uid : null;
  const clean = (list) => (Array.isArray(list) ? list : []).filter((c) => !(c && c.sorashidoCopyOf != null && (keepUid == null || c.uid !== keepUid)));
  const out = { deck: clean(z.deck), hand: clean(z.hand), discard: clean(z.discard) };
  if (keepUid != null && ![...out.deck, ...out.hand, ...out.discard].some((c) => c && c.uid === keepUid)) out.deck = [...out.deck, copy.uniqueCard];
  return out;
};
