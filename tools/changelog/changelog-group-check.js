#!/usr/bin/env node
'use strict';
//
// 更新情報の「話題ごとのまとめ」の検査。
//
// ちょこちょこした更新が1行ずつ積み上がり、過去の項目がすぐ画面の外へ流れていた
// (2026-09-13・ユーザー指摘「同じような内容は同じとこにまとめて詳細で詳しく出るようにして /
//  過去のやつが一瞬で見えなくなる」)。同じ日の同じ話題を1行にまとめて減らしている。
//
// 見るところ:
//   ・まとめても項目が1件も消えないか(まとめは見せ方だけ。記録には触らない)
//   ・日付の新しい順が崩れていないか
//   ・行数がちゃんと減っているか
//   ・entry.group を書いたらそれが最優先か
//   ・タイトルが本文より優先されるか(ついでに触れただけの言葉へ引っ張られない)
//   ・「その他」へ落ちる割合が多すぎないか
//   ・画面がこのまとめを使っているか
//
const assert = require('assert');
const fs = require('fs');
const m = require('../harness').loadDyeModule();

const entries = m.CHANGELOG_ENTRIES;
assert.ok(Array.isArray(entries) && entries.length > 0, '更新情報が読めている');

// ---- 1. まとめても1件も消えない ----
{
  const rows = m.groupChangelogEntries(entries);
  const total = rows.reduce((sum, row) => sum + row.entries.length, 0);
  assert.strictEqual(total, entries.length, 'まとめても項目の数は変わらない');
  const ids = new Set(rows.flatMap(row => row.entries.map(entry => entry.id)));
  assert.strictEqual(ids.size, new Set(entries.map(entry => entry.id)).size, '同じ項目が2か所に出たり消えたりしない');
  console.log(`OK: まとめても項目が消えない — ${entries.length}件`);
}

// ---- 2. 日付の新しい順が崩れない ----
{
  const rows = m.groupChangelogEntries(entries);
  const days = rows.map(row => row.day);
  // 同じ日がとびとびに現れない(日付の見出しを1度だけ出せる形になっている)
  const seen = new Set();
  let previous = null;
  days.forEach(day => {
    if (day !== previous) {
      assert.ok(!seen.has(day), `同じ日がとびとびに現れない: ${day}`);
      seen.add(day);
      previous = day;
    }
  });
  const sorted = [...seen];
  assert.strictEqual(sorted.join(','), [...sorted].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0)).join(','), '日付は新しい順');
  console.log(`OK: 日付の新しい順が崩れない — ${seen.size}日`);
}

// ---- 3. 行数が減っている ----
{
  const rows = m.groupChangelogEntries(entries);
  assert.ok(rows.length * 2 < entries.length, `行数が半分以下へ減る(${entries.length}→${rows.length})`);
  console.log(`OK: 一覧の行数が減っている — ${entries.length}件 → ${rows.length}行`);
}

// ---- 4. entry.group が最優先 ----
{
  const written = { date:'2026-09-13 10:00', title:'モンヒロビート：なにかを直しました', items:['譜面とノーツの話'], group:'items' };
  assert.strictEqual(m.changelogGroupIdOf(written), 'items', '書いてある group が、見当より優先される');
  const brokenGroup = { ...written, group:'ないグループ' };
  assert.strictEqual(m.changelogGroupIdOf(brokenGroup), 'rhythm', '知らない group は無視して、見当のほうを使う');
  console.log('OK: entry.group を書けばそこへ入る');
}

// ---- 5. タイトルが本文より優先される ----
// 「新しいバージョンのお知らせを…」が、本文に「演奏中は出さない」と書いてあるだけで
// モンヒロビート扱いになっていた。タイトルで決まるものは本文を見ない。
{
  const entry = { date:'2026-09-13 10:00', title:'新しいバージョンのお知らせの出し方を選べるようにしました',
    items:['モンヒロビートの演奏中は出しません。譜面のノーツと重なるためです。'] };
  assert.strictEqual(m.changelogGroupIdOf(entry), 'ui', 'タイトルで決まるなら本文へ引っ張られない');
  // タイトルで決まらないときだけ本文を見る
  const vague = { date:'2026-09-13 10:00', title:'こまかい調整をしました', items:['譜面のノーツの見え方を直しました'] };
  assert.strictEqual(m.changelogGroupIdOf(vague), 'rhythm', 'タイトルで決まらないときは本文から見当をつける');
  const nothing = { date:'2026-09-13 10:00', title:'いろいろ直しました', items:['こまかいところです'] };
  assert.strictEqual(m.changelogGroupIdOf(nothing), 'other', 'どちらでも決まらなければ その他');
  console.log('OK: タイトルが本文より優先される');
}

// ---- 6. 「その他」へ落ちる割合 ----
{
  const other = entries.filter(entry => m.changelogGroupIdOf(entry) === 'other').length;
  const rate = other / entries.length;
  assert.ok(rate < 0.1, `その他が多すぎない(${other}/${entries.length})`);
  console.log(`OK: その他へ落ちるのは少ない — ${other}/${entries.length}件`);
}

// ---- 7. タブごとにまとめても同じことが言える ----
{
  ['update', 'issue'].forEach(tab => {
    const ofTab = m.changelogEntriesOfTab(tab);
    const rows = m.groupChangelogEntries(ofTab);
    const total = rows.reduce((sum, row) => sum + row.entries.length, 0);
    assert.strictEqual(total, ofTab.length, `${tab}タブでも項目が消えない`);
  });
  console.log('OK: どちらのタブでも項目が消えない');
}

// ---- 8. 壊れた入力で落ちない ----
{
  // vm の外と中でプロトタイプが違うので、中身(長さ)だけを見る
  assert.strictEqual(m.groupChangelogEntries(null).length, 0, '配列でなくても落ちない');
  assert.strictEqual(m.groupChangelogEntries([]).length, 0, '空でも落ちない');
  const noDate = m.groupChangelogEntries([{ id:'x', title:'日付なし' }]);
  assert.strictEqual(noDate.length, 1, '日付が無くても1行にはなる');
  console.log('OK: 壊れた入力でも落ちない');
}

// ---- 9. 画面がこのまとめを使っているか ----
{
  const app = fs.readFileSync('monster-hero/src/parts/60-app.jsx', 'utf8');
  assert.ok(app.includes('groupChangelogEntries(changelogEntriesOfTab(changelogTab))'), '一覧はまとめてから並べる');
  assert.ok(app.includes('data-changelog-day'), '日付の見出しを出している');
  assert.ok(app.includes('data-changelog-group'), 'まとめた行に話題が付いている');
  assert.ok(app.includes('data-changelog-peek'), '閉じているあいだも中身の見出しがちら見えする');
  assert.ok(app.includes('mh-changelog-item'), '開いたら1件ずつ本文まで出す');
  const css = fs.readFileSync('monster-hero/src/parts/70-bootstrap.jsx', 'utf8');
  assert.ok(css.includes('.mh-changelog-day{'), '日付の見出しの見た目がある');
  assert.ok(css.includes('.mh-changelog-item{'), '1件ずつの見た目がある');
  console.log('OK: 画面がこのまとめを使っている');
}

console.log('\nすべてOK');
