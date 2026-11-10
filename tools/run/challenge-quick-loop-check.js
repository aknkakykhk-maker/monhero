const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// チャレンジモードをクリアしたとき、遊んだ難易度に応じた「裏のクイック周回ぶん」を配るしくみを確かめる。
//
//   node tools/run/challenge-quick-loop-check.js
//
// 【なにを足したか】2026-11-10 社長(統括部長・ジン部長経由)。
//   Hard 10 / Expert 50 / Master 100 / GrandMaster 150 / Hell 200 / Legend 300 / EXTREME 500。
//   EXTREME より上は ALL_EXTREME_DIFFICULTIES の並びで 1段ごとに +200(仮)。Normal 以下は 0。
//   配り方はプロモードと同じ入口(awardBackQuickLoops)。クリアしたときだけ。スコア・ランキングには触れない。
//
// 【見かた】本体の関数をそのまま切り出して動かす(まわりは差し替える)
//   ① 難易度ごとの周回数が表どおり・Normal 以下は 0・極限は 500 から +200 ずつ
//   ② 負け・リタイア(10WAVE 未満)では 0。チャレンジモード以外(クイック・プロ・種族チャレンジ…)では配らない
//   ③ AUTO設定がそろっていない/AUTO設定のクイックの難易度をクイックでクリアしていないときは配らない
//   ④ 1回のランで1回だけ(報酬の入口 awardRunRewards の同期ロックの後ろで、ほかから呼ばない)
//   ⑤ ヘルプの表は同じ定数から作る(書き写していない)
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const REPO_ROOT = path.resolve(TOOLS_DIR, '..');
let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const part = (name) => fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts', name), 'utf8');
const slice = (src, from, to) => { const a = src.indexOf(from); const b = src.indexOf(to, a + 1); return a >= 0 && b > a ? src.slice(a, b) : null; };

// ===== ① 表 =====
const diff = part('19-difficulties-and-rules.jsx');
const tableSrc = slice(diff, '// ===== チャレンジモードをクリアしたときに入る', '\n};\n');
const extremeIds = ['EXTREME', 'NIGHTMARE', 'CHAOS', 'ULTIMATE', 'INFINITY', 'GOD'];
let loopsOf = null;
if (tableSrc) {
  loopsOf = new Function('ALL_EXTREME_DIFFICULTIES', `${tableSrc}\n}; return challengeClearQuickLoops;`)(extremeIds.map(id => ({ id })));
}
check('①-0 表(CHALLENGE_CLEAR_QUICK_LOOPS)と challengeClearQuickLoops を切り出せる', !!loopsOf);
if (loopsOf) {
  const want = { Beginner: 0, Easy: 0, Normal: 0, Hard: 10, Expert: 50, Master: 100, GrandMaster: 150, Hell: 200, Legend: 300 };
  const got = Object.fromEntries(Object.keys(want).map(k => [k, loopsOf(k)]));
  check('①-1 Hard 10 / Expert 50 / Master 100 / GrandMaster 150 / Hell 200 / Legend 300、Beginner・Easy・Normal は 0', Object.keys(want).every(k => got[k] === want[k]), JSON.stringify(got));
  const ext = extremeIds.map(id => loopsOf('Normal', id));
  check('①-2 極限は EXTREME 500 から並び順に +200(NIGHTMARE 700・CHAOS 900・ULTIMATE 1100・INFINITY 1300・GOD 1500)', JSON.stringify(ext) === JSON.stringify([500, 700, 900, 1100, 1300, 1500]), JSON.stringify(ext));
  check('①-3 知らない難易度は 0', loopsOf('Unknown') === 0 && loopsOf('Normal', 'NOPE') === 0);
}
check('①-4 EXTREME より上の数が「仮」だとコメントに書いてある', /とりあえず仮に/.test(tableSrc || ''));
const realOrder = (diff.match(/const ALL_EXTREME_DIFFICULTIES = Object\.freeze\(\[\.\.\.EXTREME_DIFFICULTIES,([^\]]*)\]/) || [])[1];
check('①-5 極限の並び(ALL_EXTREME_DIFFICULTIES)が EXTREME の一覧から始まる', !!realOrder);

// ===== ②③ 配る関数を動かす =====
const app = part('60-app.jsx');
const fnSrc = slice(app, '  const CHALLENGE_CLEAR_WAVES = 10;', '  // クイック周回ぶんの報酬を配る共通の入口');
const backSrc = slice(app, '  const awardBackQuickLoops = async (loops) => {', '  // ===== MFバトルカードの1戦ぶん');
check('②-0 awardChallengeClearQuickLoops と awardBackQuickLoops を切り出せる', !!fnSrc && !!backSrc);
const run = async (env) => {
  const calls = [];
  const ctx = vm.createContext({
    BATTLE_MODE_CHALLENGE: 'challenge', BATTLE_MODE_QUICK: 'quick', RHYTHM_PLAY_RUN_LOOP_SCALE: 1,
    runMode: env.runMode ?? 'challenge', difficulty: env.difficulty ?? 'Master',
    extremeRunRef: { current: !!env.extreme }, extremeDifficulty: env.extreme || null,
    autoSettings: { quickRun: { difficulty: 'Hard', heroRosterEntry: 'x' }, allies: [] },
    quickClearCounts: {}, quickRewardPolicy: null,
    challengeClearQuickLoops: loopsOf,
    autoQuickRunConfigured: () => env.configured !== false,
    isAutoQuickRunDifficultyAllowed: () => env.allowed !== false,
    resolveRosterEntryToMon: () => ({ masuId: 1 }),
    normalizeQuickRewardPolicy: (p) => p,
    awardRhythmPlayRunLoops: async (loops) => { calls.push(loops); return { loops, xp: 1, gold: 1, bond: 0, psyche: 0, shard: 0 }; },
  });
  const fn = vm.runInContext(`(() => { ${backSrc}\n${fnSrc}\n return awardChallengeClearQuickLoops; })()`, ctx);
  const result = await fn(env.waves ?? 10);
  return { result, calls };
};
(async () => {
  if (fnSrc && backSrc && loopsOf) {
    let r = await run({});
    check('②-1 Master をクリア → 100周ぶんを1回だけ配る', r.calls.length === 1 && r.calls[0] === 100 && r.result && r.result.loops === 100, JSON.stringify(r));
    r = await run({ extreme: 'NIGHTMARE' });
    check('②-2 極限 NIGHTMARE をクリア → 700周', r.calls.length === 1 && r.calls[0] === 700, JSON.stringify(r.calls));
    for (const w of [0, 5, 9]) {
      r = await run({ waves: w });
      check(`②-3 負け・リタイア(${w}WAVE)では配らない`, r.calls.length === 0 && r.result === null);
    }
    r = await run({ difficulty: 'Normal' });
    check('②-4 Normal をクリアしても配らない(0周)', r.calls.length === 0 && r.result === null);
    for (const mode of ['quick', 'pro', 'speciesChallenge', 'tactics', 'tacticsPro']) {
      r = await run({ runMode: mode });
      check(`②-5 チャレンジモード以外(${mode})では配らない`, r.calls.length === 0 && r.result === null);
    }
    r = await run({ configured: false });
    check('③-1 AUTO設定がそろっていないときは配らない', r.calls.length === 0 && r.result === null);
    r = await run({ allowed: false });
    check('③-2 AUTO設定のクイックの難易度をクイックでクリアしていないときは配らない', r.calls.length === 0 && r.result === null);
  }

  // ===== ④ 1回のランで1回だけ =====
  const rewards = slice(app, '  const awardRunRewards = async (wavesCleared) => {', '\n  };\n');
  const lockAt = rewards ? rewards.indexOf('if (rewardsAwardedRef.current) return;') : -1;
  const callAt = rewards ? rewards.indexOf('awardChallengeClearQuickLoops(wavesCleared)') : -1;
  check('④-1 報酬の入口 awardRunRewards の同期ロック(rewardsAwardedRef)の後ろで配る', lockAt >= 0 && callAt > lockAt);
  check('④-2 ほかの所から呼んでいない(呼ぶのは awardRunRewards の1か所だけ)', (app.match(/awardChallengeClearQuickLoops\(/g) || []).length === 1);
  check('④-3 プロのぶんと同じまとまり(proQuickAward)で結果に出す(プロが配ったときは重ねない)', /const proQuickAward = \(await awardProRunQuickLoops\(wavesCleared\)\) \|\| \(await awardChallengeClearQuickLoops\(wavesCleared\)\);/.test(app));
  check('④-4 新しい保存キーを作っていない(mh_ を書いていない)', !/mh_/.test(fnSrc || ''));

  // ===== ⑤ ヘルプ =====
  const helpParts = part('20-market-notices-help.jsx');
  const helpCase = slice(helpParts, "    case 'challengeQuickLoops': {", '\n    }\n');
  check('⑤-1 ヘルプの表は challengeClearQuickLoops から作る(数を書き写していない)', !!helpCase && /challengeClearQuickLoops\(/.test(helpCase) && !/\b(10|50|100|150|200|300|500)\b/.test(helpCase.replace(/2026-11-10/g, '')));
  const help = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/data/help.js'), 'utf8');
  check('⑤-2 ヘルプに表(challengeQuickLoops)を出している', /\{ t:'data', id:'challengeQuickLoops' \}/.test(help));
  check('⑤-3 ヘルプ・説明に「倍」の言葉を使っていない', !/チャレンジモードをクリアするとクイック周回ぶんも入ります', text:'[^']*倍/.test(help));

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();
