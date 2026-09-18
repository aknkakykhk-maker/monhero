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
  // 「使う場所」の案内は8分岐あり、右列の幅が文字数ぶんバラバラだった。
  // 幅をそろえると、真ん中(名前・説明)の折り返しも行ごとに動かなくなる。
  // 「使う」ボタン(w-[84px])と同じ幅にして、右端を1本の線にそろえる。
  const usageNoteClass = 'shrink-0 w-[84px] text-center text-[10px] font-black leading-tight text-slate-400';
  return (
      <div data-mh-screen className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="アイテム" icon={<Package size={20}/>} accent="text-teal-300" onBack={onBack}/>
        <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble scene="inventory" compact/></div>
        <ScreenLead>所持しているアイテムです。使う場所が決まっているアイテムは右側に表示します。</ScreenLead>
        <div className={SCREEN_LIST_CLASS}>
          {inventoryItems.length===0?(
            <ScreenEmpty emoji="🎒" lines={['まだアイテムを持っていません。','マーケットの「アイテム」タブから購入できます。']}/>
          ):(
            <div className="flex flex-col gap-2 pb-4">
              {inventoryItems.map(item=>(
                <div key={item.id} className="rounded-2xl border border-teal-500/30 bg-slate-900 p-3 flex items-center gap-3 min-h-[76px]">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/10 shrink-0 flex items-center justify-center bg-black/30">{item.icon?<img src={item.icon} alt={item.name} className="w-full h-full object-cover"/>:<span className="text-2xl">{item.emoji}</span>}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0 text-[13px] font-black text-white truncate">{item.name}</div>
                      <span className="shrink-0 rounded-full bg-slate-950/60 px-2.5 py-0.5 text-[11px] font-black tabular-nums text-teal-300">所持数: {ownedItems[item.id]}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-relaxed mt-1">{item.desc}</div>
                  </div>
                  {/* スキップチケットや超越の実はマスモン詳細の別の場所で使うものなので、使う場所だけ案内する */}
                  {item.usage==='battleSkip'
                    ? <div className={usageNoteClass}>バトルの<br/>{DIFFICULTY_SETTINGS[item.skipDifficulty]?.label}<br/>スキップで使用</div>
                    : item.usage==='breakthrough'
                    ? <div className={usageNoteClass}>神殿の<br/>限界突破で<br/>使用</div>
                    : item.usage==='uniqueSkillReset'
                    ? <div className={usageNoteClass}>マスモン詳細の<br/>固有技強化で<br/>使用</div>
                    : item.usage==='transcendReset'
                    ? <div className={usageNoteClass}>マスモン詳細の<br/>超越強化で<br/>使用</div>
                    : item.usage==='transcendFruit'
                    ? <div className={usageNoteClass}>マスモン詳細の<br/>超越強化で<br/>使用</div>
                    : item.usage==='soulRank'
                    ? <div className={usageNoteClass}>神殿の<br/>魂格進化で<br/>使用</div>
                    : item.usage==='heroProofShard'
                    ? <div className={usageNoteClass}>マーケットで<br/>{HERO_PROOF_SHARD_PER_PROOF}個→<br/>勇者の証1個</div>
                    : item.usage==='soulRankRespec'
                    ? <div className={usageNoteClass}>マスモン詳細の<br/>魂格特性で<br/>使用</div>
                    : <button onClick={()=>onUseItem(item.id)} className="shrink-0 w-[84px] min-h-[44px] rounded-xl bg-teal-600 text-[12px] font-black text-white active:scale-95">使う</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>  );
}
