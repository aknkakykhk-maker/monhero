// ===== MFバトルカード: マルチ対戦の履歴と相手のデッキ =====
// 2026-10-27 社長「バトルカードの過去のマルチの戦績とかで相手のデッキが見れるようにとかもほしい」。案: docs/progress/card-multi-plus/README.md の案1
// 担当はカード部 ツナグくん。リプレイ(93)・観戦(94)は別の部品
//
// 作り
//   ・1試合ごとに、端末の中だけへ1行残す(新しい保存キー mh_card_pvp_history_v1・新しい30試合まで)。Supabase の表は足さない
//   ・相手のデッキは、試合のあとの照らし合わせ(91 の封)で、もう自分の端末に届いている物をそのまま取っておく
//     社長の答え: 試合のあとは全部見せる(3体とカード)。相手が抜けた試合は封が開かないので、その試合で使われた札だけ
//   ・強さの点数の増減は、いまの関数(card_battle_pvp_report)を変えずに出す。試合の始めと終わりに、点数の表の自分の行を読んで差を取る
//   ・91 から呼ぶ口は2つだけ: cardPvpHistoryBegin(始まったとき)・cardPvpHistoryRecord(確かめが決まったとき)

const CARD_PVP_HISTORY_KEY = 'mh_card_pvp_history_v1';
const CARD_PVP_HISTORY_MAX = 30;
const CARD_PVP_HISTORY_RATING_TRIES = 6;      // 点数が動くのを待って読み直す回数(相手の届けが遅いことがある)
const CARD_PVP_HISTORY_RATING_GAP_MS = 4000;

// ---- 純粋な計算(tools/card/card-pvp-history-check.js が node で確かめる) ----
const cardPvpHistText = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, '').slice(0, max) : '');
const cardPvpHistCards = (v, max) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x && x.length <= 12).slice(0, max) : []);
const cardPvpHistDeck = (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const monsters = cardPvpHistCards(v.monsters, 3);
  const cards = cardPvpHistCards(v.cards, 60);
  if (!monsters.length && !cards.length) return null;
  return { name: cardPvpHistText(v.name, 40), monsters, cards };
};
const cardPvpHistInt = (v, max) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0);
// 1行を作り直す(知らない項目は捨てる・壊れていたら null)
const cardPvpNormalizeHistoryEntry = (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const match = cardPvpHistText(v.match, 40);
  if (!match || !Number.isFinite(v.at)) return null;
  const foe = v.foe && typeof v.foe === 'object' ? v.foe : {};
  const r = v.rating && typeof v.rating === 'object' ? v.rating : null;
  return {
    match, at: v.at,
    room: v.room === 'free' ? 'free' : 'private',
    outcome: v.outcome === 'win' ? 'win' : 'lose',
    reason: cardPvpHistText(v.reason, 12),
    turns: cardPvpHistInt(v.turns, 999),
    verify: ['ok', 'skip', 'ng'].includes(v.verify) ? v.verify : 'skip',
    foe: { bid: cardPvpHistText(foe.bid, 64), name: cardPvpHistText(foe.name, 40) || 'あいて', icon: cardPvpHistText(foe.icon, 64), frame: cardPvpHistText(foe.frame, 64) || null, deckName: cardPvpHistText(foe.deckName, 40) },
    foeDeck: cardPvpHistDeck(v.foeDeck),
    foeSeen: cardPvpHistCards(v.foeSeen, 60),
    myDeck: cardPvpHistDeck(v.myDeck),
    rating: r && Number.isFinite(r.before) && Number.isFinite(r.after) ? { before: Math.round(r.before), after: Math.round(r.after) } : null,
  };
};
const cardPvpNormalizeHistory = (v) => {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  return v.map(cardPvpNormalizeHistoryEntry).filter((e) => e && !seen.has(e.match) && seen.add(e.match)).slice(0, CARD_PVP_HISTORY_MAX);
};
// 91 の部屋のようす(CARD_PVP.get())から1行を作る
//   相手のデッキは、封が開いて「合っている」と分かった試合だけ全部。それ以外(相手が抜けた・合わなかった)は、使われた札だけ
const cardPvpHistoryEntryOf = (room, at = Date.now()) => {
  if (!room || !room.match || !room.result) return null;
  const r = room.result;
  const foe = room.foe || {};
  const opened = r.verify === 'ok' && room.foeOpen && room.foeOpen.deck ? room.foeOpen.deck : null;
  const seen = [];
  (Array.isArray(room.history) ? room.history : []).forEach((e) => {
    if (e && e.by === 1 && e.reveal && typeof e.reveal === 'object') Object.values(e.reveal).forEach((no) => { if (typeof no === 'string') seen.push(no); });
  });
  return cardPvpNormalizeHistoryEntry({
    match: room.match, at, room: room.mode, outcome: r.outcome, reason: r.reason, turns: r.facts && r.facts.ownTurns, verify: r.verify,
    foe: { bid: foe.bid, name: foe.name, icon: foe.icon, frame: foe.fr, deckName: foe.dn },
    foeDeck: opened ? { monsters: opened.monsters, cards: opened.cards } : null,
    foeSeen: opened ? [] : seen,
    myDeck: room.deck ? { name: room.me && room.me.dn, monsters: room.deck.monsters, cards: room.deck.cards } : null,
  });
};
// 新しい1行を先頭に(同じ試合は上書き)。30試合まで
const cardPvpHistoryAdd = (list, entry) => {
  const e = cardPvpNormalizeHistoryEntry(entry);
  const cur = cardPvpNormalizeHistory(list);
  if (!e) return cur;
  return [e, ...cur.filter((x) => x.match !== e.match)].slice(0, CARD_PVP_HISTORY_MAX);
};
const cardPvpHistorySetRating = (list, match, rating) => cardPvpNormalizeHistory(list).map((x) => (x.match === match ? cardPvpNormalizeHistoryEntry({ ...x, rating }) : x));
// 同じ札をまとめる(デッキに入れた順のまま。モンスターは別に出す)
const cardPvpDeckGroups = (cards) => {
  const out = [];
  const at = {};
  (cards || []).forEach((no) => { if (at[no] === undefined) { at[no] = out.length; out.push({ no, n: 0 }); } out[at[no]].n += 1; });
  return out;
};
// 点数の増減の表示(+16・-14・±0)
const cardPvpRatingDelta = (rating) => {
  if (!rating) return '';
  const d = rating.after - rating.before;
  return d > 0 ? `+${d}` : d < 0 ? `${d}` : '±0';
};
// 日時(JST・「10/27 21:05」)
const cardPvpHistoryWhen = (at) => {
  const d = new Date(at + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

// ---- 保存(読み直してから足す。書けなくても対戦は続ける) ----
const cardPvpHistoryLoad = async () => {
  try { return cardPvpNormalizeHistory(await storeGet(CARD_PVP_HISTORY_KEY, [], false)); } catch (_) { return []; }
};
const cardPvpHistoryWrite = async (fn) => {
  try { const next = fn(await cardPvpHistoryLoad()); await storeSet(CARD_PVP_HISTORY_KEY, next, false); return next; } catch (_) { return null; }
};

// ---- 強さの点数の増減(自分の行だけ読む。表が無い・読めないときは null) ----
const sbFetchMyCardPvpRating = async (bid) => {
  if (!bid || typeof SUPABASE_URL === 'undefined' || (typeof _cardPvpRatingsUnavailable !== 'undefined' && _cardPvpRatingsUnavailable)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${CARD_PVP_RATING_TABLE}?select=rating,wins,loses&breeder_id=eq.${encodeURIComponent(bid)}&limit=1`, { headers: SB_HEADERS, cache: 'no-store', signal: controller.signal });
    if (!res.ok) return null;
    const rows = JSON.parse((await res.text()) || '[]');
    const row = Array.isArray(rows) ? rows[0] : null;
    // まだ1戦も数えられていない人は、はじめの点数
    if (!row) return { rating: CARD_PVP_RATING_START, games: 0 };
    return { rating: Number.isFinite(row.rating) ? row.rating : CARD_PVP_RATING_START, games: (Number.isFinite(row.wins) ? row.wins : 0) + (Number.isFinite(row.loses) ? row.loses : 0) };
  } catch (_) { return null; } finally { clearTimeout(timer); }
};
const cardPvpRatingBefore = {}; // 試合の番号 → 始まったときの自分の点数({ rating, games })
// 91: 試合が始まったとき(点数へ届ける試合だけ)
const cardPvpHistoryBegin = (match, bid) => {
  if (!match || !bid || cardPvpRatingBefore[match] !== undefined) return;
  cardPvpRatingBefore[match] = null;
  void sbFetchMyCardPvpRating(bid).then((x) => { if (cardPvpRatingBefore[match] === null) cardPvpRatingBefore[match] = x; });
};
// 91: 確かめが決まったとき(1試合1回)。rankable … 強さの点数へ届ける試合か。届けたあと、点数が動くのを待って増減を書く
const cardPvpHistoryRecorded = new Set();
const cardPvpHistoryRecord = async (room, { rankable = false } = {}) => {
  const entry = cardPvpHistoryEntryOf(room);
  if (!entry || cardPvpHistoryRecorded.has(entry.match)) return;
  cardPvpHistoryRecorded.add(entry.match);
  await cardPvpHistoryWrite((list) => cardPvpHistoryAdd(list, entry));
  const before = cardPvpRatingBefore[entry.match];
  const bid = room.me && room.me.bid;
  if (!rankable || !before || !bid || entry.verify === 'ng') return;
  for (let i = 0; i < CARD_PVP_HISTORY_RATING_TRIES; i++) {
    await new Promise((ok) => setTimeout(ok, CARD_PVP_HISTORY_RATING_GAP_MS));
    const now = await sbFetchMyCardPvpRating(bid);
    if (now && now.games > before.games) {
      await cardPvpHistoryWrite((list) => cardPvpHistorySetRating(list, entry.match, { before: before.rating, after: now.rating }));
      return;
    }
  }
};

// ---- 画面: マルチの履歴 ----
// onBack … マルチ対戦の入口へ / onOpenReplay(match) … リプレイ(93・ミカエシくん)。replayHas(match) が真の試合だけ「▶ この対戦を見る」(どちらも 84 から 91 を通して渡す)
// 横画面では右の列が広いので、絵が大きくなりすぎないよう幅に上限(縦画面の幅と同じくらい。2026-10-27)
const CardPvpHistoryDeck = ({ db, deck, press, tone }) => (
  <div className="mx-auto w-full max-w-[440px] space-y-2">
    <div className="grid grid-cols-3 gap-1.5">
      {deck.monsters.map((no, i) => {
        const m = cardMonsterOf(db, no);
        return (
          <button type="button" key={`m${i}`} data-card-pvp-history-mon={no} {...press(no, () => {})} className="flex flex-col items-center rounded-lg bg-slate-900/80 p-0.5 active:scale-95">
            <img src={CARD_IMG(m ? m.img : no)} alt={m ? m.name : no} draggable={false} className="aspect-[5/7] w-full rounded-[5px] object-cover"/>
            <CardNameFit name={m ? m.name : no} className="mt-0.5 font-bold leading-tight text-slate-100"/>
          </button>
        );
      })}
    </div>
    <div data-card-pvp-history-cards={tone} className="grid grid-cols-5 gap-1">
      {cardPvpDeckGroups(deck.cards).map((g) => (
        <button type="button" key={g.no} data-card-pvp-history-card={g.no} {...press(g.no, () => {})} className="relative block rounded-md active:scale-95">
          <img src={CARD_IMG((cardOf(db, g.no) || {}).img || g.no)} alt={(cardOf(db, g.no) || {}).name || g.no} draggable={false} className="aspect-[5/7] w-full rounded-[5px] object-cover"/>
          {g.n > 1 && <span className="absolute bottom-0.5 right-0.5 rounded-md bg-slate-950/90 px-1 text-[10px] font-black text-white">×{g.n}</span>}
        </button>
      ))}
    </div>
  </div>
);
const CardPvpHistory = ({ db = CARD_BATTLE_DATA, onBack, onOpenReplay = null, replayHas = null, meIcon = null, meName = 'あなた' }) => {
  const [list, setList] = useState(null);
  const [sel, setSel] = useState(null);
  const [mine, setMine] = useState(false);
  const [detail, setDetail] = useState(null);
  const press = useCardLongPress((no) => setDetail(no));
  useEffect(() => { let alive = true; void cardPvpHistoryLoad().then((x) => { if (alive) setList(x); }); return () => { alive = false; }; }, []);
  const replayOk = (match) => !!onOpenReplay && typeof replayHas === 'function' && (() => { try { return !!replayHas(match); } catch (_) { return false; } })();
  const e = sel && list ? list.find((x) => x.match === sel) : null;
  const outcomeLabel = (x) => (x.outcome === 'win' ? '勝ち' : '負け');
  if (e) {
    const delta = cardPvpRatingDelta(e.rating);
    return (
      <div data-mh-screen data-card-pvp-history="detail" className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="マルチの対戦" accent="text-sky-200" onBack={() => { setSel(null); setMine(false); }} note={`${cardPvpHistoryWhen(e.at)}・${e.room === 'free' ? 'だれとでも' : '合言葉・フレンド'}`}/>
        <div className={`${SCREEN_LIST_CLASS} space-y-3 pb-4`}>
          <CardResultVsRow meIcon={meIcon} meName={meName} foeNode={<CardPvpAvatar icon={e.foe.icon} frame={e.foe.frame}/>} foeName={e.foe.name} outcome={outcomeLabel(e)}/>
          <p className="px-1 text-[12px] font-bold text-slate-300">
            {e.reason && e.reason !== outcomeLabel(e) ? `${e.reason}・` : ''}自分の番 {e.turns}回{delta ? `・強さ ${e.rating.after}(${delta})` : ''}
          </p>
          {replayOk(e.match) && <button type="button" data-card-pvp-history-replay className="mh-button mh-button-primary min-h-[48px] w-full rounded-2xl font-black" onClick={() => { Audio_.fgSe.tap(); onOpenReplay(e.match); }}>▶ この対戦を見る</button>}
          <div className="flex gap-2">
            <button type="button" data-card-pvp-history-tab="foe" className={`mh-button min-h-[40px] flex-1 rounded-xl text-[13px] font-black ${mine ? 'bg-slate-900 text-slate-300' : 'bg-sky-400 text-slate-950'}`} onClick={() => setMine(false)}>相手のデッキ</button>
            <button type="button" data-card-pvp-history-tab="me" className={`mh-button min-h-[40px] flex-1 rounded-xl text-[13px] font-black ${mine ? 'bg-sky-400 text-slate-950' : 'bg-slate-900 text-slate-300'}`} onClick={() => setMine(true)}>自分のデッキ</button>
          </div>
          {mine
            ? (e.myDeck ? <>{e.myDeck.name && <p className="px-1 text-[13px] font-black text-white">{e.myDeck.name}</p>}<CardPvpHistoryDeck db={db} deck={e.myDeck} press={press} tone="me"/></> : <p className="px-1 text-[13px] font-bold text-slate-400">記録がありません</p>)
            : e.foeDeck
              ? <>{e.foe.deckName && <p className="px-1 text-[13px] font-black text-white">{e.foe.deckName}</p>}<CardPvpHistoryDeck db={db} deck={e.foeDeck} press={press} tone="foe"/></>
              : (<>
                <p data-card-pvp-history-partial className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-2 text-[12px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap('相手が途中で抜けたので、この試合で使われた札だけです')}</p>
                {e.foeSeen.length
                  ? <CardPvpHistoryDeck db={db} deck={{ monsters: [], cards: e.foeSeen }} press={press} tone="seen"/>
                  : <p className="px-1 text-[13px] font-bold text-slate-400">使われた札はありません</p>}
              </>)}
          <p className="px-1 text-[11px] font-bold text-slate-400">長押しでカードを大きく見られます</p>
        </div>
        {detail && <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)}/>}
      </div>
    );
  }
  return (
    <div data-mh-screen data-card-pvp-history="list" className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="マルチの履歴" accent="text-sky-200" onBack={onBack} note={`新しい${CARD_PVP_HISTORY_MAX}試合まで・押すと相手のデッキ`}/>
      <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
        {list && list.length === 0 && <p className="rounded-2xl border border-white/10 bg-slate-900/80 p-3 text-[13px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap('まだマルチ対戦の記録はありません')}</p>}
        {(list || []).map((x) => {
          const delta = cardPvpRatingDelta(x.rating);
          return (
            <button type="button" key={x.match} data-card-pvp-history-row={x.match} onClick={() => { Audio_.fgSe.tap(); setSel(x.match); }} className="mh-button flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-2 py-2 text-left active:scale-[.98]">
              <CardPvpAvatar icon={x.foe.icon} frame={x.foe.frame}/>
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[14px] font-black text-white">{x.foe.name}</b>
                <small className="block text-[11px] font-bold text-slate-400 tabular-nums">{cardPvpHistoryWhen(x.at)}・{x.room === 'free' ? 'だれとでも' : '合言葉・フレンド'}{x.reason && x.reason !== outcomeLabel(x) ? `・${x.reason}` : ''}</small>
              </span>
              {delta && <span data-card-pvp-history-delta className={`shrink-0 text-[13px] font-black tabular-nums ${delta.startsWith('+') ? 'text-emerald-300' : delta.startsWith('-') ? 'text-rose-300' : 'text-slate-300'}`}>{delta}</span>}
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[12px] font-black ${x.outcome === 'win' ? 'bg-amber-300 text-slate-950' : 'bg-slate-700 text-slate-100'}`}>{outcomeLabel(x)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
