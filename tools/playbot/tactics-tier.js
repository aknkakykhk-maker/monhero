// タクティクスくんの覚え書き(tactics-knowledge.json)と名簿(tactics-roster.json)から、
// 味方モンスターの Tier 表とバランス調整の案を作る。案だけで、ゲームの数字は変えない(決めるのは社長。2026-10-09)。
//
//   node tools/playbot/tactics-tier.js                    画面に出す
//   node tools/playbot/tactics-tier.js --md <file>        Markdown を書き出す(docs/playbot/reports/tier/monster-tier.md)
//
// 集め方: 「すべて解放してバトル」で勇者モンを入れ替えながら少しずつ回す(回数の少ない子から選ぶ)。
//   PLAYBOT_TACTICS_ALL=1 PLAYBOT_TACTICS_EXPLORE=1 PLAYBOT_TACTICS_DIFF=Expert node tools/playbot/playbot.js --only tactics
//
// Tier はステータスだけで決めない(2026-10-09 社長「勇者特性、固有技、EXスキル、適正とか総合したもの」)。
// 6つの項目(攻め・守り・勇者特性・固有技・EX・間合い)をそれぞれ ◎○△ で見て、理由にどれが効いたかを書く。
// - 攻め: 頭割り比(その回のその子のダメージ ÷ 味方の平均。1.0 で人並み)
// - 守り: 打たれ強さ(ライフ×丈夫さ)と、守り役ならその子が入った回の届いた WAVE
// - 勇者特性: 勇者モンにした回の届いた WAVE(難易度の平均との差)と、記録欄に特性の文が出た回数
// - 固有技: 1回の戦いで撃った回数
// - EX: 1回の戦いで使った回数。**一度も使えていない子は Tier を付けず「保留」**(ボットが使いこなせていないため)
// - 間合い: 間合い適性(零・近・中・遠)と、敵のいる間合いが得意(S〜B)だったときに撃てた割合
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const mdAt = args.indexOf('--md');
const mdFile = mdAt >= 0 ? args[mdAt + 1] : '';

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8')); } catch (e) { return d; } };
const roster = readJson('tactics-roster.json', { monsters: [], assists: [] });
const know = readJson('tactics-knowledge.json', { runs: [] });

// 間合い適性はゲームのデータ(data/ally-monsters.js)から直接読む(名簿に無い古い版でも出せるように)
const DIST_BY_NAME = (() => {
  const out = {};
  try {
    const src = fs.readFileSync(path.join(ROOT, 'monster-hero', 'data', 'ally-monsters.js'), 'utf8');
    const re = /name:\s*"([^"]+)"|distAptitude:\s*\[([^\]]*)\]/g;
    let last = null; let m;
    while ((m = re.exec(src))) {
      if (m[1] !== undefined) last = m[1];
      else if (last && !out[last]) out[last] = m[2].replace(/['"\s]/g, '').split(',').slice(0, 4);
    }
  } catch (e) { /* 読めなければ名簿の dist を使う */ }
  return out;
})();
const DIST_JA = ['零', '近', '中', '遠'];
const GOOD_APT = /^[SAB]$/;

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
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—');

// 難易度ごとの平均 WAVE
const diffs = DIFF_ORDER.filter((d) => runs.some((r) => r.difficulty === d));
const meanWave = {};
for (const d of diffs) meanWave[d] = avg(runs.filter((r) => r.difficulty === d).map((r) => r.wave || 0));

// その回に戦った子(ダメージの記録がある子 + 勇者モン + 供モン)
const membersOf = (r) => [...new Set([r.hero, ...(r.allies || []), ...Object.keys(r.dmg || {})].filter(Boolean))];
// その回に、その子の EX を何回使ったか(exBy は 2026-10-09 から。古い回は EX の名前で数える)
const exCountIn = (r, m) => {
  if (r.exBy) return r.exBy[m.name] || 0;
  return sum((r.ex || []).filter((e) => m.ex && m.ex.name && String(e).startsWith(m.ex.name)).map((e) => Number((String(e).match(/×(\d+)$/) || [])[1]) || 1));
};
// 打たれ強さ(ライフ×丈夫さの平方根)の順位を、全員の中の3分の1ずつで分ける
const toughOf = (m) => Math.sqrt((m.hp || 0) * (m.def || 0));
const toughSorted = roster.monsters.filter((m) => m && !m.debugOnly).map(toughOf).sort((a, b) => a - b);
const toughRank = (m) => toughSorted.indexOf(toughOf(m)) / Math.max(1, toughSorted.length - 1);

const stats = roster.monsters.filter((m) => m && !m.debugOnly).map((m) => {
  const dist = DIST_BY_NAME[m.name] || m.dist || null;
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
  // 技の回数と間合い(use は 2026-10-09 から記録している回だけ)
  const useRuns = inRuns.filter((r) => r.use);
  const uses = useRuns.map((r) => r.use[m.name] || { atk: 0, unique: 0, other: 0, apt: {} });
  const uniqueTotal = sum(uses.map((u) => u.unique));
  const aptAll = {};
  for (const u of uses) for (const [g, n] of Object.entries(u.apt || {})) aptAll[g] = (aptAll[g] || 0) + n;
  const aptN = sum(Object.values(aptAll));
  const aptGood = aptN ? sum(Object.entries(aptAll).filter(([g]) => GOOD_APT.test(g)).map(([, n]) => n)) / aptN : NaN;
  const traitRuns = heroRuns.filter((r) => Number.isFinite(r.traitHits));
  const traitTotal = sum(traitRuns.map((r) => r.traitHits));
  const exTotal = sum(inRuns.map((r) => exCountIn(r, m)));
  const role = roleOf(m);
  const share = avg(shares);
  // 勇者モンの回数が少ないうちは、勇者の伸びを軽く見る(1回だけの負けで Tier が大きく動かないように。3回で同じ重さ)
  const parts = [];
  if (role === '攻め' && shares.length) parts.push([(share - 1) * 1.2, 1]);
  if (role !== '攻め' && inRuns.length) parts.push([memberLift / 2, 1]);
  if (heroRuns.length) parts.push([heroLift / 2, Math.min(1, heroRuns.length / 3)]);
  const wsum = sum(parts.map((p) => p[1]));
  const score = wsum ? sum(parts.map((p) => p[0] * p[1])) / wsum : NaN;
  const n = inRuns.length;

  // 6つの項目
  const marks = {};
  marks.攻め = shares.length ? (share >= 1.3 ? '◎' : share >= 0.8 ? '○' : '△') : '—';
  const tr = toughRank(m);
  marks.守り = role === '守り' && inRuns.length ? (memberLift >= 0.5 ? '◎' : '○') : tr >= 0.67 ? '◎' : tr >= 0.33 ? '○' : '△';
  marks.勇者特性 = heroRuns.length ? (heroLift >= 1 ? '◎' : heroLift >= -1 ? '○' : '△') : '—';
  marks.固有技 = useRuns.length ? (uniqueTotal / useRuns.length >= 3 ? '◎' : uniqueTotal / useRuns.length >= 1 ? '○' : '△') : '—';
  marks.EX = n ? (exTotal === 0 ? '未' : exTotal / n >= 2 ? '◎' : '○') : '—';
  const bestApt = dist ? [...dist].sort()[0] : '';
  marks.間合い = Number.isFinite(aptGood) ? (aptGood >= 0.6 ? '◎' : aptGood >= 0.3 ? '○' : '△')
    : dist ? (dist.filter((g) => /^[SA]$/.test(g)).length >= 2 ? '◎' : /^[SAB]$/.test(bestApt) ? '○' : '△') : '—';

  let tier = '未計測';
  if (n && exTotal === 0) tier = '保留';
  else if (Number.isFinite(score)) tier = score >= 0.45 ? 'S' : score >= 0.15 ? 'A' : score >= -0.15 ? 'B' : score >= -0.45 ? 'C' : 'D';
  return { m, dist, role, n, heroN: heroRuns.length, share, shareN: shares.length, heroLift, memberLift, byDiff, assistRank, uniqueTotal, useRuns: useRuns.length, aptGood, aptN, traitTotal, traitRuns: traitRuns.length, exTotal, score, tier, marks, provisional: n < 5 };
});

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', '保留', '未計測'];
stats.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || (b.score || -9) - (a.score || -9) || b.n - a.n);

const KEYS = ['攻め', '守り', '勇者特性', '固有技', 'EX', '間合い'];
const reasonOf = (s) => {
  if (!s.n) return 'まだ一度も戦っていない';
  const good = KEYS.filter((k) => s.marks[k] === '◎');
  const bad = KEYS.filter((k) => s.marks[k] === '△');
  const bits = [];
  if (s.tier === '保留') bits.push(`EX「${s.m.ex.name}」を一度も使えていない(ボットが使いこなせていないので、Tier を付けない)`);
  if (good.length) bits.push(`効いている: ${good.join('・')}`);
  if (bad.length) bits.push(`足りない: ${bad.join('・')}`);
  if (s.role === '攻め' && s.shareN) bits.push(`頭割り比 ${r1(s.share)}`);
  if (s.role !== '攻め') bits.push(`${s.role}役。入った回は平均より WAVE ${sgn(s.memberLift)}`);
  if (s.heroN) bits.push(`勇者モンで WAVE ${sgn(s.heroLift)}(${s.heroN}回)`);
  if (s.m.hp <= 400 && s.heroN && s.heroLift < 0) bits.push(`ライフ ${s.m.hp} で1体の序盤がつらい`);
  if (s.aptN && s.aptGood < 0.3) bits.push(`得意な間合いで撃てたのは ${pct(s.aptGood)}(ボットの置き方・引き寄せを確かめる)`);
  return bits.join(' / ');
};

const lines = [];
const out = (t = '') => lines.push(t);
const now = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ');
const tried = stats.filter((s) => s.n).length;
const measured = runs.filter((r) => r.use).length;
out('# 味方モンスターの Tier 表(タクティクスプロ)');
out();
out(`更新: ${now}(JST)・数えた回: ${runs.length}回(${diffs.map((d) => `${d} ${runs.filter((r) => r.difficulty === d).length}`).join(' / ')})・戦ったモンスター: ${tried} / ${stats.length}体・技と間合いまで数えた回: ${measured}回`);
out();
out('研究所:ハカセくんが作る。タクティクスプロはベースモンを使うので、全員が同じ条件です。');
out('「すべて解放してバトル」(デバッグ。記録・ランキング・報酬はつかない)で、勇者モンを入れ替えながら少しずつ集めています。');
out('**試した回数が5回より少ない子は「暫定」です。** 回数が増えると Tier は動きます。');
out();
out('## Tier の決め方');
out();
out('ステータスだけでは決めません。次の6つを ◎○△ で見て、理由に「どれが効いてその Tier なのか」を書きます(— はまだ数えていない)。');
out();
out('| 項目 | 見るもの |');
out('| --- | --- |');
out('| 攻め | 頭割り比(その回のダメージ ÷ 味方の平均。1.0 で人並み)。◎ 1.3 以上・○ 0.8 以上 |');
out('| 守り | 打たれ強さ(ライフ×丈夫さ。全員の中で上・中・下)。守り役は、その子が入った回の届いた WAVE |');
out('| 勇者特性 | 勇者モンにした回の届いた WAVE(難易度の平均との差)。◎ +1 以上・○ −1 以上。記録欄に特性の文が出た回数も数える |');
out('| 固有技 | 1回の戦いで撃った回数。◎ 3回以上・○ 1回以上 |');
out('| EX | 1回の戦いで使った回数。◎ 2回以上・○ 1回以上・**未 = 一度も使えていない → Tier を付けず「保留」** |');
out('| 間合い | 間合い適性(零・近・中・遠)。数えた回があれば、敵のいる間合いが得意(S〜B)なときに撃てた割合。◎ 6割以上・○ 3割以上 |');
out();
out('点(並べる順と S〜D の線引き): 攻め役は頭割り比と勇者の伸び、守り・支え役は入った回の伸びと勇者の伸び。');
out('S ≥ 0.45 > A ≥ 0.15 > B ≥ −0.15 > C ≥ −0.45 > D。勇者モンにした回が3回より少ないうちは、勇者の伸びを軽く見ます。');
out();
out('## Tier 表');
out();
out('| Tier | モンスター | 役 | 間合い(零近中遠) | 攻め | 守り | 勇者特性 | 固有技 | EX | 間合い | 試した回数(勇者) | 理由 |');
out('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const s of stats) {
  const t = `${s.tier}${s.provisional && s.n && s.tier !== '保留' ? '(暫定)' : ''}`;
  out(`| ${t} | ${s.m.name} | ${s.role} | ${s.dist ? s.dist.join(' ') : '—'} | ${KEYS.map((k) => s.marks[k]).join(' | ')} | ${s.n}(${s.heroN}) | ${reasonOf(s)} |`);
}
out();
out('## 数えた回数');
out();
out('| モンスター | 難易度ごと(回・クリア・最高WAVE) | 頭割り比 | 勇者の伸び | 固有技(回/戦) | EX(回/戦) | 特性の文(回/勇者の戦) | 得意な間合いで撃てた割合 |');
out('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const s of stats.filter((x) => x.n)) {
  const bd = Object.entries(s.byDiff).map(([d, v]) => `${d} ${v.n}回・${v.clear}勝・W${v.best}`).join('<br>') || '—';
  out(`| ${s.m.name} | ${bd} | ${s.shareN ? r1(s.share) : '—'} | ${s.heroN ? sgn(s.heroLift) : '—'} | ${s.useRuns ? `${s.uniqueTotal}(${r1(s.uniqueTotal / s.useRuns)})` : '—'} | ${s.exTotal}(${r1(s.exTotal / s.n)}) | ${s.traitRuns ? `${s.traitTotal}(${r1(s.traitTotal / s.traitRuns)})` : '—'} | ${s.aptN ? `${pct(s.aptGood)}(${s.aptN}発)` : '—'} |`);
}
out();
out('## モンスターの中身');
out();
out('ゲームのデータ(`ALL_PLAYER_MONSTERS`・`TACTICS_EX_SKILLS`)から、ボットが読んだもの。');
out();
out('| モンスター | ライフ / ちから / 丈夫さ / ガッツ | 間合い(零近中遠) | 勇者特性 | 固有技(倍率・ガッツ) | EX(回数) |');
out('| --- | --- | --- | --- | --- | --- |');
for (const s of stats) {
  const m = s.m;
  const u = m.unique || {};
  const ex = m.ex || {};
  out(`| ${m.name} | ${m.hp} / ${m.atk} / ${m.def} / ${m.guts} | ${s.dist ? s.dist.map((g, i) => `${DIST_JA[i]}${g}`).join(' ') : '—'} | ${m.trait || '—'}: ${(m.traitDesc || '').replace(/^勇者モン選択時：/, '')} | ${u.name || '—'}(×${u.mult ?? '—'}・${u.guts ?? '—'}) | ${ex.name || '—'}: ${ex.note || ''}(${ex.uses ?? '—'}回${ex.perWave ? '/WAVE' : ''}) |`);
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
out('回数が5回以上あり、6つの項目をボットが使いこなせている子(EX を使えている・技と間合いまで数えた回がある)だけ、数字の案を出します。');
out('「保留」と、得意な間合いで撃てていない子は、先にボットの戦い方を直します。');
out();
const firm = stats.filter((s) => s.n >= 5 && s.tier !== '保留' && s.useRuns >= 2 && !(s.aptN && s.aptGood < 0.3));
let k = 0;
for (const s of firm.filter((x) => x.tier === 'S')) {
  k++;
  const m = s.m;
  out(`${k}. **${m.name}が強め(${s.tier})**: ${reasonOf(s)}。`);
  if (s.role === '攻め') out(`   - 案: 固有技の倍率 ×${m.unique.mult} → ×${r1(m.unique.mult * 0.9)}、または ちから ${m.atk} → ${Math.round(m.atk * 0.92)}。ほかの子の出番を奪っていないかを先に見る`);
  else out(`   - 案: EX「${m.ex.name}」の回数 ${m.ex.uses} → ${Math.max(1, Math.round(m.ex.uses * 0.7))}。入っているだけで勝ちやすくなっていないかを先に見る`);
}
for (const s of firm.filter((x) => x.tier === 'D' || x.tier === 'C')) {
  k++;
  const m = s.m;
  out(`${k}. **${m.name}が弱め(${s.tier})**: ${reasonOf(s)}。`);
  if (s.marks.守り === '△' && s.heroN && s.heroLift < 0) out(`   - 案: ライフ ${m.hp} → ${Math.round(m.hp * 1.15)}(打たれ弱さが負けの理由のため)`);
  else if (s.role === '攻め') out(`   - 案: 固有技の消費ガッツ ${m.unique.guts} → ${Math.round(m.unique.guts * 0.8)}`);
  else out(`   - 案: EX「${m.ex.name}」の回数 ${m.ex.uses} → ${m.ex.uses + 2}、または丈夫さ ${m.def} → ${Math.round(m.def * 1.15)}`);
}
if (!k) out('- いまは出せる案がありません。技と間合いまで数えた回を集めている途中です(ライガーの案は取り下げ中)');
const held = stats.filter((s) => s.tier === '保留').map((s) => s.m.name);
if (held.length) { out(); out(`保留(ボットの直しが先): ${held.join('・')}`); }
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
