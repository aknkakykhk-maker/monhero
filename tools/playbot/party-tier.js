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
const ev = require('./evidence');
const SIM_OPT = { exMode: 'best', assist: 'bot', assistPlay: 'best', training: 'bot', emergency: 'bot' };

// ---------- 子プロセス: 1マス(勇者モン×供モン3体×難易度)を N 回まわして足し合わせる ----------
if (args[0] === '--worker') {
  const sim = require('./sim/battle');
  // 入る順(ゲームと同じくじ): 候補5体 = 指定の3体 + ほか2体。WAVE 2・4・6 のあと、まだ入っていない候補からくじで3体が出て、
  //   その中の指定の子を、並びの前から選ぶ(10-core.jsx pickJoinCandidates 975・PRO_ALLY_OFFER_SIZE 3)
  const joinOrder = (pref, rng) => {
    let left = [...pref, '#1', '#2']; const out = [];
    for (let j = 0; j < 3; j++) {
      const shown = left.map((x) => ({ x, r: rng() })).sort((a, z) => a.r - z.r).slice(0, 3).map((y) => y.x);
      const pick = pref.find((x) => shown.includes(x) && !out.includes(x));
      out.push(pick); left = left.filter((x) => x !== pick);
    }
    return out;
  };
  process.on('message', (t) => {
    if (t === 'end') process.exit(0);
    const acc = { key: t.key, n: 0, sum: 0, sq: 0, clear: 0, boss: 0, uses: 0, scenes: [] };
    for (let i = 0; i < t.runs; i++) {
      // 基準(t.random): 同じ勇者モンで、供モンをふつうに(候補からくじで)選んだとき。sim/battle.js の表と同じ pickAllies
      const allies = t.random ? sim.pickAllies(t.hero, sim.mulberry32(sim.hashSeed(t.seed, 'allies', t.hero, t.diff, i)))
        : joinOrder(t.allies, sim.mulberry32(sim.hashSeed(t.seed, 'join', t.hero, t.allies.join(','), i)));
      const r = sim.simulateRun({ heroId: t.hero, allies, difficulty: t.diff, seed: sim.hashSeed(t.seed, 'party', i), ...SIM_OPT, ...(t.opt || {}), exLog: !!t.card });
      const reach = r.wave + (r.result === 'clear' ? 1 : 0);
      acc.n++; acc.sum += reach; acc.sq += reach * reach;
      if (r.result === 'clear') acc.clear++;
      if (r.wave >= 10) acc.boss++;
      // アシカを測るマスは、そのカードを使った回数と場面(何 WAVE・何ターン目・予告・いちばん細った子のライフ・敵の残り)を少しだけ残す
      if (t.card) {
        const sc = (r.assistScenes || []).filter((x) => x.id === t.card);
        acc.uses += sc.length;
        if (acc.scenes.length < 400) acc.scenes.push(...sc.slice(0, 400 - acc.scenes.length).map((x) => [x.wave, x.turn, x.threat, x.hp, x.enemyHp]));
      }
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
    console.error(`${{ scan: 'パーティの候補', verify: 'パーティの測り直し', detail: 'アシカ・強化の比べ', heroBase: '勇者ごとの基準' }[name] || name}: ${tasks.length} マス(残してあった ${tasks.length - todo.length} マスは飛ばす)・並列 ${JOBS}`);
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
  // 4・5: 難易度ごとに上位 --detail-top 組を決めて、アシカの優先(10 枚それぞれ)と強化の選び方を比べる(各 --detail-runs 回・同じ seed)
  const DTOP = Number(argOf('--detail-top', '3'));
  const DRUNS = Number(argOf('--detail-runs', '300'));
  const dt = [];
  for (const d of DIFFS) {
    for (const k of topParties(cache, d).slice(0, DTOP).map((x) => x.k)) {
      const [hero, al] = k.split('|'); const allies = al.split(',');
      const base = { hero, allies, diff: d, runs: DRUNS, seed: SEED + 2000 };
      const kd = `${k}|${d}`;
      dt.push({ ...base, key: `${kd}|base` });
      for (const id of sim.TEACH_IDS) dt.push({ ...base, key: `${kd}|card:${id}`, card: id, opt: { assist: id } });
      for (const tr of TRAININGS) if (tr !== 'bot') dt.push({ ...base, key: `${kd}|train:${tr}`, opt: { training: tr } });
      for (const up of UNIQUES) if (up !== 'bot') dt.push({ ...base, key: `${kd}|unique:${up}`, opt: { uniquePlan: up } });
    }
  }
  await go('detail', { runs: DRUNS, seed: SEED + 2000, simVer: SIM_VER, top: DTOP }, dt);
  // 6: 基準。上位に出た勇者モンごとに、供モンをふつうに(くじで)選んだときを同じ回数回す(根拠の「何と比べて」)
  const bt = [];
  for (const d of DIFFS) {
    for (const hero of [...new Set(topParties(cache, d).slice(0, 5).map((x) => x.k.split('|')[0]))]) bt.push({ key: `${hero}|base|${d}`, hero, allies: [], random: true, diff: d, runs: VRUNS, seed: SEED + 3000 });
  }
  await go('heroBase', { runs: VRUNS, seed: SEED + 3000, simVer: SIM_VER }, bt);
}
const TRAININGS = ['bot', 'hpdef', 'atkhp', 'atk2', 'role'];
const TRAINING_JA = { bot: '丸太うけ+走り込み(ガッツの少ない子は丸太うけ+猛勉強。いまのボット)', hpdef: '丸太うけ+走り込み(全員)', atkhp: 'ドミノ倒し+走り込み', atk2: 'ドミノ倒し×2', role: 'ダメージ役はドミノ倒し+走り込み・ほかは丸太うけ+走り込み' };
const UNIQUES = ['bot', 'hero', 'even'];
const UNIQUE_JA = { bot: 'それまでいちばんダメージを出した子へ', hero: '勇者モンへ', even: '段のいちばん低い子へ順に(均等)' };
// 難易度ごとの上位(測り直した数字で並べる。測り直しが無ければ1回目)
function topParties(cache, d) {
  const V = (cache.verify && cache.verify.cells) || {};
  const src = Object.keys(V).some((k) => k.endsWith(`|${d}`)) ? V : (cache.scan ? cache.scan.cells : {});
  return Object.entries(src).filter(([k]) => k.endsWith(`|${d}`)).map(([k, c]) => ({ k: k.replace(new RegExp(`\\|${d}$`), ''), c, s: scoreOf(c, d), e: scoreSe(c, d), first: cache.scan.cells[k] }))
    .filter((x) => Number.isFinite(x.s)).sort((p, q) => q.s - p.s);
}

// その回に実際に戦った供モンの名前。r.allies(選んだつもりの供モン)は 2026-10-10 まで供モン選びの不具合で実際と違う回があった(209回中57回)。
// tactics-tier.js membersOf と同じ順: 盤面から読んだ r.alliesSeen → dmg・use の名前(盤面から読むので正しい)→ r.allies
const alliesOf = (r) => {
  const seen = Array.isArray(r.alliesSeen) ? r.alliesSeen : null;
  const board = [...Object.keys(r.dmg || {}), ...Object.keys(r.use || {})];
  return [...new Set(seen || (board.length ? board : (r.allies || [])))].filter((n) => n && n !== r.hero);
};

function writeAll(cache) {
  const L = []; const o = (t = '') => L.push(t);
  const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—');
  const sgn = (x, f = 2) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(f)}` : '—');
  const fmt = (c, d) => (d === 'Hard' ? `クリア ${pct(rate(c, 'clear'))}(ボス戦まで ${pct(rate(c, 'boss'))})` : `平均 WAVE ${mean(c).toFixed(2)}(クリア ${pct(rate(c, 'clear'))})`);
  const POINT = { Hard: 'クリア率', Expert: '平均 WAVE', Master: '平均 WAVE' };
  // tier.json の「モンスター」から、暫定・回数不足の子
  const jf = path.join(OUT_DIR, 'tier.json');
  const j = JSON.parse(fs.readFileSync(jf, 'utf8'));
  const provisional = new Set((j.モンスター || []).filter((m) => m.暫定 || !m.総合).map((m) => m.名前));
  // 実戦(ボットがブラウザで戦った回)で同じ4体がそろった回
  let realRuns = [];
  try { realRuns = JSON.parse(fs.readFileSync(path.join(__dirname, 'tactics-knowledge.json'), 'utf8')).runs || []; } catch (e) { realRuns = []; }
  const realOf = (h, al, d) => {
    const want = al.map((x) => NAME[x]).sort().join(',');
    const rs = realRuns.filter((r) => r.mode === 'tacticsPro' && r.difficulty === d && r.hero === NAME[h] && alliesOf(r).slice().sort().join(',') === want && ['clear', 'wipe', 'timeout'].includes(r.result));
    return rs.length ? { 回数: rs.length, クリア: rs.filter((r) => r.result === 'clear').length } : null;
  };
  // なぜ噛み合うか(機械が書く1〜2行): 得意な枠の分かれ方と EX の役
  const EX_ROLE = { coverAll: '守り', partyGuard: '守り', damageBack: '守り', lifeSpring: '支え', cookieBox: '支え', partyBoost: '支え', multiBuff: '支え', present: '支え', timeStop: '支え' };
  const roleOf = (id) => { const ex = sim.G.tacticsExDefOf(id); return EX_ROLE[ex && ex.effect] || '攻め'; };
  const DIST_JA = ['零', '近', '中', '遠'];
  const bestSlot = (id) => { const m = MONS.find((x) => x.id === id); return [0, 1, 2, 3].sort((a, b) => (sim.G.DIST_APTITUDE_MULT[(m.distAptitude || [])[b]] ?? 1) - (sim.G.DIST_APTITUDE_MULT[(m.distAptitude || [])[a]] ?? 1) || a - b)[0]; };
  const reasonOf = (h, al) => {
    const ids = [h, ...al];
    const slots = ids.map(bestSlot);
    const roles = ids.map(roleOf);
    const cnt = (r) => roles.filter((x) => x === r).length;
    const bits = [];
    const uniq = new Set(slots).size;
    bits.push(uniq === 4 ? `得意な枠が4体とも分かれる(${ids.map((x, i) => `${NAME[x]} ${DIST_JA[slots[i]]}`).join('・')})ので、全員が得意な間合いに立てる` : `得意な枠は ${ids.map((x, i) => `${NAME[x]} ${DIST_JA[slots[i]]}`).join('・')}(重なる子は空いた枠から撃つ)`);
    bits.push(`EX の役は 攻め ${cnt('攻め')}・守り ${cnt('守り')}・支え ${cnt('支え')}`);
    return bits.join('。');
  };
  const D = (cache.detail && cache.detail.cells) || {};
  const detailOf = (k, d) => {
    const kd = `${k}|${d}`; const base = D[`${kd}|base`];
    if (!base) return null;
    const diffOf = (c) => ({ v: scoreOf(c, d) - scoreOf(base, d), e: Math.hypot(scoreSe(c, d), scoreSe(base, d)) });
    const cards = sim.TEACH_IDS.map((id) => ({ id, c: D[`${kd}|card:${id}`] })).filter((x) => x.c).map((x) => ({ ...x, ...diffOf(x.c) })).sort((p, q) => q.v - p.v);
    const firm = cards.filter((x) => x.v > 2 * x.e);
    const scenes = (x) => {
      const sc = x.c.scenes || []; if (!sc.length) return '';
      const band = (t) => (t <= 2 ? '1〜2' : t <= 5 ? '3〜5' : t <= 10 ? '6〜10' : '11〜');
      const top = (f) => { const m = {}; sc.forEach((y) => { const k2 = f(y); m[k2] = (m[k2] || 0) + 1; }); return Object.entries(m).sort((p, q) => q[1] - p[1])[0]; };
      const [tb, tn] = top((y) => band(y[1]));
      const THREAT_JA = { single: '単体', multi: '連続', big: '大技', all: '全体', pierce: '貫通', charge: 'ため', pierceCharge: '貫通のため', none: '攻撃なし' };
      const [th, thn] = top((y) => y[2]);
      const hp = sc.reduce((a, y) => a + y[3], 0) / sc.length;
      // 読み方: 上手な使い方がそのカードを置いたターンを数えた。ライフは「そのターンの、味方でいちばんライフの少ない子のライフの割合」の平均
      return `${sim.TEACH_BY_ID[x.id].baseName}: 1ランに ${(x.c.uses / x.c.n).toFixed(1)} 回置く。置いたターンの ${pct(tn / sc.length)} が WAVE の ${tb} ターン目で、そのときの敵の予告は ${THREAT_JA[th] || th}がいちばん多い(${pct(thn / sc.length)})。置いたターンの、味方でいちばんライフの少ない子のライフは平均 ${pct(hp)}${hp >= 0.8 ? '(みんな元気なうちに置いている)' : hp < 0.5 ? '(細った子がいるときに置いている)' : ''}`;
    };
    const pickBest = (keys, names, botName) => {
      const xs = keys.map((kk) => ({ kk, c: D[`${kd}|${kk}`] })).filter((x) => x.c).map((x) => ({ ...x, ...diffOf(x.c) })).sort((p, q) => q.v - p.v);
      const b = xs[0];
      const e = Math.max(...xs.map((y) => y.e).filter(Number.isFinite));
      const width = d === 'Hard' ? `クリア率 ${ev.pm(2 * e * 100, 0)} 点` : `${ev.pm(2 * e)} WAVE`;
      // 勧めるのは、表に出すぶれ(比べた中でいちばん大きい標準誤差の2倍)より差が大きいときだけ(線と表示をそろえる)
      return b && b.v > 2 * e ? { text: `${names[b.kk.split(':')[1]]}にする(いまのボットの選び方より ${d === 'Hard' ? `クリア率 ${sgn(b.v * 100, 0)} 点` : `${sgn(b.v)} WAVE`}。${cache.detail.runs} 回のぶれは ${width})`, all: xs, firm: true, width }
        : { text: `どれを選んでも差はぶれの中(${cache.detail.runs} 回で ${width})。いまのボットの選び方(${botName})でよい`, all: xs, firm: false, width };
    };
    return {
      base, cards, firm,
      優先: firm.map((x) => sim.TEACH_BY_ID[x.id].baseName),
      使いどころ: firm.slice(0, 3).map(scenes).filter(Boolean),
      train: ((botName) => pickBest(TRAININGS.filter((x) => x !== 'bot').map((x) => `train:${x}`), TRAINING_JA, botName))('丸太うけ+走り込み。ガッツの少ない子は丸太うけ+猛勉強'),
      unique: ((botName) => pickBest(UNIQUES.filter((x) => x !== 'bot').map((x) => `unique:${x}`), UNIQUE_JA, botName))('それまでいちばんダメージを出した子の固有技へ'),
    };
  };
  // パーティの根拠(2026-10-10 社長「タップしたら詳細・ちゃんと根拠がある」)
  const realCount = Object.fromEntries((j.モンスター || []).map((m) => [m.名前, Object.values(m.回数 || {}).reduce((a, b) => a + (Number(b) || 0), 0)]));
  const partyEvidence = (x, d, base, nAll, det) => {
    const [h, al] = x.k.split('|'); const allies = al.split(',');
    const hb = cache.heroBase && cache.heroBase.cells[`${h}|base|${d}`];
    const isHard = d === 'Hard';
    const val = (c) => (isHard ? `${pct(rate(c, 'clear'))}(${c.n} 回中 ${c.clear} 回クリア)` : `${mean(c).toFixed(2)} WAVE(${c.n} 回中 ${c.clear} 回クリア)`);
    const dv = (a, b) => (isHard ? `${sgn((a - b) * 100, 0)} 点` : `${sgn(a - b)} WAVE`);
    const w = (e) => (isHard ? `${ev.pm(2 * e * 100, 0)} 点` : `${ev.pm(2 * e)} WAVE`);
    const nums = [];
    if (hb) nums.push({ 名前: POINT[d], 値: val(x.c), 基準: `同じ勇者モン(${NAME[h]})で、供モンをふつうに(候補からくじで)選んだとき ${val(hb)}`, 差: dv(x.s, scoreOf(hb, d)), ぶれ: w(Math.hypot(x.e, scoreSe(hb, d))) });
    nums.push({ 名前: POINT[d], 値: val(x.c), 基準: `候補の全パーティ ${nAll} 組(勇者ごとに組み合わせの上位6体から3体)の平均 ${isHard ? pct(base) : `${base.toFixed(2)} WAVE`}`, 差: dv(x.s, base), ぶれ: w(x.e) });
    const prov = [h, ...allies].map((id) => NAME[id]).filter((n) => provisional.has(n));
    const rr = realOf(h, allies, d);
    const unknown = [
      prov.length ? `シミュレーターでは上位。${prov.map((n) => `${n}(実戦 ${realCount[n] || 0} 回)`).join('・')}は実戦の回数が少ないので、確かめ中` : '',
      rr ? '' : 'この4体がそろった実戦はまだ無い',
    ].filter(Boolean).join('。');
    const cards = det && det.優先.length ? `アシカは ${det.優先.join(' → ')} を優先して取る` : 'アシカはどれを優先しても差はぶれの中';
    const mechs = ['供モン選び', '供モンの加入', '間合い適性', 'WAVE 報酬の間合いボーナス', 'EX(26体・23種)', '固有技の効果(26体)', ...[h, ...allies].map((id) => ev.traitOf(NAME[id])),
      ...(det && det.優先.length ? ['アシカの習得・強化'] : []), ...(det ? det.firm.map((c) => ({ oryo: 'アシカ(火力)', myaru: 'アシカ(火力)', kiki: 'アシカ(火力)', atsu: 'アシカ(守り・止める)', dra: 'アシカ(守り・止める)' }[c.id] || 'アシカ(回復・上限)')) : [])];
    return ev.evidence({
      count: `候補 ${cache.scan.runs[d]} 回 → 上位 ${cache.verify.runs} 回(別の種で測り直し)・アシカと強化の比べ 各 ${cache.detail ? cache.detail.runs : '—'} 回・基準 ${cache.heroBase ? cache.heroBase.runs : '—'} 回・実戦 ${rr ? rr.回数 : 0} 回`,
      nums, mechs,
      therefore: `候補の5体に ${allies.map((a) => NAME[a]).join('・')} を入れ、WAVE のあとに出た3体からこの並びの前の子を選ぶ。${cards}`,
      unknown,
    });
  };
  const REWARD = 'WAVE のあとに選べるのはトレーニング・供モン・固有技の強化・アシカだけ(間合いボーナスは与えたダメージから自動で付く)。ほかに選ぶごほうびは無い';
  o('# 4体パーティのおすすめ(タクティクスプロ)');
  o();
  o(`更新: ${jstNow()}(JST)・シミュレーター ${SIM_VER} 版目・候補は勇者ごとに供モン ${cache.scan.top} 体から3体の全組(各 ${cache.scan.runs.Hard}/${cache.scan.runs.Expert}/${cache.scan.runs.Master} 回)・上位は別の種で各 ${cache.verify ? cache.verify.runs : '—'} 回測り直し`);
  o();
  o('研究所(シミュレーター: ダイスくん)。勇者モン1体と、WAVE 2・4・6 のあとに入る供モン3体の4体パーティ。案だけで、ゲームの数字は変えていません。');
  o();
  o('**組み方**: 始める前に供モンの候補を5体選び、WAVE 2・4・6 のあとに、まだ入っていない候補からくじで3体が出て1体を選ぶ。候補の5体に下の3体を入れ、出た3体のうち下の並びの前の子から選ぶ。5体中3体が出るので、指定の3体が1体も出ないことは無く、いつでもこの4体がそろう。**候補の残り2体は誰でもよい**(強さに効かない)。入る順はくじしだいで、シミュレーターも同じくじで測った。');
  o();
  o('**並べ方**: Hard はクリア率、Expert・Master は届いた WAVE(クリアは 11 と数える)。測り直した数字で並べた。「ぶれの中で並ぶ順位」は、くじのぶれ(標準誤差の2倍)の中の差を同じ順位にしたもの(同じ数字の組は、どれを選んでも同じくらい)。「確か」= 測り直しても、候補の全パーティの平均(基準)よりぶれ以上に上(そうでなければ「ぶれの中」)。EX とアシカの使い方は上手な使い方、アシカの選び方・トレーニングはボットと同じ、緊急回復は直したボットと同じ条件。暫定・回数不足の子(Tier 表で回数が足りない子)が入るパーティには、そう書いた。');
  const out = [];
  for (const d of DIFFS) {
    const rows = topParties(cache, d);
    const scanAll = Object.entries(cache.scan.cells).filter(([k]) => k.endsWith(`|${d}`)).map(([, c]) => scoreOf(c, d)).filter(Number.isFinite);
    const base = scanAll.reduce((a, b) => a + b, 0) / Math.max(1, scanAll.length);
    o();
    o(`## ${d}`);
    o();
    o(`基準(候補の全パーティ ${scanAll.length} 組の平均): ${d === 'Hard' ? `クリア率 ${pct(base)}` : `平均 WAVE ${base.toFixed(2)}`}`);
    o();
    if (!rows.length) { o('- まだ回していません'); continue; }
    // ★tier-page.js --check が読む表: | 順位 | 勇者 | 供モン | 点 | 確か |(順位は tier.json と同じ通し番号・確か は「確か」か「ぶれの中」)
    o('| 順位 | 勇者 | 供モン | 点 | 確か | ぶれの中で並ぶ順位 | 暫定を含む | 1回目 |');
    o('| --- | --- | --- | --- | --- | --- | --- | --- |');
    let rank = 1;
    rows.forEach((x, i) => {
      if (i > 0 && rows[i - 1].s - x.s > 2 * Math.hypot(rows[i - 1].e, x.e)) rank = i + 1;
      const [h, al] = x.k.split('|'); const allies = al.split(',');
      const firm = x.s - base > 2 * x.e;
      const prov = [h, ...allies].map((id) => NAME[id]).filter((n) => provisional.has(n));
      o(`| ${i + 1} | ${NAME[h]} | ${allies.map((a) => NAME[a]).join('・')} | ${fmt(x.c, d)} | ${firm ? '確か' : 'ぶれの中'} | ${rank} | ${prov.length ? prov.join('・') : '—'} | ${fmt(x.first, d)} |`);
      if (i < 5) {
        const det = detailOf(x.k, d);
        out.push({
          難易度: d, 順位: i + 1, 勇者: NAME[h], 供モン: allies.map((a) => NAME[a]),
          点: { 名前: POINT[d], 値: Math.round((d === 'Hard' ? x.s * 100 : x.s) * 100) / 100, 基準との差: Math.round(((x.s - base) * (d === 'Hard' ? 100 : 1)) * 100) / 100 },
          確か: firm, 暫定を含む: prov, 理由: reasonOf(h, allies),
          アシカ: det ? { 優先: det.優先, 使いどころ: det.使いどころ.length ? det.使いどころ : ['どのカードを優先しても同じくらい(ボットの選び方のままでよい)'] } : { 優先: [], 使いどころ: [] },
          強化: det ? { トレーニング: det.train.text, 固有技の強化: det.unique.text, ごほうび: REWARD } : { トレーニング: '', 固有技の強化: '', ごほうび: REWARD },
          実戦で確認: realOf(h, allies, d),
          根拠: partyEvidence(x, d, base, scanAll.length, det),
        });
      }
    });
    // 上位パーティの詳しい中身
    for (const x of rows.slice(0, 5)) {
      const det = detailOf(x.k, d); if (!det) continue;
      const [h, al] = x.k.split('|'); const allies = al.split(',');
      o();
      o(`### ${NAME[h]} + ${allies.map((a) => NAME[a]).join('・')}(${d})`);
      o();
      o(`- なぜ噛み合うか: ${reasonOf(h, allies)}`);
      o(`- アシカ(そのカードを優先したときの、いまのボットの選び方との差。各 ${cache.detail.runs} 回): ${det.cards.map((c) => `${sim.TEACH_BY_ID[c.id].baseName} ${d === 'Hard' ? sgn(c.v * 100, 0) : sgn(c.v)}`).join('・')}`);
      o(`- 優先するアシカ(ぶれ以上に伸びるものだけ、伸びる順): ${det.優先.length ? det.優先.join(' → ') : 'どれを優先しても同じくらい'}`);
      det.使いどころ.forEach((t) => o(`  - 使いどころ: ${t}`));
      o(`- トレーニング: ${det.train.text}(${det.train.all.map((y) => `${TRAINING_JA[y.kk.split(':')[1]]} ${d === 'Hard' ? sgn(y.v * 100, 0) : sgn(y.v)}`).join('・')})`);
      o(`- 固有技の強化ポイント: ${det.unique.text}(${det.unique.all.map((y) => `${UNIQUE_JA[y.kk.split(':')[1]]} ${d === 'Hard' ? sgn(y.v * 100, 0) : sgn(y.v)}`).join('・')})`);
      const rr = realOf(h, allies, d);
      o(`- 実戦: ${rr ? `${rr.回数} 回・クリア ${rr.クリア} 回` : 'まだ無い'}`);
      ev.evidenceMd(partyEvidence(x, d, base, scanAll.length, det), '').forEach((t) => o(t));
    }
  }
  o();
  o(`ごほうび: ${REWARD}。`);
  o();
  o('Hard の差はクリア率の点(1点 = 1%)、Expert・Master は届いた WAVE。作り直す: `node tools/playbot/party-tier.js`(回さずに作り直すなら `--from-cache`)。tier.json の "おすすめパーティ" だけを書き換える(ほかの項目は触らない)');
  fs.writeFileSync(path.join(OUT_DIR, 'party.md'), `${L.join('\n')}\n`);
  j.おすすめパーティ = out;
  fs.writeFileSync(jf, `${JSON.stringify(j, null, 2)}\n`);
}

(async () => {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { cache = {}; }
  if (!args.includes('--from-cache')) await compute(cache);
  if (!cache.scan) { console.error('キャッシュがありません。--from-cache を外して回してください'); process.exit(1); }
  writeAll(cache);
  console.log('書き出した: docs/playbot/reports/tier/party.md・tier.json(おすすめパーティ)・party-sim.json');
})();
