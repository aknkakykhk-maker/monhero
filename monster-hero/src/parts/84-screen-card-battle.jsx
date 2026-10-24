// ==================== 画面: MFバトルカード ====================
// 紙の『モンスターファームバトルカード』を元にしたカードバトル。設計: docs/spec/CARD_BATTLE.md
// ルールの本体とコンピューターの考え方は 82-card-battle-core.jsx、助手のひとことは 83-card-battle-lines.jsx。
// この部品は画面と保存だけを持つ(ルールの計算はしない)。
//
// 画面(gameState。カードバトルの画面は全部 CARD_ で始める。5-3「裏でクイック∞周回」の決まり)
//   CARD_TOP    … トップ。はじめての人はスターター選び、コンピューター戦の相手えらび、結果もここ
//   CARD_BATTLE … 対戦
// ★いまはデバッグ設定からだけ入れる(HOME の入口は公開の区切りで足す。社長)
// ★保存は新しいキー mh_card_*(CARD_SAVE_KEYS)だけ。既存の mh_* には一切さわらない
// カードの絵(道具 tools/card/card-image-build.js が © を消して縮めたもの)。s=240×336(手札・場)/ l=480×672(詳しい画面)。フォルダごと使う
const CARD_IMAGE_SET = Object.freeze({ imageDir: 'images/card-battle' });
const CARD_IMG = (img, size = 's') => `${CARD_IMAGE_SET.imageDir}/${size}/${img}.jpg`;
const CARD_KIND_LABEL = Object.freeze({ pow: 'ちから', int: 'かしこさ', spe: '特殊', dge: '回避', blk: '防御' });
const CARD_TYPE_LABEL = Object.freeze({ ground: '地上', air: '空中', water: '水中' });
const CARD_LEVEL_LABEL = Object.freeze({ easy: 'EASY', normal: 'NORMAL', hard: 'HARD', expert: 'EXPERT', master: 'MASTER' });
// 相手の助手ごとの対戦の既定の曲(社長 台帳 #3438)。対人戦は ichika_battle(対人戦の区切りで使う)
// ききは綺季一閃のフル版(eiki_boss)。きゅうこの Toward the Stars はゲームに short 版しかないので、それを使う
const CARD_AI_BGM = Object.freeze({
  mua: 'melo_toriko', kiki: 'eiki_boss', momosuke: 'melo_crossing_field',
  kyuko: 'melo_toward_the_stars_short', dra: 'melo_mou_hitotsu_no_sekai_e', atsu: 'melo_against_my_own_shadow',
});
const CARD_PVP_BGM = 'ichika_battle';
// モンスターの絵(5-3)。モンヒロにいる種族はいまのゲームの絵、いない16種族は社長から届いた立ち絵(#3437 でクラフトくんが取り込んだ)。
// 混血の15体は、立ち絵が届いた子から立ち絵にする(HYBRID_MONSTER_IMGS)。まだの子はカードの絵で代える(社長)
const CARD_SPECIES_ART = Object.freeze({ tiger: 'Tiger', golem: 'Golem', suezo: 'Suezo', pixie: 'Pixie', hare: 'Ham', mocchi: 'Mocchi', monol: 'Monol', plant: 'Plant' });
const cardNewSpeciesArt = () => ({
  dino: typeof MF_DINO_IMG !== 'undefined' ? MF_DINO_IMG : null,
  gali: typeof MF_GALI_IMG !== 'undefined' ? MF_GALI_IMG : null,
  naga: typeof MF_NAGA_IMG !== 'undefined' ? MF_NAGA_IMG : null,
  dragon: typeof MF_DRAGON_IMG !== 'undefined' ? MF_DRAGON_IMG : null,
  henger: typeof MF_HENGER_IMG !== 'undefined' ? MF_HENGER_IMG : null,
  durahan: typeof MF_DURAHAN_IMG !== 'undefined' ? MF_DURAHAN_IMG : null,
  arrowhead: typeof MF_ARROWHEAD_IMG !== 'undefined' ? MF_ARROWHEAD_IMG : null,
  zilla: typeof MF_ZILLA_IMG !== 'undefined' ? MF_ZILLA_IMG : null,       // グジラは地上も水中も同じ立ち絵(社長)
  phoenix: typeof MF_PHOENIX_IMG !== 'undefined' ? MF_PHOENIX_IMG : null,
  joker: typeof MF_JOKER_IMG !== 'undefined' ? MF_JOKER_IMG : null,
  jell: typeof MF_JELL_IMG !== 'undefined' ? MF_JELL_IMG : null,
  mew: typeof MF_MEW_IMG !== 'undefined' ? MF_MEW_IMG : null,
  metalner: typeof MF_METALNER_IMG !== 'undefined' ? MF_METALNER_IMG : null,
  worm: typeof MF_WORM_IMG !== 'undefined' ? MF_WORM_IMG : null,
  centaur: typeof MF_CENTAUR_IMG !== 'undefined' ? MF_CENTAUR_IMG : null,
  colorpandora: typeof MF_COLORPANDORA_IMG !== 'undefined' ? MF_COLORPANDORA_IMG : null,
});
const cardMonArt = (mon) => {
  // 混血は、立ち絵が届いた子だけ立ち絵(クラフトくんの HYBRID_MONSTER_IMGS。番号から引く)。まだの子はカードの絵
  if (mon.main) return (typeof HYBRID_MONSTER_IMGS !== 'undefined' && HYBRID_MONSTER_IMGS && HYBRID_MONSTER_IMGS[mon.no]) || null;
  const id = CARD_SPECIES_ART[mon.species];
  const m = id && typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[id] : null;
  if (m && m.imgUrl) return m.imgUrl;
  return cardNewSpeciesArt()[mon.species] || null;
};
const cardTodayJst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
const cardCaption = (c) => (!c ? '' : c.kind === 'dge' ? '回避' : c.kind === 'blk' ? '防御' : c.kind === 'spe' ? '特殊' : `ダメージ${c.damage}`);
const cardUserLabel = (db, c) => {
  if (!c) return '';
  if (c.user === 'any') return '全モンスター';
  if (c.user === 'breeder') return 'ブリーダー';
  const m = Object.values(db.monsters).find((x) => x.species === c.user && !x.variant);
  return m ? `${m.name}専用` : c.user;
};
// 守りの番に使える回避・防御が無いとき、なぜ使えないかを短く出す(手札の守りのカードごとに、最初に引っかかった理由)
const cardGuardBlockReasons = (db, st) => {
  const pd = st.pending;
  if (!pd) return [];
  const q = pd.defender;
  const me = st.players[q];
  const t = pd.targets[pd.ti];
  const target = t ? st.players[t.p].mons[t.m] : null;
  const atk = cardOf(db, pd.main);
  const kindName = { pow: 'ちから技', int: 'かしこさ技' };
  const out = [];
  const guards = me.hand.map((no) => cardOf(db, no)).filter((c) => c && cardIsGuardKind(c.kind));
  if (!guards.length) return ['手札に回避・防御のカードがありません'];
  guards.forEach((c) => {
    const ev = cardEff(c, 'evade');
    const re = cardEff(c, 'reduce') || cardEff(c, 'reduceHalf') || cardEff(c, 'reduceAll') || cardEff(c, 'reflect');
    let why = null;
    if (!c.ready) why = `「${c.name}」は準備中`;
    else if ((st.forbid[q] || []).includes(c.kind)) why = `このターンは${c.kind === 'dge' ? '回避' : '防御'}を使えません`;
    else if (c.guts > me.guts.length) why = `「${c.name}」はガッツが足りません(あと${c.guts - me.guts.length})`;
    else if (cardHasEff(c, 'cover')) why = `「${c.name}」は味方が狙われたときに、別の子が使います`;
    else if (target && t.p === q && !cardUsableBy(c, target)) why = `「${c.name}」は${target.name}が使えるカードではありません`;
    else if (ev && cardHasEff(atk, 'noEvade')) why = `「${atk.name}」は回避できません`;
    else if (ev && !ev.kinds.includes(atk.kind)) why = `「${c.name}」は${ev.kinds.map((k) => kindName[k] || k).join('・')}にしか使えません`;
    else if (ev && ev.minGuts && pd.cost < ev.minGuts) why = `「${c.name}」はガッツ${ev.minGuts}以上の技にしか使えません`;
    else if (re && !re.kinds.includes(atk.kind)) why = `「${c.name}」は${re.kinds.map((k) => kindName[k] || k).join('・')}にしか使えません`;
    if (why && !out.includes(why)) out.push(why);
  });
  return out.slice(0, 2);
};
const CARD_CPU = 1;
const CARD_DRAG_THRESHOLD = 10; // 指がこれだけ動いたら「運ぶ」(モンヒロバトルの DRAG_THRESHOLD と同じ)
const CARD_ME = 0;
const cardDeciderOf = (st) => (st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? 1 - st.first : cardDecider(st));

// 長押しで詳しい画面(どのカードでも。5-3)。指を離すまでに 450ms たったら長押し
const useCardLongPress = (onLong) => {
  const timer = useRef(null);
  const fired = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (no, onTap) => ({
    onPointerDown: () => { fired.current = false; clearTimeout(timer.current); timer.current = setTimeout(() => { fired.current = true; onLong(no); }, 450); },
    onPointerUp: () => clearTimeout(timer.current),
    onPointerLeave: () => clearTimeout(timer.current),
    onPointerCancel: () => clearTimeout(timer.current),
    onContextMenu: (e) => e.preventDefault(),
    onClick: (e) => { if (fired.current) { fired.current = false; return; } if (onTap) onTap(e); },
  });
};

// ---- 詳しい画面(大きな絵・名前・種類・ガッツ・使える子・番号・文)。どこをタップしても閉じる ----
const CardDetailModal = ({ db, no, onClose }) => {
  const c = cardOf(db, no);
  const m = c ? null : cardMonsterOf(db, no);
  return (
    <div data-card-detail onClick={onClose} className="fixed inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto px-4 py-6" style={{ zIndex: MODAL_Z.dialog, backgroundColor: 'rgba(2,6,23,0.94)' }} role="dialog" aria-label="カードの詳しい画面">
      <img src={CARD_IMG(c ? c.img : m ? m.img : no, 'l')} alt={c ? c.name : m ? m.name : ''} className="w-[min(78vw,300px)] rounded-xl shadow-2xl"/>
      {c && (
        <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/90 p-3 text-slate-100">
          <div className="text-lg font-black">{c.name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[12px] font-bold">
            <span className="rounded-md bg-indigo-900 px-2 py-0.5">{CARD_KIND_LABEL[c.kind]}</span>
            <span className="rounded-md bg-amber-900 px-2 py-0.5">ガッツ{c.guts}</span>
            {c.damage !== null && c.damage !== undefined && <span className="rounded-md bg-rose-900 px-2 py-0.5">ダメージ{c.damage}</span>}
            <span className="rounded-md bg-slate-700 px-2 py-0.5">{cardUserLabel(db, c)}</span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-400">No.{c.no}</span>
          </div>
          {c.text && <p className="mt-2 text-[14px] font-bold leading-relaxed">{c.text}</p>}
          {!c.ready && <p className="mt-2 text-[12px] font-bold text-amber-300">このカードは準備中です(まだデッキに入れられません)</p>}
        </div>
      )}
      {m && (
        <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-slate-900/90 p-3 text-slate-100">
          <div className="text-lg font-black">{m.name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[12px] font-bold">
            <span className="rounded-md bg-emerald-900 px-2 py-0.5">ライフ{m.life}</span>
            <span className="rounded-md bg-sky-900 px-2 py-0.5">{CARD_TYPE_LABEL[m.type]}</span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-400">No.{m.no}</span>
          </div>
        </div>
      )}
      <button type="button" onClick={onClose} className="mh-button mh-button-secondary min-h-[48px] w-full max-w-sm rounded-2xl border border-white/20 bg-slate-900 font-black">閉じる</button>
    </div>
  );
};

// ---- 捨て札の一覧(自分/相手のタブ・新しい順・1枚を長押しで詳しい画面) ----
const CardDiscardModal = ({ db, st, initial = CARD_ME, onDetail, onClose }) => {
  const [tab, setTab] = useState(initial);
  const press = useCardLongPress(onDetail);
  const list = st.players[tab].discard.slice().reverse();
  return (
    <ModalFrame label="捨て札" border="border-indigo-400/70" onClose={onClose}>
      <div data-card-discard className="mb-2 grid grid-cols-2 gap-2">
        {[CARD_ME, CARD_CPU].map((p) => (
          <button key={p} type="button" onClick={() => setTab(p)} className={`min-h-[44px] rounded-xl border text-[13px] font-black ${tab === p ? 'border-amber-300 bg-amber-500/20 text-amber-100' : 'border-white/15 bg-slate-900 text-slate-300'}`}>
            {p === CARD_ME ? '自分の捨て札' : '相手の捨て札'}({st.players[p].discard.length})
          </button>
        ))}
      </div>
      <div className="grid max-h-[60vh] grid-cols-4 gap-1.5 overflow-y-auto">
        {list.length === 0 && <p className="col-span-4 py-6 text-center text-[13px] font-bold text-slate-400">まだありません</p>}
        {list.map((no, i) => { const c = cardOf(db, no); return (
          <div key={`${no}-${i}`} {...press(no)} className="flex flex-col items-center">
            <img src={CARD_IMG(c ? c.img : no)} alt={c ? c.name : no} loading="lazy" className="w-full rounded-md"/>
            <span className="mt-0.5 w-full truncate text-center text-[11px] font-bold text-slate-200">{c ? c.name : no}</span>
          </div>
        ); })}
      </div>
      <p className="mt-2 text-center text-[11px] font-bold text-slate-400">カードを長押しすると詳しく見られます</p>
      <div className="mt-2"><ModalCloseButton onClick={onClose}/></div>
    </ModalFrame>
  );
};

// ---- 場のモンスター1体(カードの小さい絵・名前・ライフ・特徴・モンヒロの絵) ----
const CardMonSlot = ({ db, st, p, m, mark = null, fx = [], onTap, press, compact = false, motion = null }) => {
  const mon = st.players[p].mons[m];
  const art = cardMonArt(mon);
  const ty = cardMonType(mon, st.turn);
  const opp = p === CARD_CPU;
  const pct = Math.max(0, Math.round((mon.life / mon.max) * 100));
  const stunned = mon.stunTurn === st.turn + (st.active === p ? 0 : 1) && !mon.ko;
  const info = (
    <div className="flex items-center gap-1">
      <img src={CARD_IMG(cardMonsterOf(db, mon.no).img)} alt={mon.name} className={`h-[52px] w-[37px] rounded-[3px] object-cover shadow ${mon.ko ? 'grayscale opacity-40' : ''}`}/>
      <div className="w-[62px] min-w-0">
        <div className="truncate text-[12px] font-black leading-tight">{mon.name}</div>
        <div className="text-[13px] font-black leading-tight">{mon.life}<span className="text-[10px] text-slate-400"> / {mon.max}</span></div>
        <div className="h-[6px] overflow-hidden rounded bg-slate-700"><div className={`h-full ${pct > 50 ? 'bg-emerald-400' : pct > 25 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${pct}%` }}/></div>
        <span className={`mt-0.5 inline-block rounded px-1 text-[10px] font-bold ${ty === 'air' ? 'bg-cyan-800' : ty === 'water' ? 'bg-blue-800' : 'bg-indigo-900'}`}>{CARD_TYPE_LABEL[ty]}</span>
        {stunned && <span className="ml-0.5 inline-block rounded bg-rose-900 px-1 text-[10px] font-bold">攻撃できない</span>}
      </div>
    </div>
  );
  // 動き(85-card-battle-motion.jsx): attack … SkillFxMotion で技の動き / hit 揺れ / dodge よける / guard 防ぐ(光の盾) / KO は倒れたまま
  const artSize = compact ? 'max-h-[56px] max-w-[72px]' : 'max-h-[78px] max-w-[96px]';
  const imgEl = art
    ? <img src={art} alt="" className={`${artSize} object-contain drop-shadow-[0_6px_6px_rgba(0,0,0,.6)] ${opp ? '-scale-x-100' : ''}`}/>
    : <img src={CARD_IMG(cardMonsterOf(db, mon.no).img)} alt="" className={`${compact ? 'h-[54px]' : 'h-[74px]'} rounded-md object-cover`}/>;
  const mv = motion && !mon.ko ? motion : null;
  const poseClass = mon.ko ? 'mh-card-ko' : mv && mv.type === 'hit' ? 'mh-card-hit' : mv && mv.type === 'dodge' ? 'mh-card-dodge' : mv && mv.type === 'guard' ? 'mh-card-guard' : '';
  const artEl = (
    <div data-card-art={`${p}-${m}`} className={`relative flex ${compact ? 'h-[56px]' : 'h-[78px]'} w-full items-end justify-center`}
      style={mv && mv.type === 'attack' ? { '--atk-dx': `${mv.dx}px`, '--atk-dy': `${mv.dy}px`, zIndex: 40 } : undefined}>
      {mv && mv.type === 'attack' && mv.kind
        ? <SkillFxMotion key={mv.key} kind={mv.kind} image={imgEl}/>
        : <div key={mv ? mv.key : 'still'} data-card-pose={mon.ko ? 'ko' : mv ? mv.type : 'still'} className={`flex items-end justify-center ${poseClass}`}>{imgEl}</div>}
      {mv && mv.type === 'guard' && <span key={`${mv.key}-s`} className="mh-card-shield" aria-hidden="true"/>}
      {mon.ko && <span className="absolute bottom-2 rounded bg-black/70 px-1.5 text-[12px] font-black text-slate-300">KO</span>}
      {fx.map((f) => (
        <span key={f.key} className={`pointer-events-none absolute top-1 z-[50] text-[30px] font-black ${f.dmg > 0 ? 'animate-bounce text-white' : 'text-sky-200'}`} style={{ WebkitTextStroke: f.dmg > 0 ? '2px #dc2626' : '1px #0369a1', textShadow: '0 0 10px rgba(248,113,113,.8)' }}>
          {f.dmg > 0 ? `−${f.dmg}` : f.heal ? `＋${f.heal}` : 'ミス'}
        </span>
      ))}
    </div>
  );
  const ring = mark === 'drop' ? 'ring-4 ring-emerald-300 bg-emerald-400/15' : mark === 'target' ? 'ring-4 ring-rose-400' : mark === 'user' ? 'ring-4 ring-amber-300' : mark === 'acting' ? 'ring-2 ring-amber-300/80' : '';
  return (
    <div data-card-mon={`${p}-${m}`} {...(press ? press(mon.no, onTap) : { onClick: onTap })} className={`relative flex w-[31%] flex-col items-center rounded-xl p-0.5 ${ring}`} style={motion && motion.type === 'attack' ? { zIndex: 40 } : undefined}>
      {opp ? <>{info}{artEl}</> : <>{artEl}{info}</>}
    </div>
  );
};

// ---- 対戦の盤面 ----
const CardBattleBoard = ({ db, game, onFinish }) => {
  const who = ASSISTANTS.find((a) => a.id === game.who) || ASSISTANTS[0];
  const policy = useMemo(() => cardAiPolicy(game.who, game.level), [game.who, game.level]);
  const [st, setSt] = useState(game.st);
  const [sel, setSel] = useState(null);      // 攻撃: { hand, mon, set } / 守り: { hand }
  const [picks, setPicks] = useState([]);    // ガッツへ・捨てる・始める前のガッツで選んだ手札
  const [fx, setFx] = useState([]);          // ダメージの数字
  const [bubble, setBubble] = useState(null);
  const [face, setFace] = useState('normal');
  const [detail, setDetail] = useState(null);
  const [discard, setDiscard] = useState(null);
  const [hint, setHint] = useState('');
  const [quit, setQuit] = useState(false);
  const [action, setAction] = useState(null);   // まんなかに出す、いま使った技
  const [drag, setDrag] = useState(null);       // 運んでいる手札 { i, no, x, y, active }
  const [dropOver, setDropOver] = useState(null); // 指の下の置ける所('p-m' か 'guts')
  const dragRef = useRef(null);
  const ghostRef = useRef(null);
  // 練習試合(チュートリアル・86-card-tutorial.jsx)。tutI … いまの段 / tutQ … これから出す台詞 / tutSay … ドラの説明の窓に出している台詞
  const tutorial = game.tutorial === true;
  const [tutI, setTutI] = useState(0);
  const [tutQ, setTutQ] = useState(() => (tutorial ? CARD_TUTORIAL_STAGES[0].lines.slice() : []));
  const [tutSay, setTutSay] = useState(null);
  const tutWrong = useRef(0);
  const tutStage = tutorial ? CARD_TUTORIAL_STAGES[Math.min(tutI, CARD_TUTORIAL_STAGES.length - 1)] : null;
  const [motions, setMotions] = useState({});   // 場の子の動き { 'p-m': { type, kind, dx, dy, key } }
  const motionTimers = useRef([]);
  useEffect(() => () => motionTimers.current.forEach(clearTimeout), []);
  const playMotion = (id, mv, ms) => {
    setMotions((cur) => ({ ...cur, [id]: mv }));
    motionTimers.current.push(setTimeout(() => setMotions((cur) => (cur[id] && cur[id].key === mv.key ? (({ [id]: _, ...rest }) => rest)(cur) : cur)), ms));
  };
  // 背の低い画面(iPhone SE など)では、絵と手札を少し小さくして、まんなかの場所を残す
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerHeight < 760);
  useEffect(() => { const on = () => setCompact(window.innerHeight < 760); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on); }, []);
  const lastLine = useRef({});
  const spoke = useRef({ turn: -1, n: 0 });
  const bubbleTimer = useRef(null);
  const finished = useRef(false);
  const press = useCardLongPress((no) => setDetail(no));
  const paused = !!detail || !!discard || quit;

  const say = (scene) => {
    if (!scene) return;
    const turn = st.turn;
    if (spoke.current.turn !== turn) spoke.current = { turn, n: 0 };
    if (spoke.current.n >= CARD_LINE_PER_TURN && scene !== 'win' && scene !== 'lose') return;
    const line = cardPickLine(game.who, scene, lastLine.current);
    if (!line) return;
    spoke.current.n += 1;
    lastLine.current = { ...lastLine.current, [scene]: line.index };
    setFace(line.face);
    setBubble({ text: line.text, key: `${Date.now()}-${scene}` });
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), 4500);
  };
  useEffect(() => { if (!tutorial) say('start'); return () => clearTimeout(bubbleTimer.current); }, []);
  // 練習試合: 段が変わったら、その段の台詞を出す。みゅあの台詞は吹き出しに出して、少ししたら次へ。ドラの台詞は説明の窓に出す
  useEffect(() => { if (tutorial && tutStage) setTutQ(tutStage.lines.slice()); }, [tutI]);
  useEffect(() => {
    if (!tutorial || !tutQ.length) return undefined;
    const head = tutQ[0];
    if (head[0] === 'M') {
      setFace('happy');
      setBubble({ text: CARD_TUTORIAL_LINES[head], key: `t-${head}-${Date.now()}` });
      const t = setTimeout(() => { setBubble(null); setTutQ((q) => q.slice(1)); }, 2100);
      return () => clearTimeout(t);
    }
    setTutSay(head);
    return undefined;
  }, [tutQ]);

  // 操作を1つ進める(だめな操作は何もしない)
  const tutAllow = (act) => !tutorial || (!tutStage.next && tutQ.length <= 1 && (!tutQ.length || tutQ[0][0] === 'D') && cardTutorialAllow(db, tutStage.id, st, act));
  const tutWrongSay = () => { const id = CARD_TUTORIAL_WRONG[tutWrong.current % CARD_TUTORIAL_WRONG.length]; tutWrong.current += 1; setHint(CARD_TUTORIAL_LINES[id]); };
  const step = (act) => {
    if (tutorial && cardDeciderOf(st) === CARD_ME && !tutAllow(act)) { tutWrongSay(); return false; }
    const next = cardApplyAction(db, st, act);
    if (!next) return false;
    const evs = next.events || [];
    // 次のことが起きたら、吹き出しはその時点で消す(5-3)
    // ★練習試合では消さない(みゅあの台詞が消えたあと、次の台詞まで光る所も吹き出しも無い時間ができていた)
    if (!tutorial && evs.some((e) => e.t === 'use' || e.t === 'guard')) { clearTimeout(bubbleTimer.current); setBubble(null); }
    const hits = evs.filter((e) => e.t === 'hit' || e.t === 'heal').map((e, i) => ({ ...e, key: `${next.log.length}-${i}-${Date.now()}`, heal: e.t === 'heal' ? e.n : 0, dmg: e.t === 'hit' ? e.dmg : 0 }));
    if (hits.length) {
      setFx(hits);
      setTimeout(() => setFx((cur) => cur.filter((f) => !hits.some((h) => h.key === f.key))), 1000);
      if (hits.some((h) => h.dmg >= 3)) Audio_.se.crit(); else if (hits.some((h) => h.dmg > 0)) Audio_.se.attack(); else if (hits.some((h) => h.heal)) Audio_.se.heal(); else Audio_.se.guard();
    } else if (evs.some((e) => e.t === 'use')) Audio_.se.card();
    // 技の動き: 攻撃した子が狙った子へ向かって動く(位置は画面で測る。全員に当たる技は相手の真ん中へ)
    const centerOf = (id) => { const el = document.querySelector(`[data-card-art="${id}"]`); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
    evs.filter((e) => e.t === 'use' && e.mon >= 0).forEach((e, n) => {
      const mon = next.players[e.p].mons[e.mon];
      const kind = cardMotionKindOf(db, e.cards[0], mon);
      if (!kind) return;
      const from = centerOf(`${e.p}-${e.mon}`);
      const to = e.target ? centerOf(`${e.target.p}-${e.target.m}`) : centerOf(`${1 - e.p}-1`);
      if (!from || !to) return;
      const key = `${next.log.length}-${n}-${Date.now()}`;
      playMotion(`${e.p}-${e.mon}`, { type: 'attack', kind, dx: Math.round(to.x - from.x), dy: Math.round(to.y - from.y), key }, cardMotionMs(kind) + 80);
    });
    // 受ける・よける・防ぐ
    evs.filter((e) => e.t === 'hit').forEach((e, n) => {
      const type = e.evaded && !e.dmg ? 'dodge' : e.guarded && !e.dmg ? 'guard' : e.dmg > 0 ? 'hit' : (e.evaded ? 'dodge' : null);
      if (type) playMotion(`${e.p}-${e.m}`, { type, key: `h${next.log.length}-${n}-${Date.now()}` }, 720);
    });
    evs.filter((e) => e.t === 'guard').forEach((e, n) => {
      const c = cardOf(db, e.card);
      playMotion(`${e.p}-${e.mon}`, { type: c && c.kind === 'dge' ? 'dodge' : 'guard', key: `g${next.log.length}-${n}-${Date.now()}` }, 720);
    });
    const use = evs.find((e) => e.t === 'use');
    if (use) {
      const p0 = next.players[use.p];
      const key = `${next.log.length}-${Date.now()}`;
      setAction({ key, cards: use.cards, who: use.mon >= 0 ? p0.mons[use.mon].name : `${p0.name}(ブリーダー)` });
      setTimeout(() => setAction((cur) => (cur && cur.key === key ? null : cur)), 2200);
    }
    else if (evs.some((e) => e.t === 'guard')) Audio_.se.guard();
    if (tutorial && cardTutorialDone(tutStage.id, st, next)) setTutI((i) => i + 1);
    const scene = tutorial ? null : cardLineSceneOf(db, st, next, CARD_CPU);
    setSt(next); setSel(null); setPicks([]); setHint('');
    if (scene) say(scene);
    return true;
  };

  // コンピューターの番(守りの番・始める前・捨てる番も)。詳しい画面や捨て札を見ているあいだは待つ
  useEffect(() => {
    if (st.winner !== null || paused || game.demo) return undefined;
    if (tutorial && !cardTutorialCpu(db, tutStage.id, st)) return undefined;
    if (cardDeciderOf(st) !== CARD_CPU) return undefined;
    const wait = st.pending ? 950 : st.phase === 'guts' ? 600 : 900; // 守りの番は、技の動きを見せ切ってから
    const t = setTimeout(() => {
      const act = tutorial ? cardTutorialCpu(db, tutStage.id, st) : cardAiChooseAction(db, st, policy);
      if (!act) return; // 練習試合のみゅあは、段が来るまで待つ
      if (!step(act)) step(st.pending ? { type: 'pass' } : st.phase === 'main' ? { type: 'endAttacks' } : { type: 'guts', hand: [] });
    }, wait);
    return () => clearTimeout(t);
  }, [st, paused, tutI]);

  // 動きの見本(デバッグ): 決まった順に1手ずつ進める
  const demoAt = useRef(0);
  useEffect(() => {
    if (!game.demo || paused) return undefined;
    const t = setTimeout(() => {
      const demoStep = game.demo.steps[demoAt.current];
      if (!demoStep) return;
      demoAt.current += 1;
      const act = cardMotionDemoAction(db, st, demoStep);
      if (act) step(act);
    }, demoAt.current === 0 ? 1400 : 1700);
    return () => clearTimeout(t);
  }, [st, paused]);
  // 勝ち負けが決まったら、少し見せてから結果へ
  useEffect(() => {
    if (st.winner === null || finished.current || tutorial) return undefined; // 練習試合は、ドラの締めの台詞のあと「次へ」で終わる
    finished.current = true;
    const t = setTimeout(() => onFinish({ outcome: st.winner === CARD_ME ? 'win' : 'lose', st }), 2200);
    return () => clearTimeout(t);
  }, [st.winner]);

  const me = st.players[CARD_ME];
  const opp = st.players[CARD_CPU];
  const decider = cardDeciderOf(st);
  const myTurn = st.winner === null && decider === CARD_ME;
  const mode = !myTurn ? 'wait'
    : st.pendingDiscard ? 'discard'
    : st.phase === 'setup' ? 'setup'
    : st.pending ? 'guard'
    : st.phase === 'main' ? 'attack'
    : st.phase === 'guts' ? 'guts' : 'wait';
  const attackOpts = mode === 'attack' ? cardAttackOptions(db, st).filter(tutAllow) : [];
  const guardOpts = mode === 'guard' ? cardGuardOptions(db, st).filter(tutAllow) : [];

  // 選んだカードから、残りの選び方(使う子・組み合わせ・狙う相手)を絞る
  const selOpts = sel && mode === 'attack' ? attackOpts.filter((o) => o.hand.includes(sel.hand)) : [];
  const selMons = [...new Set(selOpts.map((o) => (o.mon === undefined ? -1 : o.mon)))];
  const monChosen = sel && (sel.mon !== undefined ? sel.mon : selMons.length === 1 ? selMons[0] : undefined);
  const byMon = monChosen === undefined ? [] : selOpts.filter((o) => (o.mon === undefined ? -1 : o.mon) === monChosen);
  const sets = [...new Set(byMon.map((o) => JSON.stringify(o.hand)))].sort((a, b) => JSON.parse(b).length - JSON.parse(a).length);
  const setChosen = sel && sets.length ? (sel.set && sets.includes(sel.set) ? sel.set : sets[0]) : null;
  const finalOpts = byMon.filter((o) => JSON.stringify(o.hand) === setChosen);
  const needTarget = finalOpts.some((o) => o.target);

  const tapHand = (i) => {
    Audio_.se.tap();
    if (tutorial && myTurn && (!cardTutorialHandOk(tutStage.id, st, i) || tutStage.next || tutQ.length > 1)) { tutWrongSay(); return; }
    if (mode === 'guts' || mode === 'setup' || mode === 'discard') {
      const max = mode === 'setup' ? CARD_BATTLE_SETUP_GUTS_MAX : mode === 'discard' ? st.pendingDiscard.n : 99;
      setPicks((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : cur.length >= max ? cur : [...cur, i]));
      return;
    }
    if (mode === 'guard') {
      const os = guardOpts.filter((o) => o.hand === i);
      if (!os.length) { setHint('このカードでは守れません'); return; }
      const mons = [...new Set(os.map((o) => o.mon))];
      if (mons.length === 1) { step(os[0]); return; }
      setSel({ hand: i }); setHint('かばう子をタップ');
      return;
    }
    if (mode !== 'attack') return;
    if (sel && sel.hand === i) { setSel(null); setHint(''); return; }
    const os = attackOpts.filter((o) => o.hand.includes(i));
    const c = cardOf(db, me.hand[i]);
    if (!os.length) {
      setHint(!c ? '' : cardIsGuardKind(c.kind) ? '回避・防御は、相手に攻撃されたときに使います'
        : !c.ready ? 'このカードは準備中です'
        : c.guts > me.guts.length ? `ガッツが足りません(あと${c.guts - me.guts.length})` : 'いまは使えません(使える子がいない・もう攻撃した など)');
      setSel(null);
      return;
    }
    setSel({ hand: i });
    setHint('');
  };
  const tapMon = (p, m) => {
    if (mode === 'guard' && sel) {
      const o = guardOpts.find((x) => x.hand === sel.hand && x.mon === m && p === CARD_ME);
      if (o) step(o);
      return;
    }
    if (mode !== 'attack' || !sel) return;
    if (monChosen === undefined) {
      if (p === CARD_ME && selMons.includes(m)) { Audio_.se.tap(); setSel({ ...sel, mon: m }); }
      return;
    }
    const o = finalOpts.find((x) => x.target && x.target.p === p && x.target.m === m);
    if (o) step(o);
  };
  const markOf = (p, m) => {
    if (drag && drag.active) return dropOver === `${p}-${m}` ? 'drop' : null; // 運んでいるあいだは、置ける所の上だけ光らせる
    if (mode === 'attack' && sel) {
      if (monChosen === undefined) return p === CARD_ME && selMons.includes(m) ? 'user' : null;
      if (p === CARD_ME && m === monChosen) return 'acting';
      if (finalOpts.some((o) => o.target && o.target.p === p && o.target.m === m)) return 'target';
    }
    if (mode === 'guard' && sel && p === CARD_ME && guardOpts.some((o) => o.hand === sel.hand && o.mon === m)) return 'user';
    if (st.pending) {
      const t = st.pending.targets[st.pending.ti];
      if (t && t.p === p && t.m === m) return 'target';
      if (st.pending.attacker === p && st.pending.mon === m) return 'acting';
    }
    return null;
  };
  const handUsable = (i) => {
    if (mode === 'attack') return attackOpts.some((o) => o.hand.includes(i));
    if (mode === 'guard') return guardOpts.some((o) => o.hand === i);
    return mode === 'guts' || mode === 'setup' || mode === 'discard';
  };

  // ---- 手札を指で運ぶ(社長 台帳 #3473「モンバトみたいに長押しで持ってく」)。手本はモンヒロバトル(60-app.jsx の dragState)----
  // 指が CARD_DRAG_THRESHOLD 動いたら運ぶ。動かさずに長押ししたときだけ詳しい画面。動かさずに離したらタップ(いままでどおり)
  //   技 … 狙う相手のモンスターへ / ガッツにする(と始める前のガッツ)… ガッツの置き場へ / 守り … 狙われた自分のモンスターへ
  // 運んでいるカードは body 直下の箱に1枚だけ出し、位置は直接動かす(手札の欄の中で動かすと iPhone でずれて2枚に見えた・60-app.jsx の注意)
  const dropTargetsOf = (i) => {
    const out = {};
    if (mode === 'attack') {
      const os = attackOpts.filter((o) => o.hand[0] === i).concat(attackOpts.filter((o) => o.hand[0] !== i && o.hand.includes(i)));
      os.forEach((o) => {
        const keys = o.target ? [`${o.target.p}-${o.target.m}`] : [...opp.mons.map((x, m) => (x.ko ? null : `${CARD_CPU}-${m}`)).filter(Boolean), ...(o.mon >= 0 ? [`${CARD_ME}-${o.mon}`] : [])];
        keys.forEach((k) => { if (!out[k] || o.hand.length > out[k].hand.length) out[k] = o; });
      });
    }
    if (mode === 'guard') guardOpts.filter((o) => o.hand === i).forEach((o) => { out[`${CARD_ME}-${o.mon}`] = o; });
    if ((mode === 'guts' || mode === 'setup') && !picks.includes(i)) {
      const max = mode === 'setup' ? CARD_BATTLE_SETUP_GUTS_MAX : 99;
      if (picks.length < max && (!tutorial || cardTutorialHandOk(tutStage.id, st, i))) out.guts = 'pick';
    }
    return out;
  };
  const dropKeyAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    if (el.closest('[data-card-guts-drop]')) return 'guts';
    const mon = el.closest('[data-card-mon]');
    return mon ? mon.getAttribute('data-card-mon') : null;
  };
  const handDown = (e, i, no) => {
    if (e.button !== undefined && e.button !== 0) return;
    const d = { i, no, sx: e.clientX, sy: e.clientY, active: false, long: false, targets: myTurn ? dropTargetsOf(i) : {} };
    dragRef.current = d;
    clearTimeout(d.timer);
    d.timer = setTimeout(() => { if (!d.active) { d.long = true; setDetail(no); } }, 450);
    const onMove = (ev) => {
      const moved = Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy);
      if (!d.active && moved >= CARD_DRAG_THRESHOLD && !d.long && Object.keys(d.targets).length) {
        d.active = true;
        clearTimeout(d.timer);
        setDrag({ i, no, x: ev.clientX, y: ev.clientY, active: true });
      }
      if (!d.active) { if (moved >= CARD_DRAG_THRESHOLD) clearTimeout(d.timer); return; }
      if (ghostRef.current) { ghostRef.current.style.left = `${ev.clientX}px`; ghostRef.current.style.top = `${ev.clientY}px`; }
      const k = dropKeyAt(ev.clientX, ev.clientY);
      const over = k && d.targets[k] ? k : null;
      if (over !== d.over) { d.over = over; setDropOver(over); }
      if (ev.cancelable) ev.preventDefault();
    };
    const onUp = (ev) => {
      clearTimeout(d.timer);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      dragRef.current = null;
      if (d.active) {
        const k = ev.type === 'pointercancel' ? null : dropKeyAt(ev.clientX, ev.clientY);
        const t = k ? d.targets[k] : null;
        setDrag(null); setDropOver(null);
        if (t === 'pick') { Audio_.se.tap(); setPicks((cur) => (cur.includes(i) ? cur : [...cur, i])); }
        else if (t) step(t);
        return;
      }
      if (d.long || ev.type === 'pointercancel') return;
      if (Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) < CARD_DRAG_THRESHOLD) tapHand(i);
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  // まんなかの「いま起きたこと」(新しい2行)。守りの番は、何が来ているかを出す
  const pd = st.pending;
  const pendingText = pd ? (() => {
    const c = cardOf(db, pd.main);
    const t = pd.targets[pd.ti];
    const tm = t ? st.players[t.p].mons[t.m] : null;
    const atk = pd.mon >= 0 ? st.players[pd.attacker].mons[pd.mon].name : 'ブリーダー';
    return `${atk}の「${c.name}」(ダメージ${pd.base * pd.mult})が${tm ? tm.name : ''}に！`;
  })() : null;
  const logLines = st.log.filter((l) => l.kind !== 'turn').slice(-3);

  const strip = (p) => {
    const pl = st.players[p];
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-bold">
        {p === CARD_CPU && <span className="flex">{pl.hand.map((_, i) => <b key={i} className="-ml-1 h-[18px] w-[13px] rounded-[2px] border border-violet-300 bg-gradient-to-br from-violet-600 to-indigo-900 first:ml-0"/>)}</span>}
        <span className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5">山札 {pl.deck.length}</span>
        <span {...(p === CARD_ME ? { 'data-card-guts-drop': true } : {})} className={`flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-amber-100 ${p === CARD_ME && dropOver === 'guts' ? 'border-emerald-300 bg-emerald-400/30 ring-4 ring-emerald-300' : 'border-amber-300/40 bg-amber-500/10'}`}>ガッツ {pl.guts.length}</span>
        <button type="button" onClick={() => setDiscard({ tab: p })} className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5">捨て札 {pl.discard.length}</button>
      </div>
    );
  };

  // 練習試合で、いま教えている所(光らせる手札・押せるボタン)。ほかのボタンは押せない(暗くする)
  const tutFocus = (() => {
    if (!tutorial) return { hand: [], button: null };
    if (tutStage.next || tutQ.length > 1 || (tutQ[0] && tutQ[0][0] === 'M') || !myTurn) return { hand: [], button: null };
    const okAct = (act) => cardTutorialAllow(db, tutStage.id, st, act);
    const hand = me.hand.map((_, i) => i).filter((i) => cardTutorialHandOk(tutStage.id, st, i) && !picks.includes(i));
    if (mode === 'attack') {
      if (okAct({ type: 'endAttacks' })) return { hand: [], button: 'end' };
      return { hand: sel ? [] : hand.filter((i) => attackOpts.some((o) => o.hand.includes(i))), button: null };
    }
    if (mode === 'guts') {
      if (tutStage.id === 'guts') return { hand: picks.length >= 2 ? [] : hand, button: picks.length ? 'turn' : null };
      return { hand: [], button: 'turn' };
    }
    if (mode === 'guard') return st.pending && st.pending.evaded ? { hand: [], button: 'pass' } : { hand: hand.filter((i) => guardOpts.some((o) => o.hand === i)), button: null };
    return { hand: [], button: null };
  })();
  const tutBtn = (key) => (tutorial ? (tutFocus.button === key ? ' animate-pulse ring-4 ring-emerald-300' : '') : '');
  const tutOff = (key) => tutorial && tutFocus.button !== key;
  const footer = (() => {
    const btn = 'mh-button min-h-[44px] flex-1 rounded-xl text-[14px] font-black active:scale-[.98] disabled:opacity-40';
    if (st.winner !== null && !tutorial) return <div className="flex-1 text-center text-[15px] font-black text-amber-200">{st.winner === CARD_ME ? '勝ち！' : '負け…'}</div>;
    if (tutorial && (st.winner !== null || tutStage.next)) return <div className="flex-1 text-center text-[13px] font-bold text-slate-300">ドラの説明を読んで「次へ」</div>;
    if (mode === 'wait') return <div className="flex-1 text-center text-[13px] font-bold text-slate-300">{who.name}の番…</div>;
    if (mode === 'setup') return <button type="button" className={`${btn} mh-button-primary`} onClick={() => step({ type: 'setupGuts', hand: picks })}>{picks.length ? `${picks.length}枚をガッツにして始める` : 'ガッツにしないで始める'}</button>;
    if (mode === 'discard') return <button type="button" disabled={picks.length !== st.pendingDiscard.n} className={`${btn} mh-button-danger`} onClick={() => step({ type: 'discard', hand: picks })}>{`${st.pendingDiscard.n}枚えらんで捨てる`}</button>;
    if (mode === 'guard') return <button type="button" disabled={tutOff('pass')} className={`${btn} border border-white/20 bg-slate-800${tutBtn('pass')}`} onClick={() => step({ type: 'pass' })}>{tutorial && st.pending && st.pending.evaded ? 'これで守る' : '守らない'}</button>;
    if (mode === 'guts') return <button type="button" disabled={tutOff('turn')} className={`${btn} bg-gradient-to-b from-orange-400 to-orange-600${tutBtn('turn')}`} onClick={() => step({ type: 'guts', hand: picks })}>{picks.length ? `${picks.length}枚をガッツにしてターン終了` : 'ガッツにしないでターン終了'}</button>;
    const useBtn = sel && monChosen !== undefined && finalOpts.length && !needTarget;
    return (<>
      {useBtn ? <button type="button" className={`${btn} mh-button-primary`} onClick={() => step(finalOpts[0])}>使う</button> : null}
      <button type="button" disabled={tutOff('end')} className={`${btn} border border-violet-300/60 bg-violet-900${tutBtn('end')}`} onClick={() => step({ type: 'endAttacks' })}>攻撃おわり → ガッツへ</button>
    </>);
  })();
  const guide = tutorial && (tutStage.next || tutQ.length > 1) ? '' : mode === 'attack' ? (sel ? (monChosen === undefined ? '使う子をタップ' : needTarget ? '狙う相手をタップ' : '「使う」をタップ') : attackOpts.length ? '技をタップ → 相手をタップ(相手まで運んでもOK)' : '使える技がありません →「攻撃おわり」でガッツへ')
    : mode === 'guard' ? (guardOpts.length ? '使える回避・防御だけが明るくなっています' : '使える回避・防御はありません')
    : mode === 'guts' ? 'ガッツにするカードをタップ(ガッツへ運んでもOK・何枚でも)'
    : mode === 'setup' ? '後攻: 始める前に2枚までガッツにできます'
    : mode === 'discard' ? `捨てるカードを${st.pendingDiscard ? st.pendingDiscard.n : 0}枚タップ` : '';

  return (
    <div data-mh-screen data-card-battle data-card-mode={mode} className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden text-white" style={{ background: 'radial-gradient(ellipse at 50% 45%,#3b2a6b 0%,#1b1438 55%,#0d0a1f 100%)' }}>
      <div className={`flex ${compact ? 'h-[36px]' : 'h-[44px]'} shrink-0 items-center justify-between bg-black/35 px-2`}>
        <button type="button" data-card-quit onClick={() => setQuit(true)} className="rounded-lg border border-white/20 px-2 py-1 text-[12px] font-black text-slate-200">{tutorial ? '飛ばす' : '投了'}</button>
        <span className="text-[15px] font-black">MFバトルカード</span>
        <span className="text-[12px] font-bold text-violet-200">ターン {Math.max(1, st.turn)} ・ {st.active === CARD_ME ? 'あなたの番' : `${who.name}の番`}</span>
      </div>
      {/* 相手の帯(隠さない) */}
      <div className={`flex ${compact ? 'h-[42px]' : 'h-[50px]'} shrink-0 items-center gap-2 px-2`}>
        <img src={assistantFaceImage(who, face)} alt={who.name} className="h-[42px] w-[42px] rounded-xl border-2 bg-black object-cover object-top" style={{ borderColor: who.accent }}/>
        <div className="min-w-0 text-[13px] font-black leading-tight">{who.name}<small className="block text-[10px] font-bold text-rose-200">{CARD_LEVEL_LABEL[game.level]}</small></div>
        <div className="ml-auto">{strip(CARD_CPU)}</div>
      </div>
      {/* 吹き出し(帯の下・相手のモンスターの上。指の操作は下へ通す) */}
      <div className="flex shrink-0 items-start justify-around px-1">
        {opp.mons.map((_, m) => <CardMonSlot key={m} db={db} st={st} p={CARD_CPU} m={m} mark={markOf(CARD_CPU, m)} fx={fx.filter((f) => f.p === CARD_CPU && f.m === m)} onTap={() => tapMon(CARD_CPU, m)} press={press} compact={compact} motion={motions[`1-${m}`] || null}/>)}
      </div>
      {/* まんなか: 技の動き(アクション)と、起きたことの記録(ログ)の場所。相手の場と自分の場をここで上下に分ける(社長 2026-10-24)
          ★次の区切りの技ごとの動きも、この data-card-stage の中で見せる */}
      <div data-card-stage className="relative flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1.5 overflow-hidden px-3 py-1">
        {/* 相手の助手の吹き出し(まんなかのいちばん上。相手のモンスターにはかけない。指の操作は下へ通す) */}
        {bubble && (
          <div key={bubble.key} data-card-bubble className={`pointer-events-none relative z-[2] max-w-full rounded-2xl border-[3px] bg-white px-2.5 py-0.5 ${compact ? 'text-[12px]' : 'text-[13px]'} font-extrabold leading-snug text-[#1f1333] shadow-lg`} style={{ borderColor: who.accent, ...JA_WRAP_STYLE }}>
            <span className="mr-1 text-[11px]" style={{ color: who.accent }}>{who.name}</span>{bubble.text}
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-gradient-to-r from-transparent via-violet-300/40 to-transparent"/>
        {action && (
          <div key={action.key} data-card-action className={`relative z-[1] flex items-center gap-2 rounded-2xl border border-amber-300/50 bg-black/55 px-2 ${compact ? "py-0.5" : "py-1"} shadow-lg`}>
            {action.cards.slice(0, 3).map((no, i) => { const c = cardOf(db, no); return c ? <img key={i} src={CARD_IMG(c.img)} alt={c.name} className={`${compact ? 'h-[40px] w-[29px]' : 'h-[64px] w-[46px]'} rounded-[4px] object-cover shadow`}/> : null; })}
            <div className="text-[13px] font-black leading-tight">{action.who}<span className="block text-[15px] text-amber-200">「{action.cards.map((n) => (cardOf(db, n) || {}).name).join('＋')}」</span></div>
          </div>
        )}
        <div data-card-log className="relative z-[1] max-w-full rounded-xl border border-white/15 bg-black/45 px-3 py-1 text-center text-[13px] font-bold leading-snug" style={JA_WRAP_STYLE}>
          {pendingText && <div className="text-rose-200">{pendingText}</div>}
          {(pendingText ? [] : (compact || tutorial) ? logLines.slice(action || bubble || tutorial ? -1 : -2) : logLines.slice(bubble && action ? -2 : -3)).map((l, i, arr) => <div key={i} className={i === arr.length - 1 && !pendingText ? '' : 'text-[11px] text-violet-200'}>{l.text}</div>)}
        </div>
      </div>
      <div className="flex shrink-0 items-end justify-around px-1">
        {me.mons.map((_, m) => <CardMonSlot key={m} db={db} st={st} p={CARD_ME} m={m} mark={markOf(CARD_ME, m)} fx={fx.filter((f) => f.p === CARD_ME && f.m === m)} onTap={() => tapMon(CARD_ME, m)} press={press} compact={compact} motion={motions[`0-${m}`] || null}/>)}
      </div>
      <div className="flex shrink-0 justify-end px-2 py-1">{strip(CARD_ME)}</div>
        {/* 練習試合: ドラの説明の窓。手札のすぐ上に、中身の高さぶん場所を取って出す(まんなかに入れると、背の低い iPhone で自分の場の下に隠れて「次へ」が押せなかった・2026-10-24 社長の実機 #3475〜#3477) */}
      {tutorial && tutSay && (() => {
          const dra = ASSISTANTS.find((a) => a.id === 'dra');
          const head = tutQ[0];
          const showNext = tutStage.next ? (!head || head[0] === 'D') : (head && head[0] === 'D' && tutQ.length > 1);
          const onNext = () => {
            Audio_.se.tap();
            setHint('');
            if (tutQ.length > 1) { setTutQ((q) => q.slice(1)); return; }
            if (tutStage.onNext === 'finish') { finished.current = true; onFinish({ outcome: 'tutorialDone', st }); return; }
            if (tutStage.onNext) setSt((cur) => cardTutorialMutate(db, cur, tutStage.onNext));
            setTutI((i) => i + 1);
          };
          return (
            <div data-card-tutor={tutStage.id} className="relative z-[30] mx-2 mb-1 flex shrink-0 items-start gap-2 rounded-2xl border-2 border-emerald-300/80 bg-slate-950 px-2 py-1.5 shadow-lg">
              {dra && <img src={assistantFaceImage(dra, 'happy')} alt="ドラ" className="h-[36px] w-[36px] shrink-0 rounded-lg object-cover object-top"/>}
              <div className="min-w-0 flex-1 text-[12px] font-bold leading-snug text-emerald-50" style={JA_WRAP_STYLE}><b className="mr-1 text-[11px] text-emerald-300">ドラ</b>{CARD_TUTORIAL_LINES[tutSay]}{hint && <span data-card-tutor-hint className="mt-0.5 block text-[11px] text-amber-200">{hint}</span>}</div>
              {showNext && <button type="button" data-card-tutor-next onClick={onNext} className="shrink-0 self-center animate-pulse rounded-xl bg-emerald-400 px-3 py-2 text-[13px] font-black text-slate-950 ring-4 ring-emerald-300/70 active:scale-95">次へ</button>}
            </div>
          );
      })()}
      {/* 練習試合で、いまタップ(か運ぶ)カードの上に出す案内 */}
      {tutorial && tutFocus.hand.length > 0 && <div data-card-tutor-arrow className="mx-auto mb-1 shrink-0 animate-bounce rounded-lg bg-emerald-300 px-2 py-0.5 text-[12px] font-black text-slate-900">👇 {mode === 'guts' ? 'タップでガッツに(ガッツへ運んでもOK)' : mode === 'guard' ? 'タップで守る(狙われた子へ運んでもOK)' : 'タップ → 相手をタップ(相手へ運んでもOK)'}</div>}
      {guide && !tutorial && <div className="mx-auto mb-1 shrink-0 rounded-lg bg-amber-300 px-2 py-0.5 text-[11px] font-black text-slate-900">{hint || guide}</div>}
      {mode === 'guard' && !guardOpts.length && (
        <div data-card-guard-why className="mx-auto mb-1 max-w-[94%] shrink-0 text-center text-[11px] font-bold leading-snug text-slate-300" style={JA_WRAP_STYLE}>{cardGuardBlockReasons(db, st).join(' / ')}</div>
      )}
      {!guide && !tutorial && hint && <div className="mx-auto mb-1 shrink-0 rounded-lg bg-amber-300 px-2 py-0.5 text-[11px] font-black text-slate-900">{hint}</div>}
      {mode === 'attack' && sel && monChosen !== undefined && sets.length > 1 && (
        <div className="mb-1 flex shrink-0 flex-wrap justify-center gap-1 px-2">
          {sets.map((s) => <button key={s} type="button" onClick={() => setSel({ ...sel, mon: monChosen, set: s })} className={`rounded-lg border px-2 py-1 text-[12px] font-black ${s === setChosen ? 'border-amber-300 bg-amber-500/25' : 'border-white/20 bg-slate-800'}`}>{JSON.parse(s).map((i) => cardOf(db, me.hand[i]).name).join('＋')}</button>)}
        </div>
      )}
      <div data-card-hand className="flex shrink-0 items-end justify-center gap-1 px-1 pb-1">
        {me.hand.map((no, i) => {
          const c = cardOf(db, no);
          const on = handUsable(i);
          const up = (sel && sel.hand === i) || picks.includes(i) || (setChosen && JSON.parse(setChosen).includes(i));
          return (
            <div key={`${no}-${i}`} data-card-hand-card={i} onPointerDown={(e) => handDown(e, i, no)} onContextMenu={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()} style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }} className={`flex w-[19%] ${compact ? 'max-w-[58px]' : 'max-w-[76px]'} flex-col items-center transition-transform ${up ? '-translate-y-3' : ''} ${myTurn && !on && !tutorial ? 'opacity-45' : ''} ${tutorial && myTurn && !tutFocus.hand.includes(i) && !picks.includes(i) && !(sel && sel.hand === i) ? 'opacity-40' : ''} ${tutorial && tutFocus.hand.includes(i) ? 'animate-pulse rounded-[7px] ring-4 ring-emerald-300' : ''} ${drag && drag.i === i ? 'opacity-30' : ''}`} data-card-tutor-focus={tutorial && tutFocus.hand.includes(i) ? true : undefined}>
              <img src={CARD_IMG(c ? c.img : no)} alt={c ? c.name : no} draggable={false} style={{ WebkitUserDrag: 'none' }} className={`w-full rounded-[5px] shadow-[0_3px_6px_#000] ${up ? 'outline outline-[3px] outline-amber-300' : ''}`}/>
              <div className="mt-0.5 w-full rounded-md bg-black/60 py-0.5 text-center leading-tight">
                <b className={`block ${compact ? 'text-[10px]' : 'text-[11px]'} leading-tight`} style={{ ...JA_WRAP_STYLE, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c ? c.name : no}</b>
                {compact ? <>
                  <span className="block text-[10px] font-extrabold leading-tight text-amber-200">ガッツ{c ? c.guts : '-'}</span>
                  <span className="block whitespace-nowrap text-[10px] font-extrabold leading-tight text-amber-200">{cardCaption(c)}</span>
                </> : <>
                  <span className="block text-[11px] font-extrabold text-amber-200">ガッツ{c ? c.guts : '-'}</span>
                  <span className="block text-[11px] font-extrabold text-amber-200">{cardCaption(c)}</span>
                </>}
              </div>
            </div>
          );
        })}
      </div>
      <div data-card-footer className="flex shrink-0 gap-2 px-2.5 pb-2 pt-1" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>{footer}</div>
      {drag && drag.active && typeof ReactDOM !== 'undefined' && ReactDOM.createPortal(
        <div data-drag-card-layer className="pointer-events-none fixed inset-0" style={{ zIndex: MODAL_Z.dialog - 1 }}>
          <img ref={ghostRef} data-dragging-card src={CARD_IMG((cardOf(db, drag.no) || {}).img || drag.no)} alt="" className="fixed w-[76px] -translate-x-1/2 -translate-y-[70%] rotate-[-4deg] rounded-[5px] shadow-[0_8px_18px_rgba(0,0,0,.7)]" style={{ left: drag.x, top: drag.y }}/>
        </div>, document.body)}
      {detail && <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)}/>}
      {discard && <CardDiscardModal db={db} st={st} initial={discard.tab} onDetail={(no) => setDetail(no)} onClose={() => setDiscard(null)}/>}
      {quit && !tutorial && <ConfirmSheet title="投了しますか？" message={'投了すると負けになります(カードポイントとクイック周回は、倒した相手のモンスターの数に応じて少しだけ)'} confirmLabel="投了する" danger onCancel={() => setQuit(false)} onConfirm={() => { setQuit(false); finished.current = true; onFinish({ outcome: 'surrender', st }); }}/>}
      {quit && tutorial && <ConfirmSheet title="チュートリアルを飛ばしますか？" message={'ルールの画面からいつでもできます'} confirmLabel="飛ばす" onCancel={() => setQuit(false)} onConfirm={() => { setQuit(false); finished.current = true; onFinish({ outcome: 'tutorialSkip', st }); }}/>}
    </div>
  );
};

// ---- トップ・スターター選び・相手えらび・結果 ----
// 助手の全身絵を、描かれている所(透明でない所)の範囲で枠に合わせて出す。足元を枠の下・まんなかにそろえる
//   ★絵によって周りの透明な余白がちがい(着替えの絵など)、object-contain のままだと小さく左下に出る子がいた(2026-10-24 カゲあつくん)
const CARD_ART_BOX_CACHE = {};
const cardArtBox = (src) => new Promise((resolve) => {
  if (CARD_ART_BOX_CACHE[src]) { resolve(CARD_ART_BOX_CACHE[src]); return; }
  const img = new Image();
  img.onload = () => {
    try {
      const nw = img.naturalWidth, nh = img.naturalHeight;
      const k = Math.min(1, 256 / Math.max(nw, nh));
      const w = Math.max(1, Math.round(nw * k)), h = Math.max(1, Math.round(nh * k));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, w, h);
      const d = cx.getImageData(0, 0, w, h).data;
      // 列・行ごとに透明でない点を数え、3点以上ある所だけを範囲にする(絵の端にぽつんと残った点で範囲が広がらないように)
      const col = new Array(w).fill(0), row = new Array(h).fill(0);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { col[x] += 1; row[y] += 1; }
      const MIN = 3;
      let x0 = col.findIndex((n) => n >= MIN), y0 = row.findIndex((n) => n >= MIN);
      let x1 = w - 1 - [...col].reverse().findIndex((n) => n >= MIN), y1 = h - 1 - [...row].reverse().findIndex((n) => n >= MIN);
      if (x0 < 0 || y0 < 0) { x1 = -1; }
      const box = x1 < 0 ? { nw, nh, x: 0, y: 0, w: nw, h: nh } : { nw, nh, x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };
      CARD_ART_BOX_CACHE[src] = box; resolve(box);
    } catch (_) { resolve(null); }
  };
  img.onerror = () => resolve(null);
  img.src = src;
});
const CardAssistantArt = ({ src, alt, className = '' }) => {
  const ref = useRef(null);
  const [fit, setFit] = useState(null);
  useEffect(() => {
    let alive = true;
    setFit(null);
    void cardArtBox(src).then((box) => {
      const el = ref.current;
      if (!alive || !box || !el) return;
      const W = el.clientWidth, H = el.clientHeight;
      if (!W || !H) return;
      const sc = Math.min(H / box.h, W / box.w);
      setFit({ width: box.nw * sc, left: W / 2 - (box.x + box.w / 2) * sc, top: H - (box.y + box.h) * sc, artH: Math.round(box.h * sc), artW: Math.round(box.w * sc) });
    });
    return () => { alive = false; };
  }, [src]);
  return (
    <div ref={ref} data-card-assistant-art data-card-art-h={fit ? fit.artH : undefined} data-card-art-w={fit ? fit.artW : undefined} className={`relative shrink-0 overflow-hidden ${className}`}>
      {fit
        ? <img src={src} alt={alt} draggable={false} className="absolute max-w-none" style={{ width: `${fit.width}px`, left: `${fit.left}px`, top: `${fit.top}px` }}/>
        : <img src={src} alt={alt} draggable={false} className="h-full w-full object-contain object-bottom"/>}
    </div>
  );
};

// onQuickLoops(loops) … 1戦ぶんをクイック周回の周回クリアとして配る(60-app の awardBackQuickLoops)。配れたら配った中身、配れなければ null
const CardBattleScreen = ({ screen, onNavigate, onExit, exitLabel = '戻る', seenStoryIds = [], debug = false, onBgm, onQuickLoops }) => {
  const db = typeof CARD_BATTLE_DATA !== 'undefined' ? CARD_BATTLE_DATA : null;
  const [save, setSave] = useState(null);
  const [view, setView] = useState('top');
  const [kitPick, setKitPick] = useState(null);
  const [foe, setFoe] = useState({ who: 'mua', level: 'easy' });
  const [game, setGame] = useState(null);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [detail, setDetail] = useState(null);
  const [demoWho, setDemoWho] = useState('mua'); // デバッグの「結果の見本」の相手
  const press = useCardLongPress((no) => setDetail(no));

  const load = async () => {
    const K = CARD_SAVE_KEYS;
    const [collection, decks, point, starter, daily, record, unlocked, tutorial] = await Promise.all([
      storeGet(K.collection, null), storeGet(K.decks, null), storeGet(K.point, null), storeGet(K.starter, null),
      storeGet(K.daily, null), storeGet(K.record, null), storeGet(K.cpuUnlocked, null), storeGet(K.tutorial, null),
    ]);
    const next = {
      collection: cardNormalizeCollection(collection), decks: cardNormalizeDecks(decks), point: cardNormalizePoint(point),
      starter: cardNormalizeStarter(starter), daily: cardNormalizeDaily(daily, cardTodayJst()), record: cardNormalizeRecord(record),
      unlocked: cardNormalizeCpuUnlocked(unlocked), tutorial: cardNormalizeTutorial(tutorial),
    };
    setSave(next);
    if (!next.starter) setView('starter');
    return next;
  };
  useEffect(() => { void load(); }, []);
  // 対戦の画面から外へ出たら(戻るなど)、トップに戻す
  useEffect(() => { if (screen === 'CARD_TOP' && game && !result) setGame(null); }, [screen]);

  // 保存はまとめて1つの取引で(失敗したら全部戻す)
  const persist = async (patch) => {
    const K = CARD_SAVE_KEYS;
    const entries = Object.entries(patch).map(([k, next]) => ({ key: K[k], next, before: save[k] === undefined ? null : save[k] }));
    const ok = await saveStoredValuesOrRollback(entries, storeGet, storeSet);
    if (ok) setSave((cur) => ({ ...cur, ...patch }));
    return ok;
  };

  if (!db) return <div data-mh-screen className={SCREEN_SHELL_CLASS}><ScreenHead title="MFバトルカード" onBack={onExit}/><ScreenEmpty emoji="🃏" lines={['カードのデータを読み込めませんでした']}/></div>;
  if (!save) return <div data-mh-screen className={SCREEN_SHELL_CLASS}><ScreenHead title="MFバトルカード" onBack={onExit}/><ScreenEmpty emoji="⏳" lines={['読み込み中…']}/></div>;

  if (screen === 'CARD_BATTLE' && game) {
    return <CardBattleBoard key={game.key} db={db} game={game} onFinish={async ({ outcome, st }) => {
      if (game.tutorial) {
        // 練習試合: 終えた・飛ばしたの印と、はじめて最後までやったときだけカードポイント 100(1日の上限とは別)
        const fin = cardTutorialFinish(save.tutorial, outcome === 'tutorialDone' ? 'done' : 'skip', Date.now());
        const ok = await persist({ tutorial: fin.tutorial, point: save.point + fin.reward });
        setResult({ tutorial: true, done: outcome === 'tutorialDone', reward: ok ? fin.reward : 0, saved: ok });
        onBgm && onBgm(null);
        onNavigate('CARD_TOP');
        setView('result');
        return;
      }
      // 自分の番の数・倒した数で決める(かかった時間は見ない)。案A・台帳 #3484
      const facts = cardResultFacts(st, CARD_ME);
      const reward = cardCpuReward(cardNormalizeDaily(save.daily, cardTodayJst()), game.level, outcome, facts);
      const loops = cardCpuLoops(game.level, outcome, facts);
      const rec = cardNormalizeRecord(save.record);
      const nextRecord = {
        ...rec,
        cpu: { ...rec.cpu, [outcome]: rec.cpu[outcome] + 1 },
        beaten: outcome === 'win' ? { ...rec.beaten, [game.who]: true } : rec.beaten,
        recent: [{ at: Date.now(), who: game.who, level: game.level, outcome }, ...rec.recent].slice(0, 30),
      };
      const nextUnlocked = outcome === 'win' ? cardUnlockAfterWin(save.unlocked, game.level) : save.unlocked;
      const opened = CARD_LEVEL_ORDER.find((lv) => nextUnlocked[lv] && !save.unlocked[lv]) || null;
      const ok = await persist({ point: save.point + reward.total, daily: reward.daily, record: nextRecord, unlocked: nextUnlocked });
      // クイック周回ぶん: 周回クリア扱いにするのは、ビートと同じく、AUTO設定のクイックの難易度を通したことがある人だけ(配る側が決める)
      let quick = null;
      if (loops > 0 && onQuickLoops) { try { quick = await onQuickLoops(loops); } catch (_) { quick = null; } }
      setResult({ outcome, reward, opened, saved: ok, who: game.who, level: game.level, loops, quick, facts });
      onBgm && onBgm(null);
      onNavigate('CARD_TOP');
      setView('result');
    }}/>;
  }

  const allAssistants = typeof ASSISTANTS !== 'undefined' ? ASSISTANTS : [];
  const foes = (debug ? allAssistants : assistantsUnlockedFrom(seenStoryIds)).filter((a) => CARD_AI_HABITS[a.id]);
  const activeDeck = save.decks.decks.find((d) => d.id === save.decks.active) || save.decks.decks[0] || null;
  const deckIssues = activeDeck ? cardDeckProblems(db, activeDeck) : ['デッキがありません'];
  const btn = 'mh-button min-h-[52px] w-full rounded-2xl font-black active:scale-[.98] disabled:opacity-40';

  // 練習試合(チュートリアル)を始める。相手はみゅあ・デッキはドラが貸す(選んだスターターとは別)
  const startTutorial = () => {
    setResult(null);
    setGame({ key: `tutorial-${Date.now()}`, st: cardTutorialGame(db), who: 'mua', level: 'easy', tutorial: true });
    onBgm && onBgm(CARD_AI_BGM.mua);
    onNavigate('CARD_BATTLE');
  };
  const startBattle = (pick = foe) => {
    if (!activeDeck || deckIssues.length) { setNotice(deckIssues.join('・')); return; }
    const cpuDeck = cardAiBuildDeck(db, pick.who, pick.level);
    const seed = (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    const first = Math.random() < 0.5 ? CARD_ME : CARD_CPU;
    const assistant = allAssistants.find((a) => a.id === pick.who);
    const st = cardCreateGame(db, { decks: [{ monsters: activeDeck.monsters, cards: activeDeck.cards }, cpuDeck], names: ['あなた', assistant ? assistant.name : 'あいて'], seed, first });
    setResult(null);
    setGame({ key: `${seed}`, st, who: pick.who, level: pick.level });
    onBgm && onBgm(CARD_AI_BGM[pick.who] || null);
    onNavigate('CARD_BATTLE');
  };

  // ---- スターター選び(一度きり) ----
  if (view === 'starter') {
    const kits = Object.values(db.starters);
    const pick = kitPick ? db.starters[kitPick] : null;
    return (
      <div data-mh-screen data-card-top="starter" className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="スターターをえらぶ" accent="text-amber-200" onBack={save.starter ? () => setView('top') : onExit} note="最初の1つは無料。えらばなかった2つは、あとでカードポイントで買えます"/>
        <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
          {kits.map((k) => (
            <button key={k.id} type="button" data-card-kit={k.id} onClick={() => { Audio_.se.tap(); setKitPick(k.id); }} className={`w-full rounded-2xl border-2 p-2 text-left ${kitPick === k.id ? 'border-amber-300 bg-amber-500/15' : 'border-white/10 bg-slate-900/70'}`}>
              <div className="text-[15px] font-black text-white">{k.name}</div>
              <div className="mt-1 flex gap-1.5">{k.monsters.map((no) => <img key={no} src={CARD_IMG(cardMonsterOf(db, no).img)} alt={cardMonsterOf(db, no).name} className="w-[27%] rounded-md"/>)}</div>
              <div className="mt-1 text-[12px] font-bold text-slate-300">{k.monsters.map((no) => cardMonsterOf(db, no).name).join('・')} と技カード50枚</div>
            </button>
          ))}
        </div>
        <div className={SCREEN_FOOTER_CLASS}>
          <button type="button" disabled={!pick} className={`${btn} mh-button-primary`} onClick={async () => {
            const g = cardGrantStarter(db, save, kitPick, Date.now());
            if (!g) { setNotice('スターターはもう受け取っています'); setView('top'); return; }
            const ok = await persist(g);
            setNotice(ok ? `「${pick.name}」を受け取りました。カードポイント${CARD_STARTER_POINT}もいっしょに！` : '保存できませんでした。もう一度お試しください');
            if (ok) { setView('top'); if (!save.tutorial.done && !save.tutorial.skipped) startTutorial(); }
          }}>{pick ? `「${pick.name}」にする` : 'キットをえらんでください'}</button>
        </div>
      </div>
    );
  }

  // ---- 相手えらび(助手・難易度) ----
  if (view === 'foe') {
    const a = allAssistants.find((x) => x.id === foe.who) || foes[0];
    const line = a ? cardPickLine(a.id, 'challenge', null, () => 0.0) : null;
    return (
      <div data-mh-screen data-card-top="foe" className={SCREEN_SHELL_CLASS}>
        <ScreenHead title="コンピューター戦" accent="text-amber-200" onBack={() => setView('top')} note="相手の助手と強さをえらびます"/>
        <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
          <div className="grid grid-cols-3 gap-1.5">
            {foes.map((x) => (
              <button key={x.id} type="button" data-card-foe={x.id} onClick={() => { Audio_.se.tap(); setFoe((f) => ({ ...f, who: x.id })); }} className={`relative flex flex-col items-center rounded-xl border-2 p-1 ${foe.who === x.id ? 'bg-white/10' : 'border-white/10 bg-slate-900/70'}`} style={foe.who === x.id ? { borderColor: x.accent } : undefined}>
                <img src={assistantFaceImage(x, 'normal')} alt={x.name} className="h-[52px] w-[52px] rounded-lg object-cover object-top"/>
                <span className="text-[13px] font-black">{x.name}</span>
                {save.record.beaten[x.id] && <span className="absolute right-1 top-1 rounded bg-amber-400 px-1 text-[10px] font-black text-slate-900">勝</span>}
              </button>
            ))}
          </div>
          {a && (
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-2">
              <CardAssistantArt src={assistantFullImage(a, 'wink')} alt={a.name} className="h-[150px] w-[42%]"/>
              <div className="min-w-0 flex-1 pb-2">
                <div className="text-[11px] font-bold text-slate-400">{a.tagline}</div>
                <div className="mt-1 rounded-2xl border-2 bg-white px-2 py-1 text-[13px] font-extrabold leading-snug text-[#1f1333]" style={{ borderColor: a.accent, ...JA_WRAP_STYLE }}>{line ? line.text : ''}</div>
              </div>
            </div>
          )}
          <ScreenSectionLabel note="勝つと次の強さが開きます">強さ</ScreenSectionLabel>
          <div className="grid grid-cols-5 gap-1">
            {CARD_LEVEL_ORDER.map((lv) => {
              const open = cardLevelOpen(save.unlocked, lv) || debug;
              return (
                <button key={lv} type="button" data-card-level={lv} disabled={!open} onClick={() => { Audio_.se.tap(); setFoe((f) => ({ ...f, level: lv })); }} className={`min-h-[52px] rounded-xl border-2 text-[11px] font-black ${foe.level === lv ? 'border-amber-300 bg-amber-500/20 text-amber-100' : 'border-white/10 bg-slate-900 text-slate-200'} disabled:opacity-35`}>
                  {CARD_LEVEL_LABEL[lv]}<span className="block text-[10px] text-amber-200">{open ? `勝ち${CARD_AI_LEVELS[lv].point}` : '🔒'}</span>
                </button>
              );
            })}
          </div>
          {debug && <p className="text-[11px] font-bold text-slate-400">(デバッグ: まだ開いていない強さも選べます。開いた印は勝ったときだけ付きます)</p>}
          <div className={SCREEN_PANEL_FLAT_CLASS}>
            <div className="text-[12px] font-bold text-slate-300">使うデッキ: <b className="text-white">{activeDeck ? activeDeck.name : 'なし'}</b></div>
            {deckIssues.length > 0 && <div className="mt-1 text-[12px] font-bold text-rose-300">{deckIssues.join('・')}</div>}
            <div className="mt-1 text-[11px] font-bold text-slate-400">今日もらったカードポイント(コンピューター戦): {save.daily.cpuPoint} / {CARD_CPU_DAILY_MAX}{save.daily.firstWin ? '' : '・今日はじめての勝ちで +50'}</div>
          </div>
          {notice && <p className="text-[12px] font-bold text-amber-200">{notice}</p>}
        </div>
        <div className={SCREEN_FOOTER_CLASS}>
          <button type="button" data-card-start className={`${btn} mh-button-primary`} disabled={!a || deckIssues.length > 0} onClick={() => startBattle(foe)}>対戦する</button>
        </div>
      </div>
    );
  }

  // ---- 結果 ----
  if (view === 'result' && result && result.tutorial) {
    return (
      <div data-mh-screen data-card-top="result" data-card-outcome={result.done ? 'tutorialDone' : 'tutorialSkip'} className={SCREEN_SHELL_CLASS}>
        <ScreenHead title={result.done ? '練習試合クリア！' : '練習試合を飛ばしました'} accent="text-amber-200" onBack={() => setView('top')}/>
        <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
          <div className={SCREEN_PANEL_CLASS}>
            {result.done && result.reward > 0 && <div className="text-[15px] font-black text-amber-200">カードポイント {result.reward}</div>}
            <div className="mt-1 text-[12px] font-bold text-slate-300">{result.done ? 'これで5つ全部です。いろんな相手と戦ってみましょう' : 'トップの「練習試合」から、いつでもできます'}</div>
            <div className="mt-1 text-[12px] font-bold text-slate-300">いまのカードポイント: {save.point}</div>
            {!result.saved && <div className="mt-1 text-[12px] font-bold text-rose-300">保存できませんでした</div>}
          </div>
        </div>
        <div className={SCREEN_FOOTER_CLASS}>
          <button type="button" className={`${btn} mh-button-primary`} onClick={() => setView('top')}>トップへ</button>
        </div>
      </div>
    );
  }
  if (view === 'result' && result) {
    const a = allAssistants.find((x) => x.id === result.who);
    const win = result.outcome === 'win';
    const line = a ? cardPickLine(a.id, win ? 'lose' : 'win', null) : null; // 助手から見た勝ち負け
    const r = result.reward;
    return (
      <div data-mh-screen data-card-top="result" data-card-outcome={result.outcome} data-card-gain={result.demo ? undefined : r.total} className={SCREEN_SHELL_CLASS}>
        <ScreenHead title={win ? '勝ち！' : result.outcome === 'surrender' ? '投了' : '負け…'} accent={win ? 'text-amber-200' : 'text-slate-300'} onBack={() => setView('top')}/>
        <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
          {a && (
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-2">
              <CardAssistantArt src={assistantFullImage(a, line ? line.face : 'normal')} alt={a.name} className="h-[220px] w-[46%]"/>
              <div className="mb-2 min-w-0 flex-1 rounded-2xl border-2 bg-white px-2 py-1 text-[13px] font-extrabold leading-snug text-[#1f1333]" style={{ borderColor: a.accent, ...JA_WRAP_STYLE }}>{line ? line.text : ''}</div>
            </div>
          )}
          <div className={SCREEN_PANEL_CLASS}>
            <div className="text-[13px] font-black text-amber-200">もらったカードポイント: {r.total}</div>
            <div className="mt-1 text-[12px] font-bold text-slate-300">{CARD_LEVEL_LABEL[result.level]}の{win ? '勝ち' : result.outcome === 'lose' ? '負け' : '投了'}: {r.got}{r.capped ? `(今日の上限${CARD_CPU_DAILY_MAX}に届きました)` : ''}</div>
            {r.bonus > 0 && <div className="text-[12px] font-bold text-slate-300">今日はじめての勝ち: +{r.bonus}</div>}
            {r.short && <div className="mt-1 text-[12px] font-bold text-slate-400">自分の番を3回やる前に終わったので、カードポイントとクイック周回は入りません</div>}
            {!r.short && result.loops > 0 && (
              <div data-card-quick-loops={result.quick ? result.loops : 0} className="mt-2 rounded-xl border border-sky-300/40 bg-sky-500/10 px-2 py-1.5">
                {result.quick
                  ? <>
                    <div className="text-[13px] font-black text-sky-200">クイック周回 {result.loops}周ぶん</div>
                    <div className="mt-0.5 text-[11px] font-bold text-slate-300" style={JA_WRAP_STYLE}>裏のクイック周回({(result.quick.quickDifficulty && quickDifficultySetting(result.quick.quickDifficulty)?.label) || 'AUTO設定'})が{result.loops}周ぶん進みました</div>
                  </>
                  : <div className="text-[12px] font-bold text-slate-300">クイック周回をしていないときは入りません</div>}
              </div>
            )}
            <div className="mt-1 text-[12px] font-bold text-slate-300">いまのカードポイント: {save.point}</div>
            {result.opened && <div className="mt-1 text-[13px] font-black text-emerald-300">{CARD_LEVEL_LABEL[result.opened]}が選べるようになりました！</div>}
            {!result.saved && <div className="mt-1 text-[12px] font-bold text-rose-300">保存できませんでした(カードポイントは増えていません)</div>}
            {result.demo && <div className="mt-1 text-[11px] font-bold text-slate-400">(デバッグの見本です。何も保存していません)</div>}
          </div>
        </div>
        <div className={`${SCREEN_FOOTER_CLASS} grid grid-cols-2 gap-2`}>
          <button type="button" className={`${btn} mh-button-primary`} onClick={() => { const again = { who: result.who, level: result.level }; setFoe(again); startBattle(again); }}>もう一度</button>
          <button type="button" className={`${btn} mh-button-secondary border border-white/20 bg-slate-800`} onClick={() => setView('foe')}>相手をえらぶ</button>
        </div>
      </div>
    );
  }

  // ---- トップ ----
  const soon = (label) => <button type="button" disabled className={`${btn} border border-white/10 bg-slate-900 text-slate-400`}>{label}<span className="block text-[10px] font-bold">つぎの区切りで作ります</span></button>;
  return (
    <div data-mh-screen data-card-top="top" className={SCREEN_SHELL_CLASS}>
      <ScreenHead title="MFバトルカード" accent="text-amber-200" onBack={onExit} backLabel={exitLabel} note={debug ? 'デバッグ専用(まだ公開していません)' : ''}/>
      <div className={`${SCREEN_LIST_CLASS} space-y-2 pb-4`}>
        <div className={`${SCREEN_PANEL_CLASS} flex items-center justify-between`}>
          <div className="text-[13px] font-black text-slate-200">カードポイント</div>
          <div data-card-point className="text-xl font-black text-amber-200">{save.point}</div>
        </div>
        {activeDeck && (
          <div className={SCREEN_PANEL_CLASS}>
            <div className="text-[12px] font-bold text-slate-400">いまのデッキ</div>
            <div className="text-[14px] font-black text-white">{activeDeck.name}</div>
            <div className="mt-1 flex gap-1.5">{activeDeck.monsters.map((no) => { const m = cardMonsterOf(db, no); return m ? <img key={no} {...press(no)} src={CARD_IMG(m.img)} alt={m.name} className="w-[22%] rounded-md"/> : null; })}</div>
            <div className="mt-1 text-[11px] font-bold text-slate-400">戦績(コンピューター戦): {save.record.cpu.win}勝 {save.record.cpu.lose}敗{save.record.cpu.surrender ? `・投了${save.record.cpu.surrender}` : ''}</div>
          </div>
        )}
        {notice && <p className="text-[12px] font-bold text-amber-200">{notice}</p>}
        <button type="button" data-card-cpu className={`${btn} mh-button-primary`} disabled={!activeDeck} onClick={() => { Audio_.se.tap(); setNotice(''); setView('foe'); }}>コンピューター戦</button>
        <div className="grid grid-cols-2 gap-2">{soon('デッキ編成')}{soon('マーケットへ')}{soon('カード図鑑')}
          {/* ルールの画面ができるまでは、練習試合(チュートリアル)の入口をここに置く(設計書 7-4「もう一度できる」) */}
          <button type="button" data-card-tutorial-again className={`${btn} border border-emerald-300/50 bg-emerald-900/60 text-emerald-50`} onClick={() => { Audio_.se.tap(); startTutorial(); }}>練習試合<span className="block text-[10px] font-bold">ドラが教えるチュートリアル</span></button>
        </div>
        {debug && (
          <div className={`${SCREEN_PANEL_FLAT_CLASS} space-y-1`}>
            {/* 結果の画面の見本(NORMAL の勝ち・自分の番8回・2体倒した)。クイック周回が入るとき/入らないとき。保存は何もしない */}
            <select data-card-result-demo-who value={demoWho} onChange={(e) => setDemoWho(e.target.value)} className="w-full rounded-lg border border-white/20 bg-slate-800 px-2 py-1 text-[12px] font-bold text-white">
              {allAssistants.filter((x) => CARD_AI_HABITS[x.id]).map((x) => <option key={x.id} value={x.id}>見本の相手: {x.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-1">
              {[['in', '結果の見本(周回が入る)'], ['out', '結果の見本(入らない)']].map(([k, label]) => (
                <button key={k} type="button" data-card-result-demo={k} className="mh-button mh-button-secondary min-h-[40px] rounded-xl border border-white/20 bg-slate-800 text-[11px] font-black" onClick={() => {
                  const facts = { ownTurns: 8, kos: 2 };
                  const reward = cardCpuReward(cardNormalizeDaily(null, cardTodayJst()), 'normal', 'win', facts);
                  setResult({ demo: true, outcome: 'win', reward, opened: null, saved: true, who: demoWho, level: 'normal', loops: cardCpuLoops('normal', 'win', facts), quick: k === 'in' ? { quickDifficulty: 'Normal' } : null, facts });
                  setView('result');
                }}>{label}</button>
              ))}
            </div>
            <div className="text-[11px] font-bold text-slate-400">デバッグ: カードバトルの記録(mh_card_* の新しいキーだけ)</div>
            <button type="button" data-card-motion-demo className="mh-button mh-button-secondary min-h-[44px] w-full rounded-xl border border-white/20 bg-slate-800 text-[12px] font-black" onClick={() => {
              // 技の動きの見本(決まった順に自動で進む。保存は何もしない)
              const demo = cardMotionDemo(db);
              setResult(null);
              setGame({ key: `demo-${Date.now()}`, st: demo.st, who: 'mua', level: 'easy', demo: { steps: demo.steps } });
              onBgm && onBgm(CARD_AI_BGM.mua);
              onNavigate('CARD_BATTLE');
            }}>技の動きの見本を流す(保存しない)</button>
            <button type="button" className="mh-button mh-button-danger min-h-[44px] w-full rounded-xl text-[12px] font-black" onClick={() => setConfirmReset(true)}>カードバトルの記録を消して、スターター選びからやり直す</button>
          </div>
        )}
      </div>
      {detail && <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)}/>}
      {confirmReset && <ConfirmSheet title="カードバトルの記録を消しますか？" message={'持っているカード・デッキ・カードポイント・戦績・スターターの印を消します。\nほかのモードの保存データには触れません。'} confirmLabel="消す" danger onCancel={() => setConfirmReset(false)} onConfirm={async () => {
        setConfirmReset(false);
        await Promise.all(Object.values(CARD_SAVE_KEYS).map((k) => storeSet(k, null)));
        setNotice('');
        await load();
      }}/>}
    </div>
  );
};
