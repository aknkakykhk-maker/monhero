// ===== 事件簿(聖夜の名探偵)のランキング(台帳 r1126-107・追記1) =====
// 設計: docs/progress/event-xmas-2026/ranking-r1126-107/README.md / サーバ: 同じ所の xmas_novel_rank.sql(窓口が本番に流した)
//
// 決めごと:
//  ・端末は数を送らない。送るのは「どのエンドに着いた」「どの問いを一発で当てた/外した」という出来事だけ。数と順位はサーバが数える
//  ・遊んだ回数 = エンドに着いた回数(同じエンドは1日1回まで・サーバが決める)。はじめに開くタブは「見たエンド」。入口は事件簿の起動画面だけ。ごほうびなし
//  ・持ち主の鍵は助手マスモン対戦と同じ(masmonPvpSelf・mh_masmon_pvp_owner_key_v1)。ブリーダーIDと鍵は画面に出さない
//  ・端末の保存は新しいキー mh_xmas_novel_rank_v1 だけ。mh_xmas_novel_v1・mh_xmas_novel_route_v1 は読むだけで、形も中身も変えない(⑦)
//    { v:1, seeded:0|1, pending:[{ k:'end', id } | { k:'first', id, ok }] }(ためるのは50件まで・壊れていたら既定値)
//  ・ランキングを入れる前の記録(mh_xmas_novel_v1 の endings・endAt・first)は、1回だけまとめて送る(seed。サーバも人ごとに1回だけ受ける)
//  ・デバッグ・検査で開いたとき(openXmasNovel の force)は送らない。サーバは 5秒に1回まで受けるので、ためた分は間を空けて1件ずつ送る
//  ・表や関数が無い・つながらない・期間外でも、事件簿はふつうに遊べる(送れなかった分はためておく)

const XMAS_NOVEL_RANK_KEY = 'mh_xmas_novel_rank_v1';
const XMAS_NOVEL_RANK_EVENT = 'xmas_novel_2026';
const XMAS_NOVEL_RANK_PENDING_MAX = 50;
const XMAS_NOVEL_RANK_GAP_MS = 5600;      // サーバの「5秒に1回」より少し長く
const XMAS_NOVEL_RANK_SHOW = 100;
const XMAS_NOVEL_RANK_QIDS = ['Q2a', 'Q3a', 'Q4a', 'Q5a', 'Q6a', 'Q6b', 'Q7a', 'Q7m'];
const XMAS_NOVEL_RANK_TABS = [
  { id: 'ends', label: '見たエンド', view: 'xmas_novel_rank_ends', col: 'ends', order: 'place.asc,ends_at.asc', rule: ['見たエンディングの種類の数。', '同じ数なら、先にその数に届いた人が上'] },
  { id: 'perfect', label: '一発正解', view: 'xmas_novel_rank_perfect', col: 'perfect', order: 'place.asc,perfect_at.asc', rule: ['推理の問いを、1番はじめに答えたとき', '一発で当てた数(7問)。同じ数なら、', '見たエンディングの多い人が上'] },
  { id: 'plays', label: '読んだ回数', view: 'xmas_novel_rank_plays', col: 'plays', order: 'place.asc,plays_at.asc', rule: ['エンディングに着いた回数。', '同じエンディングは、1日(朝4:00区切り)に', '1回まで数える'] },
];

const xmasNovelRankNormalize = (raw) => {
  const r = raw && typeof raw === 'object' ? raw : {};
  const pending = (Array.isArray(r.pending) ? r.pending : []).filter((p) => p && typeof p === 'object' && (
    (p.k === 'end' && typeof p.id === 'string' && /^END-[A-Z]{1,4}\d{0,2}$/.test(p.id))
    || (p.k === 'first' && XMAS_NOVEL_RANK_QIDS.includes(p.id) && typeof p.ok === 'boolean'))).map((p) => (p.k === 'end' ? { k: 'end', id: p.id } : { k: 'first', id: p.id, ok: p.ok }));
  return { v: 1, seeded: r.seeded === 1 ? 1 : 0, pending: pending.slice(-XMAS_NOVEL_RANK_PENDING_MAX) };
};
const xmasNovelRankLoad = async () => { try { return xmasNovelRankNormalize(await storeGet(XMAS_NOVEL_RANK_KEY, null, false)); } catch (e) { return xmasNovelRankNormalize(null); } };
const xmasNovelRankSave = async (v) => { try { return await storeSet(XMAS_NOVEL_RANK_KEY, xmasNovelRankNormalize(v), false); } catch (e) { return false; } };

// 表・関数が無いと分かったら、その起動のあいだは呼ばない
let xmasNovelRankMissing = false;
const xmasNovelRankFetch = async (path, init = {}) => {
  if (xmasNovelRankMissing || typeof SUPABASE_URL === 'undefined') return null;
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), 8000) : null;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { cache: 'no-store', ...init, headers: typeof SB_HEADERS !== 'undefined' ? SB_HEADERS : { 'Content-Type': 'application/json' }, signal: ac ? ac.signal : undefined });
    const body = await res.text();
    if (!res.ok) {
      if (res.status === 404 && /PGRST20[25]|Could not find the (table|function)|does not exist/i.test(body)) xmasNovelRankMissing = true;
      return null;
    }
    return JSON.parse(body || 'null');
  } catch (e) { return null; } finally { if (timer) clearTimeout(timer); }
};
const xmasNovelRankSelf = async () => {
  try { return typeof masmonPvpSelf === 'function' ? await masmonPvpSelf(true) : null; } catch (e) { return null; }
};
const xmasNovelRankName = async () => {
  try { const n = await storeGet('mh_breeder_name', '', false); return typeof n === 'string' ? n.trim().slice(0, 40) : ''; } catch (e) { return ''; }
};
const xmasNovelRankRpc = async (fn, args) => xmasNovelRankFetch(`rpc/${fn}`, { method: 'POST', body: JSON.stringify(args) });

// 1件を送る。返り値: サーバの返事(ok / reason / 自分の数と順位)か null(届かなかった)
const xmasNovelRankSend = async (self, name, row) => xmasNovelRankRpc('xmas_novel_rank_submit', { p_owner: self.owner, p_key: self.key, p_row: { ...row, user_name: name } });

// ためた分を送る(同時に2本走らせない)。seed(前の記録)が先
let xmasNovelRankBusy = false;
const xmasNovelRankFlush = async (script = null) => {
  if (xmasNovelRankBusy) return null;
  xmasNovelRankBusy = true;
  let last = null;
  try {
    const self = await xmasNovelRankSelf();
    if (!self) return null;
    const name = await xmasNovelRankName();
    let st = await xmasNovelRankLoad();
    const wait = () => new Promise((r) => setTimeout(r, XMAS_NOVEL_RANK_GAP_MS));
    if (!st.seeded) {
      const S = script || (typeof XMAS_NOVEL_SCRIPT !== 'undefined' ? XMAS_NOVEL_SCRIPT : null);
      const save = typeof xmasNovelLoad === 'function' && S ? await xmasNovelLoad(S) : null;
      if (!save) return null;
      const ends = (save.endings || []).filter((id) => /^END-[A-Z]{1,4}\d{0,2}$/.test(id)).slice(0, 60).map((id) => ({ id, at: (save.endAt && save.endAt[id]) || null }));
      const firsts = {};
      Object.keys(save.first || {}).forEach((q) => { if (XMAS_NOVEL_RANK_QIDS.includes(q) && typeof save.first[q].f === 'boolean') firsts[q] = save.first[q].f; });
      const res = await xmasNovelRankSend(self, name, { kind: 'seed', ends, firsts });
      if (!res || (!res.ok && res.reason !== 'seeded')) return res;   // 届かない・busy・期間外 → 次の機会に
      last = res;
      st = { ...(await xmasNovelRankLoad()), seeded: 1 };
      await xmasNovelRankSave(st);
      if (st.pending.length) await wait();
    }
    for (let guard = 0; guard < XMAS_NOVEL_RANK_PENDING_MAX; guard += 1) {
      st = await xmasNovelRankLoad();
      const p = st.pending[0];
      if (!p) break;
      const res = await xmasNovelRankSend(self, name, p.k === 'end' ? { kind: 'end', end_id: p.id } : { kind: 'first', qid: p.id, ok: p.ok });
      if (!res) break;                              // 届かない → ためたまま
      if (!res.ok && res.reason === 'busy') { await wait(); continue; }
      last = res;
      const now = await xmasNovelRankLoad();          // 送っているあいだに足された分を消さない
      await xmasNovelRankSave({ ...now, pending: now.pending.slice(1) });
      if (!res.ok && (res.reason === 'closed' || res.reason === 'locked')) break;
      if ((await xmasNovelRankLoad()).pending.length) await wait();
    }
    return last;
  } catch (e) { return last; } finally { xmasNovelRankBusy = false; }
};

// 事件簿の画面から呼ぶ(待たなくてよい・落ちない)。off … デバッグ・検査で開いたとき
const xmasNovelRankNote = (item, { off = false, script = null } = {}) => {
  if (off || !item) return;
  (async () => {
    const st = await xmasNovelRankLoad();
    await xmasNovelRankSave({ ...st, pending: [...st.pending, item] });
    void xmasNovelRankFlush(script);
  })().catch(() => {});
};

// 一覧と自分の行
const xmasNovelRankList = async (tab) => {
  const t = XMAS_NOVEL_RANK_TABS.find((x) => x.id === tab) || XMAS_NOVEL_RANK_TABS[0];
  const cols = t.id === 'ends' ? 'user_name,ends,end_list,place' : t.id === 'perfect' ? 'user_name,perfect,ends,place' : 'user_name,plays,place';
  const rows = await xmasNovelRankFetch(`${t.view}?select=${cols}&event_id=eq.${XMAS_NOVEL_RANK_EVENT}&order=${t.order}&limit=${XMAS_NOVEL_RANK_SHOW}`);
  return Array.isArray(rows) ? rows : null;
};
const xmasNovelRankEndKinds = async () => {
  const rows = await xmasNovelRankFetch(`xmas_novel_end_ids?select=end_id,kind&event_id=eq.${XMAS_NOVEL_RANK_EVENT}`);
  if (!Array.isArray(rows)) return null;
  const m = {}; rows.forEach((r) => { if (r && typeof r.end_id === 'string') m[r.end_id] = typeof r.kind === 'string' ? r.kind : 'normal'; });
  return m;
};
const xmasNovelRankMine = async () => {
  const self = await xmasNovelRankSelf();
  if (!self) return null;
  const r = await xmasNovelRankRpc('xmas_novel_rank_mine', { p_owner: self.owner, p_key: self.key });
  return r && r.ok ? r : null;
};

// 見たエンドの内訳の点(種類の色だけ。どのエンドかは出さない)
const XMAS_NOVEL_RANK_KIND_ORDER = ['good', 'normal', 'another', 'bad', 'forced', 'accuse', 'unsolved', 'omake'];
const XmasNovelRankDots = ({ list, kinds, total }) => {
  const seen = (Array.isArray(list) ? list : []).map((id) => kinds[id] || 'normal')
    .sort((a, b) => XMAS_NOVEL_RANK_KIND_ORDER.indexOf(a) - XMAS_NOVEL_RANK_KIND_ORDER.indexOf(b));
  const rest = Math.max(0, total - seen.length);
  return (
    <div className="mh-nvr-dots" aria-hidden="true">
      {seen.map((k, i) => <i key={`s${i}`} style={{ background: (XMAS_NOVEL_ENDING_KINDS[k] || XMAS_NOVEL_ENDING_KINDS.normal).tone }} />)}
      {Array.from({ length: Math.min(rest, 60) }).map((_, i) => <i key={`r${i}`} />)}
    </div>
  );
};

const XMAS_NOVEL_RANK_CSS = `
.mh-nvr { width: 100%; max-width: 28rem; margin: auto; padding-bottom: 120px; }
.mh-nvr-tabs { display: flex; gap: 6px; margin-top: 12px; }
.mh-nvr-tab { flex: 1; padding: 8px 0; border-radius: 999px; border: 1px solid #b8913a; color: #e8c873; font-weight: 900; font-size: 13px; }
.mh-nvr-tab[data-on] { background: linear-gradient(#e8c873, #b8913a); color: #2a1a05; }
.mh-nvr-rule { margin: 10px 0 4px; padding: 7px 10px; border-radius: 8px; background: rgba(255,255,255,.05); font-size: 11px; line-height: 1.6; color: #aab6d8; }
.mh-nvr-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; margin-top: 6px; border-radius: 12px; background: rgba(20,33,74,.78); border: 1px solid #26335e; }
.mh-nvr-row[data-top="1"] { border-color: #b8913a; background: linear-gradient(90deg, rgba(232,200,115,.18), rgba(20,33,74,.78)); }
.mh-nvr-place { width: 38px; flex: none; text-align: center; font-weight: 900; font-size: 18px; color: #cfd8f5; }
.mh-nvr-row[data-top="1"] .mh-nvr-place { color: #f5d27a; } .mh-nvr-row[data-top="2"] .mh-nvr-place { color: #d9e2f0; } .mh-nvr-row[data-top="3"] .mh-nvr-place { color: #e0a46a; }
.mh-nvr-name { flex: 1; min-width: 0; font-weight: 800; font-size: 14px; color: #eef3ff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mh-nvr-val { flex: none; text-align: right; font-weight: 900; font-size: 17px; color: #e8c873; line-height: 1.1; }
.mh-nvr-val small { display: block; font-size: 10px; font-weight: 700; color: #8592b5; }
.mh-nvr-dots { display: flex; flex-wrap: wrap; gap: 2px; margin-top: 3px; }
.mh-nvr-dots i { width: 7px; height: 7px; border-radius: 2px; background: #2c375c; }
.mh-nvr-me { position: fixed; left: 12px; right: 12px; bottom: max(14px, env(safe-area-inset-bottom)); max-width: 28rem; margin: 0 auto; z-index: 3; border: 2px solid #e8c873 !important;
  background: linear-gradient(90deg, rgba(232,200,115,.28), rgba(15,25,60,.97)) !important; }
.mh-nvr-me .mh-nvr-place { color: #e8c873; }
.mh-nvr-tag { display: inline-block; margin-right: 5px; padding: 1px 7px; border-radius: 999px; background: #e8c873; color: #2a1a05; font-size: 10px; font-weight: 900; vertical-align: 2px; }
.mh-nvr-empty { margin-top: 18px; text-align: center; font-size: 12px; color: #9fb0d8; line-height: 1.7; }
`;
const useXmasNovelRankCss = () => {
  useEffect(() => {
    if (typeof document === 'undefined' || document.getElementById('mh-nvr-css')) return;
    const el = document.createElement('style'); el.id = 'mh-nvr-css'; el.textContent = XMAS_NOVEL_RANK_CSS; document.head.appendChild(el);
  }, []);
};

// ランキングの画面(事件簿の起動画面の中で出す)。off … デバッグ・検査で開いたときは送らない(見るだけ)
const XmasNovelRank = ({ script = null, off = false, onBack }) => {
  useXmasNovelRankCss();
  const [tab, setTab] = useState('ends');
  const [rows, setRows] = useState(undefined);       // undefined = 読みこみ中 / null = 取れなかった
  const [mine, setMine] = useState(null);
  const [kinds, setKinds] = useState({});
  const [total, setTotal] = useState(0);
  const [name, setName] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => {
      xmasNovelRankName().then((n) => { if (alive) setName(n); });
      const k = await xmasNovelRankEndKinds();
      if (alive && k) { setKinds(k); setTotal(Object.keys(k).length); }
      if (!off) await xmasNovelRankFlush(script);     // ためていた分(と前の記録)を送ってから自分の順位を読む
      const m = await xmasNovelRankMine();
      if (alive) setMine(m);
    })().catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    setRows(undefined);
    xmasNovelRankList(tab).then((r) => { if (alive) setRows(r); }).catch(() => { if (alive) setRows(null); });
    return () => { alive = false; };
  }, [tab]);
  const t = XMAS_NOVEL_RANK_TABS.find((x) => x.id === tab);
  const valOf = (r) => (tab === 'ends' ? r.ends : tab === 'perfect' ? r.perfect : r.plays);
  const unitOf = () => (tab === 'ends' ? `/${total || '？'}` : tab === 'perfect' ? '/7' : '回');
  const minePlace = mine ? (tab === 'ends' ? mine.place_ends : tab === 'perfect' ? mine.place_perfect : mine.place_plays) : null;
  const mineVal = mine ? (tab === 'ends' ? mine.ends : tab === 'perfect' ? mine.perfect : mine.plays) : null;
  return (
    <div className="mh-nvr" data-xmas-novel-rank={tab}>
      <div className="mh-nv-serif mh-nv-gold text-center text-[22px] font-black tracking-widest">事件簿ランキング</div>
      <div className="mt-1 text-center text-[11px] text-slate-400">全国 ・ 12/31 3:59 まで(そのあとも見られます)</div>
      <div className="mh-nvr-tabs" role="tablist">
        {XMAS_NOVEL_RANK_TABS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={tab === x.id} className="mh-nvr-tab mh-nv-serif" data-on={tab === x.id ? '' : undefined} data-xmas-novel-rank-tab={x.id} onClick={() => setTab(x.id)}>{x.label}</button>
        ))}
      </div>
      <div className="mh-nvr-rule">{t.rule.map((s, i) => <span key={i}>{s}{i < t.rule.length - 1 ? <br /> : null}</span>)}</div>
      {rows === undefined && <div className="mh-nvr-empty">読みこんでいます……</div>}
      {rows === null && <div className="mh-nvr-empty" data-xmas-novel-rank-error>ランキングを読みこめませんでした。<br />通信のよい所で、もう1度開いてください。</div>}
      {Array.isArray(rows) && !rows.length && <div className="mh-nvr-empty">まだ、だれも載っていません。</div>}
      {Array.isArray(rows) && rows.map((r, i) => (
        <div key={i} className="mh-nvr-row" data-top={r.place <= 3 ? String(r.place) : undefined} data-xmas-novel-rank-row>
          <div className="mh-nvr-place mh-nv-serif">{r.place}</div>
          <div className="min-w-0 flex-1">
            <div className="mh-nvr-name">{r.user_name || '名無しのブリーダー'}</div>
            {tab === 'ends' && <XmasNovelRankDots list={r.end_list} kinds={kinds} total={total} />}
          </div>
          <div className="mh-nvr-val mh-nv-serif">{valOf(r)}<small>{unitOf()}</small></div>
        </div>
      ))}
      <div className="mh-nvr-row mh-nvr-me" data-xmas-novel-rank-me>
        <div className="mh-nvr-place mh-nv-serif">{minePlace || '—'}</div>
        <div className="min-w-0 flex-1">
          <div className="mh-nvr-name"><span className="mh-nvr-tag">あなた</span>{name || 'ブリーダー'}</div>
          {!minePlace && <div className="text-[10px] text-slate-400">{off ? '検査で開いたので、送っていません' : 'エンディングに着くと載ります'}</div>}
        </div>
        <div className="mh-nvr-val mh-nv-serif">{mineVal ?? 0}<small>{unitOf()}</small></div>
      </div>
      <button type="button" className="mh-nv-btn wide mt-4" data-xmas-novel-rank-back onClick={onBack}>戻る</button>
    </div>
  );
};
