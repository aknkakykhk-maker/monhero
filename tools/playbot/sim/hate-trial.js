#!/usr/bin/env node
// タクティクスの「ヘイト(裏ステータス)」の試算(2026-10-17 社長「まず案をまとめて数値化してみせて」)。ゲーム本体には入れていない。
//
//   node tools/playbot/sim/hate-trial.js [--runs 200] [--md <file>] [--k 50] [--decay 0.7]
//
// 簡易シミュレーター(battle.js)の「狙いを決める口」(simulateRun({ aimHook }))に、案の式を差し込んで、
// 今の式(残りライフの割合だけ)とヘイトありを同じ種で比べる。狙いの重みは本体の tacticsTargetWeights をそのまま使う。
//
// 案の式(docs/playbot/reports/2026-10-17/tactics-hate-plan.md):
//   ヘイトは子ごと・バトル中だけ。WAVE が変わったら0。倒れたら0。上限100。毎ターン ×DECAY(3割減る)してから足す。
//   与ダメージ: 敵の最大ライフの1%ごとに+1(1ターン最大+30)
//   モノリスの EX(みんなをかばう)を使った: +60 / ユグドラシルの EX(世界樹の回復)を使った: +10(回復の代わり)
//   重み = (1 + 2 ×(1 − 残りライフの割合))×(1 + ヘイト ÷ K)
// ★近似: 回復カード・強化カード・ガードのヘイト(+α)は、シミュレーターが子ごとに数えていないので入れていない。
//   挑発の技・「ひそむ」はまだ無いので入れていない。
const fs = require('fs');
const path = require('path');
const { simulateRun, G } = require('./battle');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('--runs', 200));
const K = Number(arg('--k', 50));
const DECAY = Number(arg('--decay', 0.7));
const MD = arg('--md', null);
const DIFFS = String(arg('--diff', 'Expert,Master')).split(',');
const SHARE_GAIN = Number(arg('--share', 40));
const HATE_CAP = 100, DMG_CAP = 30;
const EX_HATE = { Monol: 60, Yggdrasil: 10 };
const PARTIES = [
  { key: 'top', name: '1位(モッチー + ゴースト・スプーキー・ハム)', hero: 'Mocchi', allies: ['Ghost', 'Spooky', 'Ham'] },
  { key: 'tank', name: '盾役入り(モッチー + モノリス・ゴースト・ハム)', hero: 'Mocchi', allies: ['Monol', 'Ghost', 'Ham'] },
  { key: 'heal', name: '回復役入り(モッチー + ユグドラシル・ゴースト・ハム)', hero: 'Mocchi', allies: ['Yggdrasil', 'Ghost', 'Ham'] },
];
const flame = (h) => (h >= 80 ? 3 : h >= 50 ? 2 : h >= 20 ? 1 : 0);
const flameText = (h) => ['—', '🔥', '🔥🔥', '🔥🔥🔥'][flame(h)];
const TARGETED = ['ATTACK', 'SPECIAL'];

// mode: 'now'(今の式)/'hate'(案の式: 敵の最大ライフの1%で+1)/'share'(調整案: そのターンに味方が与えたダメージのうち、その子の割合 × SHARE_GAIN)
const makeHook = (mode, rec) => (st, intent) => {
  const key = `${st.wave}-${st.turn}`;
  const filled = G.tacticsFilledSlots(st.units);
  if (st.hateWave !== st.wave) {
    st.hateWave = st.wave; st.hate = [0, 0, 0, 0];
    st.hateSnap = { ...st.dmgBySlot }; st.hateEx = { ...st.exUses }; st.hateKey = key;
    st.hateDown = filled.map((i) => G.normalizeTacticsUnit(st.units[i]).downed);
    st.hateCount = 0;
  } else {
    st.hateKey = key; st.hateCount = (st.hateCount || 0) + 1;
    const team = filled.reduce((a, i) => a + Math.max(0, (st.dmgBySlot[i] || 0) - (st.hateSnap[i] || 0)), 0);
    for (const i of filled) {
      const u = G.normalizeTacticsUnit(st.units[i]);
      const dealt = (st.dmgBySlot[i] || 0) - (st.hateSnap[i] || 0);
      const id = st.mons[i] && st.mons[i].id;
      const exNow = id ? (st.exUses[id] || 0) - (st.hateEx[id] || 0) : 0;
      const gain = mode === 'share' ? (team > 0 ? SHARE_GAIN * Math.max(0, dealt) / team : 0) : Math.min(DMG_CAP, Math.max(0, dealt) / Math.max(1, st.enemy.maxHp) * 100);
      let h = st.hate[i] * DECAY + gain + (exNow > 0 ? (EX_HATE[id] || 0) : 0);
      if (u.downed) h = 0;
      st.hate[i] = Math.min(HATE_CAP, h);
    }
    st.hateSnap = { ...st.dmgBySlot }; st.hateEx = { ...st.exUses };
  }
  // 倒れた回数(立っていた子が倒れた)
  filled.forEach((i, k) => {
    const down = G.normalizeTacticsUnit(st.units[i]).downed;
    if (down && !(st.hateDownBy || {})[i]) { rec.downs[st.mons[i].id] = (rec.downs[st.mons[i].id] || 0) + 1; }
    st.hateDownBy = { ...(st.hateDownBy || {}), [i]: down };
  });
  const sweep = intent && intent.variant === 'sweep' && Number.isInteger(intent.sweepDist) && G.tacticsAliveSlots(st.units).includes(intent.sweepDist);
  const choosable = intent && TARGETED.includes(intent.type) && !intent.targetsAll && !sweep;
  const base = G.tacticsTargetWeights(st.units);
  const withHate = base.map((w) => ({ index: w.index, weight: w.weight * (1 + (st.hate[w.index] || 0) / K) }));
  const prob = (ws) => { const t = ws.reduce((a, w) => a + w.weight, 0) || 1; return Object.fromEntries(ws.map((w) => [w.index, w.weight / t])); };
  if (rec.trace && choosable) {
    const pNow = prob(base), pHate = prob(withHate);
    rec.trace.push({ wave: st.wave, turn: (st.hateCount || 0) + 1, enemy: st.enemy.name || st.enemy.id, rows: filled.map((i) => ({
      id: st.mons[i].id, name: st.mons[i].name, hp: Math.round(G.normalizeTacticsUnit(st.units[i]).hp / Math.max(1, G.normalizeTacticsUnit(st.units[i]).maxHp) * 100),
      down: G.normalizeTacticsUnit(st.units[i]).downed, hate: Math.round(st.hate[i] || 0), pNow: pNow[i] || 0, pHate: pHate[i] || 0 })) });
  }
  if (!choosable || mode === 'now') {
    const out = G.withTacticsTarget(intent, st.units, st.rng);
    if (out && Number.isInteger(out.targetSlot) && choosable) rec.aimed[st.mons[out.targetSlot].id] = (rec.aimed[st.mons[out.targetSlot].id] || 0) + 1;
    return out;
  }
  const total = withHate.reduce((a, w) => a + w.weight, 0);
  let roll = Math.min(0.999999999, Math.max(0, Number(st.rng()) || 0)) * total, slot = withHate[withHate.length - 1].index;
  for (const w of withHate) { roll -= w.weight; if (roll < 0) { slot = w.index; break; } }
  rec.aimed[st.mons[slot].id] = (rec.aimed[st.mons[slot].id] || 0) + 1;
  return { ...intent, targetSlot: slot, targetName: G.tacticsTargetName(st.units, slot) };
};

const runSet = (party, mode, runs, diff) => {
  const rec = { aimed: {}, downs: {} };
  let clear = 0, waves = 0;
  for (let s = 1; s <= runs; s += 1) {
    const r = simulateRun({ heroId: party.hero, allies: party.allies, difficulty: diff, seed: s, aimHook: makeHook(mode, rec) });
    if (r.result === 'clear') clear += 1;
    waves += r.result === 'clear' ? 11 : r.wave;
  }
  return { clear: clear / runs, wave: waves / runs, ...rec };
};

// 代表の場面: ふつうの WAVE(1)とボス戦(10)の、ターンごとの表(ヘイトありで1回回した記録)
const traceRun = (party, diff, mode) => {
  for (let s = 1; s <= 60; s += 1) {
    const rec = { aimed: {}, downs: {}, trace: [] };
    const r = simulateRun({ heroId: party.hero, allies: party.allies, difficulty: diff, seed: s, aimHook: makeHook(mode, rec) });
    if (r.result === 'clear' || r.wave >= 10) return { seed: s, rec };
  }
  return null;
};

const pct = (x) => `${Math.round(x * 100)}%`;
const lines = [];
const out = (l = '') => { lines.push(l); console.log(l); };
const NAME = Object.fromEntries(require('./battle').MONS.map((m) => [m.id, m.name]));
const fmt = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([id, n]) => `${NAME[id] || id} ${n}`).join('・') || '—';
const MODE_NAME = { now: '今の式', hate: '案の式', share: '調整案' };
out(`# タクティクス: ヘイトの試算(各 ${RUNS} 回・K=${K}・毎ターン ×${DECAY})`);
out('');
out('作り直す: `node tools/playbot/sim/hate-trial.js --runs ' + RUNS + ' --md <file>`(シミュレーター battle.js の狙いの口に式を差し込む。ゲーム本体は変えていない)');
out('');
out('- 今の式: 重み = 1 + 2 ×(1 − 残りライフの割合)');
out(`- 案の式: 今の重み ×(1 + ヘイト ÷ ${K})。ヘイトは与ダメージが敵の最大ライフの1%で+1(1ターン最大+${DMG_CAP})・モノリスのかばう+60・ユグドラシルの回復+10・毎ターン ×${DECAY}・倒れたら0・WAVE ごとに0・上限${HATE_CAP}`);
out(`- 調整案: 案の式の「与ダメージ」を「そのターンに味方が与えたダメージのうち、その子の割合 × ${SHARE_GAIN}」に替えたもの(敵のライフの大きさに左右されない)`);
out('- 近似: 回復カード・強化カード・ガードによるヘイトはシミュレーターが子ごとに数えていないので入れていない');
for (const diff of DIFFS) {
  out('');
  out(`## 1. 比べ(${diff}・同じ種で ${RUNS} 回)`);
  out('');
  out('| パーティ | 式 | クリア率 | 平均 WAVE | 狙われた回数(多い順) | 倒れた回数 |');
  out('| --- | --- | --- | --- | --- | --- |');
  for (const p of PARTIES) {
    for (const mode of ['now', 'hate', 'share']) {
      const r = runSet(p, mode, RUNS, diff);
      out(`| ${p.name} | ${MODE_NAME[mode]} | ${pct(r.clear)} | ${r.wave.toFixed(2)} | ${fmt(r.aimed)} | ${fmt(r.downs)} |`);
    }
  }
}
for (const mode of ['hate', 'share']) {
  out('');
  out(`## 2. 代表の場面(${MODE_NAME[mode]}・Expert で1回。予告のたびに1行)`);
  for (const p of PARTIES) {
    const t = traceRun(p, 'Expert', mode);
    if (!t) continue;
    for (const wave of [5, 10]) {
      const rows = t.rec.trace.filter((x) => x.wave === wave).slice(0, 8);
      if (!rows.length) continue;
      out('');
      out(`### ${p.name}・WAVE ${wave}${wave === 10 ? '(ボス戦)' : '(ふつうの WAVE)'}・${rows[0].enemy}(種 ${t.seed})`);
      out('');
      out('各マス: ヘイト / 炎の段 / 狙われる確率(今の式 → ヘイトあり)');
      out('');
      const names = rows[0].rows.map((r) => r.name);
      out(`| 予告 | ${names.join(' | ')} |`);
      out(`| --- | ${names.map(() => '---').join(' | ')} |`);
      for (const x of rows) out(`| ${x.turn} | ${x.rows.map((r) => r.down ? '倒れている' : `${r.hate} / ${flameText(r.hate)} / ${pct(r.pNow)}→${pct(r.pHate)}`).join(' | ')} |`);
    }
  }
}
if (MD) { fs.mkdirSync(path.dirname(MD), { recursive: true }); fs.writeFileSync(MD, lines.join('\n') + '\n'); }
