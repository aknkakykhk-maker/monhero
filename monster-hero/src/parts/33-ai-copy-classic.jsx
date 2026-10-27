// ==== AIコピー(ソラシドのアシカ)の5つの遊び(クラシック・チャレンジ・プロ・クイック・極限)だけの計算 ====
// 2026-10-27 バトル部ダイスくん。出し方・消し方・数え方は共通の 33-ai-copy.jsx、数字は 32-sorashido-copy.jsx。
// ここは「5つの遊びはパーティで1組の値を持つ」ことに合わせる所だけ(画面・保存・乱数の元に触らない)。
//   ・コピーはライフを持たない(パーティのライフを使う。狙われない・倒されない。社長の答え・案2)
//   ・強さの元は「元の子1体のぶん」(ジン部長の答え)。勇者モンは基礎の値、供モンは合流で足したぶん(plusStats)。
//     そのあとの育成・強化はパーティの値にまとめて入っているので、いまのパーティの値を「その子のぶんの割合」で分けて持たせる
//     (育成していなければ、その子のぶんがそのまま出る)
//   ・攻撃は元の子の間合い(srcSlot)から、コピーのちからで撃つ(パーティのちからで出したダメージを、ちからの比で縮める)

// その子がパーティへ足しているぶん(勇者モンは基礎、供モンは合流ボーナス)
const classicAiCopyShareOf = (mon, isHero) => {
  if (!mon) return { atk: 0, def: 0, maxGuts: 0 };
  const plus = (mon.plusStats && typeof mon.plusStats === 'object') ? mon.plusStats : {};
  const pick = (heroKey, plusKey) => Math.max(0, aiCopySafeNum(isHero ? mon[heroKey] : plus[plusKey]));
  return { atk: pick('baseAtk', 'atk'), def: pick('baseDef', 'def'), maxGuts: pick('baseGuts', 'guts') };
};

// コピーの元の値(aiCopyStats へ渡す src)。slots … いまの4枠 / heroId … 勇者モンの id / party … パーティの atk・def・maxGuts
const classicAiCopySrc = ({ slots = [], srcSlot = 0, heroId = null, party = {} } = {}) => {
  const list = Array.isArray(slots) ? slots : [];
  const shares = list.map((m) => classicAiCopyShareOf(m, !!(m && heroId != null && m.id === heroId)));
  const mine = shares[srcSlot] || { atk: 0, def: 0, maxGuts: 0 };
  const part = (key) => {
    const total = shares.reduce((n, s) => n + s[key], 0);
    const now = Math.max(0, aiCopySafeNum(party && party[key]));
    if (!(total > 0)) return 0;
    return Math.floor(now * (mine[key] / total));
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
