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
check('②-5 換算は進んだWAVE数と、プロの難易度の重さで決まる',
  /proRunQuickLoops\(wavesCleared, DIFFICULTY_SETTINGS\[difficulty\]\?\.power\)/.test(body));
check('③-1 報酬はAUTO設定のクイック難易度で計算する',
  /rewardMode: BATTLE_MODE_QUICK/.test(body) && /rewardDifficulty: quickDifficulty/.test(body));
check('③-2 モンビーの進捗の帯には触らない', /countLoopProgress: false/.test(body));
check('③-3 クイックのクリア記録・ミッション・助手の絆は進めない', /recordQuickClear: false/.test(body));
// ★報酬を配り終えてから呼ぶ。先に呼ぶと、プロ本体の報酬が入る前に画面へ出てしまう
check('③-4 プロ本体の報酬を配り終えてから呼ぶ',
  /const proQuickAward = await awardProRunQuickLoops\(wavesCleared\);\n\s*setFinalRewardSummary\(/.test(app));
check('③-5 結果画面へ渡している', /setFinalRewardSummary\(\{[^}]*proQuickAward \}\)/.test(app));
check('③-6 結果画面に出している',
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
  && /countLoopProgress = true, recordQuickClear = true,/.test(award));
check('④-2 既定では、いま走っているランのモードと難易度を見る',
  award.includes('const awardMode = rewardMode || runMode;')
  && award.includes('const awardDifficulty = rewardDifficulty || difficulty;'));
check('④-3 難易度を渡されたときだけ、クイックの倍率表で計算する',
  award.includes('rewardDifficulty ? quickLoopRewardMultipliers(awardDifficulty) : runRewardMultipliers()'));
check('④-4 演奏からの呼び出しは、引数を足していない(今までどおり全部通る)',
  /await awardRhythmPlayRunLoops\(loops,loopScale,\{cleared,baseLoops\}\)/.test(app.replace(/\s+/g, '')
    .replace('awaitawardRhythmPlayRunLoops(loops,loopScale,{cleared,baseLoops})', 'await awardRhythmPlayRunLoops(loops,loopScale,{cleared,baseLoops})')));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);
