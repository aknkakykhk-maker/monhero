// 4体パーティ(勇者モン1 + 供モン3)のおすすめを作る。案だけで、ゲームの数字は変えない。式はシミュレーター(sim/battle.js)。
//
//   node tools/playbot/party-tier.js                  回して docs/playbot/reports/tier/party.md を書く(2並列)
//   node tools/playbot/party-tier.js --from-cache     回さずに、前に回した結果(party-sim.json)から作り直す
//   オプション: --jobs 2・--top-allies 6(勇者ごとに候補にする供モンの数)・--runs-hard 60・--runs 60(Expert)・--runs-master 40
//               --verify-top 8・--verify-runs 300・--seed 1
//   ★止まっても続きから: 終わったマスは 25 マスごとに party-sim.json へ残す。同じオプションで出し直すと、残したマスは飛ばす(--fresh で全部回し直す)
//
// ゲームの組み方(2026-10-10 に確かめた):
//   - タクティクスプロは、始める前に供モンの候補を5体選ぶ(60-app.jsx joinCandidatePool 6945 の proAllyPool)
//   - WAVE 2・4・6 のあと、まだ入っていない候補からくじで3体(PRO_ALLY_OFFER_SIZE 3・pickJoinCandidates 10-core.jsx 975)が出て、1体を選ぶ
//   → 5体の中に入れたい3体を入れておけば、毎回の3体に必ず1体は入っている(5体中3体を見せるので、入れたくない2体だけにはならない)。
//     だから「勇者モン+供モン3体」はいつでもそろえられる(入る順番は、ここでは強い順に固定した)
//
// 測り方(A1・A2 と同じ決まり):
//   1. 候補をしぼる: 勇者ごとに、組み合わせ(asika-sim.json の combo。その組の届いた WAVE、Expert 5・Master 3 の重み)の上位 --top-allies 体
//   2. その中の3体の組をすべて(6 体なら 20 組)、難易度ごとに回す。Hard はクリア率、Expert・Master は届いた WAVE(クリアは 11)で並べる
//   3. 難易度ごとに上位 --verify-top 組を、別の乱数の種で各 --verify-runs 回測り直し、その数字で並べる。くじのぶれ(標準誤差の2倍)の中の差には順位を付けない
//   シミュレーターの設定: EX・アシカの使い方は上手(best)、アシカの選び方はボット、トレーニングはボット、緊急回復は直したボットと同じ(bot)
'use strict';
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'playbot', 'reports', 'tier');
const CACHE = path.join(OUT_DIR, 'party-sim.json');
const ASIKA_CACHE = path.join(OUT_DIR, 'asika-sim.json');
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DIFFS = ['Hard', 'Expert', 'Master'];
const SIM_VER = 8; // sim/battle.js の版(asika-tier.js の SIM_VER と同じ意味)
const SIM_OPT = { exMode: 'best', assist: 'bot', assistPlay: 'best', training: 'bot', emergency: 'bot' };

// ---------- 子プロセス: 1マス(勇者モン×供モン3体×難易度)を N 回まわして足し合わせる ----------
if (args[0] === '--worker') {
  const sim = require('./sim/battle');
  process.on('message', (t) => {
    if (t === 'end') process.exit(0);
    const acc = { key: t.key, n: 0, sum: 0, sq: 0, clear: 0, boss: 0 };
    for (let i = 0; i < t.runs; i++) {
      const r = sim.simulateRun({ heroId: t.hero, allies: t.allies, difficulty: t.diff, seed: sim.hashSeed(t.seed, 'party', i), ...SIM_OPT, ...(t.opt || {}) });
      const reach = r.wave + (r.result === 'clear' ? 1 : 0);
      acc.n++; acc.sum += reach; acc.sq += reach * reach;
      if (r.result === 'clear') acc.clear++;
      if (r.wave >= 10) acc.boss++;
    }
    process.send(acc);
  });
  return;
}

function runTasks(tasks, jobs, onSave) {
  return new Promise((resolve) => {
    const out = {}; let next = 0; let done = 0; const t0 = Date.now();
    if (!tasks.length) { resolve(out); return; }
    const workers = Array.from({ length: Math.min(jobs, tasks.length) }, () => fork(__filename, ['--worker']));
    const end = (w) => { if (w.connected) w.send('end'); };
    const feed = (w) => { if (next < tasks.length) w.send(tasks[next++]); else end(w); };
    for (const w of workers) {
      w.on('message', (acc) => {
        out[acc.key] = acc; done++;
        if (done % 25 === 0) onSave(out);
        if (done % 50 === 0 || done === tasks.length) process.stderr.write(`  ${done}/${tasks.length}(${((Date.now() - t0) / 1000).toFixed(0)} 秒)\n`);
        if (done === tasks.length) { onSave(out); workers.forEach(end); resolve(out); } else feed(w);
      });
      feed(w);
    }
  });
}

const sim = require('./sim/battle');
const { MONS } = sim;
const NAME = Object.fromEntries(MONS.map((m) => [m.id, m.name]));
const mean = (c) => (c && c.n ? c.sum / c.n : NaN);
const se = (c) => (c && c.n > 1 ? Math.sqrt(Math.max(0, c.sq / c.n - (c.sum / c.n) ** 2) / c.n) : NaN);
const rate = (c, k) => (c && c.n ? c[k] / c.n : NaN);
const rateSe = (p, n) => (n > 0 ? Math.sqrt(Math.max(0, p * (1 - p)) / n) : NaN);
// 難易度ごとの並べ方: Hard はクリア率、Expert・Master は届いた WAVE
const scoreOf = (c, d) => (d === 'Hard' ? rate(c, 'clear') : mean(c));
const scoreSe = (c, d) => (d === 'Hard' ? rateSe(rate(c, 'clear'), c ? c.n : 0) : se(c));
function jstNow() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' '); }

// 候補の供モン: 組み合わせのキャッシュ(asika-sim.json の combo)から、その勇者と組んだときの届いた WAVE の上位
function allyCandidates(heroId, topN) {
  const a = JSON.parse(fs.readFileSync(ASIKA_CACHE, 'utf8'));
  const cells = (a.combo && a.combo.cells) || {};
  return MONS.filter((m) => m.id !== heroId).map((m) => {
    const e = mean(cells[`${heroId}|${m.id}|Expert`]); const ms = mean(cells[`${heroId}|${m.id}|Master`]);
    return { id: m.id, v: Number.isFinite(ms) ? (e * 5 + ms * 3) / 8 : e };
  }).filter((x) => Number.isFinite(x.v)).sort((p, q) => q.v - p.v).slice(0, topN).map((x) => x.id);
}
const triples = (ids) => { const out = []; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (let k = j + 1; k < ids.length; k++) out.push([ids[i], ids[j], ids[k]]); return out; };

async function compute(cache) {
  const JOBS = Number(argOf('--jobs', '2'));
  const TOP = Number(argOf('--top-allies', '6'));
  const RUNS = { Hard: Number(argOf('--runs-hard', '60')), Expert: Number(argOf('--runs', '60')), Master: Number(argOf('--runs-master', '40')) };
  const VTOP = Number(argOf('--verify-top', '8'));
  const VRUNS = Number(argOf('--verify-runs', '300'));
  const SEED = Number(argOf('--seed', '1'));
  const fresh = args.includes('--fresh');
  const save = () => { const tmp = `${CACHE}.tmp`; fs.writeFileSync(tmp, JSON.stringify(cache)); fs.renameSync(tmp, CACHE); };
  const go = async (name, meta, tasks) => {
    const sec = cache[name];
    const kept = !fresh && sec && JSON.stringify(sec.runs) === JSON.stringify(meta.runs) && sec.seed === meta.seed && sec.simVer === meta.simVer ? sec.cells || {} : {};
    const todo = tasks.filter((t) => !kept[t.key]);
    cache[name] = { ...meta, at: jstNow(), cells: kept };
    console.error(`${name === 'scan' ? 'パーティの候補' : 'パーティの測り直し'}: ${tasks.length} マス(残してあった ${tasks.length - todo.length} マスは飛ばす)・並列 ${JOBS}`);
    await runTasks(todo, JOBS, (got) => { Object.assign(cache[name].cells, got); save(); });
    save();
  };
  // 1・2: 勇者ごとに候補をしぼって、3体の組をすべて回す
  const tasks = [];
  const cand = {};
  for (const h of MONS) {
    cand[h.id] = allyCandidates(h.id, TOP);
    for (const tri of triples(cand[h.id])) for (const d of DIFFS) {
      if (RUNS[d] > 0) tasks.push({ key: `${h.id}|${tri.join(',')}|${d}`, hero: h.id, allies: tri, diff: d, runs: RUNS[d], seed: SEED });
    }
  }
  tasks.sort((a, z) => DIFFS.indexOf(a.diff) - DIFFS.indexOf(z.diff)); // 重い Hard から
  await go('scan', { runs: RUNS, seed: SEED, simVer: SIM_VER, top: TOP }, tasks);
  cache.scan.cand = cand; save();
  // 3: 難易度ごとの上位を、別の種で測り直す
  const vt = [];
  for (const d of DIFFS) {
    const rows = Object.entries(cache.scan.cells).filter(([k]) => k.endsWith(`|${d}`)).map(([k, c]) => ({ k, s: scoreOf(c, d) })).filter((x) => Number.isFinite(x.s)).sort((p, q) => q.s - p.s).slice(0, VTOP);
    for (const r of rows) { const [hero, al] = r.k.split('|'); vt.push({ key: r.k, hero, allies: al.split(','), diff: d, runs: VRUNS, seed: SEED + 1000 }); }
  }
  await go('verify', { runs: VRUNS, seed: SEED + 1000, simVer: SIM_VER }, vt);
}

function writeAll(cache) {
  const L = []; const o = (t = '') => L.push(t);
  const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—');
  const fmt = (c, d) => (d === 'Hard' ? `クリア ${pct(rate(c, 'clear'))}(ボス戦まで ${pct(rate(c, 'boss'))}・平均 ${mean(c).toFixed(2)})` : `平均 WAVE ${mean(c).toFixed(2)}(クリア ${pct(rate(c, 'clear'))})`);
  const party = (k) => { const [h, al] = k.split('|'); return `${NAME[h]} + ${al.split(',').map((x) => NAME[x]).join('・')}`; };
  o('# 4体パーティのおすすめ(タクティクスプロ)');
  o();
  o(`更新: ${jstNow()}(JST)・シミュレーター ${SIM_VER} 版目・候補は勇者ごとに供モン ${cache.scan.top} 体から3体の全組(各 ${cache.scan.runs.Hard}/${cache.scan.runs.Expert}/${cache.scan.runs.Master} 回)・上位は別の種で各 ${cache.verify ? cache.verify.runs : '—'} 回測り直し`);
  o();
  o('研究所(シミュレーター: ダイスくん)。勇者モン1体と、WAVE 2・4・6 のあとに入る供モン3体の4体パーティ。案だけで、ゲームの数字は変えていません。');
  o();
  o('**組み方**: 始める前に供モンの候補を5体選び、WAVE 2・4・6 のあとに、まだ入っていない候補からくじで3体が出て1体を選ぶ。5体の中に下の3体を入れておけば、毎回の3体に必ず1体は入るので、いつでもこの4体をそろえられる(入る順番はくじしだい。ここでは左から順に入れて測った)。');
  o();
  o('**並べ方**: Hard はクリア率、Expert・Master は届いた WAVE(クリアは 11 と数える)。測り直した数字で並べ、くじのぶれ(標準誤差の2倍)の中の差には順位を付けず「同じくらい」とした。EX とアシカの使い方は上手な使い方、アシカの選び方・トレーニングはボットと同じ、緊急回復は直したボットと同じ条件。');
  for (const d of DIFFS) {
    const V = (cache.verify && cache.verify.cells) || {};
    const rows = Object.entries(V).filter(([k]) => k.endsWith(`|${d}`)).map(([k, c]) => ({ k, c, s: scoreOf(c, d), e: scoreSe(c, d), first: cache.scan.cells[k] })).sort((p, q) => q.s - p.s);
    o();
    o(`## ${d}`);
    o();
    if (!rows.length) { o('- まだ回していません'); continue; }
    o(`| 順位 | パーティ(勇者 + 供モン) | 測り直し(各 ${cache.verify.runs} 回) | 1回目 |`);
    o('| --- | --- | --- | --- |');
    let rank = 1;
    rows.forEach((x, i) => {
      if (i > 0 && rows[i - 1].s - x.s > 2 * Math.hypot(rows[i - 1].e, x.e)) rank = i + 1; // 前とぶれの外で離れたときだけ順位を下げる
      o(`| ${rank} | ${party(x.k)} | ${fmt(x.c, d)} | ${fmt(x.first, d)} |`);
    });
  }
  o();
  o('作り直す: `node tools/playbot/party-tier.js`(回さずに作り直すなら `--from-cache`)');
  fs.writeFileSync(path.join(OUT_DIR, 'party.md'), `${L.join('\n')}\n`);
}

(async () => {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { cache = {}; }
  if (!args.includes('--from-cache')) await compute(cache);
  if (!cache.scan) { console.error('キャッシュがありません。--from-cache を外して回してください'); process.exit(1); }
  writeAll(cache);
  console.log('書き出した: docs/playbot/reports/tier/party.md・party-sim.json');
})();
