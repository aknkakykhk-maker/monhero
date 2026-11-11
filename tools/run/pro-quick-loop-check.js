const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// プロモードのランぶんを「クイック何周ぶん」として配るしくみを確かめる。
//
//   node tools/run/pro-quick-loop-check.js
//
// 【なにを足したか】
// 2026-09-21・ユーザー提案「プロモードをクリアしたときに限り、クイック何周分の報酬が
// もらえるなら可能？ 演奏と同じ仕組み」。バトルを2つ動かすのではなく、プロのランが
// 終わったときに「クイック何周ぶんか」を数えて、その報酬だけを配る。
// スコアもランキングも動かさないので、プロが全国ランキング対象であることと衝突しない。
//
// 【見かた】
//   ① 換算(proRunQuickLoops)を実際に動かす。進んだWAVE数 × 難易度のpower × 係数5
//   ② 配る条件 … プロだけ／AUTO設定が要る／その難易度をクイックでクリア済みであること
//   ③ 配り方   … 報酬はAUTO設定のクイック難易度で計算し、クイックのクリア記録・
//                 ミッション・モンビーの進捗には触らない(遊んだのはプロなので)
//   ④ モンビーの連携は何も変わっていない(既定の引数で今までどおり動く)
const path = require('path');
const fs = require('fs');
const { REPO_ROOT, readAppSource } = require(path.join(TOOLS_DIR, 'harness'));

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const part = (name) => fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts', name), 'utf8');

// ===== ① 換算を実際に動かす =====
const core = part('10-core.jsx');
const from = core.indexOf('const PRO_RUN_QUICK_LOOP_SCALE =');
const to = core.indexOf('const rhythmPlayRunLoopsForResult =', from);
if (from < 0 || to < 0) { check('換算(proRunQuickLoops)を切り出せる', false); process.exit(1); }
const { proRunQuickLoops, PRO_RUN_QUICK_LOOP_SCALE } =
  new Function(`${core.slice(from, to)} return { proRunQuickLoops, PRO_RUN_QUICK_LOOP_SCALE };`)();

check('①-1 係数は5', PRO_RUN_QUICK_LOOP_SCALE === 5, String(PRO_RUN_QUICK_LOOP_SCALE));
// 難易度の power は DIFFICULTY_SETTINGS が正本。ここでは代表的な3つで確かめる
const POWER = { Normal: 1.0, Master: 5.0, Legend: 10.0 };
check('①-2 10WAVE完走 … Normal 5周 / Master 25周 / Legend 50周',
  proRunQuickLoops(10, POWER.Normal) === 5 && proRunQuickLoops(10, POWER.Master) === 25 && proRunQuickLoops(10, POWER.Legend) === 50,
  `${proRunQuickLoops(10, POWER.Normal)} / ${proRunQuickLoops(10, POWER.Master)} / ${proRunQuickLoops(10, POWER.Legend)}`);
check('①-3 負けてもクリアしたWAVEぶんは入る(WAVE5でちょうど半分)',
  proRunQuickLoops(5, POWER.Master) === 12 && proRunQuickLoops(5, POWER.Legend) === 25,
  `Master ${proRunQuickLoops(5, POWER.Master)} / Legend ${proRunQuickLoops(5, POWER.Legend)}`);
check('①-4 WAVEを1つも越えられなければ0', proRunQuickLoops(0, POWER.Legend) === 0);
check('①-5 1WAVEでも越えていれば最低1周', proRunQuickLoops(1, 0.25) === 1, String(proRunQuickLoops(1, 0.25)));
check('①-6 WAVEが増えれば減らない', (() => {
  for (const power of Object.values(POWER)) {
    for (let w = 1; w < 10; w += 1) if (proRunQuickLoops(w + 1, power) < proRunQuickLoops(w, power)) return false;
  }
  return true;
})());
check('①-7 難易度が重いほど多い', proRunQuickLoops(10, POWER.Legend) > proRunQuickLoops(10, POWER.Master)
  && proRunQuickLoops(10, POWER.Master) > proRunQuickLoops(10, POWER.Normal));
check('①-8 壊れた値は0(NaN・負の数・0のpower)',
  proRunQuickLoops('x', POWER.Normal) === 0 && proRunQuickLoops(-5, POWER.Normal) === 0 && proRunQuickLoops(10, 0) === 0);

// ===== ②③ 配る条件と配り方 =====
const app = readAppSource();
const body = (() => {
  const s = app.indexOf('const awardProRunQuickLoops = async (wavesCleared) => {');
  const e = app.indexOf('const awardRunRewards = async (wavesCleared) => {', s);
  return s >= 0 && e > s ? app.slice(s, e) : '';
})();
check('②-1 プロのランぶんを配る処理がある', body.length > 0);
check('②-2 配るのは各バトルのプロモードだけ',
  /if \(!\(isProMode\(runMode\) \|\| runMode === BATTLE_MODE_TACTICS_PRO\)\) return null;/.test(body));
check('②-3 AUTO設定が無ければ配らない', body.includes('if (!autoQuickRunConfigured(autoSettings)) return null;'));
check('②-4 その難易度をクイックでクリアしていなければ配らない',
  /isAutoQuickRunDifficultyAllowed\(quickDifficulty, quickClearCounts\)/.test(body));
// (2026-11-10 社長の表に変えた。Hard 以上は表・Normal 以下は今までの式。下の ⑤ で実際に動かす)
check('②-5 換算は進んだWAVE数と、プロの難易度(極限ならそのid)で決まる(proQuickLoopsFor)',
  /proQuickLoopsFor\(wavesCleared, difficulty, extremeRunRef\.current \? extremeDifficulty : null\)/.test(body));
check('③-1 報酬はAUTO設定のクイック難易度で計算する',
  /rewardMode: BATTLE_MODE_QUICK/.test(body) && /rewardDifficulty: quickDifficulty/.test(body));
check('③-2 モンビーの進捗の帯には触らない', /countLoopProgress: false/.test(body));
check('③-3 クイックのクリア記録・ミッション・助手の絆は進めない', /recordQuickClear: false/.test(body));
// ★絆経験値の行き先は「裏でクイックを回していたときと同じ顔ぶれ」にそろえる
//   (2026-09-21・ユーザー指示「オート設定のモンスター達と編成に入ってるモンスター。
//    モンビーと同じ仕様」)。プロで戦った編成ではない
check('③-4 絆はAUTO設定の勇者モンへ入れる',
  /bondHeroMasuId: quickHeroMon\?\.masuId/.test(body)
  && /resolveRosterEntryToMon\(autoSettings\.quickRun\.heroRosterEntry\)/.test(body));
check('③-5 絆はAUTO設定の供モン①②③へも入れる',
  /autoSettings\.allies[\s\S]{0,260}?resolveRosterEntryToMon\(ally\?\.rosterEntry\)/.test(body)
  && /bondParticipantMasuIds: quickAllyMasuIds/.test(body));
// ★報酬を配り終えてから呼ぶ。先に呼ぶと、プロ本体の報酬が入る前に画面へ出てしまう
check('③-6 プロ本体の報酬を配り終えてから呼ぶ',
  /const proQuickAward = await awardProRunQuickLoops\(wavesCleared\);\n\s*setFinalRewardSummary\(/.test(app));
check('③-7 結果画面へ渡している', /setFinalRewardSummary\(\{[^}]*proQuickAward \}\)/.test(app));
check('③-8 結果画面に出している',
  part('27-result-widgets.jsx').includes('data-pro-quick-award')
  && part('27-result-widgets.jsx').includes('summary.proQuickAward.loops'));

// ===== ④ モンビーの連携は変えない =====
const award = (() => {
  const s = app.indexOf('const awardRhythmPlayRunLoops = async (loops,');
  const e = app.indexOf('baseLoops: Math.max(0, Math.trunc(Number(baseLoops) || 0)) || count };', s);
  return s >= 0 && e > s ? app.slice(s, e) : '';
})();
check('④-1 追加した引数は、渡さなければ今までどおり',
  /rewardMode = null, rewardDifficulty = null, rewardPolicy = null,/.test(award)
  && /countLoopProgress = true, recordQuickClear = true,/.test(award)
  && /bondHeroMasuId = null, bondParticipantMasuIds = null,/.test(award));
check('④-2 既定では、いま走っているランのモードと難易度を見る',
  award.includes('const awardMode = rewardMode || runMode;')
  && award.includes('const awardDifficulty = rewardDifficulty || difficulty;'));
check('④-3 難易度を渡されたときだけ、クイックの倍率表で計算する',
  award.includes('rewardDifficulty ? quickLoopRewardMultipliers(awardDifficulty) : runRewardMultipliers()'));
check('④-4 演奏からの呼び出しは、引数を足していない(今までどおり全部通る)',
  /await awardRhythmPlayRunLoops\(loops,loopScale,\{cleared,baseLoops\}\)/.test(app.replace(/\s+/g, '')
    .replace('awaitawardRhythmPlayRunLoops(loops,loopScale,{cleared,baseLoops})', 'await awardRhythmPlayRunLoops(loops,loopScale,{cleared,baseLoops})')));
check('④-5 絆の行き先も、渡さなければ今までどおり戦っている編成',
  award.includes('bondHeroMasuId !== null ? bondHeroMasuId : mainHero?.masuId')
  && award.includes('bondParticipantMasuIds !== null ? bondParticipantMasuIds : slots.filter(s => s?.masuId).map(s => s.masuId)'));

// ===== ⑤ 社長の表(2026-11-10)。proQuickLoopsFor を本体から切り出して動かす =====
//   Hard 10 / Expert 50 / Master 100 / GrandMaster 150 / Hell 200 / Legend 300 / EXTREME 500、その上は +200 ずつ(仮)。Normal 以下は今までの式。
//   負けたら後ろのWAVEほど重く(WAVE n の重みは n)、1WAVE以上なら最低1周
{
  const diffSrc = part('19-difficulties-and-rules.jsx');
  const a = diffSrc.indexOf('// ===== プロモード(クラシックのプロ・タクティクスのプロ)で入る');
  const b = diffSrc.indexOf('\n};\n', a);
  const exIds = ['EXTREME', 'NIGHTMARE', 'CHAOS', 'ULTIMATE', 'INFINITY', 'GOD'];
  const POWERS = { Beginner: 0.25, Easy: 0.5, Normal: 1.0, Hard: 1.5, Expert: 3.0, Master: 5.0, GrandMaster: 6.5, Hell: 8.0, Legend: 10.0 };
  let f = null;
  if (a >= 0 && b > a) {
    f = new Function('ALL_EXTREME_DIFFICULTIES', 'DIFFICULTY_SETTINGS', 'proRunQuickLoops', `${diffSrc.slice(a, b)}\n}; return proQuickLoopsFor;`)(
      exIds.map(id => ({ id })), Object.fromEntries(Object.entries(POWERS).map(([k, power]) => [k, { power }])), proRunQuickLoops);
  }
  check('⑤-0 proQuickLoopsFor を切り出せる', !!f);
  if (f) {
    const want = { Hard: 10, Expert: 50, Master: 100, GrandMaster: 150, Hell: 200, Legend: 300 };
    const got = Object.fromEntries(Object.keys(want).map(k => [k, f(10, k)]));
    check('⑤-1 10WAVE完走: Hard 10 / Expert 50 / Master 100 / GrandMaster 150 / Hell 200 / Legend 300', Object.keys(want).every(k => got[k] === want[k]), JSON.stringify(got));
    const ex = exIds.map(id => f(10, 'Normal', id));
    check('⑤-2 極限: EXTREME 500 から並び順に +200(700・900・1100・1300・1500)', JSON.stringify(ex) === '[500,700,900,1100,1300,1500]', JSON.stringify(ex));
    check('⑤-3 タクティクスで難易度に極限のidが入っているときも同じ', f(10, 'NIGHTMARE') === 700);
    // (2026-11-10 社長: Normal 以下も同じ形。完走は今までの式の 1・2・5、途中は ÷135 で最低1)
    const low = ['Beginner', 'Easy', 'Normal'].map(k => [f(10, k), proRunQuickLoops(10, POWERS[k]), ...[1, 5, 9].map(w => f(w, k))]);
    check('⑤-4 Normal 以下: 完走は今までの式(1・2・5)、途中は同じ形(Normal の WAVE9 は 5×45÷135=1)', JSON.stringify(low) === '[[1,1,1,1,1],[2,2,1,1,1],[5,5,1,1,1]]', JSON.stringify(low));
    // (2026-11-10 社長「クリアだけは劇的に高くしないと報酬美味しすぎる」: 途中は ÷135。WAVE9 でクリアの3分の1)
    const legend = Array.from({ length: 10 }, (_, i) => f(i + 1, 'Legend'));
    check('⑤-5 Legend: 途中は 2/6/13/22/33/46/62/80/100、完走 300', JSON.stringify(legend) === '[2,6,13,22,33,46,62,80,100,300]', JSON.stringify(legend));
    const hell = Array.from({ length: 10 }, (_, i) => f(i + 1, 'Hell'));
    check('⑤-6 Hell: 途中は 1/4/8/14/22/31/41/53/66、完走 200', JSON.stringify(hell) === '[1,4,8,14,22,31,41,53,66,200]', JSON.stringify(hell));
    check('⑤-7 1WAVE以上なら最低1周(Hard で WAVE1 → 1周)・0WAVE は 0', f(1, 'Hard') === 1 && f(0, 'Hell') === 0);
    const all = ['Hard', 'Expert', 'Master', 'GrandMaster', 'Hell', 'Legend'];
    check('⑤-7b どの表の難易度も、WAVE9 は完走の3分の1(切り捨て)で、整数で割っている(99.999… で1つ減らない)', all.every(k => f(9, k) === Math.floor(f(10, k) * 45 / 135)) && f(9, 'Legend') === 100, all.map(k => `${k}:${f(9, k)}/${f(10, k)}`).join(' '));
    // 逆転なし・途中はどれも完走以下(2026-11-10 社長)
    const order = ['Beginner', 'Easy', 'Normal', 'Hard', 'Expert', 'Master', 'GrandMaster', 'Hell', 'Legend'];
    const bad = [];
    for (let w = 1; w <= 10; w++) for (let i = 1; i < order.length; i++) if (f(w, order[i]) < f(w, order[i - 1])) bad.push(`${w}WAVE: ${order[i - 1]} ${f(w, order[i - 1])} > ${order[i]} ${f(w, order[i])}`);
    const exOrder = exIds.map(id => [id, (w) => f(w, 'Normal', id)]);
    for (let w = 1; w <= 10; w++) { if (exOrder[0][1](w) < f(w, 'Legend')) bad.push(`${w}WAVE: Legend > EXTREME`); for (let i = 1; i < exOrder.length; i++) if (exOrder[i][1](w) < exOrder[i - 1][1](w)) bad.push(`${w}WAVE: ${exOrder[i - 1][0]} > ${exOrder[i][0]}`); }
    check('⑤-7c どの WAVE でも、上の難易度が下の難易度より少なくならない(逆転なし。極限も含む)', bad.length === 0, bad.join(' / '));
    const over = [];
    for (const k of order) for (let w = 1; w <= 9; w++) if (f(w, k) > f(10, k)) over.push(`${k} ${w}WAVE`);
    for (const id of exIds) for (let w = 1; w <= 9; w++) if (f(w, 'Normal', id) > f(10, 'Normal', id)) over.push(`${id} ${w}WAVE`);
    check('⑤-7d 途中(1〜9WAVE)はどれも完走以下', over.length === 0, over.join(' / '));
  }
  check('⑤-8 EXTREME より上の数が「仮」だとコメントに書いてある', /とりあえず仮に/.test(a >= 0 ? diffSrc.slice(a, b) : ''));
  const helpSrc = part('20-market-notices-help.jsx');
  const hs = helpSrc.indexOf("case 'proQuickLoops': {");
  const hcase = hs >= 0 ? helpSrc.slice(hs, helpSrc.indexOf('\n    }\n', hs)) : '';
  check('⑤-9 ヘルプの表は proQuickLoopsFor から作る(数を書き写していない)', /proQuickLoopsFor\(10, id, ex\)/.test(hcase) && !/\b(10|50|100|150|200|300|500)周/.test(hcase));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
