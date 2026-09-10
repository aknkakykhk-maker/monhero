// ==== 画面: マスモン一覧(gameState === 'MASU_MONS') ====
//
// MonsterHeroGame から切り出した10画面目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-9)。
// MASU_* 13画面のうち、いちばん依存が少ないものから始めた。
//
// 【この画面ならではの注意】
// ・一覧を出すだけで、保存には一切触らない。詳細を開くのも本体の setMasuMonDetail(モーダル)なので
//   props で受け取る
// ・並べ替えや絞り込みの状態は持たない(それらは詳細モーダル側の話)
// ・この画面にタイマーは無い
function MasuMonsScreen({
  masuMons, monsterDisplayFlags, unifiedMonsterEntriesSingleType,
  MONSTER_CARD_CLASS, MONSTER_CARD_STYLE, renderMonsterCardBody, renderMonsterSortFilterBar,
  onBack, onOpenDetail,
}) {
  return (
      <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-4">
        <div className="flex items-center gap-2 mb-2 shrink-0">
          <button onClick={onBack} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button>
          <h2 className="text-xl font-black italic text-pink-400 uppercase tracking-widest">マスモン一覧</h2>
        </div>
        <div className="shrink-0 w-full max-w-md mx-auto mb-3"><AssistantBubble scene="masuList"/></div>
        <div className="text-[10px] text-slate-400 font-bold mb-1 px-1 shrink-0">勇者モンをラン終了時に登録すると、ここに並びます。編成画面で選ぶと次の周回で使えます(同じ種は1体まで)。</div>
        {renderMonsterSortFilterBar({ singleType: true })}
        <div className="flex-1 min-h-0 overflow-y-auto mh-scroll">
          {(()=>{
            const entries = unifiedMonsterEntriesSingleType.filter(e=>e.type==='masu');
            if (entries.length===0) return (
              <div className="empty-state" style={{padding:'32px 16px', textAlign:'center'}}><span className="big" style={{fontSize:'40px'}}>🐾</span><div className="text-[11px] text-slate-400 mt-2">{masuMons.length===0?<>まだマスモンがいません。<br/>勇者モンでランを終えると登録できます。</>:'表示設定で対象がすべてオフになっています。'}</div></div>
            );
            return (
              <div className="grid grid-cols-3 gap-2.5 pb-4">
                {entries.map(e=>{
                  const masu = e.masu, base = e.base;
                  return (
                    <div key={e.key} className="relative">
                      <button onClick={()=>onOpenDetail(masu)} style={MONSTER_CARD_STYLE} className={`${MONSTER_CARD_CLASS} border-pink-900/50 bg-slate-900`}>
                        {renderMonsterCardBody({
                          masu, base, nameBand:true,
                          status: monsterDisplayFlags.active&&e.active?<span className="text-[7px] font-black px-1.5 py-0.5 rounded-full bg-pink-500 text-white">編成中</span>:null,
                        })}
                      </button>
                      <button onClick={(ev)=>{ev.stopPropagation(); onOpenDetail(masu);}} className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/70 border border-white/20 flex items-center justify-center active:scale-90"><Info size={12} className="text-white"/></button>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
  );
}
