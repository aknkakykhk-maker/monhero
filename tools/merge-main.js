#!/usr/bin/env node
// main を作業ブランチへ取り込み、作り直しでできるファイル(生成物)のぶつかりを道具で解く(2026-10-23 社長が選んだ仕組みづくり)。
//
//   node tools/merge-main.js                 … origin/main を取り込む(fetch → merge → 生成物は作り直す → 印の確かめ → コミット)
//   node tools/merge-main.js --continue      … 止まったあと、parts・data のぶつかりを手で直してから、続きをやる
//   node tools/merge-main.js --base <ref>    … origin/main 以外を取り込む
//   node tools/merge-main.js --no-commit     … 最後のコミットだけしない(中身を見てから自分でコミットする)
//
// 【なぜ要るか】
// セッションを2つ以上同時に走らせると、直している場所がまったく別でも、main を取り込むたびに
// game-system.jsx・game-system.compiled.js・index.html・version.json・tailwind.css・10-core.jsx の BUILD_DATE などが
// 必ずぶつかる。手で直していて、ぶつかりの印(<<<<<<< など)が残ったままコミットする事故が起きた。
// また更新履歴(data/changelog.js)は「先頭に足す」決まりなので、同じ日に両方が足すと本当にぶつかり、
// 手で並べ直したときに閉じ括弧を1つ落として、検査が29本まとめて落ちたこともある。
//
// 【やること】
// ① 生成物(GENERATED)は main 側を取ってから、最後に build.js で parts・data から作り直す(中身は何でもよい)
// ② 10-core.jsx は、ぶつかりが BUILD_DATE の1行だけのときに限ってこちら側を取る(build.js が付け直す)
// ③ 更新履歴は、こちらが先頭に足した項目だけを、main 側の並びの日時の合う所へ差し込む(main 側の並びは動かさない)。
//    こちらが先頭以外を書き換えていたら、手で直してもらう
// ④ それ以外(parts・data・資料など)のぶつかりは止めて知らせる。直したら --continue
// ⑤ 最後に、追跡しているファイル全部にぶつかりの印が残っていないか・更新履歴が読めるか・build.js --check が通るかを確かめる
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name) => args.includes(name);
const valueOf = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const BASE = valueOf('--base', 'origin/main');
const CHANGELOG = 'monster-hero/data/changelog.js';
const CORE = 'monster-hero/src/parts/10-core.jsx';
// build.js が parts・data から作り直すファイル。ぶつかっても main 側を取ればよい
const GENERATED = [
  'monster-hero/src/game-system.jsx',
  'monster-hero/game-system.compiled.js',
  'monster-hero/index.html',
  'monster-hero/version.json',
  'monster-hero/tailwind.css',
  'monster-hero/asset-manifest.json',
  'monster-hero/data/assistant-chat-digest.json',
];

const git = (...a) => {
  const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const say = (s) => console.log(s);
const stop = (msg, code = 1) => { console.error(`\nNG: ${msg}`); process.exit(code); };
const conflicted = () => git('diff', '--name-only', '--diff-filter=U').out.split('\n').filter(Boolean);
const MARK_RE = /^(<{7}( |$)|={7}$|>{7}( |$))/m;

// ---- ② 10-core.jsx: ぶつかりが BUILD_DATE の行だけなら、こちら側を取る ----
function resolveCore() {
  const file = path.join(ROOT, CORE);
  const src = fs.readFileSync(file, 'utf8');
  const hunk = /<{7}[^\n]*\n([\s\S]*?)={7}\n([\s\S]*?)>{7}[^\n]*\n/g;
  let onlyBuildDate = true;
  const out = src.replace(hunk, (all, ours, theirs) => {
    const lines = (t) => t.split('\n').filter(l => l.trim());
    if (![...lines(ours), ...lines(theirs)].every(l => /^const BUILD_DATE = /.test(l))) onlyBuildDate = false;
    return ours;
  });
  if (!onlyBuildDate) return false;
  fs.writeFileSync(file, out);
  return !MARK_RE.test(out);
}

// ---- ③ 更新履歴: こちらが先頭に足した項目を、main 側の先頭へ差し込む ----
const HEAD_RE = /const CHANGELOG = \[\n/;
// 配列の先頭から、1件ずつ(2つ下げの「  {」から「  },」まで)を切り出す。残りはそのまま
function splitHead(text) {
  const m = HEAD_RE.exec(text);
  if (!m) return null;
  const start = m.index + m[0].length;
  const entries = [];
  let at = start;
  while (text.startsWith('  {\n', at)) {
    const end = text.indexOf('\n  },\n', at);
    if (end < 0) break;
    entries.push(text.slice(at, end + 6));
    at = end + 6;
  }
  return { before: text.slice(0, start), entries, after: text.slice(at) };
}
const dateOf = (entry) => ((/date:\s*"([^"]+)"/.exec(entry) || [])[1] || '');
const parses = (text) => { try { vm.runInNewContext(`${text}\n;CHANGELOG.length`, {}, { timeout: 5000 }); return true; } catch { return false; } };
function resolveChangelog() {
  const show = (ref) => git('show', `${ref}:${CHANGELOG}`);
  const mergeBase = git('merge-base', 'HEAD', 'MERGE_HEAD').out;
  const base = show(mergeBase), ours = show('HEAD'), theirs = show('MERGE_HEAD');
  if (!base.ok || !ours.ok || !theirs.ok) return 'どれかの版が読めない';
  const B = splitHead(base.out + '\n'), O = splitHead(ours.out + '\n'), T = splitHead(theirs.out + '\n');
  if (!B || !O || !T) return '配列の先頭が見つからない';
  const baseSet = new Set(B.entries);
  const added = O.entries.filter(e => !baseSet.has(e));
  // こちらが足したのは先頭だけで、ほかは触っていないか(足した項目を除くと元と同じか)
  const oursRest = O.before + O.entries.filter(e => baseSet.has(e)).join('') + O.after;
  const baseAll = B.before + B.entries.join('') + B.after;
  if (oursRest !== baseAll) return 'こちらが先頭以外の項目も書き換えている';
  const theirsSet = new Set(T.entries);
  // main 側の並びはそのまま。こちらが足した項目だけを、それより古い最初の項目の手前へ差し込む(同じ日時なら main 側のあと)
  const merged = [...T.entries];
  for (const e of added.filter(x => !theirsSet.has(x))) {
    const at = merged.findIndex(x => dateOf(x) && dateOf(x).localeCompare(dateOf(e)) < 0);
    merged.splice(at < 0 ? merged.length : at, 0, e);
  }
  const text = T.before + merged.join('') + T.after;
  if (!parses(text.replace(/\n$/, ''))) return '組み立てた更新履歴が読めない(書き方が崩れた)';
  fs.writeFileSync(path.join(ROOT, CHANGELOG), text.replace(/\n$/, '') + (theirs.out.endsWith('\n') ? '' : '\n'));
  return null;
}

function finish() {
  say('・作り直し: node tools/build.js');
  const b = spawnSync(process.execPath, [path.join(__dirname, 'build.js')], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (b.status !== 0) stop(`build.js が失敗しました\n${(b.stdout || '').slice(-1500)}${(b.stderr || '').slice(-1500)}`);
  git('add', '-A', '--', 'monster-hero');
  // ⑤ 追跡しているファイル全部に、ぶつかりの印が残っていないか
  const marks = git('grep', '-n', '-I', '-E', '^(<{7}( |$)|={7}$|>{7}( |$))', '--', '.', ':!tools/node_modules');
  if (marks.out) stop(`ぶつかりの印が残っています(直してから --continue):\n${marks.out.split('\n').slice(0, 20).join('\n')}`);
  if (conflicted().length) stop(`まだ解けていないファイルがあります: ${conflicted().join(' ')}`);
  if (!parses(fs.readFileSync(path.join(ROOT, CHANGELOG), 'utf8'))) stop('更新履歴(data/changelog.js)が読めません');
  const check = spawnSync(process.execPath, [path.join(__dirname, 'build.js'), '--check'], { cwd: ROOT, encoding: 'utf8' });
  if (check.status !== 0) stop(`build.js --check が通りません\n${(check.stdout || '').slice(-1500)}`);
  say('・確かめた: ぶつかりの印なし / 更新履歴が読める / build.js --check');
  if (opt('--no-commit')) { say('\nコミットはしていません(--no-commit)。git status で中身を見てから git commit してください'); return; }
  const inMerge = fs.existsSync(path.join(ROOT, '.git', 'MERGE_HEAD')) || git('rev-parse', '-q', '--verify', 'MERGE_HEAD').ok;
  const msg = `${BASE} を取り込む(tools/merge-main.js)`;
  const c = inMerge ? git('commit', '--no-edit', '-m', msg) : git('commit', '-m', `${BASE} を取り込んだあと作り直す(tools/merge-main.js)`);
  if (!c.ok && !/nothing to commit/.test(c.out + c.err)) stop(`コミットできませんでした: ${c.err || c.out}`);
  say(`\nOK: ${BASE} を取り込みました(${git('rev-parse', '--short', 'HEAD').out})。検査を通してからプッシュしてください`);
}

function main() {
  const inMerge = git('rev-parse', '-q', '--verify', 'MERGE_HEAD').ok;
  if (opt('--continue')) {
    if (!inMerge) say('(取り込みの途中ではありません。作り直しと確かめだけをします)');
    const left = conflicted().filter(f => !GENERATED.includes(f));
    for (const f of conflicted().filter(f => GENERATED.includes(f))) { git('checkout', '--theirs', '--', f); git('add', '--', f); }
    if (left.length) stop(`まだ解けていないファイルがあります(直して git add してから --continue): ${left.join(' ')}`);
    return finish();
  }
  if (inMerge) stop('取り込みの途中です。ぶつかりを直してから node tools/merge-main.js --continue');
  const dirty = git('status', '--porcelain', '--untracked-files=no').out.split('\n').filter(l => l.trim() && !/tools\/node_modules/.test(l));
  if (dirty.length) stop(`コミットしていない変更があります。先にコミットしてください:\n${dirty.slice(0, 10).join('\n')}`);
  if (BASE.startsWith('origin/')) {
    say(`・取ってくる: git fetch origin ${BASE.slice(7)}`);
    const f = git('fetch', 'origin', BASE.slice(7));
    if (!f.ok) stop(`fetch できませんでした: ${f.err}`);
  }
  const behind = git('rev-list', '--count', `HEAD..${BASE}`).out;
  if (behind === '0') { say(`OK: ${BASE} はもう取り込んであります(取り込むものなし)`); return; }
  say(`・取り込む: git merge ${BASE}(${behind}件)`);
  const m = git('merge', '--no-ff', '--no-commit', BASE);
  if (!m.ok && !conflicted().length) stop(`merge できませんでした: ${m.err || m.out}`);
  const list = conflicted();
  const manual = [];
  for (const f of list) {
    if (GENERATED.includes(f)) { git('checkout', '--theirs', '--', f); git('add', '--', f); say(`  生成物(作り直す): ${f}`); continue; }
    if (f === CORE) {
      if (resolveCore()) { git('add', '--', f); say(`  BUILD_DATE だけ(作り直す): ${f}`); continue; }
      manual.push(`${f}(BUILD_DATE 以外もぶつかっている)`); continue;
    }
    if (f === CHANGELOG) {
      const why = resolveChangelog();
      if (!why) { git('add', '--', f); say(`  更新履歴(両方の項目を新しい順に残した): ${f}`); continue; }
      manual.push(`${f}(${why}。両方の項目を残し、新しい順に並べる)`); continue;
    }
    manual.push(f);
  }
  if (manual.length) {
    console.error('\n止めました。次のぶつかりは中身の競合なので、手で直してください(git add まで):');
    for (const f of manual) console.error(`  ${f}`);
    console.error('\n直したら: node tools/merge-main.js --continue   (やめるなら: git merge --abort)');
    process.exit(1);
  }
  finish();
}

main();
