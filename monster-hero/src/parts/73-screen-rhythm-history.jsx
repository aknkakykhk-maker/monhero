// ==== 画面: モンヒロビートの履歴(gameState === 'RHYTHM_HISTORY') ====
//
// 2026-09-13・ユーザー依頼「モンビーのイベントや週間ランキングの終わったものを
// ヒストリー的に見れる機能」。置き場所はプロフィール(ユーザーが決めた)。
// ランキング画面は「いま競っている場所」なので、自分の足あとはプロフィールへ置く。
//
// 【この画面の決めごと】
// ・**表示専用**。報酬の受け取りには一切関わらないし、受取フラグ(mh_rhythm_event_reward_v1)も
//   保存も触らない。新しい保存キーも作らない(CLAUDE.md ⑦)
// ・一覧は data/rhythm-event.js が計算だけで作る。**サーバーへは一度も聞きに行かない**。
//   週は年52件ずつ増えるが、行に出すのは日付だけなので件数が増えても重くならない。
//   順位を取りに行くのは**選んで開いた回だけ**(いまのランキングを1回開くのと同じ)
// ・順位の集計は今週・開催中とまったく同じ関数を使う(渡す期間が違うだけ)。
//   集計の仕方をここに持たない
//
// 一覧と中身は同じ画面で切り替える(selected が null なら一覧)。
// 画面(gameState)を2つに分けると、戻るたびに一覧を組み直すことになるため。
function RhythmHistoryScreen({
  entries, selected, board, divisionId, rankingBreederIcon,
  onBack, onSelect, onClearSelection, onSelectDivision, onRefresh,
}) {
  const list = Array.isArray(entries) ? entries : [];
  const view = board || { status:'idle', event:null, boards:{}, error:null };
  // 部門は**えらんだ回から**作る。取ってきた結果(view.event)を待つと、
  // 読み込み中や通信に失敗したあいだ部門のボタンが消えて、切り替えて試し直せなくなる
  const eventDefinition = (selected ? rhythmHistoryBoardEvent(selected) : null) || view.event || null;
  // 部門(対象曲ごと＋総合)。対象曲を持つのはイベントだけなので、週は総合1つになる
  const divisions = eventDefinition ? rhythmEventDivisions(eventDefinition, RHYTHM_SONGS) : [];
  const wanted = divisionId || RHYTHM_EVENT_TOTAL_DIVISION;
  const activeDivision = divisions.some(division => division.id === wanted) ? wanted : RHYTHM_EVENT_TOTAL_DIVISION;
  const divisionBoard = (view.boards && view.boards[activeDivision]) || { status:'idle', entries:[], self:null };
  const songId = rhythmEventDivisionSongId(activeDivision);
  // 週は累計スコア方式なので、1行に出す補助の数字が「遊んだ回数」になる。
  // ★ただし累計方式より前の週(scoring:'best')は、当時の数え方=曲ごとのベストの合計。
  //   遊んだ回数は数えていないので出さない(2026-09-14)
  const weekly = !!selected && selected.kind === 'weekly';
  const weeklyBest = weekly && selected.scoring === 'best';
  const weeklyTotals = weekly && !weeklyBest;
  const rows = Array.isArray(divisionBoard.entries) ? divisionBoard.entries : [];
  const self = divisionBoard.self || null;
  // ランクは素点で決める(回数ボーナス込みの点だと満点を超えてしまうため。ランキング画面と同じ)
  const rankScore = (entry) => (entry && entry.baseScore !== null && entry.baseScore !== undefined)
    ? entry.baseScore : ((entry && entry.score) || 0);
  const row = (entry, rank, mine) => (
    <div data-rhythm-history-row className={`flex items-center gap-2 rounded-2xl border p-2 ${mine?'border-amber-300/60 bg-amber-500/10':'border-white/10 bg-slate-900/80'}`}>
      <b className="w-8 shrink-0 text-center text-xs font-black text-amber-200">{rank?`${rank}`:'—'}</b>
      {rankingBreederIcon(entry)}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-black text-white">{entry.userName}</p>
        <p className="text-[9px] text-slate-400">
          {songId
            ? `${RHYTHM_DEMO_DIFFICULTY_LABELS[entry.difficultyId]?.name||entry.difficultyId||'-'} ・ Lv.${entry.level}`
            : `${weeklyTotals?`${entry.playCount}回 ・ `:''}${entry.songCount}曲 ・ Lv.${entry.level}`}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-black text-amber-100">{(songId?entry.score:entry.totalScore).toLocaleString()}</p>
        {songId&&<p className={`text-[10px] font-black ${RHYTHM_RANK_COLORS[rhythmRankForScore(rankScore(entry))]}`}>{rhythmRankForScore(rankScore(entry))}</p>}
        {entry.bonusScore>0&&<p className="text-[9px] font-black text-amber-300">+{entry.bonusScore.toLocaleString()}（{entry.playCount}回）</p>}
      </div>
    </div>
  );
  return (
    <main data-mh-screen data-rhythm-history className="flex h-full flex-1 flex-col bg-slate-950 text-white">
      <header className="z-10 flex shrink-0 items-center gap-2 border-b border-amber-400/15 bg-slate-950/95 px-3 py-1" style={{paddingTop:'calc(0.25rem + env(safe-area-inset-top))'}}>
        <button aria-label="戻る" data-rhythm-history-back onClick={()=>selected?onClearSelection():onBack()} className="min-h-[44px] px-2 text-slate-400"><ArrowLeft size={18}/></button>
        <h2 className="min-w-0 flex-1 truncate text-sm font-black tracking-widest text-amber-200">
          {selected?rhythmHistoryName(selected):'🕘 これまでの記録'}
        </h2>
        {selected&&<button aria-label="更新" data-rhythm-history-refresh onClick={onRefresh} className="ml-auto min-h-[44px] px-2 text-[10px] font-black text-amber-200">更新</button>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto mh-scroll px-3 py-3">
        {!selected&&(
          <>
            <div className="mb-3"><AssistantBubble scene="rhythmHistory" compact/></div>
            {list.length===0
              ? <p className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center text-[11px] font-black text-slate-400">
                  終わった週やイベントがまだありません。<br/>週間ランキングは毎週 月曜 5:00 に切り替わります。
                </p>
              : <div className="flex flex-col gap-2">
                  {list.map(entry=>(
                    <button key={entry.id} type="button" data-rhythm-history-entry={entry.id} onClick={()=>onSelect(entry)}
                      className={`flex min-h-[64px] w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-left active:scale-[.98] ${entry.kind==='limited'?'border-fuchsia-400/40 bg-fuchsia-950/30':'border-amber-400/25 bg-slate-900/70'}`}>
                      {/* 週に📅を使うと、端末によっては日付入りの絵で出て「その日の記録」に見えてしまう */}
                      <span className="text-xl" aria-hidden="true">{entry.kind==='limited'?'🏆':'📊'}</span>
                      <span className="min-w-0 flex-1">
                        <b className={`block truncate text-[12px] font-black ${entry.kind==='limited'?'text-fuchsia-100':'text-white'}`}>{rhythmHistoryName(entry)}</b>
                        <small className="block text-[9px] text-slate-400">{rhythmHistoryPeriodText(entry)}</small>
                        {entry.kind==='limited'&&<small className="block text-[9px] font-black text-fuchsia-300/80">対象曲 {entry.event?.songIds?.length||0}曲</small>}
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-slate-500"/>
                    </button>
                  ))}
                </div>}
          </>
        )}
        {selected&&(
          <>
            <div className="mb-3 rounded-2xl border border-white/10 bg-slate-900/70 p-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-[9px] font-black tracking-widest text-slate-400">終了</span>
                <span className="text-[10px] font-black text-slate-300">{rhythmHistoryPeriodText(selected)}</span>
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
                当時の記録から数え直して出しています。ここから報酬を受け取ることはできません。
              </p>
              {/* ★数え方が途中で変わっているので、どちらで出しているかを書く(2026-09-14)。
                  書かないと「同じ週間ランキングなのに見かたが違う」と伝わらない */}
              {weeklyBest&&<p data-rhythm-history-best-note className="mt-1 text-[9px] leading-relaxed text-amber-200/80">
                この週は「曲ごとのいちばん良いスコアを全曲ぶん合計」で競っていたころのものです（当時と同じ数え方で出しています）。いまの週間ランキングは「遊んだぶんをすべて足す」方式です。
              </p>}
              {weeklyTotals&&<p data-rhythm-history-total-note className="mt-1 text-[9px] leading-relaxed text-slate-500">
                この週は「その週に遊んだぶんをすべて足す」方式です。
              </p>}
            </div>
            {/* 部門(対象曲ごと＋総合)。対象曲を持つのはイベントだけなので、週では出ない */}
            {divisions.length>1&&(
              <div data-rhythm-history-divisions className="mb-3 flex flex-wrap gap-1">
                {divisions.map(division=>(
                  <button key={division.id} type="button" data-rhythm-history-division={division.id} onClick={()=>onSelectDivision(division.id)}
                    className={`min-h-[44px] flex-1 basis-[45%] rounded-xl border px-2 py-1 text-[10px] font-black leading-tight ${division.id===activeDivision?'border-fuchsia-300/60 bg-fuchsia-500/15 text-fuchsia-100':'border-white/10 bg-slate-900/60 text-slate-400'}`}>
                    {division.songId?(rhythmSongFullName(division.song)||division.songId):'総合'}
                  </button>
                ))}
              </div>
            )}
            {view.status==='notReady'&&<p className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center text-[11px] font-black text-slate-400">この端末ではまだ順位を出せません。</p>}
            {view.status==='error'&&<p className="rounded-2xl border border-rose-400/30 bg-rose-950/30 p-4 text-center text-[11px] font-black text-rose-200">順位を読み込めませんでした。「更新」を押すともう一度試します。</p>}
            {divisionBoard.status==='loading'&&rows.length===0&&<p className="p-6 text-center text-[11px] font-black text-slate-500">読み込み中…</p>}
            {divisionBoard.status==='ready'&&rows.length===0&&<p className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center text-[11px] font-black text-slate-400">この回の記録はありません。</p>}
            {rows.length>0&&(
              <div className="flex flex-col gap-1.5">
                {rows.map((entry,index)=>(
                  <React.Fragment key={`${entry.identityKey||'row'}-${index}`}>{row(entry,index+1,!!self&&self.identityKey===entry.identityKey)}</React.Fragment>
                ))}
              </div>
            )}
            {/* 自分が一覧に入っていないときだけ、自分の行を下へ足す */}
            {self&&self.rank===null&&(
              <div className="mt-3">
                <p className="mb-1 px-1 text-[9px] font-black tracking-widest text-amber-300">あなたの記録</p>
                {row(self,null,true)}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
