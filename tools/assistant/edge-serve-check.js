// 助手とおしゃべりの中継役の入口(supabase/functions/assistant-chat/serve.js と index.ts)を、Deno も本番も使わずに確かめる。
//
//   node tools/assistant/edge-serve-check.js
//
// 【なぜあるか】(2026-11-11 トークン節約の仕組み・案E)
// 配り直しで送る量を減らすため、index.ts の本体を serve.js へ移し、配る index.ts を「GitHub の固定の版から
// serve.js を読む」数行にした。入口はこれまで検査が無く(core.js だけ見ていた)、移したときに壊しても気づけない。
// 偽物の Deno・Anthropic・Supabase を渡して、入口が前と同じ返事をすることを見る。
//   ① index.ts は npm の部品2つと ./serve.js だけを読み、start() を呼ぶ(配るときに URL へ替える所が1か所だけ)
//   ② serve.js は npm: や TypeScript の型を持たない(.js のまま raw から読める)
//   ③ OPTIONS → 200 / POST 以外 → 405 / 許していない Origin → 403
//   ④ 材料(digest)が読めない → 「ごめん、今うまく話せないや」(200)
//   ⑤ 空の本文 → 400 bad_request(配ったあとに窓口が確かめるのと同じ返事)
//   ⑥ Secrets の上限(環境変数)が既定値より優先され、提案の1人の上限の既定は 100(社長の決定 2026-11-09)
//   ⑦ 配り直しの道具(edge-redeploy.js)が作る index.ts が、URL を1か所替えただけの数行になっている
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '..', '..');
const DIR = path.join(root, 'supabase', 'functions', 'assistant-chat');
const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); };

async function main() {
  const index = fs.readFileSync(path.join(DIR, 'index.ts'), 'utf8');
  const serveSrc = fs.readFileSync(path.join(DIR, 'serve.js'), 'utf8');

  // ①
  const imports = index.split('\n').filter(l => /^import /.test(l));
  ok(imports.length === 3, `① index.ts の import は3つ(npm の部品2つと ./serve.js)のはずが ${imports.length} 個`);
  ok((index.match(/"\.\/serve\.js"/g) || []).length === 1, '① index.ts に "./serve.js" がちょうど1か所あること(配るときにここを URL へ替える)');
  ok(/start\(\{ Anthropic, createClient \}\);/.test(index), '① index.ts が start({ Anthropic, createClient }) を呼んでいること');
  ok(Buffer.byteLength(index) < 1500, `① index.ts は数行のはずが ${Buffer.byteLength(index)} バイト(本体は serve.js へ)`);
  // ②
  ok(!/from\s+["']npm:/.test(serveSrc), '② serve.js は npm: の部品をじかに読まない(index.ts から渡す)');
  ok(!/:\s*(string|number|unknown|any)\b[,)=]/.test(serveSrc.replace(/\/\/.*$/gm, '')), '② serve.js に TypeScript の型が残っている(.js のまま読ませる)');

  // 偽物の Deno・部品
  const env = { SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'x', SUPABASE_ANON_KEY: 'y', ASSISTANT_CHAT_USER_DAILY_LIMIT: '7' };
  let handler = null;
  globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };
  class FakeAnthropic { constructor(o) { this.opts = o; this.messages = { create: async () => { throw new Error('この検査では Claude を呼ばない'); } }; } }
  const rpcCalls = [];
  const fakeClient = () => ({
    rpc: async (fn, args) => { rpcCalls.push([fn, args]); return { data: { ok: true }, error: null }; },
    from: () => ({ select: () => ({ eq: () => ({ like: async () => ({ data: [], error: null }) }) }) }),
  });
  const logs = [];
  const origLog = console.log;
  let digestOk = false;
  const digest = JSON.parse(fs.readFileSync(path.join(root, 'monster-hero', 'data', 'assistant-chat-digest.json'), 'utf8'));
  globalThis.fetch = async () => digestOk ? { ok: true, json: async () => digest } : { ok: false, status: 503, json: async () => ({}) };

  const mod = await import(pathToFileURL(path.join(DIR, 'serve.js')).href);
  ok(typeof mod.start === 'function', 'serve.js が start を出していること');
  mod.start({ Anthropic: FakeAnthropic, createClient: fakeClient });
  ok(typeof handler === 'function', 'start() が Deno.serve に受け口を渡していること');
  if (!handler) return;

  const ORIGIN = 'https://aknkakykhk-maker.github.io';
  const req = (method, origin, body) => new Request('https://example.invalid/assistant-chat', { method, headers: origin ? { origin, 'content-type': 'application/json' } : {}, body: body === undefined ? undefined : body });
  const call = async (r) => { console.log = (...a) => logs.push(a.join(' ')); try { const res = await handler(r); return { status: res.status, text: await res.text(), headers: res.headers }; } finally { console.log = origLog; } };

  // ③
  let r = await call(req('OPTIONS', ORIGIN));
  ok(r.status === 200 && r.text === 'ok', `③ OPTIONS は 200 ok のはずが ${r.status} ${r.text}`);
  ok(r.headers.get('access-control-allow-origin') === ORIGIN, '③ 許した Origin がそのまま返ること');
  r = await call(req('GET', ORIGIN));
  ok(r.status === 405, `③ POST 以外は 405 のはずが ${r.status}`);
  r = await call(req('POST', 'https://evil.example', '{}'));
  ok(r.status === 403 && /"origin"/.test(r.text), `③ 許していない Origin は 403 origin のはずが ${r.status} ${r.text}`);
  r = await call(req('POST', null, '{}'));
  ok(r.status === 403, `③ Origin 無しは 403 のはずが ${r.status}`);
  // ④
  r = await call(req('POST', ORIGIN, '{}'));
  ok(r.status === 200 && /"kind":"sorry"/.test(r.text), `④ 材料が読めないときは sorry(200) のはずが ${r.status} ${r.text.slice(0, 80)}`);
  ok(logs.some(l => /digest_unavailable/.test(l)), '④ digest_unavailable を記録すること');
  // ⑤
  digestOk = true;
  r = await call(req('POST', ORIGIN, ''));
  ok(r.status === 400 && /bad_request/.test(r.text), `⑤ 空の本文は 400 bad_request のはずが ${r.status} ${r.text.slice(0, 80)}`);
  r = await call(req('POST', ORIGIN, '{}'));
  ok(r.status === 400 && /bad_request/.test(r.text), `⑤ 中身の無い頼みは 400 bad_request のはずが ${r.status} ${r.text.slice(0, 80)}`);
  ok(rpcCalls.length === 0, '⑤ 不正な頼みで回数を使わないこと');

  // ⑥ 上限: 環境変数が優先・提案の1人の既定は 100
  const core = await import(pathToFileURL(path.join(DIR, 'core.js')).href);
  ok(core.SUGGEST_USER_LIMIT === 100, `⑥ 提案の1人の上限の既定は 100(社長の決定)のはずが ${core.SUGGEST_USER_LIMIT}`);
  ok(/user: envInt\("ASSISTANT_CHAT_USER_DAILY_LIMIT", USER_DAILY_LIMIT\)/.test(serveSrc) && /suggestUser: envInt\("ASSISTANT_MASMON_SUGGEST_USER_DAILY_LIMIT", SUGGEST_USER_LIMIT\)/.test(serveSrc), '⑥ 上限は Secrets(環境変数)→ 既定値 の順で決めること');

  // ⑦ 配り直しの道具
  const { buildDeploy } = require('./edge-redeploy.js');
  const sha = '0123456789abcdef0123456789abcdef01234567';
  const d = buildDeploy('assistant-chat', sha);
  ok(d.files.length === 1 && d.files[0].name === 'index.ts', '⑦ 配るファイルは index.ts の1つだけ');
  const c = d.files[0].content;
  ok(c.includes(`https://raw.githubusercontent.com/aknkakykhk-maker/monhero/${sha}/supabase/functions/assistant-chat/serve.js`), '⑦ serve.js を固定の版(raw)から読むこと');
  ok(!c.includes('./serve.js') && !/jsdelivr/.test(c), '⑦ 相対の読み込み・jsdelivr が残っていないこと');
  ok(Buffer.byteLength(c) < 1500, `⑦ 配る index.ts は数行のはずが ${Buffer.byteLength(c)} バイト`);
  ok(d.verify_jwt === false, '⑦ verify_jwt は外す');
}

main().then(() => {
  if (problems.length) { console.error(`NG: 中継役の入口に ${problems.length} 件の問題`); for (const p of problems) console.error(`  - ${p}`); process.exit(1); }
  console.log('OK: 中継役の入口(index.ts は数行・serve.js が前と同じ返事・配り直しは1ファイル数行)');
}).catch(e => { console.error('NG: 検査自体が失敗:', e && e.stack || e); process.exit(1); });
