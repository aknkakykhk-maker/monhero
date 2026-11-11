// ===== 助手マスモンの対戦 β(2026-11-11 ミセカタ2) =====
// じゅんび(おまかせ/自分で決める)→ 観戦 → 振り返り → ランキング を1つのかたまりにした画面。
// ・社長の決め(台帳 2026-11-11): 観戦はリング観戦+★見せ場だけ/振り返りは数字+もしも+関わって伸びた分/
//   ランキングはポイント順+段・週ごと/自分で決めるのは 形・3体と順番・作戦・交代の早さ(おまかせと切替)
// ・β その1 = 端末の中の対戦(相手はこの端末のほかの助手のマスモン)。ランキングは「β中は準備中」
//   β その2 = フレンド対戦+ランキング(タイセンの 56-assistant-masmon-pvp.jsx が入ってから・印 assistantMasmonBattlePvp)
// ・公開の印 assistantMasmonBattleBeta が偽のあいだ、口(Open・RowInfo)は何もしない。デバッグ設定からだけ「確かめ」で開ける(何も保存しない)
// ・計算(data/assistant-masmon-battle.js)・育成・修行の保存には書かない。戦績などはこの画面の新しいキー mh_assistant_masmon_battle_v1 だけ
// ・ランキングへは端末から何も送らない(その2でもサーバだけが書く)
// ・観戦の部品(ambwLoadEngine・ambwFramesOf・ambwIsHighlight・AmbwPanel・AMBW_CSS)は 56-assistant-masmon-battle-view.jsx を使い回す
// 作戦・交代の早さの数字: docs/progress/assistant-peer/masmon-battle/beta/STYLE-PLAN.md
const ASSISTANT_MASMON_BATTLE_KEY = 'mh_assistant_masmon_battle_v1';
const AMBB_V = 1;
// 作戦・交代の早さ: 名前だけを計算へ渡す(team.plan・team.swapPace)。倍率は計算側の表 ASSISTANT_MASMON_BATTLE.PLANS・SWAP_PACES(タタカイ #5286)。おまかせは渡さない
const AMBB_PLANS = Object.freeze([
  { id: 'omakase', label: 'おまかせ', note: '助手の考えどおり' },
  { id: 'attack', label: 'ガンガン攻める', note: '攻めを強く・守りは少なめ' },
  { id: 'guard', label: 'じっくり守る', note: 'ガードとガッツの節約を多めに' },
  { id: 'range', label: '間合いを取る', note: '得意な距離へ動く' },
  { id: 'big', label: '大技ねらい', note: '威力の大きい技を好む' },
]);
const AMBB_SWAPS = Object.freeze([
  { id: 'omakase', label: 'おまかせ' },
  { id: 'early', label: '早めに替える' },
  { id: 'late', label: 'ねばる' },
]);
// ランキングの段(台帳 2026-11-11・はじめ 1500)。その2で rating から出す
const AMBB_TIERS = Object.freeze([
  { id: 'bronze', label: 'ブロンズ', icon: '🥉', min: -Infinity },
  { id: 'silver', label: 'シルバー', icon: '🥈', min: 1450 },
  { id: 'gold', label: 'ゴールド', icon: '🥇', min: 1550 },
  { id: 'platinum', label: 'プラチナ', icon: '💠', min: 1650 },
  { id: 'diamond', label: 'ダイヤ', icon: '💎', min: 1750 },
]);
const ambbTierOf = (rating) => { const r = Number.isFinite(Number(rating)) ? Number(rating) : 1500; let t = AMBB_TIERS[0]; for (const x of AMBB_TIERS) if (r >= x.min) t = x; return t; };
const AMBB_CARE_JP = Object.freeze({ view: '見に来た', pick: '自分で決めた', ask: '相談', ranch: 'M/B管理' });

// β その2(フレンド対戦+ランキング): 印 assistantMasmonBattlePvp も真のときだけ。サーバの口(56-assistant-masmon-pvp.jsx)は表を読む口が印を見ないので、ここで必ず絞る
const ambbPvpOn = () => ambbOn() && typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantMasmonBattlePvp === true && typeof masmonPvpChallenge === 'function';
const AMBB_KINDS = Object.freeze([{ id: 'raw', label: '育ったまま', note: '育てた能力そのままで戦う' }, { id: 'fair', label: '公平', note: '能力の合計とLvをそろえて、戦い方で勝負' }]);
// 鍵が作り直されて前の登録に入れないときは、サポートへの案内(行を消すのは窓口が社長に確かめてから)
const ambbPvpReason = (reason) => (reason === 'locked' ? 'この端末では登録できません。お問い合わせ(サポート)へ連絡してください' : typeof masmonPvpReasonText === 'function' ? masmonPvpReasonText(reason) : 'うまくいきませんでした');
// 週の区切り(月曜 4:00・日本時間)の日付 'YYYY-MM-DD'
const ambbWeekOf = (now = Date.now()) => { const d = new Date(now + 9 * 3600000 - 4 * 3600000); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
// 登録に送る1体: { slot, species, name, lv, stats, techs, mastery }(熟練は覚えた技と guard・dist・swap だけ・0 は送らない)
const ambbPvpMemberOf = (u) => {
  const x = u.unit || {}, techs = Array.isArray(x.techs) && x.techs.length ? x.techs.slice() : undefined;
  const keep = new Set([...(techs || []), 'guard', 'dist', 'swap']);
  const mastery = {};
  for (const [k, v] of Object.entries(x.mastery || {})) { const n = Math.round(Number(v)); if (keep.has(k) && Number.isFinite(n) && n > 0) mastery[k] = Math.min(100, n); }
  const name = (typeof x.name === 'string' && x.name.trim()) || ((typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[x.species] && ALL_PLAYER_MONSTERS[x.species].name) || x.species);
  return { slot: u.row.slot, species: x.species, name: String(name).slice(0, 24), lv: x.lv, stats: x.stats, ...(techs ? { techs } : {}), mastery };
};
const ambbOn = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantMasmonBattleBeta === true && RELEASE_FLAGS.assistantMasmonGrow === true;

// ---------- 保存(新しいキーだけ。版の番号つき・壊れていたら既定値) ----------
const ambbInt = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d; };
const normalizeAssistantMasmonBattleSave = (raw) => {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = { v: AMBB_V, speed: 'x1', mode: {}, last: {}, rec: {}, done: [], reg: {} };
  if (typeof src.speed === 'string' && typeof AMBW_SPEEDS !== 'undefined' && AMBW_SPEEDS.some(s => s.id === src.speed)) out.speed = src.speed;
  const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
  for (const [aid, m] of Object.entries(obj(src.mode))) if (m === 'auto' || m === 'self') out.mode[aid] = m;
  for (const [aid, l] of Object.entries(obj(src.last))) {
    const x = obj(l);
    out.last[aid] = {
      size: ambbInt(x.size, 1, 3, 3),
      order: (Array.isArray(x.order) ? x.order : []).filter(k => typeof k === 'string').slice(0, 3),
      plan: AMBB_PLANS.some(p => p.id === x.plan) ? x.plan : 'omakase',
      swap: AMBB_SWAPS.some(p => p.id === x.swap) ? x.swap : 'omakase',
      foe: typeof x.foe === 'string' ? x.foe : '',
    };
  }
  for (const [aid, r] of Object.entries(obj(src.rec))) { const x = obj(r); out.rec[aid] = { w: ambbInt(x.w, 0, 1e7, 0), l: ambbInt(x.l, 0, 1e7, 0), d: ambbInt(x.d, 0, 1e7, 0) }; }
  // 同じ1戦を二度数えないための印(新しい40件だけ)
  out.done = (Array.isArray(src.done) ? src.done : []).filter(x => typeof x === 'string').slice(-40);
  // β その2: フレンドに見せる編成を登録した時刻(画面の案内に使うだけ。登録の正本はサーバ)
  for (const [aid, r] of Object.entries(obj(src.reg))) { const x = obj(r); const at = ambbInt(x.at, 0, 9e15, 0); if (at) out.reg[aid] = { at, size: ambbInt(x.size, 1, 3, 3) }; }
  return out;
};
const AMBB_STORE = { state: normalizeAssistantMasmonBattleSave(null), loaded: false, subs: new Set(),
  set(next) { this.state = next; this.subs.forEach(f => { try { f(next); } catch (_) {} }); },
  load() {
    if (this.loaded) return Promise.resolve(this.state);
    if (this._p) return this._p;
    this._p = (async () => {
      let raw = null;
      try { if (typeof storeGet === 'function') raw = await storeGet(ASSISTANT_MASMON_BATTLE_KEY, null, false); } catch (_) {}
      this.loaded = true; this.set(normalizeAssistantMasmonBattleSave(raw)); return this.state;
    })();
    return this._p;
  } };
// 読み込む前には書かない(既定値で上書きしない)。確かめ(印が偽)のときも書かない
const ambbSave = (fn) => {
  if (!AMBB_STORE.loaded || !ambbOn()) return false;
  const next = normalizeAssistantMasmonBattleSave(fn(AMBB_STORE.state));
  AMBB_STORE.set(next);
  try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_BATTLE_KEY, next, false); } catch (_) {}
  return true;
};
const useAmbbSave = () => {
  const [, tick] = useState(0);
  useEffect(() => { const f = () => tick(n => n + 1); AMBB_STORE.subs.add(f); void AMBB_STORE.load(); return () => { AMBB_STORE.subs.delete(f); }; }, []);
  return AMBB_STORE.state;
};

// ---------- 作戦の名前を計算へ ----------
// 計算の表に無い名前は渡さない(おまかせ・ふつうと同じ)
const ambbPlanOf = (engine, planId) => (planId !== 'omakase' && engine && engine.PLANS && engine.PLANS[planId] ? planId : undefined);
const ambbSwapOf = (engine, swapId) => (swapId !== 'omakase' && engine && engine.SWAP_PACES && engine.SWAP_PACES[swapId] ? swapId : undefined);

// ---------- 助手のマスモンを対戦の1体にする ----------
const ambbRowKey = (t) => `${t.slot}:${t.monster}`;
const ambbRowsOf = (aid) => {
  try { return typeof assistantMasmonRowsOf === 'function' && typeof ASSISTANT_MASMON_STORE !== 'undefined' ? assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, aid).filter(t => t && typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[t.monster]) : []; } catch (_) { return []; }
};
const ambbUnitsOf = (engine, aid, rows) => rows.map((row) => {
  const entry = typeof amgEntryOf === 'function' ? amgEntryOf(aid, row) : null;
  let train;
  try { if (typeof amgtBattleOf === 'function') train = amgtBattleOf(aid, row, entry && entry.lv); } catch (_) { train = undefined; }
  const u = engine.unitFromGrow(row, entry, train);
  return { row, entry, unit: u, total: entry && entry.st ? Object.values(entry.st).reduce((a, b) => a + (Number(b) || 0), 0) : 0 };
});
const ambbTacticsOf = (aid, rows) => { try { return typeof amgtTacticsOf === 'function' ? amgtTacticsOf(aid, rows) : 40; } catch (_) { return 40; } };
// 助手ライフの順番のまま、マスモンを持っている助手
const ambbAssistantsWithRows = () => (typeof ASSISTANT_LIST !== 'undefined' ? ASSISTANT_LIST : []).filter(a => (typeof assistantReleased !== 'function' || assistantReleased(a.id)) && ambbRowsOf(a.id).length > 0);

// ---------- 口(助手ライフの部屋・居場所「モンヒロバトル」から呼ぶ) ----------
const AMBB_HOST = { open: null, subs: new Set(), set(v) { this.open = v; this.subs.forEach(f => { try { f(v); } catch (_) {} }); } };
// 画面を開く。印が偽なら何もしない(false)。from: 'room' | 'place' | 'debug'。debug だけは印が偽でも「確かめ」で開く(保存しない)
const assistantMasmonBattleOpen = (opts = {}) => {
  const o = opts && typeof opts === 'object' ? opts : {};
  const preview = !ambbOn();
  if (preview && o.from !== 'debug') return false;
  // デバッグからだけ: 本物のサーバでフレンド対戦を1回通す(窓口の確かめ・2026-11-11)。
  //   タイセンの口は印 assistantMasmonBattlePvp を見るので、この起動のあいだだけ印を真にする(読み込み直すと偽に戻る・保存しない)
  const tryPvp = o.from === 'debug' && o.tryPvp === true && typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS;
  if (tryPvp) RELEASE_FLAGS.assistantMasmonBattlePvp = true;
  AMBB_HOST.set({ assistantId: typeof o.assistantId === 'string' ? o.assistantId : '', from: typeof o.from === 'string' ? o.from : 'room', foeAssistantId: typeof o.foeAssistantId === 'string' ? o.foeAssistantId : '', preview, tryPvp, at: Date.now() });
  return true;
};
// 「できること」の1行。印が偽なら null(ボタンを出さない)
const assistantMasmonBattleRowInfo = (assistantId) => {
  if (!ambbOn()) return null;
  const rows = ambbRowsOf(assistantId);
  const base = { label: '⚔ マスモンで対戦(β)', gain: 0 };
  if (!rows.length) return { ...base, sub: 'マスモンを迎えると対戦できます', disabled: true, why: 'マスモンを迎えると対戦できます' };
  if (!ambbPvpOn() && !ambbAssistantsWithRows().some(a => a.id !== assistantId)) return { ...base, sub: 'ほかの助手がマスモンを迎えたら対戦できます', disabled: true, why: 'ほかの助手がマスモンを迎えたら対戦できます' };
  const rec = AMBB_STORE.state.rec[assistantId];
  let gain = 0;
  try { if (typeof amgCareGainOf === 'function' && typeof amgEntryOf === 'function') for (const t of rows) gain += amgCareGainOf(amgEntryOf(assistantId, t)).total; } catch (_) {}
  return { ...base, sub: rec && (rec.w + rec.l + rec.d) ? `${rec.w}勝 ${rec.l}敗${rec.d ? ` ${rec.d}分` : ''}` : 'この端末の助手どうしで対戦', gain, disabled: false, why: null };
};
try { setTimeout(() => { try { if (ambbOn()) void AMBB_STORE.load(); } catch (_) {} }, 0); } catch (_) {}

// 60-app に1つだけ置く入れ物
function AssistantMasmonBattleHost() {
  const [open, setOpen] = useState(AMBB_HOST.open);
  useEffect(() => { const f = (v) => setOpen(v); AMBB_HOST.subs.add(f); return () => { AMBB_HOST.subs.delete(f); }; }, []);
  if (!open) return null;
  return <AssistantMasmonBattleBeta key={open.at} {...open} onClose={() => AMBB_HOST.set(null)}/>;
}

const AMBB_CSS = `
.ambb-tabs{display:flex;gap:6px;flex-wrap:wrap}
.ambb-tabs button{flex:1 1 auto;min-height:40px;padding:6px 10px;border-radius:12px;border:2px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-weight:900;font-size:13px}
.ambb-tabs button.on{border-color:#f9a8d4;background:rgba(249,168,212,.22)}
.ambb-tabs button small{display:block;font-size:10px;color:#cbd5e1;font-weight:700}
.ambb-mons{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.ambb-mon{position:relative;border-radius:12px;border:2px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);padding:4px 2px 5px;text-align:center;color:#fff}
.ambb-mon img{width:48px;height:48px;object-fit:contain}
.ambb-mon b{display:block;font-size:10.5px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ambb-mon small{display:block;font-size:9.5px;color:#cbd5e1}
.ambb-mon.on{border-color:#f9a8d4;background:rgba(249,168,212,.18)}
.ambb-mon i{position:absolute;top:-6px;left:-6px;width:22px;height:22px;border-radius:50%;background:#ec4899;font-style:normal;font-size:12px;line-height:22px;font-weight:900}
.ambb-beta{display:inline-block;margin-left:4px;padding:0 6px;border-radius:8px;background:#f59e0b;color:#1f1300;font-size:10px;font-weight:900;vertical-align:middle}
.ambb-vs{display:flex;align-items:center;gap:8px}
.ambb-vs img{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.1)}
.ambb-gain{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px dashed rgba(255,255,255,.12)}
.ambb-gain:first-of-type{border-top:0}
.ambb-gain img{width:36px;height:36px;object-fit:contain}
.ambb-gain b{color:#86efac}
.ambb-tier{display:flex;justify-content:space-between;padding:5px 2px;border-top:1px dashed rgba(255,255,255,.12);font-size:12.5px}
.ambb-if{padding:8px;border-radius:12px;background:rgba(96,165,250,.14);margin-top:6px}
`;

function AssistantMasmonBattleBeta({ assistantId, foeAssistantId, preview, tryPvp, onClose }) {
  const save = useAmbbSave();
  const [engine, setEngine] = useState(typeof window !== 'undefined' ? window.ASSISTANT_MASMON_BATTLE || null : null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [ticked, setTicked] = useState(false);
  const [phase, setPhase] = useState('prep');   // prep → watch → review / rank
  const [battle, setBattle] = useState(null);
  const [pos, setPos] = useState(0);
  const [paused, setPaused] = useState(false);
  const [ifs, setIfs] = useState(null);
  const [ask, setAsk] = useState(null);
  const [src, setSrc] = useState(null);           // 'local'(この端末)|'friend'(β その2)
  const rootRef = useRef(null);
  useEffect(() => { if (rootRef.current) rootRef.current.scrollTop = 0; }, [phase]);

  useEffect(() => {
    let alive = true;
    if (!engine && typeof ambwLoadEngine === 'function') ambwLoadEngine().then((e) => { if (!alive) return; if (e) setEngine(e); else setLoadFailed(true); });
    // 育成のまだの回をまとめて決めてから並べる(マスモンを持っている助手だけ)
    (async () => {
      try {
        if (typeof ASSISTANT_MASMON_STORE !== 'undefined') await ASSISTANT_MASMON_STORE.load();
        // 確かめ(印が偽)では育成の保存も動かさない(いまの入れ物のまま並べる)
        if (!preview && typeof amgTick === 'function') for (const a of ambbAssistantsWithRows()) await amgTick(a.id);
        else if (typeof AMG_STORE !== 'undefined') await AMG_STORE.load();
      } catch (_) {}
      if (alive) setTicked(true);
    })();
    return () => { alive = false; };
  }, []);

  const ready = !!(engine && engine.BALANCE && typeof engine.simulate === 'function' && typeof engine.unitFromGrow === 'function');
  const catalog = useMemo(() => {
    if (!ready) return null;
    try { return engine.buildCatalog({ ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS: ambwTechTable() }); } catch (e) { return null; }
  }, [ready]);

  const holders = useMemo(() => (ticked ? ambbAssistantsWithRows() : []), [ticked]);
  const meId = (assistantId && holders.some(a => a.id === assistantId)) ? assistantId : ((holders[0] || {}).id || assistantId || '');
  const me = (typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST.find(a => a.id === meId)) || null;
  const last = save.last[meId] || { size: 3, order: [], plan: 'omakase', swap: 'omakase', foe: '' };
  const [mode, setMode] = useState(null);
  const [pick, setPick] = useState(null);
  const modeNow = mode || save.mode[meId] || 'auto';
  const myRows = useMemo(() => (ticked && meId ? ambbRowsOf(meId) : []), [ticked, meId]);
  const myUnits = useMemo(() => (ready && catalog && myRows.length ? ambbUnitsOf(engine, meId, myRows) : []), [ready, catalog, myRows]);
  const foes = holders.filter(a => a.id !== meId);
  const foeId = (pick && pick.foe) || (foeAssistantId && foes.some(a => a.id === foeAssistantId) ? foeAssistantId : '') || (foes.some(a => a.id === last.foe) ? last.foe : '') || ((foes[0] || {}).id || '');
  const sel = pick || { size: last.size, order: last.order, plan: last.plan, swap: last.swap, foe: foeId };
  const setSel = (patch) => setPick({ ...sel, foe: foeId, ...patch });

  // おまかせ: 能力の合計が大きい順に3体まで。自分で決める: 選んだ順(足りなければ合計の大きい順で埋める)
  const sizeMax = Math.max(1, Math.min(3, myUnits.length || 1));
  const size = modeNow === 'auto' ? sizeMax : Math.max(1, Math.min(sizeMax, sel.size || 3));
  const byTotal = myUnits.slice().sort((a, b) => b.total - a.total);
  // 自分で選んだ分(初めては能力の大きい順の分を選んだ形で始める)。足りない分は能力の大きい順で埋める
  const unitOf = (k) => myUnits.find(x => ambbRowKey(x.row) === k);
  const picked = (!pick && !sel.order.length ? byTotal.slice(0, size).map(u => ambbRowKey(u.row)) : sel.order).filter(unitOf).slice(0, size);
  const chosen = (() => {
    if (modeNow === 'auto') return byTotal.slice(0, size);
    const out = picked.map(unitOf);
    for (const u of byTotal) if (out.length < size && !out.includes(u)) out.push(u);
    return out;
  })();
  const toggleOrder = (k) => {
    const has = picked.includes(k);
    setSel({ order: has ? picked.filter(x => x !== k) : [...picked, k].slice(-size) });
  };

  // 相手: この端末のほかの助手のマスモン(おまかせ・能力の大きい順)。だれもいなければ対戦しない(練習相手は出さない・社長 2026-11-11 B)
  const foeTeam = () => {
    const rows = ambbRowsOf(foeId);
    const units = ambbUnitsOf(engine, foeId, rows).sort((a, b) => b.total - a.total).slice(0, size);
    return { assistantId: foeId, tactics: ambbTacticsOf(foeId, rows), members: units.map(u => u.unit) };
  };

  const start = () => {
    if (!ready || !catalog || !chosen.length || !foeId) return;
    const plan = modeNow === 'auto' ? 'omakase' : sel.plan, swap = modeNow === 'auto' ? 'omakase' : sel.swap;
    const teamA = { assistantId: meId, tactics: ambbTacticsOf(meId, chosen.map(u => u.row)), plan: ambbPlanOf(engine, plan), swapPace: ambbSwapOf(engine, swap), members: chosen.map(u => u.unit) };
    const fb = foeTeam();
    const teamB = { assistantId: fb.assistantId, tactics: fb.tactics, members: fb.members };
    const seed = `ambb-${meId}-${fb.assistantId}-${Date.now()}`;
    let r;
    try { r = engine.simulate({ seed, catalog, teamA, teamB, balance: 'A', trace: true }); } catch (e) { return; }
    const st = r.log[0] || {};
    setBattle({ id: seed, seed, r, frames: ambwFramesOf(r.log), teamA, teamB, units: chosen, maxHp: { A: st.aHp || [], B: st.bHp || [] }, moves: { A: st.aMoves || [], B: st.bMoves || [] }, plan, swap });
    setPos(0); setPaused(false); setIfs(null); setPhase('watch');
    ambbSave(s => ({ ...s, mode: { ...s.mode, [meId]: modeNow }, last: { ...s.last, [meId]: { size, order: chosen.map(u => ambbRowKey(u.row)), plan: sel.plan, swap: sel.swap, foe: fb.assistantId } } }));
  };

  // 確かめ(印が偽)ではフレンド対戦を出さない。デバッグの「フレンド対戦を試す」だけは出す(この端末の保存はしないまま)
  const pvp = (ambbPvpOn() && !preview) || (!!tryPvp && typeof masmonPvpChallenge === 'function');
  const srcNow = pvp ? (src || (foes.length ? 'local' : 'friend')) : 'local';
  // フレンド対戦: サーバが回した試合(種と編成)を同じ計算で見返す。勝ち負けはサーバの返りが正本
  const startPvp = (m, foe) => {
    if (!ready || !catalog || !m || !m.teamA || !m.teamB) return;
    const teamA = { ...m.teamA, assistantId: m.teamA.assistantId || meId };
    const teamB = { ...m.teamB, assistantId: m.teamB.assistantId || foe.assistantId };
    let r;
    try { r = engine.simulate({ seed: m.seed, catalog, teamA, teamB, balance: m.balance || 'A', trace: true }); } catch (e) { return; }
    // 指紋はサーバと同じく記録なし(trace なし)で回したものを比べる(記録を付けると指紋が変わる)
    let plain = null;
    try { plain = engine.simulate({ seed: m.seed, catalog, teamA, teamB, balance: m.balance || 'A' }); } catch (_) { plain = null; }
    const same = !!plain && plain.winner === m.winner && plain.rounds === m.rounds && (!m.digest || plain.digest === m.digest);
    const st = r.log[0] || {};
    const units = chosen.filter(u => teamA.members.some(x => x.species === u.unit.species && x.name === u.unit.name));
    setBattle({ id: `pvp-${m.id}`, seed: m.seed, r: { ...r, winner: m.winner || r.winner }, frames: ambwFramesOf(r.log), teamA, teamB, units: units.length ? units : chosen, maxHp: { A: st.aHp || [], B: st.bHp || [] }, moves: { A: st.aMoves || [], B: st.bMoves || [] },
      pvp: { kind: m.kind, rated: m.rated, rating: m.rating, oppRating: m.oppRating, remaining: m.remaining, same, foeName: foe.name } });
    setPos(0); setPaused(false); setIfs(null); setPhase('watch');
  };

  const speed = save.speed || 'x1';
  const setSpeed = (id) => { if (!ambbSave(s => ({ ...s, speed: id }))) AMBB_STORE.set({ ...AMBB_STORE.state, speed: id }); };

  // 再生(観戦の試作と同じ進め方)
  useEffect(() => {
    if (phase !== 'watch' || !battle || paused) return undefined;
    const log = battle.r.log;
    if (pos >= log.length - 1) { const t = setTimeout(() => setPhase('review'), 900); return () => clearTimeout(t); }
    const sp = AMBW_SPEEDS.find(s => s.id === speed) || AMBW_SPEEDS[0];
    const t = setTimeout(() => {
      let next = pos + 1;
      if (speed === 'hl') while (next < log.length - 1 && !ambwIsHighlight(log[next], battle.maxHp)) next++;
      setPos(next);
    }, sp.ms);
    return () => clearTimeout(t);
  }, [phase, battle, pos, paused, speed]);

  // 戦績(1戦に1回だけ)
  useEffect(() => {
    if (phase !== 'review' || !battle || battle.pvp) return; // フレンド対戦の勝ち負けはサーバの表が正本
    ambbSave(s => {
      if (s.done.includes(battle.id)) return s;
      const rc = s.rec[meId] || { w: 0, l: 0, d: 0 };
      const k = battle.r.winner === 'A' ? 'w' : battle.r.winner === 'B' ? 'l' : 'd';
      return { ...s, rec: { ...s.rec, [meId]: { ...rc, [k]: rc[k] + 1 } }, done: [...s.done, battle.id] };
    });
  }, [phase, battle]);

  // もしも: 自分の3体のある能力があと1割高かったら、同じ相手に20戦で何勝するか
  useEffect(() => {
    if (phase !== 'review' || !battle || ifs) return undefined;
    const t = setTimeout(() => {
      const N = 20;
      const winsWith = (key) => {
        const members = battle.teamA.members.map(m => (key ? { ...m, stats: { ...m.stats, [key]: Math.round((Number(m.stats && m.stats[key]) || 100) * 1.1) } } : m));
        let w = 0;
        for (let k = 0; k < N; k++) { const r = engine.simulate({ seed: `${battle.seed}-if-${k}`, catalog, teamA: { ...battle.teamA, members }, teamB: battle.teamB }); if (r.winner === 'A') w++; else if (r.winner === 'draw') w += 0.5; }
        return w;
      };
      const base = winsWith(null);
      const list = engine.STAT_KEYS.map(k => ({ k, w: winsWith(k) })).sort((a, b) => b.w - a.w);
      setIfs({ n: N, base, best: list[0], list });
    }, 80);
    return () => clearTimeout(t);
  }, [phase, battle, ifs]);

  const nameOf = (id) => ((typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST.find(a => a.id === id)) || {}).name || id;
  const faceOf = (id) => { const a = typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST.find(x => x.id === id); return a ? assistantFaceSrc(a, 'normal') : ''; };
  const rec = save.rec[meId] || { w: 0, l: 0, d: 0 };

  let body = null;
  if (!ticked || (!ready && !loadFailed)) {
    body = <div className="ambw-card"><p className="ambw-small">対戦のじゅんびをしています…</p></div>;
  } else if (!ready || !catalog) {
    body = <div className="ambw-card"><p className="ambw-small">対戦の計算を読み込めませんでした。通信のよいところで、もう一度開いてください。</p></div>;
  } else if (!me || !myUnits.length) {
    body = <div className="ambw-card" data-ambb-empty><p className="ambw-small">対戦に出せるマスモンがいません。助手ライフで、助手がマスモンを迎えると対戦できます。</p></div>;
  } else if (phase === 'prep') {
    const plan = AMBB_PLANS.find(p => p.id === sel.plan) || AMBB_PLANS[0];
    body = (
      <div data-ambb-prep>
        {pvp && (
          <div className="ambb-tabs" style={{ marginBottom: 8 }}>
            <button data-ambb-src="local" className={srcNow === 'local' ? 'on' : ''} onClick={() => setSrc('local')}>🏠 この端末の助手</button>
            <button data-ambb-src="friend" className={srcNow === 'friend' ? 'on' : ''} onClick={() => setSrc('friend')}>👥 フレンドの助手</button>
          </div>
        )}
        {srcNow === 'local' && <div className="ambw-card">
          <div className="ambb-vs">
            <img src={faceOf(meId)} alt=""/>
            <div style={{ flex: 1 }}><b style={{ fontSize: 15 }}>{me.name}</b><div className="ambw-small">{(engine.STYLES[meId] || {}).label || ''}・{rec.w}勝 {rec.l}敗{rec.d ? ` ${rec.d}分` : ''}</div></div>
            <b style={{ color: '#f9a8d4' }}>VS</b>
            <div style={{ flex: 1, textAlign: 'right' }}><b style={{ fontSize: 15 }}>{foeId ? nameOf(foeId) : '?'}</b><div className="ambw-small">{foeId ? ((engine.STYLES[foeId] || {}).label || '') : 'まだいません'}</div></div>
            {foeId ? <img src={faceOf(foeId)} alt=""/> : null}
          </div>
          {foes.length > 1 && (
            <div className="ambb-tabs" style={{ marginTop: 8 }} data-ambb-foes>{foes.map(a => <button key={a.id} data-ambb-foe={a.id} className={a.id === foeId ? 'on' : ''} onClick={() => setSel({ foe: a.id })}>{a.name}</button>)}</div>
          )}
          {!foes.length && <p className="ambw-small" style={{ marginTop: 6 }}>ほかの助手がマスモンを迎えたら対戦できます。</p>}
        </div>}
        <div className="ambw-card">
          <div className="ambb-tabs">
            <button data-ambb-mode="auto" className={modeNow === 'auto' ? 'on' : ''} onClick={() => setMode('auto')}>🤝 おまかせ<small>{me.name}が3体と作戦を決める</small></button>
            <button data-ambb-mode="self" className={modeNow === 'self' ? 'on' : ''} onClick={() => setMode('self')}>✋ 自分で決める<small>形・3体と順番・作戦・交代</small></button>
          </div>
        </div>
        {modeNow === 'self' && (
          <div className="ambw-card" data-ambb-self>
            <div className="ambw-small">対戦の形</div>
            <div className="ambb-tabs">{[1, 2, 3].map(n => <button key={n} data-ambb-size={n} disabled={n > sizeMax} className={size === n ? 'on' : ''} onClick={() => setSel({ size: n, order: picked.slice(0, n) })}>{n} VS {n}</button>)}</div>
            <div className="ambw-small" style={{ marginTop: 10 }}>出るマスモンと順番(押した順に出ます){picked.length < size ? `・あと ${size - picked.length} 体は能力の高い順` : ''}</div>
            <div className="ambb-mons">{myUnits.map((u) => {
              const k = ambbRowKey(u.row), at = picked.indexOf(k);
              return (
                <button key={k} data-ambb-mon={k} className={`ambb-mon ${at >= 0 ? 'on' : ''}`} onClick={() => toggleOrder(k)}>
                  {at >= 0 && <i>{at + 1}</i>}
                  <img src={ALL_PLAYER_MONSTERS[u.row.monster].imgUrl} alt=""/>
                  <b>{u.row.nick || ALL_PLAYER_MONSTERS[u.row.monster].name}</b>
                  <small>Lv{(u.entry && u.entry.lv) || 1}・{u.total}</small>
                </button>
              );
            })}</div>
            <div className="ambw-small" style={{ marginTop: 10 }}>作戦</div>
            <div className="ambb-tabs">{AMBB_PLANS.map(p => <button key={p.id} data-ambb-plan={p.id} className={sel.plan === p.id ? 'on' : ''} onClick={() => setSel({ plan: p.id })}>{p.label}</button>)}</div>
            <div className="ambw-small" style={{ marginTop: 4 }}>{plan.note}</div>
            <div className="ambw-small" style={{ marginTop: 10 }}>交代の早さ</div>
            <div className="ambb-tabs">{AMBB_SWAPS.map(p => <button key={p.id} data-ambb-swap={p.id} className={sel.swap === p.id ? 'on' : ''} onClick={() => setSel({ swap: p.id })}>{p.label}</button>)}</div>
          </div>
        )}
        {modeNow === 'auto' && (
          <div className="ambw-card">
            <div className="ambw-small">{me.name}が選んだ {size} 体(この順に出ます)</div>
            <div className="ambb-mons" style={{ marginTop: 6 }}>{chosen.map((u, j) => (
              <div key={ambbRowKey(u.row)} className="ambb-mon on"><i>{j + 1}</i><img src={ALL_PLAYER_MONSTERS[u.row.monster].imgUrl} alt=""/><b>{u.row.nick || ALL_PLAYER_MONSTERS[u.row.monster].name}</b><small>Lv{(u.entry && u.entry.lv) || 1}</small></div>
            ))}</div>
          </div>
        )}
        {srcNow === 'friend' && <AmbbFriendPanel me={me} meId={meId} engine={engine} catalog={catalog} units={chosen} size={size} plan={modeNow === 'auto' ? 'omakase' : sel.plan} swap={modeNow === 'auto' ? 'omakase' : sel.swap} tactics={ambbTacticsOf(meId, chosen.map(u => u.row))} reg={save.reg[meId]} onBattle={startPvp}/>}
        <div className="ambw-ctl">
          {srcNow === 'local' && <button className="ambw-btn" data-ambb-start disabled={!foeId} onClick={start}>⚔ 対戦する</button>}
          <button className="ambw-btn2" data-ambb-rank-open onClick={() => setPhase('rank')}>🏆 ランキング</button>
        </div>
        {preview && <p className="ambw-small" style={{ textAlign: 'center', marginTop: 8 }}>公開前の確かめです。戦績も設定も保存しません。{tryPvp ? 'フレンド対戦は本物のサーバに登録・記録されます。' : ''}</p>}
      </div>
    );
  } else if (phase === 'rank' && pvp) {
    body = <AmbbRanking me={me} faceOf={faceOf} nameOf={nameOf} onBack={() => setPhase(battle ? 'review' : 'prep')}/>;
  } else if (phase === 'rank') {
    body = (
      <div data-ambb-rank>
        <div className="ambw-card" style={{ textAlign: 'center' }}>
          <b style={{ fontSize: 16 }}>🏆 ランキング<span className="ambb-beta">β</span></b>
          <p className="ambw-small" style={{ marginTop: 6 }}>β のあいだは準備中です。フレンドの助手と対戦できるようになったら、ポイントの順位と段がここに出ます。</p>
        </div>
        <div className="ambw-card">
          <div className="ambw-small">段(ポイントで決まります・はじめは 1500)</div>
          {AMBB_TIERS.slice().reverse().map((t, i, arr) => (
            <div key={t.id} className="ambb-tier"><span>{cardIconNode(t.icon, 14)} {t.label}</span><span className="ambw-small">{Number.isFinite(t.min) ? `${t.min}〜${i > 0 ? arr[i - 1].min - 1 : ''}` : `〜${arr[i - 1].min - 1}`}</span></div>
          ))}
          <p className="ambw-small" style={{ marginTop: 6 }}>順位は1週間ごと(月曜 4:00 に切り替わり)。</p>
        </div>
        <div className="ambw-card"><div className="ambw-small">{me.name}のこの端末での戦績</div><b>{rec.w}勝 {rec.l}敗{rec.d ? ` ${rec.d}分` : ''}</b></div>
        <div className="ambw-ctl"><button className="ambw-btn2" onClick={() => setPhase(battle ? 'review' : 'prep')}>← もどる</button></div>
      </div>
    );
  } else if (battle) {
    const log = battle.r.log, e = log[pos] || {}, f = battle.frames[pos] || battle.frames[0];
    const review = phase === 'review';
    const mem = (side, i) => (side === 'A' ? battle.teamA : battle.teamB).members[i];
    const who = (side, i) => (mem(side, i) || {}).name || '';
    const WHY = engine.WHY || {};
    const lineOf = (x) => {
      if (!x || !x.side) return '';
      const n = who(x.side, x.i);
      if (x.ev === 'tech') return x.hit ? `${n}の ${x.name}${x.crit ? ' 会心!' : ''} → ${x.dmg}${x.guarded ? '(ガード)' : ''}` : `${n}の ${x.name} … はずれ`;
      if (x.ev === 'move') return `${n}が ${AMBW_DIST[x.to]}距離へ ${x.step > 0 ? 'さがる' : 'つめる'}`;
      if (x.ev === 'charge') return `${n}は ガッツをためた`;
      if (x.ev === 'guard') return `${n}は 身を守った`;
      if (x.ev === 'swap') return `交代! ${who(x.side, x.from)} → ${n}`;
      if (x.ev === 'ko') return `${x.name} は たおれた`;
      if (x.ev === 'enter') return `${n} が出た`;
      return '';
    };
    const recent = [];
    for (let k = pos - 1; k >= 1 && recent.length < 3; k--) { const t = lineOf(log[k]); if (t) recent.unshift({ k, t, side: log[k].side, r: log[k].r }); }
    const gap = [6, 44, 92, 146][f.d] || 44;
    const foeSide = e.side === 'A' ? 'B' : 'A';
    const actor = e.side ? (typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST.find(a => a.id === (e.side === 'A' ? battle.teamA : battle.teamB).assistantId)) : null;
    const fighter = (side) => {
      const i = f.act[side], m = mem(side, i), down = f.hp[side][i] <= 0;
      const acting = e.side === side && e.ev === 'tech' ? `ambw-lunge${side}` : '';
      const hurt = e.ev === 'tech' && foeSide === side && e.hit ? 'ambw-hit' : '';
      return (
        <div key={`${side}-${pos}`} className={`ambw-f ${down ? 'down' : ''} ${acting} ${hurt}`}>
          <img className={side === 'A' ? 'ambw-flip' : ''} src={ALL_PLAYER_MONSTERS[m.species].imgUrl} alt=""/>
          <em>{m.name}</em>
          {e.ev === 'tech' && foeSide === side && (e.hit
            ? <div className="ambw-dmg">{e.crit ? <small>会心!</small> : e.guarded ? <small>ガード!</small> : null}−{e.dmg}</div>
            : <div className="ambw-dmg miss">はずれ</div>)}
        </div>
      );
    };
    const cutText = e.ev === 'tech' ? e.name : e.ev === 'move' ? (e.step > 0 ? 'さがる' : 'つめる') : e.ev === 'charge' ? 'ガッツをためる' : e.ev === 'guard' ? 'ガード' : e.ev === 'swap' ? `交代 → ${who(e.side, e.i)}` : e.ev === 'ko' ? `${e.name} たおれた` : '';
    const cutSmall = e.ev === 'tech' ? `${e.kind === 'pow' ? '💪 ちから技' : '🧠 かしこさ技'}${Number.isFinite(e.p) ? `・命中 ${Math.round(e.p)}%` : ''}` : (e.side ? who(e.side, e.ev === 'swap' ? e.from : e.i) : '');
    const kos = log.map((x, k) => (x.ev === 'ko' ? { k, side: x.side } : null)).filter(Boolean);
    const won = battle.r.winner === 'A', draw = battle.r.winner === 'draw';
    const stat = (side) => { const t = log.filter(x => x.ev === 'tech' && x.side === side); return { n: t.length, hit: t.filter(x => x.hit).length, crit: t.filter(x => x.crit).length, dmg: t.reduce((a, x) => a + (x.dmg || 0), 0), ko: log.filter(x => x.ev === 'ko' && x.side !== side).length }; };
    const sa = stat('A'), sb = stat('B');
    const foeName = battle.pvp ? `${battle.pvp.foeName}の${nameOf(battle.teamB.assistantId)}` : nameOf(battle.teamB.assistantId);
    const gains = battle.units.map(u => ({ u, g: typeof amgCareGainOf === 'function' ? amgCareGainOf(u.entry) : { total: 0 } }));
    const bestStat = ifs && ifs.best;
    const lead = bestStat ? battle.units.slice().sort((a, b) => (Number(a.unit.stats && a.unit.stats[bestStat.k]) || 0) - (Number(b.unit.stats && b.unit.stats[bestStat.k]) || 0))[0] : null;
    body = (
      <div data-ambb-watch data-ambb-phase={phase} data-ambw-pos={pos}>
        {review && (
          <div data-ambb-review>
            <div className="ambw-res"><b>{draw ? '引き分け' : won ? `${me.name} の勝ち!` : `${foeName} の勝ち`}</b><span>{battle.r.rounds} ラウンド・{battle.r.reason === 'judge' ? '判定' : '全滅で決着'}</span></div>
            {battle.pvp && (
              <div className="ambw-card" data-ambb-pvp-result>
                <div className="ambw-small">フレンド対戦・{(AMBB_KINDS.find(k => k.id === battle.pvp.kind) || AMBB_KINDS[0]).label}</div>
                {battle.pvp.rated && battle.pvp.rating ? (
                  <div><b style={{ fontSize: 15 }}>{cardIconNode(ambbTierOf(battle.pvp.rating.rating).icon, 14)} {battle.pvp.rating.rating} ポイント</b> <span style={{ color: battle.pvp.rating.delta >= 0 ? '#86efac' : '#fca5a5' }}>({battle.pvp.rating.delta >= 0 ? '+' : ''}{battle.pvp.rating.delta})</span><span className="ambw-small">・{ambbTierOf(battle.pvp.rating.rating).label}</span></div>
                ) : <div className="ambw-small">この試合はランキングに数えません(数えるのは 3対3 だけ・同じ相手とは1日3回まで)</div>}
                {Number.isFinite(battle.pvp.remaining) && <div className="ambw-small">今日あと {battle.pvp.remaining} 回 挑めます</div>}
                {!battle.pvp.same && <div className="ambw-small" style={{ color: '#fcd34d' }}>ゲームの版がちがうため、見返しが本当の試合と少しちがうかもしれません。結果はサーバの記録のとおりです。</div>}
              </div>
            )}
            <div className="ambw-card">
              <table className="ambw-tbl"><tbody>
                <tr><td>この1戦</td><td className="A">{me.name}</td><td className="B">{foeName}</td></tr>
                <tr><td>技が当たった</td><td className="A">{sa.hit}/{sa.n}</td><td className="B">{sb.hit}/{sb.n}</td></tr>
                <tr><td>会心</td><td className="A">{sa.crit}回</td><td className="B">{sb.crit}回</td></tr>
                <tr><td>与えたダメージ</td><td className="A">{sa.dmg}</td><td className="B">{sb.dmg}</td></tr>
                <tr><td>たおした数</td><td className="A">{sa.ko}</td><td className="B">{sb.ko}</td></tr>
              </tbody></table>
            </div>
            <div className="ambw-card" data-ambb-gain>
              <div className="ambw-small">関わって伸びた分(見に来た・自分で決めた・相談・M/B管理)</div>
              {gains.map(({ u, g }) => (
                <div key={ambbRowKey(u.row)} className="ambb-gain">
                  <img src={ALL_PLAYER_MONSTERS[u.row.monster].imgUrl} alt=""/>
                  <div style={{ flex: 1, minWidth: 0 }}><b style={{ color: '#fff' }}>{u.row.nick || ALL_PLAYER_MONSTERS[u.row.monster].name}</b>
                    <div className="ambw-small">{g.total ? Object.keys(AMBB_CARE_JP).filter(k => g[k]).map(k => `${AMBB_CARE_JP[k]} +${g[k]}`).join('・') : 'まだありません。様子を見に行くと伸びます'}</div></div>
                  <b>+{g.total || 0}</b>
                </div>
              ))}
            </div>
            <div className="ambw-card" data-ambb-if>
              <div className="ambw-small">もしもこう育っていたら(同じ相手と {ifs ? ifs.n : 20} 戦)</div>
              {!ifs ? <p className="ambw-small">計算しています…</p> : (
                <div className="ambb-if">
                  <div>いまの育ち方: <b>{ifs.base}勝</b></div>
                  <div>{AMBW_STAT_JP[bestStat.k]}があと1割高かったら: <b style={{ color: '#86efac' }}>{bestStat.w}勝</b>{bestStat.w > ifs.base ? `(+${bestStat.w - ifs.base})` : ''}</div>
                  {bestStat.w <= ifs.base && <div className="ambw-small" style={{ marginTop: 4 }}>{ifs.base >= ifs.n / 2 ? 'いまの育ち方で十分に戦えています。' : '1つの能力を少し上げるだけでは届かない相手です。全体を育てていきましょう。'}</div>}
                  {lead && typeof AssistantMasmonAskSheet === 'function' && !preview && (
                    <button className="ambw-btn2" style={{ marginTop: 8, width: '100%' }} data-ambb-ask onClick={() => setAsk({ t: lead.row, text: `${AMBW_STAT_JP[bestStat.k]}を鍛えて` })}>💬 {me.name}に「{AMBW_STAT_JP[bestStat.k]}を鍛えて」と提案する</button>
                  )}
                </div>
              )}
            </div>
            <div className="ambw-ctl">
              <button className="ambw-btn" data-ambb-again onClick={() => setPhase('prep')}>⚔ もう一度</button>
              <button className="ambw-btn2" onClick={() => { setPos(0); setPaused(false); setPhase('watch'); }}>▶ 見返す</button>
              <button className="ambw-btn2" data-ambb-rank-open onClick={() => setPhase('rank')}>🏆 ランキング</button>
            </div>
          </div>
        )}
        <AmbwPanel side="B" team={battle.teamB} frame={f} maxHp={battle.maxHp} moves={battle.moves.B} lastMove={e.side === 'B' && e.ev === 'tech' ? e.move : null} mine={false}/>
        <div className="ambw-ring">
          <div className="ambw-stage">{fighter('A')}<div className="ambw-gap" style={{ width: gap }}/>{fighter('B')}</div>
          <div className="ambw-dist">{AMBW_DIST.map((n, d) => <span key={d} className={d === f.d ? 'cur' : ''}>{n}</span>)}</div>
          {cutText && e.ev !== 'end' && (
            <div key={`cut-${pos}`} className={`ambw-cut ${e.ev === 'tech' ? e.kind : 'etc'} ${e.side === 'B' ? 'B' : ''}`}><small>{cutSmall}</small><b>{cutText}</b></div>
          )}
        </div>
        <AmbwPanel side="A" team={battle.teamA} frame={f} maxHp={battle.maxHp} moves={battle.moves.A} lastMove={e.side === 'A' && e.ev === 'tech' ? e.move : null} mine/>
        {!review && (
          <div className="ambw-card ambw-log">
            {recent.map(x => <p key={x.k} className={x.side}><small>R{x.r}</small>{x.t}</p>)}
            {actor && e.why && WHY[e.why] && (
              <div className="ambw-row" style={{ marginTop: 6 }}><img className="ambw-face" src={assistantFaceSrc(actor, 'normal')} alt=""/><div className="ambw-bubble">{actor.name}「{WHY[e.why]}」</div></div>
            )}
          </div>
        )}
        <div className="ambw-seek"><i style={{ width: `${Math.round(pos / Math.max(1, log.length - 1) * 100)}%` }}/>
          {kos.map(x => <button key={x.k} className={x.side} style={{ left: `${x.k / Math.max(1, log.length - 1) * 100}%` }} onClick={() => { setPos(x.k); setPaused(true); setPhase('watch'); }}>✖</button>)}
        </div>
        {!review && (
          <div className="ambw-ctl">
            <button className="ambw-btn2" data-ambb-pause onClick={() => setPaused(p => !p)}>{paused ? '▶' : '⏸'}</button>
            {AMBW_SPEEDS.map(s => <button key={s.id} className={`ambw-sp ${speed === s.id ? 'on' : ''}`} data-ambb-speed={s.id} onClick={() => { setSpeed(s.id); setPaused(false); }}>{s.label}</button>)}
            <button className="ambw-btn2" data-ambb-skip onClick={() => { setPos(log.length - 1); setPhase('review'); }}>⏭ 結果へ</button>
          </div>
        )}
      </div>
    );
  }

  const back = phase === 'prep' || !battle ? onClose : () => setPhase('prep');
  return (
    <div className="ambw" data-ambb-root ref={rootRef}>
      <style>{AMBW_CSS}{AMBB_CSS}</style>
      <div className="ambw-in">
        <div className="ambw-top">
          <button className="ambw-btn2" data-ambb-close onClick={phase === 'rank' && !battle ? () => setPhase('prep') : back}>← {phase === 'prep' ? 'もどる' : 'じゅんびへ'}</button>
          <span>⚔ マスモンで対戦<span className="ambb-beta">β</span></span>
          <b>{phase === 'watch' && battle ? `ラウンド ${(battle.frames[pos] || {}).r || 0}` : ''}</b>
        </div>
        {body}
      </div>
      {ask && me && <AssistantMasmonAskSheet who={me} from="masmon" t={ask.t} initialText={ask.text} onClose={() => setAsk(null)}/>}
    </div>
  );
}

// ---------- β その2: フレンドの助手に挑む欄 ----------
// 挑むときは、いまの編成を登録し直してから挑む(育った分がそのまま相手に見える)。勝ち負けはサーバが回して返す
function AmbbFriendPanel({ me, meId, units, size, plan, swap, tactics, reg, onBattle }) {
  const [data, setData] = useState({ loading: true, friends: [], remaining: 0, reason: '' });
  const [pickF, setPickF] = useState(null);
  const [kind, setKind] = useState('raw');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => {
      let r = null;
      try { r = await masmonPvpFriends(); } catch (_) { r = { ok: false, reason: 'network', friends: [], remaining: 0 }; }
      if (alive) setData({ loading: false, friends: (r && r.friends) || [], remaining: (r && r.remaining) || 0, reason: r && !r.ok ? r.reason : '' });
    })();
    return () => { alive = false; };
  }, []);
  const opts = [];
  for (const f of data.friends) for (const a of f.assistants) opts.push({ f, a, key: `${f.friendId}|${a.assistantId}` });
  const cur = opts.find(o => pickF && o.key === pickF) || opts[0] || null;
  const register = async () => {
    let userName = '', icon = null;
    try { userName = String((await storeGet('mh_breeder_name', '', false)) || ''); icon = (await storeGet('mh_breeder_icon', null, false)) || null; } catch (_) {}
    const r = await masmonPvpRegister({ assistantId: meId, size, members: units.map(ambbPvpMemberOf), plan: plan !== 'omakase' ? plan : undefined, swapPace: swap !== 'omakase' ? swap : undefined, tactics, userName, icon: typeof icon === 'string' ? icon : null });
    if (r && r.ok) ambbSave(s => ({ ...s, reg: { ...s.reg, [meId]: { at: Date.now(), size } } }));
    return r || { ok: false, reason: 'server' };
  };
  const doRegister = async () => { if (busy) return; setBusy('reg'); setMsg(''); try { const r = await register(); setMsg(r.ok ? 'この編成をフレンドに見せるように登録しました' : ambbPvpReason(r.reason)); } finally { setBusy(''); } };
  const doChallenge = async () => {
    if (busy || !cur) return;
    setBusy('go'); setMsg('');
    try {
      const rg = await register();
      if (!rg.ok) { setMsg(ambbPvpReason(rg.reason)); return; }
      const m = await masmonPvpChallenge({ assistantId: meId, friendId: cur.f.friendId, friendAssistantId: cur.a.assistantId, kind, size });
      if (!m || !m.ok) { setMsg(ambbPvpReason(m && m.reason)); return; }
      onBattle(m, { name: cur.f.name || 'フレンド', assistantId: cur.a.assistantId });
    } catch (_) { setMsg(ambbPvpReason('network')); } finally { setBusy(''); }
  };
  const aName = (id) => ((typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST.find(a => a.id === id)) || {}).name || '';
  return (
    <div data-ambb-friend>
      <div className="ambw-card">
        <div className="ambw-small">相手(フレンドが登録している助手の編成)</div>
        {data.loading ? <p className="ambw-small">フレンドを読み込んでいます…</p>
          : data.reason ? <p className="ambw-small">{ambbPvpReason(data.reason)}</p>
          : !opts.length ? <p className="ambw-small">{data.friends.length ? 'フレンドが助手の編成を登録すると、ここに出ます。' : 'フレンドができると、フレンドの助手と対戦できます。'}</p>
          : <div className="ambb-tabs" style={{ marginTop: 6 }}>{opts.map(o => (
            <button key={o.key} data-ambb-friend-opt={o.key} className={cur && cur.key === o.key ? 'on' : ''} onClick={() => setPickF(o.key)}>{o.f.name || 'フレンド'}の{aName(o.a.assistantId)}<small>{o.a.members.map(m => (typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[m.species] ? ALL_PLAYER_MONSTERS[m.species].name : m.species)).join('・')}</small></button>
          ))}</div>}
        <div className="ambw-small" style={{ marginTop: 10 }}>ランキングの区分</div>
        <div className="ambb-tabs">{AMBB_KINDS.map(k => <button key={k.id} data-ambb-kind={k.id} className={kind === k.id ? 'on' : ''} onClick={() => setKind(k.id)}>{k.label}<small>{k.note}</small></button>)}</div>
        <p className="ambw-small" style={{ marginTop: 6 }}>ランキングに数えるのは 3対3 だけです。{!data.loading && !data.reason ? `今日あと ${data.remaining} 回 挑めます。` : ''}</p>
      </div>
      <div className="ambw-ctl">
        <button className="ambw-btn" data-ambb-challenge disabled={!cur || !!busy || (!data.loading && data.remaining <= 0)} onClick={doChallenge}>{busy === 'go' ? '対戦しています…' : '⚔ 挑む'}</button>
        <button className="ambw-btn2" data-ambb-register disabled={!!busy} onClick={doRegister}>{busy === 'reg' ? '登録しています…' : '📮 この編成を登録'}</button>
      </div>
      <p className="ambw-small" style={{ textAlign: 'center' }}>{msg || (reg ? `${me.name}の編成はフレンドに見えています(挑むときに、いまの育ち方で登録し直します)` : '登録すると、フレンドもあなたの助手に挑めるようになります')}</p>
    </div>
  );
}

// ---------- β その2: ランキング(ポイント順+段・週ごと) ----------
function AmbbRanking({ me, faceOf, nameOf, onBack }) {
  const [kind, setKind] = useState('raw');
  const [period, setPeriod] = useState('all');
  const [data, setData] = useState({ loading: true, rows: [], mine: [], reason: '' });
  useEffect(() => {
    let alive = true;
    setData(d => ({ ...d, loading: true }));
    (async () => {
      let r = null;
      try { r = await masmonPvpRatings({ kind, limit: 50, week: period === 'week' ? ambbWeekOf() : null }); } catch (_) { r = { ok: false, reason: 'network', rows: [], mine: [] }; }
      if (alive) setData({ loading: false, rows: (r && r.rows) || [], mine: (r && r.mine) || [], reason: r && !r.ok ? r.reason : '' });
    })();
    return () => { alive = false; };
  }, [kind, period]);
  const week = period === 'week';
  return (
    <div data-ambb-rank data-ambb-rank-live>
      <div className="ambw-card" style={{ textAlign: 'center' }}>
        <b style={{ fontSize: 16 }}>🏆 ランキング<span className="ambb-beta">β</span></b>
        <div className="ambb-tabs" style={{ marginTop: 8 }}>{AMBB_KINDS.map(k => <button key={k.id} data-ambb-rank-kind={k.id} className={kind === k.id ? 'on' : ''} onClick={() => setKind(k.id)}>{k.label}</button>)}</div>
        <div className="ambb-tabs" style={{ marginTop: 6 }}>
          <button data-ambb-rank-period="all" className={!week ? 'on' : ''} onClick={() => setPeriod('all')}>ポイント</button>
          <button data-ambb-rank-period="week" className={week ? 'on' : ''} onClick={() => setPeriod('week')}>今週</button>
        </div>
        <p className="ambw-small" style={{ marginTop: 6 }}>{week ? '今週(月曜 4:00 から)に増えたポイントの順です' : 'ポイントの順です(はじめは 1500)'}</p>
      </div>
      <div className="ambw-card">
        {data.loading ? <p className="ambw-small">読み込んでいます…</p>
          : data.reason ? <p className="ambw-small">{ambbPvpReason(data.reason)}</p>
          : !data.rows.length ? <p className="ambw-small">まだだれも載っていません。フレンドの助手に 3対3 で挑むと載ります。</p>
          : data.rows.map((r) => {
            const t = ambbTierOf(r.rating);
            return (
              <div key={`${r.rank}-${r.assistantId}`} className="ambb-tier" data-ambb-rank-row style={r.me ? { background: 'rgba(249,168,212,.16)', borderRadius: 8 } : null}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}><b style={{ width: 22, textAlign: 'right' }}>{r.rank}</b>{faceOf(r.assistantId) ? <img src={faceOf(r.assistantId)} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }}/> : null}<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}の{nameOf(r.assistantId)}</span></span>
                <span style={{ whiteSpace: 'nowrap' }}>{week ? `${r.rating >= 0 ? '+' : ''}${r.rating}` : <>{cardIconNode(t.icon, 14)} {r.rating}</>}<span className="ambw-small"> {r.win}勝{r.lose}敗</span></span>
              </div>
            );
          })}
      </div>
      <div className="ambw-card">
        <div className="ambw-small">段(ポイントで決まります)</div>
        {AMBB_TIERS.slice().reverse().map((t, i, arr) => (
          <div key={t.id} className="ambb-tier"><span>{cardIconNode(t.icon, 14)} {t.label}</span><span className="ambw-small">{Number.isFinite(t.min) ? `${t.min}〜${i > 0 ? arr[i - 1].min - 1 : ''}` : `〜${arr[i - 1].min - 1}`}</span></div>
        ))}
      </div>
      <div className="ambw-ctl"><button className="ambw-btn2" onClick={onBack}>← もどる</button></div>
    </div>
  );
}
