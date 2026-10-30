// ==================== 画面: デッキ登録(1 デッキ → 2 戦い方 → 3 登録) ====================
// 2026-10-29 社長「デッキ登録めちゃくちゃやりづらい」→ 作り直し(案A+案Bの札)。
//   1本道: 1 デッキをえらぶ → 2 戦い方をえらぶ(おすすめをえらぶと、持っている戦術カードから3体それぞれに自動でセット)→ 3 確かめて登録
//   自分で細かく決めるときは、3体を縦に並べ、「倒せる相手を倒しに行く」のような組み合わせの札を1枚でえらぶ(こまかく作りたい人は「自分で組み合わせる」)
//   組み直したら、そのまま登録の手順に乗る(組んだだけで登録に反映されない落とし穴をなくす)
// 保存: 戦術カードの持ち物・セットは mh_card_tactics_v1(96)、登録は表 card_deck_entries(95)。新しいキーは無い
// 戦術カードを引くのはマーケット(55 の「戦術カード」)。持っているカードの一覧は 97 の CardTacticsScreen(右上のボタン)

// おすすめの戦い方。基本カードは持っている物の先頭、セットは持っている物だけを、開いている枚数まで入れる
const CARD_REG_STYLES = Object.freeze([
  { id: 'attack', icon: '⚔️', name: 'どんどん攻める', desc: '倒せる相手から倒す・ガッツがたまったら大技・ピンチのときだけ守る', base: ['tAttack', 'tRush', 'tBalance'],
    mons: [['ko', 'atk'], ['myGuts.5', 'cost.大技(4以上)'], ['foeLife.50', 'atk'], ['myGuts.3', 'cost.大技(4以上)'], ['selfLife.30', 'guardDie'], ['foeLife.30', 'atk'], ['any', 'atk'], ['incoming.7', 'guard'], ['turnLe.3', 'atk']], breeder: [['any', 'save'], ['foeAlive.3', 'fieldCard']] },
  { id: 'guard', icon: '🛡️', name: '守りを固める', desc: '守り札を残して堅く守り、相手が弱ったら倒しに行く', base: ['tGuard', 'tSteady', 'tBalance'],
    mons: [['selfLife.50', 'guard'], ['ko', 'atk'], ['any', 'guard'], ['incoming.5', 'guard'], ['foeLife.50', 'atk'], ['foeLife.30', 'atk'], ['myGuts.3', 'cost.大技(4以上)'], ['selfLife.30', 'guardDie']], breeder: [['any', 'keepGuard'], ['any', 'save']] },
  { id: 'save', icon: '🔋', name: 'ためて大技', desc: 'はじめはガッツをため、たまったら大技で一気に削る', base: ['tSave', 'tBig', 'tBalance'],
    mons: [['myGuts.5', 'cost.大技(4以上)'], ['myGuts.3', 'cost.大技(4以上)'], ['ko', 'atk'], ['selfLife.30', 'guardDie'], ['foeLife.50', 'atk'], ['any', 'guard']], breeder: [['turnLe.3', 'save'], ['any', 'save']] },
  { id: 'disrupt', icon: '🌀', name: '相手を崩す', desc: '相手の手札とガッツを減らしてから攻める', base: ['tDisrupt', 'tJam', 'tBalance'],
    mons: [['foeHandGe.4', 'disrupt.手札を捨てさせる'], ['foeGutsGe.4', 'disrupt.ガッツを減らす'], ['ko', 'atk'], ['foeLife.50', 'atk'], ['myGuts.3', 'cost.大技(4以上)'], ['any', 'atk']], breeder: [['any', 'save']] },
]);
// 組み合わせの札(条件と行動を1枚にした物)。where … 'mon'(3体の枠)/ 'breeder'(ブリーダーの枠)
const CARD_REG_COMBOS = Object.freeze([
  { sec: 'おすすめ', icon: '🗡️', name: '倒せる相手を倒しに行く', c: 'ko', a: 'atk', where: 'mon' },
  { sec: 'おすすめ', icon: '💥', name: 'ためたら大技', c: 'myGuts.5', a: 'cost.大技(4以上)', where: 'mon' },
  { sec: 'おすすめ', icon: '🛡️', name: 'ピンチなら守る', c: 'selfLife.30', a: 'guard', where: 'mon' },
  { sec: 'おすすめ', icon: '🌊', name: '3体いたら全体攻撃', c: 'foeAlive.3', a: 'reach.全体攻撃', where: 'mon' },
  { sec: '攻める', icon: '⚔️', name: '弱った相手を狙う', c: 'foeLife.50', a: 'atk', where: 'mon' },
  { sec: '攻める', icon: '🎯', name: '最後の1体を倒す', c: 'foeAlive.1', a: 'atk', where: 'mon' },
  { sec: '攻める', icon: '💨', name: 'はじめから攻める', c: 'turnLe.3', a: 'atk', where: 'mon' },
  { sec: '攻める', icon: '🔥', name: '弱った相手に大技', c: 'foeLife.30', a: 'cost.大技(4以上)', where: 'mon' },
  { sec: '攻める', icon: '✨', name: '回避されない技で攻める', c: 'any', a: 'eff.回避されない', where: 'mon' },
  { sec: '守る', icon: '🧱', name: '大きい攻撃だけ守る', c: 'any', a: 'guardOver.5', where: 'mon' },
  { sec: '守る', icon: '🙏', name: '倒されそうなときだけ守る', c: 'any', a: 'guardDie', where: 'mon' },
  { sec: '守る', icon: '💨', name: '守るときは回避を先に', c: 'any', a: 'guardFirst.回避', where: 'mon' },
  { sec: '守る', icon: '🧊', name: '守るときは防御を先に', c: 'any', a: 'guardFirst.防御', where: 'mon' },
  { sec: '崩す', icon: '🃏', name: '手札の多い相手を崩す', c: 'foeHandGe.4', a: 'disrupt.手札を捨てさせる', where: 'mon' },
  { sec: '崩す', icon: '🔻', name: 'ガッツの多い相手を崩す', c: 'foeGutsGe.4', a: 'disrupt.ガッツを減らす', where: 'mon' },
  { sec: 'ブリーダー', icon: '🔋', name: 'ガッツをためる', c: 'any', a: 'save', where: 'breeder' },
  { sec: 'ブリーダー', icon: '⏳', name: 'はじめのうちはためる', c: 'turnLe.3', a: 'save', where: 'breeder' },
  { sec: 'ブリーダー', icon: '🛡️', name: '守り札はガッツにしない', c: 'any', a: 'keepGuard', where: 'breeder' },
  { sec: 'ブリーダー', icon: '🌐', name: '相手が3体なら全体カード', c: 'foeAlive.3', a: 'fieldCard', where: 'breeder' },
  { sec: 'ブリーダー', icon: '💚', name: 'ピンチなら回復', c: 'myLife.50', a: 'bEff.回復する', where: 'breeder' },
]);
// 1枚を1文で(「倒せる相手 なら → 攻める」)。組み合わせの札にある物はその名前
const cardRegRowText = (row) => {
  const combo = CARD_REG_COMBOS.find((x) => x.c === row.c && x.a === row.a);
  if (combo) return `${combo.icon} ${combo.name}`;
  const c = cardTacticOf(row.c), a = cardTacticOf(row.a);
  if (row.c === 'any') return `いつでも → ${a ? a.name : '?'}`;
  return `${c ? c.name : '?'} なら → ${a ? a.name : '?'}`;
};
// おすすめの戦い方を、持っているカード・開いている枚数で入れる。
//   3体に同じカードを入れると賢さに1枚としか数えない(82 の cardTacticUncounted)ので、候補を上から順に3体へ配る(左・真ん中・右・左…)。
//   候補が足りなければ、同じ物を重ねずに空けておく
const cardRegApplyStyle = (style, tactics, open) => {
  const owns = (id) => cardTacticsOwns(tactics, id);
  const cands = (list) => list.filter(([c, a]) => owns(c) && owns(a)).map(([c, a]) => ({ c, a, on: true }));
  const monC = cands(style.mons);
  const mons = [[], [], []];
  for (let j = 0; j < open.mon; j++) for (let i = 0; i < 3; i++) { const x = monC[j * 3 + i]; if (x) mons[i].push(x); }
  const base = style.base.find(owns) || 'tBalance';
  return cardTacticNormalizeFrames({ base: [base, null, null], breeder: cands(style.breeder).slice(0, open.breeder), mons });
};
// 切り札「おまかせ」: デッキの攻撃の技からダメージの大きい3種類
const cardRegAutoAces = (db, deck) => {
  const seen = new Set();
  return (deck ? deck.cards : []).map((no) => cardOf(db, no)).filter((c) => c && cardIsAttackKind(c.kind) && !seen.has(c.no) && seen.add(c.no))
    .sort((x, y) => (y.damage || 0) - (x.damage || 0)).slice(0, CARD_SHARE_ACES_MAX).map((c) => c.no);
};

const CardRegSteps = ({ step }) => (
  <div data-card-reg-steps className="mb-2 flex gap-1">
    {[['deck', '1 デッキ'], ['style', '2 戦い方'], ['confirm', '3 登録']].map(([k, l], i) => {
      const idx = ['deck', 'style', 'confirm'].indexOf(step === 'custom' ? 'style' : step);
      return <span key={k} className={`flex-1 rounded-full py-1 text-center text-[12px] font-black ${i === idx ? 'bg-amber-400 text-slate-950' : i < idx ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-800 text-slate-400'}`}>{l}</span>;
    })}
  </div>
);
const CardRegThumbs = ({ db, deck, h = 48 }) => (
  <span className="flex shrink-0">{[0, 1, 2].map((i) => { const m = deck && cardMonsterOf(db, deck.monsters[i]); return m ? <img key={i} src={CARD_IMG(m.img)} alt={m.name} style={{ height: h, width: Math.round(h * 0.71) }} className={`rounded-[5px] border border-white/70 object-cover ${i ? '-ml-2' : ''}`}/> : <span key={i} style={{ height: h, width: Math.round(h * 0.71) }} className={`block rounded-[5px] bg-slate-700 ${i ? '-ml-2' : ''}`}/>; })}</span>
);

// 組み合わせの札をえらぶ窓。where … 'mon' / 'breeder'
const CardRegComboSheet = ({ tactics, where, title, onPick, onCustom, onClose }) => {
  const list = CARD_REG_COMBOS.filter((x) => x.where === where);
  const secs = [...new Set(list.map((x) => x.sec))];
  return (
    <div data-card-reg-combos={where} className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 p-3">
      <ScreenHead title={title} accent="text-amber-200" onBack={onClose}/>
      <div className="min-h-0 flex-1 overflow-y-auto pb-2">
        {secs.map((s) => (
          <div key={s} className="mb-2">
            <p className="mb-1 text-[12px] font-black text-amber-200">{s}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {list.filter((x) => x.sec === s).map((x) => {
                const ok = cardTacticsOwns(tactics, x.c) && cardTacticsOwns(tactics, x.a);
                return (
                  <button key={x.name} type="button" data-card-reg-combo={x.name} disabled={!ok} onClick={() => { Audio_.fgSe.tap(); onPick({ c: x.c, a: x.a, on: true }); }}
                    className={`rounded-xl border-2 p-2 text-left ${ok ? 'border-slate-600 bg-slate-800 active:scale-[.97]' : 'border-slate-800 bg-slate-900 opacity-50'}`}>
                    <span className="block text-[20px] leading-none">{x.icon}</span>
                    <b className="mt-1 block text-[13px] font-black leading-tight text-white" style={JA_WRAP_STYLE}>{x.name}</b>
                    <small className="block text-[10px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{ok ? `${(cardTacticOf(x.c) || {}).name} ▶ ${(cardTacticOf(x.a) || {}).name}` : 'まだ持っていない戦術カードがいります(マーケットで引けます)'}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button type="button" data-card-reg-custom onClick={() => { Audio_.fgSe.tap(); onCustom(); }} className="mh-button min-h-[48px] w-full rounded-2xl font-black">自分で組み合わせる(条件と行動を別々にえらぶ)</button>
    </div>
  );
};

// 案B の段の見出し: 番号(色)・題・今いくつ/入れられる数・何を決める所か
const CardRegSecHead = ({ n, color, title, count, what }) => (
  <div>
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] font-black text-slate-950" style={{ background: color }}>{n}</span>
      <b className="text-[15px] font-black text-white">{title}</b>
      <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-black text-white">{count}</span>
    </div>
    <p className="mt-1 text-[11px] font-bold leading-snug text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(what)}</p>
  </div>
);
// セットした戦術カードの並び(上から順に見る)。▲▼で並べかえ・✕で外す。賢さに数えないときは理由
const CardRegRows = ({ rows, why = [], onRows }) => (
  <div className="mt-1.5 space-y-1">
    {rows.map((r, i) => (
      <div key={i} data-card-reg-row={i} className="rounded-xl bg-slate-800 px-2 py-1.5">
        <div className="flex items-center gap-1.5 text-[13px] font-black text-white">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[11px] text-amber-200">{i + 1}</span>
          <span className="min-w-0 flex-1" style={JA_WRAP_STYLE}>{cardRegRowText(r)}</span>
          <button type="button" aria-label="上へ" disabled={i === 0} onClick={() => { const a = rows.slice(); [a[i - 1], a[i]] = [a[i], a[i - 1]]; onRows(a); }} className="px-1 text-[12px] text-slate-300 disabled:opacity-20">▲</button>
          <button type="button" aria-label="下へ" disabled={i >= rows.length - 1} onClick={() => { const a = rows.slice(); [a[i + 1], a[i]] = [a[i], a[i + 1]]; onRows(a); }} className="px-1 text-[12px] text-slate-300 disabled:opacity-20">▼</button>
          <button type="button" aria-label="外す" data-card-reg-row-remove onClick={() => { Audio_.fgSe.tap(); onRows(rows.filter((_, j) => j !== i)); }} className="px-1 text-[14px] text-slate-400">✕</button>
        </div>
        {why[i] && <small className="block pl-6 text-[10px] font-bold text-slate-400">{`賢さに数えない(${why[i]})`}</small>}
      </div>
    ))}
  </div>
);
// ③ モンスターを押した先(下から出る「◯◯の手」)。並べかえ・外す・入れる・ほかの2体にも同じ手・おすすめで入れる。下で3体を切りかえ
const CardRegMonSheet = ({ db, deck, k, rows, max, why, name, counts, onRows, onSwitch, onClose, onAdd, onCopy, onAuto }) => {
  const m = deck && cardMonsterOf(db, deck.monsters[k]);
  return (
    <div data-card-reg-mon-sheet={k} className="fixed inset-0 z-[78] flex flex-col justify-end bg-black/55" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[82%] overflow-y-auto rounded-t-3xl border-t-[3px] border-sky-400 bg-slate-950 p-3" style={{ paddingBottom: 'max(.75rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-2.5">
          {m && <img src={CARD_IMG(m.img)} alt="" className="aspect-[5/7] w-[52px] rounded-[8px] border-2 border-sky-400 object-cover"/>}
          <div className="min-w-0 flex-1">
            <b className="block text-[18px] font-black text-white">{`${name(k)}の手`}</b>
            <small className="block text-[11px] font-bold text-slate-300">上から順に見て、当てはまった物を使います</small>
            <span className="mt-1 inline-block rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-black text-white">{`${rows.length}枚 / 入れられる ${max}枚`}</span>
          </div>
          <button type="button" aria-label="とじる" data-card-reg-mon-close onClick={onClose} className="self-start px-2 text-[22px] text-slate-400">✕</button>
        </div>
        <CardRegRows rows={rows} why={why} onRows={onRows}/>
        {rows.length < max
          ? <button type="button" data-card-reg-add={k} onClick={() => { Audio_.fgSe.tap(); onAdd(); }} className="mt-1.5 w-full rounded-xl border-2 border-dashed border-sky-300/70 py-2 text-[12px] font-black text-sky-100">{`＋ ${name(k)}の手を入れる`}</button>
          : CARD_FRAME_MAX_TEXT('mon', max) && <small className="mt-1 block text-center text-[10px] font-bold text-slate-400">{CARD_FRAME_MAX_TEXT('mon', max)}</small>}
        <p className="mt-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] font-bold leading-snug text-amber-100" style={JA_WRAP_STYLE}>{jaWrap('入れると: このモンスターが場面に合った技を出すようになり、賢さが上がります。守る手は、このモンスターが狙われたときに見ます。')}</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" data-card-reg-mon-copy onClick={() => { Audio_.fgSe.tap(); onCopy(); }} className="mh-button min-h-[44px] rounded-xl text-[12px] font-black">ほかの2体にも同じ手</button>
          <button type="button" data-card-reg-mon-auto onClick={() => { Audio_.fgSe.tap(); onAuto(); }} className="mh-button mh-button-primary min-h-[44px] rounded-xl text-[12px] font-black">おすすめで入れる</button>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[0, 1, 2].map((i) => (
            <button key={i} type="button" data-card-reg-mon-tab={i} onClick={() => { Audio_.fgSe.tap(); onSwitch(i); }} className={`rounded-xl border-2 py-1.5 text-center ${i === k ? 'border-sky-400 bg-sky-900/50' : 'border-white/15 bg-slate-800'}`}>
              <b className="block truncate px-1 text-[12px] font-black text-white">{name(i)}</b><small className="text-[11px] font-black text-emerald-300">{`${counts[i]} / ${max}`}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// onOpenList … 持っている戦術カードの一覧(97)/ onOpenMarket … マーケットの戦術カード
const CardDeckRegister = ({ db, decks, collection, frame = null, onBack, onOpenList = null, onOpenMarket = null }) => {
  const [step, setStep] = useState('deck');
  const [data, setData] = useState(null);       // cardTacticsLoad
  const [mine, setMine] = useState(undefined);  // 登録中(cardShareFetchMine)
  const [selfId, setSelfId] = useState(null);
  const [profile, setProfile] = useState({ name: 'ブリーダー', icon: '🙂' });
  const [deckId, setDeckId] = useState(null);
  const [draft, setDraft] = useState(null);     // 戦い方(枠の形)
  const [styleId, setStyleId] = useState(null);
  const [aces, setAces] = useState('auto');     // 'auto' か カード番号の配列
  const [sheet, setSheet] = useState(null);     // { where, k }
  const [custom, setCustom] = useState(null);   // { k, c? } 自分で組み合わせる
  const [monSheet, setMonSheet] = useState(null); // ③ モンスターを押した先(下から出る「◯◯の手」。0〜2)
  const [basePick, setBasePick] = useState(null); // ① 基本の型をえらぶ(0 メイン・1 サブ1・2 サブ2)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const list = (decks && decks.decks) || [];
  const issuesOf = (d) => (d ? [...cardDeckProblems(db, d), ...cardDeckOwnProblems(db, d, collection || {})] : ['デッキがありません']);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const d = await cardTacticsLoad();
      const [name, icon] = await Promise.all([storeGet('mh_breeder_name', 'ブリーダー', false), storeGet('mh_breeder_icon', '🙂', false)]).catch(() => ['ブリーダー', '🙂']);
      const id = typeof ensureBreederId === 'function' ? await ensureBreederId().catch(() => null) : null;
      const row = typeof id === 'string' ? await cardShareFetchMine(id).catch(() => null) : null;
      if (!alive) return;
      setData(d); setSelfId(typeof id === 'string' ? id : null); setMine(row || null);
      setProfile({ name: typeof name === 'string' && name ? name : 'ブリーダー', icon: typeof icon === 'string' && icon ? icon : '🙂' });
      const same = row ? list.find((x) => JSON.stringify(x.monsters) === JSON.stringify(row.deck.monsters) && JSON.stringify(x.cards) === JSON.stringify(row.deck.cards)) : null;
      setDeckId((same || list.find((x) => issuesOf(x).length === 0) || list[0] || {}).id || null);
      setDraft(cardTacticNormalizeFrames(d.tactics.frames));
      const t = row ? cardShareNormalizeTactics(row.tactics) : null;
      if (t && t.aces.length) setAces(t.aces);
    })();
    return () => { alive = false; };
  }, []);
  if (!data || mine === undefined || !draft) return <div data-mh-screen data-card-reg className={SCREEN_SHELL_CLASS}><ScreenHead title="デッキ登録" accent="text-amber-200" onBack={onBack}/><p className="text-[13px] font-bold text-slate-300">読み込み中…</p></div>;
  const lv = data.info.level;
  const open = cardLevelFrames(lv);
  const tactics = data.tactics;
  const deck = list.find((x) => x.id === deckId) || null;
  const monName = (i) => ((deck && cardMonsterOf(db, deck.monsters[i])) || {}).name || ['左のモンスター', '真ん中のモンスター', '右のモンスター'][i];
  const battle = cardTacticsFramesForBattle({ ...tactics, frames: draft }, lv);
  const smartLv = cardTacticSmartLevel(battle);
  const smartText = cardShareSmartText({ f: cardTacticPackFrames(battle) });
  const uncounted = cardTacticUncounted(battle);
  const acesNow = aces === 'auto' ? cardRegAutoAces(db, deck) : aces;
  const setRows = (k, rows) => setDraft((f) => (k === 'breeder' ? { ...f, breeder: rows } : { ...f, mons: f.mons.map((r, i) => (i === k ? rows : r)) }));
  const rowsOf = (k) => (k === 'breeder' ? draft.breeder : draft.mons[k]);
  const maxOf = (k) => (k === 'breeder' ? open.breeder : open.mon);
  const register = async () => {
    if (!deck || issuesOf(deck).length || !selfId || busy) return;
    setBusy(true); setMsg('');
    try {
      // 戦い方は持ち物(mh_card_tactics_v1)にも残す(次に開いたとき・プロフィール)。読み直した値に、セットだけを書く
      const fresh = await cardTacticsLoad();
      const nextT = { ...fresh.tactics, frames: cardTacticNormalizeFrames(draft) };
      await saveStoredValuesOrRollback([{ key: CARD_TACTICS_KEY, before: fresh.rawT, next: nextT }], storeGet, storeSet);
      const f = cardTacticPackFrames(cardTacticsFramesForBattle(nextT, lv));
      const r = await cardShareRegister({ ownerId: selfId, name: profile.name, icon: profile.icon, frame, deck,
        tactics: { name: deck.name, habit: cardShareMainHabit(cardTacticUnpackFrames(f), 'kyuko'), aces: acesNow, f } });
      if (r === 'ok') { setMine(await cardShareFetchMine(selfId)); setMsg('登録しました。ほかのブリーダーが、フリー対戦でこのデッキと戦えます'); setStep('done'); }
      else setMsg(r === 'locked' ? 'この端末では登録を書きかえられません(登録した端末で操作してください)' : r === 'bad' ? `このデッキは登録できませんでした(${cardShareBadReason(db, deck, { aces: acesNow, f })})` : r === 'nokey' ? 'この端末に保存できなかったため、登録できませんでした' : '通信できませんでした。もう一度お試しください');
    } finally { setBusy(false); }
  };
  const unregister = async () => {
    if (!selfId || busy) return;
    setBusy(true);
    const r = await cardShareUnregister(selfId);
    if (r === 'ok' || r === 'none') { setMine(null); setMsg('登録をやめました'); }
    setBusy(false);
  };
  const footer = (left, right) => <div className={`${SCREEN_FOOTER_CLASS} flex gap-2`}>{left}{right}</div>;
  const back = (to) => <button type="button" data-card-reg-back onClick={() => { Audio_.fgSe.tap(); setStep(to); }} className="mh-button min-h-[52px] flex-1 rounded-2xl font-black">戻る</button>;
  const headRight = onOpenList ? <button type="button" data-card-reg-list onClick={() => { Audio_.fgSe.tap(); onOpenList(); }} className="rounded-lg border border-white/20 px-2 py-1 text-[11px] font-black text-slate-200">持っている<br/>戦術カード</button> : null;
  const mineBox = mine ? (
    <div data-card-reg-mine className={`${SCREEN_PANEL_CLASS} mb-2 flex items-center gap-2 py-2`}>
      <CardRegThumbs db={db} deck={mine.deck} h={36}/>
      <span className="min-w-0 flex-1 text-[12px] font-bold text-slate-200"><b className="block truncate text-white">{`登録中: ${cardShareNormalizeTactics(mine.tactics).name || 'デッキ'}`}</b>{`賢さ ${cardShareSmartText(mine.tactics)}・戦われた ${mine.battles}回`}</span>
      <button type="button" data-card-reg-unregister disabled={busy} onClick={() => { Audio_.fgSe.tap(); void unregister(); }} className="shrink-0 rounded-lg border border-white/15 px-2 py-1 text-[11px] font-black text-slate-300">やめる</button>
    </div>
  ) : null;
  return (
    <div data-mh-screen data-card-reg data-card-reg-step={step} className={SCREEN_SHELL_CLASS}>
      <ScreenHead title={step === 'custom' ? '戦い方を決める' : 'デッキ登録'} accent="text-amber-200" onBack={step === 'custom' ? () => setStep('style') : onBack} right={headRight}
        note={step === 'custom' ? '上から順に見て、当てはまった物を使います' : <span data-card-reg-rank className="mt-0.5 inline-flex"><PlayerRankBadge kind="card" rank={lv} size="sm"/></span>}/>
      <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-2`}>
        {step !== 'custom' && step !== 'done' && <CardRegSteps step={step}/>}
        {msg && step !== 'done' && <p data-card-reg-msg className="rounded-xl bg-slate-900 p-2 text-[13px] font-bold text-amber-100" style={JA_WRAP_STYLE}>{jaWrap(msg)}</p>}
        {step === 'deck' && (<>
          {mineBox}
          <p className="text-[16px] font-black text-white">登録するデッキをえらんでください</p>
          {list.map((d) => {
            const why = issuesOf(d);
            return (
              <button key={d.id} type="button" data-card-reg-deck={d.id} disabled={why.length > 0} onClick={() => { Audio_.fgSe.tap(); setDeckId(d.id); }}
                className={`flex w-full items-center gap-3 rounded-2xl border-2 p-2 text-left ${deckId === d.id ? 'border-amber-300 bg-amber-950/30' : 'border-slate-700 bg-slate-900'} ${why.length ? 'opacity-50' : ''}`}>
                <CardRegThumbs db={db} deck={d}/>
                <span className="min-w-0 flex-1"><b className="block truncate text-[14px] font-black text-white">{d.name}</b>
                  <small className={`block text-[11px] font-bold ${why.length ? 'text-rose-200' : 'text-slate-400'}`} style={JA_WRAP_STYLE}>{why.length ? why[0] : d.monsters.map((no) => (cardMonsterOf(db, no) || {}).name).join('・')}</small></span>
              </button>
            );
          })}
          {!list.length && <p className="text-[13px] font-bold text-slate-300">デッキがありません。デッキ編成で組んでください</p>}
        </>)}
        {step === 'style' && (<>
          <p className="text-[16px] font-black text-white">どんな戦い方にしますか?</p>
          {CARD_REG_STYLES.map((s, i) => (
            <button key={s.id} type="button" data-card-reg-style={s.id} onClick={() => { Audio_.fgSe.tap(); setStyleId(s.id); setDraft(cardRegApplyStyle(s, tactics, open)); }}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left ${styleId === s.id ? 'border-amber-300 bg-amber-950/40' : 'border-slate-700 bg-slate-900'}`}>
              <span className="w-10 text-center text-[28px]">{s.icon}</span>
              <span className="min-w-0 flex-1"><b className="block text-[15px] font-black text-white">{s.name}{i === 0 && <span className="ml-1.5 rounded bg-emerald-600 px-1.5 text-[10px]">おすすめ</span>}</b>
                <small className="block text-[11px] font-bold leading-snug text-slate-300" style={JA_WRAP_STYLE}>{s.desc}</small></span>
            </button>
          ))}
          <button type="button" data-card-reg-style="custom" onClick={() => { Audio_.fgSe.tap(); setStyleId('custom'); setStep('custom'); }}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-slate-500 bg-slate-900 p-3 text-left">
            <span className="w-10 text-center text-[28px]">✏️</span>
            <span className="min-w-0 flex-1"><b className="block text-[15px] font-black text-white">自分で細かく決める</b><small className="block text-[11px] font-bold text-slate-300" style={JA_WRAP_STYLE}>3体それぞれに、戦術カードを1枚ずつセットします(今のセットから直せます)</small></span>
          </button>
          <p className="text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>えらぶと、持っている戦術カードから、その戦い方に合う物を3体それぞれに自動でセットします。次の画面で中身を見られます。</p>
        </>)}
        {/* 2026-10-30 社長「基本カード/ブリーダーカード/各モンスターカードを、見やすくわかりやすく設定できるように」→ 案B:
            ①基本の型 ②ブリーダーの手 ③モンスターごとの手 を1画面に、色と番号で分けて並べる。モンスターを押すと下からその子の手 */}
        {step === 'custom' && (<>
          <section data-card-reg-sec="base" className="rounded-2xl border-2 border-amber-500 bg-slate-900/90 p-2.5">
            <CardRegSecHead n="①" color="#f59e0b" title="基本の型" count={`${draft.base.filter(Boolean).length}枚 / 入れられる ${open.base}枚`}
              what="デッキ全体の大まかな打ち方。下の②③のどれにも当てはまらない場面は、この型で打ちます。"/>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((i) => {
                const c = cardTacticOf(draft.base[i]);
                const locked = i >= open.base;
                const lockAt = (CARD_LEVEL_FRAMES.find((f) => (f.base || 0) > i) || {}).at;
                return (
                  <button key={i} type="button" data-card-reg-base-slot={i} disabled={locked} onClick={() => { Audio_.fgSe.tap(); setBasePick(i); }}
                    className={`flex min-h-[106px] flex-col rounded-xl border-2 p-1.5 text-left ${locked ? 'items-center justify-center border-dashed border-white/25 bg-slate-800/70 text-center' : c ? 'border-white/60 active:scale-[.97]' : 'items-center justify-center border-dashed border-amber-300/60 bg-slate-800/60 active:scale-[.97]'}`}
                    style={!locked && c ? { background: 'linear-gradient(160deg,#b45309,#7c2d12)' } : undefined}>
                    <small className="text-[10px] font-black text-amber-200">{i === 0 ? 'メイン' : `サブ${i}`}</small>
                    {locked ? <><span className="text-[20px]">🔒</span><small className="text-[10px] font-black text-slate-300">{lockAt ? `ランク${lockAt}で` : ''}</small></>
                      : c ? <><b className="mt-0.5 block text-[14px] font-black leading-tight text-white" style={JA_WRAP_STYLE}>{c.name}</b><small className="mt-auto line-clamp-3 text-[10px] font-bold leading-snug text-orange-50" style={JA_WRAP_STYLE}>{c.desc}</small></>
                        : <b className="mt-1 text-[13px] font-black text-amber-100">＋ えらぶ</b>}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] font-bold leading-snug text-amber-100" style={JA_WRAP_STYLE}>{jaWrap('入れると: 賢さの上限が上がります(1枚 HARD まで・2枚 EXPERT・3枚 MASTER)。サブは、型を3分の1だけ足します。')}</p>
          </section>
          <section data-card-reg-sec="breeder" className="rounded-2xl border-2 border-violet-400 bg-slate-900/90 p-2.5">
            <CardRegSecHead n="②" color="#a78bfa" title="ブリーダーの手" count={`${draft.breeder.length}枚 / 入れられる ${open.breeder}枚`}
              what="ブリーダーのカード・全体カードをいつ出すか、ガッツをどこに置くか。攻撃の番は③のあとに見ます。"/>
            <CardRegRows rows={draft.breeder} why={uncounted.breeder} onRows={(a) => setRows('breeder', a)}/>
            {draft.breeder.length < open.breeder
              ? <button type="button" data-card-reg-add="breeder" onClick={() => { Audio_.fgSe.tap(); setSheet({ where: 'breeder', k: 'breeder' }); }} className="mt-1.5 w-full rounded-xl border-2 border-dashed border-violet-300/70 py-2 text-[12px] font-black text-violet-100">＋ ブリーダーの手を入れる</button>
              : CARD_FRAME_MAX_TEXT('breeder', open.breeder) && <small className="mt-1 block text-center text-[10px] font-bold text-slate-400">{CARD_FRAME_MAX_TEXT('breeder', open.breeder)}</small>}
          </section>
          <section data-card-reg-sec="mons" className="rounded-2xl border-2 border-sky-400 bg-slate-900/90 p-2.5">
            <CardRegSecHead n="③" color="#38bdf8" title="モンスターごとの手" count={`${draft.mons.reduce((a, r) => a + r.length, 0)}枚 / 入れられる ${open.mon * 3}枚`}
              what="そのモンスターが、どの場面で、どの技を出すか。押すと、そのモンスターの手を決められます。"/>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((k) => {
                const m = deck && cardMonsterOf(db, deck.monsters[k]);
                const rows = draft.mons[k];
                return (
                  <button key={k} type="button" data-card-reg-mon={k} onClick={() => { Audio_.fgSe.tap(); setMonSheet(k); }} className="flex flex-col items-center rounded-xl border-2 border-white/15 bg-slate-800/90 p-1.5 text-center active:scale-[.97]">
                    {m ? <img src={CARD_IMG(m.img)} alt="" className="aspect-[5/7] w-[64px] rounded-[6px] border-2 border-white/50 object-cover"/> : <span className="aspect-[5/7] w-[64px] rounded-[6px] bg-slate-700"/>}
                    <b className="mt-1 block w-full truncate text-[13px] font-black text-white">{monName(k)}</b>
                    <small className={`block text-[11px] font-black ${rows.length ? 'text-emerald-300' : 'text-slate-400'}`}>{`${rows.length} / ${open.mon}`}</small>
                    <small className="mt-0.5 line-clamp-2 text-[10px] font-bold leading-snug text-slate-300" style={JA_WRAP_STYLE}>{rows.length ? `${cardRegRowText(rows[0])}${rows.length > 1 ? ` ほか${rows.length - 1}` : ''}` : 'まだ入っていません'}</small>
                  </button>
                );
              })}
            </div>
          </section>
        </>)}
        {step === 'confirm' && (<>
          <p className="text-[16px] font-black text-white">この内容で登録します</p>
          <div data-card-reg-summary className={`${SCREEN_PANEL_CLASS} space-y-1 py-2 text-[12px] font-bold leading-relaxed text-slate-200`} style={JA_WRAP_STYLE}>
            <div className="flex items-center gap-2"><CardRegThumbs db={db} deck={deck} h={36}/><b className="text-[14px] text-white">{deck ? deck.name : '—'}</b></div>
            <div><b className="text-amber-200">戦い方</b> {styleId && styleId !== 'custom' ? (CARD_REG_STYLES.find((s) => s.id === styleId) || {}).name : '自分で決めた戦い方'}{` (基本の型: ${(cardTacticOf(battle.base[0]) || {}).name || 'なし'})`}</div>
            {[0, 1, 2].map((i) => <div key={i}>{`・${monName(i)}: ${battle.mons[i].length ? battle.mons[i].map(cardRegRowText).join(' / ') : 'なし'}`}</div>)}
            <div>{`・ブリーダー: ${battle.breeder.length ? battle.breeder.map(cardRegRowText).join(' / ') : 'なし'}`}</div>
            <button type="button" data-card-reg-edit onClick={() => { Audio_.fgSe.tap(); setStep('custom'); }} className="text-[12px] font-black text-sky-300">▶ 3体それぞれを直す</button>
          </div>
          <div data-card-reg-smart={smartLv} className={`${SCREEN_PANEL_CLASS} py-2`}>
            <div className="flex items-center gap-2 text-[13px] font-black text-white">賢さ <span className="text-amber-200">{smartText}</span></div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700"><i className="block h-full bg-gradient-to-r from-emerald-400 to-amber-300" style={{ width: `${(['random', 'easy', 'normal', 'hard', 'expert', 'master'].indexOf(smartLv) / 5) * 100}%` }}/></div>
            <small className="mt-1 block text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>賢さは、ほかのブリーダーがこのデッキと戦うときの相手の強さです。ちゃんと効く戦術カードが多いほど上がります。</small>
          </div>
          <div data-card-reg-aces className={`${SCREEN_PANEL_CLASS} py-2`}>
            <div className="flex items-center gap-2 text-[13px] font-black text-white">切り札 <span className="text-[12px] text-amber-200">{aces === 'auto' ? 'おまかせ' : '自分でえらぶ'}</span>
              <button type="button" data-card-reg-aces-toggle onClick={() => setAces((a) => (a === 'auto' ? cardRegAutoAces(db, deck) : 'auto'))} className="ml-auto text-[12px] font-black text-sky-300">{aces === 'auto' ? '変える ›' : 'おまかせに戻す'}</button></div>
            <small className="block text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{`出せるときに優先して使うカード: ${acesNow.map((no) => (cardOf(db, no) || {}).name).filter(Boolean).join('・') || 'なし'}`}</small>
            {aces !== 'auto' && (
              <div className="mt-1 flex max-h-[24vh] flex-wrap gap-1 overflow-y-auto">
                {[...new Set(deck ? deck.cards : [])].map((no) => { const on = aces.includes(no); return (
                  <button key={no} type="button" data-card-reg-ace={no} onClick={() => setAces((a) => (on ? a.filter((x) => x !== no) : a.length >= CARD_SHARE_ACES_MAX ? a : [...a, no]))}
                    className={`rounded-lg px-2 py-0.5 text-[11px] font-black ${on ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>{(cardOf(db, no) || {}).name || no}</button>); })}
              </div>
            )}
          </div>
          <p className="px-1 text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>登録できるのは1組だけです。登録し直すと前の登録と入れかわります。登録した端末でだけ、書きかえ・やめる・報酬の受け取りができます。</p>
        </>)}
        {step === 'done' && (<>
          {mineBox}
          <p className="rounded-2xl border border-emerald-300/50 bg-emerald-950/40 p-3 text-[14px] font-black text-emerald-100" style={JA_WRAP_STYLE}>登録しました!ほかのブリーダーが、フリー対戦の「ほかのブリーダー」でこのデッキと戦えます。戦われると、次の日に報酬のビートPが届きます。</p>
          {onOpenMarket && <button type="button" data-card-reg-market onClick={() => { Audio_.fgSe.tap(); onOpenMarket(); }} className="mh-button min-h-[48px] w-full rounded-2xl font-black">戦術カードを引く(マーケット)</button>}
        </>)}
      </div>
      {step === 'deck' && footer(null, <button type="button" data-card-reg-next disabled={!deck || issuesOf(deck).length > 0} onClick={() => { Audio_.fgSe.tap(); setStep('style'); }} className="mh-button mh-button-primary min-h-[52px] flex-1 rounded-2xl font-black disabled:opacity-40">次へ(戦い方をえらぶ)</button>)}
      {step === 'style' && footer(back('deck'), <button type="button" data-card-reg-next disabled={!styleId} onClick={() => { Audio_.fgSe.tap(); setStep('confirm'); }} className="mh-button mh-button-primary min-h-[52px] flex-1 rounded-2xl font-black disabled:opacity-40">次へ</button>)}
      {step === 'custom' && footer(null, <button type="button" data-card-reg-next onClick={() => { Audio_.fgSe.tap(); setStep('confirm'); }} className="mh-button mh-button-primary min-h-[52px] flex-1 rounded-2xl font-black">決める(登録の確かめへ)</button>)}
      {step === 'confirm' && footer(back(styleId === 'custom' ? 'custom' : 'style'), <button type="button" data-card-reg-register disabled={busy || !deck || !selfId} onClick={() => { Audio_.fgSe.tap(); void register(); }} className="mh-button mh-button-primary min-h-[52px] flex-[2] rounded-2xl font-black disabled:opacity-40">{mine ? 'この内容で登録し直す' : 'このデッキを登録する'}</button>)}
      {step === 'done' && footer(null, <button type="button" onClick={() => { Audio_.fgSe.tap(); onBack(); }} className="mh-button mh-button-primary min-h-[52px] flex-1 rounded-2xl font-black">とじる</button>)}
      {monSheet !== null && !sheet && !custom && (
        <CardRegMonSheet db={db} deck={deck} k={monSheet} rows={draft.mons[monSheet]} max={open.mon} why={uncounted.mons[monSheet]} name={monName} counts={draft.mons.map((r) => r.length)}
          onRows={(a) => setRows(monSheet, a)} onSwitch={setMonSheet} onClose={() => setMonSheet(null)}
          onAdd={() => setSheet({ where: 'mon', k: monSheet })}
          onCopy={() => setDraft((f) => ({ ...f, mons: f.mons.map((r, i) => (i === monSheet ? r : f.mons[monSheet].slice(0, open.mon))) }))}
          onAuto={() => setRows(monSheet, cardTacticAutoFill(tactics, draft.mons[monSheet], 'monster', open.mon))}/>
      )}
      {basePick !== null && <CardTacticPicker db={db} tactics={tactics} cat="base" title={basePick === 0 ? '基本の型(メイン)をえらぶ' : `基本の型(サブ${basePick})をえらぶ`} allowNone={basePick > 0}
        onClose={() => setBasePick(null)} onPick={(id) => { setDraft((f) => ({ ...f, base: f.base.map((x, i) => (i === basePick ? id : x)) })); setBasePick(null); }}/>}
      {sheet && <CardRegComboSheet tactics={tactics} where={sheet.where} title={sheet.where === 'breeder' ? 'ブリーダーの戦い方' : `${monName(sheet.k)}の戦い方`}
        onClose={() => setSheet(null)} onPick={(row) => { setRows(sheet.k, [...rowsOf(sheet.k), row].slice(0, maxOf(sheet.k))); setSheet(null); }}
        onCustom={() => { setCustom({ k: sheet.k, where: sheet.where }); setSheet(null); }}/>}
      {custom && !custom.c && <CardTacticPicker db={db} tactics={tactics} cat="cond" title="条件(〜なら)をえらぶ" hideSecs={custom.where === 'breeder' ? ['このモンスター', '守るとき'] : []}
        onClose={() => setCustom(null)} onPick={(id, sp) => { if (!id) return; setCustom((x) => ({ ...x, c: id, sp })); }}/>}
      {custom && custom.c && <CardTacticPicker db={db} tactics={tactics} cat={custom.where === 'breeder' ? 'breeder' : 'monster'} title="行動(→ 〜する)をえらぶ"
        onClose={() => setCustom(null)} onPick={(id) => { if (!id) return; setRows(custom.k, [...rowsOf(custom.k), { c: custom.c, a: id, on: true, ...(custom.sp ? { sp: custom.sp } : {}) }].slice(0, maxOf(custom.k))); setCustom(null); }}/>}
    </div>
  );
};
