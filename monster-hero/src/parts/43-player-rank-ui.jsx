// ==================== プレイヤーのランクの見せ方(ビートランク・カードランク共通) ====================
// 2026-10-29 社長: ビートランクとカードランクは対の名前。札・棒・ランクアップの演出・ランキングの行の見せ方をそろえる
// (マルチ部ツナグくんと決めた。カードの画面はこれを使う形に差し替える)。計算は 18-player-rank.jsx の playerRankInfo。
// ★マスモンの「ビートLv」と取り違えないよう、「Lv」の字は使わず「ランク」と数字で書く。色もマスモン(緑)と分ける
const PLAYER_RANK_KINDS = Object.freeze({
  beat: { label: 'ビートランク', icon: '🎵', pill: 'bg-cyan-700 text-cyan-50', accent: 'text-cyan-200', bar: 'from-cyan-400 to-fuchsia-300', border: 'border-cyan-300/50', panel: 'bg-slate-900/85' },
  card: { label: 'カードランク', icon: '🃏', pill: 'bg-amber-700 text-amber-50', accent: 'text-amber-200', bar: 'from-emerald-400 to-amber-300', border: 'border-amber-300/50', panel: 'bg-slate-900/85' },
});
const playerRankKind = (kind) => PLAYER_RANK_KINDS[kind] || PLAYER_RANK_KINDS.beat;

// ランクの帯(2026-10-29 社長「なんかださくない？」→ ブリーダーレベルの札を手本に、ゲームらしいバッジへ。マルチ部ツナグくんの見本どおり)。
// 1〜9 ブロンズ・10〜19 シルバー・20〜29 ゴールド・30〜49 アメジスト・50〜 レインボー
const playerRankTier = (rank) => {
  const r = Math.max(1, Math.floor(Number(rank) || 1));
  if (r >= 50) return { t: 5, name: 'レインボー' };
  if (r >= 30) return { t: 4, name: 'アメジスト' };
  if (r >= 20) return { t: 3, name: 'ゴールド' };
  if (r >= 10) return { t: 2, name: 'シルバー' };
  return { t: 1, name: 'ブロンズ' };
};
// 六角の盾(外側=縁の色・内側=面の色)・上半分の光沢・白い大きな数字と濃い縁取り・帯の色の光。
// ::before/::after と変数を使うので Tailwind ではなく CSS のまま持ち、最初に描いたときに1回だけ <head> へ入れる
const PLAYER_RANK_BADGE_CSS = `
.mh-prb{display:inline-flex;align-items:center;gap:6px}
.mh-prb-shield{position:relative;width:52px;height:58px;flex:none;filter:drop-shadow(0 3px 0 rgba(0,0,0,.45)) drop-shadow(0 0 10px var(--prb-glow))}
.mh-prb-shield::before{content:"";position:absolute;inset:0;clip-path:polygon(50% 0,100% 18%,100% 70%,50% 100%,0 70%,0 18%);background:var(--prb-rim)}
.mh-prb-shield::after{content:"";position:absolute;inset:3px;clip-path:polygon(50% 0,100% 18%,100% 70%,50% 100%,0 70%,0 18%);background:var(--prb-face)}
.mh-prb-gloss{position:absolute;inset:3px 3px 50% 3px;z-index:2;clip-path:polygon(50% 0,100% 18%,100% 100%,0 100%,0 18%);background:linear-gradient(180deg,rgba(255,255,255,.55),rgba(255,255,255,.05))}
.mh-prb-num{position:absolute;inset:0;z-index:3;display:flex;align-items:center;justify-content:center;padding-top:3px;font-weight:900;font-size:26px;color:#fff;-webkit-text-stroke:5px var(--prb-ink);paint-order:stroke fill;letter-spacing:-.04em;line-height:1}
.mh-prb-num.mh-prb-w3{font-size:20px}
.mh-prb-tag{display:flex;flex-direction:column;line-height:1.05}
.mh-prb-kind{white-space:nowrap;font-size:10px;font-weight:900;color:var(--prb-label);letter-spacing:.08em}
.mh-prb-name{white-space:nowrap;font-size:14px;font-weight:900;color:#fff;-webkit-text-stroke:3px var(--prb-ink);paint-order:stroke fill}
.mh-prb.mh-prb-s .mh-prb-shield{width:32px;height:36px}.mh-prb.mh-prb-s .mh-prb-shield::after{inset:2px}
.mh-prb.mh-prb-s .mh-prb-num{font-size:16px;-webkit-text-stroke:3.5px var(--prb-ink)}.mh-prb.mh-prb-s .mh-prb-num.mh-prb-w3{font-size:12px}
.mh-prb.mh-prb-s .mh-prb-name{font-size:12px}.mh-prb.mh-prb-s .mh-prb-kind{display:none}
.mh-prb-t1{--prb-rim:linear-gradient(160deg,#fde2c4,#9a4b1c 55%,#5a250b);--prb-face:linear-gradient(160deg,#e08a4a,#8a3f12);--prb-ink:#3b1406;--prb-glow:rgba(234,138,74,.55);--prb-label:#fbbf8a}
.mh-prb-t2{--prb-rim:linear-gradient(160deg,#ffffff,#94a3b8 55%,#475569);--prb-face:linear-gradient(160deg,#cbd5e1,#64748b);--prb-ink:#1e293b;--prb-glow:rgba(203,213,225,.6);--prb-label:#e2e8f0}
.mh-prb-t3{--prb-rim:linear-gradient(160deg,#fff7c2,#f59e0b 55%,#92400e);--prb-face:linear-gradient(160deg,#fcd34d,#d97706);--prb-ink:#5b2a03;--prb-glow:rgba(251,191,36,.7);--prb-label:#fde68a}
.mh-prb-t4{--prb-rim:linear-gradient(160deg,#f5d0fe,#a21caf 55%,#4a044e);--prb-face:linear-gradient(160deg,#c084fc,#6d28d9);--prb-ink:#2e1065;--prb-glow:rgba(192,132,252,.75);--prb-label:#f0abfc}
.mh-prb-t5{--prb-rim:conic-gradient(from 0deg,#f43f5e,#f59e0b,#84cc16,#06b6d4,#8b5cf6,#f43f5e);--prb-face:linear-gradient(160deg,#1e1b4b,#0f172a);--prb-ink:#000;--prb-glow:rgba(255,255,255,.8);--prb-label:#fff}
`;
const ensurePlayerRankBadgeCss = () => {
  try {
    if (typeof document === 'undefined' || document.getElementById('mh-player-rank-badge-css')) return;
    const el = document.createElement('style');
    el.id = 'mh-player-rank-badge-css';
    el.textContent = PLAYER_RANK_BADGE_CSS;
    document.head.appendChild(el);
  } catch (_) { /* 入れられなくても数字は読める */ }
};

// ランクの札(バッジ)。size: 'lg'(大きい盾+帯の名前+種類の名前)/ 'sm'(小さい盾+種類の名前)。showName=false で盾だけ(ランキングの行)
function PlayerRankBadge({ kind = 'beat', rank = 1, size = 'lg', showName = true }) {
  ensurePlayerRankBadgeCss();
  const k = playerRankKind(kind);
  const r = Math.max(1, Math.floor(Number(rank) || 1));
  const tier = playerRankTier(r);
  const text = r.toLocaleString();
  return (
    <span data-player-rank-badge={kind} data-player-rank-tier={tier.t} aria-label={`${k.label} ${r}`}
      className={`mh-prb mh-prb-t${tier.t}${size === 'sm' ? ' mh-prb-s' : ''}`}>
      <span className="mh-prb-shield" aria-hidden="true"><span className="mh-prb-gloss"/><b data-player-rank-value className={`mh-prb-num${text.length >= 3 ? ' mh-prb-w3' : ''}`}>{text}</b></span>
      {showName && <span className="mh-prb-tag" aria-hidden="true"><span className="mh-prb-kind">{tier.name}</span><span className="mh-prb-name">{k.label}</span></span>}
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

// 上の帯に入れる細い1行(2026-10-29 社長「立ち絵が小さくなるのはだめ」→ 上の帯に横長で薄く)。小さいバッジ・細い棒・次まで。
// 次のごほうびは帯には入れない(社長「トップに要らなければ詳しい所だけ」。ヘルプと曲の結果で見せる)
function PlayerRankStrip({ kind = 'beat', xp = 0 }) {
  const k = playerRankKind(kind);
  const info = playerRankInfo(xp);
  return (
    <div data-player-rank-strip={kind} className="flex min-w-0 items-center gap-1.5">
      <PlayerRankBadge kind={kind} rank={info.rank} size="sm"/>
      <div className="h-1.5 min-w-[40px] flex-1 overflow-hidden rounded-full bg-slate-700/80" role="progressbar" aria-label="次のランクまで" aria-valuemin={0} aria-valuemax={info.need} aria-valuenow={info.into}>
        <i className={`block h-full rounded-full bg-gradient-to-r ${k.bar}`} style={{ width: `${Math.min(100, Math.round((info.into / info.need) * 100))}%` }}/>
      </div>
      <small className="shrink-0 whitespace-nowrap text-[9px] font-black text-slate-300 tabular-nums">{`次まで ${(info.need - info.into).toLocaleString()}`}</small>
    </div>
  );
}

// ランクが上がったときの演出。gains は [{ icon, text }](もらった物。カードは引く券・枠が増える知らせなど)
function PlayerRankUp({ kind = 'beat', from = 1, to = 1, gains = [] }) {
  if (!(to > from)) return null;
  return (
    <div data-player-rank-up={kind} className="rounded-2xl border-2 border-fuchsia-300 bg-gradient-to-b from-violet-700/80 to-indigo-950/90 px-3 py-2 text-center">
      <small className="block text-[10px] font-black tracking-[.2em] text-fuchsia-100">RANK UP!</small>
      <div className="mt-0.5 flex items-center justify-center gap-2">
        <PlayerRankBadge kind={kind} rank={from} size="sm" showName={false}/>
        <span aria-hidden="true" className="font-black text-fuchsia-200">→</span>
        <PlayerRankBadge kind={kind} rank={to} size="lg"/>
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
// award: { add, parts:[{label,xp}], from, to, xp(足したあとの合計), gains:[{icon,text}] }。next は次のごほうびの文(「ランク20で ビートP 300」)
function PlayerRankGain({ kind = 'beat', award, next = '' }) {
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
      {next && <p data-player-rank-gain-next className="text-[10px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(`次は ${next}`)}</p>}
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
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <PlayerRankBadge kind={kind} rank={rank} size="sm" showName={false}/>
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
        ? <p className="py-4 text-center text-xs font-black text-slate-400" style={JA_WRAP_STYLE}>{jaWrap(`まだだれも載っていません。${kind === 'card' ? 'MFバトルカードで対戦する' : '曲を遊ぶ'}と、ここに載ります。`)}</p>
        : <ol className="space-y-1.5">{board.top.map((e, i) => <PlayerRankRow key={e.breederId || i} kind={kind} place={i + 1} icon={iconOf(e)} name={e.name} rank={e.rank} xp={e.xp} mine={!!selfId && e.breederId === selfId}/>)}</ol>}
      {!inTop && (board.mine
        ? <ol className="border-t border-white/10 pt-2"><PlayerRankRow kind={kind} place={board.mine.place} icon={iconOf(board.mine)} name={board.mine.name} rank={board.mine.rank} xp={board.mine.xp} mine/></ol>
        : selfXp > 0 && <p className="border-t border-white/10 pt-2 text-center text-[10px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap(`あなたの記録は、次に${kind === 'card' ? 'ランクが上がった' : '曲を遊んだ'}ときに載ります。`)}</p>)}
    </div>
  );
}
