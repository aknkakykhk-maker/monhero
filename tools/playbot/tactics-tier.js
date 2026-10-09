// タクティクスくんの覚え書き(tactics-knowledge.json)と名簿(tactics-roster.json)から、
// 味方モンスターの Tier 表とバランス調整の案を作る。案だけで、ゲームの数字は変えない(決めるのは社長。2026-10-09)。
//
//   node tools/playbot/tactics-tier.js                    画面に出す
//   node tools/playbot/tactics-tier.js --md <file>        Markdown を書き出す(docs/playbot/reports/tier/monster-tier.md)
//
// 集め方: 「すべて解放してバトル」で勇者モンを入れ替えながら少しずつ回す(回数の少ない子から選ぶ)。
//   PLAYBOT_TACTICS_ALL=1 PLAYBOT_TACTICS_EXPLORE=1 PLAYBOT_TACTICS_DIFF=Expert node tools/playbot/playbot.js --only tactics
//
// 数え方
// - 頭割り比: その回の「その子のダメージ ÷ (味方全員のダメージ ÷ 人数)」。1.0 で人並み。
//   届いた WAVE が違っても比べられるように、回の中での割合にしている。
// - 勇者の伸び: 勇者モンにした回の「届いた WAVE − その難易度の全回の平均 WAVE」。勇者特性と、1体で戦う序盤の強さが出る。
// - 守り役・支え役(EX が かばう・ガード・回復・味方強化など)はダメージで測れないので、頭割り比を Tier に使わず
//   「その子が入った回の届いた WAVE」で見る。
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const args = process.argv.slice(2);
const mdAt = args.indexOf('--md');
const mdFile = mdAt >= 0 ? args[mdAt + 1] : '';

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8')); } catch (e) { return d; } };
const roster = readJson('tactics-roster.json', { monsters: [], assists: [] });
const know = readJson('tactics-knowledge.json', { runs: [] });

const DIFF_ORDER = ['Beginner', 'Normal', 'Hard', 'Expert', 'Master', 'Legend'];
// EX の効き目から役割を決める(ダメージで測ってよいかどうかに使う)
const ROLE_BY_EFFECT = {
  coverAll: '守り', partyGuard: '守り', damageBack: '守り',
  lifeSpring: '支え', cookieBox: '支え', partyBoost: '支え', multiBuff: '支え', present: '支え', timeStop: '支え',
};
const roleOf = (m) => ROLE_BY_EFFECT[m && m.ex && m.ex.effect] || '攻め';

const runs = (know.runs || []).filter((r) => r && r.result && r.result !== 'stopped' && DIFF_ORDER.includes(r.difficulty));
const sum = (a) => a.reduce((x, y) => x + y, 0);
const avg = (a) => (a.length ? sum(a) / a.length : NaN);
const r1 = (x) => (Number.isFinite(x) ? (Math.round(x * 10) / 10).toFixed(1) : '—');
const sgn = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${r1(x)}` : '—');
const RESULT_JA = { clear: 'クリア', wipe: '全員倒れた', timeout: 'ターン切れ' };

// 難易度ごとの平均 WAVE
const diffs = DIFF_ORDER.filter((d) => runs.some((r) => r.difficulty === d));
const meanWave = {};
for (const d of diffs) meanWave[d] = avg(runs.filter((r) => r.difficulty === d).map((r) => r.wave || 0));

// その回に戦った子(ダメージの記録がある子 + 勇者モン + 供モン)
const membersOf = (r) => [...new Set([r.hero, ...(r.allies || []), ...Object.keys(r.dmg || {})].filter(Boolean))];
const exUsedBy = (r, m) => (r.ex || []).some((e) => m.ex && m.ex.name && String(e).startsWith(m.ex.name));

const stats = roster.monsters.filter((m) => m && !m.debugOnly).map((m) => {
  const inRuns = runs.filter((r) => membersOf(r).includes(m.name));
  const heroRuns = runs.filter((r) => r.hero === m.name);
  const shares = [];
  for (const r of inRuns) {
    const d = r.dmg || {};
    const names = Object.keys(d).filter((k) => Number.isFinite(d[k]));
    const tot = sum(names.map((k) => d[k]));
    if (names.length >= 2 && tot > 0 && Number.isFinite(d[m.name])) shares.push(d[m.name] / (tot / names.length));
  }
  const heroLift = avg(heroRuns.map((r) => (r.wave || 0) - meanWave[r.difficulty]));
  const memberLift = avg(inRuns.map((r) => (r.wave || 0) - meanWave[r.difficulty]));
  const byDiff = {};
  for (const d of diffs) {
    const rs = inRuns.filter((r) => r.difficulty === d);
    if (!rs.length) continue;
    byDiff[d] = { n: rs.length, hero: rs.filter((r) => r.hero === m.name).length, clear: rs.filter((r) => r.result === 'clear').length, best: Math.max(...rs.map((r) => r.wave || 0)) };
  }
  // アシストカードとの相性: その子が入った回で、カードごとの届いた WAVE の伸び(2回以上あるカードだけ)
  const byAssist = {};
  for (const r of inRuns) for (const a of new Set((r.assists || []).map((x) => String(x).replace(/\+$/, '')))) {
    (byAssist[a] = byAssist[a] || []).push((r.wave || 0) - meanWave[r.difficulty]);
  }
  const assistRank = Object.entries(byAssist).filter(([, v]) => v.length >= 2).map(([a, v]) => [a, avg(v), v.length]).sort((x, y) => y[1] - x[1]);
  const exRuns = inRuns.filter((r) => (r.ex || []).length);
  const exUsed = exRuns.filter((r) => exUsedBy(r, m)).length;
  const role = roleOf(m);
  const share = avg(shares);
  // 点: 攻め役は頭割り比と勇者の伸び、守り・支え役は入った回の伸びと勇者の伸び
  // 勇者モンの回数が少ないうちは、勇者の伸びを軽く見る(1回だけの負けで Tier が大きく動かないように。3回で同じ重さ)
  const parts = [];
  if (role === '攻め' && shares.length) parts.push([(share - 1) * 1.2, 1]);
  if (role !== '攻め' && inRuns.length) parts.push([memberLift / 2, 1]);
  if (heroRuns.length) parts.push([heroLift / 2, Math.min(1, heroRuns.length / 3)]);
  const wsum = sum(parts.map((p) => p[1]));
  const score = wsum ? sum(parts.map((p) => p[0] * p[1])) / wsum : NaN;
  const n = inRuns.length;
  let tier = '未計測';
  if (Number.isFinite(score)) tier = score >= 0.45 ? 'S' : score >= 0.15 ? 'A' : score >= -0.15 ? 'B' : score >= -0.45 ? 'C' : 'D';
  return { m, role, n, heroN: heroRuns.length, share, shareN: shares.length, heroLift, memberLift, byDiff, assistRank, exUsed, exChance: exRuns.length, score, tier, provisional: n < 5 };
});

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', '未計測'];
stats.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || (b.score || -9) - (a.score || -9) || b.n - a.n);

const reasonOf = (s) => {
  if (!s.n) return 'まだ一度も戦っていない';
  const bits = [];
  if (s.role === '攻め' && s.shareN) bits.push(`頭割り比 ${r1(s.share)}${s.share >= 1.3 ? '(よく削る)' : s.share <= 0.7 ? '(削りが少ない)' : ''}`);
  if (s.role !== '攻め') bits.push(`${s.role}役。入った回は平均より WAVE ${sgn(s.memberLift)}`);
  if (s.heroN) bits.push(`勇者モンで WAVE ${sgn(s.heroLift)}(${s.heroN}回)`);
  if (s.m.hp <= 400 && s.heroN && s.heroLift < 0) bits.push(`ライフ ${s.m.hp} で1体の序盤がつらい`);
  if (s.exChance && !s.exUsed) bits.push('EX をまだ使えていない(ボットの使い方を確かめる)');
  return bits.join('・');
};

const lines = [];
const out = (t = '') => lines.push(t);
const now = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
const tried = stats.filter((s) => s.n).length;
out('# 味方モンスターの Tier 表(タクティクスプロ)');
out();
out(`更新: ${now}(JST)・数えた回: ${runs.length}回(${diffs.map((d) => `${d} ${runs.filter((r) => r.difficulty === d).length}`).join(' / ')})・戦ったモンスター: ${tried} / ${stats.length}体`);
out();
out('研究所:ハカセくんが作る。タクティクスプロはベースモンを使うので、全員が同じ条件です。');
out('「すべて解放してバトル」(デバッグ。記録・ランキング・報酬はつかない)で、勇者モンを入れ替えながら少しずつ集めています。');
out('**試した回数が5回より少ない子は「暫定」です。** 回数が増えると Tier は動きます。');
out();
out('## Tier の決め方');
out();
out('- **攻め役**: 頭割り比(その回のダメージ ÷ 味方の平均。1.0 で人並み)と、勇者モンにしたときの届いた WAVE(難易度の平均との差)');
out('- **守り役・支え役**(EX が かばう・ガード・回復・味方強化など): ダメージでは測れないので、その子が入った回の届いた WAVE と、勇者モンにしたときの WAVE');
out('- S ≥ 0.45 > A ≥ 0.15 > B ≥ −0.15 > C ≥ −0.45 > D(点はこの2つの平均。勇者モンにした回が3回より少ないうちは、勇者の伸びを軽く見る)');
out();
out('## Tier 表');
out();
out('| Tier | モンスター | 役 | 試した回数(勇者) | 頭割り比 | 勇者の伸び | 難易度ごと(回・クリア・最高WAVE) | 理由 |');
out('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const s of stats) {
  const bd = Object.entries(s.byDiff).map(([d, v]) => `${d} ${v.n}回・${v.clear}勝・W${v.best}`).join('<br>') || '—';
  out(`| ${s.tier}${s.provisional && s.n ? '(暫定)' : ''} | ${s.m.name} | ${s.role} | ${s.n}(${s.heroN}) | ${s.shareN ? r1(s.share) : '—'} | ${s.heroN ? sgn(s.heroLift) : '—'} | ${bd} | ${reasonOf(s)} |`);
}
out();
out('## モンスターの中身');
out();
out('ゲームのデータ(`ALL_PLAYER_MONSTERS`・`TACTICS_EX_SKILLS`)から、ボットが読んだもの。');
out();
out('| モンスター | ライフ / ちから / 丈夫さ / ガッツ | 勇者特性 | 固有技(倍率・ガッツ) | EX(回数) |');
out('| --- | --- | --- | --- | --- |');
for (const s of stats) {
  const m = s.m;
  const u = m.unique || {};
  const ex = m.ex || {};
  out(`| ${m.name} | ${m.hp} / ${m.atk} / ${m.def} / ${m.guts} | ${m.trait || '—'}: ${(m.traitDesc || '').replace(/^勇者モン選択時：/, '')} | ${u.name || '—'}(×${u.mult ?? '—'}・${u.guts ?? '—'}) | ${ex.name || '—'}: ${ex.note || ''}(${ex.uses ?? '—'}回${ex.perWave ? '/WAVE' : ''}) |`);
}
out();
out('## アシストカードとの相性(その子が入った回で、カードごとの届いた WAVE の伸び。2回以上あるものだけ)');
out();
const withAssist = stats.filter((s) => s.assistRank.length);
if (!withAssist.length) out('- まだ回数が足りません');
for (const s of withAssist) {
  const best = s.assistRank.slice(0, 2).map(([a, v, n]) => `${a} ${sgn(v)}(${n}回)`).join('・');
  const worst = s.assistRank.length > 3 ? s.assistRank.slice(-1).map(([a, v, n]) => `${a} ${sgn(v)}(${n}回)`).join('') : '';
  out(`- **${s.m.name}**: よい ${best}${worst ? ` / よくない ${worst}` : ''}`);
}
out();
out('## バランス調整の案(案だけ。ゲームの数字は変えていません)');
out();
out('回数が5回以上ある子だけ、数字の案を出します。先に「ボットの使い方のせいではないか」を確かめ、疑いがある子は案を出さずに書き分けます。');
out();
const firm = stats.filter((s) => s.n >= 5);
const strong = firm.filter((s) => s.tier === 'S');
const weak = firm.filter((s) => s.tier === 'D' || s.tier === 'C');
let k = 0;
for (const s of strong) {
  k++;
  const m = s.m;
  out(`${k}. **${m.name}が強め(${s.tier})**: ${reasonOf(s)}。`);
  if (s.role === '攻め') out(`   - 案: 固有技の倍率 ×${m.unique.mult} → ×${r1(m.unique.mult * 0.9)}、または ちから ${m.atk} → ${Math.round(m.atk * 0.92)}。ほかの子の出番を奪っていないかを先に見る`);
  else out(`   - 案: EX「${m.ex.name}」の回数 ${m.ex.uses} → ${Math.max(1, Math.round(m.ex.uses * 0.7))}。入っているだけで勝ちやすくなっていないかを先に見る`);
}
for (const s of weak) {
  k++;
  const m = s.m;
  const botDoubt = (s.exChance && !s.exUsed) || (s.heroN === 0 && s.role !== '攻め');
  out(`${k}. **${m.name}が弱め(${s.tier})**: ${reasonOf(s)}。`);
  if (botDoubt) out('   - 案はまだ出しません。ボットがこの子の EX や役割を使いこなせていない疑いがあるので、先にボットの戦い方を直します');
  else if (s.role === '攻め') out(`   - 案: 固有技の消費ガッツ ${m.unique.guts} → ${Math.round(m.unique.guts * 0.8)}、またはライフ ${m.hp} → ${Math.round(m.hp * 1.15)}(打たれ弱さが負けの理由なら、こちら)`);
  else out(`   - 案: EX「${m.ex.name}」の回数 ${m.ex.uses} → ${m.ex.uses + 2}、または丈夫さ ${m.def} → ${Math.round(m.def * 1.15)}`);
}
if (!k) out('- まだ回数が5回以上の子が少なく、数字の案は出せません。いまは集めている途中です');
out();
out('## 集め方(次に回すとき)');
out();
const least = stats.filter((s) => s.heroN === 0).map((s) => s.m.name);
out(`- まだ勇者モンにしていない子: ${least.length ? least.join('・') : 'なし'}`);
out('- `PLAYBOT_TACTICS_ALL=1 PLAYBOT_TACTICS_EXPLORE=1` で、勇者モンを「試した回数の少ない子」から選びます。毎晩の点検(60分まで)で回る分だけ足していきます');
out('- 表を作り直す: `node tools/playbot/tactics-tier.js --md docs/playbot/reports/tier/monster-tier.md`');

const text = lines.join('\n') + '\n';
if (mdFile) {
  fs.mkdirSync(path.dirname(path.resolve(mdFile)), { recursive: true });
  fs.writeFileSync(path.resolve(mdFile), text);
  console.log(`書き出した: ${mdFile}(${tried}/${stats.length}体・${runs.length}回)`);
} else process.stdout.write(text);
