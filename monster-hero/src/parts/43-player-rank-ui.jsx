// ==================== プレイヤーのランクの見せ方(ビートランク・カードランク共通) ====================
// 2026-10-29 社長: ビートランクとカードランクは対の名前。札・棒・ランクアップの演出・ランキングの行の見せ方をそろえる
// (マルチ部ツナグくんと決めた。カードの画面はこれを使う形に差し替える)。計算は 18-player-rank.jsx の playerRankInfo。
// ★マスモンの「ビートLv」と取り違えないよう、「Lv」の字は使わず「ランク」と数字で書く。色もマスモン(緑)と分ける
const PLAYER_RANK_KINDS = Object.freeze({
  beat: { label: 'ビートランク', icon: '🎵', pill: 'bg-cyan-700 text-cyan-50', accent: 'text-cyan-200', bar: 'from-cyan-400 to-fuchsia-300', border: 'border-cyan-300/50', panel: 'bg-slate-900/85' },
  card: { label: 'カードランク', icon: '🃏', pill: 'bg-amber-700 text-amber-50', accent: 'text-amber-200', bar: 'from-emerald-400 to-amber-300', border: 'border-amber-300/50', panel: 'bg-slate-900/85' },
});
const playerRankKind = (kind) => PLAYER_RANK_KINDS[kind] || PLAYER_RANK_KINDS.beat;

// 札「🎵 ビートランク 12」。size: 'sm'(行の中)/ 'md' / 'lg'(上のまとめ)
function PlayerRankBadge({ kind = 'beat', rank = 1, size = 'md' }) {
  const k = playerRankKind(kind);
  const num = size === 'lg' ? 'text-[28px]' : size === 'sm' ? 'text-[13px]' : 'text-[18px]';
  const pill = size === 'sm' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[11px]';
  return (
    <span data-player-rank-badge={kind} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span className={`inline-flex items-center gap-1 rounded-full font-black ${pill} ${k.pill}`}><span aria-hidden="true">{k.icon}</span>{k.label}</span>
      <b data-player-rank-value className={`font-black leading-none tabular-nums text-white ${num}`}>{Math.max(1, Math.floor(Number(rank) || 1)).toLocaleString()}</b>
    </span>
  );
}

// 次のランクまでの棒。info は playerRankInfo の { rank, into, need }
function PlayerRankGauge({ kind = 'beat', info, note = '' }) {
  const k = playerRankKind(kind);
  const into = Math.max(0, Number(info && info.into) || 0), need = Math.max(1, Number(info && info.need) || 1);
  return (
    <div data-player-rank-gauge={kind}>
      <div className="h-2 overflow-hidden rounded-full bg-slate-700" role="progressbar" aria-label="次のランクまで" aria-valuemin={0} aria-valuemax={need} aria-valuenow={into}>
        <i className={`block h-full rounded-full bg-gradient-to-r ${k.bar}`} style={{ width: `${Math.min(100, Math.round((into / need) * 100))}%` }}/>
      </div>
      <div className="mt-0.5 flex justify-between gap-2 text-[10px] font-bold text-slate-300">
        <span className="tabular-nums">{`${into.toLocaleString()} / ${need.toLocaleString()}`}</span>
        <span className="min-w-0 text-right" style={JA_WRAP_STYLE}>{jaWrap(note || `次まで ${(need - into).toLocaleString()}`)}</span>
      </div>
    </div>
  );
}

// 画面の上に置くまとめ(モードえらびなど): 札と棒と、ひとこと
function PlayerRankPanel({ kind = 'beat', xp = 0, note = '', sub = '' }) {
  const k = playerRankKind(kind);
  const info = playerRankInfo(xp);
  return (
    <section data-player-rank-panel={kind} className={`rounded-2xl border px-3 py-2 ${k.border} ${k.panel}`}>
      <div className="flex items-center gap-2">
        <PlayerRankBadge kind={kind} rank={info.rank} size="lg"/>
        <small className="ml-auto shrink-0 text-[11px] font-black text-slate-200 tabular-nums">{`次まで ${(info.need - info.into).toLocaleString()}`}</small>
      </div>
      <div className="mt-1.5"><PlayerRankGauge kind={kind} info={info} note={note || ' '}/></div>
      {sub && <p className="mt-1 text-[10px] font-bold leading-snug text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(sub)}</p>}
    </section>
  );
}

// ランクが上がったときの演出。gains は [{ icon, text }](もらった物。カードは引く券・枠が増える知らせなど)
function PlayerRankUp({ kind = 'beat', from = 1, to = 1, gains = [] }) {
  if (!(to > from)) return null;
  return (
    <div data-player-rank-up={kind} className="rounded-2xl border-2 border-fuchsia-300 bg-gradient-to-b from-violet-700/80 to-indigo-950/90 px-3 py-2 text-center">
      <small className="block text-[10px] font-black tracking-[.2em] text-fuchsia-100">RANK UP!</small>
      <div className="mt-0.5 flex items-center justify-center gap-2">
        <PlayerRankBadge kind={kind} rank={from} size="sm"/>
        <span aria-hidden="true" className="font-black text-fuchsia-200">→</span>
        <b className="text-[26px] font-black leading-none text-white tabular-nums">{to.toLocaleString()}</b>
      </div>
      {gains.length > 0 && <ul data-player-rank-up-gains className="mt-1.5 flex flex-wrap justify-center gap-1.5">
        {gains.map((g, i) => <li key={i} className="rounded-lg border border-fuchsia-200/40 bg-slate-950/70 px-2 py-0.5 text-[11px] font-black text-amber-100">
          {g.icon && <span aria-hidden="true">{g.icon} </span>}<span style={JA_WRAP_STYLE}>{jaWrap(String(g.text || ''))}</span>
        </li>)}
      </ul>}
    </div>
  );
}

// 1回ぶんの結果に出す札: 「経験値 +26(ランク12→13)」・内わけ・棒・上がったら演出。
// award: { add, parts:[{label,xp}], from, to, xp(足したあとの合計), gains:[{icon,text}] }
function PlayerRankGain({ kind = 'beat', award }) {
  if (!award || !(award.add > 0)) return null;
  const k = playerRankKind(kind);
  const info = playerRankInfo(award.xp);
  const up = award.to > award.from;
  return (
    <section data-player-rank-gain={kind} className={`my-3 space-y-1.5 rounded-2xl border p-3 text-left ${k.border} ${k.panel}`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${k.pill}`}><span aria-hidden="true">{k.icon} </span>{k.label}</span>
        <b data-player-rank-gain-add className={`text-[15px] font-black ${k.accent}`}>{`経験値 +${award.add.toLocaleString()}`}</b>
        <span className="text-[12px] font-black text-white tabular-nums">{up ? `(ランク${award.from}→${award.to})` : `(ランク${info.rank})`}</span>
      </div>
      {Array.isArray(award.parts) && award.parts.length > 0 && <p data-player-rank-gain-parts className="text-[10px] font-bold text-slate-400" style={JA_WRAP_STYLE}>
        {jaWrap(award.parts.map((p) => `${p.label} ${p.xp >= 0 ? '+' : ''}${p.xp}`).join(' ・ '))}
      </p>}
      <PlayerRankGauge kind={kind} info={info}/>
      {up && <PlayerRankUp kind={kind} from={award.from} to={award.to} gains={award.gains || []}/>}
    </section>
  );
}

// ランキングの1行。place は順位(無ければ「—」)。icon は呼ぶ側が描いたアイコン(rankingBreederIcon など)
function PlayerRankRow({ kind = 'beat', place = null, icon = null, name = '', rank = 1, xp = 0, mine = false }) {
  const k = playerRankKind(kind);
  return (
    <li data-player-rank-row={kind} data-player-rank-mine={mine ? 'true' : undefined}
      className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${mine ? `border-2 ${k.border} bg-cyan-950/50` : 'border-white/10 bg-slate-900/80'}`}>
      <b className={`w-9 shrink-0 text-center text-sm font-black tabular-nums ${place === 1 ? 'text-amber-300' : 'text-slate-200'}`}>{place ? place.toLocaleString() : '—'}</b>
      {icon}
      <span className="min-w-0 flex-1 truncate text-xs font-black text-white">{name}{mine ? '(あなた)' : ''}</span>
      <span className="shrink-0 text-right">
        <b className={`block text-sm font-black leading-tight ${k.accent}`}>{`ランク ${Math.max(1, Math.floor(Number(rank) || 1)).toLocaleString()}`}</b>
        <small className="block text-[9px] font-bold text-slate-400 tabular-nums">{`経験値 ${playerRankSafeXp(xp).toLocaleString()}`}</small>
      </span>
    </li>
  );
}

// ランキングのタブの中身: 上位100人と、自分の行(100人に入っていなければ下に順位つきで)。
// 読み込みは呼ぶ側が渡す(ビートは sbFetchBeatRanks・sbFetchBeatRankMine。カードも同じ形で渡す)。
//   fetchTop() → [{ breederId, name, icon, profileFrame, rank, xp }] | null(表がまだ無い)
//   fetchMine() → { …同じ, place } | null
// renderIcon(entry) は行のアイコン(全国ランキングと同じ rankingBreederIcon)。reloadKey が変わると読み直す
function PlayerRankBoard({ kind = 'beat', fetchTop, fetchMine, renderIcon = null, selfBreederId = '', selfXp = 0, reloadKey = 0 }) {
  const [board, setBoard] = React.useState({ status: 'loading', top: [], mine: null });
  React.useEffect(() => {
    let alive = true;
    setBoard((b) => ({ ...b, status: b.top.length ? 'ready' : 'loading' }));
    (async () => {
      try {
        const [top, mine] = await Promise.all([fetchTop ? fetchTop() : null, fetchMine ? fetchMine().catch(() => null) : null]);
        if (!alive) return;
        if (top === null) { setBoard({ status: 'closed', top: [], mine: null }); return; }
        setBoard({ status: 'ready', top, mine });
      } catch (_) { if (alive) setBoard((b) => ({ ...b, status: b.top.length ? 'ready' : 'error' })); }
    })();
    return () => { alive = false; };
  }, [reloadKey]);
  const label = playerRankKind(kind).label;
  const iconOf = (e) => (renderIcon ? renderIcon({ icon: e.icon, profileFrame: e.profileFrame, userName: e.name, breederId: e.breederId }) : null);
  if (board.status === 'loading') return <p data-player-rank-board="loading" className="px-3 py-6 text-center text-xs font-black text-slate-400">読み込んでいます…</p>;
  if (board.status === 'closed') return <p data-player-rank-board="closed" className="px-3 py-6 text-center text-xs font-black text-slate-400" style={JA_WRAP_STYLE}>{jaWrap(`${label}のランキングは準備中です。`)}</p>;
  if (board.status === 'error') return <p data-player-rank-board="error" className="px-3 py-6 text-center text-xs font-black text-rose-300" style={JA_WRAP_STYLE}>{jaWrap('ランキングを読み込めませんでした。電波のよいところで「更新」を押してください。')}</p>;
  const selfId = selfBreederId || (board.mine && board.mine.breederId) || '';
  const inTop = !!selfId && board.top.some((e) => e.breederId === selfId);
  return (
    <div data-player-rank-board={kind} className="space-y-2 px-3 py-2">
      <p className="text-[10px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('ランクの高い順。同じランクなら、経験値の合計が多い順です(上位100人とあなた)。')}</p>
      {board.top.length === 0
        ? <p className="py-4 text-center text-xs font-black text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('まだだれも載っていません。曲を遊ぶと、ここに載ります。')}</p>
        : <ol className="space-y-1.5">{board.top.map((e, i) => <PlayerRankRow key={e.breederId || i} kind={kind} place={i + 1} icon={iconOf(e)} name={e.name} rank={e.rank} xp={e.xp} mine={!!selfId && e.breederId === selfId}/>)}</ol>}
      {!inTop && (board.mine
        ? <ol className="border-t border-white/10 pt-2"><PlayerRankRow kind={kind} place={board.mine.place} icon={iconOf(board.mine)} name={board.mine.name} rank={board.mine.rank} xp={board.mine.xp} mine/></ol>
        : selfXp > 0 && <p className="border-t border-white/10 pt-2 text-center text-[10px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('あなたの記録は、次に曲を遊んだときに載ります。')}</p>)}
    </div>
  );
}
