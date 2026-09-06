// 検査を「領域」ごとにまとめて回すための入口。
//
//   node tools/run-checks.js --list                 … 領域と、その中の検査を一覧する
//   node tools/run-checks.js --area required        … CLAUDE.md の必須検査(本体を触ったら必ず通すもの)
//   node tools/run-checks.js --area ci              … compiled-check.yml が回すものと同じ並び
//   node tools/run-checks.js --area battle,masu     … フォルダ単位(tools/<分類>/ の *-check.js)
//   node tools/run-checks.js --area all             … 全部(30分以上かかる)
//   オプション: --no-server(実ブラウザ検査用の配信を起動しない) --timeout <秒> --json <出力先>
//
// 【なぜ要るか】
// 検査は 300 本以上あるが CI で回るのは 28 本だけで、残りは担当者が変更範囲を見て手で選んでいた。
// 構造を直す作業では「どこに響いたか」が事前に分からないので、領域ごと・あるいは全部を
// 1 コマンドで回して OK / NG / SKIP を集計できる入口が要る(docs/refactor/REFACTOR_MASTER_PLAN.md STEP 1)。
//
// 【決めごと】
// ・検査の中身や判定は一切変えない。ここは既存のスクリプトを順に呼ぶだけ。
// ・領域の中身はできるだけ「探して決める」。フォルダの *-check.js を集め、ci は yml を読む。
//   一覧を手で写すと、検査を足したときにここへ書き忘れて「回っているつもり」になる。
// ・並列にはしない。実ブラウザ検査が固定ポート(8899 / 8977 など)を使うため、ぶつかる。
// ・playwright が入っていない環境では、それを要る検査を SKIP として数える(NG にはしない)。
// ・既存の GitHub Actions は触らない。CI に何を足すかは、この結果(所要時間)を見て別途決める。
const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn, spawnSync } = require('child_process');

const TOOLS_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
const SERVER_PORT = 8899;

// CLAUDE.md ⑤⑥ が「触ったら必ず通す」と決めているもの。build.js は --check で呼ぶ
// (ここで本ビルドをすると version が進んでしまうため)。
const REQUIRED = [
  'build.js --check',
  'check-syntax.js',
  'undefined-reference-check.js',
  'jsx-text-brace-check.js',
  'render-error-check.js',
  'compiled-runtime-check.js',
  'help-coverage-check.js',
  'help-guide-check.js',
  'help-render-check.js',
  'assistant-check.js',
  'assistant-bond-check.js',
  'boot/market-notice-check.js',
  'assistant/assistant-update-notice-check.js',
  'image-asset-check.js',
];

// 名前は *-check.js ではないが、CI や運用で「検査」として使っているもの
const EXTRA_CHECKS = {
  mode: ['rhythm-easy-alignment-audit.js', 'rhythm-easy-ear-review-plan.js', 'rhythm-note-geometry-audit.js'],
};

function parseArgs(argv) {
  const opts = { areas: [], list: false, server: true, timeoutSec: 600, json: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') opts.list = true;
    else if (a === '--no-server') opts.server = false;
    else if (a === '--area') opts.areas.push(...String(argv[++i] || '').split(',').filter(Boolean));
    else if (a === '--timeout') opts.timeoutSec = Number(argv[++i]) || opts.timeoutSec;
    else if (a === '--json') opts.json = argv[++i];
    else if (a === '--script') opts.scripts = (opts.scripts || []).concat(String(argv[++i] || '').split(',').filter(Boolean));
    else if (a.startsWith('--area=')) opts.areas.push(...a.slice(7).split(',').filter(Boolean));
    else if (!a.startsWith('--')) opts.areas.push(a);
  }
  return opts;
}

function ciCommands() {
  // compiled-check.yml の `node tools/...` 行をそのまま拾う。yml を正本にするため、ここには書き写さない
  const yml = fs.readFileSync(path.join(REPO_ROOT, '.github/workflows/compiled-check.yml'), 'utf8');
  const out = [];
  for (const line of yml.split('\n')) {
    const m = line.match(/^\s*(?:-\s*)?(?:run:\s*)?node tools\/(\S+)(\s+--\S+)?\s*$/);
    if (m) out.push((m[1] + (m[2] || '')).trim());
  }
  return out;
}

function discoverAreas() {
  const areas = new Map();
  areas.set('required', REQUIRED.slice());
  areas.set('ci', ciCommands());
  const rootChecks = fs.readdirSync(TOOLS_DIR).filter(f => f.endsWith('-check.js')).sort();
  areas.set('root', rootChecks);
  for (const dir of fs.readdirSync(TOOLS_DIR).sort()) {
    const full = path.join(TOOLS_DIR, dir);
    if (!fs.statSync(full).isDirectory() || ['node_modules', 'art-sources', 'out'].includes(dir)) continue;
    const files = fs.readdirSync(full).filter(f => f.endsWith('-check.js'));
    for (const extra of EXTRA_CHECKS[dir] || []) if (fs.existsSync(path.join(full, extra))) files.push(extra);
    if (files.length) areas.set(dir, files.sort().map(f => `${dir}/${f}`));
  }
  return areas;
}

function scriptMeta(command) {
  const file = path.join(TOOLS_DIR, command.split(' ')[0]);
  let src = '';
  try { src = fs.readFileSync(file, 'utf8'); } catch { return { exists: false }; }
  return {
    exists: true,
    needsServer: /localhost:8899|:8899\//.test(src),
    // 自分で serve.py や http.createServer を立てる検査。共有の配信と同じポートを取り合うので、その間は共有側を止める
    ownServer: /spawn(?:Sync)?\([^\n]*(?:serve\.py|python)|createServer\(/.test(src),
    needsPlaywright: /require\(['"]playwright['"]\)/.test(src),
    needsCanvas: /require\(['"]canvas['"]\)|loadDyeModule\(/.test(src),
  };
}

function canResolve(mod) {
  try { require.resolve(mod, { paths: [TOOLS_DIR] }); return true; } catch { return false; }
}

function portOpen(port) {
  return new Promise(resolve => {
    const s = net.createConnection({ port, host: '127.0.0.1' });
    s.once('connect', () => { s.end(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}

async function startServer() {
  if (await portOpen(SERVER_PORT)) return { stop() {}, note: `既に :${SERVER_PORT} が開いていたのでそれを使う` };
  const child = spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(SERVER_PORT)], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    if (await portOpen(SERVER_PORT)) return { stop() { try { child.kill(); } catch {} }, note: `serve.py を :${SERVER_PORT} で起動` };
    await new Promise(r => setTimeout(r, 100));
  }
  try { child.kill(); } catch {}
  return { stop() {}, note: `serve.py を起動できなかった(:${SERVER_PORT})。実ブラウザ検査は NG になりうる` };
}

function runOne(command, timeoutSec) {
  const [file, ...args] = command.split(' ');
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(TOOLS_DIR, file), ...args], {
    cwd: REPO_ROOT, encoding: 'utf8', timeout: timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024,
  });
  const sec = (Date.now() - t0) / 1000;
  const output = (r.stdout || '') + (r.stderr || '');
  if (r.error && r.error.code === 'ETIMEDOUT') return { status: 'TIMEOUT', sec, output };
  return { status: r.status === 0 ? 'OK' : 'NG', sec, output, code: r.status };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const areas = discoverAreas();
  if (opts.list || (opts.areas.length === 0 && !(opts.scripts && opts.scripts.length))) {
    console.log('領域と検査の一覧(--area <名前> で実行。all で全部):');
    for (const [name, list] of areas) {
      console.log(`\n[${name}] ${list.length}本`);
      for (const c of list) console.log(`  ${c}`);
    }
    if (opts.areas.length === 0) console.log('\n例: node tools/run-checks.js --area required');
    return;
  }
  const wanted = opts.areas.includes('all') ? [...areas.keys()] : opts.areas;
  const unknown = wanted.filter(a => !areas.has(a));
  if (unknown.length) { console.error(`NG: 知らない領域: ${unknown.join(', ')}(--list で確認)`); process.exit(2); }
  const commands = [];
  for (const a of wanted) for (const c of areas.get(a)) if (!commands.includes(c)) commands.push(c);
  for (const c of opts.scripts || []) if (!commands.includes(c)) commands.push(c);

  const hasPlaywright = canResolve('playwright');
  const hasCanvas = canResolve('canvas');
  // 共有の配信(serve.py)は、要る検査の直前に起動し、自分で配信を立てる検査の前には止める(ポートの取り合いを避ける)
  let server = null;
  const ensureServer = async () => { if (!server && opts.server) { server = await startServer(); console.log(`  (${server.note})`); } };
  const releaseServer = async () => { if (server) { server.stop(); server = null; for (let i = 0; i < 50 && await portOpen(SERVER_PORT); i++) await new Promise(r => setTimeout(r, 100)); } };
  console.log(`検査 ${commands.length} 本 / 領域: ${wanted.join(', ')} / playwright: ${hasPlaywright ? 'あり' : 'なし'} / canvas: ${hasCanvas ? 'あり' : 'なし'} / 配信: ${opts.server ? '必要なときだけ自動起動' : '起動しない(--no-server)'}`);

  const results = [];
  const started = Date.now();
  try {
    for (const command of commands) {
      const meta = scriptMeta(command);
      let res;
      if (!meta.exists) res = { status: 'MISSING', sec: 0, output: '' };
      else if (meta.needsPlaywright && !hasPlaywright) res = { status: 'SKIP', sec: 0, output: 'playwright が無い' };
      else if (meta.needsCanvas && !hasCanvas) res = { status: 'SKIP', sec: 0, output: 'canvas が無い' };
      else {
        if (meta.ownServer) await releaseServer(); else if (meta.needsServer) await ensureServer();
        res = runOne(command, opts.timeoutSec);
      }
      results.push({ command, ...res, needsServer: !!meta.needsServer, needsPlaywright: !!meta.needsPlaywright });
      const mark = res.status === 'OK' ? 'OK  ' : res.status === 'SKIP' ? 'SKIP' : res.status === 'NG' ? 'NG  ' : res.status;
      console.log(`${mark} ${res.sec.toFixed(1).padStart(6)}s  ${command}`);
    }
  } finally {
    await releaseServer();
  }

  const count = s => results.filter(r => r.status === s).length;
  const totalSec = (Date.now() - started) / 1000;
  console.log(`\n合計 ${results.length} 本 / OK ${count('OK')} / NG ${count('NG')} / TIMEOUT ${count('TIMEOUT')} / SKIP ${count('SKIP')} / MISSING ${count('MISSING')} / ${Math.round(totalSec)}秒`);
  const bad = results.filter(r => !['OK', 'SKIP'].includes(r.status));
  for (const r of bad) {
    console.log(`\n--- ${r.status}: ${r.command}`);
    console.log(r.output.trim().split('\n').slice(-8).map(l => '    ' + l).join('\n'));
  }
  if (opts.json) {
    fs.writeFileSync(opts.json, JSON.stringify({ at: new Date().toISOString(), areas: wanted, totalSec, results: results.map(r => ({ command: r.command, status: r.status, sec: Math.round(r.sec * 10) / 10, needsServer: r.needsServer, needsPlaywright: r.needsPlaywright, tail: r.status === 'OK' ? undefined : r.output.trim().split('\n').slice(-8) })) }, null, 2));
    console.log(`\n結果を書き出した: ${opts.json}`);
  }
  process.exit(bad.length ? 1 : 0);
}

main().catch(e => { console.error('NG: run-checks 自体が失敗:', e && e.stack || e); process.exit(2); });
