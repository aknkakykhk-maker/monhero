// 助手のマスモンの「冬眠」(2026-11-12 キズナ・社長の答え 台帳 2026-11-12 マスモン部)。案 docs/progress/assistant-peer/masmon-plan/HIBERNATE.md
//   育てた中身(名前・色・種類・Lv・型・6能力・育成Lv・疲れ・ストレス・技と熟練・けがの残り)を写して箱にしまい、あとで眠らせた助手の枠へ起こせる
//   眠っている間は育たない・疲れ/ストレスも動かない・対戦に出ない(起きている枠にいないので、育成の計算にも対戦にも出ない)
//   枠が空かないよう、眠らせるのは「冬眠中の子と入れ替える」形だけ(勇者モンの枠1も同じ)。提案の入れ替えで外れた「前にいた子」も冬眠の一覧に並ぶ
//   保存できる数: はじめ10体・育成ノートの段ごとに+5(最大30・全助手で共通)。上限を超えた分も消さない(⑦)
//   保存は新しいキー mh_assistant_masmon_sleep_v1 だけ。起きている子のキー(masmon・育成・修行)は形も意味も変えない(起こすときに、その子の行を書くだけ)
//   公開の印 RELEASE_FLAGS.assistantMasmonSleep(と育成ノートの印)が真のときだけ動く
const ASSISTANT_MASMON_SLEEP_KEY = 'mh_assistant_masmon_sleep_v1';
const AMGS_CAP = Object.freeze([10, 15, 20, 25, 30]); // 育成ノートの段1〜5
const AMGS_MAX_BEDS = 200; // 読み込みで捨てない上限(壊れた保存で膨らみすぎないように)
const amgsOn = () => typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS && RELEASE_FLAGS.assistantMasmonSleep === true && typeof amgpOn === 'function' && amgpOn();
const amgsMonOk = (mo) => typeof mo === 'string' && /^\w{2,40}$/.test(mo) && typeof ALL_PLAYER_MONSTERS !== 'undefined' && !!ALL_PLAYER_MONSTERS[mo];
const amgsRowOf = (r) => {
  if (!r || typeof r !== 'object' || !amgsMonOk(r.monster)) return null;
  const txt = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  return { monster: r.monster, nick: txt(r.nick, 16), lv: Number.isFinite(Number(r.lv)) ? Math.max(1, Math.min(999, Math.round(Number(r.lv)))) : 1, grow: txt(r.grow, 24), why: txt(r.why, 60), role: txt(r.role, 12), welcome: Number.isFinite(Number(r.welcome)) ? Math.round(Number(r.welcome)) : 1, colors: (Array.isArray(r.colors) ? r.colors : []).slice(0, 5).map(c => (typeof c === 'string' ? c.slice(0, 40) : null)), ai: !!r.ai };
};
// 育成・修行の1体ぶんの写しは、それぞれの正規化を通して確かめる(壊れていれば null)
const amgsGrowOk = (aid, monster, g) => { try { if (!g || typeof normalizeAssistantMasmonGrow !== 'function') return null; const n = normalizeAssistantMasmonGrow({ mons: { [aid]: { [`1:${monster}`]: g } } }); return (n.mons[aid] || {})[`1:${monster}`] || null; } catch (_) { return null; } };
const amgsTrainOk = (aid, monster, t) => { try { if (!t || typeof normalizeAssistantMasmonTrain !== 'function') return null; const n = normalizeAssistantMasmonTrain({ mons: { [aid]: { [`1:${monster}`]: t } } }); return (n.mons[aid] || {})[`1:${monster}`] || null; } catch (_) { return null; } };
const normalizeAssistantMasmonSleep = (raw) => {
  const out = { v: 1, beds: [], seen: {}, seq: 0 };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const ids = new Set();
  for (const b of (Array.isArray(raw.beds) ? raw.beds : []).slice(-AMGS_MAX_BEDS)) {
    if (!b || typeof b !== 'object' || typeof b.id !== 'string' || !/^b\d{1,9}$/.test(b.id) || ids.has(b.id) || typeof b.aid !== 'string' || !/^[a-z]{2,12}$/.test(b.aid) || !Number.isInteger(b.slot) || b.slot < 1 || b.slot > 8) continue;
    const row = amgsRowOf(b.row); if (!row) continue;
    ids.add(b.id);
    out.beds.push({ id: b.id, aid: b.aid, slot: b.slot, src: b.src === 'former' ? 'former' : 'sleep', at: typeof b.at === 'string' ? b.at.slice(0, 10) : '', fat: typeof b.fat === 'string' ? b.fat.slice(0, 20) : '', row,
      g: amgsGrowOk(b.aid, row.monster, b.g), t: amgsTrainOk(b.aid, row.monster, b.t),
      c: b.c && typeof AMGP_COND !== 'undefined' && AMGP_COND[b.c.k] && Number.isInteger(b.c.left) && b.c.left > 0 ? { k: b.c.k, left: Math.min(30, b.c.left) } : null });
  }
  if (raw.seen && typeof raw.seen === 'object') for (const [k, v] of Object.entries(raw.seen).slice(-400)) if (v === true && /^[a-z]{2,12}:[1-8]:[\w-]{0,20}:\w{2,40}$/.test(k)) out.seen[k] = true;
  out.seq = Number.isInteger(raw.seq) && raw.seq > 0 ? Math.min(raw.seq, 999999999) : out.beds.reduce((a, b) => Math.max(a, Number(b.id.slice(1))), 0);
  return out;
};
const AMGS_STORE = typeof amgpMakeStore === 'function' ? amgpMakeStore(ASSISTANT_MASMON_SLEEP_KEY, normalizeAssistantMasmonSleep) : null;
try { setTimeout(() => { try { if (amgsOn() && AMGS_STORE) void AMGS_STORE.load(); } catch (_) {} }, 0); } catch (_) {}
const amgsCapOf = (days) => AMGS_CAP[Math.max(0, (typeof amgpStageOf === 'function' ? amgpStageOf(days).lv : 1) - 1)] || AMGS_CAP[0];
const amgsCap = () => amgsCapOf(typeof AMGP_STORE !== 'undefined' ? AMGP_STORE.state.days : 0);
const amgsFormerSig = (aid, slot, x) => `${aid}:${slot}:${String(x.at || '').slice(0, 20)}:${x.monster}`;
// 提案の入れ替えで外れた「前にいた子」を、冬眠の一覧へ1度ずつ並べる(元の mine.former はそのまま・見た印 seen で二重にしない)
const amgsSyncFormer = () => {
  if (!amgsOn() || !AMGS_STORE || !AMGS_STORE.loaded || typeof ASSISTANT_MASMON_STORE === 'undefined' || !ASSISTANT_MASMON_STORE.loaded) return false;
  let st = AMGS_STORE.state; const ms = ASSISTANT_MASMON_STORE.state; let changed = false;
  const g = typeof AMG_STORE !== 'undefined' && AMG_STORE.loaded ? AMG_STORE.state : null; const tr = typeof AMGT_STORE !== 'undefined' && AMGT_STORE.loaded ? AMGT_STORE.state : null;
  for (const [aid, m] of Object.entries((ms && ms.mine) || {})) for (const [sl, list] of Object.entries((m && m.former) || {})) {
    const slot = Number(sl);
    for (const x of (Array.isArray(list) ? list : [])) {
      if (!x || !amgsMonOk(x.monster)) continue;
      const sig = amgsFormerSig(aid, slot, x); if (st.seen[sig]) continue;
      const row = amgsRowOf(x); if (!row) continue;
      const key = `${slot}:${x.monster}`; const seq = st.seq + 1;
      st = { ...st, seq, seen: { ...st.seen, [sig]: true }, beds: [...st.beds, { id: `b${seq}`, aid, slot, src: 'former', at: String(x.at || '').slice(0, 10), fat: String(x.at || '').slice(0, 20), row, g: g && g.mons[aid] ? g.mons[aid][key] || null : null, t: tr && tr.mons[aid] ? tr.mons[aid][key] || null : null, c: null }] };
      changed = true;
    }
  }
  return changed ? AMGS_STORE.save(st) : false;
};
// 起きている子(aid の枠 slot)と、冬眠中の子(bedId)を入れ替える。眠らせる・起こすはどちらもこれ。だめなら理由の文字、できたら true
const amgsSwap = (bedId, slot, now = Date.now()) => {
  if (!amgsOn() || !AMGS_STORE || !AMGS_STORE.loaded || typeof assistantMasmonSleepSwap !== 'function') return 'まだ使えません';
  if (typeof AMG_STORE === 'undefined' || !AMG_STORE.loaded || !AMGP_STORE.loaded || !AMGP_CSTORE.loaded) return '読み込み中です';
  const st = AMGS_STORE.state; const bed = st.beds.find(b => b.id === bedId);
  if (!bed) return 'もういません';
  const ms = ASSISTANT_MASMON_STORE.state; const rows = assistantMasmonRowsOf(ms, bed.aid); const row = rows.find(r => r.slot === slot);
  if (!row) return '起こす枠がありません';
  if (rows.some(r => r.slot !== slot && r.monster === bed.row.monster)) return '同じ種類のマスモンがほかの枠にいます';
  const s = amgSlotOf(now); const outKey = amgMonKey(row.slot, row.monster); const inKey = amgMonKey(slot, bed.row.monster);
  const gOut = (AMG_STORE.state.mons[bed.aid] || {})[outKey] || null;
  const tOut = typeof AMGT_STORE !== 'undefined' && AMGT_STORE.loaded ? (AMGT_STORE.state.mons[bed.aid] || {})[outKey] || null : null;
  const cKeyOut = amgpKey(bed.aid, row.slot, row.monster); const cOut = amgpCondAt(cKeyOut, s + 1);
  const out = assistantMasmonSleepSwap(bed.aid, slot, bed.row, bed.src === 'former' ? { slot: bed.slot, at: bed.fat } : null);
  if (!out) return '入れ替えられませんでした';
  // 起きた子の育成・修行の中身を、その枠の行へ戻す(眠らせたときのまま)
  if (bed.g) { const gs = AMG_STORE.state; amgSave({ ...gs, mons: { ...gs.mons, [bed.aid]: { ...(gs.mons[bed.aid] || {}), [inKey]: { ...bed.g, dg: { d: 0, n: 0 } } } } }); }
  if (bed.t && typeof AMGT_STORE !== 'undefined' && AMGT_STORE.loaded && typeof amgtSave === 'function') { const ts = AMGT_STORE.state; amgtSave({ ...ts, mons: { ...ts.mons, [bed.aid]: { ...(ts.mons[bed.aid] || {}), [inKey]: bed.t } } }); }
  // 計画の子だったら外す(予定は消さない)・けがの残りは眠らせた子へ写し、起きた子は残りから続ける
  const ps = AMGP_STORE.state; if (ps.picks.some(p => p.aid === bed.aid && p.slot === row.slot && p.monster === row.monster)) AMGP_STORE.save({ ...ps, picks: ps.picks.filter(p => !(p.aid === bed.aid && p.slot === row.slot && p.monster === row.monster)) });
  const cs = AMGP_CSTORE.state; const mons = { ...cs.mons };
  if (cOut) mons[cKeyOut] = { ...cOut, until: s };
  if (bed.c) mons[amgpKey(bed.aid, slot, bed.row.monster)] = { k: bed.c.k, from: s, until: s + bed.c.left, care: -1, find: -1, hosp: [] };
  if (cOut || bed.c) AMGP_CSTORE.save({ ...cs, mons });
  const day = typeof assistantMasmonToday === 'function' ? assistantMasmonToday() : '';
  const seq = st.seq + 1;
  AMGS_STORE.save({ ...st, seq, beds: [...st.beds.filter(b => b.id !== bedId), { id: `b${seq}`, aid: bed.aid, slot, src: 'sleep', at: day, fat: '', row: amgsRowOf(out), g: gOut, t: tOut, c: cOut ? { k: cOut.k, left: Math.max(1, cOut.until - s) } : null }] });
  try { if (typeof amgTick === 'function') void amgTick(bed.aid); } catch (_) {}
  return true;
};

// ---------- 合体(2026-11-12 キズナ・社長の答え 台帳 #5540・案 masmon-plan/FUSE.md 第2版) ----------
//   同じ助手の冬眠中どうしだけ・回数は何回でも。できあがりは「主の種類の初期値(Lv1)+上乗せ」。上乗せは2体の平均を元にし上限なし(平均999で+200)
//   種類・名前・色・型・伸びの個体差は主のまま。Lv・育成Lv は1、疲れ・ストレス・けがは0。技は主の全部+素材の技のうち主の種類でも覚えられる物、熟練は高い方の半分
//   保存は新しいキー mh_assistant_masmon_fuse_v1(いなくなったマスモンの記録)。先に記録を書き、そのあと冬眠の箱を書く
const ASSISTANT_MASMON_FUSE_KEY = 'mh_assistant_masmon_fuse_v1';
const AMGS_FUSE = Object.freeze({ log: 50 });
const amgsFuseOn = () => amgsOn() && RELEASE_FLAGS.assistantMasmonFuse === true;
const amgsFuseSt = (o) => { const st = {}; for (const k of AMG_KEYS) st[k] = amgNum(o && o[k], 0, 0, AMG_MAX); return st; };
const normalizeAssistantMasmonFuse = (raw) => {
  const out = { v: 1, log: [], seq: 0 };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const one = (x) => (x && typeof x === 'object' && amgsMonOk(x.monster) ? { monster: x.monster, nick: typeof x.nick === 'string' ? x.nick.slice(0, 16) : '', lv: amgNum(x.lv, 1, 1, 999), st: amgsFuseSt(x.st) } : null);
  for (const x of (Array.isArray(raw.log) ? raw.log : []).slice(-AMGS_FUSE.log)) {
    if (!x || typeof x !== 'object' || typeof x.aid !== 'string' || !/^[a-z]{2,12}$/.test(x.aid)) continue;
    const main = one(x.main); const mat = one(x.mat); if (!main || !mat) continue;
    out.log.push({ at: typeof x.at === 'string' ? x.at.slice(0, 10) : '', aid: x.aid, main, mat, out: amgsFuseSt(x.out) });
  }
  out.seq = Number.isInteger(raw.seq) && raw.seq > 0 ? Math.min(raw.seq, 999999999) : out.log.length;
  return out;
};
const AMGS_FSTORE = typeof amgpMakeStore === 'function' ? amgpMakeStore(ASSISTANT_MASMON_FUSE_KEY, normalizeAssistantMasmonFuse) : null;
// 1つの能力の上乗せ: 計算は MASMON_CALC.fuseBonus(56-assistant-life-masmon-calc.jsx・助手に結びつけない部品)
const amgsFuseBonus = (a, b) => MASMON_CALC.fuseBonus(a, b);
const amgsFuseBase = (monster) => { const b = AMG_INIT[monster] || [110, 110, 110, 110, 110, 110]; const st = {}; AMG_KEYS.forEach((k, i) => { st[k] = amgClamp(Math.round(b[i]), Math.max(1, AMG_INIT_FLOOR), AMG_MAX); }); return st; };
// 合体の見通し(画面と本体で同じ物を使う)。6能力が無い子(古い形)は null
const amgsFusePlan = (main, mat) => {
  if (!main || !mat || !main.g || !mat.g || main.aid !== mat.aid || main.id === mat.id) return null;
  const base = amgsFuseBase(main.row.monster); const st = {}; const add = {};
  for (const k of AMG_KEYS) { add[k] = amgsFuseBonus(main.g.st[k], mat.g.st[k]); st[k] = amgClamp(base[k] + add[k], 1, AMG_MAX); }
  const mine = typeof amgtTechsOf === 'function' ? amgtTechsOf(main.row.monster) : []; const theirs = typeof amgtTechsOf === 'function' ? amgtTechsOf(mat.row.monster) : [];
  const mt = main.t || { m: {}, learn: [] }; const xt = mat.t || { m: {}, learn: [] };
  const learn = [...mt.learn]; const from = {}; const carried = [];
  for (const id of xt.learn) {
    const tx = theirs.find(x => x.id === id); const tm = mine.find(x => x.id === id || (tx && x.name === tx.name)); // 主の種類でも覚えられる技だけ(同じ技か、同じ名前の技)
    if (!tm) continue;
    from[tm.id] = Math.max(from[tm.id] || 0, Number(xt.m[id]) || 0);
    if (!learn.includes(tm.id)) { learn.push(tm.id); carried.push(tm.name); }
  }
  const m = {};
  for (const k of (typeof AMGT_SENSE_KEYS !== 'undefined' ? AMGT_SENSE_KEYS : [])) m[k] = Math.floor(Math.max(Number(mt.m[k]) || 0, Number(xt.m[k]) || 0) / 2);
  for (const id of learn) m[id] = Math.floor(Math.max(Number(mt.m[id]) || 0, from[id] || 0) / 2);
  return { base, add, st, learn: learn.slice(0, 16), m, carried };
};
let amgsFuseBusy = false;
// 合体する: 主(mainId)に素材(matId)を合わせる。素材は箱からいなくなる。だめなら理由の文字、できたら true
const amgsFuse = (mainId, matId) => {
  if (!amgsFuseOn() || !AMGS_STORE || !AMGS_FSTORE) return 'まだ使えません';
  if (!AMGS_STORE.loaded || !AMGS_FSTORE.loaded || typeof ASSISTANT_MASMON_STORE === 'undefined' || !ASSISTANT_MASMON_STORE.loaded) return '読み込み中です';
  if (amgsFuseBusy) return '合体しています';
  const st = AMGS_STORE.state; const main = st.beds.find(b => b.id === mainId); const mat = st.beds.find(b => b.id === matId);
  if (!main || !mat) return 'もういません';
  if (main.id === mat.id) return '同じマスモンどうしでは合体できません';
  if (main.aid !== mat.aid) return '同じ助手のマスモンどうしだけ合体できます';
  const plan = amgsFusePlan(main, mat); if (!plan) return '能力が育っていないマスモンは合体できません';
  amgsFuseBusy = true;
  try {
    const day = typeof assistantMasmonToday === 'function' ? assistantMasmonToday() : '';
    const fs = AMGS_FSTORE.state;
    const logged = AMGS_FSTORE.save({ ...fs, seq: fs.seq + 1, log: [...fs.log, { at: day, aid: main.aid, main: { monster: main.row.monster, nick: main.row.nick, lv: main.row.lv, st: main.g.st }, mat: { monster: mat.row.monster, nick: mat.row.nick, lv: mat.row.lv, st: mat.g.st }, out: plan.st }].slice(-AMGS_FUSE.log) });
    if (logged === false) return '記録できませんでした';
    // 「前にいた子」は元の記録からも外す(前の子に戻すで、合体前の子・いなくなった子を出さない)
    for (const b of [main, mat]) if (b.src === 'former' && typeof assistantMasmonFormerDrop === 'function') assistantMasmonFormerDrop(b.aid, b.slot, b.row.monster, b.fat);
    const g = { ...main.g, st: plan.st, fat: 0, str: 0, log: [], dg: { d: 0, n: 0 }, lv: 1, xp: 0 };
    const t = amgsTrainOk(main.aid, main.row.monster, { ...(main.t || {}), m: plan.m, learn: plan.learn, day: { d: -1, n: 0 }, log: [] });
    const seq = st.seq + 1;
    AMGS_STORE.save({ ...st, seq, beds: [...st.beds.filter(b => b.id !== main.id && b.id !== mat.id), { id: `b${seq}`, aid: main.aid, slot: main.slot, src: 'sleep', at: day, fat: '', row: { ...main.row, lv: 1 }, g: amgsGrowOk(main.aid, main.row.monster, g), t, c: null }] });
    return true;
  } finally { amgsFuseBusy = false; }
};

// ---------- 画面(公開の印が真のときだけ出す) ----------
const amgsColorDots = (colors) => (colors || []).filter(Boolean).slice(0, 5).map((c, i) => <span key={i} className="inline-block h-3 w-3 rounded-full border border-white/40 align-middle" style={{ background: typeof assistantMasmonSwatch === 'function' ? assistantMasmonSwatch(c) : '#94a3b8' }}/>);
// 育成ノートの一覧の下に並べる「💤 冬眠中」
function AmgsSection({ filter = null }) {
  const [st, setSt] = React.useState(AMGS_STORE ? AMGS_STORE.state : null);
  const [open, setOpen] = React.useState(null); // 冬眠中の子のくわしい画面(bed id)
  const [fuse, setFuse] = React.useState(false); // 合体の画面
  React.useEffect(() => {
    if (!AMGS_STORE) return undefined;
    AMGS_STORE.subs.add(setSt);
    void AMGS_STORE.load().then(() => { amgsSyncFormer(); });
    if (AMGS_FSTORE && amgsFuseOn()) void AMGS_FSTORE.load();
    return () => { AMGS_STORE.subs.delete(setSt); };
  }, []);
  if (!amgsOn() || !st) return null;
  const cap = amgsCap(); const beds = st.beds.filter(b => !filter || b.aid === filter);
  const bed = st.beds.find(b => b.id === open) || null;
  return (
    <div className="mt-3" data-amgs-section={st.beds.length}>
      <p className="text-[12px] font-black text-sky-200">💤 冬眠中({st.beds.length}/{cap}) <small className="text-[10px] font-bold text-slate-400">眠っている間は育たず、対戦にも出ません</small></p>
      {st.beds.length > cap && <p className="text-[10.5px] font-bold text-amber-300" data-amgs-over>しまえる数を超えています(消えはしません)</p>}
      {beds.map(b => { const m = ALL_PLAYER_MONSTERS[b.row.monster]; return (
        <button key={b.id} type="button" onClick={() => setOpen(b.id)} data-amgs-bed={b.id} className="mt-1.5 flex w-full items-center gap-2 rounded-2xl border border-sky-300/60 bg-sky-950/70 p-2 text-left">
          {typeof amgpMonIcon === 'function' ? amgpMonIcon(b.row.monster) : null}
          <span className="min-w-0 flex-1"><b className="block truncate text-[13px] font-black">{b.row.nick || (m && m.name)} <small className="text-[10px] text-slate-300">{typeof amgpWhoName === 'function' ? amgpWhoName(b.aid) : b.aid}のマスモン</small></b>
            <small className="block text-[10.5px] font-bold text-slate-300">Lv {b.row.lv}{b.row.grow ? ` ・ ${b.row.grow}` : ''} ・ {b.src === 'former' ? '前にいたマスモン' : `${String(b.at).slice(5).replace('-', '/')}から`}</small></span>
          <span className="shrink-0 rounded-full bg-blue-900 px-2 py-0.5 text-[10px] font-black text-blue-100">💤 冬眠中</span>
        </button>); })}
      {!beds.length && <p className="mt-1 rounded-xl bg-slate-800 p-2 text-[11px] font-bold text-slate-400">冬眠中のマスモンはいません。助手のマスモンの「💤 眠らせる」で、冬眠中のマスモンと入れ替えられます</p>}
      {amgsFuseOn() && beds.some(b => beds.filter(x => x.aid === b.aid && x.g).length >= 2 && b.g) && <button type="button" onClick={() => setFuse(true)} data-amgs-fuse-open className="mt-2 min-h-[44px] w-full rounded-xl bg-fuchsia-700 text-[13px] font-black">🧬 合体する<small className="block text-[10px] font-bold text-fuchsia-100">同じ助手の冬眠中のマスモンどうしで、Lv 1 から強く育て直す</small></button>}
      {bed && <AmgsDetail bed={bed} onClose={() => setOpen(null)}/>}
      {fuse && <AmgsFuseSheet beds={beds} onClose={() => setFuse(false)}/>}
    </div>);
}
// 冬眠中の子のくわしい画面(起きている子と同じ中身・💤の印)。ボタンは「起こす」と閉じるだけ
function AmgsDetail({ bed, onClose }) {
  const [pick, setPick] = React.useState(false); const [err, setErr] = React.useState('');
  const m = ALL_PLAYER_MONSTERS[bed.row.monster] || {};
  const rows = typeof ASSISTANT_MASMON_STORE !== 'undefined' && typeof assistantMasmonRowsOf === 'function' ? assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, bed.aid) : [];
  const techs = bed.t && typeof amgtTechsOf === 'function' ? amgtTechsOf(bed.row.monster).filter(x => bed.t.learn.includes(x.id)) : [];
  const go = (slot) => { const r = amgsSwap(bed.id, slot); if (r === true) onClose(); else setErr(r); };
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60" data-amgs-detail>
      <div className="w-full max-w-md rounded-t-3xl border-t-2 border-sky-300/70 bg-slate-900 p-3 pb-6 text-white" style={{ maxHeight: '92dvh', overflowY: 'auto' }}>
        <p className="text-[16px] font-black">💤 {bed.row.nick || m.name}(冬眠中)</p>
        <p className="text-[10.5px] font-bold text-slate-300">{typeof amgpWhoName === 'function' ? amgpWhoName(bed.aid) : bed.aid}のマスモン ・ {bed.src === 'former' ? '入れ替えで前にいたマスモン' : `${String(bed.at).slice(5).replace('-', '/')} から眠っています`}</p>
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-sky-300/60 bg-sky-950/70 p-2">
          {m.iconUrl ? <img src={m.iconUrl} alt="" className="h-16 w-16 object-contain"/> : null}
          <div className="min-w-0 flex-1"><p className="text-[14px] font-black">{bed.row.nick || m.name} <span className="rounded-full bg-blue-900 px-2 py-0.5 text-[10px] text-blue-100">💤 冬眠中</span></p>
            <p className="text-[11px] font-bold text-slate-300">{m.name} ・ Lv {bed.row.lv}{bed.row.grow ? ` ・ ${bed.row.grow}` : ''}{bed.g ? ` ・ 育成Lv.${bed.g.lv}` : ''}</p>
            <p className="text-[11px] font-bold text-slate-300">色: {amgsColorDots(bed.row.colors)}</p></div>
        </div>
        <p className="mt-2 text-[12px] font-black text-amber-200">6能力(眠らせたときのまま)</p>
        {bed.g ? <div className="mt-1">{typeof AmgpBars === 'function' && <AmgpBars st={bed.g.st}/>}</div> : <p className="text-[11px] font-bold text-slate-400">能力は、起こすと助手がはじめから育てます</p>}
        {techs.length > 0 && <><p className="mt-2 text-[12px] font-black text-amber-200">技と熟練</p><p className="text-[11px] font-bold text-slate-200" data-amgs-techs>{techs.map(x => `${x.name} 熟練 ${typeof amgtRankOf === 'function' ? amgtRankOf(bed.t.m[x.id] || 0) : ''}`).join(' ・ ')}</p></>}
        {bed.g && <p className="mt-2 text-[11px] font-bold text-slate-300">疲れ {bed.g.fat} ・ ストレス {bed.g.str}(眠っている間は動きません)</p>}
        {bed.c && typeof AMGP_COND !== 'undefined' && <p className="text-[11px] font-bold text-rose-200">{AMGP_COND[bed.c.k].icon} {AMGP_COND[bed.c.k].name}の残りは、起きてから続きます</p>}
        {!pick ? (<>
          <button type="button" onClick={() => setPick(true)} data-amgs-wake className="mt-3 min-h-[48px] w-full rounded-xl bg-amber-400 text-[14px] font-black text-slate-900">☀ 起こす</button>
          <button type="button" onClick={onClose} data-mhl-sheet-close className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-700 text-[13px] font-black">閉じる</button>
        </>) : (<>
          <p className="mt-3 text-[12px] font-black text-amber-200">☀ どの枠に起こしますか</p>
          <p className="text-[10.5px] font-bold text-slate-300">{typeof amgpWhoName === 'function' ? amgpWhoName(bed.aid) : ''}の枠に戻します。その枠にいたマスモンは、かわりに冬眠へ入ります</p>
          {rows.map(r => { const rm = ALL_PLAYER_MONSTERS[r.monster] || {}; const dup = rows.some(x => x.slot !== r.slot && x.monster === bed.row.monster); return (
            <button key={r.slot} type="button" disabled={dup} onClick={() => go(r.slot)} data-amgs-slot={r.slot} className="mt-1.5 flex min-h-[48px] w-full items-center gap-2 rounded-xl border border-white/15 bg-slate-800 px-2 text-left disabled:opacity-40">
              {rm.iconUrl ? <img src={rm.iconUrl} alt="" className="h-9 w-9 object-contain"/> : null}
              <span className="min-w-0 flex-1 text-[12px] font-black">枠{r.slot} ・ {r.nick || rm.name}<small className="block text-[10px] text-slate-300">Lv {r.lv} ・ このマスモンが冬眠へ</small></span>
              <span className="shrink-0 rounded-lg bg-amber-700 px-1.5 text-[10px] font-black">入れ替え</span>
            </button>); })}
          {err && <p className="mt-1 text-[11px] font-bold text-rose-200" data-amgs-err>{err}</p>}
          <button type="button" onClick={() => setPick(false)} data-mhl-sheet-close className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-700 text-[13px] font-black">やめる</button>
        </>)}
      </div>
    </div>);
}
// 起きている子のカードに出す「💤 眠らせる」: 同じ助手の冬眠中の子を選んで入れ替える
function AmgsSleepButton({ aid, row }) {
  const [open, setOpen] = React.useState(false); const [err, setErr] = React.useState('');
  if (!amgsOn() || !AMGS_STORE) return null;
  const beds = AMGS_STORE.state.beds.filter(b => b.aid === aid);
  return (<>
    <button type="button" disabled={!beds.length} onClick={() => setOpen(true)} data-amgs-sleep className="min-h-[40px] rounded-xl bg-blue-800 px-3 text-[11.5px] font-black disabled:bg-slate-700 disabled:text-slate-400">💤 眠らせる{beds.length ? '' : '(入れ替える相手なし)'}</button>
    {open && <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60" data-amgs-sleep-sheet>
      <div className="w-full max-w-md rounded-t-3xl border-t-2 border-sky-300/70 bg-slate-900 p-3 pb-6 text-white" style={{ maxHeight: '80dvh', overflowY: 'auto' }}>
        <p className="text-[15px] font-black">💤 {row.nick}を眠らせる</p>
        <p className="text-[10.5px] font-bold text-slate-300">名前・色・6能力・Lv・技と熟練・疲れとストレスを、そのまま保っておきます。かわりに起こす冬眠中のマスモンを選んでください(枠は空けられません)</p>
        {beds.map(b => <button key={b.id} type="button" onClick={() => { const r = amgsSwap(b.id, row.slot); if (r === true) setOpen(false); else setErr(r); }} data-amgs-sleep-with={b.id} className="mt-1.5 flex min-h-[48px] w-full items-center gap-2 rounded-xl border border-white/15 bg-slate-800 px-2 text-left">
          {typeof amgpMonIcon === 'function' ? amgpMonIcon(b.row.monster) : null}<span className="text-[12px] font-black">{b.row.nick} を起こす<small className="block text-[10px] text-slate-300">Lv {b.row.lv}{b.row.grow ? ` ・ ${b.row.grow}` : ''}</small></span></button>)}
        {err && <p className="mt-1 text-[11px] font-bold text-rose-200">{err}</p>}
        <button type="button" onClick={() => setOpen(false)} data-mhl-sheet-close className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-700 text-[13px] font-black">やめる</button>
      </div>
    </div>}
  </>);
}

// 合体の画面: ①主を選ぶ ②素材を選ぶ(同じ助手) ③見通し ④素材がいなくなる確認(2回押す)
function AmgsFuseSheet({ beds, onClose }) {
  const [mainId, setMain] = React.useState(null); const [matId, setMat] = React.useState(null); const [sure, setSure] = React.useState(0); const [err, setErr] = React.useState(''); const [done, setDone] = React.useState(null);
  const all = AMGS_STORE ? AMGS_STORE.state.beds : beds;
  const main = all.find(b => b.id === mainId) || null; const mat = all.find(b => b.id === matId) || null;
  const plan = main && mat ? amgsFusePlan(main, mat) : null;
  const nm = (b) => b.row.nick || (ALL_PLAYER_MONSTERS[b.row.monster] || {}).name || '';
  const pickable = beds.filter(b => b.g && beds.some(x => x.id !== b.id && x.aid === b.aid && x.g));
  const card = (b, on, tone) => (
    <button key={b.id} type="button" onClick={on} data-amgs-fuse-pick={b.id} className={`mt-1.5 flex min-h-[48px] w-full items-center gap-2 rounded-xl border px-2 text-left ${tone}`}>
      {typeof amgpMonIcon === 'function' ? amgpMonIcon(b.row.monster) : null}
      <span className="min-w-0 flex-1 text-[12px] font-black">{nm(b)} <small className="text-[10px] text-slate-300">{typeof amgpWhoName === 'function' ? amgpWhoName(b.aid) : b.aid}のマスモン</small>
        <small className="block text-[10px] text-slate-300">Lv {b.row.lv}{b.row.grow ? ` ・ ${b.row.grow}` : ''} ・ 6能力の合計 {AMG_KEYS.reduce((a, k) => a + (b.g.st[k] || 0), 0)}</small></span>
    </button>);
  const go = () => { if (sure < 1) { setSure(1); return; } const r = amgsFuse(main.id, mat.id); if (r === true) { setDone({ name: nm(main), lost: nm(mat) }); setErr(''); } else setErr(r); };
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60" data-amgs-fuse>
      <div className="w-full max-w-md rounded-t-3xl border-t-2 border-fuchsia-300/70 bg-slate-900 p-3 pb-6 text-white" style={{ maxHeight: '92dvh', overflowY: 'auto' }}>
        <p className="text-[16px] font-black">🧬 合体する</p>
        {done ? (<>
          <p className="mt-2 rounded-xl bg-fuchsia-950 p-3 text-[13px] font-black" data-amgs-fuse-done>{done.name}が生まれ変わりました。Lv 1 から育て直せます(冬眠中のまま)<small className="block text-[11px] font-bold text-slate-300">{done.lost}は、いなくなりました</small></p>
          <button type="button" onClick={onClose} data-mhl-sheet-close className="mt-3 min-h-[44px] w-full rounded-xl bg-slate-700 text-[13px] font-black">閉じる</button>
        </>) : !main ? (<>
          <p className="text-[11px] font-bold text-slate-300">① 残すマスモン(主)を選んでください。種類・名前・色・型は主のままです</p>
          {pickable.map(b => card(b, () => setMain(b.id), 'border-white/15 bg-slate-800'))}
          {!pickable.length && <p className="mt-2 text-[11px] font-bold text-slate-400">同じ助手の冬眠中のマスモンが2体そろうと合体できます</p>}
        </>) : !mat ? (<>
          <p className="text-[11px] font-bold text-slate-300">② 合わせるマスモン(素材)を選んでください。素材になったマスモンはいなくなります</p>
          {card(main, () => setMain(null), 'border-emerald-300/70 bg-emerald-950')}
          {all.filter(b => b.aid === main.aid && b.id !== main.id && b.g).map(b => card(b, () => setMat(b.id), 'border-white/15 bg-slate-800'))}
        </>) : plan ? (<>
          <p className="text-[11px] font-bold text-slate-300">③ できあがりの見通し: {nm(main)}が Lv 1 に戻り、{ALL_PLAYER_MONSTERS[main.row.monster] ? ALL_PLAYER_MONSTERS[main.row.monster].name : ''}のはじめの能力に、2体の強さに応じた上乗せが付きます</p>
          <div className="mt-1 rounded-xl bg-slate-800 p-2" data-amgs-fuse-plan>
            {AMG_STATS.map(([k, label]) => <p key={k} className="flex justify-between text-[12px] font-black"><span>{label}</span><span>{plan.base[k]} → <b className="text-amber-200">{plan.st[k]}</b> <small className="text-fuchsia-200">(+{plan.add[k]})</small></span></p>)}
          </div>
          <p className="mt-1 text-[10.5px] font-bold text-slate-300">2体ともに強いほど、上乗せが大きくなります(片方だけ強くても、あまり上がりません)</p>
          <p className="mt-1 text-[11px] font-bold text-slate-200">技: {main.t ? `${nm(main)}の技は全部残ります` : '技はまだありません'}{plan.carried.length ? ` ・ 引き継ぐ技 ${plan.carried.join('・')}` : ''}(熟練は半分から)</p>
          <p className="text-[11px] font-bold text-slate-200">Lv・育成Lv は 1、疲れ・ストレスは 0 から</p>
          <div className="mt-2 rounded-xl border-2 border-rose-400 bg-rose-950/70 p-2" data-amgs-fuse-lose>
            <p className="text-[12px] font-black text-rose-100">{nm(mat)}(Lv {mat.row.lv})はいなくなります。元に戻せません</p>
            {typeof AmgpBars === 'function' && <AmgpBars st={mat.g.st}/>}
          </div>
          {err && <p className="mt-1 text-[11px] font-bold text-rose-200" data-amgs-fuse-err>{err}</p>}
          <button type="button" onClick={go} data-amgs-fuse-go={sure} className={`mt-3 min-h-[48px] w-full rounded-xl text-[14px] font-black ${sure ? 'bg-rose-500 text-white' : 'bg-fuchsia-500 text-white'}`}>{sure ? '本当に合体する' : '🧬 合体する'}</button>
          <button type="button" onClick={() => { setMat(null); setSure(0); }} className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-700 text-[13px] font-black">選び直す</button>
        </>) : <p className="mt-2 text-[11px] font-bold text-slate-400">このマスモンどうしでは合体できません</p>}
        {!done && <button type="button" onClick={onClose} data-mhl-sheet-close className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-700 text-[13px] font-black">やめる</button>}
      </div>
    </div>);
}
