const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// プレイヤーの資産を持つ保存キーについて、「画面の state 更新」と「保存」が必ず対に
// なっているかを確かめる。
//
//   node tools/boot/save-state-pairing-check.js
//
// 【なぜ要るか】
// setGold だけ書いて storeSet を忘れると「画面では増えたのに再起動で戻る」、
// storeSet だけ書くと画面と保存が食い違う。どちらもプレイヤーから見れば資産が消える。
// 同じキーを書く場所は散らばっていて(docs/refactor/TECH_DEBT_AUDIT.md TD-02)、
// 1 か所の更新関数へ寄せる作業(REFACTOR_MASTER_PLAN.md STEP 3)はこれからなので、
// **先にいまの「対になっている」状態を機械的に固定する**。
//
// マスモン一覧(mh_masu_mons)は書く場所が 30 箇所以上あって事情が違うため、
// 専用の tools/masu/masu-save-pairing-check.js が見ている。こちらはそれ以外の主要キー。
//
// 【対とみなすもの】(2026-09-11 に実測した、いまある正当な形)
//   ① 近くに storeSet('<キー>') がある
//   ② 近くに「storeSet を引数で受け取って保存する取引関数」の呼び出しがある
//      (saveMarketBalances など。下の SAVE_HELPERS。増やしたらここへ足す)
//   ③ 起動時の読込。直前2行以内に await storeGet('<キー>') があるとき(保存する必要がない)
const fs = require('fs');
const path = require('path');
const { PARTS_DIR, readPartsManifest } = require(path.join(TOOLS_DIR, 'harness'));

const SPAN = 12;
// storeSet を引数で受け取って保存まで済ませる取引関数。増やしたらここへ足す。
// これらは「保存に失敗したら書かない/巻き戻す」ところまで面倒を見るので、
// 呼び出し側は結果を見て state を更新すればよい
const SAVE_HELPERS = [
  'saveStoredValuesOrRollback(',
  'saveTranscendFruitPair(',
  'saveMarketBalances(',
  'persistSpeciesChallengeClearReward(',
];
// 見張るキーと、対になる state の更新関数
const TARGETS = [
  ['mh_gifts', 'setGifts('],
  ['mh_gold', 'setGold('],
  ['mh_owned_items', 'setOwnedItems('],
  ['mh_breeder_xp', 'setBreederXp('],
  ['mh_missions', 'setMissions('],
  ['mh_breeder_points', 'setBreederPoints('],
];

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const files = readPartsManifest().map((name) => ({
  name,
  lines: fs.readFileSync(path.join(PARTS_DIR, name), 'utf8').split('\n'),
}));
const hasNear = (lines, i, test) => {
  for (let j = Math.max(0, i - SPAN); j <= Math.min(lines.length - 1, i + SPAN); j++) if (test(lines[j])) return true;
  return false;
};

let totalSets = 0, totalSaves = 0;
const unpairedSets = [], unpairedSaves = [];

for (const [key, setter] of TARGETS) {
  const savesKey = (l) => l.includes(`storeSet('${key}'`) || l.includes(`storeSet("${key}"`);
  const isSave = (l) => savesKey(l) || SAVE_HELPERS.some((h) => l.includes(h));
  const isSet = (l) => l.includes(setter);
  // 起動時の読込: 直前2行以内に await storeGet('<キー>') がある
  const isBootLoad = (lines, i) => {
    for (let j = Math.max(0, i - 2); j <= i; j++) {
      if (lines[j].includes(`storeGet('${key}'`) || lines[j].includes(`storeGet("${key}"`)) return true;
    }
    return false;
  };
  for (const { name, lines } of files) {
    lines.forEach((l, i) => {
      if (isSet(l)) {
        totalSets++;
        if (!hasNear(lines, i, isSave) && !isBootLoad(lines, i)) unpairedSets.push(`${key} ${name}:${i + 1}`);
      }
      if (savesKey(l)) {
        totalSaves++;
        // 取引関数の中身(storeSet を引数で受け取っている部品)は、呼び出し側に state 更新がある
        const injected = lines[i].includes('storeSet(') && name !== '60-app.jsx';
        if (!hasNear(lines, i, isSet) && !injected) unpairedSaves.push(`${key} ${name}:${i + 1}`);
      }
    });
  }
}

check('主要キーの state 更新と保存を拾えている', totalSets >= 50 && totalSaves >= 35,
  `setter ${totalSets} 箇所 / storeSet ${totalSaves} 箇所`);
check('state を更新する場所には必ず保存がある(起動時の読込を除く)', unpairedSets.length === 0, unpairedSets.join(', '));
check('保存する場所には必ず state の更新がある(取引関数の中身を除く)', unpairedSaves.length === 0, unpairedSaves.join(', '));

console.log(failed ? `${failed}件のNGがあります` : 'すべてOK');
process.exit(failed ? 1 : 0);
