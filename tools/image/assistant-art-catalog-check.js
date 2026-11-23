// 助手の絵の目録が現行と合っているかを見る検査(台帳 r1119-124・r1119-128)。本体は tools/image/assistant-art-catalog.js の --check。
//   落ちるとき: 絵を替えたのに目録を作り直していない / 正本に書いたファイルが無い・保管庫を指している / 現行の絵が正本より古い /
//               現行フォルダに組に分けられない絵(旧版の疑い)がある / 保管庫へ移した旧版が元の場所に戻っている・保管庫に目録に無い絵がある
//   直し方: node tools/image/assistant-art-catalog.js(目録を書き直す)。正本を替えたときは tools/image/assistant-art-catalog.json を直してから
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const tool = path.join(__dirname, 'assistant-art-catalog.js');
let ng = false;
for (const flag of ['--selftest', '--check']) {
  const r = spawnSync(process.execPath, [tool, flag], { encoding: 'utf8' });
  const out = ((r.stdout || '') + (r.stderr || '')).trim().split('\n');
  console.log(out.slice(-8).join('\n'));
  if (r.status !== 0) ng = true;
}
if (ng) { console.error('NG: 助手の絵の目録が現行と合っていない(上の理由)。node tools/image/assistant-art-catalog.js で作り直す'); process.exit(1); }
