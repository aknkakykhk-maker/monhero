// MFバトルカード: 助手の手を外のAI(Claude Haiku 5.5)に選ばせる試し(2026-10-25 統括部長の依頼)。本番のゲームには組み込まない。
// index.ts(Deno の入口)から呼ぶ。Claude のクライアントは外から渡すので、
// 試合を回す道具(tools/card/card-ai-trial.js --fake)は偽物を渡して、本番の API を叩かずに確かめられる。
//
// 受け取るもの: ルールのあとに置く札の説明(cards)・助手のくせ(persona)・いまの場面(state)・使える手の一覧(moves)・
//   今のAIが選ぶ手の番号(fallback)・考える深さ(effort: low / medium)
// 返すもの: 選んだ番号(pick)・ひとことの理由(reason)・考えた中身の要約(thinking)・かかった時間(ms)・使ったトークン(usage)・
//   今のAIの手に置きかえたか(fallback: true のとき why に理由)
//
// ★合言葉(x-trial-token)と鍵(ANTHROPIC_API_KEY)はログにも返事にも書かない。場面の本文もログに書かない

export const MODEL = 'claude-haiku-5-5';
// 考える分も max_tokens に入る。答えは1行なので、ほとんどは考える分
export const MAX_TOKENS = 3000;
export const TIMEOUT_MS = 8000;
export const TIMEOUT_MS_MAX = 20000;
// 1回に送ってよい大きさ
export const MAX_BODY_CHARS = 80000;
export const MAX_CARDS_CHARS = 50000;
export const MAX_PERSONA_CHARS = 400;
export const MAX_STATE_CHARS = 6000;
export const MAX_MOVES = 60;
export const MAX_MOVE_CHARS = 200;
// 返す中身の長さ
export const MAX_REASON_CHARS = 120;
export const MAX_THINKING_CHARS = 800;
export const EFFORTS = Object.freeze(['low', 'medium']);

// 先頭の動かない部分(1文字でも変えるとキャッシュが外れる。日付や回数を入れない)
export const RULES = `あなたはカードゲーム「MFバトルカード」(モンスターヒーロー版)の対戦相手です。使える手の一覧から、勝つためにいちばん良い手を1つ選びます。

【ルールの要点】
- 両者モンスター3体。相手の3体を全員倒す(ライフ0以下)か、相手が引くときに山札が無ければ勝ち。
- 自分のターン: ドロー(手札5枚まで。5枚なら山札の上をガッツに)→ 攻撃 → 手札から好きな枚数をガッツにする → 終わり。
- 攻撃: 各モンスターは1ターンに攻撃の技(ちから・かしこさ・特殊)を1枚まで。技はカードに書いた種族の子だけが使える(「全モンスター」は誰でも)。ブリーダーカードは1ターンに1枚まで。
- 技を使うにはカードに書いたガッツを払う。ガッツはプレイヤーごとに持つ。ガッツにしたカードは技として使えない。
- 攻撃を受けた側は、回避・防御のカードを重ねて出せる(ガッツが足りる限り)。専用の守りは狙われた子だけ、「全モンスター」の守りは狙われた子が使える。特殊技はふつうの防御・回避では守れない。
- 守りに使ったガッツは、次の自分のターンの攻撃にも響く。ガッツを残すか、いま使うかが大事。
- 「全ての相手モンスター」の技は1体ずつ守るかどうかを選ぶ。回避されても半分の技は端数切り上げ。
- 空中・地上・水中の特徴にふれる技は、その文のとおり。KOした子は技を使えない。
- カードの文は、このルールより優先する。

【答え方】
考えたあと、最後に次の1行だけを書く(ほかの文は書かない)。
{"pick": 手の番号, "reason": "ひとことの理由(40字まで)"}`;

const clip = (s, n) => (typeof s === 'string' ? s.slice(0, n) : '');
const isInt = (n) => Number.isInteger(n);

// 合言葉をくらべる(長さが違っても、くらべる時間をそろえる)
export const tokenOk = (given, expected) => {
  if (typeof expected !== 'string' || expected.length < 8 || typeof given !== 'string') return false;
  const a = new TextEncoder().encode(given), b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i % (a.length || 1)] ?? 0) ^ b[i];
  return diff === 0;
};

// 送られてきた中身を確かめる。だめなら { error }
export const normalizeInput = (body) => {
  if (!body || typeof body !== 'object') return { error: 'body' };
  const moves = Array.isArray(body.moves) ? body.moves : null;
  if (!moves || moves.length < 1 || moves.length > MAX_MOVES || !moves.every((m) => typeof m === 'string' && m.length <= MAX_MOVE_CHARS)) return { error: 'moves' };
  if (typeof body.state !== 'string' || !body.state || body.state.length > MAX_STATE_CHARS) return { error: 'state' };
  if (typeof body.cards !== 'string' || body.cards.length > MAX_CARDS_CHARS) return { error: 'cards' };
  if (body.persona !== undefined && (typeof body.persona !== 'string' || body.persona.length > MAX_PERSONA_CHARS)) return { error: 'persona' };
  const fallback = isInt(body.fallback) && body.fallback >= 0 && body.fallback < moves.length ? body.fallback : 0;
  const effort = EFFORTS.includes(body.effort) ? body.effort : 'low';
  return { moves, state: body.state, cards: body.cards, persona: body.persona || '', fallback, effort };
};

// Claude へ送る中身。system の前2つ(ルール・札の説明)は試合のあいだ変わらないので、札の説明の終わりでキャッシュする
export const buildRequest = (inp) => ({
  model: MODEL,
  max_tokens: MAX_TOKENS,
  thinking: { type: 'adaptive', display: 'summarized' },
  output_config: { effort: inp.effort },
  system: [
    { type: 'text', text: RULES },
    { type: 'text', text: `【あなたのくせ】\n${inp.persona || 'くせは無い。ふつうに強い手を選ぶ。'}\n\n【この試合に出てくる札】\n${inp.cards}`, cache_control: { type: 'ephemeral' } },
  ],
  messages: [{
    role: 'user',
    content: `【いまの場面】\n${inp.state}\n\n【使える手】\n${inp.moves.map((m, i) => `${i}: ${m}`).join('\n')}`,
  }],
});

// 答えの1行を読む。読めなければ null
export const parseAnswer = (text, n) => {
  const all = [...String(text || '').matchAll(/\{[^{}]*"pick"[^{}]*\}/g)];
  for (let k = all.length - 1; k >= 0; k--) {
    try {
      const j = JSON.parse(all[k][0]);
      if (isInt(j.pick) && j.pick >= 0 && j.pick < n) return { pick: j.pick, reason: clip(String(j.reason ?? ''), MAX_REASON_CHARS) };
      return null; // 一覧に無い番号
    } catch (_) { /* 次の候補へ */ }
  }
  return null;
};

const usageOf = (u) => ({
  input: u?.input_tokens ?? 0,
  output: u?.output_tokens ?? 0,
  cacheRead: u?.cache_read_input_tokens ?? 0,
  cacheWrite: u?.cache_creation_input_tokens ?? 0,
});

// 1手を選ぶ。失敗しても例外を投げず、今のAIの手(fallback)を返す
export const chooseMove = async (inp, { client, timeoutMs = TIMEOUT_MS, now = () => Date.now() }) => {
  const t0 = now();
  const fail = (why, extra = {}) => ({ pick: inp.fallback, reason: '', thinking: '', fallback: true, why, ms: now() - t0, usage: usageOf(null), ...extra });
  let res;
  try {
    res = await client.messages.create(buildRequest(inp), { timeout: Math.min(timeoutMs, TIMEOUT_MS_MAX) });
  } catch (e) {
    const name = String(e?.name || e?.constructor?.name || '');
    return fail(/Timeout/i.test(name) ? 'timeout' : e?.status ? `api_${e.status}` : 'error');
  }
  const ms = now() - t0;
  const usage = usageOf(res?.usage);
  const blocks = Array.isArray(res?.content) ? res.content : [];
  const thinking = clip(blocks.filter((b) => b.type === 'thinking').map((b) => b.thinking || '').join('\n').trim(), MAX_THINKING_CHARS);
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text || '').join('\n');
  if (res?.stop_reason === 'refusal') return { ...fail('refusal'), ms, usage, thinking };
  const ans = parseAnswer(text, inp.moves.length);
  if (!ans) return { ...fail(res?.stop_reason === 'max_tokens' ? 'max_tokens' : 'invalid'), ms, usage, thinking };
  if (ms > timeoutMs) return { ...fail('timeout'), ms, usage, thinking, late: ans.pick };
  return { pick: ans.pick, reason: ans.reason, thinking, fallback: false, why: null, ms, usage };
};

// 入口の中身。req は { method, token, bodyText }。返すのは { status, body }
export const handleRequest = async (req, { client, expectedToken, timeoutMs, now }) => {
  if (req.method !== 'POST') return { status: 405, body: { error: 'method' } };
  if (!expectedToken) return { status: 503, body: { error: 'closed' } };
  if (!tokenOk(req.token, expectedToken)) return { status: 401, body: { error: 'token' } };
  if (typeof req.bodyText !== 'string' || req.bodyText.length > MAX_BODY_CHARS) return { status: 413, body: { error: 'size' } };
  let body;
  try { body = JSON.parse(req.bodyText); } catch (_) { return { status: 400, body: { error: 'json' } }; }
  const inp = normalizeInput(body);
  if (inp.error) return { status: 400, body: { error: inp.error } };
  const out = await chooseMove(inp, { client, timeoutMs, now });
  return { status: 200, body: { ...out, model: MODEL, effort: inp.effort } };
};
