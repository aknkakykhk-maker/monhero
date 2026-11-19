// ---------- モンヒロサクセスの合体(保存枠の育て終えた子どうし・2026-11-12 開発部・段取りの回3) ----------
// 案: docs/progress/player-raise/PLAN.md §3「合体」・§9。計算は芯 MONHERO_SUCCESS(data/monhero-success.js)の fusePlan だけを使う。
// ★この部品は保存枠(mh_monsuc_box_v1)の読み書きを持たない。箱は回3の保存枠の部品から受け取る:
//     <MonsucFuseSheet box={msxR3ReadBox() の箱} onSave={(次の箱) => storeSet(MSX_KEYS.box, 次の箱)} locked={[育成中の編成・貸し出し・育成中の id]} lockWhy={{ id: 使えない理由 }} onDone onClose/>
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
  const memory = [...(Array.isArray(box.memory) ? box.memory : []), ...ids.map(parentAt).map(m => ({ nick: monsucFuseNick(m), species: m.species, rank: typeof m.rank === 'string' ? m.rank : null, gen: Number.isFinite(m.gen) ? m.gen : 1, at: at || '' }))].slice(-MONSUC_MEMORY_MAX);
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
  if (lock.has(mainId) || lock.has(matId)) return '育成中の編成・貸し出し中・育成中のモンスターは合体に使えません';
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
    if (![mainId, matId].every(id => fresh.some(m => m.id === id))) return 'マスモンボックスが変わりました。選び直してください';
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


function MonsucFuseSheet({ box, saveBox, onSave, readBox, locked = [], lockWhy = null, onDone, onClose, suc = null, keepNote = '', keptOf = null, onName = null }) {
  const SUC = suc || monsucFuseCore();
  const [mainId, setMain] = React.useState(null); const [matId, setMat] = React.useState(null); const [sure, setSure] = React.useState(0);
  const [nm, setNm] = React.useState(''); const [nmErr, setNmErr] = React.useState(''); const [named, setNamed] = React.useState(null); // 生まれた子の名前(合体したその場で決める・2026-11-14 社長 r1114-126)
  const [show, setShow] = React.useState(null); // 合体の演出(確定のあと・終わると結果の札)
  const [err, setErr] = React.useState(''); const [done, setDone] = React.useState(null); const [ready, setReady] = React.useState(true); const [busy, setBusy] = React.useState(false);
  const [fq, setFq] = React.useState(''); // 親を選ぶときの検索(表示だけの絞り込み。選択は id で持つので、隠れても外れない)
  const [fsort, setFsort] = React.useState('new'); // 親を選ぶときの並び替え(ボックス一覧と同じ MSX_MM_SORTS。表示だけ)
  const lock = new Set(Array.isArray(locked) ? locked : []);
  const mons = monsucBoxMons(box);
  const usable = mons.filter(m => m.raised === true && !lock.has(m.id));
  // 育て終えたのに使えない子は、理由を添えて一覧の下に出す(B-6: 黙って消えると「固定されたまま」に見える)
  const lockedRaised = mons.filter(m => m.raised === true && lock.has(m.id));
  const lockedEl = lockedRaised.length ? (
    // 一覧の送り箱の外(下)に、いつも見える1行で出す。押すと理由が開く(2026-11-19 r1119-013 ⑥ U-12。升目の下にあると、横・小さい横では送らないと見えなかった)
    <details className="mt-2 shrink-0 rounded-xl border border-white/10 bg-slate-800/60 px-2 py-1" data-monsuc-fuse-locked>
      <summary className="flex min-h-[40px] cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-black text-slate-300"><span>🔒 いまは合体に使えないモンスター {lockedRaised.length}体</span><span className="text-[10px] text-slate-400">わけを見る ▼</span></summary>
      <div style={{ maxHeight: '28vh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
      {lockedRaised.map(m => <p key={m.id} className="mt-0.5 text-[10.5px] font-bold text-slate-400" data-monsuc-fuse-locked-mon={m.id} style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{monsucFuseNick(m)}：{(lockWhy && typeof lockWhy[m.id] === 'string' && lockWhy[m.id]) || '育成中の編成・貸し出し中のモンスターは使えません'}</p>)}
      {lockedRaised.some(m => lockWhy && lockWhy[m.id] && lockWhy[m.id].includes('編成')) ? <p className="mt-0.5 text-[10px] font-bold text-slate-500">育成が終わると使えるようになります</p> : null}
      </div>
    </details>) : null;
  const usableF = fq.trim() && typeof msxMatchQ === 'function' ? usable.filter(m => msxMatchQ(fq, monsucFuseNick(m), monsucFuseSpName(m.species))) : usable;
  const usableS = typeof msxMmSorted === 'function' ? msxMmSorted(usableF, fsort) : usableF; // 並び替えはボックス一覧と同じ処理(写しだけ。元の並び・保存データは変えない)
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
    if (r === true) { setShow({ a: main.species, b: mat.species, child: plan.child.species, name: monsucFuseSpName(plan.child.species) }); setDone({ child: plan.child, lost: [monsucFuseNick(main), monsucFuseNick(mat)] }); setNm(typeof plan.child.nick === 'string' ? plan.child.nick : ''); setNmErr(''); setNamed(null); setErr(''); if (typeof onDone === 'function') onDone(plan.child); }
    else { setErr(r); setSure(0); }
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80" data-monsuc-fuse>
      <div className="w-full max-w-md rounded-t-3xl border-t-2 border-fuchsia-300/70 bg-slate-900 p-3 pb-6 text-white shadow-[0_-10px_36px_rgba(0,0,0,.55)]" style={{ maxHeight: '92dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 'max(24px, var(--mh-sa-bottom))' }}>{/* 下のボタンがホームバーに近づかないよう safe-area を見る(2026-11-16)。選ぶ段は検索を上に固定し、一覧だけをスクロールさせる(選ぶ画面の統一) */}
        <p className="text-[16px] font-black">🧬 合体する</p>
        {show ? <MonsucFuseShow a={show.a} b={show.b} child={show.child} childName={show.name} onDone={() => setShow(null)}/> : null}
        {!SUC ? <p className="mt-2 text-[11px] font-bold text-slate-400">まだ使えません</p>
        : done ? (<div style={{ overflowY: 'auto', minHeight: 0, flex: '1 1 auto' }}>
          <div className="mt-2 rounded-xl bg-fuchsia-950 p-3" data-monsuc-fuse-done>
            <p className="msx-pop text-center text-[26px] font-black text-fuchsia-200" data-monsuc-fuse-stamp>合体完了!</p>{/* 2026-11-14 社長(台帳 #6112): 育成の終わりの「育成完了!」とそろえる */}
            <p className="flex items-center gap-2 text-[14px] font-black">{typeof amgpMonIcon === 'function' ? amgpMonIcon(done.child.species) : null}{monsucFuseSpName(done.child.species)}が生まれました({done.child.gen}代目)</p>
            <p className="mt-1 text-[11px] font-bold text-slate-200">マスモンボックスに入りました。まだ育てていないので、このまま育成を始められます</p>
            <small className="mt-1 block text-[11px] font-bold text-slate-300" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{(() => { const k = typeof keptOf === 'function' ? keptOf() : null; return k === 0 ? `${done.lost.join('と')}は、メモリアルモンスターがいっぱいなので、メモリアルモンスターには残りませんでした。思い出に名前・ランク・代が残ります` : k === 1 ? `${done.lost.join('と')}のうち1体は、メモリアルモンスターとして残ります。思い出の記録(名前・ランク・代)も残ります` : `${done.lost.join('と')}は、メモリアルモンスターとして残ります。思い出の記録(名前・ランク・代)も残ります`; })()}</small>
          </div>
          {typeof onName === 'function' ? (
            <div className="mt-2 rounded-xl border border-amber-300/60 bg-amber-950/40 p-3" data-monsuc-fuse-name>
              <p className="text-[13px] font-black">生まれたモンスターに名前をつけましょう</p>
              <p className="mt-0.5 text-[10.5px] font-bold text-slate-300" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>育成を始めるときも、この名前が入っています。{'\u200b'}そこで変えることもできます</p>
              {named ? <p className="mt-2 text-[13px] font-black text-amber-200" data-monsuc-fuse-named>「{named}」と名づけました</p> : (<>
                <input type="text" value={nm} maxLength={8} placeholder={monsucFuseSpName(done.child.species).slice(0, 8)} onChange={e => { setNm(e.target.value.slice(0, 8)); setNmErr(''); }} data-monsuc-fuse-nameinput className="mt-2 w-full rounded-lg bg-slate-800 px-3 py-2 text-[14px] font-black text-white"/>
                <small className="mt-0.5 block text-[10px] font-bold text-slate-400">{(nm || '').length} / 8文字</small>
                {nmErr && <p className="mt-1 text-[11px] font-bold text-rose-200" data-monsuc-fuse-nameerr>{nmErr}</p>}
                <button type="button" data-monsuc-fuse-namego onClick={async () => {
                  const r = await onName(done.child.id, nm || monsucFuseSpName(done.child.species).slice(0, 8), Array.isArray(done.child.colors) ? done.child.colors : []);
                  if (r && r.ok) { setNamed(r.mon && r.mon.nick ? r.mon.nick : nm); setNmErr(''); } else setNmErr(r && r.why === 'name' ? 'その名前は使えません。ほかの名前にしてね' : '名前を保存できませんでした');
                }} className="mt-2 min-h-[44px] w-full text-center rounded-xl bg-amber-400 text-[14px] font-black text-slate-900">この名前にする</button></>)}
            </div>) : null}
          <button type="button" onClick={onClose} data-mhl-sheet-close className="mt-3 min-h-[44px] w-full text-center rounded-xl bg-slate-700 text-[13px] font-black">閉じる</button>
        </div>) : !main ? (<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto' }}>
          <p className="text-[11px] font-bold text-slate-300">① 主の親を選んでください。生まれるモンスターの主血統は、主の親から受け継ぎます。成長の型は、生まれたモンスターの種類で決まります</p>
          {typeof MsxPickTools === 'function' ? <MsxPickTools q={fq} onQ={setFq} sorts={typeof MSX_MM_SORTS !== 'undefined' ? MSX_MM_SORTS : null} sort={fsort} onSort={setFsort} count={usableF.length} total={usable.length}/> : null}
          <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
            {typeof MsxMmGrid === 'function' ? <MsxMmGrid label="name" mons={usableS} onPick={m => setMain(m.id)} attrs={m => ({ 'data-monsuc-fuse-pick': m.id })}/> : usableS.map(m => card(m, () => setMain(m.id), 'border-white/15 bg-slate-800'))}
          </div>
          {lockedEl}
          {/* 親を並べる所はマスモンボックスと同じ顔の升目(2026-11-14 社長) */}
          {usable.length >= 2 && !usableF.length ? <p className="mt-2 text-[11px] font-bold text-slate-400">検索に当てはまるモンスターがいません</p> : null}
          {usable.length < 2 && <p className="mt-2 text-[11px] font-bold text-slate-400" data-monsuc-fuse-none>育て終えたモンスターが2体そろうと合体できます(育成中の編成・貸し出し中のモンスターは使えません)</p>}
        </div>) : !mat ? (<div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: '1 1 auto' }}>
          <p className="text-[11px] font-bold text-slate-300">② もう一方の親を選んでください。生まれるモンスターの副血統は、このモンスターの血統から決まります</p>
          {card(main, () => setMain(null), 'border-emerald-300/70 bg-emerald-950')}
          {typeof MsxPickTools === 'function' ? <MsxPickTools q={fq} onQ={setFq} sorts={typeof MSX_MM_SORTS !== 'undefined' ? MSX_MM_SORTS : null} sort={fsort} onSort={setFsort} count={usableS.filter(m => m.id !== main.id).length} total={usable.length - 1}/> : null}
          <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
            {typeof MsxMmGrid === 'function' ? <MsxMmGrid label="name" mons={usableS.filter(m => m.id !== main.id)} onPick={m => setMat(m.id)} attrs={m => ({ 'data-monsuc-fuse-pick': m.id })}/> : usableS.filter(m => m.id !== main.id).map(m => card(m, () => setMat(m.id), 'border-white/15 bg-slate-800'))}
          </div>
          {usable.length >= 2 && !usableS.filter(m => m.id !== main.id).length ? <p className="mt-2 text-[11px] font-bold text-slate-400">検索に当てはまるモンスターがいません</p> : null}
        </div>) : plan && plan.ok ? (<div style={{ overflowY: 'auto', minHeight: 0, flex: '1 1 auto' }}>
          <p className="text-[11px] font-bold text-slate-300">③ 生まれるモンスターの見通し</p>
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-950/40 p-2" data-monsuc-fuse-child={plan.child.species}>
            {typeof amgpMonIcon === 'function' ? amgpMonIcon(plan.child.species) : null}
            <p className="text-[13px] font-black">{monsucFuseSpName(plan.child.species)} <small className="text-[11px] text-amber-200">{plan.child.gen}代目 ・ 未育成</small>
              <small className="block text-[10px] font-bold text-slate-300">型: {typeof MASMON_CALC !== 'undefined' && MASMON_CALC.typeOf ? MASMON_CALC.typeOf(plan.child.gt).name : ''}(生まれたモンスターの種類の型)</small></p>
          </div>
          <div className="mt-1 rounded-xl bg-slate-800 p-2" data-monsuc-fuse-plan>
            <p className="mb-1 text-[10.5px] font-bold text-slate-300">{monsucFuseSpName(plan.child.species)}の初めの能力に、2体の強さに応じた上乗せが付きます</p>
            {keys.map(k => <p key={k} className="flex justify-between text-[12px] font-black"><span>{names[k]}</span><span>{plan.base[k]} → <b className="text-amber-200">{plan.child.st[k]}</b> <small className="text-fuchsia-200">(+{plan.add[k]})</small></span></p>)}
          </div>
          <p className="mt-1 text-[10.5px] font-bold text-slate-300">2体ともに強いほど、上乗せが大きくなります(片方だけ強くても、あまり上がりません)</p>
          <p className="mt-1 text-[11px] font-bold text-slate-200" data-monsuc-fuse-techs>受け継ぐ技: {plan.child.techs.length ? plan.child.techs.map(t => { const x = SUC.techsOf(plan.child.species).find(y => y.id === t); return x ? x.name : t; }).join('・') + '(熟練は 0 から)' : 'なし'}</p>
          <p className="mt-1 text-[11px] font-bold text-slate-200" data-monsuc-fuse-apt>受け継ぐ間合い適性: {Array.isArray(plan.child.aptBase) && plan.child.aptBase.some(n => n > 0) ? plan.child.aptBase.map((n, i) => (n > 0 ? `${['零', '近', '中', '遠'][i]} +${n}段` : null)).filter(Boolean).join('・') : 'なし'}</p>
          <div className="mt-2 rounded-xl border-2 border-rose-400 bg-rose-950/70 p-2" data-monsuc-fuse-lose>
            <p className="text-[12px] font-black text-rose-100" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{monsucFuseNick(main)}と{monsucFuseNick(mat)}は、マスモンボックスからいなくなります。{keepNote ? keepNote : '元に戻せません'}</p>
            {!keepNote ? <p className="mt-0.5 text-[10.5px] font-bold text-rose-200">思い出に名前・ランク・代が残ります</p> : keepNote.includes('思い出') ? null : <p className="mt-0.5 text-[10.5px] font-bold text-rose-200" data-monsuc-fuse-keep>思い出の記録(名前・ランク・代)もそのまま残ります</p>}
          </div>
          {err && <p className="mt-1 text-[11px] font-bold text-rose-200" data-monsuc-fuse-err>{err}</p>}
        </div>) : <p className="mt-2 text-[11px] font-bold text-slate-400" data-monsuc-fuse-err>{(plan && plan.why) || 'この2体では合体できません'}</p>}
        {/* 決めるボタンは送る所の外(下)に置き、窓の中を送らなくても見える(2026-11-19 r1119-013 ⑥ U-12。横で「キャンセル」だけが見え、「合体する」は送った先だった) */}
        {!done && SUC && main && mat && plan && plan.ok ? <div className="mt-2 grid shrink-0 grid-cols-2 gap-2" data-monsuc-fuse-foot>
          <button type="button" data-mh-back onClick={() => { setMat(null); setSure(0); setErr(''); }} className="min-h-[44px] w-full text-center rounded-xl bg-slate-700 text-[13px] font-black">選び直す</button>
          <button type="button" onClick={go} disabled={!ready || busy} data-monsuc-fuse-go={sure} data-monsuc-fuse-ready={ready ? 1 : 0} className={`disabled:opacity-50 min-h-[48px] w-full text-center rounded-xl text-[14px] font-black ${sure ? 'bg-rose-500 text-white' : 'bg-fuchsia-500 text-white'}`}>{busy ? '合体しています…' : sure ? '本当に合体する' : '🧬 合体する'}</button>
        </div>
        : !done && <button type="button" onClick={onClose} data-mhl-sheet-close className="mt-2 min-h-[44px] w-full text-center rounded-xl bg-slate-700 text-[13px] font-black">キャンセル</button>}
      </div>
    </div>);
}

// ---- 合体の演出(2体 → 円盤石 → 生まれる。r1115-202 M10) ----
//   0 2体が中央へ寄る → 1 光になって円盤石へ吸い込まれる(震える) → 2 閃光 → 3 生まれた子が現れる(「次へ」で閉じる)。保存はしない・合体の確定のあとに出すだけ。
//   「動きを減らす」設定(msxFxCalm)と prefers-reduced-motion では出さない(すぐ結果の札)。早送り・短縮つき
const MONSUC_FUSE_STEPS = Object.freeze([1500, 1500, 700]); // 0→1・1→2・2→3 に替わるまでのミリ秒
const monsucFuseImg = (sp) => { try { if (typeof msxMonImg === 'function') { const u = msxMonImg(sp); if (u) return u; } const m = typeof ALL_PLAYER_MONSTERS !== 'undefined' ? ALL_PLAYER_MONSTERS[sp] : null; return (m && (m.imgUrl || m.iconUrl)) || ''; } catch (e) { return ''; } };
const monsucFuseCalm = () => {
  try { if (typeof msxFxCalm === 'function' && msxFxCalm()) return true; } catch (e) { /* 続ける */ }
  try { return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};
const MONSUC_FUSE_CSS = `
.mf-show{position:fixed;inset:0;z-index:95;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;overflow:hidden;background:radial-gradient(ellipse at 50% 45%,#4c1d95 0,#1e1b4b 55%,#0b0920 100%);color:#fff}
.mf-show .bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35}
.mf-head{position:absolute;left:50%;top:9%;transform:translateX(-50%);padding:6px 16px;border-radius:12px;background:rgba(15,23,42,.72);font-weight:900;font-size:16px;text-align:center;max-width:92vw;box-shadow:0 0 0 2px rgba(240,171,252,.8)}
.mf-head small{display:block;font-size:11px;color:#f5d0fe;font-weight:800}
.mf-stage{position:absolute;left:0;right:0;top:20%;bottom:22%}
.mf-mon{position:absolute;bottom:18%;height:44%;max-width:40%;object-fit:contain;filter:drop-shadow(0 6px 10px rgba(0,0,0,.5));transition:left 1.2s ease-in,right 1.2s ease-in,transform 1.2s ease-in,opacity .5s}
.mf-mon.a{left:6%}.mf-mon.b{right:6%}
.mf-show.st0 .mf-mon.a{left:6%;animation:mfBobA 1.1s ease-in-out infinite}.mf-show.st0 .mf-mon.b{right:6%;animation:mfBobB 1.1s ease-in-out infinite}
.mf-show.st1 .mf-mon.a{left:calc(50% - 20%);transform:scale(.35);opacity:.25}.mf-show.st1 .mf-mon.b{right:calc(50% - 20%);transform:scale(.35);opacity:.25}
.mf-show.st2 .mf-mon,.mf-show.st3 .mf-mon{display:none}
.mf-stone{position:absolute;left:50%;bottom:26%;width:44%;max-width:210px;aspect-ratio:1/1;transform:translateX(-50%);animation:mfShake .18s linear infinite}
.mf-stone img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 8px 14px rgba(0,0,0,.45))}
.mf-stone i{position:absolute;inset:-20%;border-radius:50%;background:radial-gradient(circle,rgba(250,232,255,.95),rgba(232,121,249,.5) 40%,rgba(232,121,249,0) 70%);animation:mfGlow .8s ease-in-out infinite alternate}
.mf-flash{position:absolute;inset:0;background:#fff;animation:mfFlash .7s ease-out forwards;pointer-events:none}
.mf-child{position:absolute;left:50%;bottom:20%;height:48%;max-width:70%;object-fit:contain;transform:translateX(-50%);animation:mfPop .7s cubic-bezier(.2,1.4,.4,1) both;filter:drop-shadow(0 6px 12px rgba(0,0,0,.5))}
.mf-ctl{position:absolute;right:10px;top:10px;display:flex;gap:6px;z-index:2}
.mf-ctl button{min-height:36px;padding:0 10px;border-radius:10px;background:rgba(15,23,42,.8);color:#fff;font-size:12px;font-weight:900}
.mf-next{position:relative;z-index:2;margin:0 16px 22px;min-height:48px;width:calc(100% - 32px);max-width:380px;border-radius:14px;background:#d946ef;color:#fff;font-size:15px;font-weight:900;display:flex;align-items:center;justify-content:center;text-align:center} /* 字を真ん中に(合体中…が左へ寄っていた・r1115-202) */
.mf-next:disabled{opacity:.4}
.mf-show.calm .mf-stone,.mf-show.calm .mf-stone i,.mf-show.calm .mf-child,.mf-show.calm .mf-mon{animation:none}
@keyframes mfBobA{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes mfBobB{0%,100%{transform:translateY(-8px)}50%{transform:translateY(0)}}
@keyframes mfShake{0%{transform:translateX(-50%) rotate(0)}25%{transform:translateX(calc(-50% - 3px)) rotate(-2deg)}75%{transform:translateX(calc(-50% + 3px)) rotate(2deg)}100%{transform:translateX(-50%) rotate(0)}}
@keyframes mfGlow{from{opacity:.55;transform:scale(.92)}to{opacity:1;transform:scale(1.1)}}
@keyframes mfFlash{from{opacity:1}to{opacity:0}}
@keyframes mfPop{from{opacity:0;transform:translateX(-50%) scale(.3)}to{opacity:1;transform:translateX(-50%) scale(1)}}
@media (prefers-reduced-motion: reduce){.mf-stone,.mf-stone i,.mf-child,.mf-mon{animation:none}}
`;
let monsucFuseCssDone = false;
const monsucFuseEnsureCss = () => {
  if (monsucFuseCssDone || typeof document === 'undefined') return;
  monsucFuseCssDone = true;
  const el = document.createElement('style'); el.setAttribute('data-monsuc-fuse-css', '1'); el.textContent = MONSUC_FUSE_CSS; document.head.appendChild(el);
};
function MonsucFuseShow({ a, b, child, childName, onDone }) {
  monsucFuseEnsureCss();
  const calm = monsucFuseCalm();
  const [st, setSt] = React.useState(0);
  React.useEffect(() => {
    if (st >= 3) return undefined;
    const id = setTimeout(() => setSt((n) => Math.min(3, n + 1)), calm ? 400 : MONSUC_FUSE_STEPS[st]);
    return () => clearTimeout(id);
  }, [st]);
  if (typeof msxUseTimedSe === 'function') msxUseTimedSe(st === 1 ? [['awQi', 0]] : st === 2 ? [['awFlash', 0]] : st === 3 && !calm ? [['awKira', 0]] : [], [st]);
  const stone = typeof DISC_STONE_BASE === 'string' ? DISC_STONE_BASE : 'images/disc-icons/disc-stone-base.PNG';
  return (
    <div className={`mf-show st${st}${calm ? ' calm' : ''}`} data-monsuc-fuse-show={st}>
      <img className="bgimg" src="images/story-bg/monhero_plaza.jpg" alt=""/>
      <div className="mf-head"><small>合体</small>{((t) => (typeof jaWrap === 'function' ? jaWrap(t) : t))(st >= 3 ? `${childName}が生まれた!` : st >= 1 ? '2体の力が円盤石に集まっていく…' : '2体が1つになろうとしている…')}</div>
      {st < 3 ? <div className="mf-ctl"><button type="button" onClick={() => setSt((n) => Math.min(3, n + 1))} data-monsuc-fuse-ff>早送り ⏩</button><button type="button" onClick={() => setSt(3)} data-monsuc-fuse-skip>飛ばす ⏭</button></div> : null}
      <div className="mf-stage">
        <img className="mf-mon a" src={monsucFuseImg(a)} alt=""/><img className="mf-mon b" src={monsucFuseImg(b)} alt=""/>
        {st === 1 || st === 2 ? <span className="mf-stone" aria-hidden="true"><img src={stone} alt=""/><i/></span> : null}
        {st === 2 ? <span className="mf-flash" aria-hidden="true"/> : null}
        {st >= 3 ? <img className="mf-child" src={monsucFuseImg(child)} alt=""/> : null}
      </div>
      <button type="button" className="mf-next" disabled={st < 3} onClick={onDone} data-monsuc-fuse-show-next>{st >= 3 ? '次へ ▶' : '合体中…'}</button>
    </div>
  );
}

