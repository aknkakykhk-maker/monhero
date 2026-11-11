#!/usr/bin/env node
// 「会話が長い」の知らせ(session-length-nudge.js)が、最後の要約(/compact)のあとから数えているかを、偽のトランスクリプトで確かめる
// (2026-11-11 社長「そこちゃんとしてくれないと信用できない」。窓口で、要約した直後なのに「やりとり890回・公開222件」と出ていた)。
//   node tools/hooks/session-length-nudge-compact-check.js
//   ① 要約が無い会話は、今までどおり全部数える(やりとり50回→「とても長い」)
//   ② 要約の境目(system / compact_boundary)と要約文(isCompactSummary)のあとから数え直す。直後は何も知らせない
//   ③ 要約文の行は「やりとり」に数えない・要約の前の公開は数えない・あとの公開は数える
//   ④ 本文や道具の結果に「compact_boundary」と書いてあるだけの行は、境目として扱わない(数えたままになる)
//   ⑤ 要約のあとにまた長くなったら、「最後の要約のあと」と付けて知らせる(部署には要約を勧めず引き継ぎメモ)(2回目以降の要約でも、あとの数だけで決まる)
//   ⑥ フックを実際に起動しても同じ(要約前は出る・要約後は出ない)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const hook = require('./session-length-nudge.js');
const limit = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'team', 'routing.json'), 'utf8'))['区切り'];

let failed = 0;
const ok = (cond, label, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };

const user = (text) => JSON.stringify({ type: 'user', message: { role: 'user', content: text } });
const toolResultUser = (text) => JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: text }] } });
const merge = () => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'y', name: 'mcp__github__merge_pull_request', input: {} }] } });
const boundary = () => JSON.stringify({ type: 'system', subtype: 'compact_boundary', content: 'Conversation compacted', compactMetadata: { trigger: 'manual', preTokens: 120000 } });
const summary = () => JSON.stringify({ type: 'user', isCompactSummary: true, message: { role: 'user', content: 'This session is being continued from a previous conversation… (要約)' } });
const many = (n, f) => Array.from({ length: n }, f);
const write = (name, lines) => { const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nudge-')), name); fs.writeFileSync(p, lines.join('\n') + '\n'); return p; };

// ① 要約なし
{
  const p = write('a.jsonl', [...many(50, (_, i) => user(`頼み${i}`)), ...many(6, merge)]);
  const n = hook.count(p);
  ok(n.prompts === 50 && n.merges === 6 && n.compacts === 0, '① 要約が無い会話は全部数える', JSON.stringify(n));
  ok(hook.message(n, limit).includes('【会話がとても長い】'), '① 長ければ(10回ごとの節目で)「とても長い」を出す');
}
// ② ③ 要約のあとから
{
  const lines = [...many(890, (_, i) => user(`前の頼み${i}`)), ...many(222, merge), boundary(), summary(), user('要約のあとの頼み1'), user('頼み2'), merge()];
  const p = write('b.jsonl', lines);
  const n = hook.count(p);
  ok(n.prompts === 2 && n.merges === 1 && n.compacts === 1, '② 要約のあとから数え直す(890回・222件を引きずらない)', JSON.stringify(n));
  ok(hook.message(n, limit) === '', '② 要約した直後は何も知らせない');
  const justAfter = write('c.jsonl', [...many(890, (_, i) => user(`前${i}`)), ...many(222, merge), boundary(), summary()]);
  const z = hook.count(justAfter);
  ok(z.prompts === 0 && z.merges === 0 && hook.message(z, limit) === '', '③ 要約文の行は「やりとり」に数えない(直後は0・0)', JSON.stringify(z));
  // 境目だけ(要約文の行が無い記録)でも数え直す・要約文だけ(境目の行が無い記録)でも数え直す
  const onlyBoundary = hook.count(write('d.jsonl', [...many(50, (_, i) => user(`前${i}`)), boundary(), user('あと')]));
  const onlySummary = hook.count(write('e.jsonl', [...many(50, (_, i) => user(`前${i}`)), summary(), user('あと')]));
  ok(onlyBoundary.prompts === 1 && onlySummary.prompts === 1, '② 境目だけ・要約文だけの記録でも数え直す', `${onlyBoundary.prompts} / ${onlySummary.prompts}`);
}
// ④ 文中の言葉は境目にしない
{
  const lines = [...many(45, (_, i) => user(`頼み${i}`)), toolResultUser('{"subtype":"compact_boundary"} と isCompactSummary の話をしている'), user('compact_boundary について教えて')];
  const n = hook.count(write('f.jsonl', lines));
  ok(n.prompts === 46 && n.compacts === 0, '④ 文中に compact_boundary と書いてあるだけの行は境目にしない', JSON.stringify(n));
}
// ⑤ 要約のあとにまた長くなる(2回要約した会話)
{
  const lines = [...many(100, (_, i) => user(`一期${i}`)), boundary(), summary(), ...many(30, (_, i) => user(`二期${i}`)), ...many(2, merge), boundary(), summary(), ...many(40, (_, i) => user(`三期${i}`)), ...many(5, merge)];
  const n = hook.count(write('g.jsonl', lines));
  ok(n.prompts === 40 && n.merges === 5 && n.compacts === 2, '⑤ 2回要約した会話は、最後の要約のあとだけを数える', JSON.stringify(n));
  const m = hook.message(n, limit);
  ok(m.includes('【会話がとても長い】') && m.includes('最後の要約のあと') && m.includes('要約(/compact)は頼まない'), '⑤ 目安(40回・5件)を超えたら、「最後の要約のあと」と付けて引き継ぎメモを知らせる(部署に要約は勧めない)', m.slice(0, 60));
}
// ⑥ フックを実際に起動して、標準入力から
{
  const env = { ...process.env }; delete env.CLAUDE_CODE_REMOTE_SESSION_ID; // 窓口の会話で回しても部署の知らせ方で確かめる
  const run = (p) => spawnSync('node', [path.join(__dirname, 'session-length-nudge.js')], { input: JSON.stringify({ transcript_path: p }), encoding: 'utf8', env });
  const before = write('h.jsonl', [...many(890, (_, i) => user(`前${i}`)), ...many(222, merge)]);
  const after = write('i.jsonl', [...many(890, (_, i) => user(`前${i}`)), ...many(222, merge), boundary(), summary(), user('要約のあとの頼み')]);
  const rb = run(before), ra = run(after);
  ok(rb.status === 0 && rb.stdout.includes('【会話がとても長い】'), '⑥ 要約の前の記録では、フックが知らせる', rb.stdout.slice(0, 50));
  ok(ra.status === 0 && ra.stdout.trim() === '', '⑥ 要約のあとの記録では、フックは何も出さない', ra.stdout.slice(0, 50));
}
// ⑦ 窓口の会話では「替える」を出さず、要約してよいかを社長に聞くことだけを知らせる(2026-11-12 社長)
{
  const n = { prompts: 110, merges: 11, compacts: 1 };
  const m = hook.message(n, limit, { hq: true });
  ok(m.includes('【窓口・会話が長くなってきた】') && m.includes('AskUserQuestion') && !m.includes('handoff') && !m.includes('新しい会話'), '⑦ 窓口では要約の問いだけ(引き継ぎメモ・新しい会話を勧めない)', m.slice(0, 60));
  ok(hook.message({ prompts: 25, merges: 3, compacts: 0 }, limit, { hq: true }) === '', '⑦ 窓口は「替える」の目安(40回・5件)までは何も出さない');
  ok(hook.message({ prompts: 41, merges: 0, compacts: 0 }, limit, { hq: true }) === '', '⑦ 窓口も毎回は出さない(10回ごとの節目だけ)');
  const routing = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'team', 'routing.json'), 'utf8'));
  ok(hook.isHq(routing['窓口の会話'], { CLAUDE_CODE_REMOTE_SESSION_ID: 'cse_' + routing['窓口の会話'].replace(/^session_/, '') }), '⑦ 窓口の番号(cse_…)を窓口と見分ける');
  ok(!hook.isHq(routing['窓口の会話'], { CLAUDE_CODE_REMOTE_SESSION_ID: 'cse_ほかの部署' }) && !hook.isHq(routing['窓口の会話'], {}), '⑦ ほかの会話・番号が無いときは窓口にしない');
}
console.log(failed ? `\n${failed}件NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
