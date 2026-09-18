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
      <div data-mh-screen className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="マスモン一覧" accent="text-pink-400" onBack={onBack} backLabel="M/B管理へ戻る"/>
        <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="masuList"/></div>
        <ScreenLead>勇者モンをラン終了時に登録すると、ここに並びます。編成画面で選ぶと次の周回で使えます(同じ種は1体まで)。</ScreenLead>
        {renderMonsterSortFilterBar({ singleType: true })}
        <div className={SCREEN_LIST_CLASS}>
          {(()=>{
            const entries = unifiedMonsterEntriesSingleType.filter(e=>e.type==='masu');
            if (entries.length===0) return (
              <ScreenEmpty emoji="🐾" lines={masuMons.length===0?['まだマスモンがいません。','勇者モンでランを終えると登録できます。']:['表示設定で対象がすべてオフになっています。']}/>
            );
            return (
              <div className="grid grid-cols-3 gap-2.5 pb-4">
                {entries.map(e=>{
                  const masu = e.masu, base = e.base;
                  return (
                    <button key={e.key} onClick={()=>onOpenDetail(masu)} style={MONSTER_CARD_STYLE} className={`${MONSTER_CARD_CLASS} border-white/10 bg-slate-900`}>
                      {renderMonsterCardBody({
                        masu, base, nameBand:true,
                        status: monsterDisplayFlags.active&&e.active?<span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-pink-500 text-white">編成中</span>:null,
                      })}
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
  );
}
