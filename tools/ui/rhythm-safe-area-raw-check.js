#!/usr/bin/env node
// モンヒロビートの部品に、env(safe-area-inset-*) を直に書いていないかを見張る(2026-11-14・社長「何回も言ってんだから」)。
//
//   node tools/ui/rhythm-safe-area-raw-check.js
//
// 【なぜ要るか】🔄横(端末は縦のまま絵を90度回す)では、回した器の中で「画面の上」は端末の右端にあたる。そこで
//   env(safe-area-inset-top)(端末の上端のノッチぶん・約59px)を直に足すと、回した画面の上に絵の無い帯ができる。
//   器は四方の余白を自分で取っているので、中の画面は var(--mh-sa-top / -bottom / -left / -right) を使う
//   (index.html。🔄横のあいだは 0・ふだんは env() と同じ値)。直に env() を書いた所が、1つ直すたびに別の画面で見つかって、
//   2026-09-29・2026-11-12・2026-11-14 と「上の空き」が戻ってきた。今回の原因は しぼりこみの窓(80-screen-rhythm-buddy.jsx)の paddingTop。
//   本物の画面で四辺の帯を測る検査は tools/ui/rhythm-edge-band-check.js(こちらは書き方だけを、ブラウザなしで一瞬で見る)。
//
// 見ること: モンヒロビートの部品(下の BEAT_PART_RE)に env(safe-area-inset- が1つも無い。
//   例外は ALLOWED だけ(器の外の body へ直に出す所。回した器の中ではないので env() のままでよい)
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
// モンヒロビート(曲えらび・演奏・結果・ソロ・マルチ・相棒・履歴・曲の購入・スタンプ)の部品
const BEAT_PART_RE = /^(28|29|30|33|39|58|73|77|80)-.+\.jsx$/;
// 回した器の外(body へ直に出す)ので env() のままでよい所。キーは「ファイル|その行にある目印」
const ALLOWED = {
  '77-screen-rhythm-multi.jsx|z-[99000] flex justify-center px-2 pt-[max(env(safe-area-inset-top),6px)]': 'フレンドの招待の帯。お知らせの窓より前に出すため body へ直に出す(器の外)',
};
const files = fs.readdirSync(PARTS).filter((f) => BEAT_PART_RE.test(f));
check('モンヒロビートの部品が見つかる', files.length > 10, `${files.length}ファイル`);
const bad = [];
let allowedUsed = 0;
const allowedKeys = new Set();
for (const f of files) {
  const lines = fs.readFileSync(path.join(PARTS, f), 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!/env\(safe-area-inset-/.test(line)) return;
    const key = Object.keys(ALLOWED).find((k) => { const [file, mark] = k.split('|'); return file === f && line.includes(mark); });
    if (key) { allowedUsed++; allowedKeys.add(key); return; }
    bad.push(`${f}:${i + 1}`);
  });
}
check('モンヒロビートの部品に env(safe-area-inset-*) を直に書いていない(var(--mh-sa-*) を使う)', bad.length === 0, bad.slice(0, 8).join(' / '));
check('例外の一覧に、いまは無い行が残っていない', Object.keys(ALLOWED).every((k) => allowedKeys.has(k)), Object.keys(ALLOWED).filter((k) => !allowedKeys.has(k)).join(' / '));
console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
