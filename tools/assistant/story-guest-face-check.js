#!/usr/bin/env node
// お話で、名札(name)をゲストの名前に変えて話す台詞に、そのゲストの顔(stage)が付いているかを見張る。
//
//   node tools/assistant/story-guest-face-check.js
//
// 【2026-11-08 レフェリーくん・社長「セリフで悪魔のパンドラと天使のパンドラの顔アイコンも変えて」】
//   イベント「パンドラとふたつの翼」第7話は、話し手(who)は 'pandora' のまま、名札だけ「悪魔のパンドラ」「天使のパンドラ」にしていた。
//   上の段の顔は who(か stage)で決まるので、悪魔・天使の台詞でも、ふだんのパンドラ(半分ずつ)の顔が出ていた。
//   直し: 顔だけ違うゲスト pandoraDevil / pandoraAngel を足し、台詞に stage を付けた(data/assistants.js)。
// 見ること:
//   ① 名札がゲストの名前と同じで、話し手がそのゲストでない台詞は、stage にそのゲストを書いている(顔を出さない場面は stage:'none')
//   ② stage に書いた名前が、ゲストの一覧にある(書き間違えると顔が出ない)
//   ③ ゲストの顔の絵(悪魔・天使のパンドラ)が、ファイルとして置いてある
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const src = fs.readFileSync(path.join(ROOT, 'monster-hero/data/assistants.js'), 'utf8');
const lines = src.split('\n');
const guests = {};
const allIds = new Set();
for (const ln of lines) {
  const m = ln.match(/^\s*\{ id: '([^']+)', name: '([^']+)', role: '([^']+)'/);
  if (!m) continue;
  allIds.add(m[1]);
  if (m[3] === 'ゲスト') guests[m[1]] = m[2];
}
check('ゲストの一覧が読める(パンドラ・悪魔のパンドラ・天使のパンドラを含む)', guests.pandora === 'パンドラ' && guests.pandoraDevil === '悪魔のパンドラ' && guests.pandoraAngel === '天使のパンドラ', JSON.stringify(guests).slice(0, 200));
const byName = {};
for (const [id, name] of Object.entries(guests)) byName[name] = id;

const missing = [];
const badStage = [];
let seen = 0;
lines.forEach((ln, i) => {
  const who = (ln.match(/\bwho:\s*'([^']+)'/) || [])[1];
  if (!who) return;
  const name = (ln.match(/\bname:\s*'([^']+)'/) || [])[1];
  const stage = (ln.match(/\bstage:\s*'([^']+)'/) || [])[1];
  if (stage && stage !== 'none' && !allIds.has(stage)) badStage.push(`${i + 1}行 stage:'${stage}'`);
  if (!name) return;
  const g = byName[name];
  if (!g || g === who) return;
  seen++;
  if (stage !== g && stage !== 'none') missing.push(`${i + 1}行 「${name}」(who:'${who}'${stage ? ` stage:'${stage}'` : ''})`);
});
check('① 名札がゲストの名前の台詞に、そのゲストの顔(stage)が付いている', missing.length === 0 && seen > 0, missing.length ? missing.join(' / ') : `${seen}行`);
check('② stage に書いた名前が、一覧にある', badStage.length === 0, badStage.join(' / '));
const img = fs.readFileSync(path.join(ROOT, 'monster-hero/data/images/images-ally.js'), 'utf8');
const faces = ['PANDORA_DEVIL_FACE_ICON', 'PANDORA_ANGEL_FACE_ICON'].map((k) => [k, (img.match(new RegExp(`const ${k} = "([^"?]+)`)) || [])[1]]);
check('③ 悪魔・天使のパンドラの顔の絵が置いてある', faces.every(([, f]) => f && fs.existsSync(path.join(ROOT, 'monster-hero', f))), JSON.stringify(faces));
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
