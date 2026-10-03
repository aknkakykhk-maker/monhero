// フレンド機能の検査で使う、PostgREST のごく一部(絞り込み・POST・PATCH)を真似た偽サーバー。
// 本物のサーバーへはつながない。SQL(docs/sql/friends/FRIENDS_APPLY.sql)の約束を同じ形で守る:
//   ・friend_codes: コードは8文字・重複は409。UPDATE / DELETE は通らない
//   ・friend_links: 1組は1行まで(逆向きの新規行は409)。自分への申請は弾く。blocked と blocked_by は同時
//   ・DELETE は常に403(権限が無い)
const pairKey = (a, b) => [a, b].sort().join('|');

// options.missingProfileExtra … friend_profiles に message / records の列がまだ無い環境(第3弾のSQL未適用)を真似る
const createFakeFriendsServer = (options = {}) => {
  const db = { friend_codes: [], friend_links: [], friend_invites: [], friend_profiles: [], breeder_profiles: [] };
  const calls = { methods: [], deletes: 0, sqlRejects: 0 };
  // 時刻は「いま」を起点に1秒ずつ進める(招待の有効期限の判定が実際の時計で動くように)
  const base = Date.now() - 60 * 1000;
  let clock = 0;
  const tick = () => new Date(base + (clock += 1000)).toISOString();

  // 絞り込みの文字列を行の述語にする。対応するのは eq / in / or(and(...)) だけ
  const parseFilter = (query) => {
    const preds = [];
    for (const [key, raw] of query.entries()) {
      if (['select', 'order', 'limit', 'on_conflict'].includes(key)) continue;
      if (key === 'or') {
        const inner = raw.slice(1, -1);
        const terms = inner.match(/and\([^)]*\)|[^,()]+\.eq\.[^,()]+/g) || [];
        const orPreds = terms.map((term) => {
          const pairs = (term.startsWith('and(') ? term.slice(4, -1).split(',') : [term]).map((t) => t.split('.eq.'));
          return (row) => pairs.every(([col, val]) => row[col] === val);
        });
        preds.push((row) => orPreds.some((fn) => fn(row)));
      } else if (raw.startsWith('eq.')) {
        preds.push((row) => row[key] === raw.slice(3));
      } else if (raw.startsWith('gte.')) {
        preds.push((row) => String(row[key]) >= raw.slice(4));
      } else if (raw.startsWith('in.(')) {
        const set = raw.slice(4, -1).split(',');
        preds.push((row) => set.includes(row[key]));
      }
    }
    return (row) => preds.every((fn) => fn(row));
  };

  // { status, body } を返す。body は JSON にする前の値(無ければ undefined)
  const handle = (url, method = 'GET', bodyText = null) => {
    const u = new URL(url);
    const table = u.pathname.split('/rest/v1/')[1];
    calls.methods.push(method);
    if (!db[table]) return { status: 404, body: { code: 'PGRST205', message: `Could not find the table 'public.${table}'` } };
    const rows = db[table];
    if (method === 'DELETE') { calls.deletes += 1; return { status: 403, body: { message: 'permission denied' } }; }
    const columnMissing = () => ({ status: 400, body: { code: 'PGRST204', message: "Could not find the 'records' column of 'friend_profiles' in the schema cache" } });
    if (table === 'friend_profiles' && options.missingProfileExtra && method === 'GET' && /select=[^&]*(message|records)/.test(u.search)) return columnMissing();
    if (method === 'GET') {
      let out = rows.filter(parseFilter(u.searchParams));
      const limit = Number(u.searchParams.get('limit'));
      if (limit > 0) out = out.slice(0, limit);
      return { status: 200, body: out };
    }
    const body = bodyText ? JSON.parse(bodyText) : null;
    if (method === 'POST') {
      for (const item of body) {
        const row = { ...item };
        if (table === 'friend_profiles' && options.missingProfileExtra && ('message' in row || 'records' in row)) return columnMissing();
        if (table === 'friend_profiles' && row.message != null && String(row.message).length > 40) { calls.sqlRejects += 1; return { status: 400, body: { code: '23514' } }; }
        if (table === 'friend_profiles' && row.records != null && JSON.stringify(row.records).length > 12000) { calls.sqlRejects += 1; return { status: 400, body: { code: '23514' } }; }
        if (table === 'friend_codes') {
          if (rows.some((r) => r.breeder_id === row.breeder_id || r.friend_code === row.friend_code)) { calls.sqlRejects += 1; return { status: 409, body: { code: '23505' } }; }
          if (!/^[A-HJ-NP-Z2-9]{8}$/.test(row.friend_code)) { calls.sqlRejects += 1; return { status: 400, body: { code: '23514' } }; }
          row.created_at = tick();
        } else if (table === 'friend_profiles') {
          const PLACES = ['home', 'battle', 'rhythm', 'multi', 'masu', 'market', 'other'];
          if (row.place != null && !PLACES.includes(row.place)) { calls.sqlRejects += 1; return { status: 400, body: { code: '23514' } }; }
          if (row.play_seconds != null && row.play_seconds < 0) { calls.sqlRejects += 1; return { status: 400, body: { code: '23514' } }; }
          if (row.favorite != null && JSON.stringify(row.favorite).length > 6000) { calls.sqlRejects += 1; return { status: 400, body: { code: '23514' } }; }
          const old = rows.find((r) => r.breeder_id === row.breeder_id);
          if (old) { Object.assign(old, row, { updated_at: tick() }); continue; }   // on_conflict の上書き(1人1行)
          row.updated_at = tick();
        } else if (table === 'friend_invites') {
          if (row.sender_id === row.target_id || !/^[A-HJ-NP-Z2-9]{4}$/.test(row.room_code)) { calls.sqlRejects += 1; return { status: 400, body: { code: '23514' } }; }
          // on_conflict の上書き(同じ2人は1行。created_at は進む)
          const old = rows.find((r) => r.sender_id === row.sender_id && r.target_id === row.target_id);
          if (old) { Object.assign(old, row, { created_at: tick() }); continue; }
          row.created_at = tick();
        } else if (table === 'friend_links') {
          if (row.requester_id === row.target_id) { calls.sqlRejects += 1; return { status: 400, body: { code: '23514' } }; }
          if (rows.some((r) => pairKey(r.requester_id, r.target_id) === pairKey(row.requester_id, row.target_id))) { calls.sqlRejects += 1; return { status: 409, body: { code: '23505' } }; }
          row.status = row.status || 'pending'; row.blocked_by = row.blocked_by || null;
          row.created_at = tick(); row.updated_at = row.created_at;
          if ((row.status === 'blocked') !== (row.blocked_by !== null)) { calls.sqlRejects += 1; return { status: 400, body: { code: '23514' } }; }
        }
        rows.push(row);
      }
      return { status: 201 };
    }
    if (method === 'PATCH') {
      if (table === 'friend_codes') { calls.sqlRejects += 1; return { status: 403, body: { message: 'permission denied' } }; }
      for (const row of rows.filter(parseFilter(u.searchParams))) {
        const next = { ...row, ...body };
        if (next.status !== 'blocked') next.blocked_by = null;
        if ((next.status === 'blocked') !== (next.blocked_by !== null && next.blocked_by !== undefined)) { calls.sqlRejects += 1; return { status: 400, body: { code: '23514' } }; }
        Object.assign(row, next, { updated_at: tick() });
      }
      return { status: 204 };
    }
    return { status: 405 };
  };
  // 通信層(34-friends-api.jsx)の fetch の代わりに差し込む形
  const fetch = async (url, options = {}) => {
    const { status, body } = handle(url, options.method || 'GET', options.body || null);
    return { ok: status >= 200 && status < 300, status, statusText: String(status), text: async () => (body === undefined ? '' : JSON.stringify(body)) };
  };
  return { db, calls, handle, fetch, tick, pairKey };
};

module.exports = { createFakeFriendsServer, pairKey };
