#!/usr/bin/env node
// Edge Function(assistant-chat)の配り直しで、窓口が deploy_edge_function に渡すものを作る(数行の index.ts だけ)。
//
//   node tools/ctx.js redeploy assistant-chat            … origin/main のいまの版で作る(先に git fetch origin main)
//   node tools/ctx.js redeploy assistant-chat <コミット>  … その版で作る(40桁。短い形は 40桁に直して使う)
//   node tools/ctx.js redeploy assistant-chat --json      … deploy_edge_function の引数をそのまま JSON で
//   node tools/ctx.js redeploy assistant-chat --verify    … raw.githubusercontent.com からその版が読めるかも確かめる
//
// 【なぜあるか】(2026-11-11 トークン節約の仕組み・案E。手順は docs/rules/EDGE_REDEPLOY.md)
// 配り直しのたびに index.ts(約10KB)を会話に乗せて送っていた。本体は GitHub の固定の版から読ませ、
// 送るのは「どの版を読むか」の数行だけにする。版の書きまちがい(短い形・ブランチ名・main に無い版)は
// ここで止める。
// ・jsdelivr は新しいコミットで 403 になるので使わない(2026-11-08 version 19 で起きた)。raw.githubusercontent.com だけ
// ・この道具は配らない(Supabase に触れない)。配るのは窓口
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const REPO = 'aknkakykhk-maker/monhero';
const PROJECT_ID = 'zrzevudkbgtxlbvmuziy';
// 配り直せる関数。entry は「index.ts が読む本体」。本体が相対で読むファイル(core.js など)は同じ版から一緒に読まれる
const FUNCTIONS = {
  'assistant-chat': { entry: 'serve.js', needs: ['serve.js', 'core.js', 'ranking.js'], verify_jwt: false, after: '不正な頼み(空の本文)を本番のゲームの Origin から送り、400 bad_request が返ること' },
  'masmon-pvp': { entry: 'serve.js', needs: ['serve.js', 'core.js', 'engine.js'], verify_jwt: false, after: '空の本文({})を本番のゲームの Origin から送り、400 bad_request が返ること' },
};

const git = (args) => { const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 ? r.stdout.trim() : ''; };

function buildDeploy(name, sha) {
  const fn = FUNCTIONS[name];
  if (!fn) throw new Error(`「${name}」は配り直しの表にありません(いま: ${Object.keys(FUNCTIONS).join('・')})`);
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`版は40桁のコミットで渡す(ブランチ名・短い形は不可): ${sha}`);
  const dir = `supabase/functions/${name}`;
  const src = fs.readFileSync(path.join(ROOT, dir, 'index.ts'), 'utf8');
  const local = `"./${fn.entry}"`;
  if (src.split(local).length !== 2) throw new Error(`${dir}/index.ts に ${local} がちょうど1か所あること`);
  const url = `https://raw.githubusercontent.com/${REPO}/${sha}/${dir}/${fn.entry}`;
  // 頭の説明コメントは送らない(量を減らす)。読む行だけ
  const code = src.split('\n').filter(l => l.trim() && !l.startsWith('//')).join('\n').replace(local, `"${url}"`);
  const content = `// ${name} の中継ぎ。本体は GitHub の固定の版から読む(作り方: node tools/ctx.js redeploy ${name})\n${code}\n`;
  return { project_id: PROJECT_ID, name, entrypoint_path: 'index.ts', verify_jwt: fn.verify_jwt, files: [{ name: 'index.ts', content }], sha, url, after: fn.after };
}

function resolveSha(name, arg) {
  const fn = FUNCTIONS[name];
  const dir = `supabase/functions/${name}`;
  const sha = git(['rev-parse', '--verify', '--quiet', `${arg || 'origin/main'}^{commit}`]);
  if (!sha) throw new Error(`版「${arg || 'origin/main'}」が見つかりません(先に git fetch origin main)`);
  const main = git(['rev-parse', '--verify', '--quiet', 'origin/main^{commit}']);
  if (main && spawnSync('git', ['merge-base', '--is-ancestor', sha, main], { cwd: ROOT }).status !== 0) {
    throw new Error(`${sha.slice(0, 8)} は origin/main に入っていません(マージされた版だけ配る。先に git fetch origin main)`);
  }
  // その版に本体がそろっているか・index.ts がその版でも「本体を読むだけ」の形か
  for (const f of fn.needs) if (spawnSync('git', ['cat-file', '-e', `${sha}:${dir}/${f}`], { cwd: ROOT }).status !== 0) {
    throw new Error(`${sha.slice(0, 8)} の版には ${dir}/${f} がありません(serve.js を入れた PR より後の版を使う)`);
  }
  const idxAt = git(['show', `${sha}:${dir}/index.ts`]);
  const idxNow = fs.readFileSync(path.join(ROOT, dir, 'index.ts'), 'utf8').trim();
  if (idxAt !== idxNow) throw new Error(`${dir}/index.ts が、その版(${sha.slice(0, 8)})と手元とで違います。手元を main に合わせてから打つ`);
  return sha;
}

function main() {
  const argv = process.argv.slice(2);
  const pos = argv.filter(a => !a.startsWith('--'));
  const name = pos[0];
  if (!name) { console.error(`NG: node tools/ctx.js redeploy <関数> [コミット]  (いま: ${Object.keys(FUNCTIONS).join('・')})`); process.exit(1); }
  let d;
  try { d = buildDeploy(name, resolveSha(name, pos[1])); } catch (e) { console.error('NG: ' + e.message); process.exit(1); }
  if (argv.includes('--verify')) {
    const r = spawnSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '20', d.url], { encoding: 'utf8' });
    const code = (r.stdout || '').trim();
    if (code !== '200') { console.error(`NG: ${d.url} が ${code || '読めない'}(GitHub に版が届くまで少し待って、もう一度)`); process.exit(1); }
    console.error('OK: raw から読めた(200)');
  }
  const args = { project_id: d.project_id, name: d.name, entrypoint_path: d.entrypoint_path, verify_jwt: d.verify_jwt, files: d.files };
  if (argv.includes('--json')) { console.log(JSON.stringify(args, null, 1)); return; }
  console.log(`# ${name} の配り直し(版 ${d.sha.slice(0, 8)}・送るのは ${Buffer.byteLength(d.files[0].content)} バイト)`);
  console.log('deploy_edge_function に渡すもの:');
  console.log(`  project_id: ${d.project_id}`);
  console.log(`  name: ${d.name}`);
  console.log('  entrypoint_path: index.ts');
  console.log(`  verify_jwt: ${d.verify_jwt}`);
  console.log('  files: [ { name: "index.ts", content: ↓ } ]   ← このファイル1つだけ(core.js などは送らない)');
  console.log('----');
  process.stdout.write(d.files[0].content);
  console.log('----');
  console.log(`配ったあと: ${d.after}`);
  console.log('台帳に1行(版の番号と、このコミット)。JSON で欲しいときは --json');
}

if (require.main === module) main();
module.exports = { buildDeploy, FUNCTIONS };
