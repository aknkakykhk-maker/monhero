#!/usr/bin/env node
// AIコピー(ソラシドのアシカ)が出ても、元の4枠の位置と大きさが1pxも変わらないことを、コードで見張る。
//
//   node tools/battle/ai-copy-no-shift-check.js
//
// 2026-10-29 社長「コピー枠が増えることによって、もとの4枠がずれる。これによって色んなものがずれてる」。
// それまでは4枠の右に5列目・下に帯を足していたので、コピーがいる間は4枠が細く(低く)なり、枠の中の札まで縮めていた。
// いまは、コピーは敵の段の中の小窓(AiCopyFloat・絶対位置)に出し、4枠の並びには何も足さない。
// ここでは次の4つを確かめる(写真は撮らない。社長が本番で見る):
//   ① 4枠の並び(data-tactics-debug-layout の grid)の class と高さが、コピーの有無(aiCopy・classicAiCopy・tacticsCopyOutside・copyFloat)で変わらない
//   ② 4枠を包む入れ物は display:contents のまま(5列目・帯のための flex にしない)
//   ③ 4枠の中の札を、コピーがいるときだけ小さくする決まり([data-ai-copy-row] …)が残っていない
//   ④ 小窓は絶対位置(absolute)で、敵の段のボタンと同じ所に置かれている
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const battle = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const gridAt = battle.indexOf('<div data-tactics-debug-layout=');
const gridTag = gridAt >= 0 ? battle.slice(gridAt, battle.indexOf('>\n', gridAt)) : '';
const copyWords = /aiCopy|classicAiCopy|tacticsCopyOutside|copyFloat|shownAiCopy/;
check('① 4枠の並びの class と高さがコピーの有無で変わらない', !!gridTag && !copyWords.test(gridTag), gridTag ? '' : '4枠の並びが見つからない');

const wrapAt = battle.lastIndexOf('<div', gridAt - 1);
const wrapTag = wrapAt >= 0 ? battle.slice(wrapAt, battle.indexOf('>', wrapAt) + 1) : '';
check('② 4枠を包む入れ物は display:contents のまま', /className="contents"/.test(wrapTag) && !copyWords.test(wrapTag), wrapTag.slice(0, 80));

check('③ コピーがいるときだけ4枠の中を縮める決まりが無い', !/\[data-ai-copy-row\]/.test(battle) && !/data-ai-copy-row=/.test(battle));

const floatAt = battle.indexOf('function AiCopyFloat(');
const floatBody = floatAt >= 0 ? battle.slice(floatAt, battle.indexOf('\n}\n', floatAt)) : '';
check('④ 小窓 AiCopyFloat は絶対位置', /className=\{`absolute /.test(floatBody));
const mountAt = battle.indexOf('<AiCopyFloat ');
const enemyBtnAt = battle.indexOf('aria-label="敵を解析する"');
check('④ 小窓は敵の段(解析ボタンのすぐ後)に置く', mountAt > enemyBtnAt && enemyBtnAt > 0 && mountAt - enemyBtnAt < 3000);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
