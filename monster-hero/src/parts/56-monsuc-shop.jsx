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
      {typeof jaWrap === 'function' ? jaWrap('モンヒロサクセスの育成に持っていくアイテムです。交換した物は、育成を始めるときの「持ちこみ」で選べます') : 'モンヒロサクセスの育成に持っていくアイテムです。交換した物は、育成を始めるときの「持ちこみ」で選べます'}
    </p>
    {MONSUC_SHOP_OFFERS.map((offer) => {
      const t = typeof MSX_ITEM_BY_ID !== 'undefined' ? MSX_ITEM_BY_ID[offer.itemId] : null;
      if (!t) return null;
      const n = Math.max(0, Math.floor(Number(have[offer.itemId]) || 0));
      const desc = typeof msxItemDesc === 'function' ? msxItemDesc(offer.itemId) : t.desc;
      const when = offer.itemId === 'pack' ? '持ちこむと中身が使える' : t.when === 'before' ? '始める前に効く' : '育成中にも使える'; // オイリーパックは中身が初めから持ち物に入る(2026-11-18)
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

// ===== 持ちこみの段から開くビートP交換所(2026-11-19 作業ボード id48・あっくん決定) =====
// 育成をはじめる前の「持ちこみ」で、持っていない・足りない物に気づいたときに、その場で交換できるようにする。
// マーケットの画面へ移ると、MsxStart の準備(選んだモンスター・編成・助手・持ちこみ)が消えてしまうので、画面は移さず、
// ランキングの画面(MonsucRankScreen)と同じ形の重ね画面で開く。中身はマーケットの「モンサク」タブと同じ一覧
// (MonsucShopList)と確認の窓(MarketPurchaseSheet)で、買う処理も同じ monsucShopBuy(値段は表から決め直す・
// ビートPと持ちこみの数を1つの取引で保存する)。
// 閉じるときは、買ったかどうかを onClose(bought) で返し、親(MonheroSuccessScreen)が持ちこみの数を読み直す
//   (読み直さないと、育成をはじめるときに古い数で保存し直して、買った分が消える)。
function MonsucCarryShop({ onClose }) {
  const [points, setPoints] = React.useState(0);
  const [sheet, setSheet] = React.useState(null);
  const [sheetQuantity, setSheetQuantity] = React.useState(1);
  const [sheetPending, setSheetPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const boughtRef = React.useRef(false);
  const busyRef = React.useRef(false); // マーケットの confirmSheet と同じ、二度押しで2回買わないための見張り
  React.useEffect(() => { let alive = true; (async () => { try { const p = await loadRhythmEventPoints(); if (alive) setPoints(Math.max(0, Math.floor(Number(p) || 0))); } catch (e) {} })(); return () => { alive = false; }; }, []);
  const openSheet = (next) => { setError(''); setSheetQuantity(1); setSheet(next); };
  const closeSheet = () => { if (!sheetPending) setSheet(null); };
  const onExchange = async (offer, count) => {
    if (busyRef.current) return { ok: false, reason: 'busy' };
    busyRef.current = true;
    try {
      const r = await monsucShopBuy(offer.id, count);
      if (r && r.ok) { boughtRef.current = true; setPoints(r.eventPoints); }
      else setError(monsucShopReasonText(r && r.reason));
      return r;
    } catch (e) {
      setError(monsucShopReasonText('save'));
      return { ok: false, reason: 'save' };
    } finally { busyRef.current = false; }
  };
  const confirmSheet = async (count) => {
    if (!sheet || sheetPending) return;
    setSheetPending(true);
    try {
      const result = await sheet.confirm(count);
      if (result === true || (result && result.ok)) setSheet(null);
    } finally { setSheetPending(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex flex-col text-white" style={{ background: 'linear-gradient(180deg,#1e1b4b 0%,#0f172a 100%)', paddingTop: 'var(--mh-sa-top)', paddingBottom: 'var(--mh-sa-bottom)' }} data-msx-carry-shop>
      <div className="flex items-center gap-2 px-3 pt-3">
        <button type="button" onClick={() => onClose(boughtRef.current)} className="rounded-full bg-slate-700/80 px-3 py-1 text-[12px] font-bold">← 戻る</button>
        <div className="text-[13px] font-black text-pink-300">🌱 モンヒロサクセス</div>
        <div className="ml-auto text-[12px] font-black text-violet-200">🎟️ {points.toLocaleString()} ビートP</div>
      </div>
      <div className="px-3 pt-2">
        <div className="text-[18px] font-black">🛒 ビートP交換所</div>
        <div className="text-[11px] text-slate-300 leading-snug">持ちこみの品をビートPと交換できます。交換した物は、戻った先の「持ちこみ」でそのまま選べます</div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
        <div className={MARKET_GRID_CLASS}>
          <MonsucShopList points={points} busy={sheetPending} disabled={sheetPending} openSheet={openSheet} onExchange={onExchange}/>
        </div>
      </div>
      {sheet && typeof MarketPurchaseSheet === 'function' ? <MarketPurchaseSheet
        item={sheet.item}
        balance={points}
        stackable={!!sheet.stackable}
        countUnit={sheet.countUnit || '個'}
        grantAmount={sheet.grantAmount || 0}
        grantUnit={sheet.grantUnit || ''}
        quantity={sheetQuantity}
        onQuantity={setSheetQuantity}
        pending={sheetPending}
        error={error}
        onConfirm={confirmSheet}
        onCancel={closeSheet}
      /> : null}
    </div>
  );
}
