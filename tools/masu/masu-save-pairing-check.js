const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// マスモン一覧(mh_masu_mons)の「画面の state 更新」と「保存」が必ず対になっているかを確かめる。
//
//   node tools/masu/masu-save-pairing-check.js
//
// 【なぜ要るか】
// mh_masu_mons はプレイヤーの育成資産そのもので、書く場所が 30 箇所以上に散らばっている
// (docs/refactor/TECH_DEBT_AUDIT.md TD-02)。setMasuMons だけ書いて storeSet を忘れると
// 「画面では反映されたのに再起動で戻る」、storeSet だけ書くと画面と保存が食い違う。
// 1 か所の更新関数へ寄せる作業(STEP 3)の前に、いまの「対になっている」状態を機械的に固定する。
//
// 【見かた】
// ・setMasuMons(…) の近く(前後 12 行)に、storeSet('mh_masu_mons' か、storeSet を注入して保存する
//   取引関数(saveTranscendFruitPair など SAVE_HELPERS)の呼び出しがあること
// ・storeSet('mh_masu_mons' の近くに setMasuMons があること。ただし起動時の読込
//   (savedMasuMons を組み立ててから最後に一度 setMasuMons する)は例外
const fs = require('fs');
const path = require('path');
const { PARTS_DIR, readPartsManifest } = require(path.join(TOOLS_DIR, 'harness'));

const SPAN = 12;
// storeSet を引数で受け取って mh_masu_mons を保存する取引関数。増やしたらここへ足す
const SAVE_HELPERS = ['saveTranscendFruitPair('];
const BOOT_VARIABLE = 'savedMasuMons'; // 起動時の読込・移行で組み立てる一時変数

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const files = readPartsManifest().map(name => ({ name, lines: fs.readFileSync(path.join(PARTS_DIR, name), 'utf8').split('\n') }));
const hasNear = (lines, i, test) => {
  for (let j = Math.max(0, i - SPAN); j <= Math.min(lines.length - 1, i + SPAN); j++) if (test(lines[j])) return true;
  return false;
};
const isSave = (l) => l.includes("storeSet('mh_masu_mons'") || SAVE_HELPERS.some(h => l.includes(h));
const isSet = (l) => l.includes('setMasuMons(');

let sets = 0, saves = 0;
const unpairedSets = [], unpairedSaves = [];
for (const { name, lines } of files) {
  lines.forEach((l, i) => {
    if (isSet(l)) {
      sets++;
      if (!hasNear(lines, i, isSave) && !l.includes(BOOT_VARIABLE)) unpairedSets.push(`${name}:${i + 1}`);
    }
    if (l.includes("storeSet('mh_masu_mons'")) {
      saves++;
      if (!hasNear(lines, i, isSet) && !l.includes(BOOT_VARIABLE)) unpairedSaves.push(`${name}:${i + 1}`);
    }
  });
}
check('マスモン一覧の state 更新と保存を拾えている', sets >= 20 && saves >= 20, `setMasuMons ${sets} 箇所 / storeSet ${saves} 箇所`);
check('setMasuMons の近くに必ず保存(storeSet または取引関数)がある', unpairedSets.length === 0, unpairedSets.join(', '));
check("storeSet('mh_masu_mons') の近くに必ず setMasuMons がある(起動時の読込を除く)", unpairedSaves.length === 0, unpairedSaves.join(', '));

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
