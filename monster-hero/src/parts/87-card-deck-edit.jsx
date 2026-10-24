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
  { id: 'dge', label: '回避' }, { id: 'blk', label: '防御' }, { id: 'any', label: '全モンスター' }, { id: 'breeder', label: 'ブリーダー' },
]);
const cardDeckFilterOk = (c, f) => (f === 'all' ? true : f === 'any' ? c.user === 'any' : f === 'breeder' ? c.user === 'breeder' : c.kind === f && c.user !== 'any' && c.user !== 'breeder');

// 1枚のカード(小さい絵)。右上に「デッキの枚数/持っている枚数」
const CardDeckTile = ({ db, no, inDeck = 0, owned = 0, dim = false, press, onTap, mark = '' }) => {
  const c = cardOf(db, no); const m = c ? null : cardMonsterOf(db, no);
  const name = c ? c.name : m ? m.name : no;
  return (
    <button type="button" data-card-deck-tile={no} {...press(no, onTap)} className={`relative flex flex-col items-center rounded-lg p-0.5 text-center active:scale-95 ${dim ? 'opacity-40' : ''} ${inDeck > 0 ? 'bg-emerald-500/15 ring-2 ring-emerald-300/70' : 'bg-white/5'}`} style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
      <img src={CARD_IMG(c ? c.img : m ? m.img : no)} alt={name} draggable={false} onDragStart={(e) => e.preventDefault()} className="aspect-[5/7] w-full rounded-[5px] object-cover"/>
      <span data-card-deck-badge className="absolute right-0.5 top-0.5 rounded-md bg-slate-950/90 px-1 text-[10px] font-black text-white"><span className="text-emerald-300">入{inDeck}</span>/持{owned}</span>
      {mark && <span className="absolute left-0.5 top-0.5 rounded-md bg-amber-400 px-1 text-[9px] font-black text-slate-950">{mark}</span>}
      <span className="mt-0.5 line-clamp-2 min-h-[26px] text-[10px] font-bold leading-tight text-slate-100" style={JA_WRAP_STYLE}>{name}</span>
    </button>
  );
};

const CardDeckEditor = ({ db, collection, deck: deck0, onSave, onCancel }) => {
  const [deck, setDeck] = useState(() => ({ ...deck0, monsters: deck0.monsters.slice(), cards: deck0.cards.slice() }));
  const [tab, setTab] = useState(deck0.monsters.length < 3 ? 'mon' : 'card');
  const [filter, setFilter] = useState('all');
  const [usableOnly, setUsableOnly] = useState(true);
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState(null);
  const [leave, setLeave] = useState(false);
  const press = useCardLongPress((no) => setDetail(no));
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
    Audio_.se.tap();
    setNotice('');
    if (cardMonsterOf(db, no)) setDeck((d) => ({ ...d, monsters: [...d.monsters, no] }));
    else setDeck((d) => ({ ...d, cards: [...d.cards, no] }));
  };
  const removeOne = (no) => {
    Audio_.se.tap();
    setNotice('');
    setDeck((d) => {
      if (d.monsters.includes(no)) return { ...d, monsters: d.monsters.filter((x) => x !== no) };
      const k = d.cards.lastIndexOf(no);
      return k < 0 ? d : { ...d, cards: [...d.cards.slice(0, k), ...d.cards.slice(k + 1)] };
    });
  };
  // 持っているカード(準備中は出さない)
  const ownedCards = Object.keys(col).filter((no) => { const c = cardOf(db, no); return c && c.ready && col[no] > 0; }).sort((a, b) => (cardSortKey(db, a) < cardSortKey(db, b) ? -1 : 1));
  const ownedMons = Object.keys(col).filter((no) => cardMonsterOf(db, no) && col[no] > 0).sort();
  const shownCards = ownedCards.filter((no) => {
    const c = cardOf(db, no);
    if (!cardDeckFilterOk(c, filter)) return false;
    if (usableOnly && mons.length && c.user !== 'breeder' && !mons.some((m) => cardUsableBy(c, m))) return false;
    return true;
  });
  const deckUnique = [...new Set(deck.cards)].sort((a, b) => (cardSortKey(db, a) < cardSortKey(db, b) ? -1 : 1));
  const tile = (no, onTap) => {
    const inDeck = countOf(no);
    const why = cardDeckAddReason(db, deck, no, col);
    return <CardDeckTile key={no} db={db} no={no} inDeck={inDeck} owned={col[no] || 0} dim={!!why && inDeck === 0} press={press} onTap={onTap}/>;
  };
  return (
    <div data-mh-screen data-card-deck-edit className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="デッキを組む" accent="text-amber-200" onBack={() => (changed ? setLeave(true) : onCancel())}/>
      <div className={`${SCREEN_PANEL_FLAT_CLASS} shrink-0 space-y-1.5`}>
        <input data-card-deck-name value={deck.name} maxLength={20} onChange={(e) => setDeck((d) => ({ ...d, name: e.target.value }))} className="w-full rounded-lg border border-white/20 bg-slate-950 px-2 py-1.5 text-[14px] font-black text-white" aria-label="デッキの名前"/>
        <div className="flex items-end gap-1.5">
          {[0, 1, 2].map((i) => {
            const no = deck.monsters[i];
            const m = no ? cardMonsterOf(db, no) : null;
            return m
              ? <button key={i} type="button" data-card-deck-mon={i} {...press(no, () => removeOne(no))} className="relative w-[20%] max-w-[64px] active:scale-95"><img src={CARD_IMG(m.img)} alt={m.name} draggable={false} className="aspect-[5/7] w-full rounded-[5px] object-cover"/><span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">×</span></button>
              : <button key={i} type="button" data-card-deck-mon={i} onClick={() => setTab('mon')} className="flex aspect-[5/7] w-[20%] max-w-[64px] items-center justify-center rounded-[5px] border-2 border-dashed border-white/30 text-[10px] font-bold text-slate-400">モンスター</button>;
          })}
          <div className="min-w-0 flex-1 text-right">
            <div data-card-deck-count className={`text-[20px] font-black ${deck.cards.length === CARD_BATTLE_DECK_SIZE ? 'text-emerald-300' : 'text-white'}`}>{deck.cards.length}<span className="text-[12px] text-slate-400">/{CARD_BATTLE_DECK_SIZE}枚</span></div>
            <div data-card-deck-ready={ready ? 'ok' : 'ng'} className={`text-[11px] font-black ${ready ? 'text-emerald-300' : 'text-amber-200'}`}>{ready ? '対戦に使えます' : 'まだ対戦に使えません'}</div>
          </div>
        </div>
        <div data-card-deck-legend className="text-[10px] font-bold text-slate-400">カードの右上: <span className="text-emerald-300">入</span>=デッキに入れた枚数 / 持=持っている枚数</div>
        {!ready && <div data-card-deck-problems className="text-[11px] font-bold leading-snug text-rose-300" style={JA_WRAP_STYLE}>{[...rules, ...own].slice(0, 2).join(' / ')}</div>}
        {notice && <div data-card-deck-notice className="text-[12px] font-black text-amber-200">{notice}</div>}
      </div>
      <ScreenTabs className="mt-2" value={tab} onChange={(id) => { setTab(id); setNotice(''); }} items={[
        { id: 'card', label: '技・ブリーダー' }, { id: 'mon', label: `モンスター ${deck.monsters.length}/3` }, { id: 'deck', label: `デッキの中 ${deck.cards.length}` },
      ]}/>
      {tab === 'card' && (
        <div className="mb-1.5 flex shrink-0 flex-wrap gap-1">
          <button type="button" data-card-deck-usable onClick={() => setUsableOnly((v) => !v)} className={`rounded-full px-2 py-1 text-[11px] font-black ${usableOnly ? 'bg-emerald-400 text-slate-950' : 'border border-white/20 bg-slate-900 text-slate-300'}`}>{usableOnly ? '✓ ' : ''}使える子だけ</button>
          {CARD_DECK_FILTERS.map((f) => <button key={f.id} type="button" data-card-deck-filter={f.id} onClick={() => setFilter(f.id)} className={`rounded-full px-2 py-1 text-[11px] font-black ${filter === f.id ? 'bg-amber-300 text-slate-950' : 'border border-white/20 bg-slate-900 text-slate-300'}`}>{f.label}</button>)}
        </div>
      )}
      <div className={`${SCREEN_LIST_CLASS} pb-2`}>
        {tab === 'card' && (shownCards.length
          ? <div className="grid grid-cols-4 gap-1.5">{shownCards.map((no) => tile(no, () => add(no)))}</div>
          : <ScreenEmpty emoji="🃏" lines={['当てはまるカードがありません']}/>)}
        {tab === 'mon' && (
          <>
            <p className="mb-1 text-[11px] font-bold text-slate-400">タップで入れる・上の枠をタップで外す。同じモンスターは1体まで(キラも同じモンスター)</p>
            <div className="grid grid-cols-4 gap-1.5">{ownedMons.map((no) => tile(no, () => (deck.monsters.includes(no) ? removeOne(no) : add(no))))}</div>
          </>
        )}
        {tab === 'deck' && (deckUnique.length
          ? <>
            <p className="mb-1 text-[11px] font-bold text-slate-400">タップで1枚外す・長押しで詳しく</p>
            <div className="grid grid-cols-4 gap-1.5">{deckUnique.map((no) => tile(no, () => removeOne(no)))}</div>
          </>
          : <ScreenEmpty emoji="🃏" lines={['まだカードが入っていません', '「技・ブリーダー」から入れてください']}/>)}
      </div>
      <div className={`${SCREEN_FOOTER_CLASS} grid grid-cols-2 gap-2`}>
        <button type="button" data-card-deck-save className="mh-button mh-button-primary min-h-[52px] rounded-2xl font-black active:scale-[.98]" onClick={() => { Audio_.se.tap(); onSave({ ...deck, name: (deck.name || '').trim() || 'デッキ' }); }}>保存する</button>
        <button type="button" className="mh-button mh-button-secondary min-h-[52px] rounded-2xl border border-white/20 bg-slate-800 font-black active:scale-[.98]" onClick={() => (changed ? setLeave(true) : onCancel())}>やめる</button>
      </div>
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
                <button type="button" data-card-deck-use={d.id} disabled={on || !ready} className={`${btn} ${on ? 'bg-amber-300 text-slate-950' : 'border border-amber-300/50 bg-amber-900/40 text-amber-100'}`} onClick={() => { Audio_.se.tap(); onActive(d.id); }}>{on ? '使用中' : '使う'}</button>
                <button type="button" data-card-deck-open={d.id} className={`${btn} mh-button-primary`} onClick={() => { Audio_.se.tap(); onEdit(d); }}>組む</button>
                <button type="button" data-card-deck-copy={d.id} disabled={full} className={`${btn} border border-white/20 bg-slate-800`} onClick={() => { Audio_.se.tap(); onPut({ ...d, id: cardNewDeckId(decks.decks, Date.now()), name: `${d.name}のコピー`.slice(0, 20), monsters: d.monsters.slice(), cards: d.cards.slice() }); }}>コピー</button>
                <button type="button" data-card-deck-del={d.id} disabled={decks.decks.length <= 1} className={`${btn} border border-rose-300/40 bg-rose-950/50 text-rose-100`} onClick={() => setConfirmDel(d)}>消す</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className={SCREEN_FOOTER_CLASS}>
        <button type="button" data-card-deck-new disabled={full} className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black active:scale-[.98] disabled:opacity-40" onClick={() => { Audio_.se.tap(); onEdit({ id: cardNewDeckId(decks.decks, Date.now()), name: `デッキ${decks.decks.length + 1}`, monsters: [], cards: [] }); }}>{full ? `デッキは${CARD_DECK_MAX}つまでです` : '新しいデッキを作る'}</button>
      </div>
      {confirmDel && <ConfirmSheet title={`「${confirmDel.name}」を消しますか？`} message="デッキだけを消します(カードは消えません)" confirmLabel="消す" danger onCancel={() => setConfirmDel(null)} onConfirm={() => { const id = confirmDel.id; setConfirmDel(null); onRemove(id); }}/>}
    </div>
  );
};

// ==================== カード図鑑(区切り2) ====================
// 弾ごとのタブ(第1〜4弾・混血)。持っている/持っていない・枚数・準備中。持っていないカードは暗い絵で出す(何が集まるか分かるように)
// ★C-060C(ファンの描いた絵)はカードの表に入っていない(社長)。並べるのはカードの表にあるものだけ
const CARD_DEX_TABS = Object.freeze([
  { id: '1', label: '第1弾' }, { id: '2', label: '第2弾' }, { id: '3', label: '第3弾' }, { id: '4', label: '第4弾' }, { id: 'hybrid', label: '混血' },
]);
const cardDexList = (db, wave) => {
  const mons = Object.values(db.monsters).filter((m) => String(m.wave) === wave).map((m) => m.no).sort();
  const cards = Object.values(db.cards).filter((c) => String(c.wave) === wave).map((c) => c.no).sort();
  return [...mons, ...cards];
};
const CardDex = ({ db, collection, onBack }) => {
  const [tab, setTab] = useState('1');
  const [show, setShow] = useState('all');
  const [detail, setDetail] = useState(null);
  const press = useCardLongPress((no) => setDetail(no));
  const col = collection || {};
  const all = CARD_DEX_TABS.flatMap((t) => cardDexList(db, t.id));
  const list = cardDexList(db, tab);
  const shown = list.filter((no) => (show === 'have' ? col[no] > 0 : show === 'miss' ? !(col[no] > 0) : true));
  const haveIn = (arr) => arr.filter((no) => col[no] > 0).length;
  return (
    <div data-mh-screen data-card-dex className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="カード図鑑" accent="text-amber-200" onBack={onBack}/>
      <div className={`${SCREEN_PANEL_FLAT_CLASS} mb-2 shrink-0 text-[12px] font-bold text-slate-300`}>
        集めた種類 <b data-card-dex-total className="text-[15px] text-amber-200">{haveIn(all)}</b> / {all.length}
        <span className="ml-2 text-slate-400">(この弾 {haveIn(list)} / {list.length})</span>
      </div>
      <ScreenTabs value={tab} onChange={setTab} items={CARD_DEX_TABS.map((t) => ({ id: t.id, label: t.label }))}/>
      <div className="mb-1.5 flex shrink-0 gap-1">
        {[['all', '全部'], ['have', '持っている'], ['miss', 'まだ']].map(([k, label]) => <button key={k} type="button" data-card-dex-show={k} onClick={() => setShow(k)} className={`rounded-full px-2.5 py-1 text-[11px] font-black ${show === k ? 'bg-amber-300 text-slate-950' : 'border border-white/20 bg-slate-900 text-slate-300'}`}>{label}</button>)}
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
                  <span className={`mt-0.5 line-clamp-2 min-h-[26px] text-[10px] font-bold leading-tight ${have ? 'text-slate-100' : 'text-slate-500'}`} style={JA_WRAP_STYLE}>{name}</span>
                  <span className="text-[9px] font-bold text-slate-500">No.{no}</span>
                </button>
              );
            })}
          </div>
        ) : <ScreenEmpty emoji="🃏" lines={[show === 'have' ? 'この弾のカードはまだ持っていません' : 'この弾は全部集まっています']}/>}
      </div>
      {detail && <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)}/>}
    </div>
  );
};

// ==================== ルールの画面(区切り2) ====================
// 文は 88-card-rules.jsx の CARD_RULE_PAGES(正本は RULES_SOURCE.md)。練習試合のやり直しもここから(ドラの D20)
const CardRules = ({ onBack, onTutorial }) => (
  <div data-mh-screen data-card-rules className={SCREEN_SHELL_CLASS}>
    <ScreenHead title="ルール" accent="text-amber-200" onBack={onBack}/>
    <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-2`}>
      {CARD_RULE_PAGES.map((pg) => (
        <div key={pg.id} data-card-rule={pg.id} className={SCREEN_PANEL_CLASS}>
          <div className="text-[14px] font-black text-amber-200">{pg.emoji} {pg.title}</div>
          <ul className="mt-1 space-y-0.5">
            {pg.lines.map((t, i) => <li key={i} className="flex gap-1 text-[12px] font-bold leading-snug text-slate-100" style={JA_WRAP_STYLE}><span className="shrink-0 text-amber-300">・</span><span>{jaWrap(t)}</span></li>)}
          </ul>
        </div>
      ))}
    </div>
    <div className={SCREEN_FOOTER_CLASS}>
      <button type="button" data-card-tutorial-again className="mh-button min-h-[52px] w-full rounded-2xl border border-emerald-300/50 bg-emerald-900/60 font-black text-emerald-50 active:scale-[.98]" onClick={() => { Audio_.se.tap(); onTutorial(); }}>練習試合をもう一度<span className="block text-[10px] font-bold text-emerald-200">ドラと、みゅあ相手に5つの決まりをおさらい</span></button>
    </div>
  </div>
);
