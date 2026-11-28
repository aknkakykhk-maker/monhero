#!/usr/bin/env node
// 助手の絵の縁を原本と比べる検査の入口(本体は tools/assistant/art-edge-check.py。助手部ナカヨシ・2026-11-28 r1126-095 追記2)。
//   白い縁取り・外の線の消え・ギザギザ・ぼやけを原本と同じ物差しで測り、原本より悪ければ落とす。
//   run-checks.js から node で呼べるように、ここで python3 に渡すだけ(引数もそのまま渡す)
const { spawnSync } = require('child_process');
const path = require('path');
const r = spawnSync('python3', [path.join(__dirname, 'art-edge-check.py'), ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
