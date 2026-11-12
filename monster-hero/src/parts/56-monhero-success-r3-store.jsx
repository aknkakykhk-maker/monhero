// ===== モンヒロサクセス 回3 の土台: 試合を回す・大会の名前・保存枠へしまう・優勝ずみの大会・ランキングへ送る口 =====
// 計画: docs/progress/player-raise/PLAN.md(§1 大会・引退/§3 保存枠/§9 保存)・TOURNAMENT.md(§9・§14・§15)・RANKING.md(§2)
// ★計算は data/monhero-success.js(芯)を呼ぶだけ。試合は助手マスモン対戦の芯(data/assistant-masmon-battle.js)を1対1で回す
//   (回し方は tools/success/success-sim.js の fight と同じ。端末だけ・サーバには送らない)。
// ★保存は回2と同じ新しいキーだけ(CLAUDE.md ⑦): mh_monsuc_box_v1(引退した子を足す)・mh_monsuc_meta_v1(wonCups・retired・best を足す)。
//   どちらも「今ある中身に足す」だけ。知らない項目は消さない。壊れていて読めない値は mh_monsuc_box_v1_broken に写してから書く。
//   二重に押しても1回: 保存枠に同じ育成の id があれば足さない(paid)。
// ★ランキングへ送るのは別の会話(RANKING.md)。ここは引退のときに monsucRankSubmit({ run:s, ev, name, colors, debug }) を呼ぶ「送る口」だけ
//   (無ければ何もしない・待たない)。ゲームオーバー(デビュー戦3回負け)は呼ばない。デバッグの入口から遊んだ育成は debug:true。
// ★称号(data/monhero-success-titles.js)・アシスト能力(-assist.js)・育成の記録帳(-record.js・キー mh_monsuc_record_v1)は、
//   引退の画面を開いたときにだけ読む(msxR3LoadTables)。読めなければ芯の表だけで動く。
const MSX_R3_GEAR = Object.freeze({ debut: 5, junior: 10, middle: 20, pro: 30, final: 40 }); // 育てる子の作戦(試算の fight と同じ)
// 評価は助手マスモンと同じ11段(G〜M)+500ごとの番号(芯の gradeOf → { rank, step, label:'A2', min, next, toNext })。PLAN §1・RANKING §7
const MSX_R3_RANKS = Object.freeze([['G', 0], ['F', 2000], ['E', 3000], ['D', 4500], ['C', 6000], ['B', 8000], ['A', 11000], ['S', 14000], ['SS', 16000], ['SSS', 18000], ['M', 19500]]);
const msxR3Ranks = () => (typeof MASMON_CALC !== 'undefined' && MASMON_CALC && Array.isArray(MASMON_CALC.RANKS) ? MASMON_CALC.RANKS : MSX_R3_RANKS);
const MSX_R3_CUP_ICON = Object.freeze({
  str: '💪', int: '🧠', aim: '🎯', dodge: '💨', hard: '🛡️', life: '❤️', dist0: '🤜', dist1: '👊', dist2: '🏹', dist3: '🔭',
  attacker: '⚔', tank: '🧱', supporter: '🎺', healer: '🌿', shadow: '🌑', spring: '🌸', summer: '🌻', autumn: '🍁', winter: '⛄', normal: '🏟', herosummer: '👑', herowinter: '👑', debut: '🎀', peak: '🗻',
});
const msxR3Stars = (n) => (n >= 4 ? '👑' : '★'.repeat(Math.max(1, n || 1)));
const msxR3CupName = (sys) => {
  const names = typeof window !== 'undefined' && window.MONSUC_REGULAR_CUPS ? window.MONSUC_REGULAR_CUPS : {};
  if (names[sys]) return String(names[sys]).replace(/(自慢|大会)$/, (m) => (m === '自慢' ? '自慢の大会' : m));
  const S = msxSuc && msxSuc.SUC; const aid = typeof sys === 'string' && sys.startsWith('sc') ? sys.slice(2) : '';
  if (aid && S && S.SC_NAME && S.SC_NAME[aid]) return S.SC_NAME[aid];
  return 'ふつうの大会';
};
// 戦う大会(s.battle)の名前
const msxR3BattleName = (SUC, b) => {
  if (!b) return '';
  if (b.kind === 'summit') return (SUC.SUMMIT[b.round] || {}).name || '頂への道';
  if (b.kind === 'cup') return `${msxR3CupName(b.sys)} ${msxR3Stars(b.star)}`;
  return (SUC.FORCED[b.kind] || {}).name || '大会';
};
const msxR3BattleIcon = (b) => (!b ? '🏆' : b.kind === 'cup' ? (MSX_R3_CUP_ICON[b.sys] || '🏆') : b.kind === 'summit' ? '🗻' : b.kind === 'debut' ? '🎀' : b.kind === 'pro' ? '👑' : '🏆');
const msxR3Grade = (power) => {
  const S = msxSuc && msxSuc.SUC;
  if (S && typeof S.gradeOf === 'function') return S.gradeOf(power);
  const R = msxR3Ranks(); const p = Math.max(0, Number(power) || 0); let i = 0; R.forEach(([, min], j) => { if (p >= min) i = j; });
  const min = R[i][1]; const step = Math.floor((p - min) / 500) + 1;
  return { rank: R[i][0], step, label: `${R[i][0]}${step}`, min, next: R[i + 1] ? R[i + 1][1] : null, toNext: 500 - ((p - min) % 500) };
};
// 引退の台詞の帯(台本の r1〜r4): G〜D / C・B / A・S / SS 以上
const msxR3Band = (rank) => (['G', 'F', 'E', 'D'].includes(rank) ? 1 : ['C', 'B'].includes(rank) ? 2 : ['A', 'S'].includes(rank) ? 3 : 4);

// ---- 試合(1対1)。同じ育成・同じ大会・同じやり直しの回なら、何度開いても同じ試合 ----
let msxR3CatCache = null;
const msxR3Catalog = (engine) => {
  if (!msxR3CatCache && engine && typeof ambwTechTable === 'function') {
    try { msxR3CatCache = engine.buildCatalog({ ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS: ambwTechTable() }); } catch (e) { msxR3CatCache = null; }
  }
  return msxR3CatCache;
};
const msxR3LoadEngine = () => (typeof ambwLoadEngine === 'function' ? ambwLoadEngine() : Promise.resolve(null));
const msxR3Fight = (engine, SUC, run) => {
  const s = run.s; const b = s.battle; if (!engine || !b) return null;
  const cat = msxR3Catalog(engine); if (!cat || !cat.species) return null;
  const opp = (SUC.opponents(s) || [])[0]; if (!opp) return null;
  const spOf = (sp) => (cat.species[sp] ? sp : 'Mocchi');
  const sp = spOf(s.species); const own = (cat.species[sp].techs || []).map((t) => t.id);
  const ts = (Array.isArray(s.techs) ? s.techs : []).filter((t) => own.includes(t));
  const loy = typeof SUC.loyalOf === 'function' ? SUC.loyalOf(s) : 100;
  const a = { species: sp, name: run.nick || msxMonName(sp), lv: 1, stats: s.stats, loy, pop: s.pop,
    ...(ts.length ? { techs: ts, mastery: Object.fromEntries(ts.map((t) => [t, (s.mastery && s.mastery[t]) || 0])) } : {}) };
  const osp = spOf(opp.species); const ots = (cat.species[osp].techs || []).slice(0, Math.max(1, opp.techs || 2)).map((t) => t.id);
  const o = { species: osp, name: opp.name || msxMonName(osp), lv: 1, stats: opp.stats, techs: ots, ...(Number.isFinite(opp.loy) ? { loy: opp.loy } : {}), ...(Number.isFinite(opp.pop) ? { pop: opp.pop } : {}), mastery: Object.fromEntries(ots.map((t) => [t, opp.mastery || 0])) };
  const teamA = { assistantId: s.aid, tactics: MSX_R3_GEAR[SUC.periodOf(s.turn).key] || 10, members: [a] };
  const teamB = { assistantId: 'kiki', tactics: opp.tactics || 10, members: [o] };
  // 試合の上乗せ: 芯の battleBuffs(編成の試合型アシスト + 特別な1話)。古い芯なら battleMods だけ
  const mods = typeof SUC.battleBuffs === 'function' ? (SUC.battleBuffs(s) || {}) : typeof SUC.battleMods === 'function' ? SUC.battleMods(s) : {};
  const seed = `${s.id}:${s.turn}:${b.kind}:${b.retry || 0}:${b.round || 0}:0:${b.again || 0}`;
  // input: simulate に渡したものそのもの(trace なし)。バトル部の自分で操作する試合(MonsucArena の createMatch)がこれで同じ試合を始める
  const input = { seed, catalog: cat, teamA, teamB, ...(mods && Object.keys(mods).length ? { buffs: { A: mods } } : {}) };
  let r = null;
  try { r = engine.simulate({ ...input, trace: true }); } catch (e) { return null; }
  const st = (r.log && r.log[0]) || {};
  return { r, input, opp, teamA, teamB, won: r.winner === 'A', frames: typeof ambwFramesOf === 'function' ? ambwFramesOf(r.log) : [], maxHp: { A: st.aHp || [], B: st.bHp || [] }, moves: { A: st.aMoves || [], B: st.bMoves || [] } };
};

// ---- 保存(足すだけ) ----
const msxR3Obj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const msxR3ReadBox = async () => {
  const raw = await storeGet(MSX_KEYS.box, null);
  if (raw == null) return { v: 1, cap: MSX_BOX_CAP0, mons: [], memory: [] };
  if (!msxR3Obj(raw) || !Array.isArray(raw.mons)) { try { await storeSet('mh_monsuc_box_v1_broken', raw); } catch (e) {} return { v: 1, cap: MSX_BOX_CAP0, mons: [], memory: [] }; }
  return { ...raw, v: 1, cap: Math.max(MSX_BOX_CAP0, Math.min(60, Number.isFinite(raw.cap) ? raw.cap : MSX_BOX_CAP0)), mons: raw.mons.filter(msxR3Obj), memory: Array.isArray(raw.memory) ? raw.memory.filter(msxR3Obj) : [] };
};
const msxR3ReadMeta = async () => {
  const raw = await storeGet(MSX_KEYS.meta, null);
  if (raw != null && !msxR3Obj(raw)) { try { await storeSet('mh_monsuc_meta_v1_broken', raw); } catch (e) {} }
  const o = msxR3Obj(raw) ? raw : { v: 1 };
  return { ...o, v: 1, wonCups: Array.isArray(o.wonCups) ? o.wonCups.filter((k) => typeof k === 'string').slice(0, 200) : [], retired: Number.isFinite(o.retired) ? Math.max(0, Math.floor(o.retired)) : 0, best: msxR3Obj(o.best) ? o.best : {}, titles: Array.isArray(o.titles) ? o.titles.filter((x) => typeof x === 'string').slice(0, 200) : [] };
};
// 優勝ずみの大会(スキップできる大会)を足す。ゲームオーバーでも足す(勝った大会は勝った)
const msxR3AddWon = (meta, s) => {
  const won = Array.isArray(s.wonNow) ? s.wonNow.filter((k) => typeof k === 'string') : [];
  return { ...meta, wonCups: Array.from(new Set([...(meta.wonCups || []), ...won])).slice(0, 200) };
};
const msxR3BoxCap = (retired) => Math.min(60, MSX_BOX_CAP0 + 5 * Math.floor(Math.max(0, retired) / 10)); // 引退10回ごとに +5・最大60(PLAN §3)
const msxR3FinalTitles = (s, ev) => {
  const T = msxR3T().titles;
  try { if (T) return T.finalize(s.titles, ev, s); } catch (e) {}
  return Array.isArray(s.titles) ? s.titles.filter((t) => typeof t === 'string').slice(0, 64) : [];
};
// 保存枠の子の形(回2の msxNormBoxMon が読む項目 + 回3で足す項目: gen・techs・gt・fav・titles・paid・over・from)
const msxR3BoxMonOf = (run, s, ev, assists, parent) => ({
  id: run.id, species: s.species, nick: run.nick || '', colors: Array.isArray(run.colors) ? run.colors.slice(0, 6) : [],
  gen: parent && Number.isFinite(parent.gen) ? parent.gen : 1, parents: parent && Array.isArray(parent.parents) ? parent.parents.slice(0, 2) : [],
  st: { ...s.stats }, techs: Array.isArray(s.techs) ? s.techs.slice(0, 8) : [], mast: (Array.isArray(s.techs) ? s.techs : []).slice(0, 8).map((t) => Math.round((s.mastery && s.mastery[t]) || 0)),
  loy: ev.loyal, pop: s.pop, lv: s.lv, gt: s.type, rank: ev.rank, grade: msxR3Grade(ev.power).label, score: ev.power, fav: Array.isArray(ev.top) ? ev.top.slice(0, 3) : [],
  raised: true, coach: s.aid, endAt: Date.now(), paid: true, over: s.over || 'done', assists: (assists || []).slice(0, 4),
  titles: msxR3FinalTitles(s, ev), from: run.from || null,
});
// 引退した子を保存枠へ。{ ok, full, box, meta }。同じ id がもうあれば足さない(二度押し・中断のあとでも1回)
const msxR3Retire = async (run, s, ev, assists, debug) => {
  const box = await msxR3ReadBox(); let meta = await msxR3ReadMeta();
  if (box.mons.some((m) => m.id === run.id)) return { ok: true, already: true, box, meta };
  const fromId = run.from && typeof run.from.box === 'string' ? run.from.box : null; // 保存枠の「未育成の子」から始めた育成なら、その子が育った
  const parent = fromId ? box.mons.find((m) => m.id === fromId && m.raised === false) : null;
  const rest = parent ? box.mons.filter((m) => m !== parent) : box.mons;
  if (rest.length >= box.cap) return { ok: false, full: true, box, meta };
  const mon = msxR3BoxMonOf(run, s, ev, assists, parent);
  meta = msxR3AddWon(meta, s);
  meta.retired += 1;
  const best = msxR3Obj(meta.best[s.species]) ? meta.best[s.species] : null;
  if (!best || !(best.power >= ev.power)) meta.best = { ...meta.best, [s.species]: { power: ev.power, rank: ev.rank, id: run.id } };
  meta.titles = Array.from(new Set([...(meta.titles || []), ...(Array.isArray(s.titles) ? s.titles : [])])).slice(0, 200);
  const next = { ...box, cap: Math.max(box.cap, msxR3BoxCap(meta.retired)), mons: [...rest, mon] };
  await storeSet(MSX_KEYS.box, next); // 先に子を書き、そのあと途中の育成を消す(消えたのに入っていない、を作らない)
  await storeSet(MSX_KEYS.meta, meta);
  await msxR3AddRecord(run, s, ev, mon.titles, mon.gen);
  msxR3RankSend(run, s, ev, debug);
  return { ok: true, box: next, meta, mon };
};
// ゲームオーバー: 保存枠には入れない(PLAN §1・TOURNAMENT §12 E は「思い出」の扱いを窓口へ)。優勝ずみの大会だけ足す
const msxR3GameOver = async (s) => {
  const meta = msxR3AddWon(await msxR3ReadMeta(), s);
  await storeSet(MSX_KEYS.meta, meta);
  return meta;
};
const msxR3ClearRun = () => storeSet(MSX_KEYS.run, null);
// 保存枠から外す(お別れ)。「思い出」に名前・種・ランクだけ残す(新しい100件)
const msxR3Farewell = async (id) => {
  const box = await msxR3ReadBox(); const m = box.mons.find((x) => x.id === id); if (!m) return box;
  const next = { ...box, mons: box.mons.filter((x) => x.id !== id), memory: [...box.memory, { nick: m.nick || '', species: m.species, rank: m.grade || m.rank || '', gen: m.gen || 1, at: Date.now() }].slice(-100) };
  await storeSet(MSX_KEYS.box, next);
  return next;
};

// ---- ランキングへ送る口(送る仕組みは別の会話。RANKING.md §1・§2 の列の形で渡す) ----
const msxR3RankRow = (run, s, ev, debug) => {
  const lin = typeof MONSTER_LINEAGE_MAP !== 'undefined' && MONSTER_LINEAGE_MAP && MONSTER_LINEAGE_MAP[s.species] ? MONSTER_LINEAGE_MAP[s.species] : null; // 主血統(data/lineages.js)
  return {
    run_id: run.id, child_name: run.nick || '', species: s.species, lineage: lin && lin.main ? lin.main : null,
    dye: Array.isArray(run.colors) ? run.colors.slice(0, 6) : [], stats: { ...s.stats },
    techs: (Array.isArray(s.techs) ? s.techs : []).slice(0, 8).map((t) => Math.round((s.mastery && s.mastery[t]) || 0)),
    lv: s.lv, loyal: ev.loyal, pop: s.pop, power: ev.power, grade: ev.rank, gradeLabel: msxR3Grade(ev.power).label,
    engine_version: msxSuc && msxSuc.core ? msxSuc.core.VERSION : null, over: s.over || 'done', debug: !!debug,
  };
};
const msxR3RankSend = (run, s, ev, debug) => {
  try {
    if (s.over === 'gameover') return false;
    if (typeof monsucRankSubmit === 'function') { monsucRankSubmit({ run: s, ev, name: run.nick || '', colors: Array.isArray(run.colors) ? run.colors : [], debug: !!debug, runId: run.id }); return true; }
    if (typeof window !== 'undefined' && typeof window.MONSUC_RANK_SEND === 'function') { window.MONSUC_RANK_SEND(msxR3RankRow(run, s, ev, debug)); return true; }
    return false;
  } catch (e) { return false; }
};

// ---- 称号・アシスト能力・記録帳の表(開いたときに読む) ----
let msxR3Tables = null;
const msxR3LoadTables = () => {
  if (!msxR3Tables) {
    const one = (src, g) => (typeof window !== 'undefined' && window[g] ? Promise.resolve(window[g]) : typeof msxLoadScript === 'function' ? msxLoadScript(src, g) : Promise.resolve(null));
    msxR3Tables = Promise.all([one('data/monhero-success-titles.js', 'MONHERO_SUCCESS_TITLES'), one('data/monhero-success-assist.js', 'MONHERO_SUCCESS_ASSIST'), one('data/monhero-success-record.js', 'MONHERO_SUCCESS_RECORD')])
      .then(([titles, assist, record]) => ({ titles, assist, record }));
  }
  return msxR3Tables;
};
const msxR3T = () => ({
  titles: typeof window !== 'undefined' ? window.MONHERO_SUCCESS_TITLES || null : null,
  assist: typeof window !== 'undefined' ? window.MONHERO_SUCCESS_ASSIST || null : null,
  record: typeof window !== 'undefined' ? window.MONHERO_SUCCESS_RECORD || null : null,
});
const msxR3TitleName = (t) => { const T = msxR3T().titles; try { return T ? T.nameOf(t) : t; } catch (e) { return t; } };
// 育成の記録帳に1件(同じ id は2度入らない)
const msxR3AddRecord = async (run, s, ev, titles, gen) => {
  const R = msxR3T().record; if (!R) return false;
  try {
    const raw = await storeGet(R.KEY, null);
    const r = R.add(R.parse(raw), { id: run.id, species: s.species, nick: run.nick || '', rank: ev.rank, power: ev.power, sum: ev.sum, titles, aid: s.aid, endAt: Date.now(), gen });
    if (r.added) await storeSet(R.KEY, r.book);
    return r.added;
  } catch (e) { return false; }
};

// ---- 台詞(台本エンジン data/monhero-success-script-engine.js・キズナ #5747)。読めなければ画面の文(fallback)を出す ----
const msxR3SE = () => (typeof window !== 'undefined' && window.MONHERO_SUCCESS_SCRIPT_ENGINE) || null;
const msxR3SeLoading = {};
const msxR3LoadSE = (aid) => {
  if (!msxR3SeLoading[aid]) {
    const get = msxR3SE() ? Promise.resolve(msxR3SE()) : typeof msxLoadScript === 'function' ? msxLoadScript('data/monhero-success-script-engine.js', 'MONHERO_SUCCESS_SCRIPT_ENGINE') : Promise.resolve(null);
    msxR3SeLoading[aid] = get.then((SE) => (SE && typeof SE.load === 'function' ? SE.load(aid).then(() => SE) : null)).catch(() => null);
  }
  return msxR3SeLoading[aid];
};
// 開いたときに読み、読めたら描き直す
const useMsxR3Lines = (aid) => {
  const [, setN] = useState(0);
  useEffect(() => { let alive = true; msxR3LoadSE(aid).then(() => { if (alive) setN((n) => n + 1); }); return () => { alive = false; }; }, [aid]);
};
const msxR3Q = (t) => { const x = String(t || ''); return /^[「『(]/.test(x) ? x : `「${x}」`; };
const msxR3Line = (scene, run, extra, fallback, opt) => {
  const SE = msxR3SE(); const s = run.s;
  try {
    if (SE) {
      const l = SE.say(scene, { id: s.id, turn: s.turn, aid: s.aid, mon: run.nick || '', species: s.species, ...(extra || {}) }, opt || {});
      if (l && l.t) return { t: msxR3Q(l.t), e: l.e || null };
    }
  } catch (e) {}
  return { t: fallback, e: null };
};
