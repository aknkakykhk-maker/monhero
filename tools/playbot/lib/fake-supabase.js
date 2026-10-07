// プレイボット用の「にせの Supabase」。本物の全国ランキングへは1件も届けない(CLAUDE.md ⑦)。
//
// ゲームはふつうに送るつもりで動き、成功の返事を受け取る。送られた記録はここで覚えておき、
// あとでランキングを読みに来たら返す。だからボットがランキング画面を開くと、
// 自分(モンヒロくん)の記録が並んで見える。送った件数と中身は報告に残る。
//
// 返すのは rankings / breeder_profiles など「表」への読み書きだけ。集計(rpc)や
// 週の区切り(rhythm_week_window)は空を返す(ゲームは空のときの表示を持っている)。

// PostgREST の絞り込み(?difficulty=eq.Beginner / in.("a","b"))のうち、ゲームが使う形だけを解く
const parseFilters = (url) => {
  const filters = [];
  let order = null, limit = Infinity, offset = 0;
  for (const [key, raw] of url.searchParams.entries()) {
    if (key === 'select' || key === 'on_conflict') continue;
    if (key === 'order') { order = raw; continue; }
    if (key === 'limit') { limit = Number(raw) || Infinity; continue; }
    if (key === 'offset') { offset = Number(raw) || 0; continue; }
    const m = raw.match(/^(eq|neq|gt|gte|lt|lte|in|is)\.(.*)$/);
    if (!m) continue;
    filters.push({ key, op: m[1], value: m[2] });
  }
  return { filters, order, limit, offset };
};

const matches = (row, { key, op, value }) => {
  const v = row[key];
  switch (op) {
    case 'eq': return String(v) === value;
    case 'neq': return String(v) !== value;
    case 'gt': return Number(v) > Number(value);
    case 'gte': return Number(v) >= Number(value);
    case 'lt': return Number(v) < Number(value);
    case 'lte': return Number(v) <= Number(value);
    case 'is': return value === 'null' ? v === null || v === undefined : String(v) === value;
    case 'in': {
      const list = value.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
      return list.includes(String(v));
    }
    default: return true;
  }
};

const sortRows = (rows, order) => {
  if (!order) return rows;
  const [col, dir] = order.split('.');
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[col], y = b[col];
    if (x === y) return 0;
    if (x === null || x === undefined) return 1;
    if (y === null || y === undefined) return -1;
    return (x > y ? 1 : -1) * sign;
  });
};

function createFakeSupabase() {
  const tables = new Map(); // 表の名前 → 行の配列
  const writes = [];        // 送られた記録(報告用)
  let nextId = 1;

  // 通信の具合(通信不良係が切り替える)。'ok' ふつう / 'down' つながらない(503) / 'slow' 遅い(slowMs 待ってから返す)
  const net = { mode: 'ok', slowMs: 10000, refused: 0 };
  const handle = async (route) => {
    if (net.mode === 'down') { net.refused += 1; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'playbot: down' }) }); }
    if (net.mode === 'slow') await new Promise((r) => setTimeout(r, net.slowMs));
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const m = url.pathname.match(/\/rest\/v1\/(rpc\/)?([A-Za-z0-9_]+)/);
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (!m) return json(200, []);
    const isRpc = !!m[1], table = m[2];
    if (isRpc) return json(200, []);
    if (method === 'GET' || method === 'HEAD') {
      const { filters, order, limit, offset } = parseFilters(url);
      const rows = sortRows((tables.get(table) || []).filter((r) => filters.every((f) => matches(r, f))), order);
      return json(200, rows.slice(offset, offset + limit));
    }
    if (method === 'POST' || method === 'PATCH') {
      let body = null;
      try { body = JSON.parse(req.postData() || 'null'); } catch { body = null; }
      const list = Array.isArray(body) ? body : body && typeof body === 'object' ? [body] : [];
      const rows = tables.get(table) || [];
      const conflict = url.searchParams.get('on_conflict');
      const saved = list.map((row) => {
        const full = { id: nextId++, created_at: new Date().toISOString(), ...row };
        if (conflict) {
          const keys = conflict.split(',');
          const at = rows.findIndex((r) => keys.every((k) => String(r[k]) === String(row[k])));
          if (at >= 0) { rows[at] = { ...rows[at], ...row }; return rows[at]; }
        }
        rows.push(full);
        return full;
      });
      tables.set(table, rows);
      saved.forEach((row) => writes.push({ table, method, row }));
      return json(201, saved);
    }
    return json(200, []);
  };

  return { handle, writes, tables, net };
}

module.exports = { createFakeSupabase };
