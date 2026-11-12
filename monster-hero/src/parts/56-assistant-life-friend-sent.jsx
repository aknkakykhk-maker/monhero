// 助手ライフ: 自分が残した置き手紙の見返しと、自由文を送る前の確認(2026-11-12 社長・案 docs/progress/assistant-peer/FRIEND-NOTE-REVIEW-PLAN.md)
//   社長(2026-11-11)「フレンドの家に遊びに行ったときの残した置き手紙を確認できるようにしたい。また自由分を送るときは確認の画面もほしい」
//   選択(2026-11-12): 残すのは30日・50通まで(古いものから消える)/確認は自由文があるときだけ/一覧は「🏘 フレンド」の家の一覧の下(全部)と家の中(その家の分)
// 保存は新しいキー mh_alf_sent_notes_v1 だけ(今の mh_assistant_life_friend_v1 は形を変えない)。壊れた値は空の一覧。
// 一覧は「端末の控え」と「行き来の表の自分が書いた行(7日分)」を合わせる(この機能より前に残した分・お礼が返ってきたかも見える)。
// フレンドを解除した人・ブロックした人(フレンドの一覧にいない人)の分は出さない。SQL は要らない

const ALF_SENT_KEY = 'mh_alf_sent_notes_v1';
const ALF_SENT_MAX = Object.freeze({ days: 30, count: 50 });

// ---------- 保存(無い・壊れているときは空) ----------
const normalizeAlfSentNotes = (raw, now = Date.now()) => {
  if (!Array.isArray(raw)) return [];
  const from = now - ALF_SENT_MAX.days * 86400000;
  const out = [];
  const seen = new Set();
  for (const v of raw) {
    if (!v || typeof v !== 'object') continue;
    const host = typeof v.host === 'string' && alfSafeOther(v.host) ? v.host : null;
    const at = Number.isFinite(v.at) ? v.at : 0;
    if (!host || at < from || at > now + 86400000) continue;
    const day = typeof v.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.day) ? v.day : alfDay(at);
    const k = `${host}|${day}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const word = v.word === ALF_WORD_FREE ? ALF_WORD_FREE : alfInt(v.word, 0, ALF_WORDS - 1);
    out.push({ host, day, at, word, name: alfStr(v.name, 20), to: alfValidId(v.to) ? v.to : null, note: typeof v.note === 'string' ? alfNoteShow(v.note) : '' });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, ALF_SENT_MAX.count);
};
let _alfSentLoading = null;
const alfSentLoad = () => {
  if (Array.isArray(ALF_STORE.state.sent)) return Promise.resolve(ALF_STORE.state.sent);
  if (_alfSentLoading) return _alfSentLoading;
  _alfSentLoading = (async () => {
    let raw = null;
    try { raw = await storeGet(ALF_SENT_KEY, [], false); } catch { raw = null; }
    const sent = normalizeAlfSentNotes(raw);
    ALF_STORE.set({ sent });
    return sent;
  })();
  return _alfSentLoading;
};
// 置き手紙を残せたときに1通ぶん控える(56-assistant-life-friend の assistantLifeFriendLeaveNote から)
const alfSentRecord = async ({ host, name, to = null, word = 0, note = '' }) => {
  if (!alfEnabled()) return;
  const cur = await alfSentLoad();
  const at = Date.now();
  const sent = normalizeAlfSentNotes([{ host, name, to, word, note, at, day: alfDay(at) }, ...cur], at);
  ALF_STORE.set({ sent });
  try { storeSet(ALF_SENT_KEY, sent, false); } catch {}
};

// 見せる一覧(新しい順)。hostId を渡すとその家の分だけ
const alfSentList = (s = ALF_STORE.state, hostId = null) => {
  const self = s.selfId;
  const names = Object.fromEntries((s.roster || []).map(f => [f.id, f.name]));
  const rows = (s.visits || []).filter(v => self && v.visitor === self && v.kind === 'player');
  const byKey = new Map();
  for (const v of rows) byKey.set(`${v.host}|${v.day}`, { host: v.host, day: v.day, at: v.at, word: v.word, to: v.noteTo, note: v.note, thanks: v.thanks, name: '' });
  for (const v of (Array.isArray(s.sent) ? s.sent : [])) {
    const k = `${v.host}|${v.day}`;
    const row = byKey.get(k);
    byKey.set(k, row ? { ...v, thanks: row.thanks } : { ...v, thanks: null });
  }
  return [...byKey.values()]
    .filter(v => names[v.host] && (!hostId || v.host === hostId))
    .map(v => ({ ...v, name: names[v.host] }))
    .sort((a, b) => b.at - a.at)
    .slice(0, ALF_SENT_MAX.count);
};

// ---------- 画面 ----------
// 1通ぶん(相手に届いた形に近い並び: いつ・だれの家・だれあて・一言・自由文)
function AlfSentRow({ n, inHouse = false }) {
  return (<>
    <p className="text-[11px] leading-snug text-slate-100">
      <span className="whitespace-nowrap text-slate-400">{alfAgoText(n.at)}</span>{' '}
      {inHouse ? null : <span className="whitespace-nowrap font-bold">{n.name}さんの家</span>}
      <span className="whitespace-nowrap">{inHouse ? '' : '・'}{n.to ? `${assistantLifeName(n.to)}あて` : 'みんなへ'}</span>{alfWordQuote(n.word)}
    </p>
    {n.note ? <p className="mt-0.5 rounded border-l-2 border-pink-300 bg-pink-950/30 px-1.5 py-0.5 text-[11px] text-pink-50" data-alf-sent-text>✏️ {n.note}</p> : null}
    {n.thanks != null && ALF_THANKS_TEXTS[n.thanks] ? <p className="mt-0.5 text-[10px] text-amber-200" data-alf-sent-thanks>💌 お礼「{ALF_THANKS_TEXTS[n.thanks]}」が届きました</p> : null}
  </>);
}
// 「🏘 フレンド」のページの、家の一覧の下(全部・押すとその家へ)
function AlfSentNotes({ s, card, sec, onVisit }) {
  const [more, setMore] = React.useState(false);
  React.useEffect(() => { void alfSentLoad(); }, []);
  const list = alfSentList(s);
  if (!list.length) return null;
  const houses = alfOpenHouses('look');
  const shown = more ? list : list.slice(0, 5);
  return (<>
    <p className={sec}>📮 残した置き手紙</p>
    <div className={card} data-alf-sent>
      {shown.map(n => { const f = houses.find(h => h.id === n.host); return (
        <button key={`${n.host}|${n.day}`} type="button" disabled={!f} className="block w-full border-b border-slate-700/60 py-1 text-left last:border-0 disabled:opacity-100" data-alf-sent-item={n.host} onClick={() => f && onVisit(f)}>
          <AlfSentRow n={n}/>
          <p className="mt-0.5 text-[10px] text-slate-400">{f ? <span className="text-amber-200">🚪 この家へ遊びに行く ›</span> : 'いまはこの家へ行けません(家がまだ届いていません)'}</p>
        </button>); })}
      {list.length > 5 && <button type="button" className="mt-1 w-full rounded-xl border border-slate-500 py-1 text-[11px] text-slate-200" data-alf-sent-more onClick={() => setMore(!more)}>{more ? '少なく見る' : `ぜんぶ見る(${list.length}通)`}</button>}
      <p className="mt-1 text-[9.5px] leading-snug text-slate-400">この端末に{ALF_SENT_MAX.days}日・{ALF_SENT_MAX.count}通まで残ります(古いものから消えます)</p>
    </div>
  </>);
}
// フレンドの家の中(その家に残した分だけ・小さく)
function AlfSentHere({ friendId }) {
  const s = useAssistantLifeFriendState();
  React.useEffect(() => { void alfSentLoad(); }, []);
  const list = alfSentList(s, friendId).slice(0, 3);
  if (!list.length) return null;
  return (
    <div className="mt-1 rounded-xl bg-slate-950/85 px-2 py-1" data-alf-sent-here>
      <p className="text-[10px] font-black text-amber-200">📮 この家に残した置き手紙</p>
      {list.map(n => <div key={n.day} className="mt-0.5"><AlfSentRow n={n} inHouse/></div>)}
    </div>);
}
// 自由文を送る前の確認(あて先・相手に届く形・直す/送る)
function AlfNoteConfirm({ friend, to, word, note, selfName, warn, busy, land, onFix, onSend, onCancel }) {
  const toText = to ? `${friend.name}さんの家の${assistantLifeName(to)}` : `${friend.name}さんの家のみんな`;
  return (
    <div className="absolute inset-0" style={{ zIndex: 32 }} data-alf-note-confirm>
      <button type="button" aria-label="直す" className="absolute inset-0 bg-black/60" onClick={onFix}/>
      <div className="mhl-sheet" style={land ? { left: 'auto', width: '44%', top: 0, maxHeight: '100%', paddingTop: 92, borderRadius: '22px 0 0 22px' } : { maxHeight: 'calc(100% - 96px)' }}>
        <p className="text-[15px] font-black text-amber-100">✉️ この置き手紙を送りますか？</p>
        <p className="mt-1 text-[11px] font-bold text-slate-200">あて先: <span className="text-amber-100" data-alf-note-confirm-to>{toText}</span></p>
        <p className="mt-2 text-[10.5px] font-bold text-slate-300">{friend.name}さんには、こう届きます</p>
        <div className="mt-1 rounded-xl border border-amber-200/40 bg-slate-900/90 p-2" data-alf-note-confirm-preview>
          <p className="text-[11px] leading-snug text-slate-100">
            <span className="whitespace-nowrap text-slate-400">{alfAgoText(Date.now())}</span>{' '}
            <span className="whitespace-nowrap">{selfName || 'あなた'}さん</span>が{to ? <span className="whitespace-nowrap">{assistantLifeName(to)}あてに</span> : '訪ねてくれた'}{alfWordQuote(word)}
          </p>
          <p className="mt-0.5 rounded border-l-2 border-pink-300 bg-pink-950/30 px-1.5 py-0.5 text-[11px] text-pink-50">✏️ {note}</p>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-slate-300">・送ったあとは直せません<br/>・この家へは1日1通です。送ると、この家から帰ります(ビートP 50)</p>
        {warn ? <p className="mt-1 text-[10.5px] font-bold text-rose-300" data-alf-note-confirm-warn>⚠️ {warn}</p> : null}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" className="mhl-btn bg-slate-700" data-alf-note-confirm-fix onClick={onFix}>✏️ 直す</button>
          <button type="button" className="mhl-btn bg-amber-500 text-slate-950 disabled:opacity-40" data-alf-note-confirm-send disabled={busy || !!warn} onClick={onSend}>{busy ? '送っています…' : '✉️ 送る'}</button>
        </div>
        <button type="button" data-mhl-sheet-close data-alf-note-confirm-cancel className="mhl-btn mt-2 w-full bg-slate-800 text-[12px] text-slate-300" disabled={busy} onClick={onCancel}>やめる</button>
      </div>
    </div>);
}
