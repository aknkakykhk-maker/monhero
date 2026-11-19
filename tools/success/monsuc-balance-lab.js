#!/usr/bin/env node
// モンサクのバランス研究(r1119-014 PR2)。試し対戦を最大10万回まわし、結果を表にまとめ、分析の入り口へ送って報告書を受け取る。
//
//   node tools/success/monsuc-balance-lab.js --runs 1000                  … 回して表を作る(API は呼ばない・費用0)
//   node tools/success/monsuc-balance-lab.js --runs 100000 --workers 4    … 10万回(4並列で約15〜20分の見込み)
//   node tools/success/monsuc-balance-lab.js --from <出力フォルダ> --analyze [--dry-run]
//       … できた表を分析の入り口(tools/analysis/gateway-client.js・Claude Opus 5.5)へ送り、報告書を docs/progress/success-balance/ に置く
//       --dry-run は送らずに見積り(ドル)だけ。合言葉は環境変数 ANALYSIS_GATEWAY_TOKEN(tools/analysis/gateway-client.js の先頭)
//   オプション: --out <フォルダ>(既定は作業用フォルダ。生の行 rows-*.jsonl はリポジトリに入れない)
//
// 1回の育成は tools/success/balance-lab/run.js(芯と本体の試合 msxR3Fight をそのまま使う。本体は書き換えない)。
// 出す物: <出力>/summary.json(集計)・<出力>/table.md(表と気になる点)・<出力>/rows-<n>.jsonl(1回1行)
// 入り口へ送るのは table.md だけ(集計の数字。ゲームのコード・保存データ・個人の情報は入らない)。
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');

// ---- ワーカー: i ≡ w (mod W) の回を受け持ち、1行ずつ書く ----
if (!isMainThread) {
  const { makeLab } = require('./balance-lab/run.js');
  const lab = makeLab();
  const { w, W, runs, file } = workerData;
  const fd = fs.openSync(file, 'w');
  let done = 0, failed = 0;
  for (let i = w; i < runs; i += W) {
    let row;
    try { row = lab.runOne(i); } catch (e) { row = { i, ...lab.condOf(i), error: String(e && e.message).slice(0, 200) }; failed++; }
    fs.writeSync(fd, `${JSON.stringify(row)}\n`);
    done++;
    if (done % 200 === 0) parentPort.postMessage({ w, done, failed });
  }
  fs.closeSync(fd);
  parentPort.postMessage({ w, done, failed, end: true });
  return;
}

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : d; };

// ---- 集計 ----
const q = (arr, p) => { if (!arr.length) return null; const b = arr.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const GRADE_ORDER = ['M', 'SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];
const newGroup = () => ({ n: 0, power: [], statSum: [], techs: [], wins: 0, matches: 0, league: [0, 0], summit: [0, 0], cup: [0, 0], shugyo: [], train: [], rest: [], grades: {}, debutLoss: 0, errors: 0, bad: 0 });
const addTo = (g, r) => {
  g.n++;
  if (r.error) { g.errors++; return; }
  if (![r.power, r.statSum].every(Number.isFinite) || r.power < 0) g.bad++;
  g.power.push(r.power); g.statSum.push(r.statSum); g.techs.push(r.techs);
  g.wins += r.wins; g.matches += r.matches;
  ['league', 'summit', 'cup'].forEach((k) => { g[k][0] += r[k][0]; g[k][1] += r[k][1]; });
  g.shugyo.push(r.acts.shugyo || 0); g.train.push(r.acts.train || 0); g.rest.push(r.acts.rest || 0);
  g.grades[r.grade] = (g.grades[r.grade] || 0) + 1;
  if (r.firstLoss && r.firstLoss.startsWith('debut')) g.debutLoss++;
};
const finishGroup = (g) => ({
  n: g.n, errors: g.errors, bad: g.bad,
  power_p10: q(g.power, 0.1), power_p50: q(g.power, 0.5), power_p90: q(g.power, 0.9),
  stat_p50: q(g.statSum, 0.5), techs_p50: q(g.techs, 0.5),
  win_rate: pct(g.wins, g.matches), league_win: pct(...g.league), summit_win: pct(...g.summit), cup_win: pct(...g.cup),
  shugyo_p50: q(g.shugyo, 0.5), train_p50: q(g.train, 0.5), rest_p50: q(g.rest, 0.5),
  debut_loss: pct(g.debutLoss, g.n - g.errors),
  grades: GRADE_ORDER.filter((k) => g.grades[k]).map((k) => `${k}${Math.round((g.grades[k] / (g.n - g.errors)) * 100)}%`).join(' '),
});

const aggregate = async (files) => {
  const dims = { all: {}, strategy: {}, team: {}, aid: {}, species: {}, 'strategy×team': {} };
  const keyOf = { all: () => '全体', strategy: (r) => r.strategy, team: (r) => r.team, aid: (r) => r.aid, species: (r) => r.species, 'strategy×team': (r) => `${r.strategy}×${r.team}` };
  for (const f of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      const r = JSON.parse(line);
      for (const d of Object.keys(dims)) { const k = keyOf[d](r); (dims[d][k] = dims[d][k] || newGroup()); addTo(dims[d][k], r); }
    }
  }
  const out = {};
  for (const [d, groups] of Object.entries(dims)) out[d] = Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, finishGroup(g)]));
  return out;
};

// ---- 気になる点(候補。差が大きいだけでは不具合と書かない) ----
const findFlags = (sum) => {
  const flags = [];
  const all = sum.all['全体'];
  if (all.errors) flags.push(`途中で止まった回が ${all.errors} 回ある(rows の error を見る)`);
  if (all.bad) flags.push(`総合力・能力の合計が数でない/負の回が ${all.bad} 回ある`);
  for (const d of ['strategy', 'team', 'aid', 'species']) {
    const rows = Object.entries(sum[d]).filter(([, g]) => g.n - g.errors >= 20);
    if (rows.length < 2) continue;
    const meds = rows.map(([k, g]) => [k, g.power_p50]);
    const hi = meds.reduce((a, b) => (b[1] > a[1] ? b : a)); const lo = meds.reduce((a, b) => (b[1] < a[1] ? b : a));
    if (lo[1] > 0 && hi[1] / lo[1] >= 1.15) flags.push(`${d}: 総合力の中央値の差が大きい(高 ${hi[0]} ${hi[1]} / 低 ${lo[0]} ${lo[1]}・${Math.round((hi[1] / lo[1] - 1) * 100)}%)`);
  }
  // 1つの育て方が、編成のほとんどで1位
  const byTeam = {};
  Object.entries(sum['strategy×team']).forEach(([k, g]) => { const [st, tm] = k.split('×'); (byTeam[tm] = byTeam[tm] || []).push([st, g.power_p50, g.n]); });
  const wins = {}; let teams = 0;
  Object.values(byTeam).forEach((list) => { if (list.some((x) => x[2] < 10)) return; teams++; const top = list.reduce((a, b) => (b[1] > a[1] ? b : a)); wins[top[0]] = (wins[top[0]] || 0) + 1; });
  Object.entries(wins).forEach(([st, n]) => { if (teams >= 3 && n / teams >= 0.8) flags.push(`育て方 ${st} が、編成 ${teams} 通りのうち ${n} 通りで総合力1位`); });
  if (all.debut_loss >= 10) flags.push(`デビュー戦で負けて早く終わる回が ${all.debut_loss}%`);
  return flags;
};

const LABELS = { power_p50: '総合力 中央値', power_p10: '下10%', power_p90: '上10%', win_rate: '勝率%', league_win: 'リーグ%', summit_win: 'ファイナル%', cup_win: '大会%', techs_p50: '技の数', shugyo_p50: '修行', train_p50: 'トレ', debut_loss: 'デビュー負け%', grades: '評価の分布' };
const tableMd = (sum, meta, flags) => {
  const cols = ['n', ...Object.keys(LABELS)];
  const head = (title) => [`### ${title}`, '', `| 条件 | ${cols.map((c) => (c === 'n' ? '回数' : LABELS[c])).join(' | ')} |`, `|---|${cols.map(() => '---').join('|')}|`];
  const lines = [
    '# モンサクのバランス研究 結果の表', '',
    `- 回数: ${meta.runs}(ワーカー ${meta.workers}・${meta.seconds}秒)・基にした版: ${meta.base_sha}・芯の版: ${meta.core_version}`,
    '- 試合はゲーム本体の msxR3Fight と同じ入力(試合型アシストの上乗せ・覚醒・aptUp・MONSUC_MATCH_RULE)。手で戦う試合は再現できないので、すべてオート相当',
    '- 条件は 子 × 育て方 × 編成 × 助手 を順に回したもの。育て方は peek(その時に選べる行動と率)だけで決める',
    `- 育て方: ${Object.entries(meta.strategies).map(([k, v]) => `${k}=${v}`).join('・')}`,
    '', '## 気になる点(候補・判定は人と分析に任せる)', '', ...(flags.length ? flags.map((f) => `- ${f}`) : ['- なし']), '',
  ];
  for (const [d, title] of [['all', '全体'], ['strategy', '育て方ごと'], ['team', '編成ごと'], ['aid', '助手ごと'], ['strategy×team', '育て方 × 編成'], ['species', '子(種)ごと']]) {
    lines.push(...head(title));
    Object.entries(sum[d]).sort((a, b) => (b[1].power_p50 || 0) - (a[1].power_p50 || 0))
      .forEach(([k, g]) => lines.push(`| ${k} | ${cols.map((c) => (g[c] === null || g[c] === undefined ? '-' : g[c])).join(' | ')} |`));
    lines.push('');
  }
  return lines.join('\n');
};

// ---- 回す ----
const runAll = async ({ runs, workers, out }) => {
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  const files = [];
  const prog = {};
  await Promise.all(Array.from({ length: workers }, (_, w) => new Promise((resolve, reject) => {
    const file = path.join(out, `rows-${w}.jsonl`); files.push(file);
    const wk = new Worker(__filename, { workerData: { w, W: workers, runs, file } });
    wk.on('message', (m) => {
      prog[m.w] = m.done;
      const total = Object.values(prog).reduce((a, b) => a + b, 0);
      if (m.end || total % 1000 < 200) process.stdout.write(`\r回した: ${total}/${runs}(${Math.round((Date.now() - t0) / 1000)}秒)`);
      if (m.end) resolve();
    });
    wk.on('error', reject);
    wk.on('exit', (code) => { if (code !== 0) reject(new Error(`ワーカー ${w} が止まった(${code})`)); });
  })));
  process.stdout.write('\n');
  const seconds = Math.round((Date.now() - t0) / 1000);
  const sum = await aggregate(files.sort());
  let baseSha = 'unknown';
  try { baseSha = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(); } catch { /* なし */ }
  const { STRATEGIES } = require('./balance-lab/run.js');
  const coreVersion = (() => { try { return require('../../monster-hero/data/monhero-success.js').VERSION || '-'; } catch { return '-'; } })();
  const meta = { runs, workers, seconds, base_sha: baseSha, core_version: coreVersion, strategies: STRATEGIES, made_at: new Date().toISOString() };
  const flags = findFlags(sum);
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ meta, flags, summary: sum }, null, 1));
  fs.writeFileSync(path.join(out, 'table.md'), tableMd(sum, meta, flags));
  return { out, meta, flags, sum };
};

// ---- 入り口へ送って報告書 ----
const SYSTEM = [
  'あなたは育成ゲーム「モンサク(モンヒロサクセス)」のバランスの分析役です。',
  '渡すのは、育成の試し対戦をたくさん回した結果の表(Markdown)です。数字は表にあるものだけを使ってください。',
  '書くこと(日本語・見出しつきの Markdown・3,000字まで):',
  '1. 全体の様子(総合力と評価の分布・勝率)を3行で',
  '2. 育て方・編成・助手・子の差: 強すぎる/弱すぎる組み合わせを、表の数字を引いて多い順に5つまで',
  '3. 「気になる点」の各項目が、仕様として自然な差か、不具合の疑いか、数が足りず判断できないか',
  '4. 直し方の候補を3つまで(どの数字をどちらへ動かすか・良くなる指標・悪くなりそうな指標)。決めるのは人なので「候補」と書く',
  '5. もっと回数や条件を足して確かめたい所',
  '推測は「〜かもしれません」と書く。回数が少ない条件はそう書く。',
].join('\n');
const analyze = async ({ from, dry, reportDir = path.join(ROOT, 'docs', 'progress', 'success-balance') }) => {
  const table = fs.readFileSync(path.join(from, 'table.md'), 'utf8');
  const { meta } = JSON.parse(fs.readFileSync(path.join(from, 'summary.json'), 'utf8'));
  const client = require('../analysis/gateway-client.js');
  const request = { system: SYSTEM, messages: [{ role: 'user', content: table }], max_tokens: 12000, effort: 'high' };
  const est = await client.estimate(request);
  console.log(`見積り(多め): ${JSON.stringify(est)}`);
  if (dry || !est.ok) return est.ok ? 0 : 1;
  const r = await client.send({ action: 'message', kind: 'balance', label: `lab-${meta.runs}-${meta.base_sha}`, request });
  if (r.status !== 200 || !r.json?.ok) { console.log(`断られた・失敗: ${r.status} ${JSON.stringify(r.json)}`); return 1; }
  const stamp = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');
  const dir = reportDir;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${stamp}-report.md`);
  fs.writeFileSync(file, [
    `# モンサクのバランス研究 報告書(${stamp})`, '',
    `- 回数 ${meta.runs}・基にした版 ${meta.base_sha}・分析 ${r.json.model}・費用 $${r.json.usd}(見積り $${r.json.usd_est})`,
    '- この報告書は Claude API(分析の入り口)が表を読んで書いた物。数字の直しは決まっていない(候補)', '',
    r.json.text, '', '---', '', '<details><summary>送った表</summary>', '', table, '', '</details>', '',
  ].join('\n'));
  fs.copyFileSync(path.join(from, 'summary.json'), file.replace(/-report\.md$/, '-summary.json'));
  console.log(`報告書: ${path.relative(ROOT, file)}(費用 $${r.json.usd})`);
  return file;
};

const main = async () => {
  const dry = args.includes('--dry-run');
  if (args.includes('--analyze')) {
    if (!dry && require('../analysis/gateway-client.js').ensureProxyEnv()) return 0;
    const from = opt('--from', '');
    if (!from) throw new Error('--from <出力フォルダ> が要ります');
    const r = await analyze({ from, dry });
    return typeof r === 'string' ? 0 : r;
  }
  const runs = Math.min(100000, Math.max(1, Number(opt('--runs', 1000)) || 1000));
  const workers = Math.min(16, Math.max(1, Number(opt('--workers', Math.min(4, os.cpus().length))) || 1));
  const out = path.resolve(opt('--out', path.join(process.env.SCRATCH || os.tmpdir(), `monsuc-lab-${runs}-${Date.now()}`)));
  const r = await runAll({ runs, workers, out });
  const all = r.sum.all['全体'];
  console.log(`全体: 総合力 中央値 ${all.power_p50}・勝率 ${all.win_rate}%・止まった回 ${all.errors}`);
  console.log(`気になる点: ${r.flags.length} 件`); r.flags.slice(0, 5).forEach((f) => console.log(`  - ${f}`));
  console.log(`表: ${path.join(out, 'table.md')}`);
  return all.errors ? 1 : 0;
};

module.exports = { runAll, analyze, aggregate, findFlags, tableMd, SYSTEM };
if (require.main === module) main().then((c) => process.exit(c), (e) => { console.error(e.message); process.exit(1); });
