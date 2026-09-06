// 画面に出す名前が正式名称「モンヒロビート」になっているかを見張る。
//
//   node tools/mode/rhythm-name-check.js
//
// 2026-09-06・ユーザー指示
//   「ここの表示をモンビーじゃなくてモンヒロビートに」
//   「基本的には正式名称を使用して何かしらの理由があるときは略称を使うようにして」
//
// 略称「モンビー」を使ってよいのは、**キャラクターが愛称として呼ぶ会話**だけ
// (ももすけの登場イベントで「モンビーって呼んでる」と紹介する場面)。
// 見出し・説明文・ボタン・助手の案内・ヘルプ・更新履歴はすべて正式名称にする。
// ソースのコメントは開発者向けなので対象外。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// 行コメントだけの行は対象外にする(開発者向けのため)
const displayLines = (file) => fs.readFileSync(path.join(root, file), 'utf8').split('\n')
  .map((line, index) => ({ line, no: index + 1 }))
  .filter(({ line }) => {
    const t = line.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*'));
  });

// ももすけの登場イベントは、正式名称を出したうえで愛称へ移る演出。ここだけ略称を許す
const NICKNAME_ALLOWED = [
  'モンビーって呼んでる',
  'で、モンビーは分かったけど',
  'またモンビー付き合ってね',
];
const allowed = (line) => NICKNAME_ALLOWED.some(phrase => line.includes(phrase));

for (const file of ['monster-hero/src/parts/60-app.jsx', 'monster-hero/data/help.js', 'monster-hero/data/changelog.js', 'monster-hero/data/assistants.js']) {
  const hits = displayLines(file).filter(({ line }) => line.includes('モンビー') && !allowed(line));
  check(`${file}: 画面に出す名前が正式名称になっている`, hits.length === 0,
    hits.slice(0, 2).map(h => `${h.no}行目: ${h.line.trim().slice(0, 60)}`).join(' / '));
}

// 愛称を許した場所そのものは残っていること(演出まで消してしまわないように)
const assistants = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
check('ももすけの登場イベントでは愛称のままにしている',
  NICKNAME_ALLOWED.every(phrase => assistants.includes(phrase)));
check('その会話は正式名称を先に出している',
  assistants.indexOf('「モンヒロビート」') < assistants.indexOf('モンビーって呼んでる'));

// 幅の狭いボタンも、略称にせず折り返して正式名称を入れる
const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
check('バトルの入口ボタンも正式名称（折り返して入れる）',
  /data-quick-to-rhythm[\s\S]{0,600}?モンヒロ<br\/>ビート/.test(app));
check('その読み上げ・ツールチップも正式名称',
  app.includes('aria-label="周回を続けたままモンヒロビートへ"') && app.includes('title="周回を続けたままモンヒロビートへ"'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
