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
  // 上に出す所持数(2026-09-13・ユーザー指示「マーケットにプシュケーとか証片も
  // いくつあるかダイヤみたいに表示がほしい」)。ダイヤ・ptと同じ帯へ並べる
  const psycheHave = ownedItemCount(ownedItems, BREAKTHROUGH_ITEM_ID);
  const shardHave = ownedItemCount(ownedItems, HERO_PROOF_SHARD_ITEM_ID);
  const proofHave = ownedItemCount(ownedItems, HERO_PROOF_ITEM_ID);
  return (
      <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4">
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <button onClick={onBack} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
          <h2 className="text-xl font-black italic text-amber-400 uppercase tracking-widest">マーケット</h2>
        </div>
        <div className="shrink-0 w-full max-w-md mx-auto mb-3"><AssistantBubble scene="market" condition={Number.isFinite(CHEAPEST_GOLD_ITEM_COST)&&gold<CHEAPEST_GOLD_ITEM_COST?'lowGold':null}/></div>
        <div className="flex gap-2 mb-2 shrink-0">
          <div className="flex-1 flex items-center justify-center gap-2 bg-amber-950/40 border border-amber-500/30 rounded-2xl py-3">
            <Coins size={16} className="text-amber-400"/>
            <span className="text-lg font-black text-amber-300">{breederPoints}</span>
            <span className="text-[9px] text-slate-400 font-bold">pt(Lv.UPで+1)</span>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2 bg-amber-950/40 border border-amber-500/30 rounded-2xl py-3">
            <Gem size={16} className="text-amber-400"/>
            <span className="text-lg font-black text-amber-300">{gold.toLocaleString()}</span>
            <span className="text-[9px] text-slate-400 font-bold">ダイヤ(WAVEクリアで獲得)</span>
          </div>
        </div>
        {/* ダイヤ以外の「持ち高」も同じように見せる。買う前に足りるかどうかが分かるようにするため
            (2026-09-13・ユーザー指示)。0個でも出す(存在そのものを知らせたいので隠さない) */}
        <div data-market-balances className="grid grid-cols-3 gap-2 mb-4 shrink-0">
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
        <div className="flex gap-1.5 mb-3 shrink-0">
          {[{key:'icon',label:'アイコン'},{key:'disc',label:'円盤石'},{key:'assist',label:'アシスト'},{key:'item',label:'アイテム'}].map(tab=>(
            <button key={tab.key} onClick={()=>onSelectTab(tab.key)} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase ${marketTab===tab.key?'bg-amber-500 text-black':'bg-slate-900 border border-slate-800 text-slate-400'}`}>{tab.label}</button>
          ))}
        </div>
        {marketTab==='item'&&marketExchangeError&&<div className="mb-2 shrink-0 rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-center text-[9px] font-black text-red-300">{marketExchangeError}</div>}
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
        {/* shop:false のアイテム(虹のプシュケー)は売り物ではないので陳列しない */}
        {BREEDER_MARKET_ITEMS.filter(item=>item.type===marketTab&&item.shop!==false).length===0?(
          <div className="text-center text-[11px] text-slate-600 font-bold py-10">まだ商品がありません</div>
        ):(
          <div className={MARKET_GRID_CLASS}>
            {BREEDER_MARKET_ITEMS.filter(item=>item.type===marketTab&&item.shop!==false).map(item=>{
              const comingSoon = item.available === false;
              const owned = !comingSoon && isItemOwned(item);
              const balance = item.currency==='psyche' ? ownedItemCount(ownedItems, BREAKTHROUGH_ITEM_ID) : item.type==='disc' || item.type==='assist' || item.type==='item' ? gold : breederPoints;
              const canBuy = !comingSoon && !owned && balance>=item.cost;
              const detailMon = item.type==='disc' ? ALL_PLAYER_MONSTERS[item.id] : null;
              const detailTeaching = item.type==='assist' ? TEACHING_CARDS.find(t=>t.id===item.id) : null;
              const isSoulRankRespec=item.id===SOUL_RANK_RESPEC_ITEM_ID;
              const exchangeItem=isSoulRankRespec?{...item,currency:'heroProof',cost:1}:null;
              return (
                <React.Fragment key={item.id}>
                  <MarketProductCard
                    item={item} owned={owned} comingSoon={comingSoon} canBuy={canBuy}
                    onZoom={()=>onZoomIcon(item)} onBuy={()=>onBuy(item)}
                    detail={detailMon||detailTeaching}
                    onDetail={()=>onOpenDetail(item,detailMon,detailTeaching)}
                    middle={item.type==='item'?<><span className={`text-[9px] font-black ${(ownedItems[item.id]||0)>0?'text-cyan-300':'text-slate-600'}`}>×{ownedItems[item.id]||0}</span>{item.desc&&<button onClick={()=>onOpenItemDetail(item)} aria-label={`${item.name}の効果を見る`} className="text-[8px] font-black text-indigo-300 bg-indigo-950/50 border border-indigo-500/40 px-1 py-0.5 rounded-full active:scale-95 flex items-center gap-0.5 whitespace-nowrap"><BookOpen size={8}/>詳細</button>}</>:null}
                  />
                  {exchangeItem&&<MarketProductCard
                    item={exchangeItem} owned={false} comingSoon={false}
                    canBuy={ownedItemCount(ownedItems,HERO_PROOF_ITEM_ID)>0&&!purchaseProcessing}
                    disabled={purchaseProcessing}
                    onBuy={onExchangeSoulRankRespec}
                    middle={<><span className={`text-[9px] font-black ${ownedItemCount(ownedItems,SOUL_RANK_RESPEC_ITEM_ID)>0?'text-cyan-300':'text-slate-600'}`}>×{ownedItemCount(ownedItems,SOUL_RANK_RESPEC_ITEM_ID)}</span>{item.desc&&<button onClick={()=>onOpenItemDetail(item)} aria-label={`${item.name}の効果を見る`} className="text-[8px] font-black text-indigo-300 bg-indigo-950/50 border border-indigo-500/40 px-1 py-0.5 rounded-full active:scale-95 flex items-center gap-0.5 whitespace-nowrap"><BookOpen size={8}/>詳細</button>}</>}
                  />}
                </React.Fragment>
              );
            })}
            {/* 勇者の証は売り物ではないので BREEDER_MARKET_ITEMS に無い。
                アイテムのタブの最後へ「証片◯個で交換」の1枚だけ足す
                (2026-09-13・ユーザーが決めた。モンヒロビートの週間ランキングで証片がたまる) */}
            {marketTab==='item'&&<MarketProductCard
              item={{...HERO_PROOF_ITEM, type:'item', currency:'heroProofShard', cost:HERO_PROOF_SHARD_PER_PROOF}}
              owned={false} comingSoon={false}
              canBuy={shardHave>=HERO_PROOF_SHARD_PER_PROOF&&!purchaseProcessing}
              disabled={purchaseProcessing}
              onBuy={onExchangeHeroProof}
              middle={<><span className={`text-[9px] font-black ${proofHave>0?'text-cyan-300':'text-slate-600'}`}>×{proofHave}</span><button onClick={()=>onOpenItemDetail(HERO_PROOF_ITEM)} aria-label="勇者の証の効果を見る" className="text-[8px] font-black text-indigo-300 bg-indigo-950/50 border border-indigo-500/40 px-1 py-0.5 rounded-full active:scale-95 flex items-center gap-0.5 whitespace-nowrap"><BookOpen size={8}/>詳細</button></>}
            />}
          </div>
        )}
        </div>
      </div>  );
}
