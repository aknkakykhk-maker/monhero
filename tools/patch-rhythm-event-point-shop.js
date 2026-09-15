const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(ROOT, rel), text);

const replaceOnce = (rel, before, after, marker) => {
  let text = read(rel);
  if (text.includes(after)) return;
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${rel}: replacement anchor ${marker} expected once, found ${count}`);
  text = text.replace(before, after);
  write(rel, text);
  console.log(`patched ${rel}: ${marker}`);
};

// 1) イベントP交換所の正本データ + 純粋な交換計算。
replaceOnce(
  'monster-hero/data/rhythm-event.js',
  String.raw`const rhythmEventPointAwardAt = (nowMs, songId, score) => {
  const published = (typeof RHYTHM_DEMO_SONG_IDS !== 'undefined' && Array.isArray(RHYTHM_DEMO_SONG_IDS)) ? RHYTHM_DEMO_SONG_IDS : [];
  const id = typeof songId === 'string' ? songId : '';
  if (!id || !published.includes(id)) return null;
  const event = rhythmLimitedEventAt(nowMs);
  if (!event) return null;
  const base = rhythmEventPointBaseForScore(score);
  const target = Array.isArray(event.songIds) && event.songIds.includes(id);
  const multiplier = target ? RHYTHM_EVENT_POINT_TARGET_MULTIPLIER : 1;
  return Object.freeze({ eventId:event.id, base, target, multiplier, amount:Math.floor(base * multiplier) });
};`,
  String.raw`const rhythmEventPointAwardAt = (nowMs, songId, score) => {
  const published = (typeof RHYTHM_DEMO_SONG_IDS !== 'undefined' && Array.isArray(RHYTHM_DEMO_SONG_IDS)) ? RHYTHM_DEMO_SONG_IDS : [];
  const id = typeof songId === 'string' ? songId : '';
  if (!id || !published.includes(id)) return null;
  const event = rhythmLimitedEventAt(nowMs);
  if (!event) return null;
  const base = rhythmEventPointBaseForScore(score);
  const target = Array.isArray(event.songIds) && event.songIds.includes(id);
  const multiplier = target ? RHYTHM_EVENT_POINT_TARGET_MULTIPLIER : 1;
  return Object.freeze({ eventId:event.id, base, target, multiplier, amount:Math.floor(base * multiplier) });
};

// ===== イベントP交換所 STEP3 =====
// 初期価格は docs/spec/RHYTHM_EVENT_POINTS.md §20.1 が正本。
// アイコンは価格(2,000P)だけ決まっており対象IDが未決定なので、ここへは推測で追加しない。
const RHYTHM_EVENT_POINT_SHOP_OFFERS = Object.freeze([
  Object.freeze({ id:'diamond_300', name:'ダイヤ', emoji:'💎', kind:'diamond', grantAmount:300, unit:'ダイヤ', cost:1 }),
  Object.freeze({ id:'training_ticket_x3', name:'トレーニングチケット', emoji:'🎫', kind:'item', itemId:'training_ticket', grantAmount:3, unit:'枚', cost:1 }),
  Object.freeze({ id:'training_ticket_l', name:'重トレーニングチケット', emoji:'🎟️', kind:'item', itemId:'training_ticket_l', grantAmount:1, unit:'枚', cost:3 }),
  Object.freeze({ id:'rainbow_psyche', name:'虹のプシュケー', emoji:'🌈', kind:'item', itemId:'rainbow_psyche', grantAmount:1, unit:'個', cost:1 }),
  Object.freeze({ id:'skip_ticket_jo', name:'スキップチケット・序', emoji:'⏩', kind:'item', itemId:'skip_ticket_jo', grantAmount:1, unit:'枚', cost:10 }),
  Object.freeze({ id:'skip_ticket_ha', name:'スキップチケット・破', emoji:'⏩', kind:'item', itemId:'skip_ticket_ha', grantAmount:1, unit:'枚', cost:16 }),
  Object.freeze({ id:'skip_ticket_kyu', name:'スキップチケット・急', emoji:'⏩', kind:'item', itemId:'skip_ticket_kyu', grantAmount:1, unit:'枚', cost:23 }),
  Object.freeze({ id:'skip_ticket_kiwami', name:'スキップチケット・極', emoji:'⏩', kind:'item', itemId:'skip_ticket_kiwami', grantAmount:1, unit:'枚', cost:50 }),
  Object.freeze({ id:'skip_ticket_haou', name:'スキップチケット・覇', emoji:'⏩', kind:'item', itemId:'skip_ticket_haou', grantAmount:1, unit:'枚', cost:100 }),
  Object.freeze({ id:'hero_proof_shard', name:'勇者の証片', emoji:'🎖️', kind:'item', itemId:'hero_proof_shard', grantAmount:1, unit:'個', cost:500 }),
  Object.freeze({ id:'transcend_fruit_rainbow', name:'虹の超越の実', emoji:'🍇', kind:'item', itemId:'transcend_fruit_rainbow', grantAmount:1, unit:'個', cost:5000 }),
  Object.freeze({ id:'hero_proof', name:'勇者の証', emoji:'🏅', kind:'item', itemId:'hero_proof', grantAmount:1, unit:'個', cost:10000 }),
]);
const rhythmEventPointExchangePreview = ({ offer, eventPoints=0, gold=0, ownedItems={}, quantity=1 } = {}) => {
  const max = Number.MAX_SAFE_INTEGER;
  const safeInt = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : 0;
  };
  const q = Math.max(1, safeInt(quantity));
  const points = safeInt(eventPoints);
  const beforeGold = safeInt(gold);
  const sourceItems = ownedItems && typeof ownedItems === 'object' && !Array.isArray(ownedItems) ? ownedItems : {};
  const unitCost = safeInt(offer?.cost);
  const grantAmount = safeInt(offer?.grantAmount);
  if (!offer || !unitCost || !grantAmount || !['diamond','item'].includes(offer.kind)) {
    return { ok:false, reason:'invalidOffer', quantity:q, eventPoints:points, gold:beforeGold, ownedItems:sourceItems };
  }
  const totalCost = Math.min(max, unitCost * q);
  if (points < totalCost) {
    return { ok:false, reason:'points', quantity:q, cost:totalCost, eventPoints:points, gold:beforeGold, ownedItems:sourceItems };
  }
  const grantTotal = Math.min(max, grantAmount * q);
  const nextItems = { ...sourceItems };
  let nextGold = beforeGold;
  if (offer.kind === 'diamond') nextGold = Math.min(max, beforeGold + grantTotal);
  else {
    const itemId = typeof offer.itemId === 'string' ? offer.itemId : '';
    if (!itemId) return { ok:false, reason:'invalidOffer', quantity:q, eventPoints:points, gold:beforeGold, ownedItems:sourceItems };
    nextItems[itemId] = Math.min(max, safeInt(sourceItems[itemId]) + grantTotal);
  }
  return { ok:true, reason:null, quantity:q, cost:totalCost, eventPoints:points-totalCost, gold:nextGold, ownedItems:nextItems };
};`,
  'event point shop data'
);

// 2) マーケット画面。公開フラグOFF中は従来の「準備中」を保ち、ON時だけ常設交換所を出す。
replaceOnce(
  'monster-hero/src/parts/55-screen-breeder-market.jsx',
  String.raw`  onExchangeHeroProof,
}) {
  // 2026-09-14・マーケットのタブ乱立を避けるため、最初に用途別の入口を選ぶ。
  // 入口だけこの画面のローカル状態で持ち、購入・交換・商品タブの既存stateは親側をそのまま使う。
  const [marketSection,setMarketSection]=useState(null);`,
  String.raw`  onExchangeHeroProof, eventPoints=0, onExchangeEventPoints,
}) {
  // 2026-09-14・マーケットのタブ乱立を避けるため、最初に用途別の入口を選ぶ。
  // 入口だけこの画面のローカル状態で持ち、購入・交換・商品タブの既存stateは親側をそのまま使う。
  const [marketSection,setMarketSection]=useState(null);
  const [eventQuantityOffer,setEventQuantityOffer]=useState(null);
  const [eventQuantity,setEventQuantity]=useState(1);
  const [eventExchangePending,setEventExchangePending]=useState(false);
  const eventPointReleased=typeof RELEASE_FLAGS!=='undefined'&&RELEASE_FLAGS?.rhythmEventPoints===true;
  const safeEventPoints=normalizeRhythmEventPoints(eventPoints);`,
  'event shop props/state'
);
replaceOnce(
  'monster-hero/src/parts/55-screen-breeder-market.jsx',
  String.raw`            {key:'event',emoji:'🎟️',label:'イベントP交換所',titleLines:['イベントP','交換所'],value:null,hint:'準備中',border:'border-violet-400/20',title:'text-violet-300/70',arrow:'text-violet-400/40'},`,
  String.raw`            {key:'event',emoji:'🎟️',label:'イベントP交換所',titleLines:['イベントP','交換所'],value:eventPointReleased?safeEventPoints.toLocaleString():null,hint:eventPointReleased?'所持イベントP':'準備中',border:eventPointReleased?'border-violet-400/35':'border-violet-400/20',title:eventPointReleased?'text-violet-200':'text-violet-300/70',arrow:eventPointReleased?'text-violet-300/80':'text-violet-400/40'},`,
  'event top balance'
);
replaceOnce(
  'monster-hero/src/parts/55-screen-breeder-market.jsx',
  String.raw`      {marketSection==='event'&&<div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-8 text-center">
          <div className="text-3xl mb-2" aria-hidden="true">🎟️</div>
          <div className="text-sm font-black text-slate-300">イベントP交換所は準備中です</div>
          <div className="mt-2 text-[10px] font-bold leading-relaxed text-slate-500">イベントP機能と商品ラインナップは今後追加します。</div>
        </div>
      </div>}`,
  String.raw`      {marketSection==='event'&&!eventPointReleased&&<div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-8 text-center">
          <div className="text-3xl mb-2" aria-hidden="true">🎟️</div>
          <div className="text-sm font-black text-slate-300">イベントP交換所は準備中です</div>
          <div className="mt-2 text-[10px] font-bold leading-relaxed text-slate-500">イベントPの獲得・交換・表示がすべて揃ってから公開します。</div>
        </div>
      </div>}

      {marketSection==='event'&&eventPointReleased&&<>
        <div data-event-point-balance className="mb-3 shrink-0 flex items-center justify-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-950/30 py-2">
          <span aria-hidden="true">🎟️</span>
          <span className="font-mono text-base font-black text-violet-100">{safeEventPoints.toLocaleString()}</span>
          <span className="text-[9px] font-bold text-slate-400">所持イベントP</span>
        </div>
        {marketExchangeError&&<div className="mb-2 shrink-0 rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-center text-[9px] font-black text-red-300">{marketExchangeError}</div>}
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
          <div data-event-point-shop className="grid grid-cols-2 gap-2 pb-4">
            {RHYTHM_EVENT_POINT_SHOP_OFFERS.map(offer=>{
              const maxQuantity=Math.floor(safeEventPoints/offer.cost);
              return <div key={offer.id} data-event-point-offer={offer.id} className="rounded-2xl border border-violet-500/20 bg-slate-950/80 p-3 flex flex-col min-h-[124px]">
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-xl shrink-0">{offer.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] leading-tight font-black text-slate-100">{offer.name}</div>
                    <div className="mt-1 text-[9px] font-bold text-slate-500">1回：{offer.grantAmount.toLocaleString()}{offer.unit}</div>
                  </div>
                </div>
                <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                  <div className="font-mono text-sm font-black text-violet-300">{offer.cost.toLocaleString()}P</div>
                  <button type="button" disabled={maxQuantity<=0||eventExchangePending||purchaseProcessing} onClick={()=>{setEventQuantityOffer(offer);setEventQuantity(1);}} className="min-h-[36px] rounded-xl bg-violet-500 px-3 text-[10px] font-black text-white active:scale-95 disabled:bg-slate-800 disabled:text-slate-500">交換</button>
                </div>
              </div>;
            })}
          </div>
        </div>
      </>}

      {eventQuantityOffer&&eventPointReleased&&(()=>{
        const maxQuantity=Math.floor(safeEventPoints/eventQuantityOffer.cost);
        const quantity=Math.max(1,Math.min(Math.max(1,maxQuantity),Math.floor(Number(eventQuantity)||1)));
        const totalCost=eventQuantityOffer.cost*quantity;
        const totalGrant=eventQuantityOffer.grantAmount*quantity;
        const changeQuantity=(delta)=>setEventQuantity(Math.max(1,Math.min(Math.max(1,maxQuantity),quantity+delta)));
        const canExchange=maxQuantity>0&&!eventExchangePending&&!purchaseProcessing;
        return <div className="fixed inset-0 z-[42000] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="イベントP交換数を選ぶ">
          <div className="w-full max-w-sm rounded-3xl border-2 border-violet-500 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-center gap-2"><span className="text-3xl" aria-hidden="true">{eventQuantityOffer.emoji}</span><div><div className="text-base font-black text-violet-200">{eventQuantityOffer.name}</div><div className="text-[10px] font-bold text-slate-500">1回 {eventQuantityOffer.grantAmount.toLocaleString()}{eventQuantityOffer.unit} ／ {eventQuantityOffer.cost.toLocaleString()}P</div></div></div>
            <div className="mt-4 grid grid-cols-[1fr_1fr_1.4fr_1fr_1fr] items-center gap-1.5">
              <button disabled={quantity<=1} onClick={()=>changeQuantity(-10)} className="min-h-[44px] rounded-xl bg-slate-800 font-black disabled:opacity-30">-10</button>
              <button disabled={quantity<=1} onClick={()=>changeQuantity(-1)} className="min-h-[44px] rounded-xl bg-slate-800 font-black disabled:opacity-30">-1</button>
              <strong className="text-center text-xl font-black font-mono">{quantity}</strong>
              <button disabled={quantity>=maxQuantity} onClick={()=>changeQuantity(1)} className="min-h-[44px] rounded-xl bg-slate-800 font-black disabled:opacity-30">+1</button>
              <button disabled={quantity>=maxQuantity} onClick={()=>changeQuantity(10)} className="min-h-[44px] rounded-xl bg-slate-800 font-black disabled:opacity-30">+10</button>
            </div>
            <button disabled={maxQuantity<=0} onClick={()=>setEventQuantity(Math.max(1,maxQuantity))} className="mt-2 min-h-[44px] w-full rounded-xl bg-violet-900 font-black disabled:opacity-30">MAX（{Math.max(0,maxQuantity).toLocaleString()}回）</button>
            <div className="mt-3 space-y-1.5 rounded-2xl border border-white/10 bg-black/30 p-3 text-[12px] font-black">
              <div className="flex justify-between"><span className="text-slate-400">受け取り</span><span>{totalGrant.toLocaleString()}{eventQuantityOffer.unit}</span></div>
              <div className="flex justify-between text-base"><span className="text-slate-300">合計</span><span className="text-violet-300">{totalCost.toLocaleString()}P</span></div>
              <div className="flex justify-between"><span className="text-slate-400">交換後</span><span className="text-violet-200">残り{Math.max(0,safeEventPoints-totalCost).toLocaleString()}P</span></div>
            </div>
            {marketExchangeError&&<p className="mt-2 text-center text-[11px] font-black text-red-300">{marketExchangeError}</p>}
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button disabled={!canExchange} onClick={async()=>{if(!onExchangeEventPoints)return;setEventExchangePending(true);try{const result=await onExchangeEventPoints(eventQuantityOffer,quantity);if(result?.ok)setEventQuantityOffer(null);}finally{setEventExchangePending(false);}}} className="min-h-[48px] rounded-2xl bg-violet-500 text-white font-black active:scale-[.98] disabled:bg-slate-800 disabled:text-slate-500">交換する</button>
              <button disabled={eventExchangePending} onClick={()=>setEventQuantityOffer(null)} className="min-h-[48px] rounded-2xl border border-white/20 bg-slate-900 font-black active:scale-[.98] disabled:opacity-40">キャンセル</button>
            </div>
          </div>
        </div>;
      })()}`,
  'event shop UI'
);

// 3) MonsterHeroGame 側の残高state・原子的な保存・画面props。
replaceOnce(
  'monster-hero/src/parts/60-app.jsx',
  String.raw`  // マーケットのアイテムの効果説明。カードを小さくしたぶん、詳細ボタンから出す
  const [marketItemDetail, setMarketItemDetail] = useState(null);`,
  String.raw`  // マーケットのアイテムの効果説明。カードを小さくしたぶん、詳細ボタンから出す
  const [marketItemDetail, setMarketItemDetail] = useState(null);
  // イベントPは交換所を開くたび保存値から読み直し、交換成功時だけstateも更新する。
  const [rhythmEventPoints, setRhythmEventPoints] = useState(0);`,
  'event point state'
);
replaceOnce(
  'monster-hero/src/parts/60-app.jsx',
  String.raw`  // 編成画面: 解放済みモンスター/アシストカードの中から、次回以降の周回で使う候補を仮選択する。`,
  String.raw`  // イベントP交換所。残高・ダイヤ・所持アイテムを1取引で保存し、どれか1つでも失敗したら全部戻す。
  const exchangeRhythmEventPoints = async (offer, quantity=1) => {
    if (marketPurchaseProcessingRef.current) return { ok:false, reason:'busy' };
    marketPurchaseProcessingRef.current = true;
    setMarketExchangeError('');
    try {
      const beforePoints = await loadRhythmEventPoints();
      const beforeGold = Math.max(0, Math.floor(Number(gold) || 0));
      const beforeItems = ownedItemsRef.current;
      setRhythmEventPoints(beforePoints);
      const exchange = rhythmEventPointExchangePreview({ offer, eventPoints:beforePoints, gold:beforeGold, ownedItems:beforeItems, quantity });
      if (!exchange.ok) {
        setMarketExchangeError(exchange.reason==='points'?'イベントPが足りません。':'この商品は交換できません。');
        return exchange;
      }
      const saved = await saveStoredValuesOrRollback([
        { key:RHYTHM_EVENT_POINTS_KEY, before:beforePoints, next:exchange.eventPoints },
        { key:'mh_gold', before:beforeGold, next:exchange.gold },
        { key:'mh_owned_items', before:beforeItems, next:exchange.ownedItems },
      ], storeGet, storeSet);
      if (!saved) {
        setMarketExchangeError('交換を保存できませんでした。イベントPと所持品は変更していません。');
        return { ok:false, reason:'save' };
      }
      setRhythmEventPoints(exchange.eventPoints);
      setGold(exchange.gold);
      ownedItemsRef.current = exchange.ownedItems;
      setOwnedItems(exchange.ownedItems);
      saveMissionProgress('market');
      return exchange;
    } catch {
      setMarketExchangeError('交換を保存できませんでした。イベントPと所持品は変更していません。');
      return { ok:false, reason:'save' };
    } finally { marketPurchaseProcessingRef.current = false; }
  };

  // 編成画面: 解放済みモンスター/アシストカードの中から、次回以降の周回で使う候補を仮選択する。`,
  'event point exchange transaction'
);
replaceOnce(
  'monster-hero/src/parts/60-app.jsx',
  String.raw`            onOpenMarket={()=>{addAssistantBond('market');setGameState('BREEDER_MARKET');}}`,
  String.raw`            onOpenMarket={async()=>{addAssistantBond('market');setMarketExchangeError('');setRhythmEventPoints(await loadRhythmEventPoints());setGameState('BREEDER_MARKET');}}`,
  'load event points on market open'
);
replaceOnce(
  'monster-hero/src/parts/60-app.jsx',
  String.raw`            onExchangeHeroProof={exchangeHeroProofByShard}
          />`,
  String.raw`            onExchangeHeroProof={exchangeHeroProofByShard}
            eventPoints={rhythmEventPoints}
            onExchangeEventPoints={exchangeRhythmEventPoints}
          />`,
  'event shop screen props'
);

// 4) ヘルプ。公開フラグに紐づいた既存項目だけを更新するので、STEP3中はまだプレイヤーへ出ない。
replaceOnce(
  'monster-hero/data/help.js',
  String.raw`          {t:'note', releaseFlag:'rhythmEventPoints', title:'イベントP', text:'期間限定イベントの開催中は、公開されている通常のモンヒロビート楽曲を最後まで遊ぶとイベントPを獲得できます。対象曲以外でも獲得でき、イベント対象曲は獲得量が1.5倍になります。イベントPはイベント終了時に消えず、次回以降へ持ち越せます。貯めたPはマーケットの「イベントP交換所」で使え、イベントが開催されていない期間も交換できます。'},`,
  String.raw`          {t:'note', releaseFlag:'rhythmEventPoints', title:'イベントP', text:'期間限定イベントの開催中は、公開されている通常のモンヒロビート楽曲を最後まで遊ぶとイベントPを獲得できます。対象曲以外でも獲得でき、イベント対象曲は獲得量が1.5倍になります。イベントPはイベント終了時に消えず、次回以降へ持ち越せます。貯めたPはマーケットの「イベントP交換所」で、ダイヤ・育成アイテム・スキップチケット・勇者の証片・虹の超越の実・勇者の証などへ交換できます。交換所はイベントが開催されていない期間も使え、同じ商品をまとめて交換できます。'},`,
  'event point help'
);

// 5) 開発中の更新履歴。dev:true なので公開時にもこの途中メモ自体は出さない。
replaceOnce(
  'monster-hero/data/changelog.js',
  String.raw`const CHANGELOG = [`,
  String.raw`const CHANGELOG = [
  {
    date: "2026-09-15 08:00", type:'market', title:'モンヒロビート：イベントP交換所の基盤を実装しました', status:'new', dev:true, releaseFlag:'rhythmEventPoints',
    items:[
      'マーケットのイベントP交換所へ、初期仕様で対象が確定している12商品を実装しました。対象アイコンが未決定のアイコン商品は推測で追加していません。',
      '交換数は±1／±10／MAXで選べ、必要P・受取数・交換後残高を確認してからまとめて交換できます。',
      'イベントP・ダイヤ・所持アイテムは1つの取引として保存し、途中で保存に失敗した場合は交換前へ戻します。',
      'イベントPの獲得・リザルト表示・曲選択表示まで揃うまでは公開フラグをOFFのまま維持します。',
    ],
  },`,
  'STEP3 dev changelog'
);

// 6) 仕様書へ実装状況だけ追記。価格・ラインナップそのものは既存の確定表を変更しない。
replaceOnce(
  'docs/spec/RHYTHM_EVENT_POINTS.md',
  String.raw`> **ステータス: 初期実装確定仕様**
>`,
  String.raw`> **ステータス: 初期実装確定仕様**
>
> 実装状況（2026-09-15）: STEP2の獲得・保存基盤に続き、STEP3としてイベントP交換所の固定12商品・数量選択・原子的保存まで実装する。対象アイコン未決定の「アイコン 2,000P」はこの段階では未実装のまま残す。公開フラグは引き続きOFFとする。
>`,
  'spec implementation status'
);

// 7) 既存のイベント回帰検査へSTEP3を追加。データは実行して数値まで確認する。
replaceOnce(
  'tools/mode/rhythm-event-window-check.js',
  String.raw`const flags=read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const saveSpec=read('docs/spec/SAVE_DATA.md');`,
  String.raw`const flags=read('monster-hero/src/parts/17-release-changelog-login-missions.jsx');
const saveSpec=read('docs/spec/SAVE_DATA.md');
const marketScreen=read('monster-hero/src/parts/55-screen-breeder-market.jsx');`,
  'read event market screen'
);
replaceOnce(
  'tools/mode/rhythm-event-window-check.js',
  String.raw`  +'RHYTHM_EVENT_POINT_TARGET_MULTIPLIER,rhythmEventPointBaseForScore,rhythmEventPointAwardAt,'
  +'rhythmPreviousLimitedEvent,rhythmNextLimitedEvent,rhythmHistoryEvents};',context);`,
  String.raw`  +'RHYTHM_EVENT_POINT_TARGET_MULTIPLIER,rhythmEventPointBaseForScore,rhythmEventPointAwardAt,'
  +'RHYTHM_EVENT_POINT_SHOP_OFFERS,rhythmEventPointExchangePreview,'
  +'rhythmPreviousLimitedEvent,rhythmNextLimitedEvent,rhythmHistoryEvents};',context);`,
  'export shop data to regression VM'
);
replaceOnce(
  'tools/mode/rhythm-event-window-check.js',
  String.raw`check('STEP2の更新履歴は開発メモとして残し、未完成機能を告知しない',(()=>{
  const at=changelog.indexOf('イベントPの獲得・保存基盤を実装しました');
  if(at<0)return false;
  const entry=changelog.slice(at,changelog.indexOf('  },',at));
  return entry.includes('dev:true');
})());`,
  String.raw`check('STEP2の更新履歴は開発メモとして残し、未完成機能を告知しない',(()=>{
  const at=changelog.indexOf('イベントPの獲得・保存基盤を実装しました');
  if(at<0)return false;
  const entry=changelog.slice(at,changelog.indexOf('  },',at));
  return entry.includes('dev:true');
})());

// --- イベントP STEP3（交換所・固定12商品・数量交換・原子的保存） ---
check('イベントP交換所は対象確定済みの固定12商品だけ',(()=>{
  const got=(O.RHYTHM_EVENT_POINT_SHOP_OFFERS||[]).map(o=>[o.id,o.itemId||'',o.grantAmount,o.cost]);
  const want=[
    ['diamond_300','',300,1],['training_ticket_x3','training_ticket',3,1],['training_ticket_l','training_ticket_l',1,3],
    ['rainbow_psyche','rainbow_psyche',1,1],['skip_ticket_jo','skip_ticket_jo',1,10],['skip_ticket_ha','skip_ticket_ha',1,16],
    ['skip_ticket_kyu','skip_ticket_kyu',1,23],['skip_ticket_kiwami','skip_ticket_kiwami',1,50],['skip_ticket_haou','skip_ticket_haou',1,100],
    ['hero_proof_shard','hero_proof_shard',1,500],['transcend_fruit_rainbow','transcend_fruit_rainbow',1,5000],['hero_proof','hero_proof',1,10000],
  ];
  return JSON.stringify(got)===JSON.stringify(want);
})());
check('対象未決定のアイコンを推測でイベントP商品へ入れない',
  (O.RHYTHM_EVENT_POINT_SHOP_OFFERS||[]).length===12
  &&!(O.RHYTHM_EVENT_POINT_SHOP_OFFERS||[]).some(o=>o.kind==='icon'||/アイコン/.test(o.name||'')));
check('イベントPの数量交換計算はダイヤと複数個アイテムを正しく扱う',(()=>{
  const diamond=O.RHYTHM_EVENT_POINT_SHOP_OFFERS.find(o=>o.id==='diamond_300');
  const ticket=O.RHYTHM_EVENT_POINT_SHOP_OFFERS.find(o=>o.id==='training_ticket_x3');
  const a=O.rhythmEventPointExchangePreview({offer:diamond,eventPoints:5,gold:100,ownedItems:{},quantity:2});
  const b=O.rhythmEventPointExchangePreview({offer:ticket,eventPoints:5,gold:100,ownedItems:{training_ticket:4},quantity:2});
  const c=O.rhythmEventPointExchangePreview({offer:ticket,eventPoints:1,gold:100,ownedItems:{training_ticket:4},quantity:2});
  return a.ok&&a.eventPoints===3&&a.gold===700
    &&b.ok&&b.eventPoints===3&&b.ownedItems.training_ticket===10
    &&!c.ok&&c.reason==='points'&&c.eventPoints===1&&c.ownedItems.training_ticket===4;
})());
check('交換保存はイベントP・ダイヤ・所持品を1取引で扱う',(()=>{
  const from=app.indexOf('const exchangeRhythmEventPoints = async');
  const to=app.indexOf('// 編成画面:',from);
  const body=app.slice(from,to);
  return from>=0&&body.includes('saveStoredValuesOrRollback([')
    &&body.includes('{ key:RHYTHM_EVENT_POINTS_KEY')
    &&body.includes("{ key:'mh_gold'")
    &&body.includes("{ key:'mh_owned_items'")
    &&body.includes('setRhythmEventPoints(exchange.eventPoints)')
    &&body.includes('setOwnedItems(exchange.ownedItems)');
})());
check('マーケットを開くたびイベントP保存値を読み直す',
  app.includes("onOpenMarket={async()=>{addAssistantBond('market');setMarketExchangeError('');setRhythmEventPoints(await loadRhythmEventPoints());setGameState('BREEDER_MARKET');}}"));
check('イベントP交換所は公開フラグOFF中は準備中のまま隠す',
  /const RHYTHM_EVENT_POINTS_PUBLIC_RELEASE = false;/.test(flags)
  &&marketScreen.includes("const eventPointReleased=typeof RELEASE_FLAGS!=='undefined'&&RELEASE_FLAGS?.rhythmEventPoints===true;")
  &&marketScreen.includes("marketSection==='event'&&!eventPointReleased")
  &&marketScreen.includes("marketSection==='event'&&eventPointReleased"));
check('イベントP交換所は数量選択とMAX・交換後残高を出す',
  marketScreen.includes('data-event-point-shop')
  &&marketScreen.includes('MAX（{Math.max(0,maxQuantity).toLocaleString()}回）')
  &&marketScreen.includes('交換後')
  &&marketScreen.includes('onExchangeEventPoints(eventQuantityOffer,quantity)'));
check('STEP3の更新履歴も開発メモとして隠す',(()=>{
  const at=changelog.indexOf('イベントP交換所の基盤を実装しました');
  if(at<0)return false;
  const entry=changelog.slice(at,changelog.indexOf('  },',at));
  return entry.includes('dev:true')&&entry.includes("releaseFlag:'rhythmEventPoints'");
})());`,
  'STEP3 regression checks'
);

console.log('event point shop patch complete');
