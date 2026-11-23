#!/usr/bin/env node
// 曲鑑賞の画面の表示(2026-11-23 r1119-151 社長「鑑賞のジャケットがちいさい。あと設定でいじれていいからコンボ数の表示とか判定の表示とかもいれたい」)。
// ソースを読むだけ(すぐ終わる)。見るもの:
//   ・鑑賞で隠す物(RHYTHM_LISTEN_HIDE_CSS)に、判定の文字・コンボ数が入っていない(出す・出さないはふつうに遊ぶ時の設定に従う)
//   ・スコア・ライフなど(右上の列・進みぐあい・ずれのメーター)は今までどおり隠す。左上はスコアの行を詰め、曲名の行だけ残す
//   ・判定の文字・コンボ数は、ふつうの設定(judgmentTextDisplay・comboDisplay)で切れる
//   ・鑑賞中は曲名の横のジャケットを大きくし、4秒で薄くする動き(hudSongFade)を効かせない
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../monster-hero/src/parts/30-rhythm-play.jsx'), 'utf8');
let ng = 0; const ok = (cond, label) => { console.log(`${cond ? 'OK' : 'NG'}: ${label}`); if (!cond) ng++; };
const m = src.match(/const RHYTHM_LISTEN_HIDE_CSS='([^']*)'/); const css = m ? m[1] : '';
ok(!!css, '鑑賞で隠す CSS がある');
for (const sel of ['[data-rhythm-judgment-display]', '[data-rhythm-sky-judgment-display]', '[data-rhythm-combo]', '[data-rhythm-combo-box]'])
  ok(!css.includes(sel), `鑑賞で ${sel} を隠さない(判定の文字・コンボ数を出す)`);
for (const sel of ['[data-rhythm-hud-right]', '[data-rhythm-pace]', '[data-rhythm-timing-meter]'])
  ok(css.includes(sel), `鑑賞で ${sel} は隠したまま(スコア・ライフなど)`);
ok(/\[data-rhythm-hud-left\]>:not\(\[data-rhythm-hud-songline\]\)\{display:none!important\}/.test(css), '左上はスコアの行を詰めて、曲名の行(ジャケット)だけ残す');
ok(/settings\.comboDisplay===false/.test(src), 'コンボ数はふつうの設定(comboDisplay)で切れる');
ok(/settings\.judgmentTextDisplay\?last:''/.test(src), '判定の文字はふつうの設定(judgmentTextDisplay)で切れる');
ok(/data-rhythm-hud-art[^>]*className=\{listenMode\?"h-16 w-16[^"]*landscape:h-14 landscape:w-14"/.test(src), '鑑賞中はジャケットを大きくする(縦 64px・横 56px)');
ok(/settings\.hudSongFade===false\|\|listenMode\)\{setHudSongDim\(false\)/.test(src), '鑑賞中は曲名とジャケットを薄くしない');
console.log(ng ? `\n${ng}件のNGがあります` : '\nすべてOK');
process.exitCode = ng ? 1 : 0;
