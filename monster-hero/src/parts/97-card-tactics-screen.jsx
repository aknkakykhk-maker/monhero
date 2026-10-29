// ==================== 画面: 戦術カード(組む・引く・持っている) ====================
// 2026-10-29 社長: 戦術カードはガンビット型。中身は 82-card-tactics-core、持ち物・レベル・ガチャは 96-card-tactics。
//   組む … 基本(メイン1+サブ2)・ブリーダーの枠・モンスター1体ごとの枠(使うデッキの左・真ん中・右の子)。行は ON/OFF・上下・外す
//   引く … 1回300ビートPで8枚(パックと同じ開け方)・5回まとめて1,350・引く券・かけら10個で1枚えらぶ
//   持っている … 246枚の一覧(持っていないカードは影)
// 保存はこの画面が mh_card_tactics_v1 に書く。ビートPを払う取引は 84 の onPay(persist)に任せる(ビートPと戦術カードを1つの取引で)
// 公開前はデバッグの人だけ開ける(84 の入口が cardTacticsOpen() || debug を見る)

const CARD_TACTIC_CAT_STYLE = Object.freeze({
  cond: { label: '条件', bg: 'linear-gradient(160deg,#1d4ed8,#1e3a8a)', chip: 'bg-blue-700' },
  base: { label: '基本', bg: 'linear-gradient(160deg,#b45309,#7c2d12)', chip: 'bg-amber-700' },
  breeder: { label: 'ブリーダー', bg: 'linear-gradient(160deg,#7e22ce,#4c1d95)', chip: 'bg-purple-700' },
  monster: { label: 'モンスター', bg: 'linear-gradient(160deg,#b91c1c,#7f1d1d)', chip: 'bg-red-700' },
});
const CARD_TACTIC_RARE_COLOR = Object.freeze({ N: '#64748b', R: '#2563eb', SR: '#d97706' });
// 種族の名前(図鑑の通常の子の名前)
const cardTacticSpeciesList = (db) => {
  const seen = {};
  Object.values((db && db.monsters) || {}).forEach((m) => { if (m && m.species && !m.main && !m.variant && !seen[m.species]) seen[m.species] = m.name; });
  return Object.entries(seen).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
};
const cardTacticRowName = (db, row, which) => {
  const c = cardTacticOf(which === 'c' ? row.c : row.a);
  if (!c) return '?';
  if (which === 'c' && c.g === 'species') { const sp = cardTacticSpeciesList(db).find((x) => x.id === row.sp); return `${sp ? sp.name : '?'}の相手`; }
  return c.name;
};

// カード1枚の顔
const CardTacticFace = ({ card, owned = true, count = 0, onClick = null, small = false, mark = '' }) => {
  const st = CARD_TACTIC_CAT_STYLE[card.cat] || CARD_TACTIC_CAT_STYLE.cond;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} data-card-tactic={card.id} data-card-tactic-owned={owned ? '1' : '0'} onClick={onClick || undefined}
      className={`relative flex flex-col rounded-xl border-2 p-1.5 text-left ${owned ? 'border-white/60' : 'border-white/15 opacity-40 grayscale'} ${small ? 'min-h-[86px]' : 'min-h-[106px]'} ${onClick ? 'active:scale-[.97]' : ''}`}
      style={{ background: st.bg }}>
      <span className="flex items-center gap-1">
        <span className="rounded px-1 text-[11px] font-black text-white" style={{ background: CARD_TACTIC_RARE_COLOR[card.r] }}>{card.r}</span>
        {!small && <span className="whitespace-nowrap text-[11px] font-bold text-white/80">{st.label}</span>}
        {count > 1 && <span className="ml-auto text-[10px] font-black text-amber-200">×{count}</span>}
        {mark && <span className="ml-auto rounded bg-emerald-500 px-1 text-[10px] font-black text-white">{mark}</span>}
      </span>
      <b className={`mt-1 block font-black leading-tight text-white ${small ? 'text-[12.5px]' : 'text-[14px]'}`} style={JA_WRAP_STYLE}>{card.name}</b>
      {!small && <small className="mt-0.5 block text-[11.5px] font-bold leading-snug text-white/90" style={JA_WRAP_STYLE}>{card.desc}</small>}
    </Tag>
  );
};

// カードをえらぶ(持っているものだけ押せる)。cat … 'cond'|'base'|'breeder'|'monster'
// hideSecs … 出さない区分(ブリーダーの枠では「この子」「守るとき」の条件は当たらないので出さない)
const CardTacticPicker = ({ db, tactics, cat, title, onPick, onClose, allowNone = false, hideSecs = [] }) => {
  const list = CARD_TACTIC_CARDS.filter((c) => c.cat === cat && !hideSecs.includes(c.sec));
  const secs = [...new Set(list.map((c) => c.sec))];
  const [sp, setSp] = useState(null); // 「種族を決めた相手」の種族えらび
  if (sp) {
    return (
      <div data-card-tactic-species className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 p-3">
        <ScreenHead title="種族をえらぶ" accent="text-amber-200" onBack={() => setSp(null)}/>
        <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-1.5 overflow-y-auto">
          {cardTacticSpeciesList(db).map((x) => (
            <button key={x.id} type="button" data-card-tactic-species-pick={x.id} onClick={() => { Audio_.fgSe.tap(); onPick(sp, x.id); }}
              className="rounded-lg border border-white/20 bg-slate-800 px-1 py-2 text-[12px] font-black text-white active:scale-[.97]">{x.name}</button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div data-card-tactic-picker={cat} className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 p-3">
      <ScreenHead title={title} accent="text-amber-200" onBack={onClose}/>
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {allowNone && <button type="button" data-card-tactic-pick-none onClick={() => { Audio_.fgSe.tap(); onPick(null); }} className="mb-2 w-full rounded-xl border border-white/25 bg-slate-800 py-2 text-[13px] font-black text-white">外す</button>}
        {secs.map((s) => (
          <div key={s} className="mb-2">
            <p className="mb-1 text-[12px] font-black text-amber-200">{s}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {list.filter((c) => c.sec === s).map((c) => {
                const owned = cardTacticsOwns(tactics, c.id);
                return <CardTacticFace key={c.id} card={c} owned={owned} small onClick={owned ? () => { Audio_.fgSe.tap(); if (c.g === 'species') setSp(c.id); else onPick(c.id); } : null}/>;
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 1行
// why … 賢さに数えないときの理由(82-card-tactics-core の cardTacticCountDetail。2026-10-29 社長「ちゃんと効くカードだけ数える」)。数えるときは ''
const CardTacticRow = ({ db, row, i, n, onChange, onMove, onRemove, onPickC, onPickA, why = '' }) => (
  <div>
  <div data-card-tactic-row={i} className={`flex items-center gap-1 rounded-xl border-2 border-slate-700 bg-slate-900 p-1 ${row.on ? '' : 'opacity-50'}`}>
    <b className="w-4 text-center text-[12px] text-amber-200">{i + 1}</b>
    <button type="button" data-card-tactic-row-on={row.on ? '1' : '0'} onClick={() => { Audio_.fgSe.tap(); onChange({ ...row, on: !row.on }); }}
      className={`rounded-md px-1.5 py-1 text-[10px] font-black text-white ${row.on ? 'bg-emerald-600' : 'bg-slate-600'}`}>{row.on ? 'ON' : 'OFF'}</button>
    <button type="button" data-card-tactic-row-c onClick={onPickC} className="min-w-0 flex-1 rounded-lg bg-blue-700 px-1.5 py-1.5 text-left text-[11px] font-black leading-tight text-white" style={JA_WRAP_STYLE}>{cardTacticRowName(db, row, 'c')}</button>
    <span className="text-[10px] text-amber-300">▶</span>
    <button type="button" data-card-tactic-row-a onClick={onPickA} className={`min-w-0 flex-1 rounded-lg px-1.5 py-1.5 text-left text-[11px] font-black leading-tight text-white ${(CARD_TACTIC_CAT_STYLE[(cardTacticOf(row.a) || {}).cat] || {}).chip || 'bg-red-700'}`} style={JA_WRAP_STYLE}>{cardTacticRowName(db, row, 'a')}</button>
    <span className="flex flex-col">
      <button type="button" aria-label="上へ" disabled={i === 0} onClick={() => onMove(-1)} className="px-1 text-[11px] leading-none text-slate-300 disabled:opacity-20">▲</button>
      <button type="button" aria-label="下へ" disabled={i >= n - 1} onClick={() => onMove(1)} className="px-1 text-[11px] leading-none text-slate-300 disabled:opacity-20">▼</button>
    </span>
    <button type="button" aria-label="外す" data-card-tactic-row-remove onClick={onRemove} className="px-1 text-[13px] font-black text-slate-400">×</button>
  </div>
  {why && <p data-card-tactic-row-why={i} className="px-6 pt-0.5 text-[10px] font-bold leading-snug text-slate-400" style={JA_WRAP_STYLE}>{`賢さに数えない(${why})`}</p>}
  </div>
);

// おまかせで埋める行(持っているカードだけ。上から順に、空いている行へ)
const CARD_TACTIC_AUTO = Object.freeze({
  monster: [['ko', 'atk'], ['myLife.30', 'guardDie'], ['myGuts.5', 'cost.大技(4以上)'], ['foeLife.50', 'atk'], ['any', 'guard']],
  breeder: [['any', 'save'], ['foeAlive.3', 'fieldCard'], ['myKo', 'bEff.倒れた子を戻す']],
});
const cardTacticAutoFill = (t, rows, cat, max) => {
  const out = rows.slice();
  CARD_TACTIC_AUTO[cat].forEach(([c, a]) => {
    if (out.length >= max) return;
    if (!cardTacticsOwns(t, c) || !cardTacticsOwns(t, a) || out.some((r) => r.c === c && r.a === a)) return;
    out.push({ c, a, on: true });
  });
  return out;
};

// ---- パックと同じ開け方(87 の CardPackOpen にそろえる。破る → 光 → 配る → 1枚ずつめくる。SR はめくる前から光り、真ん中に大きく出る) ----
const CARD_TACTIC_TEAR_MS = 1150;
const CARD_TACTIC_SPOT_MS = 1500;
const CARD_TACTIC_SPOT_BACK_MS = 320;
const CardTacticPackOpen = ({ packs, onDone }) => {
  const [pi, setPi] = useState(0);
  const [phase, setPhase] = useState('closed');
  const [flipped, setFlipped] = useState([]);
  const [spot, setSpot] = useState(null);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };
  const se = (name) => { try { Audio_.fgSe[name](); } catch (e) { /* 音が出せなくても続ける */ } };
  const cards = packs[pi] || [];
  const allOpen = flipped.length >= cards.length;
  const last = pi >= packs.length - 1;
  const tear = () => { if (phase !== 'closed') return; se('special'); setPhase('tearing'); later(() => se('crit'), 520); later(() => setPhase('open'), CARD_TACTIC_TEAR_MS); };
  const spotOff = () => { setSpot((sp) => (sp && !sp.leaving ? { ...sp, leaving: true } : sp)); later(() => setSpot(null), CARD_TACTIC_SPOT_BACK_MS); };
  const reveal = (i) => {
    se('card');
    setFlipped((f) => (f.includes(i) ? f : [...f, i]));
    if (cards[i] && cards[i].r === 'SR') { later(() => { setSpot({ i, leaving: false }); se('crit'); se('fusion'); }, 380); later(spotOff, 380 + CARD_TACTIC_SPOT_MS); }
  };
  const flip = (i) => { if (flipped.includes(i) || phase !== 'open' || spot) return; reveal(i); };
  const flipAll = () => {
    if (spot) return;
    let at = 0;
    cards.map((_, i) => i).filter((i) => !flipped.includes(i)).forEach((i) => { later(() => reveal(i), at); at += cards[i].r === 'SR' ? 380 + CARD_TACTIC_SPOT_MS + CARD_TACTIC_SPOT_BACK_MS + 120 : 140; });
  };
  const next = () => { Audio_.fgSe.tap(); timers.current.forEach(clearTimeout); timers.current = []; setPi((x) => x + 1); setPhase('closed'); setFlipped([]); setSpot(null); };
  const spotCard = spot ? cardTacticOf(cards[spot.i].id) : null;
  return (
    <div data-mh-screen data-card-tactic-open data-card-tactic-open-phase={phase} className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="戦術カード" accent="text-amber-200" note={packs.length > 1 ? `${pi + 1} / ${packs.length}回` : ''}/>
      <div className={`${SCREEN_LIST_CLASS} relative flex flex-col items-center justify-center overflow-hidden pb-2`}>
        {phase !== 'open' ? (
          <button type="button" data-card-tactic-pack onClick={tear} aria-label="パックを開ける"
            className={`relative h-[320px] w-[216px] overflow-hidden rounded-[14px] border-[3px] border-white/85 shadow-2xl ${phase === 'tearing' ? 'animate-pulse' : ''}`}
            style={{ background: 'linear-gradient(165deg,#7c2d12 0%,#b45309 45%,#1e1b4b 100%)' }}>
            <span aria-hidden="true" className="absolute inset-0 opacity-35" style={{ background: 'repeating-conic-gradient(from 0deg at 50% 62%, rgba(255,255,255,.55) 0 6deg, transparent 6deg 18deg)' }}/>
            {phase === 'closed' && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[7%]" style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.9) 0 6px, rgba(255,255,255,.45) 6px 12px)' }}/>}
            {phase === 'tearing' && <span aria-hidden="true" className="absolute inset-x-[30%] -top-4 bottom-0 bg-gradient-to-b from-white via-amber-100/80 to-transparent blur-md"/>}
            <span className="absolute inset-x-0 top-[18%] block text-center text-[40px] font-black leading-none text-white" style={{ WebkitTextStroke: '3px #111', paintOrder: 'stroke fill' }}>戦術</span>
            <span className="absolute inset-x-0 top-[34%] block text-center text-[15px] font-black tracking-wider text-white/90">MFバトルカード</span>
            <span className="absolute inset-x-0 top-[48%] block text-center text-[52px]">🧠</span>
            <span className="absolute inset-x-[18%] bottom-[3%] rounded-full bg-black/55 py-0.5 text-center text-[14px] font-black text-white">戦術カード 8枚</span>
            {phase === 'closed' && <span className="absolute inset-x-0 bottom-[14%] block text-center text-[12px] font-black text-amber-100">タップで開ける</span>}
          </button>
        ) : (
          <div className="grid w-full max-w-[420px] grid-cols-4 gap-1.5 px-1">
            {cards.map((c, i) => {
              const card = cardTacticOf(c.id);
              const open = flipped.includes(i);
              return (
                <button key={i} type="button" data-card-tactic-open-card={i} data-card-tactic-open-flipped={open ? '1' : '0'} onClick={() => flip(i)} className="relative">
                  {open && card ? <CardTacticFace card={card} small mark={c.dup ? '' : 'NEW'}/> : (
                    <span data-card-tactic-back className={`block h-[86px] overflow-hidden rounded-xl border-2 border-white/50 bg-slate-900 ${c.r === 'SR' ? 'animate-pulse shadow-[0_0_14px_#f59e0b]' : ''}`}>
                      <img src={CARD_BACK_IMG()} alt="" draggable={false} className="h-full w-full object-cover"/></span>
                  )}
                  {open && c.dup && <span className="absolute bottom-0.5 right-0.5 rounded bg-slate-900/80 px-1 text-[9px] font-black text-amber-200">かけら+1</span>}
                </button>
              );
            })}
          </div>
        )}
        {spotCard && (
          <button type="button" data-card-tactic-spot onClick={spotOff} className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 transition-opacity ${spot.leaving ? 'opacity-0' : 'opacity-100'}`}>
            <span className="mb-2 rounded-full bg-amber-500 px-3 py-0.5 text-[16px] font-black text-white">SR!</span>
            <span className="w-[200px]"><CardTacticFace card={spotCard}/></span>
          </button>
        )}
      </div>
      <div className={`${SCREEN_FOOTER_CLASS} flex gap-2`}>
        {phase === 'open' && !allOpen && <button type="button" data-card-tactic-open-all onClick={flipAll} className="mh-button min-h-[48px] flex-1 rounded-2xl font-black">全部めくる</button>}
        {phase === 'open' && allOpen && !last && <button type="button" data-card-tactic-open-next onClick={next} className="mh-button mh-button-primary min-h-[48px] flex-1 rounded-2xl font-black">次へ</button>}
        {phase === 'open' && allOpen && last && <button type="button" data-card-tactic-open-done onClick={() => { Audio_.fgSe.tap(); onDone(); }} className="mh-button mh-button-primary min-h-[48px] flex-1 rounded-2xl font-black">とじる</button>}
      </div>
    </div>
  );
};

// ---- 戦術カードの画面 ----
// onPay(cost, entries) … ビートPを払って entries(戦術カードの保存)を1つの取引で書く(84 の persist)。成功なら true
// share … デッキ登録の「登録」タブに出す 95 の CardDeckShare の props(collection・frame・unlocked・debug)。あれば題は「デッキ登録」(2026-10-29 社長の作り直し)
// listOnly … 持っている戦術カードの一覧だけ(98 のデッキ登録の右上から。引くのはマーケット・2026-10-29 社長)
const CardTacticsScreen = ({ db, decks, point = 0, onPay, onBack, share = null, listOnly = false }) => {
  const [data, setData] = useState(null);   // cardTacticsLoad の中身
  const [tab, setTab] = useState(listOnly ? 'list' : share ? 'register' : 'build');   // register(デッキ登録だけ) / build / pull / list
  const screenTitle = listOnly ? '持っている戦術カード' : share ? 'デッキ登録' : '戦術カード';
  const [frame, setFrame] = useState('base'); // base / breeder / 0 / 1 / 2
  const [pick, setPick] = useState(null);     // { cat, title, onPick, allowNone }
  const [opening, setOpening] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const reload = async () => { const d = await cardTacticsLoad(); setData(d); return d; };
  useEffect(() => { void reload(); }, []);
  if (!data) return <div data-mh-screen data-card-tactics className={SCREEN_SHELL_CLASS}><ScreenHead title={screenTitle} accent="text-amber-200" onBack={onBack}/></div>;
  if (opening) return <CardTacticPackOpen packs={opening} onDone={() => setOpening(null)}/>;
  const t = data.tactics;
  const lv = data.info.level;
  const open = cardLevelFrames(lv);
  const nextF = cardLevelNextFrame(lv);
  const deck = ((decks && decks.decks) || []).find((d) => d.id === (decks && decks.active)) || ((decks && decks.decks) || [])[0] || null;
  const monOf = (i) => (deck ? cardMonsterOf(db, deck.monsters[i]) : null);
  // 枠を書いて保存(この画面だけが書く。ほかの項目は読み直した値のまま)
  const saveFrames = async (frames) => {
    const fresh = await cardTacticsLoad();
    const next = { ...fresh.tactics, frames: cardTacticNormalizeFrames(frames) };
    const ok = await saveStoredValuesOrRollback([{ key: CARD_TACTICS_KEY, before: fresh.rawT, next }], storeGet, storeSet);
    if (!ok) { setNotice('保存できませんでした'); return; }
    setData({ ...fresh, tactics: next, rawT: next });
  };
  const f = t.frames;
  // 賢さに数えないセットの理由(82-card-tactics-core の cardTacticUncounted。ルールくん 2026-10-29「ちゃんと効く戦術カードだけ数える」)
  const uncounted = cardTacticUncounted(f);
  const whyOf = (k, i) => { const list = k === 'breeder' ? uncounted.breeder : uncounted.mons[k]; return (list && list[i]) || ''; };
  const rowsOf = (k) => (k === 'breeder' ? f.breeder : f.mons[k]);
  const setRows = (k, rows) => saveFrames(k === 'breeder' ? { ...f, breeder: rows } : { ...f, mons: f.mons.map((r, i) => (i === k ? rows : r)) });
  const maxOf = (k) => (k === 'breeder' ? open.breeder : open.mon);
  const catOf = (k) => (k === 'breeder' ? 'breeder' : 'monster');
  const editRow = (k, i, which) => {
    const rows = rowsOf(k);
    setPick({ cat: which === 'c' ? 'cond' : catOf(k), hideSecs: which === 'c' && k === 'breeder' ? ['この子', '守るとき'] : [], title: which === 'c' ? '条件カードをえらぶ' : `${CARD_TACTIC_CAT_STYLE[catOf(k)].label}カードをえらぶ`,
      onPick: (id, sp) => { setPick(null); if (!id) return; const r = { ...rows[i], [which]: id }; if (which === 'c') { if (sp) r.sp = sp; else delete r.sp; } void setRows(k, rows.map((x, j) => (j === i ? r : x))); } });
  };
  const addRow = (k) => {
    const rows = rowsOf(k);
    if (rows.length >= maxOf(k)) return;
    void setRows(k, [...rows, { c: 'any', a: k === 'breeder' ? 'save' : 'atk', on: true }]);
  };
  const pay = async (count, payWith) => {
    if (busy) return;
    setBusy(true);
    try {
      const fresh = await cardTacticsLoad();
      const r = cardTacticsPull(fresh.tactics, count, { payWith, point }, Math.random);
      if (!r) { setNotice(payWith === 'ticket' ? 'カードパック券が足りません' : 'ビートPが足りません'); return; }
      Audio_.fgSe.tap();
      const entries = [{ key: CARD_TACTICS_KEY, before: fresh.rawT, next: r.next }];
      const ok = await onPay(r.cost, entries);
      if (!ok) { setNotice('保存できませんでした'); return; }
      setData({ ...fresh, tactics: r.next, rawT: r.next });
      setOpening(r.packs);
    } finally { setBusy(false); }
  };
  const exchange = (id) => {
    setPick(null);
    void (async () => {
      const fresh = await cardTacticsLoad();
      const next = cardTacticsExchange(fresh.tactics, id);
      if (!next) { setNotice('かけらが足りません'); return; }
      const ok = await saveStoredValuesOrRollback([{ key: CARD_TACTICS_KEY, before: fresh.rawT, next }], storeGet, storeSet);
      if (ok) { setData({ ...fresh, tactics: next, rawT: next }); setOpening([[{ id, r: (cardTacticOf(id) || {}).r || 'N', dup: false }]]); } else setNotice('保存できませんでした');
    })();
  };
  const ownCount = CARD_TACTIC_CARDS.filter((c) => cardTacticsOwns(t, c.id)).length;
  const frameTabs = [{ k: 'base', label: '基本', icon: '⭐', sub: `${f.base.filter(Boolean).length}/${open.base}` }, { k: 'breeder', label: 'ブリーダー', icon: '🧑', sub: `${f.breeder.length}/${open.breeder}枚` },
    ...[0, 1, 2].map((i) => ({ k: i, label: (monOf(i) || {}).name || ['左の子', '真ん中の子', '右の子'][i], mon: monOf(i), sub: `${f.mons[i].length}/${open.mon}枚` }))];
  return (
    <div data-mh-screen data-card-tactics className={SCREEN_SHELL_CLASS}>
      <ScreenHead title={screenTitle} accent="text-amber-200" onBack={onBack} note={(share ? cardShareOpen() : cardTacticsOpen()) ? '' : 'つくっている途中(デバッグ)'}/>
      <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-2`}>
        <div data-card-tactics-level className={`${SCREEN_PANEL_CLASS} py-2`}>
          <PlayerRankBadge kind="card" rank={lv} size="sm"/>
          <div className="mt-1"><PlayerRankGauge kind="card" info={{ rank: lv, into: data.info.into, need: data.info.need }}/></div>
          {nextF && <p className="mt-1 text-[11px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{`次はランク${nextF.at}で${[nextF.base ? `基本${nextF.base}枚目` : '', nextF.breeder ? `ブリーダーに${nextF.breeder}枚目` : '', nextF.mon ? `各モンスターに${nextF.mon}枚目` : ''].filter(Boolean).join('・')}が開く`}</p>}
        </div>
        <div className="flex gap-1">
          {!listOnly && [...(share ? [['register', '登録']] : []), ['build', '組む'], ['list', `持っている ${ownCount}/${CARD_TACTIC_CARDS.length}`]].map(([k, l]) => (
            <button key={k} type="button" data-card-tactics-tab={k} onClick={() => { Audio_.fgSe.tap(); setTab(k); }}
              className={`flex-1 rounded-xl border-2 py-1.5 text-[12px] font-black ${tab === k ? 'border-amber-300 bg-amber-900/50 text-amber-100' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>{l}</button>
          ))}
        </div>
        {notice && <p data-card-tactics-notice className="rounded-lg bg-amber-500/15 p-1.5 text-[12px] font-bold text-amber-100">{notice}</p>}
        {tab === 'register' && share && (
          // 登録したデッキの戦術カードは、レベルで開いている枠・持っているカードだけを載せる(95)。「組む」タブで直したら、登録し直す
          <CardDeckShare key={`reg-${(t.frames && JSON.stringify(t.frames).length) || 0}`} db={db} decks={decks} collection={share.collection} frame={share.frame} unlocked={share.unlocked} debug={share.debug}
            part="mine" embedded onOpenTactics={() => setTab('build')}/>
        )}
        {tab === 'build' && (
          <div data-card-tactics-build className="space-y-1.5">
            <div className="flex gap-1">
              {frameTabs.map((x) => (
                <button key={x.k} type="button" data-card-tactics-frame={x.k} onClick={() => { Audio_.fgSe.tap(); setFrame(x.k); }}
                  className={`min-w-0 flex-1 rounded-lg border-2 px-0.5 py-1 text-center ${frame === x.k ? 'border-amber-300 bg-amber-900/40' : 'border-slate-700 bg-slate-900'}`}>
                  {x.mon ? <img src={CARD_IMG(x.mon.img)} alt="" className="mx-auto h-[30px] w-[22px] rounded object-cover"/> : <span className="block text-[18px] leading-[30px]">{x.icon}</span>}
                  <span className="block truncate text-[10px] font-black text-white">{x.label}</span>
                  <span className="block text-[9px] font-bold text-slate-400">{x.sub}</span>
                </button>
              ))}
            </div>
            {frame === 'base' ? (
              <div className="space-y-1.5">
                {[0, 1, 2].map((i) => {
                  const c = cardTacticOf(f.base[i]);
                  const locked = i >= open.base;
                  const at = (CARD_LEVEL_FRAMES.find((x) => x.base === i + 1) || {}).at;
                  return (
                    <button key={i} type="button" data-card-tactics-base={i} disabled={locked}
                      onClick={() => setPick({ cat: 'base', title: i === 0 ? 'メインの基本カード' : `サブの基本カード(${i}枚目)`, allowNone: true, onPick: (id) => { setPick(null); void saveFrames({ ...f, base: f.base.map((x, j) => (j === i ? id : x)) }); } })}
                      className={`flex w-full items-center gap-2 rounded-xl border-2 p-2 text-left ${locked ? 'border-dashed border-slate-600 bg-slate-900 text-slate-400' : i === 0 ? 'border-amber-200 bg-gradient-to-r from-orange-900 to-amber-700' : 'border-slate-300 bg-gradient-to-r from-slate-700 to-slate-600'}`}>
                      <span className="text-[11px] font-black text-white/80">{i === 0 ? 'メイン' : `サブ${i}`}</span>
                      <span className="min-w-0 flex-1"><b className="block text-[14px] font-black text-white">{locked ? `ランク${at}で開く` : c ? c.name : '(なし)'}</b>
                        {!locked && <small className="block text-[10px] text-white/80" style={JA_WRAP_STYLE}>{c ? c.desc : i === 0 ? 'セットした戦術カードのどれにも当たらない場面は、この型で打つ' : '型を3分の1だけ足す'}</small>}</span>
                    </button>
                  );
                })}
                <p className="text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>メインはそのまま、サブは型を3分の1だけ足します。</p>
              </div>
            ) : (
              <div className="space-y-1">
                {rowsOf(frame).map((r, i, all) => (
                  <CardTacticRow key={i} db={db} row={r} i={i} n={all.length}
                    onChange={(nr) => { void setRows(frame, all.map((x, j) => (j === i ? nr : x))); }}
                    onMove={(d) => { const a = all.slice(); const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; Audio_.fgSe.tap(); void setRows(frame, a); }}
                    onRemove={() => { Audio_.fgSe.tap(); void setRows(frame, all.filter((_, j) => j !== i)); }}
                    onPickC={() => editRow(frame, i, 'c')} onPickA={() => editRow(frame, i, 'a')} why={whyOf(frame, i)}/>
                ))}
                {rowsOf(frame).length < maxOf(frame) && (
                  <button type="button" data-card-tactics-add onClick={() => { Audio_.fgSe.tap(); addRow(frame); }} className="w-full rounded-xl border-2 border-dashed border-slate-500 py-2 text-[12px] font-black text-slate-200">＋ 戦術カードをセットする</button>
                )}
                {(frame === 'breeder' ? CARD_FRAME_MAX_TEXT('breeder', open.breeder) : CARD_FRAME_MAX_TEXT('mon', open.mon)) && (
                  <p className="text-center text-[11px] font-bold text-slate-400">{frame === 'breeder' ? CARD_FRAME_MAX_TEXT('breeder', open.breeder) : CARD_FRAME_MAX_TEXT('mon', open.mon)}</p>
                )}
                <div className="flex gap-1.5 pt-1">
                  {frame !== 'breeder' && <button type="button" data-card-tactics-copy onClick={() => { Audio_.fgSe.tap(); void saveFrames({ ...f, mons: [0, 1, 2].map(() => f.mons[frame].slice()) }); setNotice('この子の戦術カードを、ほかの2体にも写しました'); }}
                    className="mh-button min-h-[44px] flex-1 rounded-xl text-[11px] font-black">この子の戦術カードを<br/>ほかの2体にも写す</button>}
                  <button type="button" data-card-tactics-auto onClick={() => { Audio_.fgSe.tap(); void setRows(frame, cardTacticAutoFill(t, rowsOf(frame), catOf(frame), maxOf(frame))); }}
                    className="mh-button mh-button-primary min-h-[44px] flex-1 rounded-xl text-[11px] font-black">おまかせで<br/>あいている所に入れる</button>
                </div>
                <p className="text-[11px] font-bold leading-snug text-slate-400" style={JA_WRAP_STYLE}>{frame === 'breeder' ? '攻撃の番は、モンスターの枠のあとに見ます。ガッツの番はここだけを見ます。' : '上にセットした戦術カードから順に見て、条件に当たったカードの手をこの子が出します。守るときは、この子が狙われたときに見ます。'}</p>
              </div>
            )}
          </div>
        )}
        {tab === 'pull' && (
          <div data-card-tactics-pull className="space-y-2">
            <div className={`${SCREEN_PANEL_CLASS} py-2 text-[12px] font-bold text-slate-200`} style={JA_WRAP_STYLE}>
              1回で8枚(N 70%・R 25%・SR 5%)。SR が出ないまま7回引いたら、8回目の最後の1枚は SR。だぶったカードは「かけら」になり、10個でまだ持っていないカードを1枚えらべます。
              <div className="mt-1 flex flex-wrap gap-x-3 text-[12px] font-black text-amber-200"><span data-card-tactics-point>{`ビートP ${point.toLocaleString()}`}</span><span data-card-tactics-tickets>{`カードパック券 ${t.tickets}枚`}</span><span data-card-tactics-shards>{`かけら ${t.shards}個`}</span></div>
            </div>
            <button type="button" data-card-tactics-buy="1" disabled={busy || point < cardTacticsPrice(1)} onClick={() => { void pay(1, 'point'); }} className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black disabled:opacity-40">1回引く(300ビートP)</button>
            <button type="button" data-card-tactics-buy="5" disabled={busy || point < cardTacticsPrice(5)} onClick={() => { void pay(5, 'point'); }} className="mh-button min-h-[52px] w-full rounded-2xl font-black disabled:opacity-40">5回まとめて引く(1,350ビートP)</button>
            <button type="button" data-card-tactics-ticket disabled={busy || t.tickets < 1} onClick={() => { void pay(1, 'ticket'); }} className="mh-button min-h-[48px] w-full rounded-2xl font-black disabled:opacity-40">{`カードパック券で1回引く(のこり${t.tickets}枚)`}</button>
            <button type="button" data-card-tactics-exchange disabled={t.shards < CARD_TACTICS_SHARD_COST} onClick={() => setPick({ cat: 'all-missing', title: 'かけら10個で1枚えらぶ', onPick: exchange })}
              className="mh-button min-h-[48px] w-full rounded-2xl font-black disabled:opacity-40">{`かけらで1枚えらぶ(${t.shards}/${CARD_TACTICS_SHARD_COST})`}</button>
          </div>
        )}
        {tab === 'list' && (
          <div data-card-tactics-list className="space-y-2">
            {['base', 'breeder', 'monster', 'cond'].map((cat) => (
              <div key={cat}>
                <p className="mb-1 text-[12px] font-black text-amber-200">{`${CARD_TACTIC_CAT_STYLE[cat].label}カード ${CARD_TACTIC_CARDS.filter((c) => c.cat === cat && cardTacticsOwns(t, c.id)).length}/${CARD_TACTIC_CARDS.filter((c) => c.cat === cat).length}`}</p>
                <div className="grid grid-cols-3 gap-1.5">{CARD_TACTIC_CARDS.filter((c) => c.cat === cat).map((c) => <CardTacticFace key={c.id} card={c} small owned={cardTacticsOwns(t, c.id)} count={t.own[c.id] || 0}/>)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {pick && pick.cat === 'all-missing' && (
        <div data-card-tactic-picker="missing" className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 p-3">
          <ScreenHead title={pick.title} accent="text-amber-200" onBack={() => setPick(null)}/>
          <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-1.5 overflow-y-auto pb-3">
            {CARD_TACTIC_CARDS.filter((c) => !cardTacticsOwns(t, c.id)).map((c) => <CardTacticFace key={c.id} card={c} small onClick={() => { Audio_.fgSe.tap(); pick.onPick(c.id); }}/>)}
          </div>
        </div>
      )}
      {pick && pick.cat !== 'all-missing' && <CardTacticPicker db={db} tactics={t} cat={pick.cat} title={pick.title} allowNone={!!pick.allowNone} hideSecs={pick.hideSecs || []} onPick={pick.onPick} onClose={() => setPick(null)}/>}
    </div>
  );
};
// 開いていない行の案内(「5行目は Lv25 で開く」)
const CARD_FRAME_MAX_TEXT = (kind, n) => {
  const nx = CARD_LEVEL_FRAMES.find((x) => (kind === 'breeder' ? x.breeder : x.mon) > n);
  return nx ? `${(kind === 'breeder' ? nx.breeder : nx.mon)}枚目はランク${nx.at}で開く` : '';
};

// ==================== マーケットの「戦術カード」(2026-10-29 社長「戦術カードはマーケットで買えるようにして」) ====================
// 55 の MFバトルカードの売り場のタブ。1回300ビートPで8枚・5回まとめて1,350・引く券・かけらで1枚。開け方は 87 のパックと同じ(CardTacticPackOpen)
// onBuy(count, payWith) / onExchange(id) … 60-app の buyTacticsPacks / exchangeTacticsShard(ビートPと持ち物を1つの取引で書く)
const CardTacticsShop = ({ point = 0, busy = false, onBuy, onExchange }) => {
  const [t, setT] = useState(null);
  const [opening, setOpening] = useState(null);
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => { void cardTacticsLoad().then((d) => setT(d.tactics)); }, []);
  if (!t) return <p className="text-[13px] font-bold text-slate-300">読み込み中…</p>;
  const buy = async (count, payWith) => {
    if (busy || !onBuy) return;
    setMsg('');
    const r = await onBuy(count, payWith);
    if (r && r.ok) { setT(r.tactics); setOpening(r.packs); return; }
    setMsg(r && r.reason === 'tickets' ? 'カードパック券が足りません' : r && r.reason === 'points' ? 'ビートPが足りません' : '保存できませんでした。ビートPは変わっていません');
  };
  const exchange = async (id) => {
    setPicking(false);
    const r = onExchange ? await onExchange(id) : null;
    if (r && r.ok) { setT(r.tactics); setOpening([[{ id, r: (cardTacticOf(id) || {}).r || 'N', dup: false }]]); } else setMsg('かけらが足りません');
  };
  const owned = CARD_TACTIC_CARDS.filter((c) => cardTacticsOwns(t, c.id)).length;
  return (
    <div data-card-tactics-shop className="space-y-2 pb-2">
      <div className="rounded-2xl border-2 border-amber-500/60 bg-gradient-to-br from-orange-900 via-amber-800 to-indigo-950 p-3">
        <div className="flex items-center gap-3">
          <span className="text-[44px] leading-none">🧠</span>
          <span className="min-w-0 flex-1"><b className="block text-[17px] font-black text-white">戦術カードパック</b>
            <small className="block text-[11px] font-bold text-amber-100" style={JA_WRAP_STYLE}>1パック8枚。デッキ登録で、登録したデッキの戦い方に使います</small></span>
        </div>
        <div className="mt-2 text-[11px] font-bold leading-relaxed text-amber-50" style={JA_WRAP_STYLE}>
          N 70%・R 25%・SR 5%。SR が出ないまま7パック開けると、8パック目の最後の1枚は SR。だぶったカードは「かけら」になり、10個でまだ持っていないカードを1枚えらべます。
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 text-[12px] font-black text-amber-200"><span>{`持っている ${owned}/${CARD_TACTIC_CARDS.length}`}</span><span data-card-tactics-tickets>{`カードパック券 ${t.tickets}枚`}</span><span data-card-tactics-shards>{`かけら ${t.shards}個`}</span></div>
      </div>
      {msg && <p data-card-tactics-shop-msg className="rounded-xl bg-amber-500/15 p-2 text-[12px] font-bold text-amber-100">{msg}</p>}
      <button type="button" data-card-tactics-buy="1" disabled={busy || point < cardTacticsPrice(1)} onClick={() => { Audio_.fgSe.tap(); void buy(1, 'point'); }} className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black disabled:opacity-40">1パック 300ビートP</button>
      <button type="button" data-card-tactics-buy="5" disabled={busy || point < cardTacticsPrice(5)} onClick={() => { Audio_.fgSe.tap(); void buy(5, 'point'); }} className="mh-button min-h-[52px] w-full rounded-2xl font-black text-white disabled:opacity-40">5パック 1,350ビートP(150おトク)</button>
      <button type="button" data-card-tactics-ticket disabled={busy || t.tickets < 1} onClick={() => { Audio_.fgSe.tap(); void buy(1, 'ticket'); }} className="mh-button min-h-[48px] w-full rounded-2xl font-black text-white disabled:opacity-40">{`カードパック券で1パック(のこり${t.tickets}枚)`}</button>
      <button type="button" data-card-tactics-exchange disabled={t.shards < CARD_TACTICS_SHARD_COST} onClick={() => { Audio_.fgSe.tap(); setPicking(true); }} className="mh-button min-h-[48px] w-full rounded-2xl font-black text-white disabled:opacity-40">{`かけらで1枚えらぶ(${t.shards}/${CARD_TACTICS_SHARD_COST})`}</button>
      <p className="text-[11px] font-bold text-slate-400" style={JA_WRAP_STYLE}>カードパック券は、カードランクが5上がるごとにもらえます。バトルカードのパックにも使えます。</p>
      {picking && (
        <div data-card-tactic-picker="missing" className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 p-3">
          <ScreenHead title="かけら10個で1枚えらぶ" accent="text-amber-200" onBack={() => setPicking(false)}/>
          <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-1.5 overflow-y-auto pb-3">
            {CARD_TACTIC_CARDS.filter((c) => !cardTacticsOwns(t, c.id)).map((c) => <CardTacticFace key={c.id} card={c} small onClick={() => { Audio_.fgSe.tap(); void exchange(c.id); }}/>)}
          </div>
        </div>
      )}
      {opening && <div className="fixed inset-0 z-[85] flex flex-col bg-slate-950"><CardTacticPackOpen packs={opening} onDone={() => setOpening(null)}/></div>}
    </div>
  );
};

// ==================== カードランクの見せ方(2026-10-29 社長「バトルカードのレベル表記が地味」→「カードランク」) ====================
// 札・棒・ランクアップは 43 の共通の部品(ビートランクと同じ見た目)。ここはカードの中身(ごほうび・置ける所)を渡すだけ
// 「これからもらえる物」: 次のランクから、ビートP・カードパック券・戦術カードを置ける所が増えるランクを並べる
const cardRankUpcoming = (lv, n = 4) => {
  const out = [];
  for (let r = lv + 1; out.length < n && r <= lv + 50; r++) {
    const g = cardRankRewardOf(r);
    const frame = CARD_LEVEL_FRAMES.some((f) => f.at === r);
    if (g.tickets || frame || r === lv + 1) out.push({ rank: r, text: `${cardRankRewardText(r)}${frame ? '・戦術カードを置ける所が増える' : ''}` });
  }
  return out;
};
// トップなどに置く小さい札(押すと詳しい所)
const CardRankChip = ({ xp = 0, onOpen = null, showName = true, cls = '' }) => {
  const info = cardLevelInfo(xp);
  return (
    <button type="button" data-card-rank-chip={info.level} aria-label={`カードランク ${info.level}。くわしく見る`} onClick={() => { Audio_.fgSe.tap(); onOpen && onOpen(); }}
      className={`inline-flex shrink-0 items-center rounded-full border border-white/20 bg-slate-950/60 py-0.5 pl-1 pr-2.5 active:scale-95 ${cls}`}>
      <PlayerRankBadge kind="card" rank={info.level} size="sm" showName={showName}/>
    </button>
  );
};
// 札を押した先: 大きい札・棒・これからもらえる物・経験値のたまり方
const CardRankDetail = ({ xp = 0, onClose }) => {
  const info = cardLevelInfo(xp);
  const up = cardRankUpcoming(info.level);
  return (
    <div data-card-rank-detail role="dialog" aria-modal="true" aria-label="カードランク" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4" onClick={onClose}>
      <div className="w-full max-w-[340px] rounded-2xl border-2 border-amber-200/70 bg-gradient-to-b from-violet-950 to-slate-950 p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center"><PlayerRankBadge kind="card" rank={info.level} size="lg"/></div>
        <div className="mt-3"><PlayerRankGauge kind="card" info={{ rank: info.level, into: info.into, need: info.need }} note={`次のランクまで あと${(info.need - info.into).toLocaleString()}`}/></div>
        <b className="mt-3 block text-[13px] font-black text-amber-200">これからもらえる物</b>
        <ul data-card-rank-upcoming className="mt-1 space-y-1 rounded-xl bg-black/35 px-2.5 py-2 text-[12px] font-bold leading-snug">
          {up.map((u) => <li key={u.rank} style={JA_WRAP_STYLE}><b className="text-amber-100">{`ランク${u.rank}`}</b>{` … ${u.text}`}</li>)}
        </ul>
        <p className="mt-2 text-[11px] font-bold leading-relaxed text-slate-300" style={JA_WRAP_STYLE}>{jaWrap('フリー対戦・マルチ対戦で戦うと経験値がたまります。強い相手ほど多く、マルチがいちばん多くたまります。その日はじめての勝ちは +30。投了・練習試合ではたまりません。')}</p>
        <button type="button" data-card-rank-detail-close onClick={() => { Audio_.fgSe.tap(); onClose && onClose(); }} className="mh-button mt-3 min-h-[44px] w-full rounded-xl text-[14px] font-black">とじる</button>
      </div>
    </div>
  );
};
// 対戦の結果: 経験値の札と、ランクが上がったときの知らせ(帯が変わったら「シルバーになりました!」)
const CardRankResult = ({ gain }) => {
  const up = !!(gain && gain.to > gain.from);
  const [overlay, setOverlay] = useState(up);
  if (!gain || !(gain.add > 0)) return null;
  const award = { add: gain.add, parts: gain.parts || [], from: gain.from, to: gain.to, xp: gain.xp, gains: gain.gains || [] };
  const tier0 = playerRankTier(gain.from), tier1 = playerRankTier(gain.to);
  return (<>
    <PlayerRankGain kind="card" award={award} next={`ランク${gain.to + 1}で ${cardRankRewardText(gain.to + 1)}`}/>
    {up && overlay && (
      <div data-card-rank-up-overlay role="dialog" aria-modal="true" aria-label="ランクアップ" className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4" onClick={() => setOverlay(false)}>
        <div className="w-full max-w-[320px] rounded-2xl border-2 border-amber-200/80 bg-gradient-to-b from-violet-800 to-indigo-950 p-4 text-center text-white shadow-[0_0_30px_rgba(251,191,36,.45)]" onClick={(e) => e.stopPropagation()}>
          <b className="block text-[22px] font-black tracking-[.12em] text-white" style={{ WebkitTextStroke: '4px #1e1b4b', paintOrder: 'stroke fill' }}>RANK UP!</b>
          <small className="mt-1 block text-[12px] font-black text-slate-200">カードランク</small>
          <div className="mt-2 flex items-center justify-center gap-3">
            <span className="opacity-60"><PlayerRankBadge kind="card" rank={gain.from} size="sm" showName={false}/></span>
            <span aria-hidden="true" className="text-[22px] font-black text-amber-300">▶</span>
            <span className="origin-center scale-125"><PlayerRankBadge kind="card" rank={gain.to} size="lg" showName={false}/></span>
          </div>
          {tier1.t !== tier0.t && <p data-card-rank-up-tier className="mt-3 text-[14px] font-black text-amber-100">{`${tier1.name}になりました!`}</p>}
          {award.gains.length > 0 && <div className="mt-3 rounded-xl bg-black/35 px-3 py-2 text-left">
            <small className="block text-[11px] font-black text-slate-300">もらった物</small>
            <ul data-card-rank-up-gains className="mt-0.5 space-y-0.5 text-[13px] font-black">{award.gains.map((g, i) => <li key={i} style={JA_WRAP_STYLE}><span aria-hidden="true">{g.icon} </span>{g.text}</li>)}</ul>
          </div>}
          <button type="button" data-card-rank-up-ok onClick={() => { Audio_.fgSe.tap(); setOverlay(false); }} className="mh-button mh-button-primary mt-3 min-h-[44px] w-full rounded-xl text-[15px] font-black">OK</button>
        </div>
      </div>
    )}
  </>);
};
