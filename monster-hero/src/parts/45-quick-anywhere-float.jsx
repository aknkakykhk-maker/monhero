// ===== 裏クイック(どこでも回す)の小さな帯の置き場所(2026-11-11) =====
// テスターいちか「転生のすべて選択ボタンと被るから右下にしてほし〜」。
// 帯は画面の隅に浮かせて置く(画面の高さを取らない)。右下を第一にするが、その画面のボタンにかかるときは、
// 空いている所へ移す。探す順: 右の端を下から上へ(6pxずつ・画面の高さの6割まで)→ 左の端を下から上へ。どこも空いていなければ右下のまま。
// 画面が変わったとき・中身が遅れて出たとき・0.8秒ごとに置き直す(見た目だけ。周回の動きには触らない)。
// tools/battle/quick-run-anywhere-strip-overlap-check.js が、縦・横・横小でほかのボタンと重ならないことを見る。
const QUICK_ANYWHERE_FLOAT_STEP = 6;
const QUICK_ANYWHERE_FLOAT_MAX_LIFT = 0.6;
const quickAnywhereFloatStyle = (spot) => {
  const s = { position: 'fixed', bottom: `max(${8 + spot.lift}px, calc(var(--mh-sa-bottom, 0px) + ${6 + spot.lift}px))` };
  if (spot.side === 'right') s.right = 'max(8px, calc(var(--mh-sa-right, 0px) + 6px))';
  else s.left = 'max(8px, calc(var(--mh-sa-left, 0px) + 6px))';
  return s;
};
// そこに置いたとき、ほかの押せるもの(button・a・[role=button])にかかるか。自分と、自分の詳細の窓は数えない
const quickAnywhereFloatHits = (el, spot) => {
  if (typeof document === 'undefined' || !el) return 0;
  const w = el.offsetWidth || 70, h = el.offsetHeight || 34;
  const css = getComputedStyle(document.documentElement);
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const saB = num(css.getPropertyValue('--mh-sa-bottom')), saL = num(css.getPropertyValue('--mh-sa-left')), saR = num(css.getPropertyValue('--mh-sa-right'));
  const bottom = Math.max(8 + spot.lift, saB + 6 + spot.lift);
  const top = window.innerHeight - bottom - h;
  const left = spot.side === 'right' ? window.innerWidth - Math.max(8, saR + 6) - w : Math.max(8, saL + 6);
  const R = { left, top, right: left + w, bottom: top + h };
  let hits = 0;
  for (const o of document.querySelectorAll('button,a,[role=button]')) {
    if (o === el || el.contains(o) || o.contains(el) || o.closest('[data-quick-anywhere-detail]') || !o.getClientRects().length) continue;
    const cs = getComputedStyle(o);
    if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || Number(cs.opacity) === 0) continue;
    const r = o.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (Math.min(R.right, r.right) - Math.max(R.left, r.left) > 1 && Math.min(R.bottom, r.bottom) - Math.max(R.top, r.top) > 1) hits++;
  }
  return hits;
};
const quickAnywhereFloatPick = (el) => {
  const maxLift = Math.max(0, Math.floor(((typeof window !== 'undefined' ? window.innerHeight : 0) * QUICK_ANYWHERE_FLOAT_MAX_LIFT) / QUICK_ANYWHERE_FLOAT_STEP)) * QUICK_ANYWHERE_FLOAT_STEP;
  for (const side of ['right', 'left']) {
    for (let lift = 0; lift <= maxLift; lift += QUICK_ANYWHERE_FLOAT_STEP) {
      const spot = { side, lift };
      if (quickAnywhereFloatHits(el, spot) === 0) return spot;
    }
  }
  return { side: 'right', lift: 0 };
};
// screen … いまの gameState(変わったら置き直す)。children … 帯のボタンの中身。ほかの props はボタンへそのまま渡す
const QuickAnywhereFloat = ({ screen, children, style, ...rest }) => {
  const ref = useRef(null);
  const [spot, setSpot] = useState({ side: 'right', lift: 0 });
  React.useLayoutEffect(() => {
    // いまの置き場所がまだ空いていれば動かさない(0.8秒ごとに行ったり来たりしない)
    const place = () => { if (!ref.current) return; setSpot(prev => (quickAnywhereFloatHits(ref.current, prev) === 0 ? prev : quickAnywhereFloatPick(ref.current))); };
    // 画面が変わったら、いちばん良い所(右下)から探し直す。中身が遅れて出る画面のため、少しおいてもう一度
    const fresh = () => { if (ref.current) setSpot(quickAnywhereFloatPick(ref.current)); };
    fresh();
    const t1 = setTimeout(fresh, 300), t2 = setTimeout(place, 1200), iv = setInterval(place, 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(iv); };
  }, [screen]);
  return <button ref={ref} type="button" data-quick-anywhere-spot={`${spot.side}-${spot.lift}`} {...rest} style={{ ...(style || {}), ...quickAnywhereFloatStyle(spot) }}>{children}</button>;
};
