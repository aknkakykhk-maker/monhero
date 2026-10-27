// ==================== MFバトルカード パック(区切り2・2026-10-25 社長「パックは8弾まで」で作り直し) ====================
// 設計: docs/spec/CARD_BATTLE.md 4-2(社長: 種族3つずつで8弾・混血はメインの種族の弾へ・C-060C は入れない。台帳 #3558 ほか)
// ここは pure(画面・保存・乱数の元を持たない)。乱数は rand(0〜1 を返す関数)を外から渡す(検査で同じ並びを作れるように)
//
// 1パックの中身(どの弾も同じ): 8枚・300ビートP(5パックまとめて 1,350)。技などの枠7・モンスターの枠1(最後にめくる)
// 技などの枠: その弾の「準備中でない」カード(その弾の種族の技・配った全モンスター/ブリーダーのカード)から同じ確率で1枚
// モンスターの枠: まずレア度(第1〜3弾 通常85%/キラ12%/別絵キラ3%・第4〜8弾 通常85%/キラ15%)、そのレア度のモンスターから同じ確率で1枚
//   (「まだ持っていない種族を2倍」は社長の決めでなくした。混血はキラの無い通常のモンスターとして通常に入る)
// 天井: その弾のパックでキラも別絵キラも出ないまま7パック開けたら、8パック目のモンスターの枠はキラ以上(弾ごとに数える)
// だぶり(自動でビートPへ): 技カードは4枚目から1枚 5 / モンスターは2枚目から 50(キラ 100・別絵キラ 200)/ 混血も 50
//   ★持てる枚数を超えた分だけをビートPにする(持っている分は減らさない)
//
// ★弾の割り当ては、カードのデータ(data/card-battle-cards.js の wave)を書き換えずに、ここの表で決める
//   (wave は図鑑の「混血」・練習試合・助手のデッキなどが使っている。準備中のカードの効き目づくりとぶつからないように)
const CARD_PACKS = Object.freeze([
  { id: 'p1', no: 1, species: ['dino', 'hare', 'mocchi'], color: '#2f7fe0' },        // 先手必勝スピードチームの3体
  { id: 'p2', no: 2, species: ['golem', 'pixie', 'naga'], color: '#ef4444' },        // 一撃必殺パワフルチーム
  { id: 'p3', no: 3, species: ['suezo', 'gali', 'tiger'], color: '#e0a420' },        // 一発逆転ミラクルチーム
  { id: 'p4', no: 4, species: ['phoenix', 'monol', 'henger', 'ghost'], color: '#f97316' }, // ゴーストは 2026-10-27 に足した(第4弾だけ4種族・台帳 #204)
  { id: 'p5', no: 5, species: ['plant', 'dragon', 'jell'], color: '#22c55e' },
  { id: 'p6', no: 6, species: ['mew', 'worm', 'durahan'], color: '#a855f7' },
  { id: 'p7', no: 7, species: ['zilla', 'metalner', 'joker'], color: '#14b8a6' },
  { id: 'p8', no: 8, species: ['arrowhead', 'centaur', 'colorpandora'], color: '#ec4899' },
].map((p) => Object.freeze({
  ...p, name: `第${p.no}弾パック`, price: 300, bundle: Object.freeze({ n: 5, price: 1350 }), tech: 7, mon: 1,
  rarity: Object.freeze(p.no <= 3 ? { normal: 85, kira: 12, alt: 3 } : { normal: 85, kira: 15, alt: 0 }), pity: true,
})));
// 全モンスター(any)・ブリーダー(breeder)のカードの配り先(37枚。どの弾も50種前後になるよう、番号の若い順に半分ずつ配った)
// 全体カード15枚(F。2026-10-25 カード部デッキくんの表)は、種類の少ない弾から埋めて、どの弾も55種にそろえた
const CARD_PACK_SHARED = Object.freeze({
  p1: ['109', '112'], p2: ['113', '110', '114'], p3: ['111'],
  p4: ['122', '121', '126', '123', '127', '124', 'F255', 'F256', 'F257', 'F258'], p5: ['125', '128', '249', '252', '250', '253'],
  p6: ['254', '251', '276', '273', '277', '274', 'F263'], p7: ['275', '278', '345', '279', '346', '280', 'F259', 'F260', 'F261', 'F262'],
  p8: ['351', '347', '352', '348', '366', '349', '350', 'F115', 'F116', 'F117', 'F118', 'F119', 'F120'],
});
// 以前の弾(w1〜w4・混血)の id。天井の保存(mh_card_pack_pity_v1)に残っている数は消さない(決まり⑦)
const CARD_PACK_LEGACY_IDS = Object.freeze(['w1', 'w2', 'w3', 'w4', 'hybrid']);
// 以前の天井の数を新しい弾へ1回だけ写す元(w1 → 第1〜3弾 / w2 → 第4・5弾 / w3 → 第6弾 / w4 → 第7・8弾)
const CARD_PACK_PITY_FROM = Object.freeze({ p1: 'w1', p2: 'w1', p3: 'w1', p4: 'w2', p5: 'w2', p6: 'w3', p7: 'w4', p8: 'w4' });
const CARD_PACK_PITY_AT = 7;          // キラなしでこの数だけ開けたら、次のパックはキラ以上
const CARD_TECH_KEEP_MAX = 3;         // 技カードは3枚まで持つ(4枚目からビートPへ)
const CARD_DUP_POINT = Object.freeze({ tech: 5, normal: 50, kira: 100, alt: 200 });
// 保存は CARD_SAVE_KEYS.pity(mh_card_pack_pity_v1 { パックid: 数 })・CARD_SAVE_KEYS.pitySplit(写した印)・CARD_SAVE_KEYS.shop(mh_card_shop_v1 { starters: { キット: 時刻 } })
const CARD_STARTER_SHOP_PRICE = 1500;   // 2026-10-25 社長(以前は500)

const cardPackOf = (id) => CARD_PACKS.find((p) => p.id === id) || null;
// モンスターカードのレア度(通常・キラ・別絵キラ)。水中のグジラは通常/キラのあつかい
const cardMonRarity = (m) => (!m || !m.variant ? 'normal' : /別絵キラ/.test(m.variant) ? 'alt' : /キラ/.test(m.variant) ? 'kira' : 'normal');
// そのカード(モンスター・技)がどの弾のパックから出るか(パックの id。出ないものは null)
const cardPackIdOfSpecies = (species) => (CARD_PACKS.find((p) => p.species.includes(species)) || {}).id || null;
const cardPackIdOf = (db, no) => {
  const m = db.monsters[no];
  if (m) return cardPackIdOfSpecies(String(m.wave) === 'hybrid' ? m.main : m.species);
  const c = db.cards[no];
  if (!c) return null;
  if (c.user === 'any' || c.user === 'breeder') return (Object.entries(CARD_PACK_SHARED).find(([, list]) => list.includes(no)) || [])[0] || null;
  return cardPackIdOfSpecies(c.user);
};
const cardPackTechPool = (db, pack) => Object.values(db.cards).filter((c) => c.ready && cardPackIdOf(db, c.no) === pack.id).map((c) => c.no).sort();
// 図鑑だけの子(dexOnly・立ち絵が無い派生。社長 2026-10-25)はパックに入れない
const cardPackMonPool = (db, pack, rarity) => Object.values(db.monsters).filter((m) => m.ready !== false && !m.dexOnly && cardMonRarity(m) === rarity && cardPackIdOf(db, m.no) === pack.id).map((m) => m.no).sort();
// 図鑑・中身の一覧用: その弾のカード全部(準備中も含む)
const cardPackAllCards = (db, pack) => ({
  monsters: Object.values(db.monsters).filter((m) => cardPackIdOf(db, m.no) === pack.id).map((m) => m.no).sort(),
  cards: Object.values(db.cards).filter((c) => cardPackIdOf(db, c.no) === pack.id).map((c) => c.no).sort(),
});

const cardNormalizePity = (v) => {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  // 以前の弾(w1〜w4)の数も残す(消さない。新しい弾へは cardSplitPity で1回だけ写す)
  [...CARD_PACKS.map((p) => p.id), ...CARD_PACK_LEGACY_IDS].forEach((id) => { const x = Number(v[id]); if (Number.isFinite(x) && x > 0) out[id] = Math.min(999, Math.floor(x)); });
  return out;
};
// 以前の4弾の天井の数を、新しい8弾へ1回だけ写す(写したかどうかは呼ぶ側が mh_card_pack_pity_split_v1 で持つ)。
// 新しい弾にすでに数があれば上書きしない。以前の数は残す
const cardSplitPity = (pity) => {
  const out = { ...(pity || {}) };
  CARD_PACKS.forEach((p) => { const from = Number(out[CARD_PACK_PITY_FROM[p.id]]); if (!(out[p.id] > 0) && Number.isFinite(from) && from > 0) out[p.id] = from; });
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

// 1パック開ける。返す: { cards:[{ no, slot:'tech'|'mon', rarity, dup, point, fresh }], collection, pity, point(だぶりのビートP), hit(キラ以上が出たか) }
// fresh … その種類をはじめて手に入れた1枚(開ける前に持っていない・同じパックの前の札でもない)。まとめの「NEW」に使う(保存しない。2026-10-26 巡回)
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
    const fresh = !((col[no] || 0) > 0);
    if (dup) point += CARD_DUP_POINT.tech; else col[no] = (col[no] || 0) + 1;
    cards.push({ no, slot: 'tech', rarity: 'normal', dup, point: dup ? CARD_DUP_POINT.tech : 0, fresh });
  }
  let hit = false;
  for (let i = 0; i < pack.mon; i++) {
    const forced = pack.pity && i === pack.mon - 1 && (nextPity[pack.id] || 0) >= CARD_PACK_PITY_AT;
    const rar = Object.entries(pack.rarity).filter(([k, w]) => w > 0 && (!forced || k !== 'normal') && cardPackMonPool(db, pack, k).length);
    const rarity = cardPickWeighted(rar, ([, w]) => w, rand)[0];
    const pool = cardPackMonPool(db, pack, rarity);
    const no = pool[Math.floor(rand() * pool.length) % pool.length];
    const dup = (col[no] || 0) >= 1;
    const dupPoint = CARD_DUP_POINT[rarity];
    const fresh = !dup;
    if (dup) point += dupPoint; else col[no] = 1;
    if (rarity !== 'normal') hit = true;
    cards.push({ no, slot: 'mon', rarity, dup, point: dup ? dupPoint : 0, fresh });
  }
  if (pack.pity) nextPity[pack.id] = hit ? 0 : (nextPity[pack.id] || 0) + 1;
  return { cards, collection: col, pity: nextPity, point, hit };
};

// まとめて買う(1つ・5つ)。ビートPが足りなければ null。返す: { packs:[1パックぶん…], collection, pity, point(残り), cost, dupPoint }
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

// 提供割合の表(カード1枚ずつ)。collection は売り場で「未取得」を出すためだけ(割合は持ち物で変わらない)
//   tech … 技などの枠の1枠ごとの割合(どれも同じ) / mon … モンスターの枠の1枠ごとの割合(レア度の割合 ÷ そのレア度の種類)
//   天井で「キラ以上」になる枠は入れていない(ふつうに開けたときの割合)
const cardPackCardRates = (db, packId) => {
  const pack = cardPackOf(packId);
  if (!pack) return null;
  const techPool = cardPackTechPool(db, pack);
  const tech = techPool.map((no) => ({ no, p: 1 / techPool.length }));
  const rar = Object.entries(pack.rarity).filter(([k, w]) => w > 0 && cardPackMonPool(db, pack, k).length);
  const rarTotal = rar.reduce((a, [, w]) => a + w, 0);
  const rarity = {};
  const mon = [];
  rar.forEach(([k, w]) => {
    const pool = cardPackMonPool(db, pack, k);
    rarity[k] = w / rarTotal;
    pool.forEach((no) => mon.push({ no, rarity: k, p: (w / rarTotal) / pool.length }));
  });
  return { pack, tech, mon, rarity };
};

// 選ばなかったスターターキットを買う(1つにつき1回・CARD_STARTER_SHOP_PRICE)。持っていた分を超えるカードは、パックと同じ決まりでビートPへ
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

// スターターキットを手に入れたときの「開ける画面」用の並び(2026-10-27 社長「スターターパック買ったときもブースターパック買ったときみたいな演出入れて。最初に手に入れたときも」)
//   見せ方だけ。中身・枚数・ビートPは cardGrantStarter(はじめの1つ)/ cardBuyStarter(売り場)が決めたもののまま
//   束は「モンスター3体」と「技カードを8種類ずつ」。同じカードは1枚にまとめて ×枚数(count)を出す
//   before … 受け取る前の持ち数 / dupRule … 売り場で買ったとき true(持てる数をこえた分を cardBuyStarter と同じ決まりでビートPとして見せる)
const CARD_STARTER_OPEN_PER_PAGE = 8;
const cardStarterOpenResult = (db, kitId, before, dupRule) => {
  const kit = db.starters[kitId];
  if (!kit) return null;
  const col = { ...(before || {}) };
  const mons = kit.monsters.map((no) => {
    const rarity = cardMonRarity(cardMonsterOf(db, no));
    const had = col[no] || 0;
    const dup = !!dupRule && had >= 1;
    col[no] = had + 1;
    return { no, slot: 'mon', rarity, dup, point: dup ? CARD_DUP_POINT[rarity] : 0, fresh: had === 0 };
  });
  const order = [];
  const count = {};
  kit.cards.forEach((no) => { if (!count[no]) order.push(no); count[no] = (count[no] || 0) + 1; });
  const techs = order.map((no) => {
    const had = col[no] || 0;
    const over = dupRule ? Math.max(0, had + count[no] - CARD_TECH_KEEP_MAX) - Math.max(0, had - CARD_TECH_KEEP_MAX) : 0;
    col[no] = had + count[no];
    return { no, slot: 'tech', rarity: 'normal', count: count[no], dup: over >= count[no], point: over * CARD_DUP_POINT.tech, fresh: had === 0 };
  });
  const packs = [mons];
  for (let i = 0; i < techs.length; i += CARD_STARTER_OPEN_PER_PAGE) packs.push(techs.slice(i, i + CARD_STARTER_OPEN_PER_PAGE));
  const dupPoint = [...mons, ...techs].reduce((a, c) => a + c.point, 0);
  return { kitId, packs, dupPoint, cost: 0 };
};
