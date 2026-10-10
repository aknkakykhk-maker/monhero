// タクティクスくんの覚え書き(tactics-knowledge.json)と名簿(tactics-roster.json)から、
// 味方モンスターの Tier 表とバランス調整の案を作る。案だけで、ゲームの数字は変えない(決めるのは社長。2026-10-09)。
//
//   node tools/playbot/tactics-tier.js                    画面に出す
//   node tools/playbot/tactics-tier.js --md <file>        Markdown を書き出す(docs/playbot/reports/tier/monster-tier.md)。
//                                                         あわせて tier.json の「モンスター」ほかも書き換える(下)
//   --json <file>  tier.json の置き場所を変える / --no-json  tier.json を書かない
//
// tier.json(社長が見るページ tier-page.js の元)は、2026-10-10 まで人が monster-tier.md から写していた。
// いまはここで書き出す。書き換えるのは 更新・数えた回・戦った体数・全体数・決め方・段・モンスター(1体ずつの Tier・理由・回数・机上)だけで、
// asika-tier.js が書く "アシカ"・"組み合わせ" と、各モンスターの "おすすめアシカ"・"相性のいい供モン"(ほか知らない項目)は消さずに残す
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
// - 間合い: 間合い適性(零・近・中・遠。立っている枠の A +10%・G −20%)と、撃ったときの距離の倍率の平均
//   (立っている枠と敵の距離の差で ×1.5 / 1.3 / 1.1 / 0.9。60-app.jsx の getDmg)
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ROOT = path.resolve(HERE, '..', '..');
const args = process.argv.slice(2);
const mdAt = args.indexOf('--md');
const mdFile = mdAt >= 0 ? args[mdAt + 1] : '';
const jsonAt = args.indexOf('--json');
const jsonFile = args.includes('--no-json') ? '' : (jsonAt >= 0 ? args[jsonAt + 1] : (mdFile ? path.join(ROOT, 'docs', 'playbot', 'reports', 'tier', 'tier.json') : ''));

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
// 16-ranking-and-masu.jsx の DIST_APTITUDE_MULT(間合い適性 → 与ダメージの倍率)
const APT_MULT = { G: 0.8, F: 0.85, E: 0.9, D: 0.95, C: 1.0, B: 1.05, A: 1.1, S: 1.15 };

const DIFF_ORDER = ['Beginner', 'Normal', 'Hard', 'Expert', 'Master', 'Legend'];
// EX の効き目から役割を決める(ダメージで測ってよいかどうかに使う)
const ROLE_BY_EFFECT = {
  coverAll: '守り', partyGuard: '守り', damageBack: '守り',
  lifeSpring: '支え', cookieBox: '支え', partyBoost: '支え', multiBuff: '支え', present: '支え', timeStop: '支え',
};
const roleOf = (m) => ROLE_BY_EFFECT[m && m.ex && m.ex.effect] || '攻め';

// ★同じ版のボットの回どうしで比べる(2026-10-10 改善部 T2)。技と間合いまで記録している回(use)= 勇者モン選び・EX の使い方などを直したあとのボット。
//   それより前の回(昼の Master のモッチー23回など)は、ボットの違いがモンスターの差に見えてしまうので数えない
// アシカを「順番に選ぶ」(r.bot.rotate)で戦った回は、モンスターの Tier に数えない。弱いアシカ(みゃる・ドラなど)から入るので、
// その回の勇者モンが弱く見える(2026-10-10 ダイスくん: ユグドラシル Expert が3回とも WAVE 3 止まりだったわけ)。その回はアシカの記録にだけ使う。
// 供モンを決めて戦った回(r.bot.fixedAllies。おすすめパーティの確かめ)も、強い組み合わせで勇者モンが強く見えるので数えない
const runs = (know.runs || []).filter((r) => r && r.result && r.result !== 'stopped' && DIFF_ORDER.includes(r.difficulty) && r.use && !(r.bot && (r.bot.rotate || r.bot.fixedAllies)));
// ★クリアした回は「WAVE 11 まで届いた」と数える(2026-10-10 改善部 T3)。Hard はほぼ全員が WAVE 10 に届くので、届いた WAVE だけでは差が出ない
const reach = (r) => (r.wave || 0) + (r.result === 'clear' ? 1 : 0);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const avg = (a) => (a.length ? sum(a) / a.length : NaN);
const r1 = (x) => (Number.isFinite(x) ? (Math.round(x * 10) / 10).toFixed(1) : '—');
const sgn = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${r1(x)}` : '—');
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—');

// 難易度ごとの平均 WAVE
const diffs = DIFF_ORDER.filter((d) => runs.some((r) => r.difficulty === d));
const meanWave = {};
for (const d of diffs) meanWave[d] = avg(runs.filter((r) => r.difficulty === d).map(reach));

// その回に戦った子(ダメージの記録がある子 + 勇者モン + 供モン)
// 戦った顔ぶれ。r.allies(選んだつもりの供モン)は、2026-10-10 まで供モン選びの不具合で実際と違う回があった(209回中57回。アリーナくん)。
// 盤面から読んだ r.alliesSeen を先に使い、無い回は dmg・use の名前(盤面から読むので正しい)を使う。どちらも無いときだけ r.allies
const membersOf = (r) => {
  const seen = Array.isArray(r.alliesSeen) ? r.alliesSeen : null;
  const board = [...Object.keys(r.dmg || {}), ...Object.keys(r.use || {})];
  const allies = seen || (board.length ? board : (r.allies || []));
  return [...new Set([r.hero, ...allies].filter(Boolean))];
};
// その回に、その子の EX を何回使ったか(exBy は 2026-10-09 から。古い回は EX の名前で数える)
const exCountIn = (r, m) => {
  if (r.exBy) return r.exBy[m.name] || 0;
  return sum((r.ex || []).filter((e) => m.ex && m.ex.name && String(e).startsWith(m.ex.name)).map((e) => Number((String(e).match(/×(\d+)$/) || [])[1]) || 1));
};
// 打たれ強さ(ライフ×丈夫さの平方根)の順位を、全員の中の3分の1ずつで分ける
const toughOf = (m) => Math.sqrt((m.hp || 0) * (m.def || 0));
const toughSorted = roster.monsters.filter((m) => m && !m.debugOnly).map(toughOf).sort((a, b) => a - b);
const toughRank = (m) => toughSorted.indexOf(toughOf(m)) / Math.max(1, toughSorted.length - 1);

// rs: 数える回(全部、または1つの難易度だけ)
const statsOf = (rs) => roster.monsters.filter((m) => m && !m.debugOnly).map((m) => {
  const dist = DIST_BY_NAME[m.name] || m.dist || null;
  const inRuns = rs.filter((r) => membersOf(r).includes(m.name));
  const heroRuns = rs.filter((r) => r.hero === m.name);
  const shares = [];
  for (const r of inRuns) {
    const d = r.dmg || {};
    const names = Object.keys(d).filter((k) => Number.isFinite(d[k]));
    const tot = sum(names.map((k) => d[k]));
    if (names.length >= 2 && tot > 0 && Number.isFinite(d[m.name])) shares.push(d[m.name] / (tot / names.length));
  }
  const heroDevs = heroRuns.map((r) => reach(r) - meanWave[r.difficulty]);
  const memberDevs = inRuns.map((r) => reach(r) - meanWave[r.difficulty]);
  const heroLift = avg(heroDevs);
  const memberLift = avg(memberDevs);
  // ぶれ(標準誤差の2倍)。2026-10-10 改善部 R1: Tier の決め手がぶれの中かを見るため
  const err2 = (xs) => { if (xs.length < 3) return NaN; const m = avg(xs); return 2 * Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1)) / Math.sqrt(xs.length); };
  const heroErr = err2(heroDevs);
  const memberErr = err2(memberDevs);
  const byDiff = {};
  for (const d of diffs) {
    const rs = inRuns.filter((r) => r.difficulty === d);
    if (!rs.length) continue;
    byDiff[d] = { n: rs.length, hero: rs.filter((r) => r.hero === m.name).length, clear: rs.filter((r) => r.result === 'clear').length, best: Math.max(...rs.map((r) => r.wave || 0)) };
  }
  // アシストカードとの相性: その子が入った回で、カードごとの届いた WAVE の伸び(2回以上あるカードだけ)
  const byAssist = {};
  for (const r of inRuns) for (const a of new Set((r.assists || []).map((x) => String(x).replace(/\+$/, '')))) {
    (byAssist[a] = byAssist[a] || []).push(reach(r) - meanWave[r.difficulty]);
  }
  const assistRank = Object.entries(byAssist).filter(([, v]) => v.length >= 2).map(([a, v]) => [a, avg(v), v.length]).sort((x, y) => y[1] - x[1]);
  // 技の回数と間合い(use は 2026-10-09 から記録している回だけ)
  const useRuns = inRuns.filter((r) => r.use);
  const uses = useRuns.map((r) => r.use[m.name] || { atk: 0, unique: 0, other: 0, apt: {} });
  const uniqueTotal = sum(uses.map((u) => u.unique));
  const aptAll = {};
  const ddAll = {};
  for (const u of uses) {
    for (const [g, n] of Object.entries(u.apt || {})) aptAll[g] = (aptAll[g] || 0) + n;
    for (const [g, n] of Object.entries(u.dd || {})) ddAll[g] = (ddAll[g] || 0) + n;
  }
  const aptN = sum(Object.values(aptAll));
  // 立っていた枠の適性の補正の平均(DIST_APTITUDE_MULT。C で 1.00)
  const aptMult = aptN ? sum(Object.entries(aptAll).map(([g, n]) => (APT_MULT[g] ?? 1) * n)) / aptN : NaN;
  const ddN = sum(Object.values(ddAll));
  const ddMult = ddN ? sum(Object.entries(ddAll).map(([g, n]) => ([1.5, 1.3, 1.1, 0.9][Number(g)] ?? 1) * n)) / ddN : NaN;
  const aptGood = Number.isFinite(aptMult) && Number.isFinite(ddMult) ? aptMult * ddMult : NaN;
  const traitRuns = heroRuns.filter((r) => Number.isFinite(r.traitHits));
  const traitTotal = sum(traitRuns.map((r) => r.traitHits));
  const exTotal = sum(inRuns.map((r) => exCountIn(r, m)));
  const role = roleOf(m);
  const share = avg(shares);
  const shareErr = err2(shares);
  // 勇者モンの回数が少ないうちは、勇者の伸びを軽く見る(1回だけの負けで Tier が大きく動かないように。3回で同じ重さ)
  const parts = [];
  if (role === '攻め' && shares.length) parts.push([(share - 1) * 1.2, 1, '頭割り比', share - 1, shareErr]);
  if (role !== '攻め' && inRuns.length) parts.push([memberLift / 2, 1, '入った回の伸び', memberLift, memberErr]);
  if (heroRuns.length) parts.push([heroLift / 2, Math.min(1, heroRuns.length / 3), '勇者モンにした回の伸び', heroLift, heroErr]);
  // 点の決め手(重みのある項目)のどれか1つでも、ぶれを超えているか
  const sigAny = parts.some((p) => Number.isFinite(p[4]) && Math.abs(p[3]) > p[4]);
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
  // 間合い: 実戦の「適性の補正 × 距離の倍率」の平均。◎ 1.4 以上(ほぼ同じ距離で、得意な枠から)・○ 1.2 以上
  marks.間合い = Number.isFinite(aptGood) ? (aptGood >= 1.4 ? '◎' : aptGood >= 1.2 ? '○' : '△')
    : dist ? (dist.filter((g) => /^[SA]$/.test(g)).length >= 2 ? '◎' : /^[SAB]$/.test(bestApt) ? '○' : '△') : '—';

  let tier = '未計測';
  if (n && exTotal === 0) tier = '保留';
  else if (Number.isFinite(score)) tier = score >= 0.45 ? 'S' : score >= 0.15 ? 'A' : score >= -0.15 ? 'B' : score >= -0.45 ? 'C' : 'D';
  return { m, dist, role, n, heroN: heroRuns.length, share, shareN: shares.length, heroLift, memberLift, byDiff, assistRank, uniqueTotal, useRuns: useRuns.length, aptGood, aptN, traitTotal, traitRuns: traitRuns.length, exTotal, score, tier, marks, provisional: n < 5, parts, sigAny, heroErr, memberErr, shareErr };
});

const TIER_ORDER = ['S', 'A', 'B', 'C', 'D', '保留', '未計測'];
const stats = statsOf(runs);
// 難易度ごとの Tier(2026-10-09 社長「難易度によって結構Tierも変わる」)。1つにまとめない
const TIER_DIFFS = ['Hard', 'Expert', 'Master'];
// 机上の数字(sim/desk.js)。読めなければ空のまま
let deskByName = {};
try { process.argv.push('--diff', TIER_DIFFS.join(',')); deskByName = Object.fromEntries(require('./sim/desk').rows.map((r) => [r.m.name, r])); } catch (e) { deskByName = {}; }
const statsByDiff = Object.fromEntries(TIER_DIFFS.map((d) => [d, statsOf(runs.filter((r) => r.difficulty === d))]));
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
  const goodDists = (s.dist || []).map((g, i) => (GOOD_APT.test(g) ? DIST_JA[i] : '')).filter(Boolean);
  if (s.dist && goodDists.length === 1) bits.push(`得意な間合いが${goodDists[0]}だけ(勇者モンなら${goodDists[0]}へ置けるが、供モンでは空いた枠しか選べない)`);
  if (s.aptN && s.aptGood < 1.2) bits.push(`間合いの倍率が平均 ×${s.aptGood.toFixed(2)}(敵と離れて撃っている。ボットの置き方・引き寄せを確かめる)`);
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
out('**総合 Tier は、その難易度で5回以上試したマスが2つ以上そろうまで「暫定」です。** 5回以上のマスが1つも無い子は「回数不足」として総合を付けません。回数が増えると Tier は動きます。');
out();
// ---------- 社長室(iPhone)向けの上の3節(2026-10-10 社長「見づらい。総合的なTierもほしい」) ----------
// 総合 Tier: 難易度ごとの点を Hard 0.4・Expert 0.4・Master 0.2 で重みづけ(Master はいまボットの戦い方の差が大きいので軽く見る)
const DIFF_WEIGHT = { Hard: 0.2, Expert: 0.5, Master: 0.3 }; // 2026-10-10 改善部 T3: Hard は差が出にくいので軽く
// 決め方の文は md と tier.json(→ tier.html)の両方へ、ここから同じものを書く(2026-10-10 改善部 W2: 2か所に手で書くと片方だけ古くなる)
const HOW_TEXT = [
  `決め方: 難易度ごとの点(下の「Tier の決め方」)を ${Object.entries(DIFF_WEIGHT).map(([d, w]) => `${d} ${Math.round(w * 10)}`).join('・')} の重みで合わせる。Hard はほぼ全員が最後の WAVE まで届くので、クリアしたかどうか(クリアは WAVE 11 と数える)だけで差が付き、重みを軽くしている。`,
  '数えるのは、直したボット(勇者モン選び・EX の使い方を直したあと)で戦った回だけ。固有技・EX・勇者特性・間合いを使えた回の成績で見る(EX を一度も使えていない子は保留)。',
];
const PROVISIONAL_TEXT = 'その難易度で5回未満のマスは「*」で、総合には数えない。5回以上のマスが2つ以上ない子は「暫定」、5回以上のマスが1つも無い子は「回数不足」(総合はまだ付けず、* のマスから出した仮の Tier を添える)。回数が増えると Tier は動きます。';
// まだ Tier の数字に効いていない機能(社長 2026-10-10「機能的なものも全て把握した上で」)。一覧の正本は mechanics.md の
// 「入っていない・一部」の節。ここで読んで、md と tier.json(→ ページ)の決め方の文へ同じものを足す
const MISSING_MECHANICS = (() => {
  try {
    const t = fs.readFileSync(path.join(ROOT, 'docs', 'playbot', 'reports', 'tier', 'mechanics.md'), 'utf8');
    const sec = (t.split(/^## 入っていない・一部.*$/m)[1] || '').split(/^## /m)[0];
    return [...sec.matchAll(/^\d+\. \*\*(.+?)\*\*/gm)].map((m) => m[1]);
  } catch (e) { return []; }
})();
if (MISSING_MECHANICS.length) HOW_TEXT.push(`まだ入れていない・一部だけの機能(シミュレーターかボットに無く、Tier の数字に効いていないもの。効きの大きい順): ${MISSING_MECHANICS.join('・')}。機能の一覧は docs/playbot/reports/tier/mechanics.md。`);
// ボットの EX の使い方が下手な子(シミュレーターの「上手 − ボット」の平均が 0.2 WAVE 以上。sim.md の「EX の使い方」の表)は、
// 直したボット(記録に r.bot がある回。2026-10-10 アリーナくん #2528 から)で勇者モンにした回が5回たまるまで「暫定」にする
// (2026-10-10 統括部長: エイキが直す前のボットの回だけで C に確定した件)
const BOT_WEAK_GAP = 0.2;
const BOT_FIXED_NEED = 5;
const botWeak = (() => {
  try {
    const t = fs.readFileSync(path.join(ROOT, 'docs', 'playbot', 'reports', 'tier', 'sim.md'), 'utf8');
    const sec = (t.split(/^## EX の使い方.*$/m)[1] || '').split(/^## /m)[0];
    const out = {};
    for (const line of sec.split('\n')) {
      const c = line.split('|').slice(1, -1).map((x) => x.trim());
      if (c.length >= 6 && Number.isFinite(Number(c[c.length - 1]))) out[c[0]] = Number(c[c.length - 1]);
    }
    return out;
  } catch (e) { return {}; }
})();
const fixedBotHeroRuns = (name) => runs.filter((r) => r.hero === name && r.bot).length;
HOW_TEXT.push(`ボットの EX の使い方が下手な子(シミュレーターで「上手な使い方 − ボット」が平均 ${BOT_WEAK_GAP} WAVE 以上)は、直したボット(2026-10-10 から)で勇者モンにした回が ${BOT_FIXED_NEED} 回たまるまで「暫定」。`);
const tierOfScore = (sc) => (sc >= 0.45 ? 'S' : sc >= 0.15 ? 'A' : sc >= -0.15 ? 'B' : sc >= -0.45 ? 'C' : 'D');
const overall = stats.map((s) => {
  const per = TIER_DIFFS.map((d) => ({ d, x: statsByDiff[d].find((y) => y.m.name === s.m.name) })).filter((v) => v.x && v.x.n);
  const measured = per.filter((v) => v.x.tier !== '保留' && Number.isFinite(v.x.score));
  // 暫定のマス(その難易度で5回未満)は総合に数えない。暫定しか無い子は、暫定のマスで出して「暫定」と書く(改善部 T2)
  const firmCells = measured.filter((v) => !v.x.provisional);
  // 数えるマス(5回以上)が1つも無い子は、総合を付けない(「回数不足」。2026-10-10 改善部 T4)。仮の Tier は * のマスから出して添える
  const usable = firmCells.length ? firmCells : [];
  const guess = measured.length && !firmCells.length ? tierOfScore(measured.reduce((a, v) => a + v.x.score * DIFF_WEIGHT[v.d], 0) / measured.reduce((a, v) => a + DIFF_WEIGHT[v.d], 0)) : '';
  const n = per.reduce((a, v) => a + v.x.n, 0);
  let tier = '未計測';
  let score = NaN;
  if (per.length && !measured.length) tier = '保留';
  else if (per.length && !usable.length) tier = '回数不足';
  else if (usable.length) {
    const w = usable.reduce((a, v) => a + DIFF_WEIGHT[v.d], 0);
    score = usable.reduce((a, v) => a + v.x.score * DIFF_WEIGHT[v.d], 0) / w;
    tier = tierOfScore(score);
  }
  const short = (d) => { const v = per.find((q) => q.d === d); return v ? `${v.x.tier.replace('未計測', '—')}${v.x.provisional && v.x.tier !== '保留' ? '*' : ''}` : '—'; };
  const gap = botWeak[s.m.name];
  const weakBot = Number.isFinite(gap) && gap >= BOT_WEAK_GAP && fixedBotHeroRuns(s.m.name) < BOT_FIXED_NEED;
  // 決め手がぶれの中(数えたマスのどれにも、ぶれを超える項目が無い)なら「暫定」(2026-10-10 改善部 R1)
  const noisy = !!usable.length && !usable.some((v) => v.x.sigAny) && !['回数不足', '保留'].includes(tier);
  return { s, tier, score, n, provisional: firmCells.length < 2 || weakBot || noisy, weakBot, noisy, usable, botGap: gap, short, guess };
});
const OVERALL_ORDER = ['S', 'A', 'B', 'C', 'D', '回数不足', '保留', '未計測'];
overall.sort((a, z) => OVERALL_ORDER.indexOf(a.tier) - OVERALL_ORDER.indexOf(z.tier) || (z.score || -9) - (a.score || -9));
// ひとことの理由(30字くらい): 効いている項目と足りない項目、打たれ弱さ・保留の事情
const oneLine = (o) => {
  const s = o.s;
  if (!s.n) return 'まだ戦っていない';
  if (o.tier === '保留') return 'EX をまだ使えていない。ボットを直して測り直す';
  if (o.tier === '回数不足') return `回数が足りない(仮${o.guess})。いま回数を足している`;
  const good = KEYS.filter((k) => s.marks[k] === '◎').slice(0, 2);
  const bad = KEYS.filter((k) => s.marks[k] === '△').slice(0, 2);
  const bits = [];
  if (good.length) bits.push(`${good.join('・')}が効く`);
  if (bad.length) bits.push(`${bad.join('・')}が弱い`);
  if (s.m.hp <= 350) bits.push('打たれ弱く序盤がつらい');
  return bits.join('。') || 'どの項目も人並み';
};
out('## 総合 Tier');
out();
for (const t of ['S', 'A', 'B', 'C', 'D']) {
  const xs = overall.filter((o) => o.tier === t);
  if (xs.length) out(`- **${t}** ${xs.map((o) => `${o.s.m.name}${o.provisional ? '(暫定)' : ''}`).join('・')}`);
}
const few = overall.filter((o) => o.tier === '回数不足');
if (few.length) { out(); out(`回数不足(どの難易度も5回未満なので、総合はまだ付けない。かっこは * のマスから出した仮の Tier): ${few.map((o) => `${o.s.m.name}(仮${o.guess})`).join('・')}`); }
const weakAll = overall.filter((o) => o.weakBot && !['回数不足', '保留', '未計測'].includes(o.tier));
if (weakAll.length) { out(); out(`ボットの EX の使い方が下手なので、直したボットの回が${BOT_FIXED_NEED}回たまるまで暫定: ${weakAll.map((o) => `${o.s.m.name}(上手 − ボット +${o.botGap.toFixed(2)}・直したボット ${fixedBotHeroRuns(o.s.m.name)}回)`).join('・')}`); }
const heldAll = overall.filter((o) => o.tier === '保留');
if (heldAll.length) { out(); out(`保留(EX をまだ使えていない): ${heldAll.map((o) => o.s.m.name).join('・')}`); }
out();
for (const t of HOW_TEXT) out(t);
out(PROVISIONAL_TEXT);
out();
out('## 早見表');
out();
out('* は、その難易度で5回未満(暫定。総合には数えない)。');
out();
out('| モンスター | 総合 | Hard | Expert | Master |');
out('| --- | --- | --- | --- | --- |');
for (const o of overall) out(`| ${o.s.m.name} | ${o.tier.replace('未計測', '—').replace('回数不足', '不足')} | ${o.short('Hard')} | ${o.short('Expert')} | ${o.short('Master')} |`);
out();
out('## ひとことの理由');
out();
for (const o of overall) out(`- **${o.s.m.name}**: ${oneLine(o)}`);
out();
function emitHowTo() {
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
  out('| 間合い | 間合い適性(零・近・中・遠。立っている枠で A +10%・G −20%)。数えた回があれば、撃ったときの「適性の補正 × 距離の倍率(敵との距離の差で ×1.5 / 1.3 / 1.1 / 0.9)」の平均。◎ 1.4 以上・○ 1.2 以上 |');
  out();
  out('点(並べる順と S〜D の線引き): 攻め役は頭割り比と勇者の伸び、守り・支え役は入った回の伸びと勇者の伸び。');
  out('S ≥ 0.45 > A ≥ 0.15 > B ≥ −0.15 > C ≥ −0.45 > D。勇者モンにした回が3回より少ないうちは、勇者の伸びを軽く見ます。');
  out();
}
out('## 難易度ごとの Tier(回数つき)');
out();
out('難易度で敵の火力とライフが大きく違うので、難易度ごとにも付けます。マスの数字は「試した回数(勇者モンにした回数)」。');
out('2段以上動いた子は、理由を1行で書きます。');
out();
out('| モンスター | Hard | Expert | Master | 動いた理由 |');
out('| --- | --- | --- | --- | --- |');
const TIER_STEP = { S: 0, A: 1, B: 2, C: 3, D: 4 };
for (const s of stats) {
  const cells = TIER_DIFFS.map((d) => {
    const x = statsByDiff[d].find((y) => y.m.name === s.m.name);
    if (!x || !x.n) return '—';
    return `${x.tier}${x.provisional && x.tier !== '保留' ? '(暫定)' : ''} ${x.n}(${x.heroN})`;
  });
  const steps = TIER_DIFFS.map((d) => statsByDiff[d].find((y) => y.m.name === s.m.name)).filter((x) => x && x.n && TIER_STEP[x.tier] != null).map((x) => TIER_STEP[x.tier]);
  let why = '';
  if (steps.length >= 2 && Math.max(...steps) - Math.min(...steps) >= 2) {
    const m = s.m;
    const bits = [];
    if (m.hp <= 400) bits.push(`ライフ ${m.hp}。敵の火力が上がると、打たれ弱さが効いてくる`);
    if (m.guts <= 90) bits.push(`ガッツ上限 ${m.guts}。敵のライフが増えると、撃てる回数の少なさが効いてくる`);
    if (!bits.length) bits.push('回数が少なく、ぶれている可能性(回数を増やして確かめる)');
    why = bits.join(' / ');
  }
  out(`| ${s.m.name} | ${cells.join(' | ')} | ${why} |`);
}
out();
out('## 机上の数字');
out();
out('sim/desk.js(ゲームの式・素のベースモン)から。「受けられる」は WAVE 1 の敵の通常攻撃を何発受けられるか(Hard・Expert・Master)。');
out();
out('| モンスター | 通常技1発 | 20ターンの火力 | 受けられる |');
out('| --- | --- | --- | --- |');
for (const s of stats) {
  const dr = deskByName[s.m.name];
  if (!dr) continue;
  out(`| ${s.m.name} | ${Math.round(dr.nHit)} | ${dr.dmg20.toLocaleString()} | ${TIER_DIFFS.map((d) => (dr.byDiff[d] ? dr.byDiff[d].w1Hits : '—')).join('・')} |`);
}
out();
// 勇者モンの初期スタイル(剣士モッチー)ごとの成績。heroStyle が無い回は片手剣(2026-10-09 まで、ボットは選んでいなかった)
const STYLE_JA = { sword: '片手剣', shield: '片手盾', dual: '二刀流' };
const styleHeroes = [...new Set(runs.filter((r) => r.heroStyle).map((r) => r.hero))];
if (!styleHeroes.includes('剣士モッチー')) styleHeroes.push('剣士モッチー');
out('## 勇者モンの初期スタイルごとの成績');
out();
out('剣士モッチーは勇者モンにしたときだけ、配置の画面で初期スタイル(片手剣・片手盾・二刀流)を選べます。2026-10-09 までの回は、ボットが選ばずに片手剣で始めていました。');
out();
out('| 勇者モン | 難易度 | スタイル | 回数 | クリア | 届いた WAVE の平均 |');
out('| --- | --- | --- | --- | --- | --- |');
for (const hero of styleHeroes) {
  for (const d of TIER_DIFFS) {
    for (const st of ['sword', 'shield', 'dual']) {
      const rs = runs.filter((r) => r.hero === hero && r.difficulty === d && (r.heroStyle || 'sword') === st);
      if (!rs.length) continue;
      out(`| ${hero} | ${d} | ${STYLE_JA[st]} | ${rs.length} | ${rs.filter((r) => r.result === 'clear').length} | ${r1(avg(rs.map((r) => r.wave || 0)))} |`);
    }
  }
}
for (const hero of styleHeroes) {
  const bests = TIER_DIFFS.map((d) => {
    const rows = ['sword', 'shield', 'dual'].map((st) => {
      const rs = runs.filter((r) => r.hero === hero && r.difficulty === d && (r.heroStyle || 'sword') === st);
      return { st, n: rs.length, clear: rs.filter((r) => r.result === 'clear').length / Math.max(1, rs.length), wave: avg(rs.map((r) => r.wave || 0)) };
    }).filter((x) => x.n >= 2);
    if (rows.length < 2) return '';
    const b = rows.sort((x, z) => z.clear - x.clear || z.wave - x.wave)[0];
    return `${d} は${STYLE_JA[b.st]}(クリア ${Math.round(b.clear * 100)}%・WAVE 平均 ${r1(b.wave)})`;
  }).filter(Boolean);
  if (bests.length) out(`- **${hero}** のいちばんよいスタイル: ${bests.join(' / ')}。Tier は難易度ごとに、このスタイルで戦えた前提で見る`);
}
out();
out('## 6項目の中身と理由(全難易度を混ぜて数えたもの)');
out();
out('Tier は上の「総合 Tier」と「難易度ごとの Tier」だけ。ここは中身(6項目)と理由。6項目は 攻め・守り・勇者特性・固有技・EX・間合い の順(◎○△、— はまだ数えていない、未 は EX を一度も使えていない)。');
out();
out('| モンスター | 役 | 6項目 | 回数(勇者) | 理由 |');
out('| --- | --- | --- | --- | --- |');
for (const s of stats) {
  out(`| ${s.m.name} | ${s.role} | ${KEYS.map((k) => s.marks[k]).join('')} | ${s.n}(${s.heroN}) | ${reasonOf(s)} |`);
}
out();
out('## 数えた回数');
out();
out('| モンスター | 難易度ごと(回・クリア・最高WAVE) | 頭割り比 | 勇者の伸び | 固有技(回/戦) | EX(回/戦) | 特性の文(回/勇者の戦) | 間合いの倍率(平均) |');
out('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const s of stats.filter((x) => x.n)) {
  const bd = Object.entries(s.byDiff).map(([d, v]) => `${d} ${v.n}回・${v.clear}勝・W${v.best}`).join('<br>') || '—';
  out(`| ${s.m.name} | ${bd} | ${s.shareN ? r1(s.share) : '—'} | ${s.heroN ? sgn(s.heroLift) : '—'} | ${s.useRuns ? `${s.uniqueTotal}(${r1(s.uniqueTotal / s.useRuns)})` : '—'} | ${s.exTotal}(${r1(s.exTotal / s.n)}) | ${s.traitRuns ? `${s.traitTotal}(${r1(s.traitTotal / s.traitRuns)})` : '—'} | ${s.aptN && Number.isFinite(s.aptGood) ? `×${s.aptGood.toFixed(2)}(${s.aptN}発)` : '—'} |`);
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
out('## 調整の候補(機械が出したもの。社長へはまだ出さない)');
out();
out('**素の性能と実戦の点だけで機械的に出した候補です。** 2026-10-10 の社長の決まりで、調整の案はスキル(固有技の効果・EX・勇者特性・適性)を入れたシミュレーターで測り直してから、1件ずつ社長へ出します。ここにあるものは、その測り直しの順番を決めるための候補です。');
out();
out('回数が5回以上あり、6つの項目をボットが使いこなせている子(EX を使えている・技と間合いまで数えた回がある)だけ、数字の案を出します。');
out('「保留」と、敵と離れたまま撃っている子(間合いの倍率が ×1.2 未満)は、先にボットの戦い方を直します。');
out();
const firm = stats.filter((s) => s.n >= 5 && s.tier !== '保留' && s.useRuns >= 2 && !(s.aptN && s.aptGood < 1.2));
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
emitHowTo();
out('## 集め方(次に回すとき)');
out();
const least = stats.filter((s) => s.heroN === 0).map((s) => s.m.name);
out(`- まだ勇者モンにしていない子: ${least.length ? least.join('・') : 'なし'}`);
out('- `PLAYBOT_TACTICS_ALL=1 PLAYBOT_TACTICS_EXPLORE=1` で、勇者モンを「試した回数の少ない子」から選びます。毎晩の点検(60分まで)で回る分だけ足していきます');
out('- 表を作り直す: `node tools/playbot/tactics-tier.js --md docs/playbot/reports/tier/monster-tier.md`');

let text = lines.join('\n') + '\n';

// ---------- 根拠(2026-10-10 社長「タップしたらその詳細を出すようにして。ちゃんと根拠があるように」) ----------
// 全項目に共通の形 { 出どころ, 回数, 数字[{名前,値,基準,差,ぶれ}], 効いている機能[], だから, まだ分からない }。
// 数字は実戦の記録(runs)からだけ作る。言えないことは書かず、分からないところは「まだ分からない」に理由つきで書く
const MECH_NAMES = (() => {
  try {
    const t = fs.readFileSync(path.join(ROOT, 'docs', 'playbot', 'reports', 'tier', 'mechanics.md'), 'utf8');
    return t.split('\n').filter((l) => /^\| [^-|]/.test(l)).map((l) => l.split('|')[1].trim()).filter((x) => x && x !== '機能');
  } catch (e) { return []; }
})();
const mechOf = (prefix) => MECH_NAMES.find((x) => x.startsWith(prefix)) || '';
const pctOf = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const sgnInt = (x) => `${x >= 0 ? '+' : ''}${Math.round(x)}`;
const sd = (xs) => { const m = avg(xs); return xs.length > 1 ? Math.sqrt(sum(xs.map((x) => (x - m) ** 2)) / (xs.length - 1)) : NaN; };
const clearRate = {};
for (const d of diffs) { const rs = runs.filter((r) => r.difficulty === d); clearRate[d] = rs.length ? rs.filter((r) => r.result === 'clear').length / rs.length : NaN; }
function evidenceOf(o) {
  const s = o.s;
  const name = s.m.name;
  const inRuns = runs.filter((r) => membersOf(r).includes(name));
  const per = TIER_DIFFS.map((d) => [d, inRuns.filter((r) => r.difficulty === d)]);
  const heroN = inRuns.filter((r) => r.hero === name).length;
  const rows = [];
  for (const [d, rs] of per) {
    if (!rs.length) continue;
    if (d === 'Hard') {
      const c = rs.filter((r) => r.result === 'clear').length;
      const p = c / rs.length; const base = clearRate[d];
      const err = 2 * Math.sqrt(Math.max(0.0001, p * (1 - p)) / rs.length);
      rows.push({ 名前: 'Hard のクリア率', 値: `${pctOf(c, rs.length)}(${rs.length}回中${c}回)`, 基準: `全員の平均 ${Math.round(base * 100)}%`, 差: `${sgnInt((p - base) * 100)} ポイント`, ぶれ: `±${Math.round(err * 100)} ポイント` });
    } else {
      const ws = rs.map(reach); const a = avg(ws); const e = sd(ws);
      rows.push({ 名前: `${d} の届いた WAVE(平均)`, 値: `${r1(a)}(${rs.length}回・最高 ${Math.max(...rs.map((r) => r.wave || 0))})`, 基準: `全員の平均 ${r1(meanWave[d])}`, 差: `${sgn(a - meanWave[d])} WAVE`, ぶれ: Number.isFinite(e) ? `±${r1((2 * e) / Math.sqrt(ws.length))} WAVE` : '1回だけ' });
    }
  }
  const heroDev = inRuns.filter((r) => r.hero === name).map((r) => reach(r) - meanWave[r.difficulty]);
  const heroErr = heroDev.length > 1 ? (2 * sd(heroDev)) / Math.sqrt(heroDev.length) : NaN;
  if (heroN && Number.isFinite(s.heroLift)) rows.push({ 名前: '勇者モンにした回の伸び', 値: `WAVE ${sgn(s.heroLift)}(${heroN}回)`, 基準: 'その難易度の全員の平均', 差: `${sgn(s.heroLift)} WAVE`, ぶれ: Number.isFinite(heroErr) ? `±${r1(heroErr)} WAVE` : '1回だけ' });
  if (Number.isFinite(o.score)) {
    const bits = (o.usable || []).map((v) => `${v.d} ${sgn(v.x.score)}×重み${Math.round(DIFF_WEIGHT[v.d] * 10)}(${(v.x.parts || []).map((p) => `${p[2]} ${sgn(p[3])}${Number.isFinite(p[4]) ? `±${r1(p[4])}` : ''}`).join('・')})`);
    rows.push({ 名前: 'Tier の点の内訳', 値: `${sgn(o.score)} → ${o.tier}`, 基準: bits.join(' / ') + '。S 0.45 以上・A 0.15・B −0.15・C −0.45 以上', 差: '', ぶれ: '' });
  }
  const feats = [];
  if (s.marks.攻め === '◎') feats.push(mechOf('ダメージの式'));
  if (s.marks.守り === '◎') feats.push(mechOf('被ダメージの式'));
  if (s.marks.勇者特性 === '◎' && s.m.trait) feats.push(mechOf(s.m.trait) || s.m.trait);
  if (s.marks.固有技 === '◎') feats.push(mechOf('固有技の効果'));
  if (s.marks.EX === '◎') feats.push(mechOf('EX('));
  if (s.marks.間合い === '◎') feats.push(mechOf('間合い適性'));
  if (s.role !== '攻め' && Number.isFinite(s.memberLift) && inRuns.length >= 2) rows.push({ 名前: '入った回の伸び', 値: `WAVE ${sgn(s.memberLift)}(${inRuns.length}回)`, 基準: 'その難易度の全員の平均', 差: `${sgn(s.memberLift)} WAVE`, ぶれ: Number.isFinite(s.memberErr) ? `±${r1(s.memberErr)} WAVE` : '1回だけ' });
  if (s.role === '攻め' && s.shareN >= 2) rows.push({ 名前: 'ダメージの頭割り比', 値: `${r1(s.share)} 倍(${s.shareN}回)`, 基準: '1.0 倍(同じ回の味方の平均)', 差: `${sgn(s.share - 1)} 倍`, ぶれ: Number.isFinite(s.shareErr) ? `±${r1(s.shareErr)} 倍` : '1回だけ' });
  const so = []; // だから
  const liftClear = Number.isFinite(heroErr) && Math.abs(s.heroLift) > heroErr;
  if (heroN >= 3 && Number.isFinite(s.heroLift) && !liftClear) so.push(`勇者モンにした回の伸び(WAVE ${sgn(s.heroLift)})は、ぶれ(±${r1(heroErr)})の中で、平均と差があるとはまだ言えない`);
  else if (heroN >= 3 && Number.isFinite(s.heroLift)) so.push(s.heroLift >= 0.5 ? `勇者モンにすると平均より WAVE ${sgn(s.heroLift)} 先まで届く。勇者モンの候補に入れてよい` : s.heroLift <= -0.5 ? `勇者モンにすると平均より WAVE ${r1(s.heroLift)}。勇者モンより供モンで使うほうがよい` : '勇者モンにしても平均とほぼ同じ');
  if (s.role !== '攻め' && Number.isFinite(s.memberLift) && inRuns.length >= 5) so.push(Number.isFinite(s.memberErr) && Math.abs(s.memberLift) > s.memberErr ? `入った回は平均より WAVE ${sgn(s.memberLift)}(${s.role}役)。${s.memberLift > 0 ? '供モンに入れると伸びる' : '供モンに入れると下がる'}` : `入った回の伸び(WAVE ${sgn(s.memberLift)})は、ぶれ(±${r1(s.memberErr)})の中で、まだ言えない`);
  if (s.role === '攻め' && s.shareN >= 5) { const sig = Number.isFinite(s.shareErr) && Math.abs(s.share - 1) > s.shareErr; so.push(`ダメージは頭割りの ${r1(s.share)} 倍(${s.shareN}回)。${!sig ? 'ぶれの中で、火力が多い・少ないとはまだ言えない' : s.share >= 1.2 ? '火力の柱にできる' : s.share < 0.8 ? '火力は控えめ' : '火力はふつう'}`); }
  if (Number.isFinite(o.score) && !o.noisy) {
    const keys = (o.usable || []).flatMap((v) => (v.x.parts || []).filter((p) => Number.isFinite(p[4]) && Math.abs(p[3]) > p[4]).map((p) => `${v.d} の${p[2]} ${sgn(p[3])}(ぶれ ±${r1(p[4])})`));
    if (keys.length) so.unshift(`${o.tier} の決め手: ${keys.join('・')}`);
  }
  const unknown = [];
  const thin = per.filter(([, rs]) => rs.length && rs.length < 5).map(([d, rs]) => `${d} ${rs.length}回`);
  if (thin.length) unknown.push(`回数が5回に届かない難易度がある(${thin.join('・')})`);
  if (o.weakBot) unknown.push(`ボットの EX の使い方がシミュレーターの上手な使い方より WAVE ${r1(o.botGap)} 低いので、直したボットの回(いま ${fixedBotHeroRuns(name)}回)がたまるまで本当の強さは分からない`);
  if (s.tier === '保留') unknown.push('EX を一度も使えていないので Tier を付けていない');
  if (o.noisy) unknown.push(`Tier の点の決め手(上の内訳)がどれもぶれの中なので、${o.tier} は仮(暫定)。回数が増えると動く`);
  const byDiffN = per.filter(([, rs]) => rs.length).map(([d, rs]) => `${d} ${rs.length}`).join('・');
  return {
    出どころ: '実戦',
    回数: inRuns.length ? `実戦 ${inRuns.length}回(${byDiffN}。勇者モンで ${heroN}回)` : 'まだ戦っていない',
    数字: rows,
    効いている機能: [...new Set(feats.filter(Boolean))],
    だから: so.join('。') || (inRuns.length ? '' : 'まだ戦っていない'),
    まだ分からない: unknown.join('。'),
  };
}

// md にもページの詳細と同じ根拠を出す(W2: 同じ元データから)
{
  const L = ['', '## 根拠(ページの詳細と同じ)', '', '各モンスターの「根拠」。数字は実戦の記録から。ぶれは ±(標準誤差の2倍)。差がぶれより小さいときは、平均と差があるとはまだ言えない。', ''];
  for (const o of overall) {
    const e = evidenceOf(o);
    L.push(`### ${o.s.m.name}(${o.tier === '未計測' ? '回数不足' : o.tier}${o.provisional && !['回数不足', '保留'].includes(o.tier) ? '・暫定' : ''})`, '');
    L.push(`- 出どころ: ${e.出どころ}。${e.回数}`);
    for (const x of e.数字) L.push(`- ${x.名前}: ${x.値}${x.基準 ? `/ 基準 ${x.基準}` : ''}${x.差 ? `/ 差 ${x.差}` : ''}${x.ぶれ ? `/ ぶれ ${x.ぶれ}` : ''}`);
    if (e.効いている機能.length) L.push(`- 効いている機能: ${e.効いている機能.join('・')}`);
    if (e.だから) L.push(`- だから: ${e.だから}`);
    if (e.まだ分からない) L.push(`- まだ分からない: ${e.まだ分からない}`);
    L.push('');
  }
  text += L.join('\n');
}

// ---------- tier.json(tier-page.js が読む形。項目名は日本語) ----------
// 強み・弱みは「ひとことの理由」を「。」で分けたもの(「〜が効く」→ 強み、それ以外 → 弱み。人が写していたときと同じ分け方)
function tierJson(prev) {
  const sorted = overall;
  const diffCell = (o, d) => statsByDiff[d].find((y) => y.m.name === o.s.m.name);
  const mons = sorted.map((o) => {
    const reason = oneLine(o);
    const parts = reason.split('。').filter(Boolean);
    const good = parts.filter((t) => /が効く$/.test(t)).map((t) => t.replace(/が効く$/, ''));
    const bad = parts.filter((t) => !/が効く$/.test(t)).map((t) => t.replace(/が弱い$/, ''));
    const s = o.s;
    const cell = Object.fromEntries(TIER_DIFFS.map((d) => { const x = diffCell(o, d); return [d, x && x.n ? x.tier.replace('未計測', '—') : '—']; }));
    // 動いた理由(上の「難易度ごとの Tier」の表と同じ決め方)
    const steps = TIER_DIFFS.map((d) => diffCell(o, d)).filter((x) => x && x.n && TIER_STEP[x.tier] != null).map((x) => TIER_STEP[x.tier]);
    let why = '';
    if (steps.length >= 2 && Math.max(...steps) - Math.min(...steps) >= 2) {
      const bits = [];
      if (s.m.hp <= 400) bits.push(`ライフ ${s.m.hp}。敵の火力が上がると、打たれ弱さが効いてくる`);
      if (s.m.guts <= 90) bits.push(`ガッツ上限 ${s.m.guts}。敵のライフが増えると、撃てる回数の少なさが効いてくる`);
      if (!bits.length) bits.push('回数が少なく、ぶれている可能性(回数を増やして確かめる)');
      why = bits.join(' / ');
    }
    const dr = deskByName[s.m.name];
    const entry = {
      名前: s.m.name, 役: s.role, 総合: o.tier === '未計測' ? '回数不足' : o.tier, ...cell,
      暫定: o.tier === '回数不足' || o.tier === '保留' ? false : !!o.provisional, 仮の総合: o.guess || '',
      理由: reason, 強み: good.join('・'), 弱み: bad.join('・'),
      回数: Object.fromEntries(TIER_DIFFS.map((d) => { const x = diffCell(o, d); return [d, x ? x.n : 0]; })),
      勇者の回数: Object.fromEntries(TIER_DIFFS.map((d) => { const x = diffCell(o, d); return [d, x ? x.heroN : 0]; })),
      難易度が暫定: Object.fromEntries(TIER_DIFFS.map((d) => { const x = diffCell(o, d); return [d, !!(x && x.n && x.provisional && x.tier !== '保留')]; })),
      動いた理由: why,
      根拠: evidenceOf(o),
    };
    if (dr) entry.机上 = { 通常技1発: Math.round(dr.nHit), '20ターンの火力': dr.dmg20, 受けられる: Object.fromEntries(TIER_DIFFS.map((d) => [d, dr.byDiff[d] ? dr.byDiff[d].w1Hits : 0])) };
    // ほかの道具が書いた項目(おすすめアシカ・相性のいい供モンなど)は残す
    const old = (prev.モンスター || []).find((x) => x && x.名前 === s.m.name) || {};
    for (const [k, v] of Object.entries(old)) if (!(k in entry)) entry[k] = v;
    return entry;
  });
  const count = Object.fromEntries(TIER_DIFFS.map((d) => [d, runs.filter((r) => r.difficulty === d).length]));
  const head = {
    更新: now,
    数えた回: { 合計: TIER_DIFFS.reduce((a, d) => a + count[d], 0), ...count },
    戦った体数: tried,
    全体数: stats.length,
    決め方: {
      重み: Object.fromEntries(TIER_DIFFS.map((d) => [d, Math.round(DIFF_WEIGHT[d] * 10)])),
      文: HOW_TEXT,
      暫定: PROVISIONAL_TEXT,
    },
    段: ['S', 'A', 'B', 'C', 'D', '保留'],
  };
  const merged = { ...prev, ...head, モンスター: mons };
  // 並び: 頭の項目 → モンスター → そのほか(アシカ・組み合わせ)
  const order = [...Object.keys(head), 'モンスター'];
  return Object.fromEntries([...order.map((k) => [k, merged[k]]), ...Object.keys(merged).filter((k) => !order.includes(k)).map((k) => [k, merged[k]])]);
}
if (jsonFile) {
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(path.resolve(jsonFile), 'utf8')); } catch (e) { prev = {}; }
  fs.writeFileSync(path.resolve(jsonFile), JSON.stringify(tierJson(prev), null, 2) + '\n');
  console.log(`書き出した: ${jsonFile}(モンスター ${stats.length}体。アシカ・組み合わせ・おすすめアシカ・相性のいい供モンは残した)`);
  // ページ(tier.html)も同じ tier.json から作り直す。いつもの置き場所に書いたときだけ(試し用の --json では作らない)
  if (jsonAt < 0) { const page = require('./tier-page'); const r = page.writePage(); console.log(r.ok ? `作り直した: ${r.out}` : `tier.html は作らなかった: ${r.problems.join(' / ')}`); }
}
if (mdFile) {
  fs.mkdirSync(path.dirname(path.resolve(mdFile)), { recursive: true });
  fs.writeFileSync(path.resolve(mdFile), text);
  console.log(`書き出した: ${mdFile}(${tried}/${stats.length}体・${runs.length}回)`);
} else process.stdout.write(text);
