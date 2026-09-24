// ==== 画面: マーケット(gameState === 'BREEDER_MARKET') ====
//
// MonsterHeroGame から切り出した5画面目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-6)。
// 型は 51〜54 と同じ。
//
// 【この画面ならではの注意】
// ・購入(buyMarketItem)と勇者の証での交換(exchangeSoulRankRespecByProof)は
//   保存を伴うので中身は MonsterHeroGame 側に残し、props で受け取る。画面は「どれを」だけ渡す
// ・所持しているか(isMarketItemOwned)は本体の state(解放済みモンスター・教え・アイコン)を
//   見るので、判定ごと props で受け取る
// ・購入処理中かどうかは ref(marketPurchaseProcessingRef)で持っている。ref は変わっても
//   描き直しが起きないので、**ここでも props は真偽値**にしてある(描画のたびに読む今の作りと同じ)。
//   ref そのものを渡すと「画面が本体の中身を持つ」形になるので渡さない
// ・商品の並べ方(MARKET_GRID_CLASS)と1枚のカード(MarketProductCard)は共有層 20 の持ち物
// ・助手の告知(assistantNotice)は更新履歴 → data/assistants.js の仕組みで、この画面とは別。
//   ここが変わっても boot/market-notice-check の対象は動かない
// ・この画面にタイマーは無い(docs/refactor/SCREEN_EFFECTS_MAP.md に BREEDER_MARKET の行が無い)
function BreederMarketScreen({
  gold, breederPoints, ownedItems, marketTab, marketExchangeError, purchaseProcessing,
  isItemOwned, onBack, onSelectTab, onZoomIcon, onBuy, onOpenDetail, onOpenItemDetail, onExchangeSoulRankRespec,
  onExchangeHeroProof, eventPoints=0, onExchangeEventPoints,
}) {
  // 2026-09-14・マーケットのタブ乱立を避けるため、最初に用途別の入口を選ぶ。
  // 入口だけこの画面のローカル状態で持ち、購入・交換・商品タブの既存stateは親側をそのまま使う。
  const [marketSection,setMarketSection]=useState(null);
  const [eventQuantityOffer,setEventQuantityOffer]=useState(null);
  const [eventQuantity,setEventQuantity]=useState(1);
  const [eventExchangePending,setEventExchangePending]=useState(false);
  const safeEventPoints=normalizeRhythmEventPoints(eventPoints);
  const psycheHave = ownedItemCount(ownedItems, BREAKTHROUGH_ITEM_ID);
  const shardHave = ownedItemCount(ownedItems, HERO_PROOF_SHARD_ITEM_ID);
  const proofHave = ownedItemCount(ownedItems, HERO_PROOF_ITEM_ID);
  const marketItems = BREEDER_MARKET_ITEMS.filter(item=>item.shop!==false);
  const diamondTabs = [
    {key:'disc',label:'円盤石'},
    {key:'assist',label:'アシスト'},
    {key:'item',label:'アイテム'},
  ];
  const activeDiamondTab = diamondTabs.some(tab=>tab.key===marketTab)?marketTab:'disc';
  const diamondItems = marketItems.filter(item=>item.type===activeDiamondTab&&item.type!=='icon'&&item.currency!=='psyche');
  const breederPointItems = marketItems.filter(item=>item.type==='icon');
  const itemExchangeItems = marketItems.filter(item=>item.currency==='psyche');
  const soulRankRespecItem = marketItems.find(item=>item.id===SOUL_RANK_RESPEC_ITEM_ID) || null;
  const sectionMeta = {
    diamond:{label:'ダイヤショップ',emoji:'💎'},
    breeder:{label:'ブリーダーP交換所',emoji:'🪙'},
    exchange:{label:'アイテム交換所',emoji:'🔄'},
    event:{label:'ビートP交換所',emoji:'🎟️'},
  };

  const renderMarketItem=(item,{showBase=true,showHeroProofExchange=false}={})=>{
    const comingSoon = item.available === false;
    const owned = !comingSoon && isItemOwned(item);
    const balance = item.currency==='psyche' ? psycheHave : item.type==='disc' || item.type==='assist' || item.type==='item' ? gold : breederPoints;
    const canBuy = !comingSoon && !owned && balance>=item.cost;
    const detailMon = item.type==='disc' ? ALL_PLAYER_MONSTERS[item.id] : null;
    const detailTeaching = item.type==='assist' ? TEACHING_CARDS.find(t=>t.id===item.id) : null;
    const isSoulRankRespec=item.id===SOUL_RANK_RESPEC_ITEM_ID;
    const exchangeItem=isSoulRankRespec?{...item,currency:'heroProof',cost:1}:null;
    return (
      <React.Fragment key={item.id}>
        {showBase&&<MarketProductCard
          item={item} owned={owned} comingSoon={comingSoon} canBuy={canBuy}
          onZoom={()=>onZoomIcon(item)} onBuy={()=>onBuy(item)}
          detail={detailMon||detailTeaching}
          onDetail={()=>onOpenDetail(item,detailMon,detailTeaching)}
          middle={item.type==='item'?<><span className={`text-[11px] font-black ${(ownedItems[item.id]||0)>0?'text-cyan-300':'text-slate-400'}`}>×{ownedItems[item.id]||0}</span>{item.desc&&<MarketDetailChip label={`${item.name}の効果を見る`} onClick={()=>onOpenItemDetail(item)}/>}</>:null}
        />}
        {showHeroProofExchange&&exchangeItem&&<MarketProductCard
          item={exchangeItem} owned={false} comingSoon={false}
          canBuy={proofHave>0&&!purchaseProcessing}
          disabled={purchaseProcessing}
          onBuy={onExchangeSoulRankRespec}
          middle={<><span className={`text-[11px] font-black ${ownedItemCount(ownedItems,SOUL_RANK_RESPEC_ITEM_ID)>0?'text-cyan-300':'text-slate-400'}`}>×{ownedItemCount(ownedItems,SOUL_RANK_RESPEC_ITEM_ID)}</span>{item.desc&&<MarketDetailChip label={`${item.name}の効果を見る`} onClick={()=>onOpenItemDetail(item)}/>}</>}
        />}
      </React.Fragment>
    );
  };

  const headerTitle = marketSection ? sectionMeta[marketSection].label : 'マーケット';
  const handleBack = ()=>{
    if(marketSection){ setMarketSection(null); return; }
    onBack();
  };

  return (
    <div data-mh-screen className={SCREEN_SHELL_CLASS}>
      <ScreenHead title={headerTitle} accent="text-amber-400" onBack={handleBack}
        icon={marketSection?<span aria-hidden="true">{sectionMeta[marketSection].emoji}</span>:<ShoppingBag size={20}/>}/>
      <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="market" compact condition={Number.isFinite(CHEAPEST_GOLD_ITEM_COST)&&gold<CHEAPEST_GOLD_ITEM_COST?'lowGold':null}/></div>

      {!marketSection&&<div data-market-top className={`relative ${SCREEN_LIST_CLASS}`}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-1 h-60 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-amber-500/5 to-violet-500/10 blur-2xl"/>
        <div className="relative grid grid-cols-2 gap-2.5 pt-1 pb-2">
          {[
            {key:'diamond',emoji:'💎',label:'ダイヤショップ',value:gold.toLocaleString(),hint:'ダイヤで購入',border:'border-cyan-400/35',title:'text-cyan-200',arrow:'text-cyan-300/80'},
            {key:'breeder',emoji:'🪙',label:'ブリーダーP交換所',titleLines:['ブリーダーP','交換所'],value:breederPoints.toLocaleString(),hint:'Lv.UPで獲得',border:'border-amber-400/35',title:'text-amber-200',arrow:'text-amber-300/80'},
            {key:'exchange',emoji:'🔄',label:'アイテム交換所',value:null,hint:'プシュケー・証など',border:'border-emerald-400/35',title:'text-emerald-200',arrow:'text-emerald-300/80'},
            {key:'event',emoji:'🎟️',label:'ビートP交換所',titleLines:['ビートP','交換所'],value:safeEventPoints.toLocaleString(),hint:'所持ビートP',border:'border-violet-400/35',title:'text-violet-200',arrow:'text-violet-300/80'},
          ].map(section=>(
            <button
              key={section.key}
              data-market-section={section.key}
              onClick={()=>setMarketSection(section.key)}
              className={`relative min-h-[112px] rounded-2xl border ${section.border} bg-slate-950/70 px-4 py-4 pr-9 text-left active:scale-[.98]`}
            >
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="text-2xl">{section.emoji}</span>
                <span className={`text-[12px] font-black leading-tight ${section.title}`}>{section.titleLines?section.titleLines.map(line=><span key={line} className="block">{line}</span>):section.label}</span>
              </div>
              <div className="mt-2.5 font-mono text-xl font-black text-white">{section.value!==null?section.value:'\u00a0'}</div>
              <div className="mt-0.5 text-[10px] font-bold text-slate-400">{section.hint}</div>
              <span aria-hidden="true" className={`absolute bottom-3 right-3 text-xl font-black ${section.arrow}`}>›</span>
            </button>
          ))}
        </div>
      </div>}

      {marketSection==='diamond'&&<>
        <div className="mb-2 shrink-0 flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-950/30 py-2">
          <Gem size={15} className="text-cyan-300"/>
          <span className="font-mono text-base font-black text-cyan-100">{gold.toLocaleString()}</span>
          <span className="text-[10px] font-bold text-slate-400">所持ダイヤ</span>
        </div>
        <ScreenTabs value={activeDiamondTab} onChange={onSelectTab}
          items={diamondTabs.map(tab=>({id:tab.key,label:tab.label,color:'#0891b2'}))}/>
        <div className={SCREEN_LIST_CLASS}>
          {diamondItems.length===0?<ScreenEmpty emoji="🛒" lines={['まだ商品がありません']}/>:<div className={MARKET_GRID_CLASS}>{diamondItems.map(item=>renderMarketItem(item))}</div>}
        </div>
      </>}

      {marketSection==='breeder'&&<>
        <div className="mb-2 shrink-0 flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-950/30 py-2">
          <Coins size={15} className="text-amber-300"/>
          <span className="font-mono text-base font-black text-amber-100">{breederPoints.toLocaleString()}</span>
          <span className="text-[10px] font-bold text-slate-400">所持ブリーダーP</span>
        </div>
        <div className={SCREEN_LIST_CLASS}>
          {breederPointItems.length===0?<ScreenEmpty emoji="🛒" lines={['まだ商品がありません']}/>:<div className={MARKET_GRID_CLASS}>{breederPointItems.map(item=>renderMarketItem(item))}</div>}
        </div>
      </>}

      {marketSection==='exchange'&&<>
        <div data-market-balances className="grid grid-cols-3 gap-2 mb-2 shrink-0">
          {[
            { key:'psyche', emoji:'🌈', label:'虹のプシュケー', value:psycheHave, tone:'text-fuchsia-200 border-fuchsia-500/30 bg-fuchsia-950/30' },
            { key:'shard',  emoji:'🎖️', label:'勇者の証片',     value:shardHave,  tone:'text-amber-100 border-amber-400/30 bg-amber-950/30' },
            { key:'proof',  emoji:'🏅', label:'勇者の証',       value:proofHave,  tone:'text-amber-200 border-amber-400/30 bg-amber-950/30' },
          ].map(row=>(
            <div key={row.key} data-market-balance={row.key} className={`flex flex-col items-center justify-center rounded-2xl border py-2 ${row.tone}`}>
              <div className="flex items-baseline gap-1">
                <span aria-hidden="true" className="text-[11px]">{row.emoji}</span>
                <span className="font-mono text-sm font-black">{row.value.toLocaleString()}</span>
              </div>
              <span className="text-[10px] font-bold leading-tight text-slate-400">{row.label}</span>
            </div>
          ))}
        </div>
        {marketExchangeError&&<div className="mb-2 shrink-0 rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-center text-[11px] font-black text-red-300">{marketExchangeError}</div>}
        <div className={SCREEN_LIST_CLASS}>
          <div className={MARKET_GRID_CLASS}>
            {itemExchangeItems.map(item=>renderMarketItem(item))}
            {soulRankRespecItem&&renderMarketItem(soulRankRespecItem,{showBase:false,showHeroProofExchange:true})}
            <MarketProductCard
              item={{...HERO_PROOF_ITEM, type:'item', currency:'heroProofShard', cost:HERO_PROOF_SHARD_PER_PROOF}}
              owned={false} comingSoon={false}
              canBuy={shardHave>=HERO_PROOF_SHARD_PER_PROOF&&!purchaseProcessing}
              disabled={purchaseProcessing}
              onBuy={onExchangeHeroProof}
              middle={<><span className={`text-[11px] font-black ${proofHave>0?'text-cyan-300':'text-slate-400'}`}>×{proofHave}</span><MarketDetailChip label="勇者の証の効果を見る" onClick={()=>onOpenItemDetail(HERO_PROOF_ITEM)}/></>}
            />
          </div>
        </div>
      </>}

      {marketSection==='event'&&<>
        <div data-event-point-balance className="mb-2 shrink-0 flex items-center justify-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-950/30 py-2">
          <span aria-hidden="true" className="text-[15px]">🎟️</span>
          <span className="font-mono text-base font-black text-violet-100">{safeEventPoints.toLocaleString()}</span>
          <span className="text-[10px] font-bold text-slate-400">所持ビートP</span>
        </div>
        {marketExchangeError&&<div className="mb-2 shrink-0 rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-center text-[11px] font-black text-red-300">{marketExchangeError}</div>}
        <div className={SCREEN_LIST_CLASS}>
          <div data-event-point-shop className="grid grid-cols-2 gap-2.5 pb-4">
            {RHYTHM_EVENT_POINT_SHOP_OFFERS.map(offer=>{
              const maxQuantity=Math.floor(safeEventPoints/offer.cost);
              return <div key={offer.id} data-event-point-offer={offer.id} className="rounded-2xl border border-white/10 bg-slate-950/80 p-3 flex flex-col min-h-[132px]">
                <div className="flex items-start gap-2">
                  <span aria-hidden="true" className="text-xl shrink-0">{offer.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] leading-tight font-black text-slate-100">{offer.name}</div>
                    <div className="mt-1 text-[10px] font-bold text-slate-400">1回：{offer.grantAmount.toLocaleString()}{offer.unit}</div>
                  </div>
                </div>
                <div className="mt-auto pt-2 flex items-end justify-between gap-2">
                  <div className="font-mono text-sm font-black text-violet-300">{offer.cost.toLocaleString()}P</div>
                  <button type="button" disabled={maxQuantity<=0||eventExchangePending||purchaseProcessing} onClick={()=>{setEventQuantityOffer(offer);setEventQuantity(1);}} className="mh-button mh-button-primary min-h-[44px] rounded-xl bg-violet-500 px-4 text-[11px] font-black text-white active:scale-95 disabled:bg-slate-800 disabled:text-slate-500">交換</button>
                </div>
              </div>;
            })}
          </div>
        </div>
      </>}

      {eventQuantityOffer&&(()=>{
        const maxQuantity=Math.floor(safeEventPoints/eventQuantityOffer.cost);
        const quantity=Math.max(1,Math.min(Math.max(1,maxQuantity),Math.floor(Number(eventQuantity)||1)));
        const totalCost=eventQuantityOffer.cost*quantity;
        const totalGrant=eventQuantityOffer.grantAmount*quantity;
        const changeQuantity=(delta)=>setEventQuantity(Math.max(1,Math.min(Math.max(1,maxQuantity),quantity+delta)));
        const canExchange=maxQuantity>0&&!eventExchangePending&&!purchaseProcessing;
        return <div className="fixed inset-0 z-[42000] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="ビートP交換数を選ぶ">
          <div className="w-full max-w-sm rounded-2xl border border-violet-500/60 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-center gap-2"><span className="text-3xl" aria-hidden="true">{eventQuantityOffer.emoji}</span><div><div className="text-base font-black text-violet-200">{eventQuantityOffer.name}</div><div className="text-[10px] font-bold text-slate-400">1回 {eventQuantityOffer.grantAmount.toLocaleString()}{eventQuantityOffer.unit} ／ {eventQuantityOffer.cost.toLocaleString()}P</div></div></div>
            <div className="mt-4 grid grid-cols-[1fr_1fr_1.4fr_1fr_1fr] items-center gap-1.5">
              <button disabled={quantity<=1} onClick={()=>changeQuantity(-10)} className="mh-button mh-button-secondary min-h-[44px] rounded-xl bg-slate-800 font-black active:scale-95 disabled:opacity-40">-10</button>
              <button disabled={quantity<=1} onClick={()=>changeQuantity(-1)} className="mh-button mh-button-secondary min-h-[44px] rounded-xl bg-slate-800 font-black active:scale-95 disabled:opacity-40">-1</button>
              <strong className="text-center text-xl font-black font-mono">{quantity}</strong>
              <button disabled={quantity>=maxQuantity} onClick={()=>changeQuantity(1)} className="mh-button mh-button-secondary min-h-[44px] rounded-xl bg-slate-800 font-black active:scale-95 disabled:opacity-40">+1</button>
              <button disabled={quantity>=maxQuantity} onClick={()=>changeQuantity(10)} className="mh-button mh-button-secondary min-h-[44px] rounded-xl bg-slate-800 font-black active:scale-95 disabled:opacity-40">+10</button>
            </div>
            <button disabled={maxQuantity<=0} onClick={()=>setEventQuantity(Math.max(1,maxQuantity))} className="mh-button mh-button-secondary mt-2 min-h-[44px] w-full rounded-xl bg-violet-900 font-black active:scale-95 disabled:opacity-40">MAX（{Math.max(0,maxQuantity).toLocaleString()}回）</button>
            <div className="mt-3 space-y-1.5 rounded-2xl border border-white/10 bg-black/30 p-3 text-[12px] font-black">
              <div className="flex justify-between"><span className="text-slate-400">受け取り</span><span>{totalGrant.toLocaleString()}{eventQuantityOffer.unit}</span></div>
              <div className="flex justify-between text-base"><span className="text-slate-300">合計</span><span className="text-violet-300">{totalCost.toLocaleString()}P</span></div>
              <div className="flex justify-between"><span className="text-slate-400">交換後</span><span className="text-violet-200">残り{Math.max(0,safeEventPoints-totalCost).toLocaleString()}P</span></div>
            </div>
            {marketExchangeError&&<p className="mt-2 text-center text-[11px] font-black text-red-300">{marketExchangeError}</p>}
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button disabled={!canExchange} onClick={async()=>{if(!onExchangeEventPoints)return;setEventExchangePending(true);try{const result=await onExchangeEventPoints(eventQuantityOffer,quantity);if(result?.ok)setEventQuantityOffer(null);}finally{setEventExchangePending(false);}}} className="mh-button mh-button-primary min-h-[52px] rounded-xl bg-violet-500 text-white font-black active:scale-[.98] disabled:bg-slate-800 disabled:text-slate-500">交換する</button>
              <button disabled={eventExchangePending} onClick={()=>setEventQuantityOffer(null)} className="mh-button mh-button-secondary min-h-[52px] rounded-xl border border-white/10 bg-slate-900 font-black active:scale-[.98] disabled:opacity-40">キャンセル</button>
            </div>
          </div>
        </div>;
      })()}
    </div>
  );
}
