// ==================== 対戦の前のデッキ選び ====================
// 2026-10-29 社長(案C): 助手と対戦・マルチ対戦の前に、使うデッキを選ぶ画面を1枚挟む。練習試合には挟まない。
//   前に使ったデッキ(mh_card_decks_v1 の active)がはじめから選ばれていて、そのまま「対戦へ」を押せば1手で始まる。
//   選んだデッキは active を書き換えるだけ(保存の形は変えない。書くのは 84 の CardBattleScreen)。
//   使えないデッキ(枚数が足りない・持っていないカードがある など)は、理由を出して選べないようにする。
// 選べるデッキの一覧は cardDeckPickChoices の1か所で作る。借りたデッキ(レンタル)は、ここに kind の違う行を足せば並ぶ
// opts.rented … みんなのデッキ(95)で借りたデッキ(cardRentedDeckGet の形)。あれば末尾に1行。借り物なので、持っているかは見ない(マルチでは渡さない)
const cardDeckPickChoices = (db, decks, collection, opts = {}) => {
  const own = ((decks && decks.decks) || []).map((d) => ({
    id: d.id, kind: 'own', name: d.name, monsters: d.monsters, count: d.cards.length,
    why: [...cardDeckProblems(db, d), ...cardDeckOwnProblems(db, d, collection || {})],
  }));
  const r = opts && opts.rented;
  if (!r || !r.deck) return own;
  return [...own, { id: 'rented', kind: 'rent', name: r.deckName || 'デッキ', owner: r.name, icon: r.icon || null, frame: r.frame || null,
    monsters: r.deck.monsters, count: r.deck.cards.length, deck: r.deck, ownerId: r.ownerId, version: r.version, why: cardDeckProblems(db, r.deck) }];
};

// allowRented … 借りたデッキも並べる(助手と対戦のとき。マルチでは並べない)
// rentTab … 「自分のデッキ/借りたデッキ」のタブにし、借りたデッキのタブで借りる・返すをする(2026-10-29 社長の作り直し「借りるのは対戦前のデッキを選ぶ画面のタブで」)。
//   公開の印(cardShareOpen)までは、デバッグの人だけ(84 が決める)。借りられるのは1組・マルチでは使えない、は今のまま
const CardDeckPick = ({ db, decks, collection, title = 'デッキをえらぶ', note = '', onPick, onBack, allowRented = false, rentTab = false }) => {
  const [rented, setRented] = useState(null);
  const [tab, setTab] = useState('own'); // own / rent
  const [cands, setCands] = useState(null); // 借りるデッキの候補(おすすめ・よく戦われている)
  const [rentMsg, setRentMsg] = useState('');
  const [rentBusy, setRentBusy] = useState(false);
  useEffect(() => {
    if (!allowRented || typeof cardRentedDeckGet !== 'function') return undefined;
    let alive = true;
    void cardRentedDeckGet().then((r) => { if (alive) setRented(r); });
    return () => { alive = false; };
  }, [allowRented]);
  const loadCands = async () => {
    setCands(null);
    const selfId = typeof ensureBreederId === 'function' ? await ensureBreederId().catch(() => null) : null;
    const [fresh, popular] = await Promise.all([cardShareFetchList({ sort: 'new', limit: 40 }), cardShareFetchList({ sort: 'popular', limit: 10 })]);
    setCands({ picks: cardSharePickSome(fresh, selfId, 3), popular: popular.filter((e) => e.ownerId !== selfId) });
  };
  useEffect(() => { if (rentTab && allowRented && tab === 'rent' && cands === null && typeof cardShareFetchList === 'function') void loadCands(); }, [tab]);
  const rentIt = async (e) => {
    if (rentBusy) return;
    setRentBusy(true); setRentMsg('');
    if (await cardRentedDeckSet(e)) { const r = await cardRentedDeckGet(); setRented(r); setSel('rented'); setRentMsg(`${e.name}さんのデッキを借りました`); }
    else setRentMsg('この端末に保存できなかったため、借りられませんでした');
    setRentBusy(false);
  };
  const giveBack = async () => {
    if (rentBusy) return;
    setRentBusy(true);
    if (await cardRentedDeckSet(null)) { setRented(null); setRentMsg('借りていたデッキを返しました'); }
    setRentBusy(false);
  };
  const choices0 = cardDeckPickChoices(db, decks, collection, { rented: allowRented ? rented : null });
  // タブの形: 自分のデッキのタブには自分のデッキだけ、借りたデッキのタブには借りたデッキだけ
  const choices = rentTab && allowRented ? choices0.filter((c) => (tab === 'rent' ? c.kind === 'rent' : c.kind !== 'rent')) : choices0;
  const usable = (c) => c && c.why.length === 0;
  const first = choices0.find((c) => c.id === decks.active && usable(c)) || choices0.find(usable) || null;
  const [sel, setSel] = useState(first ? first.id : null);
  const [busy, setBusy] = useState(false);
  const chosen = choices0.find((c) => c.id === sel && usable(c)) || null;
  const go = async () => {
    if (!chosen || busy) return;
    Audio_.fgSe.tap();
    setBusy(true);
    try { await onPick(chosen); } finally { setBusy(false); }
  };
  return (
    <div data-mh-screen data-card-deck-pick className={SCREEN_SHELL_CLASS}>
      <ScreenHead title={title} accent="text-amber-200" onBack={onBack}/>
      <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-2`}>
        {rentTab && allowRented && (
          <div data-card-deck-pick-tabs className="flex gap-1.5" role="tablist">
            {[['own', '自分のデッキ'], ['rent', '借りたデッキ']].map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} data-card-deck-pick-tab={id} onClick={() => { Audio_.fgSe.tap(); setTab(id); }}
                className={`flex-1 rounded-xl py-2 text-[13px] font-black ${tab === id ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>{label}</button>
            ))}
          </div>
        )}
        {note && tab === 'own' && <p className="text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{note}</p>}
        {choices.map((c) => {
          const on = c.id === sel;
          const ok = usable(c);
          return (
            <button key={c.id} type="button" data-card-deck-pick-row={c.id} data-card-deck-pick-on={on ? '1' : undefined} disabled={!ok}
              onClick={() => { Audio_.fgSe.tap(); setSel(c.id); }}
              className={`${SCREEN_PANEL_CLASS} flex w-full items-center gap-2 text-left active:scale-[.99] ${on ? '!border-amber-300 ring-2 ring-amber-300/70' : ''} ${ok ? '' : 'opacity-60'}`}>
              <span className="flex shrink-0 gap-0.5">{[0, 1, 2].map((i) => { const m = cardMonsterOf(db, c.monsters[i]); return m ? <img key={i} src={CARD_IMG(m.img)} alt={m.name} className="h-[52px] w-[37px] rounded-[4px] object-cover"/> : <span key={i} className="block h-[52px] w-[37px] rounded-[4px] border border-dashed border-white/20"/>; })}</span>
              <span className="min-w-0 flex-1">
                {c.kind === 'rent' && <span data-card-deck-pick-rent className="block text-[11px] font-black text-emerald-200">{`借りたデッキ(${c.owner || 'ブリーダー'}さんの)`}</span>}
                <span className="block text-[14px] font-black leading-tight text-white" style={JA_LABEL_STYLE}>{on ? '★ ' : ''}{jaWrap(c.name)}</span>
                <span className={`block text-[11px] font-bold ${ok ? 'text-emerald-300' : 'text-amber-200'}`}>{`${c.count}/${CARD_BATTLE_DECK_SIZE}枚`}</span>
                {!ok && <span data-card-deck-pick-why={c.id} className="block text-[11px] font-bold leading-snug text-amber-200" style={JA_WRAP_STYLE}>{c.why.join('・')}</span>}
              </span>
            </button>
          );
        })}
        {rentTab && allowRented && tab === 'rent' && (<>
          {rented ? (
            <button type="button" data-card-deck-pick-giveback disabled={rentBusy} onClick={() => { Audio_.fgSe.tap(); void giveBack(); }}
              className="w-full rounded-xl border border-emerald-300/50 bg-slate-900 py-1.5 text-[12px] font-black text-emerald-200 disabled:opacity-50">借りているデッキを返す</button>
          ) : <p className="text-[12px] font-bold text-slate-300">いま借りているデッキはありません。下から1組借りられます(マルチ対戦では使えません)</p>}
          {rentMsg && <p data-card-deck-pick-rent-msg className="rounded-xl bg-slate-900 p-2 text-[12px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{rentMsg}</p>}
          <div data-card-deck-pick-rent-list className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">借りるデッキをさがす</div>
            {cands === null ? <p className="mt-1 text-[12px] font-bold text-slate-300">読み込み中…</p> : (
              [['おすすめ', cands.picks], ['よく戦われている', cands.popular]].map(([label, rows]) => (
                <div key={label} className="mt-1.5">
                  <div className="text-[11px] font-black text-amber-200">{label}</div>
                  {rows.length ? rows.map((e) => (
                    <div key={`${label}-${e.ownerId}`} data-card-deck-pick-cand={e.ownerId} className="mt-1 flex items-center gap-2 rounded-xl bg-black/30 px-2 py-1.5">
                      {typeof CardPvpAvatar === 'function' && <CardPvpAvatar icon={e.icon} frame={e.frame} className="h-8 w-8"/>}
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13px] font-black text-white">{e.name}</b>
                        <small className="block truncate text-[11px] font-bold text-slate-300">{e.tactics.name || 'デッキ'}</small>
                        {typeof cardShareSmartText === 'function' && <small className="block text-[10px] font-black text-amber-200">{`賢さ ${cardShareSmartText(e.tactics)}`}</small>}
                      </span>
                      <button type="button" data-card-deck-pick-rent={e.ownerId} disabled={rentBusy || (rented && rented.ownerId === e.ownerId && rented.version === e.version)} onClick={() => { Audio_.fgSe.tap(); void rentIt(e); }}
                        className="mh-button mh-button-primary min-h-[34px] shrink-0 rounded-lg px-3 text-[12px] font-black disabled:opacity-50">{rented && rented.ownerId === e.ownerId && rented.version === e.version ? '借りています' : '借りる'}</button>
                    </div>
                  )) : <p className="mt-1 text-[12px] font-bold text-slate-400">まだだれも登録していません</p>}
                </div>
              ))
            )}
            <button type="button" data-card-deck-pick-rent-reload className="mt-2 w-full rounded-xl border border-white/15 bg-slate-900 py-1.5 text-[12px] font-black text-slate-200" onClick={() => { Audio_.fgSe.tap(); void loadCands(); }}>ほかの人をさがす</button>
          </div>
        </>)}
        {!first && tab === 'own' && <p data-card-deck-pick-none className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>対戦に使えるデッキがありません。デッキ編成で組んでください</p>}
      </div>
      <div className={SCREEN_FOOTER_CLASS}>
        <button type="button" data-card-deck-pick-go disabled={!chosen || busy} onClick={() => { void go(); }}
          className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black active:scale-[.98] disabled:opacity-40">対戦へ</button>
      </div>
    </div>
  );
};
