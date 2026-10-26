// 判定の異変を毎日報告する(2026-10-16 社長の決定)の中身。Supabase Edge Function(Deno)から使う。
// 入口は index.ts。ここは Claude と DB を受け取って動くだけなので、検査(tools/mode/rhythm-anomaly-report-check.js)から
// 偽物の Claude・偽物の DB で動かせる。
//
// 流れ:
//   ① 合言葉(x-cron-token)を DB の rhythm_anomaly_token_ok で照らす。違えば 403(合言葉の値はこの関数も知らない)
//   ② 対象の日(?day=YYYY-MM-DD・無ければ日本時間の昨日)の集計を rhythm_anomaly_facts で受け取る
//   ③ 異変が0件で、端末の種類ごとの MISS 率も急に上がっていなければ、Claude を呼ばずに quiet で書く(費用0)
//   ④ そうでなければ Claude Haiku 5.5 を1回呼んで、短い日本語の報告にする
//   ⑤ rhythm_anomaly_reports へ1日1行で書く(同じ日は上書き)
// ★集計に個人を特定できるものは入っていない(device_key・名前・ブリーダーID は SQL の時点で外している)。
//   それでも念のため、渡す前に device_key などの欄が無いことを確かめる
export const MODEL = 'claude-haiku-5-5';
export const MAX_TOKENS = 4000;
export const MAX_SUMMARY_CHARS = 1200;
export const QUIET_SUMMARY = '目立った変化はありませんでした。';
// 端末の種類ごとの全体が「急に上がった」とみなす目安(その日10回以上・前の7日の1.5倍以上・1ポイント以上)
const PLATFORM_MIN_PLAYS = 10, PLATFORM_RATIO = 1.5, PLATFORM_DIFF = 0.01;
const FORBIDDEN_KEYS = ['device_key', 'breeder_id', 'breeder_name', 'player_name', 'user_id'];

export const SYSTEM = [
  'あなたは音楽ゲーム「モンヒロビート」の判定の見張り役です。',
  '渡される JSON は、日本時間の前日(day)と、その前の7日間の演奏の集計です。',
  '列の意味:',
  '- platforms: 端末の種類(ios / android)ごとの全体。miss_rate=MISS÷ノーツ数、no_input_rate=何も押していないのに MISS になった率(見落としかタッチの抜け)、late_rate=タッチが遅れて届いた率、slow_per_1000=34ms を超えたコマの数(1,000コマあたり)。_day が前日、_base が前の7日。',
  '- flagged: 前日に MISS 率が前の7日より目立って上がった「曲×難易度×端末の種類」。miss_by_5pct_* は、曲のはじめからノーツの順に5%ずつ20区間に分けた MISS の数(day は前日、base は前の7日の合計。logs_* はその回数)。',
  '- builds_day: 前日に遊ばれたゲームの版(公開した日時)。',
  '- mashed_excluded_day: 1ノーツあたりのタッチが5回を超える連打のプレイを、集計から外した数(この数は本文に別に1行足すので、触れなくてよい)。',
  '書くこと:',
  '- いつもと違う所を3つまで、多い順に。曲・難易度・端末の種類・曲のどのあたり(◯〜◯%)かを書く。',
  '- 考えられる原因を短く(新しい版のあとか・特定の端末だけか・何も押していない MISS が多いか・特定の区間に集まっているか)。',
  '- 数字は表にあるものだけを使う。推測は「〜かもしれません」と書く。回数が少ないときはそう書く。',
  '- 日本語で、600字まで。見出しや表は使わず、短い箇条書きで。',
].join('\n');

// 日本時間の「昨日」(YYYY-MM-DD)
export const jstYesterday = (now = new Date()) => {
  const t = new Date(now.getTime() + 9 * 3600 * 1000);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
};
export const validDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
  && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const num = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));
export const platformJump = (facts) => (Array.isArray(facts?.platforms) ? facts.platforms : []).some((p) => {
  const day = num(p?.miss_rate_day), base = num(p?.miss_rate_base);
  return num(p?.plays_day) >= PLATFORM_MIN_PLAYS && Number.isFinite(day) && Number.isFinite(base)
    && day >= base * PLATFORM_RATIO && day - base >= PLATFORM_DIFF;
});
// 連打の多いプレイを集計から外した数(2026-10-19 社長の決定・rhythm_anomaly_facts の mashed_excluded_day)。外した日だけ本文に1行足す
export const mashedLine = (facts) => {
  const n = num(facts?.mashed_excluded_day);
  return Number.isFinite(n) && n > 0 ? `連打の多いプレイ${Math.round(n)}件を除いた。` : '';
};
const withMashed = (summary, facts) => { const line = mashedLine(facts); return line ? `${summary}\n${line}` : summary; };
const hasForbiddenKey = (value) => {
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  if (value && typeof value === 'object') return Object.keys(value).some((k) => FORBIDDEN_KEYS.includes(k) || hasForbiddenKey(value[k]));
  return false;
};

const reply = (status, json) => ({ status, json });

// token: x-cron-token の値 / day: ?day= の値(無ければ null)
// tokenOk(token) → boolean / loadFacts(day) → 集計 JSON / save(row) → 書く / client: Anthropic / log(entry)
export const runReport = async ({ token, day, tokenOk, loadFacts, save, client, log = () => {}, now = new Date() }) => {
  let allowed = false;
  if (typeof token === 'string' && token.length > 0) {
    try { allowed = (await tokenOk(token)) === true; } catch { allowed = false; }
  }
  if (!allowed) { log({ event: 'forbidden' }); return reply(403, { ok: false, error: 'forbidden' }); }
  if (day !== null && day !== undefined && day !== '' && !validDay(day)) return reply(400, { ok: false, error: 'day' });
  const target = day ? day : jstYesterday(now);
  const base = { report_date: target, flagged_count: 0, summary: null, model: null, input_tokens: null, output_tokens: null };

  let facts;
  try { facts = await loadFacts(target); } catch { facts = null; }
  if (!facts || typeof facts !== 'object') {
    await save({ ...base, status: 'error', facts: { error: 'facts' } });
    log({ event: 'error', day: target, reason: 'facts' });
    return reply(500, { ok: false, error: 'facts', day: target });
  }
  const flagged = Array.isArray(facts.flagged) ? facts.flagged.length : 0;
  if (hasForbiddenKey(facts)) {
    await save({ ...base, status: 'error', flagged_count: flagged, facts: { error: 'forbidden_key' } });
    log({ event: 'error', day: target, reason: 'forbidden_key' });
    return reply(500, { ok: false, error: 'forbidden_key', day: target });
  }
  if (flagged === 0 && !platformJump(facts)) {
    await save({ ...base, status: 'quiet', summary: withMashed(QUIET_SUMMARY, facts), facts });
    log({ event: 'saved', day: target, status: 'quiet', flagged });
    return reply(200, { ok: true, day: target, status: 'quiet', flagged });
  }

  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // 数字の表を読んで短くまとめるだけなので軽く(Haiku 5.5 の考える量は effort で決まる)
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(facts) }],
    });
  } catch (e) {
    await save({ ...base, status: 'error', flagged_count: flagged, facts, model: MODEL });
    log({ event: 'error', day: target, reason: 'api', type: e?.constructor?.name || 'Error', httpStatus: e?.status ?? null });
    return reply(502, { ok: false, error: 'api', day: target });
  }
  const usage = { input_tokens: response?.usage?.input_tokens ?? null, output_tokens: response?.usage?.output_tokens ?? null };
  // Haiku 5.5 は断られたときに別のモデルへ回す仕組みが無い。数字の表だけ残す
  if (response?.stop_reason === 'refusal') {
    await save({ ...base, status: 'refused', flagged_count: flagged, facts, model: MODEL, ...usage });
    log({ event: 'saved', day: target, status: 'refused', flagged, category: response?.stop_details?.category ?? null });
    return reply(200, { ok: true, day: target, status: 'refused', flagged });
  }
  const text = (Array.isArray(response?.content) ? response.content : [])
    .filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('').trim().slice(0, MAX_SUMMARY_CHARS);
  if (!text) {
    await save({ ...base, status: 'error', flagged_count: flagged, facts, model: MODEL, ...usage });
    log({ event: 'error', day: target, reason: 'empty', stop: response?.stop_reason ?? null });
    return reply(502, { ok: false, error: 'empty', day: target });
  }
  const summary = withMashed(text, facts);
  await save({ ...base, status: 'ok', flagged_count: flagged, summary, facts, model: MODEL, ...usage });
  // 報告の本文にも個人の情報は無い(集計の数字だけから書いている)ので、確かめやすいようにログへも出す
  log({ event: 'saved', day: target, status: 'ok', flagged, ...usage, summary });
  return reply(200, { ok: true, day: target, status: 'ok', flagged });
};
