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
//
// 【どの売り場も同じ部品で描く】(2026-09-28 ユーザー指示「ショップの作りを全部統一して」)
// ・商品は MarketProductCard を MARKET_GRID_CLASS(3列)で並べる。ビートP交換所も同じ
// ・上の残高は MarketBalanceBar、知らせは MarketNotice
// ・買う/交換するときは、どの品も MarketPurchaseSheet(確認の窓)を通す。
//   以前は円盤石・アシスト・アイコン・勇者の証の交換が、押した瞬間に確認なしで実行されていた
// ・窓はこの画面が1つだけ持つ(sheet)。保存の中身は本体のまま(onBuy などは成功したら true / {ok:true} を返す)
function BreederMarketScreen({
  gold, breederPoints, ownedItems, marketTab, marketExchangeError, purchaseProcessing,
  isItemOwned, onBack, onSelectTab, onZoomIcon, onBuy, onOpenDetail, onOpenItemDetail, onExchangeSoulRankRespec,
  onExchangeHeroProof, eventPoints=0, onExchangeEventPoints,
}) {
  // 2026-09-14・マーケットのタブ乱立を避けるため、最初に用途別の入口を選ぶ。
  // 入口だけこの画面のローカル状態で持ち、購入・交換・商品タブの既存stateは親側をそのまま使う。
  const [marketSection,setMarketSection]=useState(null);
  // 開いている購入/交換の確認窓。{ item, balance, stackable, countUnit, grantAmount, grantUnit, confirm(count) }
  const [sheet,setSheet]=useState(null);
  const [sheetQuantity,setSheetQuantity]=useState(1);
  const [sheetPending,setSheetPending]=useState(false);
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
  const balanceOf = (currency) => currency==='psyche' ? psycheHave : currency==='heroProofShard' ? shardHave : currency==='heroProof' ? proofHave
    : currency==='beatPoint' ? safeEventPoints : currency==='breederPoint' ? breederPoints : gold;
  const busy = purchaseProcessing || sheetPending;

  const openSheet = (next) => { setSheetQuantity(1); setSheet(next); };
  const closeSheet = () => { if(!sheetPending) setSheet(null); };
  const confirmSheet = async (count) => {
    if(!sheet||sheetPending) return;
    setSheetPending(true);
    try {
      const result = await sheet.confirm(count);
      if(result===true||result?.ok) setSheet(null);
    } finally { setSheetPending(false); }
  };
  // 所持数と詳細ボタン。消耗品のカードはどの売り場でもこの形
  const ownedMiddle = (count, detailItem, extraDetail=null) => <>
    <span className={`text-[11px] font-black ${count>0?'text-cyan-300':'text-slate-400'}`}>×{count}</span>
    {detailItem?.desc&&<MarketDetailChip label={`${detailItem.name}の効果を見る`} onClick={()=>onOpenItemDetail(extraDetail?{...detailItem,...extraDetail}:detailItem)}/>}
  </>;

  const renderMarketItem=(item,{showBase=true,showHeroProofExchange=false}={})=>{
    const comingSoon = item.available === false;
    const owned = !comingSoon && isItemOwned(item);
    const balance = balanceOf(marketCurrencyOf(item));
    const canBuy = !comingSoon && !owned && balance>=item.cost && !busy;
    const detailMon = item.type==='disc' ? ALL_PLAYER_MONSTERS[item.id] : null;
    const detailTeaching = item.type==='assist' ? TEACHING_CARDS.find(t=>t.id===item.id) : null;
    const isSoulRankRespec=item.id===SOUL_RANK_RESPEC_ITEM_ID;
    const exchangeItem=isSoulRankRespec?{...item,currency:'heroProof',cost:1}:null;
    return (
      <React.Fragment key={item.id}>
        {showBase&&<MarketProductCard
          item={item} owned={owned} comingSoon={comingSoon} canBuy={canBuy}
          onZoom={()=>onZoomIcon(item)}
          onBuy={()=>openSheet({ item, stackable:item.type==='item', confirm:(count)=>onBuy(item,count) })}
          detail={detailMon||detailTeaching}
          onDetail={()=>onOpenDetail(item,detailMon,detailTeaching)}
          middle={item.type==='item'?<><span className={`text-[11px] font-black ${(ownedItems[item.id]||0)>0?'text-cyan-300':'text-slate-400'}`}>×{ownedItems[item.id]||0}</span>{item.desc&&<MarketDetailChip label={`${item.name}の効果を見る`} onClick={()=>onOpenItemDetail(item)}/>}</>:null}
        />}
        {showHeroProofExchange&&exchangeItem&&<MarketProductCard
          item={exchangeItem} owned={false} comingSoon={false}
          canBuy={proofHave>0&&!busy}
          disabled={purchaseProcessing}
          onZoom={()=>onZoomIcon(item)}
          onBuy={()=>openSheet({ item:exchangeItem, confirm:()=>onExchangeSoulRankRespec() })}
          middle={ownedMiddle(ownedItemCount(ownedItems,SOUL_RANK_RESPEC_ITEM_ID), item)}
        />}
      </React.Fragment>
    );
  };

  // ビートP交換所の品を、ほかの売り場と同じ商品カードの形にする。
  // 1回で2つ以上もらえる品は名前に「×数」を付け、詳細と確認の窓に「受け取り」を出す
  const beatPointItemOf = (offer) => {
    const base = offer.itemId ? (BREEDER_MARKET_ITEMS.find(item=>item.id===offer.itemId) || [HERO_PROOF_ITEM,HERO_PROOF_SHARD_ITEM].find(item=>item.id===offer.itemId) || null) : null;
    return { id:offer.id, name:offer.grantAmount>1?`${offer.name} ×${offer.grantAmount.toLocaleString()}`:offer.name, emoji:offer.emoji,
      icon:base?.icon, type:'item', currency:'beatPoint', cost:offer.cost, desc:base?.desc||'', base };
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
              <div className="mt-2.5 font-mono text-xl font-black text-white">{section.value!==null?section.value:' '}</div>
              <div className="mt-0.5 text-[10px] font-bold text-slate-400">{section.hint}</div>
              <span aria-hidden="true" className={`absolute bottom-3 right-3 text-xl font-black ${section.arrow}`}>›</span>
            </button>
          ))}
        </div>
      </div>}

      {marketSection&&<>
        <MarketBalanceBar balances={
          marketSection==='diamond'?[{currency:'diamond',value:gold}]
          :marketSection==='breeder'?[{currency:'breederPoint',value:breederPoints}]
          :marketSection==='exchange'?[{currency:'psyche',value:psycheHave},{currency:'heroProofShard',value:shardHave},{currency:'heroProof',value:proofHave}]
          :[{currency:'beatPoint',value:safeEventPoints}]}/>
        {/* ビートPアップキャンペーン中の知らせ(2026-09-28)。開いたときの時刻で数え直す */}
        {marketSection==='event'&&(()=>{const campaign=typeof rhythmEventPointCampaignAt==='function'&&!rhythmLimitedEventAt(Date.now())?rhythmEventPointCampaignAt(Date.now()):null;
          return campaign?<MarketNotice tone="info" data-event-point-campaign>🎟️ {campaign.name}中：モンヒロビートの公開曲でビートPがいつもの{campaign.boost}倍（{rhythmEventJstText(Date.parse(campaign.endAt))}まで）</MarketNotice>:null;})()}
        {marketExchangeError&&!sheet&&<MarketNotice>{marketExchangeError}</MarketNotice>}
      </>}

      {marketSection==='diamond'&&<>
        <ScreenTabs value={activeDiamondTab} onChange={onSelectTab}
          items={diamondTabs.map(tab=>({id:tab.key,label:tab.label,color:'#0891b2'}))}/>
        <div className={SCREEN_LIST_CLASS}>
          {diamondItems.length===0?<ScreenEmpty emoji="🛒" lines={['まだ商品がありません']}/>:<div className={MARKET_GRID_CLASS}>{diamondItems.map(item=>renderMarketItem(item))}</div>}
        </div>
      </>}

      {marketSection==='breeder'&&<div className={SCREEN_LIST_CLASS}>
        {breederPointItems.length===0?<ScreenEmpty emoji="🛒" lines={['まだ商品がありません']}/>:<div className={MARKET_GRID_CLASS}>{breederPointItems.map(item=>renderMarketItem(item))}</div>}
      </div>}

      {marketSection==='exchange'&&<div className={SCREEN_LIST_CLASS}>
        <div className={MARKET_GRID_CLASS}>
          {itemExchangeItems.map(item=>renderMarketItem(item))}
          {soulRankRespecItem&&renderMarketItem(soulRankRespecItem,{showBase:false,showHeroProofExchange:true})}
          {(()=>{const shardExchange={...HERO_PROOF_ITEM, type:'item', currency:'heroProofShard', cost:HERO_PROOF_SHARD_PER_PROOF};return <MarketProductCard
            item={shardExchange}
            owned={false} comingSoon={false}
            canBuy={shardHave>=HERO_PROOF_SHARD_PER_PROOF&&!busy}
            disabled={purchaseProcessing}
            onZoom={()=>onZoomIcon(HERO_PROOF_ITEM)}
            onBuy={()=>openSheet({ item:shardExchange, confirm:()=>onExchangeHeroProof() })}
            middle={ownedMiddle(proofHave, HERO_PROOF_ITEM)}
          />;})()}
        </div>
      </div>}

      {marketSection==='event'&&<><div className={SCREEN_LIST_CLASS}>
        <div data-event-point-shop className={MARKET_GRID_CLASS}>
          {RHYTHM_EVENT_POINT_SHOP_OFFERS.map(offer=>{
            const item=beatPointItemOf(offer);
            const grantText=`${offer.grantAmount.toLocaleString()}${offer.unit}`;
            // ダイヤの品は受け取る数が名前(ダイヤ ×300)に入っていて、持ち数は所持ダイヤと同じなので中段は空ける
            const middle=offer.kind==='diamond'
              ? null
              : ownedMiddle(ownedItemCount(ownedItems, offer.itemId), item.base?{...item.base,cost:offer.cost,currency:'beatPoint'}:null, {grantText});
            return <MarketProductCard key={offer.id} dataAttrs={{'data-event-point-offer':offer.id}}
              item={item} owned={false} comingSoon={false}
              canBuy={safeEventPoints>=offer.cost&&!busy}
              disabled={purchaseProcessing}
              onZoom={()=>onZoomIcon(item)}
              onBuy={()=>openSheet({ item, stackable:true, countUnit:'回', grantAmount:offer.grantAmount, grantUnit:offer.unit,
                confirm:(count)=>onExchangeEventPoints?onExchangeEventPoints(offer,count):false })}
              middle={middle}
            />;
          })}
          {/* 近日公開予定の円盤石(2026-09-28)。予告だけで、交換ボタンは出さない。
              ダイヤショップより先にここで公開する(ユーザー指示「新モンスター先行実装はビートポイントから」)ので「先行公開予定」と出す。
              絵はマーケットの円盤石(monsterId と同じid)から引き、ダイヤショップと同じ見え方にする */}
          {RHYTHM_EVENT_POINT_SHOP_COMING_SOON.map(offer=>{
            const disc=BREEDER_MARKET_ITEMS.find(item=>item.id===offer.monsterId&&item.type==='disc');
            const item={ id:offer.id, name:offer.name, emoji:'💿', icon:disc?.icon, type:'disc', currency:'beatPoint', cost:offer.cost };
            return <MarketProductCard key={offer.id} dataAttrs={{'data-event-point-coming-soon':offer.id}}
              item={item} comingSoon comingSoonLabel="先行公開予定"
              onZoom={()=>onZoomIcon(item)}
            />;
          })}
        </div>
      </div></>}

      {sheet&&<MarketPurchaseSheet
        item={sheet.item}
        balance={balanceOf(marketCurrencyOf(sheet.item))}
        stackable={!!sheet.stackable}
        countUnit={sheet.countUnit||'個'}
        grantAmount={sheet.grantAmount||0}
        grantUnit={sheet.grantUnit||''}
        quantity={sheetQuantity}
        onQuantity={setSheetQuantity}
        pending={sheetPending||purchaseProcessing}
        error={marketExchangeError}
        onConfirm={confirmSheet}
        onCancel={closeSheet}
      />}
    </div>
  );
}
