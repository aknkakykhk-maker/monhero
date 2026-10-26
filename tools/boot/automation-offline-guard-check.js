// 自動操作のブラウザ(navigator.webdriver が true)は、本物の Supabase へ何も出さない(2026-10-27・案A)。
// ふつうに遊ぶ人のブラウザ(webdriver が false)は何も変わらない、を確かめる。
//   ① 止める・通すの判定(26-supabase.jsx の sbAutomationBlocked)を、webdriver・差し替えの印・URL・メソッドの組み合わせで見る
//   ② 実ブラウザ: webdriver を false に偽ると、ゲームの fetch は差し替え先(page.route)へ届く。true のままだと
//      差し替えの印が無い限り、差し替え先へも届かず空の返事で止まる
const fs = require('fs'), vm = require('vm'), assert = require('assert'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');
const a = src.indexOf('const sbAutomationBlocked = '), b = src.indexOf('try {\n  if (typeof window !== \'undefined\' && typeof window.fetch === \'function\' && !window.__mhSupabaseWriteGuard)');
assert(a > 0 && b > a, '判定の関数が見つからない');
const make = (webdriver, stubbed) => {
  const ctx = { SUPABASE_URL: 'https://x.supabase.co', navigator: { webdriver }, window: { __mhSupabaseStubbed: stubbed }, String, Array, Object };
  vm.createContext(ctx);
  vm.runInContext(`${src.slice(a, b)}\n;globalThis.f=sbAutomationBlocked;`, ctx);
  return (url, method) => { const r = ctx.f(url, method); return r ? `${r.status}:${r.body}` : null; };
};
const U = 'https://x.supabase.co';
// ふつうに遊ぶ人(webdriver が false / 無い)は、何があっても通す
for (const wd of [false, undefined]) {
  const f = make(wd, undefined);
  for (const [u, m] of [[`${U}/rest/v1/rankings?select=*`, 'GET'], [`${U}/rest/v1/rankings`, 'POST'], [`${U}/rest/v1/rpc/x`, 'POST'], [`${U}/functions/v1/assistant-chat`, 'POST']])
    assert.strictEqual(f(u, m), null, `遊ぶ人のブラウザ(webdriver=${wd})を止めてはいけない: ${m} ${u}`);
}
console.log('OK: 遊ぶ人のブラウザ(webdriver が false)は、読み込みも書き込みも中継も何も止めない');
// 自動操作で印なし: 全部止める
const auto = make(true, undefined);
assert.strictEqual(auto(`${U}/rest/v1/rankings?select=*`, 'GET'), '200:[]');
assert.strictEqual(auto(`${U}/rest/v1/rankings`, 'HEAD'), '200:[]');
assert.strictEqual(auto(`${U}/rest/v1/rpc/rhythm_week_score_totals`, 'POST'), '200:[]');
assert.strictEqual(auto(`${U}/rest/v1/breeder_levels?on_conflict=breeder_id`, 'POST'), '201:[]');
assert.strictEqual(auto(`${U}/rest/v1/breeder_profiles`, 'PATCH'), '201:[]');
assert.strictEqual(auto(`${U}/rest/v1/bond_levels`, 'DELETE'), '201:[]');
assert.strictEqual(auto(`${U}/functions/v1/assistant-chat`, 'POST'), '503:{}');
assert.strictEqual(auto('https://other.example/rest/v1/rankings', 'GET'), null, 'Supabase 以外は触らない');
console.log('OK: 自動操作のブラウザ(印なし)は、読み込み=空・書き込み=201・rpc=空・中継=503 で止める');
// 印あり
assert.strictEqual(make(true, true)(`${U}/rest/v1/rankings`, 'POST'), null, '印(true)は全部通す');
const some = make(true, ['rankings', 'assistant-chat']);
assert.strictEqual(some(`${U}/rest/v1/rankings?x`, 'GET'), null, '並べた表は通す');
assert.strictEqual(some(`${U}/rest/v1/rankings`, 'POST'), null);
assert.strictEqual(some(`${U}/functions/v1/assistant-chat`, 'POST'), null, '並べた中継は通す');
assert.strictEqual(some(`${U}/rest/v1/breeder_profiles`, 'GET'), '200:[]', '並べていない表は、読み込みも止める');
assert.strictEqual(some(`${U}/rest/v1/breeder_profiles`, 'POST'), '201:[]');
console.log('OK: 差し替えの印(true / 表の名前の配列)は、並べたものだけ通す');

// ② 実ブラウザ
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); }
catch { console.log('SKIP: playwright が入っていないので、実ブラウザの確認は飛ばす'); process.exit(0); }
const http = require('http');
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  const ext = path.extname(file);
  res.writeHead(200, { 'Content-Type': ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : ext === '.css' ? 'text/css' : 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium' });
  const probe = async ({ human, stub }) => {
    const page = await browser.newPage();
    let routed = 0;
    await page.route(/zrzevudkbgtxlbvmuziy\.supabase\.co\/rest\/v1\/__guard_probe__/, (r) => { routed += 1; r.fulfill({ status: 200, contentType: 'application/json', body: '["ROUTED"]' }); });
    // ゲームの本体だけを読み込んで、止めの設置(fetch の差し替え)を見る。画面の起動までは待たない
    await page.addInitScript(({ human, stub }) => {
      if (human) Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false, configurable: true });
      if (stub) window.__mhSupabaseStubbed = stub;
    }, { human, stub });
    await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__mhSupabaseWriteGuard === true, { timeout: 60000 });
    const body = await page.evaluate(async () => {
      const r = await fetch('https://zrzevudkbgtxlbvmuziy.supabase.co/rest/v1/__guard_probe__?x=1');
      return { status: r.status, text: await r.text() };
    });
    await page.close();
    return { ...body, routed };
  };
  const player = await probe({ human: true, stub: undefined });
  assert.strictEqual(player.routed, 1, '遊ぶ人のブラウザ: 差し替え先(=ふつうの通信)へ届く');
  assert.strictEqual(player.text, '["ROUTED"]');
  const auto2 = await probe({ human: false, stub: undefined });
  assert.strictEqual(auto2.routed, 0, '自動操作・印なし: 差し替え先へも届かず、ゲーム側で止まる');
  assert.strictEqual(auto2.text, '[]');
  const stubbed = await probe({ human: false, stub: true });
  assert.strictEqual(stubbed.routed, 1, '自動操作・印あり: 検査の差し替え先へ届く');
  assert.strictEqual(stubbed.text, '["ROUTED"]');
  console.log('OK(実ブラウザ): 遊ぶ人は届く / 自動操作・印なしは止まる / 印ありは差し替え先へ届く');
  await browser.close();
  server.close();
})().catch((e) => { console.error('NG:', e.message); process.exit(1); });
