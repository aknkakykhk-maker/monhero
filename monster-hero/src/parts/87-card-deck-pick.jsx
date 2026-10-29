// ==================== 対戦の前のデッキ選び ====================
// 2026-10-29 社長(案C): 助手と対戦・マルチ対戦の前に、使うデッキを選ぶ画面を1枚挟む。練習試合には挟まない。
//   前に使ったデッキ(mh_card_decks_v1 の active)がはじめから選ばれていて、そのまま「対戦へ」を押せば1手で始まる。
//   選んだデッキは active を書き換えるだけ(保存の形は変えない。書くのは 84 の CardBattleScreen)。
//   使えないデッキ(枚数が足りない・持っていないカードがある など)は、理由を出して選べないようにする。
// 選べるデッキの一覧は cardDeckPickChoices の1か所で作る。借りたデッキ(レンタル)は、ここに kind の違う行を足せば並ぶ
const cardDeckPickChoices = (db, decks, collection) => ((decks && decks.decks) || []).map((d) => ({
  id: d.id, kind: 'own', name: d.name, monsters: d.monsters, count: d.cards.length,
  why: [...cardDeckProblems(db, d), ...cardDeckOwnProblems(db, d, collection || {})],
}));

const CardDeckPick = ({ db, decks, collection, title = 'デッキをえらぶ', note = '', onPick, onBack }) => {
  const choices = cardDeckPickChoices(db, decks, collection);
  const usable = (c) => c && c.why.length === 0;
  const first = choices.find((c) => c.id === decks.active && usable(c)) || choices.find(usable) || null;
  const [sel, setSel] = useState(first ? first.id : null);
  const [busy, setBusy] = useState(false);
  const chosen = choices.find((c) => c.id === sel && usable(c)) || null;
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
        {note && <p className="text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{note}</p>}
        {choices.map((c) => {
          const on = c.id === sel;
          const ok = usable(c);
          return (
            <button key={c.id} type="button" data-card-deck-pick-row={c.id} data-card-deck-pick-on={on ? '1' : undefined} disabled={!ok}
              onClick={() => { Audio_.fgSe.tap(); setSel(c.id); }}
              className={`${SCREEN_PANEL_CLASS} flex w-full items-center gap-2 text-left active:scale-[.99] ${on ? '!border-amber-300 ring-2 ring-amber-300/70' : ''} ${ok ? '' : 'opacity-60'}`}>
              <span className="flex shrink-0 gap-0.5">{[0, 1, 2].map((i) => { const m = cardMonsterOf(db, c.monsters[i]); return m ? <img key={i} src={CARD_IMG(m.img)} alt={m.name} className="h-[52px] w-[37px] rounded-[4px] object-cover"/> : <span key={i} className="block h-[52px] w-[37px] rounded-[4px] border border-dashed border-white/20"/>; })}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-black leading-tight text-white" style={JA_LABEL_STYLE}>{on ? '★ ' : ''}{jaWrap(c.name)}</span>
                <span className={`block text-[11px] font-bold ${ok ? 'text-emerald-300' : 'text-amber-200'}`}>{`${c.count}/${CARD_BATTLE_DECK_SIZE}枚`}</span>
                {!ok && <span data-card-deck-pick-why={c.id} className="block text-[11px] font-bold leading-snug text-amber-200" style={JA_WRAP_STYLE}>{c.why.join('・')}</span>}
              </span>
            </button>
          );
        })}
        {!first && <p data-card-deck-pick-none className="rounded-xl border border-amber-300/40 bg-amber-500/10 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>対戦に使えるデッキがありません。デッキ編成で組んでください</p>}
      </div>
      <div className={SCREEN_FOOTER_CLASS}>
        <button type="button" data-card-deck-pick-go disabled={!chosen || busy} onClick={() => { void go(); }}
          className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black active:scale-[.98] disabled:opacity-40">対戦へ</button>
      </div>
    </div>
  );
};
