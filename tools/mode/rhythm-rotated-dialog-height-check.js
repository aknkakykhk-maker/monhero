// モンヒロビートの「横画面にする」(絵だけ90度回す)のあいだも、ダイアログの高さが器に収まるかを見張る。
//
// 【何が起きたか】(2026-10-06・プレイボットが発見)
// 横画面ボタンは端末を回さず、器(RHYTHM_VIEW_ROTATION.frameStyle)を90度回して横向きに見せる。
// このとき器の高さは「端末の横幅」(390pxなど)になる。ところが全国ランキングの「イベント詳細」は
// 高さの上限を --mh-vh(端末の**縦**の長さ、844pxなど)で決めていたため、器より背の高い箱になり、
// 上下が切れて「閉じる」に届かなくなった。開き直すしかない。
//
// 【見ること】
// 回る器の中に出る部品(曲えらび・演奏・共通部品)で var(--mh-vh) を使っている style は、
// 同じ式の中で RHYTHM_VIEW_ROTATION.active() を見て、回っているときの高さへ切り替えていること。
const fs = require('fs');
const path = require('path');

const PARTS = path.resolve(__dirname, '..', '..', 'monster-hero', 'src', 'parts');
const FILES = ['28-rhythm-shared.jsx', '30-rhythm-play.jsx', '58-screen-rhythm.jsx'];

let ng = 0, seen = 0;
for (const name of FILES) {
  const file = path.join(PARTS, name);
  if (!fs.existsSync(file)) { console.log(`NG: ${name} が見つかりません`); ng += 1; continue; }
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // 文字列の中に書かれたものだけを見る(コメントで --mh-vh に触れているだけの行は対象外)
    if (!/['"`][^'"`]*var\(--mh-vh\)/.test(line)) return;
    seen += 1;
    // 同じ style の式は数行に折り返して書くことがあるので、前後3行まで見る
    const around = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
    const ok = /RHYTHM_VIEW_ROTATION\.active\(\)/.test(around);
    if (!ok) ng += 1;
    console.log(`${ok ? 'OK' : 'NG'}: ${name}:${i + 1} の --mh-vh は横画面(90度回した器)を考えている`);
  });
}
console.log(`\n--mh-vh を使う style ${seen}か所 / NG ${ng}`);
if (ng) console.log('横画面ボタンで回しているときは器の高さ = 端末の横幅(window.innerWidth)。RHYTHM_VIEW_ROTATION.active() で切り替える');
process.exit(ng ? 1 : 0);
