// ==== 画面: アイテム(gameState === 'ITEM_INVENTORY') ====
//
// MonsterHeroGame から切り出した4画面目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-5)。
// 型は 51〜53 と同じ。
//
// 【この画面ならではの注意】
// ・戻り先はホームではなくプロフィール。画面は行き先を知らなくてよいので props(onBack)で受ける
// ・「使う」を押したときの対象えらび(pendingItemUse)は MonsterHeroGame 側の別画面なので、
//   ここは「どのアイテムを使うか」を渡すだけ
// ・一覧に出す品(BREEDER_MARKET_ITEMS / HERO_PROOF_ITEM / speciesTranscendFruitItems)と
//   難易度の表示(DIFFICULTY_SETTINGS)は共有層の持ち物なので props にしない
// ・この画面にタイマーは無い(docs/refactor/SCREEN_EFFECTS_MAP.md に ITEM_INVENTORY の行が無い)
function ItemInventoryScreen({ ownedItems, onBack, onUseItem }) {
  // 超越の実(虹・種族別)はマーケットで売る商品ではなく種族チャレンジの初回クリア報酬でしか
  // 増えないため、種族別ぶんはBREEDER_MARKET_ITEMSに登録していない(虹だけは購入もできるので
  // 登録済み)。ここでだけ両方を合わせて、持っているものを一覧に出す
  const inventoryItems = [
    ...BREEDER_MARKET_ITEMS.filter(item=>item.type==='item'&&(ownedItems[item.id]||0)>0),
    ...((ownedItems[HERO_PROOF_ITEM_ID]||0)>0?[HERO_PROOF_ITEM]:[]),
    // 勇者の証片も売り物ではないので BREEDER_MARKET_ITEMS に無い。ここで並べる
    // (2026-09-13・ユーザー指示「勇者の証片はアイテム欄に並ぶようにしてね」)
    ...((ownedItems[HERO_PROOF_SHARD_ITEM_ID]||0)>0?[HERO_PROOF_SHARD_ITEM]:[]),
    ...Object.values(speciesTranscendFruitItems()).filter(item=>(ownedItems[item.id]||0)>0),
  ];
  return (
      <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4">
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <button onClick={onBack} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
          <h2 className="text-xl font-black italic text-teal-400 uppercase tracking-widest">アイテム</h2>
        </div>
        <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="inventory" compact/></div>
        <div className="text-[10px] text-slate-400 font-bold mb-2 px-1 shrink-0">所持しているアイテムです。使う場所が決まっているアイテムは右側に表示します。</div>
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
          {inventoryItems.length===0?(
            <div className="empty-state" style={{padding:'32px 16px', textAlign:'center'}}><span className="big" style={{fontSize:'40px'}}>🎒</span><div className="text-[11px] text-slate-400 mt-2">まだアイテムを持っていません。<br/>マーケットの「アイテム」タブから購入できます。</div></div>
          ):(
            <div className="flex flex-col gap-2 pb-4">
              {inventoryItems.map(item=>(
                <div key={item.id} className="rounded-2xl border-2 border-teal-900/50 bg-slate-900 p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 shrink-0 flex items-center justify-center bg-black/30">{item.icon?<img src={item.icon} alt={item.name} className="w-full h-full object-cover"/>:<span className="text-2xl">{item.emoji}</span>}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-black text-white truncate">{item.name}</div>
                    <div className="text-[8px] text-slate-400 leading-tight mt-0.5">{item.desc}</div>
                    <div className="text-[9px] font-black text-teal-300 mt-0.5">所持数: {ownedItems[item.id]}</div>
                  </div>
                  {/* スキップチケットや超越の実はマスモン詳細の別の場所で使うものなので、使う場所だけ案内する */}
                  {item.usage==='battleSkip'
                    ? <div className="shrink-0 text-[9px] font-black text-teal-300 text-center leading-tight px-2">バトルの<br/>{DIFFICULTY_SETTINGS[item.skipDifficulty]?.label}<br/>スキップで使用</div>
                    : item.usage==='breakthrough'
                    ? <div className="shrink-0 text-[9px] font-black text-fuchsia-300 text-center leading-tight px-2">神殿の<br/>限界突破で<br/>使用</div>
                    : item.usage==='uniqueSkillReset'
                    ? <div className="shrink-0 text-[9px] font-black text-cyan-300 text-center leading-tight px-2">マスモン詳細の<br/>固有技強化で<br/>使用</div>
                    : item.usage==='transcendReset'
                    ? <div className="shrink-0 text-[9px] font-black text-amber-300 text-center leading-tight px-2">マスモン詳細の<br/>超越強化で<br/>使用</div>
                    : item.usage==='transcendFruit'
                    ? <div className="shrink-0 text-[9px] font-black text-sky-300 text-center leading-tight px-2">マスモン詳細の<br/>超越強化で<br/>使用</div>
                    : item.usage==='soulRank'
                    ? <div className="shrink-0 text-[9px] font-black text-amber-200 text-center leading-tight px-2">神殿の<br/>魂格進化で<br/>使用</div>
                    : item.usage==='heroProofShard'
                    ? <div className="shrink-0 text-[9px] font-black text-amber-100 text-center leading-tight px-2">マーケットで<br/>{HERO_PROOF_SHARD_PER_PROOF}個→<br/>勇者の証1個</div>
                    : item.usage==='soulRankRespec'
                    ? <div className="shrink-0 text-[9px] font-black text-cyan-300 text-center leading-tight px-2">マスモン詳細の<br/>魂格特性で<br/>使用</div>
                    : <button onClick={()=>onUseItem(item.id)} className="shrink-0 bg-teal-600 text-white text-[10px] font-black px-4 py-2 rounded-xl active:scale-95 uppercase">使う</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>  );
}
