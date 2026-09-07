// 更新履歴の日付と並び順を見張る。
//
//   node tools/boot/changelog-order-check.js
//
// 2026-09-07・ユーザー指摘「更新履歴の時間とか並ぶ順番がおかしい」。
//
// 起きていたことは3つ。
//   ① 未来の日付が12件あった(2026-09-08。実際のコミットは 2026-09-06)。
//      1時間刻みの連番で機械的に振られていて、実際の作業時刻とも無関係だった
//   ② data/changelog.js の書いてある順が日付の降順になっていなかった
//   ③ data/rhythm-step3-release.js が起動時に CHANGELOG.unshift で
//      2026-09-04 の項目を先頭へ差し込むため、書いてある順に頼ると
//      その項目がいつまでも「最新」として並んでいた
//
// ③があるので、**並び順は表示側(CHANGELOG_ENTRIES)で日付順に決める**のが正しい。
// この検査は「その並べ替えが残っているか」と「未来日付・逆転が無いか」を見る。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const changelogPath = path.join(root, 'monster-hero/data/changelog.js');
const changelog = fs.readFileSync(changelogPath, 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- 日付そのもの ----
const entries = [];
const re = /date:\s*"([^"]+)"/g;
let m;
while ((m = re.exec(changelog)) !== null) entries.push({ date: m[1], at: m.index });
check('日付を読めた', entries.length > 0, `${entries.length}件`);

// 書式は "YYYY-MM-DD HH:MM" で固定。文字列のまま比べられるようにするための約束
const BAD_FORMAT = entries.filter(e => !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(e.date));
check('日付の書式がそろっている', BAD_FORMAT.length === 0,
  BAD_FORMAT.slice(0, 3).map(e => e.date).join(' / '));

// ★未来の日付を書かない。実際より先の日付にすると、直したはずの項目が
//   いつまでも一覧の先頭に居座る(実際に 2026-09-08 の項目が12件あった)
const BUILD_DATE = (fs.readFileSync(path.join(root, 'monster-hero/src/parts/10-core.jsx'), 'utf8')
  .match(/const BUILD_DATE = "([^"]+)"/) || [])[1] || '';
const today = BUILD_DATE.slice(0, 10);
const future = entries.filter(e => today && e.date.slice(0, 10) > today);
check('未来の日付がない', future.length === 0,
  `${future.length}件${future.length ? `(例: ${future[0].date} / いまは ${today})` : ''}`);

// ---- 書いてある順 ----
// ここが崩れていても表示は日付順に直すが、書くときも新しいものを上へ足すのが本来
let reversed = 0;
for (let i = 1; i < entries.length; i++) if (entries[i].date > entries[i - 1].date) reversed++;
check('書いてある順も日付の新しい順', reversed === 0, `${reversed}か所で逆転`);

// ---- 表示側で日付順に並べ替えているか ----
// ★ここがいちばん大事。別ファイルからの unshift があるので、
//   書いてある順に頼ると先頭が古い項目のままになる
for (const file of [
  path.join(root, 'monster-hero/src/parts/17-release-changelog-login-missions.jsx'),
  path.join(root, 'monster-hero/game-system.compiled.js'),
]) {
  const rel = path.relative(root, file);
  const compact = fs.readFileSync(file, 'utf8').replace(/\s+/g, '');
  // 生成物では `(entry)=>` の括弧と外側の括弧が外れるので、どちらでも通る形で見る
  check(`${rel}: 一覧を日付の新しい順に並べ替えている`,
    /changelogSortKey=\(?entry\)?=>\(?typeofentry\?\.date==='string'\?entry\.date:''\)?/.test(compact)
    && /CHANGELOG_ENTRIES=[\s\S]{0,500}?\.sort\(\(a,b\)=>\(?changelogSortKey\(b\)>changelogSortKey\(a\)/.test(compact));
}

// ---- 差し込み元がまだ居ることを覚えておく ----
// この unshift を消すのは自由だが、消したつもりで残っていると原因が分からなくなるので
// 「あるならある」と分かる形で見張る
const step3 = fs.readFileSync(path.join(root, 'monster-hero/data/rhythm-step3-release.js'), 'utf8');
const hasUnshift = step3.includes('CHANGELOG.unshift(');
console.log(`--  参考: data/rhythm-step3-release.js の CHANGELOG.unshift は ${hasUnshift ? 'まだある' : 'もう無い'}`);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
