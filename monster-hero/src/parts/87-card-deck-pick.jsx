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
// auto … ほかのブリーダーと戦うときだけ { on, onChange, left, quick, onQuick }(quick … 結果だけ見る。2026-11-02)(オートで挑む・案B 2026-11-02)。left … 今日のごほうびの残り回数(読めていなければ null)
const CardDeckPick = ({ db, decks, collection, title = 'デッキをえらぶ', note = '', onPick, onBack, allowRented = false, rentTab = false, auto = null }) => {
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
        {auto && tab === 'own' && (
          <div data-card-deck-pick-auto={auto.on ? 'auto' : 'hand'} className="space-y-1.5">
            <div className="flex gap-1.5" role="radiogroup" aria-label="戦い方">
              {[[false, '🖐 自分で操作'], [true, '🤖 オート(戦術カード)']].map(([v, label]) => (
                <button key={String(v)} type="button" role="radio" aria-checked={auto.on === v} data-card-deck-pick-mode={v ? 'auto' : 'hand'}
                  onClick={() => { Audio_.fgSe.tap(); auto.onChange(v); }}
                  className={`min-h-[44px] flex-1 rounded-xl px-1 text-[13px] font-black ${auto.on === v ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>{label}</button>
              ))}
            </div>
            {auto.on && typeof auto.onQuick === 'function' && (
              <button type="button" role="switch" aria-checked={!!auto.quick} data-card-deck-pick-quick={auto.quick ? 'on' : 'off'} onClick={() => { Audio_.fgSe.tap(); auto.onQuick(!auto.quick); }}
                className={`flex min-h-[40px] w-full items-center gap-2 rounded-xl border px-2.5 text-left text-[12px] font-black ${auto.quick ? 'border-amber-300 bg-amber-950/40 text-amber-100' : 'border-slate-600 bg-slate-900 text-slate-200'}`}>
                <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${auto.quick ? 'border-amber-300 bg-amber-400 text-slate-950' : 'border-slate-400'}`}>{auto.quick ? '✓' : ''}</span>
                <span className="min-w-0 flex-1" style={JA_WRAP_STYLE}>{jaWrap('⏩ 結果だけ見る(対戦の画面を出さずに、一瞬で最後まで戦う)')}</span>
              </button>
            )}
            {auto.on && <CardAutoIntro/>}
            {auto.on && <p data-card-deck-pick-auto-note className="rounded-xl bg-slate-900/80 px-2.5 py-2 text-[11px] font-bold leading-snug text-slate-200" style={JA_WRAP_STYLE}>
              {jaWrap('選んだデッキの戦術カードで、あなたの側も自動で戦います。試合の途中で「自分で」に切り替えられます')}
              <span data-card-deck-pick-auto-left={auto.left === null ? '' : auto.left} className={`mt-1 block ${auto.left ? 'text-emerald-200' : 'text-amber-200'}`}>
                {auto.left === null ? '' : auto.left > 0 ? `今日のごほうびはあと${auto.left}回(自分で戦うときの半分)` : '今日のごほうびは終わりました。ごほうびなしで遊べます'}</span>
              {/* セッション券1枚でごほうびを1回ふやす(2026-11-07 社長・1日20回まで)。今日のごほうびを使い切ったときだけ出す。
                  押すと確認の窓(84)。券が0枚なら押せない。今日ふやせる回数を使い切ったら出さない */}
              {auto.left === 0 && typeof auto.onExtra === 'function' && Number.isInteger(auto.extraLeft) && (auto.extraLeft > 0 ? (<>
                <button type="button" data-card-auto-ticket disabled={!(auto.tickets > 0)} onClick={() => { Audio_.fgSe.tap(); auto.onExtra(); }}
                  className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1 rounded-xl border border-emerald-300 bg-emerald-900/70 px-2 text-[12px] font-black text-emerald-100 shadow-[0_0_10px_rgba(52,211,153,.45)] active:scale-[.98] disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-400 disabled:shadow-none" style={JA_WRAP_STYLE}>
                  {jaWrap('🎫 セッション券1枚でごほうびを1回ふやす')}</button>
                <span data-card-auto-ticket-left={auto.extraLeft} className="mt-1 block text-right text-[10px] text-slate-400" style={JA_WRAP_STYLE}>
                  {jaWrap(auto.tickets > 0 ? `持っているセッション券 ${auto.tickets}枚・今日ふやせるのはあと${auto.extraLeft}回` : 'セッション券がありません(モンヒロビートのランクが上がるともらえます)')}</span>
              </>) : <span data-card-auto-ticket-left="0" className="mt-1 block text-[10px] text-slate-400">今日はこれ以上ふやせません</span>)}
              {auto.ticketNote && <span data-card-auto-ticket-note className="mt-1 block text-[11px] text-emerald-200" style={JA_WRAP_STYLE}>{jaWrap(auto.ticketNote)}</span>}
            </p>}
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

// 🤖オートを初めて選んだときの助手の吹き出し(2026-11-07 社長「オート設定やクイックの誘導やチュートリアル」)。
//   文は ASSISTANT_QUICK_GUIDE_LINES の card.auto(56-quick-guide.jsx の quickGuideLine。無い助手はみゅあの文)。
//   「OK」を押したら二度と出さない。新しいキー mh_card_auto_intro_seen_v1(真偽値)だけを使う(CLAUDE.md ⑦)
const CardAutoIntro = () => {
  const bond = typeof useAssistantBond === 'function' ? useAssistantBond() : null;
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof CARD_AUTO_INTRO_SEEN_KEY !== 'string') return undefined;
    let cancelled = false;
    (async () => {
      let seen = false;
      try { seen = await storeGet(CARD_AUTO_INTRO_SEEN_KEY, false, false); } catch (_) { seen = false; }
      if (!cancelled && seen !== true) setShow(true);
    })();
    return () => { cancelled = true; };
  }, []);
  if (!show || typeof quickGuideLine !== 'function') return null;
  const id = bond && bond.assistantId ? bond.assistantId : 'mua';
  const line = quickGuideLine(id, 'card.auto');
  if (!line) return null;
  const who = typeof assistantById === 'function' ? assistantById(id) : null;
  const face = who && typeof assistantFaceImage === 'function' ? assistantFaceImage(who, line.e || 'normal') : null;
  return (
    <div data-card-auto-intro className="flex items-start gap-2 rounded-xl border-2 border-fuchsia-300/70 bg-slate-950/90 px-2.5 py-2">
      {face && <img src={face} alt="" aria-hidden="true" className="h-10 w-10 shrink-0 rounded-full border border-fuchsia-300/60 bg-slate-900 object-cover object-top"/>}
      <p className="min-w-0 flex-1 text-[11px] font-bold leading-snug text-slate-100" style={JA_WRAP_STYLE}>{typeof quickGuideNoBreak === 'function' ? quickGuideNoBreak(line.t) : line.t}</p>
      <button type="button" data-card-auto-intro-ok onClick={() => { setShow(false); storeSet(CARD_AUTO_INTRO_SEEN_KEY, true, false); }}
        className="min-h-[36px] shrink-0 self-center rounded-lg border border-fuchsia-300/70 bg-fuchsia-700/80 px-2.5 text-[11px] font-black text-white active:scale-[.97]">OK</button>
    </div>
  );
};
