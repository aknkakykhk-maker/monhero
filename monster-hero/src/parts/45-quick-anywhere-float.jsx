// ===== 裏クイック(どこでも回す)の小さな帯の置き場所(2026-11-11) =====
// テスターいちか「転生のすべて選択ボタンと被るから右下にしてほし〜」。
// 帯は画面の隅に浮かせて置く(画面の高さを取らない)。右下を第一にするが、その画面のボタンにかかるときは、
// 空いている所へ移す。探す順: 右の端を下から上へ(6pxずつ・画面の高さの6割まで)→ 左の端を下から上へ。どこも空いていなければ右下のまま。
// 2026-11-12 社長「裏クイックがスクロールで変な動きしたりするから邪魔にならない位置に固定で置いてほしい」:
//   前は0.8秒ごとに置き直していたので、スクロールでボタンが帯の下を通るたびに帯が右→上→左へ跳ねた。
//   いまは置き場所を決めるのは「画面が変わったとき(中身が遅れて出る画面のため 0.3秒・1.2秒後にもう一度)」と「画面の向き・大きさが変わったとき」だけ。
//   その画面にいる間は、スクロールしても動かさない。画面ごとの最初の候補は QUICK_ANYWHERE_FLOAT_SIDES(既定は右下)。
//   同じ画面でも縦・横で隅のボタンが違う(横小の HOME は右下に「ギフト」)ので、最初の候補がふさがっているときだけ、入った瞬間に限って空いている所を探す。
//   0.8秒ごとに見るのは「下から出るシート・確認の窓がかぶったか」だけ(置いたときに無かったボタンにかかったら隠し、外れたら同じ場所に戻す。動かさない)。
//   帯は少し透かして、下のものを隠しにくくする(見た目だけ。周回の動きには触らない)。
// tools/battle/quick-run-anywhere-strip-overlap-check.js が、縦・横・横小でほかのボタンと重ならないことを見る。
const QUICK_ANYWHERE_FLOAT_STEP = 6;
const QUICK_ANYWHERE_FLOAT_MAX_LIFT = 0.6;
// 画面ごとの最初の候補の隅(書いていない画面は右下)。神殿は横向きで右半分がスクロールする一覧なので左下
const QUICK_ANYWHERE_FLOAT_SIDES = Object.freeze({ TEMPLE: 'left' });
const quickAnywhereFloatStyle = (spot) => {
  const s = spot.hidden ? { visibility: 'hidden', pointerEvents: 'none' } : { opacity: 0.86 };
  Object.assign(s, { position: 'fixed', bottom: `max(${8 + spot.lift}px, calc(var(--mh-sa-bottom, 0px) + ${6 + spot.lift}px))` });
  if (spot.side === 'right') s.right = 'max(8px, calc(var(--mh-sa-right, 0px) + 6px))';
  else s.left = 'max(8px, calc(var(--mh-sa-left, 0px) + 6px))';
  return s;
};
// そこに置いたときの帯の四角(画面の座標)
const quickAnywhereFloatRect = (el, spot) => {
  const w = el.offsetWidth || 70, h = el.offsetHeight || 34;
  const css = getComputedStyle(document.documentElement);
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const saB = num(css.getPropertyValue('--mh-sa-bottom')), saL = num(css.getPropertyValue('--mh-sa-left')), saR = num(css.getPropertyValue('--mh-sa-right'));
  const bottom = Math.max(8 + spot.lift, saB + 6 + spot.lift);
  const top = window.innerHeight - bottom - h;
  const left = spot.side === 'right' ? window.innerWidth - Math.max(8, saR + 6) - w : Math.max(8, saL + 6);
  const R = { left, top, right: left + w, bottom: top + h };
  return R;
};
// そこに置いたとき、ほかの押せるもの(button・a・[role=button])にかかるか。自分と、自分の詳細の窓は数えない。known に入っているもの(置いたときからあったもの)も数えない
const quickAnywhereFloatHits = (el, spot, known = null) => {
  if (typeof document === 'undefined' || !el) return 0;
  const R = quickAnywhereFloatRect(el, spot);
  let hits = 0;
  for (const o of document.querySelectorAll('button,a,[role=button]')) {
    if (o === el || el.contains(o) || o.contains(el) || o.closest('[data-quick-anywhere-detail]') || !o.getClientRects().length) continue;
    if (known && known.has(o)) continue;
    const cs = getComputedStyle(o);
    if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || Number(cs.opacity) === 0) continue;
    const r = o.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (Math.min(R.right, r.right) - Math.max(R.left, r.left) > 1 && Math.min(R.bottom, r.bottom) - Math.max(R.top, r.top) > 1) hits++;
  }
  return hits;
};
const quickAnywhereFloatPick = (el, screen) => {
  const first = QUICK_ANYWHERE_FLOAT_SIDES[screen] === 'left' ? 'left' : 'right';
  const sides = first === 'left' ? ['left', 'right'] : ['right', 'left'];
  // まず隅そのもの(持ち上げない)を、最初の候補→反対の順に見る
  for (const side of sides) { const spot = { side, lift: 0 }; if (quickAnywhereFloatHits(el, spot) === 0) return spot; }
  const maxLift = Math.max(0, Math.floor(((typeof window !== 'undefined' ? window.innerHeight : 0) * QUICK_ANYWHERE_FLOAT_MAX_LIFT) / QUICK_ANYWHERE_FLOAT_STEP)) * QUICK_ANYWHERE_FLOAT_STEP;
  for (const side of sides) {
    for (let lift = QUICK_ANYWHERE_FLOAT_STEP; lift <= maxLift; lift += QUICK_ANYWHERE_FLOAT_STEP) {
      const spot = { side, lift };
      if (quickAnywhereFloatHits(el, spot) === 0) return spot;
    }
  }
  // どこも空いていない(下から出るシート・確認の窓が画面を覆っている)ときは、ボタンの字を隠さないよう帯を隠す。閉じたら置き直して出る
  return { side: first, lift: 0, hidden: true };
};
// screen … いまの gameState(変わったら置き直す)。children … 帯のボタンの中身。ほかの props はボタンへそのまま渡す
const QuickAnywhereFloat = ({ screen, children, style, ...rest }) => {
  const ref = useRef(null);
  const [spot, setSpot] = useState({ side: QUICK_ANYWHERE_FLOAT_SIDES[screen] === 'left' ? 'left' : 'right', lift: 0 });
  // 置き場所を決めたときに画面にあったボタン(スクロールで帯の下を通っても、これらでは動かさない・隠さない)
  const knownRef = useRef(new WeakSet());
  const placedRef = useRef(null);
  React.useLayoutEffect(() => {
    // 決めた場所にかかっているもの(画面を覆うシートなど)は入れない。かかっている間は隠し、どいたら出す
    const remember = (base) => { const set = new WeakSet(); const el = ref.current; if (typeof document !== 'undefined' && el) { const R = quickAnywhereFloatRect(el, base); for (const o of document.querySelectorAll('button,a,[role=button]')) { const r = o.getBoundingClientRect(); if (!(Math.min(R.right, r.right) - Math.max(R.left, r.left) > 1 && Math.min(R.bottom, r.bottom) - Math.max(R.top, r.top) > 1)) set.add(o); } } knownRef.current = set; };
    // 決める(画面が変わったとき・向きや大きさが変わったときだけ)
    const decide = () => { if (!ref.current) return; const next = quickAnywhereFloatPick(ref.current, screen); const base = { side: next.side, lift: next.lift }; placedRef.current = { ...base, fromHidden: !!next.hidden }; remember(base); setSpot(next.hidden ? { ...base, hidden: true } : base); };
    // シート・確認の窓がかぶったかだけを見る。置いたときに無かったボタンにかかったら隠し、外れたら同じ場所に戻す(場所は変えない)
    // どこも空いていなくて隠れたとき(覆うシートが出ている最中に決めたとき)だけは、隠れたまま決め直す(見えている帯は動かさない)
    const watch = () => { const el = ref.current, placed = placedRef.current; if (!el || !placed) return; if (placed.fromHidden) { decide(); return; } const base = { side: placed.side, lift: placed.lift }; const covered = quickAnywhereFloatHits(el, base, knownRef.current) > 0;
      setSpot(prev => (!!prev.hidden === covered && prev.side === base.side && prev.lift === base.lift ? prev : covered ? { ...base, hidden: true } : base)); };
    decide();
    const t1 = setTimeout(decide, 300), t2 = setTimeout(decide, 1200), iv = setInterval(watch, 800);
    let rt = null; const onResize = () => { clearTimeout(rt); rt = setTimeout(decide, 250); };
    if (typeof window !== 'undefined') window.addEventListener('resize', onResize);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(rt); clearInterval(iv); if (typeof window !== 'undefined') window.removeEventListener('resize', onResize); };
  }, [screen]);
  return <button ref={ref} type="button" data-quick-anywhere-spot={spot.hidden ? 'hidden' : `${spot.side}-${spot.lift}`} {...rest} style={{ ...(style || {}), ...quickAnywhereFloatStyle(spot) }}>{children}</button>;
};
