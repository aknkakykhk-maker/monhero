// アシカ(アシストカード)の Tier 表・モンスターごとのおすすめアシカ・勇者モン×供モンの組み合わせを作る。
// 案だけで、ゲームの数字は変えない。式はシミュレーター(sim/battle.js。ゲームのコードから写したもの)を使う。
//
//   node tools/playbot/asika-tier.js                       全部回して md・tier.json を書く(2並列で 1 時間ほど)
//   node tools/playbot/asika-tier.js --from-cache          回さずに、前に回した結果(asika-sim.json)から md・tier.json を作り直す
//   node tools/playbot/asika-tier.js --only asika|combo    片方だけ回す(もう片方はキャッシュのまま)
//   オプション: --runs 100(アシカ 1マスの回数)・--combo-runs 60(Expert)・--combo-master-runs 30・--jobs 2・--seed 1
//   ★止まっても続きから: 終わったマスは 25 マスごとに asika-sim.json へ残す。同じオプションで出し直すと、残したマスは飛ばす(--fresh で全部回し直す)
//
// 書き出すもの:
//   docs/playbot/reports/tier/asika-tier.md   アシカの Tier(社長が iPhone で見る。総合 → 早見表 → ひとこと → 詳しい表)
//   docs/playbot/reports/tier/combo.md        勇者モン×供モンの組み合わせ(よい上位・合わない下位)
//   docs/playbot/reports/tier/tier.json       "アシカ"・"組み合わせ" と、各モンスターの "おすすめアシカ"・"相性のいい供モン"(ほかの項目は触らない)
//   docs/playbot/reports/tier/asika-sim.json  シミュレーターの集計(作り直しに使う)
//
// 測り方(2026-10-10 社長の決まり「スキル込みの総合で見る。ボットが下手で弱く見えるものはそう書く」):
//   - アシカ: 各カードを「そのカードを優先して選ぶ」設定にして、全勇者モン(26体)・供モンは pickAllies・難易度ごとに N 回。
//     カードの使い方は2通り: bot(いまのボット tactics-brain.js decidePick と同じ条件)と best(上手な使い方)。
//     強さは2通りのよいほう。best のほうがはっきり伸びるカードは「ボットの使い方で弱く見えている」と書く。
//     EX は上手な使い方(exMode 'best')で回す(EX の下手さがカードの差に混ざらないように)
//   - 点: そのカードの届いた WAVE(クリアは WAVE 11)− 10 枚の平均。モンスターの Tier と同じく 点 = 差 ÷ 2、
//     S ≥ 0.45 > A ≥ 0.15 > B ≥ −0.15 > C ≥ −0.45 > D。総合は Hard 2・Expert 5・Master 3 の重み
//   - 暫定: 実戦(tactics-knowledge.json)でそのカードを選んだ回が5回以上ある難易度が2つ未満のカード。
//     実戦はボットがほぼ毎回「あつの挑発」を最初に選ぶので偏っている。回数を必ず添える
//   - 組み合わせ: 勇者モンごとに、供モン(最初に入る1体。WAVE 2 のあと)を25通り入れ替え、残り2体はくじ。
//     勇者モンごとの平均との差(届いた WAVE)で並べる
'use strict';
const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'playbot', 'reports', 'tier');
const CACHE = path.join(OUT_DIR, 'asika-sim.json');
const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

const DIFFS = ['Hard', 'Expert', 'Master'];
const W = { Hard: 2, Expert: 5, Master: 3 }; // tactics-tier.js の DIFF_WEIGHT と同じ重み
const PLAYS = ['bot', 'best'];

// ---------- 子プロセス: 1マス(勇者モン×難易度×設定)を N 回まわして足し合わせる ----------
if (args[0] === '--worker') {
  const sim = require('./sim/battle');
  const others = (heroId, allyId, rng) => {
    const pool = sim.MONS.map((m) => m.id).filter((id) => id !== heroId && id !== allyId);
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, 2);
  };
  process.on('message', (task) => {
    if (task === 'end') { process.exit(0); }
    const t = task;
    const acc = { key: t.key, n: 0, sum: 0, sq: 0, clear: 0, uses: 0, usedRuns: 0, allyDmg: 0, allyShare: 0, allyN: 0 };
    for (let i = 0; i < t.runs; i++) {
      let allies;
      // 同じ i なら、どの設定でも同じ供モン・同じ乱数の種(設定の差だけが見えるように)
      // ally '*' は「最初の供モンも 25 体からくじ」(組み合わせの測り直しで、その勇者モンの基準を同じ種で取る)
      const ally = t.ally === '*' ? (() => { const pool = sim.MONS.map((m) => m.id).filter((id) => id !== t.hero); return pool[Math.floor(sim.mulberry32(sim.hashSeed(t.seed, 'first', t.hero, t.diff, i))() * pool.length)]; })() : t.ally;
      if (ally) allies = [ally, ...others(t.hero, ally, sim.mulberry32(sim.hashSeed(t.seed, 'combo', t.hero, t.diff, i)))];
      else allies = sim.pickAllies(t.hero, sim.mulberry32(sim.hashSeed(t.seed, 'allies', t.hero, t.diff, i)));
      const r = sim.simulateRun({ heroId: t.hero, allies, difficulty: t.diff, seed: sim.hashSeed(t.seed, i), exMode: t.exMode, assist: t.assist, assistPlay: t.play, training: t.training || 'none' });
      const reach = r.wave + (r.result === 'clear' ? 1 : 0);
      acc.n++; acc.sum += reach; acc.sq += reach * reach; if (r.result === 'clear') acc.clear++;
      if (t.card) { const u = (r.assistUses || {})[t.card] || 0; acc.uses += u; if (u > 0) acc.usedRuns++; }
      if (t.ally && t.ally !== '*' && r.dmgById && t.ally in r.dmgById) {
        const tot = Object.values(r.dmgById).reduce((a, b) => a + b, 0);
        acc.allyDmg += r.dmgById[t.ally]; acc.allyShare += tot > 0 ? r.dmgById[t.ally] / tot : 0; acc.allyN++;
      }
    }
    process.send(acc);
  });
  return;
}

// 終わったマスは onSave で 25 マスごとにファイルへ残す(コンテナが止まっても、出し直せば続きから回る。2026-10-10)
function runTasks(tasks, jobs, onSave = () => {}) {
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

// ---------- 親: 回す ----------
const sim = require('./sim/battle');
const { MONS, TEACH_IDS, TEACH_BY_ID, G } = sim;
const NAME = Object.fromEntries(MONS.map((m) => [m.id, m.name]));
const ID_BY_NAME = Object.fromEntries(MONS.map((m) => [m.name, m.id]));
const CARD_NAME = (id) => TEACH_BY_ID[id].baseName; // ゲームのカード名(「ニコラオの力」)
const EVO_TO_ID = {};
for (const [id, names] of Object.entries(G.BREEDER_EVO_NAMES)) for (const n of names) EVO_TO_ID[n] = id;

async function compute(cache) {
  const RUNS = Number(argOf('--runs', '100'));
  const CRUNS = Number(argOf('--combo-runs', '60'));
  const CMRUNS = Number(argOf('--combo-master-runs', '30'));
  const JOBS = Number(argOf('--jobs', '2'));
  const SEED = Number(argOf('--seed', '1'));
  const only = argOf('--only', '');
  const fresh = args.includes('--fresh');
  // 残してあるマスのうち、回数と種が同じものは回し直さない(--fresh で全部回し直す)
  const resume = (sec, meta) => (!fresh && sec && JSON.stringify(sec.runs) === JSON.stringify(meta.runs) && sec.seed === meta.seed ? sec.cells || {} : {});
  const save = () => { const tmp = `${CACHE}.tmp`; fs.writeFileSync(tmp, JSON.stringify(cache)); fs.renameSync(tmp, CACHE); };
  const go = async (name, meta, tasks) => {
    const kept = resume(cache[name], meta);
    const todo = tasks.filter((t) => !kept[t.key]);
    cache[name] = { ...meta, at: jstNow(), cells: kept };
    console.error(`${{ asika: 'アシカ', combo: '組み合わせ', verify: '組み合わせの測り直し' }[name]}: ${tasks.length} マス(残してあった ${tasks.length - todo.length} マスは飛ばす)・並列 ${JOBS}`);
    await runTasks(todo, JOBS, (got) => { Object.assign(cache[name].cells, got); save(); });
    save();
  };
  if (only !== 'combo') {
    const tasks = [];
    for (const diff of DIFFS) for (const m of MONS) {
      tasks.push({ key: `none|bot|${m.id}|${diff}`, hero: m.id, diff, assist: 'none', play: 'bot', exMode: 'best', runs: RUNS, seed: SEED });
      for (const play of PLAYS) {
        tasks.push({ key: `bot|${play}|${m.id}|${diff}`, hero: m.id, diff, assist: 'bot', play, exMode: 'best', runs: RUNS, seed: SEED });
        for (const id of TEACH_IDS) tasks.push({ key: `${id}|${play}|${m.id}|${diff}`, hero: m.id, diff, assist: id, card: id, play, exMode: 'best', runs: RUNS, seed: SEED });
      }
    }
    // 重いマス(Hard)から先に配る
    tasks.sort((a, z) => DIFFS.indexOf(a.diff) - DIFFS.indexOf(z.diff));
    await go('asika', { runs: RUNS, seed: SEED }, tasks);
  }
  if (only !== 'asika') {
    const tasks = [];
    for (const [diff, runs] of [['Expert', CRUNS], ['Master', CMRUNS]]) {
      if (!(runs > 0)) continue;
      for (const h of MONS) for (const a of MONS) {
        if (a.id === h.id) continue;
        tasks.push({ key: `${h.id}|${a.id}|${diff}`, hero: h.id, ally: a.id, diff, assist: 'bot', play: 'best', exMode: 'best', runs, seed: SEED });
      }
    }
    await go('combo', { runs: { Expert: CRUNS, Master: CMRUNS }, seed: SEED }, tasks);
  }
  // ★A2(2026-10-10 改善部の指摘): 650 組から上位を拾うと、くじだけで相性 +0.5〜0.6 が出る。
  //   上位の候補(--verify-top 組)を、別の乱数の種で各 --verify-runs 回測り直す。比べる基準(その勇者モンの平均)も、
  //   同じ種で「最初の供モンも 25 体からくじ」(ally '*')を同じ回数回して取り直す
  const VRUNS = Number(argOf('--verify-runs', '300'));
  const VTOP = Number(argOf('--verify-top', '10'));
  const VSEED = Number(argOf('--verify-seed', String(SEED + 1000)));
  if (only !== 'asika' && cache.combo && VRUNS > 0 && VTOP > 0) {
    const rows = analyzeCombo(cache, realRecords()).filter((x) => Number.isFinite(x.pts)).sort((a, z) => z.pts - a.pts).slice(0, VTOP);
    const tasks = [];
    const heroes = [...new Set(rows.map((x) => x.h.id))];
    for (const d of ['Expert', 'Master']) {
      for (const x of rows) tasks.push({ key: `${x.h.id}|${x.a.id}|${d}`, hero: x.h.id, ally: x.a.id, diff: d, assist: 'bot', play: 'best', exMode: 'best', runs: VRUNS, seed: VSEED });
      for (const h of heroes) tasks.push({ key: `${h}|*|${d}`, hero: h, ally: '*', diff: d, assist: 'bot', play: 'best', exMode: 'best', runs: VRUNS, seed: VSEED });
    }
    await go('verify', { runs: VRUNS, seed: VSEED }, tasks);
    cache.verify.pairs = rows.map((x) => `${x.h.id}|${x.a.id}`);
    save();
  }
}

function jstNow() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' '); }
const mean = (c) => (c && c.n ? c.sum / c.n : NaN);
const r1 = (x) => (Number.isFinite(x) ? (Math.round(x * 10) / 10).toFixed(1) : '—');
const r2 = (x) => (Number.isFinite(x) ? (Math.round(x * 100) / 100).toFixed(2) : '—');
const sgn = (x, f = r2) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${f(x)}` : '—');
const tierOfScore = (sc) => (sc >= 0.45 ? 'S' : sc >= 0.15 ? 'A' : sc >= -0.15 ? 'B' : sc >= -0.45 ? 'C' : 'D');
const wavg = (f) => { let a = 0; let w = 0; for (const d of DIFFS) { const v = f(d); if (Number.isFinite(v)) { a += v * W[d]; w += W[d]; } } return w ? a / w : NaN; };

// カードの中身(ゲームの効果を短く。60-app.jsx processTurn・getDynamicDesc から)
const NATURE = {
  oryo: '攻撃 +10〜30%(バトル中ずっと)',
  dra: '被ダメージ −3〜10%(バトル中ずっと)',
  cadmium: 'ガッツ自動回復・ライフ/ガッツ上限アップ',
  mua: '全体のライフ 50〜90% 回復・上限と攻撃アップ',
  atsu: 'そのターンの敵の行動を無効にして、×1.5〜4.5 で殴る',
  myaru: '飲んだ子の次ターン攻撃 ×2〜3・自傷',
  kiki: '2〜4ターン、1体ずつの枚数 +1・全体連撃アップ',
  meloso: 'ライフ・ガッツ 30% 回復と、使った子のガード',
  poltz: '敵の攻撃を受けるたびにガッツ 20% 回復(1〜3回)',
  momosuke: '全体のガッツ 50〜90% 回復・上限と丈夫さアップ',
};
const KIND = { oryo: '火力', myaru: '火力', kiki: '手数', atsu: '止める', dra: '守り', meloso: '回復', mua: '回復', cadmium: 'ガッツ', poltz: 'ガッツ', momosuke: 'ガッツ' };

// ---------- 実戦の記録 ----------
function realRecords() {
  let know = { runs: [] };
  try { know = JSON.parse(fs.readFileSync(path.join(HERE, 'tactics-knowledge.json'), 'utf8')); } catch (e) { /* 無ければ空 */ }
  // tactics-tier.js と同じく、直したボットの回(use がある回)だけ。クリアは WAVE 11
  const runs = (know.runs || []).filter((r) => r && r.result && r.result !== 'stopped' && DIFFS.includes(r.difficulty) && r.use);
  const reach = (r) => (r.wave || 0) + (r.result === 'clear' ? 1 : 0);
  const meanBy = {};
  for (const d of DIFFS) { const rs = runs.filter((r) => r.difficulty === d); meanBy[d] = rs.length ? rs.reduce((a, r) => a + reach(r), 0) / rs.length : NaN; }
  const cardsOf = (r) => [...new Set((r.assists || []).map((x) => EVO_TO_ID[String(x).replace(/\+$/, '')]).filter(Boolean))];
  const byCard = {};
  for (const id of TEACH_IDS) {
    byCard[id] = {};
    for (const d of DIFFS) {
      const rs = runs.filter((r) => r.difficulty === d && cardsOf(r).includes(id));
      byCard[id][d] = { n: rs.length, lift: rs.length ? rs.reduce((a, r) => a + reach(r) - meanBy[d], 0) / rs.length : NaN };
    }
  }
  // 組み合わせ: 勇者×供モンの組がそろった回(供モンが入った回)
  const pair = {};
  for (const r of runs) {
    const h = ID_BY_NAME[r.hero]; if (!h) continue;
    for (const an of new Set(r.allies || [])) {
      const a = ID_BY_NAME[an]; if (!a || a === h) continue;
      const k = `${h}|${a}|${r.difficulty}`;
      (pair[k] = pair[k] || []).push(reach(r) - meanBy[r.difficulty]);
    }
  }
  return { runs, byCard, pair, meanBy };
}

// ---------- アシカの集計 ----------
function analyzeAsika(cache, real) {
  const cells = cache.asika.cells;
  const cell = (cfg, play, hero, d) => cells[`${cfg}|${play}|${hero}|${d}`];
  // そのカード×使い方×難易度の、26体ぶんの平均
  const pooled = (cfg, play, d) => { let s = 0; let n = 0; let cl = 0; let u = 0; let ur = 0; for (const m of MONS) { const c = cell(cfg, play, m.id, d); if (c) { s += c.sum; n += c.n; cl += c.clear; u += c.uses; ur += c.usedRuns; } } return { mean: n ? s / n : NaN, n, clear: n ? cl / n : NaN, uses: n ? u / n : NaN, usedRate: n ? ur / n : NaN }; };
  const base = {};
  for (const play of PLAYS) for (const d of DIFFS) base[`${play}|${d}`] = TEACH_IDS.reduce((a, id) => a + pooled(id, play, d).mean, 0) / TEACH_IDS.length;
  const cards = TEACH_IDS.map((id) => {
    const per = {};
    for (const d of DIFFS) {
      const p = {};
      for (const play of PLAYS) { const q = pooled(id, play, d); p[play] = { ...q, lift: q.mean - base[`${play}|${d}`] }; }
      // ★A3(2026-10-10 改善部の指摘): Tier は上手な使い方(best)1本で決める。2通りのよいほうを取ると、くじのぶれで上へ寄るため。
      //   ボットの数字は「ボットの使い方で弱く見える」欄だけに使う
      const use = 'best';
      per[d] = { ...p, use, lift: p[use].lift, score: p[use].lift / 2, tier: tierOfScore(p[use].lift / 2), n: p.bot.n + p.best.n };
    }
    const score = wavg((d) => per[d].score);
    const botScore = wavg((d) => per[d].bot.lift / 2);
    const bestScore = wavg((d) => per[d].best.lift / 2);
    const realFirm = DIFFS.filter((d) => real.byCard[id][d].n >= 5).length;
    // 勇者モンごとの伸び(そのカード − その勇者モンの 10 枚の平均)。使い方は上手(A3)
    const heroLift = {};
    for (const m of MONS) {
      heroLift[m.id] = wavg((d) => {
        const vals = TEACH_IDS.map((x) => mean(cell(x, 'best', m.id, d)));
        const avgH = vals.reduce((a, b) => a + b, 0) / vals.length;
        return mean(cell(id, 'best', m.id, d)) - avgH;
      });
    }
    return { id, name: CARD_NAME(id), per, score, botScore, bestScore, tier: tierOfScore(score), provisional: realFirm < 2, real: real.byCard[id], heroLift };
  });
  cards.sort((a, z) => z.score - a.score);
  const none = {}; const botPick = {};
  for (const d of DIFFS) { none[d] = pooled('none', 'bot', d); botPick[d] = { bot: pooled('bot', 'bot', d), best: pooled('bot', 'best', d) }; }
  return { cards, base, none, botPick, cell };
}

// ボットの使い方で弱く見えているか: その難易度で、上手に使うと 10 枚の中の差が 0.2 WAVE 以上よくなり、
// しかもボットの使った回数が上手の 6 割未満(ボットが使い渋っている)。どの難易度で起きているかを返す
const botWeakDiffs = (c) => DIFFS.filter((d) => c.per[d].best.lift - c.per[d].bot.lift >= 0.2 && c.per[d].bot.uses < c.per[d].best.uses * 0.6);
const botWeak = (c) => botWeakDiffs(c).length > 0;
const botWeakText = (c) => botWeakDiffs(c).map((d) => `${d} はボット ${sgn(c.per[d].bot.lift, r1)}(${r1(c.per[d].bot.uses)} 回/戦)→ 上手 ${sgn(c.per[d].best.lift, r1)}(${r1(c.per[d].best.uses)} 回/戦)`).join('・');

function cardWords(c) {
  const good = []; const bad = [];
  const tiers = Object.fromEntries(DIFFS.map((d) => [d, c.per[d].tier]));
  const strong = DIFFS.filter((d) => ['S', 'A'].includes(tiers[d]));
  const weak = DIFFS.filter((d) => ['C', 'D'].includes(tiers[d]));
  good.push(NATURE[c.id]);
  if (strong.length) good.push(`${strong.join('・')} で伸びる`);
  if (weak.length) bad.push(`${weak.join('・')} で伸びない`);
  if (c.id === 'myaru') bad.push('自傷があり、飲んだ子の手番も1つ使う。ボットは戦いの中で一度も使わない');
  if (c.id === 'dra' || c.id === 'cadmium') bad.push('効き目が小さく、1体だけの序盤は攻撃1枚と引きかえになる');
  if (c.id === 'kiki') bad.push('1体だけのときは、枚数が増えても2枚目は半分の力');
  if (c.id === 'poltz') bad.push('ガードで受け止めても回数を使う。敵の攻撃を受けないと何も起きない');
  if (c.id === 'atsu') good.push('止めたターンは被ダメ0');
  if (['mua', 'momosuke', 'meloso'].includes(c.id)) good.push('倒れた子にも回復が貯まる');
  if (botWeak(c)) bad.push(`ボットが使い渋っている(${botWeakText(c)})`);
  const reason = (() => {
    const bits = [];
    const best = DIFFS.slice().sort((x, y) => c.per[y].lift - c.per[x].lift)[0];
    if (['S', 'A'].includes(c.tier)) bits.push(`${KIND[c.id]}のカード。優先すると WAVE ${sgn(c.score * 2, r1)}`);
    else if (['C', 'D'].includes(c.tier)) bits.push(`優先すると WAVE ${sgn(c.score * 2, r1)}。ほかのカードを選んだほうが伸びる`);
    else bits.push(`優先しても平均なみ(WAVE ${sgn(c.score * 2, r1)})`);
    if (c.tier !== tiers[best] && ['S', 'A'].includes(tiers[best])) bits.push(`${best} では ${tiers[best]}(WAVE ${sgn(c.per[best].lift, r1)})`);
    if (botWeak(c)) bits.push(['C', 'D'].includes(c.tier) || c.score < 0 ? 'ボットは使い渋るが、上手に使っても弱い' : 'ボットの使い方では弱く見えている');
    if (c.id === 'momosuke') bits.push('ガッツ切れがいちばんの負け筋なので効く');
    if (c.id === 'atsu') bits.push('ボットは必ず最初に選ぶ');
    return bits.join('。');
  })();
  return { good, bad, reason, tiers };
}

// ---------- おすすめアシカ(モンスターごと) ----------
// ★A1(2026-10-10 改善部の指摘): 差 +0.4 WAVE 以上のカードだけを「おすすめ」にする。それ未満はくじのぶれの中なので「どれでも同じくらい」
const RECOMMEND_MIN = 0.4;
function recommendFor(m, A) {
  const list = A.cards.map((c) => ({ c, lift: c.heroLift[m.id] })).filter((x) => Number.isFinite(x.lift)).sort((a, z) => z.lift - a.lift);
  const top = list.filter((x) => x.lift >= RECOMMEND_MIN).slice(0, 3);
  return top.map(({ c, lift }) => {
    let why;
    if (KIND[c.id] === 'ガッツ' && m.baseGuts <= 90) why = `ガッツ上限 ${m.baseGuts} で撃てる回数が少ないのを、ガッツで補える`;
    else if (KIND[c.id] === 'ガッツ') why = '固有技・距離撃のガッツ切れを防げる';
    else if (KIND[c.id] === '回復' && m.baseHp <= 400) why = `ライフ ${m.baseHp} と打たれ弱いのを、回復で支える`;
    else if (KIND[c.id] === '回復') why = '倒れた子を起こせて、長い WAVE を戦い抜ける';
    else if (KIND[c.id] === '火力') why = `ちから ${m.baseAtk} の攻撃をさらに伸ばす`;
    else if (KIND[c.id] === '止める') why = '必殺技のためを止めて、そのまま殴れる';
    else if (KIND[c.id] === '手数') why = '1ターンに使える枚数が増え、固有技を重ねられる';
    else why = '受けるダメージを減らせる';
    return { 名前: c.name, 理由: `${why}(この子が勇者モンのとき WAVE ${sgn(lift, r1)})`, lift };
  });
}

const bestCardFor = (m, A) => A.cards.map((c) => ({ name: c.name, lift: c.heroLift[m.id] })).filter((x) => Number.isFinite(x.lift)).sort((a, z) => z.lift - a.lift)[0] || { name: '—', lift: NaN };

// ---------- 組み合わせ ----------
const EX_ROLE = { coverAll: '守り', partyGuard: '守り', damageBack: '守り', lifeSpring: '支え', cookieBox: '支え', partyBoost: '支え', multiBuff: '支え', present: '支え', timeStop: '支え' };
const roleOf = (m) => { const ex = G.TACTICS_EX_SKILLS && G.TACTICS_EX_SKILLS[m.id]; return EX_ROLE[ex && ex.effect] || '攻め'; };
const bestSlotOf = (m) => [0, 1, 2, 3].sort((a, b) => (G.DIST_APTITUDE_MULT[(m.distAptitude || [])[b]] ?? 1) - (G.DIST_APTITUDE_MULT[(m.distAptitude || [])[a]] ?? 1) || a - b)[0];
const DIST_JA = ['零', '近', '中', '遠'];
function analyzeCombo(cache, real) {
  const cells = cache.combo.cells;
  const rows = [];
  // 供モンごとの「どの勇者でも」の火力の割合(その組でだけ伸びたかを見る)
  const allyShareAvg = {};
  for (const a of MONS) {
    let s = 0; let n = 0;
    for (const h of MONS) { const c = cells[`${h.id}|${a.id}|Expert`]; if (c && c.allyN) { s += c.allyShare; n += c.allyN; } }
    allyShareAvg[a.id] = n ? s / n : NaN;
  }
  for (const h of MONS) {
    const avgOf = (d) => { const xs = MONS.filter((a) => a.id !== h.id).map((a) => mean(cells[`${h.id}|${a.id}|${d}`])).filter(Number.isFinite); return xs.length ? xs.reduce((x, y) => x + y, 0) / xs.length : NaN; };
    const avg = { Expert: avgOf('Expert'), Master: avgOf('Master') };
    for (const a of MONS) {
      if (a.id === h.id) continue;
      const e = cells[`${h.id}|${a.id}|Expert`]; const ms = cells[`${h.id}|${a.id}|Master`];
      const le = mean(e) - avg.Expert; const lm = mean(ms) - avg.Master;
      // 点: Expert 5・Master 3 の重み(Master はほぼ WAVE 2 までに決まるので、供モンの差は小さい)
      const pts = Number.isFinite(lm) ? (le * 5 + lm * 3) / 8 : le;
      const share = e && e.allyN ? e.allyShare / e.allyN : NaN;
      const rp = [...(real.pair[`${h.id}|${a.id}|Expert`] || []), ...(real.pair[`${h.id}|${a.id}|Master`] || []), ...(real.pair[`${h.id}|${a.id}|Hard`] || [])];
      rows.push({ h, a, raw: pts, le, lm, share, shareAvg: allyShareAvg[a.id], realN: rp.length, realLift: rp.length ? rp.reduce((x, y) => x + y, 0) / rp.length : NaN });
    }
  }
  // ★相性 = その組の伸び − その供モンがどの勇者でも出す伸び(供モンとしての強さ)。
  //   引かないと、供モンとして強い子(ゴーストなど)がどの勇者とも「よく合う」に並んでしまう
  const allyMain = {};
  for (const a of MONS) { const xs = rows.filter((x) => x.a.id === a.id && Number.isFinite(x.raw)); allyMain[a.id] = xs.length ? xs.reduce((s0, x) => s0 + x.raw, 0) / xs.length : 0; }
  for (const x of rows) { x.allyMain = allyMain[x.a.id]; x.pts = x.raw - allyMain[x.a.id]; }
  rows.allyMain = allyMain;
  return rows;
}
// 測り直した上位(A2)。相性 = (組 − 基準。Expert 5・Master 3) − 供モンとしての強さ(1回目の 650 組から)
function analyzeVerify(cache, rows) {
  const v = cache.verify;
  if (!v || !Array.isArray(v.pairs)) return null;
  const cell = (k) => v.cells[k];
  const out = [];
  for (const key of v.pairs) {
    const x = rows.find((y) => `${y.h.id}|${y.a.id}` === key);
    if (!x) continue;
    const lift = (d) => mean(cell(`${key}|${d}`)) - mean(cell(`${x.h.id}|*|${d}`));
    const le = lift('Expert'); const lm = lift('Master');
    const raw = Number.isFinite(lm) ? (le * 5 + lm * 3) / 8 : le;
    if (!Number.isFinite(raw)) continue;
    out.push({ ...x, first: x.pts, pts: raw - x.allyMain, vle: le, vlm: lm });
  }
  return out.sort((a, z) => z.pts - a.pts);
}
const VERIFY_FIRM = 0.3; // 測り直しでこれ以上残った組を「確か」とする(1組 300 回で、相性のぶれはおよそ ±0.15)
function comboReason(x, good) {
  const { h, a } = x;
  const bits = [];
  const hs = bestSlotOf(h); const as = bestSlotOf(a);
  const role = roleOf(a); const hrole = roleOf(h);
  if (!good && hs === as) bits.push(`得意な枠(${DIST_JA[as]})が勇者と重なり、供モンが空いた別の枠から撃つ`);
  if (good && hs !== as && /^[SA]$/.test((a.distAptitude || [])[as] || '')) bits.push(`得意な枠が勇者(${DIST_JA[hs]})と供モン(${DIST_JA[as]})で分かれ、どちらも得意な間合いで撃てる`);
  const MOCHI = ['Mocchi', 'Mitarashi'];
  if (good && MOCHI.includes(h.id) && MOCHI.includes(a.id)) bits.push('どちらも「もち肌」(被ダメ −20%)で、2体とも倒れにくい');
  if (good && role === '守り' && h.baseHp <= 400) bits.push(`ライフ ${h.baseHp} の勇者を、守りの EX で支える`);
  else if (good && role === '守り') bits.push('守りの EX で勇者が倒れにくくなる(供モン自身は火力より守りで効く)');
  else if (good && role === '支え' && hrole === '攻め') bits.push('攻めの勇者に、支えの EX が噛み合う');
  else if (good && role === '攻め' && hrole !== '攻め') bits.push(`${hrole}役の勇者に足りない火力を補う`);
  if (!good && role === hrole && role !== '攻め') bits.push(`どちらも${role}役で、火力が足りない`);
  if (!good && role !== '攻め' && hrole !== '攻め' && role !== hrole) bits.push(`${hrole}役の勇者に${role}役の供モンで、火力が足りない`);
  if (!good && h.baseHp <= 400 && a.baseHp <= 400) bits.push(`どちらもライフ 400 以下で打たれ弱い`);
  if (!good && h.baseGuts <= 90 && a.baseGuts <= 90) bits.push('どちらもガッツが少なく、撃ち続けられない');
  if (Number.isFinite(x.share) && Number.isFinite(x.shareAvg) && x.shareAvg > 0) {
    const rel = x.share / x.shareAvg;
    if (good && rel >= 1.1) bits.push(`供モンの火力の割合がいつもの ${rel.toFixed(1)} 倍に伸びる`);
    if (!good && rel <= 0.9) bits.push(`供モンの火力の割合がいつもの ${rel.toFixed(1)} 倍に落ちる`);
    if (!bits.length && good && rel < 0.8) bits.push(`供モンの火力の割合はいつもの ${rel.toFixed(1)} 倍。火力より EX・固有技の支えで勇者「${h.trait || '—'}」が長く戦える`);
    if (!bits.length) bits.push(`供モンの火力の割合はいつもの ${rel.toFixed(1)} 倍。${good ? `勇者特性「${h.trait || '—'}」のもとで、供モンの EX・固有技が生きる` : '供モンは働いているが、この勇者のときだけ先へ進みにくい(回数を足して確かめる)'}`);
  }
  if (!bits.length) bits.push(good ? `勇者特性「${h.trait || '—'}」のもとで、供モンの EX・固有技が生きる` : 'この勇者のときだけ先へ進みにくい(回数を足して確かめる)');
  return bits.slice(0, 2).join('。');
}

// ---------- 書き出し ----------
function writeAll(cache) {
  const real = realRecords();
  const out = {};
  const A = cache.asika ? analyzeAsika(cache, real) : null;
  const C = cache.combo ? analyzeCombo(cache, real) : null;
  const now = jstNow();
  if (A) {
    const L = []; const o = (t = '') => L.push(t);
    o('# アシカ(アシストカード)の Tier(タクティクスプロ)');
    o();
    o(`更新: ${now}(JST)・シミュレーター: 1マス ${cache.asika.runs} 回(26体 × 使い方2通り。トレーニング無しの版)・実戦: ${real.runs.length} 回`);
    o();
    o('研究所(シミュレーター: ダイスくん)。各カードを「そのカードを優先して選ぶ」設定にしてシミュレーターで回し、届いた WAVE の差で決めます。強さはスキル込み(EX・勇者特性・固有技を入れたシミュレーター)。**Tier は上手な使い方の数字だけで決めます**(ボットの数字は「ボットの使い方で弱く見えているカード」にだけ使う)。');
    o();
    o('## 総合 Tier');
    o();
    for (const t of ['S', 'A', 'B', 'C', 'D']) {
      const xs = A.cards.filter((c) => c.tier === t);
      if (xs.length) o(`- **${t}** ${xs.map((c) => `${c.name}${c.provisional ? '(暫定)' : ''}`).join('・')}`);
    }
    o();
    o('暫定 = 実戦でそのカードを選んだ回が5回以上ある難易度が2つ未満(シミュレーターの数字だけで決めたもの)。');
    o();
    o('## 早見表');
    o();
    o('| アシカ | 総合 | Hard | Expert | Master |');
    o('| --- | --- | --- | --- | --- |');
    for (const c of A.cards) o(`| ${c.name} | ${c.tier}${c.provisional ? '*' : ''} | ${c.per.Hard.tier} | ${c.per.Expert.tier} | ${c.per.Master.tier} |`);
    o();
    o('## ひとことの理由');
    o();
    for (const c of A.cards) o(`- **${c.name}**: ${cardWords(c).reason}`);
    o();
    o('## ボットの使い方で弱く見えているカード');
    o();
    const weak = A.cards.filter(botWeak);
    if (!weak.length) o('- ありません');
    o('上手に使うと 10 枚の中の差が 0.2 WAVE 以上よくなり、ボットの使った回数が上手の 6 割未満の難易度があるカード。差は「そのカード − 10 枚の平均」(使い方ごと)。');
    o();
    for (const c of weak) o(`- **${c.name}**(総合 ${c.tier}): ${botWeakText(c)}。${c.score < 0 ? '上手に使っても平均より下なので、カード自体も弱い' : 'ボットの使い方を直せば上がる見込み'}`);
    o();
    o('## 詳しい表(難易度ごと・届いた WAVE の差)');
    o();
    o('差 = そのカードを優先したときの届いた WAVE − 10 枚の平均(クリアは WAVE 11)。「ボット」はいまのボットの使い方、「上手」は上手な使い方。Tier は上手の数字で決める(2通りのよいほうを取ると、くじのぶれで上へ寄るため)。');
    o();
    for (const d of DIFFS) {
      o(`### ${d}(重み ${W[d]})`);
      o();
      o(`10 枚の平均: ボット ${r2(A.base[`bot|${d}`])}・上手 ${r2(A.base[`best|${d}`])} / アシカ無し ${r2(A.none[d].mean)} / いまのボットの選び方 ${r2(A.botPick[d].bot.mean)}(上手に使うと ${r2(A.botPick[d].best.mean)})`);
      o();
      o('| アシカ | Tier | ボット(使った回/戦) | 上手(使った回/戦) | 実戦(回・差) |');
      o('| --- | --- | --- | --- | --- |');
      for (const c of A.cards) {
        const p = c.per[d]; const rr = c.real[d];
        o(`| ${c.name} | ${p.tier} | ${sgn(p.bot.lift)}(${r1(p.bot.uses)}) | ${sgn(p.best.lift)}(${r1(p.best.uses)}) | ${rr.n}回・${rr.n ? sgn(rr.lift, r1) : '—'} |`);
      }
      o();
    }
    o('## 実戦の記録について');
    o();
    o('実戦(ブラウザでボットが戦った回)は、ボットがほぼ毎回「あつの挑発」を最初に選ぶため、カードごとの回数がとても偏っています。差は「そのカードを選んだ回の届いた WAVE − その難易度の平均」で、選んだ回が少ないカードは当てになりません。');
    o('もう1つの偏り: あとの WAVE で選ぶカード(2枚目・3枚目)は、そこまで届いた回にしか出てきません。そのため実戦の差は、ほとんどのカードで大きくプラスに出ます(生き残りの偏り)。いちばん最初に選ばれる「あつの挑発」だけが 0 前後になるのはこのためです。Tier は実戦の差では決めず、シミュレーターで決めています。');
    o();
    o('## 強み・弱み');
    o();
    o('| アシカ | 強み | 弱み |');
    o('| --- | --- | --- |');
    for (const c of A.cards) { const w = cardWords(c); o(`| ${c.name} | ${w.good.join('・')} | ${w.bad.join('・') || '—'} |`); }
    o();
    o('## モンスターごとのおすすめアシカ');
    o();
    o(`その勇者モンのとき、どのカードを優先すると届く WAVE が伸びるか(その子の 10 枚の平均との差。上手な使い方。Hard 2・Expert 5・Master 3 の重み)。差 +${RECOMMEND_MIN} 以上のカードだけを「おすすめ」にした。それより小さいとくじのぶれと見分けられないので「どれでも同じくらい」と書く。`);
    o();
    for (const m of MONS) { const r = recommendFor(m, A); o(`- **${m.name}**: ${r.length ? r.map((x) => `${x.名前}(${sgn(x.lift, r1)})`).join('・') : `どれでも同じくらい(いちばん伸びる ${bestCardFor(m, A).name} でも ${sgn(bestCardFor(m, A).lift, r1)})`}`); }
    o();
    o('## シミュレーターに入れたアシカの効果');
    o();
    o('`tools/playbot/sim/battle.js`(3 版目)。式は 60-app.jsx から写したもの。');
    o();
    for (const id of TEACH_IDS) o(`- **${CARD_NAME(id)}**(${G.BREEDER_EVO_NAMES[id].join(' → ')}): ${NATURE[id]}`);
    o('- 選ぶ流れ: ランの始めに1枚(10 枚から)、WAVE 1・3・5・7・9 のあと(強化できる2枚+持っていないカードで4枚)、供モンが入った WAVE 2・4・6 のあと(MAX でないカードから4枚)。2回目からは強化(Lv.3 まで)');
    o('- 入れられなかったもの・近づけたもの:');
    for (const t of [...sim.APPROX_ASSIST_MISSING, ...sim.APPROX.filter((x) => /アシカ/.test(x))]) o(`  - ${t}`);
    o();
    o('## 上手な使い方(best)の中身');
    o();
    o('- 回復(みゅあ・メロソ・ももすけ): 倒れた子がいる・全体のライフ5割未満・だれかが一撃で倒れる攻撃を予告されたとき。ももすけはガッツ35%未満の子がいるときも');
    o('- ずっと続く強化(きき・ニコラオ・ポルツ): 2体以上そろってから、敵のライフが3割より多いうちに1ターン1枚。ドラ・かどみうむは攻撃が置けないときだけ(ボットと同じ)');
    o('- みゃるの薬: いちばんダメージを出している子に、ライフ6割以上・次のターン撃てるガッツが残るとき・その子が狙われていないときだけ');
    o('- あつの挑発: ためる・貫通の構えのほか、だれかが一撃で倒れそうな攻撃も止める');
    o();
    o('作り直す: `node tools/playbot/asika-tier.js`(回さずに作り直すなら `--from-cache`)');
    fs.writeFileSync(path.join(OUT_DIR, 'asika-tier.md'), L.join('\n') + '\n');
    out.asika = A;
  }
  if (C) {
    const good = C.filter((x) => Number.isFinite(x.pts)).sort((a, z) => z.pts - a.pts);
    const V = analyzeVerify(cache, C);
    const top = V || good.slice(0, 20); const bottom = good.slice(-10).reverse();
    const confirmed = (x, isGood) => x.realN >= 2 && Number.isFinite(x.realLift) && (isGood ? x.realLift > 0 : x.realLift < 0);
    const L = []; const o = (t = '') => L.push(t);
    o('# 勇者モン × 供モンの組み合わせ(タクティクスプロ)');
    o();
    o(`更新: ${now}(JST)・シミュレーター: Expert 各 ${cache.combo.runs.Expert} 回・Master 各 ${cache.combo.runs.Master} 回(26 × 25 通り)`);
    o();
    o('勇者モンごとに、最初に入る供モン(WAVE 2 のあと)を 25 通り入れ替えて回し、その勇者モンの平均との差(届いた WAVE)を出します。残りの供モン2体はくじ。Expert 5・Master 3 の重み(Master はほとんど WAVE 2 までに決まるので差が小さい)。アシカはボットの選び方、EX とアシカの使い方は上手な使い方。');
    o();
    o('**相性 = その組の伸び − その供モンがどの勇者と組んでも出す伸び(下の「供モンとしての強さ」)。** 引かないと、供モンとして強い子(ゴースト)がどの勇者とも上位に並んでしまうため。');
    o();
    o(`ぶれの目安: 1組は Expert ${cache.combo.runs.Expert} 回なので、相性 ±0.3 くらいまではくじのぶれの中。上位・下位の並びは目安として見る。理由は、間合いの枠・EX の役(攻め/守り/支え)・勇者特性・その組での供モンの火力の割合から機械が書いたもの。`);
    o();
    o('## 供モンとしての強さ(どの勇者と組んでも)');
    o();
    { const am = Object.entries(C.allyMain).sort((p, q) => q[1] - p[1]); o(`- 強い: ${am.slice(0, 5).map(([id, v]) => `${NAME[id]}(${sgn(v)})`).join('・')}`); o(`- 弱い: ${am.slice(-5).reverse().map(([id, v]) => `${NAME[id]}(${sgn(v)})`).join('・')}`); }
    o();
    if (V) {
      o(`## よく合う組み合わせ(1回目の上位 ${V.length} 組を、別の種で各 ${cache.verify.runs} 回測り直したもの)`);
      o();
      o(`1回目(Expert ${cache.combo.runs.Expert} 回)で上位に出た組を、乱数の種を変えて Expert・Master 各 ${cache.verify.runs} 回回し直した。基準(その勇者モンの平均)も同じ種・同じ回数で取り直した(最初の供モンも 25 体からくじ)。`);
      o(`**測り直しの相性で並べる。** 1回目より下がるのがふつう(650 組の中から上を拾うと、くじで上に出た組が混ざるため)。測り直しで +${VERIFY_FIRM} 以上残った組を「確か」とした。`);
      o();
      o('| 勇者モン | 供モン | 相性(測り直し) | 1回目 | 確か | 理由 |');
      o('| --- | --- | --- | --- | --- | --- |');
      for (const x of V) o(`| ${x.h.name} | ${x.a.name} | ${sgn(x.pts)} | ${sgn(x.first)} | ${x.pts >= VERIFY_FIRM ? '確か' : 'くじだった見込み'} | ${comboReason(x, true)}${confirmed(x, true) ? '(実戦でも確認)' : ''} |`);
      o();
      o(`### 1回目の上位 20(測り直す前。目安)`);
      o();
      o('| 勇者モン | 供モン | 相性 |');
      o('| --- | --- | --- |');
      for (const x of good.slice(0, 20)) o(`| ${x.h.name} | ${x.a.name} | ${sgn(x.pts)} |`);
    } else {
      o('## よく合う組み合わせ(上位 20)');
      o();
      o('| 勇者モン | 供モン | 相性 | 理由 |');
      o('| --- | --- | --- | --- |');
      for (const x of top) o(`| ${x.h.name} | ${x.a.name} | ${sgn(x.pts)} | ${comboReason(x, true)}${confirmed(x, true) ? '(実戦でも確認)' : ''} |`);
    }
    o();
    o('## 合わない組み合わせ(下位 10。1回目の数字で、測り直していない)');
    o();
    o('| 勇者モン | 供モン | 相性 | 理由 |');
    o('| --- | --- | --- | --- |');
    for (const x of bottom) o(`| ${x.h.name} | ${x.a.name} | ${sgn(x.pts)} | ${comboReason(x, false)}${confirmed(x, false) ? '(実戦でも確認)' : ''} |`);
    o();
    o('## 勇者モンごとの相性のいい供モン(1回目の数字。くじのぶれ ±0.3 の中にあるものが多い)');
    o();
    for (const h of MONS) {
      const xs = C.filter((x) => x.h.id === h.id && Number.isFinite(x.pts)).sort((a, z) => z.pts - a.pts);
      o(`- **${h.name}**: よい ${xs.slice(0, 3).map((x) => `${x.a.name}(${sgn(x.pts)})`).join('・')} / 合わない ${xs.slice(-2).reverse().map((x) => `${x.a.name}(${sgn(x.pts)})`).join('・')}`);
    }
    o();
    o('実戦で確認 = 実戦(タクティクスプロ)でその組がそろった回が2回以上あり、その回の届いた WAVE が平均より同じ向きにずれていたもの。');
    o();
    o('作り直す: `node tools/playbot/asika-tier.js --only combo`(回さずに作り直すなら `--from-cache`)');
    fs.writeFileSync(path.join(OUT_DIR, 'combo.md'), L.join('\n') + '\n');
    // tier.json の「良い」組は、測り直したときは「確か」だけを載せる
    out.combo = { rows: C, top: V ? V.filter((x) => x.pts >= VERIFY_FIRM) : top, bottom, confirmed };
  }
  // ---------- tier.json ----------
  const jf = path.join(OUT_DIR, 'tier.json');
  const j = JSON.parse(fs.readFileSync(jf, 'utf8'));
  if (A) {
    j.アシカ = A.cards.map((c) => {
      const w = cardWords(c);
      const fits = MONS.map((m) => ({ m, l: c.heroLift[m.id] })).filter((x) => Number.isFinite(x.l)).sort((a, z) => z.l - a.l).slice(0, 3);
      return {
        名前: c.name, 総合: c.tier, Hard: c.per.Hard.tier, Expert: c.per.Expert.tier, Master: c.per.Master.tier, 暫定: c.provisional, 仮の総合: '',
        理由: `${w.reason}(実戦 Hard ${c.real.Hard.n}・Expert ${c.real.Expert.n}・Master ${c.real.Master.n} 回)`,
        強み: w.good.join('・'), 弱み: w.bad.join('・'),
        回数: Object.fromEntries(DIFFS.map((d) => [d, c.per[d].n])),
        合うモンスター: fits.map((x) => ({ 名前: x.m.name, 理由: `この子が勇者モンのとき、優先すると WAVE ${sgn(x.l, r1)}` })),
      };
    });
    for (const jm of j.モンスター) {
      const m = MONS.find((x) => x.name === jm.名前); if (!m) continue;
      const r = recommendFor(m, A);
      jm.おすすめアシカ = r.length ? r.map(({ 名前, 理由 }) => ({ 名前, 理由 }))
        : [{ 名前: 'どれでも同じくらい', 理由: `差が WAVE +${RECOMMEND_MIN} に届くカードが無い(いちばん伸びる ${bestCardFor(m, A).name} でも ${sgn(bestCardFor(m, A).lift, r1)})` }];
    }
  }
  if (C) {
    const { top, bottom, confirmed } = out.combo;
    j.組み合わせ = [
      ...top.map((x) => ({ 勇者: x.h.name, 供モン: x.a.name, 良し悪し: '良い', 点: Math.round(x.pts * 100) / 100, 理由: comboReason(x, true), 実戦で確認: confirmed(x, true) })),
      ...bottom.map((x) => ({ 勇者: x.h.name, 供モン: x.a.name, 良し悪し: '合わない', 点: Math.round(x.pts * 100) / 100, 理由: comboReason(x, false), 実戦で確認: confirmed(x, false) })),
    ];
    for (const jm of j.モンスター) {
      const xs = out.combo.rows.filter((x) => x.h.name === jm.名前 && Number.isFinite(x.pts)).sort((a, z) => z.pts - a.pts).slice(0, 3);
      if (xs.length) jm.相性のいい供モン = xs.map((x) => ({ 名前: x.a.name, 理由: `${comboReason(x, true)}(相性 ${sgn(x.pts)})` }));
    }
  }
  fs.writeFileSync(jf, JSON.stringify(j, null, 2) + '\n');
  return out;
}

(async () => {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch (e) { cache = {}; }
  if (!args.includes('--from-cache')) await compute(cache);
  if (!cache.asika && !cache.combo) { console.error('キャッシュがありません。--from-cache を外して回してください'); process.exit(1); }
  const r = writeAll(cache);
  if (r.asika) console.log(`アシカ: ${r.asika.cards.map((c) => `${c.name} ${c.tier}${c.provisional ? '*' : ''}(${sgn(c.score)})`).join(' / ')}`);
  if (r.combo) console.log(`組み合わせ 上位: ${r.combo.top.slice(0, 5).map((x) => `${x.h.name}×${x.a.name} ${sgn(x.pts)}`).join(' / ')}`);
  console.log('書き出した: docs/playbot/reports/tier/asika-tier.md・combo.md・tier.json・asika-sim.json');
})();
