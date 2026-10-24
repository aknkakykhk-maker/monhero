// ==================== MFバトルカード パック(区切り2) ====================
// 設計: docs/spec/CARD_BATTLE.md 4-2(社長: 種族ごとの4弾を最初から全部出す・ヒノトリは第2弾・混血パック・C-060C は入れない)
// ここは pure(画面・保存・乱数の元を持たない)。乱数は rand(0〜1 を返す関数)を外から渡す(検査で同じ並びを作れるように)
//
// 1パックの中身
//   第1〜4弾 … 8枚・100カードポイント(5パックまとめて 450)。技の枠7・モンスターの枠1(最後にめくる)
//   混血パック … 3枚・150カードポイント。3枚とも混血モンスター(キラは無い)
// 技の枠: その弾の「準備中でない」カード(技・全モンスター・ブリーダー)から同じ確率で1枚。技にレア度の差は無い(社長)
// モンスターの枠: まずレア度(第1弾 通常85%/キラ12%/別絵キラ3%・第2〜4弾 通常85%/キラ15%)、そのレア度のモンスターから1枚。
//   まだ持っていない種族は2倍の重みで引く(持っていない種族が出やすいように)
// 天井: その弾のパックでキラも別絵キラも出ないまま7パック開けたら、8パック目のモンスターの枠はキラ以上(弾ごとに数える。混血は無し)
// だぶり(自動でカードポイントへ): 技カードは4枚目から1枚 5 / モンスターは2枚目から 50(キラ 100・別絵キラ 200)/ 混血は 20
//   ★持てる枚数を超えた分だけをカードポイントにする(持っている分は減らさない)
const CARD_PACKS = Object.freeze([
  { id: 'w1', wave: '1', name: '第1弾パック', price: 100, bundle: { n: 5, price: 450 }, tech: 7, mon: 1, rarity: { normal: 85, kira: 12, alt: 3 }, pity: true, color: '#f59e0b' },
  { id: 'w2', wave: '2', name: '第2弾パック', price: 100, bundle: { n: 5, price: 450 }, tech: 7, mon: 1, rarity: { normal: 85, kira: 15, alt: 0 }, pity: true, color: '#ef4444' },
  { id: 'w3', wave: '3', name: '第3弾パック', price: 100, bundle: { n: 5, price: 450 }, tech: 7, mon: 1, rarity: { normal: 85, kira: 15, alt: 0 }, pity: true, color: '#22c55e' },
  { id: 'w4', wave: '4', name: '第4弾パック', price: 100, bundle: { n: 5, price: 450 }, tech: 7, mon: 1, rarity: { normal: 85, kira: 15, alt: 0 }, pity: true, color: '#3b82f6' },
  { id: 'hybrid', wave: 'hybrid', name: '混血パック', price: 150, bundle: null, tech: 0, mon: 3, rarity: { normal: 100, kira: 0, alt: 0 }, pity: false, color: '#a855f7' },
]);
const CARD_PACK_PITY_AT = 7;          // キラなしでこの数だけ開けたら、次のパックはキラ以上
const CARD_TECH_KEEP_MAX = 3;         // 技カードは3枚まで持つ(4枚目からカードポイントへ)
const CARD_DUP_POINT = Object.freeze({ tech: 5, normal: 50, kira: 100, alt: 200, hybrid: 20 });
// 保存は CARD_SAVE_KEYS.pity(mh_card_pack_pity_v1 { パックid: 数 })と CARD_SAVE_KEYS.shop(mh_card_shop_v1 { starters: { キット: 時刻 } })
const CARD_STARTER_SHOP_PRICE = 500;

const cardPackOf = (id) => CARD_PACKS.find((p) => p.id === id) || null;
// モンスターカードのレア度(通常・キラ・別絵キラ)。水中のグジラは通常/キラのあつかい
const cardMonRarity = (m) => (!m || !m.variant ? 'normal' : /別絵キラ/.test(m.variant) ? 'alt' : /キラ/.test(m.variant) ? 'kira' : 'normal');
const cardPackTechPool = (db, pack) => Object.values(db.cards).filter((c) => String(c.wave) === pack.wave && c.ready).map((c) => c.no).sort();
const cardPackMonPool = (db, pack, rarity) => Object.values(db.monsters).filter((m) => String(m.wave) === pack.wave && m.ready !== false && cardMonRarity(m) === rarity).map((m) => m.no).sort();
const cardOwnsSpecies = (db, collection, species) => Object.keys(collection || {}).some((no) => collection[no] > 0 && (cardMonsterOf(db, no) || {}).species === species);

const cardNormalizePity = (v) => {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  CARD_PACKS.forEach((p) => { const x = Number(v[p.id]); if (Number.isFinite(x) && x > 0) out[p.id] = Math.min(999, Math.floor(x)); });
  return out;
};
const cardNormalizeShop = (v) => {
  const r = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const st = r.starters && typeof r.starters === 'object' && !Array.isArray(r.starters) ? r.starters : {};
  return { starters: Object.fromEntries(Object.entries(st).filter(([, at]) => Number.isFinite(Number(at))).map(([k, at]) => [k, Number(at)])) };
};

// 重みつきで1つ選ぶ
const cardPickWeighted = (items, weightOf, rand) => {
  const total = items.reduce((a, x) => a + weightOf(x), 0);
  if (!(total > 0)) return items[0];
  let r = rand() * total;
  for (const x of items) { r -= weightOf(x); if (r < 0) return x; }
  return items[items.length - 1];
};

// 1パック開ける。返す: { cards:[{ no, slot:'tech'|'mon', rarity, dup, point }], collection, pity, point(だぶりのカードポイント), hit(キラ以上が出たか) }
const cardOpenPack = (db, packId, { collection, pity }, rand) => {
  const pack = cardPackOf(packId);
  if (!pack) return null;
  const col = { ...(collection || {}) };
  const nextPity = { ...(pity || {}) };
  const cards = [];
  let point = 0;
  const techPool = cardPackTechPool(db, pack);
  for (let i = 0; i < pack.tech && techPool.length; i++) {
    const no = techPool[Math.floor(rand() * techPool.length) % techPool.length];
    const dup = (col[no] || 0) >= CARD_TECH_KEEP_MAX;
    if (dup) point += CARD_DUP_POINT.tech; else col[no] = (col[no] || 0) + 1;
    cards.push({ no, slot: 'tech', rarity: 'normal', dup, point: dup ? CARD_DUP_POINT.tech : 0 });
  }
  let hit = false;
  for (let i = 0; i < pack.mon; i++) {
    const forced = pack.pity && i === pack.mon - 1 && (nextPity[pack.id] || 0) >= CARD_PACK_PITY_AT;
    const rar = Object.entries(pack.rarity).filter(([k, w]) => w > 0 && (!forced || k !== 'normal') && cardPackMonPool(db, pack, k).length);
    const rarity = cardPickWeighted(rar, ([, w]) => w, rand)[0];
    const pool = cardPackMonPool(db, pack, rarity);
    const no = cardPickWeighted(pool, (x) => (cardOwnsSpecies(db, col, (cardMonsterOf(db, x) || {}).species) ? 1 : 2), rand);
    const dup = (col[no] || 0) >= 1;
    const dupPoint = pack.id === 'hybrid' ? CARD_DUP_POINT.hybrid : CARD_DUP_POINT[rarity];
    if (dup) point += dupPoint; else col[no] = 1;
    if (rarity !== 'normal') hit = true;
    cards.push({ no, slot: 'mon', rarity, dup, point: dup ? dupPoint : 0 });
  }
  if (pack.pity) nextPity[pack.id] = hit ? 0 : (nextPity[pack.id] || 0) + 1;
  return { cards, collection: col, pity: nextPity, point, hit };
};

// まとめて買う(1つ・5つ)。カードポイントが足りなければ null。返す: { packs:[1パックぶん…], collection, pity, point(残り), cost, dupPoint }
const cardPackPrice = (pack, count) => (pack.bundle && count === pack.bundle.n ? pack.bundle.price : pack.price * count);
const cardBuyPacks = (db, packId, count, { collection, pity, point }, rand) => {
  const pack = cardPackOf(packId);
  const n = Math.max(1, Math.min(5, Math.floor(Number(count) || 1)));
  if (!pack) return null;
  const cost = cardPackPrice(pack, n);
  if (!(point >= cost)) return null;
  let cur = { collection, pity };
  const packs = [];
  let dupPoint = 0;
  for (let i = 0; i < n; i++) {
    const r = cardOpenPack(db, packId, cur, rand);
    packs.push(r.cards);
    dupPoint += r.point;
    cur = { collection: r.collection, pity: r.pity };
  }
  return { packs, collection: cur.collection, pity: cur.pity, point: point - cost + dupPoint, cost, dupPoint };
};

// 画面に出す「出る確率」(パックの画面で、だれでも見られる)
const cardPackRates = (db, packId) => {
  const pack = cardPackOf(packId);
  if (!pack) return null;
  const tech = cardPackTechPool(db, pack).length;
  const mons = Object.fromEntries(['normal', 'kira', 'alt'].map((k) => [k, cardPackMonPool(db, pack, k).length]));
  return { pack, techKinds: tech, techEach: tech ? 1 / tech : 0, mons, rarity: pack.rarity };
};

// 選ばなかったスターターキットを買う(1つにつき1回・500)。持っていた分を超えるカードは、パックと同じ決まりでカードポイントへ
//   デッキも1つ足す(5つに満たないとき)。返す: { collection, decks, point, shop, dupPoint } / 買えないとき null
const cardBuyStarter = (db, kitId, { collection, decks, point, starter, shop }, now) => {
  const kit = db.starters[kitId];
  if (!kit || (starter && starter.kit === kitId) || (shop.starters && shop.starters[kitId]) || !(point >= CARD_STARTER_SHOP_PRICE)) return null;
  const col = { ...(collection || {}) };
  let dupPoint = 0;
  kit.monsters.forEach((no) => { if ((col[no] || 0) >= 1) dupPoint += CARD_DUP_POINT[cardMonRarity(cardMonsterOf(db, no))]; else col[no] = 1; });
  kit.cards.forEach((no) => { if ((col[no] || 0) >= CARD_TECH_KEEP_MAX) dupPoint += CARD_DUP_POINT.tech; else col[no] = (col[no] || 0) + 1; });
  const deck = { id: `starter_${kitId}`, name: kit.name, monsters: kit.monsters.slice(), cards: kit.cards.slice() };
  const nextDecks = decks.decks.some((d) => d.id === deck.id) || decks.decks.length >= CARD_DECK_MAX ? decks : { ...decks, decks: [...decks.decks, deck] };
  return { collection: col, decks: nextDecks, point: point - CARD_STARTER_SHOP_PRICE + dupPoint, shop: { starters: { ...shop.starters, [kitId]: Math.floor(Number(now) || 0) } }, dupPoint };
};
