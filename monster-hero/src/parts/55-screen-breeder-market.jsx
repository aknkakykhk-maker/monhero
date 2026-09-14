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
  onExchangeHeroProof,
}) {
  // 2026-09-14・マーケットのタブ乱立を避けるため、最初に用途別の入口を選ぶ。
  // 入口だけこの画面のローカル状態で持ち、購入・交換・商品タブの既存stateは親側をそのまま使う。
  const [marketSection,setMarketSection]=useState(null);
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
    event:{label:'イベントP交換所',emoji:'🎟️'},
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
          middle={item.type==='item'?<><span className={`text-[9px] font-black ${(ownedItems[item.id]||0)>0?'text-cyan-300':'text-slate-600'}`}>×{ownedItems[item.id]||0}</span>{item.desc&&<button onClick={()=>onOpenItemDetail(item)} aria-label={`${item.name}の効果を見る`} className="text-[8px] font-black text-indigo-300 bg-indigo-950/50 border border-indigo-500/40 px-1 py-0.5 rounded-full active:scale-95 flex items-center gap-0.5 whitespace-nowrap"><BookOpen size={8}/>詳細</button>}</>:null}
        />}
        {showHeroProofExchange&&exchangeItem&&<MarketProductCard
          item={exchangeItem} owned={false} comingSoon={false}
          canBuy={proofHave>0&&!purchaseProcessing}
          disabled={purchaseProcessing}
          onBuy={onExchangeSoulRankRespec}
          middle={<><span className={`text-[9px] font-black ${ownedItemCount(ownedItems,SOUL_RANK_RESPEC_ITEM_ID)>0?'text-cyan-300':'text-slate-600'}`}>×{ownedItemCount(ownedItems,SOUL_RANK_RESPEC_ITEM_ID)}</span>{item.desc&&<button onClick={()=>onOpenItemDetail(item)} aria-label={`${item.name}の効果を見る`} className="text-[8px] font-black text-indigo-300 bg-indigo-950/50 border border-indigo-500/40 px-1 py-0.5 rounded-full active:scale-95 flex items-center gap-0.5 whitespace-nowrap"><BookOpen size={8}/>詳細</button>}</>}
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
    <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <button onClick={handleBack} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
        <h2 className="text-xl font-black italic text-amber-400 uppercase tracking-widest">{headerTitle}</h2>
      </div>
      <div className="shrink-0 w-full max-w-md mx-auto mb-3"><AssistantBubble scene="market" condition={Number.isFinite(CHEAPEST_GOLD_ITEM_COST)&&gold<CHEAPEST_GOLD_ITEM_COST?'lowGold':null}/></div>

      {!marketSection&&<div data-market-top className="relative flex-1 min-h-0 overflow-y-auto mh-scroll">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-5 h-60 rounded-[40px] bg-gradient-to-br from-cyan-500/10 via-amber-500/5 to-violet-500/10 blur-2xl"/>
        <div className="relative grid grid-cols-2 gap-2 pt-8 pb-2">
          {[
            {key:'diamond',emoji:'💎',label:'ダイヤショップ',value:gold.toLocaleString(),hint:'ダイヤで購入',border:'border-cyan-400/35',title:'text-cyan-200',arrow:'text-cyan-300/80'},
            {key:'breeder',emoji:'🪙',label:'ブリーダーP交換所',value:breederPoints.toLocaleString(),hint:'Lv.UPで獲得',border:'border-amber-400/35',title:'text-amber-200',arrow:'text-amber-300/80'},
            {key:'exchange',emoji:'🔄',label:'アイテム交換所',value:null,hint:'プシュケー・証など',border:'border-emerald-400/35',title:'text-emerald-200',arrow:'text-emerald-300/80'},
            {key:'event',emoji:'🎟️',label:'イベントP交換所',value:null,hint:'準備中',border:'border-violet-400/20',title:'text-violet-300/70',arrow:'text-violet-400/40'},
          ].map(section=>(
            <button
              key={section.key}
              data-market-section={section.key}
              onClick={()=>setMarketSection(section.key)}
              className={`relative min-h-[108px] rounded-2xl border ${section.border} bg-slate-950/70 px-4 py-4 pr-9 text-left active:scale-[0.98]`}
            >
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="text-2xl">{section.emoji}</span>
                <span className={`text-[12px] font-black leading-tight ${section.title}`}>{section.label}</span>
              </div>
              {section.value!==null&&<div className="mt-2.5 font-mono text-xl font-black text-white">{section.value}</div>}
              <div className={`text-[10px] font-bold ${section.value===null?'mt-3.5':'mt-0.5'} ${section.key==='event'?'text-slate-500':'text-slate-400'}`}>{section.hint}</div>
              <span aria-hidden="true" className={`absolute bottom-3 right-3 text-xl font-black ${section.arrow}`}>›</span>
            </button>
          ))}
        </div>
      </div>}

      {marketSection==='diamond'&&<>
        <div className="mb-2 shrink-0 flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/25 bg-cyan-950/25 py-2">
          <Gem size={15} className="text-cyan-300"/>
          <span className="font-mono text-base font-black text-cyan-100">{gold.toLocaleString()}</span>
          <span className="text-[9px] font-bold text-slate-400">所持ダイヤ</span>
        </div>
        <div className="flex gap-1.5 mb-3 shrink-0">
          {diamondTabs.map(tab=>(
            <button key={tab.key} onClick={()=>onSelectTab(tab.key)} className={`flex-1 py-2 rounded-xl text-[10px] font-black ${activeDiamondTab===tab.key?'bg-amber-500 text-black':'bg-slate-900 border border-slate-800 text-slate-400'}`}>{tab.label}</button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
          {diamondItems.length===0?<div className="text-center text-[11px] text-slate-600 font-bold py-10">まだ商品がありません</div>:<div className={MARKET_GRID_CLASS}>{diamondItems.map(item=>renderMarketItem(item))}</div>}
        </div>
      </>}

      {marketSection==='breeder'&&<>
        <div className="mb-3 shrink-0 flex items-center justify-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-950/25 py-2">
          <Coins size={15} className="text-amber-300"/>
          <span className="font-mono text-base font-black text-amber-100">{breederPoints.toLocaleString()}</span>
          <span className="text-[9px] font-bold text-slate-400">所持ブリーダーP</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
          {breederPointItems.length===0?<div className="text-center text-[11px] text-slate-600 font-bold py-10">まだ商品がありません</div>:<div className={MARKET_GRID_CLASS}>{breederPointItems.map(item=>renderMarketItem(item))}</div>}
        </div>
      </>}

      {marketSection==='exchange'&&<>
        <div data-market-balances className="grid grid-cols-3 gap-2 mb-3 shrink-0">
          {[
            { key:'psyche', emoji:'🌈', label:'虹のプシュケー', value:psycheHave, tone:'text-fuchsia-200 border-fuchsia-500/30 bg-fuchsia-950/30' },
            { key:'shard',  emoji:'🎖️', label:'勇者の証片',     value:shardHave,  tone:'text-amber-100 border-amber-400/30 bg-amber-950/30' },
            { key:'proof',  emoji:'🏅', label:'勇者の証',       value:proofHave,  tone:'text-amber-200 border-amber-400/30 bg-amber-950/30' },
          ].map(row=>(
            <div key={row.key} data-market-balance={row.key} className={`flex flex-col items-center justify-center rounded-2xl border py-1.5 ${row.tone}`}>
              <div className="flex items-baseline gap-1">
                <span aria-hidden="true" className="text-[11px]">{row.emoji}</span>
                <span className="font-mono text-sm font-black">{row.value.toLocaleString()}</span>
              </div>
              <span className="text-[8px] font-bold leading-tight text-slate-400">{row.label}</span>
            </div>
          ))}
        </div>
        {marketExchangeError&&<div className="mb-2 shrink-0 rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-center text-[9px] font-black text-red-300">{marketExchangeError}</div>}
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
          <div className={MARKET_GRID_CLASS}>
            {itemExchangeItems.map(item=>renderMarketItem(item))}
            {soulRankRespecItem&&renderMarketItem(soulRankRespecItem,{showBase:false,showHeroProofExchange:true})}
            <MarketProductCard
              item={{...HERO_PROOF_ITEM, type:'item', currency:'heroProofShard', cost:HERO_PROOF_SHARD_PER_PROOF}}
              owned={false} comingSoon={false}
              canBuy={shardHave>=HERO_PROOF_SHARD_PER_PROOF&&!purchaseProcessing}
              disabled={purchaseProcessing}
              onBuy={onExchangeHeroProof}
              middle={<><span className={`text-[9px] font-black ${proofHave>0?'text-cyan-300':'text-slate-600'}`}>×{proofHave}</span><button onClick={()=>onOpenItemDetail(HERO_PROOF_ITEM)} aria-label="勇者の証の効果を見る" className="text-[8px] font-black text-indigo-300 bg-indigo-950/50 border border-indigo-500/40 px-1 py-0.5 rounded-full active:scale-95 flex items-center gap-0.5 whitespace-nowrap"><BookOpen size={8}/>詳細</button></>}
            />
          </div>
        </div>
      </>}

      {marketSection==='event'&&<div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-8 text-center">
          <div className="text-3xl mb-2" aria-hidden="true">🎟️</div>
          <div className="text-sm font-black text-slate-300">イベントP交換所は準備中です</div>
          <div className="mt-2 text-[10px] font-bold leading-relaxed text-slate-500">イベントP機能と商品ラインナップは今後追加します。</div>
        </div>
      </div>}
    </div>
  );
}
