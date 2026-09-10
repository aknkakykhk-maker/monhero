// ==== 画面: ミッション(gameState === 'MISSIONS') ====
//
// MonsterHeroGame から切り出した2画面目(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6-3)。
// 型は 51-screen-settings.jsx にそろえてある。
//
// 【この画面ならではの注意】
// ・受け取り(claimMission / claimMissionsBulk)は保存とギフト送付を伴うので、中身は
//   MonsterHeroGame 側に残したまま props で受け取る。画面は「どれを受け取るか」を渡すだけ
// ・進捗の読み方(normalizeMissions・missionValue・missionClaimableList)は共有層の純関数なので、
//   props にせず画面から直接呼ぶ。保存には触れない
// ・タブの赤バッジ tabCountBadge は、ギフトボックスも使う小部品なので共有層(16)へ移した
// ・この画面にタイマーは無い(docs/refactor/SCREEN_EFFECTS_MAP.md に MISSIONS の行が無い)
function MissionsScreen({ missions, missionTab, onSelectTab, onBack, onClaim, onClaimBulk }) {
  const state = normalizeMissions(missions), defs = MISSION_DEFS[missionTab];
  const sent = missionTab === 'daily' ? state.sentDaily : missionTab === 'weekly' ? state.sentWeekly : state.sentMonthly;
  const resetAt = missionNextReset(missionTab);
  return (
    <div data-mh-screen className="flex-1 flex flex-col h-full min-h-0 p-3" style={{paddingTop:'calc(.75rem + env(safe-area-inset-top))',paddingBottom:'calc(.75rem + env(safe-area-inset-bottom))'}}>
      <div className="flex items-center justify-between gap-2 mb-2 shrink-0"><button onClick={onBack} className="p-3 text-slate-400 active:scale-90"><ArrowLeft size={20}/></button><h2 className="text-xl font-black text-amber-200 flex items-center gap-2"><List size={21}/>ミッション</h2><div className="w-11"></div></div>
      {/* 受け取れる報酬があるかどうかでセリフを切り替える */}
      {(()=>{const claimable=missionClaimableCount(state)>0;const allDone=['daily','weekly','monthly'].every(t=>MISSION_DEFS[t].every(m=>missionValue(state,t,m)>=m.target));return <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble key={claimable?'claim':'normal'} scene={claimable?'missionsClaimable':'missionsNormal'} condition={claimable&&allDone?'allDone':null} compact/></div>;})()}
      <div className="grid grid-cols-3 gap-1.5 mb-2 shrink-0"><button onClick={()=>onSelectTab('daily')} className={`relative min-h-[44px] rounded-xl px-1 font-black text-[11px] ${missionTab==='daily'?'bg-amber-600 text-white':'bg-slate-900 text-slate-400'}`}>デイリー{tabCountBadge(missionClaimableList(state,'daily').length)}</button><button onClick={()=>onSelectTab('weekly')} className={`relative min-h-[44px] rounded-xl px-1 font-black text-[11px] ${missionTab==='weekly'?'bg-violet-600 text-white':'bg-slate-900 text-slate-400'}`}>ウィークリー{tabCountBadge(missionClaimableList(state,'weekly').length)}</button><button onClick={()=>onSelectTab('monthly')} className={`relative min-h-[44px] rounded-xl px-1 font-black text-[11px] ${missionTab==='monthly'?'bg-fuchsia-600 text-white':'bg-slate-900 text-slate-400'}`}>マンスリー{tabCountBadge(missionClaimableList(state,'monthly').length)}</button></div>
      {(()=>{const bulk=missionClaimableList(state,missionTab);return <button disabled={!bulk.length} onClick={()=>onClaimBulk(missionTab)} className="shrink-0 mb-2 min-h-[44px] rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black disabled:opacity-40">一括受け取り{bulk.length>0&&` (${bulk.length})`}</button>;})()}
      <div className="mb-2 text-center text-[10px] font-bold text-slate-400 shrink-0">次回更新: {new Date(resetAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'})}</div>
      <div className="flex-1 min-h-0 overflow-y-auto mh-scroll space-y-2 pb-2">{defs.map(m=>{const value=missionValue(state,missionTab,m),done=value>=m.target,isSent=sent.includes(m.id),pct=Math.min(100,Math.floor(value/m.target*100));return <article key={m.id} className={`rounded-2xl border p-3 ${isSent?'bg-slate-900/70 border-slate-700':done?'bg-amber-950/40 border-amber-400/70':'bg-slate-900 border-white/10'}`}>
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-black text-sm text-white break-words">{m.name}</h3><p className="text-[10px] text-slate-400 break-words">{m.condition}</p></div><b className="shrink-0 text-xs text-amber-200">{Math.min(value,m.target)} / {m.target}</b></div>
        <div className="h-2 my-2 overflow-hidden rounded-full bg-black/50"><div className={`h-full rounded-full ${done?'bg-amber-400':'bg-cyan-500'}`} style={{width:`${pct}%`}}></div></div>
        <div className="flex items-center justify-between gap-2"><div className="min-w-0 text-[10px] font-black text-cyan-200 break-words">報酬: {m.rewards.map(giftRewardText).join(' / ')}</div>{isSent?<button disabled className="shrink-0 min-h-[38px] px-3 rounded-xl bg-slate-700 text-[10px] font-black text-slate-400">ギフト送付済み</button>:done?<button onClick={()=>onClaim(missionTab,m)} className="shrink-0 min-h-[38px] px-4 rounded-xl bg-amber-500 text-[11px] font-black text-black active:scale-95">受け取る</button>:<span className="shrink-0 text-[10px] font-black text-slate-500">進行中 {pct}%</span>}</div>
      </article>})}</div>
    </div>
  );
}
