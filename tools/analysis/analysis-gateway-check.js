// 分析の入り口(r1119-014 PR1)を、本番の Claude API と DB を使わずに確かめる。
//
//   node tools/analysis/analysis-gateway-check.js
//
// 偽物の Claude・偽物の DB を、Edge Function の中身(supabase/functions/analysis-gateway/core.js)へ渡して、
//   ① 合言葉が Secrets に無い → 503 / 無い・違う → 403。DB も Claude も呼ばない
//   ② message: モデルは claude-opus-5-5・考えは adaptive・effort・回し先(opus-4-8)。呼ぶ側がモデル等を変えられない
//   ③ 絵(png・jpeg)を受けて base64 のまま渡す。絵の大きさを見積りに入れる。url の絵・道具の欄などは断る
//   ④ 1回の見積りが $20 を超える → 呼ばずに 400 / 1日の上限 → 呼ばずに 429
//   ⑤ 使った額を実際の使用量で記録(エラーは 0 ドル・断られたら refused)
//   ⑥ バッチ: 半額で見積り・頼んだ番号を記録・終わったら1回だけ額を書く(2回目は書かない)・ほかのバッチは 404
//   ⑦ SQL は新しい表と関数だけ(既存の表を変えない・消さない)・ゲーム(anon)からは使えない
//   ⑧ 入口(index.ts)に CORS が無い・合言葉の値が書かれていない / 送り口の見積りが入り口と同じ
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const DIR = path.join(root, 'supabase', 'functions', 'analysis-gateway');
const SQL = path.join(root, 'supabase', 'migrations', '202611190001_analysis_gateway.sql');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const TOKEN = 'test-token-0123456789abcdef';
const NOW = new Date('2026-11-19T03:00:00Z'); // 日本時間 2026-11-19 12:00

// 幅 w・高さ h の PNG の頭だけ(入り口は頭しか読まない)
const pngB64 = (w, h) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20);
  return b.toString('base64');
};
// 幅 w・高さ h の JPEG の頭(SOI・APP0・SOF0)
const jpegB64 = (w, h) => Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
]).toString('base64');

const fakeDb = ({ used = 0 } = {}) => {
  const rows = [];
  const calls = [];
  const dayUsed = () => used + rows.reduce((s, r) => s + (['done', 'refused', 'error'].includes(r.status) ? (r.usd_actual || 0) : r.usd_est), 0);
  return {
    rows, calls,
    reserve: async (a) => {
      calls.push(['reserve', a]);
      const u = dayUsed();
      if (u + a.usdEst > a.dayCap) return { ok: false, reason: 'day_cap', used: u };
      const id = rows.length + 1;
      rows.push({ id, status: 'reserved', usd_est: a.usdEst, batch_id: null, ...a });
      return { ok: true, id, used: u };
    },
    attachBatch: async (id, batchId) => { calls.push(['attach', id, batchId]); const r = rows.find((x) => x.id === id); r.batch_id = batchId; r.status = 'batch_pending'; },
    finish: async (id, f) => {
      calls.push(['finish', id, f]);
      const r = rows.find((x) => x.id === id);
      if (!r || !['reserved', 'batch_pending'].includes(r.status)) return false;
      Object.assign(r, { status: f.status, usd_actual: f.usdActual, usage: f.usage, model: f.model });
      return true;
    },
    findBatch: async (batchId) => rows.find((r) => r.batch_id === batchId) || null,
    dayUsed: async () => dayUsed(),
  };
};

const fakeClient = ({ message, streamError, batchStatus = 'ended', results = [] } = {}) => {
  const calls = [];
  return {
    calls,
    beta: { messages: { stream: (params) => { calls.push(['stream', params]); return { finalMessage: async () => { if (streamError) throw streamError; return message; } }; } } },
    messages: {
      batches: {
        create: async (p) => { calls.push(['create', p]); return { id: 'msgbatch_test1' }; },
        retrieve: async (id) => { calls.push(['retrieve', id]); return { id, processing_status: batchStatus, request_counts: { succeeded: results.length } }; },
        results: async (id) => { calls.push(['results', id]); return (async function* gen() { for (const r of results) yield r; })(); },
        cancel: async (id) => { calls.push(['cancel', id]); return { id }; },
      },
    },
  };
};

const OK_MESSAGE = {
  model: 'claude-opus-5-5', stop_reason: 'end_turn',
  content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '報告です。' }],
  usage: { input_tokens: 10000, output_tokens: 2000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
};
const textReq = (extra = {}) => ({ system: 'あなたは分析役です。', messages: [{ role: 'user', content: '表を読んでください。' }], max_tokens: 4000, ...extra });

(async () => {
  const core = await import(path.join(DIR, 'core.js'));
  const run = (o) => core.handle({ token: TOKEN, expectedToken: TOKEN, now: NOW, ...o });

  // ① 合言葉
  {
    const db = fakeDb(); const client = fakeClient({ message: OK_MESSAGE });
    const a = await core.handle({ token: TOKEN, expectedToken: '', body: { action: 'usage' }, db, client, now: NOW });
    check('① 合言葉が Secrets に無い → 503', a.status === 503, `status ${a.status}`);
    const b = await core.handle({ token: '', expectedToken: TOKEN, body: { action: 'message', kind: 'x', request: textReq() }, db, client, now: NOW });
    const c = await core.handle({ token: `${TOKEN}x`, expectedToken: TOKEN, body: { action: 'message', kind: 'x', request: textReq() }, db, client, now: NOW });
    check('① 合言葉が無い・違う → 403', b.status === 403 && c.status === 403, `${b.status} ${c.status}`);
    check('① 断ったときは DB も Claude も呼ばない', db.calls.length === 0 && client.calls.length === 0);
    check('① 返事に合言葉が入らない', !JSON.stringify([a, b, c]).includes(TOKEN));
  }

  // ② message
  {
    const db = fakeDb(); const client = fakeClient({ message: OK_MESSAGE });
    const r = await run({ body: { action: 'message', kind: 'balance', label: 'test', request: textReq({ model: 'claude-haiku-5-5', tools: [{ name: 'x' }], effort: 'xhigh' }) }, db, client });
    const p = client.calls[0]?.[1] || {};
    check('② message → 200・本文を返す', r.status === 200 && r.json.ok && r.json.text === '報告です。', JSON.stringify(r.json).slice(0, 120));
    check('② モデルは claude-opus-5-5(呼ぶ側の model は無視)', p.model === 'claude-opus-5-5', p.model);
    check('② 道具の欄は渡さない', p.tools === undefined);
    check('② 考えは adaptive・effort は渡した値', p.thinking?.type === 'adaptive' && p.output_config?.effort === 'xhigh');
    check('② 断られたら opus-4-8 へ回す', Array.isArray(p.fallbacks) && p.fallbacks[0]?.model === 'claude-opus-4-8' && p.betas?.includes('server-side-fallback-2026-07-01'));
    // 10000×$4 + 2000×$20 = $0.08
    check('② 実際の額を記録(10000入力・2000出力 = $0.08)', r.json.usd === 0.08 && db.rows[0].status === 'done' && db.rows[0].usd_actual === 0.08, `usd ${r.json.usd}`);
    check('② 日本時間の日で数える', db.rows[0].day === '2026-11-19');
    const d = await run({ body: { action: 'message', kind: 'balance', request: textReq({ effort: 'super' }) }, db, client });
    const e = await run({ body: { action: 'message', kind: 'balance', request: { messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: '書き出し' }] } }, db, client });
    const f = await run({ body: { action: 'message', kind: 'BAD KIND', request: textReq() }, db, client });
    check('② effort の値違い・最後が assistant・kind の形違い → 400', d.status === 400 && e.status === 400 && f.status === 400, `${d.status} ${e.status} ${f.status}`);
    const g = await run({ body: { action: 'message', kind: 'balance', request: textReq({ max_tokens: 20000 }) }, db, client });
    check('② message の max_tokens は 16000 まで', g.status === 400 && g.json.error === 'max_tokens');
  }

  // ③ 絵
  {
    const db = fakeDb(); const client = fakeClient({ message: OK_MESSAGE });
    const req = { messages: [{ role: 'user', content: [
      { type: 'image', media_type: 'image/png', data: pngB64(1290, 2796) },
      { type: 'image', media_type: 'image/jpeg', data: jpegB64(1920, 1080) },
      { type: 'text', text: 'この画面の崩れを表に。' },
    ] }], max_tokens: 2000 };
    const built = core.buildParams(req);
    const imgs = (built.params?.messages?.[0]?.content || []).filter((b) => b.type === 'image');
    check('③ png・jpeg を base64 のまま渡す', built.ok && imgs.length === 2 && imgs[0].source.type === 'base64' && imgs[0].source.media_type === 'image/png' && imgs[1].source.media_type === 'image/jpeg');
    const expectImg = Math.ceil(1290 * 2796 / 750) + 100 + Math.ceil(1920 * 1080 / 750) + 100;
    check('③ 絵の大きさを見積りに入れる', built.ok && built.est.inputTokens >= expectImg && built.est.images === 2, `${built.est?.inputTokens} >= ${expectImg}`);
    const r = await run({ body: { action: 'message', kind: 'ui-check', request: req }, db, client });
    check('③ 絵つきで呼べる', r.status === 200 && r.json.ok);
    const bad = [
      { type: 'image', source: { type: 'url', url: 'https://example.com/a.png' } },
      { type: 'image', media_type: 'image/gif', data: pngB64(10, 10) },
      { type: 'image', media_type: 'image/png', data: jpegB64(10, 10) },
      { type: 'tool_use', id: 'x', name: 'x', input: {} },
      { type: 'document', source: {} },
    ];
    const results = bad.map((b) => core.buildParams({ messages: [{ role: 'user', content: [b, { type: 'text', text: 'a' }] }] }));
    check('③ url の絵・gif・形の違う絵・道具・文書は断る', results.every((x) => !x.ok), results.map((x) => x.error).join(','));
    const many = core.buildParams({ messages: [{ role: 'user', content: Array.from({ length: 21 }, () => ({ type: 'image', media_type: 'image/png', data: pngB64(100, 100) })) }] });
    check('③ 1つの頼みに絵は20枚まで', !many.ok && many.error === 'too_many_images');
  }

  // ④ 上限
  {
    const db = fakeDb(); const client = fakeClient({ message: OK_MESSAGE });
    // 40万バイトに近い日本語(約13万字 → 約20万トークン × $5 × 1.25 ≒ $1.25)+ 出力16000 は $20 を超えない。上限を $1 にして確かめる
    const big = textReq({ messages: [{ role: 'user', content: 'あ'.repeat(130000) }], max_tokens: 16000 });
    const r = await run({ body: { action: 'message', kind: 'balance', request: big }, db, client, limits: { dayUsd: 25, callUsd: 1 } });
    check('④ 1回の見積りが上限を超える → 呼ばずに 400', r.status === 400 && r.json.error === 'over_call_cap' && client.calls.length === 0 && db.calls.length === 0, JSON.stringify(r.json));
    const db2 = fakeDb({ used: 24.99 });
    const r2 = await run({ body: { action: 'message', kind: 'balance', request: textReq() }, db: db2, client });
    check('④ 1日の上限を超える → 呼ばずに 429', r2.status === 429 && r2.json.error === 'day_cap' && client.calls.length === 0, JSON.stringify(r2.json));
    const r3 = await run({ body: { action: 'message', kind: 'balance', request: textReq() }, db: fakeDb(), client, limits: { dayUsd: 0, callUsd: 20 } });
    check('④ 1日の上限 0 → 全部断る', r3.status === 429);
    check('④ 既定の上限は 1日 $25・1回 $20', core.DEFAULT_LIMITS.dayUsd === 25 && core.DEFAULT_LIMITS.callUsd === 20);
    const u = await run({ body: { action: 'usage' }, db: fakeDb({ used: 3.5 }), client });
    check('④ usage は今日の額と上限を返す', u.status === 200 && u.json.usd_used === 3.5 && u.json.day_cap === 25 && u.json.day === '2026-11-19');
  }

  // ⑤ エラー・断られた
  {
    const db = fakeDb(); const client = fakeClient({ streamError: Object.assign(new Error('x'), { status: 529 }) });
    const r = await run({ body: { action: 'message', kind: 'balance', request: textReq() }, db, client });
    check('⑤ API エラー → 502・0 ドルで error を記録', r.status === 502 && db.rows[0].status === 'error' && db.rows[0].usd_actual === 0);
    const db2 = fakeDb();
    const refusal = { ...OK_MESSAGE, stop_reason: 'refusal', content: [] };
    const r2 = await run({ body: { action: 'message', kind: 'balance', request: textReq() }, db: db2, client: fakeClient({ message: refusal }) });
    check('⑤ 断られた → refused を記録・本文は空', r2.status === 200 && r2.json.ok === false && db2.rows[0].status === 'refused' && r2.json.text === '');
    const db3 = fakeDb();
    const fell = { ...OK_MESSAGE, model: 'claude-opus-4-8' };
    const r3 = await run({ body: { action: 'message', kind: 'balance', request: textReq() }, db: db3, client: fakeClient({ message: fell }) });
    // 10000×$5 + 2000×$25 = $0.10
    check('⑤ 回し先で答えたら、その値段で数える', r3.json.usd === 0.1 && db3.rows[0].model === 'claude-opus-4-8', `usd ${r3.json.usd}`);
  }

  // ⑥ バッチ
  {
    const db = fakeDb();
    const success = (id, model = 'claude-opus-5-5') => ({ custom_id: id, result: { type: 'succeeded', message: { ...OK_MESSAGE, model } } });
    const client = fakeClient({ batchStatus: 'in_progress' });
    const reqs = [1, 2, 3].map((i) => ({ custom_id: `shot-${i}`, request: { system: '共通の前置き', cache_system: true, messages: [{ role: 'user', content: [{ type: 'image', media_type: 'image/png', data: pngB64(390, 844) }, { type: 'text', text: '見て' }] }], max_tokens: 1500 } }));
    const s = await run({ body: { action: 'batch_submit', kind: 'ui-check', requests: reqs }, db, client });
    const created = client.calls.find((c) => c[0] === 'create')?.[1];
    check('⑥ バッチを頼む → 番号を返して記録', s.status === 200 && s.json.batch_id === 'msgbatch_test1' && db.rows[0].batch_id === 'msgbatch_test1' && db.rows[0].status === 'batch_pending');
    check('⑥ 各頼みも claude-opus-5-5・前置きをキャッシュ', created?.requests?.length === 3 && created.requests.every((x) => x.params.model === 'claude-opus-5-5' && x.params.system?.[0]?.cache_control?.type === 'ephemeral'));
    const one = core.buildParams(reqs[0].request, { batch: true });
    check('⑥ バッチの見積りは半額', Math.abs(s.json.usd_est - 3 * core.estimateUsd(one.est, { batch: true })) < 0.0005 && core.estimateUsd(one.est, { batch: true }) < core.estimateUsd(one.est, { batch: false }));
    const dup = await run({ body: { action: 'batch_submit', kind: 'ui-check', requests: [reqs[0], reqs[0]] }, db, client });
    check('⑥ custom_id の重なり → 400', dup.status === 400 && dup.json.error === 'custom_id');
    const pending = await run({ body: { action: 'batch_get', batch_id: 'msgbatch_test1' }, db, client });
    check('⑥ まだ終わっていない → 進みだけ返す', pending.status === 200 && pending.json.processing_status === 'in_progress' && !pending.json.results);
    const client2 = fakeClient({ batchStatus: 'ended', results: [success('shot-1'), success('shot-2'), { custom_id: 'shot-3', result: { type: 'errored', error: {} } }] });
    const g1 = await run({ body: { action: 'batch_get', batch_id: 'msgbatch_test1' }, db, client: client2 });
    // 2件 × ($0.08 ÷ 2) = $0.08
    check('⑥ 終わった → 結果を返し、半額の実際の額を記録', g1.status === 200 && g1.json.results.length === 3 && g1.json.usd === 0.08 && db.rows[0].status === 'done' && db.rows[0].usd_actual === 0.08, `usd ${g1.json.usd}`);
    check('⑥ 失敗した頼みも結果に並ぶ', g1.json.results.some((x) => x.custom_id === 'shot-3' && x.type === 'errored'));
    const finishes = db.calls.filter((c) => c[0] === 'finish').length;
    await run({ body: { action: 'batch_get', batch_id: 'msgbatch_test1' }, db, client: client2 });
    check('⑥ 2回目は額を書き直さない', db.rows[0].usd_actual === 0.08 && db.calls.filter((c) => c[0] === 'finish').length === finishes + 1 && db.rows[0].status === 'done');
    const nf = await run({ body: { action: 'batch_get', batch_id: 'msgbatch_other' }, db, client: client2 });
    check('⑥ この入り口で頼んでいないバッチ → 404', nf.status === 404);
    const bad = await run({ body: { action: 'batch_get', batch_id: '../x' }, db, client: client2 });
    check('⑥ 番号の形違い → 400', bad.status === 400);
    const big = Array.from({ length: 1001 }, (_, i) => ({ custom_id: `a${i}`, request: textReq() }));
    const tooMany = await run({ body: { action: 'batch_submit', kind: 'ui-check', requests: big }, db, client });
    check('⑥ バッチは1000件まで', tooMany.status === 400);
  }

  // ⑦ SQL
  {
    const sql = fs.readFileSync(SQL, 'utf8').replace(/--.*$/gm, '');
    const creates = [...sql.matchAll(/create\s+(?:or\s+replace\s+)?(?:unique\s+)?(table|function|index)\s+(?:if\s+not\s+exists\s+)?(public\.)?([a-z_]+)/gi)].map((m) => m[3]);
    check('⑦ 作るのは analysis_gateway_ の表・関数だけ', creates.length > 0 && creates.every((n) => n.startsWith('analysis_gateway')), creates.join(','));
    check('⑦ drop・delete・truncate・既存の表の alter が無い', !/\b(drop|delete|truncate)\b/i.test(sql) && [...sql.matchAll(/alter\s+table\s+(?:public\.)?([a-z_]+)/gi)].every((m) => m[1] === 'analysis_gateway_usage'));
    check('⑦ 表に RLS', /alter table public\.analysis_gateway_usage enable row level security/.test(sql));
    const fns = [...sql.matchAll(/create or replace function public\.([a-z_]+)/g)].map((m) => m[1]);
    check('⑦ 関数はすべて anon・authenticated から取り上げ、service_role だけ', fns.every((f) => new RegExp(`revoke all on function public\\.${f}\\([^)]*\\) from public, anon, authenticated`).test(sql) && new RegExp(`grant execute on function public\\.${f}\\([^)]*\\) to service_role`).test(sql)), fns.join(','));
    check('⑦ 関数は search_path を決めている', (sql.match(/security definer set search_path = public/g) || []).length === fns.length);
  }

  // ⑧ 入口・送り口
  {
    const idx = fs.readFileSync(path.join(DIR, 'index.ts'), 'utf8');
    check('⑧ 入口に CORS が無い', !/Access-Control-Allow/i.test(idx));
    check('⑧ 合言葉・上限は Secrets から読む', /Deno\.env\.get\("ANALYSIS_GATEWAY_TOKEN"\)/.test(idx) && /ANALYSIS_DAY_USD/.test(idx) && /ANALYSIS_CALL_USD/.test(idx));
    check('⑧ 合言葉を x-analysis-token から取る', /req\.headers\.get\("x-analysis-token"\)/.test(idx));
    const all = [idx, fs.readFileSync(path.join(DIR, 'core.js'), 'utf8'), fs.readFileSync(path.join(__dirname, 'gateway-client.js'), 'utf8')].join('\n');
    check('⑧ キーらしい文字が書かれていない', !/sk-ant-[A-Za-z0-9]/.test(all));
    const client = require('./gateway-client.js');
    const req = textReq();
    const est = await client.estimate(req);
    check('⑧ 送り口の見積りは入り口と同じ', est.ok && est.usd_est === core.estimateUsd(core.buildParams(req).est));
    let seen = null;
    const fetchImpl = async (url, init) => { seen = { url, init }; return { status: 200, json: async () => ({ ok: true }) }; };
    await client.send({ action: 'usage' }, { url: 'https://example.invalid/fn', token: 'abc', fetchImpl });
    check('⑧ 送り口は合言葉を x-analysis-token に載せて POST', seen?.init?.method === 'POST' && seen.init.headers['x-analysis-token'] === 'abc');
    const saved = process.env.ANALYSIS_GATEWAY_TOKEN;
    process.env.ANALYSIS_GATEWAY_TOKEN = 'proxy';
    check('⑧ ANALYSIS_GATEWAY_TOKEN=proxy なら置き場所の文字を送る', client.tokenFromEnv() === 'proxy-injects-analysis-token');
    if (saved === undefined) delete process.env.ANALYSIS_GATEWAY_TOKEN; else process.env.ANALYSIS_GATEWAY_TOKEN = saved;
  }

  console.log(failed ? `\nNG ${failed} 件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
