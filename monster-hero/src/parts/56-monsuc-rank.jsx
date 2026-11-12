// ===== モンヒロサクセス 育成完了時の総合力ランキング(2026-11-12 クラフト・設計 docs/progress/player-raise/RANKING.md) =====
// 送る口・読む口・画面(R1 全モンスター / R2 血統別・行を押すと6能力)をここに閉じる。
//   サーバ: supabase/migrations/202611120003_monsuc_rank.sql(表 monsuc_finishes・見え方 monsuc_rank_all / monsuc_rank_lineage・関数 monsuc_rank_submit)
//   ★総合力と評価はサーバが出し直す。端末の値は表示の目安だけ
//   ★持ち主の鍵は助手マスモン対戦の鍵(mh_masmon_pvp_owner_key_v1)をそのまま使う(56-assistant-masmon-pvp.jsx の masmonPvpSelf)
//   保存(新しいキーだけ・CLAUDE.md ⑦):
//     mh_monsuc_rank_sent_v1  … 送れた育成の id の一覧(新しい50件)。二重に送らない印
//     mh_monsuc_rank_queue_v1 … 送れなかった1件ずつの中身(5件まで)。開いたときに1件ずつ送り直す
//   送らないもの: デビュー戦のゲームオーバー・まだ終わっていない育成・デバッグで進めた育成
//   公開の印: RELEASE_FLAGS.monheroSuccess(モンヒロサクセス本体と同じ印)が真のときだけ通信する
// 引退の画面からは  typeof monsucRankSubmit === 'function' && monsucRankSubmit({ run, ev, name, colors, debug })  で呼ぶ(待たなくてよい・落ちない)
const MONSUC_RANK_SENT_KEY = 'mh_monsuc_rank_sent_v1';
const MONSUC_RANK_QUEUE_KEY = 'mh_monsuc_rank_queue_v1';
const MONSUC_RANK_SENT_MAX = 50;
const MONSUC_RANK_QUEUE_MAX = 5;
const MONSUC_RANK_TIMEOUT_MS = 12000;
const MONSUC_RANK_LIMIT_ALL = 100;
const MONSUC_RANK_LIMIT_LINEAGE = 50;
const MONSUC_RANK_STAT_KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
const MONSUC_RANK_STAT_LABEL = { life: '❤️ライフ', pow: '💪ちから', wise: '🧠かしこさ', hit: '🎯命中', eva: '💨回避', tough: '🛡️丈夫さ' };
const MONSUC_RANK_GRADE_COLOR = { M: '#f472b6', SSS: '#f472b6', SS: '#fb923c', S: '#fbbf24', A: '#f472b6', B: '#a78bfa', C: '#38bdf8', D: '#94a3b8', E: '#94a3b8', F: '#94a3b8', G: '#94a3b8' };
const MONSUC_RANK_REASON_TEXT = Object.freeze({
  off: 'ランキングは準備中です',
  network: 'つながりませんでした。次に開いたときにもう一度送ります',
  busy: '少し待ってから送り直します',
  bad: 'この記録はランキングに載せられませんでした',
  locked: 'この端末ではランキングに送れません',
  over_cap: 'この記録はランキングに載せられませんでした',
  skip: 'この育成はランキングの対象外です',
  no_id: 'この端末ではまだ送れません',
});
const monsucRankReasonText = (reason) => MONSUC_RANK_REASON_TEXT[reason] || MONSUC_RANK_REASON_TEXT.network;
const monsucRankOn = () => typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS && RELEASE_FLAGS.monheroSuccess === true;
const monsucRankNum = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const monsucRankClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const monsucRankLineageOf = (species) => {
  const m = typeof MONSTER_LINEAGE_MAP !== 'undefined' && MONSTER_LINEAGE_MAP ? MONSTER_LINEAGE_MAP[species] : null;
  return m && typeof m.main === 'string' ? m.main : 'unknown';
};
const monsucRankLineageName = (id) => {
  const l = typeof MONSTER_LINEAGES !== 'undefined' && MONSTER_LINEAGES ? MONSTER_LINEAGES[id] : null;
  return l && l.name ? l.name : '？？？';
};
// 計算の芯(data/monhero-success.js)の版。読み込まれていなければ 1
const monsucRankEngineVersion = () => { const S = typeof globalThis !== 'undefined' && globalThis ? globalThis['MONHERO_SUCCESS'] : null; return S && Number.isInteger(S.VERSION) ? S.VERSION : 1; };
// ALL_PLAYER_MONSTERS は種族名をキーにしたオブジェクト(data/ally-monsters.js)
const monsucRankMonOf = (species) => {
  if (typeof species !== 'string' || typeof ALL_PLAYER_MONSTERS === 'undefined' || !ALL_PLAYER_MONSTERS || typeof ALL_PLAYER_MONSTERS !== 'object') return null;
  const m = Object.prototype.hasOwnProperty.call(ALL_PLAYER_MONSTERS, species) ? ALL_PLAYER_MONSTERS[species] : null;
  return m && typeof m === 'object' ? m : null;
};
// 染めた色は「部位ごとの色の id の配列」(DyedMonsterImage の masuColors の形)だけ通す。ほかの人の行はだれでも入れられるので、読む側でも必ず整える
const monsucRankDyeOf = (dye) => (Array.isArray(dye) ? dye.slice(0, 6).map(c => (typeof c === 'string' && c.length <= 40 ? c : null)) : null);
// 育成の id(英数字だけ・6〜32字)。計算の芯の s.id をもとに作り、持ち主の番号を前に付ける
const monsucRankRunId = (owner, rawId) => {
  let tail = String(rawId === undefined || rawId === null ? '' : rawId).replace(/[^A-Za-z0-9]/g, '').slice(-32);
  if (tail.length < 6) tail = (tail + '000000').slice(0, 6);
  return `${owner}-${tail}`;
};

// ---- 保存(新しいキーだけ。無い・壊れている → 空) ----
const monsucRankSentList = async () => {
  try { const v = await storeGet(MONSUC_RANK_SENT_KEY, [], false); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(-MONSUC_RANK_SENT_MAX) : []; } catch (_) { return []; }
};
const monsucRankMarkSent = async (runId) => {
  const list = await monsucRankSentList();
  if (list.includes(runId)) return;
  try { await storeSet(MONSUC_RANK_SENT_KEY, list.concat([runId]).slice(-MONSUC_RANK_SENT_MAX), false); } catch (_) {}
};
const monsucRankQueue = async () => {
  try {
    const v = await storeGet(MONSUC_RANK_QUEUE_KEY, [], false);
    return Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && typeof x.run_id === 'string').slice(-MONSUC_RANK_QUEUE_MAX) : [];
  } catch (_) { return []; }
};
const monsucRankQueueSave = async (list) => { try { await storeSet(MONSUC_RANK_QUEUE_KEY, list.slice(-MONSUC_RANK_QUEUE_MAX), false); } catch (_) {} };

// 送る中身(サーバの monsuc_rank_submit の p_row の形)。送らない育成は null
const monsucRankRowOf = ({ owner, run, ev, name, colors, userName }) => {
  if (!run || typeof run !== 'object') return null;
  if (!['done', 'lost'].includes(run.over) && run.retired !== true) return null; // まだ終わっていない・デビュー戦のゲームオーバーは送らない
  if (run.over === 'gameover') return null;
  const st = run.stats && typeof run.stats === 'object' ? run.stats : {};
  const stats = {};
  MONSUC_RANK_STAT_KEYS.forEach(k => { stats[k] = monsucRankClamp(Math.round(monsucRankNum(st[k])), 0, 999); });
  const techs = (Array.isArray(run.techs) ? run.techs : []).slice(0, 8).map(t => monsucRankClamp(Math.round(monsucRankNum(run.mastery && run.mastery[t])), 0, 100));
  const species = typeof run.species === 'string' && /^[A-Za-z]{2,32}$/.test(run.species) ? run.species : null;
  if (!species) return null;
  const e = ev && typeof ev === 'object' ? ev : {};
  const dyeOk = monsucRankDyeOf(colors) || [];
  return {
    run_id: monsucRankRunId(owner, run.id),
    user_name: String(userName || '').slice(0, 40),
    child_name: String(name || '').slice(0, 24),
    species, lineage: monsucRankLineageOf(species), dye: dyeOk, stats, techs,
    lv: monsucRankClamp(Math.round(monsucRankNum(e.lv !== undefined ? e.lv : run.lv, 1)), 1, 99),
    loyal: monsucRankClamp(Math.round(monsucRankNum(e.loyal)), 0, 100),
    pop: monsucRankClamp(Math.round(monsucRankNum(e.pop !== undefined ? e.pop : run.pop)), 0, 100),
    engine_version: monsucRankEngineVersion(),
  };
};

// サーバの関数を呼ぶ。落ちない(失敗は { ok:false, reason })
const monsucRankPost = async (owner, key, row) => {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), MONSUC_RANK_TIMEOUT_MS) : null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/monsuc_rank_submit`, {
      method: 'POST', headers: SB_HEADERS, body: JSON.stringify({ p_owner: owner, p_key: key, p_row: row }), signal: ac ? ac.signal : undefined,
    });
    if (!r.ok) return { ok: false, reason: 'network' };
    let j = null;
    try { j = await r.json(); } catch (_) { j = null; }
    if (!j || typeof j !== 'object') return { ok: false, reason: 'network' };
    return j;
  } catch (_) {
    return { ok: false, reason: 'network' };
  } finally { if (timer) clearTimeout(timer); }
};
// 1件を送り、結果で印と送り直しの列を整える
const monsucRankSendRow = async (me, row) => {
  const r = await monsucRankPost(me.owner, me.key, row);
  const queue = (await monsucRankQueue()).filter(x => x.run_id !== row.run_id);
  if (r.ok) {
    await monsucRankMarkSent(row.run_id);
    await monsucRankQueueSave(queue);
    return { ok: true, power: r.power, grade: r.grade, placeAll: r.place_all || null, placeLineage: r.place_lineage || null, lineage: row.lineage };
  }
  // 形・上限・鍵で断られたものは送り直しても通らないので列から外す。電波・混雑は残す
  if (['bad', 'over_cap', 'locked'].includes(r.reason)) await monsucRankQueueSave(queue);
  else await monsucRankQueueSave(queue.concat([row]));
  return { ok: false, reason: r.reason || 'network' };
};
const monsucRankUserName = async () => { try { return String((await storeGet('mh_breeder_name', '', false)) || ''); } catch (_) { return ''; } };

// 引退して育成が完了したとき1回だけ呼ぶ。run = 計算の芯の状態 s・ev = SUC.evaluate(s)・name = 育てた子の名前・colors = 染めた色・debug = デバッグで進めた育成なら真
//   返り値 { ok, placeAll, placeLineage, lineage, power, grade } か { ok:false, reason }
const monsucRankSubmit = async ({ run, ev, name, colors, debug } = {}) => {
  try {
    if (!monsucRankOn()) return { ok: false, reason: 'off' };
    if (debug) return { ok: false, reason: 'skip' };
    const me = typeof masmonPvpSelf === 'function' ? await masmonPvpSelf(true) : null;
    if (!me) return { ok: false, reason: 'no_id' };
    const row = monsucRankRowOf({ owner: me.owner, run, ev, name, colors, userName: await monsucRankUserName() });
    if (!row) return { ok: false, reason: 'skip' };
    if ((await monsucRankSentList()).includes(row.run_id)) return { ok: false, reason: 'skip' }; // もう送った
    return await monsucRankSendRow(me, row);
  } catch (_) { return { ok: false, reason: 'network' }; }
};
// 送れなかったものを1件だけ送り直す(サーバは1分に1回まで。開いたときに呼ぶ)
const monsucRankFlush = async () => {
  try {
    if (!monsucRankOn()) return { ok: false, reason: 'off' };
    const queue = await monsucRankQueue();
    if (queue.length === 0) return { ok: true, left: 0 };
    const sent = await monsucRankSentList();
    const rest = queue.filter(x => !sent.includes(x.run_id));
    if (rest.length !== queue.length) await monsucRankQueueSave(rest);
    if (rest.length === 0) return { ok: true, left: 0 };
    const me = typeof masmonPvpSelf === 'function' ? await masmonPvpSelf(false) : null;
    if (!me || !rest[0].run_id.startsWith(`${me.owner}-`)) return { ok: false, reason: 'no_id' };
    const r = await monsucRankSendRow(me, rest[0]);
    return { ...r, left: Math.max(0, rest.length - 1) };
  } catch (_) { return { ok: false, reason: 'network' }; }
};

// ---- 読む(読むだけ)。失敗は null ----
const MONSUC_RANK_COLS = 'run_id,user_name,child_name,species,lineage,dye,stats,tech_count,lv,power,grade,place';
const monsucRankGet = async (path, withCount) => {
  try {
    const headers = withCount ? { ...SB_HEADERS, Prefer: 'count=exact' } : SB_HEADERS;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, cache: 'no-store' });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    let total = null;
    if (withCount) { const m = /\/(\d+)$/.exec(r.headers.get('content-range') || ''); total = m ? Number(m[1]) : null; }
    return { rows, total };
  } catch (_) { return null; }
};
// lineage を渡すと血統別。{ rows, total, mine }(mine = 自分の子のいちばん上の行)
const monsucRankRead = async ({ lineage = null } = {}) => {
  const lin = typeof lineage === 'string' && /^[A-Za-z_]{1,32}$/.test(lineage) ? lineage : null;
  const view = lin ? 'monsuc_rank_lineage' : 'monsuc_rank_all';
  const where = lin ? `&lineage=eq.${lin}` : '';
  const limit = lin ? MONSUC_RANK_LIMIT_LINEAGE : MONSUC_RANK_LIMIT_ALL;
  const top = await monsucRankGet(`${view}?select=${MONSUC_RANK_COLS}${where}&order=place.asc,run_id.asc&limit=${limit}`, true);
  if (!top) return null;
  const sent = (await monsucRankSentList()).filter(id => /^[A-Za-z0-9_-]{1,64}-[A-Za-z0-9]{6,32}$/.test(id));
  let mine = null;
  if (sent.length > 0) {
    const m = await monsucRankGet(`${view}?select=${MONSUC_RANK_COLS}${where}&run_id=in.(${sent.map(encodeURIComponent).join(',')})&order=place.asc&limit=1`, false);
    mine = m && m.rows[0] ? m.rows[0] : null;
  }
  return { rows: top.rows, total: top.total, mine, sent };
};

// ---- 画面 ----
function MonsucRankMonImg({ species, dye, size = 36 }) {
  const mon = monsucRankMonOf(species);
  if (!mon) return <div style={{ width: size, height: size }} className="rounded-lg bg-slate-700/60 flex items-center justify-center text-slate-400 text-xs">？</div>;
  return <div style={{ width: size, height: size }} className="shrink-0 flex items-center justify-center">
    <DyedMonsterImage baseId={mon.id} src={mon.iconUrl || mon.imgUrl} alt={mon.name || ''} masuColors={monsucRankDyeOf(dye)} className="w-full h-full object-contain" draggable={false} />
  </div>;
}
function MonsucRankGrade({ grade }) {
  const g = typeof grade === 'string' && /^[A-Z]{1,3}[0-9]{0,3}$/.test(grade) ? grade : 'G'; // 評価は 500 ごとの数字つき(C2・M3 など)。色は字の部分で決める
  const letter = g.replace(/[0-9]+$/, '');
  return <span className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1 rounded-md text-[12px] font-black text-slate-900" style={{ background: MONSUC_RANK_GRADE_COLOR[letter] || '#94a3b8' }}>{g}</span>;
}
function MonsucRankStats({ stats }) {
  const st = stats && typeof stats === 'object' ? stats : {};
  return <div className="grid grid-cols-6 gap-1 mt-2">
    {MONSUC_RANK_STAT_KEYS.map(k => <div key={k} className="rounded-md bg-slate-950/60 py-1 text-center">
      <div className="text-[9px] text-slate-300 whitespace-nowrap">{MONSUC_RANK_STAT_LABEL[k]}</div>
      <div className="text-[13px] font-black text-white">{Math.round(monsucRankNum(st[k]))}</div>
    </div>)}
  </div>;
}
function MonsucRankRow({ row, open, onToggle, mine, pinned }) {
  const top = row.place <= 3;
  const cls = pinned ? 'border-pink-400/80 bg-pink-900/40' : open ? 'border-yellow-400/80 bg-yellow-900/30' : mine ? 'border-pink-400/60 bg-slate-800/80' : 'border-slate-600/60 bg-slate-800/70';
  return <button type="button" onClick={onToggle} className={`w-full text-left rounded-xl border px-3 py-2 ${cls}`} aria-expanded={!!open}>
    <div className="flex items-center gap-2">
      <div className={`w-8 text-center font-black ${top ? 'text-yellow-300 text-lg' : 'text-slate-200 text-base'}`}>{row.place}</div>
      <MonsucRankMonImg species={row.species} dye={row.dye} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-black text-white truncate">{row.child_name || (monsucRankMonOf(row.species) || {}).name || '？？？'}</div>
        <div className="text-[10px] text-slate-300 truncate">育てた人: {pinned ? 'あなた' : (row.user_name || 'ななしのブリーダー')}</div>
      </div>
      <MonsucRankGrade grade={row.grade} />
      <div className="w-[64px] text-right text-[15px] font-black text-yellow-300">{Math.round(monsucRankNum(row.power)).toLocaleString()}</div>
    </div>
    {open && <MonsucRankStats stats={row.stats} />}
  </button>;
}
// 血統の札(主血統のうち、遊べるモンスターがいるもの)
const monsucRankLineageTabs = () => {
  const map = typeof MONSTER_LINEAGE_MAP !== 'undefined' && MONSTER_LINEAGE_MAP ? MONSTER_LINEAGE_MAP : {};
  const out = [];
  Object.keys(map).forEach(sp => { const l = map[sp] && map[sp].main; if (typeof l === 'string' && l !== 'unknown' && !out.includes(l) && monsucRankMonOf(sp)) out.push(l); });
  return out;
};

// R1 全モンスター / R2 血統別。onBack で戻る
function MonsucRankScreen({ onBack }) {
  const [tab, setTab] = React.useState('all');
  const lineages = React.useMemo(() => monsucRankLineageTabs(), []);
  const [lineage, setLineage] = React.useState(() => lineages[0] || 'mocchi');
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(null);
  const on = monsucRankOn();
  React.useEffect(() => { if (on) monsucRankFlush(); }, [on]);
  React.useEffect(() => {
    let alive = true;
    if (!on) { setLoading(false); return undefined; }
    setLoading(true); setOpen(null);
    monsucRankRead({ lineage: tab === 'lineage' ? lineage : null }).then(d => { if (alive) { setData(d); setLoading(false); } });
    return () => { alive = false; };
  }, [on, tab, lineage]);
  const rows = data && Array.isArray(data.rows) ? data.rows : [];
  const sent = data && Array.isArray(data.sent) ? data.sent : [];
  const mine = data ? data.mine : null;
  const scopeName = tab === 'lineage' ? `${monsucRankLineageName(lineage)}系` : '全体';
  const totalText = data && Number.isFinite(data.total) ? `${data.total.toLocaleString()}${tab === 'lineage' ? '体' : '件'}` : '';
  return <div className="fixed inset-0 z-[60] flex flex-col text-white" style={{ background: 'linear-gradient(180deg,#1e1b4b 0%,#0f172a 100%)' }}>
    <div className="flex items-center gap-2 px-3 pt-3">
      <button type="button" onClick={onBack} className="rounded-full bg-slate-700/80 px-3 py-1 text-[12px] font-bold">← もどる</button>
      <div className="text-[13px] font-black text-pink-300">🌱 モンヒロサクセス</div>
    </div>
    <div className="px-3 pt-2">
      <div className="text-[18px] font-black">🏆 総合力ランキング</div>
      <div className="text-[11px] text-slate-300 leading-snug">育て終えたモンスターの、育てたときの総合力。育てたモンスターごとに全部載る(同じ人が何体でも)・助手マスモンとは別</div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {[['all', '全モンスター'], ['lineage', '血統別']].map(([k, label]) => <button key={k} type="button" onClick={() => setTab(k)}
          className={`rounded-full py-2 text-[14px] font-black border ${tab === k ? 'bg-yellow-300 text-slate-900 border-yellow-300' : 'bg-slate-800/70 text-slate-200 border-slate-600'}`}>{label}</button>)}
      </div>
      {tab === 'lineage' && <div className="flex gap-1.5 overflow-x-auto mt-2 pb-1">
        {lineages.map(l => <button key={l} type="button" onClick={() => setLineage(l)}
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold border ${lineage === l ? 'bg-yellow-300 text-slate-900 border-yellow-300' : 'bg-slate-800/70 text-slate-200 border-slate-600'}`}>{monsucRankLineageName(l)}系</button>)}
      </div>}
      <div className="text-[12px] text-slate-200 mt-1.5">{scopeName} {totalText}{mine ? <> ・ あなたの順位 <span className="text-yellow-300 font-black">{mine.place}位</span></> : null}</div>
    </div>
    <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
      {!on && <div className="text-center text-slate-300 text-[13px] py-8">{monsucRankReasonText('off')}</div>}
      {on && loading && <div className="text-center text-slate-300 text-[13px] py-8">読みこみ中…</div>}
      {on && !loading && !data && <div className="text-center text-slate-300 text-[13px] py-8">つながりませんでした。少し待ってからもう一度開いてね</div>}
      {on && !loading && data && rows.length === 0 && <div className="text-center text-slate-300 text-[13px] py-8">まだだれも載っていません。育て終えたモンスターが最初に載ります</div>}
      {rows.map(r => <MonsucRankRow key={r.run_id} row={r} open={open === r.run_id} mine={sent.includes(r.run_id)} onToggle={() => setOpen(o => (o === r.run_id ? null : r.run_id))} />)}
    </div>
    {mine && <div className="px-3 pb-1">
      <MonsucRankRow row={mine} pinned open={open === `me:${mine.run_id}`} onToggle={() => setOpen(o => (o === `me:${mine.run_id}` ? null : `me:${mine.run_id}`))} />
    </div>}
    <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-1">
      <button type="button" onClick={onBack} className="rounded-full bg-slate-700/80 py-2 text-[13px] font-bold">← もどる</button>
      <div className="rounded-full bg-yellow-300 text-slate-900 py-2 text-[12px] font-black text-center">{tab === 'lineage' ? '血統は 種類のまとまり' : '押すと6能力が開く'}</div>
    </div>
  </div>;
}
