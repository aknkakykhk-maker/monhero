// タクティクスくんの記録(tactics-log-*.json)を集めて、バランスの数字と調整の提案を出す。
// 提案は「どの数字をどう変えるとよいか」の案だけ。ゲームの数字は変えない(決めるのは社長。2026-10-09)。
//
//   node tools/playbot/tactics-balance.js                       いちばん新しい結果から(tools/out/playbot/ の下を新しい順に探す)
//   node tools/playbot/tactics-balance.js <dir> [<dir> ...]    その結果の束から(何回分でも合わせて数える)
//   node tools/playbot/tactics-balance.js --all                 tools/out/playbot/ の下の記録を全部
//   node tools/playbot/tactics-balance.js ... --md <file>       Markdown を書き出す(社長への報告用)
//
// 記録を作るのは scenarios/tactics.js(バトル係の部分 tactics)。何回も回すときは
//   PLAYBOT_TACTICS_RUNS=3 node tools/playbot/playbot.js --only tactics
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_ROOT = path.join(ROOT, 'tools', 'out', 'playbot');
const args = process.argv.slice(2);
const mdAt = args.indexOf('--md');
const mdFile = mdAt >= 0 ? args[mdAt + 1] : '';
const dirsArg = args.filter((a, i) => !a.startsWith('--') && i !== mdAt + 1);

const logsIn = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^tactics-log-\d+\.json$/.test(f)).map((f) => path.join(dir, f)) : []);
let files = [];
if (dirsArg.length) files = dirsArg.flatMap((d) => logsIn(path.resolve(d)));
else {
  const dirs = fs.existsSync(OUT_ROOT) ? fs.readdirSync(OUT_ROOT).filter((d) => /^\d{8}-\d{4}/.test(d)).sort().reverse() : [];
  for (const d of dirs) {
    const f = logsIn(path.join(OUT_ROOT, d));
    if (!f.length) continue;
    files.push(...f);
    if (!args.includes('--all')) break;
  }
}
if (!files.length) { console.log('タクティクスの記録(tactics-log-*.json)が見つからない。先に node tools/playbot/playbot.js --only tactics を回す'); process.exit(0); }
const runs = files.map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(f, 'utf8')) }));

const sum = (a) => a.reduce((x, y) => x + y, 0);
const avg = (a) => (a.length ? sum(a) / a.length : 0);
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : 0; };
const pct = (x) => `${Math.round(x * 100)}%`;
const r1 = (x) => Math.round(x * 10) / 10;
const RESULT_JA = { clear: 'クリア', wipe: '全員倒れた', timeout: 'ターン切れ', stopped: '打ち切り' };
const THREAT_JA = { none: '様子見など', single: '1発', big: '必殺技', multi: '3連撃', all: '全体攻撃', pierce: '貫通撃', pierceCharge: '貫通の構え', charge: 'ためる' };

const lines = [];
const out = (t = '') => lines.push(t);

out(`# タクティクスくんのバランス確認(${runs.length}回分)`);
out();
out('## 1回ずつの結果');
out();
out('| 回 | モード・難易度 | 結果 | 着いたWAVE | 合計ターン | 倒れた(のべ) | 味方 | 理由 |');
out('| --- | --- | --- | --- | --- | --- | --- | --- |');
runs.forEach((r, k) => {
  const turns = sum(r.waves.map((w) => w.turns));
  const downs = sum(r.waves.map((w) => w.downs));
  out(`| ${k + 1} | ${r.meta.mode || '?'}・${r.meta.difficulty || '?'} | ${RESULT_JA[r.result] || r.result} | ${r.waves.length} | ${turns} | ${downs} | ${(r.meta.party || []).join('・')} | ${(r.why || []).join(' / ')} |`);
});
out();

// ---- WAVE ごと(敵ごと) ----
const byWave = new Map();
for (const r of runs) for (const w of r.waves) {
  const k = `${w.wave}`;
  if (!byWave.has(k)) byWave.set(k, []);
  byWave.get(k).push({ ...w, run: r });
}
out('## WAVE ごと(敵ごと)');
out();
out('| WAVE | 敵 | 回数 | 決着までのターン(平均) | 終わりの残りライフ | 受けたダメージ/味方の最大ライフ | 倒れた(平均) | 多かった予告 | ガード(平均枚) |');
out('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
const waveRows = [];
for (const [k, ws] of [...byWave.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const enemy = [...new Set(ws.map((w) => w.enemy))].join('/');
  const turns = avg(ws.map((w) => w.turns));
  const hpLeft = avg(ws.map((w) => { const p = w.endParty || []; const m = sum(p.map((x) => x.max)); return m ? sum(p.map((x) => x.hp)) / m : 0; }));
  const takenRatio = avg(ws.map((w) => (w.partyMax ? w.taken / w.partyMax : 0)));
  const downs = avg(ws.map((w) => w.downs));
  const threats = {};
  for (const w of ws) for (const [t, n] of Object.entries(w.threats || {})) threats[t] = (threats[t] || 0) + n;
  const topThreat = Object.entries(threats).filter(([t]) => t !== 'none').sort((a, b) => b[1] - a[1]).slice(0, 2).map(([t, n]) => `${THREAT_JA[t] || t}${n}`).join('・');
  waveRows.push({ wave: Number(k), enemy, turns, hpLeft, takenRatio, downs, n: ws.length, lost: ws.filter((w) => w.result && w.result !== 'clear').length });
  out(`| ${k} | ${enemy} | ${ws.length} | ${r1(turns)} | ${pct(hpLeft)} | ${pct(takenRatio)} | ${r1(downs)} | ${topThreat || '-'} | ${r1(avg(ws.map((w) => w.guards)))} |`);
}
out();

// ---- モンスターごとの貢献 ----
const mons = {};
for (const r of runs) for (const w of r.waves) {
  for (const [m, d] of Object.entries(w.byMon || {})) { mons[m] = mons[m] || { dmg: 0, turns: 0, waves: 0 }; mons[m].dmg += d; }
  for (const [m, t] of Object.entries(w.presence || {})) { mons[m] = mons[m] || { dmg: 0, turns: 0, waves: 0 }; mons[m].turns += t; mons[m].waves += 1; }
}
// ★1ターンあたりの量で比べると、後半の WAVE(敵のライフが大きい)にだけ出た子が強く見える。
//   WAVE ごとに「その子の割合 ÷ そのとき立っていた子の数で割った割合(=頭割り)」を出し、出ていた WAVE で平均した「頭割り比」で比べる
const shareAcc = {};
for (const r of runs) for (const w of r.waves) {
  const present = Object.keys(w.presence || {});
  const total = sum(Object.values(w.byMon || {}));
  if (!present.length || !total) continue;
  for (const m of present) { shareAcc[m] = shareAcc[m] || []; shareAcc[m].push(((w.byMon || {})[m] || 0) / total * present.length); }
}
const monRows = Object.entries(mons).filter(([, v]) => v.turns > 0).map(([m, v]) => ({ m, ...v, perTurn: v.dmg / v.turns, rel: avg(shareAcc[m] || [0]), waves: (shareAcc[m] || []).length })).sort((a, b) => b.rel - a.rel);
const totalDmg = sum(monRows.map((x) => x.dmg)) || 1;
out('## モンスターごとの貢献(与えたダメージ)');
out();
out('ダメージは、そのターンに敵のライフが減った分を、置いたカードの見込みダメージの割合で子ごとに分けたもの。');
out();
out('「頭割り比」は、WAVE ごとに「その子が出したダメージの割合 ÷ 頭割り(1 ÷ 立っていた子の数)」を出して平均したもの。1.0 で人並み、2.0 なら2人分。');
out();
out('| モンスター | 出ていたWAVE | 出ていたターン | 与えたダメージ(合計) | 全体に占める割合 | 頭割り比 |');
out('| --- | --- | --- | --- | --- | --- |');
for (const x of monRows) out(`| ${x.m} | ${x.waves} | ${x.turns} | ${Math.round(x.dmg).toLocaleString()} | ${pct(x.dmg / totalDmg)} | ${r1(x.rel)} |`);
out();

// ---- EX ----
const exAll = runs.flatMap((r) => (r.ex || []).map((e) => ({ ...e, run: r })));
const turnDmgOf = (r, wave) => { const w = r.waves.find((x) => x.wave === wave); return w && w.turns ? w.dealt / w.turns : 0; };
const exBy = {};
for (const e of exAll) {
  const k = `${e.mon}「${e.ex}」`;
  exBy[k] = exBy[k] || { n: 0, ratio: [], why: {} };
  exBy[k].n += 1;
  const base = turnDmgOf(e.run, e.wave);
  // 使ったターンから3ターンの平均(古い記録は使ったターンだけ)を、そのWAVEの1ターン平均と比べる
  const per = e.turnsCounted ? e.dealtSum / e.turnsCounted : e.dealt;
  if (base > 0 && per != null) exBy[k].ratio.push(per / base);
  exBy[k].why[e.why] = (exBy[k].why[e.why] || 0) + 1;
}
out('## EX スキル');
out();
if (!exAll.length) out('使った EX は無かった。');
else {
  out('| EX | 使った回数 | 使ってから3ターンの平均ダメージ ÷ そのWAVEの1ターン平均 | 使った理由 |');
  out('| --- | --- | --- | --- |');
  for (const [k, v] of Object.entries(exBy).sort((a, b) => b[1].n - a[1].n)) out(`| ${k} | ${v.n} | ${v.ratio.length ? `×${r1(avg(v.ratio))}` : '-'} | ${Object.entries(v.why).map(([w, n]) => `${w}(${n})`).join('・')} |`);
}
out();

// ---- 編成・アシストカードごと(2026-10-09 社長「どのモンスターを使ったとか、どのアシカを使ったとか…覚えてもらわないと」) ----
// 覚え書き(tactics-knowledge.json)にある過去の回も合わせて数える(--no-knowledge で今回の記録だけ)
const KN = path.join(__dirname, 'tactics-knowledge.json');
let pastRuns = [];
if (!args.includes('--no-knowledge') && fs.existsSync(KN)) { try { pastRuns = JSON.parse(fs.readFileSync(KN, 'utf8')).runs || []; } catch (e) { pastRuns = []; } }
const fromLogs = runs.map((r) => ({ difficulty: r.meta.difficulty, hero: r.build && r.build.hero, pool: (r.build && r.build.pool) || [], allies: ((r.build && r.build.allies) || []).map((a) => a.name),
  assists: ((r.build && r.build.assists) || []).map((a) => `${a.card}${a.upgrade ? '+' : ''}`), result: r.result, wave: r.waves.length, turns: sum(r.waves.map((w) => w.turns)), downs: sum(r.waves.map((w) => w.downs)), at: r.meta.startedAt }));
// 同じ回が両方にあるときは記録のほうを使う(覚え書きは開始時刻を分単位で持つ)
const seenAt = new Set(fromLogs.map((r) => String(r.at || '').slice(0, 16)));
const all = [...pastRuns.filter((r) => !seenAt.has(String(r.at || '').slice(0, 16))), ...fromLogs].filter((r) => r.hero || (r.pool || []).length);
const table = (title, keyOf) => {
  const g = {};
  for (const r of all) for (const k of new Set(keyOf(r).filter(Boolean))) { g[k] = g[k] || []; g[k].push(r); }
  const rows = Object.entries(g).map(([k, rs]) => ({ k, n: rs.length, clear: rs.filter((r) => r.result === 'clear').length, wave: avg(rs.map((r) => r.wave || 0)), turns: avg(rs.map((r) => r.turns || 0)), downs: avg(rs.map((r) => r.downs || 0)), diffs: [...new Set(rs.map((r) => r.difficulty))].join('/') }))
    .sort((a, z) => z.clear / z.n - a.clear / a.n || z.wave - a.wave);
  out(`### ${title}`);
  out();
  out('| | 回数 | クリア | 着いたWAVE(平均) | ターン(平均) | 倒れた(平均) | 難易度 |');
  out('| --- | --- | --- | --- | --- | --- | --- |');
  for (const x of rows) out(`| ${x.k} | ${x.n} | ${x.clear}/${x.n}(${pct(x.clear / x.n)}) | ${r1(x.wave)} | ${r1(x.turns)} | ${r1(x.downs)} | ${x.diffs} |`);
  out();
  return rows;
};
out(`## 編成・アシストカードごとの成績(覚え書きと合わせて ${all.length}回)`);
out();
if (all.length) {
  table('勇者モンごと', (r) => [r.hero]);
  table('供モンの候補(5体)に入れた子ごと', (r) => r.pool || []);
  table('実際に加わった供モンごと', (r) => r.allies || []);
  table('アシストカードごと(+ は強化)', (r) => r.assists || []);
  table('編成(勇者モン + 候補)ごと', (r) => [`${r.hero || '?'} + ${[...(r.pool || [])].sort().join('・')}`]);
} else out('編成の記録がまだ無い。');
out();

// ---- 提案 ----
const props = [];
// 変え幅は1回あたり3割まで(大きく動かすと、ほかとの釣り合いが一度に崩れる。様子を見て2回目を足す)
const step = (x) => pct(Math.min(0.3, Math.max(0.05, x)));
const medTurns = median(waveRows.map((w) => w.turns));
for (const w of waveRows) {
  if (w.turns >= Math.max(6, medTurns * 1.8)) props.push(`WAVE ${w.wave}「${w.enemy}」が長引く(平均${r1(w.turns)}ターン・ほかのWAVEの中央値${r1(medTurns)})。敵のライフをまず ${step(1 - medTurns * 1.4 / w.turns)} 下げる案(TACTICS_ENEMY_DATA の hp)`);
  if (w.downs >= 1 || w.takenRatio >= 0.6) props.push(`WAVE ${w.wave}「${w.enemy}」で削られすぎる(倒れた平均${r1(w.downs)}・受けたダメージ ${pct(w.takenRatio)})。この敵の技の倍率か、ちからを 1割ほど下げる案`);
  if (w.lost > 0) props.push(`WAVE ${w.wave}「${w.enemy}」で ${w.lost}/${w.n}回 負けた。上の2つのどちらが効いているかを先に見る`);
  if (w.wave >= 5 && w.turns <= 1.5 && w.takenRatio < 0.1) props.push(`WAVE ${w.wave}「${w.enemy}」が手応えなく終わる(平均${r1(w.turns)}ターン・受けたダメージ ${pct(w.takenRatio)})。後半の敵としては弱い。ライフを上げるか、難易度で増える技を早めに持たせる案`);
}
if (monRows.length >= 3) {
  for (const x of monRows) {
    if (x.waves < 3) continue;
    if (x.rel >= 2) props.push(`${x.m} の火力が高い(頭割り比 ${r1(x.rel)}・${x.waves}WAVE分)。固有技の倍率(baseMult)をまず ${step(1 - 1.5 / x.rel)} 下げて、もう一度回して比べる案`);
    if (x.rel <= 0.4) props.push(`${x.m} の火力が低い(頭割り比 ${r1(x.rel)}・${x.waves}WAVE分)。固有技の倍率をまず ${step(0.8 / Math.max(0.1, x.rel) - 1)} 上げるか、得意な距離の補正を見直す案(守り役なら、この数字は低くてよい)`);
  }
}
for (const [k, v] of Object.entries(exBy)) {
  if (v.ratio.length < 2) continue;
  const m = avg(v.ratio);
  if (m >= 3) props.push(`EX ${k} が強い(使ってから3ターンのダメージがそのWAVEの平均の ${r1(m)}倍)。回数か倍率を少し下げる案`);
  if (m <= 1.05 && Object.keys(v.why).some((w) => /火力/.test(w))) props.push(`EX ${k} は火力の EX なのに、使ってから3ターンのダメージが平均と変わらない(×${r1(m)})。効き目を上げるか、ボットの使いどころを見直す`);
}
const clears = runs.filter((r) => r.result === 'clear');
if (runs.length >= 2 && clears.length === runs.length) {
  const downs = sum(runs.map((r) => sum(r.waves.map((w) => w.downs))));
  if (downs === 0) props.push(`${runs.length}回とも一度も倒れずにクリアした(難易度 ${[...new Set(runs.map((r) => r.meta.difficulty))].join('/')})。この難易度はボットにもやさしすぎる。難易度ごとの power か、総合力による敵の伸び(上限6倍・0.7乗)を見直す案`);
}
out('## 調整の提案(案だけ。数字は変えていない)');
out();
if (!props.length) out('目立って強すぎる・弱すぎるものは見つからなかった。');
for (const p of props) out(`- ${p}`);
out();
out(`記録: ${files.map((f) => path.relative(ROOT, f)).join(', ')}`);

const text = lines.join('\n');
console.log(text);
if (mdFile) { fs.mkdirSync(path.dirname(path.resolve(mdFile)), { recursive: true }); fs.writeFileSync(path.resolve(mdFile), `${text}\n`); console.log(`\n書き出した: ${mdFile}`); }
