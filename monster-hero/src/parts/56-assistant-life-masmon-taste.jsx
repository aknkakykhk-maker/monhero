// 助手の好き嫌いが遊んでいくうちに変わる仕組み(2026-11-15 キズナ8・r1115-007・社長「この形で作る」)。
//   案 docs/progress/assistant-peer/GROW-PLAN.md 8・docs/progress/assistant-peer/taste-change/PROPOSAL.md
//   はじめの好み(masmon-plan の likeMon/dislikeMon)は書き換えない。今の好みは「はじめとの差分」だけを新しいキー mh_assistant_life_taste_v1 に持つ
//   点は -100〜+100。はじめの好き +60・苦手 -60・ふつう 0(好きなモンスターの血統の仲間は ±18)。段: +40 以上 好き / -40 以下 苦手 / その間 ふつう
//   1日の上限は1つのモンスターにつき +6・-3。推し(性格の芯)の血統は動き方が5分の1で、好きの段より下がらない
//   数字(点)は画面に出さない。段が変わった日だけ、助手のひとこと・家の掲示板1件・部屋の「好き・苦手」の変化に出す
//   スコア・ランキング・強さ・ごほうびには効かせない(反応の台詞とマスモンの選び方だけ)
//   公開の印 RELEASE_FLAGS.assistantLifeTaste が真のときだけ動く。今の好みを消せば、はじめの好みに戻る
//   他の部の入口(呼ぶ口): assistantLifeTasteBump(助手id, モンスターid, 種類) 種類 = win / praise / gift / color / friend / raise / lose
const ASSISTANT_TASTE_KEY = 'mh_assistant_life_taste_v1';
const AMT_LIKE_AT = 40; // この点以上で「好き」、マイナスの同じ点以下で「苦手」
const AMT_UP_DAY = 6, AMT_DOWN_DAY = 3; // 1日・1モンスターの上限
const AMT_CORE_RATE = 0.2; // 推し(芯)の血統は動き方が5分の1
const AMT_SPREAD = 0.3; // 点の3割は血統の仲間へ広がる
const AMT_KINDS = Object.freeze({
  win: { p: 3, once: false }, // 一緒に使って勝つ(バトル・モンヒロビート)
  praise: { p: 4, once: true }, // 会話で良さを伝える(1日1回)
  gift: { p: 5, once: false }, // そのモンスターの道具・家具を贈る
  color: { p: 3, once: false }, // 好きな色の物を贈る・その色に染めたマスモンを見せる
  friend: { p: 1, once: true }, // 友情Lv5以上の助手がそのモンスターを好き(1日1回)
  raise: { p: 1, once: true }, // 自分のマスモンとして育てている(1日1回)
  lose: { p: -2, once: false }, // いやな思い(同じ日に3回負ける・苦手なのに何度も連れていく)
});
const amtOn = () => { try { return typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS && RELEASE_FLAGS.assistantLifeTaste === true; } catch (_) { return false; } };
const amtNum = (v, lim) => (Number.isFinite(Number(v)) ? Math.max(-lim, Math.min(lim, Math.round(Number(v) * 100) / 100)) : 0);
const amtMonKey = (k) => typeof k === 'string' && /^\w{2,40}$/.test(k);
const amtEmptyRec = () => ({ mon: {}, lin: {}, day: { d: '', m: {} }, log: [], raised: '' });
// 保存の形: { v:1, by:{ [助手id]: { mon:{[モンスター]:差}, lin:{[血統]:差}, day:{d,m:{[モンスター]:{up,down,k:[種類]}}}, log:[{day,target,from,to}], raised:'YYYY-MM-DD' } } }
const normalizeAssistantLifeTaste = (raw) => {
  const out = { v: 1, by: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !raw.by || typeof raw.by !== 'object' || Array.isArray(raw.by)) return out;
  for (const [aid, r] of Object.entries(raw.by)) {
    if (!r || typeof r !== 'object' || Array.isArray(r) || !/^[a-z0-9_]{2,24}$/.test(aid)) continue;
    const rec = amtEmptyRec();
    for (const [k, v] of Object.entries(r.mon && typeof r.mon === 'object' && !Array.isArray(r.mon) ? r.mon : {}).slice(0, 80)) if (amtMonKey(k)) { const n = amtNum(v, 100); if (n) rec.mon[k] = n; }
    for (const [k, v] of Object.entries(r.lin && typeof r.lin === 'object' && !Array.isArray(r.lin) ? r.lin : {}).slice(0, 60)) if (amtMonKey(k)) { const n = amtNum(v, 100); if (n) rec.lin[k] = n; }
    const d = r.day && typeof r.day === 'object' ? r.day : null;
    if (d && typeof d.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.d) && d.m && typeof d.m === 'object' && !Array.isArray(d.m)) {
      rec.day.d = d.d;
      for (const [k, v] of Object.entries(d.m).slice(0, 80)) if (amtMonKey(k) && v && typeof v === 'object') rec.day.m[k] = { up: Math.max(0, amtNum(v.up, 99)), down: Math.max(0, amtNum(v.down, 99)), k: (Array.isArray(v.k) ? v.k : []).filter(x => typeof x === 'string' && AMT_KINDS[x]).slice(0, 8) };
    }
    rec.log = (Array.isArray(r.log) ? r.log : []).filter(x => x && typeof x === 'object' && typeof x.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.day) && amtMonKey(x.target) && ['like', 'dislike', 'normal'].includes(x.from) && ['like', 'dislike', 'normal'].includes(x.to)).map(x => ({ day: x.day, target: x.target, from: x.from, to: x.to })).slice(-30);
    rec.raised = typeof r.raised === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.raised) ? r.raised : '';
    out.by[aid] = rec;
  }
  return out;
};
const AMT_STORE = typeof amgpMakeStore === 'function' ? amgpMakeStore(ASSISTANT_TASTE_KEY, normalizeAssistantLifeTaste) : null;
const amtRawPlan = (aid) => { try { return ASSISTANT_MASMON_PLAN.find(a => a && a.id === aid) || null; } catch (_) { return null; } };
const amtLin = (m) => { try { return typeof assistantMasmonLineage === 'function' ? assistantMasmonLineage(m) : null; } catch (_) { return null; } };
const amtTier = (v) => (v >= AMT_LIKE_AT ? 'like' : v <= -AMT_LIKE_AT ? 'dislike' : 'normal');
// はじめの点(表の likeMon/dislikeMon から)
const amtBase = (raw, m) => {
  if (!raw) return 0;
  const lin = amtLin(m);
  const some = (xs, f) => (Array.isArray(xs) ? xs : []).some(x => x && f(x));
  if (some(raw.dislikeMon, x => x.monster === m)) return -60;
  if (some(raw.likeMon, x => x.monster === m)) return 60;
  if (lin && some(raw.dislikeMon, x => x.lineage === lin)) return -60;
  if (lin && some(raw.likeMon, x => x.lineage === lin)) return 60;
  let s = 0;
  if (lin && some(raw.likeMon, x => x.monster && x.monster !== m && amtLin(x.monster) === lin)) s += 18;
  if (lin && some(raw.dislikeMon, x => x.monster && x.monster !== m && amtLin(x.monster) === lin)) s -= 18;
  return s;
};
const amtCoreLin = (aid) => { try { const mat = typeof assistantLifeCardMaterial === 'function' ? assistantLifeCardMaterial(aid) : null; return mat && mat.core ? mat.core : null; } catch (_) { return null; } };
const amtIsCore = (aid, m) => { const c = amtCoreLin(aid); return !!c && amtLin(m) === c; };
// いまの点(はじめ + 差分)。推しの血統で、はじめが好きなら、好きの段より下がらない
const amtEff = (aid, raw, rec, m) => {
  const b = amtBase(raw, m), lin = amtLin(m);
  let v = b + (rec && rec.mon[m] || 0) + (lin && rec && rec.lin[lin] || 0);
  v = Math.max(-100, Math.min(100, v));
  if (b >= AMT_LIKE_AT && amtIsCore(aid, m)) v = Math.max(AMT_LIKE_AT, v);
  return v;
};
const amtAllMons = () => (typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS ? Object.keys(ALL_PLAYER_MONSTERS) : []);
const amtMonName = (m) => { try { const x = typeof assistantMasmonMon === 'function' ? assistantMasmonMon(m) : null; return x ? x.name : m; } catch (_) { return m; } };
// はじめの好みに、遊んで変わった分を重ねた「いまの好み」(likeMon/dislikeMon だけを差し替える。差分が無ければそのまま返す)
const amtCache = { st: null, by: {} };
function assistantLifeTasteOverlay(base) {
  try {
    if (!base || !amtOn() || !AMT_STORE || !AMT_STORE.loaded) return base;
    const st = AMT_STORE.state; const rec = st.by[base.id];
    if (!rec || (!Object.keys(rec.mon).length && !Object.keys(rec.lin).length)) return base;
    if (amtCache.st !== st) { amtCache.st = st; amtCache.by = {}; }
    if (amtCache.by[base.id]) return amtCache.by[base.id];
    let like = [...(base.likeMon || [])], dis = [...(base.dislikeMon || [])];
    for (const m of amtAllMons()) {
      const bt = amtTier(amtBase(base, m)), t = amtTier(amtEff(base.id, base, rec, m));
      if (bt === t) continue;
      if (bt === 'like') like = like.filter(x => !(x && x.monster === m));
      if (bt === 'dislike') dis = dis.filter(x => !(x && x.monster === m));
      if (t === 'like') like.push({ monster: m, why: '遊んでいるうちに好きになった', grown: true });
      if (t === 'dislike') dis.push({ monster: m, why: '遊んでいるうちに苦手になった', grown: true });
    }
    return (amtCache.by[base.id] = { ...base, likeMon: like, dislikeMon: dis });
  } catch (_) { return base; }
}
// 段が変わったときの助手のひとこと(言葉の切れ目ごとの配列。画面で切れ目だけで折る)
const AMT_SAY = Object.freeze({
  like: (c) => ['最近', c, 'のこと…', 'ちょっと好きに', 'なってきた', 'かも'],
  normal_from_dislike: (c) => [c, 'のこと、', '前ほど', '苦手じゃ', 'なくなってきた', 'かも'],
  normal_from_like: (c) => [c, 'は、', '前ほど', '夢中じゃ', 'なくなった', 'かも'],
  dislike: (c) => [c, 'は、', 'ちょっと', '苦手に', 'なってきた', 'かも'],
});
const assistantLifeTasteSay = (x) => {
  const c = amtMonName(x.target);
  if (x.to === 'like') return AMT_SAY.like(c);
  if (x.to === 'dislike') return AMT_SAY.dislike(c);
  return x.from === 'dislike' ? AMT_SAY.normal_from_dislike(c) : AMT_SAY.normal_from_like(c);
};
// 変わった記録(新しい順)。days 日以内
const assistantLifeTasteRecent = (aid, days = 14) => {
  try {
    if (!amtOn() || !AMT_STORE || !AMT_STORE.loaded) return [];
    const rec = AMT_STORE.state.by[aid]; if (!rec) return [];
    const now = typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey() : '';
    const t0 = Date.parse(`${now}T00:00:00Z`);
    return rec.log.filter(x => !Number.isFinite(t0) || (t0 - Date.parse(`${x.day}T00:00:00Z`)) / 86400000 <= days).slice().reverse().map(x => ({ ...x, name: amtMonName(x.target) }));
  } catch (_) { return []; }
};
// 好き嫌いを動かす入口。他の部は種類だけ決めて呼ぶ。変わった段があれば [{ target, from, to }] を返す(無ければ空)
const assistantLifeTasteBump = (aid, monsterId, kind, now = Date.now()) => {
  try {
    if (!amtOn() || !AMT_STORE || !AMT_STORE.loaded) return [];
    const k = AMT_KINDS[kind], raw = amtRawPlan(aid);
    if (!k || !raw || !amtMonKey(monsterId) || !(typeof assistantMasmonMon === 'function' && assistantMasmonMon(monsterId))) return [];
    const st = AMT_STORE.state, old = st.by[aid] || amtEmptyRec();
    const rec = { mon: { ...old.mon }, lin: { ...old.lin }, day: { d: old.day.d, m: { ...old.day.m } }, log: [...old.log], raised: old.raised };
    const day = typeof assistantLifeDayKey === 'function' ? assistantLifeDayKey(now) : '';
    if (!day) return [];
    if (rec.day.d !== day) rec.day = { d: day, m: {} };
    const dm = { up: 0, down: 0, k: [], ...(rec.day.m[monsterId] || {}) }; dm.k = [...dm.k];
    if (k.once && dm.k.includes(kind)) return [];
    let p = k.p * (amtIsCore(aid, monsterId) ? AMT_CORE_RATE : 1);
    if (p > 0) { p = Math.min(p, Math.max(0, AMT_UP_DAY - dm.up)); dm.up += p; } else { p = -Math.min(-p, Math.max(0, AMT_DOWN_DAY - dm.down)); dm.down += -p; }
    if (!p) return [];
    if (k.once) dm.k.push(kind);
    rec.day.m[monsterId] = dm;
    const lin = amtLin(monsterId);
    rec.mon[monsterId] = amtNum((rec.mon[monsterId] || 0) + p * (1 - AMT_SPREAD), 100);
    if (lin) rec.lin[lin] = amtNum((rec.lin[lin] || 0) + p * AMT_SPREAD, 100);
    const changes = [];
    for (const m of amtAllMons()) {
      const a = amtTier(amtEff(aid, raw, old, m)), b = amtTier(amtEff(aid, raw, rec, m));
      if (a !== b) changes.push({ target: m, from: a, to: b });
    }
    for (const c of changes.slice(0, 3)) rec.log.push({ day, target: c.target, from: c.from, to: c.to });
    rec.log = rec.log.slice(-30);
    AMT_STORE.save({ ...st, by: { ...st.by, [aid]: rec } });
    for (const c of changes.slice(0, 3)) {
      try {
        if (typeof assistantLifeDiaryAdd === 'function') {
          const who = typeof assistantLifeName === 'function' ? assistantLifeName(aid) : aid, n = amtMonName(c.target);
          const txt = c.to === 'like' ? `${who}が${n}を好きになってきたみたい` : c.to === 'dislike' ? `${who}は${n}が苦手になってきたみたい` : c.from === 'dislike' ? `${who}は${n}が前ほど苦手じゃなくなってきたみたい` : `${who}は${n}に前ほど夢中じゃなくなったみたい`;
          void assistantLifeDiaryAdd(txt, [aid], { kind: 'note' });
        }
      } catch (_) {}
    }
    return changes;
  } catch (_) { return []; }
};
// ココロ(AI のおしゃべり)の手がかり: 良い言葉が出たら「ほめた」(1日1回)。悪い言葉は数えない(控えめ)
const assistantLifeTasteOnTalk = (x) => {
  try { if (x && x.positive === true && typeof x.assistantId === 'string' && typeof x.monsterId === 'string') assistantLifeTasteBump(x.assistantId, x.monsterId, 'praise'); } catch (_) {}
};
if (typeof ASSISTANT_CHAT_TASTE_HOOKS === 'object' && ASSISTANT_CHAT_TASTE_HOOKS) { ASSISTANT_CHAT_TASTE_HOOKS.onTalk = assistantLifeTasteOnTalk; }
// 自分のマスモンとして育てているモンスター: 1日1回、+1(読み込みのあとに1回走る)
const assistantLifeTasteDaily = () => {
  try {
    if (!amtOn() || !AMT_STORE || !AMT_STORE.loaded || typeof ASSISTANT_MASMON_STORE === 'undefined' || !ASSISTANT_MASMON_STORE.loaded || typeof assistantMasmonRowsOf !== 'function') return;
    for (const a of ASSISTANT_MASMON_PLAN) {
      if (!a || !a.id) continue;
      for (const r of assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, a.id) || []) if (r && r.monster) assistantLifeTasteBump(a.id, r.monster, 'raise');
    }
  } catch (_) {}
};
try { setTimeout(() => { try { if (amtOn() && AMT_STORE) { const w = [AMT_STORE.load()]; if (typeof ASSISTANT_MASMON_STORE !== 'undefined' && ASSISTANT_MASMON_STORE.load) w.push(ASSISTANT_MASMON_STORE.load()); void Promise.all(w).then(assistantLifeTasteDaily).catch(() => {}); } } catch (_) {} }, 0); } catch (_) {}
