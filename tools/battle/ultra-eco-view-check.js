const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 超省エネのバトル画面が、背景の下へ潜らないことを確かめる。
//
//   node tools/battle/ultra-eco-view-check.js
//
// 【なぜ要るか】
// 2026-09-22・ユーザー報告「超省エネにしたときだけ画面がなくなる」。
// バトルの背景(data-battle-stage-bg)は position:absolute の z-index:0。
// CSSでは「位置指定のある要素」が static の要素より上に描かれるので、
// 超省エネの簡易画面(data-ultra-battle-view)が static のままだと**背景にまるごと塗りつぶされる**。
// DOMには正しい大きさ(390x802)で存在し、opacity も visibility も正常なのに、
// 画面には1ピクセルも出ない。明るさを6倍にしても何も見えなかった。
//
// 通常のバトル画面のほうは、中の要素が個別に relative z-* を持っているので沈まない。
// 簡易画面は1枚の箱なので、箱そのものに重なり順が要る。
//
// 【見かた】背景・ヘッダー・簡易画面の3つの重なり順が、いまも矛盾していないか。
const path = require('path');
const fs = require('fs');

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const battle = fs.readFileSync(path.join(TOOLS_DIR, '../monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');

// 簡易画面の箱。ここに position と z-index が無いと、背景の下へ潜る
const view = /<div data-ultra-battle-view className="([^"]*)"/.exec(battle);
check('超省エネの簡易画面の箱を見つけられる', !!view);
if (view) {
  const cls = view[1];
  check('簡易画面に位置指定がある(relative)', /\brelative\b/.test(cls), cls.slice(0, 60));
  check('簡易画面に重なり順がある(z-10 以上)', /\bz-(\d+)\b/.test(cls) && Number(/\bz-(\d+)\b/.exec(cls)[1]) >= 10,
    (/\bz-[\w[\]]+/.exec(cls) || ['(無し)'])[0]);
}
// ★背景が「位置指定あり」である前提。ここが static へ変わったなら、この検査の理由が変わるので気づけるようにする
const bg = /data-battle-stage-bg[^>]*?className="([^"]*)"/.exec(battle);
check('バトルの背景を見つけられる', !!bg);
if (bg) {
  check('背景は位置指定つき(absolute)である前提', /\babsolute\b/.test(bg[1]), bg[1].slice(0, 60));
}
// ヘッダーも同じ理由で沈まないようにしてある(z-index を持つ)
check('ヘッダーにも重なり順がある', /data-battle-header[\s\S]{0,400}?z-\[?\d+/.test(battle));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
