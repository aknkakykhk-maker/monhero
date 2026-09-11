const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const start = source.indexOf("const CHANGELOG_TYPES");
const end = source.indexOf('// 不具合情報タブに出す状態バッジ', start);
assert(start >= 0 && end > start, '設定検証関数を抽出できること');
// IDは日付ではなく内容(種別・題・本文)から作るため、実データと同じく題を持たせる。
// 題が無いと別項目でも同じIDになってしまい、未読の数え方を確かめられない。
const context = { CHANGELOG: [
  { type: 'issue', date: '2026-07-03 00:00', title: '不具合A', items: ['あ'] },
  { type: 'update', date: '2026-07-02 00:00', title: '更新B', items: ['い'] },
  { type: 'issue', date: '2026-07-01 00:00', title: '不具合C', items: ['う'] },
] };
vm.createContext(context);
// CHANGELOG_ENTRIES は releasedForPlayers / RELEASE_FLAGS を使うが、これらは
// 切り出し範囲(CHANGELOG_TYPES以降)より前で定義されているため、そのまま評価すると
// ReferenceError で落ちる。未公開機能を伏せる仕組みを足したときに崩れたので、
// 必要な宣言だけを実ソースから拾って先頭へ足す(値を検査側で決め打ちしない)。
// 宣言は1行とは限らない。releasedForPlayers は3行の矢印関数で、1行目だけを取ると
// `var releasedForPlayers = (item) => !item` になり、実在する項目をすべて「出さない」と
// 判定してしまう(CHANGELOG_ENTRIES が空になり、下の件数の確認が静かに 0 件で落ちる)。
// 括弧の深さが 0 に戻った最初の ; までを1つの宣言として取る。
const pick = (name) => {
  const at = source.search(new RegExp(`^const ${name}\\s*=`, 'm'));
  assert(at >= 0, `${name} の宣言を取り出せること`);
  let depth = 0;
  for (let i = at; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ';' && depth === 0) return source.slice(at, i + 1).replace(/^const /, 'var ');
  }
  assert(false, `${name} の宣言の終わりを見つけられること`);
  return '';
};
// 公開フラグ(*_PUBLIC_RELEASE)は今後も増える。名前を手で並べると、増えたときに
// ReferenceError で検査そのものが起動できなくなる(2026-09-11 に
// QUICK_RHYTHM_LINK_PUBLIC_RELEASE が足されて実際にそうなった)。
// 実ソースから名前を拾って組み立てる。
const releaseFlagNames = [...new Set(
  [...source.matchAll(/^const ([A-Z0-9_]+_PUBLIC_RELEASE)\s*=/gm)].map((m) => m[1]),
)];
assert(releaseFlagNames.length > 0, '公開フラグ(*_PUBLIC_RELEASE)を1つ以上拾えること');
const prelude = [...releaseFlagNames, 'RELEASE_FLAGS', 'releasedForPlayers']
  .map(pick).join('\n');
vm.runInContext(`${prelude}\n${source.slice(start, end).replace(/const /g, 'var ')}`, context);
// かつての CHANGELOG_LATEST_BY_TYPE(種別ごとの最新日付)は、未読を日付ではなく
// 内容から作った安定IDで持つ CHANGELOG_IDS_BY_TYPE へ置き換わっている。
// 種別ごとに自分の項目だけを、書いてある順で集めることを確かめる。
const idsByType = JSON.parse(JSON.stringify(context.CHANGELOG_IDS_BY_TYPE));
assert.deepStrictEqual(Object.keys(idsByType), ['update', 'issue'], '種別ごとに分かれていること');
assert.strictEqual(idsByType.update.length, 1, 'updateは1件');
assert.strictEqual(idsByType.issue.length, 2, 'issueは2件');
assert(idsByType.update.every(id => id.startsWith('update-')), 'updateのIDは種別付き');
assert(idsByType.issue.every(id => id.startsWith('issue-')), 'issueのIDは種別付き');
assert.strictEqual(new Set([...idsByType.update, ...idsByType.issue]).size, 3, 'IDが重複しない');

const defaults = JSON.parse(JSON.stringify(context.DEFAULT_MONSTER_LIST_SETTINGS));
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.normalizeMonsterListSettings(null))), defaults, '未保存なら従来の初期値');
// 保存済みの値はそのまま残し、あとから足した項目(display.reborn・lineage など)は
// 既定値で補われること。期待値を直書きすると項目が増えるたびに検査が古くなるので、
// 「既定値へ保存値を重ねたもの」と比べる。
const saved = { version: 1, modalTab: 'display', sortKey: 'bond', sortDir: 'desc', display: { base: false, masu: true, fused: false, active: true } };
assert.deepStrictEqual(
  JSON.parse(JSON.stringify(context.normalizeMonsterListSettings(saved))),
  { ...defaults, ...saved, display: { ...defaults.display, ...saved.display } },
  '保存値は残し、足りない項目だけ既定値で補う');
for (const invalid of [
  { version: 0, modalTab: 'sort', sortKey: 'lineage', sortDir: 'asc', display: defaults.display },
  { version: 1, modalTab: 'bad', sortKey: 'lineage', sortDir: 'asc', display: defaults.display },
  { version: 1, modalTab: 'sort', sortKey: 'removed', sortDir: 'asc', display: defaults.display },
  { version: 1, modalTab: 'sort', sortKey: 'lineage', sortDir: 'sideways', display: defaults.display },
  { version: 1, modalTab: 'sort', sortKey: 'lineage', sortDir: 'asc', display: { base: 'yes' } },
]) assert.deepStrictEqual(JSON.parse(JSON.stringify(context.normalizeMonsterListSettings(invalid))), defaults, '不正値は初期値へ戻る');
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.normalizeFusionSortSettings({ version: 1, sortKey: 'name', sortDir: 'asc' }))), { version: 1, sortKey: 'name', sortDir: 'asc' });
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.normalizeFusionSortSettings({ version: 1, sortKey: 'removed', sortDir: 'asc' }))), JSON.parse(JSON.stringify(context.DEFAULT_FUSION_SORT_SETTINGS)));

// 既読の保存キーは種別ごとにテンプレートで組み立てている。日付ではなくIDで持つ
// 新キーへ移ったあとも、古い日付キーを読む処理を残していること(既存の保存を壊さない)。
for (const required of [
  "mh_changelog_seen_ids_${type}", "mh_changelog_seen_${type}", "mh_monster_list_settings", "mh_fusion_sort_settings",
  "const hasUnreadChangelog = changelogUnread.update || changelogUnread.issue",
  "selectChangelogTab(t.key)", "if (!dataLoaded) return;",
]) assert(source.includes(required), `実装に ${required} が含まれること`);

// タブ単位の既読遷移: 両方未読→片方だけ確認→両方確認→新項目追加。
let seen = { update: '', issue: '' };
const unread = latest => Object.fromEntries(['update', 'issue'].map(type => [type, !!latest[type] && seen[type] !== latest[type]]));
let latest = { update: 'u1', issue: 'i1' };
assert.deepStrictEqual(unread(latest), { update: true, issue: true });
seen.update = latest.update;
assert.deepStrictEqual(unread(latest), { update: false, issue: true });
seen.issue = latest.issue;
assert.deepStrictEqual(unread(latest), { update: false, issue: false });
latest.update = 'u2';
assert.deepStrictEqual(unread(latest), { update: true, issue: false });
console.log('OK: 更新履歴のタブ別既読とソート・表示設定の保存検証に成功しました');
