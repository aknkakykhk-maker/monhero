#!/usr/bin/env node
// 部署の会話でサブエージェント(Agent・Task・Workflow)を呼ぼうとしたら止める(Claude Code の PreToolUse フック)。
//
// 【なぜあるか】
// 台帳「進め方」の決めごと「部署はサブエージェントを使わない」は、依頼文の1行と人の記憶だけで守っていた。
// 2026-11-12 社長「決めたことを無視しないでちゃんと決めごととしての仕組み作ってね」(決めごとの錠)で、道具の側で止める形にした。
//
// 【止めるのは】クラウドの会話(環境変数 CLAUDE_CODE_REMOTE_SESSION_ID がある)で、窓口の会話(tools/team/routing.json の「窓口の会話」)ではないとき。
//   窓口の会話・手元の端末の会話(番号が無い)は止めない。
// 【止め方】終了コード 2 と、標準エラーに理由(Claude Code がその道具を呼ばずに、理由をモデルへ返す)。
// 【壊れても止めない】入力が読めない・routing.json が無いなど、判断がつかないときは終了コード 0(通す)。
//   echo '{"tool_name":"Agent"}' | CLAUDE_CODE_REMOTE_SESSION_ID=cse_xxx node tools/hooks/no-subagent-in-dept.js
'use strict';
const fs = require('fs');
const path = require('path');

const TOOLS = new Set(['Agent', 'Task', 'Workflow']);
const strip = (s) => String(s || '').replace(/^(cse|session)_/, '');

// 止めるなら理由の文、通すなら ''
function judge(toolName, hqSession, env) {
  if (!TOOLS.has(String(toolName || ''))) return '';
  const now = strip((env || {}).CLAUDE_CODE_REMOTE_SESSION_ID);
  if (!now) return ''; // 手元の端末の会話
  const hq = strip(hqSession);
  if (!hq || now === hq) return ''; // 窓口の会話(または窓口が分からない)
  return '部署の会話ではサブエージェント(Agent・Task・Workflow)を使いません(台帳「進め方」: 部署はサブエージェントを使わない)。自分で続けるか、手に余るなら窓口へ知らせてください。窓口の会話なのにこれが出たら、tools/team/routing.json の「窓口の会話」が古いので直してください。';
}

function main() {
  let data;
  try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { return 0; }
  let hq = '';
  try { hq = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'team', 'routing.json'), 'utf8'))['窓口の会話']; } catch (e) { return 0; }
  const why = judge(data && data.tool_name, hq, process.env);
  if (!why) return 0;
  process.stderr.write(why + '\n');
  return 2;
}

if (require.main === module) { let code = 0; try { code = main(); } catch (e) { code = 0; } process.exit(code); }
module.exports = { judge };
