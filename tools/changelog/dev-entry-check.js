const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 更新情報へ「開発中の作業メモ」が並んでいないかを見る。
//
//   node tools/changelog/dev-entry-check.js
//
// 【なぜ要るか】
// 公開前の機能は releaseFlag で隠していたが、隠していたのは「出す時期」だけだった。
// モンヒロビートは公開までに80件の作業メモを更新履歴へ書いていたので、
// プレオープンでフラグを true にした瞬間、その80件が一度に更新情報へ並んだ
// (2026-09-05・ユーザー指摘「デバッグの内容が一気に更新情報に来たから消して」)。
// プレイヤーから見れば、触ったこともない画面の不具合が直った話が延々と続くだけになる。
//
// いまは作業メモに dev:true を付けて、どちらのタブにも助手の告知にも出さない。
// この検査は、
//   ・dev:true を付けたものが本当に出ていないか
//   ・公開前に書いた作業メモへ付け忘れていないか
//   ・逆に、プレイヤーへ知らせるべきお知らせまで消していないか
// を見張る。CLAUDE.md「デバッグ専用の変更は更新履歴に載せない」を機械で確かめるためのもの。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const changelogSrc = fs.readFileSync(path.join(web, 'data/changelog.js'), 'utf8');
const assistantsSrc = fs.readFileSync(path.join(web, 'data/assistants.js'), 'utf8');
const game = fs.readFileSync(path.join(web, 'src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const grab = (from, to) => {
  const i = game.indexOf(from);
  const j = game.indexOf(to, i);
  return i >= 0 && j > i ? game.slice(i, j) : '';
};

// ---- 本番の判定をそのまま動かす ----
// 「出す・出さない」を決めているのは game-system.jsx なので、文面で真似せず本体を呼ぶ。
// 公開フラグは定義が離れた場所にあるので、その行だけを取り出す
// (あいだを丸ごと切り取るとJSXまで混ざって読めなくなる)
const flagLines = ['SPECIES_CHALLENGE_PUBLIC_RELEASE', 'RHYTHM_MODE_PUBLIC_RELEASE']
  .map(name => (game.match(new RegExp(`^const ${name} = .*$`, 'm')) || [])[0]);
const gate = grab('const RELEASE_FLAGS = {', '\n// 一覧の並べかえに使えるキー');
const flags = flagLines.join('\n');
const context = {};
vm.createContext(context);
vm.runInContext([
  changelogSrc,
  assistantsSrc.slice(assistantsSrc.indexOf('const ASSISTANT_UPDATE_NOTICE_TYPES'),
    assistantsSrc.indexOf('// 指定された表情が用意されていなければ')),
  flags,
  gate,
  'globalThis.x={CHANGELOG,changelogForPlayers,CHANGELOG_ENTRIES,changelogEntriesOfTab,HIDDEN_UPDATE_NOTICE_IDS,ASSISTANT_UPDATE_NOTICES};',
].join('\n'), context);
const { CHANGELOG, changelogForPlayers, CHANGELOG_ENTRIES, changelogEntriesOfTab,
        HIDDEN_UPDATE_NOTICE_IDS, ASSISTANT_UPDATE_NOTICES } = context.x;

const devEntries = CHANGELOG.filter(e => e.dev === true);
const shownTitles = new Set(CHANGELOG_ENTRIES.map(e => e.title));

// ---- ① 作業メモは画面に出ない ----
check('dev:true の項目がある(印そのものが消えていない)', devEntries.length > 0, `${devEntries.length}件`);
check('dev:true の項目はどちらのタブにも出ない',
  devEntries.every(e => !shownTitles.has(e.title)),
  devEntries.filter(e => shownTitles.has(e.title)).map(e => e.title).join(' / '));
const tabbed = new Set([...changelogEntriesOfTab('update'), ...changelogEntriesOfTab('issue')].map(e => e.title));
check('タブごとの一覧にも出ない', devEntries.every(e => !tabbed.has(e.title)));
check('出す・出さないを1か所(changelogForPlayers)で決めている',
  typeof changelogForPlayers === 'function'
  && game.includes('.filter(changelogForPlayers)')
  && /const changelogForPlayers = \(entry\) => !!entry && entry\.dev !== true && releasedForPlayers\(entry\)/.test(game));

// ---- ② 助手の告知にもならない ----
const devNotices = devEntries.map(e => e && e.assistantNotice && e.assistantNotice.id).filter(Boolean);
check('作業メモに付いていた助手の告知は隠している',
  devNotices.every(id => HIDDEN_UPDATE_NOTICE_IDS.has(id.trim())),
  devNotices.join(' / ') || '対象なし');
check('助手の告知の材料そのものは残っている(基盤を壊していない)',
  Array.isArray(ASSISTANT_UPDATE_NOTICES) && ASSISTANT_UPDATE_NOTICES.length > 0);

// ---- ③ 付け忘れ ----
// モンヒロビートは公開前に書いたものが作業メモ。releaseFlag が付いている＝公開前に書いた印
const rhythmFlagged = CHANGELOG.filter(e => e.releaseFlag === 'rhythmMode');
check('モンヒロビート公開前に書いた項目は、すべて作業メモ扱いになっている',
  rhythmFlagged.length > 0 && rhythmFlagged.every(e => e.dev === true),
  `${rhythmFlagged.filter(e => e.dev === true).length}/${rhythmFlagged.length}件`);
check('作業メモに新着バッジ(status:new)を付けていない',
  devEntries.every(e => e.status !== 'new'),
  devEntries.filter(e => e.status === 'new').map(e => e.title).join(' / '));

// ---- ④ 消しすぎていない ----
// プレオープンそのものの案内は、プレイヤーへ出し続ける必要がある
for (const title of [
  'モンヒロビートをプレオープンしました',
  '新しい助手「ももすけ」が仲間になりました',
  'マーケットにももすけのアイコンが8種類ならびました',
  'モンヒロビート プレオープン記念 新規プレイヤーキャンペーン',
]) check(`「${title}」は出ている`, shownTitles.has(title));
check('更新情報タブが空になっていない', changelogEntriesOfTab('update').length > 0, `${changelogEntriesOfTab('update').length}件`);
check('不具合情報タブが空になっていない', changelogEntriesOfTab('issue').length > 0, `${changelogEntriesOfTab('issue').length}件`);
// 公開後に直したぶんはプレイヤーが体験しているので、作業メモにしない
check('プレオープン後に直したぶんは出ている',
  shownTitles.has('モンヒロビート: レーンの下に数字が残っていたのを直しました'));

// ---- ⑤ 書き方の説明が残っている ----
check('changelog.js に dev:true の使い分けが書いてある',
  changelogSrc.includes('【dev:true について】') && changelogSrc.includes('公開初日に遊ぶ人がこれを読んで意味が分かるか'));

console.log(failed === 0 ? '\nすべてOK' : `\n${failed}件のNGがあります`);
process.exit(failed === 0 ? 0 : 1);
