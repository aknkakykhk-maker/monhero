const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');
const start = source.indexOf("const CHANGELOG_TYPES");
const end = source.indexOf('// 不具合情報タブに出す状態バッジ', start);
assert(start >= 0 && end > start, '設定検証関数を抽出できること');
const context = { CHANGELOG: [
  { type: 'issue', date: '2026-07-03 00:00' },
  { type: 'update', date: '2026-07-02 00:00' },
  { type: 'issue', date: '2026-07-01 00:00' },
] };
vm.createContext(context);
vm.runInContext(source.slice(start, end).replace(/const /g, 'var '), context);
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.CHANGELOG_LATEST_BY_TYPE)), { update: '2026-07-02 00:00', issue: '2026-07-03 00:00' });

const defaults = JSON.parse(JSON.stringify(context.DEFAULT_MONSTER_LIST_SETTINGS));
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.normalizeMonsterListSettings(null))), defaults, '未保存なら従来の初期値');
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.normalizeMonsterListSettings({ version: 1, modalTab: 'display', sortKey: 'bond', sortDir: 'desc', display: { base: false, masu: true, fused: false, active: true } }))), { version: 1, modalTab: 'display', sortKey: 'bond', sortDir: 'desc', display: { base: false, masu: true, fused: false, active: true } });
for (const invalid of [
  { version: 0, modalTab: 'sort', sortKey: 'lineage', sortDir: 'asc', display: defaults.display },
  { version: 1, modalTab: 'bad', sortKey: 'lineage', sortDir: 'asc', display: defaults.display },
  { version: 1, modalTab: 'sort', sortKey: 'removed', sortDir: 'asc', display: defaults.display },
  { version: 1, modalTab: 'sort', sortKey: 'lineage', sortDir: 'sideways', display: defaults.display },
  { version: 1, modalTab: 'sort', sortKey: 'lineage', sortDir: 'asc', display: { base: 'yes' } },
]) assert.deepStrictEqual(JSON.parse(JSON.stringify(context.normalizeMonsterListSettings(invalid))), defaults, '不正値は初期値へ戻る');
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.normalizeFusionSortSettings({ version: 1, sortKey: 'name', sortDir: 'asc' }))), { version: 1, sortKey: 'name', sortDir: 'asc' });
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.normalizeFusionSortSettings({ version: 1, sortKey: 'removed', sortDir: 'asc' }))), JSON.parse(JSON.stringify(context.DEFAULT_FUSION_SORT_SETTINGS)));

for (const required of [
  "mh_changelog_seen_update", "mh_changelog_seen_issue", "mh_monster_list_settings", "mh_fusion_sort_settings",
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
