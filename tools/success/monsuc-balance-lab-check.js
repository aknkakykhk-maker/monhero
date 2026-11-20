// モンサクのバランス研究(r1119-014 PR2・tools/success/monsuc-balance-lab.js)を、本番の API を使わずに確かめる。
//
//   node tools/success/monsuc-balance-lab-check.js      (約10秒)
//
//   ① 同じ回(i)を2回まわすと同じ結果(再現できる)
//   ② 試合の入力がゲーム本体と同じ: MONSUC_MATCH_RULE・作戦の値(MSX_R3_GEAR)・試合型アシストの上乗せ(buffs.A)・aptUp・覚醒
//   ③ 少ない回数でも、育て方7つ・助手8人・編成6つが全部まわる
//   ④ 40回を2並列で回して、止まった回0・数でない値0・表に各節がある
//   ⑥ おまかせのアシストが編成に本当に入る・選択肢の無い出来事(記念日)にも効き目がかかる(2026-11-20 の穴の見張り)
//   ⑤ 偽物の Claude をつないだ入り口(本物の core.js)へ送って、報告書が書ける(費用0)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const { makeLab, STRATEGIES, TEAMS } = require('./balance-lab/run.js');
  const lab = makeLab();
  const { SUC, GAME } = lab;

  // ①
  const r1 = lab.runOne(7); const r2 = lab.runOne(7);
  check('① 同じ回は同じ結果', same(r1, r2), `${r1.power} / ${r2.power}`);
  check('① 育成は最後まで進む', r1.over === true && Number.isFinite(r1.power) && r1.power > 0);

  // ②: 試合ごとに、入力をゲームの式から別に作った期待値と比べる
  let fights = 0, ruleOk = 0, gearOk = 0, buffSeen = 0, buffOk = 0, aptOk = 0, awakeOk = 0;
  const spy = (f, s) => {
    if (!f) return;
    fights++;
    const inp = f.input;
    if (Object.keys(GAME.MONSUC_MATCH_RULE).every((k) => same(inp[k], GAME.MONSUC_MATCH_RULE[k]))) ruleOk++;
    if (inp.teamA.tactics === (GAME.MSX_R3_GEAR[SUC.periodOf(s.turn).key] || 10)) gearOk++;
    const bb = SUC.battleBuffs(s); const want = bb && bb.A ? bb.A : bb;
    const hasWant = want && typeof want === 'object' && Object.keys(want).length > 0;
    if (hasWant) { buffSeen++; if (inp.buffs && same(inp.buffs.A, want)) buffOk++; } else if (!inp.buffs) buffOk++;
    const m = inp.teamA.members[0];
    if (typeof SUC.aptSendOf !== 'function' || same(m.aptUp, SUC.aptSendOf(s))) aptOk++;
    if (s.awake ? same(m.awake, s.awake) : m.awake === undefined) awakeOk++;
  };
  // 試合型アシストを積んだ編成(battle-S)を含むよう、条件を探して回す
  const picks = [];
  for (let i = 0; picks.length < 6 && i < 5000; i++) { const c = lab.condOf(i); if (c.team === 'battle-S' || (picks.length < 2 && c.team === 'base')) picks.push(i); }
  picks.forEach((i) => lab.runOne(i, { spy }));
  check('② 試合を回した', fights >= 10, `${fights} 試合`);
  check('② MONSUC_MATCH_RULE が全試合に入る', ruleOk === fights);
  check('② 作戦の値がゲームと同じ(MSX_R3_GEAR)', gearOk === fights);
  check('② 試合型アシストの上乗せが buffs.A に入る(無い時は付けない)', buffOk === fights && buffSeen > 0, `上乗せあり ${buffSeen} 試合`);
  check('② aptUp・覚醒がゲームと同じ', aptOk === fights && awakeOk === fights);

  // ③
  const first = Array.from({ length: 80 }, (_, i) => lab.condOf(i));
  const kinds = (k) => new Set(first.map((c) => c[k])).size;
  check('③ 80回で育て方7つ・助手8人・編成6つが全部まわる', kinds('strategy') === Object.keys(STRATEGIES).length && kinds('aid') === SUC.AIDS.length && kinds('team') === TEAMS.length,
    `育て方 ${kinds('strategy')}・助手 ${kinds('aid')}・編成 ${kinds('team')}`);

  // ④
  const LAB = require('./monsuc-balance-lab.js');
  const out = fs.mkdtempSync(path.join(process.env.SCRATCH || os.tmpdir(), 'monsuc-lab-check-'));
  const res = await LAB.runAll({ runs: 40, workers: 2, out });
  const all = res.sum.all['全体'];
  check('④ 40回・止まった回0・数でない値0', all.n === 40 && all.errors === 0 && all.bad === 0, JSON.stringify({ n: all.n, errors: all.errors, bad: all.bad }));
  const table = fs.readFileSync(path.join(out, 'table.md'), 'utf8');
  check('④ 表に各節がある', ['## 気になる点', '### 全体', '### 育て方ごと', '### 編成ごと', '### 助手ごと', '### 育て方 × 編成', '### 子(種)ごと'].every((h) => table.includes(h)));
  check('④ 表に NaN・undefined が無い', !/NaN|undefined/.test(table));
  check('④ 1回1行の記録がある', fs.readdirSync(out).filter((f) => /^rows-\d+\.jsonl$/.test(f)).length === 2);

  // ⑥ 2026-11-20 に見つかった穴の見張り: autoPick の入れ物ごと渡してアシストが空になる/見るだけの出来事を素通りする
  {
    const tm = lab.teamOf('real-S');
    const st = SUC.newRun({ id: 'lab-check-6', species: lab.species[0], aid: lab.aids[0], team: tm });
    const n = st.team.filter((m) => Array.isArray(m.assists) && m.assists.length > 0).length;
    check('⑥ おまかせのアシストが芯の編成に入る(real-S の6体)', n === 6, `アシストのある子 ${n}/6`);
    const seen = new Set();
    for (let i = 0; i < 12; i++) lab.runOne(i, { onEvent: (id) => seen.add(id) });
    check('⑥ 選択肢の無い出来事(記念日 ev.self.anniv)にも効き目がかかる', seen.has('ev.self.anniv'), `出た出来事 ${seen.size} 種`);
  }

  // ⑤ 入り口(本物の core.js)+ 偽物の Claude を手元に立てて、報告書まで
  const core = await import(path.join(ROOT, 'supabase', 'functions', 'analysis-gateway', 'core.js'));
  const TOKEN = 'lab-check-token-0123456789';
  let sentReq = null;
  const fakeClient = { beta: { messages: { stream: (p) => { sentReq = p; return { finalMessage: async () => ({ model: 'claude-opus-5-5', stop_reason: 'end_turn', content: [{ type: 'text', text: '## 全体の様子\n偽物の報告です。' }], usage: { input_tokens: 7000, output_tokens: 3000 } }) }; } } } };
  const rows = [];
  const db = {
    reserve: async (a) => { rows.push({ ...a, status: 'reserved' }); return { ok: true, id: rows.length, used: 0 }; },
    finish: async (id, f) => { Object.assign(rows[id - 1], f); return true; },
    attachBatch: async () => {}, findBatch: async () => null, dayUsed: async () => 0,
  };
  const server = http.createServer(async (req, resp) => {
    let body = ''; for await (const c of req) body += c;
    const r = await core.handle({ token: req.headers['x-analysis-token'], expectedToken: TOKEN, body: JSON.parse(body), client: fakeClient, db });
    resp.writeHead(r.status, { 'content-type': 'application/json' }); resp.end(JSON.stringify(r.json));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const env = { url: process.env.ANALYSIS_GATEWAY_URL, token: process.env.ANALYSIS_GATEWAY_TOKEN };
  process.env.ANALYSIS_GATEWAY_URL = `http://127.0.0.1:${server.address().port}/`;
  process.env.ANALYSIS_GATEWAY_TOKEN = TOKEN;
  const reportDir = path.join(out, 'reports');
  const file = await LAB.analyze({ from: out, dry: false, reportDir });
  server.close();
  if (env.url === undefined) delete process.env.ANALYSIS_GATEWAY_URL; else process.env.ANALYSIS_GATEWAY_URL = env.url;
  if (env.token === undefined) delete process.env.ANALYSIS_GATEWAY_TOKEN; else process.env.ANALYSIS_GATEWAY_TOKEN = env.token;
  const report = typeof file === 'string' && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  check('⑤ 報告書が書ける', report.includes('偽物の報告です。') && report.includes('費用 $0.088'), path.basename(String(file)));
  check('⑤ 送ったのは表と前置きだけ(モデルは opus-5-5)', sentReq && sentReq.model === 'claude-opus-5-5' && sentReq.messages[0].content[0].text === table && sentReq.system === LAB.SYSTEM);
  check('⑤ 使った量が記録された', rows.length === 1 && rows[0].kind === 'balance' && rows[0].status === 'done');
  check('⑤ 集計の JSON も並べて置く', fs.existsSync(String(file).replace(/-report\.md$/, '-summary.json')));
  check('⑤ 報告書に合言葉が入らない', !report.includes(TOKEN));

  fs.rmSync(out, { recursive: true, force: true });
  console.log(failed ? `\nNG ${failed} 件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
