// ===== モンヒロサクセスの持ちこみアイテムを、マーケットのビートP交換所で交換する(2026-11-13 社長 r1113-057①) =====
// 値段はこの表 MONSUC_SHOP_OFFERS だけで決める(2026-11-14 社長「案を全体に1.5倍」・台帳 #6142)。
// 交換した物は、モンサクの持ちこみの数(mh_monsuc_meta_v1 の items)に足す。新しいキーは作らない・既存の値の意味は変えない。
// ビートP(RHYTHM_EVENT_POINTS_KEY)と持ちこみの数は、1つの取引で保存する(どちらかが書けなければ両方戻す。曲・スタンプの交換と同じ)。
// 公開の印 monheroSuccess が立つまで、売り場(交換所の「モンサク」タブ)を出さない・交換もしない。
// 砂時計2種(時渡り・虹)は、育成への持ちこみ方が決まってから並べる(いまは育成の中でだけ手に入る)。

const MONSUC_SHOP_OFFERS = Object.freeze([
  { itemId: 'oil', cost: 75 }, { itemId: 'herb', cost: 75 },
  { itemId: 'band', cost: 225 }, { itemId: 'mag', cost: 225 }, { itemId: 'hachi', cost: 225 }, { itemId: 'omamori', cost: 225 }, { itemId: 'grass', cost: 225 },
  { itemId: 'dango', cost: 225 }, { itemId: 'guide', cost: 225 },
  { itemId: 'juice', cost: 300 }, { itemId: 'powder', cost: 300 }, { itemId: 'loupe', cost: 300 }, { itemId: 'license', cost: 300 },
  { itemId: 'pack', cost: 375 },
  { itemId: 'awakeFruit', cost: 450 }, { itemId: 'superAwakeFruit', cost: 1200 },
].map((o) => Object.freeze({ ...o, id: `monsuc_${o.itemId}`, kind: 'monsuc' })));
const MONSUC_SHOP_MAX = 999; // 持ちこみの数の上限(記録の読み直し msxNormMeta と同じ)
const monsucShopOpen = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.monheroSuccess === true;
const monsucShopOffer = (id) => MONSUC_SHOP_OFFERS.find((o) => o.id === id) || null;

// 交換する(本体の exchangeRhythmEventPoints から呼ぶ)。値段は画面から来た値を使わず、表から決め直す
const monsucShopBuy = async (offerId, quantity = 1) => {
  const offer = monsucShopOffer(offerId);
  if (!offer) return { ok: false, reason: 'unknown' };
  if (!monsucShopOpen()) return { ok: false, reason: 'soon' };
  const q = Math.max(1, Math.min(99, Math.floor(Number(quantity) || 1)));
  const cost = offer.cost * q;
  const beforePoints = await loadRhythmEventPoints();
  const stored = await storeGet(MSX_KEYS.meta, null, false);
  const base = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : { v: 1 };
  const items = base.items && typeof base.items === 'object' && !Array.isArray(base.items) ? base.items : {};
  const had = Number.isFinite(Number(items[offer.itemId])) ? Math.max(0, Math.floor(Number(items[offer.itemId]))) : 0;
  if (had + q > MONSUC_SHOP_MAX) return { ok: false, reason: 'max', eventPoints: beforePoints };
  if (!(beforePoints >= cost)) return { ok: false, reason: 'points', eventPoints: beforePoints, cost };
  const next = { ...base, v: 1, items: { ...items, [offer.itemId]: had + q } }; // 持ちこみの数に足すだけ(ほかの項目はそのまま)
  const nextPoints = beforePoints - cost;
  const saved = await saveStoredValuesOrRollback([
    { key: RHYTHM_EVENT_POINTS_KEY, before: beforePoints, next: nextPoints },
    { key: MSX_KEYS.meta, before: stored, next },
  ], storeGet, storeSet);
  if (!saved) return { ok: false, reason: 'save', eventPoints: beforePoints };
  return { ok: true, eventPoints: nextPoints, cost, have: had + q };
};
const monsucShopReasonText = (r) => (r === 'points' ? 'ビートPが足りません。' : r === 'max' ? `持てるのは${MONSUC_SHOP_MAX}個までです。` : r === 'soon' ? 'まだ交換できません。' : '交換を保存できませんでした。ビートPと持ちこみの数は変えていません。');

// 交換所の「モンサク」タブの中身。効き目は持ちこみの画面と同じ数値の説明(msxItemFx)を出すので、芯を読みこんでから並べる
function MonsucShopList({ points = 0, busy = false, disabled = false, openSheet, onExchange }) {
  const [have, setHave] = React.useState({});
  const [ready, setReady] = React.useState(false);
  const reload = React.useCallback(async () => {
    try { const m = await storeGet(MSX_KEYS.meta, null, false); setHave(m && m.items && typeof m.items === 'object' ? m.items : {}); } catch (e) { setHave({}); }
  }, []);
  React.useEffect(() => { let alive = true; (async () => { try { if (typeof msxLoad === 'function') await msxLoad(); } catch (e) {} await reload(); if (alive) setReady(true); })(); return () => { alive = false; }; }, [reload]);
  if (!ready) return <p className="col-span-full text-center text-[12px] font-bold text-slate-300">読み込んでいます…</p>;
  return <>
    <p data-monsuc-shop-note className="col-span-full text-[11px] font-bold leading-snug text-slate-300" style={typeof JA_WRAP_STYLE !== 'undefined' ? JA_WRAP_STYLE : undefined}>
      {typeof jaWrap === 'function' ? jaWrap('モンヒロサクセスの育成に持っていくアイテムです。交換した物は、育成をはじめるときの「持ちこみ」で選べます') : 'モンヒロサクセスの育成に持っていくアイテムです。交換した物は、育成をはじめるときの「持ちこみ」で選べます'}
    </p>
    {MONSUC_SHOP_OFFERS.map((offer) => {
      const t = typeof MSX_ITEM_BY_ID !== 'undefined' ? MSX_ITEM_BY_ID[offer.itemId] : null;
      if (!t) return null;
      const n = Math.max(0, Math.floor(Number(have[offer.itemId]) || 0));
      const desc = typeof msxItemDesc === 'function' ? msxItemDesc(offer.itemId) : t.desc;
      const when = t.when === 'before' ? 'はじめる前に効く' : '育成中にも使える';
      const item = { id: offer.id, name: t.name, emoji: t.e, type: 'item', currency: 'beatPoint', cost: offer.cost, desc: `${when}。${desc}` };
      return <MarketProductCard key={offer.id} dataAttrs={{ 'data-monsuc-shop-offer': offer.itemId }}
        item={item} owned={false} comingSoon={false}
        canBuy={points >= offer.cost && !busy && n < MONSUC_SHOP_MAX}
        disabled={disabled}
        onBuy={() => openSheet({ item, stackable: true, confirm: async (count) => { const r = onExchange ? await onExchange(offer, count || 1) : false; await reload(); return r; } })}
        middle={<span data-monsuc-shop-have className="block px-1 text-center text-[10px] font-bold leading-tight text-slate-300">{when}・持っている数 {n.toLocaleString()}</span>}
      />;
    })}
  </>;
}
