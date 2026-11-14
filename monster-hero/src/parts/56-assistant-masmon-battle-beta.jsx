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
// null・空の文字・真偽は値が無いものとして既定値へ(Number(null)=0 で 0 にしない。ミハリ6 #5878)
const ambbInt = (v, lo, hi, d) => { if (v === null || v === '' || typeof v === 'boolean') return d; const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d; };
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
// 試合の設定(2026-11-13 段2・社長「バトルも試合前に設定とか選べて色々調整させてほしい」)。
//   この端末の練習の対戦だけに効く(芯の rules・roundLimit・balance へ渡す)。フレンド対戦・ランキングはサーバの決まりのまま(渡さない)
//   既定のままなら芯へ何も渡さない = 今までと同じ試合
const AMBB_SET_DEF = Object.freeze({ team: 'team', rounds: 150, dist: 'auto', guts: 50, fx: 'full', balance: 'A', seedLock: false, ctl: 'auto' });
const AMBB_SET_OPTS = Object.freeze({
  team: [{ id: 'team', label: 'チーム', note: '交代あり' }, { id: 'ko', label: '勝ち抜き', note: '交代なし・倒れたら次' }],
  rounds: [30, 50, 100, 150],
  dist: ['auto', 0, 1, 2, 3],
  guts: [30, 50, 70, 99],
  fx: [{ id: 'full', label: 'たっぷり' }, { id: 'lite', label: '少なめ' }],
  ctl: [{ id: 'auto', label: 'オートで観戦' }, { id: 'manual', label: '手動', note: '手番ごとに自分で選ぶ' }],
  balance: [{ id: 'A', label: 'そのまま' }, { id: 'B', label: '差を縮める' }, { id: 'C', label: '差を広げる' }],
});
const normalizeAmbbSet = (raw) => {
  const x = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    team: x.team === 'ko' ? 'ko' : 'team',
    rounds: ambbInt(x.rounds, 10, 300, AMBB_SET_DEF.rounds),
    dist: Number.isInteger(x.dist) && x.dist >= 0 && x.dist <= 3 ? x.dist : 'auto',
    guts: ambbInt(x.guts, 0, 99, AMBB_SET_DEF.guts), // 版9でガッツの最大は 99(前に保存した 100 は 99 として読む)
    fx: x.fx === 'lite' ? 'lite' : 'full',
    balance: ['A', 'B', 'C'].includes(x.balance) ? x.balance : 'A',
    seedLock: x.seedLock === true,
    ctl: x.ctl === 'manual' ? 'manual' : 'auto',
  };
};
// 芯へ渡す分(既定と同じ所は渡さない)
const ambbMatchOpts = (set) => {
  const rules = {};
  if (set.dist !== 'auto') rules.distStart = set.dist;
  if (set.guts !== AMBB_SET_DEF.guts) rules.gutsStart = set.guts;
  if (set.team === 'ko') rules.noSwap = true;
  return { ...(Object.keys(rules).length ? { rules } : {}), ...(set.rounds !== AMBB_SET_DEF.rounds ? { roundLimit: set.rounds } : {}), balance: set.balance };
};
const ambbSetDiff = (set) => Object.keys(AMBB_SET_DEF).filter(k => k !== 'fx' && k !== 'ctl' && set[k] !== AMBB_SET_DEF[k]).length;
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
  return { slot: u.row.slot, species: x.species, name: String(name).slice(0, 24), lv: x.lv, stats: x.stats, ...(techs ? { techs } : {}), mastery, ...(Number.isInteger(x.loy) ? { loy: x.loy } : {}), ...(Number.isInteger(x.pop) ? { pop: x.pop } : {}) };
};
const ambbOn = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantMasmonBattleBeta === true && RELEASE_FLAGS.assistantMasmonGrow === true;

// ---------- 保存(新しいキーだけ。版の番号つき・壊れていたら既定値) ----------
const normalizeAssistantMasmonBattleSave = (raw) => {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = { v: AMBB_V, speed: 'x1', mode: {}, last: {}, rec: {}, done: [], reg: {}, rep: {}, set: normalizeAmbbSet(src.set) };
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
  // 段3: 技の札の代表(2026-11-13 社長)。rep[助手 id][保存枠:種類] = [零, 近, 中, 遠] の技 id(決めていない所は null)。
  //   覚えていない・届かない技 id は、使うときに自動(命中×威力)に戻す(ここでは消さない)。助手ごとに60体まで
  out.rep = {};
  for (const [aid, r] of Object.entries(obj(src.rep))) {
    const o = {};
    for (const [k, v] of Object.entries(obj(r)).slice(0, 60)) {
      if (!Array.isArray(v)) continue;
      const ids = [0, 1, 2, 3].map(i => (typeof v[i] === 'string' && v[i] && v[i].length <= 40 ? v[i] : null));
      if (ids.some(Boolean)) o[k] = ids;
    }
    if (Object.keys(o).length) out.rep[aid] = o;
  }
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
  let bond; try { if (typeof amgbOn === 'function' && amgbOn() && typeof amgbEntryOf === 'function') bond = amgbEntryOf(aid, row) || undefined; } catch (_) { bond = undefined; } // 絆の忠誠度・人気(印が偽なら渡さない = 忠誠100・人気0)
  const u = engine.unitFromGrow(row, entry, train, bond);
  return { row, entry, unit: u, total: entry && entry.st ? Object.values(entry.st).reduce((a, b) => a + (Number(b) || 0), 0) : 0 };
});
// 1体の覚えている技を、技の札の形に(芯の buildMoves と同じ選び方: 覚えた技・記録が無ければはじめの技。熟練で命中とガッツを直す)
//   計算の中身(_internal)は使わず、公開の定数 MASTERY_HIT_MAX・MASTERY_GUTS_CUT で同じ直しをする(見せるだけ・試合の計算は芯)
const ambbUnitTechItems = (engine, catalog, unit) => {
  const sp = catalog && unit && catalog.species && catalog.species[unit.species];
  if (!sp || !Array.isArray(sp.techs) || !sp.techs.length) return [];
  const st = sp.techs.filter(t => t.start), start = st.length ? st : sp.techs.slice();
  const known = Array.isArray(unit.techs) ? sp.techs.filter(t => unit.techs.includes(t.id)) : start;
  const list = known.length ? known : (st.length ? start : [sp.techs[0]]);
  const hitMax = engine && Number.isFinite(engine.MASTERY_HIT_MAX) ? engine.MASTERY_HIT_MAX : 0, cut = engine && Number.isFinite(engine.MASTERY_GUTS_CUT) ? engine.MASTERY_GUTS_CUT : 0;
  return list.map(t => {
    const m = Math.max(0, Math.min(100, Number(unit.mastery && unit.mastery[t.id]) || 0));
    // 代表を決める目安は「命中=回避・ガッツ半分」の命中%(観戦の札 ambwTechItems と同じ ambwHitOf)。一覧に出す命中%は熟練の分を足す
    return { id: t.id, name: t.name, kind: t.kind, dist: t.dist, power: t.power, hit: ambwHitOf(t.hit), base: { power: t.power, hit: t.hit, gd: t.gd, crit: t.crit }, shown: ambwHitOf(t.hit, m / 100 * hitMax), guts: Math.round(t.guts * (1 - m / 100 * cut)) };
  });
};
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
.ambb-cmp-head{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px}
.ambb-cmp-head div{display:flex;align-items:center;gap:6px;min-width:0}
.ambb-cmp-head div:last-child{flex-direction:row-reverse;text-align:right}
.ambb-cmp-head img{width:46px;height:46px;object-fit:contain;flex:none}
.ambb-cmp-head b{font-size:12.5px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ambb-cmp-head small{display:block;font-size:10px;color:#cbd5e1}
.ambb-cmp-head em{font-style:normal;font-weight:900;color:#fde047;font-size:15px}
.ambb-cmp-sec{margin-top:8px;font-size:10.5px;color:#a5b4fc;font-weight:900;text-align:center}
.ambb-cmp-row{display:grid;grid-template-columns:40px 1fr 68px 1fr 40px;align-items:center;gap:4px;margin-top:4px;font-size:11.5px}
.ambb-cmp-row>span{text-align:center;font-size:11px;color:#e2e8f0;white-space:nowrap}
.ambb-cmp-row>b{font-size:12px;color:#cbd5e1}
.ambb-cmp-row>b.L{text-align:right}.ambb-cmp-row>b.R{text-align:left}
.ambb-cmp-row>b.win.L{color:#f9a8d4}.ambb-cmp-row>b.win.R{color:#7dd3fc}
.ambb-bar{height:10px;border-radius:6px;background:rgba(255,255,255,.08);position:relative;overflow:hidden}
.ambb-bar i{position:absolute;top:0;bottom:0;border-radius:6px;animation:ambbGrow .55s cubic-bezier(.2,.8,.3,1) both}
.ambb-bar.L i{right:0;background:linear-gradient(270deg,#f472b6,#9d174d);transform-origin:right center}
.ambb-bar.R i{left:0;background:linear-gradient(90deg,#38bdf8,#075985);transform-origin:left center}
@keyframes ambbGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.ambb-cmp-note{margin-top:6px;font-size:10.5px;line-height:1.5;color:#94a3b8;text-align:center;word-break:keep-all;overflow-wrap:anywhere}
.ambb-set-row{display:grid;grid-template-columns:86px 1fr;align-items:center;gap:6px;margin-top:6px}
.ambb-set-row>span{font-size:11.5px;color:#e2e8f0}
.ambb-set-row .ambb-tabs button{min-height:34px;padding:4px 6px;font-size:12px;border-radius:10px}
.ambb-set-row .ambb-tabs button small{font-size:9.5px}
.ambb-set-row input[type=range]{width:100%;accent-color:#f9a8d4}
.ambb-fold{margin-top:8px;border-top:1px dashed rgba(255,255,255,.14);padding-top:6px}
.ambb-fold summary{font-size:12px;font-weight:900;color:#c4b5fd;cursor:pointer;list-style:none}
.ambb-fold summary::-webkit-details-marker{display:none}
.ambw.ambb-full{overflow:hidden}
.ambw.ambb-full .ambw-in{height:100%;display:flex;flex-direction:column;padding-bottom:max(8px,env(safe-area-inset-bottom))}
.ambw.ambb-full [data-ambb-watch]{flex:1;min-height:0;display:flex;flex-direction:column}
.ambw.ambb-full .ambb-stagewrap{flex:1;min-height:0;display:flex;flex-direction:column;margin-top:6px!important}
.ambw.ambb-full .ambb-stagewrap .msa-stage{flex:1}
.ambw.ambb-full [data-ambb-watch]>*:not(.ambb-stagewrap){flex-shrink:0}
.ambw.ambb-full .ambw-log{margin-top:6px;padding:5px 8px;min-height:44px}
.ambw.ambb-full .ambw-log p:nth-last-child(n+3){display:none}
.ambw.ambb-full .ambw-seek{margin-top:8px}
.ambw.ambb-full .ambw-ctl{margin-top:8px;flex-wrap:nowrap;gap:5px}
.ambw.ambb-full .ambw-ctl button{min-height:38px;padding:4px 10px;font-size:12.5px;white-space:nowrap}
.ambw.ambb-full .ambw-top{min-height:34px}
.ambw.ambb-full .ambb-bar-wrap .msxm{margin-top:6px;padding:7px;max-height:42vh;overflow-y:auto}
.ambw.ambb-full .ambb-bar-wrap .msxm-btn{min-height:36px;font-size:11.5px;padding:3px 6px;flex:1 1 22%}
.ambw.ambb-full .ambb-bar-wrap .msxm-btn small{font-size:9.5px}
.ambw.ambb-full .ambb-bar-wrap .msxm-btn:not(.atk):not([data-msxm-move]) small{display:none}
.ambw.ambb-full .ambb-bar-wrap .msxm-btn small{white-space:nowrap}
.ambw.ambb-full .ambb-bar-wrap .msxm-sec{margin-top:5px}
.ambw.ambb-full .ambb-bar-wrap .msxm-foot{margin-top:5px}
.ambw.ambb-full [data-ambw-panel]{padding:6px 8px;margin-top:6px}
.ambw.ambb-full [data-ambw-panel]>.ambw-row+.ambw-row{display:none}
.ambw.ambb-full [data-ambw-panel] .ambw-face{width:28px;height:28px}
.ambw.ambb-full [data-ambw-panel] .ambw-small{display:none}
.ambw.ambb-full [data-ambw-panel] .ambw-chips{margin-top:5px}
/* 背の低い画面(高さ740以下)では全画面の詰め方をやめ、場は決まった高さ・画面ごと縦にスクロール(ミハリ6 #5891: 場が手動の帯に重なった) */
@media (max-height:740px){
  .ambw.ambb-full{overflow-y:auto}
  .ambw.ambb-full .ambw-in{height:auto;display:block}
  .ambw.ambb-full [data-ambb-watch]{display:block}
  .ambw.ambb-full .ambb-stagewrap{display:flex}
  .ambw.ambb-full .ambb-stagewrap .msa-stage.fill{flex:none;height:clamp(160px,34vh,260px);min-height:0}
  .ambw.ambb-full .ambb-bar-wrap .msxm{max-height:none;overflow:visible}
  .msa-stage.fill .msa-f,.msa-stage.fill .msa-dmgwrap{width:96px;margin-left:-48px;height:120px}
  .msa-stage.fill .msa-f img.msa-img{max-width:96px;max-height:112px}
}
@media (max-width:360px){.ambw.ambb-full .ambw-ctl{flex-wrap:wrap}.ambw.ambb-full .ambw-ctl button{padding:4px 8px;font-size:12px}}
@media (max-width:360px){.ambw-top{font-size:11px;gap:4px}.ambw-top>span{white-space:nowrap}.ambw-top .ambw-btn2{padding-left:8px;padding-right:8px}}
`;

function AssistantMasmonBattleBeta({ assistantId, foeAssistantId, preview, tryPvp, onClose }) {
  const save = useAmbbSave();
  const [engine, setEngine] = useState(typeof window !== 'undefined' ? window.ASSISTANT_MASMON_BATTLE || null : null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [ticked, setTicked] = useState(false);
  const [phase, setPhase] = useState('prep');   // prep → watch → review / rank
  // 観戦・振り返りのあいだはバトルの曲(56-monhero-success-arena.jsx の口)
  if (typeof useMhBattleBgmHold === 'function') useMhBattleBgmHold(phase === 'watch' || phase === 'review');
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
  const size = Math.max(1, Math.min(sizeMax, sel.size || 3));
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
  const foeUnits = useMemo(() => (ready && catalog && foeId ? ambbUnitsOf(engine, foeId, ambbRowsOf(foeId)).sort((a, b) => b.total - a.total) : []), [ready, catalog, foeId, ticked]);
  const foeTeam = () => {
    const rows = ambbRowsOf(foeId);
    const units = foeUnits.slice(0, size);
    return { assistantId: foeId, tactics: ambbTacticsOf(foeId, rows), members: units.map(u => u.unit) };
  };
  // 試合の設定(この端末の練習だけ)。確かめ(印が偽)では保存せず、開いているあいだだけ覚える
  const set = save.set || normalizeAmbbSet(null);
  const setSet = (patch) => { const next = normalizeAmbbSet({ ...set, ...patch }); if (!ambbSave(s => ({ ...s, set: next }))) AMBB_STORE.set({ ...AMBB_STORE.state, set: next }); };
  const lite = set.fx === 'lite';
  const lastSeedRef = useRef('');

  const start = () => {
    if (!ready || !catalog || !chosen.length || !foeId) return;
    const plan = modeNow === 'auto' ? 'omakase' : sel.plan, swap = modeNow === 'auto' ? 'omakase' : sel.swap;
    const teamA = { assistantId: meId, tactics: ambbTacticsOf(meId, chosen.map(u => u.row)), plan: ambbPlanOf(engine, plan), swapPace: ambbSwapOf(engine, swap), members: chosen.map(u => u.unit) };
    const fb = foeTeam();
    const teamB = { assistantId: fb.assistantId, tactics: fb.tactics, members: fb.members };
    // 「同じ流れでもう一度」は前の試合の種を使う(戦績は別の1戦として数える)
    const seed = set.seedLock && lastSeedRef.current ? lastSeedRef.current : `ambb-${meId}-${fb.assistantId}-${Date.now()}`;
    lastSeedRef.current = seed;
    const opts = ambbMatchOpts(set);
    let r, match = null;
    // 手動(2026-11-13 段3・社長「手動も作ってほしい。色々見ながら調整したい」): 芯の createMatch で自分の側だけ手番ごとに聞く。計算はオートと同じ
    try {
      if (set.ctl === 'manual' && typeof engine.createMatch === 'function') { match = engine.createMatch({ seed, catalog, teamA, teamB, ...opts, trace: true, control: { A: 'human' } }); r = match.result() || { log: match.log.slice(), winner: null, rounds: 0 }; }
      else r = engine.simulate({ seed, catalog, teamA, teamB, ...opts, trace: true });
    } catch (e) { return; }
    const st = r.log[0] || {};
    setBattle({ id: `${seed}-${Date.now()}`, seed, opts, r, match, frames: ambwFramesOf(r.log), teamA, teamB, units: chosen, maxHp: { A: st.aHp || [], B: st.bHp || [] }, moves: { A: st.aMoves || [], B: st.bMoves || [] }, plan, swap });
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
    if (pos >= log.length - 1) {
      if (battle.match && !battle.match.done()) return undefined;   // 手動: あなたの手番を待つ
      const t = setTimeout(() => setPhase('review'), 900); return () => clearTimeout(t);
    }
    const sp = AMBW_SPEEDS.find(s => s.id === speed) || AMBW_SPEEDS[0];
    // 1行の長さは技の動きの長さに合わせる(試合の画面 MsaStage と同じ。×2・×4 は縮める。見せ場だけは今までどおり)
    const cur = log[pos] || {};
    const team = cur.side === 'A' ? battle.teamA : cur.side === 'B' ? battle.teamB : null;
    const f = { x1: 1, x2: 0.55, x4: 0.3 }[speed];
    const ms = f && typeof msaStepMs === 'function' ? Math.round(msaStepMs(cur, team, lite || (typeof msaReduce === 'function' && msaReduce()), log, f) * f) : sp.ms;
    const t = setTimeout(() => {
      let next = pos + 1;
      if (speed === 'hl') while (next < log.length - 1 && !ambwIsHighlight(log[next], battle.maxHp)) next++;
      setPos(next);
    }, ms);
    return () => clearTimeout(t);
  }, [phase, battle, pos, paused, speed, lite]);

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
  // 絆(56-assistant-life-masmon-bond.jsx): 出たマスモンの人気。フレンド対戦 勝ち+2・負け+0.5/助手どうし 勝ち+1・負け+0.2。1戦に1回だけ(印が偽なら何もしない)
  useEffect(() => {
    if (preview || phase !== 'review' || !battle || typeof amgbBattleOnce !== 'function') return; // 確かめ(デバッグ)では保存しない
    try { amgbBattleOnce(battle.id, meId, (battle.units || []).map(u => u && u.row).filter(Boolean), battle.pvp ? 'pvp' : 'peer', battle.r && battle.r.winner === 'A'); } catch (_) {}
  }, [phase, battle]);

  // もしも: 自分の3体のある能力があと1割高かったら、同じ相手に20戦で何勝するか
  useEffect(() => {
    if (phase !== 'review' || !battle || ifs) return undefined;
    const t = setTimeout(() => {
      const N = 20;
      const winsWith = (key) => {
        const members = battle.teamA.members.map(m => (key ? { ...m, stats: { ...m.stats, [key]: Math.round((Number(m.stats && m.stats[key]) || 100) * 1.1) } } : m));
        let w = 0;
        for (let k = 0; k < N; k++) { const r = engine.simulate({ seed: `${battle.seed}-if-${k}`, catalog, teamA: { ...battle.teamA, members }, teamB: battle.teamB, ...(battle.opts || {}) }); if (r.winner === 'A') w++; else if (r.winner === 'draw') w += 0.5; }
        return w;
      };
      const base = winsWith(null);
      const list = engine.STAT_KEYS.map(k => ({ k, w: winsWith(k) })).sort((a, b) => b.w - a.w);
      setIfs({ n: N, base, best: list[0], list });
    }, 80);
    return () => clearTimeout(t);
  }, [phase, battle, ifs]);

  // 手動の試合: 選んだ手で芯を進め、記録を写し直す(決着したら結果に置きかえる)
  const syncManual = (m) => {
    const res = m.result();
    const log = res ? res.log : m.log.slice();
    setBattle(b => (b && b.match === m ? { ...b, r: res || { ...b.r, log }, frames: ambwFramesOf(log) } : b));
    return log.length;
  };
  const manualPick = (c) => {
    const m = battle && battle.match; if (!m) return;
    const busy = pos < battle.r.log.length - 1; if (busy) return;
    if (typeof msaSe === 'function') msaSe('tap');
    const r = m.choose(c); if (r && r.ok) { syncManual(m); setPos(p => p + 1); setPaused(false); }
  };
  const manualAuto = () => { const m = battle && battle.match; if (!m) return; m.auto('A'); syncManual(m); setPaused(false); };
  const [techList, setTechList] = useState(null);   // 札を押して開いた一覧 { side, d }(d が null なら全部の技)
  // 技の札の代表(段3・2026-11-13 社長)。保存は mh_assistant_masmon_battle_v1 の rep。確かめ(印が偽)では開いているあいだだけ覚える
  const [repEdit, setRepEdit] = useState(null);     // 準備画面の「技の札を決める」で開いている子の鍵
  const [repSheet, setRepSheet] = useState(null);   // その子の間合いの一覧
  const repOf = (k) => (k && save.rep && save.rep[meId] && save.rep[meId][k]) || null;
  const putRep = (k, ids) => {
    const fn = (s) => { const mine = { ...((s.rep || {})[meId] || {}) }; if (ids) mine[k] = ids; else delete mine[k]; return { ...s, rep: { ...(s.rep || {}), [meId]: mine } }; };
    if (!ambbSave(fn)) AMBB_STORE.set(normalizeAssistantMasmonBattleSave(fn(AMBB_STORE.state)));
  };
  const setRep = (k, d, id) => { if (!k) return; const nx = (repOf(k) || [null, null, null, null]).slice(); nx[d] = id; putRep(k, nx); };
  // 試合の自分の側の i 番目の子の保存の鍵(この端末の試合は同じ入れ物・フレンド対戦は種類と名前で探す)
  const repKeyOf = (i) => {
    const m = battle && battle.teamA && battle.teamA.members[i];
    if (!m || !Array.isArray(battle.units)) return null;
    const u = battle.units.find(x => x.unit === m) || battle.units.find(x => x.unit && x.unit.species === m.species && x.unit.name === m.name);
    return u ? ambbRowKey(u.row) : null;
  };
  const repIdsAt = (side, fr) => {
    const i = fr.act[side], t = side === 'A' ? battle.teamA : battle.teamB;
    const items = ambwTechItems(catalog, t.members[i], (battle.moves[side] || [])[i]);
    const k = side === 'A' ? repKeyOf(i) : null;
    return { k, items, ids: msaRepIds(items, side === 'A' ? repOf(k) : null), name: (t.members[i] || {}).name || '' };
  };
  useEffect(() => { if (typeof msaFitTechNames === 'function') msaFitTechNames(); });
  // 手番の帯が出たら、帯が見える所まで(画面がスクロールできるときだけ)縦に送る
  const manualNow = !!(battle && battle.match && !battle.match.done() && pos >= battle.r.log.length - 1 && phase === 'watch');
  useEffect(() => {
    if (!manualNow) return;
    const box = rootRef.current, el = box && box.querySelector('[data-ambb-manual]');
    if (!box || !el || box.scrollHeight <= box.clientHeight) return;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    const over = r.bottom - b.bottom + 8;
    if (over > 0) box.scrollTop += Math.min(over, Math.max(0, r.top - b.top - 8));
  }, [manualNow, pos]);
  const nameOf = (id) => ((typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST.find(a => a.id === id)) || {}).name || id;
  const faceOf = (id) => { const a = typeof ASSISTANT_LIST !== 'undefined' && ASSISTANT_LIST.find(x => x.id === id); return a ? assistantFaceSrc(a, 'normal') : ''; };
  const rec = save.rec[meId] || { w: 0, l: 0, d: 0 };
  // 上下の欄のライフ・ガッツは、技が当たる瞬間までは前の値(場の棒と同じ時に減る。56-monhero-success-arena.jsx)
  const shownF = typeof useMsaShownFrame === 'function' ? useMsaShownFrame(battle ? battle.r.log : [], battle ? battle.frames : [], pos, battle ? { A: battle.teamA, B: battle.teamB } : {}, { x1: 1, x2: 0.55, x4: 0.3 }[speed] || 1, lite) : null;

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
            <button data-ambb-mode="auto" className={modeNow === 'auto' ? 'on' : ''} onClick={() => setMode('auto')}>🤝 おまかせ<small>{me.name}が出る順と作戦を決める</small></button>
            <button data-ambb-mode="self" className={modeNow === 'self' ? 'on' : ''} onClick={() => setMode('self')}>✋ 自分で決める<small>出る順番・作戦・交代</small></button>
          </div>
        </div>
        {modeNow === 'self' && (
          <div className="ambw-card" data-ambb-self>
            <div className="ambw-small">出るマスモンと順番(押した順に出ます){picked.length < size ? `・あと ${size - picked.length} 体は能力の高い順` : ''}</div>
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
        {srcNow === 'local' && foeId && foeUnits.length > 0 && <AmbbCompare engine={engine} catalog={catalog} mine={chosen} foes={foeUnits.slice(0, size)} meName={me.name} foeName={nameOf(foeId)}/>}
        {chosen.length > 0 && typeof MsaDistCards === 'function' && (
          <div className="ambw-card" data-ambb-rep-card>
            <div className="ambw-small" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span>技の札(間合いごとの代表の技)</span>
              <button type="button" className="ambw-btn2" data-ambb-rep-open style={{ minHeight: 32, padding: '2px 12px', fontSize: 12, flex: 'none' }} onClick={() => setRepEdit(ambbRowKey(chosen[0].row))}>🃏 技の札を決める</button>
            </div>
          </div>
        )}
        <AmbbSettings set={set} onSet={setSet} local={srcNow === 'local'} size={size} sizeMax={sizeMax} onSize={(n) => setSel({ size: n, order: picked.slice(0, n) })} speed={speed} onSpeed={setSpeed} engine={engine}/>
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
    const manualWait = !!(battle.match && !battle.match.done() && pos >= log.length - 1 && battle.match.pending());
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
        <AmbwPanel side="B" catalog={catalog} teams={{ A: battle.teamA, B: battle.teamB }} team={battle.teamB} frame={shownF || f} maxHp={battle.maxHp} moves={battle.moves.B} lastMove={e.side === 'B' && e.ev === 'tech' ? e.move : null} mine={false} cards onOpen={(sd, d) => setTechList({ side: sd, d })}/>
        {/* 場は試合の画面と同じ部品(立ち位置・技の動き・数字・音。56-monhero-success-arena.jsx の MsaStage。2026-11-12 社長「ちゃんとバトル部分作りこんで」) */}
        {typeof MsaStage === 'function' ? (
          <div className="msa ambb-stagewrap" style={{ marginTop: 8 }}><style>{MSA_CSS}</style>
            <MsaStage log={log} frames={battle.frames} pos={pos} teams={{ A: battle.teamA, B: battle.teamB }} venueImg={typeof msaVenueBg === 'function' ? msaVenueBg('cup', msaBgRead()) : null}
              ended={review} win={battle.r.winner} endSub={review ? `${battle.r.rounds} ラウンド` : ''} sound={phase === 'watch' && !paused}
              introTitle={battle.pvp ? 'フレンド対戦' : 'マスモン対戦'} speedF={{ x1: 1, x2: 0.55, x4: 0.3 }[speed] || 1} fill={!review} lite={lite}/>
          </div>
        ) : (
        <div className="ambw-ring">
          <div className="ambw-stage">{fighter('A')}<div className="ambw-gap" style={{ width: gap }}/>{fighter('B')}</div>
          <div className="ambw-dist">{AMBW_DIST.map((n, d) => <span key={d} className={d === f.d ? 'cur' : ''}>{n}</span>)}</div>
          {cutText && e.ev !== 'end' && (
            <div key={`cut-${pos}`} className={`ambw-cut ${e.ev === 'tech' ? e.kind : 'etc'} ${e.side === 'B' ? 'B' : ''}`}><small>{cutSmall}</small><b>{cutText}</b></div>
          )}
        </div>
        )}
        {!manualWait && <AmbwPanel side="A" catalog={catalog} teams={{ A: battle.teamA, B: battle.teamB }} team={battle.teamA} frame={shownF || f} maxHp={battle.maxHp} moves={battle.moves.A} lastMove={e.side === 'A' && e.ev === 'tech' ? e.move : null} mine cards rep={repIdsAt('A', shownF || f).ids} onOpen={(sd, d) => setTechList({ side: sd, d })}/>}
        {!review && manualWait && typeof MsxManualBar === 'function' && (
          <div className="ambb-bar-wrap" data-ambb-manual>{(() => { const ra = repIdsAt('A', f); return <MsxManualBar opt={battle.match.pending()} onPick={manualPick} onAuto={manualAuto} busy={false} rep={ra.ids} title={ra.name} onRep={ra.k ? (d, id) => setRep(ra.k, d, id) : null}/>; })()}</div>
        )}
        {!review && !manualWait && (
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
            <button className="ambw-btn2" data-ambb-skip onClick={() => {
              // 手動のときは残りをオートで進めてから結果へ
              const n = battle.match && !battle.match.done() ? (battle.match.auto('A'), syncManual(battle.match)) : log.length;
              setPos(n - 1); setPhase('review');
            }}>⏭ 結果へ</button>
          </div>
        )}
      </div>
    );
  }

  const back = phase === 'prep' || !battle ? onClose : () => setPhase('prep');
  return (
    <div className={`ambw${phase === 'watch' && battle ? ' ambb-full' : ''}`} data-ambb-root ref={rootRef}>
      <style>{AMBW_CSS}{AMBB_CSS}</style>
      <div className="ambw-in">
        <div className="ambw-top">
          <button className="ambw-btn2" data-ambb-close onClick={phase === 'rank' && !battle ? () => setPhase('prep') : back}>← {phase === 'prep' ? 'もどる' : 'じゅんびへ'}</button>
          <span>⚔ マスモンで対戦<span className="ambb-beta">β</span></span>
          <b>{phase === 'watch' && battle ? `ラウンド ${(battle.frames[pos] || {}).r || 0}` : ''}</b>
        </div>
        {body}
      </div>
      {techList && battle && phase !== 'prep' && (() => {
        const side = techList.side, d = techList.d, fr = battle.frames[Math.min(pos, battle.frames.length - 1)] || battle.frames[0];
        const r = repIdsAt(side, fr), teams = { A: battle.teamA, B: battle.teamB };
        const hitAt = (x, dd) => { const v = ambwHitPct(catalog, teams, side, { ...fr, d: dd }, x.id); return v != null ? v : x.hit; };
        return (
          <div data-ambb-techlist={side}>
            <MsaTechSheet title={`${r.name} の${d == null ? `技(${r.items.length})` : `${AMBW_DIST[d]}の技`}`} list={r.items} d={d} dist={fr.d} rep={r.ids} hitAt={hitAt}
              onRep={r.k && d != null ? (dd, id) => setRep(r.k, dd, id) : null} onClose={() => setTechList(null)}/>
          </div>
        );
      })()}
      {repEdit && phase === 'prep' && catalog && (() => {
        // 準備画面の「🃏 技の札を決める」: 出る子を先に、ほかの子も決められる
        const units = chosen.concat(myUnits.filter(u => !chosen.includes(u)));
        const u = units.find(x => ambbRowKey(x.row) === repEdit) || units[0];
        if (!u) return null;
        const k = ambbRowKey(u.row), items = ambbUnitTechItems(engine, catalog, u.unit), ids = msaRepIds(items, repOf(k));
        const nm = (x) => x.row.nick || ALL_PLAYER_MONSTERS[x.row.monster].name;
        const close = () => { setRepEdit(null); setRepSheet(null); };
        return (
          <>
            <div className="msa-sh" data-ambb-rep-edit onClick={close}><style>{MSA_DC_CSS}</style>
              <div className="msa-sh-in" onClick={(ev) => ev.stopPropagation()}>
                <div className="msa-sh-top"><b>🃏 技の札を決める</b><button type="button" className="msa-sh-x" onClick={close}>閉じる</button></div>
                <p className="msa-sh-note">試合で間合いごとに出す技(代表の技)です。札を押して、一覧の「☆ 代表にする」で決めます。決めていない間合いは「命中×威力」がいちばん大きい技になります。</p>
                <div className="ambb-tabs" style={{ flexWrap: 'wrap', marginTop: 6 }}>{units.map(x => (
                  <button key={ambbRowKey(x.row)} type="button" data-ambb-rep-unit={ambbRowKey(x.row)} className={ambbRowKey(x.row) === k ? 'on' : ''} onClick={() => { setRepEdit(ambbRowKey(x.row)); setRepSheet(null); }}>{chosen.includes(x) ? '⚔ ' : ''}{nm(x)}</button>
                ))}</div>
                <div style={{ marginTop: 8 }}><MsaDistCards list={items} rep={ids} hitAt={(t) => t.shown} onOpen={(d) => setRepSheet(d)} dataSide="prep"/></div>
                {repOf(k) ? <div style={{ textAlign: 'right', marginTop: 8 }}><button type="button" className="ambw-btn2" data-ambb-rep-reset style={{ minHeight: 30, padding: '2px 12px', fontSize: 12 }} onClick={() => putRep(k, null)}>このモンスターをおまかせに戻す</button></div> : null}
              </div>
            </div>
            {repSheet != null && <MsaTechSheet title={`${nm(u)} の${AMBW_DIST[repSheet]}の技`} list={items} d={repSheet} rep={ids} hitAt={(t) => t.shown} onRep={(d, id) => setRep(k, d, id)} onClose={() => setRepSheet(null)}/>}
          </>
        );
      })()}
      {ask && me && <AssistantMasmonAskSheet who={me} from="masmon" t={ask.t} initialText={ask.text} onClose={() => setAsk(null)}/>}
    </div>
  );
}

// ---------- 試合前の比べっこ(2026-11-13 段2) ----------
// 両者の能力を左右から伸びる棒で見くらべる(左 = 自分・右 = 相手)。種類の等級(ガッツ回復力・移動速度・サイズ・間合い適性)も並べる
const AMBB_SIZE_JP = Object.freeze({ S: '小さい', M: 'ふつう', L: '大きい' });
function AmbbCompare({ engine, catalog, mine, foes, meName, foeName }) {
  const [at, setAt] = useState(0);
  const n = Math.min(mine.length, foes.length);
  if (!n) return null;
  const i = Math.min(at, n - 1);
  const a = mine[i], b = foes[i];
  const ua = a.unit || {}, ub = b.unit || {};
  const ta = typeof engine.unitTraits === 'function' ? engine.unitTraits(catalog, ua) : null;
  const tb = typeof engine.unitTraits === 'function' ? engine.unitTraits(catalog, ub) : null;
  const keys = engine.STAT_KEYS || ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
  // 芯と同じく、育成の記録が無い能力は 100 として見せる(normalizeUnit)
  const sv = (u, k) => { const v = u.stats && typeof u.stats === 'object' ? u.stats[k] : undefined; const n = Number(v); return v !== null && v !== undefined && v !== '' && Number.isFinite(n) ? Math.max(0, Math.min(999, Math.round(n))) : 100; };
  const top = Math.max(1, ...keys.map(k => Math.max(sv(ua, k), sv(ub, k))));
  const grades = [...(engine.GUTS_REGEN_GRADES || []), ...(engine.GUTS_REGEN_GRADES_UP || [])];
  const aptGrades = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+', 'SS', 'SS+', 'M'];
  const gIdx = (list, g) => Math.max(0, list.indexOf(g));
  const row = (label, va, vb, fa, fb, txtA, txtB, k) => (
    <div key={k} className="ambb-cmp-row" data-ambb-cmp-row={k}>
      <b className={`L ${va > vb ? 'win' : ''}`}>{txtA}</b>
      <div className="ambb-bar L"><i key={`${i}-${k}`} style={{ width: `${Math.round(fa * 100)}%` }}/></div>
      <span>{label}</span>
      <div className="ambb-bar R"><i key={`${i}-${k}`} style={{ width: `${Math.round(fb * 100)}%` }}/></div>
      <b className={`R ${vb > va ? 'win' : ''}`}>{txtB}</b>
    </div>
  );
  const img = (u) => (typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[u.species] ? ALL_PLAYER_MONSTERS[u.species].imgUrl : '');
  const nm = (x) => (x.row && x.row.nick) || (x.unit && x.unit.name) || '';
  const regenG = (t) => (t && t.regenGrade) || '';
  const sizeV = { S: 1, M: 2, L: 3 };
  return (
    <div className="ambw-card" data-ambb-compare>
      <div className="ambw-small" style={{ textAlign: 'center' }}>試合前の比べっこ</div>
      {n > 1 && <div className="ambb-tabs" style={{ marginTop: 6 }}>{Array.from({ length: n }, (_, j) => <button key={j} data-ambb-cmp-pair={j} className={j === i ? 'on' : ''} onClick={() => setAt(j)}>{j + 1}番手</button>)}</div>}
      <div className="ambb-cmp-head" style={{ marginTop: 6 }}>
        <div><img className="ambw-flip" src={img(ua)} alt=""/><span style={{ minWidth: 0 }}><b>{nm(a)}</b><small>{meName}・Lv{ua.lv || 1}</small></span></div>
        <em>VS</em>
        <div><img src={img(ub)} alt=""/><span style={{ minWidth: 0 }}><b>{nm(b)}</b><small>{foeName}・Lv{ub.lv || 1}</small></span></div>
      </div>
      <div className="ambb-cmp-sec">能力</div>
      {keys.map(k => row(AMBW_STAT_JP[k] || k, sv(ua, k), sv(ub, k), sv(ua, k) / top, sv(ub, k) / top, sv(ua, k), sv(ub, k), k))}
      {ta && tb && <>
        <div className="ambb-cmp-sec">種類の等級</div>
        {row('ガッツ回復力', ta.regen, tb.regen, (ta.regen || 0) / 15, (tb.regen || 0) / 15, regenG(ta) || ta.regen, regenG(tb) || tb.regen, 'regen')}
        {row('移動速度', gIdx(grades, ta.move), gIdx(grades, tb.move), (gIdx(grades, ta.move) + 1) / 7, (gIdx(grades, tb.move) + 1) / 7, ta.move, tb.move, 'move')}
        {row('サイズ', 0, 0, (sizeV[ta.size] || 2) / 3, (sizeV[tb.size] || 2) / 3, AMBB_SIZE_JP[ta.size] || 'ふつう', AMBB_SIZE_JP[tb.size] || 'ふつう', 'size')}
        <div className="ambb-cmp-sec">間合い適性</div>
        {[0, 1, 2, 3].map(d => row(`${AMBW_DIST[d]}距離`, gIdx(aptGrades, ta.apt[d]), gIdx(aptGrades, tb.apt[d]), (gIdx(aptGrades, ta.apt[d]) + 1) / 12, (gIdx(aptGrades, tb.apt[d]) + 1) / 12, ta.apt[d], tb.apt[d], `apt${d}`))}
        <div className="ambb-cmp-note"><div>ガッツ回復力が高いと、与えるダメージは少し下がる</div><div>移動速度が速いと先手を取りやすく、受けるダメージは少し増える</div><div>小さいと当たりにくく、大きいと受けるダメージが減る</div></div>
      </>}
    </div>
  );
}

// ---------- 試合の設定(2026-11-13 段2) ----------
// この端末の練習の対戦だけに効く。フレンド対戦は人数と見え方(速さ・演出)だけ
function AmbbSettings({ set, onSet, local, size, sizeMax, onSize, speed, onSpeed, engine }) {
  const chips = (key, list, labelOf, noteOf) => (
    <div className="ambb-tabs">{list.map((o) => {
      const id = typeof o === 'object' ? o.id : o;
      return <button key={String(id)} data-ambb-set={`${key}:${id}`} className={set[key] === id ? 'on' : ''} onClick={() => onSet({ [key]: id })}>{labelOf(o)}{noteOf && noteOf(o) ? <small>{noteOf(o)}</small> : null}</button>;
    })}</div>
  );
  const diff = ambbSetDiff(set);
  const limit = (engine && engine.ROUND_LIMIT) || 150;
  return (
    <div className="ambw-card" data-ambb-settings>
      <div className="ambw-small" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>⚙ 試合の設定</span>
        {local && diff > 0 && <button className="ambw-btn2" style={{ minHeight: 28, padding: '2px 10px', fontSize: 11 }} data-ambb-set-reset onClick={() => onSet({ ...AMBB_SET_DEF, fx: set.fx, ctl: set.ctl })}>いつもの決まりに戻す</button>}
      </div>
      <div className="ambb-set-row"><span>人数</span>
        <div className="ambb-tabs">{[1, 2, 3].map(k => <button key={k} data-ambb-size={k} disabled={k > sizeMax} className={size === k ? 'on' : ''} onClick={() => onSize(k)}>{k}対{k}</button>)}</div>
      </div>
      {local && <>
        <div className="ambb-set-row"><span>操作</span>{chips('ctl', AMBB_SET_OPTS.ctl, o => o.label, o => o.note)}</div>
        <div className="ambb-set-row"><span>形式</span>{chips('team', AMBB_SET_OPTS.team, o => o.label, o => o.note)}</div>
        <div className="ambb-set-row"><span>ラウンド上限</span>{chips('rounds', AMBB_SET_OPTS.rounds, o => `${o}`)}</div>
        <div className="ambb-set-row"><span>最初の間合い</span>{chips('dist', AMBB_SET_OPTS.dist, o => (o === 'auto' ? 'おまかせ' : AMBW_DIST[o]))}</div>
        <div className="ambb-set-row"><span>ガッツの初期値</span>{chips('guts', AMBB_SET_OPTS.guts, o => `${o}`)}</div>
      </>}
      <div className="ambb-set-row"><span>速さ</span>
        <div className="ambb-tabs">{AMBW_SPEEDS.map(sp => <button key={sp.id} data-ambb-set={`speed:${sp.id}`} className={speed === sp.id ? 'on' : ''} onClick={() => onSpeed(sp.id)}>{sp.id === 'hl' ? '★見せ場' : sp.label}</button>)}</div>
      </div>
      <div className="ambb-set-row"><span>演出</span>{chips('fx', AMBB_SET_OPTS.fx, o => o.label)}</div>
      {local && (
        <details className="ambb-fold" data-ambb-tune>
          <summary>🔧 調整(試す人向け)</summary>
          <div className="ambb-set-row"><span>ラウンド上限</span><div><input type="range" min="10" max="300" step="5" value={set.rounds} data-ambb-tune-rounds onChange={(ev) => onSet({ rounds: Number(ev.target.value) })}/><div className="ambw-small">{set.rounds} ラウンド(いつもは {limit})</div></div></div>
          <div className="ambb-set-row"><span>ガッツの初期値</span><div><input type="range" min="0" max="99" step="1" value={set.guts} data-ambb-tune-guts onChange={(ev) => onSet({ guts: Number(ev.target.value) })}/><div className="ambw-small">{set.guts}(いつもは {AMBB_SET_DEF.guts})</div></div></div>
          <div className="ambb-set-row"><span>能力の差</span>{chips('balance', AMBB_SET_OPTS.balance, o => o.label)}</div>
          <div className="ambb-set-row"><span>試合の流れ</span>
            <div className="ambb-tabs">
              <button data-ambb-set="seedLock:false" className={!set.seedLock ? 'on' : ''} onClick={() => onSet({ seedLock: false })}>毎回ちがう</button>
              <button data-ambb-set="seedLock:true" className={set.seedLock ? 'on' : ''} onClick={() => onSet({ seedLock: true })}>同じ流れで<small>設定だけ変えて見くらべる</small></button>
            </div>
          </div>
        </details>
      )}
      <p className="ambw-small" style={{ marginTop: 6 }}>{local ? 'この設定は、この端末の助手どうしの対戦だけに効きます。フレンド対戦とランキングはいつもの決まりのままです。' : 'フレンド対戦の決まりはいつものままです(人数・速さ・演出だけ選べます)。'}</p>
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
