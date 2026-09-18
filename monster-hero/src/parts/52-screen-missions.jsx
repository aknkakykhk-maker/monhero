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
//
// 【2026-09-18・見た目をそろえたときの決めごと】
// ・根の style で safe-area を足していたが、index.html:134 の body が既に持っているので
//   二重取りだった。根は SCREEN_SHELL_CLASS だけにする
// ・見出しは ScreenHead、タブは ScreenTabs(41-screen-ui.jsx)。赤バッジは label の中へ入れる
// ・一括受け取りの色は、いま選んでいるタブの色に合わせる(タブとボタンが繋がって見えるように)
function MissionsScreen({ missions, missionTab, onSelectTab, onBack, onClaim, onClaimBulk }) {
  const state = normalizeMissions(missions), defs = MISSION_DEFS[missionTab];
  const sent = missionTab === 'daily' ? state.sentDaily : missionTab === 'weekly' ? state.sentWeekly : state.sentMonthly;
  const resetAt = missionNextReset(missionTab);
  const bulkGradient = missionTab === 'daily' ? 'from-amber-500 to-orange-600'
    : missionTab === 'weekly' ? 'from-violet-600 to-indigo-600'
    : 'from-fuchsia-600 to-purple-800';
  return (
    <div data-mh-screen className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="ミッション" icon={<List size={20}/>} accent="text-amber-400" onBack={onBack} backLabel="戻る"/>
      {/* 受け取れる報酬があるかどうかでセリフを切り替える */}
      {(()=>{const claimable=missionClaimableCount(state)>0;const allDone=['daily','weekly','monthly'].every(t=>MISSION_DEFS[t].every(m=>missionValue(state,t,m)>=m.target));return <div className="shrink-0 w-full max-w-md mx-auto mb-2"><AssistantBubble key={claimable?'claim':'normal'} scene={claimable?'missionsClaimable':'missionsNormal'} condition={claimable&&allDone?'allDone':null} compact/></div>;})()}
      <ScreenTabs value={missionTab} onChange={onSelectTab} items={[
        {id:'daily',color:'#d97706',label:<>デイリー{tabCountBadge(missionClaimableList(state,'daily').length)}</>},
        {id:'weekly',color:'#7c3aed',label:<>ウィークリー{tabCountBadge(missionClaimableList(state,'weekly').length)}</>},
        {id:'monthly',color:'#c026d3',label:<>マンスリー{tabCountBadge(missionClaimableList(state,'monthly').length)}</>},
      ]}/>
      {(()=>{const bulk=missionClaimableList(state,missionTab);return <button type="button" disabled={!bulk.length} onClick={()=>onClaimBulk(missionTab)} className={`shrink-0 mb-2 min-h-[52px] rounded-xl bg-gradient-to-r ${bulkGradient} text-[13px] font-black text-white shadow-lg active:scale-[.98] disabled:opacity-40`}>一括受け取り{bulk.length>0&&` (${bulk.length})`}</button>;})()}
      <div className="mb-2 flex shrink-0 justify-center"><span className="rounded-full border border-white/10 bg-slate-900/70 px-3 py-1 text-[10px] font-black text-slate-300">次回更新: {new Date(resetAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'})}</span></div>
      <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>{defs.length===0?<ScreenEmpty emoji="🗒️" lines={['このタブのミッションはありません','ほかのタブに受け取れるものがあるかもしれません']}/>:defs.map(m=>{const value=missionValue(state,missionTab,m),done=value>=m.target,isSent=sent.includes(m.id),pct=Math.min(100,Math.floor(value/m.target*100));return <article key={m.id} className={`rounded-2xl border p-3 ${isSent?'bg-slate-900/70 border-white/10':done?'bg-amber-950/40 border-amber-400/60':'bg-slate-900 border-white/10'}`}>
        <div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="font-black text-sm text-white break-words">{m.name}</h3><p className="mt-0.5 text-[11px] font-bold leading-snug text-slate-400 break-words">{m.condition}</p></div><b className="shrink-0 text-[12px] text-amber-200">{Math.min(value,m.target)} / {m.target}</b></div>
        <div className="h-2 my-2 overflow-hidden rounded-full bg-black/40 ring-1 ring-white/5"><div className={`h-full rounded-full transition-[width] ease-out ${done?'bg-amber-400':'bg-cyan-500'}`} style={{width:`${pct}%`}}></div></div>
        <div className="flex items-center justify-between gap-2"><div className="min-w-0 text-[11px] font-black text-cyan-200 break-words">報酬: {m.rewards.map(giftRewardText).join(' / ')}</div>{isSent?<button type="button" disabled className="shrink-0 min-h-[44px] px-3 rounded-xl bg-amber-500 text-[11px] font-black text-black disabled:opacity-40">ギフト送付済み</button>:done?<button type="button" onClick={()=>onClaim(missionTab,m)} className="shrink-0 min-h-[44px] px-4 rounded-xl bg-amber-500 text-[12px] font-black text-black active:scale-95">受け取る</button>:<span className="shrink-0 text-[11px] font-black text-slate-400">進行中 {pct}%</span>}</div>
      </article>})}</div>
    </div>
  );
}
