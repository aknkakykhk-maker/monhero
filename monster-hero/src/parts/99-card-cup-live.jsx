// ===== MFバトルカード 個人杯: リアルタイム杯の開催(2026-10-31 ブレイブくん・個人杯の④) =====
// 仕様: docs/spec/CARD_CUP.md「リアルタイム杯」/ 進め方: docs/progress/card-tournament/personal-cup/LIVE.md
//   杯の画面(99-card-cup の CardCupDetail)の中に出す。集合 → 始める → 自分の次の試合 → 開催中の表
//   ・集合は始まる10分前から。来ていない人の試合は、その人の登録デッキが自動で戦う
//   ・始まる時刻を過ぎたら、開いている参加者のだれかの端末が始める(card_cup_live_start。何度呼ばれても同じ)。全員そろえば主催が早めに始められる
//   ・開いているあいだ、様子を読み直す(8秒おき)。片方だけが結果を送った試合も決める(card_cup_live_settle・30秒おき)
//   ・「試合へ」(onPlay・84): 相手が来ていなければ、相手の登録デッキの写しと戦う(absent)。来ていれば、91 の部屋(CARD_PVP.cup・合言葉8文字)で2台で戦う(pvp)
//   ・2人とも来ていない試合・2台の答えが食い違った試合は、来ている参加者の端末が写しどうしを回して決める(auto)。
//     回し方はサーバ(cup.js の runLiveCups)と同じ cardTourPlay・種は試合の種・key は「杯|回戦|枠」なので、だれが回しても同じ結果

const CARD_CUP_LIVE_CHECKIN_MS = 10 * 60000; // 集合は始まる何分前から
const CARD_CUP_LIVE_POLL_MS = 8000;
const CARD_CUP_LIVE_SETTLE_MS = 30000;

// 自分の席と、次の試合(まだ決まっていない、いちばん早い回戦の自分の試合)。トーナメントで自分の試合が無い回戦は不戦勝
const cardCupLiveNext = (v) => {
  const me = v.entries.find((e) => e.mine);
  const seat = me && Number.isInteger(me.seat) ? me.seat : null;
  if (seat === null) return { seat: null, match: null, out: false };
  const mineAll = v.matches.filter((m) => m.a === seat || m.b === seat).sort((x, y) => (x.round - y.round) || (x.slot - y.slot));
  const match = mineAll.find((m) => m.winner === null) || null;
  // トーナメントで負けたら、そこで終わり
  const out = v.cup.format === 'ko' && mineAll.some((m) => m.winner !== null && (m.winner === 0 ? m.a : m.b) !== seat);
  return { seat, match, out };
};
const cardCupLiveMsg = {
  checkin: { ok: '集合しました', early: 'まだ集合できません(始まる10分前から)', closed: 'この個人杯は終わりました', none: 'デッキを登録した端末でだけ集合できます', bad: '集合できませんでした' },
  start: { ok: '始まりました', early: 'まだ始められません', wait: '全員が集合したら、早めに始められます', few: '人数が足りなかったため、中止になりました', none: 'デッキを登録した端末でだけ始められます', closed: 'この個人杯は終わりました', bad: '始められませんでした' },
};

const CardCupLivePanel = ({ v, now, selfId, onChanged, onPlay = null }) => {
  const c = v.cup;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const startTried = useRef(false);
  const call = async (fn, extra = {}) => {
    const key = await cardShareOwnerKey(false);
    if (!key || !selfId) return 'none';
    return cardTourRpc(fn, { p_cup: c.id, p_owner: selfId, p_key: key, ...extra });
  };
  const act = async (fn, kind) => {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const r = await call(fn);
      setMsg(cardCupLiveMsg[kind][r] || '通信できませんでした。もう一度お試しください');
      await onChanged();
    } finally { setBusy(false); }
  };
  const live = c.status === 'entry' || c.status === 'running';
  // 開いているあいだ読み直す(始まる15分前から)
  useEffect(() => {
    if (!live || now < c.startAt - CARD_CUP_LIVE_CHECKIN_MS - 5 * 60000) return undefined;
    const t = setInterval(() => { void onChanged(); }, CARD_CUP_LIVE_POLL_MS);
    return () => clearInterval(t);
  }, [live, c.id]);
  // 始まる時刻を過ぎたら、だれかの端末が始める(何度呼ばれても同じ)
  useEffect(() => {
    if (c.status !== 'entry' || !v.me || now < c.startAt || startTried.current) return;
    startTried.current = true;
    void call('card_cup_live_start').then(() => onChanged());
  }, [c.status, v.me, now >= c.startAt]);
  // 2人とも来ていない試合・食い違った試合を、来ている自分の端末で回して決める(同じ試合はこの画面で1回だけ試す)
  const autoTried = useRef(new Set());
  useEffect(() => {
    if (c.status !== 'running' || !selfId || typeof cardTourPlay !== 'function') return;
    const meE = v.entries.find((e) => e.mine);
    if (!meE || !meE.checkin) return;
    const here = (s) => { const e = v.entries.find((x) => x.seat === s); return !!(e && e.checkin); };
    const todo = v.matches.filter((m) => m.winner === null && m.ready && !autoTried.current.has(m.id) && (m.dispute || (!here(m.a) && !here(m.b))));
    if (!todo.length) return;
    todo.forEach((m) => autoTried.current.add(m.id));
    void (async () => {
      const key = await cardShareOwnerKey(false);
      if (!key) return;
      let done = 0;
      for (const m of todo) {
        const r = await cardTourRpc('card_cup_live_match', { p_match: m.id, p_owner: selfId, p_key: key });
        if (!r || !r.a_side || !r.b_side || !r.a_side.deck || !r.b_side.deck) continue;
        const res = cardTourPlay(CARD_BATTLE_DATA, { deck: r.a_side.deck, tactics: r.a_side.tactics || {} }, { deck: r.b_side.deck, tactics: r.b_side.tactics || {} },
          { seed: r.seed, first: r.first, key: `${c.id}|${r.round}|${r.slot}` });
        const out = await cardTourRpc('card_cup_live_report', { p_match: m.id, p_owner: selfId, p_key: key, p_winner: res.winner, p_how: 'auto', p_verified: false,
          p_kos: res.kos, p_acts: res.acts, p_rules: res.rules });
        if (out === 'ok') done += 1;
      }
      if (done) void onChanged();
    })();
  }, [c.status, v.matches, selfId]);
  // 片方だけが結果を送った試合を決める
  useEffect(() => {
    if (c.status !== 'running') return undefined;
    const t = setInterval(() => { void cardTourRpc('card_cup_live_settle', { p_cup: c.id }).then((n) => { if (n > 0) void onChanged(); }); }, CARD_CUP_LIVE_SETTLE_MS);
    return () => clearInterval(t);
  }, [c.status, c.id]);
  if (!live) return null;
  const meE = v.entries.find((e) => e.mine) || null;
  const host = selfId && c.hostId === selfId;
  const canCheckin = v.me && meE && !meE.checkin && now >= c.startAt - CARD_CUP_LIVE_CHECKIN_MS;
  const here = v.entries.filter((e) => e.checkin).length;
  const allHere = v.entries.length >= 2 && here === v.entries.length;
  const next = c.status === 'running' ? cardCupLiveNext(v) : null;
  const bySeat = (s) => v.entries.find((e) => e.seat === s) || null;
  const foe = next && next.match ? bySeat(next.match.a === next.seat ? next.match.b : next.match.a) : null;
  const roundText = (m) => (c.format === 'ko'
    ? (() => { const total = c.bracket && c.bracket[0] ? Math.round(Math.log2(c.bracket[0].length * 2)) : 0;
      return m.round === total - 1 ? '決勝' : m.round === total - 2 ? '準決勝' : `${m.round + 1}回戦`; })()
    : `${m.round + 1}回戦`);
  return (
    <div data-card-cup-live={c.status} className="space-y-2 rounded-2xl border-2 border-sky-500/60 bg-slate-950/70 p-3">
      {c.status === 'entry' && (
        <>
          <b className="block text-[14px] font-black text-sky-200">{now < c.startAt ? `${cardTourTimeLabel(c.startAt)} に始まります` : 'まもなく始まります'}</b>
          <div data-card-cup-live-here className="text-[12px] font-bold text-slate-200" style={JA_WRAP_STYLE}>
            {jaWrap(`集合 ${here}/${v.entries.length}人。始まる10分前から集合できます。来られない人の試合は、その人の登録デッキが代わりに自動で戦います`)}
          </div>
          {v.me && meE && meE.checkin && <div data-card-cup-live-checked className="rounded-xl bg-emerald-900/50 p-2 text-[13px] font-black text-emerald-200">集合しました。始まるまでこの画面で待っていてください</div>}
          {v.me && meE && !meE.checkin && (
            <button type="button" data-card-cup-live-checkin disabled={busy || !canCheckin} onClick={() => { Audio_.fgSe.tap(); void act('card_cup_live_checkin', 'checkin'); }}
              className={`w-full rounded-2xl py-3 text-[15px] font-black ${canCheckin ? 'bg-gradient-to-b from-sky-300 to-sky-600 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
              {canCheckin ? '集合する' : `集合は ${cardTourTimeLabel(c.startAt - CARD_CUP_LIVE_CHECKIN_MS)} から`}
            </button>
          )}
          {host && now < c.startAt && allHere && now >= c.startAt - CARD_CUP_LIVE_CHECKIN_MS && (
            <button type="button" data-card-cup-live-start disabled={busy} onClick={() => { Audio_.fgSe.tap(); void act('card_cup_live_start', 'start'); }}
              className="w-full rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 py-3 text-[15px] font-black text-slate-950">全員そろったので始める</button>
          )}
        </>
      )}
      {c.status === 'running' && next && (
        <div data-card-cup-live-next className="space-y-1.5">
          {next.seat === null && <div className="text-[13px] font-bold text-slate-200">開催中です。試合のようすは下の表で見られます</div>}
          {next.seat !== null && next.out && <div data-card-cup-live-out className="rounded-xl bg-slate-800 p-2 text-[13px] font-black text-slate-200">あなたの試合は終わりました。ほかの試合の結果を待っています</div>}
          {next.seat !== null && !next.out && !next.match && <div className="rounded-xl bg-slate-800 p-2 text-[13px] font-black text-slate-200">{c.format === 'ko' ? 'この回戦は不戦勝です。次の回戦を待っています' : 'あなたの試合は全部終わりました。ほかの試合の結果を待っています'}</div>}
          {next.match && (
            <>
              <b className="block text-[14px] font-black text-sky-200">{`あなたの次の試合: ${roundText(next.match)}`}</b>
              <div className="flex items-center gap-2 rounded-xl bg-slate-900 p-2">
                <span className="min-w-0 flex-1 truncate text-[14px] font-black text-white">{`相手: ${foe ? foe.name : 'ブリーダー'}`}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${foe && foe.checkin ? 'bg-emerald-500 text-slate-950' : 'bg-slate-600 text-slate-100'}`}>{foe && foe.checkin ? '来ています' : '来ていません'}</span>
              </div>
              <div className="text-[12px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(foe && foe.checkin
                ? 'マルチ対戦の部屋で、相手と2人で戦います(相手が2分たっても部屋に来なければ、相手の登録デッキと戦います)'
                : '相手が来ていないので、相手の登録デッキと戦います')}</div>
              <button type="button" data-card-cup-live-play={next.match.id} disabled={!next.match.ready || !onPlay} onClick={() => { Audio_.fgSe.tap(); if (onPlay) onPlay(next.match); }}
                className={`w-full rounded-2xl py-3 text-[15px] font-black ${next.match.ready && onPlay ? 'bg-gradient-to-b from-sky-300 to-sky-600 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                {!next.match.ready ? '前の回戦が終わるのを待っています' : !onPlay ? '試合の画面は準備中です' : foe && foe.checkin ? '試合へ(相手と2人で戦う)' : '試合へ'}
              </button>
            </>
          )}
        </div>
      )}
      {c.status === 'running' && c.format === 'ko' && typeof CardCupBracket === 'function' && <CardCupBracket rounds={c.bracket} matches={v.matches} entries={v.entries} done/>}
      {c.status === 'running' && c.format === 'rr' && typeof CardTourGrid === 'function' && typeof cardCupAsTourView === 'function' && <CardTourGrid view={cardCupAsTourView(v)} stage="group" grp={0} known={null} now={now}/>}
      {msg && <p data-card-cup-live-msg className="rounded-xl bg-slate-900 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
    </div>
  );
};
