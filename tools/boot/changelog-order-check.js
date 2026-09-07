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

// ★未来の日時を書かない。実際より先にすると、その項目がいつまでも一覧の先頭に居座る。
//   ★★2026-09-07・ユーザー指摘「更新情報の時間がおかしい / さっき直したんじゃないの？ /
//     ちゃんとリアルタイムで合わせて」。1回目の修正では**日付(YYYY-MM-DD)だけ**を比べていたため、
//     同じ日の未来時刻(いま17時なのに 23:30 / 21:00 / 20:40 …)を8件見逃していた。
//     日付ではなく**日時**で比べる。
const nowJst = (() => {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // JST
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
})();
const future = entries.filter(e => e.date > nowJst);
check('未来の日時がない', future.length === 0,
  `${future.length}件${future.length ? `(例: ${future[0].date} / いまは ${nowJst})` : ''}`);

// ★日時は「そのエントリが入ったコミットの時刻(JST)」に合わせる。
//   適当な連番(21:00 / 20:40 / 20:10 …)を振ると、実際の作業時刻とずれていく。
//   git のコミット日時と突き合わせ、1時間以上ずれているものを拾う。
//   (git が使えない環境ではこの確認だけ飛ばす)
try {
  const { execFileSync } = require('child_process');
  // コミット時刻は UNIX 秒(%at)で受け取り、こちらで日本時間へ直す。git の --date=format: は実行環境の
  // 時間帯で出るので、UTC の環境(CI・サンドボックス)では全項目が9時間ずれて 150件のNGになった(2026-09-07)。
  const jst = sec => { const d = new Date(sec * 1000 + 9 * 3600 * 1000); const p = n => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; };
  const log = execFileSync('git', ['log', '--reverse', '--format=%H %at',
    '--', 'monster-hero/data/changelog.js'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  // 浅い clone(サンドボックス・CI の fetch-depth)では、いちばん古いコミットがファイルの全行を「追加」した
  // 扱いになり、そこにある項目はすべてそのコミットの時刻と比べられて全件NGになる(2026-09-07・149件)。
  // 浅い clone のときは、その境界のコミットで初めて現れた項目は照合しない(それより新しい項目は照合する)。
  let boundary = null;
  try { if (execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: root, encoding: 'utf8' }).trim() === 'true') boundary = (log[0] || '').split(' ')[0]; } catch {}
  const timeOf = new Map();
  for (const line of log) {
    if (!line.trim()) continue;
    const [sha, at] = line.split(' ');
    const when = sha === boundary ? null : jst(Number(at));
    const diff = execFileSync('git', ['show', sha, '--format=', '-U0', '--', 'monster-hero/data/changelog.js'],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    for (const m2 of diff.matchAll(/^\+.*?title:'((?:[^'\\]|\\.)*)'/gm)) {
      if (!timeOf.has(m2[1])) timeOf.set(m2[1], when);
    }
  }
  const drift = [];
  for (const m2 of changelog.matchAll(/date: "([^"]+)"[^\n]*?title:'((?:[^'\\]|\\.)*)'/g)) {
    const real = timeOf.get(m2[2]);
    if (!real) continue;
    const gap = Math.abs(new Date(`${m2[1]}:00`) - new Date(`${real}:00`)) / 3600000;
    if (gap >= 1) drift.push(`${m2[1]}(実際 ${real}) ${m2[2].slice(0, 20)}`);
  }
  check('日時が実際のコミット時刻と合っている', drift.length === 0,
    `${drift.length}件${drift.length ? `(例: ${drift[0]})` : ''}`);
} catch (e) {
  console.log(`--  コミット時刻との突き合わせは飛ばす(${e && e.message ? e.message.split('\n')[0] : e})`);
}

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
