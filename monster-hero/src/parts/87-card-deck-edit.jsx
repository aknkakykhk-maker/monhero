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
      <CardNameFit name={name} className="mt-0.5 font-bold leading-tight text-slate-100"/>
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
        {notice && <div data-card-deck-notice className="text-[12px] font-black text-amber-200" style={JA_LABEL_STYLE}>{jaWrap(notice)}</div>}
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
            <p className="mb-1 text-[11px] font-bold text-slate-400" style={JA_LABEL_STYLE}>{jaWrap('タップで入れる・上の枠をタップで外す。同じモンスターは1体まで(キラも同じモンスター)')}</p>
            <div className="grid grid-cols-4 gap-1.5">{ownedMons.map((no) => tile(no, () => (deck.monsters.includes(no) ? removeOne(no) : add(no))))}</div>
          </>
        )}
        {tab === 'deck' && (deckUnique.length
          ? <>
            <p className="mb-1 text-[11px] font-bold text-slate-400" style={JA_LABEL_STYLE}>{jaWrap('タップで1枚外す・長押しで詳しく')}</p>
            <div className="grid grid-cols-4 gap-1.5">{deckUnique.map((no) => tile(no, () => removeOne(no)))}</div>
          </>
          : <ScreenEmpty emoji="🃏" lines={['まだカードが入っていません', '「技・ブリーダー」から入れてください']}/>)}
      </div>
      <div className={`${SCREEN_FOOTER_CLASS} grid grid-cols-2 gap-2`}>
        <button type="button" data-card-deck-save className="mh-button mh-button-primary min-h-[52px] rounded-2xl font-black active:scale-[.98]" onClick={() => { Audio_.fgSe.tap(); onSave({ ...deck, name: (deck.name || '').trim() || 'デッキ' }); }}>保存する</button>
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
                  <CardNameFit name={name} className={`mt-0.5 font-bold leading-tight ${have ? 'text-slate-100' : 'text-slate-500'}`}/>
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
// 新しい画像ファイルは作らない。弾の色の袋に、その弾で出るモンスターの立ち絵(84 の cardMonArt。無ければカードの絵)を5体まで並べて描く
// torn … 上のふち(ちぎれる所)を描かない(パックを開ける画面で、ちぎれた帯を別に飛ばすとき)
const cardPackMonsters = (db, pack, n = 5) => {
  const seen = new Set();
  const list = Object.values(db.monsters).filter((m) => String(m.wave) === pack.wave && !m.variant && m.ready !== false && !seen.has(m.species) && seen.add(m.species));
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
const CardPackArt = ({ db, pack, width = 200, torn = false, className = '' }) => {
  const mons = cardPackMonsters(db, pack);
  // 真ん中を最後に(いちばん手前)。並べる順: 奥の左右 → 中の左右 → 真ん中
  const order = mons.length >= 5 ? [mons[0], mons[4], mons[1], mons[3], mons[2]] : mons;
  const slots = mons.length >= 5 ? CARD_PACK_SLOTS : CARD_PACK_SLOTS.slice(5 - mons.length);
  const h = Math.round(width * 1.48);
  const label = pack.id === 'hybrid' ? '混血' : `第${pack.wave}弾`;
  return (
    <div data-card-pack-art={pack.id} className={`relative overflow-hidden rounded-[14px] border-[3px] border-white/85 shadow-2xl ${className}`} style={{ width, height: h, background: `linear-gradient(165deg, ${pack.color} 0%, ${pack.color} 38%, #0b1020 100%)` }}>
      <div aria-hidden="true" className="absolute inset-0 opacity-35" style={{ background: `repeating-conic-gradient(from 0deg at 50% 62%, rgba(255,255,255,.55) 0 6deg, transparent 6deg 18deg)` }}/>
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,.28) 45%, transparent 60%)' }}/>
      {!torn && <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[7%]" style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.9) 0 6px, rgba(255,255,255,.45) 6px 12px)' }}/>}
      {order.map((m, k) => {
        const sl = slots[k]; const src = cardMonArt(m) || CARD_IMG(m.img);
        return <img key={m.no} src={src} alt="" aria-hidden="true" draggable={false} className="absolute object-contain object-bottom drop-shadow-[0_4px_6px_rgba(0,0,0,.6)]"
          style={{ width: sl.w, height: sl.h, bottom: sl.b, zIndex: sl.z, opacity: sl.o, ...(sl.center ? { left: sl.left, transform: 'translateX(-50%)' } : sl.left ? { left: sl.left } : { right: sl.right }) }}/>;
      })}
      <div className="absolute inset-x-0 top-[9%] z-[5] text-center">
        <div className="font-black leading-none text-white" style={{ fontSize: Math.round(width * 0.2), WebkitTextStroke: `${Math.max(2, Math.round(width / 50))}px #111`, paintOrder: 'stroke fill', textShadow: '0 4px 0 rgba(0,0,0,.45)' }}>{label}</div>
        <div className="mt-1 font-black tracking-wider text-white/90" style={{ fontSize: Math.round(width * 0.075), textShadow: '0 2px 2px rgba(0,0,0,.7)' }}>MFバトルカード</div>
      </div>
      <div className="absolute inset-x-[18%] bottom-[3%] z-[6] rounded-full bg-black/55 py-0.5 text-center font-black text-white" style={{ fontSize: Math.round(width * 0.07) }}>{pack.id === 'hybrid' ? '混血パック' : 'ブースターパック'}</div>
    </div>
  );
};

// ==================== パックを開ける画面(区切り2・CARD_PACK_OPEN) ====================
// マーケットの「カードポイント」の売り場で買ったら、ここへ来る(買うのと保存は 60-app。この部品は見せるだけ)
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
  const pack = cardPackOf(result.packId) || { id: 'w1', wave: '1', name: 'パック', color: '#f59e0b' };
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
          <div className={`grid w-full gap-2 ${cards.length > 4 ? 'grid-cols-4' : 'grid-cols-3'} px-1`}>
            {cards.map((c, i) => {
              const on = flipped.includes(i);
              const card = cardOf(db, c.no); const m = card ? null : cardMonsterOf(db, c.no);
              const name = card ? card.name : m ? m.name : c.no;
              const rare = c.rarity !== 'normal';
              return (
                <div key={`${pi}-${i}`} className="mh-pack-deal flex flex-col items-center" style={{ animationDelay: `${i * 70}ms` }}>
                  <button type="button" data-card-pack-card={i} data-card-pack-flipped={on ? 1 : 0} data-card-pack-rarity={c.rarity} {...(on ? press(c.no, () => setDetail(c.no)) : { onClick: () => flip(i) })} className="mh-pack-card relative w-full active:scale-95" style={{ WebkitUserSelect: 'none', userSelect: 'none' }}>
                    <div className={`mh-pack-card-in aspect-[5/7] w-full ${on ? 'flipped' : ''}`}>
                      <div className={`mh-pack-face flex items-center justify-center rounded-[5px] border-2 border-white/50 text-[22px] ${rare && !on ? (c.rarity === 'alt' ? 'mh-pack-alt-back' : 'mh-pack-kira-back') : ''}`} style={{ background: `linear-gradient(160deg, ${pack.color}, #0f172a)` }}>{c.slot === 'mon' ? '★' : '🃏'}</div>
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
            {packPoint > 0 ? <>だぶったカードは <b className="text-amber-200">カードポイント +{packPoint}</b> になりました</> : 'だぶったカードはありません'}
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

// ==================== マーケットの「カードポイント」の売り場: パックとスターターキット(区切り2) ====================
// 55-screen-breeder-market.jsx の「カードポイント」の売り場から出す。円盤石・アシストカードは 55 側(ビートP交換所と同じ並べ方)
// onBuyPack(packId, count) / onBuyStarter(kitId) … 60-app が保存して、パックならパックを開ける画面へ進む
const CardShopPacks = ({ db, point, busy, onBuyPack }) => {
  const [rates, setRates] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
  return (
    <div data-card-shop-packs className="space-y-2 pb-2">
      {CARD_PACKS.map((pack) => {
        const r = cardPackRates(db, pack.id);
        return (
          <div key={pack.id} data-card-shop-pack={pack.id} className={SCREEN_PANEL_CLASS} style={{ borderColor: `${pack.color}88` }}>
            <div className="flex items-center gap-2">
              <CardPackArt db={db} pack={pack} width={58} className="shrink-0 !rounded-[8px] !border-2"/>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-black text-white">{pack.name}</div>
                <div className="text-[11px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(pack.tech ? `${pack.tech + pack.mon}枚入り(技など${pack.tech}枚・モンスター${pack.mon}枚)` : `${pack.mon}枚入り(3枚とも混血モンスター)`)}</div>
                <button type="button" data-card-shop-rates={pack.id} onClick={() => setRates(rates === pack.id ? null : pack.id)} className="mt-0.5 text-[11px] font-black text-sky-300 underline">出る確率を見る</button>
              </div>
            </div>
            {rates === pack.id && r && (
              <div data-card-shop-rate-table className="mt-1.5 space-y-0.5 rounded-lg bg-black/30 p-2 text-[11px] font-bold leading-relaxed text-slate-200" style={JA_WRAP_STYLE}>
                {[
                  pack.tech > 0 ? `技などの枠(1パック${pack.tech}枚): ${r.techKinds}種類から同じ確率(1種類 ${pct(r.techEach)})。《準備中のカード》は出ません` : null,
                  `モンスターの枠(1パック${pack.mon}枚): 通常 ${pack.rarity.normal}%${pack.rarity.kira ? `・キラ ${pack.rarity.kira}%` : ''}${pack.rarity.alt ? `・別絵キラ ${pack.rarity.alt}%` : ''}(通常${r.mons.normal}種${r.mons.kira ? `・キラ${r.mons.kira}種` : ''}${r.mons.alt ? `・別絵キラ${r.mons.alt}種` : ''})。まだ持っていない種族は《2倍出やすい》`,
                  pack.pity ? `キラも別絵キラも出ないまま${CARD_PACK_PITY_AT}パック開けたら、つぎのパックは《キラ以上》` : null,
                  `だぶったカードはカードポイントになります(技など4枚目から${CARD_DUP_POINT.tech}・モンスター2枚目から${pack.id === 'hybrid' ? CARD_DUP_POINT.hybrid : `${CARD_DUP_POINT.normal}〔キラ${CARD_DUP_POINT.kira}・別絵キラ${CARD_DUP_POINT.alt}〕`})`,
                ].filter(Boolean).map((t, i) => <div key={i}>{cardRuleLine(t)}</div>)}
              </div>
            )}
            <div className={`mt-2 grid gap-1.5 ${pack.bundle ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button type="button" data-card-shop-buy={`${pack.id}-1`} disabled={busy || point < pack.price} onClick={() => setConfirm({ pack, count: 1 })} className="mh-button min-h-[44px] rounded-xl bg-orange-500 text-[13px] font-black text-white active:scale-[.98] disabled:opacity-40">1パック {pack.price}</button>
              {pack.bundle && <button type="button" data-card-shop-buy={`${pack.id}-${pack.bundle.n}`} disabled={busy || point < pack.bundle.price} onClick={() => setConfirm({ pack, count: pack.bundle.n })} className="mh-button min-h-[44px] rounded-xl bg-orange-600 text-[13px] font-black text-white active:scale-[.98] disabled:opacity-40">{pack.bundle.n}パック {pack.bundle.price}<span className="block text-[9px] font-bold">({pack.price * pack.bundle.n - pack.bundle.price}おトク)</span></button>}
            </div>
          </div>
        );
      })}
      {confirm && <ConfirmSheet title={`${confirm.pack.name}を${confirm.count}パック買いますか？`} message={`カードポイント ${cardPackPrice(confirm.pack, confirm.count)} を使います(いま ${point})`} confirmLabel="買って開ける" onCancel={() => setConfirm(null)} onConfirm={() => { const c = confirm; setConfirm(null); void onBuyPack(c.pack.id, c.count); }}/>}
    </div>
  );
};
const CardShopStarters = ({ db, point, busy, starter, shop, onBuyStarter }) => {
  const [confirm, setConfirm] = useState(null);
  const [done, setDone] = useState('');
  const kits = Object.values(db.starters).filter((k) => !starter || k.id !== starter.kit);
  return (
    <div data-card-shop-starters className="space-y-2 pb-2">
      {done && <div data-card-shop-starter-done className="rounded-xl border border-emerald-400/40 bg-emerald-950/40 px-3 py-2 text-[12px] font-black text-emerald-200" style={JA_WRAP_STYLE}>{jaWrap(done)}</div>}
      <p className="text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{jaWrap(`はじめに選ばなかったスターターキット。1つにつき1回、${CARD_STARTER_SHOP_PRICE}カードポイント。デッキも1つ増えます`)}</p>
      {kits.map((k) => {
        const bought = !!(shop && shop.starters && shop.starters[k.id]);
        return (
          <div key={k.id} data-card-shop-starter={k.id} className={SCREEN_PANEL_CLASS}>
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 gap-0.5">{k.monsters.map((no) => { const m = cardMonsterOf(db, no); return m ? <img key={no} src={CARD_IMG(m.img)} alt={m.name} className="h-[52px] w-[37px] rounded-[4px] object-cover"/> : null; })}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-black text-white" style={JA_WRAP_STYLE}>{jaWrap(k.name)}</div>
                <div className="text-[11px] font-bold text-slate-300">モンスター3枚・カード{k.cards.length}枚</div>
              </div>
            </div>
            <button type="button" data-card-shop-starter-buy={k.id} disabled={bought || busy || point < CARD_STARTER_SHOP_PRICE} onClick={() => setConfirm(k)} className="mh-button mt-2 min-h-[44px] w-full rounded-xl bg-orange-500 text-[13px] font-black text-white active:scale-[.98] disabled:opacity-40">{bought ? '買いました' : `${CARD_STARTER_SHOP_PRICE}カードポイント`}</button>
          </div>
        );
      })}
      {confirm && <ConfirmSheet title={`「${confirm.name}」を買いますか？`} message={`カードポイント ${CARD_STARTER_SHOP_PRICE} を使います(いま ${point})。だぶったカードはカードポイントになります`} confirmLabel="買う" onCancel={() => setConfirm(null)} onConfirm={async () => { const k = confirm; setConfirm(null); const r = await onBuyStarter(k.id); if (r && r.ok) setDone(`「${k.name}」を買いました。デッキ編成に1つ増えています${r.dupPoint > 0 ? `(だぶったカードはカードポイント +${r.dupPoint})` : ''}`); }}/>}
    </div>
  );
};
