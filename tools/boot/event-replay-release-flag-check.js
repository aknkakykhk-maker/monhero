#!/usr/bin/env node
// イベント回想(EVENT_REPLAYS・data/assistants.js)に書いた releaseFlag が、
// 出し分けの表(EVENT_REPLAY_RELEASE_FLAGS・src/parts/10-core.jsx)に載っているかを見る。
//
//   node tools/boot/event-replay-release-flag-check.js
//
// 【なぜ要るか】
// 表に無い名前を書くと「公開前」と判定され、HOME で流し始めても表示する中身が見つからず、
// 何も出ないまま終わる。回想の一覧にも出ない。画面はふつうに動くので気づけない。
// 2026-10-07、マスモンを呼ぶストーリー(releaseFlag: 'rhythmMulti')で実際に起きた
// (ユーザー報告「いまはじめてひらいたけどストーリー流れなかったよ」)。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const assistants = fs.readFileSync(path.join(ROOT, 'monster-hero/data/assistants.js'), 'utf8');
const core = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/10-core.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

const start = assistants.indexOf('const EVENT_REPLAYS');
check('EVENT_REPLAYS を見つけられる', start >= 0);
const replays = start >= 0 ? assistants.slice(start, assistants.indexOf('\n];', start)) : '';
const used = [...new Set([...replays.matchAll(/releaseFlag:\s*'([A-Za-z0-9_]+)'/g)].map((m) => m[1]))];
const tableStart = core.indexOf('const EVENT_REPLAY_RELEASE_FLAGS');
check('EVENT_REPLAY_RELEASE_FLAGS を見つけられる', tableStart >= 0);
const table = tableStart >= 0 ? core.slice(tableStart, core.indexOf('\n});', tableStart)) : '';
const known = new Set([...table.matchAll(/^\s*(?:get\s+)?([A-Za-z0-9_]+)\s*(?:\(\)|:)/gm)].map((m) => m[1]));
const missing = used.filter((flag) => !known.has(flag));
check('回想に書いた releaseFlag は、すべて出し分けの表に載っている', missing.length === 0, missing.length ? `表に無い: ${missing.join(', ')}` : used.join(', '));

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
