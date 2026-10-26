// ==================== 画面: MFバトルカード デッキ編成・カード図鑑・ルールの画面(区切り2) ====================
// トップの「デッキ編成」から入る(社長: デッキ編成はトップ画面に置く)。設計: docs/spec/CARD_BATTLE.md 5-2
//   CardDeckList   … デッキの一覧(5つまで)。使うデッキを決める・組む・新しく作る・コピー・消す
//   CardDeckEditor … 1つのデッキを組む。上にモンスター3体の枠、下に持っているカード(タブ: 技/モンスター/デッキの中)
// ★決まり(同じモンスターは1体まで・同じ名前のカードは3枚まで・50枚)は 82-card-battle-core.jsx の
//   cardDeckProblems / cardDeckAddReason / cardDeckOwnProblems が正本。この部品は画面だけを持つ
// ★保存は CardBattleScreen が mh_card_decks_v1 へ入れる(この部品は保存しない)
// ★50枚そろっていなくても「保存」はできる。対戦に使えるのは、決まりどおりで持っている枚数の中のデッキだけ

const CARD_DECK_FILTERS = Object.freeze([
  { id: 'all', label: '全部' }, { id: 'pow', label: 'ちから' }, { id: 'int', label: 'かしこさ' }, { id: 'spe', label: '特殊' },
  { id: 'dge', label: '回避' }, { id: 'blk', label: '防御' }, { id: 'any', label: '全モンスター' }, { id: 'breeder', label: 'ブリーダー' }, { id: 'fld', label: '全体' },
]);
// 全体カード(fld)は「ブリーダー」にも「全体」にも出る(使う人はブリーダー)
const cardDeckFilterOk = (c, f) => (f === 'all' ? true : f === 'any' ? c.user === 'any' : f === 'breeder' ? c.user === 'breeder' : f === 'fld' ? c.kind === 'fld' : c.kind === f && c.user !== 'any' && c.user !== 'breeder');

// 1枚のカード(小さい絵)。右上に「デッキの枚数/持っている枚数」
const CardDeckTile = ({ db, no, inDeck = 0, owned = 0, dim = false, press, onTap, mark = '' }) => {
  const c = cardOf(db, no); const m = c ? null : cardMonsterOf(db, no);
  const name = c ? c.name : m ? m.name : no;
  return (
    <button type="button" data-card-deck-tile={no} {...press(no, onTap)} className={`relative flex flex-col items-center rounded-lg p-0.5 text-center active:scale-95 ${dim ? 'opacity-40' : ''} ${inDeck > 0 ? 'bg-emerald-500/15 ring-2 ring-emerald-300/70' : 'bg-white/5'}`} style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
      {/* 「入/持」の札は絵の右下(カードの名前は絵の上にあるので、上に置くと名前が隠れた。2026-10-24 改善部の点検 V5) */}
      <span className="relative block w-full">
        <img src={CARD_IMG(c ? c.img : m ? m.img : no)} alt={name} draggable={false} onDragStart={(e) => e.preventDefault()} className="aspect-[5/7] w-full rounded-[5px] object-cover"/>
        <span data-card-deck-badge className="absolute bottom-0.5 right-0.5 rounded-md bg-slate-950/90 px-1 text-[10px] font-black text-white"><span className="text-emerald-300">入{inDeck}</span>/持{owned}</span>
      </span>
      {mark && <span className="absolute left-0.5 top-0.5 rounded-md bg-amber-400 px-1 text-[9px] font-black text-slate-950">{mark}</span>}
      <CardNameFit name={name} className="mt-0.5 font-bold leading-tight text-slate-100"/>
    </button>
  );
};

// 絞り込み(1列。2026-10-25 社長「外し方がわからない・カード選択のエリアがせまい」で、タブをやめて案A)
//   mon … モンスター / deck … デッキに入れたもの(モンスターも) / ほか … 技など(CARD_DECK_FILTERS)
const CARD_DECK_VIEWS = Object.freeze([{ id: 'mon', label: 'モンスター' }, { id: 'deck', label: 'デッキに入れた' }, ...CARD_DECK_FILTERS.map((f) => (f.id === 'all' ? { ...f, label: '技など全部' } : f))]);
const CARD_DECK_SORTS = Object.freeze([{ id: 'kind', label: '種類順' }, { id: 'guts', label: 'ガッツ順' }, { id: 'no', label: '番号順' }]);
// 選ぶ場所の1枚: 絵(押すと1枚入れる・長押しで詳しく)と、下に「− 入れた/入れられる ＋」
const CardDeckPickTile = ({ db, no, inDeck, limit, canAdd, press, onAdd, onRemove }) => {
  const c = cardOf(db, no); const m = c ? null : cardMonsterOf(db, no);
  const name = c ? c.name : m ? m.name : no;
  return (
    <div data-card-deck-pick={no} className={`relative flex min-w-0 flex-col rounded-lg p-0.5 ${inDeck > 0 ? 'bg-emerald-500/15 ring-2 ring-emerald-300/70' : 'bg-white/5'}`}>
      <button type="button" data-card-deck-tile={no} {...press(no, onAdd)} className={`block w-full active:scale-95 ${!canAdd && inDeck === 0 ? 'opacity-45' : ''}`} style={{ WebkitUserSelect: 'none', userSelect: 'none' }} aria-label={`${name}を1枚入れる`}>
        <img src={CARD_IMG(c ? c.img : m ? m.img : no)} alt={name} draggable={false} onDragStart={(e) => e.preventDefault()} className="aspect-[5/7] w-full rounded-[5px] object-cover"/>
      </button>
      <CardNameFit name={name} className="mt-0.5 font-bold leading-tight text-slate-100"/>
      <div className="mt-0.5 flex items-center justify-between gap-0.5">
        <button type="button" data-card-deck-minus={no} disabled={inDeck === 0} onClick={onRemove} aria-label={`${name}を1枚外す`} className="flex h-[28px] w-[27px] shrink-0 items-center justify-center rounded-md bg-rose-600 text-[18px] font-black leading-none text-white active:scale-90 disabled:bg-slate-700 disabled:text-slate-500">−</button>
        <span data-card-deck-in={no} className="min-w-0 whitespace-nowrap text-center text-[11px] font-black tabular-nums text-white">{inDeck}<span className="text-[9px] text-slate-400">/{limit}</span></span>
        <button type="button" data-card-deck-plus={no} disabled={!canAdd} onClick={onAdd} aria-label={`${name}を1枚入れる`} className="flex h-[28px] w-[27px] shrink-0 items-center justify-center rounded-md bg-emerald-600 text-[18px] font-black leading-none text-white active:scale-90 disabled:bg-slate-700 disabled:text-slate-500">＋</button>
      </div>
    </div>
  );
};
const CardDeckEditor = ({ db, collection, deck: deck0, onSave, onCancel, advisor = null }) => {
  const [deck, setDeck] = useState(() => ({ ...deck0, monsters: deck0.monsters.slice(), cards: deck0.cards.slice() }));
  const [view, setView] = useState(deck0.monsters.length < 3 ? 'mon' : 'all');
  const [sort, setSort] = useState('kind');
  const [usableOnly, setUsableOnly] = useState(true);
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null);
  const [leave, setLeave] = useState(false);
  // デッキ相談(助手のおしゃべり AI・83-card-battle-talk-ai.jsx)。advisor … トップの助手 { id, name, accent, face }
  //   ask … null / { busy } / { text, face, picks }。届かないときは決まった一言を出す(勧めるカードは出さない)
  const [ask, setAsk] = useState(null);
  const press = useCardLongPress((no) => setDetail(no));
  // 背の低い画面(SE・320幅)では上の枠を小さくして、カードの一覧を広く見せる(2026-10-24 改善部の点検 V5)。縦の画面のときだけ
  const short = typeof window !== 'undefined' && window.innerHeight < 760 && window.innerHeight > window.innerWidth;
  // 横の画面か(保存のボタンを左の列に置くか、下に置くか。ボタンは1つだけ描く)
  const [land, setLand] = useState(() => typeof window !== 'undefined' && window.innerWidth > window.innerHeight);
  useEffect(() => { const on = () => setLand(window.innerWidth > window.innerHeight); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const col = collection || {};
  const changed = JSON.stringify(deck) !== JSON.stringify(deck0);
  const rules = cardDeckProblems(db, deck);
  const own = cardDeckOwnProblems(db, deck, col);
  const ready = rules.length === 0 && own.length === 0;
  const mons = deck.monsters.map((no) => ({ ...cardMonsterOf(db, no), ko: false })).filter((m) => m && m.no);
  const countOf = (no) => deck.cards.filter((x) => x === no).length + deck.monsters.filter((x) => x === no).length;
  const add = (no) => {
    const why = cardDeckAddReason(db, deck, no, col);
    if (why) { setNotice(why); return; }
    Audio_.fgSe.tap();
    setNotice('');
    if (cardMonsterOf(db, no)) setDeck((d) => ({ ...d, monsters: [...d.monsters, no] }));
    else setDeck((d) => ({ ...d, cards: [...d.cards, no] }));
  };
  const removeOne = (no) => {
    Audio_.fgSe.tap();
    setNotice('');
    setDeck((d) => {
      if (d.monsters.includes(no)) return { ...d, monsters: d.monsters.filter((x) => x !== no) };
      const k = d.cards.lastIndexOf(no);
      return k < 0 ? d : { ...d, cards: [...d.cards.slice(0, k), ...d.cards.slice(k + 1)] };
    });
  };
  const sortKey = (no) => {
    const c = cardOf(db, no);
    if (sort === 'guts' && c) return `${String(c.guts ?? 9).padStart(2, '0')}-${cardSortKey(db, no)}`;
    if (sort === 'no') return String(no).padStart(6, '0');
    return cardSortKey(db, no);
  };
  const bySort = (a, b) => (sortKey(a) < sortKey(b) ? -1 : 1);
  // 持っているカード(準備中は出さない)
  const ownedCards = Object.keys(col).filter((no) => { const c = cardOf(db, no); return c && c.ready && col[no] > 0; });
  const ownedMons = Object.keys(col).filter((no) => cardMonsterOf(db, no) && col[no] > 0).sort();
  const usable = (no) => { const c = cardOf(db, no); return !usableOnly || !mons.length || c.user === 'breeder' || mons.some((m) => cardUsableBy(c, m)); };
  const shown = view === 'mon' ? ownedMons
    : view === 'deck' ? [...deck.monsters, ...[...new Set(deck.cards)].sort(bySort)]
      : ownedCards.filter((no) => cardDeckFilterOk(cardOf(db, no), view) && usable(no)).sort(bySort);
  const tile = (no) => {
    const inDeck = countOf(no);
    const limit = cardMonsterOf(db, no) ? 1 : Math.min(3, col[no] || 0);
    return <CardDeckPickTile key={no} db={db} no={no} inDeck={inDeck} limit={limit} canAdd={!cardDeckAddReason(db, deck, no, col)} press={press} onAdd={() => add(no)} onRemove={() => removeOne(no)}/>;
  };
  const chip = (on) => `shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${on ? 'bg-amber-300 text-slate-950' : 'border border-white/20 bg-slate-900 text-slate-300'}`;
  const footer = (
    <div className={`${SCREEN_FOOTER_CLASS} grid grid-cols-2 gap-2 ${land ? 'mt-auto' : ''}`}>
      <button type="button" data-card-deck-save className={`mh-button mh-button-primary ${land ? 'min-h-[44px]' : 'min-h-[52px]'} rounded-2xl font-black active:scale-[.98]`} onClick={() => { Audio_.fgSe.tap(); onSave({ ...deck, name: (deck.name || '').trim() || 'デッキ' }); }}>保存する</button>
      <button type="button" className={`mh-button mh-button-secondary ${land ? 'min-h-[44px]' : 'min-h-[52px]'} rounded-2xl border border-white/20 bg-slate-800 font-black active:scale-[.98]`} onClick={() => (changed ? setLeave(true) : onCancel())}>やめる</button>
    </div>
  );
  const sortLabel = (CARD_DECK_SORTS.find((x) => x.id === sort) || CARD_DECK_SORTS[0]).label;
  const canAsk = !!advisor && cardAiTalkOn() && deck.monsters.length > 0;
  const consult = async () => {
    Audio_.fgSe.tap();
    setAsk({ busy: true });
    const r = await cardTalkFetch('deck', { who: advisor.id, facts: cardTalkDeckFacts(db, deck, col) });
    setAsk(r ? { text: r.text, face: r.face, picks: cardTalkCheckPicks(db, deck, col, r.picks) } : { text: CARD_TALK_DECK_SORRY, face: 'troubled', picks: [] });
  };
  return (
    <div data-mh-screen data-card-deck-edit className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="デッキを組む" accent="text-amber-200" onBack={() => (changed ? setLeave(true) : onCancel())}/>
      {/* 横の画面は左右に分ける: 左に名前・モンスター・枚数・絞り込み・保存、右を全部カードの一覧にする */}
      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row landscape:gap-2">
        <div className="flex shrink-0 flex-col landscape:min-h-0 landscape:w-[36%] landscape:max-w-[340px] landscape:overflow-y-auto">
          <div className={`${SCREEN_PANEL_FLAT_CLASS} shrink-0 space-y-1.5`}>
            <input data-card-deck-name value={deck.name} maxLength={20} onChange={(e) => setDeck((d) => ({ ...d, name: e.target.value }))} className="w-full rounded-lg border border-white/20 bg-slate-950 px-2 py-1.5 text-[14px] font-black text-white landscape:py-1 landscape:text-[13px]" aria-label="デッキの名前"/>
            <div className="flex items-end gap-1.5">
              {[0, 1, 2].map((i) => {
                const no = deck.monsters[i];
                const m = no ? cardMonsterOf(db, no) : null;
                const size = short ? { maxWidth: 'min(52px, 6vh)' } : undefined;
                return m
                  ? <button key={i} type="button" data-card-deck-mon={i} {...press(no, () => removeOne(no))} aria-label={`${m.name}を外す`} className="relative w-[15%] max-w-[52px] active:scale-95 landscape:max-w-[40px]" style={size}><img src={CARD_IMG(m.img)} alt={m.name} draggable={false} className="aspect-[5/7] w-full rounded-[5px] object-cover"/><span className="absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-rose-600 text-[13px] font-black leading-none text-white shadow">−</span></button>
                  : <button key={i} type="button" data-card-deck-mon={i} onClick={() => setView('mon')} style={size} className="flex aspect-[5/7] w-[15%] max-w-[52px] items-center justify-center rounded-[5px] border-2 border-dashed border-white/30 text-[18px] text-white/50 landscape:max-w-[40px]">＋</button>;
              })}
              <div className="min-w-0 flex-1 text-right">
                <div data-card-deck-count className={`text-[20px] font-black ${deck.cards.length === CARD_BATTLE_DECK_SIZE ? 'text-emerald-300' : 'text-white'}`}>{deck.cards.length}<span className="text-[12px] text-slate-400">/{CARD_BATTLE_DECK_SIZE}枚</span></div>
                <div data-card-deck-ready={ready ? 'ok' : 'ng'} className={`text-[11px] font-black ${ready ? 'text-emerald-300' : 'text-amber-200'}`}>{ready ? '対戦に使えます' : 'まだ対戦に使えません'}</div>
              </div>
            </div>
            {!ready && <div data-card-deck-problems className="text-[11px] font-bold leading-snug text-rose-300" style={JA_WRAP_STYLE}>{[...rules, ...own].slice(0, 2).join(' / ')}</div>}
            {notice && <div data-card-deck-notice className="text-[12px] font-black text-amber-200" style={JA_LABEL_STYLE}>{jaWrap(notice)}</div>}
          </div>
          {/* 絞り込みは1列(縦は横に流す・横の画面は折り返す) */}
          {/* 縦の画面では右端をぼかして、横に続きがあると分かるようにする(端で札が半分に切れて、壊れて見えた。2026-10-26 見回り) */}
          <div data-card-deck-chips className="mh-scroll mt-1.5 flex shrink-0 gap-1 overflow-x-auto pb-1 pr-6 landscape:flex-wrap landscape:overflow-visible landscape:pr-0" style={land ? undefined : { WebkitMaskImage: 'linear-gradient(to right, #000 82%, transparent)', maskImage: 'linear-gradient(to right, #000 82%, transparent)' }}>
            {CARD_DECK_VIEWS.map((f) => <button key={f.id} type="button" data-card-deck-filter={f.id} onClick={() => { setView(f.id); setNotice(''); }} className={chip(view === f.id)}>{f.id === 'mon' ? `モンスター ${deck.monsters.length}/3` : f.id === 'deck' ? `デッキに入れた ${deck.cards.length}枚+${deck.monsters.length}体` : f.label}</button>)}
            {canAsk && <button type="button" data-card-deck-ask onClick={() => { void consult(); }} className={chip(false)}>💬 {advisor.name}に相談</button>}
            <button type="button" data-card-deck-usable onClick={() => setUsableOnly((v) => !v)} className={chip(usableOnly)}>{usableOnly ? '✓ ' : ''}使える子だけ</button>
            <button type="button" data-card-deck-sort={sort} onClick={() => setSort((s) => CARD_DECK_SORTS[(CARD_DECK_SORTS.findIndex((x) => x.id === s) + 1) % CARD_DECK_SORTS.length].id)} className={chip(false)}>並び: {sortLabel} ▾</button>
          </div>
          {land && footer}
        </div>
        <div className={`${SCREEN_LIST_CLASS} pb-2 landscape:flex-1`}>
          {view === 'mon' && <p className="mb-1 text-[11px] font-bold text-slate-400" style={JA_LABEL_STYLE}>{jaWrap('3体えらびます。同じモンスターは1体まで(キラも同じモンスター)')}</p>}
          {shown.length
            ? <div data-card-deck-grid className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>{shown.map(tile)}</div>
            : <ScreenEmpty emoji="🃏" lines={view === 'deck' ? ['まだカードが入っていません', '「技など全部」から入れてください'] : ['当てはまるカードがありません']}/>}
        </div>
      </div>
      {!land && footer}
      {ask && (
        <div data-card-deck-ask-sheet className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-2 sm:items-center" onClick={() => { if (!ask.busy) setAsk(null); }}>
          <div className="w-full max-w-[420px] rounded-2xl border border-white/15 bg-slate-900 p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-2">
              {advisor.face && <img src={advisor.face} alt="" className="h-12 w-12 shrink-0 rounded-full border-2 object-cover" style={{ borderColor: advisor.accent }}/>}
              <div data-card-deck-ask-text className="min-w-0 flex-1 rounded-2xl border-2 bg-white px-2 py-1.5 text-[13px] font-extrabold leading-snug text-[#1f1333]" style={{ borderColor: advisor.accent, ...JA_WRAP_STYLE }}>{ask.busy ? 'うーん、どうしようかな…' : ask.text}</div>
            </div>
            {!ask.busy && ask.picks.length > 0 && (
              <div className="mt-2 space-y-1">
                {ask.picks.map((p) => {
                  const why = cardDeckAddReason(db, deck, p.no, col);
                  return (
                    <div key={p.no} data-card-deck-ask-pick={p.no} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-2 py-1">
                      <button type="button" onClick={() => setDetail(p.no)} className="min-w-0 flex-1 text-left">
                        <b className="block text-[12px] font-black text-white">{p.name}</b>
                        {p.reason && <small className="block text-[10px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{p.reason}</small>}
                      </button>
                      <button type="button" disabled={!!why} onClick={() => add(p.no)} className={`min-h-[36px] shrink-0 rounded-full px-3 text-[11px] font-black ${why ? 'border border-white/15 bg-slate-800 text-slate-500' : 'bg-amber-300 text-slate-950 active:scale-95'}`}>{why ? '入れられない' : '入れる'}</button>
                    </div>
                  );
                })}
              </div>
            )}
            {!ask.busy && <button type="button" onClick={() => { Audio_.fgSe.tap(); setAsk(null); }} className="mh-button mh-button-secondary mt-2 min-h-[44px] w-full rounded-2xl border border-white/20 bg-slate-800 font-black">閉じる</button>}
          </div>
        </div>
      )}
      {detail && <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)}/>}
      {leave && <ConfirmSheet title="保存せずに戻りますか？" message="組みかえたところは消えます" confirmLabel="保存せずに戻る" danger onCancel={() => setLeave(false)} onConfirm={() => { setLeave(false); onCancel(); }}/>}
    </div>
  );
};

const CardDeckList = ({ db, collection, decks, onBack, onEdit, onPut, onRemove, onActive }) => {
  const [confirmDel, setConfirmDel] = useState(null);
  const col = collection || {};
  const full = decks.decks.length >= CARD_DECK_MAX;
  const btn = 'mh-button min-h-[40px] rounded-xl text-[12px] font-black active:scale-[.98] disabled:opacity-40';
  return (
    <div data-mh-screen data-card-deck-list className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="デッキ編成" accent="text-amber-200" onBack={onBack}/>
      <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-2`}>
        <p className="text-[11px] font-bold text-slate-400">デッキは{CARD_DECK_MAX}つまで。★のデッキで対戦します</p>
        {decks.decks.map((d) => {
          const ready = cardDeckReady(db, d, col);
          const on = d.id === decks.active;
          return (
            <div key={d.id} data-card-deck-row={d.id} className={`${SCREEN_PANEL_CLASS} ${on ? 'border-amber-300/70' : ''}`}>
              <div className="flex items-center gap-2">
                <div className="flex shrink-0 gap-0.5">{[0, 1, 2].map((i) => { const m = cardMonsterOf(db, d.monsters[i]); return m ? <img key={i} src={CARD_IMG(m.img)} alt={m.name} className="h-[52px] w-[37px] rounded-[4px] object-cover"/> : <div key={i} className="h-[52px] w-[37px] rounded-[4px] border border-dashed border-white/25"/>; })}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-black text-white">{on ? '★ ' : ''}{d.name}</div>
                  <div className={`text-[11px] font-bold ${ready ? 'text-emerald-300' : 'text-amber-200'}`}>{d.cards.length}/{CARD_BATTLE_DECK_SIZE}枚・{ready ? '対戦に使えます' : 'まだ対戦に使えません'}</div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1">
                <button type="button" data-card-deck-use={d.id} disabled={on || !ready} className={`${btn} ${on ? 'bg-amber-300 text-slate-950' : 'border border-amber-300/50 bg-amber-900/40 text-amber-100'}`} onClick={() => { Audio_.fgSe.tap(); onActive(d.id); }}>{on ? '使用中' : '使う'}</button>
                <button type="button" data-card-deck-open={d.id} className={`${btn} mh-button-primary`} onClick={() => { Audio_.fgSe.tap(); onEdit(d); }}>組む</button>
                <button type="button" data-card-deck-copy={d.id} disabled={full} className={`${btn} border border-white/20 bg-slate-800`} onClick={() => { Audio_.fgSe.tap(); onPut({ ...d, id: cardNewDeckId(decks.decks, Date.now()), name: `${d.name}のコピー`.slice(0, 20), monsters: d.monsters.slice(), cards: d.cards.slice() }); }}>コピー</button>
                <button type="button" data-card-deck-del={d.id} disabled={decks.decks.length <= 1} className={`${btn} border border-rose-300/40 bg-rose-950/50 text-rose-100`} onClick={() => setConfirmDel(d)}>消す</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className={SCREEN_FOOTER_CLASS}>
        <button type="button" data-card-deck-new disabled={full} className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black active:scale-[.98] disabled:opacity-40" onClick={() => { Audio_.fgSe.tap(); onEdit({ id: cardNewDeckId(decks.decks, Date.now()), name: `デッキ${decks.decks.length + 1}`, monsters: [], cards: [] }); }}>{full ? `デッキは${CARD_DECK_MAX}つまでです` : '新しいデッキを作る'}</button>
      </div>
      {confirmDel && <ConfirmSheet title={`「${confirmDel.name}」を消しますか？`} message="デッキだけを消します(カードは消えません)" confirmLabel="消す" danger onCancel={() => setConfirmDel(null)} onConfirm={() => { const id = confirmDel.id; setConfirmDel(null); onRemove(id); }}/>}
    </div>
  );
};

// ==================== カード図鑑(区切り2) ====================
// 持っている/持っていない・枚数・準備中。持っていないカードは暗い絵で出す(何が集まるか分かるように)
// ★C-060C(ファンの描いた絵)はカードの表に入っていない(社長)。並べるのはカードの表にあるものだけ
// 見かたは3つ(2026-10-26 社長「血統ごと・種類ごとでも見られるように」。名前は社長が選んだ「パック別・血統別・種類別」):
//   パック別 … パックと同じ第1〜8弾+混血(2026-10-25 社長「パックは8弾まで」)。混血は、その弾と「混血」の両方に出る
//   血統別   … パックの弾の順に種族を並べる。混血はメインの種族に出る。全モンスター・ブリーダー・全体のカードは「種類別」で見る
//   種類別   … デッキ編成の絞り込み(CARD_DECK_FILTERS)と同じ言葉と並び。先頭に「モンスター」
// どの見かたでも、並べるカードは弾ごとの図鑑と同じもの(数え方がずれないように、全部の集まりから絞る)
const CARD_DEX_MODES = Object.freeze([{ id: 'pack', label: 'パック別' }, { id: 'species', label: '血統別' }, { id: 'kind', label: '種類別' }]);
const CARD_DEX_TABS = Object.freeze([...CARD_PACKS.map((p) => ({ id: String(p.no), label: `第${p.no}弾` })), { id: 'hybrid', label: '混血' }]);
const CARD_DEX_KINDS = Object.freeze([{ id: 'mon', label: 'モンスター' }, ...CARD_DECK_FILTERS.filter((f) => f.id !== 'all')]);
const cardDexList = (db, tab) => {
  if (tab === 'hybrid') return Object.values(db.monsters).filter((m) => String(m.wave) === 'hybrid').map((m) => m.no).sort();
  const pack = CARD_PACKS.find((p) => String(p.no) === tab);
  if (!pack) return [];
  const all = cardPackAllCards(db, pack);
  return [...all.monsters, ...all.cards];
};
const cardDexAll = (db) => [...new Set(CARD_DEX_TABS.flatMap((t) => cardDexList(db, t.id)))];   // 混血は弾のタブと「混血」の両方にあるので1回だけ数える
const cardDexSpeciesOf = (db, no) => {
  const m = cardMonsterOf(db, no);
  if (m) return String(m.wave) === 'hybrid' ? m.main : m.species;
  const c = cardOf(db, no);
  return c && c.user !== 'any' && c.user !== 'breeder' ? c.user : null;
};
// 見かたごとのタブ。label は図鑑の札に出す名前(血統は、その種族のふつうのモンスターカードの名前)
const cardDexTabsOf = (db, mode) => {
  if (mode === 'species') return CARD_PACKS.flatMap((p) => p.species).map((sp) => ({ id: sp, label: (Object.values(db.monsters).find((m) => m.species === sp && !m.variant) || {}).name || sp }));
  if (mode === 'kind') return CARD_DEX_KINDS;
  return CARD_DEX_TABS;
};
const cardDexListOf = (db, mode, tab, all = cardDexAll(db)) => {
  if (mode === 'species') return all.filter((no) => cardDexSpeciesOf(db, no) === tab);
  if (mode === 'kind') return all.filter((no) => (tab === 'mon' ? !!cardMonsterOf(db, no) : !cardMonsterOf(db, no) && !!cardOf(db, no) && cardDeckFilterOk(cardOf(db, no), tab)));
  return cardDexList(db, tab);
};
const CARD_DEX_UNIT = Object.freeze({ pack: 'このパック', species: 'この血統', kind: 'この種類' });
const CardDex = ({ db, collection, onBack }) => {
  const [mode, setMode] = useState('pack');
  const [tabs, setTabs] = useState({ pack: '1', species: CARD_PACKS[0].species[0], kind: 'mon' });
  const [show, setShow] = useState('all');
  const [detail, setDetail] = useState(null);
  const press = useCardLongPress((no) => setDetail(no));
  const col = collection || {};
  const all = useMemo(() => cardDexAll(db), [db]);
  const tabList = useMemo(() => cardDexTabsOf(db, mode).map((t) => ({ ...t, list: cardDexListOf(db, mode, t.id, all) })), [db, mode, all]);
  const tab = tabs[mode];
  const list = (tabList.find((t) => t.id === tab) || tabList[0] || { list: [] }).list;
  const shown = list.filter((no) => (show === 'have' ? col[no] > 0 : show === 'miss' ? !(col[no] > 0) : true));
  const haveIn = (arr) => arr.filter((no) => col[no] > 0).length;
  const chip = (on) => `shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ${on ? 'bg-amber-300 text-slate-950' : 'border border-white/20 bg-slate-900 text-slate-300'}`;
  const unit = CARD_DEX_UNIT[mode];
  // 選んでいる札を見える所へ(見かたを替えたとき、前の見かたの横の位置が残って選んだ札が隠れていた)
  const tabRow = useRef(null);
  //   ★scrollIntoView は使わない(縦にも動いて画面ごとずれる。viewport-height-check)。列の横の位置だけを動かす
  useEffect(() => {
    try {
      const row = tabRow.current; const el = row && row.querySelector('[aria-pressed="true"]');
      if (!el) return;
      if (el.offsetLeft < row.scrollLeft) row.scrollLeft = el.offsetLeft - 8;
      else if (el.offsetLeft + el.offsetWidth > row.scrollLeft + row.clientWidth) row.scrollLeft = el.offsetLeft + el.offsetWidth - row.clientWidth + 8;
    } catch (_) { /* 古い端末は動かさない */ }
  }, [mode, tab]);
  return (
    <div data-mh-screen data-card-dex className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="カード図鑑" accent="text-amber-200" onBack={onBack}/>
      <div className={`${SCREEN_PANEL_FLAT_CLASS} mb-2 shrink-0 text-[12px] font-bold text-slate-300`}>
        集めた種類 <b data-card-dex-total className="text-[15px] text-amber-200">{haveIn(all)}</b> / {all.length}
        <span data-card-dex-part className="ml-2 text-slate-400">({unit} {haveIn(list)} / {list.length})</span>
      </div>
      <ScreenTabs value={mode} onChange={(m) => { setMode(m); }} items={CARD_DEX_MODES.map((t) => ({ id: t.id, label: t.label }))}/>
      {/* 見かたの中の札は1列で横に流す(横の画面でも折り返さない。血統別の24個を折り返すと左の列からはみ出し、下の「全部・持っている・まだ」が画面の外に出た)。札ごとに集めた数を出す
          ★mh-scroll を付けない。横画面では「mh-scroll の付いた子」を右の列いっぱいの一覧として置くので、札が一覧に重なって押せなくなった(2026-10-26 見回り) */}
      <div key={mode} ref={tabRow} data-card-dex-tabs={mode} className="relative mb-1 flex shrink-0 gap-1 overflow-x-auto pb-1">
        {tabList.map((t) => (
          <button key={t.id} type="button" data-card-dex-tab={t.id} aria-pressed={t.id === tab} onClick={() => setTabs((v) => ({ ...v, [mode]: t.id }))} className={chip(t.id === tab)}>
            {t.label}<span className={`ml-1 text-[10px] ${t.id === tab ? 'text-slate-800' : 'text-slate-500'}`}>{haveIn(t.list)}/{t.list.length}</span>
          </button>
        ))}
      </div>
      <div className="mb-1.5 flex shrink-0 gap-1">
        {[['all', '全部'], ['have', '持っている'], ['miss', 'まだ']].map(([k, label]) => <button key={k} type="button" data-card-dex-show={k} onClick={() => setShow(k)} className={chip(show === k)}>{label}</button>)}
      </div>
      <div className={`${SCREEN_LIST_CLASS} pb-2`}>
        {shown.length ? (
          <div className="grid grid-cols-4 gap-1.5">
            {shown.map((no) => {
              const c = cardOf(db, no); const m = c ? null : cardMonsterOf(db, no);
              const have = col[no] || 0;
              const name = c ? c.name : m ? `${m.name}${m.variant ? `(${m.variant})` : ''}` : no;
              return (
                <button key={no} type="button" data-card-dex-tile={no} data-card-dex-have={have} {...press(no, () => setDetail(no))} className="relative flex flex-col items-center rounded-lg bg-white/5 p-0.5 text-center active:scale-95" style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
                  <img src={CARD_IMG(c ? c.img : m ? m.img : no)} alt={name} loading="lazy" draggable={false} className={`aspect-[5/7] w-full rounded-[5px] object-cover ${have ? '' : 'opacity-30 grayscale'}`}/>
                  {have > 0 && <span className="absolute right-0.5 top-0.5 rounded-md bg-slate-950/90 px-1 text-[10px] font-black text-white">×{have}</span>}
                  {c && !c.ready && <span className="absolute left-0.5 top-0.5 rounded-md bg-slate-600 px-1 text-[9px] font-black text-white">準備中</span>}
                  {m && m.variant && <span className="absolute left-0.5 top-0.5 rounded-md bg-amber-400 px-1 text-[9px] font-black text-slate-950">{/キラ/.test(m.variant) ? 'キラ' : '別'}</span>}
                  <CardNameFit name={name} className={`mt-0.5 font-bold leading-tight ${have ? 'text-slate-100' : 'text-slate-500'}`}/>
                  <span className="text-[9px] font-bold text-slate-500">No.{no}</span>
                </button>
              );
            })}
          </div>
        ) : <ScreenEmpty emoji="🃏" lines={[show === 'have' ? `${unit}のカードはまだ持っていません` : `${unit}は全部集まっています`]}/>}
      </div>
      {detail && <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)}/>}
    </div>
  );
};

// ==================== ルールの画面(区切り2) ====================
// 文は 88-card-rules.jsx の CARD_RULE_PAGES(正本は RULES_SOURCE.md)。練習試合のやり直しもここから(ドラの D20)
// 「」で囲んだ言葉は途中で折らない(「全モンスター」が「全/モンスター」と折れていた。言葉の切れ目を探す jaWrap は「全」と「モンスター」を別の言葉と見る)
// 《》で囲んだ言葉も途中で折らない(《》は画面には出さない)。jaWrap が「準備中」を「準備/中」、「出やすい」を「出/やすい」と分けるため(カゲあつくんの確認)
const cardRuleLine = (t) => String(t).split(/(「[^」]*」|《[^》]*》)/).map((seg, i) => (/^「/.test(seg) ? <span key={i} className="whitespace-nowrap">{seg}</span>
  : /^《/.test(seg) ? <span key={i} className="whitespace-nowrap">{seg.slice(1, -1)}</span> : <React.Fragment key={i}>{jaWrap(seg)}</React.Fragment>));
const CardRules = ({ onBack, onTutorial }) => (
  <div data-mh-screen data-card-rules className={SCREEN_SHELL_CLASS}>
    <ScreenHead title="ルール" accent="text-amber-200" onBack={onBack}/>
    <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-2`}>
      {CARD_RULE_PAGES.map((pg) => (
        <div key={pg.id} data-card-rule={pg.id} className={SCREEN_PANEL_CLASS}>
          <div className="text-[14px] font-black text-amber-200">{pg.emoji} {pg.title}</div>
          <ul className="mt-1 space-y-0.5">
            {pg.lines.map((t, i) => <li key={i} className="flex gap-1 text-[12px] font-bold leading-snug text-slate-100" style={JA_WRAP_STYLE}><span className="shrink-0 text-amber-300">・</span><span>{cardRuleLine(t)}</span></li>)}
          </ul>
        </div>
      ))}
    </div>
    <div className={SCREEN_FOOTER_CLASS}>
      <button type="button" data-card-tutorial-again className="mh-button min-h-[52px] w-full rounded-2xl border border-emerald-300/50 bg-emerald-900/60 font-black text-emerald-50 active:scale-[.98]" onClick={() => { Audio_.fgSe.tap(); onTutorial(); }}>練習試合をもう一度<span className="block text-[10px] font-bold text-emerald-200" style={JA_LABEL_STYLE}>{jaWrap('ドラと、みゅあ相手に5つの決まりをおさらい')}</span></button>
    </div>
  </div>
);

// ==================== パックの絵(社長「パックの絵に出る奴らをいい感じにのせて」台帳 #3503) ====================
// 新しい画像ファイルは作らない。弾の色の袋に、その弾で出るモンスターの立ち絵(84 の cardMonArt)を5体まで並べて描く。
// 立ち絵の無い子は並べない(カードの絵を貼ると浮く。2026-10-26 社長「立ち絵ないやつはパケ画像にいれなくていいよ」)。1〜4体のときは、その数で左右がそろう形に並べる
// torn … 上のふち(ちぎれる所)を描かない(パックを開ける画面で、ちぎれた帯を別に飛ばすとき)
const cardPackMonsters = (db, pack, n = 5) => {
  const seen = new Set();
  const list = Object.values(db.monsters).filter((m) => cardPackIdOf(db, m.no) === pack.id && !m.variant && m.ready !== false && !!cardMonArt(m) && !seen.has(m.species) && seen.add(m.species));
  if (list.length <= n) return list;
  const step = list.length / n;
  return Array.from({ length: n }, (_, k) => list[Math.floor(k * step)]);
};
// 後ろの4体は左右へ広げ、奥の2体は高い所から顔を出す(真ん中の1体と重なって顔が隠れないように。#3503 カゲあつくん)
const CARD_PACK_SLOTS = Object.freeze([
  { left: '-12%', w: '44%', h: '44%', b: '31%', z: 1, o: .92 }, { right: '-12%', w: '44%', h: '44%', b: '31%', z: 1, o: .92 },
  { left: '-6%', w: '46%', h: '48%', b: '10%', z: 2, o: 1 }, { right: '-6%', w: '46%', h: '48%', b: '10%', z: 2, o: 1 },
  { left: '50%', w: '62%', h: '58%', b: '2%', z: 3, o: 1, center: true },
]);
// 立ち絵が5体に足りない弾の並べ方(数ごと。左右がそろうように)
const CARD_PACK_FEW_SLOTS = Object.freeze({
  1: [{ left: '50%', w: '84%', h: '66%', b: '6%', z: 3, o: 1, center: true }],
  2: [{ left: '-4%', w: '62%', h: '60%', b: '8%', z: 2, o: 1 }, { right: '-4%', w: '62%', h: '60%', b: '8%', z: 3, o: 1 }],
  3: CARD_PACK_SLOTS.slice(2),
  4: [CARD_PACK_SLOTS[0], CARD_PACK_SLOTS[1], { left: '-2%', w: '54%', h: '54%', b: '8%', z: 2, o: 1 }, { right: '-2%', w: '54%', h: '54%', b: '8%', z: 3, o: 1 }],
});
const CardPackArt = ({ db, pack, width = 200, torn = false, className = '' }) => {
  const mons = cardPackMonsters(db, pack);
  // 真ん中を最後に(いちばん手前)。並べる順: 奥の左右 → 中の左右 → 真ん中
  const order = mons.length >= 5 ? [mons[0], mons[4], mons[1], mons[3], mons[2]] : mons;
  const slots = mons.length >= 5 ? CARD_PACK_SLOTS : (CARD_PACK_FEW_SLOTS[mons.length] || []);
  const h = Math.round(width * 1.48);
  const label = `第${pack.no}弾`;
  return (
    <div data-card-pack-art={pack.id} className={`relative overflow-hidden rounded-[14px] border-[3px] border-white/85 shadow-2xl ${className}`} style={{ width, height: h, background: `linear-gradient(165deg, ${pack.color} 0%, ${pack.color} 38%, #0b1020 100%)` }}>
      <div aria-hidden="true" className="absolute inset-0 opacity-35" style={{ background: `repeating-conic-gradient(from 0deg at 50% 62%, rgba(255,255,255,.55) 0 6deg, transparent 6deg 18deg)` }}/>
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,.28) 45%, transparent 60%)' }}/>
      {!torn && <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[7%]" style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.9) 0 6px, rgba(255,255,255,.45) 6px 12px)' }}/>}
      {order.map((m, k) => {
        const sl = slots[k]; const src = cardMonArt(m);
        return <img key={m.no} src={src} alt="" aria-hidden="true" draggable={false} className="absolute object-contain object-bottom drop-shadow-[0_4px_6px_rgba(0,0,0,.6)]"
          style={{ width: sl.w, height: sl.h, bottom: sl.b, zIndex: sl.z, opacity: sl.o, ...(sl.center ? { left: sl.left, transform: 'translateX(-50%)' } : sl.left ? { left: sl.left } : { right: sl.right }) }}/>;
      })}
      <div className="absolute inset-x-0 top-[9%] z-[5] text-center">
        <div className="font-black leading-none text-white" style={{ fontSize: Math.round(width * 0.2), WebkitTextStroke: `${Math.max(2, Math.round(width / 50))}px #111`, paintOrder: 'stroke fill', textShadow: '0 4px 0 rgba(0,0,0,.45)' }}>{label}</div>
        <div className="mt-1 font-black tracking-wider text-white/90" style={{ fontSize: Math.round(width * 0.075), textShadow: '0 2px 2px rgba(0,0,0,.7)' }}>MFバトルカード</div>
      </div>
      <div className="absolute inset-x-[18%] bottom-[3%] z-[6] rounded-full bg-black/55 py-0.5 text-center font-black text-white" style={{ fontSize: Math.round(width * 0.07) }}>ブースターパック</div>
    </div>
  );
};

// ==================== パックを開ける画面(区切り2・CARD_PACK_OPEN) ====================
// マーケットの「MFバトルカード」の売り場で買ったら、ここへ来る(買うのと保存は 60-app。この部品は見せるだけ)
// result: { packId, packs:[[{ no, slot, rarity, dup, point }…]…], dupPoint, cost }
// 演出(社長「派手に」台帳 #3503): パックをタップ → 上の帯がちぎれて飛び、光があふれる → カードが配られる → タップで1枚ずつ裏返る(音)
//   破れた所から光の柱が立ち、画面が一瞬白く光ってからカードが配られる(カゲあつくん「開ける瞬間を大きく」)
//   キラ・別絵キラは、めくる前から裏が光って揺れる。めくると真ん中へ大きく出て少し止まり、並びへ戻る(タップで早く戻せる)
//   別絵キラはキラより1段上の虹色の光(レア度の差が見て分かるように)。「全部めくる」も1枚ずつ順にめくり、キラ以上では止まる
//   音は今ある効果音(Audio_.se の special・card・crit・levelUp・fusion)
const CARD_RARITY_LABEL = Object.freeze({ normal: '', kira: 'キラ', alt: '別絵キラ' });
const CARD_PACK_TEAR_MS = 1150;   // 破れる → 光の柱 → 白く光る → 配る
const CARD_PACK_SPOT_MS = 1500;   // キラ以上を真ん中に出しておく長さ(このあと並びへ戻る)
const CARD_PACK_SPOT_BACK_MS = 320;
const CardPackOpen = ({ db, result, onDone }) => {
  const [pi, setPi] = useState(0);
  const [phase, setPhase] = useState('closed'); // closed → tearing → open
  const [flipped, setFlipped] = useState([]);
  const [flash, setFlash] = useState(null); // { n, rarity }
  const [spot, setSpot] = useState(null);   // { i, rarity, leaving } 真ん中へ大きく出しているキラ以上
  const [detail, setDetail] = useState(null);
  const timers = useRef([]);
  // 鳴らした効果音の記録(data-card-pack-se。実機の音の確かめと、ブラウザ検査でキラの音を鳴らしたかを見る)
  const [seLog, setSeLog] = useState([]);
  const se = (name) => { try { Audio_.fgSe[name](); } catch (e) {} setSeLog((l) => [...l.slice(-40), name]); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const press = useCardLongPress((no) => setDetail(no));
  const pack = cardPackOf(result.packId) || CARD_PACKS[0];
  const cards = result.packs[pi] || [];
  const allOpen = flipped.length >= cards.length;
  const last = pi >= result.packs.length - 1;
  const tear = () => {
    if (phase !== 'closed') return;
    se('special');
    setPhase('tearing');
    later(() => se('crit'), 520);
    later(() => setPhase('open'), CARD_PACK_TEAR_MS);
  };
  const spotOff = () => {
    setSpot((sp) => (sp && !sp.leaving ? { ...sp, leaving: true } : sp));
    later(() => setSpot(null), CARD_PACK_SPOT_BACK_MS);
  };
  const reveal = (i) => {
    se('card');
    setFlipped((f) => (f.includes(i) ? f : [...f, i]));
    const c = cards[i];
    if (c && c.rarity !== 'normal') {
      later(() => {
        setFlash((x) => ({ n: ((x && x.n) || 0) + 1, rarity: c.rarity }));
        setSpot({ i, rarity: c.rarity, leaving: false });
        se('crit'); if (c.rarity === 'alt') se('fusion'); else se('levelUp');
      }, 380);
      later(spotOff, 380 + CARD_PACK_SPOT_MS);
    }
  };
  const flip = (i) => { if (flipped.includes(i) || phase !== 'open' || spot) return; reveal(i); };
  // 1枚ずつ順に。キラ以上は真ん中に出している間だけ次を待つ
  const flipAll = () => {
    if (spot) return;
    let at = 0;
    cards.map((_, i) => i).filter((i) => !flipped.includes(i)).forEach((i) => {
      later(() => reveal(i), at);
      at += cards[i].rarity !== 'normal' ? 380 + CARD_PACK_SPOT_MS + CARD_PACK_SPOT_BACK_MS + 120 : 140;
    });
  };
  const next = () => { Audio_.fgSe.tap(); timers.current.forEach(clearTimeout); timers.current = []; setPi((x) => x + 1); setPhase('closed'); setFlipped([]); setSpot(null); };
  const packPoint = cards.reduce((a, c) => a + (c.point || 0), 0);
  return (
    <div data-mh-screen data-card-pack-open data-card-pack-phase={phase} data-card-pack-se={seLog.join(',')} className={SCREEN_SHELL_CLASS}>
      <ScreenHead title={pack.name} accent="text-amber-200" note={result.packs.length > 1 ? `${pi + 1} / ${result.packs.length}パック` : ''}/>
      <div className={`${SCREEN_LIST_CLASS} relative flex flex-col items-center justify-center overflow-hidden pb-2`}>
        {phase !== 'open' ? (
          <button type="button" data-card-pack-tear onClick={tear} className={`relative ${phase === 'closed' ? 'mh-pack-idle' : 'mh-pack-shake'}`} aria-label="パックを開ける">
            <div className={phase === 'tearing' ? 'mh-pack-drop' : ''}><CardPackArt db={db} pack={pack} width={210} torn={phase === 'tearing'}/></div>
            {phase === 'tearing' && <div aria-hidden="true" className="mh-pack-strip absolute inset-x-0 top-0 h-[7%] rounded-t-[14px]" style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.95) 0 6px, rgba(255,255,255,.5) 6px 12px)' }}/>}
            {phase === 'tearing' && <div aria-hidden="true" className="mh-pack-pillar"/>}
            {phase === 'tearing' && <div aria-hidden="true" className="mh-pack-burst"/>}
            {phase === 'closed' && <span className="absolute inset-x-0 -bottom-9 animate-pulse text-center text-[14px] font-black text-white">タップで開ける</span>}
          </button>
        ) : (
          // 背の高い画面では3列にしてカードを大きく見せる(4列だと小さく、下が大きく空いた。V7)。背の低い画面は4列のまま
          <div className={`grid w-full gap-2 ${cards.length > 4 && !(typeof window !== 'undefined' && window.innerHeight >= 760) ? 'grid-cols-4' : 'grid-cols-3'} px-1`}>
            {cards.map((c, i) => {
              const on = flipped.includes(i);
              const card = cardOf(db, c.no); const m = card ? null : cardMonsterOf(db, c.no);
              const name = card ? card.name : m ? m.name : c.no;
              const rare = c.rarity !== 'normal';
              return (
                <div key={`${pi}-${i}`} className="mh-pack-deal flex flex-col items-center" style={{ animationDelay: `${i * 70}ms` }}>
                  <button type="button" data-card-pack-card={i} data-card-pack-flipped={on ? 1 : 0} data-card-pack-rarity={c.rarity} {...(on ? press(c.no, () => setDetail(c.no)) : { onClick: () => flip(i) })} className="mh-pack-card relative w-full active:scale-95" style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
                    <div className={`mh-pack-card-in aspect-[5/7] w-full ${on ? 'flipped' : ''}`}>
                      <div className={`mh-pack-face flex items-center justify-center overflow-hidden rounded-[5px] border-2 border-white/50 ${rare && !on ? (c.rarity === 'alt' ? 'mh-pack-alt-back' : 'mh-pack-kira-back') : ''}`} style={{ background: `repeating-linear-gradient(135deg, rgba(255,255,255,.07) 0 6px, transparent 6px 12px), linear-gradient(160deg, ${pack.color}, #0f172a)`, containerType: 'inline-size' }}>
                        {/* カードの裏の柄(2026-10-24 改善部の点検 V7「無地に🃏だけ」): 内側の枠・斜めの模様・まんなかの紋。モンスターの枠は金の★ */}
                        <span aria-hidden="true" className="pointer-events-none absolute inset-[6%] rounded-[4px] border border-white/40"/>
                        <span aria-hidden="true" className="relative grid aspect-square w-[58%] place-items-center rounded-full border-2 border-amber-200/80 bg-black/40 shadow-[0_0_10px_rgba(0,0,0,.5)]">
                          <span className="text-center font-black leading-none text-amber-100" style={{ fontSize: '17cqw', textShadow: '0 1px 2px #000' }}>{c.slot === 'mon' ? '★' : 'MF'}<span className="block font-black tracking-tight text-white/80" style={{ fontSize: '7cqw' }}>BATTLE CARD</span></span>
                        </span></div>
                      <div className={`mh-pack-face mh-pack-front ${rare ? (c.rarity === 'alt' ? 'mh-pack-alt-front' : 'mh-pack-kira-front') : ''}`}>
                        <img src={CARD_IMG(card ? card.img : m ? m.img : c.no)} alt={name} draggable={false} className="h-full w-full rounded-[5px] object-cover"/>
                      </div>
                    </div>
                    {on && rare && <div aria-hidden="true" className={`mh-pack-rays ${c.rarity === 'alt' ? 'mh-pack-rays-alt' : ''}`}/>}
                    {on && c.dup && <span className="absolute right-0.5 top-0.5 z-[2] rounded-md bg-slate-950/90 px-1 text-[10px] font-black text-amber-200">+{c.point}</span>}
                    {on && !c.dup && <span className="absolute right-0.5 top-0.5 z-[2] rounded-md bg-emerald-400 px-1 text-[9px] font-black text-slate-950">NEW</span>}
                    {on && rare && <span className={`absolute left-0.5 top-0.5 z-[2] rounded-md px-1 text-[9px] font-black text-slate-950 ${c.rarity === 'alt' ? 'mh-pack-alt-label' : 'bg-amber-300'}`}>{CARD_RARITY_LABEL[c.rarity]}</span>}
                  </button>
                  <CardNameFit name={on ? name : '\u00a0'} className="mt-0.5 font-bold leading-tight text-slate-100"/>
                </div>
              );
            })}
          </div>
        )}
        {phase === 'open' && allOpen && (
          <div data-card-pack-summary className="mt-3 text-center text-[12px] font-bold text-slate-300">
            {packPoint > 0 ? <>だぶったカードは <b className="text-amber-200">ビートP +{packPoint}</b> になりました</> : 'だぶったカードはありません'}
            {last && result.packs.length > 1 && <div className="mt-0.5">({result.packs.length}パックで +{result.dupPoint})</div>}
          </div>
        )}
      </div>
      {phase === 'tearing' && <div aria-hidden="true" className="mh-pack-whiteout"/>}
      {flash && <div key={flash.n} aria-hidden="true" className={`mh-pack-flash ${flash.rarity === 'alt' ? 'mh-pack-flash-alt' : ''}`}/>}
      {spot && cards[spot.i] && (() => {
        const c = cards[spot.i]; const card = cardOf(db, c.no); const m = card ? null : cardMonsterOf(db, c.no);
        const alt = spot.rarity === 'alt';
        return (
          <button type="button" data-card-pack-spot={spot.rarity} aria-label="並びへ戻す" onClick={spotOff} className="fixed inset-0 z-[72] flex flex-col items-center justify-center bg-slate-950/70">
            <div aria-hidden="true" className={`mh-pack-spot-rays ${alt ? 'mh-pack-spot-rays-alt' : ''}`}/>
            <div className={`relative w-[62vw] max-w-[260px] ${spot.leaving ? 'mh-pack-spot-out' : 'mh-pack-spot-in'}`}>
              <div className={`relative aspect-[5/7] w-full ${alt ? 'mh-pack-alt-front' : 'mh-pack-kira-front'}`}>
                <img src={CARD_IMG(card ? card.img : m ? m.img : c.no)} alt={card ? card.name : m ? m.name : c.no} draggable={false} className="h-full w-full rounded-[8px] object-cover"/>
              </div>
            </div>
            <span className={`relative mt-4 rounded-full px-4 py-1 text-[18px] font-black text-slate-950 ${alt ? 'mh-pack-alt-label' : 'bg-amber-300'} ${spot.leaving ? 'opacity-0' : ''}`}>{CARD_RARITY_LABEL[c.rarity]}!</span>
          </button>
        );
      })()}
      <div className={SCREEN_FOOTER_CLASS}>
        {phase !== 'open' ? <div className="text-center text-[12px] font-bold text-slate-400">パックをタップしてください</div>
          : !allOpen ? <button type="button" data-card-pack-flip-all className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black active:scale-[.98]" onClick={flipAll}>全部めくる</button>
          : !last ? <button type="button" data-card-pack-next className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black active:scale-[.98]" onClick={next}>つぎのパック</button>
          : <button type="button" data-card-pack-done className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black active:scale-[.98]" onClick={() => { Audio_.fgSe.tap(); onDone(); }}>{result.demo ? 'トップへ戻る' : 'マーケットへ戻る'}</button>}
      </div>
      {detail && <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)}/>}
    </div>
  );
};

// ==================== マーケットの「MFバトルカード」の売り場: パックとスターターキット(区切り2) ====================
// 55-screen-breeder-market.jsx の「MFバトルカード」の売り場から出す。円盤石・アシストカードは 55 側(ビートP交換所と同じ並べ方)
// onBuyPack(packId, count) / onBuyStarter(kitId) … 60-app が保存して、パックならパックを開ける画面へ進む
// ---- パック・スターターキットの中身と提供割合(2026-10-25 社長「中身が分かるように」。手本はガチャのピックアップ詳細・提供割合) ----
// どれもカードを押すと詳しい画面(CardDetailModal)。持っていないカードには「未取得」の印
const cardShopName = (db, no) => { const c = cardOf(db, no); const m = c ? null : cardMonsterOf(db, no); return c ? c.name : m ? m.name : no; };
const cardShopImg = (db, no) => { const c = cardOf(db, no); const m = c ? null : cardMonsterOf(db, no); return CARD_IMG(c ? c.img : m ? m.img : no); };
const CARD_RARITY_ORDER = Object.freeze({ alt: 0, kira: 1, normal: 2 });
// 詳しい画面は一覧の外に置く(中に置くと、詳しい画面を閉じるタップが一覧の背景まで届いて、一覧も閉じた)
const CardShopSheet = ({ title, onClose, children, detail, setDetail, db, tag }) => (
  <>
  <div data-card-shop-sheet={tag} role="dialog" aria-modal="true" aria-label={title} onClick={onClose} className="fixed inset-0 flex items-center justify-center p-3" style={{ zIndex: MODAL_Z.dialog, backgroundColor: 'rgba(2,6,23,0.88)' }}>
    <div onClick={(e) => e.stopPropagation()} className="flex max-h-full w-full max-w-[460px] flex-col rounded-3xl border-2 border-amber-300/70 bg-slate-950 text-white shadow-2xl landscape:max-w-[720px]">
      <div className="shrink-0 rounded-t-[22px] bg-amber-300/15 px-3 py-2 text-center text-[15px] font-black text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(title)}</div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{children}</div>
      <div className="shrink-0 p-2"><button type="button" data-card-shop-sheet-close onClick={onClose} className="mh-button mh-button-primary min-h-[46px] w-full rounded-2xl text-[14px] font-black active:scale-[.98] landscape:min-h-[40px]">閉じる</button></div>
    </div>
  </div>
  {detail && <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)}/>}
  </>
);
// 中身の一覧(絵の並び)。rows: [{ no, count?, rarity? }]
const CardShopGrid = ({ db, rows, collection, onTap }) => (
  <div className="grid grid-cols-4 gap-1.5 landscape:grid-cols-7">
    {rows.map(({ no, count, rarity }) => {
      const missing = !((collection || {})[no] > 0);
      return (
        <button key={no} type="button" data-card-shop-item={no} data-card-shop-missing={missing ? '1' : undefined} onClick={() => onTap(no)} className="relative flex flex-col items-center rounded-lg bg-white/5 p-0.5 text-center active:scale-95">
          <span className="relative block w-full">
            <img src={cardShopImg(db, no)} alt={cardShopName(db, no)} className="aspect-[5/7] w-full rounded-[5px] object-cover"/>
            {missing && <span data-card-shop-missing-badge className="absolute left-0.5 top-0.5 rounded-md bg-rose-600 px-1 text-[9px] font-black text-white shadow">未取得</span>}
            {rarity && rarity !== 'normal' && <span className="absolute bottom-0.5 left-0.5 rounded-md bg-amber-300 px-1 text-[9px] font-black text-slate-950">{CARD_RARITY_LABEL[rarity]}</span>}
            {count > 1 && <span className="absolute bottom-0.5 right-0.5 rounded-md bg-slate-950/90 px-1 text-[10px] font-black text-white">×{count}</span>}
          </span>
          <CardNameFit name={cardShopName(db, no)} className="mt-0.5 font-bold leading-tight text-slate-100"/>
        </button>
      );
    })}
  </div>
);
const CardShopHead = ({ children }) => <div className="mb-1 mt-2 rounded-md bg-sky-400/20 px-2 py-0.5 text-[12px] font-black text-sky-100 first:mt-0">■ {children}</div>;
const cardShopPct = (x) => `${(x * 100).toFixed(3)}%`;
const CardPackContents = ({ db, pack, collection, onClose }) => {
  const [detail, setDetail] = useState(null);
  const r = cardPackCardRates(db, pack.id);
  const mons = r.mon.slice().sort((a, b) => CARD_RARITY_ORDER[a.rarity] - CARD_RARITY_ORDER[b.rarity] || String(a.no).localeCompare(String(b.no)));
  const missing = [...mons, ...r.tech].filter((x) => !((collection || {})[x.no] > 0)).length;
  return (
    <CardShopSheet tag="contents" title={`${pack.name}の中身`} onClose={onClose} detail={detail} setDetail={setDetail} db={db}>
      <p className="text-[11px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(`このパックで出るカードです(${mons.length + r.tech.length}種類・まだ持っていないもの ${missing}種類)。押すとくわしく見られます。`)}</p>
      <CardShopHead>モンスター({pack.mon}枚の枠・{mons.length}種類)</CardShopHead>
      <CardShopGrid db={db} rows={mons} collection={collection} onTap={setDetail}/>
      {r.tech.length > 0 && <><CardShopHead>技など({pack.tech}枚の枠・{r.tech.length}種類)</CardShopHead><CardShopGrid db={db} rows={r.tech} collection={collection} onTap={setDetail}/></>}
    </CardShopSheet>
  );
};
const CardPackRateSheet = ({ db, pack, collection, onClose }) => {
  const [detail, setDetail] = useState(null);
  const r = cardPackCardRates(db, pack.id);
  const mons = r.mon.slice().sort((a, b) => CARD_RARITY_ORDER[a.rarity] - CARD_RARITY_ORDER[b.rarity] || b.p - a.p || String(a.no).localeCompare(String(b.no)));
  const th = 'border border-white/15 bg-amber-200/15 px-1 py-0.5 text-[11px] font-black text-amber-100';
  const td = 'border border-white/10 px-1 py-0.5 text-[11px] font-bold';
  const rarLabel = (k) => CARD_RARITY_LABEL[k] || '通常';
  const rows = (list) => list.map((x) => (
    <tr key={x.no} data-card-rate-row={x.no} onClick={() => setDetail(x.no)} className="cursor-pointer active:bg-white/10">
      <td className={`${td} text-center`}>{x.rarity ? rarLabel(x.rarity) : '技など'}</td>
      <td className={td}><span className="flex items-center gap-1"><img src={cardShopImg(db, x.no)} alt="" loading="lazy" className="h-[28px] w-[20px] shrink-0 rounded-[2px] object-cover"/><span className="min-w-0" style={JA_WRAP_STYLE}>{cardShopName(db, x.no)}</span></span></td>
      <td className={`${td} text-right tabular-nums`}>{cardShopPct(x.p)}</td>
    </tr>
  ));
  const notes = [
    `1パックは${pack.tech ? `技などの枠${pack.tech}枚と、` : ''}モンスターの枠${pack.mon}枚です。割合は、枠1つあたりの割合です。`,
    pack.tech ? `技などの枠は、${r.tech.length}種類から同じ割合で出ます。` : null,
    pack.mon && Object.keys(r.rarity).length > 1 ? 'モンスターの枠は、まずレア度を決めてから、そのレア度のモンスターから1枚出ます。' : null,
    '混血のモンスターも、ほかのモンスターと同じく、そのカードのレア度(通常・キラ・別絵キラ)の割合の中から出ます。',
    '同じレア度のモンスターは、どれも同じ割合で出ます。',
    pack.pity ? `このパックでキラも別絵キラも出ないまま${CARD_PACK_PITY_AT}パック開けると、つぎのパックのモンスターの枠は必ずキラ以上になります(キラが出ないまま続くのを止める決まり。「天井」と呼びます)。` : null,
    `だぶったカードはビートPになります(技などは4枚目から1枚${CARD_DUP_POINT.tech}・モンスターは2枚目から${CARD_DUP_POINT.normal}〔キラ${CARD_DUP_POINT.kira}・別絵キラ${CARD_DUP_POINT.alt}〕)。`,
    '新しいカードは、できしだい追加されます。',
  ].filter(Boolean);
  return (
    <CardShopSheet tag="rates" title={`${pack.name} 提供割合`} onClose={onClose} detail={detail} setDetail={setDetail} db={db}>
      <CardShopHead>レア度別の割合(モンスターの枠)</CardShopHead>
      <table data-card-rate-rarity className="w-full border-collapse text-slate-100">
        <thead><tr><th className={th}>レア度</th><th className={th}>割合</th></tr></thead>
        <tbody>{['normal', 'kira', 'alt'].filter((k) => r.rarity[k] > 0).map((k) => <tr key={k}><td className={`${td} text-center`}>{rarLabel(k)}</td><td className={`${td} text-right tabular-nums`}>{cardShopPct(r.rarity[k])}</td></tr>)}</tbody>
      </table>
      <div className="mt-1 space-y-0.5">{notes.map((t, i) => <p key={i} className="text-[10.5px] font-bold leading-snug text-slate-300" style={JA_WRAP_STYLE}>※{jaWrap(t)}</p>)}</div>
      <CardShopHead>カード1枚ずつの割合(モンスターの枠)</CardShopHead>
      <table data-card-rate-mon className="w-full table-fixed border-collapse text-slate-100">
        <colgroup><col className="w-[4.2em]"/><col/><col className="w-[5.6em]"/></colgroup>
        <thead><tr><th className={th}>レア度</th><th className={th}>カード</th><th className={th}>割合</th></tr></thead>
        <tbody>{rows(mons)}</tbody>
      </table>
      {r.tech.length > 0 && <>
        <CardShopHead>カード1枚ずつの割合(技などの枠)</CardShopHead>
        <table data-card-rate-tech className="w-full table-fixed border-collapse text-slate-100">
          <colgroup><col className="w-[4.2em]"/><col/><col className="w-[5.6em]"/></colgroup>
          <thead><tr><th className={th}>種類</th><th className={th}>カード</th><th className={th}>割合</th></tr></thead>
          <tbody>{rows(r.tech)}</tbody>
        </table>
      </>}
    </CardShopSheet>
  );
};
const CardStarterContents = ({ db, kit, collection, onClose }) => {
  const [detail, setDetail] = useState(null);
  const counts = {};
  kit.cards.forEach((no) => { counts[no] = (counts[no] || 0) + 1; });
  const cards = Object.keys(counts).map((no) => ({ no, count: counts[no] }));
  return (
    <CardShopSheet tag="starter" title={`${kit.name}の中身`} onClose={onClose} detail={detail} setDetail={setDetail} db={db}>
      <p className="text-[11px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap('このキットに入っているカードです。押すとくわしく見られます。')}</p>
      <CardShopHead>モンスター(3枚)</CardShopHead>
      <CardShopGrid db={db} rows={kit.monsters.map((no) => ({ no, rarity: cardMonRarity(cardMonsterOf(db, no)) }))} collection={collection} onTap={setDetail}/>
      <CardShopHead>カード({kit.cards.length}枚・{cards.length}種類)</CardShopHead>
      <CardShopGrid db={db} rows={cards} collection={collection} onTap={setDetail}/>
    </CardShopSheet>
  );
};

// 弾に入っている種族の名前(売り場でパックの名前の下に出す。例: ディノ・ハム・モッチー)
const cardPackSpeciesLabel = (db, pack) => pack.species.map((sp) => (Object.values(db.monsters).find((m) => m.species === sp && !m.variant) || {}).name || sp).join('・');
const CardShopPacks = ({ db, point, busy, collection = null, onBuyPack }) => {
  const [sheet, setSheet] = useState(null);   // { kind:'contents'|'rates', pack }
  const [confirm, setConfirm] = useState(null);
  return (
    <div data-card-shop-packs className="space-y-2 pb-2">
      {CARD_PACKS.map((pack) => (
        <div key={pack.id} data-card-shop-pack={pack.id} className={SCREEN_PANEL_CLASS} style={{ borderColor: `${pack.color}88` }}>
          <div className="flex items-center gap-2">
            <CardPackArt db={db} pack={pack} width={58} className="shrink-0 !rounded-[8px] !border-2"/>
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-black text-white">{pack.name}</div>
              <div data-card-shop-pack-species className="text-[11px] font-black text-amber-100">{cardPackSpeciesLabel(db, pack)}</div>
              <div className="text-[11px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(pack.tech ? `${pack.tech + pack.mon}枚入り(技など${pack.tech}枚・モンスター${pack.mon}枚)` : `${pack.mon}枚入り(3枚とも混血モンスター)`)}</div>
              <div className="mt-1 flex gap-1.5">
                <button type="button" data-card-shop-contents={pack.id} onClick={() => setSheet({ kind: 'contents', pack })} className="min-h-[30px] rounded-lg border border-sky-300/60 bg-sky-900/50 px-2 text-[11px] font-black text-sky-100 active:scale-95">中身を見る</button>
                <button type="button" data-card-shop-rates={pack.id} onClick={() => setSheet({ kind: 'rates', pack })} className="min-h-[30px] rounded-lg border border-amber-300/60 bg-amber-900/40 px-2 text-[11px] font-black text-amber-100 active:scale-95">提供割合</button>
              </div>
            </div>
          </div>
          <div className={`mt-2 grid gap-1.5 ${pack.bundle ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button type="button" data-card-shop-buy={`${pack.id}-1`} disabled={busy || point < pack.price} onClick={() => setConfirm({ pack, count: 1 })} className="mh-button min-h-[44px] rounded-xl bg-orange-500 text-[13px] font-black text-white active:scale-[.98] disabled:opacity-40">1パック {pack.price.toLocaleString()}</button>
            {pack.bundle && <button type="button" data-card-shop-buy={`${pack.id}-${pack.bundle.n}`} disabled={busy || point < pack.bundle.price} onClick={() => setConfirm({ pack, count: pack.bundle.n })} className="mh-button min-h-[44px] rounded-xl bg-orange-600 text-[13px] font-black text-white active:scale-[.98] disabled:opacity-40">{pack.bundle.n}パック {pack.bundle.price.toLocaleString()}<span className="block text-[9px] font-bold">({(pack.price * pack.bundle.n - pack.bundle.price).toLocaleString()}おトク)</span></button>}
          </div>
        </div>
      ))}
      {sheet && sheet.kind === 'contents' && <CardPackContents db={db} pack={sheet.pack} collection={collection} onClose={() => setSheet(null)}/>}
      {sheet && sheet.kind === 'rates' && <CardPackRateSheet db={db} pack={sheet.pack} collection={collection} onClose={() => setSheet(null)}/>}
      {confirm && <ConfirmSheet title={`${confirm.pack.name}を${confirm.count}パック買いますか？`} message={`ビートP ${cardPackPrice(confirm.pack, confirm.count).toLocaleString()} を使います(いま ${point.toLocaleString()})`} confirmLabel="買って開ける" onCancel={() => setConfirm(null)} onConfirm={() => { const c = confirm; setConfirm(null); void onBuyPack(c.pack.id, c.count); }}/>}
    </div>
  );
};
const CardShopStarters = ({ db, point, busy, starter, shop, collection = null, onBuyStarter }) => {
  const [confirm, setConfirm] = useState(null);
  const [done, setDone] = useState('');
  const [view, setView] = useState(null);
  // 持っているキット(はじめに選んだもの・買ったもの)も並べて、中身を見られるようにする(買えない)
  const kits = Object.values(db.starters);
  const price = CARD_STARTER_SHOP_PRICE.toLocaleString();
  return (
    <div data-card-shop-starters className="space-y-2 pb-2">
      {done && <div data-card-shop-starter-done className="rounded-xl border border-emerald-400/40 bg-emerald-950/40 px-3 py-2 text-[12px] font-black text-emerald-200" style={JA_WRAP_STYLE}>{jaWrap(done)}</div>}
      <p className="text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap(`スターターキットは1つにつき1回、${price}ビートPで買えます。買うとデッキも1つ増えます。どのキットも中身を見られます。`)}</p>
      {kits.map((k) => {
        const owned = !!((starter && starter.kit === k.id) || (shop && shop.starters && shop.starters[k.id]));
        return (
          <div key={k.id} data-card-shop-starter={k.id} data-card-shop-starter-owned={owned ? '1' : undefined} className={SCREEN_PANEL_CLASS}>
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 gap-0.5">{k.monsters.map((no) => { const m = cardMonsterOf(db, no); return m ? <img key={no} src={CARD_IMG(m.img)} alt={m.name} className="h-[52px] w-[37px] rounded-[4px] object-cover"/> : null; })}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="whitespace-nowrap text-[13px] font-black text-white">{k.name}</span>
                  {owned && <span data-card-shop-starter-owned-badge className="rounded-full bg-emerald-500 px-1.5 text-[10px] font-black text-slate-950">持っています</span>}
                </div>
                <div className="text-[11px] font-bold text-slate-300">モンスター3枚・カード{k.cards.length}枚</div>
                <button type="button" data-card-shop-starter-contents={k.id} onClick={() => setView(k)} className="mt-1 min-h-[30px] rounded-lg border border-sky-300/60 bg-sky-900/50 px-2 text-[11px] font-black text-sky-100 active:scale-95">中身を見る</button>
              </div>
            </div>
            <button type="button" data-card-shop-starter-buy={k.id} disabled={owned || busy || point < CARD_STARTER_SHOP_PRICE} onClick={() => setConfirm(k)} className="mh-button mt-2 min-h-[44px] w-full rounded-xl bg-orange-500 text-[13px] font-black text-white active:scale-[.98] disabled:opacity-40">{owned ? '持っています' : `${price}ビートP`}</button>
          </div>
        );
      })}
      {view && <CardStarterContents db={db} kit={view} collection={collection} onClose={() => setView(null)}/>}
      {confirm && <ConfirmSheet title={`「${confirm.name}」を買いますか？`} message={`ビートP ${price} を使います(いま ${point.toLocaleString()})。だぶったカードはビートPになります`} confirmLabel="買う" onCancel={() => setConfirm(null)} onConfirm={async () => { const k = confirm; setConfirm(null); const r = await onBuyStarter(k.id); if (r && r.ok) setDone(`「${k.name}」を買いました。デッキ編成に1つ増えています${r.dupPoint > 0 ? `(だぶったカードはビートP +${r.dupPoint})` : ''}`); }}/>}
    </div>
  );
};
