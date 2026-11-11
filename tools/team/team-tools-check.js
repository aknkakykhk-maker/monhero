// トークン節約の仕組みの道具(モデルの表・会話の区切りのフック・依頼文・台帳の絞り込み・手引き)が、決めたとおりに動くかを確かめる。
//
//   node tools/team/team-tools-check.js
//
// 【なぜあるか】(2026-11-11 社長「トークンを無駄に使わない仕組み」「開発品質は落としたくない」)
// 仕組みは「人が覚えておく決まり」をやめて道具に任せた。道具が黙って違う答えを出すと、だれも気づかない
// (高いモデルで小さな直しを回す・壊すと戻せない所を安いモデルに回す・長い会話に知らせが出ない)。
//   ① モデルの表: 小さな直し → sonnet / 設計・原因不明 → opus / 見張り → haiku / 2回直しても直らない・最終確認 → fable
//   ② 保存データ・ランキング・SQL の語がある仕事は、ほかの語が何でも opus 以上
//   ③ 会話の区切りのフック: 目安の前は黙る・超えたら1行・毎回は出さない・壊れた入力でも止めない
//   ④ 新しい会話の依頼文: 部の手引き・decisions・gate・報告先が入り、台帳の全文を読ませない。短い(3KB 未満)
//   ⑤ 台帳の絞り込み: どの部も 30KB 未満(台帳そのものは 300KB 超)・「進め方」が全部入る
//   ⑥ 部の手引き: どの部も 1枚 5KB 未満
//   ⑦ 新しい会話の立ち上がりで読む量が、どの部も 60KB 未満
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ROOT, loadDepts, loadRouting } = require('./lib');
const { pick } = require('./model-pick');
const { build } = require('./newsession');
const { collect } = require('./decisions');
const hook = require('../hooks/session-length-nudge.js');

const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); };
const model = (text, o) => pick(text, o).kind.model;

// ①
const CASES = [
  ['更新履歴の固定の札の題を変える', 'claude-sonnet-5-5'],
  ['技名をもっと太く・札が左寄せに見える', 'claude-sonnet-5-5'],
  ['iPhone で助手が縦に伸びるのを直して', 'claude-sonnet-5-5'],
  ['助手ライフ新UI STEP5 を段取りどおりに実装して', 'claude-sonnet-5-5'],
  ['毎晩の判定の異変の報告を読んで一覧にする', 'claude-haiku-5-5'],
  ['オート∞で1時間に95MB増える件の原因を突き止める', 'claude-opus-5-5'],
  ['新しい遊び方の設計の案を出す', 'claude-opus-5-5'],
  ['新機能の公開前の最終確認', 'claude-fable-5-2'],
  // 迷ったら上(当たる語が無い=分からない仕事は、安いモデルに回さない)
  ['なんでもない頼み', 'claude-sonnet-5-5'],
  ['文言を直しつつ原因を調べる', 'claude-opus-5-5'],
  // 道具を作る・強化するのは最新モデル(1回)、できた道具を回してまとめるのは安いモデル(2026-11-11 社長)
  ['譜面の全曲点検の道具を作る', 'claude-fable-5-2'],
  ['rhythm-chart-review.js を回して全曲点検の結果をまとめる', 'claude-sonnet-5-5'],
  ['全譜面の MISS になる所を洗い出してまとめる', 'claude-sonnet-5-5'],
];
for (const [text, want] of CASES) { const got = model(text); ok(got === want, `① 「${text}」は ${want} のはずが ${got}`); }
ok(model('モンスターノーツのかくつきを直す', { failed: 2 }) === 'claude-fable-5-2', '① 2回直して直らない不具合は claude-fable-5-2');
ok(model('モンスターノーツのかくつきを直す', { failed: 1 }) !== 'claude-fable-5-2', '① 1回目の直しでは claude-fable-5-2 を使わない');
// ②
for (const text of ['ランキングの文言を直して', '保存データの題を変える', 'SQL を足す小さな直し', 'mh_foo の色を変える', '移行の誤字']) {
  const got = model(text);
  ok(['claude-opus-5-5', 'claude-fable-5-2'].includes(got), `② 「${text}」は壊すと戻せない所なので opus 以上のはずが ${got}`);
}
const R = loadRouting();
ok(R['種類'].every(k => /^claude-(haiku|sonnet|opus|fable)-\d/.test(k.model)), '① 表のモデルの名前の形');

// ③
const limit = R['区切り'];
ok(hook.message({ prompts: limit['やりとり'] - 1, merges: 0 }, limit) === '', '③ 目安の前は黙る');
// 部署には要約(/compact)を勧めない。要約は窓口の会話だけ(台帳 2026-11-11・2026-11-12 社長「ここ以外は要約しないんじゃないの？」)
for (const k of [1, 20, 25, 39, 40, 50, 60]) for (const m of [0, 3, 5, 9]) { const t = hook.message({ prompts: k, merges: m }, limit); ok(!/要約\(\/compact\)を?[かけ頼]|--compact/.test(t) || /要約\(\/compact\)は頼まない/.test(t), `③ 部署の知らせで要約を勧めない(やりとり${k}・公開${m})`); }
{ const r = spawnSync('node', [path.join(__dirname, 'handoff.js'), 'assistant-life', '--compact'], { encoding: 'utf8' }); ok(r.status !== 0 && /要約は窓口だけ/.test(r.stderr), '③ handoff <部> --compact は NG で止まる(部署は要約しない)'); }
ok(/会話がとても長い/.test(hook.message({ prompts: limit['やりとり'], merges: 0 }, limit)), '③ 2段目: 替える目安に届いたら引き継ぎメモを知らせる');
ok(/作業の途中では替えない/.test(hook.message({ prompts: limit['やりとり'], merges: 0 }, limit)), '③ 2段目でも作業の途中では替えさせない');
ok(/会話がとても長い/.test(hook.message({ prompts: limit['やりとり'] + limit['くり返し'], merges: 0 }, limit)), '③ くり返しの回でまた知らせる');
ok(/公開 \d+ 件/.test(hook.message({ prompts: limit['くり返し'], merges: limit['公開'] }, limit)), '③ 公開の件数でも知らせる');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mh-team-'));
const tr = path.join(tmp, 't.jsonl');
const lines = [];
for (let i = 0; i < 3; i++) {
  lines.push(JSON.stringify({ type: 'user', message: { role: 'user', content: `頼み ${i}` } }));
  lines.push(JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'mcp__github__merge_pull_request', input: {} }] } }));
  lines.push(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } }));
}
lines.push('こわれた行 {');
fs.writeFileSync(tr, lines.join('\n'));
const n = hook.count(tr);
ok(n.prompts === 3 && n.merges === 3, `③ 数え方: やりとり3・公開3 のはずが ${JSON.stringify(n)}(道具の結果は数えない)`);
for (const input of ['', 'こわれた入力', JSON.stringify({ transcript_path: '/無い/場所' }), JSON.stringify({ transcript_path: tr })]) {
  const r = spawnSync('node', [path.join(__dirname, '..', 'hooks', 'session-length-nudge.js')], { input, encoding: 'utf8' });
  ok(r.status === 0, `③ フックはどんな入力でも終了コード 0(止めない)のはずが ${r.status}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
const settings = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude', 'settings.json'), 'utf8'));
ok(JSON.stringify(settings.hooks && settings.hooks.UserPromptSubmit || '').includes('session-length-nudge.js'), '③ フックが .claude/settings.json の UserPromptSubmit に登録されていること');
ok(JSON.stringify(settings.hooks && settings.hooks.Stop || '').includes('japanese-only-check.js'), '③ 日本語のフック(Stop)が残っていること');

// ④⑤⑥
for (const d of loadDepts()) {
  const s = build(d, '表示のずれを直す', {});
  ok(s.prompt.includes(`docs/depts/${d.id}.md`) && s.prompt.includes(`node tools/ctx.js decisions ${d.id}`), `④ ${d.id}: 依頼文に手引きと decisions が入ること`);
  ok(s.prompt.includes('node tools/ctx.js gate') && /session_[0-9A-Za-z]+/.test(s.prompt) && s.prompt.includes('日本語'), `④ ${d.id}: 依頼文に gate・報告先・日本語が入ること`);
  ok(!/PRESIDENT_DECISIONS\.md を読/.test(s.prompt), `④ ${d.id}: 依頼文で台帳の全文を読ませないこと`);
  ok(Buffer.byteLength(s.prompt) < 3000, `④ ${d.id}: 依頼文は 3KB 未満のはずが ${Buffer.byteLength(s.prompt)}`);
  const c = collect(d, {});
  const bytes = Buffer.byteLength([...c.how, ...c.undated, ...c.recent].join('\n'));
  ok(bytes < 30000, `⑤ ${d.id}: 台帳の絞り込みは 30KB 未満のはずが ${bytes}(tools/team/depts.json の「語」が広すぎる)`);
  ok(c.how.length >= 5, `⑤ ${d.id}: 「進め方」が入っていること`);
  const guide = path.join(ROOT, 'docs', 'depts', `${d.id}.md`);
  if (fs.existsSync(guide)) ok(fs.statSync(guide).size < 5000, `⑥ docs/depts/${d.id}.md は 5KB 未満のはずが ${fs.statSync(guide).size}`);
}

// ⑦ 新しい会話の立ち上がりで読む量(CLAUDE.md + 部の手引き + 決めごとの絞り込み + 依頼文)が、どの部も 60KB 未満
//    (仕組みの前は CLAUDE.md 16KB + 台帳 320KB + 申し送り 4KB = 約340KB)
const claudeMd = fs.statSync(path.join(ROOT, 'CLAUDE.md')).size;
let maxBoot = 0;
for (const d of loadDepts()) {
  const c = collect(d, {});
  const boot = claudeMd + fs.statSync(path.join(ROOT, 'docs', 'depts', `${d.id}.md`)).size + Buffer.byteLength([...c.how, ...c.undated, ...c.recent].join('\n')) + Buffer.byteLength(build(d, '表示のずれを直す', {}).prompt);
  maxBoot = Math.max(maxBoot, boot);
  ok(boot < 60000, `⑦ ${d.id}: 立ち上がりで読む量は 60KB 未満のはずが ${boot}`);
}

if (problems.length) { console.error(`NG: トークン節約の仕組みの道具に ${problems.length} 件の問題`); for (const p of problems) console.error(`  - ${p}`); process.exit(1); }
console.log(`OK: モデルの表 ${CASES.length + 7} 例・会話の区切りのフック・依頼文・台帳の絞り込み・手引き(${loadDepts().length} 部)・立ち上がりで読む量 最大 ${(maxBoot / 1024).toFixed(0)}KB`);
