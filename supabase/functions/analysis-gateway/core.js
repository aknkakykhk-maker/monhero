// 分析の入り口(r1119-014 PR1)の中身。Supabase Edge Function(Deno)から使う。
// 入口は index.ts。ここは Claude と DB を受け取って動くだけなので、検査(tools/analysis/analysis-gateway-check.js)から
// 偽物の Claude・偽物の DB で動かせる。ゲームからは呼ばない(CORS も開けない)。
//
// 使う人: 開発の道具(バランス研究 tools/success/、見た目の点検)。会話の機械から POST する。
//   ヘッダー x-analysis-token = 合言葉(Secrets の ANALYSIS_GATEWAY_TOKEN。値は窓口が入れる。ここにもリポジトリにも書かない)
//   本文 JSON の action で仕事を分ける:
//     usage        … 今日使った額と上限を返す(Claude は呼ばない)
//     message      … 1回だけ Claude を呼んで、その場で返す(急ぐ物・小さい物)
//     batch_submit … Message Batches で頼む(急がない物・半額)。batch_id を返す
//     batch_get    … 頼んだバッチの進み。終わっていれば結果を返し、使った額を記録する(何度呼んでも二重に数えない)
//     batch_cancel … 頼んだバッチを取り消す
//   request の形(message と batch_submit の各 request):
//     { system: '文字', cache_system: true|false, messages: [{ role: 'user'|'assistant', content: '文字' | [ブロック] }],
//       max_tokens: 数, effort: 'low'|'medium'|'high'|'xhigh'|'max' }
//     ブロックは { type: 'text', text } か { type: 'image', media_type: 'image/png'|'image/jpeg', data: base64 } だけ。
//     ほかの欄は捨てる(モデル・道具・ベータなどは呼ぶ側から変えられない)
//
// 上限(r1119-014 社長の選択): 1回 $20・1日 $25(日本時間の0時区切り)。
//   呼ぶ前に「多めの見積り」(入力は文字のバイト数と絵の大きさから多めに数え、出力は max_tokens を全部使った額)で確かめる。
//   1回の見積りが上限を超えたら呼ばずに断る。1日は「終わった物は実際の額・まだの物は見積り」の合計に足して超えるなら断る。
//   DB の analysis_gateway_reserve が日ごとの錠をかけて数えるので、同時に頼まれても超えない。
// モデル: claude-opus-5-5(考えは adaptive・effort は既定 high)。message は断られたとき claude-opus-4-8 へ回す(server-side fallback)。
//   見積りは高い方(opus-4-8)の値段で出す。バッチは半額で、回し先は付けない(断られた物は refused で返す)。
// ★返す物・ログに、合言葉と API キーは出さない。ログには額とトークン数と種類だけを書く(中身は書かない)
export const MODEL = 'claude-opus-5-5';
export const FALLBACK_MODEL = 'claude-opus-4-8';
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
export const DEFAULT_LIMITS = Object.freeze({ dayUsd: 25, callUsd: 20 });
export const MAX_TOKENS_MESSAGE = 16000;   // その場で返すので、関数の時間の内に収まる大きさまで
export const MAX_TOKENS_BATCH = 32000;
export const MAX_BATCH_REQUESTS = 1000;
export const MAX_IMAGES_PER_REQUEST = 20;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;  // API の1枚の上限(base64 を戻した大きさ)
export const MAX_TEXT_BYTES = 400 * 1024;        // 1つの request の文字の合計
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const IMAGE_TYPES = ['image/png', 'image/jpeg'];
const KIND_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const CUSTOM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const BATCH_ID_RE = /^msgbatch_[A-Za-z0-9_-]{1,100}$/;

// 100万トークンあたりのドル(2026-11 の API 価格)。cacheWrite は5分のキャッシュの書き込み(入力の1.25倍)
// 表に無いモデルが返ってきたら、高めの値(UNKNOWN_PRICE)で数える
export const PRICES = Object.freeze({
  'claude-opus-5-5': { in: 4, out: 20, cacheRead: 0.2 },
  'claude-opus-4-8': { in: 5, out: 25, cacheRead: 0.5 },
  'claude-opus-5': { in: 5, out: 25, cacheRead: 0.5 },
});
export const UNKNOWN_PRICE = Object.freeze({ in: 10, out: 50, cacheRead: 1 });
export const priceOf = (model) => PRICES[model] || UNKNOWN_PRICE;

// 日本時間の今日(YYYY-MM-DD)
export const jstDay = (now = new Date()) => new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const round4 = (v) => Math.round(v * 10000) / 10000;
const utf8Bytes = (s) => new TextEncoder().encode(s).length;

// ---- 合言葉 ----
// 長さや途中まで一致しているかで時間が変わらないよう、両方を SHA-256 にしてから全部比べる
const sha256 = async (s) => new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
export const tokenMatches = async (given, expected) => {
  if (typeof given !== 'string' || typeof expected !== 'string' || given.length === 0 || expected.length < 16) return false;
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
};

// ---- 絵の大きさ(見積り用) ----
const b64ToBytes = (data) => {
  if (typeof data !== 'string' || data.length === 0 || /[^A-Za-z0-9+/=]/.test(data)) return null;
  try {
    const bin = atob(data);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return null; }
};
// PNG と JPEG の幅・高さを頭から読む。読めなければ null
export const imageSize = (bytes, mediaType) => {
  if (!bytes || bytes.length < 24) return null;
  if (mediaType === 'image/png') {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (!sig.every((v, i) => bytes[i] === v)) return null;
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  if (mediaType === 'image/jpeg') {
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      // SOF0〜SOF15(DHT=C4・JPG=C8・DAC=CC を除く)に幅と高さがある
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
      }
      i += 2 + len;
    }
    return null;
  }
  return null;
};
// 絵1枚のトークンの多めの見積り。API は大きい絵を縮めるが、ここでは縮めない前提で数える(多めになる)
export const imageTokens = ({ w, h }) => Math.ceil((w * h) / 750) + 100;
// 文字の多めの見積り(日本語1文字=3バイト → 1.5トークン、英数字1文字 → 0.5トークン)
export const textTokens = (s) => Math.ceil(utf8Bytes(s) / 2);

// ---- 頼みの形を確かめて、API に渡す形へ作り直す ----
// 返り: { ok: true, params, est: { inputTokens, maxTokens, images } } / { ok: false, error }
export const buildParams = (req, { batch = false } = {}) => {
  if (!req || typeof req !== 'object' || Array.isArray(req)) return { ok: false, error: 'request' };
  const maxCap = batch ? MAX_TOKENS_BATCH : MAX_TOKENS_MESSAGE;
  const maxTokens = req.max_tokens === undefined ? 8000 : req.max_tokens;
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > maxCap) return { ok: false, error: 'max_tokens' };
  const effort = req.effort === undefined ? 'high' : req.effort;
  if (!EFFORTS.includes(effort)) return { ok: false, error: 'effort' };
  if (req.system !== undefined && typeof req.system !== 'string') return { ok: false, error: 'system' };
  if (!Array.isArray(req.messages) || req.messages.length === 0 || req.messages.length > 50) return { ok: false, error: 'messages' };

  let textBytes = req.system ? utf8Bytes(req.system) : 0;
  let inputTokens = req.system ? textTokens(req.system) : 0;
  let images = 0;
  const messages = [];
  for (let mi = 0; mi < req.messages.length; mi++) {
    const m = req.messages[mi];
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return { ok: false, error: 'role' };
    if (mi === 0 && m.role !== 'user') return { ok: false, error: 'role' };
    // 最後が assistant(書き出しの指定)は Opus 5.5 では断られるので、ここで止める
    if (mi === req.messages.length - 1 && m.role !== 'user') return { ok: false, error: 'role' };
    const raw = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content;
    if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'content' };
    const content = [];
    for (const b of raw) {
      if (b && b.type === 'text' && typeof b.text === 'string' && b.text.length > 0) {
        textBytes += utf8Bytes(b.text);
        inputTokens += textTokens(b.text);
        content.push({ type: 'text', text: b.text });
      } else if (b && b.type === 'image' && m.role === 'user' && IMAGE_TYPES.includes(b.media_type)) {
        const bytes = b64ToBytes(b.data);
        if (!bytes || bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: 'image' };
        const size = imageSize(bytes, b.media_type);
        if (!size || size.w < 1 || size.h < 1 || size.w > 8000 || size.h > 8000) return { ok: false, error: 'image' };
        images++;
        inputTokens += imageTokens(size);
        content.push({ type: 'image', source: { type: 'base64', media_type: b.media_type, data: b.data } });
      } else {
        return { ok: false, error: 'content' };
      }
    }
    messages.push({ role: m.role, content });
  }
  if (textBytes > MAX_TEXT_BYTES) return { ok: false, error: 'too_large' };
  if (images > MAX_IMAGES_PER_REQUEST) return { ok: false, error: 'too_many_images' };

  const params = { model: MODEL, max_tokens: maxTokens, thinking: { type: 'adaptive' }, output_config: { effort }, messages };
  if (req.system) {
    // 同じ前置きを何度も送る(バッチで絵を1枚ずつ見る等)ときは、前置きをキャッシュする
    params.system = req.cache_system === true
      ? [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }]
      : req.system;
  }
  return { ok: true, params, est: { inputTokens: inputTokens + 50, maxTokens, images } };
};

// 見積りのドル(出力は max_tokens を全部使う前提・キャッシュは効かない前提 = 多め)
export const estimateUsd = (est, { batch = false } = {}) => {
  const p = batch ? priceOf(MODEL) : priceOf(FALLBACK_MODEL); // message は回し先の方が高いので、そちらで数える
  const cacheWriteExtra = 0.25 * p.in; // キャッシュの書き込みは入力の1.25倍
  const usd = (est.inputTokens * (p.in + cacheWriteExtra) + est.maxTokens * p.out) / 1e6;
  return round4(batch ? usd / 2 : usd);
};

// 返ってきた使用量から実際のドル
export const usageUsd = (model, usage, { batch = false } = {}) => {
  const p = priceOf(model);
  const n = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
  const usd = (n(usage?.input_tokens) * p.in
    + n(usage?.cache_creation_input_tokens) * p.in * 1.25
    + n(usage?.cache_read_input_tokens) * p.cacheRead
    + n(usage?.output_tokens) * p.out) / 1e6;
  return round4(batch ? usd / 2 : usd);
};
const pickUsage = (u) => ({
  input_tokens: u?.input_tokens ?? 0,
  output_tokens: u?.output_tokens ?? 0,
  cache_creation_input_tokens: u?.cache_creation_input_tokens ?? 0,
  cache_read_input_tokens: u?.cache_read_input_tokens ?? 0,
});
const addUsage = (a, b) => ({
  input_tokens: a.input_tokens + b.input_tokens,
  output_tokens: a.output_tokens + b.output_tokens,
  cache_creation_input_tokens: a.cache_creation_input_tokens + b.cache_creation_input_tokens,
  cache_read_input_tokens: a.cache_read_input_tokens + b.cache_read_input_tokens,
});
const textOf = (message) => (Array.isArray(message?.content) ? message.content : [])
  .filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('');

const reply = (status, json) => ({ status, json });
const ZERO_USAGE = pickUsage(null);

// token: x-analysis-token の値 / expectedToken: Secrets の合言葉(無ければ止まる)
// body: 本文の JSON / limits: { dayUsd, callUsd } / client: Anthropic SDK
// db: { reserve({ day, kind, label, mode, usdEst, dayCap }) → { ok, id, reason, used }
//       attachBatch(id, batchId) / finish(id, { status, usdActual, usage, model }) → boolean(まだ終わっていなかった行だけ書く)
//       findBatch(batchId) → { id, status, usd_actual } | null / dayUsed(day) → 数 }
export const handle = async ({ token, expectedToken, body, limits = DEFAULT_LIMITS, client, db, log = () => {}, now = new Date() }) => {
  if (typeof expectedToken !== 'string' || expectedToken.length < 16) {
    log({ event: 'not_configured' });
    return reply(503, { ok: false, error: 'not_configured' });
  }
  if (!(await tokenMatches(token, expectedToken))) {
    log({ event: 'forbidden' });
    return reply(403, { ok: false, error: 'forbidden' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, { ok: false, error: 'body' });
  const dayCap = Number.isFinite(limits?.dayUsd) && limits.dayUsd >= 0 ? limits.dayUsd : DEFAULT_LIMITS.dayUsd;
  const callCap = Number.isFinite(limits?.callUsd) && limits.callUsd >= 0 ? limits.callUsd : DEFAULT_LIMITS.callUsd;
  const day = jstDay(now);
  const kind = typeof body.kind === 'string' && KIND_RE.test(body.kind) ? body.kind : null;
  const label = typeof body.label === 'string' ? body.label.slice(0, 120) : null;

  if (body.action === 'usage') {
    const used = await db.dayUsed(day);
    return reply(200, { ok: true, day, usd_used: round4(Number(used) || 0), day_cap: dayCap, call_cap: callCap });
  }

  if (body.action === 'message') {
    if (!kind) return reply(400, { ok: false, error: 'kind' });
    const built = buildParams(body.request, { batch: false });
    if (!built.ok) return reply(400, { ok: false, error: built.error });
    const usdEst = estimateUsd(built.est, { batch: false });
    if (usdEst > callCap) { log({ event: 'over_call_cap', kind, usd_est: usdEst }); return reply(400, { ok: false, error: 'over_call_cap', usd_est: usdEst, call_cap: callCap }); }
    const r = await db.reserve({ day, kind, label, mode: 'message', usdEst, dayCap });
    if (!r?.ok) { log({ event: 'over_day_cap', kind, usd_est: usdEst }); return reply(429, { ok: false, error: r?.reason || 'day_cap', usd_est: usdEst, usd_used: r?.used ?? null, day_cap: dayCap }); }

    let message;
    try {
      message = await client.beta.messages
        .stream({ ...built.params, betas: [FALLBACK_BETA], fallbacks: [{ model: FALLBACK_MODEL }] })
        .finalMessage();
    } catch (e) {
      await db.finish(r.id, { status: 'error', usdActual: 0, usage: ZERO_USAGE, model: null });
      log({ event: 'api_error', kind, status: e?.status ?? null });
      return reply(502, { ok: false, error: 'api', id: r.id });
    }
    const usage = pickUsage(message?.usage);
    const model = typeof message?.model === 'string' ? message.model : MODEL;
    const usd = usageUsd(model, usage);
    const refused = message?.stop_reason === 'refusal';
    await db.finish(r.id, { status: refused ? 'refused' : 'done', usdActual: usd, usage, model });
    log({ event: refused ? 'refused' : 'done', kind, model, usd_est: usdEst, usd, ...usage });
    return reply(200, {
      ok: !refused, id: r.id, model, stop_reason: message?.stop_reason ?? null,
      text: refused ? '' : textOf(message), usage, usd, usd_est: usdEst,
    });
  }

  if (body.action === 'batch_submit') {
    if (!kind) return reply(400, { ok: false, error: 'kind' });
    const list = body.requests;
    if (!Array.isArray(list) || list.length === 0 || list.length > MAX_BATCH_REQUESTS) return reply(400, { ok: false, error: 'requests' });
    const seen = new Set();
    const requests = [];
    let usdEst = 0;
    for (const item of list) {
      if (!item || !CUSTOM_ID_RE.test(item.custom_id || '') || seen.has(item.custom_id)) return reply(400, { ok: false, error: 'custom_id' });
      seen.add(item.custom_id);
      const built = buildParams(item.request, { batch: true });
      if (!built.ok) return reply(400, { ok: false, error: built.error, custom_id: item.custom_id });
      usdEst += estimateUsd(built.est, { batch: true });
      requests.push({ custom_id: item.custom_id, params: built.params });
    }
    usdEst = round4(usdEst);
    if (usdEst > callCap) { log({ event: 'over_call_cap', kind, usd_est: usdEst }); return reply(400, { ok: false, error: 'over_call_cap', usd_est: usdEst, call_cap: callCap }); }
    const r = await db.reserve({ day, kind, label, mode: 'batch', usdEst, dayCap });
    if (!r?.ok) { log({ event: 'over_day_cap', kind, usd_est: usdEst }); return reply(429, { ok: false, error: r?.reason || 'day_cap', usd_est: usdEst, usd_used: r?.used ?? null, day_cap: dayCap }); }
    let batch;
    try {
      batch = await client.messages.batches.create({ requests });
    } catch (e) {
      await db.finish(r.id, { status: 'error', usdActual: 0, usage: ZERO_USAGE, model: null });
      log({ event: 'api_error', kind, status: e?.status ?? null });
      return reply(502, { ok: false, error: 'api', id: r.id });
    }
    await db.attachBatch(r.id, batch.id);
    log({ event: 'batch_submitted', kind, requests: requests.length, usd_est: usdEst });
    return reply(200, { ok: true, id: r.id, batch_id: batch.id, requests: requests.length, usd_est: usdEst });
  }

  if (body.action === 'batch_get' || body.action === 'batch_cancel') {
    const batchId = body.batch_id;
    if (typeof batchId !== 'string' || !BATCH_ID_RE.test(batchId)) return reply(400, { ok: false, error: 'batch_id' });
    // この入り口で頼んだバッチだけを扱う(同じキーの、ほかの仕事のバッチは読まない)
    const row = await db.findBatch(batchId);
    if (!row) return reply(404, { ok: false, error: 'not_found' });
    if (body.action === 'batch_cancel') {
      try { await client.messages.batches.cancel(batchId); } catch (e) { return reply(502, { ok: false, error: 'api', status: e?.status ?? null }); }
      log({ event: 'batch_cancel' });
      return reply(200, { ok: true, id: row.id, batch_id: batchId, canceling: true });
    }
    let batch;
    try { batch = await client.messages.batches.retrieve(batchId); } catch (e) { return reply(502, { ok: false, error: 'api', status: e?.status ?? null }); }
    if (batch.processing_status !== 'ended') {
      return reply(200, { ok: true, id: row.id, batch_id: batchId, processing_status: batch.processing_status, request_counts: batch.request_counts ?? null });
    }
    const results = [];
    let usage = ZERO_USAGE, usd = 0;
    const models = new Set();
    try {
      for await (const item of await client.messages.batches.results(batchId)) {
        const res = item?.result;
        if (res?.type === 'succeeded') {
          const m = res.message;
          const u = pickUsage(m?.usage);
          const model = typeof m?.model === 'string' ? m.model : MODEL;
          models.add(model);
          usage = addUsage(usage, u);
          usd += usageUsd(model, u, { batch: true });
          const refused = m?.stop_reason === 'refusal';
          results.push({ custom_id: item.custom_id, type: refused ? 'refused' : 'succeeded', stop_reason: m?.stop_reason ?? null, text: refused ? '' : textOf(m), usage: u });
        } else {
          results.push({ custom_id: item?.custom_id ?? null, type: res?.type ?? 'unknown' });
        }
      }
    } catch (e) {
      return reply(502, { ok: false, error: 'api', status: e?.status ?? null });
    }
    usd = round4(usd);
    const model = [...models].join(',') || null;
    const first = await db.finish(row.id, { status: 'done', usdActual: usd, usage, model });
    if (first) log({ event: 'batch_done', results: results.length, usd, ...usage });
    return reply(200, { ok: true, id: row.id, batch_id: batchId, processing_status: 'ended', request_counts: batch.request_counts ?? null, usage, usd, results });
  }

  return reply(400, { ok: false, error: 'action' });
};
