// ===== MFバトルカード 個人杯: 画面(2026-10-31 ルールくん・個人杯の3本目) =====
// 仕様: docs/spec/CARD_CUP.md / 案: docs/progress/card-tournament/personal-cup/README.md
//   入口(対戦えらびの「個人杯」)→ 公開の一覧・自分の杯・合言葉で探す・開く → 1つの杯: 参加者・参加と取り消し・結果
//   ・参加の条件はデッキ登録(2026-10-31 社長。来られないときは登録デッキが代わりに自動で戦う)。参加の画面 CardCupJoinPanel はリアルタイム杯(④)でも使う
//   ・杯の名前・主催名は cardChatMask(91 の悪い言葉の置き換え)を通して出す
//   ・結果: 総当たりは公式杯と同じ対戦表と「大会結果」の演出(99-card-tournament の CardTourGrid)、トーナメントは山の表と勝ち上がりの演出(CardCupBracket)
//   ・リアルタイム杯の試合の画面は④(別の部品ファイル)。ここは一覧・作る・参加・結果まで
//   ・表が無い・通信できないときは「準備中」と出して何もしない

// 公開の印。告知と同じ日に true にする。それまではデバッグ設定から入ったときだけ入口が出る
// 2026-10-31 社長「個人杯だけ先に公開」で true に。ごほうび・参加費・主催仲間は別の印(99-card-cup-prize の cardCupPrizeOpen。リプレイくん)で、まだ閉じたまま
const cardCupOpen = () => true;

const cardCupText = (t, n = 40) => {
  const s = String(t || '').slice(0, n);
  return typeof cardChatMask === 'function' ? cardChatMask(s) : s;
};
const cardCupNormalizeRow = (c) => {
  if (!c || typeof c.id !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(c.id)) return null;
  if (!['live', 'auto'].includes(c.mode) || !['rr', 'ko'].includes(c.format) || !['entry', 'running', 'done', 'closed'].includes(c.status)) return null;
  const at = (v) => Date.parse(v) || 0;
  return { id: c.id, name: cardCupText(c.name, 20) || '個人杯', hostId: typeof c.host_id === 'string' ? c.host_id : '', hostName: cardCupText(c.host_name, 40) || 'ブリーダー',
    mode: c.mode, format: c.format, max: Number.isInteger(c.max) ? c.max : 8, listed: c.listed !== false, status: c.status,
    entryUntil: at(c.entry_until), startAt: at(c.start_at), closedReason: typeof c.closed_reason === 'string' ? c.closed_reason : null,
    players: Number.isInteger(c.players) ? c.players : 0, code: typeof c.code === 'string' && /^[0-9]{6}$/.test(c.code) ? c.code : null,
    bracket: c.bracket && Array.isArray(c.bracket.rounds) ? c.bracket.rounds : null };
};
const cardCupNormalizeView = (v) => {
  const cup = v && cardCupNormalizeRow(v.cup);
  if (!cup) return null;
  const int = (x) => (Number.isInteger(x) ? x : null);
  const entries = (Array.isArray(v.entries) ? v.entries : []).filter((e) => e && typeof e.owner_id === 'string').map((e) => ({
    ownerId: e.owner_id, mine: e.mine === true, name: cardCupText(e.user_name, 40) || 'ブリーダー', assist: false,
    monsters: Array.isArray(e.monsters) ? e.monsters.filter((x) => typeof x === 'string').slice(0, 3) : [],
    seat: int(e.seat), place: int(e.place), wins: int(e.wins), checkin: e.checkin === true }));
  const matches = (Array.isArray(v.matches) ? v.matches : []).filter((m) => m && Number.isFinite(Number(m.id))).map((m) => ({
    id: Number(m.id), round: int(m.round) || 0, slot: int(m.slot) || 0, a: int(m.a), b: int(m.b), winner: m.winner === 0 || m.winner === 1 ? m.winner : null,
    ready: !!(m.live && m.live.ready_at), // リアルタイム杯: 戦える回戦か(④ 99-card-cup-live)
    dispute: !!(m.live && m.live.dispute), // リアルタイム杯: 2台の答えが食い違った(来ている人の端末が auto で決め直す)
    kos: Array.isArray(m.kos) ? m.kos.slice(0, 2).map((k) => (Number.isInteger(k) ? k : 0)) : null,
    live: m.live && typeof m.live.play === 'string' ? { who: typeof m.live.who === 'string' ? m.live.who : null, play: m.live.play.slice(0, 200), review: typeof m.live.review === 'string' ? m.live.review.slice(0, 240) : '' } : null }))
    .filter((m) => m.a !== null && m.b !== null);
  return { cup, me: v.me === true, entries, matches };
};

const cardCupList = async () => { const r = await cardTourRpc('card_cup_list', {}); return Array.isArray(r) ? r.map(cardCupNormalizeRow).filter(Boolean) : null; };
// あとから足した関数を呼ぶ口(関数がまだ無くても、ほかの通信を止めない。cardTourRpc は表が無いと分かると以後の通信をやめる)
const cardCupRpcSoft = async (fn, body) => {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: SB_HEADERS, body: JSON.stringify(body) });
    if (!res.ok) return null;
    return await res.json();
  } catch (_) { return null; }
};
const cardCupListDone = async () => { const r = await cardCupRpcSoft('card_cup_list_done', {}); return Array.isArray(r) ? r.map(cardCupNormalizeRow).filter(Boolean) : []; };
const cardCupMine = async (owner) => { const r = await cardTourRpc('card_cup_mine', { p_owner: owner || '' }); return Array.isArray(r) ? r.map(cardCupNormalizeRow).filter(Boolean) : null; };
// 自分が出ている杯 + 主催仲間として誘われている・入っている杯(99-card-cup-prize の card_cup_hosting_of。関数がまだ無ければ出ている杯だけ)
//   withHosting … ごほうび・参加費・主催仲間が出せるとき(84 が口を渡したとき)だけ、主催仲間の杯を混ぜる
const cardCupMineWithHosting = async (owner, withHosting = true) => {
  const [a, b] = await Promise.all([cardCupMine(owner), withHosting ? cardCupRpcSoft('card_cup_hosting_of', { p_owner: owner || '' }) : null]);
  if (!Array.isArray(a)) return a;
  const extra = (Array.isArray(b) ? b : []).map(cardCupNormalizeRow).filter((c) => c && !a.some((x) => x.id === c.id));
  return [...a, ...extra];
};
const cardCupFind = async (code) => cardCupNormalizeRow(await cardTourRpc('card_cup_find', { p_code: code }));
const cardCupView = async (id, owner) => cardCupNormalizeView(await cardTourRpc('card_cup_view', { p_cup: id, p_owner: owner || '' }));

const CARD_CUP_MODE_LABEL = Object.freeze({ live: 'リアルタイム', auto: 'オート' });
const CARD_CUP_FORMAT_LABEL = Object.freeze({ rr: '総当たり', ko: 'トーナメント' });
const cardCupStatusText = (c, now) => (c.status === 'entry' ? (now < c.entryUntil ? '募集中' : '締め切り') : c.status === 'running' ? '開催中' : c.status === 'done' ? (c.mode === 'auto' && now < c.startAt ? '発表待ち' : '終わり') : '中止');
const cardCupTimeText = (c) => (c.mode === 'auto'
  ? `締め切り ${cardTourTimeLabel(c.entryUntil)}・発表 ${cardTourTimeLabel(c.startAt)}`
  : `始まり ${cardTourTimeLabel(c.startAt)}`);

const CardCupRow = ({ c, now, onOpen }) => (
  <button type="button" data-card-cup-row={c.id} onClick={() => { Audio_.fgSe.tap(); onOpen(c.id); }} className="block w-full rounded-2xl border-2 border-amber-600/60 bg-indigo-950/60 p-2.5 text-left">
    <span className="flex items-center gap-2">
      <b className="min-w-0 flex-1 truncate text-[15px] font-black text-amber-100">{c.name}</b>
      <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-slate-950">{cardCupStatusText(c, now)}</span>
    </span>
    <span className="mt-0.5 block text-[12px] font-bold text-slate-200">{`${CARD_CUP_MODE_LABEL[c.mode]}・${CARD_CUP_FORMAT_LABEL[c.format]}・${c.players}/${c.max}人・主催 ${c.hostName}`}</span>
    <span className="block text-[11px] font-bold text-slate-400">{cardCupTimeText(c)}</span>
  </button>
);

// ---- 参加の画面(④のリアルタイム杯でも使う)----
// mine … 自分の登録デッキ(95 の cardShareFetchMine の形)/ null … 登録なし / undefined … 読み込み中
// onJoin … 参加する / onOpenRegister … デッキ登録へ(登録が済んだら、呼んだ側がこの画面へ戻す)/ busy … 送っている
const CardCupJoinPanel = ({ mine, onJoin, onOpenRegister, busy = false, label = 'このデッキで参加' }) => {
  if (mine === undefined) return <p className="text-[13px] font-bold text-slate-300">読み込んでいます</p>;
  if (!mine) {
    return (
      <div data-card-cup-join-nodeck className="space-y-2 rounded-2xl border-2 border-amber-500/70 bg-slate-950/70 p-3">
        <b className="block text-[14px] font-black text-amber-200">参加にはデッキ登録が必要です</b>
        <p className="text-[12px] font-bold leading-relaxed text-slate-200" style={JA_WRAP_STYLE}>{jaWrap('来られないときは、登録したデッキが代わりに自動で戦います。デッキ登録をしてから参加してください')}</p>
        {onOpenRegister && <button type="button" data-card-cup-register onClick={() => { Audio_.fgSe.tap(); onOpenRegister(); }} className="w-full rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 py-2.5 text-[15px] font-black text-slate-950">デッキを登録する</button>}
      </div>
    );
  }
  const smart = typeof cardShareSmartText === 'function' ? cardShareSmartText(mine.tactics) : '';
  return (
    <div data-card-cup-join className="space-y-2 rounded-2xl border-2 border-amber-600/60 bg-slate-950/70 p-3">
      <b className="block text-[14px] font-black text-amber-200">参加するデッキ</b>
      <div className="flex items-center gap-2">
        {typeof CardShareDeckThumbs === 'function' && <CardShareDeckThumbs entry={mine}/>}
        <span className="min-w-0 flex-1"><b className="block truncate text-[15px] font-black text-white">{(mine.tactics && mine.tactics.name) || '登録したデッキ'}</b>{smart && <small className="block text-[11px] font-black text-amber-200">{`賢さ ${smart}`}</small>}</span>
      </div>
      <p className="text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap('来られないときは、このデッキが代わりに自動で戦います')}</p>
      {onJoin && <button type="button" data-card-cup-join-go disabled={busy} onClick={() => { Audio_.fgSe.tap(); onJoin(); }} className="w-full rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 py-2.5 text-[15px] font-black text-slate-950 disabled:opacity-50">{label}</button>}
    </div>
  );
};

// ---- トーナメントの山と勝ち上がりの演出(社長の見本の動画「トーナメントイメージ」)----
//   山の左半分と右半分から勝ち上がり、真ん中の優勝カップへ。演出では1回戦から順に、勝った側の線が光って伸びる。「演出リプレイ」で見直せる
const CARD_CUP_BRACKET_GAP = 30; // 山の両側の線を、真ん中の優勝カップから離す幅(線とカップが重ならないように)
const CardCupBracket = ({ rounds, matches, entries, done }) => {
  const first = rounds && rounds[0];
  const size = first ? first.length * 2 : 0;
  const total = size ? Math.round(Math.log2(size)) : 0;
  const [lit, setLit] = useState(() => (done ? 0 : total)); // 光らせ終えた回戦の数
  useEffect(() => {
    if (lit >= total) return undefined;
    const t = setTimeout(() => setLit((x) => x + 1), lit === 0 ? 700 : 900);
    return () => clearTimeout(t);
  }, [lit, total]);
  if (!first) return null;
  const bySeat = (s) => entries.find((e) => e.seat === s) || null;
  // 回戦 r の k 番目の枠で勝った席(不戦勝は a)。決まっていなければ null
  const winOf = (r, k) => {
    const pair = rounds[r] && rounds[r][k];
    if (!pair) return null;
    if (pair[1] === null) return pair[0];
    const m = matches.find((x) => x.round === r && x.slot === k);
    return m && m.winner !== null ? (m.winner === 0 ? pair[0] : pair[1]) : null;
  };
  const champ = total && lit >= total ? winOf(total - 1, 0) : null;
  const H = Math.max(size, 2) * 38, W = 340, slotW = 112, half = size / 2;
  const leftSeats = first.slice(0, first.length / 2).flat(), rightSeats = first.slice(first.length / 2).flat();
  const yOf = (i, n) => 10 + (i + 0.5) * ((H - 20) / n);
  const lines = [];
  // 1回戦の席から、各回戦の勝ち上がりの線を引く(左右それぞれ)
  [0, 1].forEach((side) => {
    const dir = side ? -1 : 1, x0 = side ? W - slotW - 2 : slotW + 2;
    for (let r = 0; r < total - 1; r++) {
      const n = half / 2 ** r; // この回戦のこの側の席の数
      const step = (W / 2 - CARD_CUP_BRACKET_GAP - (slotW + 2)) / (total - 1);
      const xa = x0 + dir * step * r, xb = x0 + dir * step * (r + 1);
      for (let k = 0; k < n; k++) {
        const slot = side * (first.length / 2) / 2 ** r + Math.floor(k / 2);
        const w = winOf(r, slot), pair = rounds[r] && rounds[r][slot];
        const seat = pair ? pair[k % 2] : null;
        const on = lit > r && w !== null && seat === w;
        const y = yOf(k, n), ym = yOf(Math.floor(k / 2), n / 2);
        lines.push(<line key={`h${side}-${r}-${k}`} x1={xa} y1={y} x2={xb} y2={y} className={on ? 'stroke-amber-300' : 'stroke-slate-600'} strokeWidth={on ? 3 : 2}/>);
        lines.push(<line key={`v${side}-${r}-${k}`} x1={xb} y1={y} x2={xb} y2={ym} className={on ? 'stroke-amber-300' : 'stroke-slate-600'} strokeWidth={on ? 3 : 2}/>);
      }
    }
    // 決勝へ
    const r = total - 1, xs = x0 + dir * (W / 2 - CARD_CUP_BRACKET_GAP - (slotW + 2)), w = winOf(r, 0), pair = rounds[r] && rounds[r][0];
    const seat = pair ? pair[side] : null;
    const on = lit > r && w !== null && seat === w;
    lines.push(<line key={`f${side}`} x1={total > 1 ? xs : x0} y1={H / 2} x2={W / 2 + (side ? 6 : -6)} y2={H / 2} className={on ? 'stroke-amber-300' : 'stroke-slate-600'} strokeWidth={on ? 3 : 2}/>);
  });
  const slot = (seat, i, side) => {
    const e = seat === null ? null : bySeat(seat);
    const n = side ? rightSeats.length : leftSeats.length;
    return (
      <div key={`${side}-${i}`} className="absolute flex items-center" style={{ left: side ? W - slotW : 0, top: yOf(i, n) - 15, width: slotW, height: 30 }}>
        {e ? <CardTourWho e={e} known={null}/> : <span className="w-full rounded-xl bg-white/5 px-2 py-1 text-[11px] font-black text-slate-500">不戦勝</span>}
      </div>
    );
  };
  return (
    <div data-card-cup-bracket data-card-cup-lit={lit} className="space-y-2">
      <div className="relative mx-auto overflow-hidden rounded-2xl bg-slate-950/70" style={{ width: W, height: H }}>
        <svg width={W} height={H} className="absolute inset-0" aria-hidden="true">{lines}</svg>
        {leftSeats.map((s, i) => slot(s, i, 0))}
        {rightSeats.map((s, i) => slot(s, i, 1))}
        <div className="absolute text-center" style={{ left: W / 2 - 30, top: H / 2 - 52, width: 60 }}>
          <span aria-hidden="true" className={`block text-[34px] leading-none ${champ !== null ? '' : 'opacity-40'}`}>🏆</span>
          <small data-card-cup-champ className="block truncate text-[10px] font-black text-amber-200">{champ !== null && bySeat(champ) ? (bySeat(champ).mine ? 'あなた' : bySeat(champ).name) : '優勝'}</small>
        </div>
      </div>
      {done && lit >= total && <button type="button" data-card-cup-bracket-replay onClick={() => { Audio_.fgSe.tap(); setLit(0); }} className="ml-auto block rounded-xl border-2 border-amber-500/70 bg-amber-100 px-3 py-1 text-[12px] font-black text-amber-900">演出リプレイ</button>}
    </div>
  );
};

// 総当たりの結果は、公式杯の対戦表(CardTourGrid)に渡せる形にして出す
const cardCupAsTourView = (v) => ({
  tour: { id: v.cup.id, status: 'done', groups: 1 },
  entries: v.entries.filter((e) => e.seat !== null).map((e) => ({ ...e, seatId: e.ownerId, grp: 0, finalSeat: null, assistId: null })),
  matches: v.matches.map((m) => ({ id: m.id, stage: 'group', grp: 0, day: m.round, a: m.a, b: m.b, winner: m.winner, kos: m.kos, visibleAt: 0, playOn: null })),
});

// ---- 開く ----
const cardCupHourOptions = (now, fromMs, days = 3, stepMin = 60) => {
  const out = [];
  const start = Math.ceil(Math.max(now, fromMs) / (stepMin * 60000)) * stepMin * 60000;
  for (let t = start; t <= now + days * 86400000 && out.length < 400; t += stepMin * 60000) out.push(t);
  return out;
};
const CardCupCreate = ({ now, mine, onOpenRegister, onCreated, selfId, profile }) => {
  const [mode, setMode] = useState('auto');
  const [format, setFormat] = useState('ko');
  const [max, setMax] = useState(8);
  const [name, setName] = useState('');
  const [listed, setListed] = useState(true);
  const untilOpts = cardCupHourOptions(now, now + 10 * 60000, 3, 60);
  const [until, setUntil] = useState(() => untilOpts[Math.min(2, untilOpts.length - 1)] || 0);
  const startOpts = mode === 'auto' ? cardCupHourOptions(now, until + 3600000, 4, 60).filter((t) => t <= until + 2 * 86400000) : cardCupHourOptions(now, now + 15 * 60000, 3, 15);
  const [start, setStart] = useState(0);
  const startNow = startOpts.includes(start) ? start : startOpts[mode === 'auto' ? 0 : Math.min(4, startOpts.length - 1)] || 0;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const maxOpts = format === 'rr' ? [4, 6, 8] : [4, 8, 16];
  const maxNow = maxOpts.includes(max) ? max : maxOpts[maxOpts.length - 1];
  const seg = (list, cur, set, key) => (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${list.length}, minmax(0, 1fr))` }}>
      {list.map(([v, label]) => <button key={String(v)} type="button" data-card-cup-opt={`${key}-${v}`} onClick={() => set(v)} className={`rounded-xl py-2 text-[13px] font-black ${cur === v ? 'bg-gradient-to-b from-amber-300 to-orange-500 text-slate-950' : 'border-2 border-amber-500/60 bg-amber-100 text-amber-900'}`}>{label}</button>)}
    </div>
  );
  const create = async () => {
    if (busy) return;
    const nm = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    if (!nm) { setMsg('大会の名前を入れてください'); return; }
    if (typeof cardChatContact === 'function' && cardChatContact(nm)) { setMsg('名前に連絡先は入れられません'); return; }
    setBusy(true); setMsg('');
    try {
      const key = await cardShareOwnerKey(false);
      if (!key || !selfId) { setMsg('デッキを登録した端末でだけ開けます'); return; }
      const r = await cardTourRpc('card_cup_create', { p_owner: selfId, p_key: key, p_name: nm, p_host_name: (profile && profile.name) || 'ブリーダー', p_icon: (profile && profile.icon) || null,
        p_mode: mode, p_format: format, p_max: maxNow, p_listed: listed, p_entry_until: mode === 'auto' ? new Date(until).toISOString() : null, p_start_at: new Date(startNow).toISOString() });
      const st = r && typeof r === 'object' ? r.status : null;
      if (st === 'ok') { onCreated(r.id); return; }
      setMsg({ bad: '内容を確かめてください(時刻がずれたときは選び直してください)', busy: '開いている個人杯がもうあります(1人1つまで)', slot: 'その発表の時刻はいっぱいです。別の時刻を選んでください', crowded: 'いまは開けません。少しあとでお試しください',
        many: '出ている個人杯が3つあります', nodeck: 'デッキ登録をしてから開いてください', locked: 'デッキを登録した端末でだけ開けます' }[st] || '通信できませんでした。もう一度お試しください');
    } finally { setBusy(false); }
  };
  return (
    <div data-card-cup-create className="space-y-2">
      <div className="space-y-2 rounded-2xl border-2 border-amber-600/60 bg-indigo-950/60 p-3">
        <b className="block text-[13px] font-black text-amber-200">大会の名前(20字まで)</b>
        <input data-card-cup-name value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="例: 金曜の夜カップ" className="w-full rounded-xl border-2 border-slate-600 bg-slate-950 px-3 py-2 text-[15px] font-bold text-white"/>
        <b className="block text-[13px] font-black text-amber-200">遊び方</b>
        {seg([['auto', '⏰ オート'], ['live', '⚡ リアルタイム']], mode, setMode, 'mode')}
        <p className="text-[11px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(mode === 'auto' ? 'オート: 登録したデッキで出て、決めた時刻に結果がいっせいに出ます' : 'リアルタイム: 決めた時刻に集まって、1試合ずつ自分で戦います。来られない人は登録したデッキが代わりに自動で戦います')}</p>
        <b className="block text-[13px] font-black text-amber-200">形式</b>
        {seg([['ko', 'トーナメント'], ['rr', '総当たり']], format, setFormat, 'format')}
        <b className="block text-[13px] font-black text-amber-200">人数(主催もふくむ)</b>
        {seg(maxOpts.map((n) => [n, `${n}人まで`]), maxNow, setMax, 'max')}
        {mode === 'auto' && (<>
          <b className="block text-[13px] font-black text-amber-200">エントリーの締め切り</b>
          <select data-card-cup-until value={until} onChange={(e) => setUntil(Number(e.target.value))} className="w-full rounded-xl border-2 border-slate-600 bg-slate-950 px-2 py-2 text-[14px] font-bold text-white">
            {untilOpts.map((t) => <option key={t} value={t}>{cardTourTimeLabel(t)}</option>)}
          </select>
        </>)}
        <b className="block text-[13px] font-black text-amber-200">{mode === 'auto' ? '結果の発表' : '始まる時刻'}</b>
        <select data-card-cup-start value={startNow} onChange={(e) => setStart(Number(e.target.value))} className="w-full rounded-xl border-2 border-slate-600 bg-slate-950 px-2 py-2 text-[14px] font-bold text-white">
          {startOpts.map((t) => <option key={t} value={t}>{cardTourTimeLabel(t)}</option>)}
        </select>
        <b className="block text-[13px] font-black text-amber-200">募り方</b>
        {seg([[true, '公開の一覧にも出す'], [false, '合言葉だけ']], listed, setListed, 'listed')}
      </div>
      <CardCupJoinPanel mine={mine} onOpenRegister={onOpenRegister}/>
      {msg && <p data-card-cup-msg className="rounded-xl bg-slate-900 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
      {mine && <button type="button" data-card-cup-create-go disabled={busy} onClick={() => { Audio_.fgSe.tap(); void create(); }} className="w-full rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 py-3 text-[16px] font-black text-slate-950 disabled:opacity-50">この内容で開く</button>}
    </div>
  );
};

// ---- 1つの杯 ----
// 試合の一覧(結果が見られるとき)。各試合から見返しを開く(公式杯と同じ見返し。84 の openCupReplay → 93 の cardReplayFromTour)
const cardCupRoundLabel = (c, r, rounds) => {
  if (c.format !== 'ko') return `第${r + 1}節`;
  const left = rounds - r;
  return left === 1 ? '決勝' : left === 2 ? '準決勝' : left === 3 ? '準々決勝' : `${r + 1}回戦`;
};
const CardCupMatches = ({ v, onOpenReplay, selfId = null }) => {
  const c = v.cup;
  const rounds = Math.max(0, ...v.matches.map((m) => m.round + 1));
  const bySeat = (s) => v.entries.find((e) => e.seat === s) || null;
  const nm = (e) => (e ? (e.mine ? 'あなた' : e.name) : '?');
  if (!v.matches.length) return null;
  return (
    <div data-card-cup-matches className="space-y-1 rounded-2xl bg-slate-950/70 p-2.5">
      <b className="block text-[13px] font-black text-amber-200">試合</b>
      {v.matches.slice().sort((x, y) => (y.round - x.round) || (x.slot - y.slot)).map((m) => {
        const a = bySeat(m.a), b = bySeat(m.b);
        return (
          <div key={m.id} data-card-cup-match={m.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5">
            <small className="w-14 shrink-0 text-[11px] font-black text-amber-200">{cardCupRoundLabel(c, m.round, c.format === 'ko' && c.bracket ? c.bracket.length : rounds)}</small>
            <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">
              <b className={m.winner === 0 ? 'text-orange-300' : 'text-slate-300'}>{nm(a)}</b> 対 <b className={m.winner === 1 ? 'text-orange-300' : 'text-slate-300'}>{nm(b)}</b>
            </span>
            <button type="button" data-card-cup-replay={m.id} disabled={!onOpenReplay || m.winner === null} onClick={() => { Audio_.fgSe.tap(); void onOpenReplay(m.id, c.name, selfId); }}
              className="shrink-0 rounded-lg border-2 border-amber-500/70 bg-amber-100 px-2 py-0.5 text-[12px] font-black text-amber-900 disabled:opacity-40">見返す</button>
          </div>
        );
      })}
    </div>
  );
};

const CardCupDetail = ({ v, now, mine, selfId, profile, onChanged, onOpenRegister, onOpenReplay = null, onPlayLive = null, getAdapters = null }) => {
  const c = v.cup;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // ごほうび・参加費・主催仲間(99-card-cup-prize)。表がまだ無いときは null(欄を出さない・ふつうの参加)
  const [prize, setPrize] = useState(null);
  //   口(getAdapters)が無いとき(ごほうびの公開の印 cardCupPrizeOpen が閉じていてデバッグでもない)は読まない → 欄・参加費・主催仲間は出ない
  const reloadPrize = async () => { if (getAdapters && typeof cardCupPrizeView === 'function') setPrize(await cardCupPrizeView(c.id, selfId)); };
  useEffect(() => { void reloadPrize(); }, [c.id, selfId]);
  const joinPaid = async () => {
    if (busy || !getAdapters) return;
    setBusy(true); setMsg('');
    try {
      const a = await getAdapters();
      if (!a.owner || !a.key) { setMsg('デッキを登録した端末でだけ参加できます'); return; }
      // 主催・主催仲間は払わない(サーバの card_cup_join_pay が払わずに入れる)
      const fee = prize.me.host ? null : prize.fee;
      const have = fee ? cardCupHave(fee.item, a.have && a.have.main, a.have && a.have.card) : 0;
      const r = await cardCupJoinPaid({ ...a, name: (profile && profile.name) || a.name || 'ブリーダー', icon: (profile && profile.icon) || a.icon }, c.id, fee, have);
      setMsg(r === 'ok' ? '参加しました' : (CARD_CUP_PRIZE_MSG[r] || CARD_CUP_PRIZE_MSG.off));
      if (r === 'ok') { await onChanged(); await reloadPrize(); }
    } finally { setBusy(false); }
  };
  const act = async (fn, extra = {}) => {
    if (busy) return;
    setBusy(true); setMsg('');
    try {
      const key = await cardShareOwnerKey(false);
      if (!key || !selfId) { setMsg('デッキを登録した端末でだけ参加できます'); return; }
      const r = await cardTourRpc(fn, { p_cup: c.id, p_owner: selfId, p_key: key, ...extra });
      const text = { ok: { card_cup_join: '参加しました', card_cup_leave: '参加を取り消しました', card_cup_cancel: 'この個人杯を取り消しました' }[fn],
        closed: '受付は終わりました', full: '人数がいっぱいです', many: '出ている個人杯が3つあります', nodeck: 'デッキ登録をしてから参加してください',
        locked: 'デッキを登録した端末でだけ参加できます', none: '参加していません', fee: 'この個人杯には、いまは参加できません', host: '主催は抜けられません(取り消しはできます)', bad: '参加できませんでした' }[r];
      setMsg(text || '通信できませんでした。もう一度お試しください');
      if (r === 'ok') await onChanged();
    } finally { setBusy(false); }
  };
  const host = selfId && c.hostId === selfId;
  const open = c.status === 'entry' && now < c.entryUntil;
  const shown = c.status === 'done' && (c.mode === 'live' || now >= c.startAt);
  const ranked = v.entries.filter((e) => e.place !== null).sort((a, b) => a.place - b.place);
  return (
    <div data-card-cup-detail={c.id} className="space-y-2">
      <div className="rounded-2xl border-2 border-amber-600/60 bg-indigo-950/60 p-3">
        <div className="flex items-center gap-2"><b className="min-w-0 flex-1 truncate text-[17px] font-black text-amber-100">{c.name}</b><span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black text-slate-950">{cardCupStatusText(c, now)}</span></div>
        <div className="mt-1 text-[12px] font-bold text-slate-200">{`${CARD_CUP_MODE_LABEL[c.mode]}・${CARD_CUP_FORMAT_LABEL[c.format]}・${v.entries.length}/${c.max}人・主催 ${c.hostName}`}</div>
        <div className="text-[12px] font-bold text-slate-300">{cardCupTimeText(c)}</div>
        {c.code && v.me && <div data-card-cup-code className="mt-1.5 text-[13px] font-black text-amber-200">合言葉 <span className="text-[20px] tracking-[0.3em] text-amber-100">{c.code}</span></div>}
        {c.status === 'closed' && <div className="mt-1 text-[12px] font-black text-rose-200">{c.closedReason === 'few' ? '人数が足りなかったため、中止になりました' : '主催が取り消しました'}</div>}
        {c.status === 'done' && !shown && <div className="mt-1 text-[12px] font-black text-amber-200">{`結果は ${cardTourTimeLabel(c.startAt)} に出ます`}</div>}
        {c.mode === 'auto' && c.status === 'running' && <div className="mt-1 text-[12px] font-black text-amber-200">{`試合はサーバで自動で行われます。結果は ${cardTourTimeLabel(c.startAt)} に出ます`}</div>}
      </div>
      {prize && getAdapters && typeof CardCupPrizePanel === 'function' && <CardCupPrizePanel c={c} v={v} now={now} selfId={selfId} prize={prize} reload={async () => { await reloadPrize(); await onChanged(); }} getAdapters={getAdapters}/>}
      {c.mode === 'live' && typeof CardCupLivePanel === 'function' && <CardCupLivePanel v={v} now={now} selfId={selfId} onChanged={onChanged} onPlay={onPlayLive}/>}
      {shown && c.format === 'ko' && <CardCupBracket rounds={c.bracket} matches={v.matches} entries={v.entries} done/>}
      {shown && c.format === 'rr' && typeof CardTourGrid === 'function' && <CardTourGrid view={cardCupAsTourView(v)} stage="group" grp={0} known={null} now={now}/>}
      {shown && ranked.length > 0 && (
        <div data-card-cup-ranks className="rounded-2xl bg-slate-950/70 p-2.5 text-[12px] font-bold text-slate-200" style={JA_WRAP_STYLE}>
          <b className="text-amber-200">順位 </b>{ranked.map((e) => `${e.place}位 ${e.mine ? 'あなた' : e.name}(${e.wins || 0}勝)`).join(' ・ ')}
          {!(prize && (prize.pool.length || prize.fee)) && <div className="mt-1 text-slate-400">この個人杯にはごほうびはありません。ランキングにも入りません</div>}
        </div>
      )}
      {shown && <CardCupMatches v={v} onOpenReplay={onOpenReplay} selfId={selfId}/>}
      {!shown && (
        <div data-card-cup-entries className="space-y-1 rounded-2xl bg-slate-950/70 p-2.5">
          <b className="block text-[13px] font-black text-amber-200">{`参加者 ${v.entries.length}/${c.max}人`}</b>
          {v.entries.map((e) => <CardTourWho key={e.ownerId} e={e} known={null}/>)}
        </div>
      )}
      {open && !v.me && <CardCupJoinPanel mine={mine} busy={busy} onOpenRegister={onOpenRegister}
        label={prize && prize.fee && !prize.me.host ? `参加費 ${cardCupItemText(prize.fee.item, prize.fee.amount)} を払って参加` : 'このデッキで参加'}
        onJoin={() => (prize && prize.fee ? void joinPaid() : void act('card_cup_join', { p_name: (profile && profile.name) || 'ブリーダー', p_icon: (profile && profile.icon) || null }))}/>}
      {open && v.me && !host && <button type="button" data-card-cup-leave disabled={busy} onClick={() => { Audio_.fgSe.tap(); void act('card_cup_leave'); }} className="w-full rounded-2xl border-2 border-slate-500 bg-slate-800 py-2.5 text-[14px] font-black text-slate-100 disabled:opacity-50">参加を取り消す</button>}
      {c.status === 'entry' && host && <button type="button" data-card-cup-cancel disabled={busy} onClick={() => { Audio_.fgSe.tap(); void act('card_cup_cancel'); }} className="w-full rounded-2xl border-2 border-rose-500/70 bg-slate-800 py-2.5 text-[14px] font-black text-rose-100 disabled:opacity-50">この個人杯を取り消す</button>}
      {msg && <p data-card-cup-msg className="rounded-xl bg-slate-900 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
    </div>
  );
};

// ---- 画面 ----
// onBack … 対戦えらびへ / onOpenRegister … デッキ登録へ(戻ると、この画面のいまの杯に戻る)
// onOpenReplay(matchId, title, owner) … 試合の見返しを開く(84。開けなかったら false。合言葉だけの杯は参加者だけ見られるので owner を渡す)
// onPlayLive(match) … リアルタイム杯の自分の試合を戦う(84 が対戦の画面を開く・④)
// getAdapters … ごほうび・参加費の持ち物を足し引きする口(84 の cupAdapters。99-card-cup-prize)
const CardCup = ({ onBack, onOpenRegister = null, initialCup = null, onCupChange = null, onOpenReplay = null, onPlayLive = null, getAdapters = null }) => {
  const [tab, setTab] = useState('list');
  const [list, setList] = useState(undefined);
  const [done, setDone] = useState([]); // 終わった公開の杯(終わって30日まで。2026-10-31 社長 案A)
  const [mineCups, setMineCups] = useState(undefined);
  const [cupId, setCupId] = useState(initialCup);
  const [view, setView] = useState(null);
  const [selfId, setSelfId] = useState(null);
  const [mine, setMine] = useState(undefined);
  const [profile, setProfile] = useState({ name: 'ブリーダー', icon: null });
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const now = Date.now();
  useEffect(() => { if (onCupChange) onCupChange(cupId); }, [cupId]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const id = typeof ensureBreederId === 'function' ? await ensureBreederId().catch(() => null) : null;
      const [l, m, nm, ic] = await Promise.all([cardCupList(), id && typeof cardShareFetchMine === 'function' ? cardShareFetchMine(id).catch(() => null) : null,
        storeGet('mh_breeder_name', 'ブリーダー', false).catch(() => 'ブリーダー'), storeGet('mh_breeder_icon', null, false).catch(() => null)]);
      if (!alive) return;
      setSelfId(id); setMine(m || null); setList(l);
      if (l) void cardCupListDone().then((d) => { if (alive) setDone(d); });
      setProfile({ name: typeof nm === 'string' && nm ? nm.slice(0, 40) : 'ブリーダー', icon: typeof ic === 'string' ? ic : null });
      if (id) setMineCups(await cardCupMineWithHosting(id, !!getAdapters));
    })();
    return () => { alive = false; };
  }, []);
  const reload = async (id = cupId) => { if (id) setView(await cardCupView(id, selfId)); };
  useEffect(() => { setView(null); setMsg(''); if (cupId) void reload(cupId); }, [cupId, selfId]);
  const shell = (children, back = onBack) => (
    <div data-mh-screen data-card-cup className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="個人杯" accent="text-amber-200" onBack={back} note="自分で大会を開いて、仲間と競う"/>
      <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>{children}</div>
    </div>
  );
  if (list === undefined) return shell(<ScreenEmpty emoji="⏳" lines={['読み込んでいます']}/>);
  if (list === null) return shell(<ScreenEmpty emoji="🛠️" lines={['個人杯は準備中です']}/>);
  if (cupId) {
    const back = () => { setCupId(null); if (selfId) void cardCupMineWithHosting(selfId, !!getAdapters).then(setMineCups); void cardCupList().then((l) => l && setList(l)); };
    if (!view) return shell(<ScreenEmpty emoji="⏳" lines={['読み込んでいます']}/>, back);
    return shell(<CardCupDetail v={view} now={now} mine={mine} selfId={selfId} profile={profile} onChanged={() => reload()} onOpenRegister={onOpenRegister} onOpenReplay={onOpenReplay} onPlayLive={onPlayLive} getAdapters={getAdapters}/>, back);
  }
  const find = async () => {
    const c = String(code || '').replace(/[^0-9]/g, '');
    if (c.length !== 6) { setMsg('合言葉は6けたの数字です'); return; }
    const r = await cardCupFind(c);
    if (r) setCupId(r.id); else setMsg('受付中の個人杯が見つかりませんでした');
  };
  const tabs = [['list', '公開の一覧'], ['mine', '自分の杯'], ['code', '合言葉'], ['create', '開く']];
  return shell(<>
    <div className="grid grid-cols-4 gap-1">
      {tabs.map(([k, label]) => <button key={k} type="button" data-card-cup-tab={k} onClick={() => { Audio_.fgSe.tap(); setTab(k); setMsg(''); }} className={`rounded-xl py-2 text-[12px] font-black ${tab === k ? 'bg-gradient-to-b from-amber-300 to-orange-500 text-slate-950' : 'border-2 border-amber-500/60 bg-amber-100 text-amber-900'}`}>{label}</button>)}
    </div>
    {tab === 'list' && (list.length ? list.map((c) => <CardCupRow key={c.id} c={c} now={now} onOpen={setCupId}/>) : <ScreenEmpty emoji="🏆" lines={['いま募集中の個人杯はありません', '「開く」から自分で開けます']}/>)}
    {tab === 'list' && done.length > 0 && (
      <div data-card-cup-done className="space-y-2">
        <b className="block px-1 pt-1 text-[13px] font-black text-amber-200">終わった杯(終わって30日まで・だれでも結果と見返しが見られます)</b>
        {done.map((c) => <CardCupRow key={c.id} c={c} now={now} onOpen={setCupId}/>)}
      </div>
    )}
    {tab === 'mine' && (mineCups === undefined ? <ScreenEmpty emoji="⏳" lines={['読み込んでいます']}/> : mineCups && mineCups.length ? mineCups.map((c) => <CardCupRow key={c.id} c={c} now={now} onOpen={setCupId}/>) : <ScreenEmpty emoji="📭" lines={['開いた・出ている個人杯はありません']}/>)}
    {tab === 'code' && (
      <div data-card-cup-find className="space-y-2 rounded-2xl border-2 border-amber-600/60 bg-indigo-950/60 p-3">
        <b className="block text-[13px] font-black text-amber-200">合言葉(6けたの数字)</b>
        <input data-card-cup-code-input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} className="w-full rounded-xl border-2 border-slate-600 bg-slate-950 px-3 py-2 text-center text-[24px] font-black tracking-[0.3em] text-white"/>
        <button type="button" data-card-cup-find-go onClick={() => { Audio_.fgSe.tap(); void find(); }} className="w-full rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 py-2.5 text-[15px] font-black text-slate-950">探す</button>
      </div>
    )}
    {tab === 'create' && <CardCupCreate now={now} mine={mine} selfId={selfId} profile={profile} onOpenRegister={onOpenRegister} onCreated={(id) => { setCupId(id); if (selfId) void cardCupMine(selfId).then(setMineCups); }}/>}
    {msg && <p data-card-cup-msg className="rounded-xl bg-slate-900 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
  </>);
};
