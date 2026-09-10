// ==== 画面: ギフトボックス(gameState === 'GIFT_BOX') ====
//
// MonsterHeroGame から切り出した3画面目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-4)。
// 型は 51-screen-settings.jsx / 52-screen-missions.jsx と同じ。
//
// 【この画面ならではの注意】
// ・受け取り(claimGiftIds)は保存を伴うので中身は MonsterHeroGame 側に残し、props で受け取る。
//   画面は「どのギフトを受け取るか」を id の配列で渡すだけ
// ・受け取れるか・期限切れか・報酬の読み方(giftIsClaimable / giftIsExpired /
//   normalizeGiftRewards / giftTitleDisplay / giftRewardText)は共有層(17)の純関数なので
//   props にせず画面から直接呼ぶ。保存には触れない
// ・ログインボーナス一覧の中身は MonsterHeroGame 側に残っている(この画面はボタンだけ)
// ・この画面にタイマーは無い(docs/refactor/SCREEN_EFFECTS_MAP.md に GIFT_BOX の行が無い)
function GiftBoxScreen({ gifts, giftTab, onSelectTab, onBack, onClaim, onOpenLoginBonusList }) {
  const now = Date.now();
  const unclaimed = gifts.filter(g=>!g?.claimedAt);
  const history = gifts.filter(g=>g?.claimedAt);
  const shown = giftTab==='unclaimed'?unclaimed:history;
  const claimable=unclaimed.filter(g=>giftIsClaimable(g,now));
  return (
    <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-3" style={{paddingTop:'calc(.75rem + env(safe-area-inset-top))',paddingBottom:'calc(.75rem + env(safe-area-inset-bottom))'}}>
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0"><button onClick={onBack} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black text-cyan-200 flex items-center gap-2"><Package size={22}/>ギフトボックス</h2><div className="w-11"></div></div>
      <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble key={claimable.length>0?'claim':'empty'} scene={claimable.length>0?'giftClaimable':'giftEmpty'} compact/></div>
      <div className="grid grid-cols-2 gap-2 mb-2 shrink-0"><button onClick={()=>onSelectTab('unclaimed')} className={`relative min-h-[44px] rounded-xl font-black text-sm ${giftTab==='unclaimed'?'bg-cyan-600 text-white':'bg-slate-900 text-slate-400'}`}>未受取 ({unclaimed.filter(g=>!giftIsExpired(g,now)).length}){tabCountBadge(claimable.length)}</button><button onClick={()=>onSelectTab('history')} className={`min-h-[44px] rounded-xl font-black text-sm ${giftTab==='history'?'bg-indigo-600 text-white':'bg-slate-900 text-slate-400'}`}>受取済み ({history.length})</button></div>
      {giftTab==='unclaimed'&&<button disabled={!claimable.length} onClick={()=>onClaim(claimable.map(g=>g.id))} className="shrink-0 mb-2 min-h-[44px] rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-black disabled:opacity-40">すべて受け取る</button>}
      <button onClick={onOpenLoginBonusList} className="shrink-0 mb-2 min-h-[40px] rounded-xl bg-slate-800 border border-amber-400/40 text-amber-200 font-black text-[12px] active:scale-[.98]">ログインボーナス一覧を見る</button>
      <div className="mh-gift-list flex-1 min-h-0 overflow-y-auto mh-scroll pb-1">{shown.length===0?<div className="mt-16 text-center text-slate-500 font-bold">{giftTab==='unclaimed'?'未受取のギフトはありません':'受取済みのギフトはありません'}</div>:shown.map(g=>{const expired=giftIsExpired(g,now);const valid=!!normalizeGiftRewards(g);const display=giftTitleDisplay(g);return <article key={g.id} title={g.description||g.title||undefined} className={`mh-gift-card rounded-xl border ${g.claimedAt?'bg-slate-900/70 border-slate-700':expired?'bg-red-950/30 border-red-800/60':'bg-cyan-950/30 border-cyan-500/50'}`}>
        <div className="mh-gift-heading"><h3>{display.label&&<span>{display.label}</span>}<b>{display.title}</b></h3><em className={`${g.claimedAt?'bg-slate-700 text-slate-300':expired?'bg-red-900 text-red-200':valid?'bg-cyan-700 text-white':'bg-amber-900 text-amber-200'}`}>{g.claimedAt?'受取済み':expired?'期限切れ':valid?'受取可':'要確認'}</em></div>
        <div className="mh-gift-main"><div className="mh-gift-rewards">{Array.isArray(g.rewards)&&g.rewards.map((r,i)=><span key={i}>{giftRewardText(r)}</span>)}</div>{!g.claimedAt&&<button disabled={expired||!valid} onClick={()=>onClaim([g.id])}>受け取る</button>}</div>
        <div className="mh-gift-deadline">{g.claimedAt?`受取日時: ${new Date(g.claimedAt).toLocaleString('ja-JP')}`:`受取期限: ${g.expiresAt?new Date(g.expiresAt).toLocaleString('ja-JP'):'期限なし'}`}</div>
      </article>})}</div>
    </div>
  );
}
