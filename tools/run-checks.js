// 検査を「領域」ごとにまとめて回すための入口。
//
//   node tools/run-checks.js --list                 … 領域と、その中の検査を一覧する
//   node tools/run-checks.js --area required        … CLAUDE.md の必須検査(本体を触ったら必ず通すもの)
//   node tools/run-checks.js --area ci              … compiled-check.yml が回すものと同じ並び
//   node tools/run-checks.js --area battle,masu     … フォルダ単位(tools/<分類>/ の *-check.js)
//   node tools/run-checks.js --area all             … 全部(30分以上かかる)
//   node tools/run-checks.js --changed              … いま変更しているファイルから、要る検査だけを選んで回す
//   node tools/run-checks.js --changed --plan       … 選んだ検査を出すだけ(実行しない)
//   オプション: --limit N(選ぶ上限。既定40) --wide(当たった領域を丸ごと) --base <ref>(そのrefとの差も見る)
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
  // 更新履歴が「作業報告」になっていないか(2026-09-18・ユーザー指摘
  // 「更新情報はよくあーいう形になってるから、今後はプレイヤー向けに出すようにして」)。
  // 書き忘れと違って画面はふつうに動いてしまうので、必須に入れて毎回通す
  'changelog/player-words-check.js',
  'image-asset-check.js',
];

// 名前は *-check.js ではないが、CI や運用で「検査」として使っているもの
const EXTRA_CHECKS = {
  mode: ['rhythm-easy-alignment-audit.js', 'rhythm-easy-ear-review-plan.js', 'rhythm-note-geometry-audit.js'],
};

// ---- 変更ファイルから、要る検査だけを選ぶ ----------------------------------------
// 「どの検査を通すか」を毎回その場で考えると、打ち漏らす(精度が落ちる)か、
// 念のため全部回す(時間を食う)のどちらかになる。機械に選ばせて、選んだ理由も出す。
//
// フォルダ(領域)を丸ごと足すと mode だけで 184 本になって実用にならないので、
// 変更したファイル名から語を取り出し、その語を名前に含む検査だけを拾う。
// 広げたいときは --changed --wide（領域を丸ごと）か --area <名前>。

// build.js が作り直すぶん。これだけが変わっていても検査を増やす理由にはならない
const GENERATED_RE = /(^|\/)(game-system\.jsx|game-system\.compiled\.js|tailwind\.css|version\.json|package-lock\.json)$/;

// ゲーム本体・データが変わったら、CLAUDE.md ⑥ の必須検査は必ず通す
const CORE_RE = /^monster-hero\/(src\/parts\/|data\/|index\.html$|images\/)/;

// ファイル名から取り出しても検査の絞り込みに効かない語
const GENERIC_TOKENS = new Set([
  'monster', 'hero', 'src', 'parts', 'data', 'screen', 'index', 'main', 'app', 'core', 'util', 'utils',
  'js', 'jsx', 'css', 'html', 'json', 'png', 'jpg', 'mp3', 'md', 'check', 'tools', 'test', 'tmp', 'probe',
]);

// ファイル名では拾えない結び付き（変えたもの → 一緒に見ておきたい語）
const EXTRA_TOKENS = [
  { re: /^monster-hero\/audio\//, add: ['bgm', 'loudness', 'boot'] },
  { re: /^monster-hero\/images\/song-art\//, add: ['song-art', 'changelog', 'boot'] },
  { re: /^monster-hero\/images\//, add: ['image-asset', 'boot'] },
  { re: /^monster-hero\/data\/changelog\.js$/, add: ['notice', 'update-notice'] },
  { re: /^monster-hero\/data\/help\.js$/, add: ['help'] },
  { re: /^monster-hero\/data\/assistants\.js$/, add: ['assistant', 'bond'] },
  { re: /^monster-hero\/data\/rhythm-/, add: ['rhythm', 'chart', 'song'] },
  { re: /^monster-hero\/index\.html$/, add: ['boot'] },
  { re: /^tools\/([a-z-]+)\//, add: m => [m[1]] },
];

// ファイル名の語では拾えないので、検査そのものを名指しするもの
const FORCE_CHECKS = [
  { re: /^(CLAUDE|AGENTS|README)\.md$|^docs\/|^\.claude\/skills\//, checks: ['rules-index-check.js'], why: 'ルールと資料' },
  // 新モード(tactics)の分岐が入っているファイル。ファイル名の語(app・parts)では拾えないので名指しする。
  // 「isTacticsMode で締めたつもり」が既存5モードへ漏れると、遊んでいる人の記録に直に効く
  { re: /^monster-hero\/src\/parts\/(10-core|22-enemy-and-bond-entries|32-tactics-units|60-app|71-screen-battle)\.jsx$/,
    checks: ['battle/legacy-mode-parity-check.js'], why: '新モードの分岐が既存5モードへ漏れていないか' },
  // 譜面(data/rhythm-mode.js)を触ったら、終点フリックの置き場所は必ず見る。
  // 語の当たりだけでは本数の上限で落ちることがあり、曲を足した回だけ静かに見逃す(2026-09-18)
  { re: /^monster-hero\/data\/rhythm-mode\.js$/, checks: ['mode/rhythm-end-flick-swing-check.js'], why: '譜面の終点フリックの置き場所' },
  // 入力の割り当て(rhythmMatchInputBatch)は、片側を直すともう片側が静かに壊れる。
  // 2026-09-18、持ち替えの直しが「押さえている上に重なるノーツを叩けない」を生んだ
  { re: /^monster-hero\/data\/rhythm-mode\.js$/, checks: ['mode/rhythm-tap-during-hold-check.js', 'mode/rhythm-finger-swap-check.js'], why: '押さえながら叩く・指の持ち替え' },
];

function tokensOf(file) {
  const rel = file.replace(/^monster-hero\//, '').replace(/\.[^./]+$/, '');
  const out = new Set();
  // tools/ 直下のスクリプト名と、資料(.md)からは語を取らない。
  // run / where / rules のような一般的な語が、無関係な検査に当たってしまう。
  if (!/^tools\/[^/]+$/.test(file) && !/^docs\//.test(file) && !/^[^/]+\.md$/.test(file)) {
    for (const t of rel.split(/[/\-_.]+/)) {
      const w = t.toLowerCase();
      if (w.length < 3 || GENERIC_TOKENS.has(w) || /^\d+$/.test(w)) continue;
      out.add(w);
    }
  }
  for (const rule of EXTRA_TOKENS) {
    const m = rule.re.exec(file);
    if (!m) continue;
    for (const a of (typeof rule.add === 'function' ? rule.add(m) : rule.add)) out.add(a);
  }
  return [...out];
}

function changedFiles(base) {
  const run = args => {
    const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    return (r.stdout || '').split('\n').filter(l => l.length);
  };
  const out = new Set();
  // porcelain は「XY<空白>パス」。先に trim すると状態の記号を消しそこねる
  for (const l of run(['status', '--porcelain', '-uall'])) out.add(l.slice(3).replace(/^.* -> /, '').replace(/^"|"$/g, ''));
  if (base) for (const f of run(['diff', '--name-only', `${base}...HEAD`])) out.add(f.trim());
  return [...out].filter(Boolean);
}

function checkTokens(command) {
  return new Set(command.replace(/\.[^./]+$/, '').split(/[/\-_.\s]+/).map(t => t.toLowerCase()).filter(Boolean));
}

// 変更から「通す検査の並び」を作る。
// 語が当たる検査が多いほど、その語は大まかだということなので、当たりの少ない語から順に並べる。
// 上限で切ったぶんは必ず本数を出す（黙って減らすと「全部通した」と読めてしまう）。
function planForChanges(files, areas, wide, limit) {
  const core = files.some(f => !GENERATED_RE.test(f) && CORE_RE.test(f));
  const reasons = new Map();      // 検査 -> なぜ選ばれたか
  const rank = new Map();         // 検査 -> 当たった語の大まかさ（小さいほど的確）
  const allChecks = [];
  for (const [name, list] of areas) if (!['required', 'ci'].includes(name)) for (const c of list) if (!allChecks.includes(c)) allChecks.push(c);
  const tokenIndex = allChecks.map(c => ({ c, t: checkTokens(c), area: c.includes('/') ? c.split('/')[0] : 'root' }));

  const hitAreas = new Set();
  for (const f of files) {
    if (GENERATED_RE.test(f)) continue;
    // 検査スクリプト自身を直したときは、その検査を回す。
    // ファイル名から語を取る仕組みでは拾えず、直した本人だけが素通りしていた。
    const self = /^tools\/(.+\.js)$/.exec(f);
    if (self && allChecks.includes(self[1])) { reasons.set(self[1], `この検査自体を変えた（${f}）`); rank.set(self[1], 0); }
    for (const rule of FORCE_CHECKS) {
      if (!rule.re.test(f)) continue;
      for (const c of rule.checks) if (!reasons.has(c)) { reasons.set(c, `${rule.why}（${f}）`); rank.set(c, 0); }
    }
    for (const token of tokensOf(f)) {
      const matched = tokenIndex.filter(x => x.t.has(token));
      for (const x of matched) {
        hitAreas.add(x.area);
        if (!reasons.has(x.c) || matched.length < rank.get(x.c)) { reasons.set(x.c, `${token}（${f}）`); rank.set(x.c, matched.length); }
      }
    }
  }
  if (wide) {
    for (const a of hitAreas) for (const c of areas.get(a) || []) if (!reasons.has(c)) { reasons.set(c, `領域 ${a} を丸ごと（--wide）`); rank.set(c, 9999); }
  }
  const required = core ? areas.get('required').slice() : [];
  for (const c of required) if (!reasons.has(c)) reasons.set(c, 'ゲーム本体を触った（CLAUDE.md ⑥ の必須検査）');
  const rest = [...reasons.keys()].filter(c => !required.includes(c))
    .sort((a, b) => (rank.get(a) - rank.get(b)) || a.localeCompare(b));
  const room = wide ? rest.length : Math.max(0, limit - required.length);
  const picked = [...required, ...rest.slice(0, room)];
  return { picked, reasons, core, dropped: rest.length - Math.min(room, rest.length) };
}

function parseArgs(argv) {
  const opts = { areas: [], list: false, server: true, timeoutSec: 600, json: null, changed: false, plan: false, wide: false, base: null, limit: 40 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--list') opts.list = true;
    else if (a === '--changed') opts.changed = true;
    else if (a === '--plan' || a === '--dry-run') opts.plan = true;
    else if (a === '--wide') opts.wide = true;
    else if (a === '--limit') opts.limit = Number(argv[++i]) || opts.limit;
    else if (a === '--base') opts.base = argv[++i];
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
  areas.set('docs', ['rules-index-check.js']);
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

  if (opts.changed) {
    const files = changedFiles(opts.base);
    const { picked, reasons, core, dropped } = planForChanges(files, areas, opts.wide, opts.limit);
    const src = files.filter(f => !GENERATED_RE.test(f));
    console.log(`変更 ${src.length} 件（ほかに生成物 ${files.length - src.length} 件）→ 検査 ${picked.length} 本`);
    for (const f of src.slice(0, 15)) console.log(`  変更: ${f}`);
    if (src.length > 15) console.log(`  … ほか ${src.length - 15} 件`);
    if (!picked.length) {
      console.log('該当する検査はありません。広げるなら --changed --wide か --area <名前>（--list で一覧）。');
      process.exit(0);
    }
    if (dropped) console.log(`  ※ 当てはまる検査があと ${dropped} 本ありますが、上限 ${opts.limit} 本で切りました（--limit で増やす / --wide で領域ごと）`);
    if (opts.plan) {
      console.log(`\n通す検査 ${picked.length} 本${core ? '（必須検査を含む）' : ''}:`);
      for (const c of picked) console.log(`  ${c.padEnd(46)} ← ${reasons.get(c)}`);
      console.log('\n実行するなら --plan を外してください。広げるなら --wide。');
      return;
    }
    opts.scripts = (opts.scripts || []).concat(picked);
    console.log('');
  }

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
  // 失敗の中身は「最後の8行」ではなく、失敗をじかに言っている行を拾う。
  // 検査によっては原因が途中に出て、最後は集計だけということがあるため。
  const FAIL_LINE = /(^|\s)(NG|FAIL|失敗|不一致|エラー|Error|Cannot|undefined|✗|❌)/;
  for (const r of bad.slice(0, 5)) {
    console.log(`\n--- ${r.status}: ${r.command}`);
    const lines = r.output.trim().split('\n').filter(l => l.trim());
    const core = lines.filter(l => FAIL_LINE.test(l));
    const show = core.length ? core.slice(0, 10) : lines.slice(-8);
    console.log(show.map(l => '    ' + (l.length > 200 ? l.slice(0, 200) + ' …' : l)).join('\n'));
    if (core.length > 10) console.log(`    … ほか ${core.length - 10} 行（全部見るなら  node tools/${r.command}）`);
    else if (!core.length) console.log(`    （失敗を名指しする行が見つからないので末尾を出しています: node tools/${r.command}）`);
  }
  if (bad.length > 5) console.log(`\n… ほか ${bad.length - 5} 本が失敗しています（1本ずつ見るなら  node tools/run-checks.js --script <名前>）`);
  if (opts.json) {
    fs.writeFileSync(opts.json, JSON.stringify({ at: new Date().toISOString(), areas: wanted, totalSec, results: results.map(r => ({ command: r.command, status: r.status, sec: Math.round(r.sec * 10) / 10, needsServer: r.needsServer, needsPlaywright: r.needsPlaywright, tail: r.status === 'OK' ? undefined : r.output.trim().split('\n').slice(-8) })) }, null, 2));
    console.log(`\n結果を書き出した: ${opts.json}`);
  }
  process.exit(bad.length ? 1 : 0);
}

main().catch(e => { console.error('NG: run-checks 自体が失敗:', e && e.stack || e); process.exit(2); });
