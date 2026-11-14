// 助手ライフ: フレンドの家で、その人の助手のマスモン・デッキを見る入口(2026-11-12・案 docs/progress/assistant-peer/FRIEND-SHOWCASE-PLAN.md)。
// 読むのは 56-assistant-life-friend-masmon-share の alfMsFetch。画面はキズナの <AssistantMasmonNote readOnly/>。保存はしない
// ---------- 見る側の入口(フレンドの家の部屋のシート)----------
// 「🐾 ◯◯のマスモン ›」→ 表から1人ぶんを読む → キズナの見る専用 <AssistantMasmonNote readOnly/>。
// 公開の印 alfMasmonShareSend が偽のあいだは出さない(送る側と同じ印。見る画面だけ先に出すと、だれも送っていないため)
function AlfMsRoomLink({ friend, aid, land = false }) {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState(undefined); // undefined=読んでいない null=無い
  if (!alfMsSendOn() || typeof AssistantMasmonNote !== 'function' || !friend || !alfSafeOther(friend.id) || !ALF_IDS.includes(aid)) return null;
  const go = async () => {
    setOpen(true);
    if (data === undefined) { const d = await alfMsFetch(friend.id, aid); setData(d || null); }
  };
  return (<>
    <button type="button" className="mhl-btn mt-2 w-full bg-emerald-700" data-alf-ms-open={aid} onClick={() => { void go(); }}>🐾 {assistantLifeName(aid)}のマスモン ›</button>
    {open && alfLayer(<div className="absolute inset-0" style={{ zIndex: 46 }} data-alf-ms-view={aid}>
      {data === undefined
        ? <div className="absolute inset-0 flex items-center justify-center bg-black/60"><p className="rounded-xl bg-slate-900 px-4 py-2 text-[12px] font-bold text-slate-200">読んでいます…</p></div>
        : <AssistantMasmonNote readOnly data={data} ownerName={friend.name} aid={aid} land={land} onClose={() => setOpen(false)}/>}
    </div>)}
  </>);
}

// ---------- 家から挑む入口(2026-11-14・案 docs/progress/assistant-peer/friend-battle-entry/PLAN.md)----------
// 「⚔ ◯◯のマスモンに挑む ›」→ 既存の対戦画面(assistantMasmonBattleOpen)を、フレンドの助手の側・この相手を選んだ状態で開く。新しい対戦の仕組みは作らない
function AlfMsBattleLink({ friend, aid }) {
  if (typeof ambbPvpOn !== 'function' || !ambbPvpOn() || typeof assistantMasmonBattleOpen !== 'function' || !friend || !alfSafeOther(friend.id) || !ALF_IDS.includes(aid)) return null;
  return (<>
    <button type="button" className="mhl-btn mt-2 w-full bg-rose-600" data-alf-battle-open={aid} onClick={() => { assistantMasmonBattleOpen({ from: 'friend-house', friendId: friend.id, friendAssistantId: aid }); }}>⚔ {assistantLifeName(aid)}のマスモンに挑む ›</button>
    <p className="mt-0.5 text-center text-[10px] text-slate-300"><span className="whitespace-nowrap">相手の登録した編成と対戦します。</span></p>
  </>);
}
