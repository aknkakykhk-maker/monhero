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

// カードの全文(2026-10-30 社長「表に入りきらない時は、押すと全文」)。区分・見る場面・レア・名前・効果
const CARD_TACTIC_PHASE_TEXT = Object.freeze({ attack: '攻撃の番に見る', guard: '攻撃を受けたときに見る', guts: 'ガッツの番に見る' });
const CARD_TACTIC_CAT_TEXT = Object.freeze({ cond: '条件カード(〜なら)。行動カードと組にしてセットする', base: '基本カード。どの組にも当てはまらないときの打ち方', breeder: 'ブリーダーカード(ブリーダーの手)。条件カードと組にしてセットする', monster: 'モンスターカード(その子の手)。条件カードと組にしてセットする' });
const CardTacticDetail = ({ card, onClose }) => {
  if (!card) return null;
  const st = CARD_TACTIC_CAT_STYLE[card.cat] || CARD_TACTIC_CAT_STYLE.cond;
  return (
    <div data-card-tactic-detail={card.id} role="dialog" aria-modal="true" aria-label={card.name} onClick={onClose} className="fixed inset-0 z-[96] flex items-center justify-center bg-black/70 p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[340px] rounded-2xl border-2 border-white/70 p-4 text-white" style={{ background: st.bg }}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded px-1.5 text-[13px] font-black" style={{ background: CARD_TACTIC_RARE_COLOR[card.r] }}>{card.r}</span>
          <span className="rounded bg-black/35 px-1.5 text-[13px] font-black">{st.label}</span>
          {card.phase && <span className="rounded bg-black/25 px-1.5 text-[12px] font-bold">{CARD_TACTIC_PHASE_TEXT[card.phase]}</span>}
        </div>
        <b className="mt-2 block text-[21px] font-black leading-tight" style={JA_WRAP_STYLE}>{card.name}</b>
        <p className="mt-2 text-[15px] font-bold leading-relaxed" style={JA_WRAP_STYLE}>{jaWrap(card.desc)}</p>
        <p className="mt-2 text-[11px] font-bold text-white/80" style={JA_WRAP_STYLE}>{jaWrap(CARD_TACTIC_CAT_TEXT[card.cat] || '')}</p>
        <button type="button" data-card-tactic-detail-close onClick={() => { Audio_.fgSe.tap(); onClose && onClose(); }} className="mh-button mt-3 min-h-[44px] w-full rounded-xl bg-black/40 text-[14px] font-black">とじる</button>
      </div>
    </div>
  );
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
        <span data-card-tactic-cat={card.cat} className="whitespace-nowrap rounded bg-black/30 px-1 text-[10px] font-black text-white">{st.label}</span>
        {count > 1 && <span className="ml-auto text-[10px] font-black text-amber-200">×{count}</span>}
        {mark && <span className="ml-auto rounded bg-emerald-500 px-1 text-[10px] font-black text-white">{mark}</span>}
      </span>
      <b className={`mt-1 block font-black leading-tight text-white ${small ? 'text-[12.5px]' : 'text-[14px]'}`} style={JA_WRAP_STYLE}>{card.name}</b>
      {/* 小さい札は効果を3行まで(全文は押した先の CardTacticDetail) */}
      <small className={`mt-0.5 block font-bold leading-snug text-white/90 ${small ? 'line-clamp-3 text-[10px]' : 'text-[11.5px]'}`} style={JA_WRAP_STYLE}>{card.desc}</small>
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

// ---- 戦術カードパックの箱絵(2026-10-30 社長「安っぽい・手抜き」→ ブースターパック(87 の CardPackArt)と同じ作り・同じ大きさ) ----
// 絵は今ある物の組み合わせ: バトルカードの裏面を3枚、扇に広げて真ん中に置く。題は「戦術」、下の帯は「戦術カードパック」
const CARD_TACTIC_PACK_COLOR = '#0f766e';
const CardTacticPackArt = ({ width = 200, torn = false, className = '' }) => {
  const h = Math.round(width * 1.48);
  return (
    <div data-card-tactic-pack-art className={`relative overflow-hidden rounded-[14px] border-[3px] border-white/85 shadow-2xl ${className}`} style={{ width, height: h, background: `linear-gradient(165deg, ${CARD_TACTIC_PACK_COLOR} 0%, #7c3aed 42%, #0b1020 100%)` }}>
      <div aria-hidden="true" className="absolute inset-0 opacity-35" style={{ background: 'repeating-conic-gradient(from 0deg at 50% 62%, rgba(255,255,255,.55) 0 6deg, transparent 6deg 18deg)' }}/>
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,.28) 45%, transparent 60%)' }}/>
      {!torn && <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[7%]" style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.9) 0 6px, rgba(255,255,255,.45) 6px 12px)' }}/>}
      {[[-16, '-30%', 1], [16, '30%', 1], [0, '0%', 2]].map(([deg, dx, z], k) => (
        <img key={k} src={CARD_BACK_IMG()} alt="" aria-hidden="true" draggable={false} className="absolute rounded-[6%] border-2 border-white/80 object-cover drop-shadow-[0_6px_8px_rgba(0,0,0,.6)]"
          style={{ width: '46%', aspectRatio: '5 / 7', left: '50%', bottom: '13%', zIndex: z, transform: `translateX(calc(-50% + ${dx})) rotate(${deg}deg)`, transformOrigin: '50% 100%' }}/>
      ))}
      <div className="absolute inset-x-0 top-[9%] z-[5] text-center">
        <div className="font-black leading-none text-white" style={{ fontSize: Math.round(width * 0.2), WebkitTextStroke: `${Math.max(2, Math.round(width / 50))}px #111`, paintOrder: 'stroke fill', textShadow: '0 4px 0 rgba(0,0,0,.45)' }}>戦術</div>
        <div className="mt-1 font-black tracking-wider text-white/90" style={{ fontSize: Math.round(width * 0.075), textShadow: '0 2px 2px rgba(0,0,0,.7)' }}>MFバトルカード</div>
      </div>
      <div className="absolute inset-x-[12%] bottom-[3%] z-[6] rounded-full bg-black/55 py-0.5 text-center font-black text-white" style={{ fontSize: Math.round(width * 0.07) }}>戦術カードパック</div>
    </div>
  );
};
// めくった表(縦長 5:7。バトルカードと同じ比)。種類の色・レア度・名前・効果
const CardTacticFront = ({ card, big = false }) => {
  const st = CARD_TACTIC_CAT_STYLE[card.cat] || CARD_TACTIC_CAT_STYLE.cond;
  return (
    <div className="flex h-full w-full flex-col rounded-[5px] border-2 border-white/70 p-[6%] text-left" style={{ background: st.bg, containerType: 'inline-size' }}>
      <span className="flex items-center gap-1">
        <span className="rounded px-1 font-black text-white" style={{ background: CARD_TACTIC_RARE_COLOR[card.r], fontSize: big ? 14 : 'max(9px, 9cqw)' }}>{card.r}</span>
        <span className="truncate font-bold text-white/80" style={{ fontSize: big ? 13 : 'max(8px, 8cqw)' }}>{st.label}</span>
      </span>
      <b className="mt-[6%] block font-black leading-tight text-white" style={{ fontSize: big ? 22 : 'max(11px, 13cqw)', ...JA_WRAP_STYLE }}>{card.name}</b>
      <small className="mt-auto block font-bold leading-snug text-white/90" style={{ fontSize: big ? 14 : 'max(8px, 9cqw)', ...JA_WRAP_STYLE }}>{card.desc}</small>
    </div>
  );
};
// ---- パックと同じ開け方(87 の CardPackOpen と同じ画面の作り・並び・動き。破る → 光の柱 → 白く光る → 配る → 1枚ずつめくる → 全部めくる)
//   SR はめくる前から裏が光って揺れ、めくると真ん中へ大きく出る(キラと同じ)。全画面に重ねて出すので、上下の安全な余白を取る
const CARD_TACTIC_TEAR_MS = 1150;
const CARD_TACTIC_SPOT_MS = 1500;
const CARD_TACTIC_SPOT_BACK_MS = 320;
const CardTacticPackOpen = ({ packs, onDone }) => {
  const [pi, setPi] = useState(0);
  const [phase, setPhase] = useState('closed');
  const [flipped, setFlipped] = useState([]);
  const [spot, setSpot] = useState(null);
  const [flash, setFlash] = useState(0);
  const [detail, setDetail] = useState(null); // めくったカードを押すと全文
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const listRef = useRef(null);
  const [listH, setListH] = useState(0);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    const on = () => setListH(el.clientHeight);
    on();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(on) : null;
    if (ro) ro.observe(el);
    window.addEventListener('resize', on);
    return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', on); };
  }, []);
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
    if (cards[i] && cards[i].r === 'SR') { later(() => { setFlash((n) => n + 1); setSpot({ i, leaving: false }); se('crit'); se('fusion'); }, 380); later(spotOff, 380 + CARD_TACTIC_SPOT_MS); }
  };
  const flip = (i) => { if (flipped.includes(i) || phase !== 'open' || spot) return; reveal(i); };
  const flipAll = () => {
    if (spot) return;
    let at = 0;
    cards.map((_, i) => i).filter((i) => !flipped.includes(i)).forEach((i) => { later(() => reveal(i), at); at += cards[i].r === 'SR' ? 380 + CARD_TACTIC_SPOT_MS + CARD_TACTIC_SPOT_BACK_MS + 120 : 140; });
  };
  const next = () => { Audio_.fgSe.tap(); timers.current.forEach(clearTimeout); timers.current = []; setPi((x) => x + 1); setPhase('closed'); setFlipped([]); setSpot(null); };
  // 並べ方はブースターパックと同じ: 背の高い画面は3列(カードを大きく)、低い画面は4列。カードの大きさは並べる所の高さに合わせる
  const cols = !(typeof window !== 'undefined' && window.innerHeight >= 760) ? 4 : 3;
  const rows = Math.ceil(cards.length / cols);
  const gridMaxW = listH > 0 ? Math.max(200, Math.floor((((listH - 52) / rows - 24) * 5) / 7 * cols + 8 * (cols - 1) + 8)) : null;
  const spotW = `min(62vw, 260px, ${Math.max(140, Math.floor((((typeof window !== 'undefined' ? window.innerHeight : 844) - 120) * 5) / 7))}px)`;
  const spotCard = spot ? cardTacticOf(cards[spot.i].id) : null;
  const shards = cards.filter((c) => c.dup).length;
  return (
    <div data-mh-screen data-card-tactic-open data-card-tactic-open-phase={phase} className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="戦術カードパック" accent="text-amber-200" note={packs.length > 1 ? `${pi + 1} / ${packs.length}パック` : ''}/>
      <div ref={listRef} className={`${SCREEN_LIST_CLASS} relative flex flex-col items-center justify-center overflow-hidden pb-2`}>
        {phase !== 'open' ? (
          <button type="button" data-card-tactic-pack onClick={tear} className={`relative ${phase === 'closed' ? 'mh-pack-idle' : 'mh-pack-shake'}`} aria-label="パックを開ける">
            <div className={phase === 'tearing' ? 'mh-pack-drop' : ''}><CardTacticPackArt width={210} torn={phase === 'tearing'}/></div>
            {phase === 'tearing' && <div aria-hidden="true" className="mh-pack-strip absolute inset-x-0 top-0 h-[7%] rounded-t-[14px]" style={{ background: 'repeating-linear-gradient(90deg, rgba(255,255,255,.95) 0 6px, rgba(255,255,255,.5) 6px 12px)' }}/>}
            {phase === 'tearing' && <div aria-hidden="true" className="mh-pack-pillar"/>}
            {phase === 'tearing' && <div aria-hidden="true" className="mh-pack-burst"/>}
            {phase === 'closed' && <span className="absolute inset-x-0 -bottom-9 animate-pulse text-center text-[14px] font-black text-white">タップで開ける</span>}
          </button>
        ) : (
          <div data-card-tactic-open-grid className={`grid w-full gap-2 ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'} px-1`} style={gridMaxW ? { maxWidth: gridMaxW } : undefined}>
            {cards.map((c, i) => {
              const card = cardTacticOf(c.id);
              const on = flipped.includes(i);
              const sr = c.r === 'SR';
              return (
                <div key={`${pi}-${i}`} className="mh-pack-deal flex flex-col items-center" style={{ animationDelay: `${i * 70}ms` }}>
                  <button type="button" data-card-tactic-open-card={i} data-card-tactic-open-flipped={on ? '1' : '0'} onClick={() => (on ? setDetail(card) : flip(i))} className="mh-pack-card relative w-full active:scale-95">
                    <div className={`mh-pack-card-in aspect-[5/7] w-full ${on ? 'flipped' : ''}`}>
                      <div data-card-tactic-back className={`mh-pack-face flex items-center justify-center overflow-hidden rounded-[5px] ${sr && !on ? 'mh-pack-kira-back' : ''}`}>
                        <img src={CARD_BACK_IMG()} alt="" draggable={false} className="absolute inset-0 h-full w-full rounded-[5px] object-cover"/>
                      </div>
                      <div className={`mh-pack-face mh-pack-front ${sr ? 'mh-pack-kira-front' : ''}`}>{card && <CardTacticFront card={card}/>}</div>
                    </div>
                    {on && sr && <div aria-hidden="true" className="mh-pack-rays"/>}
                    {on && (
                      <span className="absolute inset-x-0.5 top-0.5 z-[2] flex flex-wrap items-start justify-end gap-0.5">
                        {c.dup ? <span className="rounded-md bg-slate-950/90 px-1 text-[9px] font-black text-amber-200">かけら+1</span> : <span className="rounded-md bg-emerald-400 px-1 text-[9px] font-black text-slate-950">NEW</span>}
                      </span>
                    )}
                  </button>
                  <CardNameFit name={on && card ? card.name : ' '} className="mt-0.5 font-bold leading-tight text-slate-100"/>
                </div>
              );
            })}
          </div>
        )}
        {phase === 'open' && allOpen && (
          <div data-card-tactic-open-summary className="mt-3 text-center text-[12px] font-bold text-slate-300">
            {shards > 0 ? <>持っていたカードは <b className="text-amber-200">かけら +{shards}</b> になりました(10個でまだ持っていないカードを1枚えらべます)</> : 'ぜんぶ新しいカードです'}
          </div>
        )}
      </div>
      {detail && <CardTacticDetail card={detail} onClose={() => setDetail(null)}/>}
      {phase === 'tearing' && <div aria-hidden="true" className="mh-pack-whiteout"/>}
      {flash > 0 && spot && <div key={flash} aria-hidden="true" className="mh-pack-flash"/>}
      {spotCard && (
        <button type="button" data-card-tactic-spot aria-label="並びへ戻す" onClick={spotOff} className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-slate-950/70">
          <div aria-hidden="true" className="mh-pack-spot-rays"/>
          <div className={`relative ${spot.leaving ? 'mh-pack-spot-out' : 'mh-pack-spot-in'}`} style={{ width: spotW }}>
            <div className="mh-pack-kira-front relative aspect-[5/7] w-full"><CardTacticFront card={spotCard} big/></div>
          </div>
          <span className={`relative mt-4 rounded-full bg-amber-300 px-4 py-1 text-[18px] font-black text-slate-950 ${spot.leaving ? 'opacity-0' : ''}`}>SR!</span>
        </button>
      )}
      <div className={SCREEN_FOOTER_CLASS}>
        {phase !== 'open' ? <div className="text-center text-[12px] font-bold text-slate-400">パックをタップしてください</div>
          : !allOpen ? <button type="button" data-card-tactic-open-all className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black active:scale-[.98]" onClick={flipAll}>全部めくる</button>
          : !last ? <button type="button" data-card-tactic-open-next className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black active:scale-[.98]" onClick={next}>つぎのパック</button>
          : <button type="button" data-card-tactic-open-done className="mh-button mh-button-primary min-h-[52px] w-full rounded-2xl font-black active:scale-[.98]" onClick={() => { Audio_.fgSe.tap(); onDone(); }}>とじる</button>}
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
  const [detailCard, setDetailCard] = useState(null); // 押したカードの全文
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
        {detailCard && <CardTacticDetail card={detailCard} onClose={() => setDetailCard(null)}/>}
        {tab === 'list' && (
          <div data-card-tactics-list className="space-y-2">
            {['base', 'breeder', 'monster', 'cond'].map((cat) => (
              <div key={cat}>
                <p className="mb-1 text-[12px] font-black text-amber-200">{`${CARD_TACTIC_CAT_STYLE[cat].label}カード ${CARD_TACTIC_CARDS.filter((c) => c.cat === cat && cardTacticsOwns(t, c.id)).length}/${CARD_TACTIC_CARDS.filter((c) => c.cat === cat).length}`}</p>
                <div className="grid grid-cols-3 gap-1.5">{CARD_TACTIC_CARDS.filter((c) => c.cat === cat).map((c) => <CardTacticFace key={c.id} card={c} small owned={cardTacticsOwns(t, c.id)} count={t.own[c.id] || 0} onClick={() => { Audio_.fgSe.tap(); setDetailCard(c); }}/>)}</div>
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
// 2026-10-30 社長「安っぽさも尋常じゃない。手抜きすぎる」→ ブースターパック(87 の CardShopPacks)とまったく同じカード型にそろえた:
//   箱絵・名前・中身の1行・「中身を見る」「提供割合」・横並びの2つの買うボタン。説明の長文は「提供割合」の中へ。
//   カードパック券・かけらは大きいボタンを並べず、上の帯(ブースターパックのガチャPの帯と同じ形)に、使えるときだけ目立たせて出す
// onBuy(count, payWith) / onExchange(id) … 60-app の buyTacticsPacks / exchangeTacticsShard(ビートPと持ち物を1つの取引で書く)
const CARD_TACTICS_SHOP_EVENT = 'mh-card-tactics-shop';
const cardTacticsShopChanged = () => { try { window.dispatchEvent(new Event(CARD_TACTICS_SHOP_EVENT)); } catch (_) { /* 帯の読み直しだけ */ } };
const useCardTacticsSave = () => {
  const [t, setT] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => { void cardTacticsLoad().then((d) => { if (alive) setT(d.tactics); }).catch(() => {}); };
    load();
    window.addEventListener(CARD_TACTICS_SHOP_EVENT, load);
    return () => { alive = false; window.removeEventListener(CARD_TACTICS_SHOP_EVENT, load); };
  }, []);
  return t;
};
// 上の帯(タブのすぐ下・一覧の外)。上の段に所持ビートP、下の段にカードパック券とかけら。持っている・使えるときだけ明るく「使う」「えらぶ」が出る
const CardTacticsBand = ({ point = 0, busy = false, onBuy, onExchange }) => {
  const t = useCardTacticsSave();
  const [confirm, setConfirm] = useState(false);
  const [picking, setPicking] = useState(false);
  const [opening, setOpening] = useState(null);
  const [msg, setMsg] = useState('');
  const tickets = t ? t.tickets : 0, shards = t ? t.shards : 0;
  const canPick = shards >= CARD_TACTICS_SHARD_COST;
  const useTicket = async () => {
    setConfirm(false); setMsg('');
    const r = onBuy ? await onBuy(1, 'ticket') : null;
    if (r && r.ok) { cardTacticsShopChanged(); setOpening(r.packs); } else setMsg('カードパック券が足りません');
  };
  const exchange = async (id) => {
    setPicking(false);
    const r = onExchange ? await onExchange(id) : null;
    if (r && r.ok) { cardTacticsShopChanged(); setOpening([[{ id, r: (cardTacticOf(id) || {}).r || 'N', dup: false }]]); } else setMsg('かけらが足りません');
  };
  return (
    <>
      <div data-card-tactics-band className="mb-2 shrink-0 rounded-2xl border-2 border-teal-300/70 px-2.5 py-1.5 text-white" style={{ background: 'linear-gradient(135deg,#134e4aee,#1e1b4bee)' }}>
        <div className="flex items-baseline gap-1 border-b border-white/15 pb-1 text-[12px] font-black text-violet-200">
          <span className="whitespace-nowrap">🎟️ 所持ビートP</span>
          <span data-card-tactics-point className="ml-auto font-mono text-[16px] text-white">{Math.max(0, Math.floor(Number(point) || 0)).toLocaleString()}</span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          <div data-card-tactics-tickets={tickets} className={`flex min-h-[36px] items-center gap-1 rounded-xl px-2 ${tickets > 0 ? 'bg-amber-400/20 ring-1 ring-amber-300' : 'bg-white/5'}`}>
            <span className={`min-w-0 flex-1 text-[11px] font-black leading-tight ${tickets > 0 ? 'text-amber-100' : 'text-slate-400'}`}>カードパック券<b className="ml-1 text-[14px] text-white">×{tickets}</b></span>
            {tickets > 0 && <button type="button" data-card-tactics-ticket disabled={busy} onClick={() => { Audio_.fgSe.tap(); setConfirm(true); }} className="mh-button min-h-[30px] shrink-0 rounded-lg bg-amber-400 px-2 text-[11px] font-black text-stone-900 active:scale-95 disabled:opacity-40">使う</button>}
          </div>
          <div data-card-tactics-shards={shards} className={`flex min-h-[36px] items-center gap-1 rounded-xl px-2 ${canPick ? 'bg-sky-400/20 ring-1 ring-sky-300' : 'bg-white/5'}`}>
            <span className={`min-w-0 flex-1 text-[11px] font-black leading-tight ${canPick ? 'text-sky-100' : 'text-slate-400'}`}>かけら<b className="ml-1 text-[14px] text-white tabular-nums">{shards}/{CARD_TACTICS_SHARD_COST}</b></span>
            {canPick && <button type="button" data-card-tactics-exchange disabled={busy} onClick={() => { Audio_.fgSe.tap(); setPicking(true); }} className="mh-button min-h-[30px] shrink-0 rounded-lg bg-sky-400 px-2 text-[11px] font-black text-slate-950 active:scale-95 disabled:opacity-40">えらぶ</button>}
          </div>
        </div>
        {msg && <p data-card-tactics-shop-msg className="mt-1 text-[11px] font-bold text-amber-100">{msg}</p>}
      </div>
      {confirm && <ConfirmSheet title="戦術カードパックを1パック開けますか？" message={`カードパック券を1枚使います(いま ${tickets}枚)`} confirmLabel="券で開ける" onCancel={() => setConfirm(false)} onConfirm={() => { void useTicket(); }}/>}
      {picking && t && (
        <div data-card-tactic-picker="missing" className="fixed inset-0 z-[85] flex flex-col bg-slate-950/95 p-3" style={{ paddingTop: 'max(.75rem, env(safe-area-inset-top))', paddingBottom: 'max(.75rem, env(safe-area-inset-bottom))' }}>
          <ScreenHead title="かけら10個で1枚えらぶ" accent="text-amber-200" onBack={() => setPicking(false)}/>
          <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-1.5 overflow-y-auto pb-3">
            {CARD_TACTIC_CARDS.filter((c) => !cardTacticsOwns(t, c.id)).map((c) => <CardTacticFace key={c.id} card={c} small onClick={() => { Audio_.fgSe.tap(); void exchange(c.id); }}/>)}
          </div>
        </div>
      )}
      {opening && <CardTacticPackOverlay packs={opening} onDone={() => setOpening(null)}/>}
    </>
  );
};
// 開ける画面は全画面に重ねる。スマホの上の時計・下のバーに重ならないよう、安全な余白を取る(2026-10-30 社長「題が時計に重なる」)
const CardTacticPackOverlay = ({ packs, onDone }) => (
  <div data-card-tactic-open-overlay className="fixed inset-0 z-[85] flex flex-col bg-slate-950" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
    <CardTacticPackOpen packs={packs} onDone={onDone}/>
  </div>
);
// 中身を見る: 全部の戦術カード(持っていない物に「未取得」)
const CardTacticPackContents = ({ t, onClose }) => {
  const [detail, setDetail] = useState(null);
  return (<>
  <CardShopSheet title="戦術カードパックの中身" onClose={onClose} tag="tactics-contents">
    <p className="mb-1 text-[11px] font-bold text-slate-300" style={JA_WRAP_STYLE}>{jaWrap(`全${CARD_TACTIC_CARDS.length}枚(はじめに持っている${CARD_TACTIC_START.length}枚は出ません)`)}</p>
    {['SR', 'R', 'N'].map((r) => (
      <div key={r}>
        <CardShopHead>{`${r}(${CARD_TACTIC_CARDS.filter((c) => c.r === r && !c.start).length}枚)`}</CardShopHead>
        <div className="grid grid-cols-3 gap-1.5">{CARD_TACTIC_CARDS.filter((c) => c.r === r && !c.start).map((c) => (
          <div key={c.id} className="relative"><CardTacticFace card={c} small owned={cardTacticsOwns(t, c.id)} onClick={() => { Audio_.fgSe.tap(); setDetail(c); }}/>
            {!cardTacticsOwns(t, c.id) && <span className="absolute right-0.5 top-0.5 rounded-md bg-rose-600 px-1 text-[9px] font-black text-white">未取得</span>}</div>
        ))}</div>
      </div>
    ))}
  </CardShopSheet>
  {detail && <CardTacticDetail card={detail} onClose={() => setDetail(null)}/>}
  </>);
};
// 提供割合(前は売り場に書いていた説明の長文はここ)
const CardTacticPackRates = ({ onClose }) => (
  <CardShopSheet title="戦術カードパックの提供割合" onClose={onClose} tag="tactics-rates">
    <div className="space-y-2 text-[12px] font-bold text-slate-200" style={JA_WRAP_STYLE}>
      <table className="w-full text-left"><tbody>
        {CARD_TACTICS_RATE.map(([r, p]) => { const n = cardTacticsPool(r).length; return (
          <tr key={r} className="border-b border-white/10"><td className="py-1 font-black" style={{ color: CARD_TACTIC_RARE_COLOR[r] === '#64748b' ? '#cbd5e1' : CARD_TACTIC_RARE_COLOR[r] }}>{r}</td><td className="py-1 text-right">{`${Math.round(p * 100)}%`}</td><td className="py-1 text-right text-slate-400">{`${n}種類・1枚あたり ${((p / n) * 100).toFixed(3)}%`}</td></tr>
        ); })}
      </tbody></table>
      <p>{jaWrap(`1パック${CARD_TACTICS_PULL.n}枚。1枚ずつ、上の割合で出ます。`)}</p>
      <p>{jaWrap(`SR が出ないまま${CARD_TACTICS_PULL.pityAt}パック開けると、${CARD_TACTICS_PULL.pityAt + 1}パック目の最後の1枚は SR です。`)}</p>
      <p>{jaWrap(`もう持っているカードが出たときは「かけら」1個になります。かけら${CARD_TACTICS_SHARD_COST}個で、まだ持っていないカードを1枚えらべます。`)}</p>
      <p>{jaWrap('カードパック券(カードランクのごほうび)1枚でも、1パック開けられます。')}</p>
    </div>
  </CardShopSheet>
);
// 売り場の一覧の中身(ブースターパックの1弾と同じカード型)
const CardTacticsShop = ({ point = 0, busy = false, onBuy }) => {
  const t = useCardTacticsSave();
  const [sheet, setSheet] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [opening, setOpening] = useState(null);
  const [msg, setMsg] = useState('');
  if (!t) return <p className="text-[13px] font-bold text-slate-300">読み込み中…</p>;
  const P = CARD_TACTICS_PULL;
  const owned = CARD_TACTIC_CARDS.filter((c) => cardTacticsOwns(t, c.id)).length;
  const buy = async (count) => {
    if (busy || !onBuy) return;
    setMsg('');
    const r = await onBuy(count, 'point');
    if (r && r.ok) { cardTacticsShopChanged(); setOpening(r.packs); return; }
    setMsg(r && r.reason === 'points' ? 'ビートPが足りません' : '保存できませんでした。ビートPは変わっていません');
  };
  return (
    <div data-card-tactics-shop className="space-y-2 pb-2">
      <div data-card-shop-pack="tactics" className={SCREEN_PANEL_CLASS} style={{ borderColor: `${CARD_TACTIC_PACK_COLOR}cc` }}>
        <div className="flex items-center gap-2">
          <CardTacticPackArt width={58} className="shrink-0 !rounded-[8px] !border-2"/>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-black text-white">戦術カードパック</div>
            <div className="text-[11px] font-black text-amber-100">{`登録したデッキの戦い方に使う・持っている ${owned}/${CARD_TACTIC_CARDS.length}`}</div>
            <div className="text-[11px] font-bold text-slate-300">{`${P.n}枚入り(N・R・SR)`}</div>
            <div className="mt-1 flex gap-1.5">
              <button type="button" data-card-tactics-contents onClick={() => setSheet('contents')} className="min-h-[30px] rounded-lg border border-sky-300/60 bg-sky-900/50 px-2 text-[11px] font-black text-sky-100 active:scale-95">中身を見る</button>
              <button type="button" data-card-tactics-rates onClick={() => setSheet('rates')} className="min-h-[30px] rounded-lg border border-amber-300/60 bg-amber-900/40 px-2 text-[11px] font-black text-amber-100 active:scale-95">提供割合</button>
            </div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button type="button" data-card-tactics-buy="1" disabled={busy || point < cardTacticsPrice(1)} onClick={() => setConfirm(1)} className="mh-button min-h-[44px] rounded-xl bg-orange-500 text-[13px] font-black text-white active:scale-[.98] disabled:opacity-40">{`1パック ${P.price.toLocaleString()}`}</button>
          <button type="button" data-card-tactics-buy={P.bundle.n} disabled={busy || point < cardTacticsPrice(P.bundle.n)} onClick={() => setConfirm(P.bundle.n)} className="mh-button min-h-[44px] rounded-xl bg-orange-600 text-[13px] font-black text-white active:scale-[.98] disabled:opacity-40">{`${P.bundle.n}パック ${P.bundle.price.toLocaleString()}`}<span className="block text-[9px] font-bold">{`(${(P.price * P.bundle.n - P.bundle.price).toLocaleString()}おトク)`}</span></button>
        </div>
      </div>
      {msg && <p data-card-tactics-shop-msg className="rounded-xl bg-amber-500/15 p-2 text-[12px] font-bold text-amber-100">{msg}</p>}
      {sheet === 'contents' && <CardTacticPackContents t={t} onClose={() => setSheet(null)}/>}
      {sheet === 'rates' && <CardTacticPackRates onClose={() => setSheet(null)}/>}
      {confirm && <ConfirmSheet title={`戦術カードパックを${confirm}パック買いますか？`} message={`ビートP ${cardTacticsPrice(confirm).toLocaleString()} を使います(いま ${point.toLocaleString()})`} confirmLabel="買って開ける" onCancel={() => setConfirm(null)} onConfirm={() => { const n = confirm; setConfirm(null); void buy(n); }}/>}
      {opening && <CardTacticPackOverlay packs={opening} onDone={() => setOpening(null)}/>}
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
// 対戦の結果: 経験値の札と、ランクが上がったときの演出(43 の PlayerRankUpFx。ビートランクと同じ。帯が変わると自動で豪華になる)。
//   一度に何ランク上がっても、上がった先のランクで1回だけ出し、もらった物をまとめて渡す。5ランクごとのおまけは bonus(桃色の光)
const cardRankFxGains = (gain) => {
  let bonusPoint = 0;
  for (let r = gain.from + 1; r <= gain.to; r++) if (r % 5 === 0) bonusPoint += r * 200;
  bonusPoint = Math.min(bonusPoint, gain.points || 0);
  const basePoint = Math.max(0, (gain.points || 0) - bonusPoint);
  const frames = CARD_LEVEL_FRAMES.filter((f) => f.at > gain.from && f.at <= gain.to).length;
  return [
    ...(basePoint ? [{ icon: '💰', text: `ビートP ${basePoint.toLocaleString()}` }] : []),
    ...(bonusPoint ? [{ icon: '💰', text: `ビートP ${bonusPoint.toLocaleString()}`, note: '5ランクごとのおまけ', bonus: true }] : []),
    ...(gain.tickets ? [{ icon: '🎟️', text: `カードパック券 ${gain.tickets}枚`, note: '5ランクごとのおまけ', bonus: true }] : []),
    ...(frames ? [{ icon: '🧠', text: '戦術カードを置ける所が増えた' }] : []),
  ];
};
const CardRankResult = ({ gain }) => {
  const up = !!(gain && gain.to > gain.from);
  const [fx, setFx] = useState(up);
  if (!gain || !(gain.add > 0)) return null;
  const award = { add: gain.add, parts: gain.parts || [], from: gain.from, to: gain.to, xp: gain.xp, gains: gain.gains || [] };
  return (<>
    <PlayerRankGain kind="card" award={award} next={`ランク${gain.to + 1}で ${cardRankRewardText(gain.to + 1)}`}/>
    {up && fx && typeof PlayerRankUpFx === 'function' && <PlayerRankUpFx kind="card" from={gain.from} to={gain.to} gains={cardRankFxGains(gain)} onClose={() => setFx(false)}/>}
  </>);
};
