// ===== MFバトルカード大会: 画面(2026-10-30 ルールくん・大会 PR3) =====
// 仕様: docs/progress/card-tournament/plan/README.md / サーバ: docs/spec/CARD_TOURNAMENT.md
//   入口(対戦えらびの「大会」)→ 大会の一覧 → 1つの大会: 受付中はエントリー、始まったら 対戦表・試合・順位(終わったらごほうび)
//   ・エントリーするのは「デッキ登録」(95)で登録した1組。締め切りでサーバが写しを取る。持ち主の見分けは登録と同じ鍵(mh_card_deck_owner_key_v1)
//   ・試合はサーバが回す。結果は表の「見せてよい時刻」(その日の 4:00)を過ぎた物だけ返ってくる
//   ・見返しの入口(onOpenReplay)は PR4(リプレイくん)。渡されないうちは「準備中」
//   ・まだ会っていない助手は、顔と名前を出さない(ネタバレ)
//   ・表が無い・通信できないときは「準備中」と出して何もしない

// 公開の印。告知(PR5)と同じ日に true にする。それまではデバッグ設定から入ったときだけ入口が出る
const cardTourOpen = () => false;
// 受け取ったごほうびの記録(新しいキー。[{ id, place, point, title, frame, at }]・新しい100件まで)。ビートPと同じ取引で保存する
const CARD_TOUR_CLAIMED_KEY = 'mh_card_tour_claimed_v1';
const cardTourNormalizeClaimed = (v) => {
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v)) return null; // 壊れているときは足さない(二重に足さないため)
  const num = (x) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
  return v.filter((x) => x && typeof x.id === 'string' && /^[a-z0-9_-]{1,32}$/.test(x.id))
    .map((x) => ({ id: x.id, place: Number.isInteger(x.place) && x.place > 0 ? x.place : null, point: num(x.point),
      title: typeof x.title === 'string' ? x.title.slice(0, 40) : '', frame: typeof x.frame === 'string' ? x.frame.slice(0, 40) : '', at: num(x.at) }))
    .slice(-100);
};

let _cardTourUnavailable = false;
const cardTourRpc = async (fn, body) => {
  if (_cardTourUnavailable) return null;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => { if (controller) controller.abort(); }, 8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: SB_HEADERS, signal: controller ? controller.signal : undefined, body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) { if (_isMissingTableError(res.status, text) || res.status === 404) _cardTourUnavailable = true; return null; }
    try { return JSON.parse(text); } catch (_) { return text; }
  } catch (_) { return null; } finally { clearTimeout(timer); }
};

// ---- 日付(日本時間) ----
const cardTourJstDay = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const cardTourAddDays = (ymd, n) => cardTourJstDay(Date.parse(`${ymd}T00:00:00+09:00`) + n * 86400000);
const cardTourDayLabel = (ymd) => {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}(${'日月火水木金土'[new Date(`${ymd}T00:00:00Z`).getUTCDay()]})`;
};
const cardTourTimeLabel = (ms) => {
  const d = new Date(ms + 9 * 3600000);
  return `${cardTourDayLabel(d.toISOString().slice(0, 10))} ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

// ---- 表の答えを、画面で使う形へ(壊れた物ははぶく) ----
const cardTourDate = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
const cardTourInt = (v) => (Number.isInteger(v) ? v : null);
const cardTourNormalizeTour = (t) => {
  if (!t || typeof t.id !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(t.id)) return null;
  const until = Date.parse(t.entry_until);
  if (!Number.isFinite(until) || !['entry', 'group', 'final', 'done'].includes(t.status)) return null;
  return { id: t.id, name: typeof t.name === 'string' && t.name ? t.name.slice(0, 40) : 'MFバトルカード大会', openOn: cardTourDate(t.open_on), entryUntil: until,
    status: t.status, firstDay: cardTourDate(t.first_day), doneDay: cardTourDate(t.done_day), groups: cardTourInt(t.groups),
    rewards: cardTourNormalizeRewards(t.rewards), players: Number.isInteger(t.players) && t.players >= 0 ? t.players : null };
};
const cardTourNormalizeView = (v) => {
  const tour = v && cardTourNormalizeTour(v.tour);
  if (!tour) return null;
  const entries = (Array.isArray(v.entries) ? v.entries : []).filter((e) => e && typeof e.seat_id === 'string').map((e) => ({
    seatId: e.seat_id, mine: e.mine === true, assist: e.is_assist === true, assistId: typeof e.assist_id === 'string' ? e.assist_id : null,
    name: typeof e.user_name === 'string' && e.user_name ? e.user_name.slice(0, 40) : 'ブリーダー',
    monsters: Array.isArray(e.monsters) ? e.monsters.filter((x) => typeof x === 'string').slice(0, 3) : [],
    grp: cardTourInt(e.grp), seat: cardTourInt(e.seat), finalSeat: cardTourInt(e.final_seat), place: cardTourInt(e.place), wins: cardTourInt(e.wins) }));
  const matches = (Array.isArray(v.matches) ? v.matches : []).filter((m) => m && Number.isFinite(Number(m.id)) && (m.stage === 'group' || m.stage === 'final')).map((m) => {
    const live = m.live && typeof m.live === 'object' ? m.live : null;
    return { id: Number(m.id), stage: m.stage, grp: cardTourInt(m.grp) || 0, day: cardTourInt(m.day) || 0, a: cardTourInt(m.a), b: cardTourInt(m.b),
      playOn: cardTourDate(m.play_on), visibleAt: Date.parse(m.visible_at) || 0,
      winner: m.winner === 0 || m.winner === 1 ? m.winner : null, kos: Array.isArray(m.kos) ? m.kos.slice(0, 2).map((k) => (Number.isInteger(k) ? k : 0)) : null,
      decided: typeof m.decided === 'string' ? m.decided : null,
      live: live && typeof live.play === 'string' ? { who: typeof live.who === 'string' ? live.who : null, play: live.play.slice(0, 200), review: typeof live.review === 'string' ? live.review.slice(0, 240) : '' } : null };
  }).filter((m) => m.a !== null && m.b !== null);
  return { tour, me: v.me === true, entries, matches };
};

// ---- 表と話す ----
const cardTourFetchList = async () => {
  const rows = await cardTourRpc('card_tournament_list', {});
  return Array.isArray(rows) ? rows.map(cardTourNormalizeTour).filter(Boolean) : null;
};
const cardTourFetchView = async (tourId, ownerId) => cardTourNormalizeView(await cardTourRpc('card_tournament_view', { p_tour: tourId, p_owner: ownerId || '' }));

// 段(組の総当たり・頂上決戦)ごとの席と試合
const cardTourStageSeats = (view, stage, grp) => view.entries
  .filter((e) => (stage === 'final' ? e.finalSeat !== null : e.grp === grp && e.seat !== null))
  .sort((x, y) => (stage === 'final' ? x.finalSeat - y.finalSeat : x.seat - y.seat));
const cardTourStageMatches = (view, stage, grp) => view.matches.filter((m) => m.stage === stage && (stage === 'final' || m.grp === grp));
const cardTourSeatKey = (e, stage) => (stage === 'final' ? e.finalSeat : e.seat);

// 助手の席の見せ方(まだ会っていない助手は「助手」とだけ出す)
const cardTourAssistOf = (id, known) => {
  const a = typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS) ? ASSISTANTS.find((x) => x.id === id) : null;
  if (!a || !(known && known.has(id))) return { name: '助手', face: null };
  return { name: a.name, face: typeof assistantFaceImage === 'function' ? assistantFaceImage(a, 'normal') : null };
};
const CardTourFace = ({ e, known }) => {
  if (e.assist) {
    const a = cardTourAssistOf(e.assistId, known);
    return a.face ? <img src={a.face} alt="" aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full border-2 border-amber-300/80 bg-slate-900 object-cover object-top"/>
      : <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-amber-300/80 bg-slate-800 text-[15px]">?</span>;
  }
  const db = typeof CARD_BATTLE_DATA !== 'undefined' ? CARD_BATTLE_DATA : null;
  const m = db && e.monsters[0] ? cardMonsterOf(db, e.monsters[0]) : null;
  return m ? <img src={CARD_IMG(m.img)} alt="" aria-hidden="true" className="h-9 w-9 shrink-0 rounded-full border-2 border-amber-300/80 bg-slate-900 object-cover object-top"/>
    : <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-amber-300/80 bg-slate-800 text-[15px]">🃏</span>;
};
const cardTourNameOf = (e, known) => { if (!e.assist) return e.name; const n = cardTourAssistOf(e.assistId, known).name; return n === '助手' ? n : `${n}(助手)`; };
const CardTourWho = ({ e, known }) => (
  <span className={`flex min-w-0 items-center gap-1.5 rounded-xl px-1.5 py-1 ${e.mine ? 'bg-amber-300/25' : 'bg-white/5'}`}>
    <CardTourFace e={e} known={known}/>
    <b className="min-w-0 truncate text-[13px] font-black text-white">{e.mine ? 'あなた' : cardTourNameOf(e, known)}</b>
  </span>
);

// ---- 大会の見出し(名前・日程・状態) ----
const cardTourStatusText = (t, now) => {
  if (t.status === 'entry') return now < t.entryUntil ? 'エントリー受付中' : '組み合わせを作っています';
  if (t.status === 'done') return '大会終了';
  return t.status === 'final' ? '頂上決戦' : '総当たり';
};
const CardTourHeadCard = ({ t, now }) => {
  const firstDay = t.firstDay || cardTourJstDay(t.entryUntil + 1000);
  return (
    <div data-card-tour-head className="rounded-2xl border-2 border-amber-600/60 bg-indigo-950/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <b className="min-w-0 flex-1 truncate text-[17px] font-black text-amber-100">{t.name}</b>
        <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-slate-950">{cardTourStatusText(t, now)}</span>
      </div>
      <div className="mt-1.5 space-y-0.5 text-[12px] font-bold text-slate-200" style={JA_WRAP_STYLE}>
        <div>{`受付: ${t.openOn ? `${cardTourDayLabel(t.openOn)} 0:00` : ''}〜${cardTourTimeLabel(t.entryUntil - 60000)}`}</div>
        <div>{`対戦: ${cardTourDayLabel(firstDay)}から毎日1試合${t.doneDay ? `(${cardTourDayLabel(t.doneDay)}まで)` : ''}`}</div>
        <div className="text-slate-400">{jaWrap('試合はサーバで自動で行われ、その日の結果は 4:00 に出ます')}</div>
      </div>
    </div>
  );
};

// ---- エントリー(受付中) ----
const CardTourEntry = ({ t, view, now, mine, selfId, onChanged, onOpenRegister }) => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const open = t.status === 'entry' && now < t.entryUntil;
  const act = async (fn) => {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const key = await cardShareOwnerKey(false);
      if (!key || !selfId) { setMsg('デッキを登録した端末でだけ、エントリーできます'); return; }
      const r = await cardTourRpc(fn, { p_tour: t.id, p_owner: selfId, p_key: key });
      const text = {
        ok: fn === 'card_tournament_enter' ? 'エントリーしました。受付が終わるまでは、デッキ登録でデッキと戦術カードを変えられます' : 'エントリーを取り消しました',
        closed: '受付は終わりました', nodeck: 'デッキ登録で、デッキを登録するとエントリーできます', locked: 'デッキを登録した端末でだけ、エントリーできます',
        none: 'エントリーしていません', bad: 'エントリーできませんでした',
      }[r];
      setMsg(text || '通信できませんでした。もう一度お試しください');
      if (r === 'ok') await onChanged();
    } finally { setBusy(false); }
  };
  const smart = mine && typeof cardShareSmartText === 'function' ? cardShareSmartText(mine.tactics) : '';
  return (
    <div data-card-tour-entry className="space-y-2">
      <div className="rounded-2xl border-2 border-amber-600/60 bg-slate-950/70 p-3">
        <b className="block text-[14px] font-black text-amber-200">エントリーするデッキ</b>
        {mine ? (
          <div className="mt-1.5 flex items-center gap-2">
            {typeof CardShareDeckThumbs === 'function' && <CardShareDeckThumbs entry={mine}/>}
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[15px] font-black text-white">{(mine.tactics && mine.tactics.name) || '登録したデッキ'}</b>
              {smart && <small className="block text-[11px] font-black text-amber-200">{`賢さ ${smart}`}</small>}
            </span>
          </div>
        ) : <p className="mt-1 text-[13px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap('「デッキ登録」で登録したデッキで出ます。まだ登録していません')}</p>}
        <p className="mt-2 text-[12px] font-bold leading-relaxed text-slate-300" style={JA_WRAP_STYLE}>
          {jaWrap('・受付が終わるまでは、デッキ登録でデッキと戦術カードを何度でも変えられます')}<br/>
          {jaWrap('・受付が終わると、そのときのデッキと戦術カードで最後まで戦います(あとで変えても大会には影響しません)')}
        </p>
        {Number.isInteger(t.players) && <p className="mt-1 text-[12px] font-black text-amber-100">{`いまのエントリー: ${t.players}人`}</p>}
      </div>
      {view && view.me && <p data-card-tour-entered className="rounded-xl bg-emerald-900/70 p-2 text-center text-[13px] font-black text-emerald-100">エントリーしています</p>}
      {msg && <p data-card-tour-msg className="rounded-xl bg-slate-900 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
      {open && mine && !(view && view.me) && <button type="button" data-card-tour-enter disabled={busy} onClick={() => { Audio_.fgSe.tap(); void act('card_tournament_enter'); }} className="w-full rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 py-3 text-[16px] font-black text-slate-950 disabled:opacity-50">このデッキでエントリーする</button>}
      {open && view && view.me && <button type="button" data-card-tour-withdraw disabled={busy} onClick={() => { Audio_.fgSe.tap(); void act('card_tournament_withdraw'); }} className="w-full rounded-2xl border-2 border-slate-500 bg-slate-800 py-2.5 text-[14px] font-black text-slate-100 disabled:opacity-50">エントリーを取り消す</button>}
      {onOpenRegister && <button type="button" data-card-tour-register onClick={() => { Audio_.fgSe.tap(); onOpenRegister(); }} className="w-full rounded-2xl border-2 border-amber-500/70 bg-amber-100 py-2.5 text-[14px] font-black text-amber-900">{mine ? 'デッキと戦術カードを変える' : 'デッキを登録する'}</button>}
    </div>
  );
};

// ---- 対戦表(段ごと) ----
const CardTourGrid = ({ view, stage, grp, known, now }) => {
  const seats = cardTourStageSeats(view, stage, grp);
  const ms = cardTourStageMatches(view, stage, grp);
  const size = seats.length;
  if (!size) return null;
  const shown = ms.filter((m) => m.winner !== null && m.visibleAt <= now);
  const { rank, rec } = cardTourStandings(size, shown.map((m) => ({ a: m.a, b: m.b, winner: m.winner, kos: m.kos })));
  const cell = (i, j) => {
    if (i === j) return <span className="block h-full w-full bg-[linear-gradient(to_top_right,transparent_calc(50%-1px),rgba(148,163,184,.6),transparent_calc(50%+1px))]"/>;
    const m = ms.find((x) => (x.a === i && x.b === j) || (x.a === j && x.b === i));
    if (!m) return null;
    if (m.winner === null || m.visibleAt > now) return <span className="text-[9px] font-black text-slate-400">{cardTourDayLabel(m.playOn).replace(/\(.\)$/, '')}</span>;
    const won = (m.winner === 0 ? m.a : m.b) === i;
    return <span className={`text-[16px] font-black ${won ? 'text-rose-400' : 'text-sky-400'}`}>{won ? '○' : '×'}</span>;
  };
  return (
    <div data-card-tour-grid={`${stage}-${grp}`} className="space-y-2">
      <div className="overflow-x-auto rounded-2xl bg-slate-950/70 p-2">
        <table className="w-full border-separate border-spacing-[3px]">
          <thead><tr><th/>{seats.map((_, j) => <th key={j} className="text-[12px] font-black text-amber-200">{j + 1}</th>)}</tr></thead>
          <tbody>{seats.map((e, i) => (
            <tr key={e.seatId}>
              <td className="max-w-[118px]"><span className="flex items-center gap-1"><b className="w-4 shrink-0 text-center text-[12px] font-black text-amber-200">{i + 1}</b><CardTourWho e={e} known={known}/></span></td>
              {seats.map((_, j) => <td key={j} className="h-9 w-9 min-w-[34px] rounded-md border border-slate-600 bg-slate-900 p-0 text-center align-middle">{cell(i, j)}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div className="rounded-2xl bg-slate-950/70 p-2.5 text-[12px] font-bold text-slate-200" style={JA_WRAP_STYLE}>
        <b className="text-amber-200">いまの順位 </b>
        {rank.map((s, k) => `${k + 1}位 ${seats[s].mine ? 'あなた' : cardTourNameOf(seats[s], known)}(${rec[s].wins}勝${rec[s].losses}敗)`).join(' ・ ')}
        <div className="mt-1 text-slate-400">{jaWrap('勝ち数が同じときは、倒したモンスターの数 → 2人の対戦の勝ち負け → エントリーの早さの順で決まります')}</div>
      </div>
    </div>
  );
};

// ---- 試合(発表ずみの最新の日と、次の日) ----
const CardTourMatchCard = ({ view, m, known, now, onOpenReplay }) => {
  const seats = cardTourStageSeats(view, m.stage, m.grp);
  const A = seats.find((e) => cardTourSeatKey(e, m.stage) === m.a), B = seats.find((e) => cardTourSeatKey(e, m.stage) === m.b);
  const [openReview, setOpenReview] = useState(false);
  // 見返しを開けなかったとき(通信できない・ルールの版がちがってはじめから当たらない など)の一言。null … 開いていない / 'busy' … 読み込み中
  const [replayMsg, setReplayMsg] = useState(null);
  if (!A || !B) return null;
  const done = m.winner !== null && m.visibleAt <= now;
  const caster = m.live && m.live.who ? cardTourAssistOf(m.live.who, known) : null;
  const matchLabel = `${m.stage === 'final' ? '頂上決戦 ' : view.tour.groups > 1 ? `${m.grp + 1}組 ` : ''}第${m.day - (m.stage === 'final' ? Math.min(...view.matches.filter((x) => x.stage === 'final').map((x) => x.day)) : 0) + 1}試合`;
  const openReplay = async () => {
    if (!onOpenReplay || replayMsg === 'busy') return;
    Audio_.fgSe.tap();
    setReplayMsg('busy');
    let ok = false;
    try { ok = await onOpenReplay(m.id, { title: `${view.tour.name || '大会'} ${matchLabel}` }); } catch (_) { ok = false; }
    setReplayMsg(ok === false ? 'この試合は、いまは見返せません。時間をおいて開き直してください' : null);
  };
  return (
    <div data-card-tour-match={m.id} className="rounded-2xl border-2 border-amber-600/50 bg-slate-950/70 p-2">
      <div className="mb-1 flex items-center justify-between text-[11px] font-black text-amber-200">
        <span>{`${matchLabel} ${cardTourDayLabel(m.playOn)}`}</span>
        {done && m.decided && <span className="text-slate-400">{m.decided === 'deck' ? '山札切れ' : m.decided === 'limit' ? '判定' : ''}</span>}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[A, B].map((e, k) => (
          <div key={k} className="min-w-0">
            <b className={`block text-center text-[13px] font-black italic ${!done ? 'text-slate-500' : m.winner === k ? 'text-orange-400' : 'text-sky-400'}`}>{!done ? '−' : m.winner === k ? 'WIN' : 'LOSE'}</b>
            <CardTourWho e={e} known={known}/>
          </div>
        ))}
      </div>
      {!done && <p className="mt-1.5 text-center text-[12px] font-black text-slate-400">{`結果は ${cardTourDayLabel(m.playOn)} の 4:00 に出ます`}</p>}
      {done && m.live && (
        <div className="mt-1.5 rounded-xl bg-white/5 p-2 text-[12px] font-bold leading-relaxed text-slate-100" style={JA_WRAP_STYLE}>
          <b className="text-amber-200">{`実況${caster ? `(${caster.name})` : ''} `}</b>{jaWrap(m.live.play)}
          {m.live.review && (openReview
            ? <div className="mt-1"><b className="text-amber-200">解説 </b>{jaWrap(m.live.review)}</div>
            : <button type="button" data-card-tour-review onClick={() => setOpenReview(true)} className="mt-1 block text-[11px] font-black text-amber-300 underline">解説を読む</button>)}
        </div>
      )}
      {done && (
        <button type="button" data-card-tour-replay disabled={!onOpenReplay || replayMsg === 'busy'} onClick={() => { void openReplay(); }}
          className="mt-1.5 w-full rounded-xl border-2 border-amber-500/70 bg-amber-100 py-1.5 text-[13px] font-black text-amber-900 disabled:opacity-50">{!onOpenReplay ? '見返す(準備中)' : replayMsg === 'busy' ? '読み込み中…' : '見返す'}</button>
      )}
      {done && replayMsg && replayMsg !== 'busy' && <p data-card-tour-replay-note className="mt-1 text-center text-[11px] font-bold text-amber-300" style={JA_WRAP_STYLE}>{jaWrap(replayMsg)}</p>}
    </div>
  );
};
const CardTourToday = ({ view, known, now, onOpenReplay }) => {
  const shownDays = [...new Set(view.matches.filter((m) => m.winner !== null && m.visibleAt <= now).map((m) => m.playOn))].sort();
  const lastShown = shownDays[shownDays.length - 1] || null;
  const nextDay = [...new Set(view.matches.filter((m) => !(m.winner !== null && m.visibleAt <= now)).map((m) => m.playOn))].sort()[0] || null;
  const mineFirst = (list) => list.slice().sort((x, y) => {
    const has = (m) => cardTourStageSeats(view, m.stage, m.grp).some((e) => e.mine && (cardTourSeatKey(e, m.stage) === m.a || cardTourSeatKey(e, m.stage) === m.b));
    return (has(y) - has(x)) || (x.grp - y.grp) || (x.id - y.id);
  });
  const block = (day, label) => day && (
    <div key={day} className="space-y-2">
      <b className="block rounded-xl bg-amber-500 px-2 py-1 text-center text-[13px] font-black text-slate-950">{`${cardTourDayLabel(day)} ${label}`}</b>
      {mineFirst(view.matches.filter((m) => m.playOn === day)).map((m) => <CardTourMatchCard key={m.id} view={view} m={m} known={known} now={now} onOpenReplay={onOpenReplay}/>)}
    </div>
  );
  if (!lastShown && !nextDay) return <ScreenEmpty emoji="🃏" lines={['試合はまだありません']}/>;
  return <div data-card-tour-today className="space-y-3">{block(lastShown, 'の結果')}{block(nextDay, 'の試合')}</div>;
};

// ---- 順位とごほうび(大会の終わり) ----
const cardTourRewardText = (r) => [r.title && `称号「${r.title}」`, r.frame && 'プロフィール枠', r.point > 0 && `ビートP ${r.point.toLocaleString()}`].filter(Boolean).join('・');
const CardTourResult = ({ view, known, claimed, onClaim }) => {
  const t = view.tour;
  const ranked = view.entries.filter((e) => e.place !== null).sort((x, y) => x.place - y.place);
  const others = view.entries.filter((e) => e.place === null);
  const me = view.entries.find((e) => e.mine);
  const myReward = me && !me.assist ? cardTourRewardOf(t.rewards, me.place, me.wins || 0) : null;
  const got = Array.isArray(claimed) ? claimed.find((c) => c.id === t.id) : null;
  return (
    <div data-card-tour-result className="space-y-2">
      <div className="rounded-2xl border-2 border-amber-600/60 bg-slate-950/70 p-2.5">
        <b className="block rounded-lg bg-amber-700/60 py-1 text-center text-[14px] font-black text-amber-100">最終順位</b>
        <div className="mt-1.5 space-y-1">
          {ranked.map((e) => (
            <div key={e.seatId} className="flex items-center gap-2">
              <b className={`w-9 shrink-0 text-center text-[15px] font-black ${e.place === 1 ? 'text-amber-300' : 'text-slate-200'}`}>{`${e.place}位`}</b>
              <span className="min-w-0 flex-1"><CardTourWho e={e} known={known}/></span>
              <small className="shrink-0 text-[11px] font-black text-slate-300">{`${e.wins || 0}勝`}</small>
            </div>
          ))}
          {others.length > 0 && <p className="pt-1 text-[12px] font-bold text-slate-300">{`ほか ${others.length}人(頂上決戦に出なかった人)`}</p>}
        </div>
      </div>
      {me && !me.assist && (
        <div data-card-tour-reward className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 text-center text-amber-950">
          <b className="block text-[15px] font-black">あなたのごほうび</b>
          <p className="mt-1 text-[13px] font-bold" style={JA_WRAP_STYLE}>{jaWrap(`${me.place ? `${me.place}位` : '参加賞'}・${me.wins || 0}勝: ${cardTourRewardText(myReward) || 'なし'}`)}</p>
          {got ? <p className="mt-2 text-[13px] font-black text-emerald-700">受け取りました</p>
            : <button type="button" data-card-tour-claim onClick={() => { Audio_.fgSe.tap(); void onClaim(); }} className="mt-2 w-full rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 py-2.5 text-[15px] font-black text-slate-950">ごほうびを受け取る</button>}
        </div>
      )}
    </div>
  );
};

// ---- 画面 ----
// onBack … 対戦えらびへ / onOpenRegister … デッキ登録へ / onOpenReplay(matchId) … 見返し(PR4。無いあいだは「準備中」)
// onCredit(tour, reward) … ビートPを足して受け取りの記録を保存する(84 の persist と同じ取引)。保存できたら true
// knownAssistants … 会ったことのある助手の id(Set)
const CardTournament = ({ onBack, onOpenRegister = null, onOpenReplay = null, onCredit = null, knownAssistants = null }) => {
  const [list, setList] = useState(undefined);  // undefined … 読み込み中 / null … 表が無い・通信できない
  const [tourId, setTourId] = useState(null);
  const [view, setView] = useState(null);
  const [tab, setTab] = useState('grid');
  const [stageKey, setStageKey] = useState(null); // 'g0' 'g1' … 'final'
  const [selfId, setSelfId] = useState(null);
  const [mine, setMine] = useState(undefined);
  const [claimed, setClaimed] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const now = Date.now();
  const known = knownAssistants instanceof Set ? knownAssistants : new Set();
  useEffect(() => {
    let alive = true;
    void (async () => {
      const id = typeof ensureBreederId === 'function' ? await ensureBreederId().catch(() => null) : null;
      const [l, m, c] = await Promise.all([cardTourFetchList(), id && typeof cardShareFetchMine === 'function' ? cardShareFetchMine(id).catch(() => null) : null,
        storeGet(CARD_TOUR_CLAIMED_KEY, null).catch(() => null)]);
      if (!alive) return;
      setSelfId(id); setMine(m || null); setClaimed(cardTourNormalizeClaimed(c) || []);
      setList(l);
      if (l && l.length === 1) setTourId(l[0].id);
    })();
    return () => { alive = false; };
  }, []);
  const reload = async (id = tourId) => {
    if (!id) return;
    const v = await cardTourFetchView(id, selfId);
    setView(v);
    if (v && v.tour.status === 'done') setTab((x) => (x === 'grid' ? 'result' : x));
  };
  useEffect(() => { setView(null); setStageKey(null); setMsg(''); if (tourId && selfId !== undefined) void reload(tourId); }, [tourId, selfId]);

  const claim = async () => {
    if (busy || !view || !onCredit) return;
    setBusy(true); setMsg('');
    try {
      const key = await cardShareOwnerKey(false);
      if (!key || !selfId) { setMsg('デッキを登録した端末でだけ、受け取れます'); return; }
      const r = await cardTourRpc('card_tournament_claim', { p_tour: view.tour.id, p_owner: selfId, p_key: key });
      const st = r && typeof r === 'object' ? r.status : null;
      if (st === 'ok') {
        const reward = { place: Number.isInteger(r.place) ? r.place : null, point: Number.isInteger(r.point) && r.point > 0 ? Math.min(100000, r.point) : 0,
          title: typeof r.title === 'string' ? r.title.slice(0, 40) : '', frame: typeof r.frame === 'string' ? r.frame.slice(0, 40) : '' };
        if (await onCredit(view.tour, reward)) {
          setClaimed(cardTourNormalizeClaimed(await storeGet(CARD_TOUR_CLAIMED_KEY, null).catch(() => null)) || []);
          setMsg(`ごほうびを受け取りました${reward.point ? `(ビートP +${reward.point.toLocaleString()})` : ''}`);
        } else setMsg('保存できませんでした。通信のよいところで、もう一度お試しください');
        return;
      }
      setMsg({ claimed: 'もう受け取っています', none: 'この大会のごほうびはありません', locked: 'デッキを登録した端末でだけ、受け取れます', wait: '大会が終わってから受け取れます' }[st] || '通信できませんでした。もう一度お試しください');
    } finally { setBusy(false); }
  };

  const shell = (children, title = 'MFバトルカード大会', back = onBack) => (
    <div data-mh-screen data-card-tour className={SCREEN_SHELL_CLASS}>
      <ScreenHead title={title} accent="text-amber-200" onBack={back} note="デッキ登録のデッキで出る大会。試合は毎日自動で行われます"/>
      <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>{children}</div>
    </div>
  );
  if (list === undefined) return shell(<ScreenEmpty emoji="⏳" lines={['読み込んでいます']}/>);
  if (list === null) return shell(<ScreenEmpty emoji="🛠️" lines={['大会は準備中です']}/>);
  if (!tourId) {
    if (!list.length) return shell(<ScreenEmpty emoji="🏆" lines={['いま開いている大会はありません', '次の大会はお知らせで案内します']}/>);
    return shell(list.map((t) => (
      <button key={t.id} type="button" data-card-tour-pick={t.id} onClick={() => { Audio_.fgSe.tap(); setTourId(t.id); }} className="block w-full text-left"><CardTourHeadCard t={t} now={now}/></button>
    )));
  }
  const backFromTour = list.length > 1 ? () => setTourId(null) : onBack;
  if (!view) return shell(<ScreenEmpty emoji="⏳" lines={['読み込んでいます']}/>, 'MFバトルカード大会', backFromTour);
  const t = view.tour;
  if (t.status === 'entry') return shell(<><CardTourHeadCard t={t} now={now}/><CardTourEntry t={t} view={view} now={now} mine={mine} selfId={selfId} onChanged={async () => { await reload(); const l = await cardTourFetchList(); if (l) setList(l); }} onOpenRegister={onOpenRegister}/></>, 'MFバトルカード大会', backFromTour);
  const stages = [...Array.from({ length: t.groups || 1 }, (_, g) => ({ key: `g${g}`, stage: 'group', grp: g, label: (t.groups || 1) > 1 ? `${g + 1}組` : '総当たり' })),
    ...(view.matches.some((m) => m.stage === 'final') ? [{ key: 'final', stage: 'final', grp: 0, label: '頂上決戦' }] : [])];
  const myStage = stages.find((s) => s.stage === 'final' && view.entries.some((e) => e.mine && e.finalSeat !== null))
    || stages.find((s) => view.entries.some((e) => e.mine && e.grp === s.grp && s.stage === 'group')) || stages[stages.length - 1];
  const st = stages.find((s) => s.key === stageKey) || myStage;
  const tabs = [['grid', '対戦表'], ['today', '試合'], ...(t.status === 'done' ? [['result', '結果']] : [])];
  return shell(<>
    <CardTourHeadCard t={t} now={now}/>
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
      {tabs.map(([k, label]) => <button key={k} type="button" data-card-tour-tab={k} onClick={() => { Audio_.fgSe.tap(); setTab(k); }} className={`rounded-xl py-2 text-[14px] font-black ${tab === k ? 'bg-gradient-to-b from-amber-300 to-orange-500 text-slate-950' : 'border-2 border-amber-500/60 bg-amber-100 text-amber-900'}`}>{label}</button>)}
    </div>
    {tab === 'grid' && stages.length > 1 && (
      <div className="flex flex-wrap gap-1">{stages.map((s) => <button key={s.key} type="button" data-card-tour-stage={s.key} onClick={() => setStageKey(s.key)} className={`rounded-full px-3 py-1 text-[12px] font-black ${s.key === st.key ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>{s.label}</button>)}</div>
    )}
    {tab === 'grid' && <CardTourGrid view={view} stage={st.stage} grp={st.grp} known={known} now={now}/>}
    {tab === 'today' && <CardTourToday view={view} known={known} now={now} onOpenReplay={onOpenReplay}/>}
    {tab === 'result' && <CardTourResult view={view} known={known} claimed={claimed} onClaim={claim}/>}
    {msg && <p data-card-tour-msg className="rounded-xl bg-slate-900 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
  </>, 'MFバトルカード大会', backFromTour);
};
