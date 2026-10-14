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

const unit = async (core) => {
  // ①②③
  {
    const client = fakeClient(() => okResponse({ reply: 'WAVEごとに報酬を選ぶのがコツだよ！', expression: 'excited', memo: 'モッチーが好き。バトルのコツを知りたがっていた' }));
    const c = counter();
    const logs = [];
    const r = await core.handleChat({ body: baseBody(), digest: DIGEST, client, take: c.take, refund: c.refund, log: (e) => logs.push(JSON.stringify(e)) });
    const p = client.calls[0] || {};
    check('① モデルは claude-haiku-5-5', p.model === 'claude-haiku-5-5', p.model);
    check('① thinking を切り、effort は low(Haiku 5.5 は high 以下なら切れる)', p.thinking && p.thinking.type === 'disabled' && p.output_config && p.output_config.effort === 'low');
    check('① 構造化出力(json_schema)で reply・expression・memo を受け取る', p.output_config && p.output_config.format && p.output_config.format.type === 'json_schema'
      && JSON.stringify(p.output_config.format.schema.required) === JSON.stringify(['reply', 'expression', 'memo']) && p.output_config.format.schema.additionalProperties === false);
    check('① max_tokens は短め(返事は数行)', p.max_tokens > 0 && p.max_tokens <= 600, String(p.max_tokens));
    check('① 助手の発言で終わらない(prefill しない)', Array.isArray(p.messages) && p.messages[p.messages.length - 1].role === 'user' && p.messages[0].role === 'user');
    const sys = p.system || [];
    check('② system は4つ(決まり/ヘルプ/人柄/プレイヤー)', sys.length === 4);
    check('② キャッシュの区切りはヘルプと人柄の後ろの2か所だけ', sys.map(b => !!b.cache_control).join(',') === 'false,true,true,false');
    check('② プレイヤーごとの値(呼び方・仲良し度・メモ)は区切りより後ろ', /テストちん/.test(sys[3] && sys[3].text) && /Lv5/.test(sys[3].text) && /モッチーが好き/.test(sys[3].text)
      && !/テストちん/.test(sys.slice(0, 3).map(b => b.text).join('')));
    check('② 決まりに「相棒・恋愛にしない」「未成年」「個人情報」が入っている', /相棒/.test(sys[0].text) && /恋/.test(sys[0].text) && /子ども/.test(sys[0].text) && /個人情報/.test(sys[0].text));
    check('② 決まりの部分に日付や人ごとの値が入っていない(キャッシュが毎回切れない)', !/\d{4}-\d{2}-\d{2}/.test(sys[0].text + sys[1].text));
    check('② ヘルプの中身と、みゅあの人柄が入っている', sys[1].text.length > 5000 && /みゅあ/.test(sys[2].text));
    // 同じ助手なら、区切りまでの中身は人が変わっても同じ(キャッシュが共有される)
    const client2 = fakeClient(() => okResponse({ reply: 'うん', expression: 'happy', memo: '' }));
    const other = { ...baseBody(), breederId: 'other', ctx: { ...baseBody().ctx, callName: 'べつのひと', memo: '' } };
    await core.handleChat({ body: other, digest: DIGEST, client: client2, take: counter().take, refund: async () => {} });
    const s2 = client2.calls[0].system;
    check('② 別の人でも、区切りまでの中身は1文字も変わらない', JSON.stringify(sys.slice(0, 3)) === JSON.stringify(s2.slice(0, 3)));
    check('③ 返事・表情・メモがそのまま返る', r.json.kind === 'reply' && r.json.reply === 'WAVEごとに報酬を選ぶのがコツだよ！' && r.json.expression === 'excited' && /バトルのコツ/.test(r.json.memo));
    check('③ 回数を1つ使い、残りが返る', c.state.mine === 1 && r.json.remainingToday === 99, String(r.json.remainingToday));
    check('⑦ ログに会話の本文が出ない', logs.length > 0 && !logs.some(l => /コツ|こんにちは|やっほー|モッチー|テスト/.test(l)), logs.join(' | '));
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
    const client = fakeClient(() => okResponse({ reply: 'x', expression: 'happy', memo: '' }));
    const r = await core.handleChat({ body: baseBody(), digest: DIGEST, client, take: c.take, refund: c.refund });
    check(`⑤ ${reason === 'user' ? '1人の上限' : '全員合計の上限'} → 「おしゃべり疲れちゃった」で Claude を呼ばない`, r.json.kind === 'tired' && r.json.limited === reason && /疲れちゃった/.test(r.json.reply) && client.calls.length === 0);
  }
  // ⑥
  for (const text of ['電話は090-1234-5678だよ', 'メールは test@example.com', '〒123-4567']) {
    const c = counter();
    const client = fakeClient(() => okResponse({ reply: 'x', expression: 'happy', memo: '' }));
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
  const client = fakeClient(() => okResponse({ reply: 'テストちん、やっほー！ 今日もがんばろ♪', expression: 'wink', memo: 'あいさつした' }));
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
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    check('⑧ 公開の印が切のあいだ、HOMEに「おしゃべり」が出ない', await page.locator('[data-home-assistant-chat]').count() === 0);
    const before = await page.evaluate(() => ({ ...localStorage }));
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
    await page.locator('footer button[aria-label=""]').dispatchEvent('click');
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    await page.locator('[data-debug-assistant-chat]').dispatchEvent('click');
    await page.locator('[data-assistant-chat]').waitFor({ timeout: 10000 });
    check('⑨ デバッグ設定から会話の窓が開く', true);
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
    check('⑪ 個人情報の文は送った会話に入っていない', Array.isArray(req.messages) && !req.messages.some(m => /090/.test(m.text)));
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => ({ ...localStorage }));
    const bond = (s) => { try { return JSON.parse(s.mh_assistant_bond_v1 || '{}').points; } catch { return null; } };
    check('⑩ みゅあの仲良し度が +2(chat)', bond(after) === bond(before) + 2, `${bond(before)} → ${bond(after)}`);
    const memo = JSON.parse(after.mh_assistant_chat_memo_v1 || '{}');
    const log = JSON.parse(after.mh_assistant_chat_log_v1 || '{}');
    check('⑩ 思い出メモが新しいキーに残る', memo.mua === 'あいさつした');
    check('⑩ 会話が新しいキーに残り、個人情報の文は残らない', Array.isArray(log.mua) && log.mua.some(m => m.text === 'こんにちは！') && !log.mua.some(m => /090/.test(m.text)));
    const lost = Object.keys(before).filter(k => k.startsWith('mh_') && !(k in after));
    check('⑩ 既存のキーは1つも消えない', lost.length === 0, lost.join(','));
    // 2回目は、前のメモと直近の会話を送る
    await page.locator('[data-assistant-chat-input]').fill('またね');
    await page.locator('[data-assistant-chat-send]').dispatchEvent('click');
    await page.waitForTimeout(600);
    const req2 = sent[1] || {};
    check('⑪ 2回目は前の思い出メモを送る', req2.ctx && req2.ctx.memo === 'あいさつした');
    check('⑪ 送る会話は直近7件まで', Array.isArray(req2.messages) && req2.messages.length <= 7 && req2.messages[req2.messages.length - 1].text === 'またね');
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
