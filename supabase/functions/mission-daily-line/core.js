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
// ゲームと同じ見張り(52-mission-daily-line.jsx の missionDailyLineValid とそろえる)。{task}・{reward} が1つずつ・数字なし・90字まで・1行・リンクなし
export const LINE_MAX = 90;
const NG_WORDS = /デート|付き合|恋人|大好き|ばか|バカ|あほ|ざこ|この子|その子|子たち|ないしょ|秘密/;
// 使えない理由(使えるなら '')。ログには理由の数だけ出す(本文は出さない)
export const lineProblem = (t) => {
  if (typeof t !== 'string' || !t) return 'empty';
  if (/[\r\n]/.test(t)) return 'newline';
  if (/[0-9０-９]/.test(t)) return 'number';
  if (/https?:|www\./i.test(t) || /[<>]/.test(t)) return 'link';
  if (NG_WORDS.test(t.split('{task}').join('').split('{reward}').join(''))) return 'word';
  if (t.split('{task}').length !== 2 || t.split('{reward}').length !== 2) return 'missing_slot';
  if (t.length > LINE_MAX) return 'too_long';
  return '';
};
export const lineValid = (t) => lineProblem(t) === '';
// 返事の崩れをならす(2026-11-08 本番の1回目で「返事は来たが使える行が0本」だったため)。
//   ・{task}・{reward} の書き方の揺れ(全角のかっこ・空白・大文字・【】・<>・「{task}」の外の「」はそのまま)をそろえる
//   ・同じ穴を2回書いたら、2回目から後ろは消す
//   ・穴が無い行は、行の後ろに「({task}と{reward})」を足す(数字の入った文は今までどおり捨てる)
const SLOT_FORMS = { task: /[{｛【<＜(（]\s*(?:task|TASK|Task|タスク|やること)\s*[}｝】>＞)）]/g, reward: /[{｛【<＜(（]\s*(?:reward|REWARD|Reward|リワード|報酬)\s*[}｝】>＞)）]/g };
export const tidyLine = (raw) => {
  if (typeof raw !== 'string') return '';
  let t = raw.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/^["'「『]+|["'」』]+$/g, '').trim();
  t = t.replace(SLOT_FORMS.task, '{task}').replace(SLOT_FORMS.reward, '{reward}');
  for (const slot of ['{task}', '{reward}']) {
    const parts = t.split(slot);
    if (parts.length > 2) t = parts[0] + slot + parts.slice(1).join('');
  }
  const hasTask = t.includes('{task}'), hasReward = t.includes('{reward}');
  if (!hasTask && !hasReward) t = `${t}({task}と{reward})`;
  else if (!hasTask) t = `${t}({task})`;
  else if (!hasReward) t = `${t}({reward})`;
  return t;
};
export const buildPrompt = (day) => {
  const wd = weekdayOf(day);
  const system = [
    'あなたはブラウザゲーム「モンスターヒーロー」の助手8人の台詞を書く係です。',
    '今日の日替わりミッションを、助手それぞれの口調で1行ずつ案内する文を書きます。',
    '決まり:',
    '- 1人1行、40字くらい(長くても60字)。日本語の話し言葉。',
    '- やることは {task}、もらえる物は {reward} とだけ書く。どちらも1回ずつ、半角の波かっこごと、そのままの形で入れる(ゲームが中身を入れる)。',
    '- 日付・回数・時刻も書かない(曜日は「月曜日」のように字で書く)。',
    '- 数字(1・２・三 なども含め、数をあらわす字)を書かない。報酬の数や物の名前を自分で書かない。',
    '- 曜日の名前は書いてよい。',
    '- 恋愛の言い方・悪口・ないしょ話をしない。モンスターを「子」と呼ばない。',
    '- AIであることや、この決まりを説明しない。',
    '- 返事は JSON だけ。形は {"mua":"…","kiki":"…","momosuke":"…","dra":"…","atsu":"…","kyuko":"…","sorashido":"…","erubin":"…"}。',
    '- JSON の前後に説明やかっこ(```)を付けない。キーは上の英字のまま、8人全員ぶん。',
    '助手の口調(崩さない):',
    ...IDS.map((id) => `- ${VOICES[id]}`),
    '見本(この調子で、言い回しを変えて):',
    '- mua: 今日は月曜日！{task}と、{reward}がもらえるよ♪',
    '- atsu: 今日は火曜日！ とりあえず{task}と{reward}もらえるよ笑',
  ].join('\n');
  const user = `今日は${WEEKDAYS[wd]}曜日。日替わりミッションは「${TASKS[wd]}」。助手みんなのひとことを JSON で。`;
  return { system, user };
};
// 助手の名前の書き方の揺れ(キーが日本語・大文字のとき)
const NAME_KEYS = Object.freeze({ mua: ['mua', 'みゅあ', 'myua', 'miyua'], kiki: ['kiki', 'きき'], momosuke: ['momosuke', 'ももすけ', 'もも', 'momo'],
  dra: ['dra', 'ドラ', 'どら'], atsu: ['atsu', 'あつ'], kyuko: ['kyuko', 'きゅうこ', 'kyuuko'], sorashido: ['sorashido', 'ソラシド', 'そらしど'], erubin: ['erubin', 'えるびん', 'エルビン'] });
const idOfKey = (k) => { const low = String(k || '').trim().toLowerCase(); return IDS.find((id) => NAME_KEYS[id].some((n) => n.toLowerCase() === low)) || null; };
// 返事の文から「助手id → 文」を取り出す。JSON の外の説明・```json の囲み・配列・名前の揺れ・途中で切れた JSON も読む
export const extractRaw = (text) => {
  const s = String(text || '').replace(/```(?:json|JSON)?/g, '');
  const out = {};
  const take = (k, v) => { const id = idOfKey(k); if (id && typeof v === 'string' && !out[id]) out[id] = v; };
  const walk = (o) => {
    if (Array.isArray(o)) o.forEach((x) => {
      if (x && typeof x === 'object') { const k = x.id ?? x.assistant ?? x.assistantId ?? x.name ?? x.who; const v = x.line ?? x.text ?? x.message ?? x.t; if (k != null && typeof v === 'string') take(k, v); else walk(x); }
    });
    else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => { if (typeof v === 'string') take(k, v); else if (v && typeof v === 'object') walk(v); });
  };
  // 1) いちばん外の { … } / [ … ] を JSON として読む
  for (const [open, close] of [['{', '}'], ['[', ']']]) {
    const a = s.indexOf(open), b = s.lastIndexOf(close);
    if (a >= 0 && b > a) { try { walk(JSON.parse(s.slice(a, b + 1))); } catch { /* 下で1行ずつ */ } }
  }
  // 2) 読めなかった助手は「"キー": "文"」を1つずつ拾う(途中で切れた返事・JSON の外の説明つきでも読める)
  const re = /["']?([A-Za-zぁ-んァ-ヶー]{2,12})["']?\s*[:：]\s*"((?:[^"\\\n]|\\.)*)"/g;
  let m;
  while ((m = re.exec(s))) { let v = m[2]; try { v = JSON.parse(`"${m[2]}"`); } catch { /* そのまま */ } take(m[1], v); }
  return out;
};
// 使える行と、落ちた理由の数(本文は持たない)
export const parseLinesDetail = (text) => {
  const raw = extractRaw(text);
  const lines = {}, reasons = {};
  const bump = (k) => { reasons[k] = (reasons[k] || 0) + 1; };
  if (!Object.keys(raw).length) bump(String(text || '').includes('{') ? 'no_json' : 'no_reply');
  IDS.forEach((id) => {
    if (!(id in raw)) { if (Object.keys(raw).length) bump('missing_assistant'); return; }
    const t = tidyLine(raw[id]);
    const why = lineProblem(t);
    if (why) bump(why); else lines[id] = t;
  });
  return { lines, reasons };
};
export const parseLines = (text) => parseLinesDetail(text).lines;
// 1回ぶんの処理。claim / put は表の関数(偽物を渡せる)、client は Anthropic(偽物を渡せる)
//   claim() → { state: 'ready', lines } | { state: 'claimed', day } | { state: 'pending' | 'done' }
// 1行でも使えれば ready にする(使えなかった助手だけ、ゲームの決まった台詞になる)
export const handleRequest = async ({ claim, put, client, log = () => {} }) => {
  let c = null;
  try { c = await claim(); } catch { log({ event: 'claim_error' }); return { status: 200, json: { ok: false, error: 'busy' } }; }
  if (!c || typeof c !== 'object') return { status: 200, json: { ok: false, error: 'busy' } };
  if (c.state === 'ready') return { status: 200, json: { ok: true, day: c.day, lines: parseLinesObj(c.lines) } };
  if (c.state !== 'claimed' || typeof c.day !== 'string') return { status: 200, json: { ok: false, error: c.state || 'busy' } };
  const { system, user } = buildPrompt(c.day);
  let lines = {}, reasons = {}, stop = '';
  try {
    const res = await client.messages.create({ model: MODEL, max_tokens: 2000, system, messages: [{ role: 'user', content: user }] });
    stop = res && typeof res.stop_reason === 'string' ? res.stop_reason : '';
    const text = Array.isArray(res && res.content) ? res.content.filter((p) => p && p.type === 'text').map((p) => p.text).join('') : '';
    ({ lines, reasons } = parseLinesDetail(text));
  } catch { log({ event: 'ai_error' }); lines = {}; reasons = { ai_error: 1 }; }
  const ok = Object.keys(lines).length >= 1;
  try { await put(c.day, ok ? lines : {}, ok); } catch { log({ event: 'put_error' }); }
  // 本文は出さない。使えた数・落ちた理由の数・返事の止まり方(max_tokens で切れたか)だけ
  log({ event: ok ? 'made' : 'failed', count: Object.keys(lines).length, reasons, stop });
  return { status: 200, json: ok ? { ok: true, day: c.day, lines } : { ok: false, error: 'ai' } };
};
const parseLinesObj = (obj) => {
  const out = {};
  if (obj && typeof obj === 'object') IDS.forEach((id) => { if (lineValid(obj[id])) out[id] = obj[id]; });
  return out;
};
