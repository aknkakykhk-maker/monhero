// ---------- モンヒロサクセスの合体(保存枠の育て終えた子どうし・2026-11-12 開発部・段取りの回3) ----------
// 案: docs/progress/player-raise/PLAN.md §3「合体」・§9。計算は芯 MONHERO_SUCCESS(data/monhero-success.js)の fusePlan だけを使う。
// ★この部品は保存枠(mh_monsuc_box_v1)の読み書きを持たない。箱は回3の保存枠の部品から受け取る:
//     <MonsucFuseSheet box={msxR3ReadBox() の箱} onSave={(次の箱) => storeSet(MSX_KEYS.box, 次の箱)} locked={[編成・貸し出し・育成中の id]} onDone onClose/>
//   (saveBox という名前でも受ける。保存の失敗は false でも例外でもよい)
//   readBox={() => msxR3ReadBox()} を渡すと、書く直前に箱を読み直し、その箱に合体を当てて書く(開いたあとに箱が変わっても上書きで消さない・ミハリ5)
//   箱の形は回3(56-monhero-success-r3-store.jsx・PLAN.md §9): { v:1, cap, mons:[{ id, species, nick, colors, gen, parents:[id,id], st, techs, mast:[techs と同じ順],
//   loy, pop, lv, gt, rank, score, fav, raised, coach, endAt, paid, over, assists, titles, from }], memory:[{ nick, species, rank, gen, at }](新しい100件) }
//   貸し出し中の子は locked に入れて使えなくする(お別れのように貸し出しを外すことはしない)
// ★元に戻せない操作なので(CLAUDE.md ⑦):
//   1. 2回押す(2回目は 0.8 秒待ってから押せる・助手のマスモンの合体と同じ)
//   2. 先に合体の記録 mh_monsuc_fuse_v1(新しいキー・新しい50件・親2体の中身をそのまま残す)を書く。書けなければ何も変えない
//   3. そのあと箱を1回で書く(生まれた子を足す + 親2体を外して「思い出」に残す)。書けなければ何も消えない(箱は前のまま)
//   4. 生まれた子の id は親2体の id から決まる。同じ子がもう箱にいれば何もしない(二重押し・書き直しで2体にならない)
// 公開の印 monheroSuccess(偽のあいだは開けない)。
const MONSUC_FUSE_KEY = 'mh_monsuc_fuse_v1';
const MONSUC_FUSE_LOG = 50;
const MONSUC_MEMORY_MAX = 100;
const monsucFuseOn = () => typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS && RELEASE_FLAGS.monheroSuccess === true;
let monsucFuseCoreCache = null;
const monsucFuseCore = () => {
  if (monsucFuseCoreCache) return monsucFuseCoreCache;
  try {
    const core = typeof globalThis !== 'undefined' ? globalThis.MONHERO_SUCCESS : null; // 芯 data/monhero-success.js(読まれていなければ使えない)
    if (!core || typeof core.create !== 'function' || typeof MASMON_CALC === 'undefined') return null;
    monsucFuseCoreCache = core.create({ calc: MASMON_CALC, apt: typeof AMG_APT !== 'undefined' ? AMG_APT : {}, init: typeof AMG_INIT !== 'undefined' ? AMG_INIT : {},
      techs: typeof ASSISTANT_MASMON_TECHS !== 'undefined' ? ASSISTANT_MASMON_TECHS : null, monsters: typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS : {},
      lineage: typeof MONSTER_LINEAGE_MAP !== 'undefined' ? MONSTER_LINEAGE_MAP : {}, types: typeof MONSTER_TYPE_OF !== 'undefined' ? MONSTER_TYPE_OF : {},
      assist: typeof globalThis !== 'undefined' ? globalThis.MONHERO_SUCCESS_ASSIST || null : null }); // 第2版の表(読まれていなければ第1版。持ち物の段は削らない)
  } catch (_) { monsucFuseCoreCache = null; }
  return monsucFuseCoreCache;
};
// 合体の記録(読めない・壊れているときは空。数値・配列は型を確かめる)
const normalizeMonsucFuse = (raw) => {
  const out = { v: 1, seq: 0, log: [] };
  if (!raw || typeof raw !== 'object') return out;
  out.seq = Number.isFinite(raw.seq) ? Math.max(0, Math.floor(raw.seq)) : 0;
  for (const x of (Array.isArray(raw.log) ? raw.log : []).slice(-MONSUC_FUSE_LOG)) {
    if (!x || typeof x !== 'object' || typeof x.child !== 'string') continue;
    out.log.push({ at: typeof x.at === 'string' ? x.at.slice(0, 16) : '', child: x.child.slice(0, 40), species: typeof x.species === 'string' ? x.species : '',
      parents: Array.isArray(x.parents) ? x.parents.filter(p => p && typeof p === 'object').slice(0, 2) : [] });
  }
  return out;
};
const monsucFuseNick = (m) => (m && typeof m.nick === 'string' && m.nick) || ((typeof ALL_PLAYER_MONSTERS !== 'undefined' && m && ALL_PLAYER_MONSTERS[m.species]) || {}).name || '';
const monsucFuseSpName = (sp) => ((typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[sp]) || {}).name || sp || '';
const monsucBoxMons = (box) => (box && Array.isArray(box.mons) ? box.mons.filter(m => m && typeof m === 'object' && typeof m.id === 'string') : []);
// 箱に合体を当てた「次の箱」を作る(純粋・元の箱は変えない)。もう生まれていれば null
const monsucFuseApply = (box, plan, at) => {
  if (!plan || !plan.ok || !box || typeof box !== 'object') return null;
  const mons = monsucBoxMons(box);
  if (mons.some(m => m.id === plan.child.id)) return null;
  const ids = plan.child.parents.slice();
  if (!ids.every(id => mons.some(m => m.id === id))) return null;
  const gone = mons.filter(m => ids.includes(m.id));
  const parentAt = (id) => gone.find(m => m.id === id) || {};
  const colors = plan.child.species === parentAt(ids[0]).species ? (parentAt(ids[0]).colors || null) : null; // 種類が同じときだけ主の親の色を残す
  const child = { ...plan.child, colors, rank: null, score: 0, loy: 0, pop: 0, fav: [], coach: null, endAt: null, paid: false, over: null, assists: [], titles: [], from: null, bornAt: at || '' };
  const memory = [...(Array.isArray(box.memory) ? box.memory : []), ...gone.map(m => ({ nick: monsucFuseNick(m), species: m.species, rank: typeof m.rank === 'string' ? m.rank : null, gen: Number.isFinite(m.gen) ? m.gen : 1, at: at || '' }))].slice(-MONSUC_MEMORY_MAX);
  return { ...box, mons: [...mons.filter(m => !ids.includes(m.id)), child], memory };
};
let monsucFuseBusy = false;
// 合体する: true / 断る理由の文字列。log と storeGet/storeSet は検査で差し替えられるよう引数でも受ける
const monsucFuse = async ({ box, saveBox: saveBox0, onSave, readBox, mainId, matId, locked, suc, at, io }) => {
  const SUC = suc || monsucFuseCore();
  const saveBox = typeof saveBox0 === 'function' ? saveBox0 : onSave;
  if (!SUC || typeof saveBox !== 'function') return 'まだ使えません';
  if (monsucFuseBusy) return '合体しています';
  const lock = new Set(Array.isArray(locked) ? locked : []);
  if (lock.has(mainId) || lock.has(matId)) return '編成・貸し出し・育成中のモンスターは合体に使えません';
  const mons = monsucBoxMons(box);
  const main = mons.find(m => m.id === mainId); const mat = mons.find(m => m.id === matId);
  const plan = SUC.fusePlan(main, mat);
  if (!plan.ok) return plan.why;
  if (mons.some(m => m.id === plan.child.id)) return 'この2体はもう合体しています';
  const get = (io && io.get) || (typeof storeGet === 'function' ? storeGet : null);
  const set = (io && io.set) || (typeof storeSet === 'function' ? storeSet : null);
  if (!get || !set) return 'まだ使えません';
  monsucFuseBusy = true;
  try {
    const day = at || (() => { try { const d = new Date(Date.now() + 9 * 3600 * 1000); return d.toISOString().slice(0, 16).replace('T', ' '); } catch (_) { return ''; } })();
    // 書く直前に箱を読み直す(読めなければ開いたときの箱)。親2体がもういない・子がもういる → 何もしない
    let cur = box;
    if (typeof readBox === 'function') { try { const r = await readBox(); if (r && typeof r === 'object' && Array.isArray(r.mons)) cur = r; } catch (_) {} }
    const fresh = monsucBoxMons(cur);
    if (fresh.some(m => m.id === plan.child.id)) return 'この2体はもう合体しています';
    if (![mainId, matId].every(id => fresh.some(m => m.id === id))) return '保存枠が変わりました。選び直してください';
    const next = monsucFuseApply(cur, plan, day);
    if (!next) return 'この2体はもう合体しています';
    let raw = null; try { raw = await get(MONSUC_FUSE_KEY, null, false); } catch (_) {}
    const fs = normalizeMonsucFuse(raw);
    const rec = { at: day, child: plan.child.id, species: plan.child.species, parents: [main, mat].map(m => JSON.parse(JSON.stringify(m))) };
    let logged = false; try { logged = await set(MONSUC_FUSE_KEY, { ...fs, seq: fs.seq + 1, log: [...fs.log, rec].slice(-MONSUC_FUSE_LOG) }, false); } catch (_) { logged = false; }
    if (logged !== true) return '保存できませんでした。2体ともそのままです';
    let saved = false; try { saved = await saveBox(next); } catch (_) { saved = false; }
    if (saved !== true) return '保存できませんでした。2体ともそのままです';
    return true;
  } finally { monsucFuseBusy = false; }
};

function MonsucFuseSheet({ box, saveBox, onSave, readBox, locked = [], onDone, onClose, suc = null }) {
  const SUC = suc || monsucFuseCore();
  const [mainId, setMain] = React.useState(null); const [matId, setMat] = React.useState(null); const [sure, setSure] = React.useState(0);
  const [err, setErr] = React.useState(''); const [done, setDone] = React.useState(null); const [ready, setReady] = React.useState(true); const [busy, setBusy] = React.useState(false);
  const lock = new Set(Array.isArray(locked) ? locked : []);
  const mons = monsucBoxMons(box);
  const usable = mons.filter(m => m.raised === true && !lock.has(m.id));
  const main = mons.find(m => m.id === mainId) || null; const mat = mons.find(m => m.id === matId) || null;
  const plan = SUC && main && mat ? SUC.fusePlan(main, mat) : null;
  const names = SUC ? SUC.STAT_NAMES : {};
  const keys = SUC ? SUC.KEYS : [];
  const sum = (st) => keys.reduce((a, k) => a + (Number(st && st[k]) || 0), 0);
  const card = (m, on, tone) => (
    <button key={m.id} type="button" onClick={on} data-monsuc-fuse-pick={m.id} className={`mt-1.5 flex min-h-[48px] w-full items-center gap-2 rounded-xl border px-2 text-left ${tone}`}>
      {typeof amgpMonIcon === 'function' ? amgpMonIcon(m.species) : null}
      <span className="min-w-0 flex-1 text-[12px] font-black">{monsucFuseNick(m)} <small className="text-[10px] text-slate-300">{monsucFuseSpName(m.species)}{m.rank ? ` ・ ランク ${m.rank}` : ''} ・ {Number.isFinite(m.gen) ? m.gen : 1}代目</small>
        <small className="block text-[10px] text-slate-300">6能力の合計 {sum(m.st)}</small></span>
    </button>);
  const go = async () => {
    if (!ready || busy || !plan || !plan.ok) return;
    if (sure < 1) { setSure(1); setReady(false); setTimeout(() => setReady(true), 800); return; }
    setBusy(true);
    const r = await monsucFuse({ box, saveBox, onSave, readBox, mainId: main.id, matId: mat.id, locked, suc: SUC });
    setBusy(false);
    if (r === true) { setDone({ child: plan.child, lost: [monsucFuseNick(main), monsucFuseNick(mat)] }); setErr(''); if (typeof onDone === 'function') onDone(plan.child); }
    else { setErr(r); setSure(0); }
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60" data-monsuc-fuse>
      <div className="w-full max-w-md rounded-t-3xl border-t-2 border-fuchsia-300/70 bg-slate-900 p-3 pb-6 text-white" style={{ maxHeight: '92dvh', overflowY: 'auto' }}>
        <p className="text-[16px] font-black">🧬 合体する</p>
        {!SUC ? <p className="mt-2 text-[11px] font-bold text-slate-400">まだ使えません</p>
        : done ? (<>
          <div className="mt-2 rounded-xl bg-fuchsia-950 p-3" data-monsuc-fuse-done>
            <p className="flex items-center gap-2 text-[14px] font-black">{typeof amgpMonIcon === 'function' ? amgpMonIcon(done.child.species) : null}{monsucFuseSpName(done.child.species)}が生まれました({done.child.gen}代目)</p>
            <p className="mt-1 text-[11px] font-bold text-slate-200">保存枠に入りました。まだ育てていないので、このまま育成を始められます</p>
            <small className="mt-1 block text-[11px] font-bold text-slate-300">{done.lost.join('と')}は、思い出に名前・ランク・代が残ります</small>
          </div>
          <button type="button" onClick={onClose} data-mhl-sheet-close className="mt-3 min-h-[44px] w-full rounded-xl bg-slate-700 text-[13px] font-black">閉じる</button>
        </>) : !main ? (<>
          <p className="text-[11px] font-bold text-slate-300">① 主の親を選んでください。生まれるモンスターの主血統と型は、主の親から受け継ぎます</p>
          {usable.map(m => card(m, () => setMain(m.id), 'border-white/15 bg-slate-800'))}
          {usable.length < 2 && <p className="mt-2 text-[11px] font-bold text-slate-400" data-monsuc-fuse-none>育て終えたモンスターが2体そろうと合体できます(編成・貸し出し中のモンスターは使えません)</p>}
        </>) : !mat ? (<>
          <p className="text-[11px] font-bold text-slate-300">② もう一方の親を選んでください。生まれるモンスターの副血統は、このモンスターの血統から決まります</p>
          {card(main, () => setMain(null), 'border-emerald-300/70 bg-emerald-950')}
          {usable.filter(m => m.id !== main.id).map(m => card(m, () => setMat(m.id), 'border-white/15 bg-slate-800'))}
        </>) : plan && plan.ok ? (<>
          <p className="text-[11px] font-bold text-slate-300">③ 生まれるモンスターの見通し</p>
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-950/40 p-2" data-monsuc-fuse-child={plan.child.species}>
            {typeof amgpMonIcon === 'function' ? amgpMonIcon(plan.child.species) : null}
            <p className="text-[13px] font-black">{monsucFuseSpName(plan.child.species)} <small className="text-[11px] text-amber-200">{plan.child.gen}代目 ・ 未育成</small>
              <small className="block text-[10px] font-bold text-slate-300">型: {typeof MASMON_CALC !== 'undefined' && MASMON_CALC.typeOf ? MASMON_CALC.typeOf(plan.child.gt).name : ''}{plan.typeChanged ? '(主の親とは別の型になりました)' : '(主の親から)'}</small></p>
          </div>
          <div className="mt-1 rounded-xl bg-slate-800 p-2" data-monsuc-fuse-plan>
            <p className="mb-1 text-[10.5px] font-bold text-slate-300">{monsucFuseSpName(plan.child.species)}のはじめの能力に、2体の強さに応じた上乗せが付きます</p>
            {keys.map(k => <p key={k} className="flex justify-between text-[12px] font-black"><span>{names[k]}</span><span>{plan.base[k]} → <b className="text-amber-200">{plan.child.st[k]}</b> <small className="text-fuchsia-200">(+{plan.add[k]})</small></span></p>)}
          </div>
          <p className="mt-1 text-[10.5px] font-bold text-slate-300">2体ともに強いほど、上乗せが大きくなります(片方だけ強くても、あまり上がりません)</p>
          <p className="mt-1 text-[11px] font-bold text-slate-200" data-monsuc-fuse-techs>受け継ぐ技: {plan.child.techs.length ? plan.child.techs.map(t => { const x = SUC.techsOf(plan.child.species).find(y => y.id === t); return x ? x.name : t; }).join('・') + '(熟練は 0 から)' : 'なし'}</p>
          <div className="mt-2 rounded-xl border-2 border-rose-400 bg-rose-950/70 p-2" data-monsuc-fuse-lose>
            <p className="text-[12px] font-black text-rose-100">{monsucFuseNick(main)}と{monsucFuseNick(mat)}は、保存枠からいなくなります。元に戻せません</p>
            <p className="mt-0.5 text-[10.5px] font-bold text-rose-200">思い出に名前・ランク・代が残ります</p>
          </div>
          {err && <p className="mt-1 text-[11px] font-bold text-rose-200" data-monsuc-fuse-err>{err}</p>}
          <button type="button" onClick={go} disabled={!ready || busy} data-monsuc-fuse-go={sure} data-monsuc-fuse-ready={ready ? 1 : 0} className={`mt-3 disabled:opacity-50 min-h-[48px] w-full rounded-xl text-[14px] font-black ${sure ? 'bg-rose-500 text-white' : 'bg-fuchsia-500 text-white'}`}>{busy ? '合体しています…' : sure ? '本当に合体する' : '🧬 合体する'}</button>
          <button type="button" onClick={() => { setMat(null); setSure(0); setErr(''); }} className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-700 text-[13px] font-black">選び直す</button>
        </>) : <p className="mt-2 text-[11px] font-bold text-slate-400" data-monsuc-fuse-err>{(plan && plan.why) || 'この2体では合体できません'}</p>}
        {!done && <button type="button" onClick={onClose} data-mhl-sheet-close className="mt-2 min-h-[44px] w-full rounded-xl bg-slate-700 text-[13px] font-black">やめる</button>}
      </div>
    </div>);
}
