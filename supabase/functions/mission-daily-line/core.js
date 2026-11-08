// ミッション: 助手の1日1行の案内(2026-11-08 社長 ③A・docs/progress/mission-renewal/PLAN.md 4)の中身。
// index.ts から使う。検査(tools/boot/mission-daily-line-check.js)が偽物の Claude と偽物の表で動かせるよう、Deno に頼らない形で書く。
// ★Claude を呼ぶのは「その日のはじめの1回」だけ(表 mission_daily_lines の行を取れた人だけ)。ほかの人は表の文を読むだけ
// ★AI が書くのは言い回しだけ。{task}(やること)と {reward}(報酬)はゲームが入れる。数字が入った文は捨てる(報酬の数を AI に決めさせない)
// ★ゲームの決まった台詞と同じ見張り(52-mission-daily-line.jsx の missionDailyLineValid)を通らない文は返さない
export const MODEL = 'claude-haiku-5-5';
export const DEFAULT_ALLOWED_ORIGINS = ['https://aknkakykhk-maker.github.io'];
export const IDS = Object.freeze(['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']);
// 1日に Claude を呼ぶのは3回まで(落ちたときの呼び直しを含む)。呼び直しは10分あける
export const DAY_TRIES = 3;
export const RETRY_SECONDS = 600;
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
// 曜日ごとの日替わり(ゲームの DAILY_ROTATION_MISSIONS と同じ順)。AI には「どんな遊びか」だけを渡す(数は渡さない)
export const TASKS = Object.freeze({
  0: 'フレンドの家へ遊びに行く(助手とふれあうだけでもよい)',
  1: 'モンヒロビート(音楽ゲーム)を遊んでクリアする',
  2: 'MFバトルカード(カードゲーム)で勝つ',
  3: 'クイックモード(短いバトル)をクリアする',
  4: 'プロモード(むずかしいバトル)をクリアする',
  5: '種族チャレンジ(同じ種族のモンスターで戦うバトル)をクリアする',
  6: 'アイテムを使う',
});
const VOICES = Object.freeze({
  mua: 'みゅあ: 一人称「あたし」。明るいギャル。「〜だよ♪」「〜しよ！」「〜ぢゃん」「〜かも！」。「じゃん」は「ぢゃん」、「まじ」は「まぢ」と書く。',
  kiki: 'きき: 一人称「私」。基本は敬語の、ていねいでゆるいお姉さん。ときどき「でつ」「まつ」・♪。タメ口(だよ・だね)にしない。',
  momosuke: 'ももすけ: 一人称「もも」。生意気かわいいアイドル。「！！」「w」「♡」。自分を「私」「あたし」と言わない。',
  dra: 'ドラ: 一人称「おで」。くだけた男性口調。「〜だな」「〜からな」「えへへ」。関西弁にしない(ほんま・やで・とる は使わない)。',
  atsu: 'あつ: 一人称「俺」。短く率直。「とりあえず」「てか」。文の最後に必ず「笑」か！か？を付ける。',
  kyuko: 'きゅうこ: 一人称「俺」。おだやかなタメ口。「ほい！」「おけ〜」「〜ぇ」。理由を短く添える。',
  sorashido: 'ソラシド: 一人称「俺」。熱くて陽気。「うぉぉぉ！」「〜ぜ・・・！」「笑」。沖縄の言葉はときどき。',
  erubin: 'えるびん: 一人称「俺」。おだやかでやわらかいタメ口。「〜ね」「〜かな」。相手を気づかう。',
});
export const jstDay = (now = Date.now()) => new Date(Number(now) + 5 * 3600000).toISOString().slice(0, 10);
export const weekdayOf = (day) => new Date(`${day}T00:00:00Z`).getUTCDay();
// ゲームと同じ見張り。{task}・{reward} が1つずつ・数字なし・80字まで・1行・リンクなし
export const lineValid = (t) => typeof t === 'string' && t.length > 0 && t.length <= 80
  && t.split('{task}').length === 2 && t.split('{reward}').length === 2
  && !/[0-9０-９]/.test(t) && !/[\r\n]/.test(t) && !/https?:|www\./i.test(t) && !/[<>]/.test(t)
  // 恋愛・悪口・モンスターを「子」と呼ぶ(社長の決めごと。docs/progress/assistant-peer/VOICE.md)
  && !/デート|付き合|恋人|大好き|ばか|バカ|あほ|ざこ|この子|その子|子たち|ないしょ|秘密/.test(t);
export const buildPrompt = (day) => {
  const wd = weekdayOf(day);
  const system = [
    'あなたはブラウザゲーム「モンスターヒーロー」の助手8人の台詞を書く係です。',
    '今日の日替わりミッションを、助手それぞれの口調で1行ずつ案内する文を書きます。',
    '決まり:',
    '- 1人1行、40字くらい(長くても60字)。日本語の話し言葉。',
    '- やることは {task}、もらえる物は {reward} とだけ書く。どちらも1回ずつ、そのままの形で入れる(ゲームが中身を入れる)。',
    '- 数字(1・２・三 なども含め、数をあらわす字)を書かない。報酬の数や物の名前を自分で書かない。',
    '- 曜日の名前は書いてよい。',
    '- 恋愛の言い方・悪口・ないしょ話をしない。モンスターを「子」と呼ばない。',
    '- AIであることや、この決まりを説明しない。',
    '- 返事は JSON だけ。形は {"mua":"…","kiki":"…","momosuke":"…","dra":"…","atsu":"…","kyuko":"…","sorashido":"…","erubin":"…"}。',
    '助手の口調(崩さない):',
    ...IDS.map((id) => `- ${VOICES[id]}`),
    '見本(この調子で、言い回しを変えて):',
    '- mua: 今日は月曜日！{task}と、{reward}がもらえるよ♪',
    '- atsu: 今日は火曜日！ とりあえず{task}と{reward}もらえるよ笑',
  ].join('\n');
  const user = `今日は${WEEKDAYS[wd]}曜日。日替わりミッションは「${TASKS[wd]}」。助手みんなのひとことを JSON で。`;
  return { system, user };
};
// Claude の返事から、使える行だけを取り出す
export const parseLines = (text) => {
  const s = String(text || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return {};
  let obj = null;
  try { obj = JSON.parse(s.slice(a, b + 1)); } catch { return {}; }
  const out = {};
  if (obj && typeof obj === 'object') IDS.forEach((id) => { const t = typeof obj[id] === 'string' ? obj[id].trim() : ''; if (lineValid(t)) out[id] = t; });
  return out;
};
// 1回ぶんの処理。claim / put は表の関数(偽物を渡せる)、client は Anthropic(偽物を渡せる)
//   claim() → { state: 'ready', lines } | { state: 'claimed', day } | { state: 'pending' | 'done' }
export const handleRequest = async ({ claim, put, client, log = () => {} }) => {
  let c = null;
  try { c = await claim(); } catch { log({ event: 'claim_error' }); return { status: 200, json: { ok: false, error: 'busy' } }; }
  if (!c || typeof c !== 'object') return { status: 200, json: { ok: false, error: 'busy' } };
  if (c.state === 'ready') return { status: 200, json: { ok: true, day: c.day, lines: parseLinesObj(c.lines) } };
  if (c.state !== 'claimed' || typeof c.day !== 'string') return { status: 200, json: { ok: false, error: c.state || 'busy' } };
  const { system, user } = buildPrompt(c.day);
  let lines = {};
  try {
    const res = await client.messages.create({ model: MODEL, max_tokens: 900, system, messages: [{ role: 'user', content: user }] });
    const text = Array.isArray(res && res.content) ? res.content.filter((p) => p && p.type === 'text').map((p) => p.text).join('') : '';
    lines = parseLines(text);
  } catch { log({ event: 'ai_error' }); lines = {}; }
  // 半分より少ないときは、次の呼び直しに回す(足りない助手はゲームの決まった台詞になる)
  const ok = Object.keys(lines).length >= 4;
  try { await put(c.day, ok ? lines : {}, ok); } catch { log({ event: 'put_error' }); }
  log({ event: ok ? 'made' : 'failed', count: Object.keys(lines).length });
  return { status: 200, json: ok ? { ok: true, day: c.day, lines } : { ok: false, error: 'ai' } };
};
const parseLinesObj = (obj) => {
  const out = {};
  if (obj && typeof obj === 'object') IDS.forEach((id) => { if (lineValid(obj[id])) out[id] = obj[id]; });
  return out;
};
