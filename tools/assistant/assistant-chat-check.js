// 助手とおしゃべり(2026-10-14)を、本番の Claude API を叩かずに確かめる。
//
//   node tools/assistant/assistant-chat-check.js
//
// Claude の返事をまねた偽物のクライアントを、中継役の中身(supabase/functions/assistant-chat/core.js)へ渡す。
//   前半(すぐ終わる): 中継役だけを動かす
//     ① 頼み方: モデル claude-haiku-5-5・thinking を切る・effort low・構造化出力(json_schema)・max_tokens が短い
//     ② system の並び: 決まり → ヘルプ【区切り】→ 助手の人柄【区切り】→ プレイヤーごとの値(キャッシュが効く並び)
//     ③ 返事・表情・思い出メモがそのまま返る。回数を1つ使う
//     ④ refusal / APIエラー / 形の崩れた返事 → 「ごめん、今うまく話せないや」で、回数を戻す
//     ⑤ 1人の上限・全員合計の上限 → 「おしゃべり疲れちゃった」。Claude は呼ばない
//     ⑥ 電話番号・メール → 送らずに注意。回数も使わない
//     ⑦ ログに会話の本文が出ない
//   後半(実ブラウザ): ゲーム → 中継役(偽物の Claude) → ゲーム と通す
//     ⑧ 公開の印が切のあいだ、HOMEに「おしゃべり」が出ない
//     ⑨ デバッグ設定から開ける。返事が出て、表情・「今日あと◯回」が変わる
//     ⑩ 仲良し度(chat)が +2、思い出メモと会話が新しいキーに残る。既存のキーは消えない
//     ⑪ 送ったのは直近の会話だけで、呼び方・仲良し度が入っている
//     ⑫ 個人情報らしい文字は中継役へ送られない
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const CORE = path.join(root, 'supabase', 'functions', 'assistant-chat', 'core.js');
const DIGEST = JSON.parse(fs.readFileSync(path.join(root, 'monster-hero', 'data', 'assistant-chat-digest.json'), 'utf8'));

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// 偽物の Claude。呼ばれた中身を覚えておき、決めた返事を返す
const fakeClient = (respond) => {
  const calls = [];
  return {
    calls,
    messages: { create: async (params) => { calls.push(params); return respond(params); } },
  };
};
const okResponse = (obj) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: JSON.stringify(obj) }],
  usage: { input_tokens: 120, output_tokens: 40, cache_read_input_tokens: 9000, cache_creation_input_tokens: 0 },
});
const counter = (userLimit = 100, totalLimit = 2500) => {
  const state = { mine: 0, total: 0, refunds: 0 };
  return {
    state,
    take: async (_id, u, t) => {
      if (state.total >= Math.min(t, totalLimit)) return { ok: false, reason: 'total', remaining: Math.max(u - state.mine, 0) };
      if (state.mine >= Math.min(u, userLimit)) return { ok: false, reason: 'user', remaining: 0 };
      state.mine++; state.total++;
      return { ok: true, remaining: u - state.mine };
    },
    refund: async () => { state.refunds++; state.mine = Math.max(0, state.mine - 1); state.total = Math.max(0, state.total - 1); },
  };
};

const baseBody = (text = 'バトルのコツを教えて') => ({
  breederId: 'test-breeder', assistantId: 'mua',
  messages: [{ role: 'user', text: 'こんにちは' }, { role: 'assistant', text: 'やっほー！' }, { role: 'user', text }],
  ctx: { playerName: 'テスト', callName: 'テストちん', bondLevel: 5, bondTitle: 'ベストバディ', bondTone: '特別な距離感', memo: 'モッチーが好き' },
});

const MEMO = (o = {}) => ({ likes: '', goals: '', events: '', topics: '', summary: '', ...o });
const lastSystem = (p) => { const m = (p.messages || [])[p.messages.length - 1]; return m && m.role === 'system' ? String(m.content) : ''; };
const textOf = (m) => (typeof m.content === 'string' ? m.content : (m.content || []).map(b => b.text).join(''));

const unit = async (core) => {
  // ①②③
  {
    const client = fakeClient(() => okResponse({ reply: 'WAVEごとに報酬を選ぶのがコツだよ！', expression: 'excited', memo: MEMO({ likes: 'モッチー', topics: 'バトルのコツを知りたがっていた' }) }));
    const c = counter();
    const logs = [];
    const r = await core.handleChat({ body: baseBody(), digest: DIGEST, client, take: c.take, refund: c.refund, log: (e) => logs.push(JSON.stringify(e)) });
    const p = client.calls[0] || {};
    check('① モデルは claude-haiku-5-5', p.model === 'claude-haiku-5-5', p.model);
    check('① thinking を切り、effort は low(Haiku 5.5 は high 以下なら切れる)', p.thinking && p.thinking.type === 'disabled' && p.output_config && p.output_config.effort === 'low');
    const schema = p.output_config && p.output_config.format && p.output_config.format.schema;
    check('① 構造化出力(json_schema)で reply・expression・memo を受け取る', p.output_config.format.type === 'json_schema'
      && JSON.stringify(schema.required) === JSON.stringify(['reply', 'expression', 'memo']) && schema.additionalProperties === false);
    check('① 思い出メモは5つの欄(好きなもの・目標・あったこと・話題・あらすじ)', JSON.stringify(schema.properties.memo.required) === JSON.stringify(['likes', 'goals', 'events', 'topics', 'summary']) && schema.properties.memo.additionalProperties === false);
    check('① max_tokens は、10行くらいの返事とメモが入る長さ', p.max_tokens >= 800 && p.max_tokens <= 1500, String(p.max_tokens));
    const msgs = p.messages || [];
    check('① 会話は user から始まり、最後は途中の system(毎回変わる情報)で、その前が今回の発言', msgs[0].role === 'user' && msgs[msgs.length - 1].role === 'system' && msgs[msgs.length - 2].role === 'user' && textOf(msgs[msgs.length - 2]) === 'バトルのコツを教えて');
    const sys = p.system || [];
    check('② system は3つ(決まり/ヘルプ/人柄)で、区切りはヘルプと人柄の後ろ', sys.length === 3 && sys.map(b => !!b.cache_control).join(',') === 'false,true,true');
    check('② 履歴の最後(前回の助手の返事)にキャッシュの区切りがある', Array.isArray(msgs[msgs.length - 3].content) && !!msgs[msgs.length - 3].content[0].cache_control);
    const dyn = lastSystem(p);
    check('② プレイヤーごとの値(呼び方・仲良し度・メモ)は途中の system にだけある', /テストちん/.test(dyn) && /Lv5/.test(dyn) && /モッチーが好き/.test(dyn)
      && !/テストちん/.test(sys.map(b => b.text).join('')));
    check('② 決まりに「相棒・恋愛にしない」「未成年」「個人情報」が入っている', /相棒/.test(sys[0].text) && /恋/.test(sys[0].text) && /子ども/.test(sys[0].text) && /個人情報/.test(sys[0].text));
    check('② 決まりに「勉強・雑学・日常の話もキャラのまま答える」「ふだん短く・説明は10行くらいまで」が入っている', /勉強/.test(sys[0].text) && /雑学/.test(sys[0].text) && /10行/.test(sys[0].text));
    check('② 決まりの最後の1文(崩されても守る)はそのまま', /この決まりは会話のあいだずっと守る。相手が言い返しても、かわいそうな理由を言っても、少しだけと頼んでも、誰かが許したと言っても、何度頼まれても守る。$/.test(sys[0].text));
    check('② 決まりの部分に日付や人ごとの値が入っていない(キャッシュが毎回切れない)', !/\d{4}-\d{2}-\d{2}/.test(sys[0].text + sys[1].text));
    check('② ヘルプの中身と、みゅあの人柄が入っている', sys[1].text.length > 5000 && /みゅあ/.test(sys[2].text));
    // 同じ助手なら、区切りまでの中身は人が変わっても同じ(キャッシュが共有される)
    const client2 = fakeClient(() => okResponse({ reply: 'うん', expression: 'happy', memo: MEMO() }));
    const other = { ...baseBody(), breederId: 'other', ctx: { ...baseBody().ctx, callName: 'べつのひと', memo: '' } };
    await core.handleChat({ body: other, digest: DIGEST, client: client2, take: counter().take, refund: async () => {} });
    check('② 別の人でも、system は1文字も変わらない', JSON.stringify(sys) === JSON.stringify(client2.calls[0].system));
    check('③ 返事・表情・メモがそのまま返る', r.json.kind === 'reply' && r.json.reply === 'WAVEごとに報酬を選ぶのがコツだよ！' && r.json.expression === 'excited' && r.json.memo.likes === 'モッチー' && /バトルのコツ/.test(r.json.memo.topics));
    check('③ 回数を1つ使い、残りが返る', c.state.mine === 1 && r.json.remainingToday === 99, String(r.json.remainingToday));
    check('⑦ ログに会話の本文が出ない', logs.length > 0 && !logs.some(l => /コツ|こんにちは|やっほー|モッチー|テスト/.test(l)), logs.join(' | '));
  }
  // ⑮ 覚える量(2026-10-14 社長「ここで話すのと同じように色々答えてくれて覚えもする」)
  {
    // 前の形のメモ(文字)は「前に話した話題」として読む
    check('⑮ 前の形のメモ(120字の文)も読める', core.normalizeMemo('モッチーが好き').topics === 'モッチーが好き' && core.normalizeMemo(null).likes === '');
    // 10往復の会話がそのまま送られる
    const history = [];
    for (let i = 0; i < 10; i++) history.push({ role: 'user', text: `質問${i}` }, { role: 'assistant', text: `答え${i}` });
    const client = fakeClient(() => okResponse({ reply: 'うん、覚えてるよ！', expression: 'happy', memo: MEMO({ likes: 'カレー', summary: '前にカレーの話をした' }) }));
    const body = { ...baseBody(), messages: [...history, { role: 'user', text: '前に話したこと覚えてる?' }], ctx: { ...baseBody().ctx, memo: MEMO({ likes: 'カレー', goals: 'HELLクリア', summary: '先週はHELLの話をした' }) } };
    const r = await core.handleChat({ body, digest: DIGEST, client, take: counter().take, refund: async () => {} });
    const p = client.calls[0];
    check('⑮ 直近10往復と今回の発言が、全部 Claude へ渡る', p.messages.filter(m => m.role !== 'system').length === 21 && textOf(p.messages[0]) === '質問0');
    check('⑮ 思い出メモの5つの欄(好きなもの・目標・あらすじ)が渡る', /好きなもの: カレー/.test(lastSystem(p)) && /目標: HELLクリア/.test(lastSystem(p)) && /あらすじ[^:]*: 先週はHELLの話をした/.test(lastSystem(p)));
    check('⑮ 返ってきたメモは5つの欄のまま', r.json.memo && r.json.memo.likes === 'カレー' && r.json.memo.summary === '前にカレーの話をした' && 'goals' in r.json.memo);
    // 次の回は、前の回の並びがそのまま頭に来る(履歴ぶんがキャッシュから読まれる)
    const turn1 = [...history.slice(0, 6), { role: 'user', text: '好きな食べ物は?' }];
    const turn2 = [...turn1, { role: 'assistant', text: 'カレーかな！' }, { role: 'user', text: '九九の7の段を教えて' }];
    const c1 = fakeClient(() => okResponse({ reply: 'x', expression: 'happy', memo: MEMO() }));
    const c2 = fakeClient(() => okResponse({ reply: '7×1=7、7×2=14…', expression: 'happy', memo: MEMO() }));
    await core.handleChat({ body: { ...baseBody(), messages: turn1 }, digest: DIGEST, client: c1, take: counter().take, refund: async () => {} });
    await core.handleChat({ body: { ...baseBody(), messages: turn2 }, digest: DIGEST, client: c2, take: counter().take, refund: async () => {} });
    const m1 = c1.calls[0].messages.filter(m => m.role !== 'system').map(textOf);
    const m2 = c2.calls[0].messages.filter(m => m.role !== 'system').map(textOf);
    check('⑮ 次の回の会話の頭は、前の回と1文字も変わらない(キャッシュが効く)', JSON.stringify(m2.slice(0, m1.length)) === JSON.stringify(m1));
    // 雑談・勉強の質問も、ふつうに Claude へ渡る(断らない・回数を使う)
    check('⑮ 雑談「好きな食べ物は?」には、ゲームのヘルプの項目を渡さない', core.selectHelpTopics(DIGEST, '好きな食べ物は?').length === 0);
    check('⑮ 雑談「好きな食べ物は?」・勉強「九九の7の段」も Claude へ渡る', c1.calls.length === 1 && c2.calls.length === 1 && textOf(c2.calls[0].messages[c2.calls[0].messages.length - 2]) === '九九の7の段を教えて');
    // 長い返事(10行くらい)は切らずに返す。それより長いものは上限で切る
    const long = Array.from({ length: 10 }, (_, i) => `${i + 1}行目の説明だよ。`).join('\n');
    const cl = fakeClient(() => okResponse({ reply: long, expression: 'normal', memo: MEMO() }));
    const rl = await core.handleChat({ body: baseBody('くわしく教えて'), digest: DIGEST, client: cl, take: counter().take, refund: async () => {} });
    check('⑮ 10行くらいの返事は切らずに返す', rl.json.reply === long);
  }
  // ④
  for (const [name, respond] of [
    ['refusal', () => ({ stop_reason: 'refusal', stop_details: { type: 'refusal', category: null }, content: [], usage: { input_tokens: 1, output_tokens: 0 } })],
    ['APIエラー', () => { const e = new Error('overloaded'); e.status = 529; throw e; }],
    ['形の崩れた返事', () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'JSONじゃない' }], usage: { input_tokens: 1, output_tokens: 1 } })],
  ]) {
    const c = counter();
    const r = await core.handleChat({ body: baseBody(), digest: DIGEST, client: fakeClient(respond), take: c.take, refund: c.refund });
    check(`④ ${name} → 「ごめん、今うまく話せないや」で回数を戻す`, r.json.kind === 'sorry' && r.json.reply === core.REPLY_SORRY && c.state.refunds === 1 && c.state.mine === 0);
  }
  // ⑤
  for (const reason of ['user', 'total']) {
    const c = reason === 'user' ? counter(0, 2500) : counter(100, 0);
    const client = fakeClient(() => okResponse({ reply: 'x', expression: 'happy', memo: MEMO() }));
    const r = await core.handleChat({ body: baseBody(), digest: DIGEST, client, take: c.take, refund: c.refund });
    check(`⑤ ${reason === 'user' ? '1人の上限' : '全員合計の上限'} → 「おしゃべり疲れちゃった」で Claude を呼ばない`, r.json.kind === 'tired' && r.json.limited === reason && /疲れちゃった/.test(r.json.reply) && client.calls.length === 0);
  }
  // ⑥
  for (const text of ['電話は090-1234-5678だよ', 'メールは test@example.com', '〒123-4567']) {
    const c = counter();
    const client = fakeClient(() => okResponse({ reply: 'x', expression: 'happy', memo: MEMO() }));
    const r = await core.handleChat({ body: baseBody(text), digest: DIGEST, client, take: c.take, refund: c.refund });
    check(`⑥ 「${text}」は送らずに注意し、回数も使わない`, r.json.kind === 'personal' && client.calls.length === 0 && c.state.mine === 0);
  }
  check('⑥ ふつうの文(「Lv5になったよ」「WAVE10まで行けた」)は止めない', !core.looksPersonal('Lv5になったよ') && !core.looksPersonal('WAVE10まで行けた！ 3回目で'));
  // 形のおかしい頼み
  {
    const bad = [{}, { ...baseBody(), assistantId: 'nobody' }, { ...baseBody(), messages: [] }, { ...baseBody(), messages: [{ role: 'user', text: 'あ'.repeat(300) }] }];
    let allBad = true;
    for (const b of bad) { const r = await core.handleChat({ body: b, digest: DIGEST, client: fakeClient(() => okResponse({})), take: counter().take, refund: async () => {} }); if (r.status !== 400) allBad = false; }
    check('形のおかしい頼み(助手がいない・空・長すぎる)は 400 で Claude を呼ばない', allBad);
  }
  // 材料JSON
  check('材料JSONに助手4人(みゅあ・きき・ももすけ・ドラ)がいる', ['mua', 'kiki', 'momosuke', 'dra'].every(id => DIGEST.assistants[id] && DIGEST.assistants[id].samples.length > 0));
  // ⑬ 質問に合うヘルプの項目が、Claude へ渡す材料に入る(2026-10-14 窓口の指摘「HELL をバトルの難易度と取り違えた」)。
  //    公開の印が立っている項目(HELL・モンヒロビート・マルチなど)が材料から抜けていないことも、ここで分かる
  const ids = new Set(DIGEST.topics.map(t => t.id));
  check('⑬ 公開済みの印のヘルプ(HELL・マルチ・モンヒロビート)が材料に入っている', ['rhythm/rhythm-hell', 'rhythm/rhythm-multi', 'rhythm/rhythm-mode'].every(id => ids.has(id)));
  // まだ出ていない印(値が偽)のヘルプは材料に入らない。印の値はビルドの時点の RELEASE_FLAGS から読む
  {
    const { loadReleaseFlags } = require(path.join(root, 'tools', 'build-assistant-chat-digest.js'));
    const flags = loadReleaseFlags();
    const helpSrc = fs.readFileSync(path.join(root, 'monster-hero', 'data', 'help.js'), 'utf8');
    const offTopics = [...helpSrc.matchAll(/id:\s*'([\w-]+)'[^\n]*releaseFlag:\s*'(\w+)'/g)].filter(m => flags[m[2]] !== true).map(m => m[1]);
    check('⑬ 印が偽のヘルプの項目は材料に入っていない', offTopics.every(id => !ids.has(id) && ![...ids].some(x => x.endsWith(`/${id}`))), offTopics.join(','));
    check('⑬ 公開した助手とおしゃべりのヘルプは材料に入っている', flags.assistantChat !== true || JSON.stringify(DIGEST).includes('助手とおしゃべりできます'));
  }
  const CASES = [
    ['HELLってどうやったら遊べるの?', 'rhythm/rhythm-hell'],
    // 社長が試して外れた2問(2026-10-14)
    ['モンビーって何?', 'rhythm/rhythm-mode'],
    ['モンヒロビートって何?', 'rhythm/rhythm-mode'],
    ['染色ってどうやるの', 'masu/dye'],
    ['合体のやり方を教えて', 'masu/fusion'],
    ['マルチってなに？', 'rhythm/rhythm-multi'],
    ['ジャックってなに', 'basics/raid-jack'],
    ['仲良し度ってどうやって上がる？', 'tips/bond'],
    ['限界突破のしかた', 'masu/rebirth'],
    ['転生するとどうなる？', 'masu/reincarnate'],
    ['ログインボーナスは？', 'items/login-bonus'],
    ['ミッションってなに', 'items/missions'],
    ['スキップチケットって何に使うの', 'items/skip-ticket'],
    ['種族チャレンジのやり方', 'basics/species-challenge'],
    ['タクティクスバトルってなに', 'basics/tactics-battle'],
    ['EXスキルの使い方', 'basics/tactics-ex-skills'],
  ];
  const misses = [];
  for (const [q, want] of CASES) {
    const got = core.selectHelpTopics(DIGEST, q).map(t => t.id);
    if (!got.includes(want)) misses.push(`${q} → ${got.join(',')}(期待 ${want})`);
  }
  check(`⑬ ${CASES.length}問すべてで、質問の項目が選ばれる`, misses.length === 0, misses.join(' 、 '));
  // 実際に Claude へ渡す system にも入っている(区切りの後ろ=キャッシュを壊さない場所)
  {
    const client = fakeClient(() => okResponse({ reply: 'x', expression: 'happy', memo: MEMO() }));
    await core.handleChat({ body: baseBody('HELLってどうやったら遊べるの?'), digest: DIGEST, client, take: counter().take, refund: async () => {} });
    const sys = client.calls[0].system;
    const dyn = lastSystem(client.calls[0]);
    check('⑬ HELL の項目(MASTER クリアで開く)が、会話の最後の途中の system に入る', /難易度 HELL と空のノーツ/.test(dyn) && /MASTER/.test(dyn) && !/難易度 HELL と空のノーツ\n/.test(sys[1].text));
    check('⑬ 決まりに「推測で作らない」「似た名前を取り違えない」が入っている', /推測で作らない/.test(sys[0].text) && /取り違えない/.test(sys[0].text));
    // 用語の表はキャッシュする共通部分に入り、みゅあ・ももすけが「モンビー」と呼ぶことが分かる
    check('⑬ 用語の表がキャッシュする部分に入り、モンビー＝モンヒロビートと、みゅあ・ももすけの呼び方が載っている',
      /モンヒロビート\(＝モンビー/.test(sys[1].text) && /みゅあは[^、]*「モンビー」/.test(sys[1].text) && /ももすけは[^、]*「モンビー」/.test(sys[1].text) && !!sys[1].cache_control);
    check('⑬ 用語の表で、絆レベル(マスモン)と仲良し度(助手)を分けている', /・絆レベル/.test(sys[1].text) && /・仲良し度/.test(sys[1].text));
  }
};

// ---------- 後半: 実ブラウザ ----------
const PORT = 8996;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

const browser = async (core) => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので実ブラウザの確認は飛ばします'); return; }
  const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const server = await serve();
  const errors = [];
  const sent = [];
  const client = fakeClient(() => okResponse({ reply: 'テストちん、やっほー！ 今日もがんばろ♪', expression: 'wink', memo: MEMO({ topics: 'あいさつした' }) }));
  const c = counter();
  let b;
  try {
    b = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
      if (localStorage.getItem('mh_assistant_bond_v1') === null) localStorage.setItem('mh_assistant_bond_v1', JSON.stringify({ points: 800 }));
      // 先に流れるほかのお話(HELL)は見たことにしておく(このお話だけを確かめるため)
      localStorage.setItem('mh_rhythm_hell_story_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_kiki_intro_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_momosuke_intro_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_tactics_intro_seen_v1', JSON.stringify(true));
      // 前の形の思い出メモ(1つの文)。新しい形へ引き継がれて送られるか見る
      localStorage.setItem('mh_assistant_chat_memo_v1', JSON.stringify({ mua: 'モッチーが好き' }));
      window.__mhSupabaseStubbed = true;
    });
    await page.addInitScript(eventStorySeed());
    await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    // 中継役を偽物の Claude で動かす(本番の API は叩かない)
    await page.route('**/functions/v1/assistant-chat', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      sent.push(body);
      const r = await core.handleChat({ body, digest: DIGEST, client, take: c.take, refund: c.refund });
      await route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.json) });
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    // ⑭ 公開(2026-10-14)のあとの最初の HOME で、お話「話せるようになった日」が1回流れる
    // 先に出る受け取り(ログインボーナスなど)を閉じてから待つ。お話はほかの会話・案内が終わってから流れる
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    const story = page.locator('[role="dialog"][aria-label="イベント回想: 話せるようになった日 ～ことのはの鈴～"]');
    const storyShown = await story.waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
    const dialogs = storyShown ? '' : await page.evaluate(() => [...document.querySelectorAll('[role="dialog"]')].map(d => d.getAttribute('aria-label') || d.textContent.slice(0, 40)).join(' / '));
    if (!storyShown && process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, 'assistant-chat-story-missing.png') });
    check('⑭ 公開のあとの最初の HOME で、お話「話せるようになった日」が流れる', storyShown, dialogs);
    if (storyShown && process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, 'assistant-chat-story.png') });
    for (let i = 0; i < 60 && await story.count(); i++) {
      await page.locator('[role="dialog"] button[aria-label="次へ"]').first().dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(120);
    }
    check('⑭ 最後まで見ると、新しいキー mh_story_assistant_chat_seen_v1 に「見た」が残る',
      await page.evaluate(() => localStorage.getItem('mh_story_assistant_chat_seen_v1')) === 'true');
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.locator('[data-home-assistant-chat]').waitFor({ timeout: 10000 }).catch(() => {});
    check('⑧ 公開の印が立っていて、HOMEに「💬 おしゃべり」が出る', await page.locator('[data-home-assistant-chat]').count() === 1);
    if (process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, 'assistant-chat-home.png') });
    const before = await page.evaluate(() => ({ ...localStorage }));
    await page.locator('[data-home-assistant-chat]').dispatchEvent('click');
    await page.locator('[data-assistant-chat]').waitFor({ timeout: 10000 });
    check('⑨ HOMEの「おしゃべり」から会話の窓が開く', true);
    // ⑫ 個人情報は送られない
    await page.locator('[data-assistant-chat-input]').fill('電話は090-1234-5678');
    await page.locator('[data-assistant-chat-send]').dispatchEvent('click');
    await page.waitForTimeout(300);
    check('⑫ 電話番号は中継役へ送られず、注意が出る', sent.length === 0 && /大事な情報/.test(await page.locator('[data-assistant-chat]').innerText()));
    await page.locator('[data-assistant-chat-input]').fill('こんにちは！');
    await page.locator('[data-assistant-chat-send]').dispatchEvent('click');
    await page.getByText('テストちん、やっほー！ 今日もがんばろ♪').waitFor({ timeout: 10000 });
    check('⑨ 偽物の Claude の返事が窓に出る', true);
    check('⑨ 表情が返事に合わせて変わる(wink)', await page.locator('[data-assistant-chat-face="wink"]').count() === 1);
    check('⑨ 「今日あと99回」が出る', /今日あと99回/.test(await page.locator('[data-assistant-chat-remaining]').innerText()));
    const req = sent[0] || {};
    check('⑪ 呼び方・仲良し度・助手が送られている', req.assistantId === 'mua' && req.ctx && req.ctx.bondLevel === 5 && typeof req.ctx.callName === 'string' && req.ctx.callName.length > 0, JSON.stringify(req.ctx));
    check('⑪ 前の形のメモ(mh_assistant_chat_memo_v1)が「前に話した話題」として送られる', req.ctx && req.ctx.memo && req.ctx.memo.topics === 'モッチーが好き');
    check('⑪ 個人情報の文は送った会話に入っていない', Array.isArray(req.messages) && !req.messages.some(m => /090/.test(m.text)));
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({ ...localStorage }));
    const bond = (s) => { try { return JSON.parse(s.mh_assistant_bond_v1 || '{}').points; } catch { return null; } };
    check('⑩ みゅあの仲良し度が +2(chat)', bond(after) === bond(before) + 2, `${bond(before)} → ${bond(after)}`);
    const memo = JSON.parse(after.mh_assistant_chat_memo_v2 || '{}');
    const log = JSON.parse(after.mh_assistant_chat_log_v1 || '{}');
    check('⑩ 思い出メモが新しいキー(mh_assistant_chat_memo_v2)に5つの欄で残り、前のキーは書き換えない', memo.mua && memo.mua.topics === 'あいさつした' && 'likes' in memo.mua
      && after.mh_assistant_chat_memo_v1 === before.mh_assistant_chat_memo_v1);
    check('⑩ 会話が新しいキーに残り、個人情報の文は残らない', Array.isArray(log.mua) && log.mua.some(m => m.text === 'こんにちは！') && !log.mua.some(m => /090/.test(m.text)));
    const lost = Object.keys(before).filter(k => k.startsWith('mh_') && !(k in after));
    check('⑩ 既存のキーは1つも消えない', lost.length === 0, lost.join(','));
    // 2回目は、前のメモと直近の会話を送る
    await page.locator('[data-assistant-chat-input]').fill('またね');
    await page.locator('[data-assistant-chat-send]').dispatchEvent('click');
    await page.waitForTimeout(600);
    const req2 = sent[1] || {};
    check('⑪ 2回目は前の思い出メモを送る', req2.ctx && req2.ctx.memo && req2.ctx.memo.topics === 'あいさつした');
    check('⑪ 送る会話は直近10往復(21件)まで', Array.isArray(req2.messages) && req2.messages.length <= 21 && req2.messages[req2.messages.length - 1].text === 'またね');
    check('実行時エラーが出ない', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    if (b) await b.close();
    server.close();
  }
};

(async () => {
  const core = await import(CORE);
  await unit(core);
  if (!process.argv.includes('--unit')) await browser(core);
  console.log(failed === 0 ? '\nすべてOK' : `\nNG ${failed}件`);
  process.exit(failed === 0 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
