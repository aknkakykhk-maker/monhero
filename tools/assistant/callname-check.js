// 会話で決まる呼び方・助手へのあだ名(2026-11-08 社長・docs/progress/assistant-peer/AI-TALK-PLAN.md)を確かめる。
//
//   node tools/assistant/callname-check.js            … 前半(すぐ終わる)+後半(実ブラウザ)
//   CALLNAME_FAST=1 node tools/assistant/callname-check.js … 前半だけ
//
// 前半: データ(data/assistants.js)と中継役(supabase/functions/assistant-chat/core.js)だけを動かす
//   ① 呼び方・あだ名に入れない言葉の一覧が、ゲームと中継役で同じ
//   ② 見張り: 悪口・恋人呼び・「この子」・個人情報・長すぎ・空白を止め、ふつうの呼び方は通す(ゲームと中継役の両方)
//   ③ 決まる順: 会話で決めた呼び方 → Lv6 からの呼び方 → 段の呼び方。会話で決めた呼び方は Lv1 でも使う
//   ④ 端末の読み取り(「◯◯って呼んで」「◯◯って呼んでいい？」「前の呼び方に戻して」)
//   ⑤ Lv1〜2 の照れる日は性格で決まり、Lv3 からは照れない
//   ⑥ 台本: 8人ぶん全部の場面がある/みゅあは「じゃん」を使わない/ききは敬語/あつは文末に笑・記号/「この子」と言わない
//   ⑦ 中継役: 照れる日のプレイヤーの頼み・持ちかけてはいけない日の持ちかけ・古いゲーム(決まり無し)は none になる。好みの手がかりが返る
//   ⑧ 中継役: <callname>・<tastes> がプレイヤーごとの所に入り、決まり文に呼び方の決まりがある
// 後半: 本物のゲーム → 中継役(偽物の Claude) → ゲーム
//   ⑨ 「あっちゃんって呼んで」→ 確かめるカード → うん → 新しいキーに入る。今のキー(mh_assistant_call_style*)は変わらない
//   ⑩ あだ名のカード → うん → mh_assistant_nickname_v1
//   ⑪ API が止まっていても、端末の読み取りでカードが出る(返事は台本)
//   ⑫ プロフィールの呼び方の小窓に「会話で決めた呼び方」が出て、元に戻すと新しいキーの行だけ消える。小窓のあいだは知らせを出さない
//   ⑬ Lv6 で開くと、助手から「なんて呼んだらいい？」と1回だけ聞き、候補のボタンが出る
//   ⑭ 公開の印が偽のときは、カードも問いかけも出ない
const http = require('http');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const root = path.resolve(__dirname, '..', '..');
const ASSISTANTS = path.join(root, 'monster-hero/data/assistants.js');
const CORE = path.join(root, 'supabase/functions/assistant-chat/core.js');
const DIGEST = JSON.parse(fs.readFileSync(path.join(root, 'monster-hero/data/assistant-chat-digest.json'), 'utf8'));

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const loadData = () => {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(`${fs.readFileSync(ASSISTANTS, 'utf8')}
this.X = { ASSISTANT_CALLNAME_BANNED_SOURCE, assistantCallnameGuard, assistantNicknameGuard, assistantCallName, assistantSetCallnames,
  assistantCallnameDetect, assistantCallnameShy, ASSISTANT_CALLNAME_LINES, ASSISTANT_CALLNAME_SHY_RATE, ASSISTANTS, assistantSetPlayerGender };`, ctx, { filename: 'assistants.js' });
  return ctx.X;
};

const fast = async () => {
  const X = loadData();
  const core = await import(CORE);
  // ①
  check('① 入れない言葉の一覧が、ゲーム(assistants.js)と中継役(core.js)で同じ', X.ASSISTANT_CALLNAME_BANNED_SOURCE === core.CALLNAME_BANNED_SOURCE);
  // ②
  const ng = ['ダーリン', '{name}ハニー', 'バカ', 'クズ{name}', 'この子', 'うちの子', '090-1234-5678', '09012345678', 'a@b.jp', '本名のたろう', 'あっ ちゃん', '{name}{name}', 'とても長い呼び方になりすぎちゃう', '<b>あ</b>'];
  const okList = ['あっちゃん', '{name}ちゃん', '{name}っち', '勇者{name}', 'ますたー', 'ボス', 'あつニキ'];
  const devNg = ng.filter(t => X.assistantCallnameGuard(t, 'テスト') !== null);
  const devOk = okList.filter(t => X.assistantCallnameGuard(t, 'テスト') === null);
  check('② ゲームの見張りが、悪口・恋人呼び・「この子」・個人情報・長すぎ・空白・記号を止める', devNg.length === 0, devNg.join(' / '));
  check('② ゲームの見張りが、ふつうの呼び方は通す', devOk.length === 0, devOk.join(' / '));
  const srvNg = ng.filter(t => core.guardCallValue(t) !== '');
  const srvOk = okList.filter(t => core.guardCallValue(t) === '');
  check('② 中継役の見張りも同じものを止め、同じものを通す', srvNg.length === 0 && srvOk.length === 0, [...srvNg, ...srvOk].join(' / '));
  check('② 名前をそのまま書いた呼び方は {name} に戻す(名前を変えても追いつく)', X.assistantCallnameGuard('テストちゃん', 'テスト') === '{name}ちゃん' && core.guardCallValue('テストちゃん', 16, 'テスト') === '{name}ちゃん');
  check('② あだ名の見張り(10字まで・悪い言葉なし)', X.assistantNicknameGuard('みゅあたん') === 'みゅあたん' && X.assistantNicknameGuard('バカみゅあ') === null && X.assistantNicknameGuard('とても長いあだ名ですよね') === null);
  // ③
  X.assistantSetCallnames({});
  const base1 = X.assistantCallName('テスト', 1, null, 'mua');
  const base6 = X.assistantCallName('テスト', 6, 'ボス{name}', 'mua');
  X.assistantSetCallnames({ mua: { call: 'あっちゃん', by: 'chat', at: 1 }, kiki: { call: '{name}ちゃん', by: 'chat', at: 1 } });
  check('③ 会話で決めた呼び方は Lv1 でも使う(段の呼び方より先)', base1 === 'テストさん' && X.assistantCallName('テスト', 1, null, 'mua') === 'あっちゃん', `${base1} → ${X.assistantCallName('テスト', 1, null, 'mua')}`);
  check('③ 会話で決めた呼び方は Lv6 からの呼び方(今のキー)より先', base6 === 'ボステスト' && X.assistantCallName('テスト', 6, 'ボス{name}', 'mua') === 'あっちゃん');
  check('③ 決めた助手だけ変わる({name} は名前に置きかわる)', X.assistantCallName('テスト', 1, null, 'kiki') === 'テストちゃん' && X.assistantCallName('テスト', 1, null, 'momosuke') !== 'あっちゃん');
  X.assistantSetCallnames({ mua: { call: 'ダーリン', by: 'chat', at: 1 } });
  check('③ 保存値に悪い言葉があれば読まない(段の呼び方へ戻る)', X.assistantCallName('テスト', 1, null, 'mua') === 'テストさん');
  X.assistantSetCallnames({});
  // ④
  const d = (t) => JSON.stringify(X.assistantCallnameDetect(t));
  check('④ 「これからは「あっちゃん」って呼んでほしいな」→ 呼び方', d('これからは「あっちゃん」って呼んでほしいな') === '{"kind":"call","value":"あっちゃん"}');
  check('④ 「俺のことはボスって呼んでくれ」→ 呼び方', d('俺のことはボスって呼んでくれ') === '{"kind":"call","value":"ボス"}');
  check('④ 「みゅあたんって呼んでいい？」→ 助手のあだ名', d('みゅあたんって呼んでいい？') === '{"kind":"nick","value":"みゅあたん"}');
  check('④ 「前の呼び方に戻して」→ 戻す', d('前の呼び方に戻して') === '{"kind":"reset"}');
  check('④ ふつうの話は読み取らない', X.assistantCallnameDetect('今日はHELLをがんばった') === null && X.assistantCallnameDetect('呼んでくれてありがとう') === null);
  // ⑤
  const days = Array.from({ length: 60 }, (_, i) => `2027-01-${String(i % 28 + 1).padStart(2, '0')}-${i}`);
  const count = (id, lv) => days.filter(dk => X.assistantCallnameShy(id, lv, dk)).length;
  check('⑤ みゅあ・ドラは Lv1 でも照れない', count('mua', 1) === 0 && count('dra', 1) === 0);
  check('⑤ ききは Lv1〜2 でときどき照れる(割合どおりに散らばる)', count('kiki', 1) > 20 && count('kiki', 1) < 55 && count('kiki', 2) > 20, `${count('kiki', 1)}/60`);
  const lv3 = Object.keys(X.ASSISTANT_CALLNAME_SHY_RATE).filter(id => count(id, 3) > 0);
  check('⑤ Lv3 からはだれも照れない(社長)', lv3.length === 0, lv3.join(','));
  // ⑥
  const ids = X.ASSISTANTS.map(a => a.id);
  const kinds = ['ask', 'confirm', 'accept', 'keep', 'shy', 'nickConfirm', 'nickAccept', 'nickShy'];
  const missing = ids.flatMap(id => kinds.filter(k => !(X.ASSISTANT_CALLNAME_LINES[id] && Array.isArray(X.ASSISTANT_CALLNAME_LINES[id][k]) && X.ASSISTANT_CALLNAME_LINES[id][k].length)).map(k => `${id}.${k}`));
  check('⑥ 助手全員に、台本の場面がそろっている', missing.length === 0, missing.join(' / '));
  const lines = (id) => Object.values(X.ASSISTANT_CALLNAME_LINES[id] || {}).flat();
  check('⑥ みゅあは「じゃん」「まじ」を使わない(「ぢゃん」「まぢ」)', !lines('mua').some(l => /じゃん|まじ/.test(l)));
  check('⑥ ききは敬語(です・ます・でつ・まつ)で、タメ口の語尾にしない', lines('kiki').every(l => /です|ます|でつ|まつ|ください|しょう/.test(l)) && !lines('kiki').some(l => /だよ|だね|してよ/.test(l)));
  const atsuBad = lines('atsu').flatMap(l => l.split(/(?<=[。！？!?笑])\s*/).filter(Boolean)).filter(x => !/(笑|[！？!?…♪]|[)）])$/.test(x.trim()));
  check('⑥ あつは文の最後に必ず笑か記号', atsuBad.length === 0, atsuBad.join(' / '));
  check('⑥ 台本で「この子」「うちの子」と言わない', !ids.some(id => lines(id).some(l => /(この|うちの|その|あの)子/.test(l))));
  check('⑥ 台本で「AI」と言わない', !ids.some(id => lines(id).some(l => /AI|ＡＩ|API|Claude/i.test(l))));
  // ⑦
  const cn = (o) => ({ playerName: 'テスト', callname: { shy: false, canOffer: false, asking: false, nick: '', ...o } });
  const j = (o) => ({ call: { action: 'confirm', value: 'あっちゃん', from: 'player' }, nick: { action: 'none', value: '' }, taste: { monster: '', feeling: 'none' }, ...o });
  check('⑦ ふつうの日のプレイヤーの頼みは confirm のまま返る', core.normalizeCallFields(j(), cn()).call.action === 'confirm');
  check('⑦ 照れる日のプレイヤーの頼みは none にする', core.normalizeCallFields(j(), cn({ shy: true })).call.action === 'none');
  check('⑦ 持ちかけてはいけない日の、助手からの持ちかけは none', core.normalizeCallFields(j({ call: { action: 'confirm', value: '{name}っち', from: 'assistant' } }), cn()).call.action === 'none'
    && core.normalizeCallFields(j({ call: { action: 'confirm', value: '{name}っち', from: 'assistant' } }), cn({ canOffer: true })).call.action === 'confirm');
  check('⑦ 古いゲーム(決まりを送らない)には none だけ返す', core.normalizeCallFields(j(), { playerName: 'テスト', callname: null }).call.action === 'none');
  check('⑦ 悪い呼び方は中継役でも none', core.normalizeCallFields(j({ call: { action: 'confirm', value: 'ダーリン', from: 'player' } }), cn()).call.action === 'none');
  const nick = core.normalizeCallFields(j({ call: { action: 'none', value: '', from: 'player' }, nick: { action: 'confirm', value: 'みゅあたん' } }), cn());
  check('⑦ あだ名は confirm のまま返り、照れる日は none', nick.nick.action === 'confirm' && nick.nick.value === 'みゅあたん'
    && core.normalizeCallFields(j({ nick: { action: 'confirm', value: 'みゅあたん' } }), cn({ shy: true })).nick.action === 'none');
  const t = core.normalizeCallFields(j({ taste: { monster: 'ゴースト', feeling: 'good' } }), cn()).tasteHint;
  check('⑦ 好みの手がかりが { monster, positive } で返る(無ければ null)', t && t.monster === 'ゴースト' && t.positive === true && core.normalizeCallFields(j(), cn()).tasteHint === null);
  // ⑧
  let params = null;
  const client = { messages: { create: async (p) => { params = p; return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ reply: 'えっ、いいの!?', expression: 'happy', memo: { likes: '', goals: '', events: '', topics: '', summary: '', secret: '' }, ...j() }) }], usage: {} }; } } };
  const body = { breederId: 'x', assistantId: 'mua', messages: [{ role: 'user', text: 'あっちゃんって呼んで' }],
    ctx: { playerName: 'テスト', callName: 'テストさん', bondLevel: 1, callname: { shy: true, canOffer: true, nick: 'みゅあたん' }, tastes: { likes: ['ゴースト'], dislikes: [], changed: [{ name: 'ゴースト', to: 'like' }] } } };
  const r = await core.handleRequest({ body, digest: DIGEST, client, take: async () => ({ ok: true, remaining: 9 }), refund: async () => {} });
  const dyn = JSON.stringify(params && params.messages);
  check('⑧ 照れる日・持ちかけてよい・あだ名が <callname> で送られ、好みが <tastes> で送られる', /<callname>/.test(dyn) && /照れる日/.test(dyn) && /持ちかけてよい/.test(dyn) && /みゅあたん/.test(dyn) && /<tastes>/.test(dyn) && /ゴースト→好き/.test(dyn));
  check('⑧ 照れる日に AI が confirm を返しても、ゲームへは none で返る', r.json.kind === 'reply' && r.json.call && r.json.call.action === 'none', JSON.stringify(r.json.call));
  const sys = JSON.stringify(params && params.system);
  check('⑧ 決まり文(キャッシュの所)に、呼び方・あだ名・好みの決まりがある', /照れる日/.test(sys) && /あだ名\(nick\)/.test(sys) && /好み\(taste\)/.test(sys));
};

// ---------- 後半: 実ブラウザ ----------
const PORT = 8987;
const browser = async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので実ブラウザの確認は飛ばします'); return; }
  const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const core = await import(CORE);
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const MEMO = { likes: '', goals: '', events: '', topics: '', summary: '', secret: '' };
  const client = { messages: { create: async (p) => {
    const last = [...p.messages].reverse().find(m => m.role === 'user');
    const said = Array.isArray(last.content) ? last.content.map(c => c.text || '').join('') : String(last.content);
    const call = /あっちゃんって呼んで/.test(said) ? { action: 'confirm', value: 'あっちゃん', from: 'player' } : { action: 'none', value: '', from: 'player' };
    const nick = /みゅあたんって呼んでいい/.test(said) ? { action: 'confirm', value: 'みゅあたん' } : { action: 'none', value: '' };
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ reply: 'えっ、いいの!? うれしいぢゃん♪', expression: 'happy', memo: MEMO, call, nick, taste: { monster: '', feeling: 'none' } }) }], usage: {} };
  } } };
  const open = async ({ flag = true, bond = 120, down = false, extra = {} } = {}) => {
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
    await page.addInitScript(({ flag, bond, extra }) => {
      if (!localStorage.getItem('cn_check_seeded')) {
        localStorage.setItem('cn_check_seeded', '1');
        localStorage.setItem('mh_assistant_bond_v1', JSON.stringify({ points: bond }));
        localStorage.setItem('mh_story_assistant_chat_seen_v1', 'true');
        localStorage.setItem('mh_assistant_call_style', JSON.stringify('ボス{name}'));
        for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, JSON.stringify(v));
      }
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantCallname = flag; clearInterval(t); } } catch {} }, 2);
    }, { flag, bond, extra });
    await page.route(/rest\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/functions/v1/assistant-chat', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      if (body.kind) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, kind: 'tired' }) }); return; }
      page.__sent = [...(page.__sent || []), body];
      if (down) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, kind: 'sorry', reply: 'ごめん、今うまく話せないや', expression: 'troubled' }) }); return; }
      const r = await core.handleRequest({ body, digest: DIGEST, client, take: async () => ({ ok: true, remaining: 9 }), refund: async () => {} });
      await route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.json) });
    });
    await page.route(/functions\/v1\/(?!assistant-chat)/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await page.waitForTimeout(1200); await finishTalk(page);
    await page.locator('[data-home-assistant-chat]').dispatchEvent('click');
    await page.locator('[data-assistant-chat]').waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    return { page, errors };
  };
  const say = async (page, text) => {
    await page.locator('[data-assistant-chat-input]').fill(text);
    await page.locator('[data-assistant-chat-send]').dispatchEvent('click');
    await page.waitForTimeout(900);
  };
  const ls = (page, k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), k);
  try {
    { // ⑨⑩⑫
      const { page, errors } = await open({ bond: 420 }); // Lv4(照れない)
      await say(page, 'これからはあっちゃんって呼んで！');
      const sent = (page.__sent || [])[0] || {};
      check('⑨ 送る中身に、照れる日・持ちかけてよいかの決まりが入る', sent.ctx && sent.ctx.callname && typeof sent.ctx.callname.shy === 'boolean' && typeof sent.ctx.callname.canOffer === 'boolean');
      const card = await page.locator('[data-assistant-callname-card="call"]').count();
      check('⑨ 「あっちゃんって呼んで」で、確かめるカードが出る(まだ変わらない)', card === 1 && (await ls(page, 'mh_assistant_callname_v1')) === null);
      await page.locator('[data-assistant-callname-yes]').dispatchEvent('click'); await page.waitForTimeout(400);
      const saved = await ls(page, 'mh_assistant_callname_v1');
      check('⑨ うんを押すと、新しいキーにみゅあの呼び方だけ入る', saved && saved.mua && saved.mua.call === 'あっちゃん' && saved.mua.by === 'chat' && Object.keys(saved).length === 1, JSON.stringify(saved));
      check('⑨ 今のキー(mh_assistant_call_style)は変わらない', (await ls(page, 'mh_assistant_call_style')) === 'ボス{name}');
      const accepted = await page.locator('[data-assistant-chat-msg="assistant"]').last().innerText();
      check('⑨ 助手が新しい呼び方で呼ぶ(台本)', /あっちゃん/.test(accepted), accepted.slice(0, 40));
      await say(page, 'じゃあみゅあたんって呼んでいい？');
      check('⑩ あだ名のカードが出る', await page.locator('[data-assistant-callname-card="nick"]').count() === 1);
      await page.locator('[data-assistant-callname-yes]').dispatchEvent('click'); await page.waitForTimeout(400);
      const nick = await ls(page, 'mh_assistant_nickname_v1');
      check('⑩ うんを押すと mh_assistant_nickname_v1 に入る', nick && nick.mua && nick.mua.nick === 'みゅあたん', JSON.stringify(nick));
      // 閉じて、つぎの画面で知らせが出る
      await page.locator('[data-assistant-chat-close]').dispatchEvent('click'); await page.waitForTimeout(300);
      check('⑨ 決めた画面(HOME)では知らせを出さない', await page.locator('[data-assistant-callname-toast]').count() === 0);
      await page.locator('.mh-home-player').click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
      check('⑨ つぎの画面で、呼び方が変わった知らせが1回出る', await page.locator('[data-assistant-callname-toast]').count() === 1);
      // ⑫ プロフィール
      await page.locator('[data-profile-call-style]').first().waitFor({ timeout: 8000 }).catch(() => {});
      // プロフィールで1回だけ出る案内(飾り枠など)を読み進めてから押す
      for (let i = 0; i < 12; i++) { const n = page.getByRole('button', { name: /^(次へ|閉じる|OK|わかった！?)$/ }).first(); if (!(await n.count()) || !(await n.isVisible().catch(() => false))) break; await n.click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(250); }
      await page.locator('[data-profile-call-style]').first().click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      // ミハリ 2026-11-08: 知らせが小窓のいちばん上の行に重なっていた。小窓が開いているあいだは出さない
      check('⑫ 呼び方の小窓を開いているあいだは、呼び方の知らせを出さない(小窓の行に重ならない)', await page.locator('[data-assistant-callname-toast]').count() === 0);
      if (process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, 'callname-profile.png') });
      check('⑫ プロフィールの呼び方の小窓に「会話で決めた呼び方」とあだ名が出る', await page.locator('[data-callname-profile]').count() === 1 && /あっちゃん/.test(await page.locator('[data-callname-profile]').innerText()));
      await page.locator('[data-callname-reset]').dispatchEvent('click', {}, { timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300);
      const after = await ls(page, 'mh_assistant_callname_v1');
      check('⑫ 元に戻すと、新しいキーの行だけ消える(今のキーはそのまま)', after && !after.mua && (await ls(page, 'mh_assistant_call_style')) === 'ボス{name}', JSON.stringify(after));
      check('⑨〜⑫ 実行時エラーがない', errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
    { // ⑪
      const { page, errors } = await open({ bond: 420, down: true });
      await say(page, 'ボスって呼んで');
      const last = await page.locator('[data-assistant-chat-msg="assistant"]').last().innerText();
      check('⑪ API が止まっていても、端末の読み取りでカードが出て、返事は台本', await page.locator('[data-assistant-callname-card="call"]').count() === 1 && /ボス/.test(last) && !/うまく話せない/.test(last), last.slice(0, 40));
      check('⑪ 実行時エラーがない', errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
    { // ⑬
      const { page, errors } = await open({ bond: 1300, extra: { mh_assistant_call_style: null } });
      const asked = await page.locator('[data-assistant-callname-card="ask"]').count();
      const choices = await page.locator('[data-assistant-callname-choice]').count();
      check('⑬ Lv6 で開くと、助手から聞いて候補のボタンが出る', asked === 1 && choices >= 2, `${asked} / ${choices}`);
      check('⑬ 聞いたことが mh_assistant_callname_ask_v1 に残る', ((await ls(page, 'mh_assistant_callname_ask_v1')) || {}).mua?.asked === true);
      await page.locator('[data-assistant-callname-choice]').first().dispatchEvent('click'); await page.waitForTimeout(300);
      const saved = await ls(page, 'mh_assistant_callname_v1');
      check('⑬ 候補を押すと、その呼び方に決まる(by:ask)', saved && saved.mua && saved.mua.by === 'ask');
      check('⑬ 実行時エラーがない', errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
    { // ⑭
      const { page } = await open({ flag: false, bond: 1300, extra: { mh_assistant_call_style: null } });
      await say(page, 'あっちゃんって呼んで');
      check('⑭ 公開の印が偽のときは、カードも問いかけも出ない', await page.locator('[data-assistant-callname-card]').count() === 0 && (await ls(page, 'mh_assistant_callname_ask_v1')) === null);
      await page.close();
    }
  } finally { await b.close(); server.close(); }
};

(async () => {
  await fast();
  if (!process.env.CALLNAME_FAST) await browser();
  console.log(failed ? `\nNG ${failed}件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();
