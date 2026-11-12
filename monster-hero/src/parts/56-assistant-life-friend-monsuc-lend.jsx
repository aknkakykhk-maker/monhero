// ===== モンヒロサクセス: フレンドからのレンタルの端末の口(段取りの回5・2026-11-12 オトズレ) =====
// 画面は持たない(編成の画面・保存枠の画面は回2・開発部)。ここは「サーバの関数 masmon-pvp の lend_* を呼ぶ」「表 monsuc_lend を読む」だけ。
//   サーバ: supabase/functions/masmon-pvp/lend.js・表 supabase/migrations/202611120002_monsuc_lend.sql・設計 docs/progress/player-raise/PLAN.md §2
//   ★持ち主の鍵は助手のマスモンのフレンド対戦と同じ(mh_masmon_pvp_owner_key_v1・masmonPvpSelf)。ブリーダーIDと鍵は画面に出さない
//   ★借りた子の能力は送られたまま信じない: ランク・効きは計算の芯(SUC.memberOf)が6能力から出し直す。
//     アシストは「6能力から出せる最大の総合力」のポイント以内・4種類までかをここで確かめ、外れたら効かせない(ASSIST.md §3)
//   保存: 新しいキーは作らない(貸し出しの子の id は mh_monsuc_meta_v1.lend に画面側が書く。借りた子は育成の cheer に写しで持つ)
//   公開の印: RELEASE_FLAGS.monheroSuccess が真のときだけ通信する(偽なら reason 'off')
// 返り値の reason は monsucLendReasonText で日本語にできる
const MONSUC_LEND_REASON_TEXT = Object.freeze({
  off: 'フレンドからのレンタルは準備中です',
  network: 'つながりませんでした。少し待ってからもう一度ためしてね',
  server: 'サーバーが混んでいるみたい。少し待ってからもう一度ためしてね',
  no_id: 'この端末ではまだ使えません',
  locked: 'この貸し出しは別の端末で作られています',
  mon: 'このマスモンは貸し出せません',
  not_friend: 'フレンドのマスモンだけを借りられます',
  no_lend: 'そのマスモンはもう貸し出されていません',
  streak: '同じフレンドのマスモンは、続けて2回までです。ほかのフレンドのマスモンも借りてみよう',
  self: '自分のマスモンは借りられません',
  lender: 'そのマスモンは借りられません',
});
const monsucLendReasonText = (reason) => MONSUC_LEND_REASON_TEXT[reason] || MONSUC_LEND_REASON_TEXT.server;
const monsucLendOn = () => typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS && RELEASE_FLAGS.monheroSuccess === true;
const MONSUC_LEND_STAT_KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];

// サーバの関数を呼ぶ(masmon-pvp と同じ口)。断りの種類をこの部品の言葉のまま返す。落ちない
const monsucLendPost = async (body) => {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), 12000) : null;
  try {
    const r = await fetch(MASMON_PVP_URL, {
      method: 'POST', headers: typeof SB_HEADERS !== 'undefined' ? SB_HEADERS : { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ac ? ac.signal : undefined,
    });
    let j = null;
    try { j = await r.json(); } catch (_) { j = null; }
    if (j && j.ok) return j;
    const e = j && typeof j.error === 'string' ? j.error : (r.status >= 500 ? 'server' : 'network');
    return { ok: false, reason: MONSUC_LEND_REASON_TEXT[e] ? e : 'server' };
  } catch (_) {
    return { ok: false, reason: 'network' };
  } finally { if (timer) clearTimeout(timer); }
};

// 保存枠の1体(mh_monsuc_box_v1 の mons の1つ)から、送る中身を作る。送るのは 6能力・種・名前・色・型・アシストだけ
const monsucLendPayloadOf = (child) => {
  const c = child && typeof child === 'object' ? child : null;
  if (!c || typeof c.species !== 'string') return null;
  const st = c.st && typeof c.st === 'object' ? c.st : (c.stats && typeof c.stats === 'object' ? c.stats : null);
  if (!st) return null;
  const stats = {};
  for (const k of MONSUC_LEND_STAT_KEYS) {
    const v = Number(st[k]);
    if (!Number.isFinite(v)) return null;
    stats[k] = Math.max(0, Math.min(999, Math.round(v)));
  }
  const picks = c.asp && c.asp.picks && typeof c.asp.picks === 'object' && !Array.isArray(c.asp.picks) ? c.asp.picks : {};
  const assists = Object.entries(picks).filter(([, lv]) => Number.isInteger(lv) && lv >= 1 && lv <= 3).slice(0, 4).map(([id, lv]) => ({ id, lv }));
  const nameRaw = typeof c.nick === 'string' && c.nick.trim() ? c.nick : (typeof c.name === 'string' ? c.name : '');
  const name = [...nameRaw.trim()].slice(0, 12).join('') || c.species.slice(0, 12);
  const out = { species: c.species, name, stats, assists };
  const type = Number.isInteger(c.type) ? c.type : (Number.isInteger(c.gt) ? c.gt : null);
  if (type != null && type >= 0 && type <= 5) out.type = type;
  if (c.colors && typeof c.colors === 'object') out.colors = c.colors;
  return out;
};

// 借りた子を、育成の編成の1枠(cheer の { friend: 写し })にする。SUC = MONHERO_SUCCESS.create(...) の結果
//   返り値はそのまま SUC.memberOf / SUC.newRun({ team }) に渡せる形 { kind:'raised', species, name, stats, assists, friend:{ id, name } }
//   アシストが「6能力から出せる最大の総合力」のポイントを超える・4種類を超える・知らない id → その子のアシストは空にする
const monsucLendMember = (row, SUC) => {
  const r = row && typeof row === 'object' ? row : null;
  const m = r && r.lend && typeof r.lend === 'object' ? r.lend : null;
  if (!m || !SUC || !Array.isArray(SUC.speciesList) || !SUC.speciesList.includes(m.species)) return null;
  const st = m.stats && typeof m.stats === 'object' ? m.stats : null;
  if (!st) return null;
  const stats = {};
  for (const k of MONSUC_LEND_STAT_KEYS) {
    const v = Number(st[k]);
    if (!Number.isFinite(v)) return null;
    stats[k] = Math.max(0, Math.min(999, Math.round(v)));
  }
  let assists = [];
  const list = Array.isArray(m.assists) ? m.assists : [];
  const known = SUC.ASSISTS && typeof SUC.ASSISTS === 'object' ? SUC.ASSISTS : {};
  const okShape = list.length <= 4 && list.every((a) => a && known[a.id] && Number.isInteger(a.lv) && a.lv >= 1 && a.lv <= 3)
    && new Set(list.map((a) => a.id)).size === list.length;
  if (okShape && list.length) {
    // 6能力から出せる最大の総合力(Lv・技の熟練・忠誠度・人気を全部いちばん上にしたとき)
    let budget = 0;
    try {
      const best = SUC.memberOf({ kind: 'raised', species: m.species, stats, lv: 999, loy: 100, pop: 100, masteries: [100, 100, 100, 100, 100, 100, 100, 100] });
      budget = SUC.assistPointsOf(best.power);
    } catch (_) { budget = 0; }
    const cost = list.reduce((t, a) => t + (Number((known[a.id].cost || [])[a.lv - 1]) || 0), 0);
    if (cost <= budget) assists = list.map((a) => ({ id: a.id, lv: a.lv }));
  }
  const name = typeof m.name === 'string' && m.name.trim() ? [...m.name.trim()].slice(0, 12).join('') : m.species;
  return {
    kind: 'raised', species: m.species, name, stats, assists,
    friend: { id: typeof r.friendId === 'string' ? r.friendId : null, name: typeof r.name === 'string' ? r.name.slice(0, 40) : '' },
  };
};

// フレンドが貸し出している子の一覧(1人1体・貸し出していない人は出さない)
const monsucLendFriends = async () => {
  if (!monsucLendOn()) return { ok: false, reason: 'off', rows: [] };
  const self = masmonPvpSafeId(typeof ensureBreederId === 'function' ? await ensureBreederId() : null);
  if (!self || typeof sbFetchFriendRoster !== 'function') return { ok: false, reason: 'no_id', rows: [] };
  let roster = [];
  try { roster = await sbFetchFriendRoster(self); } catch (_) { return { ok: false, reason: 'network', rows: [] }; }
  const ids = roster.map((f) => masmonPvpSafeId(f.otherId)).filter(Boolean).slice(0, 100);
  if (!ids.length) return { ok: true, rows: [] };
  const got = await masmonPvpRead(`monsuc_lend?select=owner_id,mon,version,updated_at&active=eq.true&owner_id=in.(${ids.join(',')})`);
  if (!got) return { ok: false, reason: 'network', rows: [] };
  const rows = roster.map((f) => {
    const e = got.find((x) => x.owner_id === f.otherId);
    if (!e || !e.mon || typeof e.mon !== 'object') return null;
    const mon = e.mon;
    return {
      friendId: f.otherId, name: f.userName, icon: f.icon ?? null, profileFrame: f.profileFrame || null,
      lend: {
        species: mon.species, name: mon.name, colors: Array.isArray(mon.colors) && mon.colors.every((c) => typeof c === 'string') ? mon.colors.slice(0, 8) : null, type: Number.isInteger(mon.type) ? mon.type : null,
        stats: mon.stats, assists: Array.isArray(mon.assists) ? mon.assists : [], version: e.version, updatedAt: Date.parse(e.updated_at) || 0,
      },
    };
  }).filter(Boolean);
  return { ok: true, rows };
};

// 自分の保存枠の子を「貸し出しの子」にする(置き直しも同じ)。child は mh_monsuc_box_v1 の1体
const monsucLendSet = async (child, { userName, icon } = {}) => {
  if (!monsucLendOn()) return { ok: false, reason: 'off' };
  const mon = monsucLendPayloadOf(child);
  if (!mon) return { ok: false, reason: 'mon' };
  const me = await masmonPvpSelf(true);
  if (!me) return { ok: false, reason: 'no_id' };
  const r = await monsucLendPost({ action: 'lend_set', owner: me.owner, key: me.key, mon,
    name: typeof userName === 'string' ? userName : '', icon: typeof icon === 'string' ? icon : null });
  return r.ok ? { ok: true } : { ok: false, reason: r.reason };
};

// 貸し出しをやめる
const monsucLendClear = async () => {
  if (!monsucLendOn()) return { ok: false, reason: 'off' };
  const me = await masmonPvpSelf(false);
  if (!me) return { ok: false, reason: 'no_id' };
  const r = await monsucLendPost({ action: 'lend_clear', owner: me.owner, key: me.key });
  return r.ok ? { ok: true } : { ok: false, reason: r.reason };
};

// フレンドの子を借りた(育成を「はじめる」ときに1回)。'streak' で断られたらその枠を外す。network/off のときは借りずに始めてよい
const monsucLendUse = async (friendId) => {
  if (!monsucLendOn()) return { ok: false, reason: 'off' };
  const lender = masmonPvpSafeId(friendId);
  if (!lender) return { ok: false, reason: 'lender' };
  const me = await masmonPvpSelf(true);
  if (!me) return { ok: false, reason: 'no_id' };
  const r = await monsucLendPost({ action: 'lend_use', owner: me.owner, key: me.key, lender });
  return r.ok ? { ok: true } : { ok: false, reason: r.reason };
};

// 自分の子が借りられた回数(前に聞いてから)と、もらえる名声(1日の上限はサーバがかける)。名声の加算と知らせは画面側で
const monsucLendClaim = async () => {
  if (!monsucLendOn()) return { ok: false, reason: 'off', n: 0, fame: 0 };
  const me = await masmonPvpSelf(false);
  if (!me) return { ok: true, n: 0, paid: 0, fame: 0 }; // まだ鍵が無い = まだ一度も貸していない
  const r = await monsucLendPost({ action: 'lend_claim', owner: me.owner, key: me.key });
  if (!r.ok) return { ok: false, reason: r.reason, n: 0, fame: 0 };
  const n = Number.isInteger(r.n) && r.n > 0 ? r.n : 0;
  const paid = Number.isInteger(r.paid) && r.paid > 0 ? r.paid : 0;
  const fame = Number.isInteger(r.fame) && r.fame > 0 ? r.fame : 0;
  return { ok: true, n, paid, fame };
};
