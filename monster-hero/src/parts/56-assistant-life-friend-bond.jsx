// 助手ライフ: フレンドの家の「行く意味・来てもらう意味」(2026-11-11 社長「機能が少なすぎる。もっといろいろ見せれるようにして意味も持たせたい」
//   「フレンドが遊びに来たときを分かりやすくと、意味をもっと持たせたい」・案 docs/progress/assistant-peer/FRIEND-HOUSE-MORE-PLAN.md の A+B+C と来たとき)
//   A 友情とスタンプ … フレンドごとの友情Lv。その家で3つ(話す・部屋を見る・置き手紙)すると今日のスタンプ1個(1軒1日1個・1日3軒)。
//                      相手(か相手の助手)が来てくれた日にも1個(1人1日1個)。節目は見た目の札(呼び名)だけ。家具・ビートPは付けない
//   B 今日の見どころ・すてき … 前に来たときの控えを端末に覚えて、増えた家具・マスモン・遊んだ物に NEW。「💗 すてき」は決まった場所の印だけを送る(自由文なし・1軒1日3つ)
//   C お気に入りの棚 … 持ち主が選んだ物(好きな助手・自慢のマスモン・好きな曲・集めた家具の数)を、くわしい控え(more.fv)に載せる
//   来たとき … HOME の印「🚪 来ています」・部屋の札・「📖 お客さん帳」(だれが・いつ・何をしたか・返しに行く)
// 公開の印 assistantLifeFriendBond の後ろ(偽なら何も出さず・送らず・保存しない)。保存は新しいキーだけ(今の mh_assistant_life_friend_v1 は形を変えない)。
// 表は assistant_life_friend_likes(足すだけ・docs/sql/assistant-life/FRIEND_LIKES_ADD.sql)。無いあいだ「すてき」は出さない。

const ALB_KEY = 'mh_assistant_life_friend_bond_v1';
const ALB_FAV_KEY = 'mh_assistant_life_friend_fav_v1';
const ALB_TABLE_LIKES = 'assistant_life_friend_likes';
const ALB_MAX = Object.freeze({ houses: 3, likes: 3, friends: 100 });
// 友情Lv に要るスタンプの数(Lv1〜Lv10)と呼び名(見た目の札)
const ALB_STEPS = Object.freeze([1, 3, 6, 10, 15, 21, 28, 36, 45, 55]);
const ALB_TITLES = Object.freeze(['はじめまして', '顔みしり', 'ごきんじょさん', 'お茶のみ友だち', 'なかよし', '大のなかよし', 'いつもの人', '親友', '大親友', '心の友', 'かけがえのない友']);
const ALB_TASKS = Object.freeze([['talk', '💬', '話す'], ['find', '👀', '部屋を見る'], ['note', '✉️', '置き手紙']]);
const ALB_SPOT_RE = /^(h|m:[a-z]{2,20}|f:[a-z]{2,20}:[cwf])$/;
const ALB_SLOT_NAME = Object.freeze({ c: '天井', w: '壁', f: '床' });

const albEnabled = () => alfEnabled() && RELEASE_FLAGS.assistantLifeFriendBond === true;
const albLv = (st) => ALB_STEPS.filter(n => st >= n).length;
const albTitle = (st) => ALB_TITLES[albLv(st)] || ALB_TITLES[0];
const albNext = (st) => { const lv = albLv(st); return lv >= ALB_STEPS.length ? null : { need: ALB_STEPS[lv] - st, from: lv ? ALB_STEPS[lv - 1] : 0, to: ALB_STEPS[lv] }; };

// ---------- 保存(無い・壊れているときは既定値) ----------
const albNormalizeSnap = (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const fu = {}; const ms = {};
  for (const id of ALF_IDS) {
    const a = v.fu && typeof v.fu === 'object' ? v.fu[id] : null; if (typeof a === 'string') fu[id] = a.slice(0, 200);
    const b = v.ms && typeof v.ms === 'object' ? v.ms[id] : null; if (Array.isArray(b)) ms[id] = b.filter(x => typeof x === 'string').map(x => x.slice(0, 60)).slice(0, 8);
  }
  return { fu, ms, ac: Number.isFinite(v.ac) ? v.ac : 0 };
};
const albDefaultOne = () => ({ st: 0, t: { talk: false, find: false, note: false }, done: false, liked: [], in: [], snap: null });
const normalizeAssistantLifeFriendBond = (v) => {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const src = o.f && typeof o.f === 'object' && !Array.isArray(o.f) ? o.f : {};
  const f = {};
  for (const id of Object.keys(src).slice(0, ALB_MAX.friends)) {
    const x = src[id];
    if (!alfSafeOther(id) || !x || typeof x !== 'object') continue;
    const t = x.t && typeof x.t === 'object' ? x.t : {};
    f[id] = {
      st: alfInt(x.st, 0, 9999), t: { talk: t.talk === true, find: t.find === true, note: t.note === true }, done: x.done === true,
      liked: (Array.isArray(x.liked) ? x.liked : []).filter(s => typeof s === 'string' && ALB_SPOT_RE.test(s)).slice(0, ALB_MAX.likes),
      in: [...new Set((Array.isArray(x.in) ? x.in : []).filter(d => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort().slice(-12),
      snap: albNormalizeSnap(x.snap),
    };
  }
  return { v: 1, day: typeof o.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.day) ? o.day : null, houses: alfInt(o.houses, 0, 9), f };
};
const normalizeAssistantLifeFriendFav = (v) => {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  return { v: 1, on: o.on !== false, a: alfValidId(o.a) ? o.a : null,
    m: o.m && typeof o.m === 'object' && alfValidId(o.m.aid) && typeof o.m.mo === 'string' && o.m.mo ? { aid: o.m.aid, mo: o.m.mo.slice(0, 40) } : null,
    s: typeof o.s === 'string' && o.s.trim() ? alfStr(o.s.trim(), 30) : null, fn: o.fn !== false };
};
// 朝4時の区切りで、今日の3つ・今日のスタンプ・今日のすてきを戻す(スタンプの数 st と控え snap は残す)
const albRoll = (b, day) => (b.day === day ? b : { ...b, day, houses: 0, f: Object.fromEntries(Object.entries(b.f).map(([k, x]) => [k, { ...x, t: { talk: false, find: false, note: false }, done: false, liked: [] }])) });
let _albLoading = null;
const albLoad = () => {
  if (ALF_STORE.state.bond) return Promise.resolve(ALF_STORE.state.bond);
  if (!_albLoading) _albLoading = (async () => {
    const [a, b] = await Promise.all([ALB_KEY, ALB_FAV_KEY].map(k => storeGet(k, null, false).catch(() => null)));
    ALF_STORE.set({ bond: albRoll(normalizeAssistantLifeFriendBond(a), alfDay()), fav: normalizeAssistantLifeFriendFav(b) });
    return ALF_STORE.state.bond;
  })();
  return _albLoading;
};
const albSave = (bond) => { ALF_STORE.set({ bond }); try { storeSet(ALB_KEY, bond, false); } catch {} };
const albSaveFav = (patch) => { const fav = normalizeAssistantLifeFriendFav({ ...(ALF_STORE.state.fav || {}), ...patch }); ALF_STORE.set({ fav }); try { storeSet(ALB_FAV_KEY, fav, false); } catch {} };
const albCur = () => { const b = ALF_STORE.state.bond; if (!b) return null; const r = albRoll(b, alfDay()); if (r !== b) albSave(r); return r; };
const albOne = (b, id) => (b && b.f[id]) || albDefaultOne();

// ---------- A 友情とスタンプ ----------
// その家で1つした(talk / find / note)。3つそろうと今日のスタンプ1個(1軒1日1個・1日 ALB_MAX.houses 軒)
const albMark = async (fid, task) => {
  if (!albEnabled() || !alfSafeOther(fid) || !ALB_TASKS.some(t => t[0] === task)) return null;
  await albLoad();
  const b = albCur(); if (!b) return null;
  const x = albOne(b, fid);
  if (x.t[task]) return null;
  const t = { ...x.t, [task]: true };
  let nx = { ...x, t }; let stamp = false;
  if (!x.done && t.talk && t.find && t.note && b.houses < ALB_MAX.houses) { nx = { ...nx, st: Math.min(9999, x.st + 1), done: true }; stamp = true; }
  albSave({ ...b, houses: b.houses + (stamp ? 1 : 0), f: { ...b.f, [fid]: nx } });
  if (stamp) ALF_STORE.set({ bondFlash: { id: fid, lvUp: albLv(nx.st) > albLv(x.st) ? albLv(nx.st) : 0, at: Date.now() } });
  return { stamp };
};
// 来てくれた日のスタンプ(1人1日1個)。行き来の表の行(相手が書いた go / player)と、迎えた来客(come)から数える
const albIncoming = (pairs) => {
  if (!albEnabled()) return [];
  const b0 = albCur(); if (!b0) return [];
  let b = b0; const gained = [];
  for (const [fid, day] of pairs) {
    if (!alfSafeOther(fid) || typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    const x = albOne(b, fid);
    if (x.in.includes(day)) continue;
    b = { ...b, f: { ...b.f, [fid]: { ...x, st: Math.min(9999, x.st + 1), in: [...new Set([...x.in, day])].sort().slice(-12) } } }; // 昇順で持つ(表の行は新しい順で届く。足した順のまま切ると、まだ読む7日の中の日が落ちて数え直しになる)
    gained.push(fid);
  }
  if (b !== b0) albSave(b);
  return gained;
};
const albCountIncoming = async (s = ALF_STORE.state) => {
  if (!albEnabled() || !s.selfId) return [];
  await albLoad();
  const names = new Set((s.roster || []).map(f => f.id)); const muted = new Set(s.settings.muted);
  return albIncoming((s.visits || []).filter(v => v.host === s.selfId && (v.kind === 'go' || v.kind === 'player') && names.has(v.visitor) && !muted.has(v.visitor)).map(v => [v.visitor, v.day]));
};

// ---------- B 今日の見どころ・すてき ----------
const albPutOf = (h, more, id) => (more && more.fu && more.fu[id] ? more.fu[id].p : (h.r[id] && h.r[id].fu) || {});
const albSnapOf = (h, more) => {
  const fu = {}; const ms = {};
  for (const id of h.ids) {
    const p = albPutOf(h, more, id) || {};
    fu[id] = ['c', 'w', 'f'].map(k => p[k] || '').join(',');
    ms[id] = (more && more.ms && Array.isArray(more.ms[id]) ? more.ms[id] : []).map(t => `${t.mo}|${t.n || ''}`.slice(0, 60));
  }
  return { fu, ms, ac: more && more.ac && more.ac[0] ? more.ac[0].at : 0 };
};
// 見どころ(多くて4つ)。snap が無い(はじめて)ときは、その家の目立つ物を出す
const albSpots = (h, more, snap) => {
  const out = []; const first = !snap;
  for (const id of h.ids) {
    const p = albPutOf(h, more, id) || {}; const prev = snap ? String(snap.fu[id] || ',,').split(',') : [];
    ['c', 'w', 'f'].forEach((k, i) => {
      const f = p[k] && typeof assistantLifeFurnOf === 'function' ? assistantLifeFurnOf(p[k]) : null;
      if (!f) return;
      const isNew = !!snap && prev[i] !== p[k];
      if (isNew || first) out.push({ spot: `f:${id}:${k}`, room: id, icon: f.emoji, text: `${assistantLifeName(id)}の部屋に「${f.name}」`, isNew, w: isNew ? 3 : 1 });
    });
    const team = more && more.ms && Array.isArray(more.ms[id]) ? more.ms[id] : []; const prevM = snap ? new Set(snap.ms[id] || []) : null;
    for (const t of team) {
      const isNew = !!prevM && !prevM.has(`${t.mo}|${t.n || ''}`.slice(0, 60));
      if (!(isNew || (first && t.l))) continue;
      const m = typeof assistantMasmonMon === 'function' ? assistantMasmonMon(t.mo) : null;
      out.push({ spot: `m:${id}`, room: id, icon: '🐾', text: `${assistantLifeName(id)}のマスモン「${t.n || (m && m.name) || 'マスモン'}」`, isNew, w: isNew ? 3 : 1 });
    }
  }
  const a = more && more.ac && more.ac[0];
  if (a && (!snap || a.at > snap.ac)) out.push({ spot: 'h', room: null, icon: ALF_ACT_ICON[a.k] || '✨', text: a.x, isNew: !!snap, w: 2 });
  const seen = new Set();
  return out.sort((x, y) => y.w - x.w).filter(x => (seen.has(x.spot) ? false : (seen.add(x.spot), true))).slice(0, 4);
};
const albSaveSnap = (fid, h, more) => {
  if (!albEnabled() || !alfSafeOther(fid) || !h) return;
  const b = albCur(); if (!b) return;
  albSave({ ...b, f: { ...b.f, [fid]: { ...albOne(b, fid), snap: albSnapOf(h, more) } } });
};
// 「すてき」を送る(場所の印だけ。表でも 1軒1日3つ・フレンドか を見る)。{ ok, reason }
let _albLikesMissing = false; let _albLikesAt = 0;
const albSendLike = async (hostId, spot) => {
  if (!albEnabled() || _albLikesMissing || !alfSafeOther(hostId) || !ALB_SPOT_RE.test(spot)) return { ok: false, reason: '「すてき」は、いま準備中です' };
  await albLoad();
  const b = albCur(); const x = albOne(b, hostId);
  if (x.liked.includes(spot)) return { ok: true, reason: '' };
  if (x.liked.length >= ALB_MAX.likes) return { ok: false, reason: `この家への「すてき」は1日${ALB_MAX.likes}つまでです(朝4時に戻ります)` };
  const self = await alfSelf();
  if (!self) return { ok: false, reason: '通信がうまくいきませんでした(時間をおいてもう一度)' };
  try {
    await alfRequest(ALB_TABLE_LIKES, { method: 'POST', prefer: 'return=minimal', soft: true, body: { visitor_id: self, host_id: hostId, day: alfDay(), spot } });
  } catch (e) {
    if (e && e.missing) { _albLikesMissing = true; ALF_STORE.set({ likesOff: true }); return { ok: false, reason: '「すてき」は、いま準備中です' }; }
    if (!((e && e.status === 409) || /23505|duplicate/.test(String((e && e.body) || '')))) return { ok: false, reason: alfRefusalText(e).replace(/置き手紙を残せませんでした/, '「すてき」を送れませんでした') };
  }
  const b2 = albCur(); const x2 = albOne(b2, hostId);
  albSave({ ...b2, f: { ...b2.f, [hostId]: { ...x2, liked: [...new Set([...x2.liked, spot])].slice(0, ALB_MAX.likes) } } });
  return { ok: true, reason: '' };
};
// 自分の家に届いた「すてき」(7日ぶん)
const albFetchLikes = async (force = false) => {
  if (!albEnabled() || _albLikesMissing || _alfUnavailable) return;
  const mode = await alfLoadMode(); if (mode === 'off') return;
  const self = await alfSelf(); if (!self) return;
  if (!force && Date.now() - _albLikesAt < alfLimits().readMs) return;
  try {
    const rows = await alfRequest(`${ALB_TABLE_LIKES}?select=id,visitor_id,host_id,day,spot,created_at&host_id=eq.${self}&day=gte.${alfDayShift(alfDay(), -7)}&order=created_at.desc&limit=60`, { soft: true });
    _albLikesAt = Date.now();
    ALF_STORE.set({ likesIn: (Array.isArray(rows) ? rows : []).map(r => (r && Number.isFinite(r.id) && alfSafeOther(r.visitor_id) && typeof r.spot === 'string' && ALB_SPOT_RE.test(r.spot)
      ? { id: r.id, visitor: r.visitor_id, day: String(r.day || '').slice(0, 10), spot: r.spot, at: Date.parse(r.created_at) || 0 } : null)).filter(Boolean) });
  } catch (e) { if (e && e.missing) { _albLikesMissing = true; ALF_STORE.set({ likesOff: true }); } }
};
// 届いた「すてき」の場所を、自分の家の言葉にする
const albSpotText = (spot) => {
  if (spot === 'h') return 'この家';
  const p = String(spot).split(':');
  if (!alfValidId(p[1])) return 'この家';
  if (p[0] === 'm') return `${assistantLifeName(p[1])}のマスモン`;
  let f = null;
  try { const room = typeof assistantLifeRoomOf === 'function' ? assistantLifeRoomOf(p[1]) : null; const key = room && room.put ? room.put[{ c: 'ceil', w: 'wall', f: 'floor' }[p[2]]] : null; f = key && typeof assistantLifeFurnOf === 'function' ? assistantLifeFurnOf(key) : null; } catch {}
  return `${assistantLifeName(p[1])}の部屋の${f ? `「${f.name}」` : `${ALB_SLOT_NAME[p[2]] || ''}の家具`}`;
};

// ---------- C お気に入りの棚 ----------
// 控えに載せる形 { a, m:{aid,mo,n,c}, s, fn }。見せない・何も選んでいないときは null
const albFavShare = (ids) => {
  const fav = ALF_STORE.state.fav;
  if (!albEnabled() || !fav || !fav.on) return null;
  const own = (ids || []).filter(alfValidId); const out = {};
  if (fav.a && own.includes(fav.a)) out.a = fav.a;
  if (fav.m && own.includes(fav.m.aid)) { const t = (alfMasmonShare([fav.m.aid])[fav.m.aid] || []).find(x => x.mo === fav.m.mo); if (t) out.m = { aid: fav.m.aid, mo: t.mo, n: t.n, c: t.c }; }
  if (fav.s) out.s = fav.s;
  if (fav.fn) {
    const keys = new Set();
    for (const id of own) { try { const room = typeof assistantLifeRoomOf === 'function' ? assistantLifeRoomOf(id) : null; if (!room) continue; for (const k of Object.values(room.put || {})) if (typeof k === 'string') keys.add(k); for (const k of (room.kept || [])) if (typeof k === 'string') keys.add(k); } catch {} }
    if (keys.size) out.fn = Math.min(999, keys.size);
  }
  return Object.keys(out).length ? out : null;
};
// 相手の棚を読むとき(知らない id・種類・長い値は捨てる。曲名は置き手紙と同じ見張りを通す)
const albNormalizeFavShare = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  if (alfValidId(raw.a)) out.a = raw.a;
  const m = raw.m;
  if (m && typeof m === 'object' && alfValidId(m.aid) && typeof m.mo === 'string' && typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[m.mo])
    out.m = { aid: m.aid, mo: m.mo, n: typeof m.n === 'string' ? alfNoteShow(m.n.slice(0, 16)) : '', c: (Array.isArray(m.c) ? m.c : []).slice(0, 5).map(x => (typeof x === 'string' && ALF_COLOR_RE.test(x) ? x : null)) };
  if (typeof raw.s === 'string') { const s = alfNoteShow(raw.s.replace(/[{}<>]/g, '').slice(0, 30)); if (s) out.s = s; }
  if (Number.isInteger(raw.fn) && raw.fn > 0 && raw.fn <= 999) out.fn = raw.fn;
  return Object.keys(out).length ? out : null;
};

// ---------- 画面の部品 ----------
function AlfBondChip({ id, always = false }) {
  const s = useAssistantLifeFriendState();
  React.useEffect(() => { if (albEnabled()) void albLoad(); }, []);
  if (!albEnabled() || !s.bond) return null;
  const st = albOne(s.bond, id).st;
  if (!st && !always) return null;
  return <span className="ml-1 inline-block whitespace-nowrap rounded-full border border-pink-300/60 bg-pink-950/60 px-1.5 text-[9.5px] font-black leading-[15px] text-pink-100" data-alb-chip={id}>🤝 Lv{albLv(st)} {albTitle(st)}</span>;
}
function AlfFavShelf({ fv }) {
  if (!fv) return null;
  const mon = fv.m && typeof assistantMasmonMon === 'function' ? assistantMasmonMon(fv.m.mo) : null;
  const cell = (k, icon, label, value) => <div key={k} className="min-w-0 flex-1 rounded-xl border border-amber-200/40 bg-slate-800/80 px-1 py-1 text-center" data-alb-fav={k}><p className="text-[16px] leading-none">{icon}</p><p className="mt-0.5 whitespace-nowrap text-[9.5px] font-bold text-slate-300">{label}</p><p className="truncate text-[11px] font-black text-amber-100">{value}</p></div>;
  return (
    <div className="mt-1 flex gap-1" data-alb-shelf>
      {fv.a ? cell('a', '💛', '好きな助手', assistantLifeName(fv.a)) : null}
      {fv.m ? cell('m', '🐾', '自慢のマスモン', fv.m.n || (mon && mon.name) || 'マスモン') : null}
      {fv.s ? cell('s', '🎵', '好きな曲', fv.s) : null}
      {fv.fn ? cell('fn', '🪑', '集めた家具', `${fv.fn}種`) : null}
    </div>);
}
// 訪ねた家の「友情」の帯(押すとくわしいシート)。この部品が閉じるときに、今日見た控えを覚える(次に来たときの NEW の元)
function AlfBondBar({ friend, more, onOpen, compact = false }) {
  const s = useAssistantLifeFriendState();
  const keep = React.useRef({ h: friend.house, more });
  keep.current = { h: friend.house, more };
  React.useEffect(() => { if (!albEnabled()) return undefined; void albLoad(); return () => { try { albSaveSnap(friend.id, keep.current.h, keep.current.more); } catch {} }; }, [friend.id]);
  if (!albEnabled() || !s.bond) return null;
  const x = albOne(s.bond, friend.id);
  const left = ALB_TASKS.filter(t => !x.t[t[0]]).length;
  const fresh = albSpots(friend.house, more, x.snap).filter(p => p.isNew).length;
  const full = !x.done && s.bond.houses >= ALB_MAX.houses;
  return (
    <button type="button" className={`flex w-full items-center gap-1.5 rounded-xl border border-pink-300/50 bg-slate-950/85 px-2 text-left active:scale-[.99] ${compact ? 'mb-0.5 py-0' : 'mb-1.5 py-1'}`} data-alb-bar onClick={onOpen}>
      <span className="min-w-0 flex-1">
        <b className={`block truncate font-black text-pink-100 ${compact ? 'text-[10.5px] leading-[16px]' : 'text-[11.5px]'}`} data-alb-bar-title>{compact ? `🤝 Lv${albLv(x.st)} ${albTitle(x.st)}${x.done ? ' ・ 今日 ✔' : full ? '' : ` ・ あと${left}つ`}${fresh ? ` ・ ✨${fresh}` : ''}` : `🤝 友情Lv${albLv(x.st)}「${albTitle(x.st)}」`}</b>
        <small className={`truncate text-[10px] font-bold text-slate-200 ${compact ? 'hidden' : 'block'}`} data-alb-bar-sub>{x.done ? '今日のスタンプ ✔ もらった' : full ? `今日のスタンプは${ALB_MAX.houses}軒ぶん もらった` : `あと${left}つで 今日のスタンプ`}{fresh ? ` ・ ✨ 見どころ ${fresh}` : ''}</small>
      </span>
      <span className="flex shrink-0 gap-0.5" data-alb-bar-tasks>{ALB_TASKS.map(([k, icon]) => <i key={k} className={`flex ${compact ? 'h-4 w-4 text-[10px]' : 'h-6 w-6 text-[12px]'} items-center justify-center rounded-full not-italic ${x.t[k] ? 'border border-pink-300 bg-pink-500/40' : 'border border-dashed border-slate-400/70 opacity-60'}`} data-alb-task={k} data-alb-task-done={x.t[k] ? '1' : '0'}>{icon}</i>)}</span>
      <span className="shrink-0 text-[12px] font-black text-pink-200">›</span>
    </button>);
}
function AlfBondSheet({ friend, more, land, onClose, onRoom }) {
  const s = useAssistantLifeFriendState();
  const [msg, setMsg] = React.useState('');
  if (!albEnabled() || !s.bond) return null;
  const x = albOne(s.bond, friend.id);
  const nx = albNext(x.st);
  const spots = albSpots(friend.house, more, x.snap);
  const likeOk = !s.likesOff && !_albLikesMissing;
  const like = async (spot) => { const r = await albSendLike(friend.id, spot); setMsg(r.ok ? `💗 ${friend.name}さんに「すてき」が届きます` : `⚠️ ${r.reason}`); };
  const fv = more && more.fv ? more.fv : null;
  return (
    <div className="absolute inset-0" style={{ zIndex: 31 }} data-alb-sheet>
      <button type="button" aria-label="閉じる" className="absolute inset-0 bg-black/55" onClick={onClose}/>
      <div className="mhl-sheet" style={land ? { left: 'auto', width: '46%', top: 0, maxHeight: '100%', paddingTop: 14, borderRadius: '22px 0 0 22px' } : { maxHeight: 'calc(100% - 96px)' }}>
        <p className="text-[16px] font-black text-pink-100" data-alb-sheet-title>🤝 {friend.name}さんとの友情 Lv{albLv(x.st)}</p>
        <p className="text-[11px] font-bold text-slate-200">「{albTitle(x.st)}」 ・ スタンプ {x.st}個{nx ? ` ・ あと${nx.need}個で「${ALB_TITLES[albLv(x.st) + 1]}」` : ''}</p>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-amber-300" style={{ width: `${nx ? Math.round(((x.st - nx.from) / Math.max(1, nx.to - nx.from)) * 100) : 100}%` }}/></div>
        <p className="mt-2.5 text-[12px] font-black text-amber-200">今日のスタンプ{x.done ? ' ✔' : ''}</p>
        <div className="mt-1 grid grid-cols-3 gap-1" data-alb-tasks>{ALB_TASKS.map(([k, icon, label]) => <div key={k} className={`whitespace-nowrap rounded-xl px-0.5 py-1.5 text-center text-[10.5px] font-black ${x.t[k] ? 'border border-pink-300 bg-pink-500/25 text-pink-50' : 'border border-dashed border-slate-500 text-slate-300'}`}>{icon} {label}{x.t[k] ? ' ✔' : ''}</div>)}</div>
        <p className="mt-1 text-[10px] leading-snug text-slate-300">この家で3つすると、今日のスタンプが1個たまります(1軒につき1日1個・1日{ALB_MAX.houses}軒まで)。{friend.name}さんにも、あなたが来た日に1個たまります。</p>
        <p className="mt-2.5 text-[12px] font-black text-amber-200">✨ {x.snap ? '今日の見どころ(前に来たときから)' : 'この家の見どころ'}</p>
        <div data-alb-spots>
          {spots.length ? spots.map(p => (
            <div key={p.spot} className="mt-1 flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-2 py-1" data-alb-spot={p.spot}>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left" disabled={!p.room} onClick={() => p.room && onRoom(p.room)}>
                <span className="text-[15px]">{cardIconNode(p.icon, 15)}</span><span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-slate-100">{p.text}</span>
                {p.isNew ? <span className="shrink-0 rounded-full bg-amber-300 px-1.5 text-[9.5px] font-black leading-[15px] text-slate-950">NEW</span> : null}
              </button>
              {likeOk ? <button type="button" className="shrink-0 rounded-lg border border-pink-300/70 px-1.5 py-0.5 text-[11px] font-black text-pink-100 disabled:opacity-40" data-alb-like={p.spot} disabled={x.liked.includes(p.spot) || x.liked.length >= ALB_MAX.likes} onClick={() => like(p.spot)}>{x.liked.includes(p.spot) ? '💗 送った' : '💗 すてき'}</button> : null}
            </div>)) : <p className="mt-1 text-[11px] text-slate-300" data-alb-spots-none>前に来たときから、変わった所はまだありません。部屋を見て回れます。</p>}
        </div>
        {likeOk ? <p className="mt-1 text-[10px] leading-snug text-slate-300">「💗 すてき」を押すと、どこを気に入ったかが{friend.name}さんに届きます(1軒につき1日{ALB_MAX.likes}つ・今日 {x.liked.length}/{ALB_MAX.likes})。</p> : null}
        {msg ? <p className="mt-1 text-[11px] font-bold text-pink-100" data-alb-msg>{msg}</p> : null}
        {fv ? <><p className="mt-2.5 text-[12px] font-black text-amber-200">🏆 {friend.name}さんのお気に入りの棚</p><AlfFavShelf fv={fv}/></> : null}
        <button type="button" data-mhl-sheet-close className="mhl-btn mt-3 w-full bg-slate-700" onClick={onClose}>閉じる</button>
      </div>
    </div>);
}
// 「🏘 フレンド」のページ: 📖 お客さん帳(今週、だれが・いつ・何をしたか。返しに行く)
function AlfGuestBook({ s, card, sec, onVisit }) {
  React.useEffect(() => { if (albEnabled()) void (async () => { await albLoad(); await albCountIncoming(); await albFetchLikes(); })(); }, [s.visits]);
  if (!albEnabled() || !s.bond) return null;
  const names = Object.fromEntries((s.roster || []).map(f => [f.id, f.name]));
  const notes = assistantLifeFriendNotes(s).filter(n => n.dir === 'in');
  const likes = (s.likesIn || []).filter(l => names[l.visitor] && !s.settings.muted.includes(l.visitor));
  const ids = [...new Set([...notes.map(n => n.who), ...likes.map(l => l.visitor)])];
  const houses = alfOpenHouses('look');
  const today = alfDay();
  return (<>
    <p className={sec}>📖 お客さん帳(この7日)</p>
    <div className={card} data-alb-guests>
      {ids.length ? ids.slice(0, 8).map(id => {
        const mine = notes.filter(n => n.who === id); const lk = likes.filter(l => l.visitor === id);
        const last = Math.max(0, ...mine.map(n => n.at), ...lk.map(l => l.at));
        const days = new Set([...mine.map(n => n.day), ...lk.map(l => l.day)]).size;
        const did = [];
        const talked = [...new Set(mine.filter(n => n.kind === 'player').flatMap(n => n.ids))];
        if (mine.some(n => n.kind === 'player')) did.push(talked.length ? `${talked.map(assistantLifeName).join('・')}と話した` : '家を見て回った');
        const came = [...new Set(mine.filter(n => n.kind === 'go').flatMap(n => n.ids))];
        if (came.length) did.push(`${came.map(assistantLifeName).join('・')}が遊びに来た`);
        if (mine.some(n => n.kind === 'player')) did.push('置き手紙');
        for (const l of lk.slice(0, 2)) did.push(`${albSpotText(l.spot)}に💗すてき`);
        const x = albOne(s.bond, id); const house = houses.find(h => h.id === id);
        return (
          <div key={id} className="border-b border-slate-700/60 py-1 last:border-0" data-alb-guest={id}>
            <div className="flex items-center gap-1.5">
              <p className="min-w-0 flex-1 truncate text-[11.5px] font-black text-slate-100">{names[id]}さん<AlfBondChip id={id} always/></p>
              <span className="shrink-0 whitespace-nowrap text-[10px] text-slate-400">{alfAgoText(last)}・{days}日</span>
              {house ? <button type="button" className="shrink-0 rounded-xl bg-orange-400 px-2 py-1 text-[10.5px] font-black text-slate-950" data-alb-return={id} onClick={() => onVisit(house)}>🚶 返しに行く</button> : null}
            </div>
            <p className="text-[10.5px] leading-snug text-slate-300">{did.map((t, i) => <span key={i} className="whitespace-nowrap">{i ? '・' : ''}{t}</span>)}{x.in.includes(today) ? <span className="whitespace-nowrap font-black text-pink-200">・🤝 スタンプ +1</span> : null}</p>
          </div>); })
        : <p className="text-[11px] text-slate-400" data-alb-guests-none>この7日、来てくれたフレンドはまだいません。あなたが訪ねて置き手紙を残すと、相手のお客さん帳に載ります。</p>}
      <p className="mt-1 text-[10px] leading-snug text-slate-400">フレンドか、フレンドの助手が来てくれた日は、その人との友情スタンプが1個たまります(1人につき1日1個)。</p>
    </div>
  </>);
}
// 「🏘 フレンド」のページ: 🏆 お気に入りの棚(フレンドに見せる物を選ぶ)
function AlfFavEditor({ s, card, sec }) {
  const [songs, setSongs] = React.useState([]);
  React.useEffect(() => { let alive = true; if (albEnabled()) void (async () => { await albLoad(); try { const a = normalizeAlfActivity(await storeGet(ALF_ACT_KEY, [])); if (alive) setSongs(a.map(x => x.x)); } catch {} })(); return () => { alive = false; }; }, []);
  if (!albEnabled() || !s.fav) return null;
  const fav = s.fav;
  const own = ALF_IDS.filter(id => { try { return typeof assistantLifeRoomOf !== 'function' || !!assistantLifeRoomOf(id); } catch { return false; } });
  const team = alfMasmonShare(own);
  const mons = own.flatMap(id => (team[id] || []).map(t => { const m = typeof assistantMasmonMon === 'function' ? assistantMasmonMon(t.mo) : null; return { v: `${id}|${t.mo}`, label: `${t.n || (m && m.name) || 'マスモン'}(${assistantLifeName(id)})` }; }));
  const songList = [...new Set([...(fav.s ? [fav.s] : []), ...songs])];
  const sel = 'mt-0.5 w-full rounded-lg border border-slate-500 bg-slate-800 px-1.5 py-1 text-[11.5px] text-slate-100';
  const row = (k, label, value, opts, onChange) => (
    <label className="mt-1 block text-[10.5px] font-bold text-slate-300" data-alb-fav-row={k}>{label}
      <select className={sel} value={value} onChange={e => onChange(e.target.value)}><option value="">えらばない</option>{opts.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}</select>
    </label>);
  return (<>
    <p className={sec}>🏆 お気に入りの棚</p>
    <div className={card} data-alb-fav-editor>
      <label className="flex items-center justify-between gap-2 text-[11.5px] text-slate-100"><span>訪ねてきたフレンドに見せる</span><input type="checkbox" checked={fav.on} data-alb-fav-on onChange={e => albSaveFav({ on: e.target.checked })}/></label>
      {fav.on ? <>
        {row('a', '💛 好きな助手', fav.a || '', own.map(id => ({ v: id, label: assistantLifeName(id) })), v => albSaveFav({ a: v || null }))}
        {row('m', '🐾 自慢のマスモン', fav.m ? `${fav.m.aid}|${fav.m.mo}` : '', mons, v => { const [aid, mo] = String(v).split('|'); albSaveFav({ m: v ? { aid, mo } : null }); })}
        {row('s', '🎵 好きな曲(最近モンヒロビートで遊んだ曲から)', fav.s || '', songList.map(x => ({ v: x, label: x })), v => albSaveFav({ s: v || null }))}
        <label className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-slate-100"><span>🪑 集めた家具の数を見せる</span><input type="checkbox" checked={fav.fn} data-alb-fav-fn onChange={e => albSaveFav({ fn: e.target.checked })}/></label>
        <p className="mt-1 text-[10px] leading-snug text-slate-400">選んだ物は、フレンドがあなたの家を訪ねたときに「友情」の中に出ます。次に助手ライフを開いたときの控えから変わります。文字を自由に書く所はありません。</p>
      </> : null}
    </div>
  </>);
}
