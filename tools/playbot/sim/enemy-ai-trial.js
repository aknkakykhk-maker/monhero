// タクティクスの敵の「作戦AI」の試算(2026-11-11 社長の材料「タクティクス・NPCの戦術AI強化: 行動選択、距離、スキルの組み合わせ、難易度ごとの戦術を改善」)。
// ★ゲームの数字・敵の強さは何も変えない。シミュレーター(battle.js)の enemyAiHook に、案の選び方を差し込んで比べるだけ。
//
//   node tools/playbot/sim/enemy-ai-trial.js [--diff Hard,Expert,Master] [--runs 40] [--ai now,L1,L2,L3] [--md <file>] [--seed 1]
//
// 案(どれも「予告してから動く」は守る。狙い=ヘイトは変えない。画面の「狙われる確率◯%」と食い違わないように):
//   W   … 様子見だけ無くす(ほかはいまのまま。効き目を分けて見る用)
//   now … いまのまま。決まった重みのくじ(chooseEnemyAction)。移動先もくじ
//   L1  … 間合いを読む: 移動先を「味方の与ダメがいちばん下がる間合い」にする。いまの間合いが一番ましなら動かない。
//          ひどい間合い(味方の主力の真正面)にいるときほど移動を選びやすい
//   L2  … L1 + 状況を読む: 様子見をしない・減ってから再生・削られてからの咆哮はしない・
//          立っている子が多いほど全体攻撃・予告の間合いにだれもいない間合い攻撃はしない
//   L3  … L2 + 技の組み合わせ: 咆哮のあとは「ためる→必殺技」へつなぐ・味方が弱っているときは必殺技で取りに来る・
//          ガードの厚い相手には貫通の構え
const path = require('path');
const fs = require('fs');
const { simulateRun, pickAllies, MONS, G, mulberry32, hashSeed } = require('./battle');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1] : d; };
const DIFFS = arg('diff', 'Hard,Expert,Master').split(',');
const RUNS = Number(arg('runs', 40));
const AIS = arg('ai', 'now,L1,L2,L3').split(',');
const SEED = Number(arg('seed', 1));
const MD = arg('md', null);
const HEROES = arg('heroes', null) ? arg('heroes').split(',') : MONS.map((m) => m.id);

// 敵がその間合いにいるとき、味方から受ける「ふだんの1ターンぶんの圧」。式は本体の tacticsEnemyPressure(32-tactics-units.jsx)をそのまま使う
const slotBonusOf = (st) => [0, 1, 2, 3].map((i) => (st.distBonus[i] || 0) + (st.mons[i] ? (G.getMonsterAptPct(st.mons[i], null, 1)[i] || 0) : 0));
const pressureOf = (st) => G.tacticsEnemyPressure(st.units, slotBonusOf(st));
const aliveSlots = (st) => G.tacticsAliveSlots(st.units);
// 本体の試作(22-enemy-and-bond-entries.jsx chooseTacticsEnemyActionAi)へ渡す ai。ゲーム(60-app.jsx)も同じ形で渡す
const aiCtx = (st, level, lastType) => {
  const alive = aliveSlots(st);
  const us = alive.map((i) => G.normalizeTacticsUnit(st.units[i]));
  return { level, pressure: pressureOf(st), aliveSlots: alive, lowCount: us.filter((u) => u.hp < u.maxHp * 0.4).length, maxDef: Math.max(0, ...us.map((u) => u.def)), lastType };
};

function makeHook(level, tally) {
  const L = { now: 0, W: 0, L1: 1, L2: 2, L3: 3 }[level];
  return (st, dist, state) => {
    const ent = st.enemy;
    const st2 = level === 'W' ? { ...state, definitions: state.definitions.map((def) => (def.type === 'WAIT' ? { ...def, weight: 0 } : def)) } : state;
    const intent = G.chooseTacticsEnemyActionAi(ent, dist, st.rng, st2, aiCtx(st, L, state.lastType));
    // 数える(予告の時点。実際に出たかは問わない＝傾向を見る)
    if (intent) {
      const p = pressureOf(st);
      const key = intent.variant || intent.type;
      tally.acts[key] = (tally.acts[key] || 0) + 1; tally.total += 1;
      if (intent.type === 'MOVE') { tally.moves += 1; if (p[intent.targetDist] > p[dist] * 1.02) tally.badMoves += 1; }
      if (intent.type === 'ROAR' && ent.maxHp > 0 && ent.hp / ent.maxHp < 0.35) tally.lateRoar += 1;
      if (intent.variant === 'sweep' && !aliveSlots(st).includes(dist)) tally.emptySweep += 1;
      // いまの間合いが「4つのうち一番まし」から何%損か(敵から見た立ち位置の悪さ)
      tally.posLoss += p[dist] / Math.max(1e-9, Math.min(...p)) - 1; tally.posN += 1;
    }
    return intent;
  };
}

function runOne(ai, diff, heroId, i) {
  const seed = hashSeed(SEED, heroId, diff, i);
  const allies = pickAllies(heroId, mulberry32(seed));
  const tally = { acts: {}, total: 0, moves: 0, badMoves: 0, lateRoar: 0, emptySweep: 0, posLoss: 0, posN: 0 };
  let last = null;
  const hook0 = makeHook(ai, tally);
  // 直前の予告の種類(組み合わせ用)を覚えておく
  const hook = (st, dist, state) => { const it = hook0(st, dist, { ...state, lastType: last }); last = it ? it.type : null; return it; };
  const r = simulateRun({ heroId, allies, difficulty: diff, seed, exMode: 'bot', enemyAiHook: hook });
  return { r, tally };
}

const t0 = Date.now();
const rows = [];
for (const diff of DIFFS) for (const ai of AIS) {
  const agg = { n: 0, clear: 0, wave: 0, turns: 0, taken: 0, wavesPlayed: 0, acts: {}, total: 0, moves: 0, badMoves: 0, lateRoar: 0, emptySweep: 0, posLoss: 0, posN: 0, wipeWaves: {} };
  for (const h of HEROES) for (let i = 0; i < RUNS; i++) {
    const { r, tally } = runOne(ai, diff, h, i);
    agg.n += 1; agg.wave += r.result === 'clear' ? 10 : r.wave - 1; if (r.result === 'clear') agg.clear += 1; else agg.wipeWaves[r.wave] = (agg.wipeWaves[r.wave] || 0) + 1;
    agg.taken += r.taken || 0; agg.wavesPlayed += Math.max(1, (r.waveTurns || []).length);
    agg.turns += (r.waveTurns || []).reduce((a, b) => a + b, 0) / Math.max(1, (r.waveTurns || []).length);
    for (const k of Object.keys(tally.acts)) agg.acts[k] = (agg.acts[k] || 0) + tally.acts[k];
    ['total', 'moves', 'badMoves', 'lateRoar', 'emptySweep', 'posLoss', 'posN'].forEach((k) => { agg[k] += tally[k]; });
  }
  rows.push({ diff, ai, ...agg });
  process.stderr.write(`${diff} ${ai} 勝率 ${(agg.clear / agg.n * 100).toFixed(1)}% 平均到達 ${(agg.wave / agg.n).toFixed(2)} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}

const pct = (a, b) => (b ? `${(a / b * 100).toFixed(1)}%` : '-');
const L = [];
L.push(`# タクティクス 敵の作戦AI 試算(${new Date().toISOString().slice(0, 10)})`, '');
L.push(`勇者モン ${HEROES.length} 体 × 各 ${RUNS} 回(供モン3体はくじ)・味方の戦い方は実戦ボットと同じ(EX=bot)。敵の数字は変えず、手の選び方だけ差し替えた。`, '');
L.push('| 難易度 | 案 | クリア率 | 平均の突破WAVE | 1WAVEの平均ターン | 1WAVEに受けたダメージ | 様子見 | 移動 | うち損な移動 | 立ち位置の損(平均) | 削られてからの咆哮 | 空振りの間合い攻撃 |');
L.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const x of rows) {
  L.push(`| ${x.diff} | ${x.ai} | ${pct(x.clear, x.n)} | ${(x.wave / x.n).toFixed(2)} | ${(x.turns / x.n).toFixed(1)} | ${Math.round(x.taken / Math.max(1, x.wavesPlayed))} | ${pct(x.acts.WAIT || 0, x.total)} | ${pct(x.moves, x.total)} | ${pct(x.badMoves, x.moves)} | +${(x.posLoss / Math.max(1, x.posN) * 100).toFixed(0)}% | ${x.lateRoar} | ${x.emptySweep} |`);
}
L.push('', '## 手の内訳(予告した回数の割合)', '');
const KEYS = ['ATTACK', 'rush', 'sweep', 'allout', 'CHARGE', 'SPECIAL', 'PIERCE_CHARGE', 'pierce', 'ROAR', 'REGEN', 'MOVE', 'WAIT'];
L.push(`| 難易度 | 案 | ${KEYS.join(' | ')} |`); L.push(`| --- | --- | ${KEYS.map(() => '---').join(' | ')} |`);
for (const x of rows) L.push(`| ${x.diff} | ${x.ai} | ${KEYS.map((k) => pct(x.acts[k] || 0, x.total)).join(' | ')} |`);
L.push('', `(${((Date.now() - t0) / 1000).toFixed(0)} 秒・seed ${SEED})`);
const text = `${L.join('\n')}\n`;
if (MD) { fs.mkdirSync(path.dirname(path.resolve(MD)), { recursive: true }); fs.writeFileSync(path.resolve(MD), text); console.log(`書き出した: ${MD}`); } else process.stdout.write(text);
