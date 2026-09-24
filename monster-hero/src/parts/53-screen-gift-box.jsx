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
//
// 【2026-09-18・見た目をそろえたときの決めごと】
// ・根の style で safe-area を足していたが、index.html:134 の body が既に持っているので
//   二重取りだった。根は SCREEN_SHELL_CLASS だけにする
// ・見出しは ScreenHead、タブは ScreenTabs、0件は ScreenEmpty(41-screen-ui.jsx)
// ・カードの中身の寸法(高さ・字の大きさ・受け取るボタン)は .mh-gift-* のCSS側にある
function GiftBoxScreen({ gifts, giftTab, onSelectTab, onBack, onClaim, onOpenLoginBonusList }) {
  const now = Date.now();
  const unclaimed = gifts.filter(g=>!g?.claimedAt);
  const history = gifts.filter(g=>g?.claimedAt);
  const shown = giftTab==='unclaimed'?unclaimed:history;
  const claimable=unclaimed.filter(g=>giftIsClaimable(g,now));
  return (
    <div data-mh-screen className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="ギフトボックス" icon={<Package size={20}/>} accent="text-cyan-400" onBack={onBack} backLabel="戻る"/>
      <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble key={claimable.length>0?'claim':'empty'} scene={claimable.length>0?'giftClaimable':'giftEmpty'} compact/></div>
      <ScreenTabs value={giftTab} onChange={onSelectTab} items={[
        {id:'unclaimed',color:'#0891b2',label:<>未受取 ({unclaimed.filter(g=>!giftIsExpired(g,now)).length}){tabCountBadge(claimable.length)}</>},
        {id:'history',color:'#4f46e5',label:`受取済み (${history.length})`},
      ]}/>
      {giftTab==='unclaimed'&&<button type="button" disabled={!claimable.length} onClick={()=>onClaim(claimable.map(g=>g.id))} className="mh-button mh-button-primary shrink-0 mb-2 min-h-[52px] rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-[13px] font-black text-white shadow-lg active:scale-[.98] disabled:opacity-40">すべて受け取る</button>}
      <button type="button" onClick={onOpenLoginBonusList} className="mh-button mh-button-secondary shrink-0 mb-2 min-h-[44px] rounded-xl bg-slate-800 border border-amber-400/60 text-amber-200 font-black text-[12px] active:scale-95">ログインボーナス一覧を見る</button>
      <div className={`mh-gift-list ${SCREEN_LIST_CLASS} pb-4`}>{shown.length===0?<ScreenEmpty emoji="🎁" lines={giftTab==='unclaimed'?['未受取のギフトはありません','ミッションやログインボーナスを達成すると、ここに届きます']:['受取済みのギフトはありません','受け取ったギフトは、ここに残ります']}/>:shown.map(g=>{const expired=giftIsExpired(g,now);const valid=!!normalizeGiftRewards(g);const display=giftTitleDisplay(g);return <article key={g.id} title={g.description||g.title||undefined} className={`mh-gift-card rounded-2xl border ${g.claimedAt?'bg-slate-900/70 border-white/10':expired?'bg-red-950/30 border-red-500/60':'bg-cyan-950/30 border-cyan-400/60'}`}>
        <div className="mh-gift-heading"><h3>{display.label&&<span>{display.label}</span>}<b>{display.title}</b></h3><em className={`${g.claimedAt?'bg-slate-700 text-slate-300':expired?'bg-red-900 text-red-200':valid?'bg-cyan-700 text-white':'bg-amber-900 text-amber-200'}`}>{g.claimedAt?'受取済み':expired?'期限切れ':valid?'受取可':'要確認'}</em></div>
        <div className="mh-gift-main"><div className="mh-gift-rewards">{Array.isArray(g.rewards)&&g.rewards.map((r,i)=><span key={i}>{giftRewardText(r)}</span>)}</div>{!g.claimedAt&&<button type="button" disabled={expired||!valid} onClick={()=>onClaim([g.id])} className="mh-button mh-button-primary">受け取る</button>}</div>
        <div className="mh-gift-deadline">{g.claimedAt?`受取日時: ${new Date(g.claimedAt).toLocaleString('ja-JP')}`:`受取期限: ${g.expiresAt?new Date(g.expiresAt).toLocaleString('ja-JP'):'期限なし'}`}</div>
      </article>})}</div>
    </div>
  );
}
