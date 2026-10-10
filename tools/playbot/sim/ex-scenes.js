// EX・アシカの「上手な使い方」が、どんな場面で使っているかを書き出す(アリーナくんへ渡す用)。
//
//   node tools/playbot/sim/ex-scenes.js [--hero Tiger,Ham,…] [--diff Hard,Expert] [--runs 300] [--assist mua,oryo] [--md <file>]
//
// 勇者モンごとに、EX の使い方 bot(いまのボット)と best(上手な使い方)で同じ seed・同じ供モンを回し、
//   ・平均の届いた WAVE と差(best − bot)
//   ・1ランで EX を使った回数
//   ・使った場面: 何 WAVE / 何ターン目・敵の予告(single・big・all・charge…)・その子が狙われていたか・使う前のライフ・敵の残りライフ・倒れていた子の数
// を並べる。アシカは「そのカードを優先して選ぶ」(simulateRun の assist にカードの id)で、使い方 assistPlay bot と best を比べる。
// 式・戦い方は battle.js のまま(ここは数えて並べるだけ)。
const fs = require('fs');
const path = require('path');
const { simulateRun, pickAllies, MONS, G, TEACH_BY_ID, mulberry32, hashSeed } = require('./battle');

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const HEROES = argOf('--hero', 'Tiger,Ham,Undine,Plant,Ark,Eiki').split(',').filter(Boolean);
const DIFFS = argOf('--diff', 'Hard,Expert').split(',');
const RUNS = Number(argOf('--runs', '300'));
const ASSISTS = argOf('--assist', 'mua,oryo').split(',').filter((x) => TEACH_BY_ID[x]);
const SEED = Number(argOf('--seed', '1'));
const mdFile = argOf('--md', '');
const NAME = Object.fromEntries(MONS.map((m) => [m.id, m.name]));
const THREAT_JA = { single: '単体', multi: '連続', big: '大技', all: '全体', pierce: '貫通', charge: 'ため', pierceCharge: '貫通のため', none: '攻撃なし' };

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x) => `${Math.round(x * 100)}%`;
const sgn = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`;
// 場面の並びを短い文にする
function sceneText(scenes, runs) {
  if (!scenes.length) return '使わない';
  const top = (key, map = (v) => v) => {
    const c = {};
    scenes.forEach((s) => { const k = map(s[key]); c[k] = (c[k] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${k} ${pct(n / scenes.length)}`).join('・');
  };
  const turnBand = (t) => (t <= 2 ? '1〜2' : (t <= 5 ? '3〜5' : (t <= 10 ? '6〜10' : '11〜')));
  return [
    `1ラン ${(scenes.length / runs).toFixed(1)} 回`,
    `ターン ${top('turn', turnBand)}`,
    `予告 ${top('threat', (t) => THREAT_JA[t] || t)}`,
    ...(scenes[0].aimed !== undefined ? [`狙われていた ${pct(mean(scenes.map((s) => (s.aimed ? 1 : 0))))}`] : []),
    `使う前のライフ 平均 ${pct(mean(scenes.map((s) => s.hp ?? 1)))}`,
    `敵の残り 平均 ${pct(mean(scenes.map((s) => s.enemyHp)))}`,
    ...(scenes[0].downed !== undefined ? [`倒れた子がいた ${pct(mean(scenes.map((s) => (s.downed > 0 ? 1 : 0))))}`] : []),
  ].join(' / ');
}

function runPair(heroId, d, opt) {
  const out = {};
  for (const mode of ['bot', 'best']) {
    const waves = []; const scenes = [];
    for (let i = 0; i < RUNS; i++) {
      const allies = pickAllies(heroId, mulberry32(hashSeed(SEED, 'allies', heroId, d, i)));
      const r = simulateRun({ heroId, allies, difficulty: d, seed: hashSeed(SEED, i), exLog: true, ...opt(mode) });
      waves.push(r.wave);
      (opt(mode).assist && opt(mode).assist !== 'bot' ? r.assistScenes.filter((s) => s.id === opt(mode).assist) : r.exLog.filter((s) => s.id === heroId)).forEach((s) => scenes.push(s));
    }
    out[mode] = { avg: mean(waves), scenes };
  }
  return out;
}

const t0 = Date.now();
const L = []; const say = (t = '') => L.push(t);
say(`# EX・アシカを使う場面(上手な使い方 best と いまのボット bot・${DIFFS.join(' / ')}・各 ${RUNS} 回)`);
say();
say('`node tools/playbot/sim/ex-scenes.js` の出力。シミュレーター(battle.js)で、同じ seed・同じ供モンのまま、使い方だけ変えて回した。');
say('「差」は best − bot の平均 WAVE(大きいほど、ボットの使い方を直すと伸びる)。場面は勇者モンの EX だけを数えた。');
say('ターンはその WAVE の何ターン目か。予告は使ったターンの敵の予告。ライフ・敵の残りは使う前の割合(EX は使う子のライフ、アシカは立っている子でいちばん細った子のライフ)。');
say();
say('## EX(勇者モン)');
for (const h of HEROES) {
  const def = G.tacticsExDefOf(h) || {};
  say();
  say(`### ${NAME[h] || h}「${def.name || '-'}」(${def.effect || '-'})`);
  say();
  say('| 難易度 | bot 平均 | best 平均 | 差 | bot の使い方 | best の使い方 |');
  say('| --- | --- | --- | --- | --- | --- |');
  for (const d of DIFFS) {
    const r = runPair(h, d, (mode) => ({ exMode: mode }));
    say(`| ${d} | ${r.bot.avg.toFixed(2)} | ${r.best.avg.toFixed(2)} | ${sgn(r.best.avg - r.bot.avg)} | ${sceneText(r.bot.scenes, RUNS)} | ${sceneText(r.best.scenes, RUNS)} |`);
  }
  console.log(`  ${h}: ${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
}
if (ASSISTS.length) {
  say();
  say('## アシカ(そのカードを優先して選び、手札での使い方 assistPlay だけ bot / best で変える)');
  say();
  say('勇者モンは上の子を順に使い、全員ぶんを合わせた。EX はどちらも best。');
  for (const a of ASSISTS) {
    say();
    say(`### ${TEACH_BY_ID[a].baseName}(${a})`);
    say();
    say('| 難易度 | bot 平均 | best 平均 | 差 | bot の使い方 | best の使い方 |');
    say('| --- | --- | --- | --- | --- | --- |');
    for (const d of DIFFS) {
      const agg = { bot: { w: [], s: [] }, best: { w: [], s: [] } };
      for (const h of HEROES) {
        const r = runPair(h, d, (mode) => ({ exMode: 'best', assist: a, assistPlay: mode }));
        for (const m of ['bot', 'best']) { agg[m].w.push(r[m].avg); agg[m].s.push(...r[m].scenes); }
      }
      const n = RUNS * HEROES.length;
      say(`| ${d} | ${mean(agg.bot.w).toFixed(2)} | ${mean(agg.best.w).toFixed(2)} | ${sgn(mean(agg.best.w) - mean(agg.bot.w))} | ${sceneText(agg.bot.s, n)} | ${sceneText(agg.best.s, n)} |`);
    }
    console.log(`  ${a}: ${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
  }
}
say();
say(`(${((Date.now() - t0) / 1000).toFixed(0)} 秒。seed ${SEED})`);
const text = `${L.join('\n')}\n`;
if (mdFile) { fs.mkdirSync(path.dirname(path.resolve(mdFile)), { recursive: true }); fs.writeFileSync(path.resolve(mdFile), text); console.log(`書き出した: ${mdFile}`); } else process.stdout.write(text);
